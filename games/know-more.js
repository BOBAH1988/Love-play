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
// icon — тот же набор, что уже показывается в окне итогов (knowMoreMapHtml):
// 💗 😊 💙 ⛔. Взят один и тот же набор намеренно: иначе на карточке и в итогах
// одна и та же оценка выглядела бы по-разному, и игрок привыкал бы к двум
// обозначениям. Иконка дублирует подпись, а не заменяет её: на кнопках оценки
// текст остаётся (подсказка важнее места), а в «Исследованных» слова заменены
// иконкой ради краткости.
const KNOW_MORE_SCALE = [
  { score: 3, icon: '💗', text: 'Очень приятно' },
  { score: 2, icon: '😊', text: 'Приятно' },
  { score: 1, icon: '💙', text: 'Нейтрально' },
  { score: 0, icon: '⛔', text: 'Стоп — лучше не трогать' },
];

/* ============ ЧЕМ ИССЛЕДУЮТ ============
 * Способ воздействия, выбирается на настройке. Сама очередь зон от него НЕ
 * зависит: подсказка на карточке одна и та же. Разница в том, чем именно
 * трогали, и она попадает в накопительный список «Исследованные» — через
 * несколько партий видно, что зона с «очень приятно» получилась после губ,
 * а не после рук, и это уже подсказывает, что повторить.
 *
 * Значение хранится в state.knowMoreTool и пишется в каждую запись
 * knowMoreLog. Старые записи без поля показывают первый способ (руки) —
 * дефолт, который стоял до появления настройки.
 *
 * Тексты намеренно без оценок «сильнее/слабее»: одна и та же зона отвечает
 * по-разному в зависимости от настроения и близости, а подсказка на карточке
 * уже говорит, что делать руками. Настройка не навязывает ничего, она лишь
 * запоминает.
 */
const KNOW_MORE_TOOLS = [
  { value:0, label:'Руками', desc:'Пальцами и ладонями' },
  { value:1, label:'Губами и языком', desc:'Поцелуи, язык, влажность' },
  { value:2, label:'Пером или тканью', desc:'Мягкая текстура, скольжение' },
  { value:3, label:'Вибрацией', desc:'Внешняя стимуляция' },
];
function knowMoreToolList(){
  return KNOW_MORE_TOOLS;
}
// Текущий способ. Значение из старого сохранения может быть любым числом (или
// его не быть вовсе — поле появилось позже) — тогда берём первый, «Руками».
function getKnowMoreTool(){
  const v = Number(state.knowMoreTool);
  return knowMoreToolList().some(t => t.value === v) ? v : 0;
}
function knowMoreToolLabel(value){
  const found = knowMoreToolList().find(t => t.value === value);
  return found ? found.label : knowMoreToolList()[0].label;
}
// Подпись способа для конкретной записи knowMoreLog. Отдельная функция
// намеренно: у записи может НЕ быть поля tool (старые сохранения), и там нужен
// дефолт «Руками» — а не текущая настройка игрока. Подставить сюда
// getKnowMoreTool() значило бы приписать старой записи способ, которым её на
// самом деле не трогали. Неизвестное значение читается так же, как «Руками».
function knowMoreLogToolText(entry){
  if(!entry || entry.tool === undefined || entry.tool === null) return knowMoreToolLabel(0);
  return knowMoreToolLabel(entry.tool);
}
// Отрисовка группы «Чем исследуют» — тот же компонент .level-toggle, что у
// «Кто исследует». Аккуратно с подписями: названия длинные, поэтому вторая
// строка (desc) объясняет каждую коротко.
function renderKnowMoreToolGroup(){
  const wrap = document.getElementById('knowMoreToolGroup');
  if(!wrap) return;
  const tool = getKnowMoreTool();
  if(state.knowMoreTool !== tool){
    state.knowMoreTool = tool;
    saveState();
  }
  wrap.innerHTML = '';
  knowMoreToolList().forEach(({ value, label, desc })=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + (tool === value ? ' on' : '');
    div.innerHTML = `<div class="lname">${label}</div><div class="ldesc">${desc}</div><div class="level-check"></div>`;
    div.addEventListener('click', ()=>{
      state.knowMoreTool = value;
      saveState();
      playSuccessSound();
      renderKnowMoreToolGroup();
    });
    wrap.appendChild(div);
  });
}

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
// ГРУППИРОВКА ОТМЕТОК. В колоде 17 разных значений поля part («Ноги», «Живот»,
// «Ключицы», «Локти»…), и в «Исследованных» такой список невозможно читать:
// при двух-трёх партиях это строка, а при двадцати — простыня без структуры.
// Поэтому отметки собираются в 7 групп по областям тела, в порядке сверху вниз:
// голова → плечи/спина/грудь → живот и бок → руки → ноги → всё тело → интимная
// зона. Порядок групп и есть главная подсказка для ориентировки: он совпадает с
// анатомией, поэтому «ниже по списку» = «ниже на теле».
//
// Ключи латинские и стабильные: они попадают в state.knowMoreOpen (какая группа
// раскрыта), поэтому переименование key сбросило бы у игрока раскрытые секции.
// Зона с неизвестной частью попадает в «Другие зоны» — не пропадает.
const KNOW_MORE_GROUPS = [
  { key:'head',     title:'Голова и лицо',            parts:['Голова', 'Лицо', 'Уши', 'Волосы'] },
  { key:'torso',    title:'Плечи, спина и грудь',    parts:['Плечи', 'Спина', 'Ключицы', 'Поясница', 'Грудь'] },
  { key:'belly',    title:'Живот и бок',              parts:['Живот', 'Бок'] },
  { key:'arms',     title:'Руки, локти и подмышки',   parts:['Руки', 'Локти', 'Подмышки'] },
  { key:'legs',     title:'Ноги',                     parts:['Ноги'] },
  { key:'whole',    title:'Всё тело',                 parts:['Тело'] },
  { key:'intimate', title:'Интимная зона',            parts:['Интимная зона'] },
];
const KNOW_MORE_GROUP_OTHER = { key:'other', title:'Другие зоны', parts:[] };

// Группа зоны по её part.
function knowMoreGroupOf(zone){
  const part = zone && zone.part;
  const found = KNOW_MORE_GROUPS.find(g => g.parts.indexOf(part) >= 0);
  return found || KNOW_MORE_GROUP_OTHER;
}
// Раскрытые группы. Ключ хранится с индексом партнёра («0:head»), чтобы у
// каждого своя раскладка: открытая группа у «Него» не открывает такую же у «Неё».
function knowMoreOpenGroups(){
  return Array.isArray(state.knowMoreOpen) ? state.knowMoreOpen : [];
}
function isKnowMoreGroupOpen(openKey){
  return knowMoreOpenGroups().indexOf(openKey) >= 0;
}
// Раскрывает/сворачивает группу и возвращает её новое состояние: true —
// раскрыта. Возврат нужен вызывающему (в том числе тесту), а не только для
// красоты: перерисовка экрана идёт по факту нажатия.
function toggleKnowMoreGroup(openKey){
  const open = knowMoreOpenGroups();
  const at = open.indexOf(openKey);
  if(at >= 0){
    open.splice(at, 1);
    state.knowMoreOpen = open;
    saveState();
    return false;
  }
  open.push(openKey);
  state.knowMoreOpen = open;
  saveState();
  return true;
}

// Подсказка для ВЫБРАННОГО способа. В данных у каждой зоны есть how (руки) и
// howByTool {1,2,3} — по варианту на каждый способ из настройки «Чем
// исследуют». Если варианта нет (старая колода), отдаём обычную подсказку:
// хуже лишний текст в скобках, чем молчаливо неверная инструкция.
function knowMoreHowText(zone){
  if(!zone) return '';
  if(zone.howByTool){
    const alt = zone.howByTool[String(getKnowMoreTool())];
    if(alt) return alt;
  }
  return zone.how || '';
}

/* ============ ЭКРАН НАСТРОЙКИ ============ */
function goToKnowMoreSetup(){
  goToGameSetup('knowMoreSetup', 'twoPlayerView', ()=>{
    renderKnowMoreStarterGroup();
    renderKnowMoreToolGroup();
  });
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
// Иконка оценки для списков. Неизвестное значение (старое сохранение, битая
// запись) даёт «—», а не выдуманный смайлик: лучше видно, что значение не
// распознано, чем что оно «приятное».
function knowMoreLogScoreIcon(score){
  const found = KNOW_MORE_SCALE.find(s => s.score === score);
  return found ? found.icon : '—';
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
    // Строка отметки в порядке, заданном владельцем: ИКОНКА РЕАКЦИИ → зона →
    // способ воздействия. Реакция иконкой, а не словами: в «Исследованных» к
    // моменту, когда отметок много, слова «Очень приятно» съедали половину
    // строки. Иконка помечена role=img с aria-label — для программ чтения с
    // экрана и для долгого нажатия (подсказка) реакция остаётся доступной.
    const lineHtml = (score, zoneText, toolText, index)=>`<span class="know-more-item">`
      + `<span class="know-more-score-icon" role="img" `
      + `aria-label="${knowMoreLogScoreText(score)}" `
      + `title="${knowMoreLogScoreText(score)}">${knowMoreLogScoreIcon(score)}</span>`
      + `<span class="know-more-item-text">${zoneText} · ${toolText}</span>`
      + `<button type="button" class="know-more-item-del" data-knowmore-del="${index}" `
      + `aria-label="Удалить: ${zoneText}, ${knowMoreLogScoreText(score)}, ${toolText}">✕</button></span>`;
    // Короткая сводка в заголовке группы: теми же иконками, что и в строках,
    // иначе один экран говорил бы об оценке двумя способами.
    const scoreSum = (items)=>{
      const parts = [];
      KNOW_MORE_SCALE.forEach(s=>{
        const n = items.filter(it=>it.score === s.score).length;
        if(n > 0) parts.push(`<span class="know-more-sum-icon" title="${s.text} ${n}">${s.icon}${n}</span>`);
      });
      return parts.length ? parts.join('') : '—';
    };
    wrap.innerHTML = players.map((name, idx)=>{
      // Отметки этого партнёра, разложенные по группам в порядке «сверху вниз».
      const groups = KNOW_MORE_GROUPS.concat([KNOW_MORE_GROUP_OTHER]).map(group=>({ group, items:[] }));
      log.forEach((it, i)=>{
        if(it.receiver !== idx) return;
        const zone = knowMoreZoneById(it.zoneId);
        if(!zone) return;
        const bucket = groups.find(b => b.group.key === knowMoreGroupOf(zone).key);
        bucket.items.push({ it, zone, logIndex:i });
      });
      const filled = groups.filter(b => b.items.length > 0);
      const blocks = filled.length ? filled.map(({ group, items })=>{
        const openKey = `${idx}:${group.key}`;
        const isOpen = isKnowMoreGroupOpen(openKey);
        const rows = items.map(({ zone, it, logIndex }) =>
          lineHtml(it.score, knowMoreZoneLabel(zone), knowMoreLogToolText(it), logIndex)).join('');
        return `
        <div class="know-more-group${isOpen ? ' open' : ''}">
          <button type="button" class="know-more-group-head" data-knowmore-group="${openKey}"
                  aria-expanded="${isOpen ? 'true' : 'false'}">
            <span class="know-more-group-title">${group.title}</span>
            <span class="know-more-group-sum">${scoreSum(items.map(x=>x.it))}</span>
            <span class="know-more-group-count">${items.length}</span>
            <span class="section-toggle-arrow${isOpen ? ' section-open' : ''}">▼</span>
          </button>
          <div class="know-more-group-body">${rows}</div>
        </div>`;
      }).join('') : '<div class="know-more-row-text">—</div>';
      const total = filled.reduce((n, b)=>n + b.items.length, 0);
      return `
        <div class="know-more-map">
          <div class="know-more-map-name">${idx === 0 ? 'Он' : 'Она'} · ${name} — исследовано зон: ${total}</div>
          ${blocks}
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
    // Раскрытие/сворачивание группы. Перерисовка идёт целиком, чтобы состояние
    // открытых групп (state.knowMoreOpen) осталось единым источником правды.
    wrap.querySelectorAll('[data-knowmore-group]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        toggleKnowMoreGroup(btn.dataset.knowmoreGroup);
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
  // Иконка перед подписью: та же оценка на кнопке и в «Исследованных» должна
  // выглядеть одинаково. Подпись не убираем — по ней игрок выбирает, что ответить.
  const answers = KNOW_MORE_SCALE.map((s, i)=>`<button type="button" class="btn btn-secondary znayu-answer-btn" data-idx="${i}"><span class="know-more-scale-icon" aria-hidden="true">${s.icon}</span>${s.text}</button>`).join('');
  fadeSwapEl('knowMoreCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body">
      ${knowMoreZoneOwnerText(zone) ? `<div class="know-more-owner">${knowMoreZoneOwnerText(zone)}</div>` : ''}
      <div class="card-split-title">${zone.name}</div>
      <div class="know-more-part">${zone.part || ''}</div>
      <div class="know-more-how">${knowMoreHowText(zone)}</div>
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
  // tool записывается вместе с оценкой: способы менялись от партии к партии,
  // и без этого в «Исследованных» не видно, чем именно трогали.
  state.knowMoreLog.push({ zoneId: zone.id, score: scale.score, receiver, tool: getKnowMoreTool(), date: Date.now() });
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
    row('💙', 'Нейтрально', map.neutral),
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
  // Служебные строки под картой (счётчик накопленных карт и подсказка про
  // первую карту) убраны по решению владельца: они ничего не говорили о теле
  // и занимали место перед кнопкой «В меню». Осталась одна подпись в разметке —
  // «Карта сохранена в приложении»: она объясняет, куда делась карта после
  // закрытия окна.
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
