/**
 * Rate Limiting — SEC-4
 *
 * Layered rate limiting strategy:
 *
 * 1. Auth endpoints (/api/auth/*): 20 req/min per IP
 *    - Better Auth sign-in, sign-up, sign-out, session
 *    - Prevents brute-force credential stuffing
 *
 * 2. Login-specific (/api/trpc/traeger.connect): 5 req/min per IP
 *    - Traeger credential exchange (most sensitive endpoint)
 *    - Very strict because this hits an external API with real credentials
 *
 * 3. General API (/api/trpc): 200 req/min per IP
 *    - All other tRPC procedures
 *    - Generous for normal usage, prevents abuse
 *
 * 4. Admin endpoints (/api/trpc/admin.*): 30 req/min per IP
 *    - Admin operations (user management, settings)
 *    - Moderate limit to prevent automated abuse
 *
 * All limiters use standard RateLimit-* headers (RFC draft-ietf-httpapi-ratelimit-headers)
 * and return 429 Too Many Requests with a JSON error body.
 *
 * For self-hosted deployments behind a reverse proxy, ensure:
 *   - app.set('trust proxy', 1) is configured (already done in index.ts)
 *   - The proxy sets X-Forwarded-For header
 */

import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

const log = logger.child({ module: "rate-limit" });

// ─── Auth Endpoints: 20 req/min ─────────────────────────
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts, please try again later." },
  handler: (req: Request, res: Response) => {
    log.warn({ ip: req.ip, path: req.path }, "Auth rate limit exceeded");
    res.status(429).json({ error: "Too many authentication attempts, please try again later." });
  },
});

// ─── Traeger Login: 5 req/min (strictest) ───────────────
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please wait before trying again." },
  handler: (req: Request, res: Response) => {
    log.warn({ ip: req.ip }, "Traeger login rate limit exceeded");
    res.status(429).json({ error: "Too many login attempts, please wait before trying again." });
  },
  // Separate store from general auth limiter
  skipFailedRequests: false,
});

// ─── General API: 200 req/min ───────────────────────────
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// ─── Admin Endpoints: 30 req/min ────────────────────────
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many admin requests, please try again later." },
  handler: (req: Request, res: Response) => {
    log.warn({ ip: req.ip, path: req.path }, "Admin rate limit exceeded");
    res.status(429).json({ error: "Too many admin requests, please try again later." });
  },
});

// ─── tRPC Path-based Middleware ──────────────────────────
// Applies the login limiter specifically to traeger.connect mutations
// while letting other tRPC calls through to the general limiter
export function trpcLoginLimiter(req: Request, res: Response, next: NextFunction) {
  // tRPC batch calls encode procedure names in the URL path
  // e.g., /api/trpc/traeger.connect or /api/trpc/traeger.connect,auth.me
  const path = req.path || "";
  if (path.includes("traeger.connect")) {
    return loginLimiter(req, res, next);
  }
  if (path.includes("admin.")) {
    return adminLimiter(req, res, next);
  }
  next();
}
