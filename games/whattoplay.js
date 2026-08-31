// games/whattoplay.js — Игра "Во что поиграть?" (дети).
// Загружается через <script src="games/whattoplay.js"></script> в index.html.
// Основа — та же, что у "Идеи для вас" (games/ideas.js), которая в свою
// очередь взята с "Предложи партнёру", но без уровней и без картинок —
// просто текстовые карточки с названием и описанием игры из
// cards/cards_whattoplay.js (WHATTOPLAY_CARDS), с избранным.

let whatToPlayCurrentCard = null;

function getWhatToPlayPool(){
  const all = (typeof WHATTOPLAY_CARDS !== 'undefined' && Array.isArray(WHATTOPLAY_CARDS)) ? WHATTOPLAY_CARDS : [];
  if(state.whatToPlayFavView){
    const favs = state.whatToPlayFavorites || [];
    return all.filter(c=>favs.includes(c.title));
  }
  return all;
}

function updateWhatToPlayFavBtn(){
  const btn = document.getElementById('whatToPlayFavBtn');
  if(!btn) return;
  const isFav = !!(whatToPlayCurrentCard && (state.whatToPlayFavorites||[]).includes(whatToPlayCurrentCard.title));
  btn.textContent = isFav ? '❤️' : '☆';
  btn.classList.toggle('active', isFav);
}

function updateWhatToPlayFavViewBtn(){
  const btn = document.getElementById('whatToPlayFavViewBtn');
  if(!btn) return;
  btn.classList.toggle('active', !!state.whatToPlayFavView);
  btn.textContent = state.whatToPlayFavView ? '⭐ Все игры' : '⭐ Избранное';
}

function drawWhatToPlayCard(){
  const pool = getWhatToPlayPool();
  if(pool.length === 0){
    whatToPlayCurrentCard = null;
    fadeSwapEl('whatToPlayCard', (el)=>{
      el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon">💭</div><div class="card-text">${state.whatToPlayFavView ? 'Пока нет избранных игр — отметьте понравившиеся ☆' : 'Игры скоро появятся — добавьте их в cards_whattoplay.js'}</div></div></div>`;
    });
    updateWhatToPlayFavBtn();
    return;
  }
  if(!state.whatToPlayUsed) state.whatToPlayUsed = [];
  let used = state.whatToPlayUsed.filter(t=>pool.some(c=>c.title===t));
  let candidates = pool.filter(c=>!used.includes(c.title));
  if(candidates.length === 0){
    candidates = pool;
    used = [];
    showToast('Игры показаны заново 🔀');
  }
  const card = candidates[Math.floor(Math.random()*candidates.length)];
  used.push(card.title);
  state.whatToPlayUsed = used;
  saveState();
  whatToPlayCurrentCard = card;
  fadeSwapEl('whatToPlayCard', (el)=>{
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-body">
          <div class="card-icon">🎲</div>
          <div class="card-split-title" id="whatToPlayCardTitle">${card.title}</div>
          <div class="card-text" id="whatToPlayCardText">${card.text}</div>
        </div>
      </div>
    `;
  });
  updateWhatToPlayFavBtn();
}

function goToWhatToPlayGame(){
  state.whatToPlayFavView = false;
  goToGame('setup', 'whatToPlayGame');
  updateWhatToPlayFavViewBtn();
  drawWhatToPlayCard();
  updateMuteBtn();
  requestWakeLock();
}
function exitWhatToPlayGame(){
  exitGame('whatToPlayGame', 'setup');
}

document.getElementById('whatToPlayNextBtn').addEventListener('click', ()=>{
  playSuccessSound();
  drawWhatToPlayCard();
});
document.getElementById('whatToPlayFavBtn').addEventListener('click', ()=>{
  if(!whatToPlayCurrentCard) return;
  if(!state.whatToPlayFavorites) state.whatToPlayFavorites = [];
  const idx = state.whatToPlayFavorites.indexOf(whatToPlayCurrentCard.title);
  const wasFavorite = idx >= 0;
  if(wasFavorite){
    state.whatToPlayFavorites.splice(idx, 1);
    showToast('Убрано из избранного');
  } else {
    state.whatToPlayFavorites.push(whatToPlayCurrentCard.title);
    playSuccessSound();
    showToast('Добавлено в избранное ❤️');
  }
  saveState();
  updateWhatToPlayFavBtn();
  if(state.whatToPlayFavView && wasFavorite) drawWhatToPlayCard();
});
document.getElementById('whatToPlayFavViewBtn').addEventListener('click', ()=>{
  if(!state.whatToPlayFavView && (state.whatToPlayFavorites||[]).length === 0){
    playErrorSound();
    showToast('Пока нет избранных игр');
    return;
  }
  state.whatToPlayFavView = !state.whatToPlayFavView;
  saveState();
  updateWhatToPlayFavViewBtn();
  drawWhatToPlayCard();
});
document.getElementById('whatToPlayExitBtn').addEventListener('click', ()=>{ exitWhatToPlayGame(); });
(document.getElementById('whatToPlayGameRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ showModal('whatToPlayRulesModal'); });
document.getElementById('closeWhatToPlayRulesBtn').addEventListener('click', ()=>{ hideModal('whatToPlayRulesModal'); });
document.getElementById('whatToPlayRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'whatToPlayRulesModal') e.currentTarget.classList.remove('show'); });
