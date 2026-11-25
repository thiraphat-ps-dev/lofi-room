// Service worker: lets Lofi Room open offline (scenes, rain and timer all run in the page;
// only the YouTube stations need the network) and makes it installable.
//
// Our own files: network first, so a new deploy shows up on the next load, with the cache
// as the fallback when offline. Google Fonts: cache first, since those files never change.
// Everything else (YouTube) goes straight to the network.

const CACHE = 'lofi-room-v12';
const SHELL = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'i18n.js',
  'ambience.js',
  'manifest.webmanifest',
  'fonts/ThiraSans-VF.woff2',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  ...['engine', 'kit', 'animals', 'room', 'sea', 'snow', 'city', 'camp', 'market', 'cafe'].map((n) => `scenes/${n}.js`),
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) e.respondWith(networkFirst(req));
  else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') e.respondWith(cacheFirst(req));
});
