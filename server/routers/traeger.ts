import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  traegerLogin,
  traegerGetUser,
  traegerGetMqttCredentials,
} from "../traeger-api";
import {
  upsertTraegerSession,
  getTraegerSession,
  deleteTraegerSession,
  updateSelectedGrill,
} from "../db";
import { disconnectMqtt } from "../mqtt-manager";
import { getValidIdToken } from "./helpers";

export const traegerRouter = router({
  connect: protectedProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const tokens = await traegerLogin(input.email, input.password);
        const userData = await traegerGetUser(tokens.idToken);
        const expiresAt = Date.now() + tokens.expiresIn * 1000;
        await upsertTraegerSession({
          userId: ctx.user.id,
          traegerEmail: input.email,
          accessToken: tokens.accessToken,
          idToken: tokens.idToken,
          refreshToken: tokens.refreshToken,
          expiresAt,
          grillsJson: JSON.stringify(userData.things),
          selectedGrillId: userData.things.length > 0 ? userData.things[0].thingName : null,
        });
        return { success: true, user: userData, grills: userData.things };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Authentication failed";
        throw new TRPCError({ code: "UNAUTHORIZED", message: `Traeger login failed: ${message}` });
      }
    }),

  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    disconnectMqtt(ctx.user.id);
    await deleteTraegerSession(ctx.user.id);
    return { success: true };
  }),

  status: protectedProcedure.query(async ({ ctx }) => {
    const session = await getTraegerSession(ctx.user.id);
    if (!session) {
      return { connected: false, grills: [], selectedGrillId: null, email: null };
    }
    const grills = session.grillsJson ? (typeof session.grillsJson === 'string' ? JSON.parse(session.grillsJson) : session.grillsJson) : [];
    return { connected: true, grills, selectedGrillId: session.selectedGrillId, email: session.traegerEmail };
  }),

  refreshGrills: protectedProcedure.mutation(async ({ ctx }) => {
    const { idToken } = await getValidIdToken(ctx.user.id);
    const userData = await traegerGetUser(idToken);
    const session = await getTraegerSession(ctx.user.id);
    if (session) {
      await upsertTraegerSession({ ...session, grillsJson: JSON.stringify(userData.things) });
    }
    return { grills: userData.things };
  }),

  selectGrill: protectedProcedure
    .input(z.object({ grillId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await updateSelectedGrill(ctx.user.id, input.grillId);
      return { success: true };
    }),

  mqttCredentials: protectedProcedure.query(async ({ ctx }) => {
    const { idToken, session } = await getValidIdToken(ctx.user.id);
    if (!session.selectedGrillId) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No grill selected" });
    }
    const creds = await traegerGetMqttCredentials(idToken, session.selectedGrillId);
    return { ...creds, thingName: session.selectedGrillId };
  }),
});
