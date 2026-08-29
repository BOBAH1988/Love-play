// games/kids-memory.js — Игра "Мемори" (игры с детьми).
// Загружается через <script src="games/kids-memory.js"></script> в index.html,
// после cards/cards_kids_memory.js и games/core.js.

/* ---------- МЕМОРИ (найди пару: карточки картинкой вниз, ищем совпадения) ----------
   Общий список игроков — state.kidsPlayers (см. renderKidsPlayers в games/core.js),
   от 2 до 10, отдельный от "Игр для компании". Игроки ходят по очереди: на своём
   ходу открывают 2 карточки — совпали, значит очко и ещё один ход; не совпали —
   карточки переворачиваются обратно и ход переходит следующему игроку. */

// Транзитивное состояние текущего хода (какие карточки сейчас открыты, но ещё
// не разрешены/не совпали) намеренно НЕ хранится в state — при паузе просто
// сбрасывается (обе карточки всё равно не были угаданы, прогресс не теряется).
let kidsMemoryFlipped = [];
let kidsMemoryBusy = false;

function renderKidsMemoryLevels(){
  const wrap = document.getElementById('kidsMemorySetupLevels');
  if(!wrap) return;
  wrap.innerHTML = '';
  (typeof KIDS_MEMORY_LEVELS !== 'undefined' ? KIDS_MEMORY_LEVELS : []).forEach(l=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + ((state.kidsMemoryLevel || 1) === l.id ? ' on' : '');
    div.innerHTML = `<div class="lname">${l.icon} ${l.name}</div><div class="ldesc">${l.desc}</div><div class="level-check"></div>`;
    div.addEventListener('click', ()=>{
      state.kidsMemoryLevel = l.id;
      saveState();
      renderKidsMemoryLevels();
    });
    wrap.appendChild(div);
  });
}
function goToKidsMemorySetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('kidsMemorySetup').classList.add('active');
  renderKidsMemoryLevels();
}
function exitKidsMemorySetup(){
  document.getElementById('kidsMemorySetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}
// Случайно берёт из пула ровно столько картинок, сколько пар нужно на выбранном
// уровне, дублирует и перемешивает — новая колода на каждую партию.
function generateKidsMemoryDeck(levelId){
  const levelInfo = (typeof KIDS_MEMORY_LEVELS !== 'undefined' ? KIDS_MEMORY_LEVELS.find(l=>l.id===levelId) : null) || {pairs:6};
  const pool = (typeof KIDS_MEMORY_ICONS !== 'undefined' && Array.isArray(KIDS_MEMORY_ICONS)) ? KIDS_MEMORY_ICONS.slice() : ['🐶','🐱'];
  const chosen = shuffle(pool).slice(0, levelInfo.pairs);
  const deckIcons = shuffle(chosen.concat(chosen));
  return deckIcons.map(icon=>({icon, matched:false}));
}
function renderKidsMemoryGrid(){
  const wrap = document.getElementById('kidsMemoryGrid');
  if(!wrap) return;
  const deck = state.kidsMemoryDeck || [];
  wrap.innerHTML = '';
  deck.forEach((card, idx)=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    const isFaceUp = card.matched || kidsMemoryFlipped.includes(idx);
    btn.className = 'memory-card' + (card.matched ? ' matched' : '') + (kidsMemoryFlipped.includes(idx) ? ' flipped' : '');
    btn.textContent = isFaceUp ? card.icon : '❓';
    btn.setAttribute('aria-label', isFaceUp ? card.icon : 'Закрытая карточка');
    if(card.matched) btn.disabled = true;
    btn.addEventListener('click', ()=>clickKidsMemoryCard(idx));
    wrap.appendChild(btn);
  });
}
function updateKidsMemoryScoreUI(){
  const players = state.kidsPlayers || ['Игрок 1','Игрок 2'];
  const scores = state.kidsMemoryScores || [];
  const idx = state.kidsMemoryCurrentPlayerIndex || 0;
  const wrap = document.getElementById('kidsMemoryScoreRow');
  if(wrap){
    wrap.innerHTML = '';
    players.forEach((name, i)=>{
      const span = document.createElement('span');
      span.className = 'krokodil-score-item' + (i === idx ? ' active' : '');
      span.textContent = name + ': ' + (scores[i] || 0);
      wrap.appendChild(span);
    });
  }
  const turnName = players[idx] || 'Игрок 1';
  const turnLabel = document.getElementById('kidsMemoryTurnLabel');
  if(turnLabel) turnLabel.textContent = 'Ходит: ' + turnName;
}
function clickKidsMemoryCard(idx){
  if(kidsMemoryBusy) return;
  const deck = state.kidsMemoryDeck || [];
  const card = deck[idx];
  if(!card || card.matched) return;
  if(kidsMemoryFlipped.includes(idx)) return;
  if(kidsMemoryFlipped.length >= 2) return;
  playNeutralSound();
  kidsMemoryFlipped.push(idx);
  renderKidsMemoryGrid();
  if(kidsMemoryFlipped.length < 2) return;

  const [i1, i2] = kidsMemoryFlipped;
  const isMatch = deck[i1].icon === deck[i2].icon;

  if(isMatch){
    deck[i1].matched = true;
    deck[i2].matched = true;
    const playerIdx = state.kidsMemoryCurrentPlayerIndex || 0;
    if(!state.kidsMemoryScores) state.kidsMemoryScores = [];
    state.kidsMemoryScores[playerIdx] = (state.kidsMemoryScores[playerIdx] || 0) + 1;
    kidsMemoryFlipped = [];
    saveState();
    playSuccessSound();
    renderKidsMemoryGrid();
    updateKidsMemoryScoreUI();
    if(checkKidsMemoryFinished()) return;
    showToast('Совпадение! Ходите ещё 🎉');
    return;
  }

  // Не совпало — держим обе карточки открытыми чуть-чуть, чтобы игроки успели
  // их запомнить, потом переворачиваем обратно и передаём ход следующему.
  kidsMemoryBusy = true;
  setTimeout(()=>{
    kidsMemoryFlipped = [];
    kidsMemoryBusy = false;
    playFailSound();
    const n = (state.kidsPlayers || []).length || 1;
    state.kidsMemoryCurrentPlayerIndex = ((state.kidsMemoryCurrentPlayerIndex || 0) + 1) % n;
    saveState();
    renderKidsMemoryGrid();
    updateKidsMemoryScoreUI();
  }, 900);
}
function checkKidsMemoryFinished(){
  const deck = state.kidsMemoryDeck || [];
  if(deck.length > 0 && deck.every(c=>c.matched)){
    state.inProgress = false;
    state.pausedMode = null;
    saveState();
    showKidsMemorySummaryModal();
    return true;
  }
  return false;
}
// Игроки с одинаковым числом найденных пар делят одно место — как в
// спортивном рейтинге (1-2-2-4, а не 1-2-2-3): следующее отличающееся место
// пропускает столько позиций, сколько игроков было в "связке". Если 1-е
// место разделили двое и больше — в шапке отдельно отмечается ничья.
function showKidsMemorySummaryModal(){
  const players = state.kidsPlayers || ['Игрок 1','Игрок 2'];
  const scores = state.kidsMemoryScores || [];
  const ranking = players.map((n,i)=>({n, score: scores[i] || 0})).sort((a,b)=>b.score-a.score);
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
        <span class="krokodil-summary-score">Пар найдено: ${r.score}</span>
      </div>
    `;
  }).join('');
  const totalPairs = Math.floor((state.kidsMemoryDeck || []).length / 2);
  const isTopTie = ranking.length > 1 && ranking[0].score === ranking[1].score;
  const introEl = document.getElementById('kidsMemorySummaryIntro');
  if(introEl) introEl.textContent = `Все ${totalPairs} пар найдены!` + (isTopTie ? ' 🤝 Ничья за 1-е место!' : ' Вот кто справился лучше всех:');
  document.getElementById('kidsMemorySummaryList').innerHTML = listHtml;
  document.getElementById('kidsMemorySummaryModal').classList.add('show');
}
function goToKidsMemoryGame(){
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
  abandonPausedKidsTdSession();
  abandonPausedFantySession();
  abandonPausedSoloBsSession();
  state.pausedMode = null;
  document.getElementById('kidsMemorySetup').classList.remove('active');
  document.getElementById('kidsMemoryGame').classList.add('active');
  if(!state.kidsPlayers || state.kidsPlayers.length < 2){
    state.kidsPlayers = ['Игрок 1','Игрок 2'];
  }
  const n = state.kidsPlayers.length;
  const level = state.kidsMemoryLevel || 1;
  state.kidsMemoryDeck = generateKidsMemoryDeck(level);
  state.kidsMemoryScores = new Array(n).fill(0);
  state.kidsMemoryCurrentPlayerIndex = Math.floor(Math.random() * n);
  state.inProgress = true;
  kidsMemoryFlipped = [];
  kidsMemoryBusy = false;
  saveState();
  updateKidsMemoryScoreUI();
  renderKidsMemoryGrid();
  updateMuteBtn();
  requestWakeLock();
}
// Полный выход из партии (кнопка "Завершить игру" на итоговом экране) —
// сбрасывает поле и счёт, возвращает на экран настройки Мемори.
function exitKidsMemoryGame(){
  document.getElementById('kidsMemorySummaryModal').classList.remove('show');
  state.kidsMemoryDeck = [];
  state.kidsMemoryScores = [];
  state.kidsMemoryCurrentPlayerIndex = 0;
  state.inProgress = false;
  state.pausedMode = null;
  kidsMemoryFlipped = [];
  kidsMemoryBusy = false;
  saveState();
  document.getElementById('kidsMemoryGame').classList.remove('active');
  document.getElementById('kidsMemorySetup').classList.add('active');
}
// Пауза: вернуться в главное меню, не сбрасывая поле и счёт — можно
// продолжить позже через общий блок "Продолжить игру"/"Закончить игру".
function pauseKidsMemoryGame(){
  kidsMemoryFlipped = [];
  kidsMemoryBusy = false;
  state.pausedMode = 'kidsMemory';
  saveState();
  document.getElementById('kidsMemoryGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  updateResumeUI();
}
function resumeKidsMemoryGame(){
  state.pausedMode = null;
  saveState();
  updateResumeUI();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('kidsMemoryGame').classList.add('active');
  kidsMemoryFlipped = [];
  kidsMemoryBusy = false;
  renderKidsMemoryGrid();
  updateKidsMemoryScoreUI();
  updateMuteBtn();
  requestWakeLock();
}
// Вызывается из общего меню паузы ("Закончить игру") — экран там уже #setup,
// переключать нечего, только сбросить состояние партии (симметрично finishKrokodilGame).
function finishKidsMemoryGame(){
  state.kidsMemoryDeck = [];
  state.kidsMemoryScores = [];
  state.kidsMemoryCurrentPlayerIndex = 0;
  state.inProgress = false;
  state.pausedMode = null;
  kidsMemoryFlipped = [];
  kidsMemoryBusy = false;
  saveState();
  updateResumeUI();
}
document.getElementById('kidsMemorySetupStartBtn').addEventListener('click', ()=>{ goToKidsMemoryGame(); });
document.getElementById('kidsMemorySetupExitBtn').addEventListener('click', ()=>{ exitKidsMemorySetup(); });
document.getElementById('closeKidsMemorySummaryBtn').addEventListener('click', ()=>{ exitKidsMemoryGame(); });
document.getElementById('kidsMemoryExitBtn').addEventListener('click', ()=>{
  pauseKidsMemoryGame();
  showToast('Игра на паузе — прогресс сохранён');
});
document.getElementById('kidsMemorySetupRulesBtn').addEventListener('click', ()=>{ document.getElementById('kidsMemoryRulesModal').classList.add('show'); });
document.getElementById('kidsMemoryGameRulesBtn').addEventListener('click', ()=>{ document.getElementById('kidsMemoryRulesModal').classList.add('show'); });
document.getElementById('closeKidsMemoryRulesBtn').addEventListener('click', ()=>{ document.getElementById('kidsMemoryRulesModal').classList.remove('show'); });
document.getElementById('kidsMemoryRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'kidsMemoryRulesModal') e.currentTarget.classList.remove('show'); });
