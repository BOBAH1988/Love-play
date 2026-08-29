// games/solo-xo.js — Игра «Крестики-нолики» (раздел «Игры для одного»).
// Копия механики games/kids-xo.js, но без выбора участников: игрок всегда
// играет крестиками (X) против бота (нолики, O). Поле на выбор: 3×3 (три
// своих знака подряд — победа) или 5×5 (четыре в ряд). Первый ход в самой
// первой партии — случайный, дальше первым всегда ходит победитель
// предыдущего раунда (при ничьей право первого хода переходит другой
// стороне). Счёт побед/ничьих ведётся по всей партии, итог показывается
// при выходе.

const SOLO_XO_SIZES = {
  3: { size: 3, winLen: 3 },
  5: { size: 5, winLen: 4 },
};
function soloXoConfig(){
  return SOLO_XO_SIZES[state.soloXoBoardSize] || SOLO_XO_SIZES[3];
}
function soloXoBuildLines(size, winLen){
  const idx = (r, c) => r * size + c;
  const lines = [];
  for(let r = 0; r < size; r++){
    for(let c = 0; c <= size - winLen; c++){
      const line = [];
      for(let k = 0; k < winLen; k++) line.push(idx(r, c + k));
      lines.push(line);
    }
  }
  for(let c = 0; c < size; c++){
    for(let r = 0; r <= size - winLen; r++){
      const line = [];
      for(let k = 0; k < winLen; k++) line.push(idx(r + k, c));
      lines.push(line);
    }
  }
  for(let r = 0; r <= size - winLen; r++){
    for(let c = 0; c <= size - winLen; c++){
      const line = [];
      for(let k = 0; k < winLen; k++) line.push(idx(r + k, c + k));
      lines.push(line);
    }
  }
  for(let r = 0; r <= size - winLen; r++){
    for(let c = winLen - 1; c < size; c++){
      const line = [];
      for(let k = 0; k < winLen; k++) line.push(idx(r + k, c - k));
      lines.push(line);
    }
  }
  return lines;
}
function soloXoCheckWin(board){
  const { size, winLen } = soloXoConfig();
  const lines = soloXoBuildLines(size, winLen);
  for(const line of lines){
    const first = board[line[0]];
    if(first && line.every(i => board[i] === first)) return line;
  }
  return null;
}
function soloXoEmptyCells(board){
  const cells = [];
  board.forEach((v, i)=>{ if(!v) cells.push(i); });
  return cells;
}
function soloXoWouldWin(board, i, mark){
  const copy = board.slice();
  copy[i] = mark;
  return !!soloXoCheckWin(copy);
}
// Бот не идеальный (не полный минимакс — на 5×5 это было бы слишком
// медленно и слишком сильно для казуальной игры), а простой и достаточно
// цепкий: 1) берёт свой выигрышный ход, если он есть; 2) иначе блокирует
// выигрышный ход игрока; 3) иначе предпочитает центр поля; 4) иначе —
// случайная свободная клетка.
function soloXoPickBotMove(board){
  const empty = soloXoEmptyCells(board);
  if(empty.length === 0) return -1;
  for(const i of empty){ if(soloXoWouldWin(board, i, 'O')) return i; }
  for(const i of empty){ if(soloXoWouldWin(board, i, 'X')) return i; }
  const { size } = soloXoConfig();
  const center = Math.floor(size / 2) * size + Math.floor(size / 2);
  if(empty.includes(center)) return center;
  return empty[Math.floor(Math.random() * empty.length)];
}

function goToSoloXoSetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('soloXoSetup').classList.add('active');
  renderSoloXoSizeGroup();
}
function exitSoloXoSetup(){
  document.getElementById('soloXoSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}
function renderSoloXoSizeGroup(){
  const size = state.soloXoBoardSize || 3;
  document.querySelectorAll('#soloXoSizeGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === size);
  });
  const subtitle = document.getElementById('soloXoSetupSubtitle');
  if(subtitle){
    subtitle.textContent = size === 5
      ? 'Против бота — поле 5×5, четыре в ряд побеждают'
      : 'Против бота — поле 3×3, три в ряд побеждают';
  }
}
document.querySelectorAll('#soloXoSizeGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    playSuccessSound();
    state.soloXoBoardSize = parseInt(btn.dataset.value, 10);
    saveState();
    renderSoloXoSizeGroup();
  });
});
function updateSoloXoScoreUI(){
  const el = document.getElementById('soloXoScoreRow');
  if(!el) return;
  el.innerHTML = `
    <span class="krokodil-score-item">Вы (<span class="xo-green-x">X</span>): ${state.soloXoScorePlayer || 0}</span>
    <span class="krokodil-score-item">Бот (⭕): ${state.soloXoScoreBot || 0}</span>
    <span class="krokodil-score-item">Ничьи: ${state.soloXoDraws || 0}</span>
  `;
}
function updateSoloXoTurnLabel(){
  const el = document.getElementById('soloXoTurnLabel');
  if(!el) return;
  el.innerHTML = (state.soloXoCurrentPlayer || 'X') === 'X' ? 'Ходит: Вы (<span class="xo-green-x">X</span>)' : 'Ходит: Бот (⭕)';
}
function renderSoloXoGrid(winLine){
  const wrap = document.getElementById('soloXoGrid');
  if(!wrap) return;
  const { size } = soloXoConfig();
  wrap.classList.toggle('kids-xo-grid-5', size === 5);
  const board = state.soloXoBoard || new Array(size * size).fill('');
  wrap.innerHTML = '';
  board.forEach((mark, i)=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kids-xo-cell' + (winLine && winLine.includes(i) ? ' kids-xo-win' : '');
    btn.innerHTML = mark === 'X' ? '<span class="kids-xo-mark-x">X</span>' : (mark === 'O' ? '<span class="kids-xo-mark-o">O</span>' : '');
    btn.disabled = !!mark || !!state.soloXoRoundOver || state.soloXoCurrentPlayer !== 'X';
    btn.addEventListener('click', ()=>clickSoloXoCell(i));
    wrap.appendChild(btn);
  });
}
function startSoloXoRound(startingMark){
  const { size } = soloXoConfig();
  state.soloXoBoard = new Array(size * size).fill('');
  state.soloXoCurrentPlayer = startingMark;
  state.soloXoRoundOver = false;
  saveState();
  document.getElementById('soloXoResultText').textContent = '';
  document.getElementById('soloXoNextRoundBtn').style.display = 'none';
  updateSoloXoTurnLabel();
  renderSoloXoGrid(null);
  if(startingMark === 'O') setTimeout(soloXoBotMove, 500);
}
function clickSoloXoCell(i){
  if(state.soloXoRoundOver || state.soloXoCurrentPlayer !== 'X') return;
  soloXoApplyMove(i, 'X');
}
function soloXoBotMove(){
  if(state.soloXoRoundOver) return;
  const i = soloXoPickBotMove(state.soloXoBoard || []);
  if(i === -1) return;
  soloXoApplyMove(i, 'O');
}
function soloXoApplyMove(i, mark){
  const { size } = soloXoConfig();
  const board = state.soloXoBoard || (state.soloXoBoard = new Array(size * size).fill(''));
  if(board[i]) return;
  board[i] = mark;
  const winLine = soloXoCheckWin(board);
  const isDraw = !winLine && board.every(c=>c);
  if(winLine){
    state.soloXoRoundOver = true;
    if(mark === 'X'){ state.soloXoScorePlayer = (state.soloXoScorePlayer || 0) + 1; playSuccessSound(); }
    else { state.soloXoScoreBot = (state.soloXoScoreBot || 0) + 1; playFailSound(); }
    state.soloXoStartingPlayer = mark;
    saveState();
    updateSoloXoScoreUI();
    document.getElementById('soloXoResultText').textContent = mark === 'X' ? '🏆 Вы победили в раунде!' : '🤖 Бот победил в раунде!';
    document.getElementById('soloXoNextRoundBtn').style.display = 'flex';
    renderSoloXoGrid(winLine);
    return;
  }
  if(isDraw){
    state.soloXoRoundOver = true;
    state.soloXoDraws = (state.soloXoDraws || 0) + 1;
    state.soloXoStartingPlayer = mark === 'X' ? 'O' : 'X';
    saveState();
    playNeutralSound();
    updateSoloXoScoreUI();
    document.getElementById('soloXoResultText').textContent = '🤝 Ничья!';
    document.getElementById('soloXoNextRoundBtn').style.display = 'flex';
    renderSoloXoGrid(null);
    return;
  }
  state.soloXoCurrentPlayer = mark === 'X' ? 'O' : 'X';
  saveState();
  updateSoloXoTurnLabel();
  renderSoloXoGrid(null);
  if(state.soloXoCurrentPlayer === 'O') setTimeout(soloXoBotMove, 500);
}
document.getElementById('soloXoNextRoundBtn').addEventListener('click', ()=>{
  playSuccessSound();
  startSoloXoRound(state.soloXoStartingPlayer || 'X');
});
function goToSoloXoGame(){
  document.getElementById('soloXoSetup').classList.remove('active');
  document.getElementById('soloXoGame').classList.add('active');
  state.soloXoScorePlayer = 0;
  state.soloXoScoreBot = 0;
  state.soloXoDraws = 0;
  saveState();
  updateSoloXoScoreUI();
  const firstMark = Math.random() < 0.5 ? 'X' : 'O';
  startSoloXoRound(firstMark);
  updateMuteBtn();
  requestWakeLock();
}
function showSoloXoSummaryModal(){
  const p = state.soloXoScorePlayer || 0;
  const b = state.soloXoScoreBot || 0;
  const draws = state.soloXoDraws || 0;
  let resultLine;
  if(p === b) resultLine = '🤝 Ничья по общему счёту!';
  else resultLine = p > b ? '🏆 Победили вы!' : '🤖 Победил бот!';
  document.getElementById('soloXoSummaryIntro').innerHTML = `
    Вы (<span class="xo-green-x">X</span>): ${p} побед<br>
    Бот (⭕): ${b} побед<br>
    Ничьих: ${draws}<br><br>
    ${resultLine}
  `;
  document.getElementById('soloXoSummaryModal').classList.add('show');
}
function exitSoloXoGame(){
  document.getElementById('soloXoGame').classList.remove('active');
  document.getElementById('soloXoSetup').classList.add('active');
  const { size } = soloXoConfig();
  state.soloXoBoard = new Array(size * size).fill('');
  state.soloXoScorePlayer = 0;
  state.soloXoScoreBot = 0;
  state.soloXoDraws = 0;
  state.soloXoRoundOver = false;
  saveState();
}
document.getElementById('soloXoSetupStartBtn').addEventListener('click', ()=>{ playSuccessSound(); goToSoloXoGame(); });
document.getElementById('soloXoSetupExitBtn').addEventListener('click', ()=>{ exitSoloXoSetup(); });
document.getElementById('soloXoExitBtn').addEventListener('click', ()=>{ showSoloXoSummaryModal(); });
document.getElementById('closeSoloXoSummaryBtn').addEventListener('click', ()=>{
  document.getElementById('soloXoSummaryModal').classList.remove('show');
  exitSoloXoGame();
});
document.getElementById('soloXoSetupRulesBtn').addEventListener('click', ()=>{ document.getElementById('soloXoRulesModal').classList.add('show'); });
document.getElementById('soloXoGameRulesBtn').addEventListener('click', ()=>{ document.getElementById('soloXoRulesModal').classList.add('show'); });
document.getElementById('closeSoloXoRulesBtn').addEventListener('click', ()=>{ document.getElementById('soloXoRulesModal').classList.remove('show'); });
document.getElementById('soloXoRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'soloXoRulesModal') e.currentTarget.classList.remove('show'); });
