import { describe, expect, it } from "vitest";
import { templateToProgram, templatesToPrograms } from "../shared/template-bridge";
import { PRESET_PROGRAMS } from "../shared/cook-programs";
import { COOK_TEMPLATES } from "../shared/cook-templates";
import type { CookTemplate } from "../shared/traeger-types";

describe("template-bridge", () => {
  describe("templateToProgram", () => {
    it("converts a basic CookTemplate to CookProgram format", () => {
      const template: CookTemplate = {
        id: "test-brisket",
        name: "Test Brisket",
        category: "beef",
        method: "smoke",
        cut: "Whole Packer Brisket",
        description: "A test brisket template",
        estimatedTime: "12-16 hours",
        weightBased: true,
        timePerPound: 90,
        stages: [
          {
            name: "Smoke",
            grillTemp: 225,
            triggerType: "probe_temp",
            triggerValue: 165,
            superSmoke: true,
            alertMessage: "Time to wrap!",
          },
          {
            name: "Wrapped Cook",
            grillTemp: 250,
            triggerType: "probe_temp",
            triggerValue: 203,
            superSmoke: false,
            alertMessage: "Pull the brisket!",
          },
        ],
        tips: ["Tip 1", "Tip 2"],
      };

      const program = templateToProgram(template);

      expect(program.sourceTemplateId).toBe("test-brisket");
      expect(program.name).toBe("Test Brisket");
      expect(program.category).toBe("beef");
      expect(program.method).toBe("smoke");
      expect(program.meatCut).toBe("Whole Packer Brisket");
      expect(program.description).toBe("A test brisket template");
      expect(program.estimatedTime).toBe("12-16 hours");
      expect(program.difficulty).toBe("intermediate");
      expect(program.steps).toHaveLength(2);
      expect(program.tips).toEqual(["Tip 1", "Tip 2"]);
    });

    it("creates weight variable for weight-based templates", () => {
      const template: CookTemplate = {
        id: "weight-test",
        name: "Weight Test",
        category: "beef",
        method: "smoke",
        cut: "Test Cut",
        description: "Test",
        estimatedTime: "8 hours",
        weightBased: true,
        timePerPound: 60,
        stages: [
          { name: "Cook", grillTemp: 225, triggerType: "probe_temp", triggerValue: 200, superSmoke: false },
        ],
        tips: [],
      };

      const program = templateToProgram(template);
      expect(program.variables).toHaveLength(1);
      expect(program.variables[0].name).toBe("meat_weight_lbs");
      expect(program.variables[0].unit).toBe("lbs");
    });

    it("does not create weight variable for non-weight-based templates", () => {
      const template: CookTemplate = {
        id: "no-weight",
        name: "No Weight",
        category: "beef",
        method: "grill",
        cut: "Steak",
        description: "Test",
        estimatedTime: "1 hour",
        weightBased: false,
        stages: [
          { name: "Grill", grillTemp: 450, triggerType: "time", triggerValue: 300, superSmoke: false },
        ],
        tips: [],
      };

      const program = templateToProgram(template);
      expect(program.variables).toHaveLength(0);
    });

    it("converts stage trigger types correctly", () => {
      const template: CookTemplate = {
        id: "trigger-test",
        name: "Trigger Test",
        category: "pork",
        method: "smoke",
        cut: "Pork Butt",
        description: "Test",
        estimatedTime: "10 hours",
        weightBased: false,
        stages: [
          { name: "Smoke", grillTemp: 225, triggerType: "probe_temp", triggerValue: 165, superSmoke: true },
          { name: "Timer", grillTemp: 250, triggerType: "time", triggerValue: 3600, superSmoke: false },
          { name: "Manual", grillTemp: 160, triggerType: "manual", triggerValue: 0, superSmoke: false },
        ],
        tips: [],
      };

      const program = templateToProgram(template);
      expect(program.steps[0].trigger.type).toBe("probe_temp");
      expect(program.steps[0].trigger.value).toBe(165);
      expect(program.steps[1].trigger.type).toBe("timer");
      expect(program.steps[1].trigger.value).toBe(3600);
      expect(program.steps[2].trigger.type).toBe("manual");
      expect(program.steps[2].trigger.value).toBeUndefined();
    });

    it("adds super_smoke_on entry action when superSmoke is true", () => {
      const template: CookTemplate = {
        id: "smoke-test",
        name: "Smoke Test",
        category: "beef",
        method: "smoke",
        cut: "Brisket",
        description: "Test",
        estimatedTime: "12 hours",
        weightBased: false,
        stages: [
          { name: "Smoke", grillTemp: 225, triggerType: "probe_temp", triggerValue: 165, superSmoke: true },
          { name: "Finish", grillTemp: 250, triggerType: "probe_temp", triggerValue: 203, superSmoke: false },
        ],
        tips: [],
      };

      const program = templateToProgram(template);
      const smokeStep = program.steps[0];
      const finishStep = program.steps[1];

      expect(smokeStep.entryActions).toHaveLength(2);
      expect(smokeStep.entryActions![0].type).toBe("set_grill_temp");
      expect(smokeStep.entryActions![0].params?.temp).toBe(225);
      expect(smokeStep.entryActions![1].type).toBe("super_smoke_on");

      expect(finishStep.entryActions).toHaveLength(1);
      expect(finishStep.entryActions![0].type).toBe("set_grill_temp");
    });

    it("creates alert notification from alertMessage", () => {
      const template: CookTemplate = {
        id: "alert-test",
        name: "Alert Test",
        category: "beef",
        method: "smoke",
        cut: "Brisket",
        description: "Test",
        estimatedTime: "12 hours",
        weightBased: false,
        stages: [
          { name: "Smoke", grillTemp: 225, triggerType: "probe_temp", triggerValue: 165, superSmoke: false, alertMessage: "Wrap it!" },
        ],
        tips: [],
      };

      const program = templateToProgram(template);
      expect(program.steps[0].alertOnTrigger).toBeDefined();
      expect(program.steps[0].alertOnTrigger?.type).toBe("notification");
      expect(program.steps[0].alertOnTrigger?.message).toBe("Wrap it!");
      expect(program.steps[0].actions).toHaveLength(1);
      expect(program.steps[0].actions[0].type).toBe("send_notification");
    });

    it("maps cooking methods correctly", () => {
      const methods = ["smoke", "grill", "reverse_sear", "roast", "bake"];
      for (const method of methods) {
        const template: CookTemplate = {
          id: `method-${method}`,
          name: `${method} Test`,
          category: "beef",
          method,
          cut: "Test",
          description: "Test",
          estimatedTime: "1 hour",
          weightBased: false,
          stages: [{ name: "Cook", grillTemp: 225, triggerType: "manual", triggerValue: 0, superSmoke: false }],
          tips: [],
        };
        const program = templateToProgram(template);
        expect(program.method).toBe(method);
      }
    });
  });

  describe("templatesToPrograms", () => {
    it("converts all COOK_TEMPLATES without errors", () => {
      const programs = templatesToPrograms(COOK_TEMPLATES);
      expect(programs.length).toBe(COOK_TEMPLATES.length);
      for (const p of programs) {
        expect(p.name).toBeTruthy();
        expect(p.steps.length).toBeGreaterThan(0);
        expect(p.sourceTemplateId).toBeTruthy();
      }
    });
  });
});

describe("PRESET_PROGRAMS", () => {
  it("all presets have required fields", () => {
    for (const preset of PRESET_PROGRAMS) {
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.category).toBeTruthy();
      expect(preset.method).toBeTruthy();
      expect(preset.steps.length).toBeGreaterThan(0);
    }
  });

  it("all preset steps have valid triggers", () => {
    const validTriggerTypes = ["probe_temp", "probe_temp_drop", "grill_temp", "grill_temp_drop", "timer", "pellet_low", "manual", "immediate"];
    for (const preset of PRESET_PROGRAMS) {
      for (const step of preset.steps) {
        expect(validTriggerTypes).toContain(step.trigger.type);
        if (step.trigger.secondary) {
          expect(validTriggerTypes).toContain(step.trigger.secondary.type);
          expect(["or", "and", "fallback", "priority"]).toContain(step.trigger.logic);
        }
      }
    }
  });

  it("preset variables have valid definitions", () => {
    for (const preset of PRESET_PROGRAMS) {
      if (preset.variables) {
        for (const v of preset.variables) {
          expect(v.name).toBeTruthy();
          expect(v.label).toBeTruthy();
          expect(["number", "enum", "text"]).toContain(v.type);
          expect(v.default).toBeDefined();
        }
      }
    }
  });

  it("Competition Brisket preset has compound triggers", () => {
    const brisket = PRESET_PROGRAMS.find(p => p.name === "Competition Brisket");
    expect(brisket).toBeDefined();
    expect(brisket!.steps.length).toBeGreaterThanOrEqual(3);

    // First step should have compound trigger (probe_temp + timer fallback)
    const firstStep = brisket!.steps[0];
    expect(firstStep.trigger.type).toBe("probe_temp");
    expect(firstStep.trigger.secondary).toBeDefined();
    expect(firstStep.trigger.secondary!.type).toBe("timer");
    expect(firstStep.trigger.logic).toBe("or");
  });
});

describe("unified library deduplication", () => {
  it("guide templates that overlap with presets should be identifiable", () => {
    const presetNames = PRESET_PROGRAMS.map(p => p.name.toLowerCase());
    const guidePrograms = templatesToPrograms(COOK_TEMPLATES);

    // At least some guide templates should NOT overlap with presets
    const nonOverlapping = guidePrograms.filter(g =>
      !presetNames.includes(g.name.toLowerCase())
    );
    expect(nonOverlapping.length).toBeGreaterThan(0);
  });
});
