import { eq, and, desc, gte, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import {
  InsertUser,
  users,
} from "../../drizzle/schema";
import { ENV } from "../_core/env";

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
    idleTimeout: 60000,       // Close idle connections after 60s
    enableKeepAlive: true,     // TCP keepalive to detect dead connections
    keepAliveInitialDelay: 30000, // Start keepalive probes after 30s idle
    connectTimeout: 10000,     // 10s connection timeout
  });

  // Log pool errors but don't crash
  pool.on("connection", () => {
    _connectionErrors = 0; // Reset error counter on successful connection
  });

  return pool;
}

/**
 * Get a Drizzle DB instance backed by a resilient connection pool.
 * Automatically recreates the pool if too many consecutive errors occur.
 */
export async function getDb() {
  if (!process.env.DATABASE_URL) return null;

  // If we've had too many consecutive errors, destroy and recreate the pool
  if (_connectionErrors >= MAX_CONSECUTIVE_ERRORS && _pool) {
    console.warn(`[Database] ${_connectionErrors} consecutive errors — recreating connection pool`);
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
      console.warn("[Database] Failed to create pool:", error);
      _pool = null;
      _db = null;
    }
  }
  return _db;
}

/**
 * RC-1: Query wrapper with automatic retry on connection errors.
 * Retries once after resetting the connection pool on transient errors
 * (ECONNRESET, PROTOCOL_CONNECTION_LOST, ETIMEDOUT, etc.)
 */
export async function withDbRetry<T>(
  operation: (db: NonNullable<Awaited<ReturnType<typeof getDb>>>) => Promise<T>,
  label = "query"
): Promise<T | null> {
  const MAX_RETRIES = 2;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const db = await getDb();
    if (!db) {
      console.warn(`[Database] Not available for ${label}`);
      return null;
    }

    try {
      const result = await operation(db);
      _connectionErrors = 0; // Success — reset error counter
      return result;
    } catch (error: unknown) {
      const isTransient = isTransientError(error);
      _connectionErrors++;

      if (isTransient && attempt < MAX_RETRIES) {
        console.warn(`[Database] Transient error in ${label} (attempt ${attempt}/${MAX_RETRIES}), retrying...`);
        // Force pool recreation on next getDb() call
        if (_pool) {
          try { await _pool.end(); } catch { /* ignore */ }
          _pool = null;
          _db = null;
        }
        // Brief delay before retry
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        continue;
      }

      console.error(`[Database] ${label} failed after ${attempt} attempts:`, error);
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

  // Check error code
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

  // Check error message
  const message = String(err.message || "");
  if (message.includes("ECONNRESET") || message.includes("Connection lost") || message.includes("ETIMEDOUT")) return true;

  // Check nested cause
  if (err.cause && typeof err.cause === "object") {
    const causeMsg = String((err.cause as Record<string, unknown>).message || "");
    if (causeMsg.includes("ECONNRESET") || causeMsg.includes("ETIMEDOUT") || causeMsg.includes("EPIPE")) return true;
  }

  return false;
}

// ─── User Helpers (unchanged API, now with retry) ──────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  await withDbRetry(async (db) => {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  }, "upsertUser");
}

export async function getUserByOpenId(openId: string) {
  return withDbRetry(async (db) => {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  }, "getUserByOpenId");
}

// Re-export drizzle-orm operators for use by domain modules
export { eq, and, desc, gte, lte, or, sql };
