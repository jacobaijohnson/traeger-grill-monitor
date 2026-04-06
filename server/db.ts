import { eq, and, desc, gte, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  traegerSessions,
  telemetryReadings,
  cookSessions,
  cookAlerts,
  automationPrograms,
  customTemplates,
  type InsertTraegerSession,
  type InsertTelemetryReading,
  type InsertCookSession,
  type InsertCookAlert,
  type InsertAutomationProgram,
  type InsertCustomTemplate,
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

// ===== Custom Cook Templates =====

export async function createCustomTemplate(data: InsertCustomTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(customTemplates).values(data);
  return result[0].insertId;
}

export async function getUserCustomTemplates(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(customTemplates)
    .where(eq(customTemplates.userId, userId))
    .orderBy(desc(customTemplates.updatedAt));
}

export async function getPublishedTemplates(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(customTemplates)
    .where(eq(customTemplates.isPublished, 1))
    .orderBy(desc(customTemplates.forkCount), desc(customTemplates.createdAt))
    .limit(limit);
}

export async function getCustomTemplate(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customTemplates).where(eq(customTemplates.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateCustomTemplate(
  id: number,
  userId: number,
  data: Partial<InsertCustomTemplate>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(customTemplates)
    .set(data)
    .where(and(eq(customTemplates.id, id), eq(customTemplates.userId, userId)));
}

export async function deleteCustomTemplate(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(customTemplates)
    .where(and(eq(customTemplates.id, id), eq(customTemplates.userId, userId)));
}

export async function forkCustomTemplate(id: number, userId: number, authorName: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const original = await getCustomTemplate(id);
  if (!original) throw new Error("Template not found");

  // Increment fork count on original
  await db
    .update(customTemplates)
    .set({ forkCount: sql`${customTemplates.forkCount} + 1` })
    .where(eq(customTemplates.id, id));

  // Create the fork
  const result = await db.insert(customTemplates).values({
    userId,
    authorName,
    name: `${original.name} (fork)`,
    description: original.description,
    category: original.category,
    method: original.method,
    meatCut: original.meatCut,
    difficulty: original.difficulty,
    estimatedTime: original.estimatedTime,
    stagesJson: original.stagesJson,
    tipsJson: original.tipsJson,
    isPublished: 0,
    forkCount: 0,
    forkedFromId: id,
  });
  return result[0].insertId;
}

// ===== Cook Alerts =====

export async function insertCookAlert(data: InsertCookAlert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(cookAlerts).values(data);
  return result[0].insertId;
}

export async function getCookAlertsForSession(cookSessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(cookAlerts)
    .where(eq(cookAlerts.cookSessionId, cookSessionId))
    .orderBy(cookAlerts.triggerTemp);
}

export async function updateCookAlertStatus(
  id: number,
  status: string,
  firedAt?: Date,
  dismissedAt?: Date
) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = { status };
  if (firedAt) updateData.firedAt = firedAt;
  if (dismissedAt) updateData.dismissedAt = dismissedAt;
  await db.update(cookAlerts).set(updateData).where(eq(cookAlerts.id, id));
}

export async function dismissCookAlert(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(cookAlerts)
    .set({ status: "dismissed", dismissedAt: new Date() })
    .where(eq(cookAlerts.id, id));
}

// ===== Enhanced Cook Sessions =====

export async function getActiveCookSession(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(cookSessions)
    .where(
      and(
        eq(cookSessions.userId, userId),
        eq(cookSessions.status, "active")
      )
    )
    .orderBy(desc(cookSessions.startedAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateCookSessionStatus(
  id: number,
  status: string,
  extras?: { endedAt?: Date; peakGrillTemp?: number; peakProbeTemp?: number; currentStage?: number }
) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = { status };
  if (extras?.endedAt) updateData.endedAt = extras.endedAt;
  if (extras?.peakGrillTemp !== undefined) updateData.peakGrillTemp = extras.peakGrillTemp;
  if (extras?.peakProbeTemp !== undefined) updateData.peakProbeTemp = extras.peakProbeTemp;
  if (extras?.currentStage !== undefined) updateData.currentStage = extras.currentStage;
  await db.update(cookSessions).set(updateData).where(eq(cookSessions.id, id));
}

export async function updateCookSessionAlerts(id: number, alertsJson: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(cookSessions).set({ alertsJson }).where(eq(cookSessions.id, id));
}

export async function updateCookSessionStages(id: number, stagesJson: string, currentStage: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(cookSessions).set({ stagesJson, currentStage }).where(eq(cookSessions.id, id));
}

// ===== Telemetry Persistence from MQTT =====

export async function persistTelemetryFromMqtt(
  userId: number,
  telemetry: { grill: number; probe: number; ambient: number; set: number; probeSet: number; pelletLevel: number; systemStatus: number },
  grillId: string,
  cookSessionId?: number
) {
  const db = await getDb();
  if (!db) return;
  await db.insert(telemetryReadings).values({
    userId,
    grillId,
    cookSessionId: cookSessionId ?? null,
    grillTemp: telemetry.grill,
    probeTemp: telemetry.probe,
    ambientTemp: telemetry.ambient,
    targetTemp: telemetry.set,
    targetProbeTemp: telemetry.probeSet,
    pelletLevel: telemetry.pelletLevel,
    systemStatus: telemetry.systemStatus,
  });
}

// ===== Cook Analytics =====

export interface CookAnalyticsSummary {
  totalCooks: number;
  completedCooks: number;
  cancelledCooks: number;
  totalCookMinutes: number;
  avgCookMinutes: number;
  avgRating: number | null;
  ratedCooks: number;
  bestRatedCook: { id: number; meatType: string | null; cutName: string | null; rating: number } | null;
  longestCook: { id: number; meatType: string | null; cutName: string | null; durationMinutes: number } | null;
}

export interface CookByMeatType {
  meatType: string;
  count: number;
  avgDurationMinutes: number;
  avgRating: number | null;
  completedCount: number;
}

export interface CookByMethod {
  method: string;
  count: number;
  avgDurationMinutes: number;
  avgRating: number | null;
}

export interface CookByMonth {
  month: string; // YYYY-MM
  count: number;
  avgRating: number | null;
  totalMinutes: number;
}

export interface CookByCut {
  cutName: string;
  meatType: string | null;
  count: number;
  avgDurationMinutes: number;
  avgRating: number | null;
  bestRating: number | null;
  avgPeakProbeTemp: number | null;
}

export interface RatingDistribution {
  rating: number;
  count: number;
}

export async function getCookAnalyticsSummary(userId: number): Promise<CookAnalyticsSummary> {
  const db = await getDb();
  if (!db) return {
    totalCooks: 0, completedCooks: 0, cancelledCooks: 0,
    totalCookMinutes: 0, avgCookMinutes: 0, avgRating: null,
    ratedCooks: 0, bestRatedCook: null, longestCook: null,
  };

  const sessions = await db
    .select()
    .from(cookSessions)
    .where(eq(cookSessions.userId, userId))
    .orderBy(desc(cookSessions.startedAt));

  if (sessions.length === 0) return {
    totalCooks: 0, completedCooks: 0, cancelledCooks: 0,
    totalCookMinutes: 0, avgCookMinutes: 0, avgRating: null,
    ratedCooks: 0, bestRatedCook: null, longestCook: null,
  };

  const completed = sessions.filter(s => s.status === "completed");
  const cancelled = sessions.filter(s => s.status === "cancelled");
  const rated = sessions.filter(s => s.rating !== null && s.rating !== undefined);

  // Calculate durations
  let totalMinutes = 0;
  let longestCook: CookAnalyticsSummary["longestCook"] = null;
  let longestDuration = 0;

  for (const s of sessions) {
    if (s.endedAt && s.startedAt) {
      const dur = (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000;
      if (dur > 0 && dur < 48 * 60) { // sanity: under 48 hours
        totalMinutes += dur;
        if (dur > longestDuration) {
          longestDuration = dur;
          longestCook = { id: s.id, meatType: s.meatType, cutName: s.cutName, durationMinutes: Math.round(dur) };
        }
      }
    }
  }

  const sessionsWithDuration = sessions.filter(s => s.endedAt && s.startedAt);
  const avgCookMinutes = sessionsWithDuration.length > 0 ? totalMinutes / sessionsWithDuration.length : 0;

  // Best rated
  let bestRatedCook: CookAnalyticsSummary["bestRatedCook"] = null;
  if (rated.length > 0) {
    const best = rated.reduce((a, b) => ((a.rating ?? 0) >= (b.rating ?? 0) ? a : b));
    bestRatedCook = { id: best.id, meatType: best.meatType, cutName: best.cutName, rating: best.rating! };
  }

  const avgRating = rated.length > 0
    ? rated.reduce((sum, s) => sum + (s.rating ?? 0), 0) / rated.length
    : null;

  return {
    totalCooks: sessions.length,
    completedCooks: completed.length,
    cancelledCooks: cancelled.length,
    totalCookMinutes: Math.round(totalMinutes),
    avgCookMinutes: Math.round(avgCookMinutes),
    avgRating: avgRating !== null ? Math.round(avgRating * 10) / 10 : null,
    ratedCooks: rated.length,
    bestRatedCook,
    longestCook,
  };
}

export async function getCooksByMeatType(userId: number): Promise<CookByMeatType[]> {
  const db = await getDb();
  if (!db) return [];

  const sessions = await db
    .select()
    .from(cookSessions)
    .where(eq(cookSessions.userId, userId));

  const grouped = new Map<string, { count: number; totalDur: number; durCount: number; totalRating: number; ratedCount: number; completedCount: number }>();

  for (const s of sessions) {
    const key = s.meatType || "Unknown";
    const entry = grouped.get(key) || { count: 0, totalDur: 0, durCount: 0, totalRating: 0, ratedCount: 0, completedCount: 0 };
    entry.count++;
    if (s.status === "completed") entry.completedCount++;
    if (s.endedAt && s.startedAt) {
      const dur = (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000;
      if (dur > 0 && dur < 48 * 60) { entry.totalDur += dur; entry.durCount++; }
    }
    if (s.rating !== null && s.rating !== undefined) { entry.totalRating += s.rating; entry.ratedCount++; }
    grouped.set(key, entry);
  }

  return Array.from(grouped.entries())
    .map(([meatType, data]) => ({
      meatType,
      count: data.count,
      avgDurationMinutes: data.durCount > 0 ? Math.round(data.totalDur / data.durCount) : 0,
      avgRating: data.ratedCount > 0 ? Math.round((data.totalRating / data.ratedCount) * 10) / 10 : null,
      completedCount: data.completedCount,
    }))
    .sort((a, b) => b.count - a.count);
}

export async function getCooksByMethod(userId: number): Promise<CookByMethod[]> {
  const db = await getDb();
  if (!db) return [];

  const sessions = await db
    .select()
    .from(cookSessions)
    .where(eq(cookSessions.userId, userId));

  const grouped = new Map<string, { count: number; totalDur: number; durCount: number; totalRating: number; ratedCount: number }>();

  for (const s of sessions) {
    const key = s.method || "Unknown";
    const entry = grouped.get(key) || { count: 0, totalDur: 0, durCount: 0, totalRating: 0, ratedCount: 0 };
    entry.count++;
    if (s.endedAt && s.startedAt) {
      const dur = (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000;
      if (dur > 0 && dur < 48 * 60) { entry.totalDur += dur; entry.durCount++; }
    }
    if (s.rating !== null && s.rating !== undefined) { entry.totalRating += s.rating; entry.ratedCount++; }
    grouped.set(key, entry);
  }

  return Array.from(grouped.entries())
    .map(([method, data]) => ({
      method,
      count: data.count,
      avgDurationMinutes: data.durCount > 0 ? Math.round(data.totalDur / data.durCount) : 0,
      avgRating: data.ratedCount > 0 ? Math.round((data.totalRating / data.ratedCount) * 10) / 10 : null,
    }))
    .sort((a, b) => b.count - a.count);
}

export async function getCooksByMonth(userId: number): Promise<CookByMonth[]> {
  const db = await getDb();
  if (!db) return [];

  const sessions = await db
    .select()
    .from(cookSessions)
    .where(eq(cookSessions.userId, userId))
    .orderBy(cookSessions.startedAt);

  const grouped = new Map<string, { count: number; totalRating: number; ratedCount: number; totalMinutes: number }>();

  for (const s of sessions) {
    const d = new Date(s.startedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const entry = grouped.get(key) || { count: 0, totalRating: 0, ratedCount: 0, totalMinutes: 0 };
    entry.count++;
    if (s.rating !== null && s.rating !== undefined) { entry.totalRating += s.rating; entry.ratedCount++; }
    if (s.endedAt && s.startedAt) {
      const dur = (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000;
      if (dur > 0 && dur < 48 * 60) entry.totalMinutes += dur;
    }
    grouped.set(key, entry);
  }

  return Array.from(grouped.entries())
    .map(([month, data]) => ({
      month,
      count: data.count,
      avgRating: data.ratedCount > 0 ? Math.round((data.totalRating / data.ratedCount) * 10) / 10 : null,
      totalMinutes: Math.round(data.totalMinutes),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export async function getCooksByCut(userId: number): Promise<CookByCut[]> {
  const db = await getDb();
  if (!db) return [];

  const sessions = await db
    .select()
    .from(cookSessions)
    .where(eq(cookSessions.userId, userId));

  const grouped = new Map<string, { meatType: string | null; count: number; totalDur: number; durCount: number; totalRating: number; ratedCount: number; bestRating: number | null; totalPeakProbe: number; peakCount: number }>();

  for (const s of sessions) {
    const key = s.cutName || "Unknown";
    const entry = grouped.get(key) || { meatType: null, count: 0, totalDur: 0, durCount: 0, totalRating: 0, ratedCount: 0, bestRating: null, totalPeakProbe: 0, peakCount: 0 };
    entry.count++;
    entry.meatType = s.meatType;
    if (s.endedAt && s.startedAt) {
      const dur = (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000;
      if (dur > 0 && dur < 48 * 60) { entry.totalDur += dur; entry.durCount++; }
    }
    if (s.rating !== null && s.rating !== undefined) {
      entry.totalRating += s.rating;
      entry.ratedCount++;
      if (entry.bestRating === null || s.rating > entry.bestRating) entry.bestRating = s.rating;
    }
    if (s.peakProbeTemp !== null && s.peakProbeTemp !== undefined) {
      entry.totalPeakProbe += s.peakProbeTemp;
      entry.peakCount++;
    }
    grouped.set(key, entry);
  }

  return Array.from(grouped.entries())
    .map(([cutName, data]) => ({
      cutName,
      meatType: data.meatType,
      count: data.count,
      avgDurationMinutes: data.durCount > 0 ? Math.round(data.totalDur / data.durCount) : 0,
      avgRating: data.ratedCount > 0 ? Math.round((data.totalRating / data.ratedCount) * 10) / 10 : null,
      bestRating: data.bestRating,
      avgPeakProbeTemp: data.peakCount > 0 ? Math.round(data.totalPeakProbe / data.peakCount) : null,
    }))
    .sort((a, b) => b.count - a.count);
}

export async function getRatingDistribution(userId: number): Promise<RatingDistribution[]> {
  const db = await getDb();
  if (!db) return [];

  const sessions = await db
    .select()
    .from(cookSessions)
    .where(eq(cookSessions.userId, userId));

  const dist = new Map<number, number>();
  for (let r = 1; r <= 5; r++) dist.set(r, 0);

  for (const s of sessions) {
    if (s.rating !== null && s.rating !== undefined && s.rating >= 1 && s.rating <= 5) {
      dist.set(s.rating, (dist.get(s.rating) || 0) + 1);
    }
  }

  return Array.from(dist.entries())
    .map(([rating, count]) => ({ rating, count }))
    .sort((a, b) => a.rating - b.rating);
}
