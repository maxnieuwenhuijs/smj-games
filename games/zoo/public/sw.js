// Maakt het spel te spelen zonder internet. De pagina zelf en de lijstjes (modellen, geluiden) komen
// eerst van het net, zodat een nieuwe versie meteen binnenkomt; lukt dat niet, dan uit de opslag.
// Al het andere (plaatjes, modellen, geluiden, code met een vingerafdruk in de naam) komt eerst uit de opslag.
const CACHE = 'zoo-v1';
const FRESH = /(\/|\.html|\.json|\.webmanifest)$/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const keep = res => {
    if (res.ok && res.status === 200) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => undefined);
    }
    return res;
  };
  if (FRESH.test(url.pathname)) {
    event.respondWith(fetch(req).then(keep).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || Response.error())));
  } else {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(keep)));
  }
});
