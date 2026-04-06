import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { traegerSendCommand } from "../traeger-api";
import { insertTelemetry, getRecentTelemetry, getTelemetryForSession } from "../db";
import { getTelemetry, getTelemetryHistory } from "../mqtt-manager";
import { COMMANDS } from "@shared/traeger-types";
import { getValidIdToken, ensureMqttConnected } from "./helpers";

export const grillRouter = router({
  sendCommand: protectedProcedure
    .input(z.object({ command: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { idToken, session } = await getValidIdToken(ctx.user.id);
      if (!session.selectedGrillId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No grill selected" });
      return traegerSendCommand(idToken, session.selectedGrillId, input.command);
    }),

  setTemp: protectedProcedure
    .input(z.object({ temp: z.number().min(165).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const { idToken, session } = await getValidIdToken(ctx.user.id);
      if (!session.selectedGrillId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No grill selected" });
      // P0-SEC: Validate grill state before high-temp commands
      const telemetry = getTelemetry(ctx.user.id);
      if (telemetry && !telemetry.connected) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Grill is not connected. Please ensure the grill is powered on and connected." });
      }
      return traegerSendCommand(idToken, session.selectedGrillId, `${COMMANDS.SET_TEMP},${input.temp}`);
    }),

  setTimer: protectedProcedure
    .input(z.object({ seconds: z.number().min(60).max(86400) }))
    .mutation(async ({ ctx, input }) => {
      const { idToken, session } = await getValidIdToken(ctx.user.id);
      if (!session.selectedGrillId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No grill selected" });
      return traegerSendCommand(idToken, session.selectedGrillId, `${COMMANDS.SET_TIMER},${input.seconds}`);
    }),

  clearTimer: protectedProcedure.mutation(async ({ ctx }) => {
    const { idToken, session } = await getValidIdToken(ctx.user.id);
    if (!session.selectedGrillId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No grill selected" });
    return traegerSendCommand(idToken, session.selectedGrillId, COMMANDS.CLEAR_TIMER);
  }),

  setProbeAlarm: protectedProcedure
    .input(z.object({ temp: z.number().min(100).max(220) }))
    .mutation(async ({ ctx, input }) => {
      const { idToken, session } = await getValidIdToken(ctx.user.id);
      if (!session.selectedGrillId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No grill selected" });
      return traegerSendCommand(idToken, session.selectedGrillId, `${COMMANDS.SET_PROBE_ALARM},${input.temp}`);
    }),

  setSuperSmoke: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { idToken, session } = await getValidIdToken(ctx.user.id);
      if (!session.selectedGrillId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No grill selected" });
      return traegerSendCommand(idToken, session.selectedGrillId, input.enabled ? COMMANDS.SUPER_SMOKE_ON : COMMANDS.SUPER_SMOKE_OFF);
    }),

  setKeepWarm: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { idToken, session } = await getValidIdToken(ctx.user.id);
      if (!session.selectedGrillId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No grill selected" });
      return traegerSendCommand(idToken, session.selectedGrillId, input.enabled ? COMMANDS.KEEP_WARM_ON : COMMANDS.KEEP_WARM_OFF);
    }),

  shutdown: protectedProcedure.mutation(async ({ ctx }) => {
    const { idToken, session } = await getValidIdToken(ctx.user.id);
    if (!session.selectedGrillId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No grill selected" });
    return traegerSendCommand(idToken, session.selectedGrillId, COMMANDS.SHUTDOWN);
  }),

  requestStatus: protectedProcedure.mutation(async ({ ctx }) => {
    const { idToken, session } = await getValidIdToken(ctx.user.id);
    if (!session.selectedGrillId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No grill selected" });
    return traegerSendCommand(idToken, session.selectedGrillId, COMMANDS.STATUS_REQUEST);
  }),

  // Get live telemetry from MQTT cache (auto-connects MQTT if needed)
  telemetry: protectedProcedure.query(async ({ ctx }) => {
    await ensureMqttConnected(ctx.user.id);
    const cached = getTelemetry(ctx.user.id);
    if (cached) return cached;
    return { connected: false, mqttConnected: false, lastUpdate: 0, grill: 0, set: 0, ambient: 0, pelletLevel: 0, systemStatus: 99, probe: 0, probeSet: 0, probeCon: 0, probeAlarmFired: 0, keepwarm: 0, smoke: 0, units: 1, cookTimerStart: 0, cookTimerEnd: 0, acc: [] };
  }),

  // Get telemetry history for charting
  telemetryHistory: protectedProcedure
    .input(z.object({ minutes: z.number().min(1).max(1440).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const history = getTelemetryHistory(ctx.user.id, input?.minutes);
      return history.map(h => ({
        timestamp: h.timestamp,
        grill: h.grill,
        probe: h.probe,
        ambient: h.ambient,
        set: h.set,
        pelletLevel: h.pelletLevel,
        systemStatus: h.systemStatus,
        smoke: h.smoke,
        keepwarm: h.keepwarm,
      }));
    }),
});

// DB-backed telemetry router (separate from MQTT live data)
export const telemetryRouter = router({
  record: protectedProcedure
    .input(z.object({
      grillId: z.string(),
      cookSessionId: z.number().optional(),
      grillTemp: z.number(),
      probeTemp: z.number().optional(),
      ambientTemp: z.number().optional(),
      targetTemp: z.number().optional(),
      pelletLevel: z.number().optional(),
      systemStatus: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await insertTelemetry({
        userId: ctx.user.id,
        ...input,
        cookSessionId: input.cookSessionId ?? null,
        probeTemp: input.probeTemp ?? null,
        ambientTemp: input.ambientTemp ?? null,
        targetTemp: input.targetTemp ?? null,
        pelletLevel: input.pelletLevel ?? null,
        systemStatus: input.systemStatus ?? null,
      });
      return { success: true };
    }),

  recent: protectedProcedure
    .input(z.object({ grillId: z.string(), minutes: z.number().default(60) }))
    .query(async ({ ctx, input }) => {
      return getRecentTelemetry(ctx.user.id, input.grillId, input.minutes);
    }),

  forSession: protectedProcedure
    .input(z.object({ cookSessionId: z.number() }))
    .query(async ({ ctx, input }) => {
      return getTelemetryForSession(input.cookSessionId, 1000, ctx.user.id);
    }),
});
