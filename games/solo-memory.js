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
    });
    wrap.appendChild(div);
  });
}
function goToSoloMemorySetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('soloMemorySetup').classList.add('active');
  renderSoloMemoryLevels();
}
function exitSoloMemorySetup(){
  document.getElementById('soloMemorySetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
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
  if(soloMemoryTimerId){ clearInterval(soloMemoryTimerId); soloMemoryTimerId = null; }
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
  document.getElementById('soloMemorySummaryModal').classList.add('show');
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
  document.getElementById('soloMemorySummaryModal').classList.remove('show');
  state.soloMemoryDeck = [];
  state.soloMemorySteps = 0;
  state.soloMemoryElapsedMs = 0;
  soloMemoryFlipped = [];
  soloMemoryBusy = false;
  saveState();
  document.getElementById('soloMemoryGame').classList.remove('active');
  document.getElementById('soloMemorySetup').classList.add('active');
}
document.getElementById('soloMemorySetupStartBtn').addEventListener('click', ()=>{ goToSoloMemoryGame(); });
document.getElementById('soloMemorySetupExitBtn').addEventListener('click', ()=>{ exitSoloMemorySetup(); });
document.getElementById('closeSoloMemorySummaryBtn').addEventListener('click', ()=>{ exitSoloMemoryGame(); });
document.getElementById('soloMemoryExitBtn').addEventListener('click', ()=>{ exitSoloMemoryGame(); });
document.getElementById('soloMemorySetupRulesBtn').addEventListener('click', ()=>{ document.getElementById('soloMemoryRulesModal').classList.add('show'); });
document.getElementById('soloMemoryGameRulesBtn').addEventListener('click', ()=>{ document.getElementById('soloMemoryRulesModal').classList.add('show'); });
document.getElementById('closeSoloMemoryRulesBtn').addEventListener('click', ()=>{ document.getElementById('soloMemoryRulesModal').classList.remove('show'); });
document.getElementById('soloMemoryRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'soloMemoryRulesModal') e.currentTarget.classList.remove('show'); });
