/**
 * useAlarmAudio - Client-side audio alarm loop using Web Audio API.
 *
 * Listens for ALARM_START / ALARM_STOP messages from the service worker.
 * When an alarm push arrives and the app is open, plays a synthesized
 * alarm tone that loops every 2 seconds with an escalating pattern.
 *
 * The alarm tone is a two-frequency warble (880Hz → 660Hz) that plays
 * for 1.5 seconds, pauses 0.5 seconds, then repeats. After 5 loops
 * the pattern gets more aggressive (shorter pauses, higher pitch).
 *
 * Usage:
 *   const { activeAlarms, dismissAlarm, dismissAllAlarms } = useAlarmAudio();
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "../lib/trpc";

interface ActiveAlarm {
  alarmKey: string;
  title: string;
  body: string;
  startedAt: number;
  loopCount: number;
}

// ─── Audio Synthesis ──────────────────────────────────

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContext();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
}

/**
 * Play a single alarm beep cycle (warble tone).
 * Returns a promise that resolves when the beep finishes.
 */
function playAlarmBeep(loopCount: number): Promise<void> {
  return new Promise((resolve) => {
    try {
      const ctx = getAudioContext();

      // Escalate: higher pitch and faster warble after more loops
      const baseFreq = loopCount < 5 ? 880 : loopCount < 10 ? 1000 : 1200;
      const altFreq = loopCount < 5 ? 660 : loopCount < 10 ? 800 : 950;
      const warbleRate = loopCount < 5 ? 4 : loopCount < 10 ? 6 : 8;
      const volume = Math.min(0.3 + loopCount * 0.02, 0.6); // Gradually louder, capped

      const now = ctx.currentTime;
      const duration = 1.2; // seconds

      // Oscillator 1: main tone
      const osc1 = ctx.createOscillator();
      osc1.type = "square";
      osc1.frequency.setValueAtTime(baseFreq, now);

      // Warble: alternate between two frequencies
      for (let i = 0; i < warbleRate * 2; i++) {
        const t = now + (i * duration) / (warbleRate * 2);
        osc1.frequency.setValueAtTime(i % 2 === 0 ? baseFreq : altFreq, t);
      }

      // Gain envelope: quick attack, sustain, quick release
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.02); // 20ms attack
      gain.gain.setValueAtTime(volume, now + duration - 0.05);
      gain.gain.linearRampToValueAtTime(0, now + duration); // 50ms release

      osc1.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + duration);

      osc1.onended = () => {
        osc1.disconnect();
        gain.disconnect();
        resolve();
      };
    } catch {
      // Web Audio not available
      resolve();
    }
  });
}

// ─── Hook ─────────────────────────────────────────────

export function useAlarmAudio() {
  const [activeAlarms, setActiveAlarms] = useState<Map<string, ActiveAlarm>>(new Map());
  const loopTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const isPlayingRef = useRef<Set<string>>(new Set());

  const dismissAlarmMutation = trpc.push.dismissAlarm.useMutation();
  const dismissAllAlarmsMutation = trpc.push.dismissAllAlarms.useMutation();

  // ─── Start alarm audio loop for a key ────────────────
  const startAlarmLoop = useCallback((alarmKey: string) => {
    if (isPlayingRef.current.has(alarmKey)) return; // Already playing
    isPlayingRef.current.add(alarmKey);

    const loop = async () => {
      if (!isPlayingRef.current.has(alarmKey)) return;

      // Get current loop count
      const alarm = activeAlarms.get(alarmKey);
      const loopCount = alarm?.loopCount ?? 0;

      // Play the beep
      await playAlarmBeep(loopCount);

      // Update loop count
      setActiveAlarms((prev) => {
        const next = new Map(prev);
        const existing = next.get(alarmKey);
        if (existing) {
          next.set(alarmKey, { ...existing, loopCount: existing.loopCount + 1 });
        }
        return next;
      });

      // Schedule next beep (gap between beeps decreases with escalation)
      if (isPlayingRef.current.has(alarmKey)) {
        const gap = loopCount < 5 ? 2000 : loopCount < 10 ? 1500 : 1000;
        const timer = setTimeout(loop, gap);
        loopTimersRef.current.set(alarmKey, timer);
      }
    };

    loop();
  }, [activeAlarms]);

  // ─── Stop alarm audio loop for a key ─────────────────
  const stopAlarmLoop = useCallback((alarmKey: string) => {
    isPlayingRef.current.delete(alarmKey);
    const timer = loopTimersRef.current.get(alarmKey);
    if (timer) {
      clearTimeout(timer);
      loopTimersRef.current.delete(alarmKey);
    }
  }, []);

  // ─── Dismiss a single alarm (client + server) ────────
  const dismissAlarm = useCallback(
    (alarmKey: string) => {
      stopAlarmLoop(alarmKey);
      setActiveAlarms((prev) => {
        const next = new Map(prev);
        next.delete(alarmKey);
        return next;
      });
      // Tell server to stop escalation
      dismissAlarmMutation.mutate({ alarmKey });
    },
    [stopAlarmLoop, dismissAlarmMutation]
  );

  // ─── Dismiss all alarms ──────────────────────────────
  const dismissAllAlarms = useCallback(() => {
    Array.from(isPlayingRef.current).forEach((key) => {
      stopAlarmLoop(key);
    });
    isPlayingRef.current.clear();
    Array.from(loopTimersRef.current.values()).forEach((timer) => {
      clearTimeout(timer);
    });
    loopTimersRef.current.clear();
    setActiveAlarms(new Map());
    dismissAllAlarmsMutation.mutate();
  }, [stopAlarmLoop, dismissAllAlarmsMutation]);

  // ─── Listen for service worker messages ──────────────
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent) => {
      if (!event.data) return;

      if (event.data.type === "ALARM_START") {
        const { alarmKey, title, body } = event.data;
        const alarm: ActiveAlarm = {
          alarmKey,
          title: title || "Alarm",
          body: body || "",
          startedAt: Date.now(),
          loopCount: 0,
        };

        setActiveAlarms((prev) => {
          const next = new Map(prev);
          // If already active, don't reset (escalation re-push)
          if (!next.has(alarmKey)) {
            next.set(alarmKey, alarm);
          }
          return next;
        });

        // Start audio loop (safe to call if already playing)
        startAlarmLoop(alarmKey);
      }

      if (event.data.type === "ALARM_STOP") {
        const { alarmKey } = event.data;
        stopAlarmLoop(alarmKey);
        setActiveAlarms((prev) => {
          const next = new Map(prev);
          next.delete(alarmKey);
          return next;
        });
      }
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handler);
    };
  }, [startAlarmLoop, stopAlarmLoop]);

  // ─── Cleanup on unmount ──────────────────────────────
  useEffect(() => {
    return () => {
      Array.from(loopTimersRef.current.values()).forEach((timer) => {
        clearTimeout(timer);
      });
      isPlayingRef.current.clear();
    };
  }, []);

  return {
    activeAlarms,
    hasActiveAlarms: activeAlarms.size > 0,
    alarmCount: activeAlarms.size,
    dismissAlarm,
    dismissAllAlarms,
  };
}
