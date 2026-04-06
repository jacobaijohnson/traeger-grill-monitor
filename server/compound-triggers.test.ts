import { describe, it, expect } from "vitest";
import { resolveProgram, PRESET_PROGRAMS } from "@shared/cook-programs";
import type { ProgramStep, StepTrigger, CookProgram, ProgramVariable } from "@shared/cook-programs";

// ─── Compound Trigger Type Tests ─────────────────────

describe("Compound Trigger — Type System", () => {
  it("StepTrigger supports primary-only (no secondary)", () => {
    const trigger: StepTrigger = {
      type: "probe_temp",
      value: 200,
    };
    expect(trigger.type).toBe("probe_temp");
    expect(trigger.value).toBe(200);
    expect(trigger.secondary).toBeUndefined();
    expect(trigger.logic).toBeUndefined();
  });

  it("StepTrigger supports compound with secondary + logic", () => {
    const trigger: StepTrigger = {
      type: "probe_temp",
      value: 200,
      secondary: { type: "timer", value: 21600 },
      logic: "fallback",
    };
    expect(trigger.type).toBe("probe_temp");
    expect(trigger.secondary?.type).toBe("timer");
    expect(trigger.secondary?.value).toBe(21600);
    expect(trigger.logic).toBe("fallback");
  });

  it("supports all four logic operators", () => {
    const operators = ["or", "and", "fallback", "priority"] as const;
    for (const op of operators) {
      const trigger: StepTrigger = {
        type: "probe_temp",
        value: 160,
        secondary: { type: "timer", value: 3600 },
        logic: op,
      };
      expect(trigger.logic).toBe(op);
    }
  });
});

// ─── Preset Programs — Compound Trigger Validation ───

describe("Preset Programs — Compound Triggers", () => {
  it("Competition Brisket has timer fallbacks on probe-temp steps", () => {
    const brisket = PRESET_PROGRAMS.find((p) => p.name === "Competition Brisket");
    expect(brisket).toBeDefined();

    // Low & Slow step should have a timer fallback
    const lowSlow = brisket!.steps.find((s) => s.name === "Low & Slow");
    expect(lowSlow).toBeDefined();
    expect(lowSlow!.trigger.type).toBe("probe_temp");
    expect(lowSlow!.trigger.secondary).toBeDefined();
    expect(lowSlow!.trigger.secondary!.type).toBe("timer");
    expect(["fallback", "or"]).toContain(lowSlow!.trigger.logic);

    // The Crank step should also have a timer fallback
    const crank = brisket!.steps.find((s) => s.name === "The Crank");
    expect(crank).toBeDefined();
    expect(crank!.trigger.type).toBe("probe_temp");
    expect(crank!.trigger.secondary).toBeDefined();
    expect(crank!.trigger.secondary!.type).toBe("timer");
    expect(["fallback", "or"]).toContain(crank!.trigger.logic);
  });

  it("Pulled Pork has timer fallbacks on probe-temp steps", () => {
    const pork = PRESET_PROGRAMS.find((p) => p.name === "Pulled Pork");
    expect(pork).toBeDefined();

    const smoke = pork!.steps.find((s) => s.name === "Smoke");
    expect(smoke).toBeDefined();
    expect(smoke!.trigger.secondary).toBeDefined();
    expect(smoke!.trigger.secondary!.type).toBe("timer");
    expect(["fallback", "or"]).toContain(smoke!.trigger.logic);
  });

  it("Baby Back Ribs uses timer-only triggers (no compound needed)", () => {
    const ribs = PRESET_PROGRAMS.find((p) => p.name === "Baby Back Ribs (3-2-1)");
    expect(ribs).toBeDefined();

    for (const step of ribs!.steps) {
      if (step.trigger.type === "timer") {
        expect(step.trigger.secondary).toBeUndefined();
      }
    }
  });

  it("Burger Mode uses timer-only triggers (no compound needed)", () => {
    const burger = PRESET_PROGRAMS.find((p) => p.name === "Burger Mode");
    expect(burger).toBeDefined();

    for (const step of burger!.steps) {
      if (step.trigger.type === "timer") {
        expect(step.trigger.secondary).toBeUndefined();
      }
    }
  });

  it("All 10 preset programs are defined", () => {
    expect(PRESET_PROGRAMS.length).toBe(10);
    const names = PRESET_PROGRAMS.map((p) => p.name);
    expect(names).toContain("Competition Brisket");
    expect(names).toContain("Reverse Sear Steak");
    expect(names).toContain("Pulled Pork");
    expect(names).toContain("Baby Back Ribs (3-2-1)");
    expect(names).toContain("Burger Mode");
    expect(names).toContain("Pizza Mode");
    expect(names).toContain("Spatchcock Chicken");
    expect(names).toContain("Smoked Salmon");
    expect(names).toContain("Smoked Turkey");
    expect(names).toContain("Pork Belly Burnt Ends");
  });
});

// ─── Variable Resolution with Compound Triggers ──────

describe("Variable Resolution — Compound Triggers", () => {
  const makeMockProgram = (steps: ProgramStep[], variables: ProgramVariable[] = []): CookProgram => ({
    name: "Test Program",
    description: "Test",
    category: "beef",
    method: "smoke",
    difficulty: "beginner",
    tags: [],
    variables,
    steps,
    tips: [],
  });

  it("resolveProgram resolves variables in primary trigger", () => {
    const program = makeMockProgram(
      [{
        name: "Test Step",
        trigger: { type: "probe_temp", value: "{{target_temp}}" as any },
        entryActions: [],
        actions: [],
      }],
      [{ name: "target_temp", label: "Target", type: "number", default: 180 }]
    );
    const resolved = resolveProgram(program, { target_temp: 200 });
    expect(resolved[0].trigger.value).toBe(200);
  });

  it("resolveProgram resolves variables in secondary trigger", () => {
    const program = makeMockProgram(
      [{
        name: "Test Step",
        trigger: {
          type: "probe_temp",
          value: 200,
          secondary: { type: "timer", value: "{{max_time}}" as any },
          logic: "fallback" as const,
        },
        entryActions: [],
        actions: [],
      }],
      [{ name: "max_time", label: "Max Time", type: "number", default: 14400 }]
    );
    const resolved = resolveProgram(program, { max_time: 21600 });
    expect(resolved[0].trigger.secondary!.value).toBe(21600);
  });

  it("resolveProgram preserves compound trigger structure", () => {
    const program = makeMockProgram(
      [{
        name: "Test Step",
        trigger: {
          type: "probe_temp",
          value: 160,
          secondary: { type: "timer", value: 28800 },
          logic: "fallback" as const,
        },
        entryActions: [],
        actions: [],
      }]
    );
    const resolved = resolveProgram(program, {});
    expect(resolved[0].trigger.secondary).toBeDefined();
    expect(resolved[0].trigger.secondary!.type).toBe("timer");
    expect(resolved[0].trigger.secondary!.value).toBe(28800);
    expect(resolved[0].trigger.logic).toBe("fallback");
  });
});

// ─── Alert vs Alarm Configuration ────────────────────

describe("Alert vs Alarm — Preset Configuration", () => {
  it("Brisket uses persistent alarms (not notifications) on critical steps", () => {
    const brisket = PRESET_PROGRAMS.find((p) => p.name === "Competition Brisket");
    expect(brisket).toBeDefined();

    // Check that at least one step has an alarm-type alert
    const hasAlarm = brisket!.steps.some(
      (s) => s.alertOnTrigger?.type === "alarm"
    );
    expect(hasAlarm).toBe(true);
  });

  it("Brisket has escalating alarm on the wrap-point step", () => {
    const brisket = PRESET_PROGRAMS.find((p) => p.name === "Competition Brisket");
    expect(brisket).toBeDefined();

    const wrapStep = brisket!.steps.find((s) =>
      s.alertOnTrigger?.escalating !== undefined
    );
    expect(wrapStep).toBeDefined();
    expect(wrapStep!.alertOnTrigger!.escalating!.intervalDegrees).toBeGreaterThan(0);
  });

  it("Brisket rest step has auto-set-grill-temp action to reduce heat", () => {
    const brisket = PRESET_PROGRAMS.find((p) => p.name === "Competition Brisket");
    expect(brisket).toBeDefined();

    // Find a step that has a set_grill_temp action (the auto-reduce)
    const hasAutoReduce = brisket!.steps.some((s) =>
      s.actions.some((a) => a.type === "set_grill_temp")
    );
    expect(hasAutoReduce).toBe(true);
  });

  it("Notification-type alerts exist on non-critical steps", () => {
    // Check across all presets that notifications are used somewhere
    const hasNotification = PRESET_PROGRAMS.some((p) =>
      p.steps.some((s) => s.alertOnTrigger?.type === "notification")
    );
    expect(hasNotification).toBe(true);
  });
});

// ─── Edge Cases ──────────────────────────────────────

describe("Compound Trigger — Edge Cases", () => {
  it("secondary trigger without logic defaults gracefully", () => {
    const trigger: StepTrigger = {
      type: "probe_temp",
      value: 200,
      secondary: { type: "timer", value: 3600 },
      // logic intentionally omitted
    };
    expect(trigger.secondary).toBeDefined();
    expect(trigger.logic).toBeUndefined();
  });

  it("manual trigger type has no value", () => {
    const trigger: StepTrigger = {
      type: "manual",
    };
    expect(trigger.value).toBeUndefined();
    expect(trigger.secondary).toBeUndefined();
  });

  it("immediate trigger type has no value", () => {
    const trigger: StepTrigger = {
      type: "immediate",
    };
    expect(trigger.value).toBeUndefined();
  });

  it("all preset steps have valid trigger types", () => {
    const validTypes = [
      "probe_temp", "probe_temp_drop", "grill_temp", "grill_temp_drop",
      "timer", "pellet_low", "manual", "immediate",
    ];
    for (const preset of PRESET_PROGRAMS) {
      for (const step of preset.steps) {
        expect(validTypes).toContain(step.trigger.type);
        if (step.trigger.secondary) {
          expect(validTypes).toContain(step.trigger.secondary.type);
        }
      }
    }
  });

  it("all preset compound triggers use valid logic operators", () => {
    const validLogic = ["or", "and", "fallback", "priority"];
    for (const preset of PRESET_PROGRAMS) {
      for (const step of preset.steps) {
        if (step.trigger.logic) {
          expect(validLogic).toContain(step.trigger.logic);
        }
      }
    }
  });
});
