// games/business-lemonade.js — «Лимонадный ларёк» (раздел «Бизнес игры»).
// Обучающая игра для одного игрока (рассчитана на понимание от 7 лет) —
// партия из 5 дней своего лимонадного бизнеса. Каждый день: погода и
// случайное событие (не выбираются, только показываются), место торговли,
// закупка продуктов (+ опциональный лёд), цена, итоги дня с формулами.
// Капитал и вложения в развитие (вывеска/музыка) переносятся между днями,
// в конце партии — суммарная прибыль, оценка по уровню и мини-проверка.

const BIZ_TOTAL_DAYS = 5;
const BIZ_START_CAPITAL = 200;
const BIZ_LEMON_PER_CUP = 3;
const BIZ_SUGAR_PER_CUP = 2;
const BIZ_CUP_PER_CUP = 3;
const BIZ_ICE_PER_CUP = 1;

const BIZ_LOCATIONS = {
  school: { name: 'У школы', icon: '🏫', rent: 10, hint: 'Стабильный поток людей, ничего особенного', demand: { hot: 1.0, normal: 1.0, rain: 0.9 } },
  park:   { name: 'В парке', icon: '🌳', rent: 5,  hint: 'Дёшево, но людей поменьше', demand: { hot: 0.9, normal: 0.85, rain: 0.9 } },
  beach:  { name: 'На пляже', icon: '🏖️', rent: 20, hint: 'Отлично в жару, но пусто в дождь', demand: { hot: 1.5, normal: 1.0, rain: 0.4 } }
};
const BIZ_WEATHERS = [
  { key: 'hot', icon: '☀️', name: 'Жара' },
  { key: 'normal', icon: '🌤️', name: 'Обычная погода' },
  { key: 'rain', icon: '🌧️', name: 'Дождь' }
];
const BIZ_EVENTS = [
  { icon: '🎪', name: 'Рядом ярмарка — прохожих в разы больше!', mult: 1.5 },
  { icon: '🥤', name: 'По соседству конкурент продаёт дешевле', mult: 0.8 },
  { icon: '🎉', name: 'Мимо идёт много народа', mult: 1.2 },
  { icon: '😴', name: 'Тихий день, прохожих мало', mult: 0.85 }
];
const BIZ_EVENT_CHANCE = 0.35;
const BIZ_UPGRADES = {
  sign: { name: '🪧 Яркая вывеска', price: 50, mult: 0.15, desc: '+15% к числу покупателей до конца партии' },
  music: { name: '🎵 Весёлая музыка', price: 40, mult: 0.10, desc: '+10% к числу покупателей до конца партии' }
};
// Доля раскупленных стаканов в зависимости от цены (до умножения на погоду/
// место/событие/апгрейды) — до 40 ₽ раскупают всё, выше — спрос падает.
const BIZ_LEMONADE_DEMAND = { 5: 1, 10: 1, 20: 1, 30: 1, 40: 1, 50: 0.7, 60: 0.4 };
const BIZ_LEMONADE_QUIZ = [
  {
    q: 'Ты потратил 80 ₽ и сделал 10 стаканов лимонада. Сколько стоит один стакан (себестоимость)?',
    options: ['8 ₽', '80 ₽', '800 ₽', '10 ₽'],
    correct: 0
  },
  {
    q: 'Ты продаёшь стакан за 40 ₽, а потратил на него 8 ₽. Сколько ты заработал с одного стакана?',
    options: ['48 ₽', '40 ₽', '32 ₽', '8 ₽'],
    correct: 2
  },
  {
    q: 'Почему лимонад нельзя продавать за 5 ₽, если стакан стоил тебе 8 ₽?',
    options: ['Потому что 5 — некрасивое число', 'Можно, разницы нет', 'Останешься в убытке — потратил больше, чем получил', 'Потому что лимонад невкусный'],
    correct: 2
  },
  {
    q: 'Зачем тратить деньги на вывеску, если можно оставить их себе?',
    options: ['Незачем, это просто трата денег', 'Вывеска привлечёт больше покупателей и принесёт больше денег в будущем', 'Чтобы стало красивее и всё', 'Это не влияет на бизнес'],
    correct: 1
  },
  {
    q: 'Почему в дождливый день невыгодно торговать на пляже?',
    options: ['В дождь на пляже почти нет людей', 'Дождь портит лимоны', 'На пляже всегда дорогая аренда', 'Это не имеет значения'],
    correct: 0
  }
];

function bizPickRandom(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
function bizWeatherInfo(){ return BIZ_WEATHERS.find(w => w.key === state.businessLemonadeWeatherKey) || BIZ_WEATHERS[1]; }
function bizEventInfo(){ return state.businessLemonadeEventIdx >= 0 ? BIZ_EVENTS[state.businessLemonadeEventIdx] : null; }

function updateBizHeaderUI(){
  const day = state.businessLemonadeDay || 1;
  document.getElementById('bizDayFill').style.width = ((day - 1) / BIZ_TOTAL_DAYS * 100) + '%';
  document.getElementById('bizDayLabel').textContent = `День ${day} из ${BIZ_TOTAL_DAYS}`;
  document.getElementById('bizCapitalRow').textContent = `Капитал: ${state.businessLemonadeCapital} ₽`;
}
function goToBizPhase(phaseId){
  document.querySelectorAll('#businessLemonadeGame .biz-phase').forEach(el=>{
    el.classList.toggle('biz-phase-active', el.id === phaseId);
  });
}

/* ============ ШАГ 0: НАЧАЛО ДНЯ (погода/событие/апгрейды) ============ */
function startBizDay(){
  state.businessLemonadeWeatherKey = bizPickRandom(BIZ_WEATHERS).key;
  const ev = Math.random() < BIZ_EVENT_CHANCE ? bizPickRandom(BIZ_EVENTS) : null;
  state.businessLemonadeEventIdx = ev ? BIZ_EVENTS.indexOf(ev) : -1;
  state.businessLemonadeLocation = null;
  state.businessLemonadeIce = false;
  saveState();
  renderBizDayIntro();
  goToBizPhase('bizPhaseDayIntro');
}
function renderBizDayIntro(){
  updateBizHeaderUI();
  const day = state.businessLemonadeDay || 1;
  document.getElementById('bizDayIntroTitle').textContent = `День ${day}. Доброе утро!`;
  const w = bizWeatherInfo();
  document.getElementById('bizWeatherCard').textContent = `${w.icon} Погода: ${w.name}`;
  const evEl = document.getElementById('bizEventCard');
  const ev = bizEventInfo();
  if(ev){ evEl.style.display = 'block'; evEl.textContent = `${ev.icon} ${ev.name}`; }
  else { evEl.style.display = 'none'; }
  renderBizUpgradeOffers();
}
function renderBizUpgradeOffers(){
  const box = document.getElementById('bizUpgradeBox');
  const btnsWrap = document.getElementById('bizUpgradeButtons');
  const upgrades = state.businessLemonadeUpgrades || {};
  const keys = Object.keys(BIZ_UPGRADES).filter(k=>!upgrades[k]);
  if(keys.length === 0){ box.style.display = 'none'; return; }
  box.style.display = 'block';
  btnsWrap.innerHTML = keys.map(k=>{
    const u = BIZ_UPGRADES[k];
    const affordable = (state.businessLemonadeCapital || 0) >= u.price;
    return `<button type="button" class="biz-upgrade-btn${affordable ? '' : ' biz-upgrade-owned'}" data-key="${k}" ${affordable ? '' : 'disabled'}>${u.name} — ${u.desc}<span class="biz-upgrade-price">${u.price} ₽</span></button>`;
  }).join('');
  btnsWrap.querySelectorAll('.biz-upgrade-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const k = btn.dataset.key;
      const u = BIZ_UPGRADES[k];
      if((state.businessLemonadeCapital || 0) < u.price) return;
      state.businessLemonadeCapital -= u.price;
      state.businessLemonadeUpgrades[k] = true;
      saveState();
      playSuccessSound();
      showToast(`${u.name} куплена!`);
      updateBizHeaderUI();
      renderBizUpgradeOffers();
    });
  });
}
document.getElementById('bizStartDayBtn').addEventListener('click', ()=>{
  playSuccessSound();
  renderBizLocationList();
  document.getElementById('bizToBuyBtn').disabled = true;
  goToBizPhase('bizPhaseLocation');
});

/* ============ ШАГ 1: МЕСТО ТОРГОВЛИ ============ */
function renderBizLocationList(){
  const wrap = document.getElementById('bizLocationList');
  wrap.innerHTML = Object.keys(BIZ_LOCATIONS).map(key=>{
    const loc = BIZ_LOCATIONS[key];
    const on = state.businessLemonadeLocation === key;
    return `<button type="button" class="biz-location-item${on ? ' on' : ''}" data-key="${key}">
      <div class="biz-location-name">${loc.icon} ${loc.name}</div>
      <div class="biz-location-hint">${loc.hint} · аренда ${loc.rent} ₽/день</div>
    </button>`;
  }).join('');
  wrap.querySelectorAll('.biz-location-item').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      playSuccessSound();
      state.businessLemonadeLocation = btn.dataset.key;
      saveState();
      renderBizLocationList();
      document.getElementById('bizToBuyBtn').disabled = false;
    });
  });
}
document.getElementById('bizToBuyBtn').addEventListener('click', ()=>{
  if(!state.businessLemonadeLocation) return;
  playSuccessSound();
  renderBizQuantityGroup();
  renderBizIceToggle();
  goToBizPhase('bizPhaseBuy');
});

/* ============ ШАГ 2: ЗАКУПКА ============ */
function bizBuyBreakdown(cups, iceOn, locationKey){
  const lemonCost = cups * BIZ_LEMON_PER_CUP;
  const sugarCost = cups * BIZ_SUGAR_PER_CUP;
  const cupCost = cups * BIZ_CUP_PER_CUP;
  const iceCost = iceOn ? cups * BIZ_ICE_PER_CUP : 0;
  const rent = (BIZ_LOCATIONS[locationKey] || { rent: 0 }).rent;
  const materials = lemonCost + sugarCost + cupCost + iceCost;
  return { lemonCost, sugarCost, cupCost, iceCost, rent, total: materials + rent };
}
function renderBizQuantityGroup(){
  document.querySelectorAll('#bizQuantityGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (state.businessLemonadeCups || 10));
  });
  updateBizBuyBreakdownUI();
}
function renderBizIceToggle(){
  const btn = document.getElementById('bizIceToggleBtn');
  const on = !!state.businessLemonadeIce;
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.textContent = on ? '🧊 Со льдом (+1 ₽/стакан)' : '🧊 Без льда';
}
function updateBizBuyBreakdownUI(){
  const cups = state.businessLemonadeCups || 10;
  const b = bizBuyBreakdown(cups, state.businessLemonadeIce, state.businessLemonadeLocation);
  document.getElementById('bizBuyLemonRow').textContent = `${b.lemonCost} ₽`;
  document.getElementById('bizBuySugarRow').textContent = `${b.sugarCost} ₽`;
  document.getElementById('bizBuyCupRow').textContent = `${b.cupCost} ₽`;
  document.getElementById('bizBuyIceRowWrap').style.display = state.businessLemonadeIce ? 'flex' : 'none';
  document.getElementById('bizBuyIceRow').textContent = `${b.iceCost} ₽`;
  document.getElementById('bizBuyRentRow').textContent = `${b.rent} ₽`;
  document.getElementById('bizBuyTotalRow').textContent = `${b.total} ₽`;
}
document.querySelectorAll('#bizQuantityGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.businessLemonadeCups = parseInt(btn.dataset.value, 10);
    saveState();
    renderBizQuantityGroup();
  });
});
document.getElementById('bizIceToggleBtn').addEventListener('click', ()=>{
  state.businessLemonadeIce = !state.businessLemonadeIce;
  saveState();
  renderBizIceToggle();
  updateBizBuyBreakdownUI();
});
document.getElementById('bizToPriceBtn').addEventListener('click', ()=>{
  playSuccessSound();
  const cups = state.businessLemonadeCups || 10;
  const b = bizBuyBreakdown(cups, state.businessLemonadeIce, state.businessLemonadeLocation);
  const costPerCup = Math.round((b.total / cups) * 10) / 10;
  document.getElementById('bizPriceCostReminder').textContent = `Себестоимость одного стакана: ${costPerCup} ₽ (расходы ${b.total} ₽ ÷ ${cups} стаканов)`;
  renderBizPriceGroup();
  goToBizPhase('bizPhasePrice');
});

/* ============ ШАГ 3: ЦЕНА ============ */
function renderBizPriceGroup(){
  document.querySelectorAll('#bizPriceGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (state.businessLemonadePrice || 40));
  });
}
document.querySelectorAll('#bizPriceGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.businessLemonadePrice = parseInt(btn.dataset.value, 10);
    saveState();
    renderBizPriceGroup();
  });
});
document.getElementById('bizSellBtn').addEventListener('click', ()=>{
  playSuccessSound();
  bizSellDay();
});
function bizDemandFraction(price, weatherKey, locationKey, ice){
  const priceFrac = BIZ_LEMONADE_DEMAND[price] !== undefined ? BIZ_LEMONADE_DEMAND[price] : 1;
  const loc = BIZ_LOCATIONS[locationKey] || BIZ_LOCATIONS.school;
  const locMult = loc.demand[weatherKey] !== undefined ? loc.demand[weatherKey] : 1;
  const ev = bizEventInfo();
  const eventMult = ev ? ev.mult : 1;
  const upgrades = state.businessLemonadeUpgrades || {};
  let upgradeMult = 1;
  Object.keys(BIZ_UPGRADES).forEach(k=>{ if(upgrades[k]) upgradeMult += BIZ_UPGRADES[k].mult; });
  let iceMult = 1;
  if(weatherKey === 'hot') iceMult = ice ? 1.15 : 0.9;
  return priceFrac * locMult * eventMult * upgradeMult * iceMult;
}
function bizSellDay(){
  const cups = state.businessLemonadeCups || 10;
  const price = state.businessLemonadePrice || 40;
  const b = bizBuyBreakdown(cups, state.businessLemonadeIce, state.businessLemonadeLocation);
  const expenses = b.total;
  const costPerCup = expenses / cups;
  const profitPerCup = price - costPerCup;
  const fraction = bizDemandFraction(price, state.businessLemonadeWeatherKey, state.businessLemonadeLocation, state.businessLemonadeIce);
  const sold = Math.max(0, Math.min(cups, Math.round(cups * fraction)));
  const revenue = price * sold;
  const netProfit = Math.round(revenue - expenses);
  state.businessLemonadeSold = sold;
  state.businessLemonadeRevenue = revenue;
  state.businessLemonadeNetProfit = netProfit;
  state.businessLemonadeCapital = (state.businessLemonadeCapital || 0) + netProfit;
  if(!state.businessLemonadeDayProfits) state.businessLemonadeDayProfits = [];
  state.businessLemonadeDayProfits[(state.businessLemonadeDay || 1) - 1] = netProfit;
  saveState();
  const highlightEl = document.getElementById('bizResultHighlight');
  highlightEl.textContent = (netProfit >= 0 ? '+' : '') + netProfit + ' ₽';
  highlightEl.classList.toggle('biz-loss', netProfit < 0);
  document.getElementById('bizResultsTitle').textContent = `Итоги дня ${state.businessLemonadeDay || 1}`;
  document.getElementById('bizResExpenses').textContent = `${expenses} ₽`;
  document.getElementById('bizResCost').textContent = `${Math.round(costPerCup * 10) / 10} ₽`;
  document.getElementById('bizResPrice').textContent = `${price} ₽`;
  document.getElementById('bizResProfitPerCup').textContent = `${Math.round(profitPerCup * 10) / 10} ₽`;
  document.getElementById('bizResSold').textContent = `${sold} из ${cups}`;
  document.getElementById('bizResRevenue').textContent = `${revenue} ₽`;
  document.getElementById('bizResNetProfit').textContent = `${netProfit} ₽`;
  document.getElementById('bizNextDayBtn').textContent = (state.businessLemonadeDay || 1) >= BIZ_TOTAL_DAYS ? 'Итоги партии →' : 'Следующий день →';
  updateBizHeaderUI();
  if(netProfit >= 0) playSuccessSound(); else playErrorSound();
  goToBizPhase('bizPhaseResults');
}
document.getElementById('bizNextDayBtn').addEventListener('click', ()=>{
  playSuccessSound();
  if((state.businessLemonadeDay || 1) >= BIZ_TOTAL_DAYS){
    startBizQuiz();
    return;
  }
  state.businessLemonadeDay = (state.businessLemonadeDay || 1) + 1;
  saveState();
  startBizDay();
});

/* ============ ПРОВЕРКА СЕБЯ (после 5-го дня) ============ */
function startBizQuiz(){
  state.businessLemonadeQuizIndex = 0;
  state.businessLemonadeQuizCorrect = 0;
  saveState();
  goToBizPhase('bizPhaseQuiz');
  renderBizQuizQuestion();
}
function renderBizQuizQuestion(){
  const idx = state.businessLemonadeQuizIndex || 0;
  const item = BIZ_LEMONADE_QUIZ[idx];
  if(!item){ showBizSummaryModal(); return; }
  document.getElementById('bizQuizProgress').textContent = `Вопрос ${idx + 1} из ${BIZ_LEMONADE_QUIZ.length}`;
  document.getElementById('bizQuizQuestion').textContent = item.q;
  const wrap = document.getElementById('bizQuizAnswers');
  wrap.innerHTML = item.options.map((opt, i)=>`<button type="button" class="btn btn-secondary znayu-answer-btn" data-idx="${i}">${opt}</button>`).join('');
  wrap.querySelectorAll('.znayu-answer-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{ answerBizQuiz(parseInt(btn.dataset.idx, 10)); });
  });
}
let bizQuizAnswered = false;
function answerBizQuiz(choiceIdx){
  if(bizQuizAnswered) return;
  bizQuizAnswered = true;
  const idx = state.businessLemonadeQuizIndex || 0;
  const item = BIZ_LEMONADE_QUIZ[idx];
  const isCorrect = choiceIdx === item.correct;
  if(isCorrect){
    state.businessLemonadeQuizCorrect = (state.businessLemonadeQuizCorrect || 0) + 1;
    playSuccessSound();
  } else {
    playFailSound();
  }
  document.querySelectorAll('#bizQuizAnswers .znayu-answer-btn').forEach((btn, i)=>{
    btn.disabled = true;
    if(i === item.correct) btn.classList.add('answer-correct');
    else if(i === choiceIdx) btn.classList.add('answer-wrong');
  });
  saveState();
  setTimeout(()=>{
    bizQuizAnswered = false;
    state.businessLemonadeQuizIndex = (state.businessLemonadeQuizIndex || 0) + 1;
    saveState();
    renderBizQuizQuestion();
  }, 900);
}

/* ============ ИТОГИ ПАРТИИ ============ */
function bizResultTier(totalProfit){
  if(totalProfit < 0) return { icon: '🌱', name: 'Начинающий (пока в минусе)' };
  if(totalProfit < 500) return { icon: '🍋', name: 'Начинающий продавец' };
  if(totalProfit < 1200) return { icon: '💼', name: 'Хороший бизнесмен' };
  return { icon: '👑', name: 'Лимонадный магнат' };
}
function showBizSummaryModal(){
  const correct = state.businessLemonadeQuizCorrect || 0;
  const total = BIZ_LEMONADE_QUIZ.length;
  const dayProfits = state.businessLemonadeDayProfits || [];
  const totalProfit = dayProfits.reduce((a,b)=>a+(b||0), 0);
  const tier = bizResultTier(totalProfit);
  document.getElementById('bizSummaryTitle').textContent = `${tier.icon} ${tier.name}`;
  document.getElementById('bizSummaryIntro').textContent = `За 5 дней партии чистая прибыль: ${totalProfit >= 0 ? '+' : ''}${totalProfit} ₽. Правильных ответов в проверке: ${correct} из ${total}.`;
  document.getElementById('bizSummaryDaysBox').innerHTML = dayProfits.map((p, i)=>`
    <div class="biz-breakdown-row"><span>День ${i + 1}</span><span>${p >= 0 ? '+' : ''}${p} ₽</span></div>
  `).join('');
  const checklist = ['Я знаю, что такое себестоимость.', 'Я знаю, что такое цена.', 'Я знаю, что такое прибыль.', 'Я знаю, что такое выручка и расходы.', 'Я понимаю, зачем вкладывать часть прибыли в развитие.'];
  document.getElementById('bizSummaryList').innerHTML = checklist.map(text=>`
    <div class="krokodil-summary-row">
      <span class="krokodil-summary-place">✅</span>
      <span class="krokodil-summary-name">${text}</span>
    </div>
  `).join('');
  document.getElementById('businessLemonadeSummaryModal').classList.add('show');
}
document.getElementById('bizPlayAgainBtn').addEventListener('click', ()=>{
  document.getElementById('businessLemonadeSummaryModal').classList.remove('show');
  goToBusinessLemonadeGame();
});
document.getElementById('closeBusinessLemonadeSummaryBtn').addEventListener('click', ()=>{
  document.getElementById('businessLemonadeSummaryModal').classList.remove('show');
  exitBusinessLemonadeGame();
});

/* ============ ВХОД/ВЫХОД ============ */
function goToBusinessLemonadeSetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('businessLemonadeSetup').classList.add('active');
}
function exitBusinessLemonadeSetup(){
  document.getElementById('businessLemonadeSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}
function goToBusinessLemonadeGame(){
  document.getElementById('businessLemonadeSetup').classList.remove('active');
  document.getElementById('businessLemonadeGame').classList.add('active');
  state.businessLemonadeDay = 1;
  state.businessLemonadeCapital = BIZ_START_CAPITAL;
  state.businessLemonadeUpgrades = { sign: false, music: false };
  state.businessLemonadeCups = 10;
  state.businessLemonadePrice = 40;
  state.businessLemonadeSold = 0;
  state.businessLemonadeRevenue = 0;
  state.businessLemonadeNetProfit = 0;
  state.businessLemonadeDayProfits = [];
  state.businessLemonadeQuizIndex = 0;
  state.businessLemonadeQuizCorrect = 0;
  bizQuizAnswered = false;
  saveState();
  updateMuteBtn();
  requestWakeLock();
  startBizDay();
}
function exitBusinessLemonadeGame(){
  document.getElementById('businessLemonadeGame').classList.remove('active');
  document.getElementById('businessLemonadeSetup').classList.add('active');
}
document.getElementById('businessLemonadeSetupStartBtn').addEventListener('click', ()=>{ goToBusinessLemonadeGame(); });
document.getElementById('businessLemonadeSetupExitBtn').addEventListener('click', ()=>{ exitBusinessLemonadeSetup(); });
document.getElementById('businessLemonadeExitBtn').addEventListener('click', ()=>{ exitBusinessLemonadeGame(); });
document.getElementById('businessLemonadeSetupRulesBtn').addEventListener('click', ()=>{ document.getElementById('businessLemonadeRulesModal').classList.add('show'); });
document.getElementById('closeBusinessLemonadeRulesBtn').addEventListener('click', ()=>{ document.getElementById('businessLemonadeRulesModal').classList.remove('show'); });
document.getElementById('businessLemonadeRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'businessLemonadeRulesModal') e.currentTarget.classList.remove('show'); });
