import mqtt from "mqtt";
import type { TraegerTelemetry } from "@shared/traeger-types";
import type { TempMarker } from "@shared/meat-science";
import { pushTelemetryUpdate, pushAlertEvent, pushDisconnectEvent } from "./sse";

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
  dbPersistCallback: ((userId: number, telemetry: TraegerTelemetry, cookSessionId?: number) => Promise<void>) | null;
  cookStatePersistCallback: ((userId: number, cook: ActiveCookSession) => Promise<void>) | null;
  // RC-4: Backpressure flag — skip persist if previous one is still in flight
  persistInFlight: boolean;
  cookStatePersistInFlight: boolean;
}

// In-memory store of active MQTT sessions keyed by userId
const sessions = new Map<number, MqttSession>();

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

// ─── MQTT Connection ────────────────────────────────────

export function connectMqtt(
  userId: number,
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
    cookStatePersistCallback: existing?.cookStatePersistCallback || null,
    persistInFlight: false,
    cookStatePersistInFlight: false,
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
    }, 30000);

  } catch (err) {
    console.error(`[MQTT] User ${userId}: Connection failed:`, err);
  }
}

// ─── Disconnect ─────────────────────────────────────────

export function disconnectMqtt(userId: number): void {
  const session = sessions.get(userId);
  if (session) {
    // RC-3: Clear interval FIRST to prevent it firing during teardown
    if (session.dbPersistInterval) {
      clearInterval(session.dbPersistInterval);
      session.dbPersistInterval = null;
    }
    // Null out callbacks to prevent any in-flight persist from writing after disconnect
    session.dbPersistCallback = null;
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

export function getTelemetry(userId: number): (TraegerTelemetry & { lastUpdate: number; mqttConnected: boolean }) | null {
  const session = sessions.get(userId);
  if (!session) return null;
  return {
    ...session.telemetry,
    lastUpdate: session.lastUpdate,
    mqttConnected: session.client?.connected || false,
  };
}

export function getTelemetryHistory(userId: number, sinceMinutesAgo?: number): Array<TraegerTelemetry & { timestamp: number }> {
  const session = sessions.get(userId);
  if (!session) return [];
  if (!sinceMinutesAgo) return session.history;
  const cutoff = Date.now() - sinceMinutesAgo * 60 * 1000;
  return session.history.filter((h) => h.timestamp >= cutoff);
}

export function isMqttConnected(userId: number): boolean {
  const session = sessions.get(userId);
  return session?.client?.connected || false;
}

export function needsUrlRefresh(userId: number): boolean {
  const session = sessions.get(userId);
  if (!session) return false;
  return session.expiresAt < Date.now() + 300000;
}

export function refreshMqttUrl(userId: number, thingName: string, signedUrl: string, expiresAt: number): void {
  disconnectMqtt(userId);
  connectMqtt(userId, thingName, signedUrl, expiresAt);
}

export function getActiveSessionUserIds(): number[] {
  return Array.from(sessions.keys());
}

/**
 * Hydrate in-memory history from DB records.
 * Called after connectMqtt to restore history that was lost on restart.
 * Deduplicates against any points already in memory.
 */
export function hydrateHistory(
  userId: number,
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
  userId: number,
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
  };
  session.firedAlerts = [];

  console.log(`[COOK] User ${userId}: Started cook session ${cookSessionId}`);
}

export function endCookSession(userId: number): ActiveCookSession | null {
  const session = sessions.get(userId);
  if (!session?.activeCook) return null;

  const ended = { ...session.activeCook };
  session.activeCook = null;
  session.firedAlerts = [];

  console.log(`[COOK] User ${userId}: Ended cook session ${ended.cookSessionId}`);
  return ended;
}

export function getActiveCook(userId: number): ActiveCookSession | null {
  const session = sessions.get(userId);
  return session?.activeCook || null;
}

// ─── Alert Management ───────────────────────────────────

export function dismissAlert(userId: number, alertId: string): boolean {
  const session = sessions.get(userId);
  if (!session?.activeCook) return false;

  const alert = session.activeCook.alerts.find((a) => a.id === alertId);
  if (alert && alert.status === "fired") {
    alert.status = "dismissed";
    return true;
  }
  return false;
}

export function getFiredAlerts(userId: number): CookAlert[] {
  const session = sessions.get(userId);
  if (!session) return [];

  const activeFired = session.activeCook?.alerts.filter((a) => a.status === "fired") || [];
  return activeFired;
}

export function getMissedAlerts(userId: number): CookAlert[] {
  const session = sessions.get(userId);
  if (!session) return [];
  return session.firedAlerts.filter((a) => a.status === "fired");
}

export function addAlert(userId: number, alert: CookAlert): boolean {
  const session = sessions.get(userId);
  if (!session?.activeCook) return false;
  session.activeCook.alerts.push(alert);
  return true;
}

export function removeAlert(userId: number, alertId: string): boolean {
  const session = sessions.get(userId);
  if (!session?.activeCook) return false;
  session.activeCook.alerts = session.activeCook.alerts.filter((a) => a.id !== alertId);
  return true;
}

// ─── Stall Info ─────────────────────────────────────────

export function getStallInfo(userId: number): { detected: boolean; startedAt?: number; startTemp?: number; duration?: number } | null {
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
  userId: number,
  callback: (userId: number, telemetry: TraegerTelemetry, cookSessionId?: number) => Promise<void>
): void {
  const session = sessions.get(userId);
  if (session) {
    session.dbPersistCallback = callback;
  }
}

export function setCookStatePersistCallback(
  userId: number,
  callback: (userId: number, cook: ActiveCookSession) => Promise<void>
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
  userId: number,
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
  };
  session.firedAlerts = cookState.alerts.filter(a => a.status === "fired");

  console.log(`[COOK] User ${userId}: Hydrated cook session ${cookState.cookSessionId} from DB`);
  return true;
}

// ─── Cook Stage Management ──────────────────────────────

export function advanceCookStage(userId: number): number {
  const session = sessions.get(userId);
  if (!session?.activeCook?.stages) return -1;
  if (session.activeCook.currentStage < session.activeCook.stages.length - 1) {
    session.activeCook.currentStage++;
  }
  return session.activeCook.currentStage;
}
