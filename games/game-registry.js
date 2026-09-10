// games/game-registry.js — единый реестр всех игр с паузой.
//
// ЗАЧЕМ ЭТО НУЖНО
// Раньше каждая игра с паузой была «размазана» по пяти местам в core.js:
//   • PAUSE_MAP          — какая функция ставит паузу (стрелка «←»)
//   • resumeBtn          — 26 веток «если pausedMode === X, вызови resumeX()»
//   • finishGameBtn      — 27 веток «если pausedMode === X, заверши игру»
//   • getPausedGroup     — к какой категории отнести паузу
//   • PAUSED_MODE_LABELS — человекочитаемое название для тостов
//
// Добавляя игру, нужно было не забыть все пять. Забытая ветка не выдавала
// ошибку — просто кнопка «Закончить игру» молча ничего не делала. Именно так
// сломались сразу четыре игры («Виселица», «Лимонадный ларёк», «Секс-квест»,
// «Карта страсти»): функции завершения были написаны, но не подключены.
//
// ТЕПЕРЬ: одна запись на игру. Всё остальное — вывод из неё.
//
//   mode      — значение state.pausedMode (ключ игры в состоянии)
//   title     — название для тостов и заголовка меню паузы
//   group     — раздел хаба: two | party | kids | solo | business
//               (куда вернуть игрока и какой список показать)
//   pause     — поставить паузу (для PAUSE_MAP, по id экрана)
//   resume    — продолжить сохранённую партию
//   finish    — завершить партию (кнопка «Закончить игру»)
//   screens   — id экранов игры: по ним ищется pause-функция и определяется,
//               в какой группе открывать «Продолжить игру»
//   exitSummary — функция «итогов перед выходом»: показывается, если партия
//               уже начата (есть счёт). Если партия пустая, вызывается finish.
//               Так «Крокодил» не гоняет игрока через окно итогов с нулями.
//   isEmpty   — функция «партия пустая?» для игр с exitSummary
//   finishEmpty — что вызвать, если партия пустая (обычно простой выход)
//   noPause   — true, если у игры нет паузы: выход ведёт прямо в меню
//   inlineFinish — завершение обрабатывается в core.js отдельным кодом
//               (а не вызовом функции игры): у «Фантов» это общее окно итогов,
//               у «Давай попробуем» — сброс состояния партии
//
// Функции указываются ИМЕНЕМ (строкой), а не ссылкой: реестр загружается
// раньше модулей игр (он идёт сразу после core.js-подобных деклараций), и на
// момент его создания функций ещё нет. Вызов идёт через callGame() ниже.
//
// Проверка соответствия реестра коду — в tools/check.js (группа «Реестр игр»).

window.GAME_REGISTRY = [
  // ─── Игры для пар 18+ ───────────────────────────────────────────────────
  {
    // Базовая парная игра: завершение идёт через общее окно итогов
    // (showSummary), поэтому отдельной функции finish нет.
    mode: 'fanty', title: '«Фанты»', group: 'two', inlineFinish: true, menuTitle: '💘 Фанты',
    pause: 'pauseGame', resume: 'resumeFantyGame',
    screens: ['game'],
  },
  {
    // Завершение реализовано инлайн в core.js (сброс davay-состояния),
    // отдельной функции finish нет — inlineFinish помечает такие игры.
    mode: 'davay', title: '«Давай попробуем»', group: 'two', inlineFinish: true, menuTitle: '🎬 Давай попробуем',
    pause: 'pauseDavayGame', resume: 'resumeDavayGame',
    screens: ['davayGame', 'davayQuiz'],
  },
  {
    mode: 'td', title: '«Правда/Действие»', group: 'two', menuTitle: '❓ Правда/Действие',
    pause: 'pauseTdGame', resume: 'resumeTdGame', finish: 'finishTdGame',
    exitSummary: 'showTdSummary', isEmpty: () => !state.tdScore1 && !state.tdScore2,
    screens: ['tdGame'],
  },
  {
    mode: 'bingo', title: '«Ваше бинго»', group: 'two', menuTitle: '🎱 Ваше бинго',
    pause: 'pauseBingoGame', resume: 'resumeBingoGame', finish: 'finishBingoGame',
    exitSummary: 'showBingoExitSummary',
    isEmpty: () => !(state.bingoChecked || []).some(Boolean),
    screens: ['bingoGame'],
  },
  {
    mode: 'krokodil', title: '«Крокодил»', group: 'two', menuTitle: '🐊 Крокодил',
    pause: 'pauseKrokodilGame', resume: 'resumeKrokodilGame', finish: 'finishKrokodilGame',
    exitSummary: 'showKrokodilExitSummary',
    isEmpty: () => (state.krokodilScores || []).reduce((a, b) => a + (b || 0), 0) === 0,
    screens: ['krokodilGame'],
  },
  {
    mode: 'wishlist', title: '«Твои желания»', group: 'two', menuTitle: '💌 Твои желания',
    pause: 'pauseWishlistGame', resume: 'resumeWishlistGame', finish: 'finishWishlistGame',
    screens: ['wishlistGame'],
  },
  {
    mode: 'znayu', title: '«Тайные ответы»', group: 'two', menuTitle: '💑 Тайные ответы',
    pause: 'pauseZnayuGame', resume: 'resumeZnayuGame', finish: 'finishZnayuGame',
    screens: ['znayuGame'],
  },
  {
    mode: 'timer', title: '«Таймер страсти»', group: 'two', menuTitle: '⏱️ Таймер страсти',
    pause: 'pauseTimerGame', resume: 'resumeTimerGame', finish: 'exitTimerGame',
    exitSummary: 'showTimerSummary',
    isEmpty: () => !state.timerScore1 && !state.timerScore2,
    screens: ['timerGame'],
  },
  {
    mode: 'quiz', title: '«Викторина»', group: 'two', menuTitle: '🎯 Викторина',
    pause: 'pauseQuizGame', resume: 'resumeQuizGame', finish: 'finishQuizGame',
    screens: ['quizGame'],
  },
  {
    // Паузы нет: по решению владельца ✕ завершает партию и ведёт в настройку.
    mode: 'wishRoulette', title: '«Рулетка желаний»', group: 'two', noPause: true, menuTitle: '🎡 Рулетка желаний',
    resume: 'resumeWrGame', finish: 'finishWrGame',
    screens: ['wrGame'],
  },
  // Паузы нет: выход ведёт сразу в меню настройки игры.
  {
    mode: 'sexQuest', title: '«Секс-квест»', group: 'two', noPause: true, menuTitle: '💘 Секс-квест',
    resume: 'resumeSexQuestGame', finish: 'finishPausedSexQuestGame',
    screens: ['sexQuestGame'],
  },
  {
    mode: 'passionMap', title: '«Карта страсти»', group: 'two', noPause: true, menuTitle: '🎀 Карта страсти',
    resume: 'resumePassionMapGame', finish: 'finishPausedPassionMapGame',
    screens: ['passionMapGame'],
  },

  // ─── Игры для компании ──────────────────────────────────────────────────
  {
    mode: 'partyFants', title: '«Фанты»', group: 'party', menuTitle: '🎉 Фанты',
    pause: 'pausePartyFantsGame', resume: 'resumePartyFantsGame', finish: 'finishPartyFantsGame',
    finishEmpty: 'exitPartyFantsGame',
    isEmpty: () => (state.partyFantsCompleted || []).reduce((a, b) => a + (b || 0), 0) === 0,
    screens: ['partyFantsGame'],
  },
  {
    mode: 'partyTd', title: '«Правда/Действие»', group: 'party', menuTitle: '🗣️ Правда/Действие',
    pause: 'pausePartyTdGame', resume: 'resumePartyTdGame', finish: 'finishPartyTdGame',
    finishEmpty: 'exitPartyTdGame',
    isEmpty: () => (state.partyTdCompleted || []).reduce((a, b) => a + (b || 0), 0) === 0,
    screens: ['partyTdGame'],
  },
  {
    mode: 'partyQuiz', title: '«Викторина»', group: 'party', menuTitle: '🎯 Викторина',
    pause: 'pausePartyQuizGame', resume: 'resumePartyQuizGame', finish: 'finishPartyQuizGame',
    screens: ['partyQuizGame'],
  },
  {
    mode: 'famZnayu', title: '«Знаю тебя»', group: 'party', menuTitle: '🧠 Знаю тебя',
    pause: 'pauseFamZnayuGame', resume: 'resumeFamZnayuGame', finish: 'finishFamZnayuGame',
    screens: ['famZnayuGame'],
  },
  {
    mode: 'lucky', title: '«Счастливый билет»', group: 'party', menuTitle: '🎫 Счастливый билет',
    pause: 'pauseLuckyGame', resume: 'resumeLuckyGame', finish: 'finishLuckyGame',
    screens: ['luckyGame'],
  },
  {
    mode: 'partyRoulette', title: '«Рулетка»', group: 'party', menuTitle: '🎰 Рулетка',
    pause: 'pauseGamePartyRoulette', resume: 'resumePartyRouletteGame', finish: 'finishPartyRouletteGame',
    screens: ['partyRouletteGame'],
  },
  // Паузы нет: партия короткая, сохраняется только общий счёт.
  {
    mode: 'partyHangman', title: '«Виселица»', group: 'party', noPause: true, menuTitle: '🪢 Виселица',
    resume: 'resumePartyHangmanGame', finish: 'finishPartyHangmanGame',
    screens: ['partyHangmanGame'],
  },

  // ─── Игры с детьми ──────────────────────────────────────────────────────
  {
    mode: 'kidsMemory', title: '«Мемори»', group: 'kids', menuTitle: '🧠 Мемори',
    pause: 'pauseKidsMemoryGame', resume: 'resumeKidsMemoryGame', finish: 'finishKidsMemoryGame',
    screens: ['kidsMemoryGame'],
  },
  {
    mode: 'kidsTd', title: '«Правда/Действие»', group: 'kids', menuTitle: '🗣️ Правда/Действие',
    pause: 'pauseKidsTdGame', resume: 'resumeKidsTdGame', finish: 'finishKidsTdGame',
    screens: ['kidsTdGame'],
  },
  {
    mode: 'kidsQuiz', title: '«Викторина»', group: 'kids', menuTitle: '🎯 Викторина',
    pause: 'pauseKidsQuizGame', resume: 'resumeKidsQuizGame', finish: 'finishKidsQuizGame',
    screens: ['kidsQuizGame'],
  },
  {
    mode: 'kidsC4', title: '«Четыре в ряд»', group: 'kids',
    pause: 'pauseKidsC4Game', resume: 'resumeKidsC4Game', finish: 'finishKidsC4Game',
    screens: ['kidsC4Game'],
  },
  {
    mode: 'kidsSaper', title: '«Сапёр»', group: 'kids',
    pause: 'pauseKidsSaperGame', resume: 'resumeKidsSaperGame', finish: 'finishKidsSaperGame',
    screens: ['kidsSaperGame'],
  },

  // ─── Игры для одного ────────────────────────────────────────────────────
  {
    mode: 'soloQuiz', title: '«Викторина»', group: 'solo', menuTitle: '🎯 Викторина',
    pause: 'pauseSoloQuizGame', resume: 'resumeSoloQuizGame', finish: 'finishSoloQuizGame',
    screens: ['soloQuizGame'],
  },
  {
    mode: 'soloBs', title: '«Морской бой»', group: 'solo', menuTitle: '🚢 Морской бой (бот)',
    pause: 'pauseSoloBattleshipGame', resume: 'resumeSoloBsGame', finish: 'finishSoloBsGame',
    screens: ['soloBsGame', 'soloBattleshipGame'],
  },
  {
    mode: 'soloC4', title: '«Четыре в ряд»', group: 'solo',
    pause: 'pauseSoloC4Game', resume: 'resumeSoloC4Game', finish: 'finishSoloC4Game',
    screens: ['soloC4Game'],
  },

  // ─── Бизнес игры ────────────────────────────────────────────────────────
  {
    mode: 'shop', title: '«Магазин»', group: 'business', menuTitle: '🛍️ Магазин',
    pause: 'pauseShopGame', resume: 'resumeShopGame', finish: 'finishShopGame',
    screens: ['shopGame'],
  },
  {
    mode: 'businessLemonade', title: '«Лимонадный ларёк»', group: 'business', noPause: true, menuTitle: '🍋 Лимонадный ларёк',
    resume: 'resumeBusinessLemonadeGame', finish: 'finishBusinessLemonadeGame',
    screens: ['businessLemonadeGame'],
  },
];

/* ============ ХЕЛПЕРЫ ============ */

/** Ищет запись игры по значению state.pausedMode. */
function gameByMode(mode){
  if(!mode) return null;
  return (window.GAME_REGISTRY || []).find(g => g.mode === mode) || null;
}

/** Ищет запись игры по id активного экрана (для PAUSE_MAP). */
function gameByScreen(screenId){
  if(!screenId) return null;
  return (window.GAME_REGISTRY || []).find(g => (g.screens || []).includes(screenId)) || null;
}

/**
 * Вызывает функцию игры по имени, если она существует.
 * Безопасно: модуль игры может быть не подключён, а реестр уже прочитан.
 * @returns {boolean} true, если функция найдена и вызвана
 */
function callGame(fnName, ...args){
  if(!fnName) return false;
  const fn = window[fnName];
  if(typeof fn !== 'function') return false;
  fn(...args);
  return true;
}


/** Заголовок для окна паузы (с эмодзи). Фолбэк — короткое название игры. */
function gameMenuTitle(mode){
  const g = gameByMode(mode);
  if(!g) return null;
  return g.menuTitle || g.title.replace(/[«»]/g, '');
}

/** Человекочитаемое название игры для тостов («Сначала завершите …»). */
function gameTitle(mode){
  const g = gameByMode(mode);
  return g ? g.title : 'игру';
}
