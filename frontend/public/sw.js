/* Alpha-Stream Service Worker — handles push notifications */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Alpha-Stream Signal', body: event.data.text() };
  }

  const title = data.title || 'Alpha-Stream Signal';
  const options = {
    body: data.body || 'A new +EV signal has been detected.',
    icon: data.icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || 'alphastream-signal',
    data: { url: data.url || '/dashboard' },
    actions: [
      { action: 'view', title: 'View Signal' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/dashboard';
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
});
