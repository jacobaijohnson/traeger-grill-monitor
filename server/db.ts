import { eq, and, desc, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  traegerSessions,
  telemetryReadings,
  cookSessions,
  automationPrograms,
  type InsertTraegerSession,
  type InsertTelemetryReading,
  type InsertCookSession,
  type InsertAutomationProgram,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
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
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ===== Traeger Sessions =====

export async function upsertTraegerSession(data: InsertTraegerSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(traegerSessions)
    .where(eq(traegerSessions.userId, data.userId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(traegerSessions)
      .set({
        traegerEmail: data.traegerEmail,
        accessToken: data.accessToken,
        idToken: data.idToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
        grillsJson: data.grillsJson,
        selectedGrillId: data.selectedGrillId,
      })
      .where(eq(traegerSessions.userId, data.userId));
    return existing[0].id;
  } else {
    const result = await db.insert(traegerSessions).values(data);
    return result[0].insertId;
  }
}

export async function getTraegerSession(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(traegerSessions)
    .where(eq(traegerSessions.userId, userId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateTraegerSessionTokens(
  userId: number,
  accessToken: string,
  idToken: string,
  refreshToken: string,
  expiresAt: number
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(traegerSessions)
    .set({ accessToken, idToken, refreshToken, expiresAt })
    .where(eq(traegerSessions.userId, userId));
}

export async function updateSelectedGrill(userId: number, grillId: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(traegerSessions)
    .set({ selectedGrillId: grillId })
    .where(eq(traegerSessions.userId, userId));
}

export async function deleteTraegerSession(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(traegerSessions).where(eq(traegerSessions.userId, userId));
}

// ===== Telemetry =====

export async function insertTelemetry(data: InsertTelemetryReading) {
  const db = await getDb();
  if (!db) return;
  await db.insert(telemetryReadings).values(data);
}

export async function getTelemetryForSession(cookSessionId: number, limit = 1000) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(telemetryReadings)
    .where(eq(telemetryReadings.cookSessionId, cookSessionId))
    .orderBy(telemetryReadings.recordedAt)
    .limit(limit);
}

export async function getRecentTelemetry(userId: number, grillId: string, minutes = 60) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - minutes * 60 * 1000);
  return db
    .select()
    .from(telemetryReadings)
    .where(
      and(
        eq(telemetryReadings.userId, userId),
        eq(telemetryReadings.grillId, grillId),
        gte(telemetryReadings.recordedAt, since)
      )
    )
    .orderBy(telemetryReadings.recordedAt)
    .limit(1000);
}

// ===== Cook Sessions =====

export async function createCookSession(data: InsertCookSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(cookSessions).values(data);
  return result[0].insertId;
}

export async function endCookSession(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(cookSessions).set({ endedAt: new Date() }).where(eq(cookSessions.id, id));
}

export async function updateCookSessionNotes(id: number, notes: string, rating?: number) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = { notes };
  if (rating !== undefined) updateData.rating = rating;
  await db.update(cookSessions).set(updateData).where(eq(cookSessions.id, id));
}

export async function getUserCookSessions(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(cookSessions)
    .where(eq(cookSessions.userId, userId))
    .orderBy(desc(cookSessions.startedAt))
    .limit(limit);
}

export async function getCookSession(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(cookSessions).where(eq(cookSessions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ===== Automation Programs =====

export async function createAutomationProgram(data: InsertAutomationProgram) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(automationPrograms).values(data);
  return result[0].insertId;
}

export async function getUserAutomationPrograms(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(automationPrograms)
    .where(eq(automationPrograms.userId, userId))
    .orderBy(desc(automationPrograms.createdAt));
}

export async function getActiveAutomation(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(automationPrograms)
    .where(and(eq(automationPrograms.userId, userId), eq(automationPrograms.isActive, 1)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateAutomationState(id: number, currentStage: number, isActive: boolean) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(automationPrograms)
    .set({ currentStage, isActive: isActive ? 1 : 0 })
    .where(eq(automationPrograms.id, id));
}

export async function deleteAutomationProgram(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(automationPrograms).where(eq(automationPrograms.id, id));
}
