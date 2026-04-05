// Traeger Smoker Insight - Service Worker
// Handles background notifications and offline caching

const CACHE_NAME = 'smoker-insight-v1';
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
  // Skip non-GET and API requests
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Handle push notifications from server
self.addEventListener('push', (event) => {
  let data = { title: 'Smoker Insight', body: 'Alert from your grill' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/pwa-icon-192.png',
    badge: '/pwa-icon-192.png',
    vibrate: data.alarm ? [500, 200, 500, 200, 500] : [200, 100, 200],
    tag: data.tag || 'grill-alert',
    renotify: !!data.alarm,
    requireInteraction: !!data.alarm, // Alarms stay until dismissed
    data: {
      url: data.url || '/live-cook',
      alarm: !!data.alarm,
    },
    actions: data.alarm
      ? [
          { action: 'dismiss', title: 'Dismiss Alarm' },
          { action: 'view', title: 'View Cook' },
        ]
      : [{ action: 'view', title: 'View Cook' }],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/live-cook';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window if available
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow(url);
    })
  );
});

// Handle notification close (for alarm tracking)
self.addEventListener('notificationclose', (event) => {
  if (event.notification.data?.alarm) {
    // Report alarm dismissal to server
    fetch('/api/trpc/liveCook.dismissAlert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId: event.notification.tag }),
    }).catch(() => {});
  }
});
