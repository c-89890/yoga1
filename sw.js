const APP_CACHE = "yoga-app-v3";
const CDN_CACHE = "yoga-cdn-v1";

const ASSETS = [
  "./", "./index.html", "./cast.html", "./manifest.json",
  "./src/main.js", "./src/pose.js", "./src/angles.js",
  "./src/smoothing.js", "./src/poses.js", "./src/scorer.js",
  "./src/overlay.js", "./src/cast.js", "./src/ble.js",
  "./src/speech.js", "./src/history.js", "./src/voice.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(APP_CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== APP_CACHE && k !== CDN_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  if (url.origin !== location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(CDN_CACHE);
      const hit = await cache.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    })());
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(APP_CACHE);
    const hit = await cache.match(e.request);
    const fetching = fetch(e.request)
      .then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; })
      .catch(() => null);
    return hit || (await fetching) || new Response("offline", { status: 503 });
  })());
});
