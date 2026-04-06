import { getDb, eq } from "./connection";
import {
  traegerSessions,
  type InsertTraegerSession,
} from "../../drizzle/schema";

export async function upsertTraegerSession(data: InsertTraegerSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

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
    const result = await db.insert(traegerSessions).values(data);
    return result[0].insertId;
  }
}

export async function getTraegerSession(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(traegerSessions)
    .where(eq(traegerSessions.userId, userId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateTraegerSessionTokens(
  userId: number,
  accessToken: string,
  idToken: string,
  refreshToken: string,
  expiresAt: number
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(traegerSessions)
    .set({ accessToken, idToken, refreshToken, expiresAt })
    .where(eq(traegerSessions.userId, userId));
}

export async function updateSelectedGrill(userId: number, grillId: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(traegerSessions)
    .set({ selectedGrillId: grillId })
    .where(eq(traegerSessions.userId, userId));
}

export async function deleteTraegerSession(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(traegerSessions).where(eq(traegerSessions.userId, userId));
}
