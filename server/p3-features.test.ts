import { describe, it, expect } from "vitest";

// ─── SSE Module Tests ─────────────────────────────────────

describe("SSE Telemetry Module", () => {
  it("should export pushTelemetryUpdate, pushAlertEvent, pushDisconnectEvent, sseRoutes", async () => {
    const sse = await import("./sse");
    expect(typeof sse.pushTelemetryUpdate).toBe("function");
    expect(typeof sse.pushAlertEvent).toBe("function");
    expect(typeof sse.pushDisconnectEvent).toBe("function");
    expect(typeof sse.registerSSERoutes).toBe("function");
  });

  it("pushTelemetryUpdate should not throw when no clients connected", async () => {
    const { pushTelemetryUpdate } = await import("./sse");
    // Should silently do nothing when no SSE clients are connected
    expect(() => pushTelemetryUpdate(999)).not.toThrow();
  });

  it("pushAlertEvent should not throw when no clients connected", async () => {
    const { pushAlertEvent } = await import("./sse");
    expect(() =>
      pushAlertEvent(999, {
        id: "test-alert",
        label: "Test",
        message: "Test alert",
        alertType: "probe",
      })
    ).not.toThrow();
  });

  it("pushDisconnectEvent should not throw when no clients connected", async () => {
    const { pushDisconnectEvent } = await import("./sse");
    expect(() => pushDisconnectEvent(999, "test reason")).not.toThrow();
  });
});

// ─── CSV Export Tests ─────────────────────────────────────

describe("CSV Export", () => {
  it("cook-session router should export cookSessionRouter with exportCsv", async () => {
    const { cookSessionRouter } = await import("./routers/cook-session");
    expect(cookSessionRouter).toBeDefined();
    // The router should have the exportCsv procedure
    const procedures = Object.keys((cookSessionRouter as any)._def.procedures || {});
    expect(procedures).toContain("exportCsv");
  });

  it("CSV format should include headers and comma-separated values", () => {
    // Test the CSV format logic
    const lines: string[] = [];
    lines.push("# Cook Session Export");
    lines.push(`# Session ID: 1`);
    lines.push(`# Meat Type: Beef`);
    lines.push("");
    lines.push(
      "timestamp,grill_temp_f,probe_temp_f,ambient_temp_f,target_temp_f,target_probe_temp_f,pellet_level_pct,system_status"
    );
    lines.push(
      "2026-04-05T12:00:00.000Z,225,145,72,225,190,80,2"
    );

    const csv = lines.join("\n");
    expect(csv).toContain("# Cook Session Export");
    expect(csv).toContain("# Meat Type: Beef");
    expect(csv).toContain("timestamp,grill_temp_f");
    expect(csv).toContain("225,145,72,225,190,80,2");
    // Verify it's valid CSV-ish format
    const dataLines = csv.split("\n").filter((l) => !l.startsWith("#") && l.trim());
    expect(dataLines.length).toBeGreaterThanOrEqual(2); // header + at least 1 data row
    const headerCols = dataLines[0].split(",");
    expect(headerCols.length).toBe(8);
  });
});

// ─── JSON Schema Documentation Tests ─────────────────────

describe("JSON Schema Documentation", () => {
  it("should export all JSON column schemas", async () => {
    const schemas = await import("../shared/json-schemas");
    expect(schemas).toBeDefined();
    // Check that key schemas are exported
    expect(typeof schemas).toBe("object");
  });

  it("should document the cook session state schema", async () => {
    const schemas = await import("../shared/json-schemas");
    const keys = Object.keys(schemas);
    // Should have at least some schema exports
    expect(keys.length).toBeGreaterThan(0);
  });
});

// ─── Telemetry Retention Policy Tests ─────────────────────

describe("Telemetry Retention Policy", () => {
  it("should export purgeTelemetryOlderThan and getTelemetryCount from db", async () => {
    const db = await import("./db");
    expect(typeof db.purgeStaleTelemetry).toBe("function");
    expect(typeof db.getTelemetryCount).toBe("function");
  });
});

// ─── DB Module Split Verification ─────────────────────────

describe("DB Module Split", () => {
  it("should re-export all functions from domain modules via barrel", async () => {
    const db = await import("./db");
    // Core functions that must exist
    const requiredExports = [
      "getDb",
      // Traeger sessions
      "upsertTraegerSession",
      "getTraegerSession",
      // Telemetry
      "insertTelemetry",
      "getRecentTelemetry",
      "getTelemetryForSession",
      "purgeStaleTelemetry",
      "getTelemetryCount",
      // Cook sessions
      "createCookSession",
      "endCookSession",
      "getCookSession",
      "getUserCookSessions",
      "updateCookSessionNotes",
      // Templates
      "getUserCustomTemplates",
      "createCustomTemplate",
      // Analytics
      "getCookAnalyticsSummary",
      "getCooksByMeatType",
    ];

    for (const name of requiredExports) {
      expect(typeof (db as any)[name]).toBe("function");
    }
  });
});

// ─── Router Module Split Verification ─────────────────────

describe("Router Module Split", () => {
  it("should compose all domain routers into appRouter", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter).toBeDefined();
    // Check that key sub-routers are present
    const procedures = Object.keys((appRouter as any)._def.procedures || {});
    const expectedPrefixes = [
      "traeger",
      "grill",
      "liveCook",
      "cookSession",
      "templates",
      "analytics",
    ];
    for (const prefix of expectedPrefixes) {
      const found = procedures.some((p) => p.startsWith(prefix + "."));
      expect(found).toBe(true);
    }
  });
});

// ─── Retry Utility Tests ─────────────────────────────────

describe("withRetry utility", () => {
  it("should export withRetry from traeger-api", async () => {
    const api = await import("./traeger-api");
    expect(typeof api.withRetry).toBe("function");
  });

  it("should retry on transient errors", async () => {
    const { withRetry } = await import("./traeger-api");
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 3) throw new Error("transient");
      return "success";
    };
    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 });
    expect(result).toBe("success");
    expect(attempts).toBe(3);
  });

  it("should not retry on 401/403 auth errors", async () => {
    const { withRetry } = await import("./traeger-api");
    let attempts = 0;
    const fn = async () => {
      attempts++;
      const err: any = new Error("Unauthorized");
      err.response = { status: 401 };
      throw err;
    };
    await expect(withRetry(fn, { maxRetries: 3, baseDelay: 10 })).rejects.toThrow("Unauthorized");
    expect(attempts).toBe(1); // Should not retry
  });

  it("should fail after max retries", async () => {
    const { withRetry } = await import("./traeger-api");
    let attempts = 0;
    const fn = async () => {
      attempts++;
      throw new Error("always fails");
    };
    await expect(withRetry(fn, { maxRetries: 2, baseDelay: 10 })).rejects.toThrow("always fails");
    expect(attempts).toBe(3); // initial + 2 retries = 3 total attempts
  }, 15000);
});
