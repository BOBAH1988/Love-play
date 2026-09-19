// games/capitals.js — Игра «Столицы» (обучающая игра: угадать столицу страны).
// Запускается из экрана настроек в хабе обучающих игр. Однопользовательский режим.
// Аналог «Флагов», но вместо флага — название страны, нужно выбрать столицу.

const CAPITALS_COUNT_VALUES = [5, 10, 25, 50];

let capitalsIntervalId = null;
let capitalsDeadline = 0;
let capitalsDurationMs = 10000;
let capitalsAnswered = false;
let capitalsQuestionStartedAt = 0;
let capitalsCurrentOptions = [];
let capitalsShowingQuestion = false;
let capitalsAdvanceTimerId = null; // отложенный переход к следующему вопросу (отменяется при выходе)
let capitalsSpeechTimerId = null;  // отложенный старт озвучки после cancel() (отменяется при выходе)

function getCapitalsCardsList(level){
  if(typeof CAPITALS_CARDS === 'undefined' || !Array.isArray(CAPITALS_CARDS)) return [];
  return CAPITALS_CARDS.filter(c => c.level === level);
}
function capitalsCardKey(card){
  return card.country || `${card.level}:${card.a[0] || ''}`;
}
function stopCapitalsInterval(){
  capitalsIntervalId = stopInterval(capitalsIntervalId);
}
function drawCapitalsQueue(){
  const level = Number(state.capitalsSelectedLevel) || 1;
  const all = getCapitalsCardsList(level);
  const total = CAPITALS_COUNT_VALUES.includes(Number(state.capitalsQuestionCount)) ? Number(state.capitalsQuestionCount) : 5;
  if(all.length === 0){
    state.capitalsQueue = [];
    state.capitalsIndex = 0;
    saveState();
    return;
  }
  if(!state.capitalsUsed || typeof state.capitalsUsed !== 'object' || Array.isArray(state.capitalsUsed)){
    state.capitalsUsed = {};
  }
  let used = Array.isArray(state.capitalsUsed[level])
    ? state.capitalsUsed[level].filter(key => key !== undefined && key !== null && key !== '')
    : [];
  let pool = shuffle(all.filter(c => !used.includes(capitalsCardKey(c))));
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
    part.forEach(c => used.push(capitalsCardKey(c)));
    pool = pool.slice(take);
  }
  state.capitalsUsed[level] = used;
  state.capitalsQueue = chosen;
  state.capitalsIndex = 0;
  saveState();
}
function capitalsQuestionHtml(item, answersHtml){
  const flagHtml = item.flag ? `<img class="flags-card-image" src="${item.flag}" alt="Флаг страны" loading="eager">` : '';
  return `<div class="card-inner"><div class="flags-card-media">${flagHtml}</div><div class="card-body"><div class="znayu-question-text">Столица ${item.country}</div></div><div class="znayu-answers">${answersHtml}</div><div class="quiz-tts-hint" id="capitalsTtsHint">🔊</div></div>`;
}
function updateCapitalsProgressUI(){
  const total = state.capitalsQueue.length || (CAPITALS_COUNT_VALUES.includes(Number(state.capitalsQuestionCount)) ? Number(state.capitalsQuestionCount) : 5);
  const current = Math.min((state.capitalsIndex || 0) + 1, total);
  const label = document.getElementById('capitalsProgressLabel');
  const fill = document.getElementById('capitalsProgressFill');
  if(label) label.textContent = `Карточка ${current} / ${total}`;
  if(fill) fill.style.width = `${total ? (current / total) * 100 : 0}%`;
}
function showCapitalsQuestion(){
  stopCapitalsInterval();
  const item = state.capitalsQueue[state.capitalsIndex];
  if(!item){
    capitalsShowingQuestion = false;
    fadeSwapEl('capitalsCard', (el) => {
      el.className = 'card card-empty';
      el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon">🏛️</div><div class="card-text">Не удалось загрузить вопросы — попробуйте обновить приложение</div></div></div>`;
    });
    updateCapitalsProgressUI();
    return;
  }
  capitalsAnswered = false;
  const opts = [
    {text:item.a[0], correct:true},
    {text:item.a[1], correct:false},
    {text:item.a[2], correct:false},
    {text:item.a[3], correct:false},
  ];
  capitalsCurrentOptions = shuffle(opts);
  capitalsQuestionStartedAt = Date.now();
  capitalsDurationMs = (state.capitalsAnswerSeconds || 10) * 1000;
  capitalsDeadline = capitalsQuestionStartedAt + capitalsDurationMs;
  fadeSwapEl('capitalsCard', (el) => {
    el.className = 'card';
    const answersHtml = capitalsCurrentOptions.map((o,i) => `<button type="button" class="btn btn-secondary znayu-answer-btn" data-idx="${i}">${o.text}</button>`).join('');
    el.innerHTML = capitalsQuestionHtml(item, answersHtml);
    el.querySelectorAll('.znayu-answer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        answerCapitalsQuestion(parseInt(btn.dataset.idx, 10));
      });
    });
    updateCapitalsProgressUI();
  });
  capitalsShowingQuestion = true;
  if(state.autoSpeak) speakCapitalsCard();
  capitalsIntervalId = setInterval(capitalsTick, 100);
}
function capitalsTick(){
  const remaining = capitalsDeadline - Date.now();
  if(remaining <= 0){
    stopCapitalsInterval();
    if(!capitalsAnswered) answerCapitalsQuestion(-1);
  }
}
function answerCapitalsQuestion(choiceIdx){
  if(capitalsAnswered) return;
  capitalsAnswered = true;
  stopCapitalsInterval();
  const elapsed = Math.min(Date.now() - capitalsQuestionStartedAt, capitalsDurationMs);
  if(!state.capitalsCorrect) state.capitalsCorrect = 0;
  if(!state.capitalsTimeMs) state.capitalsTimeMs = 0;
  state.capitalsTimeMs += elapsed;
  const isCorrect = choiceIdx >= 0 && capitalsCurrentOptions[choiceIdx] && capitalsCurrentOptions[choiceIdx].correct;
  if(isCorrect){
    state.capitalsCorrect++;
    playSuccessSound();
  } else {
    playFailSound();
    if(choiceIdx < 0) showToast('⏰ Время вышло — ответ не выбран, засчитано как неверно');
  }
  document.querySelectorAll('#capitalsCard .znayu-answer-btn').forEach((btn, i) => {
    btn.disabled = true;
    if(capitalsCurrentOptions[i] && capitalsCurrentOptions[i].correct) btn.classList.add('answer-correct');
    else if(i === choiceIdx) btn.classList.add('answer-wrong');
  });
  saveState();
  updateCapitalsScoreUI();
  updateCapitalsProgressUI();
  if(capitalsAdvanceTimerId) clearTimeout(capitalsAdvanceTimerId);
  capitalsAdvanceTimerId = setTimeout(advanceCapitalsQueue, 900);
}
function updateCapitalsScoreUI(){
  const wrap = document.getElementById('capitalsScoreRow');
  if(wrap){
    wrap.innerHTML = '';
    const span = document.createElement('span');
    span.className = 'krokodil-score-item active';
    span.textContent = 'Вы: ' + (state.capitalsCorrect || 0);
    wrap.appendChild(span);
  }
}
function advanceCapitalsQueue(){
  state.capitalsIndex = (state.capitalsIndex || 0) + 1;
  const total = state.capitalsQueue.length;
  if(state.capitalsIndex >= total){
    saveState();
    showCapitalsSummaryModal();
    return;
  }
  showCapitalsQuestion();
}
function pickCapitalsVoice(){
  if(!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const ru = voices.filter(v => /^ru/i.test(v.lang));
  const pool = ru.length ? ru : voices;
  const female = pool.find(v => /female|женск|milena|olga|katya/i.test(v.name));
  return female || pool[0] || null;
}
function stopCapitalsSpeech(){
  if(capitalsSpeechTimerId){ clearTimeout(capitalsSpeechTimerId); capitalsSpeechTimerId = null; }
  stopSpeech('capitalsTtsHint');
}
function speakCapitalsCard(){
  const item = state.capitalsQueue && state.capitalsQueue[state.capitalsIndex];
  if(!item || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  const content = ['Столица ' + item.country, ...capitalsCurrentOptions.map((option, index) => `Вариант ${index + 1}: ${option.text}`)].join('. ');
  const text = typeof stripQuotesForSpeech === 'function' ? stripQuotesForSpeech(content) : content;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ru-RU';
  utter.rate = 0.95;
  const voice = pickCapitalsVoice();
  if(voice) utter.voice = voice;
  const hint = document.getElementById('capitalsTtsHint');
  const fire = () => {
    capitalsSpeechTimerId = null;
    const current = state.capitalsQueue && state.capitalsQueue[state.capitalsIndex];
    if(current !== item) return;
    if(hint) hint.classList.add('speaking');
    utter.onend = () => { if(hint) hint.classList.remove('speaking'); };
    utter.onerror = () => { if(hint) hint.classList.remove('speaking'); };
    synth.speak(utter);
  };
  if(synth.speaking || synth.pending){
    synth.cancel();
    capitalsSpeechTimerId = setTimeout(fire, 50);
  } else {
    fire();
  }
}
// Клик по карточке (не по кнопке ответа) — повторная озвучка вопроса.
// Слушатель навешан делегированием на document: renderCapitalsGame()
// пересоздаёт #capitalsCard, и прямая привязка к элементу отмирала бы
// после первой перерисовки (та же регрессия была у «Флагов»).
document.addEventListener('click', (e) => {
  if(!e.target.closest('#capitalsCard')) return;
  if(e.target.closest('.znayu-answer-btn')) return;
  if(!capitalsShowingQuestion) return;
  speakCapitalsCard();
});
function fmtCapitalsTime(ms){
  return (ms/1000).toFixed(1).replace('.', ',') + ' сек';
}
function showCapitalsSummaryModal(){
  const correct = state.capitalsCorrect || 0;
  const timeMs = state.capitalsTimeMs || 0;
  const total = CAPITALS_COUNT_VALUES.includes(Number(state.capitalsQuestionCount)) ? Number(state.capitalsQuestionCount) : 5;
  const medals = ['🥇','🥈','🥉'];
  const place = 1;
  const listHtml = `
    <div class="krokodil-summary-row">
      <span class="krokodil-summary-place">${medals[place-1]}</span>
      <span class="krokodil-summary-name">Вы</span>
      <span class="krokodil-summary-score">Верно: ${correct} из ${total}<br>Время: ${fmtCapitalsTime(timeMs)}</span>
    </div>
  `;
  document.getElementById('capitalsSummaryList').innerHTML = listHtml;
  showModal('capitalsSummaryModal');
}
function goToCapitalsSetup(){
  goToGameSetup('capitalsSetup', 'learningView', ()=>{
    renderCapitalsLevelGroup();
    renderCapitalsCountGroup();
  });
}
function exitCapitalsSetup(){
  const setup = document.getElementById('capitalsSetup');
  if(setup) setup.classList.remove('active');
  const hub = document.getElementById('setup');
  if(hub) hub.classList.add('active');
  showSetupView('learningView');
}
function renderCapitalsLevelGroup(){
  const levels = typeof CAPITALS_LEVELS !== 'undefined' && Array.isArray(CAPITALS_LEVELS) ? CAPITALS_LEVELS : [];
  const selected = Number(state.capitalsSelectedLevel);
  if(!levels.some(level => level.id === selected)){
    state.capitalsSelectedLevel = 1;
    saveState();
  } else if(state.capitalsSelectedLevel !== selected){
    state.capitalsSelectedLevel = selected;
    saveState();
  }
  document.querySelectorAll('#capitalsLevelGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === Number(state.capitalsSelectedLevel));
  });
}
function renderCapitalsCountGroup(){
  const count = Number(state.capitalsQuestionCount);
  if(!CAPITALS_COUNT_VALUES.includes(count)){
    state.capitalsQuestionCount = 5;
    saveState();
  }
  document.querySelectorAll('#capitalsCountGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === Number(state.capitalsQuestionCount));
  });
}
function goToCapitalsGame(){
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
  state.capitalsSelectedLevel = Number(state.capitalsSelectedLevel) || 1;
  state.capitalsAnswerSeconds = state.capitalsAnswerSeconds || 10;
  state.capitalsQuestionCount = CAPITALS_COUNT_VALUES.includes(Number(state.capitalsQuestionCount)) ? Number(state.capitalsQuestionCount) : 5;
  state.capitalsCorrect = 0;
  state.capitalsTimeMs = 0;
  state.capitalsIndex = 0;
  drawCapitalsQueue();
  renderCapitalsGame();
  goToGame('capitalsSetup', 'capitalsGame');
  updateMuteBtn();
  requestWakeLock();
  showCapitalsQuestion();
}
function exitCapitalsGame(){
  stopCapitalsInterval();
  stopCapitalsSpeech();
  if(capitalsAdvanceTimerId){ clearTimeout(capitalsAdvanceTimerId); capitalsAdvanceTimerId = null; }
  capitalsShowingQuestion = false;
  stopAllSounds();
  hideModal('capitalsSummaryModal');
  state.inProgress = false;
  state.pausedMode = null;
  state.lastSectionOnPause = null;
  saveState();
  exitGame('capitalsGame', 'capitalsSetup');
  goToCapitalsSetup();
  updateResumeUI();
}
function renderCapitalsGame(){
  const wrap = document.getElementById('capitalsGame');
  if(!wrap) return;
  const total = CAPITALS_COUNT_VALUES.includes(Number(state.capitalsQuestionCount)) ? Number(state.capitalsQuestionCount) : 5;
  wrap.innerHTML = `
    <div class="game-level-label">🏛️ Столицы</div>
    <div class="krokodil-score-row two-player" id="capitalsScoreRow"></div>
    <div class="wishlist-progress-row" id="capitalsProgressRow">
      <div class="wishlist-progress-track"><div class="wishlist-progress-fill" id="capitalsProgressFill"></div></div>
      <div class="wishlist-progress-label" id="capitalsProgressLabel">0 / ${total}</div>
    </div>
    <div class="card-area">
      <div class="card" id="capitalsCard">
        <div class="card-inner">
          <div class="card-body">
            <div class="znayu-question-text" id="capitalsQuestionText">Загрузка…</div>
          </div>
          <div class="znayu-answers" id="capitalsAnswers"></div>
        </div>
      </div>
    </div>
  `;
}
function onGameRegistryLoaded(){
  const registry = window.GAME_REGISTRY || [];
  const existing = registry.find(g => g.mode === 'capitals');
  if(existing) return;
  registry.push({
    mode: 'capitals', title: '«Столицы»', group: 'two', menuTitle: '🏛️ Столицы',
    noPause: true, back: 'exitCapitalsGame',
    screens: ['capitalsGame'],
  });
  window.GAME_REGISTRY = registry;
}
(function initCapitals(){
  document.addEventListener('DOMContentLoaded', () => {
    onGameRegistryLoaded();
    renderCapitalsLevelGroup();
    renderCapitalsCountGroup();
    document.querySelectorAll('#capitalsLevelGroup .starter-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        playSuccessSound();
        state.capitalsSelectedLevel = parseInt(btn.dataset.value, 10);
        saveState();
        renderCapitalsLevelGroup();
      });
    });
    document.querySelectorAll('#capitalsCountGroup .starter-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        playSuccessSound();
        state.capitalsQuestionCount = parseInt(btn.dataset.value, 10);
        saveState();
        renderCapitalsCountGroup();
      });
    });
    document.getElementById('capitalsSetupStartBtn')?.addEventListener('click', () => {
      playSuccessSound();
      goToCapitalsGame();
    });
    document.getElementById('capitalsSetupExitBtn')?.addEventListener('click', () => {
      exitCapitalsSetup();
    });
    document.getElementById('closeCapitalsSummaryBtn')?.addEventListener('click', () => {
      exitCapitalsGame();
    });
    setupRulesModal('capitalsRulesModal', 'closeCapitalsRulesBtn');
  });
})();
