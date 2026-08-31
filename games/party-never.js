// games/party-never.js — Игра «Я никогда не» (компания).
// Загружается через <script src="games/party-never.js"></script> в index.html.
// Простые текстовые карточки-фразы без таймера и счёта — тот же паттерн,
// что и "Мемасики" (games/memes.js): выбрал уровень, дальше "Далее" тянет
// новую случайную фразу без повторов, пока не кончится пул уровня.

let partyNeverCurrentCard = null;
function getPartyNeverCardsList(level){
  if(typeof PARTY_NEVER_CARDS === 'undefined' || !Array.isArray(PARTY_NEVER_CARDS)) return [];
  return PARTY_NEVER_CARDS.filter(c=>c.level===level);
}
function renderPartyNeverSetupLevels(){
  const wrap = document.getElementById('partyNeverSetupLevels');
  if(!wrap) return;
  wrap.innerHTML = '';
  (typeof PARTY_NEVER_LEVELS !== 'undefined' ? PARTY_NEVER_LEVELS : []).forEach(l=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + (state.partyNeverSelectedLevel === l.id ? ' on' : '');
    div.innerHTML = `<div class="lname">${l.icon} ${l.name}</div><div class="ldesc">${l.desc}</div><div class="level-check"></div>`;
    div.addEventListener('click', ()=>{
      state.partyNeverSelectedLevel = l.id;
      saveState();
      renderPartyNeverSetupLevels();
    });
    wrap.appendChild(div);
  });
}
function goToPartyNeverSetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('partyNeverSetup').classList.add('active');
  renderPartyNeverSetupLevels();
}
function exitPartyNeverSetup(){
  document.getElementById('partyNeverSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('companyView');
}
function drawPartyNeverCard(){
  const level = state.partyNeverSelectedLevel || 1;
  const all = getPartyNeverCardsList(level);
  if(all.length === 0){
    partyNeverCurrentCard = null;
    fadeSwapEl('partyNeverCard', (el)=>{
      el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-text partynever-text">Для этого уровня пока нет фраз</div></div></div>`;
    });
    return;
  }
  if(!state.partyNeverUsed) state.partyNeverUsed = {};
  let used = state.partyNeverUsed[level] || [];
  let pool = all.filter(c=>!used.includes(c.text));
  if(pool.length === 0){
    pool = all;
    used = [];
    showToast('Фразы этого уровня показаны заново 🔀');
  }
  const card = pool[Math.floor(Math.random()*pool.length)];
  used.push(card.text);
  state.partyNeverUsed[level] = used;
  saveState();
  partyNeverCurrentCard = card;
  fadeSwapEl('partyNeverCard', (el)=>{
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-text partynever-text">${card.text}</div></div></div>`;
  });
}
function goToPartyNeverGame(){
  document.getElementById('partyNeverSetup').classList.remove('active');
  document.getElementById('partyNeverGame').classList.add('active');
  drawPartyNeverCard();
  updateMuteBtn();
  requestWakeLock();
}
function exitPartyNeverGame(){
  document.getElementById('partyNeverGame').classList.remove('active');
  document.getElementById('partyNeverSetup').classList.add('active');
}
document.getElementById('partyNeverSetupStartBtn').addEventListener('click', ()=>{ playSuccessSound(); goToPartyNeverGame(); });
document.getElementById('partyNeverSetupExitBtn').addEventListener('click', ()=>{ exitPartyNeverSetup(); });
document.getElementById('partyNeverNextBtn').addEventListener('click', ()=>{
  playSuccessSound();
  drawPartyNeverCard();
});
document.getElementById('partyNeverExitBtn').addEventListener('click', ()=>{ exitPartyNeverGame(); });
(document.getElementById('partyNeverSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ document.getElementById('partyNeverRulesModal').classList.add('show'); });
document.getElementById('closePartyNeverRulesBtn').addEventListener('click', ()=>{ document.getElementById('partyNeverRulesModal').classList.remove('show'); });
document.getElementById('partyNeverRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'partyNeverRulesModal') e.currentTarget.classList.remove('show'); });
