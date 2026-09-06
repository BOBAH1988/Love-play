// games/passionmap.js — игра «Карта страсти» (пары).
// Полностью независимая копия механики «Пройди квест» (games/sexquest.js):
// свой код, свои карточки (cards/cards_passionmap.js) и своё состояние
// (state.passionMap*) — с «Пройди квест» ничего общего по данным.
// Загружается после cards/cards_passionmap.js в index.html.
//
// Механика: каждое желание показывается в два этапа.
//   Этап 1 — карточка знакомства: title + text, кнопки «▶ Начать» (включает
//         первый вопрос) и «Выход». Кнопки «Да/Нет» здесь скрыты.
//   Этап 2 — вопросы квеста quest[] (по порядку, начиная с первого):
//         На каждом шаге — свой вопрос «Да/Нет»:
//           Да — желание засчитывается облегчённой версией (+1 очко),
//                показывается yesAction как итог, переход к следующему желанию.
//           Нет — переход к следующему, более мягкому шагу квеста.
//         Если «Нет» на всех шагах — желание откладывается без давления
//         (PASSIONMAP_SOFT_EXIT_TEXT), переход к следующему желанию.
// Цель — мягким, постепенным подходом (от смелого предложения до самого
// простого и безопасного варианта) проходить «карту» желаний пары, без
// давления и дискомфорта.
//
// После того как все желания в партии пройдены, результат сохраняется в
// state.passionMapChecklists — «карта путешествий» для истории: по каждому
// желанию фиксируется список пройденных шагов вплоть до того, на котором
// ответили «Да» (или все шаги, если отложили) — так партнёры видят, где на
// карте уже побывали и с чего продолжать.

const PASSIONMAP_SOFT_EXIT_TEXT = 'Без проблем. Откладываем это место на карте — комфорт и доверие важнее. Идём дальше по маршруту.';
const PASSIONMAP_MAX_SCORE_PER_LIGHT = 1;

let passionMapCurrentWish = null;
let passionMapCurrentStepIndex = -1; // -1 = карточка знакомства, 0+ = шаг квеста

function getPassionMapWishes(){
  return (typeof PASSIONMAP_WISHES !== 'undefined' && Array.isArray(PASSIONMAP_WISHES)) ? PASSIONMAP_WISHES : [];
}

const PASSIONMAP_COUNT_VALUES = ['1','3','5','all'];

function passionMapResolvedCount(){
  const total = getPassionMapWishes().length;
  if(state.passionMapCount === 'all') return total;
  return Math.min(state.passionMapCount, total);
}

function goToPassionMapSetup(){
  goToGameSetup('passionMapSetup', null, ()=>{
    updatePassionMapHistoryBtn();
    renderPassionMapCountGroup();
    renderPassionMapModeGroup();
  });
}

function renderPassionMapCountGroup(){
  if(!PASSIONMAP_COUNT_VALUES.includes(String(state.passionMapCount))){ state.passionMapCount = 1; saveState(); }
  document.querySelectorAll('#passionMapCountGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', btn.dataset.value === String(state.passionMapCount));
  });
}
document.querySelectorAll('#passionMapCountGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.passionMapCount = btn.dataset.value === 'all' ? 'all' : parseInt(btn.dataset.value, 10);
    // «Все» делает ручной выбор бессмысленным (играются все точки карты) —
    // возвращаем случайный режим; для остальных значений урезаем ручной
    // выбор до нового лимита.
    if(state.passionMapCount === 'all'){
      state.passionMapMode = 'random';
    } else if(state.passionMapManualIds && state.passionMapManualIds.length > state.passionMapCount){
      state.passionMapManualIds = state.passionMapManualIds.slice(0, state.passionMapCount);
    }
    saveState();
    renderPassionMapCountGroup();
    renderPassionMapModeGroup();
    renderPassionMapPickList();
  });
});
function renderPassionMapModeGroup(){
  if(state.passionMapMode !== 'manual' && state.passionMapMode !== 'random'){ state.passionMapMode = 'random'; saveState(); }
  const pickBtn = document.getElementById('passionMapPickBtn');
  const isAll = state.passionMapCount === 'all';
  if(pickBtn) pickBtn.disabled = isAll;
  document.querySelectorAll('#passionMapModeGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', btn.dataset.value === state.passionMapMode);
  });
}
document.getElementById('passionMapPickBtn').addEventListener('click', ()=>{
  if(state.passionMapCount === 'all'){
    showToast('При выборе «Все» играются все точки карты');
    return;
  }
  state.passionMapMode = 'manual';
  saveState();
  renderPassionMapModeGroup();
  renderPassionMapPickList();
  showModal('passionMapPickModal');
});
document.querySelectorAll('#passionMapModeGroup .starter-btn[data-value="random"]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.passionMapMode = 'random';
    saveState();
    renderPassionMapModeGroup();
  });
});

function renderPassionMapPickList(){
  const wrap = document.getElementById('passionMapPickList');
  if(!wrap) return;
  const limit = passionMapResolvedCount();
  const hint = document.getElementById('passionMapPickHint');
  if(hint) hint.textContent = `Отметьте до ${limit} ${limit===1 ? 'желания' : 'желаний'} для партии`;
  if(!state.passionMapManualIds) state.passionMapManualIds = [];
  if(!state.passionMapExcluded) state.passionMapExcluded = [];
  const selected = state.passionMapManualIds;
  const excluded = state.passionMapExcluded;
  wrap.innerHTML = '';
  getPassionMapWishes().forEach(wish=>{
    const on = selected.includes(wish.id);
    const isExcluded = excluded.includes(wish.id);
    const atLimit = !on && selected.length >= limit;
    const div = document.createElement('div');
    div.className = 'pmap-pick-item' + (on ? ' on' : '') + (atLimit ? ' disabled' : '') + (isExcluded ? ' excluded' : '');
    div.innerHTML = `
      <div class="pmap-pick-check"></div>
      <div class="pmap-pick-title">${wish.title}</div>
      <button type="button" class="pmap-pick-exclude${isExcluded ? ' on' : ''}" title="Исключить из случайной выдачи">✕</button>
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
      renderPassionMapPickList();
    });
    div.querySelector('.pmap-pick-exclude').addEventListener('click', (e)=>{
      e.stopPropagation();
      const idx = excluded.indexOf(wish.id);
      if(idx >= 0) excluded.splice(idx, 1);
      else excluded.push(wish.id);
      saveState();
      renderPassionMapPickList();
    });
    wrap.appendChild(div);
  });
}
document.getElementById('passionMapPickDoneBtn').addEventListener('click', ()=>{
  hideModal('passionMapPickModal');
});
document.getElementById('passionMapPickModal').addEventListener('click', (e)=>{
  if(e.target.id === 'passionMapPickModal') e.currentTarget.classList.remove('show');
});
function exitPassionMapSetup(){
  document.getElementById('passionMapSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('twoPlayerView');
}
document.getElementById('passionMapSetupExitBtn').addEventListener('click', ()=>{ exitPassionMapSetup(); });
(document.getElementById('passionMapSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ showModal('passionMapRulesModal'); });
setupRulesModal('passionMapRulesModal', 'closePassionMapRulesBtn');


function pmapShuffleIds(ids){
  const arr = ids.slice();
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildPassionMapQueue(){
  if(state.passionMapMode === 'manual' && state.passionMapManualIds && state.passionMapManualIds.length){
    return pmapShuffleIds(state.passionMapManualIds);
  }
  const allIds = getPassionMapWishes().map(w=>w.id);
  const excluded = state.passionMapExcluded || [];
  // Если исключено абсолютно всё (крайний случай) — падать некуда, играем
  // полным пулом, иначе игра вообще не сможет начаться.
  let pool = allIds.filter(id => !excluded.includes(id));
  if(pool.length === 0) pool = allIds;
  const count = state.passionMapCount === 'all' ? pool.length : Math.min(state.passionMapCount, pool.length);
  return pmapShuffleIds(pool).slice(0, count);
}

function startPassionMapGame(){
  state.passionMapQueue = buildPassionMapQueue();
  state.passionMapIndex = 0;
  state.passionMapScore = 0;
  state.passionMapResults = []; // {wishId, title, outcome:'light'|'deferred', steps:[question,...], agreedStep:number|null}
  saveState();
  document.getElementById('passionMapSetup').classList.remove('active');
  goToGame(null, 'passionMapGame');
  updateMuteBtn();
  requestWakeLock();
  // Показываем ОПИСАНИЕ точки карты (title + text): кнопки «Да/Нет» ещё скрыты,
  // вместо них кнопка «▶ Начать» — она открывает первый вопрос квеста.
  showCurrentPassionMapWish();
}

function currentPassionMapWishObj(){
  const wishes = getPassionMapWishes();
  const id = state.passionMapQueue[state.passionMapIndex];
  return wishes.find(w=>w.id === id) || null;
}

function showCurrentPassionMapWish(){
  const wish = currentPassionMapWishObj();
  if(!wish){ finishPassionMapGame(); return; }
  passionMapCurrentWish = wish;
  passionMapCurrentStepIndex = -1; // -1 = показано описание, вопрос квеста ещё не начат
  renderPassionMapIntroCard();
}

function updatePassionMapProgress(){
  const el = document.getElementById('passionMapProgressLabel');
  if(el) el.textContent = `${state.passionMapIndex + 1} / ${state.passionMapQueue.length}`;
  const scoreEl = document.getElementById('passionMapScoreLabel');
  if(scoreEl) scoreEl.textContent = `${state.passionMapScore} 🏆`;
}

function renderPassionMapIntroCard(){
  updatePassionMapProgress();
  fadeSwapEl('passionMapCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-header">
          <div class="card-turn">
            <div class="card-turn-label">Точка карты · уровень ${passionMapCurrentWish.level}/10</div>
            <div class="card-turn-name">${passionMapCurrentWish.title}</div>
          </div>
        </div>
        <div class="card-body">
          <div class="card-icon">🎀</div>
          <div class="card-text">${passionMapCurrentWish.text}</div>
        </div>
      </div>
    `;
  });
  // На карточке знакомства решений не спрашиваем: «Да/Нет» скрыты,
  // вопрос откроется по кнопке «▶ Начать».
  document.getElementById('passionMapYesBtn').style.display = 'none';
  document.getElementById('passionMapNoBtn').style.display = 'none';
  document.getElementById('passionMapStartPlayBtn').style.display = 'flex';
  // Ряд с кнопками в «интро»-режиме: «▶ Начать» + минимальная «Выход».
  document.getElementById('passionMapGame').classList.add('pmap-intro');
}

function renderPassionMapStep(){
  if(!passionMapCurrentWish) return;
  updatePassionMapProgress();
  const step = passionMapCurrentWish.quest[passionMapCurrentStepIndex];
  fadeSwapEl('passionMapCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-header">
          <div class="card-turn">
            <div class="card-turn-label">Мягкий шаг ${passionMapCurrentStepIndex + 1} из ${passionMapCurrentWish.quest.length}</div>
            <div class="card-turn-name">${passionMapCurrentWish.title}</div>
          </div>
        </div>
        <div class="card-body">
          <div class="card-icon">🎀</div>
          <div class="card-text">${step.question}</div>
        </div>
      </div>
    `;
  });
  document.getElementById('passionMapYesBtn').textContent = 'Да';
  document.getElementById('passionMapYesBtn').style.display = 'flex';
  document.getElementById('passionMapNoBtn').textContent = 'Нет';
  document.getElementById('passionMapNoBtn').style.display = 'flex';
  document.getElementById('passionMapStartPlayBtn').style.display = 'none';
  // Вопросы квеста — «Выход» снова на всю ширину (интро-режим выключен).
  document.getElementById('passionMapGame').classList.remove('pmap-intro');
}

function renderPassionMapOutcome(text, icon){
  updatePassionMapProgress();
  fadeSwapEl('passionMapCard', (el)=>{
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
  document.getElementById('passionMapYesBtn').textContent = 'Дальше';
  document.getElementById('passionMapYesBtn').style.display = 'flex';
  document.getElementById('passionMapNoBtn').style.display = 'none';
  document.getElementById('passionMapStartPlayBtn').style.display = 'none';
  document.getElementById('passionMapGame').classList.remove('pmap-intro');
}

function recordPassionMapResult(outcome, agreedStep){
  const steps = passionMapCurrentWish.quest
    .slice(0, agreedStep !== null ? agreedStep + 1 : passionMapCurrentWish.quest.length)
    .map(s=>s.question);
  state.passionMapResults.push({
    wishId: passionMapCurrentWish.id,
    title: passionMapCurrentWish.title,
    outcome, // 'light' | 'deferred'
    steps,
    agreedStep,
  });
}

let passionMapAwaitingNext = false;

document.getElementById('passionMapYesBtn').addEventListener('click', ()=>{
  if(passionMapAwaitingNext){
    passionMapAwaitingNext = false;
    advancePassionMapWish();
    return;
  }
  playSuccessSound();
  // Подстраховка: «Да» активна только на вопросах квеста (на карточке
  // знакомства она скрыта, а stepIndex там = -1).
  if(passionMapCurrentStepIndex < 0) return;
  if(!passionMapCurrentWish) return;
  // «Да» на вопросе квеста — облегчённая версия желания.
  const step = passionMapCurrentWish.quest[passionMapCurrentStepIndex];
  state.passionMapScore += PASSIONMAP_MAX_SCORE_PER_LIGHT;
  recordPassionMapResult('light', passionMapCurrentStepIndex);
  saveState();
  passionMapAwaitingNext = true;
  renderPassionMapOutcome(step.yesAction + '<br><br>Желание засчитано облегчённой версией, +1 очко.', '💞');
});

document.getElementById('passionMapNoBtn').addEventListener('click', ()=>{
  // «Нет» скрыта на экране итога шага, но на всякий случай защищаемся
  // от повторного клика по уже показанному итогу — чтобы не задваивало результат.
  if(passionMapAwaitingNext){
    passionMapAwaitingNext = false;
    advancePassionMapWish();
    return;
  }
  playNeutralSound();
  if(!passionMapCurrentWish) return;
  if(passionMapCurrentStepIndex < passionMapCurrentWish.quest.length - 1){
    passionMapCurrentStepIndex++;
    renderPassionMapStep();
    return;
  }
  // «Нет» на последнем шаге — мягкий выход, без давления.
  recordPassionMapResult('deferred', null);
  saveState();
  passionMapAwaitingNext = true;
  renderPassionMapOutcome(PASSIONMAP_SOFT_EXIT_TEXT, '🤍');
});

function advancePassionMapWish(){
  state.passionMapIndex++;
  saveState();
  showCurrentPassionMapWish();
}

function finishPassionMapGame(){
  const checklist = {
    date: Date.now(),
    score: state.passionMapScore,
    items: state.passionMapResults,
  };
  if(!state.passionMapChecklists) state.passionMapChecklists = [];
  state.passionMapChecklists.unshift(checklist);
  saveState();
  document.getElementById('passionMapGame').classList.remove('active');
  document.getElementById('passionMapSummary').classList.add('active');
  renderPassionMapSummary(checklist);
}

function passionMapOutcomeLabel(outcome){
  if(outcome === 'light') return '💞 Пройдено облегчённо';
  return '🤍 Отложено';
}

function renderPassionMapSummary(checklist){
  document.getElementById('passionMapSummaryScore').textContent = `Счёт: ${checklist.score} 🏆`;
  const list = document.getElementById('passionMapSummaryList');
  list.innerHTML = checklist.items.map(item=>`
    <li>
      <div class="pmap-summary-title">${item.title}</div>
      <div class="pmap-summary-outcome">${passionMapOutcomeLabel(item.outcome)}</div>
    </li>
  `).join('');
}

function exitPassionMapSummary(){
  stopAllSounds();
  document.getElementById('passionMapSummary').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('twoPlayerView');
}
document.getElementById('passionMapSummaryExitBtn').addEventListener('click', ()=>{ exitPassionMapSummary(); });

document.getElementById('passionMapStartBtn').addEventListener('click', ()=>{
  if(state.passionMapMode === 'manual' && (!state.passionMapManualIds || !state.passionMapManualIds.length)){
    showToast('Выберите хотя бы одно желание');
    renderPassionMapPickList();
    showModal('passionMapPickModal');
    return;
  }
  playSuccessSound();
  startPassionMapGame();
});
document.getElementById('passionMapExitBtn').addEventListener('click', ()=>{
  stopAllSounds();
  document.getElementById('passionMapGame').classList.remove('active');
  document.getElementById('passionMapSetup').classList.add('active');
});
// Кнопка «▶ Начать» на карточке знакомства: открываем ПЕРВЫЙ вопрос квеста
// этого желания (quest[0]) — появляются кнопки «Да»/«Нет».
document.getElementById('passionMapStartPlayBtn').addEventListener('click', ()=>{
  playSuccessSound();
  passionMapCurrentStepIndex = 0;
  renderPassionMapStep();
});

/* ============ КАРТА ПУТЕШЕСТВИЙ (ИСТОРИЯ ПРОШЛЫХ ИГР) ============ */
function updatePassionMapHistoryBtn(){
  const btn = document.getElementById('passionMapHistoryBtn');
  if(!btn) return;
  const has = !!(state.passionMapChecklists && state.passionMapChecklists.length);
  btn.disabled = !has;
}
function formatPassionMapDate(ts){
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function goToPassionMapHistory(){
  const wrap = document.getElementById('passionMapHistoryList');
  const checklists = state.passionMapChecklists || [];
  if(checklists.length === 0){
    wrap.innerHTML = '<div class="card-text">Пока нет сохранённых маршрутов — пройдите игру хотя бы раз.</div>';
  } else {
    wrap.innerHTML = checklists.map((cl, idx)=>`
      <div class="pmap-history-entry">
        <div class="pmap-history-date">${formatPassionMapDate(cl.date)} · счёт ${cl.score} 🏆</div>
        <ul class="pmap-history-items">
          ${cl.items.map((item, itemIdx)=>`
            <li>
              <div class="pmap-item-row">
                <div class="pmap-item-main">
                  <div class="pmap-summary-title">${item.title}</div>
                  <div class="pmap-summary-outcome">${passionMapOutcomeLabel(item.outcome)}</div>
                  ${item.steps && item.steps.length ? `<ol class="pmap-history-steps">${item.steps.map((s,i)=>`<li${item.agreedStep===i ? ' class="pmap-step-agreed"' : ''}>${s}</li>`).join('')}</ol>` : ''}
                </div>
                <button type="button" class="pmap-item-del" data-cl="${idx}" data-item="${itemIdx}" aria-label="Удалить задание из пройденных">✕</button>
              </div>
            </li>
          `).join('')}
        </ul>
      </div>
    `).join('');
  }
  document.getElementById('setup').classList.remove('active');
  document.getElementById('passionMapSetup').classList.remove('active');
  document.getElementById('passionMapHistory').classList.add('active');
}
// Удаление одного сохранённого задания из истории (по красному крестику
// в «Пройденных»). Счёт маршрута пересчитывается по оставшимся пунктам;
// если пунктов не осталось — маршрут удаляется целиком.
function deletePassionMapHistoryItem(clIdx, itemIdx){
  const cl = (state.passionMapChecklists || [])[clIdx];
  if(!cl || !Array.isArray(cl.items) || !cl.items[itemIdx]) return;
  playErrorSound();
  cl.items.splice(itemIdx, 1);
  cl.score = cl.items.reduce((sum,item)=>{
    if(item.outcome === 'light') return sum + PASSIONMAP_MAX_SCORE_PER_LIGHT;
    return sum;
  }, 0);
  let removedWholeChecklist = false;
  if(cl.items.length === 0){
    state.passionMapChecklists.splice(clIdx, 1);
    removedWholeChecklist = true;
  }
  saveState();
  showToast(removedWholeChecklist ? 'Маршрут пуст и удалён' : 'Задание удалено из пройденных 🗑️');
  goToPassionMapHistory(); // перерисовываем список с учётом удаления
}
// Один делегированный обработчик на весь список — работает для всех
// крестиков, включая появившиеся после перерисовки.
document.getElementById('passionMapHistoryList').addEventListener('click', (e)=>{
  const btn = e.target.closest('.pmap-item-del');
  if(!btn) return;
  deletePassionMapHistoryItem(parseInt(btn.dataset.cl, 10), parseInt(btn.dataset.item, 10));
});
function exitPassionMapHistory(){
  document.getElementById('passionMapHistory').classList.remove('active');
  document.getElementById('passionMapSetup').classList.add('active');
  updatePassionMapHistoryBtn(); // после удалений кнопка «✅ Пройденные» может стать неактивной
}
document.getElementById('passionMapHistoryBtn').addEventListener('click', ()=>{ goToPassionMapHistory(); });
document.getElementById('passionMapHistoryExitBtn').addEventListener('click', ()=>{ exitPassionMapHistory(); });
