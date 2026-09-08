// games/wish-roulette.js — «Рулетка желаний» (для двоих).
(function(){
  const CELL_COUNT = 37;
  let wrUsedCards = [];
  let wrSpinning = false;
  let wrCompleted = 0;
  let wrTimerId = null;
  const WR_COLORS = ['green','red','black','red','black','red','black','red','black','red','black','red','black','black','red','black','red','black','red','red','black','red','black','red','black','red','black','red','black','red','black','black','red','black','red','black','red'];

  function wrGetAllCards(){ return (window.WISH_ROULETTE_CARDS || []); }

  function goToWrGame(){
    document.getElementById('setup').classList.remove('active');
    document.getElementById('wrGame').classList.add('active');
    state.inProgress = true; state.pausedMode = null;
    wrUsedCards = []; wrCompleted = 0;
    var t = document.getElementById('wrTitle'); if(t) t.textContent = '🎡 Рулетка желаний';
    wrRenderWheel();
    var r = document.getElementById('wrResult'); if(r){ r.textContent=''; r.className='wr-result'; }
  }

  function wrRenderWheel(){
    var wheel = document.getElementById('wrWheel'); if(!wheel) return;
    var cards = wrGetAllCards();
    var avail = cards.filter(function(c){ return !wrUsedCards.includes(c.text); });
    var disp = [];
    for(var i=0;i<CELL_COUNT;i++) disp.push(avail.length>0?avail[i%avail.length]:{type:'text',text:'🎴'});
    wheel.innerHTML = '';
    disp.forEach(function(card,idx){
      var cell = document.createElement('div'); cell.className='wr-cell'; cell.dataset.idx=idx;
      var c=WR_COLORS[idx]||'red'; var em=c==='green'?'🟢':c==='red'?'🔴':'⚫';
      cell.innerHTML='<span class="wr-cell-num">'+em+' '+idx+'</span><span class="wr-cell-type">'+(card.type==='truth'?'💬':'🎯')+'</span>';
      wheel.appendChild(cell);
    });
    wheel._cells = disp;
  }

  function wrSpin(){
    if(wrSpinning) return;
    wrSpinning = true;
    var wheel = document.getElementById('wrWheel'); if(!wheel || !wheel._cells) return;
    var cells = wheel._cells;
    var idx = Math.floor(Math.random() * cells.length);
    var card = cells[idx];
    var color = WR_COLORS[idx] || 'red';
    var colorName = color==='green'?'зеро':color==='red'?'красное':'чёрное';
    var el = document.getElementById('wrResult');
    if(el){
      el.innerHTML = '<div class="wr-landed">Выпало: <strong>'+idx+'</strong> ('+colorName+')</div>'+
        '<div class="wr-task '+(card.type==='truth'?'truth':'dare')+'">'+card.text+'</div>';
      el.className = 'wr-result show';
    }
    var cellEls = wheel.querySelectorAll('.wr-cell');
    cellEls.forEach(function(c){ c.classList.remove('active'); });
    if(cellEls[idx]) cellEls[idx].classList.add('active');
    wrUsedCards.push(card.text);
    wrSpinning = false;
    var contBtn = document.getElementById('wrContinueBtn');
    if(contBtn) contBtn.style.display = '';
  }

  function wrNext(){
    if(wrTimerId){ clearTimeout(wrTimerId); wrTimerId = null; }
    wrCompleted++;
    var el = document.getElementById('wrResult'); if(el){ el.textContent=''; el.className='wr-result'; }
    var contBtn = document.getElementById('wrContinueBtn'); if(contBtn) contBtn.style.display = 'none';
    wrRenderWheel();
  }

  function pauseWrGame(){
    if(wrTimerId){ clearTimeout(wrTimerId); wrTimerId = null; }
    state.pausedMode = 'wishRoulette'; state.inProgress = false;
    document.getElementById('wrGame').classList.remove('active');
    document.getElementById('setup').classList.add('active');
    showSetupView('twoPlayerView');
    if(typeof showPauseMenu === 'function') showPauseMenu();
    showToast('Игра на паузе — прогресс сохранён');
  }

  function resumeWrGame(){
    if(state.pausedMode !== 'wishRoulette') return;
    abandonPausedSession('wishRoulette');
    state.pausedMode = null; state.inProgress = true;
    document.getElementById('setup').classList.remove('active');
    document.getElementById('wrGame').classList.add('active');
    wrRenderWheel();
    if(typeof hidePauseMenu === 'function') hidePauseMenu();
  }

  function finishWrGame(){
    if(typeof hidePauseMenu === 'function') hidePauseMenu();
    showWrSummary();
  }

  function showWrSummary(){
    var modal = document.getElementById('wrSummaryModal'); if(!modal) return;
    var list = document.getElementById('wrSummaryList');
    if(list){
      list.innerHTML = '<div class="wr-summary-congrats">🎉 Поздравляем!</div>'+
        '<div class="wr-summary-count">Вы выполнили <strong>'+wrCompleted+'</strong> заданий</div>'+
        '<div class="wr-summary-text">Отлично провели время вместе! 💕</div>';
    }
    modal.classList.add('show');
  }

  function closeWrSummary(){
    document.getElementById('wrSummaryModal').classList.remove('show');
    exitWrGame();
  }

  function exitWrGame(){
    if(wrTimerId){ clearTimeout(wrTimerId); wrTimerId = null; }
    wrCompleted = 0; wrUsedCards = [];
    state.inProgress = false; state.pausedMode = null;
    document.getElementById('wrGame').classList.remove('active');
    document.getElementById('setup').classList.add('active');
    showSetupView('twoPlayerView');
  }

  document.addEventListener('DOMContentLoaded', function(){
    var spinBtn = document.getElementById('wrSpinBtn'); if(spinBtn) spinBtn.addEventListener('click', wrSpin);
    var contBtn = document.getElementById('wrContinueBtn'); if(contBtn) contBtn.addEventListener('click', wrNext);
    var pauseBtn = document.getElementById('wrPauseBtn'); if(pauseBtn) pauseBtn.addEventListener('click', pauseWrGame);
    var closeBtn = document.getElementById('closeWrSummaryBtn'); if(closeBtn) closeBtn.addEventListener('click', closeWrSummary);
  });

  window.goToWrGame = goToWrGame;
  window.pauseWrGame = pauseWrGame;
  window.resumeWrGame = resumeWrGame;
  window.finishWrGame = finishWrGame;
})();

