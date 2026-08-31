// games/party-roulette.js — Игра "Рулетка" (компания).
// Загружается через <script src="games/party-roulette.js"></script> в index.html.
// Казино-рулетка: поле ставок (числа 0-36 + внешние ставки цвет/чёт-нечет/
// половина), фишки, волчок, который крутится случайно, как в казино. Игроки
// берутся из общего списка "Игры для компании" (state.partyPlayers), у
// каждого свой баланс фишек, ходят по очереди. Прогресс партии (баланс,
// чей ход) сохраняется в state, но без общего меню паузы — "Выход" просто
// возвращает в меню, баланс сохранён на следующий заход.

const ROULETTE_WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const ROULETTE_RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const ROULETTE_CHIPS = [10, 50, 100, 500];
const ROULETTE_START_BALANCE = 1000;

let rouletteBets = {};
let rouletteSelectedChip = 10;
let rouletteSpinning = false;
let rouletteWheelTotalRotation = 0;

function rouletteColorOf(n){
  if(n === 0) return 'green';
  return ROULETTE_RED.has(n) ? 'red' : 'black';
}
function rouletteColorHex(color){
  return color === 'red' ? '#e63946' : color === 'black' ? '#222' : '#2ecc71';
}

/* ============ ИГРОКИ И БАЛАНС ============ */
function roulettePlayers(){
  return (state.partyPlayers && state.partyPlayers.length >= 2) ? state.partyPlayers : ['Игрок 1', 'Игрок 2'];
}
function ensureRouletteBalances(){
  const n = roulettePlayers().length;
  if(!state.rouletteBalances || state.rouletteBalances.length !== n){
    state.rouletteBalances = new Array(n).fill(ROULETTE_START_BALANCE);
  }
  if(state.rouletteCurrentPlayerIndex == null || state.rouletteCurrentPlayerIndex >= n){
    state.rouletteCurrentPlayerIndex = 0;
  }
}
function rouletteCurrentBalance(){
  return state.rouletteBalances[state.rouletteCurrentPlayerIndex] || 0;
}
function updateRouletteTurnLabel(){
  const players = roulettePlayers();
  const idx = state.rouletteCurrentPlayerIndex || 0;
  const el = document.getElementById('rouletteTurnLabel');
  if(el) el.textContent = `Ходит: ${players[idx]} · Баланс: ${rouletteCurrentBalance()} фишек`;
}

/* ============ ПОЛЕ СТАВОК ============ */
function rouletteBetTotal(){
  return Object.values(rouletteBets).reduce((a,b)=>a+b, 0);
}
function updateRouletteBetTotal(){
  const el = document.getElementById('rouletteBetTotal');
  if(el) el.textContent = `Ставка: ${rouletteBetTotal()} · Осталось: ${rouletteCurrentBalance()}`;
  const spinBtn = document.getElementById('rouletteSpinBtn');
  if(spinBtn) spinBtn.disabled = rouletteSpinning || Object.keys(rouletteBets).length === 0;
}
function renderRouletteBadges(){
  document.querySelectorAll('[data-bet]').forEach(cell=>{
    const key = cell.dataset.bet;
    const amount = rouletteBets[key] || 0;
    let badge = cell.querySelector('.roulette-bet-badge');
    if(amount > 0){
      if(!badge){
        badge = document.createElement('span');
        badge.className = 'roulette-bet-badge';
        cell.appendChild(badge);
      }
      badge.textContent = amount;
    } else if(badge){
      badge.remove();
    }
  });
}
function placeRouletteBet(key){
  if(rouletteSpinning) return;
  const chip = rouletteSelectedChip;
  if(rouletteBetTotal() + chip > rouletteCurrentBalance()){
    playErrorSound();
    showToast('Недостаточно фишек 💸');
    return;
  }
  rouletteBets[key] = (rouletteBets[key] || 0) + chip;
  playNeutralSound();
  renderRouletteBadges();
  updateRouletteBetTotal();
}
function renderRouletteNumberGrid(){
  const wrap = document.getElementById('rouletteNumberGrid');
  if(!wrap) return;
  wrap.innerHTML = '';
  for(let n=1; n<=36; n++){
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'roulette-number-cell roulette-' + rouletteColorOf(n);
    cell.dataset.bet = 'num-' + n;
    cell.textContent = n;
    cell.addEventListener('click', ()=>placeRouletteBet('num-' + n));
    wrap.appendChild(cell);
  }
}
function buildRouletteWheelBackground(){
  const wedge = 360/ROULETTE_WHEEL_ORDER.length;
  const stops = ROULETTE_WHEEL_ORDER.map((num, i)=>{
    const color = rouletteColorHex(rouletteColorOf(num));
    return `${color} ${(i*wedge).toFixed(3)}deg ${((i+1)*wedge).toFixed(3)}deg`;
  });
  return `conic-gradient(${stops.join(',')})`;
}
function rouletteBindOutsideBets(){
  document.querySelectorAll('#rouletteOutsideGrid [data-bet]').forEach(btn=>{
    btn.addEventListener('click', ()=>placeRouletteBet(btn.dataset.bet));
  });
  document.getElementById('rouletteZeroCell').addEventListener('click', ()=>placeRouletteBet('num-0'));
}
function renderRouletteChips(){
  const wrap = document.getElementById('rouletteChipsRow');
  if(!wrap) return;
  wrap.innerHTML = '';
  ROULETTE_CHIPS.forEach(v=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'roulette-chip' + (v === rouletteSelectedChip ? ' roulette-chip-selected' : '');
    btn.textContent = v;
    btn.addEventListener('click', ()=>{
      rouletteSelectedChip = v;
      renderRouletteChips();
    });
    wrap.appendChild(btn);
  });
}
function clearRouletteBets(){
  if(rouletteSpinning) return;
  rouletteBets = {};
  renderRouletteBadges();
  updateRouletteBetTotal();
}

/* ============ ВРАЩЕНИЕ И РЕЗУЛЬТАТ ============ */
function rouletteBetWins(key, n){
  if(key.startsWith('num-')) return parseInt(key.slice(4), 10) === n;
  if(key === 'color-red') return rouletteColorOf(n) === 'red';
  if(key === 'color-black') return rouletteColorOf(n) === 'black';
  if(key === 'parity-even') return n !== 0 && n % 2 === 0;
  if(key === 'parity-odd') return n % 2 === 1;
  if(key === 'range-low') return n >= 1 && n <= 18;
  if(key === 'range-high') return n >= 19 && n <= 36;
  return false;
}
function rouletteBetMultiplier(key){
  return key.startsWith('num-') ? 35 : 1;
}
function spinRouletteWheelTo(winningNumber){
  const wheelEl = document.getElementById('rouletteWheel');
  const idx = ROULETTE_WHEEL_ORDER.indexOf(winningNumber);
  const wedge = 360/ROULETTE_WHEEL_ORDER.length;
  const desiredMod = (360 - idx*wedge) % 360;
  const currentMod = rouletteWheelTotalRotation % 360;
  const deltaToDesired = (desiredMod - currentMod + 360) % 360;
  const extraSpins = (5 + Math.floor(Math.random()*3)) * 360;
  const jitter = (Math.random()-0.5) * (wedge*0.6);
  rouletteWheelTotalRotation += extraSpins + deltaToDesired + jitter;
  if(wheelEl){
    wheelEl.style.transition = 'transform 3.6s cubic-bezier(0.15,0.65,0.25,1)';
    wheelEl.style.transform = `rotate(${rouletteWheelTotalRotation}deg)`;
  }
}
document.getElementById('rouletteSpinBtn').addEventListener('click', ()=>{
  if(rouletteSpinning || Object.keys(rouletteBets).length === 0) return;
  rouletteSpinning = true;
  updateRouletteBetTotal();
  document.getElementById('rouletteClearBetsBtn').disabled = true;
  document.getElementById('rouletteResult').textContent = '';
  playSuccessSound();
  const winningNumber = ROULETTE_WHEEL_ORDER[Math.floor(Math.random()*ROULETTE_WHEEL_ORDER.length)];
  spinRouletteWheelTo(winningNumber);
  setTimeout(()=>{ resolveRouletteSpin(winningNumber); }, 3700);
});
function resolveRouletteSpin(n){
  const color = rouletteColorOf(n);
  let totalReturn = 0;
  Object.keys(rouletteBets).forEach(key=>{
    if(rouletteBetWins(key, n)){
      totalReturn += rouletteBets[key] * (rouletteBetMultiplier(key) + 1);
    }
  });
  const totalBet = rouletteBetTotal();
  const idx = state.rouletteCurrentPlayerIndex || 0;
  state.rouletteBalances[idx] = (state.rouletteBalances[idx] || 0) + totalReturn;
  const net = totalReturn - totalBet;
  const colorName = color === 'red' ? 'красное' : color === 'black' ? 'чёрное' : 'зеро';
  const resultEl = document.getElementById('rouletteResult');
  if(resultEl){
    resultEl.innerHTML = `Выпало: <b>${n}</b> (${colorName}) — ${net >= 0 ? '🎉 выигрыш' : '😔 проигрыш'} ${net >= 0 ? '+' : ''}${net}`;
  }
  if(net >= 0) playSuccessSound(); else playErrorSound();
  rouletteBets = {};
  renderRouletteBadges();
  rouletteSpinning = false;
  document.getElementById('rouletteClearBetsBtn').disabled = false;
  const players = roulettePlayers();
  state.rouletteCurrentPlayerIndex = (idx + 1) % players.length;
  saveState();
  updateRouletteTurnLabel();
  updateRouletteBetTotal();
}

/* ============ ВХОД/ВЫХОД ============ */
let rouletteInited = false;
function goToPartyRouletteGame(){
  ensureRouletteBalances();
  goToGame('setup', 'partyRouletteGame');
  if(!rouletteInited){
    renderRouletteNumberGrid();
    rouletteBindOutsideBets();
    document.getElementById('rouletteWheel').style.background = buildRouletteWheelBackground();
    rouletteInited = true;
  }
  rouletteBets = {};
  renderRouletteBadges();
  renderRouletteChips();
  updateRouletteTurnLabel();
  updateRouletteBetTotal();
  document.getElementById('rouletteResult').textContent = '';
  updateMuteBtn();
  requestWakeLock();
}
function exitPartyRouletteGame(){
  saveState();
  exitGame('partyRouletteGame', 'setup');
  showSetupView('companyView');
}
document.getElementById('rouletteClearBetsBtn').addEventListener('click', ()=>{ clearRouletteBets(); });
document.getElementById('rouletteExitBtn').addEventListener('click', ()=>{ exitPartyRouletteGame(); });
openRulesModal('rouletteGameRulesBtn', 'partyRouletteRulesModal');
setupRulesModal('partyRouletteRulesModal', 'closePartyRouletteRulesBtn');

