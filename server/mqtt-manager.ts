import mqtt from "mqtt";
import type { TraegerTelemetry, AutomationStage } from "@shared/traeger-types";
import type { TempMarker } from "@shared/meat-science";
import { pushTelemetryUpdate, pushAlertEvent, pushDisconnectEvent, pushAutomationEvent } from "./sse";

// ─── Types ──────────────────────────────────────────────

export interface CookAlert {
  id: string;
  label: string;
  triggerTemp: number;
  triggerType: "probe" | "grill";
  alertType: "notification" | "alarm";
  status: "pending" | "fired" | "dismissed";
  firedAt?: number;
  message?: string;
}

interface ActiveCookSession {
  cookSessionId: number;
  templateId?: string;
  meatProfileId?: string;
  startedAt: number;
  alerts: CookAlert[];
  stages?: Array<{ name: string; temp: number; duration?: number }>;
  currentStage: number;
  peakGrillTemp: number;
  peakProbeTemp: number;
  stallDetected: boolean;
  stallStartedAt?: number;
  stallStartTemp?: number;
  lastProbeTemps: number[]; // last 10 readings for stall detection
  // --- Automation program state ---
  automationId?: number;                // DB id of the active automation program
  automationStages?: AutomationStage[]; // The full automation stage definitions
  automationPhase: number;              // Current automation phase index
  phaseStartedAt?: number;              // When the current phase started
  lastAlarmTemp?: number;               // Last temp at which an escalating alarm fired
  phaseAcknowledged?: boolean;          // Whether user acknowledged the current phase alarm
  autoCommandsSent: string[];           // Track which auto-commands have been sent (prevent duplicates)
}

interface MqttSession {
  client: mqtt.MqttClient | null;
  thingName: string;
  signedUrl: string;
  expiresAt: number;
  telemetry: TraegerTelemetry;
  lastUpdate: number;
  reconnecting: boolean;
  history: Array<TraegerTelemetry & { timestamp: number }>;
  activeCook: ActiveCookSession | null;
  firedAlerts: CookAlert[]; // alerts that fired (for missed alerts panel)
  dbPersistInterval: ReturnType<typeof setInterval> | null;
  dbPersistCallback: ((userId: string, telemetry: TraegerTelemetry, cookSessionId?: number) => Promise<void>) | null;
  pelletPersistCallback: ((userId: string, pelletLevel: number, grillTemp: number, cookSessionId?: number) => Promise<void>) | null;
  cookStatePersistCallback: ((userId: string, cook: ActiveCookSession) => Promise<void>) | null;
  // Automation: callback to send grill commands from the automation engine
  sendCommandCallback: ((userId: string, command: string) => Promise<void>) | null;
  // RC-4: Backpressure flag — skip persist if previous one is still in flight
  persistInFlight: boolean;
  pelletPersistInFlight: boolean;
  cookStatePersistInFlight: boolean;
  lastPelletPersistTime: number;
}

// In-memory store of active MQTT sessions keyed by userId
const sessions = new Map<string, MqttSession>();

const DEFAULT_TELEMETRY: TraegerTelemetry = {
  grill: 0,
  set: 0,
  ambient: 0,
  pelletLevel: 0,
  connected: false,
  systemStatus: 99,
  probe: 0,
  probeSet: 0,
  probeCon: 0,
  probeAlarmFired: 0,
  keepwarm: 0,
  smoke: 0,
  units: 1,
  cookTimerStart: 0,
  cookTimerEnd: 0,
  acc: [],
};

// ─── Telemetry Parser ───────────────────────────────────

function parseTelemetry(payload: Record<string, unknown>): Partial<TraegerTelemetry> {
  const status = (payload.status || payload) as Record<string, unknown>;
  const result: Partial<TraegerTelemetry> = {};

  if (typeof status.grill === "number") result.grill = status.grill;
  if (typeof status.set === "number") result.set = status.set;
  if (typeof status.ambient === "number") result.ambient = status.ambient;
  if (typeof status.probe === "number") result.probe = status.probe;
  if (typeof status.probe_set === "number") result.probeSet = status.probe_set;
  if (typeof status.probeSet === "number") result.probeSet = status.probeSet;
  if (typeof status.pellet_level === "number") result.pelletLevel = status.pellet_level;
  if (typeof status.pelletLevel === "number") result.pelletLevel = status.pelletLevel;
  if (typeof status.system_status === "number") result.systemStatus = status.system_status;
  if (typeof status.systemStatus === "number") result.systemStatus = status.systemStatus;
  if (typeof status.connected === "boolean") result.connected = status.connected;
  if (typeof status.probe_con === "number") result.probeCon = status.probe_con;
  if (typeof status.probeCon === "number") result.probeCon = status.probeCon;
  if (typeof status.probe_alarm_fired === "number") result.probeAlarmFired = status.probe_alarm_fired;
  if (typeof status.probeAlarmFired === "number") result.probeAlarmFired = status.probeAlarmFired;
  if (typeof status.keepwarm === "number") result.keepwarm = status.keepwarm;
  if (typeof status.smoke === "number") result.smoke = status.smoke;
  if (typeof status.units === "number") result.units = status.units;
  if (typeof status.cook_timer_start === "number") result.cookTimerStart = status.cook_timer_start;
  if (typeof status.cookTimerStart === "number") result.cookTimerStart = status.cookTimerStart;
  if (typeof status.cook_timer_end === "number") result.cookTimerEnd = status.cook_timer_end;
  if (typeof status.cookTimerEnd === "number") result.cookTimerEnd = status.cookTimerEnd;
  if (Array.isArray(status.acc)) result.acc = status.acc;

  return result;
}

// ─── Alert Engine ───────────────────────────────────────

function evaluateAlerts(session: MqttSession): CookAlert[] {
  if (!session.activeCook) return [];

  const newlyFired: CookAlert[] = [];
  const telemetry = session.telemetry;

  for (const alert of session.activeCook.alerts) {
    if (alert.status !== "pending") continue;

    const currentTemp = alert.triggerType === "probe" ? telemetry.probe : telemetry.grill;
    if (currentTemp >= alert.triggerTemp) {
      alert.status = "fired";
      alert.firedAt = Date.now();
      newlyFired.push(alert);
      session.firedAlerts.push({ ...alert });
      console.log(`[ALERT] User session: ${alert.alertType.toUpperCase()} fired — ${alert.label} at ${currentTemp}°F (target: ${alert.triggerTemp}°F)`);
    }
  }

  return newlyFired;
}

// ─── Stall Detection ────────────────────────────────────

function detectStall(session: MqttSession): void {
  if (!session.activeCook) return;
  const cook = session.activeCook;

  // Add current probe temp to rolling window
  cook.lastProbeTemps.push(session.telemetry.probe);
  if (cook.lastProbeTemps.length > 10) {
    cook.lastProbeTemps.shift();
  }

  // Need at least 10 readings (~5 min at 30s intervals)
  if (cook.lastProbeTemps.length < 10) return;

  // Check if probe is in the stall zone (150-170°F) and temp change < 2°F over window
  const probeTemp = session.telemetry.probe;
  const tempRange = Math.max(...cook.lastProbeTemps) - Math.min(...cook.lastProbeTemps);

  if (probeTemp >= 145 && probeTemp <= 175 && tempRange < 2) {
    if (!cook.stallDetected) {
      cook.stallDetected = true;
      cook.stallStartedAt = Date.now();
      cook.stallStartTemp = probeTemp;
      console.log(`[STALL] Detected at ${probeTemp}°F — temp change < 2°F over last 10 readings`);
    }
  } else if (cook.stallDetected && probeTemp > (cook.stallStartTemp || 0) + 5) {
    // Stall broken — temp rose more than 5°F above stall start
    console.log(`[STALL] Broken at ${probeTemp}°F (started at ${cook.stallStartTemp}°F)`);
    cook.stallDetected = false;
    cook.stallStartedAt = undefined;
    cook.stallStartTemp = undefined;
  }
}

// ─── Peak Tracking ──────────────────────────────────────

function trackPeaks(session: MqttSession): void {
  if (!session.activeCook) return;
  if (session.telemetry.grill > session.activeCook.peakGrillTemp) {
    session.activeCook.peakGrillTemp = session.telemetry.grill;
  }
  if (session.telemetry.probe > session.activeCook.peakProbeTemp) {
    session.activeCook.peakProbeTemp = session.telemetry.probe;
  }
}

// ─── Automation Engine ─────────────────────────────────

/**
 * Evaluate automation program phases on every telemetry update.
 * Handles:
 * - Phase trigger detection (probe temp, time)
 * - Escalating alarms (re-alarm every N°F)
 * - Auto-commands (set grill temp, super smoke, keep warm)
 * - Phase advancement
 */
/**
 * Check if a single trigger condition is met.
 */
function checkSingleTrigger(
  type: "probe_temp" | "time" | "manual",
  value: number,
  probeTemp: number,
  _grillTemp: number,
  phaseStartedAt: number | undefined,
  timerStartedAt: number | undefined,
): boolean {
  if (type === "probe_temp") {
    return probeTemp >= value;
  } else if (type === "time") {
    // Timer can use its own start time (for secondary timers) or phase start
    const startTime = timerStartedAt ?? phaseStartedAt;
    const elapsed = startTime ? (Date.now() - startTime) / 1000 : 0;
    return elapsed >= value;
  }
  // "manual" triggers never auto-fire
  return false;
}

function evaluateAutomation(userId: string, session: MqttSession): void {
  const cook = session.activeCook;
  if (!cook?.automationStages || cook.automationStages.length === 0) return;

  const phase = cook.automationPhase;
  if (phase >= cook.automationStages.length) return; // All phases complete

  const stage = cook.automationStages[phase];
  const telemetry = session.telemetry;
  const probeTemp = telemetry.probe;
  const grillTemp = telemetry.grill;

  // --- Initialize timer tracking for this phase ---
  if (!stage.timerStartedAt && cook.phaseStartedAt) {
    stage.timerStartedAt = cook.phaseStartedAt;
  }

  // --- Check primary trigger ---
  const primaryMet = checkSingleTrigger(
    stage.triggerType, stage.triggerValue,
    probeTemp, grillTemp,
    cook.phaseStartedAt, undefined,
  );

  // --- Check secondary trigger (if compound) ---
  let secondaryMet = false;
  if (stage.secondaryTriggerType && stage.secondaryTriggerValue != null) {
    secondaryMet = checkSingleTrigger(
      stage.secondaryTriggerType, stage.secondaryTriggerValue,
      probeTemp, grillTemp,
      cook.phaseStartedAt, stage.timerStartedAt,
    );
  }

  // --- Track which triggers have fired (for AND logic) ---
  if (primaryMet) stage.primaryFired = true;
  if (secondaryMet) stage.secondaryFired = true;

  // --- Apply compound logic ---
  let triggerMet = false;
  const logic = stage.triggerLogic;

  if (!stage.secondaryTriggerType || !logic) {
    // Simple trigger: only primary matters
    triggerMet = primaryMet;
  } else if (logic === "or" || logic === "fallback") {
    // OR / Fallback: whichever fires first
    triggerMet = primaryMet || secondaryMet;
  } else if (logic === "and") {
    // AND: both must have fired at some point
    triggerMet = !!stage.primaryFired && !!stage.secondaryFired;
  } else if (logic === "priority") {
    // Priority: primary takes precedence, but secondary can also trigger
    triggerMet = primaryMet || secondaryMet;
  }

  // Log which trigger fired for compound triggers
  if (triggerMet && logic && stage.secondaryTriggerType && !cook.autoCommandsSent.includes(`trigger-${phase}`)) {
    const firedBy = primaryMet ? "primary" : "secondary";
    const triggerDesc = primaryMet
      ? `${stage.triggerType}=${stage.triggerValue}`
      : `${stage.secondaryTriggerType}=${stage.secondaryTriggerValue}`;
    console.log(`[AUTO] User ${userId}: Compound trigger (${logic}) met by ${firedBy}: ${triggerDesc}`);
  }

  // --- Escalating alarms: re-alarm every N°F above trigger ---
  if (triggerMet && stage.alarmIntervalDegrees && stage.alarmIntervalDegrees > 0) {
    const maxTemp = stage.alarmMaxTemp ?? Infinity;
    const lastAlarm = cook.lastAlarmTemp ?? stage.triggerValue;
    const nextAlarmTemp = lastAlarm + stage.alarmIntervalDegrees;

    if (probeTemp >= nextAlarmTemp && probeTemp <= maxTemp) {
      // Fire an escalating alarm
      cook.lastAlarmTemp = Math.floor(probeTemp / stage.alarmIntervalDegrees) * stage.alarmIntervalDegrees;
      const alarmId = `auto-escalate-${phase}-${cook.lastAlarmTemp}`;

      const alarm: CookAlert = {
        id: alarmId,
        label: `${stage.name} — Probe at ${Math.round(probeTemp)}°F`,
        triggerTemp: cook.lastAlarmTemp,
        triggerType: "probe",
        alertType: "alarm",
        status: "fired",
        firedAt: Date.now(),
        message: stage.alertMessage || `Probe reached ${Math.round(probeTemp)}°F — action needed!`,
      };

      cook.alerts.push(alarm);
      session.firedAlerts.push({ ...alarm });

      pushAlertEvent(userId, {
        id: alarm.id,
        label: alarm.label,
        message: alarm.message!,
        alertType: "alarm",
      });

      pushAutomationEvent(userId, {
        eventType: "escalating_alarm",
        phase,
        phaseName: stage.name,
        message: `Escalating alarm: probe at ${Math.round(probeTemp)}°F`,
        probeTemp: Math.round(probeTemp),
        grillTemp: Math.round(grillTemp),
      });

      console.log(`[AUTO] User ${userId}: Escalating alarm at ${Math.round(probeTemp)}°F (phase ${phase}: ${stage.name})`);
    }
  }

  // --- First trigger: fire the phase alert ---
  if (triggerMet && !cook.autoCommandsSent.includes(`trigger-${phase}`)) {
    cook.autoCommandsSent.push(`trigger-${phase}`);

    // Fire the phase trigger alert
    const alertId = `auto-phase-${phase}`;
    const alert: CookAlert = {
      id: alertId,
      label: `${stage.name} — Target reached!`,
      triggerTemp: stage.triggerValue,
      triggerType: stage.triggerType === "probe_temp" ? "probe" : "grill",
      alertType: stage.alertType,
      status: "fired",
      firedAt: Date.now(),
      message: stage.alertMessage || `Phase "${stage.name}" trigger reached!`,
    };

    cook.alerts.push(alert);
    session.firedAlerts.push({ ...alert });

    pushAlertEvent(userId, {
      id: alert.id,
      label: alert.label,
      message: alert.message!,
      alertType: stage.alertType,
    });

    console.log(`[AUTO] User ${userId}: Phase ${phase} (${stage.name}) trigger fired at probe=${Math.round(probeTemp)}°F`);

    // --- Auto-commands: send grill commands ---
    if (stage.autoSetGrillTemp && !cook.autoCommandsSent.includes(`setTemp-${phase}`)) {
      cook.autoCommandsSent.push(`setTemp-${phase}`);
      const tempCommand = JSON.stringify({ set: stage.autoSetGrillTemp });

      if (session.sendCommandCallback) {
        session.sendCommandCallback(userId, tempCommand)
          .then(() => {
            console.log(`[AUTO] User ${userId}: Auto-set grill to ${stage.autoSetGrillTemp}°F (phase ${phase})`);
            pushAutomationEvent(userId, {
              eventType: "auto_command",
              phase,
              phaseName: stage.name,
              message: `Auto-set grill temperature to ${stage.autoSetGrillTemp}°F`,
              autoCommand: `setTemp:${stage.autoSetGrillTemp}`,
              probeTemp: Math.round(probeTemp),
              grillTemp: Math.round(grillTemp),
            });
          })
          .catch((err: unknown) => {
            console.error(`[AUTO] User ${userId}: Failed to auto-set temp:`, err);
          });
      }
    }

    // --- Advance to next phase (unless holdAfterTrigger or requireAcknowledge) ---
    if (!stage.holdAfterTrigger && !stage.requireAcknowledge) {
      advanceAutomationPhase(userId, session);
    } else if (stage.requireAcknowledge) {
      cook.phaseAcknowledged = false;
      console.log(`[AUTO] User ${userId}: Phase ${phase} waiting for acknowledgment`);
    }

    pushAutomationEvent(userId, {
      eventType: "phase_complete",
      phase,
      phaseName: stage.name,
      message: `Phase "${stage.name}" completed`,
      probeTemp: Math.round(probeTemp),
      grillTemp: Math.round(grillTemp),
    });
  }
}

/**
 * Advance to the next automation phase.
 */
function advanceAutomationPhase(userId: string, session: MqttSession): void {
  const cook = session.activeCook;
  if (!cook?.automationStages) return;

  const nextPhase = cook.automationPhase + 1;
  if (nextPhase >= cook.automationStages.length) {
    console.log(`[AUTO] User ${userId}: All automation phases complete`);
    return;
  }

  cook.automationPhase = nextPhase;
  cook.currentStage = nextPhase;
  cook.phaseStartedAt = Date.now();
  cook.lastAlarmTemp = undefined;
  cook.phaseAcknowledged = undefined;

  // Reset compound trigger state for the new phase
  const nextStageObj = cook.automationStages[nextPhase];
  if (nextStageObj) {
    nextStageObj.primaryFired = false;
    nextStageObj.secondaryFired = false;
    nextStageObj.timerStartedAt = Date.now();
  }

  const nextStage = cook.automationStages[nextPhase];

  // Auto-set grill temp for the new phase (if different from current)
  if (nextStage.grillTemp && session.sendCommandCallback) {
    const commandKey = `phaseTemp-${nextPhase}`;
    if (!cook.autoCommandsSent.includes(commandKey)) {
      cook.autoCommandsSent.push(commandKey);
      const tempCommand = JSON.stringify({ set: nextStage.grillTemp });
      session.sendCommandCallback(userId, tempCommand)
        .then(() => {
          console.log(`[AUTO] User ${userId}: Set grill to ${nextStage.grillTemp}°F for phase ${nextPhase} (${nextStage.name})`);
        })
        .catch((err: unknown) => {
          console.error(`[AUTO] User ${userId}: Failed to set phase temp:`, err);
        });
    }
  }

  pushAutomationEvent(userId, {
    eventType: "phase_change",
    phase: nextPhase,
    phaseName: nextStage.name,
    message: `Entering phase: ${nextStage.name} (grill at ${nextStage.grillTemp}°F)`,
  });

  console.log(`[AUTO] User ${userId}: Advanced to phase ${nextPhase}: ${nextStage.name}`);
}

// ─── MQTT Connection ────────────────────────────────────

export function connectMqtt(
  userId: string,
  thingName: string,
  signedUrl: string,
  expiresAt: number
): void {
  const existing = sessions.get(userId);
  if (existing && existing.thingName === thingName && existing.client?.connected) {
    if (existing.expiresAt > Date.now() + 60000) {
      return;
    }
    disconnectMqtt(userId);
  }

  if (existing && existing.thingName !== thingName) {
    disconnectMqtt(userId);
  }

  const session: MqttSession = {
    client: null,
    thingName,
    signedUrl,
    expiresAt,
    telemetry: { ...DEFAULT_TELEMETRY },
    lastUpdate: 0,
    reconnecting: false,
    history: existing?.history || [],
    activeCook: existing?.activeCook || null,
    firedAlerts: existing?.firedAlerts || [],
    dbPersistInterval: null,
    dbPersistCallback: existing?.dbPersistCallback || null,
    pelletPersistCallback: existing?.pelletPersistCallback || null,
    cookStatePersistCallback: existing?.cookStatePersistCallback || null,
    sendCommandCallback: existing?.sendCommandCallback || null,
    persistInFlight: false,
    pelletPersistInFlight: false,
    cookStatePersistInFlight: false,
    lastPelletPersistTime: 0,
  };

  sessions.set(userId, session);

  try {
    console.log(`[MQTT] User ${userId}: Connecting to ${thingName}...`);
    const url = new URL(signedUrl);
    const wsUrl = `wss://${url.host}${url.pathname}${url.search}`;

    const client = mqtt.connect(wsUrl, {
      protocolVersion: 4,
      keepalive: 300,
      reconnectPeriod: 5000,
      connectTimeout: 15000,
      rejectUnauthorized: false,
      wsOptions: { headers: { Host: url.host } },
    });

    session.client = client;

    client.on("connect", () => {
      console.log(`[MQTT] User ${userId}: Connected to broker`);
      session.reconnecting = false;

      const topic = `prod/thing/update/${thingName}`;
      client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          console.error(`[MQTT] User ${userId}: Subscribe error:`, err);
        } else {
          console.log(`[MQTT] User ${userId}: Subscribed to ${topic}`);
        }
      });
    });

    client.on("message", (_topic, message) => {
      try {
        const payload = JSON.parse(message.toString());
        const telemetryUpdate = parseTelemetry(payload);

        session.telemetry = {
          ...session.telemetry,
          ...telemetryUpdate,
          connected: true,
        };
        session.lastUpdate = Date.now();

        // Add to in-memory history (keep last 8 hours at ~30s = ~960 points)
        session.history.push({
          ...session.telemetry,
          timestamp: Date.now(),
        });
        if (session.history.length > 1000) {
          session.history = session.history.slice(-1000);
        }

        // Run alert engine
        const newlyFired = evaluateAlerts(session);

        // Track peaks
        trackPeaks(session);

        // Stall detection
        detectStall(session);

        // Automation engine: evaluate phase transitions, escalating alarms, auto-commands
        evaluateAutomation(userId, session);

        // P0-INT: Persist cook state to DB on every update so it survives restarts
        if (session.activeCook && session.dbPersistCallback) {
          const cook = session.activeCook;
          // Debounce: only persist state changes every 5th message or on alert fire
          const shouldPersistState = (session.history.length % 5 === 0) || newlyFired.length > 0;
          if (shouldPersistState && session.cookStatePersistCallback && !session.cookStatePersistInFlight) {
            session.cookStatePersistInFlight = true;
            session.cookStatePersistCallback(userId, cook)
              .catch((e: unknown) => {
                console.error(`[MQTT] User ${userId}: Cook state persist error:`, e);
              })
              .finally(() => {
                session.cookStatePersistInFlight = false;
              });
          }
        }

        // P3: Push real-time update to SSE clients
        pushTelemetryUpdate(userId);

        // P3: Push individual alert events
        for (const alert of newlyFired) {
          pushAlertEvent(userId, {
            id: alert.id,
            label: alert.label,
            message: alert.message || `${alert.label} reached!`,
            alertType: alert.alertType,
          });
        }

      } catch (err) {
        console.error(`[MQTT] User ${userId}: Parse error:`, err);
      }
    });

    client.on("error", (err) => {
      console.error(`[MQTT] User ${userId}: Error:`, err.message);
    });

    client.on("close", () => {
      if (session.telemetry.connected) {
        session.telemetry = { ...session.telemetry, connected: false };
        // P3: Notify SSE clients of disconnect
        pushDisconnectEvent(userId, "MQTT connection closed");
      }
    });

    client.on("reconnect", () => {
      session.reconnecting = true;
    });

    client.on("offline", () => {
      console.log(`[MQTT] User ${userId}: Client offline`);
    });

    // RC-4: Set up periodic DB persistence (every 30 seconds) with backpressure
    session.dbPersistInterval = setInterval(async () => {
      if (session.persistInFlight) {
        console.log(`[MQTT] User ${userId}: Skipping DB persist — previous still in flight`);
        return;
      }
      if (session.dbPersistCallback && session.telemetry.connected && session.telemetry.grill > 0) {
        session.persistInFlight = true;
        try {
          await session.dbPersistCallback(
            userId,
            session.telemetry,
            session.activeCook?.cookSessionId
          );
        } catch (err) {
          console.error(`[MQTT] User ${userId}: DB persist error:`, err);
        } finally {
          session.persistInFlight = false;
        }
      }
      // Pellet persistence: log every 5 minutes (every 10th interval of 30s)
      const now = Date.now();
      if (
        session.pelletPersistCallback &&
        session.telemetry.connected &&
        session.telemetry.pelletLevel > 0 &&
        !session.pelletPersistInFlight &&
        (now - session.lastPelletPersistTime) >= 300000 // 5 minutes
      ) {
        session.pelletPersistInFlight = true;
        try {
          await session.pelletPersistCallback(
            userId,
            session.telemetry.pelletLevel,
            session.telemetry.grill,
            session.activeCook?.cookSessionId
          );
          session.lastPelletPersistTime = now;
        } catch (err) {
          console.error(`[MQTT] User ${userId}: Pellet persist error:`, err);
        } finally {
          session.pelletPersistInFlight = false;
        }
      }
    }, 30000);

  } catch (err) {
    console.error(`[MQTT] User ${userId}: Connection failed:`, err);
  }
}

// ─── Disconnect ─────────────────────────────────────────

export function disconnectMqtt(userId: string): void {
  const session = sessions.get(userId);
  if (session) {
    // RC-3: Clear interval FIRST to prevent it firing during teardown
    if (session.dbPersistInterval) {
      clearInterval(session.dbPersistInterval);
      session.dbPersistInterval = null;
    }
    // Null out callbacks to prevent any in-flight persist from writing after disconnect
    session.dbPersistCallback = null;
    session.pelletPersistCallback = null;
    session.cookStatePersistCallback = null;
    // Now close the MQTT client
    if (session.client) {
      try { session.client.end(true); } catch { /* ignore */ }
      session.client = null;
    }
    // Finally remove from the map
    sessions.delete(userId);
  }
}

// ─── Telemetry Getters ──────────────────────────────────

export function getTelemetry(userId: string): (TraegerTelemetry & { lastUpdate: number; mqttConnected: boolean }) | null {
  const session = sessions.get(userId);
  if (!session) return null;
  return {
    ...session.telemetry,
    lastUpdate: session.lastUpdate,
    mqttConnected: session.client?.connected || false,
  };
}

export function getTelemetryHistory(userId: string, sinceMinutesAgo?: number): Array<TraegerTelemetry & { timestamp: number }> {
  const session = sessions.get(userId);
  if (!session) return [];
  if (!sinceMinutesAgo) return session.history;
  const cutoff = Date.now() - sinceMinutesAgo * 60 * 1000;
  return session.history.filter((h) => h.timestamp >= cutoff);
}

export function isMqttConnected(userId: string): boolean {
  const session = sessions.get(userId);
  return session?.client?.connected || false;
}

export function needsUrlRefresh(userId: string): boolean {
  const session = sessions.get(userId);
  if (!session) return false;
  return session.expiresAt < Date.now() + 300000;
}

export function refreshMqttUrl(userId: string, thingName: string, signedUrl: string, expiresAt: number): void {
  disconnectMqtt(userId);
  connectMqtt(userId, thingName, signedUrl, expiresAt);
}

export function getActiveSessionUserIds(): string[] {
  return Array.from(sessions.keys());
}

/**
 * Hydrate in-memory history from DB records.
 * Called after connectMqtt to restore history that was lost on restart.
 * Deduplicates against any points already in memory.
 */
export function hydrateHistory(
  userId: string,
  dbRecords: Array<{
    recordedAt: Date;
    grillTemp: number;
    probeTemp: number | null;
    ambientTemp: number | null;
    targetTemp: number | null;
    pelletLevel: number | null;
    systemStatus: number | null;
  }>
): number {
  const session = sessions.get(userId);
  if (!session) return 0;

  // Find the earliest timestamp already in memory
  const earliestInMemory = session.history.length > 0
    ? session.history[0].timestamp
    : Infinity;

  // Convert DB records to history format, only add those before our earliest in-memory point
  const dbPoints: Array<TraegerTelemetry & { timestamp: number }> = dbRecords
    .filter(r => r.recordedAt.getTime() < earliestInMemory)
    .map(r => ({
      ...DEFAULT_TELEMETRY,
      grill: r.grillTemp,
      probe: r.probeTemp ?? 0,
      ambient: r.ambientTemp ?? 0,
      set: r.targetTemp ?? 0,
      pelletLevel: r.pelletLevel ?? 0,
      systemStatus: r.systemStatus ?? 99,
      connected: true,
      timestamp: r.recordedAt.getTime(),
    }));

  // Prepend DB points before in-memory points
  session.history = [...dbPoints, ...session.history];

  // Trim to max 2000 points (allow more since we're hydrating)
  if (session.history.length > 2000) {
    session.history = session.history.slice(-2000);
  }

  return dbPoints.length;
}

// ─── Cook Session Lifecycle ─────────────────────────────

export function startCookSession(
  userId: string,
  cookSessionId: number,
  opts: {
    templateId?: string;
    meatProfileId?: string;
    alerts?: CookAlert[];
    stages?: Array<{ name: string; temp: number; duration?: number }>;
  }
): void {
  const session = sessions.get(userId);
  if (!session) return;

  session.activeCook = {
    cookSessionId,
    templateId: opts.templateId,
    meatProfileId: opts.meatProfileId,
    startedAt: Date.now(),
    alerts: opts.alerts || [],
    stages: opts.stages,
    currentStage: 0,
    peakGrillTemp: 0,
    peakProbeTemp: 0,
    stallDetected: false,
    lastProbeTemps: [],
    automationPhase: 0,
    autoCommandsSent: [],
  };
  session.firedAlerts = [];

  console.log(`[COOK] User ${userId}: Started cook session ${cookSessionId}`);
}

export function endCookSession(userId: string): ActiveCookSession | null {
  const session = sessions.get(userId);
  if (!session?.activeCook) return null;

  const ended = { ...session.activeCook };
  session.activeCook = null;
  session.firedAlerts = [];

  console.log(`[COOK] User ${userId}: Ended cook session ${ended.cookSessionId}`);
  return ended;
}

export function getActiveCook(userId: string): ActiveCookSession | null {
  const session = sessions.get(userId);
  return session?.activeCook || null;
}

// ─── Alert Management ───────────────────────────────────

export function dismissAlert(userId: string, alertId: string): boolean {
  const session = sessions.get(userId);
  if (!session?.activeCook) return false;

  const alert = session.activeCook.alerts.find((a) => a.id === alertId);
  if (alert && alert.status === "fired") {
    alert.status = "dismissed";
    return true;
  }
  return false;
}

export function getFiredAlerts(userId: string): CookAlert[] {
  const session = sessions.get(userId);
  if (!session) return [];

  const activeFired = session.activeCook?.alerts.filter((a) => a.status === "fired") || [];
  return activeFired;
}

export function getMissedAlerts(userId: string): CookAlert[] {
  const session = sessions.get(userId);
  if (!session) return [];
  return session.firedAlerts.filter((a) => a.status === "fired");
}

export function addAlert(userId: string, alert: CookAlert): boolean {
  const session = sessions.get(userId);
  if (!session?.activeCook) return false;
  session.activeCook.alerts.push(alert);
  return true;
}

export function removeAlert(userId: string, alertId: string): boolean {
  const session = sessions.get(userId);
  if (!session?.activeCook) return false;
  session.activeCook.alerts = session.activeCook.alerts.filter((a) => a.id !== alertId);
  return true;
}

// ─── Stall Info ─────────────────────────────────────────

export function getStallInfo(userId: string): { detected: boolean; startedAt?: number; startTemp?: number; duration?: number } | null {
  const session = sessions.get(userId);
  if (!session?.activeCook) return null;
  const cook = session.activeCook;
  return {
    detected: cook.stallDetected,
    startedAt: cook.stallStartedAt,
    startTemp: cook.stallStartTemp,
    duration: cook.stallStartedAt ? Date.now() - cook.stallStartedAt : undefined,
  };
}

// ─── DB Persistence Callback ────────────────────────────

export function setDbPersistCallback(
  userId: string,
  callback: (userId: string, telemetry: TraegerTelemetry, cookSessionId?: number) => Promise<void>
): void {
  const session = sessions.get(userId);
  if (session) {
    session.dbPersistCallback = callback;
  }
}

export function setPelletPersistCallback(
  userId: string,
  callback: (userId: string, pelletLevel: number, grillTemp: number, cookSessionId?: number) => Promise<void>
): void {
  const session = sessions.get(userId);
  if (session) {
    session.pelletPersistCallback = callback;
  }
}

export function setCookStatePersistCallback(
  userId: string,
  callback: (userId: string, cook: ActiveCookSession) => Promise<void>
): void {
  const session = sessions.get(userId);
  if (session) {
    session.cookStatePersistCallback = callback;
  }
}

/**
 * Hydrate active cook state from DB after server restart.
 * Restores the in-memory cook session so monitoring continues.
 */
export function hydrateCookState(
  userId: string,
  cookState: {
    cookSessionId: number;
    templateId?: string | null;
    meatProfileId?: string | null;
    startedAt: number;
    currentStage: number;
    peakGrillTemp: number;
    peakProbeTemp: number;
    alerts: CookAlert[];
    stagesJson?: string | null;
  }
): boolean {
  const session = sessions.get(userId);
  if (!session) return false;
  if (session.activeCook) return false; // already has an active cook

  let stages: Array<{ name: string; temp: number; duration?: number }> | undefined;
  if (cookState.stagesJson) {
    try {
      stages = JSON.parse(cookState.stagesJson);
    } catch { /* ignore */ }
  }

  session.activeCook = {
    cookSessionId: cookState.cookSessionId,
    templateId: cookState.templateId ?? undefined,
    meatProfileId: cookState.meatProfileId ?? undefined,
    startedAt: cookState.startedAt,
    alerts: cookState.alerts,
    stages,
    currentStage: cookState.currentStage,
    peakGrillTemp: cookState.peakGrillTemp,
    peakProbeTemp: cookState.peakProbeTemp,
    stallDetected: false,
    lastProbeTemps: [],
    automationPhase: cookState.currentStage,
    autoCommandsSent: [],
  };
  session.firedAlerts = cookState.alerts.filter(a => a.status === "fired");

  console.log(`[COOK] User ${userId}: Hydrated cook session ${cookState.cookSessionId} from DB`);
  return true;
}

// ─── Cook Stage Management ──────────────────────────────

export function advanceCookStage(userId: string): number {
  const session = sessions.get(userId);
  if (!session?.activeCook?.stages) return -1;
  if (session.activeCook.currentStage < session.activeCook.stages.length - 1) {
    session.activeCook.currentStage++;
  }
  return session.activeCook.currentStage;
}

// ─── Automation Program Management ─────────────────────

/**
 * Set the send-command callback so the automation engine can
 * dispatch grill commands (setTemp, superSmoke, etc.) without
 * importing the Traeger API directly.
 */
export function setSendCommandCallback(
  userId: string,
  callback: (userId: string, command: string) => Promise<void>
): void {
  const session = sessions.get(userId);
  if (session) {
    session.sendCommandCallback = callback;
  }
}

/**
 * Load an automation program into the active cook session.
 * Called when the user starts a cook with an automation program attached.
 * The program's stages are stored in the cook session's automationStages.
 */
export function loadAutomationProgram(
  userId: string,
  automationId: number,
  stages: AutomationStage[],
  variableValues?: Record<string, string | number>
): boolean {
  const session = sessions.get(userId);
  if (!session?.activeCook) return false;

  session.activeCook.automationId = automationId;
  session.activeCook.automationStages = stages;
  session.activeCook.automationPhase = 0;
  session.activeCook.phaseStartedAt = Date.now();
  session.activeCook.lastAlarmTemp = undefined;
  session.activeCook.phaseAcknowledged = undefined;
  session.activeCook.autoCommandsSent = [];

  // Execute entry actions for the first phase
  const firstStage = stages[0];
  if (firstStage) {
    // Auto-set grill temp for first phase
    if (firstStage.grillTemp && session.sendCommandCallback) {
      const commandKey = `phaseTemp-0`;
      session.activeCook.autoCommandsSent.push(commandKey);
      const tempCommand = JSON.stringify({ set: firstStage.grillTemp });
      session.sendCommandCallback(userId, tempCommand)
        .then(() => {
          console.log(`[AUTO] User ${userId}: Set grill to ${firstStage.grillTemp}°F for phase 0 (${firstStage.name})`);
          pushAutomationEvent(userId, {
            eventType: "phase_change",
            phase: 0,
            phaseName: firstStage.name,
            message: `Starting automation: ${firstStage.name} at ${firstStage.grillTemp}°F`,
            autoCommand: `setTemp:${firstStage.grillTemp}`,
          });
        })
        .catch((err: unknown) => {
          console.error(`[AUTO] User ${userId}: Failed to set initial phase temp:`, err);
        });
    }

    // Auto-toggle super smoke for first phase
    if (firstStage.autoSetSuperSmoke !== undefined && session.sendCommandCallback) {
      const smokeCommand = firstStage.autoSetSuperSmoke ? "20" : "21"; // SUPER_SMOKE_ON/OFF
      session.sendCommandCallback(userId, smokeCommand).catch(() => {});
    }
  }

  console.log(`[AUTO] User ${userId}: Loaded automation program ${automationId} with ${stages.length} phases`);
  return true;
}

/**
 * Acknowledge the current automation phase alarm.
 * This allows the automation to advance to the next phase
 * (if the current phase has requireAcknowledge=true).
 */
export function acknowledgeAutomationPhase(userId: string): boolean {
  const session = sessions.get(userId);
  if (!session?.activeCook?.automationStages) return false;

  const cook = session.activeCook;
  const stages = cook.automationStages!;
  const phase = cook.automationPhase;
  const stage = stages[phase];

  if (!stage) return false;

  cook.phaseAcknowledged = true;

  // If this phase was waiting for acknowledgment, advance now
  if (stage.requireAcknowledge) {
    advanceAutomationPhase(userId, session);
    console.log(`[AUTO] User ${userId}: Acknowledged phase ${phase} (${stage.name}), advancing`);
    return true;
  }

  return false;
}

/**
 * Manually advance the automation to the next phase (user override).
 */
export function skipAutomationPhase(userId: string): boolean {
  const session = sessions.get(userId);
  if (!session?.activeCook?.automationStages) return false;

  const cook = session.activeCook;
  const stages = cook.automationStages!;
  if (cook.automationPhase >= stages.length - 1) return false;

  console.log(`[AUTO] User ${userId}: Manual skip from phase ${cook.automationPhase}`);
  advanceAutomationPhase(userId, session);
  return true;
}

/**
 * Get the current automation state for a user (for API responses).
 */
export function getAutomationState(userId: string): {
  active: boolean;
  automationId?: number;
  phase: number;
  totalPhases: number;
  currentPhaseName?: string;
  phaseAcknowledged?: boolean;
  autoCommandsSent: string[];
} | null {
  const session = sessions.get(userId);
  if (!session?.activeCook?.automationStages) return null;

  const cook = session.activeCook;
  const stages = cook.automationStages!;
  const currentStage = stages[cook.automationPhase];

  return {
    active: true,
    automationId: cook.automationId,
    phase: cook.automationPhase,
    totalPhases: stages.length,
    currentPhaseName: currentStage?.name,
    phaseAcknowledged: cook.phaseAcknowledged,
    autoCommandsSent: cook.autoCommandsSent,
  };
}
