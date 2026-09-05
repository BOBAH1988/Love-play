// games/business-lemonade.js — «Лимонадный ларёк» (раздел «Бизнес игры»).
// Симулятор жизни школьника, который торгует лимонадом с тележки —
// обучающая игра для одного игрока (рассчитана на понимание от 7 лет).
// Партия без ограничения по дням: продолжается, пока не накоплена цель
// (выбирается на старте). Каждый день: погода, день недели, развитие
// (покупается один раз на партию), место торговли (там же — случайное
// событие, привязанное к месту), время работы, закупка лимонов про запас
// (портятся через 3 дня), закупка остальных продуктов + опции к напитку,
// цена (с учётом конкурента, если он сегодня рядом), итоги дня с формулами.
// Капитал переносится между днями и никогда не уходит ниже 0 — если денег
// совсем не осталось, до нужной суммы одалживает друг, но под процент и с
// сроком возврата. В конце партии — суммарная прибыль, график по дням,
// оценка по уровню и мини-проверка с числами из этой же партии.

// Цели накопления (выбираются на стартовом экране): партия продолжается,
// пока суммарная чистая прибыль не достигнет выбранной суммы.
const BIZ_GOALS = [
  { sum: 500,  name: 'кино',         icon: '🎬' },
  { sum: 1000, name: 'кафе',         icon: '☕' },
  { sum: 2500, name: 'аттракционы',  icon: '🎡' },
  { sum: 5000, name: 'подарок',      icon: '🎁' },
];
const BIZ_START_CAPITAL = 200;
const BIZ_SUGAR_PER_CUP = 2;
const BIZ_CUP_PER_CUP = 3;
const BIZ_WATER_PER_CUP = 0; // вода бесплатная, но показывается как обычный ингредиент

const BIZ_DAYS_OF_WEEK = [
  { short: 'Пн', name: 'Понедельник', weekend: false },
  { short: 'Вт', name: 'Вторник', weekend: false },
  { short: 'Ср', name: 'Среда', weekend: false },
  { short: 'Чт', name: 'Четверг', weekend: false },
  { short: 'Пт', name: 'Пятница', weekend: false },
  { short: 'Сб', name: 'Суббота', weekend: true },
  { short: 'Вс', name: 'Воскресенье', weekend: true },
];
function bizDayOfWeek(day){ return BIZ_DAYS_OF_WEEK[(Math.max(1, day) - 1) % 7]; }

// weekdayMult/weekendMult — во сколько раз меняется поток людей в будни и
// в выходные (перемножается с погодным множителем demand).
const BIZ_LOCATIONS = {
  school:  { name: 'У школы', icon: '🏫', rentPerHour: 9, hint: 'В будни многолюдно, по выходным почти пусто', demand: { hot: 1.0, normal: 1.0, rain: 0.9 }, weekdayMult: 1.3, weekendMult: 0.3 },
  station: { name: 'У остановки', icon: '🚌', rentPerHour: 0, hint: 'Много спешащих мимо людей в будни, аренда бесплатная', demand: { hot: 1.0, normal: 1.0, rain: 0.95 }, weekdayMult: 1.25, weekendMult: 0.6 },
  mall:    { name: 'У торгового центра', icon: '🏬', rentPerHour: 15, hint: 'Людно каждый день, но аренда подороже', demand: { hot: 1.0, normal: 1.05, rain: 1.1 }, weekdayMult: 1.0, weekendMult: 1.15 },
  park:    { name: 'В парке', icon: '🌳', rentPerHour: 6, hint: 'По выходным сюда приходят гулять семьями', demand: { hot: 0.9, normal: 0.85, rain: 0.9 }, weekdayMult: 0.8, weekendMult: 1.3 },
  beach:   { name: 'На пляже', icon: '🏖️', rentPerHour: 18, hint: 'Отлично в жару, но пусто в дождь', demand: { hot: 1.5, normal: 1.0, rain: 0.4 }, weekdayMult: 0.9, weekendMult: 1.2 },
};
const BIZ_WEATHERS = [
  { key: 'hot', icon: '☀️', name: 'Жара' },
  { key: 'normal', icon: '🌤️', name: 'Обычная погода' },
  { key: 'rain', icon: '🌧️', name: 'Дождь' }
];
// События теперь привязаны к месту: locations:null — может случиться где
// угодно, locations:['key',...] — только в этих локациях (например, ярмарка
// имеет смысл только в парке). Событие выбирается ПОСЛЕ выбора места (см.
// renderBizLocationList), поэтому может зависеть от него. competitorPrice —
// если задано, рядом появляется конкурент с этой ценой на весь день (эффект
// считает bizCompetitorMult).
const BIZ_EVENTS = [
  { icon: '🎉', name: 'Мимо идёт много народа', mult: 1.2, locations: null },
  { icon: '😴', name: 'Тихий день, прохожих мало', mult: 0.85, locations: null },
  { icon: '🚧', name: 'Рядом ремонт дороги — часть людей идёт в обход', mult: 0.8, locations: null },
  { icon: '📣', name: 'О тебе рассказали соседям — пришли новые покупатели', mult: 1.25, locations: null },
  { icon: '🎪', name: 'В парке сегодня ярмарка — прохожих в разы больше!', mult: 1.6, locations: ['park'] },
  { icon: '🚍', name: 'На пляж приехал автобус с отдыхающими', mult: 1.4, locations: ['beach'] },
  { icon: '🚌', name: 'У остановки сломался автобус — люди толпятся в ожидании', mult: 1.3, locations: ['station'] },
  { icon: '🛍️', name: 'В торговом центре распродажа — очень людно', mult: 1.3, locations: ['mall'] },
  { icon: '🏫', name: 'В школе родительское собрание — рядом много взрослых', mult: 1.3, locations: ['school'] },
  { icon: '🥤', name: 'Рядом со школой ещё один школьник продаёт лимонад по 40 ₽', mult: 1, locations: ['school'], competitorPrice: 40 },
  { icon: '🥤', name: 'У остановки появился конкурент с ценой 25 ₽', mult: 1, locations: ['station'], competitorPrice: 25 },
  { icon: '🥤', name: 'В парке ещё один ларёк продаёт лимонад по 30 ₽', mult: 1, locations: ['park'], competitorPrice: 30 },
  { icon: '🥤', name: 'На пляже конкурент продаёт лимонад по 35 ₽', mult: 1, locations: ['beach'], competitorPrice: 35 },
];
const BIZ_EVENT_CHANCE = 0.4;
// Эффект конкурента: если твоя цена ниже конкурента — переманиваешь его
// покупателей (спрос растёт), если выше — часть уходит к нему (спрос падает).
function bizCompetitorMult(price, competitorPrice){
  if(!competitorPrice) return 1;
  const diff = competitorPrice - price;
  return Math.max(0.5, Math.min(1.5, 1 + diff * 0.02));
}
// Развитие стоит дороже, чем стартовый капитал (200 ₽) — сходу купить
// ничего нельзя, сначала нужно честно заработать хотя бы день-два.
// Цена улучшения фиксированная: партия больше не ограничена числом дней.
const BIZ_UPGRADES = {
  recipe:      { name: '🧪 Улучшенный рецепт', basePrice: 220, mult: 0.10, desc: 'Вкуснее лимонад — +10% к числу покупателей' },
  music:       { name: '🎵 Весёлая колонка', basePrice: 350, mult: 0.15, desc: '+15% к числу покупателей до конца партии' },
  sign:        { name: '🪧 Яркая вывеска', basePrice: 500, mult: 0.20, desc: '+20% к числу покупателей до конца партии' },
  seller:      { name: '🧑‍💼 Позвать друга помогать', basePrice: 750, mult: 0.30, desc: 'Меньше очередей — +30% к числу покупателей' },
  secondStand: { name: '🛒 Вторая тележка', basePrice: 1250, mult: 0.50, desc: 'Продажи ещё в одном месте — +50% к числу покупателей' },
};
// Цена улучшения фиксированная: партия больше не ограничена числом дней,
// поэтому снижать стоимость к концу партии больше не нужно.
function bizUpgradePrice(basePrice){
  return basePrice;
}
const BIZ_WORK_HOURS = [
  { hours: 1, mult: 0.35 },
  { hours: 3, mult: 0.7 },
  { hours: 6, mult: 1.0 },
];
function bizHoursMult(hours){
  const h = BIZ_WORK_HOURS.find(x => x.hours === hours);
  return h ? h.mult : 1.0;
}
// Опции к напитку. costType 'perCup' — цена за каждый приготовленный стакан,
// 'flatDay' — разовая плата за весь день независимо от количества стаканов.
// weatherKey+onMult/offMult — опция влияет на спрос только в указанную
// погоду, иначе не действует; обычный mult — действует всегда, пока включена.
const BIZ_OPTIONS = {
  ice:      { name: 'Лёд', icon: '🧊', costType: 'perCup', cost: 1, weatherKey: 'hot', onMult: 1.15, offMult: 0.9, hint: 'В жару разбирают быстрее' },
  umbrella: { name: 'Зонтик', icon: '☂️', costType: 'perCup', cost: 1, mult: 1.06, hint: 'Красивая мелочь в стакане' },
  colorCup: { name: 'Цветной стакан', icon: '🧋', costType: 'perCup', cost: 1, mult: 1.08, hint: 'Ярче — заметнее издалека' },
  straw:    { name: 'Узорная трубочка', icon: '🥤', costType: 'perCup', cost: 1, mult: 1.05, hint: 'Приятная мелочь для покупателей' },
};
// Стоимость ингредиентов для чая (пакетик + вода бесплатно + сахар)
const BIZ_TEA_COSTS = { teaBag: 3, sugar: 2, water: 0, cup: 3 };
// Доля раскупленных стаканов лимонада в зависимости от цены
const BIZ_LEMONADE_DEMAND = { 10: 1, 20: 1, 30: 1, 40: 1, 50: 0.7, 60: 0.4, 70: 0.2 };
// Доля раскупленных стаканов чая в зависимости от цены
const BIZ_TEA_DEMAND = { 5: 1, 10: 1, 15: 0.9, 20: 0.7, 25: 0.5, 30: 0.3 };

// Лимоны — единственный продукт, который закупается заранее про запас (а не
// свежим каждый день) и портится, если пролежит больше 3 дней. Покупка
// оптом дешевле за штуку, но больше риск не успеть всё использовать.
const BIZ_LEMON_TIERS = [
  { qty: 10, pricePerUnit: 4 },
  { qty: 20, pricePerUnit: 3 },
  { qty: 40, pricePerUnit: 2 },
  { qty: 100, pricePerUnit: 1 },
];
const BIZ_TEA_TIERS = [
  { qty: 10, pricePerUnit: 3 },
  { qty: 20, pricePerUnit: 3 },
  { qty: 50, pricePerUnit: 2 },
];
const BIZ_LEMON_SHELF_DAYS = 3;

// Если капитал падает ниже стоимости самой дешёвой возможной закупки
// (пачка из 10 лимонов + продукты на 5 стаканов в парке — самом дешёвом
// месте), партия зайдёт в тупик: не на что закупиться. В этом случае
// одолживает деньги друг — под процент и с сроком возврата (см.
// bizHandleDailyFinance) — это честный способ не дать партии застрять и
// заодно показать, что долг обходится дороже, чем занятая сумма.
const BIZ_MIN_CAPITAL_FOR_DAY = BIZ_LEMON_TIERS[0].qty * BIZ_LEMON_TIERS[0].pricePerUnit + 5 * (BIZ_SUGAR_PER_CUP + BIZ_CUP_PER_CUP) + BIZ_LOCATIONS.park.rentPerHour;
const BIZ_LOAN_INTEREST = 1.2; // друг просит вернуть на 20% больше
const BIZ_LOAN_DUE_DAYS = 2;

const BIZ_QUIZ_CONCEPT_POOL = [
  {
    q: 'Куда лучше встать с лимонадом в жаркий день?',
    options: ['На пляж — люди хотят пить', 'В парк — там прохладно', 'У школы — там дети'],
    correct: 0
  },
  {
    q: 'Что выгоднее: купить 10 лимонов или 40 лимонов?',
    options: ['10 — меньше потрачу', '40 — каждый лимон стоит дешевле', 'Одинаково'],
    correct: 1
  },
  {
    q: 'Рядом конкурент продаёт лимонад дешевле тебя. Что делать?',
    options: ['Закрыться и уйти', 'Сделать вкуснее или привлечь внимание', 'Тоже снизить цену до нуля'],
    correct: 1
  },
];

function bizPickRandom(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
function bizRandInt(min, max){ return Math.floor(Math.random() * (max - min + 1)) + min; }
function bizWeatherInfo(){ return BIZ_WEATHERS.find(w => w.key === state.businessLemonadeWeatherKey) || BIZ_WEATHERS[1]; }
function bizEventInfo(){ return state.businessLemonadeEventIdx >= 0 ? BIZ_EVENTS[state.businessLemonadeEventIdx] : null; }
function bizLocationInfo(){ return BIZ_LOCATIONS[state.businessLemonadeLocation] || null; }

// Суммарная чистая прибыль за все сыгранные дни — «накоплено чистыми».
function bizTotalNet(){
  const dayProfits = state.businessLemonadeDayProfits || [];
  return dayProfits.reduce((a,b)=>a+(b||0), 0);
}
function bizGoalInfo(){
  const goal = state.businessLemonadeGoal || 1000;
  const name = state.businessLemonadeGoalName || 'кафе';
  const item = BIZ_GOALS.find(g => g.sum === goal) || BIZ_GOALS[1];
  return { goal, name, icon: item.icon };
}
function bizGoalReached(){
  return bizTotalNet() >= (state.businessLemonadeGoal || 1000);
}
function updateBizHeaderUI(){
  const day = state.businessLemonadeDay || 1;
  const totalNet = bizTotalNet();
  const { goal, name, icon } = bizGoalInfo();
  // Прогресс-бар теперь показывает путь к цели накопления, а не дни.
  const pct = Math.max(0, Math.min(100, Math.round(totalNet / goal * 100)));
  document.getElementById('bizDayFill').style.width = pct + '%';
  document.getElementById('bizDayLabel').textContent = `День ${day} · ${icon} ${totalNet} из ${goal} ₽ (${name})`;
  document.getElementById('bizCapitalRow').textContent = `Капитал: ${state.businessLemonadeCapital} ₽`;
}
function goToBizPhase(phaseId){
  document.querySelectorAll('#businessLemonadeGame .biz-phase').forEach(el=>{
    el.classList.toggle('biz-phase-active', el.id === phaseId);
  });
  // На "Шаге 0" (начало дня) день и погода и так крупно показаны в
  // заголовке и карточке погоды — строка-дублёр только наезжала на них.
  // На остальных шагах она полезна: напоминает более ранние выборы.
  const bar = document.getElementById('bizContextBar');
  if(bar) bar.style.display = (phaseId === 'bizPhaseDayIntro') ? 'none' : '';
}
// Строка выбранных параметров, видна на всех шагах партии, кроме начала дня.
function updateBizContextBar(){
  const bar = document.getElementById('bizContextBar');
  if(!bar) return;
  const day = state.businessLemonadeDay || 1;
  const dow = bizDayOfWeek(day);
  const w = bizWeatherInfo();
  const chips = [`${dow.short}`, `${w.icon} ${w.name}`];
  const loc = bizLocationInfo();
  if(loc) chips.push(`${loc.icon} ${loc.name}`);
  const ev = bizEventInfo();
  if(ev) chips.push(`${ev.icon} Событие`);
  if(state.businessLemonadeHours) chips.push(`⏰ ${state.businessLemonadeHours} ч`);
  const lemonStock = state.businessLemonadeLemonStock || 0;
  if(lemonStock > 0) chips.push(`🍋 ${lemonStock} шт.`);
  const teaStock = state.businessLemonadeTeaStock || 0;
  if(teaStock > 0) chips.push(`🍵 ${teaStock} шт.`);
  bar.innerHTML = chips.map(c => `<span class="biz-context-chip">${c}</span>`).join('');
}

/* ============ ФИНАНСЫ: заём у друга + порча лимонов ============ */
// Лимоны портятся, если пролежали BIZ_LEMON_SHELF_DAYS дней с момента
// последней покупки (упрощение: любая новая покупка "освежает" весь запас —
// без этого пришлось бы отдельно отслеживать срок годности каждой пачки).
function bizCheckLemonSpoilage(){
  const day = state.businessLemonadeDay || 1;
  const boughtDay = state.businessLemonadeLemonBoughtDay;
  if((state.businessLemonadeLemonStock || 0) > 0 && boughtDay != null && (day - boughtDay) >= BIZ_LEMON_SHELF_DAYS){
    const spoiled = state.businessLemonadeLemonStock;
    state.businessLemonadeLemonStock = 0;
    state.businessLemonadeLemonBoughtDay = null;
    return spoiled;
  }
  return 0;
}
// Возвращает друг долг сегодня (если срок подошёл) и/или одалживает заново
// (если капитала не хватает даже на самую дешёвую закупку). Безопасно
// вызывать несколько раз за один день — повторный вызов ничего не меняет.
function bizHandleDailyFinance(){
  const day = state.businessLemonadeDay || 1;
  let repaidInfo = null;
  if((state.businessLemonadeLoanOwed || 0) > 0 && day >= (state.businessLemonadeLoanDueDay || 0)){
    const owed = state.businessLemonadeLoanOwed;
    const capital = state.businessLemonadeCapital || 0;
    const paid = Math.min(capital, owed);
    state.businessLemonadeCapital = capital - paid;
    repaidInfo = { paid, owed, shortfall: owed - paid };
    state.businessLemonadeLoanOwed = 0;
    state.businessLemonadeLoanDueDay = null;
  }
  let loanInfo = null;
  if((state.businessLemonadeCapital || 0) < BIZ_MIN_CAPITAL_FOR_DAY && !(state.businessLemonadeLoanOwed > 0)){
    const borrowed = BIZ_MIN_CAPITAL_FOR_DAY;
    const owed = Math.round(borrowed * BIZ_LOAN_INTEREST);
    state.businessLemonadeCapital = (state.businessLemonadeCapital || 0) + borrowed;
    state.businessLemonadeLoanOwed = owed;
    state.businessLemonadeLoanDueDay = day + BIZ_LOAN_DUE_DAYS;
    loanInfo = { borrowed, owed, dueDay: state.businessLemonadeLoanDueDay };
  }
  return { repaidInfo, loanInfo };
}

/* ============ ШАГ 0: НАЧАЛО ДНЯ (погода/апгрейды) ============ */
function startBizDay(){
  state.businessLemonadeWeatherKey = bizPickRandom(BIZ_WEATHERS).key;
  // Событие зависит от места — выбирается позже, при выборе локации.
  state.businessLemonadeEventIdx = -1;
  state.businessLemonadeCompetitorPrice = null;
  state.businessLemonadeLocation = null;
  state.businessLemonadeHours = null;
  state.businessLemonadeOptions = {};
  const spoiled = bizCheckLemonSpoilage();
  const finance = bizHandleDailyFinance();
  saveState();
  renderBizDayIntro(finance, spoiled);
  goToBizPhase('bizPhaseDayIntro');
}
function renderBizDayIntro(finance, spoiled){
  updateBizHeaderUI();
  updateBizContextBar();
  const day = state.businessLemonadeDay || 1;
  const dow = bizDayOfWeek(day);
  document.getElementById('bizDayIntroTitle').textContent = `День ${day} (${dow.short}). Доброе утро!`;
  const w = bizWeatherInfo();
  document.getElementById('bizWeatherCard').textContent = `${w.icon} Погода: ${w.name} · ${dow.name}${dow.weekend ? ' (выходной)' : ''}`;
  const messages = [];
  if(finance && finance.repaidInfo){
    const { paid, owed, shortfall } = finance.repaidInfo;
    messages.push(shortfall > 0
      ? `🤝 Пора было вернуть другу ${owed} ₽ — отдал ${paid} ₽, не хватило ${shortfall} ₽. Друг не обиделся, но постарайся быть аккуратнее с деньгами.`
      : `🤝 Ты вернул другу долг: ${paid} ₽. Спасибо за помощь!`);
  }
  if(finance && finance.loanInfo){
    const { borrowed, owed, dueDay } = finance.loanInfo;
    messages.push(`💰 Капитал совсем закончился — друг одолжил ${borrowed} ₽, чтобы бизнес не встал. Верни ${owed} ₽ (на 20% больше — такова цена займа) до дня ${dueDay}.`);
  } else if((state.businessLemonadeLoanOwed || 0) > 0){
    messages.push(`💰 Не забудь: ты должен другу ${state.businessLemonadeLoanOwed} ₽, вернуть до дня ${state.businessLemonadeLoanDueDay}.`);
  }
  const financeEl = document.getElementById('bizFinanceNoticeCard');
  if(messages.length){ financeEl.style.display = 'block'; financeEl.innerHTML = messages.join('<br><br>'); }
  else { financeEl.style.display = 'none'; }
  const spoilEl = document.getElementById('bizLemonSpoilCard');
  if(spoiled > 0){
    spoilEl.style.display = 'block';
    spoilEl.textContent = `🍋 ${spoiled} лимон(ов) испортились — пролежали больше ${BIZ_LEMON_SHELF_DAYS} дней. В следующий раз покупай столько, сколько успеешь использовать!`;
  } else {
    spoilEl.style.display = 'none';
  }
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
    const price = bizUpgradePrice(u.basePrice);
    const affordable = (state.businessLemonadeCapital || 0) >= price;
    return `<button type="button" class="biz-upgrade-btn${affordable ? '' : ' biz-upgrade-owned'}" data-key="${k}" ${affordable ? '' : 'disabled'}>${u.name} — ${u.desc}<span class="biz-upgrade-price">${price} ₽</span></button>`;
  }).join('');
  btnsWrap.querySelectorAll('.biz-upgrade-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const k = btn.dataset.key;
      const u = BIZ_UPGRADES[k];
      const price = bizUpgradePrice(u.basePrice);
      if((state.businessLemonadeCapital || 0) < price) return;
      state.businessLemonadeCapital -= price;
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
  // Подстраховка: если всё, что было, ушло на развитие выше, снова
  // проверяем, хватает ли денег хотя бы на самую скромную закупку дня.
  const finance = bizHandleDailyFinance();
  if(finance.loanInfo){
    updateBizHeaderUI();
    showToast(`💰 Друг одолжил ещё ${finance.loanInfo.borrowed} ₽ — капитал совсем закончился`);
  }
  renderBizLocationList();
  document.getElementById('bizLocationEventCard').style.display = 'none';
  document.getElementById('bizToHoursBtn').disabled = true;
  goToBizPhase('bizPhaseLocation');
});

/* ============ ШАГ 1: МЕСТО ТОРГОВЛИ (+ событие места) ============ */
function renderBizLocationList(){
  const wrap = document.getElementById('bizLocationList');
  const dow = bizDayOfWeek(state.businessLemonadeDay || 1);
  wrap.innerHTML = Object.keys(BIZ_LOCATIONS).map(key=>{
    const loc = BIZ_LOCATIONS[key];
    const on = state.businessLemonadeLocation === key;
    const flowMult = dow.weekend ? loc.weekendMult : loc.weekdayMult;
    const flowNote = flowMult >= 1.15 ? ' · сегодня людно' : (flowMult <= 0.6 ? ' · сегодня малолюдно' : '');
    return `<button type="button" class="biz-location-item${on ? ' on' : ''}" data-key="${key}">
      <div class="biz-location-name">${loc.icon} ${loc.name}</div>
      <div class="biz-location-hint">${loc.hint}${flowNote}</div>
      <div class="biz-location-rent">🏠 Аренда: ${loc.rentPerHour} ₽/час</div>
    </button>`;
  }).join('');
  wrap.querySelectorAll('.biz-location-item').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      playSuccessSound();
      const key = btn.dataset.key;
      state.businessLemonadeLocation = key;
      // Событие зависит от выбранного места — узнаём его только сейчас.
      const eligible = BIZ_EVENTS.filter(e => !e.locations || e.locations.includes(key));
      const ev = Math.random() < BIZ_EVENT_CHANCE ? bizPickRandom(eligible) : null;
      state.businessLemonadeEventIdx = ev ? BIZ_EVENTS.indexOf(ev) : -1;
      state.businessLemonadeCompetitorPrice = (ev && ev.competitorPrice) ? ev.competitorPrice : null;
      saveState();
      renderBizLocationList();
      const evEl = document.getElementById('bizLocationEventCard');
      if(ev){
        evEl.style.display = 'block';
        evEl.textContent = `${ev.icon} ${ev.name}`;
        // Карточка события стоит над списком локаций — на длинном списке
        // подскролливаем к ней, чтобы она точно попала в кадр.
        setTimeout(()=>{ evEl.scrollIntoView({behavior:'smooth', block:'center'}); }, 50);
      } else {
        evEl.style.display = 'none';
      }
      updateBizContextBar();
      document.getElementById('bizToHoursBtn').disabled = false;
    });
  });
}
document.getElementById('bizToHoursBtn').addEventListener('click', ()=>{
  if(!state.businessLemonadeLocation) return;
  playSuccessSound();
  renderBizHoursGroup();
  goToBizPhase('bizPhaseHours');
});

/* ============ ШАГ 2: ВРЕМЯ РАБОТЫ ============ */
function renderBizHoursGroup(){
  document.querySelectorAll('#bizHoursGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === state.businessLemonadeHours);
  });
  // Показываем расчёт аренды для выбранного времени
  const preview = document.getElementById('bizRentPreview');
  if(preview){
    const hours = state.businessLemonadeHours;
    const loc = BIZ_LOCATIONS[state.businessLemonadeLocation];
    if(hours && loc){
      const rent = loc.rentPerHour * hours;
      preview.textContent = `🏠 Аренда: ${loc.rentPerHour} ₽/час × ${hours} ч = ${rent} ₽`;
    } else {
      preview.textContent = '';
    }
  }
}
document.querySelectorAll('#bizHoursGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    playSuccessSound();
    state.businessLemonadeHours = parseInt(btn.dataset.value, 10);
    saveState();
    renderBizHoursGroup();
    updateBizContextBar();
    document.getElementById('bizToLemonsBtn').disabled = false;
  });
});
document.getElementById('bizToLemonsBtn').addEventListener('click', ()=>{
  if(!state.businessLemonadeHours) return;
  playSuccessSound();
  renderBizLemonsPhase();
  goToBizPhase('bizPhaseLemons');
});
// Обработчик выбора количества стаканов для каждого напитка
function renderBizQuantityGroup(){
  // Кнопки лимонада
  document.querySelectorAll('#bizLemonQuantityGroup .starter-btn').forEach(btn=>{
    const v = parseInt(btn.dataset.value, 10);
    const stock = state.businessLemonadeLemonStock || 0;
    btn.classList.toggle('on', v === (state.businessLemonadeCups || 10));
    btn.disabled = v > stock;
  });
  // Кнопки чая
  document.querySelectorAll('#bizTeaQuantityGroup .starter-btn').forEach(btn=>{
    const v = parseInt(btn.dataset.value, 10);
    const stock = state.businessLemonadeTeaStock || 0;
    btn.classList.toggle('on', v === (state.businessLemonadeTeaCups || 10));
    btn.disabled = v > stock;
  });
  updateBizBuyBreakdownUI();
}
document.querySelectorAll('#bizLemonQuantityGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(btn.disabled) return;
    state.businessLemonadeCups = parseInt(btn.dataset.value, 10);
    saveState();
    renderBizQuantityGroup();
  });
});
document.querySelectorAll('#bizTeaQuantityGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(btn.disabled) return;
    state.businessLemonadeTeaCups = parseInt(btn.dataset.value, 10);
    saveState();
    renderBizQuantityGroup();
  });
});
// Функция для подсветки выбранной цены чая
function renderBizTeaPriceGroup(){
  document.querySelectorAll('#bizTeaPriceGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (state.businessLemonadeTeaPrice || 15));
  });
}
// Обработчик цены чая
document.querySelectorAll('#bizTeaPriceGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    playSuccessSound();
    state.businessLemonadeTeaPrice = parseInt(btn.dataset.value, 10);
    saveState();
    renderBizTeaPriceGroup();
  });
});

/* ============ ШАГ 3: ЗАКУПКА ЛИМОНОВ И ПАКЕТИКОВ ЧАЯ ПРО ЗАПАС ============ */
function renderBizLemonsPhase(){
  const lemonStock = state.businessLemonadeLemonStock || 0;
  const teaStock = state.businessLemonadeTeaStock || 0;
  const boughtDay = state.businessLemonadeLemonBoughtDay;
  const day = state.businessLemonadeDay || 1;
  const stockCard = document.getElementById('bizLemonStockCard');
  const stockParts = [];
  if(lemonStock > 0){
    const daysLeft = Math.max(0, BIZ_LEMON_SHELF_DAYS - (day - boughtDay));
    stockParts.push(`🍋 лимоны: ${lemonStock} шт. — испортятся через ${daysLeft} дн.`);
  }
  if(teaStock > 0){
    stockParts.push(`🍵 пакетики чая: ${teaStock} шт.`);
  }
  if(stockParts.length > 0){
    if(stockCard) stockCard.innerHTML = `В запасе: ${stockParts.join('<br>')}`;
  } else {
    if(stockCard) stockCard.textContent = 'Запасов нет — купи лимоны и/или пакетики чая, чтобы было из чего готовить напитки.';
  }
  const capital = state.businessLemonadeCapital || 0;
  const wrap = document.getElementById('bizLemonTiersGrid');
  const teaWrap = document.getElementById('bizTeaTiersGrid');
  const selLemonIdx = state.businessLemonadeSelectedLemonIdx ?? null;
  const selTeaIdx = state.businessLemonadeSelectedTeaIdx ?? null;
  const canBuyLemon = selLemonIdx !== null && capital >= (BIZ_LEMON_TIERS[selLemonIdx].qty * BIZ_LEMON_TIERS[selLemonIdx].pricePerUnit);
  const canBuyTea = selTeaIdx !== null && capital >= (BIZ_TEA_TIERS[selTeaIdx].qty * BIZ_TEA_TIERS[selTeaIdx].pricePerUnit);
  const nextBtn = document.getElementById('bizToBuyBtn');
  if(nextBtn) nextBtn.disabled = !(canBuyLemon || canBuyTea);
  wrap.innerHTML = BIZ_LEMON_TIERS.map((tier, i)=>{
    const total = tier.qty * tier.pricePerUnit;
    const affordable = capital >= total;
    const sel = (selLemonIdx === i) ? ' biz-tier-selected' : '';
    return `<button type="button" class="biz-lemon-tier-btn${affordable ? '' : ' biz-upgrade-owned'}${sel}" data-idx="${i}" ${affordable ? '' : 'disabled'}>Купить ${tier.qty} лимонов — по ${tier.pricePerUnit} ₽/шт<span class="biz-option-cost">Итого: ${total} ₽</span></button>`;
  }).join('');
  wrap.querySelectorAll('.biz-lemon-tier-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(btn.disabled) return;
      const newIdx = parseInt(btn.dataset.idx, 10);
      state.businessLemonadeSelectedLemonIdx = (selLemonIdx === newIdx) ? null : newIdx;
      saveState();
      renderBizLemonsPhase();
    });
  });
  // Пакетики чая: выбор подсвечивается, покупка — по кнопке «Дальше».
  if(teaWrap){
    teaWrap.innerHTML = BIZ_TEA_TIERS.map((tier, i)=>{
      const total = tier.qty * tier.pricePerUnit;
      const affordable = capital >= total;
      const sel = (selTeaIdx === i) ? ' biz-tier-selected' : '';
      return `<button type="button" class="biz-lemon-tier-btn${affordable ? '' : ' biz-upgrade-owned'}${sel}" data-idx="${i}" ${affordable ? '' : 'disabled'}>Купить ${tier.qty} пакетиков чая — по ${tier.pricePerUnit} ₽/шт<span class="biz-option-cost">Итого: ${total} ₽</span></button>`;
    }).join('');
    teaWrap.querySelectorAll('.biz-lemon-tier-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if(btn.disabled) return;
        const newIdx = parseInt(btn.dataset.idx, 10);
        state.businessLemonadeSelectedTeaIdx = (selTeaIdx === newIdx) ? null : newIdx;
        saveState();
        renderBizLemonsPhase();
      });
    });
  }
  // Кнопка «Дальше» активна только при наличии выбора для покупки
  // (лимоны или чай), а переход на этап закупки происходит даже при пустом запасе.
  if(nextBtn) nextBtn.disabled = !(canBuyLemon || canBuyTea);
}
// Кнопка «Дальше» — покупка выбранного + переход к приготовлению
function bizOnToBuy(){
  const nextBtn = document.getElementById('bizToBuyBtn');
  if(nextBtn && nextBtn.disabled) return;
  const lemonSel = state.businessLemonadeSelectedLemonIdx;
  const teaSel = state.businessLemonadeSelectedTeaIdx;
  let bought = false;
  if(lemonSel !== null && lemonSel !== undefined){
    const tier = BIZ_LEMON_TIERS[lemonSel];
    const total = tier.qty * tier.pricePerUnit;
    if((state.businessLemonadeCapital || 0) >= total){
      state.businessLemonadeCapital -= total;
      state.businessLemonadeLemonStock = (state.businessLemonadeLemonStock || 0) + tier.qty;
      state.businessLemonadeLemonBoughtDay = state.businessLemonadeDay || 1;
      state.businessLemonadeSelectedLemonIdx = null;
      bought = true;
      playSuccessSound();
      showToast(`Куплено ${tier.qty} лимонов за ${total} ₽`);
    }
  }
  if(teaSel !== null && teaSel !== undefined){
    const tier = BIZ_TEA_TIERS[teaSel];
    const total = tier.qty * tier.pricePerUnit;
    if((state.businessLemonadeCapital || 0) >= total){
      state.businessLemonadeCapital -= total;
      state.businessLemonadeTeaStock = (state.businessLemonadeTeaStock || 0) + tier.qty;
      state.businessLemonadeSelectedTeaIdx = null;
      bought = true;
      playSuccessSound();
      showToast(`Куплено ${tier.qty} пакетиков чая за ${total} ₽`);
    }
  }
  if(bought){
    saveState();
    updateBizHeaderUI();
    updateBizContextBar();
    renderBizLemonsPhase();
  }
  if((state.businessLemonadeLemonStock || 0) <= 0 && (state.businessLemonadeTeaStock || 0) <= 0) return;
  renderBizQuantityGroup();
  renderBizOptionsGrid();
  goToBizPhase('bizPhaseBuy');
}
// Регистрируем обработчик клика по кнопке «Дальше: закупка остального»
const bizToBuyBtnEl = document.getElementById('bizToBuyBtn');
if(bizToBuyBtnEl){
  bizToBuyBtnEl.addEventListener('click', bizOnToBuy);
}

/* ============ ШАГ 4: ЗАКУПКА ОСТАЛЬНЫХ ПРОДУКТОВ ============ */
// Лимоны сюда не входят — они уже оплачены и просто расходуются из запаса
// (см. "Шаг 3"), поэтому в бюджет дня их стоимость не добавляется повторно.
function bizBuyBreakdown(cups, options, locationKey, hours, isTea){
  const optionCosts = {};
  let optionsCost = 0;
  Object.keys(BIZ_OPTIONS).forEach(key=>{
    const opt = BIZ_OPTIONS[key];
    const on = !!(options && options[key]);
    const cost = on ? (opt.costType === 'perCup' ? cups * opt.cost : opt.cost) : 0;
    optionCosts[key] = cost;
    optionsCost += cost;
  });
  let sugarCost, cupCost, waterCost;
  if(isTea){
    // Чай: сахар + вода(0) + стаканчик. Пакетики уже куплены про запас (шаг 3),
    // поэтому в расходы дня они входят как 0 ₽ — так же, как лимоны у лимонада.
    sugarCost = cups * BIZ_TEA_COSTS.sugar;
    cupCost = cups * BIZ_TEA_COSTS.cup;
    waterCost = cups * BIZ_TEA_COSTS.water;
  } else {
    // Лимонад: лимоны(уже куплены) + сахар + вода(0) + стаканчик
    sugarCost = cups * BIZ_SUGAR_PER_CUP;
    cupCost = cups * BIZ_CUP_PER_CUP;
    waterCost = cups * BIZ_WATER_PER_CUP;
  }
  const materials = sugarCost + cupCost + waterCost + optionsCost;
  const rentPerHour = (BIZ_LOCATIONS[locationKey] || { rentPerHour: 0 }).rentPerHour;
  const rent = rentPerHour * (hours || 1);
  return { sugarCost, cupCost, waterCost, optionCosts, optionsCost, rent, total: materials + rent, isTea };
}
function renderBizOptionsGrid(){
  const wrap = document.getElementById('bizOptionsGrid');
  if(!state.businessLemonadeOptions) state.businessLemonadeOptions = {};
  const options = state.businessLemonadeOptions;
  wrap.innerHTML = Object.keys(BIZ_OPTIONS).map(key=>{
    const opt = BIZ_OPTIONS[key];
    const on = !!options[key];
    const name = opt.name;
    const hint = opt.hint;
    const priceLabel = opt.costType === 'perCup' ? `+${opt.cost} ₽/стакан` : `+${opt.cost} ₽/день`;
    const hintEl = hint ? `<span class="biz-option-hint">${hint}</span>` : '';
    return `<button type="button" class="biz-option-btn${on ? ' on' : ''}" data-key="${key}">${opt.icon} ${name}<span class="biz-option-cost">${priceLabel}</span>${hintEl}</button>`;
  }).join('');
  wrap.querySelectorAll('.biz-option-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const key = btn.dataset.key;
      state.businessLemonadeOptions[key] = !state.businessLemonadeOptions[key];
      saveState();
      playNeutralSound();
      renderBizOptionsGrid();
      updateBizBuyBreakdownUI();
    });
  });
}
const BIZ_INGREDIENT_LABELS = {
  sugarCost: '🧂 Сахар',
  cupCost: '🥤 Стаканчики',
  waterCost: '💧 Вода',
};
function updateBizBuyBreakdownUI(){
  const lemonCups = Math.min(state.businessLemonadeCups || 10, state.businessLemonadeLemonStock || 0);
  const teaCups = Math.min(state.businessLemonadeTeaCups || 10, state.businessLemonadeTeaStock || 0);
  const options = state.businessLemonadeOptions || {};
  const lemonExpenses = bizDrinkExpenses(lemonCups, 'lemonade');
  const teaExpenses = bizDrinkExpenses(teaCups, 'tea');
  const rentPerHour = (BIZ_LOCATIONS[state.businessLemonadeLocation] || { rentPerHour: 0 }).rentPerHour;
  const rent = rentPerHour * (state.businessLemonadeHours || 1);
  let optionsCost = 0;
  Object.keys(BIZ_OPTIONS).forEach(key=>{
    if(options[key]){
      const opt = BIZ_OPTIONS[key];
      optionsCost += opt.costType === 'perCup' ? (lemonCups + teaCups) * opt.cost : opt.cost;
    }
  });
  const total = lemonExpenses + teaExpenses + rent + optionsCost;

  const rowsEl = document.getElementById('bizBuyBreakdownRows');
  let rowsHtml = '';
  if(lemonCups > 0){
    rowsHtml += `<div class="biz-breakdown-row"><span>🍋 Лимоны (из запаса)</span><span>${lemonCups} шт. · 0 ₽</span></div>`;
    rowsHtml += `<div class="biz-breakdown-row"><span>🧾 Лимонад: сахар + стаканчики</span><span>${lemonExpenses} ₽</span></div>`;
  }
  if(teaCups > 0){
    rowsHtml += `<div class="biz-breakdown-row"><span>☕ Пакетики чая (из запаса)</span><span>${teaCups} шт. · 0 ₽</span></div>`;
    rowsHtml += `<div class="biz-breakdown-row"><span>🧾 Чай: сахар + стаканчики</span><span>${teaExpenses} ₽</span></div>`;
  }
  Object.keys(BIZ_OPTIONS).forEach(key=>{
    if(!options[key]) return;
    const opt = BIZ_OPTIONS[key];
    const optCost = opt.costType === 'perCup' ? (lemonCups + teaCups) * opt.cost : opt.cost;
    rowsHtml += `<div class="biz-breakdown-row"><span>${opt.icon} ${opt.name}</span><span>${optCost} ₽</span></div>`;
  });
  rowsHtml += `<div class="biz-breakdown-row"><span>🏠 Аренда места</span><span>${rent} ₽</span></div>`;
  rowsEl.innerHTML = rowsHtml;
  document.getElementById('bizBuyTotalRow').textContent = `${total} ₽`;
  const warnEl = document.getElementById('bizBuyWarning');
  const capital = state.businessLemonadeCapital || 0;
  const overBudget = total > capital;
  const lemonStock = state.businessLemonadeLemonStock || 0;
  const teaStock = state.businessLemonadeTeaStock || 0;
  const lemonShort = (lemonCups > 0 && state.businessLemonadeCups > lemonStock);
  const teaShort = (teaCups > 0 && state.businessLemonadeTeaCups > teaStock);
  if(warnEl){
    const problems = [];
    if(lemonShort) problems.push(`не хватает лимонов: нужно ${state.businessLemonadeCups} шт., в запасе ${lemonStock} шт.`);
    if(teaShort) problems.push(`не хватает пакетиков чая: нужно ${state.businessLemonadeTeaCups} шт., в запасе ${teaStock} шт.`);
    if(overBudget) problems.push(`не хватает денег: расходы ${total} ₽ больше, чем капитал ${capital} ₽`);
    warnEl.style.display = problems.length ? 'block' : 'none';
    warnEl.textContent = problems.length ? `Пока нельзя продолжить: ${problems.join('; ')}. Уменьши количество стаканов, отключи опции или докупи кнопкой выше${overBudget ? ' (или попроси у друга в долг кнопкой ниже)' : ''}.` : '';
  }
  const nextBtn = document.getElementById('bizToPriceBtn');
  if(nextBtn) nextBtn.disabled = overBudget || lemonShort || teaShort;
  // Кнопка займа: показываем только когда денег на день не хватает — так игрок
  // никогда не застревает на шаге «Приготовление напитков» из-за пустого капитала.
  const loanBtn = document.getElementById('bizLoanBtn');
  if(loanBtn){
    if(overBudget){
      const need = b.total - capital;
      const borrow = bizLoanAmountForNeed(need);
      const owed = Math.round(borrow * BIZ_LOAN_INTEREST);
      loanBtn.style.display = 'block';
      loanBtn.textContent = (state.businessLemonadeLoanOwed > 0 ? '🤝 Занять у друга ещё ' : '🤝 Занять у друга ') + `${borrow} ₽ (вернуть ${owed} ₽)`;
    } else {
      loanBtn.style.display = 'none';
    }
  }
  renderBizQuickBuy();
}

/* --- Докупка ингредиентов прямо на шаге 4 --- */
// Минимальный набор (tier), покрывающий потребность need; если такого нет — самый большой.
function bizPickTierForNeed(tiers, need){
  if(!need || need <= 0) return null;
  let best = null;
  for(const t of tiers){
    if(t.qty >= need && (!best || t.qty < best.qty)) best = t;
  }
  if(!best) best = tiers.reduce((a,b)=> b.qty > a.qty ? b : a, tiers[0]);
  return best;
}
function renderBizQuickBuy(){
  const lbtn = document.getElementById('bizQuickBuyLemonBtn');
  const tbtn = document.getElementById('bizQuickBuyTeaBtn');
  if(!lbtn || !tbtn) return;
  const cap = state.businessLemonadeCapital || 0;
  const lemonNeed = Math.max(0, (state.businessLemonadeCups || 10) - (state.businessLemonadeLemonStock || 0));
  const teaNeed = Math.max(0, (state.businessLemonadeTeaCups || 10) - (state.businessLemonadeTeaStock || 0));
  const lt = bizPickTierForNeed(BIZ_LEMON_TIERS, lemonNeed);
  const tt = bizPickTierForNeed(BIZ_TEA_TIERS, teaNeed);
  if(lemonNeed > 0 && lt){
    const total = lt.qty * lt.pricePerUnit;
    lbtn.textContent = `🍋 Докупить ${lt.qty} лимонов — ${total} ₽`;
    lbtn.disabled = cap < total;
  } else {
    lbtn.textContent = '🍋 Лимонов хватает ✓';
    lbtn.disabled = true;
  }
  if(teaNeed > 0 && tt){
    const total = tt.qty * tt.pricePerUnit;
    tbtn.textContent = `🍵 Докупить ${tt.qty} пакетиков чая — ${total} ₽`;
    tbtn.disabled = cap < total;
  } else {
    tbtn.textContent = '🍵 Пакетиков чая хватает ✓';
    tbtn.disabled = true;
  }
}
document.getElementById('bizQuickBuyLemonBtn').addEventListener('click', function(){
  if(this.disabled) return;
  const need = Math.max(0, (state.businessLemonadeCups || 10) - (state.businessLemonadeLemonStock || 0));
  const tier = bizPickTierForNeed(BIZ_LEMON_TIERS, need);
  if(!tier) return;
  const total = tier.qty * tier.pricePerUnit;
  if((state.businessLemonadeCapital || 0) < total) return;
  state.businessLemonadeCapital -= total;
  state.businessLemonadeLemonStock = (state.businessLemonadeLemonStock || 0) + tier.qty;
  state.businessLemonadeLemonBoughtDay = state.businessLemonadeDay || 1;
  saveState();
  playSuccessSound();
  showToast(`Докуплено ${tier.qty} лимонов за ${total} ₽`);
  updateBizHeaderUI();
  updateBizContextBar();
  renderBizLemonsPhase();
  renderBizQuantityGroup();
  updateBizBuyBreakdownUI();
});
document.getElementById('bizQuickBuyTeaBtn').addEventListener('click', function(){
  if(this.disabled) return;
  const need = Math.max(0, (state.businessLemonadeTeaCups || 10) - (state.businessLemonadeTeaStock || 0));
  const tier = bizPickTierForNeed(BIZ_TEA_TIERS, need);
  if(!tier) return;
  const total = tier.qty * tier.pricePerUnit;
  if((state.businessLemonadeCapital || 0) < total) return;
  state.businessLemonadeCapital -= total;
  state.businessLemonadeTeaStock = (state.businessLemonadeTeaStock || 0) + tier.qty;
  saveState();
  playSuccessSound();
  showToast(`Докуплено ${tier.qty} пакетиков чая за ${total} ₽`);
  updateBizHeaderUI();
  updateBizContextBar();
  renderBizLemonsPhase();
  renderBizQuantityGroup();
  updateBizBuyBreakdownUI();
});
/* --- Займ у друга прямо на шаге 4: страховка от застревания без денег --- */
/* --- Займ у друга: единый расчёт суммы --- */
// Одалживает максимум из минимальной суммы на день и точной нехватки,
// округляя вверх до кратности 5 ₽, чтобы у ребёнка были круглые числа.
function bizLoanAmountForNeed(need){
  return Math.ceil(Math.max(BIZ_MIN_CAPITAL_FOR_DAY, Math.max(0, need)) / 5) * 5;
}
document.getElementById('bizLoanBtn').addEventListener('click', ()=>{
  const lemonCups = state.businessLemonadeCups || 10;
  const teaCups = state.businessLemonadeTeaCups || 10;
  // Берём общую сумму: расходы обоих напитков + аренда + опции
  const total = bizDrinkExpenses(lemonCups, 'lemonade') + bizDrinkExpenses(teaCups, 'tea')
    + (BIZ_LOCATIONS[state.businessLemonadeLocation] || { rentPerHour: 0 }).rentPerHour * (state.businessLemonadeHours || 1);
  let optionsCost = 0;
  Object.keys(BIZ_OPTIONS).forEach(key=>{
    if(state.businessLemonadeOptions[key]){
      const opt = BIZ_OPTIONS[key];
      optionsCost += opt.costType === 'perCup' ? (lemonCups + teaCups) * opt.cost : opt.cost;
    }
  });
  const need = (total + optionsCost) - (state.businessLemonadeCapital || 0);
  if(need <= 0) return;
  const borrow = bizLoanAmountForNeed(need);
  const owed = Math.round(borrow * BIZ_LOAN_INTEREST);
  state.businessLemonadeCapital = (state.businessLemonadeCapital || 0) + borrow;
  // Долги суммируются: можно попросить у друга несколько раз, если денег
  // всё равно не хватает. Возвращать до ближайшего из сроков.
  state.businessLemonadeLoanOwed = (state.businessLemonadeLoanOwed || 0) + owed;
  state.businessLemonadeLoanDueDay = Math.max(state.businessLemonadeLoanDueDay || 0, (state.businessLemonadeDay || 1) + BIZ_LOAN_DUE_DAYS);
  saveState();
  playSuccessSound();
  showToast(`🤝 Друг одолжил ${borrow} ₽. Верни ${state.businessLemonadeLoanOwed} ₽ до дня ${state.businessLemonadeLoanDueDay}`);
  updateBizHeaderUI();
  updateBizContextBar();
  renderBizQuantityGroup();
  updateBizBuyBreakdownUI();
});
document.getElementById('bizToPriceBtn').addEventListener('click', ()=>{
  if(document.getElementById('bizToPriceBtn').disabled) return;
  playSuccessSound();
  renderBizPriceGroup();
  renderBizTeaPriceGroup();
  const competitorEl = document.getElementById('bizCompetitorNote');
  const cp = state.businessLemonadeCompetitorPrice;
  if(cp){
    competitorEl.style.display = 'block';
    competitorEl.textContent = `🥤 Рядом продают лимонад по ${cp} ₽ за стакан. Поставишь цену ниже — переманишь покупателей; выше — часть уйдёт к конкуренту.`;
  } else {
    competitorEl.style.display = 'none';
  }
  goToBizPhase('bizPhasePrice');
});

/* ============ ШАГ 5: ЦЕНА ============ */
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
// Расчёт спроса на конкретный напиток с учётом всех факторов
function bizDrinkDemand(price, drinkType, weatherKey, locationKey, options, dow, hours){
  const isTea = drinkType === 'tea';
  // Базовая таблица спроса от цены
  let priceFrac;
  if(isTea){
    const teaPriceKey = Object.keys(BIZ_TEA_DEMAND).map(Number).sort((a,b)=>a-b).find(p => p >= price) || 30;
    priceFrac = BIZ_TEA_DEMAND[teaPriceKey] || 0.3;
  } else {
    priceFrac = BIZ_LEMONADE_DEMAND[price] !== undefined ? BIZ_LEMONADE_DEMAND[price] : 1;
  }
  const loc = BIZ_LOCATIONS[locationKey] || BIZ_LOCATIONS.school;
  const locWeatherMult = loc.demand[weatherKey] || 1;
  const locDowMult = dow.weekend ? loc.weekendMult : loc.weekdayMult;
  const ev = bizEventInfo();
  const eventMult = ev ? ev.mult : 1;
  const upgrades = state.businessLemonadeUpgrades || {};
  let upgradeMult = 1;
  Object.keys(BIZ_UPGRADES).forEach(k=>{ if(upgrades[k]) upgradeMult += BIZ_UPGRADES[k].mult; });
  let optionsMult = 1;
  if(options.ice){
    if(isTea){
      // Лёд для чая = холодный чай, особенно хорош в жару
      optionsMult *= (weatherKey === 'hot' ? 1.3 : 1.1);
    } else {
      // Лёд для лимонада
      optionsMult *= (weatherKey === 'hot' ? 1.15 : 0.9);
    }
  }
  if(options.umbrella) optionsMult *= 1.06;
  if(options.colorCup) optionsMult *= 1.08;
  if(options.straw) optionsMult *= 1.05;
  const hMult = bizHoursMult(hours);
  return priceFrac * locWeatherMult * locDowMult * eventMult * upgradeMult * optionsMult * hMult;
}

// Расчёт расходов на конкретный напиток (без аренды и опций)
function bizDrinkExpenses(cups, drinkType){
  const isTea = drinkType === 'tea';
  const sugarCost = cups * (isTea ? BIZ_TEA_COSTS.sugar : BIZ_SUGAR_PER_CUP);
  const cupCost = cups * (isTea ? BIZ_TEA_COSTS.cup : BIZ_CUP_PER_CUP);
  const waterCost = cups * (isTea ? BIZ_TEA_COSTS.water : BIZ_WATER_PER_CUP);
  return sugarCost + cupCost + waterCost;
}

function bizOptionDemandMult(key, weatherKey, options){
  const opt = BIZ_OPTIONS[key];
  const on = !!(options && options[key]);
  if(opt.weatherKey){
    if(weatherKey !== opt.weatherKey) return 1;
    return on ? opt.onMult : opt.offMult;
  }
  return on ? (opt.mult || 1) : 1;
}
function bizDemandFraction(price, weatherKey, locationKey, options, dow, hours){
  const priceFrac = BIZ_LEMONADE_DEMAND[price] !== undefined ? BIZ_LEMONADE_DEMAND[price] : 1;
  const loc = BIZ_LOCATIONS[locationKey] || BIZ_LOCATIONS.school;
  const locWeatherMult = loc.demand[weatherKey] !== undefined ? loc.demand[weatherKey] : 1;
  const locDowMult = dow && dow.weekend ? loc.weekendMult : loc.weekdayMult;
  const ev = bizEventInfo();
  const eventMult = ev ? ev.mult : 1;
  const competitorMult = bizCompetitorMult(price, state.businessLemonadeCompetitorPrice);
  const upgrades = state.businessLemonadeUpgrades || {};
  let upgradeMult = 1;
  Object.keys(BIZ_UPGRADES).forEach(k=>{ if(upgrades[k]) upgradeMult += BIZ_UPGRADES[k].mult; });
  let optionsMult = 1;
  Object.keys(BIZ_OPTIONS).forEach(k=>{ optionsMult *= bizOptionDemandMult(k, weatherKey, options); });
  const hMult = bizHoursMult(hours);
  return priceFrac * locWeatherMult * locDowMult * eventMult * competitorMult * upgradeMult * optionsMult * hMult;
}
function bizSellDay(){
  const dow = bizDayOfWeek(state.businessLemonadeDay || 1);
  const weatherKey = state.businessLemonadeWeatherKey || 'normal';
  const locationKey = state.businessLemonadeLocation;
  const hours = state.businessLemonadeHours || 1;
  const options = state.businessLemonadeOptions || {};
  const w = bizWeatherInfo();
  const loc = bizLocationInfo();

  // Количество стаканов и цены для каждого напитка
  const lemonCups = Math.min(state.businessLemonadeCups || 10, state.businessLemonadeLemonStock || 0);
  const teaCups = Math.min(state.businessLemonadeTeaCups || 10, state.businessLemonadeTeaStock || 0);
  const lemonPrice = state.businessLemonadePrice || 40;
  const teaPrice = state.businessLemonadeTeaPrice || 15;

  // Расчёт спроса на каждый напиток
  const lemonDemand = lemonCups > 0 ? bizDrinkDemand(lemonPrice, 'lemonade', weatherKey, locationKey, options, dow, hours) : 0;
  const teaDemand = teaCups > 0 ? bizDrinkDemand(teaPrice, 'tea', weatherKey, locationKey, options, dow, hours) : 0;

  // Погодное распределение покупателей: жара → лимонад, холод/дождь → чай
  let lemonShare, teaShare;
  if(weatherKey === 'hot'){
    lemonShare = 0.8; teaShare = 0.2;
  } else if(weatherKey === 'rain'){
    lemonShare = 0.2; teaShare = 0.8;
  } else {
    lemonShare = 0.6; teaShare = 0.4;
  }

  // Продажи каждого напитка с учётом спроса и распределения
  const totalDemand = lemonDemand + teaDemand;
  let lemonSold = 0, teaSold = 0;
  if(totalDemand > 0 && lemonCups > 0){
    const lemFrac = (lemonDemand / totalDemand) * lemonShare;
    lemonSold = Math.max(0, Math.min(lemonCups, Math.round(lemonCups * Math.min(1, lemFrac * 2))));
  }
  if(totalDemand > 0 && teaCups > 0){
    const teaFrac = (teaDemand / totalDemand) * teaShare;
    teaSold = Math.max(0, Math.min(teaCups, Math.round(teaCups * Math.min(1, teaFrac * 2))));
  }

  // Расходы: общие (аренда, опции) + на каждый напиток отдельно
  const rentPerHour = (BIZ_LOCATIONS[locationKey] || { rentPerHour: 0 }).rentPerHour;
  const rent = rentPerHour * hours;
  let optionsCost = 0;
  Object.keys(BIZ_OPTIONS).forEach(key=>{
    if(options[key]){
      const opt = BIZ_OPTIONS[key];
      optionsCost += opt.costType === 'perCup' ? (lemonCups + teaCups) * opt.cost : opt.cost;
    }
  });
  const lemonExpenses = bizDrinkExpenses(lemonCups, 'lemonade');
  const teaExpenses = bizDrinkExpenses(teaCups, 'tea');
  const totalExpenses = rent + optionsCost + lemonExpenses + teaExpenses;

  // Выручка
  const lemonRevenue = lemonPrice * lemonSold;
  const teaRevenue = teaPrice * teaSold;
  const totalRevenue = lemonRevenue + teaRevenue;

  // Прибыль
  const netProfit = Math.round(totalRevenue - totalExpenses);
  state.businessLemonadeSold = lemonSold + teaSold;
  state.businessLemonadeRevenue = totalRevenue;
  state.businessLemonadeNetProfit = netProfit;
  // Обновляем остатки обоих напитков
  state.businessLemonadeLemonStock = Math.max(0, (state.businessLemonadeLemonStock || 0) - lemonSold);
  if(state.businessLemonadeLemonStock === 0) state.businessLemonadeLemonBoughtDay = null;
  state.businessLemonadeTeaStock = Math.max(0, (state.businessLemonadeTeaStock || 0) - teaSold);

  // Капитал
  state.businessLemonadeCapital = Math.max(0, (state.businessLemonadeCapital || 0) + netProfit);
  if(!state.businessLemonadeDayProfits) state.businessLemonadeDayProfits = [];
  state.businessLemonadeDayProfits[(state.businessLemonadeDay || 1) - 1] = netProfit;

  // Лог дня
  if(!state.businessLemonadeDayLog) state.businessLemonadeDayLog = [];
  state.businessLemonadeDayLog[(state.businessLemonadeDay || 1) - 1] = {
    day: state.businessLemonadeDay || 1,
    dowShort: dow.short, dowName: dow.name,
    locationName: loc ? loc.name : '—', locationIcon: loc ? loc.icon : '❔',
    weatherIcon: w.icon, weatherName: w.name,
    lemonCups, lemonPrice, lemonSold, lemonExpenses, lemonRevenue,
    teaCups, teaPrice, teaSold, teaExpenses, teaRevenue,
    rent, optionsCost, totalExpenses, totalRevenue, netProfit,
  };

  saveState();

  // Обновляем UI результатов
  const highlightEl = document.getElementById('bizResultHighlight');
  highlightEl.textContent = (netProfit >= 0 ? '+' : '') + netProfit + ' ₽';
  highlightEl.classList.toggle('biz-loss', netProfit < 0);
  document.getElementById('bizResultsTitle').textContent = `Итоги дня ${state.businessLemonadeDay || 1} (${dow.short})`;

  // Показываем оба напитка в результатах
  const drinkBadge = document.getElementById('bizResDrinkBadge');
  if(drinkBadge) drinkBadge.textContent = '🍋 Лимонад и ☕ Чай';

  // Лимонад
  document.getElementById('bizResLemonLabel').textContent = '🍋 Лимонад';
  document.getElementById('bizResLemonSold').textContent = `${lemonSold} из ${lemonCups}`;
  document.getElementById('bizResLemonPrice').textContent = `${lemonPrice} ₽`;
  document.getElementById('bizResLemonRevenue').textContent = `${lemonRevenue} ₽`;
  const lemonRow = document.getElementById('bizResLemonRow');
  if(lemonRow) lemonRow.style.display = lemonCups > 0 ? '' : 'none';

  // Чай
  document.getElementById('bizResTeaLabel').textContent = '☕ Чай';
  document.getElementById('bizResTeaSold').textContent = `${teaSold} из ${teaCups}`;
  document.getElementById('bizResTeaPrice').textContent = `${teaPrice} ₽`;
  document.getElementById('bizResTeaRevenue').textContent = `${teaRevenue} ₽`;
  const teaRow = document.getElementById('bizResTeaRow');
  if(teaRow) teaRow.style.display = teaCups > 0 ? '' : 'none';

  // Общие расходы, выручка и прибыль
  document.getElementById('bizResExpenses').textContent = `${totalExpenses} ₽`;
  document.getElementById('bizResRevenue').textContent = `${totalRevenue} ₽`;
  document.getElementById('bizResNetProfit').textContent = `${netProfit} ₽`;
  document.getElementById('bizNextDayBtn').textContent = bizGoalReached() ? '🎯 Цель достигнута! Итоги →' : 'Следующий день →';
  updateBizHeaderUI();
  updateBizContextBar();
  if(netProfit >= 0) playSuccessSound(); else playErrorSound();
  goToBizPhase('bizPhaseResults');
}
document.getElementById('bizNextDayBtn').addEventListener('click', ()=>{
  playSuccessSound();
  if(bizGoalReached()){
    startBizQuiz();
    return;
  }
  state.businessLemonadeDay = (state.businessLemonadeDay || 1) + 1;
  saveState();
  startBizDay();
});

/* ============ ПРОВЕРКА СЕБЯ (когда цель накопления достигнута) — вопросы каждый раз разные:
   часть построена на реальных числах именно этой партии (день лога
   выбирается случайно), часть — концептуальные вопросы из перемешанного
   пула с перемешанными вариантами ответа. ============ */
function bizNumericOptions(correct, suffix){
  const opts = new Set([correct]);
  const magnitude = Math.max(3, Math.round(Math.abs(correct) * 0.3));
  const deltas = [-magnitude, Math.max(2, Math.round(magnitude * 0.6)), magnitude * 2];
  deltas.forEach(d=>{
    let v = correct + d;
    let guard = 0;
    while(opts.has(v) && guard < 20){ v += bizRandInt(1, 4); guard++; }
    opts.add(v);
  });
  const arr = shuffle(Array.from(opts));
  return { options: arr.map(v => v + suffix), correct: arr.indexOf(correct) };
}
function bizNumericQuizFromLog(){
  const log = (state.businessLemonadeDayLog || []).filter(Boolean);
  if(log.length === 0) return null;
  const rec = log[bizRandInt(0, log.length - 1)];
  const templates = [
    ()=>{
      const correct = Math.round(rec.expenses / rec.cups);
      const { options, correct: idx } = bizNumericOptions(correct, ' ₽');
      return { q: `В день ${rec.day} (${rec.dowShort}, ${rec.locationName}) ты потратил ${rec.expenses} ₽ и сделал ${rec.cups} стаканов ${(rec.drinkType || "Лимонад").toLowerCase()}. Сколько стоил один стакан (себестоимость)?`, options, correct: idx };
    },
    ()=>{
      const correct = Math.round(rec.price - rec.costPerCup);
      const { options, correct: idx } = bizNumericOptions(correct, ' ₽');
      return { q: `В день ${rec.day} ты продавал стакан за ${rec.price} ₽, а себестоимость была ${rec.costPerCup} ₽. Сколько ты зарабатывал с одного стакана?`, options, correct: idx };
    },
    ()=>{
      const correct = rec.sold * rec.price;
      const { options, correct: idx } = bizNumericOptions(correct, ' ₽');
      return { q: `В день ${rec.day} (${rec.locationName}) ты продал ${rec.sold} стаканов ${(rec.drinkType || "Лимонад").toLowerCase()} по ${rec.price} ₽ за стакан. Какая была выручка (сколько всего заплатили покупатели)?`, options, correct: idx };
    },
    ()=>{
      const correct = rec.netProfit;
      const { options, correct: idx } = bizNumericOptions(correct, ' ₽');
      return { q: `В день ${rec.day} расходы составили ${rec.expenses} ₽, а выручка — ${rec.revenue} ₽. Какая получилась чистая прибыль?`, options, correct: idx };
    },
  ];
  return bizPickRandom(templates)();
}
function generateBizQuiz(){
  const quiz = [];
  const hasLog = (state.businessLemonadeDayLog || []).filter(Boolean).length > 0;
  const numericCount = hasLog ? 3 : 0;
  const seen = new Set();
  let guard = 0;
  while(quiz.length < numericCount && guard < 30){
    guard++;
    const q = bizNumericQuizFromLog();
    if(!q || seen.has(q.q)) continue;
    seen.add(q.q);
    quiz.push(q);
  }
  const conceptPool = shuffle(BIZ_QUIZ_CONCEPT_POOL);
  let ci = 0;
  while(quiz.length < 5 && ci < conceptPool.length){
    const item = conceptPool[ci++];
    const idxArr = shuffle(item.options.map((_, i)=>i));
    const options = idxArr.map(i => item.options[i]);
    quiz.push({ q: item.q, options, correct: idxArr.indexOf(item.correct) });
  }
  return shuffle(quiz);
}
function startBizQuiz(){
  state.businessLemonadeQuizIndex = 0;
  state.businessLemonadeQuizCorrect = 0;
  state.businessLemonadeQuizItems = generateBizQuiz();
  saveState();
  goToBizPhase('bizPhaseQuiz');
  renderBizQuizQuestion();
}
function renderBizQuizQuestion(){
  const idx = state.businessLemonadeQuizIndex || 0;
  const items = state.businessLemonadeQuizItems || [];
  const item = items[idx];
  if(!item){ showBizSummaryModal(); return; }
  document.getElementById('bizQuizProgress').textContent = `Вопрос ${idx + 1} из ${items.length}`;
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
  const item = (state.businessLemonadeQuizItems || [])[idx];
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
  if(totalProfit < 700) return { icon: '🍋', name: 'Начинающий продавец' };
  if(totalProfit < 1600) return { icon: '💼', name: 'Хороший бизнесмен' };
  return { icon: '👑', name: 'Лимонадный магнат' };
}
// Простой столбчатый график прибыли по дням недели — понятен ребёнку:
// столбик выше = заработал больше, красный столбик = день в минусе.
function renderBizWeekChart(log){
  const el = document.getElementById('bizSummaryChart');
  if(!el) return;
  if(log.length === 0){ el.innerHTML = ''; return; }
  const maxAbs = Math.max(10, ...log.map(r => Math.abs(r.netProfit)));
  el.innerHTML = log.map(rec=>{
    const pct = Math.max(6, Math.round((Math.abs(rec.netProfit) / maxAbs) * 100));
    const isLoss = rec.netProfit < 0;
    return `
      <div class="biz-chart-col">
        <div class="biz-chart-value">${rec.netProfit >= 0 ? '+' : ''}${rec.netProfit}</div>
        <div class="biz-chart-bar-track"><div class="biz-chart-bar${isLoss ? ' biz-chart-bar-loss' : ''}" style="height:${pct}%;"></div></div>
        <div class="biz-chart-label">${rec.dowShort}</div>
      </div>
    `;
  }).join('');
}
function showBizSummaryModal(){
  const items = state.businessLemonadeQuizItems || [];
  const correct = state.businessLemonadeQuizCorrect || 0;
  const total = items.length;
  const dayProfits = state.businessLemonadeDayProfits || [];
  const totalProfit = dayProfits.reduce((a,b)=>a+(b||0), 0);
  const tier = bizResultTier(totalProfit);
  const { goal, name, icon } = bizGoalInfo();
  const daysPlayed = (state.businessLemonadeDayLog || []).filter(Boolean).length;
  const dayWord = daysPlayed === 1 ? 'день' : (daysPlayed < 5 ? 'дня' : 'дней');
  document.getElementById('bizSummaryTitle').textContent = `${tier.icon} Цель достигнута: ${icon} ${name}!`;
  document.getElementById('bizSummaryIntro').textContent = `За ${daysPlayed} ${dayWord} ты накопил ${totalProfit >= 0 ? '+' : ''}${totalProfit} ₽ чистыми и достиг цели «${name}» (${goal} ₽). Правильных ответов в проверке: ${correct} из ${total}.`;
  const log = (state.businessLemonadeDayLog || []).filter(Boolean);
  renderBizWeekChart(log);
  // Разделение по напиткам: собираем данные по лимонаду и чаю из дневного лога
  const drinkStats = {
    'Лимонад': { sold:0, cups:0, revenue:0 },
    'Чай': { sold:0, cups:0, revenue:0 }
  };
  log.forEach(rec=>{
    if(rec.lemonCups > 0){
      drinkStats['Лимонад'].cups += rec.lemonCups || 0;
      drinkStats['Лимонад'].sold += rec.lemonSold || 0;
      drinkStats['Лимонад'].revenue += rec.lemonRevenue || 0;
    }
    if(rec.teaCups > 0){
      drinkStats['Чай'].cups += rec.teaCups || 0;
      drinkStats['Чай'].sold += rec.teaSold || 0;
      drinkStats['Чай'].revenue += rec.teaRevenue || 0;
    }
  });
  const drinkIcons = { 'Лимонад': '🍋', 'Чай': '☕' };
  const drinksBox = document.getElementById('bizSummaryDrinksBox');
  if(drinksBox){
    const order = ['Лимонад', 'Чай'].filter(k => drinkStats[k] && drinkStats[k].cups > 0);
    drinksBox.innerHTML = order.map(key=>{
      const d = drinkStats[key];
      return `
        <div class="biz-breakdown-box">
          <div class="biz-drink-title">${drinkIcons[key]} ${key}</div>
          <div class="biz-breakdown-row"><span>Приготовлено стаканов</span><span>${d.cups}</span></div>
          <div class="biz-breakdown-row"><span>Продано стаканов</span><span>${d.sold} из ${d.cups}</span></div>
          <div class="biz-breakdown-row"><span>Заработано (выручка)</span><span>${d.revenue} ₽</span></div>
        </div>
      `;
    }).join('');
  }
  document.getElementById('bizSummaryDaysBox').innerHTML = log.map(rec=>`
    <div class="biz-breakdown-row"><span>${rec.dowShort} ${rec.locationIcon} ${rec.locationName} ${rec.weatherIcon}</span><span>${rec.netProfit >= 0 ? '+' : ''}${rec.netProfit} ₽</span></div>
  `).join('');
  const checklist = ['Я знаю, что такое себестоимость.', 'Я знаю, что такое цена.', 'Я знаю, что такое прибыль.', 'Я знаю, что такое выручка и расходы.', 'Я понимаю, зачем вкладывать часть прибыли в развитие.'];
  document.getElementById('bizSummaryList').innerHTML = checklist.map(text=>`
    <div class="krokodil-summary-row">
      <span class="krokodil-summary-place">✅</span>
      <span class="krokodil-summary-name">${text}</span>
    </div>
  `).join('');
  showModal('businessLemonadeSummaryModal');
}
document.getElementById('bizPlayAgainBtn').addEventListener('click', ()=>{
  hideModal('businessLemonadeSummaryModal');
  goToBusinessLemonadeGame();
});
document.getElementById('closeBusinessLemonadeSummaryBtn').addEventListener('click', ()=>{
  hideModal('businessLemonadeSummaryModal');
  exitBusinessLemonadeGame();
});

/* ============ ВХОД/ВЫХОД ============ */
function goToBusinessLemonadeSetup(){
  goToGameSetup('businessLemonadeSetup', null, ()=>{
    renderBizGoalButtons();
  });
}
function exitBusinessLemonadeSetup(){
  document.getElementById('businessLemonadeSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('businessView');
}
function goToBusinessLemonadeGame(){
  goToGame('businessLemonadeSetup', 'businessLemonadeGame');
  state.businessLemonadeDay = 1;
  state.businessLemonadeCapital = BIZ_START_CAPITAL;
  state.businessLemonadeUpgrades = { sign: false, music: false, recipe: false, seller: false, secondStand: false };
  state.businessLemonadeLocation = null;
  state.businessLemonadeHours = null;
  state.businessLemonadeOptions = {};
  state.businessLemonadeLemonStock = 0;
  state.businessLemonadeLemonBoughtDay = null;
  state.businessLemonadeCompetitorPrice = null;
  state.businessLemonadeLoanOwed = 0;
  state.businessLemonadeLoanDueDay = null;
  state.businessLemonadeCups = 10;
  state.businessLemonadePrice = 40;
  state.businessLemonadeSold = 0;
  state.businessLemonadeRevenue = 0;
  state.businessLemonadeNetProfit = 0;
  state.businessLemonadeDayProfits = [];
  state.businessLemonadeDayLog = [];
  state.businessLemonadeQuizIndex = 0;
  state.businessLemonadeQuizCorrect = 0;
  state.businessLemonadeQuizItems = [];
  bizQuizAnswered = false;
  saveState();
  updateMuteBtn();
  requestWakeLock();
  startBizDay();
}
function exitBusinessLemonadeGame(){
  exitGame('businessLemonadeGame', 'businessLemonadeSetup');
}
// Выбор цели накопления на стартовом экране: запоминается в state и
// определяет условие завершения партии (накопить сумму чистыми).
function renderBizGoalButtons(){
  document.querySelectorAll('#bizGoalGroup .starter-btn').forEach(b=>{
    b.classList.toggle('on', parseInt(b.dataset.sum, 10) === (state.businessLemonadeGoal || 1000));
  });
}
document.querySelectorAll('#bizGoalGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    playSuccessSound();
    state.businessLemonadeGoal = parseInt(btn.dataset.sum, 10);
    state.businessLemonadeGoalName = btn.dataset.name;
    saveState();
    renderBizGoalButtons();
  });
});
document.getElementById('businessLemonadeSetupStartBtn').addEventListener('click', ()=>{ goToBusinessLemonadeGame(); });
document.getElementById('businessLemonadeSetupExitBtn').addEventListener('click', ()=>{ exitBusinessLemonadeSetup(); });
document.getElementById('businessLemonadeExitBtn').addEventListener('click', ()=>{ exitBusinessLemonadeGame(); });
(document.getElementById('businessLemonadeSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ showModal('businessLemonadeRulesModal'); });
setupRulesModal('businessLemonadeRulesModal', 'closeBusinessLemonadeRulesBtn');

