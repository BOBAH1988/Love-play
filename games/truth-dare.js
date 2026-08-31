// games/truth-dare.js — Игра "Правда или действие" (для двоих).
// Загружается через <script src="games/truth-dare.js"></script> в index.html.

/* ============================================================ */
/* ====================  НОВЫЕ ИГРЫ (MVP)  ===================== */
/* ============================================================ */

/* ---------- 1. ПРАВДА ИЛИ ДЕЙСТВИЕ ---------- */
let tdLevel = 1;
let tdLocked = false;
let currentTdCard = null;
let currentTdType = null;
function renderTdSetupLevels(){
  const wrap = document.getElementById('tdSetupLevels');
  if(!wrap) return;
  wrap.innerHTML = '';
  LEVELS.forEach(l=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + (state.tdSelectedLevel === l.id ? ' on' : '');
    div.innerHTML = `<div class="lname">${l.icon} ${l.name}</div><div class="ldesc">${l.desc}</div><div class="level-check"></div>`;
    div.addEventListener('click', ()=>{
      state.tdSelectedLevel = l.id;
      saveState();
      renderTdSetupLevels();
    });
    wrap.appendChild(div);
  });
}
function goToTdSetup(){
  goToGameSetup('tdSetup', null, ()=>{
    renderTdSetupLevels();
    updateMuteBtn();
  });
}
function exitTdSetup(){
  document.getElementById('tdSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('twoPlayerView');
}
function tdUpdateScoreUI(){
  document.getElementById('tdScore1').textContent = (state.name1 || 'Игрок 1') + ': ' + state.tdScore1;
  document.getElementById('tdScore2').textContent = (state.name2 || 'Игрок 2') + ': ' + state.tdScore2;
}
// Оформление карточки скопировано со стиля игры "Фанты" (border-top по полу
// игрока, шапка с именем/уровнем, плашка типа карточки) — только без
// встроенного ручного таймера, это отдельная механика, а не стиль.
function tdCardHeaderHtml(){
  const lvl = levelById(tdLevel);
  const turnName = state.tdCurrentPlayer === 1 ? (state.name1 || 'Игрок 1') : (state.name2 || 'Игрок 2');
  return `
    <div class="card-header">
      <div class="card-turn">
        <div class="card-turn-label">Ход игрока</div>
        <div class="card-turn-name">${turnName}</div>
      </div>
      <div class="badge">
        <span class="level-pill" style="background:${lvl.color}">${lvl.icon} ${lvl.name}</span>
      </div>
    </div>
  `;
}
function updateTdLevelBtn(){
  const btn = document.getElementById('tdLevelUpBtn');
  if(!btn) return;
  btn.disabled = tdLevel >= LEVELS.length;
}
function tdShowChoice(){
  updateTdLevelBtn();
  currentTdCard = null;
  currentTdType = null;
  tdLocked = true;
  document.getElementById('tdChoiceRow').style.display = 'flex';
  document.getElementById('tdAnswerRow').style.display = 'none';
  const gender = state.tdCurrentPlayer === 1 ? 'M' : 'F';
  fadeSwapEl('tdCard', (el)=>{
    el.className = 'card';
    el.style.borderTop = `10px solid ${GENDER_COLORS[gender]}`;
    el.innerHTML = `
      <div class="card-inner">
        ${tdCardHeaderHtml()}
        <div class="card-body">
          <div class="card-icon">❓</div>
          <div class="card-text">Выберите «Правда» или «Действие»</div>
        </div>
      </div>
    `;
  }, ()=>{ tdLocked = false; });
}
function tdDraw(type){
  const gender = state.tdCurrentPlayer === 1 ? 'M' : 'F';
  const userCards = (typeof USER_CARDS !== 'undefined' && Array.isArray(USER_CARDS)) ? USER_CARDS : [];
  const hidden = state.tdHidden || [];
  const pool = CARDS.concat(state.customCards || []).concat(userCards)
    .filter(c => !c.deleted && c.level === tdLevel && c.type === type && (!c.for || c.for === gender) && !hidden.includes(c.text));
  if(pool.length === 0){
    playErrorSound();
    showToast('На этом уровне нет карточек этого типа');
    return;
  }
  if(!state.tdUsed) state.tdUsed = {};
  const key = tdLevel + '_' + type;
  let used = state.tdUsed[key] || [];
  let available = pool.filter(c => !used.includes(c.text));
  if(available.length === 0){
    used = [];
    available = pool;
    showToast('Карточки этого уровня показаны заново 🔀');
  }
  const card = available[Math.floor(Math.random() * available.length)];
  used.push(card.text);
  state.tdUsed[key] = used;
  currentTdCard = card;
  currentTdType = type;
  saveState();
  tdLocked = true;
  document.getElementById('tdChoiceRow').style.display = 'none';
  document.getElementById('tdAnswerRow').style.display = 'flex';
  fadeSwapEl('tdCard', (el)=>{
    el.className = 'card';
    el.style.borderTop = `10px solid ${GENDER_COLORS[gender]}`;
    el.innerHTML = `
      <div class="card-inner">
        ${tdCardHeaderHtml()}
        <div class="card-type-row">
          <span class="type-pill">${type === 'truth' ? 'Правда' : 'Действие'}</span>
        </div>
        <div class="card-body">
          <div class="card-text">${card.text}</div>
        </div>
      </div>
    `;
  }, ()=>{ tdLocked = false; });
}
function dislikeTdCard(){
  if(!currentTdCard || !currentTdType) return;
  playErrorSound();
  if(!state.tdHidden) state.tdHidden = [];
  if(!state.tdHidden.includes(currentTdCard.text)){
    state.tdHidden.push(currentTdCard.text);
  }
  saveState();
  showToast('Карточка скрыта навсегда 🚫');
  tdDraw(currentTdType);
}
function tdNextTurn(completed){
  if(completed){
    if(state.tdCurrentPlayer === 1) state.tdScore1++; else state.tdScore2++;
    state.tdCompletedCount = (state.tdCompletedCount||0) + 1;
  } else {
    state.tdSkippedCount = (state.tdSkippedCount||0) + 1;
  }
  if(!state.tdLevelTurnCounts) state.tdLevelTurnCounts = {1:0, 2:0};
  state.tdLevelTurnCounts[state.tdCurrentPlayer] = (state.tdLevelTurnCounts[state.tdCurrentPlayer]||0) + 1;
  state.tdCurrentPlayer = state.tdCurrentPlayer === 1 ? 2 : 1;
  // Если повышение уровня было отложено — как только оба партнёра сыграли
  // поровну карточек текущего уровня, применяем его прямо сейчас.
  if(state.tdPendingLevelUp && (state.tdLevelTurnCounts[1]||0) === (state.tdLevelTurnCounts[2]||0) && (state.tdLevelTurnCounts[1]||0) >= 1){
    state.tdPendingLevelUp = false;
    tdLevel = Math.min(tdLevel + 1, LEVELS.length);
    state.tdSelectedLevel = tdLevel;
    state.tdLevelTurnCounts = {1:0, 2:0};
    playLevelUpSound();
    showToast(`Уровень повышен для обоих: ${tdLevel}`);
  }
  saveState();
  tdUpdateScoreUI();
  tdShowChoice();
}
function goToTdGame(){
  abandonPausedSession('davay');
  abandonPausedSession('bingo');
  abandonPausedSession('krokodil');
  abandonPausedSession('wishlist');
  abandonPausedSession('znayu');
  abandonPausedSession('timer');
  abandonPausedSession('partyFants');
  abandonPausedSession('partyTd');
  abandonPausedSession('famZnayu');
  abandonPausedSession('lucky');
  abandonPausedSession('fanty');
  abandonPausedSession('soloBs');
  state.pausedMode = null;
  const n1raw = document.getElementById('name1').value.trim();
  const n2raw = document.getElementById('name2').value.trim();
  state.name1 = n1raw || 'Men';
  state.name2 = n2raw || 'Sexy';
  tdLevel = state.tdSelectedLevel || 1;
  state.tdCurrentPlayer = pickStartingPlayerValue('random');
  state.tdScore1 = 0; state.tdScore2 = 0;
  state.tdCompletedCount = 0; state.tdSkippedCount = 0;
  state.tdLevelTurnCounts = {1:0, 2:0}; state.tdPendingLevelUp = false;
  state.inProgress = true;
  saveState();
  goToGame('tdSetup', 'tdGame');
  tdUpdateScoreUI();
  tdShowChoice();
}
// Пауза: вернуться в главное меню, не сбрасывая счёт — можно продолжить позже
// через общий блок "Продолжить игру" / "Закончить игру".
function pauseTdGame(){
  state.pausedMode = 'td';
  saveState();
  document.getElementById('tdGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('twoPlayerView');
  updateResumeUI();
}
function resumeTdGame(){
  state.pausedMode = null;
  saveState();
  updateResumeUI();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('tdGame').classList.add('active');
  tdUpdateScoreUI();
  tdShowChoice();
}
function finishTdGame(){
  state.tdScore1 = 0; state.tdScore2 = 0;
  state.tdCompletedCount = 0; state.tdSkippedCount = 0;
  state.tdLevelTurnCounts = {1:0, 2:0}; state.tdPendingLevelUp = false;
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  updateResumeUI();
}
function showTdSummary(){
  summaryModalMode = 'td';
  document.getElementById('summaryBonusText').style.display = 'none';
  const winnerEl = document.getElementById('summaryWinner');
  const name1 = state.name1 || 'Игрок 1';
  const name2 = state.name2 || 'Игрок 2';
  if(state.tdScore1 === state.tdScore2){
    winnerEl.textContent = '🤝 Ничья!';
  } else {
    const winnerName = state.tdScore1 > state.tdScore2 ? name1 : name2;
    winnerEl.textContent = `🏆 Победил ${winnerName}`;
  }
  document.getElementById('summaryScore').textContent = `${name1}: ${state.tdScore1}  ·  ${name2}: ${state.tdScore2}`;
  document.getElementById('summaryCounts').textContent = `Выполнено: ${state.tdCompletedCount||0}  ·  Отказов: ${state.tdSkippedCount||0}`;
  showModal('summaryModal');
}
// Повышение уровня в "Правда или действие" тоже откладывается, пока оба
// партнёра не сыграют поровну карточек текущего уровня (см. tdNextTurn()).
function tdChangeLevel(delta){
  const newLevel = tdLevel + delta;
  if(newLevel < 1 || newLevel > LEVELS.length){
    showToast(delta > 0 ? 'Это максимальный уровень 🔥' : 'Это минимальный уровень');
    return;
  }
  if(delta > 0){
    const counts = state.tdLevelTurnCounts || {1:0, 2:0};
    // Как и в Фантах: нужно равное количество карточек у обоих партнёров,
    // и не меньше одной — иначе можно было бы повышать уровень второй раз
    // подряд сразу после сброса счётчиков.
    const ready = (counts[1]||0) === (counts[2]||0) && (counts[1]||0) >= 1;
    if(!ready){
      state.tdPendingLevelUp = true;
      saveState();
      showToast('Уровень повысится после хода партнёра');
      return;
    }
  }
  tdLevel = newLevel;
  state.tdSelectedLevel = tdLevel;
  if(delta > 0){
    state.tdLevelTurnCounts = {1:0, 2:0};
    state.tdPendingLevelUp = false;
  }
  saveState();
  if(delta > 0) playLevelUpSound(); else playNeutralSound();
  showToast(delta > 0 ? `Уровень повышен: ${tdLevel}` : `Уровень понижен: ${tdLevel}`);
  tdShowChoice();
}
document.getElementById('tdSetupExitBtn').addEventListener('click', exitTdSetup);
document.getElementById('tdSetupStartBtn').addEventListener('click', ()=>{
  const level = state.tdSelectedLevel || 1;
  const hasTruth = CARDS.some(c=>c.level===level && c.type==='truth');
  const hasDare = CARDS.some(c=>c.level===level && c.type==='dare');
  if(!hasTruth || !hasDare){
    playErrorSound();
    showToast('На этом уровне не хватает карточек для игры');
    return;
  }
  playSuccessSound();
  goToTdGame();
});
document.getElementById('tdTruthBtn').addEventListener('click', ()=>{ if(tdLocked) return; playNeutralSound(); tdDraw('truth'); });
document.getElementById('tdDareBtn').addEventListener('click', ()=>{ if(tdLocked) return; playNeutralSound(); tdDraw('dare'); });
document.getElementById('tdDoneBtn').addEventListener('click', ()=>{ if(tdLocked) return; playSuccessSound(); tdNextTurn(true); });
document.getElementById('tdSkipBtn').addEventListener('click', ()=>{ if(tdLocked) return; playFailSound(); tdNextTurn(false); });
document.getElementById('tdLevelUpBtn').addEventListener('click', ()=>{ if(tdLocked) return; tdChangeLevel(1); });
document.getElementById('tdPauseBtn').addEventListener('click', ()=>{
  playSuccessSound();
  pauseTdGame();
});
(document.getElementById('tdSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ showModal('tdRulesModal'); });
document.getElementById('closeTdRulesBtn').addEventListener('click', ()=>{ hideModal('tdRulesModal'); });
document.getElementById('tdRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'tdRulesModal') e.currentTarget.classList.remove('show'); });

