// games/business-observer.js — игра «Оцени бизнес» (раздел «Бизнес игры»).
// Загружается через <script src="games/business-observer.js"></script> в index.html.
// Тренажёр по Уровню 2 «Наблюдатель» (см. Learning Steps/Step 2.md): каждая
// карточка — случайно сгенерированный бизнес (кофейня, шаурмичная, магазин
// одежды и т.п.) с ценой, себестоимостью, постоянными расходами в месяц и
// объёмом продаж, и один из 4 вопросов на него:
//   - маржинальность — (Цена − Себестоимость) / Цена × 100%
//   - наценка — Цена / Себестоимость
//   - точка безубыточности — Постоянные расходы / Маржа с 1 шт.
//   - прибыль (или убыток) за месяц — Маржа с 1 шт. × Продано − Постоянные расходы
// Числа каждый раз новые (не банк готовых вопросов), поэтому нельзя выучить
// ответы — только сами формулы. Игроки берутся из общего списка "businessPlayers"
// (уже собран на экране выбора игры) и отвечают по очереди, как в games/quiz.js,
// только без таймера — это тренажёр на понимание, а не на скорость.

const BIZ_OBS_TYPES = [
  { icon:'☕', name:'Кофейня', priceMin:120, priceMax:220, costMin:0.25, costMax:0.4, fixedMin:60000, fixedMax:140000 },
  { icon:'🌯', name:'Шаурмичная', priceMin:250, priceMax:350, costMin:0.3, costMax:0.45, fixedMin:80000, fixedMax:150000 },
  { icon:'👗', name:'Интернет-магазин одежды', priceMin:1500, priceMax:4000, costMin:0.3, costMax:0.5, fixedMin:150000, fixedMax:300000 },
  { icon:'🍦', name:'Киоск мороженого', priceMin:80, priceMax:150, costMin:0.25, costMax:0.4, fixedMin:40000, fixedMax:90000 },
  { icon:'📱', name:'Ремонт телефонов', priceMin:1500, priceMax:3500, costMin:0.2, costMax:0.35, fixedMin:70000, fixedMax:130000 },
  { icon:'🚗', name:'Автомойка', priceMin:400, priceMax:900, costMin:0.15, costMax:0.3, fixedMin:100000, fixedMax:200000 },
  { icon:'💇', name:'Парикмахерская', priceMin:800, priceMax:2000, costMin:0.1, costMax:0.25, fixedMin:90000, fixedMax:180000 },
  { icon:'🍕', name:'Пиццерия навынос', priceMin:350, priceMax:700, costMin:0.3, costMax:0.45, fixedMin:120000, fixedMax:250000 },
];

let bizObsAnswered = false;

function bizObsPlayersList(){
  return (state.businessPlayers && state.businessPlayers.length >= 2) ? state.businessPlayers : ['Игрок 1','Игрок 2'];
}
function bizObsFmtMoney(n){
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '−' : '';
  return sign + Math.abs(rounded).toLocaleString('ru-RU') + ' ₽';
}
function bizObsRandInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }
// Округляем к "красивому" шагу в зависимости от масштаба числа — так сценарии
// выглядят как реальные ценники, а не случайный мусор вроде "137 ₽".
function bizObsRoundNice(n){
  if(n >= 10000) return Math.round(n/500)*500;
  if(n >= 1000) return Math.round(n/50)*50;
  if(n >= 100) return Math.round(n/10)*10;
  return Math.max(5, Math.round(n/5)*5);
}

/* ============ ГЕНЕРАЦИЯ СЛУЧАЙНОГО БИЗНЕСА ============ */
function bizObsGenerateScenario(){
  const type = BIZ_OBS_TYPES[bizObsRandInt(0, BIZ_OBS_TYPES.length-1)];
  const price = bizObsRoundNice(bizObsRandInt(type.priceMin, type.priceMax));
  const costRatio = type.costMin + Math.random()*(type.costMax-type.costMin);
  let cost = bizObsRoundNice(price*costRatio);
  if(cost >= price) cost = Math.max(5, price - bizObsRoundNice(price*0.15));
  const fixedMonthly = bizObsRoundNice(bizObsRandInt(type.fixedMin, type.fixedMax));
  const margin = price - cost;
  const breakEvenMonthly = Math.ceil(fixedMonthly / margin);
  // Продажи — случайно то выше, то ниже точки безубыточности (0.6×..1.6×),
  // чтобы вопрос про прибыль честно иногда давал убыток — это тоже урок.
  const salesFactor = 0.6 + Math.random()*1.0;
  const salesMonthly = Math.max(1, bizObsRoundNice(Math.round(breakEvenMonthly*salesFactor)));
  return { icon:type.icon, name:type.name, price, cost, fixedMonthly, salesMonthly, margin, breakEvenMonthly };
}
function bizObsMetrics(s){
  const marginalityPct = Math.round(s.margin/s.price*100);
  const markup = Math.round((s.price/s.cost)*100)/100;
  const profitMonthly = s.margin*s.salesMonthly - s.fixedMonthly;
  return { marginalityPct, markup, profitMonthly };
}

/* ============ ФОРМАТИРОВАНИЕ ВАРИАНТОВ ОТВЕТА ============ */
function bizObsFmtPct(v){ return Math.round(v) + '%'; }
function bizObsFmtMarkup(v){
  const str = (Math.round(v*100)/100).toFixed(2).replace(/0+$/,'').replace(/\.$/,'').replace('.', ',');
  return 'в ' + str + ' раза';
}
function bizObsFmtUnits(v){ return Math.max(1, Math.round(v)) + ' шт/мес'; }
function bizObsFmtProfit(v){
  const rounded = Math.round(v);
  return (rounded >= 0 ? 'Прибыль ' : 'Убыток ') + bizObsFmtMoney(Math.abs(rounded));
}
// Строит 4 варианта ответа из правильного значения и "сырых" неверных —
// неверные подгоняются под формат правильного (formatFn), а при совпадении
// формулировок сдвигаются, пока не станут различимы визуально.
function bizObsBuildOptions(correctValue, wrongValues, formatFn){
  const labels = [formatFn(correctValue)];
  const nudgeStep = Math.abs(correctValue) * 0.08 + 1;
  wrongValues.forEach(raw=>{
    let v = raw;
    let guard = 0;
    let label = formatFn(v);
    while(labels.includes(label) && guard < 25){
      v = v + (guard % 2 === 0 ? 1 : -1) * nudgeStep * (Math.floor(guard/2)+1);
      label = formatFn(v);
      guard++;
    }
    labels.push(label);
  });
  const objs = labels.map((label, i)=>({ label, correct: i === 0 }));
  return shuffle(objs);
}

/* ============ ГЕНЕРАЦИЯ ВОПРОСА ============ */
const BIZ_OBS_QUESTION_TYPES = ['margin','markup','breakeven','profit'];
function bizObsBuildQuestion(){
  const s = bizObsGenerateScenario();
  const m = bizObsMetrics(s);
  const qType = BIZ_OBS_QUESTION_TYPES[bizObsRandInt(0, BIZ_OBS_QUESTION_TYPES.length-1)];
  let questionText, options;
  if(qType === 'margin'){
    questionText = 'Какая маржинальность?';
    options = bizObsBuildOptions(m.marginalityPct, [
      Math.round(s.cost/s.price*100),           // перепутали местами цену и себестоимость
      Math.round((s.price/s.cost)*100),         // наценку приняли за маржинальность
      m.marginalityPct + (Math.random()<0.5?-1:1)*bizObsRandInt(10,25),
    ], bizObsFmtPct);
  } else if(qType === 'markup'){
    questionText = 'Какая наценка?';
    options = bizObsBuildOptions(m.markup, [
      Math.round((s.margin/s.price)*100)/100,   // маржинальность приняли за наценку
      Math.round((s.cost/s.price)*100)/100,     // перевёрнутая формула
      Math.max(1.05, m.markup + (Math.random()<0.5?-1:1)*(0.3+Math.random()*0.7)),
    ], bizObsFmtMarkup);
  } else if(qType === 'breakeven'){
    questionText = 'Точка безубыточности — сколько нужно продать в месяц, чтобы выйти в ноль?';
    options = bizObsBuildOptions(s.breakEvenMonthly, [
      Math.ceil(s.fixedMonthly / s.price),      // забыли вычесть себестоимость
      Math.max(1, Math.round(s.breakEvenMonthly/2)),
      Math.round(s.breakEvenMonthly*1.6),
    ], bizObsFmtUnits);
  } else {
    questionText = `Продали ${s.salesMonthly} шт/мес. Какая прибыль (или убыток) за месяц?`;
    options = bizObsBuildOptions(m.profitMonthly, [
      s.margin*s.salesMonthly,                  // забыли вычесть постоянные расходы
      -m.profitMonthly,                          // перепутали знак (прибыль/убыток)
      m.profitMonthly + (Math.random()<0.5?-1:1)*Math.round(s.fixedMonthly*0.3),
    ], bizObsFmtProfit);
  }
  return { scenario: s, questionText, options };
}
function bizObsGenerateQueue(count){
  const arr = [];
  for(let i=0;i<count;i++) arr.push(bizObsBuildQuestion());
  return arr;
}

/* ============ НАСТРОЙКА ============ */
function renderBizObsQuestionCountGroup(){
  if(![3,5,7,10].includes(state.bizObsQuestionCount)){ state.bizObsQuestionCount = 5; saveState(); }
  document.querySelectorAll('#bizObsQuestionCountGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (state.bizObsQuestionCount || 5));
  });
}
document.querySelectorAll('#bizObsQuestionCountGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.bizObsQuestionCount = parseInt(btn.dataset.value, 10);
    saveState();
    renderBizObsQuestionCountGroup();
  });
});
function goToBizObsSetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('bizObsSetup').classList.add('active');
  renderBizObsQuestionCountGroup();
}
function exitBizObsSetup(){
  document.getElementById('bizObsSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}

/* ============ ХОД ИГРЫ (по очереди, без таймера) ============ */
function bizObsUpdateScoreUI(){
  const players = bizObsPlayersList();
  const correct = state.bizObsCorrect || [];
  const idx = state.bizObsCurrentPlayerIndex || 0;
  const wrap = document.getElementById('bizObsScoreRow');
  if(wrap){
    wrap.innerHTML = '';
    players.forEach((name, i)=>{
      const span = document.createElement('span');
      span.className = 'krokodil-score-item' + (i === idx ? ' active' : '');
      span.textContent = name + ': ' + (correct[i] || 0);
      wrap.appendChild(span);
    });
  }
  const turnLabel = document.getElementById('bizObsTurnLabel');
  if(turnLabel) turnLabel.textContent = 'Отвечает: ' + (players[idx] || 'Игрок 1');
}
function bizObsUpdateProgressBar(){
  const fill = document.getElementById('bizObsProgressFill');
  const label = document.getElementById('bizObsProgressLabel');
  if(!fill || !label) return;
  const perPlayer = state.bizObsQuestionCount || 5;
  const done = (state.bizObsIndex || 0) % perPlayer;
  const pct = perPlayer > 0 ? Math.round((done/perPlayer)*100) : 0;
  fill.style.width = pct + '%';
  label.textContent = `${done} / ${perPlayer}`;
}
function bizObsDrawQueue(){
  const perPlayer = state.bizObsQuestionCount || 5;
  const numPlayers = bizObsPlayersList().length || 1;
  state.bizObsQueue = bizObsGenerateQueue(perPlayer * numPlayers);
  state.bizObsIndex = 0;
  saveState();
}
function bizObsShowHandoffCard(){
  const players = bizObsPlayersList();
  const idx = state.bizObsCurrentPlayerIndex || 0;
  const name = players[idx] || 'Игрок 1';
  const row = document.getElementById('bizObsHandoffRow');
  if(row) row.style.display = 'flex';
  fadeSwapEl('bizObsCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon znayu-handoff-icon">🔍</div><div class="card-text">Передайте телефон игроку «${name}»</div></div></div>`;
  });
  bizObsUpdateScoreUI();
  bizObsUpdateProgressBar();
}
function bizObsShowQuestion(){
  const row = document.getElementById('bizObsHandoffRow');
  if(row) row.style.display = 'none';
  const item = state.bizObsQueue[state.bizObsIndex];
  if(!item){
    fadeSwapEl('bizObsCard', (el)=>{
      el.className = 'card card-empty';
      el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon">🔍</div><div class="card-text">Не удалось загрузить вопрос — попробуйте обновить приложение</div></div></div>`;
    });
    return;
  }
  bizObsAnswered = false;
  const s = item.scenario;
  fadeSwapEl('bizObsCard', (el)=>{
    el.className = 'card';
    const answersHtml = item.options.map((o,i)=>`<button type="button" class="btn btn-secondary znayu-answer-btn" data-idx="${i}">${o.label}</button>`).join('');
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-body">
          <div class="bizobs-scenario-title">${s.icon} ${s.name}</div>
          <div class="bizobs-scenario-data">
            <div class="bizobs-data-row"><span>Цена</span><span>${bizObsFmtMoney(s.price)}</span></div>
            <div class="bizobs-data-row"><span>Себестоимость</span><span>${bizObsFmtMoney(s.cost)}</span></div>
            <div class="bizobs-data-row"><span>Постоянные расходы</span><span>${bizObsFmtMoney(s.fixedMonthly)}/мес</span></div>
            <div class="bizobs-data-row"><span>Продаж</span><span>${s.salesMonthly} шт/мес</span></div>
          </div>
          <div class="znayu-question-text">${item.questionText}</div>
        </div>
        <div class="znayu-answers">${answersHtml}</div>
      </div>
    `;
    el.querySelectorAll('.znayu-answer-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        bizObsAnswerQuestion(parseInt(btn.dataset.idx, 10));
      });
    });
  });
  bizObsUpdateScoreUI();
  bizObsUpdateProgressBar();
}
function bizObsAnswerQuestion(choiceIdx){
  if(bizObsAnswered) return;
  bizObsAnswered = true;
  const idx = state.bizObsCurrentPlayerIndex || 0;
  if(!state.bizObsCorrect) state.bizObsCorrect = [];
  const item = state.bizObsQueue[state.bizObsIndex];
  const isCorrect = !!(item.options[choiceIdx] && item.options[choiceIdx].correct);
  if(isCorrect){
    state.bizObsCorrect[idx] = (state.bizObsCorrect[idx] || 0) + 1;
    playSuccessSound();
  } else {
    playFailSound();
  }
  document.querySelectorAll('#bizObsCard .znayu-answer-btn').forEach((btn, i)=>{
    btn.disabled = true;
    if(item.options[i] && item.options[i].correct) btn.classList.add('answer-correct');
    else if(i === choiceIdx) btn.classList.add('answer-wrong');
  });
  saveState();
  bizObsUpdateScoreUI();
  setTimeout(bizObsAdvanceQueue, 1200);
}
function bizObsAdvanceQueue(){
  state.bizObsIndex = (state.bizObsIndex || 0) + 1;
  const total = state.bizObsQueue.length;
  if(state.bizObsIndex >= total){
    saveState();
    bizObsShowSummaryModal();
    return;
  }
  const perPlayer = state.bizObsQuestionCount || 5;
  if(state.bizObsIndex % perPlayer === 0){
    const n = bizObsPlayersList().length || 1;
    state.bizObsCurrentPlayerIndex = ((state.bizObsCurrentPlayerIndex || 0) + 1) % n;
    saveState();
    bizObsShowHandoffCard();
  } else {
    saveState();
    bizObsShowQuestion();
  }
}
function bizObsShowSummaryModal(){
  const players = bizObsPlayersList();
  const correct = state.bizObsCorrect || [];
  const perPlayer = state.bizObsQuestionCount || 5;
  const ranking = players.map((n,i)=>({n, correct: correct[i]||0})).sort((a,b)=> b.correct - a.correct);
  const medals = ['🥇','🥈','🥉'];
  let place = 1;
  const listHtml = ranking.map((r,i)=>{
    if(i === 0 || ranking[i-1].correct !== r.correct){ place = i + 1; }
    const placeLabel = medals[place-1] || `${place}.`;
    const isFirst = place === 1;
    return `
      <div class="krokodil-summary-row${isFirst ? ' krokodil-summary-first' : ''}">
        <span class="krokodil-summary-place">${placeLabel}</span>
        <span class="krokodil-summary-name">${r.n}</span>
        <span class="krokodil-summary-score">Верно: ${r.correct} из ${perPlayer}</span>
      </div>
    `;
  }).join('');
  document.getElementById('bizObsSummaryList').innerHTML = listHtml;
  document.getElementById('bizObsSummaryModal').classList.add('show');
}

/* ============ ВХОД/ВЫХОД ИЗ ИГРЫ ============ */
function goToBizObsGame(){
  const players = bizObsPlayersList();
  state.bizObsCorrect = new Array(players.length).fill(0);
  state.bizObsCurrentPlayerIndex = Math.floor(Math.random() * players.length);
  bizObsDrawQueue();
  saveState();
  document.getElementById('bizObsSetup').classList.remove('active');
  document.getElementById('bizObsGame').classList.add('active');
  updateMuteBtn();
  requestWakeLock();
  bizObsShowHandoffCard();
}
function exitBizObsGame(){
  document.getElementById('bizObsSummaryModal').classList.remove('show');
  document.getElementById('bizObsGame').classList.remove('active');
  document.getElementById('bizObsSetup').classList.add('active');
}
document.getElementById('bizObsSetupStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  goToBizObsGame();
});
document.getElementById('bizObsSetupExitBtn').addEventListener('click', ()=>{ exitBizObsSetup(); });
document.getElementById('bizObsHandoffStartBtn').addEventListener('click', ()=>{
  playSuccessSound();
  bizObsShowQuestion();
});
document.getElementById('bizObsExitBtn').addEventListener('click', ()=>{ exitBizObsGame(); });
document.getElementById('closeBizObsSummaryBtn').addEventListener('click', ()=>{ exitBizObsGame(); });
document.getElementById('bizObsSetupRulesBtn').addEventListener('click', ()=>{ document.getElementById('bizObsRulesModal').classList.add('show'); });
document.getElementById('closeBizObsRulesBtn').addEventListener('click', ()=>{ document.getElementById('bizObsRulesModal').classList.remove('show'); });
document.getElementById('bizObsRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'bizObsRulesModal') e.currentTarget.classList.remove('show'); });
