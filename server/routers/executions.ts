import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  getUserExecutionHistory,
  getProgramExecution,
  updateExecutionReview,
  getExecutionsForProgram,
} from "../db";

// CSV escape helper — wraps in quotes if value contains comma, quote, or newline
function csvEscape(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

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

  // Compare two executions side-by-side
  compare: protectedProcedure
    .input(
      z.object({
        idA: z.number(),
        idB: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const [execA, execB] = await Promise.all([
        getProgramExecution(input.idA),
        getProgramExecution(input.idB),
      ]);
      if (!execA || execA.userId !== ctx.user.id)
        throw new TRPCError({ code: "NOT_FOUND", message: "Execution A not found" });
      if (!execB || execB.userId !== ctx.user.id)
        throw new TRPCError({ code: "NOT_FOUND", message: "Execution B not found" });

      // Compute deltas
      const durationA = execA.endedAt
        ? new Date(execA.endedAt).getTime() - new Date(execA.startedAt).getTime()
        : null;
      const durationB = execB.endedAt
        ? new Date(execB.endedAt).getTime() - new Date(execB.startedAt).getTime()
        : null;

      return {
        execA,
        execB,
        deltas: {
          durationMs: durationA != null && durationB != null ? durationB - durationA : null,
          peakGrillTemp:
            execA.peakGrillTemp != null && execB.peakGrillTemp != null
              ? (execB.peakGrillTemp ?? 0) - (execA.peakGrillTemp ?? 0)
              : null,
          peakProbeTemp:
            execA.peakProbeTemp != null && execB.peakProbeTemp != null
              ? (execB.peakProbeTemp ?? 0) - (execA.peakProbeTemp ?? 0)
              : null,
          stepsCompleted: execB.stepsCompleted - execA.stepsCompleted,
          rating:
            execA.rating != null && execB.rating != null
              ? execB.rating - execA.rating
              : null,
        },
      };
    }),

  // Export execution as CSV string
  exportCsv: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const exec = await getProgramExecution(input.id);
      if (!exec || exec.userId !== ctx.user.id)
        throw new TRPCError({ code: "NOT_FOUND", message: "Execution not found" });

      const lines: string[] = [];

      // Metadata header
      lines.push("# Cook Log Export");
      lines.push(`Program,${csvEscape(exec.programName)}`);
      lines.push(`Category,${csvEscape(exec.programCategory || "")}`);
      lines.push(`Method,${csvEscape(exec.programMethod || "")}`);
      lines.push(`Meat Cut,${csvEscape(exec.programMeatCut || "")}`);
      lines.push(`Outcome,${exec.outcome}`);
      lines.push(`Rating,${exec.rating ?? ""}`);
      lines.push(`Started,${exec.startedAt ? new Date(exec.startedAt).toISOString() : ""}`);
      lines.push(`Ended,${exec.endedAt ? new Date(exec.endedAt).toISOString() : ""}`);
      lines.push(`Steps Completed,${exec.stepsCompleted}/${exec.totalSteps}`);
      lines.push(`Peak Grill Temp,${exec.peakGrillTemp != null ? `${Math.round(exec.peakGrillTemp)}°F` : ""}`);
      lines.push(`Peak Probe Temp,${exec.peakProbeTemp != null ? `${Math.round(exec.peakProbeTemp)}°F` : ""}`);
      if (exec.notes) lines.push(`Notes,${csvEscape(exec.notes)}`);

      // Variable values
      const vars = exec.variableValuesJson as Record<string, any> | null;
      if (vars && typeof vars === "object" && Object.keys(vars).length > 0) {
        lines.push("");
        lines.push("# Variables Used");
        lines.push("Variable,Value");
        for (const [k, v] of Object.entries(vars)) {
          lines.push(`${csvEscape(k)},${csvEscape(String(v))}`);
        }
      }

      // Execution log
      const log = exec.executionLogJson as Array<{ timestamp: number; event: string; detail?: string }> | null;
      if (log && Array.isArray(log) && log.length > 0) {
        lines.push("");
        lines.push("# Execution Timeline");
        lines.push("Timestamp,Event,Detail");
        for (const entry of log) {
          lines.push(
            `${new Date(entry.timestamp).toISOString()},${csvEscape(entry.event)},${csvEscape(entry.detail || "")}`
          );
        }
      }

      return {
        csv: lines.join("\n"),
        filename: `cook-log-${exec.programName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}-${new Date(exec.startedAt).toISOString().slice(0, 10)}.csv`,
      };
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
