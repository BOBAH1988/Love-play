// games/party-td.js — Игра "Правда/Действие" (компания).
// Загружается через <script src="games/party-td.js"></script> в index.html.

/* ---------- ПРАВДА/ДЕЙСТВИЕ (КОМПАНИЯ): выбор Правда или Действие, по очереди ---------- */
// Игра открытая, без фиксированного конца — тот же принцип, что и у "Фантов"
// (компания): счёт виден всё время, партия завершается только по кнопке
// "Закончить игру" из паузы.
function getPartyTdCardsList(level, type){
  if(typeof PARTY_TD_CARDS === 'undefined' || !Array.isArray(PARTY_TD_CARDS)) return [];
  return PARTY_TD_CARDS.filter(c=>c.level===level && c.type===type);
}
function renderPartyTdSetupLevels(){
  const wrap = document.getElementById('partyTdSetupLevels');
  if(!wrap) return;
  wrap.innerHTML = '';
  (typeof PARTY_TD_LEVELS !== 'undefined' ? PARTY_TD_LEVELS : []).forEach(l=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + (state.partyTdSelectedLevel === l.id ? ' on' : '');
    div.innerHTML = `<div class="lname">${l.icon} ${l.name}</div><div class="ldesc">${l.desc}</div><div class="level-check"></div>`;
    div.addEventListener('click', ()=>{
      state.partyTdSelectedLevel = l.id;
      saveState();
      renderPartyTdSetupLevels();
    });
    wrap.appendChild(div);
  });
}
function goToPartyTdSetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('partyTdSetup').classList.add('active');
  renderPartyTdSetupLevels();
}
function exitPartyTdSetup(){
  document.getElementById('partyTdSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('companyView');
}
function updatePartyTdScoreUI(){
  const players = state.partyPlayers || ['Игрок 1','Игрок 2'];
  const completed = state.partyTdCompleted || [];
  const idx = state.partyTdCurrentPlayerIndex || 0;
  const wrap = document.getElementById('partyTdScoreRow');
  if(wrap){
    wrap.innerHTML = '';
    players.forEach((name, i)=>{
      const span = document.createElement('span');
      span.className = 'krokodil-score-item' + (i === idx ? ' active' : '');
      span.textContent = name + ': ' + (completed[i] || 0);
      wrap.appendChild(span);
    });
  }
  const turnName = players[idx] || 'Игрок 1';
  const turnLabel = document.getElementById('partyTdTurnLabel');
  if(turnLabel) turnLabel.textContent = 'Выбирает: ' + turnName;
  // Пока игрок не выбрал Правду или Действие — видны только кнопки выбора,
  // карточка и "Выполнено"/"Отказ" скрыты (и наоборот, когда карточка уже
  // показана — кнопки выбора скрываются, чтобы не путать с новым ходом).
  const choiceRow = document.getElementById('partyTdChoiceRow');
  const choicePauseRow = document.getElementById('partyTdChoicePauseRow');
  const cardArea = document.getElementById('partyTdCardArea');
  const actionsRow = document.getElementById('partyTdActionsRow');
  const hasChoice = !!state.partyTdCurrentType;
  if(choiceRow) choiceRow.style.display = hasChoice ? 'none' : '';
  if(choicePauseRow) choicePauseRow.style.display = hasChoice ? 'none' : '';
  if(cardArea) cardArea.style.display = hasChoice ? '' : 'none';
  if(actionsRow) actionsRow.style.display = hasChoice ? '' : 'none';
}
// Карточка тянется без повторов внутри уровня+типа (Правда/Действие
// считаются отдельными пулами), пока пул не закончится — тот же принцип,
// что и во всех остальных играх приложения.
function drawPartyTdCard(type){
  const level = state.partyTdSelectedLevel || 1;
  state.partyTdCurrentType = type;
  const all = getPartyTdCardsList(level, type);
  const badge = document.getElementById('partyTdCardBadge');
  if(badge) badge.textContent = type === 'truth' ? '🗣️ Правда' : '🎭 Действие';
  if(all.length === 0){
    fadeSwapEl('partyTdCard', (el)=>{
      el.className = 'card';
      el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="partytd-type-badge">${type === 'truth' ? '🗣️ Правда' : '🎭 Действие'}</div><div class="card-text partytd-text">Нет карточек для этого уровня</div></div></div>`;
    });
    saveState();
    updatePartyTdScoreUI();
    return;
  }
  if(!state.partyTdUsed) state.partyTdUsed = {};
  const usedKey = level + '-' + type;
  let used = state.partyTdUsed[usedKey] || [];
  let pool = all.filter(c=>!used.includes(c.text));
  if(pool.length === 0){
    pool = all;
    used = [];
    showToast('Карточки этого типа показаны заново 🔀');
  }
  const card = pool[Math.floor(Math.random()*pool.length)];
  used.push(card.text);
  state.partyTdUsed[usedKey] = used;
  saveState();
  updatePartyTdScoreUI();
  fadeSwapEl('partyTdCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="partytd-type-badge">${type === 'truth' ? '🗣️ Правда' : '🎭 Действие'}</div><div class="card-text partytd-text">${card.text}</div></div></div>`;
  });
}
function partyTdNextTurn(){
  const n = (state.partyPlayers || []).length || 1;
  state.partyTdCurrentPlayerIndex = ((state.partyTdCurrentPlayerIndex || 0) + 1) % n;
  state.partyTdCurrentType = null;
  saveState();
  updatePartyTdScoreUI();
}
function goToPartyTdGame(){
  abandonPausedDavaySession();
  abandonPausedTdSession();
  abandonPausedBingoSession();
  abandonPausedKrokodilSession();
  abandonPausedWishlistSession();
  abandonPausedZnayuSession();
  abandonPausedTimerSession();
  abandonPausedPartyFantsSession();
  abandonPausedFamZnayuSession();
  abandonPausedLuckySession();
  abandonPausedFantySession();
  abandonPausedSoloBsSession();
  state.pausedMode = null;
  if(!state.partyPlayers || state.partyPlayers.length < 2){
    state.partyPlayers = ['Игрок 1','Игрок 2'];
  }
  const n = state.partyPlayers.length;
  state.partyTdCompleted = new Array(n).fill(0);
  state.partyTdSkipped = new Array(n).fill(0);
  state.partyTdCurrentPlayerIndex = Math.floor(Math.random() * n);
  state.partyTdCurrentType = null;
  state.inProgress = true;
  saveState();
  document.getElementById('partyTdSetup').classList.remove('active');
  document.getElementById('setup').classList.remove('active');
  document.getElementById('partyTdGame').classList.add('active');
  updatePartyTdScoreUI();
}
// Пауза: вернуться в главное меню, не сбрасывая счёт и очередь — можно
// продолжить позже через общий блок "Продолжить игру" / "Закончить игру".
function pausePartyTdGame(){
  state.pausedMode = 'partyTd';
  saveState();
  document.getElementById('partyTdGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('companyView');
  updateResumeUI();
}
function resumePartyTdGame(){
  state.pausedMode = null;
  saveState();
  updateResumeUI();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('partyTdGame').classList.add('active');
  updatePartyTdScoreUI();
}
// Итоговое окно результатов — то же оформление, что у Фантов/Крокодила.
function showPartyTdSummaryModal(){
  const players = state.partyPlayers || ['Игрок 1','Игрок 2'];
  const completed = state.partyTdCompleted || [];
  const skipped = state.partyTdSkipped || [];
  const ranking = players.map((n,i)=>({n, score: completed[i] || 0, skipped: skipped[i] || 0}))
    .sort((a,b)=>b.score-a.score);
  const medals = ['🥇','🥈','🥉'];
  const listHtml = ranking.map((r,i)=>{
    const place = medals[i] || `${i+1}.`;
    const isFirst = i === 0;
    return `
      <div class="krokodil-summary-row${isFirst ? ' krokodil-summary-first' : ''}">
        <span class="krokodil-summary-place">${place}</span>
        <span class="krokodil-summary-name">${r.n}</span>
        <span class="krokodil-summary-score">Выполнено: ${r.score} · Отказов: ${r.skipped}</span>
      </div>
    `;
  }).join('');
  document.getElementById('partyTdSummaryList').innerHTML = listHtml;
  document.getElementById('partyTdSummaryModal').classList.add('show');
}
function finishPartyTdGame(){
  document.getElementById('pauseMenuModal').classList.remove('show');
  showPartyTdSummaryModal();
}
// Полный выход из партии (по кнопке "Завершить игру" на итоговом экране) —
// сбрасывает счёт и очередь, закрывает модалку итогов.
function exitPartyTdGame(){
  document.getElementById('partyTdSummaryModal').classList.remove('show');
  state.partyTdCompleted = [];
  state.partyTdSkipped = [];
  state.partyTdCurrentPlayerIndex = 0;
  state.partyTdCurrentType = null;
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  updateResumeUI();
}
document.getElementById('partyTdSetupStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  goToPartyTdGame();
});
document.getElementById('partyTdSetupExitBtn').addEventListener('click', ()=>{ exitPartyTdSetup(); });
document.getElementById('partyTdTruthBtn').addEventListener('click', ()=>{
  playSuccessSound();
  drawPartyTdCard('truth');
});
document.getElementById('partyTdDareBtn').addEventListener('click', ()=>{
  playSuccessSound();
  drawPartyTdCard('dare');
});
document.getElementById('partyTdDoneBtn').addEventListener('click', ()=>{
  playSuccessSound();
  const idx = state.partyTdCurrentPlayerIndex || 0;
  if(!state.partyTdCompleted) state.partyTdCompleted = [];
  state.partyTdCompleted[idx] = (state.partyTdCompleted[idx] || 0) + 1;
  saveState();
  partyTdNextTurn();
});
document.getElementById('partyTdSkipBtn').addEventListener('click', ()=>{
  playFailSound();
  const idx = state.partyTdCurrentPlayerIndex || 0;
  if(!state.partyTdSkipped) state.partyTdSkipped = [];
  state.partyTdSkipped[idx] = (state.partyTdSkipped[idx] || 0) + 1;
  saveState();
  partyTdNextTurn();
});
document.getElementById('partyTdExitBtn').addEventListener('click', ()=>{
  pausePartyTdGame();
  showToast('Игра на паузе — прогресс сохранён');
});
document.getElementById('partyTdChoiceExitBtn').addEventListener('click', ()=>{
  pausePartyTdGame();
  showToast('Игра на паузе — прогресс сохранён');
});
(document.getElementById('partyTdSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ document.getElementById('partyTdRulesModal').classList.add('show'); });
document.getElementById('closePartyTdRulesBtn').addEventListener('click', ()=>{ document.getElementById('partyTdRulesModal').classList.remove('show'); });
document.getElementById('partyTdRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'partyTdRulesModal') e.currentTarget.classList.remove('show'); });
document.getElementById('closePartyTdSummaryBtn').addEventListener('click', ()=>{ exitPartyTdGame(); });

