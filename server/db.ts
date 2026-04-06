/**
 * Backward-compatible re-export.
 * All database helpers now live in server/db/ domain modules.
 * This file exists so existing `import { ... } from "./db"` still resolves.
 */
export * from "./db/index";
