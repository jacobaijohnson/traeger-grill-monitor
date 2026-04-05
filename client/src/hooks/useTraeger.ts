import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

export function useTraegerStatus() {
  return trpc.traeger.status.useQuery(undefined, {
    refetchInterval: 30000,
  });
}

export function useTraegerConnect() {
  const utils = trpc.useUtils();
  const connectMutation = trpc.traeger.connect.useMutation({
    onSuccess: () => {
      utils.traeger.status.invalidate();
    },
  });

  return connectMutation;
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
    // After sending a command, refetch telemetry quickly
    setTimeout(() => utils.grill.telemetry.invalidate(), 2000);
    setTimeout(() => utils.grill.telemetry.invalidate(), 5000);
  };

  const setTemp = trpc.grill.setTemp.useMutation({ onSuccess: invalidateTelemetry });
  const setTimer = trpc.grill.setTimer.useMutation({ onSuccess: invalidateTelemetry });
  const clearTimer = trpc.grill.clearTimer.useMutation({ onSuccess: invalidateTelemetry });
  const setProbeAlarm = trpc.grill.setProbeAlarm.useMutation({ onSuccess: invalidateTelemetry });
  const setSuperSmoke = trpc.grill.setSuperSmoke.useMutation({ onSuccess: invalidateTelemetry });
  const setKeepWarm = trpc.grill.setKeepWarm.useMutation({ onSuccess: invalidateTelemetry });
  const shutdown = trpc.grill.shutdown.useMutation({ onSuccess: invalidateTelemetry });
  const requestStatus = trpc.grill.requestStatus.useMutation({ onSuccess: invalidateTelemetry });

  return {
    setTemp,
    setTimer,
    clearTimer,
    setProbeAlarm,
    setSuperSmoke,
    setKeepWarm,
    shutdown,
    requestStatus,
  };
}

/**
 * Live telemetry from server-side MQTT cache.
 * Uses adaptive polling: 10s when cooking, 30s when idle, 60s when sleeping/offline.
 */
export function useLiveTelemetry() {
  const telemetryQuery = trpc.grill.telemetry.useQuery(undefined, {
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || !data.connected) return 15000; // Not connected yet, poll every 15s to pick up MQTT data
      const status = data.systemStatus;
      // Cooking states (4=Igniting, 5=Preheating, 6=Cooking, 7=Custom Cook)
      if (status >= 4 && status <= 7) return 10000; // Active cook: every 10s
      // Cool down / shutdown
      if (status === 8 || status === 9) return 20000; // Cooling: every 20s
      // Idle / sleeping
      if (status === 2 || status === 3) return 30000; // Idle: every 30s
      return 30000; // Default
    },
    refetchIntervalInBackground: true,
  });

  return telemetryQuery;
}

/**
 * Telemetry history for charting from server-side MQTT cache.
 */
export function useTelemetryHistory() {
  const historyQuery = trpc.grill.telemetryHistory.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const chartData = useMemo(() => {
    if (!historyQuery.data) return [];
    return historyQuery.data.map((h) => ({
      time: new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      grill: h.grill > 0 ? h.grill : undefined,
      probe: h.probe > 0 ? h.probe : undefined,
      ambient: h.ambient > 0 ? h.ambient : undefined,
      target: h.set > 0 ? h.set : undefined,
    }));
  }, [historyQuery.data]);

  return { history: historyQuery.data || [], chartData, isLoading: historyQuery.isLoading };
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
