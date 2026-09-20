// games/times-table.js — Игра «Таблица умножения» (обучающая, по образцу «Столиц»).
// Вопросы генерируются программно: a × b = ? с 4 вариантами ответа.
// Запускается из экрана настроек в хабе обучающих игр. Однопользовательский режим, без паузы.

const TIMES_TABLE_COUNT_VALUES = [5, 10, 25, 50];
const TIMES_TABLE_LEVELS = [
  { id: 1, name: '🟢 Лёгкий', desc: '×2 — ×5' },
  { id: 2, name: '🟡 Средний', desc: '×6 — ×9' },
  { id: 3, name: '🔴 Сложный', desc: '×2 — ×10' },
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
  if(level === 1) return [2, 5];
  if(level === 2) return [6, 9];
  return [2, 10];
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
  return `
    <div class="flags-card-media"><div class="times-table-expression">${item.a} × ${item.b} = ?</div></div>
    <div class="card-text">${answersHtml}</div>
  `;
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
    `<button type="button" class="znayu-answer-btn" data-idx="${idx}">${opt}</button>`
  ).join('');
  card.innerHTML = timesTableQuestionHtml(item, buttonsHtml);
  card.querySelectorAll('.znayu-answer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      answerTimesTableQuestion(parseInt(btn.dataset.idx, 10));
    });
  });
  timesTableDurationMs = (Number(state.timesTableAnswerSeconds) || 10) * 1000;
  timesTableDeadline = Date.now() + timesTableDurationMs;
  updateTimesTableProgressUI();
  updateTimesTableScoreUI();
  stopTimesTableInterval();
  timesTableIntervalId = setInterval(timesTableTick, 100);
  speakTimesTableCard();
}

function timesTableTick(){
  if(timesTableAnswered) return;
  if(timesTableDeadline - Date.now() > 0) return;
  timesTableAnswered = true;
  stopTimesTableInterval();
  stopTimesTableSpeech();
  answerTimesTableQuestion(-1);
}

function answerTimesTableQuestion(choiceIdx){
  const wasTimeout = choiceIdx === -1;
  if(timesTableAnswered && !wasTimeout) return;
  if(wasTimeout && timesTableAnswered && !timesTableShowingQuestion) return;
  timesTableAnswered = true;
  timesTableShowingQuestion = false;
  stopTimesTableInterval();
  stopTimesTableSpeech();
  const queue = state.timesTableQueue || [];
  const item = queue[state.timesTableIndex];
  if(!item) return;
  const answer = item.a * item.b;
  const chosen = wasTimeout ? null : timesTableCurrentOptions[choiceIdx];
  const correct = chosen === answer;
  if(correct){
    state.timesTableCorrect++;
    playSuccessSound();
  } else {
    playErrorSound();
  }
  state.timesTableTimeMs += Date.now() - timesTableQuestionStartedAt;
  const key = timesTableCardKey(item);
  const lvl = Number(state.timesTableSelectedLevel) || 1;
  state.timesTableUsed[lvl] = state.timesTableUsed[lvl] || [];
  if(!state.timesTableUsed[lvl].includes(key)) state.timesTableUsed[lvl].push(key);
  const card = document.getElementById('timesTableCard');
  if(card){
    const answersHtml = timesTableCurrentOptions.map(opt =>
      `<button type="button" class="znayu-answer-btn ${opt === answer ? 'is-correct' : ''} ${opt === chosen ? 'is-wrong' : ''}" disabled>${opt}</button>`
    ).join('');
    const note = wasTimeout ? '⏰ Время вышло' : (correct ? '✅ Верно!' : '❌ Неверно');
    card.innerHTML = timesTableQuestionHtml(item, answersHtml) +
      `<div class="flags-answer-note">${note} — ${item.a} × ${item.b} = ${answer}</div>`;
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
function updateTimesTableScoreUI(){
  const el = document.getElementById('timesTableScoreRow');
  if(!el) return;
  const total = TIMES_TABLE_COUNT_VALUES.includes(Number(state.timesTableQuestionCount)) ? Number(state.timesTableQuestionCount) : 10;
  el.innerHTML = `
    <div class="krokodil-score-item"><span class="krokodil-score-label">✅ Верно</span><span class="krokodil-score-value">${state.timesTableCorrect}</span></div>
    <div class="krokodil-score-item"><span class="krokodil-score-label">⏳ Осталось</span><span class="krokodil-score-value">${Math.max(0, total - state.timesTableIndex - (timesTableAnswered ? 0 : 1))}</span></div>
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
  goToGame('learningView', 'timesTableSetup');
  renderTimesTableLevelGroup();
  renderTimesTableCountGroup();
  updateMuteBtn();
  saveState();
}

function exitTimesTableSetup(){
  playSuccessSound();
  goToSetup();
}

function renderTimesTableLevelGroup(){
  const wrap = document.getElementById('timesTableLevelGroup');
  if(!wrap) return;
  wrap.querySelectorAll('.starter-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.value, 10) === (Number(state.timesTableSelectedLevel) || 1));
  });
}

function renderTimesTableCountGroup(){
  const wrap = document.getElementById('timesTableCountGroup');
  if(!wrap) return;
  wrap.querySelectorAll('.starter-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.value, 10) === (Number(state.timesTableQuestionCount) || 10));
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
  const text = `${item.a} умножить на ${item.b}`;
  timesTableSpeakTimerId = setTimeout(() => {
    timesTableSpeakTimerId = null;
    try{
      const u = new SpeechSynthesisUtterance(text);
      const v = pickTimesTableVoice();
      if(v) u.voice = v;
      u.lang = 'ru-RU';
      window.speechSynthesis.speak(u);
    }catch(e){}
  }, 50);
}

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
  state.timesTableSelectedLevel = Number(state.timesTableSelectedLevel) || 1;
  state.timesTableAnswerSeconds = state.timesTableAnswerSeconds || 10;
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
    <div class="game-level-label">✖️ Таблица умножения</div>
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
    renderTimesTableLevelGroup();
    renderTimesTableCountGroup();
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
  });
}
  }
  showTimesTableQuestion();
}