import { getDb, withDbRetry, eq, and, gte, desc, sql } from "./connection";
import {
  pelletLogs,
  type InsertPelletLog,
} from "../../drizzle/schema";
import { estimatePelletBurnRate } from "@shared/traeger-types";

// ===== Pellet Log Persistence =====

export async function insertPelletLog(data: InsertPelletLog) {
  await withDbRetry(async (db) => {
    await db.insert(pelletLogs).values(data);
  }, "insertPelletLog");
}

/**
 * Get recent pellet logs for a specific grill.
 * Used for dashboard display and burn rate calculation.
 */
export async function getRecentPelletLogs(userId: number, grillId: string, minutes = 480) {
  return await withDbRetry(async (db) => {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return db
      .select()
      .from(pelletLogs)
      .where(
        and(
          eq(pelletLogs.userId, userId),
          eq(pelletLogs.grillId, grillId),
          gte(pelletLogs.recordedAt, since)
        )
      )
      .orderBy(pelletLogs.recordedAt)
      .limit(500);
  }, "getRecentPelletLogs") ?? [];
}

/**
 * Get pellet logs for a specific cook session.
 */
export async function getPelletLogsForSession(cookSessionId: number, userId: number) {
  return await withDbRetry(async (db) => {
    return db
      .select()
      .from(pelletLogs)
      .where(
        and(
          eq(pelletLogs.cookSessionId, cookSessionId),
          eq(pelletLogs.userId, userId)
        )
      )
      .orderBy(pelletLogs.recordedAt);
  }, "getPelletLogsForSession") ?? [];
}

// ===== Pellet Analytics =====

export interface PelletConsumptionSummary {
  totalLogsRecorded: number;
  avgBurnRateLbsPerHr: number | null;
  estimatedTotalLbsBurned: number | null;
  lowestLevel: number;
  highestLevel: number;
  currentLevel: number | null;
  burnRateByTemp: Array<{
    tempRange: string;
    avgBurnRate: number;
    sampleCount: number;
  }>;
}

/**
 * Get pellet consumption summary for a user (optionally filtered by grillId).
 */
export async function getPelletConsumptionSummary(
  userId: number,
  grillId?: string
): Promise<PelletConsumptionSummary> {
  const result = await withDbRetry(async (db) => {
    const conditions = grillId
      ? and(eq(pelletLogs.userId, userId), eq(pelletLogs.grillId, grillId))
      : eq(pelletLogs.userId, userId);

    const logs = await db
      .select()
      .from(pelletLogs)
      .where(conditions)
      .orderBy(pelletLogs.recordedAt);

    if (logs.length === 0) {
      return {
        totalLogsRecorded: 0,
        avgBurnRateLbsPerHr: null,
        estimatedTotalLbsBurned: null,
        lowestLevel: 0,
        highestLevel: 0,
        currentLevel: null,
        burnRateByTemp: [],
      };
    }

    const levels = logs.map(l => l.pelletLevel);
    const lowestLevel = Math.min(...levels);
    const highestLevel = Math.max(...levels);
    const currentLevel = logs[logs.length - 1].pelletLevel;

    // Calculate average burn rate from logs that have it
    const logsWithBurnRate = logs.filter(l => l.burnRateLbsPerHr !== null && l.burnRateLbsPerHr! > 0);
    const avgBurnRate = logsWithBurnRate.length > 0
      ? logsWithBurnRate.reduce((sum, l) => sum + (l.burnRateLbsPerHr ?? 0), 0) / logsWithBurnRate.length
      : null;

    // Estimate total lbs burned from level changes
    // Traeger hoppers typically hold ~18-20 lbs at 100%
    const HOPPER_CAPACITY_LBS = 18;
    let totalLbsBurned = 0;
    for (let i = 1; i < logs.length; i++) {
      const drop = logs[i - 1].pelletLevel - logs[i].pelletLevel;
      if (drop > 0) {
        totalLbsBurned += (drop / 100) * HOPPER_CAPACITY_LBS;
      }
    }

    // Burn rate by temperature range
    const tempBuckets = new Map<string, { totalRate: number; count: number }>();
    for (const log of logsWithBurnRate) {
      const temp = log.grillTemp ?? 0;
      let range: string;
      if (temp <= 225) range = "Low (≤225°F)";
      else if (temp <= 300) range = "Medium (226-300°F)";
      else if (temp <= 400) range = "High (301-400°F)";
      else range = "Very High (>400°F)";

      const bucket = tempBuckets.get(range) || { totalRate: 0, count: 0 };
      bucket.totalRate += log.burnRateLbsPerHr ?? 0;
      bucket.count++;
      tempBuckets.set(range, bucket);
    }

    const burnRateByTemp = Array.from(tempBuckets.entries())
      .map(([tempRange, data]) => ({
        tempRange,
        avgBurnRate: Math.round((data.totalRate / data.count) * 100) / 100,
        sampleCount: data.count,
      }));

    return {
      totalLogsRecorded: logs.length,
      avgBurnRateLbsPerHr: avgBurnRate !== null ? Math.round(avgBurnRate * 100) / 100 : null,
      estimatedTotalLbsBurned: totalLbsBurned > 0 ? Math.round(totalLbsBurned * 100) / 100 : null,
      lowestLevel,
      highestLevel,
      currentLevel,
      burnRateByTemp,
    };
  }, "getPelletConsumptionSummary");

  return result ?? {
    totalLogsRecorded: 0,
    avgBurnRateLbsPerHr: null,
    estimatedTotalLbsBurned: null,
    lowestLevel: 0,
    highestLevel: 0,
    currentLevel: null,
    burnRateByTemp: [],
  };
}

/**
 * Get pellet level trend data for charting (time-series).
 * Returns data points with pelletLevel, burnRate, and grillTemp over time.
 */
export async function getPelletTrend(
  userId: number,
  grillId?: string,
  days = 30
): Promise<Array<{ recordedAt: Date; pelletLevel: number; burnRateLbsPerHr: number | null; grillTemp: number | null }>> {
  return await withDbRetry(async (db) => {
    const since = new Date(Date.now() - days * 24 * 60 * 1000);
    const conditions = grillId
      ? and(eq(pelletLogs.userId, userId), eq(pelletLogs.grillId, grillId), gte(pelletLogs.recordedAt, since))
      : and(eq(pelletLogs.userId, userId), gte(pelletLogs.recordedAt, since));

    return db
      .select({
        recordedAt: pelletLogs.recordedAt,
        pelletLevel: pelletLogs.pelletLevel,
        burnRateLbsPerHr: pelletLogs.burnRateLbsPerHr,
        grillTemp: pelletLogs.grillTemp,
      })
      .from(pelletLogs)
      .where(conditions)
      .orderBy(pelletLogs.recordedAt)
      .limit(2000);
  }, "getPelletTrend") ?? [];
}

/**
 * Record pellet consumption from MQTT telemetry.
 * Called periodically when telemetry has pellet level data.
 * Calculates burn rate from the previous reading.
 */
export async function persistPelletFromMqtt(
  userId: number,
  grillId: string,
  pelletLevel: number,
  grillTemp: number,
  cookSessionId?: number
) {
  // Get the most recent pellet log to calculate burn rate
  const recent = await withDbRetry(async (db) => {
    return db
      .select()
      .from(pelletLogs)
      .where(
        and(
          eq(pelletLogs.userId, userId),
          eq(pelletLogs.grillId, grillId)
        )
      )
      .orderBy(desc(pelletLogs.recordedAt))
      .limit(1);
  }, "getLastPelletLog");

  let burnRate: number | null = null;
  const HOPPER_CAPACITY_LBS = 18;

  if (recent && recent.length > 0) {
    const prev = recent[0];
    const timeDiffHrs = (Date.now() - new Date(prev.recordedAt).getTime()) / (1000 * 60 * 60);
    const levelDrop = prev.pelletLevel - pelletLevel;

    // Only calculate burn rate if level dropped and time elapsed is reasonable
    if (levelDrop > 0 && timeDiffHrs > 0.01 && timeDiffHrs < 4) {
      const lbsBurned = (levelDrop / 100) * HOPPER_CAPACITY_LBS;
      burnRate = Math.round((lbsBurned / timeDiffHrs) * 100) / 100;
    } else if (levelDrop <= 0) {
      // Level same or increased (refill) — use estimated rate from temperature
      burnRate = estimatePelletBurnRate(grillTemp);
    }
  }

  const estimatedLbs = (pelletLevel / 100) * HOPPER_CAPACITY_LBS;

  await insertPelletLog({
    userId,
    grillId,
    cookSessionId: cookSessionId ?? null,
    pelletLevel,
    estimatedLbs: Math.round(estimatedLbs * 100) / 100,
    burnRateLbsPerHr: burnRate,
    grillTemp,
  });
}
