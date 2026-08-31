// games/kids-quiz.js — Игра "Викторина" (дети).
// Загружается через <script src="games/kids-quiz.js"></script> в index.html.
// Копия games/quiz.js и games/party-quiz.js, только уровень заданий не
// выбирается на отдельном экране настройки, а берётся из общего
// переключателя возраста #kidsAgeGroup на экране "Игры с детьми" (тот же
// приём, что и в games/kids-td.js), а игроки — из state.kidsPlayers.

let kidsQuizIntervalId = null;
let kidsQuizDeadline = 0;
let kidsQuizDurationMs = 3000;
let kidsQuizAnswered = false;
let kidsQuizQuestionStartedAt = 0;
let kidsQuizCurrentOptions = [];
// Пока true — по карточке показан именно вопрос (не хендофф и не заглушка),
// поэтому тап по ней озвучивает текст задания (см. speakKidsQuizCard).
let kidsQuizShowingQuestion = false;

function getKidsQuizCardsList(level){
  if(typeof KIDS_QUIZ_CARDS === 'undefined' || !Array.isArray(KIDS_QUIZ_CARDS)) return [];
  return KIDS_QUIZ_CARDS.filter(c=>c.level===level);
}
// Инфо о текущем возрасте (иконка/название) — тот же приём, что kidsTdAgeInfo().
function kidsQuizAgeInfo(){
  const age = state.kidsAge || 1;
  const levels = typeof KIDS_TD_LEVELS !== 'undefined' ? KIDS_TD_LEVELS : [];
  return levels.find(l=>l.id===age) || null;
}
function updateKidsQuizSetupSubtitle(){
  const el = document.getElementById('kidsQuizSetupSubtitle');
  if(!el) return;
  const info = kidsQuizAgeInfo();
  el.textContent = info
    ? `Возраст: ${info.icon} ${info.name} — вопросы подобраны для этого возраста`
    : 'Отвечайте на вопросы по очереди — 4 варианта, только один верный';
}
function renderKidsQuizAnswerTimeGroup(){
  if(![10,15,20].includes(state.kidsQuizAnswerSeconds)){ state.kidsQuizAnswerSeconds = 15; saveState(); }
  document.querySelectorAll('#kidsQuizAnswerTimeGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (state.kidsQuizAnswerSeconds || 15));
  });
}
document.querySelectorAll('#kidsQuizAnswerTimeGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.kidsQuizAnswerSeconds = parseInt(btn.dataset.value, 10);
    saveState();
    renderKidsQuizAnswerTimeGroup();
  });
});
// kidsQuizQuestionCount — сколько вопросов задаётся КАЖДОМУ игроку подряд
// (не общее число вопросов на партию — см. drawKidsQuizQueue/advanceKidsQuizQueue).
function renderKidsQuizQuestionCountGroup(){
  if(![3,5,7,10].includes(state.kidsQuizQuestionCount)){ state.kidsQuizQuestionCount = 5; saveState(); }
  document.querySelectorAll('#kidsQuizQuestionCountGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (state.kidsQuizQuestionCount || 5));
  });
}
document.querySelectorAll('#kidsQuizQuestionCountGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.kidsQuizQuestionCount = parseInt(btn.dataset.value, 10);
    saveState();
    renderKidsQuizQuestionCountGroup();
  });
});
function goToKidsQuizSetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('kidsQuizSetup').classList.add('active');
  updateKidsQuizSetupSubtitle();
  renderKidsQuizAnswerTimeGroup();
  renderKidsQuizQuestionCountGroup();
}
function exitKidsQuizSetup(){
  document.getElementById('kidsQuizSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('kidsView');
}
function kidsQuizPlayersList(){
  if(!state.kidsPlayers || state.kidsPlayers.length < 2) state.kidsPlayers = ['Игрок 1','Игрок 2'];
  return state.kidsPlayers;
}
function stopKidsQuizInterval(){
  if(kidsQuizIntervalId){ clearInterval(kidsQuizIntervalId); kidsQuizIntervalId = null; }
}
function updateKidsQuizScoreUI(){
  const players = kidsQuizPlayersList();
  const correct = state.kidsQuizCorrect || [];
  const idx = state.kidsQuizCurrentPlayerIndex || 0;
  const wrap = document.getElementById('kidsQuizScoreRow');
  if(wrap){
    wrap.innerHTML = '';
    players.forEach((name, i)=>{
      const span = document.createElement('span');
      span.className = 'krokodil-score-item' + (i === idx ? ' active' : '');
      span.textContent = name + ': ' + (correct[i] || 0);
      wrap.appendChild(span);
    });
  }
  const turnLabel = document.getElementById('kidsQuizTurnLabel');
  if(turnLabel) turnLabel.textContent = 'Отвечает: ' + (players[idx] || 'Игрок 1');
}
// Прогресс-бар показывает продвижение ТЕКУЩЕГО игрока по его собственным
// вопросам (0..kidsQuizQuestionCount), а не по всей партии.
function updateKidsQuizProgressBar(){
  const fill = document.getElementById('kidsQuizProgressFill');
  const label = document.getElementById('kidsQuizProgressLabel');
  if(!fill || !label) return;
  const perPlayer = state.kidsQuizQuestionCount || 5;
  const done = (state.kidsQuizIndex || 0) % perPlayer;
  const pct = perPlayer > 0 ? Math.round((done/perPlayer)*100) : 0;
  fill.style.width = pct + '%';
  label.textContent = `${done} / ${perPlayer}`;
}
function updateKidsQuizBar(remainingMs, totalMs){
  const fill = document.getElementById('kidsQuizBarFill');
  if(!fill) return;
  const pct = totalMs > 0 ? Math.max(0, Math.round((remainingMs/totalMs)*100)) : 0;
  fill.style.width = pct + '%';
}
// Общая длина очереди = kidsQuizQuestionCount (вопросов НА игрока) × число
// игроков — первые kidsQuizQuestionCount вопросов достаются игроку 0,
// следующие — игроку 1 и т.д. (см. advanceKidsQuizQueue). Если общая длина
// очереди больше пула возраста, пул зацикливается заново с перемешиванием.
function drawKidsQuizQueue(){
  const level = state.kidsAge || 1;
  const all = getKidsQuizCardsList(level);
  const perPlayer = state.kidsQuizQuestionCount || 5;
  const numPlayers = kidsQuizPlayersList().length || 1;
  const total = perPlayer * numPlayers;
  if(all.length === 0){
    state.kidsQuizQueue = [];
    state.kidsQuizIndex = 0;
    saveState();
    return;
  }
  if(!state.kidsQuizUsed) state.kidsQuizUsed = {};
  let used = state.kidsQuizUsed[level] || [];
  let pool = shuffle(all.filter(c=>!used.includes(c.q)));
  const chosen = [];
  let recycled = false;
  while(chosen.length < total){
    if(pool.length === 0){
      pool = shuffle(all);
      used = [];
      if(!recycled){ showToast('Вопросы этого возраста показаны заново 🔀'); recycled = true; }
    }
    const take = Math.min(pool.length, total - chosen.length);
    const part = pool.slice(0, take);
    chosen.push(...part);
    part.forEach(c=>used.push(c.q));
    pool = pool.slice(take);
  }
  state.kidsQuizUsed[level] = used;
  state.kidsQuizQueue = chosen;
  state.kidsQuizIndex = 0;
  saveState();
}
function showKidsQuizHandoffCard(){
  stopKidsQuizInterval();
  stopKidsQuizSpeech();
  kidsQuizShowingQuestion = false;
  const players = kidsQuizPlayersList();
  const idx = state.kidsQuizCurrentPlayerIndex || 0;
  const name = players[idx] || 'Игрок 1';
  const row = document.getElementById('kidsQuizHandoffRow');
  if(row) row.style.display = 'flex';
  const barTrack = document.getElementById('kidsQuizBarTrack');
  if(barTrack) barTrack.style.display = 'none';
  fadeSwapEl('kidsQuizCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon znayu-handoff-icon">🎯</div><div class="card-text">Передайте телефон игроку «${name}»</div></div></div>`;
  });
  updateKidsQuizScoreUI();
  updateKidsQuizProgressBar();
}
function showKidsQuizQuestion(){
  stopKidsQuizInterval();
  stopKidsQuizSpeech();
  const row = document.getElementById('kidsQuizHandoffRow');
  if(row) row.style.display = 'none';
  const item = state.kidsQuizQueue[state.kidsQuizIndex];
  if(!item){
    kidsQuizShowingQuestion = false;
    fadeSwapEl('kidsQuizCard', (el)=>{
      el.className = 'card card-empty';
      el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon">🎯</div><div class="card-text">Не удалось загрузить вопросы — попробуйте обновить приложение</div></div></div>`;
    });
    return;
  }
  kidsQuizAnswered = false;
  const opts = [
    {text:item.a[0], correct:true},
    {text:item.a[1], correct:false},
    {text:item.a[2], correct:false},
    {text:item.a[3], correct:false},
  ];
  kidsQuizCurrentOptions = shuffle(opts);
  kidsQuizQuestionStartedAt = Date.now();
  kidsQuizDurationMs = (state.kidsQuizAnswerSeconds || 10) * 1000;
  kidsQuizDeadline = kidsQuizQuestionStartedAt + kidsQuizDurationMs;
  fadeSwapEl('kidsQuizCard', (el)=>{
    el.className = 'card';
    const answersHtml = kidsQuizCurrentOptions.map((o,i)=>`<button type="button" class="btn btn-secondary znayu-answer-btn" data-idx="${i}">${o.text}</button>`).join('');
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="znayu-question-text">${item.q}</div></div><div class="znayu-answers">${answersHtml}</div><div class="quiz-tts-hint" id="kidsQuizTtsHint">🔊</div></div>`;
    el.querySelectorAll('.znayu-answer-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        answerKidsQuizQuestion(parseInt(btn.dataset.idx, 10));
      });
    });
  });
  kidsQuizShowingQuestion = true;
  const barTrack = document.getElementById('kidsQuizBarTrack');
  if(barTrack) barTrack.style.display = '';
  updateKidsQuizBar(kidsQuizDurationMs, kidsQuizDurationMs);
  updateKidsQuizScoreUI();
  updateKidsQuizProgressBar();
  if(state.autoSpeak) speakKidsQuizCard();
  kidsQuizIntervalId = setInterval(kidsQuizTick, 100);
}
function kidsQuizTick(){
  const remaining = kidsQuizDeadline - Date.now();
  updateKidsQuizBar(Math.max(0, remaining), kidsQuizDurationMs);
  if(remaining <= 0){
    stopKidsQuizInterval();
    if(!kidsQuizAnswered) answerKidsQuizQuestion(-1);
  }
}
function answerKidsQuizQuestion(choiceIdx){
  if(kidsQuizAnswered) return;
  kidsQuizAnswered = true;
  stopKidsQuizInterval();
  const elapsed = Math.min(Date.now() - kidsQuizQuestionStartedAt, kidsQuizDurationMs);
  const idx = state.kidsQuizCurrentPlayerIndex || 0;
  if(!state.kidsQuizCorrect) state.kidsQuizCorrect = [];
  if(!state.kidsQuizTimeMs) state.kidsQuizTimeMs = [];
  state.kidsQuizTimeMs[idx] = (state.kidsQuizTimeMs[idx] || 0) + elapsed;
  const isCorrect = choiceIdx >= 0 && kidsQuizCurrentOptions[choiceIdx] && kidsQuizCurrentOptions[choiceIdx].correct;
  if(isCorrect){
    state.kidsQuizCorrect[idx] = (state.kidsQuizCorrect[idx] || 0) + 1;
    playSuccessSound();
  } else {
    playFailSound();
    // Явно сообщаем об истечении времени — зелёная подсветка верного варианта
    // ниже это просто подсказка "вот какой был правильный ответ", очко за
    // него НЕ начисляется (state.kidsQuizCorrect не увеличивается), но без
    // этого тоста легко перепутать подсветку с "ответ засчитан верным".
    if(choiceIdx < 0) showToast('⏰ Время вышло — ответ не выбран, засчитано как неверно');
  }
  document.querySelectorAll('#kidsQuizCard .znayu-answer-btn').forEach((btn, i)=>{
    btn.disabled = true;
    if(kidsQuizCurrentOptions[i] && kidsQuizCurrentOptions[i].correct) btn.classList.add('answer-correct');
    else if(i === choiceIdx) btn.classList.add('answer-wrong');
  });
  saveState();
  updateKidsQuizScoreUI();
  setTimeout(advanceKidsQuizQueue, 900);
}
// Игрок отвечает на ВСЕ свои вопросы подряд (kidsQuizQuestionCount штук)
// без хендоффа между ними — карточка "Передайте телефон" показывается
// только когда этот блок вопросов исчерпан и ход переходит следующему игроку.
function advanceKidsQuizQueue(){
  state.kidsQuizIndex = (state.kidsQuizIndex || 0) + 1;
  const total = state.kidsQuizQueue.length;
  if(state.kidsQuizIndex >= total){
    saveState();
    showKidsQuizSummaryModal();
    return;
  }
  const perPlayer = state.kidsQuizQuestionCount || 5;
  if(state.kidsQuizIndex % perPlayer === 0){
    const n = kidsQuizPlayersList().length || 1;
    state.kidsQuizCurrentPlayerIndex = ((state.kidsQuizCurrentPlayerIndex || 0) + 1) % n;
    saveState();
    showKidsQuizHandoffCard();
  } else {
    saveState();
    showKidsQuizQuestion();
  }
}
function fmtKidsQuizTime(ms){
  return (ms/1000).toFixed(1).replace('.', ',') + ' сек';
}
function showKidsQuizSummaryModal(){
  const players = kidsQuizPlayersList();
  const correct = state.kidsQuizCorrect || [];
  const timeMs = state.kidsQuizTimeMs || [];
  const ranking = players.map((n,i)=>({n, correct: correct[i]||0, timeMs: timeMs[i]||0}))
    .sort((a,b)=> b.correct - a.correct || a.timeMs - b.timeMs);
  const medals = ['🥇','🥈','🥉'];
  // "из total" — сколько вопросов задавалось КАЖДОМУ игроку (kidsQuizQuestionCount),
  // а не общая длина очереди на всю партию (которая = kidsQuizQuestionCount × число игроков).
  const total = state.kidsQuizQuestionCount || 5;
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
        <span class="krokodil-summary-score">Верно: ${r.correct} из ${total}<br>Время: ${fmtKidsQuizTime(r.timeMs)}</span>
      </div>
    `;
  }).join('');
  document.getElementById('kidsQuizSummaryList').innerHTML = listHtml;
  document.getElementById('kidsQuizSummaryModal').classList.add('show');
}
function goToKidsQuizGame(){
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
  abandonPausedPartyQuizSession();
  abandonPausedSoloBsSession();
  state.pausedMode = null;
  const players = kidsQuizPlayersList();
  state.kidsQuizCorrect = new Array(players.length).fill(0);
  state.kidsQuizTimeMs = new Array(players.length).fill(0);
  state.kidsQuizCurrentPlayerIndex = Math.floor(Math.random() * players.length);
  state.kidsQuizUsed = state.kidsQuizUsed || {};
  state.kidsQuizUsed[state.kidsAge || 1] = [];
  drawKidsQuizQueue();
  state.inProgress = true;
  saveState();
  document.getElementById('kidsQuizSetup').classList.remove('active');
  document.getElementById('setup').classList.remove('active');
  document.getElementById('kidsQuizGame').classList.add('active');
  updateMuteBtn();
  requestWakeLock();
  showKidsQuizHandoffCard();
}
function pauseKidsQuizGame(){
  stopKidsQuizInterval();
  stopKidsQuizSpeech();
  state.pausedMode = 'kidsQuiz';
  saveState();
  document.getElementById('kidsQuizGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('kidsView');
  updateResumeUI();
}
function resumeKidsQuizGame(){
  state.pausedMode = null;
  saveState();
  updateResumeUI();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('kidsQuizGame').classList.add('active');
  updateMuteBtn();
  requestWakeLock();
  showKidsQuizHandoffCard();
}
function finishKidsQuizGame(){
  stopKidsQuizInterval();
  stopKidsQuizSpeech();
  state.kidsQuizCorrect = [];
  state.kidsQuizTimeMs = [];
  state.kidsQuizQueue = [];
  state.kidsQuizIndex = 0;
  state.kidsQuizCurrentPlayerIndex = 0;
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  updateResumeUI();
}
function exitKidsQuizGame(){
  if(typeof stopKidsQuizSpeech === 'function') stopKidsQuizSpeech();
  document.getElementById('kidsQuizSummaryModal').classList.remove('show');
  finishKidsQuizGame();
  document.getElementById('kidsQuizGame').classList.remove('active');
  document.getElementById('kidsQuizSetup').classList.add('active');
}
// ===== Озвучка вопроса "Викторина" (по тапу на карточку) =====
// Тот же приём, что и в games/memes.js (speakMemesCard) — необязательная
// фича, если Web Speech API не поддерживается браузером, тап просто ничего
// не озвучивает и не мешает игре. stripQuotesForSpeech — общая утилита,
// определена в games/memes.js (тот файл гарантированно загружается раньше
// этого, см. порядок <script> в index.html).
function pickKidsQuizVoice(){
  if(!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const ru = voices.filter(v=>/^ru/i.test(v.lang));
  const pool = ru.length ? ru : voices;
  const female = pool.find(v=>/female|женск|milena|olga|katya/i.test(v.name));
  return female || pool[0] || null;
}
function stopKidsQuizSpeech(){
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  const hint = document.getElementById('kidsQuizTtsHint');
  if(hint) hint.classList.remove('speaking');
}
function speakKidsQuizCard(){
  const item = state.kidsQuizQueue && state.kidsQuizQueue[state.kidsQuizIndex];
  if(!item || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  const text = typeof stripQuotesForSpeech === 'function' ? stripQuotesForSpeech(item.q) : item.q;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ru-RU';
  utter.rate = 0.95;
  const voice = pickKidsQuizVoice();
  if(voice) utter.voice = voice;
  const hint = document.getElementById('kidsQuizTtsHint');
  const fire = ()=>{
    const current = state.kidsQuizQueue && state.kidsQuizQueue[state.kidsQuizIndex];
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
document.getElementById('kidsQuizCard').addEventListener('click', (e)=>{
  if(e.target.closest('.znayu-answer-btn')) return;
  if(!kidsQuizShowingQuestion) return;
  speakKidsQuizCard();
});
document.getElementById('kidsQuizSetupStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  goToKidsQuizGame();
});
document.getElementById('kidsQuizSetupExitBtn').addEventListener('click', ()=>{ exitKidsQuizSetup(); });
document.getElementById('kidsQuizHandoffStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  showKidsQuizQuestion();
});
document.getElementById('kidsQuizExitBtn').addEventListener('click', ()=>{
  pauseKidsQuizGame();
  showToast('Игра на паузе — прогресс сохранён');
});
document.getElementById('closeKidsQuizSummaryBtn').addEventListener('click', ()=>{ exitKidsQuizGame(); });
(document.getElementById('kidsQuizSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ document.getElementById('kidsQuizRulesModal').classList.add('show'); });
document.getElementById('closeKidsQuizRulesBtn').addEventListener('click', ()=>{ document.getElementById('kidsQuizRulesModal').classList.remove('show'); });
document.getElementById('kidsQuizRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'kidsQuizRulesModal') e.currentTarget.classList.remove('show'); });
