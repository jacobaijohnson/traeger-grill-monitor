import { getDb, eq, and, desc } from "./connection";
import {
  cookSessions,
  cookAlerts,
  type InsertCookSession,
  type InsertCookAlert,
} from "../../drizzle/schema";

// ===== Cook Sessions =====

export async function createCookSession(data: InsertCookSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(cookSessions).values(data);
  return result[0].insertId;
}

export async function endCookSession(id: number, userId?: number) {
  const db = await getDb();
  if (!db) return;
  const conditions = userId
    ? and(eq(cookSessions.id, id), eq(cookSessions.userId, userId))
    : eq(cookSessions.id, id);
  await db.update(cookSessions).set({ endedAt: new Date() }).where(conditions);
}

export async function updateCookSessionNotes(id: number, notes: string, rating?: number, userId?: number) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = { notes };
  if (rating !== undefined) updateData.rating = rating;
  const conditions = userId
    ? and(eq(cookSessions.id, id), eq(cookSessions.userId, userId))
    : eq(cookSessions.id, id);
  await db.update(cookSessions).set(updateData).where(conditions);
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

export async function getCookSession(id: number, userId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const conditions = userId
    ? and(eq(cookSessions.id, id), eq(cookSessions.userId, userId))
    : eq(cookSessions.id, id);
  const result = await db.select().from(cookSessions).where(conditions).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

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

// ===== Cook Alerts =====

export async function insertCookAlert(data: InsertCookAlert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(cookAlerts).values(data);
  return result[0].insertId;
}

export async function getCookAlertsForSession(cookSessionId: number, userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = userId
    ? and(eq(cookAlerts.cookSessionId, cookSessionId), eq(cookAlerts.userId, userId))
    : eq(cookAlerts.cookSessionId, cookSessionId);
  return db
    .select()
    .from(cookAlerts)
    .where(conditions)
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
