// games/sexquest.js — игра «Секс-квест» (пары).
// Загружается через <script src="games/sexquest.js"></script> в index.html,
// данные — cards/cards_sexquest.js (SEXQUEST_WISHES).
//
// Механика: каждое желание показывается в два этапа.
//   Этап 1 — карточка знакомства: title + text желания, кнопки «▶ Начать»
//         (включает вопрос) и «Выход». Кнопки «Да/Нет» здесь скрыты.
//   Этап 2 — вопросы квеста quest[] (по очереди, начиная с первого):
//         На каждом шаге — свой вопрос «Да/Нет»:
//           Да — желание засчитывается облегчённой версией (+1 очко),
//                показывается текст yesAction как итог, переход к следующему желанию.
//           Нет — переход к следующему, более мягкому шагу квеста.
//         Если "Нет" на всех шагах — желание откладывается без давления
//         (SEXQUEST_SOFT_EXIT_TEXT), переход к следующему желанию.
// Цель — реализовать желания друг друга мягким, постепенным подходом от
// смелого предложения до самого простого и безопасного варианта, без
// давления и дискомфорта.
//
// После того как все желания в партии пройдены, результат сохраняется в
// state.sexQuestChecklists — это и есть "чек-лист" для избранного/истории:
// по каждому желанию, с которым взаимодействовали (то есть Да сразу,
// Да на каком-то шаге квеста или отложено), фиксируется список пройденных
// шагов вплоть до того, на котором ответили "Да" (или все шаги, если
// отложили) — так партнёр, открыв чек-лист в следующий раз, сразу видит,
// на чём остановились в прошлый раз, и с чего продолжать.

const SEXQUEST_SOFT_EXIT_TEXT = 'Без проблем. Откладываем это желание — комфорт и доверие важнее. Переходим дальше.';
const SEXQUEST_MAX_SCORE_PER_LIGHT = 1;

let sexQuestCurrentWish = null;
let sexQuestCurrentStepIndex = -1; // -1 = показываем главный вопрос "Выполнить сейчас?", 0+ = шаг квеста

function getSexQuestWishes(){
  return (typeof SEXQUEST_WISHES !== 'undefined' && Array.isArray(SEXQUEST_WISHES)) ? SEXQUEST_WISHES : [];
}

const SEXQUEST_COUNT_VALUES = ['1','3','5','all'];

function sexQuestResolvedCount(){
  const total = getSexQuestWishes().length;
  if(state.sexQuestCount === 'all') return total;
  return Math.min(state.sexQuestCount, total);
}

function goToSexQuestSetup(){
  goToGameSetup('sexQuestSetup', null, ()=>{
    updateSexQuestHistoryBtn();
    renderSexQuestCountGroup();
    renderSexQuestModeGroup();
  });
}

function renderSexQuestCountGroup(){
  if(!SEXQUEST_COUNT_VALUES.includes(String(state.sexQuestCount))){ state.sexQuestCount = 1; saveState(); }
  document.querySelectorAll('#sexQuestCountGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', btn.dataset.value === String(state.sexQuestCount));
  });
}
document.querySelectorAll('#sexQuestCountGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.sexQuestCount = btn.dataset.value === 'all' ? 'all' : parseInt(btn.dataset.value, 10);
    // "Все" делает ручной выбор бессмысленным (играются все желания) — возвращаем
    // случайный режим; для остальных значений урезаем ручной выбор до нового лимита.
    if(state.sexQuestCount === 'all'){
      state.sexQuestMode = 'random';
    } else if(state.sexQuestManualIds && state.sexQuestManualIds.length > state.sexQuestCount){
      state.sexQuestManualIds = state.sexQuestManualIds.slice(0, state.sexQuestCount);
    }
    saveState();
    renderSexQuestCountGroup();
    renderSexQuestModeGroup();
    renderSexQuestPickList();
  });
});

function renderSexQuestModeGroup(){
  if(state.sexQuestMode !== 'manual' && state.sexQuestMode !== 'random'){ state.sexQuestMode = 'random'; saveState(); }
  const pickBtn = document.getElementById('sexQuestPickBtn');
  const isAll = state.sexQuestCount === 'all';
  if(pickBtn) pickBtn.disabled = isAll;
  document.querySelectorAll('#sexQuestModeGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', btn.dataset.value === state.sexQuestMode);
  });
}
document.getElementById('sexQuestPickBtn').addEventListener('click', ()=>{
  if(state.sexQuestCount === 'all'){
    showToast('При выборе «Все» играются все желания');
    return;
  }
  state.sexQuestMode = 'manual';
  saveState();
  renderSexQuestModeGroup();
  renderSexQuestPickList();
  showModal('sexQuestPickModal');
});
document.querySelectorAll('#sexQuestModeGroup .starter-btn[data-value="random"]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.sexQuestMode = 'random';
    saveState();
    renderSexQuestModeGroup();
  });
});

function renderSexQuestPickList(){
  const wrap = document.getElementById('sexQuestPickList');
  if(!wrap) return;
  const limit = sexQuestResolvedCount();
  const hint = document.getElementById('sexQuestPickHint');
  if(hint) hint.textContent = `Отметьте до ${limit} ${limit===1 ? 'желания' : 'желаний'} для партии`;
  if(!state.sexQuestManualIds) state.sexQuestManualIds = [];
  if(!state.sexQuestExcluded) state.sexQuestExcluded = [];
  const selected = state.sexQuestManualIds;
  const excluded = state.sexQuestExcluded;
  wrap.innerHTML = '';
  getSexQuestWishes().forEach(wish=>{
    const on = selected.includes(wish.id);
    const isExcluded = excluded.includes(wish.id);
    const atLimit = !on && selected.length >= limit;
    const div = document.createElement('div');
    div.className = 'sexquest-pick-item' + (on ? ' on' : '') + (atLimit ? ' disabled' : '') + (isExcluded ? ' excluded' : '');
    div.innerHTML = `
      <div class="sexquest-pick-check"></div>
      <div class="sexquest-pick-title">${wish.title}</div>
      <button type="button" class="sexquest-pick-exclude${isExcluded ? ' on' : ''}" title="Исключить из случайной выдачи">✕</button>
    `;
    div.addEventListener('click', ()=>{
      const idx = selected.indexOf(wish.id);
      if(idx >= 0){
        selected.splice(idx, 1);
      } else {
        if(selected.length >= limit){ showToast(`Можно выбрать не больше ${limit}`); return; }
        selected.push(wish.id);
      }
      saveState();
      renderSexQuestPickList();
    });
    div.querySelector('.sexquest-pick-exclude').addEventListener('click', (e)=>{
      e.stopPropagation();
      const idx = excluded.indexOf(wish.id);
      if(idx >= 0) excluded.splice(idx, 1);
      else excluded.push(wish.id);
      saveState();
      renderSexQuestPickList();
    });
    wrap.appendChild(div);
  });
}
document.getElementById('sexQuestPickDoneBtn').addEventListener('click', ()=>{
  hideModal('sexQuestPickModal');
});
document.getElementById('sexQuestPickModal').addEventListener('click', (e)=>{
  if(e.target.id === 'sexQuestPickModal') e.currentTarget.classList.remove('show');
});
function exitSexQuestSetup(){
  document.getElementById('sexQuestSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('twoPlayerView');
}
document.getElementById('sexQuestSetupExitBtn').addEventListener('click', ()=>{ exitSexQuestSetup(); });
(document.getElementById('sexQuestSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ showModal('sexQuestRulesModal'); });
setupRulesModal('sexQuestRulesModal', 'closeSexQuestRulesBtn');


function shuffleIds(ids){
  const arr = ids.slice();
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildSexQuestQueue(){
  if(state.sexQuestMode === 'manual' && state.sexQuestManualIds && state.sexQuestManualIds.length){
    return shuffleIds(state.sexQuestManualIds);
  }
  const allIds = getSexQuestWishes().map(w=>w.id);
  const excluded = state.sexQuestExcluded || [];
  // Если исключено абсолютно всё (крайний случай) — падать некуда, играем
  // полным пулом, иначе игра вообще не сможет начаться.
  let pool = allIds.filter(id => !excluded.includes(id));
  if(pool.length === 0) pool = allIds;
  const count = state.sexQuestCount === 'all' ? pool.length : Math.min(state.sexQuestCount, pool.length);
  return shuffleIds(pool).slice(0, count);
}

function startSexQuestGame(){
  state.sexQuestQueue = buildSexQuestQueue();
  state.sexQuestIndex = 0;
  state.sexQuestScore = 0;
  state.sexQuestResults = []; // {wishId, title, outcome:'direct'|'light'|'deferred', steps:[question,...], agreedStep:number|null}
  saveState();
  document.getElementById('sexQuestSetup').classList.remove('active');
  goToGame(null, 'sexQuestGame');
  updateMuteBtn();
  requestWakeLock();
  // Показываем ОПИСАНИЕ желания (title + text): кнопки «Да/Нет» ещё скрыты,
  // вместо них кнопка «▶ Начать» — она открывает первый вопрос квеста
  // (см. обработчик sexQuestStartPlayBtn и renderSexQuestStep).
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
  sexQuestCurrentStepIndex = -1; // -1 = показано описание, вопрос квеста ещё не начат
  renderSexQuestIntroCard();
}

function updateSexQuestProgress(){
  const el = document.getElementById('sexQuestProgressLabel');
  if(el) el.textContent = `${state.sexQuestIndex + 1} / ${state.sexQuestQueue.length}`;
  const scoreEl = document.getElementById('sexQuestScoreLabel');
  if(scoreEl) scoreEl.textContent = `${state.sexQuestScore} 🏆`;
}

function renderSexQuestIntroCard(){
  updateSexQuestProgress();
  fadeSwapEl('sexQuestCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-header">
          <div class="card-turn">
            <div class="card-turn-label">Желание · уровень ${sexQuestCurrentWish.level}/10</div>
            <div class="card-turn-name">${sexQuestCurrentWish.title}</div>
          </div>
        </div>
        <div class="card-body">
          <div class="card-icon">🧩</div>
          <div class="card-text">${sexQuestCurrentWish.text}</div>
        </div>
      </div>
    `;
  });
  // На карточке знакомства решений не спрашиваем: «Да/Нет» скрыты,
  // вопрос откроется по кнопке «▶ Начать» (renderSexQuestStep).
  document.getElementById('sexQuestYesBtn').style.display = 'none';
  document.getElementById('sexQuestNoBtn').style.display = 'none';
  document.getElementById('sexQuestStartPlayBtn').style.display = 'flex';
  // Ряд с кнопками в "интро"-режиме: «▶ Начать» + минимальная «Выход».
  document.getElementById('sexQuestGame').classList.add('sexquest-intro');
}

function renderSexQuestStep(){
  if(!sexQuestCurrentWish) return;
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
          <div class="card-icon">🧩</div>
          <div class="card-text">${step.question}</div>
        </div>
      </div>
    `;
  });
  document.getElementById('sexQuestYesBtn').textContent = 'Да';
  document.getElementById('sexQuestYesBtn').style.display = 'flex';
  document.getElementById('sexQuestNoBtn').textContent = 'Нет';
  document.getElementById('sexQuestNoBtn').style.display = 'flex';
  document.getElementById('sexQuestStartPlayBtn').style.display = 'none';
  // Вопросы квеста — «Выход» снова на всю ширину (интро-режим выключен).
  document.getElementById('sexQuestGame').classList.remove('sexquest-intro');
}

function renderSexQuestOutcome(text, icon){
  updateSexQuestProgress();
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
  document.getElementById('sexQuestYesBtn').style.display = 'flex';
  document.getElementById('sexQuestNoBtn').style.display = 'none';
  document.getElementById('sexQuestStartPlayBtn').style.display = 'none';
  document.getElementById('sexQuestGame').classList.remove('sexquest-intro');
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
  // Подстраховка: «Да» активна только на вопросах квеста (на карточке
  // знакомства она скрыта, а stepIndex там = -1).
  if(sexQuestCurrentStepIndex < 0) return;
  if(!sexQuestCurrentWish) return;
  // "Да" на вопросе квеста — облегчённая версия желания.
  const step = sexQuestCurrentWish.quest[sexQuestCurrentStepIndex];
  state.sexQuestScore += SEXQUEST_MAX_SCORE_PER_LIGHT;
  recordSexQuestResult('light', sexQuestCurrentStepIndex);
  saveState();
  sexQuestAwaitingNext = true;
  renderSexQuestOutcome(step.yesAction + '<br><br>Желание засчитано облегчённой версией, +1 очко.', '💞');
});

document.getElementById('sexQuestNoBtn').addEventListener('click', ()=>{
  // "Нет" скрыта на экране итога шага (см. renderSexQuestOutcome), но на
  // всякий случай защищаемся и здесь той же проверкой, что и у "Да" —
  // чтобы повторный клик по уже показанному итогу не задваивал результат.
  if(sexQuestAwaitingNext){
    sexQuestAwaitingNext = false;
    advanceSexQuestWish();
    return;
  }
  playNeutralSound();
  if(!sexQuestCurrentWish) return;
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
  showSetupView('soloView');
}
document.getElementById('sexQuestSummaryExitBtn').addEventListener('click', ()=>{ exitSexQuestSummary(); });

document.getElementById('sexQuestStartBtn').addEventListener('click', ()=>{
  if(state.sexQuestMode === 'manual' && (!state.sexQuestManualIds || !state.sexQuestManualIds.length)){
    showToast('Выберите хотя бы одно желание');
    renderSexQuestPickList();
    showModal('sexQuestPickModal');
    return;
  }
  playSuccessSound();
  startSexQuestGame();
});
document.getElementById('sexQuestExitBtn').addEventListener('click', ()=>{
  document.getElementById('sexQuestGame').classList.remove('active');
  document.getElementById('sexQuestSetup').classList.add('active');
});
// Кнопка «▶ Начать» на карточке знакомства: открываем ПЕРВЫЙ вопрос квеста
// этого желания (quest[0]) — появляются кнопки «Да»/«Нет».
document.getElementById('sexQuestStartPlayBtn').addEventListener('click', ()=>{
  playSuccessSound();
  sexQuestCurrentStepIndex = 0;
  renderSexQuestStep();
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
          ${cl.items.map((item, itemIdx)=>`
            <li>
              <div class="sexquest-item-row">
                <div class="sexquest-item-main">
                  <div class="sexquest-summary-title">${item.title}</div>
                  <div class="sexquest-summary-outcome">${sexQuestOutcomeLabel(item.outcome)}</div>
                  ${item.steps && item.steps.length ? `<ol class="sexquest-history-steps">${item.steps.map((s,i)=>`<li${item.agreedStep===i ? ' class="sexquest-step-agreed"' : ''}>${s}</li>`).join('')}</ol>` : ''}
                </div>
                <button type="button" class="sexquest-item-del" data-cl="${idx}" data-item="${itemIdx}" aria-label="Удалить задание из пройденных">✕</button>
              </div>
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
// Удаление одного сохранённого задания из чек-листа истории (по красному
// крестику в "Пройденных"). Счёт чек-листа пересчитывается по оставшимся
// пунктам; если пунктов не осталось — чек-лист удаляется целиком.
function deleteSexQuestHistoryItem(clIdx, itemIdx){
  const cl = (state.sexQuestChecklists || [])[clIdx];
  if(!cl || !Array.isArray(cl.items) || !cl.items[itemIdx]) return;
  playErrorSound();
  cl.items.splice(itemIdx, 1);
  cl.score = cl.items.reduce((sum,item)=>{
    if(item.outcome === 'direct') return sum + 3;
    if(item.outcome === 'light') return sum + SEXQUEST_MAX_SCORE_PER_LIGHT;
    return sum;
  }, 0);
  let removedWholeChecklist = false;
  if(cl.items.length === 0){
    state.sexQuestChecklists.splice(clIdx, 1);
    removedWholeChecklist = true;
  }
  saveState();
  showToast(removedWholeChecklist ? 'Чек-лист пуст и удалён' : 'Задание удалено из пройденных 🗑️');
  goToSexQuestHistory(); // перерисовываем список с учётом удаления
}
// Один делегированный обработчик на весь список — работает для всех
// крестиков, включая появившиеся после перерисовки.
document.getElementById('sexQuestHistoryList').addEventListener('click', (e)=>{
  const btn = e.target.closest('.sexquest-item-del');
  if(!btn) return;
  deleteSexQuestHistoryItem(parseInt(btn.dataset.cl, 10), parseInt(btn.dataset.item, 10));
});
function exitSexQuestHistory(){
  document.getElementById('sexQuestHistory').classList.remove('active');
  document.getElementById('sexQuestSetup').classList.add('active');
  updateSexQuestHistoryBtn(); // после удалений кнопка «✅ Пройденные» может стать неактивной
}
document.getElementById('sexQuestHistoryBtn').addEventListener('click', ()=>{ goToSexQuestHistory(); });
document.getElementById('sexQuestHistoryExitBtn').addEventListener('click', ()=>{ exitSexQuestHistory(); });
