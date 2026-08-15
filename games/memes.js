// games/memes.js — Игра "Мемасики" (компания).
// Загружается через <script src="games/memes.js"></script> в index.html.

/* ---------- МЕМАСИКИ (текстовые карточки-ситуации, без таймера и счёта) ---------- */
let memesCurrentCard = null;
function getMemesCardsList(level){
  if(typeof MEMES_CARDS === 'undefined' || !Array.isArray(MEMES_CARDS)) return [];
  return MEMES_CARDS.filter(c=>c.level===level);
}
function renderMemesSetupLevels(){
  const wrap = document.getElementById('memesSetupLevels');
  if(!wrap) return;
  wrap.innerHTML = '';
  (typeof MEMES_LEVELS !== 'undefined' ? MEMES_LEVELS : []).forEach(l=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + (state.memesSelectedLevel === l.id ? ' on' : '');
    div.innerHTML = `<div class="lname">${l.icon} ${l.name}</div><div class="ldesc">${l.desc}</div><div class="level-check"></div>`;
    div.addEventListener('click', ()=>{
      state.memesSelectedLevel = l.id;
      saveState();
      renderMemesSetupLevels();
    });
    wrap.appendChild(div);
  });
}
function goToMemesSetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('memesSetup').classList.add('active');
  renderMemesSetupLevels();
}
function exitMemesSetup(){
  document.getElementById('memesSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}
function drawMemesCard(){
  const level = state.memesSelectedLevel || 1;
  const all = getMemesCardsList(level);
  const hidden = state.memesHidden || [];
  const visible = all.filter(c=>!hidden.includes(c.text));
  if(visible.length === 0){
    memesCurrentCard = null;
    stopMemesSpeech();
    fadeSwapEl('memesCard', (el)=>{
      el.className = 'card';
      el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-text memes-situation">Все ситуации этого уровня скрыты — сбросьте прогресс в настройках</div></div></div>`;
    });
    return;
  }
  if(!state.memesUsed) state.memesUsed = {};
  let used = (state.memesUsed[level] || []).filter(t=>!hidden.includes(t));
  let pool = visible.filter(c=>!used.includes(c.text));
  if(pool.length === 0){
    pool = visible;
    used = [];
    showToast('Ситуации этого уровня показаны заново 🔀');
  }
  const card = pool[Math.floor(Math.random()*pool.length)];
  used.push(card.text);
  state.memesUsed[level] = used;
  saveState();
  memesCurrentCard = card;
  stopMemesSpeech();
  fadeSwapEl('memesCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-text memes-situation">${card.text}</div></div><div class="memes-tts-hint" id="memesTtsHint">🔊</div></div>`;
  });
  updateMemesAutoSpeakBtn();
  if(state.memesAutoSpeak) speakMemesCard();
}
// ===== Озвучка карточки "Мемасики" (по тапу на карточку) =====
// Необязательная фича: если браузер не поддерживает Web Speech API —
// ничего не делаем, тап просто ничего не озвучивает (кнопки "Далее"/
// "Скрыть" продолжают работать как обычно, это не мешает игре).
function pickMemesFemaleVoice(){
  if(!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const ru = voices.filter(v=>/^ru/i.test(v.lang));
  const pool = ru.length ? ru : voices;
  // Явных признаков пола голоса браузеры не дают — ищем по имени голоса
  // подсказки female/женский, иначе берём первый доступный русский голос.
  const female = pool.find(v=>/female|женск|milena|olga|katya/i.test(v.name));
  return female || pool[0] || null;
}
function stopMemesSpeech(){
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  const hint = document.getElementById('memesTtsHint');
  if(hint) hint.classList.remove('speaking');
}
// Синтезатор речи озвучивает символы кавычек (« » " " ' и т.п.) отдельным
// словом ("кавычки"), что режет слух — для самой озвучки убираем их из
// текста, а на самой карточке кавычки остаются видны как обычно.
function stripQuotesForSpeech(text){
  return (text || '').replace(/[«»"""'']/g, '').replace(/\s{2,}/g, ' ').trim();
}
function speakMemesCard(){
  if(!memesCurrentCard || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(stripQuotesForSpeech(memesCurrentCard.text));
  utter.lang = 'ru-RU';
  utter.rate = 0.95;
  const voice = pickMemesFemaleVoice();
  if(voice) utter.voice = voice;
  const hint = document.getElementById('memesTtsHint');
  if(hint) hint.classList.add('speaking');
  utter.onend = ()=>{ if(hint) hint.classList.remove('speaking'); };
  utter.onerror = ()=>{ if(hint) hint.classList.remove('speaking'); };
  window.speechSynthesis.speak(utter);
}
document.getElementById('memesCard').addEventListener('click', ()=>{
  speakMemesCard();
});
function updateMemesAutoSpeakBtn(){
  const btn = document.getElementById('memesAutoSpeakBtn');
  if(!btn) return;
  btn.classList.toggle('on', !!state.memesAutoSpeak);
}
document.getElementById('memesAutoSpeakBtn').addEventListener('click', ()=>{
  state.memesAutoSpeak = !state.memesAutoSpeak;
  saveState();
  updateMemesAutoSpeakBtn();
  playSuccessSound();
  if(state.memesAutoSpeak) speakMemesCard();
});
function goToMemesGame(){
  document.getElementById('memesSetup').classList.remove('active');
  document.getElementById('memesGame').classList.add('active');
  drawMemesCard();
  updateMuteBtn();
  requestWakeLock();
}
function exitMemesGame(){
  stopMemesSpeech();
  document.getElementById('memesGame').classList.remove('active');
  document.getElementById('memesSetup').classList.add('active');
}
document.getElementById('memesSetupStartBtn').addEventListener('click', ()=>{ goToMemesGame(); });
document.getElementById('memesSetupExitBtn').addEventListener('click', ()=>{ exitMemesSetup(); });
document.getElementById('memesNextBtn').addEventListener('click', ()=>{
  playSuccessSound();
  drawMemesCard();
});
document.getElementById('memesHideBtn').addEventListener('click', ()=>{
  if(!memesCurrentCard) return;
  if(!state.memesHidden) state.memesHidden = [];
  if(!state.memesHidden.includes(memesCurrentCard.text)) state.memesHidden.push(memesCurrentCard.text);
  saveState();
  playErrorSound();
  showToast('Ситуация скрыта навсегда 🚫');
  drawMemesCard();
});
document.getElementById('memesExitBtn').addEventListener('click', ()=>{ exitMemesGame(); });
document.getElementById('memesSetupRulesBtn').addEventListener('click', ()=>{ document.getElementById('memesRulesModal').classList.add('show'); });
document.getElementById('closeMemesRulesBtn').addEventListener('click', ()=>{ document.getElementById('memesRulesModal').classList.remove('show'); });
document.getElementById('memesRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'memesRulesModal') e.currentTarget.classList.remove('show'); });

