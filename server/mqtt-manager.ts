import mqtt from "mqtt";
import type { TraegerTelemetry } from "@shared/traeger-types";

interface MqttSession {
  client: mqtt.MqttClient | null;
  thingName: string;
  signedUrl: string;
  expiresAt: number;
  telemetry: TraegerTelemetry;
  lastUpdate: number;
  reconnecting: boolean;
  history: Array<TraegerTelemetry & { timestamp: number }>;
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

/**
 * Parse the MQTT message payload into our telemetry format.
 * The Traeger MQTT payload uses snake_case keys nested under "status".
 */
function parseTelemetry(payload: Record<string, unknown>): Partial<TraegerTelemetry> {
  // The payload can be the full message or just the status object
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

/**
 * Connect to the Traeger MQTT broker for a specific user/grill.
 * Uses the signed WebSocket URL from the Traeger API.
 */
export function connectMqtt(
  userId: number,
  thingName: string,
  signedUrl: string,
  expiresAt: number
): void {
  // If already connected to the same grill, check if URL needs refresh
  const existing = sessions.get(userId);
  if (existing && existing.thingName === thingName && existing.client?.connected) {
    // If the URL hasn't expired, keep the existing connection
    if (existing.expiresAt > Date.now() + 60000) {
      console.log(`[MQTT] User ${userId}: Already connected to ${thingName}`);
      return;
    }
    // URL expiring soon, disconnect and reconnect
    console.log(`[MQTT] User ${userId}: URL expiring, reconnecting...`);
    disconnectMqtt(userId);
  }

  // If connected to a different grill, disconnect first
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
  };

  sessions.set(userId, session);

  try {
    console.log(`[MQTT] User ${userId}: Connecting to ${thingName}...`);

    // Parse the signed URL to extract the WebSocket path
    const url = new URL(signedUrl);
    const wsUrl = `wss://${url.host}${url.pathname}${url.search}`;

    const client = mqtt.connect(wsUrl, {
      protocolVersion: 4,
      keepalive: 300,
      reconnectPeriod: 5000,
      connectTimeout: 15000,
      rejectUnauthorized: false,
      // MQTT over WebSocket settings
      wsOptions: {
        headers: {
          Host: url.host,
        },
      },
    });

    session.client = client;

    client.on("connect", () => {
      console.log(`[MQTT] User ${userId}: Connected to broker`);
      session.reconnecting = false;

      // Subscribe to the grill's update topic
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

        // Merge with existing telemetry
        session.telemetry = {
          ...session.telemetry,
          ...telemetryUpdate,
          connected: true,
        };
        session.lastUpdate = Date.now();

        // Add to history (keep last 2 hours at ~30s intervals = ~240 points)
        session.history.push({
          ...session.telemetry,
          timestamp: Date.now(),
        });
        if (session.history.length > 300) {
          session.history = session.history.slice(-300);
        }

        console.log(
          `[MQTT] User ${userId}: Telemetry update - grill=${session.telemetry.grill}°F, ` +
          `probe=${session.telemetry.probe}°F, status=${session.telemetry.systemStatus}, ` +
          `pellets=${session.telemetry.pelletLevel}%`
        );
      } catch (err) {
        console.error(`[MQTT] User ${userId}: Parse error:`, err);
      }
    });

    client.on("error", (err) => {
      console.error(`[MQTT] User ${userId}: Error:`, err.message);
    });

    client.on("close", () => {
      console.log(`[MQTT] User ${userId}: Connection closed`);
      if (session.telemetry.connected) {
        session.telemetry = { ...session.telemetry, connected: false };
      }
    });

    client.on("reconnect", () => {
      console.log(`[MQTT] User ${userId}: Reconnecting...`);
      session.reconnecting = true;
    });

    client.on("offline", () => {
      console.log(`[MQTT] User ${userId}: Client offline`);
    });
  } catch (err) {
    console.error(`[MQTT] User ${userId}: Connection failed:`, err);
  }
}

/**
 * Disconnect MQTT for a user.
 */
export function disconnectMqtt(userId: number): void {
  const session = sessions.get(userId);
  if (session?.client) {
    try {
      session.client.end(true);
    } catch {
      // Ignore close errors
    }
    session.client = null;
  }
  sessions.delete(userId);
  console.log(`[MQTT] User ${userId}: Disconnected`);
}

/**
 * Get the latest telemetry for a user.
 * Returns null if no MQTT session exists.
 */
export function getTelemetry(userId: number): (TraegerTelemetry & { lastUpdate: number; mqttConnected: boolean }) | null {
  const session = sessions.get(userId);
  if (!session) return null;

  return {
    ...session.telemetry,
    lastUpdate: session.lastUpdate,
    mqttConnected: session.client?.connected || false,
  };
}

/**
 * Get telemetry history for graphing.
 */
export function getTelemetryHistory(userId: number): Array<TraegerTelemetry & { timestamp: number }> {
  const session = sessions.get(userId);
  if (!session) return [];
  return session.history;
}

/**
 * Check if MQTT is connected for a user.
 */
export function isMqttConnected(userId: number): boolean {
  const session = sessions.get(userId);
  return session?.client?.connected || false;
}

/**
 * Check if the MQTT URL needs refresh (within 5 min of expiry).
 */
export function needsUrlRefresh(userId: number): boolean {
  const session = sessions.get(userId);
  if (!session) return false;
  return session.expiresAt < Date.now() + 300000;
}

/**
 * Update the MQTT connection with a new signed URL.
 */
export function refreshMqttUrl(
  userId: number,
  thingName: string,
  signedUrl: string,
  expiresAt: number
): void {
  disconnectMqtt(userId);
  connectMqtt(userId, thingName, signedUrl, expiresAt);
}

/**
 * Get all active session user IDs (for cleanup).
 */
export function getActiveSessionUserIds(): number[] {
  return Array.from(sessions.keys());
}
