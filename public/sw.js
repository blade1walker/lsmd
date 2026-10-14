// Bumping the name deletes every older cache on activate. v1 stored every GET
// response, including /api/auth/* sign-in callbacks and signed-in pages.
const CACHE_NAME = "ems-roster-v2";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Left entirely to the browser: other sites, and every API route. Sign-in
  // (/api/auth/*) in particular must reach the server untouched — the OAuth
  // callback is a redirect that sets the session cookie, and a cached
  // /api/auth/session would show a signed-out (or someone else's) session.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Build assets are content-hashed and never change, so a cached copy is
  // always correct.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Pages always come from the network — they depend on who is signed in, so
  // they are never cached. The offline page is shown only when there is no
  // connection at all.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});
