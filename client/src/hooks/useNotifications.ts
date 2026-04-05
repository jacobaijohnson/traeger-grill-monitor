import { useState, useEffect, useCallback, useRef } from "react";

type NotificationPermission = "default" | "granted" | "denied";

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const [supported] = useState(() => typeof Notification !== "undefined");

  const requestPermission = useCallback(async () => {
    if (!supported) return "denied" as NotificationPermission;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, [supported]);

  return { permission, supported, requestPermission };
}

export function useBrowserNotification() {
  const { permission, supported, requestPermission } = useNotificationPermission();

  const sendNotification = useCallback(
    (title: string, options?: { body?: string; tag?: string; requireInteraction?: boolean; vibrate?: number[] }) => {
      if (!supported || permission !== "granted") return;

      try {
        // Try service worker notification first (works in background)
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: "SHOW_NOTIFICATION",
            title,
            options: {
              body: options?.body,
              icon: "/pwa-icon-192.png",
              badge: "/pwa-icon-192.png",
              tag: options?.tag || "grill-alert",
              requireInteraction: options?.requireInteraction || false,
              vibrate: options?.vibrate || [200, 100, 200],
              data: { url: "/live-cook" },
            },
          });
        } else {
          // Fallback to regular notification
          new Notification(title, {
            body: options?.body,
            icon: "/pwa-icon-192.png",
            tag: options?.tag || "grill-alert",
            requireInteraction: options?.requireInteraction || false,
          });
        }
      } catch {
        // Notification failed silently
      }
    },
    [supported, permission]
  );

  const sendAlarm = useCallback(
    (title: string, body: string, tag: string) => {
      sendNotification(title, {
        body,
        tag,
        requireInteraction: true, // Won't auto-dismiss
        vibrate: [500, 200, 500, 200, 500, 200, 500], // Aggressive vibration
      });
    },
    [sendNotification]
  );

  const sendPing = useCallback(
    (title: string, body: string, tag?: string) => {
      sendNotification(title, {
        body,
        tag,
        requireInteraction: false, // Auto-dismisses
        vibrate: [200, 100, 200],
      });
    },
    [sendNotification]
  );

  return { permission, supported, requestPermission, sendNotification, sendAlarm, sendPing };
}

export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const deferredPrompt = useRef<Event | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt.current) return false;
    const prompt = deferredPrompt.current as any;
    prompt.prompt();
    const result = await prompt.userChoice;
    deferredPrompt.current = null;
    setCanInstall(false);
    return result.outcome === "accepted";
  }, []);

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true);

  return { canInstall, install, isStandalone };
}
