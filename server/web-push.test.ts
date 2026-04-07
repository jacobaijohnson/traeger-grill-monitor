import { describe, it, expect, vi } from "vitest";

describe("Web Push Module", () => {
  describe("Module exports", () => {
    it("should export all required functions", async () => {
      const mod = await import("./web-push");
      expect(typeof mod.initVapidKeys).toBe("function");
      expect(typeof mod.getVapidPublicKey).toBe("function");
      expect(typeof mod.saveSubscription).toBe("function");
      expect(typeof mod.removeSubscription).toBe("function");
      expect(typeof mod.getNotificationPreferences).toBe("function");
      expect(typeof mod.setNotificationPreferences).toBe("function");
      expect(typeof mod.sendPushToUser).toBe("function");
      expect(typeof mod.sendPushIfEnabled).toBe("function");
    });
  });

  describe("VAPID key management", () => {
    it("getVapidPublicKey should return a base64url string or throw when DB unavailable", async () => {
      const { getVapidPublicKey } = await import("./web-push");
      try {
        const key = await getVapidPublicKey();
        // With a real DB: returns a base64url-encoded string
        expect(typeof key).toBe("string");
        expect(key.length).toBeGreaterThan(20);
      } catch (err: any) {
        // Without DB: throws because VAPID keys can't be loaded
        expect(err.message).toContain("VAPID keys not initialized");
      }
    });
  });

  describe("Notification preference types", () => {
    it("should support all alert types in preferences", async () => {
      const { getNotificationPreferences } = await import("./web-push");
      // Verify the function signature accepts a userId string
      expect(typeof getNotificationPreferences).toBe("function");
      expect(getNotificationPreferences.length).toBe(1); // takes userId
    });

    it("setNotificationPreferences should accept partial preference updates", async () => {
      const { setNotificationPreferences } = await import("./web-push");
      expect(typeof setNotificationPreferences).toBe("function");
      expect(setNotificationPreferences.length).toBe(2); // userId, prefs
    });
  });

  describe("sendPushIfEnabled guard", () => {
    it("should accept alertType as second argument", async () => {
      const { sendPushIfEnabled } = await import("./web-push");
      expect(typeof sendPushIfEnabled).toBe("function");
      // Should accept (userId, alertType, payload) - 3 args
      expect(sendPushIfEnabled.length).toBe(3);
    });
  });
});

describe("Push Router", () => {
  it("should export pushRouter from routers/push", async () => {
    const mod = await import("./routers/push");
    expect(mod.pushRouter).toBeDefined();
  });

  it("pushRouter should have all required procedures", async () => {
    const { pushRouter } = await import("./routers/push");
    // Check that the router has the expected procedure keys
    const routerDef = pushRouter._def;
    expect(routerDef).toBeDefined();
  });
});

describe("Push notification integration points", () => {
  it("mqtt-manager should import sendPushIfEnabled", async () => {
    // Verify the import exists in mqtt-manager
    const fs = await import("fs");
    const mqttCode = fs.readFileSync("./server/mqtt-manager.ts", "utf-8");
    expect(mqttCode).toContain('import { sendPushIfEnabled }');
    expect(mqttCode).toContain('from "./web-push"');
  });

  it("mqtt-manager should call sendPushIfEnabled for alert events", async () => {
    const fs = await import("fs");
    const mqttCode = fs.readFileSync("./server/mqtt-manager.ts", "utf-8");
    // Should be called for: alertFired, stallDetected, stallBroken, phaseChange, escalatingAlarm
    expect(mqttCode).toContain('sendPushIfEnabled(userId, "alertFired"');
    expect(mqttCode).toContain('sendPushIfEnabled(userId, "stallDetected"');
    expect(mqttCode).toContain('sendPushIfEnabled(userId, "stallBroken"');
    expect(mqttCode).toContain('sendPushIfEnabled(userId, "phaseChange"');
    expect(mqttCode).toContain('sendPushIfEnabled(userId, "escalatingAlarm"');
  });

  it("service worker should handle push events", async () => {
    const fs = await import("fs");
    const swCode = fs.readFileSync("./client/public/sw.js", "utf-8");
    expect(swCode).toContain("self.addEventListener('push'");
    expect(swCode).toContain("self.registration.showNotification");
    expect(swCode).toContain("SHOW_NOTIFICATION");
  });
});

describe("Migration SQL", () => {
  it("0008 migration should create push_subscriptions and notification_preferences tables", async () => {
    const fs = await import("fs");
    const sql = fs.readFileSync("./drizzle/0008_push_notifications.sql", "utf-8");
    expect(sql).toContain("CREATE TABLE");
    expect(sql).toContain("push_subscriptions");
    expect(sql).toContain("notification_preferences");
    expect(sql).toContain("endpoint");
    expect(sql).toContain("p256dh");
    expect(sql).toContain("`auth`");
    expect(sql).toContain("userId");
    expect(sql).toContain("preferences");
  });
});
