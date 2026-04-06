import { getDb, withDbRetry, eq, and, desc, sql } from "./connection";
import {
  customTemplates,
  automationPrograms,
  type InsertCustomTemplate,
  type InsertAutomationProgram,
} from "../../drizzle/schema";

// ===== Custom Cook Templates =====

export async function createCustomTemplate(data: InsertCustomTemplate) {
  const result = await withDbRetry(async (db) => {
    const insertResult = await db.insert(customTemplates).values(data);
    return insertResult[0].insertId;
  }, "createCustomTemplate");
  if (result === null) throw new Error("Database not available");
  return result;
}

export async function getUserCustomTemplates(userId: number) {
  return await withDbRetry(async (db) => {
    return db
      .select()
      .from(customTemplates)
      .where(eq(customTemplates.userId, userId))
      .orderBy(desc(customTemplates.updatedAt));
  }, "getUserCustomTemplates") ?? [];
}

export async function getPublishedTemplates(limit = 50) {
  return await withDbRetry(async (db) => {
    return db
      .select()
      .from(customTemplates)
      .where(eq(customTemplates.isPublished, 1))
      .orderBy(desc(customTemplates.forkCount), desc(customTemplates.createdAt))
      .limit(limit);
  }, "getPublishedTemplates") ?? [];
}

export async function getCustomTemplate(id: number) {
  return await withDbRetry(async (db) => {
    const result = await db.select().from(customTemplates).where(eq(customTemplates.id, id)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  }, "getCustomTemplate");
}

export async function updateCustomTemplate(
  id: number,
  userId: number,
  data: Partial<InsertCustomTemplate>
) {
  await withDbRetry(async (db) => {
    await db
      .update(customTemplates)
      .set(data)
      .where(and(eq(customTemplates.id, id), eq(customTemplates.userId, userId)));
  }, "updateCustomTemplate");
}

export async function deleteCustomTemplate(id: number, userId: number) {
  await withDbRetry(async (db) => {
    await db
      .delete(customTemplates)
      .where(and(eq(customTemplates.id, id), eq(customTemplates.userId, userId)));
  }, "deleteCustomTemplate");
}

export async function forkCustomTemplate(id: number, userId: number, authorName: string | null) {
  const result = await withDbRetry(async (db) => {
    const original = await getCustomTemplate(id);
    if (!original) throw new Error("Template not found");

    // Increment fork count on original
    await db
      .update(customTemplates)
      .set({ forkCount: sql`${customTemplates.forkCount} + 1` })
      .where(eq(customTemplates.id, id));

    // Create the fork
    const insertResult = await db.insert(customTemplates).values({
      userId,
      authorName,
      name: `${original.name} (fork)`,
      description: original.description,
      category: original.category,
      method: original.method,
      meatCut: original.meatCut,
      difficulty: original.difficulty,
      estimatedTime: original.estimatedTime,
      stagesJson: original.stagesJson,
      tipsJson: original.tipsJson,
      isPublished: 0,
      forkCount: 0,
      forkedFromId: id,
    });
    return insertResult[0].insertId;
  }, "forkCustomTemplate");
  if (result === null) throw new Error("Database not available");
  return result;
}

// ===== Automation Programs =====

export async function createAutomationProgram(data: InsertAutomationProgram) {
  const result = await withDbRetry(async (db) => {
    const insertResult = await db.insert(automationPrograms).values(data);
    return insertResult[0].insertId;
  }, "createAutomationProgram");
  if (result === null) throw new Error("Database not available");
  return result;
}

export async function getUserAutomationPrograms(userId: number) {
  return await withDbRetry(async (db) => {
    return db
      .select()
      .from(automationPrograms)
      .where(eq(automationPrograms.userId, userId))
      .orderBy(desc(automationPrograms.createdAt));
  }, "getUserAutomationPrograms") ?? [];
}

export async function getActiveAutomation(userId: number) {
  return await withDbRetry(async (db) => {
    const result = await db
      .select()
      .from(automationPrograms)
      .where(and(eq(automationPrograms.userId, userId), eq(automationPrograms.isActive, 1)))
      .limit(1);
    return result.length > 0 ? result[0] : undefined;
  }, "getActiveAutomation");
}

export async function updateAutomationState(id: number, currentStage: number, isActive: boolean) {
  await withDbRetry(async (db) => {
    await db
      .update(automationPrograms)
      .set({ currentStage, isActive: isActive ? 1 : 0 })
      .where(eq(automationPrograms.id, id));
  }, "updateAutomationState");
}

export async function deleteAutomationProgram(id: number) {
  await withDbRetry(async (db) => {
    await db.delete(automationPrograms).where(eq(automationPrograms.id, id));
  }, "deleteAutomationProgram");
}
