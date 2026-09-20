// games/times-table.js — Игра «Арифметика» (обучающая, по образцу «Столиц»).
// Вопросы генерируются программно: a × b = ? с 4 вариантами ответа.
// Тема «Умножение» — рабочая; «Деление», «Сложение» и «Вычитание» —
// заглушки: кнопки есть в настройках, но партия по ним пока не стартует.
// Запускается из экрана настроек в хабе обучающих игр. Однопользовательский режим, без паузы.

const TIMES_TABLE_COUNT_VALUES = [5, 10, 25, 50];
const TIMES_TABLE_TOPICS = [
  { id: 'multiply', name: 'Умножение' },
  { id: 'divide', name: 'Деление' },
  { id: 'add', name: 'Сложение' },
  { id: 'subtract', name: 'Вычитание' },
];
const TIMES_TABLE_LEVELS = [
  { id: 1, name: '⭐', desc: '5 сек' },
  { id: 2, name: '⭐⭐', desc: '3 сек' },
  { id: 3, name: '⭐⭐⭐', desc: '1,5 сек' },
];

let timesTableIntervalId = null;
let timesTableDeadline = 0;
let timesTableDurationMs = 10000;
let timesTableAnswered = false;
let timesTableQuestionStartedAt = 0;
let timesTableCurrentOptions = [];
let timesTableShowingQuestion = false;
let timesTableAdvanceTimerId = null;
let timesTableSpeakTimerId = null;

function timesTableMulRange(level){
  // Все уровни используют полный пул примеров 1–10: от уровня зависит
  // только время на ответ (см. timesTableLevelAnswerSeconds).
  void level;
  return [1, 10];
}

function timesTableLevelAnswerSeconds(level){
  // Время на ответ зависит от уровня сложности:
  //   ⭐  — 5 секунд,
  //   ⭐⭐ — 3 секунды,
  //   ⭐⭐⭐ — 1,5 секунды.
  // Эти значения берутся вместо общего timesTableAnswerSeconds,
  // который теперь остаётся в state только для обратной совместимости.
  if(level === 1) return 5;
  if(level === 2) return 3;
  if(level === 3) return 1.5;
  return 10;
}

function timesTableCardKey(card){
  return `${card.a}x${card.b}`;
}

function stopTimesTableInterval(){
  timesTableIntervalId = stopInterval(timesTableIntervalId);
}
function stopTimesTableAdvanceTimer(){
  if(timesTableAdvanceTimerId){
    clearTimeout(timesTableAdvanceTimerId);
    timesTableAdvanceTimerId = null;
  }
}
function stopTimesTableSpeakTimer(){
  if(timesTableSpeakTimerId){
    clearTimeout(timesTableSpeakTimerId);
    timesTableSpeakTimerId = null;
  }
}
function stopTimesTableSpeech(){
  try{
    if(window.speechSynthesis) window.speechSynthesis.cancel();
  }catch(e){}
  stopSpeech('timesTableTtsHint');
}

function drawTimesTableQueue(){
  const level = Number(state.timesTableSelectedLevel) || 1;
  const [minA, maxB] = timesTableMulRange(level);
  const total = TIMES_TABLE_COUNT_VALUES.includes(Number(state.timesTableQuestionCount)) ? Number(state.timesTableQuestionCount) : 10;
  state.timesTableUsed[level] = state.timesTableUsed[level] || [];
  const usedKeys = new Set(state.timesTableUsed[level]);
  const queue = [];
  const seen = new Set();
  const poolSize = (maxB - minA + 1) * (maxB - minA + 1);
  let guard = 0;
  while(queue.length < total && guard < total * 30){
    guard++;
    const a = minA + Math.floor(Math.random() * (maxB - minA + 1));
    const b = minA + Math.floor(Math.random() * (maxB - minA + 1));
    const key = `${a}x${b}`;
    if(seen.size >= poolSize){
      // Пул уровня исчерпан — добираем повторами (как во «Флагах»).
    } else if(seen.has(key)) continue;
    if(usedKeys.has(key) && seen.size + usedKeys.size < poolSize) continue;
    seen.add(key);
    queue.push({ a, b, level });
  }
  state.timesTableQueue = queue;
  state.timesTableIndex = 0;
}

function timesTableOptions(a, b){
  const answer = a * b;
  const set = new Set([answer]);
  let guard = 0;
  while(set.size < 4 && guard < 100){
    guard++;
    const delta = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10][Math.floor(Math.random() * 10)];
    const candidate = answer + (Math.random() < 0.5 ? -delta : delta);
    if(candidate > 0) set.add(candidate);
  }
  const arr = Array.from(set);
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function timesTableQuestionHtml(item, answersHtml){
  // Разметка карточки — как у «Флагов»/«Столиц»: card-body с вопросом
  // (.znayu-question-text), ниже .znayu-answers с кнопками ответов и
  // иконка-подсказка озвучки. Пример (7 × 8 = ?) занимает место вопроса.
  return `<div class="card-inner"><div class="card-body"><div class="znayu-question-text">${item.a} × ${item.b} = ?</div></div><div class="znayu-answers">${answersHtml}</div><div class="quiz-tts-hint" id="timesTableTtsHint">🔊</div></div>`;
}

function updateTimesTableProgressUI(){
  const total = TIMES_TABLE_COUNT_VALUES.includes(Number(state.timesTableQuestionCount)) ? Number(state.timesTableQuestionCount) : 10;
  const done = Math.min(state.timesTableIndex, total);
  const fill = document.getElementById('timesTableProgressFill');
  const label = document.getElementById('timesTableProgressLabel');
  if(fill) fill.style.width = `${(done / total) * 100}%`;
  if(label) label.textContent = `${done} / ${total}`;
}
function showTimesTableQuestion(){
  const queue = state.timesTableQueue || [];
  const item = queue[state.timesTableIndex];
  const card = document.getElementById('timesTableCard');
  if(!item || !card){
    showTimesTableSummaryModal();
    return;
  }
  timesTableCurrentOptions = timesTableOptions(item.a, item.b);
  timesTableAnswered = false;
  timesTableShowingQuestion = true;
  timesTableQuestionStartedAt = Date.now();
  const buttonsHtml = timesTableCurrentOptions.map((opt, idx) =>
    `<button type="button" class="btn btn-secondary znayu-answer-btn" data-idx="${idx}">${opt}</button>`
  ).join('');
  card.innerHTML = timesTableQuestionHtml(item, buttonsHtml);
  card.querySelectorAll('.znayu-answer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      answerTimesTableQuestion(parseInt(btn.dataset.idx, 10));
    });
  });
  timesTableDurationMs = timesTableLevelAnswerSeconds(state.timesTableSelectedLevel) * 1000;
  timesTableDeadline = Date.now() + timesTableDurationMs;
  updateTimesTableProgressUI();
  updateTimesTableScoreUI();
  stopTimesTableInterval();
  timesTableIntervalId = setInterval(timesTableTick, 100);
  if(state.autoSpeak) speakTimesTableCard();
}

function timesTableTick(){
  // Эталон викторины (games/quiz.js → quizTick) и флагов (games/flags.js →
  // flagsTick): тик сам флаг НЕ ставит — ответ с choiceIdx = -1 делает это
  // сам (timesTableAnswered + подсветка в answerTimesTableQuestion).
  const remaining = timesTableDeadline - Date.now();
  if(remaining <= 0){
    stopTimesTableInterval();
    if(!timesTableAnswered) answerTimesTableQuestion(-1);
  }
}

function answerTimesTableQuestion(choiceIdx){
  // Эталон: games/quiz.js → answerQuizQuestion (choiceIdx = -1 при тайм-ауте).
  if(timesTableAnswered) return;
  timesTableAnswered = true;
  timesTableShowingQuestion = false;
  stopTimesTableInterval();
  stopTimesTableSpeech();
  const queue = state.timesTableQueue || [];
  const item = queue[state.timesTableIndex];
  if(!item) return;
  const answer = item.a * item.b;
  // Эталон викторины (games/quiz.js): choiceIdx >= 0 — при тайм-ауте (-1)
  // isCorrect всегда false, очко не засчитывается.
  const chosen = choiceIdx >= 0 ? timesTableCurrentOptions[choiceIdx] : null;
  const correct = chosen === answer;
  if(correct){
    state.timesTableCorrect++;
    playSuccessSound();
  } else {
    playErrorSound();
  }
  // Эталон викторины: зелёная подсветка верного варианта — подсказка,
  // очко за неё НЕ начисляется (state.timesTableCorrect не растёт).

  state.timesTableTimeMs += Date.now() - timesTableQuestionStartedAt;
  const key = timesTableCardKey(item);
  const lvl = Number(state.timesTableSelectedLevel) || 1;
  state.timesTableUsed[lvl] = state.timesTableUsed[lvl] || [];
  if(!state.timesTableUsed[lvl].includes(key)) state.timesTableUsed[lvl].push(key);
  const card = document.getElementById('timesTableCard');
  if(card){
    // Эталон викторины: верный вариант — только answer-correct (зелёный контур),
    // выбранный неверный — только answer-wrong (красный). else-логика, а не два
    // независимых тернарника: иначе при верном ответе одна кнопка получала оба
    // класса и красный перебивал зелёный.
    const answersHtml = timesTableCurrentOptions.map(opt =>{
      let cls = 'btn btn-secondary znayu-answer-btn';
      if(opt === answer) cls += ' answer-correct';
      else if(opt === chosen) cls += ' answer-wrong';
      return `<button type="button" class="${cls}" disabled>${opt}</button>`;
    }).join('');
    card.innerHTML = timesTableQuestionHtml(item, answersHtml);
  }
  updateTimesTableScoreUI();
  stopTimesTableAdvanceTimer();
  timesTableAdvanceTimerId = setTimeout(advanceTimesTableQueue, 1200);
}

function advanceTimesTableQueue(){
  stopTimesTableAdvanceTimer();
  const total = TIMES_TABLE_COUNT_VALUES.includes(Number(state.timesTableQuestionCount)) ? Number(state.timesTableQuestionCount) : 10;
  state.timesTableIndex++;
  updateTimesTableProgressUI();
  if(state.timesTableIndex >= total || state.timesTableIndex >= (state.timesTableQueue || []).length){
    showTimesTableSummaryModal();
    return;
  }
  showTimesTableQuestion();
}

function updateTimesTableScoreUI(){
  const el = document.getElementById('timesTableScoreRow');
  if(!el) return;
  const total = TIMES_TABLE_COUNT_VALUES.includes(Number(state.timesTableQuestionCount)) ? Number(state.timesTableQuestionCount) : 10;
  el.innerHTML = `
    <div class="krokodil-score-item"><span class="krokodil-score-label">Верно</span> <span class="krokodil-score-value">${state.timesTableCorrect}</span></div>
    <div class="krokodil-score-item"><span class="krokodil-score-label">Осталось</span> <span class="krokodil-score-value">${Math.max(0, total - state.timesTableIndex - (timesTableAnswered ? 0 : 1))}</span></div>
  `;
}

function fmtTimesTableTime(ms){
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m} мин ${r} с` : `${r} с`;
}

function showTimesTableSummaryModal(){
  stopTimesTableInterval();
  stopTimesTableAdvanceTimer();
  stopTimesTableSpeech();
  stopTimesTableSpeakTimer();
  const total = TIMES_TABLE_COUNT_VALUES.includes(Number(state.timesTableQuestionCount)) ? Number(state.timesTableQuestionCount) : 10;
  const list = document.getElementById('timesTableSummaryList');
  if(list){
    const pct = total ? Math.round((state.timesTableCorrect / total) * 100) : 0;
    const medal = pct >= 90 ? '🥇 Отлично!' : pct >= 70 ? '🥈 Хорошо!' : pct >= 50 ? '🥉 Неплохо!' : '📚 Потренируйся ещё!';
    list.innerHTML = `
      <div class="krokodil-summary-item"><span>Верно</span><span>${state.timesTableCorrect} из ${total}</span></div>
      <div class="krokodil-summary-item"><span>Время</span><span>${fmtTimesTableTime(state.timesTableTimeMs)}</span></div>
      <div class="krokodil-summary-item"><span>Итог</span><span>${medal}</span></div>
    `;
  }
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  showModal('timesTableSummaryModal');
  updateResumeUI();
}

function goToTimesTableSetup(){
  stopTimesTableInterval();
  stopTimesTableAdvanceTimer();
  stopTimesTableSpeech();
  stopTimesTableSpeakTimer();
  state.pausedMode = null;
  // Сигнатура goToGameSetup(gameSetupId, targetView, beforeSwitch) — как у
  // «Флагов» и «Столиц». Раньше здесь стоял goToGame('learningView', ...),
  // из-за чего вызов падал с «goToTimesTableSetup is not defined».
  goToGameSetup('timesTableSetup', 'learningView', ()=>{
    renderTimesTableTopicGroup();
    renderTimesTableLevelGroup();
    renderTimesTableCountGroup();
  });
  updateMuteBtn();
  saveState();
}

function exitTimesTableSetup(){
  playSuccessSound();
  const setup = document.getElementById('timesTableSetup');
  if(setup) setup.classList.remove('active');
  const hub = document.getElementById('setup');
  if(hub) hub.classList.add('active');
  showSetupView('learningView');
}

function timesTableTopicName(topic){
  const found = TIMES_TABLE_TOPICS.find(t => t.id === topic);
  return found ? found.name : 'Умножение';
}

function renderTimesTableTopicGroup(){
  const wrap = document.getElementById('timesTableTopicGroup');
  if(!wrap) return;
  if(state.timesTableTopic !== 'multiply'){ state.timesTableTopic = 'multiply'; saveState(); }
  wrap.querySelectorAll('.starter-btn').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.value === 'multiply');
  });
}

function renderTimesTableLevelGroup(){
  const wrap = document.getElementById('timesTableLevelGroup');
  if(!wrap) return;
  wrap.querySelectorAll('.starter-btn').forEach(btn => {
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (Number(state.timesTableSelectedLevel) || 1));
  });
}

function renderTimesTableCountGroup(){
  const wrap = document.getElementById('timesTableCountGroup');
  if(!wrap) return;
  wrap.querySelectorAll('.starter-btn').forEach(btn => {
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (Number(state.timesTableQuestionCount) || 10));
  });
}

function pickTimesTableVoice(){
  try{
    const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    return voices.find(v => v.lang && v.lang.startsWith('ru')) || null;
  }catch(e){ return null; }
}

function speakTimesTableCard(){
  if(state.mute === true) return;
  const item = (state.timesTableQueue || [])[state.timesTableIndex];
  if(!item) return;
  stopTimesTableSpeech();
  stopTimesTableSpeakTimer();
  const hint = document.getElementById('timesTableTtsHint');
  const text = `${item.a} умножить на ${item.b}`;
  timesTableSpeakTimerId = setTimeout(() => {
    timesTableSpeakTimerId = null;
    try{
      const u = new SpeechSynthesisUtterance(text);
      const v = pickTimesTableVoice();
      if(v) u.voice = v;
      u.lang = 'ru-RU';
      if(hint) hint.classList.add('speaking');
      u.onend = () => { if(hint) hint.classList.remove('speaking'); };
      u.onerror = () => { if(hint) hint.classList.remove('speaking'); };
      window.speechSynthesis.speak(u);
    }catch(e){}
  }, 50);
}
// Клик по карточке (не по кнопке ответа) — повторная озвучка задания, как
// во «Флагах»/«Столицах». Слушатель навешан делегированием на document:
// renderTimesTableGame() пересоздаёт #timesTableCard, и прямая привязка к
// элементу отмирала бы после первой перерисовки.
document.addEventListener('click', (e) => {
  if(!e.target.closest('#timesTableCard')) return;
  if(e.target.closest('.znayu-answer-btn')) return;
  if(!timesTableShowingQuestion) return;
  speakTimesTableCard();
});

function goToTimesTableGame(){
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
  if(state.timesTableTopic !== 'multiply'){ state.timesTableTopic = 'multiply'; saveState(); }
  state.timesTableSelectedLevel = Number(state.timesTableSelectedLevel) || 1;
  state.timesTableAnswerSeconds = state.timesTableAnswerSeconds || 5;
  state.timesTableQuestionCount = TIMES_TABLE_COUNT_VALUES.includes(Number(state.timesTableQuestionCount)) ? Number(state.timesTableQuestionCount) : 10;
  state.timesTableCorrect = 0;
  state.timesTableTimeMs = 0;
  state.timesTableIndex = 0;
  drawTimesTableQueue();
  renderTimesTableGame();
  goToGame('timesTableSetup', 'timesTableGame');
  updateMuteBtn();
  requestWakeLock();
  showTimesTableQuestion();
}

function exitTimesTableGame(){
  stopTimesTableInterval();
  stopTimesTableAdvanceTimer();
  stopTimesTableSpeech();
  stopTimesTableSpeakTimer();
  stopAllSounds();
  hideModal('timesTableSummaryModal');
  state.inProgress = false;
  state.pausedMode = null;
  state.lastSectionOnPause = null;
  saveState();
  exitGame('timesTableGame', 'timesTableSetup');
  goToTimesTableSetup();
  updateResumeUI();
}

function renderTimesTableGame(){
  const wrap = document.getElementById('timesTableGame');
  if(!wrap) return;
  wrap.innerHTML = `
    <div class="game-level-label">🔢 Арифметика</div>
    <div class="krokodil-score-row two-player" id="timesTableScoreRow"></div>
    <div class="wishlist-progress-row" id="timesTableProgressRow">
      <div class="wishlist-progress-track"><div class="wishlist-progress-fill" id="timesTableProgressFill"></div></div>
      <div class="wishlist-progress-label" id="timesTableProgressLabel">0 / 10</div>
    </div>
    <div class="card-area">
      <div class="card" id="timesTableCard"></div>
    </div>
  `;
}

(function initTimesTable(){
  document.addEventListener('DOMContentLoaded', () => {
    renderTimesTableTopicGroup();
    renderTimesTableLevelGroup();
    renderTimesTableCountGroup();
    document.querySelectorAll('#timesTableTopicGroup .starter-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if(btn.dataset.value !== 'multiply'){
          playErrorSound();
          showToast(`Тема «${timesTableTopicName(btn.dataset.value)}» скоро появится`);
          return;
        }
        playSuccessSound();
        state.timesTableTopic = 'multiply';
        saveState();
        renderTimesTableTopicGroup();
      });
    });
    document.querySelectorAll('#timesTableLevelGroup .starter-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        playSuccessSound();
        state.timesTableSelectedLevel = parseInt(btn.dataset.value, 10);
        saveState();
        renderTimesTableLevelGroup();
      });
    });
    document.querySelectorAll('#timesTableCountGroup .starter-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        playSuccessSound();
        state.timesTableQuestionCount = parseInt(btn.dataset.value, 10);
        saveState();
        renderTimesTableCountGroup();
      });
    });
    document.getElementById('timesTableSetupStartBtn')?.addEventListener('click', () => {
      playSuccessSound();
      goToTimesTableGame();
    });
    document.getElementById('timesTableSetupExitBtn')?.addEventListener('click', () => {
      exitTimesTableSetup();
    });
    document.getElementById('closeTimesTableSummaryBtn')?.addEventListener('click', () => {
      exitTimesTableGame();
    });
    setupRulesModal('timesTableRulesModal', 'closeTimesTableRulesBtn');
  });
})();
