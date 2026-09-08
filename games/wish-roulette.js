// games/wish-roulette.js — «Рулетка желаний» (для двоих).
// Колесо рулетки с 37 секторами (0-36), анимация прокрутки, задания из карточек.
// Общая игра для пары — без ставок и балансов.

const WR_WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const WR_RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

let wrSpinning = false;
let wrWheelTotalRotation = 0;
let wrSpinTimer = null;
let wrSpinSession = 0;
let wrCompleted = 0;

function wrColorOf(n){
  if(n === 0) return 'green';
  return WR_RED.has(n) ? 'red' : 'black';
}
function wrColorName(color){
  return color === 'red' ? 'красное' : color === 'black' ? 'чёрное' : 'зеро';
}
function wrColorHex(color){
  return color === 'red' ? '#e63946' : color === 'black' ? '#222' : '#2ecc71';
}

function wrGetTask(){
  const level = state.wrLevel || 1;
  const cards = (typeof getCards === 'function') ? getCards() : [];
  const pool = cards.filter(c => c.level === level);
  const src = pool.length > 0 ? pool : cards;
  if(src.length === 0) return 'Попросите партнёра обнять вас';
  const card = src[Math.floor(Math.random() * src.length)];
  return card.text || 'Выполните желание партнёра';
}

function wrBuildWheelSVG(){
  const n = WR_WHEEL_ORDER.length;
  const segAngle = 360 / n;
  const radius = 140;
  const cx = 160, cy = 160;
  let svg = `<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">`;
  WR_WHEEL_ORDER.forEach((num, i) => {
    const startAngle = i * segAngle - 90;
    const endAngle = startAngle + segAngle;
    const startRad = startAngle * Math.PI / 180;
    const endRad = endAngle * Math.PI / 180;
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const largeArc = segAngle > 180 ? 1 : 0;
    const color = wrColorHex(wrColorOf(num));
    svg += `<path d="M${cx},${cy} L${x1},${y1} A${radius},${radius} 0 ${largeArc},1 ${x2},${y2} Z" fill="${color}" stroke="rgba(255,255,255,.3)" stroke-width="0.5"/>`;
    const textAngle = (startAngle + segAngle / 2) * Math.PI / 180;
    const textR = radius * 0.72;
    const tx = cx + textR * Math.cos(textAngle);
    const ty = cy + textR * Math.sin(textAngle);
    const rot = startAngle + segAngle / 2 + 90;
    svg += `<text x="${tx}" y="${ty}" fill="#fff" font-size="11" font-weight="700" text-anchor="middle" dominant-baseline="middle" transform="rotate(${rot},${tx},${ty})">${num}</text>`;
  });
  svg += `<circle cx="${cx}" cy="${cy}" r="22" fill="#1a1a2e" stroke="rgba(255,255,255,.4)" stroke-width="2"/>`;
  svg += `</svg>`;
  return svg;
}

function wrSpinWheel(){
  if(wrSpinning) return;
  wrSpinning = true;
  const wheelEl = document.getElementById('wrWheel');
  const resultEl = document.getElementById('wrSpinResult');
  const doneBtn = document.getElementById('wrSpinDoneBtn');
  if(resultEl) resultEl.innerHTML = '';
  if(doneBtn) doneBtn.style.display = 'none';

  const winningNumber = WR_WHEEL_ORDER[Math.floor(Math.random() * WR_WHEEL_ORDER.length)];
  const targetIdx = WR_WHEEL_ORDER.indexOf(winningNumber);
  const segAngle = 360 / WR_WHEEL_ORDER.length;
  const targetMod = ((360 - (targetIdx * segAngle + segAngle / 2)) % 360 + 360) % 360;
  const currentMod = ((wrWheelTotalRotation % 360) + 360) % 360;
  let delta = targetMod - currentMod;
  if(delta <= 0) delta += 360;
  const turns = 3 + Math.floor(Math.random() * 3);
  wrWheelTotalRotation += delta + turns * 360;

  const spinSession = ++wrSpinSession;
  if(wheelEl){
    wheelEl.style.transition = 'none';
    void wheelEl.offsetWidth;
    const raf = window.requestAnimationFrame
      ? window.requestAnimationFrame.bind(window)
      : (fn)=>setTimeout(fn, 16);
    raf(()=>{
      raf(()=>{
        if(spinSession !== wrSpinSession) return;
        wheelEl.style.transition = 'transform 3.2s cubic-bezier(.16,1,.3,1)';
        wheelEl.style.transform = `rotate(${wrWheelTotalRotation}deg)`;
      });
    });
  }

  wrSpinTimer = setTimeout(()=>{
    wrSpinTimer = null;
    if(spinSession !== wrSpinSession) return;
    wrSpinning = false;
    if(typeof playNeutralSound === 'function') playNeutralSound();
    wrShowResult(winningNumber);
  }, 3400);
}

function wrNextSpin(){ wrSpinWheel(); }

function wrTaskDone(){
  wrCompleted++;
  const resultEl = document.getElementById('wrSpinResult');
  if(resultEl) resultEl.innerHTML = `✅ Задание выполнено! (всего: ${wrCompleted})`;
  const doneBtn = document.getElementById('wrSpinDoneBtn');
  if(doneBtn) doneBtn.style.display = 'none';
  setTimeout(()=>{ wrSpinWheel(); }, 1500);
}

function pauseWishRouletteGame(){
  state.pausedMode = 'wishRoulette';
  saveState();
  if(wrSpinTimer){ clearTimeout(wrSpinTimer); wrSpinTimer = null; }
  wrSpinSession++;
  const pauseModal = document.getElementById('pauseMenuModal');
  if(pauseModal) pauseModal.classList.add('show');
  if(wrCompleted > 0) showWishRouletteResults();
}

function showWishRouletteResults(){
  const modal = document.getElementById('wrResultsModal');
  const body = document.getElementById('wrResultsBody');
  if(!modal || !body) return;
  body.innerHTML = `🎉 <b>Поздравляем!</b><br>Вы выполнили <b>${wrCompleted}</b> заданий.<br>Продолжайте в том же духе!`;
  modal.classList.add('show');
}

function resumeWrGame(){
  const pauseModal = document.getElementById('pauseMenuModal');
  if(pauseModal) pauseModal.classList.remove('show');
  state.pausedMode = null;
  goToGame('setup', 'wishRouletteGame');
  const modalEl = document.getElementById('wrSpinModal');
  if(modalEl) modalEl.classList.add('show');
}

function finishWrGame(){
  state.pausedMode = null;
  wrCompleted = 0;
  saveState();
  const pauseModal = document.getElementById('pauseMenuModal');
  if(pauseModal) pauseModal.classList.remove('show');
  const resultsModal = document.getElementById('wrResultsModal');
  if(resultsModal) resultsModal.classList.remove('show');
  exitGame('wishRouletteGame', 'setup');
  showSetupView('twoView');
}

function goToWrGame(){
  wrCompleted = 0;
  wrSpinning = false;
  wrWheelTotalRotation = 0;
  wrSpinSession++;
  if(wrSpinTimer){ clearTimeout(wrSpinTimer); wrSpinTimer = null; }
  state.wrLevel = state.wrLevel || 1;
  goToGame('setup', 'wishRouletteGame');
  const modalEl = document.getElementById('wrSpinModal');
  if(modalEl){
    modalEl.classList.add('show');
    const wheelEl = document.getElementById('wrWheel');
    if(wheelEl) wheelEl.innerHTML = wrBuildWheelSVG();
    const resultEl = document.getElementById('wrSpinResult');
    if(resultEl) resultEl.innerHTML = '';
    const doneBtn = document.getElementById('wrSpinDoneBtn');
    if(doneBtn) doneBtn.style.display = 'none';
  }
}

let wrInited = false;
function initWishRoulette(){
  if(wrInited) return;
  wrInited = true;
  const spinBtn = document.getElementById('wrSpinBtn');
  if(spinBtn) spinBtn.addEventListener('click', wrSpinWheel);
  const doneBtn = document.getElementById('wrSpinDoneBtn');
  if(doneBtn) doneBtn.addEventListener('click', wrTaskDone);
  const nextBtn = document.getElementById('wrNextBtn');
  if(nextBtn) nextBtn.addEventListener('click', wrNextSpin);
  const pauseBtn = document.getElementById('wrPauseBtn');
  if(pauseBtn) pauseBtn.addEventListener('click', pauseWishRouletteGame);
  const resumeBtn = document.getElementById('wrResumeBtn');
  if(resumeBtn) resumeBtn.addEventListener('click', resumeWrGame);
  const finishBtn = document.getElementById('wrFinishBtn');
  if(finishBtn) finishBtn.addEventListener('click', finishWrGame);
  const closeResultsBtn = document.getElementById('wrResultsCloseBtn');
  if(closeResultsBtn) closeResultsBtn.addEventListener('click', ()=>{
    const modal = document.getElementById('wrResultsModal');
    if(modal) modal.classList.remove('show');
  });
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', initWishRoulette);
} else {
  initWishRoulette();
}
