// Service Worker for BetterChoice AI PWA
//
// Caching strategy
// ----------------
// The previous v1 SW used cache-first for everything, including the HTML shell
// `/`. After every redeploy, the cached `index.html` kept pointing at the old
// hashed bundle (e.g. `main.68ec4caa.js`) which no longer exists on the server,
// so users got a blank page with a 404 on `/static/js/main.<hash>.js`.
//
// v2 fixes that:
//   • HTML / navigation requests → network-first (fall back to cache only when
//     offline). The shell is never served stale after a deploy.
//   • Hashed CRA build assets under `/static/*` → cache-first with cache write.
//     These are content-addressed (`main.<hash>.js`), so they're safe to cache
//     forever and the URL itself changes on every new build.
//   • Everything else (API calls, OAuth, third-party) → pass through to the
//     network untouched.
//
// Bumping CACHE_NAME forces the activate handler to delete the v1 cache that
// still contains the stale shell on existing clients.
const CACHE_NAME = 'betterchoice-ai-v2';
const STATIC_CACHE = 'betterchoice-static-v2';

// Pre-cache only static, non-versioning-sensitive assets. Do NOT precache `/`
// or `index.html` — they must always come from the network so users pick up
// the new bundle hash after a deploy.
const PRECACHE_URLS = [
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  '/image.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`SW: failed to precache ${url}`, err);
            return null;
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n !== CACHE_NAME && n !== STATIC_CACHE)
          .map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/static/') ||
    /\.(?:js|css|woff2?|ttf|otf|eot|png|jpg|jpeg|gif|svg|webp|ico)$/i.test(
      url.pathname
    )
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (
    url.pathname === '/service-worker.js' ||
    url.pathname === '/manifest.json'
  ) {
    return;
  }

  // Navigation / HTML → network-first. This is the critical fix: the shell is
  // never served from cache while online, so a fresh `index.html` (with the
  // current bundle hash) is always loaded. Cache only as an offline fallback.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.ok) {
            const copy = fresh.clone();
            caches.open(CACHE_NAME).then((c) => c.put('/', copy)).catch(() => {});
          }
          return fresh;
        } catch (_) {
          const cached = await caches.match('/');
          if (cached) return cached;
          return new Response('Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        }
      })()
    );
    return;
  }

  // Hashed static assets → cache-first. Safe because the URL itself changes
  // when the build changes (e.g. main.<hash>.js).
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.status === 200 && fresh.type === 'basic') {
            const copy = fresh.clone();
            caches
              .open(STATIC_CACHE)
              .then((c) => c.put(request, copy))
              .catch(() => {});
          }
          return fresh;
        } catch (_) {
          return new Response('', { status: 504 });
        }
      })()
    );
    return;
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'BetterChoice AI';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [200, 100, 200],
    data: data,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
