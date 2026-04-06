import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerSSERoutes } from "../sse";
import { seedAdmin } from "./seed-admin";

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

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Trust proxy (deployed behind reverse proxy)
  app.set('trust proxy', 1);

  // ─── Security Headers ──────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: false, // CSP managed by Vite in dev, static in prod
    crossOriginEmbedderPolicy: false, // Allow embedding for various auth flows
  }));

  // ─── Rate Limiting ─────────────────────────────────
  // General API rate limit: 200 requests per minute per IP
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  });

  // Stricter limit for auth endpoints: 20 per minute
  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many authentication attempts, please try again later." },
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ─── Better Auth ───────────────────────────────────
  // Apply auth rate limit to Better Auth routes
  app.use("/api/auth", authLimiter);

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
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Seed admin user from env vars on first boot
  await seedAdmin();

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
