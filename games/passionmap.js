function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }


document.getElementById('passionMapStartBtn').addEventListener('click', ()=>{ 
  if(state.passionMapMode === 'custom' && !allPassionMapCustomFilled()){ showToast('Сначала заполните свои задания'); return; }
  playSuccessSound(); startPassionMapGame(); 
});
document.getElementById('passionMapMapBtn').addEventListener('click', () => {
  renderPassionMapMapList();
  showModal('passionMapMapModal');
});
document.getElementById('passionMapModeCustomBtn').addEventListener('click', () => {
  showToast('Скоро: свои задания');
});
document.getElementById('passionMapModeStandardBtn').addEventListener('click', () => {
  // стандартный вариант уже активен по умолчанию
});


document.getElementById('passionMapResetBtn').addEventListener('click', () => {
  showModal('passionMapResetModal');
});
const __pmResetCancel = document.getElementById('passionMapResetCancelBtn');
if(__pmResetCancel) __pmResetCancel.addEventListener('click', () => hideModal('passionMapResetModal'));
const __pmResetOk = document.getElementById('passionMapResetOkBtn');
if(__pmResetOk) __pmResetOk.addEventListener('click', () => {
  state.passionMapCompleted = [];
  state.passionMapScore = 0;
  state.passionMapIndex = 0;
  state.passionMapQueue = [];
  state.passionMapResults = [];
  state.passionMapChecklists = [];
  state.passionMapPaused = null;
  saveState();
  renderPassionMapMapList();
  hideModal('passionMapResetModal');
});






// games/passionmap.js — игра «Карта страсти» (пары).
// Новая механика: 10 заданий от простого к сложному. Каждое задание —
// карточка с описанием и двумя кнопками: «Выполнено» (переход к следующему
// заданию + сохранение результата) и «Не сейчас» (выход в меню настройки).
// Порядок всегда 1..N, без перемешивания. Прогресс сохраняется в state.passionMapCompleted.
// Загружается после cards/cards_passionmap.js в index.html.

function allPassionMapCustomFilled(){
  const tasks = Array.isArray(state.passionMapCustomTasks) ? state.passionMapCustomTasks : [];
  if(tasks.length < PASSIONMAP_TOTAL_DEFAULT) return false;
  for(let i = 0; i < PASSIONMAP_TOTAL_DEFAULT; i++){
    const t = tasks[i];
    if(!t || !String(t.title||'').trim() || !String(t.text||'').trim()) return false;
  }
  return true;
}

function getPassionMapTasks(){
  if(state.passionMapMode === 'custom' && allPassionMapCustomFilled()){
    return state.passionMapCustomTasks.slice(0, PASSIONMAP_TOTAL_DEFAULT);
  }
  return (typeof PASSIONMAP_TASKS !== 'undefined' && Array.isArray(PASSIONMAP_TASKS)) ? PASSIONMAP_TASKS : [];
}

const PASSIONMAP_TOTAL_DEFAULT = 10;

function goToPassionMapSetup(){
  goToGameSetup('passionMapSetup');
}
function exitPassionMapSetup(){
  document.getElementById('passionMapSetup').classList.remove('active');

  document.getElementById('setup').classList.add('active');
  showSetupView('twoPlayerView');
}
document.getElementById('passionMapSetupExitBtn').addEventListener('click', ()=>{ exitPassionMapSetup(); });
setupRulesModal('passionMapRulesModal', 'closePassionMapRulesBtn');
setupRulesModal('passionMapMapModal', 'closePassionMapMapBtn');
setupRulesModal('passionMapTaskModal', 'closePassionMapTaskBtn');



let passionMapCurrentTask = null;

function startPassionMapGame(){
  const tasks = getPassionMapTasks();
  const total = tasks.length || PASSIONMAP_TOTAL_DEFAULT;
  state.passionMapQueue = tasks.map(t => t.id);
  if(!Array.isArray(state.passionMapCompleted)) state.passionMapCompleted = [];
  // Если все задания выполнены — начинаем заново.
  if(state.passionMapCompleted.length >= total){
    state.passionMapCompleted = [];
  }
  // Находим первое невыполненное задание.
  let idx = 0;
  let found = false;
  for(let i = 0; i < state.passionMapQueue.length; i++){
    if(!state.passionMapCompleted.includes(state.passionMapQueue[i])){ idx = i; found = true; break; }
  }
  if(!found) idx = state.passionMapQueue.length;
  state.passionMapIndex = idx;
  state.passionMapScore = state.passionMapCompleted.length;
  state.passionMapPaused = null;
  state.pausedMode = null;
  state.inProgress = true;
  saveState();
  document.getElementById('passionMapSetup').classList.remove('active');
  goToGame(null, 'passionMapGame');
  updateMuteBtn();
  requestWakeLock();
  if(state.passionMapIndex >= state.passionMapQueue.length){
    finishPassionMapGame();
  } else {
    showCurrentPassionMapTask();
  }
}

function currentPassionMapTaskObj(){
  const tasks = getPassionMapTasks();
  const id = (state.passionMapQueue || [])[state.passionMapIndex];
  return tasks.find(t => t.id === id) || null;
}

function showCurrentPassionMapTask(){
  const task = currentPassionMapTaskObj();
  if(!task){ finishPassionMapGame(); return; }
  passionMapCurrentTask = task;
  renderPassionMapTaskCard();
}

function renderPassionMapTaskCard(){
  const task = passionMapCurrentTask;
  if(!task) return;
  fadeSwapEl('passionMapCard', (el) => {
    el.className = 'card';
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-header">
          <div class="card-turn">
            <div class="card-turn-label">Задание ${task.level} из ${getPassionMapTasks().length || PASSIONMAP_TOTAL_DEFAULT}</div>
            <div class="card-turn-name">${task.title}</div>
          </div>
        </div>
        <div class="card-body">
          <div class="card-icon">🎀</div>
          <div class="card-text">${task.text}</div>
        </div>
      </div>
    `;
  });
  const yesBtn = document.getElementById('passionMapYesBtn');
  if(yesBtn){ yesBtn.textContent = 'Выполнено'; yesBtn.style.display = 'flex'; }
  const noBtn = document.getElementById('passionMapNoBtn');
  if(noBtn){ noBtn.textContent = 'Не сейчас'; noBtn.style.display = 'flex'; }
  const startPlayBtn = document.getElementById('passionMapStartPlayBtn');
  if(startPlayBtn) startPlayBtn.style.display = 'none';
  const game = document.getElementById('passionMapGame');
  if(game) game.classList.remove('pmap-intro');
}

document.getElementById('passionMapYesBtn').addEventListener('click', () => {
  playSuccessSound();
  const task = passionMapCurrentTask;
  if(!task) return;
  if(!Array.isArray(state.passionMapCompleted)) state.passionMapCompleted = [];
  if(!state.passionMapCompleted.includes(task.id)) state.passionMapCompleted.push(task.id);
  state.passionMapScore = state.passionMapCompleted.length;
  saveState();
  // переходим к следующему невыполненному
  let next = state.passionMapIndex + 1;
  while(next < (state.passionMapQueue || []).length && state.passionMapCompleted.includes(state.passionMapQueue[next])){
    next++;
  }
  state.passionMapIndex = next;
  saveState();
  if(state.passionMapIndex >= (state.passionMapQueue || []).length){
    finishPassionMapGame();
  } else {
    showCurrentPassionMapTask();
  }
});

document.getElementById('passionMapNoBtn').addEventListener('click', () => {
  finishPausedPassionMapGame();
});

function finishPassionMapGame(){
  const completed = Array.isArray(state.passionMapCompleted) ? state.passionMapCompleted.slice() : [];
  const tasks = getPassionMapTasks();
  const checklist = {
    date: Date.now(),
    score: completed.length,
    items: completed.map(id => {
      const t = tasks.find(x => x.id === id);
      return { wishId: id, title: t ? t.title : '', outcome: 'done' };
    }),
  };
  if(!state.passionMapChecklists) state.passionMapChecklists = [];
  state.passionMapChecklists.unshift(checklist);
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  const game = document.getElementById('passionMapGame');
  if(game) game.classList.remove('active');
  const summary = document.getElementById('passionMapSummary');
  if(summary) summary.classList.add('active');
  renderPassionMapSummary(checklist);
}

function passionMapOutcomeLabel(outcome){
  if(outcome === 'done') return '✅ Выполнено';
  return '✅ Выполнено';
}

function renderPassionMapSummary(checklist){
  const scoreEl = document.getElementById('passionMapSummaryScore');
  if(scoreEl) scoreEl.textContent = `Выполнено: ${checklist.score} из ${getPassionMapTasks().length || PASSIONMAP_TOTAL_DEFAULT}`;
  const list = document.getElementById('passionMapSummaryList');
  if(list){
    list.innerHTML = (checklist.items || []).map(item => `
      <li>
        <div class="pmap-summary-title">${item.title}</div>
        <div class="pmap-summary-outcome">${passionMapOutcomeLabel(item.outcome)}</div>
      </li>
    `).join('');
  }
}

function renderPassionMapMapList(){
  const list = document.getElementById('passionMapMapList');
  if(!list) return;
  const tasks = getPassionMapTasks();
  const completed = Array.isArray(state.passionMapCompleted) ? state.passionMapCompleted : [];
  const items = completed.map(id => tasks.find(t => t.id === id)).filter(Boolean);
  if(items.length === 0){
    list.innerHTML = '<li class="keep-prev"><div>Пока нет пройденных заданий.</div></li>';
    return;
  }
  list.innerHTML = items.map(t => `
    <li data-id="${t.id}" style="cursor:pointer;">
      <div class="pmap-summary-title">${t.title}</div>
    </li>
  `).join('');
  list.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', () => {
      const task = getPassionMapTasks().find(t => String(t.id) === String(li.dataset.id));
      if(!task) return;
      const titleEl = document.getElementById('passionMapTaskModalTitle');
      const textEl = document.getElementById('passionMapTaskModalText');
      if(titleEl) titleEl.textContent = task.title;
      if(textEl) textEl.textContent = task.text || '';
      showModal('passionMapTaskModal');
    });
  });
}


function exitPassionMapSummary(){
  stopAllSounds();
  returnToSetupUI();
  showSetupView('twoPlayerView');
}
document.getElementById('passionMapSummaryExitBtn').addEventListener('click', ()=>{ exitPassionMapSummary(); });

/* ===== Пауза/выход ===== */
function resumePassionMapGame(){
  state.pausedMode = null;
  state.inProgress = true;
  saveState();
  goToGame(null, 'passionMapGame');
  updateMuteBtn();
  requestWakeLock();
  showCurrentPassionMapTask();
}

function finishPausedPassionMapGame(){
  hideModal('pauseMenuModal');
  stopAllSounds();
  state.passionMapPaused = null;
  state.inProgress = false;
  state.pausedMode = null;
  goToPassionMapSetup();
  saveState();
  updateResumeUI();
  showToast('Игра завершена');
}

// Кнопка «Выход» в игре — сразу в меню настройки.
document.getElementById('passionMapExitBtn').addEventListener('click', ()=>{
  finishPausedPassionMapGame();
});

/* ============ КАРТА ПУТЕШЕСТВИЙ (ИСТОРИЯ) ============ */
function formatPassionMapDate(ts){
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function goToPassionMapHistory(){
  setParentScreenId('passionMapSetup');
  const wrap = document.getElementById('passionMapHistoryList');
  const checklists = state.passionMapChecklists || [];
  if(checklists.length === 0){
    wrap.innerHTML = '<div class="card-text">Пока нет сохранённых маршрутов — пройдите игру хотя бы раз.</div>';
  } else {
    wrap.innerHTML = checklists.map((cl, idx) => `
      <div class="pmap-history-entry">
        <div class="pmap-history-date">${formatPassionMapDate(cl.date)} · выполнено ${cl.score}</div>
        <ul class="pmap-history-items">
          ${cl.items.map((item, itemIdx) => `
            <li>
              <div class="pmap-item-row">
                <div class="pmap-item-main">
                  <div class="pmap-summary-title">${item.title}</div>
                  <div class="pmap-summary-outcome">${passionMapOutcomeLabel(item.outcome)}</div>
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
function deletePassionMapHistoryItem(clIdx, itemIdx){
  const cl = (state.passionMapChecklists || [])[clIdx];
  if(!cl || !Array.isArray(cl.items) || !cl.items[itemIdx]) return;
  playErrorSound();
  cl.items.splice(itemIdx, 1);
  cl.score = cl.items.length;
  let removedWholeChecklist = false;
  if(cl.items.length === 0){
    state.passionMapChecklists.splice(clIdx, 1);
    removedWholeChecklist = true;
  }
  saveState();
  showToast(removedWholeChecklist ? 'Маршрут пуст и удалён' : 'Задание удалено из пройденных 🗑️');
  goToPassionMapHistory();
}
document.getElementById('passionMapHistoryList').addEventListener('click', (e) => {
  const btn = e.target.closest('.pmap-item-del');
  if(!btn) return;
  deletePassionMapHistoryItem(parseInt(btn.dataset.cl, 10), parseInt(btn.dataset.item, 10));
});
function exitPassionMapHistory(){
  document.getElementById('passionMapHistory').classList.remove('active');
  document.getElementById('passionMapSetup').classList.add('active');
}
document.getElementById('passionMapHistoryExitBtn').addEventListener('click', ()=>{ exitPassionMapHistory(); });


function renderPassionMapCustomTasksEditor(){
  const list = document.getElementById('passionMapCustomTasksList');
  if(!list) return;
  const tasks = Array.isArray(state.passionMapCustomTasks) ? state.passionMapCustomTasks : [];
  let html = '';
  for(let i = 0; i < PASSIONMAP_TOTAL_DEFAULT; i++){
    const t = tasks[i] || {};
    const titleVal = (t.title||'').trim();
    const textVal = (t.text||'').trim();
    const titleBg = titleVal ? 'rgba(255,255,255,.9)' : 'rgba(255,120,120,.25)';
    const textBg = textVal ? 'rgba(255,255,255,.9)' : 'rgba(255,120,120,.25)';
    html += `<div style="margin-bottom:12px; padding:10px; border:1px solid rgba(43,15,46,.15); border-radius:12px;">
      <div style="font-weight:700; margin-bottom:6px;">Задание ${i+1}</div>
      <input type="text" class="pmap-custom-title" data-idx="${i}" placeholder="Название" value="${escapeHtml(t.title||'')}" maxlength="45" style="width:100%; box-sizing:border-box; padding:8px; border-radius:8px; border:1px solid rgba(43,15,46,.2); margin-bottom:6px; background:${titleBg}; color:#2b0f2e;">
      <textarea class="pmap-custom-text" data-idx="${i}" placeholder="Текст задания" maxlength="200" rows="3" style="width:100%; box-sizing:border-box; padding:8px; border-radius:8px; border:1px solid rgba(43,15,46,.2); min-height:60px; background:${textBg}; color:#2b0f2e;">${escapeHtml(t.text||'')}</textarea>
    </div>`;
  }
  list.innerHTML = html;
  // динамическая подсветка пустых полей
  list.querySelectorAll('.pmap-custom-title, .pmap-custom-text').forEach(el => {
    const update = () => { el.style.background = el.value.trim() ? 'rgba(255,255,255,.9)' : 'rgba(255,120,120,.25)'; };
    el.addEventListener('input', update);
  });
}

function savePassionMapCustomTasksFromEditor(){
  const titles = document.querySelectorAll('.pmap-custom-title');
  const texts = document.querySelectorAll('.pmap-custom-text');
  const arr = [];
  for(let i = 0; i < PASSIONMAP_TOTAL_DEFAULT; i++){
    const title = (titles[i] && titles[i].value || '').trim().slice(0, 45);
    const text = (texts[i] && texts[i].value || '').trim().slice(0, 200);
    arr.push({ id: i+1, level: i+1, title, text });
  }
  state.passionMapCustomTasks = arr;
  saveState();
}

const __pmCustomTasksBtn = document.getElementById('passionMapCustomTasksBtn');
if(__pmCustomTasksBtn) __pmCustomTasksBtn.addEventListener('click', () => {
  renderPassionMapCustomTasksEditor();
  showModal('passionMapCustomTasksModal');
});
const __pmCustomTasksSave = document.getElementById('passionMapCustomTasksSaveBtn');
if(__pmCustomTasksSave) __pmCustomTasksSave.addEventListener('click', () => {
  savePassionMapCustomTasksFromEditor();
  if(!allPassionMapCustomFilled()){
    showModal('passionMapCustomTasksIncompleteModal');
  } else {
    hideModal('passionMapCustomTasksModal');
    showToast('Свои задания сохранены');
  }
});
const __pmCustomTasksCancel = document.getElementById('passionMapCustomTasksCancelBtn');
if(__pmCustomTasksCancel) __pmCustomTasksCancel.addEventListener('click', () => {
  savePassionMapCustomTasksFromEditor();
  if(!allPassionMapCustomFilled()){
    showModal('passionMapCustomTasksIncompleteModal');
  } else {
    hideModal('passionMapCustomTasksModal');
  }
});

const __pmIncompleteClose = document.getElementById('passionMapCustomTasksIncompleteCloseBtn');
if(__pmIncompleteClose) __pmIncompleteClose.addEventListener('click', () => {
  savePassionMapCustomTasksFromEditor();
  hideModal('passionMapCustomTasksIncompleteModal');
  hideModal('passionMapCustomTasksModal');
});
const __pmIncompleteContinue = document.getElementById('passionMapCustomTasksIncompleteContinueBtn');
if(__pmIncompleteContinue) __pmIncompleteContinue.addEventListener('click', () => {
  hideModal('passionMapCustomTasksIncompleteModal');
});

function updatePassionMapModeButtons(){
  const std = document.getElementById('passionMapModeStandardBtn');
  const cst = document.getElementById('passionMapModeCustomBtn');
  if(std) std.classList.toggle('on', state.passionMapMode === 'standard');
  if(cst) cst.classList.toggle('on', state.passionMapMode === 'custom');
}

const __pmModeStd = document.getElementById('passionMapModeStandardBtn');
if(__pmModeStd) __pmModeStd.addEventListener('click', () => {
  state.passionMapMode = 'standard';
  saveState();
  updatePassionMapModeButtons();
});
const __pmModeCst = document.getElementById('passionMapModeCustomBtn');
if(__pmModeCst) __pmModeCst.addEventListener('click', () => {
  if(!allPassionMapCustomFilled()){ showToast('Сначала заполните свои задания'); return; }
  state.passionMapMode = 'custom';
  saveState();
  updatePassionMapModeButtons();
});

updatePassionMapModeButtons();
