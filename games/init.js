// games/init.js — Код, который выполняется сразу при загрузке страницы (loadState() и начальная отрисовка экранов). Ссылается на функции всех игр — поэтому должен подключаться ПОСЛЕДНИМ, после games/core.js и всех остальных games/*.js.
// Загружается через <script src="games/init.js"></script> в index.html.

/* ============ ИНИЦИАЛИЗАЦИЯ ============ */
loadState();
// При полной перезагрузке страницы (не просто переходе между экранами внутри
// уже открытого приложения) экран "Продолжить игру" не нужен — каждое новое
// открытие приложения начинается с чистого меню, старая незавершённая партия
// автоматически считается закрытой.
if(state.inProgress){
  state.score1 = 0; state.score2 = 0;
  state.autoMilestone = 0;
  state.turnsPlayed = 0; state.turnsAtLastLevelUp = 0;
  state.levelTurnCounts = {1:0, 2:0}; state.pendingLevelUp = false;
  state.completedCount = 0; state.skippedCount = 0;
  state.inProgress = false;
  if(state.pausedMode === 'davay'){
    state.davayQuizActivePlayer = 0;
    state.davayQuizQueue = [];
    state.davayQuizIndex = 0;
    state.davayQuizAnswers = {};
    state.davayQuizP1Done = false;
    state.davayQuizP2Done = false;
    state.davayQuizPendingNext = 0;
  }
  state.pausedMode = null;
  saveState();
}
