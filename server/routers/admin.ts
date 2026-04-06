/**
 * Admin Router — admin-only procedures for user management, registration, invites, and allowlist.
 */
import { z } from "zod";
import { router, adminProcedure } from "../_core/trpc";
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

export const adminRouter = router({
  // ─── Users ──────────────────────────────────────────
  listUsers: adminProcedure.query(async () => {
    return listAllUsers();
  }),

  updateRole: adminProcedure
    .input(z.object({
      userId: z.string(),
      role: z.enum(["admin", "trusted", "user"]),
    }))
    .mutation(async ({ input }) => {
      await updateUserRole(input.userId, input.role);
      return { success: true };
    }),

  banUser: adminProcedure
    .input(z.object({
      userId: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await banUser(input.userId, input.reason);
      return { success: true };
    }),

  unbanUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      await unbanUser(input.userId);
      return { success: true };
    }),

  deleteUser: adminProcedure
    .input(z.object({ userId: z.string() }))
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
    .input(z.object({ userId: z.string() }))
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
    .input(z.object({ id: z.number() }))
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
      note: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await addToAllowlist(input.email, ctx.user.id, input.note);
      return { success: true };
    }),

  removeFromAllowlist: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await removeFromAllowlist(input.id);
      return { success: true };
    }),
});
