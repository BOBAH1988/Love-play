// games/kids-connect4.js — Игра «Четыре в ряд» (раздел «Игры с детьми»,
// подменю «Настольные игры»). Два игрока (берутся из общего списка
// kidsPlayers — первые два имени), поле 7 колонок × 6 рядов. Игроки по
// очереди бросают шашки своего цвета в колонку — шашка падает в самую
// нижнюю свободную позицию (гравитация). Побеждает тот, кто первым соберёт
// четыре свои шашки подряд — по горизонтали, вертикали или диагонали.
// Первый ход в самой первой партии — случайный, дальше первым всегда ходит
// победитель предыдущего раунда (при ничьей право первого хода переходит
// другому игроку). Счёт побед/ничьих ведётся по всей партии, итог
// показывается при выходе. Загружается из index.html.

const KIDS_C4_COLS = 7;
const KIDS_C4_ROWS = 6;

function kidsC4PlayerName(mark){
  const players = state.kidsPlayers || [];
  if(mark === 'R') return players[0] || 'Игрок 1';
  return players[1] || 'Игрок 2';
}
function kidsC4MarkIcon(mark){
  return mark === 'R' ? '🔴' : '🟡';
}
function goToKidsC4Setup(){
  goToGameSetup('kidsC4Setup', null, null);
}
function exitKidsC4Setup(){
  document.getElementById('kidsC4Setup').classList.remove('active');
  document.getElementById('kidsBoardGamesMenu').classList.add('active');
}
function updateKidsC4ScoreUI(){
  const el = document.getElementById('kidsC4ScoreRow');
  if(!el) return;
  el.innerHTML = `
    <span class="krokodil-score-item">${kidsC4PlayerName('R')} 🔴: ${state.kidsC4ScoreR || 0}</span>
    <span class="krokodil-score-item">${kidsC4PlayerName('Y')} 🟡: ${state.kidsC4ScoreY || 0}</span>
    <span class="krokodil-score-item">Ничьи: ${state.kidsC4Draws || 0}</span>
  `;
}
function updateKidsC4TurnLabel(){
  const el = document.getElementById('kidsC4TurnLabel');
  if(!el) return;
  const mark = state.kidsC4CurrentPlayer || 'R';
  el.innerHTML = `Ходит: ${kidsC4PlayerName(mark)} ${kidsC4MarkIcon(mark)}`;
}
// Ищет 4 шашки одного цвета подряд (горизонталь/вертикаль/обе диагонали),
// возвращает массив индексов победной линии или null. Индекс ячейки =
// row * KIDS_C4_COLS + col, row 0 — верхний ряд поля.
function kidsC4CheckWin(board){
  const idx = (r, c) => r * KIDS_C4_COLS + c;
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for(let r = 0; r < KIDS_C4_ROWS; r++){
    for(let c = 0; c < KIDS_C4_COLS; c++){
      const mark = board[idx(r,c)];
      if(!mark) continue;
      for(const [dr,dc] of dirs){
        const cells = [idx(r,c)];
        for(let k = 1; k < 4; k++){
          const rr = r + dr*k, cc = c + dc*k;
          if(rr < 0 || rr >= KIDS_C4_ROWS || cc < 0 || cc >= KIDS_C4_COLS) break;
          if(board[idx(rr,cc)] !== mark) break;
          cells.push(idx(rr,cc));
        }
        if(cells.length === 4) return cells;
      }
    }
  }
  return null;
}
// Самая нижняя свободная позиция колонки (гравитация); -1 — колонка заполнена.
function kidsC4LandingRow(board, col){
  for(let r = KIDS_C4_ROWS - 1; r >= 0; r--){
    if(!board[r * KIDS_C4_COLS + col]) return r;
  }
  return -1;
}
// Отрисовка поля: заполненные ячейки — цветные диски (красный/жёлтый фон),
// ячейка, куда упадёт шашка выбранной колонки, подсвечена стрелкой ⬇.
// Клик по ЛЮБОЙ пустой ячейке колонки бросает шашку в эту колонку —
// по маленьким ячейкам в нижних рядах детям попасть легче, чем прицеливаться.
function renderKidsC4Grid(winCells){
  const wrap = document.getElementById('kidsC4Grid');
  if(!wrap) return;
  const board = state.kidsC4Board || new Array(KIDS_C4_COLS * KIDS_C4_ROWS).fill('');
  const roundOver = !!state.kidsC4RoundOver;
  wrap.innerHTML = '';
  board.forEach((mark, i)=>{
    const col = i % KIDS_C4_COLS;
    const row = Math.floor(i / KIDS_C4_COLS);
    const isLanding = !roundOver && !mark && kidsC4LandingRow(board, col) === row;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kids-c4-cell'
      + (mark === 'R' ? ' kids-c4-red' : '')
      + (mark === 'Y' ? ' kids-c4-yellow' : '')
      + (winCells && winCells.includes(i) ? ' kids-c4-win' : '');
    btn.innerHTML = isLanding ? '<span class="kids-c4-hint">⬇</span>' : '';
    btn.setAttribute('aria-label', `Колонка ${col + 1}, ряд ${row + 1}${mark ? ` — ${mark === 'R' ? 'красная' : 'жёлтая'}` : ''}`);
    btn.disabled = !!mark || roundOver;
    btn.addEventListener('click', ()=>clickKidsC4Column(col));
    wrap.appendChild(btn);
  });
}
function startKidsC4Round(startingMark){
  state.kidsC4Board = new Array(KIDS_C4_COLS * KIDS_C4_ROWS).fill('');
  state.kidsC4CurrentPlayer = startingMark;
  state.kidsC4RoundOver = false;
  saveState();
  document.getElementById('kidsC4ResultText').textContent = '';
  document.getElementById('kidsC4NextRoundBtn').style.display = 'none';
  updateKidsC4TurnLabel();
  renderKidsC4Grid(null);
}
function clickKidsC4Column(col){
  if(state.kidsC4RoundOver) return;
  const board = state.kidsC4Board || (state.kidsC4Board = new Array(KIDS_C4_COLS * KIDS_C4_ROWS).fill(''));
  const row = kidsC4LandingRow(board, col);
  if(row < 0) return; // колонка заполнена — ход невозможен
  const mark = state.kidsC4CurrentPlayer || 'R';
  board[row * KIDS_C4_COLS + col] = mark;
  const winCells = kidsC4CheckWin(board);
  const isDraw = !winCells && board.every(c=>c);
  if(winCells){
    state.kidsC4RoundOver = true;
    if(mark === 'R') state.kidsC4ScoreR = (state.kidsC4ScoreR || 0) + 1;
    else state.kidsC4ScoreY = (state.kidsC4ScoreY || 0) + 1;
    state.kidsC4StartingPlayer = mark;
    saveState();
    playSuccessSound();
    updateKidsC4ScoreUI();
    document.getElementById('kidsC4ResultText').textContent = `🏆 ${kidsC4PlayerName(mark)} побеждает в раунде!`;
    document.getElementById('kidsC4NextRoundBtn').style.display = 'flex';
    renderKidsC4Grid(winCells);
    return;
  }
  if(isDraw){
    state.kidsC4RoundOver = true;
    state.kidsC4Draws = (state.kidsC4Draws || 0) + 1;
    state.kidsC4StartingPlayer = mark === 'R' ? 'Y' : 'R';
    saveState();
    playNeutralSound();
    updateKidsC4ScoreUI();
    document.getElementById('kidsC4ResultText').textContent = '🤝 Ничья!';
    document.getElementById('kidsC4NextRoundBtn').style.display = 'flex';
    renderKidsC4Grid(null);
    return;
  }
  state.kidsC4CurrentPlayer = mark === 'R' ? 'Y' : 'R';
  saveState();
  playNeutralSound();
  updateKidsC4TurnLabel();
  renderKidsC4Grid(null);
}
document.getElementById('kidsC4NextRoundBtn').addEventListener('click', ()=>{
  playSuccessSound();
  startKidsC4Round(state.kidsC4StartingPlayer || 'R');
});
function goToKidsC4Game(){
  goToGame('kidsC4Setup', 'kidsC4Game');
  state.kidsC4ScoreR = 0;
  state.kidsC4ScoreY = 0;
  state.kidsC4Draws = 0;
  saveState();
  updateKidsC4ScoreUI();
  const firstMark = Math.random() < 0.5 ? 'R' : 'Y';
  startKidsC4Round(firstMark);
  updateMuteBtn();
  requestWakeLock();
}
function showKidsC4SummaryModal(){
  const r = state.kidsC4ScoreR || 0;
  const y = state.kidsC4ScoreY || 0;
  const draws = state.kidsC4Draws || 0;
  let resultLine;
  if(r === y) resultLine = '🤝 Ничья по общему счёту!';
  else resultLine = `🏆 Победитель партии: ${kidsC4PlayerName(r > y ? 'R' : 'Y')}`;
  document.getElementById('kidsC4SummaryIntro').innerHTML = `
    ${kidsC4PlayerName('R')} 🔴: ${r} побед<br>
    ${kidsC4PlayerName('Y')} 🟡: ${y} побед<br>
    Ничьих: ${draws}<br><br>
    ${resultLine}
  `;
  showModal('kidsC4SummaryModal');
}
function exitKidsC4Game(){
  exitGame('kidsC4Game', 'kidsC4Setup');
  state.kidsC4Board = new Array(KIDS_C4_COLS * KIDS_C4_ROWS).fill('');
  state.kidsC4ScoreR = 0;
  state.kidsC4ScoreY = 0;
  state.kidsC4Draws = 0;
  state.kidsC4RoundOver = false;
  saveState();
}
document.getElementById('kidsC4SetupStartBtn').addEventListener('click', ()=>{ playSuccessSound(); goToKidsC4Game(); });
document.getElementById('kidsC4SetupExitBtn').addEventListener('click', ()=>{ exitKidsC4Setup(); });
document.getElementById('kidsC4ExitBtn').addEventListener('click', ()=>{ showKidsC4SummaryModal(); });
document.getElementById('closeKidsC4SummaryBtn').addEventListener('click', ()=>{
  hideModal('kidsC4SummaryModal');
  exitKidsC4Game();
});
openRulesModal('kidsC4GameRulesBtn', 'kidsC4RulesModal');
setupRulesModal('kidsC4RulesModal', 'closeKidsC4RulesBtn');
