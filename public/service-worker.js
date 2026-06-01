// Service Worker for BetterChoice AI PWA
const CACHE_NAME = 'betterchoice-ai-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  '/image.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cache opened');
        // Try to cache resources, but don't fail if some are missing
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(err => {
              console.warn(`Service Worker: Failed to cache ${url}`, err);
              return null;
            })
          )
        );
      })
      .catch((error) => {
        console.error('Service Worker: Cache failed', error);
      })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all pages immediately
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip service worker and manifest requests to prevent loops
  if (event.request.url.includes('service-worker.js') ||
      event.request.url.includes('manifest.json')) {
    return;
  }

  // Never intercept non-GET requests (POST/PUT/DELETE/etc.) — they must reach
  // the network directly, otherwise the SW can swallow them and produce
  // "Failed to convert value to 'Response'" errors.
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }

        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseToCache = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(err => {
              console.warn('Service Worker: Failed to cache response', err);
            });
          });

          return response;
        }).catch(async () => {
          // Network failed. For navigation requests, fall back to the cached
          // shell. For all other GETs, return a synthetic 504 so the browser
          // never sees `undefined` from respondWith().
          if (event.request.mode === 'navigate') {
            const cached = await caches.match('/');
            if (cached) return cached;
            return new Response('Offline', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            });
          }
          return new Response('', {
            status: 504,
            statusText: 'Gateway Timeout (offline)',
          });
        });
      })
      .catch(() => {
        // Last-resort guard so respondWith() always gets a Response.
        return new Response('', { status: 504 });
      })
  );
});

// Handle push notifications (optional - for future use)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'BetterChoice AI';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [200, 100, 200],
    data: data
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});

