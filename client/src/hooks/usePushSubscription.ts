import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Convert a base64 VAPID key to Uint8Array for PushManager.subscribe()
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushStatus = "unsupported" | "loading" | "unsubscribed" | "subscribed" | "denied";

export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const vapidQuery = trpc.push.getVapidKey.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const subscribeMutation = trpc.push.subscribe.useMutation();
  const unsubscribeMutation = trpc.push.unsubscribe.useMutation();
  const sendTestMutation = trpc.push.sendTest.useMutation();

  // Check current subscription status on mount
  useEffect(() => {
    async function checkStatus() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setStatus(subscription ? "subscribed" : "unsubscribed");
      } catch {
        setStatus("unsubscribed");
      }
    }
    checkStatus();
  }, []);

  const subscribe = useCallback(async () => {
    setError(null);

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setError("Push notifications are not supported in this browser.");
      return false;
    }

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setStatus("denied");
        setError("Notification permission was denied. Enable it in browser settings.");
        return false;
      }

      if (!vapidQuery.data?.publicKey) {
        setError("Server VAPID key not available. Try again later.");
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(vapidQuery.data.publicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      // Extract keys and send to server
      const json = subscription.toJSON();
      await subscribeMutation.mutateAsync({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: json.keys?.p256dh || "",
          auth: json.keys?.auth || "",
        },
      });

      setStatus("subscribed");
      return true;
    } catch (err: any) {
      console.error("[Push] Subscribe error:", err);
      setError(err.message || "Failed to subscribe to push notifications.");
      return false;
    }
  }, [vapidQuery.data, subscribeMutation]);

  const unsubscribe = useCallback(async () => {
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe();
        // Remove from server
        await unsubscribeMutation.mutateAsync({ endpoint: subscription.endpoint });
      }

      setStatus("unsubscribed");
      return true;
    } catch (err: any) {
      console.error("[Push] Unsubscribe error:", err);
      setError(err.message || "Failed to unsubscribe.");
      return false;
    }
  }, [unsubscribeMutation]);

  const sendTest = useCallback(async () => {
    setError(null);
    try {
      const result = await sendTestMutation.mutateAsync();
      return result.sent;
    } catch (err: any) {
      setError(err.message || "Failed to send test notification.");
      return 0;
    }
  }, [sendTestMutation]);

  return {
    status,
    error,
    subscribe,
    unsubscribe,
    sendTest,
    isLoading: subscribeMutation.isPending || unsubscribeMutation.isPending,
  };
}
