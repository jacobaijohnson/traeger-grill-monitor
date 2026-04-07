/**
 * Structured Logger — OBS-1
 *
 * Replaces all console.log/warn/error with pino structured JSON logging.
 * - Production: JSON lines (machine-parseable for Loki/ELK/Datadog)
 * - Development: Pretty-printed with colors
 *
 * Usage:
 *   import { logger } from "./logger";
 *   logger.info({ userId, grillId }, "MQTT connected");
 *   logger.warn({ attempt, label }, "Transient DB error, retrying");
 *   logger.error({ err }, "Fatal startup failure");
 *
 * Child loggers for subsystems:
 *   const log = logger.child({ module: "mqtt" });
 *   log.info("Connected");  // → { module: "mqtt", msg: "Connected", ... }
 */

import pino from "pino";

const isDev = process.env.NODE_ENV === "development";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      }
    : undefined, // JSON lines in production (default pino behavior)
  // Redact sensitive fields from logs
  redact: {
    paths: [
      "password",
      "token",
      "accessToken",
      "refreshToken",
      "p256dh",
      "auth",
      "keys.auth",
      "keys.p256dh",
      "encryptedAccessToken",
      "encryptedRefreshToken",
    ],
    censor: "[REDACTED]",
  },
  // Serializers for common objects
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
});

// Pre-built child loggers for major subsystems
export const mqttLog = logger.child({ module: "mqtt" });
export const dbLog = logger.child({ module: "db" });
export const authLog = logger.child({ module: "auth" });
export const pushLog = logger.child({ module: "push" });
export const sseLog = logger.child({ module: "sse" });
export const cookLog = logger.child({ module: "cook" });
export const autoLog = logger.child({ module: "automation" });
export const alarmLog = logger.child({ module: "alarm" });
export const apiLog = logger.child({ module: "api" });
