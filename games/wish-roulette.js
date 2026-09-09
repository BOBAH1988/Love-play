// games/wish-roulette.js — «Рулетка желаний» (игры для пар 18+)
// Крутится по кругу и выдаёт случайное задание из wish-roulette-cards.js.
// 37 позиций на колесе (как у настоящей рулетки), каждому числу — цвет.
// Задания выбираются случайно из всех доступных (игра бесконечна).

const WISH_ROULETTE_WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const WISH_ROULETTE_RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

const WR_LEVELS = [
  {id:1, name:'Сближение', icon:'💕', desc:'Нежные вопросы и лёгкие действия'},
  {id:2, name:'Разогрев', icon:'🔥', desc:'Чуть смелее — прикосновения и намёки'},
  {id:3, name:'Откровенно 18+', icon:'🔞', desc:'Откровенные вопросы и пошлые действия'},
  {id:4, name:'Фантазии', icon:'✨', desc:'Исполнение желаний и ролевые игры'}
];

function wishColorOf(n){ if(n===0) return 'green'; return WISH_ROULETTE_RED.has(n)?'red':'black'; }
function wishColorName(n){ const c=wishColorOf(n); return c==='red'?'красное':c==='black'?'чёрное':'зелёное(ноль)'; }
function wishColorHex(n){ const c=wishColorOf(n); return c==='red'?'#e74c3c':c==='black'?'#fff':'#2ecc71'; }

function wrLevelById(id){ return WR_LEVELS.find(l => l.id === id) || WR_LEVELS[0]; }

function getCardsForLevel(level){
  return (window.WISH_ROULETTE_CARDS || []).filter(c => c.level === level);
}

function wrRenderSetupLevels(){
  const wrap = document.getElementById('wrSetupLevels');
  if(!wrap) return;
  wrap.innerHTML = '';
  WR_LEVELS.forEach(l => {
    const div = document.createElement('div');
    div.className = 'level-toggle' + (state.wrSelectedLevel === l.id ? ' on' : '');
    div.innerHTML = `<div class="lname">${l.icon} ${l.name}</div><div class="ldesc">${l.desc}</div><div class="level-check"></div>`;
    div.addEventListener('click', () => { state.wrSelectedLevel = l.id; saveState(); wrRenderSetupLevels(); });
    wrap.appendChild(div);
  });
}

function goToWrSetup(){
  if(typeof goToGameSetup === 'function') goToGameSetup('wrSetup', null, () => { wrRenderSetupLevels(); });
}

// ---- Анимация колеса (накапливающийся угол, всегда по часовой, min 3 оборота, плавное торможение) ----
let wishWheelTotalRotation = 0;
let wishSpinning = false;
let wishSpinTimer = null;
let wishSpinSession = 0;
let wishCurrentCard = null;

function drawWishWheel(){
  const wheel = document.getElementById('wrWheel');
  if(!wheel) return;
  const level = state.wrSelectedLevel || 1;
  const cards = getCardsForLevel(level);
  const S = 1000, cx = 500, cy = 500, r = 480;
  const n = WISH_ROULETTE_WHEEL_ORDER.length;
  const seg = 360 / n;
  let svg = `<svg viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">`;
  WISH_ROULETTE_WHEEL_ORDER.forEach((num, i) => {
    const a1 = (i * seg - 90) * Math.PI / 180;
    const a2 = ((i + 1) * seg - 90) * Math.PI / 180;
    const isRed = WISH_ROULETTE_RED.has(num);
    const color = num===0?'#2ecc71':(isRed?'#e63946':'#222');
    const card = cards.find(c => c.number === num);
    const icon = card ? (card.type==='dare'?'🎯':'🤔') : '';
    svg += `<path d="M ${cx},${cy} L ${cx + r*Math.cos(a1)},${cy + r*Math.sin(a1)} L ${cx + r*Math.cos(a2)},${cy + r*Math.sin(a2)} Z" fill="${color}" stroke="rgba(255,255,255,.35)" stroke-width="2"/>`;
    const mid = (i * seg + seg/2 - 90) * Math.PI / 180;
    const tr = r * 0.72;
    const tx = cx + tr * Math.cos(mid);
    const ty = cy + tr * Math.sin(mid);
    const deg = (i * seg + seg/2) - 90 + 90;
    svg += `<text x="${tx}" y="${ty}" fill="#fff" font-size="46" font-weight="700" text-anchor="middle" dominant-baseline="central" style="transform-origin:${tx}px ${ty}px; transform:rotate(${deg}deg)">${icon || num}</text>`;
  });
  svg += `<circle cx="${cx}" cy="${cy}" r="26" fill="#111"/>`;
  svg += `</svg>`;
  wheel.innerHTML = svg;
  wishWheelTotalRotation = 0;
}

function spinWishWheel(){
  if(wishSpinning) return;
  wishSpinning = true;
  const spinBtn = document.getElementById('wrSpinBtn');
  const doneBtn = document.getElementById('wrSpinDoneBtn');
  const nextBtn = document.getElementById('wrNextBtn');
  const resultEl = document.getElementById('wrSpinResult');
  if(spinBtn) spinBtn.disabled = true;
  if(doneBtn) doneBtn.style.display = 'none';
  if(nextBtn) nextBtn.style.display = 'none';
  const modal = document.getElementById('wrSpinModal');
  if(modal) modal.classList.add('show');
  if(resultEl) resultEl.innerHTML = '💫 Крутится...';
  if(typeof playSpinStartSound === 'function') playSpinStartSound();

  const winningNumber = Math.floor(Math.random()*37);
  const segAngle = 360 / WISH_ROULETTE_WHEEL_ORDER.length;
  const targetIdx = WISH_ROULETTE_WHEEL_ORDER.indexOf(winningNumber);
  const targetMod = ((360-(targetIdx*segAngle+segAngle/2))%360+360)%360;
  const currentMod = ((wishWheelTotalRotation%360)+360)%360;
  let delta = targetMod-currentMod;
  if(delta<=0) delta+=360;
  const turns = 3 + Math.floor(Math.random()*3);
  wishWheelTotalRotation += delta + turns*360;

  const session = ++wishSpinSession;
  const wheelEl = document.getElementById('wrWheel');
  if(wheelEl){
    wheelEl.style.transition = 'none';
    void wheelEl.offsetWidth;
    const raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : (fn)=>setTimeout(fn,16);
    raf(()=>{ raf(()=>{
      if(session!==wishSpinSession) return;
      wheelEl.style.transition = 'transform 3.2s cubic-bezier(.16,1,.3,1)';
      wheelEl.style.transform = `rotate(${wishWheelTotalRotation}deg)`;
    });});
  }

  wishSpinTimer = setTimeout(()=>{
    wishSpinTimer = null;
    wishSpinning = false;
    if(typeof playSpinEndSound === 'function') playSpinEndSound();
    wishCurrentCard = pickRandomWishCard();
    const isDare = wishCurrentCard.type === 'dare';
    if(resultEl){
      resultEl.innerHTML = `
        <div style="font-size:20px;margin-bottom:10px;">
          <span style="font-weight:500;">Выпало:</span>
          <b style="font-size:24px;color:${wishColorHex(winningNumber)}">${winningNumber}</b>
          <span style="font-size:16px;opacity:.8;"> (${wishColorName(winningNumber)})</span>
        </div>
        <div style="font-size:14px;line-height:1.4;padding:12px;background:rgba(255,255,255,.06);border-radius:12px;">
          <span style="font-weight:500;">${isDare?'🎯 Действие':'🤔 Правда'}:</span>
          <div style="margin-top:6px;">${wishCurrentCard.text}</div>
        </div>`;
    }
    if(doneBtn) doneBtn.style.display = 'block';
    if(spinBtn) spinBtn.disabled = false;
  },3700);
}

function pickRandomWishCard(){
  const level = state.wrSelectedLevel || 1;
  const cards = getCardsForLevel(level);
  if(cards.length===0) return {text:'Задание не найдено',type:'truth'};
  return cards[Math.floor(Math.random()*cards.length)];
}

function goToWrGame(){
  if(state.pausedMode==='wishRoulette') return resumeWrGame();
  state.pausedMode = 'wishRoulette';
  state.inProgress = true;
  state.wishRouletteInProgress = true;
  state.wishCurrentCard = null;
  saveState();
  document.getElementById('wrGame').classList.add('active');
  const levelLabel = document.getElementById('wrLevelLabel');
  if(levelLabel){
    const lvl = wrLevelById(state.wrSelectedLevel || 1);
    levelLabel.textContent = lvl.icon + ' ' + lvl.name;
  }
  drawWishWheel();
  const resultEl = document.getElementById('wrSpinResult');
  if(resultEl) resultEl.textContent = '';
  const doneBtn = document.getElementById('wrSpinDoneBtn');
  if(doneBtn) doneBtn.style.display = 'none';
  const nextBtn = document.getElementById('wrNextBtn');
  if(nextBtn) nextBtn.style.display = 'none';
  const sum = document.getElementById('wrSummaryModal');
  if(sum) sum.classList.remove('show');
  const pauseBtn = document.getElementById('wrPauseBtn');
  if(pauseBtn) pauseBtn.style.display = 'block';
  spinWishWheel();
}

function pauseWrGame(){
  saveState();
  (function m(){ const x=document.getElementById('wrSpinModal'); if(x) x.classList.remove('show'); })();
  document.getElementById('setup').classList.add('active');
  if(typeof showPauseMenu === 'function') showPauseMenu('wishRoulette');
}

function resumeWrGame(){
  state.pausedMode = 'wishRoulette';
  state.inProgress = true;
  saveState();
  document.getElementById('wrGame').classList.add('active');
  const wheel = document.getElementById('wrWheel');
  if(!wheel || !wheel.querySelector('svg')){ drawWishWheel(); }
  else {
    wheel.style.transition = 'none';
    wheel.style.transform = `rotate(${wishWheelTotalRotation}deg)`;
    void wheel.offsetWidth;
  }
  if(wishSpinTimer){ clearTimeout(wishSpinTimer); wishSpinTimer = null; }
  wishSpinning = false;
  if(typeof playPauseSound === 'function') playPauseSound();
}

function finishWrGame(){
  (function m(){ const x=document.getElementById('wrSpinModal'); if(x) x.classList.remove('show'); })();
}

function exitWrGame(){
  wishSpinSession++;
  if(wishSpinTimer){ clearTimeout(wishSpinTimer); wishSpinTimer = null; }
  wishSpinning = false;
  wishCurrentCard = null;
  wishWheelTotalRotation = 0;
  if(typeof stopAllSounds === 'function') stopAllSounds();
  if(typeof stopSpeech === 'function') stopSpeech();
  finishWrGame();
  state.wishRouletteInProgress = false;
  state.pausedMode = null;
  delete state.wishRouletteInProgress;
  delete state.wishCurrentCard;
  saveState();
  document.getElementById('setup').classList.add('active');
}

const wrSpinBtn = document.getElementById('wrSpinBtn');
if(wrSpinBtn) wrSpinBtn.addEventListener('click', spinWishWheel);
const wrSpinDoneBtn = document.getElementById('wrSpinDoneBtn');
if(wrSpinDoneBtn) wrSpinDoneBtn.addEventListener('click',()=>{ wrSpinDoneBtn.style.display='none'; });
const wrNextBtn = document.getElementById('wrNextBtn');
if(wrNextBtn) wrNextBtn.addEventListener('click',()=>{ wrNextBtn.style.display='none'; spinWishWheel(); });
const wrPauseBtn = document.getElementById('wrPauseBtn');
if(wrPauseBtn) wrPauseBtn.addEventListener('click',()=>{ if(!wishSpinning) pauseWrGame(); });
const wrSetupStartBtn = document.getElementById('wrSetupStartBtn');
if(wrSetupStartBtn) wrSetupStartBtn.addEventListener('click', goToWrGame);
const wrSetupExitBtn = document.getElementById('wrSetupExitBtn');
if(wrSetupExitBtn) wrSetupExitBtn.addEventListener('click', ()=>{
  document.getElementById('setup').classList.add('active');
});
if(typeof bindPauseMenuResume === 'function') bindPauseMenuResume('wishRoulette',resumeWrGame,finishWrGame);
