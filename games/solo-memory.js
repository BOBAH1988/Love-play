// games/solo-memory.js — Игра "Мемори" (раздел "Игры для одного").
// Загружается через <script src="games/solo-memory.js"></script> в index.html,
// после cards/cards_kids_memory.js и games/core.js. Использует те же данные
// (KIDS_MEMORY_LEVELS/KIDS_MEMORY_ICONS), что и детское Мемори, но для одного
// игрока: без списка игроков и без хода по очереди — в итогах показывается
// число ходов (попыток открыть пару) и затраченное время.

let soloMemoryFlipped = [];
let soloMemoryBusy = false;
let soloMemoryTimerId = null;
let soloMemoryStartedAt = 0;

function renderSoloMemoryLevels(){
  const wrap = document.getElementById('soloMemorySetupLevels');
  if(!wrap) return;
  wrap.innerHTML = '';
  (typeof KIDS_MEMORY_LEVELS !== 'undefined' ? KIDS_MEMORY_LEVELS : []).forEach(l=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + ((state.soloMemoryLevel || 1) === l.id ? ' on' : '');
    div.innerHTML = `<div class="lname">${l.icon} ${l.name}</div><div class="ldesc">${l.desc}</div><div class="level-check"></div>`;
    div.addEventListener('click', ()=>{
      state.soloMemoryLevel = l.id;
      saveState();
      renderSoloMemoryLevels();
      renderSoloMemoryLeaderboard();
    });
    wrap.appendChild(div);
  });
}
function goToSoloMemorySetup(){
  goToGameSetup('soloMemorySetup', null, ()=>{
    renderSoloMemoryLevels();
    renderSoloMemoryLeaderboard();
  });
}
function exitSoloMemorySetup(){
  document.getElementById('soloMemorySetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('soloView');
}
function generateSoloMemoryDeck(levelId){
  const levelInfo = (typeof KIDS_MEMORY_LEVELS !== 'undefined' ? KIDS_MEMORY_LEVELS.find(l=>l.id===levelId) : null) || {pairs:6};
  const pool = (typeof KIDS_MEMORY_ICONS !== 'undefined' && Array.isArray(KIDS_MEMORY_ICONS)) ? KIDS_MEMORY_ICONS.slice() : ['🐶','🐱'];
  const chosen = shuffle(pool).slice(0, levelInfo.pairs);
  const deckIcons = shuffle(chosen.concat(chosen));
  return deckIcons.map(icon=>({icon, matched:false}));
}
function renderSoloMemoryGrid(){
  const wrap = document.getElementById('soloMemoryGrid');
  if(!wrap) return;
  const deck = state.soloMemoryDeck || [];
  wrap.innerHTML = '';
  deck.forEach((card, idx)=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    const isFaceUp = card.matched || soloMemoryFlipped.includes(idx);
    btn.className = 'memory-card' + (card.matched ? ' matched' : '') + (soloMemoryFlipped.includes(idx) ? ' flipped' : '');
    btn.textContent = isFaceUp ? card.icon : '❓';
    btn.setAttribute('aria-label', isFaceUp ? card.icon : 'Закрытая карточка');
    if(card.matched) btn.disabled = true;
    btn.addEventListener('click', ()=>clickSoloMemoryCard(idx));
    wrap.appendChild(btn);
  });
}
function updateSoloMemoryStatsUI(){
  const el = document.getElementById('soloMemoryStatsRow');
  if(el) el.textContent = `👣 Ходы: ${state.soloMemorySteps || 0}`;
}
function fmtSoloMemoryTime(ms){
  const totalSec = Math.floor(ms/1000);
  const mm = String(Math.floor(totalSec/60)).padStart(2,'0');
  const ss = String(totalSec%60).padStart(2,'0');
  return `${mm}:${ss}`;
}
function updateSoloMemoryTimerLabel(){
  const el = document.getElementById('soloMemoryTimerLabel');
  if(!el) return;
  const elapsed = soloMemoryStartedAt ? (Date.now() - soloMemoryStartedAt) : 0;
  el.textContent = `⏱️ ${fmtSoloMemoryTime(elapsed)}`;
}
function stopSoloMemoryTimer(){
  soloMemoryTimerId = stopInterval(soloMemoryTimerId);
}
function startSoloMemoryTimer(){
  stopSoloMemoryTimer();
  soloMemoryStartedAt = Date.now();
  updateSoloMemoryTimerLabel();
  soloMemoryTimerId = setInterval(updateSoloMemoryTimerLabel, 1000);
}
function clickSoloMemoryCard(idx){
  if(soloMemoryBusy) return;
  const deck = state.soloMemoryDeck || [];
  const card = deck[idx];
  if(!card || card.matched) return;
  if(soloMemoryFlipped.includes(idx)) return;
  if(soloMemoryFlipped.length >= 2) return;
  playNeutralSound();
  soloMemoryFlipped.push(idx);
  renderSoloMemoryGrid();
  if(soloMemoryFlipped.length < 2) return;

  state.soloMemorySteps = (state.soloMemorySteps || 0) + 1;
  updateSoloMemoryStatsUI();

  const [i1, i2] = soloMemoryFlipped;
  const isMatch = deck[i1].icon === deck[i2].icon;

  if(isMatch){
    deck[i1].matched = true;
    deck[i2].matched = true;
    soloMemoryFlipped = [];
    saveState();
    playSuccessSound();
    renderSoloMemoryGrid();
    if(checkSoloMemoryFinished()) return;
    return;
  }

  soloMemoryBusy = true;
  setTimeout(()=>{
    soloMemoryFlipped = [];
    soloMemoryBusy = false;
    playFailSound();
    saveState();
    renderSoloMemoryGrid();
  }, 900);
}
function checkSoloMemoryFinished(){
  const deck = state.soloMemoryDeck || [];
  if(deck.length > 0 && deck.every(c=>c.matched)){
    stopSoloMemoryTimer();
    state.soloMemoryElapsedMs = Date.now() - soloMemoryStartedAt;
    saveState();
    showSoloMemorySummaryModal();
    return true;
  }
  return false;
}
function showSoloMemorySummaryModal(){
  const totalPairs = Math.floor((state.soloMemoryDeck || []).length / 2);
  const introEl = document.getElementById('soloMemorySummaryIntro');
  if(introEl) introEl.textContent = `Все ${totalPairs} пар найдены! 🎉`;
  const statsEl = document.getElementById('soloMemorySummaryStats');
  if(statsEl) statsEl.textContent = `👣 Пройдено за ${state.soloMemorySteps || 0} ходов · ⏱️ Время: ${fmtSoloMemoryTime(state.soloMemoryElapsedMs || 0)}`;
  const nameInput = document.getElementById('soloMemoryNameInput');
  if(nameInput) nameInput.value = state.soloMemoryLastName || '';
  showModal('soloMemorySummaryModal');
}
function renderSoloMemoryLeaderboard(){
  const wrap = document.getElementById('soloMemoryLeaderboardList');
  if(!wrap) return;
  const level = state.soloMemoryLevel || 1;
  const titleEl = document.getElementById('soloMemoryLeaderboardTitle');
  if(titleEl){
    const levelInfo = (typeof KIDS_MEMORY_LEVELS !== 'undefined' ? KIDS_MEMORY_LEVELS.find(l=>l.id===level) : null);
    titleEl.textContent = '🏆 Таблица лидеров' + (levelInfo ? ' — ' + levelInfo.name : '');
  }
  const list = (state.soloMemoryLeaderboard || []).filter(entry => (entry.level || 1) === level);
  if(list.length === 0){
    wrap.innerHTML = '<div class="leaderboard-empty">Пока нет результатов на этом уровне — сыграйте первую игру!</div>';
    return;
  }
  const medals = {1:'🥇', 2:'🥈', 3:'🥉'};
  wrap.innerHTML = list.map((entry, i)=>{
    const rank = i + 1;
    return `<div class="leaderboard-row${rank <= 3 ? ' leaderboard-top' + rank : ''}">
      <div class="leaderboard-rank">${medals[rank] || rank + '.'}</div>
      <div class="leaderboard-name">${entry.name}</div>
      <div class="leaderboard-time">${fmtSoloMemoryTime(entry.timeMs)}</div>
    </div>`;
  }).join('');
}
function saveSoloMemoryScore(name, timeMs, level){
  const cleanName = (name || '').trim().slice(0, 14) || 'Игрок';
  if(!state.soloMemoryLeaderboard) state.soloMemoryLeaderboard = [];
  state.soloMemoryLeaderboard.push({name: cleanName, level: level || 1, timeMs});
  // Сортируем и обрезаем до топ-10 ОТДЕЛЬНО для каждого уровня, чтобы
  // результаты на одном уровне не вытесняли результаты другого.
  const byLevel = {};
  state.soloMemoryLeaderboard.forEach(e=>{
    const lvl = e.level || 1;
    if(!byLevel[lvl]) byLevel[lvl] = [];
    byLevel[lvl].push(e);
  });
  let merged = [];
  Object.keys(byLevel).forEach(lvl=>{
    byLevel[lvl].sort((a,b)=>a.timeMs - b.timeMs);
    merged = merged.concat(byLevel[lvl].slice(0, 10));
  });
  state.soloMemoryLeaderboard = merged;
  state.soloMemoryLastName = cleanName;
  saveState();
}
function goToSoloMemoryGame(){
  document.getElementById('soloMemorySetup').classList.remove('active');
  document.getElementById('soloMemoryGame').classList.add('active');
  const level = state.soloMemoryLevel || 1;
  state.soloMemoryDeck = generateSoloMemoryDeck(level);
  state.soloMemorySteps = 0;
  state.soloMemoryElapsedMs = 0;
  soloMemoryFlipped = [];
  soloMemoryBusy = false;
  saveState();
  updateSoloMemoryStatsUI();
  renderSoloMemoryGrid();
  startSoloMemoryTimer();
  updateMuteBtn();
  requestWakeLock();
}
function exitSoloMemoryGame(){
  stopSoloMemoryTimer();
  hideModal('soloMemorySummaryModal');
  state.soloMemoryDeck = [];
  state.soloMemorySteps = 0;
  state.soloMemoryElapsedMs = 0;
  soloMemoryFlipped = [];
  soloMemoryBusy = false;
  saveState();
  exitGame('soloMemoryGame', 'soloMemorySetup');
  renderSoloMemoryLeaderboard();
}
document.getElementById('soloMemorySetupStartBtn').addEventListener('click', ()=>{ goToSoloMemoryGame(); });
document.getElementById('soloMemorySetupExitBtn').addEventListener('click', ()=>{ exitSoloMemorySetup(); });
document.getElementById('closeSoloMemorySummaryBtn').addEventListener('click', ()=>{
  const nameInput = document.getElementById('soloMemoryNameInput');
  saveSoloMemoryScore(nameInput ? nameInput.value : '', state.soloMemoryElapsedMs || 0, state.soloMemoryLevel || 1);
  exitSoloMemoryGame();
});
document.getElementById('soloMemoryExitBtn').addEventListener('click', ()=>{ exitSoloMemoryGame(); });
(document.getElementById('soloMemorySetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ showModal('soloMemoryRulesModal'); });
openRulesModal('soloMemoryGameRulesBtn', 'soloMemoryRulesModal');
setupRulesModal('soloMemoryRulesModal', 'closeSoloMemoryRulesBtn');

