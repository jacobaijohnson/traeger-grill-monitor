import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  createAutomationProgram,
  getUserAutomationPrograms,
  getActiveAutomation,
  updateAutomationState,
  deleteAutomationProgram,
} from "../db";

export const automationRouter = router({
  create: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      templateId: z.string().optional(),
      stages: z.array(z.object({
        name: z.string(),
        grillTemp: z.number(),
        triggerType: z.enum(["time", "probe_temp", "manual"]),
        triggerValue: z.number(),
        superSmoke: z.boolean(),
        alertMessage: z.string(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await createAutomationProgram({
        userId: ctx.user.id,
        name: input.name,
        description: input.description ?? null,
        templateId: input.templateId ?? null,
        stagesJson: JSON.stringify(input.stages),
        isActive: 0,
        currentStage: 0,
        cookSessionId: null,
        startedAt: null,
      });
      return { id };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return getUserAutomationPrograms(ctx.user.id);
  }),

  getActive: protectedProcedure.query(async ({ ctx }) => {
    return getActiveAutomation(ctx.user.id);
  }),

  start: protectedProcedure
    .input(z.object({ id: z.number(), cookSessionId: z.number().optional() }))
    .mutation(async ({ input }) => {
      await updateAutomationState(input.id, 0, true);
      return { success: true };
    }),

  advanceStage: protectedProcedure
    .input(z.object({ id: z.number(), nextStage: z.number() }))
    .mutation(async ({ input }) => {
      await updateAutomationState(input.id, input.nextStage, true);
      return { success: true };
    }),

  stop: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updateAutomationState(input.id, 0, false);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteAutomationProgram(input.id);
      return { success: true };
    }),
});
