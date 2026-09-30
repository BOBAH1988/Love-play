// games/iq-test.js — игра «Тест IQ» (обучающие игры, для одного человека).
// Загружается через <script src="games/iq-test.js"></script> в index.html,
// данные — cards/cards_iq_test.js (IQ_AREAS, IQ_LEVELS, IQ_ITEMS).
//
// МЕХАНИКА
// Как у остальных тестовых игр: карточка с вопросом и вариантами ответа,
// прогресс, «Пройденные» с раскрытием результата, меню паузы с продолжением
// с того же места. Отличие одно: ТЕСТ ОДИН, без выбора темы на экране
// настройки, и вместо «какой тип выбрали чаще» считается ПРОФИЛЬ по пяти
// направлениям.
//
// ЧТО ЭТО НЕ ЯВЛЯЕТСЯ — ВАЖНО, И ЭТО СКАЗАНО ИГРОКУ
// Настоящий тест интеллекта (WAIS, Stanford-Binet и аналоги) — это
// стандартизированная методика: референсная группа, нормы, поправки на возраст,
// проверка надёжности. Здесь ничего этого нет. Поэтому игра **не притворяется,
// что считает IQ**: ни числа IQ, ни «уровня интеллекта», ни выводов про
// наследственность или «эффект Флинга» здесь нет и быть не может — вопросы
// написаны для приложения, пользователи не измерялись. Вместо этого
// показывается, сколько заданий из тридцати решено верно и как распределены
// баллы по пяти направлениям. Это тренажёр и повод потренироваться, а не
// диагноз. Та же оговорка стоит в правилах, в README и в шапке данных.
//
// ОФОРМЛЕНИЕ
// Карточка включается в общий блок обучающих игр в styles/app.css (сине-серая
// подложка с тёмным текстом) — как у «Флагов», «Столиц» и «Арифметики».
// Собственных цветов игра не вводит, иначе она выбьется из раздела.
//
// ПАУЗА
// Полноценная (в реестре games/game-registry.js): 30 вопросов — бросать на
// середине обидно. Снимок iqTestPaused хранит номер вопроса и сверяется при
// возврате с числом записанных ответов, иначе пауза в паузе между ответом и
// следующим вопросом пропускала бы вопрос.

/* ============ ДАННЫЕ ТЕСТА ============ */
// Направления, уровни и вопросы приходят из файла данных. Если файл не
// загрузился, игра должна показать понятное сообщение, а не упасть.
function iqTestAreas(){
  return (typeof IQ_AREAS !== 'undefined' && Array.isArray(IQ_AREAS)) ? IQ_AREAS : [];
}
function iqTestLevels(){
  return (typeof IQ_LEVELS !== 'undefined' && Array.isArray(IQ_LEVELS)) ? IQ_LEVELS : [];
}
function iqTestItems(){
  return (typeof IQ_ITEMS !== 'undefined' && Array.isArray(IQ_ITEMS)) ? IQ_ITEMS : [];
}
function goToIqTestSetup(){
  goToGameSetup('iqTestSetup', null, ()=>{
    renderIqTestSecondsGroup();
  });
}
/* ============ ВЫБОР ВРЕМЕНИ НА ЗАДАНИЕ ============ */
const IQ_TEST_SECONDS_CHOICES = [30, 45, 60, 90];
function renderIqTestSecondsGroup(){
  // Старое сохранение без этого поля (или с нулем) приводим к минуте: иначе
  // ни одна кнопка не окажется отмеченной и выбор выглядел бы несработавшим.
  if(!IQ_TEST_SECONDS_CHOICES.includes(state.iqTestSeconds)){
    state.iqTestSeconds = 60;
    saveState();
  }
  document.querySelectorAll('#iqTestSecondsGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === iqTestSeconds());
  });
}
document.querySelectorAll('#iqTestSecondsGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const v = parseInt(btn.dataset.value, 10);
    if(!IQ_TEST_SECONDS_CHOICES.includes(v)) return;
    state.iqTestSeconds = v;
    saveState();
    renderIqTestSecondsGroup();
    playSuccessSound();
  });
});

/* ============ ЭКРАН НАСТРОЙКИ ============ */
// Выбора темы здесь нет: игра одна, и тест в ней один — 30 вопросов. На
// экране только «Начать», «Пройденные» и «Выход», как у «Арифметики» и
// «Столиц», где настройки сводятся к паре кнопок.
// Выход с экрана настроек — прямо в хаб, раздел «Обучающие игры». Так же,
// как в остальных тестовых играх: через exitGame() откат активировал бы
// запомненную точку входа, то есть сам экран настроек, и стрелка выглядела бы
// мёртвой. Связанные флаги inProgress и pausedMode снимаются вместе.
function exitIqTestSetup(){
  state.inProgress = false;
  state.pausedMode = null;
  state.lastSectionOnPause = null;
  saveState();
  const pauseModal = document.getElementById('pauseMenuModal');
  if(pauseModal) pauseModal.classList.remove('show');
  document.querySelectorAll('.screen.active').forEach(el=>el.classList.remove('active'));
  const setup = document.getElementById('setup');
  if(setup) setup.classList.add('active');
  showSetupView('learningView');
  if(typeof updateResumeUI === 'function') updateResumeUI();
  window.scrollTo(0, 0);
}
document.getElementById('iqTestSetupExitBtn').addEventListener('click', ()=>{ exitIqTestSetup(); });
// Кнопки «Правила» в самой игре нет: правила открываются из общего хаба
// «Правила игр» в меню, как у всех остальных игр. setupRulesModal вешает
// закрытие по крестику и по фону.
setupRulesModal('iqTestRulesModal', 'closeIqTestRulesBtn');

/* ============ ПАРТИЯ ============ */
let iqTestAdvanceTimerId = null; // отложенный переход к следующему вопросу
let iqTestCurrentOptions = [];   // варианты текущего вопроса в порядке показа
let iqTestAnswered = false;      // ответ на текущем вопросу уже выбран
// Порядок вопросов в ЭТОЙ партии. Хранится в state, а не строится заново:
// иначе после паузы вопросы переехали бы местами, и отвеченный вопрос мог бы
// показаться снова — а вместе с ним и прежний ответ.
let iqTestOrder = [];
function cancelIqTestAdvance(){
  if(iqTestAdvanceTimerId){ clearTimeout(iqTestAdvanceTimerId); iqTestAdvanceTimerId = null; }
}
/* ============ ТАЙМЕР НА ЗАДАНИЕ ============ */
// В настоящем тесте на решение каждого задания дают время, иначе результат
// зависит не от способностей, а от того, успел ли человек. Здесь то же: на
// экранe настройки выбирается время на задание, в игре идёт обратный отсчёт,
// и если время вышло, задание засчитывается как НЕВЕРНОЕ — и это показывается
// подсветкой верного варианта, а не просто пропуском. Пропуск без пометки был
// бы мягче, но обесценил бы весь таймер: одно и то же время на «успел» и на
// «продумал» дало бы разный вклад в балл.
//
// Таймер ставится на КАЖДОЕ задание заново, а не на всю партию: в реальном
// тесте это разные вещи, и суммарное время плохо объясняет результат.
let iqTestTickTimerId = null;   // интервал обновления полоски
let iqTestDeadline = 0;        // абсолютное время окончания задания, мс
let iqTestTimedOut = false;    // текущее задание уже истекло по времени
// Секунд на задание. 0 — без ограничения (так тоже можно, но это уже не
// тест, а разминка, поэтому в настройках такого варианта нет).
function iqTestSeconds(){
  return typeof state.iqTestSeconds === 'number' && state.iqTestSeconds > 0 ? state.iqTestSeconds : 0;
}
function stopIqTestTimer(){
  if(iqTestTickTimerId){ clearInterval(iqTestTickTimerId); iqTestTickTimerId = null; }
  iqTestDeadline = 0;
  iqTestTimedOut = false;
  const track = document.getElementById('iqTestTimerTrack');
  if(track) track.style.display = 'none';
}
function startIqTestTimer(){
  stopIqTestTimer();
  const total = iqTestSeconds();
  if(!total) return;
  iqTestDeadline = Date.now() + total * 1000;
  iqTestTimedOut = false;
  const track = document.getElementById('iqTestTimerTrack');
  if(track) track.style.display = '';
  iqTestTick();
  iqTestTickTimerId = setInterval(iqTestTick, 200);
}
function iqTestTick(){
  const total = iqTestSeconds();
  if(!total || !iqTestDeadline) return;
  const left = Math.max(0, iqTestDeadline - Date.now());
  const fill = document.getElementById('iqTestTimerFill');
  if(fill) fill.style.width = Math.round(left / (total * 1000) * 100) + '%';
  // Под конец времени полоска краснеет: об исходящем времени человек должен
  // узнавать по часам, а не по факту.
  const track = document.getElementById('iqTestTimerTrack');
  if(track) track.classList.toggle('low', left <= Math.min(10000, total * 250));
  if(left <= 0) iqTestTimeUp();
}
// Время вышло: помечаем задание неверным и идём дальше. Повторный вызов из
// интервала невозможен — iqTestTimedOut и остановка интервала это закрывают.
function iqTestTimeUp(){
  if(iqTestTimedOut) return;
  iqTestTimedOut = true;
  stopIqTestTimer();
  showToast('⏰ Время вышло — ответ не засчитан');
  // Ответ пишется обычным путём: защита от двойного клика не даст записать
  // второй ответ, если игрок успел нажать на кнопку в ту же секунду.
  const n = iqTestCurrentItem();
  if(!n) return;
  iqTestAnswered = true;
  if((state.iqTestAnswers || []).length <= (state.iqTestIndex || 0)){
    if(!Array.isArray(state.iqTestAnswers)) state.iqTestAnswers = [];
    state.iqTestAnswers.push(0);
  }
  saveState();
  document.querySelectorAll('#iqTestCard .znayu-answer-btn').forEach((btn, i)=>{
    btn.disabled = true;
    if(iqTestCurrentOptions[i] && iqTestCurrentOptions[i].ok) btn.classList.add('answer-correct');
  });
  playFailSound();
  iqTestAdvanceTimerId = setTimeout(advanceIqTest, 900);
}
function startIqTestGame(){
  if(!iqTestItems().length || !iqTestAreas().length){
    showToast('Не удалось загрузить задания — обновите приложение');
    return;
  }
  cancelIqTestAdvance();
  // Сбрасываем чужие партии: тест личный, чужая пауза тут неуместна.
  abandonPausedSession('fanty');
  abandonPausedSession('compatTest');
  state.iqTestIndex = 0;
  // Порядок этой партии — не перемешивание всех 120, а ВЫБОРКА: по 6
  // заданий из каждого направления. Перемешивание давало бы 30 заданий подряд
  // наугад, и тогда в одном прохождении могло оказаться 2 задания на числа, а
  // в следующем — 10, и профили разных прохождений стало бы нельзя сравнивать.
  // Здесь у каждого направления ровно шесть, поэтому «6 из 6» значит одно и
  // то же всегда. Повторные прохождения при этом разные: внутри направления
  // берутся случайные шесть из двадцати четырёх.
  state.iqTestOrder = iqTestSampleOrder();
  // Ответы: по 1 или 0 на задание (верно/неверно), в порядке этой партии.
  state.iqTestAnswers = [];
  state.iqTestStartedAt = Date.now();
  state.iqTestResult = null;
  goToGame(null, 'iqTestGame');
  updateMuteBtn();
  requestWakeLock();
  showIqTestQuestion();
}
// Порядок из сохранённой партии, а при его отсутствии — исходный (после
// перезагрузки страницы посреди теста порядок уже не восстановить, и лучше
// показать вопросы подряд, чем перемешать повторно и сбить нумерацию).
// Сколько заданий берётся из одного направления и сколько всего в партии.
// Держим в одном месте: от этих чисел зависят и выборка, и подсчёт профиля.
function iqTestPerArea(){
  return 6;
}
function iqTestPerGame(){
  return iqTestPerArea() * iqTestAreas().length;
}
// Случайная выборка: по iqTestPerArea() заданий из каждого направления.
// Направлений, из которых не хватает заданий, не будет — банк по 24 на
// направление, а нужно 6, — но проверка остаётся: если данные окажутся
// короче, партия просто возьмёт меньше и профиль покажет реальные цифры.
function iqTestSampleOrder(){
  const items = iqTestItems();
  const per = iqTestPerArea();
  const picked = [];
  iqTestAreas().forEach(area=>{
    const pool = [];
    items.forEach((item, i)=>{ if(item && item.area === area.key) pool.push(i); });
    // Важно: shuffle НЕ мутирует массив, а возвращает копию. Если брать
    // pool.slice(0, per) из исходного массива, получаются всегда одни и те же
    // шесть заданий — выборка перестаёт быть случайной и второй результат
    // не отличается от первого. Брать надо из перемешанной копии.
    const mixed = typeof shuffle === 'function' ? shuffle(pool) : pool.slice();
    mixed.slice(0, per).forEach(i=>picked.push(i));
  });
  // Перемешиваем и сам порядок выбранных: иначе пять направлений шли бы
  // блоками по шесть заданий, и по позиции можно было бы угадать направление.
  return typeof shuffle === 'function' ? shuffle(picked) : picked;
}
// За ПРЕДЕЛАМИ списка возвращает null, а не заворачивает индекс по модулю:
// при index === длина вопросов первый вопрос показался бы снова, и тест
// зациклился бы вместо перехода к итогам. Именно на этом ловится партия,
// дошедшая до конца.
function iqTestCurrentItem(){
  const order = Array.isArray(state.iqTestOrder) ? state.iqTestOrder : [];
  const items = iqTestItems();
  if(!items.length || !order.length) return null;
  const index = state.iqTestIndex || 0;
  // За ПРЕДЕЛАМИ выборки возвращаем null, а не заворачиваем индекс по модулю:
  // на последнем шаге показался бы первый вопрос, и партия зациклилась бы
  // вместо перехода к итогам.
  if(index < 0 || index >= order.length) return null;
  return items[order[index]] || null;
}

function updateIqTestProgress(){
  // Размер партии (30), а не банка (120): игрок проходит 30 заданий, и
  // «12 / 120» сбивало бы с толку.
  const total = iqTestPerGame();
  const done = Math.min(state.iqTestIndex || 0, total);
  const fill = document.getElementById('iqTestProgressFill');
  if(fill) fill.style.width = (total > 0 ? Math.round((done / total) * 100) : 0) + '%';
  const label = document.getElementById('iqTestProgressLabel');
  if(label) label.textContent = `${done} / ${total}`;
}

function showIqTestQuestion(){
  const item = iqTestCurrentItem();
  if(!item || !Array.isArray(item.a) || !item.a.length){
    finishIqTestGame();
    return;
  }
  iqTestAnswered = false;
  // Варианты перемешиваются: в данных порядок канонический, и без
  // перемешивания по позиции кнопки можно было бы угадать ответ.
  iqTestCurrentOptions = item.a.map((o, i)=>({ text: o.t, ok: !!o.ok, i }));
  if(typeof shuffle === 'function') iqTestCurrentOptions = shuffle(iqTestCurrentOptions);
  const answersHtml = iqTestCurrentOptions
    .map((o, pos)=>`<button type="button" class="btn btn-secondary znayu-answer-btn" data-pos="${pos}">${o.text}</button>`).join('');
  fadeSwapEl('iqTestCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="znayu-question-text">${item.q}</div></div>`
      + `<div class="znayu-answers">${answersHtml}</div><div class="quiz-tts-hint" id="iqTestTtsHint">🔊</div></div>`;
    el.querySelectorAll('.znayu-answer-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{ answerIqTestQuestion(parseInt(btn.dataset.pos, 10)); });
    });
  });
  updateIqTestProgress();
  // Таймер запускается на каждое задание заново, после отрисовки карточки.
  startIqTestTimer();
  if(state.autoSpeak) speakIqTestCard(item);
}
// Пропуска нет: у каждого задания есть варианты ответа, «время вышло» не
// предусмотрено — отвечать нужно осознанно.
function answerIqTestQuestion(pos){
  if(iqTestAnswered) return;
  const option = iqTestCurrentOptions[pos];
  if(!option) return;
  iqTestAnswered = true;
  stopIqTestSpeech();
  stopIqTestTimer();
  // Защита от повторного клика по той же карточке: записанных ответов должно
  // быть ровно столько же, сколько номер текущего вопроса. Иначе второй клик
  // дописывал бы лишний ответ и сдвигал подсчёт.
  if((state.iqTestAnswers || []).length > (state.iqTestIndex || 0)) return;
  if(!Array.isArray(state.iqTestAnswers)) state.iqTestAnswers = [];
  // 1 — верно, 0 — неверно. Сам выбранный вариант не сохраняем: для разбора
  // хватает верности, а вопросы на диск не попадают.
  state.iqTestAnswers.push(option.ok ? 1 : 0);
  // Ошибку подсвечиваем честно: неверный ответ виден сразу, иначе непонятно,
  // что было не так. Верный при ошибке тоже подсвечиваем.
  document.querySelectorAll('#iqTestCard .znayu-answer-btn').forEach((btn, i)=>{
    btn.disabled = true;
    if(iqTestCurrentOptions[i] && iqTestCurrentOptions[i].ok) btn.classList.add('answer-correct');
    else if(i === pos) btn.classList.add('answer-wrong');
  });
  if(option.ok) playSuccessSound(); else playFailSound();
  saveState();
  iqTestAdvanceTimerId = setTimeout(advanceIqTest, 650);
}
function advanceIqTest(){
  iqTestAdvanceTimerId = null;
  state.iqTestIndex = (state.iqTestIndex || 0) + 1;
  saveState();
  showIqTestQuestion();
}
document.getElementById('iqTestCard').addEventListener('click', (e)=>{
  if(e.target.closest('.znayu-answer-btn')) return;
  if(iqTestAnswered) return;
  if(!state.autoSpeak) return;
  if(!iqTestCurrentItem()) return;
  speakIqTestCard(iqTestCurrentItem());
});
document.getElementById('iqTestStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  startIqTestGame();
});

/* ============ РАСЧЁТ РЕЗУЛЬТАТА ============ */
// Итог — профиль по направлениям, а не «число IQ». По каждому направлению
// считаем, сколько заданий из его шести решено верно, и по сумме выбираем
// уровень. Уровни в данных идут по убыванию, поэтому берём ПЕРВЫЙ, у которого
// min ≤ суммы: при сумме 30 подходит верхний уровень, при 0 — нижний.
function computeIqTestResult(){
  const answers = Array.isArray(state.iqTestAnswers) ? state.iqTestAnswers : [];
  const total = answers.length;
  const score = answers.reduce((acc, v)=> acc + (v === 1 ? 1 : 0), 0);
  // Ответы идут в порядке партии, а задания — по индексам в банке, поэтому
  // ответ на задание bankIdx лежит на позиции pos в выборке.
  const order = Array.isArray(state.iqTestOrder) && state.iqTestOrder.length
    ? state.iqTestOrder
    : iqTestItems().map((_, i)=>i);
  const areas = iqTestAreas().map(area=>{
    let got = 0, asked = 0;
    order.forEach((bankIdx, pos)=>{
      const item = iqTestItems()[bankIdx];
      if(!item || item.area !== area.key) return;
      if(pos >= answers.length) return;
      asked++;
      if(answers[pos] === 1) got++;
    });
    return { key: area.key, name: area.name, icon: area.icon, text: area.text, got, asked };
  });
  const levels = iqTestLevels();
  const level = levels.find(l => score >= (typeof l.min === 'number' ? l.min : 0)) || levels[levels.length - 1] || {};
  return { ...level, score, total, max: iqTestPerGame(), areas };
}

/* ============ ИТОГИ И СОХРАНЕНИЕ ============ */
function finishIqTestGame(){
  cancelIqTestAdvance();
  stopIqTestTimer();
  stopIqTestSpeech();
  const result = computeIqTestResult();
  state.iqTestResult = result;
  // История хранит итог, а не сырые ответы: после партии нужен результат, а
  // список всех вопросов занимал бы место ради данных, которые никто больше
  // не читает. «Сбросить прогресс» чистит и её.
  if(!Array.isArray(state.iqTestHistory)) state.iqTestHistory = [];
  // Дата, время и сколько заняло прохождение. «Сколько заняло» считается по
  // времени старта партии, а не по сумме таймеров: игрок мог взять паузу, и
  // сумма была бы меньше реально проведённого времени.
  const finished = Date.now();
  const started = state.iqTestStartedAt || finished;
  state.iqTestHistory.unshift({
    date: finished,
    spentMs: Math.max(0, finished - started),
    result,
  });
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  renderIqTestSummary();
  document.getElementById('iqTestGame').classList.remove('active');
  document.getElementById('iqTestSummary').classList.add('active');
}
// Содержимое результата в одном месте: им заполняются и экран итогов, и
// раскрытая запись в «Пройденных». Дублировать разметку в двух местах —
// верный способ со временем получить разные тексты на этих экранах.
function iqTestResultBodyHtml(result){
  const areas = Array.isArray(result.areas) ? result.areas : [];
  return `
    <div class="iq-test-type">🧠 ${result.title || 'Результат'}</div>
    <div class="iq-test-score">${result.score} из ${result.max || result.total || 0}</div>
    <div class="iq-test-verdict">${result.text || ''}</div>
    ${result.advice ? `<div class="iq-test-tip"><b>Что делать дальше</b>${result.advice}</div>` : ''}
    ${areas.length ? `
      <div class="iq-test-areas">
        <div class="iq-test-areas-head">По направлениям</div>
        ${areas.map(a=>`
          <div class="iq-test-area">
            <div class="iq-test-area-head">
              <span class="iq-test-area-name">${a.icon || ''} ${a.name}</span>
              <span class="iq-test-area-score">${a.got} из ${a.asked}</span>
            </div>
            <div class="iq-test-area-bar"><span style="width:${a.asked ? Math.round(a.got / a.asked * 100) : 0}%"></span></div>
            <div class="iq-test-area-text">${a.text || ''}</div>
          </div>
        `).join('')}
      </div>` : ''}
    <div class="iq-test-disclaimer">Это тренировочный тест, а не измерение интеллекта. У него нет референсной группы и норм, поэтому число IQ по нему не считается и не может считаться: настоящий тест интеллекта — стандартизированная методика с проверенными нормами. Здесь видно только, сколько заданий из тридцати вы решили и в каких направлениях.</div>
  `;
}
function renderIqTestSummary(){
  const result = state.iqTestResult || {};
  const title = document.getElementById('iqTestSummaryTitle');
  if(title) title.textContent = '🧠 Тест IQ';
  const list = document.getElementById('iqTestSummaryList');
  if(!list) return;
  list.innerHTML = iqTestResultBodyHtml(result);
  const note = document.getElementById('iqTestSummaryNote');
  if(note) note.textContent = 'Результат сохранён в «Пройденные» — его можно открыть позже.';
}
// Выход с итогов — в настройки игры (не в общий хаб), тем же путём, что и
// «Выход» с настроек: гасятся все активные экраны, запоминается точка входа.
function exitIqTestSummary(){
  goToIqTestSetup();
  state.inProgress = false;
  state.pausedMode = null;
  state.iqTestPaused = null;
  saveState();
  updateResumeUI();
}
document.getElementById('iqTestSummaryExitBtn').addEventListener('click', ()=>{ exitIqTestSummary(); });


/* ============ ПАУЗА, ВОЗОБНОВЛЕНИЕ, ЗАВЕРШЕНИЕ ============ */
// «Закончить игру» в меню паузы: тест бросается без сохранения результата.
// Того же ждёт вызов из общего кода, если пауза открылась из чужой игры.
function finishPausedIqTestGame(){
  hideModal('pauseMenuModal');
  stopAllSounds();
  stopIqTestSpeech();
  stopIqTestTimer();
  cancelIqTestAdvance();
  state.inProgress = false;
  state.pausedMode = null;
  state.iqTestPaused = null;
  goToIqTestSetup();
  saveState();
  updateResumeUI();
  showToast('Тест прерван — пройдите его заново');
}
// Пауза: запоминаем, на каком месте остановились, и отдаём экран хабу —
// общее меню паузы само покажется из updateResumeUI() по state.pausedMode.
// Отложенный переход к следующему вопросу при этом отменяется: он не должен
// сработать в фоне, пока открыт хаб.
function pauseIqTestGame(){
  if(typeof stopAllSounds === 'function') stopAllSounds();
  stopIqTestSpeech();
  // Таймер обязательно гасим: иначе на паузе он продолжал бы идти и время
  // сгорало бы, пока игрок в хабе.
  stopIqTestTimer();
  cancelIqTestAdvance();
  state.pausedMode = 'iqTest';
  state.lastSectionOnPause = 'learningView';
  state.iqTestPaused = { index: state.iqTestIndex || 0 };
  saveState();
  document.getElementById('iqTestGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('learningView');
  updateResumeUI();
}
// Продолжение. Ключевая тонкость: пауза может попасть в 450 мс между выбором
// ответа и показом следующего вопроса. Ответ к этому моменту УЖЕ записан,
// поэтому первый непройденный вопрос — с номером answers.length. Раньше здесь
// стоял отдельный вызов advanceIqTest() для этого случая, и индекс
// сдвигался дважды: ответ, выбранный прямо перед паузой, закрывал сразу два
// вопроса, и один вопрос молча пропадал. Теперь достаточно взять максимум из
// снимка и числа записанных ответов — он покрывает оба случая паузы.
function resumeIqTestGame(){
  state.pausedMode = null;
  const d = state.iqTestPaused || {};
  state.iqTestPaused = null;
  const answers = Array.isArray(state.iqTestAnswers) ? state.iqTestAnswers : [];
  const from = typeof d.index === 'number' ? d.index : (state.iqTestIndex || 0);
  state.iqTestIndex = Math.max(from, answers.length);
  saveState();
  updateResumeUI();
  goToGame(null, 'iqTestGame');
  updateMuteBtn();
  requestWakeLock();
  showIqTestQuestion();
}

/* ============ ОЗВУЧКА ВОПРОСА ============ */
function pickIqTestVoice(){
  if(!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const ru = voices.filter(v=>/^ru/i.test(v.lang));
  const pool = ru.length ? ru : voices;
  const female = pool.find(v=>/female|женск|milena|olga|katya/i.test(v.name));
  return female || pool[0] || null;
}
function stopIqTestSpeech(){
  stopSpeech('iqTestTtsHint');
}
let iqTestSpeechTimerId = null;
function speakIqTestCard(item){
  if(!item || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  // У вариантов ответа свой формат ({t, ok}), а не строки: озвучиваем текст.
  const variants = (Array.isArray(item.a) ? item.a : []).map(a => (a && a.t ? a.t : a));
  const text = [item.q, ...variants].join('. ');
  const utter = new SpeechSynthesisUtterance(stripQuotesForSpeech(text));
  utter.lang = 'ru-RU';
  utter.rate = 0.95;
  const voice = pickIqTestVoice();
  if(voice) utter.voice = voice;
  const hint = document.getElementById('iqTestTtsHint');
  const fire = ()=>{
    iqTestSpeechTimerId = null;
    // Вопрос уже сменился — не озвучиваем устаревший текст.
    if(iqTestCurrentItem() !== item) return;
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
    iqTestSpeechTimerId = setTimeout(fire, 50);
  } else {
    fire();
  }
}

/* ============ ПРОЙДЕННЫЕ (ИСТОРИЯ) ============ */
function formatIqTestDate(ts){
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${pad(d.getFullYear())}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// Короткая строка записи: сколько решено и уровень. Развёрнутый результат
// ниже показывает профиль по направлениям, поэтому в свёрнутом виде достаточно
// итоговой строки.
// Сколько заняло прохождение: «3 мин 12 сек». Для записей, сделанных до
// появления этого поля, spentMs нет — тогда строка просто не показывается,
// чтобы не выводить «0 сек» у старых результатов.
function formatIqTestSpent(ms){
  if(typeof ms !== 'number' || ms <= 0) return '';
  const total = Math.round(ms / 1000);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  if(min && sec) return `${min} мин ${sec} сек`;
  if(min) return `${min} мин`;
  return `${sec} сек`;
}
// Раскрытые записи «Пройденных». Ключ — дата прохождения: индексы сдвигаются
// при удалении записи крестиком, и раскрытая строка съезжала бы на соседнюю. Это тот же приём, что у групп карты тела
// в «Узнай больше» (state.knowMoreOpen).
function iqTestOpenEntries(){
  return Array.isArray(state.iqTestOpen) ? state.iqTestOpen : [];
}
function iqTestEntryKey(entry){
  return String((entry && entry.date) || 0);
}
function isIqTestEntryOpen(entry){
  return iqTestOpenEntries().indexOf(iqTestEntryKey(entry)) >= 0;
}
// Раскрывает/сворачивает запись и возвращает новое состояние: true — раскрыта.
function toggleIqTestEntry(entry){
  const open = iqTestOpenEntries();
  const key = iqTestEntryKey(entry);
  const at = open.indexOf(key);
  if(at >= 0){
    open.splice(at, 1);
    state.iqTestOpen = open;
    saveState();
    return false;
  }
  open.push(key);
  state.iqTestOpen = open;
  saveState();
  return true;
}
// Полное содержимое сохранённого результата: тот же блок, что на экране итогов.
// Раньше в списке была только строка с названием типа, и по ней нельзя было
// понять, что тип значит, — теперь результат раскрывается по нажатию.
function iqTestEntryBodyHtml(entry){
  return iqTestResultBodyHtml((entry && entry.result) || {});
}
function goToIqTestHistory(){
  const wrap = document.getElementById('iqTestHistoryList');
  if(!wrap) return;
  const history = state.iqTestHistory || [];
  if(history.length === 0){
    wrap.innerHTML = '<div class="card-text">Пока нет пройденных тестов — пройдите хотя бы один.</div>';
  } else {
    wrap.innerHTML = history.map((entry, idx)=>{
      const open = isIqTestEntryOpen(entry);
      return `
      <div class="iq-test-history-entry${open ? ' open' : ''}">
        <button type="button" class="iq-test-history-head" data-idx="${idx}" aria-expanded="${open}">
          <span class="iq-test-history-date">${formatIqTestDate(entry.date)} · Тест IQ</span>
          <span class="iq-test-history-score">${typeof (entry.result || {}).score === 'number' ? (entry.result.score + ' из ' + ((entry.result.max) || (entry.result.total) || 0)) : ''}</span>
          <span class="iq-test-history-text">${(entry.result || {}).title || ''}</span>
          ${formatIqTestSpent(entry.spentMs) ? `<span class="iq-test-history-spent">Заняло: ${formatIqTestSpent(entry.spentMs)}</span>` : ''}
          <span class="iq-test-history-hint">${open ? 'Свернуть' : 'Подробнее'}</span>
        </button>
        <div class="iq-test-history-body">${iqTestEntryBodyHtml(entry)}</div>
        <button type="button" class="iq-test-history-del" data-idx="${idx}" aria-label="Удалить результат из пройденных">✕</button>
      </div>`;
    }).join('');
  }
  document.getElementById('iqTestSetup').classList.remove('active');
  document.getElementById('iqTestHistory').classList.add('active');
}
document.getElementById('iqTestHistoryList').addEventListener('click', (e)=>{
  // Крестик удаления — раньше по нему и только по нему и открывался этот
  // список, поэтому порядок веток важен: удаление не должно ещё и раскрывать
  // запись, а нажатие на заголовок — не удалять её.
  const del = e.target.closest('.iq-test-history-del');
  if(del){
    playErrorSound();
    state.iqTestHistory.splice(parseInt(del.dataset.idx, 10), 1);
    saveState();
    goToIqTestHistory();
    return;
  }
  const head = e.target.closest('.iq-test-history-head');
  if(!head) return;
  const entry = (state.iqTestHistory || [])[parseInt(head.dataset.idx, 10)];
  if(!entry) return;
  toggleIqTestEntry(entry);
  playSuccessSound();
  goToIqTestHistory();
});
function exitIqTestHistory(){
  goToIqTestSetup();
}
document.getElementById('iqTestHistoryBtn').addEventListener('click', ()=>{ goToIqTestHistory(); });
document.getElementById('iqTestHistoryExitBtn').addEventListener('click', ()=>{ exitIqTestHistory(); });
