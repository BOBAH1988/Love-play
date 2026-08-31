// games/solo-battleship.js — «Морской бой» (раздел «Игры для одного»).
// Копия механики games/kids-battleship.js, но без второго игрока: «Вы» стреляет
// по полю бота, затем бот — по вашему, — и телефон никому не передаётся (всё
// на одном экране). Тот же 10×10 флот (KIDS_BATTLESHIP_FLEET: 1×4, 2×3, 3×2,
// 4×1 — 10 кораблей/20 клеток, корабли не касаются даже углами) и те же
// функции bsGenerateBoard()/bsMarkSunkPerimeter()/bsIdx (из kids-battleship.js,
// подключённого раньше). Бот прост: сначала стреляет рядом с уже ранеными
// кораблями (hunt), иначе — в случайную незатронутую клетку.

const SOLO_BS = {
  player: { name: 'Вы', idle: '#4ade88' }, // зелёный — наш цвет
  bot:    { name: 'Бот', idle: '#7db8e8' }, // синий — цвет бота
};
const SOLO_BS_ACTIVE = '#ffd166'; // золотой — подсвечивает ходящего
let soloBsTimerId = null;

function goToSoloBattleshipSetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('soloBattleshipSetup').classList.add('active');
}
function exitSoloBattleshipSetup(){
  document.getElementById('soloBattleshipSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('soloView');
}

function startSoloBattleshipGame(){
  document.getElementById('soloBattleshipSetup').classList.remove('active');
  document.getElementById('soloBattleshipGame').classList.add('active');
  state.soloBsPlayerBoard = bsGenerateBoard(); // наше поле (бот туда стреляет)
  state.soloBsBotBoard = bsGenerateBoard();    // поле бота (мы туда стреляем)
  state.soloBsCurrentPlayer = 'player';        // человек ходит первым — видит поле
  state.soloBsWinner = null;
  state.soloBsShots = {player:0, bot:0};
  if(!state.soloBsWins) state.soloBsWins = {player:0, bot:0};
  state.inProgress = true;
  state.pausedMode = null;
  saveState();
  renderSoloBsBoards();
  updateSoloBattleshipStatus('');
  updateSoloBattleshipStats();
  updateMuteBtn();
  requestWakeLock();
}

function soloBsAllSunk(board){
  if(!board) return true;
  return board.ships.every(s => s.sunk);
}

function renderSoloBsBoards(){
  renderSoloBsBoard('soloBsPlayerBoard', state.soloBsPlayerBoard, false);
  renderSoloBsBoard('soloBsEnemyBoard', state.soloBsBotBoard, true);
}

// isEnemy — чужое поле: корабли скрыты, клик стреляет (только ход игрока).
// Своё поле: корабли видны (тоненько), стрелки бота уже помечены.
function renderSoloBsBoard(gridId, board, isEnemy){
  const wrap = document.getElementById(gridId);
  if(!wrap || !board) return;
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
        cls += ' bs-miss'; label = '•';
      }
    } else if(!isEnemy){
      if(cell.ship){ cls += ' bs-own-ship'; label = '🚢'; }
    } else if(state.soloBsCurrentPlayer === 'player' && state.soloBsWinner === null){
      btn.addEventListener('click', () => fireSoloBsShot(i));
    }
    btn.className = cls;
    btn.textContent = label;
    wrap.appendChild(btn);
  });
}

function fireSoloBsShot(i){
  if(state.soloBsWinner !== null || state.soloBsCurrentPlayer !== 'player') return;
  const board = state.soloBsBotBoard;
  if(!board) return;
  const cell = board.cells[i];
  if(!cell || cell.shot) return;
  const hit = !!cell.ship;
  cell.shot = true;
  state.soloBsShots.player = (state.soloBsShots.player || 0) + 1;
  let resultText;
  if(hit){
    const ship = board.ships.find(s => s.id === cell.shipId);
    ship.hits++;
    if(ship.hits >= ship.size){
      ship.sunk = true;
      bsMarkSunkPerimeter(board, ship);
      resultText = `💀 Потоплён ${ship.size}-палубный корабль! Стреляйте ещё раз →`;
      playBingoVictorySound();
    } else {
      resultText = '🔥 Попадание! Стреляйте ещё раз →';
      playHitSound();
    }
  } else {
    resultText = '🌊 Мимо! Ход бота.';
    playNeutralSound();
  }
  renderSoloBsBoard('soloBsEnemyBoard', board, true);
  if(soloBsAllSunk(board)){
    state.soloBsWinner = 'player';
    state.soloBsWins.player = (state.soloBsWins.player || 0) + 1;
    saveState();
    updateSoloBattleshipStats();
    setTimeout(showSoloBsSummary, 700);
    return;
  }
  updateSoloBattleshipStatus(resultText);
  saveState();
  if(!hit){
    state.soloBsCurrentPlayer = 'bot';
    soloBsTimerId = setTimeout(soloBsBotMove, 900);
  }
}

// Бот: с приоритетом стреляет в соседи раненых непотопленных кораблей, иначе —
// случайно. Ходит автоматически после нашего промаха либо после собственного
// попадания (цепочка выстрелов бота, как у игрока).
function soloBsBotMove(){
  if(state.soloBsWinner !== null || state.soloBsCurrentPlayer !== 'bot') return;
  const board = state.soloBsPlayerBoard;
  if(!board) return;
  const i = soloBsPickBotCell(board);
  if(i === -1) return;
  const cell = board.cells[i];
  const hit = !!cell.ship;
  cell.shot = true;
  state.soloBsShots.bot = (state.soloBsShots.bot || 0) + 1;
  let resultText;
  if(hit){
    const ship = board.ships.find(s => s.id === cell.shipId);
    ship.hits++;
    if(ship.hits >= ship.size){
      ship.sunk = true;
      bsMarkSunkPerimeter(board, ship);
      resultText = `💀 Бот потопил ваш ${ship.size}-палубный корабль! Ваш ход.`;
      playBingoVictorySound();
    } else {
      resultText = '🔥 Бот попал! Стреляет снова →';
      playHitSound();
    }
  } else {
    resultText = '🌊 Бот промахнулся. Ваш ход.';
    playNeutralSound();
  }
  renderSoloBsBoard('soloBsPlayerBoard', board, false);
  if(soloBsAllSunk(board)){
    state.soloBsWinner = 'bot';
    state.soloBsWins.bot = (state.soloBsWins.bot || 0) + 1;
    saveState();
    updateSoloBattleshipStats();
    setTimeout(showSoloBsSummary, 700);
    return;
  }
  updateSoloBattleshipStatus(resultText);
  saveState();
  if(hit){
    soloBsTimerId = setTimeout(soloBsBotMove, 800); // бот стреляет снова
  } else {
    state.soloBsCurrentPlayer = 'player';
  }
}

function soloBsPickBotCell(board){
  const size = KIDS_BATTLESHIP_SIZE;
  const cells = board.cells;
  // Цели — соседи (по сторонам) раненых, но ещё не потопленных кораблей.
  const liveHits = [];
  for(let i = 0; i < cells.length; i++){
    const c = cells[i];
    if(c.ship && c.shot){
      const s = board.ships.find(sh => sh.id === c.shipId);
      if(!s.sunk) liveHits.push(i);
    }
  }
  if(liveHits.length){
    const neighbors = new Set();
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for(const i of liveHits){
      const r = Math.floor(i / size), c = i % size;
      for(const [dr, dc] of dirs){
        const nr = r + dr, nc = c + dc;
        if(nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        const ni = nr * size + nc;
        if(!cells[ni].shot) neighbors.add(ni);
      }
    }
    if(neighbors.size){
      const arr = [...neighbors];
      return arr[Math.floor(Math.random() * arr.length)];
    }
  }
  const free = [];
  cells.forEach((c, i) => { if(!c.shot) free.push(i); });
  if(!free.length) return -1;
  return free[Math.floor(Math.random() * free.length)];
}

function updateSoloBattleshipStatus(text){
  const el = document.getElementById('soloBattleshipStatusText');
  if(!el) return;
  el.textContent = text || '';
}
function updateSoloBattleshipStats(){
  const wins = state.soloBsWins || {player:0, bot:0};
  const p = document.getElementById('soloBattleshipStatPlayer');
  const b = document.getElementById('soloBattleshipStatBot');
  if(p) p.innerHTML = `<span class="bs-name" style="color:${SOLO_BS.player.idle};">Вы</span>: ${wins.player || 0} побед`;
  if(b) b.innerHTML = `<span class="bs-name" style="color:${SOLO_BS.bot.idle};">Бот</span>: ${wins.bot || 0} побед`;
}
function showSoloBsSummary(){
  const w = state.soloBsWinner;
  const wins = state.soloBsWins || {player:0, bot:0};
  let line;
  if(w === 'player'){ line = '🏆 Вы победили!'; playSuccessSound(); }
  else { line = '🤖 Бот победил.'; playFailSound(); }
  document.getElementById('soloBattleshipSummaryIntro').innerHTML = `
    <div style="margin-bottom:10px; font-size:20px;">${line}</div>
    Выстрелов — Вы: ${state.soloBsShots.player || 0}, Бот: ${state.soloBsShots.bot || 0}<br>
    Побед — Вы: ${wins.player || 0}, Бот: ${wins.bot || 0}
  `;
  document.getElementById('soloBattleshipSummaryModal').classList.add('show');
}
function exitSoloBattleshipGame(){
  document.getElementById('soloBattleshipGame').classList.remove('active');
  document.getElementById('soloBattleshipSetup').classList.add('active');
  state.soloBsPlayerBoard = []; state.soloBsBotBoard = [];
  state.soloBsWinner = null; state.inProgress = false;
  state.pausedMode = null;
  saveState();
}
// Пауза: сохраняем поле и очередь, возвращаемся в меню — продолжить позже
// через общий блок «Продолжить игру» / «Закончить игру» (см. core.js).
function pauseSoloBattleshipGame(){
  if(state.pausedMode === 'soloBs') return;
  if(soloBsTimerId){ clearTimeout(soloBsTimerId); soloBsTimerId = null; }
  state.pausedMode = 'soloBs';
  saveState();
  document.getElementById('soloBattleshipGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('soloView');
  updateResumeUI();
}
// Возвращаемся из паузы — снова показываем поле и, если ход бота,
// продолжаем цепочку выстрелов бота с небольшой задержкой.
function resumeSoloBsGame(){
  state.pausedMode = null;
  saveState();
  updateResumeUI();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('soloBattleshipGame').classList.add('active');
  renderSoloBsBoards();
  updateSoloBattleshipStats();
  updateMuteBtn();
  requestWakeLock();
  if(state.soloBsCurrentPlayer === 'bot' && state.soloBsWinner === null){
    soloBsTimerId = setTimeout(soloBsBotMove, 600);
  }
}
// Закончить игру из меню паузы — сбрасываем состояние и возвращаемся в меню.
function finishSoloBsGame(){
  if(soloBsTimerId){ clearTimeout(soloBsTimerId); soloBsTimerId = null; }
  document.getElementById('pauseMenuModal').classList.remove('show');
  exitSoloBattleshipGame();
  updateResumeUI();
  showToast('Игра завершена');
}

document.getElementById('soloBattleshipSetupStartBtn').addEventListener('click', ()=>{
  playSuccessSound(); startSoloBattleshipGame();
});
document.getElementById('soloBattleshipSetupExitBtn').addEventListener('click', ()=>{ exitSoloBattleshipSetup(); });
document.getElementById('soloBattleshipExitBtn').addEventListener('click', ()=>{ pauseSoloBattleshipGame(); });
document.getElementById('closeSoloBattleshipSummaryBtn').addEventListener('click', ()=>{
  document.getElementById('soloBattleshipSummaryModal').classList.remove('show');
  exitSoloBattleshipGame();
});
(document.getElementById('soloBattleshipSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ document.getElementById('soloBattleshipRulesModal').classList.add('show'); });
(document.getElementById('soloBattleshipGameRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ document.getElementById('soloBattleshipRulesModal').classList.add('show'); });
document.getElementById('closeSoloBattleshipRulesBtn').addEventListener('click', ()=>{ document.getElementById('soloBattleshipRulesModal').classList.remove('show'); });
document.getElementById('soloBattleshipRulesModal').addEventListener('click', (e)=>{
  if(e.target.id === 'soloBattleshipRulesModal') e.currentTarget.classList.remove('show');
});
