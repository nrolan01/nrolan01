const CACHE = 'hr-log-v2';
const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/airtable.js',
  './js/schema.js',
  './js/themes.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache Airtable API calls — always go to network.
  if (url.hostname.includes('airtable.com')) return;

  // Network-first: while iterating on this app, "online" should always mean
  // "latest deployed version." The cache exists only as an offline fallback,
  // not as the default source — a stale-cache-first strategy here was making
  // every deploy require a full app relaunch before it became visible.
  event.respondWith(
    fetch(event.request).then((res) => {
      if (event.request.method === 'GET' && res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, clone));
      }
      return res;
    }).catch(() => caches.match(event.request))
  );
});
