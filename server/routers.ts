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
} from "./db";
import { COMMANDS } from "@shared/traeger-types";
import { COOK_TEMPLATES } from "@shared/cook-templates";

// Helper to get valid Traeger access token, refreshing if needed
async function getValidAccessToken(userId: number): Promise<{ accessToken: string; session: NonNullable<Awaited<ReturnType<typeof getTraegerSession>>> }> {
  const session = await getTraegerSession(userId);
  if (!session) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No Traeger account linked. Please connect your Traeger account first." });
  }

  // If token expires within 5 minutes, refresh
  if (Date.now() > session.expiresAt - 300000) {
    try {
      const tokens = await traegerRefreshTokens(session.refreshToken);
      const expiresAt = Date.now() + tokens.expiresIn * 1000;
      await updateTraegerSessionTokens(userId, tokens.accessToken, tokens.idToken, tokens.refreshToken, expiresAt);
      return { accessToken: tokens.accessToken, session: { ...session, accessToken: tokens.accessToken } };
    } catch {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Traeger session expired. Please reconnect your account." });
    }
  }

  return { accessToken: session.accessToken, session };
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
    // Connect Traeger account with email/password
    connect: protectedProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        try {
          const tokens = await traegerLogin(input.email, input.password);
          const userData = await traegerGetUser(tokens.accessToken);
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

          return {
            success: true,
            user: userData,
            grills: userData.things,
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Authentication failed";
          throw new TRPCError({ code: "UNAUTHORIZED", message: `Traeger login failed: ${message}` });
        }
      }),

    // Disconnect Traeger account
    disconnect: protectedProcedure.mutation(async ({ ctx }) => {
      await deleteTraegerSession(ctx.user.id);
      return { success: true };
    }),

    // Get current Traeger session status
    status: protectedProcedure.query(async ({ ctx }) => {
      const session = await getTraegerSession(ctx.user.id);
      if (!session) {
        return { connected: false, grills: [], selectedGrillId: null, email: null };
      }
      const grills = session.grillsJson ? (typeof session.grillsJson === 'string' ? JSON.parse(session.grillsJson) : session.grillsJson) : [];
      return {
        connected: true,
        grills,
        selectedGrillId: session.selectedGrillId,
        email: session.traegerEmail,
      };
    }),

    // Refresh grill list from Traeger API
    refreshGrills: protectedProcedure.mutation(async ({ ctx }) => {
      const { accessToken } = await getValidAccessToken(ctx.user.id);
      const userData = await traegerGetUser(accessToken);
      const session = await getTraegerSession(ctx.user.id);
      if (session) {
        await upsertTraegerSession({
          ...session,
          grillsJson: JSON.stringify(userData.things),
        });
      }
      return { grills: userData.things };
    }),

    // Select a grill
    selectGrill: protectedProcedure
      .input(z.object({ grillId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await updateSelectedGrill(ctx.user.id, input.grillId);
        return { success: true };
      }),

    // Get MQTT credentials for real-time connection
    mqttCredentials: protectedProcedure.query(async ({ ctx }) => {
      const { accessToken, session } = await getValidAccessToken(ctx.user.id);
      if (!session.selectedGrillId) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No grill selected" });
      }
      const creds = await traegerGetMqttCredentials(accessToken, session.selectedGrillId);
      return {
        ...creds,
        thingName: session.selectedGrillId,
      };
    }),
  }),

  // ===== Grill Commands =====
  grill: router({
    // Send a raw command
    sendCommand: protectedProcedure
      .input(z.object({ command: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { accessToken, session } = await getValidAccessToken(ctx.user.id);
        if (!session.selectedGrillId) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No grill selected" });
        }
        return traegerSendCommand(accessToken, session.selectedGrillId, input.command);
      }),

    // Set grill temperature
    setTemp: protectedProcedure
      .input(z.object({ temp: z.number().min(165).max(500) }))
      .mutation(async ({ ctx, input }) => {
        const { accessToken, session } = await getValidAccessToken(ctx.user.id);
        if (!session.selectedGrillId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No grill selected" });
        return traegerSendCommand(accessToken, session.selectedGrillId, `${COMMANDS.SET_TEMP},${input.temp}`);
      }),

    // Set cook timer (in seconds)
    setTimer: protectedProcedure
      .input(z.object({ seconds: z.number().min(60).max(86400) }))
      .mutation(async ({ ctx, input }) => {
        const { accessToken, session } = await getValidAccessToken(ctx.user.id);
        if (!session.selectedGrillId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No grill selected" });
        return traegerSendCommand(accessToken, session.selectedGrillId, `${COMMANDS.SET_TIMER},${input.seconds}`);
      }),

    // Clear cook timer
    clearTimer: protectedProcedure.mutation(async ({ ctx }) => {
      const { accessToken, session } = await getValidAccessToken(ctx.user.id);
      if (!session.selectedGrillId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No grill selected" });
      return traegerSendCommand(accessToken, session.selectedGrillId, COMMANDS.CLEAR_TIMER);
    }),

    // Set probe alarm temperature
    setProbeAlarm: protectedProcedure
      .input(z.object({ temp: z.number().min(100).max(220) }))
      .mutation(async ({ ctx, input }) => {
        const { accessToken, session } = await getValidAccessToken(ctx.user.id);
        if (!session.selectedGrillId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No grill selected" });
        return traegerSendCommand(accessToken, session.selectedGrillId, `${COMMANDS.SET_PROBE_ALARM},${input.temp}`);
      }),

    // Super Smoke toggle
    setSuperSmoke: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const { accessToken, session } = await getValidAccessToken(ctx.user.id);
        if (!session.selectedGrillId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No grill selected" });
        const cmd = input.enabled ? COMMANDS.SUPER_SMOKE_ON : COMMANDS.SUPER_SMOKE_OFF;
        return traegerSendCommand(accessToken, session.selectedGrillId, cmd);
      }),

    // Keep Warm toggle
    setKeepWarm: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const { accessToken, session } = await getValidAccessToken(ctx.user.id);
        if (!session.selectedGrillId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No grill selected" });
        const cmd = input.enabled ? COMMANDS.KEEP_WARM_ON : COMMANDS.KEEP_WARM_OFF;
        return traegerSendCommand(accessToken, session.selectedGrillId, cmd);
      }),

    // Shutdown
    shutdown: protectedProcedure.mutation(async ({ ctx }) => {
      const { accessToken, session } = await getValidAccessToken(ctx.user.id);
      if (!session.selectedGrillId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No grill selected" });
      return traegerSendCommand(accessToken, session.selectedGrillId, COMMANDS.SHUTDOWN);
    }),

    // Request status update
    requestStatus: protectedProcedure.mutation(async ({ ctx }) => {
      const { accessToken, session } = await getValidAccessToken(ctx.user.id);
      if (!session.selectedGrillId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No grill selected" });
      return traegerSendCommand(accessToken, session.selectedGrillId, COMMANDS.STATUS_REQUEST);
    }),
  }),

  // ===== Telemetry =====
  telemetry: router({
    // Record a telemetry reading
    record: protectedProcedure
      .input(
        z.object({
          grillId: z.string(),
          cookSessionId: z.number().optional(),
          grillTemp: z.number(),
          probeTemp: z.number().optional(),
          ambientTemp: z.number().optional(),
          targetTemp: z.number().optional(),
          pelletLevel: z.number().optional(),
          systemStatus: z.number().optional(),
        })
      )
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

    // Get recent telemetry for graphing
    recent: protectedProcedure
      .input(z.object({ grillId: z.string(), minutes: z.number().default(60) }))
      .query(async ({ ctx, input }) => {
        return getRecentTelemetry(ctx.user.id, input.grillId, input.minutes);
      }),

    // Get telemetry for a specific cook session
    forSession: protectedProcedure
      .input(z.object({ cookSessionId: z.number() }))
      .query(async ({ input }) => {
        return getTelemetryForSession(input.cookSessionId);
      }),
  }),

  // ===== Cook Sessions =====
  cookSession: router({
    start: protectedProcedure
      .input(
        z.object({
          grillId: z.string(),
          templateId: z.string().optional(),
          meatType: z.string().optional(),
          cutName: z.string().optional(),
          method: z.string().optional(),
        })
      )
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
      .input(
        z.object({
          category: z.string().optional(),
          method: z.string().optional(),
        }).optional()
      )
      .query(({ input }) => {
        let templates = COOK_TEMPLATES;
        if (input?.category) {
          templates = templates.filter((t) => t.category === input.category);
        }
        if (input?.method) {
          templates = templates.filter((t) => t.method === input.method);
        }
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

  // ===== Automation =====
  automation: router({
    create: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          description: z.string().optional(),
          templateId: z.string().optional(),
          stages: z.array(
            z.object({
              name: z.string(),
              grillTemp: z.number(),
              triggerType: z.enum(["time", "probe_temp", "manual"]),
              triggerValue: z.number(),
              superSmoke: z.boolean(),
              alertMessage: z.string(),
            })
          ),
        })
      )
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
});

export type AppRouter = typeof appRouter;
