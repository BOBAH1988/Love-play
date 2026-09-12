// games/ideas.js — Игра "Ответы на вопросы" (пары).
// Загружается через <script src="games/ideas.js"></script> в index.html.
// Основа взята с "Предложи партнеру" (games/core.js: drawPhotoCard/goToPhotoSetup),
// но без уровней и без картинок — просто текстовые карточки вопрос/ответ из
// cards/cards_sex_coach_qa.js (SEX_COACH_QA_CARDS). Имена функций/переменных/id
// остались "ideas*" по историческим причинам (раньше здесь была игра
// "Идеи для вас" — теперь она переехала внутрь "Предложи партнеру" уровнем,
// см. games/core.js), но само содержимое игры — вопросы и ответы сексологов.
// Избранное в игре удалено — она про чтение вопросов/ответов, не про подбор.

let ideasCurrentCard = null;

function getIdeasPool(){
  return (typeof SEX_COACH_QA_CARDS !== 'undefined' && Array.isArray(SEX_COACH_QA_CARDS)) ? SEX_COACH_QA_CARDS : [];
}

function drawIdeaCard(){
  const pool = getIdeasPool();
  if(pool.length === 0){
    ideasCurrentCard = null;
    fadeSwapEl('ideasCard', (el)=>{
      el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon">💭</div><div class="card-text">Вопросы скоро появятся — добавьте их в cards_sex_coach_qa.js</div></div></div>`;
    });
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
}

function goToIdeasGame(){
  goToGame('setup', 'ideasGame');
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
document.getElementById('ideasExitBtn').addEventListener('click', ()=>{ exitIdeasGame(); });
openRulesModal('ideasGameRulesBtn', 'ideasRulesModal');
setupRulesModal('ideasRulesModal', 'closeIdeasRulesBtn');


