import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, boolean, json, float } from "drizzle-orm/mysql-core";

/**
 * NOTE: The primary `user`, `session`, `account`, and `verification` tables
 * are managed by Better Auth (auto-migrated). They are NOT defined here.
 *
 * The `userId` columns below are VARCHAR(36) to match Better Auth's UUID user IDs.
 */

// Traeger credential sessions (encrypted server-side)
export const traegerSessions = mysqlTable("traeger_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("userId", { length: 36 }).notNull(),
  traegerEmail: varchar("traegerEmail", { length: 320 }).notNull(),
  accessToken: text("accessToken").notNull(),
  idToken: text("idToken").notNull(),
  refreshToken: text("refreshToken").notNull(),
  expiresAt: bigint("expiresAt", { mode: "number" }).notNull(),
  selectedGrillId: varchar("selectedGrillId", { length: 128 }),
  grillsJson: json("grillsJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TraegerSession = typeof traegerSessions.$inferSelect;
export type InsertTraegerSession = typeof traegerSessions.$inferInsert;

// Telemetry readings (time-series data)
export const telemetryReadings = mysqlTable("telemetry_readings", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("userId", { length: 36 }).notNull(),
  grillId: varchar("grillId", { length: 128 }).notNull(),
  cookSessionId: int("cookSessionId"),
  grillTemp: float("grillTemp").notNull(),
  probeTemp: float("probeTemp"),
  ambientTemp: float("ambientTemp"),
  targetTemp: float("targetTemp"),
  targetProbeTemp: float("targetProbeTemp"),
  pelletLevel: int("pelletLevel"),
  systemStatus: int("systemStatus"),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
});

export type TelemetryReading = typeof telemetryReadings.$inferSelect;
export type InsertTelemetryReading = typeof telemetryReadings.$inferInsert;

// Cook sessions (grouping telemetry into discrete cooks)
export const cookSessions = mysqlTable("cook_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("userId", { length: 36 }).notNull(),
  grillId: varchar("grillId", { length: 128 }).notNull(),
  templateId: varchar("templateId", { length: 64 }),
  meatType: varchar("meatType", { length: 64 }),
  cutName: varchar("cutName", { length: 128 }),
  method: varchar("method", { length: 32 }),
  notes: text("notes"),
  rating: int("rating"),
  status: varchar("status", { length: 16 }).default("active").notNull(),
  stagesJson: json("stagesJson"),
  alertsJson: json("alertsJson"),
  currentStage: int("currentStage").default(0).notNull(),
  peakGrillTemp: float("peakGrillTemp"),
  peakProbeTemp: float("peakProbeTemp"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CookSession = typeof cookSessions.$inferSelect;
export type InsertCookSession = typeof cookSessions.$inferInsert;

// Cook alerts (fired during a session, persisted for history)
export const cookAlerts = mysqlTable("cook_alerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("userId", { length: 36 }).notNull(),
  grillId: varchar("grillId", { length: 128 }),
  cookSessionId: int("cookSessionId").notNull(),
  alertType: varchar("alertType", { length: 16 }).notNull(),
  label: varchar("label", { length: 128 }).notNull(),
  triggerTemp: float("triggerTemp").notNull(),
  triggerType: varchar("triggerType", { length: 16 }).default("probe").notNull(),
  status: varchar("status", { length: 16 }).default("pending").notNull(),
  firedAt: timestamp("firedAt"),
  dismissedAt: timestamp("dismissedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CookAlert = typeof cookAlerts.$inferSelect;
export type InsertCookAlert = typeof cookAlerts.$inferInsert;

// Pellet consumption logs (time-series pellet level tracking)
export const pelletLogs = mysqlTable("pellet_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("userId", { length: 36 }).notNull(),
  grillId: varchar("grillId", { length: 128 }).notNull(),
  cookSessionId: int("cookSessionId"),
  pelletLevel: int("pelletLevel").notNull(),
  estimatedLbs: float("estimatedLbs"),
  burnRateLbsPerHr: float("burnRateLbsPerHr"),
  grillTemp: float("grillTemp"),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
});

export type PelletLog = typeof pelletLogs.$inferSelect;
export type InsertPelletLog = typeof pelletLogs.$inferInsert;

// Automation programs (multi-stage cook programs)
export const automationPrograms = mysqlTable("automation_programs", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("userId", { length: 36 }).notNull(),
  grillId: varchar("grillId", { length: 128 }),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 32 }),
  method: varchar("method", { length: 32 }),
  meatCut: varchar("meatCut", { length: 128 }),
  difficulty: varchar("difficulty", { length: 16 }).default("intermediate"),
  estimatedTime: varchar("estimatedTime", { length: 32 }),
  tags: json("tags"),
  templateId: varchar("templateId", { length: 64 }),
  programJson: json("programJson").notNull(),
  stagesJson: json("stagesJson"),
  variableValuesJson: json("variableValuesJson"),
  executionLogJson: json("executionLogJson"),
  status: varchar("status", { length: 16 }).default("ready").notNull(),
  isActive: int("isActive").default(0).notNull(),
  currentStage: int("currentStage").default(0).notNull(),
  cookSessionId: int("cookSessionId"),
  isPublished: int("isPublished").default(0).notNull(),
  authorName: varchar("authorName", { length: 128 }),
  forkCount: int("forkCount").default(0).notNull(),
  forkedFromId: int("forkedFromId"),
  startedAt: timestamp("startedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AutomationProgram = typeof automationPrograms.$inferSelect;
export type InsertAutomationProgram = typeof automationPrograms.$inferInsert;

// User-created custom cook templates (shareable)
export const customTemplates = mysqlTable("custom_templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("userId", { length: 36 }).notNull(),
  authorName: varchar("authorName", { length: 128 }),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 32 }).notNull(),
  method: varchar("method", { length: 32 }).notNull(),
  meatCut: varchar("meatCut", { length: 128 }),
  difficulty: varchar("difficulty", { length: 16 }).default("intermediate").notNull(),
  estimatedTime: varchar("estimatedTime", { length: 32 }),
  stagesJson: json("stagesJson").notNull(),
  tipsJson: json("tipsJson"),
  isPublished: int("isPublished").default(0).notNull(),
  forkCount: int("forkCount").default(0).notNull(),
  forkedFromId: int("forkedFromId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomTemplate = typeof customTemplates.$inferSelect;
export type InsertCustomTemplate = typeof customTemplates.$inferInsert;

// Program execution history (tracks each run of an automation program)
export const programExecutions = mysqlTable("program_executions", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("userId", { length: 36 }).notNull(),
  automationProgramId: int("automationProgramId").notNull(),
  programName: varchar("programName", { length: 128 }).notNull(),
  programCategory: varchar("programCategory", { length: 32 }),
  programMethod: varchar("programMethod", { length: 32 }),
  programMeatCut: varchar("programMeatCut", { length: 128 }),
  cookSessionId: int("cookSessionId"),
  grillId: varchar("grillId", { length: 128 }),
  variableValuesJson: json("variableValuesJson"),
  stepsCompleted: int("stepsCompleted").default(0).notNull(),
  totalSteps: int("totalSteps").default(0).notNull(),
  outcome: varchar("outcome", { length: 16 }).default("running").notNull(),
  peakGrillTemp: float("peakGrillTemp"),
  peakProbeTemp: float("peakProbeTemp"),
  executionLogJson: json("executionLogJson"),
  notes: text("notes"),
  rating: int("rating"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProgramExecution = typeof programExecutions.$inferSelect;
export type InsertProgramExecution = typeof programExecutions.$inferInsert;

// ─── Access Control & Settings ─────────────────────────

// Invite codes (single-use, time-expiring)
export const inviteCodes = mysqlTable("invite_codes", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  createdByUserId: varchar("createdByUserId", { length: 36 }).notNull(),
  createdByName: varchar("createdByName", { length: 128 }),
  usedByUserId: varchar("usedByUserId", { length: 36 }),
  usedByEmail: varchar("usedByEmail", { length: 320 }),
  usedAt: timestamp("usedAt"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InviteCode = typeof inviteCodes.$inferSelect;
export type InsertInviteCode = typeof inviteCodes.$inferInsert;

// Email allowlist (admin-managed list of allowed registration emails)
export const emailAllowlist = mysqlTable("email_allowlist", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  addedByUserId: varchar("addedByUserId", { length: 36 }).notNull(),
  note: varchar("note", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailAllowlistEntry = typeof emailAllowlist.$inferSelect;
export type InsertEmailAllowlistEntry = typeof emailAllowlist.$inferInsert;

// App settings (key-value store for system configuration)
export const appSettings = mysqlTable("app_settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;
