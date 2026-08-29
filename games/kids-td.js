// games/kids-td.js — Игра "Правда/Действие" (дети).
// Загружается через <script src="games/kids-td.js"></script> в index.html.
// Тот же принцип, что и games/party-td.js (открытая игра без фиксированного
// конца, счёт виден всё время), только уровень заданий не выбирается на
// отдельном экране настройки, а берётся из общего переключателя возраста
// #kidsAgeGroup на экране "Игры с детьми" (state.kidsAge, 1..4 = 5/7/10/14 лет).

/* ---------- ПРАВДА/ДЕЙСТВИЕ (ДЕТИ): выбор Правда или Действие, по очереди ---------- */
function getKidsTdCardsList(level, type){
  if(typeof KIDS_TD_CARDS === 'undefined' || !Array.isArray(KIDS_TD_CARDS)) return [];
  return KIDS_TD_CARDS.filter(c=>c.level===level && c.type===type);
}
// Инфо о текущем возрасте (иконка/название/описание) — для подписи на экране
// настройки, тот же паттерн, что KIDS_MEMORY_LEVELS.find(...) в kids-memory.js.
function kidsTdAgeInfo(){
  const age = state.kidsAge || 1;
  const levels = typeof KIDS_TD_LEVELS !== 'undefined' ? KIDS_TD_LEVELS : [];
  return levels.find(l=>l.id===age) || null;
}
function updateKidsTdSetupSubtitle(){
  const el = document.getElementById('kidsTdSetupSubtitle');
  if(!el) return;
  const info = kidsTdAgeInfo();
  el.textContent = info
    ? `Возраст: ${info.icon} ${info.name} — вопросы и задания подобраны для этого возраста`
    : 'Выбирайте Правду или Действие по очереди';
}
function goToKidsTdSetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('kidsTdSetup').classList.add('active');
  updateKidsTdSetupSubtitle();
}
function exitKidsTdSetup(){
  document.getElementById('kidsTdSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}
function updateKidsTdScoreUI(){
  const players = state.kidsPlayers || ['Игрок 1','Игрок 2'];
  const completed = state.kidsTdCompleted || [];
  const idx = state.kidsTdCurrentPlayerIndex || 0;
  const wrap = document.getElementById('kidsTdScoreRow');
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
  const turnLabel = document.getElementById('kidsTdTurnLabel');
  if(turnLabel) turnLabel.textContent = 'Выбирает: ' + turnName;
  // Пока игрок не выбрал Правду или Действие — видны только кнопки выбора,
  // карточка и "Выполнено"/"Отказ" скрыты (и наоборот) — та же логика, что в
  // party-td.js.
  const choiceRow = document.getElementById('kidsTdChoiceRow');
  const choicePauseRow = document.getElementById('kidsTdChoicePauseRow');
  const cardArea = document.getElementById('kidsTdCardArea');
  const actionsRow = document.getElementById('kidsTdActionsRow');
  const hasChoice = !!state.kidsTdCurrentType;
  if(choiceRow) choiceRow.style.display = hasChoice ? 'none' : '';
  if(choicePauseRow) choicePauseRow.style.display = hasChoice ? 'none' : '';
  if(cardArea) cardArea.style.display = hasChoice ? '' : 'none';
  if(actionsRow) actionsRow.style.display = hasChoice ? '' : 'none';
}
// Карточка тянется без повторов внутри уровня+типа (Правда/Действие —
// отдельные пулы), пока пул не закончится — тот же принцип, что и во всех
// остальных играх приложения (см. drawPartyTdCard).
function drawKidsTdCard(type){
  const level = state.kidsAge || 1;
  state.kidsTdCurrentType = type;
  const all = getKidsTdCardsList(level, type);
  const badge = document.getElementById('kidsTdCardBadge');
  if(badge) badge.textContent = type === 'truth' ? '🗣️ Правда' : '🎭 Действие';
  if(all.length === 0){
    fadeSwapEl('kidsTdCard', (el)=>{
      el.className = 'card';
      el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="partytd-type-badge">${type === 'truth' ? '🗣️ Правда' : '🎭 Действие'}</div><div class="card-text partytd-text">Нет карточек для этого возраста</div></div></div>`;
    });
    saveState();
    updateKidsTdScoreUI();
    return;
  }
  if(!state.kidsTdUsed) state.kidsTdUsed = {};
  const usedKey = level + '-' + type;
  let used = state.kidsTdUsed[usedKey] || [];
  let pool = all.filter(c=>!used.includes(c.text));
  if(pool.length === 0){
    pool = all;
    used = [];
    showToast('Карточки этого типа показаны заново 🔀');
  }
  const card = pool[Math.floor(Math.random()*pool.length)];
  used.push(card.text);
  state.kidsTdUsed[usedKey] = used;
  saveState();
  updateKidsTdScoreUI();
  fadeSwapEl('kidsTdCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="partytd-type-badge">${type === 'truth' ? '🗣️ Правда' : '🎭 Действие'}</div><div class="card-text partytd-text">${card.text}</div></div></div>`;
  });
}
function kidsTdNextTurn(){
  const n = (state.kidsPlayers || []).length || 1;
  state.kidsTdCurrentPlayerIndex = ((state.kidsTdCurrentPlayerIndex || 0) + 1) % n;
  state.kidsTdCurrentType = null;
  saveState();
  updateKidsTdScoreUI();
}
function goToKidsTdGame(){
  abandonPausedDavaySession();
  abandonPausedTdSession();
  abandonPausedBingoSession();
  abandonPausedKrokodilSession();
  abandonPausedWishlistSession();
  abandonPausedZnayuSession();
  abandonPausedTimerSession();
  abandonPausedPartyFantsSession();
  abandonPausedPartyTdSession();
  abandonPausedFamZnayuSession();
  abandonPausedLuckySession();
  abandonPausedFantySession();
  abandonPausedKidsMemorySession();
  abandonPausedSoloBsSession();
  state.pausedMode = null;
  if(!state.kidsPlayers || state.kidsPlayers.length < 2){
    state.kidsPlayers = ['Игрок 1','Игрок 2'];
  }
  const n = state.kidsPlayers.length;
  state.kidsTdCompleted = new Array(n).fill(0);
  state.kidsTdSkipped = new Array(n).fill(0);
  state.kidsTdCurrentPlayerIndex = Math.floor(Math.random() * n);
  state.kidsTdCurrentType = null;
  state.inProgress = true;
  saveState();
  document.getElementById('kidsTdSetup').classList.remove('active');
  document.getElementById('setup').classList.remove('active');
  document.getElementById('kidsTdGame').classList.add('active');
  updateKidsTdScoreUI();
}
// Пауза: вернуться в главное меню, не сбрасывая счёт и очередь — можно
// продолжить позже через общий блок "Продолжить игру" / "Закончить игру".
function pauseKidsTdGame(){
  state.pausedMode = 'kidsTd';
  saveState();
  document.getElementById('kidsTdGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  updateResumeUI();
}
function resumeKidsTdGame(){
  state.pausedMode = null;
  saveState();
  updateResumeUI();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('kidsTdGame').classList.add('active');
  updateKidsTdScoreUI();
}
// Итоговое окно результатов — та же вёрстка, что showPartyTdSummaryModal, но
// с учётом ничьих (как в showKidsMemorySummaryModal): игроки с одинаковым
// числом выполненных заданий делят одно место (1-2-2-4, а не 1-2-2-3).
function showKidsTdSummaryModal(){
  const players = state.kidsPlayers || ['Игрок 1','Игрок 2'];
  const completed = state.kidsTdCompleted || [];
  const skipped = state.kidsTdSkipped || [];
  const ranking = players.map((n,i)=>({n, score: completed[i] || 0, skipped: skipped[i] || 0}))
    .sort((a,b)=>b.score-a.score);
  const medals = ['🥇','🥈','🥉'];
  let place = 1;
  const listHtml = ranking.map((r,i)=>{
    if(i === 0 || ranking[i-1].score !== r.score){
      place = i + 1;
    }
    const placeLabel = medals[place-1] || `${place}.`;
    const isFirst = place === 1;
    return `
      <div class="krokodil-summary-row${isFirst ? ' krokodil-summary-first' : ''}">
        <span class="krokodil-summary-place">${placeLabel}</span>
        <span class="krokodil-summary-name">${r.n}</span>
        <span class="krokodil-summary-score">Выполнено: ${r.score} · Отказов: ${r.skipped}</span>
      </div>
    `;
  }).join('');
  document.getElementById('kidsTdSummaryList').innerHTML = listHtml;
  document.getElementById('kidsTdSummaryModal').classList.add('show');
}
function finishKidsTdGame(){
  document.getElementById('pauseMenuModal').classList.remove('show');
  showKidsTdSummaryModal();
}
// Полный выход из партии (по кнопке "Завершить игру" на итоговом экране) —
// сбрасывает счёт и очередь, закрывает модалку итогов.
function exitKidsTdGame(){
  document.getElementById('kidsTdSummaryModal').classList.remove('show');
  state.kidsTdCompleted = [];
  state.kidsTdSkipped = [];
  state.kidsTdCurrentPlayerIndex = 0;
  state.kidsTdCurrentType = null;
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  updateResumeUI();
}
document.getElementById('kidsTdSetupStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  goToKidsTdGame();
});
document.getElementById('kidsTdSetupExitBtn').addEventListener('click', ()=>{ exitKidsTdSetup(); });
document.getElementById('kidsTdTruthBtn').addEventListener('click', ()=>{
  playSuccessSound();
  drawKidsTdCard('truth');
});
document.getElementById('kidsTdDareBtn').addEventListener('click', ()=>{
  playSuccessSound();
  drawKidsTdCard('dare');
});
document.getElementById('kidsTdDoneBtn').addEventListener('click', ()=>{
  playSuccessSound();
  const idx = state.kidsTdCurrentPlayerIndex || 0;
  if(!state.kidsTdCompleted) state.kidsTdCompleted = [];
  state.kidsTdCompleted[idx] = (state.kidsTdCompleted[idx] || 0) + 1;
  saveState();
  kidsTdNextTurn();
});
document.getElementById('kidsTdSkipBtn').addEventListener('click', ()=>{
  playFailSound();
  const idx = state.kidsTdCurrentPlayerIndex || 0;
  if(!state.kidsTdSkipped) state.kidsTdSkipped = [];
  state.kidsTdSkipped[idx] = (state.kidsTdSkipped[idx] || 0) + 1;
  saveState();
  kidsTdNextTurn();
});
document.getElementById('kidsTdExitBtn').addEventListener('click', ()=>{
  pauseKidsTdGame();
  showToast('Игра на паузе — прогресс сохранён');
});
document.getElementById('kidsTdChoiceExitBtn').addEventListener('click', ()=>{
  pauseKidsTdGame();
  showToast('Игра на паузе — прогресс сохранён');
});
document.getElementById('kidsTdSetupRulesBtn').addEventListener('click', ()=>{ document.getElementById('kidsTdRulesModal').classList.add('show'); });
document.getElementById('closeKidsTdRulesBtn').addEventListener('click', ()=>{ document.getElementById('kidsTdRulesModal').classList.remove('show'); });
document.getElementById('kidsTdRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'kidsTdRulesModal') e.currentTarget.classList.remove('show'); });
document.getElementById('closeKidsTdSummaryBtn').addEventListener('click', ()=>{ exitKidsTdGame(); });
