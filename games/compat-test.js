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
// Реестр наборов: сколько бы тестов ни добавляли, движок работает с любым
// числом. Раньше выбор был зашит на две ветки (if по 'sexual'), и третий тест
// потребовал бы ещё одной ветки — теперь добавление теста это только данные.
//
//   items   — утверждения теста;
//   answers — варианты ответа (обычно общие для всех тестов со scale:'agreement');
//   scale   — способ подсчёта: 'characters' — методика с баллами и разностями
//             М/К; 'agreement' — сколько баллов набирает пара за совпадение
//             ответов (0–100).
const COMPAT_DATASETS = {
  characters: { items: COMPAT_CHARACTERS, answers: COMPAT_CHARACTERS_ANSWERS, scale: 'characters' },
  sexual: { items: COMPAT_SEXUAL, answers: COMPAT_SEXUAL_ANSWERS, scale: 'agreement' },
  // Восемь тем для пар. Вопросы написаны для этого приложения (см. шапку
  // cards/cards_compat_test.js) — это не опубликованные методики и не их
  // переводы. Все они считаются общей мерой совпадения ответов.
  comfort: { items: COMPAT_COMFORT, answers: COMPAT_DEGREE_ANSWERS, scale: 'agreement' },
  chemistry: { items: COMPAT_CHEMISTRY, answers: COMPAT_DEGREE_ANSWERS, scale: 'agreement' },
  desire: { items: COMPAT_DESIRE, answers: COMPAT_DEGREE_ANSWERS, scale: 'agreement' },
  boundaries: { items: COMPAT_BOUNDARIES, answers: COMPAT_DEGREE_ANSWERS, scale: 'agreement' },
  fantasy: { items: COMPAT_FANTASY, answers: COMPAT_DEGREE_ANSWERS, scale: 'agreement' },
  touch: { items: COMPAT_TOUCH, answers: COMPAT_DEGREE_ANSWERS, scale: 'agreement' },
  talk: { items: COMPAT_TALK, answers: COMPAT_DEGREE_ANSWERS, scale: 'agreement' },
  ideal: { items: COMPAT_IDEAL, answers: COMPAT_DEGREE_ANSWERS, scale: 'agreement' },
};

// Вопросы и варианты ответа выбранного теста. Неизвестный id или отсутствующий
// набор не должны ронять игру: возвращаем пустой список, а startCompatTestGame
// покажет игроку понятное сообщение.
function compatTestItems(){
  const test = compatTestById(state.compatTestType);
  const key = test ? test.id : 'characters';
  const ds = COMPAT_DATASETS[key] || null;
  return {
    items: ds && Array.isArray(ds.items) ? ds.items : [],
    answers: ds && Array.isArray(ds.answers) ? ds.answers : [],
    scale: ds ? ds.scale : 'agreement',
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

// Выбор теста: две плашки в блоке «Тесты». Разметка — общий компонент
// уровней .level-toggle (иконка+название сверху, галочка справа), как в
// «Фантах» и «Знаю тебя», чтобы высота совпадала с остальными играми.
//
// Описание у плашек НЕ выводится намеренно. «На сеексуальную совместимость»
// на узком экране занимает две строки, и любая подпись под ним поднимала бы
// плашку выше стандартных 56px, которые держат уровни остальных игр (там
// названия короткие: «Романтика», «До 12 лет», «18+»). Поэтому здесь только
// название: без .ldesc плашка с двухстрочным названием укладывается ровно в
// те же 56px, что и в остальных играх. Число утверждений и описание тестов
// остались в правилах игры и в README.
function renderCompatTestTypeGroup(){
  const wrap = document.getElementById('compatTestTypeGroup');
  if(!wrap) return;
  const tests = (typeof COMPAT_TESTS !== 'undefined' && Array.isArray(COMPAT_TESTS)) ? COMPAT_TESTS : [];
  if(!compatTestById(state.compatTestType)){
    state.compatTestType = tests[0] ? tests[0].id : 'characters';
    saveState();
  }
  wrap.innerHTML = '';
  tests.forEach(t=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + (state.compatTestType === t.id ? ' on' : '');
    div.innerHTML = `<div class="lname">${t.icon} ${t.name}</div><div class="level-check"></div>`;
    div.addEventListener('click', ()=>{
      state.compatTestType = t.id;
      saveState();
      renderCompatTestTypeGroup();
    });
    wrap.appendChild(div);
  });
}

// Выход с экрана настройки — прямо в хаб, раздел «Игры для пар 18+».
//
// Раньше здесь звался exitGame('compatTestSetup', null), и это ломало стрелку
// «←»: goToGameSetup() запоминает точкой входа САМ compatTestSetup (это нужно,
// чтобы выход из партии вёл в меню игры), а exitGame() на откате вызывает
// returnToEntryScreen(), который активирует запомненный экран. То есть экран
// настроек выключался и тут же включался заново — визуально ничего не
// происходило. Хуже того, поведение зависело от того, что успело переписать
// точку входа: то стрелка вела в хаб (но не в тот раздел), то не делала
// ничего — отсюда «не всегда срабатывает».
// Теперь тот же простой путь, что у «Пройди квест» и «Карты страсти»:
// гасим экран, включаем #setup и открываем нужный раздел. Связанные флаги
// inProgress и pausedMode снимаются вместе (правило из AGENTS.md: забытый
// inProgress блокирует настройки в хабе).
function exitCompatTestSetup(){
  state.inProgress = false;
  state.pausedMode = null;
  state.lastSectionOnPause = null;
  saveState();
  const pauseModal = document.getElementById('pauseMenuModal');
  if(pauseModal) pauseModal.classList.remove('show');
  document.querySelectorAll('.screen.active').forEach(el=>el.classList.remove('active'));
  const setup = document.getElementById('setup');
  if(setup) setup.classList.add('active');
  showSetupView('twoPlayerView');
  if(typeof updateResumeUI === 'function') updateResumeUI();
  window.scrollTo(0, 0);
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
// Показывается ли сейчас карточка «Передайте телефон» (true) или вопрос (false).
// Нужно паузе: вернуться надо ровно туда же, откуда игрок ушёл, иначе после
// «Продолжить игру» партнёру покажется вопрос, который он уже не видел.
let compatTestAwaitingHandoff = false;
function showCompatTestHandoff(){
  compatTestAwaitingHandoff = true;
  const { items } = compatTestItems();
  const idx = state.compatTestCurrentPlayer || 0;
  const name = compatTestPlayers()[idx] || 'Игрок 1';
  const row = document.getElementById('compatTestHandoffRow');
  if(row) row.style.display = 'flex';
  const progress = document.getElementById('compatTestProgressRow');
  if(progress) progress.style.display = 'none';
  fadeSwapEl('compatTestCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon znayu-handoff-icon">💖</div><div class="card-text">Передайте телефон игроку «${name}»<br><span class="compat-test-hint">Отвечайте честно — результат считается по ответам обоих</span></div></div></div>`;
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
  compatTestAwaitingHandoff = false;
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
// Общая мера «agreement» — сколько баллов набирает пара за совпадение
// ответов: 100 минус сумма модулей разностей, диапазон 0–100. Ею считаются
// все тесты со scale:'agreement' (в том числе HISC).
function compatAgreementResult(answersA, answersB){
  let diffSum = 0;
  answersA.forEach((v, i)=>{ diffSum += Math.abs(v - (answersB[i] ?? v)); });
  const score = Math.max(0, 100 - diffSum);
  const levels = (typeof COMPAT_SEXUAL_LEVELS !== 'undefined' && Array.isArray(COMPAT_SEXUAL_LEVELS)) ? COMPAT_SEXUAL_LEVELS : [];
  const level = levels.find(l=>score >= l.min) || levels[levels.length - 1] || { title:'', text:'' };
  return {
    kind: 'agreement',
    score, diffSum,
    verdict: level.text,
    title: level.title,
  };
}
function computeCompatTestResult(){
  const answers = state.compatTestAnswers || [[], []];
  const a = Array.isArray(answers[0]) ? answers[0] : [];
  const b = Array.isArray(answers[1]) ? answers[1] : [];
  // Способ подсчёта берём у набора теста (scale), а не у id: добавление нового
  // теста не должно требовать правки здесь.
  return compatTestItems().scale === 'characters'
    ? compatCharactersResult(a, b)
    : compatAgreementResult(a, b);
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
  if(title) title.textContent = `${test ? test.icon : '💖'} ${test ? test.name : 'Тест'}`;
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
// «Закончить игру» в меню паузы: тест бросается без сохранения результата.
// Того же ждёт вызов из общего кода, если пауза открылась из чужой игры.
function finishPausedCompatTestGame(){
  hideModal('pauseMenuModal');
  stopAllSounds();
  state.inProgress = false;
  state.pausedMode = null;
  state.compatTestPaused = null;
  goToCompatTestSetup();
  saveState();
  updateResumeUI();
  showToast('Тест прерван — пройдите его заново');
}
// Пауза: запоминаем, на каком месте остановились, и отдаём экран хабу —
// общее меню паузы само покажется из updateResumeUI() по state.pausedMode.
function pauseCompatTestGame(){
  if(typeof stopAllSounds === 'function') stopAllSounds();
  if(typeof stopSpeech === 'function') stopSpeech('compatTestTtsHint');
  state.pausedMode = 'compatTest';
  state.lastSectionOnPause = 'twoPlayerView';
  state.compatTestPaused = {
    index: state.compatTestIndex || 0,
    player: state.compatTestCurrentPlayer || 0,
    awaitingHandoff: compatTestAwaitingHandoff,
  };
  saveState();
  document.getElementById('compatTestGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('twoPlayerView');
  updateResumeUI();
}
// Продолжение из меню паузы. Возвращаем ровно туда, откуда ушли: тот же
// экран, тот же игрок, то же состояние экрана (вопрос или «Передайте
// телефон») — иначе пришлось бы заново перебирать ответы.
function resumeCompatTestGame(){
  state.pausedMode = null;
  const d = state.compatTestPaused || {};
  state.compatTestPaused = null;
  state.compatTestIndex = typeof d.index === 'number' ? d.index : (state.compatTestIndex || 0);
  state.compatTestCurrentPlayer = typeof d.player === 'number' ? d.player : (state.compatTestCurrentPlayer || 0);
  const wasHandoff = !!d.awaitingHandoff;
  saveState();
  updateResumeUI();
  goToGame(null, 'compatTestGame');
  updateMuteBtn();
  requestWakeLock();
  const { items } = compatTestItems();
  const idx = state.compatTestCurrentPlayer || 0;
  // Уже отвеченные утверждения не показываем повторно.
  const answered = ((state.compatTestAnswers || [])[idx] || []).length;
  if(state.compatTestIndex < answered) state.compatTestIndex = answered;
  if(wasHandoff || !items[state.compatTestIndex]) showCompatTestHandoff();
  else showCompatTestQuestion();
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
