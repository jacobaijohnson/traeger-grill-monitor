import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, boolean, json, float } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Traeger credential sessions (encrypted server-side)
export const traegerSessions = mysqlTable("traeger_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
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
  userId: int("userId").notNull(),
  grillId: varchar("grillId", { length: 128 }).notNull(),
  cookSessionId: int("cookSessionId"),
  grillTemp: float("grillTemp").notNull(),
  probeTemp: float("probeTemp"),
  ambientTemp: float("ambientTemp"),
  targetTemp: float("targetTemp"),
  pelletLevel: int("pelletLevel"),
  systemStatus: int("systemStatus"),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
});

export type TelemetryReading = typeof telemetryReadings.$inferSelect;
export type InsertTelemetryReading = typeof telemetryReadings.$inferInsert;

// Cook sessions (grouping telemetry into discrete cooks)
export const cookSessions = mysqlTable("cook_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  grillId: varchar("grillId", { length: 128 }).notNull(),
  templateId: varchar("templateId", { length: 64 }),
  meatType: varchar("meatType", { length: 64 }),
  cutName: varchar("cutName", { length: 128 }),
  method: varchar("method", { length: 32 }),
  notes: text("notes"),
  rating: int("rating"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CookSession = typeof cookSessions.$inferSelect;
export type InsertCookSession = typeof cookSessions.$inferInsert;

// Automation programs (multi-stage cook programs)
export const automationPrograms = mysqlTable("automation_programs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  templateId: varchar("templateId", { length: 64 }),
  stagesJson: json("stagesJson").notNull(),
  isActive: int("isActive").default(0).notNull(),
  currentStage: int("currentStage").default(0).notNull(),
  cookSessionId: int("cookSessionId"),
  startedAt: timestamp("startedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AutomationProgram = typeof automationPrograms.$inferSelect;
export type InsertAutomationProgram = typeof automationPrograms.$inferInsert;

// User-created custom cook templates (shareable)
export const customTemplates = mysqlTable("custom_templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  authorName: varchar("authorName", { length: 128 }),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 32 }).notNull(), // beef, pork, poultry, etc.
  method: varchar("method", { length: 32 }).notNull(), // smoke, grill, reverse_sear, etc.
  meatCut: varchar("meatCut", { length: 128 }),
  difficulty: varchar("difficulty", { length: 16 }).default("intermediate").notNull(),
  estimatedTime: varchar("estimatedTime", { length: 32 }),
  stagesJson: json("stagesJson").notNull(), // array of CookStage objects
  tipsJson: json("tipsJson"), // array of string tips
  isPublished: int("isPublished").default(0).notNull(), // 0=private, 1=shared with community
  forkCount: int("forkCount").default(0).notNull(),
  forkedFromId: int("forkedFromId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomTemplate = typeof customTemplates.$inferSelect;
export type InsertCustomTemplate = typeof customTemplates.$inferInsert;
