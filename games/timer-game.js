// games/timer-game.js — Игра "Таймер-игра" (для двоих).
// Загружается через <script src="games/timer-game.js"></script> в index.html.

/* ---------- 3. ТАЙМЕР-ИГРА ---------- */
let mtLevel = 1; // "mt" = mini-timer-game, чтобы не путать с общим timerInterval карточек
let mtCurrentCard = null;
let mtRemaining = 0;
let mtTotal = 0;
let mtIntervalId = null;
let mtRunning = false;
function getMtCardsList(level){
  if(typeof TIMER_CARDS === 'undefined' || !Array.isArray(TIMER_CARDS)) return [];
  return TIMER_CARDS.filter(c=>c.level===level);
}
function getMtLevelInfo(level){
  if(typeof TIMER_LEVELS === 'undefined' || !Array.isArray(TIMER_LEVELS)) return null;
  return TIMER_LEVELS.find(l=>l.id===level);
}
function renderTimerSetupLevels(){
  const wrap = document.getElementById('timerSetupLevels');
  if(!wrap) return;
  wrap.innerHTML = '';
  (typeof TIMER_LEVELS !== 'undefined' ? TIMER_LEVELS : []).forEach(l=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + (state.timerSelectedLevel === l.id ? ' on' : '');
    div.innerHTML = `<div class="lname">${l.icon} ${l.name}</div><div class="ldesc">${l.seconds} секунд</div><div class="level-check"></div>`;
    div.addEventListener('click', ()=>{
      state.timerSelectedLevel = l.id;
      saveState();
      renderTimerSetupLevels();
    });
    wrap.appendChild(div);
  });
}
function renderTimerModeGroup(){
  document.querySelectorAll('#timerModeGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', btn.dataset.value === (state.timerGameMode || 'fast'));
  });
  // "Быстрая"/"Продолжительная" сами повышают уровень и всегда стартуют
  // с 1-го, а время задания берётся из уровня — эти настройки нужны только
  // в "Пользовательской" и в остальных режимах полностью скрыты (не просто
  // заблокированы), чтобы не перегружать экран настройки.
  const locked = (state.timerGameMode || 'fast') !== 'single';
  const levelsField = document.getElementById('timerLevelsField');
  if(levelsField) levelsField.style.display = locked ? 'none' : '';
  const durationField = document.getElementById('timerDurationField');
  if(durationField) durationField.style.display = locked ? 'none' : '';
  const levelUpField = document.getElementById('timerLevelUpField');
  if(levelUpField) levelUpField.style.display = locked ? 'none' : '';
}
document.querySelectorAll('#timerModeGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.timerGameMode = btn.dataset.value;
    if(state.timerGameMode !== 'single') state.timerSelectedLevel = 1;
    saveState();
    renderTimerModeGroup();
    renderTimerSetupLevels();
  });
});
function renderTimerDurationGroup(){
  document.querySelectorAll('#timerDurationGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (state.timerCustomSeconds || 10));
  });
}
document.querySelectorAll('#timerDurationGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if((state.timerGameMode || 'fast') !== 'single') return;
    state.timerCustomSeconds = parseInt(btn.dataset.value, 10);
    saveState();
    renderTimerDurationGroup();
  });
});
function renderTimerLevelUpGroup(){
  document.querySelectorAll('#timerLevelUpGroup .starter-btn').forEach(btn=>{
    const val = btn.dataset.value === 'manual' ? 'manual' : parseInt(btn.dataset.value, 10);
    btn.classList.toggle('on', val === (state.timerLevelUpCadence || 5));
  });
}
document.querySelectorAll('#timerLevelUpGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if((state.timerGameMode || 'fast') !== 'single') return;
    state.timerLevelUpCadence = btn.dataset.value === 'manual' ? 'manual' : parseInt(btn.dataset.value, 10);
    saveState();
    renderTimerLevelUpGroup();
  });
});
function goToTimerSetup(){
  goToGameSetup('timerSetup', null, ()=>{
    renderTimerModeGroup();
    renderTimerDurationGroup();
    renderTimerLevelUpGroup();
    renderTimerSetupLevels();
  });
}
function exitTimerSetup(){
  document.getElementById('timerSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}
function stopMtInterval(){
  mtIntervalId = stopInterval(mtIntervalId);
  mtRunning = false;
}
function updateMtBar(){
  updateProgressBar('timerBarFill', 'timerLabel', mtRemaining, mtTotal, true);
}
function mtUpdateScoreUI(){
  document.getElementById('timerScore1').textContent = (state.name1 || 'Игрок 1') + ': ' + state.timerScore1;
  document.getElementById('timerScore2').textContent = (state.name2 || 'Игрок 2') + ': ' + state.timerScore2;
}
// Карточка оформлена в стиле "Фантов": полоса сверху по полу текущего
// игрока и шапка с именем хода и уровнем.
function mtCardHeaderHtml(levelInfo){
  const turnName = state.timerCurrentPlayer === 1 ? (state.name1 || 'Игрок 1') : (state.name2 || 'Игрок 2');
  return `
    <div class="card-header">
      <div class="card-turn">
        <div class="card-turn-label">Ход игрока</div>
        <div class="card-turn-name">${turnName}</div>
      </div>
      <div class="badge">
        <span class="level-pill" style="background:${levelInfo ? levelInfo.color : '#ff9a5e'}">${levelInfo ? levelInfo.icon + ' ' + levelInfo.name : '⏱️'}</span>
      </div>
    </div>
  `;
}
function mtDrawCard(){
  stopMtInterval();
  document.getElementById('timerPauseBtn').textContent = '⏸ Пауза';
  const all = getMtCardsList(mtLevel);
  const levelInfo = getMtLevelInfo(mtLevel);
  const gender = state.timerCurrentPlayer === 1 ? 'M' : 'F';
  if(all.length === 0){
    fadeSwapEl('timerCard', (el)=>{
      el.className = 'card';
      el.style.borderTop = `10px solid ${GENDER_COLORS[gender]}`;
      el.innerHTML = `<div class="card-inner">${mtCardHeaderHtml(levelInfo)}<div class="card-body"><div class="card-icon">🃏</div><div class="card-text">Нет заданий для этого уровня</div></div></div>`;
    });
    return;
  }
  if(!state.timerUsed) state.timerUsed = {};
  let used = state.timerUsed[mtLevel] || [];
  let pool = all.filter(c=>!used.includes(c.text));
  if(pool.length === 0){
    pool = all;
    used = [];
    showToast('Задания этого уровня показаны заново 🔀');
  }
  const card = pool[Math.floor(Math.random()*pool.length)];
  used.push(card.text);
  state.timerUsed[mtLevel] = used;
  saveState();
  mtCurrentCard = card;
  // В "Пользовательской" длительность раунда задаётся отдельно (5/10/30/60 сек),
  // в остальных режимах — длительностью самого уровня.
  mtTotal = (state.timerGameMode || 'fast') === 'single'
    ? (state.timerCustomSeconds || 10)
    : (levelInfo ? levelInfo.seconds : 60);
  mtRemaining = mtTotal;
  fadeSwapEl('timerCard', (el)=>{
    el.className = 'card';
    el.style.borderTop = `10px solid ${GENDER_COLORS[gender]}`;
    el.innerHTML = `<div class="card-inner">${mtCardHeaderHtml(levelInfo)}<div class="card-body"><div class="card-text">${card.text}</div></div></div>`;
  });
  updateMtBar();
  document.getElementById('timerStartTaskBtn').style.display = 'flex';
  document.getElementById('timerSkipBtn').style.display = 'flex';
  document.getElementById('timerPauseBtn').style.display = 'none';
  document.getElementById('timerNextBtn').style.display = 'none';
  updateTimerHotterBtnUI();
}
// В режиме "С повышением" уровень растёт автоматически, когда КАЖДЫЙ
// партнёр выполнил (не пропустил) по 5 заданий текущего уровня.
// "Быстрая" и "Продолжительная" повышают уровень сам по себе, когда КАЖДЫЙ
// партнёр выполнил нужное число заданий текущего уровня. У "Продолжительной"
// порог выше (и на начальном уровне ниже, чем на следующих), чтобы партия
// длилась дольше. "Без повышения" порогов не имеет — уровень не меняется.
const TIMER_MODE_LEVELUP_THRESHOLDS = {
  fast: {1:5, 2:5, 3:5},
  long: {1:6, 2:12, 3:12},
};
// В "Пользовательской" повышение уровня настраивается отдельно: "Каждые
// N карточек" — тот же автоматический порог, что и у "Быстрой"/"Продолжительной",
// только число N выбирает игрок; "Вручную" — авто-порога нет вообще, вместо
// этого в игре есть кнопка "🔥 Горячее" (как в Фантах/"Правда или действие") —
// нажатие сразу повышает уровень для обоих, без каких-либо условий.
function isTimerManualMode(){
  return (state.timerGameMode || 'fast') === 'single' && state.timerLevelUpCadence === 'manual';
}
function getTimerLevelUpThreshold(){
  const mode = state.timerGameMode || 'fast';
  if(mode === 'single'){
    if(state.timerLevelUpCadence === 'manual') return null;
    return state.timerLevelUpCadence || 5;
  }
  const table = TIMER_MODE_LEVELUP_THRESHOLDS[mode];
  return table ? (table[mtLevel] || null) : null;
}
function updateTimerHotterBtnUI(){
  const btn = document.getElementById('timerHotterBtn');
  if(!btn) return;
  if(!isTimerManualMode()){
    btn.style.display = 'none';
    return;
  }
  btn.style.display = 'flex';
  btn.disabled = mtLevel >= TIMER_LEVELS.length;
}
// Ручное "Горячее": если партнёры ещё не выполнили поровну карточек текущего
// уровня, повышение откладывается до тех пор, пока отстающий партнёр не
// выполнит своё задание на этом же уровне (см. mtMarkCompleted()).
function mtManualLevelUp(){
  if(mtLevel >= TIMER_LEVELS.length){
    showToast('Это максимальный уровень 🔥');
    return;
  }
  const counts = state.timerLevelUpCounts || {1:0, 2:0};
  // Как и в Фантах/"Правда или действие": нужно равное число выполненных
  // карточек у обоих партнёров, и не меньше одной — иначе сразу после сброса
  // счётчиков можно было бы повысить уровень второй раз подряд без единой
  // выполненной карточки на новом уровне.
  const ready = (counts[1]||0) === (counts[2]||0) && (counts[1]||0) >= 1;
  if(!ready){
    state.timerPendingLevelUp = true;
    saveState();
    showToast('Уровень повысится после хода партнёра');
    return;
  }
  playLevelUpSound();
  mtLevel++;
  state.timerSelectedLevel = mtLevel;
  state.timerLevelUpCounts = {1:0, 2:0};
  state.timerPendingLevelUp = false;
  saveState();
  const info = getMtLevelInfo(mtLevel);
  showToast(`Уровень повышен для обоих: ${info ? info.icon + ' ' + info.name : mtLevel}`);
  mtDrawCard(); // показать новую карточку уже на повышенном уровне
}
function mtMarkCompleted(){
  if(state.timerCurrentPlayer === 1) state.timerScore1++; else state.timerScore2++;
  state.timerCompletedCount = (state.timerCompletedCount||0) + 1;
  let leveledUp = false;
  if(!state.timerLevelUpCounts) state.timerLevelUpCounts = {1:0, 2:0};
  state.timerLevelUpCounts[state.timerCurrentPlayer] = (state.timerLevelUpCounts[state.timerCurrentPlayer]||0) + 1;
  const threshold = getTimerLevelUpThreshold();
  if(threshold){
    const eligible = (state.timerLevelUpCounts[1]||0) >= threshold && (state.timerLevelUpCounts[2]||0) >= threshold && mtLevel < TIMER_LEVELS.length;
    if(eligible){
      mtLevel++;
      state.timerSelectedLevel = mtLevel;
      state.timerLevelUpCounts = {1:0, 2:0};
      leveledUp = true;
    }
  } else if(state.timerPendingLevelUp && (state.timerLevelUpCounts[1]||0) === (state.timerLevelUpCounts[2]||0) && (state.timerLevelUpCounts[1]||0) >= 1 && mtLevel < TIMER_LEVELS.length){
    // Отложенное ручное повышение — партнёры сравнялись по числу карточек текущего уровня.
    mtLevel++;
    state.timerSelectedLevel = mtLevel;
    state.timerLevelUpCounts = {1:0, 2:0};
    state.timerPendingLevelUp = false;
    leveledUp = true;
  }
  saveState();
  mtUpdateScoreUI();
  updateTimerHotterBtnUI();
  return leveledUp;
}
function mtTimeUp(){
  playLevelUpSound();
  const leveledUp = mtMarkCompleted();
  document.getElementById('timerPauseBtn').style.display = 'none';
  document.getElementById('timerHotterBtn').style.display = 'none';
  document.getElementById('timerNextBtn').style.display = 'flex';
  if(leveledUp){
    const info = getMtLevelInfo(mtLevel);
    showToast(`Уровень повышен для обоих: ${info ? info.icon + ' ' + info.name : mtLevel}`);
  } else {
    showToast('Время вышло! ⏱️');
  }
}
function mtTick(){
  mtRemaining--;
  updateMtBar();
  if(mtRemaining <= 0){
    stopMtInterval();
    mtTimeUp();
  }
}
function goToTimerGame(){
  abandonPausedSession('davay');
  abandonPausedSession('td');
  abandonPausedSession('bingo');
  abandonPausedSession('krokodil');
  abandonPausedSession('wishlist');
  abandonPausedSession('znayu');
  abandonPausedSession('soloBs');
  state.pausedMode = null;
  const n1raw = document.getElementById('name1').value.trim();
  const n2raw = document.getElementById('name2').value.trim();
  state.name1 = n1raw || 'Men';
  state.name2 = n2raw || 'Sexy';
  mtLevel = (state.timerGameMode || 'fast') === 'single' ? (state.timerSelectedLevel || 1) : 1;
  state.timerCurrentPlayer = pickStartingPlayerValue('random');
  state.timerScore1 = 0; state.timerScore2 = 0;
  state.timerCompletedCount = 0; state.timerSkippedCount = 0;
  state.timerLevelUpCounts = {1:0, 2:0};
  state.timerPendingLevelUp = false;
  state.inProgress = true;
  saveState();
  goToGame('timerSetup', 'timerGame');
  mtUpdateScoreUI();
  mtDrawCard();
}
function exitTimerGame(){
  stopMtInterval();
  state.timerScore1 = 0; state.timerScore2 = 0;
  state.timerCompletedCount = 0; state.timerSkippedCount = 0;
  state.timerLevelUpCounts = {1:0, 2:0};
  state.timerPendingLevelUp = false;
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  exitGame('timerGame', 'setup');
  updateResumeUI();
}
// Пауза: вернуться в главное меню, не сбрасывая счёт — можно продолжить
// позже через общий блок "Продолжить игру" / "Закончить игру". Текущее
// незавершённое задание при этом абандонится (как в Крокодиле) — при
// возврате показывается новое задание того же уровня, счёт сохранён.
function pauseTimerGame(){
  stopMtInterval();
  state.pausedMode = 'timer';
  saveState();
  document.getElementById('timerGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  updateResumeUI();
}
function resumeTimerGame(){
  state.pausedMode = null;
  saveState();
  updateResumeUI();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('timerGame').classList.add('active');
  mtUpdateScoreUI();
  mtDrawCard();
}
function showTimerSummary(){
  summaryModalMode = 'timer';
  document.getElementById('summaryBonusText').style.display = 'none';
  const winnerEl = document.getElementById('summaryWinner');
  const name1 = state.name1 || 'Игрок 1';
  const name2 = state.name2 || 'Игрок 2';
  if(state.timerScore1 === state.timerScore2){
    winnerEl.textContent = '🤝 Ничья!';
  } else {
    const winnerName = state.timerScore1 > state.timerScore2 ? name1 : name2;
    winnerEl.textContent = `🏆 Победил ${winnerName}`;
  }
  document.getElementById('summaryScore').textContent = `${name1}: ${state.timerScore1}  ·  ${name2}: ${state.timerScore2}`;
  document.getElementById('summaryCounts').textContent = `Выполнено: ${state.timerCompletedCount||0}  ·  Отказов: ${state.timerSkippedCount||0}`;
  showModal('summaryModal');
}
document.getElementById('timerSetupExitBtn').addEventListener('click', exitTimerSetup);
document.getElementById('timerSetupStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  goToTimerGame();
});
document.getElementById('timerStartTaskBtn').addEventListener('click', ()=>{
  playSuccessSound();
  mtRunning = true;
  document.getElementById('timerStartTaskBtn').style.display = 'none';
  document.getElementById('timerSkipBtn').style.display = 'none';
  document.getElementById('timerHotterBtn').style.display = 'none';
  document.getElementById('timerPauseBtn').style.display = 'flex';
  document.getElementById('timerNextBtn').style.display = 'none';
  mtIntervalId = setInterval(mtTick, 1000);
});
document.getElementById('timerSkipBtn').addEventListener('click', ()=>{
  playFailSound();
  state.timerSkippedCount = (state.timerSkippedCount||0) + 1;
  state.timerCurrentPlayer = state.timerCurrentPlayer === 1 ? 2 : 1;
  saveState();
  mtUpdateScoreUI();
  mtDrawCard();
});
document.getElementById('timerHotterBtn').addEventListener('click', ()=>{
  mtManualLevelUp();
});
document.getElementById('timerPauseBtn').addEventListener('click', (e)=>{
  if(mtRunning){
    stopMtInterval();
    e.target.textContent = '▶ Продолжить';
  } else {
    mtRunning = true;
    e.target.textContent = '⏸ Пауза';
    mtIntervalId = setInterval(mtTick, 1000);
  }
});
document.getElementById('timerNextBtn').addEventListener('click', ()=>{
  state.timerCurrentPlayer = state.timerCurrentPlayer === 1 ? 2 : 1;
  saveState();
  mtUpdateScoreUI();
  mtDrawCard();
});
document.getElementById('timerExitBtn').addEventListener('click', ()=>{
  pauseTimerGame();
  showToast('Игра на паузе — прогресс сохранён');
});
(document.getElementById('timerSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ showModal('timerRulesModal'); });
document.getElementById('closeTimerRulesBtn').addEventListener('click', ()=>{ hideModal('timerRulesModal'); });
document.getElementById('timerRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'timerRulesModal') e.currentTarget.classList.remove('show'); });

