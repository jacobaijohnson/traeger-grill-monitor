import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  registerAlarm,
  dismissAlarm,
  dismissAllAlarms,
  getActiveAlarms,
  isAlarmActive,
  getActiveAlarmCount,
} from "./alarm-escalation";

// Mock web-push to prevent actual push sends
vi.mock("./web-push", () => ({
  sendPushToUser: vi.fn().mockResolvedValue(1),
}));

describe("Alarm Escalation Manager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Clean up any active alarms from previous tests
    dismissAllAlarms("test-user-1");
    dismissAllAlarms("test-user-2");
  });

  afterEach(() => {
    // Clean up
    dismissAllAlarms("test-user-1");
    dismissAllAlarms("test-user-2");
    vi.useRealTimers();
  });

  describe("registerAlarm", () => {
    it("should register a new alarm", () => {
      registerAlarm("test-user-1", "alert-1", {
        title: "Test Alarm",
        body: "Probe reached 200°F",
        tag: "alert-1",
        alarm: true,
      });

      expect(isAlarmActive("test-user-1", "alert-1")).toBe(true);
      expect(getActiveAlarmCount()).toBe(1);
    });

    it("should track alarm details correctly", () => {
      registerAlarm("test-user-1", "alert-1", {
        title: "Probe Alert",
        body: "Reached target",
        tag: "alert-1",
        alarm: true,
      });

      const alarms = getActiveAlarms("test-user-1");
      expect(alarms).toHaveLength(1);
      expect(alarms[0].alarmKey).toBe("alert-1");
      expect(alarms[0].escalationCount).toBe(0);
      expect(alarms[0].payload.title).toBe("Probe Alert");
      expect(alarms[0].payload.alarm).toBe(true);
    });

    it("should allow multiple alarms for the same user", () => {
      registerAlarm("test-user-1", "alert-1", {
        title: "Alert 1",
        body: "First",
        alarm: true,
      });
      registerAlarm("test-user-1", "alert-2", {
        title: "Alert 2",
        body: "Second",
        alarm: true,
      });

      expect(getActiveAlarms("test-user-1")).toHaveLength(2);
      expect(getActiveAlarmCount()).toBe(2);
    });

    it("should allow alarms for different users", () => {
      registerAlarm("test-user-1", "alert-1", {
        title: "User 1 Alert",
        body: "Test",
        alarm: true,
      });
      registerAlarm("test-user-2", "alert-1", {
        title: "User 2 Alert",
        body: "Test",
        alarm: true,
      });

      expect(getActiveAlarms("test-user-1")).toHaveLength(1);
      expect(getActiveAlarms("test-user-2")).toHaveLength(1);
      expect(getActiveAlarmCount()).toBe(2);
    });

    it("should reset escalation count when re-registering same alarm", () => {
      registerAlarm("test-user-1", "alert-1", {
        title: "First",
        body: "Test",
        alarm: true,
      });

      // Advance time to trigger an escalation
      vi.advanceTimersByTime(2 * 60 * 1000 + 100);

      // Re-register the same alarm (e.g., alert re-fired)
      registerAlarm("test-user-1", "alert-1", {
        title: "Re-fired",
        body: "Test again",
        alarm: true,
      });

      const alarms = getActiveAlarms("test-user-1");
      expect(alarms).toHaveLength(1);
      expect(alarms[0].escalationCount).toBe(0); // Reset
      expect(alarms[0].payload.title).toBe("Re-fired");
    });
  });

  describe("dismissAlarm", () => {
    it("should dismiss an active alarm", () => {
      registerAlarm("test-user-1", "alert-1", {
        title: "Test",
        body: "Test",
        alarm: true,
      });

      const result = dismissAlarm("test-user-1", "alert-1");
      expect(result).toBe(true);
      expect(isAlarmActive("test-user-1", "alert-1")).toBe(false);
      expect(getActiveAlarmCount()).toBe(0);
    });

    it("should return false for non-existent alarm", () => {
      const result = dismissAlarm("test-user-1", "nonexistent");
      expect(result).toBe(false);
    });

    it("should return false for wrong user", () => {
      registerAlarm("test-user-1", "alert-1", {
        title: "Test",
        body: "Test",
        alarm: true,
      });

      const result = dismissAlarm("test-user-2", "alert-1");
      expect(result).toBe(false);
      expect(isAlarmActive("test-user-1", "alert-1")).toBe(true);
    });
  });

  describe("dismissAllAlarms", () => {
    it("should dismiss all alarms for a user", () => {
      registerAlarm("test-user-1", "alert-1", {
        title: "A1",
        body: "T",
        alarm: true,
      });
      registerAlarm("test-user-1", "alert-2", {
        title: "A2",
        body: "T",
        alarm: true,
      });
      registerAlarm("test-user-2", "alert-3", {
        title: "A3",
        body: "T",
        alarm: true,
      });

      const count = dismissAllAlarms("test-user-1");
      expect(count).toBe(2);
      expect(getActiveAlarms("test-user-1")).toHaveLength(0);
      expect(getActiveAlarms("test-user-2")).toHaveLength(1);
    });

    it("should return 0 when no alarms exist", () => {
      const count = dismissAllAlarms("test-user-1");
      expect(count).toBe(0);
    });
  });

  describe("getActiveAlarms", () => {
    it("should return empty array for user with no alarms", () => {
      expect(getActiveAlarms("test-user-1")).toEqual([]);
    });

    it("should only return alarms for the specified user", () => {
      registerAlarm("test-user-1", "alert-1", {
        title: "User 1",
        body: "T",
        alarm: true,
      });
      registerAlarm("test-user-2", "alert-2", {
        title: "User 2",
        body: "T",
        alarm: true,
      });

      const user1Alarms = getActiveAlarms("test-user-1");
      expect(user1Alarms).toHaveLength(1);
      expect(user1Alarms[0].alarmKey).toBe("alert-1");
    });
  });

  describe("isAlarmActive", () => {
    it("should return true for active alarm", () => {
      registerAlarm("test-user-1", "alert-1", {
        title: "T",
        body: "T",
        alarm: true,
      });
      expect(isAlarmActive("test-user-1", "alert-1")).toBe(true);
    });

    it("should return false for dismissed alarm", () => {
      registerAlarm("test-user-1", "alert-1", {
        title: "T",
        body: "T",
        alarm: true,
      });
      dismissAlarm("test-user-1", "alert-1");
      expect(isAlarmActive("test-user-1", "alert-1")).toBe(false);
    });

    it("should return false for non-existent alarm", () => {
      expect(isAlarmActive("test-user-1", "nonexistent")).toBe(false);
    });
  });

  describe("escalation behavior", () => {
    it("should re-push after escalation interval", async () => {
      const { sendPushToUser } = await import("./web-push");

      registerAlarm("test-user-1", "alert-1", {
        title: "Test",
        body: "Probe at 200°F",
        tag: "alert-1",
        alarm: true,
      });

      // Advance past the 2-minute escalation interval
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000 + 100);

      // sendPushToUser should have been called for the re-push
      expect(sendPushToUser).toHaveBeenCalled();

      const alarms = getActiveAlarms("test-user-1");
      expect(alarms).toHaveLength(1);
      expect(alarms[0].escalationCount).toBe(1);
    });

    it("should auto-stop after max escalations", async () => {
      registerAlarm("test-user-1", "alert-1", {
        title: "Test",
        body: "Test",
        tag: "alert-1",
        alarm: true,
      });

      // Advance past 15 escalations (15 * 2 min = 30 min)
      for (let i = 0; i < 16; i++) {
        await vi.advanceTimersByTimeAsync(2 * 60 * 1000 + 100);
      }

      // Should be auto-stopped
      expect(isAlarmActive("test-user-1", "alert-1")).toBe(false);
    });

    it("should stop escalation when dismissed", async () => {
      const { sendPushToUser } = await import("./web-push");
      vi.mocked(sendPushToUser).mockClear();

      registerAlarm("test-user-1", "alert-1", {
        title: "Test",
        body: "Test",
        tag: "alert-1",
        alarm: true,
      });

      // Dismiss before first escalation
      dismissAlarm("test-user-1", "alert-1");

      // Advance past escalation interval
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000 + 100);

      // No re-push should have been sent
      expect(sendPushToUser).not.toHaveBeenCalled();
    });
  });
});
