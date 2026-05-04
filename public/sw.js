// VASCULAR AI + MAVI — Service Worker v5.0
const CACHE = 'vascular-ai-v5';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/arm-neutral.png',
  '/assets/arm-pronation.png',
  '/assets/arm-supination.png',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Peticiones a la API Netlify siempre van a la red
  if (e.request.url.includes('/api/') || e.request.url.includes('/.netlify/')) {
    return e.respondWith(fetch(e.request));
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    })).catch(() => caches.match('/index.html'))
  );
});
