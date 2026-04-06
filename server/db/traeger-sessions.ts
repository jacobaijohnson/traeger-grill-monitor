import { getDb, withDbRetry, eq } from "./connection";
import {
  traegerSessions,
  type InsertTraegerSession,
} from "../../drizzle/schema";
import { encryptToken, decryptToken, isEncrypted } from "../crypto";

/** Encrypt token fields before writing to DB */
function encryptTokenFields<T extends { accessToken: string; idToken: string; refreshToken: string }>(
  data: T
): T {
  return {
    ...data,
    accessToken: encryptToken(data.accessToken),
    idToken: encryptToken(data.idToken),
    refreshToken: encryptToken(data.refreshToken),
  };
}

/** Decrypt token fields after reading from DB. Handles legacy plaintext gracefully. */
function decryptTokenFields<T extends { accessToken: string; idToken: string; refreshToken: string }>(
  data: T
): T {
  return {
    ...data,
    accessToken: isEncrypted(data.accessToken) ? (decryptToken(data.accessToken) ?? data.accessToken) : data.accessToken,
    idToken: isEncrypted(data.idToken) ? (decryptToken(data.idToken) ?? data.idToken) : data.idToken,
    refreshToken: isEncrypted(data.refreshToken) ? (decryptToken(data.refreshToken) ?? data.refreshToken) : data.refreshToken,
  };
}

export async function upsertTraegerSession(data: InsertTraegerSession) {
  const encrypted = encryptTokenFields({
    accessToken: data.accessToken,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
  });

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
          ...encrypted,
          expiresAt: data.expiresAt,
          grillsJson: data.grillsJson,
          selectedGrillId: data.selectedGrillId,
        })
        .where(eq(traegerSessions.userId, data.userId));
      return existing[0].id;
    } else {
      const insertResult = await db.insert(traegerSessions).values({
        ...data,
        ...encrypted,
      });
      return insertResult[0].insertId;
    }
  }, "upsertTraegerSession");

  if (result === null) throw new Error("Database not available");
  return result;
}

export async function getTraegerSession(userId: string) {
  const result = await withDbRetry(async (db) => {
    const rows = await db
      .select()
      .from(traegerSessions)
      .where(eq(traegerSessions.userId, userId))
      .limit(1);
    return rows.length > 0 ? rows[0] : undefined;
  }, "getTraegerSession");

  if (!result) return result;
  return decryptTokenFields(result);
}

export async function updateTraegerSessionTokens(
  userId: string,
  accessToken: string,
  idToken: string,
  refreshToken: string,
  expiresAt: number
) {
  const encrypted = encryptTokenFields({ accessToken, idToken, refreshToken });
  await withDbRetry(async (db) => {
    await db
      .update(traegerSessions)
      .set({ ...encrypted, expiresAt })
      .where(eq(traegerSessions.userId, userId));
  }, "updateTraegerSessionTokens");
}

export async function updateSelectedGrill(userId: string, grillId: string) {
  await withDbRetry(async (db) => {
    await db
      .update(traegerSessions)
      .set({ selectedGrillId: grillId })
      .where(eq(traegerSessions.userId, userId));
  }, "updateSelectedGrill");
}

export async function deleteTraegerSession(userId: string) {
  await withDbRetry(async (db) => {
    await db.delete(traegerSessions).where(eq(traegerSessions.userId, userId));
  }, "deleteTraegerSession");
}
