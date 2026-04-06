import { protectedProcedure, router } from "../_core/trpc";
import {
  getCookAnalyticsSummary,
  getCooksByMeatType,
  getCooksByMethod,
  getCooksByMonth,
  getCooksByCut,
  getRatingDistribution,
} from "../db";

export const analyticsRouter = router({
  summary: protectedProcedure
    .query(async ({ ctx }) => {
      return getCookAnalyticsSummary(ctx.user.id);
    }),

  byMeatType: protectedProcedure
    .query(async ({ ctx }) => {
      return getCooksByMeatType(ctx.user.id);
    }),

  byMethod: protectedProcedure
    .query(async ({ ctx }) => {
      return getCooksByMethod(ctx.user.id);
    }),

  byMonth: protectedProcedure
    .query(async ({ ctx }) => {
      return getCooksByMonth(ctx.user.id);
    }),

  byCut: protectedProcedure
    .query(async ({ ctx }) => {
      return getCooksByCut(ctx.user.id);
    }),

  ratingDistribution: protectedProcedure
    .query(async ({ ctx }) => {
      return getRatingDistribution(ctx.user.id);
    }),
});
