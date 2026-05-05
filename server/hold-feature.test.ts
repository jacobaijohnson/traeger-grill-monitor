import { describe, it, expect } from "vitest";
import {
  PRESET_PROGRAMS,
  resolveProgram,
  TRIGGER_CATALOG,
  type CookProgram,
  type ProgramStep,
  type StepTrigger,
} from "@shared/cook-programs";
import {
  HOLD_PRESETS,
  USDA_MIN_SAFE_TEMP,
  TRAEGER_MIN_TEMP,
  MAX_HOLD_TEMP,
  MIN_HOLD_TIME,
  MAX_HOLD_TIME,
  DEFAULT_HOLD_TEMP,
  DEFAULT_HOLD_TIME,
  DANGER_ZONE_ALERT_TEMP,
  validateHoldSettings,
  getHoldPreset,
  getHoldPresetsByCategory,
  formatHoldTime,
} from "@shared/hold-config";

// ─── Hold Configuration Constants ──────────────────────

describe("Hold Config — Safety Constants", () => {
  it("USDA minimum safe temp is 140°F", () => {
    expect(USDA_MIN_SAFE_TEMP).toBe(140);
  });

  it("Traeger minimum temp is 165°F", () => {
    expect(TRAEGER_MIN_TEMP).toBe(165);
  });

  it("Max hold temp is 200°F (above this is active cooking)", () => {
    expect(MAX_HOLD_TEMP).toBe(200);
  });

  it("Default hold temp matches Traeger Keep Warm (165°F)", () => {
    expect(DEFAULT_HOLD_TEMP).toBe(165);
  });

  it("Min hold time is 30 minutes", () => {
    expect(MIN_HOLD_TIME).toBe(1800);
  });

  it("Max hold time is 18 hours", () => {
    expect(MAX_HOLD_TIME).toBe(64800);
  });

  it("Default hold time is 4 hours", () => {
    expect(DEFAULT_HOLD_TIME).toBe(14400);
  });

  it("Danger zone alert temp is 145°F (5°F above USDA minimum)", () => {
    expect(DANGER_ZONE_ALERT_TEMP).toBe(145);
  });
});

// ─── Hold Settings Validation ──────────────────────────

describe("Hold Config — validateHoldSettings", () => {
  it("returns defaults when no input provided", () => {
    const result = validateHoldSettings({});
    expect(result.holdTemp).toBe(DEFAULT_HOLD_TEMP);
    expect(result.holdTime).toBe(DEFAULT_HOLD_TIME);
    expect(result.alertBelowTemp).toBe(DANGER_ZONE_ALERT_TEMP);
    expect(result.useKeepWarm).toBe(true);
  });

  it("clamps hold temp below Traeger minimum to 165°F", () => {
    const result = validateHoldSettings({ holdTemp: 100 });
    expect(result.holdTemp).toBe(TRAEGER_MIN_TEMP);
  });

  it("clamps hold temp above max to 200°F", () => {
    const result = validateHoldSettings({ holdTemp: 300 });
    expect(result.holdTemp).toBe(MAX_HOLD_TEMP);
  });

  it("clamps hold time below minimum to 30 minutes", () => {
    const result = validateHoldSettings({ holdTime: 60 });
    expect(result.holdTime).toBe(MIN_HOLD_TIME);
  });

  it("clamps hold time above maximum to 18 hours", () => {
    const result = validateHoldSettings({ holdTime: 100000 });
    expect(result.holdTime).toBe(MAX_HOLD_TIME);
  });

  it("clamps alert temp below USDA minimum to 140°F", () => {
    const result = validateHoldSettings({ alertBelowTemp: 100 });
    expect(result.alertBelowTemp).toBe(USDA_MIN_SAFE_TEMP);
  });

  it("accepts valid settings within range", () => {
    const result = validateHoldSettings({
      holdTemp: 180,
      holdTime: 28800, // 8 hours
      alertBelowTemp: 150,
      useKeepWarm: false,
    });
    expect(result.holdTemp).toBe(180);
    expect(result.holdTime).toBe(28800);
    expect(result.alertBelowTemp).toBe(150);
    expect(result.useKeepWarm).toBe(false);
  });
});

// ─── Hold Presets ──────────────────────────────────────

describe("Hold Config — Presets", () => {
  it("has at least 5 hold presets for different meats", () => {
    expect(HOLD_PRESETS.length).toBeGreaterThanOrEqual(5);
  });

  it("all presets have hold temps within Traeger-safe range", () => {
    for (const preset of HOLD_PRESETS) {
      expect(preset.holdTemp).toBeGreaterThanOrEqual(TRAEGER_MIN_TEMP);
      expect(preset.holdTemp).toBeLessThanOrEqual(MAX_HOLD_TEMP);
    }
  });

  it("all presets have min safe probe temp >= USDA minimum", () => {
    for (const preset of HOLD_PRESETS) {
      expect(preset.minSafeProbeTemp).toBeGreaterThanOrEqual(USDA_MIN_SAFE_TEMP);
    }
  });

  it("all presets have valid time ranges (min < recommended < max)", () => {
    for (const preset of HOLD_PRESETS) {
      expect(preset.minTime).toBeLessThan(preset.recommendedTime);
      expect(preset.recommendedTime).toBeLessThanOrEqual(preset.maxTime);
      expect(preset.minTime).toBeGreaterThanOrEqual(MIN_HOLD_TIME / 2); // Allow some flexibility
      expect(preset.maxTime).toBeLessThanOrEqual(MAX_HOLD_TIME);
    }
  });

  it("has brisket long hold preset", () => {
    const preset = HOLD_PRESETS.find(p => p.id === "brisket_long_hold");
    expect(preset).toBeDefined();
    expect(preset!.category).toBe("beef");
    expect(preset!.recommendedTime).toBeGreaterThanOrEqual(28800); // At least 8 hours
  });

  it("has brisket short hold preset", () => {
    const preset = HOLD_PRESETS.find(p => p.id === "brisket_short_hold");
    expect(preset).toBeDefined();
    expect(preset!.maxTime).toBeLessThanOrEqual(14400); // Max 4 hours for fully cooked
  });

  it("has pork butt hold preset", () => {
    const preset = HOLD_PRESETS.find(p => p.id === "pork_butt_hold");
    expect(preset).toBeDefined();
    expect(preset!.category).toBe("pork");
  });

  it("has poultry hold preset with higher safety temp", () => {
    const preset = HOLD_PRESETS.find(p => p.id === "poultry_hold");
    expect(preset).toBeDefined();
    expect(preset!.minSafeProbeTemp).toBeGreaterThanOrEqual(160); // Poultry needs higher
  });

  it("getHoldPreset finds brisket by category", () => {
    const preset = getHoldPreset("beef", "brisket");
    expect(preset).toBeDefined();
    expect(preset!.category).toBe("beef");
  });

  it("getHoldPreset finds pork by meat cut", () => {
    const preset = getHoldPreset(undefined, "pork butt");
    expect(preset).toBeDefined();
    expect(preset!.category).toBe("pork");
  });

  it("getHoldPresetsByCategory groups correctly", () => {
    const grouped = getHoldPresetsByCategory();
    expect(grouped["beef"]).toBeDefined();
    expect(grouped["pork"]).toBeDefined();
    expect(grouped["poultry"]).toBeDefined();
    expect(grouped["beef"].length).toBeGreaterThanOrEqual(2); // Long + short brisket
  });
});

// ─── Hold Time Formatting ──────────────────────────────

describe("Hold Config — formatHoldTime", () => {
  it("formats seconds-only", () => {
    expect(formatHoldTime(45)).toBe("0 min"); // rounds down
  });

  it("formats minutes", () => {
    expect(formatHoldTime(1800)).toBe("30 min");
  });

  it("formats hours", () => {
    expect(formatHoldTime(7200)).toBe("2 hr");
  });

  it("formats hours and minutes", () => {
    expect(formatHoldTime(5400)).toBe("1 hr 30 min");
  });

  it("formats max hold time (18 hours)", () => {
    expect(formatHoldTime(64800)).toBe("18 hr");
  });
});

// ─── Trigger Catalog — probe_temp_drop ─────────────────

describe("Trigger Catalog — probe_temp_drop", () => {
  it("probe_temp_drop is registered in TRIGGER_CATALOG", () => {
    const trigger = TRIGGER_CATALOG.find(t => t.type === "probe_temp_drop");
    expect(trigger).toBeDefined();
    expect(trigger!.label).toContain("Drop");
  });

  it("probe_temp_drop trigger type is valid in StepTrigger", () => {
    const trigger: StepTrigger = {
      type: "probe_temp_drop",
      value: 145,
    };
    expect(trigger.type).toBe("probe_temp_drop");
    expect(trigger.value).toBe(145);
  });

  it("probe_temp_drop works as secondary trigger", () => {
    const trigger: StepTrigger = {
      type: "timer",
      value: 14400,
      secondary: { type: "probe_temp_drop", value: 145 },
      logic: "or",
    };
    expect(trigger.secondary!.type).toBe("probe_temp_drop");
    expect(trigger.secondary!.value).toBe(145);
    expect(trigger.logic).toBe("or");
  });
});

// ─── Preset Programs — Hold Steps ──────────────────────

describe("Preset Programs — Hold Feature Integration", () => {
  it("Competition Brisket has hold_temp and hold_time variables", () => {
    const brisket = PRESET_PROGRAMS.find(p => p.name === "Competition Brisket");
    expect(brisket).toBeDefined();
    const holdTempVar = brisket!.variables?.find(v => v.name === "hold_temp");
    const holdTimeVar = brisket!.variables?.find(v => v.name === "hold_time");
    expect(holdTempVar).toBeDefined();
    expect(holdTimeVar).toBeDefined();
    expect(holdTempVar!.min).toBeGreaterThanOrEqual(TRAEGER_MIN_TEMP);
    expect(holdTempVar!.max).toBeLessThanOrEqual(MAX_HOLD_TEMP);
    expect(holdTimeVar!.min).toBeGreaterThanOrEqual(MIN_HOLD_TIME);
    expect(holdTimeVar!.max).toBeLessThanOrEqual(MAX_HOLD_TIME);
  });

  it("Competition Brisket has an Active Hold step", () => {
    const brisket = PRESET_PROGRAMS.find(p => p.name === "Competition Brisket");
    expect(brisket).toBeDefined();
    const holdStep = brisket!.steps.find(s => s.name === "Active Hold");
    expect(holdStep).toBeDefined();
    expect(holdStep!.trigger.type).toBe("timer");
    expect(holdStep!.trigger.secondary?.type).toBe("probe_temp_drop");
    expect(holdStep!.trigger.logic).toBe("or");
  });

  it("Competition Brisket Active Hold has keep_warm_on entry action", () => {
    const brisket = PRESET_PROGRAMS.find(p => p.name === "Competition Brisket");
    const holdStep = brisket!.steps.find(s => s.name === "Active Hold")!;
    const keepWarm = holdStep.entryActions?.find(a => a.type === "keep_warm_on");
    expect(keepWarm).toBeDefined();
  });

  it("Competition Brisket Active Hold has set_grill_temp entry action", () => {
    const brisket = PRESET_PROGRAMS.find(p => p.name === "Competition Brisket");
    const holdStep = brisket!.steps.find(s => s.name === "Active Hold")!;
    const setTemp = holdStep.entryActions?.find(a => a.type === "set_grill_temp");
    expect(setTemp).toBeDefined();
    expect(setTemp!.params?.temp).toBe("{{hold_temp}}");
  });

  it("Pulled Pork has hold_temp and hold_time variables", () => {
    const pork = PRESET_PROGRAMS.find(p => p.name === "Pulled Pork");
    expect(pork).toBeDefined();
    const holdTempVar = pork!.variables?.find(v => v.name === "hold_temp");
    const holdTimeVar = pork!.variables?.find(v => v.name === "hold_time");
    expect(holdTempVar).toBeDefined();
    expect(holdTimeVar).toBeDefined();
  });

  it("Pulled Pork has an Active Hold step with safety trigger", () => {
    const pork = PRESET_PROGRAMS.find(p => p.name === "Pulled Pork");
    const holdStep = pork!.steps.find(s => s.name === "Active Hold");
    expect(holdStep).toBeDefined();
    expect(holdStep!.trigger.secondary?.type).toBe("probe_temp_drop");
  });

  it("Active Hold (Any Meat) standalone program exists", () => {
    const holdProgram = PRESET_PROGRAMS.find(p => p.name === "Active Hold (Any Meat)");
    expect(holdProgram).toBeDefined();
    expect(holdProgram!.tags).toContain("hold");
    expect(holdProgram!.tags).toContain("food-safety");
  });

  it("Active Hold (Any Meat) has configurable safety_temp variable", () => {
    const holdProgram = PRESET_PROGRAMS.find(p => p.name === "Active Hold (Any Meat)")!;
    const safetyVar = holdProgram.variables?.find(v => v.name === "safety_temp");
    expect(safetyVar).toBeDefined();
    expect(safetyVar!.min).toBeGreaterThanOrEqual(USDA_MIN_SAFE_TEMP);
  });

  it("Active Hold (Any Meat) has configurable hold_temp and hold_time", () => {
    const holdProgram = PRESET_PROGRAMS.find(p => p.name === "Active Hold (Any Meat)")!;
    const holdTempVar = holdProgram.variables?.find(v => v.name === "hold_temp");
    const holdTimeVar = holdProgram.variables?.find(v => v.name === "hold_time");
    expect(holdTempVar).toBeDefined();
    expect(holdTimeVar).toBeDefined();
    expect(holdTempVar!.min).toBe(TRAEGER_MIN_TEMP);
    expect(holdTempVar!.max).toBe(MAX_HOLD_TEMP);
  });

  it("Active Hold (Any Meat) resolves variables correctly", () => {
    const holdProgram = PRESET_PROGRAMS.find(p => p.name === "Active Hold (Any Meat)")!;
    const vars: Record<string, string | number> = {
      hold_temp: 180,
      hold_time: 28800,
      safety_temp: 150,
      meat_type: "beef",
    };
    const resolved = resolveProgram(holdProgram, vars);
    const holdStep = resolved.find(s => s.name === "Active Hold");
    expect(holdStep).toBeDefined();

    // Timer trigger should be resolved
    expect(holdStep!.trigger.value).toBe(28800);

    // Secondary trigger should be resolved safety_temp
    expect(holdStep!.trigger.secondary?.value).toBe(150);

    // Entry action should have resolved hold_temp
    const setTemp = holdStep!.entryActions?.find(a => a.type === "set_grill_temp");
    expect(setTemp!.params?.temp).toBe(180);
  });
});

// ─── Safety Bounds ─────────────────────────────────────

describe("Hold Feature — Safety Bounds Enforcement", () => {
  it("hold_temp variable min is never below Traeger minimum (165°F)", () => {
    for (const program of PRESET_PROGRAMS) {
      const holdTempVar = program.variables?.find(v => v.name === "hold_temp");
      if (holdTempVar) {
        expect(holdTempVar.min).toBeGreaterThanOrEqual(TRAEGER_MIN_TEMP);
      }
    }
  });

  it("hold_temp variable max is never above MAX_HOLD_TEMP (200°F)", () => {
    for (const program of PRESET_PROGRAMS) {
      const holdTempVar = program.variables?.find(v => v.name === "hold_temp");
      if (holdTempVar) {
        expect(holdTempVar.max).toBeLessThanOrEqual(MAX_HOLD_TEMP);
      }
    }
  });

  it("safety_temp variable min is never below USDA minimum (140°F)", () => {
    for (const program of PRESET_PROGRAMS) {
      const safetyVar = program.variables?.find(v => v.name === "safety_temp");
      if (safetyVar) {
        expect(safetyVar.min).toBeGreaterThanOrEqual(USDA_MIN_SAFE_TEMP);
      }
    }
  });

  it("hold_time variable max is never above MAX_HOLD_TIME (18 hours)", () => {
    for (const program of PRESET_PROGRAMS) {
      const holdTimeVar = program.variables?.find(v => v.name === "hold_time");
      if (holdTimeVar) {
        expect(holdTimeVar.max).toBeLessThanOrEqual(MAX_HOLD_TIME);
      }
    }
  });

  it("all hold steps use probe_temp_drop as safety secondary trigger", () => {
    for (const program of PRESET_PROGRAMS) {
      const holdSteps = program.steps.filter(s => s.name.toLowerCase().includes("active hold"));
      for (const step of holdSteps) {
        expect(step.trigger.secondary).toBeDefined();
        expect(step.trigger.secondary!.type).toBe("probe_temp_drop");
        const safetyValue = typeof step.trigger.secondary!.value === "number"
          ? step.trigger.secondary!.value
          : 145; // Template variable defaults
        // If it's a number, it should be at or above USDA minimum
        if (typeof step.trigger.secondary!.value === "number") {
          expect(safetyValue).toBeGreaterThanOrEqual(USDA_MIN_SAFE_TEMP);
        }
      }
    }
  });
});
