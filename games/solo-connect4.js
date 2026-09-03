// games/solo-connect4.js — Игра «Четыре в ряд» (раздел «Игры для одного»).
// Копия механики games/kids-connect4.js, но против бота: игрок всегда
// играет красными (R), бот — жёлтыми (Y). Поле 7 колонок × 6 рядов.
// Шашки падают вниз (гравитация). Побеждает тот, кто первым соберёт четыре
// свои шашки подряд — по горизонтали, вертикали или диагонали. Первый ход
// в самой первой партии — случайный, дальше первым всегда ходит победитель
// предыдущего раунда (при ничьей право первого хода переходит другой
// стороне). Счёт побед/ничьих ведётся по всей партии, итог показывается
// при выходе. Загружается из index.html.

const SOLO_C4_COLS = 7;
const SOLO_C4_ROWS = 6;

function soloC4CheckWin(board){
  const idx = (r, c) => r * SOLO_C4_COLS + c;
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for(let r = 0; r < SOLO_C4_ROWS; r++){
    for(let c = 0; c < SOLO_C4_COLS; c++){
      const mark = board[idx(r,c)];
      if(!mark) continue;
      for(const [dr,dc] of dirs){
        const cells = [idx(r,c)];
        for(let k = 1; k < 4; k++){
          const rr = r + dr*k, cc = c + dc*k;
          if(rr < 0 || rr >= SOLO_C4_ROWS || cc < 0 || cc >= SOLO_C4_COLS) break;
          if(board[idx(rr,cc)] !== mark) break;
          cells.push(idx(rr,cc));
        }
        if(cells.length === 4) return cells;
      }
    }
  }
  return null;
}
function soloC4LandingRow(board, col){
  for(let r = SOLO_C4_ROWS - 1; r >= 0; r--){
    if(!board[r * SOLO_C4_COLS + col]) return r;
  }
  return -1;
}
function soloC4EmptyColumns(board){
  const cols = [];
  for(let c = 0; c < SOLO_C4_COLS; c++){
    if(soloC4LandingRow(board, c) >= 0) cols.push(c);
  }
  return cols;
}
function soloC4WouldWin(board, col, mark){
  const row = soloC4LandingRow(board, col);
  if(row < 0) return false;
  const copy = board.slice();
  copy[row * SOLO_C4_COLS + col] = mark;
  return !!soloC4CheckWin(copy);
}
// Бот простой и достаточно цепкий: 1) берёт свой выигрышный ход;
// 2) иначе блокирует выигрышный ход игрока; 3) иначе предпочитает центр;
// 4) иначе — случайная свободная колонка.
function soloC4PickBotMove(board){
  const empty = soloC4EmptyColumns(board);
  if(empty.length === 0) return -1;
  for(const c of empty){ if(soloC4WouldWin(board, c, 'Y')) return c; }
  for(const c of empty){ if(soloC4WouldWin(board, c, 'R')) return c; }
  const center = 3;
  if(empty.includes(center)) return center;
  return empty[Math.floor(Math.random() * empty.length)];
}
function goToSoloC4Setup(){
  goToGameSetup('soloC4Setup', null, null);
}
function exitSoloC4Setup(){
  document.getElementById('soloC4Setup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}
function updateSoloC4ScoreUI(){
  const el = document.getElementById('soloC4ScoreRow');
  if(!el) return;
  el.innerHTML = `
    <span class="krokodil-score-item">Вы 🔴: ${state.soloC4ScorePlayer || 0}</span>
    <span class="krokodil-score-item">Бот 🟡: ${state.soloC4ScoreBot || 0}</span>
    <span class="krokodil-score-item">Ничьи: ${state.soloC4Draws || 0}</span>
  `;
}
function updateSoloC4TurnLabel(){
  const el = document.getElementById('soloC4TurnLabel');
  if(!el) return;
  const mark = state.soloC4CurrentPlayer || 'R';
  el.innerHTML = mark === 'R' ? 'Ходит: Вы 🔴' : 'Ходит: Бот 🟡';
}
function renderSoloC4Grid(winCells){
  const wrap = document.getElementById('soloC4Grid');
  if(!wrap) return;
  const board = state.soloC4Board || new Array(SOLO_C4_COLS * SOLO_C4_ROWS).fill('');
  const roundOver = !!state.soloC4RoundOver;
  const playerTurn = state.soloC4CurrentPlayer === 'R';
  wrap.innerHTML = '';
  board.forEach((mark, i)=>{
    const col = i % SOLO_C4_COLS;
    const row = Math.floor(i / SOLO_C4_COLS);
    const isLanding = !roundOver && !mark && playerTurn && soloC4LandingRow(board, col) === row;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kids-c4-cell'
      + (mark === 'R' ? ' kids-c4-red' : '')
      + (mark === 'Y' ? ' kids-c4-yellow' : '')
      + (winCells && winCells.includes(i) ? ' kids-c4-win' : '');
    btn.innerHTML = isLanding ? '<span class="kids-c4-hint">⬇</span>' : '';
    btn.disabled = !!mark || roundOver || !playerTurn;
    btn.addEventListener('click', ()=>clickSoloC4Column(col));
    wrap.appendChild(btn);
  });
}
function startSoloC4Round(startingMark){
  state.soloC4Board = new Array(SOLO_C4_COLS * SOLO_C4_ROWS).fill('');
  state.soloC4CurrentPlayer = startingMark;
  state.soloC4RoundOver = false;
  saveState();
  document.getElementById('soloC4ResultText').textContent = '';
  document.getElementById('soloC4NextRoundBtn').style.display = 'none';
  updateSoloC4TurnLabel();
  renderSoloC4Grid(null);
  if(startingMark === 'Y') setTimeout(()=>soloC4BotMove(), 350);
}
function soloC4BotMove(){
  if(state.soloC4RoundOver) return;
  if(state.soloC4CurrentPlayer !== 'Y') return;
  const board = state.soloC4Board || (state.soloC4Board = new Array(SOLO_C4_COLS * SOLO_C4_ROWS).fill(''));
  const col = soloC4PickBotMove(board);
  if(col < 0) return;
  soloC4PlaceMark(col, 'Y');
}
function soloC4PlaceMark(col, mark){
  const board = state.soloC4Board || (state.soloC4Board = new Array(SOLO_C4_COLS * SOLO_C4_ROWS).fill(''));
  const row = soloC4LandingRow(board, col);
  if(row < 0) return false;
  board[row * SOLO_C4_COLS + col] = mark;
  const winCells = soloC4CheckWin(board);
  const isDraw = !winCells && board.every(c=>c);
  if(winCells){
    state.soloC4RoundOver = true;
    if(mark === 'R') state.soloC4ScorePlayer = (state.soloC4ScorePlayer || 0) + 1;
    else state.soloC4ScoreBot = (state.soloC4ScoreBot || 0) + 1;
    state.soloC4StartingPlayer = mark;
    saveState();
    playSuccessSound();
    updateSoloC4ScoreUI();
    document.getElementById('soloC4ResultText').textContent = mark === 'R'
      ? '🏆 Вы побеждаете в раунде!'
      : '🤖 Бот побеждает в раунде!';
    document.getElementById('soloC4NextRoundBtn').style.display = 'flex';
    renderSoloC4Grid(winCells);
    return true;
  }
  if(isDraw){
    state.soloC4RoundOver = true;
    state.soloC4Draws = (state.soloC4Draws || 0) + 1;
    state.soloC4StartingPlayer = mark === 'R' ? 'Y' : 'R';
    saveState();
    playNeutralSound();
    updateSoloC4ScoreUI();
    document.getElementById('soloC4ResultText').textContent = '🤝 Ничья!';
    document.getElementById('soloC4NextRoundBtn').style.display = 'flex';
    renderSoloC4Grid(null);
    return true;
  }
  state.soloC4CurrentPlayer = mark === 'R' ? 'Y' : 'R';
  saveState();
  if(mark === 'R') playNeutralSound();
  updateSoloC4TurnLabel();
  renderSoloC4Grid(null);
  if(state.soloC4CurrentPlayer === 'Y') setTimeout(()=>soloC4BotMove(), 350);
  return true;
}
function clickSoloC4Column(col){
  if(state.soloC4RoundOver) return;
  if(state.soloC4CurrentPlayer !== 'R') return;
  soloC4PlaceMark(col, 'R');
}
document.getElementById('soloC4NextRoundBtn').addEventListener('click', ()=>{
  playSuccessSound();
  startSoloC4Round(state.soloC4StartingPlayer || 'R');
});
function goToSoloC4Game(){
  goToGame('soloC4Setup', 'soloC4Game');
  state.soloC4ScorePlayer = 0;
  state.soloC4ScoreBot = 0;
  state.soloC4Draws = 0;
  saveState();
  updateSoloC4ScoreUI();
  const firstMark = Math.random() < 0.5 ? 'R' : 'Y';
  startSoloC4Round(firstMark);
  updateMuteBtn();
  requestWakeLock();
}
function showSoloC4SummaryModal(){
  const p = state.soloC4ScorePlayer || 0;
  const b = state.soloC4ScoreBot || 0;
  const draws = state.soloC4Draws || 0;
  let resultLine;
  if(p === b) resultLine = '🤝 Ничья по общему счёту!';
  else resultLine = p > b ? '🏆 Вы победитель партии!' : '🤖 Бот победитель партии!';
  document.getElementById('soloC4SummaryIntro').innerHTML = `
    Вы 🔴: ${p} побед<br>
    Бот 🟡: ${b} побед<br>
    Ничьих: ${draws}<br><br>
    ${resultLine}
  `;
  showModal('soloC4SummaryModal');
}
function exitSoloC4Game(){
  exitGame('soloC4Game', 'soloC4Setup');
  state.soloC4Board = new Array(SOLO_C4_COLS * SOLO_C4_ROWS).fill('');
  state.soloC4ScorePlayer = 0;
  state.soloC4ScoreBot = 0;
  state.soloC4Draws = 0;
  state.soloC4RoundOver = false;
  saveState();
}
document.getElementById('soloC4SetupStartBtn').addEventListener('click', ()=>{ playSuccessSound(); goToSoloC4Game(); });
document.getElementById('soloC4SetupExitBtn').addEventListener('click', ()=>{ exitSoloC4Setup(); });
document.getElementById('soloC4ExitBtn').addEventListener('click', ()=>{ showSoloC4SummaryModal(); });
document.getElementById('closeSoloC4SummaryBtn').addEventListener('click', ()=>{
  hideModal('soloC4SummaryModal');
  exitSoloC4Game();
});
openRulesModal('soloC4GameRulesBtn', 'soloC4RulesModal');
setupRulesModal('soloC4RulesModal', 'closeSoloC4RulesBtn');
