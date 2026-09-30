
// games/fun-tests.js — игра «Весёлые тесты» (для детей).
// Загружается через <script src="games/fun-tests.js"></script> в index.html,
// данные — cards/cards_fun_tests.js (FUN_TESTS, FUN_TEST_ITEMS).
//
// ЧТО ЭТО ТАКОЕ
// Копия механики «Пройди тест» (games/fun-test.js) для ребёнка: тот же
// экран карточки с вопросом и вариантами ответа, тот же прогресс-бар, то же
// меню паузы с продолжением с того же места, тот же экран итогов с описанием,
// сильными сторонами и подсказкой, та же история «Пройденные» с
// раскрытием результата по нажатию. Отличия — в содержании и в подаче:
//
//   • 14 тестов по 10 вопросов: герой приключений, суперталант, персонаж
//     мультфильма, как учится, тип исследователя, творческий стиль,
//     командный игрок, решение задач, идеальный день, питомец, мир
//     фантазий, друг, эмоции и безопасный интернет;
//   • подписи в итогах детские: не «Сильные стороны» и «Возможные
//     трудности», а «Что у тебя получается» и «На что обратить внимание»;
//   • оформление группы «Игры с детьми» (общий бирюзовый фон карточки и
//     общий компонент кнопок ответа) — карточка #funTestsCard включена в
//     общий блок детских карточек в styles/app.css.
//
// ПРО ТЕСТ О БЕЗОПАСНОСТИ В ИНТЕРНЕТЕ
// «Безопасный интернет-герой» — сценарный тест про личные данные. Такие тесты
// проходят ТОЛЬКО вместе со взрослым и только для разговора: оценки и
// подсчёта «правильных ответов» здесь нет, результат — добрый образ и
// подсказка, что обсудить. Как наказание или как проверка такой тест
// использовать нельзя, и это сказано в правилах игры, в README и в шапке
// файла данных.
//
// ПАУЗА
// Полноценная (в реестре games/game-registry.js): тест длинный, прерывать
// его на середине обидно. Снимок funTestsPaused хранит номер вопроса, при
// возврате он сверяется с числом записанных ответов — иначе пауза в паузе
// между ответом и следующим вопросом пропустила бы вопрос.

/* ============ ДАННЫЕ ВЫБРАННОГО ТЕСТА ============ */
function funTestsList(){
  return (typeof FUN_TESTS !== 'undefined' && Array.isArray(FUN_TESTS)) ? FUN_TESTS : [];
}
function funTestsById(id){
  return funTestsList().find(t => t.id === id) || null;
}
// Вопросы выбранного теста. Неизвестный id или отсутствие данных не должны
// ронять игру: возвращаем пустой список, а startFunTestsGame покажет
// игроку понятное сообщение.
function funTestsItems(){
  const test = funTestsById(state.funTestsType);
  const list = (typeof FUN_TEST_ITEMS !== 'undefined' && FUN_TEST_ITEMS) ? FUN_TEST_ITEMS : {};
  const items = test ? list[test.id] : null;
  return Array.isArray(items) ? items : [];
}
function goToFunTestsSetup(){
  goToGameSetup('funTestsSetup', null, ()=>{
    renderFunTestsTypeGroup();
  });
}

/* ============ ЭКРАН НАСТРОЙКИ ============ */
// Выбор теста — те же плашки .level-toggle, что у «Пройдите теста» и
// остальных игр. Подпись .ldesc намеренно НЕ выводится: у части названий
// («Насколько вы готовы к отношениям») она заняла бы три строки и подняла бы
// плашку выше стандартных 56px уровней остальных игр. Что измеряет каждый
// тест — в правилах игры и в README.
function renderFunTestsTypeGroup(){
  const wrap = document.getElementById('funTestsTypeGroup');
  if(!wrap) return;
  const tests = funTestsList();
  if(!funTestsById(state.funTestsType)){
    state.funTestsType = tests[0] ? tests[0].id : 'adventure';
    saveState();
  }
  wrap.innerHTML = '';
  tests.forEach(t=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + (state.funTestsType === t.id ? ' on' : '');
    div.innerHTML = `<div class="lname">${t.icon} ${t.name}</div><div class="level-check"></div>`;
    div.addEventListener('click', ()=>{
      state.funTestsType = t.id;
      saveState();
      renderFunTestsTypeGroup();
    });
    wrap.appendChild(div);
  });
}
// Выход с экрана настройки — прямо в хаб, раздел «Игры для одного». Так же,
// как exitCompatTestSetup(): через exitGame() откат возвращал бы экран настроек
// сам на себя, потому что точкой входа goToGameSetup() записал именно его.
// Связанные флаги inProgress и pausedMode снимаются вместе.
function exitFunTestsSetup(){
  state.inProgress = false;
  state.pausedMode = null;
  state.lastSectionOnPause = null;
  saveState();
  const pauseModal = document.getElementById('pauseMenuModal');
  if(pauseModal) pauseModal.classList.remove('show');
  document.querySelectorAll('.screen.active').forEach(el=>el.classList.remove('active'));
  const setup = document.getElementById('setup');
  if(setup) setup.classList.add('active');
  showSetupView('kidsView');
  if(typeof updateResumeUI === 'function') updateResumeUI();
  window.scrollTo(0, 0);
}
document.getElementById('funTestsSetupExitBtn').addEventListener('click', ()=>{ exitFunTestsSetup(); });
// Кнопки «Правила» в самой игре нет: правила открываются из общего хаба
// «Правила игр» в меню (см. RULES_HUB в games/fants-timer.js), как у всех
// остальных игр. setupRulesModal вешает закрытие по крестику и по фону.
setupRulesModal('funTestsRulesModal', 'closeFunTestsRulesBtn');

/* ============ ПАРТИЯ ============ */
let funTestsAdvanceTimerId = null; // отложенный переход к следующему вопросу
let funTestsCurrentOptions = [];   // варианты текущего вопроса в порядке показа
let funTestsAnswered = false;      // ответ на текущий вопрос уже выбран
function cancelFunTestsAdvance(){
  if(funTestsAdvanceTimerId){ clearTimeout(funTestsAdvanceTimerId); funTestsAdvanceTimerId = null; }
}
function startFunTestsGame(){
  const items = funTestsItems();
  if(!items.length){
    showToast('Не удалось загрузить вопросы — обновите приложение');
    return;
  }
  cancelFunTestsAdvance();
  // Сбрасываем чужие партии: тест личный, чужая пауза тут неуместна.
  abandonPausedSession('fanty');
  abandonPausedSession('compatTest');
  state.funTestsIndex = 0;
  // Ответы: по одному на вопрос. type — индекс типа (mode:'types') или сумма
  // баллов (mode:'scale'); у scale-тестов в сумму идёт индекс варианта.
  state.funTestsAnswers = [];
  state.funTestsResult = null;
  goToGame(null, 'funTestsGame');
  updateMuteBtn();
  requestWakeLock();
  showFunTestsQuestion();
}

function updateFunTestsProgress(){
  const total = funTestsItems().length;
  const done = Math.min(state.funTestsIndex || 0, total);
  const fill = document.getElementById('funTestsProgressFill');
  if(fill) fill.style.width = (total > 0 ? Math.round((done / total) * 100) : 0) + '%';
  const label = document.getElementById('funTestsProgressLabel');
  if(label) label.textContent = `${done} / ${total}`;
}

function showFunTestsQuestion(){
  const test = funTestsById(state.funTestsType);
  const items = funTestsItems();
  const item = items[state.funTestsIndex];
  if(!item || !Array.isArray(item.a) || !item.a.length){
    finishFunTestsGame();
    return;
  }
  funTestsAnswered = false;
  // Варианты перемешиваются: иначе по позиции кнопки можно было бы угадать
  // ответ (в данных порядок канонический — индекс = тип или балл).
  funTestsCurrentOptions = item.a.map((text, i)=>({ text, i }));
  if(typeof shuffle === 'function') funTestsCurrentOptions = shuffle(funTestsCurrentOptions);
  const answersHtml = funTestsCurrentOptions
    .map((o, pos)=>`<button type="button" class="btn btn-secondary znayu-answer-btn" data-pos="${pos}">${o.text}</button>`).join('');
  fadeSwapEl('funTestsCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="znayu-question-text">${item.q}</div></div>`
      + `<div class="znayu-answers">${answersHtml}</div><div class="quiz-tts-hint" id="funTestsTtsHint">🔊</div></div>`;
    el.querySelectorAll('.znayu-answer-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{ answerFunTestsQuestion(parseInt(btn.dataset.pos, 10)); });
    });
  });
  updateFunTestsProgress();
  if(state.autoSpeak) speakFunTestsCard(test);
}
// Пропуска нет: у каждого вопроса есть варианты ответа, «время вышло» не
// предусмотрено — отвечать нужно осознанно.
function answerFunTestsQuestion(pos){
  if(funTestsAnswered) return;
  const option = funTestsCurrentOptions[pos];
  if(!option) return;
  funTestsAnswered = true;
  stopFunTestsSpeech();
  // Защита от повторного клика по той же карточке: записанных ответов должно
  // быть ровно столько же, сколько номер текущего вопроса. Иначе второй клик
  // дописывал бы лишний ответ и сдвигал подсчёт.
  if((state.funTestsAnswers || []).length > (state.funTestsIndex || 0)) return;
  if(!Array.isArray(state.funTestsAnswers)) state.funTestsAnswers = [];
  state.funTestsAnswers.push(option.i);
  playSuccessSound();
  saveState();
  document.querySelectorAll('#funTestsCard .znayu-answer-btn').forEach((btn, i)=>{
    btn.disabled = true;
    if(i === pos) btn.classList.add('answer-correct');
  });
  funTestsAdvanceTimerId = setTimeout(advanceFunTests, 450);
}
function advanceFunTests(){
  funTestsAdvanceTimerId = null;
  state.funTestsIndex = (state.funTestsIndex || 0) + 1;
  saveState();
  showFunTestsQuestion();
}
document.getElementById('funTestsCard').addEventListener('click', (e)=>{
  if(e.target.closest('.znayu-answer-btn')) return;
  if(funTestsAnswered) return;
  if(!state.autoSpeak) return;
  if(!funTestsItems()[state.funTestsIndex]) return;
  speakFunTestsCard(funTestsById(state.funTestsType));
});
document.getElementById('funTestsStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  startFunTestsGame();
});

/* ============ РАСЧЁТ РЕЗУЛЬТАТА ============ */
// mode:'types' — тип с наибольшим числом выборов. При равенстве (типов
// обычно 3–5, вопросов 10 — ничья не редкость) берётся первый по порядку в
// данных: порядок типов в файле данных осмысленный, а не случайный, поэтому
// результат остаётся предсказуемым. mode:'scale' — сумма индексов вариантов
// (0…3 в вопросе, 0…30 по тесту) и последний уровень, у которого min ≤ суммы.
function computeFunTestsResult(){
  const test = funTestsById(state.funTestsType);
  const answers = Array.isArray(state.funTestsAnswers) ? state.funTestsAnswers : [];
  if(!test || !Array.isArray(test.types) || !test.types.length){
    return { title: 'Пока ничего не получилось', text: 'Ответьте на все вопросы, чтобы увидеть результат.', plus: '', minus: '', tip: '' };
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
    // иначе вместо суммы баллов игрок увидел бы «Твой ответ выбрали 10
    // из 10», хотя считалась сумма, а не голоса.
    return { ...type, sum, total: funTestsItems().length };
  }
  const counts = test.types.map(()=>0);
  answers.forEach(v=>{ if(typeof v === 'number' && counts[v] !== undefined) counts[v]++; });
  let best = 0;
  for(let i = 1; i < counts.length; i++){
    if(counts[i] > counts[best]) best = i;
  }
  // count — число голосов ЗА выбранный тип (counts[best]), а не ответ на
  // вопрос с таким номером: в state лежат индексы типов, а не счётчики.
  return { ...test.types[best], count: counts[best], total: funTestsItems().length, max: Math.max(...counts) };
}

/* ============ ИТОГИ И СОХРАНЕНИЕ ============ */
function finishFunTestsGame(){
  cancelFunTestsAdvance();
  stopFunTestsSpeech();
  const result = computeFunTestsResult();
  const test = funTestsById(state.funTestsType);
  state.funTestsResult = result;
  // История хранит итог, а не сырые ответы: после партии нужен результат, а
  // список всех вопросов занимал бы место ради данных, которые никто больше
  // не читает. «Сбросить прогресс» чистит и её.
  if(!Array.isArray(state.funTestsHistory)) state.funTestsHistory = [];
  state.funTestsHistory.unshift({
    date: Date.now(),
    testId: state.funTestsType,
    testName: test ? test.name : 'Тест',
    result,
  });
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  renderFunTestsSummary();
  document.getElementById('funTestsGame').classList.remove('active');
  document.getElementById('funTestsSummary').classList.add('active');
}
// Содержимое результата в одном месте: им заполняются и экран итогов, и
// раскрытая запись в «Пройденных». Дублировать разметку в двух местах было бы
// верным способом со временем получить разные тексты на этих экранах.
function funTestsResultBodyHtml(result, typeIcon, typeTitle, stat){
  return `
    <div class="fun-tests-type">${typeIcon} ${typeTitle}</div>
    <div class="fun-tests-verdict">${result.text || ''}</div>
    ${stat || ''}
    ${result.plus ? `<div class="fun-tests-plus"><b>Что у тебя получается</b>${result.plus}</div>` : ''}
    ${result.minus ? `<div class="fun-tests-minus"><b>На что обратить внимание</b>${result.minus}</div>` : ''}
    ${result.tip ? `<div class="fun-tests-tip"><b>Можно попробовать</b>${result.tip}</div>` : ''}
  `;
}
// Счётчик для результата: в «types»-тестах — сколько ответов легло на выбранный
// тип, в «scale»-тестах — сумма баллов по шкале. Вынесено отдельно, потому что
// нужно и в итогах, и в раскрытой записи истории.
function funTestsResultStat(result){
  if(typeof result.count === 'number' && typeof result.total === 'number'){
    return `<div class="fun-tests-stat">Твой ответ выбрали ${result.count} из ${result.total}`
      + (typeof result.max === 'number' ? ` раз, чаще всего ${result.max}` : '') + '</div>';
  }
  if(typeof result.sum === 'number' && typeof result.total === 'number'){
    return `<div class="fun-tests-stat">Сумма баллов: ${result.sum} · вопросов: ${result.total}</div>`;
  }
  return '';
}
function renderFunTestsSummary(){
  const test = funTestsById(state.funTestsType);
  const result = state.funTestsResult || {};
  const title = document.getElementById('funTestsSummaryTitle');
  if(title) title.textContent = `${test ? test.icon : '🪁'} ${test ? test.name : 'Тест'}`;
  const list = document.getElementById('funTestsSummaryList');
  if(!list) return;
  const typeIcon = result.icon || (test ? test.icon : '🪁');
  const typeTitle = result.title || 'Пока ничего не получилось';
  const stat = funTestsResultStat(result);
  list.innerHTML = funTestsResultBodyHtml(result, typeIcon, typeTitle, stat);
  const note = document.getElementById('funTestsSummaryNote');
  if(note) note.textContent = 'Результат сохранён в «Пройденные» — его можно открыть позже.';
}
// Выход с итогов — в настройки игры (не в общий хаб), тем же путём, что и
// «Выход» с настроек: гасятся все активные экраны, запоминается точка входа.
function exitFunTestsSummary(){
  goToFunTestsSetup();
  state.inProgress = false;
  state.pausedMode = null;
  state.funTestsPaused = null;
  saveState();
  updateResumeUI();
}
document.getElementById('funTestsSummaryExitBtn').addEventListener('click', ()=>{ exitFunTestsSummary(); });

/* ============ ПАУЗА, ВОЗОБНОВЛЕНИЕ, ЗАВЕРШЕНИЕ ============ */
// «Закончить игру» в меню паузы: тест бросается без сохранения результата.
// Того же ждёт вызов из общего кода, если пауза открылась из чужой игры.
function finishPausedFunTestsGame(){
  hideModal('pauseMenuModal');
  stopAllSounds();
  stopFunTestsSpeech();
  cancelFunTestsAdvance();
  state.inProgress = false;
  state.pausedMode = null;
  state.funTestsPaused = null;
  goToFunTestsSetup();
  saveState();
  updateResumeUI();
  showToast('Тест прерван — пройдите его заново');
}
// Пауза: запоминаем, на каком месте остановились, и отдаём экран хабу —
// общее меню паузы само покажется из updateResumeUI() по state.pausedMode.
// Отложенный переход к следующему вопросу при этом отменяется: он не должен
// сработать в фоне, пока открыт хаб.
function pauseFunTestsGame(){
  if(typeof stopAllSounds === 'function') stopAllSounds();
  stopFunTestsSpeech();
  cancelFunTestsAdvance();
  state.pausedMode = 'funTests';
  state.lastSectionOnPause = 'kidsView';
  state.funTestsPaused = { index: state.funTestsIndex || 0 };
  saveState();
  document.getElementById('funTestsGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('kidsView');
  updateResumeUI();
}
// Продолжение. Ключевая тонкость: пауза может попасть в 450 мс между выбором
// ответа и показом следующего вопроса. Ответ к этому моменту УЖЕ записан,
// поэтому первый непройденный вопрос — с номером answers.length. Раньше здесь
// стоял отдельный вызов advanceFunTests() для этого случая, и индекс
// сдвигался дважды: ответ, выбранный прямо перед паузой, закрывал сразу два
// вопроса, и один вопрос молча пропадал. Теперь достаточно взять максимум из
// снимка и числа записанных ответов — он покрывает оба случая паузы.
function resumeFunTestsGame(){
  state.pausedMode = null;
  const d = state.funTestsPaused || {};
  state.funTestsPaused = null;
  const answers = Array.isArray(state.funTestsAnswers) ? state.funTestsAnswers : [];
  const from = typeof d.index === 'number' ? d.index : (state.funTestsIndex || 0);
  state.funTestsIndex = Math.max(from, answers.length);
  saveState();
  updateResumeUI();
  goToGame(null, 'funTestsGame');
  updateMuteBtn();
  requestWakeLock();
  showFunTestsQuestion();
}

/* ============ ОЗВУЧКА ВОПРОСА ============ */
function pickFunTestsVoice(){
  if(!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const ru = voices.filter(v=>/^ru/i.test(v.lang));
  const pool = ru.length ? ru : voices;
  const female = pool.find(v=>/female|женск|milena|olga|katya/i.test(v.name));
  return female || pool[0] || null;
}
function stopFunTestsSpeech(){
  stopSpeech('funTestsTtsHint');
}
let funTestsSpeechTimerId = null;
function speakFunTestsCard(test){
  const t = test || funTestsById(state.funTestsType);
  const item = funTestsItems()[state.funTestsIndex];
  if(!item || !t || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  const text = [item.q, ...(Array.isArray(item.a) ? item.a : [])].join('. ');
  const utter = new SpeechSynthesisUtterance(stripQuotesForSpeech(text));
  utter.lang = 'ru-RU';
  utter.rate = 0.95;
  const voice = pickFunTestsVoice();
  if(voice) utter.voice = voice;
  const hint = document.getElementById('funTestsTtsHint');
  const fire = ()=>{
    funTestsSpeechTimerId = null;
    // Вопрос уже сменился — не озвучиваем устаревший текст.
    if(funTestsItems()[state.funTestsIndex] !== item) return;
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
    funTestsSpeechTimerId = setTimeout(fire, 50);
  } else {
    fire();
  }
}

/* ============ ПРОЙДЕННЫЕ (ИСТОРИЯ) ============ */
function formatFunTestsDate(ts){
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${pad(d.getFullYear())}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function funTestsHistoryShortText(entry){
  const r = (entry && entry.result) || {};
  if(r.title && r.icon) return `${r.icon} ${r.title}`;
  return r.title || '';
}
// Раскрытые записи «Пройденных». Хранятся по ключу «дата:id теста», а не по
// индексу: индексы сдвигаются при удалении записи крестиком, и раскрытая
// строка съезжала бы на соседнюю. Это тот же приём, что у групп карты тела
// в «Узнай больше» (state.knowMoreOpen).
function funTestsOpenEntries(){
  return Array.isArray(state.funTestsOpen) ? state.funTestsOpen : [];
}
function funTestsEntryKey(entry){
  return `${(entry && entry.date) || 0}:${(entry && entry.testId) || ''}`;
}
function isFunTestsEntryOpen(entry){
  return funTestsOpenEntries().indexOf(funTestsEntryKey(entry)) >= 0;
}
// Раскрывает/сворачивает запись и возвращает новое состояние: true — раскрыта.
function toggleFunTestsEntry(entry){
  const open = funTestsOpenEntries();
  const key = funTestsEntryKey(entry);
  const at = open.indexOf(key);
  if(at >= 0){
    open.splice(at, 1);
    state.funTestsOpen = open;
    saveState();
    return false;
  }
  open.push(key);
  state.funTestsOpen = open;
  saveState();
  return true;
}
// Полное содержимое сохранённого результата: тот же блок, что на экране итогов.
// Раньше в списке была только строка с названием типа, и по ней нельзя было
// понять, что тип значит, — теперь результат раскрывается по нажатию.
function funTestsEntryBodyHtml(entry){
  const r = (entry && entry.result) || {};
  const test = funTestsById((entry && entry.testId) || '');
  const typeIcon = r.icon || (test ? test.icon : '\U0001f9ea');
  const typeTitle = r.title || 'Пока ничего не получилось';
  return funTestsResultBodyHtml(r, typeIcon, typeTitle, funTestsResultStat(r));
}
function goToFunTestsHistory(){
  const wrap = document.getElementById('funTestsHistoryList');
  if(!wrap) return;
  const history = state.funTestsHistory || [];
  if(history.length === 0){
    wrap.innerHTML = '<div class="card-text">Пока нет пройденных тестов — пройдите хотя бы один.</div>';
  } else {
    wrap.innerHTML = history.map((entry, idx)=>{
      const open = isFunTestsEntryOpen(entry);
      return `
      <div class="fun-tests-history-entry${open ? ' open' : ''}">
        <button type="button" class="fun-tests-history-head" data-idx="${idx}" aria-expanded="${open}">
          <span class="fun-tests-history-date">${formatFunTestsDate(entry.date)} · ${entry.testName || 'Тест'}</span>
          <span class="fun-tests-history-text">${funTestsHistoryShortText(entry)}</span>
          <span class="fun-tests-history-hint">${open ? 'Свернуть' : 'Что это значит'}</span>
        </button>
        <div class="fun-tests-history-body">${funTestsEntryBodyHtml(entry)}</div>
        <button type="button" class="fun-tests-history-del" data-idx="${idx}" aria-label="Удалить результат из пройденных">✕</button>
      </div>`;
    }).join('');
  }
  document.getElementById('funTestsSetup').classList.remove('active');
  document.getElementById('funTestsHistory').classList.add('active');
}
document.getElementById('funTestsHistoryList').addEventListener('click', (e)=>{
  // Крестик удаления — раньше по нему и только по нему и открывался этот
  // список, поэтому порядок веток важен: удаление не должно ещё и раскрывать
  // запись, а нажатие на заголовок — не удалять её.
  const del = e.target.closest('.fun-tests-history-del');
  if(del){
    playErrorSound();
    state.funTestsHistory.splice(parseInt(del.dataset.idx, 10), 1);
    saveState();
    goToFunTestsHistory();
    return;
  }
  const head = e.target.closest('.fun-tests-history-head');
  if(!head) return;
  const entry = (state.funTestsHistory || [])[parseInt(head.dataset.idx, 10)];
  if(!entry) return;
  toggleFunTestsEntry(entry);
  playSuccessSound();
  goToFunTestsHistory();
});
function exitFunTestsHistory(){
  goToFunTestsSetup();
}
document.getElementById('funTestsHistoryBtn').addEventListener('click', ()=>{ goToFunTestsHistory(); });
document.getElementById('funTestsHistoryExitBtn').addEventListener('click', ()=>{ exitFunTestsHistory(); });
