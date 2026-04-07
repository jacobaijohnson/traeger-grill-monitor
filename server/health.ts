/**
 * Health & Metrics Endpoints — OBS-2, OBS-3, DPL-1, DPL-2
 *
 * GET /api/health          — Returns 200 if app is ready, 503 if degraded
 * GET /api/health/services — Detailed breakdown of all container services
 * GET /api/metrics         — Returns runtime metrics (session count, memory, uptime)
 * GET /api/version         — Returns build metadata
 */

import type { Express, Request, Response } from "express";
import { getDb } from "./db/connection";
import { isVapidReady } from "./web-push";
import { getActiveSessionUserIds } from "./mqtt-manager";
import { getActiveAlarmCount } from "./alarm-escalation";
import { getSSEClientCount } from "./sse";
import { logger } from "./logger";
import { execSync } from "child_process";
import http from "http";

const log = logger.child({ module: "health" });

// Build metadata — set at startup, immutable
const BUILD_META = {
  version: process.env.npm_package_version || "0.1.0",
  node: process.version,
  startedAt: new Date().toISOString(),
  pid: process.pid,
};

// ─── Tunnel Health Check ─────────────────────────────────

interface TunnelHealth {
  configured: boolean;
  status: "connected" | "not_configured" | "process_running" | "process_not_found" | "error";
  metricsEndpoint?: string;
  metricsReachable?: boolean;
}

async function checkTunnelHealth(): Promise<TunnelHealth> {
  const tunnelToken = process.env.TUNNEL_TOKEN || "";
  const tunnelMetrics = process.env.TUNNEL_METRICS || "";

  // Check if tunnel token is set (via env or Docker secret)
  const hasToken = tunnelToken.length > 0;

  if (!hasToken) {
    // Also check if the Docker secret file exists (container runtime only)
    try {
      const { readFileSync } = await import("fs");
      readFileSync("/run/secrets/tunnel_token", "utf-8");
      // If we get here, the secret file exists
    } catch {
      return { configured: false, status: "not_configured" };
    }
  }

  // Token is configured — check if cloudflared process is running
  let processRunning = false;
  try {
    execSync("pgrep -x cloudflared", { timeout: 3000, stdio: "pipe" });
    processRunning = true;
  } catch {
    // pgrep returns non-zero if no process found
    processRunning = false;
  }

  if (!processRunning) {
    return { configured: true, status: "process_not_found" };
  }

  // Process is running — check metrics endpoint if configured
  if (tunnelMetrics) {
    const metricsReachable = await probeTunnelMetrics(tunnelMetrics);
    return {
      configured: true,
      status: metricsReachable ? "connected" : "process_running",
      metricsEndpoint: `http://${tunnelMetrics}/metrics`,
      metricsReachable,
    };
  }

  return { configured: true, status: "process_running" };
}

/**
 * Probe the cloudflared metrics endpoint to verify tunnel connectivity.
 * The /ready endpoint returns 200 when the tunnel has active connections.
 */
function probeTunnelMetrics(hostPort: string): Promise<boolean> {
  return new Promise((resolve) => {
    const [host, portStr] = hostPort.split(":");
    const port = parseInt(portStr || "2000", 10);

    const req = http.get(
      { hostname: host || "127.0.0.1", port, path: "/ready", timeout: 2000 },
      (res) => {
        resolve(res.statusCode === 200);
        res.resume(); // drain response
      }
    );

    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

// ─── S6 Service Health Check ─────────────────────────────

interface ServiceStatus {
  name: string;
  status: "running" | "stopped" | "not_found" | "unknown";
  pid?: number;
  uptime?: number; // seconds
}

function checkS6Services(): ServiceStatus[] {
  const services = ["svc-traeger", "svc-cloudflared"];
  const results: ServiceStatus[] = [];

  for (const svc of services) {
    try {
      // s6-svstat returns service status in a parseable format
      const output = execSync(`s6-svstat /run/service/${svc} 2>/dev/null`, {
        timeout: 3000,
        encoding: "utf-8",
      }).trim();

      // Parse s6-svstat output: "up (pid 123) 456 seconds"
      const upMatch = output.match(/up \(pid (\d+)\) (\d+) seconds/);
      if (upMatch) {
        results.push({
          name: svc,
          status: "running",
          pid: parseInt(upMatch[1], 10),
          uptime: parseInt(upMatch[2], 10),
        });
        continue;
      }

      const downMatch = output.match(/down/);
      if (downMatch) {
        results.push({ name: svc, status: "stopped" });
        continue;
      }

      results.push({ name: svc, status: "unknown" });
    } catch {
      // s6-svstat not available (dev environment) or service doesn't exist
      results.push({ name: svc, status: "not_found" });
    }
  }

  return results;
}

// ─── Main Health Check ───────────────────────────────────

interface HealthCheck {
  status: "ok" | "degraded" | "down";
  database: "connected" | "disconnected" | "error";
  vapid: "ready" | "not_initialized";
  tunnel: TunnelHealth;
  uptime: number;
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
    externalMB: number;
  };
}

async function checkHealth(): Promise<HealthCheck> {
  const mem = process.memoryUsage();

  let dbStatus: "connected" | "disconnected" | "error" = "disconnected";
  try {
    const db = await getDb();
    if (db) {
      // Lightweight ping — SELECT 1
      const { sql } = await import("drizzle-orm");
      await db.execute(sql`SELECT 1`);
      dbStatus = "connected";
    }
  } catch (err) {
    dbStatus = "error";
    log.warn({ err }, "Health check DB ping failed");
  }

  const vapidStatus = isVapidReady() ? "ready" : "not_initialized";
  const tunnelHealth = await checkTunnelHealth();

  // Determine overall status
  let overallStatus: "ok" | "degraded" | "down" = "ok";
  if (dbStatus !== "connected") {
    overallStatus = "degraded";
  }
  if (tunnelHealth.configured && tunnelHealth.status === "process_not_found") {
    overallStatus = "degraded";
  }

  return {
    status: overallStatus,
    database: dbStatus,
    vapid: vapidStatus,
    tunnel: tunnelHealth,
    uptime: process.uptime(),
    memory: {
      heapUsedMB: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMB: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
      rssMB: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      externalMB: Math.round((mem.external / 1024 / 1024) * 100) / 100,
    },
  };
}

// ─── Route Registration ──────────────────────────────────

export function registerHealthRoutes(app: Express): void {
  // ─── Health Check ──────────────────────────────────
  app.get("/api/health", async (_req: Request, res: Response) => {
    try {
      const health = await checkHealth();
      const statusCode = health.status === "ok" ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (err) {
      log.error({ err }, "Health check failed");
      res.status(503).json({ status: "down", error: "Health check failed" });
    }
  });

  // ─── Detailed Service Health ───────────────────────
  app.get("/api/health/services", async (_req: Request, res: Response) => {
    try {
      const health = await checkHealth();
      const s6Services = checkS6Services();

      res.json({
        overall: health.status,
        app: {
          status: "running",
          pid: process.pid,
          uptime: process.uptime(),
          node: process.version,
          version: BUILD_META.version,
        },
        database: {
          status: health.database,
          url: process.env.DATABASE_URL ? "configured" : "not_configured",
        },
        tunnel: health.tunnel,
        pushNotifications: {
          vapid: health.vapid,
        },
        s6Services,
        memory: health.memory,
      });
    } catch (err) {
      log.error({ err }, "Service health check failed");
      res.status(500).json({ error: "Service health check unavailable" });
    }
  });

  // ─── Runtime Metrics ───────────────────────────────
  app.get("/api/metrics", async (_req: Request, res: Response) => {
    try {
      const mem = process.memoryUsage();
      const activeSessions = getActiveSessionUserIds();
      const sseClients = getSSEClientCount();
      const activeAlarms = getActiveAlarmCount();

      res.json({
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        mqttSessions: activeSessions.length,
        sseClients,
        activeAlarms,
        memory: {
          heapUsedMB: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
          heapTotalMB: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
          rssMB: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
        },
        process: {
          pid: process.pid,
          nodeVersion: process.version,
        },
      });
    } catch (err) {
      log.error({ err }, "Metrics endpoint failed");
      res.status(500).json({ error: "Metrics unavailable" });
    }
  });

  // ─── Version / Build Info ──────────────────────────
  app.get("/api/version", (_req: Request, res: Response) => {
    res.json(BUILD_META);
  });

  log.info(
    "Health, metrics, version, and service health endpoints registered"
  );
}
