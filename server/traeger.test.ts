import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { COOK_TEMPLATES, CATEGORIES, COOKING_METHODS } from "../shared/cook-templates";
import { SYSTEM_STATUS, getSystemStatus, COMMANDS } from "../shared/traeger-types";

// ===== Helper to create test context =====

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: Array<{ name: string; options: Record<string, unknown> }> } {
  const clearedCookies: Array<{ name: string; options: Record<string, unknown> }> = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ===== Cook Templates Tests =====

describe("Cook Templates Data", () => {
  it("should have at least 5 cook templates", () => {
    expect(COOK_TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });

  it("each template should have required fields", () => {
    for (const template of COOK_TEMPLATES) {
      expect(template.id).toBeTruthy();
      expect(template.name).toBeTruthy();
      expect(template.category).toBeTruthy();
      expect(template.method).toBeTruthy();
      expect(template.cut).toBeTruthy();
      expect(template.description).toBeTruthy();
      expect(template.estimatedTime).toBeTruthy();
      expect(template.stages.length).toBeGreaterThan(0);
      expect(Array.isArray(template.tips)).toBe(true);
    }
  });

  it("each template stage should have valid fields", () => {
    for (const template of COOK_TEMPLATES) {
      for (const stage of template.stages) {
        expect(stage.name).toBeTruthy();
        expect(stage.grillTemp).toBeGreaterThanOrEqual(150);
        expect(stage.grillTemp).toBeLessThanOrEqual(500);
        expect(["time", "probe_temp", "manual"]).toContain(stage.triggerType);
        expect(typeof stage.triggerValue).toBe("number");
        expect(typeof stage.superSmoke).toBe("boolean");
        expect(stage.alertMessage).toBeTruthy();
      }
    }
  });

  it("should have unique template IDs", () => {
    const ids = COOK_TEMPLATES.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("categories should be defined", () => {
    expect(CATEGORIES.length).toBeGreaterThan(0);
    for (const cat of CATEGORIES) {
      expect(cat.id).toBeTruthy();
      expect(cat.label).toBeTruthy();
    }
  });

  it("cooking methods should be defined", () => {
    expect(COOKING_METHODS.length).toBeGreaterThan(0);
    for (const method of COOKING_METHODS) {
      expect(method.id).toBeTruthy();
      expect(method.label).toBeTruthy();
    }
  });
});

// ===== System Status Tests =====

describe("System Status Decoder", () => {
  it("should decode known status codes", () => {
    const sleeping = getSystemStatus(2);
    expect(sleeping.label).toBe("Sleeping");
    expect(sleeping.color).toBeTruthy();

    const cooking = getSystemStatus(6);
    expect(cooking.label).toBe("Cooking");

    const shutdown = getSystemStatus(9);
    expect(shutdown.label).toBe("Shutdown");
  });

  it("should return Offline for unknown status codes", () => {
    const unknown = getSystemStatus(99);
    expect(unknown.label).toBe("Offline");
    expect(unknown.color).toBe("gray");
  });

  it("should have descriptions for all statuses", () => {
    for (const status of Object.values(SYSTEM_STATUS)) {
      expect(status.label).toBeTruthy();
      expect(status.color).toBeTruthy();
      expect(status.description).toBeTruthy();
    }
  });
});

// ===== Commands Tests =====

describe("Traeger Commands", () => {
  it("should have correct command codes", () => {
    expect(COMMANDS.SET_TEMP).toBe("11");
    expect(COMMANDS.SET_TIMER).toBe("12");
    expect(COMMANDS.CLEAR_TIMER).toBe("13");
    expect(COMMANDS.SET_PROBE_ALARM).toBe("14");
    expect(COMMANDS.SHUTDOWN).toBe("17");
    expect(COMMANDS.KEEP_WARM_ON).toBe("18");
    expect(COMMANDS.KEEP_WARM_OFF).toBe("19");
    expect(COMMANDS.SUPER_SMOKE_ON).toBe("20");
    expect(COMMANDS.SUPER_SMOKE_OFF).toBe("21");
    expect(COMMANDS.STATUS_REQUEST).toBe("90");
  });
});

// ===== Templates Router Tests =====

describe("templates.list", () => {
  it("should return all templates without filters", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.templates.list();
    expect(result.length).toBeGreaterThanOrEqual(5);
  });

  it("should filter by category", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.templates.list({ category: "beef" });
    expect(result.length).toBeGreaterThan(0);
    for (const t of result) {
      expect(t.category).toBe("beef");
    }
  });

  it("should filter by method", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.templates.list({ method: "smoke" });
    expect(result.length).toBeGreaterThan(0);
    for (const t of result) {
      expect(t.method).toBe("smoke");
    }
  });
});

describe("templates.get", () => {
  it("should return a specific template by ID", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const allTemplates = await caller.templates.list();
    const firstId = allTemplates[0].id;
    const result = await caller.templates.get({ id: firstId });
    expect(result.id).toBe(firstId);
    expect(result.name).toBeTruthy();
  });

  it("should throw NOT_FOUND for invalid template ID", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.templates.get({ id: "nonexistent-template" })).rejects.toThrow();
  });
});

// ===== Auth Tests =====

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });
});

describe("auth.me", () => {
  it("returns user when authenticated", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.openId).toBe("test-user-123");
    expect(result?.email).toBe("test@example.com");
  });

  it("returns null when not authenticated", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

// ===== Traeger Status Tests =====

describe("traeger.status", () => {
  it("should return disconnected status when no session exists", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.traeger.status();
    expect(result.connected).toBe(false);
    expect(result.grills).toEqual([]);
    expect(result.selectedGrillId).toBeNull();
  });
});

// ===== Protected Route Tests =====

describe("protected routes", () => {
  it("traeger.connect should reject unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.traeger.connect({ email: "test@test.com", password: "pass" })
    ).rejects.toThrow();
  });

  it("grill.setTemp should reject unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.grill.setTemp({ temp: 225 })).rejects.toThrow();
  });

  it("automation.create should reject unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.automation.create({
        name: "Test",
        stages: [
          {
            name: "Stage 1",
            grillTemp: 225,
            triggerType: "time",
            triggerValue: 3600,
            superSmoke: false,
            alertMessage: "Done",
          },
        ],
      })
    ).rejects.toThrow();
  });
});

// ===== Input Validation Tests =====

describe("input validation", () => {
  it("grill.setTemp should reject temperatures below 165", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.grill.setTemp({ temp: 100 })).rejects.toThrow();
  });

  it("grill.setTemp should reject temperatures above 500", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.grill.setTemp({ temp: 600 })).rejects.toThrow();
  });

  it("grill.setTimer should reject timers under 60 seconds", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.grill.setTimer({ seconds: 30 })).rejects.toThrow();
  });

  it("grill.setProbeAlarm should reject temps below 100", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.grill.setProbeAlarm({ temp: 50 })).rejects.toThrow();
  });

  it("grill.setProbeAlarm should reject temps above 220", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.grill.setProbeAlarm({ temp: 250 })).rejects.toThrow();
  });
});
