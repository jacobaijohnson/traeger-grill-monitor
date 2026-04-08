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
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { auth } from "./_core/auth";
import { fromNodeHeaders } from "better-auth/node";
import { authLog } from "./logger";
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
  adminRouter,
  setupRouter,
  passwordRouter,
  pushRouter,
} from "./routers/index";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      try {
        // Use Better Auth's server-side sign-out to invalidate the session
        await auth.api.signOut({
          headers: fromNodeHeaders(ctx.req.headers),
        });
      } catch (error) {
        // If sign-out fails (e.g., no session), still return success
        authLog.warn({ err: error }, "Sign-out error (non-fatal)");
      }
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
  admin: adminRouter,
  setup: setupRouter,
  password: passwordRouter,
  push: pushRouter,
});

export type AppRouter = typeof appRouter;
