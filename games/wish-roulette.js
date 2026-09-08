// games/wish-roulette.js — «Рулетка желаний» (для двоих).
(function(){
  var NUMBERS = 37;
  var SEG = 360 / NUMBERS;
  var wrUsedCards = [];
  var wrSpinning = false;
  var wrCompleted = 0;
  var wrWheelRotation = 0;
  var wrSpinSession = 0;

  function wrGetAllCards(){ return (window.WISH_ROULETTE_CARDS || []); }

  function goToWrGame(){
    document.getElementById('setup').classList.remove('active');
    document.getElementById('wrGame').classList.add('active');
    state.inProgress = true; state.pausedMode = null;
    wrUsedCards = []; wrCompleted = 0; wrWheelRotation = 0;
    wrBuildWheel();
    var r = document.getElementById('wrResult'); if(r){ r.textContent=''; r.className='wr-result'; }
    var contBtn = document.getElementById('wrContinueBtn'); if(contBtn) contBtn.style.display = 'none';
    var spinBtn = document.getElementById('wrSpinBtn'); if(spinBtn) spinBtn.style.display = '';
  }

  function wrGetColor(n){
    if(n === 0) return 'green';
    var reds = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    return reds.indexOf(n) >= 0 ? 'red' : 'black';
  }

  function wrBuildWheel(){
    var wheel = document.getElementById('wrWheel'); if(!wheel) return;
    var cards = wrGetAllCards();
    var avail = cards.filter(function(c){ return wrUsedCards.indexOf(c.text) < 0; });
    var size = 500, cx = size/2, cy = size/2, r = size/2 - 10;
    var svg = '<svg viewBox="0 0 '+size+' '+size+'" xmlns="http://www.w3.org/2000/svg">';
    for(var i = 0; i < NUMBERS; i++){
      var a1 = (i * SEG - 90) * Math.PI / 180;
      var a2 = ((i + 1) * SEG - 90) * Math.PI / 180;
      var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      var x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      var col = wrGetColor(i);
      var fill = col === 'green' ? '#16a34a' : col === 'red' ? '#dc2626' : '#1f2937';
      var d = 'M'+cx+' '+cy+' L'+x1+' '+y1+' A'+r+' '+r+' 0 0 1 '+x2+' '+y2+' Z';
      svg += "<path d='"+d+"' fill='"+fill+"' stroke='rgba(255,255,255,.3)' stroke-width='1'/>";
      var ta = ((i * SEG + SEG/2) - 90) * Math.PI / 180;
      var tr = r * 0.72;
      var tx = cx + tr * Math.cos(ta), ty = cy + tr * Math.sin(ta);
      var rot = i * SEG + SEG/2;
      svg += "<text x='"+tx+"' y='"+ty+"' fill='#fff' font-size='18' font-weight='700' text-anchor='middle' dominant-baseline='central' transform='rotate("+rot+' '+tx+' '+ty+")'>"+i+"</text>";
    }
    svg += "<circle cx='"+cx+"' cy='"+cy+"' r='30' fill='#0f0f23' stroke='rgba(255,255,255,.4)' stroke-width='2'/>";
    svg += '</svg>';
    wheel.innerHTML = svg;
    wheel._cards = avail;
    wheel.style.transition = 'none';
    wheel.style.transform = 'rotate(0deg)';
  }

  function wrSpin(){
    if(wrSpinning) return;
    wrSpinning = true;
    var spinSession = ++wrSpinSession;
    var spinBtn = document.getElementById('wrSpinBtn'); if(spinBtn) spinBtn.style.display = 'none';
    var contBtn = document.getElementById('wrContinueBtn'); if(contBtn) contBtn.style.display = 'none';
    var resultEl = document.getElementById('wrResult'); if(resultEl) resultEl.textContent = '';

    var wheel = document.getElementById('wrWheel');
    if(!wheel) return;
    var cards = wheel._cards || [];
    if(cards.length === 0){ wrSpinning = false; return; }

    var resultIdx = Math.floor(Math.random() * NUMBERS);
    var resultNum = resultIdx;
    var resultCard = cards[resultIdx % cards.length];
    var colorName = wrGetColor(resultNum) === 'green' ? 'зеро' : wrGetColor(resultNum) === 'red' ? 'красное' : 'чёрное';

    var targetAngle = 360 * (3 + Math.random() * 2) + (360 - resultNum * SEG - SEG/2);
    wrWheelRotation += targetAngle;

    wheel.style.transition = 'none';
    void wheel.offsetWidth;
    wheel.style.transition = 'transform 3.2s cubic-bezier(.16,1,.3,1)';
    wheel.style.transform = 'rotate(' + wrWheelRotation + 'deg)';

    if(wrTimerId){ clearTimeout(wrTimerId); wrTimerId = null; }
    wrTimerId = setTimeout(function(){
      if(spinSession !== wrSpinSession) return;
      if(resultEl){
        resultEl.innerHTML = '<div class="wr-landed">Выпало: <strong>' + resultNum + '</strong> (' + colorName + ')</div>' +
          '<div class="wr-task ' + (resultCard.type === 'truth' ? 'truth' : 'dare') + '">' + resultCard.text + '</div>';
        resultEl.className = 'wr-result show';
      }
      wrUsedCards.push(resultCard.text);
      wrSpinning = false;
      if(contBtn) contBtn.style.display = '';
    }, 3300);
  }

  function wrNext(){
    if(wrTimerId){ clearTimeout(wrTimerId); wrTimerId = null; }
    wrCompleted++;
    var el = document.getElementById('wrResult'); if(el){ el.textContent=''; el.className='wr-result'; }
    var contBtn = document.getElementById('wrContinueBtn'); if(contBtn) contBtn.style.display = 'none';
    var spinBtn = document.getElementById('wrSpinBtn'); if(spinBtn) spinBtn.style.display = '';
    wrBuildWheel();
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
    wrBuildWheel();
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
