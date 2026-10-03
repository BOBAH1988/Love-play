// games/deposits.js — игра «Вклады» (раздел «Бизнес игры»).
// Загружается через <script src="games/deposits.js"></script> в index.html.
// Данные не нужны: все числа считаются по формуле, колода карточек отсутствует.
//
// ЧТО ЭТО
// Симулятор вклада с капитализацией процентов. Игрок задаёт сумму, ставку,
// срок, периодичность капитализации и ежемесячное пополнение — и видит,
// КАК растут деньги: сколько будет на счёте, сколько из этого проценты,
// насколько больше даёт капитализация, чем простые проценты, и через какой
// срок сумма удвоится. Цель — научиться читать сложные проценты, а не
// просто получить число: сравнение с простыми процентами, эффективная
// ставка, срок удвоения и таблица по годам показывают, откуда берётся итог.
//
// ПОЧЕМУ ПОМЕСЯЧНЫЙ ЦИКЛ, А НЕ ГОДОВАЯ ФОРМУЛА
// Считаем перебором по месяцам (depositsSimulate), а не формулой
// P·(1+r/n)^(n·t). Причина в том, что игрок может задать ежемесячное
// пополнение, а срок и капитализация задаются независимо: при пополнении
// годовая формула в общем виде не работает (нужна сумма геометрической
// прогрессии со сдвигом), и любая «упрощённая» версия считала бы мимо.
// Помесячный цикл верен для ЛЮБОЙ комбинации этих четырёх настроек —
// это и было причиной выбрать его, а не красоту формулы.
//
// ЧЕСТНОСТЬ РАСЧЁТА (важно для правил и README)
// • Налог и инфляция УЧТЕНЫ — см. DEPOSITS_RU, depositsTax(),
//   depositsInflationLoss(). Числа действующие на 14.09.2026 и со временем
//   устареют: поэтому даты стоят рядом с ними, а подписи на экране называют
//   дату прямо, чтобы игрок не принял расчёт за вечный.
// • Ставка фиксированная на весь срок. В жизни ставки меняются, и вклад
//   часто продлевают — но это уже не расчёт, а прогноз.
// • Страхование вкладов (АСВ) и лимит 1,4 млн ₽ не учитываются.
// • Пополнение вносится в конце каждого месяца, проценты за этот месяц на
//   него уже не начисляются: так считают почти все калькуляторы вкладов.
// • «В конце срока» — проценты начисляются один раз в конце срока, до
//   этого момента они лежат отдельно и в сумму на счёте не входят. Это
//   самый наглядный пример того, чем сложные проценты отличаются от
//   простых, поэтому режим оставлен, а не выброшен как неудобный.
//
// СВЯЗЬ С ДРУГИМИ ЧАСТЯМИ ПРИЛОЖЕНИЯ
// • Игра без паузы (noPause в games/game-registry.js, как «Столицы» и
//   «Лимонадный ларёк»): расчёт мгновенный, терять нечего, а лишний экран
//   паузы только путает.
// • Реестр нужен, чтобы стрелка «←» из экрана расчёта возвращала в
//   настройки игры (back: 'exitDepositsGame'), а не в хаб.
// • Экраны depositsSetup и depositsGame описаны в SECTION_FOR_SCREEN
//   (games/fants-timer.js) с разделом businessView, а depositsSetup — ещё и
//   в SETUP_ONLY_SCREENS и PARENT_BACK: стрелка «←» с него возвращает в хаб.
//
// ЧЕГО ИГРА НЕ ДЕЛАЕТ
// Не обещает доходность и не советует, куда вложить деньги: ставки в ней
// учебные, а не банковские. Об этом сказано в правилах игры, в README и
// на экране расчёта прямо под суммой.

/* ============ ДОСТУПНЫЕ ЗНАЧЕНИЯ НАСТРОЕК ============ */
// Числовые условия задаются ползунками, поэтому хранятся не списки значений,
// а ДИАПАЗОНЫ: границы и шаг. Шаг — это и есть округление, о котором просил
// игрок: суммы кратны 1000 ₽, остальные параметры — десятым долям.
// min/max/step дублируются в атрибутах <input type="range"> в index.html, и
// tools/check.js сверяет одно с другим: разъехавшиеся границы дали бы
// невозможные значения (например, ставку 30,5% при max=30).
const DEPOSITS_LIMITS = {
  amount: { min:10000,  max:5000000, step:1000, def:100000 },
  rate:   { min:0.1,    max:30,     step:0.1,   def:12 },
  years:  { min:1,      max:30,     step:0.1,   def:5 },
  topup:  { min:0,      max:100000, step:1000,  def:0 },
};
// ДЕЙСТВУЮЩИЕ УСЛОВИЯ В РОССИИ
// Источники и даты важны: и ключевая ставка, и инфляция меняются, поэтому
// числа объявлены здесь с датой, а не спрятаны в формуле. Когда условия
// изменятся, правится только этот блок — и подписи на экране, и расчёт
// меняются вместе, не расходясь между собой.
// • Ключевая ставка — 14,00% годовых, действует с 14.09.2026 (решение Совета
//   директоров Банка России от 11.09.2026, cbr.ru/press/keypr). Именно она
//   задаёт необлагаемый минимум по налогу на проценты по вкладам.
// • Инфляция — 6,3% в пересчёте на год по оценке Банка России на 07.09.2026.
//   ЦБ прогнозирует 6–7% на 2026 год; берём фактическую текущую оценку, а не
//   прогноз: считаем по тому, что уже происходит, а не по ожиданиям.
// • НДФЛ с процентов по вкладам — 13% с суммы свыше необлагаемого минимума
//   и 15% с части свыше 2,4 млн ₽ в год (ст. 214.2 НК РФ). С 2023 года
//   действует особая шкала именно для вкладов, а не общая прогрессивная.
const DEPOSITS_RU = {
  keyRate: 14,
  keyRateFrom: '14.09.2026',
  inflation: 6.3,
  inflationFrom: '07.09.2026',
  ndflRate: 13,
  ndflHighRate: 15,
  ndflThreshold: 2_400_000,
  // Необлагаемый минимум по закону не ниже 12,5%: если ключевая ставка
  // опустится, порог всё равно останется 12,5% (ст. 214.2 НК РФ).
  exemptFloor: 12.5,
};

// Периодичность капитализации: months — как часто проценты присоединяются
// к сумме (0 = в конце срока, см. depositsSimulate). Это перечисление, а не
// число, поэтому осталось кнопками.
const DEPOSITS_CAPS = [
  { id:'month',   label:'ежемесячно',     months:1,  short:'ежемесячно' },
  { id:'quarter', label:'ежеквартально', months:3,  short:'ежеквартально' },
  { id:'year',    label:'ежегодно',      months:12, short:'ежегодно' },
  { id:'end',     label:'в конце срока', months:0,  short:'в конце срока' },
];

function depositsCapById(id){
  return DEPOSITS_CAPS.find(c => c.id === id) || DEPOSITS_CAPS[0];
}
// Приведение значения к допустимому: округление по шагу и зажим в границы.
// Старые сохранения и правка state из консоли не должны дать NaN в расчёте.
function depositsClamp(key, value){
  const lim = DEPOSITS_LIMITS[key];
  const n = Number(value);
  if(!lim || !Number.isFinite(n)) return lim ? lim.def : 0;
  const snapped = Math.round(n / lim.step) * lim.step;
  // Шаг 0.1 в двоичной арифметике даёт 0.30000000000000004 — округляем
  // обратно до разумного числа знаков, иначе в подписи «12,300000000000004%».
  const fixed = Math.round(snapped * 1e6) / 1e6;
  return Math.min(lim.max, Math.max(lim.min, fixed));
}
function depositsParams(){
  return {
    amount: depositsClamp('amount', state.depositsAmount),
    rate: depositsClamp('rate', state.depositsRate),
    years: depositsClamp('years', state.depositsYears),
    cap: depositsCapById(state.depositsCap).id,
    topup: depositsClamp('topup', state.depositsTopUp),
  };
}
// Сумма с копейками там, где они осмысленны (итог), и без них там, где
// округление до рубля ничего не теряет (годовые строки, варианты ответа).
function depositsMoney(n, withKopecks){
  const v = Number(n) || 0;
  const rounded = withKopecks ? Math.round(v * 100) / 100 : Math.round(v);
  return rounded.toLocaleString('ru-RU', {
    minimumFractionDigits: withKopecks ? 2 : 0,
    maximumFractionDigits: withKopecks ? 2 : 0,
  }) + ' ₽';
}
// Склонение «год/года/лет». Принимает и дробные значения: срок задаётся с
// шагом 0,1 года, поэтому подпись «5,7 лет» — правильная форма (после
// дробного числа в русском языке всегда «года», но «лет» тоже верно и
// привычнее глазу). Поэтому дробные подписываем как «X,X года», а для
// целых работает обычное склонение: 1 → «год», 3 → «года», 5 → «лет».
function depositsYearsWord(n){
  const v = Math.abs(Number(n) || 0);
  const rounded = Math.round(v) % 100;
  const last = rounded % 10;
  if(rounded > 10 && rounded < 20) return 'лет';
  if(last === 1) return 'год';
  if(last >= 2 && last <= 4) return 'года';
  return 'лет';
}
// Подпись периода для таблицы и ползунка срока. Целые годы — «5 лет»,
// дробные — «2,7 года» с запятой вместо точки (русская запись).
function depositsPeriodLabel(years){
  const v = Number(years) || 0;
  const rounded = Math.round(v * 10) / 10;
  if(Number.isInteger(rounded)) return `${rounded} ${depositsYearsWord(rounded)}`;
  return `${String(rounded).replace('.', ',')} года`;
}
// Склонение «месяц/месяца/месяцев». Отдельная функция, потому что в русском
// «2 года, 21 месяц» — а «21 месяц» склоняется иначе, чем «месяцев».
function depositsMonthsWord(n){
  const v = Math.abs(Math.round(Number(n) || 0)) % 100;
  const last = v % 10;
  if(v > 10 && v < 20) return 'месяцев';
  if(last === 1) return 'месяц';
  if(last >= 2 && last <= 4) return 'месяца';
  return 'месяцев';
}

/* ============ РАСЧЁТ ============ */
/**
 * Помесячный расчёт вклада. Возвращает всё, что показывают экраны.
 * @param {object} p — { amount, rate, years, cap, topup }
 * @returns {object} — итог, разбивка по годам, сравнение с простыми
 *   процентами, срок удвоения и эффективная ставка.
 */
function depositsSimulate(p){
  const cap = depositsCapById(p.cap);
  const monthly = Number(p.topup) || 0;
  const rate = Number(p.rate) || 0;
  // Срок приходит с шагом 0,1 года, поэтому считаем в МЕСЯЦАХ: 2,7 года —
  // это 32,4 месяца, и Math.round(years)*12 (как было при целых годах)
  // дало бы 3 года, то есть тихо завысило бы срок на 0,3 года.
  const totalMonths = Math.max(1, Math.round(Number(p.years) * 12));
  // Проценты, начисленные за месяц, но пока не присоединённые к сумме.
  // Для режима «в конце срока» они копятся здесь все месяцы и прибавляются
  // один раз в конце — это и есть простые проценты в чистом виде.
  let pending = 0;
  let balance = p.amount;
  const years = [];
  let yearStart = p.amount;
  let yearProfit = 0;
  for(let m = 1; m <= totalMonths; m++){
    // Проценты за прошедший месяц: сумма умножается на (1 + r/12).
    const monthProfit = balance * (rate / 100) / 12;
    if(cap.months > 0){
      // Капитализация: раз в cap.months месяцев проценты присоединяются.
      if(m % cap.months === 0) balance += monthProfit * cap.months;
    }else{
      // В конце срока: копим отдельно, к сумме не присоединяем.
      pending += monthProfit;
    }
    yearProfit += monthProfit;
    // Пополнение в конце месяца: на него проценты за этот месяц уже не
    // начислены (начисление выше). Порядок важен и зафиксирован в правилах.
    if(monthly > 0) balance += monthly;
    // Строка таблицы — на каждый год. Последний год может быть неполным
    // (срок 2,7 года — это 32 месяца), и без отдельной строки он просто
    // потерялся бы: итог показывал бы сумму на 2 года, а считался по 2,7.
    if(m % 12 === 0 || m === totalMonths){
      const end = balance + pending;
      years.push({ year: m / 12, start: yearStart, profit: yearProfit, end });
      yearStart = end;
      yearProfit = 0;
    }
  }
  const total = balance + pending;
  const invested = p.amount + monthly * totalMonths;
  // Тот же вклад с простыми процентами: проценты считаются на вложенное и
  // никогда не присоединяются. Сравнение честное — меняется ровно одна
  // величина (капитализация), а сумма, ставка, срок и пополнения те же.
  // Пополнения берём за середину срока (средний остаток): деньги, внесённые
  // в последний месяц, процентов почти не заработали.
  const simpleTotal = p.amount * (1 + rate / 100 * p.years)
    + monthly * totalMonths * (1 + rate / 100 * p.years / 2);
  // Срок удвоения: n = число капитализаций в год, ставка за период r/n.
  // Формула ln(2) / ln(1 + r/n) даёт число ПЕРИОДОВ, поэтому оно делится
  // на n — иначе при ежемесячной капитализации вместо лет выходили месяцы
  // (12% и 69,66 «года» вместо 5,8). Для «в конце срока» удвоения через
  // проценты нет вовсе: сумма растёт линейно, возвращаем null, и на экране
  // пишем об этом прямо.
  const perYear = cap.months > 0 ? 12 / cap.months : 0;
  const doublingYears = perYear > 0
    ? Math.log(2) / (perYear * Math.log(1 + rate / 100 / perYear))
    : null;
  // Эффективная годовая ставка: сколько процентов в год реально приносит
  // капитализация, а не сколько написано в договоре.
  const effective = perYear > 0
    ? (Math.pow(1 + rate / 100 / perYear, perYear) - 1) * 100
    : rate;
  return {
    cap,
    total,
    invested,
    profit: total - invested,
    months: totalMonths,
    years,
    simpleTotal,
    extraFromCap: total - simpleTotal,
    doublingYears,
    effective,
  };
}


// Строки «Проверки себя». Каждый вопрос берёт число из расчёта, а не из


// Проценты и ставки — с запятой, как их пишут в России: 14%, 6,3%. Формат
// toLocaleString тут не годится: он даёт неразрывный пробел и копейки, а у
// процента дробная часть — одна значащая цифра.
function depositsRuNum(n){
  const v = Number(n) || 0;
  return String(v).replace('.', ',');
}

/* ============ НАЛОГ И ИНФЛЯЦИЯ ============ */
// Проценты по вкладу облагаются НДФЛ не со всей суммы, а с превышения над
// необлагаемым минимумом: максимум(ключевая ставка, 12,5%) от суммы вкладов
// (ст. 214.2 НК РФ). Ставка 13%, а с части свыше 2,4 млн в год — 15%.
//
// Важное упрощение, и о нём сказано в правилах: по закону налог считается
// ПО КАЖДОМУ году отдельно по ставке на 1-е число декабря, а здесь сумма
// налога считается один раз за весь срок по действующей ставке. Для длинных
// вкладов реальный налог окажется выше — честнее показать нижнюю оценку,
// чем притворяться точностью, которой в игре нет.
function depositsTax(res){
  const ru = DEPOSITS_RU;
  const exemptRate = Math.max(ru.keyRate, ru.exemptFloor) / 100;
  const exempt = exemptRate * res.invested;
  const taxable = Math.max(0, res.profit - exempt);
  if(taxable <= 0){
    return { taxable:0, exempt, tax:0, rate:ru.ndflRate };
  }
  // Шкала: 13% на первые 2,4 млн облагаемого дохода, 15% на остальное.
  const base = Math.min(taxable, ru.ndflThreshold);
  const extra = Math.max(0, taxable - ru.ndflThreshold);
  const tax = base * ru.ndflRate / 100 + extra * ru.ndflHighRate / 100;
  return { taxable, exempt, tax, rate:extra > 0 ? ru.ndflHighRate : ru.ndflRate };
}
// Инфляция за срок: насколько итог обесценится в покупательной способности.
// Считаем от реальной стоимости денег в ценах начала срока: сколько из
// накопленного надо вычесть, чтобы купить столько же, сколько вложили.
function depositsInflationLoss(res){
  const years = res.months / 12;
  const factor = Math.pow(1 + DEPOSITS_RU.inflation / 100, years);
  const realValue = res.total / factor;
  return { loss: Math.max(0, res.total - realValue), realValue };
}

/* ============ ЭКРАН НАСТРОЙКИ ============ */
// Подсветка выбранной кнопки в группе. Плашки те же .starter-btn, что у
// остальных игр: своя оформка ради одного экрана выбивалась бы из раздела.
// Осталась только для капитализации — единственного перечисления.
function depositsMarkGroup(groupId, value){
  document.querySelectorAll('#' + groupId + ' .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', String(btn.dataset.value) === String(value));
  });
}
// Ползунки и их подписи описаны данными: у всех четырёх одна природа, и четыре
// почти одинаковые копии разъехались бы при первом же изменении диапазона.
// Формат подписи разный намеренно: «не пополнять» читается лучше «0 ₽».
const DEPOSITS_RANGES = [
  { key:'amount', field:'depositsAmount', input:'depositsAmountRange', out:'depositsAmountValue',
    format: v => depositsMoney(v) },
  { key:'rate', field:'depositsRate', input:'depositsRateRange', out:'depositsRateValue',
    format: v => `${String(v).replace('.', ',')}%` },
  { key:'years', field:'depositsYears', input:'depositsYearsRange', out:'depositsYearsValue',
    format: v => depositsPeriodLabel(v) },
  { key:'topup', field:'depositsTopUp', input:'depositsTopUpRange', out:'depositsTopUpValue',
    format: v => v > 0 ? depositsMoney(v) : 'не пополнять' },
];
function renderDepositsSetup(){
  const p = depositsParams();
  DEPOSITS_RANGES.forEach(r=>{
    const input = document.getElementById(r.input);
    if(input) input.value = String(p[r.key]);
    const out = document.getElementById(r.out);
    if(out) out.textContent = r.format(p[r.key]);
  });
  depositsMarkGroup('depositsCapGroup', p.cap);
}
function goToDepositsSetup(){
  goToGameSetup('depositsSetup', 'businessView', ()=>{
    renderDepositsSetup();
  });
}
// Выход с экрана настроек — В ХАБ, а не обратно в настройки. Стрелка «←» на
// экране настроек вызывает эту же функцию (PARENT_BACK), и прежний вариант с
// goToDepositsSetup() вёл в бесконечный круг: «←» просто перерисовывал тот же
// экран, и из игры нельзя было выйти (поймал смоук-тест навигации).
// Гасим экраны вручную, как в «Бизнес тестах»: этот выход идёт ДО запуска
// игры, поэтому goToGameSetup() здесь и не нужен, и неверен.
function exitDepositsSetup(){
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
// Диаграмма роста: столбик на каждый год, высота — от общей суммы. Показывает
// главное свойство сложных процентов: чем длиннее срок, тем круче идут
// последние столбики, и это заметно глазом быстрее, чем в таблице цифр.
function depositsBarsHtml(years){
  const max = years.length ? Math.max(...years.map(y => y.end)) : 1;
  return years.map(y=>{
    const h = max > 0 ? Math.max(4, Math.round((y.end / max) * 100)) : 4;
    return `<div class="deposit-bar-col">
      <div class="deposit-bar" style="height:${h}%"></div>
      <div class="deposit-bar-year">${depositsPeriodLabel(y.year).replace(' года','').replace(' год','').replace(' лет','')}</div>
    </div>`;
  }).join('');
}


function renderDepositsResult(){
  const p = depositsParams();
  const res = depositsSimulate(p);
  // Результат считается заново при каждом показе и нигде не сохраняется:
  // экран получает те же числа, что и рисует, из одного источника.
  const total = document.getElementById('depositsTotal');
  if(total) total.textContent = depositsMoney(res.total, true);
  // Срок, на который считалось. Берём res.months — это фактическое число
  // месяцев из расчёта, а не заданный p.years: для дробного срока они
  // расходятся (2,7 года превращаются в 32 месяца), и подпись обязана
  // показывать то, по чему действительно считали.
  const term = document.getElementById('depositsTerm');
  if(term){
    term.textContent = `Вложено на ${depositsPeriodLabel(res.months / 12)} — ${res.months} ${depositsMonthsWord(res.months)}`;
  }
  const invested = document.getElementById('depositsInvested');
  if(invested){
    invested.textContent = `Вложено ${depositsMoney(res.invested)}`
      + (p.topup > 0 ? ` (вклад ${depositsMoney(p.amount)} + по ${depositsMoney(p.topup)} в месяц)` : '');
  }
  const profit = document.getElementById('depositsProfit');
  if(profit) profit.textContent = `Процентами начислено ${depositsMoney(res.profit, true)}`;
  const compare = document.getElementById('depositsCompare');
  if(compare){
    compare.textContent = res.extraFromCap >= 1
      ? `С простыми процентами было бы ${depositsMoney(res.simpleTotal)} — капитализация дала на ${depositsMoney(res.extraFromCap)} больше.`
      : 'При выплате в конце срока капитализации нет: сумма растёт только за счёт процентов на вложенное.';
  }
  const eff = document.getElementById('depositsEffective');
  if(eff){
    eff.textContent = p.cap === 'end'
      ? 'Эффективная ставка равна договорной: проценты не присоединяются.'
      : `Эффективная годовая ставка — ${res.effective.toFixed(2).replace('.', ',')}% при ${p.rate}% в договоре.`;
  }
  const double = document.getElementById('depositsDoubling');
  if(double){
    double.textContent = res.doublingYears === null
      ? 'Удвоения не будет: при выплате в конце срока сумма растёт линейно.'
      : `Сумма примерно удвоится через ${res.doublingYears.toFixed(1).replace('.', ',')} ${depositsYearsWord(res.doublingYears)}.`;
  }
  // Налог с процентов по вкладу. Показываем и сумму, и почему она такая:
  // без необлагаемого минимума цифра выглядит завышенной и пугает зря.
  const tax = depositsTax(res);
  const taxBox = document.getElementById('depositsTax');
  if(taxBox){
    const rate = `${depositsRuNum(DEPOSITS_RU.keyRate)}%`;
    taxBox.textContent = tax.tax < 1
      ? `Налог на проценты по вкладу — 0 ₽: доход не превысил необлагаемый минимум ${depositsMoney(tax.exempt)} (${rate} годовых — ключевая ставка с ${DEPOSITS_RU.keyRateFrom}).`
      : `Налог на проценты по вкладу — ${depositsMoney(tax.tax)} (${tax.rate}% с ${depositsMoney(tax.taxable)} сверх необлагаемого минимума ${depositsMoney(tax.exempt)}; ключевая ставка ${rate} с ${DEPOSITS_RU.keyRateFrom}).`;
  }
  // Инфляция за срок: итог в ценах начала вклада.
  const infl = depositsInflationLoss(res);
  const inflBox = document.getElementById('depositsInflation');
  if(inflBox){
    const pct = depositsRuNum(DEPOSITS_RU.inflation);
    inflBox.textContent = `Примерная инфляция за срок — ${depositsMoney(infl.loss)}: итог ${depositsMoney(res.total)} `
      + `подстричь до ${depositsMoney(infl.realValue)} в ценах начала срока (${pct}% в год, оценка ЦБ на ${DEPOSITS_RU.inflationFrom}).`;
  }
  const bars = document.getElementById('depositsBars');
  if(bars) bars.innerHTML = depositsBarsHtml(res.years);
  const table = document.getElementById('depositsTable');
  if(table){
    table.innerHTML = res.years.map(y=>`
      <tr>
        <td>${depositsPeriodLabel(y.year)}</td>
        <td>${depositsMoney(y.profit)}</td>
        <td><b>${depositsMoney(y.end)}</b></td>
      </tr>`).join('');
  }
  return res;
}
function startDepositsGame(){
  renderDepositsResult();
  goToGame('depositsSetup', 'depositsGame');
  updateMuteBtn();
}
function exitDepositsGame(){
  state.inProgress = false;
  state.pausedMode = null;
  state.lastSectionOnPause = null;
  saveState();
  exitGame('depositsGame', 'depositsSetup');
  goToDepositsSetup();
  updateResumeUI();
}


/* ============ КНОПКИ И ИНИЦИАЛИЗАЦИЯ ============ */
// Один обработчик на все ползунки: у них одинаковая природа, и четыре почти
// одинаковые копии разъехались бы при первом же добавлении параметра.
// Список «ползунок → поле state» объявлен данными (DEPOSITS_RANGES).
// Слушаем 'input', а не 'change': ползунок шлёт 'input' на каждое движение,
// и подпись обязана меняться сразу — иначе игрок тянет мышью и видит старое
// значение, пока расчёт уже по новому.
DEPOSITS_RANGES.forEach(r=>{
  const input = document.getElementById(r.input);
  if(!input) return;
  input.addEventListener('input', ()=>{
    state[r.field] = depositsClamp(r.key, input.value);
    saveState();
    const out = document.getElementById(r.out);
    if(out) out.textContent = r.format(state[r.field]);
  });
});
// Капитализация осталась кнопками: это перечисление, а не число.
document.querySelectorAll('#depositsCapGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    playSuccessSound();
    state.depositsCap = btn.dataset.value;
    saveState();
    renderDepositsSetup();
  });
});
// Кнопки подписываются с защитой `?.` — как в «Флагах», «Столицах» и
// «Арифметике». Без неё ОДНОГО отсутствующего id (старый index.html в кэше
// Service Worker, неполная загрузка страницы) роняет весь модуль: скрипт
// выполняется по порядку, исключение прерывает его — и до следующих строк
// управление не доходит. Игрок видел ровно это: кнопка «Вклады» в меню есть
// (она в core.js), а нажатие «Рассчитать» не делает ничего. Подписка идёт
// прямыми вызовами getElementById('id') — такой вид читает проверка
// «у каждой кнопки «Пауза»/«Выход» есть обработчик» в check.js.
document.getElementById('depositsStartBtn')?.addEventListener('click', ()=>{ startDepositsGame(); });
document.getElementById('depositsSetupExitBtn')?.addEventListener('click', ()=>{ exitDepositsSetup(); });
document.getElementById('depositsGameExitBtn')?.addEventListener('click', ()=>{ exitDepositsGame(); });
setupRulesModal('depositsRulesModal', 'closeDepositsRulesBtn');
renderDepositsSetup();

