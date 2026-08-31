// games/kids-xo.js — Игра «Крестики-нолики» (раздел «Игры с детьми»).
// Два игрока (берутся из общего списка kidsPlayers — первые два имени),
// поле на выбор: 3×3 (три своих знака подряд — победа) или 5×5 (четыре в
// ряд). Первый ход в партии — случайный, дальше первым всегда ходит
// победитель предыдущего раунда (при ничьей — право первого хода переходит
// другому игроку). Счёт побед/ничьих ведётся по всей партии, итог
// показывается при выходе.

// winLen — сколько своих знаков подряд нужно для победы на поле этого размера.
const KIDS_XO_SIZES = {
  3: { size: 3, winLen: 3 },
  5: { size: 5, winLen: 4 },
};
function kidsXoConfig(){
  return KIDS_XO_SIZES[state.kidsXoBoardSize] || KIDS_XO_SIZES[3];
}
// Строит все линии длиной winLen (по горизонтали/вертикали/двум диагоналям)
// на поле size×size — обобщение классических 8 линий 3×3 на любой размер.
function kidsXoBuildLines(size, winLen){
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

function kidsXoPlayerName(mark){
  const players = state.kidsPlayers || [];
  if(mark === 'X') return players[0] || 'Игрок 1';
  return players[1] || 'Игрок 2';
}
function goToKidsXoSetup(){
  goToGameSetup('kidsXoSetup', null, ()=>{
    renderKidsXoSizeGroup();
  });
}
function exitKidsXoSetup(){
  document.getElementById('kidsXoSetup').classList.remove('active');
  document.getElementById('kidsBoardGamesMenu').classList.add('active');
}
function renderKidsXoSizeGroup(){
  const size = state.kidsXoBoardSize || 3;
  document.querySelectorAll('#kidsXoSizeGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === size);
  });
  const subtitle = document.getElementById('kidsXoSetupSubtitle');
  if(subtitle){
    subtitle.textContent = size === 5
      ? 'Классическая игра для двоих — поле 5×5, четыре в ряд побеждают'
      : 'Классическая игра для двоих — поле 3×3, три в ряд побеждают';
  }
}
document.querySelectorAll('#kidsXoSizeGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    playSuccessSound();
    state.kidsXoBoardSize = parseInt(btn.dataset.value, 10);
    saveState();
    renderKidsXoSizeGroup();
  });
});
function updateKidsXoScoreUI(){
  const el = document.getElementById('kidsXoScoreRow');
  if(!el) return;
  el.innerHTML = `
    <span class="krokodil-score-item">${kidsXoPlayerName('X')} (<span class="xo-green-x">X</span>): ${state.kidsXoScoreX || 0}</span>
    <span class="krokodil-score-item">${kidsXoPlayerName('O')} (<span class="xo-o">O</span>): ${state.kidsXoScoreO || 0}</span>
    <span class="krokodil-score-item">Ничьи: ${state.kidsXoDraws || 0}</span>
  `;
}
function updateKidsXoTurnLabel(){
  const el = document.getElementById('kidsXoTurnLabel');
  if(!el) return;
  const mark = state.kidsXoCurrentPlayer || 'X';
  el.innerHTML = `Ходит: ${kidsXoPlayerName(mark)} (${mark === 'X' ? '<span class="xo-green-x">X</span>' : '<span class="xo-o">O</span>'})`;
}
function kidsXoCheckWin(board){
  const { size, winLen } = kidsXoConfig();
  const lines = kidsXoBuildLines(size, winLen);
  for(const line of lines){
    const first = board[line[0]];
    if(first && line.every(i => board[i] === first)) return line;
  }
  return null;
}
function renderKidsXoGrid(winLine){
  const wrap = document.getElementById('kidsXoGrid');
  if(!wrap) return;
  const { size } = kidsXoConfig();
  wrap.classList.toggle('kids-xo-grid-5', size === 5);
  const board = state.kidsXoBoard || new Array(size * size).fill('');
  wrap.innerHTML = '';
  board.forEach((mark, i)=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kids-xo-cell' + (winLine && winLine.includes(i) ? ' kids-xo-win' : '');
    btn.innerHTML = mark === 'X' ? '<span class="kids-xo-mark-x">X</span>' : (mark === 'O' ? '<span class="kids-xo-mark-o">O</span>' : '');
    btn.disabled = !!mark || !!state.kidsXoRoundOver;
    btn.addEventListener('click', ()=>clickKidsXoCell(i));
    wrap.appendChild(btn);
  });
}
function startKidsXoRound(startingMark){
  const { size } = kidsXoConfig();
  state.kidsXoBoard = new Array(size * size).fill('');
  state.kidsXoCurrentPlayer = startingMark;
  state.kidsXoRoundOver = false;
  saveState();
  document.getElementById('kidsXoResultText').textContent = '';
  document.getElementById('kidsXoNextRoundBtn').style.display = 'none';
  updateKidsXoTurnLabel();
  renderKidsXoGrid(null);
}
function clickKidsXoCell(i){
  if(state.kidsXoRoundOver) return;
  const { size } = kidsXoConfig();
  const board = state.kidsXoBoard || (state.kidsXoBoard = new Array(size * size).fill(''));
  if(board[i]) return;
  const mark = state.kidsXoCurrentPlayer || 'X';
  board[i] = mark;
  const winLine = kidsXoCheckWin(board);
  const isDraw = !winLine && board.every(c=>c);
  if(winLine){
    state.kidsXoRoundOver = true;
    if(mark === 'X') state.kidsXoScoreX = (state.kidsXoScoreX || 0) + 1;
    else state.kidsXoScoreO = (state.kidsXoScoreO || 0) + 1;
    state.kidsXoStartingPlayer = mark;
    saveState();
    playSuccessSound();
    updateKidsXoScoreUI();
    document.getElementById('kidsXoResultText').textContent = `🏆 ${kidsXoPlayerName(mark)} побеждает в раунде!`;
    document.getElementById('kidsXoNextRoundBtn').style.display = 'flex';
    renderKidsXoGrid(winLine);
    return;
  }
  if(isDraw){
    state.kidsXoRoundOver = true;
    state.kidsXoDraws = (state.kidsXoDraws || 0) + 1;
    state.kidsXoStartingPlayer = mark === 'X' ? 'O' : 'X';
    saveState();
    playNeutralSound();
    updateKidsXoScoreUI();
    document.getElementById('kidsXoResultText').textContent = '🤝 Ничья!';
    document.getElementById('kidsXoNextRoundBtn').style.display = 'flex';
    renderKidsXoGrid(null);
    return;
  }
  state.kidsXoCurrentPlayer = mark === 'X' ? 'O' : 'X';
  saveState();
  playNeutralSound();
  updateKidsXoTurnLabel();
  renderKidsXoGrid(null);
}
document.getElementById('kidsXoNextRoundBtn').addEventListener('click', ()=>{
  playSuccessSound();
  startKidsXoRound(state.kidsXoStartingPlayer || 'X');
});
function goToKidsXoGame(){
  goToGame('kidsXoSetup', 'kidsXoGame');
  state.kidsXoScoreX = 0;
  state.kidsXoScoreO = 0;
  state.kidsXoDraws = 0;
  saveState();
  updateKidsXoScoreUI();
  const firstMark = Math.random() < 0.5 ? 'X' : 'O';
  startKidsXoRound(firstMark);
  updateMuteBtn();
  requestWakeLock();
}
function showKidsXoSummaryModal(){
  const x = state.kidsXoScoreX || 0;
  const o = state.kidsXoScoreO || 0;
  const draws = state.kidsXoDraws || 0;
  let resultLine;
  if(x === o) resultLine = '🤝 Ничья по общему счёту!';
  else resultLine = `🏆 Победитель партии: ${kidsXoPlayerName(x > o ? 'X' : 'O')}`;
  document.getElementById('kidsXoSummaryIntro').innerHTML = `
    ${kidsXoPlayerName('X')} (<span class="xo-green-x">X</span>): ${x} побед<br>
    ${kidsXoPlayerName('O')} (<span class="xo-o">O</span>): ${o} побед<br>
    Ничьих: ${draws}<br><br>
    ${resultLine}
  `;
  document.getElementById('kidsXoSummaryModal').classList.add('show');
}
function exitKidsXoGame(){
  exitGame('kidsXoGame', 'kidsXoSetup');
  const { size } = kidsXoConfig();
  state.kidsXoBoard = new Array(size * size).fill('');
  state.kidsXoScoreX = 0;
  state.kidsXoScoreO = 0;
  state.kidsXoDraws = 0;
  state.kidsXoRoundOver = false;
  saveState();
}
document.getElementById('kidsXoSetupStartBtn').addEventListener('click', ()=>{ playSuccessSound(); goToKidsXoGame(); });
document.getElementById('kidsXoSetupExitBtn').addEventListener('click', ()=>{ exitKidsXoSetup(); });
document.getElementById('kidsXoExitBtn').addEventListener('click', ()=>{ showKidsXoSummaryModal(); });
document.getElementById('closeKidsXoSummaryBtn').addEventListener('click', ()=>{
  document.getElementById('kidsXoSummaryModal').classList.remove('show');
  exitKidsXoGame();
});
(document.getElementById('kidsXoSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ document.getElementById('kidsXoRulesModal').classList.add('show'); });
(document.getElementById('kidsXoGameRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ document.getElementById('kidsXoRulesModal').classList.add('show'); });
document.getElementById('closeKidsXoRulesBtn').addEventListener('click', ()=>{ document.getElementById('kidsXoRulesModal').classList.remove('show'); });
document.getElementById('kidsXoRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'kidsXoRulesModal') e.currentTarget.classList.remove('show'); });
