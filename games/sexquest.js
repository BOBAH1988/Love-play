// games/sexquest.js — игра «Секс-квест» (пары).
// Загружается через <script src="games/sexquest.js"></script> в index.html,
// данные — cards/cards_sexquest.js (SEXQUEST_WISHES).
//
// Механика: на каждое желание сперва спрашивается "Выполнить сейчас?".
//   Да  — желание сразу засчитывается полностью (3 очка), переход к следующему.
//   Нет — начинается "квест преодоления" из 6 мягких шагов (SEXQUEST_WISHES[i].quest).
//         На каждом шаге — свой вопрос "Да/Нет":
//           Да — желание засчитывается облегчённой версией (1 очко), показывается
//                текст yesAction как итог, переход к следующему желанию.
//           Нет — переход к следующему шагу квеста.
//         Если "Нет" на всех 6 шагах — желание откладывается без давления
//         (SEXQUEST_SOFT_EXIT_TEXT), переход к следующему желанию.
// Цель — реализовать желания друг друга мягким, постепенным подходом, без
// давления и дискомфорта.
//
// После того как все желания в партии пройдены, результат сохраняется в
// state.sexQuestChecklists — это и есть "чек-лист" для избранного/истории:
// по каждому желанию, с которым взаимодействовали (то есть Да сразу,
// Да на каком-то шаге квеста или отложено), фиксируется список пройденных
// шагов вплоть до того, на котором ответили "Да" (или все 6 шагов, если
// отложили) — так партнёр, открыв чек-лист в следующий раз, сразу видит,
// на чём остановились в прошлый раз, и с чего продолжать.

const SEXQUEST_SOFT_EXIT_TEXT = 'Без проблем. Откладываем это желание — комфорт и доверие важнее. Переходим дальше.';
const SEXQUEST_MAX_SCORE_PER_DIRECT = 3;
const SEXQUEST_MAX_SCORE_PER_LIGHT = 1;

let sexQuestCurrentWish = null;
let sexQuestCurrentStepIndex = -1; // -1 = показываем главный вопрос "Выполнить сейчас?", 0..5 = шаг квеста

function getSexQuestWishes(){
  return (typeof SEXQUEST_WISHES !== 'undefined' && Array.isArray(SEXQUEST_WISHES)) ? SEXQUEST_WISHES : [];
}

function goToSexQuestSetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('sexQuestSetup').classList.add('active');
  updateSexQuestHistoryBtn();
}
function exitSexQuestSetup(){
  document.getElementById('sexQuestSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}
document.getElementById('sexQuestSetupExitBtn').addEventListener('click', ()=>{ exitSexQuestSetup(); });
document.getElementById('sexQuestSetupRulesBtn').addEventListener('click', ()=>{ document.getElementById('sexQuestRulesModal').classList.add('show'); });
document.getElementById('closeSexQuestRulesBtn').addEventListener('click', ()=>{ document.getElementById('sexQuestRulesModal').classList.remove('show'); });
document.getElementById('sexQuestRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'sexQuestRulesModal') e.currentTarget.classList.remove('show'); });

function shuffleSexQuestQueue(){
  const wishes = getSexQuestWishes();
  const ids = wishes.map(w=>w.id);
  for(let i = ids.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

function startSexQuestGame(){
  state.sexQuestQueue = shuffleSexQuestQueue();
  state.sexQuestIndex = 0;
  state.sexQuestScore = 0;
  state.sexQuestResults = []; // {wishId, title, outcome:'direct'|'light'|'deferred', steps:[question,...], agreedStep:number|null}
  saveState();
  document.getElementById('sexQuestSetup').classList.remove('active');
  document.getElementById('sexQuestGame').classList.add('active');
  updateMuteBtn();
  requestWakeLock();
  showCurrentSexQuestWish();
}

function currentSexQuestWishObj(){
  const wishes = getSexQuestWishes();
  const id = state.sexQuestQueue[state.sexQuestIndex];
  return wishes.find(w=>w.id === id) || null;
}

function showCurrentSexQuestWish(){
  const wish = currentSexQuestWishObj();
  if(!wish){ finishSexQuestGame(); return; }
  sexQuestCurrentWish = wish;
  sexQuestCurrentStepIndex = -1;
  renderSexQuestPrompt();
}

function updateSexQuestProgress(){
  const el = document.getElementById('sexQuestProgressLabel');
  if(el) el.textContent = `${state.sexQuestIndex + 1} / ${state.sexQuestQueue.length}`;
  const scoreEl = document.getElementById('sexQuestScoreLabel');
  if(scoreEl) scoreEl.textContent = `${state.sexQuestScore} 🏆`;
}

function renderSexQuestPrompt(){
  updateSexQuestProgress();
  fadeSwapEl('sexQuestCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-header">
          <div class="card-turn">
            <div class="card-turn-label">Желание · уровень ${sexQuestCurrentWish.level}/10</div>
            <div class="card-turn-name">Выполнить сейчас?</div>
          </div>
        </div>
        <div class="card-body">
          <div class="card-icon">💗</div>
          <div class="card-split-title">${sexQuestCurrentWish.title}</div>
          <div class="card-text">${sexQuestCurrentWish.text}</div>
        </div>
      </div>
    `;
  });
  document.getElementById('sexQuestYesBtn').textContent = 'Да, выполняем';
  document.getElementById('sexQuestNoBtn').style.display = 'flex';
  document.getElementById('sexQuestNoBtn').textContent = 'Нет, пока не готовы';
}

function renderSexQuestStep(){
  updateSexQuestProgress();
  const step = sexQuestCurrentWish.quest[sexQuestCurrentStepIndex];
  fadeSwapEl('sexQuestCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-header">
          <div class="card-turn">
            <div class="card-turn-label">Мягкий шаг ${sexQuestCurrentStepIndex + 1} из ${sexQuestCurrentWish.quest.length}</div>
            <div class="card-turn-name">${sexQuestCurrentWish.title}</div>
          </div>
        </div>
        <div class="card-body">
          <div class="card-icon">🌤️</div>
          <div class="card-text">${step.question}</div>
        </div>
      </div>
    `;
  });
  document.getElementById('sexQuestYesBtn').textContent = 'Да';
  document.getElementById('sexQuestNoBtn').textContent = 'Нет';
}

function renderSexQuestOutcome(text, icon){
  fadeSwapEl('sexQuestCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-body">
          <div class="card-icon">${icon}</div>
          <div class="card-text">${text}</div>
        </div>
      </div>
    `;
  });
  document.getElementById('sexQuestYesBtn').textContent = 'Дальше';
  document.getElementById('sexQuestNoBtn').style.display = 'none';
}

function recordSexQuestResult(outcome, agreedStep){
  const steps = sexQuestCurrentWish.quest
    .slice(0, agreedStep !== null ? agreedStep + 1 : sexQuestCurrentWish.quest.length)
    .map(s=>s.question);
  state.sexQuestResults.push({
    wishId: sexQuestCurrentWish.id,
    title: sexQuestCurrentWish.title,
    outcome, // 'direct' | 'light' | 'deferred'
    steps,
    agreedStep,
  });
}

let sexQuestAwaitingNext = false;

document.getElementById('sexQuestYesBtn').addEventListener('click', ()=>{
  if(sexQuestAwaitingNext){
    sexQuestAwaitingNext = false;
    advanceSexQuestWish();
    return;
  }
  playSuccessSound();
  if(sexQuestCurrentStepIndex === -1){
    // Ответили "Да" сразу на главный вопрос — полное выполнение.
    state.sexQuestScore += SEXQUEST_MAX_SCORE_PER_DIRECT;
    recordSexQuestResult('direct', null);
    saveState();
    sexQuestAwaitingNext = true;
    renderSexQuestOutcome('Отлично, порадуйте свою половинку! Желание засчитано полностью — 3 очка.', '✅');
    return;
  }
  // Ответили "Да" на шаге квеста — облегчённая версия.
  const step = sexQuestCurrentWish.quest[sexQuestCurrentStepIndex];
  state.sexQuestScore += SEXQUEST_MAX_SCORE_PER_LIGHT;
  recordSexQuestResult('light', sexQuestCurrentStepIndex);
  saveState();
  sexQuestAwaitingNext = true;
  renderSexQuestOutcome(step.yesAction + ' — желание засчитано облегчённой версией, +1 очко.', '💞');
});

document.getElementById('sexQuestNoBtn').addEventListener('click', ()=>{
  playNeutralSound();
  if(sexQuestCurrentStepIndex === -1){
    // Начинаем квест преодоления с первого шага.
    sexQuestCurrentStepIndex = 0;
    renderSexQuestStep();
    return;
  }
  if(sexQuestCurrentStepIndex < sexQuestCurrentWish.quest.length - 1){
    sexQuestCurrentStepIndex++;
    renderSexQuestStep();
    return;
  }
  // "Нет" на последнем шаге — мягкий выход, без давления.
  recordSexQuestResult('deferred', null);
  saveState();
  sexQuestAwaitingNext = true;
  renderSexQuestOutcome(SEXQUEST_SOFT_EXIT_TEXT, '🤍');
});

function advanceSexQuestWish(){
  state.sexQuestIndex++;
  saveState();
  showCurrentSexQuestWish();
}

function finishSexQuestGame(){
  const checklist = {
    date: Date.now(),
    score: state.sexQuestScore,
    items: state.sexQuestResults,
  };
  if(!state.sexQuestChecklists) state.sexQuestChecklists = [];
  state.sexQuestChecklists.unshift(checklist);
  saveState();
  document.getElementById('sexQuestGame').classList.remove('active');
  document.getElementById('sexQuestSummary').classList.add('active');
  renderSexQuestSummary(checklist);
}

function sexQuestOutcomeLabel(outcome){
  if(outcome === 'direct') return '✅ Выполнено полностью';
  if(outcome === 'light') return '💞 Выполнено облегчённо';
  return '🤍 Отложено';
}

function renderSexQuestSummary(checklist){
  document.getElementById('sexQuestSummaryScore').textContent = `Счёт: ${checklist.score} 🏆`;
  const list = document.getElementById('sexQuestSummaryList');
  list.innerHTML = checklist.items.map(item=>`
    <li>
      <div class="sexquest-summary-title">${item.title}</div>
      <div class="sexquest-summary-outcome">${sexQuestOutcomeLabel(item.outcome)}</div>
    </li>
  `).join('');
}

function exitSexQuestSummary(){
  document.getElementById('sexQuestSummary').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}
document.getElementById('sexQuestSummaryExitBtn').addEventListener('click', ()=>{ exitSexQuestSummary(); });

document.getElementById('sexQuestStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  startSexQuestGame();
});
document.getElementById('sexQuestExitBtn').addEventListener('click', ()=>{
  document.getElementById('sexQuestGame').classList.remove('active');
  document.getElementById('sexQuestSetup').classList.add('active');
});

/* ============ ЧЕК-ЛИСТЫ (ИСТОРИЯ ПРОШЛЫХ ИГР) ============ */
function updateSexQuestHistoryBtn(){
  const btn = document.getElementById('sexQuestHistoryBtn');
  if(!btn) return;
  const has = !!(state.sexQuestChecklists && state.sexQuestChecklists.length);
  btn.disabled = !has;
}
function formatSexQuestDate(ts){
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function goToSexQuestHistory(){
  const wrap = document.getElementById('sexQuestHistoryList');
  const checklists = state.sexQuestChecklists || [];
  if(checklists.length === 0){
    wrap.innerHTML = '<div class="card-text">Пока нет сохранённых чек-листов — пройдите игру хотя бы раз.</div>';
  } else {
    wrap.innerHTML = checklists.map((cl, idx)=>`
      <div class="sexquest-history-entry">
        <div class="sexquest-history-date">${formatSexQuestDate(cl.date)} · счёт ${cl.score} 🏆</div>
        <ul class="sexquest-history-items">
          ${cl.items.map(item=>`
            <li>
              <div class="sexquest-summary-title">${item.title}</div>
              <div class="sexquest-summary-outcome">${sexQuestOutcomeLabel(item.outcome)}</div>
              ${item.steps && item.steps.length ? `<ol class="sexquest-history-steps">${item.steps.map((s,i)=>`<li${item.agreedStep===i ? ' class="sexquest-step-agreed"' : ''}>${s}</li>`).join('')}</ol>` : ''}
            </li>
          `).join('')}
        </ul>
      </div>
    `).join('');
  }
  document.getElementById('setup').classList.remove('active');
  document.getElementById('sexQuestSetup').classList.remove('active');
  document.getElementById('sexQuestHistory').classList.add('active');
}
function exitSexQuestHistory(){
  document.getElementById('sexQuestHistory').classList.remove('active');
  document.getElementById('sexQuestSetup').classList.add('active');
}
document.getElementById('sexQuestHistoryBtn').addEventListener('click', ()=>{ goToSexQuestHistory(); });
document.getElementById('sexQuestHistoryExitBtn').addEventListener('click', ()=>{ exitSexQuestHistory(); });
