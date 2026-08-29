// games/znayu.js — Игра "Тайные ответы" (для двоих).
// Загружается через <script src="games/znayu.js"></script> в index.html.

/* ---------- 5. ТАЙНЫЕ ОТВЕТЫ ---------- */
function renderZnayuSetupStarterGroup(){
  document.querySelectorAll('#znayuSetupStarterGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', btn.dataset.value === (state.znayuStarter || 'random'));
  });
}
document.querySelectorAll('#znayuSetupStarterGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.znayuStarter = btn.dataset.value;
    saveState();
    renderZnayuSetupStarterGroup();
  });
});
function goToZnayuSetup(){
  // Если предыдущая партия не была доиграна и корректно завершена (например,
  // приложение закрыли посреди вопросов), state.znayuActivePlayer мог
  // остаться не равным 0 — на всякий случай сбрасываем прогресс уже здесь,
  // а не только по кнопке "Начать", чтобы новая партия точно стартовала чисто.
  if(state.znayuActivePlayer !== 0 || state.znayuP1Done || state.znayuP2Done){
    resetZnayuQuiz();
  }
  document.getElementById('setup').classList.remove('active');
  document.getElementById('znayuSetup').classList.add('active');
  renderZnayuSetupStarterGroup();
}
function exitZnayuSetup(){
  document.getElementById('znayuSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}
// Сколько вопросов задаётся за одну партию — случайная выборка из полного
// банка (см. cards_znayu.js), а не всегда одни и те же по порядку.
const ZNAYU_ROUND_SIZE = 10;
// Вопросы, заблокированные кнопкой "Не хочу отвечать" (state.znayuHidden) —
// исключаются из выборки для новых раундов, пока прогресс не сброшен.
function getZnayuAvailableIndexes(items){
  const hidden = state.znayuHidden || [];
  return items.map((c,i)=>i).filter(i=>!hidden.includes(i));
}
function resetZnayuQuiz(){
  const items = (typeof ZNAYU_ITEMS !== 'undefined' && Array.isArray(ZNAYU_ITEMS)) ? ZNAYU_ITEMS : [];
  const allIdx = getZnayuAvailableIndexes(items);
  const size = Math.min(ZNAYU_ROUND_SIZE, allIdx.length);
  state.znayuQueue = shuffle(allIdx).slice(0, size);
  state.znayuIndex = 0;
  state.znayuAnswers = {};
  state.znayuActivePlayer = 0;
  state.znayuP1Done = false;
  state.znayuP2Done = false;
  state.znayuPendingNext = 0;
  saveState();
}
function updateZnayuPlayerButtons(){
  const p1 = document.getElementById('znayuPlayer1Btn');
  const p2 = document.getElementById('znayuPlayer2Btn');
  if(p1){
    p1.textContent = state.name1 || 'Игрок 1';
    p1.classList.toggle('active', state.znayuActivePlayer === 1);
    p1.classList.toggle('done', !!state.znayuP1Done);
  }
  if(p2){
    p2.textContent = state.name2 || 'Игрок 2';
    p2.classList.toggle('active', state.znayuActivePlayer === 2);
    p2.classList.toggle('done', !!state.znayuP2Done);
  }
  updateZnayuProgressBar();
}
function updateZnayuProgressBar(){
  const fill = document.getElementById('znayuProgressFill');
  const label = document.getElementById('znayuProgressLabel');
  if(!fill || !label) return;
  const total = state.znayuQueue.length;
  const done = Math.min(state.znayuIndex, total);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  fill.style.width = pct + '%';
  label.textContent = total > 0 ? `${done} / ${total}` : '0 / 10';
}
// Оформление карточки скопировано со стиля игры "Фанты" (border-top по полу
// отвечающего игрока, шапка с именем). Уровней в этой игре нет, поэтому
// вместо плашки уровня в шапке — счётчик прогресса "X / N".
function znayuCardHeaderHtml(label, name, showBadge){
  const total = state.znayuQueue.length;
  const done = Math.min(state.znayuIndex, total);
  return `
    <div class="card-header">
      <div class="card-turn">
        <div class="card-turn-label">${label}</div>
        <div class="card-turn-name">${name}</div>
      </div>
      ${showBadge ? `<div class="badge"><span class="level-pill" style="background:#ff6ea8">${done} / ${total || 15}</span></div>` : ''}
    </div>
  `;
}
function showZnayuHandoffCard(nextPlayerNum){
  const nextName = nextPlayerNum === 2 ? (state.name2 || 'Игрок 2') : (state.name1 || 'Игрок 1');
  const gender = nextPlayerNum === 2 ? 'F' : 'M';
  document.getElementById('znayuHandoffRow').style.display = 'flex';
  fadeSwapEl('znayuCard', (el)=>{
    el.className = 'card';
    el.style.borderTop = `10px solid ${GENDER_COLORS[gender]}`;
    el.innerHTML = `<div class="card-inner">${znayuCardHeaderHtml('Дальше отвечает', nextName, false)}<div class="card-body"><div class="card-icon znayu-handoff-icon">💞</div><div class="card-text">Передайте телефон игроку «${nextName}»</div></div></div>`;
  });
}
// Карточка вопроса: заголовок вверху карты — сам вопрос, ниже 3 кнопки с
// вариантами ответа и отдельная кнопка "Не хочу отвечать". Выбор любого из
// вариантов сразу фиксирует ответ и переключает на следующий вопрос (см.
// answerZnayuItem) — отдельных кнопок "Да"/"Нет" в этой игре больше нет.
// "Не хочу отвечать" ответ не засчитывает, а сам вопрос блокирует для всех
// будущих партий (см. skipZnayuItem).
function renderZnayuPlaceholderCard(){
  fadeSwapEl('znayuCard', (el)=>{
    el.className = 'card card-empty';
    el.style.borderTop = '';
    el.innerHTML = `<div class="card-inner"><div class="card-icon">💑</div><div class="card-text">Не удалось загрузить вопросы — попробуйте обновить приложение</div></div>`;
  });
}
function showZnayuCurrentItem(){
  const items = (typeof ZNAYU_ITEMS !== 'undefined' && Array.isArray(ZNAYU_ITEMS)) ? ZNAYU_ITEMS : [];
  let idx = state.znayuQueue[state.znayuIndex];
  let item = items[idx];
  if(!item){
    // Защита от несовместимых старых данных в localStorage (например, если
    // очередь была сохранена ещё до переделки игры в квиз или до расширения
    // банка вопросов) — вместо пустой карточки пересобираем очередь заново
    // (случайная выборка) и показываем вопрос с начала.
    if(items.length === 0){ renderZnayuPlaceholderCard(); return; }
    const allIdx = getZnayuAvailableIndexes(items);
    state.znayuQueue = shuffle(allIdx).slice(0, Math.min(ZNAYU_ROUND_SIZE, allIdx.length));
    state.znayuIndex = 0;
    saveState();
    idx = state.znayuQueue[0];
    item = items[idx];
    if(!item){ renderZnayuPlaceholderCard(); return; }
  }
  const gender = state.znayuActivePlayer === 2 ? 'F' : 'M';
  document.getElementById('znayuHandoffRow').style.display = 'none';
  fadeSwapEl('znayuCard', (el)=>{
    el.className = 'card';
    el.style.borderTop = `10px solid ${GENDER_COLORS[gender]}`;
    const questionHtml = `<div class="znayu-question-text">${item ? item.question : '—'}</div>`;
    const options = (item && Array.isArray(item.options)) ? item.options : [];
    const answersHtml = `<div class="znayu-answers">${options.map((opt,i)=>`<button type="button" class="btn btn-secondary znayu-answer-btn" data-idx="${i}">${opt}</button>`).join('')}</div>`;
    // Вопрос — единственное содержимое .card-body (flex:1, центрирует его по
    // вертикали и горизонтали в оставшемся месте карточки). Кнопки ответов и
    // "Не хочу отвечать" вынесены ИЗ .card-body и идут следом как обычные
    // потомки .card-inner — за счёт flex:1 у .card-body они всегда прижаты
    // к самому низу карточки, независимо от длины вопроса.
    const skipBtnHtml = `<button type="button" class="btn btn-secondary znayu-answer-btn znayu-skip-btn">Не хочу отвечать</button>`;
    el.innerHTML = `<div class="card-inner"><div class="card-body">${questionHtml}</div>${answersHtml}${skipBtnHtml}</div>`;
    el.querySelectorAll('.znayu-answer-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if(btn.classList.contains('znayu-skip-btn')){
          playErrorSound();
          showToast('Вопрос скрыт навсегда 🚫');
          skipZnayuItem();
          return;
        }
        playSuccessSound();
        answerZnayuItem(parseInt(btn.dataset.idx, 10));
      });
    });
  });
}
function startZnayuPlayer(playerNum){
  if(state.znayuActivePlayer !== 0) return;
  if(playerNum === 1 && state.znayuP1Done) return;
  if(playerNum === 2 && state.znayuP2Done) return;
  const items = (typeof ZNAYU_ITEMS !== 'undefined' && Array.isArray(ZNAYU_ITEMS)) ? ZNAYU_ITEMS : [];
  // Очередь вопросов на партию собирается заранее в resetZnayuQuiz() —
  // случайная выборка ZNAYU_ROUND_SIZE вопросов из полного банка. Здесь
  // только подстраховка: если очередь вдруг пуста или содержит индексы вне
  // диапазона текущего каталога (например, сохранение осталось от старой
  // версии игры с другим числом вопросов), пересобираем её тоже случайно.
  const queueValid = state.znayuQueue.length > 0 && state.znayuQueue.every(i => i >= 0 && i < items.length);
  if(!queueValid){
    const allIdx = getZnayuAvailableIndexes(items);
    state.znayuQueue = shuffle(allIdx).slice(0, Math.min(ZNAYU_ROUND_SIZE, allIdx.length));
  }
  state.znayuIndex = 0;
  state.znayuActivePlayer = playerNum;
  saveState();
  updateZnayuPlayerButtons();
  showZnayuCurrentItem();
}
// answer — индекс выбранного варианта ответа (0-2), а не Да/Нет.
function answerZnayuItem(answer){
  if(!state.znayuActivePlayer) return;
  const idx = state.znayuQueue[state.znayuIndex];
  if(idx === undefined) return;
  if(!state.znayuAnswers[idx]) state.znayuAnswers[idx] = {};
  const key = state.znayuActivePlayer === 1 ? 'p1' : 'p2';
  state.znayuAnswers[idx][key] = answer;
  advanceZnayuQueue();
}
// Кнопка "Не хочу отвечать" — в отличие от обычного ответа НИЧЕГО не
// записывает в state.znayuAnswers (значит вопрос никогда не попадёт в
// список совпадений ни в этом раунде, ни задним числом), а сам вопрос
// добавляется в state.znayuHidden — в СЛЕДУЮЩИХ партиях он больше не будет
// предложен ни одному из партнёров, пока прогресс не сброшен ("Сбросить
// прогресс" в настройках). Текущий раунд (уже собранная очередь) при этом
// не трогаем — оба партнёра всё равно отвечают на одни и те же 10 вопросов
// текущей партии для честного сравнения.
function skipZnayuItem(){
  if(!state.znayuActivePlayer) return;
  const idx = state.znayuQueue[state.znayuIndex];
  if(idx === undefined) return;
  if(!state.znayuHidden) state.znayuHidden = [];
  if(!state.znayuHidden.includes(idx)) state.znayuHidden.push(idx);
  advanceZnayuQueue();
}
// Общий переход к следующему вопросу очереди (или к завершению партии) —
// используется и обычным ответом, и кнопкой "Не хочу отвечать".
function advanceZnayuQueue(){
  state.znayuIndex++;
  if(state.znayuIndex < state.znayuQueue.length){
    saveState();
    updateZnayuProgressBar();
    showZnayuCurrentItem();
    return;
  }
  const finishedPlayer = state.znayuActivePlayer;
  if(finishedPlayer === 1) state.znayuP1Done = true; else state.znayuP2Done = true;
  state.znayuActivePlayer = 0;
  const otherDone = finishedPlayer === 1 ? state.znayuP2Done : state.znayuP1Done;
  if(!otherDone){
    const nextPlayer = finishedPlayer === 1 ? 2 : 1;
    state.znayuPendingNext = nextPlayer;
    saveState();
    updateZnayuPlayerButtons();
    showZnayuHandoffCard(nextPlayer);
  } else {
    saveState();
    finishZnayuSummary();
  }
}
// Общий постраничный вывод для списков совпадений (за игру и за всё время):
// если пунктов больше ZNAYU_PAGE_SIZE, показываем по страницам с кнопками
// "◀"/"▶" вместо одного длинного списка.
const ZNAYU_PAGE_SIZE = 7;
const ZNAYU_SUMMARY_PAGINATION_IDS = {list:'znayuSummaryList', pagination:'znayuSummaryPagination', label:'znayuSummaryPageLabel', prev:'znayuSummaryPrevBtn', next:'znayuSummaryNextBtn'};
const ZNAYU_HISTORY_PAGINATION_IDS = {list:'znayuHistoryList', pagination:'znayuHistoryPagination', label:'znayuHistoryPageLabel', prev:'znayuHistoryPrevBtn', next:'znayuHistoryNextBtn'};
let znayuSummaryMatches = [];
let znayuSummaryPage = 0;
let znayuHistoryPage = 0;
function renderZnayuPage(items, page, ids, deletable){
  const listEl = document.getElementById(ids.list);
  const paginationEl = document.getElementById(ids.pagination);
  const labelEl = document.getElementById(ids.label);
  const prevBtn = document.getElementById(ids.prev);
  const nextBtn = document.getElementById(ids.next);
  const totalPages = Math.max(1, Math.ceil(items.length / ZNAYU_PAGE_SIZE));
  const clampedPage = Math.min(Math.max(page, 0), totalPages - 1);
  const start = clampedPage * ZNAYU_PAGE_SIZE;
  listEl.innerHTML = items.slice(start, start + ZNAYU_PAGE_SIZE).map((t,i)=>{
    // В истории "Совпадения" (deletable=true) у каждого пункта — красный
    // крестик справа, удаляющий его из сохранённой истории. data-idx —
    // индекс в ПОЛНОМ массиве (с учётом текущей страницы).
    if(deletable){
      return `<li><div class="match-item-row"><div class="match-item-main">${t}</div><button type="button" class="match-item-del" data-idx="${start + i}" aria-label="Удалить совпадение">✕</button></div></li>`;
    }
    return `<li>${t}</li>`;
  }).join('');
  if(items.length > ZNAYU_PAGE_SIZE){
    paginationEl.style.display = 'flex';
    labelEl.textContent = `${clampedPage+1} / ${totalPages}`;
    prevBtn.disabled = clampedPage === 0;
    nextBtn.disabled = clampedPage >= totalPages - 1;
  } else {
    paginationEl.style.display = 'none';
  }
  return clampedPage;
}
function finishZnayuSummary(){
  const items = (typeof ZNAYU_ITEMS !== 'undefined' && Array.isArray(ZNAYU_ITEMS)) ? ZNAYU_ITEMS : [];
  const matches = [];
  let almostCount = 0;
  // Совпадение — это одинаковый выбранный вариант ответа у обоих партнёров
  // (в отличие от "Твои желания", здесь нет отдельного "Нет" и скрытия пунктов).
  // "Почти совпало" — ответы разные, но соседние по порядку вариантов на
  // карточке (например, 1-й и 2-й) — сам вопрос при этом НЕ показывается,
  // только общий счётчик, чтобы не выдавать, о чём именно шла речь.
  state.znayuQueue.forEach(idx=>{
    const a = state.znayuAnswers[idx];
    if(!a || a.p1 === undefined || a.p2 === undefined) return;
    if(a.p1 === a.p2){
      const item = items[idx];
      if(item && Array.isArray(item.options) && item.options[a.p1] !== undefined){
        matches.push(`${item.question} — ${item.options[a.p1]}`);
      }
    } else if(Math.abs(a.p1 - a.p2) === 1){
      almostCount++;
    }
  });
  const introEl = document.getElementById('znayuSummaryIntro');
  if(matches.length === 0){
    introEl.textContent = 'В этот раз совпадений не нашлось — мнения разошлись почти во всём.';
  } else {
    introEl.textContent = `Ваши ответы совпали в ${matches.length} из ${state.znayuQueue.length}:`;
  }
  const almostEl = document.getElementById('znayuSummaryAlmost');
  if(almostCount > 0){
    almostEl.textContent = `💛 Почти совпало: ${almostCount}`;
    almostEl.style.display = '';
  } else {
    almostEl.style.display = 'none';
  }
  znayuSummaryMatches = matches;
  znayuSummaryPage = renderZnayuPage(znayuSummaryMatches, 0, ZNAYU_SUMMARY_PAGINATION_IDS);
  // Копим совпадения этой игры в общую историю (на кнопку "Совпадения" в
  // настройках), чтобы партнёры могли посмотреть все совпавшие желания за
  // всё время игры, не только за последний раунд. Дубликаты не добавляем.
  if(matches.length){
    if(!state.znayuMatchHistory) state.znayuMatchHistory = [];
    matches.forEach(t=>{
      if(!state.znayuMatchHistory.includes(t)) state.znayuMatchHistory.push(t);
    });
  }
  saveState();
  document.getElementById('znayuSummaryModal').classList.add('show');
}
function renderZnayuHistory(page){
  const introEl = document.getElementById('znayuHistoryIntro');
  const history = state.znayuMatchHistory || [];
  if(history.length === 0){
    introEl.textContent = 'Пока нет совпадений — сыграйте хотя бы раз, чтобы что-то здесь появилось.';
  } else {
    introEl.textContent = `Ваши совпавшие ответы за всё время (${history.length}):`;
  }
  // История — удаляемая: у каждого пункта красный крестик (см. deleteZnayuMatch).
  znayuHistoryPage = renderZnayuPage(history, page || 0, ZNAYU_HISTORY_PAGINATION_IDS, true);
}
// Удаление одного совпадения из общей истории (красный крестик в "Совпадениях").
function deleteZnayuMatch(idx){
  const history = state.znayuMatchHistory || [];
  if(idx < 0 || idx >= history.length) return;
  playErrorSound();
  history.splice(idx, 1);
  saveState();
  showToast('Совпадение удалено из истории 🗑️');
  renderZnayuHistory(znayuHistoryPage); // перерисовка текущей страницы
}
document.getElementById('znayuSetupExitBtn').addEventListener('click', exitZnayuSetup);
document.getElementById('znayuSetupStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  abandonPausedDavaySession();
  abandonPausedTdSession();
  abandonPausedBingoSession();
  abandonPausedKrokodilSession();
  abandonPausedWishlistSession();
  abandonPausedTimerSession();
  abandonPausedPartyFantsSession();
  abandonPausedPartyTdSession();
  abandonPausedFamZnayuSession();
  abandonPausedLuckySession();
  abandonPausedFantySession();
  abandonPausedSoloBsSession();
  state.pausedMode = null;
  const n1raw = document.getElementById('name1').value.trim();
  const n2raw = document.getElementById('name2').value.trim();
  state.name1 = n1raw || 'Men';
  state.name2 = n2raw || 'Sexy';
  resetZnayuQuiz();
  state.inProgress = true;
  saveState();
  document.getElementById('znayuSetup').classList.remove('active');
  document.getElementById('znayuGame').classList.add('active');
  updateZnayuPlayerButtons();
  startZnayuPlayer(pickStartingPlayerValue(state.znayuStarter || 'random'));
});
document.getElementById('znayuHandoffStartBtn').addEventListener('click', ()=>{
  const next = state.znayuPendingNext || 2;
  state.znayuPendingNext = 0;
  saveState();
  startZnayuPlayer(next);
});
document.getElementById('znayuExitBtn').addEventListener('click', ()=>{
  pauseZnayuGame();
  showToast('Игра на паузе — прогресс сохранён');
});
document.getElementById('closeZnayuSummaryBtn').addEventListener('click', ()=>{
  document.getElementById('znayuSummaryModal').classList.remove('show');
  document.getElementById('znayuGame').classList.remove('active');
  document.getElementById('znayuSetup').classList.add('active');
  resetZnayuQuiz();
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  renderZnayuSetupStarterGroup();
});
// Пауза: вернуться в главное меню, не сбрасывая прогресс опроса — можно
// продолжить позже через общий блок "Продолжить игру" / "Закончить игру".
function renderZnayuResumeState(){
  updateZnayuPlayerButtons();
  if(state.znayuActivePlayer){
    showZnayuCurrentItem();
  } else if(state.znayuPendingNext){
    showZnayuHandoffCard(state.znayuPendingNext);
  }
}
function pauseZnayuGame(){
  state.pausedMode = 'znayu';
  saveState();
  document.getElementById('znayuGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  updateResumeUI();
}
function resumeZnayuGame(){
  state.pausedMode = null;
  saveState();
  updateResumeUI();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('znayuGame').classList.add('active');
  renderZnayuResumeState();
}
function finishZnayuGame(){
  resetZnayuQuiz();
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  updateResumeUI();
}
document.getElementById('znayuSetupRulesBtn').addEventListener('click', ()=>{ document.getElementById('znayuRulesModal').classList.add('show'); });
document.getElementById('closeZnayuRulesBtn').addEventListener('click', ()=>{ document.getElementById('znayuRulesModal').classList.remove('show'); });
document.getElementById('znayuRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'znayuRulesModal') e.currentTarget.classList.remove('show'); });
document.getElementById('znayuHistoryBtn').addEventListener('click', ()=>{
  renderZnayuHistory();
  document.getElementById('znayuHistoryModal').classList.add('show');
});
document.getElementById('closeZnayuHistoryBtn').addEventListener('click', ()=>{ document.getElementById('znayuHistoryModal').classList.remove('show'); });
document.getElementById('znayuHistoryModal').addEventListener('click', (e)=>{ if(e.target.id === 'znayuHistoryModal') e.currentTarget.classList.remove('show'); });
document.getElementById('znayuSummaryPrevBtn').addEventListener('click', ()=>{
  znayuSummaryPage = renderZnayuPage(znayuSummaryMatches, znayuSummaryPage - 1, ZNAYU_SUMMARY_PAGINATION_IDS);
});
document.getElementById('znayuSummaryNextBtn').addEventListener('click', ()=>{
  znayuSummaryPage = renderZnayuPage(znayuSummaryMatches, znayuSummaryPage + 1, ZNAYU_SUMMARY_PAGINATION_IDS);
});
document.getElementById('znayuHistoryPrevBtn').addEventListener('click', ()=>{
  znayuHistoryPage = renderZnayuPage(state.znayuMatchHistory || [], znayuHistoryPage - 1, ZNAYU_HISTORY_PAGINATION_IDS, true);
});
document.getElementById('znayuHistoryNextBtn').addEventListener('click', ()=>{
  znayuHistoryPage = renderZnayuPage(state.znayuMatchHistory || [], znayuHistoryPage + 1, ZNAYU_HISTORY_PAGINATION_IDS, true);
});
// Красный крестик в списке истории — удаление совпадения (см. deleteZnayuMatch).
document.getElementById('znayuHistoryList').addEventListener('click', (e)=>{
  const del = e.target.closest('.match-item-del');
  if(!del) return;
  deleteZnayuMatch(parseInt(del.dataset.idx, 10));
});
if(!getSortedActiveLevels().includes(state.levelCap)) state.levelCap = getSortedActiveLevels()[0];
renderLevelToggles();
renderStarterGroup();
renderModeGroup();
document.getElementById('name1').value = state.name1 || '';
document.getElementById('name2').value = state.name2 || '';
updateStarterLabels();
renderDavaySetupStarterGroup();
renderDavaySetupLevels();
updateDavaySetupStarterLabels();
davaySoundOn = !!state.davaySoundOn;
updateDavayMuteBtn();
videoSoundOn = !!state.videoSoundOn;
updateVideoMuteBtn();
updateMuteBtn();
renderPartyPlayers();
updateResumeUI();
updateFavoritesOnlyBtn();
populateNewCardLevelSelect();
try{
  if(sessionStorage.getItem('appJustUpdated')){
    sessionStorage.removeItem('appJustUpdated');
    setTimeout(()=>showToast('У вас последняя версия'), 400);
  }
}catch(e){}
