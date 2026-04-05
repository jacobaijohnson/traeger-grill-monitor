import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useTraegerStatus() {
  return trpc.traeger.status.useQuery(undefined, {
    refetchInterval: 30000,
  });
}

export function useTraegerConnect() {
  const utils = trpc.useUtils();
  return trpc.traeger.connect.useMutation({
    onSuccess: () => {
      utils.traeger.status.invalidate();
    },
  });
}

export function useTraegerDisconnect() {
  const utils = trpc.useUtils();
  return trpc.traeger.disconnect.useMutation({
    onSuccess: () => {
      utils.traeger.status.invalidate();
    },
  });
}

export function useGrillCommands() {
  const utils = trpc.useUtils();
  const invalidateTelemetry = () => {
    setTimeout(() => utils.grill.telemetry.invalidate(), 2000);
    setTimeout(() => utils.grill.telemetry.invalidate(), 5000);
  };

  return {
    setTemp: trpc.grill.setTemp.useMutation({ onSuccess: invalidateTelemetry }),
    setTimer: trpc.grill.setTimer.useMutation({ onSuccess: invalidateTelemetry }),
    clearTimer: trpc.grill.clearTimer.useMutation({ onSuccess: invalidateTelemetry }),
    setProbeAlarm: trpc.grill.setProbeAlarm.useMutation({ onSuccess: invalidateTelemetry }),
    setSuperSmoke: trpc.grill.setSuperSmoke.useMutation({ onSuccess: invalidateTelemetry }),
    setKeepWarm: trpc.grill.setKeepWarm.useMutation({ onSuccess: invalidateTelemetry }),
    shutdown: trpc.grill.shutdown.useMutation({ onSuccess: invalidateTelemetry }),
    requestStatus: trpc.grill.requestStatus.useMutation({ onSuccess: invalidateTelemetry }),
  };
}

/**
 * Live telemetry from server-side MQTT cache.
 * Adaptive polling: 8s cooking, 20s cooling, 30s idle, 60s sleeping.
 */
export function useLiveTelemetry() {
  return trpc.grill.telemetry.useQuery(undefined, {
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || !data.connected) return 15000;
      const status = data.systemStatus;
      if (status >= 4 && status <= 7) return 8000;  // Active cook
      if (status === 8 || status === 9) return 20000; // Cooling
      if (status === 2 || status === 3) return 30000; // Idle
      return 30000;
    },
    refetchIntervalInBackground: true,
  });
}

/**
 * Telemetry history for charting from server-side MQTT cache.
 * Returns data in the format expected by TemperatureGraph component.
 */
export function useTelemetryHistory(minutes?: number) {
  const historyQuery = trpc.grill.telemetryHistory.useQuery(
    minutes ? { minutes } : undefined,
    { refetchInterval: 15000 }
  );

  const chartData = useMemo(() => {
    if (!historyQuery.data) return [];
    return historyQuery.data.map((h) => ({
      timestamp: h.timestamp,
      time: new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      grill: h.grill > 0 ? h.grill : 0,
      probe: h.probe > 0 ? h.probe : 0,
      ambient: h.ambient > 0 ? h.ambient : 0,
      set: h.set > 0 ? h.set : 0,
      smoke: h.smoke,
      keepwarm: h.keepwarm,
    }));
  }, [historyQuery.data]);

  return { history: historyQuery.data || [], chartData, isLoading: historyQuery.isLoading };
}

// ===== Live Cook Session =====

export function useLiveCook() {
  const utils = trpc.useUtils();
  const activeCookQuery = trpc.liveCook.active.useQuery(undefined, {
    refetchInterval: (query) => {
      return query.state.data ? 8000 : 15000;
    },
    refetchIntervalInBackground: true,
  });

  const startCook = trpc.liveCook.start.useMutation({
    onSuccess: () => {
      utils.liveCook.active.invalidate();
    },
  });

  const endCook = trpc.liveCook.end.useMutation({
    onSuccess: () => {
      utils.liveCook.active.invalidate();
      utils.cookSession.list.invalidate();
    },
  });

  const cancelCook = trpc.liveCook.cancel.useMutation({
    onSuccess: () => {
      utils.liveCook.active.invalidate();
    },
  });

  const dismissAlert = trpc.liveCook.dismissAlert.useMutation({
    onSuccess: () => {
      utils.liveCook.active.invalidate();
    },
  });

  const addAlert = trpc.liveCook.addAlert.useMutation({
    onSuccess: () => {
      utils.liveCook.active.invalidate();
    },
  });

  const removeAlert = trpc.liveCook.removeAlert.useMutation({
    onSuccess: () => {
      utils.liveCook.active.invalidate();
    },
  });

  return {
    activeCook: activeCookQuery.data,
    isLoading: activeCookQuery.isLoading,
    startCook,
    endCook,
    cancelCook,
    dismissAlert,
    addAlert,
    removeAlert,
    refetch: () => utils.liveCook.active.invalidate(),
  };
}

// ===== Browser Notification System =====

type NotificationType = "notification" | "alarm";

interface PendingNotification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  timestamp: number;
}

/**
 * Hook for browser notifications and persistent alarms.
 * - Notifications: one-time ping, auto-dismiss after 10s
 * - Alarms: persistent, keep firing every 5s until dismissed
 */
export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [activeAlarms, setActiveAlarms] = useState<PendingNotification[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [alarmsEnabled, setAlarmsEnabled] = useState(true);
  const alarmIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const firedAlertsRef = useRef<Set<string>>(new Set());

  // Request permission
  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  // Send a notification (one-time ping)
  const sendNotification = useCallback(
    (id: string, title: string, body: string) => {
      if (!notificationsEnabled) return;
      if (firedAlertsRef.current.has(id)) return;
      firedAlertsRef.current.add(id);

      if (permission === "granted") {
        try {
          const n = new Notification(title, {
            body,
            icon: "/favicon.ico",
            tag: id,
            requireInteraction: false,
          });
          setTimeout(() => n.close(), 10000);
        } catch {
          // Fallback: just log
          console.log(`[Notification] ${title}: ${body}`);
        }
      }
    },
    [permission, notificationsEnabled]
  );

  // Start a persistent alarm (keeps firing until dismissed)
  const startAlarm = useCallback(
    (id: string, title: string, body: string) => {
      if (!alarmsEnabled) return;
      if (firedAlertsRef.current.has(id)) return;
      firedAlertsRef.current.add(id);

      const alarm: PendingNotification = { id, title, body, type: "alarm", timestamp: Date.now() };
      setActiveAlarms((prev) => [...prev.filter((a) => a.id !== id), alarm]);

      // Fire notification immediately
      if (permission === "granted") {
        try {
          new Notification(`🚨 ${title}`, {
            body,
            icon: "/favicon.ico",
            tag: `alarm-${id}`,
            requireInteraction: true,
          });
        } catch {}
      }

      // Repeat every 15 seconds
      const interval = setInterval(() => {
        if (permission === "granted") {
          try {
            new Notification(`🚨 ${title}`, {
              body: `${body} (STILL ACTIVE)`,
              icon: "/favicon.ico",
              tag: `alarm-${id}`,
              requireInteraction: true,
            });
          } catch {}
        }
        // Also play a beep if available
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.value = 0.3;
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
        } catch {}
      }, 15000);

      alarmIntervalsRef.current.set(id, interval);
    },
    [permission, alarmsEnabled]
  );

  // Dismiss an alarm
  const dismissAlarm = useCallback((id: string) => {
    const interval = alarmIntervalsRef.current.get(id);
    if (interval) {
      clearInterval(interval);
      alarmIntervalsRef.current.delete(id);
    }
    setActiveAlarms((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Dismiss all alarms
  const dismissAllAlarms = useCallback(() => {
    alarmIntervalsRef.current.forEach((interval) => clearInterval(interval));
    alarmIntervalsRef.current.clear();
    setActiveAlarms([]);
  }, []);

  // Reset fired alerts (for new cook session)
  const resetFiredAlerts = useCallback(() => {
    firedAlertsRef.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      alarmIntervalsRef.current.forEach((interval) => clearInterval(interval));
    };
  }, []);

  return {
    permission,
    requestPermission,
    sendNotification,
    startAlarm,
    dismissAlarm,
    dismissAllAlarms,
    activeAlarms,
    notificationsEnabled,
    setNotificationsEnabled,
    alarmsEnabled,
    setAlarmsEnabled,
    resetFiredAlerts,
  };
}

// Re-export telemetry state type for compatibility
export interface TelemetryState {
  grill: number;
  set: number;
  ambient: number;
  pelletLevel: number;
  connected: boolean;
  systemStatus: number;
  probe: number;
  probeSet: number;
  keepwarm: number;
  smoke: number;
  cookTimerStart: number;
  cookTimerEnd: number;
}
