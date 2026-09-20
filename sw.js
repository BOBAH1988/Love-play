/// <reference lib="webworker" />
/* sw.js — Service Worker PWA-приложения «Давай играй».
 * Директива выше подключает типы Service Worker (waitUntil/respondWith/
 * clients/skipWaiting) — их нет в стандартной lib.dom, иначе VS Code/TS
 * показывали бы ложные ошибки на каждом событии воркера.
 *
 * Стратегия:
 *  - УСТАНОВКА: предкэшируем ВСЕ локальные скрипты и стили из index.html
 *    (cards/*.js, games/*.js, styles/*.css с их версионным ?v=…), плюс ядро
 *    (index.html, манифест, иконки). Список собирается автоматически из
 *    index.html, поэтому при добавлении новой игры файл sw.js править не нужно.
 *    Огромные папки фото (photos_poses/photos_shop) намеренно НЕ качаем
 *    заранее — они подтягиваются по мере использования (см. fetch-обработчик).
 *    Раньше games/* и styles/* не предкэшировались: после обновления воркера
 *    активация вычищала старый кэш, и при запуске без интернета скрипты
 *    игр не находились в кэше — приложение показывало белый экран.
 *  - FETCH:
 *      * навигация (открытие index.html) — network-first: всегда качаем свежую
 *        версию и кладём её в кэш; офлайн — отдаём из кэша; если кэша нет
 *        вовсе — офлайн-заглушку вместо пустого белого экрана.
 *      * стили (styles/*) и игры (games/*) — network-first: свежие сразу,
 *        офлайн — из кэша (он теперь всегда полный после установки).
 *      * остальные GET своего origin — stale-while-revalidate: сначала кэш
 *        (мгновенно), параллельно тянем сетевую версию и обновляем кэш.
 *  - Активация: удаляем только кэши СТАРЫХ версий (текущий CACHE_NAME не
 *    трогаем) и вычищаем устаревшие записи games/cards/styles старых ?v=…
 *    версий (смена версии в index.html добавляет в тот же кэш новые URL
 *    вместо перезаписи — без очистки кэш пух бы бесконечно).
 *
 * Создано для статического хостинга (https). При http/file:// воркер
 * регистрироваться не будет — это ограничение самого сервис-воркера.
 */
const CACHE_NAME = 'veselye-igry-cache-v414';

// Корень приложения относительно адреса воркера: sw.js лежит в корне, поэтому
// './' относительно его адреса — это корень и в деплое в корень домена ('/'),
// и в подпапку GitHub Pages ('/Love-play/'). Прямые проверки pathname на
// '/games/' в подпапке не срабатывали — ветки кэша молча отключались.
const ROOT = new URL('./', self.location.href).pathname;

// Ссылка на контекст воркера. Из-за lib.dom глобальный `self` в JS-файле
// типизируется как Window, где нет skipWaiting()/clients. Кэстим через any,
// чтобы VS Code/TS не ругались (в рантайме self === глобальный воркер-контекст).
/** @type {any} */
const ctx = (self);

const FLAG_CODES = [
  'ru', 'fr', 'jp', 'us', 'de', 'gb', 'it', 'cn', 'kr', 'br',
  'in', 'mx', 'pl', 'se', 'no', 'fi', 'nl', 'be', 'ie', 'pt',
  'az', 'pe', 'td', 'ne', 'kw', 'sy', 'mm', 'cf', 'sl', 'tg',
  'es', 'au', 'ca', 'kz', 'am', 'ge', 'uz', 'kg', 'tj', 'li',
  'sm', 'mc', 'st'
];

// Ключевые файлы, нужные сразу при первом открытии (вне index.html).
const PRECACHE_URLS = [
  './index.html',
  './styles/app.css',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  ...FLAG_CODES.map(code => `./flags-svg/flag-${code}.svg`)
];

// Собирает полный список предкэшируемых ресурсов: базовый набор + все
// cards/*.js, games/*.js и styles/*.css, на которые ссылается текущий
// index.html (с их версией ?v=…). Без полного предкэша запуск без интернета
// после обновления воркера оставлял приложение без скриптов — белый экран.
async function collectAssetUrls() {
  const urls = new Set(PRECACHE_URLS);
  try {
    const res = await fetch('./index.html');
    const html = await res.text();
    // Берём любой src/href и оставляем только наши файлы (games/*, cards/*,
    // styles/*). Иконки уже лежат в PRECACHE_URLS, отдельно тянуть их из
    // разметки не нужно.
    // Обычный RegExp.exec в цикле вместо String.matchAll — сборка/линтер без
    // es2020 не ругается, а поведение одинаковое.
const re = /(?:src|href)="([^"]+)"/g;
     let m;
     while ((m = re.exec(html)) !== null) {
       const raw = m[1];
       try {
         const u = new URL(raw, self.location.href);
         if (u.origin !== self.location.origin) continue;
         const rel = u.pathname.slice(ROOT.length);
         if (/^(?:cards|games|styles)\//.test(rel)) {
           urls.add('./' + rel + u.search);
         }
       } catch (e) { /* пропускаем некорректные/внешние ссылки */ }
     }
  } catch (e) { /* ок — используем базовый набор */ }
  return urls;
}

// Нормализует URL к виду "путь относительно корня приложения + search" для
// сравнения с Expected-списком.
function normUrl(urlStr) {
  try { const u = new URL(urlStr, self.location.href); return u.pathname.slice(ROOT.length) + u.search; }
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
     // Удаляем кэши СТАРЫХ версий. Текущий CACHE_NAME не трогаем: раньше
     // здесь удалялись ВСЕ кэши без исключений — после обновления воркера
     // прогретый офлайн-кэш исчезал, и при запуске без интернета приложение
     // показывало белый экран (скрипты игр не находились в кэше).
     const cacheNames = await caches.keys();
     for (const name of cacheNames) {
       if (name !== CACHE_NAME) await caches.delete(name);
     }
     // Очищаем устаревшие записи games/*, cards/*, styles/*
     const expected = await collectAssetUrls();
     const expectedNorms = new Set([...expected].map(normUrl));
     const cache = await caches.open(CACHE_NAME);
     const reqs = await cache.keys();
     await Promise.all(reqs.map((req) => {
       const rel = normUrl(req.url);
       if (/^(?:games|cards|styles)\//.test(rel) && !expectedNorms.has(rel)) {
         return cache.delete(req);
       }
       return null;
     }));
     await ctx.clients.claim();
   })().catch(() => {}));
 });

// Офлайн-заглушка: отдаётся, когда и сети нет, и в кэше нет нужного файла.
// Без неё iOS в standalone-режиме показывает пустой белый экран, и игрок
// решает, что приложение сломалось. Тёмный фон — как у приложения.
const OFFLINE_HTML = [
  '<!doctype html><html lang="ru"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  '<title>Нет соединения — Давай играй</title>',
  '<style>html,body{margin:0;min-height:100%;background:#2b0f2e;color:#fff;',
  'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
  'display:flex;align-items:center;justify-content:center;text-align:center}',
  '.box{padding:24px;max-width:320px}h1{font-size:20px;margin:0 0 12px}',
  'p{font-size:14px;line-height:1.5;margin:0;opacity:.85}</style></head>',
  '<body><div class="box"><h1>📶 Нет соединения</h1>',
  '<p>«Давай играй» работает офлайн, но этот экран ещё не сохранён на устройстве.</p>',
  '<p style="margin-top:12px">Подключитесь к интернету и откройте приложение ещё раз — после первой загрузки оно будет работать без сети.</p>',
  '</div></body></html>'
].join('');

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

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
            caches.match(request)
              .then((cached) => cached || caches.match('./index.html'))
              .then((cached) => cached || offlineResponse())
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
    // Офлайн fallback теперь всегда есть: games/* и styles/* предкэшируются
    // при установке, а при пустом кэше отдаём заглушку вместо пустого ответа
    // (respondWith(undefined) ронял загрузку скрипта — белый экран).
    if (url.pathname.startsWith(ROOT + 'games/') || url.pathname.startsWith(ROOT + 'styles/')) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => caches.match(request).then((cached) => cached || offlineResponse()))
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