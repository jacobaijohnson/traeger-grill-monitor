import { getDb, withDbRetry, eq, and, desc } from "./connection";
import { cookSessions } from "../../drizzle/schema";

// ===== Analytics Interfaces =====

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

// ===== Analytics Queries =====

const EMPTY_SUMMARY: CookAnalyticsSummary = {
  totalCooks: 0, completedCooks: 0, cancelledCooks: 0,
  totalCookMinutes: 0, avgCookMinutes: 0, avgRating: null,
  ratedCooks: 0, bestRatedCook: null, longestCook: null,
};

export async function getCookAnalyticsSummary(userId: number, grillId?: string): Promise<CookAnalyticsSummary> {
  const result = await withDbRetry(async (db) => {
    const conditions = grillId
      ? and(eq(cookSessions.userId, userId), eq(cookSessions.grillId, grillId))
      : eq(cookSessions.userId, userId);
    const sessions = await db
      .select()
      .from(cookSessions)
      .where(conditions)
      .orderBy(desc(cookSessions.startedAt));

    if (sessions.length === 0) return EMPTY_SUMMARY;

    const completed = sessions.filter(s => s.status === "completed");
    const cancelled = sessions.filter(s => s.status === "cancelled");
    const rated = sessions.filter(s => s.rating !== null && s.rating !== undefined);

    let totalMinutes = 0;
    let longestCook: CookAnalyticsSummary["longestCook"] = null;
    let longestDuration = 0;

    for (const s of sessions) {
      if (s.endedAt && s.startedAt) {
        const dur = (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000;
        if (dur > 0 && dur < 48 * 60) {
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
  }, "getCookAnalyticsSummary");
  return result ?? EMPTY_SUMMARY;
}

export async function getCooksByMeatType(userId: number, grillId?: string): Promise<CookByMeatType[]> {
  return await withDbRetry(async (db) => {
    const conditions = grillId
      ? and(eq(cookSessions.userId, userId), eq(cookSessions.grillId, grillId))
      : eq(cookSessions.userId, userId);
    const sessions = await db.select().from(cookSessions).where(conditions);
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
  }, "getCooksByMeatType") ?? [];
}

export async function getCooksByMethod(userId: number, grillId?: string): Promise<CookByMethod[]> {
  return await withDbRetry(async (db) => {
    const conditions = grillId
      ? and(eq(cookSessions.userId, userId), eq(cookSessions.grillId, grillId))
      : eq(cookSessions.userId, userId);
    const sessions = await db.select().from(cookSessions).where(conditions);
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
  }, "getCooksByMethod") ?? [];
}

export async function getCooksByMonth(userId: number, grillId?: string): Promise<CookByMonth[]> {
  return await withDbRetry(async (db) => {
    const conditions = grillId
      ? and(eq(cookSessions.userId, userId), eq(cookSessions.grillId, grillId))
      : eq(cookSessions.userId, userId);
    const sessions = await db
      .select()
      .from(cookSessions)
      .where(conditions)
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
  }, "getCooksByMonth") ?? [];
}

export async function getCooksByCut(userId: number, grillId?: string): Promise<CookByCut[]> {
  return await withDbRetry(async (db) => {
    const conditions = grillId
      ? and(eq(cookSessions.userId, userId), eq(cookSessions.grillId, grillId))
      : eq(cookSessions.userId, userId);
    const sessions = await db.select().from(cookSessions).where(conditions);
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
  }, "getCooksByCut") ?? [];
}

export async function getRatingDistribution(userId: number, grillId?: string): Promise<RatingDistribution[]> {
  return await withDbRetry(async (db) => {
    const conditions = grillId
      ? and(eq(cookSessions.userId, userId), eq(cookSessions.grillId, grillId))
      : eq(cookSessions.userId, userId);
    const sessions = await db.select().from(cookSessions).where(conditions);
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
  }, "getRatingDistribution") ?? [];
}
