// games/solo-test.js — игра «Пройди тест» (для одного).
// Загружается через <script src="games/solo-test.js"></script> в index.html,
// данные — cards/cards_solo_test.js (SOLO_TESTS, SOLO_TEST_ITEMS).
//
// МЕХАНИКА
// Копия механики «Пройдите тест» (games/compat-test.js), но для одного человека:
// тот же экран карточки с вопросом и вариантами ответа, тот же прогресс-бар,
// тот же разбор итогов, та же история «Пройденные» и то же меню паузы с
// продолжением с того же места. Различия — в подсчёте, а не в интерфейсе:
//
//   • отвечает один человек, поэтому нет «Передайте телефон», второго
//     игрока и разбора расхождений;
//   • на выходе не индекс совпадения 0–100, а ТИП: по ответам считается, какой
//     вариант выбирался чаще (mode:'types') либо какова сумма баллов по шкале
//     (mode:'scale'), и выводится соответствующий тип с описанием, сильными
//     сторонами, трудностями и советом.
//
// Способы подсчёта заданы данными, а не кодом: добавление нового теста — это
// только запись в cards/cards_solo_test.js, движок менять не нужно.
//
// ПАУЗА
// Полноценная (в реестре games/game-registry.js): тест длинный — десять
// вопросов с размышлением, — бросать его на середине обидно. Снимок
// soloTestPaused хранит номер вопроса и выбранный вариант, если пауза
// пришлась на паузу между ответом и следующим вопросом.

/* ============ ДАННЫЕ ВЫБРАННОГО ТЕСТА ============ */
function soloTestList(){
  return (typeof SOLO_TESTS !== 'undefined' && Array.isArray(SOLO_TESTS)) ? SOLO_TESTS : [];
}
function soloTestById(id){
  return soloTestList().find(t => t.id === id) || null;
}
// Вопросы выбранного теста. Неизвестный id или отсутствие данных не должны
// ронять игру: возвращаем пустой список, а startSoloTestGame покажет
// игроку понятное сообщение.
function soloTestItems(){
  const test = soloTestById(state.soloTestType);
  const list = (typeof SOLO_TEST_ITEMS !== 'undefined' && SOLO_TEST_ITEMS) ? SOLO_TEST_ITEMS : {};
  const items = test ? list[test.id] : null;
  return Array.isArray(items) ? items : [];
}
function goToSoloTestSetup(){
  goToGameSetup('soloTestSetup', null, ()=>{
    renderSoloTestTypeGroup();
  });
}

/* ============ ЭКРАН НАСТРОЙКИ ============ */
// Выбор теста — те же плашки .level-toggle, что у «Пройдите теста» и
// остальных игр. Подпись .ldesc намеренно НЕ выводится: у части названий
// («Насколько вы готовы к отношениям») она заняла бы три строки и подняла бы
// плашку выше стандартных 56px уровней остальных игр. Что измеряет каждый
// тест — в правилах игры и в README.
function renderSoloTestTypeGroup(){
  const wrap = document.getElementById('soloTestTypeGroup');
  if(!wrap) return;
  const tests = soloTestList();
  if(!soloTestById(state.soloTestType)){
    state.soloTestType = tests[0] ? tests[0].id : 'personality';
    saveState();
  }
  wrap.innerHTML = '';
  tests.forEach(t=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + (state.soloTestType === t.id ? ' on' : '');
    div.innerHTML = `<div class="lname">${t.icon} ${t.name}</div><div class="level-check"></div>`;
    div.addEventListener('click', ()=>{
      state.soloTestType = t.id;
      saveState();
      renderSoloTestTypeGroup();
    });
    wrap.appendChild(div);
  });
}
// Выход с экрана настройки — прямо в хаб, раздел «Игры для одного». Так же,
// как exitCompatTestSetup(): через exitGame() откат возвращал бы экран настроек
// сам на себя, потому что точкой входа goToGameSetup() записал именно его.
// Связанные флаги inProgress и pausedMode снимаются вместе.
function exitSoloTestSetup(){
  state.inProgress = false;
  state.pausedMode = null;
  state.lastSectionOnPause = null;
  saveState();
  const pauseModal = document.getElementById('pauseMenuModal');
  if(pauseModal) pauseModal.classList.remove('show');
  document.querySelectorAll('.screen.active').forEach(el=>el.classList.remove('active'));
  const setup = document.getElementById('setup');
  if(setup) setup.classList.add('active');
  showSetupView('soloView');
  if(typeof updateResumeUI === 'function') updateResumeUI();
  window.scrollTo(0, 0);
}
document.getElementById('soloTestSetupExitBtn').addEventListener('click', ()=>{ exitSoloTestSetup(); });
// Кнопки «Правила» в самой игре нет: правила открываются из общего хаба
// «Правила игр» в меню (см. RULES_HUB в games/fants-timer.js), как у всех
// остальных игр. setupRulesModal вешает закрытие по крестику и по фону.
setupRulesModal('soloTestRulesModal', 'closeSoloTestRulesBtn');

/* ============ ПАРТИЯ ============ */
let soloTestAdvanceTimerId = null; // отложенный переход к следующему вопросу
let soloTestCurrentOptions = [];   // варианты текущего вопроса в порядке показа
let soloTestAnswered = false;      // ответ на текущий вопрос уже выбран
function cancelSoloTestAdvance(){
  if(soloTestAdvanceTimerId){ clearTimeout(soloTestAdvanceTimerId); soloTestAdvanceTimerId = null; }
}
function startSoloTestGame(){
  const items = soloTestItems();
  if(!items.length){
    showToast('Не удалось загрузить вопросы — обновите приложение');
    return;
  }
  cancelSoloTestAdvance();
  // Сбрасываем чужие партии: тест личный, чужая пауза тут неуместна.
  abandonPausedSession('fanty');
  abandonPausedSession('compatTest');
  state.soloTestIndex = 0;
  // Ответы: по одному на вопрос. type — индекс типа (mode:'types') или сумма
  // баллов (mode:'scale'); у scale-тестов в сумму идёт индекс варианта.
  state.soloTestAnswers = [];
  state.soloTestResult = null;
  goToGame(null, 'soloTestGame');
  updateMuteBtn();
  requestWakeLock();
  showSoloTestQuestion();
}

function updateSoloTestProgress(){
  const total = soloTestItems().length;
  const done = Math.min(state.soloTestIndex || 0, total);
  const fill = document.getElementById('soloTestProgressFill');
  if(fill) fill.style.width = (total > 0 ? Math.round((done / total) * 100) : 0) + '%';
  const label = document.getElementById('soloTestProgressLabel');
  if(label) label.textContent = `${done} / ${total}`;
}

function showSoloTestQuestion(){
  const test = soloTestById(state.soloTestType);
  const items = soloTestItems();
  const item = items[state.soloTestIndex];
  if(!item || !Array.isArray(item.a) || !item.a.length){
    finishSoloTestGame();
    return;
  }
  soloTestAnswered = false;
  // Варианты перемешиваются: иначе по позиции кнопки можно было бы угадать
  // ответ (в данных порядок канонический — индекс = тип или балл).
  soloTestCurrentOptions = item.a.map((text, i)=>({ text, i }));
  if(typeof shuffle === 'function') soloTestCurrentOptions = shuffle(soloTestCurrentOptions);
  const answersHtml = soloTestCurrentOptions
    .map((o, pos)=>`<button type="button" class="btn btn-secondary znayu-answer-btn" data-pos="${pos}">${o.text}</button>`).join('');
  fadeSwapEl('soloTestCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="znayu-question-text">${item.q}</div></div>`
      + `<div class="znayu-answers">${answersHtml}</div><div class="quiz-tts-hint" id="soloTestTtsHint">🔊</div></div>`;
    el.querySelectorAll('.znayu-answer-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{ answerSoloTestQuestion(parseInt(btn.dataset.pos, 10)); });
    });
  });
  updateSoloTestProgress();
  if(state.autoSpeak) speakSoloTestCard(test);
}
// Пропуска нет: у каждого вопроса есть варианты ответа, «время вышло» не
// предусмотрено — отвечать нужно осознанно.
function answerSoloTestQuestion(pos){
  if(soloTestAnswered) return;
  const option = soloTestCurrentOptions[pos];
  if(!option) return;
  soloTestAnswered = true;
  stopSoloTestSpeech();
  // Защита от повторного клика по той же карточке: записанных ответов должно
  // быть ровно столько же, сколько номер текущего вопроса. Иначе второй клик
  // дописывал бы лишний ответ и сдвигал подсчёт.
  if((state.soloTestAnswers || []).length > (state.soloTestIndex || 0)) return;
  if(!Array.isArray(state.soloTestAnswers)) state.soloTestAnswers = [];
  state.soloTestAnswers.push(option.i);
  playSuccessSound();
  saveState();
  document.querySelectorAll('#soloTestCard .znayu-answer-btn').forEach((btn, i)=>{
    btn.disabled = true;
    if(i === pos) btn.classList.add('answer-correct');
  });
  soloTestAdvanceTimerId = setTimeout(advanceSoloTest, 450);
}
function advanceSoloTest(){
  soloTestAdvanceTimerId = null;
  state.soloTestIndex = (state.soloTestIndex || 0) + 1;
  saveState();
  showSoloTestQuestion();
}
document.getElementById('soloTestCard').addEventListener('click', (e)=>{
  if(e.target.closest('.znayu-answer-btn')) return;
  if(soloTestAnswered) return;
  if(!state.autoSpeak) return;
  if(!soloTestItems()[state.soloTestIndex]) return;
  speakSoloTestCard(soloTestById(state.soloTestType));
});
document.getElementById('soloTestStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  startSoloTestGame();
});

/* ============ РАСЧЁТ РЕЗУЛЬТАТА ============ */
// mode:'types' — тип с наибольшим числом выборов. При равенстве (типов
// обычно 3–5, вопросов 10 — ничья не редкость) берётся первый по порядку в
// данных: порядок типов в файле данных осмысленный, а не случайный, поэтому
// результат остаётся предсказуемым. mode:'scale' — сумма индексов вариантов
// (0…3 в вопросе, 0…30 по тесту) и последний уровень, у которого min ≤ суммы.
function computeSoloTestResult(){
  const test = soloTestById(state.soloTestType);
  const answers = Array.isArray(state.soloTestAnswers) ? state.soloTestAnswers : [];
  if(!test || !Array.isArray(test.types) || !test.types.length){
    return { title: 'Результат не определён', text: 'Ответьте на все вопросы, чтобы увидеть результат.', plus: '', minus: '', tip: '' };
  }
  if(test.mode === 'scale'){
    const sum = answers.reduce((acc, v)=> acc + (typeof v === 'number' ? v : 0), 0);
    // Уровень выбирается ПОСЛЕДНИМ, у которого min ≤ суммы, а не первым
    // подходящим: типы отсортированы по возрастанию min, и первый подходящий
    // для любой суммы был самый нижний уровень — при сумме 30 показывался
    // «Свой фильтр». Сумма ниже первого min (не должно быть) — последний тип.
    let type = test.types[test.types.length - 1];
    for(const t of test.types){
      if(sum >= (typeof t.min === 'number' ? t.min : 0)) type = t;
    }
    // count здесь НЕ возвращается намеренно: в итогах счётчик голосов
    // выводится по наличию count, и у теста по шкале его быть не должно —
    // иначе вместо суммы баллов игрок увидел бы «Ответов за этот тип: 10
    // из 10», хотя считалась сумма, а не голоса.
    return { ...type, sum, total: soloTestItems().length };
  }
  const counts = test.types.map(()=>0);
  answers.forEach(v=>{ if(typeof v === 'number' && counts[v] !== undefined) counts[v]++; });
  let best = 0;
  for(let i = 1; i < counts.length; i++){
    if(counts[i] > counts[best]) best = i;
  }
  // count — число голосов ЗА выбранный тип (counts[best]), а не ответ на
  // вопрос с таким номером: в state лежат индексы типов, а не счётчики.
  return { ...test.types[best], count: counts[best], total: soloTestItems().length, max: Math.max(...counts) };
}

/* ============ ИТОГИ И СОХРАНЕНИЕ ============ */
function finishSoloTestGame(){
  cancelSoloTestAdvance();
  stopSoloTestSpeech();
  const result = computeSoloTestResult();
  const test = soloTestById(state.soloTestType);
  state.soloTestResult = result;
  // История хранит итог, а не сырые ответы: после партии нужен результат, а
  // список всех вопросов занимал бы место ради данных, которые никто больше
  // не читает. «Сбросить прогресс» чистит и её.
  if(!Array.isArray(state.soloTestHistory)) state.soloTestHistory = [];
  state.soloTestHistory.unshift({
    date: Date.now(),
    testId: state.soloTestType,
    testName: test ? test.name : 'Тест',
    result,
  });
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  renderSoloTestSummary();
  document.getElementById('soloTestGame').classList.remove('active');
  document.getElementById('soloTestSummary').classList.add('active');
}
function renderSoloTestSummary(){
  const test = soloTestById(state.soloTestType);
  const result = state.soloTestResult || {};
  const title = document.getElementById('soloTestSummaryTitle');
  if(title) title.textContent = `${test ? test.icon : '🧪'} ${test ? test.name : 'Тест'}`;
  const list = document.getElementById('soloTestSummaryList');
  if(!list) return;
  const typeIcon = result.icon || (test ? test.icon : '🧪');
  const typeTitle = result.title || 'Результат не определён';
  // Число «N из 10» показываем только там, где оно что-то значит: в
  // «types»-тестах это счётчик голосов за один тип, в «scale»-тестах — сумма
  // баллов по шкале. Пустые поля не выводим, чтобы в итогах не было
  // пустых строк.
  const stat = (typeof result.count === 'number' && typeof result.total === 'number')
    ? `<div class="solo-test-stat">Ответов за этот тип: ${result.count} из ${result.total}`
      + (typeof result.max === 'number' ? ` · чаще всего — ${result.max}` : '') + '</div>'
    : (typeof result.sum === 'number' && typeof result.total === 'number'
      ? `<div class="solo-test-stat">Сумма баллов: ${result.sum} · вопросов: ${result.total}</div>` : '');
  list.innerHTML = `
    <div class="solo-test-type">${typeIcon} ${typeTitle}</div>
    <div class="solo-test-verdict">${result.text || ''}</div>
    ${stat}
    ${result.plus ? `<div class="solo-test-plus"><b>Сильные стороны</b>${result.plus}</div>` : ''}
    ${result.minus ? `<div class="solo-test-minus"><b>Возможные трудности</b>${result.minus}</div>` : ''}
    ${result.tip ? `<div class="solo-test-tip"><b>Что попробовать</b>${result.tip}</div>` : ''}
  `;
  const note = document.getElementById('soloTestSummaryNote');
  if(note) note.textContent = 'Результат сохранён в «Пройденные» — его можно открыть позже.';
}
// Выход с итогов — в настройки игры (не в общий хаб), тем же путём, что и
// «Выход» с настроек: гасятся все активные экраны, запоминается точка входа.
function exitSoloTestSummary(){
  goToSoloTestSetup();
  state.inProgress = false;
  state.pausedMode = null;
  state.soloTestPaused = null;
  saveState();
  updateResumeUI();
}
document.getElementById('soloTestSummaryExitBtn').addEventListener('click', ()=>{ exitSoloTestSummary(); });

/* ============ ПАУЗА, ВОЗОБНОВЛЕНИЕ, ЗАВЕРШЕНИЕ ============ */
// «Закончить игру» в меню паузы: тест бросается без сохранения результата.
// Того же ждёт вызов из общего кода, если пауза открылась из чужой игры.
function finishPausedSoloTestGame(){
  hideModal('pauseMenuModal');
  stopAllSounds();
  stopSoloTestSpeech();
  cancelSoloTestAdvance();
  state.inProgress = false;
  state.pausedMode = null;
  state.soloTestPaused = null;
  goToSoloTestSetup();
  saveState();
  updateResumeUI();
  showToast('Тест прерван — пройдите его заново');
}
// Пауза: запоминаем, на каком месте остановились, и отдаём экран хабу —
// общее меню паузы само покажется из updateResumeUI() по state.pausedMode.
// Отложенный переход к следующему вопросу при этом отменяется: он не должен
// сработать в фоне, пока открыт хаб.
function pauseSoloTestGame(){
  if(typeof stopAllSounds === 'function') stopAllSounds();
  stopSoloTestSpeech();
  cancelSoloTestAdvance();
  state.pausedMode = 'soloTest';
  state.lastSectionOnPause = 'soloView';
  state.soloTestPaused = { index: state.soloTestIndex || 0 };
  saveState();
  document.getElementById('soloTestGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('soloView');
  updateResumeUI();
}
// Продолжение. Ключевая тонкость: пауза может попасть в 450 мс между выбором
// ответа и показом следующего вопроса. Ответ к этому моменту УЖЕ записан,
// поэтому первый непройденный вопрос — с номером answers.length. Раньше здесь
// стоял отдельный вызов advanceSoloTest() для этого случая, и индекс
// сдвигался дважды: ответ, выбранный прямо перед паузой, закрывал сразу два
// вопроса, и один вопрос молча пропадал. Теперь достаточно взять максимум из
// снимка и числа записанных ответов — он покрывает оба случая паузы.
function resumeSoloTestGame(){
  state.pausedMode = null;
  const d = state.soloTestPaused || {};
  state.soloTestPaused = null;
  const answers = Array.isArray(state.soloTestAnswers) ? state.soloTestAnswers : [];
  const from = typeof d.index === 'number' ? d.index : (state.soloTestIndex || 0);
  state.soloTestIndex = Math.max(from, answers.length);
  saveState();
  updateResumeUI();
  goToGame(null, 'soloTestGame');
  updateMuteBtn();
  requestWakeLock();
  showSoloTestQuestion();
}

/* ============ ОЗВУЧКА ВОПРОСА ============ */
function pickSoloTestVoice(){
  if(!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const ru = voices.filter(v=>/^ru/i.test(v.lang));
  const pool = ru.length ? ru : voices;
  const female = pool.find(v=>/female|женск|milena|olga|katya/i.test(v.name));
  return female || pool[0] || null;
}
function stopSoloTestSpeech(){
  stopSpeech('soloTestTtsHint');
}
let soloTestSpeechTimerId = null;
function speakSoloTestCard(test){
  const t = test || soloTestById(state.soloTestType);
  const item = soloTestItems()[state.soloTestIndex];
  if(!item || !t || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  const text = [item.q, ...(Array.isArray(item.a) ? item.a : [])].join('. ');
  const utter = new SpeechSynthesisUtterance(stripQuotesForSpeech(text));
  utter.lang = 'ru-RU';
  utter.rate = 0.95;
  const voice = pickSoloTestVoice();
  if(voice) utter.voice = voice;
  const hint = document.getElementById('soloTestTtsHint');
  const fire = ()=>{
    soloTestSpeechTimerId = null;
    // Вопрос уже сменился — не озвучиваем устаревший текст.
    if(soloTestItems()[state.soloTestIndex] !== item) return;
    if(hint) hint.classList.add('speaking');
    utter.onend = ()=>{ if(hint) hint.classList.remove('speaking'); };
    utter.onerror = ()=>{ if(hint) hint.classList.remove('speaking'); };
    synth.speak(utter);
  };
  // speak() сразу после cancel() в тот же тик иногда проглатывается
  // браузером, но задержка перед КАЖДЫМ speak() рвёт связь с жестом
  // пользователя на мобильных. Поэтому ждём только когда правда прерываем
  // уже звучащую фразу.
  if(synth.speaking || synth.pending){
    synth.cancel();
    soloTestSpeechTimerId = setTimeout(fire, 50);
  } else {
    fire();
  }
}

/* ============ ПРОЙДЕННЫЕ (ИСТОРИЯ) ============ */
function formatSoloTestDate(ts){
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${pad(d.getFullYear())}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function soloTestHistoryShortText(entry){
  const r = (entry && entry.result) || {};
  if(r.title && r.icon) return `${r.icon} ${r.title}`;
  return r.title || '';
}
function goToSoloTestHistory(){
  const wrap = document.getElementById('soloTestHistoryList');
  if(!wrap) return;
  const history = state.soloTestHistory || [];
  if(history.length === 0){
    wrap.innerHTML = '<div class="card-text">Пока нет пройденных тестов — пройдите хотя бы один.</div>';
  } else {
    wrap.innerHTML = history.map((entry, idx)=>`
      <div class="solo-test-history-entry">
        <div class="solo-test-history-date">${formatSoloTestDate(entry.date)} · ${entry.testName || 'Тест'}</div>
        <div class="solo-test-history-text">${soloTestHistoryShortText(entry)}</div>
        <button type="button" class="solo-test-history-del" data-idx="${idx}" aria-label="Удалить результат из пройденных">✕</button>
      </div>
    `).join('');
  }
  document.getElementById('soloTestSetup').classList.remove('active');
  document.getElementById('soloTestHistory').classList.add('active');
}
document.getElementById('soloTestHistoryList').addEventListener('click', (e)=>{
  const btn = e.target.closest('.solo-test-history-del');
  if(!btn) return;
  playErrorSound();
  state.soloTestHistory.splice(parseInt(btn.dataset.idx, 10), 1);
  saveState();
  goToSoloTestHistory();
});
function exitSoloTestHistory(){
  goToSoloTestSetup();
}
document.getElementById('soloTestHistoryBtn').addEventListener('click', ()=>{ goToSoloTestHistory(); });
document.getElementById('soloTestHistoryExitBtn').addEventListener('click', ()=>{ exitSoloTestHistory(); });
