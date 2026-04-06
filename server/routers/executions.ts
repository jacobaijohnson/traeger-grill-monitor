import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  getUserExecutionHistory,
  getProgramExecution,
  updateExecutionReview,
  getExecutionsForProgram,
} from "../db";

export const executionsRouter = router({
  // Get user's full execution history
  history: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(200).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return getUserExecutionHistory(ctx.user.id, input?.limit ?? 50);
    }),

  // Get a single execution record
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const exec = await getProgramExecution(input.id);
      if (!exec || exec.userId !== ctx.user.id) return null;
      return exec;
    }),

  // Get execution history for a specific program
  forProgram: protectedProcedure
    .input(
      z.object({
        automationProgramId: z.number(),
        limit: z.number().min(1).max(100).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return getExecutionsForProgram(
        input.automationProgramId,
        ctx.user.id,
        input.limit ?? 20
      );
    }),

  // Update notes and rating for a completed execution
  review: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        notes: z.string().optional(),
        rating: z.number().min(1).max(5).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateExecutionReview(input.id, ctx.user.id, {
        notes: input.notes ?? null,
        rating: input.rating ?? null,
      });
      return { success: true };
    }),
});
