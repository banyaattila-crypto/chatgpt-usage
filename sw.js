// Minimalis SW: network-only, nincs cache. Csak azert van, hogy a regi cache-t ne szolgalja ki.
// Ha vissza kell a PWA/offline: irj egy rendes cache-bustingos verziot.
const CACHE = "claude-usage-v9-netonly";
self.addEventListener("install", event => { self.skipWaiting(); });
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", event => {
  // mindig halozatrol, cache nelkul
  event.respondWith(fetch(event.request).catch(() => new Response("Offline", { status: 503 })));
});
