/**
 * Alarm Escalation Manager
 *
 * Tracks active alarm-type notifications and re-pushes them at increasing
 * intervals until the user dismisses them. This ensures critical alerts
 * (temperature alarms, probe disconnect, escalating alarms) keep buzzing
 * the user's phone rather than firing a single silent notification.
 *
 * Flow:
 * 1. mqtt-manager fires an alarm → calls registerAlarm()
 * 2. Escalation loop re-pushes every ESCALATION_INTERVAL_MS if not dismissed
 * 3. User dismisses via notification action or in-app → calls dismissAlarm()
 * 4. Auto-stops after MAX_ESCALATIONS to prevent infinite loops
 */

import { sendPushToUser, type PushPayload } from "./web-push";

// ─── Configuration ─────────────────────────────────────

/** Time between re-pushes (2 minutes) */
const ESCALATION_INTERVAL_MS = 2 * 60 * 1000;

/** Maximum number of re-pushes before auto-stopping (30 min total) */
const MAX_ESCALATIONS = 15;

/** Urgency labels that escalate over time */
const URGENCY_PREFIXES = [
  "",           // 0: original push (no prefix)
  "⚠️ ",       // 1: first re-push
  "🚨 ",       // 2
  "🔴 ",       // 3
  "‼️ ",       // 4
  "🆘 ",       // 5+
];

// ─── Types ─────────────────────────────────────────────

interface AlarmEscalation {
  userId: string;
  alarmKey: string;
  payload: PushPayload;
  escalationCount: number;
  registeredAt: number;
  lastPushedAt: number;
  timerId: ReturnType<typeof setTimeout> | null;
}

// ─── State ─────────────────────────────────────────────

/** Active alarms keyed by `${userId}:${alarmKey}` */
const activeAlarms = new Map<string, AlarmEscalation>();

// ─── Public API ────────────────────────────────────────

/**
 * Register an alarm for escalation. If the same alarm key is already active
 * for this user, it resets the escalation count (the alarm re-fired).
 */
export function registerAlarm(
  userId: string,
  alarmKey: string,
  payload: PushPayload
): void {
  const compositeKey = `${userId}:${alarmKey}`;

  // Clear existing escalation timer if re-registering
  const existing = activeAlarms.get(compositeKey);
  if (existing?.timerId) {
    clearTimeout(existing.timerId);
  }

  const alarm: AlarmEscalation = {
    userId,
    alarmKey,
    payload: { ...payload, alarm: true },
    escalationCount: 0,
    registeredAt: Date.now(),
    lastPushedAt: Date.now(),
    timerId: null,
  };

  activeAlarms.set(compositeKey, alarm);
  scheduleNextEscalation(compositeKey);

  console.log(`[ALARM] Registered escalation: ${alarmKey} for user ${userId}`);
}

/**
 * Dismiss an alarm, stopping all future re-pushes.
 * Returns true if the alarm was found and dismissed.
 */
export function dismissAlarm(userId: string, alarmKey: string): boolean {
  const compositeKey = `${userId}:${alarmKey}`;
  const alarm = activeAlarms.get(compositeKey);

  if (!alarm) return false;

  if (alarm.timerId) {
    clearTimeout(alarm.timerId);
  }
  activeAlarms.delete(compositeKey);

  console.log(
    `[ALARM] Dismissed: ${alarmKey} for user ${userId} after ${alarm.escalationCount} escalation(s)`
  );
  return true;
}

/**
 * Dismiss all active alarms for a user (e.g., when they end a cook session).
 */
export function dismissAllAlarms(userId: string): number {
  let dismissed = 0;
  for (const [key, alarm] of Array.from(activeAlarms)) {
    if (alarm.userId === userId) {
      if (alarm.timerId) clearTimeout(alarm.timerId);
      activeAlarms.delete(key);
      dismissed++;
    }
  }
  if (dismissed > 0) {
    console.log(`[ALARM] Dismissed all ${dismissed} alarm(s) for user ${userId}`);
  }
  return dismissed;
}

/**
 * Get all active alarms for a user.
 */
export function getActiveAlarms(userId: string): Array<{
  alarmKey: string;
  escalationCount: number;
  registeredAt: number;
  lastPushedAt: number;
  payload: PushPayload;
}> {
  const result: Array<{
    alarmKey: string;
    escalationCount: number;
    registeredAt: number;
    lastPushedAt: number;
    payload: PushPayload;
  }> = [];

  for (const alarm of Array.from(activeAlarms.values())) {
    if (alarm.userId === userId) {
      result.push({
        alarmKey: alarm.alarmKey,
        escalationCount: alarm.escalationCount,
        registeredAt: alarm.registeredAt,
        lastPushedAt: alarm.lastPushedAt,
        payload: alarm.payload,
      });
    }
  }
  return result;
}

/**
 * Check if a specific alarm is currently active.
 */
export function isAlarmActive(userId: string, alarmKey: string): boolean {
  return activeAlarms.has(`${userId}:${alarmKey}`);
}

/**
 * Get total count of active alarms across all users (for monitoring).
 */
export function getActiveAlarmCount(): number {
  return activeAlarms.size;
}

// ─── Internal ──────────────────────────────────────────

function scheduleNextEscalation(compositeKey: string): void {
  const alarm = activeAlarms.get(compositeKey);
  if (!alarm) return;

  alarm.timerId = setTimeout(async () => {
    // Check if still active (might have been dismissed during the wait)
    const current = activeAlarms.get(compositeKey);
    if (!current) return;

    current.escalationCount++;

    // Auto-stop after max escalations
    if (current.escalationCount > MAX_ESCALATIONS) {
      console.log(
        `[ALARM] Auto-stopping ${current.alarmKey} for user ${current.userId} after ${MAX_ESCALATIONS} escalations`
      );
      activeAlarms.delete(compositeKey);
      return;
    }

    // Build escalated payload
    const urgencyIdx = Math.min(current.escalationCount, URGENCY_PREFIXES.length - 1);
    const urgencyPrefix = URGENCY_PREFIXES[urgencyIdx];
    const minutesElapsed = Math.round((Date.now() - current.registeredAt) / 60000);

    const escalatedPayload: PushPayload = {
      ...current.payload,
      title: `${urgencyPrefix}${current.payload.title}`,
      body: `${current.payload.body} (${minutesElapsed}m ago — tap to dismiss)`,
      alarm: true,
    };

    // Re-push
    try {
      const sent = await sendPushToUser(current.userId, escalatedPayload);
      current.lastPushedAt = Date.now();
      console.log(
        `[ALARM] Escalation #${current.escalationCount} for ${current.alarmKey} → ${sent} device(s)`
      );
    } catch (err) {
      console.error(`[ALARM] Escalation push failed for ${current.alarmKey}:`, err);
    }

    // Schedule next escalation
    scheduleNextEscalation(compositeKey);
  }, ESCALATION_INTERVAL_MS);
}

// ─── Cleanup on process exit ───────────────────────────

function cleanup(): void {
  for (const alarm of Array.from(activeAlarms.values())) {
    if (alarm.timerId) clearTimeout(alarm.timerId);
  }
  activeAlarms.clear();
}

process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);
