/// <reference lib="webworker" />
/* sw.js — Service Worker PWA-приложения «Давай играй».
 * Директива выше подключает типы Service Worker (waitUntil/respondWith/
 * clients/skipWaiting) — их нет в стандартной lib.dom, иначе VS Code/TS
 * показывали бы ложные ошибки на каждом событии воркера.
 *
 * Стратегия:
 *  - УСТАНОВКА: предкэшируем ВСЕ скрипты, перечисленные в index.html
 *    (cards/*.js с их версионным ?v=…), плюс ядро (index.html,
 *    манифест, иконки). Список собирается автоматически из index.html, поэтому
 *    при добавлении новой игры файл sw.js править не нужно. Огромные папки
 *    фото (photos_poses/photos_shop) намеренно НЕ качаем заранее — они
 *    подтягиваются по мере использования (см. fetch-обработчик).
 *  - FETCH:
 *      * навигация (открытие index.html) — network-first: всегда качаем свежую
 *        версию и кладём её в кэш; офлайн — отдаём из кэша.
 *      * стили (styles/*) и игры (games/*) — network-first: свежие сразу
 *      * остальные GET своего origin — stale-while-revalidate: сначала кэш
 *        (мгновенно), параллельно тянем сетевую версию и обновляем кэш.
 *  - Активация: удаляем кэши старых версий и вычищаем устаревшие записи
 *    games/cards/* старых ?v=… версий (смена версии в index.html добавляет в
 *    тот же кэш новые URL вместо перезаписи — без очистки кэш пух бы бесконечно).
 *
 * Создано для статического хостинга (https). При http/file:// воркер
 * регистрироваться не будет — это ограничение самого сервис-воркера.
 */
const CACHE_NAME = 'veselye-igry-cache-v199';

// Ссылка на контекст воркера. Из-за lib.dom глобальный `self` в JS-файле
// типизируется как Window, где нет skipWaiting()/clients. Кэстим через any,
// чтобы VS Code/TS не ругались (в рантайме self === глобальный воркер-контекст).
/** @type {any} */
const ctx = (self);

// Ключевые файлы, нужные сразу при первом открытии (вне index.html).
const PRECACHE_URLS = [
  './index.html',
  './styles/app.css',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

// Собирает полный список предкэшируемых ресурсов: базовый набор + все
// cards/*.js, на которые ссылается текущий index.html (с их версией ?v=…).
// games/*.js и styles/*.css НЕ кэшируются вперёд — грузятся из сети (network-first).
async function collectAssetUrls() {
  const urls = new Set(PRECACHE_URLS);
  try {
    const res = await fetch('./index.html');
    const html = await res.text();
    // Берём любой src/href и оставляем только наши скрипты (games/*, cards/*).
    // Иконки уже лежат в PRECACHE_URLS, отдельно тянуть их из разметки не нужно.
    // Обычный RegExp.exec в цикле вместо String.matchAll — сборка/линтер без
    // es2020 не ругается, а поведение одинаковое.
const re = /(?:src|href)="([^"]+)"/g;
     let m;
     while ((m = re.exec(html)) !== null) {
       const raw = m[1];
       try {
         const u = new URL(raw, self.location.href);
         if (/^\/(?:cards)\//.test(u.pathname)) {
           urls.add('./' + raw);
         }
       } catch (e) { /* пропускаем некорректные/внешние ссылки */ }
     }
  } catch (e) { /* ок — используем базовый набор */ }
  return urls;
}

// Нормализует URL к виду "path + search" для сравнения с Expected-списком.
function normUrl(urlStr) {
  try { const u = new URL(urlStr, self.location.href); return u.pathname + u.search; }
  catch (e) { return String(urlStr); }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const urls = await collectAssetUrls();
    const cache = await caches.open(CACHE_NAME);
    // Каждый элемент кэшируем независимо: если какой-то файл не
    // загрузится, установка не провалится целиком (cache.addAll обрушил бы
    // весь install при одной ошибке).
    await Promise.all(
      [...urls].map((u) => cache.add(u).catch(() => {}))
    );
    await ctx.skipWaiting();
  })().catch(() => ctx.skipWaiting()));
});

self.addEventListener('activate', (event) => {
   event.waitUntil((async () => {
     // Удаляем ВСЕ кэши без исключений
     const cacheNames = await caches.keys();
     for (const name of cacheNames) {
       await caches.delete(name);
     }
     // Очищаем устаревшие записи games/*, cards/*
     const expected = await collectAssetUrls();
     const expectedNorms = new Set([...expected].map(normUrl));
     const cache = await caches.open(CACHE_NAME);
     const reqs = await cache.keys();
     await Promise.all(reqs.map((req) => {
       const p = normUrl(req.url);
       if (/^\/(?:games|cards)\//.test(p) && !expectedNorms.has(p)) {
         return cache.delete(req);
       }
       return null;
     }));
     await ctx.clients.claim();
   })().catch(() => {}));
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

    // sw.js — всегда из сети, чтобы обновления применялись мгновенно.
    if (url.pathname.endsWith('sw.js')) {
      event.respondWith(fetch(request));
      return;
    }

    // Стили и игровые скрипты — всегда network-first.
    // CSS вынесен из index.html в styles/app.css: при stale-while-revalidate
    // (как у картинок) устройство сначала отдавало бы СТАРЫЙ стиль, и правки
    // внешнего вида «не применялись» до второй перезагрузки.
    if (url.pathname.startsWith('/games/') || url.pathname.startsWith('/styles/')) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => caches.match(request))
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