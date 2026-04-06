import { getDb, eq, and, desc, sql } from "./connection";
import {
  customTemplates,
  automationPrograms,
  type InsertCustomTemplate,
  type InsertAutomationProgram,
} from "../../drizzle/schema";

// ===== Custom Cook Templates =====

export async function createCustomTemplate(data: InsertCustomTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(customTemplates).values(data);
  return result[0].insertId;
}

export async function getUserCustomTemplates(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(customTemplates)
    .where(eq(customTemplates.userId, userId))
    .orderBy(desc(customTemplates.updatedAt));
}

export async function getPublishedTemplates(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(customTemplates)
    .where(eq(customTemplates.isPublished, 1))
    .orderBy(desc(customTemplates.forkCount), desc(customTemplates.createdAt))
    .limit(limit);
}

export async function getCustomTemplate(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customTemplates).where(eq(customTemplates.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateCustomTemplate(
  id: number,
  userId: number,
  data: Partial<InsertCustomTemplate>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(customTemplates)
    .set(data)
    .where(and(eq(customTemplates.id, id), eq(customTemplates.userId, userId)));
}

export async function deleteCustomTemplate(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(customTemplates)
    .where(and(eq(customTemplates.id, id), eq(customTemplates.userId, userId)));
}

export async function forkCustomTemplate(id: number, userId: number, authorName: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const original = await getCustomTemplate(id);
  if (!original) throw new Error("Template not found");

  // Increment fork count on original
  await db
    .update(customTemplates)
    .set({ forkCount: sql`${customTemplates.forkCount} + 1` })
    .where(eq(customTemplates.id, id));

  // Create the fork
  const result = await db.insert(customTemplates).values({
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
  return result[0].insertId;
}

// ===== Automation Programs =====

export async function createAutomationProgram(data: InsertAutomationProgram) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(automationPrograms).values(data);
  return result[0].insertId;
}

export async function getUserAutomationPrograms(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(automationPrograms)
    .where(eq(automationPrograms.userId, userId))
    .orderBy(desc(automationPrograms.createdAt));
}

export async function getActiveAutomation(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(automationPrograms)
    .where(and(eq(automationPrograms.userId, userId), eq(automationPrograms.isActive, 1)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateAutomationState(id: number, currentStage: number, isActive: boolean) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(automationPrograms)
    .set({ currentStage, isActive: isActive ? 1 : 0 })
    .where(eq(automationPrograms.id, id));
}

export async function deleteAutomationProgram(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(automationPrograms).where(eq(automationPrograms.id, id));
}
