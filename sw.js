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
 *      * навигация (открытие index.html) — СНАЧАЛА КЭШ, потом сеть. Раньше
 *        было network-first, и это главная причина чёрного/белого экрана без
 *        интернета: на мобильном интернете по белому списку запрос к
 *        недоступному хосту не отклоняется сразу, а ВИСИТ до системного
 *        таймаута (десятки секунд), поэтому приложение сначала чёрное, потом
 *        белое. Теперь кэш отдаётся мгновенно, а сеть проверяется только при
 *        промахе или по нажатию «Обновить» (адрес с ?_r=…).
 *      * стили (styles/*), игры (games/*) и колоды (cards/*) — СНАЧАЛА КЭШ,
 *        потом сеть. У всех файлов есть ?v= в адресе, то есть ключ кэша
 *        меняется вместе с содержимым: свежесть обеспечивается версионированием,
 *        а не порядком ответа сети. Полная пара «index.html + его скрипты»
 *        всегда приходит из одного кэша, поэтому сборка не может смешаться.
 *      * остальные GET своего origin — кэш, затем сеть.
 *      * ЛЮБОЙ сетевой запрос идёт через fetchTimeout() с таймаутом: зависший
 *        запрос не должен держать страницу (отказ по таймауту, а не «висок»).
 *      * sw.js — всегда сеть, no-store: обновления применяются мгновенно.
 *      * Если не нашлось ни сети, ни кэша — валидный пустой ответ нужного типа
 *        (emptyAssetResponse), а не HTML: браузер не выполнит classic script с
 *        Content-Type: text/html, и модуль пропадёт молча.
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
const CACHE_NAME = 'veselye-igry-cache-v594';

// Предел ожидания сетевого ответа, мс.
//
// Зачем. Мобильный интернет с доступом по белому списку не роняет запрос с
// ошибкой — он его ДЕРЖИТ: соединение открывается в пустоту и ждёт системного
// таймаута (на телефоне это десятки секунд, иногда до минуты на файл).
// fetch без таймаута в такой сети не отклоняется никогда, а скриптов
// приложения 105 — экран оставался пустым на минуты. С таймаутом запрос
// отклоняется предсказуемо, и управление переходит к кэшу.
const NET_TIMEOUT_MS = 4000;
// Отдельный, более короткий лимит на файл precache: их много, и install не
// должен висеть дольше, чем нужно на всю пачку.
const PRECACHE_FILE_TIMEOUT_MS = 8000;
// Сколько раз install пробует докачать недостающие файлы, прежде чем перейти к
// помилосердной закачке по одному. addAll атомарен: один оборванный запрос — и
// вся пачка (4,1 МБ, 105 файлов) не попадает в кэш. На мобильном интернете это
// воспроизводилось почти всегда, и офлайн просто не появлялся.
const PRECACHE_ATTEMPTS = 3;

/** fetch с предельным ожиданием. Отказ по таймауту вместо бесконечного виска. */
function fetchTimeout(request, options, ms) {
  const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), ms || NET_TIMEOUT_MS) : 0;
  const opts = Object.assign({}, options || {});
  if (ctrl) opts.signal = ctrl.signal;
  return fetch(request, opts).finally(() => { if (timer) clearTimeout(timer); });
}

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
  'sm', 'mc', 'st',
  // Добавлены вместе с ростом колод «Флагов» и «Столиц» (27/34/28 стран).
  // Новый флаг без записи здесь не попадёт в офлайн-кэш: карточка загрузится,
  // а картинка — нет, и в офлайне будет пустое место.
  'dk', 'ua', 'gr', 'at', 'ch', 'ro', 'hu', 'cz', 'th', 'vn', 'id', 'tr',
  'bg', 'mt', 'cl', 'ar', 'ph', 'eg', 'il', 'ee', 'lv', 'lt', 'is', 'lu',
  'sk', 'si', 'hr', 'md', 'ma', 'dz', 'tn', 'jo', 'ae', 'ir', 'la', 'kh',
  'bd', 'ec', 'bo', 'py', 'cr', 'cu', 'jm', 'mu', 'by', 'rs'
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
  const res = await fetchTimeout(INDEX_URL, { cache: 'no-store' });
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

// Файлы, без которых приложение не запустится вовсе. Только их отсутствие
// роняет install: остальное можно докачать позже, и callGameEntry() покажет
// игроку понятное окно вместо чёрного экрана.
const CRITICAL_ASSETS = ['./index.html', './styles/app.css', './games/core.js', './games/init.js'];

// Докачивает недостающие файлы precache.
//
// Зачем не хватает addAll. addAll атомарен: ОДИН оборванный запрос — и вся
// пачка (4,1 МБ, 105 файлов) не попадает в кэш, новый воркер не
// устанавливается, и офлайн не появляется вообще. На мобильном интернете по
// белому списку обрыв вполне обычен, поэтому пачка сначала пробуется целиком
// (дёшево, параллельно), затем — по одному файлу с таймаутом.
//
// Возвращает список того, что скачать так и не удалось. Install падает только
// если среди этого — критичный файл: неполный кэш с работающим ядром лучше
// полного отсутствия офлайна.
async function precacheAssets(cache, requests) {
  let pending = requests.slice();
  for (let attempt = 1; attempt <= PRECACHE_ATTEMPTS && pending.length; attempt++) {
    try {
      await cache.addAll(pending);
      return [];
    } catch (e) {
      // Пачка могла записаться частично — пересобираем список недокачанного.
      const rest = [];
      for (const req of pending) {
        if (await cache.match(req.url)) continue;
        rest.push(req);
      }
      pending = rest;
    }
  }
  // Помилосердная закачка по одному: один битый файл больше не отменяет
  // весь офлайн-режим.
  const failed = [];
  for (const req of pending) {
    try {
      const res = await fetchTimeout(req, { cache: 'no-store' }, PRECACHE_FILE_TIMEOUT_MS);
      if (res && res.ok) await cache.put(req, res);
      else failed.push(req.url);
    } catch (e) { failed.push(req.url); }
  }
  return failed;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const urls = await collectAssetUrls();
    const cache = await caches.open(CACHE_NAME);
    // Даже precache должен обходить HTTP-кеш: иначе install новой версии
    // может положить в кэш старый ответ с тем же URL (GitHub Pages держит
    // max-age=600). Request с no-store сохраняет транзакционность addAll.
    //
    // Перекачиваем ТОЛЬКО то, чего в кэше ещё нет. Раньше install каждый раз
    // тянул весь precache заново — около 4,1 МБ и 93 файла (cards 2,5 МБ,
    // games 1,4 МБ, styles 232 КБ), из-за чего обновление заметно замедлялось.
    // Ссылка включает ?v= проверенной версии, поэтому совпадение URL означает
    // и совпадение содержимого: адрес с тем же ?v= отдаёт тот же байт-код.
    const cacheRequests = urls.map((url) => new Request(url, { cache: 'no-store' }));
    const missing = [];
    for (const req of cacheRequests) {
      if (await cache.match(req.url)) continue; // уже в кэше — не качаем
      missing.push(req);
    }
    if (missing.length) {
      const failed = await precacheAssets(cache, missing);
      // Install отклоняется только ради критичных файлов (ядро приложения).
      // Незагруженная колода или одна игра — не повод лишать игрока офлайна
      // целиком: их отсутствие покажет callGameEntry() понятным окном.
      const lost = new Set(failed.map((u) => normUrl(u)));
      for (const must of CRITICAL_ASSETS) {
        if (!lost.has(normUrl(new URL(must, self.location.href).href))) continue;
        throw new Error('precache: критичный файл не загружен — ' + must);
      }
    }
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

// Поиск в кэше с откатом на ЛЮБУЮ версию того же файла.
//
// Зачем: ключ записи в кэше включает ?v= (games/know-more.js?v=20261023d), и
// caches.match(request) ищет точное совпадение вместе с query. Пока игрок не
// нажал «Обновить», активен старый worker, в precache которого лежит ПРЕДЫДУЩАЯ
// сборка этого файла (?v=…c). Свежий index.html приходит из сети (навигация
// network-first) и уже просит новую версию. Если сеть моргнёт ровно на этом
// запросе, точный поиск промахивается, и раньше на месте промаха отдавался
// offlineResponse() — HTML-заглушка со статусом 503. Браузер не выполняет
// classic script с Content-Type: text/html, модуль молча не выполнялся, игра не
// открывалась. Именно это и было в отчёте игрока от 29.09: отсутствовала
// ровно goToKnowMoreSetup, чей ?v= менялся последним (12a7b90).
//
// Старая версия того же файла — полноценная замена: это рабочий код прошлой
// сборки, а не пустое место. Поэтому сначала точное совпадение, затем любой
// ?v= того же пути. Ищем в именованном CACHE_NAME, а не через caches.match по
// всему хранилищу: activate чистит чужие записи, и искать в чужих кэшах незачем.
async function cachedAnyVersion(request){
  const cache = await caches.open(CACHE_NAME);
  const exact = await cache.match(request);
  if(exact) return exact;
  return cache.match(request, { ignoreSearch: true });
}

// Ответ для subresource, когда не нашлось ни сети, ни кэша.
//
// Смысл тот же, что у offlineResponse(), но тип содержимого соответствует
// запрошенному файлу. Раньше здесь отдавался HTML на запрос .js — браузер
// отказывался его выполнять (MIME-check) и приложение получало ошибку загрузки
// вместо понятного окна. Пустой валидный JS/CSS выполняется без вреда, а
// незагруженный модуль уже умеет объяснять игроку ситуацию через
// callGameEntry() в core.js.
function emptyAssetResponse(pathname){
  const isCss = /\.css($|\?)/.test(pathname);
  return new Response('', {
    status: 200,
    headers: {
      'Content-Type': isCss ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

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

// Есть ли свежая копия ресурса в кэше. Для навигации сначала пробуем
// канонический index.html: precache кладёт именно его, и он всегда свежее
// той копии, что была сохранена «по дороге» при прежнем открытии.
async function cachedNavigationResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  return (await cache.match(INDEX_URL)) || (await cache.match(request)) || null;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Работаем только с GET-запросами того же origin.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // sw.js — всегда из сети, чтобы обновления применялись мгновенно.
  if (url.pathname.endsWith('sw.js')) {
    event.respondWith(fetchTimeout(request, { cache: 'no-store' }));
    return;
  }

  // Навигация (открытие страницы) — СНАЧАЛА КЭШ.
  //
  // Раньше здесь стоял network-first, и именно это ломало приложение без
  // интернета. fetch к недоступному хосту на мобильном интернете по белому
  // списку не отклоняется, а висит до системного таймаута: страница оставалась
  // пустой на десятки секунд (чёрный, затем белый экран), и только потом
  // доходила до кэша. Теперь кэш отдаётся мгновенно, сеть проверяется фоном.
  if (request.mode === 'navigate') {
    // Принудительное обновление (hardUpdateApp добавляет ?_r=…) обязано идти в
    // сеть: иначе «Обновить» показывал бы ту же страницу из кэша.
    const forced = url.searchParams.has('_r');
    event.respondWith((async () => {
      const cached = await cachedNavigationResponse(request);
      if (cached && !forced) {
        // Фоновое обновление кэша, чтобы следующий запуск был свежим.
        event.waitUntil(
          fetchTimeout(request, { cache: 'no-store' })
            .then(async (response) => {
              if (!response || !response.ok) return;
              const cache = await caches.open(CACHE_NAME);
              await cache.put(request, response.clone());
            })
            .catch(() => { /* офлайн — тихо, игрок уже видит рабочее приложение */ })
        );
        return cached;
      }
      try {
        const response = await fetchTimeout(request, { cache: 'no-store' });
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          event.waitUntil(cache.put(request, response.clone()));
        }
        return response;
      } catch (e) {
        return (forced ? await cachedNavigationResponse(request) : null) || offlineResponse();
      }
    })());
    return;
  }

  // Стили, игровые скрипты и колоды карточек — СНАЧАЛА КЭШ, потом сеть.
  //
  // Раньше был network-first «чтобы правки применялись сразу». Но у каждого
  // файла есть ?v= в адресе, то есть ключ кэша меняется вместе с
  // содержимым: пока ?v= прежний, содержимое и не менялось, и свежесть решает
  // версионирование, а не порядок ответа сети. Обменяв порядок, мы получили
  // мгновенный старт и офлайн, а риск «старой колоды до второй сессии»
  // закрыт правилом: любая правка файла обязана поднимать ?v= (tools/check.js).
  //
  // Промах в кэше (например, свежий index.html при старом воркере) идёт в сеть;
  // сеть недоступна — отдаём ЛЮБУЮ закэшированную версию того же файла
  // (cachedAnyVersion), и только если нет даже её — валидный пустой ответ
  // нужного типа (emptyAssetResponse). HTML на месте .js браузер выполнять не
  // станет (MIME-check), и модуль пропал бы молча.
  if (url.pathname.startsWith(ROOT + 'games/') || url.pathname.startsWith(ROOT + 'styles/') || url.pathname.startsWith(ROOT + 'cards/')) {
    event.respondWith((async () => {
      const cached = await cachedAnyVersion(request);
      if (cached) return cached;
      try {
        const response = await fetchTimeout(request, { cache: 'no-store' });
        if (response && response.status === 200) {
          const copy = response.clone();
          const cache = await caches.open(CACHE_NAME);
          event.waitUntil(cache.put(request, copy));
        }
        return response;
      } catch (e) {
        return emptyAssetResponse(url.pathname);
      }
    })());
    return;
  }

  // Остальные ресурсы (иконки, фото) — кэш, при промахе сеть с таймаутом.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetchTimeout(request, { cache: 'no-store' });
      if (response && response.status === 200) {
        const copy = response.clone();
        const cache = await caches.open(CACHE_NAME);
        event.waitUntil(cache.put(request, copy));
      }
      return response;
    } catch (e) {
      // Фото и иконки не входят в precache, поэтому офлайн их может не быть.
      // Отвечаем валидным (пустым) ответом: respondWith(undefined) срывал бы
      // загрузку и давал белый экран.
      return new Response('', { status: 504, headers: { 'Cache-Control': 'no-store' } });
    }
  })());
});