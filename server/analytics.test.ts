import { describe, it, expect } from "vitest";
import {
  CUT_CATEGORIES,
  ALL_CUTS,
  getCutsByCategory,
  getCutById,
  searchCuts,
  buildCookConfig,
  getDefaultDoneness,
  estimateCookTime,
  type CutDefinition,
} from "../shared/cut-catalog";

// ===== Cut Catalog Data Integrity =====

describe("Cut Catalog — Data Integrity", () => {
  it("should have at least 5 categories", () => {
    expect(CUT_CATEGORIES.length).toBeGreaterThanOrEqual(5);
  });

  it("every category should have at least 2 cuts", () => {
    for (const cat of CUT_CATEGORIES) {
      const cuts = getCutsByCategory(cat.id);
      expect(cuts.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("every cut should have a unique ID globally", () => {
    const ids = ALL_CUTS.map(c => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("getCutById returns the correct cut", () => {
    const firstCut = ALL_CUTS[0];
    const found = getCutById(firstCut.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(firstCut.id);
    expect(found!.name).toBe(firstCut.name);
  });

  it("getCutById returns undefined for non-existent cut", () => {
    const found = getCutById("nonexistent-cut-xyz");
    expect(found).toBeUndefined();
  });
});

// ===== Doneness Levels =====

describe("Cut Catalog — Doneness Levels", () => {
  it("every cut should have at least one doneness level", () => {
    for (const cut of ALL_CUTS) {
      expect(cut.doneness.length).toBeGreaterThan(0);
    }
  });

  it("beef doneness pull temps should be in reasonable range (115-210°F)", () => {
    const beefCuts = getCutsByCategory("beef");
    for (const cut of beefCuts) {
      for (const level of cut.doneness) {
        expect(level.pullTemp).toBeGreaterThanOrEqual(115);
        expect(level.pullTemp).toBeLessThanOrEqual(210);
      }
    }
  });

  it("poultry should have safe minimum final temps (165°F+)", () => {
    const poultryCuts = getCutsByCategory("poultry");
    for (const cut of poultryCuts) {
      for (const level of cut.doneness) {
        expect(level.finalTemp).toBeGreaterThanOrEqual(165);
      }
    }
  });

  it("getDefaultDoneness returns a valid level", () => {
    for (const cut of ALL_CUTS) {
      const def = getDefaultDoneness(cut);
      expect(def).toBeDefined();
      expect(def.id).toBeTruthy();
      expect(def.pullTemp).toBeGreaterThan(0);
    }
  });
});

// ===== Thickness & Weight =====

describe("Cut Catalog — Thickness & Weight", () => {
  it("thickness options should have valid multipliers", () => {
    for (const cut of ALL_CUTS) {
      if (cut.thicknessOptions) {
        for (const opt of cut.thicknessOptions) {
          expect(opt.id).toBeTruthy();
          expect(opt.label).toBeTruthy();
          expect(opt.inches).toBeGreaterThan(0);
          expect(opt.timeMultiplier).toBeGreaterThan(0);
        }
      }
    }
  });

  it("weight-relevant cuts should have timePerPoundMinutes", () => {
    for (const cut of ALL_CUTS) {
      if (cut.weightRelevant) {
        expect(cut.timePerPoundMinutes).toBeDefined();
        expect(cut.timePerPoundMinutes!).toBeGreaterThan(0);
      }
    }
  });
});

// ===== Cook Config Builder =====

describe("Cut Catalog — Cook Config Builder", () => {
  it("should build a valid cook config for a basic beef cut", () => {
    const beefCuts = getCutsByCategory("beef");
    expect(beefCuts.length).toBeGreaterThan(0);
    const cut = beefCuts[0];
    const config = buildCookConfig(cut);

    expect(config).toBeDefined();
    expect(config.cutId).toBe(cut.id);
    expect(config.cutName).toBe(cut.name);
    expect(config.category).toBe("beef");
    expect(config.grillTemp).toBeGreaterThan(0);
    expect(config.pullTemp).toBeGreaterThan(0);
    expect(config.finalTemp).toBeGreaterThan(0);
    expect(config.estimatedTime).toBeTruthy();
  });

  it("should respect doneness override", () => {
    const beefCuts = getCutsByCategory("beef");
    const cut = beefCuts.find(c => c.doneness.length >= 2);
    if (!cut) return;

    const first = buildCookConfig(cut, cut.doneness[0].id);
    const last = buildCookConfig(cut, cut.doneness[cut.doneness.length - 1].id);

    expect(first.donenessId).toBe(cut.doneness[0].id);
    expect(last.donenessId).toBe(cut.doneness[cut.doneness.length - 1].id);
    // Higher doneness = higher temp (generally)
    expect(last.finalTemp).toBeGreaterThanOrEqual(first.finalTemp);
  });

  it("should respect grill temp override", () => {
    const cut = ALL_CUTS[0];
    const config = buildCookConfig(cut, undefined, undefined, undefined, 400);
    expect(config.grillTemp).toBe(400);
  });

  it("should respect method override", () => {
    const cut = ALL_CUTS[0];
    const config = buildCookConfig(cut, undefined, undefined, undefined, undefined, "reverse_sear");
    expect(config.method).toBe("reverse_sear");
  });

  it("should include stall and rest info", () => {
    for (const cut of ALL_CUTS) {
      const config = buildCookConfig(cut);
      expect(typeof config.hasStall).toBe("boolean");
      expect(typeof config.wrapRecommended).toBe("boolean");
      expect(typeof config.restMinutes).toBe("number");
      expect(config.restMinutes).toBeGreaterThanOrEqual(0);
    }
  });
});

// ===== Search =====

describe("Cut Catalog — Search", () => {
  it("should find cuts by name", () => {
    const results = searchCuts("ribeye");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.name.toLowerCase().includes("ribeye"))).toBe(true);
  });

  it("should return empty for gibberish query", () => {
    const results = searchCuts("xyznonexistent123");
    expect(results.length).toBe(0);
  });

  it("should be case insensitive", () => {
    const lower = searchCuts("brisket");
    const upper = searchCuts("BRISKET");
    expect(lower.length).toBe(upper.length);
  });

  it("should filter by category when provided", () => {
    const results = searchCuts("", "beef");
    const beefCuts = getCutsByCategory("beef");
    expect(results.length).toBe(beefCuts.length);
  });
});

// ===== Analytics Query Shape Tests =====
// These test the analytics helper functions' return types and edge cases
// without requiring a real database connection.

describe("Analytics — Summary Shape (no DB)", () => {
  it("should return empty defaults when no database", async () => {
    const { getCookAnalyticsSummary } = await import("./db");
    const result = await getCookAnalyticsSummary(99999);
    expect(result).toBeDefined();
    expect(result.totalCooks).toBe(0);
    expect(result.completedCooks).toBe(0);
    expect(result.cancelledCooks).toBe(0);
    expect(result.totalCookMinutes).toBe(0);
    expect(result.avgCookMinutes).toBe(0);
    expect(result.avgRating).toBeNull();
    expect(result.ratedCooks).toBe(0);
    expect(result.bestRatedCook).toBeNull();
    expect(result.longestCook).toBeNull();
  });
});

describe("Analytics — By Meat Type (no DB)", () => {
  it("should return empty array when no database", async () => {
    const { getCooksByMeatType } = await import("./db");
    const result = await getCooksByMeatType(99999);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

describe("Analytics — By Method (no DB)", () => {
  it("should return empty array when no database", async () => {
    const { getCooksByMethod } = await import("./db");
    const result = await getCooksByMethod(99999);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

describe("Analytics — By Month (no DB)", () => {
  it("should return empty array when no database", async () => {
    const { getCooksByMonth } = await import("./db");
    const result = await getCooksByMonth(99999);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

describe("Analytics — By Cut (no DB)", () => {
  it("should return empty array when no database", async () => {
    const { getCooksByCut } = await import("./db");
    const result = await getCooksByCut(99999);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

describe("Analytics — Rating Distribution (no DB)", () => {
  it("should return empty array when no database", async () => {
    const { getRatingDistribution } = await import("./db");
    const result = await getRatingDistribution(99999);
    expect(Array.isArray(result)).toBe(true);
    // getRatingDistribution initializes 1-5 buckets even with no data
    // so it returns 5 entries with count=0
    expect(result.length).toBe(5);
    for (const r of result) {
      expect(r.count).toBe(0);
      expect(r.rating).toBeGreaterThanOrEqual(1);
      expect(r.rating).toBeLessThanOrEqual(5);
    }
  });
});
