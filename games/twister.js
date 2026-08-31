// games/twister.js — Игра "Твистер" (компания).
// Загружается через <script src="games/twister.js"></script> в index.html.
// Игровое поле — физическое (обычный коврик "Твистер"), приложение только
// объявляет ходы: кто, какой рукой/ногой, на какой цвет. Игроки берутся из
// общего списка "Игры для компании" (state.partyPlayers). Первый ход —
// случайный игрок, дальше по кругу списка; каждый ход также озвучивается.

const TWISTER_LIMBS = [
  { key:'hand-left', text:'левая рука', icon:'✋' },
  { key:'hand-right', text:'правая рука', icon:'✋' },
  { key:'foot-left', text:'левая нога', icon:'🦶' },
  { key:'foot-right', text:'правая нога', icon:'🦶' },
];
const TWISTER_COLORS = [
  { key:'red', name:'красный', hex:'#e63946' },
  { key:'yellow', name:'жёлтый', hex:'#f4c430' },
  { key:'green', name:'зелёный', hex:'#3cb043' },
  { key:'blue', name:'синий', hex:'#2f6fed' },
];

let twisterPlayerIdx = 0;
let twisterCurrentMove = null;
let twisterRemaining = 0;
let twisterTotal = 0;
let twisterIntervalId = null;
let twisterRunning = false;
// Игра ждёт явной команды "▶ Начать" перед первым запуском отсчёта — см.
// goToTwisterGame() и обработчик twisterPauseBtn.
let twisterStarted = false;

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
  // Известная особенность Web Speech API в некоторых браузерах: speak(),
  // вызванный сразу вслед за cancel(), молча "проглатывается" (речь не
  // звучит, хотя ошибки нет) — небольшая задержка перед speak() надёжно
  // это обходит (тот же приём, что рекомендуют для Chrome/Android WebView).
  setTimeout(()=>{
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ru-RU';
    utter.rate = 0.95;
    const voice = pickTwisterVoice();
    if(voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
  }, 60);
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
  const circleEl = document.getElementById('twisterLimbCircle');
  if(circleEl){
    circleEl.style.background = color.hex;
    circleEl.textContent = limb.icon;
  }
  speakTwisterMove(`${player}: ${moveText}`);
}

// Показывается при входе в игру и после выхода/паузы — до нажатия "▶ Начать
// игру" никакой ход не объявляется и не озвучивается.
function renderTwisterIdleCard(){
  const circleEl = document.getElementById('twisterLimbCircle');
  if(circleEl){
    circleEl.style.background = '#ffffff';
    circleEl.textContent = '🤸';
  }
  document.getElementById('twisterPlayerName').textContent = 'Готовы?';
  document.getElementById('twisterMoveText').textContent = 'Нажми начать игру';
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
  stopTwisterInterval();
  twisterStarted = false;
  // Ход ещё не объявляется и не озвучивается — только заглушка с иконкой и
  // подписью "Начать игру", пока игроки не встали на поле и не нажали кнопку.
  renderTwisterIdleCard();
  twisterTotal = state.twisterDuration || 10;
  twisterRemaining = twisterTotal;
  updateTwisterBar();
  document.getElementById('twisterPauseBtn').textContent = '▶ Начать игру';
  updateMuteBtn();
  requestWakeLock();
}
function exitTwisterGame(){
  stopTwisterInterval();
  stopSpeech();
  exitGame('twisterGame', 'setup');
}

document.getElementById('twisterPauseBtn').addEventListener('click', (e)=>{
  if(!twisterStarted){
    twisterStarted = true;
    playSuccessSound();
    drawTwisterMove();
    startTwisterTimer();
    return;
  }
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
  twisterStarted = true;
  startTwisterTimer();
});
document.getElementById('twisterExitBtn').addEventListener('click', ()=>{ exitTwisterGame(); });
(document.getElementById('twisterGameRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ document.getElementById('twisterRulesModal').classList.add('show'); });
document.getElementById('closeTwisterRulesBtn').addEventListener('click', ()=>{ document.getElementById('twisterRulesModal').classList.remove('show'); });
document.getElementById('twisterRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'twisterRulesModal') e.currentTarget.classList.remove('show'); });
