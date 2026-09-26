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
 *    Установка транзакционная: ошибка любого обязательного файла оставляет
 *    старый воркер активным, а не создаёт частично рабочий новый кэш.
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
 *    версий по локальному манифесту precache, без сетевого fetch.
 *  - Явное обновление: страница отправляет waiting-worker сообщение
 *    SKIP_WAITING; только после этого worker активируется и забирает
 *    текущие вкладки через clients.claim().
 *
 * Создано для статического хостинга (https). При http/file:// воркер
 * регистрироваться не будет — это ограничение самого сервис-воркера.
 */
const CACHE_NAME = 'veselye-igry-cache-v520';

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
const PRECACHE_MANIFEST_URL = new URL('./__precache-manifest.json', self.location.href).href;
const INDEX_URL = new URL('./index.html', self.location.href).href;


// Собирает полный список предкэшируемых ресурсов: базовый набор + все
// cards/*.js, games/*.js и styles/*.css, на которые ссылается текущий
// index.html (с их версией ?v=…). Если index.html недоступен или неполон,
// precache не считается успешным: новый воркер не должен вытеснить старый.
async function collectAssetUrls() {
  const urls = new Set(PRECACHE_URLS);
  const res = await fetch(INDEX_URL, { cache: 'no-store' });
  if (!res || !res.ok) throw new Error('index.html unavailable');
  const html = await res.text();
  let hasCore = false;
  let hasInit = false;
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
        if (rel === 'games/core.js') hasCore = true;
        if (rel === 'games/init.js') hasInit = true;
        urls.add('./' + rel + u.search);
      }
    } catch (e) { /* пропускаем некорректные/внешние ссылки */ }
  }
  if (!hasCore || !hasInit) throw new Error('index.html has no complete app scripts');
  return [...new Set([...urls].map((u) => new URL(u, self.location.href).href))];
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
    // addAll атомарен для установки: если хоть один обязательный файл не
    // скачался, install отклоняется и старый воркер/кэш остаются в силе.
    // Раньше ошибки отдельных precache-запросов подавлялись, поэтому новый
    // воркер мог активироваться с неполным кэшем — приложение открывалось без
    // игровых скриптов.
    // Даже precache должен обходить HTTP-кеш: иначе install новой версии
    // может положить в кэш старый ответ с тем же URL (GitHub Pages держит
    // max-age=600). Request с no-store сохраняет транзакционность addAll.
    //
    // Перекачиваем ТОЛЬКО то, чего в кэше ещё нет. Раньше install каждый раз
    // тянул весь precache заново — около 4,1 МБ и 93 файла (cards 2,5 МБ,
    // games 1,4 МБ, styles 232 КБ), из-за чего обновление заметно замедлялось.
    // Ссылка включает ?v= проверенной версии, поэтому совпадение URL означает
    // и совпадение содержимого: адрес с тем же ?v= отдаёт тот же байт-код.
    // Всё остальное (addAll по полному списку) остаётся нетронутым, чтобы
    // install оставался транзакционным и атомарным.
    const cacheRequests = urls.map((url) => new Request(url, { cache: 'no-store' }));
    const missing = [];
    for (const req of cacheRequests) {
      if (await cache.match(req.url)) continue; // уже в кэше — не качаем
      missing.push(req);
    }
    if (missing.length) await cache.addAll(missing);
    await cache.put(PRECACHE_MANIFEST_URL, new Response(JSON.stringify(urls), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    }));
    // Не вызываем skipWaiting: новая версия ждёт нажатия кнопки «Обновить».
    // Иначе новый кэш может вытеснить старый прямо посреди открытой сессии.
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Список актуальных ресурсов берём только из локального манифеста,
    // созданного успешным install. Сетевой fetch здесь недопустим: при
    // офлайне он раньше возвращал урезанный список и удалял скрипты.
    let expected = null;
    try {
      const manifestResponse = await cache.match(PRECACHE_MANIFEST_URL);
      if (manifestResponse) {
        const parsed = await manifestResponse.json();
        if (Array.isArray(parsed) && parsed.length > 0) expected = parsed;
      }
    } catch (e) { /* неполный cache — старые кэши не трогаем */ }

    if (!expected) return;
    // Удаляем старые кэши лишь после проверки, что текущий precache полон.
    const complete = (await Promise.all(expected.map(async (u) => {
      try { return !!(await cache.match(new URL(u, self.location.href).href)); }
      catch (e) { return false; }
    }))).every(Boolean);
    if (!complete) return;

    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      if (name !== CACHE_NAME) await caches.delete(name);
    }
    // В текущем кэше удаляем только старые ?v= записи локальных
    // скриптов/стилей, перечисленные не в локальном манифесте.
    const expectedNorms = new Set(expected.map(normUrl));
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

// Обновление активирует ожидающий worker только по явной команде страницы.
// Раньше кнопка «Обновить» снимала регистрацию и удаляла все кэши. Это
// разрывало уже установленный precache нового worker'а: при активации
// проверка манифеста не проходила, кэш оставался неполным, а плашка
// «Доступна новая версия» появлялась снова. Теперь waiting-worker сам
// получает команду и корректно активируется через clients.claim().
//
// Тот же обработчик отвечает на GET_CACHE_NAME: страница сверяет сборку
// waiting-воркера с активным и не показывает плашку, если worker'ы
// побайтово одинаковы (ложное «Доступна новая версия» после обновления).
self.addEventListener('message', (event) => {
  if (!event || !event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    event.waitUntil(ctx.skipWaiting());
    return;
  }
  // Сборка этого воркера. Страница спрашивает её у waiting- и у активного
  // worker'а, чтобы отличить настоящее обновление от дубликата: смена версии
  // регистрации заставляет браузер поставить в waiting копию того же
  // байт-кода, и такая копия не должна показывать плашку. Отвечаем на порт
  // из event.ports — иначе страница будет ждать своего таймаута.
  if (event.data.type === 'GET_CACHE_NAME') {
    const port = event.ports && event.ports[0];
    if (port) port.postMessage({ type: 'CACHE_NAME', value: CACHE_NAME });
  }
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
        fetch(request, { cache: 'no-store' })
          .then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return response;
          })
          .catch(() =>
            caches.match(request)
              .then((cached) => cached || caches.match(INDEX_URL))
              .then((cached) => cached || offlineResponse())
          )
      );
      return;
    }

    // sw.js — всегда из сети, чтобы обновления применялись мгновенно.
    if (url.pathname.endsWith('sw.js')) {
      event.respondWith(fetch(request, { cache: 'no-store' }));
      return;
    }

    // Стили, игровые скрипты и колоды карточек — всегда network-first.
    // CSS вынесен из index.html в styles/app.css: при stale-while-revalidate
    // (как у картинок) устройство сначала отдавало бы СТАРЫЙ стиль, и правки
    // внешнего вида «не применялись» до второй перезагрузки. С cards/* та же
    // история: исправленные вопросы «Викторины» доезжали до игрока только со
    // второй сессии — первый заход после обновления показывал старую колоду.
    // Офлайн fallback теперь всегда есть: games/*, styles/* и cards/*
    // предкэшируются при установке, а при пустом кэше отдаём заглушку вместо
    // пустого ответа (respondWith(undefined) ронял загрузку скрипта — белый экран).
    if (url.pathname.startsWith(ROOT + 'games/') || url.pathname.startsWith(ROOT + 'styles/') || url.pathname.startsWith(ROOT + 'cards/')) {
      event.respondWith(
        fetch(request, { cache: 'no-store' })
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
        const network = fetch(request, { cache: 'no-store' })
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