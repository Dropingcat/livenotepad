// Service worker «Живого блокнота»: app shell в кэше, network-first.
// Все пути относительные: приложение живёт в подкаталоге (/livenotepad/ на Pages).
const CACHE_PREFIX = 'livenotepad-';
const CACHE = CACHE_PREFIX + 'v4';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './js/constants.js',
  './js/time.js',
  './js/stopwords.js',
  './js/distance.js',
  './js/stemmer.js',
  './js/classifier.js',
  './js/due-parser.js',
  './js/due-state.js',
  './js/live-sheet.js',
  './js/branches.js',
  './js/sheets.js',
  './js/note-edit.js',
  './js/gestures.js',
  './js/dedup.js',
  './js/entities.js',
  './js/import.js',
  './js/export-format.js',
  './js/idb.js',
  './js/audit.js',
  './js/action-log.js',
  './js/backup.js',
  './js/add-queue.js',
  './js/capacitor.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        // caches общие для всего origin (dropingcat.github.io);
        // чистим только свои кэши, чужие проекты не трогаем.
        keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  const isNavigation = request.mode === 'navigate';

  event.respondWith(
    fetch(request)
      .then(response => {
        // Успешный ответ кладём в кэш; навигацию — под ключом app shell.
        if (response && response.ok) {
          const copy = response.clone();
          const cacheKey = isNavigation ? './index.html' : request;
          caches.open(CACHE)
            .then(cache => cache.put(cacheKey, copy))
            .catch(() => {});
        }
        return response;
      })
      .catch(() => (
        isNavigation
          ? caches.match('./index.html')
          : caches.match(request)
      ))
  );
});
