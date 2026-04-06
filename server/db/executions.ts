import { getDb, withDbRetry, eq, and, desc, sql } from "./connection";
import {
  programExecutions,
  type InsertProgramExecution,
} from "../../drizzle/schema";

// Create a new execution record when a program starts
export async function createProgramExecution(data: InsertProgramExecution) {
  const result = await withDbRetry(async (db) => {
    const insertResult = await db.insert(programExecutions).values(data);
    return insertResult[0].insertId;
  }, "createProgramExecution");
  if (result === null) throw new Error("Database not available");
  return result;
}

// Get execution history for a user (most recent first)
export async function getUserExecutionHistory(userId: string, limit = 50) {
  return (
    (await withDbRetry(async (db) => {
      return db
        .select()
        .from(programExecutions)
        .where(eq(programExecutions.userId, userId))
        .orderBy(desc(programExecutions.startedAt))
        .limit(limit);
    }, "getUserExecutionHistory")) ?? []
  );
}

// Get a single execution record
export async function getProgramExecution(id: number) {
  return await withDbRetry(async (db) => {
    const result = await db
      .select()
      .from(programExecutions)
      .where(eq(programExecutions.id, id))
      .limit(1);
    return result.length > 0 ? result[0] : undefined;
  }, "getProgramExecution");
}

// Update execution outcome (when program completes or is aborted)
export async function updateExecutionOutcome(
  id: number,
  outcome: "completed" | "aborted" | "failed",
  extras?: {
    stepsCompleted?: number;
    peakGrillTemp?: number | null;
    peakProbeTemp?: number | null;
    endedAt?: Date;
  }
) {
  await withDbRetry(async (db) => {
    await db
      .update(programExecutions)
      .set({
        outcome,
        endedAt: extras?.endedAt ?? new Date(),
        ...(extras?.stepsCompleted != null ? { stepsCompleted: extras.stepsCompleted } : {}),
        ...(extras?.peakGrillTemp != null ? { peakGrillTemp: extras.peakGrillTemp } : {}),
        ...(extras?.peakProbeTemp != null ? { peakProbeTemp: extras.peakProbeTemp } : {}),
      })
      .where(eq(programExecutions.id, id));
  }, "updateExecutionOutcome");
}

// Update execution notes and rating (post-cook review)
export async function updateExecutionReview(
  id: number,
  userId: string,
  data: { notes?: string | null; rating?: number | null }
) {
  await withDbRetry(async (db) => {
    await db
      .update(programExecutions)
      .set({
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.rating !== undefined ? { rating: data.rating } : {}),
      })
      .where(and(eq(programExecutions.id, id), eq(programExecutions.userId, userId)));
  }, "updateExecutionReview");
}

// Append to execution log
export async function appendExecutionLog(
  id: number,
  entry: { timestamp: number; event: string; detail?: string }
) {
  await withDbRetry(async (db) => {
    // Get current log
    const current = await db
      .select({ executionLogJson: programExecutions.executionLogJson })
      .from(programExecutions)
      .where(eq(programExecutions.id, id))
      .limit(1);

    const existingLog = (current[0]?.executionLogJson as any[]) || [];
    existingLog.push(entry);

    await db
      .update(programExecutions)
      .set({ executionLogJson: existingLog })
      .where(eq(programExecutions.id, id));
  }, "appendExecutionLog");
}

// Link a cook session to an execution
export async function linkCookSession(id: number, cookSessionId: number) {
  await withDbRetry(async (db) => {
    await db
      .update(programExecutions)
      .set({ cookSessionId })
      .where(eq(programExecutions.id, id));
  }, "linkCookSession");
}

// Get execution history for a specific program
export async function getExecutionsForProgram(automationProgramId: number, userId: string, limit = 20) {
  return (
    (await withDbRetry(async (db) => {
      return db
        .select()
        .from(programExecutions)
        .where(
          and(
            eq(programExecutions.automationProgramId, automationProgramId),
            eq(programExecutions.userId, userId)
          )
        )
        .orderBy(desc(programExecutions.startedAt))
        .limit(limit);
    }, "getExecutionsForProgram")) ?? []
  );
}

// Get the currently running execution for a user (if any)
export async function getActiveExecution(userId: string) {
  return await withDbRetry(async (db) => {
    const result = await db
      .select()
      .from(programExecutions)
      .where(
        and(
          eq(programExecutions.userId, userId),
          eq(programExecutions.outcome, "running")
        )
      )
      .limit(1);
    return result.length > 0 ? result[0] : undefined;
  }, "getActiveExecution");
}
