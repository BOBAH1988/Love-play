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
  wrap.innerHTML = `
    <div class="flash-time-display">
      ${card.sub === 'digital'
        ? `<div class="flash-time-digital">${card.word}</div>`
        : `<div class="flash-time-mechanical">${card.word}</div>`}
    </div>
    <div class="flash-time-options">
      ${card.options.map((opt, i)=>`
        <button type="button" class="flash-time-option" data-time-index="${i}" data-time-correct="${i === card.answer}">${opt}</button>
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
