// games/quiz.js — Игра "Викторина" (пары).
// Загружается через <script src="games/quiz.js"></script> в index.html.
// Вопросы задаются по очереди двум игрокам (name1/name2 из общих настроек
// "Игры для пар 18+"): на каждый вопрос — 4 варианта ответа (верный один),
// кнопки "Пропустить" нет — либо выбрать вариант, либо истечёт время на
// ответ (тогда вопрос засчитывается как неверный). Экран игры скопирован с
// "Знаю тебя" (переиспользует .znayu-question-text/.znayu-answers/
// .znayu-answer-btn), но вместо угадывания партнёра — обычная викторина по
// очереди с подсветкой верного/неверного варианта после ответа. В конце —
// таблица результатов: место, имя, число верных ответов и суммарное время,
// потраченное на ответы; если по числу верных ответов победитель не
// определился — побеждает тот, кто отвечал быстрее (тот же принцип, что и в
// showKidsTdSummaryModal, только тай-брейк не по очкам, а по времени).

let quizIntervalId = null;
let quizDeadline = 0;
let quizDurationMs = 3000;
let quizAnswered = false;
let quizQuestionStartedAt = 0;
let quizCurrentOptions = [];
// Пока true — по карточке показан именно вопрос (не хендофф и не заглушка),
// поэтому тап по ней озвучивает текст задания (см. speakQuizCard).
let quizShowingQuestion = false;

function getQuizCardsList(level){
  if(typeof QUIZ_CARDS === 'undefined' || !Array.isArray(QUIZ_CARDS)) return [];
  return QUIZ_CARDS.filter(c=>c.level===level);
}
function renderQuizSetupLevels(){
  const wrap = document.getElementById('quizSetupLevels');
  if(!wrap) return;
  wrap.innerHTML = '';
  (typeof QUIZ_LEVELS !== 'undefined' ? QUIZ_LEVELS : []).forEach(l=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + (state.quizSelectedLevel === l.id ? ' on' : '');
    div.innerHTML = `<div class="lname">${l.icon} ${l.name}</div><div class="ldesc">${l.desc}</div><div class="level-check"></div>`;
    div.addEventListener('click', ()=>{
      state.quizSelectedLevel = l.id;
      saveState();
      renderQuizSetupLevels();
    });
    wrap.appendChild(div);
  });
}
function renderQuizAnswerTimeGroup(){
  // Клэмп на случай старого сохранённого значения (раньше были варианты
  // 5/10/15 — теперь 10/15/20), чтобы после обновления приложения всегда
  // была подсвечена одна из актуальных кнопок.
  if(![10,15,20].includes(state.quizAnswerSeconds)){ state.quizAnswerSeconds = 15; saveState(); }
  document.querySelectorAll('#quizAnswerTimeGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (state.quizAnswerSeconds || 15));
  });
}
document.querySelectorAll('#quizAnswerTimeGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.quizAnswerSeconds = parseInt(btn.dataset.value, 10);
    saveState();
    renderQuizAnswerTimeGroup();
  });
});
// quizQuestionCount — сколько вопросов задаётся КАЖДОМУ игроку подряд
// (раньше было общее число вопросов на всю партию — теперь на игрока, см.
// drawQuizQueue/advanceQuizQueue).
function renderQuizQuestionCountGroup(){
  if(![3,5,7,10].includes(state.quizQuestionCount)){ state.quizQuestionCount = 5; saveState(); }
  document.querySelectorAll('#quizQuestionCountGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (state.quizQuestionCount || 5));
  });
}
document.querySelectorAll('#quizQuestionCountGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.quizQuestionCount = parseInt(btn.dataset.value, 10);
    saveState();
    renderQuizQuestionCountGroup();
  });
});
function goToQuizSetup(){
  goToGameSetup('quizSetup', null, ()=>{
    renderQuizSetupLevels();
    renderQuizAnswerTimeGroup();
    renderQuizQuestionCountGroup();
  });
}
function exitQuizSetup(){
  document.getElementById('quizSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('companyView');
}
// Ровно 2 игрока — те же имена, что в общих настройках "Игры для пар 18+".
function quizPlayersList(){
  return [state.name1 || 'Игрок 1', state.name2 || 'Игрок 2'];
}
function stopQuizInterval(){
  quizIntervalId = stopInterval(quizIntervalId);
}
function updateQuizScoreUI(){
  const players = quizPlayersList();
  const correct = state.quizCorrect || [];
  const idx = state.quizCurrentPlayerIndex || 0;
  const wrap = document.getElementById('quizScoreRow');
  if(wrap){
    wrap.innerHTML = '';
    players.forEach((name, i)=>{
      const span = document.createElement('span');
      span.className = 'krokodil-score-item' + (i === idx ? ' active' : '');
      span.textContent = name + ': ' + (correct[i] || 0);
      wrap.appendChild(span);
    });
  }
  const turnLabel = document.getElementById('quizTurnLabel');
  if(turnLabel) turnLabel.textContent = 'Отвечает: ' + (players[idx] || 'Игрок 1');
}
// Прогресс-бар показывает продвижение ТЕКУЩЕГО игрока по его собственным
// вопросам (0..quizQuestionCount), а не по всей партии — раз игрок теперь
// отвечает на все свои вопросы подряд, это нагляднее, чем общий счётчик.
function updateQuizProgressBar(){
  const fill = document.getElementById('quizProgressFill');
  const label = document.getElementById('quizProgressLabel');
  if(!fill || !label) return;
  const perPlayer = state.quizQuestionCount || 5;
  const done = (state.quizIndex || 0) % perPlayer;
  const pct = perPlayer > 0 ? Math.round((done/perPlayer)*100) : 0;
  fill.style.width = pct + '%';
  label.textContent = `${done} / ${perPlayer}`;
}
function updateQuizBar(remainingMs, totalMs){
  const fill = document.getElementById('quizBarFill');
  if(!fill) return;
  const pct = totalMs > 0 ? Math.max(0, Math.round((remainingMs/totalMs)*100)) : 0;
  fill.style.width = pct + '%';
}
// Общая длина очереди = quizQuestionCount (вопросов НА игрока) × число
// игроков — первые quizQuestionCount вопросов достаются игроку 0, следующие
// quizQuestionCount — игроку 1, и т.д. (см. advanceQuizQueue). Вопросы внутри
// уровня не повторяются, пока не закончится пул; если общая длина очереди
// больше пула уровня (например, 10 вопросов × 10 игроков = 100 при пуле 50),
// пул зацикливается заново с новым перемешиванием — точно так же, как при
// обычном исчерпании пула в остальных играх приложения.
function drawQuizQueue(){
  const level = state.quizSelectedLevel || 1;
  const all = getQuizCardsList(level);
  const perPlayer = state.quizQuestionCount || 5;
  const numPlayers = quizPlayersList().length || 1;
  const total = perPlayer * numPlayers;
  if(all.length === 0){
    state.quizQueue = [];
    state.quizIndex = 0;
    saveState();
    return;
  }
  if(!state.quizUsed) state.quizUsed = {};
  let used = state.quizUsed[level] || [];
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
  state.quizUsed[level] = used;
  state.quizQueue = chosen;
  state.quizIndex = 0;
  saveState();
}
function showQuizHandoffCard(){
  stopQuizInterval();
  stopQuizSpeech();
  quizShowingQuestion = false;
  const players = quizPlayersList();
  const idx = state.quizCurrentPlayerIndex || 0;
  const name = players[idx] || 'Игрок 1';
  const row = document.getElementById('quizHandoffRow');
  if(row) row.style.display = 'flex';
  const barTrack = document.getElementById('quizBarTrack');
  if(barTrack) barTrack.style.display = 'none';
  fadeSwapEl('quizCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon znayu-handoff-icon">🎯</div><div class="card-text">Передайте телефон игроку «${name}»</div></div></div>`;
  });
  updateQuizScoreUI();
  updateQuizProgressBar();
}
function showQuizQuestion(){
  stopQuizInterval();
  stopQuizSpeech();
  const row = document.getElementById('quizHandoffRow');
  if(row) row.style.display = 'none';
  const item = state.quizQueue[state.quizIndex];
  if(!item){
    quizShowingQuestion = false;
    fadeSwapEl('quizCard', (el)=>{
      el.className = 'card card-empty';
      el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon">🎯</div><div class="card-text">Не удалось загрузить вопросы — попробуйте обновить приложение</div></div></div>`;
    });
    return;
  }
  quizAnswered = false;
  const opts = [
    {text:item.a[0], correct:true},
    {text:item.a[1], correct:false},
    {text:item.a[2], correct:false},
    {text:item.a[3], correct:false},
  ];
  quizCurrentOptions = shuffle(opts);
  quizQuestionStartedAt = Date.now();
  quizDurationMs = (state.quizAnswerSeconds || 10) * 1000;
  quizDeadline = quizQuestionStartedAt + quizDurationMs;
  fadeSwapEl('quizCard', (el)=>{
    el.className = 'card';
    const answersHtml = quizCurrentOptions.map((o,i)=>`<button type="button" class="btn btn-secondary znayu-answer-btn" data-idx="${i}">${o.text}</button>`).join('');
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="znayu-question-text">${item.q}</div></div><div class="znayu-answers">${answersHtml}</div><div class="quiz-tts-hint" id="quizTtsHint">🔊</div></div>`;
    el.querySelectorAll('.znayu-answer-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        answerQuizQuestion(parseInt(btn.dataset.idx, 10));
      });
    });
  });
  quizShowingQuestion = true;
  const barTrack = document.getElementById('quizBarTrack');
  if(barTrack) barTrack.style.display = '';
  updateQuizBar(quizDurationMs, quizDurationMs);
  updateQuizScoreUI();
  updateQuizProgressBar();
  if(state.autoSpeak) speakQuizCard();
  quizIntervalId = setInterval(quizTick, 100);
}
function quizTick(){
  const remaining = quizDeadline - Date.now();
  updateQuizBar(Math.max(0, remaining), quizDurationMs);
  if(remaining <= 0){
    stopQuizInterval();
    if(!quizAnswered) answerQuizQuestion(-1);
  }
}
// choiceIdx = -1, если время истекло без ответа (засчитывается как неверный).
function answerQuizQuestion(choiceIdx){
  if(quizAnswered) return;
  quizAnswered = true;
  stopQuizInterval();
  const elapsed = Math.min(Date.now() - quizQuestionStartedAt, quizDurationMs);
  const idx = state.quizCurrentPlayerIndex || 0;
  if(!state.quizCorrect) state.quizCorrect = [];
  if(!state.quizTimeMs) state.quizTimeMs = [];
  state.quizTimeMs[idx] = (state.quizTimeMs[idx] || 0) + elapsed;
  const isCorrect = choiceIdx >= 0 && quizCurrentOptions[choiceIdx] && quizCurrentOptions[choiceIdx].correct;
  if(isCorrect){
    state.quizCorrect[idx] = (state.quizCorrect[idx] || 0) + 1;
    playSuccessSound();
  } else {
    playFailSound();
    // Явно сообщаем об истечении времени — зелёная подсветка верного варианта
    // ниже это просто подсказка "вот какой был правильный ответ", очко за
    // него НЕ начисляется (state.quizCorrect не увеличивается), но без этого
    // тоста легко перепутать подсветку с "ответ засчитан верным".
    if(choiceIdx < 0) showToast('⏰ Время вышло — ответ не выбран, засчитано как неверно');
  }
  document.querySelectorAll('#quizCard .znayu-answer-btn').forEach((btn, i)=>{
    btn.disabled = true;
    if(quizCurrentOptions[i] && quizCurrentOptions[i].correct) btn.classList.add('answer-correct');
    else if(i === choiceIdx) btn.classList.add('answer-wrong');
  });
  saveState();
  updateQuizScoreUI();
  setTimeout(advanceQuizQueue, 900);
}
// Игрок отвечает на ВСЕ свои вопросы подряд (quizQuestionCount штук) без
// хендоффа между ними — карточка "Передайте телефон" показывается только
// когда этот блок вопросов исчерпан и ход переходит следующему игроку.
function advanceQuizQueue(){
  state.quizIndex = (state.quizIndex || 0) + 1;
  const total = state.quizQueue.length;
  if(state.quizIndex >= total){
    saveState();
    showQuizSummaryModal();
    return;
  }
  const perPlayer = state.quizQuestionCount || 5;
  if(state.quizIndex % perPlayer === 0){
    const n = quizPlayersList().length || 1;
    state.quizCurrentPlayerIndex = ((state.quizCurrentPlayerIndex || 0) + 1) % n;
    saveState();
    showQuizHandoffCard();
  } else {
    saveState();
    showQuizQuestion();
  }
}
// ===== Озвучка вопроса "Викторина" (по тапу на карточку) =====
// Тот же приём, что и в games/memes.js (speakMemesCard) — необязательная
// фича, если Web Speech API не поддерживается браузером, тап просто ничего
// не озвучивает и не мешает игре. stripQuotesForSpeech — общая утилита,
// определена в games/memes.js (тот файл гарантированно загружается раньше
// этого, см. порядок <script> в index.html).
function pickQuizVoice(){
  if(!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const ru = voices.filter(v=>/^ru/i.test(v.lang));
  const pool = ru.length ? ru : voices;
  const female = pool.find(v=>/female|женск|milena|olga|katya/i.test(v.name));
  return female || pool[0] || null;
}
function stopQuizSpeech(){
  stopSpeech('quizTtsHint');
}
function speakQuizCard(){
  const item = state.quizQueue && state.quizQueue[state.quizIndex];
  if(!item || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  const text = typeof stripQuotesForSpeech === 'function' ? stripQuotesForSpeech(item.q) : item.q;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ru-RU';
  utter.rate = 0.95;
  const voice = pickQuizVoice();
  if(voice) utter.voice = voice;
  const hint = document.getElementById('quizTtsHint');
  const fire = ()=>{
    const current = state.quizQueue && state.quizQueue[state.quizIndex];
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
document.getElementById('quizCard').addEventListener('click', (e)=>{
  if(e.target.closest('.znayu-answer-btn')) return;
  if(!quizShowingQuestion) return;
  speakQuizCard();
});
function fmtQuizTime(ms){
  return (ms/1000).toFixed(1).replace('.', ',') + ' сек';
}
// Итоговое окно — сортировка по числу верных ответов (по убыванию), при
// равенстве — по суммарному времени ответов (по возрастанию, быстрее
// значит лучше). Игроки делят место, только если у них совпадают ОБА
// значения (иначе время всегда разводит игроков по разным местам).
function showQuizSummaryModal(){
  const players = quizPlayersList();
  const correct = state.quizCorrect || [];
  const timeMs = state.quizTimeMs || [];
  const ranking = players.map((n,i)=>({n, correct: correct[i]||0, timeMs: timeMs[i]||0}))
    .sort((a,b)=> b.correct - a.correct || a.timeMs - b.timeMs);
  const medals = ['🥇','🥈','🥉'];
  // "из total" — сколько вопросов задавалось КАЖДОМУ игроку (quizQuestionCount),
  // а не общая длина очереди на всю партию (которая = quizQuestionCount × число игроков).
  const total = state.quizQuestionCount || 5;
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
        <span class="krokodil-summary-score">Верно: ${r.correct} из ${total}<br>Время: ${fmtQuizTime(r.timeMs)}</span>
      </div>
    `;
  }).join('');
  document.getElementById('quizSummaryList').innerHTML = listHtml;
  showModal('quizSummaryModal');
}
function goToQuizGame(){
  abandonPausedSession('davay');
  abandonPausedSession('td');
  abandonPausedSession('bingo');
  abandonPausedSession('krokodil');
  abandonPausedSession('wishlist');
  abandonPausedSession('znayu');
  abandonPausedSession('timer');
  abandonPausedSession('partyFants');
  abandonPausedSession('partyTd');
  abandonPausedSession('famZnayu');
  abandonPausedSession('lucky');
  abandonPausedSession('kidsMemory');
  abandonPausedSession('kidsTd');
  abandonPausedSession('fanty');
  abandonPausedSession('partyQuiz');
  abandonPausedSession('kidsQuiz');
  abandonPausedSession('soloBs');
  state.pausedMode = null;
  const n1raw = document.getElementById('name1').value.trim();
  const n2raw = document.getElementById('name2').value.trim();
  state.name1 = n1raw || 'Men';
  state.name2 = n2raw || 'Sexy';
  const players = quizPlayersList();
  state.quizCorrect = new Array(players.length).fill(0);
  state.quizTimeMs = new Array(players.length).fill(0);
  state.quizCurrentPlayerIndex = Math.floor(Math.random() * players.length);
  drawQuizQueue();
  state.inProgress = true;
  saveState();
  document.getElementById('quizSetup').classList.remove('active');
  goToGame(null, 'quizGame');
  updateMuteBtn();
  requestWakeLock();
  showQuizHandoffCard();
}
// Пауза: вернуться в главное меню, не сбрасывая счёт и очередь — можно
// продолжить позже через общий блок "Продолжить игру" / "Закончить игру".
// При паузе отсчёт времени на текущий вопрос останавливается — после
// возобновления снова показывается карточка "Передайте телефон" для того же
// игрока, чей был ход (сам вопрос не засчитывается ни верным, ни неверным).
function pauseQuizGame(){
  stopQuizInterval();
  stopQuizSpeech();
  state.pausedMode = 'quiz';
  saveState();
  document.getElementById('quizGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('companyView');
  updateResumeUI();
}
function resumeQuizGame(){
  state.pausedMode = null;
  saveState();
  updateResumeUI();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('quizGame').classList.add('active');
  updateMuteBtn();
  requestWakeLock();
  showQuizHandoffCard();
}
// Вызывается из общего "Закончить игру" на главном экране, пока игра стоит
// на паузе — полный сброс без показа итогов (в отличие от exitQuizGame,
// которая закрывает уже показанное окно результатов после честной партии).
function finishQuizGame(){
  stopQuizInterval();
  stopQuizSpeech();
  state.quizCorrect = [];
  state.quizTimeMs = [];
  state.quizQueue = [];
  state.quizIndex = 0;
  state.quizCurrentPlayerIndex = 0;
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  updateResumeUI();
}
function exitQuizGame(){
  if(typeof stopQuizSpeech === 'function') stopQuizSpeech();
  hideModal('quizSummaryModal');
  finishQuizGame();
  exitGame('quizGame', 'quizSetup');
}
document.getElementById('quizSetupStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  goToQuizGame();
});
document.getElementById('quizSetupExitBtn').addEventListener('click', ()=>{ exitQuizSetup(); });
document.getElementById('quizHandoffStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  showQuizQuestion();
});
document.getElementById('quizExitBtn').addEventListener('click', ()=>{
  pauseQuizGame();
  showToast('Игра на паузе — прогресс сохранён');
});
document.getElementById('closeQuizSummaryBtn').addEventListener('click', ()=>{ exitQuizGame(); });
(document.getElementById('quizSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ showModal('quizRulesModal'); });
document.getElementById('closeQuizRulesBtn').addEventListener('click', ()=>{ hideModal('quizRulesModal'); });
document.getElementById('quizRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'quizRulesModal') e.currentTarget.classList.remove('show'); });
