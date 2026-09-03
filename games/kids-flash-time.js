// games/kids-flash-time.js — обучающая игра «Время» (часы) для группы
// «Обучающие игры». Вынесена из kids-flash.js (раньше была темой «Время»
// внутри «Флеш карточек»). Два подраздела: механические и цифровые часы.
// Данные — cards/cards_flash.js (FLASH_WORDS, theme==='time').
//
// Игрок выбирает тип часов (механические/цифровые) и видит карточку: время
// на циферблате (цифровом/механическом) + четыре варианта ответа — нужно
// выбрать, сколько сейчас времени. После ответа — подсветка верно/неверно,
// следующая карточка. Счёт побед/ошибок ведётся по всей партии.

let flashTimeCurrentCard = null;
// Стили циферблата для механических часов
const CLOCK_STYLES = ['full', 'short', 'roman'];
const ROMAN_NUMERALS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

// Генерирует SVG часы по времени (translation вида "2:55")
// style: 'full' (12 цифр), 'short' (12,3,6,9), 'roman' (римские)
function generateClockSVG(timeStr, style){
  const [h, m] = timeStr.split(':').map(Number);
  const hours12 = h % 12 || 12;
  const minuteAngle = m * 6;
  const hourAngle = (hours12 % 12) * 30 + m * 0.5;
  const cx = 100, cy = 100, r = 85;
  let numbers = '';
  for(let i = 1; i <= 12; i++){
    const angle = (i * 30 - 90) * Math.PI / 180;
    const nx = cx + (r - 20) * Math.cos(angle);
    const ny = cy + (r - 20) * Math.sin(angle);
    if(style === 'short'){
      if([12, 3, 6, 9].includes(i)){
        numbers += `<text x="${nx.toFixed(1)}" y="${ny.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="20" font-weight="bold" fill="#fff">${i}</text>`;
      }
    } else if(style === 'roman'){
      numbers += `<text x="${nx.toFixed(1)}" y="${ny.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="bold" fill="#fff">${ROMAN_NUMERALS[i]}</text>`;
    } else {
      numbers += `<text x="${nx.toFixed(1)}" y="${ny.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="16" font-weight="bold" fill="#fff">${i}</text>`;
    }
  }
  let ticks = '';
  for(let i = 0; i < 12; i++){
    const angle = (i * 30 - 90) * Math.PI / 180;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + (r - 5) * Math.cos(angle);
    const y2 = cy + (r - 5) * Math.sin(angle);
    ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#e8c9dd" stroke-width="2" stroke-linecap="round"/>`;
  }
  const hLen = r * 0.5;
  const hAngle = (hourAngle - 90) * Math.PI / 180;
  const hx = cx + hLen * Math.cos(hAngle);
  const hy = cy + hLen * Math.sin(hAngle);
  const mLen = r * 0.75;
  const mAngle = (minuteAngle - 90) * Math.PI / 180;
  const mx = cx + mLen * Math.cos(mAngle);
  const my = cy + mLen * Math.sin(mAngle);
  return `<svg viewBox="0 0 200 200" width="160" height="160">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#2b0f2e" stroke="#e8c9dd" stroke-width="3"/>
    ${ticks}
    ${numbers}
    <line x1="${cx}" y1="${cy}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" stroke="#ff5e8e" stroke-width="4" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy}" x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}" stroke="#3ddc84" stroke-width="2" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="4" fill="#e8c9dd"/>
  </svg>`;
}



function getFlashTimePool(){
  if(typeof FLASH_WORDS === 'undefined' || !Array.isArray(FLASH_WORDS)) return [];
  return FLASH_WORDS.filter(w => w.theme === 'time' && w.sub === state.flashTimeSub);
}
function isFlashTimeCard(card){
  return card && card.theme === 'time' && (card.sub === 'digital' || card.sub === 'mech');
}
function renderFlashTimeCard(card){
  const wrap = document.getElementById('flashTimeCard');
  if(!wrap) return;
  flashTimeCurrentCard = card;
  // Для механических часов выбираем случайный стиль циферблата
  const clockStyle = card.sub === 'mech' ? CLOCK_STYLES[Math.floor(Math.random() * CLOCK_STYLES.length)] : null;
  // Shuffle
  const sh=card.options.map((o,i)=>({o,c:i===card.answer}))
  for(let i=sh.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[sh[i],sh[j]]=[sh[j],sh[i]]}
  wrap.innerHTML = `
    <div class="flash-time-display">
      ${card.sub === 'digital'
        ? `<div class="flash-time-digital">${card.word}</div>`
        : `<div class="flash-time-mechanical">${generateClockSVG(card.translation, clockStyle)}<div class="clock-style-hint">${clockStyle === 'full' ? 'Полные' : clockStyle === 'short' ? 'Сокращённые' : 'Римские'}</div></div>`}
    </div>
    <div class="flash-time-options">
      ${sh.map((x, i)=>`
        <button type="button" class="flash-time-option" data-time-index="${i}" data-time-correct="${x.c}">${x.o}</button>
      `).join('')}
    </div>
    <div class="flash-card-progress">${(state.flashTimeIndex || 0) + 1} / ${state.flashTimePool.length}</div>
  `;
}
function handleFlashTimeOption(btn){
  const wrap = document.getElementById('flashTimeCard');
  if(!wrap) return;
  const alreadySelected = wrap.querySelector('.flash-time-option.selected');
  if(alreadySelected) return;
  const idx = parseInt(btn.getAttribute('data-time-index'), 10);
  const isCorrect = btn.getAttribute('data-time-correct') === 'true';
  btn.classList.add('selected');
  const allBtns = wrap.querySelectorAll('.flash-time-option');
  if(isCorrect){
    btn.classList.add('correct');
    playSuccessSound();
    showToast('✅ Верно!');
    state.flashTimeScore = (state.flashTimeScore || 0) + 1;
  } else {
    btn.classList.add('wrong');
    wrap.querySelectorAll('[data-time-correct="true"]').forEach(el=>{ el.classList.add('correct'); });
    playFailSound();
    showToast('❌ Неверно');
    state.flashTimeErrors = (state.flashTimeErrors || 0) + 1;
  }
  saveState();
  updateFlashTimeScoreUI();
  allBtns.forEach(b=>b.disabled = true);
}
function updateFlashTimeScoreUI(){
  const el = document.getElementById('flashTimeScoreRow');
  if(!el) return;
  el.innerHTML = `
    <span class="krokodil-score-item">✅ Верно: ${state.flashTimeScore || 0}</span>
    <span class="krokodil-score-item">❌ Ошибки: ${state.flashTimeErrors || 0}</span>
  `;
}
function drawFlashTimeCard(){
  const pool = state.flashTimePool;
  if(!pool || state.flashTimeIndex >= pool.length){
    showFlashTimeSummaryModal();
    return;
  }
  renderFlashTimeCard(pool[state.flashTimeIndex]);
}
function startFlashTimeGame(){
  state.flashTimePool = getFlashTimePool().slice().sort(() => Math.random() - 0.5);
  state.flashTimeIndex = 0;
  state.flashTimeScore = 0;
  state.flashTimeErrors = 0;
  saveState();
  document.getElementById('flashTimeResultText').textContent = '';
  updateFlashTimeScoreUI();
  drawFlashTimeCard();
}
function goToFlashTimeSetup(){
  goToGameSetup('flashTimeSetup', null, ()=>{
    renderFlashTimeSubGroup();
  });
}
function exitFlashTimeSetup(){
  document.getElementById('flashTimeSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('learningView');
}
function renderFlashTimeSubGroup(){
  if(state.flashTimeSub !== 'mech' && state.flashTimeSub !== 'digital'){ state.flashTimeSub = 'mech'; saveState(); }
  document.querySelectorAll('#flashTimeSubGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', btn.dataset.value === state.flashTimeSub);
  });
}
function goToFlashTimeGame(){
  goToGame('flashTimeSetup', 'flashTimeGame');
  startFlashTimeGame();
  updateMuteBtn();
  requestWakeLock();
}
function showFlashTimeSummaryModal(){
  const score = state.flashTimeScore || 0;
  const errors = state.flashTimeErrors || 0;
  const total = score + errors;
  document.getElementById('flashTimeSummaryIntro').innerHTML = `
    Правильных ответов: ${score} из ${total}<br>
    Ошибок: ${errors}
  `;
  showModal('flashTimeSummaryModal');
}
function exitFlashTimeGame(){
  exitGame('flashTimeGame', 'flashTimeSetup');
  state.flashTimePool = [];
  state.flashTimeIndex = 0;
  state.flashTimeScore = 0;
  state.flashTimeErrors = 0;
  saveState();
}
document.querySelectorAll('#flashTimeSubGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    playSuccessSound();
    state.flashTimeSub = btn.dataset.value;
    saveState();
    renderFlashTimeSubGroup();
  });
});
document.getElementById('flashTimeNextBtn').addEventListener('click', ()=>{
  playSuccessSound();
  state.flashTimeIndex++;
  saveState();
  drawFlashTimeCard();
});
document.getElementById('flashTimeCard').addEventListener('click', (e)=>{
  if(e.target.classList.contains('flash-time-option')){
    handleFlashTimeOption(e.target);
    return;
  }
});
document.getElementById('flashTimeSetupStartBtn').addEventListener('click', ()=>{ goToFlashTimeGame(); });
document.getElementById('flashTimeSetupExitBtn').addEventListener('click', ()=>{ exitFlashTimeSetup(); });
document.getElementById('flashTimeExitBtn').addEventListener('click', ()=>{ showFlashTimeSummaryModal(); });
document.getElementById('closeFlashTimeSummaryBtn').addEventListener('click', ()=>{
  hideModal('flashTimeSummaryModal');
  exitFlashTimeGame();
});
openRulesModal('flashTimeGameRulesBtn', 'flashTimeRulesModal');
setupRulesModal('flashTimeRulesModal', 'closeFlashTimeRulesBtn');
