import { getDb, withDbRetry, eq, and, desc } from "./connection";
import {
  cookSessions,
  cookAlerts,
  type InsertCookSession,
  type InsertCookAlert,
} from "../../drizzle/schema";

// ===== Cook Sessions =====

export async function createCookSession(data: InsertCookSession) {
  const result = await withDbRetry(async (db) => {
    const insertResult = await db.insert(cookSessions).values(data);
    return insertResult[0].insertId;
  }, "createCookSession");
  if (result === null) throw new Error("Database not available");
  return result;
}

export async function endCookSession(id: number, userId?: number) {
  await withDbRetry(async (db) => {
    const conditions = userId
      ? and(eq(cookSessions.id, id), eq(cookSessions.userId, userId))
      : eq(cookSessions.id, id);
    await db.update(cookSessions).set({ endedAt: new Date() }).where(conditions);
  }, "endCookSession");
}

export async function updateCookSessionNotes(id: number, notes: string, rating?: number, userId?: number) {
  await withDbRetry(async (db) => {
    const updateData: Record<string, unknown> = { notes };
    if (rating !== undefined) updateData.rating = rating;
    const conditions = userId
      ? and(eq(cookSessions.id, id), eq(cookSessions.userId, userId))
      : eq(cookSessions.id, id);
    await db.update(cookSessions).set(updateData).where(conditions);
  }, "updateCookSessionNotes");
}

export async function getUserCookSessions(userId: number, limit = 50) {
  return await withDbRetry(async (db) => {
    return db
      .select()
      .from(cookSessions)
      .where(eq(cookSessions.userId, userId))
      .orderBy(desc(cookSessions.startedAt))
      .limit(limit);
  }, "getUserCookSessions") ?? [];
}

export async function getCookSession(id: number, userId?: number) {
  return await withDbRetry(async (db) => {
    const conditions = userId
      ? and(eq(cookSessions.id, id), eq(cookSessions.userId, userId))
      : eq(cookSessions.id, id);
    const result = await db.select().from(cookSessions).where(conditions).limit(1);
    return result.length > 0 ? result[0] : undefined;
  }, "getCookSession");
}

export async function getActiveCookSession(userId: number) {
  return await withDbRetry(async (db) => {
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
  }, "getActiveCookSession");
}

export async function updateCookSessionStatus(
  id: number,
  status: string,
  extras?: { endedAt?: Date; peakGrillTemp?: number; peakProbeTemp?: number; currentStage?: number }
) {
  await withDbRetry(async (db) => {
    const updateData: Record<string, unknown> = { status };
    if (extras?.endedAt) updateData.endedAt = extras.endedAt;
    if (extras?.peakGrillTemp !== undefined) updateData.peakGrillTemp = extras.peakGrillTemp;
    if (extras?.peakProbeTemp !== undefined) updateData.peakProbeTemp = extras.peakProbeTemp;
    if (extras?.currentStage !== undefined) updateData.currentStage = extras.currentStage;
    await db.update(cookSessions).set(updateData).where(eq(cookSessions.id, id));
  }, "updateCookSessionStatus");
}

export async function updateCookSessionAlerts(id: number, alertsJson: string) {
  await withDbRetry(async (db) => {
    await db.update(cookSessions).set({ alertsJson }).where(eq(cookSessions.id, id));
  }, "updateCookSessionAlerts");
}

export async function updateCookSessionStages(id: number, stagesJson: string, currentStage: number) {
  await withDbRetry(async (db) => {
    await db.update(cookSessions).set({ stagesJson, currentStage }).where(eq(cookSessions.id, id));
  }, "updateCookSessionStages");
}

// ===== Cook Alerts =====

export async function insertCookAlert(data: InsertCookAlert) {
  const result = await withDbRetry(async (db) => {
    const insertResult = await db.insert(cookAlerts).values(data);
    return insertResult[0].insertId;
  }, "insertCookAlert");
  if (result === null) throw new Error("Database not available");
  return result;
}

export async function getCookAlertsForSession(cookSessionId: number, userId?: number) {
  return await withDbRetry(async (db) => {
    const conditions = userId
      ? and(eq(cookAlerts.cookSessionId, cookSessionId), eq(cookAlerts.userId, userId))
      : eq(cookAlerts.cookSessionId, cookSessionId);
    return db
      .select()
      .from(cookAlerts)
      .where(conditions)
      .orderBy(cookAlerts.triggerTemp);
  }, "getCookAlertsForSession") ?? [];
}

export async function updateCookAlertStatus(
  id: number,
  status: string,
  firedAt?: Date,
  dismissedAt?: Date
) {
  await withDbRetry(async (db) => {
    const updateData: Record<string, unknown> = { status };
    if (firedAt) updateData.firedAt = firedAt;
    if (dismissedAt) updateData.dismissedAt = dismissedAt;
    await db.update(cookAlerts).set(updateData).where(eq(cookAlerts.id, id));
  }, "updateCookAlertStatus");
}

export async function dismissCookAlert(id: number) {
  await withDbRetry(async (db) => {
    await db
      .update(cookAlerts)
      .set({ status: "dismissed", dismissedAt: new Date() })
      .where(eq(cookAlerts.id, id));
  }, "dismissCookAlert");
}
