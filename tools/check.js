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
  const css = read('styles/app.css');
  const labelRule = css.match(/\.game-level-label\{([\s\S]*?)\}/);
  check('правило .game-level-label есть в CSS', !!labelRule, 'не найдено');
  if (labelRule) {
    const body = labelRule[1];
    check(
      'заголовок учитывает safe-area-inset-top',
      /top:\s*calc\([^)]*env\(safe-area-inset-top/.test(body),
      'top без env(safe-area-inset-top) — в PWA уедет под Dynamic Island'
    );
    check(
      'заголовок не прижат к самому верху (top:0)',
      !/top:\s*0\s*;/.test(body),
      'top:0 — перекроется модулем камеры на iPhone'
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
  checkStyles(html);
  checkErrorGuard(html);
  checkSchemaVersioning();
  checkStats(html);
  checkGlobalHandlers(html);
  process.exit(report());
}

if (require.main === module) main();

module.exports = { main };
