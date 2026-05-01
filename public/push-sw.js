// MyCampus push service worker.
// Handles incoming Web Push events and click-through navigation.
// Intentionally minimal — no caching, no offline shell, to avoid stale
// content in the Lovable preview iframe.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: "MyCampus", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "MyCampus";
  const options = {
    body: data.body || "",
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    data: {
      url: data.url || "/notifications",
      type: data.type || "general",
      related_id: data.related_id || null,
    },
    vibrate: [80, 40, 80],
    tag: data.type || "general",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        } catch (_) {}
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});
