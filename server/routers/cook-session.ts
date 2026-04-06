import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createCookSession,
  endCookSession,
  updateCookSessionNotes,
  getUserCookSessions,
  getCookSession,
  getTelemetryForSession,
} from "../db";

export const cookSessionRouter = router({
  start: protectedProcedure
    .input(z.object({
      grillId: z.string(),
      templateId: z.string().optional(),
      meatType: z.string().optional(),
      cutName: z.string().optional(),
      method: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await createCookSession({
        userId: ctx.user.id,
        grillId: input.grillId,
        templateId: input.templateId ?? null,
        meatType: input.meatType ?? null,
        cutName: input.cutName ?? null,
        method: input.method ?? null,
        notes: null,
        rating: null,
        endedAt: null,
      });
      return { id };
    }),

  end: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const session = await getCookSession(input.id, ctx.user.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Cook session not found" });
      await endCookSession(input.id, ctx.user.id);
      return { success: true };
    }),

  updateNotes: protectedProcedure
    .input(z.object({ id: z.number(), notes: z.string(), rating: z.number().min(1).max(5).optional() }))
    .mutation(async ({ ctx, input }) => {
      const session = await getCookSession(input.id, ctx.user.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Cook session not found" });
      await updateCookSessionNotes(input.id, input.notes, input.rating, ctx.user.id);
      return { success: true };
    }),

  list: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      return getUserCookSessions(ctx.user.id, input?.limit ?? 50);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return getCookSession(input.id, ctx.user.id);
    }),

  /**
   * P3: Export cook session data as CSV.
   * Returns a CSV string with session metadata and telemetry readings.
   */
  exportCsv: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const session = await getCookSession(input.id, ctx.user.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Cook session not found" });

      const telemetry = await getTelemetryForSession(input.id, 10000, ctx.user.id);

      // Build CSV header
      const lines: string[] = [];
      lines.push("# Cook Session Export");
      lines.push(`# Session ID: ${session.id}`);
      lines.push(`# Meat Type: ${session.meatType || "N/A"}`);
      lines.push(`# Cut: ${session.cutName || "N/A"}`);
      lines.push(`# Method: ${session.method || "N/A"}`);
      lines.push(`# Started: ${session.startedAt ? new Date(session.startedAt).toISOString() : "N/A"}`);
      lines.push(`# Ended: ${session.endedAt ? new Date(session.endedAt).toISOString() : "N/A"}`);
      lines.push(`# Rating: ${session.rating || "N/A"}`);
      lines.push(`# Notes: ${session.notes || "N/A"}`);
      lines.push("");
      lines.push("timestamp,grill_temp_f,probe_temp_f,ambient_temp_f,target_temp_f,target_probe_temp_f,pellet_level_pct,system_status");

      for (const reading of telemetry) {
        const ts = reading.recordedAt ? new Date(reading.recordedAt).toISOString() : "";
        lines.push([
          ts,
          reading.grillTemp ?? "",
          reading.probeTemp ?? "",
          reading.ambientTemp ?? "",
          reading.targetTemp ?? "",
          reading.targetProbeTemp ?? "",
          reading.pelletLevel ?? "",
          reading.systemStatus ?? "",
        ].join(","));
      }

      return {
        csv: lines.join("\n"),
        filename: `cook-session-${session.id}-${session.meatType || "unknown"}.csv`,
      };
    }),
});
