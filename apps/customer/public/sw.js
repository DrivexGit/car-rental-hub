// App-shell cache: network first for pages/API, cache first for static assets.
const CACHE = "drivex-v2";
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/logo.png"]))); });
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin || req.url.includes("/api/")) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/")));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res;
  })));
});

// Web push: show the notification (also when the app is closed) and open its link when tapped.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : "" }; } // a plain-text push still shows
  // links are paths, so a tap opens this app on the domain it was installed from
  const url = new URL(d.url || "/", self.location.origin).href;
  e.waitUntil(self.registration.showNotification(d.title || "Drivex", {
    body: d.body || "", icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: d.tag, renotify: !!d.tag, data: { url },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (ws) => {
    const w = ws.find((c) => c.url.startsWith(self.location.origin));
    if (!w) return self.clients.openWindow(url);
    await w.focus();
    return w.navigate(url).catch(() => self.clients.openWindow(url)); // navigate() only works on a page this worker controls
  }));
});
