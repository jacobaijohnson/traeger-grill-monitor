/**
 * Admin Router — admin-only procedures for user management, registration, invites, and allowlist.
 * Also includes the first-boot setup wizard endpoints (public).
 */
import { z } from "zod";
import { router, adminProcedure, publicProcedure, protectedProcedure } from "../_core/trpc";
import { auth } from "../_core/auth";
import { fromNodeHeaders } from "better-auth/node";
import {
  listAllUsers,
  updateUserRole,
  banUser,
  unbanUser,
  deleteUser,
  getPendingUsers,
  approveUser,
  getRegistrationConfig,
  setRegistrationConfig,
  createInviteCode,
  listInviteCodes,
  deleteInviteCode,
  addToAllowlist,
  removeFromAllowlist,
  listAllowlist,
  setSetting,
  getSetting,
} from "../db";
import crypto from "crypto";

/**
 * Setup Router — public endpoints for the first-boot setup wizard.
 * When no admin user exists and no ADMIN_EMAIL env var is set,
 * the frontend shows an interactive setup page.
 */
export const setupRouter = router({
  /** Check if the system needs initial setup (no admin exists) */
  status: publicProcedure.query(async () => {
    const mysql = await import("mysql2/promise");
    const pool = mysql.createPool({ uri: process.env.DATABASE_URL! });
    try {
      const [rows] = await pool.execute(
        `SELECT COUNT(*) as count FROM user WHERE role = 'admin'`
      ) as any;
      const adminCount = rows[0]?.count ?? 0;
      return {
        needsSetup: adminCount === 0 && !process.env.ADMIN_EMAIL,
        hasAdmin: adminCount > 0,
      };
    } catch {
      // Table might not exist yet (pre-migration)
      return { needsSetup: true, hasAdmin: false };
    } finally {
      await pool.end();
    }
  }),

  /** Create the first admin user during initial setup */
  createAdmin: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8).max(128),
      name: z.string().min(1).max(128),
    }))
    .mutation(async ({ input }) => {
      // Only allow if no admin exists
      const mysql = await import("mysql2/promise");
      const pool = mysql.createPool({ uri: process.env.DATABASE_URL! });
      try {
        const [rows] = await pool.execute(
          `SELECT COUNT(*) as count FROM user WHERE role = 'admin'`
        ) as any;
        if (rows[0]?.count > 0) {
          throw new Error("Setup already completed — an admin user already exists.");
        }

        // Create user via Better Auth signup API
        const ctx = await auth.api.signUpEmail({
          body: {
            email: input.email,
            password: input.password,
            name: input.name,
          },
          headers: new Headers({ "x-setup-wizard": "true" }),
        });

        if (!ctx?.user) {
          throw new Error("Failed to create user account.");
        }

        // Promote to admin
        await pool.execute(
          `UPDATE user SET role = 'admin' WHERE id = ?`,
          [ctx.user.id]
        );

        return { success: true, email: input.email };
      } finally {
        await pool.end();
      }
    }),
});

/** Admin password change — admin can change their own password */
export const passwordRouter = router({
  /** Change own password (requires current password) */
  changeOwn: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(1).max(128),
      newPassword: z.string().min(8).max(128),
    }))
    .mutation(async ({ input, ctx }) => {
      // Use Better Auth's server-side changePassword API
      const result = await auth.api.changePassword({
        body: {
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
          revokeOtherSessions: true,
        },
        headers: fromNodeHeaders(ctx.req.headers),
      });
      return { success: true };
    }),

  /** Admin resets another user's password (no current password needed) */
  resetUser: adminProcedure
    .input(z.object({
      userId: z.string().max(128),
      newPassword: z.string().min(8).max(128),
    }))
    .mutation(async ({ input, ctx }) => {
      // Use Better Auth's admin setUserPassword API
      const result = await auth.api.setUserPassword({
        body: {
          userId: input.userId,
          newPassword: input.newPassword,
        },
        headers: fromNodeHeaders(ctx.req.headers),
      });
      return { success: true };
    }),
});

export const adminRouter = router({
  // ─── Users ──────────────────────────────────────────
  listUsers: adminProcedure.query(async () => {
    return listAllUsers();
  }),

  updateRole: adminProcedure
    .input(z.object({
      userId: z.string().max(128),
      role: z.enum(["admin", "trusted", "user"]),
    }))
    .mutation(async ({ input }) => {
      await updateUserRole(input.userId, input.role);
      return { success: true };
    }),

  banUser: adminProcedure
    .input(z.object({
      userId: z.string().max(128),
      reason: z.string().max(512).optional(),
    }))
    .mutation(async ({ input }) => {
      await banUser(input.userId, input.reason);
      return { success: true };
    }),

  unbanUser: adminProcedure
    .input(z.object({ userId: z.string().max(128) }))
    .mutation(async ({ input }) => {
      await unbanUser(input.userId);
      return { success: true };
    }),

  deleteUser: adminProcedure
    .input(z.object({ userId: z.string().max(128) }))
    .mutation(async ({ input, ctx }) => {
      // Prevent self-deletion
      if (input.userId === ctx.user.id) {
        throw new Error("Cannot delete your own account");
      }
      await deleteUser(input.userId);
      return { success: true };
    }),

  // ─── Pending Approvals ──────────────────────────────
  listPending: adminProcedure.query(async () => {
    return getPendingUsers();
  }),

  approveUser: adminProcedure
    .input(z.object({ userId: z.string().max(128) }))
    .mutation(async ({ input }) => {
      await approveUser(input.userId);
      return { success: true };
    }),

  // ─── Registration Config ────────────────────────────
  getRegistrationConfig: adminProcedure.query(async () => {
    return getRegistrationConfig();
  }),

  setRegistrationConfig: adminProcedure
    .input(z.object({
      mode: z.enum(["closed", "gated"]),
      gates: z.array(z.enum(["invite", "allowlist", "approval"])),
    }))
    .mutation(async ({ input }) => {
      await setRegistrationConfig(input.mode, input.gates);
      return { success: true };
    }),

  setInviteExpiryHours: adminProcedure
    .input(z.object({ hours: z.number().min(1).max(8760) }))
    .mutation(async ({ input }) => {
      await setSetting("invite_expiry_hours", String(input.hours));
      return { success: true };
    }),

  // ─── Invite Codes ──────────────────────────────────
  listInvites: adminProcedure.query(async () => {
    return listInviteCodes();
  }),

  createInvite: adminProcedure
    .input(z.object({
      expiryHours: z.number().min(1).max(8760).optional(),
    }).optional())
    .mutation(async ({ input, ctx }) => {
      const config = await getRegistrationConfig();
      const hours = input?.expiryHours ?? config.inviteExpiryHours;
      const code = crypto.randomBytes(4).toString("hex").toUpperCase();
      const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
      await createInviteCode(code, ctx.user.id, ctx.user.name, expiresAt);
      return { code, expiresAt };
    }),

  deleteInvite: adminProcedure
    .input(z.object({ id: z.number().int().min(1) }))
    .mutation(async ({ input }) => {
      await deleteInviteCode(input.id);
      return { success: true };
    }),

  // ─── Allowlist ──────────────────────────────────────
  listAllowlist: adminProcedure.query(async () => {
    return listAllowlist();
  }),

  addToAllowlist: adminProcedure
    .input(z.object({
      email: z.string().email(),
      note: z.string().max(2048).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await addToAllowlist(input.email, ctx.user.id, input.note);
      return { success: true };
    }),

  removeFromAllowlist: adminProcedure
    .input(z.object({ id: z.number().int().min(1) }))
    .mutation(async ({ input }) => {
      await removeFromAllowlist(input.id);
      return { success: true };
    }),
});
