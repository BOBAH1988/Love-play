// games/party-fants.js — Игра "Фанты" (компания).
// Загружается через <script src="games/party-fants.js"></script> в index.html.

/* ---------- ФАНТЫ (КОМПАНИЯ): по очереди тянут карточки-задания ---------- */
// Игра открытая, без фиксированного конца (как couples-версия "Фанты") —
// счёт по каждому игроку виден всё время вверху экрана, партия завершается,
// только когда игрок сам нажимает "Закончить игру" из паузы.
function getPartyFantsCardsList(level){
  if(typeof PARTY_FANTS_CARDS === 'undefined' || !Array.isArray(PARTY_FANTS_CARDS)) return [];
  return PARTY_FANTS_CARDS.filter(c=>c.level===level);
}
function renderPartyFantsSetupLevels(){
  const wrap = document.getElementById('partyFantsSetupLevels');
  if(!wrap) return;
  wrap.innerHTML = '';
  (typeof PARTY_FANTS_LEVELS !== 'undefined' ? PARTY_FANTS_LEVELS : []).forEach(l=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + (state.partyFantsSelectedLevel === l.id ? ' on' : '');
    div.innerHTML = `<div class="lname">${l.icon} ${l.name}</div><div class="ldesc">${l.desc}</div><div class="level-check"></div>`;
    div.addEventListener('click', ()=>{
      state.partyFantsSelectedLevel = l.id;
      saveState();
      renderPartyFantsSetupLevels();
    });
    wrap.appendChild(div);
  });
}
function goToPartyFantsSetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('partyFantsSetup').classList.add('active');
  renderPartyFantsSetupLevels();
}
function exitPartyFantsSetup(){
  document.getElementById('partyFantsSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}
function updatePartyFantsScoreUI(){
  const players = state.partyPlayers || ['Игрок 1','Игрок 2'];
  const completed = state.partyFantsCompleted || [];
  const idx = state.partyFantsCurrentPlayerIndex || 0;
  const wrap = document.getElementById('partyFantsScoreRow');
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
  const turnLabel = document.getElementById('partyFantsTurnLabel');
  if(turnLabel) turnLabel.textContent = 'Тянет: ' + turnName;
}
// Задание тянется без повторов внутри уровня, пока пул не закончится — тот
// же принцип, что и во всех остальных играх приложения.
function drawPartyFantsCard(){
  const level = state.partyFantsSelectedLevel || 1;
  const all = getPartyFantsCardsList(level);
  if(all.length === 0){
    fadeSwapEl('partyFantsCard', (el)=>{
      el.className = 'card';
      el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-text partyfants-text">Нет заданий для этого уровня</div></div></div>`;
    });
    return;
  }
  if(!state.partyFantsUsed) state.partyFantsUsed = {};
  let used = state.partyFantsUsed[level] || [];
  let pool = all.filter(c=>!used.includes(c.text));
  if(pool.length === 0){
    pool = all;
    used = [];
    showToast('Задания этого уровня показаны заново 🔀');
  }
  const card = pool[Math.floor(Math.random()*pool.length)];
  used.push(card.text);
  state.partyFantsUsed[level] = used;
  saveState();
  fadeSwapEl('partyFantsCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-text partyfants-text">${card.text}</div></div></div>`;
  });
}
function partyFantsNextTurn(){
  const n = (state.partyPlayers || []).length || 1;
  state.partyFantsCurrentPlayerIndex = ((state.partyFantsCurrentPlayerIndex || 0) + 1) % n;
  saveState();
  updatePartyFantsScoreUI();
  drawPartyFantsCard();
}
function goToPartyFantsGame(){
  abandonPausedDavaySession();
  abandonPausedTdSession();
  abandonPausedBingoSession();
  abandonPausedKrokodilSession();
  abandonPausedWishlistSession();
  abandonPausedZnayuSession();
  abandonPausedTimerSession();
  abandonPausedPartyTdSession();
  abandonPausedFamZnayuSession();
  abandonPausedLuckySession();
  abandonPausedFantySession();
  abandonPausedSoloBsSession();
  state.pausedMode = null;
  if(!state.partyPlayers || state.partyPlayers.length < 2){
    state.partyPlayers = ['Игрок 1','Игрок 2'];
  }
  const n = state.partyPlayers.length;
  state.partyFantsCompleted = new Array(n).fill(0);
  state.partyFantsSkipped = new Array(n).fill(0);
  state.partyFantsCurrentPlayerIndex = Math.floor(Math.random() * n);
  state.inProgress = true;
  saveState();
  document.getElementById('partyFantsSetup').classList.remove('active');
  document.getElementById('setup').classList.remove('active');
  document.getElementById('partyFantsGame').classList.add('active');
  updatePartyFantsScoreUI();
  drawPartyFantsCard();
}
// Пауза: вернуться в главное меню, не сбрасывая счёт и очередь — можно
// продолжить позже через общий блок "Продолжить игру" / "Закончить игру".
function pausePartyFantsGame(){
  state.pausedMode = 'partyFants';
  saveState();
  document.getElementById('partyFantsGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  updateResumeUI();
}
function resumePartyFantsGame(){
  state.pausedMode = null;
  saveState();
  updateResumeUI();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('partyFantsGame').classList.add('active');
  updatePartyFantsScoreUI();
}
// Итоговое окно результатов — место, имя, выполнено/отказов по каждому
// игроку, отсортировано по убыванию счёта (как в Крокодиле и Знаю тебя).
function showPartyFantsSummaryModal(){
  const players = state.partyPlayers || ['Игрок 1','Игрок 2'];
  const completed = state.partyFantsCompleted || [];
  const skipped = state.partyFantsSkipped || [];
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
  document.getElementById('partyFantsSummaryList').innerHTML = listHtml;
  document.getElementById('partyFantsSummaryModal').classList.add('show');
}
function finishPartyFantsGame(){
  document.getElementById('pauseMenuModal').classList.remove('show');
  showPartyFantsSummaryModal();
}
// Полный выход из партии (по кнопке "Завершить игру" на итоговом экране) —
// сбрасывает счёт и очередь, закрывает модалку итогов.
function exitPartyFantsGame(){
  document.getElementById('partyFantsSummaryModal').classList.remove('show');
  state.partyFantsCompleted = [];
  state.partyFantsSkipped = [];
  state.partyFantsCurrentPlayerIndex = 0;
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  updateResumeUI();
}
document.getElementById('partyFantsSetupStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  goToPartyFantsGame();
});
document.getElementById('partyFantsSetupExitBtn').addEventListener('click', ()=>{ exitPartyFantsSetup(); });
document.getElementById('partyFantsDoneBtn').addEventListener('click', ()=>{
  playSuccessSound();
  const idx = state.partyFantsCurrentPlayerIndex || 0;
  if(!state.partyFantsCompleted) state.partyFantsCompleted = [];
  state.partyFantsCompleted[idx] = (state.partyFantsCompleted[idx] || 0) + 1;
  saveState();
  partyFantsNextTurn();
});
document.getElementById('partyFantsSkipBtn').addEventListener('click', ()=>{
  playFailSound();
  const idx = state.partyFantsCurrentPlayerIndex || 0;
  if(!state.partyFantsSkipped) state.partyFantsSkipped = [];
  state.partyFantsSkipped[idx] = (state.partyFantsSkipped[idx] || 0) + 1;
  saveState();
  partyFantsNextTurn();
});
document.getElementById('partyFantsExitBtn').addEventListener('click', ()=>{
  pausePartyFantsGame();
  showToast('Игра на паузе — прогресс сохранён');
});
(document.getElementById('partyFantsSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ document.getElementById('partyFantsRulesModal').classList.add('show'); });
document.getElementById('closePartyFantsRulesBtn').addEventListener('click', ()=>{ document.getElementById('partyFantsRulesModal').classList.remove('show'); });
document.getElementById('partyFantsRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'partyFantsRulesModal') e.currentTarget.classList.remove('show'); });
document.getElementById('closePartyFantsSummaryBtn').addEventListener('click', ()=>{ exitPartyFantsGame(); });

