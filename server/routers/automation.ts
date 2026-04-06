import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  createAutomationProgram,
  getUserAutomationPrograms,
  getActiveAutomation,
  updateAutomationState,
  deleteAutomationProgram,
} from "../db";
import {
  loadAutomationProgram,
  acknowledgeAutomationPhase,
  skipAutomationPhase,
  getAutomationState,
} from "../mqtt-manager";
import type { AutomationStage } from "../../shared/traeger-types";
import type { CookProgram, ProgramStep } from "../../shared/cook-programs";
import { PRESET_PROGRAMS, resolveProgram } from "../../shared/cook-programs";

/**
 * Bridge: Convert new ProgramStep[] to legacy AutomationStage[] format
 * so the existing MQTT engine can execute them without a full rewrite.
 */
function programStepsToAutomationStages(steps: ProgramStep[]): AutomationStage[] {
  return steps.map((step) => {
    // Determine trigger type
    let triggerType: "probe_temp" | "time" | "manual" = "manual";
    let triggerValue = 0;
    if (step.trigger.type === "probe_temp") {
      triggerType = "probe_temp";
      triggerValue = typeof step.trigger.value === "number" ? step.trigger.value : Number(step.trigger.value) || 0;
    } else if (step.trigger.type === "timer") {
      triggerType = "time";
      triggerValue = typeof step.trigger.value === "number" ? step.trigger.value : Number(step.trigger.value) || 0;
    } else if (step.trigger.type === "grill_temp") {
      // Map grill_temp to probe_temp trigger but use grill temp value
      // The engine checks probe temp, so we'll handle this via grillTemp entry action
      triggerType = "manual"; // grill_temp triggers need manual advance for now
      triggerValue = typeof step.trigger.value === "number" ? step.trigger.value : Number(step.trigger.value) || 0;
    } else if (step.trigger.type === "manual" || step.trigger.type === "immediate") {
      triggerType = "manual";
    }

    // Extract grill temp from entry actions
    let grillTemp = 0;
    let superSmoke = false;
    let autoSetGrillTemp: number | undefined;
    let autoSetSuperSmoke: boolean | undefined;
    let autoSetKeepWarm: boolean | undefined;

    // Process entry actions (what happens when phase starts)
    for (const action of step.entryActions ?? []) {
      if (action.type === "set_grill_temp" && action.params?.temp != null) {
        grillTemp = typeof action.params.temp === "number" ? action.params.temp : Number(action.params.temp) || 0;
      }
      if (action.type === "super_smoke_on") {
        superSmoke = true;
        autoSetSuperSmoke = true;
      }
      if (action.type === "super_smoke_off") {
        autoSetSuperSmoke = false;
      }
      if (action.type === "keep_warm_on") {
        autoSetKeepWarm = true;
      }
      if (action.type === "keep_warm_off") {
        autoSetKeepWarm = false;
      }
    }

    // Process trigger actions (what happens when trigger fires)
    for (const action of step.actions) {
      if (action.type === "set_grill_temp" && action.params?.temp != null) {
        autoSetGrillTemp = typeof action.params.temp === "number" ? action.params.temp : Number(action.params.temp) || 0;
      }
      if (action.type === "keep_warm_on") {
        autoSetKeepWarm = true;
      }
    }

    // Determine alert behavior
    let alertType: "notification" | "alarm" = "notification";
    let alertMessage = step.alertOnTrigger?.message || `Phase "${step.name}" complete`;
    let alarmIntervalDegrees: number | undefined;
    let alarmMaxTemp: number | undefined;
    let requireAcknowledge = false;
    let holdAfterTrigger = false;

    if (step.alertOnTrigger) {
      alertType = step.alertOnTrigger.type;
      alertMessage = step.alertOnTrigger.message;
      if (step.alertOnTrigger.escalating) {
        alarmIntervalDegrees = step.alertOnTrigger.escalating.intervalDegrees;
        alarmMaxTemp = step.alertOnTrigger.escalating.maxTemp;
      }
    }

    // Check if any action is wait_for_ack
    if (step.actions.some(a => a.type === "wait_for_ack")) {
      requireAcknowledge = true;
    }

    // Check if trigger is manual (hold until user advances)
    if (step.trigger.type === "manual") {
      holdAfterTrigger = true;
    }

    // Check for sound_alarm in trigger actions
    for (const action of step.actions) {
      if (action.type === "sound_alarm") {
        alertType = "alarm";
        if (action.params?.message) {
          alertMessage = String(action.params.message);
        }
      }
    }

    return {
      name: step.name,
      grillTemp,
      triggerType,
      triggerValue,
      superSmoke,
      alertMessage,
      alertType,
      alarmIntervalDegrees,
      alarmMaxTemp,
      autoSetGrillTemp,
      autoSetSuperSmoke,
      autoSetKeepWarm,
      holdAfterTrigger,
      requireAcknowledge,
    };
  });
}

export const automationRouter = router({
  // Create a new automation program (from preset or custom)
  create: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      category: z.string().optional(),
      method: z.string().optional(),
      meatCut: z.string().optional(),
      difficulty: z.string().optional(),
      estimatedTime: z.string().optional(),
      tags: z.array(z.string()).optional(),
      templateId: z.string().optional(),
      program: z.any(), // CookProgram JSON
      variableValues: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
      grillId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await createAutomationProgram({
        userId: ctx.user.id,
        grillId: input.grillId ?? null,
        name: input.name,
        description: input.description ?? null,
        category: input.category ?? null,
        method: input.method ?? null,
        meatCut: input.meatCut ?? null,
        difficulty: input.difficulty ?? "intermediate",
        estimatedTime: input.estimatedTime ?? null,
        tags: input.tags ?? [],
        templateId: input.templateId ?? null,
        programJson: input.program,
        variableValuesJson: input.variableValues ?? {},
        status: "ready",
        isActive: 0,
        currentStage: 0,
        cookSessionId: null,
        startedAt: null,
      });
      return { id };
    }),

  // List user's programs
  list: protectedProcedure
    .input(z.object({
      grillId: z.string().optional(),
    }).optional())
    .query(async ({ ctx }) => {
      return getUserAutomationPrograms(ctx.user.id);
    }),

  // Get active automation
  getActive: protectedProcedure.query(async ({ ctx }) => {
    return getActiveAutomation(ctx.user.id);
  }),

  // Get live automation state from MQTT manager
  getLiveState: protectedProcedure
    .input(z.object({ grillId: z.string().optional() }))
    .query(async ({ ctx }) => {
      return getAutomationState(ctx.user.id);
    }),

  // Start a program (loads into MQTT manager for live execution)
  start: protectedProcedure
    .input(z.object({
      id: z.number(),
      grillId: z.string().optional(),
      variableValues: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
      cookSessionId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Mark as active in DB
      await updateAutomationState(input.id, 0, true);

      // Get the program from DB
      const programs = await getUserAutomationPrograms(ctx.user.id);
      const prog = programs.find(p => p.id === input.id);
      if (!prog) throw new Error("Program not found");

      const program = prog.programJson as CookProgram;
      const varValues: Record<string, string | number> = (input.variableValues as Record<string, string | number> | undefined) ?? (prog.variableValuesJson as Record<string, string | number> | null) ?? {};

      // Resolve variables
      const resolvedSteps = resolveProgram(program, varValues);

      // Convert to legacy AutomationStage format for the MQTT engine
      const automationStages = programStepsToAutomationStages(resolvedSteps);

      // Load into MQTT manager
      loadAutomationProgram(ctx.user.id, input.id, automationStages, varValues);

      return { success: true };
    }),

  // Acknowledge current alarm (advance past wait_for_ack)
  acknowledge: protectedProcedure
    .input(z.object({ grillId: z.string().optional() }))
    .mutation(async ({ ctx }) => {
      acknowledgeAutomationPhase(ctx.user.id);
      return { success: true };
    }),

  // Skip to next step
  skip: protectedProcedure
    .input(z.object({ grillId: z.string().optional() }))
    .mutation(async ({ ctx }) => {
      skipAutomationPhase(ctx.user.id);
      return { success: true };
    }),

  // Advance stage (legacy compat + manual advance)
  advanceStage: protectedProcedure
    .input(z.object({ id: z.number(), nextStage: z.number() }))
    .mutation(async ({ input }) => {
      await updateAutomationState(input.id, input.nextStage, true);
      return { success: true };
    }),

  // Stop/abort a running program
  stop: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updateAutomationState(input.id, 0, false);
      return { success: true };
    }),

  // Delete a program
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteAutomationProgram(input.id);
      return { success: true };
    }),

  // Get preset programs library
  presets: protectedProcedure.query(async () => {
    return PRESET_PROGRAMS.map((p, i) => ({
      id: `preset-${i}`,
      ...p,
    }));
  }),

  // Fork a program (create a copy for customization)
  fork: protectedProcedure
    .input(z.object({
      sourceId: z.number(),
      name: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const programs = await getUserAutomationPrograms(ctx.user.id);
      const source = programs.find(p => p.id === input.sourceId);
      if (!source) throw new Error("Source program not found");

      const id = await createAutomationProgram({
        userId: ctx.user.id,
        name: input.name ?? `${source.name} (Copy)`,
        description: source.description,
        category: source.category,
        method: source.method,
        meatCut: source.meatCut,
        difficulty: source.difficulty,
        estimatedTime: source.estimatedTime,
        tags: (source.tags as string[] | null) ?? [],
        templateId: source.templateId,
        programJson: source.programJson ?? { steps: [], variables: [] },
        variableValuesJson: source.variableValuesJson ?? {},
        status: "ready",
        isActive: 0,
        currentStage: 0,
        cookSessionId: null,
        startedAt: null,
        forkedFromId: input.sourceId,
      });
      return { id };
    }),

  // Create from preset
  createFromPreset: protectedProcedure
    .input(z.object({
      presetIndex: z.number(),
      variableValues: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
      grillId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const preset = PRESET_PROGRAMS[input.presetIndex];
      if (!preset) throw new Error("Preset not found");

      const id = await createAutomationProgram({
        userId: ctx.user.id,
        grillId: input.grillId ?? null,
        name: preset.name,
        description: preset.description,
        category: preset.category,
        method: preset.method,
        meatCut: preset.meatCut ?? null,
        difficulty: preset.difficulty,
        estimatedTime: preset.estimatedTime ?? null,
        tags: preset.tags,
        programJson: preset,
        variableValuesJson: input.variableValues ?? {},
        status: "ready",
        isActive: 0,
        currentStage: 0,
        cookSessionId: null,
        startedAt: null,
      });
      return { id };
    }),
});
