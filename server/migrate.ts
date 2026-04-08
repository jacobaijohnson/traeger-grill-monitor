/**
 * Database migration runner for Docker container startup.
 *
 * Runs in two phases:
 * 1. Better Auth migrations (creates user, session, account, verification tables)
 * 2. Application migrations (consolidated SQL for all app tables + indexes)
 *
 * This script is called by the s6-overlay init-migrations oneshot service
 * before the main Node.js application starts.
 *
 * Idempotent: safe to run on every container start. Uses IF NOT EXISTS
 * for table creation and silently ignores duplicate index errors.
 */
import { auth } from "./_core/auth";
import { getMigrations } from "better-auth/db/migration";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger";

const log = logger.child({ module: "migrate" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATION_FILE = path.join(__dirname, "../drizzle/0010_consolidated_fresh_install.sql");

async function runMigrations() {
  log.info("╔══════════════════════════════════════════════════════════════╗");
  log.info("║              DATABASE MIGRATION RUNNER                       ║");
  log.info("╚══════════════════════════════════════════════════════════════╝");

  if (!process.env.DATABASE_URL) {
    log.error("DATABASE_URL not set — cannot run migrations");
    process.exit(1);
  }

  // ─── Phase 1: Better Auth tables ─────────────────────
  log.info("Phase 1: Better Auth schema migration...");
  try {
    const { toBeCreated, toBeAdded, runMigrations: runBetterAuthMigrations } = await getMigrations(auth.options);

    if (toBeCreated.length > 0) {
      log.info({ tables: toBeCreated.map((t: any) => t.table) }, "Tables to create");
    }
    if (toBeAdded.length > 0) {
      log.info({ columns: toBeAdded.map((t: any) => `${t.table}(${Object.keys(t.fields).join(",")})`) }, "Columns to add");
    }

    await runBetterAuthMigrations();
    log.info("Better Auth migration complete");
  } catch (err: any) {
    log.error({ err: err.message }, "Better Auth migration failed");
    // Don't exit — try app migrations anyway (Better Auth tables may already exist)
  }

  // ─── Phase 2: Application tables ─────────────────────
  log.info("Phase 2: Application schema migration...");

  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 3,
    multipleStatements: true,
  });

  try {
    // Read the consolidated migration SQL
    if (!fs.existsSync(MIGRATION_FILE)) {
      log.error({ path: MIGRATION_FILE }, "Migration file not found");
      process.exit(1);
    }

    const sql = fs.readFileSync(MIGRATION_FILE, "utf-8");

    // Split by statement (handling the --> statement-breakpoint markers too)
    const statements = sql
      .split(/;(?:\s*-->.*)?/)
      .map((s) => {
        // Strip leading comment lines and empty lines from each statement
        const lines = s.split('\n');
        while (lines.length && (lines[0].trim() === '' || lines[0].trim().startsWith('--'))) {
          lines.shift();
        }
        return lines.join('\n').trim();
      })
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    log.info({ count: statements.length }, "Executing SQL statements");

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const stmt of statements) {
      try {
        await pool.execute(stmt);
        // Check if it's a CREATE TABLE or CREATE INDEX
        if (stmt.toUpperCase().includes("CREATE TABLE")) {
          const match = stmt.match(/CREATE TABLE.*?`(\w+)`/i);
          if (match) {
            log.info({ table: match[1] }, "Table created");
            created++;
          }
        } else if (stmt.toUpperCase().includes("CREATE INDEX")) {
          created++;
        }
      } catch (err: any) {
        const code = err.code || err.errno;
        // ER_TABLE_EXISTS_ERROR (1050) or ER_DUP_KEYNAME (1061) — safe to skip
        if (code === "ER_TABLE_EXISTS_ERROR" || err.errno === 1050) {
          skipped++;
        } else if (code === "ER_DUP_KEYNAME" || err.errno === 1061) {
          skipped++;
        } else {
          log.error({ err: err.message, stmt: stmt.substring(0, 80) }, "SQL error");
          errors++;
        }
      }
    }

    log.info({ created, skipped, errors }, "Migration results");

    if (errors > 0) {
      log.warn("Some statements failed — check errors above");
    } else {
      log.info("Application migration complete");
    }
  } finally {
    await pool.end();
  }

  log.info("All migrations complete");
}

runMigrations().catch((err) => {
  log.fatal({ err }, "Fatal migration error");
  process.exit(1);
});
