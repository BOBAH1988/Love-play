// games/kids-krokodil.js — детская версия игры "Крокодил" (дети).
// Загружается через <script src="games/kids-krokodil.js"></script> в index.html.
// Дублирует games/krokodil.js (тот же таймер раунда, счёт, режимы
// "Слово"/"Действие", итоговое окно), только:
//  - игроки берутся из общего списка "Игры с детьми" (state.kidsPlayers),
//    не из "Игры для компании";
//  - уровень берётся из общего переключателя возраста #kidsAgeGroup
//    (state.kidsAge), поэтому здесь нет своего экрана выбора уровня;
//  - "Выход" сразу завершает партию (без общего меню паузы/резюме, которое
//    используют игры для компании) — тот же простой паттерн, что у детских
//    Мемасиков и компанийских Мемасиков.
let kkrRemaining = 0;
let kkrTotal = 0;
let kkrIntervalId = null;
let kkrRoundGuessed = 0;
let kkrRoundSkipped = 0;
let kkrCurrentCard = null;
// mode 'explain' — разновидность без пантомимы (объясняешь словами и
// описаниями, не называя само слово), использует тот же пул карточек, что
// и 'word' — см. пояснение в games/krokodil.js.
function getKkrCardsList(level, mode){
  if(typeof KIDS_KROKODIL_CARDS === 'undefined' || !Array.isArray(KIDS_KROKODIL_CARDS)) return [];
  return KIDS_KROKODIL_CARDS.filter(c=>c.level===level && ((mode === 'word' || mode === 'explain') ? c.mode === 'word' : c.mode !== 'word'));
}
function renderKidsKrokodilDurationGroup(){
  document.querySelectorAll('#kidsKrokodilDurationGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (state.kidsKrokodilRoundSeconds || 180));
  });
}
document.querySelectorAll('#kidsKrokodilDurationGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.kidsKrokodilRoundSeconds = parseInt(btn.dataset.value, 10);
    saveState();
    renderKidsKrokodilDurationGroup();
  });
});
function renderKidsKrokodilModeGroup(){
  const mode = state.kidsKrokodilMode || 'word';
  document.querySelectorAll('#kidsKrokodilModeGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', btn.dataset.value === mode);
  });
  const subtitle = document.getElementById('kidsKrokodilSetupSubtitle');
  if(subtitle) subtitle.textContent = mode === 'explain'
    ? 'Один объясняет слово своими словами, не называя его и однокоренные — остальные угадывают'
    : 'Один показывает слово молча — остальные угадывают';
}
document.querySelectorAll('#kidsKrokodilModeGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.kidsKrokodilMode = btn.dataset.value;
    saveState();
    renderKidsKrokodilModeGroup();
  });
});
function renderKidsKrokodilWordsCountGroup(){
  document.querySelectorAll('#kidsKrokodilWordsCountGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (state.kidsKrokodilWordsPerRound || 5));
  });
}
document.querySelectorAll('#kidsKrokodilWordsCountGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.kidsKrokodilWordsPerRound = parseInt(btn.dataset.value, 10);
    saveState();
    renderKidsKrokodilWordsCountGroup();
  });
});
function goToKidsKrokodilSetup(){
  goToGameSetup('kidsKrokodilSetup', null, ()=>{
    renderKidsKrokodilModeGroup();
    renderKidsKrokodilDurationGroup();
    renderKidsKrokodilWordsCountGroup();
  });
}
function exitKidsKrokodilSetup(){
  document.getElementById('kidsKrokodilSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('kidsView');
}
function stopKkrInterval(){
  kkrIntervalId = stopInterval(kkrIntervalId);
}
function updateKkrBar(){
  const fill = document.getElementById('kidsKrokodilBarFill');
  const label = document.getElementById('kidsKrokodilLabel');
  if(!fill || !label) return;
  const pct = kkrTotal > 0 ? Math.round((kkrRemaining / kkrTotal) * 100) : 0;
  fill.style.width = pct + '%';
  const mm = String(Math.floor(kkrRemaining / 60)).padStart(2,'0');
  const ss = String(kkrRemaining % 60).padStart(2,'0');
  label.textContent = mm + ':' + ss;
}
function updateKkrScoreUI(){
  const players = state.kidsPlayers || ['Игрок 1','Игрок 2'];
  const scores = state.kidsKrokodilScores || [];
  const idx = state.kidsKrokodilCurrentPlayerIndex || 0;
  const wrap = document.getElementById('kidsKrokodilScoreRow');
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
  const turnLabel = document.getElementById('kidsKrokodilTurnLabel');
  const verb = (state.kidsKrokodilMode || 'word') === 'explain' ? 'Объясняет' : 'Показывает';
  if(turnLabel) turnLabel.textContent = verb + ': ' + turnName;
}
function kkrDrawWord(){
  const level = state.kidsAge || 2;
  const mode = state.kidsKrokodilMode || 'word';
  const usedKey = level + '-' + mode;
  const all = getKkrCardsList(level, mode);
  if(all.length === 0){
    kkrCurrentCard = null;
    fadeSwapEl('kidsKrokodilCard', (el)=>{
      el.className = 'card';
      el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon">🐊</div><div class="card-text">Нет слов для этого возраста</div></div></div>`;
    });
    return;
  }
  if(!state.kidsKrokodilUsed) state.kidsKrokodilUsed = {};
  let used = state.kidsKrokodilUsed[usedKey] || [];
  let pool = all.filter(c=>!used.includes(c.text));
  if(pool.length === 0){
    pool = all;
    used = [];
    showToast('Слова этого возраста показаны заново 🔀');
  }
  const card = pool[Math.floor(Math.random()*pool.length)];
  used.push(card.text);
  state.kidsKrokodilUsed[usedKey] = used;
  saveState();
  kkrCurrentCard = card;
  fadeSwapEl('kidsKrokodilCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="krokodil-word-icon">${card.icon || '🐊'}</div><div class="card-text krokodil-word">${card.text}</div></div></div>`;
  });
}
function kkrStartRound(){
  kkrRoundGuessed = 0;
  kkrRoundSkipped = 0;
  kkrTotal = state.kidsKrokodilRoundSeconds || 180;
  kkrRemaining = kkrTotal;
  document.getElementById('kidsKrokodilBarTrack').style.display = '';
  document.getElementById('kidsKrokodilLabel').style.display = '';
  document.getElementById('kidsKrokodilRoundSummary').style.display = 'none';
  document.getElementById('kidsKrokodilStartRoundBtn').style.display = 'none';
  document.getElementById('kidsKrokodilNextPlayerBtn').style.display = 'none';
  document.getElementById('kidsKrokodilGuessedBtn').style.display = 'flex';
  document.getElementById('kidsKrokodilSkipBtn').style.display = 'flex';
  updateKkrBar();
  kkrDrawWord();
  stopKkrInterval();
  kkrIntervalId = setInterval(kkrTick, 1000);
}
function kkrTick(){
  kkrRemaining--;
  updateKkrBar();
  if(kkrRemaining <= 0){
    stopKkrInterval();
    if(kkrCurrentCard){ kkrRoundSkipped++; kkrCurrentCard = null; }
    kkrRoundEnd();
  }
}
function kkrRoundEnd(){
  stopKkrInterval();
  playSuccessSound();
  const players = state.kidsPlayers || ['Игрок 1','Игрок 2'];
  const idx = state.kidsKrokodilCurrentPlayerIndex || 0;
  const turnName = players[idx] || 'Игрок 1';
  if(!state.kidsKrokodilScores) state.kidsKrokodilScores = [];
  if(!state.kidsKrokodilSkipCounts) state.kidsKrokodilSkipCounts = [];
  state.kidsKrokodilScores[idx] = (state.kidsKrokodilScores[idx] || 0) + kkrRoundGuessed;
  state.kidsKrokodilSkipCounts[idx] = (state.kidsKrokodilSkipCounts[idx] || 0) + kkrRoundSkipped;
  state.kidsKrokodilTurnsPlayed = (state.kidsKrokodilTurnsPlayed || 0) + 1;
  saveState();
  updateKkrScoreUI();
  document.getElementById('kidsKrokodilGuessedBtn').style.display = 'none';
  document.getElementById('kidsKrokodilSkipBtn').style.display = 'none';
  document.getElementById('kidsKrokodilBarTrack').style.display = 'none';
  document.getElementById('kidsKrokodilLabel').style.display = 'none';

  const roundsPerPlayer = state.kidsKrokodilRoundsPerPlayer || 5;
  const gameOver = state.kidsKrokodilTurnsPlayed >= players.length * roundsPerPlayer;

  const summary = document.getElementById('kidsKrokodilRoundSummary');
  if(summary){
    if(gameOver){
      summary.style.display = 'none';
      summary.innerHTML = '';
    } else {
      summary.style.display = '';
      summary.innerHTML = `Раунд завершён! ${turnName} угадал(а) слов: ${kkrRoundGuessed}` + (kkrRoundSkipped ? `, пропущено: ${kkrRoundSkipped}` : '');
    }
  }
  fadeSwapEl('kidsKrokodilCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon">🐊</div><div class="card-text">${gameOver ? 'Игра окончена' : 'Раунд окончен'}</div></div></div>`;
  });
  document.getElementById('kidsKrokodilNextPlayerBtn').style.display = gameOver ? 'none' : 'flex';
  document.getElementById('kidsKrokodilFinishBtn').style.display = gameOver ? 'flex' : 'none';
  if(gameOver) showKidsKrokodilSummaryModal();
}
function showKidsKrokodilSummaryModal(){
  const players = state.kidsPlayers || ['Игрок 1','Игрок 2'];
  const scores = state.kidsKrokodilScores || [];
  const skips = state.kidsKrokodilSkipCounts || [];
  const ranking = players.map((n,i)=>({n, score: scores[i] || 0, skipped: skips[i] || 0}))
    .sort((a,b)=>b.score-a.score);
  const medals = ['🥇','🥈','🥉'];
  const listHtml = ranking.map((r,i)=>{
    const place = medals[i] || `${i+1}.`;
    const isFirst = i === 0;
    return `
      <div class="krokodil-summary-row${isFirst ? ' krokodil-summary-first' : ''}">
        <span class="krokodil-summary-place">${place}</span>
        <span class="krokodil-summary-name">${r.n}</span>
        <span class="krokodil-summary-score">Угадано: ${r.score} · Пропущено: ${r.skipped}</span>
      </div>
    `;
  }).join('');
  document.getElementById('kidsKrokodilSummaryIntro').textContent = `Сыграно раундов: ${players.length * (state.kidsKrokodilRoundsPerPlayer || 5)} — вот кто справился лучше всех:`;
  document.getElementById('kidsKrokodilSummaryList').innerHTML = listHtml;
  showModal('kidsKrokodilSummaryModal');
}
function kkrNextPlayerRound(){
  const n = (state.kidsPlayers || []).length || 1;
  state.kidsKrokodilCurrentPlayerIndex = ((state.kidsKrokodilCurrentPlayerIndex || 0) + 1) % n;
  saveState();
  updateKkrScoreUI();
  document.getElementById('kidsKrokodilRoundSummary').style.display = 'none';
  document.getElementById('kidsKrokodilNextPlayerBtn').style.display = 'none';
  document.getElementById('kidsKrokodilStartRoundBtn').style.display = 'flex';
  fadeSwapEl('kidsKrokodilCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon">🐊</div><div class="card-text">Нажмите «▶ Начать раунд»</div></div></div>`;
  });
}
function goToKidsKrokodilGame(){
  goToGame('kidsKrokodilSetup', 'kidsKrokodilGame');
  if(!state.kidsPlayers || state.kidsPlayers.length < 2){
    state.kidsPlayers = ['Игрок 1','Игрок 2'];
  }
  const n = state.kidsPlayers.length;
  state.kidsKrokodilScores = new Array(n).fill(0);
  state.kidsKrokodilSkipCounts = new Array(n).fill(0);
  state.kidsKrokodilTurnsPlayed = 0;
  state.kidsKrokodilCurrentPlayerIndex = Math.floor(Math.random() * n);
  saveState();
  updateKkrScoreUI();
  document.getElementById('kidsKrokodilStartRoundBtn').style.display = 'flex';
  document.getElementById('kidsKrokodilGuessedBtn').style.display = 'none';
  document.getElementById('kidsKrokodilSkipBtn').style.display = 'none';
  document.getElementById('kidsKrokodilNextPlayerBtn').style.display = 'none';
  document.getElementById('kidsKrokodilFinishBtn').style.display = 'none';
  document.getElementById('kidsKrokodilBarTrack').style.display = 'none';
  document.getElementById('kidsKrokodilLabel').style.display = 'none';
  document.getElementById('kidsKrokodilRoundSummary').style.display = 'none';
  fadeSwapEl('kidsKrokodilCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon">🐊</div><div class="card-text">Нажмите «▶ Начать раунд»</div></div></div>`;
  });
  updateMuteBtn();
  requestWakeLock();
}
function exitKidsKrokodilGame(){
  stopKkrInterval();
  hideModal('kidsKrokodilSummaryModal');
  state.kidsKrokodilScores = [];
  state.kidsKrokodilSkipCounts = [];
  state.kidsKrokodilTurnsPlayed = 0;
  state.kidsKrokodilCurrentPlayerIndex = 0;
  saveState();
  exitGame('kidsKrokodilGame', 'kidsKrokodilSetup');
}
document.getElementById('kidsKrokodilSetupStartBtn').addEventListener('click', ()=>{ goToKidsKrokodilGame(); });
document.getElementById('kidsKrokodilSetupExitBtn').addEventListener('click', ()=>{ exitKidsKrokodilSetup(); });
document.getElementById('kidsKrokodilStartRoundBtn').addEventListener('click', ()=>{ kkrStartRound(); });
document.getElementById('kidsKrokodilGuessedBtn').addEventListener('click', ()=>{
  playSuccessSound();
  kkrRoundGuessed++;
  if(kkrRoundGuessed + kkrRoundSkipped >= (state.kidsKrokodilWordsPerRound || 5)){ kkrRoundEnd(); }
  else { kkrDrawWord(); }
});
document.getElementById('kidsKrokodilSkipBtn').addEventListener('click', ()=>{
  kkrRoundSkipped++;
  if(kkrRoundGuessed + kkrRoundSkipped >= (state.kidsKrokodilWordsPerRound || 5)){ kkrRoundEnd(); }
  else { kkrDrawWord(); }
});
document.getElementById('kidsKrokodilNextPlayerBtn').addEventListener('click', ()=>{ kkrNextPlayerRound(); });
document.getElementById('kidsKrokodilFinishBtn').addEventListener('click', ()=>{ exitKidsKrokodilGame(); });
document.getElementById('closeKidsKrokodilSummaryBtn').addEventListener('click', ()=>{ exitKidsKrokodilGame(); });
document.getElementById('kidsKrokodilExitBtn').addEventListener('click', ()=>{ exitKidsKrokodilGame(); });
(document.getElementById('kidsKrokodilSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ showModal('kidsKrokodilRulesModal'); });
document.getElementById('closeKidsKrokodilRulesBtn').addEventListener('click', ()=>{ hideModal('kidsKrokodilRulesModal'); });
document.getElementById('kidsKrokodilRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'kidsKrokodilRulesModal') e.currentTarget.classList.remove('show'); });
