const APP_CACHE = 'packraft-app-v2';
const TILE_CACHE = 'packraft-tiles-v2';
const DATA_CACHE = 'packraft-data-v2';
const APP_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon.svg',
  './js/map.js',
  './js/elevation.js',
  './js/weather.js',
  './js/gear.js',
  './js/safety.js',
  './js/storage.js',
  './js/ui.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(APP_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => ![APP_CACHE, TILE_CACHE, DATA_CACHE].includes(k)).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const isTile = /tile|wmts|openstreetmap|kartverket/.test(url.href);
  const isYr = url.hostname.includes('api.met.no');

  if (isTile) {
    event.respondWith(staleWhileRevalidate(req, TILE_CACHE));
    return;
  }

  if (isYr) {
    event.respondWith(networkFirst(req, DATA_CACHE));
    return;
  }

  event.respondWith(cacheFirst(req, APP_CACHE));
});

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const resp = await fetch(req);
  const cache = await caches.open(cacheName);
  cache.put(req, resp.clone());
  return resp;
}

async function networkFirst(req, cacheName) {
  try {
    const resp = await fetch(req);
    const cache = await caches.open(cacheName);
    cache.put(req, resp.clone());
    return resp;
  } catch {
    return caches.match(req);
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req).then((resp) => {
    cache.put(req, resp.clone());
    return resp;
  }).catch(() => cached);
  return cached || network;
}
