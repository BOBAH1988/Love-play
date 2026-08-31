// games/party-quiz.js — Игра "Викторина" (компания).
// Загружается через <script src="games/party-quiz.js"></script> в index.html.
// Копия games/quiz.js, только вопросы задаются по очереди всем игрокам из
// state.partyPlayers (2-10 человек, тот же список, что у "Крокодила"), а не
// строго двум — и данные берутся из PARTY_QUIZ_LEVELS/PARTY_QUIZ_CARDS.

let partyQuizIntervalId = null;
let partyQuizDeadline = 0;
let partyQuizDurationMs = 3000;
let partyQuizAnswered = false;
let partyQuizQuestionStartedAt = 0;
let partyQuizCurrentOptions = [];
// Пока true — по карточке показан именно вопрос (не хендофф и не заглушка),
// поэтому тап по ней озвучивает текст задания (см. speakPartyQuizCard).
let partyQuizShowingQuestion = false;

function getPartyQuizCardsList(level){
  if(typeof PARTY_QUIZ_CARDS === 'undefined' || !Array.isArray(PARTY_QUIZ_CARDS)) return [];
  return PARTY_QUIZ_CARDS.filter(c=>c.level===level);
}
function renderPartyQuizSetupLevels(){
  const wrap = document.getElementById('partyQuizSetupLevels');
  if(!wrap) return;
  wrap.innerHTML = '';
  (typeof PARTY_QUIZ_LEVELS !== 'undefined' ? PARTY_QUIZ_LEVELS : []).forEach(l=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + (state.partyQuizSelectedLevel === l.id ? ' on' : '');
    div.innerHTML = `<div class="lname">${l.icon} ${l.name}</div><div class="ldesc">${l.desc}</div><div class="level-check"></div>`;
    div.addEventListener('click', ()=>{
      state.partyQuizSelectedLevel = l.id;
      saveState();
      renderPartyQuizSetupLevels();
    });
    wrap.appendChild(div);
  });
}
function renderPartyQuizAnswerTimeGroup(){
  if(![10,15,20].includes(state.partyQuizAnswerSeconds)){ state.partyQuizAnswerSeconds = 15; saveState(); }
  document.querySelectorAll('#partyQuizAnswerTimeGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (state.partyQuizAnswerSeconds || 15));
  });
}
document.querySelectorAll('#partyQuizAnswerTimeGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.partyQuizAnswerSeconds = parseInt(btn.dataset.value, 10);
    saveState();
    renderPartyQuizAnswerTimeGroup();
  });
});
// partyQuizQuestionCount — сколько вопросов задаётся КАЖДОМУ игроку подряд
// (не общее число вопросов на партию — см. drawPartyQuizQueue/advancePartyQuizQueue).
function renderPartyQuizQuestionCountGroup(){
  if(![3,5,7,10].includes(state.partyQuizQuestionCount)){ state.partyQuizQuestionCount = 5; saveState(); }
  document.querySelectorAll('#partyQuizQuestionCountGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (state.partyQuizQuestionCount || 5));
  });
}
document.querySelectorAll('#partyQuizQuestionCountGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.partyQuizQuestionCount = parseInt(btn.dataset.value, 10);
    saveState();
    renderPartyQuizQuestionCountGroup();
  });
});
function goToPartyQuizSetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('partyQuizSetup').classList.add('active');
  renderPartyQuizSetupLevels();
  renderPartyQuizAnswerTimeGroup();
  renderPartyQuizQuestionCountGroup();
}
function exitPartyQuizSetup(){
  document.getElementById('partyQuizSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('companyView');
}
function partyQuizPlayersList(){
  if(!state.partyPlayers || state.partyPlayers.length < 2) state.partyPlayers = ['Игрок 1','Игрок 2'];
  return state.partyPlayers;
}
function stopPartyQuizInterval(){
  if(partyQuizIntervalId){ clearInterval(partyQuizIntervalId); partyQuizIntervalId = null; }
}
function updatePartyQuizScoreUI(){
  const players = partyQuizPlayersList();
  const correct = state.partyQuizCorrect || [];
  const idx = state.partyQuizCurrentPlayerIndex || 0;
  const wrap = document.getElementById('partyQuizScoreRow');
  if(wrap){
    wrap.innerHTML = '';
    players.forEach((name, i)=>{
      const span = document.createElement('span');
      span.className = 'krokodil-score-item' + (i === idx ? ' active' : '');
      span.textContent = name + ': ' + (correct[i] || 0);
      wrap.appendChild(span);
    });
  }
  const turnLabel = document.getElementById('partyQuizTurnLabel');
  if(turnLabel) turnLabel.textContent = 'Отвечает: ' + (players[idx] || 'Игрок 1');
}
// Прогресс-бар показывает продвижение ТЕКУЩЕГО игрока по его собственным
// вопросам (0..partyQuizQuestionCount), а не по всей партии.
function updatePartyQuizProgressBar(){
  const fill = document.getElementById('partyQuizProgressFill');
  const label = document.getElementById('partyQuizProgressLabel');
  if(!fill || !label) return;
  const perPlayer = state.partyQuizQuestionCount || 5;
  const done = (state.partyQuizIndex || 0) % perPlayer;
  const pct = perPlayer > 0 ? Math.round((done/perPlayer)*100) : 0;
  fill.style.width = pct + '%';
  label.textContent = `${done} / ${perPlayer}`;
}
function updatePartyQuizBar(remainingMs, totalMs){
  const fill = document.getElementById('partyQuizBarFill');
  if(!fill) return;
  const pct = totalMs > 0 ? Math.max(0, Math.round((remainingMs/totalMs)*100)) : 0;
  fill.style.width = pct + '%';
}
// Общая длина очереди = partyQuizQuestionCount (вопросов НА игрока) × число
// игроков — первые partyQuizQuestionCount вопросов достаются игроку 0,
// следующие — игроку 1 и т.д. (см. advancePartyQuizQueue). Если общая длина
// очереди больше пула уровня, пул зацикливается заново с перемешиванием.
function drawPartyQuizQueue(){
  const level = state.partyQuizSelectedLevel || 1;
  const all = getPartyQuizCardsList(level);
  const perPlayer = state.partyQuizQuestionCount || 5;
  const numPlayers = partyQuizPlayersList().length || 1;
  const total = perPlayer * numPlayers;
  if(all.length === 0){
    state.partyQuizQueue = [];
    state.partyQuizIndex = 0;
    saveState();
    return;
  }
  if(!state.partyQuizUsed) state.partyQuizUsed = {};
  let used = state.partyQuizUsed[level] || [];
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
  state.partyQuizUsed[level] = used;
  state.partyQuizQueue = chosen;
  state.partyQuizIndex = 0;
  saveState();
}
function showPartyQuizHandoffCard(){
  stopPartyQuizInterval();
  stopPartyQuizSpeech();
  partyQuizShowingQuestion = false;
  const players = partyQuizPlayersList();
  const idx = state.partyQuizCurrentPlayerIndex || 0;
  const name = players[idx] || 'Игрок 1';
  const row = document.getElementById('partyQuizHandoffRow');
  if(row) row.style.display = 'flex';
  const barTrack = document.getElementById('partyQuizBarTrack');
  if(barTrack) barTrack.style.display = 'none';
  fadeSwapEl('partyQuizCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon znayu-handoff-icon">🎯</div><div class="card-text">Передайте телефон игроку «${name}»</div></div></div>`;
  });
  updatePartyQuizScoreUI();
  updatePartyQuizProgressBar();
}
function showPartyQuizQuestion(){
  stopPartyQuizInterval();
  stopPartyQuizSpeech();
  const row = document.getElementById('partyQuizHandoffRow');
  if(row) row.style.display = 'none';
  const item = state.partyQuizQueue[state.partyQuizIndex];
  if(!item){
    partyQuizShowingQuestion = false;
    fadeSwapEl('partyQuizCard', (el)=>{
      el.className = 'card card-empty';
      el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon">🎯</div><div class="card-text">Не удалось загрузить вопросы — попробуйте обновить приложение</div></div></div>`;
    });
    return;
  }
  partyQuizAnswered = false;
  const opts = [
    {text:item.a[0], correct:true},
    {text:item.a[1], correct:false},
    {text:item.a[2], correct:false},
    {text:item.a[3], correct:false},
  ];
  partyQuizCurrentOptions = shuffle(opts);
  partyQuizQuestionStartedAt = Date.now();
  partyQuizDurationMs = (state.partyQuizAnswerSeconds || 10) * 1000;
  partyQuizDeadline = partyQuizQuestionStartedAt + partyQuizDurationMs;
  fadeSwapEl('partyQuizCard', (el)=>{
    el.className = 'card';
    const answersHtml = partyQuizCurrentOptions.map((o,i)=>`<button type="button" class="btn btn-secondary znayu-answer-btn" data-idx="${i}">${o.text}</button>`).join('');
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="znayu-question-text">${item.q}</div></div><div class="znayu-answers">${answersHtml}</div><div class="quiz-tts-hint" id="partyQuizTtsHint">🔊</div></div>`;
    el.querySelectorAll('.znayu-answer-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        answerPartyQuizQuestion(parseInt(btn.dataset.idx, 10));
      });
    });
  });
  partyQuizShowingQuestion = true;
  const barTrack = document.getElementById('partyQuizBarTrack');
  if(barTrack) barTrack.style.display = '';
  updatePartyQuizBar(partyQuizDurationMs, partyQuizDurationMs);
  updatePartyQuizScoreUI();
  updatePartyQuizProgressBar();
  if(state.autoSpeak) speakPartyQuizCard();
  partyQuizIntervalId = setInterval(partyQuizTick, 100);
}
function partyQuizTick(){
  const remaining = partyQuizDeadline - Date.now();
  updatePartyQuizBar(Math.max(0, remaining), partyQuizDurationMs);
  if(remaining <= 0){
    stopPartyQuizInterval();
    if(!partyQuizAnswered) answerPartyQuizQuestion(-1);
  }
}
function answerPartyQuizQuestion(choiceIdx){
  if(partyQuizAnswered) return;
  partyQuizAnswered = true;
  stopPartyQuizInterval();
  const elapsed = Math.min(Date.now() - partyQuizQuestionStartedAt, partyQuizDurationMs);
  const idx = state.partyQuizCurrentPlayerIndex || 0;
  if(!state.partyQuizCorrect) state.partyQuizCorrect = [];
  if(!state.partyQuizTimeMs) state.partyQuizTimeMs = [];
  state.partyQuizTimeMs[idx] = (state.partyQuizTimeMs[idx] || 0) + elapsed;
  const isCorrect = choiceIdx >= 0 && partyQuizCurrentOptions[choiceIdx] && partyQuizCurrentOptions[choiceIdx].correct;
  if(isCorrect){
    state.partyQuizCorrect[idx] = (state.partyQuizCorrect[idx] || 0) + 1;
    playSuccessSound();
  } else {
    playFailSound();
    // Явно сообщаем об истечении времени — зелёная подсветка верного варианта
    // ниже это просто подсказка "вот какой был правильный ответ", очко за
    // него НЕ начисляется (state.partyQuizCorrect не увеличивается), но без
    // этого тоста легко перепутать подсветку с "ответ засчитан верным".
    if(choiceIdx < 0) showToast('⏰ Время вышло — ответ не выбран, засчитано как неверно');
  }
  document.querySelectorAll('#partyQuizCard .znayu-answer-btn').forEach((btn, i)=>{
    btn.disabled = true;
    if(partyQuizCurrentOptions[i] && partyQuizCurrentOptions[i].correct) btn.classList.add('answer-correct');
    else if(i === choiceIdx) btn.classList.add('answer-wrong');
  });
  saveState();
  updatePartyQuizScoreUI();
  setTimeout(advancePartyQuizQueue, 900);
}
// Игрок отвечает на ВСЕ свои вопросы подряд (partyQuizQuestionCount штук)
// без хендоффа между ними — карточка "Передайте телефон" показывается
// только когда этот блок вопросов исчерпан и ход переходит следующему игроку.
function advancePartyQuizQueue(){
  state.partyQuizIndex = (state.partyQuizIndex || 0) + 1;
  const total = state.partyQuizQueue.length;
  if(state.partyQuizIndex >= total){
    saveState();
    showPartyQuizSummaryModal();
    return;
  }
  const perPlayer = state.partyQuizQuestionCount || 5;
  if(state.partyQuizIndex % perPlayer === 0){
    const n = partyQuizPlayersList().length || 1;
    state.partyQuizCurrentPlayerIndex = ((state.partyQuizCurrentPlayerIndex || 0) + 1) % n;
    saveState();
    showPartyQuizHandoffCard();
  } else {
    saveState();
    showPartyQuizQuestion();
  }
}
function fmtPartyQuizTime(ms){
  return (ms/1000).toFixed(1).replace('.', ',') + ' сек';
}
function showPartyQuizSummaryModal(){
  const players = partyQuizPlayersList();
  const correct = state.partyQuizCorrect || [];
  const timeMs = state.partyQuizTimeMs || [];
  const ranking = players.map((n,i)=>({n, correct: correct[i]||0, timeMs: timeMs[i]||0}))
    .sort((a,b)=> b.correct - a.correct || a.timeMs - b.timeMs);
  const medals = ['🥇','🥈','🥉'];
  // "из total" — сколько вопросов задавалось КАЖДОМУ игроку (partyQuizQuestionCount),
  // а не общая длина очереди на всю партию (которая = partyQuizQuestionCount × число игроков).
  const total = state.partyQuizQuestionCount || 5;
  let place = 1;
  const listHtml = ranking.map((r,i)=>{
    if(i === 0 || ranking[i-1].correct !== r.correct || ranking[i-1].timeMs !== r.timeMs){
      place = i + 1;
    }
    const placeLabel = medals[place-1] || `${place}.`;
    const isFirst = place === 1;
    return `
      <div class="krokodil-summary-row${isFirst ? ' krokodil-summary-first' : ''}">
        <span class="krokodil-summary-place">${placeLabel}</span>
        <span class="krokodil-summary-name">${r.n}</span>
        <span class="krokodil-summary-score">Верно: ${r.correct} из ${total}<br>Время: ${fmtPartyQuizTime(r.timeMs)}</span>
      </div>
    `;
  }).join('');
  document.getElementById('partyQuizSummaryList').innerHTML = listHtml;
  document.getElementById('partyQuizSummaryModal').classList.add('show');
}
function goToPartyQuizGame(){
  abandonPausedDavaySession();
  abandonPausedTdSession();
  abandonPausedBingoSession();
  abandonPausedKrokodilSession();
  abandonPausedWishlistSession();
  abandonPausedZnayuSession();
  abandonPausedTimerSession();
  abandonPausedPartyFantsSession();
  abandonPausedPartyTdSession();
  abandonPausedFamZnayuSession();
  abandonPausedLuckySession();
  abandonPausedKidsMemorySession();
  abandonPausedKidsTdSession();
  abandonPausedFantySession();
  abandonPausedQuizSession();
  abandonPausedKidsQuizSession();
  abandonPausedSoloBsSession();
  state.pausedMode = null;
  const players = partyQuizPlayersList();
  state.partyQuizCorrect = new Array(players.length).fill(0);
  state.partyQuizTimeMs = new Array(players.length).fill(0);
  state.partyQuizCurrentPlayerIndex = Math.floor(Math.random() * players.length);
  drawPartyQuizQueue();
  state.inProgress = true;
  saveState();
  document.getElementById('partyQuizSetup').classList.remove('active');
  document.getElementById('setup').classList.remove('active');
  document.getElementById('partyQuizGame').classList.add('active');
  updateMuteBtn();
  requestWakeLock();
  showPartyQuizHandoffCard();
}
function pausePartyQuizGame(){
  stopPartyQuizInterval();
  stopPartyQuizSpeech();
  state.pausedMode = 'partyQuiz';
  saveState();
  document.getElementById('partyQuizGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('companyView');
  updateResumeUI();
}
function resumePartyQuizGame(){
  state.pausedMode = null;
  saveState();
  updateResumeUI();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('partyQuizGame').classList.add('active');
  updateMuteBtn();
  requestWakeLock();
  showPartyQuizHandoffCard();
}
function finishPartyQuizGame(){
  stopPartyQuizInterval();
  stopPartyQuizSpeech();
  state.partyQuizCorrect = [];
  state.partyQuizTimeMs = [];
  state.partyQuizQueue = [];
  state.partyQuizIndex = 0;
  state.partyQuizCurrentPlayerIndex = 0;
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  updateResumeUI();
}
function exitPartyQuizGame(){
  if(typeof stopPartyQuizSpeech === 'function') stopPartyQuizSpeech();
  document.getElementById('partyQuizSummaryModal').classList.remove('show');
  finishPartyQuizGame();
  document.getElementById('partyQuizGame').classList.remove('active');
  document.getElementById('partyQuizSetup').classList.add('active');
}
// ===== Озвучка вопроса "Викторина" (по тапу на карточку) =====
// Тот же приём, что и в games/memes.js (speakMemesCard) — необязательная
// фича, если Web Speech API не поддерживается браузером, тап просто ничего
// не озвучивает и не мешает игре. stripQuotesForSpeech — общая утилита,
// определена в games/memes.js (тот файл гарантированно загружается раньше
// этого, см. порядок <script> в index.html).
function pickPartyQuizVoice(){
  if(!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const ru = voices.filter(v=>/^ru/i.test(v.lang));
  const pool = ru.length ? ru : voices;
  const female = pool.find(v=>/female|женск|milena|olga|katya/i.test(v.name));
  return female || pool[0] || null;
}
function stopPartyQuizSpeech(){
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  const hint = document.getElementById('partyQuizTtsHint');
  if(hint) hint.classList.remove('speaking');
}
function speakPartyQuizCard(){
  const item = state.partyQuizQueue && state.partyQuizQueue[state.partyQuizIndex];
  if(!item || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  const text = typeof stripQuotesForSpeech === 'function' ? stripQuotesForSpeech(item.q) : item.q;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ru-RU';
  utter.rate = 0.95;
  const voice = pickPartyQuizVoice();
  if(voice) utter.voice = voice;
  const hint = document.getElementById('partyQuizTtsHint');
  const fire = ()=>{
    const current = state.partyQuizQueue && state.partyQuizQueue[state.partyQuizIndex];
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
document.getElementById('partyQuizCard').addEventListener('click', (e)=>{
  if(e.target.closest('.znayu-answer-btn')) return;
  if(!partyQuizShowingQuestion) return;
  speakPartyQuizCard();
});
document.getElementById('partyQuizSetupStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  goToPartyQuizGame();
});
document.getElementById('partyQuizSetupExitBtn').addEventListener('click', ()=>{ exitPartyQuizSetup(); });
document.getElementById('partyQuizHandoffStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  showPartyQuizQuestion();
});
document.getElementById('partyQuizExitBtn').addEventListener('click', ()=>{
  pausePartyQuizGame();
  showToast('Игра на паузе — прогресс сохранён');
});
document.getElementById('closePartyQuizSummaryBtn').addEventListener('click', ()=>{ exitPartyQuizGame(); });
(document.getElementById('partyQuizSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ document.getElementById('partyQuizRulesModal').classList.add('show'); });
document.getElementById('closePartyQuizRulesBtn').addEventListener('click', ()=>{ document.getElementById('partyQuizRulesModal').classList.remove('show'); });
document.getElementById('partyQuizRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'partyQuizRulesModal') e.currentTarget.classList.remove('show'); });
