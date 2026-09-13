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
