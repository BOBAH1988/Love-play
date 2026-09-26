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
  { sum: 1000,  name: 'поход в кафе',  icon: '☕' },
  { sum: 2500,  name: 'аттракционы',   icon: '🎡' },
  { sum: 5000,  name: 'ролики',        icon: '🛼' },
  { sum: 10000, name: 'велосипед',     icon: '🚲' },
  { sum: 50000, name: 'PlayStation 5', icon: '🎮' },
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
// perHour — сколько человек в среднем проходит мимо ларька за один час в
// этом месте. Это базовый ПОТОК ПОКУПАТЕЛЕЙ: за день он умножается на
// выбранное время работы, погоду, будни/выходные и событие (см. bizFootfall).
// demand — во сколько раз поток меняется от погоды.
const BIZ_LOCATIONS = {
  school:  { name: 'У школы', icon: '🏫', rentPerHour: 9, hint: 'В будни многолюдно, по выходным почти пусто', perHour: 3.5, demand: { hot: 1.05, normal: 1.0, rain: 0.8 }, weekdayMult: 1.3, weekendMult: 0.35 },
  station: { name: 'У остановки', icon: '🚌', rentPerHour: 0, hint: 'Много спешащих мимо людей в будни, аренда бесплатная', perHour: 3.2, demand: { hot: 0.95, normal: 1.0, rain: 0.85 }, weekdayMult: 1.25, weekendMult: 0.6 },
  mall:    { name: 'У торгового центра', icon: '🏬', rentPerHour: 15, hint: 'Людно каждый день, но аренда подороже', perHour: 4.1, demand: { hot: 1.0, normal: 1.05, rain: 1.1 }, weekdayMult: 1.0, weekendMult: 1.15 },
  park:    { name: 'В парке', icon: '🌳', rentPerHour: 6, hint: 'По выходным сюда приходят гулять семьями', perHour: 2.8, demand: { hot: 1.0, normal: 0.9, rain: 0.75 }, weekdayMult: 0.8, weekendMult: 1.3 },
  beach:   { name: 'На пляже', icon: '🏖️', rentPerHour: 18, hint: 'Отлично в жару, но пусто в дождь', perHour: 2.5, demand: { hot: 1.5, normal: 1.0, rain: 0.3 }, weekdayMult: 0.9, weekendMult: 1.2 },
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
// flow — приводит БОЛЬШЕ людей (вывеска и вторая тележка видны издалека),
// conv — те, кто подошёл, чаще решается купить (вкуснее, веселее, быстрее).
const BIZ_UPGRADES = {
  recipe:      { name: '🧪 Улучшенный рецепт', basePrice: 220, flow: 0,    conv: 0.12, desc: 'Вкуснее лимонад — чаще берут (+12% желающих купить)' },
  music:       { name: '🎵 Весёлая колонка', basePrice: 350, flow: 0,    conv: 0.15, desc: 'Засвидетали у ларька — чаще берут (+15%)' },
  sign:        { name: '🪧 Яркая вывеска', basePrice: 500, flow: 0.20, conv: 0,    desc: 'Видно издалека — мимо проходит больше людей (+20%)' },
  seller:      { name: '🧑‍💼 Позвать друга помогать', basePrice: 750, flow: 0,    conv: 0.30, desc: 'Обслуживает быстро, очередь не отпугивает (+30%)' },
  secondStand: { name: '🛒 Вторая тележка', basePrice: 1250, flow: 0.50, conv: 0,   desc: 'Торгуешь в двух местах — поток людей больше на 50%' },
};
// Цена улучшения фиксированная: партия больше не ограничена числом дней,
// поэтому снижать стоимость к концу партии больше не нужно.
function bizUpgradePrice(basePrice){
  return basePrice;
}
// Время работы: 1, 3 или 6 часов. Каждый лишний час — это новые прохожие,
// поэтому в формуле потока часы входят линейно (см. bizFootfall), а аренда
// считается по часам.
const BIZ_WORK_HOURS = [1, 3, 6];
// Опции к напитку. costType 'perCup' — цена за каждый ПРИГОТОВЛЕННЫЙ стакан
// (даже если его никто не купит), 'flatDay' — разовая плата за весь день.
// mult — во сколько раз опция повышает желание купить. Сила эффекта зависит
// от контекста: ice сильнее всего в жару и мешает в прохладу, umbrella спасает
// от солнца на пляже, colorCup и straw нравятся детям — у школы и в парке.
// priceShield — насколько опция «оправдывает» высокую цену: с дорогими
// добавками покупатель легче соглашается на неудобную цену.
const BIZ_OPTIONS = {
  ice:      { name: 'Лёд', icon: '🧊', costType: 'perCup', cost: 2, priceShield: 0.08, hint: 'В жару берут охлаждённый: ×1.25 в жару, ×0.9 в прохладу' },
  umbrella: { name: 'Зонтик', icon: '☂️', costType: 'perCup', cost: 1, priceShield: 0.06, hint: 'На пляже спасает от солнца: ×1.25 там, ×1.05 в остальных местах' },
  colorCup: { name: 'Цветной стакан', icon: '🧋', costType: 'perCup', cost: 1, priceShield: 0.06, hint: 'Дети выбирают яркое: ×1.2 у школы и в парке, ×1.08 в остальных местах' },
  straw:    { name: 'Узорная трубочка', icon: '🥤', costType: 'perCup', cost: 1, priceShield: 0.05, hint: 'Приятная мелочь: ×1.15 у школы и в парке, ×1.06 в остальных местах' },
};
// Спрос считается двумя шагами. Сначала ПОТОК — сколько человек вообще
// пройдёт мимо за день (bizFootfall), потом КОНВЕРСИЯ — какая доля из них
// реально купит стакан (bizConversion). Их произведение и есть число покупателей.
const BIZ_BASE_CONVERSION = 0.75;   // доля прохожих, которые купят стакан при средней цене
const BIZ_MAX_CONVERSION = 0.9;     // больше даже в идеале не покупают — все к одному ларьку не придут
const BIZ_DEMAND_JITTER = 0.07;     // разброс дня: кто-то придёт не сразу, кто-то свернёт
// Во сколько раз меняется желание купить в зависимости от цены. Промежутки
// считаются по соседним точкам, поэтому таблица не привязана к кнопкам.
const BIZ_PRICE_CONV = { 20: 1.20, 30: 1.0, 40: 0.80, 50: 0.60, 60: 0.42 };
// Сколько стаканов игрок может приготовить за день. Кнопки строятся из этого
// списка в renderBizQuantityGroup и отключаются, если лимонов в запасе меньше.
const BIZ_CUP_CHOICES = [10, 20, 30, 40];

// Лимоны — единственный продукт, который закупается заранее про запас (а не
// свежим каждый день) и портится, если пролежит больше 3 дней. Покупка
// оптом дешевле за штуку, но больше риск не успеть всё использовать.
const BIZ_LEMON_TIERS = [
   { qty: 0, pricePerUnit: 0 },
   { qty: 10, pricePerUnit: 4 },
   { qty: 20, pricePerUnit: 3 },
   { qty: 40, pricePerUnit: 2 },
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

// Вопросы финальной проверки — только логика («как заработать больше»),
// без вычислений: игра для детей от 7 лет, расчёты их пугают. Правильный
// ответ в каждом вопросе очевиден из жизненного опыта, а не из арифметики.
const BIZ_QUIZ_CONCEPT_POOL = [
  {
    q: 'Где лучше поставить ларёк в жаркий день?',
    options: ['В парке — там тише и прохладнее', 'У школы — там ученики идут на занятия', 'На пляже — там много желающих пить'],
    correct: 2
  },
  {
    q: 'Что поможет покупателям выбрать твой ларёк?',
    options: ['Поставить ларёк в тени, говорить тише и убрать вывеску', 'Чистый прилавок, вывеска и вежливое приветствие', 'Разложить стаканчики по порядку, но не здороваться с покупателями'],
    correct: 1
  },
  {
    q: 'Рядом конкурент продаёт лимонад дешевле. Как лучше ответить?',
    options: ['Сделать вкуснее и объяснить, чем хорош твой лимонад', 'Сразу поставить такую же низкую цену, даже если она ниже расходов', 'Убрать вывеску и продавать только постоянным знакомым'],
    correct: 0
  },
  {
    q: 'Ты поставил очень высокую цену. Что, скорее всего, произойдёт?',
    options: ['Покупателей станет больше, потому что высокая цена выглядит солиднее', 'Покупателей станет меньше, потому что они выберут дешевле', 'Число покупателей не изменится, ведь цена не влияет на выбор'],
    correct: 1
  },
  {
    q: 'На улице дождь, а прохожих стало мало. Как разумнее заработать?',
    options: ['Поднять цену, потому что оставшиеся покупатели обязательно согласятся', 'Закрыться до хорошей погоды, ничего не меняя в плане', 'Переехать туда, где больше людей, и заметнее оформить ларёк'],
    correct: 2
  },
  {
    q: 'Зачем часть прибыли вкладывать в развитие ларька?',
    options: ['Чтобы улучшить продажи и заработать больше в следующие дни', 'Чтобы сразу потратить все деньги и не думать о завтрашнем дне', 'Чтобы оставить деньги без дела и не менять ничего в работе'],
    correct: 0
  },
  {
    q: 'Покупателю понравился лимонад и обслуживание. Что вероятнее всего?',
    options: ['Он забудет вкус, даже если остался доволен покупкой', 'Он перестанет покупать, потому что ему понравилось', 'Он вернётся снова и расскажет о ларьке друзьям'],
    correct: 2
  },
  {
    q: 'Деньги закончились, а лимоны и стаканчики ещё нужны. Как подготовиться заранее?',
    options: ['Потратить всю выручку на развлечения, а потом взять всё в долг', 'Отложить часть выручки на следующую закупку', 'Купить только украшения, чтобы ларёк выглядел красивее'],
    correct: 1
  },
  {
    q: 'Друзья заметили, что мимо ларька проходит мало людей. Что разумнее сделать?',
    options: ['Перенести ларёк туда, где поток людей больше', 'Оставить место без изменений и ждать, пока покупатели сами его найдут', 'Уменьшить вывеску, чтобы ларёк не привлекал лишнего внимания'],
    correct: 0
  },
  {
    q: 'Лимоны подешевели, но быстро портятся. Какую партию лучше купить?',
    options: ['Как можно больше, чтобы надолго оставить их на складе', 'Ни одного, пока цена не станет ещё ниже', 'Столько, сколько успеешь продать, пока они свежие'],
    correct: 2
  },
  {
    q: 'Сегодня жарко, и рядом проходит праздник. Что лучше запланировать?',
    options: ['Сократить рабочий день, пока не закончился лимонад', 'Увеличить запас и поставить заметную вывеску', 'Спрятать цену, чтобы покупатели не сравнивали предложения'],
    correct: 1
  },
  {
    q: 'Покупатели спрашивают, почему твой лимонад дороже соседского. Что ответить?',
    options: ['Рассказать о свежих продуктах и аккуратном приготовлении', 'Сказать, что цена случайная, поэтому обсуждать её бессмысленно', 'Сделать вид, что вопрос не относится к покупке, и промолчать'],
    correct: 0
  },
  {
    q: 'Лимонад быстро заканчивается, а покупатели ещё подходят. Что разумнее?',
    options: ['Разливать по чуть-чуть, чтобы одного стакана хватило надолго', 'Поднять цену в пять раз, пока покупатели ждут в очереди', 'Рассчитать запас и докупить продукты к следующему дню'],
    correct: 2
  },
  {
    q: 'Что лучше проверить перед утренним открытием ларька?',
    options: ['Только погоду, потому что остальные вещи найдутся потом', 'Запас лимонов, стаканчики, сахар и чистый прилавок', 'Сколько денег можно потратить на украшения, не считая закупку'],
    correct: 1
  },
  {
    q: 'Друг предлагает помочь за небольшую плату, когда много покупателей. Как решить?',
    options: ['Согласиться, если помощь ускорит продажи и оставит прибыль', 'Отказаться всегда, потому что любая помощь только увеличивает расходы', 'Отдать другу всю выручку, чтобы он точно не обиделся'],
    correct: 0
  },
  {
    q: 'После удачного дня у тебя осталась прибыль. Как разумнее её использовать?',
    options: ['Потратить всё сразу, чтобы на следующий день снова занимать деньги', 'Спрятать деньги так, чтобы забыть точную сумму прибыли и расходы', 'Отложить часть на закупку и развитие, а остаток потратить'],
    correct: 2
  },
  {
    q: 'Как понять, что цена за стакан выбрана удачно?',
    options: ['Все стаканы расходятся мгновенно, но прибыль равна нулю', 'Покупатели покупают, а после расходов остаётся прибыль', 'Цена очень высокая, хотя покупателей почти нет'],
    correct: 1
  },
  {
    q: 'После дня работы получился убыток. Что полезнее всего сделать?',
    options: ['Разобрать расходы и изменить цену, место или закупку', 'Сразу закрыть ларёк, не выясняя причину убытка и не меняя план', 'Записать прибыль вместо убытка и ничего не менять в работе'],
    correct: 0
  },
  {
    q: 'Почему не стоит тратить все деньги на украшение ларька до закупки?',
    options: ['Украшения всегда делают вкус лимонада хуже, даже если они новые', 'Покупатели никогда не замечают внешний вид ларька и вывески', 'Может не хватить денег на лимоны, сахар и стаканчики'],
    correct: 2
  },
  {
    q: 'Рядом появился конкурент с такой же ценой. Как выделиться?',
    options: ['Сразу уйти, не сравнив место, погоду и расходы на аренду', 'Улучшить вкус, сервис или вывеску', 'Опустить цену до нуля, чтобы конкурент точно ушёл с площади'],
    correct: 1
  },
];

function bizPickRandom(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
// Форматирование суммы с пробелами для читаемости: 50000 → "50 000"
function bizFormatMoney(n){
  return String(n || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
function bizWeatherInfo(){ return BIZ_WEATHERS.find(w => w.key === state.businessLemonadeWeatherKey) || BIZ_WEATHERS[1]; }
function bizEventInfo(){ return state.businessLemonadeEventIdx >= 0 ? BIZ_EVENTS[state.businessLemonadeEventIdx] : null; }
function bizLocationInfo(){ return BIZ_LOCATIONS[state.businessLemonadeLocation] || null; }

// Распределение денег партии: капитал на руках (стартовые 200₽ и дневная
// выручка, из него платятся закупки) и резерв на цель — всё, что заработано
// сверх капитала. Для игрока это одна сумма, поэтому в интерфейсе они всегда
// показываются вместе (см. updateBizHeaderUI).
function bizMoneyTotal(){
  return (state.businessLemonadeReserve || 0) + (state.businessLemonadeMoney || 0);
}
// Свободные деньги (сверх резерва) — чистая прибыль, идёт к цели.
function bizTotalNet(){
  return state.businessLemonadeMoney || 0;
}
// Расход: сначала свободные, потом резерв (200 ₽ — для производства).
function bizSpend(amount){
  const money = state.businessLemonadeMoney || 0;
  const fromMoney = Math.min(amount, money);
  state.businessLemonadeMoney = money - fromMoney;
  const remaining = amount - fromMoney;
  const reserve = state.businessLemonadeReserve || 0;
  const fromReserve = Math.min(remaining, reserve);
  state.businessLemonadeReserve = reserve - fromReserve;
  return state.businessLemonadeReserve + state.businessLemonadeMoney;
}
function bizGoalInfo(){
  let goal = state.businessLemonadeGoal || 5000;
  let item = BIZ_GOALS.find(g => g.sum === goal);
  if(!item){
    // Сохранение со старой/удалённой целью (например, «500 на кино») —
    // мягко переносим на цель «ролики» по умолчанию, иначе прогресс-бар
    // и условие победы разъедутся.
    item = BIZ_GOALS[2];
    state.businessLemonadeGoal = item.sum;
    state.businessLemonadeGoalName = item.name;
  }
  // Имя и иконка берутся из списка, а не из state — переименование целей
  // не оставляет в старых сохранениях устаревших подписей.
  return { goal, name: item.name, icon: item.icon };
}
function bizGoalReached(){
  return bizTotalNet() >= (state.businessLemonadeGoal || 5000);
}
function updateBizHeaderUI(){
  const day = state.businessLemonadeDay || 1;
  const totalNet = bizTotalNet();
  const { goal, name, icon } = bizGoalInfo();
  // Прогресс-бар теперь показывает путь к цели накопления, а не дни.
  const pct = Math.max(0, Math.min(100, Math.round(totalNet / goal * 100)));
  document.getElementById('bizDayFill').style.width = pct + '%';
  document.getElementById('bizDayLabel').textContent = `День ${day} · ${icon} ${bizFormatMoney(totalNet)} из ${bizFormatMoney(goal)} ₽ (${name})`;
  // Единственная денежная строка: капитал + резерв на цель одной суммой.
  document.getElementById('bizMoneyRow').textContent = `💰 ${bizFormatMoney(bizMoneyTotal())} ₽`;
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
  const chips = [`${dow.short}`, `${w.icon}`];
  const loc = bizLocationInfo();
  if(loc) chips.push(`${loc.icon}`);
  const ev = bizEventInfo();
  if(ev) chips.push(`${ev.icon} Событие`);
  if(state.businessLemonadeHours) chips.push(`⏰ ${state.businessLemonadeHours} ч`);
  // Прогноз потока людей виден на всех шагах: именно он объясняет, почему
  // в одном месте продаётся больше, а в другом меньше.
  if(state.businessLemonadeHours && state.businessLemonadeLocation){
    const fc = bizForecast();
    chips.push(`👥 ≈${fc.people}`);
  }
  const lemonStock = state.businessLemonadeLemonStock || 0;
  if(lemonStock > 0) chips.push(`🍋 ${lemonStock} шт.`);
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
// (если денег не хватает даже на самую дешёвую закупку). Безопасно
// вызывать несколько раз за один день — повторный вызов ничего не меняет.
function bizHandleDailyFinance(){
  const day = state.businessLemonadeDay || 1;
  let repaidInfo = null;
  if((state.businessLemonadeLoanOwed || 0) > 0 && day >= (state.businessLemonadeLoanDueDay || 0)){
    const owed = state.businessLemonadeLoanOwed;
    const paid = Math.min(owed, bizMoneyTotal());
    bizSpend(paid);
    repaidInfo = { paid, owed, shortfall: owed - paid };
    state.businessLemonadeLoanOwed = 0;
    state.businessLemonadeLoanDueDay = null;
  }
  let loanInfo = null;
  if(bizMoneyTotal() < BIZ_MIN_CAPITAL_FOR_DAY && !(state.businessLemonadeLoanOwed > 0)){
    const borrowed = BIZ_MIN_CAPITAL_FOR_DAY;
    const owed = Math.round(borrowed * BIZ_LOAN_INTEREST);
    state.businessLemonadeReserve = (state.businessLemonadeReserve || 0) + borrowed;
    state.businessLemonadeLoanOwed = owed;
    state.businessLemonadeLoanDueDay = day + BIZ_LOAN_DUE_DAYS;
    loanInfo = { borrowed, owed, dueDay: state.businessLemonadeLoanDueDay };
  }
  return { repaidInfo, loanInfo };
}

/* ============ ШАГ 0: НАЧАЛО ДНЯ (погода/апгрейды) ============ */
function startBizDay(){
   state.businessLemonadeWeatherKey = bizPickRandom(BIZ_WEATHERS).key;
   state.businessLemonadeEventIdx = -1;
   state.businessLemonadeCompetitorPrice = null;
   state.businessLemonadeLocation = null;
   state.businessLemonadeHours = null;
   state.businessLemonadeOptions = {};
   state.businessLemonadeCups = 10;
   state.businessLemonadeSelectedLemonIdx = 1;
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
    messages.push(`💰 Деньги совсем закончились — друг одолжил ${borrowed} ₽, чтобы бизнес не встал. Верни ${owed} ₽ (на 20% больше — такова цена займа) до дня ${dueDay}.`);
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
    const affordable = (state.businessLemonadeMoney || 0) >= price;
    return `<button type="button" class="biz-upgrade-btn${affordable ? '' : ' biz-upgrade-owned'}" data-key="${k}" ${affordable ? '' : 'disabled'}>${u.name} — ${u.desc}<span class="biz-upgrade-price">${price} ₽</span></button>`;
  }).join('');
btnsWrap.querySelectorAll('.biz-upgrade-btn').forEach(btn=>{
     btn.addEventListener('click', ()=>{
       const k = btn.dataset.key;
       const u = BIZ_UPGRADES[k];
       const price = bizUpgradePrice(u.basePrice);
       const totalCapital = bizMoneyTotal();
       if(totalCapital < price) return;
       bizSpend(price);
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
    showToast(`💰 Друг одолжил ещё ${finance.loanInfo.borrowed} ₽ — деньги совсем закончились`);
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
    // Сколько человек проходит мимо за час именно сегодня: базовый поток
    // места, умноженный на погоду и на сегодняшний день недели.
    const weatherKey = state.businessLemonadeWeatherKey || 'normal';
    const todayPerHour = loc.perHour * (loc.demand[weatherKey] || 1) * flowMult;
    const perHourText = todayPerHour.toFixed(1).replace('.', ',');
    return `<button type="button" class="biz-location-item${on ? ' on' : ''}" data-key="${key}">
      <div class="biz-location-name">${loc.icon} ${loc.name}</div>
      <div class="biz-location-hint">${loc.hint}${flowNote}</div>
      <div class="biz-location-rent">👥 Сегодня мимо проходит ≈ ${perHourText} чел./час · 🏠 Аренда: ${loc.rentPerHour} ₽/час</div>
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
  updateBizFlowPreview();
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
/* ============ ШАГ 4: ПРОГНОЗ СПРОСА (общий для всех шагов) ============ */
// Прогноз без разброса — честное ожидание, на нём игрок решает, сколько
// готовить и какую цену ставить. Показывается на трёх шагах: время работы
// (только поток людей — цена ещё не выбрана), приготовление и цена.
function bizForecast(){
  const fc = bizDemandForecast(state.businessLemonadePrice || 30, false);
  fc.people = Math.round(fc.people);
  fc.rangeText = (fc.buyersMin === fc.buyersMax) ? `${fc.buyers}` : `${fc.buyersMin}–${fc.buyersMax}`;
  return fc;
}
// Поток людей известен уже после выбора места и времени — он не зависит от
// цены, поэтому его можно показать до закупки лимонов.
function updateBizFlowPreview(){
  const el = document.getElementById('bizFlowPreview');
  if(!el) return;
  const hours = state.businessLemonadeHours;
  if(!hours || !state.businessLemonadeLocation){ el.textContent = ''; return; }
  const fc = bizForecast();
  el.textContent = `👥 За ${hours} ч мимо ларька пройдёт ≈ ${fc.people} человек. Сколько из них купят стакан — зависит от цены и опций (это дальше).`;
}
// Прогноз покупателей на шаге «приготовление»: поток + желание купить при
// текущей цене. Если приготовлено больше прогноза — прямое предупреждение,
// что лишнее выбросят.
function updateBizDemandHint(){
  const el = document.getElementById('bizDemandHint');
  if(!el) return;
  const cups = Math.min(state.businessLemonadeCups || 0, state.businessLemonadeLemonStock || 0);
  if(cups <= 0 || !state.businessLemonadeHours){ el.style.display = 'none'; return; }
  const fc = bizForecast();
  el.style.display = 'block';
  if(fc.buyers >= cups){
    el.textContent = `👥 Мимо пройдёт ≈ ${fc.people} человек, купят ≈ ${fc.rangeText} (если цена останется ${state.businessLemonadePrice} ₽) — твоих ${cups} стаканов хватит всем.`;
  } else {
    el.textContent = `👥 Мимо пройдёт ≈ ${fc.people} человек, но купят только ≈ ${fc.rangeText} (при цене ${state.businessLemonadePrice} ₽). Приготовив ${cups}, ты выбросишь примерно ${cups - fc.buyers} стак. — деньги на них уже потрачены.`;
  }
  el.classList.toggle('biz-loss', fc.buyers < cups);
}
// Развёрнутый прогноз на шаге «цена»: сравнение спроса с тем, что приготовлено,
// и напоминание, что лишнее сгорает.
function updateBizDemandPreview(){
  const el = document.getElementById('bizDemandPreview');
  if(!el) return;
  const cups = Math.min(state.businessLemonadeCups || 0, state.businessLemonadeLemonStock || 0);
  const price = state.businessLemonadePrice || 30;
  const fc = bizForecast();
  const parts = [
    `👥 Мимо пройдёт ≈ ${fc.people} человек за ${state.businessLemonadeHours} ч.`,
    `🍋 Купят ≈ ${fc.rangeText} стак. (цена ${price} ₽).`,
  ];
  if(cups > 0){
    parts.push(fc.buyers >= cups
      ? `✅ Твоих ${cups} стаканов хватит — все уйдут покупателям.`
      : `⚠️ Покупателей меньше, чем стаканов: примерно ${cups - fc.buyers} из ${cups} останутся и сгорят. Попробуй приготовить ${Math.max(BIZ_CUP_CHOICES[0], Math.round(fc.buyers / 10) * 10)} стаканов или снизить цену.`);
  }
  el.textContent = parts.join(' ');
  el.classList.toggle('biz-loss', cups > fc.buyers);
}
// Обработчик выбора количества стаканов лимонада. Кнопки строятся из
// BIZ_CUP_CHOICES: сколько можно приготовить, столько и предлагаем, а лишние
// (на которые не хватает лимонов в запасе) просто отключаются.
function renderBizQuantityGroup(){
  const wrap = document.getElementById('bizLemonQuantityGroup');
  if(!wrap) return;
  const stock = state.businessLemonadeLemonStock || 0;
  // Если выбранного количества больше, чем позволяет запас (например, после
  // покупки меньшего пакета), молча снижаем до ближайшего доступного.
  const maxCups = Math.max(0, ...BIZ_CUP_CHOICES.filter(v => v <= stock));
  if(!BIZ_CUP_CHOICES.includes(state.businessLemonadeCups) || state.businessLemonadeCups > stock){
    state.businessLemonadeCups = maxCups || 0;
  }
  wrap.innerHTML = BIZ_CUP_CHOICES.map(v=>{
    const on = v === state.businessLemonadeCups;
    return `<button type="button" class="starter-btn mode-btn${on ? ' on' : ''}" data-value="${v}"${v > stock ? ' disabled' : ''}>${v} стаканов</button>`;
  }).join('');
  updateBizBuyBreakdownUI();
  updateBizDemandHint();
}
document.getElementById('bizLemonQuantityGroup').addEventListener('click', (e)=>{
  const btn = e.target.closest('.starter-btn');
  if(!btn || btn.disabled) return;
  state.businessLemonadeCups = parseInt(btn.dataset.value, 10);
  saveState();
  renderBizQuantityGroup();
});

/* ============ ШАГ 3: ЗАКУПКА ЛИМОНОВ ПРО ЗАПАС ============ */
function renderBizLemonsPhase(){
   if(state.businessLemonadeSelectedLemonIdx == null) state.businessLemonadeSelectedLemonIdx = 1;
   const lemonStock = state.businessLemonadeLemonStock || 0;
   const boughtDay = state.businessLemonadeLemonBoughtDay;
   const day = state.businessLemonadeDay || 1;
   const stockCard = document.getElementById('bizLemonStockCard');
   const stockParts = [];
 if(lemonStock > 0){
      const daysLeft = Math.max(0, BIZ_LEMON_SHELF_DAYS - (day - boughtDay));
      stockParts.push(`🍋 лимоны: ${lemonStock} шт. — испортятся через ${daysLeft} дн.`);
    }
    if(stockParts.length > 0){
      if(stockCard) stockCard.innerHTML = `В запасе: ${stockParts.join('<br>')}`;
    } else {
      if(stockCard) stockCard.textContent = 'Запасов нет — купи лимоны, чтобы было из чего готовить лимонад.';
    }
    // Все деньги партии — одна сумма: кнопки покупки ориентируются на неё же.
    const capital = bizMoneyTotal();
    const wrap = document.getElementById('bizLemonTiersGrid');
    const selLemonIdx = state.businessLemonadeSelectedLemonIdx;
 const totalAvailable = bizMoneyTotal();
     const canBuyLemon = selLemonIdx != null && totalAvailable >= (BIZ_LEMON_TIERS[selLemonIdx].qty * BIZ_LEMON_TIERS[selLemonIdx].pricePerUnit);
    const nextBtn = document.getElementById('bizToBuyBtn');
    if(nextBtn) nextBtn.disabled = !canBuyLemon;
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
        state.businessLemonadeSelectedLemonIdx = newIdx;
        saveState();
        renderBizLemonsPhase();
      });
    });
    // Кнопка «Дальше» активна только при наличии выбора для покупки
    // (лимоны или чай), а переход на этап закупки происходит даже при пустом запасе.
    if(nextBtn) nextBtn.disabled = !canBuyLemon;
}
// Кнопка «Дальше» — покупка выбранного + переход к приготовлению
function bizOnToBuy(){
   const nextBtn = document.getElementById('bizToBuyBtn');
   if(nextBtn && nextBtn.disabled) return;
   const lemonSel = state.businessLemonadeSelectedLemonIdx;
   let bought = false;
   const totalCapital = bizMoneyTotal();
   if(lemonSel != null){
     const tier = BIZ_LEMON_TIERS[lemonSel];
     const total = tier.qty * tier.pricePerUnit;
     if(totalCapital >= total){
       bizSpend(total);
       state.businessLemonadeLemonStock = (state.businessLemonadeLemonStock || 0) + tier.qty;
       state.businessLemonadeLemonBoughtDay = state.businessLemonadeDay || 1;
       state.businessLemonadeSelectedLemonIdx = null;
       bought = true;
       playSuccessSound();
       showToast(`Куплено ${tier.qty} лимонов за ${total} ₽`);
     }
   }
   if(bought){
     saveState();
     updateBizHeaderUI();
     updateBizContextBar();
     renderBizLemonsPhase();
   }
   if((state.businessLemonadeLemonStock || 0) <= 0) return;
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
      // Опции меняют спрос — прогноз покупателей должен обновиться сразу.
      updateBizDemandHint();
    });
  });
}
const BIZ_INGREDIENT_LABELS = {
  sugarCost: '🧂 Сахар',
  cupCost: '🥤 Стаканчики',
  waterCost: '💧 Вода',
};
function updateBizBuyBreakdownUI(){
   const lemonCups = Math.min(state.businessLemonadeCups || 0, state.businessLemonadeLemonStock || 0);
  const options = state.businessLemonadeOptions || {};
  const lemonExpenses = bizDrinkExpenses(lemonCups);
  const rentPerHour = (BIZ_LOCATIONS[state.businessLemonadeLocation] || { rentPerHour: 0 }).rentPerHour;
  const rent = rentPerHour * (state.businessLemonadeHours || 1);
  let optionsCost = 0;
  Object.keys(BIZ_OPTIONS).forEach(key=>{
    if(options[key]){
      const opt = BIZ_OPTIONS[key];
      optionsCost += opt.costType === 'perCup' ? lemonCups * opt.cost : opt.cost;
    }
  });
 const total = lemonExpenses + rent + optionsCost;
   const totalAvailable = bizMoneyTotal();

   const rowsEl = document.getElementById('bizBuyBreakdownRows');
  let rowsHtml = '';
  if(lemonCups > 0){
    rowsHtml += `<div class="biz-breakdown-row"><span>🍋 Лимоны (из запаса)</span><span>${lemonCups} шт. · 0 ₽</span></div>`;
    rowsHtml += `<div class="biz-breakdown-row"><span>🧾 Лимонад: сахар + стаканчики</span><span>${lemonExpenses} ₽</span></div>`;
  }
  // Лимоны покупаются пачками, а в конце дня весь запас сгорает: показываем
  // прямо в чеке, сколько купленного пропадёт зря.
  const lemonStockLeft = (state.businessLemonadeLemonStock || 0) - lemonCups;
  if(lemonStockLeft > 0){
    rowsHtml += `<div class="biz-breakdown-row"><span>🗑 Лишние лимоны</span><span>${lemonStockLeft} шт. — пропадут в конце дня (деньги уже потрачены)</span></div>`;
  }
  Object.keys(BIZ_OPTIONS).forEach(key=>{
    if(!options[key]) return;
    const opt = BIZ_OPTIONS[key];
    const optCost = opt.costType === 'perCup' ? lemonCups * opt.cost : opt.cost;
    rowsHtml += `<div class="biz-breakdown-row"><span>${opt.icon} ${opt.name}</span><span>${optCost} ₽</span></div>`;
  });
  rowsHtml += `<div class="biz-breakdown-row"><span>🏠 Аренда места</span><span>${rent} ₽</span></div>`;
  rowsEl.innerHTML = rowsHtml;
  document.getElementById('bizBuyTotalRow').textContent = `${total} ₽`;
  const warnEl = document.getElementById('bizBuyWarning');
   const overBudget = total > totalAvailable;
  const lemonStock = state.businessLemonadeLemonStock || 0;
  const lemonShort = (lemonCups > 0 && state.businessLemonadeCups > lemonStock);
  if(warnEl){
    const problems = [];
    if(lemonShort) problems.push(`не хватает лимонов: нужно ${state.businessLemonadeCups} шт., в запасе ${lemonStock} шт.`);
    if(overBudget) problems.push(`не хватает денег: расходы ${total} ₽ больше, чем доступно ${totalAvailable} ₽`);
     warnEl.style.display = problems.length ? 'block' : 'none';
     warnEl.textContent = problems.length ? `Пока нельзя продолжить: ${problems.join('; ')}. Уменьши количество стаканов, отключи опции или докупи кнопкой выше${overBudget ? ' (расходы списываются из общей суммы; если её не хватает — занять у друга кнопкой ниже)' : ''}.` : '';
  }
  const nextBtn = document.getElementById('bizToPriceBtn');
  if(nextBtn) nextBtn.disabled = overBudget || lemonShort;
  // Кнопка займа: показываем только когда денег на день не хватает — так игрок
  // никогда не застревает на шаге «Приготовление напитков» из-за пустого капитала.
  const loanBtn = document.getElementById("bizLoanBtn");
  if(loanBtn){
    if(overBudget){
      // Деньги партии — одна сумма (капитал + резерв), из неё и считаем нехватку.
      const needAfterReserve = Math.max(0, total - bizMoneyTotal());
      if(needAfterReserve <= 0){
        loanBtn.style.display = 'none';
      } else {
        const borrow = bizLoanAmountForNeed(needAfterReserve);
        const owed = Math.round(borrow * BIZ_LOAN_INTEREST);
        loanBtn.style.display = 'block';
        loanBtn.textContent = (state.businessLemonadeLoanOwed > 0 ? '🤝 Занять у друга ещё ' : '🤝 Занять у друга ') + `${borrow} ₽ (вернуть ${owed} ₽)`;
      }
    } else {
      loanBtn.style.display = 'none';
    }
  }
}

/* --- Займ у друга: единый расчёт суммы --- */
// Одалживает максимум из минимальной суммы на день и точной нехватки,
// округляя вверх до кратности 5 ₽, чтобы у ребёнка были круглые числа.
function bizLoanAmountForNeed(need){
  return Math.ceil(Math.max(BIZ_MIN_CAPITAL_FOR_DAY, Math.max(0, need)) / 5) * 5;
}
document.getElementById('bizLoanBtn').addEventListener('click', ()=>{
   const lemonCups = state.businessLemonadeCups || 0;
   // Берём общую сумму: расходы лимонада + аренда + опции
   const total = bizDrinkExpenses(lemonCups)
     + (BIZ_LOCATIONS[state.businessLemonadeLocation] || { rentPerHour: 0 }).rentPerHour * (state.businessLemonadeHours || 1);
   let optionsCost = 0;
   Object.keys(BIZ_OPTIONS).forEach(key=>{
     if(state.businessLemonadeOptions[key]){
       const opt = BIZ_OPTIONS[key];
       optionsCost += opt.costType === 'perCup' ? lemonCups * opt.cost : opt.cost;
     }
   });
 // Деньги партии — одна сумма (капитал + резерв); займ нужен только на то,
 // чего не хватает сверх неё.
     const moneyTotal = bizMoneyTotal();
     const needAfterReserve = Math.max(0, (total + optionsCost) - moneyTotal);
     if(needAfterReserve <= 0 && (total + optionsCost) > moneyTotal){
       // Своих денег хватает после списания — покрываем из общей суммы.
       const shortfall = (total + optionsCost) - moneyTotal;
       bizSpend(shortfall);
       saveState();
       playSuccessSound();
       showToast(`🤝 Оплачено из накоплений: ${shortfall} ₽`);
     } else if(needAfterReserve <= 0){
       return;
} else {
        const borrow = bizLoanAmountForNeed(needAfterReserve);
        const owed = Math.round(borrow * BIZ_LOAN_INTEREST);
        state.businessLemonadeMoney = (state.businessLemonadeMoney || 0) + borrow;
       // Долги суммируются: можно попросить у друга несколько раз, если денег
       // всё равно не хватает. Возвращать до ближайшего из сроков.
       state.businessLemonadeLoanOwed = (state.businessLemonadeLoanOwed || 0) + owed;
       state.businessLemonadeLoanDueDay = Math.max(state.businessLemonadeLoanDueDay || 0, (state.businessLemonadeDay || 1) + BIZ_LOAN_DUE_DAYS);
       saveState();
       playSuccessSound();
       showToast(`🤝 Друг одолжил ${borrow} ₽. Верни ${state.businessLemonadeLoanOwed} ₽ до дня ${state.businessLemonadeLoanDueDay}`);
     }
     updateBizHeaderUI();
     updateBizContextBar();
     renderBizQuantityGroup();
     updateBizBuyBreakdownUI();
    });
document.getElementById('bizToPriceBtn').addEventListener('click', ()=>{
  if(document.getElementById('bizToPriceBtn').disabled) return;
  playSuccessSound();
  renderBizPriceGroup();
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
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (state.businessLemonadePrice || 30));
  });
  // Прогноз покупателей зависит от цены сильнее всего — пересчитываем здесь.
  updateBizDemandPreview();
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
/* ---------- СПРОС: сколько стаканов купят сегодня ----------
   Считается в два шага, оба считаются ОДИН раз в день:
   1) ПОТОК (bizFootfall) — сколько человек вообще пройдёт мимо за день:
      место (perHour) × часы работы × погода × будни/выходные × событие ×
      развитие, которое приводит людей (вывеска, вторая тележка);
   2) КОНВЕРСИЯ (bizConversion) — какая доля прохожих купит стакан:
      цена, конкурент, вкус (рецепт/колонка/помощник) и опции к напитку.
   Покупатели = поток × конверсия. Стаканы продаются только тем, кто купил:
   приготовил больше, чем купили, — остаток сгорает (см. bizSellDay). */
function bizFootfall(locationKey, weatherKey, dow, hours){
  const loc = BIZ_LOCATIONS[locationKey] || BIZ_LOCATIONS.school;
  const locWeatherMult = loc.demand[weatherKey] || 1;
  const locDowMult = dow.weekend ? loc.weekendMult : loc.weekdayMult;
  const ev = bizEventInfo();
  const eventMult = ev ? ev.mult : 1;
  // Развитие, которое приводит ЛЮДЕЙ (а не увеличивает желание купить).
  const upgrades = state.businessLemonadeUpgrades || {};
  let upgradeFlow = 1;
  Object.keys(BIZ_UPGRADES).forEach(k=>{ if(upgrades[k]) upgradeFlow += BIZ_UPGRADES[k].flow; });
  // Часы работы: каждый лишний час — это новые прохожие, поэтому поток
  // растёт пропорционально времени (1 / 3 / 6 часов).
  return loc.perHour * hours * locWeatherMult * locDowMult * eventMult * upgradeFlow;
}
// Желание купить в зависимости от цены: между точками BIZ_PRICE_CONV
// считается по линейной интерполяции, поэтому таблица не привязана к кнопкам.
function bizPriceConvMult(price){
  const pts = Object.keys(BIZ_PRICE_CONV).map(Number).sort((a,b)=>a-b);
  const p = Math.max(pts[0], Math.min(pts[pts.length-1], Number(price) || pts[0]));
  for(let i = 0; i < pts.length - 1; i++){
    const lo = pts[i], hi = pts[i+1];
    if(p <= hi){
      const t = (p - lo) / (hi - lo);
      return BIZ_PRICE_CONV[lo] + (BIZ_PRICE_CONV[hi] - BIZ_PRICE_CONV[lo]) * t;
    }
  }
  return BIZ_PRICE_CONV[pts[pts.length-1]];
}
// Желание купить с учётом опций к напитку. Сила каждой опции зависит от
// места и погоды: лёд спасает в жару, зонтик — на пляже, яркий стакан и
// трубочка нравятся детям у школы и в парке. shield — насколько опции
// «оправдывают» высокую цену.
function bizOptionsConv(options, locationKey, weatherKey){
  const opts = options || {};
  const kidsPlace = locationKey === 'school' || locationKey === 'park';
  let mult = 1, shield = 0;
  if(opts.ice){
    mult *= (weatherKey === 'hot' ? 1.25 : 0.9);
    shield += BIZ_OPTIONS.ice.priceShield;
  }
  if(opts.umbrella){
    mult *= (locationKey === 'beach' ? 1.25 : 1.05);
    shield += BIZ_OPTIONS.umbrella.priceShield;
  }
  if(opts.colorCup){
    mult *= (kidsPlace ? 1.2 : 1.08);
    shield += BIZ_OPTIONS.colorCup.priceShield;
  }
  if(opts.straw){
    mult *= (kidsPlace ? 1.15 : 1.06);
    shield += BIZ_OPTIONS.straw.priceShield;
  }
  return { mult, shield: Math.min(0.5, shield) };
}
// Желание купить с учётом развития, которое влияет на вкус и скорость
// обслуживания (рецепт, колонка, помощник), и конкурента по соседству.
function bizConversion(price, options, weatherKey, locationKey){
  const priceRaw = bizPriceConvMult(price);
  const { mult: optMult, shield } = bizOptionsConv(options, locationKey, weatherKey);
  // Доп. услуги делают высокую цену терпимее: снимается часть скидки за цену.
  const priceMult = 1 + (priceRaw - 1) * (1 - shield);
  const upgrades = state.businessLemonadeUpgrades || {};
  let upgradeConv = 1;
  Object.keys(BIZ_UPGRADES).forEach(k=>{ if(upgrades[k]) upgradeConv += BIZ_UPGRADES[k].conv; });
  const competitorMult = bizCompetitorMult(price, state.businessLemonadeCompetitorPrice);
  return Math.min(BIZ_MAX_CONVERSION, BIZ_BASE_CONVERSION * priceMult * optMult * upgradeConv * competitorMult);
}
// Полный прогноз дня. rollJitter=true добавляет разброс реального дня
// (покупателей может оказаться чуть больше или меньше прогноза) — только
// в момент продаж, в интерфейсе показываем честный прогноз без разброса.
function bizDemandForecast(price, rollJitter){
  const dow = bizDayOfWeek(state.businessLemonadeDay || 1);
  const weatherKey = state.businessLemonadeWeatherKey || 'normal';
  const locationKey = state.businessLemonadeLocation || 'school';
  const hours = state.businessLemonadeHours || 1;
  const people = bizFootfall(locationKey, weatherKey, dow, hours);
  const conv = bizConversion(price, state.businessLemonadeOptions || {}, weatherKey, locationKey);
  const expected = people * conv;
  const factor = rollJitter ? (1 - BIZ_DEMAND_JITTER + Math.random() * BIZ_DEMAND_JITTER * 2) : 1;
  return {
    people, conv, expected,
    buyers: Math.max(0, Math.round(expected * factor)),
    buyersMin: Math.max(0, Math.round(expected * (1 - BIZ_DEMAND_JITTER))),
    buyersMax: Math.max(0, Math.round(expected * (1 + BIZ_DEMAND_JITTER))),
  };
}

// Расчёт расходов на лимонад (без аренды и опций)
function bizDrinkExpenses(cups){
   const sugarCost = cups * BIZ_SUGAR_PER_CUP;
   const cupCost = cups * BIZ_CUP_PER_CUP;
   const waterCost = cups * BIZ_WATER_PER_CUP;
   return sugarCost + cupCost + waterCost;
}

function bizSellDay(){
  const dow = bizDayOfWeek(state.businessLemonadeDay || 1);
  const weatherKey = state.businessLemonadeWeatherKey || 'normal';
  const locationKey = state.businessLemonadeLocation;
  const hours = state.businessLemonadeHours || 1;
  const options = state.businessLemonadeOptions || {};
  const w = bizWeatherInfo();
  const loc = bizLocationInfo();

 // Количество стаканов и цена лимонада
   const lemonCups = Math.min(state.businessLemonadeCups || 0, state.businessLemonadeLemonStock || 0);
 const lemonPrice = state.businessLemonadePrice || 30;

  // Расчёт спроса: сколько человек мимо пройдёт и сколько из них купит стакан.
  // Разброс дня ролится один раз здесь — в прогнозе интерфейса его нет, поэтому
  // фактические продажи отличаются от прогноза на пару стаканов.
  const forecast = bizDemandForecast(lemonPrice, true);
  const lemonBuyers = lemonCups > 0 ? forecast.buyers : 0;
  const lemonPeople = lemonCups > 0 ? Math.round(forecast.people) : 0;

  // Продажи: стакан покупает один человек, поэтому больше, чем купили
  // покупателей, продать невозможно. Нераспроданный остаток сгорает.
  const lemonSold = Math.max(0, Math.min(lemonCups, lemonBuyers));
  const lemonUnsold = Math.max(0, lemonCups - lemonSold);

  // Расходы: аренда, опции, продукты для лимонада
  const rentPerHour = (BIZ_LOCATIONS[locationKey] || { rentPerHour: 0 }).rentPerHour;
  const rent = rentPerHour * hours;
  let optionsCost = 0;
  Object.keys(BIZ_OPTIONS).forEach(key=>{
    if(options[key]){
      const opt = BIZ_OPTIONS[key];
      optionsCost += opt.costType === 'perCup' ? lemonCups * opt.cost : opt.cost;
    }
  });
  const lemonExpenses = bizDrinkExpenses(lemonCups);
  const totalExpenses = rent + optionsCost + lemonExpenses;

  // Выручка
  const lemonRevenue = lemonPrice * lemonSold;
  const totalRevenue = lemonRevenue;

// Прибыль
  const netProfit = Math.round(totalRevenue - totalExpenses);
  state.businessLemonadeSold = lemonSold;
  state.businessLemonadeRevenue = totalRevenue;
  state.businessLemonadeNetProfit = netProfit;
// Все запасы расходуются — непроданные стаканы сгорают
   state.businessLemonadeLemonStock = 0;
   state.businessLemonadeLemonBoughtDay = null;

  // Резерв 200 ₽ остаётся для производства, всё сверху — к цели.
   const totalBefore = bizMoneyTotal();
   const newTotal = totalBefore + netProfit;
   if(newTotal > BIZ_START_CAPITAL){
     state.businessLemonadeMoney = newTotal - BIZ_START_CAPITAL;
     state.businessLemonadeReserve = BIZ_START_CAPITAL;
   } else {
     state.businessLemonadeMoney = Math.max(0, newTotal);
     state.businessLemonadeReserve = Math.max(0, newTotal);
   }
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
    lemonPeople, lemonBuyers, lemonUnsold,
    rent, optionsCost, totalExpenses, totalRevenue, netProfit,
  };

  saveState();

  // Обновляем UI результатов
  const highlightEl = document.getElementById('bizResultHighlight');
  highlightEl.textContent = (netProfit >= 0 ? '+' : '') + netProfit + ' ₽';
  highlightEl.classList.toggle('biz-loss', netProfit < 0);
  document.getElementById('bizResultsTitle').textContent = `Итоги дня ${state.businessLemonadeDay || 1} (${dow.short})`;

  // Показываем лимонад в результатах
  const drinkBadge = document.getElementById('bizResDrinkBadge');
  if(drinkBadge) drinkBadge.textContent = '🍋 Лимонад';

  // Лимонад
  document.getElementById('bizResLemonLabel').textContent = '🍋 Лимонад';
  document.getElementById('bizResLemonSold').textContent = `${lemonSold} из ${lemonCups}`;
  document.getElementById('bizResLemonPrice').textContent = `${lemonPrice} ₽`;
  document.getElementById('bizResLemonRevenue').textContent = `${lemonRevenue} ₽`;
  const lemonRow = document.getElementById('bizResLemonRow');
  if(lemonRow) lemonRow.style.display = lemonCups > 0 ? '' : 'none';
  // Откуда взялись покупатели и что осталось: это и есть главный урок дня —
  // приготовить больше, чем покупают, значит выбросить деньги в мусор.
  document.getElementById('bizResLemonPeople').textContent = `${lemonPeople} человек прошло, купили ${lemonBuyers}`;
  const unsoldEl = document.getElementById('bizResLemonUnsold');
  if(unsoldEl){
    unsoldEl.textContent = lemonUnsold > 0
      ? `${lemonUnsold} стак. осталось — выброшено (в мусор ушли лимоны и ${lemonUnsold * (BIZ_SUGAR_PER_CUP + BIZ_CUP_PER_CUP)} ₽ на сахар и стаканчики)`
      : 'Всё приготовленное продано — ничего не пропало!';
    unsoldEl.classList.toggle('biz-loss', lemonUnsold > 0);
  }

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

/* ============ ПРОВЕРКА СЕБЯ (когда цель накопления достигнута) —
   только логические вопросы о том, как заработать больше. Без вычислений:
   игра рассчитана на детей от 7 лет, расчёты их пугают. Вопросы каждый
   раз разные: три случайных из пула, варианты ответа перемешиваются. ============ */
function generateBizQuiz(){
  const quiz = [];
  const conceptPool = shuffle(BIZ_QUIZ_CONCEPT_POOL);
  const count = Math.min(3, conceptPool.length);
  for(let i = 0; i < count; i++){
    const item = conceptPool[i];
    const idxArr = shuffle(item.options.map((_, j)=>j));
    const options = idxArr.map(j => item.options[j]);
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
  document.getElementById('bizSummaryIntro').textContent = `За ${daysPlayed} ${dayWord} ты накопил ${totalProfit >= 0 ? '+' : ''}${bizFormatMoney(totalProfit)} ₽ чистыми и достиг цели «${name}» (${bizFormatMoney(goal)} ₽). Правильных ответов в проверке: ${correct} из ${total}.`;
  const log = (state.businessLemonadeDayLog || []).filter(Boolean);
  renderBizWeekChart(log);
  // Данные по лимонаду из дневного лога
  const drinkStats = {
    'Лимонад': { sold:0, cups:0, revenue:0, unsold:0, buyers:0 }
  };
  log.forEach(rec=>{
    if(rec.lemonCups > 0){
      drinkStats['Лимонад'].cups += rec.lemonCups || 0;
      drinkStats['Лимонад'].sold += rec.lemonSold || 0;
      drinkStats['Лимонад'].revenue += rec.lemonRevenue || 0;
      // lemonUnsold появился вместе с прогнозом спроса; в старых записях его нет.
      drinkStats['Лимонад'].unsold += rec.lemonUnsold || 0;
      drinkStats['Лимонад'].buyers += rec.lemonBuyers || 0;
    }
  });
  const drinkIcons = { 'Лимонад': '🍋' };
  const drinksBox = document.getElementById('bizSummaryDrinksBox');
  if(drinksBox){
    const order = ['Лимонад'].filter(k => drinkStats[k] && drinkStats[k].cups > 0);
    drinksBox.innerHTML = order.map(key=>{
      const d = drinkStats[key];
      return `
        <div class="biz-breakdown-box">
          <div class="biz-drink-title">${drinkIcons[key]} ${key}</div>
          <div class="biz-breakdown-row"><span>Приготовлено стаканов</span><span>${d.cups}</span></div>
          <div class="biz-breakdown-row"><span>Продано стаканов</span><span>${d.sold} из ${d.cups}</span></div>
          <div class="biz-breakdown-row"><span>Покупателей всего</span><span>${d.buyers}</span></div>
          <div class="biz-breakdown-row"><span>Испорчено (приготовил больше, чем купили)</span><span>${d.unsold} стак.</span></div>
          <div class="biz-breakdown-row"><span>Заработано (выручка)</span><span>${d.revenue} ₽</span></div>
        </div>
      `;
    }).join('');
  }
  document.getElementById('bizSummaryDaysBox').innerHTML = log.map(rec=>`
    <div class="biz-breakdown-row"><span>${rec.dowShort} ${rec.locationIcon} ${rec.locationName} ${rec.weatherIcon}</span><span>${rec.netProfit >= 0 ? '+' : ''}${rec.netProfit} ₽</span></div>
  `).join('');
  showModal('businessLemonadeSummaryModal');
}
const closeBizSummaryBtn = document.getElementById('closeBusinessLemonadeSummaryBtn');
  if(closeBizSummaryBtn){
    closeBizSummaryBtn.addEventListener('click', ()=>{
      hideModal('businessLemonadeSummaryModal');
      exitBusinessLemonadeGame();
    });
  }

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
  state.businessLemonadePausedPhase = null;
  state.inProgress = true;
  state.businessLemonadeDay = 1;
  state.businessLemonadeMoney = 0;
  state.businessLemonadeReserve = BIZ_START_CAPITAL;
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
  state.businessLemonadeSelectedLemonIdx = 1;
  state.businessLemonadePrice = 30;
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
  state.inProgress = false;
  state.pausedMode = null;
  state.businessLemonadePausedPhase = null;
  exitGame('businessLemonadeGame', 'businessLemonadeSetup');
  saveState();
  updateResumeUI();
}
/* ===== Пауза: вернуться в меню — продолжить позже через общий блок ===== */
// Вся партия (капитал, день, закупки, цена и итоги дня) уже живёт в state,
// поэтому при паузе достаточно запомнить текущую фазу дня — DOM-классы
// .biz-phase-active восстанавливаются функцией goToBizPhase при возврате.
function resumeBusinessLemonadeGame(){
  state.pausedMode = null;
  const phase = state.businessLemonadePausedPhase || 'bizPhaseDayIntro';
  state.businessLemonadePausedPhase = null;
  saveState();
  updateResumeUI();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('businessLemonadeGame').classList.add('active');
  goToBizPhase(phase);
  updateMuteBtn();
  requestWakeLock();
}
// Вызывается из общего меню паузы («Закончить игру») — просто выходим
// (партия без сохранения, итоговой сводки за прерванную партию не будет).
function finishBusinessLemonadeGame(){
  hideModal('pauseMenuModal');
  exitBusinessLemonadeGame();
  updateResumeUI();
  showToast('Игра завершена');
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
// Кнопка «Выход» в игре — сразу в меню настройки, без промежуточной паузы.
document.getElementById('businessLemonadeExitBtn').addEventListener('click', ()=>{
  exitBusinessLemonadeGame();
});
(document.getElementById('businessLemonadeSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ showModal('businessLemonadeRulesModal'); });
setupRulesModal('businessLemonadeRulesModal', 'closeBusinessLemonadeRulesBtn');

