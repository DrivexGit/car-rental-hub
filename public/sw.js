// Panel service worker: web push only (no caching).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.title || 'CarBox', {
    body: d.body || '', icon: '/favicon.png', tag: d.tag, requireInteraction: d.tag === 'urgent' || d.tag === 'booking_new', data: { url: d.url || '/' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
    const w = ws.find((c) => c.url.startsWith(self.location.origin));
    return w ? w.navigate(url).then((c) => c && c.focus()) : self.clients.openWindow(url);
  }));
});
