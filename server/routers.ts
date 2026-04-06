import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  traegerLogin,
  traegerRefreshTokens,
  traegerGetUser,
  traegerGetMqttCredentials,
  traegerSendCommand,
} from "./traeger-api";
import {
  upsertTraegerSession,
  getTraegerSession,
  updateTraegerSessionTokens,
  updateSelectedGrill,
  deleteTraegerSession,
  insertTelemetry,
  getRecentTelemetry,
  createCookSession,
  endCookSession,
  updateCookSessionNotes,
  getUserCookSessions,
  getCookSession,
  getTelemetryForSession,
  createAutomationProgram,
  getUserAutomationPrograms,
  getActiveAutomation,
  updateAutomationState,
  deleteAutomationProgram,
  createCustomTemplate,
  getUserCustomTemplates,
  getPublishedTemplates,
  getCustomTemplate,
  updateCustomTemplate,
  deleteCustomTemplate,
  forkCustomTemplate,
  insertCookAlert,
  getCookAlertsForSession,
  updateCookAlertStatus,
  dismissCookAlert,
  getActiveCookSession,
  updateCookSessionStatus,
  updateCookSessionAlerts,
  persistTelemetryFromMqtt,
  getCookAnalyticsSummary,
  getCooksByMeatType,
  getCooksByMethod,
  getCooksByMonth,
  getCooksByCut,
  getRatingDistribution,
} from "./db";
import { COMMANDS } from "@shared/traeger-types";
import { COOK_TEMPLATES } from "@shared/cook-templates";
import { MEAT_PROFILES, getMeatProfile } from "@shared/meat-science";
import {
  connectMqtt,
  disconnectMqtt,
  getTelemetry,
  getTelemetryHistory,
  isMqttConnected,
  needsUrlRefresh,
  refreshMqttUrl,
  startCookSession as mqttStartCook,
  endCookSession as mqttEndCook,
  getActiveCook,
  dismissAlert as mqttDismissAlert,
  getFiredAlerts,
  getMissedAlerts,
  getStallInfo,
  addAlert as mqttAddAlert,
  removeAlert as mqttRemoveAlert,
  setDbPersistCallback,
  type CookAlert as MqttCookAlert,
  hydrateHistory,
} from "./mqtt-manager";

// Helper to get valid Traeger idToken, refreshing if needed.
async function getValidIdToken(userId: number): Promise<{ idToken: string; session: NonNullable<Awaited<ReturnType<typeof getTraegerSession>>> }> {
  const session = await getTraegerSession(userId);
  if (!session) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No Traeger account linked. Please connect your Traeger account first." });
  }
  if (Date.now() > session.expiresAt - 300000) {
    try {
      const tokens = await traegerRefreshTokens(session.refreshToken);
      const expiresAt = Date.now() + tokens.expiresIn * 1000;
      await updateTraegerSessionTokens(userId, tokens.accessToken, tokens.idToken, tokens.refreshToken, expiresAt);
      return { idToken: tokens.idToken, session: { ...session, idToken: tokens.idToken } };
    } catch {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Traeger session expired. Please reconnect your account." });
    }
  }
  return { idToken: session.idToken, session };
}

// Helper to ensure MQTT is connected and DB persistence is wired
async function ensureMqttConnected(userId: number) {
  const { idToken, session } = await getValidIdToken(userId);
  if (!session.selectedGrillId) return { idToken, session };

  if (!isMqttConnected(userId) || needsUrlRefresh(userId)) {
    try {
      const creds = await traegerGetMqttCredentials(idToken, session.selectedGrillId);
      const expiresAt = Date.now() + creds.expirationSeconds * 1000;
      if (needsUrlRefresh(userId)) {
        refreshMqttUrl(userId, session.selectedGrillId, creds.signedUrl, expiresAt);
      } else {
        connectMqtt(userId, session.selectedGrillId, creds.signedUrl, expiresAt);
      }
      // Wire DB persistence callback
      setDbPersistCallback(userId, async (uid, telemetry, cookSessionId) => {
        const sess = await getTraegerSession(uid);
        if (!sess?.selectedGrillId) return;
        await persistTelemetryFromMqtt(uid, telemetry, sess.selectedGrillId, cookSessionId);
      });
      // Hydrate in-memory history from DB (last 8 hours)
      try {
        const dbHistory = await getRecentTelemetry(userId, session.selectedGrillId, 480);
        if (dbHistory.length > 0) {
          const hydrated = hydrateHistory(userId, dbHistory);
          console.log(`[Telemetry] Hydrated ${hydrated} DB points for user ${userId}`);
        }
      } catch (err) {
        console.error("[Telemetry] Failed to hydrate history:", err);
      }
      // Trigger status request
      try {
        await traegerSendCommand(idToken, session.selectedGrillId, COMMANDS.STATUS_REQUEST);
      } catch { /* non-critical */ }
    } catch (err) {
      console.error("[Telemetry] Failed to connect MQTT:", err);
    }
  }
  return { idToken, session };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ===== Traeger Account =====
  traeger: router({
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
  }),

  // ===== Grill Commands =====
  grill: router({
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
  }),

  // ===== Telemetry (DB-backed) =====
  telemetry: router({
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
      .query(async ({ input }) => {
        return getTelemetryForSession(input.cookSessionId);
      }),
  }),

  // ===== Live Cook Session (Server-Side State Machine) =====
  liveCook: router({
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
          // End the existing session
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
            // Respect user's notification/alarm preferences
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

            // Also persist to DB
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

        // Also persist to DB
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
      .query(async ({ input }) => {
        return getCookAlertsForSession(input.cookSessionId);
      }),
  }),

  // ===== Cook Sessions (History) =====
  cookSession: router({
    start: protectedProcedure
      .input(z.object({
        grillId: z.string(),
        templateId: z.string().optional(),
        meatType: z.string().optional(),
        cutName: z.string().optional(),
        method: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await createCookSession({
          userId: ctx.user.id,
          grillId: input.grillId,
          templateId: input.templateId ?? null,
          meatType: input.meatType ?? null,
          cutName: input.cutName ?? null,
          method: input.method ?? null,
          notes: null,
          rating: null,
          endedAt: null,
        });
        return { id };
      }),

    end: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await endCookSession(input.id);
        return { success: true };
      }),

    updateNotes: protectedProcedure
      .input(z.object({ id: z.number(), notes: z.string(), rating: z.number().min(1).max(5).optional() }))
      .mutation(async ({ input }) => {
        await updateCookSessionNotes(input.id, input.notes, input.rating);
        return { success: true };
      }),

    list: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }).optional())
      .query(async ({ ctx, input }) => {
        return getUserCookSessions(ctx.user.id, input?.limit ?? 50);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getCookSession(input.id);
      }),
  }),

  // ===== Cook Templates =====
  templates: router({
    list: publicProcedure
      .input(z.object({ category: z.string().optional(), method: z.string().optional() }).optional())
      .query(({ input }) => {
        let templates = COOK_TEMPLATES;
        if (input?.category) templates = templates.filter((t) => t.category === input.category);
        if (input?.method) templates = templates.filter((t) => t.method === input.method);
        return templates;
      }),

    get: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => {
        const template = COOK_TEMPLATES.find((t) => t.id === input.id);
        if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        return template;
      }),
  }),

  // ===== Custom Cook Templates =====
  customTemplates: router({
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(128),
        description: z.string().optional(),
        category: z.string(),
        method: z.string(),
        meatCut: z.string().optional(),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
        estimatedTime: z.string().optional(),
        stages: z.array(z.object({
          name: z.string(),
          grillTemp: z.number(),
          triggerType: z.enum(["time", "probe_temp", "manual"]),
          triggerValue: z.number(),
          superSmoke: z.boolean(),
          alertMessage: z.string(),
        })),
        tips: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await createCustomTemplate({
          userId: ctx.user.id,
          authorName: ctx.user.name || "Anonymous Pitmaster",
          name: input.name,
          description: input.description ?? null,
          category: input.category,
          method: input.method,
          meatCut: input.meatCut ?? null,
          difficulty: input.difficulty,
          estimatedTime: input.estimatedTime ?? null,
          stagesJson: JSON.stringify(input.stages),
          tipsJson: input.tips ? JSON.stringify(input.tips) : null,
          isPublished: 0,
          forkCount: 0,
          forkedFromId: null,
        });
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(128).optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        method: z.string().optional(),
        meatCut: z.string().optional(),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
        estimatedTime: z.string().optional(),
        stages: z.array(z.object({
          name: z.string(),
          grillTemp: z.number(),
          triggerType: z.enum(["time", "probe_temp", "manual"]),
          triggerValue: z.number(),
          superSmoke: z.boolean(),
          alertMessage: z.string(),
        })).optional(),
        tips: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const updateData: Record<string, unknown> = {};
        if (input.name) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.category) updateData.category = input.category;
        if (input.method) updateData.method = input.method;
        if (input.meatCut !== undefined) updateData.meatCut = input.meatCut;
        if (input.difficulty) updateData.difficulty = input.difficulty;
        if (input.estimatedTime !== undefined) updateData.estimatedTime = input.estimatedTime;
        if (input.stages) updateData.stagesJson = JSON.stringify(input.stages);
        if (input.tips) updateData.tipsJson = JSON.stringify(input.tips);
        await updateCustomTemplate(input.id, ctx.user.id, updateData);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteCustomTemplate(input.id, ctx.user.id);
        return { success: true };
      }),

    publish: protectedProcedure
      .input(z.object({ id: z.number(), publish: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await updateCustomTemplate(input.id, ctx.user.id, { isPublished: input.publish ? 1 : 0 });
        return { success: true };
      }),

    mine: protectedProcedure.query(async ({ ctx }) => {
      return getUserCustomTemplates(ctx.user.id);
    }),

    community: publicProcedure
      .input(z.object({ limit: z.number().default(50) }).optional())
      .query(async ({ input }) => {
        return getPublishedTemplates(input?.limit ?? 50);
      }),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const template = await getCustomTemplate(input.id);
        if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        return template;
      }),

    fork: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const newId = await forkCustomTemplate(input.id, ctx.user.id, ctx.user.name || "Anonymous Pitmaster");
        return { id: newId };
      }),
  }),

  // ===== Meat Profiles =====
  meatProfiles: router({
    list: publicProcedure.query(() => {
      return Object.values(MEAT_PROFILES).map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        markerCount: p.markers.length,
      }));
    }),

    get: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => {
        const profile = MEAT_PROFILES[input.id];
        if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Meat profile not found" });
        return profile;
      }),

    byCategory: publicProcedure.query(() => {
      const grouped: Record<string, Array<{ id: string; name: string; markerCount: number }>> = {};
      for (const profile of Object.values(MEAT_PROFILES)) {
        if (!grouped[profile.category]) grouped[profile.category] = [];
        grouped[profile.category].push({ id: profile.id, name: profile.name, markerCount: profile.markers.length });
      }
      return grouped;
    }),
  }),

  // ===== Automation (legacy, kept for backward compat) =====
  automation: router({
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        templateId: z.string().optional(),
        stages: z.array(z.object({
          name: z.string(),
          grillTemp: z.number(),
          triggerType: z.enum(["time", "probe_temp", "manual"]),
          triggerValue: z.number(),
          superSmoke: z.boolean(),
          alertMessage: z.string(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await createAutomationProgram({
          userId: ctx.user.id,
          name: input.name,
          description: input.description ?? null,
          templateId: input.templateId ?? null,
          stagesJson: JSON.stringify(input.stages),
          isActive: 0,
          currentStage: 0,
          cookSessionId: null,
          startedAt: null,
        });
        return { id };
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserAutomationPrograms(ctx.user.id);
    }),

    getActive: protectedProcedure.query(async ({ ctx }) => {
      return getActiveAutomation(ctx.user.id);
    }),

    start: protectedProcedure
      .input(z.object({ id: z.number(), cookSessionId: z.number().optional() }))
      .mutation(async ({ input }) => {
        await updateAutomationState(input.id, 0, true);
        return { success: true };
      }),

    advanceStage: protectedProcedure
      .input(z.object({ id: z.number(), nextStage: z.number() }))
      .mutation(async ({ input }) => {
        await updateAutomationState(input.id, input.nextStage, true);
        return { success: true };
      }),

    stop: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await updateAutomationState(input.id, 0, false);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteAutomationProgram(input.id);
        return { success: true };
      }),
  }),

  // ===== Cook Analytics =====
  analytics: router({
    summary: protectedProcedure
      .query(async ({ ctx }) => {
        return getCookAnalyticsSummary(ctx.user.id);
      }),

    byMeatType: protectedProcedure
      .query(async ({ ctx }) => {
        return getCooksByMeatType(ctx.user.id);
      }),

    byMethod: protectedProcedure
      .query(async ({ ctx }) => {
        return getCooksByMethod(ctx.user.id);
      }),

    byMonth: protectedProcedure
      .query(async ({ ctx }) => {
        return getCooksByMonth(ctx.user.id);
      }),

    byCut: protectedProcedure
      .query(async ({ ctx }) => {
        return getCooksByCut(ctx.user.id);
      }),

    ratingDistribution: protectedProcedure
      .query(async ({ ctx }) => {
        return getRatingDistribution(ctx.user.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
