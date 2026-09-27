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
// ПАРТИЯ. KNOW_MORE_STEPS зон, каждую исследует один из двоих, роли чередуются
// по ходу — значит на «Он» и на «Она» приходится поровну исследованных зон.
// Порядок зон — от нежных (level 1) к смелее (level 3), внутри уровня
// случайно: партия всегда мягко начинается и плавно идёт дальше.
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

// После оценки карточка ждёт нажатия «Дальше». Флаг живёт в модуле (как
// compatTestAwaitingHandoff), а не в state: это состояние одного экрана,
// и сохранять его в localStorage незачем.
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

/* ============ ЭКРАН НАСТРОЙКИ ============ */
function goToKnowMoreSetup(){
  goToGameSetup('knowMoreSetup', 'twoPlayerView', ()=>{ renderKnowMoreStarterGroup(); });
}

// Кто исследует: три режима. Первый — «По очереди» (партия идёт как раньше,
// роли меняются по ходу), два других — когда исследует только один партнёр.
const KNOW_MORE_MODE = { ALTERNATE:0, HE:1, SHE:2 };

// Список режимов для экрана настроек. Первым идёт «По очереди» — это
// режим по умолчанию и то поведение, которое было до появления двух других.
// Под именем «Он»/«Она» показываем имя, введённое в хабе (name1/name2).
function knowMoreModeList(){
  const players = knowMorePlayers();
  return [
    { value: KNOW_MORE_MODE.ALTERNATE, label: 'По очереди', desc: 'Исследуете друг друга по очереди' },
    { value: KNOW_MORE_MODE.HE, label: 'Он', desc: `${players[0]} исследует` },
    { value: KNOW_MORE_MODE.SHE, label: 'Она', desc: `${players[1]} исследует` },
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
function goToKnowMoreHistory(){
  const wrap = document.getElementById('knowMoreHistoryList');
  const log = Array.isArray(state.knowMoreLog) ? state.knowMoreLog : [];
  const players = knowMorePlayers();
  if(!wrap) return;
  if(log.length === 0){
    wrap.innerHTML = '<div class="know-more-empty">Пока ничего не исследовано — начните первую партию.</div>';
  } else {
    wrap.innerHTML = players.map((name, idx)=>{
      const rows = log
        .filter(it => it.receiver === idx && knowMoreZoneById(it.zoneId))
        .map(it => ({ zone: knowMoreZoneById(it.zoneId), score: it.score }));
      const lines = rows.length
        ? rows.map(it => `${it.zone.icon || '🧭'} ${it.zone.name} — ${knowMoreLogScoreText(it.score)}`)
        : ['—'];
      return `
        <div class="know-more-map">
          <div class="know-more-map-name">${idx === 0 ? 'Он' : 'Она'} · ${name} — исследовано зон: ${rows.length}</div>
          <div class="know-more-row"><div class="know-more-row-text">${lines.join('<br>')}</div></div>
        </div>`;
    }).join('') + `<div class="intro-text">Всего отметок: ${log.length}. Список пополняется сразу после каждой оценки и не зависит от того, дошла ли партия до итогов.</div>`;
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

/* ============ ПАРТИЯ ============ */
// Очередь зон: сначала level 1, потом 2, потом 3; внутри одного уровня
// порядок случайный, чтобы партии не повторялись.
function buildKnowMoreQueue(){
  const byLevel = new Map();
  getKnowMoreZones().forEach(zone=>{
    const lv = typeof zone.level === 'number' ? zone.level : 1;
    if(!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv).push(zone);
  });
  const bag = [];
  [...byLevel.keys()].sort((a, b)=>a - b).forEach(lv=>{
    const group = byLevel.get(lv).slice();
    for(let i = group.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [group[i], group[j]] = [group[j], group[i]];
    }
    bag.push(...group);
  });
  return bag.slice(0, KNOW_MORE_STEPS).map(zone=>zone.id);
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
  const mode = getKnowMoreMode();
  if(mode === KNOW_MORE_MODE.HE) return 0;
  if(mode === KNOW_MORE_MODE.SHE) return 1;
  const starter = (state.knowMoreStarter === 1) ? 1 : 0;
  return ((state.knowMoreStep || 0) % 2 === 0) ? starter : 1 - starter;
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
  // Кнопка «Дальше» появляется только после оценки — до неё на карточке
  // есть только шкала ощущений.
  const nextBtn = document.getElementById('knowMoreNextBtn');
  if(nextBtn) nextBtn.hidden = true;
  const zone = knowMoreCurrentZone();
  if(!zone){ finishKnowMoreGame(); return; }
  const players = knowMorePlayers();
  const answers = KNOW_MORE_SCALE.map((s, i)=>`<button type="button" class="btn btn-secondary znayu-answer-btn" data-idx="${i}">${s.text}</button>`).join('');
  fadeSwapEl('knowMoreCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body">
      <div class="card-icon">${zone.icon || '🧭'}</div>
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

// Оценка записывается в карту ТОГО, кого исследовали. Повторный клик по уже
// закрытой карточке не должен дописывать вторую оценку — поэтому ответ
// блокируется флагом knowMoreAwaitNext до нажатия «Дальше».
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
  const nextBtn = document.getElementById('knowMoreNextBtn');
  if(nextBtn) nextBtn.hidden = false;
  playSuccessSound();
  saveState();
  const players = knowMorePlayers();
  fadeSwapEl('knowMoreCard', (el)=>{
    el.innerHTML = `<div class="card-inner"><div class="card-body">
      <div class="card-icon">${scale.score >= 2 ? '💗' : '🤍'}</div>
      <div class="card-split-title">${zone.name}</div>
      <div class="know-more-part">Записали: ${players[receiver]} — ${scale.text}</div>
    </div></div>`;
  });
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
document.getElementById('knowMoreNextBtn').addEventListener('click', ()=>{
  playSuccessSound();
  advanceKnowMore();
});

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
    ? `<div class="know-more-row"><div class="know-more-row-title">${icon} ${title}</div><div class="know-more-row-text">${list.map(z=>z.name).join(', ')}</div></div>`
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
// остальных игр при выходе посреди партии. Стрелка «←» (noPause) ведёт сюда же.
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

// Продолжение из меню паузы. У игры паузы нет (noPause), но реестр требует
// функцию: кнопка «Продолжить игру» не должна падать, если партия окажется
// на паузе. Возвращаем на последний показанный ход.
function resumeKnowMoreGame(){
  state.pausedMode = null;
  saveState();
  updateResumeUI();
  goToGame(null, 'knowMoreGame');
  updateMuteBtn();
  requestWakeLock();
  if(knowMoreCurrentZone()) showKnowMoreTurn();
  else finishKnowMoreGame();
}
