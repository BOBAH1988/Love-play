// games/ideas.js — Игра "Ответы на вопросы" (пары).
// Загружается через <script src="games/ideas.js"></script> в index.html.
// Основа взята с "Предложи партнеру" (games/core.js: drawPhotoCard/goToPhotoSetup),
// но без уровней и без картинок — просто текстовые карточки вопрос/ответ из
// cards/cards_sex_coach_qa.js (SEX_COACH_QA_CARDS), с избранным по аналогии
// с остальными играми. Имена функций/переменных/id остались "ideas*" по
// историческим причинам (раньше здесь была игра "Идеи для вас" — теперь она
// переехала внутрь "Предложи партнеру" уровнем, см. games/core.js), но само
// содержимое игры — вопросы и ответы сексологов, а не сценарии вечеров.

let ideasCurrentCard = null;

function getIdeasPool(){
  const all = (typeof SEX_COACH_QA_CARDS !== 'undefined' && Array.isArray(SEX_COACH_QA_CARDS)) ? SEX_COACH_QA_CARDS : [];
  if(state.ideasFavView){
    const favs = state.ideasFavorites || [];
    return all.filter(c=>favs.includes(c.title));
  }
  return all;
}

function updateIdeasFavBtn(){
  const btn = document.getElementById('ideasFavBtn');
  if(!btn) return;
  const isFav = !!(ideasCurrentCard && (state.ideasFavorites||[]).includes(ideasCurrentCard.title));
  btn.textContent = isFav ? '❤️' : '☆';
  btn.classList.toggle('active', isFav);
}

function updateIdeasFavViewBtn(){
  const btn = document.getElementById('ideasFavViewBtn');
  if(!btn) return;
  btn.classList.toggle('active', !!state.ideasFavView);
  btn.textContent = state.ideasFavView ? '⭐ Все вопросы' : '⭐ Избранное';
}

function drawIdeaCard(){
  const pool = getIdeasPool();
  if(pool.length === 0){
    ideasCurrentCard = null;
    fadeSwapEl('ideasCard', (el)=>{
      el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon">💭</div><div class="card-text">${state.ideasFavView ? 'Пока нет избранных вопросов — отметьте понравившиеся ☆' : 'Вопросы скоро появятся — добавьте их в cards_sex_coach_qa.js'}</div></div></div>`;
    });
    updateIdeasFavBtn();
    return;
  }
  if(!state.ideasUsed) state.ideasUsed = [];
  let used = state.ideasUsed.filter(t=>pool.some(c=>c.title===t));
  let candidates = pool.filter(c=>!used.includes(c.title));
  if(candidates.length === 0){
    candidates = pool;
    used = [];
    showToast('Вопросы показаны заново 🔀');
  }
  const card = candidates[Math.floor(Math.random()*candidates.length)];
  used.push(card.title);
  state.ideasUsed = used;
  saveState();
  ideasCurrentCard = card;
  fadeSwapEl('ideasCard', (el)=>{
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-body">
          <div class="card-icon">💬</div>
          <div class="card-split-title" id="ideasCardTitle">${card.title}</div>
          <div class="card-text" id="ideasCardText">${card.text}</div>
        </div>
      </div>
    `;
  });
  updateIdeasFavBtn();
}

function goToIdeasGame(){
  state.ideasFavView = false;
  document.getElementById('setup').classList.remove('active');
  document.getElementById('ideasGame').classList.add('active');
  updateIdeasFavViewBtn();
  drawIdeaCard();
  updateMuteBtn();
  requestWakeLock();
}
function exitIdeasGame(){
  exitGame('ideasGame', 'setup');
  showSetupView('companyView');
}

document.getElementById('ideasNextBtn').addEventListener('click', ()=>{
  playSuccessSound();
  drawIdeaCard();
});
document.getElementById('ideasFavBtn').addEventListener('click', ()=>{
  if(!ideasCurrentCard) return;
  if(!state.ideasFavorites) state.ideasFavorites = [];
  const idx = state.ideasFavorites.indexOf(ideasCurrentCard.title);
  const wasFavorite = idx >= 0;
  if(wasFavorite){
    state.ideasFavorites.splice(idx, 1);
    showToast('Убрано из избранного');
  } else {
    state.ideasFavorites.push(ideasCurrentCard.title);
    playSuccessSound();
    showToast('Добавлено в избранное ❤️');
  }
  saveState();
  updateIdeasFavBtn();
  if(state.ideasFavView && wasFavorite) drawIdeaCard();
});
document.getElementById('ideasFavViewBtn').addEventListener('click', ()=>{
  if(!state.ideasFavView && (state.ideasFavorites||[]).length === 0){
    playErrorSound();
    showToast('Пока нет избранных идей');
    return;
  }
  state.ideasFavView = !state.ideasFavView;
  saveState();
  updateIdeasFavViewBtn();
  drawIdeaCard();
});
document.getElementById('ideasExitBtn').addEventListener('click', ()=>{ exitIdeasGame(); });
(document.getElementById('ideasGameRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ document.getElementById('ideasRulesModal').classList.add('show'); });
document.getElementById('closeIdeasRulesBtn').addEventListener('click', ()=>{ document.getElementById('ideasRulesModal').classList.remove('show'); });
document.getElementById('ideasRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'ideasRulesModal') e.currentTarget.classList.remove('show'); });
