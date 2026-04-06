import { getDb, eq, and, gte, lte, sql } from "./connection";
import { lt } from "drizzle-orm";
import {
  telemetryReadings,
  type InsertTelemetryReading,
} from "../../drizzle/schema";

export async function insertTelemetry(data: InsertTelemetryReading) {
  const db = await getDb();
  if (!db) return;
  await db.insert(telemetryReadings).values(data);
}

export async function getTelemetryForSession(cookSessionId: number, limit = 1000, userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = userId
    ? and(eq(telemetryReadings.cookSessionId, cookSessionId), eq(telemetryReadings.userId, userId))
    : eq(telemetryReadings.cookSessionId, cookSessionId);
  return db
    .select()
    .from(telemetryReadings)
    .where(conditions)
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

/**
 * P2: Telemetry retention policy — delete readings older than the specified number of days.
 * Default: 90 days. Only deletes non-session telemetry (ambient readings).
 * Session-linked telemetry is preserved with the cook session.
 * Returns the number of deleted rows.
 */
export async function purgeStaleTelemetry(retentionDays = 90): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  try {
    // Delete old readings that are NOT tied to a cook session
    const result = await db
      .delete(telemetryReadings)
      .where(
        and(
          sql`${telemetryReadings.cookSessionId} IS NULL`,
          lt(telemetryReadings.recordedAt, cutoff)
        )
      );
    // MySQL delete returns [ResultSetHeader] with affectedRows
    const affectedRows = (result as unknown as [{ affectedRows: number }])?.[0]?.affectedRows ?? 0;
    console.log(`[Retention] Purged ${affectedRows} stale telemetry readings older than ${retentionDays} days`);
    return affectedRows;
  } catch (err) {
    console.error("[Retention] Failed to purge stale telemetry:", err);
    return 0;
  }
}

/**
 * Get total telemetry reading count for monitoring.
 */
export async function getTelemetryCount(userId?: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const conditions = userId ? eq(telemetryReadings.userId, userId) : undefined;
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(telemetryReadings)
    .where(conditions);
  return result[0]?.count ?? 0;
}
