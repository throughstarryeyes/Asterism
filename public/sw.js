// keeps the app and its fonts so it opens with no connection. writing is not here: it lives in the browser's own storage.
const VERSION = 'asterism-v1';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

const fromCacheThenUpdate = async req => {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const update = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; });
  if (hit) { update.catch(() => undefined); return hit; }
  return update;
};

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (FONT_HOSTS.includes(url.hostname)) { e.respondWith(fromCacheThenUpdate(req)); return; }
  if (url.origin !== self.location.origin) return;
  // the page itself: the newest when online, the last one seen when not
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put('./', res.clone());
        return res;
      } catch {
        return (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }
  // built files have the hash in their name, sounds and icons rarely change
  e.respondWith(fromCacheThenUpdate(req));
});
