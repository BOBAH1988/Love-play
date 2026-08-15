// games/kids-xo.js — Игра «Крестики-нолики» (раздел «Игры с детьми»).
// Два игрока (берутся из общего списка kidsPlayers — первые два имени),
// поле 3×3. Первый ход в партии — случайный, дальше первым всегда ходит
// победитель предыдущего раунда (при ничьей — право первого хода переходит
// другому игроку). Счёт побед/ничьих ведётся по всей партии, итог
// показывается при выходе.

const KIDS_XO_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

function kidsXoPlayerName(mark){
  const players = state.kidsPlayers || [];
  if(mark === 'X') return players[0] || 'Игрок 1';
  return players[1] || 'Игрок 2';
}
function goToKidsXoSetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('kidsXoSetup').classList.add('active');
}
function exitKidsXoSetup(){
  document.getElementById('kidsXoSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}
function updateKidsXoScoreUI(){
  const el = document.getElementById('kidsXoScoreRow');
  if(!el) return;
  el.innerHTML = `
    <span class="krokodil-score-item">${kidsXoPlayerName('X')} (❌): ${state.kidsXoScoreX || 0}</span>
    <span class="krokodil-score-item">${kidsXoPlayerName('O')} (⭕): ${state.kidsXoScoreO || 0}</span>
    <span class="krokodil-score-item">Ничьи: ${state.kidsXoDraws || 0}</span>
  `;
}
function updateKidsXoTurnLabel(){
  const el = document.getElementById('kidsXoTurnLabel');
  if(!el) return;
  const mark = state.kidsXoCurrentPlayer || 'X';
  el.textContent = `Ходит: ${kidsXoPlayerName(mark)} (${mark === 'X' ? '❌' : '⭕'})`;
}
function kidsXoCheckWin(board){
  for(const line of KIDS_XO_LINES){
    const [a,b,c] = line;
    if(board[a] && board[a] === board[b] && board[a] === board[c]) return line;
  }
  return null;
}
function renderKidsXoGrid(winLine){
  const wrap = document.getElementById('kidsXoGrid');
  if(!wrap) return;
  const board = state.kidsXoBoard || new Array(9).fill('');
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
  state.kidsXoBoard = new Array(9).fill('');
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
  const board = state.kidsXoBoard || (state.kidsXoBoard = new Array(9).fill(''));
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
  document.getElementById('kidsXoSetup').classList.remove('active');
  document.getElementById('kidsXoGame').classList.add('active');
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
    ${kidsXoPlayerName('X')} (❌): ${x} побед<br>
    ${kidsXoPlayerName('O')} (⭕): ${o} побед<br>
    Ничьих: ${draws}<br><br>
    ${resultLine}
  `;
  document.getElementById('kidsXoSummaryModal').classList.add('show');
}
function exitKidsXoGame(){
  document.getElementById('kidsXoGame').classList.remove('active');
  document.getElementById('kidsXoSetup').classList.add('active');
  state.kidsXoBoard = new Array(9).fill('');
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
document.getElementById('kidsXoSetupRulesBtn').addEventListener('click', ()=>{ document.getElementById('kidsXoRulesModal').classList.add('show'); });
document.getElementById('kidsXoGameRulesBtn').addEventListener('click', ()=>{ document.getElementById('kidsXoRulesModal').classList.add('show'); });
document.getElementById('closeKidsXoRulesBtn').addEventListener('click', ()=>{ document.getElementById('kidsXoRulesModal').classList.remove('show'); });
document.getElementById('kidsXoRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'kidsXoRulesModal') e.currentTarget.classList.remove('show'); });
