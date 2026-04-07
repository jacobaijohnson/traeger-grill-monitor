// Traeger Smoker Insight - Service Worker
// Handles background notifications, offline caching, and persistent alarm audio

const CACHE_NAME = 'smoker-insight-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

// Install: cache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first with cache fallback for navigation
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ─── Push Notification Handler ─────────────────────────

self.addEventListener('push', (event) => {
  let data = { title: 'Smoker Insight', body: 'Alert from your grill' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const isAlarm = !!data.alarm;

  const options = {
    body: data.body,
    icon: '/pwa-icon-192.png',
    badge: '/pwa-icon-192.png',
    vibrate: isAlarm
      ? [500, 200, 500, 200, 500, 200, 500, 200, 500] // Long aggressive vibration
      : [200, 100, 200],
    tag: data.tag || 'grill-alert',
    renotify: isAlarm, // Re-alert on same tag (for escalation re-pushes)
    requireInteraction: isAlarm, // Alarms stay until dismissed
    silent: false,
    data: {
      url: data.url || '/live-cook',
      alarm: isAlarm,
      alarmKey: data.tag || 'grill-alert',
      timestamp: Date.now(),
    },
    actions: isAlarm
      ? [
          { action: 'dismiss', title: 'Dismiss Alarm' },
          { action: 'view', title: 'View Cook' },
        ]
      : [{ action: 'view', title: 'View Cook' }],
  };

  // Show the notification
  const showPromise = self.registration.showNotification(data.title, options);

  // If this is an alarm, tell all open client windows to start the audio alarm
  if (isAlarm) {
    const clientPromise = self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          client.postMessage({
            type: 'ALARM_START',
            alarmKey: data.tag || 'grill-alert',
            title: data.title,
            body: data.body,
          });
        }
      });
    event.waitUntil(Promise.all([showPromise, clientPromise]));
  } else {
    event.waitUntil(showPromise);
  }
});

// ─── Notification Click Handler ────────────────────────

self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  const notification = event.notification;
  const isAlarm = notification.data?.alarm;
  const alarmKey = notification.data?.alarmKey;
  const url = notification.data?.url || '/live-cook';

  notification.close();

  if (isAlarm) {
    // Tell all client windows to stop the audio alarm
    const stopAlarmPromise = self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          client.postMessage({
            type: 'ALARM_STOP',
            alarmKey: alarmKey,
          });
        }
      });

    // Dismiss the alarm on the server (stops escalation)
    const dismissPromise = fetch('/api/trpc/push.dismissAlarm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ json: { alarmKey: alarmKey } }),
    }).catch(() => {});

    if (action === 'dismiss') {
      // Just dismiss, don't navigate
      event.waitUntil(Promise.all([stopAlarmPromise, dismissPromise]));
    } else {
      // View: dismiss + navigate
      event.waitUntil(
        Promise.all([stopAlarmPromise, dismissPromise]).then(() =>
          self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
              if (client.url.includes(self.location.origin) && 'focus' in client) {
                client.navigate(url);
                return client.focus();
              }
            }
            return self.clients.openWindow(url);
          })
        )
      );
    }
  } else {
    // Non-alarm: just navigate
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
    );
  }
});

// ─── Notification Close Handler ────────────────────────

self.addEventListener('notificationclose', (event) => {
  const isAlarm = event.notification.data?.alarm;
  const alarmKey = event.notification.data?.alarmKey;

  if (isAlarm && alarmKey) {
    // Stop client-side audio
    const stopPromise = self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          client.postMessage({
            type: 'ALARM_STOP',
            alarmKey: alarmKey,
          });
        }
      });

    // Dismiss on server (stops escalation re-pushes)
    const dismissPromise = fetch('/api/trpc/push.dismissAlarm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ json: { alarmKey: alarmKey } }),
    }).catch(() => {});

    event.waitUntil(Promise.all([stopPromise, dismissPromise]));
  }
});

// ─── Message Handler (from app) ────────────────────────

self.addEventListener('message', (event) => {
  if (!event.data) return;

  switch (event.data.type) {
    case 'SHOW_NOTIFICATION': {
      const { title, options } = event.data;
      event.waitUntil(self.registration.showNotification(title, options));
      break;
    }
    case 'SKIP_WAITING': {
      self.skipWaiting();
      break;
    }
  }
});
