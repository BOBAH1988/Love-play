// games/wishlist.js — Игра "Совместный плейлист желаний" (для двоих).
// Загружается через <script src="games/wishlist.js"></script> в index.html.

/* ---------- 4. СОВМЕСТНЫЙ ПЛЕЙЛИСТ ЖЕЛАНИЙ ---------- */
function renderWishlistSetupStarterGroup(){
  document.querySelectorAll('#wishlistSetupStarterGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', btn.dataset.value === (state.wishlistStarter || 'random'));
  });
}
document.querySelectorAll('#wishlistSetupStarterGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.wishlistStarter = btn.dataset.value;
    saveState();
    renderWishlistSetupStarterGroup();
  });
});
function goToWishlistSetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('wishlistSetup').classList.add('active');
  renderWishlistSetupStarterGroup();
}
function exitWishlistSetup(){
  document.getElementById('wishlistSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}
function resetWishlistQuiz(){
  state.wishlistQueue = [];
  state.wishlistIndex = 0;
  state.wishlistAnswers = {};
  state.wishlistActivePlayer = 0;
  state.wishlistP1Done = false;
  state.wishlistP2Done = false;
  state.wishlistPendingNext = 0;
  saveState();
}
function updateWishlistPlayerButtons(){
  const p1 = document.getElementById('wishlistPlayer1Btn');
  const p2 = document.getElementById('wishlistPlayer2Btn');
  if(p1){
    p1.textContent = state.name1 || 'Игрок 1';
    p1.classList.toggle('active', state.wishlistActivePlayer === 1);
    p1.classList.toggle('done', !!state.wishlistP1Done);
  }
  if(p2){
    p2.textContent = state.name2 || 'Игрок 2';
    p2.classList.toggle('active', state.wishlistActivePlayer === 2);
    p2.classList.toggle('done', !!state.wishlistP2Done);
  }
  updateWishlistProgressBar();
}
function updateWishlistProgressBar(){
  const fill = document.getElementById('wishlistProgressFill');
  const label = document.getElementById('wishlistProgressLabel');
  if(!fill || !label) return;
  const total = state.wishlistQueue.length;
  const done = Math.min(state.wishlistIndex, total);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  fill.style.width = pct + '%';
  label.textContent = total > 0 ? `${done} / ${total}` : '0 / 15';
}
// Оформление карточки скопировано со стиля игры "Фанты" (border-top по полу
// отвечающего игрока, шапка с именем). Уровней в этой игре нет, поэтому
// вместо плашки уровня в шапке — счётчик прогресса "X / N".
function wishlistCardHeaderHtml(label, name, showBadge){
  const total = state.wishlistQueue.length;
  const done = Math.min(state.wishlistIndex, total);
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
function showWishlistHandoffCard(nextPlayerNum){
  const nextName = nextPlayerNum === 2 ? (state.name2 || 'Игрок 2') : (state.name1 || 'Игрок 1');
  const gender = nextPlayerNum === 2 ? 'F' : 'M';
  document.getElementById('wishlistAnswerRow').style.display = 'none';
  document.getElementById('wishlistHandoffRow').style.display = 'flex';
  fadeSwapEl('wishlistCard', (el)=>{
    el.className = 'card';
    el.style.borderTop = `10px solid ${GENDER_COLORS[gender]}`;
    el.innerHTML = `<div class="card-inner">${wishlistCardHeaderHtml('Дальше отвечает', nextName, false)}<div class="card-body"><div class="card-icon">💞</div><div class="card-text">Передайте телефон игроку «${nextName}»</div></div></div>`;
  });
}
function showWishlistCurrentItem(){
  const idx = state.wishlistQueue[state.wishlistIndex];
  const items = (typeof WISHLIST_ITEMS !== 'undefined' && Array.isArray(WISHLIST_ITEMS)) ? WISHLIST_ITEMS : [];
  const item = items[idx];
  const gender = state.wishlistActivePlayer === 2 ? 'F' : 'M';
  const turnName = state.wishlistActivePlayer === 2 ? (state.name2 || 'Игрок 2') : (state.name1 || 'Игрок 1');
  document.getElementById('wishlistAnswerRow').style.display = 'flex';
  document.getElementById('wishlistHandoffRow').style.display = 'none';
  fadeSwapEl('wishlistCard', (el)=>{
    el.className = 'card';
    el.style.borderTop = `10px solid ${GENDER_COLORS[gender]}`;
    const titleHtml = `<div class="wishlist-item-title">${item ? item.text : '—'}</div>`;
    const descHtml = (item && item.desc) ? `<div class="wishlist-item-desc">${item.desc}</div>` : '';
    el.innerHTML = `<div class="card-inner">${wishlistCardHeaderHtml('Отвечает', turnName, true)}<div class="card-body"><div class="card-icon">💌</div>${titleHtml}${descHtml}</div></div>`;
  });
}
function startWishlistPlayer(playerNum){
  if(state.wishlistActivePlayer !== 0) return;
  if(playerNum === 1 && state.wishlistP1Done) return;
  if(playerNum === 2 && state.wishlistP2Done) return;
  if(state.wishlistQueue.length === 0){
    const items = (typeof WISHLIST_ITEMS !== 'undefined' && Array.isArray(WISHLIST_ITEMS)) ? WISHLIST_ITEMS : [];
    // Пункты, на которые кто-то из партнёров ответил "Нет", больше не
    // предлагаются в новых играх — до нажатия "Сбросить прогресс" в настройках.
    const hidden = state.wishlistHidden || [];
    const allIdx = items.map((c,i)=>i);
    let pool = allIdx.filter(i=>!hidden.includes(i));
    if(pool.length === 0) pool = allIdx; // на случай, если скрыты вообще все пункты
    else if(pool.length < 15) showToast(`Доступно только ${pool.length} желаний — используем их`);
    state.wishlistQueue = shuffle(pool).slice(0,15);
  }
  state.wishlistIndex = 0;
  state.wishlistActivePlayer = playerNum;
  saveState();
  updateWishlistPlayerButtons();
  showWishlistCurrentItem();
}
function answerWishlistItem(answer){
  if(!state.wishlistActivePlayer) return;
  const idx = state.wishlistQueue[state.wishlistIndex];
  if(idx === undefined) return;
  if(!state.wishlistAnswers[idx]) state.wishlistAnswers[idx] = {};
  const key = state.wishlistActivePlayer === 1 ? 'p1' : 'p2';
  state.wishlistAnswers[idx][key] = answer;
  state.wishlistIndex++;
  if(state.wishlistIndex < state.wishlistQueue.length){
    saveState();
    updateWishlistProgressBar();
    showWishlistCurrentItem();
    return;
  }
  const finishedPlayer = state.wishlistActivePlayer;
  if(finishedPlayer === 1) state.wishlistP1Done = true; else state.wishlistP2Done = true;
  state.wishlistActivePlayer = 0;
  const otherDone = finishedPlayer === 1 ? state.wishlistP2Done : state.wishlistP1Done;
  if(!otherDone){
    const nextPlayer = finishedPlayer === 1 ? 2 : 1;
    state.wishlistPendingNext = nextPlayer;
    saveState();
    updateWishlistPlayerButtons();
    showWishlistHandoffCard(nextPlayer);
  } else {
    saveState();
    finishWishlistSummary();
  }
}
// Общий постраничный вывод для списков совпадений (за игру и за всё время):
// если пунктов больше WISHLIST_PAGE_SIZE, показываем по страницам с кнопками
// "◀"/"▶" вместо одного длинного списка.
const WISHLIST_PAGE_SIZE = 7;
const WISHLIST_SUMMARY_PAGINATION_IDS = {list:'wishlistSummaryList', pagination:'wishlistSummaryPagination', label:'wishlistSummaryPageLabel', prev:'wishlistSummaryPrevBtn', next:'wishlistSummaryNextBtn'};
const WISHLIST_HISTORY_PAGINATION_IDS = {list:'wishlistHistoryList', pagination:'wishlistHistoryPagination', label:'wishlistHistoryPageLabel', prev:'wishlistHistoryPrevBtn', next:'wishlistHistoryNextBtn'};
let wishlistSummaryMatches = [];
let wishlistSummaryPage = 0;
let wishlistHistoryPage = 0;
function renderWishlistPage(items, page, ids, deletable){
  const listEl = document.getElementById(ids.list);
  const paginationEl = document.getElementById(ids.pagination);
  const labelEl = document.getElementById(ids.label);
  const prevBtn = document.getElementById(ids.prev);
  const nextBtn = document.getElementById(ids.next);
  const totalPages = Math.max(1, Math.ceil(items.length / WISHLIST_PAGE_SIZE));
  const clampedPage = Math.min(Math.max(page, 0), totalPages - 1);
  const start = clampedPage * WISHLIST_PAGE_SIZE;
  listEl.innerHTML = items.slice(start, start + WISHLIST_PAGE_SIZE).map((t,i)=>{
    // В истории "Совпадения" (deletable=true) у каждого пункта — красный
    // крестик справа, удаляющий его из сохранённой истории. data-idx —
    // индекс в ПОЛНОМ массиве (с учётом текущей страницы).
    if(deletable){
      return `<li><div class="match-item-row"><div class="match-item-main">${t}</div><button type="button" class="match-item-del" data-idx="${start + i}" aria-label="Удалить совпадение">✕</button></div></li>`;
    }
    return `<li>${t}</li>`;
  }).join('');
  if(items.length > WISHLIST_PAGE_SIZE){
    paginationEl.style.display = 'flex';
    labelEl.textContent = `${clampedPage+1} / ${totalPages}`;
    prevBtn.disabled = clampedPage === 0;
    nextBtn.disabled = clampedPage >= totalPages - 1;
  } else {
    paginationEl.style.display = 'none';
  }
  return clampedPage;
}
function finishWishlistSummary(){
  const items = (typeof WISHLIST_ITEMS !== 'undefined' && Array.isArray(WISHLIST_ITEMS)) ? WISHLIST_ITEMS : [];
  const matches = [];
  // "Нет" от ЛЮБОГО из партнёров — пункт скрывается из будущих игр (как в
  // "Давай попробуем"/"Видеорулетке"), до нажатия "Сбросить прогресс".
  const newHidden = [];
  state.wishlistQueue.forEach(idx=>{
    const a = state.wishlistAnswers[idx];
    if(!a) return;
    if(a.p1 === true && a.p2 === true){
      const item = items[idx];
      if(item) matches.push(item.text);
    }
    if(a.p1 === false || a.p2 === false){
      newHidden.push(idx);
    }
  });
  if(newHidden.length){
    if(!state.wishlistHidden) state.wishlistHidden = [];
    newHidden.forEach(idx=>{
      if(!state.wishlistHidden.includes(idx)) state.wishlistHidden.push(idx);
    });
  }
  const introEl = document.getElementById('wishlistSummaryIntro');
  if(matches.length === 0){
    introEl.textContent = 'В этот раз совпадений не нашлось — попробуйте ещё раз с другими пунктами.';
  } else {
    introEl.textContent = `Вы оба хотите попробовать (${matches.length}):`;
  }
  wishlistSummaryMatches = matches;
  wishlistSummaryPage = renderWishlistPage(wishlistSummaryMatches, 0, WISHLIST_SUMMARY_PAGINATION_IDS);
  // Копим совпадения этой игры в общую историю (на кнопку "Совпадения" в
  // настройках), чтобы партнёры могли посмотреть все совпавшие желания за
  // всё время игры, не только за последний раунд. Дубликаты не добавляем.
  if(matches.length){
    if(!state.wishlistMatchHistory) state.wishlistMatchHistory = [];
    matches.forEach(t=>{
      if(!state.wishlistMatchHistory.includes(t)) state.wishlistMatchHistory.push(t);
    });
  }
  saveState();
  document.getElementById('wishlistSummaryModal').classList.add('show');
}
function renderWishlistHistory(page){
  const introEl = document.getElementById('wishlistHistoryIntro');
  const history = state.wishlistMatchHistory || [];
  if(history.length === 0){
    introEl.textContent = 'Пока нет совпадений — сыграйте хотя бы раз, чтобы что-то здесь появилось.';
  } else {
    introEl.textContent = `Вы оба хотели попробовать за всё время (${history.length}):`;
  }
  // История — удаляемая: у каждого пункта красный крестик (см. deleteWishlistMatch).
  wishlistHistoryPage = renderWishlistPage(history, page || 0, WISHLIST_HISTORY_PAGINATION_IDS, true);
}
// Удаление одного совпадения из общей истории (красный крестик в "Совпадениях").
// Скрытие пунктов (wishlistHidden) не трогаем — это отдельная механика будущих игр.
function deleteWishlistMatch(idx){
  const history = state.wishlistMatchHistory || [];
  if(idx < 0 || idx >= history.length) return;
  playErrorSound();
  history.splice(idx, 1);
  saveState();
  showToast('Совпадение удалено из истории 🗑️');
  renderWishlistHistory(wishlistHistoryPage); // перерисовка текущей страницы
}
document.getElementById('wishlistSetupExitBtn').addEventListener('click', exitWishlistSetup);
document.getElementById('wishlistSetupStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  abandonPausedDavaySession();
  abandonPausedTdSession();
  abandonPausedBingoSession();
  abandonPausedKrokodilSession();
  abandonPausedZnayuSession();
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
  resetWishlistQuiz();
  state.inProgress = true;
  saveState();
  document.getElementById('wishlistSetup').classList.remove('active');
  document.getElementById('wishlistGame').classList.add('active');
  updateWishlistPlayerButtons();
  startWishlistPlayer(pickStartingPlayerValue(state.wishlistStarter || 'random'));
});
// Пауза: вернуться в главное меню, не сбрасывая прогресс опроса — можно
// продолжить позже через общий блок "Продолжить игру" / "Закончить игру".
function renderWishlistResumeState(){
  updateWishlistPlayerButtons();
  if(state.wishlistActivePlayer){
    showWishlistCurrentItem();
  } else if(state.wishlistPendingNext){
    showWishlistHandoffCard(state.wishlistPendingNext);
  }
}
function pauseWishlistGame(){
  state.pausedMode = 'wishlist';
  saveState();
  document.getElementById('wishlistGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  updateResumeUI();
}
function resumeWishlistGame(){
  state.pausedMode = null;
  saveState();
  updateResumeUI();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('wishlistGame').classList.add('active');
  renderWishlistResumeState();
}
function finishWishlistGame(){
  resetWishlistQuiz();
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  updateResumeUI();
}
document.getElementById('wishlistYesBtn').addEventListener('click', ()=>{ playSuccessSound(); answerWishlistItem(true); });
// Звук "Нет" намеренно совпадает со звуком "Да" — чтобы партнёр рядом не
// различил на слух, какую кнопку нажали, и не догадался об ответе.
document.getElementById('wishlistNoBtn').addEventListener('click', ()=>{ playSuccessSound(); answerWishlistItem(false); });
// Свайп на карточке "Твои желания" — вправо «Да», влево «Нет» (звук у обоих
// одинаковый — см. комментарий выше про приватность ответа).
(function setupWishlistSwipe(){
  const cardEl = document.getElementById('wishlistCard');
  if(!cardEl) return;
  let startX = 0, startY = 0, tracking = false;
  cardEl.addEventListener('touchstart', (e)=>{
    if(e.touches.length!==1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, {passive:true});
  cardEl.addEventListener('touchend', (e)=>{
    if(!tracking) return;
    tracking = false;
    const answerRow = document.getElementById('wishlistAnswerRow');
    if(!answerRow || answerRow.style.display === 'none') return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    const absX = Math.abs(dx), absY = Math.abs(dy);
    const threshold = 70;
    if(absX < threshold || absX < absY) return;
    playSuccessSound();
    answerWishlistItem(dx > 0);
  }, {passive:true});
})();
document.getElementById('wishlistHandoffStartBtn').addEventListener('click', ()=>{
  const next = state.wishlistPendingNext || 2;
  state.wishlistPendingNext = 0;
  saveState();
  startWishlistPlayer(next);
});
document.getElementById('wishlistExitBtn').addEventListener('click', ()=>{
  pauseWishlistGame();
  showToast('Игра на паузе — прогресс сохранён');
});
document.getElementById('closeWishlistSummaryBtn').addEventListener('click', ()=>{
  document.getElementById('wishlistSummaryModal').classList.remove('show');
  document.getElementById('wishlistGame').classList.remove('active');
  document.getElementById('wishlistSetup').classList.add('active');
  resetWishlistQuiz();
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  renderWishlistSetupStarterGroup();
});
(document.getElementById('wishlistSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ document.getElementById('wishlistRulesModal').classList.add('show'); });
document.getElementById('closeWishlistRulesBtn').addEventListener('click', ()=>{ document.getElementById('wishlistRulesModal').classList.remove('show'); });
document.getElementById('wishlistRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'wishlistRulesModal') e.currentTarget.classList.remove('show'); });
document.getElementById('wishlistHistoryBtn').addEventListener('click', ()=>{
  renderWishlistHistory();
  document.getElementById('wishlistHistoryModal').classList.add('show');
});
document.getElementById('closeWishlistHistoryBtn').addEventListener('click', ()=>{ document.getElementById('wishlistHistoryModal').classList.remove('show'); });
document.getElementById('wishlistHistoryModal').addEventListener('click', (e)=>{ if(e.target.id === 'wishlistHistoryModal') e.currentTarget.classList.remove('show'); });
document.getElementById('wishlistSummaryPrevBtn').addEventListener('click', ()=>{
  wishlistSummaryPage = renderWishlistPage(wishlistSummaryMatches, wishlistSummaryPage - 1, WISHLIST_SUMMARY_PAGINATION_IDS);
});
document.getElementById('wishlistSummaryNextBtn').addEventListener('click', ()=>{
  wishlistSummaryPage = renderWishlistPage(wishlistSummaryMatches, wishlistSummaryPage + 1, WISHLIST_SUMMARY_PAGINATION_IDS);
});
document.getElementById('wishlistHistoryPrevBtn').addEventListener('click', ()=>{
  wishlistHistoryPage = renderWishlistPage(state.wishlistMatchHistory || [], wishlistHistoryPage - 1, WISHLIST_HISTORY_PAGINATION_IDS, true);
});
document.getElementById('wishlistHistoryNextBtn').addEventListener('click', ()=>{
  wishlistHistoryPage = renderWishlistPage(state.wishlistMatchHistory || [], wishlistHistoryPage + 1, WISHLIST_HISTORY_PAGINATION_IDS, true);
});
// Клик по строке в списке совпадений (за игру или за всё время) открывает
// карточку с заголовком и полным описанием этого пункта.
function showWishlistItemDetail(title){
  const items = (typeof WISHLIST_ITEMS !== 'undefined' && Array.isArray(WISHLIST_ITEMS)) ? WISHLIST_ITEMS : [];
  const item = items.find(i=>i.text === title);
  document.getElementById('wishlistItemModalTitle').textContent = '💜 ' + title;
  document.getElementById('wishlistItemModalDesc').textContent = item && item.desc ? item.desc : '';
  document.getElementById('wishlistItemModal').classList.add('show');
}
document.getElementById('wishlistSummaryList').addEventListener('click', (e)=>{
  const li = e.target.closest('li');
  if(li) showWishlistItemDetail(li.textContent);
});
document.getElementById('wishlistHistoryList').addEventListener('click', (e)=>{
  // Красный крестик — удаление из истории, деталь-карточку не открываем.
  const del = e.target.closest('.match-item-del');
  if(del){
    deleteWishlistMatch(parseInt(del.dataset.idx, 10));
    return;
  }
  const li = e.target.closest('li');
  if(!li) return;
  // Текст пункта берём без крестика (он лежит в .match-item-main рядом).
  const main = li.querySelector('.match-item-main');
  showWishlistItemDetail((main ? main.textContent : li.textContent).trim());
});
document.getElementById('closeWishlistItemBtn').addEventListener('click', ()=>{ document.getElementById('wishlistItemModal').classList.remove('show'); });
document.getElementById('wishlistItemModal').addEventListener('click', (e)=>{ if(e.target.id === 'wishlistItemModal') e.currentTarget.classList.remove('show'); });

