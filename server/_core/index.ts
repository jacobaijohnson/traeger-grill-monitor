import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import helmet from "helmet";
import { authLimiter, apiLimiter, trpcLoginLimiter } from "../rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerSSERoutes } from "../sse";
import { seedAdmin } from "./seed-admin";
import { initVapidKeys } from "../web-push";
import { registerHealthRoutes } from "../health";
import { logger } from "../logger";
import {
  getActiveSessionUserIds,
  disconnectMqtt,
  getTelemetry,
} from "../mqtt-manager";
import { purgeStaleTelemetry } from "../db/telemetry";

const log = logger.child({ module: "server" });

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// ─── STB-2: Stale MQTT Session Reaper ─────────────────
const STALE_SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const STALE_SESSION_THRESHOLD = 30 * 60 * 1000; // 30 minutes no update

function startStaleSessionReaper(): ReturnType<typeof setInterval> {
  return setInterval(() => {
    const userIds = getActiveSessionUserIds();
    let reaped = 0;

    for (const userId of userIds) {
      const telemetry = getTelemetry(userId);
      if (!telemetry) {
        // Session exists but no telemetry — stale
        log.warn({ userId }, "Reaping stale MQTT session (no telemetry)");
        disconnectMqtt(userId);
        reaped++;
        continue;
      }

      const idleMs = Date.now() - telemetry.lastUpdate;
      if (idleMs > STALE_SESSION_THRESHOLD) {
        log.warn({ userId, idleMinutes: Math.round(idleMs / 60000) }, "Reaping stale MQTT session (idle too long)");
        disconnectMqtt(userId);
        reaped++;
      }
    }

    if (reaped > 0) {
      log.info({ reaped, remaining: userIds.length - reaped }, "Stale session reaper completed");
    }
  }, STALE_SESSION_CHECK_INTERVAL);
}

// ─── STB-4: Scheduled Telemetry Purge ─────────────────
const TELEMETRY_PURGE_INTERVAL = 24 * 60 * 60 * 1000; // Daily
const TELEMETRY_RETENTION_DAYS = 90;

function startTelemetryPurge(): ReturnType<typeof setInterval> {
  // Run first purge 1 minute after startup, then daily
  setTimeout(async () => {
    try {
      const deleted = await purgeStaleTelemetry(TELEMETRY_RETENTION_DAYS);
      if (deleted !== null && deleted > 0) {
        log.info({ deleted, retentionDays: TELEMETRY_RETENTION_DAYS }, "Telemetry purge completed");
      }
    } catch (err) {
      log.error({ err }, "Telemetry purge failed");
    }
  }, 60 * 1000);

  return setInterval(async () => {
    try {
      const deleted = await purgeStaleTelemetry(TELEMETRY_RETENTION_DAYS);
      if (deleted !== null && deleted > 0) {
        log.info({ deleted, retentionDays: TELEMETRY_RETENTION_DAYS }, "Telemetry purge completed");
      }
    } catch (err) {
      log.error({ err }, "Telemetry purge failed");
    }
  }, TELEMETRY_PURGE_INTERVAL);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Trust proxy (deployed behind reverse proxy)
  app.set('trust proxy', 1);

  // ─── Security Headers (SEC-2: Enable basic CSP) ────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "wss:", "https:"],
        workerSrc: ["'self'", "blob:"],
        frameSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow embedding for various auth flows
  }));

  // ─── Rate Limiting (SEC-4) ─────────────────────────
  // See server/rate-limit.ts for full strategy documentation

  // ─── SEC-5: Reduced JSON body limit (5MB default) ──
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ limit: "5mb", extended: true }));

  // ─── Health, Metrics, Version ──────────────────────
  registerHealthRoutes(app);

  // ─── Better Auth ───────────────────────────────────
  // Apply auth rate limit to Better Auth routes
  app.use("/api/auth", authLimiter);

  // Apply login-specific rate limit to tRPC (traeger.connect + admin.*)
  app.use("/api/trpc", trpcLoginLimiter);

  // Mount Better Auth handler for all /api/auth/* routes
  // Handles: sign-in, sign-up, sign-out, session, etc.
  app.all("/api/auth/*", toNodeHandler(auth));

  // SSE real-time telemetry push (no rate limit — long-lived connections)
  registerSSERoutes(app);

  // Apply general rate limit to tRPC API
  app.use("/api/trpc", apiLimiter);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    log.info({ preferredPort, actualPort: port }, "Preferred port busy, using alternative");
  }

  // Seed admin user from env vars on first boot
  await seedAdmin();

  // Initialize VAPID keys for Web Push notifications
  await initVapidKeys().catch(err => {
    log.warn({ err: err.message }, "VAPID init failed (push notifications unavailable)");
  });

  // ─── STB-2: Start stale session reaper ─────────────
  const reaperInterval = startStaleSessionReaper();

  // ─── STB-4: Start telemetry purge schedule ─────────
  const purgeInterval = startTelemetryPurge();

  server.listen(port, () => {
    log.info({ port, pid: process.pid, nodeVersion: process.version }, "Server running");
  });

  // ─── STB-1: Graceful Shutdown ──────────────────────
  let isShuttingDown = false;

  async function gracefulShutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    log.info({ signal }, "Graceful shutdown initiated");

    // 1. Stop accepting new connections
    server.close(() => {
      log.info("HTTP server closed");
    });

    // 2. Clear scheduled intervals
    clearInterval(reaperInterval);
    clearInterval(purgeInterval);

    // 3. Disconnect all MQTT sessions
    const activeUsers = getActiveSessionUserIds();
    log.info({ count: activeUsers.length }, "Disconnecting MQTT sessions");
    for (const userId of activeUsers) {
      try {
        disconnectMqtt(userId);
      } catch (err) {
        log.warn({ userId, err }, "Error disconnecting MQTT session during shutdown");
      }
    }

    // 4. Allow in-flight requests to complete (max 10s)
    await new Promise(resolve => setTimeout(resolve, 2000));

    log.info("Shutdown complete");
    process.exit(0);
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

startServer().catch(err => {
  log.fatal({ err }, "Server startup failed");
  process.exit(1);
});
