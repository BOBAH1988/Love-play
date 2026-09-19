// games/flags.js — Игра "Флаги" (обучающая игра: угадать страну по флагу).
// Загружается через <script src="games/flags.js"> в index.html.
// На экране настройки выбирается сложность (5/10/20/50 вопросов), на экране игры показывается флаг,
// под ним — 4 варианта ответа (правильный один), таймер на ответ (10 сек), счёт и тай-брейк по времени.
// Экран игры скопирован с games/quiz.js, но показывает изображение флага,
// а варианты ответов — страны. По окончании партии показывается окно с результатами.

let flagsIntervalId = null;
let flagsDeadline = 0;
let flagsDurationMs = 10000;
let flagsAnswered = false;
let flagsQuestionStartedAt = 0;
let flagsCurrentOptions = [];
let flagsShowingQuestion = false;

function getFlagsCardsList(level){
  if(typeof FLAGS_CARDS === 'undefined' || !Array.isArray(FLAGS_CARDS)) return [];
  return FLAGS_CARDS.filter(c => c.level === level);
}
function renderFlagsSetupLevels(){
  const wrap = document.getElementById('flagsSetupLevels');
  if(!wrap) return;
  wrap.innerHTML = '';
  (typeof FLAGS_LEVELS !== 'undefined' ? FLAGS_LEVELS : []).forEach(l => {
    const div = document.createElement('div');
    div.className = 'level-toggle' + (state.flagsSelectedLevel === l.id ? ' on' : '');
    div.innerHTML = `<div class="lname">${l.icon} ${l.name}</div><div class="ldesc">${l.desc}</div><div class="level-check"></div>`;
    div.addEventListener('click', () => {
      state.flagsSelectedLevel = l.id;
      saveState();
      renderFlagsSetupLevels();
    });
    wrap.appendChild(div);
  });
}
function renderFlagsAnswerTimeGroup(){
  if(![10,15,20].includes(state.flagsAnswerSeconds)){ state.flagsAnswerSeconds = 15; saveState(); }
  document.querySelectorAll('#flagsAnswerTimeGroup .starter-btn').forEach(btn => {
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (state.flagsAnswerSeconds || 15));
  });
}
document.querySelectorAll('#flagsAnswerTimeGroup .starter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.flagsAnswerSeconds = parseInt(btn.dataset.value, 10);
    saveState();
    renderFlagsAnswerTimeGroup();
  });
});
// flagsQuestionCount — сколько вопросов задаётся КАЖДОМУ игроку подряд
function renderFlagsQuestionCountGroup(){
  if(![3,5,7,10].includes(state.flagsQuestionCount)){ state.flagsQuestionCount = 5; saveState(); }
  document.querySelectorAll('#flagsQuestionCountGroup .starter-btn').forEach(btn => {
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (state.flagsQuestionCount || 5));
  });
}
document.querySelectorAll('#flagsQuestionCountGroup .starter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.flagsQuestionCount = parseInt(btn.dataset.value, 10);
    saveState();
    renderFlagsQuestionCountGroup();
  });
});
function goToFlagsSetup(){
  goToGameSetup('flagsSetup', null, () => {
    renderFlagsSetupLevels();
    renderFlagsAnswerTimeGroup();
    renderFlagsQuestionCountGroup();
  });
}
function exitFlagsSetup(){
  document.getElementById('flagsSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
    showSetupView('learningView');
}
// Ровно 2 игрока — те же имена, что в общих настройках "Игры для пар 18+".
function flagsPlayersList(){
  return [state.name1 || 'Игрок 1', state.name2 || 'Игрок 2'];
}
function stopFlagsInterval(){
  flagsIntervalId = stopInterval(flagsIntervalId);
}
function updateFlagsScoreUI(){
  const players = flagsPlayersList();
  const correct = state.flagsCorrect || [];
  const idx = state.flagsCurrentPlayerIndex || 0;
  const wrap = document.getElementById('flagsScoreRow');
  if(wrap){
    wrap.innerHTML = '';
    players.forEach((name, i) => {
      const span = document.createElement('span');
      span.className = 'krokodil-score-item' + (i === idx ? ' active' : '');
      span.textContent = name + ': ' + (correct[i] || 0);
      wrap.appendChild(span);
    });
  }
}
// Прогресс-бар показывает продвижение ТЕКУЩЕГО игрока по его собственным
// вопросам (0..flagsQuestionCount), а не по всей партии.
function updateFlagsProgressBar(){
  const fill = document.getElementById('flagsProgressFill');
  const label = document.getElementById('flagsProgressLabel');
  if(!fill || !label) return;
  const perPlayer = state.flagsQuestionCount || 5;
  const done = (state.flagsIndex || 0) % perPlayer;
  const pct = perPlayer > 0 ? Math.round((done/perPlayer)*100) : 0;
  fill.style.width = pct + '%';
  label.textContent = `${done} / ${perPlayer}`;
}
function updateFlagsBar(remainingMs, totalMs){
  const fill = document.getElementById('flagsBarFill');
  if(!fill) return;
  const pct = totalMs > 0 ? Math.max(0, Math.round((remainingMs/totalMs)*100)) : 0;
  fill.style.width = pct + '%';
}
// Общая длина очереди = flagsQuestionCount (вопросов НА игрока) × число
// игроков — первые flagsQuestionCount вопросов достаются игроку 0,
// следующие — игроку 1 и т.д. (см. advanceFlagsQueue). Если общая длина
// очереди больше пула уровня, пул зацикливается заново с перемешиванием.
function drawFlagsQueue(){
  const level = state.flagsSelectedLevel || 1;
  const all = getFlagsCardsList(level);
  const perPlayer = state.flagsQuestionCount || 5;
  const numPlayers = flagsPlayersList().length || 1;
  const total = perPlayer * numPlayers;
  if(all.length === 0){
    state.flagsQueue = [];
    state.flagsIndex = 0;
    saveState();
    return;
  }
  if(!state.flagsUsed) state.flagsUsed = {};
  let used = state.flagsUsed[level] || [];
  let pool = shuffle(all.filter(c => !used.includes(c.q)));
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
    part.forEach(c => used.push(c.q));
    pool = pool.slice(take);
  }
  state.flagsUsed[level] = used;
  state.flagsQueue = chosen;
  state.flagsIndex = 0;
  saveState();
}
function showFlagsHandoffCard(){
  stopFlagsInterval();
  flagsShowingQuestion = false;
  const players = flagsPlayersList();
  const idx = state.flagsCurrentPlayerIndex || 0;
  const name = players[idx] || 'Игрок 1';
  const row = document.getElementById('flagsHandoffRow');
  if(row) row.style.display = 'flex';
  const barTrack = document.getElementById('flagsBarTrack');
  if(barTrack) barTrack.style.display = 'none';
  fadeSwapEl('flagsCard', (el) => {
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon znayu-handoff-icon">🏳️</div><div class="card-text">Передайте телефон игроку «${name}»</div></div></div>`;
  });
  updateFlagsScoreUI();
  updateFlagsProgressBar();
}
function showFlagsQuestion(){
  stopFlagsInterval();
  const row = document.getElementById('flagsHandoffRow');
  if(row) row.style.display = 'none';
  const item = state.flagsQueue[state.flagsIndex];
  if(!item){
    flagsShowingQuestion = false;
    fadeSwapEl('flagsCard', (el) => {
      el.className = 'card card-empty';
      el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon">🏳️</div><div class="card-text">Не удалось загрузить вопросы — попробуйте обновить приложение</div></div></div>`;
    });
    return;
  }
  flagsAnswered = false;
  const opts = [
    {text:item.a[0], correct:true},
    {text:item.a[1], correct:false},
    {text:item.a[2], correct:false},
    {text:item.a[3], correct:false},
  ];
  flagsCurrentOptions = shuffle(opts);
  flagsQuestionStartedAt = Date.now();
  flagsDurationMs = (state.flagsAnswerSeconds || 10) * 1000;
  flagsDeadline = flagsQuestionStartedAt + flagsDurationMs;
  fadeSwapEl('flagsCard', (el) => {
    el.className = 'card';
    const answersHtml = flagsCurrentOptions.map((o,i) => `<button type="button" class="btn btn-secondary znayu-answer-btn" data-idx="${i}">${o.text}</button>`).join('');
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="znayu-question-text">Выберите страну по флагу</div></div><div class="znayu-answers">${answersHtml}</div><div class="quiz-tts-hint" id="flagsTtsHint">🔊</div></div>`;
    el.querySelectorAll('.znayu-answer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        answerFlagsQuestion(parseInt(btn.dataset.idx, 10));
      });
    });
  });
  flagsShowingQuestion = true;
  const barTrack = document.getElementById('flagsBarTrack');
  if(barTrack) barTrack.style.display = '';
  updateFlagsBar(flagsDurationMs, flagsDurationMs);
  updateFlagsScoreUI();
  updateFlagsProgressBar();
  if(state.autoSpeak) speakFlagsCard();
  flagsIntervalId = setInterval(flagsTick, 100);
}
function flagsTick(){
  const remaining = flagsDeadline - Date.now();
  updateFlagsBar(Math.max(0, remaining), flagsDurationMs);
  if(remaining <= 0){
    stopFlagsInterval();
    if(!flagsAnswered) answerFlagsQuestion(-1);
  }
}
// choiceIdx = -1, если время истекло без ответа (засчитывается как неверный).
function answerFlagsQuestion(choiceIdx){
  if(flagsAnswered) return;
  flagsAnswered = true;
  stopFlagsInterval();
  const elapsed = Math.min(Date.now() - flagsQuestionStartedAt, flagsDurationMs);
  const idx = state.flagsCurrentPlayerIndex || 0;
  if(!state.flagsCorrect) state.flagsCorrect = [];
  if(!state.flagsTimeMs) state.flagsTimeMs = [];
  state.flagsTimeMs[idx] = (state.flagsTimeMs[idx] || 0) + elapsed;
  const isCorrect = choiceIdx >= 0 && flagsCurrentOptions[choiceIdx] && flagsCurrentOptions[choiceIdx].correct;
  if(isCorrect){
    state.flagsCorrect[idx] = (state.flagsCorrect[idx] || 0) + 1;
    playSuccessSound();
  } else {
    playFailSound();
    if(choiceIdx < 0) showToast('⏰ Время вышло — ответ не выбран, засчитано как неверно');
  }
  document.querySelectorAll('#flagsCard .znayu-answer-btn').forEach((btn, i) => {
    btn.disabled = true;
    if(flagsCurrentOptions[i] && flagsCurrentOptions[i].correct) btn.classList.add('answer-correct');
    else if(i === choiceIdx) btn.classList.add('answer-wrong');
  });
  saveState();
  updateFlagsScoreUI();
  setTimeout(advanceFlagsQueue, 900);
}
// Игрок отвечает на ВСЕ свои вопросы подряд (flagsQuestionCount штук) без
// хендоффа между ними — карточка "Передайте телефон" показывается только
// когда этот блок вопросов исчерпан и ход переходит следующему игроку.
function advanceFlagsQueue(){
  state.flagsIndex = (state.flagsIndex || 0) + 1;
  const total = state.flagsQueue.length;
  if(state.flagsIndex >= total){
    saveState();
    showFlagsSummaryModal();
    return;
  }
  const perPlayer = state.flagsQuestionCount || 5;
  if(state.flagsIndex % perPlayer === 0){
    const n = flagsPlayersList().length || 1;
    state.flagsCurrentPlayerIndex = ((state.flagsCurrentPlayerIndex || 0) + 1) % n;
    saveState();
    showFlagsHandoffCard();
  } else {
    saveState();
    showFlagsQuestion();
  }
}
// ===== Озвучка вопроса "Флаги" (по тапу на карточку) =====
// Тот же приём, что и в games/memes.js (speakMemesCard) — необязательная
// фича, если Web Speech API не поддерживается браузером, тап просто ничего
// не озвучивает и не мешает игре. stripQuotesForSpeech — общая утилита,
// определена в games/memes.js (тот файл гарантированно загружается раньше
// этого, см. порядок <script> в index.html).
function pickFlagsVoice(){
  if(!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const ru = voices.filter(v => /^ru/i.test(v.lang));
  const pool = ru.length ? ru : voices;
  const female = pool.find(v => /female|женск|milena|olga|katya/i.test(v.name));
  return female || pool[0] || null;
}
function stopFlagsSpeech(){
  stopSpeech('flagsTtsHint');
}
function speakFlagsCard(){
  const item = state.flagsQueue && state.flagsQueue[state.flagsIndex];
  if(!item || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  const content = [item.q, ...flagsCurrentOptions.map((option, index) => `Вариант ${index + 1}: ${option.text}`)].join('. ');
  const text = typeof stripQuotesForSpeech === 'function' ? stripQuotesForSpeech(content) : content;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ru-RU';
  utter.rate = 0.95;
  const voice = pickFlagsVoice();
  if(voice) utter.voice = voice;
  const hint = document.getElementById('flagsTtsHint');
  const fire = () => {
    const current = state.flagsQueue && state.flagsQueue[state.flagsIndex];
    if(current !== item) return; // вопрос уже сменился — не озвучиваем устаревший текст
    if(hint) hint.classList.add('speaking');
    utter.onend = () => { if(hint) hint.classList.remove('speaking'); };
    utter.onerror = () => { if(hint) hint.classList.remove('speaking'); };
    synth.speak(utter);
  };
  if(synth.speaking || synth.pending){
    synth.cancel();
    setTimeout(fire, 50);
  } else {
    fire();
  }
}
document.getElementById('flagsCard').addEventListener('click', (e) => {
  if(e.target.closest('.znayu-answer-btn')) return;
  if(!flagsShowingQuestion) return;
  speakFlagsCard();
});
function fmtFlagsTime(ms){
  return (ms/1000).toFixed(1).replace('.', ',') + ' сек';
}
// Итоговое окно — сортировка по числу верных ответов (по убыванию), при
// равенстве — по суммарному времени ответов (по возрастанию, быстрее
// значит лучше). Игроки делят место, только если у них совпадают ОБА
// значения (иначе время всегда разводит игроков по разным местам).
function showFlagsSummaryModal(){
  const players = flagsPlayersList();
  const correct = state.flagsCorrect || [];
  const timeMs = state.flagsTimeMs || [];
  const ranking = players.map((n,i) => ({n, correct: correct[i]||0, timeMs: timeMs[i]||0}))
    .sort((a,b) => b.correct - a.correct || a.timeMs - b.timeMs);
  const medals = ['🥇','🥈','🥉'];
  // "из total" — сколько вопросов задавалось КАЖДОМУ игроку (flagsQuestionCount),
  // а не общая длина очереди на всю партию (которая = flagsQuestionCount × число игроков).
  const total = state.flagsQuestionCount || 5;
  let place = 1;
  const listHtml = ranking.map((r,i) => {
    if(i === 0 || ranking[i-1].correct !== r.correct || ranking[i-1].timeMs !== r.timeMs){
      place = i + 1;
    }
    const placeLabel = medals[place-1] || `${place}.`;
    const isFirst = place === 1;
    return `
      <div class="krokodil-summary-row${isFirst ? ' krokodil-summary-first' : ''}">
        <span class="krokodil-summary-place">${placeLabel}</span>
        <span class="krokodil-summary-name">${r.n}</span>
        <span class="krokodil-summary-score">Верно: ${r.correct} из ${total}<br>Время: ${fmtFlagsTime(r.timeMs)}</span>
      </div>
    `;
  }).join('');
  document.getElementById('flagsSummaryList').innerHTML = listHtml;
  showModal('flagsSummaryModal');
}
function goToFlagsGame(){
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
  abandonPausedSession('quiz');
  state.pausedMode = null;
  const n1raw = document.getElementById('name1').value.trim();
  const n2raw = document.getElementById('name2').value.trim();
  state.name1 = n1raw || 'Парень';
  state.name2 = n2raw || 'Девушка';
  const players = flagsPlayersList();
  state.flagsCorrect = new Array(players.length).fill(0);
  state.flagsTimeMs = new Array(players.length).fill(0);
  state.flagsCurrentPlayerIndex = Math.floor(Math.random() * players.length);
  drawFlagsQueue();
  state.inProgress = true;
  saveState();
  document.getElementById('flagsSetup').classList.remove('active');
  goToGame(null, 'flagsGame');
  updateMuteBtn();
  requestWakeLock();
  showFlagsHandoffCard();
}
// Пауза: вернуться в главное меню, не сбрасывая счёт и очередь — можно
// продолжить позже через общий блок "Продолжить игру" / "Закончить игру".
// При паузе отсчёт времени на текущий вопрос останавливается — после
// возобновления снова показывается карточка "Передайте телефон" для того же
// игрока, чей был ход (сам вопрос не засчитывается ни верным, ни неверным).
function pauseFlagsGame(){
  stopFlagsInterval();
  stopFlagsSpeech();
  state.pausedMode = 'flags';
  state.lastPauseView = getCurrentSetupView();
  saveState();
  document.getElementById('flagsGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('twoPlayerView');
  updateResumeUI();
}
function resumeFlagsGame(){
  state.pausedMode = null;
  saveState();
  updateResumeUI();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('flagsGame').classList.add('active');
  updateMuteBtn();
  requestWakeLock();
  showFlagsHandoffCard();
}
// Вызывается из общего "Закончить игру" на главном экране, пока игра стоит
// на паузе — полный сброс без показа итогов (в отличие от exitFlagsGame,
// которая закрывает уже показанное окно результатов после честной партии).
function finishFlagsGame(){
  stopFlagsInterval();
  stopFlagsSpeech();
  state.flagsCorrect = [];
  state.flagsTimeMs = [];
  state.flagsQueue = [];
  state.flagsIndex = 0;
  state.flagsCurrentPlayerIndex = 0;
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  updateResumeUI();
}
function exitFlagsGame(){
  if(typeof stopFlagsSpeech === 'function') stopFlagsSpeech();
  hideModal('flagsSummaryModal');
  finishFlagsGame();
  exitGame('flagsGame', 'flagsSetup');
}
// ===== Подключение к реестру игр =====
function onGameRegistryLoaded(){
  const registry = window.GAME_REGISTRY || [];
  const existing = registry.find(g => g.mode === 'flags');
  if(existing) return; // уже зарегистрировано

  registry.push({
    mode: 'flags', title: '«Флаги»', group: 'two', menuTitle: '🏳️ Флаги',
    pause: 'pauseFlagsGame', resume: 'resumeFlagsGame', finish: 'finishFlagsGame',
    exitSummary: 'showFlagsSummaryModal',
    isEmpty: () => !state.flagsCorrect || !state.flagsCorrect.some((c,i) => c && c > 0 || (state.flagsTimeMs && state.flagsTimeMs[i] > 0)),
    screens: ['flagsGame'],
  });
  window.GAME_REGISTRY = registry;
}

// ===== Экран настройки =====
function renderFlagsSetup(){
  const wrap = document.getElementById('flagsSetup');
  if(!wrap) return;
  wrap.innerHTML = `
    <h1 class="title">🏳️ Флаги</h1>
    <div class="subtitle">Угадайте страну по флагу</div>

    <div class="field">
      <label>Сложность</label>
      <div class="levels" id="flagsSetupLevels"></div>
    </div>

    <div class="field">
      <label>Время на ответ</label>
      <div class="starter-group timer-duration-group" id="flagsAnswerTimeGroup">
        <button type="button" class="starter-btn mode-btn" data-value="10">10 сек</button>
        <button type="button" class="starter-btn mode-btn" data-value="15">15 сек</button>
        <button type="button" class="starter-btn mode-btn" data-value="20">20 сек</button>
      </div>
    </div>

    <div class="field">
      <label>Вопросов в игре</label>
      <div class="starter-group timer-duration-group" id="flagsQuestionCountGroup">
        <button type="button" class="starter-btn mode-btn" data-value="3">3</button>
        <button type="button" class="starter-btn mode-btn" data-value="5">5</button>
        <button type="button" class="starter-btn mode-btn" data-value="7">7</button>
        <button type="button" class="starter-btn mode-btn" data-value="10">10</button>
      </div>
    </div>

    <button class="btn btn-primary" id="flagsSetupStartBtn">Начать</button>

    <button class="btn btn-secondary" id="flagsSetupExitBtn" style="margin-top:10px;">Выход</button>
  `;
  renderFlagsSetupLevels();
  renderFlagsAnswerTimeGroup();
  renderFlagsQuestionCountGroup();
}

// ===== Экран игры =====
function renderFlagsGame(){
  const wrap = document.getElementById('flagsGame');
  if(!wrap) return;
  wrap.innerHTML = `
    <div class="game-level-label">🏳️ Флаги</div>
    <div class="td-turn-label" id="flagsTurnLabel">Отвечает: Игрок 1</div>
    <div class="krokodil-score-row two-player" id="flagsScoreRow"></div>
    <div class="wishlist-progress-row" id="flagsProgressRow">
      <div class="wishlist-progress-track"><div class="wishlist-progress-fill" id="flagsProgressFill"></div></div>
      <div class="wishlist-progress-label" id="flagsProgressLabel">0 / 3</div>
    </div>
    <div class="timer-bar-track" id="flagsBarTrack">
      <div class="timer-bar-fill" id="flagsBarFill"></div>
    </div>

    <div class="card-area">
      <div class="card" id="flagsCard">
        <div class="card-inner">
          <div class="card-body">
            <div class="znayu-question-text" id="flagsQuestionText">Загрузка…</div>
          </div>
          <div class="znayu-answers" id="flagsAnswers"></div>
        </div>
      </div>
    </div>

    <div class="wishlist-actions-row" id="flagsHandoffRow" style="display:none;">
      <button type="button" class="btn btn-primary" id="flagsHandoffStartBtn">Начать</button>
    </div>
    <div class="quiz-pause-row">
      <button type="button" class="btn btn-secondary btn-pause" id="flagsExitBtn">Пауза</button>
    </div>
  `;
}

// ===== Регистрация в системе =====
(function initFlags(){
  document.addEventListener('DOMContentLoaded', () => {
    onGameRegistryLoaded();
    // Подключаем экран настройки и игру после загрузки DOM
    const flagsSetup = document.getElementById('flagsSetup');
    const flagsGame = document.getElementById('flagsGame');

    if(flagsSetup) {
      flagsSetup.addEventListener('click', (e) => {
        if(e.target.id === 'flagsSetupStartBtn') {
          playSuccessSound();
          goToFlagsGame();
        } else if(e.target.id === 'flagsSetupExitBtn') {
          exitFlagsSetup();
        }
      });
    }

    if(flagsGame) {
      flagsGame.addEventListener('click', (e) => {
        if(e.target.id === 'flagsExitBtn') {
          pauseFlagsGame();
          showToast('Игра на паузе — прогресс сохранён');
        } else if(e.target.id === 'flagsHandoffStartBtn') {
          playSuccessSound();
          showFlagsQuestion();
        }
      });
    }

    document.getElementById('flagsSetupStartBtn')?.addEventListener('click', () => { goToFlagsGame(); });
    document.getElementById('flagsSetupExitBtn')?.addEventListener('click', () => { exitFlagsSetup(); });
    (document.getElementById('flagsSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', () => { showModal('flagsRulesModal'); });
    openRulesModal('flagsGameRulesBtn', 'flagsRulesModal');
    setupRulesModal('flagsRulesModal', 'closeFlagsRulesBtn');
  });
})();
