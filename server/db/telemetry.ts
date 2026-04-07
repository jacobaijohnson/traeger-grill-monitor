import { getDb, withDbRetry, eq, and, gte, lte, sql } from "./connection";
import { lt } from "drizzle-orm";
import { dbLog } from "../logger";
import {
  telemetryReadings,
  type InsertTelemetryReading,
} from "../../drizzle/schema";

export async function insertTelemetry(data: InsertTelemetryReading) {
  await withDbRetry(async (db) => {
    await db.insert(telemetryReadings).values(data);
  }, "insertTelemetry");
}

export async function getTelemetryForSession(cookSessionId: number, limit = 1000, userId?: string) {
  return await withDbRetry(async (db) => {
    const conditions = userId
      ? and(eq(telemetryReadings.cookSessionId, cookSessionId), eq(telemetryReadings.userId, userId))
      : eq(telemetryReadings.cookSessionId, cookSessionId);
    return db
      .select()
      .from(telemetryReadings)
      .where(conditions)
      .orderBy(telemetryReadings.recordedAt)
      .limit(limit);
  }, "getTelemetryForSession") ?? [];
}

export async function getRecentTelemetry(userId: string, grillId: string, minutes = 60) {
  return await withDbRetry(async (db) => {
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
  }, "getRecentTelemetry") ?? [];
}

export async function persistTelemetryFromMqtt(
  userId: string,
  telemetry: { grill: number; probe: number; ambient: number; set: number; probeSet: number; pelletLevel: number; systemStatus: number },
  grillId: string,
  cookSessionId?: number
) {
  await withDbRetry(async (db) => {
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
  }, "persistTelemetryFromMqtt");
}

/**
 * P2: Telemetry retention policy — delete readings older than the specified number of days.
 * Default: 90 days. Only deletes non-session telemetry (ambient readings).
 * Session-linked telemetry is preserved with the cook session.
 * Returns the number of deleted rows.
 */
export async function purgeStaleTelemetry(retentionDays = 90): Promise<number> {
  const result = await withDbRetry(async (db) => {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const deleteResult = await db
      .delete(telemetryReadings)
      .where(
        and(
          sql`${telemetryReadings.cookSessionId} IS NULL`,
          lt(telemetryReadings.recordedAt, cutoff)
        )
      );
    const affectedRows = (deleteResult as unknown as [{ affectedRows: number }])?.[0]?.affectedRows ?? 0;
    dbLog.info({ deleted: affectedRows, retentionDays }, "Purged stale telemetry readings");
    return affectedRows;
  }, "purgeStaleTelemetry");
  return result ?? 0;
}

/**
 * Get total telemetry reading count for monitoring.
 */
export async function getTelemetryCount(userId?: string): Promise<number> {
  const result = await withDbRetry(async (db) => {
    const conditions = userId ? eq(telemetryReadings.userId, userId) : undefined;
    const rows = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(telemetryReadings)
      .where(conditions);
    return rows[0]?.count ?? 0;
  }, "getTelemetryCount");
  return result ?? 0;
}
