// games/kids-saper.js — Игра "Сапёр" (дети).
// Загружается через <script src="games/kids-saper.js"></script> в index.html.
// Механика полностью скопирована с "Секс-бинго" (games/bingo.js): карта
// 5×5, 3 уровня, автоповышение сложности после 1-й и 3-й собранной линии,
// накопительный чек-лист бонусных заданий. Отличия: задания семейные
// (cards_kids_saper.js), своя (не общая) модалка итогов, и "Выход" сразу
// завершает партию — без общего меню паузы/резюме, которым пользуются игры
// для компании (тот же простой паттерн, что у детских Крокодила/Мемасиков).
const KIDS_SAPER_LINES = [
  [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
  [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24]
];
function getKidsSaperItemsList(level){
  if(typeof KIDS_SAPER_ITEMS === 'undefined' || !Array.isArray(KIDS_SAPER_ITEMS)) return [];
  return KIDS_SAPER_ITEMS.filter(i=>i.level===level);
}
function getKidsSaperBonusList(level){
  if(typeof KIDS_SAPER_BONUS === 'undefined' || !Array.isArray(KIDS_SAPER_BONUS)) return [];
  return KIDS_SAPER_BONUS.filter(i=>i.level===level);
}
// "Счастливые" клетки — не задание, а пропуск хода. Ровно 4 штуки на карту,
// раскиданы случайно среди 25 клеток (см. generateKidsSaperGrid). Текст
// клетки — единственный признак, по которому её узнают escalateKidsSaperTo
// (при повышении уровня такие клетки не заменяются заданиями) и рендер
// (см. KIDS_SAPER_LUCKY_TEXT ниже).
const KIDS_SAPER_LUCKY_TEXT = 'Вам повезло! Вы пропускаете ход.';
const KIDS_SAPER_LUCKY_COUNT = 4;
function generateKidsSaperGrid(level){
  const pool = shuffle(getKidsSaperItemsList(level)).slice(0, 25 - KIDS_SAPER_LUCKY_COUNT);
  const items = pool.map(p=>p.text);
  while(items.length < 25 - KIDS_SAPER_LUCKY_COUNT) items.push('—');
  for(let i=0;i<KIDS_SAPER_LUCKY_COUNT;i++) items.push(KIDS_SAPER_LUCKY_TEXT);
  const grid = shuffle(items);
  state.kidsSaperGrid = grid;
  state.kidsSaperChecked = grid.map(()=>false);
  state.kidsSaperWonLines = [];
  state.kidsSaperUsedBonus = [];
  state.kidsSaperCurrentLevel = level;
  state.kidsSaperEscalatedTo2 = false;
  state.kidsSaperEscalatedTo3 = false;
  state.kidsSaperFinished = false;
  // Каждая новая партия снова начинается закрытой (💣ой) — как и раньше,
  // просто теперь это управляемый переключателем режим (см.
  // kidsSaperHideTasksBtn), а не жёстко зашитое поведение.
  state.kidsSaperTasksHidden = true;
}
function updateKidsSaperLevelLabel(){
  const el = document.getElementById('kidsSaperLevelLabel');
  if(!el) return;
  const lvl = (typeof KIDS_SAPER_LEVELS !== 'undefined') ? KIDS_SAPER_LEVELS.find(l=>l.id === (state.kidsSaperCurrentLevel||1)) : null;
  el.textContent = lvl ? `Уровень сейчас: ${lvl.icon} ${lvl.name}` : '';
}
function fitKidsSaperCellText(cell){
  let size = 9.5;
  cell.style.fontSize = size + 'px';
  while(cell.scrollHeight > cell.clientHeight + 1 && size > 6.5){
    size -= 0.5;
    cell.style.fontSize = size + 'px';
  }
}
function renderKidsSaperGrid(){
  const wrap = document.getElementById('kidsSaperGrid');
  if(!wrap) return;
  wrap.innerHTML = '';
  (state.kidsSaperGrid || []).forEach((text,i)=>{
    const cell = document.createElement('div');
    const isOpen = !!state.kidsSaperChecked[i];
    const isLucky = text === KIDS_SAPER_LUCKY_TEXT;
    // "Показать задания" — чисто визуальный предпросмотр: снимает 💣 со всех
    // ещё не открытых клеток, ничего не меняя в самой механике (нажатие на
    // клетку по-прежнему сразу открывает/засчитывает её, независимо от того,
    // видели вы текст заранее или нет). Исключение — счастливые клетки
    // "Пропустите ход": та же причина, что и в Секс-бинго (см. bingo.js) —
    // если их видно заранее, дети их просто обходят и бонус теряет смысл.
    const isHidden = !isOpen && (isLucky || !!state.kidsSaperTasksHidden);
    cell.className = 'bingo-cell kids-saper-cell' + (isOpen ? ' checked' : ' closed') + (isOpen && isLucky ? ' kids-saper-lucky' : '') + (isHidden ? ' hidden' : '');
    cell.textContent = isHidden ? '💣' : text;
    attachKidsSaperCellPress(cell, i);
    wrap.appendChild(cell);
    if(!isHidden) fitKidsSaperCellText(cell);
  });
  updateKidsSaperLevelLabel();
}
function updateKidsSaperHideTasksBtn(){
  const btn = document.getElementById('kidsSaperHideTasksBtn');
  if(!btn) return;
  btn.textContent = state.kidsSaperTasksHidden ? '👀 Показать задания' : '🙈 Скрыть задания';
}
const KIDS_SAPER_LONG_PRESS_MS = 550;
function attachKidsSaperCellPress(cell, i){
  let pressTimer = null;
  let longPressDone = false;
  const clearPressTimer = ()=>{
    if(pressTimer){ clearTimeout(pressTimer); pressTimer = null; }
  };
  const startPress = ()=>{
    longPressDone = false;
    clearPressTimer();
    if(!state.kidsSaperChecked[i]) return;
    pressTimer = setTimeout(()=>{
      longPressDone = true;
      uncheckKidsSaperCell(i);
    }, KIDS_SAPER_LONG_PRESS_MS);
  };
  const endPress = ()=>{ clearPressTimer(); };
  cell.addEventListener('pointerdown', startPress);
  cell.addEventListener('pointerup', endPress);
  cell.addEventListener('pointerleave', endPress);
  cell.addEventListener('pointercancel', endPress);
  cell.addEventListener('click', ()=>{
    if(longPressDone){ longPressDone = false; return; }
    if(!state.kidsSaperChecked[i]) checkKidsSaperCell(i);
  });
}
function checkKidsSaperCell(i){
  if(state.kidsSaperFinished || state.kidsSaperChecked[i]) return;
  state.kidsSaperChecked[i] = true;
  saveState();
  renderKidsSaperGrid();
  playNeutralSound();
  checkKidsSaperLines();
}
function uncheckKidsSaperCell(i){
  if(state.kidsSaperFinished || !state.kidsSaperChecked[i]) return;
  state.kidsSaperChecked[i] = false;
  saveState();
  renderKidsSaperGrid();
  if(!state.muted && navigator.vibrate) navigator.vibrate(30);
}
function checkKidsSaperLines(){
  KIDS_SAPER_LINES.forEach((line, li)=>{
    if(state.kidsSaperWonLines.includes(li)) return;
    const complete = line.every(idx=>state.kidsSaperChecked[idx]);
    if(complete){
      state.kidsSaperWonLines.push(li);
      const total = state.kidsSaperWonLines.length;
      if(total === 1 || total === 3 || total === 5) playBingoVictorySound();
    }
  });
  saveState();
  advanceKidsSaperStage();
  checkKidsSaperGameFinished();
}
function advanceKidsSaperStage(){
  const rowColWon = state.kidsSaperWonLines.length;
  if(!state.kidsSaperEscalatedTo2 && rowColWon >= 1){
    escalateKidsSaperTo(2);
    state.kidsSaperEscalatedTo2 = true;
    saveState();
    return;
  }
  if(state.kidsSaperEscalatedTo2 && !state.kidsSaperEscalatedTo3 && rowColWon >= 3){
    escalateKidsSaperTo(3);
    state.kidsSaperEscalatedTo3 = true;
    saveState();
    return;
  }
}
function checkKidsSaperGameFinished(){
  if(state.kidsSaperFinished) return;
  const total = state.kidsSaperWonLines.length;
  const allChecked = state.kidsSaperChecked.length === 25 && state.kidsSaperChecked.every(Boolean);
  if(total >= 5 || allChecked){
    state.kidsSaperFinished = true;
    saveState();
    showKidsSaperSummary();
  }
}
function showKidsSaperSummary(){
  const total = state.kidsSaperWonLines.length;
  const allChecked = state.kidsSaperChecked.length === 25 && state.kidsSaperChecked.every(Boolean);
  const lvl = (typeof KIDS_SAPER_LEVELS !== 'undefined') ? KIDS_SAPER_LEVELS.find(l=>l.id === (state.kidsSaperCurrentLevel||1)) : null;
  document.getElementById('kidsSaperSummaryWinner').textContent = '🏆 Поле обезврежено!';
  document.getElementById('kidsSaperSummaryScore').textContent = `Собрано линий: ${total} из 10`;
  document.getElementById('kidsSaperSummaryCounts').textContent = (allChecked ? 'Отмечены все 25 клеток' : 'Собрано 5 линий') + (lvl ? ` · Уровень: ${lvl.icon} ${lvl.name}` : '');
  const bonusEl = document.getElementById('kidsSaperSummaryBonusText');
  const finalBonus = pickKidsSaperBonus(3);
  if(finalBonus){
    bonusEl.textContent = '🎁 Финальный приз: ' + finalBonus.text;
    bonusEl.style.display = 'block';
    addKidsSaperBonusToChecklist(finalBonus.text);
    renderKidsSaperBonusChecklist();
  } else {
    bonusEl.textContent = '';
    bonusEl.style.display = 'none';
  }
  saveState();
  document.getElementById('kidsSaperSummaryModal').classList.add('show');
}
function exitKidsSaperGameToSetup(){
  document.getElementById('kidsSaperSummaryModal').classList.remove('show');
  document.getElementById('kidsSaperGame').classList.remove('active');
  document.getElementById('kidsSaperSetup').classList.add('active');
}
function escalateKidsSaperTo(nextLevel){
  const pool = shuffle(getKidsSaperItemsList(nextLevel));
  const usedTexts = new Set(state.kidsSaperGrid);
  let p = 0;
  for(let i=0;i<25;i++){
    if(state.kidsSaperChecked[i]) continue;
    if(state.kidsSaperGrid[i] === KIDS_SAPER_LUCKY_TEXT) continue;
    while(p < pool.length && usedTexts.has(pool[p].text)) p++;
    const item = pool[p];
    if(item){
      state.kidsSaperGrid[i] = item.text;
      usedTexts.add(item.text);
      p++;
    }
  }
  state.kidsSaperCurrentLevel = nextLevel;
  renderKidsSaperGrid();
  const lvl = (typeof KIDS_SAPER_LEVELS !== 'undefined' ? KIDS_SAPER_LEVELS.find(l=>l.id===nextLevel) : null);
  showToast(`Уровень повышен: ${lvl ? lvl.icon + ' ' + lvl.name : nextLevel} 🎉`);
}
function pickKidsSaperBonus(level){
  const list = getKidsSaperBonusList(level);
  if(!state.kidsSaperUsedBonus) state.kidsSaperUsedBonus = [];
  let available = list.filter(b=>!state.kidsSaperUsedBonus.includes(b.text));
  if(available.length === 0){
    state.kidsSaperUsedBonus = [];
    available = list;
  }
  const bonus = available.length ? available[Math.floor(Math.random()*available.length)] : null;
  if(bonus) state.kidsSaperUsedBonus.push(bonus.text);
  return bonus;
}
function addKidsSaperBonusToChecklist(text){
  if(!text) return;
  if(!state.kidsSaperBonusChecklist) state.kidsSaperBonusChecklist = [];
  const alreadyPending = state.kidsSaperBonusChecklist.some(it => it.text === text && !it.done);
  if(alreadyPending) return;
  state.kidsSaperBonusChecklist.push({text, done:false});
}
function renderKidsSaperBonusChecklist(){
  const block = document.getElementById('kidsSaperBonusChecklistBlock');
  const list = document.getElementById('kidsSaperBonusChecklistList');
  if(!block || !list) return;
  const items = state.kidsSaperBonusChecklist || [];
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
      const item = state.kidsSaperBonusChecklist[idx];
      if(!item) return;
      item.done = !item.done;
      saveState();
      renderKidsSaperBonusChecklist();
    });
  });
  list.querySelectorAll('.bingo-bonus-checklist-delete').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const idx = parseInt(btn.dataset.idx, 10);
      state.kidsSaperBonusChecklist.splice(idx, 1);
      saveState();
      renderKidsSaperBonusChecklist();
    });
  });
}
function goToKidsSaperSetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('kidsSaperSetup').classList.add('active');
}
function exitKidsSaperSetup(){
  document.getElementById('kidsSaperSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}
function goToKidsSaperGame(){
  generateKidsSaperGrid(1);
  saveState();
  document.getElementById('kidsSaperSetup').classList.remove('active');
  document.getElementById('kidsSaperGame').classList.add('active');
  renderKidsSaperGrid();
  updateKidsSaperHideTasksBtn();
  renderKidsSaperBonusChecklist();
  requestWakeLock();
}
document.getElementById('kidsSaperSetupStartBtn').addEventListener('click', ()=>{ goToKidsSaperGame(); });
document.getElementById('kidsSaperSetupExitBtn').addEventListener('click', ()=>{ exitKidsSaperSetup(); });
document.getElementById('kidsSaperHideTasksBtn').addEventListener('click', ()=>{
  state.kidsSaperTasksHidden = !state.kidsSaperTasksHidden;
  saveState();
  updateKidsSaperHideTasksBtn();
  renderKidsSaperGrid();
});
function suggestRandomKidsSaperCell(){
  if(state.kidsSaperFinished){
    showToast('Партия уже завершена');
    return;
  }
  const candidates = (state.kidsSaperChecked || []).map((v,i)=>v?null:i).filter(i=>i!==null);
  if(candidates.length === 0){
    showToast('Все клетки уже отмечены');
    return;
  }
  const idx = candidates[Math.floor(Math.random()*candidates.length)];
  const wrap = document.getElementById('kidsSaperGrid');
  if(!wrap) return;
  wrap.querySelectorAll('.bingo-cell.bingo-suggested').forEach(c=>c.classList.remove('bingo-suggested'));
  const cellEl = wrap.children[idx];
  if(cellEl) cellEl.classList.add('bingo-suggested');
  playNeutralSound();
  document.addEventListener('pointerdown', function clearKidsSaperSuggestion(){
    const w = document.getElementById('kidsSaperGrid');
    if(w) w.querySelectorAll('.bingo-cell.bingo-suggested').forEach(c=>c.classList.remove('bingo-suggested'));
  }, {capture:true, once:true});
}
document.getElementById('kidsSaperRandomBtn').addEventListener('click', ()=>{
  suggestRandomKidsSaperCell();
});
document.getElementById('kidsSaperExitBtn').addEventListener('click', ()=>{
  exitKidsSaperGameToSetup();
});
document.getElementById('closeKidsSaperSummaryBtn').addEventListener('click', ()=>{ exitKidsSaperGameToSetup(); });
document.getElementById('kidsSaperGameRulesBtn').addEventListener('click', ()=>{ document.getElementById('kidsSaperRulesModal').classList.add('show'); });
document.getElementById('closeKidsSaperRulesBtn').addEventListener('click', ()=>{ document.getElementById('kidsSaperRulesModal').classList.remove('show'); });
document.getElementById('kidsSaperRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'kidsSaperRulesModal') e.currentTarget.classList.remove('show'); });
