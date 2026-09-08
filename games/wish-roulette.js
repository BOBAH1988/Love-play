// games/wish-roulette.js — «Рулетка желаний» (для двоих).
(function(){
  const CELL_COUNT = 37;
  let wrUsedCards = [];
  let wrRoundOver = false;
  let wrSpinning = false;
  let wrTimerId = null;

  const WR_LEVELS = [
    {id:1, name:'Сближение', icon:'💕', desc:'Нежные вопросы и лёгкие действия'},
    {id:2, name:'Разогрев', icon:'🔥', desc:'Чуть смелее — прикосновения и намёки'},
    {id:3, name:'Откровенно 18+', icon:'🔞', desc:'Откровенные вопросы и пошлые действия'},
    {id:4, name:'Фантазии', icon:'✨', desc:'Исполнение желаний и ролевые игры'}
  ];

  function wrLevelById(id){ return WR_LEVELS.find(l => l.id === id) || WR_LEVELS[0]; }

  function wrGetCardsForLevel(level){
    return (window.WISH_ROULETTE_CARDS || []).filter(c => c.level === level);
  }

  function wrRenderSetupLevels(){
    const wrap = document.getElementById('wrSetupLevels');
    if(!wrap) return;
    wrap.innerHTML = '';
    WR_LEVELS.forEach(l => {
      const div = document.createElement('div');
      div.className = 'level-toggle' + (state.wrSelectedLevel === l.id ? ' on' : '');
      div.innerHTML = `<div class="lname">${l.icon} ${l.name}</div><div class="ldesc">${l.desc}</div><div class="level-check"></div>`;
      div.addEventListener('click', () => { state.wrSelectedLevel = l.id; saveState(); wrRenderSetupLevels(); });
      wrap.appendChild(div);
    });
  }

  function goToWrSetup(){ goToGameSetup('wrSetup', null, () => { wrRenderSetupLevels(); }); }

  function exitWrSetup(){
    document.getElementById('wrSetup').classList.remove('active');
    document.getElementById('setup').classList.add('active');
    showSetupView('twoPlayerView');
  }

  function goToWrGame(){
    document.getElementById('wrSetup').classList.remove('active');
    document.getElementById('wrGame').classList.add('active');
    state.inProgress = true;
    state.pausedMode = null;
    wrRoundOver = false;
    wrUsedCards = [];
    const lvl = wrLevelById(state.wrSelectedLevel || 1);
    const turnName = state.currentPlayer === 1 ? state.name1 : state.name2;
    const wrTurnLabel = document.getElementById('wrTurnLabel');
    if(wrTurnLabel) wrTurnLabel.textContent = 'Крутит: ' + turnName;
    const wrLevelLabel = document.getElementById('wrLevelLabel');
    if(wrLevelLabel) wrLevelLabel.textContent = lvl.icon + ' ' + lvl.name;
    const wrResult = document.getElementById('wrResult');
    if(wrResult) wrResult.textContent = '';
    wrRenderWheel();
    wrUpdateScoreUI();
  }

  function wrUpdateScoreUI(){
    document.getElementById('wrScore1').textContent = (state.name1 || 'Игрок 1') + ': ' + (state.wrScore1 || 0);
    document.getElementById('wrScore2').textContent = (state.name2 || 'Игрок 2') + ': ' + (state.wrScore2 || 0);
  }

  function wrRenderWheel(){
    const wheel = document.getElementById('wrWheel');
    if(!wheel) return;
    const cards = wrGetCardsForLevel(state.wrSelectedLevel || 1);
    const available = cards.filter(c => !wrUsedCards.includes(c.text));
    const display = [];
    for(let i = 0; i < CELL_COUNT; i++){
      display.push(available.length > 0 ? available[i % available.length] : {type:'text', text:'🎴'});
    }
    wheel.innerHTML = '';
    display.forEach((card, idx) => {
      const cell = document.createElement('div');
      cell.className = 'wr-cell';
      cell.dataset.idx = idx;
      const label = card.text.length > 12 ? card.text.substring(0, 12) + '…' : card.text;
      cell.innerHTML = `<span class="wr-cell-type">${card.type === 'truth' ? '💬' : '🎯'}</span><span class="wr-cell-text">${label}</span>`;
      wheel.appendChild(cell);
    });
    wheel._cells = display;
  }

  function wrSpin(){
    if(wrSpinning || wrRoundOver) return;
    wrSpinning = true;
    const wheel = document.getElementById('wrWheel');
    if(!wheel || !wheel._cells) return;
    const cells = wheel._cells;
    const resultIdx = Math.floor(Math.random() * cells.length);
    const resultCard = cells[resultIdx];
    const resultEl = document.getElementById('wrResult');
    if(resultEl){
      resultEl.textContent = '🎰 ' + resultCard.text;
      resultEl.className = 'wr-result show ' + (resultCard.type === 'truth' ? 'truth' : 'dare');
    }
    const cellEls = wheel.querySelectorAll('.wr-cell');
    cellEls.forEach(c => c.classList.remove('active'));
    if(cellEls[resultIdx]) cellEls[resultIdx].classList.add('active');
    wrUsedCards.push(resultCard.text);
    wrSpinning = false;
  }

  function wrNextRound(){
    if(wrTimerId){ clearTimeout(wrTimerId); wrTimerId = null; }
    state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
    const turnName = state.currentPlayer === 1 ? state.name1 : state.name2;
    const turnLabel = document.getElementById('wrTurnLabel');
    if(turnLabel) turnLabel.textContent = 'Крутит: ' + turnName;
    const resultEl = document.getElementById('wrResult');
    if(resultEl){ resultEl.textContent = ''; resultEl.className = 'wr-result'; }
    wrRenderWheel();
  }

  function wrDone(){
    if(state.currentPlayer === 1) state.wrScore1 = (state.wrScore1 || 0) + 1;
    else state.wrScore2 = (state.wrScore2 || 0) + 1;
    saveState();
    wrUpdateScoreUI();
    wrNextRound();
  }

  function wrSkip(){ wrNextRound(); }

  function pauseWrGame(){
    if(wrTimerId){ clearTimeout(wrTimerId); wrTimerId = null; }
    state.pausedMode = 'wishRoulette';
    state.inProgress = false;
    document.getElementById('wrGame').classList.remove('active');
    document.getElementById('setup').classList.add('active');
    showSetupView('twoPlayerView');
    if(typeof showPauseMenu === 'function') showPauseMenu();
    showToast('Игра на паузе — прогресс сохранён');
  }

  function resumeWrGame(){
    if(state.pausedMode !== 'wishRoulette') return;
    abandonPausedSession('wishRoulette');
    state.pausedMode = null;
    state.inProgress = true;
    document.getElementById('setup').classList.remove('active');
    document.getElementById('wrGame').classList.add('active');
    wrUpdateScoreUI();
    wrRenderWheel();
    if(typeof hidePauseMenu === 'function') hidePauseMenu();
  }

  function finishWrGame(){
    if(typeof hidePauseMenu === 'function') hidePauseMenu();
    showWrSummary();
  }

  function showWrSummary(){
    const modal = document.getElementById('wrSummaryModal');
    if(!modal) return;
    const list = document.getElementById('wrSummaryList');
    if(list){
      const s1 = state.wrScore1 || 0;
      const s2 = state.wrScore2 || 0;
      const n1 = state.name1 || 'Игрок 1';
      const n2 = state.name2 || 'Игрок 2';
      let result = '';
      if(s1 > s2) result = '🏆 ' + n1 + ' выполнил(а) больше заданий!';
      else if(s2 > s1) result = '🏆 ' + n2 + ' выполнил(а) больше заданий!';
      else result = '🤝 Ничья — оба молодцы!';
      list.innerHTML = `<div class="wr-summary-winner">${result}</div>
        <div class="wr-summary-scores"><span>${n1}: ${s1}</span><span>${n2}: ${s2}</span></div>`;
    }
    modal.classList.add('show');
  }

  function closeWrSummary(){
    document.getElementById('wrSummaryModal').classList.remove('show');
    exitWrGame();
  }

  function exitWrGame(){
    if(wrTimerId){ clearTimeout(wrTimerId); wrTimerId = null; }
    state.wrScore1 = 0;
    state.wrScore2 = 0;
    state.wrSelectedLevel = 1;
    state.inProgress = false;
    state.pausedMode = null;
    wrRoundOver = false;
    wrUsedCards = [];
    document.getElementById('wrGame').classList.remove('active');
    document.getElementById('setup').classList.add('active');
    showSetupView('twoPlayerView');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const spinBtn = document.getElementById('wrSpinBtn');
    if(spinBtn) spinBtn.addEventListener('click', wrSpin);
    const doneBtn = document.getElementById('wrDoneBtn');
    if(doneBtn) doneBtn.addEventListener('click', wrDone);
    const skipBtn = document.getElementById('wrSkipBtn');
    if(skipBtn) skipBtn.addEventListener('click', wrSkip);
    const pauseBtn = document.getElementById('wrPauseBtn');
    if(pauseBtn) pauseBtn.addEventListener('click', pauseWrGame);
    const closeBtn = document.getElementById('closeWrSummaryBtn');
    if(closeBtn) closeBtn.addEventListener('click', closeWrSummary);
    const startBtn = document.getElementById('wrSetupStartBtn');
    if(startBtn) startBtn.addEventListener('click', goToWrGame);
    const exitSetupBtn = document.getElementById('wrSetupExitBtn');
    if(exitSetupBtn) exitSetupBtn.addEventListener('click', exitWrSetup);
  });

  window.goToWrSetup = goToWrSetup;
  window.pauseWrGame = pauseWrGame;
  window.resumeWrGame = resumeWrGame;
  window.finishWrGame = finishWrGame;
})();
