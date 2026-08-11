// games/kids-memes.js — детская версия игры "Мемасики" (дети).
// Загружается через <script src="games/kids-memes.js"></script> в index.html.
// Дублирует games/memes.js (та же механика: текстовая карточка-ситуация,
// без таймера и счёта, "Далее"/"Скрыть"), только уровень берётся из общего
// переключателя возраста #kidsAgeGroup (state.kidsAge), а не из своего
// селектора, и используются задания из cards_kids_memes.js.

let kidsMemesCurrentCard = null;
function getKidsMemesCardsList(level){
  if(typeof KIDS_MEMES_CARDS === 'undefined' || !Array.isArray(KIDS_MEMES_CARDS)) return [];
  return KIDS_MEMES_CARDS.filter(c=>c.level===level);
}
function goToKidsMemesSetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('kidsMemesSetup').classList.add('active');
}
function exitKidsMemesSetup(){
  document.getElementById('kidsMemesSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}
function drawKidsMemesCard(){
  const level = state.kidsAge || 2;
  const all = getKidsMemesCardsList(level);
  const hidden = state.kidsMemesHidden || [];
  const visible = all.filter(c=>!hidden.includes(c.text));
  if(visible.length === 0){
    kidsMemesCurrentCard = null;
    stopKidsMemesSpeech();
    fadeSwapEl('kidsMemesCard', (el)=>{
      el.className = 'card';
      el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-text memes-situation">Все ситуации этого возраста скрыты — сбросьте прогресс в настройках</div></div></div>`;
    });
    return;
  }
  if(!state.kidsMemesUsed) state.kidsMemesUsed = {};
  let used = (state.kidsMemesUsed[level] || []).filter(t=>!hidden.includes(t));
  let pool = visible.filter(c=>!used.includes(c.text));
  if(pool.length === 0){
    pool = visible;
    used = [];
    showToast('Ситуации этого возраста показаны заново 🔀');
  }
  const card = pool[Math.floor(Math.random()*pool.length)];
  used.push(card.text);
  state.kidsMemesUsed[level] = used;
  saveState();
  kidsMemesCurrentCard = card;
  stopKidsMemesSpeech();
  fadeSwapEl('kidsMemesCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-text memes-situation">${card.text}</div></div></div><div class="memes-tts-hint" id="kidsMemesTtsHint">🔊</div>`;
  });
}
function pickKidsMemesFemaleVoice(){
  if(!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const ru = voices.filter(v=>/^ru/i.test(v.lang));
  const pool = ru.length ? ru : voices;
  const female = pool.find(v=>/female|женск|milena|olga|katya/i.test(v.name));
  return female || pool[0] || null;
}
function stopKidsMemesSpeech(){
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  const hint = document.getElementById('kidsMemesTtsHint');
  if(hint) hint.classList.remove('speaking');
}
function speakKidsMemesCard(){
  if(!kidsMemesCurrentCard || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(stripQuotesForSpeech(kidsMemesCurrentCard.text));
  utter.lang = 'ru-RU';
  utter.rate = 0.95;
  const voice = pickKidsMemesFemaleVoice();
  if(voice) utter.voice = voice;
  const hint = document.getElementById('kidsMemesTtsHint');
  if(hint) hint.classList.add('speaking');
  utter.onend = ()=>{ if(hint) hint.classList.remove('speaking'); };
  utter.onerror = ()=>{ if(hint) hint.classList.remove('speaking'); };
  window.speechSynthesis.speak(utter);
}
document.getElementById('kidsMemesCard').addEventListener('click', ()=>{
  speakKidsMemesCard();
});
function goToKidsMemesGame(){
  document.getElementById('kidsMemesSetup').classList.remove('active');
  document.getElementById('kidsMemesGame').classList.add('active');
  drawKidsMemesCard();
  updateMuteBtn();
  requestWakeLock();
}
function exitKidsMemesGame(){
  stopKidsMemesSpeech();
  document.getElementById('kidsMemesGame').classList.remove('active');
  document.getElementById('kidsMemesSetup').classList.add('active');
}
document.getElementById('kidsMemesSetupStartBtn').addEventListener('click', ()=>{ goToKidsMemesGame(); });
document.getElementById('kidsMemesSetupExitBtn').addEventListener('click', ()=>{ exitKidsMemesSetup(); });
document.getElementById('kidsMemesNextBtn').addEventListener('click', ()=>{
  playSuccessSound();
  drawKidsMemesCard();
});
document.getElementById('kidsMemesHideBtn').addEventListener('click', ()=>{
  if(!kidsMemesCurrentCard) return;
  if(!state.kidsMemesHidden) state.kidsMemesHidden = [];
  if(!state.kidsMemesHidden.includes(kidsMemesCurrentCard.text)) state.kidsMemesHidden.push(kidsMemesCurrentCard.text);
  saveState();
  playErrorSound();
  showToast('Ситуация скрыта навсегда 🚫');
  drawKidsMemesCard();
});
document.getElementById('kidsMemesExitBtn').addEventListener('click', ()=>{ exitKidsMemesGame(); });
document.getElementById('kidsMemesSetupRulesBtn').addEventListener('click', ()=>{ document.getElementById('kidsMemesRulesModal').classList.add('show'); });
document.getElementById('closeKidsMemesRulesBtn').addEventListener('click', ()=>{ document.getElementById('kidsMemesRulesModal').classList.remove('show'); });
document.getElementById('kidsMemesRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'kidsMemesRulesModal') e.currentTarget.classList.remove('show'); });
