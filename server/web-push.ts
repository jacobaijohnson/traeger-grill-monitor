/**
 * Web Push notification module.
 *
 * - Auto-generates VAPID keys on first boot, stores in app_settings table.
 * - Manages push subscriptions per user.
 * - Sends push notifications to all subscriptions for a given user.
 * - Respects per-user notification preferences.
 */
import webpush from "web-push";
import { withDbRetry, sql } from "./db/connection";
import { getSetting, setSetting } from "./db/access-control";
import { pushLog } from "./logger";

// ─── VAPID Key Management ───────────────────────────────

let vapidInitialized = false;

/** Check if VAPID keys have been initialized (for health checks). */
export function isVapidReady(): boolean {
  return vapidInitialized;
}

/**
 * Initialize VAPID keys. Auto-generates and stores them on first boot.
 * Must be called once at server startup (after DB is ready).
 */
export async function initVapidKeys(): Promise<void> {
  if (vapidInitialized) return;

  let publicKey = await getSetting("vapid_public_key");
  let privateKey = await getSetting("vapid_private_key");

  if (!publicKey || !privateKey) {
    pushLog.info("Generating new VAPID key pair");
    const keys = webpush.generateVAPIDKeys();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
    await setSetting("vapid_public_key", publicKey);
    await setSetting("vapid_private_key", privateKey);
    pushLog.info("VAPID keys generated and stored");
  }

  const contactEmail = process.env.VAPID_CONTACT_EMAIL || process.env.ADMIN_EMAIL || "admin@localhost";
  webpush.setVapidDetails(`mailto:${contactEmail}`, publicKey, privateKey);
  vapidInitialized = true;
  pushLog.info("VAPID initialized");
}

/**
 * Get the public VAPID key for the frontend to use when subscribing.
 */
export async function getVapidPublicKey(): Promise<string> {
  const key = await getSetting("vapid_public_key");
  if (!key) throw new Error("VAPID keys not initialized");
  return key;
}

// ─── Subscription Management ────────────────────────────

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Save a push subscription for a user. Upserts by endpoint.
 */
export async function saveSubscription(
  userId: string,
  subscription: PushSubscriptionData
): Promise<void> {
  await withDbRetry(async (db) => {
    // First try to find existing subscription
    const existing = await db.execute(
      sql`SELECT id FROM push_subscriptions WHERE userId = ${userId} AND endpoint = ${subscription.endpoint}`
    );
    if ((existing as any)[0]?.length > 0) {
      // Update existing
      await db.execute(
        sql`UPDATE push_subscriptions SET p256dh = ${subscription.keys.p256dh}, auth = ${subscription.keys.auth} WHERE userId = ${userId} AND endpoint = ${subscription.endpoint}`
      );
    } else {
      // Insert new
      await db.execute(
        sql`INSERT INTO push_subscriptions (userId, endpoint, p256dh, auth, createdAt) VALUES (${userId}, ${subscription.endpoint}, ${subscription.keys.p256dh}, ${subscription.keys.auth}, NOW())`
      );
    }
  }, "saveSubscription");
}

/**
 * Remove a push subscription by endpoint.
 */
export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  await withDbRetry(async (db) => {
    await db.execute(
      sql`DELETE FROM push_subscriptions WHERE userId = ${userId} AND endpoint = ${endpoint}`
    );
  }, "removeSubscription");
}

/**
 * Remove all subscriptions for a user.
 */
export async function removeAllSubscriptions(userId: string): Promise<void> {
  await withDbRetry(async (db) => {
    await db.execute(sql`DELETE FROM push_subscriptions WHERE userId = ${userId}`);
  }, "removeAllSubscriptions");
}

/**
 * Get all subscriptions for a user.
 */
export async function getSubscriptions(userId: string): Promise<PushSubscriptionData[]> {
  const result = await withDbRetry(async (db) => {
    const rows = await db.execute(
      sql`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE userId = ${userId}`
    );
    return (rows as any)[0] || [];
  }, "getSubscriptions");

  if (!result) return [];
  return (result as any[]).map((r: any) => ({
    endpoint: r.endpoint,
    keys: { p256dh: r.p256dh, auth: r.auth },
  }));
}

/**
 * Check if a user has any active push subscriptions.
 */
export async function hasSubscriptions(userId: string): Promise<boolean> {
  const result = await withDbRetry(async (db) => {
    const rows = await db.execute(
      sql`SELECT COUNT(*) as count FROM push_subscriptions WHERE userId = ${userId}`
    );
    return (rows as any)[0]?.[0]?.count || 0;
  }, "hasSubscriptions");
  return (result as number) > 0;
}

// ─── Notification Preferences ───────────────────────────

export interface NotificationPreferences {
  alertFired: boolean;       // Temperature alert reached
  stallDetected: boolean;    // Stall detected
  stallBroken: boolean;      // Stall broken
  cookComplete: boolean;     // Cook session completed
  probeDisconnect: boolean;  // Probe disconnected
  phaseChange: boolean;      // Automation phase changed
  tempDeviation: boolean;    // Grill temp deviated from target
  escalatingAlarm: boolean;  // Escalating alarm fired
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  alertFired: true,
  stallDetected: true,
  stallBroken: false,
  cookComplete: true,
  probeDisconnect: true,
  phaseChange: true,
  tempDeviation: true,
  escalatingAlarm: true,
};

/**
 * Get notification preferences for a user. Returns defaults if not set.
 */
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const result = await withDbRetry(async (db) => {
    const rows = await db.execute(
      sql`SELECT preferences FROM notification_preferences WHERE userId = ${userId}`
    );
    return (rows as any)[0]?.[0] || null;
  }, "getNotificationPreferences");

  if (!result) return { ...DEFAULT_PREFERENCES };
  try {
    return { ...DEFAULT_PREFERENCES, ...JSON.parse((result as any).preferences) };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

/**
 * Save notification preferences for a user.
 */
export async function setNotificationPreferences(
  userId: string,
  prefs: Partial<NotificationPreferences>
): Promise<void> {
  const merged = { ...DEFAULT_PREFERENCES, ...prefs };
  const json = JSON.stringify(merged);
  await withDbRetry(async (db) => {
    // Upsert
    const existing = await db.execute(
      sql`SELECT userId FROM notification_preferences WHERE userId = ${userId}`
    );
    if ((existing as any)[0]?.length > 0) {
      await db.execute(
        sql`UPDATE notification_preferences SET preferences = ${json}, updatedAt = NOW() WHERE userId = ${userId}`
      );
    } else {
      await db.execute(
        sql`INSERT INTO notification_preferences (userId, preferences, updatedAt) VALUES (${userId}, ${json}, NOW())`
      );
    }
  }, "setNotificationPreferences");
}

// ─── Send Push Notifications ────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  alarm?: boolean;
}

/**
 * Send a push notification to all subscriptions for a user.
 * Automatically cleans up expired/invalid subscriptions.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  const subscriptions = await getSubscriptions(userId);
  if (subscriptions.length === 0) return 0;

  let sent = 0;
  const staleEndpoints: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify(payload),
          { TTL: payload.alarm ? 86400 : 3600 }
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          staleEndpoints.push(sub.endpoint);
        } else {
          pushLog.error({ endpoint: sub.endpoint.slice(0, 60), err: err.statusCode || err.message }, "Failed to send push");
        }
      }
    })
  );

  // Clean up stale subscriptions
  for (const endpoint of staleEndpoints) {
    await removeSubscription(userId, endpoint);
  }
  if (staleEndpoints.length > 0) {
    pushLog.info({ userId, count: staleEndpoints.length }, "Cleaned up stale subscriptions");
  }

  return sent;
}

/**
 * Send a push notification to a user, respecting their notification preferences.
 * Returns the number of notifications sent (0 if preference is disabled or no subscriptions).
 */
export async function sendPushIfEnabled(
  userId: string,
  preferenceKey: keyof NotificationPreferences,
  payload: PushPayload
): Promise<number> {
  const prefs = await getNotificationPreferences(userId);
  if (!prefs[preferenceKey]) return 0;
  return sendPushToUser(userId, payload);
}
