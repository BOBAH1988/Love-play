// games/wish-roulette.js — «Рулетка желаний» (игры для пар 18+)
// Крутится по кругу и выдаёт случайное задание из cards/wish-roulette-cards.js.
// 37 позиций на колесе (как у настоящей рулетки), каждому числу — цвет.
// Задания выбираются случайно из всех доступных (игра бесконечна).

const WISH_ROULETTE_WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const WISH_ROULETTE_RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

const WR_LEVELS = [
  {id:1, name:'Сближение', icon:'💕', desc:'Нежные вопросы и лёгкие действия'},
  {id:2, name:'Разогрев', icon:'🔥', desc:'Чуть смелее — прикосновения и намёки'},
  {id:3, name:'Откровенно 18+', icon:'🔞', desc:'Откровенные вопросы и пошлые действия'},
  {id:4, name:'Фантазии', icon:'✨', desc:'Исполнение желаний и ролевые игры'},
  {id:5, name:'Камасутра', icon:'🪷', desc:'Позы из игры Предложи партнёру'},
  {id:6, name:'Желания', icon:'💫', desc:'Желания из игры Предложи партнёру'}
];

function wishColorOf(n){ if(n===0) return 'green'; return WISH_ROULETTE_RED.has(n)?'red':'black'; }
function wishColorName(n){ const c=wishColorOf(n); return c==='red'?'красное':c==='black'?'чёрное':'зелёное(ноль)'; }
function wishColorHex(n){ const c=wishColorOf(n); return c==='red'?'#e74c3c':c==='black'?'#fff':'#2ecc71'; }

function wrLevelById(id){ return WR_LEVELS.find(l => l.id === id) || WR_LEVELS[0]; }
// Экранирование пользовательских строк (имена игроков) перед вставкой в innerHTML
function wrEsc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

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
  const S = 1000, cx = 500, cy = 500, r = 480;
  const n = WISH_ROULETTE_WHEEL_ORDER.length;
  const seg = 360 / n;
  let svg = `<svg viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">`;
  WISH_ROULETTE_WHEEL_ORDER.forEach((num, i) => {
    const a1 = (i * seg - 90) * Math.PI / 180;
    const a2 = ((i + 1) * seg - 90) * Math.PI / 180;
    const isRed = WISH_ROULETTE_RED.has(num);
    const color = num===0?'#2ecc71':(isRed?'#e63946':'#222');
    svg += `<path d="M ${cx},${cy} L ${cx + r*Math.cos(a1)},${cy + r*Math.sin(a1)} L ${cx + r*Math.cos(a2)},${cy + r*Math.sin(a2)} Z" fill="${color}" stroke="rgba(255,255,255,.35)" stroke-width="2"/>`;
    const mid = (i * seg + seg/2 - 90) * Math.PI / 180;
    const tr = r * 0.72;
    const tx = cx + tr * Math.cos(mid);
    const ty = cy + tr * Math.sin(mid);
    const deg = (i * seg + seg/2) - 90 + 90;
    svg += `<text x="${tx}" y="${ty}" fill="#fff" font-size="46" font-weight="700" text-anchor="middle" dominant-baseline="central" style="transform-origin:${tx}px ${ty}px; transform:rotate(${deg}deg)">${num}</text>`;
  });
  svg += `<circle cx="${cx}" cy="${cy}" r="26" fill="#111"/>`;
  svg += `</svg>`;
  wheel.innerHTML = svg;
  wishWheelTotalRotation = 0;
  wheel.style.transition = 'none';
  wheel.style.transform = 'rotate(0deg)';
}

/* Красный крестик в правом верхнем углу полноэкранного окна кручения — выход
 * обратно на экран игры (как в режиме «Свое поле» рулетки). Создаётся
 * динамически, если его нет в кэше HTML устройства; стили задаются инлайново,
 * чтобы вид не зависел от версии CSS в кэше. */
function ensureWrCloseX(){
  let x = document.getElementById('wrCloseX');
  if(!x){
    const modal = document.getElementById('wrSpinModal');
    if(!modal) return null;
    x = document.createElement('button');
    x.type = 'button';
    x.id = 'wrCloseX';
    x.textContent = '✕';
    x.setAttribute('aria-label', 'Выход в настройки игры');
    modal.appendChild(x);
  }
  x.style.cssText = [
    'position:absolute', 'top:calc(14px + env(safe-area-inset-top))', 'right:14px',
    'width:34px', 'height:34px', 'padding:0', 'margin:0', 'flex:none',
    'border:2px solid rgba(255,255,255,.45)', 'border-radius:50%',
    'background:#8b0000', 'color:#fff', 'font-size:18px', 'font-weight:700',
    'line-height:1', 'display:flex', 'align-items:center', 'justify-content:center',
    'box-shadow:0 4px 14px rgba(0,0,0,.55)', 'cursor:pointer', 'z-index:310',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation'
  ].join(';');
  // Видимостью управляет JS (flex/none) — при каждом показе окна кручения
  x.style.display = 'none';
  if(!x.dataset.bound){
    x.dataset.bound = '1';
    x.addEventListener('click', closeWrSpinModal);
  }
  return x;
}

/* Красный крестик ✕ в окне кручения = «Выход» на шаг назад: полностью
 * завершает партию (отменяет незавершённый спин, сбрасывает состояние)
 * и возвращает на экран настройки игры — можно поменять уровень и начать
 * заново. Промежуточных экранов нет. */
function closeWrSpinModal(){
  wishSpinSession++;
  if(wishSpinTimer){ clearTimeout(wishSpinTimer); wishSpinTimer = null; }
  wishSpinning = false;
  wishCurrentCard = null;
  state.wishCurrentCard = null;
  state.inProgress = false;
  saveState();
  const modal = document.getElementById('wrSpinModal');
  if(modal) modal.classList.remove('show');
  const x = document.getElementById('wrCloseX');
  if(x) x.style.display = 'none';
  if(typeof stopAllSounds === 'function') stopAllSounds();
  goToWrSetup();
}

function spinWishWheel(){
  if(wishSpinning) return;
  wishSpinning = true;
  const doneBtn = document.getElementById('wrSpinDoneBtn');
  const resultEl = document.getElementById('wrSpinResult');
  if(doneBtn) doneBtn.style.display = 'none';
  const modal = document.getElementById('wrSpinModal');
  if(modal) modal.classList.add('show');
  if(resultEl) resultEl.innerHTML = '💫 Крутится...';
  const closeX = ensureWrCloseX();
  if(closeX) closeX.style.display = 'flex';
  if(typeof playSpinStartSound === 'function') playSpinStartSound();

  // Колесо живёт только в полноэкранном окне — рисуем SVG, если его ещё нет
  const wheelEl = document.getElementById('wrWheel');
  if(wheelEl && !wheelEl.querySelector('svg')) drawWishWheel();

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
    // Нейтральный звук результата — как в режиме «Свое поле» рулетки
    if(typeof playNeutralSound === 'function') playNeutralSound();
    // Задание строго соответствует сектору, на который встала стрелка.
    // Цвет сектора определяет исполнителя: ⚫ чёрный — мужчина, 🔴 красный —
    // женщина, 🟢 зеро — общее задание для пары.
    const level = state.wrSelectedLevel || 1;
    const cards = getCardsForLevel(level);
    const landed = cards.find(c => c.number === winningNumber);
    wishCurrentCard = landed || pickRandomWishCard();
    const isDare = wishCurrentCard.type === 'dare';
    if(resultEl){
      const who = wishCurrentCard.who || 'both';
      let whoLine = '';
      // Для уровня 5 (Камасутра) не показываем "Выполняет" и "Общее задание"
      // Для уровня 6 (Желания) меняем надписи на "Желание девушки/парня"
      if(level === 6){
        if(who === 'M'){
          whoLine = 'Желание парня';
        } else if(who === 'F'){
          whoLine = 'Желание девушки';
        } else {
          whoLine = 'Общее желание';
        }
      } else if(level !== 5){
        if(who === 'M'){
          whoLine = (isDare ? 'Выполняет' : 'Отвечает') + ': <b style="color:#ffd23f;">' + wrEsc(state.name1 || 'Мужчина') + '</b>';
        } else if(who === 'F'){
          whoLine = (isDare ? 'Выполняет' : 'Отвечает') + ': <b style="color:#ffd23f;">' + wrEsc(state.name2 || 'Женщина') + '</b>';
        } else {
          whoLine = '🤝 Общее задание — выполняйте вместе';
        }
      }
      const titleLine = wishCurrentCard.title
        ? `<div style="font-size:13px;font-weight:700;margin:0 0 4px;color:#ffd23f;">${wrEsc(wishCurrentCard.title)}</div>`
        : '';
      resultEl.innerHTML = `
        <div style="font-size:18px;margin:0 0 6px;">
          <span style="font-weight:500;">Выпало:</span>
          <b style="font-size:24px;color:${wishColorHex(winningNumber)}">${winningNumber}</b>
          <span style="font-size:15px;opacity:.8;"> (${wishColorName(winningNumber)})</span>
        </div>
        ${whoLine ? `<div style="font-size:14px;font-weight:700;margin:0 0 6px;color:${who==='both'?'#7cfc9b':'#ffd23f'};">${whoLine}</div>` : ''}
        <div style="font-size:14px;line-height:1.4;padding:12px;background:rgba(255,255,255,.06);border-radius:12px;">
          ${titleLine}
          <div style="margin-top:${titleLine ? '4px' : '6px'};">${wrEsc(wishCurrentCard.text)}</div>
        </div>`;
    }
    if(doneBtn) doneBtn.style.display = 'block';
  },3700);
}

function pickRandomWishCard(){
  const level = state.wrSelectedLevel || 1;
  const cards = getCardsForLevel(level);
  if(cards.length===0) return {text:'Задание не найдено',type:'truth'};
  return cards[Math.floor(Math.random()*cards.length)];
}

function goToWrGame(){
  // Промежуточный экран #wrGame удалён: «Начать» на настройке сразу открывает
  // полноэкранное окно кручения. Паузы у игры нет — выход из неё по красному
  // крестику ✕ (полный выход на главный экран).
  wishSpinSession++;
  if(wishSpinTimer){ clearTimeout(wishSpinTimer); wishSpinTimer = null; }
  wishSpinning = false;
  state.wishCurrentCard = null;
  // Имена из полей «Имя мужчины»/«Имя женщины» — для строки «Выполняет: …»
  const n1raw = (document.getElementById('name1') || {}).value || '';
  const n2raw = (document.getElementById('name2') || {}).value || '';
  state.name1 = n1raw.trim() || 'Парень';
  state.name2 = n2raw.trim() || 'Девушка';
  // Сброс «повисшего» pausedMode от старых сохранений (паузы больше нет)
  const stalePause = state.pausedMode === 'wishRoulette';
  if(stalePause){ state.pausedMode = null; state.inProgress = false; }
  saveState();
  if(stalePause && typeof updateResumeUI === 'function') updateResumeUI();
  drawWishWheel();
  const resultEl = document.getElementById('wrSpinResult');
  if(resultEl) resultEl.textContent = '';
  const doneBtn = document.getElementById('wrSpinDoneBtn');
  if(doneBtn) doneBtn.style.display = 'none';
  const sum = document.getElementById('wrSummaryModal');
  if(sum) sum.classList.remove('show');
  spinWishWheel();
}

/* Паузы у «Рулетки желаний» больше нет (убрана по запросу): выход из игры —
 * красный крестик ✕ в окне кручения. Функция оставлена как безопасный вход
 * в игру на случай «повисшего» pausedMode из старых сохранённых сессий
 * (кнопка «Продолжить игру» в core.js вызывает её). */
function resumeWrGame(){
  goToWrGame();
}

function finishWrGame(){
  // «Закончить игру» из единого меню паузы: полный сброс партии, гасим все
  // экраны и возвращаемся на главную в блок «Игры для пар 18+».
  wishSpinSession++;
  if(wishSpinTimer){ clearTimeout(wishSpinTimer); wishSpinTimer = null; }
  wishSpinning = false;
  wishCurrentCard = null;
  wishWheelTotalRotation = 0;
  const modal = document.getElementById('wrSpinModal');
  if(modal) modal.classList.remove('show');
  const closeX = document.getElementById('wrCloseX');
  if(closeX) closeX.style.display = 'none';
  state.pausedMode = null;
  state.inProgress = false;
  delete state.wishCurrentCard;
  saveState();
  document.querySelectorAll('.screen.active').forEach(el=>el.classList.remove('active'));
  document.getElementById('setup').classList.add('active');
  if(typeof showSetupView === 'function') showSetupView('twoPlayerView');
  if(typeof updateResumeUI === 'function') updateResumeUI();
  if(typeof stopAllSounds === 'function') stopAllSounds();
  window.scrollTo(0, 0);
}

function exitWrGame(){
  finishWrGame();
}

// «✅ Выполнено» — задание принято, сразу крутим следующий сектор
const wrSpinDoneBtn = document.getElementById('wrSpinDoneBtn');
if(wrSpinDoneBtn) wrSpinDoneBtn.addEventListener('click', ()=>{
  if(wishSpinning) return;
  wrSpinDoneBtn.style.display = 'none';
  spinWishWheel();
});
const wrSetupStartBtn = document.getElementById('wrSetupStartBtn');
if(wrSetupStartBtn) wrSetupStartBtn.addEventListener('click', goToWrGame);
const wrSetupExitBtn = document.getElementById('wrSetupExitBtn');
if(wrSetupExitBtn) wrSetupExitBtn.addEventListener('click', ()=>{
  // Выход из настроек до начала партии: не оставляем «повисший» pausedMode
  // (иначе меню паузы откроется само по себе) и гарантируем один активный экран.
  if(typeof stopAllSounds === 'function') stopAllSounds();
  state.pausedMode = null;
  state.inProgress = false;
  delete state.wishCurrentCard;
  saveState();
  document.querySelectorAll('.screen.active').forEach(el=>el.classList.remove('active'));
  document.getElementById('setup').classList.add('active');
  if(typeof updateResumeUI === 'function') updateResumeUI();
});
