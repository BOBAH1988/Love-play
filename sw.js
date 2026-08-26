/* sw.js — Service Worker PWA-приложения «Весёлые игры».
 *
 * Стратегия:
 *  - УСТАНОВКА: предкэшируем только "ядро" (index.html, манифест, иконки,
 *    базовые скрипты). Огромные папки фото и карт намеренно НЕ качаем заранее —
 *    они подтягиваются по мере использования (см. fetch-обработчик).
 *  - FETCH:
 *      * навигация (открытие index.html) — network-first: всегда качаем свежую
 *        версию и кладём её в кэш; офлайн — отдаём из кэша.
 *      * остальные GET своего origin — stale-while-revalidate: сначала кэш
 *        (мгновенно), параллельно тянем сетевую версию и обновляем кэш.
 *  - Активация: чистим кэши старых версий.
 *
 * Создано для статического хостинга (https). На http/file:// воркер
 * регистрироваться не будет — это ограничение самого сервис-воркера.
 */
const CACHE_NAME = 'veselye-igry-cache-v1';

// Ключевые файлы, нужные сразу при первом открытии.
const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './games/core.js',
  './games/init.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Работаем только с GET-запросами того же origin.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Навигация (открытие страницы) — network-first.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) =>
            cached || caches.match('./index.html')
          )
        )
    );
    return;
  }

  // Остальные ресурсы — stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});