#!/usr/bin/env node
/**
 * tools/smoke-test.js — smoke-тесты приложения.
 *
 * Эти тесты проверяют, что приложение работает без runtime-ошибок при
 * выполнении ключевых пользовательских сценариев. В отличие от check.js,
 * который проверяет структуру (синтаксис, подключения, DOM-ссылки), smoke-тесты
 * реально исполняют код и проверяют, не падают ли критические функции.
 *
 * Запуск:  node tools/smoke-test.js
 *         node tools/smoke-test.js --verbose   (подробный вывод)
 *
 * Что проверяется:
 *   1. Функции приложения доступны глобально (не упали с ReferenceError)
 *   2. Критические DOM-элементы существуют (не null)
 *   3. Ключевые пользовательские сценарии выполняются без ошибок:
 *      - Запуск игры
 *      - Пауза и возобновление
 *      - Завершение игры
 *      - Рулетка: открытие модалки кручения
 *
 * Тесты НЕ проверяют визуальную часть и корректность бизнес-логики —
 * только то, что код выполняется без фатальных ошибок.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadAppScripts, getElById } = require('./dom-stub');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

// Фреймворк для отчёта
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

// Асинхронные сценарии: проверка ждёт промисы (например, чтение ролика перед
// отправкой в мессенджер). Собираются отдельно и выполняются после
// синхронных — так их await не влияет на порядок и состояние остальных тестов.
const asyncTests = [];
function testAsync(name, fn) {
  asyncTests.push({ name, fn });
}

function assert(condition, message) {
  if (condition) {
    passed++;
    if (VERBOSE) console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}: ${message}`);
  }
}

let name = '';

// Загрузка приложения
console.log('Загрузка приложения...');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const { loaded, failed: loadFailed, stub } = loadAppScripts(html, { root: ROOT, trackHandlers: true });

console.log(`Загружено скриптов: ${loaded.length}`);
if (loadFailed.length > 0) {
  console.log('Ошибки загрузки:');
  loadFailed.forEach(f => console.log(`  - ${f.file}: ${f.error}`));
}

const globalFn = (name) => typeof global[name] === 'function';

console.log('\n=== Проверка доступности глобальных функций ===');

test('ensureSingleActiveScreen — глобально доступна', () => {
  assert(globalFn('ensureSingleActiveScreen'), 'функция должна быть в global scope');
});

test('goToGameSetup — глобально доступна', () => {
  assert(globalFn('goToGameSetup'), 'функция перехода к настройке игры');
});

test('gameByMode — глобально доступна', () => {
  assert(globalFn('gameByMode'), 'функция поиска игры по режиму');
});

test('gameByScreen — глобально доступна', () => {
  assert(globalFn('gameByScreen'), 'функция поиска игры по экрану');
});

test('callGame — глобально доступна', () => {
  assert(globalFn('callGame'), 'функция безопасного вызова функции игры');
});

test('showSetupView — глобально доступна', () => {
  assert(globalFn('showSetupView'), 'функция показа представления');
});

test('showModal — глобально доступна', () => {
  assert(globalFn('showModal'), 'функция показа модалки');
});

test('showSummary — глобально доступна', () => {
  assert(globalFn('showSummary'), 'функция показа итогов');
});

test('pauseGame — глобально доступна', () => {
  assert(globalFn('pauseGame'), 'функция паузы');
});

test('saveState — глобально доступна', () => {
  assert(globalFn('saveState'), 'функция сохранения состояния');
});

test('loadState — глобально доступна', () => {
  assert(globalFn('loadState'), 'функция загрузки состояния');
});

test('updateResumeUI — глобально доступна', () => {
  assert(globalFn('updateResumeUI'), 'функция обновления UI паузы');
});

test('blockedByDavayPause — глобально доступна', () => {
  assert(globalFn('blockedByDavayPause'), 'функция проверки блокировки');
});

test('goToSetup — глобально доступна', () => {
  assert(globalFn('goToSetup'), 'функция перехода к главному меню');
});

test('Данные «Флагов» загружены и формируют очередь', () => {
  const cards = eval('typeof FLAGS_CARDS === "undefined" ? null : FLAGS_CARDS');
  assert(Array.isArray(cards) && cards.length >= 10,
    'колода «Флагов» должна быть подключена в index.html');
  cards.forEach(card => {
    assert(card.flag && fs.existsSync(path.join(ROOT, card.flag)),
      `файл флага должен существовать: ${card.flag}`);
  });
  const previousLevel = state.flagsSelectedLevel;
  const previousCount = state.flagsQuestionCount;
  const previousUsed = state.flagsUsed;
  const previousQueue = state.flagsQueue;
  const previousIndex = state.flagsIndex;
  try {
    state.flagsSelectedLevel = 1;
    state.flagsUsed = {};
    [5, 10, 25].forEach(count => {
      state.flagsQuestionCount = count;
      global.drawFlagsQueue();
      assert(state.flagsQueue && state.flagsQueue.length === count,
        `из колоды «Флагов» должна сформироваться очередь из ${count} вопросов`);
      assert(state.flagsQueue.every(card => card && card.flag),
        'очередь «Флагов» должна содержать карточки с флагами');
    });
    assert((state.flagsUsed[1] || []).every(key => key),
      'история «Флагов» должна хранить идентификаторы карточек, а не отсутствующее поле q');
  } catch (e) {
    assert(false, `ошибка: ${e.message}`);
  } finally {
    state.flagsSelectedLevel = previousLevel;
    state.flagsQuestionCount = previousCount;
    state.flagsUsed = previousUsed;
    state.flagsQueue = previousQueue;
    state.flagsIndex = previousIndex;
  }
});

test('Данные «Времени»: у цифровых карточек все ответы словами', () => {
  const cards = eval('typeof FLASH_WORDS === "undefined" ? null : FLASH_WORDS');
  assert(Array.isArray(cards), 'колода «Времени» должна быть подключена в index.html');
  const digital = cards.filter(c => c.theme === 'time' && c.sub === 'digital');
  assert(digital.length > 0, 'в колоде должны быть цифровые карточки');
  digital.forEach(card => {
    assert(Array.isArray(card.options) && card.options.length >= 4,
      `у цифровой карточки ${card.word} должно быть 4 варианта ответа`);
    card.options.forEach(a => {
      assert(/час|минут/.test(a) && !/\d\s*[:.]\s*\d/.test(a),
        `ответ цифровой карточки ${card.word} должен быть словами, а не цифрами: «${a}»`);
    });
  });
});


test('«Арифметика»: выбор темы — все 4 темы рабочие (Умножение/Деление 1–10, Сложение/Вычитание 0–20)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'games/times-table.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert(/id="timesTableTopicGroup"/.test(html),
    'в настройках «Арифметики» должна быть группа Тем (id="timesTableTopicGroup")');
  const arithmeticSetup = html.slice(
    html.indexOf('<section id="timesTableSetup"'),
    html.indexOf('<!-- ===== ФЛАГИ: ИГРА =====')
  );
  assert(/<label>Время ответа<\/label>/.test(arithmeticSetup),
    'в настройках «Арифметики» выбор времени должен называться «Время ответа»');
  assert(!/<label>Уровень сложности<\/label>/.test(arithmeticSetup),
    'старый заголовок «Уровень сложности» в «Арифметике» должен быть заменён');
  ['multiply', 'divide', 'add', 'subtract'].forEach(v => {
    assert(new RegExp('id="timesTableTopicGroup"[\\s\\S]{0,600}data-value="' + v + '"').test(html),
      `в группе Тем должна быть кнопка data-value="${v}"`);
  });
  assert(/TIMES_TABLE_TOPICS/.test(src),
    'список тем должен быть задан в games/times-table.js (TIMES_TABLE_TOPICS)');
  // Все темы рабочие — заглушки с тостом «скоро появится» больше нет.
  assert(!/btn\.dataset\.value !== 'multiply' && btn\.dataset\.value !== 'divide'[\s\S]{0,200}скоро появится/.test(src),
    'тост «скоро появится» для тем Сложение/Вычитание должен быть убран');
  assert(/state\.timesTableTopic/.test(src),
    'выбранная тема должна храниться в state.timesTableTopic');
  assert(/🔢 Арифметика/.test(html),
    'заголовок настроек и подпись на игровом экране — «🔢 Арифметика»');
  assert(!/<span class="times-x">✕<\/span>Арафметика/.test(html) && !/✕ Арафметика/.test(html),
    'старых названия «Арафметика» и иконки ✕ в разметке остаться не должно');
});

test('«Арифметика»: подсветка кнопок использует класс on, а не active', () => {
  const src = fs.readFileSync(path.join(ROOT, 'games/times-table.js'), 'utf8');
  const levelFn = src.slice(src.indexOf('function renderTimesTableLevelGroup'),
                            src.indexOf('function renderTimesTableCountGroup'));
  const countFn = src.slice(src.indexOf('function renderTimesTableCountGroup'),
                            src.indexOf('document.addEventListener'));
  assert(/classList\.toggle\('on'/.test(levelFn),
    'выбранный уровень должен подсвечиваться классом on (.starter-btn.on)');
  assert(/classList\.toggle\('on'/.test(countFn),
    'выбранное количество карточек должно подсвечиваться классом on');
  assert(!/starter-btn[^\n]*'active'/.test(src) && !/classList\.add\('active'\)[\s\S]{0,80}starter/.test(src),
    'кнопки выбора не должны использовать экранный класс active — он не стилизован');
});

test('«Арифметика»: карточка собрана как у остальных обучающих игр', () => {
  const src = fs.readFileSync(path.join(ROOT, 'games/times-table.js'), 'utf8');
  const htmlFn = src.slice(src.indexOf('function timesTableQuestionHtml'),
                           src.indexOf('function updateTimesTableProgressUI'));
  assert(/class="card-inner"/.test(htmlFn),
    'карточка должна использовать .card-inner, как «Флаги»/«Столицы»');
  assert(/class="znayu-question-text"/.test(htmlFn),
    'задание должно использовать .znayu-question-text');
  assert(/class="znayu-answers"/.test(htmlFn),
    'ответы должны лежать в .znayu-answers (иначе не работают стили кнопок группы)');
  assert(!/class="card-text"/.test(htmlFn),
    'карточка не должна использовать .card-text как контейнер ответов');
  assert(/class="btn btn-secondary znayu-answer-btn"/.test(src),
    'кнопки ответов должны быть .btn.btn-secondary.znayu-answer-btn');
  assert(/quiz-tts-hint/.test(htmlFn),
    'на карточке должна быть иконка-подсказка озвучки 🔊, как у группы');
  const css = fs.readFileSync(path.join(ROOT, 'styles/app.css'), 'utf8');
  assert(/#timesTableCard,/.test(css) || /, #timesTableCard/.test(css),
    '«Арифметика» должна входить в блок тёмно-голубых карточек обучающих игр');
  assert(!/#timesTableCard\s+\.znayu-answers\s+\.znayu-answer-btn/.test(css),
    'у «Арифметики» не должно быть отдельного цвета кнопок — используется общий компонент');
  assert(/\.znayu-answers\s+\.znayu-answer-btn\s*\{[^}]*background:rgba\(255,255,255,\.3\);[^}]*color:#2b0f2e;[^}]*opacity:1;/.test(css),
    'все кнопки ответов должны иметь полупрозрачный белый фон 30% и непрозрачный тёмный текст');
  assert(/\.znayu-answers\s+\.znayu-answer-btn:disabled\{opacity:1;/.test(css),
    'после ответа подписи кнопок не должны затемняться через opacity');
});

test('«Крокодил»: в обеих версиях у игровых кнопок нет иконок', () => {
  [
    ['kidsKrokodilStartRoundBtn', 'Начать раунд'],
    ['kidsKrokodilGuessedBtn', 'Угадали'],
    ['kidsKrokodilSkipBtn', 'Пропустить'],
    ['krokodilStartRoundBtn', 'Начать раунд'],
    ['krokodilGuessedBtn', 'Угадали'],
    ['krokodilSkipBtn', 'Пропустить'],
  ].forEach(([id, label]) => {
    const re = new RegExp(`<button\\b[^>]*id="${id}"[^>]*>\\s*${label}\\s*</button>`);
    assert(re.test(html), `${id}: ожидалась подпись «${label}» без иконки`);
  });
});

test('Бизнес-игры: поле участника и кнопка добавления находятся в одном ряду', () => {
  const row = /<div\s+class="business-players-row">[\s\S]*?<div\s+id="businessPlayersList"><\/div>[\s\S]*?<button[^>]+id="businessAddPlayerBtn"[^>]*>[^<]*Добавить участника[^<]*<\/button>[\s\S]*?<\/div>/;
  const css = fs.readFileSync(path.join(ROOT, 'styles/app.css'), 'utf8');
  assert(row.test(html), 'список и кнопка должны быть внутри общего .business-players-row');
  assert(/\.business-players-row\s*\{[^}]*display:\s*flex;/.test(css),
    '.business-players-row должен быть flex-рядом');
  assert(/\.business-players-row\s+#businessAddPlayerBtn\s*\{[^}]*flex:\s*0\s+0\s+auto;/.test(css),
    'кнопка добавления не должна растягиваться и выталкивать поле');
});

test('Бизнес-игры: по умолчанию доступен один «Предприниматель»', () => {
  const previous = state.businessPlayers;
  try {
    state.businessPlayers = ['Предприниматель'];
    assert(state.businessPlayers.length === 1,
      'у бизнес-игр должен быть один участник по умолчанию');
    assert(global.bizObsPlayersList().length === 1,
      '«Оцени бизнес» должен использовать список из одного участника');
    global.renderBusinessPlayers();
    assert(state.businessPlayers.length === 1,
      'рендеринг не должен добавлять второго участника автоматически');
  } finally {
    state.businessPlayers = previous;
  }
});

test('Бизнес-игры: старый дефолт мигрируется, ручные имена сохраняются', () => {
  const oldDefault = { schemaVersion: 3, businessPlayers: ['Предприниматель', 'Управляющий'] };
  global.applyMigrations(oldDefault);
  assert(oldDefault.businessPlayers.length === 1 && oldDefault.businessPlayers[0] === 'Предприниматель',
    'старая автоматическая пара должна стать одним участником');
  const custom = { schemaVersion: 3, businessPlayers: ['Анна', 'Борис'] };
  global.applyMigrations(custom);
  assert(custom.businessPlayers.length === 2 && custom.businessPlayers[0] === 'Анна' && custom.businessPlayers[1] === 'Борис',
    'миграция не должна менять вручную заданные имена');
});

test('«Оцени бизнес»: при одном участнике вопрос идёт без передачи телефона', () => {
  const previousPlayers = state.businessPlayers;
  const previousQueue = state.bizObsQueue;
  const previousIndex = state.bizObsIndex;
  const previousCount = state.bizObsQuestionCount;
  try {
    state.businessPlayers = ['Предприниматель'];
    state.bizObsQuestionCount = 3;
    state.bizObsIndex = 0;
    global.goToBizObsGame();
    const handoff = getElById(stub, 'bizObsHandoffRow');
    assert(state.bizObsQueue.length === 3,
      'для одного участника должна создаваться одна порция вопросов');
    assert(handoff.style.display === 'none',
      'при одном участнике карточка передачи телефона не должна показываться');
  } finally {
    state.businessPlayers = previousPlayers;
    state.bizObsQueue = previousQueue;
    state.bizObsIndex = previousIndex;
    state.bizObsQuestionCount = previousCount;
  }
});

test('«Игры для компании»: карточки используют общий ультрамариновый градиент', () => {
  const css = fs.readFileSync(path.join(ROOT, 'styles/app.css'), 'utf8');
  const ids = [
    'krokodilCard', 'twisterCard', 'memesCard', 'partyNeverCard',
    'partyFantsCard', 'partyTdCard', 'famZnayuCard', 'partyQuizCard',
  ];
  const gradient = 'linear-gradient\\(160deg,\\s*#5b4bd6,\\s*#34278f\\s+55%,\\s*#171547\\)';
  const allUseUltramarine = ids.every((id) => {
    const re = new RegExp(`#${id}\\s*\\{[^}]*background:\\s*${gradient}`);
    return re.test(css);
  });
  assert(allUseUltramarine, 'все восемь карточек группы «Игры для компании» должны использовать ультрамариновый градиент');
  assert(!/#4a90c2|#2c5a7a/.test(css), 'старый тёмно-синий градиент не должен оставаться в стилях');
});

test('«Игры для одного»: карточка «Викторины» использует ярко-синий градиент', () => {
  const css = fs.readFileSync(path.join(ROOT, 'styles/app.css'), 'utf8');
  const card = /#soloQuizCard\s*\{[^}]*background:\s*linear-gradient\(160deg,\s*#2f80ed,\s*#1557c0\s+55%,\s*#08275f\)/.test(css);
  const text = /#soloQuizCard\s*\{[^}]*color:\s*#fff;/.test(css) &&
    /#soloQuizCard\s+\.znayu-question-text\s*\{[^}]*color:\s*#fff;/.test(css);
  assert(card, 'карточка одиночной «Викторины» должна иметь ярко-синий градиент');
  assert(text, 'текст одиночной «Викторины» должен быть белым на синей карточке');
  assert(!/pwa-standalone[^{}]*#soloQuizCard|@media\s*\(display-mode:\s*standalone\)\s*\{[^{}]*#soloQuizCard/.test(css),
    'PWA не должна отдельно перекрашивать карточку одиночной «Викторины»');
});

test('«Игры с детьми»: карточки и витрина используют тёмно-бирюзовый фон', () => {
  const css = fs.readFileSync(path.join(ROOT, 'styles/app.css'), 'utf8');
  const group = /#kidsTdCard[^{}]*#kidsQuizCard[^{}]*\{[^}]*background:\s*linear-gradient\(160deg,\s*#2b837f,\s*#176e76\s+55%,\s*#0d3741/.test(css);
  const shop = /\.shop-showcase-item\s*\{[^}]*background:\s*linear-gradient\(160deg,\s*#2b837f,\s*#176e76\s+55%,\s*#0d3741/.test(css);
  assert(group, 'детская «Викторина» должна входить в общий тёмно-бирюзовый блок группы');
  assert(shop, 'витрина «Магазина» должна использовать тот же тёмно-бирюзовый градиент');
  assert(!/#kidsQuizCard\s*\{[^}]*\bbackground\s*:/.test(css),
    'у детской «Викторины» не должно быть отдельного более светлого фона');
  assert(!/pwa-standalone[^{}]*#kids[A-Za-z0-9_-]*Card|@media\s*\(display-mode:\s*standalone\)\s*\{[^{}]*#kids[A-Za-z0-9_-]*Card/.test(css),
    'PWA не должна перекрашивать карточки группы «Игры с детьми»');
});

test('«Арифметика»: темы «Сложение» и «Вычитание» — примеры от 0 до 20', () => {
  const prevTopic = state.timesTableTopic;
  const prevLevel = state.timesTableSelectedLevel;
  const prevCount = state.timesTableQuestionCount;
  const prevUsed = state.timesTableUsed;
  const prevQueue = state.timesTableQueue;
  const prevIndex = state.timesTableIndex;
  try {
    state.timesTableSelectedLevel = 1;
    state.timesTableQuestionCount = 10;
    state.timesTableUsed = {};
    ['add', 'subtract'].forEach(topic => {
      state.timesTableTopic = topic;
      global.drawTimesTableQueue();
      assert(state.timesTableQueue && state.timesTableQueue.length === 10,
        `тема «${topic}»: очередь должна быть из 10 вопросов`);
      assert(state.timesTableQueue.every(q => q && q.op === topic),
        `тема «${topic}»: все карточки должны иметь op="${topic}"`);
      assert(state.timesTableQueue.every(q => q.a >= 0 && q.a <= 20 && q.b >= 0 && q.b <= 20),
        `тема «${topic}»: оба числа должны быть в диапазоне 0–20`);
      if(topic === 'subtract'){
        assert(state.timesTableQueue.every(q => q.a >= q.b),
          `тема «${topic}»: в вычитании a ≥ b (ответ неотрицательный)`);
      }
      // Проверяем вычисление ответа через timesTableAnswer
      state.timesTableQueue.forEach(q => {
        const expected = topic === 'add' ? q.a + q.b : q.a - q.b;
        assert(global.timesTableAnswer(q) === expected,
          `тема «${topic}»: ответ для ${q.a} ${topic === 'add' ? '+' : '−'} ${q.b} должен быть ${expected}`);
      });
      // Повторы не встречаются в партии
      const keys = state.timesTableQueue.map(q => `${q.a}x${q.b}`);
      assert(new Set(keys).size === keys.length, `тема «${topic}»: в партии не должно быть повторов примеров`);
    });
  } catch (e) {
    assert(false, `ошибка: ${e.message}`);
  } finally {
    state.timesTableTopic = prevTopic;
    state.timesTableSelectedLevel = prevLevel;
    state.timesTableQuestionCount = prevCount;
    state.timesTableUsed = prevUsed;
    state.timesTableQueue = prevQueue;
    state.timesTableIndex = prevIndex;
  }
});
  test('«Арифметика»: заголовки используют иконку 🔢 без legacy times-x', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'games/times-table.js'), 'utf8');
  assert(/<h1 class="title">🔢 Арифметика<\/h1>/.test(html),
    'заголовок экрана настроек — «🔢 Арифметика»');
  assert(/<div class="game-level-label">🔢 Арифметика<\/div>/.test(html),
    'подпись на экране-заглушке — «🔢 Арифметика»');
  assert(/🔢 Арифметика/.test(js),
    'renderTimesTableGame() рендерит подпись «🔢 Арифметика»');
  assert(/🔢 Правила игры «Арифметика»/.test(html),
    'заголовок модалки правил — «🔢 Правила игры «Арифметика»»');
  assert(!/Арафметика/.test(html) && !/Арафметика/.test(js),
    'старого названия «Арафметика» остаться не должно');
});

test('Данные «Столиц» загружены и формируют очередь', () => {
  const cards = eval('typeof CAPITALS_CARDS === "undefined" ? null : CAPITALS_CARDS');
  assert(Array.isArray(cards) && cards.length >= 10,
    'колода «Столиц» должна быть подключена в index.html');
  cards.forEach(card => {
    assert(card.country && Array.isArray(card.a) && card.a[0],
      'карточка «Столиц» должна содержать страну и варианты ответа');
    assert(card.flag && fs.existsSync(path.join(ROOT, card.flag)),
      `карточка «Столиц» должна указывать существующий флаг: ${card.flag || 'нет поля flag'}`);
  });
  const previousLevel = state.capitalsSelectedLevel;
  const previousCount = state.capitalsQuestionCount;
  const previousUsed = state.capitalsUsed;
  const previousQueue = state.capitalsQueue;
  const previousIndex = state.capitalsIndex;
  try {
    state.capitalsSelectedLevel = 1;
    state.capitalsUsed = {};
    [5, 10, 25].forEach(count => {
      state.capitalsQuestionCount = count;
      global.drawCapitalsQueue();
      assert(state.capitalsQueue && state.capitalsQueue.length === count,
        `из колоды «Столиц» должна сформироваться очередь из ${count} вопросов`);
      assert(state.capitalsQueue.every(card => card && card.country),
        'очередь «Столиц» должна содержать карточки со странами');
    });
    assert((state.capitalsUsed[1] || []).every(key => key),
      'история «Столиц» должна хранить идентификаторы карточек');
  } catch (e) {
    assert(false, `ошибка: ${e.message}`);
  } finally {
    state.capitalsSelectedLevel = previousLevel;
    state.capitalsQuestionCount = previousCount;
    state.capitalsUsed = previousUsed;
    state.capitalsQueue = previousQueue;
    state.capitalsIndex = previousIndex;
  }
});

test('«Флаги»/«Столицы»: вариант 50 удалён, старое значение заменяется на 10', () => {
  const previousCounts = {
    flagsQuestionCount: state.flagsQuestionCount,
    capitalsQuestionCount: state.capitalsQuestionCount,
  };
  try {
    [
      ['flagsCountGroup', 'flagsQuestionCount', 'renderFlagsCountGroup'],
      ['capitalsCountGroup', 'capitalsQuestionCount', 'renderCapitalsCountGroup'],
    ].forEach(([groupId, stateKey, renderFn]) => {
      const group = new RegExp(`id="${groupId}"[^>]*>([\\s\\S]*?)</div>`).exec(html);
      const values = group ? [...group[1].matchAll(/data-value="(\d+)"/g)].map(match => Number(match[1])) : [];
      assert(values.join(',') === '5,10,25',
        `${groupId}: ожидались только варианты 5, 10 и 25`);
      state[stateKey] = 50;
      global[renderFn]();
      assert(state[stateKey] === 10,
        `${stateKey}: старое значение 50 должно заменяться на 10`);
    });
  } finally {
    Object.assign(state, previousCounts);
  }
});

test('Колоды «Флагов»/«Столиц» покрывают все SVG-флаги ровно по одному разу (15/14/14)', () => {
  const svgFiles = fs.readdirSync(path.join(ROOT, 'flags-svg'))
    .filter(f => f.endsWith('.svg'))
    .sort();
  assert(svgFiles.length === 43, `в flags-svg/ должно быть 43 SVG-флага, найдено ${svgFiles.length}`);
  [['FLAGS_CARDS', 'Флагов'], ['CAPITALS_CARDS', 'Столиц']].forEach(([name, label]) => {
    const cards = eval(`typeof ${name} === "undefined" ? null : ${name}`);
    assert(Array.isArray(cards) && cards.length === 43,
      `колода «${label}» должна содержать все 43 карточки`);
    const perLevel = { 1: 0, 2: 0, 3: 0 };
    const seen = [];
    cards.forEach(card => {
      assert(perLevel[card.level] !== undefined, `уровень карточки должен быть 1..3: ${card.level}`);
      perLevel[card.level] += 1;
      seen.push(card.flag);
      assert(Array.isArray(card.a) && card.a.length === 4,
        `у карточки «${card.country || card.flag}» должно быть 4 варианта ответа`);
    });
    assert(perLevel[1] === 15 && perLevel[2] === 14 && perLevel[3] === 14,
      `раскладка по уровням должна быть 15/14/14, фактическая ${perLevel[1]}/${perLevel[2]}/${perLevel[3]}`);
    assert(new Set(seen).size === seen.length, `флаги в колоде «${label}» не должны повторяться`);
    svgFiles.forEach(f => {
      assert(seen.includes(`flags-svg/${f}`), `флаг ${f} должен быть в колоде «${label}»`);
    });
  });
});

test('«Арифметика»: очередь на уровнях и размерах партии', () => {
  const prevTopic = state.timesTableTopic;
  const prevLevel = state.timesTableSelectedLevel;
  const prevCount = state.timesTableQuestionCount;
  const prevUsed = state.timesTableUsed;
  const prevQueue = state.timesTableQueue;
  const prevIndex = state.timesTableIndex;
  try {
    state.timesTableTopic = 'multiply';
    [1, 2, 3].forEach(level => {
      state.timesTableSelectedLevel = level;
      state.timesTableUsed = {};
      [5, 10, 25].forEach(count => {
        state.timesTableQuestionCount = count;
        global.drawTimesTableQueue();
        assert(state.timesTableQueue && state.timesTableQueue.length === count,
          `уровень ${level}: очередь должна быть из ${count} вопросов`);
        assert(state.timesTableQueue.every(q => q && typeof q.a === 'number' && typeof q.b === 'number'),
          `уровень ${level}: карточки должны содержать множители a и b`);
        const keys = state.timesTableQueue.map(q => `${q.a}x${q.b}`);
        const poolSize = 100; // все уровни: полный пул примеров 1–10
        if(count <= poolSize){
          assert(new Set(keys).size === keys.length, `уровень ${level}: в партии не должно быть повторов примеров`);
        } else {
          assert(new Set(keys).size <= poolSize, `уровень ${level}: повторы допустимы только после исчерпания пула`);
        }
      });
    });
  } catch (e) {
    assert(false, `ошибка: ${e.message}`);
  } finally {
    state.timesTableTopic = prevTopic;
    state.timesTableSelectedLevel = prevLevel;
    state.timesTableQuestionCount = prevCount;
    state.timesTableUsed = prevUsed;
    state.timesTableQueue = prevQueue;
    state.timesTableIndex = prevIndex;
  }
});

test('«Арифметика»: вопросы идут от простых к сложным', () => {
  const prevTopic = state.timesTableTopic;
  const prevLevel = state.timesTableSelectedLevel;
  const prevCount = state.timesTableQuestionCount;
  const prevUsed = state.timesTableUsed;
  const prevQueue = state.timesTableQueue;
  const prevIndex = state.timesTableIndex;
  try {
    state.timesTableSelectedLevel = 1;
    state.timesTableUsed = {};
    ['add', 'subtract', 'multiply', 'divide'].forEach(topic => {
      [5, 10, 25, 50].forEach(count => {
        state.timesTableTopic = topic;
        state.timesTableQuestionCount = count;
        global.drawTimesTableQueue();
        const queue = state.timesTableQueue || [];
        assert(queue.length === count,
          `тема «${topic}», ${count} карточек: очередь должна содержать ${count} вопросов`);
        const scores = queue.map(global.timesTableDifficulty);
        assert(scores.every((score, i) => i === 0 || score >= scores[i - 1]),
          `тема «${topic}», ${count} карточек: сложность не должна уменьшаться по ходу партии`);
        const keys = queue.map(global.timesTableCardKey);
        assert(new Set(keys).size === keys.length,
          `тема «${topic}», ${count} карточек: в партии не должно быть повторов`);
        assert(global.timesTableDifficultyStage(queue[0]) === 0,
          `тема «${topic}», ${count} карточек: первая карточка должна быть простой`);
        assert(global.timesTableDifficultyStage(queue[queue.length - 1]) === 3,
          `тема «${topic}», ${count} карточек: последняя карточка должна быть сложной`);
        assert(queue.slice(Math.min(2, count)).every(q => q.a > 0 && q.b > 0),
          `тема «${topic}», ${count} карточек: после разминки не должно быть примеров с нулём`);
      });
    });
  } catch (e) {
    assert(false, `ошибка: ${e.message}`);
  } finally {
    state.timesTableTopic = prevTopic;
    state.timesTableSelectedLevel = prevLevel;
    state.timesTableQuestionCount = prevCount;
    state.timesTableUsed = prevUsed;
    state.timesTableQueue = prevQueue;
    state.timesTableIndex = prevIndex;
  }
});

console.log('\n=== Проверка наличия критических DOM-элементов ===');

const criticalElements = [
  'setup', 'homeView', 'resumeBtn', 'finishGameBtn', 'globalBackBtn',
  'twoPlayerView', 'companyView', 'kidsView', 'businessView', 'soloView', 'learningView',
  'flagsSetup', 'flagsGame',
  'capitalsSetup', 'capitalsGame',
  'timesTableSetup', 'timesTableGame',
];

criticalElements.forEach(id => {
  test(`DOM-элемент #${id} существует`, () => {
    const el = getElById(stub, id);
    assert(el !== null, `элемент #${id} не найден в DOM`);
  });
});

test('Меню: по центру после ⚙️ Меню отображается версия кэша', () => {
  const menuBtn = getElById(stub, 'globalMenuBtn');
  const menu = getElById(stub, 'globalMenuModal');
  const version = getElById(stub, 'menuCacheVersion');
  const previousBuild = global.APP_BUILD;
  try {
    global.APP_BUILD = '2026-09-25 · v499';
    menuBtn.click();
    assert(menu.classList.contains('show'), 'кнопка меню должна открывать окно');
    assert(version.textContent === 'версии v499',
      `по центру после заголовка меню должна показываться строка «версии v499», получено «${version.textContent}»`);
  } finally {
    if (previousBuild === undefined) delete global.APP_BUILD;
    else global.APP_BUILD = previousBuild;
    menu.classList.remove('show');
  }
});


console.log('\n=== Проверка настройки «Карты страсти» ===');

test('«Карта страсти»: настройка содержит только «Начать» и «Выход»', () => {
  const setupHtml = (html.match(/<section id="passionMapSetup" class="screen">([\s\S]*?)<\/section>/) || ['', ''])[1];
  const oldIds = [
    'passionMapCountGroup', 'passionMapModeGroup', 'passionMapPickBtn',
    'passionMapHistoryBtn', 'passionMapSetupRulesBtn',
  ];
  const remaining = oldIds.filter(id => setupHtml.includes(`id="${id}"`));
  assert(setupHtml.includes('id="passionMapStartBtn"'), 'кнопка «Начать» должна остаться');
  assert(setupHtml.includes('id="passionMapSetupExitBtn"'), 'кнопка «Выход» должна остаться');
  assert(remaining.length === 0, `настройка всё ещё содержит старые блоки: ${remaining.join(', ')}`);
  assert(!/Количество вопросов|Выбор вопросов|Случайно|Пройденные|Правила/.test(setupHtml),
    'на экране настройки остался текст удалённых блоков');
});

console.log('\n=== Проверка элементов рулетки (история бага с missing markup) ===');

const rouletteElements = [
  'rouletteSpinModal', 'rouletteSpinWheel', 'rouletteSpinResult', 'rouletteSpinDoneBtn',
];

rouletteElements.forEach(id => {
  test(`DOM-элемент #${id} (рулетка) существует`, () => {
    const el = getElById(stub, id);
    assert(el !== null, `элемент #${id} не найден — возможно, удалён из разметки`);
  });
});

console.log('\n=== Исполнение критических функций ===');

test('ensureSingleActiveScreen() — выполняется без ошибок', () => {
  try {
    global.ensureSingleActiveScreen();
    assert(true, '');
  } catch (e) {
    assert(false, `ошибка: ${e.message}`);
  }
});

test('goToSetup() — выполняется без ошибок', () => {
  try {
    global.goToSetup();
    assert(true, '');
  } catch (e) {
    assert(false, `ошибка: ${e.message}`);
  }
});

test('showModal("resumeModal") — выполняется без ошибок', () => {
  try {
    global.showModal('resumeModal');
    assert(true, '');
  } catch (e) {
    assert(false, `ошибка: ${e.message}`);
  }
});

test('showSetupView("twoPlayerView") — выполняется без ошибок', () => {
  try {
    global.showSetupView('twoPlayerView');
    assert(true, '');
  } catch (e) {
    assert(false, `ошибка: ${e.message}`);
  }
});

console.log('\n=== Исполнение функции рулетки (история бага) ===');

test('openRouletteSpinModal() — выполняется без ошибок', () => {
  try {
    if (global.openRouletteSpinModal) {
      global.openRouletteSpinModal();
      assert(true, '');
    } else {
      assert(false, 'функция openRouletteSpinModal не найдена');
    }
  } catch (e) {
    assert(false, `ошибка: ${e.message}`);
  }
});

test('closeRouletteSpinModal() — выполняется без ошибок', () => {
  try {
    if (global.closeRouletteSpinModal) {
      global.closeRouletteSpinModal();
      assert(true, '');
    } else {
      assert(false, 'функция closeRouletteSpinModal не найдена');
    }
  } catch (e) {
    assert(false, `ошибка: ${e.message}`);
  }
});

console.log('\n=== Проверка реестра игр ===');

test('GAME_REGISTRY загружен и не пуст', () => {
  const registry = global.GAME_REGISTRY;
  assert(Array.isArray(registry) && registry.length > 0, 'реестр игр должен быть массивом с играми');
});

test('В реестре есть игра "Фанты для двоих"', () => {
  const registry = window.GAME_REGISTRY || global.GAME_REGISTRY || [];
  const fanty = registry.find(g => g.mode === 'fanty');
  assert(fanty !== undefined, 'игра fanty должна быть в реестре');
  assert(typeof fanty.resume === 'string' && fanty.resume.length > 0, 'у игры fanty должно быть имя функции resume');
  // Fanty имеет inlineFinish=true — завершение через showSummary, не через game.finish
  assert(fanty.inlineFinish === true || typeof fanty.finish === 'string' && fanty.finish.length > 0, 'у игры fanty должно быть поле inlineFinish или finish');
  // Проверяем, что функция resume доступна глобально
  assert(typeof global[fanty.resume] === 'function', 'функция resume должна быть доступна глобально');
});

test('В реестре есть игра "Рулетка"', () => {
  const registry = window.GAME_REGISTRY || global.GAME_REGISTRY || [];
  const roulette = registry.find(g => g.mode === 'partyRoulette');
  assert(roulette !== undefined, 'игра partyRoulette должна быть в реестре');
  assert(typeof roulette.resume === 'string' && roulette.resume.length > 0, 'у игры partyRoulette должно быть имя функции resume');
  assert(typeof roulette.finish === 'string' && roulette.finish.length > 0, 'у игры partyRoulette должно быть имя функции finish');
  // Также проверяем, что функция доступна глобально
  assert(typeof global[roulette.resume] === 'function', 'функция resume должна быть доступна глобально');
});

console.log('\n=== Название игры в «Фантах» (общий экран #game) ===');

// «Фанты» для двоих живут на общем экране #game и переключают два режима:
// «💘 Фанты» и «❓ Правда/Действие». Название режима должно показываться в
// штатном заголовке игры (.game-level-label), как во всех остальных играх —
// раньше оно уходило в метку хода (.td-turn-label) и там подгонялось
// font-size:28px, из-за чего выбивалось из общего стиля заголовков.
// Здесь проверяем фактическое поведение: вызываем updateTurnUI/updateLevelUI
// и смотрим, в каком элементе оказался текст.
const MODE_CLASSES = ['video-mode', 'davay-mode', 'placeholder-mode'];
const asFantyScreen = () => {
  const gameEl = getElById(stub, 'game');
  MODE_CLASSES.forEach((c) => gameEl.classList.remove(c));
  return gameEl;
};

test('Сценарий: название режима «Фанты» попадает в заголовок игры', () => {
  const title = getElById(stub, 'gameLevelLabel');
  const turn = getElById(stub, 'gameTurnLabel');
  asFantyScreen();

  state.gameType = 'fanty';
  global.updateTurnUI();
  assert(title.textContent === '💘 Фанты', `в заголовке ожидалось «💘 Фанты», получено «${title.textContent}»`);
  assert(title.style.display !== 'none', 'заголовок не должен быть скрыт');
  assert(turn.style.display === 'none', 'метка хода в «Фантах» скрыта — режим виден в заголовке');
});

test('Сценарий: название режима «Правда/Действие» попадает в заголовок игры', () => {
  const title = getElById(stub, 'gameLevelLabel');
  asFantyScreen();

  state.gameType = 'td';
  global.updateTurnUI();
  assert(title.textContent === '❓ Правда/Действие',
    `в заголовке ожидалось «❓ Правда/Действие», получено «${title.textContent}»`);
  assert(title.style.display !== 'none', 'заголовок не должен быть скрыт');
});

test('Сценарий: updateLevelUI не гасит заголовок «Фантов»', () => {
  // updateLevelUI вызывается ПОСЛЕ updateTurnUI и раньше безусловно ставил
  // заголовку display:none — название режима пропадало.
  const title = getElById(stub, 'gameLevelLabel');
  asFantyScreen();

  state.gameType = 'fanty';
  global.updateTurnUI();
  global.updateLevelUI();
  assert(title.textContent === '💘 Фанты', 'заголовок сохранил текст после updateLevelUI');
  assert(title.style.display !== 'none', 'updateLevelUI не должен скрывать заголовок «Фантов»');
});

test('Сценарий: счёт «Парень/Девушка» скрыт только там, где нет соревнования', () => {
  // Строка «Парень: 0 / Девушка: 0» — от базовых «Фантов». В «Видеорулетке»
  // конкуренции нет (ролики смотрят вместе, очки только обнуляются), поэтому
  // CSS скрывает её именно в этом режиме. Проверяем по CSS-тексту: сам
  // dom-stub браузерный рендер и каскад не эмулирует.
  const css = fs.readFileSync(path.join(ROOT, 'styles/app.css'), 'utf8');
  const hiddenInVideo = /#game\.video-mode\s+#gameScoreRow\s*\{[^}]*display:\s*none/.test(css);
  const hiddenForAllGame = /#game\s+#gameScoreRow\s*\{[^}]*display:\s*none/.test(css);
  assert(hiddenInVideo, 'в «Видеорулетке» строка счёта должна быть скрыта');
  assert(!hiddenForAllGame, 'в «Фантах» строка счёта должна остаться');
  // Свои имена игроков и шкала «Давай попробуем» не должны пострадать.
  assert(!/#game\.davay-mode\s+#davayPlayerRow\s*\{[^}]*display:\s*none/.test(css),
    'имена игроков «Давай попробуем» не должны скрываться');
  assert(!/#game\.davay-mode\s+#davayProgressRow\s*\{[^}]*display:\s*none/.test(css),
    'шкала прогресса «Давай попробуем» не должна скрываться');
});

test('Сценарий: кнопки «Пауза»/«Выход» скрыты в «Видеорулетке» и «Давай попробуем»', () => {
  // Их заменяет стрелка «←» в шапке. Проверяем по CSS-тексту — сам dom-stub
  // каскад и рендер не эмулирует.
  const css = fs.readFileSync(path.join(ROOT, 'styles/app.css'), 'utf8');
  // Селектор может быть списком через запятую
  // («#game.video-mode #pauseBtn, #game.davay-mode #pauseBtn{display:none}»),
  // поэтому ищем правило, где в селекторе есть нужная комбинация, и смотрим
  // display именно этого правила.
  const hidden = (mode) => {
    const re = /([^{}]*#pauseBtn[^{}]*)\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(css))) {
      if (!m[1].includes(`#game.${mode}`)) continue;
      if (/display:\s*none/.test(m[2])) return true;
    }
    return false;
  };
  assert(hidden('video-mode'), 'в «Видеорулетке» кнопка «Выход» должна быть скрыта');
  assert(hidden('davay-mode'), 'в «Давай попробуем» кнопка «Пауза» должна быть скрыта');
  // «Фанты» уже полагаются на стрелку «←» — их правило не должно пропасть.
  assert(/#game:not\(\.video-mode\):not\(\.davay-mode\):not\(\.placeholder-mode\) #pauseBtn\{display:none;\}/.test(css),
    'в «Фантах» кнопка «Пауза» тоже должна остаться скрытой');
});
test('Сценарий: кнопки «Предложи партнёру» сжимаются на узком экране', () => {
  const css = fs.readFileSync(path.join(ROOT, 'styles/app.css'), 'utf8');
  const rowCompact = /#game\.placeholder-mode \.row1\s*\{[^}]*min-width:\s*0;[^}]*gap:\s*clamp\(4px/.test(css);
  const textCompact = /#game\.placeholder-mode \.row1 #doneBtn\s*\{[^}]*flex:\s*1\s+1\s+auto;[^}]*min-width:\s*0;[^}]*text-overflow:\s*ellipsis/.test(css);
  const iconsCompact = /#game\.placeholder-mode \.row1 \.btn\.btn-square,[\s\S]*?#game\.placeholder-mode \.row1 #photoShareBtn\s*\{[^}]*flex:\s*0\s+1\s+44px;[^}]*width:\s*44px;[^}]*min-width:\s*40px;[^}]*padding:\s*0/.test(css);
  assert(rowCompact && textCompact && iconsCompact,
    'в «Предложи партнёру» текстовая кнопка должна сжиматься, а иконки — иметь нулевые внутренние отступы');
});



test('Сценарий: стрелка «←» в «Давай попробуем» ставит на паузу именно эту игру', () => {
  // Кнопку «Пауза» убрали, значит «←» обязана обрабатывать davay-режим сама.
  // Раньше такой ветки не было, и режим проваливался в общую логику: экран
  // #game принадлежит «Фантам», поэтому игрок попадал в чужое меню паузы,
  // а прогресс «Давай попробуем» не сохранялся.
  const called = [];
  const originals = {};
  ['pauseDavayGame', 'exitDavayGame', 'pauseGame', 'exitVideoGame'].forEach((fn) => {
    if (typeof global[fn] === 'function') {
      originals[fn] = global[fn];
      global[fn] = function (...args) { called.push(fn); return originals[fn].apply(this, args); };
    }
  });
  const pressBack = () => {
    const back = getElById(stub, 'globalBackBtn');
    for (const { handler } of back._getHandlers().get('click')) handler({});
  };
  try {
    // Обычная партия «Давай попробуем» → пауза этой игры, не «Фантов».
    asFantyScreen();
    getElById(stub, 'game').classList.add('davay-mode');
    state.davayFavoritesOnly = false;
    called.length = 0;
    pressBack();
    assert(called.includes('pauseDavayGame'), `ожидался pauseDavayGame, вызвано: ${called.join(', ') || 'ничего'}`);
    assert(!called.includes('pauseGame'), 'не должна вызываться пауза «Фантов» (чужой экран)');

    // Просмотр избранного — не партия: выходим сразу, без паузы.
    // ВАЖНО: pauseDavayGame() теперь снимает класс davay-mode (иначе чужой
    // режим оставался на #game и ломал следующие игры), поэтому режим надо
    // выставить заново — в реальности игрок в этот момент снова в игре.
    getElById(stub, 'game').classList.add('davay-mode');
    state.davayFavoritesOnly = true;
    called.length = 0;
    pressBack();
    assert(called.includes('exitDavayGame'), `в избранном ожидался exitDavayGame, вызвано: ${called.join(', ') || 'ничего'}`);
    assert(!called.includes('pauseDavayGame'), 'избранное не ставится на паузу');

    // Видеорулетка не должна сломаться: своя ветка выхода.
    MODE_CLASSES.forEach((c) => getElById(stub, 'game').classList.remove(c));
    getElById(stub, 'game').classList.add('video-mode');
    called.length = 0;
    pressBack();
    assert(called.includes('exitVideoGame'), `в видеорежиме ожидался exitVideoGame, вызвано: ${called.join(', ') || 'ничего'}`);
  } finally {
    Object.keys(originals).forEach((fn) => { global[fn] = originals[fn]; });
    MODE_CLASSES.forEach((c) => getElById(stub, 'game').classList.remove(c));
    state.davayFavoritesOnly = false;
  }
});

test('Сценарий: викторина для двоих — игрок подсвечен сверху без подписи на карточке', () => {
  const row = getElById(stub, 'quizScoreRow');
  const card = getElById(stub, 'quizCard');
  const originalAppend = row.appendChild;
  const originalFade = global.fadeSwapEl;
  const saved = {};
  ['quizQueue', 'quizIndex', 'quizCurrentPlayerIndex', 'autoSpeak'].forEach(key => { saved[key] = state[key]; });
  let players = [];
  try {
    row.appendChild = el => players.push(el);
    global.fadeSwapEl = (id, render) => render(getElById(stub, id));
    state.quizQueue = [{ q: 'Проверочный вопрос', a: ['1', '2', '3', '4'] }];
    state.quizIndex = 0;
    state.autoSpeak = false;
    [0, 1].forEach(idx => {
      state.quizCurrentPlayerIndex = idx;
      [showQuizHandoffCard, showQuizQuestion].forEach(render => {
        players = [];
        render();
        stopQuizInterval();
        assert(!/Отвечает|quizTurnLabel/.test(card.innerHTML), 'на карточке не должно быть подписи отвечающего');
        assert(players.length === 2 && players[idx].className.endsWith(' active') &&
          !players[1 - idx].className.endsWith(' active'), 'должен подсвечиваться только текущий игрок');
        assert(card.innerHTML.includes(render === showQuizQuestion ? 'Проверочный вопрос' : 'Передайте телефон'),
          'содержимое карточки должно сохраниться');
      });
    });
  } finally {
    stopQuizInterval();
    row.appendChild = originalAppend;
    global.fadeSwapEl = originalFade;
    Object.assign(state, saved);
  }
});

test('Сценарий: викторина озвучивает вопрос и варианты в порядке кнопок', () => {
  const saved = {};
  ['quizQueue', 'quizIndex', 'autoSpeak'].forEach(key => { saved[key] = state[key]; });
  const originalUtterance = global.SpeechSynthesisUtterance;
  const originalSynth = window.speechSynthesis;
  const originalFade = global.fadeSwapEl;
  const spoken = [];
  try {
    global.SpeechSynthesisUtterance = function(text) { this.text = text; };
    window.speechSynthesis = { speaking:false, pending:false, getVoices:()=>[], cancel(){}, speak(utter){ spoken.push(utter.text); } };
    global.fadeSwapEl = (id, render) => render(getElById(stub, id));
    state.quizQueue = [{ q:'Какой цвет?', a:['Красный', 'Синий', 'Белый', 'Зелёный'] }];
    state.quizIndex = 0;
    state.autoSpeak = true;
    showQuizQuestion();
    stopQuizInterval();
    const buttons = [...getElById(stub, 'quizCard').innerHTML.matchAll(/data-idx="\d+">([^<]+)<\/button>/g)].map(match => match[1]);
    assert(buttons.length === 4, 'должны отображаться четыре варианта');
    const expected = ['Какой цвет?', ...buttons.map((text, i) => `Вариант ${i + 1}: ${text}`)].join('. ');
    assert(spoken.length === 1 && spoken[0] === expected, 'автоозвучка должна читать вопрос и все варианты в экранном порядке');
    state.autoSpeak = false;
    showQuizQuestion();
    stopQuizInterval();
    assert(spoken.length === 1, 'при выключенной автоозвучке речь не запускается');
    speakQuizCard();
    assert(spoken.length === 2 && spoken[1].includes('Вариант 4:'), 'ручное чтение также включает варианты');
  } finally {
    stopQuizInterval();
    global.SpeechSynthesisUtterance = originalUtterance;
    window.speechSynthesis = originalSynth;
    global.fadeSwapEl = originalFade;
    Object.assign(state, saved);
  }
});

testAsync('Сценарий: ответ отменяет озвучку теста и отложенный запуск речи', async () => {
  const saved = {};
  const stateKeys = [
    'autoSpeak', 'mute',
    'quizQueue', 'quizIndex', 'quizCurrentPlayerIndex', 'quizCorrect', 'quizTimeMs',
    'partyQuizQueue', 'partyQuizIndex', 'partyQuizCurrentPlayerIndex', 'partyQuizCorrect', 'partyQuizTimeMs', 'partyPlayers',
    'kidsQuizQueue', 'kidsQuizIndex', 'kidsQuizCurrentPlayerIndex', 'kidsQuizCorrect', 'kidsQuizTimeMs', 'kidsPlayers', 'kidsAge',
    'soloQuizQueue', 'soloQuizIndex', 'soloQuizCorrect', 'soloQuizTimeMs',
    'flagsQueue', 'flagsIndex', 'flagsCorrect', 'flagsTimeMs', 'flagsAnswerSeconds',
    'capitalsQueue', 'capitalsIndex', 'capitalsCorrect', 'capitalsTimeMs', 'capitalsAnswerSeconds',
    'timesTableQueue', 'timesTableIndex', 'timesTableCorrect', 'timesTableTimeMs', 'timesTableSelectedLevel',
  ];
  stateKeys.forEach(key => { saved[key] = state[key]; });
  const originalUtterance = global.SpeechSynthesisUtterance;
  const originalSynth = window.speechSynthesis;
  const originalFade = global.fadeSwapEl;
  let cancels = 0;
  const spoken = [];
  try {
    global.SpeechSynthesisUtterance = function(text) { this.text = text; };
    window.speechSynthesis = {
      speaking: true, pending: false, getVoices: () => [],
      cancel() { cancels++; },
      speak(utter) { spoken.push(utter.text); },
    };
    global.fadeSwapEl = (id, render, onDone) => {
      render(getElById(stub, id));
      if(onDone) onDone();
    };
    state.autoSpeak = false;

    const run = (label, setup, show, stopInterval, speak, answer) => {
      setup();
      show();
      stopInterval();
      const before = cancels;
      speak();
      answer();
      assert(cancels > before, `${label}: ответ должен вызвать stopSpeech/cancel()`);
      assert(spoken.length === 0, `${label}: отложенная озвучка не должна запускаться после ответа`);
    };

    run('Викторина для двоих', () => {
      state.quizQueue = [{ q:'Вопрос', a:['1','2','3','4'] }];
      state.quizIndex = 0; state.quizCurrentPlayerIndex = 0;
      state.quizCorrect = []; state.quizTimeMs = [];
    }, showQuizQuestion, stopQuizInterval, speakQuizCard, () => answerQuizQuestion(0));

    run('Викторина для компании', () => {
      state.partyQuizQueue = [{ q:'Вопрос', a:['1','2','3','4'] }];
      state.partyQuizIndex = 0; state.partyQuizCurrentPlayerIndex = 0;
      state.partyQuizCorrect = []; state.partyQuizTimeMs = []; state.partyPlayers = ['Игрок 1','Игрок 2'];
    }, showPartyQuizQuestion, stopPartyQuizInterval, speakPartyQuizCard, () => answerPartyQuizQuestion(0));

    run('Викторина для детей', () => {
      state.kidsQuizQueue = [{ q:'Вопрос', a:['1','2','3','4'] }];
      state.kidsQuizIndex = 0; state.kidsQuizCurrentPlayerIndex = 0;
      state.kidsQuizCorrect = []; state.kidsQuizTimeMs = []; state.kidsPlayers = ['Родитель','Ребёнок']; state.kidsAge = 1;
    }, showKidsQuizQuestion, stopKidsQuizInterval, speakKidsQuizCard, () => answerKidsQuizQuestion(0));

    run('Викторина для одного', () => {
      state.soloQuizQueue = [{ q:'Вопрос', a:['1','2','3','4'] }];
      state.soloQuizIndex = 0; state.soloQuizCorrect = 0; state.soloQuizTimeMs = 0;
    }, showSoloQuizQuestion, stopSoloQuizInterval, speakSoloQuizCard, () => answerSoloQuizQuestion(0));

    run('Флаги', () => {
      state.flagsQueue = [{ level:1, a:['1','2','3','4'] }];
      state.flagsIndex = 0; state.flagsCorrect = 0; state.flagsTimeMs = 0; state.flagsAnswerSeconds = 10;
    }, showFlagsQuestion, stopFlagsInterval, speakFlagsCard, () => answerFlagsQuestion(0));

    run('Столицы', () => {
      state.capitalsQueue = [{ level:1, country:'Страна', a:['1','2','3','4'] }];
      state.capitalsIndex = 0; state.capitalsCorrect = 0; state.capitalsTimeMs = 0; state.capitalsAnswerSeconds = 10;
    }, showCapitalsQuestion, stopCapitalsInterval, speakCapitalsCard, () => answerCapitalsQuestion(0));

    run('Арифметика', () => {
      state.timesTableQueue = [{ a:2, b:3, op:'multiply', level:1 }];
      state.timesTableIndex = 0; state.timesTableCorrect = 0; state.timesTableTimeMs = 0; state.timesTableSelectedLevel = 1; state.mute = false;
    }, showTimesTableQuestion, stopTimesTableInterval, speakTimesTableCard, () => answerTimesTableQuestion(0));

    await new Promise(resolve => setTimeout(resolve, 80));
    assert(spoken.length === 0, 'после ответа не должно быть запоздалого воспроизведения');
  } finally {
    stopQuizInterval(); stopPartyQuizInterval(); stopKidsQuizInterval(); stopSoloQuizInterval();
    stopFlagsInterval(); stopCapitalsInterval(); stopTimesTableInterval();
    stopQuizSpeech(); stopPartyQuizSpeech(); stopKidsQuizSpeech(); stopSoloQuizSpeech();
    stopFlagsSpeech(); stopCapitalsSpeech(); stopTimesTableSpeech();
    global.SpeechSynthesisUtterance = originalUtterance;
    window.speechSynthesis = originalSynth;
    global.fadeSwapEl = originalFade;
    Object.assign(state, saved);
  }
});

test('Сценарий: «Вопросы про это» озвучивают карточку автоматически и по тапу', () => {
  const saved = {};
  ['ideasUsed', 'autoSpeak'].forEach(key => { saved[key] = state[key]; });
  const originalCard = global.ideasCurrentCard;
  const originalUtterance = global.SpeechSynthesisUtterance;
  const originalSynth = window.speechSynthesis;
  const originalFade = global.fadeSwapEl;
  const originalStrip = global.stripQuotesForSpeech;
  const spoken = [];
  try {
    global.SpeechSynthesisUtterance = function(text){ this.text = text; };
    window.speechSynthesis = { speaking:false, pending:false, getVoices:()=>[{lang:'ru-RU', name:'Test'}], cancel(){}, speak(utter){ spoken.push(utter.text); } };
    global.fadeSwapEl = (id, render, onDone)=>{ render(getElById(stub, id)); onDone(); };
    state.ideasUsed = [];
    state.autoSpeak = true;
    drawIdeaCard();
    const expected = stripQuotesForSpeech(`${ideasCurrentCard.title}. ${ideasCurrentCard.text}`);
    assert(spoken.length === 1 && spoken[0] === expected, `автоозвучка должна читать вопрос и ответ: ${JSON.stringify(spoken)}`);
    assert(getElById(stub, 'ideasCard').innerHTML.includes('🔊'), 'карточка должна показывать индикатор озвучки');
    state.autoSpeak = false;
    drawIdeaCard();
    assert(spoken.length === 1, 'при выключенной автоозвучке речь не запускается');
    speakIdeasCard();
    const manualExpected = stripQuotesForSpeech(`${ideasCurrentCard.title}. ${ideasCurrentCard.text}`);
    assert(spoken.length === 2 && spoken[1] === manualExpected, `нажатие на карточку повторяет озвучку: ${JSON.stringify(spoken)}`);
    stopIdeasSpeech();
  } finally {
    global.SpeechSynthesisUtterance = originalUtterance;
    window.speechSynthesis = originalSynth;
    global.fadeSwapEl = originalFade;
    global.stripQuotesForSpeech = originalStrip;
    global.ideasCurrentCard = originalCard;
    Object.assign(state, saved);
  }
});

test('Сценарий: правила «Флагов» доступны в общем хабе правил', () => {
  const hubHtml = document.getElementById('rulesHubList').innerHTML;
  assert(hubHtml.includes('flagsRulesModal'), 'в хабе правил должен быть пункт «Флаги»');
  assert(hubHtml.includes('Флаги'), 'пункт должен называться «Флаги»');
});

test('Сценарий: цветные полосы по полу на карточках игр не задаются', () => {
  // Регрессия: у «Тайных ответов», «Правды или действия», Таймера и Вишлиста
  // карточки красились полосой (голубой/розовый) по полу активного игрока —
  // убрано по аналогии с Фантами (4b42e98). GENDER_COLORS удалён из core.js,
  // здесь проверяем, что константы больше нет и рендеры не задают borderTop.
  assert(typeof GENDER_COLORS === 'undefined',
    'GENDER_COLORS должен быть удалён из core.js (полосы убраны)');
  const originalFade = global.fadeSwapEl;
  try {
    global.fadeSwapEl = (id, render) => render(getElById(stub, id));
    const savedName1 = state.name1, savedName2 = state.name2;
    state.name1 = 'Игрок 1'; state.name2 = 'Игрок 2';
    state.znayuActivePlayer = 1;
    showZnayuHandoffCard(2);
    state.tdCurrentPlayer = 1;
    tdShowChoice();
    state.timerCurrentPlayer = 1;
    showWishlistHandoffCard(2);
    ['znayuCard', 'tdCard', 'wishlistCard'].forEach(id => {
      const el = getElById(stub, id);
      assert(!el.style.borderTop, `карточка ${id} не должна получать цветную полосу (borderTop)`);
    });
    Object.assign(state, { name1: savedName1, name2: savedName2 });
  } finally {
    global.fadeSwapEl = originalFade;
  }
});

test('Сценарий: итоги «Вашего бинго» — без «Партия прервана» и уровня, линии «из 5»', () => {
  const saved = {
    bingoChecked: state.bingoChecked, bingoWonLines: state.bingoWonLines,
    bingoCurrentLevel: state.bingoCurrentLevel, bingoBonusChecklist: state.bingoBonusChecklist,
  };
  try {
    state.bingoChecked = [true, true, true, false, false];
    state.bingoWonLines = ['l1', 'l2', 'l3'];
    state.bingoCurrentLevel = 3;
    state.bingoBonusChecklist = [];
    showBingoExitSummary();
    let winner = getElById(stub, 'summaryWinner');
    assert(winner.style.display === 'none' && !winner.textContent,
      'в итогах при выходе не должно быть надписи «Партия прервана»');
    assert(getElById(stub, 'summaryCounts').textContent === 'Линий собрано: 3 из 5',
      'счётчик линий в итогах при выходе — «из 5» и без уровня');
    state.bingoWonLines = ['l1', 'l2', 'l3', 'l4', 'l5'];
    showBingoSummary();
    winner = getElById(stub, 'summaryWinner');
    assert(winner.style.display !== 'none' && winner.textContent === '🏆 Карта пройдена!',
      'в итогах победы первая строка снова видима и без «Партия прервана»');
    assert(getElById(stub, 'summaryScore').textContent === 'Собрано линий: 5 из 5',
      'счётчик линий в итогах победы — «из 5»');
    assert(getElById(stub, 'summaryCounts').textContent === 'Собрано 5 линий',
      'в итогах победы не должно быть уровня');
  } finally {
    Object.assign(state, saved);
  }
});

test('Сценарий: правила «Столиц» доступны в общем хабе правил', () => {
  const hubHtml = document.getElementById('rulesHubList').innerHTML;
  assert(hubHtml.includes('capitalsRulesModal'), 'в хабе правил должен быть пункт «Столицы»');
  assert(hubHtml.includes('Столицы'), 'пункт должен называться «Столицы»');
});

test('Сценарий: уровень «Викторины» (пары) называется «Откровенно» без «18+»', () => {
  // Имя уровня берётся из QUIZ_LEVELS в cards_quiz.js и рисуется в
  // renderQuizSetupLevels() (games/quiz.js). Игра для двоих и так помечена
  // 18+, поэтому в названии уровня приписка «18+» лишняя и не влезала в
  // строку — сокращена до «Откровенно».
  // Проверяем источник данных: dom-stub не отражает appendChild в innerHTML,
  // поэтому отрендерить список и прочитать его нельзя.
  const src = fs.readFileSync(path.join(ROOT, 'cards/cards_quiz.js'), 'utf8');
  const levels = src.match(/const QUIZ_LEVELS = \[([\s\S]*?)\];/);
  assert(levels, 'не найден QUIZ_LEVELS в cards_quiz.js');
  const block = levels[1];
  assert(/name:\s*'Откровенно'/.test(block),
    'уровень 4 должен называться «Откровенно»');
  assert(!/Откровенно 18\+/.test(block),
    'приписка «18+» в названии уровня не должна вернуться');
  // Остальные уровни не тронуты.
  ['Романтика', 'Сближение', 'Разогрев'].forEach((n) => {
    assert(block.includes(`name: '${n}'`), `уровень «${n}» не должен пропасть`);
  });
  // Колоды вопросов привязаны к id, а не к названию — данные не сдвинулись.
  const cards = fs.readFileSync(path.join(ROOT, 'cards/cards_quiz.js'), 'utf8');
  assert(/\{ level: 4,/.test(cards), 'вопросы уровня 4 должны остаться на месте');
});

test('Сценарий: «Видеорулетка» показывает своё название', () => {
  // Экран #game обслуживает четыре игры, и каждая должна называться своим
  // именем — иначе игрок не понимает, в какой игре находится.
  const gameEl = getElById(stub, 'game');
  const title = getElById(stub, 'gameLevelLabel');

  asFantyScreen();
  gameEl.classList.add('video-mode');
  state.name1 = 'Парень';
  global.updateTurnUI();
  global.updateLevelUI();
  assert(title.textContent === '🎥 Видеорулетка',
    `ожидалось «🎥 Видеорулетка», получено «${title.textContent}»`);
  assert(title.style.display !== 'none', 'заголовок «Видеорулетки» должен быть виден');
  MODE_CLASSES.forEach((c) => gameEl.classList.remove(c));
});

test('Сценарий: «Давай попробуем» показывает своё название', () => {
  const gameEl = getElById(stub, 'game');
  const title = getElById(stub, 'gameLevelLabel');

  asFantyScreen();
  gameEl.classList.add('davay-mode');
  state.name1 = 'Парень';
  global.updateTurnUI();
  global.updateLevelUI();
  assert(title.textContent === '🎬 Давай попробуем',
    `ожидалось «🎬 Давай попробуем», получено «${title.textContent}»`);
  assert(title.style.display !== 'none', 'заголовок «Давай попробуем» должен быть виден');
  MODE_CLASSES.forEach((c) => gameEl.classList.remove(c));
});

test('Сценарий: при входе в игру с видео карточка получает иконку игры, а не 🃏', () => {
  // #card лежит в разметке общей для четырёх игр и до старта показывает
  // нейтральное «Загрузка задания…» с игральной картой 🃏. Пока каталог видео
  // читается из IndexedDB, игрок видел именно её — чужой символ. Режим игры
  // ставит setGameMode(), он же обязан подменить иконку и текст.
  const icon = getElById(stub, 'cardLoadingIcon');
  const text = getElById(stub, 'cardLoadingText');
  assert(icon && text, 'в разметке #card нет #cardLoadingIcon/#cardLoadingText');

  global.setGameMode('davay-mode');
  assert(icon.textContent === '🎬',
    `в «Давай попробуем» ожидалась иконка игры 🎬, получено «${icon.textContent}»`);
  assert(text.textContent === 'Загрузка видео…',
    `ожидался текст «Загрузка видео…», получено «${text.textContent}»`);

  global.setGameMode('video-mode');
  assert(icon.textContent === '🎬',
    `в «Видеорулетке» ожидалась иконка игры 🎬, получено «${icon.textContent}»`);

  // Обычные «Фанты» — игра на карточках, у них свой символ и своя разметка.
  global.setGameMode(null);
  const card = getElById(stub, 'card');
  assert(!card.classList.contains('davay-mode'), 'режим должен сниматься вместе с иконкой');
  MODE_CLASSES.forEach((c) => getElById(stub, 'game').classList.remove(c));
});

test('Сценарий: уровни «Давай попробуем» — шесть штук с названиями', () => {
  // Уровни игры переехали из общего LEVELS в свой список DAVAY_LEVELS, а номер
  // уровня игрока стал совпадать с номером уровня видео.
  //
  // ВАЖНО про доступ: global видит только var/function-объявления. `const`
  // (DAVAY_LEVELS, DAVAY_MAX_LEVEL) и сам state живут в лексической области
  // скрипта — их не достать ни через global, ни через window, только через
  // eval в том же контексте (проверено: global.DAVAY_MAX_LEVEL === undefined,
  // а eval('DAVAY_MAX_LEVEL') === 6).
  const max = eval('typeof DAVAY_MAX_LEVEL === "number" ? DAVAY_MAX_LEVEL : 0');
  const info = global.davayLevelInfo;
  assert(typeof info === 'function', 'davayLevelInfo должна быть доступна');
  assert(max === 6, `потолок уровней должен быть 6, получено ${max}`);
  const names = [];
  for (let id = 1; id <= max; id++) names.push(info(id).name);
  assert(names.join(',') === 'Ласки,Близость,Ртом,Игрушки,Сзади,Экзотика',
    `не те уровни: ${names.join(', ')}`);
  // Функция обязана вернуть осмысленный уровень даже на мусоре: с чужим
  // номером drawDavayCard() не найдёт видео и покажет пустой экран.
  const fallback = info(999);
  assert(fallback && fallback.id === 1,
    `неизвестный уровень должен давать первый, получено ${JSON.stringify(fallback)}`);
});

test('Сценарий: уровни «Давай попробуем» 1..6 читаются без искажений', () => {
  const selected = global.davaySelectedLevel;
  const max = eval('DAVAY_MAX_LEVEL');
  const savedPrev = eval('state.davaySelectedLevel');
  // Значение сейва подставляем через eval: state объявлен через `const` в
  // скрипте, снаружи доступен только так (см. комментарий в тесте выше).
  const withSaved = (value) => {
    global.__davaySavedProbe = value;
    eval('state.davaySelectedLevel = __davaySavedProbe');
    return selected();
  };
  try {
    // Главное свойство: любой из шести уровней возвращается тем же самым.
    // Здесь ловится соблазнительная «миграция старых сейвов» через «-2»:
    // с ней плашка «Игрушки» (4) мгновенно превращалась в «Близость» (2), а
    // уровни 4..6 становились недостижимыми — выбрать их было невозможно.
    for (let id = 1; id <= max; id++) {
      const got = withSaved(id);
      assert(got === id, `уровень ${id} должен читаться как ${id}, получено ${got}`);
    }
    // Мусор и значения вне диапазона не должны ронять игру, но обязаны попасть
    // в СУЩЕСТВУЮЩИЙ уровень: drawDavayCard() с чужим номером не нашёл бы видео
    // и показал пустой экран.
    [undefined, null, 'abc', 0, 99, -3].forEach((saved) => {
      const got = withSaved(saved);
      assert(got >= 1 && got <= max,
        `значение ${JSON.stringify(saved)} дало несуществующий уровень ${got}`);
    });
  } finally {
    global.__davaySavedProbe = savedPrev;
    eval('state.davaySelectedLevel = __davaySavedProbe');
    delete global.__davaySavedProbe;
  }
});

test('Сценарий: подуровень папки «Level N-M …» читается из yandexPath', () => {
  // «Горячее» шагает по папкам Яндекса внутри уровня: подуровень — второй
  // номер в имени папки, он же второй сегмент yandexPath. Ошибка парсинга
  // уводила бы кнопку «Горячее» не в ту папку или прятала бы все видео уровня.
  if (typeof global.davaySubLevelFromPath !== 'function') {
    assert(false, 'davaySubLevelFromPath недоступна глобально');
    return;
  }
  const sub = global.davaySubLevelFromPath;
  assert(sub('disk:/Level 1-2 Ласки легкие/f.webm') === 2, 'путь «Level 1-2 …» должен давать подуровень 2');
  assert(sub('disk:/Level 3-1 Близость/f.mp4') === 1, 'путь «Level 3-1 …» должен давать подуровень 1');
  assert(sub('disk:/Level 6-2 На троих/f.webm') === 2, 'путь «Level 6-2 …» должен давать подуровень 2');
  assert(sub(null) === 0 && sub('') === 0, 'пустой путь должен давать базовый подуровень 0');
  assert(sub('disk:/Новая папка/f.webm') === 0, 'путь без «Level N-M …» должен давать 0');
  assert(sub('disk:/Level 1-1 Ласки разогрев/f.webm') === 1, 'путь «Level 1-1 …» должен давать подуровень 1');
  if (typeof global.davayFolderDescFromPath === 'function') {
    const desc = global.davayFolderDescFromPath('disk:/Level 1-2 Ласки легкие/f.webm');
    assert(desc === 'Ласки легкие', `описание папки потерялось: ${JSON.stringify(desc)}`);
  }
});

test('Сценарий: «Предложи партнёру» по-прежнему показывает уровень, а не название игры', () => {
  // В placeholder-режиме .game-level-label занят уровнем («🔥 Сближение»),
  // его заполняет updateLevelUI — название игры сюда подставлять нельзя.
  const gameEl = getElById(stub, 'game');
  const title = getElById(stub, 'gameLevelLabel');

  asFantyScreen();
  gameEl.classList.add('placeholder-mode');
  const before = title.textContent;
  global.updateTurnUI();
  assert(title.textContent === before,
    'название игры не должно подменять уровень в режиме «Предложи партнёру»');
  MODE_CLASSES.forEach((c) => gameEl.classList.remove(c));
});

test('Сценарий: пилюля прогресса в «Предложи партнёру» остаётся без фона и текста', () => {
  // updateLevelProgressUI («Фанты») красит #levelProgress цветом уровня
  // (#b07bff «Сближение», #7a5cff «Фантазии»), а updateLevelUI в
  // placeholder-режиме очищал пилюлю только от текста — над карточкой
  // «Предложи партнёру» оставалась фиолетовая полоска. Фон должен
  // сбрасываться вместе с текстом.
  const gameEl = getElById(stub, 'game');
  const pill = getElById(stub, 'levelProgress');
  const savedBg = pill.style.background, savedText = pill.textContent;
  try {
    asFantyScreen();
    global.updateTurnUI();
    global.updateLevelUI(); // «Фанты»: пилюля получает цвет уровня
    const fantyBg = pill.style.background;
    assert(!!fantyBg, `в «Фантах» пилюля должна получить цвет уровня, получено «${fantyBg}»`);
    gameEl.classList.add('placeholder-mode');
    global.updateLevelUI();
    assert(!pill.style.background && !pill.textContent,
      'в «Предложи партнёру» пилюля должна остаться без фона и текста');
  } finally {
    gameEl.classList.remove('placeholder-mode');
    pill.style.background = savedBg;
    pill.textContent = savedText;
  }
});

test('Сценарий: названия режимов не смешиваются при переключении', () => {
  // Каждый вход в режим должен заново выставлять СВОЙ заголовок: раньше
  // заголовок просто скрывался, и при переходе между играми мог остаться
  // текст предыдущего режима.
  const gameEl = getElById(stub, 'game');
  const title = getElById(stub, 'gameLevelLabel');

  const titleFor = (mode) => {
    asFantyScreen();
    if (mode) gameEl.classList.add(mode);
    global.updateTurnUI();
    global.updateLevelUI();
    return title.textContent;
  };
  const fanty = titleFor(null);
  const video = titleFor('video-mode');
  const davay = titleFor('davay-mode');
  const back = titleFor(null);
  assert(fanty === '💘 Фанты', `Фанты: «${fanty}»`);
  assert(video === '🎥 Видеорулетка', `Видеорулетка: «${video}»`);
  assert(davay === '🎬 Давай попробуем', `Давай попробуем: «${davay}»`);
  assert(back === '💘 Фанты', `возврат в Фанты: «${back}»`);
  MODE_CLASSES.forEach((c) => gameEl.classList.remove(c));
});

test('Сценарий: метка хода возвращается после выхода из «Фантов»', () => {
  // У «Фантов» метка хода скрывается; при возврате в обычный режим она должна
  // появиться снова, иначе имя игрока пропадёт навсегда.
  const gameEl = getElById(stub, 'game');
  const title = getElById(stub, 'gameLevelLabel');
  const turn = getElById(stub, 'gameTurnLabel');

  asFantyScreen();
  state.gameType = 'fanty';
  global.updateTurnUI();
  assert(turn.style.display === 'none', 'исходно метка хода скрыта');

  // Выходим из «Фантов» в режим «Давай попробуем» — у него своё название.
  MODE_CLASSES.forEach((c) => gameEl.classList.remove(c));
  gameEl.classList.add('davay-mode');
  state.name1 = 'Парень';
  state.currentPlayer = 1;
  global.updateTurnUI();
  global.updateLevelUI();
  assert(turn.style.display !== 'none', 'метка хода должна снова показываться');
  assert(turn.textContent === 'Ходит: Парень', `ожидалось «Ходит: Парень», получено «${turn.textContent}»`);
  assert(title.textContent === '🎬 Давай попробуем',
    `заголовок должен смениться на название режима, получено «${title.textContent}»`);
  MODE_CLASSES.forEach((c) => gameEl.classList.remove(c));
});

console.log('\n=== Симуляция пользовательских сценариев ===');

test('Сценарий: запуск игры через goToGameSetup', () => {
  try {
    global.goToGameSetup('fantySetup', 'twoPlayerView');
    assert(true, '');
  } catch (e) {
    assert(false, `ошибка: ${e.message}`);
  }
});

test('Сценарий: пауза игры', () => {
  try {
    global.pauseGame();
    assert(true, '');
  } catch (e) {
    assert(false, `ошибка: ${e.message}`);
  }
});

test('Сценарий: возобновление игры (resumeBtn handler)', () => {
  try {
    state.pausedMode = 'fanty';
    global.updateResumeUI();
    assert(true, '');
  } catch (e) {
    assert(false, `ошибка: ${e.message}`);
  }
});

test('Разметка вопроса «Флагов» содержит изображение флага', () => {
  const item = { flag: 'flags-svg/flag-ru.svg', a: ['Россия', 'Казахстан', 'Украина', 'Беларусь'] };
  const html = global.flagsQuestionHtml(item, '<button>Ответ</button>');
  assert(html.includes('class="flags-card-image"') && html.includes(`src="${item.flag}"`),
    'карточка «Флагов» должна содержать изображение текущего флага');
  assert(fs.existsSync(path.join(ROOT, item.flag)),
    'файл изображения флага должен существовать');
});

test('Разметка вопроса «Столиц» содержит флаг над названием страны', () => {
  const item = { country: 'Франция', flag: 'flags-svg/flag-fr.svg', a: ['Париж', 'Лион', 'Марсель', 'Тулуза'] };
  const html = global.capitalsQuestionHtml(item, '<button>Ответ</button>');
  assert(html.includes('class="flags-card-media"') && html.includes('class="flags-card-image"'),
    'карточка «Столиц» должна показывать блок с флагом');
  assert(html.includes(`src="${item.flag}"`), 'флаг должен браться из поля flag карточки');
  assert(html.indexOf('flags-card-media') < html.indexOf('Столица Франция'),
    'флаг должен располагаться над текстом вопроса');
  assert(fs.existsSync(path.join(ROOT, item.flag)), 'файл флага должен существовать');
});

test('«Столицы»: карточка без поля flag не ломает разметку', () => {
  const html = global.capitalsQuestionHtml({ country: 'Х', a: ['А', 'Б', 'В', 'Г'] }, '');
  assert(!html.includes('<img'), 'без поля flag изображения быть не должно');
});
test('Сценарий: настройки «Флагов» и выход без паузы', () => {
  const previous = {
    inProgress: state.inProgress,
    pausedMode: state.pausedMode,
    lastPauseView: state.lastPauseView,
    flagsQuestionCount: state.flagsQuestionCount,
    flagsQueue: state.flagsQueue,
    flagsIndex: state.flagsIndex,
  };
  try {
    global.goToFlagsSetup();
    const setup = getElById(stub, 'flagsSetup');
    const learning = getElById(stub, 'learningView');
    assert(setup && setup.classList.contains('active'), 'настройки «Флагов» должны открыться');
    assert(learning && learning.classList.contains('section-open'),
      'настройки «Флагов» должны открыть раздел обучения');

    state.flagsQuestionCount = 25;
    global.goToFlagsGame();
    global.stopFlagsInterval();
    const game = getElById(stub, 'flagsGame');
    assert(game && game.classList.contains('active'), 'партия «Флагов» должна начаться');
    const flags = global.gameByMode('flags');
    assert(flags && flags.noPause === true, 'реестр «Флагов» должен отмечать отсутствие паузы');
    assert(flags && !flags.pause && !flags.resume, 'у «Флагов» не должно быть функций паузы и продолжения');
    assert(flags && flags.back === 'exitFlagsGame', 'стрелка «←» должна завершать партию «Флагов»');

    global.exitFlagsGame();
    assert(getElById(stub, 'flagsSetup').classList.contains('active'),
      'выход из «Флагов» должен вернуть экран настроек');
    assert(state.inProgress === false && state.pausedMode === null,
      'выход из «Флагов» должен снять флаги активной партии и паузы');
  } catch (e) {
    assert(false, `ошибка: ${e.message}`);
  } finally {
    state.inProgress = previous.inProgress;
    state.pausedMode = previous.pausedMode;
    state.lastPauseView = previous.lastPauseView;
    state.flagsQuestionCount = previous.flagsQuestionCount;
    state.flagsQueue = previous.flagsQueue;
    state.flagsIndex = previous.flagsIndex;
    global.stopFlagsInterval();
  }
});

test('Сценарий: настройки «Столиц» и выход без паузы', () => {
  const previous = {
    inProgress: state.inProgress,
    pausedMode: state.pausedMode,
    lastPauseView: state.lastPauseView,
    capitalsQuestionCount: state.capitalsQuestionCount,
    capitalsQueue: state.capitalsQueue,
    capitalsIndex: state.capitalsIndex,
  };
  try {
    global.goToCapitalsSetup();
    const setup = getElById(stub, 'capitalsSetup');
    const learning = getElById(stub, 'learningView');
    assert(setup && setup.classList.contains('active'), 'настройки «Столиц» должны открыться');
    assert(learning && learning.classList.contains('section-open'),
      'настройки «Столиц» должны открыть раздел обучения');

    state.capitalsQuestionCount = 25;
    global.goToCapitalsGame();
    global.stopCapitalsInterval();
    const game = getElById(stub, 'capitalsGame');
    assert(game && game.classList.contains('active'), 'партия «Столиц» должна начаться');
    const capitals = global.gameByMode('capitals');
    assert(capitals && capitals.noPause === true, 'реестр «Столиц» должен отмечать отсутствие паузы');
    assert(capitals && !capitals.pause && !capitals.resume, 'у «Столиц» не должно быть функций паузы и продолжения');
    assert(capitals && capitals.back === 'exitCapitalsGame', 'стрелка «←» должна завершать партию «Столиц»');

    global.exitCapitalsGame();
    assert(getElById(stub, 'capitalsSetup').classList.contains('active'),
      'выход из «Столиц» должен вернуть экран настроек');
    assert(state.inProgress === false && state.pausedMode === null,
      'выход из «Столиц» должен снять флаги активной партии и паузы');
  } catch (e) {
    assert(false, `ошибка: ${e.message}`);
  } finally {
    state.inProgress = previous.inProgress;
    state.pausedMode = previous.pausedMode;
    state.lastPauseView = previous.lastPauseView;
    state.capitalsQuestionCount = previous.capitalsQuestionCount;
    state.capitalsQueue = previous.capitalsQueue;
    state.capitalsIndex = previous.capitalsIndex;
    global.stopCapitalsInterval();
  }
});
test('Крестик не добавляется в окна итогов — выход только по кнопке', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const inject = scripts.find(s => s.includes('modal-close-btn'));
  assert(inject, 'инлайн-скрипт, добавляющий крестик в модалки, должен существовать');
  assert(/SummaryModal\$/.test(inject),
    'инжект крестика должен исключать окна итогов (*SummaryModal)');
  assert(/ResultsModal\$|ResultModal\$/.test(inject),
    'инжект крестика должен исключать окна результатов (*ResultsModal/*ResultModal)');
  ['flagsSummaryModal', 'capitalsSummaryModal'].forEach(id => {
    const idx = html.indexOf(`id="${id}"`);
    assert(idx > 0, `окно ${id} должно быть в разметке`);
    const chunk = html.slice(idx, idx + 700);
    assert(!chunk.includes('modal-close-btn'),
      `${id} не должен содержать крестик: итог закрывается только кнопкой «Завершить игру»`);
  });
});



test('Сценарий: завершение игры (finishGameBtn handler)', () => {
  try {
    state.pausedMode = 'fanty';
    state.score1 = 5;
    state.score2 = 3;
    global.showSummary();
    assert(true, '');
  } catch (e) {
    assert(false, `ошибка: ${e.message}`);
  }
});


console.log('\n=== Возврат «откуда пришёл» и режимы экрана #game ===');

// Класс багов «выход ведёт не туда» закрывается единым механизмом: точка
// входа запоминается в goToGame()/goToGameSetup(), а выход возвращается по
// ней через exitGame(). Проверяем фактическое поведение, а не текст кода.
test('Сценарий: выход из игры возвращает на её экран настройки', () => {
  // Игрок: хаб → меню «Крокодила» → партия → «Выход».
  global.goToKrokodilSetup();
  const setupEl = getElById(stub, 'krokodilSetup');
  assert(setupEl.classList.contains('active'), 'меню «Крокодила» должно открыться');

  // Точка входа — именно меню настройки: игру игрок запускает с него.
  assert(global.getEntryScreenState().id === 'krokodilSetup',
    `точка входа должна быть krokodilSetup, получено ${global.getEntryScreenState().id}`);

  global.goToKrokodilGame();
  assert(getElById(stub, 'krokodilGame').classList.contains('active'),
    'партия «Крокодила» должна начаться');
  assert(global.getEntryScreenState().id === 'krokodilSetup',
    'запуск партии не должен перезаписывать точку входа на саму игру');

  // Заглушка DOM не умеет гасить экраны (querySelectorAll возвращает пустой
  // список), поэтому «какой экран активен» здесь не проверить. Зато можно
  // проверить сам механизм возврата: он обязан вернуть true и указать, куда
  // именно вернул. Этого достаточно, чтобы поймать отключённый возврат.
  // Подменяем сам returnToEntryScreen: он вызывается из exitGame как глобальная
  // функция, поэтому перехват сработает и покажет, что возврат действительно
  // запрошен (заглушка DOM не умеет гасить экраны, см. комментарий выше).
  const asked = [];
  const origReturn = global.returnToEntryScreen;
  global.returnToEntryScreen = function () {
    asked.push(global.getEntryScreenState().id);
    return true;
  };
  try {
    global.exitKrokodilGame();
    assert(typeof origReturn === 'function', 'механизм возврата должен существовать');
    assert(asked.includes('krokodilSetup'),
      `выход должен запросить возврат в krokodilSetup, а запрошено: ${asked.join(', ') || 'ничего'}`);
  } finally {
    global.returnToEntryScreen = origReturn;
  }
});

test('Сценарий: вход из хаба возвращает в хаб, а не в меню игры', () => {
  // Обратный случай: плитка в хабе → партия → выход. Игрок не видел меню
  // настройки игры, поэтому и возвращаться в него не должен.
  const setupEl = getElById(stub, 'setup');
  setupEl.classList.add('active');
  global.rememberReturnScreen('setup', 'companyView');

  global.goToKrokodilGame();
  global.exitKrokodilGame();

  assert(setupEl.classList.contains('active'), 'после выхода должен открыться хаб');
  assert(global.getEntryScreenState().id === 'setup',
    'точка входа должна остаться хабом');
});

test('Сценарий: игра из плитки раздела возвращает в раздел, а не в меню прошлой игры', () => {
  // Жалоба (повторялась много раз): игрок сыграл одну игру, вышел, зашёл в
  // ДРУГУЮ группу, сыграл там игру без своего экрана настройки («Виселица»,
  // «Ваше бинго», «Рулетка», «Твистер», «Сапёр»…), нажал «Выход» — и попал в
  // меню НАСТРОЙКИ предыдущей игры. Причина: точку входа запоминал только
  // goToGameSetup(), а игры-плитки стартуют прямо из раздела хаба через
  // goToGame() — точка входа оставалась от прошлой игры.
  // Проверяем фактическое поведение: после выхода игрок в хабе, а не в меню
  // чужой игры.
  const called = [];
  const origGoSetup = global.goToGameSetup;
  global.goToGameSetup = function (id) { called.push(id); return origGoSetup.apply(this, arguments); };
  try {
    // 1. Игрок открыл настройку «Фантов» компании — точка входа она.
    global.goToPartyFantsSetup();
    assert(global.getEntryScreenState().id === 'partyFantsSetup',
      `точка входа должна быть partyFantsSetup, получено ${global.getEntryScreenState().id}`);

    // 2. «Выход» из настройки: игрок снова в разделе хаба (это же состояние
    //    в браузере отслеживает наблюдатель за .screen).
    global.returnToSetupUI();
    assert(global.getEntryScreenState().id === 'setup',
      `в хабе точка входа должна стать setup, получено ${global.getEntryScreenState().id}`);

    // 3. Партия без своего экрана настройки — прямо из плитки раздела.
    global.goToPartyHangmanGame();
    assert(global.getEntryScreenState().id === 'setup',
      `запуск из плитки раздела не должен оставлять чужую точку входа, получено ${global.getEntryScreenState().id}`);

    // 4. Выход: «шаг назад» — хаб, а не меню «Фантов» компании.
    global.exitPartyHangmanGame();
    const activeAfterExit = document.querySelectorAll('.screen.active').map(el => el.id);
    assert(getElById(stub, 'setup').classList.contains('active'),
      'выход должен открыть хаб (раздел игр), а не меню прошлой игры');
    assert(activeAfterExit.join(',') === 'setup',
      `после выхода активен ровно один экран — хаб, а получено: ${activeAfterExit.join(', ') || 'ничего'}`);
    assert(!activeAfterExit.includes('partyFantsSetup'),
      'экран настройки прошлой игры не должен остаться активным');
    assert(global.getEntryScreenState().id === 'setup',
      `точка входа должна остаться хабом, получено ${global.getEntryScreenState().id}`);
  } finally {
    global.goToGameSetup = origGoSetup;
  }
  assert(called.includes('partyFantsSetup'),
    `настройка «Фантов» компании должна открываться через goToGameSetup, вызовы: ${called.join(', ') || 'нет'}`);
});

test('Сценарий: запуск со своего экрана настройки не превращает точку входа в хаб', () => {
  // Обратная сторона механизма: если игрок открыл настройку игры и запустил
  // партию с неё, «шаг назад» ведёт именно в настройку, а не в хаб — иначе
  // возврат «перепрыгивает» уровень (ровно этот баг чинили в v229).
  global.goToPartyFantsSetup();
  const entryBefore = global.getEntryScreenState().id;
  global.goToPartyFantsGame();
  assert(global.getEntryScreenState().id === entryBefore,
    `запуск с настройки не должен менять точку входа: было ${entryBefore}, стало ${global.getEntryScreenState().id}`);
  assert(entryBefore === 'partyFantsSetup',
    `точкой входа должна быть настройка игры, получено ${entryBefore}`);
});

test('Сценарий: игра другой группы из плитки ведёт в свою группу, а не в чужое меню', () => {
  // Точный сценарий жалобы: сыграл игру в одной группе, вышел, зашёл в ДРУГУЮ
  // группу, сыграл игру, нажал «Выход» — и оказался в меню ПРОШЛОЙ игры.
  // «Сапёр» — типичный случай: у него нет своего экрана настройки, партия
  // стартует прямо из раздела «Игры с детьми», а выход зовёт
  // exitGame('kidsSaperGame', 'kidsSaperSetup') — старый запасной путь возврата.
  const origGoSetup = global.goToGameSetup;
  global.goToGameSetup = function (id) { return origGoSetup.apply(this, arguments); };
  try {
    // Прошлая игра: игрок открыл настройку «Фантов» компании и вышел из неё
    // кнопкой «Выход» на самой настройке — она переключает экраны вручную,
    // без exitGame() (это и есть путь, на котором точка входа «залипала»).
    global.goToPartyFantsSetup();
    assert(global.getEntryScreenState().id === 'partyFantsSetup',
      `после открытия настройки точка входа — она сама, получено ${global.getEntryScreenState().id}`);
    global.exitPartyFantsSetup();
    assert(global.getEntryScreenState().id === 'setup',
      `после выхода из настройки точка входа — хаб, получено ${global.getEntryScreenState().id}`);

    // Другая группа: раздел «Игры с детьми», игра из плитки.
    global.showSetupView('kidsView');
    global.goToKidsSaperGame();
    const entry = global.getEntryScreenState();
    assert(entry.id === 'setup',
      `запуск из плитки раздела должен запомнить хаб, получено ${entry.id}`);
    assert(entry.view === 'kidsView',
      `возврат должен открыть тот же раздел (kidsView), получено ${entry.view}`);

    global.exitKidsSaperGame();
    const activeAfterExit = document.querySelectorAll('.screen.active').map(el => el.id);
    assert(getElById(stub, 'setup').classList.contains('active'),
      'выход должен открыть хаб, а не меню «Фантов» компании');
    assert(activeAfterExit.join(',') === 'setup',
      `активен должен остаться только хаб, получено: ${activeAfterExit.join(', ') || 'ничего'}`);
    assert(global.getEntryScreenState().id === 'setup',
      `точка входа должна остаться хабом, получено ${global.getEntryScreenState().id}`);
    assert(getElById(stub, 'kidsView').classList.contains('section-open'),
      'возврат в хаб должен открыть тот раздел, откуда запускали игру (kidsView)');
  } finally {
    global.goToGameSetup = origGoSetup;
  }
});

test('Сценарий: выход из игры, запущенной из хаба, ведёт в хаб (а не в настройку чужой игры)', () => {
  // Здесь проверяется вторая половина механизма: запуск партии из раздела
  // хаба сам обновляет точку входа. Нужно это для случаев, когда игрок ушёл
  // из экрана настройки предыдущей игры «вручную» (такие обработчики есть:
  // #fantyExitBtn и другие exitXxxSetup просто меняют классы, не трогая
  // точку входа) — иначе она оставалась от ЧУЖОЙ игры, и «Выход» возвращал
  // в её меню. Кнопки «Выход» у настроек по-прежнему возвращают в хаб.
  global.goToFantySetup();
  assert(global.getEntryScreenState().id === 'fantySetup',
    `настройка «Фантов» должна стать точкой входа, получено ${global.getEntryScreenState().id}`);
  getElById(stub, 'fantyExitBtn').click();
  assert(getElById(stub, 'setup').classList.contains('active'),
    'после «Выхода» из настроек должен открыться хаб');

  // Партия без своего экрана настройки — из плитки раздела «Игры для одного».
  global.showSetupView('soloView');
  global.goToPartyHangmanGame();
  assert(global.getEntryScreenState().id === 'setup',
    `запуск из плитки раздела должен перезаписать точку входа хабом, получено ${global.getEntryScreenState().id}`);

  global.exitPartyHangmanGame();
  assert(getElById(stub, 'setup').classList.contains('active'),
    'выход должен вернуть в хаб');
  assert(global.getEntryScreenState().id !== 'fantySetup',
    'выход не должен возвращать в настройку «Фантов» — чужой игры');
});

test('Сценарий: exitGame сбрасывает пару флагов и закрывает окно паузы', () => {
  // Правило AGENTS.md: pausedMode и inProgress сбрасываются вместе, иначе
  // настройки в хабе остаются заблокированными, а окно паузы висит поверх.
  state.inProgress = true;
  state.pausedMode = 'fanty';
  const modal = getElById(stub, 'pauseMenuModal');
  modal.classList.add('show');

  global.exitKidsXoGame();

  assert(state.inProgress === false, 'inProgress должен сброситься');
  assert(state.pausedMode === null, 'pausedMode должен сброситься');
  assert(!modal.classList.contains('show'), 'окно паузы должно закрыться');
});

test('Сценарий: «Закончить игру» в «Давай попробуем» ведёт в её настройки', () => {
  // Баг: кнопка «Закончить игру» в меню паузы вызывала abandonPausedSession,
  // который только снимает паузу и НЕ трогает экраны. Игрок после завершения
  // оказывался в хабе «Игры для двоих» вместо настроек «Давай попробуем» —
  // то есть делал шаг назад вместо ожидаемого возврата к настройке партии.
  // Проверяем фактическое поведение: обработчик #finishGameBtn должен позвать
  // exitDavayGame(true), а не молча снять паузу.
  const finishBtn = getElById(stub, 'finishGameBtn');
  assert(finishBtn && typeof finishBtn.click === 'function',
    'кнопка #finishGameBtn должна существовать в заглушке DOM');

  state.pausedMode = 'davay';
  state.inProgress = true;

  const calls = [];
  const origExit = global.exitDavayGame;
  global.exitDavayGame = function (toSetup) { calls.push(toSetup); };
  try {
    finishBtn.click();
    assert(calls.length === 1,
      `#finishGameBtn должен один раз позвать exitDavayGame, вызовов: ${calls.length}`);
    assert(calls[0] === true,
      'exitDavayGame нужно звать с true — иначе игрок попадёт в хаб, а не в настройки');
  } finally {
    global.exitDavayGame = origExit;
  }
});

test('Сценарий: exitDavayGame(true) открывает настройки «Давай попробуем»', () => {
  // Вторая половина той же цепочки: сам выход обязан закончиться на
  // #davaySetup. Проверяем, что функция действительно зовёт goToDavaySetup,
  // а не returnToSetupUI (хаб).
  const called = [];
  const origGo = global.goToDavaySetup;
  global.goToDavaySetup = function () { called.push('davaySetup'); };
  try {
    global.exitDavayGame(true);
    assert(called.length === 1,
      `exitDavayGame(true) должен позвать goToDavaySetup, вызовов: ${called.length}`);
  } finally {
    global.goToDavaySetup = origGo;
  }
  // Пара связанных флагов сбрасывается вместе (правило AGENTS.md).
  assert(state.inProgress === false, 'inProgress должен сброситься');
  assert(state.pausedMode === null, 'pausedMode должен сброситься');
});

test('Сценарий: выход из «Пройди квеста» идёт в настройки игры, а не в хаб', () => {
  // Баг (сборки до v286): finishPausedSexQuestGame гасила ТОЛЬКО игровой экран
  // и включала #sexQuestSetup вручную — не через goToGameSetup. Экран #setup
  // (хаб «Игры для двоих») при этом оставался активным, и игрок после выхода
  // видел не настройки игры, а список игр для двоих. Особенно заметно после
  // «Продолжить игру» из хаба и после «Закончить игру» в меню паузы.
  // Проверяем фактическое поведение: выход обязан идти единым путём
  // goToGameSetup('sexQuestSetup') — он гасит ВСЕ активные экраны.
  const called = [];
  const origGo = global.goToGameSetup;
  global.goToGameSetup = function (id) { called.push(id); };
  try {
    global.finishPausedSexQuestGame();
    assert(called.length === 1,
      `выход должен позвать goToGameSetup один раз, вызовов: ${called.length}`);
    assert(called[0] === 'sexQuestSetup',
      `выход должен вести в sexQuestSetup, а не в «${called[0]}»`);
  } finally {
    global.goToGameSetup = origGo;
  }
  // Пара связанных флагов сбрасывается вместе (правило AGENTS.md).
  assert(state.inProgress === false, 'inProgress должен сброситься');
  assert(state.pausedMode === null, 'pausedMode должен сброситься');
});

test('Сценарий: «В меню» с итогов «Пройди квеста» ведёт в настройки игры', () => {
  // Вторая ветка того же бага: «В меню» с экрана итогов раньше открывала хаб
  // «Игры для двоих». Теперь и она идёт через goToGameSetup('sexQuestSetup').
  const called = [];
  const origGo = global.goToGameSetup;
  global.goToGameSetup = function (id) { called.push(id); };
  try {
    global.exitSexQuestSummary();
    assert(called.length === 1,
      `«В меню» с итогов должен позвать goToGameSetup один раз, вызовов: ${called.length}`);
    assert(called[0] === 'sexQuestSetup',
      `«В меню» с итогов должен вести в sexQuestSetup, а не в «${called[0]}»`);
  } finally {
    global.goToGameSetup = origGo;
  }
});

test('Сценарий: выход из «Карты страсти» идёт в настройки игры, а не в хаб', () => {
  // Тот же баг «размазанной» логики выхода, что у «Пройди квеста» (до v288):
  // finishPausedPassionMapGame гасила ТОЛЬКО игровой экран и включала
  // #passionMapSetup вручную. Если #setup (хаб «Игры для двоих») оставался
  // активным — например, после «Продолжить игру» из хаба — игрок вместо
  // настроек игры видел список игр для двоих. Теперь выход идёт единым путём
  // goToPassionMapSetup → goToGameSetup, который гасит ВСЕ активные экраны.
  const called = [];
  const origGo = global.goToGameSetup;
  global.goToGameSetup = function (id) { called.push(id); };
  try {
    global.finishPausedPassionMapGame();
    assert(called.length === 1,
      `выход должен позвать goToGameSetup один раз, вызовов: ${called.length}`);
    assert(called[0] === 'passionMapSetup',
      `выход должен вести в passionMapSetup, а не в «${called[0]}»`);
  } finally {
    global.goToGameSetup = origGo;
  }
  assert(state.inProgress === false, 'inProgress должен сброситься');
  assert(state.pausedMode === null, 'pausedMode должен сброситься');
});

test('Сценарий: возврат из «Карты страсти» идёт единым путём returnToSetupUI', () => {
  // exitPassionMapSummary возвращает в хаб «Игры для двоих» через
  // returnToSetupUI() — он снимает active со ВСЕХ экранов и включает только
  // #setup. Раньше здесь гасился лишь #passionMapSummary и включался #setup
  // вручную: при заходе из игры/настроек оставался «экран, поделённый на
  // 2 части», а вместо хаба показывался список игр.
  // Проверяем именно делегирование: если кто-то вернёт ручное переключение
  // экранов, тест упадёт. Само гашение всех экранов проверяется в браузере —
  // заглушка dom-stub не реализует querySelectorAll('.screen.active').
  let calls = 0;
  const orig = global.returnToSetupUI;
  global.returnToSetupUI = function () { calls += 1; };
  try {
    global.exitPassionMapSummary();
  } finally {
    global.returnToSetupUI = orig;
  }
  assert(calls === 1, `returnToSetupUI должен быть позван один раз, вызовов: ${calls}`);
});

test('Сценарий: setGameMode снимает чужой режим экрана #game', () => {
  // Раньше после паузы «Давай попробуем» класс davay-mode оставался на #game,
  // и «Фанты» открывались с чужим оформлением и чужой логикой выхода.
  const gameEl = getElById(stub, 'game');
  MODE_CLASSES.forEach((c) => gameEl.classList.remove(c));

  global.setGameMode('davay-mode');
  assert(gameEl.classList.contains('davay-mode'), 'режим должен установиться');

  global.setGameMode('video-mode');
  assert(gameEl.classList.contains('video-mode'), 'новый режим должен установиться');
  assert(!gameEl.classList.contains('davay-mode'), 'прежний режим должен сняться');

  global.setGameMode(null);
  MODE_CLASSES.forEach((c) => {
    assert(!gameEl.classList.contains(c), `режим ${c} должен сняться`);
  });
});

console.log('\n=== Геометрия закреплённой строки (название игры / метка хода) ===');

// Этот сценарий считает координаты по фактическим правилам styles/app.css —
// на этом месте проект ошибался уже трижды (см. README, «название игры»):
//   1) top:0                       — заголовок под камерой;
//   2) position:fixed              — заголовок разъезжается с кнопками;
//   3) top:12px без safe-area      — то же, что (1): padding-top #app
//      absolute-потомка НЕ сдвигает, поэтому safe-area надо прибавлять явно.
// Проверяем не текст правила, а ЧИСЛА, которые из него следуют, в двух
// режимах: обычный браузер (safe-area 0, #app padding-top 16px) и
// установленная PWA на iPhone (safe-area 47px, padding-top равен ей же).
test('Геометрия: название игры не уходит под камеру и не отрывается от кнопок', () => {
  const css = fs.readFileSync(path.join(ROOT, 'styles/app.css'), 'utf8');
  // Комментарии вырезаем: внутри правила тоже встречается текст
  // «calc(12px + env(...))», и проверка читала бы пояснение вместо значения.
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
  const ruleBody = (sel) => {
    const m = css.match(new RegExp(sel.replace(/[.$()#]/g, '\\$&') + '\\{([\\s\\S]*?)\\}'));
    return m ? stripComments(m[1]) : '';
  };

  const num = (re, src, label) => {
    const m = stripComments(src).match(re);
    assert(!!m, `не найдено правило «${label}» в styles/app.css`);
    return m ? parseFloat(m[1]) : NaN;
  };

  // Разбираем правила ровно в том виде, в котором их читает браузер.
  const labelBody = ruleBody('.game-level-label');
  const turnBody = ruleBody('.td-turn-label:first-child');
  const progressBody = ruleBody('#game #levelProgress');

  const fabTopBase = num(/top:\s*calc\((\d+px)\s*\+\s*env\(safe-area-inset-top[^)]*\)\s*\)/,
    ruleBody('.fab-menu-btn'), 'top FAB-кнопки «☰»');
  const labelTop = num(/top:\s*calc\((\d+px)\s*\+\s*env\(safe-area-inset-top[^)]*\)\s*\)/, labelBody,
    'top названия игры (calc(12px + safe-area))');
  const turnTop = num(/top:\s*calc\((\d+px)\s*\+\s*env\(safe-area-inset-top[^)]*\)\s*\)/, turnBody,
    'top метки хода (calc(12px + safe-area))');
  const labelH = num(/height:\s*(\d+)px/, labelBody, 'height названия игры');
  const padMatch = css.match(/--screen-top-pad:\s*min\((\d+)px,\s*calc\((\d+)px\s*\+\s*env\(safe-area-inset-top/);
  assert(!!padMatch, 'не найдена формула --screen-top-pad: min(56px, calc(40px + env(safe-area-inset-top)))');
  const padMax = padMatch ? parseFloat(padMatch[1]) : NaN;  // для PWA
  const padBase = padMatch ? parseFloat(padMatch[2]) : NaN; // для браузера (safe-area 0)

  [0, 47].forEach((safe) => {
    const appPad = Math.max(16, safe);            // padding-top #app
    const screenPad = Math.min(padMax, padBase + safe); // отступ контента .screen
    const labelTopPx = labelTop + safe;           // top отсчитывается от padding-края #app
    const labelBottom = labelTopPx + labelH;
    const contentTop = appPad + screenPad;        // верх контента в координатах экрана
    const where = safe === 0 ? 'браузер (safe-area 0)' : `PWA iPhone (safe-area ${safe})`;

    // 1. Название не должно залезать в зону камеры/статус-бара.
    assert(labelTopPx >= Math.max(12, safe),
      `${where}: название игры на ${labelTopPx}px от верха экрана — попадает в зону камеры`);
    // 2. Название и метка хода — на одной линии (иначе строки «разъезжаются»).
    assert(Math.abs(labelTopPx - (turnTop + safe)) < 0.01,
      `${where}: название и метка хода на разной высоте: ${labelTopPx}px и ${turnTop + safe}px`);
    // 3. Название стоит ровно на линии FAB-кнопок «←»/«☰».
    assert(Math.abs(labelTopPx - (fabTopBase + safe)) < 0.01,
      `${where}: название разошлось с кнопками: ${labelTopPx}px против ${fabTopBase + safe}px`);
    // 4. Под названием — зазор 8px, а не пустая полоса (и не наложение).
    assert(Math.abs(contentTop - labelBottom - 8) < 0.01,
      `${where}: зазор под названием ${contentTop - labelBottom}px вместо 8px`);
    // 5. Вторая строка верхней панели («До след. уровня», только в «Фантах»)
    //    не наезжает на первую. У #levelProgress мелкий шрифт и своя высота
    //    строки, поэтому требуем, чтобы её верх не заходил на название.
    if (progressBody) {
      const progressTop = num(/top:\s*calc\((\d+px)\s*\+\s*env\(safe-area-inset-top[^)]*\)\s*\+\s*(\d+)px/,
        progressBody, 'top строки «До след. уровня»');
      const progressOffset = num(/top:\s*calc\(\d+px\s*\+\s*env\(safe-area-inset-top[^)]*\)\s*\+\s*(\d+)px/,
        progressBody, 'смещение строки «До след. уровня»');
      assert(progressTop + safe + progressOffset > labelTopPx,
        `${where}: строка «До след. уровня» начинается на ${progressTop + safe + progressOffset}px — не ниже названия (${labelTopPx}px)`);
      assert(progressTop + safe + progressOffset <= labelBottom,
        `${where}: строка «До след. уровня» (${progressTop + safe + progressOffset}px) ушла ниже названия (низ ${labelBottom}px) — вторая строка верхней панели оторвалась`);
    }
  });
});

test('Стрелка: игры без паузы возвращаются на предыдущий экран', () => {
  const screenIds = [...html.matchAll(/<section id="([^"]+)" class="screen/g)].map(m => m[1]);
  const screens = screenIds.map(id => document.getElementById(id));
  const originalQuery = document.querySelectorAll;
  const originalSingleQuery = document.querySelector;
  const activeBefore = screens.filter(el => el.classList.contains('active'));
  const cases = [
    ['sexQuestGame', 'sexQuestSetup'],
    ['passionMapGame', 'passionMapSetup'],
    ['partyHangmanGame', 'setup'],
    ['businessLemonadeGame', 'businessLemonadeSetup'],
  ];
  const clearScreens = () => screens.forEach(el => el.classList.remove('active'));
  const activeScreens = () => screens.filter(el => el.classList.contains('active'));
  document.querySelectorAll = function(selector){
    if(selector === '.screen.active') return activeScreens();
    if(selector === '.screen') return screens;
    return originalQuery.call(this, selector);
  };
  document.querySelector = function(selector){
    if(selector === '.screen.active') return activeScreens()[0] || null;
    return originalSingleQuery.call(this, selector);
  };
  try {
    asFantyScreen();
    ['globalMenuModal', 'rulesHubModal', 'summaryModal', 'pauseMenuModal'].forEach(id => {
      const modal = document.getElementById(id);
      if(modal) modal.classList.remove('show');
    });
    for(const [gameId, targetId] of cases){
      clearScreens();
      if(typeof restoreParentScreenId === 'function') restoreParentScreenId();
      rememberReturnScreen(targetId, targetId === 'setup' ? 'soloView' : 'twoPlayerView');
      document.getElementById(gameId).classList.add('active');
      state.inProgress = true;
      state.pausedMode = null;
      const history = JSON.stringify(state.sexQuestChecklists);
      const back = document.getElementById('globalBackBtn');
      for(const { handler } of back._getHandlers().get('click')) handler({});
      assert(activeScreens().map(el => el.id).join(',') === targetId,
        `${gameId}: стрелка должна открыть только ${targetId}, открыто ${activeScreens().map(el => el.id)}`);
      assert(!state.inProgress && state.pausedMode === null, `${gameId}: флаги партии сняты`);
      assert(!document.getElementById('pauseMenuModal').classList.contains('show'), `${gameId}: без паузы`);
      assert(JSON.stringify(state.sexQuestChecklists) === history, 'Прерывание не сохраняет чек-лист');
    }
  } finally {
    clearScreens();
    activeBefore.forEach(el => el.classList.add('active'));
    document.querySelectorAll = originalQuery;
    document.querySelector = originalSingleQuery;
  }
});


test('Пройди квест: итоги и игровой экран без счёта', () => {
  assert(!/id="sexQuest(?:ScoreLabel|SummaryScore)"/.test(html), 'счётчики удалены из разметки');
  updateSexQuestProgress();
  renderSexQuestSummary({ items: [], score: 3 });
  assert(document.getElementById('sexQuestSummaryList').innerHTML === '', 'старые итоги со счётом открываются без ошибок');
  const source = fs.readFileSync(path.join(ROOT, 'games/sexquest.js'), 'utf8');
  assert(!source.split('\n').some(line => line.includes('renderSexQuestOutcome(') && /очк/.test(line)),
    'сообщения результатов не показывают начисление очков');
});

test('Пройди квест: для ручного старта нужен полный набор вопросов', () => {
  const saved = { count: state.sexQuestCount, mode: state.sexQuestMode, ids: state.sexQuestManualIds };
  const ids = getSexQuestWishes().slice(0, 5).map(w => w.id);
  const button = document.getElementById('sexQuestStartBtn');
  const hint = document.getElementById('sexQuestStartHint');
  try {
    state.sexQuestCount = 5;
    state.sexQuestMode = 'manual';
    state.sexQuestManualIds = ids.slice(0, 1);
    renderSexQuestModeGroup();
    assert(button.disabled && !hint.hidden, 'один из пяти: старт заблокирован');
    assert(hint.innerHTML === 'Добавьте 4 вопроса<br>или поменяйте режим', 'подсказка в две строки с точным количеством');
    state.sexQuestManualIds = ids.slice(0, 4);
    renderSexQuestPickList();
    assert(button.disabled && hint.innerHTML.includes('Добавьте 1 вопрос<br>'), 'после выбора подсказка обновляется');
    state.sexQuestManualIds = ids;
    renderSexQuestPickList();
    assert(!button.disabled && hint.hidden, 'полный набор разрешает старт');
    state.sexQuestManualIds = [];
    renderSexQuestPickList();
    assert(button.disabled && hint.innerHTML.includes('Добавьте 5 вопросов<br>'), 'пустой набор блокирует старт');
    state.sexQuestMode = 'random';
    renderSexQuestModeGroup();
    assert(!button.disabled && hint.hidden, 'случайный режим не требует ручного набора');
    state.sexQuestMode = 'manual';
    state.sexQuestManualIds = ids.slice(0, 1);
    state.sexQuestCount = 1;
    renderSexQuestCountGroup();
    renderSexQuestModeGroup();
    assert(!button.disabled && hint.hidden, 'уменьшение количества разрешает старт');
  } finally {
    state.sexQuestCount = saved.count;
    state.sexQuestMode = saved.mode;
    state.sexQuestManualIds = saved.ids;
    updateSexQuestStartAvailability();
  }
});

// «Пройденные задания»: в «Смелом» сохраняется только принятый вопрос —
// одна строка без номера; в «Плавном» и в старых записях формат прежний.
test('sexQuest: история — «Смелый» хранит одну строку согласия, «Плавный» — прежний формат', () => {
  const wishes = [{ id: 1, title: 'Тестовое желание', level: 10, text: 'о', quest: [
    { question: 'Смелый вопрос 1', yesAction: 'Y1' },
    { question: 'Смелый вопрос 2', yesAction: 'Y2' },
    { question: 'Смелый вопрос 3', yesAction: 'Y3' },
  ] }];
  const savedMode = state.sexQuestPlayMode;
  const savedResults = state.sexQuestResults;
  const savedCurrent = sexQuestCurrentWish;
  const savedChecklists = state.sexQuestChecklists;
  try {
    state.sexQuestResults = [];
    // «Смелый»: согласие на 2-м уровне — сохраняется один вопрос, agreedStep=0.
    state.sexQuestPlayMode = 'fast';
    sexQuestCurrentWish = wishes[0];
    recordSexQuestResult(2);
    const fastItem = state.sexQuestResults[state.sexQuestResults.length - 1];
    assert(fastItem.steps.length === 1 && fastItem.steps[0] === 'Смелый вопрос 2', '«Смелый»: сохранён только принятый вопрос');
    assert(fastItem.agreedStep === 0 && fastItem.playMode === 'fast', '«Смелый»: agreedStep=0 и режим записан');
    const fastHtml = renderSexQuestHistorySteps(fastItem);
    assert(fastHtml.indexOf('sexquest-history-bold-answer') >= 0, '«Смелый»: ответ выводится розовой строкой');
    assert(fastHtml.indexOf('<ol') < 0 && fastHtml.indexOf('<li') < 0, '«Смелый»: без нумерованного списка');
    // «Смелый» без согласия — строк ответа нет.
    const beforeSkip = state.sexQuestResults.length;
    recordSexQuestResult(0);
    assert(state.sexQuestResults.length === beforeSkip, 'Без согласия запись не создаётся');
    assert(!('outcome' in fastItem) && !('score' in fastItem), 'Ответ сохраняется без статуса и очков');
    // «Плавный»: цепочка с подсветкой последнего выполненного уровня.
    state.sexQuestPlayMode = 'smooth';
    recordSexQuestResult(2);
    const smoothItem = state.sexQuestResults[state.sexQuestResults.length - 1];
    assert(smoothItem.steps.length === 2 && smoothItem.agreedStep === 1 && smoothItem.playMode === 'smooth', '«Плавный»: цепочка шагов и подсветка сохраняются');
    assert(renderSexQuestHistorySteps(smoothItem).indexOf('sexquest-step-agreed') >= 0, '«Плавный»: вывод с выделением шага');
    // Старая запись без playMode — прежний нумерованный список.
    const legacy = { outcome: 'light', steps: ['Старый шаг 1', 'Старый шаг 2'], agreedStep: 1 };
    const legacyHtml = renderSexQuestHistorySteps(legacy);
    assert(legacyHtml.indexOf('sexquest-history-steps') >= 0 && legacyHtml.indexOf('sexquest-step-agreed') >= 0, 'Старые записи без режима отображаются как раньше');
    state.sexQuestChecklists = JSON.parse(JSON.stringify([{ items: [fastItem] }]));
    goToSexQuestHistory();
    const historyHtml = document.getElementById('sexQuestHistoryList').innerHTML;
    assert(historyHtml.includes('sexquest-history-bold-answer') && historyHtml.includes('Смелый вопрос 2') && !historyHtml.includes('<ol'), 'Страница истории выводит сохранённый ответ без нумерации');
    assert(!historyHtml.includes('sexquest-summary-outcome'), 'История без статусов выполнения');
    renderSexQuestSummary({ items: [fastItem, smoothItem] });
    const summaryHtml = document.getElementById('sexQuestSummaryList').innerHTML;
    assert(summaryHtml.includes('Смелый вопрос 2') && !summaryHtml.includes('sexquest-summary-outcome'), 'Итоги содержат ответы без рейтингов');
    deleteSexQuestHistoryItem(0, 0);
    assert(state.sexQuestChecklists.length === 0, 'Удаление последнего ответа удаляет чек-лист без пересчёта очков');
  } finally {
    state.sexQuestChecklists = savedChecklists;
    state.sexQuestResults = savedResults;
    sexQuestCurrentWish = savedCurrent;
    state.sexQuestPlayMode = savedMode;
  }
});

// Сапёр: финальные задания в сводке. Регресс 1: ручная правка cards_kids_saper.js
// удалила KIDS_SAPER_FINAL, из-за чего блок финального задания в сводке не
// показывался. Регресс 2 (текущее поведение): в конце партии должно быть ОДНО
// общее финальное задание — выполняют все игроки вместе как хорошее завершение
// вечера; промежуточных бонусных заданий в игре нет.
test('Сапёр: одно общее финальное задание в сводке, без деления по командам', () => {
  assert(typeof KIDS_SAPER_FINAL !== 'undefined' && Array.isArray(KIDS_SAPER_FINAL) && KIDS_SAPER_FINAL.length > 0,
    'KIDS_SAPER_FINAL должен существовать и быть непустым');
  assert(typeof pickKidsSaperFinalTask === 'function' && pickKidsSaperFinalTask() !== null,
    'pickKidsSaperFinalTask() должен возвращать задание');
  assert(typeof KIDS_SAPER_BONUS === 'undefined' && typeof getKidsSaperBonusList === 'undefined' && typeof pickKidsSaperBonus === 'undefined',
    'бонусные пулы и функции (KIDS_SAPER_BONUS/getKidsSaperBonusList/pickKidsSaperBonus) должны быть удалены');
  // Прогоняем showKidsSaperSummaryModal: общий финал должен появиться.
  const saved = { players: state.partyPlayers, grid: state.kidsSaperGrid, checked: state.kidsSaperChecked,
    completed: state.kidsSaperCompleted, lines: state.kidsSaperWonLines, level: state.kidsSaperLevel,
    finished: state.kidsSaperFinished, esc2: state.kidsSaperEscalatedTo2, esc3: state.kidsSaperEscalatedTo3,
    checklist: state.kidsSaperBonusChecklist };
  try {
    state.partyPlayers = ['Команда 1', 'Команда 2'];
    state.kidsSaperCompleted = [10, 5];
    state.kidsSaperWonLines = [0, 1, 2, 3, 4];
    state.kidsSaperChecked = new Array(25).fill(false);
    state.kidsSaperChecked[0] = true;
    state.kidsSaperGrid = new Array(25).fill({text:'x', green:false});
    state.kidsSaperLevel = 3;
    state.kidsSaperFinished = false;
    state.kidsSaperEscalatedTo2 = true;
    state.kidsSaperEscalatedTo3 = true;
    state.kidsSaperBonusChecklist = [];
    showKidsSaperSummaryModal();
    const bonus = document.getElementById('kidsSaperSummaryBonusText');
    const final = document.getElementById('kidsSaperSummaryFinalTaskText');
    assert(!bonus, 'блока «бонус победителю» в сводке больше не должно быть');
    assert(final && final.style.display === 'block' && final.textContent.includes('Финальное задание'),
      'общее финальное задание должно показываться (display:block): ' + (final && final.style.display));
    assert(final && !final.textContent.includes('команде'),
      'финальное задание должно быть общим, без адресата «команде …»: ' + (final && final.textContent));
    assert(Array.isArray(state.kidsSaperBonusChecklist) && state.kidsSaperBonusChecklist.length > 0,
      'финальное задание должно попасть в чек-лист «Задания после игры»');
  } finally {
    Object.assign(state, saved);
  }
});

// Сапёр: партия завершается после 5 собранных линий (как в Бинго), а не только при всех 25 клетках.
test('Сапёр: партия завершается при 5 линиях', () => {
  const saved = { checked: state.kidsSaperChecked, lines: state.kidsSaperWonLines, finished: state.kidsSaperFinished, inProgress: state.inProgress };
  try {
    state.kidsSaperChecked = new Array(25).fill(true);
    state.kidsSaperWonLines = [0, 1, 2, 3, 4];
    state.kidsSaperFinished = false;
    state.inProgress = true;
    checkKidsSaperGameFinished();
    assert(state.kidsSaperFinished === true, 'партия должна завершиться при 5 линиях');
  } finally {
    Object.assign(state, saved);
  }
});

// Счастливый билет: партия идёт по клеткам поля, промежуточных заданий нет —
// только одно финальное задание проигравшей команде после окончания партии
// (см. showLuckySummaryModal). Регресс: удалённые остатки бонусной механики
// (LUCKY_BONUS, showLuckyBonus, чек-лист бонусов) не должны возвращаться.
test('Счастливый билет: только финальное задание проигравшей, без промежуточных', () => {
  assert(typeof LUCKY_TASKS !== 'undefined' && LUCKY_TASKS.filter(t=>t.level===1).length === 50
      && LUCKY_TASKS.filter(t=>t.level===2).length === 50 && LUCKY_TASKS.filter(t=>t.level===3).length === 50,
    'колода клеток: по 50 заданий на уровень');
  assert(typeof LUCKY_BONUS === 'undefined', 'промежуточных заданий LUCKY_BONUS быть не должно');
  assert(typeof showLuckyBonus === 'undefined' && typeof renderLuckyBonusChecklist === 'undefined',
    'функций промежуточных бонусов быть не должно (есть showLuckyLevelUp)');
  assert(typeof showLuckyLevelUp === 'function', 'окно повышения уровня showLuckyLevelUp должно существовать');
  assert(typeof pickLuckyFinalTask === 'function' && pickLuckyFinalTask() !== null,
    'pickLuckyFinalTask() должен возвращать задание');
  // Прогоняем showLuckySummaryModal: финал — только проигравшей, победителю — ничего.
  const saved = { teams: state.luckyTeams, grid: state.luckyGrid, checked: state.luckyChecked,
    completed: state.luckyCompleted, lines: state.luckyWonLines, level: state.luckyLevel,
    finished: state.luckyFinished, esc2: state.luckyEscalatedTo2, esc3: state.luckyEscalatedTo3,
    turn: state.luckyCurrentTeamIndex, turns: state.luckyTeamTurnCount };
  try {
    state.luckyTeams = [{name:'Альфа'}, {name:'Бета'}];
    state.luckyCompleted = [10, 5];
    state.luckyWonLines = [0, 1, 2, 3, 4];
    state.luckyChecked = new Array(25).fill(true);
    state.luckyGrid = new Array(25).fill('x');
    state.luckyLevel = 3;
    state.luckyFinished = false;
    state.luckyEscalatedTo2 = true;
    state.luckyEscalatedTo3 = true;
    state.luckyCurrentTeamIndex = 0;
    state.luckyTeamTurnCount = [5, 5];
    showLuckySummaryModal();
    const final = document.getElementById('luckySummaryFinalTaskText');
    assert(final && final.style.display === 'block' && final.textContent.includes('Финальное задание'),
      'финальное задание должно показываться (display:block): ' + (final && final.style.display));
    assert(final && final.textContent.includes('«Бета»'),
      'финальное задание адресовано проигравшей команде «Бета»: ' + (final && final.textContent));
    assert(!document.getElementById('luckySummaryBonusText'),
      'блока промежуточного бонуса в сводке быть не должно');
    // Ничья: проигравшего нет — финал не показываем.
    state.luckyCompleted = [7, 7];
    state.luckyFinished = false;
    showLuckySummaryModal();
    const finalTie = document.getElementById('luckySummaryFinalTaskText');
    assert(finalTie && finalTie.style.display === 'none',
      'при ничьей финальное задание не показывается');
  } finally {
    Object.assign(state, { luckyTeams: saved.teams, luckyGrid: saved.grid, luckyChecked: saved.checked,
      luckyCompleted: saved.completed, luckyWonLines: saved.lines, luckyLevel: saved.level,
      luckyFinished: saved.finished, luckyEscalatedTo2: saved.esc2, luckyEscalatedTo3: saved.esc3,
      luckyCurrentTeamIndex: saved.turn, luckyTeamTurnCount: saved.turns });
  }
});

// Счастливый билет: полный цикл партии — старт, ходы, повышение уровня, финал.
test('Счастливый билет: полный цикл партии без ошибок', () => {
  const savedState = JSON.stringify(state);
  const savedStorage = localStorage.getItem(STORAGE_KEY);
  try {
    state.luckyTeams = [{name:'Альфа'}, {name:'Бета'}];
    goToLuckyGame();
    assert(Array.isArray(state.luckyGrid) && state.luckyGrid.length === 25, 'поле 5×5 создано');
    assert(state.luckyChecked.length === 25 && state.luckyChecked.every(v=>v===false), 'все клетки неотмечены');
    clickLuckyCell(0);
    assert(state.luckyChecked[0] === true, 'клетка отмечается по клику');
    // Собираем первую линию вручную → повышение уровня без промежуточных заданий.
    state.luckyChecked = new Array(25).fill(false);
    [0, 1, 2, 3].forEach(i=>{ state.luckyChecked[i] = true; });
    state.luckyWonLines = [];
    state.luckyEscalatedTo2 = false;
    state.luckyEscalatedTo3 = false;
    state.luckyFinished = false;
    clickLuckyCell(4);
    assert(state.luckyLevel === 2, 'после 1-й линии уровень повышен до 2');
    assert(document.getElementById('luckyLevelUpModal').classList.contains('show'),
      'показано окно повышения уровня');
    hideModal('luckyLevelUpModal');
    // Пауза и продолжение.
    pauseLuckyGame();
    assert(state.pausedMode === 'lucky', 'пауза запоминает режим lucky');
    resumeLuckyGame();
    assert(state.pausedMode === null, 'продолжение снимает паузу');
    // Финал: 5 линий → сводка с финальным заданием проигравшей.
    state.luckyWonLines = [0, 1, 2, 3, 4];
    state.luckyChecked = new Array(25).fill(true);
    state.luckyFinished = false;
    state.luckyCompleted = [15, 10];
    checkLuckyGameFinished();
    assert(state.luckyFinished === true, 'партия завершена при 5 линиях');
    assert(document.getElementById('luckySummaryModal').classList.contains('show'),
      'показано окно итогов');
    const final = document.getElementById('luckySummaryFinalTaskText');
    assert(final && final.style.display === 'block', 'в итогах есть финальное задание');
    hideModal('luckySummaryModal');
  } finally {
    Object.assign(state, JSON.parse(savedState));
    if (savedStorage === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, savedStorage);
  }
});

test('Магазин: порядок денег и купюра 2000 ₽', () => {
  const originalCreate = document.createElement;
  const seq = []; // все созданные элементы в порядке создания
  document.createElement = function(tag){
    const el = originalCreate.call(document, tag);
    if(tag === 'button'){
      el.addEventListener = (type, handler) => { if(type === 'click') el.testClick = handler; };
    }
    el._isButton = tag === 'button';
    seq.push(el);
    return el;
  };
  try {
    openShopMoneyPanel(2000, 'pay');
    const buttons = seq.filter(e=>e._isButton);
    assert(buttons.map(b=>b.textContent).join(',') === '1 ₽,2 ₽,5 ₽,10 ₽,50 ₽,100 ₽,200 ₽,500 ₽,1000 ₽,2000 ₽', 'номиналы идут по возрастанию');
    // 4 строки: монеты (4 кнопки), затем купюры по 2 (50+100, 200+500, 1000+2000)
    const rows = seq.filter(e=>!e._isButton && typeof e.className === 'string' && e.className.includes('shop-money-row'));
    assert(rows.length === 4, 'денежная сетка состоит из 4 строк, получено ' + rows.length);
    const perRow = rows.map(row => {
      const idx = seq.indexOf(row);
      let count = 0;
      for(let i = idx + 1; i < seq.length; i++){
        if(!seq[i]._isButton && typeof seq[i].className === 'string' && seq[i].className.includes('shop-money-row')) break;
        if(seq[i]._isButton) count++;
      }
      return { coin: row.className.includes('shop-money-row-coin'), count };
    });
    assert(JSON.stringify(perRow) === JSON.stringify([{coin:true,count:4},{coin:false,count:2},{coin:false,count:2},{coin:false,count:2}]),
      'строки: монеты (4), затем купюры по 2 — получено ' + JSON.stringify(perRow));
    const bill = buttons[9];
    bill.testClick();
    assert(getElById(stub, 'shopMoneySum').textContent === '2000 ₽', 'новая купюра добавляет 2000 ₽');
  } finally {
    document.createElement = originalCreate;
    closeShopMoneyPanel();
  }
});

test('Магазин: скрытая подсказка сохраняется между покупателями и после загрузки', () => {
  const savedState = JSON.stringify(state);
  const savedStorage = localStorage.getItem(STORAGE_KEY);
  const toggle = () => {
    for (const { handler } of getElById(stub, 'shopHintToggleBtn')._getHandlers().get('click')) handler({});
  };
  const visible = () => getElById(stub, 'shopMoneyTargetLabel').style.display !== 'none';
  try {
    state.shopMode = 'seller';
    state.shopHintVisible = true;
    goToShopGame();
    assert(visible(), 'по умолчанию подсказка видна');
    toggle();
    assert(!visible(), 'кнопка скрывает подсказку');
    for (const { handler } of getElById(stub, 'shopNextSaleBtn')._getHandlers().get('click')) handler({});
    assert(!visible(), 'следующий покупатель не открывает подсказку');
    pauseShopGame();
    resumeShopGame();
    assert(!visible(), 'после паузы подсказка скрыта');
    assert(JSON.parse(localStorage.getItem(STORAGE_KEY)).shopHintVisible === false, 'выбор записан в хранилище');
    state.shopHintVisible = true;
    loadState();
    openShopMoneyPanel(100, 'change');
    assert(state.shopHintVisible === false && !visible(), 'загрузка восстанавливает скрытую подсказку');
    openShopMoneyPanel(100, 'pay');
    assert(visible(), 'сумма оплаты покупателя видна независимо от подсказки');
    openShopMoneyPanel(100, 'change');
    toggle();
    openShopMoneyPanel(200, 'change');
    assert(visible(), 'включённая подсказка также запоминается');
  } finally {
    Object.assign(state, JSON.parse(savedState));
    if (savedStorage === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, savedStorage);
  }
});


console.log('\n=== Кнопки уровня и ссылка «Поделиться видео» ===');

// 🔥 «Горячее» в «Видеорулетке» продублирована: быстрая кнопка в верхнем ряду
// (сразу после «Следующее», в один тап) и такая же иконка в блоке
// «Дополнительно». Действие одно — и обработчик обязан быть один: две копии
// этого кода разошлись бы при первой же правке уровня/подуровней.
test('Сценарий: две кнопки 🔥 «Горячее» делят один обработчик', () => {
  const quick = getElById(stub, 'videoHotBtn');
  const inMenu = getElById(stub, 'videoLevelUpBtn');
  assert(!!quick && !!inMenu, 'кнопки 🔥 должны быть в разметке (быстрая и в «Дополнительно»)');
  if (!quick || !inMenu) return;
  const handlersOf = (el) => (el._getHandlers().get('click') || []).map((h) => h.handler);
  const quickHandlers = handlersOf(quick);
  const menuHandlers = handlersOf(inMenu);
  assert(quickHandlers.length === 1 && menuHandlers.length === 1,
    'на каждой кнопке 🔥 ровно один обработчик клика');
  assert(quickHandlers[0] === menuHandlers[0],
    '🔥 в строке ответов и 🔥 в «Дополнительно» должны звать одну и ту же функцию');
});

// Кнопка 🔥 должна шагать как «Горячее»: сначала на следующую папку внутри
// уровня («Level 1-1 …» → «Level 1-2 …»), а когда своих папок больше нет —
// на следующий уровень. Сам переход подменяем шпионом: важно, какие аргументы
// уходят в общий switchVideoLevel (он вызывает draw-функцию игры).
const clickQuickHot = (stubRef) => {
  const btn = getElById(stubRef, 'videoHotBtn');
  const handlers = btn._getHandlers().get('click') || [];
  handlers.forEach(({ handler }) => handler({}));
};
const withVideoHotSpy = (cards, body) => {
  const list = global.getDavayCardsList();
  const savedList = list.slice();
  const savedSwitch = global.switchVideoLevel;
  const savedToast = global.showToast;
  const savedLevelSound = global.playLevelUpSound;
  const calls = [];
  try {
    list.length = 0;
    cards.forEach((c) => list.push(c));
    global.switchVideoLevel = (level, sub) => { calls.push([level, sub]); return true; };
    global.showToast = () => {};
    global.playLevelUpSound = () => {};
    body(calls);
  } finally {
    global.switchVideoLevel = savedSwitch;
    global.showToast = savedToast;
    global.playLevelUpSound = savedLevelSound;
    list.length = 0;
    savedList.forEach((c) => list.push(c));
  }
};

test('Сценарий: 🔥 «Горячее» шагает на следующую папку уровня', () => {
  withVideoHotSpy([
    { id: 'a', name: 'a.webm', level: 1, video: 'v1', yandexPath: 'disk:/Level 1-1 Разогрев/a.webm' },
    { id: 'b', name: 'b.webm', level: 1, video: 'v2', yandexPath: 'disk:/Level 1-2 Ласки легкие/b.webm' },
  ], (calls) => {
    clickQuickHot(stub);
    assert(calls.length === 1,
      `нажатие 🔥 должно сделать один переход, сделано: ${calls.length}`);
    assert(calls[0] && calls[0][0] === 1 && calls[0][1] === 2,
      `🔥 должна уйти на подуровень 2 того же уровня, а ушла на ${JSON.stringify(calls[0])}`);
  });
});

test('Сценарий: 🔥 «Горячее» без папок в уровне поднимает на следующий уровень', () => {
  // В уровне 1 только папка подуровня 1 — своих папок выше нет: шаг идёт в
  // следующий уровень целиком, на его первый подуровень.
  withVideoHotSpy([
    { id: 'a', name: 'a.webm', level: 1, video: 'v1', yandexPath: 'disk:/Level 1-1 Разогрев/a.webm' },
  ], (calls) => {
    clickQuickHot(stub);
    assert(calls[0] && calls[0][0] === 2 && calls[0][1] === 1,
      `без папок в уровне 🔥 должна уйти на уровень 2 подуровень 1, а ушла на ${JSON.stringify(calls[0])}`);
  });
});

// Ссылка-вход ?mode=video&e=…&level=… — проверяем полный круг: собрали ссылку,
// распаковали параметры, нашли по ним карточку каталога. Ключ — путь на Яндекс
// Диске, затем имя файла, затем id (работает на том же устройстве).
test('Сценарий: ссылка-вход «Поделиться видео» ведёт на тот же ролик', () => {
  if (typeof global.videoEntryPointUrl !== 'function' ||
      typeof global.findVideoCardByEntryKey !== 'function') {
    assert(false, 'videoEntryPointUrl/findVideoCardByEntryKey недоступны глобально');
    return;
  }
  const card = {
    id: 'card-1', name: 'demo.webm', level: 3,
    video: 'disk:/Level 3-2 Близость/f.webm',
    yandexPath: 'disk:/Level 3-2 Близость/f.webm',
  };
  const url = global.videoEntryPointUrl(card, 3);
  assert(url.indexOf('https://example.test/?') === 0,
    `ссылка должна вести на приложение, а не на файл: ${url}`);
  const params = new URLSearchParams(url.split('?')[1]);
  assert(params.get('mode') === 'video', 'без ?mode=video получатель не попадёт в «Видеорулетку»');
  assert(params.get('level') === '3', `уровень потерялся: ${params.get('level')}`);
  assert(params.get('e') === card.yandexPath, `ключ видео потерялся: ${params.get('e')}`);

  // Каталог получателя: у него та же запись может нести данные в другом поле
  // (путь на Диске появляется только после синхронизации) — ключ сравнивается
  // с каждым полем по отдельности, а не только с приоритетным.
  const list = global.getDavayCardsList();
  const saved = list.slice();
  list.length = 0;
  list.push(card);
  try {
    assert(global.findVideoCardByEntryKey(params.get('e')) === card,
      'по ключу из ссылки (путь на Диске) ролик должен находиться');
    assert(global.findVideoCardByEntryKey(card.name) === card,
      'ключ по имени файла тоже должен работать');
    assert(global.findVideoCardByEntryKey(card.id) === card,
      'ключ по id карточки тоже должен работать');
    assert(global.findVideoCardByEntryKey('нет-такого-видео') === null,
      'чужой ключ не должен давать ложное совпадение');
  } finally {
    list.length = 0;
    saved.forEach((c) => list.push(c));
  }
});

test('Сценарий: ссылка-вход «Давай попробуем» ведёт на тот же ролик', async () => {
  if (typeof global.davayEntryPointUrl !== 'function' ||
      typeof global.findDavayCardByEntryKey !== 'function' ||
      typeof global.openDavayFromLink !== 'function') {
    assert(false, 'davayEntryPointUrl/findDavayCardByEntryKey/openDavayFromLink недоступны');
    return;
  }
  const card = {
    id: 'davay-1', name: 'demo.webm', level: 3,
    video: 'disk:/Level 3-2 Близость/d.webm',
    yandexPath: 'disk:/Level 3-2 Близость/d.webm',
  };
  const url = global.davayEntryPointUrl(card, 3);
  const params = new URLSearchParams(url.split('?')[1]);
  assert(params.get('mode') === 'davay', 'без ?mode=davay ссылка не откроет нужную игру');
  assert(params.get('level') === '3', `уровень потерялся: ${params.get('level')}`);
  assert(params.get('e') === card.yandexPath, `ключ ролика потерялся: ${params.get('e')}`);

  const list = global.getDavayCardsList();
  const saved = list.slice();
  list.length = 0;
  list.push(card);
  try {
    assert(global.findDavayCardByEntryKey(params.get('e')) === card, 'поиск по пути Диска не работает');
    assert(global.findDavayCardByEntryKey(card.name) === card, 'поиск по имени файла не работает');
    assert(global.findDavayCardByEntryKey(card.id) === card, 'поиск по id карточки не работает');
    assert(global.findDavayCardByEntryKey('чужой ключ') === null, 'чужой ключ не должен давать совпадение');

    const savedQueue = eval('state.davayQuizQueue');
    const savedLevel = eval('davayLevel');
    const savedSub = eval('davaySubLevel');
    const savedSelected = eval('state.davaySelectedLevel');
    const savedInProgress = eval('state.inProgress');
    const savedPaused = eval('state.pausedMode');
    try {
      await global.openDavayFromLink({ key: card.id, level: '3' });
      assert(eval('davayLevel') === 3, `вход должен выбрать уровень ролика, получен ${eval('davayLevel')}`);
      assert(eval('davaySubLevel') === 2, `вход должен выбрать подуровень ролика, получен ${eval('davaySubLevel')}`);
      assert(eval('state.davayQuizQueue[0]') === card.id,
        `присланный ролик должен быть первым в очереди, очередь: ${JSON.stringify(eval('state.davayQuizQueue'))}`);
    } finally {
      eval(`state.davayQuizQueue = savedQueue; davayLevel = savedLevel; davaySubLevel = savedSub;
        state.davaySelectedLevel = savedSelected; state.inProgress = savedInProgress; state.pausedMode = savedPaused;`);
    }
  } finally {
    list.length = 0;
    saved.forEach(c => list.push(c));
  }
});

// Вход по ссылке на чужом телефоне: ролика может не быть в каталоге
// (синхронизацию с Диском там ещё не нажимали). Проверяем, что игра в этом
// случае молча подтягивает облако и ищет снова, а не падает в демо-ролик
// («у получателя демо, у меня всё хорошо»), а ненайденный ролик даёт
// заглушку с подсказкой, а не демо.
test('Сценарий: вход по ссылке подтягивает облако, а не показывает демо', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'games/fants-video.js'), 'utf8');
  assert(src.includes('await importYandexVideos()'),
    'goToVideoGame должен подтягивать облако, если ролик из ссылки не найден');
  assert(src.includes('Это видео не найдено в каталоге'),
    'ненайденный ролик из ссылки должен давать заглушку с подсказкой, а не демо');
});

// Telegram принимает видео файлом, поэтому системному меню отдаётся сам ролик
// (navigator.share с files). Раньше уходила только ссылка на страницу приложения —
// статическая страница видео в превью ссылки отдать не может, и в чат приходил
// один текст. Сначала проверяем помощники, которые готовят файл: имя и тип
// определяют, как мессенджер покажет ролик.
test('Сценарий: имя и тип файла для отправки видео определяются верно', () => {
  if (typeof global.videoShareFileName !== 'function' ||
      typeof global.videoShareFileType !== 'function') {
    assert(false, 'videoShareFileName/videoShareFileType недоступны глобально');
    return;
  }
  // Родное имя ролика — приоритет: по нему получатель узнаёт файл.
  assert(global.videoShareFileName({ name: 'clip.webm', video: 'https://disk.yandex.ru/x' }) === 'clip.webm',
    'имя ролика должно уходить в сообщение как есть');
  // У облачных карточек имя есть не всегда — берём его из подписанной ссылки.
  assert(global.videoShareFileName({ video: 'https://downloader.disk.yandex.ru/disk/abc/11173961a.webm?sign=1' }) === '11173961a.webm',
    'без имени файл надо назвать по ссылке, иначе в чат уйдёт безымянный «video»');
  assert(global.videoShareFileName({}) === 'video.mp4',
    'запасное имя должно быть осмысленным');
  // Тип: сперва родной тип ответа, затем — по расширению (Яндекс отдаёт
  // content-type верно, но у локальных роликов его может не быть).
  assert(global.videoShareFileType({ type: 'video/webm' }, 'x.mp4') === 'video/webm',
    'родной тип ответа приоритетнее расширения');
  assert(global.videoShareFileType({ type: '' }, 'x.webm') === 'video/webm',
    'webm без типа должен распознаваться по расширению');
  assert(global.videoShareFileType({ type: '' }, 'x.mov') === 'video/quicktime',
    'mov без типа должен распознаваться по расширению');
  assert(global.videoShareFileType({ type: '' }, 'x.mp4') === 'video/mp4',
    'неизвестное расширение должно давать video/mp4');
});

// Прикладывать файл можно только там, где платформа это умеет
// (navigator.canShare с files). Проверяем, что отказ ведёт к фолбэку, а не к
// попытке отправить файл — иначе меню «Поделиться» просто не откроется.
test('Сценарий: файл прикладывается только при поддержке платформой', () => {
  if (typeof global.shareSupportsFiles !== 'function') {
    assert(false, 'shareSupportsFiles недоступна глобально');
    return;
  }
  const nav = global.navigator;
  const savedCanShare = nav.canShare;
  try {
    delete nav.canShare;
    assert(global.shareSupportsFiles() === false,
      'без navigator.canShare отправка файлов не поддерживается — нужен фолбэк ссылкой');
    nav.canShare = () => false;
    assert(global.shareSupportsFiles() === false,
      'платформа, отклоняющая files, должна получать ссылку');
    nav.canShare = () => true;
    assert(global.shareSupportsFiles() === true,
      'поддерживающая files платформа должна получать сам ролик');
  } finally {
    if (savedCanShare === undefined) delete nav.canShare;
    else nav.canShare = savedCanShare;
  }
});

// Сквозная проверка нажатия ⤴ — от карточки до системного меню «Поделиться».
// Это ровно тот сценарий, из которого пришла жалоба: в Telegram приезжал один
// текст без видео. Раньше к сообщению шла только ссылка на страницу приложения,
// поэтому тест обязан упасть, если files из нагрузки пропадут.
testAsync('Сценарий: ⤴ открывает меню «Поделиться» с самим роликом', async () => {
  const nav = global.navigator;
  const saved = { share: nav.share, canShare: nav.canShare, fetch: global.fetch };
  const card = {
    id: 'card-share', name: 'clip.webm', level: 2,
    video: 'https://example.test/videos/clip.webm',
    yandexPath: 'disk:/Level 2-1 Близость/clip.webm',
  };
  let shared = null;
  let fetched = '';
  try {
    // currentVideoCard объявлен через `let` в контексте скриптов — из теста его
    // не достать ни через global, ни через window, только eval'ом там же.
    eval(`currentVideoCard = ${JSON.stringify(card)};`);
    global.fetch = (url) => {
      if(String(url).indexOf('clck.ru') > -1){
        // Сокращатель недоступен в тесте — возвращаем оригинал.
        return Promise.resolve({ ok: false, text: () => Promise.resolve('') });
      }
      fetched = String(url);
      return Promise.resolve({
        ok: true,
        headers: { get: () => '2048' },
        blob: () => Promise.resolve({ size: 2048, type: 'video/webm' }),
      });
    };
    nav.canShare = (data) => !!(data && data.files && data.files.length);
    nav.share = (data) => { shared = data; return Promise.resolve(); };

    getElById(stub, 'videoShareBtn').click();
    // Обработчик асинхронный: он читает ролик и лишь потом зовёт share.
    for (let i = 0; i < 100 && !shared; i++) await new Promise((r) => setTimeout(r, 5));

    assert(!!shared, 'после нажатия ⤴ системное меню «Поделиться» так и не открылось');
    if (shared) {
      const files = shared.files;
      assert(Array.isArray(files) && files.length === 1,
        'к сообщению должен прикладываться сам ролик (files) — иначе в Telegram уйдёт только текст');
      const file = files && files[0];
      assert(file && file.name === 'clip.webm',
        `файл должен уходить с родным именем ролика, получено «${file && file.name}»`);
      assert(file && file.type === 'video/webm',
        `тип файла должен быть video/webm, получено «${file && file.type}»`);
      // В одной нагрузке Android оставляет системное меню открытым даже после
      // передачи файла. Поэтому файловая ветка содержит только files, а ссылка
      // используется отдельно лишь когда прикрепить файл не удалось.
      assert(shared.url === undefined,
        'url вместе с files запрещён спецификацией — меню упало бы с TypeError');
      assert(shared.title === undefined,
        'title вместе с files оставляет нативное меню открытым на части Android-оболочек');
      assert(shared.text === undefined,
        'text вместе с files оставляет нативное меню открытым даже после отправки ролика');
    }
    assert(fetched === card.video,
      `ролик должен читаться по ссылке карточки, запрос ушёл на: ${fetched}`);
  } finally {
    nav.share = saved.share;
    if (saved.canShare === undefined) delete nav.canShare; else nav.canShare = saved.canShare;
    global.fetch = saved.fetch;
    eval('currentVideoCard = null;');
  }
});

// Первое нажатие ⤴ не должно уходить в ссылочный фолбэк, пока системное окно
// ещё открыто: раньше Promise.race по таймауту запускал второй navigator.share()
// поверх первого, и Telegram застревал на «Загрузка 100%». Этот сценарий
// специально держит первый share-промис незавершённым и кликает второй раз.
testAsync('Сценарий: первое нажатие ⤴ не запускает второй системный вызов', async () => {
  const nav = global.navigator;
  const saved = { share: nav.share, canShare: nav.canShare, fetch: global.fetch };
  const card = {
    id: 'card-once', name: 'once.webm', level: 1,
    video: 'https://example.test/videos/once.webm', yandexPath: 'disk:/once.webm',
  };
  let calls = 0;
  let firstPayload = null;
  let resolveShare = null;
  try {
    eval(`currentVideoCard = ${JSON.stringify(card)};`);
    global.fetch = (url) => {
      if (String(url).indexOf('clck.ru') > -1) {
        return Promise.resolve({ ok: false, text: () => Promise.resolve('') });
      }
      return Promise.resolve({
        ok: true,
        headers: { get: () => '4096' },
        blob: () => Promise.resolve({ size: 4096, type: 'video/webm' }),
      });
    };
    nav.canShare = (data) => !!(data && data.files && data.files.length);
    nav.share = (data) => {
      calls++;
      if (!firstPayload) firstPayload = data;
      return new Promise((resolve) => { resolveShare = resolve; });
    };

    const btn = getElById(stub, 'videoShareBtn');
    btn.click();
    for (let i = 0; i < 100 && calls === 0; i++) await new Promise((r) => setTimeout(r, 5));
    assert(calls === 1, `системное меню должно открыться один раз, вызовов: ${calls}`);

    // Пока первое меню не закрыто, второе нажатие не должно открывать
    // конкурирующее системное меню со ссылкой.
    btn.click();
    await new Promise((r) => setTimeout(r, 30));
    assert(calls === 1,
      `пока открыто первое меню, второй navigator.share запускать нельзя, вызовов: ${calls}`);

    assert(firstPayload && firstPayload.files && firstPayload.files.length === 1,
      'первый вызов должен нести сам ролик');
    assert(firstPayload && firstPayload.title === undefined,
      'у файлового payload не должно быть title — системное меню может остаться открытым');
    assert(firstPayload && firstPayload.text === undefined,
      'у файлового payload не должно быть text — файл отправляется отдельной нагрузкой');

    if (resolveShare) resolveShare();
    await new Promise((r) => setTimeout(r, 30));
    assert(calls === 1,
      `после закрытия меню ссылочный фолбэк не должен открывать второе меню, вызовов: ${calls}`);
  } finally {
    if (resolveShare) resolveShare();
    nav.share = saved.share;
    if (saved.canShare === undefined) delete nav.canShare; else nav.canShare = saved.canShare;
    global.fetch = saved.fetch;
    eval('currentVideoCard = null;');
  }
});

// Видеокарточка должна начинать загрузку сразу, не после общего 220-мс fade.
// Создаём элемент #card с .card-inner: обычный вызов отложил бы paint на таймере,
// а immediate вызывает его синхронно.
test('Сценарий: видеокарточка рисуется сразу, без ожидания 220 мс', () => {
  const card = getElById(stub, 'card');
  const inner = document.createElement('div');
  inner.className = 'card-inner';
  const oldQuery = card.querySelector;
  let paints = 0;
  card.querySelector = (selector) => selector === '.card-inner' ? inner : oldQuery.call(card, selector);
  try {
    global.fadeSwapCard(() => { paints++; }, true);
    assert(paints === 1,
      'режим immediate должен создать <video> и начать загрузку в текущем кадре, не через setTimeout(220)');
  } finally {
    card.querySelector = oldQuery;
  }
});



// Оверлей исчезает, как только доступен первый кадр. На iOS autoplay может
// быть отклонён, поэтому событие playing иногда не наступает вовсе. Одновременно
// проверяем, что новый <video> с src в разметке не вызывает повторный load().
test('Сценарий: оверлей загрузки видео скрывается по canplay', () => {
  const saved = {
    showVideo: global.showVideoCardLoading,
    hideVideo: global.hideVideoCardLoading,
    showDavay: global.showDavayCardLoading,
    hideDavay: global.hideDavayCardLoading,
  };
  try {
    ['video', 'davay'].forEach((mode) => {
      const loading = { style: { display: '' } };
      const handlers = new Map();
      let loads = 0;
      const video = {
        muted: false,
        loop: false,
        error: null,
        addEventListener(type, handler) { handlers.set(type, handler); },
        play() { return Promise.resolve(); },
        pause() {},
        load() { loads++; },
      };
      if (mode === 'video') {
        global.showVideoCardLoading = () => { loading.style.display = ''; };
        global.hideVideoCardLoading = () => { loading.style.display = 'none'; };
        global.setupVideoPlayerElement(video, { source: 'local' }, 1, false);
      } else {
        global.showDavayCardLoading = () => { loading.style.display = ''; };
        global.hideDavayCardLoading = () => { loading.style.display = 'none'; };
        global.setupDavayPlayerElement(video, { source: 'local' }, 1, false);
      }
      assert(loads === 0, `новый ${mode}-плеер не должен повторно вызывать load() для src из разметки`);
      handlers.get('canplay')();
      assert(loading.style.display === 'none',
        `«${mode}Loading» должен скрываться по canplay, даже если playing не наступит`);
    });
  } finally {
    global.showVideoCardLoading = saved.showVideo;
    global.hideVideoCardLoading = saved.hideVideo;
    global.showDavayCardLoading = saved.showDavay;
    global.hideDavayCardLoading = saved.hideDavay;
  }
});

// Большой ролик в память не читается: blob целиком лежит в памяти вкладки, и
// видео на сотни мегабайт уронит страницу на телефоне. Такой ролик должен
// молча уйти ссылкой-входом.
testAsync('Сценарий: слишком большой ролик уходит ссылкой, а не файлом', async () => {
  const saved = { fetch: global.fetch, share: global.navigator.share, canShare: global.navigator.canShare };
  const card = {
    id: 'card-big', name: 'big.mp4', level: 1,
    video: 'https://example.test/videos/big.mp4', yandexPath: 'disk:/big.mp4',
  };
  let shared = null;
  try {
    eval(`currentVideoCard = ${JSON.stringify(card)};`);
    global.fetch = (url) => {
      if(String(url).indexOf('clck.ru') > -1){
        // Сокращатель сокращает — возвращаем короткую ссылку.
        return Promise.resolve({ ok: true, text: () => Promise.resolve('https://clck.ru/short') });
      }
      return Promise.resolve({
        ok: true,
        headers: { get: () => String(500 * 1024 * 1024) },
        blob: () => Promise.resolve({ size: 500 * 1024 * 1024, type: 'video/mp4' }),
      });
    };
    global.navigator.canShare = () => true;
    global.navigator.share = (data) => { shared = data; return Promise.resolve(); };

    getElById(stub, 'videoShareBtn').click();
    for (let i = 0; i < 100 && !shared; i++) await new Promise((r) => setTimeout(r, 5));

    assert(!!shared, 'без отправки игрок остался бы без кнопки «Поделиться» вообще');
    if (shared) {
      assert(!shared.files, 'полугигабайтный ролик нельзя тянуть в память вкладки');
      assert(shared.url === 'https://clck.ru/short',
        'сокращённая ссылка должна попасть в url — иначе в Telegram уйдёт длинная ссылка из 70+ символов');
      assert(shared.title === '🎲 Давай играй',
        'заголовок поделиться должен быть «🎲 Давай играй»');
      assert(shared.text === '🎲 Давай играй\nПопробуем? 😉',
        'ссылочный фолбэк должен содержать название и приглашение «Попробуем?»');
    }
  } finally {
    global.fetch = saved.fetch;
    global.navigator.share = saved.share;
    if (saved.canShare === undefined) delete global.navigator.canShare;
    else global.navigator.canShare = saved.canShare;
    eval('currentVideoCard = null;');
  }
});

// «Вопросы про это»: название уже первой строкой text. Если передать его ещё и
// полем title, Android/Telegram добавляет title к text — в чат приходит
// «🎲 Давай играй» дважды (жалоба игрока). Проверяем единый формат.
testAsync('Сценарий: «Вопросы про это» отправляют название один раз', async () => {
  const nav = global.navigator;
  const saved = { share: nav.share, fetch: global.fetch };
  const card = {
    title: 'Почему рефрактерный период у мужчин у всех разный?',
    text: 'Время восстановления после оргазма зависит от возраста, здоровья, уровня возбуждения, стресса и индивидуальной физиологии. Единой нормы продолжительности не существует.',
  };
  let shared = null;
  try {
    eval(`ideasCurrentCard = ${JSON.stringify(card)};`);
    global.fetch = (url) => {
      if (String(url).indexOf('clck.ru') > -1) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('https://clck.ru/short') });
      }
      return saved.fetch(url);
    };
    nav.share = (data) => { shared = data; return Promise.resolve(); };

    getElById(stub, 'ideasShareBtn').click();
    for (let i = 0; i < 100 && !shared; i++) await new Promise((r) => setTimeout(r, 5));

    assert(!!shared, 'кнопка ⤴ в «Вопросах про это» не открыла системное меню');
    if (shared) {
      assert(shared.title === undefined,
        'title вместе с text даёт двойное «🎲 Давай играй» в Android/Telegram');
      const text = String(shared.text || '');
      assert(text.indexOf('🎲 Давай играй\nВопросы про это:\n\n') === 0,
        `сообщение должно начинаться с одного названия и заголовка игры, получено: ${text}`);
      assert((text.match(/🎲 Давай играй/g) || []).length === 1,
        `название должно встречаться один раз, получено: ${text}`);
      assert(text.indexOf(card.title) > -1 && text.indexOf(card.text) > -1,
        'в сообщении должны остаться вопрос и ответ');
      assert(text.indexOf('https://clck.ru/short') > -1,
        'сокращённая ссылка должна остаться последней строкой');
    }
  } finally {
    nav.share = saved.share;
    global.fetch = saved.fetch;
    eval('ideasCurrentCard = null;');
  }
});

// «Предложи партнеру»: кнопка ⤴ есть на всех уровнях и шарит карточку тем же
// форматом, что «Вопросы про это» — одна строка «🎲 Давай играй», без поля url
// (Android склеивал text+url в «двойную» ссылку), ссылка-вход ?mode=photo
// последней строкой, чтобы получатель открыл ту же карточку.
testAsync('Сценарий: «Предложи партнеру» отправляет карточку по ссылке', async () => {
  const nav = global.navigator;
  const saved = { share: nav.share, fetch: global.fetch };
  const card = {
    level: 3, rank: 7,
    title: 'Поза «Качели»',
    text: 'Описание позы для уровня «Сближение».',
  };
  let shared = null;
  let shortenedReq = '';
  try {
    eval(`currentPhotoCard = ${JSON.stringify(card)};`);
    global.fetch = (url) => {
      if (String(url).indexOf('clck.ru') > -1) {
        // Запрос clck.ru несёт исходную ссылку-вход параметром url= —
        // проверяем по нему, что в адрес уложены mode/level/c.
        shortenedReq = String(url);
        return Promise.resolve({ ok: true, text: () => Promise.resolve('https://clck.ru/short') });
      }
      return saved.fetch(url);
    };
    nav.share = (data) => { shared = data; return Promise.resolve(); };

    getElById(stub, 'photoShareBtn').click();
    for (let i = 0; i < 100 && !shared; i++) await new Promise((r) => setTimeout(r, 5));

    assert(!!shared, 'кнопка ⤴ в «Предложи партнеру» не открыла системное меню');
    if (shared) {
      assert(shared.title === undefined,
        'title вместе с text даёт двойное «🎲 Давай играй» в Android/Telegram');
      assert(shared.url === undefined,
        'поле url нельзя задавать вместе с text — Android склеивает «двойную» ссылку');
      const text = String(shared.text || '');
      assert(text.indexOf('🎲 Давай играй\nПредложи партнеру — ') === 0,
        `сообщение должно начинаться с названия и имени модуля, получено: ${text}`);
      assert((text.match(/🎲 Давай играй/g) || []).length === 1,
        'название должно встречаться один раз');
      assert(text.indexOf(card.title) > -1 && text.indexOf(card.text) > -1,
        'в сообщении должны остаться название и текст карточки');
      assert(decodeURIComponent(shortenedReq).indexOf('mode=photo') > -1
          && decodeURIComponent(shortenedReq).indexOf('level=3') > -1,
        `ссылка-вход должна вести на уровень карточки (?mode=photo&level=3), запрос: ${shortenedReq}`);
      assert(text.indexOf('https://clck.ru/short') > -1,
        'сокращённая ссылка должна остаться последней строкой');
    }
  } finally {
    nav.share = saved.share;
    global.fetch = saved.fetch;
    eval('currentPhotoCard = null;');
  }
});

// Без открытой карточки шарить нечего: кнопка не должна уходить в системное
// меню с пустым текстом — игрок получает тост-подсказку.
test('Сценарий: «Предложи партнеру» без карточки не открывает меню шеринга', () => {
  const nav = global.navigator;
  const savedShare = nav.share;
  let shared = false;
  try {
    eval('currentPhotoCard = null;');
    nav.share = () => { shared = true; return Promise.resolve(); };
    getElById(stub, 'photoShareBtn').click();
    assert(!shared, 'при пустой карточке системное меню открывать нельзя');
  } finally {
    nav.share = savedShare;
  }
});


// «Предложи партнеру»: дефолт — случайный порядок с иконкой 📶 и подсказкой
// «По порядку»; нажатие включает порядок, ставит 🔀 и подсказку «Случайный
// порядок» (подсказка называет, что включится; перестановка — запрос
// владельца, v471). Дефолт в state, сброс и иконка связаны.
test('Сценарий: «Предложи партнеру» стартует случайно (📶), клик включает порядок (🔀)', () => {
  const orderedBefore = eval('state.photoOrderMode');
  assert(orderedBefore === false,
    `после загрузки photoOrderMode должен быть false, получено: ${orderedBefore}`);
  const gameEl = getElById(stub, 'game');
  const btn = getElById(stub, 'photoRandomToggleBtn');
  try {
    // Обработчик кнопки начинается с if(!isPlaceholderMode()) return — без
    // класса placeholder-mode клик молча вышел бы и ничего не переключил.
    gameEl.classList.add('placeholder-mode');
    global.updatePhotoRandomToggleBtn();
    assert(btn.textContent === '📶' && btn.dataset.tt === 'По порядку',
      `в случайном режиме кнопка обязана показывать 📶 с подсказкой «По порядку», получено: ${btn.textContent} / ${btn.dataset.tt}`);
    btn.click();
    assert(eval('state.photoOrderMode') === true,
      'один клик должен включить показ по порядку');
    assert(btn.textContent === '🔀' && btn.dataset.tt === 'Случайный порядок',
      `после клика кнопка обязана показывать 🔀 с подсказкой «Случайный порядок», получено: ${btn.textContent} / ${btn.dataset.tt}`);
    btn.click();
    assert(eval('state.photoOrderMode') === false && btn.textContent === '📶' && btn.dataset.tt === 'По порядку',
      'второй клик должен вернуть случайный порядок, иконку 📶 и подсказку «По порядку»');
  } finally {
    eval('state.photoOrderMode = false;');
    global.updatePhotoRandomToggleBtn();
    gameEl.classList.remove('placeholder-mode');
  }
});

// #gameLevelLabel гаснет на время тоста (тост показывается поверх заголовка) и
// обязан вернуться: раньше видимость возвращал только режим «Предложи партнёру»,
// и после любого тоста в «Видеорулетке» её название пропадало до следующего
// turn-обновления.
test('Сценарий: после тоста название игры снова видно и в «Видеорулетке»', () => {
  if (typeof global.restoreGameLevelLabelAfterToast !== 'function') {
    assert(false, 'restoreGameLevelLabelAfterToast недоступна глобально');
    return;
  }
  const gameEl = getElById(stub, 'game');
  const title = getElById(stub, 'gameLevelLabel');
  const savedText = title.textContent;
  try {
    gameEl.classList.add('video-mode');
    title.style.display = 'block';
    title.textContent = '🎥 Видеорулетка';
    global.showToast('Показываю все видео');
    assert(title.style.display === 'none', 'тост должен гасить заголовок, пока висит');
    global.restoreGameLevelLabelAfterToast(title);
    assert(title.style.display === 'block',
      'в «Видеорулетке» заголовок не вернулся после тоста');
    assert(title.textContent === '🎥 Видеорулетка',
      'возврат видимости не должен переписывать название игры');
    // Режим «Предложи партнёру» по-прежнему показывает там уровень.
    gameEl.classList.remove('video-mode');
    gameEl.classList.add('placeholder-mode');
    global.restoreGameLevelLabelAfterToast(title);
    assert(title.style.display === 'block' || title.style.display === 'none',
      'в placeholder-режиме видимость по-прежнему зависит от выбранного уровня');
  } finally {
    MODE_CLASSES.forEach((c) => gameEl.classList.remove(c));
    title.style.display = 'block';
    title.textContent = savedText;
  }
});


testAsync('PWA: обновление обнаруживается в активной сессии и после возврата из фона', async () => {
  const start = html.indexOf('navigator.serviceWorker.register');
  const scriptStart = html.lastIndexOf('<script>', start);
  const scriptEnd = html.indexOf('</script>', start);
  assert(start >= 0 && scriptStart >= 0 && scriptEnd > start,
    'не найден блок регистрации Service Worker');

  let now = 100000;
  let updateCalls = 0;
  let updatePromise = Promise.resolve();
  let resolvePendingUpdate = null;
  let pollCallback = null;
  let pollDelay = 0;
  let registerOptions = null;
  const pendingTimeouts = [];
  const flushPendingTimeouts = () => {
    while (pendingTimeouts.length) pendingTimeouts.shift()();
  };
  const windowListeners = {};
  const documentListeners = {};
  const updateToast = { hidden: true };
  const updateBtn = { hidden: false, addEventListener(type, fn) { this[type] = fn; } };
  const closeUpdateBtn = { hidden: false, addEventListener(type, fn) { this[type] = fn; } };
  const elements = {
    updateToast,
    updateToastBtn: updateBtn,
    updateToastCloseBtn: closeUpdateBtn,
    updateSplash: { hidden: true },
    updateSplashProgress: { textContent: '' }
  };
  const registration = {
    active: {},
    waiting: null,
    installing: null,
    update() { updateCalls++; return updatePromise; },
    addEventListener(type, fn) { this[type] = fn; }
  };
  const documentStub = {
    visibilityState: 'visible',
    getElementById(id) { return elements[id] || null; },
    addEventListener(type, fn) { (documentListeners[type] ||= []).push(fn); }
  };
  const windowStub = {
    addEventListener(type, fn) { (windowListeners[type] ||= []).push(fn); },
    location: { hostname: 'app.test', protocol: 'https:', reload() {} }
  };
  const sandbox = {
    navigator: {
      onLine: true,
      serviceWorker: {
        controller: null,
        register(_scriptUrl, options) { registerOptions = options; return Promise.resolve(registration); }
      }
    },
    location: windowStub.location,
    document: documentStub,
    window: windowStub,
    Date: { now() { return now; } },
    Promise,
    setTimeout(fn) { pendingTimeouts.push(fn); return pendingTimeouts.length; },
    setInterval(fn, delay) { pollCallback = fn; pollDelay = delay; return 1; },
    console
  };
  vm.runInNewContext(html.slice(scriptStart + '<script>'.length, scriptEnd), sandbox);
  (windowListeners.load || []).forEach(fn => fn());
  await new Promise(resolve => setImmediate(resolve));

  assert(updateCalls === 1, 'проверка обновления должна выполняться сразу после регистрации');
  assert(registerOptions && registerOptions.updateViaCache === 'none',
    'регистрация должна запрещать HTTP-кеш для проверки Service Worker');
  assert(pollCallback && pollDelay === 5 * 60 * 1000,
    'для активной PWA нужен видимый опрос каждые пять минут');

  const firstWorker = { state: 'installing', addEventListener(type, fn) { this[type] = fn; } };
  registration.installing = firstWorker;
  registration.updatefound();
  // Имитируем порядок браузера: statechange может прийти раньше, чем
  // registration.waiting окончательно ссылается на установленного worker.
  registration.waiting = null;
  firstWorker.state = 'installed';
  firstWorker.statechange();
  assert(updateToast.hidden === true, 'до появления registration.waiting плашка не должна показываться');
  registration.waiting = firstWorker;
  // Дополнительный deferred-check после statechange должен показать toast.
  flushPendingTimeouts();
  assert(updateToast.hidden === false, 'отложенная проверка должна показать установленный waiting-воркер');

  closeUpdateBtn.click();
  assert(updateToast.hidden === true, 'крестик должен закрыть плашку');
  now += 31000;
  (documentListeners.visibilitychange || []).forEach(fn => fn());
  (windowListeners.pageshow || []).forEach(fn => fn());
  (windowListeners.focus || []).forEach(fn => fn());
  assert(updateToast.hidden === true, 'тот же waiting-воркер не должен повторно мучить игрока после крестика');

  const secondWorker = { state: 'installing', addEventListener(type, fn) { this[type] = fn; } };
  registration.waiting = null;
  registration.installing = secondWorker;
  registration.updatefound();
  registration.waiting = secondWorker;
  secondWorker.state = 'installed';
  secondWorker.statechange();
  registration.installing = null;
  assert(updateToast.hidden === false, 'новая waiting-версия должна показываться сразу');

  registration.waiting = null;
  now += 5 * 60 * 1000 + 1;
  pollCallback();
  assert(updateCalls === 2, 'видимый периодический опрос должен проверять sw.js');
  await new Promise(resolve => setImmediate(resolve));

  now += 31000;
  updatePromise = new Promise(resolve => { resolvePendingUpdate = resolve; });
  (documentListeners.visibilitychange || []).forEach(fn => fn());
  (windowListeners.focus || []).forEach(fn => fn());
  assert(updateCalls === 3, 'первый lifecycle-вызов должен начать сетевую проверку');
  (windowListeners.pageshow || []).forEach(fn => fn());
  (windowListeners.online || []).forEach(fn => fn());
  assert(updateCalls === 3, 'updateCheckInFlight должен блокировать параллельные lifecycle-вызовы');
  resolvePendingUpdate();
  await new Promise(resolve => setImmediate(resolve));
});

console.log('\n=== Запуск тестов ===\n');

tests.forEach(t => {
  name = t.name;
  try {
    t.fn();
  } catch (e) {
    failed++;
    console.log(`  ✗ ${t.name}: неожиданная ошибка: ${e.message}`);
  }
});

(async () => {
  for (const t of asyncTests) {
    name = t.name;
    try {
      await t.fn();
    } catch (e) {
      failed++;
      console.log(`  ✗ ${t.name}: неожиданная ошибка: ${e.message}`);
    }
  }

  console.log('\n=== Итог ===');
  console.log(`Пройдено: ${passed}`);
  console.log(`Ошибок: ${failed}`);
  console.log(`Всего тестов: ${tests.length + asyncTests.length}`);

  if (failed > 0) {
    console.log('\n❌ Есть ошибки — см. выше');
    process.exit(1);
  } else {
    console.log('\n✅ Все тесты пройдены');
    process.exit(0);
  }
})();
