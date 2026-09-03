// games/lucky.js — Игра "Счастливый билет" (2 команды).
// Загружается через <script src="games/lucky.js"></script> в index.html.

/* ---------- СЧАСТЛИВЫЙ БИЛЕТ: общее игровое поле 5×5 на всю компанию ---------- */
// Семейная версия "Секс-бинго": то же самое поле 5×5 (25 клеток, 10 линий)
// и та же схема уровней (3 штуки, автоповышение после 1-й и 3-й собранной
// линии, при повышении заменяются только ещё не отмеченные клетки — как в
// escalateBingoTo). Отличие от "Секс-бинго" — на общем поле ходят по
// очереди все игроки компании (не только двое), а сексуальные задания
// недопустимы: только последний уровень чуть смелее, но без прямого секса
// (см. cards_lucky.js). Партия завершается сама после 5 линий или всех 25
// клеток — точно как в "Секс-бинго".
const LUCKY_LINES = [
  [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
  [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24]
];
// "Счастливая" клетка — не задание, а пропуск хода, тот же приём, что
// BINGO_LUCKY_TEXT в games/bingo.js (та же зелёная подсветка через общий
// класс .bingo-lucky), но в отличие от "Секс-бинго" — не одна на всю
// партию, а по одной на каждом из 3 уровней: при включённом режиме "Скрыть
// задания" свежая счастливая клетка подбирается и на старте, и при каждом
// повышении уровня (см. escalateLuckyTo). LUCKY_LUCKY_COUNT — максимум
// незайденных счастливых клеток одновременно на поле (не общий лимит на
// партию). Появляется только пока карта скрыта — открытая состоит только
// из настоящих заданий.
const LUCKY_LUCKY_TEXT = 'Пропустите ход';
const LUCKY_LUCKY_COUNT = 1;
function getLuckyTasksList(level){
  if(typeof LUCKY_TASKS === 'undefined' || !Array.isArray(LUCKY_TASKS)) return [];
  return LUCKY_TASKS.filter(i=>i.level===level);
}
function getLuckyBonusList(level){
  if(typeof LUCKY_BONUS === 'undefined' || !Array.isArray(LUCKY_BONUS)) return [];
  return LUCKY_BONUS.filter(i=>i.level===level);
}
// Тот же принцип, что и pickBingoBonus в "Секс-бинго": в рамках одной
// партии бонус этого уровня не повторяется, пока не исчерпан весь пул.
function pickLuckyBonus(level){
  const list = getLuckyBonusList(level);
  if(!state.luckyUsedBonus) state.luckyUsedBonus = [];
  let available = list.filter(b=>!state.luckyUsedBonus.includes(b.text));
  if(available.length === 0){
    state.luckyUsedBonus = [];
    available = list;
  }
  const bonus = available.length ? available[Math.floor(Math.random()*available.length)] : null;
  if(bonus) state.luckyUsedBonus.push(bonus.text);
  return bonus;
}
// Финальное задание для проигравшей команды (меньше отмеченных клеток) —
// отдельный пул LUCKY_FINAL_TASKS, не привязан к уровню, выбирается один
// раз случайно в конце партии (см. showLuckySummaryModal).
function pickLuckyFinalTask(){
  if(typeof LUCKY_FINAL_TASKS === 'undefined' || !Array.isArray(LUCKY_FINAL_TASKS) || LUCKY_FINAL_TASKS.length === 0) return null;
  return LUCKY_FINAL_TASKS[Math.floor(Math.random()*LUCKY_FINAL_TASKS.length)];
}
function luckyLevelInfo(level){
  return (typeof LUCKY_LEVELS !== 'undefined' ? LUCKY_LEVELS.find(l=>l.id===level) : null) || {name:'Знакомство', icon:'🤝'};
}
// Чек-лист "Бонусные задания" — накопительный список, который переживает
// смену партий Счастливого билета (сбрасывается только вручную, крестиком
// на отдельном пункте, или через общий "Сбросить прогресс"). Та же логика,
// что и addBingoBonusToChecklist/renderBingoBonusChecklist в "Секс-бинго".
function addLuckyBonusToChecklist(text){
  if(!text) return;
  if(!state.luckyBonusChecklist) state.luckyBonusChecklist = [];
  const alreadyPending = state.luckyBonusChecklist.some(it => it.text === text && !it.done);
  if(alreadyPending) return;
  state.luckyBonusChecklist.push({text, done:false});
}
function renderLuckyBonusChecklist(){
  const block = document.getElementById('luckyBonusChecklistBlock');
  const list = document.getElementById('luckyBonusChecklistList');
  if(!block || !list) return;
  const items = state.luckyBonusChecklist || [];
  if(items.length === 0){
    block.style.display = 'none';
    list.innerHTML = '';
    return;
  }
  block.style.display = '';
  list.innerHTML = items.map((it,i)=>`
    <li class="bingo-bonus-checklist-item${it.done ? ' done' : ''}">
      <span class="bingo-bonus-checklist-text" data-idx="${i}">${it.text}</span>
      <button type="button" class="bingo-bonus-checklist-delete" data-idx="${i}" aria-label="Удалить">✕</button>
    </li>
  `).join('');
  list.querySelectorAll('.bingo-bonus-checklist-text').forEach(el=>{
    el.addEventListener('click', ()=>{
      const idx = parseInt(el.dataset.idx, 10);
      const item = state.luckyBonusChecklist[idx];
      if(!item) return;
      item.done = !item.done;
      saveState();
      renderLuckyBonusChecklist();
    });
  });
  list.querySelectorAll('.bingo-bonus-checklist-delete').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const idx = parseInt(btn.dataset.idx, 10);
      state.luckyBonusChecklist.splice(idx, 1);
      saveState();
      renderLuckyBonusChecklist();
    });
  });
}
// Ровно 2 команды, в каждой мужчина и женщина — оформление такое же, как у
// блоков семей в "Знаю тебя" (fam-znayu-family-block/-inputs), но без
// переключателя пола: слот "м" и слот "ж" внутри команды фиксированы.
function ensureLuckyTeams(){
  if(!Array.isArray(state.luckyTeams) || state.luckyTeams.length !== 2){
    state.luckyTeams = [{name:'Команда 1', m:'Он', f:'Она'},{name:'Команда 2', m:'Он', f:'Она'}];
  }
  state.luckyTeams.forEach((t,i)=>{
    if(!t.name) t.name = 'Команда ' + (i+1);
    if(!t.m) t.m = 'Он';
    if(!t.f) t.f = 'Она';
  });
}
function renderLuckyTeams(){
  ensureLuckyTeams();
  const wrap = document.getElementById('luckyTeamsList');
  if(!wrap) return;
  wrap.innerHTML = '';
  state.luckyTeams.forEach((team, idx)=>{
    const block = document.createElement('div');
    block.className = 'fam-znayu-family-block';
    const label = document.createElement('div');
    label.className = 'fam-znayu-family-label';
    label.textContent = 'Команда ' + (idx + 1);
    block.appendChild(label);
    const nameRow = document.createElement('div');
    nameRow.className = 'fam-znayu-family-inputs';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.maxLength = 14;
    nameInput.placeholder = 'Команда ' + (idx + 1);
    nameInput.value = team.name;
    nameInput.addEventListener('input', ()=>{
      state.luckyTeams[idx].name = nameInput.value.trim() || ('Команда ' + (idx + 1));
      saveState();
    });
    nameRow.appendChild(nameInput);
    block.appendChild(nameRow);
    const membersRow = document.createElement('div');
    membersRow.className = 'fam-znayu-family-inputs';
    membersRow.style.marginTop = '6px';
    const mInput = document.createElement('input');
    mInput.type = 'text';
    mInput.maxLength = 14;
    mInput.placeholder = 'Он';
    mInput.value = team.m;
    mInput.addEventListener('input', ()=>{
      state.luckyTeams[idx].m = mInput.value.trim() || 'Он';
      saveState();
    });
    membersRow.appendChild(mInput);
    const fInput = document.createElement('input');
    fInput.type = 'text';
    fInput.maxLength = 14;
    fInput.placeholder = 'Она';
    fInput.value = team.f;
    fInput.addEventListener('input', ()=>{
      state.luckyTeams[idx].f = fInput.value.trim() || 'Она';
      saveState();
    });
    membersRow.appendChild(fInput);
    block.appendChild(membersRow);
    wrap.appendChild(block);
  });
}
function goToLuckySetup(){
  goToGameSetup('luckySetup', null, ()=>{
    renderLuckyTeams();
  });
}
function exitLuckySetup(){
  document.getElementById('luckySetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
    showSetupView('companyView');
}
// Поле на 25 клеток — без повторов внутри одного уровня, пока пул не
// закончится (тот же принцип дедупликации, что и в остальных играх
// компании), затем пул уровня показывается заново.
function generateLuckyGrid(level){
  const all = getLuckyTasksList(level);
  if(all.length === 0) return [];
  if(!state.luckyUsed) state.luckyUsed = {};
  let used = state.luckyUsed[level] || [];
  let pool = all.filter(c=>!used.includes(c.text));
  if(pool.length < 25){
    pool = all;
    used = [];
    showToast('Задания этого уровня показаны заново 🔀');
  }
  const picked = shuffle(pool).slice(0, Math.min(25, pool.length));
  state.luckyUsed[level] = used.concat(picked.map(c=>c.text));
  return picked.map(c=>c.text);
}
// Кто сейчас исполнитель внутри команды idx — чередуется по чётности
// luckyTeamTurnCount[idx] (растёт на 1 при каждой передаче хода от этой
// команды), не зависит от того, сколько ходов было у другой команды.
function luckyCurrentActor(idx){
  ensureLuckyTeams();
  const team = state.luckyTeams[idx] || {name:'Команда ' + (idx+1), m:'Он', f:'Она'};
  const turnCount = (state.luckyTeamTurnCount || [0,0])[idx] || 0;
  const actorIsM = turnCount % 2 === 0;
  return {
    actorName: actorIsM ? team.m : team.f,
    targetName: actorIsM ? team.f : team.m,
    actorIsM
  };
}
// Необязательное окончание в скобках, например "готов(а)", разрешается под
// пол текущего исполнителя — тот же приём, что resolveFamZnayuGenderText в
// "Знаю тебя", только односторонний (речь о самом исполнителе, а не о паре
// герой/угадывающий).
function resolveLuckyActorGenderText(text, actorIsM){
  if(!text) return text;
  return text.replace(/([А-Яа-яЁё]+)\(([а-яё]+)\)/g, (m, base, suf)=> actorIsM ? base : base + suf);
}
function updateLuckyScoreUI(){
  ensureLuckyTeams();
  const teams = state.luckyTeams;
  const completed = state.luckyCompleted || [];
  const idx = state.luckyCurrentTeamIndex || 0;
  const wrap = document.getElementById('luckyScoreRow');
  if(wrap){
    wrap.innerHTML = '';
    teams.forEach((team, i)=>{
      const span = document.createElement('span');
      span.className = 'krokodil-score-item' + (i === idx ? ' active' : '');
      span.textContent = team.name + ': ' + (completed[i] || 0);
      wrap.appendChild(span);
    });
  }
  const teamName = (teams[idx] && teams[idx].name) || 'Команда 1';
  const actor = luckyCurrentActor(idx);
  const turnLabel = document.getElementById('luckyTurnLabel');
  if(turnLabel) turnLabel.textContent = `Ходит: ${teamName} — ${actor.actorName} → ${actor.targetName}`;
  const level = state.luckyLevel || 1;
  const info = luckyLevelInfo(level);
  const linesTotal = (state.luckyWonLines || []).length;
  const levelLabel = document.getElementById('luckyLevelLabel');
  if(levelLabel) levelLabel.textContent = `Уровень: ${info.icon} ${info.name} · Линий: ${linesTotal}/10`;
}
function renderLuckyGrid(){
  const wrap = document.getElementById('luckyGrid');
  if(!wrap) return;
  wrap.innerHTML = '';
  const grid = state.luckyGrid || [];
  const checked = state.luckyChecked || [];
  if(!state.luckyRevealed) state.luckyRevealed = grid.map(()=>true);
  const actor = luckyCurrentActor(state.luckyCurrentTeamIndex || 0);
  grid.forEach((text, i)=>{
    const isLucky = text === LUCKY_LUCKY_TEXT;
    // "Пропустите ход" остаётся закрытой 🎁 независимо от общего переключателя
    // "Скрыть/Показать задания" — иначе сюрприз теряет смысл, если текст виден
    // заранее (тот же приём, что и в renderBingoGrid).
    const isHidden = !checked[i] && (isLucky || (!!state.luckyTasksHidden && !state.luckyRevealed[i]));
    const cell = document.createElement('div');
    cell.className = 'bingo-cell' + (checked[i] ? ' checked' : '') + (isHidden ? ' hidden' : '') + (checked[i] && isLucky ? ' bingo-lucky' : '');
    cell.textContent = isHidden ? '🎁' : resolveLuckyActorGenderText(text, actor.actorIsM);
    if(!checked[i] && !state.luckyFinished) cell.addEventListener('click', ()=>clickLuckyCell(i));
    wrap.appendChild(cell);
    // Скрытая клетка показывает только иконку 🎁 — подгонка под текст задания
    // ей не нужна и раньше перебивала инлайн-стилем увеличенный размер иконки
    // из CSS (.bingo-cell.hidden), из-за чего иконка выглядела мелкой (см.
    // тот же приём в games/bingo.js/renderBingoGrid).
    if(!isHidden) fitBingoCellText(cell);
  });
  updateLuckyScoreUI();
}
// Скрытая заданиями клетка (см. "Скрыть задания") отмечается тем же одним
// нажатием, что и обычная — раньше первое нажатие только открывало 🎁 →
// текст, отметить выполненным нужно было отдельное второе нажатие (см. тот
// же фикс и комментарий в games/bingo.js — там нашли и описали причину).
function clickLuckyCell(i){
  if(state.luckyFinished) return;
  const checked = state.luckyChecked || (state.luckyChecked = new Array(25).fill(false));
  if(checked[i]) return;
  if(!state.luckyRevealed) state.luckyRevealed = (state.luckyGrid || []).map(()=>true);
  state.luckyRevealed[i] = true;
  playSuccessSound();
  checked[i] = true;
  const idx = state.luckyCurrentTeamIndex || 0;
  if(!state.luckyCompleted) state.luckyCompleted = [];
  state.luckyCompleted[idx] = (state.luckyCompleted[idx] || 0) + 1;
  saveState();
  renderLuckyGrid();
  checkLuckyLinesAndAdvance();
  if(state.luckyFinished) return; // итог уже показан — ход никому не передаём
  passLuckyTurn();
}
function passLuckyTurn(){
  const idx = state.luckyCurrentTeamIndex || 0;
  if(!state.luckyTeamTurnCount) state.luckyTeamTurnCount = [0,0];
  // Переключает исполнителя (м/ж) для этой же команды к её следующему ходу.
  state.luckyTeamTurnCount[idx] = (state.luckyTeamTurnCount[idx] || 0) + 1;
  state.luckyCurrentTeamIndex = (idx + 1) % 2;
  saveState();
  renderLuckyGrid();
}
// Собранные линии проверяются так же, как в "Секс-бинго" (checkBingoLines):
// новая линия сразу учитывается, затем — попытка повысить уровень
// (advanceLuckyStage) и проверка завершения партии (checkLuckyGameFinished).
function checkLuckyLinesAndAdvance(){
  LUCKY_LINES.forEach((line, li)=>{
    if(state.luckyWonLines.includes(li)) return;
    if(line.every(idx=>state.luckyChecked[idx])){
      state.luckyWonLines.push(li);
    }
  });
  saveState();
  advanceLuckyStage();
  checkLuckyGameFinished();
}
// После 1-й собранной линии — переход на уровень 2, после 3-й — на
// уровень 3 (точно как advanceBingoStage в "Секс-бинго").
function advanceLuckyStage(){
  const total = state.luckyWonLines.length;
  if(!state.luckyEscalatedTo2 && total >= 1){
    state.luckyEscalatedTo2 = true;
    escalateLuckyTo(2);
    saveState();
    return;
  }
  if(state.luckyEscalatedTo2 && !state.luckyEscalatedTo3 && total >= 3){
    state.luckyEscalatedTo3 = true;
    escalateLuckyTo(3);
    saveState();
    return;
  }
}
// Все ещё не отмеченные клетки заменяются заданиями нового уровня. Уже
// отмеченные клетки не трогаем — они остаются как подтверждение, что
// задание выполнено (тот же приём, что и escalateBingoTo в "Секс-бинго").
// Счастливая клетка предыдущего уровня, если её ещё не нашли, заменяется
// обычным заданием вместе со всеми остальными — и если "Скрыть задания"
// всё ещё включён, для нового уровня сразу подбирается своя свежая
// счастливая клетка (luckyEnsureLuckyCell ниже): одна штука на каждом
// уровне, а не одна на всю партию.
function escalateLuckyTo(nextLevel){
  const pool = shuffle(getLuckyTasksList(nextLevel));
  const usedTexts = new Set(state.luckyGrid);
  let p = 0;
  for(let i=0;i<25;i++){
    if(state.luckyChecked[i]) continue;
    while(p < pool.length && usedTexts.has(pool[p].text)) p++;
    const item = pool[p];
    if(item){
      state.luckyGrid[i] = item.text;
      usedTexts.add(item.text);
      p++;
    }
  }
  state.luckyLevel = nextLevel;
  if(state.luckyTasksHidden) luckyEnsureLuckyCell();
  renderLuckyGrid();
  showLuckyBonus(nextLevel);
}
// Окно повышения уровня — праздничное и чисто информационное: бонусное
// задание здесь больше не выдаётся ни разу за игру (ни после 1-й, ни после
// 3-й линии) — оно достаётся только победившей команде после финальной
// победы, в итоговом окне партии (см. showLuckySummaryModal).
function showLuckyBonus(level){
  playLevelUpSound();
  const info = luckyLevelInfo(level);
  // Ход ещё не передан следующей команде (передача — после этой функции, в
  // clickLuckyCell), поэтому luckyCurrentTeamIndex — это команда, которая
  // только что собрала линию.
  ensureLuckyTeams();
  const teamName = (state.luckyTeams[state.luckyCurrentTeamIndex || 0] || {}).name || 'Команда 1';
  const introEl = document.getElementById('luckyBonusIntro');
  if(introEl) introEl.textContent = `🏆 Линия собрана командой «${teamName}»! Уровень повышен: ${info.icon} ${info.name}`;
  const textEl = document.getElementById('luckyBonusText');
  if(textEl) textEl.textContent = 'Поздравьте друг друга аплодисментами!';
  showModal('luckyBonusModal');
}
// Партия завершается сама, как только собрано 5 любых линий или отмечены
// все 25 клеток — точно как checkBingoGameFinished в "Секс-бинго".
function checkLuckyGameFinished(){
  if(state.luckyFinished) return;
  const total = state.luckyWonLines.length;
  const allChecked = state.luckyChecked.length === 25 && state.luckyChecked.every(Boolean);
  if(total >= 5 || allChecked){
    state.luckyFinished = true;
    state.inProgress = false;
    saveState();
    showLuckySummaryModal();
  }
}
function showLuckySummaryModal(){
  hideModal('luckyBonusModal');
  ensureLuckyTeams();
  const teams = state.luckyTeams;
  const completed = state.luckyCompleted || [];
  const ranking = teams.map((t,i)=>({n:t.name, score: completed[i] || 0}))
    .sort((a,b)=>b.score-a.score);
  const medals = ['🥇','🥈'];
  const listHtml = ranking.map((r,i)=>{
    const place = medals[i] || `${i+1}.`;
    const isFirst = i === 0;
    return `
      <div class="krokodil-summary-row${isFirst ? ' krokodil-summary-first' : ''}">
        <span class="krokodil-summary-place">${place}</span>
        <span class="krokodil-summary-name">${r.n}</span>
        <span class="krokodil-summary-score">Клеток отмечено: ${r.score}</span>
      </div>
    `;
  }).join('');
  const level = state.luckyLevel || 1;
  const info = luckyLevelInfo(level);
  const total = state.luckyWonLines.length;
  const allChecked = state.luckyChecked.length === 25 && state.luckyChecked.every(Boolean);
  const introEl = document.getElementById('luckySummaryIntro');
  if(introEl) introEl.textContent = `Уровень: ${info.icon} ${info.name} · Линий собрано: ${total} из 10` + (allChecked ? ' · Отмечены все 25 клеток!' : '');
  document.getElementById('luckySummaryList').innerHTML = listHtml;
  const isTie = ranking.length === 2 && ranking[0].score === ranking[1].score;
  const winnerName = (!isTie && ranking.length === 2) ? ranking[0].n : null;
  const loserName = (!isTie && ranking.length === 2) ? ranking[1].n : null;
  // Бонусное задание больше не выдаётся во время партии (ни после 1-й, ни
  // после 3-й линии) — оно достаётся только победившей команде один раз,
  // здесь, после финальной победы. При ничьей никто его не получает.
  // Как и раньше, бонус попадает в накопительный чек-лист «🎁 Бонусные
  // задания» под картой.
  const bonusEl = document.getElementById('luckySummaryBonusText');
  if(bonusEl){
    const bonusTask = winnerName ? pickLuckyBonus(3) : null;
    if(bonusTask){
      addLuckyBonusToChecklist(bonusTask.text);
      renderLuckyBonusChecklist();
      bonusEl.textContent = `🏆 Бонусное задание команде «${winnerName}»: ` + bonusTask.text;
      bonusEl.style.display = 'block';
    } else {
      bonusEl.textContent = '';
      bonusEl.style.display = 'none';
    }
  }
  // Финальное задание проигравшей команде (меньше отмеченных клеток) —
  // весёлый форфейт перед компанией. При ничьей (оба счёта равны)
  // проигравшего нет — задание не показываем.
  const finalTaskEl = document.getElementById('luckySummaryFinalTaskText');
  if(finalTaskEl){
    const finalTask = (!isTie && loserName) ? pickLuckyFinalTask() : null;
    if(finalTask){
      finalTaskEl.textContent = `😅 Финальное задание команде «${loserName}»: ` + finalTask.text;
      finalTaskEl.style.display = 'block';
    } else {
      finalTaskEl.textContent = '';
      finalTaskEl.style.display = 'none';
    }
  }
  saveState();
  showModal('luckySummaryModal');
}
function goToLuckyGame(){
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
  abandonPausedSession('soloBs');
  state.pausedMode = null;
  // Счастливый билет использует СВОИ 2 фиксированные команды (state.luckyTeams,
  // в каждой мужчина и женщина) — заполняются на своём экране настройки
  // (renderLuckyTeams), не связаны с общим state.partyPlayers.
  ensureLuckyTeams();
  state.luckyLevel = 1;
  state.luckyUsed = {};
  state.luckyGrid = generateLuckyGrid(1);
  state.luckyChecked = new Array(25).fill(false);
  state.luckyTasksHidden = false;
  state.luckyRevealed = state.luckyGrid.map(()=>true);
  state.luckyCompleted = new Array(2).fill(0);
  state.luckyWonLines = [];
  state.luckyEscalatedTo2 = false;
  state.luckyEscalatedTo3 = false;
  state.luckyFinished = false;
  state.luckyCurrentTeamIndex = Math.floor(Math.random() * 2);
  state.luckyTeamTurnCount = [0,0];
  state.luckyPendingBonusText = '';
  // Пул "уже выпадавших в этой партии" бонусов сбрасывается на каждую новую
  // игру (как bingoUsedBonus в "Секс-бинго") — сам чек-лист "Бонусные
  // задания" (luckyBonusChecklist) при этом НЕ трогаем: он накопительный.
  state.luckyUsedBonus = [];
  state.inProgress = true;
  saveState();
  document.getElementById('luckySetup').classList.remove('active');
  goToGame(null, 'luckyGame');
  renderLuckyGrid();
  updateLuckyHideTasksBtn();
  renderLuckyBonusChecklist();
}
// Пауза: вернуться в главное меню, не сбрасывая поле и очередь — можно
// продолжить позже через общий блок "Продолжить игру" / "Закончить игру".
function pauseLuckyGame(){
  state.pausedMode = 'lucky';
  saveState();
  document.getElementById('luckyGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('companyView');
  updateResumeUI();
}
function resumeLuckyGame(){
  state.pausedMode = null;
  saveState();
  updateResumeUI();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('luckyGame').classList.add('active');
  renderLuckyGrid();
  updateLuckyHideTasksBtn();
  renderLuckyBonusChecklist();
}
// Вызывается из общего "Закончить игру" на главном экране, пока игра стоит
// на паузе — полный сброс без показа итогов (как finishKrokodilGame в
// "Крокодиле" и finishBingoGame в "Секс-бинго": итоговое окно теперь
// зарезервировано за честным завершением партии — см. checkLuckyGameFinished).
function finishLuckyGame(){
  state.luckyGrid = [];
  state.luckyChecked = [];
  state.luckyTasksHidden = false;
  state.luckyRevealed = [];
  state.luckyCompleted = [];
  state.luckyWonLines = [];
  state.luckyLevel = 1;
  state.luckyEscalatedTo2 = false;
  state.luckyEscalatedTo3 = false;
  state.luckyFinished = false;
  state.luckyCurrentTeamIndex = 0;
  state.luckyTeamTurnCount = [0,0];
  state.luckyPendingBonusText = '';
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  updateResumeUI();
}
// Полный выход из партии (по кнопке "Завершить игру" на итоговом экране,
// показанном после честного прохождения карты) — сбрасывает поле, очередь
// и уровень, возвращает на экран настройки Счастливого билета (как
// exitKrokodilGame в "Крокодиле").
function exitLuckyGame(){
  hideModal('luckySummaryModal');
  state.luckyGrid = [];
  state.luckyChecked = [];
  state.luckyCompleted = [];
  state.luckyWonLines = [];
  state.luckyLevel = 1;
  state.luckyEscalatedTo2 = false;
  state.luckyEscalatedTo3 = false;
  state.luckyFinished = false;
  state.luckyCurrentTeamIndex = 0;
  state.luckyTeamTurnCount = [0,0];
  state.luckyPendingBonusText = '';
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  document.getElementById('luckyGame').classList.remove('active');
  document.getElementById('luckySetup').classList.add('active');
}
// "Случайно" — та же подсказка, что и suggestRandomBingoCell в "Секс-бинго":
// подсвечивает контуром случайную ещё не отмеченную клетку общего поля,
// чтобы было проще выбрать следующее задание. Подсветка снимается первым
// же касанием экрана после этого (клетки используют общий класс
// .bingo-cell, поэтому CSS-подсветка .bingo-suggested работает без правок).
function suggestRandomLuckyCell(){
  if(state.luckyFinished){
    showToast('Партия уже завершена');
    return;
  }
  const candidates = (state.luckyChecked || []).map((v,i)=>v?null:i).filter(i=>i!==null);
  if(candidates.length === 0){
    showToast('Все клетки уже отмечены');
    return;
  }
  const idx = candidates[Math.floor(Math.random()*candidates.length)];
  const wrap = document.getElementById('luckyGrid');
  if(!wrap) return;
  wrap.querySelectorAll('.bingo-cell.bingo-suggested').forEach(c=>c.classList.remove('bingo-suggested'));
  const cellEl = wrap.children[idx];
  if(cellEl) cellEl.classList.add('bingo-suggested');
  playNeutralSound();
  document.addEventListener('pointerdown', function clearLuckySuggestion(){
    const w = document.getElementById('luckyGrid');
    if(w) w.querySelectorAll('.bingo-cell.bingo-suggested').forEach(c=>c.classList.remove('bingo-suggested'));
  }, {capture:true, once:true});
}
document.getElementById('luckyRandomBtn').addEventListener('click', ()=>{
  suggestRandomLuckyCell();
});
document.getElementById('luckySetupStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  goToLuckyGame();
});
document.getElementById('luckySetupExitBtn').addEventListener('click', ()=>{ exitLuckySetup(); });
function updateLuckyHideTasksBtn(){
  const btn = document.getElementById('luckyHideTasksBtn');
  if(!btn) return;
  btn.textContent = state.luckyTasksHidden ? '👀 Показать задания' : '🙈 Скрыть задания';
}
// Случайно выбирает одну ещё не отмеченную клетку и превращает её в
// счастливую (если такой на поле ещё нет) — вызывается при включении
// "Скрыть задания". Тот же приём, что bingoEnsureLuckyCell в "Секс-бинго".
function luckyEnsureLuckyCell(){
  const grid = state.luckyGrid || [];
  const hasLucky = grid.filter(t => t === LUCKY_LUCKY_TEXT).length;
  if(hasLucky >= LUCKY_LUCKY_COUNT) return;
  const candidates = [];
  grid.forEach((t,i)=>{ if(!state.luckyChecked[i] && t !== LUCKY_LUCKY_TEXT) candidates.push(i); });
  if(candidates.length === 0) return;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  state.luckyGrid[pick] = LUCKY_LUCKY_TEXT;
}
// Возвращает счастливую клетку обратно в обычное задание — вызывается при
// выключении "Скрыть задания" (тот же приём, что bingoRemoveLuckyCells).
function luckyRemoveLuckyCells(){
  const grid = state.luckyGrid || [];
  const level = state.luckyLevel || 1;
  const pool = shuffle(getLuckyTasksList(level));
  const usedTexts = new Set(grid);
  let p = 0;
  grid.forEach((t,i)=>{
    if(t !== LUCKY_LUCKY_TEXT) return;
    while(p < pool.length && usedTexts.has(pool[p].text)) p++;
    const item = pool[p];
    grid[i] = item ? item.text : '—';
    if(item){ usedTexts.add(item.text); p++; }
  });
}
document.getElementById('luckyHideTasksBtn').addEventListener('click', ()=>{
  state.luckyTasksHidden = !state.luckyTasksHidden;
  const grid = state.luckyGrid || [];
  if(state.luckyTasksHidden){
    state.luckyRevealed = grid.map(()=>false);
    luckyEnsureLuckyCell();
  } else {
    state.luckyRevealed = grid.map(()=>true);
    luckyRemoveLuckyCells();
  }
  saveState();
  updateLuckyHideTasksBtn();
  renderLuckyGrid();
  playSuccessSound();
});
document.getElementById('luckyExitBtn').addEventListener('click', ()=>{
  pauseLuckyGame();
  showToast('Игра на паузе — прогресс сохранён');
});
document.getElementById('luckyBonusAcceptBtn').addEventListener('click', ()=>{
  playSuccessSound();
  hideModal('luckyBonusModal');
});
document.getElementById('closeLuckySummaryBtn').addEventListener('click', ()=>{ exitLuckyGame(); });
(document.getElementById('luckySetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ showModal('luckyRulesModal'); });
setupRulesModal('luckyRulesModal', 'closeLuckyRulesBtn');


