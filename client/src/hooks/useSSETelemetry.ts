import { useEffect, useRef, useState, useCallback } from "react";

export interface SSETelemetryData {
  telemetry: {
    grill: number;
    probe: number;
    ambient: number;
    set: number;
    probeSet: number;
    pelletLevel: number;
    systemStatus: number;
    connected: boolean;
  };
  activeCook: {
    startedAt: number;
    currentStage: number;
    peakGrillTemp: number;
    peakProbeTemp: number;
    alertCount: number;
  } | null;
  firedAlerts: Array<{
    id: string;
    label: string;
    triggerTemp: number;
    status: string;
    firedAt?: number;
    message?: string;
  }>;
  missedAlerts: Array<{
    id: string;
    label: string;
    triggerTemp: number;
    firedAt?: number;
    message?: string;
  }>;
  stallInfo: {
    detected: boolean;
    startedAt?: number;
    startTemp?: number;
    duration?: number;
  } | null;
}

export interface SSEAlertEvent {
  id: string;
  label: string;
  message: string;
  alertType: string;
}

export interface SSEDisconnectEvent {
  reason: string;
}

type SSEMessage =
  | { type: "telemetry"; data: SSETelemetryData; timestamp: number }
  | { type: "alert"; data: SSEAlertEvent; timestamp: number }
  | { type: "disconnect"; data: SSEDisconnectEvent; timestamp: number };

interface UseSSETelemetryOptions {
  /** Whether SSE should be active (default: true) */
  enabled?: boolean;
  /** Callback when a new alert fires */
  onAlert?: (alert: SSEAlertEvent) => void;
  /** Callback when the grill disconnects */
  onDisconnect?: (reason: string) => void;
}

/**
 * Hook that connects to the SSE telemetry endpoint for real-time updates.
 * Falls back gracefully if SSE is unavailable (the existing polling still works).
 *
 * Usage:
 * ```tsx
 * const { telemetry, isConnected } = useSSETelemetry({
 *   onAlert: (alert) => toast.warning(alert.message),
 *   onDisconnect: (reason) => toast.error(`Grill disconnected: ${reason}`),
 * });
 * ```
 */
export function useSSETelemetry(options: UseSSETelemetryOptions = {}) {
  const { enabled = true, onAlert, onDisconnect } = options;
  const [telemetry, setTelemetry] = useState<SSETelemetryData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onAlertRef = useRef(onAlert);
  const onDisconnectRef = useRef(onDisconnect);

  // Keep callback refs current
  onAlertRef.current = onAlert;
  onDisconnectRef.current = onDisconnect;

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource("/api/sse/telemetry");
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const msg: SSEMessage = JSON.parse(event.data);

        switch (msg.type) {
          case "telemetry":
            setTelemetry(msg.data);
            setLastUpdate(msg.timestamp);
            break;
          case "alert":
            onAlertRef.current?.(msg.data);
            break;
          case "disconnect":
            onDisconnectRef.current?.(msg.data.reason);
            break;
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      // EventSource will auto-reconnect
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setIsConnected(false);
      }
    };
  }, [enabled, connect]);

  return {
    /** Latest telemetry data from SSE */
    telemetry,
    /** Whether the SSE connection is active */
    isConnected,
    /** Timestamp of the last update */
    lastUpdate,
    /** Manually reconnect */
    reconnect: connect,
  };
}
