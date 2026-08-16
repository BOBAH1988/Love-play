// games/kids-battleship.js — Игра «Морской бой» (раздел «Игры с детьми»).
// Два игрока (первые два имени из state.kidsPlayers), поле 10×10. Флоты
// расставляются случайно и автоматически для обоих игроков (классический
// набор: 1 четырёхпалубный, 2 трёхпалубных, 3 двухпалубных, 4 однопалубных
// — 10 кораблей, 20 клеток, корабли не касаются друг друга даже углами).
// Игроки стреляют строго по очереди, независимо от результата выстрела —
// после каждого хода показывается карточка «Передайте телефон», чтобы
// игроки не видели чужое поле раньше времени (игра всегда на одном экране:
// либо хендофф-карточка, либо поле активного игрока).

const KIDS_BATTLESHIP_FLEET = [4,3,3,2,2,2,1,1,1,1];
const KIDS_BATTLESHIP_SIZE = 10;

function bsIdx(r, c){ return r * KIDS_BATTLESHIP_SIZE + c; }

function bsCreateEmptyBoard(){
  const cells = [];
  for(let i = 0; i < KIDS_BATTLESHIP_SIZE * KIDS_BATTLESHIP_SIZE; i++){
    cells.push({ship:false, shipId:null, shot:false});
  }
  return {cells, ships:[]};
}

function bsCanPlace(board, r, c, size, horiz){
  for(let i = 0; i < size; i++){
    const rr = horiz ? r : r + i;
    const cc = horiz ? c + i : c;
    if(rr < 0 || rr >= KIDS_BATTLESHIP_SIZE || cc < 0 || cc >= KIDS_BATTLESHIP_SIZE) return false;
    for(let dr = -1; dr <= 1; dr++){
      for(let dc = -1; dc <= 1; dc++){
        const nr = rr + dr, nc = cc + dc;
        if(nr < 0 || nr >= KIDS_BATTLESHIP_SIZE || nc < 0 || nc >= KIDS_BATTLESHIP_SIZE) continue;
        if(board.cells[bsIdx(nr, nc)].ship) return false;
      }
    }
  }
  return true;
}

function bsPlaceShip(board, r, c, size, horiz, id){
  for(let i = 0; i < size; i++){
    const rr = horiz ? r : r + i;
    const cc = horiz ? c + i : c;
    board.cells[bsIdx(rr, cc)].ship = true;
    board.cells[bsIdx(rr, cc)].shipId = id;
  }
  board.ships.push({id, size, hits:0, sunk:false});
}

// Случайная расстановка с повторными попытками — на 10×10 с этим флотом
// место всегда находится за несколько попыток, но на случай крайне
// невезучей серии есть верхний предел и перезапуск всей доски с нуля.
function bsGenerateBoard(){
  for(let attempt = 0; attempt < 300; attempt++){
    const board = bsCreateEmptyBoard();
    let ok = true;
    let shipId = 0;
    for(const size of KIDS_BATTLESHIP_FLEET){
      let placed = false;
      for(let tries = 0; tries < 300; tries++){
        const horiz = Math.random() < 0.5;
        const r = Math.floor(Math.random() * KIDS_BATTLESHIP_SIZE);
        const c = Math.floor(Math.random() * KIDS_BATTLESHIP_SIZE);
        if(bsCanPlace(board, r, c, size, horiz)){
          bsPlaceShip(board, r, c, size, horiz, shipId++);
          placed = true;
          break;
        }
      }
      if(!placed){ ok = false; break; }
    }
    if(ok) return board;
  }
  return bsCreateEmptyBoard();
}

// Корабли по правилам не касаются друг друга даже углами (см. bsCanPlace) —
// значит, как только корабль потоплен, все клетки вокруг него гарантированно
// пустые, и их можно сразу открыть точкой "мимо", не заставляя игрока
// отстреливать очевидные клетки вручную.
function bsMarkSunkPerimeter(board, ship){
  board.cells.forEach((cell, i) => {
    if(cell.shipId !== ship.id) return;
    const r = Math.floor(i / KIDS_BATTLESHIP_SIZE);
    const c = i % KIDS_BATTLESHIP_SIZE;
    for(let dr = -1; dr <= 1; dr++){
      for(let dc = -1; dc <= 1; dc++){
        const nr = r + dr, nc = c + dc;
        if(nr < 0 || nr >= KIDS_BATTLESHIP_SIZE || nc < 0 || nc >= KIDS_BATTLESHIP_SIZE) continue;
        const neighbor = board.cells[bsIdx(nr, nc)];
        if(!neighbor.shot) neighbor.shot = true;
      }
    }
  });
}

function bsPlayerName(idx){
  const players = state.kidsPlayers || [];
  return players[idx] || ('Игрок ' + (idx + 1));
}

function goToKidsBattleshipSetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('kidsBattleshipSetup').classList.add('active');
}
function exitKidsBattleshipSetup(){
  document.getElementById('kidsBattleshipSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}

function goToKidsBattleshipGame(){
  document.getElementById('kidsBattleshipSetup').classList.remove('active');
  document.getElementById('kidsBattleshipGame').classList.add('active');
  state.battleshipBoards = [bsGenerateBoard(), bsGenerateBoard()];
  state.battleshipCurrentPlayer = Math.random() < 0.5 ? 0 : 1;
  state.battleshipWinner = null;
  state.battleshipShotsCount = [0, 0];
  state.inProgress = true;
  saveState();
  showKidsBattleshipHandoff();
  updateMuteBtn();
  requestWakeLock();
}

function showKidsBattleshipHandoff(){
  const idx = state.battleshipCurrentPlayer || 0;
  const oppIdx = idx === 0 ? 1 : 0;
  const textEl = document.getElementById('kidsBattleshipHandoffText');
  if(textEl) textEl.textContent = `Передайте телефон игроку «${bsPlayerName(idx)}» — ваш ход по флоту игрока «${bsPlayerName(oppIdx)}»`;
  document.getElementById('kidsBattleshipHandoffCardArea').style.display = 'flex';
  document.getElementById('kidsBattleshipHandoffRow').style.display = 'flex';
  document.getElementById('kidsBattleshipGrid').style.display = 'none';
  document.getElementById('kidsBattleshipStatusText').textContent = '';
}

function showKidsBattleshipGrid(){
  document.getElementById('kidsBattleshipHandoffCardArea').style.display = 'none';
  document.getElementById('kidsBattleshipHandoffRow').style.display = 'none';
  document.getElementById('kidsBattleshipGrid').style.display = '';
  renderKidsBattleshipGrid();
  updateKidsBattleshipStatus();
}

function updateKidsBattleshipStatus(text){
  const idx = state.battleshipCurrentPlayer || 0;
  const oppIdx = idx === 0 ? 1 : 0;
  const oppBoard = state.battleshipBoards[oppIdx];
  const remaining = oppBoard.ships.filter(s => !s.sunk).length;
  const el = document.getElementById('kidsBattleshipStatusText');
  if(!el) return;
  el.textContent = text || `Стреляет: ${bsPlayerName(idx)} · Осталось кораблей у «${bsPlayerName(oppIdx)}»: ${remaining} из ${oppBoard.ships.length}`;
}

function renderKidsBattleshipGrid(){
  const wrap = document.getElementById('kidsBattleshipGrid');
  if(!wrap) return;
  const idx = state.battleshipCurrentPlayer || 0;
  const oppIdx = idx === 0 ? 1 : 0;
  const board = state.battleshipBoards[oppIdx];
  if(!board) return;
  wrap.innerHTML = '';
  board.cells.forEach((cell, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    let cls = 'battleship-cell';
    let label = '';
    if(cell.shot){
      btn.disabled = true;
      if(cell.ship){
        const ship = board.ships.find(s => s.id === cell.shipId);
        if(ship && ship.sunk){ cls += ' bs-sunk'; label = '💀'; }
        else { cls += ' bs-hit'; label = '🔥'; }
      } else {
        cls += ' bs-miss';
        label = '•';
      }
    } else {
      btn.addEventListener('click', () => fireKidsBattleshipShot(i));
    }
    btn.className = cls;
    btn.textContent = label;
    wrap.appendChild(btn);
  });
}

function fireKidsBattleshipShot(i){
  if(state.battleshipWinner !== null && state.battleshipWinner !== undefined) return;
  const idx = state.battleshipCurrentPlayer || 0;
  const oppIdx = idx === 0 ? 1 : 0;
  const board = state.battleshipBoards[oppIdx];
  const cell = board.cells[i];
  if(!cell || cell.shot) return;
  cell.shot = true;
  state.battleshipShotsCount[idx] = (state.battleshipShotsCount[idx] || 0) + 1;
  let resultText;
  let hit = false;
  if(cell.ship){
    hit = true;
    const ship = board.ships.find(s => s.id === cell.shipId);
    ship.hits++;
    if(ship.hits >= ship.size){
      ship.sunk = true;
      bsMarkSunkPerimeter(board, ship);
      resultText = `💀 Потоплен ${ship.size}-палубный корабль! Стреляй ещё раз →`;
      playBingoVictorySound();
    } else {
      resultText = '🔥 Попадание! Стреляй ещё раз →';
      playHitSound();
    }
  } else {
    resultText = '🌊 Мимо!';
    playNeutralSound();
  }
  renderKidsBattleshipGrid();
  const allSunk = board.ships.every(s => s.sunk);
  if(allSunk){
    state.battleshipWinner = idx;
    saveState();
    updateKidsBattleshipStatus(resultText);
    setTimeout(showKidsBattleshipSummary, 700);
    return;
  }
  updateKidsBattleshipStatus(resultText);
  // Попал — стреляет ещё раз тот же игрок (карту противника видно дальше,
  // без передачи телефона); промазал — ход переходит другому игроку.
  if(hit){
    saveState();
    return;
  }
  state.battleshipCurrentPlayer = oppIdx;
  saveState();
  setTimeout(showKidsBattleshipHandoff, 900);
}

function showKidsBattleshipSummary(){
  const winnerIdx = state.battleshipWinner;
  const loserIdx = winnerIdx === 0 ? 1 : 0;
  const shots = state.battleshipShotsCount || [0, 0];
  document.getElementById('kidsBattleshipSummaryIntro').innerHTML = `
    🏆 Победитель: ${bsPlayerName(winnerIdx)}!<br>
    Флот игрока «${bsPlayerName(loserIdx)}» потоплен полностью.<br><br>
    Выстрелов: ${bsPlayerName(0)} — ${shots[0] || 0}, ${bsPlayerName(1)} — ${shots[1] || 0}
  `;
  document.getElementById('kidsBattleshipSummaryModal').classList.add('show');
}

function exitKidsBattleshipGame(){
  document.getElementById('kidsBattleshipGame').classList.remove('active');
  document.getElementById('kidsBattleshipSetup').classList.add('active');
  state.battleshipBoards = [];
  state.battleshipWinner = null;
  state.inProgress = false;
  saveState();
}

document.getElementById('kidsBattleshipSetupStartBtn').addEventListener('click', () => {
  playSuccessSound();
  goToKidsBattleshipGame();
});
document.getElementById('kidsBattleshipSetupExitBtn').addEventListener('click', () => { exitKidsBattleshipSetup(); });
document.getElementById('kidsBattleshipHandoffStartBtn').addEventListener('click', () => {
  playSuccessSound();
  showKidsBattleshipGrid();
});
document.getElementById('kidsBattleshipExitBtn').addEventListener('click', () => { exitKidsBattleshipGame(); });
document.getElementById('closeKidsBattleshipSummaryBtn').addEventListener('click', () => {
  document.getElementById('kidsBattleshipSummaryModal').classList.remove('show');
  exitKidsBattleshipGame();
});
document.getElementById('kidsBattleshipSetupRulesBtn').addEventListener('click', () => { document.getElementById('kidsBattleshipRulesModal').classList.add('show'); });
document.getElementById('kidsBattleshipGameRulesBtn').addEventListener('click', () => { document.getElementById('kidsBattleshipRulesModal').classList.add('show'); });
document.getElementById('closeKidsBattleshipRulesBtn').addEventListener('click', () => { document.getElementById('kidsBattleshipRulesModal').classList.remove('show'); });
document.getElementById('kidsBattleshipRulesModal').addEventListener('click', (e) => { if(e.target.id === 'kidsBattleshipRulesModal') e.currentTarget.classList.remove('show'); });
