import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  getVapidPublicKey,
  saveSubscription,
  removeSubscription,
  removeAllSubscriptions,
  hasSubscriptions,
  getNotificationPreferences,
  setNotificationPreferences,
  sendPushToUser,
} from "../web-push";
import {
  dismissAlarm,
  dismissAllAlarms,
  getActiveAlarms,
} from "../alarm-escalation";

export const pushRouter = router({
  /**
   * Get the VAPID public key for the frontend to subscribe.
   */
  getVapidKey: protectedProcedure.query(async () => {
    const key = await getVapidPublicKey();
    return { publicKey: key };
  }),

  /**
   * Subscribe this device for push notifications.
   */
  subscribe: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url(),
        keys: z.object({
          p256dh: z.string().max(512),
          auth: z.string().max(512),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await saveSubscription(ctx.user.id, {
        endpoint: input.endpoint,
        keys: input.keys,
      });
      return { success: true };
    }),

  /**
   * Unsubscribe this device from push notifications.
   */
  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      await removeSubscription(ctx.user.id, input.endpoint);
      return { success: true };
    }),

  /**
   * Unsubscribe all devices for this user.
   */
  unsubscribeAll: protectedProcedure.mutation(async ({ ctx }) => {
    await removeAllSubscriptions(ctx.user.id);
    return { success: true };
  }),

  /**
   * Check if user has any active push subscriptions.
   */
  isSubscribed: protectedProcedure.query(async ({ ctx }) => {
    const subscribed = await hasSubscriptions(ctx.user.id);
    return { subscribed };
  }),

  /**
   * Get notification preferences for the current user.
   */
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    return getNotificationPreferences(ctx.user.id);
  }),

  /**
   * Update notification preferences for the current user.
   */
  setPreferences: protectedProcedure
    .input(
      z.object({
        alertFired: z.boolean().optional(),
        stallDetected: z.boolean().optional(),
        stallBroken: z.boolean().optional(),
        cookComplete: z.boolean().optional(),
        probeDisconnect: z.boolean().optional(),
        phaseChange: z.boolean().optional(),
        tempDeviation: z.boolean().optional(),
        escalatingAlarm: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await setNotificationPreferences(ctx.user.id, input);
      return { success: true };
    }),

  /**
   * Send a test push notification to verify setup.
   */
  sendTest: protectedProcedure.mutation(async ({ ctx }) => {
    const count = await sendPushToUser(ctx.user.id, {
      title: "🔥 Test Notification",
      body: "Push notifications are working! You'll receive cook alerts on this device.",
      tag: "test-push",
      url: "/settings",
    });
    return { sent: count };
  }),

  /**
   * Dismiss an active alarm (stops server-side escalation re-pushes).
   * Called from the service worker when user taps "Dismiss Alarm" or closes the notification.
   */
  dismissAlarm: protectedProcedure
    .input(z.object({ alarmKey: z.string().max(256) }))
    .mutation(async ({ ctx, input }) => {
      const dismissed = dismissAlarm(ctx.user.id, input.alarmKey);
      return { dismissed };
    }),

  /**
   * Dismiss all active alarms for the current user.
   */
  dismissAllAlarms: protectedProcedure.mutation(async ({ ctx }) => {
    const count = dismissAllAlarms(ctx.user.id);
    return { dismissed: count };
  }),

  /**
   * Get all active alarms for the current user (for UI display).
   */
  getActiveAlarms: protectedProcedure.query(async ({ ctx }) => {
    return getActiveAlarms(ctx.user.id);
  }),
});
