import { describe, it, expect } from "vitest";
import { estimatePelletBurnRate, PELLET_BURN_RATES } from "../shared/traeger-types";

// ===== Pellet Burn Rate Estimation =====

describe("Pellet Burn Rate — estimatePelletBurnRate()", () => {
  it("returns low rate for temps <= 225°F", () => {
    expect(estimatePelletBurnRate(180)).toBe(PELLET_BURN_RATES.low);
    expect(estimatePelletBurnRate(225)).toBe(PELLET_BURN_RATES.low);
    expect(estimatePelletBurnRate(100)).toBe(PELLET_BURN_RATES.low);
  });

  it("returns medium rate for temps 226-300°F", () => {
    expect(estimatePelletBurnRate(226)).toBe(PELLET_BURN_RATES.medium);
    expect(estimatePelletBurnRate(275)).toBe(PELLET_BURN_RATES.medium);
    expect(estimatePelletBurnRate(300)).toBe(PELLET_BURN_RATES.medium);
  });

  it("returns high rate for temps > 300°F", () => {
    expect(estimatePelletBurnRate(301)).toBe(PELLET_BURN_RATES.high);
    expect(estimatePelletBurnRate(400)).toBe(PELLET_BURN_RATES.high);
    expect(estimatePelletBurnRate(500)).toBe(PELLET_BURN_RATES.high);
  });

  it("rates increase with temperature", () => {
    const low = estimatePelletBurnRate(200);
    const medium = estimatePelletBurnRate(275);
    const high = estimatePelletBurnRate(400);
    expect(medium).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(medium);
  });

  it("all rates are positive numbers", () => {
    expect(PELLET_BURN_RATES.low).toBeGreaterThan(0);
    expect(PELLET_BURN_RATES.medium).toBeGreaterThan(0);
    expect(PELLET_BURN_RATES.high).toBeGreaterThan(0);
  });
});

// ===== Pellet Consumption Summary — DB Shape Tests =====

describe("Pellet Analytics — Summary Shape (no DB)", () => {
  it("returns empty defaults for non-existent user", async () => {
    const { getPelletConsumptionSummary } = await import("./db");
    const result = await getPelletConsumptionSummary(99999);
    expect(result).toBeDefined();
    expect(result.totalLogsRecorded).toBe(0);
    expect(result.avgBurnRateLbsPerHr).toBeNull();
    expect(result.estimatedTotalLbsBurned).toBeNull();
    expect(result.lowestLevel).toBe(0);
    expect(result.highestLevel).toBe(0);
    expect(result.currentLevel).toBeNull();
    expect(result.burnRateByTemp).toEqual([]);
  });

  it("returns empty defaults when filtered by non-existent grillId", async () => {
    const { getPelletConsumptionSummary } = await import("./db");
    const result = await getPelletConsumptionSummary(99999, "nonexistent-grill-xyz");
    expect(result).toBeDefined();
    expect(result.totalLogsRecorded).toBe(0);
    expect(result.avgBurnRateLbsPerHr).toBeNull();
    expect(result.currentLevel).toBeNull();
    expect(result.burnRateByTemp).toEqual([]);
  });
});

describe("Pellet Analytics — Trend Shape (no DB)", () => {
  it("returns empty array for non-existent user", async () => {
    const { getPelletTrend } = await import("./db");
    const result = await getPelletTrend(99999);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("returns empty array when filtered by non-existent grillId", async () => {
    const { getPelletTrend } = await import("./db");
    const result = await getPelletTrend(99999, "nonexistent-grill-xyz", 30);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

describe("Pellet DB — Recent Logs Shape (no DB)", () => {
  it("returns empty array for non-existent user/grill", async () => {
    const { getRecentPelletLogs } = await import("./db");
    const result = await getRecentPelletLogs(99999, "nonexistent-grill-xyz");
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

describe("Pellet DB — Session Logs Shape (no DB)", () => {
  it("returns empty array for non-existent session", async () => {
    const { getPelletLogsForSession } = await import("./db");
    const result = await getPelletLogsForSession(99999, 99999);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

// ===== Multi-Grill Isolation — Analytics Queries =====

describe("Multi-Grill Isolation — Analytics accept grillId filter", () => {
  it("getCookAnalyticsSummary accepts optional grillId", async () => {
    const { getCookAnalyticsSummary } = await import("./db");
    // Without grillId
    const all = await getCookAnalyticsSummary(99999);
    expect(all).toBeDefined();
    expect(all.totalCooks).toBe(0);

    // With grillId — should also return empty for non-existent user
    const filtered = await getCookAnalyticsSummary(99999, "grill-abc-123");
    expect(filtered).toBeDefined();
    expect(filtered.totalCooks).toBe(0);
  });

  it("getCooksByMeatType accepts optional grillId", async () => {
    const { getCooksByMeatType } = await import("./db");
    const all = await getCooksByMeatType(99999);
    expect(Array.isArray(all)).toBe(true);
    const filtered = await getCooksByMeatType(99999, "grill-abc-123");
    expect(Array.isArray(filtered)).toBe(true);
  });

  it("getCooksByMethod accepts optional grillId", async () => {
    const { getCooksByMethod } = await import("./db");
    const all = await getCooksByMethod(99999);
    expect(Array.isArray(all)).toBe(true);
    const filtered = await getCooksByMethod(99999, "grill-abc-123");
    expect(Array.isArray(filtered)).toBe(true);
  });

  it("getCooksByMonth accepts optional grillId", async () => {
    const { getCooksByMonth } = await import("./db");
    const all = await getCooksByMonth(99999);
    expect(Array.isArray(all)).toBe(true);
    const filtered = await getCooksByMonth(99999, "grill-abc-123");
    expect(Array.isArray(filtered)).toBe(true);
  });

  it("getCooksByCut accepts optional grillId", async () => {
    const { getCooksByCut } = await import("./db");
    const all = await getCooksByCut(99999);
    expect(Array.isArray(all)).toBe(true);
    const filtered = await getCooksByCut(99999, "grill-abc-123");
    expect(Array.isArray(filtered)).toBe(true);
  });

  it("getRatingDistribution accepts optional grillId", async () => {
    const { getRatingDistribution } = await import("./db");
    const all = await getRatingDistribution(99999);
    expect(all.length).toBe(5);
    const filtered = await getRatingDistribution(99999, "grill-abc-123");
    expect(filtered.length).toBe(5);
  });
});

// ===== Multi-Grill Isolation — Cook Sessions =====

describe("Multi-Grill Isolation — Cook Sessions accept grillId filter", () => {
  it("getUserCookSessions accepts optional grillId", async () => {
    const { getUserCookSessions } = await import("./db");
    const all = await getUserCookSessions(99999);
    expect(Array.isArray(all)).toBe(true);
    const filtered = await getUserCookSessions(99999, "grill-abc-123");
    expect(Array.isArray(filtered)).toBe(true);
  });

  it("getActiveCookSession accepts optional grillId", async () => {
    const { getActiveCookSession } = await import("./db");
    const result = await getActiveCookSession(99999, "grill-abc-123");
    // Returns undefined when no active session found (withDbRetry returns undefined on empty result)
    expect(result).toBeFalsy();
  });
});

// ===== Router Input Validation — Pellet Endpoints =====

describe("Analytics Router — Pellet endpoints exist", () => {
  it("pelletSummary procedure exists on the router", async () => {
    const { appRouter } = await import("./routers");
    // Verify the procedure exists by checking the router shape
    expect((appRouter as any)._def.procedures["analytics.pelletSummary"]).toBeDefined();
  });

  it("pelletTrend procedure exists on the router", async () => {
    const { appRouter } = await import("./routers");
    expect((appRouter as any)._def.procedures["analytics.pelletTrend"]).toBeDefined();
  });
});

// ===== DSS-1 Guardrails =====

describe("DSS-1 Guardrails — No internal references in shared types", () => {
  it("PELLET_BURN_RATES contains only numeric values", () => {
    for (const [key, value] of Object.entries(PELLET_BURN_RATES)) {
      expect(typeof value).toBe("number");
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThan(10); // Reasonable range for lbs/hr
    }
  });

  it("estimatePelletBurnRate returns only numeric values", () => {
    // Test across the full temperature range
    for (let temp = 0; temp <= 600; temp += 50) {
      const rate = estimatePelletBurnRate(temp);
      expect(typeof rate).toBe("number");
      expect(rate).toBeGreaterThan(0);
    }
  });
});
