/**
 * Application Router — composes domain-specific routers.
 *
 * Each domain lives in its own file under `server/routers/`:
 *   traeger.ts      — Traeger account management (connect, disconnect, status)
 *   grill.ts        — Grill commands, live telemetry, DB-backed telemetry
 *   live-cook.ts    — Live cook session state machine (start, end, alerts)
 *   cook-session.ts — Cook session history CRUD
 *   templates.ts    — Built-in templates, custom templates, meat profiles
 *   automation.ts   — Automation programs (legacy)
 *   analytics.ts    — Cook analytics aggregations
 *   helpers.ts      — Shared helpers (getValidIdToken, ensureMqttConnected)
 */
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { COOKIE_NAME } from "@shared/const";
import {
  traegerRouter,
  grillRouter,
  telemetryRouter,
  liveCookRouter,
  cookSessionRouter,
  templatesRouter,
  customTemplatesRouter,
  meatProfilesRouter,
  automationRouter,
  analyticsRouter,
  executionsRouter,
} from "./routers/index";

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

  traeger: traegerRouter,
  grill: grillRouter,
  telemetry: telemetryRouter,
  liveCook: liveCookRouter,
  cookSession: cookSessionRouter,
  templates: templatesRouter,
  customTemplates: customTemplatesRouter,
  meatProfiles: meatProfilesRouter,
  automation: automationRouter,
  analytics: analyticsRouter,
  executions: executionsRouter,
});

export type AppRouter = typeof appRouter;
