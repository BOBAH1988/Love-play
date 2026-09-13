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

console.log('\n=== Проверка наличия критических DOM-элементов ===');

const criticalElements = [
  'setup', 'homeView', 'resumeBtn', 'finishGameBtn', 'globalBackBtn',
  'twoPlayerView', 'companyView', 'kidsView', 'businessView', 'soloView', 'learningView',
];

criticalElements.forEach(id => {
  test(`DOM-элемент #${id} существует`, () => {
    const el = getElById(stub, id);
    assert(el !== null, `элемент #${id} не найден в DOM`);
  });
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

test('Сценарий: в видеорежиме #game заголовок по-прежнему скрыт', () => {
  // Видеорулетка и «Давай попробуем» используют #game, но название игры там
  // не показывается — регресс в этих режимах недопустим.
  const gameEl = getElById(stub, 'game');
  const title = getElById(stub, 'gameLevelLabel');
  const turn = getElById(stub, 'gameTurnLabel');

  asFantyScreen();
  gameEl.classList.add('video-mode');
  state.name1 = 'Парень';
  global.updateTurnUI();
  global.updateLevelUI();
  assert(turn.style.display !== 'none', 'в видеорежиме метка хода должна быть видна');
  assert(turn.textContent.startsWith('Ходит:'), `ожидалась метка хода, получено «${turn.textContent}»`);
  assert(title.style.display === 'none', 'в видеорежиме заголовок игры должен быть скрыт');
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

  // Выходим из «Фантов» в режим «Давай попробуем» (свой заголовок не ставит).
  MODE_CLASSES.forEach((c) => gameEl.classList.remove(c));
  gameEl.classList.add('davay-mode');
  state.name1 = 'Парень';
  state.currentPlayer = 1;
  global.updateTurnUI();
  global.updateLevelUI();
  assert(turn.style.display !== 'none', 'метка хода должна снова показываться');
  assert(turn.textContent === 'Ходит: Парень', `ожидалось «Ходит: Парень», получено «${turn.textContent}»`);
  assert(title.style.display === 'none', 'заголовок снова скрыт — его роль вернулась к уровню');
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

console.log('\n=== Итог ===');
console.log(`Пройдено: ${passed}`);
console.log(`Ошибок: ${failed}`);
console.log(`Всего тестов: ${tests.length}`);

if (failed > 0) {
  console.log('\n❌ Есть ошибки — см. выше');
  process.exit(1);
} else {
  console.log('\n✅ Все тесты пройдены');
  process.exit(0);
}
