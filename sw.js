
const CACHE_NAME = 'skripsilab-v5.3';

// Daftar URL statis yang PASTI ada (seperti di folder public)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/logo.svg',
  '/logo.ico',
  '/manifest.json'
];

// Install Event: Cache Core Assets
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_URLS);
      })
  );
});

// Activate Event: Cleanup Old Caches
self.addEventListener('activate', (event) => {
  self.clients.claim(); // Control all open tabs immediately
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch Event: Dynamic Caching Strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Ignore Non-GET requests and Cross-Origin requests that aren't critical
  if (event.request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // 2. Network First for HTML (Navigation) -> ensuring fresh content
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
        .catch(() => {
          return caches.match(event.request).then((response) => {
            return response || caches.match('/index.html'); // Fallback to SPA root
          });
        })
    );
    return;
  }

  // 3. Stale-While-Revalidate for Assets (JS, CSS, Images, Fonts)
  // This is crucial for Vite builds where filenames change (e.g., assets/index-hash.js)
  // We serve the cached version immediately (fast), but update the cache in background.
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2?|ttf|eot)$/) ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('cdn.tailwindcss.com') || 
    url.hostname.includes('imgur.com')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            // Only cache valid responses
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
             // Network failed, nothing to do, just hope we have cache
          });

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // 4. Default: Network Only
  // event.respondWith(fetch(event.request));
});
