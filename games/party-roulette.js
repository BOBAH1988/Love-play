// games/party-roulette.js — Игра "Рулетка" (компания).
// Загружается через <script src="games/party-roulette.js"></script> в index.html.
// Казино-рулетка: поле ставок (числа 0-36 + внешние ставки цвет/чёт-нечет/
// половина), фишки, волчок, который крутится случайно, как в казино. Игроки
// берутся из общего списка "Игры для компании" (state.partyPlayers), у
// каждого свой баланс фишек, ходят по очереди. Прогресс сохраняется в state.

const ROULETTE_WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const ROULETTE_RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
// Цвета фишек по номиналам — как на картинке пользователя:
// 10 = голубая (светлая), 50 = синяя, 100 = зелёная, 500 = красная.
const ROULETTE_CHIP_COLORS = {
  10:  { bg: 'linear-gradient(135deg,#bae6fd,#38bdf8)', text: '#fff' },
  50:  { bg: 'linear-gradient(135deg,#60a5fa,#1d4ed8)', text: '#fff' },
  100: { bg: 'linear-gradient(135deg,#4ade80,#15803d)', text: '#fff' },
  500: { bg: 'linear-gradient(135deg,#f87171,#b91c1c)', text: '#fff' }
};
const ROULETTE_CHIPS = Object.keys(ROULETTE_CHIP_COLORS).map(Number);
const ROULETTE_START_BALANCE = 1000;

// Глобальное состояние ставок — массив объектов, по одному на каждого игрока
let roulettePlayerBets = [];
let rouletteSelectedChip = 10;
let rouletteSpinning = false;
let rouletteWheelTotalRotation = 0;
// Режим «Свое поле»: игра с офлайн-полем, приложение используется только
// как рулетка — ставки не принимаются и не запоминаются, балансы не меняются.
let rouletteCustomMode = false;
// id отложенного обработчика кручения — чтобы можно было отменить его при выходе
let rouletteSpinTimer = null;
// Счётчик сессий кручения: позволяет отменить отложенный запуск анимации
// (requestAnimationFrame) при выходе из режима или новом заходе в игру
let rouletteSpinSession = 0;

function rouletteColorOf(n){
  if(n === 0) return 'green';
  return ROULETTE_RED.has(n) ? 'red' : 'black';
}
function rouletteColorHex(color){
  return color === 'red' ? '#e63946' : color === 'black' ? '#222' : '#2ecc71';
}

/* Определения выигрыша и множителя ставок. Ключи ставок:
 *  - числа: 'num-0' (ноль), 'n1'..'n36'
 *  - внешние: 'color-red', 'color-black', 'parity-even', 'parity-odd',
 *    'range-low' (1-18), 'range-high' (19-36)
 * Число платит 35:1 (плюс возвращается сама ставка), внешние — 1:1. */
function rouletteBetMultiplier(key){
  return (key.startsWith('n') || key.startsWith('num')) ? 35 : 1;
}
function rouletteBetWins(key, n){
  if(key.startsWith('n') || key.startsWith('num')){
    const num = parseInt(key.replace(/^num-|^n/, ''), 10);
    return num === n;
  }
  switch(key){
    case 'color-red':   return n !== 0 && ROULETTE_RED.has(n);
    case 'color-black': return n !== 0 && !ROULETTE_RED.has(n);
    case 'parity-even': return n !== 0 && n % 2 === 0;
    case 'parity-odd':  return n !== 0 && n % 2 === 1;
    case 'range-low':   return n >= 1 && n <= 18;
    case 'range-high':  return n >= 19 && n <= 36;
  }
  return false;
}

/* ============ ИГРОКИ И БАЛАНС ============ */
function roulettePlayers(){
  return (state.partyPlayers && state.partyPlayers.length >= 2) ? state.partyPlayers : [partyDefaultName(0), partyDefaultName(1)];
}
function ensureRouletteBalances(reset=false){
  const n = roulettePlayers().length;
  if(reset || !state.rouletteBalances || state.rouletteBalances.length !== n){
    state.rouletteBalances = new Array(n).fill(ROULETTE_START_BALANCE);
  }
  if(reset || state.rouletteCurrentPlayerIndex == null || state.rouletteCurrentPlayerIndex >= n){
    state.rouletteCurrentPlayerIndex = 0;
  }
  // Инициализация массива ставок для каждого игрока
  if(reset || !state.roulettePlayerBets || state.roulettePlayerBets.length !== n){
    state.roulettePlayerBets = Array.from({length:n}, ()=>({}));
  }
}
function rouletteCurrentBalance(){
  return state.rouletteBalances[state.rouletteCurrentPlayerIndex] || 0;
}
function rouletteCurrentBets(){
  return state.roulettePlayerBets[state.rouletteCurrentPlayerIndex] || {};
}
function setRouletteCurrentBets(bets){
  if(!state.roulettePlayerBets) state.roulettePlayerBets = [];
  state.roulettePlayerBets[state.rouletteCurrentPlayerIndex] = bets;
}
function updateRouletteTurnLabel(){
  const players = roulettePlayers();
  const idx = state.rouletteCurrentPlayerIndex || 0;
  const row = document.getElementById('roulettePlayersRow');
  if(!row) return;
  row.innerHTML = '';
  players.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'roulette-player-btn' + (i === idx ? ' active' : '');
    btn.innerHTML = `${name}<br><small style="font-weight:400;opacity:.8;">${state.rouletteBalances[i] || 0} фишек</small><span class="roulette-player-bet-info" data-player-bet-info="${i}" style="display:none;"></span>`;
    btn.addEventListener('click', ()=>{
      if(rouletteSpinning) return;
      state.rouletteCurrentPlayerIndex = i;
      saveState();
      renderRouletteBadges();
      updateRouletteTurnLabel();
      updateRouletteBetTotal();
    });
    row.appendChild(btn);
  });
  updateRoulettePlayerBetInfo();
}

/* ============ ПОЛЕ СТАВОК ============ */
// Подпись ставки: ключ → «куда поставил»
function rouletteBetLabel(key){
  const labels = {
    'num-0':'Зеро', 'color-red':'Красное', 'color-black':'Чёрное',
    'parity-even':'Чёт', 'parity-odd':'Нечет', 'range-low':'1–18', 'range-high':'19–36'
  };
  if(labels[key]) return labels[key];
  const m = /^n(\d+)$/.exec(key);
  return m ? 'Число ' + m[1] : key;
}
// Информационное поле под именем игрока: куда поставил и сумма
function updateRoulettePlayerBetInfo(){
  (state.roulettePlayerBets || []).forEach((playerBets, i) => {
    const el = document.querySelector('[data-player-bet-info="' + i + '"]');
    if(!el) return;
    const parts = Object.keys(playerBets || {}).map(key => rouletteBetLabel(key) + ': ' + playerBets[key]);
    if(parts.length){
      el.textContent = parts.join(' · ');
      el.style.display = '';
    } else {
      el.textContent = '';
      el.style.display = 'none';
    }
  });
}
// Сумма ставок текущего игрока
function rouletteBetTotal(){
  return Object.values(rouletteCurrentBets()).reduce((a,b)=>a+b, 0);
}
// Сумма ВСЕХ ставок ВСЕХ игроков
function rouletteAllBetsTotal(){
  let total = 0;
    (state.roulettePlayerBets || []).forEach(pb => {
    if(!pb) return;
    total += Object.values(pb).reduce((a,b)=>a+b, 0);
  });
  return total;
}
function updateRouletteBetTotal(){
  const el = document.getElementById('rouletteBetTotal');
  if(el) el.textContent = `Ставка: ${rouletteBetTotal()} · Осталось: ${rouletteCurrentBalance()} · Всего на поле: ${rouletteAllBetsTotal()}`;
  const spinBtn = document.getElementById('rouletteSpinBtn');
  if(spinBtn) spinBtn.disabled = rouletteSpinning || rouletteAllBetsTotal() === 0;
}
function renderRouletteBadges(){
  // Удаляем все существующие бейджи
  document.querySelectorAll('[data-bet]').forEach(el=>{
    const badge = el.querySelector('.roulette-bet-badge');
    if(badge) badge.remove();
    el.classList.remove('has-bet');
  });

  // Суммируем ставки ВСЕХ игроков по каждому полю: на клетке — круглый жетон
  // только с общей суммой; кто сколько поставил — видно в инфо-полях под именами
  const totals = {};
  (state.roulettePlayerBets || []).forEach(pb => {
    Object.keys(pb || {}).forEach(key=>{
      totals[key] = (totals[key] || 0) + pb[key];
    });
  });
  Object.keys(totals).forEach(key=>{
    const cell = document.querySelector(`[data-bet="${key}"]`);
    if(!cell) return;
    cell.classList.add('has-bet');
    let badge = cell.querySelector('.roulette-bet-badge');
    if(!badge){
      badge = document.createElement('div');
      badge.className = 'roulette-bet-badge';
      cell.appendChild(badge);
    }
    badge.textContent = totals[key];
  });
  updateRoulettePlayerBetInfo();
}
function addRouletteBet(key){
  if(rouletteSpinning) return;
  const cur = rouletteCurrentBets();
  const currentTotal = Object.values(cur).reduce((a,b)=>a+b, 0);
  if(currentTotal + rouletteSelectedChip > rouletteCurrentBalance()){
    showToast('Недостаточно фишек');
    playErrorSound();
    return;
  }
  cur[key] = (cur[key] || 0) + rouletteSelectedChip;
  setRouletteCurrentBets(cur);
  saveState();
  renderRouletteBadges();
  updateRouletteBetTotal();
  playSuccessSound();
}
function clearRouletteBets(){
  if(rouletteSpinning) return;
  setRouletteCurrentBets({});
  saveState();
  renderRouletteBadges();
  updateRouletteBetTotal();
}
function renderRouletteChips(){
  const wrap = document.getElementById('rouletteChipsRow');
  if(!wrap) return;
  wrap.innerHTML = '';
  ROULETTE_CHIPS.forEach(val=>{
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'roulette-chip' + (val === rouletteSelectedChip ? ' active' : '');
    c.setAttribute('data-chip', val);
    c.style.setProperty('--chip-bg', ROULETTE_CHIP_COLORS[val].bg);
    c.style.setProperty('--chip-text', ROULETTE_CHIP_COLORS[val].text);
    c.textContent = val;
    c.addEventListener('click', ()=>{
      rouletteSelectedChip = val;
      renderRouletteChips();
    });
    wrap.appendChild(c);
  });
}
function renderRouletteNumberGrid(){
  const grid = document.getElementById('rouletteNumberGrid');
  if(!grid) return;
  grid.innerHTML = '';
    for(let n=1;n<=36;n++){
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'roulette-number-cell roulette-' + rouletteColorOf(n);
    cell.setAttribute('data-bet', 'n'+n);
    cell.textContent = n;
    cell.addEventListener('click', ()=>{ addRouletteBet('n'+n); });
    grid.appendChild(cell);
  }
}
function rouletteBindOutsideBets(){
  // Ключи должны совпадать с data-bet в HTML и с ключами в
  // rouletteBetWins()/rouletteBetMultiplier().
  ['num-0','color-red','color-black','parity-even','parity-odd','range-low','range-high'].forEach(key=>{
    const el = document.querySelector(`[data-bet="${key}"]`);
    if(el) el.addEventListener('click', ()=>{ addRouletteBet(key); });
  });
}

/* Рисует колесо рулетки как SVG: 37 секторов в порядке ROULETTE_WHEEL_ORDER,
 * с чередованием красный/чёрный (ноль — зелёный) и числами по радиусу.
 * Фон на CSS-градиенте (conic-gradient) не используется — его нет в Firefox. */
function buildRouletteWheel(){
  const wheelEl = document.getElementById('rouletteSpinWheel');
  if(!wheelEl || wheelEl.querySelector('svg')) return;
  const n = ROULETTE_WHEEL_ORDER.length; // 37
  const S = 1000, cx = 500, cy = 500, r = 480;
  const seg = 360 / n;
  let svg = `<svg viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">`;
  ROULETTE_WHEEL_ORDER.forEach((num, i) => {
    const a1 = (i * seg - 90) * Math.PI / 180;
    const a2 = ((i + 1) * seg - 90) * Math.PI / 180;
    const color = rouletteColorHex(rouletteColorOf(num));
    // Сектор
    svg += `<path d="M ${cx},${cy} L ${cx + r*Math.cos(a1)},${cy + r*Math.sin(a1)} L ${cx + r*Math.cos(a2)},${cy + r*Math.sin(a2)} Z" fill="${color}" stroke="rgba(255,255,255,.35)" stroke-width="2"/>`;
    // Число по центру сектора, ориентировано по радиусу
    const mid = (i * seg + seg/2 - 90) * Math.PI / 180;
    const tr = r * 0.72;
    const tx = cx + tr * Math.cos(mid);
    const ty = cy + tr * Math.sin(mid);
    const deg = (i * seg + seg/2) - 90 + 90; // угол от вертикали, чтобы числа стояли «к центру»
    svg += `<text x="${tx}" y="${ty}" fill="#fff" font-size="46" font-weight="700" text-anchor="middle" dominant-baseline="central" style="transform-origin:${tx}px ${ty}px; transform:rotate(${deg}deg)">${num}</text>`;
  });
  svg += `</svg>`;
  wheelEl.innerHTML = svg;
}

/* ============ МОДАЛЬНОЕ ОКНО КРУЧЕНИЯ ============ */
function openRouletteSpinModal(){
  const modal = document.getElementById('rouletteSpinModal');
  if(!modal) return;
  modal.classList.add('show');
}
function closeRouletteSpinModal(){
  const modal = document.getElementById('rouletteSpinModal');
  if(modal) modal.classList.remove('show');
}

/* Красный крестик в правом верхнем углу окна кручения — экстренный выход
 * из режима «Свое поле». Прибит к углу экрана (модалка position:fixed),
 * поэтому виден всегда, даже если контент карточки не влез по высоте.
 * Создается динамически, если его нет в кэше HTML устройства. Все стили
 * задаются инлайново — старый кэш CSS не может исказить вид крестика. */
function ensureRouletteCustomCloseX(){
  let x = document.getElementById('rouletteCustomCloseX');
  if(!x){
    const modal = document.getElementById('rouletteSpinModal');
    if(!modal) return null;
    x = document.createElement('button');
    x.type = 'button';
    x.id = 'rouletteCustomCloseX';
    x.textContent = '✕';
    x.setAttribute('aria-label', 'Выход');
    modal.appendChild(x);
  }
  // Стили инлайном при КАЖДОМ вызове: тёмно-красный круг, белый крестик
  // по центру — вид не зависит от версии CSS в кэше устройства
  x.style.cssText = [
    'position:absolute', 'top:calc(14px + env(safe-area-inset-top))', 'right:14px',
    'width:34px', 'height:34px', 'padding:0', 'margin:0', 'flex:none',
    'border:2px solid rgba(255,255,255,.45)', 'border-radius:50%',
    'background:#8b0000', 'color:#fff', 'font-size:18px', 'font-weight:700',
    'line-height:1', 'display:flex', 'align-items:center', 'justify-content:center',
    'box-shadow:0 4px 14px rgba(0,0,0,.55)', 'cursor:pointer', 'z-index:310',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation'
  ].join(';');
  // Вне режима «Свое поле» — скрыт; показом/скрытием управляет JS (flex/none)
  // после каждого вызова ensureRouletteCustomCloseX()
  x.style.display = 'none';
  if(!x.dataset.bound){
    x.dataset.bound = '1';
    x.addEventListener('click', exitRouletteCustomMode);
  }
  return x;
}

/* Удаляем устаревшую кнопку «Выход» из окна кручения: она не отображалась
 * (заменена крестиком), а в старом кэше HTML могла остаться видимой. */
(function removeLegacyRouletteExitBtn(){
  const legacy = document.getElementById('rouletteCustomExitBtn');
  if(legacy) legacy.remove();
  const actions = document.querySelector('#rouletteSpinModal .roulette-spin-actions');
  // Пустой контейнер без кнопок тоже убираем, чтобы не занимал место
  if(actions && !actions.querySelector('button')) actions.remove();
})();

/* Выход из режима «Свое поле» на предыдущий экран (экран рулетки) */
function exitRouletteCustomMode(){
  rouletteCustomMode = false;
  const closeX = document.getElementById('rouletteCustomCloseX');
  if(closeX) closeX.style.display = 'none';
  const modalEl = document.getElementById('rouletteSpinModal');
  if(modalEl) modalEl.classList.remove('custom-mode');
  // Отменяем отложенное завершение кручения и запуск анимации — иначе после
  // выхода сработает обычная логика начисления выигрыша по ставкам
  rouletteSpinSession++;
  if(rouletteSpinTimer){ clearTimeout(rouletteSpinTimer); rouletteSpinTimer = null; }
  closeRouletteSpinModal();
  rouletteSpinning = false;
  document.getElementById('rouletteSpinBtn').disabled = false;
  document.getElementById('rouletteClearBetsBtn').disabled = false;
  updateRouletteBetTotal();
}

function spinRouletteWheel(){
  if(rouletteSpinning) return;
  const allBetsTotal = rouletteAllBetsTotal();
  if(!rouletteCustomMode && allBetsTotal === 0){
    showToast('Сделайте ставку');
    playErrorSound();
    return;
  }
  
  rouletteSpinning = true;
  document.getElementById('rouletteClearBetsBtn').disabled = !rouletteCustomMode;
  document.getElementById('rouletteSpinBtn').disabled = true;
  
  if(!rouletteCustomMode){
    // Списываем ставки с балансов игроков пропорционально
    const players = roulettePlayers();
      (state.roulettePlayerBets || []).forEach((playerBets, idx) => {
      if(!playerBets) return;
      const playerTotal = Object.values(playerBets).reduce((a,b)=>a+b, 0);
      state.rouletteBalances[idx] = (state.rouletteBalances[idx] || 0) - playerTotal;
    });
    saveState();
  }
  updateRouletteBetTotal();
  openRouletteSpinModal();
  // Звук старта вращения — в обеих версиях (обычной и «Свое поле»).
  // typeof-защита: при старом кэше core.js функции может не быть — спин не должен упасть.
  if(typeof playSpinStartSound === 'function') playSpinStartSound();
  // В режиме «Свое поле» кнопка выхода видна сразу — можно прервать в любой
  // момент. Управляем и классом на модалке (CSS), и inline-стилем: кнопка
  // показывается независимо от состояния кэша и CSS-специфичности.
  const modalEl = document.getElementById('rouletteSpinModal');
  if(modalEl) modalEl.classList.toggle('custom-mode', rouletteCustomMode);
  const closeX = ensureRouletteCustomCloseX();
  if(closeX) closeX.style.display = rouletteCustomMode ? 'flex' : 'none';
  
  const winningNumber = Math.floor(Math.random() * 37);
  const wheelEl = document.getElementById('rouletteSpinWheel');
  const resultEl = document.getElementById('rouletteSpinResult');
  const doneBtn = document.getElementById('rouletteSpinDoneBtn');
    doneBtn && (doneBtn.style.display = 'none');
  resultEl.textContent = 'Крутится...';
  
  // Анимация колеса. ПРИНЦИПЫ:
  // 1) ВСЕГДА по часовой стрелке: угол НАКАПЛИВАЕТСЯ — к текущему положению
  //    добавляем доворот до целевого сектора + полные обороты. Раньше угол
  //    пересчитывался с нуля (baseTurns*360 + target), из-за чего на следующих
  //    спинах целевой угол мог оказаться МЕНЬШЕ текущего — колесо крутилось
  //    назад и делало меньше оборотов.
  // 2) Минимум 3 полных оборота за спин.
  // 3) Быстрый разгон и долгое плавное торможение (easeOutExpo-кривая).
  // 4) Остановка строго по центру сектора-результата под стрелкой: финальный
  //    угол всегда ≡ targetMod (mod 360) без накопительной погрешности.
  const targetIdx = ROULETTE_WHEEL_ORDER.indexOf(winningNumber);
  const segAngle = 360 / ROULETTE_WHEEL_ORDER.length;
  // Угол (mod 360), при котором центр сектора-результата стоит ровно под стрелкой
  const targetMod = ((360 - (targetIdx * segAngle + segAngle / 2)) % 360 + 360) % 360;
  const currentMod = ((rouletteWheelTotalRotation % 360) + 360) % 360;
  let delta = targetMod - currentMod;
  if (delta <= 0) delta += 360;                    // только вперёд, по часовой
  const turns = 3 + Math.floor(Math.random() * 3); // минимум 3 полных оборота (3–5)
  rouletteWheelTotalRotation += delta + turns * 360;
  
  // Анимация колеса. ВАЖНО: модалка только что стала видимой (display:none →
  // flex). CSS-transition не запускается, если элемент был скрыт в момент
  // смены стиля — у него нет «предыдущего» вычисленного состояния, и колесо
  // прыгало в конечный угол без вращения (первый ход в «Своем поле» и ВСЕ ходы
  // в обычном режиме, где модалка открывается заново перед каждым спином).
  // Поэтому фиксируем текущий угол при уже видимой модалке и запускаем
  // transition только через два кадра.
  const spinSession = ++rouletteSpinSession;
  if(wheelEl){
    wheelEl.style.transition = 'none';
    void wheelEl.offsetWidth; // фиксируем «предыдущее» состояние
    // Фолбэк для старых WebView без requestAnimationFrame — иначе бросок
    // здесь оставил бы rouletteSpinning=true и сломал бы игру после списания ставок
    const raf = window.requestAnimationFrame
      ? window.requestAnimationFrame.bind(window)
      : (fn)=>setTimeout(fn, 16);
    raf(()=>{
      raf(()=>{
        if(spinSession !== rouletteSpinSession) return; // кручение отменено
        // Быстрый разгон и длинное плавное торможение (easeOutExpo-подобная кривая)
        wheelEl.style.transition = 'transform 3.2s cubic-bezier(.16,1,.3,1)';
        wheelEl.style.transform = `rotate(${rouletteWheelTotalRotation}deg)`;
      });
    });
  }
  
  rouletteSpinTimer = setTimeout(()=>{
    rouletteSpinTimer = null;
    if(rouletteCustomMode){
      // «Свое поле»: показываем только результат, ставки/балансы не трогаем.
      // Звук окончания кручения — нейтральный (нет выигрыша/проигрыша).
      if(typeof playNeutralSound === 'function') playNeutralSound();
      rouletteSpinning = false;
      const color = rouletteColorOf(winningNumber);
      const colorName = color === 'red' ? 'красное' : color === 'black' ? 'чёрное' : 'зеро';
      resultEl.innerHTML = `Выпало: <b>${winningNumber}</b> (${colorName})`;
      if(doneBtn) doneBtn.style.display = 'block';
      return;
    }
    resolveRouletteSpin(winningNumber);
    const color = rouletteColorOf(winningNumber);
    const colorName = color === 'red' ? 'красное' : color === 'black' ? 'чёрное' : 'зеро';
    const totalBet = allBetsTotal;
    let totalReturn = 0;
    // Вычисляем выигрыш для КАЖДОГО игрока отдельно
    const playerReturns = [];
    (state.roulettePlayerBets || []).forEach((playerBets, idx) => {
      let pReturn = 0;
      let pBet = 0;
      Object.keys(playerBets).forEach(key=>{
        pBet += playerBets[key];
        if(rouletteBetWins(key, winningNumber)){
          pReturn += playerBets[key] * (rouletteBetMultiplier(key) + 1);
        }
      });
      playerReturns.push({bet: pBet, ret: pReturn, net: pReturn - pBet});
      totalReturn += pReturn;
    });
    const net = totalReturn - totalBet;
    // Звук результата уже играет resolveRouletteSpin() — здесь не дублируем
    
    // Распределяем выигрыш по игрокам
    playerReturns.forEach((pr, idx) => {
      state.rouletteBalances[idx] = (state.rouletteBalances[idx] || 0) + pr.ret;
    });
    // Раунд сыгран — учитываем для итогов при выходе
    state.rouletteRoundsPlayed = (state.rouletteRoundsPlayed || 0) + 1;
    
    resultEl.innerHTML = `Выпало: <b>${winningNumber}</b> (${colorName})<br>${net >= 0 ? '🎉 Выигрыш' : '😔 Проигрыш'} <b>${net >= 0 ? '+' : ''}${net}</b>`;
    if(doneBtn) doneBtn.style.display = 'block';
  }, 3700);
}

const rouletteDoneBtnEl = document.getElementById('rouletteSpinDoneBtn');
if(rouletteDoneBtnEl) rouletteDoneBtnEl.addEventListener('click', ()=>{
  if(rouletteCustomMode){
    // «Свое поле»: следующий ход сразу, не выходя с экрана
    spinRouletteWheel();
    return;
  }
  closeRouletteSpinModal();
  // Очищаем ставки всех игроков
  if(state.roulettePlayerBets){
    state.roulettePlayerBets = state.roulettePlayerBets.map(()=>({}));
  }
  renderRouletteBadges();
  rouletteSpinning = false;
  document.getElementById('rouletteClearBetsBtn').disabled = false;
  saveState();
  updateRouletteTurnLabel();
  updateRouletteBetTotal();
  // Если у всех игроков закончились фишки — предлагаем начать новую партию
  if(rouletteAllBalancesZero()){
    const brokeModal = document.getElementById('rouletteBrokeModal');
    if(brokeModal) brokeModal.classList.add('show');
  }
});
function resolveRouletteSpin(n){
  const color = rouletteColorOf(n);
  const totalBet = rouletteAllBetsTotal();
  let totalReturn = 0;
  const playerReturns = [];
    (state.roulettePlayerBets || []).forEach((playerBets, idx) => {
    if(!playerBets){ playerReturns.push(0); return; }
    let pReturn = 0;
    Object.keys(playerBets).forEach(key=>{
      if(rouletteBetWins(key, n)){
        pReturn += playerBets[key] * (rouletteBetMultiplier(key) + 1);
      }
    });
    playerReturns.push(pReturn);
    totalReturn += pReturn;
  });
  const net = totalReturn - totalBet;
  const colorName = color === 'red' ? 'красное' : color === 'black' ? 'чёрное' : 'зеро';
    const resultEl = document.getElementById('rouletteSpinResult');
  if(resultEl){
    resultEl.innerHTML = `Выпало: <b>${n}</b> (${colorName}) — ${net >= 0 ? '🎉 выигрыш' : '😔 проигрыш'} ${net >= 0 ? '+' : ''}${net}`;
  }
  if(net >= 0) playSuccessSound(); else playErrorSound();
  rouletteSpinning = false;
  document.getElementById('rouletteClearBetsBtn').disabled = false;
  updateRouletteBetTotal();
}

/* ============ ПАУЗА / ВЫХОД ============ */
// Итоги игры: баланс каждого игрока относительно стартового
function showRouletteResults(){
  const modal = document.getElementById('rouletteResultsModal');
  const body = document.getElementById('rouletteResultsBody');
  if(!modal || !body) return;
  const start = ROULETTE_START_BALANCE;
  body.innerHTML = roulettePlayers().map((name, i)=>{
    const bal = state.rouletteBalances[i] || 0;
    const net = bal - start;
    const sign = net > 0 ? '+' : '';
    const color = net > 0 ? '#4ade80' : net < 0 ? '#f87171' : '#fff';
    return `<div style="display:flex; justify-content:space-between; gap:10px; padding:5px 0; font-size:15px; border-bottom:1px solid rgba(255,255,255,.12);">`+
      `<span>${name}</span>`+
      `<b>${bal} фишек <span style="color:${color}">(${sign}${net})</span></b>`+
    `</div>`;
  }).join('');
  modal.classList.add('show');
}
function pauseGamePartyRoulette(){
  state.pausedMode = 'partyRoulette';
  saveState();
  const pauseModal = document.getElementById('pauseMenuModal');
  if(pauseModal) pauseModal.classList.add('show');
  // Если сыгран хотя бы 1 раунд — поверх меню паузы показываем итоги
  if((state.rouletteRoundsPlayed || 0) >= 1) showRouletteResults();
}
/* Фишки закончились у всех игроков */
function rouletteAllBalancesZero(){
  const bal = state.rouletteBalances || [];
  return bal.length > 0 && bal.every(b => !b);
}
function resumePartyRouletteGame(){
  const pauseModal = document.getElementById('pauseMenuModal');
  if(pauseModal) pauseModal.classList.remove('show');
  state.pausedMode = null;
  goToGame('setup', 'partyRouletteGame');
  // Продолжение паузы: НЕ сбрасываем балансы/ставки, только гарантируем структуру
  ensureRouletteBalances(false);
  renderRouletteBadges();
  updateRouletteTurnLabel();
  updateRouletteBetTotal();
  renderRouletteChips();
  updateMuteBtn();
}
function finishPartyRouletteGame(){
  state.pausedMode = null;
  state.rouletteBalances = [];
  state.rouletteCurrentPlayerIndex = 0;
  state.roulettePlayerBets = [];
  saveState();
  const pauseModal = document.getElementById('pauseMenuModal');
  if(pauseModal) pauseModal.classList.remove('show');
  exitGame('partyRouletteGame', 'setup');
  showSetupView('companyView');
}

/* ============ ВХОД ============ */
let rouletteInited = false;
function goToPartyRouletteGame(){
  // Новый заход в игру = новая партия: сбрасываем балансы и ставки
  ensureRouletteBalances(true);
  // Режим «Свое поле» всегда начинается заново с экрана рулетки
  rouletteCustomMode = false;
  // Новая партия — счётчик сыгранных раундов обнуляется
  state.rouletteRoundsPlayed = 0;
  rouletteSpinSession++; // отменяем отложенную анимацию прошлого кручения
  const closeX = document.getElementById('rouletteCustomCloseX');
  if(closeX) closeX.style.display = 'none';
  const modalEl = document.getElementById('rouletteSpinModal');
  if(modalEl) modalEl.classList.remove('custom-mode');
  // Сразу фиксируем сброс в localStorage, чтобы после перезагрузки страницы
  // (жёсткой в т.ч.) не вернулись ставки/баланс прошлой партии.
  saveState();
  goToGame('setup', 'partyRouletteGame');
  // Колесо перестраиваем при каждом входе — схopyет и случай, когда PWA
  // отдал старый JS без SVG (функция сама не дублирует сектора).
  buildRouletteWheel();
  if(!rouletteInited){
    renderRouletteNumberGrid();
    rouletteBindOutsideBets();
    rouletteInited = true;
  }
  renderRouletteBadges();
  renderRouletteChips();
  updateRouletteTurnLabel();
  updateRouletteBetTotal();
  document.getElementById('rouletteSpinResult').textContent = '';
  updateMuteBtn();
  rouletteSpinning = false;
  requestWakeLock();
}

/* ============ ИНИЦИАЛИЗАЦИЯ ============ */
const rouletteSpinBtnEl = document.getElementById('rouletteSpinBtn');
if(rouletteSpinBtnEl) rouletteSpinBtnEl.addEventListener('click', spinRouletteWheel);
// «Свое поле»: рулетка без ставок для игры с офлайн-полем
const customBoardBtnEl = document.getElementById('rouletteCustomBoardBtn');
if(customBoardBtnEl) customBoardBtnEl.addEventListener('click', ()=>{
  if(rouletteSpinning) return;
  rouletteCustomMode = true;
  spinRouletteWheel();
});
// Выход из режима «Свое поле» — по красному крестику в углу окна кручения.
// ensureRouletteCustomCloseX() найдёт крестик в HTML или создаст его,
// если устройство держит в кэше старую версию без него.
ensureRouletteCustomCloseX();
const rouletteClearBtnEl = document.getElementById('rouletteClearBetsBtn');
if(rouletteClearBtnEl) rouletteClearBtnEl.addEventListener('click', ()=>{ clearRouletteBets(); });
const roulettePauseBtnEl = document.getElementById('rouletteExitBtn');
if(roulettePauseBtnEl){
  roulettePauseBtnEl.textContent = 'Пауза';
  roulettePauseBtnEl.addEventListener('click', ()=>{ pauseGamePartyRoulette(); });
}
// Итоги игры: «Ок» закрывает окно итогов (под ним остаётся меню паузы)
const rouletteResultsOkEl = document.getElementById('rouletteResultsOkBtn');
if(rouletteResultsOkEl) rouletteResultsOkEl.addEventListener('click', ()=>{
  const m = document.getElementById('rouletteResultsModal');
  if(m) m.classList.remove('show');
});
// «Начать сначала» при нулевых балансах: новая партия
const rouletteBrokeRestartEl = document.getElementById('rouletteBrokeRestartBtn');
if(rouletteBrokeRestartEl) rouletteBrokeRestartEl.addEventListener('click', ()=>{
  ensureRouletteBalances(true);
  state.rouletteRoundsPlayed = 0;
  saveState();
  const m = document.getElementById('rouletteBrokeModal');
  if(m) m.classList.remove('show');
  renderRouletteBadges();
  updateRouletteTurnLabel();
  updateRouletteBetTotal();
});
openRulesModal('rouletteGameRulesBtn', 'partyRouletteRulesModal');
setupRulesModal('partyRouletteRulesModal', 'closePartyRouletteRulesBtn');
