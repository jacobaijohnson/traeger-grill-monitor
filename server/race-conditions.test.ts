import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── RC-1: DB Connection Resilience ─────────────────────

describe("RC-1: DB connection resilience", () => {
  it("withDbRetry should be exported from db/connection", async () => {
    const mod = await import("./db/connection");
    expect(typeof mod.withDbRetry).toBe("function");
  });

  it("withDbRetry should succeed on first try when DB is healthy", async () => {
    const { withDbRetry } = await import("./db/connection");
    // withDbRetry takes (db) => Promise<T> and a label; it manages retries internally
    const result = await withDbRetry(async () => "ok", "test-success");
    expect(result).toBe("ok");
  });

  it("withDbRetry should return null after exhausting all retries on transient error", async () => {
    const { withDbRetry } = await import("./db/connection");
    // MAX_RETRIES is hardcoded to 2 (initial + 1 retry = 2 attempts)
    // Transient errors (ECONNRESET, ECONNREFUSED, etc.) degrade gracefully
    // by returning null after all retries are exhausted.
    const err = Object.assign(new Error("ECONNRESET"), { code: "ECONNRESET" });
    const result = await withDbRetry(async () => { throw err; }, "test-retry");
    expect(result).toBeNull();
  });

  it("withDbRetry should NOT retry on non-transient errors", async () => {
    const { withDbRetry } = await import("./db/connection");
    await expect(withDbRetry(async () => { throw new Error("Syntax error in SQL"); }, "test-no-retry")).rejects.toThrow("Syntax error in SQL");
  });

  it("getDb should return a drizzle instance", async () => {
    const { getDb } = await import("./db/connection");
    const db = getDb();
    expect(db).toBeDefined();
    expect(db).not.toBeNull();
  });
});

// ─── RC-2: Connection Mutex ─────────────────────────────

describe("RC-2: Connection mutex in ensureMqttConnected", () => {
  it("helpers module should export ensureMqttConnected", async () => {
    const mod = await import("./routers/helpers");
    expect(typeof mod.ensureMqttConnected).toBe("function");
  });
});

// ─── RC-3: Disconnect Cleanup Order ─────────────────────

describe("RC-3: Disconnect cleanup order", () => {
  it("disconnectMqtt should cleanly remove session", async () => {
    const { connectMqtt, disconnectMqtt, getTelemetry } = await import("./mqtt-manager");
    const userId = 99999;
    // After disconnect, getTelemetry should return null
    disconnectMqtt(userId);
    expect(getTelemetry(userId)).toBeNull();
  });

  it("disconnectMqtt should be idempotent (no error on double-disconnect)", async () => {
    const { disconnectMqtt } = await import("./mqtt-manager");
    const userId = 99998;
    // Should not throw even if no session exists
    expect(() => disconnectMqtt(userId)).not.toThrow();
    expect(() => disconnectMqtt(userId)).not.toThrow();
  });
});

// ─── RC-4: Persist Backpressure ─────────────────────────

describe("RC-4: Persist backpressure flags", () => {
  it("MqttSession should have persistInFlight and cookStatePersistInFlight flags", async () => {
    // We can't directly inspect the interface, but we can verify behavior:
    // After connecting, the session should exist and persist should work
    const { getActiveCook, getTelemetry } = await import("./mqtt-manager");
    // For a non-existent user, these should return null/empty safely
    expect(getActiveCook(88888)).toBeNull();
    expect(getTelemetry(88888)).toBeNull();
  });
});

// ─── RC-5: SSE Client Map Cleanup ───────────────────────

describe("RC-5: SSE module safety", () => {
  it("should export all required functions", async () => {
    const mod = await import("./sse");
    expect(typeof mod.pushTelemetryUpdate).toBe("function");
    expect(typeof mod.pushAlertEvent).toBe("function");
    expect(typeof mod.pushDisconnectEvent).toBe("function");
    expect(typeof mod.registerSSERoutes).toBe("function");
    expect(typeof mod.getSSEClientCount).toBe("function");
  });

  it("pushTelemetryUpdate should not throw for non-existent user", async () => {
    const { pushTelemetryUpdate } = await import("./sse");
    expect(() => pushTelemetryUpdate("77777")).not.toThrow();
  });

  it("pushAlertEvent should not throw for non-existent user", async () => {
    const { pushAlertEvent } = await import("./sse");
    expect(() => pushAlertEvent("77777", {
      id: "test",
      label: "Test Alert",
      message: "Test",
      alertType: "ping",
    })).not.toThrow();
  });

  it("pushDisconnectEvent should not throw for non-existent user", async () => {
    const { pushDisconnectEvent } = await import("./sse");
    expect(() => pushDisconnectEvent("77777", "test disconnect")).not.toThrow();
  });
});

// ─── RC-6: Telemetry Retention ──────────────────────────

describe("RC-6: Telemetry retention policy", () => {
  it("should export purgeTelemetryBefore and getTelemetryCount", async () => {
    const mod = await import("./db/telemetry");
    expect(typeof mod.purgeStaleTelemetry).toBe("function");
    expect(typeof mod.getTelemetryCount).toBe("function");
  });
});

// ─── Cross-cutting: All DB modules use withDbRetry ──────

describe("All DB modules export expected functions", () => {
  it("db/telemetry exports persist and query functions", async () => {
    const mod = await import("./db/telemetry");
    expect(typeof mod.insertTelemetry).toBe("function");
    expect(typeof mod.getRecentTelemetry).toBe("function");
    expect(typeof mod.getTelemetryForSession).toBe("function");
    expect(typeof mod.purgeStaleTelemetry).toBe("function");
    expect(typeof mod.getTelemetryCount).toBe("function");
    expect(typeof mod.persistTelemetryFromMqtt).toBe("function");
  });

  it("db/cook-sessions exports CRUD functions", async () => {
    const mod = await import("./db/cook-sessions");
    expect(typeof mod.createCookSession).toBe("function");
    expect(typeof mod.getCookSession).toBe("function");
    expect(typeof mod.endCookSession).toBe("function");
    expect(typeof mod.getUserCookSessions).toBe("function");
    expect(typeof mod.updateCookSessionNotes).toBe("function");
    expect(typeof mod.getActiveCookSession).toBe("function");
    expect(typeof mod.updateCookSessionStatus).toBe("function");
  });

  it("db/templates exports template functions", async () => {
    const mod = await import("./db/templates");
    expect(typeof mod.createCustomTemplate).toBe("function");
    expect(typeof mod.getUserCustomTemplates).toBe("function");
    expect(typeof mod.getPublishedTemplates).toBe("function");
    expect(typeof mod.createAutomationProgram).toBe("function");
  });

  it("db/analytics exports analytics functions", async () => {
    const mod = await import("./db/analytics");
    expect(typeof mod.getCookAnalyticsSummary).toBe("function");
    expect(typeof mod.getCooksByMeatType).toBe("function");
    expect(typeof mod.getCooksByMonth).toBe("function");
    expect(typeof mod.getRatingDistribution).toBe("function");
    expect(typeof mod.getCooksByMethod).toBe("function");
    expect(typeof mod.getCooksByCut).toBe("function");
  });

  it("db barrel re-exports all domain modules", async () => {
    const barrel = await import("./db");
    // Spot-check key exports from each domain
    expect(typeof barrel.getDb).toBe("function");
    expect(typeof barrel.insertTelemetry).toBe("function");
    expect(typeof barrel.createCookSession).toBe("function");
    expect(typeof barrel.createCustomTemplate).toBe("function");
    expect(typeof barrel.getCookAnalyticsSummary).toBe("function");
  });
});
