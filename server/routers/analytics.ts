import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  getCookAnalyticsSummary,
  getCooksByMeatType,
  getCooksByMethod,
  getCooksByMonth,
  getCooksByCut,
  getRatingDistribution,
  getPelletConsumptionSummary,
  getPelletTrend,
} from "../db";

const grillFilterInput = z.object({ grillId: z.string().optional() }).optional();

export const analyticsRouter = router({
  summary: protectedProcedure
    .input(grillFilterInput)
    .query(async ({ ctx, input }) => {
      return getCookAnalyticsSummary(ctx.user.id, input?.grillId);
    }),

  byMeatType: protectedProcedure
    .input(grillFilterInput)
    .query(async ({ ctx, input }) => {
      return getCooksByMeatType(ctx.user.id, input?.grillId);
    }),

  byMethod: protectedProcedure
    .input(grillFilterInput)
    .query(async ({ ctx, input }) => {
      return getCooksByMethod(ctx.user.id, input?.grillId);
    }),

  byMonth: protectedProcedure
    .input(grillFilterInput)
    .query(async ({ ctx, input }) => {
      return getCooksByMonth(ctx.user.id, input?.grillId);
    }),

  byCut: protectedProcedure
    .input(grillFilterInput)
    .query(async ({ ctx, input }) => {
      return getCooksByCut(ctx.user.id, input?.grillId);
    }),

  ratingDistribution: protectedProcedure
    .input(grillFilterInput)
    .query(async ({ ctx, input }) => {
      return getRatingDistribution(ctx.user.id, input?.grillId);
    }),

  // Pellet consumption summary
  pelletSummary: protectedProcedure
    .input(grillFilterInput)
    .query(async ({ ctx, input }) => {
      return getPelletConsumptionSummary(ctx.user.id, input?.grillId);
    }),

  // Pellet level trend data for charting
  pelletTrend: protectedProcedure
    .input(z.object({
      grillId: z.string().optional(),
      days: z.number().min(1).max(365).default(30),
    }).optional())
    .query(async ({ ctx, input }) => {
      return getPelletTrend(ctx.user.id, input?.grillId, input?.days);
    }),
});
