// games/init.js — Код, который выполняется сразу при загрузке страницы (loadState() и начальная отрисовка экранов). Ссылается на функции всех игр — поэтому должен подключаться ПОСЛЕДНИМ, после games/core.js и всех остальных games/*.js.
// Загружается через <script src="games/init.js"></script> в index.html.

/* ============ ИНИЦИАЛИЗАЦИЯ ============ */
loadState();
// Списки игроков (дети / компания / бизнес) отрисовываются на этапе загрузки
// скриптов — ДО loadState(), поэтому первичная отрисовка видит только значения
// по умолчанию. После восстановления сохранённых имён из localStorage
// перерисовываем их заново: иначе после перезагрузки/«Обновить игру» поля ввода
// показывают «Игрок 1/2», хотя в state настоящие имена — и пользователь думает,
// что имена сброшены (а они просто не отображаются).
if(typeof renderKidsPlayers === 'function') renderKidsPlayers();
if(typeof renderBusinessPlayers === 'function') renderBusinessPlayers();
if(typeof renderPartyPlayers === 'function') renderPartyPlayers();
// Кнопки "Выход" по всему приложению — красная обводка (см. .btn-exit в
// index.html). Помечаем по тексту кнопки один раз при загрузке, а не
// прописываем класс в каждом месте вручную — так не пропустим ни одну
// текущую или будущую кнопку "Выход".
document.querySelectorAll('button').forEach(btn=>{
  if(btn.textContent.trim() === 'Выход') btn.classList.add('btn-exit');
});
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
  // Морской бой (одиночка) — не допускаем продолжения половины партии после
  // перезаписи страницы: всё заново.
  state.soloBsPlayerBoard = []; state.soloBsBotBoard = []; state.soloBsWinner = null;
  state.soloBsCurrentPlayer = 'player';
  state.pausedMode = null;
  saveState();
}
