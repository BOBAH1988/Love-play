// fants-timer.js — вынесено из games/core.js при разделении монолита.
//
// Зачем: core.js вырос до 6700 строк, и чтение его целиком для правки одной
// функции стоило 100+ тыс. токенов контекста. Теперь каждая тема — отдельный
// файл, и правка читает 700–1700 строк вместо 6700.
//
// Порядок подключения сохранён как в исходном core.js: функции объявляются
// в глобальной области и вызывают друг друга по имени, поэтому файлы должны
// грузиться после core.js и до init.js.

/* ============ ТАЙМЕР ЗАДАНИЯ ============ */
let timerInterval = null;
let timerDuration = 60; // по умолчанию 1 минута
let timerSeconds = timerDuration;

function formatTime(s){
  const m = Math.floor(s/60);
  const sec = s%60;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function resetTimer(){
  clearInterval(timerInterval);
  timerInterval = null;
  timerSeconds = timerDuration;
  const disp = document.getElementById('timerDisplay');
  const btn = document.getElementById('timerBtn');
  if(disp) disp.textContent = formatTime(timerSeconds);
  if(btn){ btn.textContent = '▶ Старт'; btn.classList.remove('running'); }
}

function selectTimerDuration(sec, btnEl){
  timerDuration = sec;
  document.querySelectorAll('.timer-dur-btn').forEach(b=>b.classList.toggle('on', b===btnEl));
  resetTimer();
}

function toggleTimer(){
  const btn = document.getElementById('timerBtn');
  const disp = document.getElementById('timerDisplay');
  if(timerInterval){
    clearInterval(timerInterval);
    timerInterval = null;
    btn.textContent = '▶ Продолжить';
    btn.classList.remove('running');
    return;
  }
  btn.textContent = '⏸ Пауза';
  btn.classList.add('running');
  timerInterval = setInterval(()=>{
    timerSeconds--;
    if(disp) disp.textContent = formatTime(timerSeconds);
    if(timerSeconds<=0){
      clearInterval(timerInterval);
      timerInterval = null;
      showToast('Время вышло! ⏰');
      playTimerAlarm();
      const cardEl = document.getElementById('card');
      if(disp){
        disp.classList.add('done');
        setTimeout(()=>disp.classList.remove('done'), 2000);
      }
      if(cardEl){
        cardEl.classList.add('done-shake');
        setTimeout(()=>cardEl.classList.remove('done-shake'), 400);
      }
      timerSeconds = timerDuration;
      if(disp) disp.textContent = formatTime(timerSeconds);
      if(btn){ btn.textContent = '▶ Старт'; btn.classList.remove('running'); }
    }
  }, 1000);
}

function drawCard(forceLevel){
  let card = drawFromPool(forceLevel);
  if(!card && forceLevel){
    card = drawFromPool(); // если у нового уровня карточек нет — берём из общего пула
  }
  if(!card){
    renderNoCards();
    showToast('Выберите хотя бы один уровень в настройках');
    return;
  }
  state.usedIndexes.push(card.idx);
  saveState();
  renderCard(card);
}

function renderTdChoiceCard(){
  const turnName = state.currentPlayer===1 ? state.name1 : state.name2;
  const genderColor = GENDER_COLORS[currentGender()];
  currentCard = null;
  const el = document.getElementById('card');
  el.className = 'card';
  el.style.borderTop = '10px solid ' + genderColor;
  el.innerHTML = `
      <div class="card-inner">
        <div class="card-header">
          <div class="card-turn">
            <div class="card-turn-label">Ход игрока</div>
            <div class="card-turn-name">${turnName}</div>
          </div>
        </div>
        <div class="card-type-row">
          <span class="card-level-progress" id="cardLevelProgress"></span>
          <span class="type-pill" style="visibility:hidden;">&nbsp;</span>
        </div>
        <div class="card-body" id="cardBody">
          <div class="card-text" id="cardText">Выберите<br>правда или действие</div>
        </div>
        <div class="td-choice-row" id="tdChoiceRow" style="display:none; margin-top:8px;">
          <button type="button" class="td-choice-btn" data-type="truth">Правда</button>
          <button type="button" class="td-choice-btn" data-type="dare">Действие</button>
        </div>
        <div class="card-timer">
          <div class="timer-durations">
            <button type="button" class="timer-dur-btn ${timerDuration===30 ? 'on' : ''}" data-sec="30">30 сек</button>
            <button type="button" class="timer-dur-btn ${timerDuration===60 ? 'on' : ''}" data-sec="60">1 мин</button>
            <button type="button" class="timer-dur-btn ${timerDuration===120 ? 'on' : ''}" data-sec="120">2 мин</button>
          </div>
          <div class="timer-controls">
            <div class="timer-display" id="timerDisplay">${formatTime(timerDuration)}</div>
            <button type="button" class="timer-btn" id="timerBtn">▶ Старт</button>
            <button type="button" class="timer-btn card-fav-btn" id="cardFavoriteBtn" data-tt="Добавить в избранное" aria-label="Добавить в избранное">☆</button>
            <button type="button" class="card-hot-btn" id="cardLevelUpBtn" data-tt="Сделать задание горячее" aria-label="Сделать задание горячее">🔥</button>
          </div>
        </div>
      </div>
    `;
  document.getElementById('timerBtn').addEventListener('click', toggleTimer);
  document.getElementById('cardFavoriteBtn').addEventListener('click', toggleFavorite);
  document.getElementById('cardLevelUpBtn').addEventListener('click', ()=> levelUp());
  document.querySelectorAll('.timer-dur-btn').forEach(b=>{
    b.addEventListener('click', ()=>selectTimerDuration(parseInt(b.dataset.sec,10), b));
  });
  const tdRow = document.getElementById('tdChoiceRow');
  tdRow.style.display = 'flex';
  tdRow.querySelectorAll('.td-choice-btn').forEach(b=>{
    b.addEventListener('click', ()=>{
      tdRow.style.display = 'none';
      drawCardWithType(b.dataset.type);
    });
  });
}

function drawCardWithType(type){
  const all = getAllCards();
  const gender = currentGender();
  const scope = scopeIndexes().filter(i=>!state.hiddenIndexes.includes(i));
  let pool = scope
    .map(i=>({...all[i], idx:i}))
    .filter(c => !c.for || c.for===gender)
    .filter(c => !state.usedIndexes.includes(c.idx))
    .filter(c => c.type === type);
  if(pool.length===0){
    const scopeSet = new Set(scope);
    state.usedIndexes = state.usedIndexes.filter(i=>!scopeSet.has(i));
    pool = scope
      .map(i=>({...all[i], idx:i}))
      .filter(c => !c.for || c.for===gender)
      .filter(c => c.type === type);
    if(pool.length>0) showToast('Колода перемешана заново 🔀');
  }
  if(pool.length===0){
    showToast('Нет карточек этого типа — выберите другой');
    return;
  }
  const card = pool[Math.floor(Math.random()*pool.length)];
  state.usedIndexes.push(card.idx);
  saveState();
  renderCard(card);
}

function dislikeCurrentCard(){
  if(!currentCard) return;
  playErrorSound();
  if(!state.hiddenIndexes.includes(currentCard.idx)){
    state.hiddenIndexes.push(currentCard.idx);
  }
  saveState();
  showToast('Карточка скрыта навсегда 🚫');
  drawCard();
}

const GENDER_COLORS = { M:'#6ec6ff', F:'#ff9fb0' };

let currentCard = null;

function renderCard(card){
  const lvl = levelById(card.level);
  const turnName = state.currentPlayer===1 ? state.name1 : state.name2;
  const genderColor = GENDER_COLORS[currentGender()];
  currentCard = card;
  fadeSwapCard((el)=>{
    el.className = 'card';
    el.style.borderTop = `10px solid ${genderColor}`;
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-header">
          <div class="card-turn">
            <div class="card-turn-label">Ход игрока</div>
            <div class="card-turn-name">${turnName}</div>
          </div>
          <div class="badge">
            <span class="level-pill" style="background:${lvl.color}">${lvl.icon} ${lvl.name}</span>
          </div>
        </div>
        <div class="card-type-row">
          <span class="card-level-progress" id="cardLevelProgress"></span>
          <span class="type-pill">${card.type==='truth' ? 'Правда' : 'Действие'}</span>
        </div>
        <div class="card-body" id="cardBody">
          <div class="card-text" id="cardText"></div>
        </div>
        <div class="card-timer">
          <div class="timer-durations">
            <button type="button" class="timer-dur-btn ${timerDuration===30 ? 'on' : ''}" data-sec="30">30 сек</button>
            <button type="button" class="timer-dur-btn ${timerDuration===60 ? 'on' : ''}" data-sec="60">1 мин</button>
            <button type="button" class="timer-dur-btn ${timerDuration===120 ? 'on' : ''}" data-sec="120">2 мин</button>
          </div>
          <div class="timer-controls">
            <div class="timer-display" id="timerDisplay">${formatTime(timerDuration)}</div>
            <button type="button" class="timer-btn" id="timerBtn">▶ Старт</button>
            <button type="button" class="timer-btn card-fav-btn" id="cardFavoriteBtn" data-tt="Добавить в избранное" aria-label="Добавить в избранное">☆</button>
            <button type="button" class="card-hot-btn" id="cardLevelUpBtn" data-tt="Сделать задание горячее" aria-label="Сделать задание горячее">🔥</button>
          </div>
        </div>
      </div>
    `;
    resetTimer();
    updateLevelProgressUI();
    document.getElementById('timerBtn').addEventListener('click', toggleTimer);
    document.getElementById('cardFavoriteBtn').addEventListener('click', toggleFavorite);
    document.getElementById('cardLevelUpBtn').addEventListener('click', ()=>{
      if(isPlaceholderMode()){
        playLevelUpSound();
        drawPhotoCard(photoLevel < PHOTO_MAX_LEVEL ? photoLevel + 1 : 1);
        return;
      }
      levelUp();
    });
    document.querySelectorAll('.timer-dur-btn').forEach(b=>{
      b.addEventListener('click', ()=>selectTimerDuration(parseInt(b.dataset.sec,10), b));
    });
    /* Режим «Правда/Действие» — кнопки выбора показываем ТОЛКО когда карта
       не вытянута (currentCard===null). После выбора типа drawCardWithType()
       рисует карту → renderCard вызывается с currentCard!==null → показываем текст. */
    const tdRow = document.getElementById('tdChoiceRow');
    const typeRow = el.querySelector('.card-type-row');
    const cardBody = document.getElementById('cardBody');
    if(state.gameType === 'td' && !currentCard){
      tdRow.style.display = 'flex';
      typeRow.style.display = 'none';
      cardBody.style.display = 'none';
      tdRow.querySelectorAll('.td-choice-btn').forEach(b=>{
        b.addEventListener('click', ()=>{
          tdRow.style.display = 'none';
          drawCardWithType(b.dataset.type);
        });
      });
    } else {
      tdRow.style.display = 'none';
      typeRow.style.display = '';
      cardBody.style.display = '';
    }
    fitTextToContainer(
      document.getElementById('cardBody'),
      document.getElementById('cardText'),
      card.text
    );
  });
  updateFavoriteBtn();
}

function nextTurn(completed){
  if(completed){
    if(state.currentPlayer===1) state.score1++; else state.score2++;
    state.completedCount = (state.completedCount||0) + 1;
  } else {
    state.skippedCount = (state.skippedCount||0) + 1;
  }
  state.turnsPlayed = (state.turnsPlayed||0) + 1;
  if(!state.levelTurnCounts) state.levelTurnCounts = {1:0, 2:0};
  state.levelTurnCounts[state.currentPlayer] = (state.levelTurnCounts[state.currentPlayer]||0) + 1;
  checkAutoLevelUp();
  state.currentPlayer = state.currentPlayer===1 ? 2 : 1;
  // Если повышение уровня было отложено — как только оба партнёра сыграли
  // поровну карточек текущего уровня, применяем его прямо сейчас.
  if(state.pendingLevelUp && (state.levelTurnCounts[1]||0) === (state.levelTurnCounts[2]||0) && (state.levelTurnCounts[1]||0) >= 1){
    advanceLevel();
  }
  saveState();
  updateTurnUI();
  if(state.gameType === 'td'){
    renderTdChoiceCard();
  } else {
    drawCard();
  }
}

document.getElementById('doneBtn').addEventListener('click', ()=>{
  if(cardTransitionLocked) return;
  playSuccessSound();
  if(isPlaceholderMode()){
    drawPhotoCard(photoLevel || 1);
    return;
  }
  if(isVideoMode()){
    drawVideoCard(videoLevel || 1, true);
    return;
  }
  if(isDavayMode()){
    drawDavayCard(davayLevel || 1);
    return;
  }
  nextTurn(true);
});
document.getElementById('skipBtn').addEventListener('click', ()=>{
  if(cardTransitionLocked) return;
  playFailSound();
  nextTurn(false);
});
document.getElementById('pauseBtn').addEventListener('click', ()=>{
  if(isPlaceholderMode()){
    exitPlaceholderGame();
    return;
  }
  if(isVideoMode()){
    exitVideoGame();
    return;
  }
  if(isDavayMode()){
    // Просмотр избранного — не настоящая партия, поэтому кнопка здесь
    // подписана "Выход" и должна полностью выходить, а не ставить на паузу.
    if(state.davayFavoritesOnly){
      exitDavayGame(true);
      return;
    }
    pauseDavayGame();
    return;
  }
  pauseGame();
  showToast('Игра на паузе — прогресс сохранён');
});
document.getElementById('finishGameBtn').addEventListener('click', ()=>{
  // Завершение партии: логика берётся из реестра игр (games/game-registry.js).
  // Раньше здесь было 27 почти одинаковых веток «если pausedMode === X…» —
  // именно из-за забытой ветки кнопка «Закончить игру» молча не работала
  // у четырёх игр (Виселица, Лимонадный ларёк, Секс-квест, Карта страсти).
  const mode = state.pausedMode;
  const game = gameByMode(mode);

  // «Фанты» — базовая парная игра: завершение идёт через общее окно итогов.
  if(!game || mode === 'fanty'){
    if((state.score1||0) === 0 && (state.score2||0) === 0){ goToSetup(); return; }
    showSummary();
    return;
  }

  // «Давай попробуем» — завершение без сводки: снимаем паузу и выходим.
  // Выходим ИМЕННО в настройку этой игры (exitDavayGame(true) → #davaySetup),
  // а не в общий хаб: раньше здесь стоял abandonPausedSession('davay'), который
  // только снимал паузу и НЕ трогал экраны — игрок после «Закончить игру»
  // оказывался в меню «Игры для двоих» и должен был заново искать игру в
  // списке. Это и был «шаг назад» вместо ожидаемого шага в настройки.
  if(mode === 'davay'){
    if(typeof exitDavayGame === 'function'){ exitDavayGame(true); return; }
    // Запасной путь, если по какой-то причине функция недоступна: снимаем
    // оба связанных флага вместе (правило из AGENTS.md) и идём в настройки.
    state.inProgress = false;
    abandonPausedSession('davay');
    saveState();
    updateResumeUI();
    goToDavaySetup();
    return;
  }

  // Игры с окном итогов: показываем его только если партия не пустая,
  // иначе сразу выходим (иначе игрок увидит сводку из нулей).
  if(game.exitSummary && !(game.isEmpty && game.isEmpty())){
    callGame(game.exitSummary);
    return;
  }
  if(game.finishEmpty && game.isEmpty && game.isEmpty()){
    callGame(game.finishEmpty);
    return;
  }

  if(callGame(game.finish)){
    // Статистика: партия доведена до конца, а не брошена.
    try{ if(window.AppStats) window.AppStats.gameFinish(mode); }catch(e){}
    showToast('Игра завершена');
  } else {
    goToSetup();
  }
});

// Определяет, что делать при закрытии общего окна итогов (#summaryModal) —
// сброс Фантов или завершение "Правда или действие" (обе игры используют
// одну и ту же модалку итогов, только с разными данными).
let summaryModalMode = 'fanty';
/**
 * Рисует экран статистики: сводка, любимые игры, где выходят.
 * Все данные — с этого устройства (games/stats.js), ничего не отправляется.
 */
function renderStatsScreen(){
  const body = document.getElementById('statsBody');
  const toggleBtn = document.getElementById('statsToggleBtn');
  if(!body || !window.AppStats) return;

  const s = window.AppStats.summary();

  if(!s.enabled){
    body.innerHTML = '<div style="color:#8a5c7a;">Сбор статистики приостановлен. '
      + 'Данные за прошлые сессии сохранены.</div>';
  } else if(s.totalGames === 0){
    body.innerHTML = '<div style="color:#8a5c7a;">Пока нет данных — сыграйте партию, '
      + 'и здесь появится сводка: сколько партий, какие игры чаще, где выходят.</div>';
  } else {
    const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    const row = (label, value) =>
      '<div style="display:flex; justify-content:space-between; gap:10px; padding:2px 0;">'
      + '<span>' + label + '</span><b>' + value + '</b></div>';

    let html = '';
    html += row('Всего партий', s.totalGames);
    if (s.finishedGames !== undefined) {
      html += row('Законченных партий', s.finishedGames);
    }
    html += row('Дней в приложении', s.days);
    html += row('Общее время игры', window.AppStats.formatDuration(s.totalMs));
    if (s.devices !== undefined) {
      html += row('Всего устройств', s.devices);
    }

    if(s.games.length){
      html += '<div style="margin-top:12px; font-weight:700;">Любимые игры</div>';
      s.games.slice(0, 7).forEach((g) => {
        const done = g.finished > 0 ? ' · доиграно ' + g.finished : '';
        html += '<div style="display:flex; justify-content:space-between; gap:10px; padding:2px 0;">'
          + '<span>' + g.icon + ' ' + esc(g.title) + '</span>'
          + '<span style="white-space:nowrap; color:#6b4560;">' + g.started + done + '</span></div>';
      });
      if(s.games.length > 7){
        html += '<div style="color:#8a5c7a; font-size:13px; margin-top:4px;">…и ещё '
          + (s.games.length - 7) + '</div>';
      }
    }

    html += '<div style="margin-top:12px; font-weight:700;">Где выходят</div>';
    html += row('из настройки', s.exits.setup || 0);
    html += row('посреди партии', s.exits.midgame || 0);

    const devicesRow = document.getElementById('statsDevicesRow');
    if (devicesRow) devicesRow.style.display = s.devices !== undefined ? 'block' : 'none';
    const finishedRow = document.getElementById('statsFinishedRow');
    if (finishedRow) finishedRow.style.display = s.finishedGames !== undefined ? 'block' : 'none';

    body.innerHTML = html;
  }

  if(toggleBtn){
    toggleBtn.textContent = s.enabled ? '⏸ Приостановить сбор' : '▶ Возобновить сбор';
  }
}

function showSummary(){
  summaryModalMode = 'fanty';
  document.getElementById('summaryBonusText').style.display = 'none';
  const winnerEl = document.getElementById('summaryWinner');
  if(state.score1 === state.score2){
    winnerEl.textContent = '🤝 Ничья!';
  } else {
    const winnerName = state.score1 > state.score2 ? state.name1 : state.name2;
    winnerEl.textContent = `🏆 Победил ${winnerName}`;
  }
  document.getElementById('summaryScore').textContent = `${state.name1}: ${state.score1}  ·  ${state.name2}: ${state.score2}`;
  document.getElementById('summaryCounts').textContent = `Выполнено: ${state.completedCount||0}  ·  Пропущено: ${state.skippedCount||0}`;
  showModal('summaryModal');
}
document.getElementById('closeSummaryBtn').addEventListener('click', ()=>{
  hideModal('summaryModal');
  if(summaryModalMode === 'td'){
    finishTdGame();
    return;
  }
  if(summaryModalMode === 'timer'){
    exitTimerGame();
    return;
  }
  if(summaryModalMode === 'bingo'){
    // Оставляем на экране игры — выход только вручную
    hideModal('summaryModal');
    return;
  }
  if(summaryModalMode === 'bingoExit'){
    finishBingoGame();
    return;
  }
  goToSetup();
});

(document.getElementById('rulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{
  showModal('rulesModal');
});
document.getElementById('closeRulesBtn').addEventListener('click', ()=>{
  hideModal('rulesModal');
});
document.getElementById('rulesModal').addEventListener('click', (e)=>{
  if(e.target.id === 'rulesModal') e.currentTarget.classList.remove('show');
});

// ===== ГЛОБАЛЬНОЕ МЕНЮ =====
(function(){
  const menuBtn = document.getElementById('globalMenuBtn');
  const menuModal = document.getElementById('globalMenuModal');
  if(!menuBtn || !menuModal) return;

  menuBtn.addEventListener('click', ()=>{
    menuModal.classList.add('show');
    updateMuteBtn();
    updateAutoSpeakBtn();
  });
  menuModal.addEventListener('click', (e)=>{
    if(e.target.id === 'globalMenuModal') menuModal.classList.remove('show');
  });
  document.getElementById('globalMenuCloseBtn').addEventListener('click', ()=>{
    menuModal.classList.remove('show');
  });

  const closeMenu = ()=> menuModal.classList.remove('show');

  document.getElementById('menuRulesBtn').addEventListener('click', ()=>{
    closeMenu();
    if(window.__openRulesHub) window.__openRulesHub();
  });
  // «О проекте» — открывает отдельную информационную модалку
  document.getElementById('menuAboutBtn').addEventListener('click', ()=>{
    closeMenu();
    const aboutModal = document.getElementById('aboutProjectModal');
    if(aboutModal) aboutModal.classList.add('show');
  });
  document.getElementById('menuMuteBtn').addEventListener('click', ()=>{
    state.muted = !state.muted;
    saveState();
    updateMuteBtn();
  });
  document.getElementById('menuAutoSpeakBtn').addEventListener('click', ()=>{
    state.autoSpeak = !state.autoSpeak;
    saveState();
    updateAutoSpeakBtn();
    playSuccessSound();
  });
  document.getElementById('menuExportBtn').addEventListener('click', ()=>{
    closeMenu();
    exportGameData();
  });
  document.getElementById('menuImportBtn').addEventListener('click', ()=>{
    closeMenu();
    document.getElementById('importDataInput').click();
  });
  document.getElementById('menuInstallBtn').addEventListener('click', ()=>{
    closeMenu();
    // Используем общую логику: если есть системный диалог установки (PWA) —
    // вызываем его, иначе показываем инструкцию #installModal.
    tryInstallApp();
  });
  document.getElementById('menuResetBtn').addEventListener('click', async ()=>{
    closeMenu();
    if(await showResetConfirm()){
      performFullReset();
    }
  });
  // Пунктов «🔄 Обновить приложение» и «🐞 Сообщить о проблеме» в меню больше
  // нет — они дублировали автоматику, и обработчики убраны вместе с ними.
  // Обновление: при старте Service Worker сам находит новую версию и
  // показывает плашку #updateToast с кнопкой «Обновить» и крестиком
  // (см. блок регистрации в index.html) — принудительное обновление
  // по-прежнему доступно через hardUpdateApp().
  // Отчёт об ошибке: экран ошибки (#appErrorModal) открывается сам при любой
  // непойманной ошибке, и в нём уже есть «📋 Скопировать отчёт для
  // разработчика» (#appErrorReportBtn) плюс кнопка «Продолжить как есть».
  // Оставлять в меню копию того же действия было незачем.

  /* ===== Статистика (меню → «📊 Статистика») =====
     Данные считает games/stats.js и хранит отдельным ключом localStorage.
     Экран только показывает сводку и даёт выгрузить/очистить. */


  const __statsBtn = document.getElementById('menuStatsBtn');
  if(__statsBtn) __statsBtn.addEventListener('click', ()=>{
    closeMenu();
    renderStatsScreen();
    showModal('statsModal');
  });

  const __statsCloseBtn = document.getElementById('statsCloseBtn');
  if(__statsCloseBtn) __statsCloseBtn.addEventListener('click', ()=>{ hideModal('statsModal'); });

  const __statsToggleBtn = document.getElementById('statsToggleBtn');
  if(__statsToggleBtn) __statsToggleBtn.addEventListener('click', ()=>{
    if(!window.AppStats) return;
    const now = !window.AppStats.enabled();
    window.AppStats.setEnabled(now);
    renderStatsScreen();
    showToast(now ? 'Сбор статистики включён' : 'Сбор приостановлен (данные сохранены)');
  });

  const __statsClearBtn = document.getElementById('statsClearBtn');
  if(__statsClearBtn) __statsClearBtn.addEventListener('click', async ()=>{
    if(!window.AppStats) return;
    if(!(await showResetConfirm('Очистить статистику?', 'Счётчики партий на этом устройстве будут удалены. Прогресс игр не тронется.'))) return;
    window.AppStats.clear();
    renderStatsScreen();
    showToast('Статистика очищена');
  });

  // Закрытие модалки «О проекте» кликом по фону
  const aboutProjectModal = document.getElementById('aboutProjectModal');
  if(aboutProjectModal){
    aboutProjectModal.addEventListener('click', (e)=>{
      if(e.target === aboutProjectModal) aboutProjectModal.classList.remove('show');
    });
  }

  // ===== «О проекте»: QR со ссылкой и кнопка «Поделиться» =====
  // Ссылка — публичная страница приложения. QR рисуется локально
  // (games/qr.js), без внешних сервисов: обещание «данные не покидают
  // устройство» не нарушается — генерация это чистая математика.
  const ABOUT_SHARE_URL = 'https://bobah1988.github.io/Love-play/';
  const aboutShareBtn = document.getElementById('aboutShareBtn');
  const aboutQrCanvas = document.getElementById('aboutQrCanvas');
  if(aboutQrCanvas && window.renderQrCode){
    window.renderQrCode(aboutQrCanvas, ABOUT_SHARE_URL);
  }
  if(aboutShareBtn){
    aboutShareBtn.addEventListener('click', async ()=>{
      const shareData = {
        title: 'Давай играй',
        text: 'Коллекция игр для пары, компании и детей — заходи играй!',
        url: ABOUT_SHARE_URL,
      };
      // Web Share API (телефон — системное меню «Поделиться»),
      // на десктопе — фолбэк: копируем ссылку в буфер обмена.
      try{
        if(navigator.share){
          await navigator.share(shareData);
          showToast('Спасибо, что делитесь! 💛');
          return;
        }
        if(navigator.clipboard && navigator.clipboard.writeText){
          await navigator.clipboard.writeText(ABOUT_SHARE_URL);
          showToast('Ссылка скопирована — вставьте её в письмо или мессенджер');
          return;
        }
        showToast('Ссылка: ' + ABOUT_SHARE_URL);
      }catch(e){
        // Пользователь закрыл системное меню — не ошибка.
        if(e && e.name === 'AbortError') return;
        showToast('Не удалось поделиться — попробуйте позже');
      }
    });
  }
})();

// ===== СТРАНИЦА ПРАВИЛ ВСЕХ ИГР (меню → «Правила игр») =====
// Структура: группа → игра → вложенная игра (если есть).
// Каждая игра переиспользует свою существующую модалку правил.
(function(){
  const hub = document.getElementById('rulesHubModal');
  const list = document.getElementById('rulesHubList');
  if(!hub || !list) return;

  const RULES_HUB = [
    { icon:'💕', name:'Игры для пар 18+', games:[
      ['🎯','Викторина','quizRulesModal'],
      ['💬','Вопросы про это','ideasRulesModal'],
      ['💘','Фанты','rulesModal'],
      ['❓','Правда/Действие','tdRulesModal'],
      ['💑','Тайные ответы','znayuRulesModal'],
      ['💌','Твои желания','wishlistRulesModal'],
      ['🎱','Ваше бинго','bingoRulesModal'],
      ['⏱️','Таймер страсти','timerRulesModal'],
      ['💃','Предложи партнеру','photoRulesModal'],
      ['🎬','Давай попробуем','davayRulesModal'],
      ['🧩','Пройди квест','sexQuestRulesModal'],
      ['🎀','Карта страсти','passionMapRulesModal'],
    ]},
    { icon:'🎉', name:'Игры для компании', games:[
      ['🐊','Крокодил','krokodilRulesModal'],
      ['😂','Мемасики','memesRulesModal'],
      ['🎉','Фанты','partyFantsRulesModal'],
      ['🗣️','Правда/Действие','partyTdRulesModal'],
      ['🧠','Знаю тебя','famZnayuRulesModal'],
      ['🎫','Счастливый билет','luckyRulesModal'],
      ['🎯','Викторина','partyQuizRulesModal'],
      ['🙊','Я никогда не','partyNeverRulesModal'],
      ['🎰','Рулетка','partyRouletteRulesModal'],
      ['🌀','Твистер','twisterRulesModal'],
    ]},
    { icon:'🧸', name:'Игры с детьми', games:[
      ['🐊','Крокодил','kidsKrokodilRulesModal'],
      ['😂','Мемасики','kidsMemesRulesModal'],
      ['🧠','Мемори','kidsMemoryRulesModal'],
      ['🗣️','Правда/Действие','kidsTdRulesModal'],
      ['🎯','Викторина','kidsQuizRulesModal'],
      ['💣','Сапёр','kidsSaperRulesModal'],
      { sub:'♟️ Настольные игры', games:[
        ['⭕','Крестики нолики','kidsXoRulesModal'],
        ['🚢','Морской бой','kidsBattleshipRulesModal'],
        ['🔴','Четыре в ряд','kidsC4RulesModal'],
      ]},
      ['🎲','Во что поиграть?','whatToPlayRulesModal'],
    ]},
    { icon:'💼', name:'Бизнес игры', games:[
      ['🍋','Лимонадный ларёк','businessLemonadeRulesModal'],
      ['🛍️','Магазин','shopRulesModal'],
      ['🔍','Оцени бизнес','bizObsRulesModal'],
    ]},
    { icon:'📱', name:'Игры для одного', games:[
      ['🪢','Виселица','partyHangmanRulesModal'],
      ['🎯','Викторина','soloQuizRulesModal'],
      ['🧠','Мемори','soloMemoryRulesModal'],
      ['⭕','Крестики нолики','soloXoRulesModal'],
      ['🚢','Морской бой','soloBattleshipRulesModal'],
      ['🔴','Четыре в ряд','soloC4RulesModal'],
    ]},
    { icon:'📚', name:'Обучающие игры', games:[
      ['🗂️','Английский язык','flashRulesModal'],
      ['🕐','Время','flashTimeRulesModal'],
    ]},
  ];

  // Рендер групп и игр
  list.innerHTML = RULES_HUB.map(g=>{
    const items = g.games.map(it=>{
      if(Array.isArray(it)){
        return `<button type="button" class="rules-item" data-rules-modal="${it[2]}"><span class="rules-icon">${it[0]}</span><span class="rules-name">${it[1]}</span><span class="rules-chev">›</span></button>`;
      }
      return `<div class="rules-subgroup">${it.sub}</div>` + it.games.map(n=>
        `<button type="button" class="rules-item nested" data-rules-modal="${n[2]}"><span class="rules-icon">${n[0]}</span><span class="rules-name">${n[1]}</span><span class="rules-chev">›</span></button>`
      ).join('');
    }).join('');
    return `<div class="rules-group"><button type="button" class="rules-group-head"><span>${g.icon} ${g.name}</span><span class="rules-chev">▸</span></button><div class="rules-group-body">${items}</div></div>`;
  }).join('');

  // Раскрытие групп
  list.querySelectorAll('.rules-group-head').forEach(h=>{
    h.addEventListener('click', ()=> h.closest('.rules-group').classList.toggle('open'));
  });

  // Открытие правил конкретной игры
  list.querySelectorAll('.rules-item').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const modal = document.getElementById(btn.dataset.rulesModal);
      if(modal) modal.classList.add('show');
    });
  });

  // Закрытие хаба
  const closeHub = ()=> hub.classList.remove('show');
  document.getElementById('rulesHubCloseBtn').addEventListener('click', closeHub);
  hub.addEventListener('click', (e)=>{ if(e.target.id === 'rulesHubModal') closeHub(); });

  // Любую модалку правил можно закрыть кликом по фону
  document.querySelectorAll('.modal-overlay[id$="RulesModal"], #rulesModal').forEach(ov=>{
    ov.addEventListener('click', (e)=>{ if(e.target === ov) ov.classList.remove('show'); });
  });

  // Для меню и кнопки «назад»
  window.__openRulesHub = ()=> hub.classList.add('show');
  window.__closeRulesHub = closeHub;
})();

// ===== КНОПКА "НАЗАД" (ПАУЗА / НАЗАД НА 1 УРОВЕНЬ) =====
(function(){
  const backBtn = document.getElementById('globalBackBtn');
  if(!backBtn) return;

  // Собираем ВСЕ активные экраны игр (не #setup)
  function getActiveGameScreenIds(){
    const ids = [];
    document.querySelectorAll('.screen.active').forEach(s=>{
      if(s.id !== 'setup') ids.push(s.id);
    });
    return ids;
  }

  // Карта "идентификатор экрана → ID группы внутри #setup".
  // По ней определяется, в какую группу возвращаться после паузы или
  // из экрана настроек.
  const SECTION_FOR_SCREEN = {
    kidsBoardGamesMenu:'kidsView',
    fantySetup:'twoPlayerView', game:'twoPlayerView',
    photoSetup:'twoPlayerView', photoGame:'twoPlayerView',
    ideasGame:'twoPlayerView',
    davaySetup:'twoPlayerView', davayGame:'twoPlayerView', davayQuiz:'twoPlayerView',
    bingoSetup:'twoPlayerView', bingoGame:'twoPlayerView',
    timerSetup:'twoPlayerView', timerGame:'twoPlayerView',
    truthDareSetup:'twoPlayerView', tdSetup:'twoPlayerView',
    truthDareGame:'twoPlayerView', tdGame:'twoPlayerView',
    quizSetup:'twoPlayerView', quizGame:'twoPlayerView',
    wishlistSetup:'twoPlayerView', wishlistGame:'twoPlayerView',
    desireSetup:'twoPlayerView', desireGame:'twoPlayerView',
    znayuSetup:'twoPlayerView', znayuGame:'twoPlayerView',
    sexQuestSetup:'twoPlayerView', sexQuestGame:'twoPlayerView',
    sexQuestSummary:'twoPlayerView', sexQuestHistory:'twoPlayerView',
    passionMapSetup:'twoPlayerView', passionMapGame:'twoPlayerView',
    passionMapSummary:'twoPlayerView', passionMapHistory:'twoPlayerView',
    shopSetup:'businessView', shopGame:'businessView', videoGame:'twoPlayerView',
    wrSetup:'twoPlayerView',
    partyFantsSetup:'companyView', partyFantsGame:'companyView',
    partyTdSetup:'companyView', partyTdGame:'companyView',
    partyQuizSetup:'companyView', partyQuizGame:'companyView',
    krokodilSetup:'companyView', krokodilGame:'companyView',
    twisterSetup:'companyView', twisterGame:'companyView',
    partyHangmanSetup:'companyView', partyHangmanGame:'companyView',
    partyRouletteSetup:'companyView', partyRouletteGame:'companyView',
    partyNeverSetup:'companyView', partyNeverGame:'companyView',
    partyMemesSetup:'companyView', partyMemesGame:'companyView',
    famZnayuSetup:'companyView', famZnayuGame:'companyView',
    luckySetup:'companyView', luckyGame:'companyView',
    kidsMemorySetup:'kidsView', kidsMemoryGame:'kidsView',
    kidsQuizSetup:'kidsView', kidsQuizGame:'kidsView',
    kidsTdSetup:'kidsView', kidsTdGame:'kidsView', kidsTdChoice:'kidsView',
    kidsSaperSetup:'kidsView', kidsSaperGame:'kidsView',
    kidsXoSetup:'kidsView', kidsXoGame:'kidsView',
    kidsBattleshipSetup:'kidsView', kidsBattleshipGame:'kidsView',
    kidsKrokodilSetup:'kidsView', kidsKrokodilGame:'kidsView',
    kidsMemesSetup:'kidsView', kidsMemesGame:'kidsView',
    kidsFlashSetup:'kidsView', kidsFlashGame:'kidsView',
    kidsWhatToPlay:'kidsView',
    soloMemorySetup:'soloView', soloMemoryGame:'soloView',
    soloQuizSetup:'soloView', soloQuizGame:'soloView',
    soloXoSetup:'soloView', soloXoGame:'soloView',
    soloBsSetup:'soloView', soloBsGame:'soloView',
    soloBattleshipSetup:'soloView', soloBattleshipGame:'soloView',
    soloC4Setup:'soloView', soloC4Game:'soloView',
    whatToPlayGame:'soloView',
    businessLemonadeSetup:'businessView', businessLemonadeGame:'businessView',
    bizObsSetup:'businessView', bizObsGame:'businessView',
    flashSetup:'learningView', flashGame:'learningView',
    flashTimeSetup:'learningView', flashTimeGame:'learningView',
  };
  // Экраны настроек (не запущенной партии) — для них "Назад" возвращает в
  // группу БЕЗ открытия меню паузы.
  const SETUP_ONLY_SCREENS = new Set([
    'kidsBoardGamesMenu',
    'fantySetup','photoSetup','bingoSetup','timerSetup','truthDareSetup','tdSetup',
    'quizSetup','wishlistSetup','desireSetup','znayuSetup','sexQuestSetup',
    'sexQuestSummary','sexQuestHistory','shopSetup',
    'passionMapSetup','passionMapSummary','passionMapHistory',
    'davaySetup','ideasGame','wrSetup',
    'partyFantsSetup','partyTdSetup','partyQuizSetup','krokodilSetup','twisterSetup',
    'partyHangmanSetup','partyRouletteSetup','partyNeverSetup','partyMemesSetup',
    'famZnayuSetup','luckySetup',
    'kidsMemorySetup','kidsQuizSetup','kidsTdSetup','kidsSaperSetup','kidsXoSetup',
    'kidsBattleshipSetup','kidsKrokodilSetup','kidsMemesSetup','kidsFlashSetup','flashTimeSetup',
    'soloMemorySetup','soloQuizSetup','soloXoSetup','soloBsSetup','soloBattleshipSetup','soloC4Setup',
    'businessLemonadeSetup','bizObsSetup','flashSetup',
  ]);
  function sectionForScreenId(sid){
    if(SECTION_FOR_SCREEN[sid]) return SECTION_FOR_SCREEN[sid];
    if(sid.includes('Saper')) return 'kidsView';
    if(sid.includes('Memory')) return sid.includes('Solo') ? 'soloView' : 'kidsView';
    if(sid.includes('Flash')) return sid.includes('Kids') ? 'kidsView' : 'learningView';
    if(sid.includes('Krokodil')) return sid.includes('Kids') ? 'kidsView' : 'companyView';
    if(sid.includes('Memes')) return sid.includes('Kids') ? 'kidsView' : 'companyView';
    if(sid.includes('Xo') || sid.includes('Battleship') || sid.includes('Bs')) return 'soloView';
    if(sid.includes('Quiz')) return sid.includes('Kids') ? 'kidsView' : (sid.includes('Party') ? 'companyView' : 'twoPlayerView');
    if(sid.includes('Td') || sid.includes('TruthDare')) return sid.includes('Kids') ? 'kidsView' : (sid.includes('Party') ? 'companyView' : 'twoPlayerView');
    if(sid.includes('Fants')) return sid.includes('Party') ? 'companyView' : 'twoPlayerView';
    if(sid.includes('Znayu')) return sid.includes('Fam') ? 'companyView' : 'twoPlayerView';
    if(sid.includes('Lucky') || sid.includes('Hangman') || sid.includes('Twister') || sid.includes('Roulette') || sid.includes('Never')) return 'companyView';
    if(sid.includes('Business') || sid.includes('bizObs')) return 'businessView';
    if(sid.includes('What') || sid.includes('whatToPlay')) return 'soloView';
    return 'twoPlayerView';
  }
  // Вложенные экраны игры (история, итоги): стрелка «←» — это «шаг назад»,
  // как штатная кнопка выхода этого экрана («Назад»/«В меню»), а не прыжок
  // в группу хаба через generic-фолбэк. Карта содержит ИМЯ функции выхода:
  // вызываем её, чтобы не дублировать логику переключения экранов
  // (та же причина «размазанной» логики, что чинилась в v286/v288).
  // Глобальный хук для клавиатурной «←» (core.js): там своя ветка keydown,
  // которая раньше знала только режимы #game.
  const PARENT_BACK = {
    'sexQuestHistory':'exitSexQuestHistory',
    'sexQuestSummary':'exitSexQuestSummary',
    'passionMapHistory':'exitPassionMapHistory',
    'passionMapSummary':'exitPassionMapSummary',
    'sexQuestSetup':'exitSexQuestSetup',
    'passionMapSetup':'exitPassionMapSetup',
  };
  window.handleNestedBack = function(activeIds){
    const ids = activeIds || getActiveGameScreenIds();
    for(const sid of ids){
      const backFn = PARENT_BACK[sid];
      if(backFn && typeof window[backFn] === 'function'){
        window[backFn]();
        if(typeof window.scrollTo === 'function') window.scrollTo(0, 0);
        return true;
      }
    }
    return false;
  };
  function returnToGroup(sectionId){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    const setup = document.getElementById('setup');
    if(setup) setup.classList.add('active');
    if(typeof showSetupView === 'function') showSetupView(sectionId);
    window.scrollTo(0, 0);
  }

  backBtn.addEventListener('click', ()=>{
    // Останавливаем любую озвучку/звук при выходе — сразу, до любых проверок
    if(typeof stopAllSounds === 'function') stopAllSounds();

    // Закрываем глобальное меню если открыто
    const menuModal = document.getElementById('globalMenuModal');
    if(menuModal) menuModal.classList.remove('show');

    // Если открыта страница правил — закрываем её
    const rulesHub = document.getElementById('rulesHubModal');
    if(rulesHub && rulesHub.classList.contains('show')){ rulesHub.classList.remove('show'); return; }

    // Если показано итоговое окно — закрываем и выходим на главный хаб
    const summaryModal = document.getElementById('summaryModal');
    if(summaryModal && summaryModal.classList.contains('show')){
      summaryModal.classList.remove('show');
      if(typeof state !== 'undefined'){
        state.inProgress = false;
        state.pausedMode = null;
        const lastSection = state.lastSectionOnPause || 'homeView';
        state.lastSectionOnPause = null;
        if(lastSection !== 'homeView'){
          returnToGroup(lastSection);
          if(typeof updateResumeUI === 'function') updateResumeUI();
          return;
        }
      }
      document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
      const setup = document.getElementById('setup');
      if(setup) setup.classList.add('active');
      if(typeof showSetupView === 'function') showSetupView('homeView');
      window.scrollTo(0, 0);
      if(typeof updateResumeUI === 'function') updateResumeUI();
      return;
    }

    // «Предложи партнеру»: нижний ряд с кнопкой «Выход» убран — выход из игры
    // (и из просмотра избранного) выполняется стрелкой «←» в шапке напрямую,
    // без меню паузы (как раньше работала кнопка «Выход»).
    if(typeof isPlaceholderMode === 'function' && isPlaceholderMode()
      && typeof exitPlaceholderGame === 'function'){
      exitPlaceholderGame();
      return;
    }

    // Видеорулетка («Давай попробуем»): стрелка «←» выходит из видеорежима
    // прямо в меню игры, без промежуточного меню паузы — как и просили.
    // Проверка идёт ДО общей логики паузы, иначе срабатывала ветка «Фантов»
    // и игрок попадал в их паузу.
    if(typeof isVideoMode === 'function' && isVideoMode()
      && typeof exitVideoGame === 'function'){
      exitVideoGame();
      return;
    }

    // «Давай попробуем» (обычный режим): нижний ряд с кнопками «Пауза»/«Выход»
    // убран — выход выполняет стрелка «←». Раньше этой ветки не было, и режим
    // проваливался в общую логику: экран #game в реестре принадлежит «Фантам»,
    // поэтому пауза сохранялась как «фанты» — игрок попадал в чужое меню
    // «Пауза — 💘 Фанты», а прогресс «Давай попробуем» не восстанавливался.
    // Ветка обязана идти ДО общей логики — как ветка видеорежима выше и как
    // убранный «Предложи партнёру» рядом.
    // В просмотре избранного партии нет вовсе, поэтому выходим сразу в меню
    // игры; в обычной партии сохраняем прогресс паузой «Давай попробуем».
    if(typeof isDavayMode === 'function' && isDavayMode()){
      if(state.davayFavoritesOnly && typeof exitDavayGame === 'function'){
        exitDavayGame(true);
      } else if(typeof pauseDavayGame === 'function'){
        pauseDavayGame();
      }
      return;
    }

    const setup = document.getElementById('setup');
    const homeView = document.getElementById('homeView');
    const isSetupActive = setup && setup.classList.contains('active');
    const isHomeView = homeView && homeView.classList.contains('section-open');
    const pauseModal = document.getElementById('pauseMenuModal');
    const isPauseShown = pauseModal && pauseModal.classList.contains('show');

    // 1. Главный хаб — ничего не делаем
    if(isSetupActive && isHomeView) return;

    // 2. Группа игр (не homeView) — возврат на главный хаб
    if(isSetupActive && !isHomeView){
      if(typeof showSetupView === 'function') showSetupView('homeView');
      window.scrollTo(0, 0);
      return;
    }

    // 3. В игре — если пауза показана, выходим полностью
    if(isPauseShown){
      if(pauseModal) pauseModal.classList.remove('show');
      const lastSection = (typeof state !== 'undefined' && state.lastSectionOnPause) ? state.lastSectionOnPause : 'homeView';
      if(typeof state !== 'undefined'){
        state.inProgress = false;
        state.pausedMode = null;
        state.lastSectionOnPause = null;
      }
      returnToGroup(lastSection);
      if(typeof updateResumeUI === 'function') updateResumeUI();
      return;
    }

    // 4. Определяем активный экран(ы)
    const screenIds = getActiveGameScreenIds();
    if(screenIds.length === 0) return;
    // Вложенные экраны (история, итоги): «←» — это «шаг назад» в настройки
    // игры, а не в группу хаба. Вызываем штатную функцию выхода экрана (ту
    // же, что у кнопки «Назад»/«В меню»), чтобы не дублировать логику
    // переключения экранов (та же причина «размазанной» логики, v286/v288).
    // Ветка идёт ДО onlySetupScreen: эти экраны входят в SETUP_ONLY_SCREENS
    // (партии нет, пауза не нужна), но generic-фолбэк ниже вернул бы в хаб.
    // Единая точка — window.handleNestedBack (ею же пользуется клавиатурная
    // «←» в core.js, там своя ветка keydown вне этого обработчика).
    if(typeof window.handleNestedBack === 'function' && window.handleNestedBack(screenIds)) return;
    const onlySetupScreen = screenIds.every(sid => SETUP_ONLY_SCREENS.has(sid));
    if(onlySetupScreen){
      const sectionId = sectionForScreenId(screenIds[0]);
      returnToGroup(sectionId);
      return;
    }
    const mainScreenId = screenIds.includes('game') ? 'game' : screenIds[0];
    const sectionId = sectionForScreenId(mainScreenId);
    if(typeof state !== 'undefined'){
      state.lastSectionOnPause = sectionId;
      saveState();
    }
    // Игры без паузы: тот же выход, что у кнопки внутри игры, а не хаб.
    for(const sid of screenIds){
      const g = gameByScreen(sid);
      if(g && g.noPause && g.back && typeof window[g.back] === 'function'){
        window[g.back]();
        state.inProgress = false;
        state.pausedMode = null;
        state.lastSectionOnPause = null;
        saveState();
        updateResumeUI();
        window.scrollTo(0, 0);
        return;
      }
    }
    // Пауза из игры: функция берётся из реестра игр по id игрового экрана
    // (game-registry.js). Раньше здесь был отдельный список PAUSE_MAP из 40
    // строк, дублировавший те же имена — два источника расходились.
    let fnName = null;
    for(const sid of screenIds){
      const g = gameByScreen(sid);
      if(g && g.pause){ fnName = g.pause; break; }
    }
    if(fnName && typeof window[fnName] === 'function'){
      // Страховка: «Предложи партнеру» использует общий экран #game (в реестре
      // он принадлежит «Фантам» с pause=pauseGame). Если активен placeholder-
      // режим — выходим в меню игры напрямую, минуя паузу «Фантов».
      if(typeof isPlaceholderMode === 'function' && isPlaceholderMode()
        && typeof exitPlaceholderGame === 'function'){
        exitPlaceholderGame();
        return;
      }
      window[fnName]();
      // Страховка: pause-функция могла оставить лишний экран активным
      setTimeout(ensureSingleActiveScreen, 0);
      return;
    }
    // Fallback: для игр без dedicated pause-функции — универсальная пауза.
    // ВАЖНО: скрываем ВСЕ активные игровые экраны, иначе экран делится на 2 части
    if(screenIds.length && typeof state !== 'undefined'){
      const setupEl2 = document.getElementById('setup');
      screenIds.forEach(sid=>{
        const gameScreen = document.getElementById(sid);
        if(gameScreen) gameScreen.classList.remove('active');
      });
      if(setupEl2) setupEl2.classList.add('active');
      const mainId = screenIds.includes('game') ? 'game' : screenIds[0];
      // Экран #game принадлежит «Фантам», поэтому выход из него — это пауза
      // «Фантов». Для остальных игр здесь оказываются только те, у которых
      // паузы нет вовсе (Рулетка желаний, Секс-квест, Карта страсти,
      // Виселица, Лимонадный ларёк — см. noPause в game-registry.js):
      // игрок выходит из партии, а не ставит её на паузу.
      if(mainId.includes('fanty') || mainId === 'game'){
        state.pausedMode = 'fanty';
      } else {
        state.pausedMode = null;
        // ВАЖНО: партия брошена — флаг inProgress тоже надо снять. Иначе он
        // остаётся true, и в хабе блокируются настройки (updateSettingsLockUI
        // помечает их .locked-settings): игрок не может сменить режим или
        // уровни, хотя никакой игры не идёт. Здесь намеренно не вызываем
        // *finish*-функции игр — они сохраняют итоги, а выход по «←» это
        // прерывание партии, а не её честное завершение.
        state.inProgress = false;
      }
      saveState();
      // Останавливаем любые фоновые звуки и озвучку, чтобы не играли после выхода
      if(typeof stopAllSounds === 'function') stopAllSounds();
      if(typeof updateResumeUI === 'function') updateResumeUI();
      window.scrollTo(0, 0);
    }
  });

  // Автоматическое скрытие/показ кнопки "Назад"
  const setupEl = document.getElementById('setup');
  const homeViewEl = document.getElementById('homeView');
  if(setupEl && homeViewEl && 'MutationObserver' in window){
    function updateBackBtn(){
      const isSetupActive = setupEl.classList.contains('active');
      const isHomeView = homeViewEl.classList.contains('section-open');
      const isHome = isSetupActive && isHomeView;
      backBtn.style.opacity = isHome ? '0' : '1';
      backBtn.style.pointerEvents = isHome ? 'none' : 'auto';
    }
    new MutationObserver(updateBackBtn).observe(setupEl, {attributes:true, attributeFilter:['class']});
    new MutationObserver(updateBackBtn).observe(homeViewEl, {attributes:true, attributeFilter:['class']});
    updateBackBtn();
  }
})();

(document.getElementById('davaySetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{
  showModal('davayRulesModal');
});
document.getElementById('closeDavayRulesBtn').addEventListener('click', ()=>{
  hideModal('davayRulesModal');
});
document.getElementById('davayRulesModal').addEventListener('click', (e)=>{
  if(e.target.id === 'davayRulesModal') e.currentTarget.classList.remove('show');
});

document.getElementById('closePhotoRulesBtn').addEventListener('click', ()=>{
  hideModal('photoRulesModal');
});
document.getElementById('photoRulesModal').addEventListener('click', (e)=>{
  if(e.target.id === 'photoRulesModal') e.currentTarget.classList.remove('show');
});
// Кнопка «Установить»: на платформах, где доступен системный диалог установки
// (Chrome/Android, новая версия Chromium-браузеров на десктопе), вызываем его
// напрямую (beforeinstallprompt). Везде, где события нет (iOS Safari, уже
// установленное приложение), показываем модалку с инструкцией по установке —
// именно для этого у нас и есть #installModal.
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  // Не даём браузеру показать свой авто-баннер — мы берём установку на себя.
  e.preventDefault();
  deferredInstallPrompt = e;
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
});
// Общая функция установки: если браузер поддерживает установку PWA
// (сработал beforeinstallprompt и приложение ещё не установлено) — вызываем
// системный диалог установки. Иначе (iOS Safari, уже установлено, без
// поддержки) — показываем пошаговую инструкцию #installModal.
function tryInstallApp(){
  if (deferredInstallPrompt) {
    // Есть системный диалог установки (beforeinstallprompt) — вызываем его.
    // prompt() можно вызвать на событии один раз; после вызова объект обнуляем.
    deferredInstallPrompt.prompt();
    deferredInstallPrompt = null;
    return;
  }
  // Системной установки нет — показываем пошаговую инструкцию.
  showModal('installModal');
}
document.getElementById('installBtn').addEventListener('click', ()=>{
  tryInstallApp();
});
document.getElementById('closeInstallBtn').addEventListener('click', ()=>{
  hideModal('installModal');
});
document.getElementById('installModal').addEventListener('click', (e)=>{
  if(e.target.id === 'installModal') e.currentTarget.classList.remove('show');
});
// Возрастное предупреждение (18+) — флаги хранятся отдельными ключами в
// localStorage (не внутри основного state), намеренно: чтобы "Сбросить
// прогресс" и импорт/экспорт резервной копии их не трогали, и выбор не
// терялся вместе с прогрессом игр. "Мне нет 18" не блокирует сайт, а
// включает детский режим — см. isKidsModeRestricted/applyKidsModeRestrictions
// ниже. Это клиентский фильтр интерфейса, а не настоящая защита (тот, кто
// откроет исходный код, легко его обойдёт) — временное решение для
// собственного устройства ребёнка, до появления полноценных аккаунтов.
function isKidsModeRestricted(){
  try{ return localStorage.getItem('couple-game-kids-mode-v1') === '1'; }catch(e){ return false; }
}
// Прячет взрослые разделы меню и не даёт Викторине "для одного" показывать
// уровни 18+/Пошлые (она использует общий банк вопросов компании, см.
// games/solo-quiz.js). Вызывается один раз при загрузке и каждый раз, когда
// рендерится список уровней Викторины для одного.
function applyKidsModeRestrictions(){
  if(!isKidsModeRestricted()) return;
  const twoPlayerBtn = document.getElementById('homeTwoPlayerBtn');
  const companyBtn = document.getElementById('homeCompanyBtn');
  if(twoPlayerBtn) twoPlayerBtn.style.display = 'none';
  if(companyBtn) companyBtn.style.display = 'none';
}
document.getElementById('ageGateAdultBtn').addEventListener('click', ()=>{
  try{ localStorage.setItem('couple-game-age-verified-v1', '1'); }catch(e){}
  hideModal('ageGateModal');
});
document.getElementById('ageGateMinorBtn').addEventListener('click', ()=>{
  try{ localStorage.setItem('couple-game-kids-mode-v1', '1'); }catch(e){}
  hideModal('ageGateModal');
  applyKidsModeRestrictions();
});
// Долгое нажатие (1.5 сек) на заголовок "Давай играй" — скрытый способ для
// родителя вернуть полный доступ на этом устройстве: сбрасывает оба флага
// возрастного экрана и перезагружает страницу, чтобы окно 18+ показалось
// заново.
(function(){
  const titleEl = document.getElementById('homeTitle');
  if(!titleEl) return;
  let pressTimer = null;
  const clearPressTimer = ()=>{ if(pressTimer){ clearTimeout(pressTimer); pressTimer = null; } };
  titleEl.addEventListener('pointerdown', ()=>{
    clearPressTimer();
    pressTimer = setTimeout(()=>{
      if(confirm('Сбросить выбор возраста и снова показать окно 18+?')){
        try{
          localStorage.removeItem('couple-game-age-verified-v1');
          localStorage.removeItem('couple-game-kids-mode-v1');
        }catch(e){}
        location.reload();
      }
    }, 1500);
  });
  titleEl.addEventListener('pointerup', clearPressTimer);
  titleEl.addEventListener('pointerleave', clearPressTimer);
  titleEl.addEventListener('pointercancel', clearPressTimer);
})();
applyKidsModeRestrictions();
// «Горячее» в «Видеорулетке»: следующая папка Яндекса внутри уровня
// («Level 1-1 …» → «Level 1-2 …»), а когда своих папок в уровне больше нет —
// следующий уровень.
document.getElementById('videoLevelUpBtn').addEventListener('click', ()=>{
  const sub = nextDavaySubLevel(videoLevel, videoSubLevel);
  if(!sub && videoLevel >= VIDEO_MAX_LEVEL){
    playErrorSound();
    showToast('Это максимальный уровень 🔥');
    return;
  }
  playLevelUpSound();
  if(sub){
    if(!switchVideoLevel(videoLevel, sub)) return;
    showToast(`Горячее: Level ${videoLevel}-${sub}`);
  } else {
    const next = videoLevel + 1;
    if(!switchVideoLevel(next, 1)) return;
    showToast(`Уровень повышен: ${next}`);
  }
});
// «Повысить уровень» в «Видеорулетке»: всегда строго на следующий уровень
// (Level 1-1 → Level 2-1), подуровни пропускает — парная к «Горячему» кнопка
// (в «Давай попробуем» та же логика у davayNextBtn).
document.getElementById('videoNextBtn').addEventListener('click', ()=>{
  if(videoLevel >= VIDEO_MAX_LEVEL){
    playErrorSound();
    showToast('Это максимальный уровень 🔥');
    return;
  }
  playLevelUpSound();
  if(!switchVideoLevel(videoLevel + 1, 1)) return;
  showToast(`Уровень повышен: ${videoLevel}`);
});
// Кнопки уровней «Давай попробуем»: «Горячее» шагает по папкам Яндекса внутри
// уровня, «Повысить уровень» — всегда строго на следующий уровень (Level 1-1 →
// Level 2-1), подуровни пропускает. Нажатие посреди раунда не блокируется:
// раунд начинается заново на выбранном уровне (restartDavayRoundAtLevel) —
// очередь из 10 привязана к уровню, «докрутить» её нельзя.
document.getElementById('davayLevelUpBtn').addEventListener('click', ()=>{
  const sub = nextDavaySubLevel(davayLevel, davaySubLevel);
  if(!sub && davayLevel >= DAVAY_MAX_LEVEL){
    playErrorSound();
    showToast('Это максимальный уровень 🔥');
    return;
  }
  playLevelUpSound();
  if(sub){
    const r = switchVideoLevel(davayLevel, sub);
    if(!r) return;
    showToast(`Горячее: Level ${davayLevel}-${sub}`
      + (r.restarted ? '. Раунд начат заново' : ''));
  } else {
    const r = switchVideoLevel(davayLevel + 1, 1);
    if(!r) return;
    showToast(`Уровень повышен: ${davayLevel} — ${davayLevelInfo(davayLevel).name}`
      + (r.restarted ? '. Раунд начат заново' : ''));
  }
});
document.getElementById('davayNextBtn').addEventListener('click', ()=>{
  if(davayLevel >= DAVAY_MAX_LEVEL){
    playErrorSound();
    showToast('Это максимальный уровень 🔥');
    return;
  }
  playLevelUpSound();
  const r = switchVideoLevel(davayLevel + 1, 1);
  if(!r) return;
  showToast(`Уровень повышен: ${davayLevel} — ${davayLevelInfo(davayLevel).name}`
    + (r.restarted ? '. Раунд начат заново' : ''));
});
// "Готовы повторить?" — игра на двоих: сначала выбирается, кто отвечает
// первым, ему показывают 10 разных видео, на каждое — Да/Не сейчас/Нет.
// Затем те же 10 видео в том же порядке показываются второму игроку. После
// обоих — сколько ответов совпало по каждой категории, и видео, на которые
// ОБА ответили "Да", попадают в избранное (❤️).

function getDavayQuizPool(){
  const seen = new Set();
  const pool = [];
  const hidden = state.davayHidden || [];
  let poolAll = getDavayCardsList().filter(c=>c.level===davayLevel && !hidden.includes(davayCardId(c)));
  // Подуровень всегда 1: очередь квиза собирается из папки «Level N-1 …»
  // выбранного уровня. Фолбэк — если роликов с таким подуровнем нет (свои
  // видео с телефона не имеют папки), играем весь уровень.
  const subPool = poolAll.filter(c=>davayCardSubLevel(c)===davaySubLevel);
  if(subPool.length) poolAll = subPool;
  poolAll.forEach(c=>{
    const id = davayCardId(c);
    if(seen.has(id)) return;
    seen.add(id);
    pool.push(c);
  });
  return pool;
}
function davayQuizCardById(id){
  return getDavayCardsList().find(c=>davayCardId(c)===id) || null;
}
// Смена уровня/подуровня кнопками «Горячее»/«Повысить уровень» ПОСРЕДИ раунда.
// Очередь из 10 видео привязана к уровню: сравнение ответов игроков требует,
// чтобы оба видели одни и те же ролики, — «докрутить» новый уровень в идущую
// очередь нельзя. Поэтому раунд начинается заново на выбранном уровне: ответы,
// данные до переключения (включая уже отвеченную первым игроком часть),
// сбрасываются, первым отвечает стартовый игрок из настройки «Первым начинает».
// Если на новом уровне (подуровне) видео нет — уровень не меняется и раунд
// продолжается: иначе игра осталась бы без активного игрока и карточки.
function restartDavayRoundAtLevel(level, sub){
  const n = normalizeDavayLevel(level);
  const s = Math.max(0, parseInt(sub, 10) || 0);
  const prevLevel = davayLevel, prevSub = davaySubLevel;
  davayLevel = n;
  davaySubLevel = s;
  if(getDavayQuizPool().length === 0){
    davayLevel = prevLevel;
    davaySubLevel = prevSub;
    playErrorSound();
    showToast(`На уровне ${n} видео нет — раунд продолжается`);
    return false;
  }
  davayHistory = [];
  davayHistoryPos = -1;
  davayFavIndex = -1;
  resetDavayQuiz();
  updateDavayLevelBtn();
  updateDavayPlayerButtons();
  updateDavayFavoritesBtn();
  startDavayQuizPlayer(pickStartingPlayerValue(state.davayStarter));
  return true;
}
function updateDavayPlayerButtons(){
  const p1 = document.getElementById('davayPlayer1Btn');
  const p2 = document.getElementById('davayPlayer2Btn');
  if(p1){
    p1.textContent = state.name1 || 'Игрок 1';
    p1.classList.toggle('active', state.davayQuizActivePlayer === 1);
    p1.classList.toggle('done', !!state.davayQuizP1Done);
  }
  if(p2){
    p2.textContent = state.name2 || 'Игрок 2';
    p2.classList.toggle('active', state.davayQuizActivePlayer === 2);
    p2.classList.toggle('done', !!state.davayQuizP2Done);
  }
  updateDavayProgressBar();
}
function updateDavayProgressBar(){
  const fill = document.getElementById('davayProgressFill');
  const label = document.getElementById('davayProgressLabel');
  if(!fill || !label) return;
  const total = state.davayQuizQueue.length;
  const done = Math.min(state.davayQuizIndex, total);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  fill.style.width = pct + '%';
  label.textContent = total > 0 ? `${done} / ${total}` : '0 / 10';
}
function resetDavayQuiz(){
  state.davayQuizActivePlayer = 0;
  state.davayQuizQueue = [];
  state.davayQuizIndex = 0;
  state.davayQuizAnswers = {};
  state.davayQuizP1Done = false;
  state.davayQuizP2Done = false;
  state.davayQuizPendingNext = 0;
  const gameEl = document.getElementById('game');
  if(gameEl) gameEl.classList.remove('davay-handoff');
  saveState();
  updateDavayPlayerButtons();
}
// Пустая карточка "передайте телефон следующему игроку" между раундами
function renderDavayHandoffCard(nextPlayerNum){
  const gameEl = document.getElementById('game');
  if(gameEl) gameEl.classList.add('davay-handoff');
  const nextName = nextPlayerNum === 2 ? (state.name2 || 'Игрок 2') : (state.name1 || 'Игрок 1');
  clearInterval(timerInterval);
  timerInterval = null;
  currentCard = null;
  currentDavayCard = null;
  fadeSwapCard((card)=>{
    card.className = 'card card-empty';
    card.style.borderTop = '';
    card.innerHTML = `<div class="card-inner"><div class="card-icon">💞</div><div class="card-text davay-handoff-text">Передайте телефон игроку «${nextName}»</div></div>`;
  });
  updateFavoriteBtn();
}
document.getElementById('davayHandoffStartBtn').addEventListener('click', ()=>{
  const gameEl = document.getElementById('game');
  if(gameEl) gameEl.classList.remove('davay-handoff');
  const next = state.davayQuizPendingNext || 2;
  state.davayQuizPendingNext = 0;
  saveState();
  startDavayQuizPlayer(next);
});
function showDavayQuizCurrentCard(){
  const id = state.davayQuizQueue[state.davayQuizIndex];
  const card = id ? davayQuizCardById(id) : null;
  if(card){
    currentDavayCard = card;
    renderDavayCard(card, davayLevel);
  } else {
    renderDavayPlaceholderCard();
  }
}
function startDavayQuizPlayer(playerNum){
  if(state.davayQuizActivePlayer !== 0) return; // уже кто-то отвечает
  if(playerNum === 1 && state.davayQuizP1Done) return;
  if(playerNum === 2 && state.davayQuizP2Done) return;
  // Очередь из 10 видео формируется один раз — на старте первого игрока —
  // и остаётся той же самой для второго.
  if(state.davayQuizQueue.length === 0){
    const pool = shuffle(getDavayQuizPool()).slice(0, 10);
    if(pool.length === 0){
      showToast('Нет видео для этого уровня — добавьте видео кнопкой «+»');
      return;
    }
    if(pool.length < 10){
      showToast(`Пока доступно только ${pool.length} видео — используем их`);
    }
    state.davayQuizQueue = pool.map(c=>davayCardId(c));
  }
  state.davayQuizIndex = 0;
  state.davayQuizActivePlayer = playerNum;
  saveState();
  updateDavayPlayerButtons();
  showDavayQuizCurrentCard();
}
// Ряд с именами игроков теперь только показывает, чей сейчас ход — выбор
// игрока сделан заранее на странице настройки, кликать по кнопкам не нужно.

function finishDavayQuizSummary(){
  // "Нет": "Нет" от ЛЮБОГО из игроков — видео исключается из игры до сброса
  // прогресса (приоритет выше остальных вариантов).
  // "Да": оба ответили "Да" — в избранное.
  // "Не сейчас": оба ответили "Не сейчас", ИЛИ один "Не сейчас" а другой "Да" —
  // видео остаётся в игре и может снова попасться случайно в будущих раундах.
  let matchYes = 0, matchLater = 0, matchNo = 0;
  const newFavorites = [];
  const newLater = [];
  const newHidden = [];
  state.davayQuizQueue.forEach(id=>{
    const a = state.davayQuizAnswers[id];
    if(!a || !a.p1 || !a.p2) return;
    if(a.p1 === 'no' || a.p2 === 'no'){
      matchNo++;
      newHidden.push(id);
    } else if(a.p1 === 'yes' && a.p2 === 'yes'){
      matchYes++;
      newFavorites.push(id);
    } else if(
      (a.p1 === 'later' && a.p2 === 'later') ||
      (a.p1 === 'later' && a.p2 === 'yes') ||
      (a.p1 === 'yes' && a.p2 === 'later')
    ){
      matchLater++;
      newLater.push(id);
    }
  });
  if(!state.davayLiked) state.davayLiked = [];
  newFavorites.forEach(id=>{
    if(!state.davayLiked.includes(id)) state.davayLiked.push(id);
  });
  if(!state.davayFavLater) state.davayFavLater = [];
  newLater.forEach(id=>{
    if(!state.davayFavLater.includes(id)) state.davayFavLater.push(id);
  });
  if(!state.davayHidden) state.davayHidden = [];
  newHidden.forEach(id=>{
    if(!state.davayHidden.includes(id)) state.davayHidden.push(id);
  });
  saveState();
  updateFavoriteBtn();
  resetDavayQuiz();
  renderDavayPlaceholderCard();
  showDavaySummaryModal(matchYes, matchLater, matchNo);
}

function showDavaySummaryModal(matchYes, matchLater, matchNo){
  const introEl = document.getElementById('davaySummaryIntro');
  if(introEl){
    introEl.textContent = matchYes > 0
      ? 'Совпавшие «Да» уже добавлены в избранное ❤️'
      : 'Совпадений «Да» в этот раз нет — попробуйте другой уровень или добавьте ещё видео.';
  }
  const yesEl = document.getElementById('davaySummaryYes');
  if(yesEl) yesEl.textContent = `❤️ Да: ${matchYes}`;
  const laterEl = document.getElementById('davaySummaryLater');
  if(laterEl) laterEl.textContent = `🤔 Не сейчас: ${matchLater}`;
  const favBtn = document.getElementById('davaySummaryFavBtn');
  if(favBtn) favBtn.style.display = matchYes > 0 ? 'flex' : 'none';
  const modal = document.getElementById('davaySummaryModal');
  if(modal) modal.classList.add('show');
}
document.getElementById('closeDavaySummaryBtn').addEventListener('click', ()=>{
  hideModal('davaySummaryModal');
  exitDavayGame(true);
});
document.getElementById('davaySummaryModal').addEventListener('click', (e)=>{
  if(e.target.id === 'davaySummaryModal') e.currentTarget.classList.remove('show');
});
document.getElementById('davaySummaryFavBtn').addEventListener('click', ()=>{
  hideModal('davaySummaryModal');
  if(!state.davayFavoritesOnly){
    state.davayFavoritesOnly = true;
    saveState();
  }
  // Просмотр избранного — это не партия, которую можно поставить на паузу,
  // поэтому кнопка сразу подписана "Выход" (обработчик см. у pauseBtn).
  document.getElementById('pauseBtn').textContent = 'Выход';
  updateDavayFavoritesBtn();
  showDavayFavoriteAt(0);
});

function answerDavayQuiz(answer){
  if(!state.davayQuizActivePlayer){
    playErrorSound();
    showToast('Выберите имя игрока, кто начинает первым');
    return;
  }
  const id = state.davayQuizQueue[state.davayQuizIndex];
  if(!id) return;
  if(!state.davayQuizAnswers[id]) state.davayQuizAnswers[id] = {};
  const key = state.davayQuizActivePlayer === 1 ? 'p1' : 'p2';
  state.davayQuizAnswers[id][key] = answer;
  state.davayQuizIndex++;
  if(state.davayQuizIndex < state.davayQuizQueue.length){
    saveState();
    updateDavayProgressBar();
    showDavayQuizCurrentCard();
    return;
  }
  // Игрок ответил на все 10 — переходим к следующему шагу. Кто именно
  // закончил первым (игрок 1 или 2), зависит от выбора "Первым начинает" на
  // странице настройки, поэтому нельзя жёстко привязываться к номеру игрока —
  // переходим к итогам только когда оба отмечены как завершившие.
  const finishedPlayer = state.davayQuizActivePlayer;
  if(finishedPlayer === 1) state.davayQuizP1Done = true;
  else state.davayQuizP2Done = true;
  state.davayQuizActivePlayer = 0;
  const otherAlreadyDone = finishedPlayer === 1 ? state.davayQuizP2Done : state.davayQuizP1Done;
  if(!otherAlreadyDone){
    const nextPlayer = finishedPlayer === 1 ? 2 : 1;
    state.davayQuizPendingNext = nextPlayer;
    saveState();
    updateDavayPlayerButtons();
    renderDavayHandoffCard(nextPlayer);
  } else {
    saveState();
    finishDavayQuizSummary();
  }
}
document.getElementById('davayYesBtn').addEventListener('click', ()=>{
  if(cardTransitionLocked) return;
  playSuccessSound();
  answerDavayQuiz('yes');
});
document.getElementById('davayLaterBtn').addEventListener('click', ()=>{
  if(cardTransitionLocked) return;
  answerDavayQuiz('later');
});
document.getElementById('davayNoBtn').addEventListener('click', ()=>{
  if(cardTransitionLocked) return;
  playFailSound();
  answerDavayQuiz('no');
});
document.getElementById('levelUpBtn').addEventListener('click', ()=>{
  // Примечание: этой кнопкой пользуются только Фанты и "Предложи партнеру" —
  // в Видеорулетке и "Давай попробуем" она скрыта CSS (там свои кнопки
  // videoLevelUpBtn/davayLevelUpBtn), поэтому здесь нет веток под эти режимы.
  if(isPlaceholderMode()){
    playLevelUpSound();
    const nextLevel = photoLevel < PHOTO_MAX_LEVEL ? photoLevel + 1 : 1;
    drawPhotoCard(nextLevel);
    showToast(`Уровень: ${nextLevel}`);
    return;
  }
  levelUp();
});
document.getElementById('levelDownBtn').addEventListener('click', ()=>{
  // См. примечание у levelUpBtn — в Видеорулетке/"Давай попробуем" кнопка скрыта.
  if(isPlaceholderMode()){
    playNeutralSound();
    const prevLevel = photoLevel > 1 ? photoLevel - 1 : PHOTO_LEVELS.length;
    drawPhotoCard(prevLevel);
    showToast(`Уровень: ${prevLevel}`);
  }
});
document.getElementById('dislikeBtn').addEventListener('click', ()=>{
  if(isPlaceholderMode()){
    if(!currentPhotoCard) return;
    playErrorSound();
    if(!state.photoHidden) state.photoHidden = [];
    if(!state.photoHidden.includes(photoCardKey(currentPhotoCard))){
      state.photoHidden.push(photoCardKey(currentPhotoCard));
    }
    saveState();
    showToast('Карточка скрыта 🚫');
    drawPhotoCard(photoLevel);
    return;
  }
  if(isVideoMode()){
    if(!currentVideoCard) return;
    playErrorSound();
    if(!state.videoHidden) state.videoHidden = [];
    const vid = videoCardId(currentVideoCard);
    if(!state.videoHidden.includes(vid)){
      state.videoHidden.push(vid);
    }
    saveState();
    showToast('Видео скрыто 🚫');
    drawVideoCard(videoLevel, true);
    return;
  }
  if(isDavayMode()){
    if(!currentDavayCard) return;
    playErrorSound();
    if(!state.davayHidden) state.davayHidden = [];
    const vid = davayCardId(currentDavayCard);
    if(!state.davayHidden.includes(vid)){
      state.davayHidden.push(vid);
    }
    saveState();
    showToast('Видео скрыто 🚫');
    drawDavayCard(davayLevel);
    return;
  }
  dislikeCurrentCard();
});

