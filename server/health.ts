/**
 * Health & Metrics Endpoints — OBS-2, OBS-3, DPL-1, DPL-2
 *
 * GET /api/health  — Returns 200 if app is ready, 503 if degraded
 * GET /api/metrics — Returns runtime metrics (session count, memory, uptime)
 * GET /api/version — Returns build metadata
 */

import type { Express, Request, Response } from "express";
import { getDb } from "./db/connection";
import { isVapidReady } from "./web-push";
import { getActiveSessionUserIds } from "./mqtt-manager";
import { getActiveAlarmCount } from "./alarm-escalation";
import { getSSEClientCount } from "./sse";
import { logger } from "./logger";

const log = logger.child({ module: "health" });

// Build metadata — set at startup, immutable
const BUILD_META = {
  version: process.env.npm_package_version || "0.1.0",
  node: process.version,
  startedAt: new Date().toISOString(),
  pid: process.pid,
};

interface HealthCheck {
  status: "ok" | "degraded" | "down";
  database: "connected" | "disconnected" | "error";
  vapid: "ready" | "not_initialized";
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

  const overallStatus =
    dbStatus === "connected" ? "ok" : dbStatus === "error" ? "degraded" : "degraded";

  return {
    status: overallStatus,
    database: dbStatus,
    vapid: vapidStatus,
    uptime: process.uptime(),
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
      rssMB: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
      externalMB: Math.round(mem.external / 1024 / 1024 * 100) / 100,
    },
  };
}

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
          heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
          heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
          rssMB: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
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

  log.info("Health, metrics, and version endpoints registered");
}
