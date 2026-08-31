// games/solo-quiz.js — Игра "Викторина" (для одного).
// Загружается через <script src="games/solo-quiz.js"></script> в index.html.
// Упрощённая копия games/party-quiz.js: тот же формат вопросов и тот же
// банк вопросов (PARTY_QUIZ_LEVELS/PARTY_QUIZ_CARDS), но без списка игроков
// и без передачи хода — один человек отвечает на все вопросы подряд.
// Простой выход без общего меню паузы (тот же принцип, что у детских игр).

let soloQuizIntervalId = null;
let soloQuizDeadline = 0;
let soloQuizDurationMs = 3000;
let soloQuizAnswered = false;
let soloQuizQuestionStartedAt = 0;
let soloQuizCurrentOptions = [];
let soloQuizShowingQuestion = false;

function getSoloQuizCardsList(level){
  if(typeof PARTY_QUIZ_CARDS === 'undefined' || !Array.isArray(PARTY_QUIZ_CARDS)) return [];
  return PARTY_QUIZ_CARDS.filter(c=>c.level===level);
}
// В детском режиме (см. isKidsModeRestricted в games/core.js) прячем уровни
// "18+" и "Пошлые" — Викторина "для одного" использует общий банк вопросов
// компании, где эти уровни идут вперемешку с семейными.
function renderSoloQuizSetupLevels(){
  const wrap = document.getElementById('soloQuizSetupLevels');
  if(!wrap) return;
  wrap.innerHTML = '';
  const kidsMode = typeof isKidsModeRestricted === 'function' && isKidsModeRestricted();
  const allLevels = typeof PARTY_QUIZ_LEVELS !== 'undefined' ? PARTY_QUIZ_LEVELS : [];
  const levels = kidsMode ? allLevels.filter(l=>l.id !== 3 && l.id !== 4) : allLevels;
  if(kidsMode && !levels.some(l=>l.id === state.soloQuizSelectedLevel)){
    state.soloQuizSelectedLevel = levels.length ? levels[0].id : 1;
    saveState();
  }
  levels.forEach(l=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + (state.soloQuizSelectedLevel === l.id ? ' on' : '');
    div.innerHTML = `<div class="lname">${l.icon} ${l.name}</div><div class="ldesc">${l.desc}</div><div class="level-check"></div>`;
    div.addEventListener('click', ()=>{
      state.soloQuizSelectedLevel = l.id;
      saveState();
      renderSoloQuizSetupLevels();
    });
    wrap.appendChild(div);
  });
}
function renderSoloQuizAnswerTimeGroup(){
  if(![10,15,20].includes(state.soloQuizAnswerSeconds)){ state.soloQuizAnswerSeconds = 15; saveState(); }
  document.querySelectorAll('#soloQuizAnswerTimeGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (state.soloQuizAnswerSeconds || 15));
  });
}
document.querySelectorAll('#soloQuizAnswerTimeGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.soloQuizAnswerSeconds = parseInt(btn.dataset.value, 10);
    saveState();
    renderSoloQuizAnswerTimeGroup();
  });
});
function renderSoloQuizQuestionCountGroup(){
  if(![5,10,15,20].includes(state.soloQuizQuestionCount)){ state.soloQuizQuestionCount = 10; saveState(); }
  document.querySelectorAll('#soloQuizQuestionCountGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (state.soloQuizQuestionCount || 10));
  });
}
document.querySelectorAll('#soloQuizQuestionCountGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.soloQuizQuestionCount = parseInt(btn.dataset.value, 10);
    saveState();
    renderSoloQuizQuestionCountGroup();
  });
});
function goToSoloQuizSetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('soloQuizSetup').classList.add('active');
  renderSoloQuizSetupLevels();
  renderSoloQuizAnswerTimeGroup();
  renderSoloQuizQuestionCountGroup();
}
function exitSoloQuizSetup(){
  document.getElementById('soloQuizSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}
function stopSoloQuizInterval(){
  if(soloQuizIntervalId){ clearInterval(soloQuizIntervalId); soloQuizIntervalId = null; }
}
function updateSoloQuizScoreUI(){
  const el = document.getElementById('soloQuizScoreRow');
  if(el) el.textContent = `✅ Верно: ${state.soloQuizCorrect || 0}`;
}
function updateSoloQuizProgressBar(){
  const fill = document.getElementById('soloQuizProgressFill');
  const label = document.getElementById('soloQuizProgressLabel');
  if(!fill || !label) return;
  const total = state.soloQuizQuestionCount || 10;
  const done = state.soloQuizIndex || 0;
  const pct = total > 0 ? Math.round((done/total)*100) : 0;
  fill.style.width = pct + '%';
  label.textContent = `${done} / ${total}`;
}
function updateSoloQuizBar(remainingMs, totalMs){
  const fill = document.getElementById('soloQuizBarFill');
  if(!fill) return;
  const pct = totalMs > 0 ? Math.max(0, Math.round((remainingMs/totalMs)*100)) : 0;
  fill.style.width = pct + '%';
}
function drawSoloQuizQueue(){
  const level = state.soloQuizSelectedLevel || 1;
  const all = getSoloQuizCardsList(level);
  const total = state.soloQuizQuestionCount || 10;
  if(all.length === 0){
    state.soloQuizQueue = [];
    state.soloQuizIndex = 0;
    saveState();
    return;
  }
  if(!state.soloQuizUsed) state.soloQuizUsed = {};
  let used = state.soloQuizUsed[level] || [];
  let pool = shuffle(all.filter(c=>!used.includes(c.q)));
  const chosen = [];
  let recycled = false;
  while(chosen.length < total){
    if(pool.length === 0){
      pool = shuffle(all);
      used = [];
      if(!recycled){ showToast('Вопросы этого уровня показаны заново 🔀'); recycled = true; }
    }
    const take = Math.min(pool.length, total - chosen.length);
    const part = pool.slice(0, take);
    chosen.push(...part);
    part.forEach(c=>used.push(c.q));
    pool = pool.slice(take);
  }
  state.soloQuizUsed[level] = used;
  state.soloQuizQueue = chosen;
  state.soloQuizIndex = 0;
  saveState();
}
function showSoloQuizQuestion(){
  stopSoloQuizInterval();
  stopSoloQuizSpeech();
  const item = state.soloQuizQueue[state.soloQuizIndex];
  if(!item){
    soloQuizShowingQuestion = false;
    fadeSwapEl('soloQuizCard', (el)=>{
      el.className = 'card card-empty';
      el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon">🎯</div><div class="card-text">Не удалось загрузить вопросы — попробуйте обновить приложение</div></div></div>`;
    });
    return;
  }
  soloQuizAnswered = false;
  const opts = [
    {text:item.a[0], correct:true},
    {text:item.a[1], correct:false},
    {text:item.a[2], correct:false},
    {text:item.a[3], correct:false},
  ];
  soloQuizCurrentOptions = shuffle(opts);
  soloQuizQuestionStartedAt = Date.now();
  soloQuizDurationMs = (state.soloQuizAnswerSeconds || 10) * 1000;
  soloQuizDeadline = soloQuizQuestionStartedAt + soloQuizDurationMs;
  fadeSwapEl('soloQuizCard', (el)=>{
    el.className = 'card';
    const answersHtml = soloQuizCurrentOptions.map((o,i)=>`<button type="button" class="btn btn-secondary znayu-answer-btn" data-idx="${i}">${o.text}</button>`).join('');
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="znayu-question-text">${item.q}</div></div><div class="znayu-answers">${answersHtml}</div><div class="quiz-tts-hint" id="soloQuizTtsHint">🔊</div></div>`;
    el.querySelectorAll('.znayu-answer-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        answerSoloQuizQuestion(parseInt(btn.dataset.idx, 10));
      });
    });
  });
  soloQuizShowingQuestion = true;
  const barTrack = document.getElementById('soloQuizBarTrack');
  if(barTrack) barTrack.style.display = '';
  updateSoloQuizBar(soloQuizDurationMs, soloQuizDurationMs);
  updateSoloQuizScoreUI();
  updateSoloQuizProgressBar();
  updateSoloQuizAutoSpeakBtn();
  if(state.soloQuizAutoSpeak) speakSoloQuizCard();
  soloQuizIntervalId = setInterval(soloQuizTick, 100);
}
function soloQuizTick(){
  const remaining = soloQuizDeadline - Date.now();
  updateSoloQuizBar(Math.max(0, remaining), soloQuizDurationMs);
  if(remaining <= 0){
    stopSoloQuizInterval();
    if(!soloQuizAnswered) answerSoloQuizQuestion(-1);
  }
}
function answerSoloQuizQuestion(choiceIdx){
  if(soloQuizAnswered) return;
  soloQuizAnswered = true;
  stopSoloQuizInterval();
  const elapsed = Math.min(Date.now() - soloQuizQuestionStartedAt, soloQuizDurationMs);
  state.soloQuizTimeMs = (state.soloQuizTimeMs || 0) + elapsed;
  const isCorrect = choiceIdx >= 0 && soloQuizCurrentOptions[choiceIdx] && soloQuizCurrentOptions[choiceIdx].correct;
  if(isCorrect){
    state.soloQuizCorrect = (state.soloQuizCorrect || 0) + 1;
    playSuccessSound();
  } else {
    playFailSound();
    if(choiceIdx < 0) showToast('⏰ Время вышло — ответ не выбран, засчитано как неверно');
  }
  document.querySelectorAll('#soloQuizCard .znayu-answer-btn').forEach((btn, i)=>{
    btn.disabled = true;
    if(soloQuizCurrentOptions[i] && soloQuizCurrentOptions[i].correct) btn.classList.add('answer-correct');
    else if(i === choiceIdx) btn.classList.add('answer-wrong');
  });
  saveState();
  updateSoloQuizScoreUI();
  setTimeout(advanceSoloQuizQueue, 900);
}
function advanceSoloQuizQueue(){
  state.soloQuizIndex = (state.soloQuizIndex || 0) + 1;
  saveState();
  if(state.soloQuizIndex >= state.soloQuizQueue.length){
    showSoloQuizSummaryModal();
    return;
  }
  showSoloQuizQuestion();
}
function fmtSoloQuizTime(ms){
  return (ms/1000).toFixed(1).replace('.', ',') + ' сек';
}
function showSoloQuizSummaryModal(){
  const total = state.soloQuizQuestionCount || 10;
  const correct = state.soloQuizCorrect || 0;
  document.getElementById('soloQuizSummaryIntro').textContent = `Верно: ${correct} из ${total} · Общее время: ${fmtSoloQuizTime(state.soloQuizTimeMs || 0)}`;
  document.getElementById('soloQuizSummaryModal').classList.add('show');
}
function goToSoloQuizGame(){
  state.soloQuizCorrect = 0;
  state.soloQuizTimeMs = 0;
  state.soloQuizUsed = state.soloQuizUsed || {};
  state.soloQuizUsed[state.soloQuizSelectedLevel || 1] = [];
  drawSoloQuizQueue();
  document.getElementById('soloQuizSetup').classList.remove('active');
  document.getElementById('soloQuizGame').classList.add('active');
  updateMuteBtn();
  requestWakeLock();
  showSoloQuizQuestion();
}
function exitSoloQuizGame(){
  stopSoloQuizInterval();
  stopSoloQuizSpeech();
  document.getElementById('soloQuizSummaryModal').classList.remove('show');
  document.getElementById('soloQuizGame').classList.remove('active');
  document.getElementById('soloQuizSetup').classList.add('active');
}
/* ===== Озвучка вопроса по тапу — тот же приём, что в party-quiz.js ===== */
function pickSoloQuizVoice(){
  if(!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const ru = voices.filter(v=>/^ru/i.test(v.lang));
  const pool = ru.length ? ru : voices;
  const female = pool.find(v=>/female|женск|milena|olga|katya/i.test(v.name));
  return female || pool[0] || null;
}
function stopSoloQuizSpeech(){
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  const hint = document.getElementById('soloQuizTtsHint');
  if(hint) hint.classList.remove('speaking');
}
function speakSoloQuizCard(){
  const item = state.soloQuizQueue && state.soloQuizQueue[state.soloQuizIndex];
  if(!item || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  const text = typeof stripQuotesForSpeech === 'function' ? stripQuotesForSpeech(item.q) : item.q;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ru-RU';
  utter.rate = 0.95;
  const voice = pickSoloQuizVoice();
  if(voice) utter.voice = voice;
  const hint = document.getElementById('soloQuizTtsHint');
  const fire = ()=>{
    const current = state.soloQuizQueue && state.soloQuizQueue[state.soloQuizIndex];
    if(current !== item) return; // вопрос уже сменился — не озвучиваем устаревший текст
    if(hint) hint.classList.add('speaking');
    utter.onend = ()=>{ if(hint) hint.classList.remove('speaking'); };
    utter.onerror = ()=>{ if(hint) hint.classList.remove('speaking'); };
    synth.speak(utter);
  };
  // speak(), вызванный сразу вслед за cancel() в тот же тик, иногда молча
  // "проглатывается" браузером — но задержка перед КАЖДЫМ speak() на
  // мобильных браузерах рвёт связь с пользовательским жестом, и озвучка
  // перестаёт работать вообще. Поэтому если движок сейчас свободен — говорим
  // сразу и синхронно; отменяем и ждём короткую паузу, только если правда
  // нужно прервать уже звучащую фразу (смена вопроса на лету).
  if(synth.speaking || synth.pending){
    synth.cancel();
    setTimeout(fire, 50);
  } else {
    fire();
  }
}
function updateSoloQuizAutoSpeakBtn(){
  const btn = document.getElementById('soloQuizAutoSpeakBtn');
  if(!btn) return;
  btn.classList.toggle('on', !!state.soloQuizAutoSpeak);
}
document.getElementById('soloQuizAutoSpeakBtn').addEventListener('click', ()=>{
  state.soloQuizAutoSpeak = !state.soloQuizAutoSpeak;
  saveState();
  updateSoloQuizAutoSpeakBtn();
  playSuccessSound();
  if(state.soloQuizAutoSpeak && soloQuizShowingQuestion) speakSoloQuizCard();
});
document.getElementById('soloQuizCard').addEventListener('click', (e)=>{
  if(e.target.closest('.znayu-answer-btn')) return;
  if(!soloQuizShowingQuestion) return;
  speakSoloQuizCard();
});
document.getElementById('soloQuizSetupStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  goToSoloQuizGame();
});
document.getElementById('soloQuizSetupExitBtn').addEventListener('click', ()=>{ exitSoloQuizSetup(); });
document.getElementById('soloQuizExitBtn').addEventListener('click', ()=>{ exitSoloQuizGame(); });
document.getElementById('closeSoloQuizSummaryBtn').addEventListener('click', ()=>{ exitSoloQuizGame(); });
(document.getElementById('soloQuizSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ document.getElementById('soloQuizRulesModal').classList.add('show'); });
document.getElementById('closeSoloQuizRulesBtn').addEventListener('click', ()=>{ document.getElementById('soloQuizRulesModal').classList.remove('show'); });
document.getElementById('soloQuizRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'soloQuizRulesModal') e.currentTarget.classList.remove('show'); });
