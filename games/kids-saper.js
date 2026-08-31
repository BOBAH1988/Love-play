// games/kids-saper.js — Игра "Сапёр" (дети): механика «Счастливого билета»
// с карточками заданий из KIDS_SAPER_ITEMS/KIDS_SAPER_BONUS.
// Загружается через <script src="games/kids-saper.js"></script> в index.html.
const KIDS_SAPER_LINES = [
  [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
  [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24]
];
const KIDS_SAPER_LUCKY_TEXT = 'Вам повезло — пропустите ход!';
const KIDS_SAPER_LUCKY_COUNT = 3;
function getKidsSaperLevelById(id){
  if(typeof KIDS_SAPER_LEVELS === 'undefined' || !Array.isArray(KIDS_SAPER_LEVELS)) return null;
  return KIDS_SAPER_LEVELS.find(l=>l.id === id) || null;
}
function getKidsSaperItemsList(level){
  if(typeof KIDS_SAPER_ITEMS === 'undefined' || !Array.isArray(KIDS_SAPER_ITEMS)) return [];
  return KIDS_SAPER_ITEMS.filter(i=>i.level===level);
}
function getKidsSaperBonusList(level){
  if(typeof KIDS_SAPER_BONUS === 'undefined' || !Array.isArray(KIDS_SAPER_BONUS)) return [];
  return KIDS_SAPER_BONUS.filter(i=>i.level===level);
}
function pickKidsSaperBonus(level){
  const list = getKidsSaperBonusList(level);
  if(!state.kidsSaperUsedBonus) state.kidsSaperUsedBonus = [];
  let available = list.filter(b=>!state.kidsSaperUsedBonus.includes(b.text));
  if(available.length === 0){
    state.kidsSaperUsedBonus = [];
    available = list;
  }
  const bonus = available.length ? available[Math.floor(Math.random()*available.length)] : null;
  if(bonus) state.kidsSaperUsedBonus.push(bonus.text);
  return bonus;
}
function addKidsSaperBonusToChecklist(text){
  if(!text) return;
  if(!state.kidsSaperBonusChecklist) state.kidsSaperBonusChecklist = [];
  const alreadyPending = state.kidsSaperBonusChecklist.some(it => it.text === text && !it.done);
  if(alreadyPending) return;
  state.kidsSaperBonusChecklist.push({text, done:false});
}
function renderKidsSaperBonusChecklist(){
  const block = document.getElementById('kidsSaperBonusChecklistBlock');
  const list = document.getElementById('kidsSaperBonusChecklistList');
  if(!block || !list) return;
  const items = state.kidsSaperBonusChecklist || [];
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
      const item = state.kidsSaperBonusChecklist[idx];
      if(!item) return;
      item.done = !item.done;
      saveState();
      renderKidsSaperBonusChecklist();
    });
  });
  list.querySelectorAll('.bingo-bonus-checklist-delete').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const idx = parseInt(btn.dataset.idx, 10);
      state.kidsSaperBonusChecklist.splice(idx, 1);
      saveState();
      renderKidsSaperBonusChecklist();
    });
  });
}
function ensureKidsSaperTeams(){
  if(!Array.isArray(state.partyPlayers) || state.partyPlayers.length < 2){
    state.partyPlayers = ['Игрок 1','Игрок 2'];
  }
}
function kidsSaperTeamName(i){
  return state.partyPlayers[i] || ('Команда ' + (i+1));
}
function kidsSaperCurrentActor(idx){
  const turnCount = (state.kidsSaperTeamTurnCount || [0,0])[idx] || 0;
  const actorIsM = turnCount % 2 === 0;
  return { actorName: kidsSaperTeamName(idx), actorIsM };
}
function generateKidsSaperGrid(level){
  const all = getKidsSaperItemsList(level);
  if(all.length === 0) return [];
  if(!state.kidsSaperUsed) state.kidsSaperUsed = {};
  let used = state.kidsSaperUsed[level] || [];
  let pool = all.filter(c=>!used.includes(c.text));
  if(pool.length < 25){
    pool = all;
    used = [];
    showToast('Задания этого уровня показаны заново 🔀');
  }
  const picked = shuffle(pool).slice(0, Math.min(25, pool.length));
  state.kidsSaperUsed[level] = used.concat(picked.map(c=>c.text));
  return picked.map(c=>({text:c.text, green:false}));
}
function updateKidsSaperScoreUI(){
  const completed = state.kidsSaperCompleted || [];
  const idx = state.kidsSaperCurrentTeamIndex || 0;
  const wrap = document.getElementById('kidsSaperScoreRow');
  if(wrap){
    wrap.innerHTML = '';
    [0,1].forEach(i=>{
      const span = document.createElement('span');
      span.className = 'krokodil-score-item' + (i === idx ? ' active' : '');
      span.textContent = kidsSaperTeamName(i) + ': ' + (completed[i] || 0);
      wrap.appendChild(span);
    });
  }
  const teamName = kidsSaperTeamName(idx);
  const actor = kidsSaperCurrentActor(idx);
  const turnLabel = document.getElementById('kidsSaperTurnLabel');
  if(turnLabel) turnLabel.textContent = `Ходит: ${teamName}`;
  const level = state.kidsSaperLevel || 1;
  const info = getKidsSaperLevelById(level);
  const linesTotal = (state.kidsSaperWonLines || []).length;
  const levelLabel = document.getElementById('kidsSaperLevelLabel');
  if(levelLabel) levelLabel.textContent = `Уровень: ${info ? info.icon + ' ' + info.name : ''} · Линий: ${linesTotal}/10`;
}
function fitKidsSaperCellText(cell){
  let size = 9.5;
  cell.style.fontSize = size + 'px';
  while(cell.scrollHeight > cell.clientHeight + 1 && size > 6.5){
    size -= 0.5;
    cell.style.fontSize = size + 'px';
  }
}
function renderKidsSaperGrid(){
  const wrap = document.getElementById('kidsSaperGrid');
  if(!wrap) return;
  wrap.innerHTML = '';
  const grid = state.kidsSaperGrid || [];
  const checked = state.kidsSaperChecked || [];
  if(!state.kidsSaperRevealed) state.kidsSaperRevealed = grid.map(()=>true);
  const actor = kidsSaperCurrentActor(state.kidsSaperCurrentTeamIndex || 0);
  grid.forEach((cell, i)=>{
    const isLucky = cell.green;
    const isHidden = !checked[i] && (isLucky || (!!state.kidsSaperTasksHidden && !state.kidsSaperRevealed[i]));
    const cellEl = document.createElement('div');
    cellEl.className = 'bingo-cell' + (checked[i] ? ' checked' : '') + (isHidden ? ' hidden' : '') + (checked[i] && isLucky ? ' bingo-lucky' : '') + (checked[i] && !isLucky ? ' kids-saper-task' : '');
    cellEl.textContent = isHidden ? '🎁' : cell.text;
    if(!checked[i] && !state.kidsSaperFinished) cellEl.addEventListener('click', ()=>clickKidsSaperCell(i));
    wrap.appendChild(cellEl);
    if(!isHidden) fitKidsSaperCellText(cellEl);
  });
  updateKidsSaperScoreUI();
  updateKidsSaperHideTasksBtn();
}
function clickKidsSaperCell(i){
  if(state.kidsSaperFinished) return;
  const checked = state.kidsSaperChecked || (state.kidsSaperChecked = new Array(25).fill(false));
  if(checked[i]) return;
  if(!state.kidsSaperRevealed) state.kidsSaperRevealed = (state.kidsSaperGrid || []).map(()=>true);
  state.kidsSaperRevealed[i] = true;
  playSuccessSound();
  checked[i] = true;
  const idx = state.kidsSaperCurrentTeamIndex || 0;
  if(!state.kidsSaperCompleted) state.kidsSaperCompleted = [];
  state.kidsSaperCompleted[idx] = (state.kidsSaperCompleted[idx] || 0) + 1;
  saveState();
  renderKidsSaperGrid();
  checkKidsSaperLinesAndAdvance();
  if(state.kidsSaperFinished) return;
  passKidsSaperTurn();
}
function passKidsSaperTurn(){
  const idx = state.kidsSaperCurrentTeamIndex || 0;
  if(!state.kidsSaperTeamTurnCount) state.kidsSaperTeamTurnCount = [0,0];
  state.kidsSaperTeamTurnCount[idx] = (state.kidsSaperTeamTurnCount[idx] || 0) + 1;
  state.kidsSaperCurrentTeamIndex = (idx + 1) % 2;
  saveState();
  renderKidsSaperGrid();
}
function checkKidsSaperLinesAndAdvance(){
  KIDS_SAPER_LINES.forEach((line, li)=>{
    if(state.kidsSaperWonLines.includes(li)) return;
    if(line.every(idx=>state.kidsSaperChecked[idx])){
      state.kidsSaperWonLines.push(li);
    }
  });
  saveState();
  advanceKidsSaperStage();
  checkKidsSaperGameFinished();
}
function advanceKidsSaperStage(){
  const total = state.kidsSaperWonLines.length;
  if(!state.kidsSaperEscalatedTo2 && total >= 1){
    state.kidsSaperEscalatedTo2 = true;
    escalateKidsSaperTo(2);
    saveState();
    return;
  }
  if(state.kidsSaperEscalatedTo2 && !state.kidsSaperEscalatedTo3 && total >= 3){
    state.kidsSaperEscalatedTo3 = true;
    escalateKidsSaperTo(3);
    saveState();
    return;
  }
}
function escalateKidsSaperTo(nextLevel){
  const pool = shuffle(getKidsSaperItemsList(nextLevel));
  if(pool.length === 0) return;
  const usedTexts = new Set(state.kidsSaperGrid.map(c=>c.text));
  let p = 0;
  for(let i=0;i<25;i++){
    if(state.kidsSaperChecked[i]) continue;
    while(p < pool.length && usedTexts.has(pool[p].text)) p++;
    const item = pool[p];
    if(item){
      state.kidsSaperGrid[i] = {text: item.text, green: false};
      usedTexts.add(item.text);
      p++;
    }
  }
  state.kidsSaperLevel = nextLevel;
  if(state.kidsSaperTasksHidden) kidsSaperEnsureLuckyCell();
  renderKidsSaperGrid();
  showKidsSaperBonus(nextLevel);
  const info = getKidsSaperLevelById(nextLevel);
  showToast(`Уровень повышен: ${info ? info.icon + ' ' + info.name : nextLevel}! Задания обновлены 🔀`);
}
function showKidsSaperBonus(level){
  playLevelUpSound();
  const info = getKidsSaperLevelById(level);
  ensureKidsSaperTeams();
  const teamName = kidsSaperTeamName(state.kidsSaperCurrentTeamIndex || 0);
  const introEl = document.getElementById('kidsSaperBonusIntro');
  if(introEl) introEl.textContent = `🏆 Линия собрана командой «${teamName}»! Уровень повышен: ${info ? info.icon + ' ' + info.name : ''}`;
  const textEl = document.getElementById('kidsSaperBonusText');
  if(textEl) textEl.textContent = 'Поздравьте друг друга аплодисментами!';
  showModal('kidsSaperBonusModal');
}
function checkKidsSaperGameFinished(){
  if(state.kidsSaperFinished) return;
  const allChecked = state.kidsSaperChecked.length === 25 && state.kidsSaperChecked.every(Boolean);
  if(allChecked){
    state.kidsSaperFinished = true;
    state.inProgress = false;
    saveState();
    showKidsSaperSummaryModal();
  }
}
function showKidsSaperSummaryModal(){
  hideModal('kidsSaperBonusModal');
  ensureKidsSaperTeams();
  const completed = state.kidsSaperCompleted || [];
  const ranking = [0,1].map(i=>({n: kidsSaperTeamName(i), score: completed[i] || 0})).sort((a,b)=>b.score-a.score);
  const medals = ['🥇','🥈'];
  const listHtml = ranking.map((r,i)=>{
    const place = medals[i] || `${i+1}.`;
    const isFirst = i === 0;
    return `<div class="krokodil-summary-row${isFirst ? ' krokodil-summary-first' : ''}"><span class="krokodil-summary-place">${place}</span><span class="krokodil-summary-name">${r.n}</span><span class="krokodil-summary-score">Клеток отмечено: ${r.score}</span></div>`;
  }).join('');
  const level = state.kidsSaperLevel || 1;
  const info = getKidsSaperLevelById(level);
  const total = state.kidsSaperWonLines.length;
  const allChecked = state.kidsSaperChecked.length === 25 && state.kidsSaperChecked.every(Boolean);
  const introEl = document.getElementById('kidsSaperSummaryIntro');
  if(introEl) introEl.textContent = `Уровень: ${info ? info.icon + ' ' + info.name : ''} · Линий собрано: ${total} из 10` + (allChecked ? ' · Отмечены все 25 клеток!' : '');
  document.getElementById('kidsSaperSummaryList').innerHTML = listHtml;
  const isTie = ranking.length === 2 && ranking[0].score === ranking[1].score;
  const winnerName = (!isTie && ranking.length === 2) ? ranking[0].n : null;
  const loserName = (!isTie && ranking.length === 2) ? ranking[1].n : null;
  const bonusEl = document.getElementById('kidsSaperSummaryBonusText');
  if(bonusEl){
    const bonusTask = winnerName ? pickKidsSaperBonus(3) : null;
    if(bonusTask){
      addKidsSaperBonusToChecklist(bonusTask.text);
      renderKidsSaperBonusChecklist();
      bonusEl.textContent = `🏆 Бонусное задание команде «${winnerName}»: ` + bonusTask.text;
      bonusEl.style.display = 'block';
    } else {
      bonusEl.textContent = '';
      bonusEl.style.display = 'none';
    }
  }
  const finalTaskEl = document.getElementById('kidsSaperSummaryFinalTaskText');
  if(finalTaskEl){
    const finalTask = (!isTie && loserName) ? pickKidsSaperFinalTask() : null;
    if(finalTask){
      finalTaskEl.textContent = `😅 Финальное задание команде «${loserName}»: ` + finalTask.text;
      finalTaskEl.style.display = 'block';
    } else {
      finalTaskEl.textContent = '';
      finalTaskEl.style.display = 'none';
    }
  }
  saveState();
  showModal('kidsSaperSummaryModal');
}
function pickKidsSaperFinalTask(){
  if(typeof KIDS_SAPER_FINAL === 'undefined' || !Array.isArray(KIDS_SAPER_FINAL) || KIDS_SAPER_FINAL.length === 0) return null;
  return KIDS_SAPER_FINAL[Math.floor(Math.random()*KIDS_SAPER_FINAL.length)];
}
function kidsSaperEnsureLuckyCell(){
  const grid = state.kidsSaperGrid || [];
  const hasLucky = grid.filter(c => c.green).length;
  const need = KIDS_SAPER_LUCKY_COUNT - hasLucky;
  if(need <= 0) return;
  const candidates = [];
  grid.forEach((c,i)=>{ if(!state.kidsSaperChecked[i] && !c.green) candidates.push(i); });
  const shuffled = shuffle(candidates);
  for(let i = 0; i < Math.min(need, shuffled.length); i++){
    state.kidsSaperGrid[shuffled[i]] = {text: KIDS_SAPER_LUCKY_TEXT, green: true};
  }
}
function kidsSaperRemoveLuckyCells(){
  const grid = state.kidsSaperGrid || [];
  const level = state.kidsSaperLevel || 1;
  const pool = shuffle(getKidsSaperItemsList(level));
  const usedTexts = new Set(grid.map(c=>c.text));
  let p = 0;
  grid.forEach((c,i)=>{
    if(!c.green) return;
    while(p < pool.length && usedTexts.has(pool[p].text)) p++;
    const item = pool[p];
    grid[i] = item ? {text: item.text, green: false} : {text: '—', green: false};
    if(item){ usedTexts.add(item.text); p++; }
  });
}
function suggestRandomKidsSaperCell(){
  if(state.kidsSaperFinished){
    showToast('Партия уже завершена');
    return;
  }
  const candidates = (state.kidsSaperChecked || []).map((v,i)=>v?null:i).filter(i=>i!==null);
  if(candidates.length === 0){
    showToast('Все клетки уже отмечены');
    return;
  }
  const idx = candidates[Math.floor(Math.random()*candidates.length)];
  const wrap = document.getElementById('kidsSaperGrid');
  if(!wrap) return;
  wrap.querySelectorAll('.bingo-cell.bingo-suggested').forEach(c=>c.classList.remove('bingo-suggested'));
  const cellEl = wrap.children[idx];
  if(cellEl) cellEl.classList.add('bingo-suggested');
  playNeutralSound();
  document.addEventListener('pointerdown', function clearSuggestion(){
    const w = document.getElementById('kidsSaperGrid');
    if(w) w.querySelectorAll('.bingo-cell.bingo-suggested').forEach(c=>c.classList.remove('bingo-suggested'));
  }, {capture:true, once:true});
}
function goToKidsSaperSetup(){
  goToGameSetup('kidsSaperSetup');
}
function exitKidsSaperSetup(){
  document.getElementById('kidsSaperSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('kidsView');
}
function goToKidsSaperGame(){
  ensureKidsSaperTeams();
  state.kidsSaperLevel = 1;
  state.kidsSaperUsed = {};
  state.kidsSaperGrid = generateKidsSaperGrid(1);
  state.kidsSaperChecked = new Array(25).fill(false);
  state.kidsSaperTasksHidden = true;
  state.kidsSaperRevealed = state.kidsSaperGrid.map(()=>false);
  kidsSaperEnsureLuckyCell();
  state.kidsSaperCompleted = new Array(2).fill(0);
  state.kidsSaperWonLines = [];
  state.kidsSaperEscalatedTo2 = false;
  state.kidsSaperEscalatedTo3 = false;
  state.kidsSaperFinished = false;
  state.kidsSaperCurrentTeamIndex = Math.floor(Math.random() * 2);
  state.kidsSaperTeamTurnCount = [0,0];
  state.kidsSaperUsedBonus = [];
  state.inProgress = true;
  saveState();
  document.getElementById('kidsSaperSetup').classList.remove('active');
  goToGame(null, 'kidsSaperGame');
  renderKidsSaperGrid();
  updateKidsSaperHideTasksBtn();
  renderKidsSaperBonusChecklist();
  requestWakeLock();
}
function pauseKidsSaperGame(){
  state.pausedMode = 'kidsSaper';
  saveState();
  document.getElementById('kidsSaperGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('kidsView');
  updateResumeUI();
}
function resumeKidsSaperGame(){
  state.pausedMode = null;
  saveState();
  updateResumeUI();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('kidsSaperGame').classList.add('active');
  renderKidsSaperGrid();
  updateKidsSaperHideTasksBtn();
  renderKidsSaperBonusChecklist();
  requestWakeLock();
}
function finishKidsSaperGame(){
  state.kidsSaperGrid = [];
  state.kidsSaperChecked = [];
  state.kidsSaperTasksHidden = false;
  state.kidsSaperRevealed = [];
  state.kidsSaperCompleted = [];
  state.kidsSaperWonLines = [];
  state.kidsSaperLevel = 1;
  state.kidsSaperEscalatedTo2 = false;
  state.kidsSaperEscalatedTo3 = false;
  state.kidsSaperFinished = false;
  state.kidsSaperCurrentTeamIndex = 0;
  state.kidsSaperTeamTurnCount = [0,0];
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  updateResumeUI();
}
function exitKidsSaperGame(){
  hideModal('kidsSaperSummaryModal');
  state.kidsSaperGrid = [];
  state.kidsSaperChecked = [];
  state.kidsSaperCompleted = [];
  state.kidsSaperWonLines = [];
  state.kidsSaperLevel = 1;
  state.kidsSaperEscalatedTo2 = false;
  state.kidsSaperEscalatedTo3 = false;
  state.kidsSaperFinished = false;
  state.kidsSaperCurrentTeamIndex = 0;
  state.kidsSaperTeamTurnCount = [0,0];
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  exitGame('kidsSaperGame', 'kidsSaperSetup');
}
function updateKidsSaperHideTasksBtn(){
  const btn = document.getElementById('kidsSaperHideTasksBtn');
  if(!btn) return;
  btn.textContent = state.kidsSaperTasksHidden ? '👀 Показать задания' : '🙈 Скрыть задания';
}
document.getElementById('kidsSaperSetupStartBtn').addEventListener('click', ()=>{ playSuccessSound(); goToKidsSaperGame(); });
document.getElementById('kidsSaperSetupExitBtn').addEventListener('click', ()=>{ exitKidsSaperSetup(); });
(document.getElementById('kidsSaperSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ showModal('kidsSaperRulesModal'); });
document.getElementById('kidsSaperRandomBtn').addEventListener('click', ()=>{ suggestRandomKidsSaperCell(); });
document.getElementById('kidsSaperHideTasksBtn').addEventListener('click', ()=>{
  state.kidsSaperTasksHidden = !state.kidsSaperTasksHidden;
  const grid = state.kidsSaperGrid || [];
  if(state.kidsSaperTasksHidden){
    state.kidsSaperRevealed = grid.map(()=>false);
    kidsSaperEnsureLuckyCell();
  } else {
    state.kidsSaperRevealed = grid.map(()=>true);
    kidsSaperRemoveLuckyCells();
  }
  saveState();
  updateKidsSaperHideTasksBtn();
  renderKidsSaperGrid();
  playSuccessSound();
});
document.getElementById('kidsSaperMoreBtn').addEventListener('click', ()=>{
  const row = document.getElementById('kidsSaperExtraRow');
  if(!row) return;
  const expanded = row.style.display !== 'none';
  row.style.display = expanded ? 'none' : '';
  const btn = document.getElementById('kidsSaperMoreBtn');
  if(btn){ btn.setAttribute('aria-expanded', String(!expanded)); }
});
document.getElementById('kidsSaperExitBtn').addEventListener('click', ()=>{
  pauseKidsSaperGame();
  showToast('Игра на паузе — прогресс сохранён');
});
document.getElementById('kidsSaperBonusAcceptBtn').addEventListener('click', ()=>{
  playSuccessSound();
  hideModal('kidsSaperBonusModal');
});
document.getElementById('closeKidsSaperSummaryBtn').addEventListener('click', ()=>{ exitKidsSaperGame(); });
document.getElementById('kidsSaperRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'kidsSaperRulesModal') e.currentTarget.classList.remove('show'); });
