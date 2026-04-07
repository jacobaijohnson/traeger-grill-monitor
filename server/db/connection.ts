import { eq, and, desc, gte, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import { dbLog } from "../logger";

// ─── RC-1 Fix: Resilient DB Connection with Pool ───────────

let _pool: mysql.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;
let _connectionErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 3;

/**
 * Create a mysql2 connection pool with keepAlive and proper lifecycle management.
 * If the pool has accumulated too many consecutive errors, it's destroyed and recreated.
 */
function createPool(): mysql.Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("[Database] DATABASE_URL not set");
  }

  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 5,
    idleTimeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000,
    connectTimeout: 10000,
  });

  pool.on("connection", () => {
    _connectionErrors = 0;
  });

  return pool;
}

/**
 * Get a Drizzle DB instance backed by a resilient connection pool.
 * Automatically recreates the pool if too many consecutive errors occur.
 */
export async function getDb() {
  if (!process.env.DATABASE_URL) return null;

  if (_connectionErrors >= MAX_CONSECUTIVE_ERRORS && _pool) {
    dbLog.warn({ errorCount: _connectionErrors }, "Consecutive errors — recreating connection pool");
    try {
      await _pool.end();
    } catch { /* ignore cleanup errors */ }
    _pool = null;
    _db = null;
    _connectionErrors = 0;
  }

  if (!_db) {
    try {
      _pool = createPool();
      _db = drizzle(_pool);
    } catch (error) {
      dbLog.warn({ err: error }, "Failed to create connection pool");
      _pool = null;
      _db = null;
    }
  }
  return _db;
}

/**
 * RC-1: Query wrapper with automatic retry on connection errors.
 * Retries once after resetting the connection pool on transient errors.
 */
export async function withDbRetry<T>(
  operation: (db: NonNullable<Awaited<ReturnType<typeof getDb>>>) => Promise<T>,
  label = "query"
): Promise<T | null> {
  const MAX_RETRIES = 2;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const db = await getDb();
    if (!db) {
      dbLog.warn({ label }, "Database not available");
      return null;
    }

    try {
      const result = await operation(db);
      _connectionErrors = 0;
      return result;
    } catch (error: unknown) {
      const isTransient = isTransientError(error);
      _connectionErrors++;

      if (isTransient && attempt < MAX_RETRIES) {
        dbLog.warn({ label, attempt, maxRetries: MAX_RETRIES }, "Transient error, retrying");
        if (_pool) {
          try { await _pool.end(); } catch { /* ignore */ }
          _pool = null;
          _db = null;
        }
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        continue;
      }

      dbLog.error({ label, attempt, err: error }, "Query failed after retries");
      throw error;
    }
  }

  return null;
}

/**
 * Check if an error is a transient connection error that should trigger a retry.
 */
function isTransientError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const err = error as Record<string, unknown>;

  const code = err.code || (err.cause as Record<string, unknown>)?.code;
  const transientCodes = [
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "EPIPE",
    "PROTOCOL_CONNECTION_LOST",
    "ER_CON_COUNT_ERROR",
    "ENOTFOUND",
  ];
  if (typeof code === "string" && transientCodes.includes(code)) return true;

  const message = String(err.message || "");
  if (message.includes("ECONNRESET") || message.includes("Connection lost") || message.includes("ETIMEDOUT")) return true;

  if (err.cause && typeof err.cause === "object") {
    const causeMsg = String((err.cause as Record<string, unknown>).message || "");
    if (causeMsg.includes("ECONNRESET") || causeMsg.includes("ETIMEDOUT") || causeMsg.includes("EPIPE")) return true;
  }

  return false;
}

// Re-export drizzle-orm operators for use by domain modules
export { eq, and, desc, gte, lte, or, sql };
