import { TRPCError } from "@trpc/server";
import {
  traegerRefreshTokens,
  traegerGetMqttCredentials,
  traegerSendCommand,
} from "../traeger-api";
import {
  getTraegerSession,
  updateTraegerSessionTokens,
  getRecentTelemetry,
  getActiveCookSession,
  updateCookSessionStatus,
  updateCookSessionAlerts,
  persistTelemetryFromMqtt,
} from "../db";
import {
  connectMqtt,
  isMqttConnected,
  needsUrlRefresh,
  refreshMqttUrl,
  setDbPersistCallback,
  setCookStatePersistCallback,
  hydrateCookState,
  hydrateHistory,
  type CookAlert as MqttCookAlert,
} from "../mqtt-manager";
import { COMMANDS } from "@shared/traeger-types";

// ─── RC-2 Fix: Per-user connection mutex ───────────────────
// Prevents concurrent ensureMqttConnected calls from racing
const connectionLocks = new Map<number, Promise<void>>();

/**
 * Get a valid idToken for the user, refreshing if needed.
 */
export async function getValidIdToken(userId: number): Promise<{ idToken: string; session: NonNullable<Awaited<ReturnType<typeof getTraegerSession>>> }> {
  const session = await getTraegerSession(userId);
  if (!session) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No Traeger account linked. Please connect your Traeger account first." });
  }
  if (Date.now() > session.expiresAt - 300000) {
    try {
      const tokens = await traegerRefreshTokens(session.refreshToken);
      const expiresAt = Date.now() + tokens.expiresIn * 1000;
      await updateTraegerSessionTokens(userId, tokens.accessToken, tokens.idToken, tokens.refreshToken, expiresAt);
      return { idToken: tokens.idToken, session: { ...session, idToken: tokens.idToken } };
    } catch {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Traeger session expired. Please reconnect your account." });
    }
  }
  return { idToken: session.idToken, session };
}

/**
 * Ensure MQTT is connected and DB persistence is wired.
 * RC-2: Uses a per-user mutex so only one connection attempt runs at a time.
 * Subsequent callers wait for the first to finish rather than racing.
 */
export async function ensureMqttConnected(userId: number) {
  const { idToken, session } = await getValidIdToken(userId);
  if (!session.selectedGrillId) return { idToken, session };

  if (!isMqttConnected(userId) || needsUrlRefresh(userId)) {
    // RC-2: Wait for any in-progress connection attempt for this user
    const existingLock = connectionLocks.get(userId);
    if (existingLock) {
      try {
        await existingLock;
      } catch {
        // Previous attempt failed, we'll try again below
      }
      // After waiting, re-check if connection is now established
      if (isMqttConnected(userId) && !needsUrlRefresh(userId)) {
        return { idToken, session };
      }
    }

    // RC-2: Acquire the lock — create a promise that resolves when we're done
    let releaseLock: () => void;
    let rejectLock: (err: unknown) => void;
    const lockPromise = new Promise<void>((resolve, reject) => {
      releaseLock = resolve;
      rejectLock = reject;
    });
    connectionLocks.set(userId, lockPromise);

    try {
      const creds = await traegerGetMqttCredentials(idToken, session.selectedGrillId);
      const expiresAt = Date.now() + creds.expirationSeconds * 1000;
      if (needsUrlRefresh(userId)) {
        refreshMqttUrl(userId, session.selectedGrillId, creds.signedUrl, expiresAt);
      } else {
        connectMqtt(userId, session.selectedGrillId, creds.signedUrl, expiresAt);
      }
      // Wire DB persistence callback
      setDbPersistCallback(userId, async (uid, telemetry, cookSessionId) => {
        const sess = await getTraegerSession(uid);
        if (!sess?.selectedGrillId) return;
        await persistTelemetryFromMqtt(uid, telemetry, sess.selectedGrillId, cookSessionId);
      });
      // Wire cook state persistence callback
      setCookStatePersistCallback(userId, async (uid, cook) => {
        try {
          await updateCookSessionStatus(cook.cookSessionId, "active", {
            peakGrillTemp: cook.peakGrillTemp,
            peakProbeTemp: cook.peakProbeTemp,
            currentStage: cook.currentStage,
          });
          await updateCookSessionAlerts(cook.cookSessionId, JSON.stringify(cook.alerts));
        } catch (err) {
          console.error(`[Cook State] Failed to persist for user ${uid}:`, err);
        }
      });
      // Hydrate in-memory history from DB (last 8 hours)
      try {
        const dbHistory = await getRecentTelemetry(userId, session.selectedGrillId, 480);
        if (dbHistory.length > 0) {
          const hydrated = hydrateHistory(userId, dbHistory);
          console.log(`[Telemetry] Hydrated ${hydrated} DB points for user ${userId}`);
        }
      } catch (err) {
        console.error("[Telemetry] Failed to hydrate history:", err);
      }
      // Hydrate active cook state from DB if one exists
      try {
        const activeCook = await getActiveCookSession(userId);
        if (activeCook) {
          const alerts: MqttCookAlert[] = activeCook.alertsJson
            ? JSON.parse(typeof activeCook.alertsJson === 'string' ? activeCook.alertsJson : JSON.stringify(activeCook.alertsJson))
            : [];
          const restored = hydrateCookState(userId, {
            cookSessionId: activeCook.id,
            templateId: activeCook.templateId,
            startedAt: new Date(activeCook.startedAt).getTime(),
            currentStage: activeCook.currentStage ?? 0,
            peakGrillTemp: activeCook.peakGrillTemp ?? 0,
            peakProbeTemp: activeCook.peakProbeTemp ?? 0,
            alerts,
            stagesJson: typeof activeCook.stagesJson === 'string' ? activeCook.stagesJson : JSON.stringify(activeCook.stagesJson),
          });
          if (restored) {
            console.log(`[Cook State] Restored active cook session ${activeCook.id} for user ${userId}`);
          }
        }
      } catch (err) {
        console.error("[Cook State] Failed to hydrate cook state:", err);
      }
      // Trigger status request
      try {
        await traegerSendCommand(idToken, session.selectedGrillId, COMMANDS.STATUS_REQUEST);
      } catch { /* non-critical */ }

      releaseLock!();
    } catch (err) {
      rejectLock!(err);
      console.error("[Telemetry] Failed to connect MQTT:", err);
    } finally {
      // Clean up the lock after a short delay to prevent immediate re-entry
      setTimeout(() => {
        if (connectionLocks.get(userId) === lockPromise) {
          connectionLocks.delete(userId);
        }
      }, 1000);
    }
  }
  return { idToken, session };
}

export type { MqttCookAlert };
