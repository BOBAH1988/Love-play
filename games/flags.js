// games/flags.js — Игра "Флаги" (обучающая игра: угадать страну по флагу).
// Запускается прямо из хаба обучающих игр. Однопользовательский режим.

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
function stopFlagsInterval(){
  flagsIntervalId = stopInterval(flagsIntervalId);
}
function drawFlagsQueue(){
  const level = state.flagsSelectedLevel || 1;
  const all = getFlagsCardsList(level);
  const total = state.flagsQuestionCount || 5;
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
function showFlagsQuestion(){
  stopFlagsInterval();
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
  if(state.autoSpeak) speakFlagsCard();
  flagsIntervalId = setInterval(flagsTick, 100);
}
function flagsTick(){
  const remaining = flagsDeadline - Date.now();
  if(remaining <= 0){
    stopFlagsInterval();
    if(!flagsAnswered) answerFlagsQuestion(-1);
  }
}
function answerFlagsQuestion(choiceIdx){
  if(flagsAnswered) return;
  flagsAnswered = true;
  stopFlagsInterval();
  const elapsed = Math.min(Date.now() - flagsQuestionStartedAt, flagsDurationMs);
  if(!state.flagsCorrect) state.flagsCorrect = 0;
  if(!state.flagsTimeMs) state.flagsTimeMs = 0;
  state.flagsTimeMs += elapsed;
  const isCorrect = choiceIdx >= 0 && flagsCurrentOptions[choiceIdx] && flagsCurrentOptions[choiceIdx].correct;
  if(isCorrect){
    state.flagsCorrect++;
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
function updateFlagsScoreUI(){
  const wrap = document.getElementById('flagsScoreRow');
  if(wrap){
    wrap.innerHTML = '';
    const span = document.createElement('span');
    span.className = 'krokodil-score-item active';
    span.textContent = 'Вы: ' + (state.flagsCorrect || 0);
    wrap.appendChild(span);
  }
}
function advanceFlagsQueue(){
  state.flagsIndex = (state.flagsIndex || 0) + 1;
  const total = state.flagsQueue.length;
  if(state.flagsIndex >= total){
    saveState();
    showFlagsSummaryModal();
    return;
  }
  showFlagsQuestion();
}
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
    if(current !== item) return;
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
function showFlagsSummaryModal(){
  const correct = state.flagsCorrect || 0;
  const timeMs = state.flagsTimeMs || 0;
  const total = state.flagsQuestionCount || 5;
  const medals = ['🥇','🥈','🥉'];
  const place = 1;
  const listHtml = `
    <div class="krokodil-summary-row">
      <span class="krokodil-summary-place">${medals[place-1]}</span>
      <span class="krokodil-summary-name">Вы</span>
      <span class="krokodil-summary-score">Верно: ${correct} из ${total}<br>Время: ${fmtFlagsTime(timeMs)}</span>
    </div>
  `;
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
  state.flagsSelectedLevel = state.flagsSelectedLevel || 1;
  state.flagsAnswerSeconds = state.flagsAnswerSeconds || 10;
  state.flagsQuestionCount = state.flagsQuestionCount || 5;
  state.flagsCorrect = 0;
  state.flagsTimeMs = 0;
  state.flagsIndex = 0;
  drawFlagsQueue();
  state.inProgress = true;
  saveState();
  rememberReturnScreen('setup', 'learningView');
  renderFlagsGame();
  goToGame(null, 'flagsGame');
  updateMuteBtn();
  requestWakeLock();
  showFlagsQuestion();
}
function resumeFlagsGame(){
  state.pausedMode = null;
  state.inProgress = true;
  saveState();
  renderFlagsGame();
  goToGame(null, 'flagsGame');
  updateMuteBtn();
  requestWakeLock();
  showFlagsQuestion();
}
function pauseFlagsGame(){
  stopFlagsInterval();
  stopFlagsSpeech();
  state.pausedMode = 'flags';
  state.lastPauseView = 'learningView';
  saveState();
  document.getElementById('flagsGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('learningView');
  updateResumeUI();
}
function exitFlagsGame(){
  stopFlagsInterval();
  stopFlagsSpeech();
  stopAllSounds();
  hideModal('flagsSummaryModal');
  state.inProgress = false;
  state.pausedMode = null;
  state.lastSectionOnPause = null;
  saveState();
  exitGame('flagsGame', 'setup');
  showSetupView('learningView');
  updateResumeUI();
}
function renderFlagsGame(){
  const wrap = document.getElementById('flagsGame');
  if(!wrap) return;
  wrap.innerHTML = `
    <div class="game-level-label">🏳️ Флаги</div>
    <div class="krokodil-score-row two-player" id="flagsScoreRow"></div>
    <div class="wishlist-progress-row" id="flagsProgressRow">
      <div class="wishlist-progress-track"><div class="wishlist-progress-fill" id="flagsProgressFill"></div></div>
      <div class="wishlist-progress-label" id="flagsProgressLabel">0 / 5</div>
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
    <div class="quiz-pause-row">
      <button type="button" class="btn btn-secondary btn-pause" id="flagsExitBtn">Пауза</button>
    </div>
  `;
}
function onGameRegistryLoaded(){
  const registry = window.GAME_REGISTRY || [];
  const existing = registry.find(g => g.mode === 'flags');
  if(existing) return;
  registry.push({
    mode: 'flags', title: '«Флаги»', group: 'two', menuTitle: '🏳️ Флаги',
    pause: 'pauseFlagsGame', resume: 'resumeFlagsGame',
    exitSummary: 'showFlagsSummaryModal',
    isEmpty: () => !(state.flagsCorrect > 0),
    finishEmpty: 'exitFlagsGame',
    screens: ['flagsGame'],
  });
  window.GAME_REGISTRY = registry;
}
(function initFlags(){
  document.addEventListener('DOMContentLoaded', () => {
    onGameRegistryLoaded();
    const flagsExitBtn = document.getElementById('flagsExitBtn');
    const flagsGame = document.getElementById('flagsGame');
    if(flagsGame){
      flagsGame.addEventListener('click', (e) => {
        if(e.target.id === 'flagsExitBtn'){
          pauseFlagsGame();
          showToast('Игра на паузе — прогресс сохранён');
        }
      });
    }
    document.getElementById('closeFlagsSummaryBtn')?.addEventListener('click', () => {
      exitFlagsGame();
    });
    openRulesModal('flagsGameRulesBtn', 'flagsRulesModal');
    setupRulesModal('flagsRulesModal', 'closeFlagsRulesBtn');
  });
})();
