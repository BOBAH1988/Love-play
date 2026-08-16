// games/bingo.js — Игра "Секс-бинго".
// Загружается через <script src="games/bingo.js"></script> в index.html.

/* ---------- 2. СЕКС-БИНГО ---------- */
// Только ряды и столбцы — диагонали в зачёт линий не идут (как было
// изначально).
const BINGO_LINES = [
  [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
  [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24]
];
function getBingoItemsList(level){
  if(typeof BINGO_ITEMS === 'undefined' || !Array.isArray(BINGO_ITEMS)) return [];
  return BINGO_ITEMS.filter(i=>i.level===level);
}
function getBingoBonusList(level){
  if(typeof BINGO_BONUS === 'undefined' || !Array.isArray(BINGO_BONUS)) return [];
  return BINGO_BONUS.filter(i=>i.level===level);
}
// "Счастливые" клетки — не задание, а пропуск хода. Ровно 3 штуки на карту,
// раскиданы случайно среди 25 клеток и переживают повышение уровня без
// изменений (см. escalateBingoTo — при повышении такие клетки не
// заменяются заданиями нового уровня). Тот же приём, что и в "Сапёре"
// (games/kids-saper.js, KIDS_SAPER_LUCKY_TEXT).
const BINGO_LUCKY_TEXT = 'Пропустите ход';
const BINGO_LUCKY_COUNT = 3;
function generateBingoGrid(level){
  // 22 клетки — реальные задания, 3 — "счастливые" (пропуск хода).
  const pool = shuffle(getBingoItemsList(level)).slice(0, 25 - BINGO_LUCKY_COUNT);
  const items = pool.map(p=>p.text);
  while(items.length < 25 - BINGO_LUCKY_COUNT) items.push('—');
  for(let i=0;i<BINGO_LUCKY_COUNT;i++) items.push(BINGO_LUCKY_TEXT);
  const grid = shuffle(items);
  state.bingoGrid = grid;
  state.bingoChecked = grid.map(()=>false);
  state.bingoTasksHidden = false;
  state.bingoRevealed = grid.map(()=>true);
  state.bingoWonLines = [];
  state.bingoUsedBonus = [];
  state.bingoCurrentLevel = level;
  state.bingoEscalatedTo2 = false;
  state.bingoEscalatedTo3 = false;
  state.bingoVictoryMilestones = [];
  state.bingoFinished = false;
  state.bingoGridLevel = level;
}
function updateBingoLevelLabel(){
  const el = document.getElementById('bingoLevelLabel');
  if(!el) return;
  const lvl = (typeof BINGO_LEVELS !== 'undefined') ? BINGO_LEVELS.find(l=>l.id === (state.bingoCurrentLevel||1)) : null;
  el.textContent = lvl ? `Уровень сейчас: ${lvl.icon} ${lvl.name}` : '';
}
// Уменьшает шрифт клетки шаг за шагом, пока текст задания не поместится
// внутри квадратной клетки целиком — чтобы карта не "разъезжалась" за рамки
// на маленьких экранах и особенно в установленном PWA-режиме.
function fitBingoCellText(cell){
  let size = 9.5;
  cell.style.fontSize = size + 'px';
  while(cell.scrollHeight > cell.clientHeight + 1 && size > 6.5){
    size -= 0.5;
    cell.style.fontSize = size + 'px';
  }
}
function renderBingoGrid(){
  const wrap = document.getElementById('bingoGrid');
  if(!wrap) return;
  wrap.innerHTML = '';
  if(!state.bingoRevealed) state.bingoRevealed = (state.bingoGrid || []).map(()=>true);
  (state.bingoGrid || []).forEach((text,i)=>{
    const isLucky = text === BINGO_LUCKY_TEXT;
    // "Пропустите ход" — сюрприз-бонус, который работает только пока клетка
    // закрыта: если её текст виден заранее (например, в режиме "Показать
    // задания"), игрок просто обходит эту клетку стороной, и бонус теряет
    // смысл. Поэтому счастливые клетки остаются 🎁 до самого нажатия
    // независимо от общего переключателя "Скрыть/Показать задания".
    const isHidden = !state.bingoChecked[i] && (isLucky || (!!state.bingoTasksHidden && !state.bingoRevealed[i]));
    const cell = document.createElement('div');
    cell.className = 'bingo-cell' + (state.bingoChecked[i] ? ' checked' : '') + (isHidden ? ' hidden' : '') + (state.bingoChecked[i] && isLucky ? ' bingo-lucky' : '');
    cell.textContent = isHidden ? '🎁' : text;
    attachBingoCellPress(cell, i);
    wrap.appendChild(cell);
    // Скрытая клетка показывает только иконку — подгонка размера под длинный
    // текст задания ей не нужна и мешает увеличенному размеру иконки из CSS
    // (inline font-size иначе перебивает .bingo-cell.hidden{font-size:...}).
    if(!isHidden) fitBingoCellText(cell);
  });
  updateBingoLevelLabel();
}
// Обычное нажатие только отмечает клетку выполненной — снять отметку
// случайным повторным тапом больше нельзя. Снять отметку можно только
// долгим зажатием клетки (используется Pointer Events, единый механизм
// для мыши и тач-экрана).
const BINGO_LONG_PRESS_MS = 550;
function attachBingoCellPress(cell, i){
  let pressTimer = null;
  let longPressDone = false;
  const clearPressTimer = ()=>{
    if(pressTimer){ clearTimeout(pressTimer); pressTimer = null; }
  };
  const startPress = ()=>{
    longPressDone = false;
    clearPressTimer();
    if(!state.bingoChecked[i]) return; // долгое нажатие имеет смысл только на уже отмеченной клетке
    pressTimer = setTimeout(()=>{
      longPressDone = true;
      uncheckBingoCell(i);
    }, BINGO_LONG_PRESS_MS);
  };
  const endPress = ()=>{ clearPressTimer(); };
  cell.addEventListener('pointerdown', startPress);
  cell.addEventListener('pointerup', endPress);
  cell.addEventListener('pointerleave', endPress);
  cell.addEventListener('pointercancel', endPress);
  cell.addEventListener('click', ()=>{
    if(longPressDone){ longPressDone = false; return; } // клик, который браузер шлёт следом за долгим нажатием — игнорируем
    if(!state.bingoChecked[i]) checkBingoCell(i);
  });
}
// Скрытая заданиями клетка (см. "Скрыть задания") отмечается тем же одним
// нажатием, что и обычная — раньше первое нажатие только открывало 🎁 →
// текст, а отметить выполненным нужно было второе, отдельное нажатие. Это
// расходилось с правилами игры ("нажмите на клетку, чтобы отметить") и
// на практике выглядело так, будто нажатия на скрытые клетки не работают —
// линии и уровень не растут, пока не поймёшь, что нужно нажать дважды.
function checkBingoCell(i){
  if(state.bingoFinished || state.bingoChecked[i]) return;
  state.bingoChecked[i] = true;
  if(!state.bingoRevealed) state.bingoRevealed = [];
  state.bingoRevealed[i] = true;
  saveState();
  renderBingoGrid();
  playNeutralSound();
  checkBingoLines();
}
function uncheckBingoCell(i){
  if(state.bingoFinished || !state.bingoChecked[i]) return;
  state.bingoChecked[i] = false;
  saveState();
  renderBingoGrid();
  if(!state.muted && navigator.vibrate) navigator.vibrate(30);
}
function checkBingoLines(){
  BINGO_LINES.forEach((line, li)=>{
    if(state.bingoWonLines.includes(li)) return;
    const complete = line.every(idx=>state.bingoChecked[idx]);
    if(complete){
      state.bingoWonLines.push(li);
      const total = state.bingoWonLines.length;
      if(!state.bingoVictoryMilestones) state.bingoVictoryMilestones = [];
      if((total === 1 || total === 3 || total === 5) && !state.bingoVictoryMilestones.includes(total)){
        state.bingoVictoryMilestones.push(total);
        playBingoVictorySound();
      }
    }
  });
  saveState();
  advanceBingoStage();
  checkBingoGameFinished();
}
// Игра всегда начинается с уровня 1 (Нежное) и постепенно горячеет по ходу
// партии: после 1-й собранной линии (ряд или столбец; диагонали не в счёт)
// — переход на уровень 2 (Горячее), после 3-й такой линии — на уровень 3
// (Дерзкое). Раньше за оба этих перехода уровня выдавалось отдельное
// бонусное задание — теперь бонус только один, "финальный приз" за победу
// (см. showBingoSummary/pickBingoBonus); промежуточные переходы уровня
// сопровождаются только тостом (см. showToast внутри escalateBingoTo), без
// отдельного задания.
function advanceBingoStage(){
  const rowColWon = state.bingoWonLines.length; // диагоналей в BINGO_LINES больше нет — все линии считаются
  if(!state.bingoEscalatedTo2 && rowColWon >= 1){
    escalateBingoTo(2);
    state.bingoEscalatedTo2 = true;
    saveState();
    return;
  }
  if(state.bingoEscalatedTo2 && !state.bingoEscalatedTo3 && rowColWon >= 3){
    escalateBingoTo(3);
    state.bingoEscalatedTo3 = true;
    saveState();
    return;
  }
}
// Партия завершается сама, как только собрано 5 любых линий (ряд или
// столбец — диагонали не считаются) или отмечены все 25 клеток. Заполнить
// все 25 клеток, не собрав по дороге 5 линий, математически невозможно (это
// сразу все 10 линий), поэтому проверка "5 линий" в реальной игре и
// срабатывает первой — второе условие оставлено как подстраховка.
function checkBingoGameFinished(){
  if(state.bingoFinished) return;
  const total = state.bingoWonLines.length;
  const allChecked = state.bingoChecked.length === 25 && state.bingoChecked.every(Boolean);
  if(total >= 5 || allChecked){
    state.bingoFinished = true;
    state.inProgress = false;
    saveState();
    showBingoSummary();
  }
}
function showBingoSummary(){
  summaryModalMode = 'bingo';
  const total = state.bingoWonLines.length;
  const allChecked = state.bingoChecked.length === 25 && state.bingoChecked.every(Boolean);
  const lvl = (typeof BINGO_LEVELS !== 'undefined') ? BINGO_LEVELS.find(l=>l.id === (state.bingoCurrentLevel||1)) : null;
  document.getElementById('summaryWinner').textContent = '🏆 Карта пройдена!';
  document.getElementById('summaryScore').textContent = `Собрано линий: ${total} из 10`;
  document.getElementById('summaryCounts').textContent = (allChecked ? 'Отмечены все 25 клеток' : 'Собрано 5 линий') + (lvl ? ` · Уровень: ${lvl.icon} ${lvl.name}` : '');
  // Финальный приз — самый смелый уровень бонусов, выдаётся один раз, только
  // за победу.
  const bonusEl = document.getElementById('summaryBonusText');
  const finalBonus = pickBingoBonus(4);
  if(finalBonus){
    bonusEl.textContent = '🎁 Финальный приз: ' + finalBonus.text;
    bonusEl.style.display = 'block';
    addBingoBonusToChecklist(finalBonus.text);
    renderBingoBonusChecklist();
  } else {
    bonusEl.textContent = '';
    bonusEl.style.display = 'none';
  }
  saveState();
  document.getElementById('summaryModal').classList.add('show');
}
function exitBingoGameToSetup(){
  document.getElementById('bingoGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  finishBingoGame();
}
// Все ещё не отмеченные клетки заменяются заданиями нового уровня. Уже
// отмеченные клетки не трогаем — они остаются как есть, подтверждая, что
// задание выполнено.
function escalateBingoTo(nextLevel){
  const pool = shuffle(getBingoItemsList(nextLevel));
  const usedTexts = new Set(state.bingoGrid);
  let p = 0;
  for(let i=0;i<25;i++){
    if(state.bingoChecked[i]) continue;
    if(state.bingoGrid[i] === BINGO_LUCKY_TEXT) continue;
    while(p < pool.length && usedTexts.has(pool[p].text)) p++;
    const item = pool[p];
    if(item){
      state.bingoGrid[i] = item.text;
      usedTexts.add(item.text);
      p++;
    }
  }
  state.bingoCurrentLevel = nextLevel;
  renderBingoGrid();
  const lvl = (typeof BINGO_LEVELS !== 'undefined' ? BINGO_LEVELS.find(l=>l.id===nextLevel) : null);
  showToast(`Уровень повышен: ${lvl ? lvl.icon + ' ' + lvl.name : nextLevel} 🔥`);
}
// Выбор бонусного задания без повторов в рамках одной партии — единственный
// вызов теперь для финального приза (level=4) в конце партии.
function pickBingoBonus(level){
  const list = getBingoBonusList(level);
  if(!state.bingoUsedBonus) state.bingoUsedBonus = [];
  let available = list.filter(b=>!state.bingoUsedBonus.includes(b.text));
  if(available.length === 0){
    // Все бонусы этого уровня уже показаны в этой игре — начинаем пул заново,
    // но не повторяем ничего, пока не исчерпан весь список.
    state.bingoUsedBonus = [];
    available = list;
  }
  const bonus = available.length ? available[Math.floor(Math.random()*available.length)] : null;
  if(bonus) state.bingoUsedBonus.push(bonus.text);
  return bonus;
}
// Чек-лист "Бонусные задания" — накопительный список, который переживает
// смену партий (сбрасывается только вручную или через "Сбросить прогресс").
// Не добавляем точный дубликат текста, если он уже есть в списке и ещё не
// выполнен (не зачёркнут) — чтобы список не засорялся повторами одного и
// того же ещё не сделанного задания при частых партиях подряд.
function addBingoBonusToChecklist(text){
  if(!text) return;
  if(!state.bingoBonusChecklist) state.bingoBonusChecklist = [];
  const alreadyPending = state.bingoBonusChecklist.some(it => it.text === text && !it.done);
  if(alreadyPending) return;
  state.bingoBonusChecklist.push({text, done:false});
}
function renderBingoBonusChecklist(){
  const block = document.getElementById('bingoBonusChecklistBlock');
  const list = document.getElementById('bingoBonusChecklistList');
  if(!block || !list) return;
  const items = state.bingoBonusChecklist || [];
  if(items.length === 0){
    block.style.display = 'none';
    list.innerHTML = '';
    return;
  }
  block.style.display = '';
  list.innerHTML = items.map((it,i)=>`
    <li class="bingo-bonus-checklist-item${it.done ? ' done' : ''}">
      <span class="bingo-bonus-checklist-text" data-idx="${i}">${it.text}</span>
      <button type="button" class="bingo-bonus-checklist-delete" data-idx="${i}" aria-label="Удалить">✕</button>
    </li>
  `).join('');
  list.querySelectorAll('.bingo-bonus-checklist-text').forEach(el=>{
    el.addEventListener('click', ()=>{
      const idx = parseInt(el.dataset.idx, 10);
      const item = state.bingoBonusChecklist[idx];
      if(!item) return;
      item.done = !item.done;
      saveState();
      renderBingoBonusChecklist();
    });
  });
  list.querySelectorAll('.bingo-bonus-checklist-delete').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const idx = parseInt(btn.dataset.idx, 10);
      state.bingoBonusChecklist.splice(idx, 1);
      saveState();
      renderBingoBonusChecklist();
    });
  });
}
function goToBingoGame(){
  abandonPausedDavaySession();
  abandonPausedTdSession();
  abandonPausedBingoSession();
  abandonPausedKrokodilSession();
  abandonPausedWishlistSession();
  abandonPausedZnayuSession();
  abandonPausedTimerSession();
  abandonPausedPartyFantsSession();
  abandonPausedPartyTdSession();
  abandonPausedFamZnayuSession();
  abandonPausedLuckySession();
  abandonPausedFantySession();
  state.pausedMode = null;
  // Игра всегда начинается с уровня 1 (Нежное) — выбор уровня в настройке
  // убран, дальше карта повышает сложность сама по ходу игры.
  // Каждый новый запуск игры (не возобновление после паузы, для этого есть
  // отдельная resumeBingoGame()) должен давать свежую карту, а не
  // повторять сетку и отметки из прошлой законченной игры.
  generateBingoGrid(1);
  state.inProgress = true;
  saveState();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('bingoGame').classList.add('active');
  renderBingoGrid();
  updateBingoHideTasksBtn();
  renderBingoBonusChecklist();
}
// Пауза: вернуться в главное меню, не сбрасывая карту — можно продолжить
// позже через общий блок "Продолжить игру" / "Закончить игру".
function pauseBingoGame(){
  state.pausedMode = 'bingo';
  saveState();
  document.getElementById('bingoGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  updateResumeUI();
}
function resumeBingoGame(){
  state.pausedMode = null;
  saveState();
  updateResumeUI();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('bingoGame').classList.add('active');
  renderBingoGrid();
  updateBingoHideTasksBtn();
  renderBingoBonusChecklist();
}
function finishBingoGame(){
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  updateResumeUI();
}
// Итоги при выходе через паузу (партия прервана, не завершена честно) —
// показываются перед сбросом, чтобы был виден прогресс: сколько заданий
// отмечено, сколько линий собрано, и последний полученный бонус, если он
// уже был получен. Закрытие модалки (см. closeSummaryBtn) вызывает
// finishBingoGame() — тот же тихий сброс, что и раньше, просто теперь ему
// предшествует экран с итогами вместо мгновенного исчезновения карты.
function showBingoExitSummary(){
  summaryModalMode = 'bingoExit';
  const checkedCount = (state.bingoChecked || []).filter(Boolean).length;
  const total = (state.bingoWonLines || []).length;
  const lvl = (typeof BINGO_LEVELS !== 'undefined') ? BINGO_LEVELS.find(l=>l.id === (state.bingoCurrentLevel||1)) : null;
  document.getElementById('summaryWinner').textContent = '⏸️ Партия прервана';
  document.getElementById('summaryScore').textContent = `Отмечено заданий: ${checkedCount} из 25`;
  document.getElementById('summaryCounts').textContent = `Линий собрано: ${total} из 10` + (lvl ? ` · Уровень: ${lvl.icon} ${lvl.name}` : '');
  const bonusEl = document.getElementById('summaryBonusText');
  const lastBonus = (state.bingoBonusChecklist || []).slice(-1)[0];
  if(lastBonus){
    bonusEl.textContent = '🎁 Бонус: ' + lastBonus.text;
    bonusEl.style.display = 'block';
  } else {
    bonusEl.textContent = '';
    bonusEl.style.display = 'none';
  }
  document.getElementById('summaryModal').classList.add('show');
}
function updateBingoHideTasksBtn(){
  const btn = document.getElementById('bingoHideTasksBtn');
  if(!btn) return;
  btn.textContent = state.bingoTasksHidden ? '👀 Показать задания' : '🙈 Скрыть задания';
}
document.getElementById('bingoHideTasksBtn').addEventListener('click', ()=>{
  state.bingoTasksHidden = !state.bingoTasksHidden;
  if(state.bingoTasksHidden){
    state.bingoRevealed = (state.bingoGrid || []).map(()=>false);
  } else {
    state.bingoRevealed = (state.bingoGrid || []).map(()=>true);
  }
  saveState();
  updateBingoHideTasksBtn();
  renderBingoGrid();
  playSuccessSound();
});
// "Случайно" — подсказка: подсвечивает контуром случайную ещё не отмеченную
// клетку, чтобы было проще выбрать следующее задание. Подсветка снимается
// самим первым касанием экрана после этого (в т.ч. по этой же клетке).
function suggestRandomBingoCell(){
  if(state.bingoFinished){
    showToast('Партия уже завершена');
    return;
  }
  const candidates = (state.bingoChecked || []).map((v,i)=>v?null:i).filter(i=>i!==null);
  if(candidates.length === 0){
    showToast('Все клетки уже отмечены');
    return;
  }
  const idx = candidates[Math.floor(Math.random()*candidates.length)];
  const wrap = document.getElementById('bingoGrid');
  if(!wrap) return;
  wrap.querySelectorAll('.bingo-cell.bingo-suggested').forEach(c=>c.classList.remove('bingo-suggested'));
  const cellEl = wrap.children[idx];
  if(cellEl) cellEl.classList.add('bingo-suggested');
  playNeutralSound();
  document.addEventListener('pointerdown', function clearBingoSuggestion(){
    const w = document.getElementById('bingoGrid');
    if(w) w.querySelectorAll('.bingo-cell.bingo-suggested').forEach(c=>c.classList.remove('bingo-suggested'));
  }, {capture:true, once:true});
}
document.getElementById('bingoRandomBtn').addEventListener('click', ()=>{
  suggestRandomBingoCell();
});
document.getElementById('bingoPauseBtn').addEventListener('click', ()=>{
  playSuccessSound();
  pauseBingoGame();
  showToast('Игра на паузе — прогресс сохранён');
});
document.getElementById('bingoGameRulesBtn').addEventListener('click', ()=>{ document.getElementById('bingoRulesModal').classList.add('show'); });
document.getElementById('closeBingoRulesBtn').addEventListener('click', ()=>{ document.getElementById('bingoRulesModal').classList.remove('show'); });
document.getElementById('bingoRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'bingoRulesModal') e.currentTarget.classList.remove('show'); });

