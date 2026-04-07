/**
 * P3: Server-Sent Events (SSE) endpoint for real-time telemetry push.
 *
 * Replaces the 15-second polling loop with instant push updates.
 * The client opens a persistent connection to /api/sse/telemetry
 * and receives telemetry updates as they arrive from MQTT.
 *
 * Benefits:
 * - Instant updates (no 15s delay)
 * - Lower server load (no repeated tRPC queries)
 * - Automatic reconnection via EventSource API
 */
import type { Express, Request, Response } from "express";
import { getTelemetry, getActiveCook, getFiredAlerts, getMissedAlerts, getStallInfo } from "./mqtt-manager";
import { auth } from "./_core/auth";
import { fromNodeHeaders } from "better-auth/node";

// Track active SSE connections per user
const sseClients = new Map<string, Set<Response>>();


/**
 * Register a new SSE client for a user.
 */
function addClient(userId: string, res: Response) {
  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId)!.add(res);
}

/**
 * Remove an SSE client when the connection closes.
 */
function removeClient(userId: string, res: Response) {
  const clients = sseClients.get(userId);
  if (clients) {
    clients.delete(res);
    if (clients.size === 0) {
      sseClients.delete(userId);
    }
  }
}

/**
 * Push a telemetry update to all connected SSE clients for a user.
 * Called from mqtt-manager when new telemetry arrives.
 */
export function pushTelemetryUpdate(userId: string) {
  const clients = sseClients.get(userId);
  if (!clients || clients.size === 0) return;

  const telemetry = getTelemetry(userId);
  if (!telemetry) return;

  const activeCook = getActiveCook(userId);
  const firedAlerts = getFiredAlerts(userId);
  const missedAlerts = getMissedAlerts(userId);
  const stallInfo = getStallInfo(userId);

  const payload = JSON.stringify({
    type: "telemetry",
    data: {
      telemetry,
      activeCook: activeCook ? {
        startedAt: activeCook.startedAt,
        currentStage: activeCook.currentStage,
        peakGrillTemp: activeCook.peakGrillTemp,
        peakProbeTemp: activeCook.peakProbeTemp,
        alertCount: activeCook.alerts.length,
        // Automation state
        automationId: activeCook.automationId,
        automationPhase: activeCook.automationPhase,
        automationStages: activeCook.automationStages?.map(s => ({
          name: s.name,
          grillTemp: s.grillTemp,
          triggerType: s.triggerType,
          triggerValue: s.triggerValue,
          alertType: s.alertType,
        })),
        phaseAcknowledged: activeCook.phaseAcknowledged,
        lastAlarmTemp: activeCook.lastAlarmTemp,
        autoCommandsSent: activeCook.autoCommandsSent,
      } : null,
      firedAlerts,
      missedAlerts,
      stallInfo,
      viewers: clients.size,
    },
    timestamp: Date.now(),
  });

  const clientArray = Array.from(clients);
  for (const client of clientArray) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      removeClient(userId, client);
    }
  }
}

/**
 * Push an alert event to all connected SSE clients for a user.
 */
export function pushAlertEvent(userId: string, alert: { id: string; label: string; message: string; alertType: string }) {
  const clients = sseClients.get(userId);
  if (!clients || clients.size === 0) return;

  const payload = JSON.stringify({
    type: "alert",
    data: alert,
    timestamp: Date.now(),
  });

  const clientArray = Array.from(clients);
  for (const client of clientArray) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      removeClient(userId, client);
    }
  }
}

/**
 * Push an automation event (phase change, auto-command, escalating alarm) to SSE clients.
 */
export function pushAutomationEvent(
  userId: string,
  event: {
    eventType: "phase_change" | "auto_command" | "escalating_alarm" | "phase_complete";
    phase?: number;
    phaseName?: string;
    phaseIndex?: number;
    totalPhases?: number;
    command?: string;
    commandValue?: number;
    alarmTemp?: number;
    targetTemp?: number;
    probeTemp?: number;
    grillTemp?: number;
    autoCommand?: string;
    message?: string;
  }
) {
  const clients = sseClients.get(userId);
  if (!clients || clients.size === 0) return;

  const payload = JSON.stringify({
    type: "automation",
    data: event,
    timestamp: Date.now(),
  });

  const clientArray = Array.from(clients);
  for (const client of clientArray) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      removeClient(userId, client);
    }
  }
}

/**
 * Push a disconnect notification to all connected SSE clients for a user.
 */
export function pushDisconnectEvent(userId: string, reason: string) {
  const clients = sseClients.get(userId);
  if (!clients || clients.size === 0) return;

  const payload = JSON.stringify({
    type: "disconnect",
    data: { reason },
    timestamp: Date.now(),
  });

  const clientArray = Array.from(clients);
  for (const client of clientArray) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      removeClient(userId, client);
    }
  }
}

/**
 * Register SSE routes on the Express app.
 * Uses Better Auth session validation for authentication.
 */
export function registerSSERoutes(app: Express) {
  app.get("/api/sse/telemetry", async (req: Request, res: Response) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (!session?.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      setupSSEConnection(session.user.id, req, res);
    } catch {
      res.status(401).json({ error: "Unauthorized" });
    }
  });
}

function setupSSEConnection(userId: string, req: Request, res: Response) {
  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // Disable nginx buffering
  });

  // Send initial data immediately
  const telemetry = getTelemetry(userId);
  if (telemetry) {
    const initial = JSON.stringify({
      type: "telemetry",
      data: { telemetry },
      timestamp: Date.now(),
    });
    res.write(`data: ${initial}\n\n`);
  }

  // Send keepalive comment every 30 seconds to prevent timeout
  const keepalive = setInterval(() => {
    try {
      res.write(": keepalive\n\n");
    } catch {
      clearInterval(keepalive);
    }
  }, 30000);

  // Register client
  addClient(userId, res);

  // Clean up on disconnect
  req.on("close", () => {
    clearInterval(keepalive);
    removeClient(userId, res);
  });
}

/**
 * Get the total number of active SSE connections across all users.
 */
export function getSSEClientCount(): number {
  let count = 0;
  const entries = Array.from(sseClients.values());
  for (const clients of entries) {
    count += clients.size;
  }
  return count;
}
