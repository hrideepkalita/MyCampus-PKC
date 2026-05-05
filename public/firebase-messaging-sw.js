// Firebase messaging service worker for background push notifications
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDDYBiZbATRtNs-LXWYrW6Gc3SczBk7SAQ",
  authDomain: "mycampus-48b3e.firebaseapp.com",
  projectId: "mycampus-48b3e",
  storageBucket: "mycampus-48b3e.firebasestorage.app",
  messagingSenderId: "986139018819",
  appId: "1:986139018819:web:9840a821d5586bb52176f6",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-sw] Background message:", payload);

  const data = payload.data || {};
  const notification = payload.notification || {};

  const title = notification.title || data.title || "MyCampus";
  const options = {
    body: notification.body || data.body || "",
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

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/notifications";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
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
      })
  );
});
