// games/init.js — Код, который выполняется сразу при загрузке страницы (loadState() и начальная отрисовка экранов). Ссылается на функции всех игр — поэтому должен подключаться ПОСЛЕДНИМ, после games/core.js и всех остальных games/*.js.
// Загружается через <script src="games/init.js"></script> в index.html.

/* ============ ИНИЦИАЛИЗАЦИЯ ============ */
loadState();
// Миграция пишет state: запускать только после восстановления сохранения.
migrateVideoDbIntoDavay();
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
  // Сапёр (дети) — не допускаем продолжения половины партии после перезаписи
  // страницы: всё заново.
  state.kidsSaperGrid = []; state.kidsSaperChecked = []; state.kidsSaperFlags = [];
  state.kidsSaperWonLines = [];
  state.kidsSaperCurrentLevel = 1;
  state.kidsSaperEscalatedTo2 = false; state.kidsSaperEscalatedTo3 = false;
  state.kidsSaperFinished = false; state.kidsSaperBonusChecklist = [];
  state.kidsSaperTasksHidden = true;
  state.pausedMode = null;
  saveState();
}

/* ============ СООБЩЕНИЕ ПОСЛЕ ОБНОВЛЕНИЯ ПРИЛОЖЕНИЯ ============
   Жёсткое обновление (hardUpdateApp) кладёт в sessionStorage флаг
   appJustUpdated и перезагружает страницу. Запускается оно кнопкой
   «Обновить» на плашке #updateToast (и запасной #updateAppBtn); пункт
   «Обновить приложение» из меню «☰» убран как дублирующий. Показываем
   подтверждение здесь, в последнем загружаемом скрипте: к этому моменту
   доступны и showToast, и тост #toast в разметке. Раньше проверка жила в
   games/znayu.js — это была случайная привязка к «Тайным ответам»: стоило
   поменять порядок скриптов, и сообщение молча пропадало.

   Флаг именно в sessionStorage, а не в localStorage: он должен пережить
   только перезагрузку и не всплывать при следующих запусках приложения.
   Чистим сразу, чтобы тост не повторился при обновлении страницы вручную. */
try{
  if(sessionStorage.getItem('appJustUpdated')){
    sessionStorage.removeItem('appJustUpdated');
    // Приложение полностью загрузилось — экран обновления больше не нужен
    // (страховочный таймер в index.html мог бы спрятать его и сам, но зачем
    // заставлять игрока ждать).
    const sp = document.getElementById('updateSplash');
    if(sp) sp.hidden = true;
    setTimeout(()=>showToast('Обновлено до последней версии'), 400);
  }
}catch(e){}

/* Убираем служебный параметр _r=… из адресной строки.
   Кнопка обновления добавляет его к URL, чтобы гарантированно обойти кэш
   навигации: по уникальному адресу браузер обязан сходить в сеть. Сам
   параметр при этом остаётся в истории и в адресной строки браузера, а в
   установленной PWA ещё и запоминается как адрес запуска. Возвращаем
   «чистый» адрес через replaceState: запись в истории не создаётся, а
   обновление уже применено. */
try{
  const cleanUrl = new URL(location.href);
  if(cleanUrl.searchParams.has('_r')){
    cleanUrl.searchParams.delete('_r');
    history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
  }
}catch(e){}

/* ============ СТАТИСТИКА: ОТМЕТКА ОТКРЫТИЯ ============
   Считаем уникальные дни использования. Вызов здесь, в последнем скрипте:
   к этому моменту модуль статистики уже загружен, а приложение готово
   к работе. Сбой записи не должен мешать запуску. */
try{
  if(window.AppStats) window.AppStats.markOpen();
}catch(e){}

// ===== Подсказки (data-tooltip) — делегирование =====
(function(){
  var tooltip = null;
  var currentTarget = null;
  function getTooltip(){
    if(!tooltip){
      tooltip = document.createElement('div');
      tooltip.setAttribute('data-tooltip-tip', '');
      tooltip.style.cssText = 'position:fixed;display:none;background:rgba(80,30,80,.92);color:#fff;padding:4px 10px;border-radius:8px;font-size:13px;line-height:1.4;white-space:normal;z-index:9999;pointer-events:none;border:1px solid rgba(255,94,142,.4);max-width:70vw;text-align:center;word-wrap:break-word;';
      document.body.appendChild(tooltip);
    }
    return tooltip;
  }
  function positionTooltip(t){
    var text = t.getAttribute('data-tooltip');
    if(!text) return false;
    var tip = getTooltip();
    tip.textContent = text;
    tip.style.display = 'block';
    var tr = tip.getBoundingClientRect();
    var tw = tr.width || 80;
    var th = tr.height || 20;
    var rr = t.getBoundingClientRect();
    var left = rr.left + rr.width/2 - tw/2;
    if(left < 8) left = 8;
    if(left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
    var top = rr.top + rr.height + 8;
    if(top + th > window.innerHeight - 8) top = rr.top - th - 8;
    tip.style.left = left + 'px';
    tip.style.top = Math.max(8, top) + 'px';
    currentTarget = t;
    return true;
  }
  function hideTooltip(){
    var tip = document.querySelector('[data-tooltip-tip]');
    if(tip) tip.style.display = 'none';
    currentTarget = null;
  }
  document.addEventListener('mousemove', function(e){
    var t = e.target;
    while(t && t !== document.body){
      if(t.hasAttribute('data-tooltip')){
        if(currentTarget !== t) positionTooltip(t);
        return;
      }
      t = t.parentElement;
    }
    if(currentTarget) hideTooltip();
  });
  document.addEventListener('mouseout', function(e){
    var t = e.target;
    while(t && t !== document.body){
      if(t.hasAttribute('data-tooltip')){
        hideTooltip();
        break;
      }
      t = t.parentElement;
    }
  });
  document.addEventListener('touchstart', function(){
    if(currentTarget) hideTooltip();
  }, {passive: true});
})();
