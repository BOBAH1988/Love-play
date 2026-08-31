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
  goToGameSetup('kidsBattleshipSetup');
}
function exitKidsBattleshipSetup(){
  document.getElementById('kidsBattleshipSetup').classList.remove('active');
  document.getElementById('kidsBoardGamesMenu').classList.add('active');
}

function goToKidsBattleshipGame(){
  goToGame('kidsBattleshipSetup', 'kidsBattleshipGame');
  state.battleshipBoards = [bsGenerateBoard(), bsGenerateBoard()];
  state.battleshipCurrentPlayer = Math.random() < 0.5 ? 0 : 1;
  state.battleshipWinner = null;
  state.battleshipShotsCount = [0, 0];
  if(!state.battleshipWins) state.battleshipWins = [0, 0];
  state.inProgress = true;
  saveState();
  showKidsBattleshipGrid();
  updateKidsBattleshipStats();
  updateMuteBtn();
  requestWakeLock();
}

function showKidsBattleshipHandoff(){
  const idx = state.battleshipCurrentPlayer || 0;
  const textEl = document.getElementById('kidsBattleshipHandoffText');
  if(textEl) textEl.textContent = `Передайте телефон игроку ${idx === 0 ? 1 : 2}`;
  const modal = document.getElementById('kidsBattleshipHandoffModal');
  if(modal) modal.classList.add('show');
}

function showKidsBattleshipGrid(){
  const modal = document.getElementById('kidsBattleshipHandoffModal');
  if(modal) modal.classList.remove('show');
  document.getElementById('kidsBattleshipGrid').style.display = '';
  renderKidsBattleshipGrid();
  updateKidsBattleshipTurnLabel();
  updateKidsBattleshipStatus();
  updateKidsBattleshipStats();
}

function updateKidsBattleshipTurnLabel(){
  const idx = state.battleshipCurrentPlayer || 0;
  const el = document.getElementById('kidsBattleshipTurnLabel');
  if(!el) return;
  const p0 = bsPlayerName(0);
  const p1 = bsPlayerName(1);
  const activeName = idx === 0 ? p0 : p1;
  const inactiveName = idx === 0 ? p1 : p0;
  // Имена игроков разного цвета (синий/розовый), активный — золотом, чтобы
  // сразу было видно, кому телефон передан (чей ход).
  const inactiveColor = idx === 0 ? '#7db8e8' : '#e0b0ff';
  el.innerHTML = `Ходит: <span class="bs-name" style="color:#ffd166;font-weight:900;">${activeName}</span> <span class="bs-name" style="color:${inactiveColor};">${inactiveName}</span>`;
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
function updateKidsBattleshipStats(){
  const wins = state.battleshipWins || [0, 0];
  const p1 = document.getElementById('kidsBattleshipStatP1');
  const p2 = document.getElementById('kidsBattleshipStatP2');
  if(p1) p1.textContent = `${bsPlayerName(0)} победил: ${wins[0] || 0} раз`;
  if(p2) p2.textContent = `${bsPlayerName(1)} победил: ${wins[1] || 0} раз`;
}

function renderKidsBattleshipGrid(){
  const wrap = document.getElementById('kidsBattleshipGrid');
  if(!wrap) return;
  const idx = state.battleshipCurrentPlayer || 0;
  wrap.classList.remove('player1', 'player2');
  wrap.classList.add(idx === 0 ? 'player1' : 'player2');
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
    if(!state.battleshipWins) state.battleshipWins = [0, 0];
    state.battleshipWins[idx] = (state.battleshipWins[idx] || 0) + 1;
    saveState();
    updateKidsBattleshipStatus(resultText);
    updateKidsBattleshipStats();
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
  const wins = state.battleshipWins || [0, 0];
  document.getElementById('kidsBattleshipSummaryIntro').innerHTML = `
    🏆 Победитель: ${bsPlayerName(winnerIdx)}!<br>
    Флот игрока «${bsPlayerName(loserIdx)}» потоплен полностью.<br><br>
    Выстрелов: ${bsPlayerName(0)} — ${shots[0] || 0}, ${bsPlayerName(1)} — ${shots[1] || 0}<br><br>
    ${bsPlayerName(0)} победил: ${wins[0] || 0} раз<br>
    ${bsPlayerName(1)} победил: ${wins[1] || 0} раз
  `;
  showModal('kidsBattleshipSummaryModal');
}

function exitKidsBattleshipGame(){
  exitGame('kidsBattleshipGame', 'kidsBattleshipSetup');
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
document.getElementById('kidsBattleshipHandoffContinueBtn').addEventListener('click', () => {
  playSuccessSound();
  showKidsBattleshipGrid();
});
document.getElementById('kidsBattleshipExitBtn').addEventListener('click', () => { exitKidsBattleshipGame(); });
document.getElementById('closeKidsBattleshipSummaryBtn').addEventListener('click', () => {
  hideModal('kidsBattleshipSummaryModal');
  exitKidsBattleshipGame();
});
(document.getElementById('kidsBattleshipSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', () => { showModal('kidsBattleshipRulesModal'); });
(document.getElementById('kidsBattleshipGameRulesBtn')||{addEventListener:function(){}}).addEventListener('click', () => { showModal('kidsBattleshipRulesModal'); });
document.getElementById('closeKidsBattleshipRulesBtn').addEventListener('click', () => { hideModal('kidsBattleshipRulesModal'); });
document.getElementById('kidsBattleshipRulesModal').addEventListener('click', (e) => { if(e.target.id === 'kidsBattleshipRulesModal') e.currentTarget.classList.remove('show'); });
