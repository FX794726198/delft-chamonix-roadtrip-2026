const STATIC_CACHE = "chamonix-roadtrip-single-v3";
const TILE_CACHE = "roadtrip-map-tiles-v1";
const STATIC_ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => ![STATIC_CACHE, TILE_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function trimTiles(maxItems) {
  const cache = await caches.open(TILE_CACHE);
  const keys = await cache.keys();
  while (keys.length > maxItems) await cache.delete(keys.shift());
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isMapTile = url.hostname.endsWith("arcgisonline.com") || url.hostname.endsWith("openstreetmap.org") || url.hostname.endsWith("opentopomap.org");

  if (isMapTile) {
    event.respondWith(caches.open(TILE_CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      try {
        const response = await fetch(event.request);
        cache.put(event.request, response.clone());
        trimTiles(180);
        return response;
      } catch (error) {
        return new Response("", {status: 503, statusText: "Offline tile unavailable"});
      }
    }));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("./index.html")));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
  }
});
