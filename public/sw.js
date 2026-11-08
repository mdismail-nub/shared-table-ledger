// Mess Manager Service Worker — Offline-First PWA
const CACHE_VERSION = "mess-manager-v1";
const CACHE_STATIC = `static-${CACHE_VERSION}`;
const CACHE_DYNAMIC = `dynamic-${CACHE_VERSION}`;
const CACHE_FONTS = `fonts-${CACHE_VERSION}`;

const STATIC_PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/manifest.json",
  "/favicon.png",
  "/logo.png",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
  "/pwa-maskable-192x192.png",
  "/pwa-maskable-512x512.png",
  "/apple-touch-icon.png",
];

// Install: Pre-cache static shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_STATIC)
      .then((cache) => {
        return cache.addAll(STATIC_PRECACHE);
      })
      .then(() => self.skipWaiting()),
  );
});

// Activate: Clean up old cache versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((k) => k !== CACHE_STATIC && k !== CACHE_DYNAMIC && k !== CACHE_FONTS)
            .map((k) => caches.delete(k)),
        );
      })
      .then(() => self.clients.claim()),
  );
});

// Fetch: Strategy-based resource serving
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests (handled by client IndexedDB queue)
  if (request.method !== "GET") return;

  // 1. Google Fonts: Cache-First
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.open(CACHE_FONTS).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          return cached || new Response("", { status: 408 });
        }
      }),
    );
    return;
  }

  // 2. Navigation requests (HTML pages): Network-First with Cache fallback
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          // Try network with a 2.5s timeout for fast response
          const networkPromise = fetch(request);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Navigation timeout")), 2500),
          );

          const response = await Promise.race([networkPromise, timeoutPromise]);
          if (response && response.ok) {
            const cache = await caches.open(CACHE_DYNAMIC);
            cache.put(request, response.clone());
            return response;
          }
          throw new Error("Network response not ok");
        } catch {
          // Offline fallback: check exact URL cache first, then fallback to root shell
          const cachedMatch = await caches.match(request);
          if (cachedMatch) return cachedMatch;

          const rootFallback = await caches.match("/");
          if (rootFallback) return rootFallback;

          return new Response(
            `<!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <title>Mess Manager (Offline)</title>
              <style>
                body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #faf8fd; color: #1e1b4b; text-align: center; padding: 1.5rem; }
                .card { background: #fff; padding: 2rem; border-radius: 1.5rem; box-shadow: 0 4px 20px rgba(0,0,0,0.06); max-width: 400px; width: 100%; border: 1px solid #e9d5ff; }
                h1 { margin-top: 0; color: #7c3aed; font-size: 1.5rem; font-weight: 800; }
                p { color: #64748b; font-size: 0.95rem; line-height: 1.5; }
                button { background: #7c3aed; color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight: 600; cursor: pointer; margin-top: 1rem; width: 100%; font-size: 1rem; }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>Mess Manager is Offline</h1>
                <p>You are currently offline. Check your connection or tap below to retry loading your table ledger.</p>
                <button onclick="window.location.reload()">Retry Connection</button>
              </div>
            </body>
            </html>`,
            {
              headers: { "Content-Type": "text/html; charset=utf-8" },
              status: 200,
            },
          );
        }
      })(),
    );
    return;
  }

  // 3. Static application assets (JS, CSS, static images): Stale-While-Revalidate
  const isStaticAsset =
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/assets/") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".jpg") ||
      url.pathname.endsWith(".svg") ||
      url.pathname.endsWith(".webp") ||
      url.pathname.endsWith(".webmanifest") ||
      url.pathname.endsWith(".json"));

  if (isStaticAsset) {
    event.respondWith(
      caches.open(CACHE_STATIC).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => null);

        // Return cached immediately if found, otherwise await network
        return cached || fetchPromise || new Response("", { status: 408 });
      }),
    );
    return;
  }
});

// Background Sync Event (when connection is regained in background)
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-mess-data") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "BACKGROUND_SYNC_TRIGGER" });
        });
      }),
    );
  }
});

// Messages from clients (e.g. Skip Waiting, Version Check)
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data.type === "CHECK_VERSION") {
    event.ports[0]?.postMessage({ version: CACHE_VERSION });
  }
});
