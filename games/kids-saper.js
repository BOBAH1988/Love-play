// games/kids-saper.js — Игра "Сапёр" (дети): настоящая сапёрская механика.
// 5×5, скрытые 💣-мины (кол-во растёт с уровнем), безопасные клетки раскрываются
// по нажатию: соседние с миной — число соседних мин, пустые зоны — весёлые
// семейные задания (KIDS_SAPER_ITEMS). Победа = раскрыть все безопасные клетки,
// поражение = попасть на мину. Уровень растёт с каждой победой (до 3-го).
// В отличие от оригинального «бинго-сапёра» здесь НЕТ сбора линий.
// Загружается через <script src="games/kids-saper.js"></script> в index.html.
const KIDS_SAPER_COLS = 5;
const KIDS_SAPER_SIZE = 25;
// Цвета цифр по количеству соседних мин (классическая палитра сапёра).
const KIDS_SAPER_NUMBER_COLORS = {
  1: '#73c2fb', 2: '#2ecc71', 3: '#ff5e8e', 4: '#ff8a5e',
  5: '#ffa726', 6: '#4dd0e1', 7: '#ab47bc', 8: '#607d8b'
};

function getKidsSaperLevelById(id){
  if(typeof KIDS_SAPER_LEVELS === 'undefined' || !Array.isArray(KIDS_SAPER_LEVELS)) return null;
  return KIDS_SAPER_LEVELS.find(l=>l.id === id) || null;
}
function getKidsSaperMinesForLevel(level){
  const lvl = (typeof level === 'number') ? getKidsSaperLevelById(level) : (level || null);
  if(lvl && typeof lvl.mines === 'number') return lvl.mines;
  return 5;
}
function getKidsSaperItemsList(level){
  if(typeof KIDS_SAPER_ITEMS === 'undefined' || !Array.isArray(KIDS_SAPER_ITEMS)) return [];
  return KIDS_SAPER_ITEMS.filter(i=>i.level===level);
}
function getKidsSaperBonusList(level){
  if(typeof KIDS_SAPER_BONUS === 'undefined' || !Array.isArray(KIDS_SAPER_BONUS)) return [];
  return KIDS_SAPER_BONUS.filter(i=>i.level===level);
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

// Индексы 8 соседей клетки i (с учётом границ поля 5×5).
function kidsSaperNeighborIndices(i){
  const r = Math.floor(i / KIDS_SAPER_COLS);
  const c = i % KIDS_SAPER_COLS;
  const out = [];
  for(let dr = -1; dr <= 1; dr++){
    for(let dc = -1; dc <= 1; dc++){
      if(dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if(nr < 0 || nr > 4 || nc < 0 || nc > 4) continue;
      out.push(nr * KIDS_SAPER_COLS + nc);
    }
  }
  return out;
}

function generateKidsSaperGrid(level){
  const cells = new Array(KIDS_SAPER_SIZE).fill(null).map(() => ({ mine:false, count:0, text:'' }));
  const mineCount = getKidsSaperMinesForLevel(level);
  const positions = shuffle([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24]);
  for(let k = 0; k < mineCount; k++){ cells[positions[k]].mine = true; }

  // Счётчики мин вокруг каждой безопасной клетки.
  cells.forEach((cell, i)=>{
    if(cell.mine) return;
    const neighbors = kidsSaperNeighborIndices(i);
    cell.count = neighbors.filter(n => cells[n].mine).length;
  });

  // Пустым клеткам (count === 0) — весёлые семейные задания или зелёные «пропусти ход».
  // Половина пустых клеток — зелёные (если заданий нет — все зелёные).
  const pool = shuffle(getKidsSaperItemsList(level)).map(p => p.text);
  const emptyCells = [];
  cells.forEach((cell, i)=>{
    if(!cell.mine && cell.count === 0) emptyCells.push(i);
  });
  const greenCount = Math.floor(emptyCells.length / 2);
  const greenIndices = new Set();
  const shuffledEmpty = shuffle(emptyCells);
  for(let i = 0; i < greenCount; i++){
    greenIndices.add(shuffledEmpty[i]);
  }
  let pt = 0;
  cells.forEach((cell, i)=>{
    if(greenIndices.has(i)){
      cell.text = 'Вам повезло — пропустите ход!';
      cell.green = true;
    } else if(!cell.mine && cell.count === 0){
      cell.text = pool.length ? (pool[pt] || '—') : '—';
      cell.green = false;
      pt = (pt + 1) % pool.length;
    }
  });

  state.kidsSaperGrid = cells;
  state.kidsSaperChecked = cells.map(() => false);
  state.kidsSaperFlags = cells.map(() => false);
  // kidsSaperWonLines/kidsSaperEscalated* устарели — не трогаем. usedBonus
  // накапливается между играми (чтобы не повторять один и тот же приз слишком
  // часто), поэтому здесь его не сбрасываем.
  state.kidsSaperCurrentLevel = (typeof level === 'number') ? level : (state.kidsSaperCurrentLevel || 1);
  state.kidsSaperFinished = false;
  state.kidsSaperTasksHidden = true;
}

function updateKidsSaperLevelLabel(){
  const el = document.getElementById('kidsSaperLevelLabel');
  if(!el) return;
  const lvl = getKidsSaperLevelById(state.kidsSaperCurrentLevel || 1);
  const mineCount = getKidsSaperMinesForLevel(state.kidsSaperCurrentLevel || 1);
  el.textContent = lvl ? `Уровень: ${lvl.icon} ${lvl.name} · 💣 мин: ${mineCount}` : '';
}
function updateKidsSaperStatusLabel(){
  const el = document.getElementById('kidsSaperStatusLabel');
  if(!el) return;
  const grid = state.kidsSaperGrid || [];
  const totalSafe = grid.filter(c => !c.mine).length;
  const openedSafe = grid.reduce((acc, c, i) => acc + ((!c.mine && state.kidsSaperChecked[i]) ? 1 : 0), 0);
  const flags = state.kidsSaperFlags.filter(f => f).length;
  const mineCount = getKidsSaperMinesForLevel(state.kidsSaperCurrentLevel || 1);
  el.textContent = `Открыто: ${openedSafe}/${totalSafe} · 🚩: ${flags}/${mineCount}`;
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
  const cells = state.kidsSaperGrid || [];
  // «👀 Показать задания» — режим просмотра: раскрываем все клетки для
  // предпросмотра (числа, задания и даже 💣-мины), не меняя саму игру.
  const preview = !state.kidsSaperTasksHidden;
  (cells).forEach((cell, i)=>{
    const cellEl = document.createElement('div');
    const isOpen = !!state.kidsSaperChecked[i];
    const isFlag = !!state.kidsSaperFlags[i];
    // Флажок всегда поверх: даже в превью флажок не снимается.
    const effectiveOpen = isOpen || preview;
    cellEl.className = 'bingo-cell kids-saper-cell';
    cellEl.dataset.idx = i;

    if(isFlag && !isOpen){
      cellEl.textContent = '🚩';
      cellEl.classList.add('kids-saper-flagged');
    } else if(isOpen && cell.mine){
      // Взорвалась минa — только когда игрок настоящне на неё нажал (поражение).
      cellEl.textContent = '💥';
      cellEl.classList.add('kids-saper-mine');
    } else if(effectiveOpen && !cell.mine){
      if(cell.count > 0){
        cellEl.textContent = String(cell.count);
        cellEl.classList.add('kids-saper-number');
        cellEl.style.color = KIDS_SAPER_NUMBER_COLORS[cell.count] || '#fff';
      } else if(cell.green){
        cellEl.textContent = cell.text || '💚';
        cellEl.classList.add('kids-saper-green');
      } else {
        cellEl.textContent = cell.text || '—';
        cellEl.classList.add('kids-saper-task');
      }
    } else {
      // Закрытая клетка (и скрытая в превью) — 💣-заглушка.
      cellEl.textContent = '💣';
      cellEl.classList.add('kids-saper-closed');
    }

    cellEl.disabled = !!isOpen || !!state.kidsSaperFinished;
    attachKidsSaperCellPress(cellEl, i);
    wrap.appendChild(cellEl);
    if(!cellEl.classList.contains('kids-saper-number') && !cellEl.classList.contains('kids-saper-flagged')) fitKidsSaperCellText(cellEl);
  });
   updateKidsSaperLevelLabel();
   updateKidsSaperStatusLabel();
   updateKidsSaperHideTasksBtn();
}

const KIDS_SAPER_LONG_PRESS_MS = 550;

// Одиночное нажатие — открыть клетку; удержание (long press) — поставить/снять 🚩.
function attachKidsSaperCellPress(cell, i){
  let pressTimer = null;
  let longPressDone = false;
  const clearPressTimer = ()=>{
    if(pressTimer){ clearTimeout(pressTimer); pressTimer = null; }
  };
  const startPress = (e)=>{
    longPressDone = false;
    // long press только левой/средней кнопкой — правой уже есть контекстное
    // меню (поставить/снять 🚩). Действует только по закрытой клетке, пока
    // партия не завершена.
    if(e.button !== 0 && e.button !== 1) return;
    if(state.kidsSaperChecked[i] || state.kidsSaperFinished) return;
    clearPressTimer();
    pressTimer = setTimeout(()=>{
      longPressDone = true;
      toggleKidsSaperFlag(i);
    }, KIDS_SAPER_LONG_PRESS_MS);
  };
  const endPress = (e)=>{
    if(e && e.button !== 0 && e.button !== 1) return;
    clearPressTimer();
  };
  cell.addEventListener('pointerdown', startPress);
  cell.addEventListener('pointerup', endPress);
  cell.addEventListener('pointerleave', endPress);
  cell.addEventListener('pointercancel', endPress);
  cell.addEventListener('contextmenu', (e)=>{ e.preventDefault(); toggleKidsSaperFlag(i); });
  cell.addEventListener('click', ()=>{
    if(longPressDone){ longPressDone = false; return; }
    if(state.kidsSaperFinished) return;
    openKidsSaperCell(i);
  });
}

// Удержание открывает меню флажка на закрытую клетку (long press) — в отличие
// от bingo, где long press снимал отметку. Здесь long press на закрытой клетке
// ставит/снимает 🚩; на уже раскрытой — ничего.
function toggleKidsSaperFlag(i){
  if(state.kidsSaperChecked[i] || state.kidsSaperFinished) return;
  state.kidsSaperFlags[i] = !state.kidsSaperFlags[i];
  saveState();
  renderKidsSaperGrid();
  playNeutralSound();
  updateKidsSaperStatusLabel();
}

function openKidsSaperCell(i){
  if(state.kidsSaperFinished) return;
  if(state.kidsSaperChecked[i] || state.kidsSaperFlags[i]) return;
  const cell = (state.kidsSaperGrid || [])[i];
  if(!cell) return;
   if(cell.mine){
    openKidsSaperCellRevealAll(true /* lose */);
    return;
  }
  openKidsSaperFlood(i);
  saveState();
  playNeutralSound();
  renderKidsSaperGrid();
  checkKidsSaperWin();
}

// Промывка (flood fill) по пустым зонам, как в классическом сапёре.
function openKidsSaperFlood(start){
  const grid = state.kidsSaperGrid || [];
  const stack = [start];
  while(stack.length){
    const i = stack.pop();
    if(state.kidsSaperChecked[i] || state.kidsSaperFlags[i]) continue;
    state.kidsSaperChecked[i] = true;
    const cell = grid[i];
    if(cell.count === 0){
      kidsSaperNeighborIndices(i).forEach(n => {
        if(!state.kidsSaperChecked[n]) stack.push(n);
      });
    }
  }
}

function checkKidsSaperWin(){
  const grid = state.kidsSaperGrid || [];
  if(grid.length < KIDS_SAPER_SIZE) return;
  const allSafeRevealed = grid.every((c, i) => c.mine || state.kidsSaperChecked[i]);
  if(allSafeRevealed){
    state.kidsSaperFinished = true;
    saveState();
    showKidsSaperSummary(true /* win */);
  }
}

// Открывает все минные клетки (вызывается при поражении), чтобы показать, где
// они прятались. При gameOver дополнительно показывается экран поражения.
function openKidsSaperCellRevealAll(gameOver){
  const grid = state.kidsSaperGrid || [];
  grid.forEach((cell, i)=>{
    if(cell.mine && !state.kidsSaperChecked[i]) state.kidsSaperChecked[i] = true;
  });
  state.kidsSaperFinished = true;
  if(gameOver){
    saveState();
    renderKidsSaperGrid();
    showKidsSaperSummary(false /* lose */);
  } else {
    saveState();
    renderKidsSaperGrid();
  }
}

function suggestRandomKidsSaperCell(){
  const grid = state.kidsSaperGrid || [];
  if(grid.length < KIDS_SAPER_SIZE || state.kidsSaperFinished){
    showToast('Игра уже завершена');
    return;
  }
  const candidates = [];
  grid.forEach((c, i)=>{
    if(state.kidsSaperChecked[i] || state.kidsSaperFlags[i]) return;
    if(c.mine) return;
    candidates.push(i);
  });
  if(candidates.length === 0){
    showToast('Все безопасные клетки уже открыты');
    return;
  }
  const idx = candidates[Math.floor(Math.random() * candidates.length)];
  const wrap = document.getElementById('kidsSaperGrid');
  if(!wrap) return;
  wrap.querySelectorAll('.kids-saper-suggested').forEach(c=>c.classList.remove('kids-saper-suggested'));
  const cellEl = wrap.querySelector('[data-idx="'+idx+'"]');
  if(cellEl) cellEl.classList.add('kids-saper-suggested');
  playNeutralSound();
  document.addEventListener('pointerdown', function clearKidsSaperSuggestion(){
    const w = document.getElementById('kidsSaperGrid');
    if(w) w.querySelectorAll('.kids-saper-suggested').forEach(c=>c.classList.remove('kids-saper-suggested'));
  }, {capture:true, once:true});
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
  // Новая партия: стартуем на текущем уровне (по умолчанию 1). Уровень растёт
  // с победами — см. showKidsSaperSummary.
  const level = state.kidsSaperCurrentLevel || 1;
  generateKidsSaperGrid(level);
  saveState();
  document.getElementById('kidsSaperSetup').classList.remove('active');
  document.getElementById('kidsSaperGame').classList.add('active');
  renderKidsSaperGrid();
  updateKidsSaperHideTasksBtn();
  updateKidsSaperLevelLabel();
  renderKidsSaperBonusChecklist();
  requestWakeLock();
}
function exitKidsSaperGameToSetup(){
  document.getElementById('kidsSaperSummaryModal').classList.remove('show');
  document.getElementById('kidsSaperGame').classList.remove('active');
  document.getElementById('kidsSaperSetup').classList.add('active');
}

function showKidsSaperSummary(win){
  const grid = state.kidsSaperGrid || [];
  const mineCount = grid.filter(c => c.mine).length;
  const revealedSafe = grid.reduce((acc, c, i) => acc + ((c.mine ? false : state.kidsSaperChecked[i]) ? 1 : 0), 0);
  const lvl = getKidsSaperLevelById(state.kidsSaperCurrentLevel || 1);
  const wonLevel = state.kidsSaperCurrentLevel || 1;

  const titleEl = document.getElementById('kidsSaperSummaryWinner');
  const scoreEl = document.getElementById('kidsSaperSummaryScore');
  const countsEl = document.getElementById('kidsSaperSummaryCounts');
  const bonusEl = document.getElementById('kidsSaperSummaryBonusText');

  if(win){
    titleEl.textContent = '🏆 Поле обезврежено!';
    scoreEl.textContent = `Открыто безопасных клеток: ${revealedSafe} из ${KIDS_SAPER_SIZE - mineCount}`;
    playBingoVictorySound();
    // Повышаем уровень для следующей игры (до 3-го). Приз берём за победу на
    // ТОМ уровне, который только что сдели.
    if(lvl && state.kidsSaperCurrentLevel < 3){
      state.kidsSaperCurrentLevel = state.kidsSaperCurrentLevel + 1;
      saveState();
      const next = getKidsSaperLevelById(state.kidsSaperCurrentLevel);
      showToast(`Уровень повышен: ${next ? next.icon + ' ' + next.name : state.kidsSaperCurrentLevel}!`);
    }
    const finalBonus = pickKidsSaperBonus(wonLevel);
    if(finalBonus){
      bonusEl.textContent = '🎁 Финальный приз: ' + finalBonus.text;
      bonusEl.style.display = 'block';
      addKidsSaperBonusToChecklist(finalBonus.text);
      renderKidsSaperBonusChecklist();
    } else {
      bonusEl.textContent = '';
      bonusEl.style.display = 'none';
    }
  } else {
    titleEl.textContent = '💥 Упс, вы врвались на мину';
    scoreEl.textContent = `Открыто безопасных клеток: ${revealedSafe} из ${KIDS_SAPER_SIZE - mineCount}`;
    playFailSound();
    if(bonusEl){ bonusEl.textContent = ''; bonusEl.style.display = 'none'; }
  }

  countsEl.textContent = lvl ? `Уровень партии: ${lvl.icon} ${lvl.name} · 💣 мин: ${mineCount}` : `💣 мин: ${mineCount}`;

  renderKidsSaperGrid();
  saveState();
  document.getElementById('kidsSaperSummaryModal').classList.add('show');
}

document.getElementById('kidsSaperSetupStartBtn').addEventListener('click', ()=>{ goToKidsSaperGame(); });
document.getElementById('kidsSaperSetupExitBtn').addEventListener('click', ()=>{ exitKidsSaperSetup(); });
document.getElementById('kidsSaperSetupRulesBtn').addEventListener('click', ()=>{ document.getElementById('kidsSaperRulesModal').classList.add('show'); });
document.getElementById('kidsSaperRandomBtn').addEventListener('click', ()=>{ suggestRandomKidsSaperCell(); });
document.getElementById('kidsSaperHideTasksBtn').addEventListener('click', ()=>{
  state.kidsSaperTasksHidden = !state.kidsSaperTasksHidden;
  saveState();
  updateKidsSaperHideTasksBtn();
  renderKidsSaperGrid();
});
function updateKidsSaperHideTasksBtn(){
  const btn = document.getElementById('kidsSaperHideTasksBtn');
  if(!btn) return;
  btn.textContent = state.kidsSaperTasksHidden ? '👀 Показать задания' : '🙈 Скрыть задания';
}
document.getElementById('kidsSaperGameRulesBtn').addEventListener('click', ()=>{ document.getElementById('kidsSaperRulesModal').classList.add('show'); });
document.getElementById('kidsSaperExitBtn').addEventListener('click', ()=>{ exitKidsSaperGameToSetup(); });
document.getElementById('kidsSaperReplayBtn').addEventListener('click', ()=>{
  document.getElementById('kidsSaperSummaryModal').classList.remove('show');
  goToKidsSaperGame();
});
document.getElementById('closeKidsSaperSummaryBtn').addEventListener('click', ()=>{ exitKidsSaperGameToSetup(); });
document.getElementById('kidsSaperRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'kidsSaperRulesModal') e.currentTarget.classList.remove('show'); });
