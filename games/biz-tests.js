// games/biz-tests.js — игра «Бизнес тесты» (для одного человека).
// Загружается через <script src="games/biz-tests.js"></script> в index.html,
// данные — cards/cards_biz_tests.js (BIZ_TESTS, BIZ_TEST_ITEMS).
//
// МЕХАНИКА
// Копия механики «Пройди тест» (games/solo-test.js): тот же экран карточки с
// вопросом и вариантами ответа, тот же прогресс-бар, тот же разбор итогов, та
// же история «Пройденные» с раскрытием результата по нажатию и то же меню
// паузы с продолжением с того же места. Отвечает один человек: «Передайте
// телефон», второго игрока и разбора расхождений здесь нет.
//
// Отличия — в подсчёте. Три способа, все заданы данными:
//
//   mode:'types'    — побеждает ТИП, за который проголосовали чаще;
//   mode:'scale'    — сумма баллов по шкале 0…3 и уровень по порогу;
//   mode:'profile'  — ПРОФИЛЬ ИЗ НЕСКОЛЬКИХ ШКАЛ: в таких темах (Big Five и
//                     эмоциональный интеллект в бизнесе) пять независимых
//                     черт, и «победитель» был бы бессмыслен. Считается сумма
//                     баллов по КАЖДОЙ шкале отдельно (вопрос помечен g:), и
//                     выводится уровень по каждой шкале. Режим добавлен здесь,
//                     а не в общем движке: в «Пройди тест» и «Весёлых тестах»
//                     он не используется.
//
// ЧТО ЭТО НЕ ЯВЛЯЕТСЯ
// Это разговорный самотест, а не инструмент аттестации. Под темы взяты
// известные конструменты организационной психологии (Big Five, стили
// конфликта, готовность к риску, делегирование), но все формулировки
// написаны для этого приложения, у наборов НЕТ психометрической проверки,
// норм и референсных групп. Результат нельзя использовать для найма,
// увольнений и оценки сотрудников — для этого нужны ассессмент, интервью и
// работа с психологом. Это написано в правилах игры, в README и в шапке
// cards/cards_biz_tests.js.
//
// ОФОРМЛЕНИЕ
// Карточка игры остаётся светлой, как у соседних игр группы «Бизнес игры»
// («Оцени бизнес»): группового градиента у этой группы нет, и вводить свой
// ради одной игры означало бы выбиваться из раздела. Свои классы —
// .biz-test-*, чтобы оформление не зависело от остальных игр.
//
// ПАУЗА
// Полноценная (в реестре games/game-registry.js): тест длинный — десять
// вопросов с размышлением, — бросать его на середине обидно. Снимок
// bizTestsPaused хранит номер вопроса; при возврате он сверяется с числом
// записанных ответов, иначе пауза в паузе между ответом и следующим
// вопросом пропускала бы вопрос.

/* ============ ДАННЫЕ ВЫБРАННОГО ТЕСТА ============ */
function bizTestsList(){
  return (typeof BIZ_TESTS !== 'undefined' && Array.isArray(BIZ_TESTS)) ? BIZ_TESTS : [];
}
function bizTestsById(id){
  return bizTestsList().find(t => t.id === id) || null;
}
// Вопросы выбранного теста. Неизвестный id или отсутствие данных не должны
// ронять игру: возвращаем пустой список, а startBizTestsGame покажет
// игроку понятное сообщение.
function bizTestsItems(){
  const test = bizTestsById(state.bizTestsType);
  const list = (typeof BIZ_TEST_ITEMS !== 'undefined' && BIZ_TEST_ITEMS) ? BIZ_TEST_ITEMS : {};
  const items = test ? list[test.id] : null;
  return Array.isArray(items) ? items : [];
}
function goToBizTestsSetup(){
  goToGameSetup('bizTestsSetup', null, ()=>{
    renderBizTestsTypeGroup();
  });
}

/* ============ ЭКРАН НАСТРОЙКИ ============ */
// Выбор теста — те же плашки .level-toggle, что у «Пройдите теста» и
// остальных игр. Подпись .ldesc намеренно НЕ выводится: у части названий
// («Насколько вы готовы к отношениям») она заняла бы три строки и подняла бы
// плашку выше стандартных 56px уровней остальных игр. Что измеряет каждый
// тест — в правилах игры и в README.
function renderBizTestsTypeGroup(){
  const wrap = document.getElementById('bizTestsTypeGroup');
  if(!wrap) return;
  const tests = bizTestsList();
  if(!bizTestsById(state.bizTestsType)){
    state.bizTestsType = tests[0] ? tests[0].id : 'bigfive';
    saveState();
  }
  wrap.innerHTML = '';
  tests.forEach(t=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + (state.bizTestsType === t.id ? ' on' : '');
    div.innerHTML = `<div class="lname">${t.icon} ${t.name}</div><div class="level-check"></div>`;
    div.addEventListener('click', ()=>{
      state.bizTestsType = t.id;
      saveState();
      renderBizTestsTypeGroup();
    });
    wrap.appendChild(div);
  });
}
// Выход с экрана настройки — прямо в хаб, раздел «Игры для одного». Так же,
// как exitCompatTestSetup(): через exitGame() откат возвращал бы экран настроек
// сам на себя, потому что точкой входа goToGameSetup() записал именно его.
// Связанные флаги inProgress и pausedMode снимаются вместе.
function exitBizTestsSetup(){
  state.inProgress = false;
  state.pausedMode = null;
  state.lastSectionOnPause = null;
  saveState();
  const pauseModal = document.getElementById('pauseMenuModal');
  if(pauseModal) pauseModal.classList.remove('show');
  document.querySelectorAll('.screen.active').forEach(el=>el.classList.remove('active'));
  const setup = document.getElementById('setup');
  if(setup) setup.classList.add('active');
  showSetupView('businessView');
  if(typeof updateResumeUI === 'function') updateResumeUI();
  window.scrollTo(0, 0);
}
document.getElementById('bizTestsSetupExitBtn').addEventListener('click', ()=>{ exitBizTestsSetup(); });
// Кнопки «Правила» в самой игре нет: правила открываются из общего хаба
// «Правила игр» в меню (см. RULES_HUB в games/fants-timer.js), как у всех
// остальных игр. setupRulesModal вешает закрытие по крестику и по фону.
setupRulesModal('bizTestsRulesModal', 'closeBizTestsRulesBtn');

/* ============ ПАРТИЯ ============ */
let bizTestsAdvanceTimerId = null; // отложенный переход к следующему вопросу
let bizTestsCurrentOptions = [];   // варианты текущего вопроса в порядке показа
let bizTestsAnswered = false;      // ответ на текущий вопрос уже выбран
function cancelBizTestsAdvance(){
  if(bizTestsAdvanceTimerId){ clearTimeout(bizTestsAdvanceTimerId); bizTestsAdvanceTimerId = null; }
}
function startBizTestsGame(){
  const items = bizTestsItems();
  if(!items.length){
    showToast('Не удалось загрузить вопросы — обновите приложение');
    return;
  }
  cancelBizTestsAdvance();
  // Сбрасываем чужие партии: тест личный, чужая пауза тут неуместна.
  abandonPausedSession('fanty');
  abandonPausedSession('compatTest');
  state.bizTestsIndex = 0;
  // Ответы: по одному на вопрос. type — индекс типа (mode:'types') или сумма
  // баллов (mode:'scale'); у scale-тестов в сумму идёт индекс варианта.
  state.bizTestsAnswers = [];
  state.bizTestsResult = null;
  goToGame(null, 'bizTestsGame');
  updateMuteBtn();
  requestWakeLock();
  showBizTestsQuestion();
}

function updateBizTestsProgress(){
  const total = bizTestsItems().length;
  const done = Math.min(state.bizTestsIndex || 0, total);
  const fill = document.getElementById('bizTestsProgressFill');
  if(fill) fill.style.width = (total > 0 ? Math.round((done / total) * 100) : 0) + '%';
  const label = document.getElementById('bizTestsProgressLabel');
  if(label) label.textContent = `${done} / ${total}`;
}

function showBizTestsQuestion(){
  const test = bizTestsById(state.bizTestsType);
  const items = bizTestsItems();
  const item = items[state.bizTestsIndex];
  if(!item || !Array.isArray(item.a) || !item.a.length){
    finishBizTestsGame();
    return;
  }
  bizTestsAnswered = false;
  // Варианты перемешиваются: иначе по позиции кнопки можно было бы угадать
  // ответ (в данных порядок канонический — индекс = тип или балл).
  bizTestsCurrentOptions = item.a.map((text, i)=>({ text, i }));
  if(typeof shuffle === 'function') bizTestsCurrentOptions = shuffle(bizTestsCurrentOptions);
  const answersHtml = bizTestsCurrentOptions
    .map((o, pos)=>`<button type="button" class="btn btn-secondary znayu-answer-btn" data-pos="${pos}">${o.text}</button>`).join('');
  fadeSwapEl('bizTestsCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="znayu-question-text">${item.q}</div></div>`
      + `<div class="znayu-answers">${answersHtml}</div><div class="quiz-tts-hint" id="bizTestsTtsHint">🔊</div></div>`;
    el.querySelectorAll('.znayu-answer-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{ answerBizTestsQuestion(parseInt(btn.dataset.pos, 10)); });
    });
  });
  updateBizTestsProgress();
  if(state.autoSpeak) speakBizTestsCard(test);
}
// Пропуска нет: у каждого вопроса есть варианты ответа, «время вышло» не
// предусмотрено — отвечать нужно осознанно.
function answerBizTestsQuestion(pos){
  if(bizTestsAnswered) return;
  const option = bizTestsCurrentOptions[pos];
  if(!option) return;
  bizTestsAnswered = true;
  stopBizTestsSpeech();
  // Защита от повторного клика по той же карточке: записанных ответов должно
  // быть ровно столько же, сколько номер текущего вопроса. Иначе второй клик
  // дописывал бы лишний ответ и сдвигал подсчёт.
  if((state.bizTestsAnswers || []).length > (state.bizTestsIndex || 0)) return;
  if(!Array.isArray(state.bizTestsAnswers)) state.bizTestsAnswers = [];
  state.bizTestsAnswers.push(option.i);
  playSuccessSound();
  saveState();
  document.querySelectorAll('#bizTestsCard .znayu-answer-btn').forEach((btn, i)=>{
    btn.disabled = true;
    if(i === pos) btn.classList.add('answer-correct');
  });
  bizTestsAdvanceTimerId = setTimeout(advanceBizTests, 450);
}
function advanceBizTests(){
  bizTestsAdvanceTimerId = null;
  state.bizTestsIndex = (state.bizTestsIndex || 0) + 1;
  saveState();
  showBizTestsQuestion();
}
document.getElementById('bizTestsCard').addEventListener('click', (e)=>{
  if(e.target.closest('.znayu-answer-btn')) return;
  if(bizTestsAnswered) return;
  if(!state.autoSpeak) return;
  if(!bizTestsItems()[state.bizTestsIndex]) return;
  speakBizTestsCard(bizTestsById(state.bizTestsType));
});
document.getElementById('bizTestsStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  startBizTestsGame();
});

/* ============ РАСЧЁТ РЕЗУЛЬТАТА ============ */
// mode:'types' — тип с наибольшим числом выборов. При равенстве (типов
// обычно 3–5, вопросов 10 — ничья не редкость) берётся первый по порядку в
// данных: порядок типов в файле данных осмысленный, а не случайный, поэтому
// результат остаётся предсказуемым. mode:'scale' — сумма индексов вариантов
// (0…3 в вопросе, 0…30 по тесту) и последний уровень, у которого min ≤ суммы.
function computeBizTestsResult(){
  const test = bizTestsById(state.bizTestsType);
  const answers = Array.isArray(state.bizTestsAnswers) ? state.bizTestsAnswers : [];
  if(!test || !Array.isArray(test.types) || !test.types.length){
    return { title: 'Результат не определён', text: 'Ответьте на все вопросы, чтобы увидеть результат.', plus: '', minus: '', tip: '' };
  }
  if(test.mode === 'profile'){
    return computeBizProfileResult(test, answers);
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
    return { ...type, sum, total: bizTestsItems().length };
  }
  const counts = test.types.map(()=>0);
  answers.forEach(v=>{ if(typeof v === 'number' && counts[v] !== undefined) counts[v]++; });
  let best = 0;
  for(let i = 1; i < counts.length; i++){
    if(counts[i] > counts[best]) best = i;
  }
  // count — число голосов ЗА выбранный тип (counts[best]), а не ответ на
  // вопрос с таким номером: в state лежат индексы типов, а не счётчики.
  return { ...test.types[best], count: counts[best], total: bizTestsItems().length, max: Math.max(...counts) };
}

// mode:'profile' — несколько независимых шкал (Big Five, эмоциональный
// интеллект в бизнесе). У каждого вопроса есть метка g: какая шкала
// измеряется, а варианты 0…3 — насколько выражена черта в этом ответе. Сумма
// считается по каждой шкале отдельно; уровень выбирается последним, у которого
// min ≤ суммы. Возвращаем профили вместе с общим блоком результата, потому
// что верхний экран (тип целиком) показывается и для таких тестов.
function computeBizProfileResult(test, answers){
  const items = bizTestsItems();
  const answersOf = (key) => items
    .map((it, i) => ({ it, i }))
    .filter(x => x.it && x.it.g === key)
    .map(x => answers[x.i])
    .filter(v => typeof v === 'number');
  const profiles = (Array.isArray(test.profiles) ? test.profiles : []).map((p, idx) => {
    const sum = answersOf(p.key).reduce((acc, v)=> acc + v, 0);
    const levels = Array.isArray(p.levels) ? p.levels : [];
    let level = levels[levels.length - 1] || {};
    for(const l of levels){
      if(sum >= (typeof l.min === 'number' ? l.min : 0)) level = l;
    }
    return { key: p.key, name: p.name, icon: p.icon, sum, count: answersOf(p.key).length, level };
  });
  return { ...test.types[0], profiles, total: items.length };
}

/* ============ ИТОГИ И СОХРАНЕНИЕ ============ */
function finishBizTestsGame(){
  cancelBizTestsAdvance();
  stopBizTestsSpeech();
  const result = computeBizTestsResult();
  const test = bizTestsById(state.bizTestsType);
  state.bizTestsResult = result;
  // История хранит итог, а не сырые ответы: после партии нужен результат, а
  // список всех вопросов занимал бы место ради данных, которые никто больше
  // не читает. «Сбросить прогресс» чистит и её.
  if(!Array.isArray(state.bizTestsHistory)) state.bizTestsHistory = [];
  state.bizTestsHistory.unshift({
    date: Date.now(),
    testId: state.bizTestsType,
    testName: test ? test.name : 'Тест',
    result,
  });
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  renderBizTestsSummary();
  document.getElementById('bizTestsGame').classList.remove('active');
  document.getElementById('bizTestsSummary').classList.add('active');
}
// Содержимое результата в одном месте: им заполняются и экран итогов, и
// раскрытая запись в «Пройденных». Дублировать разметку в двух местах было бы
// верным способом со временем получить разные тексты на этих экранах.
function bizTestsResultBodyHtml(result, typeIcon, typeTitle, stat){
  const profilesHtml = bizTestsProfileHtml(result.profiles);
  return `
    <div class="biz-test-type">${typeIcon} ${typeTitle}</div>
    <div class="biz-test-verdict">${result.text || ''}</div>
    ${stat || ''}
    ${result.plus ? `<div class="biz-test-plus"><b>Сильные стороны</b>${result.plus}</div>` : ''}
    ${result.minus ? `<div class="biz-test-minus"><b>Возможные трудности</b>${result.minus}</div>` : ''}
    ${result.tip ? `<div class="biz-test-tip"><b>Что попробовать</b>${result.tip}</div>` : ''}
    ${profilesHtml}
  `;
}
// Блок «профиль по шкалам» для mode:'profile'. Показывается и на экране
// итогов, и в раскрытой записи «Пройденных» — одной функцией, иначе эти два
// экрана разъедутся по тексту.
function bizTestsProfileHtml(profiles){
  if(!Array.isArray(profiles) || !profiles.length) return '';
  return `
    <div class="biz-test-profiles">
      <div class="biz-test-profiles-head">Ваш профиль по шкалам</div>
      ${profiles.map(p=>`
        <div class="biz-test-profile">
          <div class="biz-test-profile-head">
            <span class="biz-test-profile-name">${p.icon || ''} ${p.name}</span>
            <span class="biz-test-profile-sum">${p.sum} из ${p.count * 3}</span>
          </div>
          <div class="biz-test-profile-level">${(p.level && p.level.title) || ''}</div>
          ${p.level && p.level.text ? `<div class="biz-test-profile-text">${p.level.text}</div>` : ''}
          ${p.level && p.level.plus ? `<div class="biz-test-profile-row"><b>Сильная сторона</b>${p.level.plus}</div>` : ''}
          ${p.level && p.level.minus ? `<div class="biz-test-profile-row"><b>На что обратить внимание</b>${p.level.minus}</div>` : ''}
          ${p.level && p.level.tip ? `<div class="biz-test-profile-row"><b>Можно попробовать</b>${p.level.tip}</div>` : ''}
        </div>
      `).join('')}
    </div>`;
}
// Счётчик для результата: в «types»-тестах — сколько ответов легло на выбранный
// тип, в «scale»-тестах — сумма баллов по шкале. Вынесено отдельно, потому что
// нужно и в итогах, и в раскрытой записи истории.
function bizTestsResultStat(result){
  if(typeof result.count === 'number' && typeof result.total === 'number'){
    return `<div class="biz-test-stat">Ответов за этот тип: ${result.count} из ${result.total}`
      + (typeof result.max === 'number' ? ` · чаще всего — ${result.max}` : '') + '</div>';
  }
  if(typeof result.sum === 'number' && typeof result.total === 'number'){
    return `<div class="biz-test-stat">Сумма баллов: ${result.sum} · вопросов: ${result.total}</div>`;
  }
  return '';
}
function renderBizTestsSummary(){
  const test = bizTestsById(state.bizTestsType);
  const result = state.bizTestsResult || {};
  const title = document.getElementById('bizTestsSummaryTitle');
  if(title) title.textContent = `${test ? test.icon : '🏢'} ${test ? test.name : 'Тест'}`;
  const list = document.getElementById('bizTestsSummaryList');
  if(!list) return;
  const typeIcon = result.icon || (test ? test.icon : '🏢');
  const typeTitle = result.title || 'Результат не определён';
  // У профильных тестов (Big Five, эмоциональный интеллект в бизнесе) верхний
  // блок — это описание темы целиком, а не тип: «победителя» там нет. Счётчик
  // голосов не выводим — за один тип голоса здесь не считаются.
  const isProfile = Array.isArray(result.profiles) && result.profiles.length > 0;
  const stat = isProfile ? '' : bizTestsResultStat(result);
  list.innerHTML = bizTestsResultBodyHtml(result, typeIcon, typeTitle, stat);
  const note = document.getElementById('bizTestsSummaryNote');
  if(note) note.textContent = 'Результат сохранён в «Пройденные» — его можно открыть позже.';
}
// Выход с итогов — в настройки игры (не в общий хаб), тем же путём, что и
// «Выход» с настроек: гасятся все активные экраны, запоминается точка входа.
function exitBizTestsSummary(){
  goToBizTestsSetup();
  state.inProgress = false;
  state.pausedMode = null;
  state.bizTestsPaused = null;
  saveState();
  updateResumeUI();
}
document.getElementById('bizTestsSummaryExitBtn').addEventListener('click', ()=>{ exitBizTestsSummary(); });

/* ============ ПАУЗА, ВОЗОБНОВЛЕНИЕ, ЗАВЕРШЕНИЕ ============ */
// «Закончить игру» в меню паузы: тест бросается без сохранения результата.
// Того же ждёт вызов из общего кода, если пауза открылась из чужой игры.
function finishPausedBizTestsGame(){
  hideModal('pauseMenuModal');
  stopAllSounds();
  stopBizTestsSpeech();
  cancelBizTestsAdvance();
  state.inProgress = false;
  state.pausedMode = null;
  state.bizTestsPaused = null;
  goToBizTestsSetup();
  saveState();
  updateResumeUI();
  showToast('Тест прерван — пройдите его заново');
}
// Пауза: запоминаем, на каком месте остановились, и отдаём экран хабу —
// общее меню паузы само покажется из updateResumeUI() по state.pausedMode.
// Отложенный переход к следующему вопросу при этом отменяется: он не должен
// сработать в фоне, пока открыт хаб.
function pauseBizTestsGame(){
  if(typeof stopAllSounds === 'function') stopAllSounds();
  stopBizTestsSpeech();
  cancelBizTestsAdvance();
  state.pausedMode = 'bizTests';
  state.lastSectionOnPause = 'businessView';
  state.bizTestsPaused = { index: state.bizTestsIndex || 0 };
  saveState();
  document.getElementById('bizTestsGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('businessView');
  updateResumeUI();
}
// Продолжение. Ключевая тонкость: пауза может попасть в 450 мс между выбором
// ответа и показом следующего вопроса. Ответ к этому моменту УЖЕ записан,
// поэтому первый непройденный вопрос — с номером answers.length. Раньше здесь
// стоял отдельный вызов advanceBizTests() для этого случая, и индекс
// сдвигался дважды: ответ, выбранный прямо перед паузой, закрывал сразу два
// вопроса, и один вопрос молча пропадал. Теперь достаточно взять максимум из
// снимка и числа записанных ответов — он покрывает оба случая паузы.
function resumeBizTestsGame(){
  state.pausedMode = null;
  const d = state.bizTestsPaused || {};
  state.bizTestsPaused = null;
  const answers = Array.isArray(state.bizTestsAnswers) ? state.bizTestsAnswers : [];
  const from = typeof d.index === 'number' ? d.index : (state.bizTestsIndex || 0);
  state.bizTestsIndex = Math.max(from, answers.length);
  saveState();
  updateResumeUI();
  goToGame(null, 'bizTestsGame');
  updateMuteBtn();
  requestWakeLock();
  showBizTestsQuestion();
}

/* ============ ОЗВУЧКА ВОПРОСА ============ */
function pickBizTestsVoice(){
  if(!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const ru = voices.filter(v=>/^ru/i.test(v.lang));
  const pool = ru.length ? ru : voices;
  const female = pool.find(v=>/female|женск|milena|olga|katya/i.test(v.name));
  return female || pool[0] || null;
}
function stopBizTestsSpeech(){
  stopSpeech('bizTestsTtsHint');
}
let bizTestsSpeechTimerId = null;
function speakBizTestsCard(test){
  const t = test || bizTestsById(state.bizTestsType);
  const item = bizTestsItems()[state.bizTestsIndex];
  if(!item || !t || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  const text = [item.q, ...(Array.isArray(item.a) ? item.a : [])].join('. ');
  const utter = new SpeechSynthesisUtterance(stripQuotesForSpeech(text));
  utter.lang = 'ru-RU';
  utter.rate = 0.95;
  const voice = pickBizTestsVoice();
  if(voice) utter.voice = voice;
  const hint = document.getElementById('bizTestsTtsHint');
  const fire = ()=>{
    bizTestsSpeechTimerId = null;
    // Вопрос уже сменился — не озвучиваем устаревший текст.
    if(bizTestsItems()[state.bizTestsIndex] !== item) return;
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
    bizTestsSpeechTimerId = setTimeout(fire, 50);
  } else {
    fire();
  }
}

/* ============ ПРОЙДЕННЫЕ (ИСТОРИЯ) ============ */
function formatBizTestsDate(ts){
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${pad(d.getFullYear())}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function bizTestsHistoryShortText(entry){
  const r = (entry && entry.result) || {};
  if(r.title && r.icon) return `${r.icon} ${r.title}`;
  return r.title || '';
}
// Раскрытые записи «Пройденных». Хранятся по ключу «дата:id теста», а не по
// индексу: индексы сдвигаются при удалении записи крестиком, и раскрытая
// строка съезжала бы на соседнюю. Это тот же приём, что у групп карты тела
// в «Узнай больше» (state.knowMoreOpen).
function bizTestsOpenEntries(){
  return Array.isArray(state.bizTestsOpen) ? state.bizTestsOpen : [];
}
function bizTestsEntryKey(entry){
  return `${(entry && entry.date) || 0}:${(entry && entry.testId) || ''}`;
}
function isBizTestsEntryOpen(entry){
  return bizTestsOpenEntries().indexOf(bizTestsEntryKey(entry)) >= 0;
}
// Раскрывает/сворачивает запись и возвращает новое состояние: true — раскрыта.
function toggleBizTestsEntry(entry){
  const open = bizTestsOpenEntries();
  const key = bizTestsEntryKey(entry);
  const at = open.indexOf(key);
  if(at >= 0){
    open.splice(at, 1);
    state.bizTestsOpen = open;
    saveState();
    return false;
  }
  open.push(key);
  state.bizTestsOpen = open;
  saveState();
  return true;
}
// Полное содержимое сохранённого результата: тот же блок, что на экране итогов.
// Раньше в списке была только строка с названием типа, и по ней нельзя было
// понять, что тип значит, — теперь результат раскрывается по нажатию.
function bizTestsEntryBodyHtml(entry){
  const r = (entry && entry.result) || {};
  const test = bizTestsById((entry && entry.testId) || '');
  const typeIcon = r.icon || (test ? test.icon : '\U0001f9ea');
  const typeTitle = r.title || 'Результат не определён';
  return bizTestsResultBodyHtml(r, typeIcon, typeTitle, bizTestsResultStat(r));
}
function goToBizTestsHistory(){
  const wrap = document.getElementById('bizTestsHistoryList');
  if(!wrap) return;
  const history = state.bizTestsHistory || [];
  if(history.length === 0){
    wrap.innerHTML = '<div class="card-text">Пока нет пройденных тестов — пройдите хотя бы один.</div>';
  } else {
    wrap.innerHTML = history.map((entry, idx)=>{
      const open = isBizTestsEntryOpen(entry);
      return `
      <div class="biz-test-history-entry${open ? ' open' : ''}">
        <button type="button" class="biz-test-history-head" data-idx="${idx}" aria-expanded="${open}">
          <span class="biz-test-history-date">${formatBizTestsDate(entry.date)} · ${entry.testName || 'Тест'}</span>
          <span class="biz-test-history-text">${bizTestsHistoryShortText(entry)}</span>
          <span class="biz-test-history-hint">${open ? 'Свернуть' : 'Что это значит'}</span>
        </button>
        <div class="biz-test-history-body">${bizTestsEntryBodyHtml(entry)}</div>
        <button type="button" class="biz-test-history-del" data-idx="${idx}" aria-label="Удалить результат из пройденных">✕</button>
      </div>`;
    }).join('');
  }
  document.getElementById('bizTestsSetup').classList.remove('active');
  document.getElementById('bizTestsHistory').classList.add('active');
}
document.getElementById('bizTestsHistoryList').addEventListener('click', (e)=>{
  // Крестик удаления — раньше по нему и только по нему и открывался этот
  // список, поэтому порядок веток важен: удаление не должно ещё и раскрывать
  // запись, а нажатие на заголовок — не удалять её.
  const del = e.target.closest('.biz-test-history-del');
  if(del){
    playErrorSound();
    state.bizTestsHistory.splice(parseInt(del.dataset.idx, 10), 1);
    saveState();
    goToBizTestsHistory();
    return;
  }
  const head = e.target.closest('.biz-test-history-head');
  if(!head) return;
  const entry = (state.bizTestsHistory || [])[parseInt(head.dataset.idx, 10)];
  if(!entry) return;
  toggleBizTestsEntry(entry);
  playSuccessSound();
  goToBizTestsHistory();
});
function exitBizTestsHistory(){
  goToBizTestsSetup();
}
document.getElementById('bizTestsHistoryBtn').addEventListener('click', ()=>{ goToBizTestsHistory(); });
document.getElementById('bizTestsHistoryExitBtn').addEventListener('click', ()=>{ exitBizTestsHistory(); });
