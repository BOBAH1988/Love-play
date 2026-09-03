// games/fam-znayu.js — Игра "Знаю тебя" (компания, семьями).
// Загружается через <script src="games/fam-znayu.js"></script> в index.html.

/* ---------- ЗНАЮ ТЕБЯ (КОМПАНИЯ, СЕМЬЯМИ): семьи по очереди отвечают на ---------- */
// одни и те же вопросы наедине (как couples-версия "Тайные ответы"), но
// вместо истории совпадений — только число совпадений за раунд, и семьи
// соревнуются между собой. После того как отыграли все семьи — таблица
// результатов с медалями (как у "Крокодила").
const FAM_ZNAYU_ROUND_SIZE = 10;
function getFamZnayuCardsList(level){
  if(typeof FAM_ZNAYU_ITEMS === 'undefined' || !Array.isArray(FAM_ZNAYU_ITEMS)) return [];
  return FAM_ZNAYU_ITEMS.filter(it=>it.level===level);
}
// Число семей (2-5) хранится отдельно от самого массива семей — при смене
// числа массив state.famZnayuFamilies достраивается/обрезается, сохраняя
// уже введённые имена там, где это возможно.
function syncFamZnayuFamiliesArray(){
  // Диапазон количества семей — 1..3 (сужен с прежнего 2..5); если в
  // сохранённом состоянии осталось большее значение с более старой версии
  // приложения, аккуратно подрезаем его сюда же.
  let count = state.famZnayuFamilyCount == null ? 1 : state.famZnayuFamilyCount;
  count = Math.min(3, Math.max(1, count));
  state.famZnayuFamilyCount = count;
  if(!Array.isArray(state.famZnayuFamilies)) state.famZnayuFamilies = [];
  while(state.famZnayuFamilies.length < count){
    state.famZnayuFamilies.push({p1:'Игрок 1', p2:'Игрок 2', p1Gender:'m', p2Gender:'f'});
  }
  if(state.famZnayuFamilies.length > count){
    state.famZnayuFamilies = state.famZnayuFamilies.slice(0, count);
  }
}
function renderFamZnayuFamilyCountGroup(){
  document.querySelectorAll('#famZnayuFamilyCountGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', btn.dataset.value === String(state.famZnayuFamilyCount || 1));
  });
}
document.querySelectorAll('#famZnayuFamilyCountGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.famZnayuFamilyCount = parseInt(btn.dataset.value, 10);
    syncFamZnayuFamiliesArray();
    saveState();
    renderFamZnayuFamilyCountGroup();
    renderFamZnayuFamiliesFields();
  });
});
// Кнопки-переключатели пола (М/Ж) для одного игрока семьи — используются
// дважды на семью (для p1 и p2). genderKey — 'p1Gender'/'p2Gender' в объекте
// семьи; нужны для верного склонения вопроса, когда этот игрок — "герой".
function makeFamZnayuGenderToggle(fam, idx, genderKey){
  const wrap = document.createElement('div');
  wrap.className = 'fam-znayu-gender-toggle';
  ['m','f'].forEach(g=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fam-znayu-gender-btn' + ((fam[genderKey] || 'm') === g ? ' on' : '');
    btn.textContent = g === 'm' ? 'М' : 'Ж';
    btn.addEventListener('click', ()=>{
      state.famZnayuFamilies[idx][genderKey] = g;
      saveState();
      renderFamZnayuFamiliesFields();
    });
    wrap.appendChild(btn);
  });
  return wrap;
}
function renderFamZnayuFamiliesFields(){
  const wrap = document.getElementById('famZnayuFamiliesList');
  if(!wrap) return;
  wrap.innerHTML = '';
  state.famZnayuFamilies.forEach((fam, idx)=>{
    const block = document.createElement('div');
    block.className = 'fam-znayu-family-block';
    const label = document.createElement('div');
    label.className = 'fam-znayu-family-label';
    label.textContent = 'Семья ' + (idx + 1);
    block.appendChild(label);
    const row1 = document.createElement('div');
    row1.className = 'fam-znayu-family-inputs';
    const input1 = document.createElement('input');
    input1.type = 'text';
    input1.maxLength = 14;
    input1.placeholder = 'Игрок 1';
    input1.value = fam.p1 || '';
    input1.addEventListener('input', ()=>{
      state.famZnayuFamilies[idx].p1 = input1.value.trim() || 'Игрок 1';
      saveState();
    });
    row1.appendChild(input1);
    row1.appendChild(makeFamZnayuGenderToggle(fam, idx, 'p1Gender'));
    block.appendChild(row1);
    const row2 = document.createElement('div');
    row2.className = 'fam-znayu-family-inputs';
    row2.style.marginTop = '6px';
    const input2 = document.createElement('input');
    input2.type = 'text';
    input2.maxLength = 14;
    input2.placeholder = 'Игрок 2';
    input2.value = fam.p2 || '';
    input2.addEventListener('input', ()=>{
      state.famZnayuFamilies[idx].p2 = input2.value.trim() || 'Игрок 2';
      saveState();
    });
    row2.appendChild(input2);
    row2.appendChild(makeFamZnayuGenderToggle(fam, idx, 'p2Gender'));
    block.appendChild(row2);
    wrap.appendChild(block);
  });
}
function renderFamZnayuSetupLevels(){
  const wrap = document.getElementById('famZnayuSetupLevels');
  if(!wrap) return;
  wrap.innerHTML = '';
  (typeof FAM_ZNAYU_LEVELS !== 'undefined' ? FAM_ZNAYU_LEVELS : []).forEach(l=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + (state.famZnayuSelectedLevel === l.id ? ' on' : '');
    div.innerHTML = `<div class="lname">${l.icon} ${l.name}</div><div class="ldesc">${l.desc}</div><div class="level-check"></div>`;
    div.addEventListener('click', ()=>{
      state.famZnayuSelectedLevel = l.id;
      saveState();
      renderFamZnayuSetupLevels();
    });
    wrap.appendChild(div);
  });
}
function goToFamZnayuSetup(){
  goToGameSetup('famZnayuSetup', null, ()=>{
    syncFamZnayuFamiliesArray();
    renderFamZnayuFamilyCountGroup();
    renderFamZnayuFamiliesFields();
    renderFamZnayuSetupLevels();
  });
}
function exitFamZnayuSetup(){
  document.getElementById('famZnayuSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
    showSetupView('companyView');
}
// Вопросы одного раунда (для одной семьи) тянутся без повторов внутри
// уровня, пока пул не закончится — тот же принцип, что и во всех остальных
// играх приложения. Очередь хранится как массив самих объектов вопроса
// (а не индексов), потому что уровень фиксирован на весь раунд.
function drawFamZnayuFamilyQueue(){
  const level = state.famZnayuSelectedLevel || 1;
  const all = getFamZnayuCardsList(level);
  if(!state.famZnayuUsed) state.famZnayuUsed = {};
  let used = state.famZnayuUsed[level] || [];
  let pool = all.filter(it=>!used.includes(it.question));
  if(pool.length < Math.min(FAM_ZNAYU_ROUND_SIZE, all.length)){
    pool = all;
    used = [];
    showToast('Вопросы этого уровня показаны заново 🔀');
  }
  const chosen = shuffle(pool).slice(0, Math.min(FAM_ZNAYU_ROUND_SIZE, pool.length));
  chosen.forEach(it=>used.push(it.question));
  state.famZnayuUsed[level] = used;
  state.famZnayuQueue = chosen;
  state.famZnayuIndex = 0;
  state.famZnayuAnswers = {};
  // На каждый вопрос отдельно выбирается "герой" (1 или 2) — тот из пары,
  // о ком именно этот вопрос и кто отвечает как есть; второй игрок семьи
  // угадывает его ответ. Набор ролей всегда сбалансирован поровну (по 5 из
  // 10 вопросов на каждого партнёра), а порядок перемешан, так что заранее
  // не угадать, чей сейчас черёд быть героем (по просьбе: "10 вопросов в
  // раунде, по 5 партнёру").
  const heroPool = chosen.map((_, i)=> i < Math.floor(chosen.length / 2) ? 1 : 2);
  state.famZnayuHeroSide = shuffle(heroPool);
  saveState();
}
// Механическое разрешение уже написанного двугендерного текста вопроса до
// ОДНОГО пола — никакой грамматики не синтезируем, только выбираем готовую
// сторону из уже существующих в тексте конструкций:
//   "него/неё", "его/её", "он/она", "ему/ей" и т.п. → одно из двух слов;
//   "хотел(а)", "сам(а)" и т.п. → без скобок (муж.) или слово+суффикс (жен.).
function resolveFamZnayuGenderText(text, gender){
  if(!text) return text;
  const isM = gender !== 'f';
  let out = text.replace(/([А-Яа-яЁё]+)\/([А-Яа-яЁё]+)/g, (m, a, b)=> isM ? a : b);
  out = out.replace(/([А-Яа-яЁё]+)\(([а-яё]+)\)/g, (m, base, suf)=> isM ? base : base + suf);
  return out;
}
function updateFamZnayuProgressBar(){
  const fill = document.getElementById('famZnayuProgressFill');
  const label = document.getElementById('famZnayuProgressLabel');
  if(!fill || !label) return;
  const total = state.famZnayuQueue.length;
  const done = Math.min(state.famZnayuIndex, total);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  fill.style.width = pct + '%';
  label.textContent = total > 0 ? `${done} / ${total}` : `0 / ${FAM_ZNAYU_ROUND_SIZE}`;
}
function updateFamZnayuHeaderUI(){
  const total = (state.famZnayuFamilies || []).length || 2;
  const idx = state.famZnayuCurrentFamilyIndex || 0;
  const fam = state.famZnayuFamilies[idx] || {p1:'Игрок 1', p2:'Игрок 2'};
  const familyLabel = document.getElementById('famZnayuFamilyLabel');
  if(familyLabel) familyLabel.textContent = `Семья ${idx + 1} из ${total}`;
  const p1Btn = document.getElementById('famZnayuPlayer1Btn');
  const p2Btn = document.getElementById('famZnayuPlayer2Btn');
  if(p1Btn){
    p1Btn.textContent = fam.p1 || 'Игрок 1';
    p1Btn.classList.toggle('active', state.famZnayuActivePlayer === 1);
    p1Btn.classList.toggle('done', !!state.famZnayuP1Done);
  }
  if(p2Btn){
    p2Btn.textContent = fam.p2 || 'Игрок 2';
    p2Btn.classList.toggle('active', state.famZnayuActivePlayer === 2);
    p2Btn.classList.toggle('done', !!state.famZnayuP2Done);
  }
  updateFamZnayuProgressBar();
}
function showFamZnayuHandoffCard(nextPlayerNum){
  const idx = state.famZnayuCurrentFamilyIndex || 0;
  const fam = state.famZnayuFamilies[idx] || {p1:'Игрок 1', p2:'Игрок 2'};
  const nextName = nextPlayerNum === 2 ? (fam.p2 || 'Игрок 2') : (fam.p1 || 'Игрок 1');
  state.famZnayuPendingNext = nextPlayerNum;
  saveState();
  document.getElementById('famZnayuHandoffRow').style.display = 'flex';
  fadeSwapEl('famZnayuCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-icon znayu-handoff-icon">🧠</div><div class="card-text">Передайте телефон игроку «${nextName}»</div></div>`;
  });
}
function showFamZnayuCurrentItem(){
  const item = state.famZnayuQueue[state.famZnayuIndex];
  document.getElementById('famZnayuHandoffRow').style.display = 'none';
  if(!item){
    fadeSwapEl('famZnayuCard', (el)=>{
      el.className = 'card card-empty';
      el.innerHTML = `<div class="card-inner"><div class="card-icon">🧠</div><div class="card-text">Не удалось загрузить вопросы — попробуйте обновить приложение</div></div>`;
    });
    return;
  }
  const famIdx = state.famZnayuCurrentFamilyIndex || 0;
  const fam = state.famZnayuFamilies[famIdx] || {p1:'Игрок 1', p2:'Игрок 2', p1Gender:'m', p2Gender:'f'};
  const heroSide = (state.famZnayuHeroSide || [])[state.famZnayuIndex] || 1;
  const heroName = heroSide === 1 ? (fam.p1 || 'Игрок 1') : (fam.p2 || 'Игрок 2');
  const heroGender = (heroSide === 1 ? fam.p1Gender : fam.p2Gender) || (heroSide === 1 ? 'm' : 'f');
  const isHeroTurn = state.famZnayuActivePlayer === heroSide;
  const roleHtml = isHeroTurn
    ? `<div class="fam-znayu-role-label role-hero">🙋 Вопрос о тебе — отвечай как есть</div>`
    : `<div class="fam-znayu-role-label role-guess">🤔 Угадай, как ответил${heroGender === 'f' ? 'а' : ''} бы ${heroName}</div>`;
  fadeSwapEl('famZnayuCard', (el)=>{
    el.className = 'card';
    const questionHtml = `${roleHtml}<div class="znayu-question-text">${resolveFamZnayuGenderText(item.question, heroGender)}</div>`;
    const options = Array.isArray(item.options) ? item.options : [];
    const answersHtml = `<div class="znayu-answers">${options.map((opt,i)=>`<button type="button" class="btn btn-secondary znayu-answer-btn" data-idx="${i}">${resolveFamZnayuGenderText(opt, heroGender)}</button>`).join('')}</div>`;
    el.innerHTML = `<div class="card-inner"><div class="card-body">${questionHtml}</div>${answersHtml}</div>`;
    el.querySelectorAll('.znayu-answer-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        playSuccessSound();
        answerFamZnayuItem(parseInt(btn.dataset.idx, 10));
      });
    });
  });
  updateFamZnayuProgressBar();
}
function startFamZnayuPlayer(playerNum){
  if(state.famZnayuActivePlayer !== 0) return;
  if(playerNum === 1 && state.famZnayuP1Done) return;
  if(playerNum === 2 && state.famZnayuP2Done) return;
  state.famZnayuPendingNext = 0;
  state.famZnayuIndex = 0;
  state.famZnayuActivePlayer = playerNum;
  saveState();
  updateFamZnayuHeaderUI();
  showFamZnayuCurrentItem();
}
function answerFamZnayuItem(answer){
  if(!state.famZnayuActivePlayer) return;
  const idx = state.famZnayuIndex;
  if(!state.famZnayuAnswers[idx]) state.famZnayuAnswers[idx] = {};
  const key = state.famZnayuActivePlayer === 1 ? 'p1' : 'p2';
  state.famZnayuAnswers[idx][key] = answer;
  advanceFamZnayuQueue();
}
function advanceFamZnayuQueue(){
  state.famZnayuIndex++;
  if(state.famZnayuIndex < state.famZnayuQueue.length){
    saveState();
    updateFamZnayuProgressBar();
    showFamZnayuCurrentItem();
    return;
  }
  const finishedPlayer = state.famZnayuActivePlayer;
  if(finishedPlayer === 1) state.famZnayuP1Done = true; else state.famZnayuP2Done = true;
  state.famZnayuActivePlayer = 0;
  const otherDone = finishedPlayer === 1 ? state.famZnayuP2Done : state.famZnayuP1Done;
  if(!otherDone){
    const nextPlayer = finishedPlayer === 1 ? 2 : 1;
    saveState();
    updateFamZnayuHeaderUI();
    showFamZnayuHandoffCard(nextPlayer);
  } else {
    saveState();
    finishFamZnayuFamilyRound();
  }
}
// Совпадение = игрок-"угадывающий" выбрал тот же вариант, что и "герой"
// вопроса (herName в famZnayuHeroSide) — то есть верно угадал ответ героя.
// Роль героя/угадывающего меняется от вопроса к вопросу, поэтому сравнение
// p1===p2 технически не меняется (кто-то из двоих всегда хранит "правду",
// другой — "догадку" — неважно, в каком слоте), но по смыслу это теперь не
// самоотчёт, а точность угадывания. Сами ответы нигде не показываются,
// только итоговое число совпадений — как договорились в правилах игры.
function finishFamZnayuFamilyRound(){
  const idx = state.famZnayuCurrentFamilyIndex || 0;
  const fam = state.famZnayuFamilies[idx] || {p1:'Игрок 1', p2:'Игрок 2', p1Gender:'m', p2Gender:'f'};
  let matches = 0;
  const total = state.famZnayuQueue.length;
  for(let i=0;i<total;i++){
    const a = state.famZnayuAnswers[i];
    if(a && a.p1 !== undefined && a.p2 !== undefined && a.p1 === a.p2) matches++;
  }
  if(!state.famZnayuResults) state.famZnayuResults = [];
  state.famZnayuResults.push({p1: fam.p1 || 'Игрок 1', p2: fam.p2 || 'Игрок 2', matches, total});
  const familiesTotal = (state.famZnayuFamilies || []).length || 2;
  if(idx + 1 < familiesTotal){
    state.famZnayuCurrentFamilyIndex = idx + 1;
    state.famZnayuP1Done = false;
    state.famZnayuP2Done = false;
    state.famZnayuActivePlayer = 0;
    drawFamZnayuFamilyQueue();
    updateFamZnayuHeaderUI();
    showFamZnayuHandoffCard(1);
  } else {
    saveState();
    showFamZnayuSummaryModal();
  }
}
function showFamZnayuSummaryModal(){
  const results = state.famZnayuResults || [];
  const ranking = results.slice().sort((a,b)=>b.matches-a.matches);
  const medals = ['🥇','🥈','🥉'];
  const listHtml = ranking.map((r,i)=>{
    const place = medals[i] || `${i+1}.`;
    const isFirst = i === 0;
    return `
      <div class="krokodil-summary-row${isFirst ? ' krokodil-summary-first' : ''}">
        <span class="krokodil-summary-place">${place}</span>
        <span class="krokodil-summary-name">${r.p1} и ${r.p2}</span>
        <span class="krokodil-summary-score">Совпадений: ${r.matches} из ${r.total}</span>
      </div>
    `;
  }).join('');
  const introEl = document.getElementById('famZnayuSummaryIntro');
  if(introEl) introEl.textContent = 'Вот кто лучше всех знает друг друга:';
  document.getElementById('famZnayuSummaryList').innerHTML = listHtml;
  showModal('famZnayuSummaryModal');
}
function goToFamZnayuGame(){
  abandonPausedSession('davay');
  abandonPausedSession('td');
  abandonPausedSession('bingo');
  abandonPausedSession('krokodil');
  abandonPausedSession('wishlist');
  abandonPausedSession('znayu');
  abandonPausedSession('timer');
  abandonPausedSession('partyFants');
  abandonPausedSession('partyTd');
  abandonPausedSession('lucky');
  abandonPausedSession('fanty');
  abandonPausedSession('soloBs');
  state.pausedMode = null;
  syncFamZnayuFamiliesArray();
  state.famZnayuCurrentFamilyIndex = 0;
  state.famZnayuResults = [];
  state.famZnayuP1Done = false;
  state.famZnayuP2Done = false;
  state.famZnayuActivePlayer = 0;
  drawFamZnayuFamilyQueue();
  state.inProgress = true;
  saveState();
  document.getElementById('famZnayuSetup').classList.remove('active');
  goToGame(null, 'famZnayuGame');
  updateFamZnayuHeaderUI();
  showFamZnayuHandoffCard(1);
}
// Пауза: вернуться в главное меню, не сбрасывая результаты уже сыгравших
// семей — можно продолжить позже через общий блок "Продолжить игру" /
// "Закончить игру".
function pauseFamZnayuGame(){
  state.pausedMode = 'famZnayu';
  saveState();
  document.getElementById('famZnayuGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('companyView');
  updateResumeUI();
}
function resumeFamZnayuGame(){
  state.pausedMode = null;
  saveState();
  updateResumeUI();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('famZnayuGame').classList.add('active');
  updateFamZnayuHeaderUI();
  if(state.famZnayuActivePlayer){
    showFamZnayuCurrentItem();
  } else if(state.famZnayuPendingNext){
    showFamZnayuHandoffCard(state.famZnayuPendingNext);
  } else {
    showFamZnayuHandoffCard(state.famZnayuP1Done ? 2 : 1);
  }
}
// Вызывается из общего "Закончить игру" на главном экране, пока игра стоит
// на паузе — полный сброс без показа итогов (в отличие от exitFamZnayuGame,
// которая закрывает уже показанное окно результатов после честной партии).
function finishFamZnayuGame(){
  state.famZnayuCurrentFamilyIndex = 0;
  state.famZnayuQueue = [];
  state.famZnayuIndex = 0;
  state.famZnayuAnswers = {};
  state.famZnayuHeroSide = [];
  state.famZnayuActivePlayer = 0;
  state.famZnayuP1Done = false;
  state.famZnayuP2Done = false;
  state.famZnayuResults = [];
  state.famZnayuPendingNext = 0;
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  updateResumeUI();
}
function exitFamZnayuGame(){
  hideModal('famZnayuSummaryModal');
  finishFamZnayuGame();
  exitGame('famZnayuGame', 'famZnayuSetup');
}
document.getElementById('famZnayuSetupStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  goToFamZnayuGame();
});
document.getElementById('famZnayuSetupExitBtn').addEventListener('click', ()=>{ exitFamZnayuSetup(); });
document.getElementById('famZnayuPlayer1Btn').addEventListener('click', ()=>{ startFamZnayuPlayer(1); });
document.getElementById('famZnayuPlayer2Btn').addEventListener('click', ()=>{ startFamZnayuPlayer(2); });
document.getElementById('famZnayuHandoffStartBtn').addEventListener('click', ()=>{
  const next = state.famZnayuPendingNext || 1;
  state.famZnayuPendingNext = 0;
  saveState();
  startFamZnayuPlayer(next);
});
document.getElementById('famZnayuExitBtn').addEventListener('click', ()=>{
  pauseFamZnayuGame();
  showToast('Игра на паузе — прогресс сохранён');
});
document.getElementById('closeFamZnayuSummaryBtn').addEventListener('click', ()=>{ exitFamZnayuGame(); });
(document.getElementById('famZnayuSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ showModal('famZnayuRulesModal'); });
setupRulesModal('famZnayuRulesModal', 'closeFamZnayuRulesBtn');


