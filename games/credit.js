// games/credit.js — игра «Кредит» (раздел «Бизнес игры»).
// Загружается через <script src="games/credit.js"></script> в index.html.
// Данные не нужны: все числа считаются по формуле, колода карточек отсутствует.
//
// ЧТО ЭТО
// Калькулятор кредита с настоящими российскими условиями. Игрок выбирает ТИП
// кредита — наличные, автокредит, ипотека, семейная ипотека, рефинансирование
// — и получает реальные параметры этого продукта на 02.10.2026, а дальше
// меняет их ползунками: сумму, ставку, срок, первый взнос и то, сколько
// в год приносит то, на что взят кредит. На выходе — главное: СКОЛЬКО СТОИТ
// КРЕДИТ И ВЫГОДНО ЛИ ЕГО БРАТЬ. Переплата, полная стоимость кредита в
// процентах годовых, реальная ставка после инфляции, вердикт в три голоса.
//
// ГЛАВНАЯ МЫСЛЬ ИГРЫ
// Кредит — не «бесплатные деньги», а деньги под процент, и он оправдан только
// тогда, когда обходится дешевле, чем принесли бы те же деньги сами. Ориентир
// для сравнения — вклад: кредит под 25% при инфляции 6,3% реально стоит
// 17,6% в год, тогда как вклад под 13% даёт реальные 6,3%. Именно это
// сравнение и есть ответ на вопрос «выгодно ли», поэтому вердикт в игре не
// «плюс/минус», а «дешевле вклада / на грани / дороже вклада».
//
// ПОЧЕМУ ВЕРДИКТ СРАВНИВАЕТ СО ВКЛАДОМ, А НЕ С НУЛЁМ
// Иначе игрок решал бы так: «переплата положительная — значит, кредит плох».
// Это неверно: переплата положительна у ЛЮБОГО кредита, иначе банк не дал бы
// денег. Сравнивать надо с тем, что те же деньги сделали бы без кредита, —
// положить их на вклад. Отсюда и три уровня вывода, а не два.
//
// ЧЕСТНОСТЬ РАСЧЁТА (важно для правил и README)
// • Ставки, инфляция и ставки по продуктам взяты из данных на 02.10.2026 и
//   со временем устареют: числа объявлены в CREDIT_RU и CREDIT_PRODUCTS с
//   датами, а дисклеймер на экране называет дату прямо.
// • Ставка фиксируется на весь срок. В жизни ставка по кредиту может
//   измениться (реструктуризация, рефинансирование), но это уже не расчёт,
//   а новый договор.
// • Инфляция здесь работает НА БЛАГО заёмщика: платить придётся деньгами
//   начала срока, а они к концу срока обесценятся. Поэтому вторая цифра под
//   переплатой — не «убыток», а реальная стоимость кредита, и она всегда
//   МЕНЬШЕ переплаты. Путать эти два знака — главная ошибка при чтении.
// • ПСК считается по формуле закона (ст. 3 ФЗ-353): в % годовых от суммы
//   кредита за весь срок, включая все платежи. У аннуитетного кредита ПСК
//   всегда НИЖЕ договорной ставки — долг каждый месяц уменьшается. У банков
//   ПСК выше именно из-за страховки и комиссий: их в стоимость кредита тоже
//   входит, и в игре это видно по блоку услуг.
// • Не учитываются: штрафы за просрочку, оценка кредитной истории, платёж в
//   день получения кредита, ротация карты для рефинансирования.
// • Налоговый вычет с процентов (13%) НЕ рассчитывается: по закону его
//   можно вернуть только за полные годы налогового периода и не сразу,
//   поэтому «переплата минус вычет» было бы числом, которого в жизни не
//   существует. Упомянут в правилах как известный, но не посчитанный фактор.
//
// СВЯЗЬ С ДРУГИМИ ЧАСТЯМИ ПРИЛОЖЕНИЯ
// • Игра без паузы (noPause в games/game-registry.js, как «Вклады», «Столицы»
//   и «Лимонадный ларёк»): расчёт мгновенный, терять нечего.
// • Реестр нужен, чтобы стрелка «←» из экрана расчёта возвращала в
//   настройки игры (back: 'exitCreditGame'), а не в хаб.
// • Экраны creditSetup и creditGame описаны в SECTION_FOR_SCREEN
//   (games/fants-timer.js) с разделом businessView, а creditSetup — ещё и в
//   SETUP_ONLY_SCREENS и PARENT_BACK: стрелка «←» с него возвращает в хаб.
// • Все числа по вкладам, ключевой ставке и инфляции совпадают с игрой
//   «Вклады» (DEPOSITS_RU): сравнивать кредит с вкладом бессмысленно, если
//   они посчитаны на разных условиях.
//
// ЧЕГО ИГРА НЕ ДЕЛАЕТ
// Не советует брать или не брать кредит и не обещает выгоду: вердикт — это
// арифметическое сравнение с безрисковой альтернативой, а не рекомендация.
// Об этом сказано в правилах игры, в README и на экране расчёта.

/* ============ ГРАНИЦЫ НАСТРОЕК ============ */
// Числовые условия задаются ползунками, поэтому хранятся не списки значений,
// а ДИАПАЗОНЫ: границы и шаг. min/max/step дублируются в атрибутах
// <input type="range"> в index.html, и tools/check.js сверяет одно с другим:
// разъехавшиеся границы дали бы невозможные значения.
const CREDIT_LIMITS = {
  amount: { min:10000,  max:12000000, step:10000, def:500000 },
  rate:   { min:1,      max:40,       step:0.1,   def:25 },
  months: { min:3,      max:360,      step:1,     def:60 },
  down:   { min:0,      max:80,       step:5,     def:0 },
  gain:   { min:0,      max:40,       step:1,     def:0 },
};
// ДЕЙСТВУЮЩИЕ УСЛОВИЯ В РОССИИ (срез на 02.10.2026)
// Источники и даты важны: и ключевая ставка, и инфляция, и ставки по кредитам
// меняются, поэтому числа объявлены здесь с датой, а не спрятаны в формуле.
// Когда условия изменятся, правится только этот блок — и подписи на экране, и
// расчёт меняются вместе, не расходясь между собой.
// • Ключевая ставка — 14,00% годовых, действует с 14.09.2026 (решение Совета
//   директоров Банка России от 11.09.2026, cbr.ru/press/keypr).
// • Инфляция — 6,3% в пересчёте на год по оценке Банка России на 07.09.2026.
// • Ставка вкладов — 13% годовых: та же цифра, что и дефолт в игре «Вклады»,
//   чтобы кредит и вклад считались на одинаковых условиях и сравнение между
//   ними было честным.
// • Реальная ставка Банка России (max(ключевая ставка, 12,5%) − инфляция) —
//   это доходность депозита в самом ЦБ, то есть безрисковая альтернатива, с
//   которой сравнивается кредит. Порог 12,5% не опускается ниже даже при
//   низкой ключевой ставке.
const CREDIT_RU = {
  keyRate: 14,
  keyRateFrom: '14.09.2026',
  inflation: 6.3,
  inflationFrom: '07.09.2026',
  depositRate: 13,
  exemptFloor: 12.5,
  // Общая отсечка, по которой взяты ключевая ставка, инфляция и ставки по
  // продуктам из CREDIT_PRODUCTS.
  ratesFrom: '02.10.2026',
};

/* ============ ТИПЫ КРЕДИТОВ ============ */
// Главное отличие от игры «Вклады»: условия кредита не произвольные. Ставка по
// кредиту — не то, что игрок выдумывает ползунком, а рыночная цена денег: она
// складывается из ставки банка, его стоимости фондирования и риска. Поэтому
// тип кредита задан списком продуктов, а кнопка подставляет ТИПОВЫЕ условия
// этого продукта на 02.10.2026 — после чего игрок свободен их менять.
//
// Эффект кнопки — главное, ради чего типы вообще вынесены на экран: без него
// «реальные условия» были бы только текстом в правилах. Здесь же видно, что
// льготная семейная ипотека под 6% и кредит наличными под 25% — это один и
// тот же вопрос с очень разным ответом.
//
// Диапазоны из поля note взяты из открытых данных на 02.10.2026:
// • кредиты наличные: ПСК 12,7–55,96% годовых, средняя по 20 крупнейшим
//   банкам портфеля — около 29,7% (finuslugi.ru, сентябрь 2026);
// • автокредиты: ПСК около 19,2% годовых на новые автомобили с субсидией,
//   на подержанные машины ставки заметно выше;
// • ипотека: рыночные ставки 16–18% годовых, льготные программы ниже
//   (семейная около 6%); ЦБ ожидает падения рыночных ставок ниже 15% к
//   концу 2027 года.
const CREDIT_PRODUCTS = [
  { id:'cash', label:'наличные', full:'Кредит наличными на любые цели',
    rate:25, months:60, amount:500000, down:0,
    note:'ПСК у банков 16–40% годовых, средняя по 20 крупнейшим банкам — около 29,7%' },
  { id:'auto', label:'авто', full:'Автокредит',
    rate:19.2, months:60, amount:1500000, down:20,
    note:'на новые автомобили ПСК около 19,2% годовых, на подержанные — до 25%' },
  { id:'mortgage', label:'ипотека', full:'Ипотека на рыночных условиях',
    rate:17, months:240, amount:6000000, down:20,
    note:'рыночная ипотека 16–18% годовых, срок до 30 лет, льготные программы — от 4%' },
  { id:'family', label:'семейная', full:'Семейная ипотека',
    rate:6, months:240, amount:5000000, down:20,
    note:'около 6% годовых при двух детях; для одного ребёнка обсуждается 10–12%' },
  { id:'refi', label:'рефинансирование', full:'Рефинансирование кредита',
    rate:20, months:60, amount:700000, down:0,
    note:'18–24% годовых: смысл есть только если новый кредит заметно дешевле старого' },
];
// Старое сохранение или правка state из консоли не должны ломать выбор типа:
// неизвестный id даёт первый продукт, а не undefined.
function creditProductById(id){
  return CREDIT_PRODUCTS.find(x => x.id === id) || CREDIT_PRODUCTS[0];
}

/* ============ ГРАФИК ПЛАТЕЖЕЙ ============ */
// Это перечисление, а не число, поэтому осталось кнопками. Оба графика
// встречаются в российских банках, и разница между ними — не в сумме
// переплаты (она почти одна), а в том, как распределяется нагрузка на бюджет:
// при дифференцированном первые платежи заметно больше последних.
const CREDIT_SCHEDULES = [
  { id:'annuity', label:'аннуитетный', short:'аннуитетный' },
  { id:'diff',    label:'дифференцированный', short:'дифференцированный' },
];
function creditScheduleById(id){
  return CREDIT_SCHEDULES.find(x => x.id === id) || CREDIT_SCHEDULES[0];
}

/* ============ ДОПОЛНИТЕЛЬНЫЕ УСЛУГИ И КОМИССИИ ============ */
// Банк продаёт кредит не по ставке, а по ПОЛНОЙ стоимости: к процентам
// добавляются страховка и комиссии, и именно из них чаще всего собирается
// ПСК. В игре услуги не декоративные галочки, а РЕАЛЬНО увеличивают цену
// кредита — в этом весь смысл блока: кредит под 18% без услуг и под 18% с
// двумя услугами стоят разного.
//
// kind задаёт ЕДИНИЦУ платы — и в этом важная часть правды: страховку берут
// процентами от суммы кредита ЗА ВЕСЬ СРОК, выдачу наличными — процентом ОДИН
// РАЗ, а нотариальные расходы — фиксированной суммой. Считать всё в
// «процентах годовых» было бы удобно, но неверно, и сводить всё к двум видам
// тоже нельзя: «1% разово» и «20 000 ₽ разово» — это разные числа.
// • Страхование жизни и здоровья при залоговых кредитах (ипотека, авто)
//   обычно обязательно по условиям договора: 0,5–1,5% годовых от суммы.
// • Платные уведомления — около 0,1–0,2% годовых.
// • Выдача кредита наличными в кассе банка — комиссия 1–3% от суммы один раз.
// • Премиум-обслуживание карты — 0,3–0,5% годовых от суммы кредита.
// • Оценка обеспечения и нотариальные расходы — фиксированные 15–40 тыс. ₽.
const CREDIT_SERVICES = [
  { id:'insurance', el:'creditServInsurance', label:'Страхование жизни', cost:1, kind:'yearly',
    note:'1% годовых от суммы кредита за весь срок' },
  { id:'sms', el:'creditServSms', label:'СМС-информирование', cost:0.1, kind:'yearly',
    note:'0,1% годовых за уведомления о счёте' },
  { id:'cashout', el:'creditServCash', label:'Выдача наличными', cost:1, kind:'percent',
    note:'1% от суммы кредита один раз при получении' },
  { id:'premium', el:'creditServPremium', label:'Премиум-карта', cost:0.3, kind:'yearly',
    note:'0,3% годовых от суммы кредита за весь срок' },
  { id:'notary', el:'creditServNotary', label:'Нотариус и оценка', cost:20000, kind:'once',
    note:'20 000 ₽ один раз: оценка обеспечения и нотариальные расходы' },
];
// Стоимость услуги за весь срок. Три вида по-разному:
// yearly  — проценты годовых от суммы, умножаются на срок;
// percent — проценты от суммы ОДИН раз, срока не умножают;
// once    — фиксированная сумма в рублях, тоже один раз.
function creditServiceSum(s, p, years){
  if(s.kind === 'yearly') return p.amount * s.cost / 100 * years;
  if(s.kind === 'percent') return p.amount * s.cost / 100;
  return s.cost;
}
// Включённые услуги: из state берутся только те id, которые есть в
// CREDIT_SERVICES. Старое сохранение или правка консоли не должны добавить в
// расчёт услугу, которой больше нет в игре, — молча увеличили бы итог на
// неизвестную сумму.
function creditSelectedServices(){
  const raw = Array.isArray(state.creditServices) ? state.creditServices : [];
  return CREDIT_SERVICES.filter(s => raw.includes(s.id));
}
// Итоговый расход за весь срок. ВРЕМЯ ВАЖНО: у годовых услуг стоимость
// умножается на число лет (иначе 1% за 20 лет стоили бы 1% от суммы), а
// разовые платы берутся один раз и срока не умножают.
function creditServicesCost(p){
  const chosen = creditSelectedServices();
  const months = Math.max(1, Math.round(Number(p.months) || 1));
  const years = months / 12;
  const items = chosen.map(s => ({
    ...s,
    sum: creditServiceSum(s, p, years),
  }));
  return { items, total: items.reduce((acc, s) => acc + s.sum, 0) };
}

// Приведение значения к допустимому: округление по шагу и зажим в границы.
// Старые сохранения и правка state из консоли не должны дать NaN в расчёте.
function creditClamp(key, value){
  const lim = CREDIT_LIMITS[key];
  const n = Number(value);
  if(!lim || !Number.isFinite(n)) return lim ? lim.def : 0;
  const snapped = Math.round(n / lim.step) * lim.step;
  // Шаг 0,1 в двоичной арифметике даёт 0,30000000000000004 — округляем
  // обратно до разумного числа знаков, иначе в подписи «25,300000000000004%».
  const fixed = Math.round(snapped * 1e6) / 1e6;
  return Math.min(lim.max, Math.max(lim.min, fixed));
}
// Первый взнос в рублях: игрок задаёт его долей от суммы кредита, потому что
// именно так его называют в банке («первоначальный взнос 20%»). Функция
// отделена от форматтера подписи: ею пользуются и подпись ползунка, и экран
// расчёта, а записывать расчёт прямо в format() нельзя — он вызывается для
// каждого ползунка и тащил бы за собой лишние вычисления.
function creditDownPayment(p){
  return p.amount * p.down / 100;
}
function creditParams(){
  return {
    product: creditProductById(state.creditProduct).id,
    amount: creditClamp('amount', state.creditAmount),
    rate: creditClamp('rate', state.creditRate),
    months: creditClamp('months', state.creditMonths),
    down: creditClamp('down', state.creditDown),
    sched: creditScheduleById(state.creditSched).id,
    gain: creditClamp('gain', state.creditGain),
  };
}
// Сумма с копейками там, где они осмысленны (переплата, платёж), и без них
// там, где округление до рубля ничего не теряет (годовые строки).
function creditMoney(n, withKopecks){
  const v = Number(n) || 0;
  const rounded = withKopecks ? Math.round(v * 100) / 100 : Math.round(v);
  return rounded.toLocaleString('ru-RU', {
    minimumFractionDigits: withKopecks ? 2 : 0,
    maximumFractionDigits: withKopecks ? 2 : 0,
  }) + ' ₽';
}
// Проценты — с запятой, как их пишут в России: 17,6%. toLocaleString тут не
// годится: он даёт неразрывный пробел и лишние нули.
function creditPct(n, digits){
  const v = Number(n) || 0;
  return String(Number(v.toFixed(digits === undefined ? 1 : digits))).replace('.', ',') + '%';
}
// Склонение «год/года/лет».
function creditYearsWord(n){
  const v = Math.abs(Number(n) || 0);
  if(Math.abs(v - Math.round(v)) > 1e-9) return 'года';
  const rounded = Math.round(v) % 100;
  const last = rounded % 10;
  if(rounded > 10 && rounded < 20) return 'лет';
  if(last === 1) return 'год';
  if(last >= 2 && last <= 4) return 'года';
  return 'лет';
}
// Склонение «месяц/месяца/месяцев».
function creditMonthsWord(n){
  const v = Math.abs(Math.round(Number(n) || 0)) % 100;
  const last = v % 10;
  if(v > 10 && v < 20) return 'месяцев';
  if(last === 1) return 'месяц';
  if(last >= 2 && last <= 4) return 'месяца';
  return 'месяцев';
}
// Подпись срока: целые годы — «5 лет», дробные — «2,7 года».
function creditPeriodLabel(years){
  const v = Number(years) || 0;
  const rounded = Math.round(v * 10) / 10;
  if(Number.isInteger(rounded)) return `${rounded} ${creditYearsWord(rounded)}`;
  return `${String(rounded).replace('.', ',')} года`;
}

/* ============ РАСЧЁТ ============ */
/**
 * Помесячный расчёт кредита. Возвращает всё, что показывают экраны.
 * @param {object} p — { amount, rate, months, sched }
 * @returns {object} — график платежей, переплата, ПСК, остаток долга.
 */
function creditSimulate(p){
  const months = Math.max(1, Math.round(Number(p.months) || 1));
  const rate = Number(p.rate) || 0;
  // Месячная ставка. Проценты по кредиту начисляются на ОСТАТОК долга, а не
  // на исходную сумму, — это и есть главное отличие кредита от вклада.
  const mr = rate / 100 / 12;
  const amount = Math.max(0, Number(p.amount) || 0);
  const diff = creditScheduleById(p.sched).id === 'diff';
  // Аннуитетный платёж: A = P·i / (1 − (1+i)^−n). Формула устойчива и при
  // нулевой ставке не делит на ноль: при i = 0 знаменатель даёт n, и платёж
  // просто P/n.
  const annuity = mr > 0
    ? amount * mr * Math.pow(1 + mr, months) / (Math.pow(1 + mr, months) - 1)
    : amount / months;
  // Основной долг при дифференцированном графике делится поровну.
  const principalPart = diff ? amount / months : 0;
  let balance = amount;
  let paidTotal = 0;
  let interestTotal = 0;
  let principalPaid = 0;
  let firstPayment = 0;
  let lastPayment = 0;
  const schedule = [];
  const years = [];
  let yearPaid = 0;
  let yearInterest = 0;
  for(let m = 1; m <= months; m++){
    // Проценты за месяц — от остатка на начало месяца.
    const interest = balance * mr;
    let principal;
    if(diff){
      principal = principalPart;
    }else{
      principal = annuity - interest;
      // Аннуитетный платёж из-за округления НИКОГДА не гасит долг ровно за
      // months платежей: накопленная погрешность к концу срока даёт остаток
      // в несколько копеек. Без этого последний платёж вышел бы больше
      // предыдущих на копейки, и сумма всех платежей перестала бы совпадать
      // с расчётной. Последний платёж добирает остаток целиком.
      if(m === months && balance - principal <= 0) principal = balance;
    }
    // Защита от отрицательного остатка: при дифференцированном графике на
    // длинном сроке из-за двоичной точности principal может чуть превысить
    // остаток, и без этого баланс ушёл бы в минус и «раздул» бы переплату.
    if(principal > balance) principal = balance;
    const payment = principal + interest;
    balance -= principal;
    // Остаток меньше копейки — это ноль, а не долг. Без округления на конце
    // дифференцированный график оставлял 4×10⁻¹⁰ ₽, и проверка «долг погашен»
    // падала на пустом месте. Сумма таких огрехов не влияет на итог, но
    // показывать их игроку нельзя.
    if(balance < 0.005) balance = 0;
    paidTotal += payment;
    interestTotal += interest;
    principalPaid += principal;
    yearPaid += payment;
    yearInterest += interest;
    schedule.push({ month: m, payment, interest, principal, balance: Math.max(0, balance) });
    if(m === 1) firstPayment = payment;
    lastPayment = payment;
    // Строка таблицы — на каждый год. Последний год может быть неполным
    // (срок 250 месяцев — это 20 лет и 10 месяцев), и без отдельной строки он
    // просто потерялся бы.
    if(m % 12 === 0 || m === months){
      years.push({
        month: m,
        year: m / 12,
        paid: yearPaid,
        interest: yearInterest,
        balance: Math.max(0, balance),
      });
      yearPaid = 0;
      yearInterest = 0;
    }
  }
  const overpay = paidTotal - amount;
  // ПСК по ст. 3 ФЗ-353: сколько стоит кредит в % годовых от суммы кредита,
  // считая ВСЕ платежи. Формула: (переплата ÷ сумма) × (365 ÷ срок в днях) ×
  // 100. Срок считаем в днях из месяцев.
  const days = Math.round(months * 365 / 12);
  return {
    months,
    rate,
    sched: diff ? 'diff' : 'annuity',
    schedule,
    years,
    amount,
    paidTotal,
    interestTotal,
    principalPaid,
    overpay,
    firstPayment,
    lastPayment,
    // Средний платёж — единственное сравнение двух графиков «в одном числе».
    avgPayment: paidTotal / months,
    psk: days > 0 ? (overpay / amount) * (365 / days) * 100 : 0,
    lastBalance: Math.max(0, balance),
  };
}

/* ============ ИНФЛЯЦИЯ, РЕАЛЬНАЯ СТАВКА, ВЕРДИКТ ============ */
// Инфляция за срок: сколько будут стоить деньги, которыми заёмщик платит.
// Считаем от стоимости всех платежей в ценах начала срока — так же, как в
// игре «Вклады», только знак полезный: инфляция долг НЕ увеличивает, а
// уменьшает его настоящую цену.
function creditInflationEffect(res){
  const factor = Math.pow(1 + CREDIT_RU.inflation / 100, res.months / 12);
  const realPaid = res.paidTotal / factor;
  return {
    factor,
    realPaid,
    // «Скидка» заёмщика: на сколько обесценились все выплаты за срок.
    saving: Math.max(0, res.paidTotal - realPaid),
  };
}
// Реальная годовая ставка — формула Фишера. Ставка 25% при инфляции 6,3%
// реально стоит (1,25 ÷ 1,063) − 1 = 17,6% в год, а не 25%: часть процентов
// съедает инфляция, и чем длиннее срок, тем сильнее это видно.
function creditRealRate(nominalRate){
  const ru = CREDIT_RU;
  return ((1 + (Number(nominalRate) || 0) / 100) / (1 + ru.inflation / 100) - 1) * 100;
}
// Реальная ставка Банка России — доходность депозита в самом ЦБ, то есть
// реальная безрисковая альтернатива любому кредиту. Сейчас 7,7% в год.
// Порог 12,5% в max() — тот же, что и для необлагаемого минимума по вкладам:
// он не опускается ниже даже при низкой ключевой ставке.
function creditBenchmark(){
  const ru = CREDIT_RU;
  return Math.max(ru.keyRate, ru.exemptFloor) - ru.inflation;
}
/**
 * Вердикт: выгодно ли брать кредит.
 *
 * Сравниваем РЕАЛЬНУЮ стоимость кредита с РЕАЛЬНОЙ доходностью вклада. Так и
 * должен решать человек: «если бы я не взял эти деньги в долг, а купил то же
 * самое на деньги, отложенные на вклад — что было бы дешевле?». Вклад под 13%
 * даёт реальные 6,3% в год; кредит под 25% стоит реальных 17,6%.
 *
 * Почему три уровня, а не два. «Дороже вклада» и «намного дороже вклада» —
 * это разные решения: кредит под 12% дороже вклада, но на квартиру его всё
 * равно берут (собственность не лежит на вкладе), а кредит под 30% — уже
 * совсем другая история. Двухчастный вывод «плюс/минус» терял эту разницу.
 *
 * Порог «на грани» — 5 процентных пунктов от доходности вклада. Не
 * произвольное число: это примерно тот разрыв, который ещё можно перекрыть
 * арендой, экономией или ростом цен на то, что вы покупаете.
 */
function creditVerdict(res, services){
  const ru = CREDIT_RU;
  const benchmark = creditBenchmark();
  // Дополнительные платы переводим в % годовых тем же соотношением, каким
  // считается ПСК. Реальная ставка берётся от ПСК с услугами, а не от
  // договорной: иначе страховка не влияла бы на вывод, хотя именно из-за неё
  // банковский ПСК выше ставки. Это делает блок услуг честным.
  const days = Math.max(1, Math.round(res.months * 365 / 12));
  // Сколько услуги ПРИБАВЛЯЮТ к годовой ставке. Разница между ПСК и ставкой
  // для этого НЕ годится: ПСК усреднён по убывающему остатку (при ставке 25%
  // на 5 лет ПСК = 15,2%), а сравнивать надо с доходностью вклада, которая
  // тоже считается от полной суммы. Поэтому услуги пересчитываются так же,
  // как ПСК, — в проценты годовых от суммы кредита.
  const pskAnnual = services.total > 0 ? (services.total / res.amount) * (365 / days) * 100 : 0;
  const effectiveRate = res.rate + pskAnnual;
  const realRate = creditRealRate(effectiveRate);
  const depositReal = creditRealRate(ru.depositRate);
  const diff = realRate - depositReal;
  const BORDER = 5;
  const level = diff <= 0 ? 'good' : (diff <= BORDER ? 'border' : 'bad');
  return {
    level,
    benchmark,
    depositReal,
    effectiveRate,
    pskAnnual,
    realRate,
    diff,
    border: BORDER,
    overpay: res.overpay + services.total,
    gain: Math.abs(res.overpay + services.total),
  };
}

/* ============ ЭКРАН НАСТРОЙКИ ============ */
// Подсветка выбранной кнопки в группе. Плашки те же .starter-btn, что у
// остальных игр: своя оформка ради одного экрана выбивалась бы из раздела.
function creditMarkGroup(groupId, value){
  document.querySelectorAll('#' + groupId + ' .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', String(btn.dataset.value) === String(value));
  });
}
// Ползунки и их подписи описаны данными: у всех пяти одна природа, и пять
// почти одинаковых копий разъехались бы при первом же изменении диапазона.
// Формат подписи разный намеренно: «ничего не приносит» читается лучше «0%».
const CREDIT_RANGES = [
  { key:'amount', field:'creditAmount', input:'creditAmountRange', out:'creditAmountValue',
    format: v => creditMoney(v) },
  { key:'rate', field:'creditRate', input:'creditRateRange', out:'creditRateValue',
    format: v => `${String(v).replace('.', ',')}%` },
  { key:'months', field:'creditMonths', input:'creditMonthsRange', out:'creditMonthsValue',
    format: v => `${v} ${creditMonthsWord(v)} · ${creditPeriodLabel(v / 12)}` },
  { key:'down', field:'creditDown', input:'creditDownRange', out:'creditDownValue',
    format: v => v > 0 ? `${v}% · ${creditMoney(creditDownPayment(creditParams()))}` : 'без первого взноса' },
  { key:'gain', field:'creditGain', input:'creditGainRange', out:'creditGainValue',
    format: v => v > 0 ? `${v}% в год` : 'ничего не приносит' },
];
function renderCreditSetup(){
  const p = creditParams();
  CREDIT_RANGES.forEach(r=>{
    const input = document.getElementById(r.input);
    if(input) input.value = String(p[r.key]);
    const out = document.getElementById(r.out);
    if(out) out.textContent = r.format(p[r.key]);
  });
  creditMarkGroup('creditProductGroup', p.product);
  creditMarkGroup('creditSchedGroup', p.sched);
  renderCreditProductNote();
  renderCreditServices();
}
// Под выбранным типом кредита показывается его рыночный диапазон: без него
// кнопки «наличные / авто / ипотека» были бы просто словами, и игрок не понял
// бы, откуда взялась подставленная ставка.
function renderCreditProductNote(){
  const out = document.getElementById('creditProductNote');
  if(out){
    const pr = creditProductById(state.creditProduct);
    out.textContent = `${pr.full}: ${pr.note}.`;
  }
}
// Пилюли услуг: включённые подсвечены и помечены aria-pressed, иначе состояние
// было бы видно только цветом — для программ экранного доступа это пустота.
function renderCreditServices(){
  const chosen = creditSelectedServices();
  // Пилюли ищем по id, а не селектором '#id .class': в dom-stub такой
  // селектор не разбирается и вернул бы пустой список — обработчики не
  // навесились бы и тесты молчали бы. Все кнопки в проекте ищутся по id.
  CREDIT_SERVICES.forEach(s=>{
    const btn = document.getElementById(s.el);
    if(!btn) return;
    const on = chosen.some(x => x.id === s.id);
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  // Итоговая плата пересчитывается сразу при выборе услуги: игрок должен
  // видеть цену до того, как нажмёт «Рассчитать».
  const cost = creditServicesCost(creditParams());
  const out = document.getElementById('creditServicesTotal');
  if(out){
    if(!cost.items.length){
      out.textContent = 'Комиссии не подключены — стоимость кредита не растёт';
      out.classList.remove('warn');
    }else{
      const detail = cost.items.map(s => `${s.label} ${creditMoney(s.sum)}`).join(', ');
      out.textContent = `Добавят к цене кредита: ${detail}. Итого ${creditMoney(cost.total)}.`;
      out.classList.toggle('warn', cost.total > 0);
    }
  }
}
function goToCreditSetup(){
  goToGameSetup('creditSetup', 'businessView', ()=>{
    renderCreditSetup();
  });
}
// Выход с экрана настроек — В ХАБ, а не обратно в настройки. Стрелка «←» на
// экране настроек вызывает эту же функцию (PARENT_BACK), и вариант с
// goToCreditSetup() вёл бы в бесконечный круг: «←» просто перерисовывал бы тот
// же экран, и из игры нельзя было бы выйти. Гасим экраны вручную, как в
// «Бизнес тестах»: этот выход идёт ДО запуска игры, поэтому goToGameSetup()
// здесь и не нужен, и неверен.
function exitCreditSetup(){
  state.inProgress = false;
  state.pausedMode = null;
  state.lastSectionOnPause = null;
  saveState();
  const pauseModal = document.getElementById('pauseMenuModal');
  if(pauseModal) pauseModal.classList.remove('show');
  document.querySelectorAll('.screen.active').forEach(el=>el.classList.remove('active'));
  const hub = document.getElementById('setup');
  if(hub) hub.classList.add('active');
  showSetupView('businessView');
  if(typeof updateResumeUI === 'function') updateResumeUI();
  window.scrollTo(0, 0);
}

/* ============ ЭКРАН РАСЧЁТА ============ */
// Диаграмма остатка долга: столбик на каждый год, высота — от остатка. Показывает
// главное свойство кредита: долг убывает, и чем ближе к концу, тем ниже
// столбик — в отличие от вклада, где сумма растёт.
function creditBarsHtml(years, amount){
  const max = amount > 0 ? amount : 1;
  return years.map(y=>{
    const h = Math.max(3, Math.round((y.balance / max) * 100));
    return `<div class="credit-bar-col">
      <div class="credit-bar" style="height:${h}%"></div>
      <div class="credit-bar-year">${creditPeriodLabel(y.year).replace(' года','').replace(' год','').replace(' лет','')}</div>
    </div>`;
  }).join('');
}

function renderCreditResult(){
  const p = creditParams();
  const res = creditSimulate(p);
  // Результат считается заново при каждом показе и нигде не сохраняется:
  // экран получает те же числа, что и рисует, из одного источника.
  const serv = creditServicesCost(p);
  const verdict = creditVerdict(res, serv);
  const infl = creditInflationEffect(res);
  // Крупная сумма — ПЕРЕПЛАТА ПО ПРОЦЕНТАМ за весь срок: ровно столько
  // заёмщик отдаст банку сверх взятых денег. Это и есть цена кредита, и
  // именно её игрок ищет в кабинете банка. Реальная стоимость (после
  // инфляции) — строкой под ней: она всегда МЕНЬШЕ, и именно поэтому
  // инфляция здесь не враг заёмщика, а его союзник.
  const total = document.getElementById('creditOverpay');
  if(total) total.textContent = creditMoney(res.overpay, true);
  const real = document.getElementById('creditReal');
  if(real) real.textContent = `В ценах начала срока — ${creditMoney(infl.realPaid)}`;
  // Срок, за который считалось, и график платежей. Берём res.months —
  // фактическое число месяцев из расчёта, а не заданное p.months.
  const term = document.getElementById('creditTerm');
  if(term){
    const sch = creditScheduleById(p.sched);
    const graph = p.sched === 'diff'
      ? `платёж ${creditMoney(res.firstPayment)} → ${creditMoney(res.lastPayment)}`
      : `платёж ${creditMoney(res.firstPayment)} каждый месяц`;
    term.textContent = `${sch.short} график, ${creditPeriodLabel(res.months / 12)} — ${res.months} ${creditMonthsWord(res.months)}, ${graph}`;
  }
  const paid = document.getElementById('creditPaid');
  if(paid){
    paid.textContent = `Всего отдадите банку ${creditMoney(res.paidTotal)} за ${creditMoney(res.amount)}`
      + (p.down > 0 ? ` (первый взнос ${creditMoney(creditDownPayment(p))} платите отдельно)` : '');
  }
  const payment = document.getElementById('creditPayment');
  if(payment){
    payment.textContent = p.sched === 'diff'
      ? `Средний платёж ${creditMoney(res.avgPayment)} в месяц, проценты уменьшаются`
      : `Платёж ${creditMoney(res.firstPayment)} в месяц, проценты уже учтены`;
  }
  // Полная стоимость кредита в % годовых. Отдельно от договорной ставки:
  // разница между ними и есть комиссии со страховкой, и именно на неё
  // смотрят при сравнении кредитов разных банков.
  const psk = document.getElementById('creditPsk');
  if(psk){
    psk.textContent = `ПСК — ${creditPct(res.psk + verdict.pskAnnual)} годовых при ${creditPct(res.rate)} в договоре`;
  }
  const realRate = document.getElementById('creditRealRate');
  if(realRate){
    realRate.textContent = `Реальная стоимость — ${creditPct(verdict.realRate)} в год при инфляции ${creditPct(CREDIT_RU.inflation)}`;
  }
  const savings = document.getElementById('creditSaving');
  if(savings){
    savings.textContent = `Инфляция обесценила выплаты на ${creditMoney(infl.saving)}`;
  }
  // Сравнение с вкладом: сколько стоили бы те же деньги, отложенные на вклад
  // под ставку вкладов. Это главный вопрос игры, и ответ на него — в
  // вердикте, а здесь — само число сравнения.
  const depositBox = document.getElementById('creditDepositCompare');
  if(depositBox){
    depositBox.textContent = `Вклад под ${creditPct(CREDIT_RU.depositRate)} даёт реальные ${creditPct(verdict.depositReal)} в год — это и есть цена «просто подождать».`;
  }
  // Услуги: показываем и цену, и то, как она меняет ПСК. Смысл блока в том,
  // что игрок видит, как «бесплатные» страховка и премиум-карта поднимают
  // полную стоимость кредита.
  const servBox = document.getElementById('creditServices');
  if(servBox){
    if(!serv.items.length){
      servBox.textContent = 'Страховка и комиссии не подключены — ПСК совпадает со ставкой.';
    }else{
      const detail = serv.items.map(s => `${s.label} ${creditMoney(s.sum)}`).join(', ');
      servBox.textContent = `Комиссии и страховка — ${creditMoney(serv.total)} (${detail}). В ПСК из них попало ${creditPct(verdict.pskAnnual)} годовых.`;
    }
  }
  // Вердикт «выгодно ли брать кредит». Разделён на две строки: вывод и
  // пояснение, почему он такой. Раньше всё было в одной длинной фразе, и её
  // приходилось читать целиком, чтобы понять сам вывод.
  const verdictBox = document.getElementById('creditVerdict');
  if(verdictBox){
    const rate = creditPct(verdict.realRate);
    const dep = creditPct(verdict.depositReal);
    const VERDICT_TEXT = {
      good: {
        main: `Кредит обходится не дороже вклада: переплата ${creditMoney(verdict.gain)}`,
        note: `${rate} в год против ${dep} у вклада — деньги стоят дешевле, чем под вкладом`,
      },
      border: {
        main: `Кредит дороже вклада, но ненамного: переплата ${creditMoney(verdict.gain)}`,
        note: `${rate} против ${dep} в год — разница ${creditPct(verdict.diff)}`,
      },
      bad: {
        main: `Кредит дороже вклада: переплата ${creditMoney(verdict.gain)}`,
        note: `${rate} против ${dep} в год — деньги работают хуже, чем лежали бы на вкладе`,
      },
    };
    const text = VERDICT_TEXT[verdict.level] || VERDICT_TEXT.bad;
    const verdictMain = document.getElementById('creditVerdictMain');
    const verdictNote = document.getElementById('creditVerdictNote');
    if(verdictMain) verdictMain.textContent = text.main;
    if(verdictNote) verdictNote.textContent = text.note;
    verdictBox.classList.toggle('grow', verdict.level === 'good');
    verdictBox.classList.toggle('save', verdict.level === 'border');
    verdictBox.classList.toggle('bad', verdict.level === 'bad');
  }
  // Окупаемость: сколько в год приносит то, на что взят кредит. Это
  // единственный параметр, который может оправдать даже дорогой кредит,
  // поэтому он стоит рядом с вердиктом, а не прячется в настройках.
  const gainBox = document.getElementById('creditGainLine');
  if(gainBox){
    if(p.gain <= 0){
      gainBox.textContent = 'Деньги уйдут на покупку и ничего не принесут — кредит выгоден только тем, что не нужно копить.';
    }else if(creditRealRate(p.gain) >= verdict.realRate){
      gainBox.textContent = `Покупка приносит ${creditPct(p.gain)} в год, реальных ${creditPct(creditRealRate(p.gain))} — этого хватает, чтобы кредит окупился.`;
    }else{
      gainBox.textContent = `Покупка приносит ${creditPct(p.gain)} в год, но кредит стоит ${creditPct(verdict.realRate)} — не окупается.`;
    }
  }
  const bars = document.getElementById('creditBars');
  if(bars) bars.innerHTML = creditBarsHtml(res.years, res.amount);
  const table = document.getElementById('creditTable');
  if(table){
    table.innerHTML = res.years.map(y=>`
      <tr>
        <td>${creditPeriodLabel(y.year)}</td>
        <td>${creditMoney(y.paid)}</td>
        <td><b>${creditMoney(y.balance)}</b></td>
      </tr>`).join('');
  }
  return res;
}
function startCreditGame(){
  renderCreditResult();
  goToGame('creditSetup', 'creditGame');
  updateMuteBtn();
}
function exitCreditGame(){
  state.inProgress = false;
  state.pausedMode = null;
  state.lastSectionOnPause = null;
  saveState();
  exitGame('creditGame', 'creditSetup');
  goToCreditSetup();
  updateResumeUI();
}

/* ============ КНОПКИ И ИНИЦИАЛИЗАЦИЯ ============ */
// Один обработчик на все ползунки: у них одинаковая природа, и пять почти
// одинаковых копий разъехались бы при первом же добавлении параметра.
// Список «ползунок → поле state» объявлен данными (CREDIT_RANGES).
// Слушаем 'input', а не 'change': ползунок шлёт 'input' на каждое движение,
// и подпись обязана меняться сразу — иначе игрок тянет мышью и видит старое
// значение, пока расчёт уже по новому.
CREDIT_RANGES.forEach(r=>{
  const input = document.getElementById(r.input);
  if(!input) return;
  input.addEventListener('input', ()=>{
    state[r.field] = creditClamp(r.key, input.value);
    saveState();
    // Перерисовываются ВСЕ подписи, а не только одна: подпись первого взноса
    // зависит от суммы кредита, поэтому при её изменении «20% · 100 000 ₽»
    // стало бы «20% · 200 000 ₽» только после обновления всей строки.
    CREDIT_RANGES.forEach(x=>{
      const o = document.getElementById(x.out);
      if(o) o.textContent = x.format(creditClamp(x.key, state[x.field]));
    });
    // Плата за услуги считается от суммы кредита и срока, поэтому при
    // изменении любого из них пересчитывается и итог по услугам.
    renderCreditServices();
  });
});
// Тип кредита подставляет реальные рыночные условия продукта — это главное
// отличие игры от калькулятора с пустого листа. Меняются четыре поля сразу:
// сумма, ставка, срок и первый взнос.
document.querySelectorAll('#creditProductGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    playSuccessSound();
    const pr = creditProductById(btn.dataset.value);
    state.creditProduct = pr.id;
    state.creditAmount = creditClamp('amount', pr.amount);
    state.creditRate = creditClamp('rate', pr.rate);
    state.creditMonths = creditClamp('months', pr.months);
    state.creditDown = creditClamp('down', pr.down);
    saveState();
    renderCreditSetup();
  });
});
// График платежей — перечисление, поэтому кнопками.
document.querySelectorAll('#creditSchedGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    playSuccessSound();
    state.creditSched = creditScheduleById(btn.dataset.value).id;
    saveState();
    renderCreditSetup();
  });
});
// Услуги включаются и выключаются независимо друг от друга — это множественный
// выбор, а не перечисление, поэтому состояние хранится массивом id.
CREDIT_SERVICES.forEach(s=>{
  const btn = document.getElementById(s.el);
  if(!btn) return;
  btn.addEventListener('click', ()=>{
    playSuccessSound();
    const current = creditSelectedServices().map(x => x.id);
    state.creditServices = current.includes(s.id)
      ? current.filter(id => id !== s.id)
      : [...current, s.id];
    saveState();
    renderCreditServices();
  });
});
// Кнопки подписываются с защитой `?.` — как в «Флагах», «Столицах» и
// «Арифметике». Без неё ОДНОГО отсутствующего id (старый index.html в кэше
// Service Worker, неполная загрузка страницы) роняет весь модуль: скрипт
// выполняется по порядку, исключение прерывает его — и до следующих строк
// управление не доходит. Игрок видел ровно это: кнопка «Кредит» в меню есть
// (она в core.js), а нажатие «Рассчитать» не делает ничего.
document.getElementById('creditStartBtn')?.addEventListener('click', ()=>{ startCreditGame(); });
setupRulesModal('creditRulesModal', 'closeCreditRulesBtn');
renderCreditSetup();
