import { trpc } from "@/lib/trpc";
import { useState, useCallback } from "react";

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
  const setTemp = trpc.grill.setTemp.useMutation();
  const setTimer = trpc.grill.setTimer.useMutation();
  const clearTimer = trpc.grill.clearTimer.useMutation();
  const setProbeAlarm = trpc.grill.setProbeAlarm.useMutation();
  const setSuperSmoke = trpc.grill.setSuperSmoke.useMutation();
  const setKeepWarm = trpc.grill.setKeepWarm.useMutation();
  const shutdown = trpc.grill.shutdown.useMutation();
  const requestStatus = trpc.grill.requestStatus.useMutation();

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

// Simple telemetry state for the dashboard (simulated until MQTT is connected)
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

const DEFAULT_TELEMETRY: TelemetryState = {
  grill: 0,
  set: 0,
  ambient: 0,
  pelletLevel: 0,
  connected: false,
  systemStatus: 99,
  probe: 0,
  probeSet: 0,
  keepwarm: 0,
  smoke: 0,
  cookTimerStart: 0,
  cookTimerEnd: 0,
};

export function useTelemetryState() {
  const [telemetry, setTelemetry] = useState<TelemetryState>(DEFAULT_TELEMETRY);
  const [history, setHistory] = useState<Array<TelemetryState & { timestamp: number }>>([]);

  const updateTelemetry = useCallback((data: Partial<TelemetryState>) => {
    setTelemetry((prev) => {
      const next = { ...prev, ...data };
      setHistory((h) => {
        const entry = { ...next, timestamp: Date.now() };
        const newHistory = [...h, entry];
        // Keep last 2 hours of data (at ~30s intervals = ~240 points)
        if (newHistory.length > 300) {
          return newHistory.slice(-300);
        }
        return newHistory;
      });
      return next;
    });
  }, []);

  const resetTelemetry = useCallback(() => {
    setTelemetry(DEFAULT_TELEMETRY);
    setHistory([]);
  }, []);

  return { telemetry, history, updateTelemetry, resetTelemetry };
}
