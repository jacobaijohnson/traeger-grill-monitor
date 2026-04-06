import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createCookSession,
  getActiveCookSession,
  updateCookSessionStatus,
  updateCookSessionNotes,
  insertCookAlert,
  getCookAlertsForSession,
} from "../db";
import { getMeatProfile } from "@shared/meat-science";
import {
  startCookSession as mqttStartCook,
  endCookSession as mqttEndCook,
  getActiveCook,
  dismissAlert as mqttDismissAlert,
  getFiredAlerts,
  getMissedAlerts,
  getStallInfo,
  addAlert as mqttAddAlert,
  removeAlert as mqttRemoveAlert,
  type CookAlert as MqttCookAlert,
} from "../mqtt-manager";
import { ensureMqttConnected } from "./helpers";

export const liveCookRouter = router({
  // Get the current active cook session (from DB + MQTT state)
  active: protectedProcedure.query(async ({ ctx }) => {
    await ensureMqttConnected(ctx.user.id);
    const dbSession = await getActiveCookSession(ctx.user.id);
    const mqttCook = getActiveCook(ctx.user.id);
    const stallInfo = getStallInfo(ctx.user.id);
    const firedAlerts = getFiredAlerts(ctx.user.id);
    const missedAlerts = getMissedAlerts(ctx.user.id);

    if (!dbSession && !mqttCook) return null;

    return {
      session: dbSession,
      mqttState: mqttCook ? {
        startedAt: mqttCook.startedAt,
        currentStage: mqttCook.currentStage,
        peakGrillTemp: mqttCook.peakGrillTemp,
        peakProbeTemp: mqttCook.peakProbeTemp,
        alerts: mqttCook.alerts,
      } : null,
      stallInfo,
      firedAlerts,
      missedAlerts,
    };
  }),

  // Start a new cook session (from Cook Guide or manual)
  start: protectedProcedure
    .input(z.object({
      grillId: z.string(),
      templateId: z.string().optional(),
      meatType: z.string().optional(),
      cutName: z.string().optional(),
      method: z.string().optional(),
      meatProfileId: z.string().optional(),
      stages: z.array(z.object({
        name: z.string(),
        grillTemp: z.number(),
        triggerType: z.enum(["time", "probe_temp", "manual"]),
        triggerValue: z.number(),
        superSmoke: z.boolean(),
        alertMessage: z.string(),
      })).optional(),
      enableNotifications: z.boolean().default(true),
      enableAlarms: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check for existing active session
      const existing = await getActiveCookSession(ctx.user.id);
      if (existing) {
        await updateCookSessionStatus(existing.id, "completed", { endedAt: new Date() });
        mqttEndCook(ctx.user.id);
      }

      // Create DB session
      const sessionId = await createCookSession({
        userId: ctx.user.id,
        grillId: input.grillId,
        templateId: input.templateId ?? null,
        meatType: input.meatType ?? null,
        cutName: input.cutName ?? null,
        method: input.method ?? null,
        notes: null,
        rating: null,
        endedAt: null,
        stagesJson: input.stages ? JSON.stringify(input.stages) : null,
        status: "active",
        currentStage: 0,
      });

      // Build alerts from meat profile markers
      const alerts: MqttCookAlert[] = [];
      const meatProfile = getMeatProfile(input.meatProfileId, input.meatType, input.cutName);
      if (meatProfile) {
        for (const marker of meatProfile.markers) {
          if (marker.alertType === "none") continue;
          if (marker.alertType === "notification" && !input.enableNotifications) continue;
          if (marker.alertType === "alarm" && !input.enableAlarms) continue;

          const alert: MqttCookAlert = {
            id: `marker-${marker.temp}-${Date.now()}`,
            label: marker.label,
            triggerTemp: marker.temp,
            triggerType: "probe",
            alertType: marker.alertType,
            status: "pending",
            message: marker.alertMessage,
          };
          alerts.push(alert);

          await insertCookAlert({
            userId: ctx.user.id,
            cookSessionId: sessionId,
            alertType: marker.alertType,
            label: marker.label,
            triggerTemp: marker.temp,
            triggerType: "probe",
            status: "pending",
          });
        }
      }

      // Start MQTT cook tracking
      mqttStartCook(ctx.user.id, sessionId, {
        templateId: input.templateId,
        meatProfileId: input.meatProfileId,
        alerts,
        stages: input.stages?.map(s => ({ name: s.name, temp: s.grillTemp, duration: s.triggerType === "time" ? s.triggerValue : undefined })),
      });

      return { id: sessionId, alertCount: alerts.length };
    }),

  // End the active cook session
  end: protectedProcedure
    .input(z.object({ notes: z.string().optional(), rating: z.number().min(1).max(5).optional() }))
    .mutation(async ({ ctx, input }) => {
      const dbSession = await getActiveCookSession(ctx.user.id);
      if (!dbSession) throw new TRPCError({ code: "NOT_FOUND", message: "No active cook session" });

      const mqttCook = mqttEndCook(ctx.user.id);
      await updateCookSessionStatus(dbSession.id, "completed", {
        endedAt: new Date(),
        peakGrillTemp: mqttCook?.peakGrillTemp,
        peakProbeTemp: mqttCook?.peakProbeTemp,
      });
      if (input.notes || input.rating) {
        await updateCookSessionNotes(dbSession.id, input.notes || "", input.rating);
      }
      return { success: true };
    }),

  // Cancel the active cook session
  cancel: protectedProcedure.mutation(async ({ ctx }) => {
    const dbSession = await getActiveCookSession(ctx.user.id);
    if (dbSession) {
      await updateCookSessionStatus(dbSession.id, "cancelled", { endedAt: new Date() });
    }
    mqttEndCook(ctx.user.id);
    return { success: true };
  }),

  // Dismiss a fired alert
  dismissAlert: protectedProcedure
    .input(z.object({ alertId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      mqttDismissAlert(ctx.user.id, input.alertId);
      return { success: true };
    }),

  // Add a custom alert to the active cook
  addAlert: protectedProcedure
    .input(z.object({
      label: z.string(),
      triggerTemp: z.number(),
      triggerType: z.enum(["probe", "grill"]).default("probe"),
      alertType: z.enum(["notification", "alarm"]).default("notification"),
    }))
    .mutation(async ({ ctx, input }) => {
      const alert: MqttCookAlert = {
        id: `custom-${Date.now()}`,
        label: input.label,
        triggerTemp: input.triggerTemp,
        triggerType: input.triggerType,
        alertType: input.alertType,
        status: "pending",
        message: `${input.label} at ${input.triggerTemp}°F`,
      };
      const added = mqttAddAlert(ctx.user.id, alert);
      if (!added) throw new TRPCError({ code: "NOT_FOUND", message: "No active cook session" });

      const dbSession = await getActiveCookSession(ctx.user.id);
      if (dbSession) {
        await insertCookAlert({
          userId: ctx.user.id,
          cookSessionId: dbSession.id,
          alertType: input.alertType,
          label: input.label,
          triggerTemp: input.triggerTemp,
          triggerType: input.triggerType,
          status: "pending",
        });
      }
      return { id: alert.id };
    }),

  // Remove a pending alert
  removeAlert: protectedProcedure
    .input(z.object({ alertId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      mqttRemoveAlert(ctx.user.id, input.alertId);
      return { success: true };
    }),

  // Get stall detection info
  stallInfo: protectedProcedure.query(async ({ ctx }) => {
    return getStallInfo(ctx.user.id);
  }),

  // Get alerts for a specific cook session (from DB, for history)
  sessionAlerts: protectedProcedure
    .input(z.object({ cookSessionId: z.number() }))
    .query(async ({ ctx, input }) => {
      return getCookAlertsForSession(input.cookSessionId, ctx.user.id);
    }),
});
