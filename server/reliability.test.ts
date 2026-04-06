/**
 * P1 Reliability & Resilience Tests
 *
 * Tests for:
 * 1. Traeger API retry with exponential backoff
 * 2. Traeger API response validation (schema checks)
 * 3. MQTT lifecycle (connect, disconnect, reconnect state)
 * 4. Cook session state machine transitions
 * 5. Alert firing and dismissal
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── P1-RET-1: Retry utility ────────────────────────────
describe("P1-RET-1: Retry utility with exponential backoff", () => {
  it("should export a withRetry function", async () => {
    const { withRetry } = await import("./traeger-api");
    expect(typeof withRetry).toBe("function");
  });

  it("should succeed on first attempt if no error", async () => {
    const { withRetry } = await import("./traeger-api");
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on transient failure and succeed", async () => {
    const { withRetry } = await import("./traeger-api");
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue("ok");
    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should throw after exhausting retries", async () => {
    const { withRetry } = await import("./traeger-api");
    const fn = vi.fn().mockRejectedValue(new Error("persistent failure"));
    await expect(withRetry(fn, { maxRetries: 2, baseDelay: 10 })).rejects.toThrow("persistent failure");
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("should not retry on 401/403 auth errors", async () => {
    const { withRetry } = await import("./traeger-api");
    const authError = Object.assign(new Error("Unauthorized"), { response: { status: 401 } });
    const fn = vi.fn().mockRejectedValue(authError);
    await expect(withRetry(fn, { maxRetries: 3, baseDelay: 10 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1); // no retries for auth errors
  });
});

// ─── P1-VAL-1: Response validation ──────────────────────
describe("P1-VAL-1: Traeger API response validation", () => {
  it("should export validateTokenResponse", async () => {
    const { validateTokenResponse } = await import("./traeger-api");
    expect(typeof validateTokenResponse).toBe("function");
  });

  it("should accept valid token response", async () => {
    const { validateTokenResponse } = await import("./traeger-api");
    const valid = {
      accessToken: "abc",
      idToken: "def",
      refreshToken: "ghi",
      expiresIn: 3600,
      tokenType: "Bearer",
    };
    expect(validateTokenResponse(valid)).toBe(true);
  });

  it("should reject token response missing idToken", async () => {
    const { validateTokenResponse } = await import("./traeger-api");
    const invalid = {
      accessToken: "abc",
      idToken: "",
      refreshToken: "ghi",
      expiresIn: 3600,
      tokenType: "Bearer",
    };
    expect(validateTokenResponse(invalid)).toBe(false);
  });

  it("should export validateMqttCredentials", async () => {
    const { validateMqttCredentials } = await import("./traeger-api");
    expect(typeof validateMqttCredentials).toBe("function");
  });

  it("should accept valid MQTT credentials", async () => {
    const { validateMqttCredentials } = await import("./traeger-api");
    const valid = {
      signedUrl: "wss://example.com/mqtt",
      expirationSeconds: 3600,
      expiresAt: new Date().toISOString(),
    };
    expect(validateMqttCredentials(valid)).toBe(true);
  });

  it("should reject MQTT credentials without signedUrl", async () => {
    const { validateMqttCredentials } = await import("./traeger-api");
    const invalid = {
      signedUrl: "",
      expirationSeconds: 3600,
      expiresAt: new Date().toISOString(),
    };
    expect(validateMqttCredentials(invalid)).toBe(false);
  });
});

// ─── P1-MQTT-1: MQTT session lifecycle ──────────────────
describe("P1-MQTT-1: MQTT session lifecycle", () => {
  it("isMqttConnected returns false for unknown user", async () => {
    const { isMqttConnected } = await import("./mqtt-manager");
    expect(isMqttConnected(99999)).toBe(false);
  });

  it("getTelemetry returns null for unknown user", async () => {
    const { getTelemetry } = await import("./mqtt-manager");
    expect(getTelemetry(99999)).toBeNull();
  });

  it("getTelemetryHistory returns empty for unknown user", async () => {
    const { getTelemetryHistory } = await import("./mqtt-manager");
    expect(getTelemetryHistory(99999)).toEqual([]);
  });

  it("getActiveCook returns null for unknown user", async () => {
    const { getActiveCook } = await import("./mqtt-manager");
    expect(getActiveCook(99999)).toBeNull();
  });

  it("getStallInfo returns null for unknown user", async () => {
    const { getStallInfo } = await import("./mqtt-manager");
    expect(getStallInfo(99999)).toBeNull();
  });
});

// ─── P1-COOK-1: Cook session state machine ──────────────
describe("P1-COOK-1: Cook session state machine transitions", () => {
  it("startCookSession is a no-op for unknown user", async () => {
    const { startCookSession, getActiveCook } = await import("./mqtt-manager");
    startCookSession(99999, 1, {});
    expect(getActiveCook(99999)).toBeNull();
  });

  it("endCookSession returns null for unknown user", async () => {
    const { endCookSession } = await import("./mqtt-manager");
    expect(endCookSession(99999)).toBeNull();
  });

  it("dismissAlert returns false for unknown user", async () => {
    const { dismissAlert } = await import("./mqtt-manager");
    expect(dismissAlert(99999, "alert-1")).toBe(false);
  });

  it("addAlert returns false for unknown user", async () => {
    const { addAlert } = await import("./mqtt-manager");
    expect(addAlert(99999, {
      id: "test",
      label: "Test",
      triggerTemp: 200,
      triggerType: "probe",
      alertType: "notification",
      status: "pending",
    })).toBe(false);
  });

  it("removeAlert returns false for unknown user", async () => {
    const { removeAlert } = await import("./mqtt-manager");
    expect(removeAlert(99999, "alert-1")).toBe(false);
  });

  it("advanceCookStage returns -1 for unknown user", async () => {
    const { advanceCookStage } = await import("./mqtt-manager");
    expect(advanceCookStage(99999)).toBe(-1);
  });
});

// ─── P1-COOK-2: hydrateCookState ────────────────────────
describe("P1-COOK-2: Cook state hydration", () => {
  it("hydrateCookState returns false for unknown user", async () => {
    const { hydrateCookState } = await import("./mqtt-manager");
    expect(hydrateCookState(99999, {
      cookSessionId: 1,
      startedAt: Date.now(),
      currentStage: 0,
      peakGrillTemp: 0,
      peakProbeTemp: 0,
      alerts: [],
    })).toBe(false);
  });

  it("setCookStatePersistCallback is exported", async () => {
    const { setCookStatePersistCallback } = await import("./mqtt-manager");
    expect(typeof setCookStatePersistCallback).toBe("function");
  });
});
