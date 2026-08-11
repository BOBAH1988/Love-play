// games/twister.js — Игра "Твистер" (компания).
// Загружается через <script src="games/twister.js"></script> в index.html.
// Игровое поле — физическое (обычный коврик "Твистер"), приложение только
// объявляет ходы: кто, какой рукой/ногой, на какой цвет. Игроки берутся из
// общего списка "Игры для компании" (state.partyPlayers). Первый ход —
// случайный игрок, дальше по кругу списка; каждый ход также озвучивается.

const TWISTER_LIMBS = [
  { key:'hand-left', text:'левая рука' },
  { key:'hand-right', text:'правая рука' },
  { key:'foot-left', text:'левая нога' },
  { key:'foot-right', text:'правая нога' },
];
const TWISTER_COLORS = [
  { key:'red', name:'красный' },
  { key:'yellow', name:'жёлтый' },
  { key:'green', name:'зелёный' },
  { key:'blue', name:'синий' },
];

let twisterPlayerIdx = 0;
let twisterCurrentMove = null;
let twisterRemaining = 0;
let twisterTotal = 0;
let twisterIntervalId = null;
let twisterRunning = false;

function stopTwisterInterval(){
  if(twisterIntervalId){ clearInterval(twisterIntervalId); twisterIntervalId = null; }
  twisterRunning = false;
}

function renderTwisterDurationGroup(){
  document.querySelectorAll('#twisterDurationGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (state.twisterDuration || 10));
  });
}
document.querySelectorAll('#twisterDurationGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.twisterDuration = parseInt(btn.dataset.value, 10);
    saveState();
    renderTwisterDurationGroup();
  });
});

function updateTwisterBar(){
  const fill = document.getElementById('twisterBarFill');
  const label = document.getElementById('twisterTimeLabel');
  if(!fill || !label) return;
  const pct = twisterTotal > 0 ? Math.round((twisterRemaining / twisterTotal) * 100) : 0;
  fill.style.width = pct + '%';
  label.textContent = '00:' + String(twisterRemaining).padStart(2, '0');
}

function pickTwisterVoice(){
  if(!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const ru = voices.filter(v=>/^ru/i.test(v.lang));
  return (ru.length ? ru : voices)[0] || null;
}
function speakTwisterMove(text){
  if(!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ru-RU';
  utter.rate = 0.95;
  const voice = pickTwisterVoice();
  if(voice) utter.voice = voice;
  window.speechSynthesis.speak(utter);
}

function drawTwisterMove(){
  const players = (state.partyPlayers && state.partyPlayers.length >= 2) ? state.partyPlayers : ['Игрок 1', 'Игрок 2'];
  if(twisterPlayerIdx >= players.length) twisterPlayerIdx = 0;
  const player = players[twisterPlayerIdx];
  const limb = TWISTER_LIMBS[Math.floor(Math.random() * TWISTER_LIMBS.length)];
  const color = TWISTER_COLORS[Math.floor(Math.random() * TWISTER_COLORS.length)];
  const moveText = `${limb.text} на ${color.name}`;
  twisterCurrentMove = { player, limb, color, moveText };
  document.getElementById('twisterPlayerName').textContent = player;
  document.getElementById('twisterMoveText').textContent = moveText;
  speakTwisterMove(`${player}: ${moveText}`);
}

function twisterAdvancePlayer(){
  const players = (state.partyPlayers && state.partyPlayers.length >= 2) ? state.partyPlayers : ['Игрок 1', 'Игрок 2'];
  twisterPlayerIdx = (twisterPlayerIdx + 1) % players.length;
}

function twisterTick(){
  twisterRemaining--;
  updateTwisterBar();
  if(twisterRemaining <= 0){
    twisterAdvancePlayer();
    drawTwisterMove();
    twisterTotal = state.twisterDuration || 10;
    twisterRemaining = twisterTotal;
    updateTwisterBar();
  }
}
function startTwisterTimer(){
  stopTwisterInterval();
  twisterTotal = state.twisterDuration || 10;
  twisterRemaining = twisterTotal;
  updateTwisterBar();
  twisterRunning = true;
  document.getElementById('twisterPauseBtn').textContent = '⏸ Пауза';
  twisterIntervalId = setInterval(twisterTick, 1000);
}

function goToTwisterGame(){
  const players = (state.partyPlayers && state.partyPlayers.length >= 2) ? state.partyPlayers : ['Игрок 1', 'Игрок 2'];
  twisterPlayerIdx = Math.floor(Math.random() * players.length);
  document.getElementById('setup').classList.remove('active');
  document.getElementById('twisterGame').classList.add('active');
  renderTwisterDurationGroup();
  drawTwisterMove();
  startTwisterTimer();
  updateMuteBtn();
  requestWakeLock();
}
function exitTwisterGame(){
  stopTwisterInterval();
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  document.getElementById('twisterGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}

document.getElementById('twisterPauseBtn').addEventListener('click', (e)=>{
  if(twisterRunning){
    stopTwisterInterval();
    e.target.textContent = '▶ Продолжить';
  } else {
    twisterRunning = true;
    e.target.textContent = '⏸ Пауза';
    twisterIntervalId = setInterval(twisterTick, 1000);
  }
});
document.getElementById('twisterNextBtn').addEventListener('click', ()=>{
  playSuccessSound();
  twisterAdvancePlayer();
  drawTwisterMove();
  startTwisterTimer();
});
document.getElementById('twisterExitBtn').addEventListener('click', ()=>{ exitTwisterGame(); });
document.getElementById('twisterGameRulesBtn').addEventListener('click', ()=>{ document.getElementById('twisterRulesModal').classList.add('show'); });
document.getElementById('closeTwisterRulesBtn').addEventListener('click', ()=>{ document.getElementById('twisterRulesModal').classList.remove('show'); });
document.getElementById('twisterRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'twisterRulesModal') e.currentTarget.classList.remove('show'); });
