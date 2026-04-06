/**
 * DB helpers for access control: invites, allowlist, app settings, and user management.
 */
import { eq, and, isNull, gt, sql, desc } from "drizzle-orm";
import { inviteCodes, emailAllowlist, appSettings } from "../../drizzle/schema";
import { withDbRetry } from "./connection";

// ─── App Settings ──────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  return withDbRetry(async (db) => {
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
    return rows[0]?.value ?? null;
  });
}

export async function setSetting(key: string, value: string): Promise<void> {
  await withDbRetry(async (db) => {
    await db.insert(appSettings).values({ key, value })
      .onDuplicateKeyUpdate({ set: { value } });
  });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  return (await withDbRetry(async (db) => {
    const rows = await db.select().from(appSettings);
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  })) ?? {};
}

// ─── Registration Mode ─────────────────────────────────

export type RegistrationMode = "closed" | "gated";
export type RegistrationGate = "invite" | "allowlist" | "approval";

export async function getRegistrationConfig(): Promise<{
  mode: RegistrationMode;
  gates: RegistrationGate[];
  inviteExpiryHours: number;
}> {
  const settings = await getAllSettings();
  return {
    mode: (settings["registration_mode"] as RegistrationMode) || "closed",
    gates: JSON.parse(settings["registration_gates"] || "[]") as RegistrationGate[],
    inviteExpiryHours: parseInt(settings["invite_expiry_hours"] || "168", 10),
  };
}

export async function setRegistrationConfig(
  mode: RegistrationMode,
  gates: RegistrationGate[]
): Promise<void> {
  await setSetting("registration_mode", mode);
  await setSetting("registration_gates", JSON.stringify(gates));
}

// ─── Invite Codes ──────────────────────────────────────

export async function createInviteCode(
  code: string,
  createdByUserId: string,
  createdByName: string | null,
  expiresAt: Date
): Promise<void> {
  await withDbRetry(async (db) => {
    await db.insert(inviteCodes).values({
      code,
      createdByUserId,
      createdByName,
      expiresAt,
    });
  });
}

export async function validateInviteCode(code: string): Promise<boolean> {
  return (await withDbRetry(async (db) => {
    const rows = await db.select().from(inviteCodes)
      .where(
        and(
          eq(inviteCodes.code, code),
          isNull(inviteCodes.usedAt),
          gt(inviteCodes.expiresAt, new Date())
        )
      )
      .limit(1);
    return rows.length > 0;
  })) ?? false;
}

export async function consumeInviteCode(
  code: string,
  usedByUserId: string,
  usedByEmail: string
): Promise<boolean> {
  return (await withDbRetry(async (db) => {
    const result = await db.update(inviteCodes)
      .set({
        usedByUserId,
        usedByEmail,
        usedAt: new Date(),
      })
      .where(
        and(
          eq(inviteCodes.code, code),
          isNull(inviteCodes.usedAt),
          gt(inviteCodes.expiresAt, new Date())
        )
      );
    return ((result as any)[0]?.affectedRows ?? 0) > 0;
  })) ?? false;
}

export async function listInviteCodes(createdByUserId?: string) {
  return withDbRetry(async (db) => {
    const query = createdByUserId
      ? db.select().from(inviteCodes).where(eq(inviteCodes.createdByUserId, createdByUserId)).orderBy(desc(inviteCodes.createdAt))
      : db.select().from(inviteCodes).orderBy(desc(inviteCodes.createdAt));
    return query;
  });
}

export async function deleteInviteCode(id: number): Promise<void> {
  await withDbRetry(async (db) => {
    await db.delete(inviteCodes).where(eq(inviteCodes.id, id));
  });
}

// ─── Email Allowlist ───────────────────────────────────

export async function isEmailAllowed(email: string): Promise<boolean> {
  return (await withDbRetry(async (db) => {
    const rows = await db.select().from(emailAllowlist)
      .where(eq(emailAllowlist.email, email.toLowerCase()))
      .limit(1);
    return rows.length > 0;
  })) ?? false;
}

export async function addToAllowlist(
  email: string,
  addedByUserId: string,
  note?: string
): Promise<void> {
  await withDbRetry(async (db) => {
    await db.insert(emailAllowlist).values({
      email: email.toLowerCase(),
      addedByUserId,
      note: note || null,
    }).onDuplicateKeyUpdate({ set: { note: note || null } });
  });
}

export async function removeFromAllowlist(id: number): Promise<void> {
  await withDbRetry(async (db) => {
    await db.delete(emailAllowlist).where(eq(emailAllowlist.id, id));
  });
}

export async function listAllowlist() {
  return withDbRetry(async (db) => {
    return db.select().from(emailAllowlist).orderBy(desc(emailAllowlist.createdAt));
  });
}

// ─── User Management (via Better Auth tables) ──────────

export async function listAllUsers() {
  return withDbRetry(async (db) => {
    const rows = await db.execute(sql.raw(
      `SELECT id, name, email, role, banned, banReason, createdAt, updatedAt FROM user ORDER BY createdAt DESC`
    ));
    return (rows as any)[0] || [];
  });
}

export async function updateUserRole(userId: string, role: string): Promise<void> {
  await withDbRetry(async (db) => {
    await db.execute(sql.raw(
      `UPDATE user SET role = '${role}', updatedAt = NOW() WHERE id = '${userId}'`
    ));
  });
}

export async function banUser(userId: string, reason?: string): Promise<void> {
  await withDbRetry(async (db) => {
    const banReason = reason ? `'${reason.replace(/'/g, "''")}'` : "NULL";
    await db.execute(sql.raw(
      `UPDATE user SET banned = 1, banReason = ${banReason}, updatedAt = NOW() WHERE id = '${userId}'`
    ));
  });
}

export async function unbanUser(userId: string): Promise<void> {
  await withDbRetry(async (db) => {
    await db.execute(sql.raw(
      `UPDATE user SET banned = 0, banReason = NULL, updatedAt = NOW() WHERE id = '${userId}'`
    ));
  });
}

export async function deleteUser(userId: string): Promise<void> {
  await withDbRetry(async (db) => {
    // Delete from Better Auth tables
    await db.execute(sql.raw(`DELETE FROM session WHERE userId = '${userId}'`));
    await db.execute(sql.raw(`DELETE FROM account WHERE userId = '${userId}'`));
    await db.execute(sql.raw(`DELETE FROM user WHERE id = '${userId}'`));
  });
}

export async function getPendingUsers() {
  return withDbRetry(async (db) => {
    const rows = await db.execute(sql.raw(
      `SELECT id, name, email, createdAt FROM user WHERE banned = 1 AND banReason = 'pending_approval' ORDER BY createdAt DESC`
    ));
    return (rows as any)[0] || [];
  });
}

export async function approveUser(userId: string): Promise<void> {
  await withDbRetry(async (db) => {
    await db.execute(sql.raw(
      `UPDATE user SET banned = 0, banReason = NULL, updatedAt = NOW() WHERE id = '${userId}'`
    ));
  });
}
