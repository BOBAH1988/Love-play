// games/know-more.js — игра «Узнай больше» (пары 18+).
// Загружается через <script src="games/know-more.js"></script> в index.html,
// данные — cards/cards_know_more.js (KNOW_MORE_ZONES).
//
// СУТЬ. Партнёры по очереди исследуют тела друг друга в поисках приятных
// зон и отмечают в игре, что нравится каждому. Через несколько таких партий
// получается личная «карта тела» партнёра: что приятно, что нейтрально, а
// что лучше не трогать. Работает это так: на экране карточка с зоной и
// подсказкой исследователю («что и как делать руками»); тот, кого исследуют,
// оценивает ощущение по шкале. Оценка записывается в карту ТОГО, кого трогали;
// на следующем ходу исследователь меняется.
//
// ПАРТИЯ. KNOW_MORE_STEPS зон, каждую исследует один из двоих. В режиме
// «По очереди» роли чередуются по ходу — значит, на «Он» и на «Она»
// приходится поровну исследованных зон; в режимах «Он» и «Она» исследует
// только выбранный партнёр. Порядок зон — от нежных (level 1) к смелее
// (level 3), партия набирается ПРОПОРЦИОНАЛЬНО из всех трёх уровней
// (knowMoreLevelQuotas), внутри уровня случайно. Раньше брались первые
// KNOW_MORE_STEPS зон «мешка», где сначала шёл весь level 1: после роста
// колоды до 48 зон партия целиком состояла из первого уровня, и уровни 2–3
// не выпадали никогда. Зона подбирается под того, кто на ходу исследует
// (knowMoreZoneFitsStep): зона принадлежит тому, кого ИССЛЕДУЮТ, а не тому,
// кто исследует. Исследует мужчина — трогает женщину, значит «Её тело»;
// исследует женщина — «Его тело».
//
// ТЕМП. Промежуточных окон между заданиями нет: после оценки сразу
// показывается карточка следующей зоны (а после последней — итоги). Раньше
// здесь было окно «Записали: …» с кнопкой «Дальше»; по решению владельца
// оба убраны, потому что они задерживали партию лишним нажатием.
//
// ОЦЕНКИ. Шкала KNOW_MORE_SCALE: 3 — «Очень приятно», 2 — «Приятно»,
// 1 — «Нейтрально», 0 — «Стоп, лучше не трогать». Отметка «Стоп» — не провал,
// а результат: её честно пишем в карту как «лучше не трогать».
//
// ПАУЗЫ НЕТ (noPause в games/game-registry.js): партия короткая и личная.
// Стрелка «←» и кнопка «Выход» ведут в настройки игры, несохранённая карта
// при этом в историю не пишется.

// Сколько зон в одной партии. Владелец игры меняет это число, когда
// добавит настройку «сколько зон играть» на экран настроек.
const KNOW_MORE_STEPS = 12;

// Шкала оценки ощущения: от «очень приятно» до «лучше не трогать».
const KNOW_MORE_SCALE = [
  { score: 3, text: 'Очень приятно' },
  { score: 2, text: 'Приятно' },
  { score: 1, text: 'Нейтрально' },
  { score: 0, text: 'Стоп — лучше не трогать' },
];

// Защита от двойного тапа по кнопке оценки: между ответом и показом карточки
// следующей зоны флаг закрыт. В state он не нужен — это состояние одного
// экрана, сохранять его в localStorage незачем.
let knowMoreAwaitNext = false;

function getKnowMoreZones(){
  return (typeof KNOW_MORE_ZONES !== 'undefined' && Array.isArray(KNOW_MORE_ZONES)) ? KNOW_MORE_ZONES : [];
}
function knowMorePlayers(){
  return [state.name1 || 'Он', state.name2 || 'Она'];
}
function knowMoreZoneById(id){
  return getKnowMoreZones().find(z => z.id === id) || null;
}
// Чья это зона: у интимных зон есть поле body ('he' / 'she'). Подпись нужна
// и на карточке («Его тело»), и в списках, где зоны идут вперемешку.
function knowMoreZoneOwnerText(zone){
  if(!zone || !zone.body) return '';
  return zone.body === 'he' ? 'Его тело' : 'Её тело';
}
// Название зоны с пометкой чужого тела — для «Исследованных» и итогов.
function knowMoreZoneLabel(zone){
  if(!zone) return '';
  return zone.body ? `${zone.name} (${zone.body === 'he' ? 'Он' : 'Она'})` : zone.name;
}

/* ============ ЭКРАН НАСТРОЙКИ ============ */
function goToKnowMoreSetup(){
  goToGameSetup('knowMoreSetup', 'twoPlayerView', ()=>{ renderKnowMoreStarterGroup(); });
}

// Кто исследует: три режима. Первый в списке — «Он», второй «Она» (исследует
// только этот партнёр), третий «По очереди» (роли меняются по ходу). Порядок
// плашек по решению владельца: оба «одного партнёра» идут рядом, «По очереди»
// в конце. ВАЖНО: порядок НЕ определяет значение по умолчанию — оно задаётся
// константой KNOW_MORE_MODE.ALTERNATE и state.knowMoreMode, поэтому перестановка
// не трогает ни сохранённые настройки, ни поведение партии.
const KNOW_MORE_MODE = { ALTERNATE:0, HE:1, SHE:2 };

// Список режимов для экрана настроек. Под именем «Он»/«Она» показываем имя,
// введённое в хабе (name1/name2).
function knowMoreModeList(){
  const players = knowMorePlayers();
  return [
    { value: KNOW_MORE_MODE.HE, label: 'Он', desc: `${players[0]} исследует` },
    { value: KNOW_MORE_MODE.SHE, label: 'Она', desc: `${players[1]} исследует` },
    { value: KNOW_MORE_MODE.ALTERNATE, label: 'По очереди', desc: 'Исследуете друг друга по очереди' },
  ];
}
// Текущий режим. Значение из старого сохранения может быть любым числом —
// в таком разумно вернуть «По очереди».
function getKnowMoreMode(){
  const mode = Number(state.knowMoreMode);
  return knowMoreModeList().some(m => m.value === mode) ? mode : KNOW_MORE_MODE.ALTERNATE;
}

// Кто исследует настройку. Три плашки — тот же компонент .level-toggle, что у
// «Пройдите теста» и остальных игр.
function renderKnowMoreStarterGroup(){
  const wrap = document.getElementById('knowMoreStarterGroup');
  if(!wrap) return;
  const mode = getKnowMoreMode();
  if(state.knowMoreMode !== mode){
    state.knowMoreMode = mode;
    saveState();
  }
  wrap.innerHTML = '';
  knowMoreModeList().forEach(({ value, label, desc })=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + (mode === value ? ' on' : '');
    div.innerHTML = `<div class="lname">${label}</div><div class="ldesc">${desc}</div><div class="level-check"></div>`;
    div.addEventListener('click', ()=>{
      state.knowMoreMode = value;
      saveState();
      playSuccessSound();
      renderKnowMoreStarterGroup();
    });
    wrap.appendChild(div);
  });
}

// Выход с экрана настроек — прямо в хаб, раздел «Игры для пар 18+».
// Шаблон тот же, что у «Пройдите теста»: гасим экран, включаем #setup и
// открываем нужный раздел. Связанные флаги inProgress и pausedMode снимаем
// вместе (правило из AGENTS.md: забытый inProgress блокирует настройки в хабе).
function exitKnowMoreSetup(){
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
document.getElementById('knowMoreSetupExitBtn').addEventListener('click', ()=>{ exitKnowMoreSetup(); });
setupRulesModal('knowMoreRulesModal', 'closeKnowMoreRulesBtn');

/* ============ ЭКРАН «ИССЛЕДОВАННЫЕ» ============ */
// Список всего, что уже исследовали: накопительный, из всех партий. Отдельная
// кнопка под «Начать», потому что перед новой партией полезно посмотреть, что
// уже попробовали, и не повторяться.
function knowMoreLogScoreText(score){
  const found = KNOW_MORE_SCALE.find(s => s.score === score);
  return found ? found.text : '—';
}
// Удаление отметки из накопительного списка «Исследованные».
//
// Удаляем РОВНО одну запись — по её месту в state.knowMoreLog, а не по паре
// (zoneId + receiver). Одна зона может попасть в список дважды (повторная
// оценка в другой партии), и удаление «по зоне» молча стёрло бы лишнее.
//
// Намеренно НЕ трогаем state.knowMoreHistory (карты завершённых партий, они
// показываются в итогах) и state.knowMoreMarks (отметки текущей партии): это
// чужие экраны со своим смыслом, и стирание из них по нажатию крестика в
// «Исследованных» было бы потерей данных, о которой игрок не просил. Счётчик
// «исследовано зон» в заголовке карточки пересчитывается сам — он читает
// state.knowMoreLog.
function removeKnowMoreLogEntry(index){
  const log = Array.isArray(state.knowMoreLog) ? state.knowMoreLog : [];
  if(!Number.isInteger(index) || index < 0 || index >= log.length) return false;
  log.splice(index, 1);
  saveState();
  return true;
}
function goToKnowMoreHistory(){
  const wrap = document.getElementById('knowMoreHistoryList');
  const log = Array.isArray(state.knowMoreLog) ? state.knowMoreLog : [];
  const players = knowMorePlayers();
  if(!wrap) return;
  if(log.length === 0){
    wrap.innerHTML = '<div class="know-more-empty">Пока ничего не исследовано — начните первую партию.</div>';
  } else {
    // Строки с крестиком: индекс — это место записи В state.knowMoreLog, а не
    // номер строки на экране, поэтому удаление попадает точно в свою отметку
    // даже после того, как список перерисовался.
    const lineHtml = (text, index)=>`<span class="know-more-item">`
      + `<span class="know-more-item-text">${text}</span>`
      + `<button type="button" class="know-more-item-del" data-knowmore-del="${index}" `
      + `aria-label="Удалить: ${text}">✕</button></span>`;
    wrap.innerHTML = players.map((name, idx)=>{
      const rows = [];
      log.forEach((it, i)=>{
        if(it.receiver !== idx) return;
        const zone = knowMoreZoneById(it.zoneId);
        if(!zone) return;
        rows.push(lineHtml(`${knowMoreZoneLabel(zone)} — ${knowMoreLogScoreText(it.score)}`, i));
      });
      return `
        <div class="know-more-map">
          <div class="know-more-map-name">${idx === 0 ? 'Он' : 'Она'} · ${name} — исследовано зон: ${rows.length}</div>
          <div class="know-more-row"><div class="know-more-row-text">${rows.length ? rows.join('') : '—'}</div></div>
        </div>`;
    }).join('');
    wrap.querySelectorAll('[data-knowmore-del]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const idx = parseInt(btn.dataset.knowmoreDel, 10);
        if(!removeKnowMoreLogEntry(idx)) return;
        playSuccessSound();
        goToKnowMoreHistory();
      });
    });
  }
  const setup = document.getElementById('knowMoreSetup');
  const history = document.getElementById('knowMoreHistory');
  if(setup) setup.classList.remove('active');
  if(history) history.classList.add('active');
  window.scrollTo(0, 0);
}
// Назад с экрана — на настройки игры. Отдельная функция нужна для карты
// PARENT_BACK (games/fants-timer.js): по стрелке «←» идёт тот же путь, что и
// по кнопке «Назад», иначе стрелка увела бы в хаб мимо настроек.
function exitKnowMoreHistory(){
  goToKnowMoreSetup();
}
document.getElementById('knowMoreHistoryBtn').addEventListener('click', ()=>{ goToKnowMoreHistory(); });
document.getElementById('knowMoreHistoryExitBtn').addEventListener('click', ()=>{ exitKnowMoreHistory(); });

/* ============ ПАРТИЯ ============
 * Очередь зон: сначала level 1, потом 2, потом 3; внутри одного уровня
 * порядок случайный, чтобы партии не повторялись.
 *
 * Квоты по уровням считаются knowMoreLevelQuotas(): KNOW_MORE_STEPS делится
 * поровну между уровнями, но не больше, чем зон в уровне есть, — остаток
 * уходит в те уровни, где зон ещё хватает.
 *
 * Раньше очередь строилась иначе: «мешок» — сначала ВСЕ зоны первого уровня,
 * потом второго, потом третьего — и первые 12 его элементов. Пока зон первого
 * уровня было меньше 12, деление работало. После расширения колоды (24 → 48
 * зон) их стало 15, и партия на 12 ходов целиком помещалась в первый уровень:
 * уровни 2 и 3 не выпадали НИКОГДА, а «Пенис», «Клитор» и «Простата» из новой
 * колоды не показывались ни разу. Игрок видел «сначала 3 мягких, потом ещё
 * 3 мягких» и думал, что задания повторяются — это был один и тот же уровень.
 */
function knowMoreLevelQuotas(levels, byLevel, steps){
  const quotas = new Map(levels.map(lv => [lv, 0]));
  let left = steps;
  // По одной зоне на уровень за круг, пока у какого-то уровня есть запас.
  while(left > 0){
    let grew = false;
    for(const lv of levels){
      if(left <= 0) break;
      if(quotas.get(lv) < byLevel.get(lv).length){
        quotas.set(lv, quotas.get(lv) + 1);
        left--;
        grew = true;
      }
    }
    if(!grew) break; // свободных зон не осталось — партия будет короче
  }
  return quotas;
}

// Чей это ход: игрок 0 — «Он», игрок 1 — «Она» (state.name1/name2, в хабе это
// «Парень»/«Девушка»). Поле body зоны означает, что такая зона есть только у
// одного из партнёров, поэтому на ходу «Она» зона с body:'he' неуместна.
// В режимах «Он»/«Она» исследователь один, значит подходят все зоны этого
// тела; в режиме «По очереди» роли чередуются по чётности хода.
function knowMoreExplorerAtStep(step, mode, starter){
  if(mode === KNOW_MORE_MODE.HE) return 0;
  if(mode === KNOW_MORE_MODE.SHE) return 1;
  const st = (starter === 1) ? 1 : 0;
  return ((step || 0) % 2 === 0) ? st : 1 - st;
}

// Подходит ли зона этому ходу: общая подходит всем, «Его тело» — только когда
// исследуют МУЖЧИНУ, «Её тело» — только когда исследуют ЖЕНЩИНУ.
//
// Именно получатель, а НЕ исследователь. Исследователь кладёт руки на другого:
// когда трогает мужчина — зона «Её тело», когда трогает женщина — «Его тело».
// Смотреть на исследователя — обратная ошибка, из-за которой в режиме «Он
// исследует» выпадали зоны «Его тело», то есть мужчина получал задания про
// собственное тело вместо женского. Правило настолько простое и настолько
// часто путается, что написано словами прямо здесь.
function knowMoreZoneFitsStep(zone, step){
  if(!zone || !zone.body) return true;
  const receiver = 1 - knowMoreExplorerAtStep(step, getKnowMoreMode(), state.knowMoreStarter);
  return zone.body === (receiver === 0 ? 'he' : 'she');
}

function buildKnowMoreQueue(){
  const zones = getKnowMoreZones();
  if(zones.length === 0) return [];
  // Группируем по уровню: порядок партии — от нежных к смелее.
  const byLevel = new Map();
  zones.forEach(zone=>{
    const lv = typeof zone.level === 'number' ? zone.level : 1;
    if(!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv).push(zone);
  });
  const levels = [...byLevel.keys()].sort((a, b)=>a - b);
  const quotas = knowMoreLevelQuotas(levels, byLevel, KNOW_MORE_STEPS);
  // Внутри уровня — случайный порядок, чтобы партии не повторялись.
  const pools = new Map();
  levels.forEach(lv=>{
    const group = byLevel.get(lv).slice();
    for(let i = group.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [group[i], group[j]] = [group[j], group[i]];
    }
    pools.set(lv, group);
  });
  // Шагами идём по уровням: сперва квота первого, потом второго, потом третьего.
  const order = [];
  levels.forEach(lv=>{ for(let i = 0; i < quotas.get(lv); i++) order.push(lv); });
  const queue = [];
  order.forEach((lv, step)=>{
    const pool = pools.get(lv);
    if(!pool || !pool.length) return;
    let idx = pool.findIndex(zone=>knowMoreZoneFitsStep(zone, step));
    if(idx < 0) idx = 0; // страховка: лучше чужая зона, чем пустой ход
    queue.push(pool.splice(idx, 1)[0].id);
  });
  return queue;
}

function startKnowMoreGame(){
  if(getKnowMoreZones().length === 0){
    showToast('Не удалось загрузить зоны — обновите приложение');
    return;
  }
  state.knowMoreQueue = buildKnowMoreQueue();
  state.knowMoreStep = 0;
  state.knowMoreStarter = (state.knowMoreStarter === 1) ? 1 : 0;
  state.knowMoreMarks = [[], []];
  knowMoreAwaitNext = false;
  goToGame(null, 'knowMoreGame');
  updateMuteBtn();
  requestWakeLock();
  showKnowMoreTurn();
}
document.getElementById('knowMoreStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  startKnowMoreGame();
});

// Кто исследует на текущем ходу, а кого исследуют.
// Режим «По очереди» — роли чередуются по ходу (как было раньше); на первом
// ходу исследует партнёр из state.knowMoreStarter, он же остаётся стартовым
// для партий, начатых до появления режимов. Режимы «Он»/«Она» — исследует
// только этот партнёр, второй всё партию отвечает за свои ощущения.
function knowMoreExplorerIdx(){
  return knowMoreExplorerAtStep(state.knowMoreStep || 0, getKnowMoreMode(), state.knowMoreStarter);
}
function knowMoreReceiverIdx(){
  return 1 - knowMoreExplorerIdx();
}
function knowMoreCurrentZone(){
  const queue = state.knowMoreQueue || [];
  return knowMoreZoneById(queue[state.knowMoreStep || 0]);
}

function updateKnowMoreProgress(){
  const total = (state.knowMoreQueue || []).length;
  const done = Math.min((state.knowMoreStep || 0) + 1, total);
  const fill = document.getElementById('knowMoreProgressFill');
  if(fill) fill.style.width = (total > 0 ? Math.round((done / total) * 100) : 0) + '%';
  const label = document.getElementById('knowMoreProgressLabel');
  if(label) label.textContent = `${done} / ${total}`;
  const turn = document.getElementById('knowMoreTurnLabel');
  if(turn){
    const players = knowMorePlayers();
    turn.textContent = `Исследует: ${players[knowMoreExplorerIdx()]} · Отвечает: ${players[knowMoreReceiverIdx()]}`;
  }
}

function showKnowMoreTurn(){
  knowMoreAwaitNext = false;
  const zone = knowMoreCurrentZone();
  if(!zone){ finishKnowMoreGame(); return; }
  const players = knowMorePlayers();
  const answers = KNOW_MORE_SCALE.map((s, i)=>`<button type="button" class="btn btn-secondary znayu-answer-btn" data-idx="${i}">${s.text}</button>`).join('');
  fadeSwapEl('knowMoreCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body">
      ${knowMoreZoneOwnerText(zone) ? `<div class="know-more-owner">${knowMoreZoneOwnerText(zone)}</div>` : ''}
      <div class="card-split-title">${zone.name}</div>
      <div class="know-more-part">${zone.part || ''}</div>
      <div class="know-more-how">${zone.how || ''}</div>
      <div class="know-more-rule">${players[knowMoreReceiverIdx()]} — что ощущаешь?</div>
    </div><div class="znayu-answers">${answers}</div></div>`;
    el.querySelectorAll('.znayu-answer-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{ answerKnowMore(parseInt(btn.dataset.idx, 10)); });
    });
  });
  updateKnowMoreProgress();
}

// Оценка записывается в карту ТОГО, кого исследовали, и партия сразу
// переходит к следующей зоне: по решению владельца между заданиями нет
// промежуточного окна «Записали: …» и кнопки «Дальше» — только карточка
// следующего задания. Флаг knowMoreAwaitNext остаётся защитой от двойного
// тапа по кнопке оценки: между ответом и показом новой карточки он закрыт.
function answerKnowMore(choiceIdx){
  if(knowMoreAwaitNext) return;
  const scale = KNOW_MORE_SCALE[choiceIdx];
  const zone = knowMoreCurrentZone();
  if(!scale || !zone) return;
  if(!Array.isArray(state.knowMoreMarks)) state.knowMoreMarks = [[], []];
  const receiver = knowMoreReceiverIdx();
  if(!Array.isArray(state.knowMoreMarks[receiver])) state.knowMoreMarks[receiver] = [];
  state.knowMoreMarks[receiver].push({ zoneId: zone.id, score: scale.score });
  // Накопительный список «Исследованные» пополняется сразу, а не в итогах:
  // он должен пережить и прерванную партию — иначе ценность «мы это уже
  // пробовали» терялась бы именно тогда, когда она нужнее всего.
  if(!Array.isArray(state.knowMoreLog)) state.knowMoreLog = [];
  state.knowMoreLog.push({ zoneId: zone.id, score: scale.score, receiver, date: Date.now() });
  knowMoreAwaitNext = true;
  playSuccessSound();
  saveState();
  // Сразу следующее задание (или итоги, если зоны кончились).
  advanceKnowMore();
}

function advanceKnowMore(){
  if(!knowMoreAwaitNext) return;
  state.knowMoreStep = (state.knowMoreStep || 0) + 1;
  saveState();
  if(state.knowMoreStep >= (state.knowMoreQueue || []).length){
    finishKnowMoreGame();
    return;
  }
  showKnowMoreTurn();
}

/* ============ ИТОГИ: КАРТА ТЕЛА ============ */
// Раскладываем отметки одного партнёра по четырём спискам. Оценка хранится
// числом (так дешевле), а игроку показываем слова — восстанавливаем по шкале.
function knowMoreMapFor(playerIdx){
  const marks = (state.knowMoreMarks || [])[playerIdx] || [];
  const items = marks
    .map(m=>({ zone: knowMoreZoneById(m.zoneId), score: m.score }))
    .filter(it=>!!it.zone);
  const byScore = (score)=> items.filter(it=>it.score === score).map(it=>it.zone);
  return {
    liked: byScore(3),
    nice: byScore(2),
    neutral: byScore(1),
    stop: byScore(0),
    total: items.length,
  };
}
function knowMoreMapHtml(map){
  const row = (icon, title, list)=> list.length
    ? `<div class="know-more-row"><div class="know-more-row-title">${icon} ${title}</div><div class="know-more-row-text">${list.map(knowMoreZoneLabel).join(', ')}</div></div>`
    : '';
  if(map.total === 0) return '<div class="know-more-row-text">Зоны не отмечены.</div>';
  return [
    row('💗', 'Очень приятно', map.liked),
    row('😊', 'Приятно', map.nice),
    row('🤍', 'Нейтрально', map.neutral),
    row('⛔', 'Лучше не трогать', map.stop),
  ].join('');
}

function finishKnowMoreGame(){
  hideModal('pauseMenuModal');
  const result = {
    date: Date.now(),
    players: knowMorePlayers(),
    // Глубокая копия отметок: history хранится в state, и без копии правка
    // текущей партии переписала бы прошлые карты.
    marks: JSON.parse(JSON.stringify(state.knowMoreMarks || [[], []])),
  };
  if(!Array.isArray(state.knowMoreHistory)) state.knowMoreHistory = [];
  state.knowMoreHistory.unshift(result);
  state.knowMoreHistory = state.knowMoreHistory.slice(0, 10);
  state.inProgress = false;
  state.pausedMode = null;
  state.lastSectionOnPause = null;
  saveState();
  renderKnowMoreSummary();
  document.querySelectorAll('.screen.active').forEach(el=>el.classList.remove('active'));
  document.getElementById('knowMoreSummary').classList.add('active');
  window.scrollTo(0, 0);
}

function renderKnowMoreSummary(){
  const players = knowMorePlayers();
  const list = document.getElementById('knowMoreSummaryList');
  if(list){
    list.innerHTML = players.map((name, idx)=>`
      <div class="know-more-map">
        <div class="know-more-map-name">${idx === 0 ? 'Он' : 'Она'} · ${name}</div>
        ${knowMoreMapHtml(knowMoreMapFor(idx))}
      </div>
    `).join('');
  }
  const past = document.getElementById('knowMoreSummaryPast');
  if(past){
    // Строка про накопленные карты — простой текст, поэтому textContent:
    // innerHTML здесь ничего не даёт, а в тестах остаётся проверяемым.
    const history = state.knowMoreHistory || [];
    past.textContent = history.length > 1
      ? `Сохранено карт: ${history.length} — каждая следующая партия дополняет карту.`
      : 'Это первая карта — сыграйте ещё, она дополнится.';
  }
}
function exitKnowMoreSummary(){
  goToKnowMoreSetup();
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  updateResumeUI();
}
document.getElementById('knowMoreSummaryExitBtn').addEventListener('click', ()=>{ exitKnowMoreSummary(); });

// Прерывание партии: несохранённая карта в историю не пишется — как у
// остальных игр при выходе посреди партии. Сюда ведут кнопка «Выход» на
// экране игры и «Закончить игру» в меню паузы.
function finishPausedKnowMoreGame(){
  hideModal('pauseMenuModal');
  stopAllSounds();
  state.inProgress = false;
  state.pausedMode = null;
  state.lastSectionOnPause = null;
  goToKnowMoreSetup();
  saveState();
  updateResumeUI();
  showToast('Карта не сохранена — начните партию заново');
}
document.getElementById('knowMoreExitBtn').addEventListener('click', ()=>{ finishPausedKnowMoreGame(); });

// Пауза. Останавливаем озвучку, гасим экран игры и отдаём хаб: общее меню
// паузы («Продолжить игру» / «Закончить игру») покажет updateResumeUI() по
// state.pausedMode — так же, как у «Пройдите теста».
//
// Отдельное поле knowMorePaused не нужно: вся партия уже лежит в state
// (knowMoreQueue, knowMoreStep, knowMoreMarks, knowMoreLog) и сохраняется
// целиком. Сохраняем только номер хода — он же пригодится в отладке, если
// партия когда-нибудь продолжится не с того места. В отличие от «Пройдите
// теста» фазы экрана тут нет: оценка сразу переводит на следующую зону, то
// есть на паузе всегда открыта свежая карточка без ответа.
function pauseKnowMoreGame(){
  if(typeof stopAllSounds === 'function') stopAllSounds();
  state.pausedMode = 'knowMore';
  state.lastSectionOnPause = 'twoPlayerView';
  saveState();
  document.getElementById('knowMoreGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('twoPlayerView');
  updateResumeUI();
}

// Продолжение из меню паузы: возвращаем ровно туда, откуда ушли. Отметки,
// очередь и накопительный список «Исследованные» уже в state и переживают
// паузу; заново их не строим — иначе оценки потерялись бы.
function resumeKnowMoreGame(){
  state.pausedMode = null;
  saveState();
  updateResumeUI();
  goToGame(null, 'knowMoreGame');
  updateMuteBtn();
  requestWakeLock();
  // Если зон не осталось (пауза нажата у самой последней карточки), партия
  // фактически доиграна — сразу показываем итоги, а не пустую карточку.
  if(knowMoreCurrentZone()) showKnowMoreTurn();
  else finishKnowMoreGame();
}
