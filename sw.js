/* HITFAT RUN CLUB · service worker (scope /)

   Network first for the app's own files, falling back to the last copy when
   offline, so a new deploy is picked up on the next open and an old one is
   never pinned (the Hybrid app learned that the hard way on iOS).
   Pinned CDN libraries are cache first: their URLs never change content.
   Photos are cache first in their own cache, filled as they are first shown.
   Supabase requests are never cached: data must be live or clearly absent. */
const VERSION = 'hfrun-v10', IMAGES = 'hfrun-img-v1';
// What the first screen and offline use need. Photos are not here: each is
// cached the first time it is shown (IMAGES), so installing stays small.
// Preview mode's files are left out: preview is a try-out, not an offline mode.
const SHELL = ['/', '/index.html', '/app.css', '/manifest.json',
  '/js/main.js', '/js/api.js', '/js/api-live.js', '/js/i18n.js', '/js/ui.js', '/js/stats.js', '/js/achievements.js', '/js/recommend.js', '/js/points.js', '/js/gps.js', '/js/voice.js', '/js/strength.js', '/js/share.js', '/js/weather.js', '/js/hydration.js',
  '/js/views/auth.js', '/js/views/onboarding.js', '/js/views/home.js', '/js/views/training.js', '/js/views/programs.js',
  '/js/views/workout.js', '/js/views/log.js', '/js/views/club.js', '/js/views/profile.js', '/js/views/run.js', '/js/views/strength.js', '/js/views/board.js', '/js/views/weather-card.js', '/js/views/hydration-card.js', '/js/views/sweat.js', '/js/views/points-card.js',
  '/icon-192.png', '/favicon-32.png', '/img/club-kelantan.webp'];
const PINNED = /^https:\/\/(cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.45\.4|cdnjs\.cloudflare\.com\/ajax\/libs\/leaflet\/1\.9\.4|fonts\.(googleapis|gstatic)\.com)\//;

self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('hfrun-') && k !== VERSION && k !== IMAGES).map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (PINNED.test(req.url)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })));
    return;
  }
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/img/')) {
    // a replaced photo needs a new file name or a new IMAGES version, or phones keep the old one
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(IMAGES).then(c => c.put(req, copy)); } return res; })));
    return;
  }
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('/index.html') : Response.error()))));
});
