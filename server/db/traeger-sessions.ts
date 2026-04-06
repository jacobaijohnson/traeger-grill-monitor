import { getDb, withDbRetry, eq } from "./connection";
import {
  traegerSessions,
  type InsertTraegerSession,
} from "../../drizzle/schema";

export async function upsertTraegerSession(data: InsertTraegerSession) {
  const result = await withDbRetry(async (db) => {
    const existing = await db
      .select()
      .from(traegerSessions)
      .where(eq(traegerSessions.userId, data.userId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(traegerSessions)
        .set({
          traegerEmail: data.traegerEmail,
          accessToken: data.accessToken,
          idToken: data.idToken,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt,
          grillsJson: data.grillsJson,
          selectedGrillId: data.selectedGrillId,
        })
        .where(eq(traegerSessions.userId, data.userId));
      return existing[0].id;
    } else {
      const insertResult = await db.insert(traegerSessions).values(data);
      return insertResult[0].insertId;
    }
  }, "upsertTraegerSession");

  if (result === null) throw new Error("Database not available");
  return result;
}

export async function getTraegerSession(userId: number) {
  return await withDbRetry(async (db) => {
    const result = await db
      .select()
      .from(traegerSessions)
      .where(eq(traegerSessions.userId, userId))
      .limit(1);
    return result.length > 0 ? result[0] : undefined;
  }, "getTraegerSession");
}

export async function updateTraegerSessionTokens(
  userId: number,
  accessToken: string,
  idToken: string,
  refreshToken: string,
  expiresAt: number
) {
  await withDbRetry(async (db) => {
    await db
      .update(traegerSessions)
      .set({ accessToken, idToken, refreshToken, expiresAt })
      .where(eq(traegerSessions.userId, userId));
  }, "updateTraegerSessionTokens");
}

export async function updateSelectedGrill(userId: number, grillId: string) {
  await withDbRetry(async (db) => {
    await db
      .update(traegerSessions)
      .set({ selectedGrillId: grillId })
      .where(eq(traegerSessions.userId, userId));
  }, "updateSelectedGrill");
}

export async function deleteTraegerSession(userId: number) {
  await withDbRetry(async (db) => {
    await db.delete(traegerSessions).where(eq(traegerSessions.userId, userId));
  }, "deleteTraegerSession");
}
