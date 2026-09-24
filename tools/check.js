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
    // Подпись берём до </button> и снимаем теги: внутри кнопки импорта
    // значок «+» лежит отдельным <span> (он красится зелёным в CSS).
    const btnRe = new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)</button>`);
    const shown = ((btnRe.exec(html) || [])[1] || '').replace(/<[^>]*>/g, '');
    check(`подпись #${id} — «${label}»`,
      shown.includes(label),
      `в разметке «${shown.trim() || 'кнопка не найдена'}» — ожидалось «${label}»`);
    // В правилах подпись может приводиться вместе с иконкой («+ Добавить свое
    // видео»), поэтому ищем текст без учёта значка-префикса.
    check(`«${label}» упомянута в правилах «Давай попробуем»`,
      new RegExp(`«[^»]*${label}[^»]*»`).test(html),
      `правила не называют кнопку «${label}» — игрок не найдёт её на экране`);
  }
  // Значки у кнопок импорта и звука убраны намеренно (v438): подписи
  // самодостаточны, строка пилюль — чисто текстовая, как у «Обновить
  // видеофайлы», где ☁️ убрали раньше. Подпись читаем до </button>, иначе
  // легко поймать эмодзи из соседних кнопок.
  const pillLabel = (id) => {
    const m = new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)</button>`).exec(html);
    return ((m || [])[1] || '').replace(/<[^>]*>/g, '');
  };
  check('у «Добавить свое видео» нет значка «+»',
    !/[+➕]/.test(pillLabel('davaySetupImportBtn')),
    'значок «+» вернулся в подпись кнопки — строка пилюль должна остаться текстовой');
  check('у кнопки «Звук» нет значка 🔊/🔇',
    !/[🔊🔇]/.test(pillLabel('davaySetupSoundBtn')),
    'значок звука вернулся в подпись кнопки — строка пилюль должна остаться текстовой');
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

  // 6. «Шаг назад» не должен вести в меню ПРОШЛОЙ игры. Механизм v342: точка
  //    входа обновляется, когда игрок действительно стоит в хабе, а партия,
  //    запущенная прямо из плитки раздела (без своего экрана настройки),
  //    возвращает в раздел хаба. Раньше точку входа запоминал только
  //    goToGameSetup(), поэтому «Бинго», «Виселица», «Рулетка», «Твистер»,
  //    «Сапёр» и другие игры-плитки уводили в меню предыдущей игры.
  check(
    'хаб фиксируется точкой входа, когда показан',
    /function showSetupView/.test(core) &&
      /rememberReturnScreen\('setup'/.test(core) &&
      /noteVisibleScreen\('setup'\)/.test(core),
    'showSetupView()/returnToSetupUI() не обновляют точку входа — выход вернёт в меню прошлой игры'
  );
  check(
    'goToGame() понимает запуск из меню хаба',
    /function launchedFromHubMenu/.test(core) &&
      /HUB_MENU_SCREENS/.test(core) &&
      /launchedFromHubMenu\(launchOrigin/.test(core),
    'goToGame() не отличает запуск из раздела хаба от запуска со своего экрана настройки'
  );
  check(
    'возврат в хаб открывает тот же раздел',
    /saved\s*===\s*'setup'/.test(core) && /showSetupView\(entry\.view\)/.test(core),
    "returnToEntryScreen() не открывает раздел хаба из точки входа — игрок попадает в чужую группу"
  );
  check(
    'активный экран отслеживается наблюдателем',
    /MutationObserver/.test(core) && /__noteActiveScreen/.test(core),
    'нет наблюдателя за активным экраном — ручные переключения экранов в играх не учитываются'
  );

  // 7. Названия игр в статистике = названия в интерфейсе. Статистика берёт
  //    название из реестра (game-registry.js: title/menuTitle), поэтому любое
  //    расхождение реестра с кнопками меню/заголовками экранов/правилами из
  //    index.html показывается игроку как «старое» название (так «Секс-квест»
  //    годами жил в статистике после переименования в «Пройди квест»).
  const regSrc = read('games/game-registry.js');
  // Проверяем ОБЕ строки: title (тосты, «Сначала завершите…») и menuTitle
  // (меню паузы, статистика). Расхождение любой из них — «старое» название
  // в интерфейсе.
  const regPairs = [...regSrc.matchAll(/title:\s*'«([^»]+)»'[^}]*?menuTitle:\s*'[^ ]+ ([^']+)'/g)];
  const nameMismatch = [];
  for (const [, title, menuName] of regPairs) {
    if (title !== menuName) {
      nameMismatch.push(`title «${title}» ≠ menuTitle «${menuName}» — в интерфейсе будет два названия одной игры`);
    }
    if (!html.includes(title)) nameMismatch.push(`реестр «${title}» — нет в интерфейсе`);
  }
  // Обратное направление (меню → реестр) НЕ проверяем: в реестре только игры
  // с паузой/продолжением, а простые игры-плитки («Твистер», «Мемасики»,
  // «Крестики-нолики», обучающие и др.) там не регистрируются — это норма.
  check(
    'названия игр в реестре совпадают с интерфейсом',
    nameMismatch.length === 0,
    `расходятся: ${nameMismatch.join('; ')}`
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
  // Исключение — ровно один блок #updateSplash: экран обновления обязан
  // выглядеть правильно ещё до загрузки styles/app.css (сразу после
  // перезагрузки при жёстком обновлении CSS едет по сети).
  const inlineStyleBlocks = (html.match(/<style[\s>]/g) || []).length;
  const splashStyleInline = /<style[\s>][\s\S]{0,600}?#updateSplash[\s\S]*?<\/style>/.test(html);
  check('нет инлайновых <style> в index.html (кроме #updateSplash)',
    inlineStyleBlocks === 0 || (inlineStyleBlocks === 1 && splashStyleInline),
    `найдено блоков: ${inlineStyleBlocks}`);

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
  const cssIsFresh = /startsWith\(ROOT \+ 'styles\/'\)/.test(sw);
  check('SW грузит стили network-first', cssIsFresh, "в sw.js нет ветки для ROOT + 'styles/'");
  // Колоды карточек (cards/*) — тоже network-first: при stale-while-revalidate
  // исправленные вопросы «Викторины» (в т.ч. подсветка верного ответа на
  // устройстве) доезжали до игрока только со второй сессии — первый заход
  // после обновления показывал старую колоду из кэша.
  check('SW грузит колоды карточек network-first',
    /startsWith\(ROOT \+ 'cards\/'\)/.test(sw),
    "в sw.js нет ветки для ROOT + 'cards/'");
  // Белый экран офлайн: активация воркера раньше удаляла ВСЕ кэши — после
  // обновления у игрока вычищался прогретый офлайн-кэш, и без интернета
  // приложение стартовало пустым. Плюс respondWith(undefined) при отсутствии
  // файла в кэше ронял загрузку скрипта. Оба регресса зафиксированы здесь.
  check('SW не удаляет текущий кэш при активации',
    /if \(name !== CACHE_NAME\) await caches\.delete\(name\)/.test(sw),
    'в activate нет защиты текущего CACHE_NAME');
  check('SW предкэширует игры и стили из index.html',
    /cards\|games\|styles/.test(sw),
    'collectAssetUrls не собирает games/* и styles/*');
  check('офлайн-заглушка вместо пустого ответа',
    /function offlineResponse\(\)/.test(sw) && /cached \|\| offlineResponse\(\)/.test(sw),
    'в sw.js нет fallback-заглушки offlineResponse');
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
  // Итог: min(64px, calc(48px + env(safe-area-inset-top))) — 48px в браузере,
  // 64px в PWA; зазор под названием в обоих случаях ровно 8px.
  check(
    'отступ игровых экранов задан переменной --screen-top-pad',
    /--screen-top-pad:/.test(css),
    'нет --screen-top-pad — отступы снова разъедутся с названием'
  );
  check(
    '--screen-top-pad учитывает safe-area и appPad',
    /--screen-top-pad:\s*min\(64px,\s*calc\(48px\s*\+\s*env\(safe-area-inset-top/.test(css),
    'формула переменной неверна: в PWA под названием игры вырастет пустая полоса (нужно min(64px, calc(48px + env(safe-area-inset-top))))'
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
  check('прогресс Фантов скрыт в «Предложи партнёру»',
    new RegExp(`#game\\.placeholder-mode\\s+#fantsProgressRow\\s*\\{[^}]*display:\\s*none`).test(css),
    'полоска прогресса Фантов остаётся в «Предложи партнёру»');
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
  // Правила значков строки пилюль «Давай попробуем» убраны вместе со значками
  // (v438). Вернутся — окажутся мёртвым кодом: классов `davay-add-plus`
  // и `davay-sound-icon` больше нет ни в разметке, ни в JS.
  check('нет мёртвых правил значков строки пилюль «Давай попробуем»',
    !/davay-add-plus|davay-sound-icon/.test(css),
    'в CSS остались правила классов davay-add-plus/davay-sound-icon — таких элементов больше нет');
  // Кнопка 🔀 «Случайный порядок» живёт в скрытом блоке «Дополнительно»
  // (row2) «Видеорулетки». Видимость и место задаёт CSS, а не разметка:
  // в раскрытом блоке `.row2` становится `display:contents`, и все кнопки
  // попадают в один flex-контейнер `.controls`, где место определяет `order`.
  // Без своего правила кнопка получала order:0 и вставала первой — перед
  // «Готово», вне блока «Дополнительно» (баг v431). Плюс вне видеорежима
  // кнопку нужно прятать: её режим (`videoRandomMode`) к «Предложи партнёру»
  // не относится, там она висела второй 🔀.
  const hideVideoBtnList = css.match(/#videoMuteBtn,[^{]*\{[^}]*display:\s*none/);
  check('кнопка 🔀 скрыта вне «Видеорулетки»',
    !!hideVideoBtnList && hideVideoBtnList[0].includes('#videoRandomBtn'),
    'нет #videoRandomBtn в списке display:none — кнопка висит в «Предложи партнёру» второй 🔀');
  check('кнопка 🔀 показана в «Видеорулетке»',
    /#game\.video-mode #videoMuteBtn[^{}]*#game\.video-mode #videoRandomBtn[^{}]*\{[^}]*display:\s*flex/.test(css),
    'нет правила показа для #videoRandomBtn — кнопка пропадёт из блока «Дополнительно»');
  // Правило кнопки блока «Дополнительно» — у каждой из пяти есть своё правило
  // с `order` (именно это отличает его от правила показа списком через запятую,
  // например `#game.video-mode #videoFullscreenBtn{display:flex;}`).
  const videoExtraRule = (id) => {
    const re = new RegExp(`#game\\.video-mode #${id}\\{([^}]*)\\}`, 'g');
    let m;
    while ((m = re.exec(css))) {
      if (/order:/.test(m[1])) return m[1];
    }
    return null;
  };
  const videoOrder = (id) => {
    const body = videoExtraRule(id);
    const m = body && body.match(/order:\s*(\d+)/);
    return m ? Number(m[1]) : null;
  };
  const VIDEO_EXTRA_BTNS = ['videoMuteBtn', 'videoRandomBtn', 'videoLoopBtn',
    'videoFullscreenBtn', 'dislikeBtn'];
  const ordMute = videoOrder('videoMuteBtn');
  const ordRandom = videoOrder('videoRandomBtn');
  const ordLoop = videoOrder('videoLoopBtn');
  const ordFull = videoOrder('videoFullscreenBtn');
  const ordDislike = videoOrder('dislikeBtn');
  check('🔀 в блоке «Дополнительно» стоит между звуком и автоповтором',
    ordMute !== null && ordRandom !== null && ordLoop !== null
      && ordMute < ordRandom && ordRandom < ordLoop,
    `order: 🔊 ${ordMute} → 🔀 ${ordRandom} → 🔁 ${ordLoop} — нужен возрастающий порядок `
    + '(без `order` кнопка получает 0 и уходит в начало ряда, к «Готово»)');
  const extraOrders = [ordMute, ordRandom, ordLoop, ordFull, ordDislike];
  check('у кнопок блока «Дополнительно» уникальный order',
    extraOrders.every(o => o !== null) && new Set(extraOrders).size === extraOrders.length,
    `order: ${extraOrders.join(', ')} — значения повторяются, часть кнопок встанет по разметке`);
  // Иконки блока «Дополнительно» увеличены на 30% (16px → 20.8px). Размер
  // иконки задаёт `font-size` в том же правиле, где `order`.
  const extraIconSize = (id) => {
    const body = videoExtraRule(id);
    const m = body && body.match(/font-size:\s*([\d.]+)px/);
    return m ? Number(m[1]) : null;
  };
  const extraIconSizes = VIDEO_EXTRA_BTNS.map(extraIconSize);
  check('иконки блока «Дополнительно» крупнее на 30% (20.8px) у всех пяти',
    extraIconSizes.every(s => s === 20.8),
    `размеры иконок (${VIDEO_EXTRA_BTNS.join(', ')}): ${extraIconSizes.join(', ')} — должно быть 20.8px (16px + 30%)`);
  // Подсказку [data-tt] должны иметь ВСЕ пять кнопок блока: у 🔊 ⛶ 🚫 её не было,
  // а по одной иконке назначение кнопки не читается (особенно у 🚫).
  const extraWithoutTooltip = VIDEO_EXTRA_BTNS.filter((id) => {
    const btn = html.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`));
    return !btn || !/data-tt="[^"]+"/.test(btn[0]);
  });
  check('у всех кнопок блока «Дополнительно» есть подсказка data-tt',
    extraWithoutTooltip.length === 0,
    `без подсказки: ${extraWithoutTooltip.join(', ')} — игрок не поймёт, что делает иконка`);
  // Включённая 🔀 должна подсвечиваться так же, как 🔁 «Автоповтор»: класс
  // `active` JS ставил и раньше, а правила для него не было — включённый
  // случайный порядок выглядел выключенным (состояние выдавала только
  // подсказка). Сравниваем тела правил: одно и то же правило — стиль совпадает.
  const activeRuleBodies = (sel) => {
    const re = /([^{}]+)\{([^}]*)\}/g;
    const out = [];
    let m;
    while ((m = re.exec(css))) {
      if (m[1].includes(sel) && /background:/.test(m[2])) out.push(m[2].replace(/\s+/g, ' ').trim());
    }
    return out;
  };
  const loopActive = activeRuleBodies('#game.video-mode #videoLoopBtn.active');
  const randomActive = activeRuleBodies('#game.video-mode #videoRandomBtn.active');
  check('включённая 🔀 подсвечивается как 🔁 (автоповтор)',
    randomActive.length > 0 && loopActive.length > 0
      && randomActive.every(body => body === loopActive[0]),
    `стиль активной 🔀: ${randomActive.join(' | ') || 'правила нет'} — должен совпадать с автоповтором: ${loopActive.join(' | ') || 'правила нет'}`);
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
  // Звуковой движок должен жить в core.js (грузится ПЕРВЫМ): его функции
  // вызываются по клику из всех файлов, и когда поздний fants-timer.js не
  // выполнился (сбой загрузки при смене кэша Service Worker), каждый клик
  // давал ReferenceError: playSuccessSound is not defined (журнал 2026-09-15).
  const sndCore = read('games/core.js');
  check('звуковой движок определён в core.js, а не в позднем файле',
    sndCore.includes('function playSuccessSound')
      && sndCore.includes('function playErrorSound')
      && sndCore.includes('function getAudioCtx'),
    'звуковые функции снова определились в позднем файле — при сбое его загрузки клики дадут ReferenceError');
  check('в fants-timer.js нет дублей звуковых функций',
    !/function (playSuccessSound|playErrorSound|playTimerAlarm|getAudioCtx)\s*\(/.test(timerSrc),
    'звуковые функции определяются в двух местах — рассинхрон неизбежен');
  // Единый звук видео: кнопка «Звук» на настройке «Давай попробуем» и кнопки
  // 🔊 в обеих играх обязаны писать одну настройку. Раньше
  // state.videoSoundOn жил отдельно — включённый на настройке звук не
  // действовал на «Видеорулетку», и его включали второй раз в самой игре.
  const sndDavay = read('games/fants-davay.js');
  const sndVideo = read('games/fants-video.js');
  check('общий переключатель звука видео определён в core.js',
    sndCore.includes('function setSharedVideoSound'),
    'setSharedVideoSound пропал — у игр снова раздельные настройки звука');
  check('обе видео-игры меняют звук через общий переключатель',
    /setSharedVideoSound\(/.test(sndDavay) && /setSharedVideoSound\(/.test(sndVideo),
    'setDavaySoundOn/setVideoSoundOn снова пишут только своё поле — кнопка «Звук» не действует на вторую игру');
  check('старые сейвы нормализуются к единому звуку при загрузке',
    /state\.videoSoundOn\s*=\s*state\.davaySoundOn/.test(sndCore),
    'в loadState исчезла нормализация videoSoundOn к davaySoundOn');
  check('общий переключатель пишет state и обе модульные переменные',
    /state\.videoSoundOn\s*=\s*!!on/.test(sndCore)
      && /davaySoundOn\s*=\s*!!on/.test(sndCore)
      && /videoSoundOn\s*=\s*!!on/.test(sndCore),
    'setSharedVideoSound пишет не всё — кнопки 🔊 и рендер увидят устаревший звук');
  check('игры не пишут звук напрямую, только через общий переключатель',
    !/davaySoundOn\s*=\s*!!on/.test(sndDavay) && !/videoSoundOn\s*=\s*!!on/.test(sndVideo),
    'в играх снова прямая запись звука — настройка разъедется между играми');
  // Подсказка [data-tt] у кнопок-переключателей обязана называть состояние:
  // у 🔀 при выключенном режиме текст был без «выкл» — игрок не понимал,
  // включён случайный порядок или нет. У 🔁 «Автоповтор вкл/выкл» — образец.
  const tooltipReportsState = (fnName, cond) => {
    const fn = sndVideo.match(new RegExp(`function ${fnName}\\(\\)\\{([\\s\\S]*?)\\n\\}`));
    return !!fn && new RegExp(`${cond}\\s*\\?\\s*'[^']*вкл'\\s*:\\s*'[^']*выкл'`).test(fn[1]);
  };
  check('подсказка 🔊 сообщает состояние (вкл/выкл)',
    tooltipReportsState('updateVideoMuteBtn', 'videoSoundOn'),
    'подсказка 🔊 не зависит от режима — игрок не увидит, включён звук или нет');
  check('подсказка 🔀 сообщает состояние (вкл/выкл)',
    tooltipReportsState('updateVideoRandomBtn', 'state\\.videoRandomMode'),
    'подсказка 🔀 не зависит от режима — игрок не увидит, включён случайный порядок или нет');
  check('подсказка 🔁 сообщает состояние (вкл/выкл)',
    tooltipReportsState('updateVideoLoopBtn', 'state\\.videoAutoAdvance'),
    'подсказка 🔁 не зависит от режима — игрок не увидит, включён автоповтор или нет');
  // Подпись кнопки «Звук» на настройке «Давай попробуем» перерисовывает JS —
  // вместе со значком: в строке пилюль значки убраны (v438), текст кнопки
  // должен остаться без эмодзи 🔊/🔇.
  check('кнопка «Звук» на настройке — без значка',
    /btn\.textContent\s*=\s*davaySoundOn\s*\?\s*'Звук включён'\s*:\s*'Звук выключен'/.test(sndDavay),
    'подпись кнопки «Звук» снова со значком 🔊/🔇 — в строке пилюль значки убраны');
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
  // «Обновить видеофайлы» синхронизирует каталог с папками «Level N-M …»:
  // название папки разбирается на номер уровня (1..6). Раньше весь импорт шёл
  // в один уровень 1 через YANDEX_IMPORT_GAME_LEVEL — если это вернётся,
  // папки уровней снова будут игнорироваться.
  check('импорт с Диска идёт по папкам уровней, а не в один уровень',
    davaySrc.includes('const YANDEX_LEVEL_FOLDER_RE = /^Level\\s+(\\d+)/i;')
      && davaySrc.includes('function yandexLevelFromFolderName(name)')
      && davaySrc.includes('async function importYandexVideos()')
      && !davaySrc.includes('YANDEX_IMPORT_GAME_LEVEL'),
    'импорт снова сводится к одному уровню — папки «Level N-M …» игнорируются');
  // Обновление подписанных ссылок должно искать файлы в папках уровней:
  // выборка из корня папки не находит ролики из подпапок, и те дают чёрный экран.
  // fetchYandexLevelFiles используется в двух местах: восстановление одного
  // ролика (refreshYandexCardHref) и массовое обновление (refreshYandexLinks).
  const levelFilesUses = (davaySrc.match(/await fetchYandexLevelFiles\(\);/g) || []).length;
  check('обновление ссылок Диска читает папки уровней',
    levelFilesUses >= 2,
    `fetchYandexLevelFiles используется ${levelFilesUses} раз(а), нужно в обоих обновлениях ссылок`);
  // Синхронизация читает папки уровней параллельно в два раунда (Promise.all):
  // кэшированные с прошлого раза — одновременно с запросом корня, новые —
  // догоняющим раундом. Последовательные 19 запросов делали её заметно долгой.
  check('синхронизация читает папки Диска параллельно',
    /await Promise\.all\(cachedPromises\.map/.test(davaySrc)
      && /await Promise\.all\(missing\.map/.test(davaySrc),
    'чтение папок снова последовательное — синхронизация медленная');
  // Оверлей «Загрузка видео…» на карточке плеера обеих видео-игр прячется на playing.
  const videoSrc2 = read('games/fants-video.js');
  const davaySrc2 = read('games/fants-davay.js');
  check('«Видеорулетка» показывает оверлей загрузки видео',
    videoSrc2.includes('id="videoLoading"') && videoSrc2.includes('hideVideoCardLoading()'),
    'на карточке «Видеорулетки» нет оверлея «Загрузка видео…»');
  check('«Давай попробуем» показывает оверлей загрузки видео',
    davaySrc2.includes('id="davayLoading"') && davaySrc2.includes('hideDavayCardLoading()'),
    'на карточке «Давай попробуем» нет оверлея «Загрузка видео…»');
  // Тост синхронизации не гаснет, пока работа идёт: showToast поддерживает
  // duration === 0 (держится до следующего showToast), а обработчик им пользуется.
  const coreSrc = read('games/core.js');
  check('showToast умеет не гаснуть (duration === 0)',
    /if\(duration === 0\) return;/.test(coreSrc),
    'showToast не поддерживает постоянный тост — «Синхронизируем…» снова исчезает');
  check('окно синхронизации открыто до результата и закрыто после',
    /syncModal\.classList\.add\('show'\)/.test(davaySrc2)
      && /syncModal\.classList\.remove\('show'\)/.test(davaySrc2)
      && /await importYandexVideos\(\)/.test(davaySrc2),
    'синхронизация снова идёт в фоне без видимого окна');
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
  // Подуровни папок «Level N-M …» стали играбельными: «Горячее» шагает по
  // папкам внутри уровня («Level 1-1 …» → «Level 1-2 …»), а когда своих папок
  // больше нет — на следующий уровень; «⬆️ Повысить» ведёт сразу на следующий
  // уровень. Проверяем связку: разбор подуровня в core.js, обработчики в
  // fants-timer.js, кнопка в разметке, показ кнопок в davay-mode и фильтрация
  // карточек в обеих видео-играх.
  const davayTimerSrc = read('games/fants-timer.js');
  check('подуровень папки разбирается из yandexPath',
    coreSrc.includes('function davaySubLevelFromPath(path)')
      && coreSrc.includes('function davayCardSubLevel(card)')
      && coreSrc.includes('function nextDavaySubLevel(level, currentSub)'),
    'хелперы подуровней пропали из core.js — «Горячее» не найдёт следующую папку');
  check('смена уровня/подуровня идёт через switchVideoLevel',
    coreSrc.includes('function switchVideoLevel(level, sub)')
      && davayTimerSrc.includes('switchVideoLevel(')
      && /davayQuizActivePlayer !== 0/.test(coreSrc)
      && /davayQuizPendingNext !== 0/.test(coreSrc),
    'switchVideoLevel пропал или не блокирует смену уровня посреди раунда квиза');
  check('кнопки «Повысить уровень» есть в разметке и обрабатываются',
    davayHtml.includes('id="davayNextBtn"')
      && davayTimerSrc.includes("getElementById('davayNextBtn')")
      && davayHtml.includes('id="videoNextBtn"')
      && davayTimerSrc.includes("getElementById('videoNextBtn')"),
    'кнопка «Повысить уровень» отсутствует в разметке или без обработчика');
  check('«Горячее» и «⬆️ Повысить» видны в «Давай попробуем»',
    /#game\.davay-mode #doneBtn\{display:none;\}/.test(css)
      && /#game\.davay-mode #davayNextBtn\{/.test(css)
      && !/#game\.davay-mode #davayLevelUpBtn\{display:none/.test(css),
    'CSS снова прячет «Горячее»/«Повысить» в davay-mode');
  check('под уровень фильтруют обе видео-игры',
    /else if\(davaySubLevel > 0\)/.test(davaySrc2)
      && /else if\(videoSubLevel > 0/.test(videoSrc2),
    'отбор карточек по подуровню пропал из draw-функций');
  // ── Кнопки уровня «Видеорулетки» ─────────────────────────────────────────
  // 🔥 «Горячее» продублирована: быстрая кнопка в верхнем ряду (сразу после
  // «Следующее») и иконка в блоке «Дополнительно». Обработчик обязан быть один
  // (videoHotAction) — две копии одного действия разъехались бы при правке.
  const hotIdx = davayHtml.indexOf('id="videoHotBtn"');
  check('кнопка 🔥 «Горячее» стоит сразу после «Следующее»',
    hotIdx > davayHtml.indexOf('id="doneBtn"') && hotIdx < davayHtml.indexOf('id="favoriteBtn"'),
    'videoHotBtn потерялась или уехала из верхнего ряда «Видеорулетки»');
  check('две кнопки 🔥 используют общий обработчик videoHotAction',
    davayTimerSrc.includes("getElementById('videoLevelUpBtn').addEventListener('click', videoHotAction)")
      && davayTimerSrc.includes("getElementById('videoHotBtn').addEventListener('click', videoHotAction)"),
    'кнопки 🔥 снова с разными обработчиками — поведение разъедется');
  // «Горячее» и «Повысить уровень» переехали из верхнего ряда в блок
  // «Дополнительно»: в разметке они должны стоять между «Дополнительно» и
  // последней кнопкой этого блока (pauseBtn), а обёртки .video-level-row
  // больше нет — она отнимала у карточки отдельную строку.
  const menuStart = davayHtml.indexOf('id="videoExtraToggle"');
  const menuEnd = davayHtml.indexOf('id="pauseBtn"');
  const inExtraMenu = (id) => {
    const i = davayHtml.indexOf(`id="${id}"`);
    return i > menuStart && i < menuEnd;
  };
  check('кнопки уровня перенесены в блок «Дополнительно»',
    !davayHtml.includes('video-level-row')
      && inExtraMenu('videoLevelUpBtn') && inExtraMenu('videoNextBtn'),
    '«Горячее»/«Повысить уровень» вернулись в верхний ряд или пропали из «Дополнительно»');
  const hintOf = (id) => {
    const btn = davayHtml.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`));
    const tt = btn && btn[0].match(/data-tt="([^"]+)"/);
    return tt ? tt[1] : '';
  };
  check('у кнопок 🔥 и ⬆️ подсказки с нужным текстом',
    hintOf('videoHotBtn') === 'Горячее: следующая папка уровня 🔥'
      && hintOf('videoLevelUpBtn') === 'Задания горячее'
      && hintOf('videoNextBtn') === 'Следующий уровень',
    `подсказки: быстрая 🔥 «${hintOf('videoHotBtn')}», меню 🔥 «${hintOf('videoLevelUpBtn')}», ⬆️ «${hintOf('videoNextBtn')}»`);
  // Порядок в раскрытом «Дополнительно»: ⬆️ (8) → 🔥 (9) → 🔊 (10) … 🚫 (14).
  // Без своего `order` кнопка-иконка получает 0 и встаёт в начало ряда — перед
  // «Следующее», как когда-то случилось с 🔀.
  const ordLevelUp = videoOrder('videoLevelUpBtn');
  const ordNextLevel = videoOrder('videoNextBtn');
  check('в «Дополнительно» первыми идут ⬆️ и 🔥, затем 🔊',
    ordNextLevel === 8 && ordLevelUp === 9 && ordMute === 10 && ordRandom === 11
      && ordLoop === 12 && videoOrder('videoFullscreenBtn') === 13 && videoOrder('dislikeBtn') === 14,
    `порядки: ⬆️ ${ordNextLevel} → 🔥 ${ordLevelUp} → 🔊 ${ordMute} → 🔀 ${ordRandom} → 🔁 ${ordLoop}`);
  check('🔥 «Горячее» скрыта вне «Видеорулетки»',
    /#videoHotBtn\{display:none;\}/.test(css)
      && /#game\.video-mode #videoHotBtn\{display:flex;\}/.test(css),
    'быстрая кнопка 🔥 видна в других играх');
  // ── Кнопка ⤴ «Поделиться видео» ───────────────────────────────────────────
  // В Telegram должно приезжать ВИДЕО, а не только текст: к сообщению
  // прикладывается сам ролик (navigator.share с files). Раньше уходила лишь
  // ссылка на страницу приложения, и чат получал один текст — статическая
  // страница видео в превью ссылки отдать не может (og:video требует серверной
  // подстановки, а сайт лежит на GitHub Pages без бэкенда).
  check('кнопка ⤴ прикладывает к сообщению сам ролик (share с files)',
    videoSrc2.includes('async function videoShareFile(card)')
      && videoSrc2.includes('navigator.canShare({ files:[new File(')
      && /const withText = \{ files:\[file\], text: shareText \}/.test(videoSrc2)
      && /const fileOnly = \{ files:\[file\] \}/.test(videoSrc2)
      && /await navigator\.share\(payload\)/.test(videoSrc2)
      && !/shareWithTimeout\(payload\)/.test(videoSrc2)
      && videoSrc2.includes('let videoShareInProgress = false;')
      && /if\(videoShareInProgress\) return;/.test(videoSrc2),
    'шеринг снова отправляет только ссылку или запускает второй системный вызов');
  // Свежий Android/Telegram нестабильно обрабатывает file+text+title: окно
  // застревает на «Загрузка 100%». Название уже есть в text, поэтому title
  // в файловом payload не передаём.
  check('файловый payload не передаёт title',
    !/const withText = \{ files:\[file\], text: shareText, title:/.test(videoSrc2)
      && !/const fileOnly = \{ files:\[file\], title:/.test(videoSrc2),
    'title вместе с файлом снова уходит в Web Share — Telegram может зависнуть на загрузке');
  // Файл и url в одной нагрузке — TypeError по спецификации Web Share, меню
  // просто не откроется. Поэтому ссылка-вход уходит в text, а url остаётся
  // только у фолбэка без файлов.
  check('файл не отправляется вместе с url',
    /files:\[file\][^}]*\}/.test(videoSrc2)
      && !/files:\[file\][^}]*url:/.test(videoSrc2)
      && /(?:navigator\.share|shareWithTimeout)\(\{\s*title: '🎲 Давай играй',\s*\n\s*text: [^,\n]+,\s*\n\s*url: shareUrl/.test(videoSrc2),
    'files и url в одной нагрузке — системное меню «Поделиться» упадёт с TypeError');
  check('слишком большой ролик не читается в память',
    /VIDEO_SHARE_MAX_BYTES = \d+ \* 1024 \* 1024/.test(videoSrc2)
      && /content-length/.test(videoSrc2)
      && /blob\.size > VIDEO_SHARE_MAX_BYTES/.test(videoSrc2),
    'нет ограничения размера файла — большое видео уронит страницу при отправке');
  check('кнопка ⤴ делится ссылкой-входом, когда файл приложить нельзя',
    videoSrc2.includes('function videoEntryPointUrl(card, level)')
      && /videoEntryPointUrl\(currentVideoCard, videoLevel\)/.test(videoSrc2)
      && /if\(e && \(e\.name === 'AbortError' \|\| e\.code === 20 \|\| \(e\.message && \/abort\|cancel\/i\.test\(e\.message\)\)\)\) return;/.test(videoSrc2),
    'нет фолбэка ссылкой-входом — на десктопе и для нечитаемых роликов поделиться нечем');
  check('ссылка-вход сокращается через clck.ru перед отправкой',
    videoSrc2.includes('function shortenShareUrl(url)')
      && videoSrc2.includes("'https://clck.ru/--?url='")
      && /await shortenShareUrl\(appUrl\)/.test(videoSrc2)
      && /const shareUrl = await shortenShareUrl\(appUrl\)/.test(videoSrc2),
    'ссылка-вход не сокращается — в Telegram она слишком длинная');
  check('заголовок поделиться — «🎲 Давай играй»',
    videoSrc2.includes("title: '🎲 Давай играй'")
      && /title: '🎲 Давай играй'/.test(videoSrc2)
      && videoSrc2.includes("const shareMessage = '🎲 Давай играй\\nПопробуем? 😉'")
      && videoSrc2.includes("text: shareMessage"),
    'сообщение должно начинаться с названия приложения и приглашения «Попробуем?»');
  const initSrc = read('games/init.js');
  check('ссылка-вход открывает «Видеорулетку» на нужном ролике',
    videoSrc2.includes('function findVideoCardByEntryKey(key)')
      && videoSrc2.includes('function showVideoCardDirect(card)')
      && videoSrc2.includes('function openVideoFromLink(entry)')
      && initSrc.includes("linkParams.get('mode')") && initSrc.includes("linkParams.get('e')")
      && initSrc.includes('openVideoFromLink(entry)'),
    'распаковка ?mode=video потерялась — по ссылке откроется обычный старт');
  // Прочитанные параметры убираем из адресной строки: иначе каждое обновление
  // страницы снова открывало бы «Видеорулетку» поверх меню.
  check('параметры ссылки-входа чистит replaceState',
    initSrc.includes("linkUrl.searchParams.delete('mode')")
      && initSrc.includes('history.replaceState'),
    'параметры ?mode=video остаются в адресе и повторяют вход при каждом обновлении');
  // Заголовок игры (#gameLevelLabel) гаснет на время тоста и обязан вернуться:
  // раньше видимость возвращал только режим «Предложи партнёру», и после любого
  // тоста в «Видеорулетке» название игры пропадало до следующего turn-обновления.
  check('после тоста название игры снова видно (не только в «Предложи партнёру»)',
    coreSrc.includes('function restoreGameLevelLabelAfterToast(levelLabel)')
      && /showToast\._tm = setTimeout\(\(\)=>\{[\s\S]{0,200}?restoreGameLevelLabelAfterToast\(levelLabel\)/.test(coreSrc)
      && /else if\(gameScreenHasTitle\(\)\)\{[\s\S]{0,200}?display = 'block'/.test(coreSrc),
    'заголовок «Видеорулетки» снова исчезает после первого тоста');
  // Видео карточки обязано гаснуть ДО перезаписи innerHTML: плееры создаются
  // внутри карточки, и любая её смена (карточка «Передайте телефон», заглушка,
  // фолбэк ошибки, следующее видео) отрывает играющий <video> от DOM — он
  // продолжает играть со звуком в фоне, а getElementById его уже не находит.
  const coreSrcAll = read('games/core.js');
  check('видео карточки останавливается до перезаписи innerHTML',
    /function stopCardVideos\(\)/.test(coreSrcAll)
      && /stopCardVideos\(\);\s*\n\s*paintFn\(el\);/.test(coreSrcAll)
      && /stopCardVideos\(\);\s*\n\s*const el = document\.getElementById\('game'\)/.test(coreSrcAll),
    'stopCardVideos пропал из core.js или не вызывается при смене карточки/режима');
  check('фолбэк ошибки видео гасит плеер перед перезаписью media',
    videoSrc2.includes('stopCardVideos();'),
    'showVideoErrorFallback снова перезаписывает media без остановки видео');
  // Окно прогресса синхронизации: блокирует интерфейс на время «Обновить
  // видеофайлы» — тост гас через пару секунд, а работа шла в фоне, и игрок
  // не понимал, готово ли облако.
  check('окно прогресса синхронизации есть в разметке и управляется кодом',
    davayHtml.includes('id="davaySyncModal"')
      && davayHtml.includes('id="davaySyncProgress"')
      && davaySrc2.includes("getElementById('davaySyncModal')")
      && davaySrc2.includes('davaySyncProgress('),
    'модалка прогресса или управление ей потерялись');
  check('у окна синхронизации есть спиннер в стилях',
    css.includes('.davay-sync-spinner') && css.includes('@keyframes davay-sync-spin'),
    'спиннер окна синхронизации исчез из CSS');
  check('сбой чтения папки не удаляет видео из каталога',
    davaySrc2.includes('staleRemoved = stale.length > 0 && fetchFailures === 0'),
    'устаревшие записи снова удаляются без проверки сбоев чтения папок');
  // Первый ролик видеорулетки не должен ждать массового переподписания ссылок
  // (десятки запросов к API): карточка рисуется сразу, refreshYandexLinks
  // уходит в фон, просроченную ссылку чинит обработчик error у <video>.
  // Проверяем порядок вызовов в goToVideoGame.
  check('массовое обновление ссылок уходит в фон после отрисовки карточки',
    videoSrc2.includes('refreshYandexLinks(true).catch(()=>{})')
      && !videoSrc2.includes('await refreshYandexLinks(true)'),
    'goToVideoGame снова ждёт refreshYandexLinks до показа первого видео');
  // Вход по ссылке на чужом телефоне: ролика может не быть в каталоге
  // (синхронизацию с Диском там ещё не нажимали). Раньше игра падала в
  // демо-ролик — у получателя демо, у отправителя всё хорошо. Теперь вход
  // молча подтягивает облако (importYandexVideos) и ищет снова, а если ролик
  // так и не нашёлся — показывает заглушку с подсказкой, а не демо.
  check('вход по ссылке подтягивает облако и не показывает демо вместо присланного видео',
    videoSrc2.includes('await importYandexVideos()')
      && videoSrc2.includes('Подгружаем видео из облака')
      && videoSrc2.includes('Это видео не найдено в каталоге'),
    'вход по несуществующему ключу снова молча включает демо');
  // Индикаторы загрузки слиты в одну точку экрана: заглушка «Загрузка видео…»
  // (пока читается каталог) центрируется — как и оверлей на карточке плеера.
  check('заглушка загрузки видео центрируется в видео-режимах',
    /#game\.(?:video|davay)-mode \.card\.card-empty[^{]*\{justify-content:center;\}/.test(css),
    'заглушка «Загрузка видео…» снова прижата к верху карточки');
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
  // Плашки уровней в «Давай попробуем» — общий стиль .level-toggle, как в
  // «Фантах» и других играх (v439; раньше были компактными 39px). Отдельных
  // правил #davaySetup .level-toggle быть не должно — иначе стиль снова
  // разойдётся с остальными играми.
  check('плашки уровней «Давай попробуем» — общий стиль, отдельных правил нет',
    !/#davaySetup[^{]*\.level-toggle/.test(css),
    'в CSS снова есть правило #davaySetup .level-toggle — стиль плашек разошёлся с другими играми');
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
  const declNum = (block, prop) => {
    const m = new RegExp(prop + ':\\s*([\\d.]+)px').exec(block);
    return m ? parseFloat(m[1]) : null;
  };
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
  const required = ['statsModal', 'statsBody', 'statsToggleBtn', 'statsClearBtn', 'statsFinishedRow'];
  const absent = required.filter((id) => !html.includes(`id="${id}"`));
  check(`разметка экрана статистики (${required.length} элементов)`, absent.length === 0, `нет: ${absent.join(', ')}`);

  check('кнопка в меню есть', html.includes('id="menuStatsBtn"'), 'нет кнопки «Статистика»');
  check('обработчик экрана есть', /function\s+renderStatsScreen\s*\(/.test(core), 'нет renderStatsScreen');
  check('в сводке есть строка «Законченных партий»',
    /Законченных партий/.test(core),
    'в renderStatsScreen нет строки');
  // «Любимые игры»: топ-5 сразу, остальные — по кнопке «Показать все».
  check('список игр раскрывается кнопкой, а не обрезан',
    /statsMoreGamesBtn/.test(core) && /Показать все/.test(core) && /statsGamesExpanded/.test(core),
    'нет кнопки «Показать все» — игры сверх топ-5 недоступны');
  check('кнопка «Показать все» скрывает список обратно',
    /Скрыть/.test(core),
    'раскрытый список нельзя свернуть');
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

  // Вложенные экраны игр без паузы (история, итоги): стрелка «←» и кнопка
  // «Назад»/«В меню» должны возвращать на шаг назад — в настройки игры,
  // а НЕ в хаб. Раньше каждый такой экран включал #setup вручную и не
  // снимал его .active — из-за этого после «Продолжить игру» из хаба
  // игрок видел «экран из двух частей» (хаб + настройки). Три раза
  // правили, каждый раз убирая ручное переключение в пользу вызова её
  // функции выхода (PARENT_BACK в fants-timer.js). Чтобы баг не
  // вернулся четвёртый: проверяем, что карта PARENT_BACK есть и что
  // каждый экран из неё:
  //   • есть в SETUP_ONLY_SCREENS (иначе «←» уйдёт в generic-fallback → хаб);
  //   • имеет функцию выхода, которую он ссылается.
  const timerSrcLocal = read('games/fants-timer.js');
  const allJsLocal = fs.readdirSync(path.join(ROOT, 'games'))
    .map((f) => read(path.join('games', f))).join('\n');
  const parentBackMatch = timerSrcLocal.match(/const PARENT_BACK\s*=\s*\{([\s\S]*?)\n\s*\};/);
  check('карта PARENT_BACK для вложенных экранов объявлена', !!parentBackMatch,
    'в fants-timer.js нет PARENT_BACK — «←» из истории/итогов уйдёт в хаб');
  if (parentBackMatch) {
    const parentBackBody = parentBackMatch[1];
    // Извлекаем пары «экран: функция». Функция может быть строкой или именованной.
    const backPairs = [...parentBackBody.matchAll(/'([A-Za-z][\w]*)':\s*'([A-Za-z][\w]*)'/g)]
      .map((m) => ({ screen: m[1], fn: m[2] }));
    // Жёстко: эти 4 экрана обязаны быть в карте. Если кто-то уберёт — тест падает.
    const requiredScreens = ['sexQuestHistory', 'sexQuestSummary', 'passionMapHistory', 'passionMapSummary', 'sexQuestSetup', 'passionMapSetup'];
    for (const sid of requiredScreens) {
      const entry = backPairs.find((p) => p.screen === sid);
      check(`PARENT_BACK содержит ${sid}`, !!entry, `экран ${sid} не в карте PARENT_BACK`);
      if (entry) {
        // Функция выхода должна существовать в коде игры.
        check(`PARENT_BACK[${sid}] → ${entry.fn} существует`,
          new RegExp(`function\\s+${entry.fn}\\s*\\(`).test(allJsLocal),
          `функция ${entry.fn} не найдена — «←» из ${sid} ничего не вызовет`);
      }
    }
    // Каждый экран из PARENT_BACK обязан быть в SETUP_ONLY_SCREENS: иначе
    // generic-fallback (который идёт в блок «игры без паузы») может перехватить
    // «←» и открыть хаб. Проверка идёт через наличие id как есть.
    const setupOnlyBlock = timerSrcLocal.slice(
      timerSrcLocal.indexOf('const SETUP_ONLY_SCREENS'),
      timerSrcLocal.indexOf('function returnToGroup')
    );
    for (const sid of requiredScreens) {
      check(`${sid} в SETUP_ONLY_SCREENS`,
        RegExp(`'${sid}'`).test(setupOnlyBlock),
        `экран не в списке SETUP_ONLY_SCREENS — «←» может уйти в generic-fallback → хаб`);
    }
  }

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
// Секреты: в приложении не должно быть НИКАКИХ токенов и ключей.
// Репозиторий публичный (GitHub Pages), а проект статический: всё, что попало
// в браузер, доступно посетителю, и «спрятать» ключ в отдельном файле нельзя —
// .gitignore защищает только от коммита, но не от раздачи папки целиком.
// История: личный OAuth-токен Яндекса сначала лежал в state (уезжал в git и в
// localStorage игроков), потом — в отдельном yandex-token.js. Оба варианта
// убраны, потому что токен `cloud_api:disk.read` открывает чтение ВСЕГО диска,
// а игре нужна одна публичная папка: она читается по ссылке без авторизации.
// ─────────────────────────────────────────────────────────────────────────────
function checkSecrets() {
  group('Секреты');

  // Ловим и нынешний формат токена Яндекса (y0_…), и старый (32 hex-символа),
  // и заголовок авторизации в любом виде. Раньше проверка знала только `y0_`
  // и пропускала hex-токен — теперь формат не важен, важен сам факт.
  const PATTERNS = [
    { re: /\by0_[A-Za-z0-9_-]{20,}/, what: 'OAuth-токен Яндекса' },
    { re: /\b[0-9a-f]{32}\b/, what: 'hex-токен (старый формат)' },
    { re: /Authorization\s*['":]/, what: 'заголовок Authorization' },
    { re: /YANDEX_DISK_TOKEN|yandexOAuthToken/, what: 'поле с токеном' },
  ];
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
    PATTERNS.forEach((p) => {
      if (p.re.test(text)) leaked.push(rel + ': ' + p.what);
    });
  });

  check(
    'ни в одном файле репозитория нет токенов и ключей',
    leaked.length === 0,
    'найдено — ' + leaked.join(', ') +
      ': приложение статическое, поэтому любой ключ в коде виден посетителю'
  );

  // Отдельный файл с токеном — тот же самый секрет в открытом доступе: он
  // отдаётся по URL рядом с index.html. Такого файла в проекте быть не должно.
  check(
    'в проекте нет отдельного файла с токеном',
    !fs.existsSync(path.join(ROOT, 'yandex-token.js')),
    'yandex-token.js — секрет в открытом доступе: раздаётся вместе с игрой'
  );

  // Скрипт с токеном не должен подключаться и не должен упоминаться в разметке.
  const html = read('index.html');
  check(
    'в index.html нет подключения файла с токеном',
    !/yandex-token\.js/.test(html),
    'подключение вернуло бы личный токен в приложение'
  );

  // Токена не должно быть и в state: он сохранялся в localStorage игрока.
  const core = readCore();
  check(
    'в state нет поля с OAuth-токеном',
    !/yandexOAuthToken/.test(core),
    'токен в состоянии сохранялся в localStorage и уходил в репозиторий'
  );

  // И главное: единственный источник видео — публичная папка. Если в запросах
  // к API Диска появится авторизация, значит токен вернули.
  const davay = read('games/fants-davay.js');
  check(
    'запросы к Яндекс Диску идут только по публичной ссылке',
    /public_key=/.test(davay) && !/Authorization/.test(davay),
    'папка публичная, авторизация не нужна — токен в запросах означает возврат секрета'
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 17. Данные детской «Викторины»
// ────────────────────────────────────────────────────────────────────────────
/**
 * Колода детской викторины собиралась автоматически и наполовину состояла из
 * вычислительных примеров («Сколько будет 7×8?», «Чему равно 4 в степени 3?»).
 * С таймером 10–20 секунд это устный счёт, а не эрудиция, поэтому примеры
 * заменены вопросами по школьной программе. Проверки следят, чтобы примеры
 * не вернулись, а сами варианты ответов остались валидными.
 */
function checkKidsQuizCards() {
  group('Данные детской «Викторины»');
  const src = read('cards/cards_kids_quiz.js');
  const cards = [...src.matchAll(/\{level:(\d), q:'((?:[^'\\]|\\.)*)', a:\[([^\]]*)\]\}/g)]
    .map((m) => ({
      level: Number(m[1]),
      q: m[2],
      a: [...m[3].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((x) => x[1]),
    }));

  check('карточки детской «Викторины» разобраны', cards.length > 0, 'KIDS_QUIZ_CARDS не читается');

  const byLevel = [1, 2, 3, 4].map((l) => cards.filter((c) => c.level === l).length);
  check(
    'в детской «Викторине» по 150 вопросов на каждый из 4 уровней',
    byLevel.every((n) => n === 150),
    `получено по уровням: ${byLevel.join(' / ')}`
  );

  const calc = cards.filter((c) =>
    /^Сколько будет \d/.test(c.q) || /^Чему равно /.test(c.q) || /% от /.test(c.q) || /разделить на /.test(c.q));
  check(
    'в детской «Викторине» нет вычислительных примеров',
    calc.length === 0,
    `примеров: ${calc.length}${calc[0] ? ' — например «' + calc[0].q + '»' : ''}`
  );

  const badOptions = cards.filter((c) => c.a.length !== 4 || new Set([c.q, ...c.a]).size !== 5);
  check(
    'в каждой карточке детской «Викторины» 4 разных варианта ответа',
    badOptions.length === 0,
    `битых карточек: ${badOptions.length}`
  );

  // Ответы, завёрнутые в прямые кавычки ('"4"'), — артефакт автогенерации деки:
  // на кнопке рисовалось «"4"» вместо 4. «Ёлочки» («школа») — обычная
  // типографика и не считаются. Прямые кавычки в cards_fam_znayu.js —
  // намеренное цитирование речи, поэтому проверяем только детскую деку.
  const quoted = cards.filter((c) => c.a.some((x) => /^".*"$/.test(x)));
  check(
    'в детской «Викторине» нет ответов в прямых кавычках',
    quoted.length === 0,
    `карточек с кавычками: ${quoted.length}${quoted.length ? ' — например «' + quoted[0].q + '»' : ''}`
  );

  const seen = new Set();
  const dupes = [];
  cards.forEach((c) => {
    const key = c.q.toLowerCase();
    if (seen.has(key)) dupes.push(c.q);
    seen.add(key);
  });
  check(
    'вопросы детской «Викторины» не повторяются',
    dupes.length === 0,
    `дублей: ${dupes.length}${dupes.length ? ' — ' + dupes.slice(0, 3).join('; ') : ''}`
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 18. Данные «Викторины» (соло + компания)
// ────────────────────────────────────────────────────────────────────────────
/**
 * Колода «Викторины» (cards_party_quiz.js) изначально содержала ~321
 * вычислительный пример («Сколько будет 7×8?», «Чему равно 24×22?») — под
 * таймером 10–20 секунд это устный счёт, а не эрудиция. Примеры заменены
 * содержательными вопросами; проверки не дают им вернуться.
 */
function checkPartyQuizCards() {
  group('Данные «Викторины» (соло + компания)');
  const src = read('cards/cards_party_quiz.js');
  const cards = [...src.matchAll(/\{level:(\d), q:'((?:[^'\\]|\\.)*)', a:\[([^\]]*)\]\}/g)]
    .map(m => ({ level: Number(m[1]), q: m[2], a: [...m[3].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(x => x[1]) }));
  check('колода соло/компании содержит 626 карточек', cards.length === 626);
  check('уровни соло/компании: 176/150/150/150',
    [1, 2, 3, 4].map(l => cards.filter(c => c.level === l).length).join('/') === '176/150/150/150');
  check('в соло/компании нет вычислительных примеров',
    !cards.some(c => /^(Сколько будет|Чему равно)|×|÷|% от |разделить на | в степени \d|\d\s*[+*/^]\s*\d/.test(c.q)));
  check('в соло/компании по 4 разных непустых ответа',
    cards.every(c => c.a.length === 4 && c.a.every(a => a.trim()) && new Set(c.a).size === 4));
  check('в соло/компании нет одинаковых вопросов',
    new Set(cards.map(c => c.q.toLowerCase())).size === cards.length);
}

// Викторины (пары/компания/один/дети): память показанных вопросов (XQuizUsed)
// живёт между партиями, поэтому один и тот же вопрос не должен выпадать из
// игры в игру. Проверяем: (1) «мягкое возвращение» на месте — при исчерпании
// пула забывается только СТАРАЯ половина показанных (used.slice(-keep)), а не
// вся память; (2) старт партии не обнуляет память (раньше goToKidsQuizGame
// стирал kidsQuizUsed перед каждой партией — повтор шёл каждую игру);
// (3) «Сбросить прогресс» (performFullReset) по-прежнему чистит память всех
// четырёх викторин — с чистого листа вопросы идут с начала колоды.
function checkQuizNoRepeat() {
  group('Викторины: без повторов между партиями');
  const files = [
    ['games/quiz.js', 'quizUsed'],
    ['games/party-quiz.js', 'partyQuizUsed'],
    ['games/solo-quiz.js', 'soloQuizUsed'],
    ['games/kids-quiz.js', 'kidsQuizUsed'],
  ];
  for (const [file, field] of files) {
    const src = read(file);
    check(
      `${file}: «мягкое возвращение» вопросов`,
      /const keep = Math\.max\(1, Math\.floor\(used\.length \/ 2\)\);/.test(src) && src.includes('used = used.slice(-keep);'),
      'в draw-функции нет блока used.slice(-keep) — при исчерпании пула вопросы снова пойдут по кругу от первой карточки'
    );
    check(
      `${file}: память ${field} не обнуляется при старте партии`,
      !new RegExp(`${field}\\[[^\\]]*\\]\\s*=\\s*\\[\\]`).test(src),
      `найден сброс ${field}[…] = [] — вопросы начнут повторяться в каждой новой партии`
    );
  }
  const core = read('games/core.js');
  const resetMatch = core.match(/function performFullReset[\s\S]*?\nfunction /);
  const resetSrc = resetMatch ? resetMatch[0] : core;
  check(
    '«Сбросить прогресс» чистит память викторин',
    ['quizUsed', 'partyQuizUsed', 'soloQuizUsed', 'kidsQuizUsed'].every(f => resetSrc.includes(`state.${f} = {}`)),
    'в performFullReset нет сброса XQuizUsed — после сброса прогресса колода не начнётся с чистого листа'
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
  checkKidsQuizCards();
  checkPartyQuizCards();
  checkQuizNoRepeat();
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
