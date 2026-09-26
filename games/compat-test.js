// games/compat-test.js — игра «Пройдите тест» (пары 18+).
// Загружается через <script src="games/compat-test.js"></script> в index.html,
// данные — cards/cards_compat_test.js (COMPAT_TESTS и вопросы двух тестов).
//
// Механика повторяет «Викторину» (games/quiz.js), но без таймера и без
// «верного» ответа: здесь нет правильного варианта, игрок честно отвечает
// на утверждение о себе. Сначала тест целиком проходит первый партнёр, затем
// второй отвечает на те же утверждения, и только после этого считается
// результат пары — по ответам обоих, а не по одному.
//
//   • «На совместимость» — методика «Оценка совместимости характеров»:
//     суммы баллов по чётным/нечётным высказываниям у каждого, разности М и К
//     и ячейка таблицы интерпретации (см. cards/cards_compat_test.js).
//   • «На сексуальную совместимость» — набор утверждений HISC; считается
//     100 − сумма модулей разностей ответов (0–100), см. подробности в файле
//     данных. Это не клинический индекс, а понятная игроку мера схожести.
//
// Паузы у игры нет (noPause в games/game-registry.js): партия короткая и
// личная, прерывать её незачем. Стрелка «←» ведёт в настройки игры.

function compatTestById(id){
  const list = (typeof COMPAT_TESTS !== 'undefined' && Array.isArray(COMPAT_TESTS)) ? COMPAT_TESTS : [];
  return list.find(t=>t.id===id) || null;
}
// Вопросы и варианты ответа выбранного теста.
function compatTestItems(){
  if(state.compatTestType === 'sexual'){
    return {
      items: (typeof COMPAT_SEXUAL !== 'undefined' && Array.isArray(COMPAT_SEXUAL)) ? COMPAT_SEXUAL : [],
      answers: (typeof COMPAT_SEXUAL_ANSWERS !== 'undefined' && Array.isArray(COMPAT_SEXUAL_ANSWERS)) ? COMPAT_SEXUAL_ANSWERS : [],
    };
  }
  return {
    items: (typeof COMPAT_CHARACTERS !== 'undefined' && Array.isArray(COMPAT_CHARACTERS)) ? COMPAT_CHARACTERS : [],
    answers: (typeof COMPAT_CHARACTERS_ANSWERS !== 'undefined' && Array.isArray(COMPAT_CHARACTERS_ANSWERS)) ? COMPAT_CHARACTERS_ANSWERS : [],
  };
}
function compatTestPlayers(){
  return [state.name1 || 'Игрок 1', state.name2 || 'Игрок 2'];
}

function goToCompatTestSetup(){
  goToGameSetup('compatTestSetup', null, ()=>{
    renderCompatTestTypeGroup();
  });
}

// Выбор теста: две кнопки в блоке «Тесты».
function renderCompatTestTypeGroup(){
  if(!compatTestById(state.compatTestType)){
    state.compatTestType = 'characters';
    saveState();
  }
  document.querySelectorAll('#compatTestTypeGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', btn.dataset.value === state.compatTestType);
  });
}
document.querySelectorAll('#compatTestTypeGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.compatTestType = btn.dataset.value;
    saveState();
    renderCompatTestTypeGroup();
  });
});

function exitCompatTestSetup(){
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  exitGame('compatTestSetup', null);
}
document.getElementById('compatTestSetupExitBtn').addEventListener('click', ()=>{ exitCompatTestSetup(); });
// Кнопки «Правила» в самой игре нет: правила открываются из общего хаба
// «Правила игр» в меню (см. RULES_HUB в games/fants-timer.js), как у всех
// остальных игр. Модалка rulesModal здесь только показывается оттуда.
setupRulesModal('compatTestRulesModal', 'closeCompatTestRulesBtn');

/* ============ ПАРТИЯ ============ */
function startCompatTestGame(){
  const { items, answers } = compatTestItems();
  if(!items.length || !answers.length){
    showToast('Не удалось загрузить вопросы — обновите приложение');
    return;
  }
  // Сбрасываем чужие партии: тест личный, чужая пауза тут неуместна.
  abandonPausedSession('fanty');
  abandonPausedSession('sexQuest');
  abandonPausedSession('passionMap');
  state.compatTestIndex = 0;
  state.compatTestCurrentPlayer = 0;
  state.compatTestAnswers = [[], []];
  state.compatTestResult = null;
  goToGame(null, 'compatTestGame');
  updateMuteBtn();
  requestWakeLock();
  showCompatTestHandoff();
}

// Карточка «Передайте телефон»: ответы одного партнёра видит только он.
function showCompatTestHandoff(){
  const { items } = compatTestItems();
  const idx = state.compatTestCurrentPlayer || 0;
  const name = compatTestPlayers()[idx] || 'Игрок 1';
  const row = document.getElementById('compatTestHandoffRow');
  if(row) row.style.display = 'flex';
  const progress = document.getElementById('compatTestProgressRow');
  if(progress) progress.style.display = 'none';
  fadeSwapEl('compatTestCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon znayu-handoff-icon">🧪</div><div class="card-text">Передайте телефон игроку «${name}»<br><span class="compat-test-hint">Отвечайте честно — результат считается по ответам обоих</span></div></div></div>`;
  });
  updateCompatTestProgress();
}
document.getElementById('compatTestHandoffStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  showCompatTestQuestion();
});

function updateCompatTestProgress(){
  const { items } = compatTestItems();
  const idx = state.compatTestCurrentPlayer || 0;
  const total = items.length;
  const done = (state.compatTestIndex || 0) % total;
  const fill = document.getElementById('compatTestProgressFill');
  if(fill) fill.style.width = (total > 0 ? Math.round((done/total)*100) : 0) + '%';
  const label = document.getElementById('compatTestProgressLabel');
  if(label) label.textContent = `${done} / ${total}`;
  const turn = document.getElementById('compatTestTurnLabel');
  if(turn) turn.textContent = `Отвечает: ${compatTestPlayers()[idx] || 'Игрок 1'}`;
}

function showCompatTestQuestion(){
  const { items, answers } = compatTestItems();
  const idx = state.compatTestCurrentPlayer || 0;
  const item = items[state.compatTestIndex];
  const row = document.getElementById('compatTestHandoffRow');
  if(row) row.style.display = 'none';
  const progress = document.getElementById('compatTestProgressRow');
  if(progress) progress.style.display = '';
  if(!item){
    // Утверждения закончились: ход переходит ко второму партнёру, и только
    // после двух полных проходов считается общий результат.
    const next = idx + 1;
    if(next < compatTestPlayers().length){
      state.compatTestCurrentPlayer = next;
      state.compatTestIndex = 0;
      saveState();
      showCompatTestHandoff();
      return;
    }
    finishCompatTestGame();
    return;
  }
  const answersHtml = answers.map((a,i)=>`<button type="button" class="btn btn-secondary znayu-answer-btn" data-idx="${i}">${a.text}</button>`).join('');
  fadeSwapEl('compatTestCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="znayu-question-text">${item.q}</div></div><div class="znayu-answers">${answersHtml}</div></div>`;
    el.querySelectorAll('.znayu-answer-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{ answerCompatTestQuestion(parseInt(btn.dataset.idx, 10)); });
    });
  });
  updateCompatTestProgress();
  if(state.autoSpeak) speakCompatTestCard();
}

// Пропуска в этом тесте нет: ответ обязателен, вариантов «время вышло» нет.
function answerCompatTestQuestion(choiceIdx){
  const { answers } = compatTestItems();
  const idx = state.compatTestCurrentPlayer || 0;
  const answer = answers[choiceIdx];
  if(!answer) return;
  if(!Array.isArray(state.compatTestAnswers)) state.compatTestAnswers = [[], []];
  if(!Array.isArray(state.compatTestAnswers[idx])) state.compatTestAnswers[idx] = [];
  // Повторный клик по той же карточке не должен дописывать второй ответ.
  // Записанных ответов должно быть ровно столько же, сколько номер текущего
  // вопроса: если уже больше — этот вопрос закрыт. Проверка обратная
  // (length > index), иначе первым же кликом по первому вопросу тест
  // проходил бы вообще без единого ответа, и результат всегда был бы
  // «идеальным» независимо от того, что игроки нажимали.
  if(state.compatTestAnswers[idx].length > (state.compatTestIndex || 0)) return;
  state.compatTestAnswers[idx].push(answer.score);
  playSuccessSound();
  saveState();
  document.querySelectorAll('#compatTestCard .znayu-answer-btn').forEach((btn, i)=>{
    btn.disabled = true;
    if(i === choiceIdx) btn.classList.add('answer-correct');
  });
  setTimeout(advanceCompatTest, 450);
}
function advanceCompatTest(){
  state.compatTestIndex = (state.compatTestIndex || 0) + 1;
  saveState();
  showCompatTestQuestion();
}

// Озвучка утверждения по тапу на карточку (как в «Викторине»).
function speakCompatTestCard(){
  const { items, answers } = compatTestItems();
  const item = items[state.compatTestIndex];
  if(!item || !('speechSynthesis' in window)) return;
  stopSpeech('compatTestTtsHint');
  const text = [item.q, ...answers.map((a,i)=>`Вариант ${i + 1}: ${a.text}`)].join('. ');
  const utter = new SpeechSynthesisUtterance(stripQuotesForSpeech(text));
  utter.lang = 'ru-RU';
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}
document.getElementById('compatTestCard').addEventListener('click', (e)=>{
  if(e.target.closest('.znayu-answer-btn')) return;
  if(!state.autoSpeak) return;
  const { items } = compatTestItems();
  if(!items[state.compatTestIndex]) return;
  speakCompatTestCard();
});

/* ============ РАСЧЁТ РЕЗУЛЬТАТА ============ */
// Тест «На совместимость»: суммы баллов отдельно по чётным (2,4,6… — индексы
// 1,3,5…) и нечётным (1,3,5… — индексы 0,2,4…) высказываниям. М и К —
// модули разностей этих сумм у партнёров, ответ — ячейка таблицы методики.
function compatCharactersResult(answersA, answersB){
  const sum = (list, parity)=> list.reduce((acc, v, i)=> acc + ((i % 2) === parity ? v : 0), 0);
  const evenA = sum(answersA, 1), oddA = sum(answersA, 0);
  const evenB = sum(answersB, 1), oddB = sum(answersB, 0);
  const m = Math.abs(evenA - evenB);
  const k = Math.abs(oddA - oddB);
  const table = (typeof COMPAT_CHARACTERS_TABLE !== 'undefined' && Array.isArray(COMPAT_CHARACTERS_TABLE)) ? COMPAT_CHARACTERS_TABLE : [];
  const row = table[compatBand(m)] || [];
  return {
    kind: 'characters',
    m, k,
    pairs: [
      { label: 'Чётные высказывания', a: evenA, b: evenB, diff: m },
      { label: 'Нечётные высказывания', a: oddA, b: oddB, diff: k },
    ],
    verdict: row[compatBand(k)] || 'Ответьте на все утверждения, чтобы увидеть результат.',
  };
}
// Тест HISC: 100 минус сумма модулей разностей ответов (0–100).
function compatSexualResult(answersA, answersB){
  let diffSum = 0;
  answersA.forEach((v, i)=>{ diffSum += Math.abs(v - (answersB[i] ?? v)); });
  const score = Math.max(0, 100 - diffSum);
  const levels = (typeof COMPAT_SEXUAL_LEVELS !== 'undefined' && Array.isArray(COMPAT_SEXUAL_LEVELS)) ? COMPAT_SEXUAL_LEVELS : [];
  const level = levels.find(l=>score >= l.min) || levels[levels.length - 1] || { title:'', text:'' };
  return {
    kind: 'sexual',
    score, diffSum,
    verdict: level.text,
    title: level.title,
  };
}
function computeCompatTestResult(){
  const answers = state.compatTestAnswers || [[], []];
  const a = Array.isArray(answers[0]) ? answers[0] : [];
  const b = Array.isArray(answers[1]) ? answers[1] : [];
  if(state.compatTestType === 'sexual') return compatSexualResult(a, b);
  return compatCharactersResult(a, b);
}

/* ============ ИТОГИ И СОХРАНЕНИЕ ============ */
function finishCompatTestGame(){
  const result = computeCompatTestResult();
  state.compatTestResult = result;
  const test = compatTestById(state.compatTestType);
  // История хранит итог, а не сырые ответы: после партии нужен результат,
  // а список всех утверждений занимал бы место ради данных, которые никто
  // больше не читает. «Сбросить прогресс» чистит и её.
  if(!Array.isArray(state.compatTestHistory)) state.compatTestHistory = [];
  state.compatTestHistory.unshift({
    date: Date.now(),
    testId: state.compatTestType,
    testName: test ? test.name : 'Тест',
    players: compatTestPlayers(),
    result,
  });
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  renderCompatTestSummary();
  document.getElementById('compatTestGame').classList.remove('active');
  document.getElementById('compatTestSummary').classList.add('active');
}

function renderCompatTestSummary(){
  const test = compatTestById(state.compatTestType);
  const result = state.compatTestResult || {};
  const players = compatTestPlayers();
  const title = document.getElementById('compatTestSummaryTitle');
  if(title) title.textContent = `${test ? test.icon : '🧪'} ${test ? test.name : 'Тест'}`;
  const list = document.getElementById('compatTestSummaryList');
  if(!list) return;
  if(result.kind === 'characters'){
    list.innerHTML = `
      <div class="compat-test-verdict">${result.verdict}</div>
      <div class="compat-test-sums">
        ${(result.pairs || []).map(p=>`
          <div class="compat-test-sum-row">
            <span class="compat-test-sum-name">${p.label}</span>
            <span class="compat-test-sum-values">${players[0]}: ${p.a} · ${players[1]}: ${p.b}</span>
            <span class="compat-test-sum-diff">разница ${p.diff}</span>
          </div>
        `).join('')}
      </div>
    `;
  } else {
    list.innerHTML = `
      <div class="compat-test-score">${result.score} / 100</div>
      <div class="compat-test-score-title">${result.title || ''}</div>
      <div class="compat-test-verdict">${result.verdict || ''}</div>
    `;
  }
  const note = document.getElementById('compatTestSummaryNote');
  if(note) note.textContent = 'Результат сохранён в «Пройденные» — его можно открыть позже.';
}
// Выход с итогов — в настройки игры (не в общий хаб), тем же путём, что и
// «Выйод» с настроек: гасятся все активные экраны, запоминается точка входа.
function exitCompatTestSummary(){
  goToCompatTestSetup();
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  updateResumeUI();
}
document.getElementById('compatTestSummaryExitBtn').addEventListener('click', ()=>{ exitCompatTestSummary(); });
// Выход по стрелке «←» из партии: прерываем без сохранения результата.
function finishPausedCompatTestGame(){
  hideModal('pauseMenuModal');
  stopAllSounds();
  state.inProgress = false;
  state.pausedMode = null;
  goToCompatTestSetup();
  saveState();
  updateResumeUI();
  showToast('Тест прерван — пройдите его заново');
}
// Продолжение из меню паузы. У игры noPause, поэтому сюда попадаем только
// если партия была в процессе: возвращаемся на игровой экран и продолжаем
// с текущего утверждения того партнёра, чей ход шёл.
function resumeCompatTestGame(){
  state.pausedMode = null;
  saveState();
  updateResumeUI();
  goToGame(null, 'compatTestGame');
  updateMuteBtn();
  requestWakeLock();
  const { items } = compatTestItems();
  const idx = state.compatTestCurrentPlayer || 0;
  // Уже отвеченные утверждения пропускаем — иначе экран откатился бы назад.
  const answered = ((state.compatTestAnswers || [])[idx] || []).length;
  if(state.compatTestIndex < answered) state.compatTestIndex = answered;
  if(items[state.compatTestIndex]) showCompatTestQuestion();
  else showCompatTestHandoff();
}
document.getElementById('compatTestStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  startCompatTestGame();
});

/* ============ ПРОЙДЕННЫЕ (ИСТОРИЯ) ============ */
function formatCompatTestDate(ts){
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${pad(d.getFullYear())}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function compatHistoryShortText(entry){
  const r = entry.result || {};
  if(r.kind === 'characters') return r.verdict || '';
  return r.title ? `${r.score} / 100 — ${r.title}` : '';
}
function goToCompatTestHistory(){
  const wrap = document.getElementById('compatTestHistoryList');
  const history = state.compatTestHistory || [];
  if(history.length === 0){
    wrap.innerHTML = '<div class="card-text">Пока нет пройденных тестов — пройдите хотя бы один.</div>';
  } else {
    wrap.innerHTML = history.map((entry, idx)=>`
      <div class="compat-test-history-entry">
        <div class="compat-test-history-date">${formatCompatTestDate(entry.date)} · ${entry.testName || 'Тест'}</div>
        <div class="compat-test-history-names">${(entry.players || []).join(' и ')}</div>
        <div class="compat-test-history-text">${compatHistoryShortText(entry)}</div>
        <button type="button" class="compat-test-history-del" data-idx="${idx}" aria-label="Удалить результат из пройденных">✕</button>
      </div>
    `).join('');
  }
  document.getElementById('compatTestSetup').classList.remove('active');
  document.getElementById('compatTestHistory').classList.add('active');
}
document.getElementById('compatTestHistoryList').addEventListener('click', (e)=>{
  const btn = e.target.closest('.compat-test-history-del');
  if(!btn) return;
  playErrorSound();
  state.compatTestHistory.splice(parseInt(btn.dataset.idx, 10), 1);
  saveState();
  goToCompatTestHistory();
});
function exitCompatTestHistory(){
  goToCompatTestSetup();
}
document.getElementById('compatTestHistoryBtn').addEventListener('click', ()=>{ goToCompatTestHistory(); });
document.getElementById('compatTestHistoryExitBtn').addEventListener('click', ()=>{ exitCompatTestHistory(); });
