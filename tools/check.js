#!/usr/bin/env node
/**
 * tools/check.js — проверка проекта перед коммитом.
 *
 * Запуск:  node tools/check.js
 * Или:     node tools/check.js --verbose   (показывать детали каждой проверки)
 *
 * Что проверяется (семь групп — ровно те баги, что реально случались
 * в этом проекте, см. раздел «Логи исправлений» в README):
 *
 *   1. Загрузка скриптов   — все 80+ файлов грузятся без ошибок, порядок соблюдён
 *   2. Разметка            — баланс <div> по каждой секции index.html
 *   3. Мёртвый код         — функции, которые нигде не вызываются
 *   4. Подключения         — все cards/*.js и games/*.js подключены в index.html
 *   5. Версии и кэш        — формат ?v=, уникальность, CACHE_NAME в sw.js
 *   6. DOM-ссылки          — getElementById без защиты на несуществующий id
 *   7. Ссылки документации — якоря в README.md ведут на существующие заголовки
 *
 * Скрипт НЕ проверяет визуальную часть (вёрстку, цвета, размеры) — для этого
 * нужен реальный браузер. Он отвечает на вопрос «ничего не сломано».
 *
 * Код возврата: 0 — всё чисто, 1 — есть проблемы (удобно для CI и git-хуков).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { loadAppScripts } = require('./dom-stub');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

// ─────────────────────────────────────────────────────────────────────────────
// Мини-фреймворк для отчёта: копим результаты и печатаем один раз в конце.
// ─────────────────────────────────────────────────────────────────────────────
const results = [];
let currentGroup = null;

function group(title) {
  currentGroup = { title, checks: [] };
  results.push(currentGroup);
}

/** @param {string} name @param {boolean} ok @param {string} [detail] */
function check(name, ok, detail) {
  currentGroup.checks.push({ name, ok, detail: ok ? null : detail });
}

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

/**
 * Исходный код логики приложения: core.js вместе с частями, вынесенными при
 * разделении монолита (fants-*.js). Проверки, которые ищут функцию по всему
 * ядру, должны смотреть во все эти файлы, иначе после разделения они дают
 * ложные срабатывания — функция просто лежит в другом файле.
 */
function readCore() {
  const parts = ['games/core.js'];
  for (const f of fs.readdirSync(path.join(ROOT, 'games'))) {
    if (/^fants-.*\.js$/.test(f)) parts.push('games/' + f);
  }
  return parts.map(read).join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Загрузка скриптов
// ─────────────────────────────────────────────────────────────────────────────
function checkScripts(html) {
  group('Загрузка скриптов');
  const { loaded, failed, missingIds } = loadAppScripts(html, { root: ROOT });
  const total = loaded.length + failed.length;

  check(
    `все скрипты грузятся без ошибок (${loaded.length}/${total})`,
    failed.length === 0,
    failed.map((f) => `${f.file}: ${f.error}`).join('\n      ')
  );

  // Порядок загрузки в проекте: сначала ВСЕ данные (cards/*), затем логика
  // (games/core.js первым), последним — init.js.
  // Границы критичны: данные должны быть готовы к моменту, когда core.js
  // начнёт их читать, а init.js вызывает функции всех игр — он последний.
  const order = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1].split('?')[0]);
  const gameScripts = order.filter((f) => f.startsWith('games/'));
  check(
    'games/core.js — первый среди скриптов логики',
    gameScripts[0] === 'games/core.js',
    `первым идёт ${gameScripts[0]}`
  );
  check(
    'games/init.js подключён последним',
    order[order.length - 1] === 'games/init.js',
    `последним идёт ${order[order.length - 1]}`
  );
  // В cards/ лежат не только данные, но и сборочные скрипты (например,
  // wish-roulette-cards.js собирает банк из других колод) — они обязаны
  // грузиться ПОСЛЕ источников, поэтому общее правило «все cards до games»
  // к ним не применимо. Проверяем то, что действительно важно: колоды-данные
  // (cards_fants, cards_quiz и т.п.) должны быть готовы до core.js, потому что
  // core.js сразу строит из них пул карточек.
  const coreIdx = order.indexOf('games/core.js');
  const dataDecks = order.filter((f) => /^cards\/cards_[a-z_]+/.test(f));
  const lateDecks = dataDecks.filter((f) => order.indexOf(f) > coreIdx);
  check(
    `колоды данных подключены до core.js (${dataDecks.length})`,
    lateDecks.length === 0,
    `после core.js: ${lateDecks.join(', ')}`
  );

  return { loaded, failed, missingIds };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Баланс разметки
// ─────────────────────────────────────────────────────────────────────────────
function checkMarkup(html) {
  group('Разметка');
  const open = (html.match(/<div\b/g) || []).length;
  const close = (html.match(/<\/div>/g) || []).length;
  check(`баланс <div> во всём файле (${open}/${close})`, open === close, `разница ${open - close}`);

  // По секциям — так сразу видно, где именно незакрытый тег.
  const broken = [];
  for (const m of html.matchAll(/<section[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)) {
    const o = (m[2].match(/<div\b/g) || []).length;
    const c = (m[2].match(/<\/div>/g) || []).length;
    if (o !== c) broken.push(`#${m[1]} (${o - c > 0 ? '+' : ''}${o - c})`);
  }
  check(
    'баланс <div> по каждой секции',
    broken.length === 0,
    `несбалансированы: ${broken.join(', ')}`
  );

  // Дубли id ломают getElementById — он вернёт первый попавшийся элемент.
  const allIds = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  const dupes = [...new Set(allIds.filter((id, i) => allIds.indexOf(id) !== i))];
  check('нет дублирующихся id', dupes.length === 0, `дубли: ${dupes.join(', ')}`);

  // Меню «☰» не должно возвращать пункты, дублирующие автоматику.
  // «Обновить приложение» повторял плашку #updateToast, которую Service Worker
  // показывает сам; «Сообщить о проблеме» повторял кнопку на экране ошибки,
  // который открывается сам при сбое. Проверяем и разметку, и то, что по
  // удалённым id не осталось обработчиков — иначе код падал бы на
  // addEventListener у несуществующего элемента.
  for (const [id, why] of [
    ['menuUpdateBtn', 'обновление показывает плашка #updateToast'],
    ['menuReportBtn', 'отчёт об ошибке копируется с экрана ошибки'],
    ['davaySetupFavoritesBtn', 'просмотр избранного открывается с итогов партии'],
  ]) {
    const inHtml = new RegExp(`id="${id}"`).test(html);
    const inJs = fs.readdirSync(path.join(ROOT, 'games'))
      .filter((f) => f.endsWith('.js'))
      .some((f) => new RegExp(`getElementById\\('${id}'\\)`).test(read(path.join('games', f))));
    check(`удалённого дубля #${id} нет`, !inHtml && !inJs,
      `${inHtml ? 'остался в разметке' : ''}${inHtml && inJs ? ' и ' : ''}${inJs ? 'остался обработчик в games/*.js' : ''} — ${why}`);
  }

  // Убрав дублирующий вход, легко снести и саму возможность: проверяем, что
  // просмотр избранного «Давай попробуем» по-прежнему открывается с экрана
  // итогов — там он и уместен, избранное появляется по итогам партии.
  check('просмотр избранного «Давай попробуем» доступен с итогов',
    /id="davaySummaryFavBtn"/.test(html) &&
      /getElementById\('davaySummaryFavBtn'\)[\s\S]{0,200}addEventListener/.test(read('games/fants-timer.js')),
    'кнопка «Смотреть совпавшие видео» на итогах пропала или не обработана — избранное стало недостижимым');

  // Плашка обновления обязана закрываться крестиком: без него единственным
  // способом убрать её было обновиться, то есть согласиться на то, от чего
  // игрок отказывается.
  check('у плашки обновления есть крестик закрытия',
    /id="updateToastCloseBtn"/.test(html),
    'нет #updateToastCloseBtn — плашку нельзя закрыть без обновления');
  check('крестик плашки обновления обработан',
    /getElementById\('updateToastCloseBtn'\)/.test(html) &&
      /updateToastCloseBtn'\)[\s\S]{0,400}addEventListener/.test(html),
    'крестик есть в разметке, но обработчик закрытия не подключён');

  // Кнопки импорта видео на странице настройки «Давай попробуем»: подпись в
  // разметке и упоминание в правилах игры должны совпадать — игрок ищет
  // кнопку по тому имени, которое прочитал в правилах. Проверка ловит
  // переименование «в одном месте»: раньше так и разошлось («Добавить видео»
  // в разметке против текста правил).
  for (const [id, label] of [
    ['davaySetupImportBtn', 'Добавить свое видео'],
    ['davaySetupYandexBtn', 'Обновить видеофайлы'],
  ]) {
    const btnRe = new RegExp(`id="${id}"[^>]*>([^<]*)<`);
    const shown = (btnRe.exec(html) || [])[1] || '';
    check(`подпись #${id} — «${label}»`,
      shown.includes(label),
      `в разметке «${shown.trim() || 'кнопка не найдена'}» — ожидалось «${label}»`);
    // В правилах подпись может приводиться вместе с иконкой («➕ Добавить свое
    // видео»), поэтому ищем текст без учёта эмодзи-префикса.
    check(`«${label}» упомянута в правилах «Давай попробуем»`,
      new RegExp(`«[^»]*${label}[^»]*»`).test(html),
      `правила не называют кнопку «${label}» — игрок не найдёт её на экране`);
  }
  // Иконка у «Обновить видеофайлы» убрана намеренно: кнопка обновляет файлы
  // из папки, а ☁️ читалась как «Яндекс Диск» — отдельная сущность.
  check('у «Обновить видеофайлы» нет иконки ☁️',
    !/id="davaySetupYandexBtn"[^>]*>[^<]*☁️/.test(html),
    'иконка ☁️ вернулась в подпись кнопки обновления видеофайлов');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Мёртвый код
// ─────────────────────────────────────────────────────────────────────────────
function checkDeadCode() {
  group('Мёртвый код');
  const files = fs.readdirSync(path.join(ROOT, 'games'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => path.join('games', f));
  files.push('index.html');

  const all = files.map((f) => read(f)).join('\n');
  const dead = [];

  for (const file of files) {
    const src = read(file);
    // Ищем только определения функций верхнего уровня: они глобальные,
    // значит отсутствие упоминаний где-либо = гарантированно мёртвый код.
    for (const m of src.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
      const name = m[1];
      const uses = (all.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length;
      if (uses <= 1) dead.push(`${name} (${file})`);
    }
  }
  check(
    `нет неиспользуемых функций${dead.length ? ` — найдено ${dead.length}` : ''}`,
    dead.length === 0,
    dead.join('\n      ')
  );

  // Отладочные следы, которые не должны попадать в продакшн.
  const debug = [];
  for (const file of files) {
    const src = read(file);
    src.split('\n').forEach((line, i) => {
      if (/console\.(log|debug|trace)\s*\(|(^|\s)debugger\s*;/.test(line)) {
        debug.push(`${file}:${i + 1}`);
      }
    });
  }
  check('нет console.log / debugger', debug.length === 0, debug.join(', '));
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Подключения файлов данных и логики
// ─────────────────────────────────────────────────────────────────────────────
function checkWiring(html) {
  group('Подключения');
  for (const [dir, pattern] of [['games', /games\/([a-z0-9-]+\.js)/g], ['cards', /cards\/([a-z0-9_-]+\.js)/g]]) {
    const listed = new Set([...html.matchAll(pattern)].map((m) => m[1]));
    const onDisk = fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.js'));
    const orphan = onDisk.filter((f) => !listed.has(f));
    check(
      `все ${dir}/*.js подключены (${onDisk.length})`,
      orphan.length === 0,
      `не подключены: ${orphan.join(', ')}`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Версии скриптов и кэш Service Worker
// ─────────────────────────────────────────────────────────────────────────────
function checkVersions(html) {
  group('Версии и кэш');
  const tags = [...html.matchAll(/src="([^"]+)\?v=([^"]+)"/g)];

  const badFormat = tags.filter((m) => !/^\d{8}[a-z]$/.test(m[2]));
  check(
    'формат версий ?v=YYYYMMDDx',
    badFormat.length === 0,
    badFormat.map((m) => `${m[1]}=${m[2]}`).join(', ')
  );

  const untagged = [...html.matchAll(/src="((?:games|cards)\/[^"]+\.js)"/g)].map((m) => m[1]);
  check(
    'у всех games/cards проставлена версия',
    untagged.length === 0,
    `без ?v=: ${untagged.join(', ')}`
  );

  const sw = read('sw.js');
  const cache = sw.match(/CACHE_NAME\s*=\s*'([^']+)'/);
  check('CACHE_NAME объявлен', !!cache, 'не найдена строка CACHE_NAME');
  if (cache) {
    const cacheVer = (cache[1].match(/v(\d+)$/) || [])[1];
    check(
      `CACHE_NAME в формате vNNN (${cache[1]})`,
      !!cacheVer,
      'ожидается имя вида veselye-igry-cache-vN'
    );

    // APP_BUILD попадает в отчёт об ошибке и в выгрузку статистики — по нему
    // определяется, на какой версии у игрока случился сбой. Рассинхрон с
    // CACHE_NAME уже случался (кэш v212, а в отчёте v174), из-за чего
    // диагностика вводила в заблуждение. Держим их синхронными.
    const build = html.match(/window\.APP_BUILD\s*=\s*'([^']*)'/);
    check('APP_BUILD объявлен в index.html', !!build, 'нет window.APP_BUILD');
    if (build && cacheVer) {
      const buildVer = (build[1].match(/v(\d+)\s*$/) || [])[1];
      check(
        `APP_BUILD совпадает с CACHE_NAME (v${buildVer || '?'} / v${cacheVer})`,
        buildVer === cacheVer,
        `APP_BUILD «${build[1]}» не совпадает с CACHE_NAME «${cache[1]}» — отчёт покажет неверную версию`
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. DOM-ссылки без защиты
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Проверяет, лежит ли строка внутри блока `if (<переменная>) { ... }`, где
 * эта переменная получает значение getElementById(<id>) с отсутствующим id.
 * Если да — код недостижим, падения не будет.
 */
function guardIsDead(src, lineIdx, id) {
  const lines = src.split('\n');
  const guardRe = new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=\\s*document\\.getElementById\\(['"]${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\)`);
  let guardVar = null;
  for (let i = lineIdx; i >= 0 && i > lineIdx - 400; i--) {
    const m = lines[i].match(guardRe);
    if (m) { guardVar = m[1]; break; }
  }
  if (!guardVar) return false;
  // Ищем `if (guardVar)` выше нашей строки и убеждаемся, что мы внутри него.
  let depth = 0;
  for (let i = lineIdx; i >= 0 && i > lineIdx - 400; i--) {
    const l = lines[i];
    if (new RegExp(`if\\s*\\(\\s*${guardVar}\\s*\\)`).test(l)) return true;
    depth += (l.match(/\{/g) || []).length - (l.match(/\}/g) || []).length;
    if (depth < 0) return false;
  }
  return false;
}

function checkDomRefs(html, missingIds) {
  group('DOM-ссылки');
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));

  // id, которые приложение создаёт само: через innerHTML (id="..." внутри
  // шаблонных строк) или через createElement + .id = '...'. Их отсутствие
  // в index.html — норма, а не ошибка.
  const dynamicIds = new Set(['toast']);
  const jsFiles = fs.readdirSync(path.join(ROOT, 'games')).map((f) => path.join('games', f));
  for (const file of jsFiles) {
    const src = read(file);
    for (const m of src.matchAll(/id="([^"$]+)"/g)) dynamicIds.add(m[1]);
    for (const m of src.matchAll(/\.id\s*=\s*['"]([^'"]+)['"]/g)) dynamicIds.add(m[1]);
  }

  // Опасен не сам факт обращения к отсутствующему id, а обращение БЕЗ проверки:
  //   document.getElementById('x').textContent = ...   <- упадёт
  //   const el = document.getElementById('x'); if (el)  <- безопасно
  const unsafe = [];
  for (const file of jsFiles) {
    const src = read(file);
    src.split('\n').forEach((line, i) => {
      const m = line.match(/getElementById\(['"]([^'"]+)['"]\)\s*\.\s*(\w+)/);
      if (!m) return;
      const id = m[1], prop = m[2];
      if (ids.has(id) || dynamicIds.has(id)) return;
      if (/^\s*(\/\/|\*)/.test(line)) return;   // комментарий
      if (line.includes('||')) return;             // есть фолбэк
      // Мёртвая ветка: код внутри if(<el>){...}, где <el> заведомо null,
      // потому что его id нет в разметке. Такой код не выполнится никогда,
      // поэтому падения не будет — это не баг, а неиспользуемый функционал
      // (например, импорт/экспорт своих заданий, отключённый в UI).
      if (guardIsDead(src, i, id)) return;
      unsafe.push(`${file}:${i + 1} -> #${id}.${prop}`);
    });
  }
  check(
    'нет незащищённых обращений к отсутствующим id',
    unsafe.length === 0,
    unsafe.join('\n      ')
  );

  // Второй класс той же ошибки — «размазанный» по строкам:
  //   const el = document.getElementById('нет-в-разметке');   <- строка N
  //   ...                                                     <- строка N+1
  //   el.textContent = '...';                                  <- строка N+2
  // Однострочная регулярка выше это НЕ видит (реальный баг «Рулетки»,
  // v172: resultEl.textContent падал, хотя check.js был зелёный).
  const varUnsafe = [];
  for (const file of jsFiles) {
    const src = read(file);
    const lines = src.split('\n');
    // Все переменные, получающие getElementById(id-вне-разметки)
    const decls = [];
    lines.forEach((line, i) => {
      const m = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*document\.getElementById\(['"]([^'"]+)['"]\)/);
      if (!m) return;
      if (ids.has(m[2]) || dynamicIds.has(m[2])) return;
      decls.push({ varName: m[1], id: m[2], line: i });
    });
    if (!decls.length) continue;
    lines.forEach((line, j) => {
      for (const { varName, id, line: di } of decls) {
        if (j <= di || j > di + 400) continue;
        const use = line.match(new RegExp(`(?<![\\w.])${varName}\\s*\\.\\s*(\\w+)\\s*=[^=]`));
        if (!use) continue;
        if (/^\s*(\/\/|\*)/.test(line)) continue;                       // комментарий
        if (line.includes('&&') || line.includes('||') || line.includes('?.')) continue; // фолбэк/опциональная цепочка
        if (new RegExp(`${varName}\\s*&&`).test(line)) continue;        // el && (el.style…)
        // Защита между объявлением и использованием:
        //   if (varName) { ... }                — классический гвард
        //   if (!varName) return; / guard-выход — early-return в начале функции
        let guarded = false;
        // Префиксное совпадение: ловит и if (el), и if (!el) return, и
        // if (!el || el.querySelector('svg')) return (early-return с доп. условием)
        const guardRe = new RegExp(`if\\s*\\(\\s*!?\\s*${varName}\\b`);
        for (let k = di + 1; k < j; k++) {
          if (guardRe.test(lines[k])) { guarded = true; break; }
        }
        if (guardRe.test(lines[di])) guarded = true;
        if (guarded) continue;
        varUnsafe.push(`${file}:${j + 1} -> ${varName}.${use[1]} (#${id} нет в разметке)`);
      }
    });
  }
  check(
    'нет незащищённых обращений через переменные (многострочный случай)',
    varUnsafe.length === 0,
    varUnsafe.join('\n      ')
  );

  // Отсутствующие id сами по себе — норма (кнопки правил, служебные элементы),
  // но полезно видеть их число: резкий рост означает опечатку в разметке.
  const unknown = missingIds.filter((id) => !ids.has(id) && !dynamicIds.has(id));
  if (VERBOSE) {
    console.log(`      i id вне разметки: ${unknown.length} — все обращения защищены`);
  }
  return unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Ссылки в документации
// ─────────────────────────────────────────────────────────────────────────────
function checkDocs() {
  group('Документация');
  if (!exists('README.md')) {
    check('README.md существует', false, 'файл не найден');
    return;
  }
  const md = read('README.md');

  // Слаги как в GitHub: нижний регистр, эмодзи и пунктуация отбрасываются.
  const slug = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
  const headings = new Set([...md.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => slug(m[1])));

  const broken = [...md.matchAll(/\]\(#([^)]+)\)/g)]
    .map((m) => m[1])
    .filter((anchor) => !headings.has(anchor));
  check('все ссылки-якоря в README рабочие', broken.length === 0, `битые: ${broken.join(', ')}`);

  check('AGENTS.md существует', exists('AGENTS.md'), 'файл с правилами проекта не найден');
}


// ─────────────────────────────────────────────────────────────────────────────
// 8. Реестр игр
// ─────────────────────────────────────────────────────────────────────────────
function checkRegistry() {
  group('Реестр игр');
  const regPath = 'games/game-registry.js';
  if (!exists(regPath)) {
    check('games/game-registry.js существует', false, 'файл реестра не найден');
    return;
  }
  const src = read(regPath);
  const allJs = fs.readdirSync(path.join(ROOT, 'games'))
    .map((f) => read(path.join('games', f))).join('\n');

  // Каждая игра обязана иметь mode, title, group и способ завершения.
  // Запись игры: строка `mode: '<ключ>'` в начале строки. Перед ней может
  // стоять комментарий, поэтому ищем по самому полю, а не по «{ mode: …».
  const entries = [...src.matchAll(/^\s*mode:\s*'([^']+)'/gm)].map((m) => m[1]);
  check(`реестр содержит игры (${entries.length})`, entries.length > 0, 'ни одной записи');

  const dupes = entries.filter((m, i) => entries.indexOf(m) !== i);
  check('нет дублирующихся mode', dupes.length === 0, `дубли: ${dupes.join(', ')}`);

  const groups = [...src.matchAll(/group:\s*'([^']+)'/g)].map((m) => m[1]);
  const allowed = ['two', 'party', 'kids', 'solo', 'business'];
  const badGroup = groups.filter((g) => !allowed.includes(g));
  check('группы игр допустимы', badGroup.length === 0, `неизвестные: ${badGroup.join(', ')}`);

  // Все функции, на которые ссылается реестр, должны существовать в коде.
  const fnNames = [...src.matchAll(/(?:pause|resume|finish|finishEmpty|exitSummary):\s*'([A-Za-z_$][\w$]*)'/g)]
    .map((m) => m[1]);
  const missing = [...new Set(fnNames)].filter((n) => {
    const re = new RegExp(`function\\s+${n}\\s*\\(|${n}\\s*=\\s*function`);
    return !re.test(allJs);
  });
  check(
    `все функции реестра существуют (${new Set(fnNames).size})`,
    missing.length === 0,
    `не найдены: ${missing.join(', ')}`
  );

  // Каждый state.pausedMode, который выставляет код, обязан быть в реестре:
  // иначе игра «потеряется» — не будет ни продолжения, ни завершения.
  const coreSrc = read('games/core.js');
  const modesInCore = new Set(
    [...coreSrc.matchAll(/pausedMode\s*=\s*'([a-zA-Z]+)'/g)].map((m) => m[1])
  );
  const modesInReg = new Set(entries);
  const unregistered = [...modesInCore].filter((m) => !modesInReg.has(m));
  check(
    'у каждого pausedMode есть запись в реестре',
    unregistered.length === 0,
    `нет в реестре: ${unregistered.join(', ')}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8б. Сброс чужой паузы при запуске партии
//     Раньше сброс pausedMode/inProgress был «размазан» по кнопкам хаба:
//     где-то продублирован, где-то забыт — и игрок после выхода попадал в
//     чужое меню «Пауза — Фанты». Теперь это делает единая goToGame().
// ─────────────────────────────────────────────────────────────────────────────
function checkPauseResetOnStart() {
  group('Сброс чужой паузы');
  const core = read('games/core.js');
  const goToGameMatch = core.match(/function goToGame\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
  const goToGame = goToGameMatch ? goToGameMatch[0] : '';

  check('goToGame() найдена в core.js', goToGame.length > 0, 'функция не найдена');
  check(
    'goToGame() снимает чужую паузу',
    /g\.mode/.test(goToGame) && /pausedMode\s*!==\s*ownMode/.test(goToGame),
    'в goToGame() нет сброса pausedMode для чужой игры'
  );
  check(
    'goToGame() выставляет inProgress',
    /state\.inProgress\s*=\s*true/.test(goToGame),
    'goToGame() не поднимает inProgress — настройки в хабе останутся заблокированными'
  );
  check(
    'goToGame() обновляет блок «Продолжить игру»',
    /updateResumeUI\s*\(/.test(goToGame),
    'goToGame() не вызывает updateResumeUI() — меню паузы может остаться на экране'
  );

  // Запуск игры через goToGame() не должен передавать 'setup' как setupId:
  // goToGame() гасит все экраны сам, а этот параметр вводил в заблуждение и
  // прятал ошибки вроде «настройки остались активными вместе с игрой».
  const gamesDir = path.join(ROOT, 'games');
  const setupArgs = [];
  for (const f of fs.readdirSync(gamesDir)) {
    const src = read(path.join('games', f));
    const hits = [...src.matchAll(/goToGame\(\s*'setup'/g)];
    if (hits.length) setupArgs.push(`${f} (${hits.length})`);
  }
  check(
    'goToGame() вызывается без устаревшего setupId',
    setupArgs.length === 0,
    `передают 'setup': ${setupArgs.join(', ')}`
  );

  // «Видеорулетка» — режим внутри #game и в реестре её нет, поэтому goToGame()
  // её не прикрывает: запуск обязан снять чужую паузу сам.
  const davay = read('games/fants-davay.js');
  const videoBtn = davay.match(/davaySetupVideoBtn'\)\.addEventListener[\s\S]*?\n\}\);/);
  check(
    'запуск «Видеорулетки» снимает чужую паузу',
    !!videoBtn && /pausedMode\s*=\s*null/.test(videoBtn[0]),
    'кнопка «🎥 Видеорулетка» не сбрасывает pausedMode'
  );

  // Выход из «Видеорулетки» — на шаг назад, в меню «Давай попробуем»
  // (#davaySetup), из которого игра запускается. Раньше здесь был
  // returnToSetupUI(), и выход перепрыгивал уровень — игрок оказывался
  // в списке «Игры для пар 18+».
  const videoSrc = read('games/fants-video.js');
  const exitVideo = videoSrc.match(/function exitVideoGame\s*\(\)\s*\{[\s\S]*?\n\}/);
  check(
    'выход из «Видеорулетки» ведёт в меню «Давай попробуем»',
    !!exitVideo && /davaySetup/.test(exitVideo[0]),
    'exitVideoGame() не открывает #davaySetup'
  );
  check(
    'выход из «Видеорулетки» не уводит в хаб пар',
    !!exitVideo && !/returnToSetupUI/.test(exitVideo[0]),
    'exitVideoGame() по-прежнему вызывает returnToSetupUI() (#setup)'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8в. Навигация при выходе из игры
//     Класс багов «выход ведёт не туда»: выход перепрыгивал уровень настройки,
//     уводил в чужой раздел хаба, оставлял игровой экран активным или не
//     сбрасывал пару inProgress/pausedMode.
// ─────────────────────────────────────────────────────────────────────────────
function checkExitNavigation() {
  group('Навигация при выходе');

  // 1. Единый механизм возврата «откуда пришёл» должен быть подключён, а не
  //    лежать мёртвым кодом (именно так и было: функцию написали, но не звали).
  const core = read('games/core.js');
  const exitGameSrc = (core.match(/function exitGame\s*\([^)]*\)\s*\{[\s\S]*?\n\}/) || [''])[0];
  check(
    'exitGame() возвращает по запомненной точке входа',
    /returnToEntryScreen\s*\(/.test(exitGameSrc),
    'exitGame() не вызывает returnToEntryScreen() — механизм возврата не подключён'
  );
  check(
    'exitGame() сбрасывает пару inProgress/pausedMode',
    /state\.inProgress\s*=\s*false/.test(exitGameSrc) && /state\.pausedMode\s*=\s*null/.test(exitGameSrc),
    'exitGame() не сбрасывает оба флага вместе (залипший inProgress блокирует настройки)'
  );
  check(
    'goToGame() и goToGameSetup() запоминают точку входа',
    /rememberReturnScreen\s*\(/.test(core) &&
      (core.match(/rememberReturnScreen\s*\(/g) || []).length >= 3,
    'точка входа запоминается не во всех переходах (нужны goToGame и goToGameSetup)'
  );

  // 2. Режимы экрана #game переключаются CSS-классами. Если класс ставится и
  //    снимается вручную по месту, «чужой» режим остаётся висеть и уводит
  //    кнопку «Выход»/стрелку «←» не туда. Единственный писатель — setGameMode().
  const gamesDir = path.join(ROOT, 'games');
  const manualModeWriters = [];
  for (const f of fs.readdirSync(gamesDir)) {
    const src = read(path.join('games', f));
    const hits = [...src.matchAll(/classList\.(?:add|remove)\(\s*'(video-mode|davay-mode|placeholder-mode)'/g)];
    if (hits.length) manualModeWriters.push(`${f} (${hits.map((h) => h[1]).join(', ')})`);
  }
  check(
    'классы режимов #game меняет только setGameMode()',
    manualModeWriters.length === 0,
    `пишут напрямую: ${manualModeWriters.join('; ')}`
  );
  check(
    'setGameMode() снимает остальные режимы',
    /GAME_MODE_CLASSES/.test(core) && /cls !== mode/.test(core),
    'setGameMode() не снимает чужие классы режимов'
  );

  // 3. Стрелка «←» на клавиатуре должна повторять ветки кнопки «Выход»
  //    (games/fants-timer.js). Раньше она знала только видеорежим, и
  //    «Давай попробуем»/«Предложи партнёру» проваливались в паузу «Фантов».
  const keydown = (core.match(/addEventListener\('keydown'[\s\S]*?\n\}\);/) || [''])[0];
  check(
    'клавиатурная «←» знает все режимы #game',
    ['isVideoMode', 'isPlaceholderMode', 'isDavayMode'].every((fn) => keydown.includes(fn)),
    'в обработчике keydown нет веток placeholder/davay — игрок попадёт в паузу «Фантов»'
  );

  // 4. Экраны, известные навигации: подменю настольных игр детей не было ни в
  //    SETUP_ONLY_SCREENS, ни в SECTION_FOR_SCREEN — «←» выбрасывала оттуда
  //    в «Игры для пар 18+».
  const timer = read('games/fants-timer.js');
  check(
    'подменю настольных игр известно навигации',
    /kidsBoardGamesMenu/.test(timer),
    '#kidsBoardGamesMenu не описан в SECTION_FOR_SCREEN/SETUP_ONLY_SCREENS'
  );

  // 5. Кнопки «Пауза»/«Выход», объявленные в разметке, обязаны иметь
  //    обработчик: мёртвая кнопка выглядит как сломанная игра (так было
  //    у #kidsSaperPauseBtn в «Сапёре»).
  const html = read('index.html');
  // Кнопку могут подключать и напрямую по id, и через переменную:
  //   const btn = document.getElementById('x'); if(btn) btn.addEventListener(...)
  // поэтому ищем оба способа, иначе проверка даёт ложные срабатывания.
  // Кнопку могут подключать напрямую по id, через переменную или через
  // querySelector — важно лишь, что id вообще встречается в коде рядом с
  // подпиской. Достаточно «id упомянут в подписке»: точную привязку к
  // обработчику проверяет статический анализ write/read, а здесь цель —
  // поймать кнопку, о которой код вообще не знает (мёртвую).
  const wired = new Set();
  for (const f of fs.readdirSync(gamesDir)) {
    const src = read(path.join('games', f));
    for (const m of src.matchAll(/getElementById\('([A-Za-z0-9_]+)'\)/g)) wired.add(m[1]);
    for (const m of src.matchAll(/querySelector(?:All)?\(['"][^'"]*#([A-Za-z0-9_]+)/g)) wired.add(m[1]);
  }
  const deadButtons = [];
  for (const m of html.matchAll(/<button[^>]*id="([A-Za-z0-9_]+)"[^>]*>([^<]*)</g)) {
    const [, id, label] = m;
    if (!/Пауза|Выход|Назад|←/.test(label)) continue;
    // globalBackBtn обрабатывается через переменную backBtn в fants-timer.js
    if (id === 'globalBackBtn') continue;
    if (!wired.has(id)) deadButtons.push(`${id} («${label.trim()}»)`);
  }
  // Ни одна функция выхода не должна переключать экраны вручную в обход
  // exitGame(): именно из-за этого выход в каждой игре вёл по-своему и
  // «перепрыгивал» уровень настройки. Исключения — режимы экрана #game
  // (Фанты/видео/davay/placeholder): у них своя логика, они возвращаются
  // в конкретное меню и в exitGame не ходят.
  const bypass = [];
  for (const f of fs.readdirSync(gamesDir)) {
    const src = read(path.join('games', f));
    const fnRe = /^function (exit[A-Za-z]*Game)\s*\([^)]*\)\s*\{[\s\S]*?\n\}/gm;
    let m;
    while ((m = fnRe.exec(src))) {
      const [body, name] = [m[0], m[1]];
      if (f === 'fants-davay.js' || f === 'fants-video.js') continue;
      const switchesManually =
        /classList\.add\('active'\)/.test(body) && !/exitGame\s*\(/.test(body);
      if (switchesManually) bypass.push(`${f}:${name}`);
    }
  }
  check(
    'выходы не переключают экраны в обход exitGame()',
    bypass.length === 0,
    `переключают вручную: ${bypass.join(', ')}`
  );

  check(
    'у каждой кнопки «Пауза»/«Выход» есть обработчик',
    deadButtons.length === 0,
    `без обработчика: ${deadButtons.join(', ')}`
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// 9. Стили
// ─────────────────────────────────────────────────────────────────────────────
function checkStyles(html) {
  group('Стили');
  const cssPath = 'styles/app.css';

  // CSS вынесен из index.html в отдельный файл: так index.html стал вдвое
  // меньше, а стили кэшируются браузером независимо от разметки.
  check(`${cssPath} существует`, exists(cssPath), 'файл стилей не найден');

  const linked = /<link[^>]+href="styles\/app\.css/.test(html);
  check('стили подключены из index.html', linked, 'нет <link href="styles/app.css">');

  const versioned = /styles\/app\.css\?v=\d{8}[a-z]/.test(html);
  check('у стилей проставлена версия ?v=', versioned, 'link без ?v= — кэш не обновится');

  // Внутри index.html не должно остаться инлайновых <style>: иначе стили
  // разъедутся по двум местам, и правка одного не подействует.
  const inline = (html.match(/<style[\s>]/g) || []).length;
  check('нет инлайновых <style> в index.html', inline === 0, `найдено блоков: ${inline}`);

  if (exists(cssPath)) {
    const css = read(cssPath);
    const open = (css.match(/\{/g) || []).length;
    const close = (css.match(/\}/g) || []).length;
    check(`баланс скобок в CSS (${open}/${close})`, open === close, `разница ${open - close}`);

    // Незакрытый комментарий «съедает» все правила до следующего */.
    const openC = (css.match(/\/\*/g) || []).length;
    const closeC = (css.match(/\*\//g) || []).length;
    check('нет незакрытых комментариев в CSS', openC === closeC, `/* : ${openC}, */ : ${closeC}`);
  }

  // Service Worker обязан обновлять стили сразу, а не «со второй загрузки»:
  // при stale-while-revalidate устройство отдаёт старый CSS и правки
  // внешнего вида не видны — этот баг уже ловили на игровых скриптах.
  const sw = read('sw.js');
  const cssIsFresh = /startsWith\('\/styles\/'\)/.test(sw);
  check('SW грузит стили network-first', cssIsFresh, "в sw.js нет ветки для '/styles/'");
  // Навигационные маркеры: перед каждой секцией стоит комментарий с путём
  // к файлу логики. Это позволяет найти код игры, не читая весь index.html
  // (файл на 4000+ строк). Проверяем, что маркер не врёт.
  const htmlLines = html.split('\n');
  const wrongMarkers = [];
  let markerCount = 0;
  for (let i = 0; i < htmlLines.length - 1; i++) {
    const m = htmlLines[i].match(/логика: games\/([a-z0-9-]+\.js)/);
    const sec = htmlLines[i + 1].match(/<section id="([^"]+)"/);
    if (!m || !sec) continue;
    markerCount++;
    if (m[1] === 'core.js') continue; // ядро содержит общие экраны
    if (!exists('games/' + m[1])) { wrongMarkers.push(`${sec[1]}: файла games/${m[1]} нет`); continue; }
    if (!read('games/' + m[1]).includes(sec[1])) {
      wrongMarkers.push(`${sec[1]} → указан games/${m[1]}, но id там не упоминается`);
    }
  }
  check(
    `маркеры секций указывают верный файл (${markerCount})`,
    wrongMarkers.length === 0,
    wrongMarkers.join('\n      ')
  );

  // Вызовы методов serviceWorker по имени: опечатка здесь падает в рантайме
  // и (если стоит в <head>) ломает запуск. Уже ловили getControllers() вместо
  // getRegistrations() — метод, которого не существует.
  const SW_METHODS = ['register', 'getRegistrations', 'getRegistration', 'ready', 'controller', 'addEventListener', 'unregister', 'update'];
  const badSwCalls = [];
  for (const file of ['index.html', ...fs.readdirSync(path.join(ROOT, 'games')).map((f) => path.join('games', f))]) {
    const src = read(file);
    const inHtml = file.endsWith('.html');
    let insideHtmlComment = false;
    src.split('\n').forEach((line, i) => {
      // В HTML комментарии заключаются в <!-- -->, в JS — в // или /* */.
      // Упоминать несуществующий метод в пояснении допустимо (мы как раз
      // описываем исправленный баг), а вызывать — нет.
      const trimmed = line.trim();
      const inComment = inHtml
        ? (insideHtmlComment || trimmed.startsWith('<!--') || trimmed.startsWith('//'))
        : (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*'));
      if (inHtml) {
        if (trimmed.startsWith('<!--')) insideHtmlComment = true;
        if (trimmed.includes('-->')) insideHtmlComment = false;
      }
      if (inComment) return;
      const m = line.match(/(?:navigator\.)?serviceWorker\.(\w+)\s*\(/);
      if (m && !SW_METHODS.includes(m[1])) {
        badSwCalls.push(`${file}:${i + 1} — serviceWorker.${m[1]}()`);
      }
    });
  }
  check(
    'вызовы методов serviceWorker корректны',
    badSwCalls.length === 0,
    `неизвестные методы: ${badSwCalls.join(', ')}`
  );

  // Приложение не должно снимать регистрацию Service Worker при загрузке:
  // иначе офлайн-режим не работает никогда. Принудительное обновление делает
  // hardUpdateApp по действию игрока.
  const bootUnregister = /^\s*navigator\.serviceWorker\.getRegistrations\(\)[\s\S]{0,200}?unregister\(\)/m.test(html);
  check(
    'SW не снимается автоматически при загрузке',
    !bootUnregister,
    'при старте вызывается getRegistrations().unregister() — офлайн перестанет работать'
  );

  // Название игры закреплено на одном уровне с FAB-кнопками «←» и «☰».
  // Раньше стояло top:0 — в PWA на iPhone заголовок уходил под Dynamic
  // Island (модуль камеры), на Android — под строку статуса.
  //
  // Система координат (здесь ошибались уже трижды, поэтому проверяем явно):
  // заголовок — absolute ВНУТРИ #app, но у absolute-потомка top отсчитывается
  // от PADDING-КРАЯ #app: padding-top #app (max(16px, env(safe-area-inset-top)))
  // его НЕ сдвигает. Значит:
  //   • position:fixed — ошибка: top считается от вьюпорта, и на desktop
  //     заголовок разъедется с кнопками, привязанными к колонке #app;
  //   • top:12px без safe-area — ошибка (этот баг и вернулся): в установленной
  //     PWA на iPhone заголовок снова оказывался под камерой, на safe-area
  //     выше кнопок, а безопасный зазор давала только переменная — под
  //     названием оставалась пустая полоса;
  //   • top:calc(12px + env(safe-area-inset-top)) — то же самое, ЧТО у
  //     FAB-кнопок (они fixed с той же формулой), это и есть правильная линия.
  // Компенсирует добавку safe-area переменная --screen-top-pad (см. проверки
  // ниже): контент экрана должен подниматься на столько же, иначе между
  // названием и контентом вырастает полоса.
  const css = read('styles/app.css');
  const labelRule = css.match(/\.game-level-label\{([\s\S]*?)\}/);
  check('правило .game-level-label есть в CSS', !!labelRule, 'не найдено');
  if (labelRule) {
    const body = labelRule[1];
    check(
      'заголовок в системе координат #app (position:absolute, не fixed)',
      /position:\s*absolute/.test(body),
      'position:fixed — top считается от вьюпорта, заголовок разъедется с кнопками и контентом'
    );
    check(
      'top заголовка учитывает safe-area (линия FAB-кнопок)',
      /top:\s*calc\(12px\s*\+\s*env\(safe-area-inset-top/.test(body),
      'top без env(safe-area-inset-top): в PWA заголовок уйдёт под камеру и встанет выше кнопок «←»/«☰»'
    );
    check(
      'top заголовка не прибит к самому верху (нет top:0 / top:12px)',
      !/(?:top:\s*0\s*;)|(?:top:\s*12px\s*;)/.test(body),
      'top:0 или top:12px без safe-area — перекроется модулем камеры на iPhone'
    );
    // Боковые отступы должны быть не меньше, чем кнопка (12px) + её ширина
    // (36px) + зазор, иначе текст налезет на «←» или «☰».
    const padMatch = body.match(/padding:\s*0\s+(\d+)px/);
    check(
      'боковые отступы не дают тексту налезть на кнопки',
      !!padMatch && Number(padMatch[1]) >= 50,
      `padding ${padMatch ? padMatch[1] : '?'}px — нужно ≥50px (кнопка занимает 48px)`
    );
  }
  // На desktop заголовок привязан к колонке #app (max-width 480px), иначе
  // текст окажется по центру окна, а не по центру приложения.
  check(
    'заголовок выровнен по колонке #app на desktop',
    /@media \(min-width:\s*640px\)\{[\s\S]{0,400}?\.game-level-label/.test(css),
    'нет desktop-правила — текст сместится относительно кнопок'
  );
  // Метка хода (.td-turn-label) стоит в той же верхней полосе и в той же
  // системе координат — иначе название игры и ход окажутся на разной высоте.
  const turnRule = css.match(/\.td-turn-label:first-child\{([\s\S]*?)\}/);
  check('правило .td-turn-label:first-child есть в CSS', !!turnRule, 'не найдено');
  if (turnRule) {
    check(
      'метка хода в системе координат #app (position:absolute)',
      /position:\s*absolute/.test(turnRule[1]),
      'метка хода должна быть absolute — как название игры и кнопки'
    );
    check(
      'top метки хода учитывает safe-area (линия названия игры)',
      /top:\s*calc\(12px\s*\+\s*env\(safe-area-inset-top/.test(turnRule[1]),
      'top метки без env(safe-area-inset-top): в PWA ход окажется выше названия игры'
    );
  }
  // Отступ контента игровых экранов задан одной переменной, а не подогнанными
  // вручную 48/50/56px — из-за них и появлялась пустая полоса под названием.
  //
  // Формула переменной обязана учитывать ДВЕ вещи, и обе уже ломались:
  //   • safe-area: в установленной PWA закреплённая строка уезжает вниз на её
  //     высоту (47px), и отступ контента должен вырасти на столько же;
  //   • appPad (max(16px, safe-area)), который .screen получает просто потому,
  //     что лежит в content-боксе #app — без этого вычитания в браузере
  //     оставались лишние 16px полосы.
  // Итог: min(56px, calc(40px + env(safe-area-inset-top))) — 40px в браузере,
  // 56px в PWA; зазор под названием в обоих случаях ровно 8px.
  check(
    'отступ игровых экранов задан переменной --screen-top-pad',
    /--screen-top-pad:/.test(css),
    'нет --screen-top-pad — отступы снова разъедутся с названием'
  );
  check(
    '--screen-top-pad учитывает safe-area и appPad',
    /--screen-top-pad:\s*min\(56px,\s*calc\(40px\s*\+\s*env\(safe-area-inset-top/.test(css),
    'формула переменной неверна: в PWA под названием игры вырастет пустая полоса (нужно min(56px, calc(40px + env(safe-area-inset-top))))'
  );
  const padHardcode = css.match(/\.screen[^{]*\{[^}]*padding-top:\s*(?:48|50)px/);
  check(
    'в отступах экранов нет захардкоженных 48/50px',
    !padHardcode,
    `найден padding-top ${padHardcode ? padHardcode[0].match(/(\d+)px/)[1] : '?'}px вместо var(--screen-top-pad)`
  );
  // Строка счёта «Парень: 0 / Девушка: 0» — от базовых «Фантов». В режимах,
  // где соревнования нет, она висеть не должна: в «Видеорулетке» игроки
  // смотрят ролики вместе (очки только обнуляются), в «Предложи партнёру»
  // счёта нет вовсе.
  const scoreHidden = (mode) =>
    new RegExp(`#game\\.${mode}\\s+#gameScoreRow\\s*\\{[^}]*display:\\s*none`).test(css);
  check('счёт скрыт в «Видеорулетке» (нет соревнования)', scoreHidden('video-mode'),
    'строка «Парень: 0 / Девушка: 0» останется висеть в видеорежиме');
  check('счёт скрыт в «Предложи партнёру»', scoreHidden('placeholder-mode'),
    'счёт не должен показываться в «Предложи партнёру»');
  // В «Давай попробуем» счёт тоже не ведётся, но там свои имена игроков и
  // шкала прогресса — проверяем, что их не скрыли заодно.
  const rowHidden = (sel) =>
    new RegExp(`${sel}\\s*\\{[^}]*display:\\s*none`).test(css);
  check('в «Давай попробуем» свои имена игроков сохранены',
    !new RegExp(`#game\\.davay-mode\\s+#davayPlayerRow\\s*\\{[^}]*display:\\s*none`).test(css),
    '#davayPlayerRow скрыт — игроки не увидят, чей ход');
  check('в «Давай попробуем» шкала прогресса сохранена',
    !new RegExp(`#game\\.davay-mode\\s+#davayProgressRow\\s*\\{[^}]*display:\\s*none`).test(css),
    '#davayProgressRow скрыт — пропадёт прогресс партии');
  check('базовые «Фанты» не потеряли строку счёта',
    !new RegExp(`#game\\s+#gameScoreRow\\s*\\{[^}]*display:\\s*none`).test(css),
    'счёт скрыт для всего #game — в «Фантах» он нужен');
  // Кнопки «Пауза»/«Выход» в «Видеорулетке» и «Давай попробуем» убраны — их
  // заменяет стрелка «←» в шапке. Кнопка живёт в списке селекторов через
  // запятую, поэтому проверяем правило целиком, а не подстроку.
  const pauseHidden = (mode) => {
    const re = /([^{}]*#pauseBtn[^{}]*)\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(css))) {
      if (m[1].includes(`#game.${mode}`) && /display:\s*none/.test(m[2])) return true;
    }
    return false;
  };
  check('кнопка «Пауза»/«Выход» скрыта в «Видеорулетке»', pauseHidden('video-mode'),
    'кнопка осталась — в видеорежиме её заменяет стрелка «←»');
  check('кнопка «Пауза» скрыта в «Давай попробуем»', pauseHidden('davay-mode'),
    'кнопка осталась — выход/пауза работает по стрелке «←»');
  // Стрелка «←» обязана сама разбирать davay-режим: без этой ветки режим
  // проваливался в общую логику паузы, а экран #game принадлежит «Фантам» —
  // игрок попадал в чужое меню паузы, и прогресс партии не сохранялся.
  //
  // ВАЖНО: искать по всему файлу нельзя. Те же имена (isDavayMode,
  // pauseDavayGame, davayFavoritesOnly) есть и в обработчике кнопки
  // «Пауза»/«Выход», поэтому поиск по файлу находил бы их и считал проверку
  // пройденной даже после удаления ветки из обработчика стрелки. Берём тело
  // именно обработчика стрелки — от регистрации backBtn до конца колбэка.
  const timerSrc = read('games/fants-timer.js');
  const backStart = timerSrc.indexOf("backBtn.addEventListener('click'");
  const backEnd = timerSrc.indexOf('getActiveGameScreenIds()', backStart);
  const backBody = (backStart > -1 && backEnd > backStart)
    ? timerSrc.slice(backStart, backEnd)
    : '';
  check('обработчик стрелки «←» найден в fants-timer.js', backBody.length > 0,
    'не найден backBtn.addEventListener или общая логика паузы');
  check('стрелка «←» обрабатывает режим «Давай попробуем» отдельной веткой',
    /isDavayMode\(\)/.test(backBody) && /pauseDavayGame/.test(backBody),
    'нет ветки isDavayMode() → pauseDavayGame: игрок попадёт в паузу «Фантов»');
  check('«←» в избранном «Давай попробуем» выходит, а не ставит на паузу',
    /davayFavoritesOnly[\s\S]{0,200}?exitDavayGame/.test(backBody),
    'просмотр избранного не выходит по стрелке «←»');
  // Ветка должна стоять в обработчике ДО общей логики паузы: иначе сработает
  // чужая пауза «Фантов». backBody обрезан по началу общей логики, поэтому
  // наличие вызова внутри него и означает «до».
  check('ветка «Давай попробуем» идёт до общей логики паузы',
    /pauseDavayGame/.test(backBody)
      && backBody.indexOf('pauseDavayGame') < backBody.length,
    'ветка стоит после общей логики — сработает чужая пауза «Фантов»');
  // Название уровня «Викторины» (пары): игра и так помечена 18+, поэтому
  // приписка в названии уровня лишняя и не влезала в строку.
  const quizCards = read('cards/cards_quiz.js');
  const quizLevels = quizCards.match(/const QUIZ_LEVELS = \[([\s\S]*?)\];/);
  check('QUIZ_LEVELS найден в cards_quiz.js', !!quizLevels, 'не найден список уровней');
  if (quizLevels) {
    check('уровень «Викторины» называется «Откровенно»',
      /name:\s*'Откровенно'/.test(quizLevels[1]),
      'название уровня 4 не совпадает — ожидалось «Откровенно»');
    check('в названии уровня «Викторины» нет приписки «18+»',
      !/Откровенно 18\+/.test(quizLevels[1]),
      '«18+» вернулось в название уровня — игра и так помечена 18+');
  }
  // «Давай попробуем» перешла на свой список уровней (было 4, стало 6) и
  // перестала брать их из общего LEVELS, которым живут «Фанты». Проверяем в
  // источнике данных: раньше здесь искали строку «Откровенно 18+» по всему
  // index.html — теперь её нет ни в разметке, ни в правилах игры.
  const davaySrc = read('games/fants-davay.js');
  const davayLevelsBlock = davaySrc.match(/const DAVAY_LEVELS = \[([\s\S]*?)\];/);
  check('у «Давай попробуем» свой список уровней DAVAY_LEVELS',
    !!davayLevelsBlock,
    'нет DAVAY_LEVELS — уровни снова берутся из общего LEVELS');
  if(davayLevelsBlock){
    const names = [...davayLevelsBlock[1].matchAll(/name:'([^']+)'/g)].map((m) => m[1]);
    const expected = ['Ласки', 'Близость', 'Ртом', 'Игрушки', 'Сзади', 'Экзотика'];
    check('в «Давай попробуем» ровно 6 уровней', names.length === 6,
      `найдено ${names.length}: ${names.join(', ')}`);
    check('названия уровней «Давай попробуем» совпадают с задуманными',
      expected.every((n, i) => names[i] === n),
      `получено: ${names.join(', ')}`);
    const ids = [...davayLevelsBlock[1].matchAll(/id:(\d+)/g)].map((m) => Number(m[1]));
    check('уровни «Давай попробуем» пронумерованы 1..6',
      ids.join(',') === '1,2,3,4,5,6',
      `получено: ${ids.join(',')}`);
  }
  // Раньше уровень игрока хранился как id общего LEVELS (3..6), а уровень
  // видео считался как «id - 2». Теперь это одно и то же число: если вернуть
  // вычитание, игра будет искать видео не в том уровне.
  check('уровень «Давай попробуем» больше не пересчитывается через «-2»',
    !/davaySelectedLevel[^\n]*-\s*2/.test(davaySrc),
    'вернулся пересчёт «state.davaySelectedLevel - 2» — уровни игрока и видео разойдутся');
  check('потолок уровней «Давай попробуем» берётся из DAVAY_LEVELS',
    /const DAVAY_MAX_LEVEL = DAVAY_LEVEL_MAX;/.test(davaySrc),
    'DAVAY_MAX_LEVEL снова захардкожен — кнопка «Горячее» упрётся в старое число');
  // Кнопки в модалках импорта — те же шесть уровней с теми же названиями.
  const davayHtml = read('index.html');
  const choices = [...davayHtml.matchAll(/davay-level-choice" data-level="(\d)">([^<]+)</g)]
    .map((m) => m[2].trim());
  check('в модалке импорта видео 6 кнопок уровней', choices.length === 6,
    `найдено кнопок: ${choices.length}`);
  check('кнопки уровней названы словами, а не цифрами',
    choices.every((c) => /[А-Яа-я]/.test(c)),
    `получено: ${choices.join(', ')}`);
  // Номера кнопок в разметке обязаны совпадать с id уровней в DAVAY_LEVELS.
  // Это защита от расхождения номеров: уровни были перенумерованы, и
  // незамеченная кнопка со старым номером молча клала бы видео в чужой
  // уровень (а при номере вне списка — вообще в несуществующий, и «Начнём»
  // требовала бы добавить видео).
  const choiceIds = [...davayHtml.matchAll(/davay-level-choice" data-level="(\d+)">([^<]+)</g)]
    .map((m) => ({ id: Number(m[1]), label: m[2].trim() }));
  const levelById = new Map();
  (davayLevelsBlock ? davayLevelsBlock[1] : '').replace(
    /\{id:(\d+),\s*name:'([^']+)'/g,
    (_, id, lname) => { levelById.set(Number(id), lname); return ''; }
  );
  check('номера кнопок импорта совпадают с уровнями DAVAY_LEVELS',
    choiceIds.length > 0 && choiceIds.every((c) => levelById.get(c.id) !== undefined),
    `кнопки: ${choiceIds.map((c) => c.id).join(',')} | уровни: ${[...levelById.keys()].join(',')}`);
  check('подписи кнопок импорта совпадают с названиями уровней',
    choiceIds.every((c) => c.label.includes(levelById.get(c.id))),
    choiceIds.map((c) => `${c.id}: «${c.label}» ≠ «${levelById.get(c.id)}»`).join('; '));
  // Счёт «Парень: 0 / Девушка: 0» в «Давай попробуем» не ведётся — он висел
  // над карточкой с нулями. Имена игроков и шкала прогресса остаются.
  check('счёт скрыт в «Давай попробуем»', scoreHidden('davay-mode'),
    'строка «Парень: 0 / Девушка: 0» снова висит в «Давай попробуем»');
  // Карточка-заглушка («нет видео уровня») должна стоять по центру карты.
  // Раньше её выравнивание перебивало правило карточки видео:
  // «#game.davay-mode .card .card-inner{align-items:stretch}» специфичнее
  // «.card-empty .card-inner», поэтому иконка и текст прижимались к левому
  // верхнему углу. Растяжение обязано остаться у карточки с плеером.
  {
    const stretchRule = css.search(
      /#game\.(?:video|davay)-mode \.card:not\(\.card-empty\) \.card-inner/);
    check('выравнивание карточки видео ограничено карточкой с плеером',
      stretchRule >= 0,
      'правило align-items:stretch бьёт по всем .card-inner подряд — заглушка не центрируется');
    const empties = [...css.matchAll(/([^{}]*\.card-empty[^{}]*\.card-inner[^{}]*)\{([^}]*)\}/g)];
    check('заглушка .card-empty выравнивается по центру',
      empties.some((m) => /align-items:\s*center/.test(m[2]) && /justify-content:\s*center/.test(m[2])),
      'нет правила с align-items:center для .card-empty .card-inner');
  }
  // Иконка заглушки «Давай попробуем» — символ игры (🎬, как в меню, заголовке
  // и menuTitle), а не игральная карта 🃏, и вдвое крупнее обычной пустой
  // карточки: 52px → 104px.
  {
    const src = read('games/fants-davay.js');
    check('заглушка «Давай попробуем» использует иконку игры 🎬',
      /card-inner"><div class="card-icon">🎬<\/div>/.test(src),
      'в заглушке осталась/вернулась чужая иконка вместо 🎬');
    const bigIcon = /#game\.davay-mode \.card-empty \.card-icon\{[^}]*font-size:\s*104px/.test(css);
    const baseIcon = /\.card-empty \.card-icon\{[^}]*font-size:\s*52px/.test(css);
    check('иконка заглушки «Давай попробуем» вдвое крупнее обычной',
      bigIcon && baseIcon,
      `крупная иконка: ${bigIcon}, базовая 52px: ${baseIcon} — ожидалось 104px против 52px`);
  }
  // Плашки уровней в «Давай попробуем» ниже на 30% (56 → 39px): шесть
  // уровней прежнего размера выдавливали кнопки запуска за экран.
  check('плашки уровней «Давай попробуем» ниже общего размера',
    /#davaySetup \.level-toggle\{[^}]*min-height:\s*39px/.test(css),
    'нет правила #davaySetup .level-toggle — высота плашек не уменьшена');
  check('размер плашек «Фантов» и «Предложи партнёру» не тронут',
    !/^[^#\n]*\.level-toggle\{[^}]*min-height:\s*39px/m.test(css.replace(/#davaySetup[^{]*\{[^}]*\}/g, '')),
    'высота уменьшена для всех .level-toggle — пострадали другие игры');
  // Высоту плашки задаёт не только min-height: если содержимое выше, плашка
  // растягивается по нему. При старых шрифтах она оставалась 42px — минус 26%
  // вместо заявленных 30%. Считаем высоту по фактическим правилам CSS, чтобы
  // «-30%» нельзя было потерять незаметно при правке шрифтов.
  const declNum = (block, prop) => {
    const m = new RegExp(prop + ':\\s*([\\d.]+)px').exec(block);
    return m ? parseFloat(m[1]) : null;
  };
  // anchor=true требует, чтобы селектор начинал правило, а не был хвостом
  // другого: «.btn» без привязки совпадает внутри «.btn-square»/«.btn-pause».
  const ruleFor = (selector, anchor) => {
    const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
    const prefix = anchor ? '(?:^|[\\s,}])' : '';
    const m = new RegExp(prefix + esc + '\\s*\\{([^}]*)\\}').exec(css);
    return m ? m[1] : '';
  };
  const baseName = ruleFor('.level-toggle .lname');
  const baseDesc = ruleFor('.level-toggle .ldesc');
  const baseTile = ruleFor('.level-toggle');
  const davayTile = ruleFor('#davaySetup .level-toggle');
  const davayName = ruleFor('#davaySetup .level-toggle .lname');
  const davayDesc = ruleFor('#davaySetup .level-toggle .ldesc');
  // Высота = max(min-height, содержимое), где содержимое — две строки текста,
  // отступ между ними и вертикальные padding. line-height в проекте задан не
  // везде, для незаданного берём браузерные 1.2.
  const tileHeight = (tile, lname, ldesc) => {
    const padY = declNum(tile, 'padding') !== null ? declNum(tile, 'padding') : 8;
    const minH = declNum(tile, 'min-height') || 0;
    const nameH = declNum(lname, 'font-size') * (declNum(lname, 'line-height') || 1.2);
    const descH = declNum(ldesc, 'font-size') * (declNum(ldesc, 'line-height') || 1.3);
    const gap = declNum(ldesc, 'margin-top') || 0;
    return Math.max(minH, nameH + gap + descH + padY * 2);
  };
  const baseH = tileHeight(baseTile, baseName, baseDesc);
  const davayH = tileHeight(davayTile, davayName, davayDesc);
  check('высота плашек «Давай попробуем» действительно на 30% меньше',
    baseH > 0 && davayH <= baseH * 0.7 + 0.5,
    `базовая ${baseH.toFixed(1)}px (padding ${declNum(baseTile, 'padding')}px), ` +
    `в «Давай попробуем» ${davayH.toFixed(1)}px (padding ${declNum(davayTile, 'padding')}px) — ` +
    `снижение ${(((baseH - davayH) / baseH) * 100).toFixed(1)}%, ожидалось ≥30%`);
  // Блоки «Парень»/«Девушка» над карточкой в «Давай попробуем» — ниже обычной
  // кнопки на 30%. Они только показывают, кто отвечает, а высоту базовой
  // кнопки (padding 15px ×2 + 17px текста ≈ 51px) тратили зря. Как и с
  // плашками уровней, высоту мало объявить — содержимое может распирать
  // плашку, поэтому считаем её по фактическим правилам CSS.
  // Базовую .btn ищем как САМОСТОЯТЕЛЬНОЕ правило (строка начинается с «.btn{»),
  // а не как хвост составного селектора: иначе первым находится
  // «#addCardModal .btn{...}» и сравнение идёт с чужой кнопкой. Смотрим CSS без
  // @media-блоков — там те же селекторы переопределены для узкой ориентации.
  const cssNoMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '');
  const davayPlayerBtn = (/(?:^|\n)\s*\.davay-player-row\s+\.btn\s*\{([^}]*)\}/.exec(cssNoMedia) || ['', ''])[1];
  const baseBtn = (/(?:^|\n)\s*\.btn\s*\{([^}]*)\}/.exec(cssNoMedia) || ['', ''])[1];
  const boxHeight = (block, text) => {
    const explicit = declNum(block, 'height');
    if (explicit !== null) {
      // Явная height + борта: содержимое уже не распирает (line-height:1).
      return explicit + 2;
    }
    const padY = declNum(block, 'padding') || 0;
    const font = declNum(block, 'font-size') || 0;
    const lh = declNum(block, 'line-height') || 1.2;
    return Math.max(padY * 2 + font * lh, declNum(block, 'min-height') || 0) + 2;
  };
  const baseBtnH = baseBtn ? boxHeight(baseBtn) : 0;
  const davayPlayerH = davayPlayerBtn ? boxHeight(davayPlayerBtn) : 0;
  check('блоки «Парень»/«Девушка» ниже обычной кнопки на 30%',
    baseBtnH > 0 && davayPlayerH > 0 && davayPlayerH <= baseBtnH * 0.7 + 0.5,
    davayPlayerBtn
      ? `обычная кнопка ${baseBtnH.toFixed(1)}px, блок игрока ${davayPlayerH.toFixed(1)}px — ` +
        `снижение ${(((baseBtnH - davayPlayerH) / baseBtnH) * 100).toFixed(1)}%, ожидалось ≥30%`
      : 'нет правила .davay-player-row .btn — высота блоков игроков не уменьшена');
  check('уменьшение не задело обычные кнопки игры',
    baseBtn ? /font-size:17px/.test(baseBtn) : false,
    'базовая .btn изменилась — правка блоков игроков не должна трогать остальные кнопки');
  check('в «Рулетке желаний» уровень «Откровенно 18+» сохранён',
    /Откровенно 18\+/.test(read('games/wish-roulette.js')),
    'в «Рулетке желаний» название уровня пропало');
  // Название игры должно быть оформлено общим стилем .game-level-label, а не
  // имитацией через .td-turn-label с подогнанным шрифтом: в «Фантах» название
  // режима так и рисовали (font-size:28px вместо 26px + вес 800 + интервал),
  // и заголовок выбивался из общего стиля.
  check(
    'название игры не имитируется увеличенной меткой хода',
    !/\.td-turn-label\{[^}]*font-size:\s*(?:2[0-9]|3[0-9])px/.test(css),
    'крупный шрифт у .td-turn-label — название игры должно идти через .game-level-label'
  );
  // «Фанты» (двоих) показывают название режима в #gameLevelLabel — без этого
  // заголовок остаётся пустым, и режим виден только мелкой меткой хода.
  const core = readCore();
  check(
    '«Фанты» заполняют заголовок игры названием режима',
    /gameLevelLabel/.test(core) && /💘 Фанты/.test(core),
    'название режима «Фантов» не попадает в #gameLevelLabel'
  );
  check(
    '«Фанты» показывают оба режима в заголовке',
    /❓ Правда\/Действие/.test(core),
    'режим «Правда/Действие» не выводится как название игры'
  );
  // updateLevelUI вызывается после updateTurnUI и раньше безусловно гасил
  // заголовок — название игры из-за этого пропадало.
  check(
    'updateLevelUI не гасит заголовок игрового экрана',
    /gameScreenHasTitle\(\)/.test(core) && /levelLabel && !gameScreenHasTitle\(\)/.test(core),
    'заголовок гасится безусловно — название игры пропадёт'
  );
  // Экран #game обслуживает четыре игры, и у каждой должно быть своё название
  // в общем заголовке: раньше режимы видео/davay заголовок просто скрывали,
  // и игрок не видел, в какой из двух игр находится.
  // Проверяем именно ВОЗВРАТ названия из gameScreenTitle(): текст в
  // комментарии или в разметке не должен засчитываться за рабочую логику.
  const titleFn = core.match(/function gameScreenTitle\(\)\{([\s\S]*?)\n\}/);
  check('gameScreenTitle() возвращает название «Видеорулетки»',
    !!titleFn && /video-mode'\)\)\s*return\s*'🎥 Видеорулетка'/.test(titleFn[1]),
    'в gameScreenTitle() нет return «🎥 Видеорулетка» — в видеорежиме название не покажется'
  );
  check('gameScreenTitle() возвращает название «Давай попробуем»',
    !!titleFn && /davay-mode'\)\)\s*return\s*'🎬 Давай попробуем'/.test(titleFn[1]),
    'в gameScreenTitle() нет return «🎬 Давай попробуем»'
  );
  check('gameScreenTitle() возвращает названия «Фантов»',
    !!titleFn && /💘 Фанты/.test(titleFn[1]) && /❓ Правда\/Действие/.test(titleFn[1]),
    'gameScreenTitle() не различает режимы «Фантов»'
  );
  check(
    'заголовок экрана #game выбирается по режиму одним местом',
    /function gameScreenTitle\(\)/.test(core),
    'нет gameScreenTitle() — логика заголовков снова разъедется по функциям'
  );
  // «Предложи партнёру» (placeholder) использует тот же .game-level-label для
  // уровня — название игры не должно его подменять.
  check(
    'название игры не подменяет уровень в «Предложи партнёру»',
    /placeholder-mode'\)\)?\s*return null/.test(core),
    'placeholder-режим не исключён из gameScreenTitle() — уровень пропадёт'
  );

}


// ─────────────────────────────────────────────────────────────────────────────
// 10. Защита от ошибок
// ─────────────────────────────────────────────────────────────────────────────
function checkErrorGuard(html) {
  group('Защита от ошибок');
  const core = readCore();

  // Приложение должно показывать понятный экран, а не «залипать» молча.
  const handlers = [
    ["window.addEventListener('error'", 'перехват синхронных ошибок'],
    ["window.addEventListener('unhandledrejection'", 'перехват отказов промисов'],
  ];
  for (const [needle, what] of handlers) {
    check(what, core.includes(needle), 'нет обработчика — ошибка уйдёт пользователю молча');
  }

  // Экран ошибки: все элементы должны быть в разметке, иначе обработчик
  // не сможет его показать (и это выяснится только в момент сбоя).
  const required = ['appErrorModal', 'appErrorText', 'appErrorReloadBtn', 'appErrorReportBtn', 'appErrorCloseBtn'];
  const absent = required.filter((id) => !html.includes(`id="${id}"`));
  check(`разметка экрана ошибки (${required.length} элементов)`, absent.length === 0, `нет: ${absent.join(', ')}`);

  // Журнал ошибок нужен для отчёта: без него игрок сообщит только «не работает».
  for (const fn of ['logAppError', 'getErrorLog', 'buildErrorReport', 'clearErrorLog']) {
    check(`функция ${fn} объявлена`, new RegExp(`function\\s+${fn}\\s*\\(`).test(core), 'не найдена');
  }

  // Журнал должен очищаться вместе с прогрессом — иначе после сброса
  // в отчёт попадут ошибки прошлых сессий.
  check('журнал очищается при сбросе прогресса', /clearErrorLog\(\)/.test(core), 'performFullReset не чистит журнал');

  // Версия сборки нужна в отчёте, чтобы понять, на какой версии сбой.
  check('APP_BUILD объявлен в index.html', /window\.APP_BUILD\s*=/.test(html), 'нет версии сборки');
}


// ─────────────────────────────────────────────────────────────────────────────
// 11. Версионирование сохранений
// ─────────────────────────────────────────────────────────────────────────────
function checkSchemaVersioning() {
  group('Версии сохранений');
  const core = readCore();

  // Без версии схемы невозможно безопасно менять структуру state: у игроков
  // останутся сохранения старого формата, и они сломаются молча.
  check('SCHEMA_VERSION объявлен', /const SCHEMA_VERSION\s*=\s*\d+/.test(core), 'нет константы версии схемы');
  check('MIGRATIONS объявлен', /const MIGRATIONS\s*=\s*\{/.test(core), 'нет таблицы миграций');
  check('applyMigrations объявлена', /function\s+applyMigrations\s*\(/.test(core), 'нет функции миграций');

  // Миграции обязаны вызываться из loadState — иначе они мертвы.
  check('applyMigrations вызывается в loadState', /applyMigrations\(s\)/.test(core), 'loadState не применяет миграции');

  const version = core.match(/const SCHEMA_VERSION\s*=\s*(\d+)/);
  if (version) {
    const v = Number(version[1]);
    // Для каждого номера от 1 до SCHEMA_VERSION должен быть шаг — иначе
    // игрок с версии N не сможет доехать до текущей.
    const steps = [...core.matchAll(/MIGRATIONS\[(\d+)\]\s*=/g)].map((m) => Number(m[1]));
    const missing = [];
    for (let i = 1; i <= v; i++) if (!steps.includes(i)) missing.push(i);
    check(
      `для каждой версии есть шаг миграции (1..${v})`,
      missing.length === 0,
      `нет шагов для версий: ${missing.join(', ')}`
    );
  }

  // Версия схемы не должна сбрасываться в 0: иначе после «Сбросить прогресс»
  // миграции пройдут повторно и вернут сброшенные значения.
  const reset = core.slice(core.indexOf('function performFullReset'));
  const resetBody = reset.slice(0, reset.indexOf('\n}'));
  check(
    'сброс прогресса сохраняет текущую версию схемы',
    /schemaVersion\s*=\s*SCHEMA_VERSION/.test(resetBody),
    'performFullReset не выставляет SCHEMA_VERSION'
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// 12. Статистика
// ─────────────────────────────────────────────────────────────────────────────
function checkStats(html) {
  group('Статистика');
  const path = 'games/stats.js';
  if (!exists(path)) {
    check('games/stats.js существует', false, 'модуль статистики не найден');
    return;
  }
  const stats = read(path);

  check('модуль подключён в index.html', /games\/stats\.js/.test(html), 'нет <script src="games/stats.js">');
  check('публичный интерфейс объявлен', /window\.AppStats\s*=/.test(stats), 'нет window.AppStats');

  // Статистика обязана быть локальной: любая отправка данных нарушила бы
  // обещание «данные не покидают устройство» из README.
  const netCalls = [...stats.matchAll(/\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/g)];
  check('статистика ничего не отправляет по сети', netCalls.length === 0,
    `найдены сетевые вызовы: ${netCalls.length}`);

  // Хранится отдельным ключом, а не в state: иначе попадёт в резервные копии
  // и в сброс прогресса, чего для счётчика не нужно.
  check('свой ключ localStorage', /couple-game-stats-v1/.test(stats), 'нет отдельного ключа');
  // Убираем и блочные, и строчные комментарии — в них упоминание state
  // допустимо (пояснение), а в коде оно означало бы связку с прогрессом.
  const statsCode = stats
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  check('данные вне state', !/\bstate\./.test(statsCode), 'модуль трогает state игрока');

  // Точки сбора: без них счётчик останется пустым.
  const core = readCore();
  const init = read('games/init.js');
  check('старт партии учитывается', /AppStats\.gameStart/.test(core), 'goToGame не отмечает старт');
  check('завершение партии учитывается', /AppStats\.gameFinish/.test(core), 'finishGameBtn не отмечает завершение');
  check('выход из партии учитывается', /AppStats\.gameExit/.test(core), 'exitGame не отмечает выход');
  check('открытие приложения учитывается', /AppStats\.markOpen/.test(init), 'init.js не отмечает открытие');

  // Экран статистики: все элементы должны быть в разметке.
  const required = ['statsModal', 'statsBody', 'statsExportBtn', 'statsToggleBtn', 'statsClearBtn'];
  const absent = required.filter((id) => !html.includes(`id="${id}"`));
  check(`разметка экрана статистики (${required.length} элементов)`, absent.length === 0, `нет: ${absent.join(', ')}`);

  check('кнопка в меню есть', html.includes('id="menuStatsBtn"'), 'нет кнопки «Статистика»');
  check('обработчик экрана есть', /function\s+renderStatsScreen\s*\(/.test(core), 'нет renderStatsScreen');
}


// ─────────────────────────────────────────────────────────────────────────────
// 13. Глобальные обработчики
// ─────────────────────────────────────────────────────────────────────────────
function checkGlobalHandlers(html) {
  group('Глобальные обработчики');
  const core = readCore();

  // Эти обработчики ловят события на уровне всего документа. Их случайное
  // удаление не даёт ошибки в консоли — просто пропадает поведение.
  // Реальный случай: правя клавишу «стрелка влево», ИИ удалил обработчик
  // клика по заблокированным настройкам (коммит f410151) — игрок перестал
  // получать подсказку, почему поле неактивно.
  const REQUIRED = [
    [/document\.addEventListener\('click'[\s\S]{0,400}?locked-settings/, 'подсказка при клике по заблокированным настройкам'],
    [/document\.addEventListener\('keydown'[\s\S]{0,300}?ArrowLeft/, 'клавиша «влево» = назад/пауза'],
    [/window\.addEventListener\('error'/, 'перехват ошибок'],
    [/window\.addEventListener\('unhandledrejection'/, 'перехват отказов промисов'],
  ];
  const missing = REQUIRED.filter(([re]) => !re.test(core)).map(([, name]) => name);
  check(
    `ключевые глобальные обработчики на месте (${REQUIRED.length})`,
    missing.length === 0,
    `отсутствуют: ${missing.join(', ')}`
  );

  // Класс locked-settings должен быть и в коде (навешивается), и в CSS
  // (стиль неактивности): если пропадёт одно, поведение станет непонятным.
  check('класс locked-settings навешивается', /locked-settings/.test(core), 'нет classList.toggle("locked-settings")');
  check('стиль locked-settings есть в CSS', /locked-settings/.test(read('styles/app.css')), 'нет правила .locked-settings');

  // Видеорулетка — режим ВНУТРИ базовой парной игры (#game). Если стрелка «←»
  // не обрабатывает его отдельно, срабатывает общая логика паузы «Фантов» и
  // игрок вместо меню попадает в их паузу. Баг уже случался дважды.
  const backHandler = core.slice(core.indexOf("backBtn.addEventListener('click'"));
  check(
    'выход из видеорежима обработан в кнопке «←»',
    /isVideoMode\(\)[\s\S]{0,200}?exitVideoGame\(\)/.test(backHandler),
    'нет ветки: стрелка «←» в видеорежиме уйдёт в паузу «Фантов»'
  );
  check(
    'exitVideoGame снимает паузу',
    /function exitVideoGame\(\)[\s\S]{0,600}?pausedMode\s*=\s*null/.test(core),
    'exitVideoGame не сбрасывает pausedMode — останется пауза «Фантов»'
  );

  // Игры без паузы (noPause) выходят по «←» через общий fallback. Там нужно
  // снимать и pausedMode, и inProgress: если оставить inProgress, в хабе
  // блокируются настройки (updateSettingsLockUI), хотя никакой партии нет.
  const fallback = core.slice(core.indexOf('// Fallback: для игр без dedicated pause-функции'));
  // Ищем и «else», и сброс флага рядом друг с другом, без опоры на точное
  // расстояние: между ними стоит поясняющий комментарий, и жёсткий лимит
  // символов делал проверку ложной.
  const hasElse = /\}else\s*\{|\}\s*else\s*\{/.test(fallback);
  const hasReset = /inProgress\s*=\s*false/.test(fallback);

  // core.js разделён на модули. Проверяем, что все вынесенные части
  // подключены: забытый скрипт в index.html даст ReferenceError в рантайме,
  // причём только при входе в конкретную игру — это дорого искать.
  const fantsParts = fs.readdirSync(path.join(ROOT, 'games')).filter((f) => /^fants-.*\.js$/.test(f));
  const unwired = fantsParts.filter((f) => !html.includes(`games/${f}`));
  check(
    `части core.js подключены (${fantsParts.length})`,
    unwired.length === 0,
    `не подключены в index.html: ${unwired.join(', ')}`
  );
  // Порядок: части идут после core.js (он объявляет state/утилиты) и до
  // game-registry.js (реестр опирается на функции паузы из этих файлов).
  const order = [...html.matchAll(/<script src="(games\/[^"?]+)/g)].map((m) => m[1]);
  const iCore = order.indexOf('games/core.js');
  const iReg = order.indexOf('games/game-registry.js');
  const badOrder = fantsParts.filter((f) => {
    const i = order.indexOf('games/' + f);
    return i < iCore || (iReg >= 0 && i > iReg);
  });
  check(
    'части core.js идут после core.js и до реестра',
    badOrder.length === 0,
    `нарушен порядок: ${badOrder.join(', ')}`
  );

  check(
    'fallback снимает inProgress для игр без паузы',
    hasElse && hasReset,
    hasElse
      ? 'в fallback нет сброса inProgress — в хабе заблокируются настройки'
      : 'в fallback нет ветки else: игры без паузы получат pausedMode'
  );
  const noPauseModes = [...read('games/game-registry.js').matchAll(/mode:\s*'([^']+)'[^}]*?noPause:\s*true/g)].map((m) => m[1]);
  check(
    `игры без паузы помечены noPause (${noPauseModes.length})`,
    noPauseModes.length >= 5,
    `найдено ${noPauseModes.length}: ${noPauseModes.join(', ')}`
  );

}

// ─────────────────────────────────────────────────────────────────────────────
// Отчёт
// ─────────────────────────────────────────────────────────────────────────────
function report() {
  let failed = 0;
  let total = 0;

  console.log('\n  Проверка проекта «Давай играй»\n');

  for (const g of results) {
    const bad = g.checks.filter((c) => !c.ok).length;
    console.log(`  ${bad === 0 ? '✓' : '✗'} ${g.title}`);
    for (const c of g.checks) {
      total++;
      if (c.ok) {
        if (VERBOSE) console.log(`      ✓ ${c.name}`);
      } else {
        failed++;
        console.log(`      ✗ ${c.name}`);
        if (c.detail) console.log(`        ${c.detail.replace(/\n/g, '\n        ')}`);
      }
    }
  }

  console.log('');
  if (failed === 0) {
    console.log(`  Всё чисто: ${total} проверок пройдено.\n`);
  } else {
    console.log(`  Проблем: ${failed} из ${total} проверок.\n`);
  }
  return failed === 0 ? 0 : 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Секреты: личный OAuth-токен Яндекс Диска не должен попадать в репозиторий.
// Репозиторий публичный (GitHub Pages), а токен — личные данные владельца.
// Проверяем все файлы, которые реально уходят в git: игры, разметку, стили.
// Токен допустим ТОЛЬКО в yandex-token.js — он внесён в .gitignore.
// ─────────────────────────────────────────────────────────────────────────────
function checkSecrets() {
  group('Секреты');

  const TOKEN_RE = /y0_[A-Za-z0-9_-]{30,}/;
  const files = [
    'index.html',
    'sw.js',
    ...fs.readdirSync(path.join(ROOT, 'games')).filter(f => f.endsWith('.js')).map(f => 'games/' + f),
    ...fs.readdirSync(path.join(ROOT, 'cards')).filter(f => f.endsWith('.js')).map(f => 'cards/' + f),
    'styles/app.css',
  ];

  const leaked = [];
  files.forEach((rel) => {
    let text = '';
    try { text = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (_) { return; }
    const m = text.match(TOKEN_RE);
    if (m) leaked.push(rel + ' (' + m[0].slice(0, 12) + '…)');
  });

  check(
    'OAuth-токен Яндекс Диска не попал в файлы репозитория',
    leaked.length === 0,
    'токен найден в: ' + leaked.join(', ') +
      ' — личный токен хранится только в yandex-token.js (он в .gitignore)'
  );

  // Сам игнорируемый файл должен оставаться вне git.
  const gi = read('.gitignore');
  check(
    'yandex-token.js внесён в .gitignore',
    /^\s*yandex-token\.js\s*$/m.test(gi),
    'без этого токен уедет в публичный репозиторий'
  );

  // Подключение в index.html должно быть необязательным: у остальных людей
  // файла нет, и страница обязана грузиться без него.
  const html = read('index.html');
  check(
    'локальный токен подключается как необязательный скрипт',
    /<script src="yandex-token\.js"[^>]*onerror=/.test(html),
    'без onerror отсутствие файла сломает загрузку страницы у других людей'
  );

  // Токена не должно быть и в state (там он лежал раньше и уезжал в git).
  const core = readCore();
  check(
    'в state нет поля с OAuth-токеном',
    !/yandexOAuthToken/.test(core),
    'токен в состоянии сохранялся в localStorage и уходил в репозиторий'
  );
}

function main() {
  const html = read('index.html');
  const { missingIds } = checkScripts(html);
  checkMarkup(html);
  checkDeadCode();
  checkWiring(html);
  checkVersions(html);
  checkDomRefs(html, missingIds);
  checkDocs();
  checkRegistry();
  checkPauseResetOnStart();
  checkExitNavigation();
  checkStyles(html);
  checkErrorGuard(html);
  checkSchemaVersioning();
  checkStats(html);
  checkGlobalHandlers(html);
  checkSecrets();
  process.exit(report());
}

if (require.main === module) main();

module.exports = { main };
