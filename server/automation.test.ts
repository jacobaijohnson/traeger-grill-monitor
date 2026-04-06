import { describe, it, expect } from "vitest";
import {
  PRESET_PROGRAMS,
  resolveProgram,
  resolveVariable,
  ACTION_CATALOG,
  TRIGGER_CATALOG,
  DONENESS_TEMPS,
  type CookProgram,
  type ProgramStep,
  type ProgramVariable,
} from "@shared/cook-programs";

// ─── Variable Resolution ───────────────────────────────

describe("Variable Resolution", () => {
  it("resolves a simple number variable", () => {
    const vars: Record<string, string | number> = { smoke_temp: 180 };
    expect(resolveVariable("{{smoke_temp}}", vars)).toBe(180);
  });

  it("resolves a simple string variable", () => {
    const vars: Record<string, string | number> = { doneness: "medium_rare" };
    expect(resolveVariable("{{doneness}}", vars)).toBe("medium_rare");
  });

  it("returns original value when no variable match", () => {
    const vars: Record<string, string | number> = {};
    expect(resolveVariable("{{unknown_var}}", vars)).toBe("{{unknown_var}}");
  });

  it("returns non-template values unchanged", () => {
    const vars: Record<string, string | number> = { smoke_temp: 180 };
    expect(resolveVariable(225, vars)).toBe(225);
    expect(resolveVariable("plain text", vars)).toBe("plain text");
  });

  it("resolves variables within a full program step (integration)", () => {
    const brisket = PRESET_PROGRAMS.find((p) => p.name === "Competition Brisket")!;
    const vars: Record<string, string | number> = {
      smoke_temp: 190,
      crank_temp: 240,
      wrap_point: 165,
      pull_temp: 203,
      meat_weight_lbs: 14,
    };
    const resolvedSteps = resolveProgram(brisket, vars);
    // First step entry action should have resolved smoke_temp
    const setTemp = resolvedSteps[0].entryActions?.find((a) => a.type === "set_grill_temp");
    expect(setTemp!.params?.temp).toBe(190);
    // First step trigger should be resolved wrap_point
    expect(resolvedSteps[0].trigger.value).toBe(165);
    // Second step entry action should have resolved crank_temp
    const crankTemp = resolvedSteps[1].entryActions?.find((a) => a.type === "set_grill_temp");
    expect(crankTemp!.params?.temp).toBe(240);
  });
});

// ─── Program Resolution ────────────────────────────────

describe("Program Resolution (resolveProgram)", () => {
  it("resolves the Competition Brisket preset with default variables", () => {
    const brisket = PRESET_PROGRAMS.find((p) => p.name === "Competition Brisket");
    expect(brisket).toBeDefined();

    // Build default variable values
    const defaults: Record<string, string | number> = {};
    for (const v of brisket!.variables || []) {
      defaults[v.name] = v.default;
    }

    const resolvedSteps = resolveProgram(brisket!, defaults);
    expect(resolvedSteps.length).toBe(brisket!.steps.length);

    // First step should have entry action with resolved temp
    const firstStep = resolvedSteps[0];
    expect(firstStep.entryActions).toBeDefined();
    const setTempAction = firstStep.entryActions?.find((a) => a.type === "set_grill_temp");
    expect(setTempAction).toBeDefined();
    expect(setTempAction!.params?.temp).toBe(180); // default smoke_temp
  });

  it("resolves with custom variable overrides", () => {
    const brisket = PRESET_PROGRAMS.find((p) => p.name === "Competition Brisket");
    expect(brisket).toBeDefined();

    const customVars: Record<string, string | number> = {
      smoke_temp: 200,
      crank_temp: 250,
      wrap_point: 170,
      pull_temp: 205,
      meat_weight_lbs: 15,
    };

    const resolvedSteps = resolveProgram(brisket!, customVars);
    const firstStep = resolvedSteps[0];
    const setTempAction = firstStep.entryActions?.find((a) => a.type === "set_grill_temp");
    expect(setTempAction!.params?.temp).toBe(200); // custom smoke_temp

    // Trigger should be resolved too
    expect(firstStep.trigger.value).toBe(170); // custom wrap_point
  });

  it("resolves timer-based programs (Pork Belly Burnt Ends)", () => {
    const burntEnds = PRESET_PROGRAMS.find((p) => p.name === "Pork Belly Burnt Ends");
    expect(burntEnds).toBeDefined();

    const defaults: Record<string, string | number> = {};
    for (const v of burntEnds!.variables || []) {
      defaults[v.name] = v.default;
    }

    const resolvedSteps = resolveProgram(burntEnds!, defaults);
    expect(resolvedSteps.length).toBe(3); // smoke, braise, glaze

    // First step timer should be resolved
    const smokeStep = resolvedSteps[0];
    expect(smokeStep.trigger.value).toBe(10800); // default smoke_time
  });
});

// ─── Preset Library Validation ─────────────────────────

describe("Preset Library", () => {
  it("has at least 10 preset programs", () => {
    expect(PRESET_PROGRAMS.length).toBeGreaterThanOrEqual(10);
  });

  it("all presets have required fields", () => {
    for (const preset of PRESET_PROGRAMS) {
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.category).toBeTruthy();
      expect(preset.method).toBeTruthy();
      expect(preset.steps.length).toBeGreaterThan(0);
    }
  });

  it("all preset steps have valid trigger types", () => {
    const validTriggers = TRIGGER_CATALOG.map((t) => t.type);
    for (const preset of PRESET_PROGRAMS) {
      for (const step of preset.steps) {
        expect(validTriggers).toContain(step.trigger.type);
      }
    }
  });

  it("all preset step actions have valid action types", () => {
    const validActions = ACTION_CATALOG.map((a) => a.type);
    for (const preset of PRESET_PROGRAMS) {
      for (const step of preset.steps) {
        for (const action of step.entryActions || []) {
          expect(validActions).toContain(action.type);
        }
        for (const action of step.actions || []) {
          expect(validActions).toContain(action.type);
        }
        if (step.alertOnTrigger) {
          expect(["alarm", "notification"]).toContain(step.alertOnTrigger.type);
        }
      }
    }
  });

  it("all preset variables have valid types", () => {
    for (const preset of PRESET_PROGRAMS) {
      for (const v of preset.variables || []) {
        expect(["number", "enum", "text"]).toContain(v.type);
        expect(v.name).toBeTruthy();
        expect(v.label).toBeTruthy();
        expect(v.default).toBeDefined();
      }
    }
  });

  it("covers all expected categories", () => {
    const categories = new Set(PRESET_PROGRAMS.map((p) => p.category));
    expect(categories.has("beef")).toBe(true);
    expect(categories.has("pork")).toBe(true);
    expect(categories.has("poultry")).toBe(true);
    expect(categories.has("seafood")).toBe(true);
  });

  it("covers all expected methods", () => {
    const methods = new Set(PRESET_PROGRAMS.map((p) => p.method));
    expect(methods.has("smoke")).toBe(true);
    expect(methods.has("grill")).toBe(true);
  });

  it("Competition Brisket has the correct multi-phase structure", () => {
    const brisket = PRESET_PROGRAMS.find((p) => p.name === "Competition Brisket");
    expect(brisket).toBeDefined();
    expect(brisket!.steps.length).toBe(3); // Low & Slow, The Crank, Rest Hold
    expect(brisket!.steps[0].name).toBe("Low & Slow");
    expect(brisket!.steps[1].name).toBe("The Crank");
    expect(brisket!.steps[2].name).toBe("Rest Hold");

    // First step should have alarm on trigger
    expect(brisket!.steps[0].alertOnTrigger?.type).toBe("alarm");

    // The Crank step (index 1) fires actions that set grill to 165°F when probe hits pull_temp
    const crankStep = brisket!.steps[1];
    const setTempAction = crankStep.actions?.find((a) => a.type === "set_grill_temp");
    expect(setTempAction).toBeDefined();
    expect(setTempAction!.params?.temp).toBe(165); // lowest Traeger temp — auto-step-down

    // Rest Hold step has manual trigger (user ends when ready)
    const restStep = brisket!.steps[2];
    expect(restStep.trigger.type).toBe("manual");
  });

  it("Reverse Sear Steak has sear phase with max temp", () => {
    const steak = PRESET_PROGRAMS.find((p) => p.name === "Reverse Sear Steak");
    expect(steak).toBeDefined();
    // The "Rest & Preheat" step sets the grill to sear temp
    const preheatStep = steak!.steps.find((s) => s.name === "Rest & Preheat");
    expect(preheatStep).toBeDefined();
    const setTemp = preheatStep!.entryActions?.find((a) => a.type === "set_grill_temp");
    expect(setTemp).toBeDefined();
    // Should use variable reference for sear temp
    expect(setTemp!.params?.temp).toBe("{{sear_temp}}");

    // Sear step should be timer-based
    const searStep = steak!.steps.find((s) => s.name === "Sear");
    expect(searStep).toBeDefined();
    expect(searStep!.trigger.type).toBe("timer");
  });

  it("Baby Back Ribs follows 3-2-1 method", () => {
    const ribs = PRESET_PROGRAMS.find((p) => p.name === "Baby Back Ribs (3-2-1)");
    expect(ribs).toBeDefined();
    expect(ribs!.steps.length).toBe(3); // Smoke, Wrap, Sauce & Finish
  });
});

// ─── Action & Trigger Catalogs ─────────────────────────

describe("Action Catalog", () => {
  it("has all expected hardware actions", () => {
    const types = ACTION_CATALOG.map((a) => a.type);
    expect(types).toContain("set_grill_temp");
    expect(types).toContain("set_probe_alarm");
    expect(types).toContain("set_timer");
    expect(types).toContain("clear_timer");
    expect(types).toContain("super_smoke_on");
    expect(types).toContain("super_smoke_off");
    expect(types).toContain("keep_warm_on");
    expect(types).toContain("keep_warm_off");
    expect(types).toContain("shutdown");
  });

  it("has all expected alert actions", () => {
    const types = ACTION_CATALOG.map((a) => a.type);
    expect(types).toContain("send_notification");
    expect(types).toContain("sound_alarm");
    expect(types).toContain("escalating_alarm");
  });

  it("has flow control actions", () => {
    const types = ACTION_CATALOG.map((a) => a.type);
    expect(types).toContain("wait_for_ack");
  });

  it("has software actions", () => {
    const types = ACTION_CATALOG.map((a) => a.type);
    expect(types).toContain("log_event");
    expect(types).toContain("end_session");
  });

  it("all actions have labels and categories", () => {
    for (const action of ACTION_CATALOG) {
      expect(action.type).toBeTruthy();
      expect(action.label).toBeTruthy();
      expect(action.category).toBeTruthy();
      expect(["hardware", "alert", "flow", "software"]).toContain(action.category);
    }
  });
});

describe("Trigger Catalog", () => {
  it("has all expected trigger types", () => {
    const types = TRIGGER_CATALOG.map((t) => t.type);
    expect(types).toContain("probe_temp");
    expect(types).toContain("probe_temp_drop");
    expect(types).toContain("grill_temp");
    expect(types).toContain("grill_temp_drop");
    expect(types).toContain("timer");
    expect(types).toContain("pellet_low");
    expect(types).toContain("manual");
    expect(types).toContain("immediate");
  });

  it("all triggers have labels and descriptions", () => {
    for (const trigger of TRIGGER_CATALOG) {
      expect(trigger.type).toBeTruthy();
      expect(trigger.label).toBeTruthy();
      expect(trigger.description).toBeTruthy();
    }
  });
});

// ─── Doneness Temps ────────────────────────────────────

describe("Doneness Temperature Map", () => {
  it("has entries for common meats", () => {
    expect(DONENESS_TEMPS.beef).toBeDefined();
    expect(DONENESS_TEMPS.pork).toBeDefined();
    expect(DONENESS_TEMPS.poultry).toBeDefined();
  });

  it("beef doneness temps are in ascending order", () => {
    const beef = DONENESS_TEMPS.beef;
    const keys = Object.keys(beef);
    const temps = keys.map((k) => beef[k]);
    for (let i = 1; i < temps.length; i++) {
      expect(temps[i]).toBeGreaterThanOrEqual(temps[i - 1]);
    }
  });
});
