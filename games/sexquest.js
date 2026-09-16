// games/sexquest.js — игра «Секс-квест» (пары).
// Загружается через <script src="games/sexquest.js"></script> в index.html,
// данные — cards/cards_sexquest.js (SEXQUEST_WISHES).
//
// Механика: каждое желание показывается в два этапа.
//   Этап 1 — карточка знакомства: title + text желания, кнопки «▶ Начать»
//         (включает вопрос) и «Выход». Кнопки «Да/Нет» здесь скрыты.
//   Этап 2 — уровни квеста quest[]: порядок зависит от режима игры.
//         «Смелый» — по колоде: от самого смелого шага (quest[0]) к самому
//         мягкому. «Плавный» — в обратном порядке: первый вопрос самый
//         мягкий (обсудить идею и выбрать стоп-слово), дальше уровни всё
//         смелее (см. sexQuestStepDisplayIndex).
//         «Плавный»: Да — выполняете уровень и переходите к следующему,
//         более смелому; Да на самом смелом уровне — желание выполнено
//         полностью (+3 очка). Нет — желание завершается и идём к следующему:
//         если уровни уже выполнялись — засчитывается облегчённо (+1),
//         если нет — откладывается (SEXQUEST_SOFT_EXIT_TEXT).
//         «Смелый»: Да — облегчённая версия (+1 очко), переход к следующему
//         желанию; Нет — следующий, более мягкий шаг; Нет на всех шагах —
//         откладывается.
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
const SEXQUEST_MAX_SCORE_PER_DIRECT = 3;

let sexQuestCurrentWish = null;
let sexQuestCurrentStepIndex = -1; // -1 = показано описание, 0+ = уровень квеста
// Сколько уровней текущего желания уже выполнили («Да» в «Плавном»).
// Сбрасывается на каждом новом желании (showCurrentSexQuestWish).
let sexQuestAgreedCount = 0;
// Последний показанный итог шага (для восстановления после паузы, когда
// кнопка «Да» превращается в «Дальше»).
let sexQuestLastOutcomeText = '';
let sexQuestLastOutcomeIcon = '💞';

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
    renderSexQuestPlayModeGroup();
  });
}

function renderSexQuestCountGroup(){
  if(!SEXQUEST_COUNT_VALUES.includes(String(state.sexQuestCount))){ state.sexQuestCount = 5; saveState(); }
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

// «Режимы игры»: порядок заданий в партии. 'smooth' (по умолчанию) — в
// обратном порядке колоды, от простого к смелому; 'fast' («Смелый») — по
// порядку колоды, от смелого к простому.
function renderSexQuestPlayModeGroup(){
  if(state.sexQuestPlayMode !== 'smooth' && state.sexQuestPlayMode !== 'fast'){ state.sexQuestPlayMode = 'smooth'; saveState(); }
  document.querySelectorAll('#sexQuestPlayModeGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', btn.dataset.value === state.sexQuestPlayMode);
  });
}
document.querySelectorAll('#sexQuestPlayModeGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.sexQuestPlayMode = btn.dataset.value;
    saveState();
    renderSexQuestPlayModeGroup();
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


function buildSexQuestQueue(){
  if(state.sexQuestPlayMode === 'smooth'){
    // «Плавный» (по умолчанию): без перемешивания — задания идут в обратном
    // порядке колоды, от самого простого («Только руками») к самому смелому.
    if(state.sexQuestMode === 'manual' && state.sexQuestManualIds && state.sexQuestManualIds.length){
      const deckIndex = id => getSexQuestWishes().findIndex(w=>w.id===id);
      return state.sexQuestManualIds.slice().sort((a,b)=>deckIndex(b)-deckIndex(a));
    }
    const allIds = getSexQuestWishes().map(w=>w.id);
    const excluded = state.sexQuestExcluded || [];
    let pool = allIds.filter(id => !excluded.includes(id));
    if(pool.length === 0) pool = allIds;
    const count = state.sexQuestCount === 'all' ? pool.length : Math.min(state.sexQuestCount, pool.length);
    return pool.slice(-count).reverse(); // последние (самые простые) — вперёд
  }
  // «Смелый» (ключ в сохранениях — 'fast'): задания по порядку колоды — от
  // самых смелых («Анальный секс») к самым простым («Только руками»).
  if(state.sexQuestMode === 'manual' && state.sexQuestManualIds && state.sexQuestManualIds.length){
    const deckIndex = id => getSexQuestWishes().findIndex(w=>w.id===id);
    return state.sexQuestManualIds.slice().sort((a,b)=>deckIndex(a)-deckIndex(b));
  }
  const allIds = getSexQuestWishes().map(w=>w.id);
  const excluded = state.sexQuestExcluded || [];
  // Если исключено абсолютно всё (крайний случай) — падать некуда, играем
  // полным пулом, иначе игра вообще не сможет начаться.
  let pool = allIds.filter(id => !excluded.includes(id));
  if(pool.length === 0) pool = allIds;
  const count = state.sexQuestCount === 'all' ? pool.length : Math.min(state.sexQuestCount, pool.length);
  return pool.slice(0, count); // первые по порядку колоды — самые смелые
}

function startSexQuestGame(){
  state.sexQuestQueue = buildSexQuestQueue();
  state.sexQuestIndex = 0;
  state.sexQuestScore = 0;
  state.sexQuestResults = []; // {wishId, title, outcome:'direct'|'light'|'deferred', steps:[question,...], agreedStep:number|null}
  state.sexQuestPaused = null;
  state.inProgress = true;
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
  sexQuestAgreedCount = 0; // новое желание — выполненные уровни обнуляем
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
            <div class="card-turn-label">Желание</div>
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

// Отображаемый индекс шага квеста. В «Смелом» шаги идут по колоде
// (quest[0] — самый смелый), в «Плавном» — в обратном порядке: первый
// показанный вопрос самый мягкий (обсуждение и стоп-слово), «Нет» ведёт
// к более смелым шагам. realIndex — индекс в массиве quest[] желания.
function sexQuestStepDisplayIndex(realIndex){
  if(!sexQuestCurrentWish || state.sexQuestPlayMode !== 'smooth') return realIndex;
  return sexQuestCurrentWish.quest.length - 1 - realIndex;
}

function renderSexQuestStep(){
  if(!sexQuestCurrentWish) return;
  updateSexQuestProgress();
  const step = sexQuestCurrentWish.quest[sexQuestStepDisplayIndex(sexQuestCurrentStepIndex)];
  fadeSwapEl('sexQuestCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-header">
          <div class="card-turn">
            <div class="card-turn-label">Уровень ${sexQuestCurrentStepIndex + 1} из ${sexQuestCurrentWish.quest.length}</div>
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
  sexQuestLastOutcomeText = text;
  sexQuestLastOutcomeIcon = icon;
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

function recordSexQuestResult(outcome, agreedCount){
  // Шаги в историю сохраняем в том порядке, в котором их видел игрок:
  // в «Плавном» цепочка идёт от самого мягкого уровня к самому смелому,
  // в «Смелом» — как в колоде. agreedCount — сколько уровней выполнили
  // («Да» на столько шагов подряд от начала показа); для «deferred» — 0.
  // В историю пишем позицию последнего выполненного уровня в порядке
  // показа (agreedStep), чтобы подсветка шага в «Пройденных» совпадала.
  const total = sexQuestCurrentWish.quest.length;
  const smooth = state.sexQuestPlayMode === 'smooth';
  const displayOrder = [];
  for(let i = 0; i < total; i++) displayOrder.push(smooth ? total - 1 - i : i);
  const performed = outcome === 'deferred' ? 0 : agreedCount;
  const shown = outcome === 'deferred' ? total : performed;
  const steps = displayOrder.slice(0, shown).map(real=>sexQuestCurrentWish.quest[real].question);
  state.sexQuestResults.push({
    wishId: sexQuestCurrentWish.id,
    title: sexQuestCurrentWish.title,
    outcome, // 'direct' | 'light' | 'deferred'
    steps,
    agreedStep: outcome === 'deferred' ? null : performed - 1,
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
  const total = sexQuestCurrentWish.quest.length;
  if(state.sexQuestPlayMode === 'smooth'){
    // «Плавный»: «Да» — выполняем уровень и переходим к следующему, более
    // смелому. На самом смелом уровне — желание выполнено полностью (+3).
    sexQuestAgreedCount++;
    if(sexQuestCurrentStepIndex < total - 1){
      sexQuestCurrentStepIndex++;
      saveState();
      renderSexQuestStep();
      return;
    }
    const step = sexQuestCurrentWish.quest[sexQuestStepDisplayIndex(sexQuestCurrentStepIndex)];
    state.sexQuestScore += SEXQUEST_MAX_SCORE_PER_DIRECT;
    recordSexQuestResult('direct', sexQuestAgreedCount);
    saveState();
    sexQuestAwaitingNext = true;
    renderSexQuestOutcome(step.yesAction + '<br><br>Желание выполнено полностью — все уровни пройдены! +' + SEXQUEST_MAX_SCORE_PER_DIRECT + ' очка.', '✅');
    return;
  }
  // «Смелый»: «Да» на любом шаге — облегчённая версия желания (+1).
  const step = sexQuestCurrentWish.quest[sexQuestStepDisplayIndex(sexQuestCurrentStepIndex)];
  state.sexQuestScore += SEXQUEST_MAX_SCORE_PER_LIGHT;
  recordSexQuestResult('light', sexQuestCurrentStepIndex + 1);
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
  const total = sexQuestCurrentWish.quest.length;
  if(state.sexQuestPlayMode === 'smooth'){
    // «Плавный»: «Нет» завершает желание и ведёт к следующему заданию.
    // Если уровни уже выполнялись — засчитываем пройденное (облегчённо,
    // +1 очко), если ни одного — откладываем без давления.
    if(sexQuestAgreedCount > 0){
      state.sexQuestScore += SEXQUEST_MAX_SCORE_PER_LIGHT;
      recordSexQuestResult('light', sexQuestAgreedCount);
      saveState();
      sexQuestAwaitingNext = true;
      renderSexQuestOutcome('Желание выполнено до уровня ' + sexQuestAgreedCount + ' из ' + total + '.<br><br>Засчитано облегчённой версией, +' + SEXQUEST_MAX_SCORE_PER_LIGHT + ' очко.', '💞');
    } else {
      recordSexQuestResult('deferred', 0);
      saveState();
      sexQuestAwaitingNext = true;
      renderSexQuestOutcome(SEXQUEST_SOFT_EXIT_TEXT, '🤍');
    }
    return;
  }
  // «Смелый»: «Нет» ведёт к следующему, более мягкому шагу.
  if(sexQuestCurrentStepIndex < total - 1){
    sexQuestCurrentStepIndex++;
    renderSexQuestStep();
    return;
  }
  // "Нет" на последнем шаге — мягкий выход, без давления.
  recordSexQuestResult('deferred', 0);
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
  state.inProgress = false;
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
  stopAllSounds();
  // Выход с «Итогов» — в меню настройки «Пройди квест» (#sexQuestSetup),
  // а не в общий хаб. Сначала активируем точку входа #setup (раздел «для
  // двоих»): goToGameSetup запомнит её как экран для кнопки «Назад»,
  // будто мы пришли в настройки из хаба, а не с «Итогов».
  document.getElementById('setup').classList.add('active');
  showSetupView('twoPlayerView');
  goToSexQuestSetup();
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  updateResumeUI();
}
document.getElementById('sexQuestSummaryExitBtn').addEventListener('click', ()=>{ exitSexQuestSummary(); });

/* ===== Пауза: вернуться в меню — продолжить позже через общий блок ===== */
function resumeSexQuestGame(){
  state.pausedMode = null;
  const d = state.sexQuestPaused || {};
  state.sexQuestPaused = null;
  state.sexQuestIndex = d.index || 0;
  sexQuestCurrentWish = currentSexQuestWishObj();
  sexQuestCurrentStepIndex = (typeof d.stepIndex === 'number') ? d.stepIndex : -1;
  sexQuestAwaitingNext = !!d.awaitingNext;
  if(d.waitText) sexQuestLastOutcomeText = d.waitText;
  if(d.waitIcon) sexQuestLastOutcomeIcon = d.waitIcon;
  saveState();
  // Единый переход на игровой экран: goToGame() гасит остальные экраны,
  // снимает паузу и обновляет блок «Продолжить игру» в хабе.
  goToGame(null, 'sexQuestGame');
  updateSexQuestProgress();
  updateMuteBtn();
  requestWakeLock();
  if(sexQuestAwaitingNext && sexQuestLastOutcomeText){
    renderSexQuestOutcome(sexQuestLastOutcomeText, sexQuestLastOutcomeIcon);
  } else if(sexQuestCurrentWish && sexQuestCurrentStepIndex >= 0){
    renderSexQuestStep();
  } else if(sexQuestCurrentWish){
    renderSexQuestIntroCard();
  } else {
    finishSexQuestGame();
  }
}
// Вызывается из общего меню паузы («Закончить игру») — прерываем партию без
// сохранения чек-листа (это не честное завершение, а отказ от партии).
function finishPausedSexQuestGame(){
  hideModal('pauseMenuModal');
  stopAllSounds();
  state.sexQuestPaused = null;
  state.inProgress = false;
  state.pausedMode = null;
  // Выход из игры — в меню настройки «Пройди квест». Используем тот же
  // путь, что и выход с «Итогов» (goToSexQuestSetup → goToGameSetup):
  // он сам гасит ВСЕ активные экраны (не только игровой), включает
  // #sexQuestSetup и запоминает точку возврата для навигации «Назад».
  // Раньше здесь было ручное переключение экранов, из-за которого возврат
  // после «Выход» работал иначе, чем после «Итогов».
  goToSexQuestSetup();
  saveState();
  updateResumeUI();
  showToast('Игра завершена');
}

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
// Кнопка «Выход» в игре — сразу в меню настройки, без промежуточной паузы.
// Чек-лист партии при этом не сохраняется (прерывание — не честное завершение).
document.getElementById('sexQuestExitBtn').addEventListener('click', ()=>{
  finishPausedSexQuestGame();
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
  // Кнопка «Пройденные задания» всегда активна: при пустой истории экран
  // показывает сообщение «Пока нет сохранённых чек-листов — пройдите игру
  // хотя бы раз». Раньше кнопка гасла без сохранённых партий, и пустое
  // состояние было недостижимо с главного входа.
  btn.disabled = false;
}
function goToSexQuestHistory(){
  const wrap = document.getElementById('sexQuestHistoryList');
  const checklists = state.sexQuestChecklists || [];
  if(checklists.length === 0){
    wrap.innerHTML = '<div class="card-text sexquest-history-empty">Пока нет сохранённых чек-листов<br>пройдите игру хотя бы раз.</div>';
  } else {
    // Плоский общий список заданий из ВСЕХ сохранённых партий: блоки партий
    // (дата · счёт) и общий заголовок не выводятся — у пользователя сразу
    // список заданий без надписей. data-cl/data-item сохраняют индексы
    // исходных массивов, чтобы удаление крестиком продолжало работать.
    wrap.innerHTML = '<ul class="sexquest-history-items">' +
      checklists.map((cl, idx)=>`
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
      `).join('') +
      '</ul>';
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
  updateSexQuestHistoryBtn(); // кнопка остаётся активной; пустая история покажет подсказку
}
document.getElementById('sexQuestHistoryBtn').addEventListener('click', ()=>{ goToSexQuestHistory(); });
document.getElementById('sexQuestHistoryExitBtn').addEventListener('click', ()=>{ exitSexQuestHistory(); });
