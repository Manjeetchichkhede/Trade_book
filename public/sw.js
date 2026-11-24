const CACHE_NAME = 'tradebook-v2.5.0';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
];

function isDevModuleRequest(url) {
  const path = url.pathname;
  return (
    path.startsWith('/node_modules/') ||
    path.startsWith('/src/') ||
    path.startsWith('/@vite') ||
    path.startsWith('/@fs/') ||
    path.startsWith('/@id/') ||
    path.startsWith('/@react-refresh') ||
    url.searchParams.has('v') ||
    url.searchParams.has('t')
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Never cache Vite dev server modules, live market data feeds, or Google API / Firebase Auth requests
  if (
    isDevModuleRequest(url) ||
    url.pathname.startsWith('/__/auth/') ||
    url.hostname.includes('binance.com') ||
    url.hostname.includes('kraken.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('google.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('firebaseio.com') ||
    (url.hostname.includes('gstatic.com') === false &&
      url.origin !== self.location.origin &&
      !url.hostname.includes('fonts.googleapis.com'))
  ) {
    return;
  }

  // Navigation requests: network-first, fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Production static assets & Google Fonts: cache-first with background refresh
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && (response.ok || response.type === 'opaque')) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
