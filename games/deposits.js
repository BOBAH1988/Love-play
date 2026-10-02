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
// просто получить число: поэтому рядом с расчётом идёт «Проверка себя» —
// пять вопросов, ответы на которые считает ТОТ ЖЕ расчёт.
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
// • Налогов нет: в реальности с процентов по вкладам может удерживаться
//   налог, и он меняет итог. Здесь его сознательно нет, чтобы игрок сначала
//   понял саму механику.
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
// • Экраны depositsSetup/depositsGame/depositsCheck/depositsSummary
//   описаны в SECTION_FOR_SCREEN (games/fants-timer.js) с разделом
//   businessView, а depositsSetup/depositsCheck/depositsSummary — ещё и в
//   SETUP_ONLY_SCREENS и PARENT_BACK: это вложенные экраны, «←» с них
//   возвращает на шаг назад, а не выбрасывает в хаб.
//
// ЧЕГО ИГРА НЕ ДЕЛАЕТ
// Не обещает доходность и не советует, куда вложить деньги: ставки в ней
// учебные, а не банковские. Об этом сказано в правилах игры, в README и
// на экране расчёта прямо под суммой.

/* ============ ДОСТУПНЫЕ ЗНАЧЕНИЯ НАСТРОЕК ============ */
// Хранятся здесь, а не размазаны по разметке и коду: и кнопки настроек, и
// проверка tools/check.js сверяются с этими массивами. Расхождение «в коде
// пять ставок, а на экране четыре» ловится автоматически.
const DEPOSITS_AMOUNTS = [50000, 100000, 300000, 1000000];
const DEPOSITS_RATES = [4, 8, 12, 16, 20];
const DEPOSITS_YEARS = [1, 3, 5, 10, 20];
// Периодичность капитализации: months — как часто проценты присоединяются
// к сумме (0 = в конце срока, см. depositsSimulate).
const DEPOSITS_CAPS = [
  { id:'month',   label:'ежемесячно',     months:1,  short:'ежемесячно' },
  { id:'quarter', label:'ежеквартально', months:3,  short:'ежеквартально' },
  { id:'year',    label:'ежегодно',      months:12, short:'ежегодно' },
  { id:'end',     label:'в конце срока', months:0,  short:'в конце срока' },
];
const DEPOSITS_TOPUPS = [0, 5000, 10000, 25000];
// Сколько вопросов в «Проверке себя». Вопросы не хранятся в данных: их
// порождает расчёт (depositsCheckQuestions), поэтому правильный ответ всегда
// соответствует той же формуле, что и таблица на экране.
const DEPOSITS_CHECKS = 5;

function depositsCapById(id){
  return DEPOSITS_CAPS.find(c => c.id === id) || DEPOSITS_CAPS[0];
}
// Текущие настройки с приведением к допустимым значениям: старые сохранения
// и правка state из консоли не должны приводить к NaN в расчёте.
function depositsParams(){
  const amounts = DEPOSITS_AMOUNTS;
  const rates = DEPOSITS_RATES;
  const years = DEPOSITS_YEARS;
  const tops = DEPOSITS_TOPUPS;
  return {
    amount: amounts.includes(Number(state.depositsAmount)) ? Number(state.depositsAmount) : amounts[1],
    rate: rates.includes(Number(state.depositsRate)) ? Number(state.depositsRate) : rates[2],
    years: years.includes(Number(state.depositsYears)) ? Number(state.depositsYears) : years[2],
    cap: depositsCapById(state.depositsCap).id,
    topup: tops.includes(Number(state.depositsTopUp)) ? Number(state.depositsTopUp) : tops[0],
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
// Склонение «год/года/лет» — в тексте вопросов и подписях. Принимает и
// дробные значения (5,8 года): округляются до целого, потому что «5,8 года»
// читается неграмотно — правильно «5,8 лет». Для дробных берём слово от
// округлённого числа: 1,2 → «2 года», 2,7 → «3 года», 5,8 → «6 лет».
function depositsYearsWord(n){
  const v = Math.abs(Math.round(Number(n) || 0)) % 100;
  const last = v % 10;
  if(v > 10 && v < 20) return 'лет';
  if(last === 1) return 'год';
  if(last >= 2 && last <= 4) return 'года';
  return 'лет';
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
  const totalMonths = Math.max(1, Math.round(p.years)) * 12;
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
    if(m % 12 === 0){
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
    years,
    simpleTotal,
    extraFromCap: total - simpleTotal,
    doublingYears,
    effective,
  };
}


// Строки «Проверки себя». Каждый вопрос берёт число из расчёта, а не из
// заранее написанного ответа, поэтому «правильный» ответ невозможно забыть
// обновить при изменении формулы — он считается вместе с ней.
// res — результат depositsSimulate, p — настройки этого расчёта: они нужны,
// чтобы посчитать ответ для ЗАМЕНЯЮЩЕГО вопроса (см. ниже про нулевую разницу).
function depositsCheckQuestions(res, p){
  const firstYear = res.years[0];
  const midYear = res.years[Math.floor(res.years.length / 2)] || firstYear;
  // Вопрос о разнице с простыми процентами при выплате в конце срока
  // бессмыслен: разница ровно ноль, и три числовых варианта ответа схлопывались
  // в один «0 ₽» (на этом упал прогон по всем комбинациям настроек). Тогда
  // спрашиваем то, что и объясняет разницу: а сколько было бы при ежемесячной
  // капитализации на тех же условиях.
  const extraRounded = Math.round(res.extraFromCap);
  const useAlt = !(extraRounded >= 1);
  const altTotal = useAlt && p ? depositsSimulate({ ...p, cap:'month' }).total : 0;
  const list = [
    {
      id:'total', text:'Сколько денег будет на счёте в конце срока?',
      value: res.total, answer: Math.round(res.total), money:true,
    },
    {
      id:'profit', text:'Сколько из этой суммы начислено процентами?',
      value: res.profit, answer: Math.round(res.profit), money:true,
    },
    useAlt ? {
      id:'alt', text:'А сколько было бы на счёте, если бы проценты присоединялись каждый месяц?',
      value: altTotal, answer: Math.round(altTotal), money:true,
    } : {
      id:'extra', text:'На сколько капитализация дала больше, чем простые проценты?',
      value: res.extraFromCap, answer: extraRounded, money:true,
    },
    {
      id:'doubling', text:'Через сколько лет сумма примерно удвоится?',
      value: res.doublingYears,
      answer: res.doublingYears === null ? null : Math.max(1, Math.round(res.doublingYears)),
      years:true,
    },
    {
      id:'year', text:`Сколько денег будет на счёте через ${firstYear.year} ${depositsYearsWord(firstYear.year)}?`,
      value: firstYear.end, answer: Math.round(firstYear.end), money:true,
    },
  ].slice(0, DEPOSITS_CHECKS);
  // Пятый вопрос не должен повторять первый: при сроке в один год «через
  // 1 год» и «в конце срока» — одно и то же число, и такой вопрос ничего
  // не проверяет. Тогда спрашиваем середину срока.
  if(list.length >= 5 && list[4].value === list[0].value){
    list[4] = {
      id:'year', text:`Сколько денег будет на счёте через ${midYear.year} ${depositsYearsWord(midYear.year)}?`,
      value: midYear.end, answer: Math.round(midYear.end), money:true,
    };
  }
  return list;
}


// Три варианта ответа: верный и два правдоподобных. Отвлекающие строятся от
// верного множителем, а не выдумываются: так они правдоподобны (именно столько
// «на глаз» и ожидаешь) и гарантированно отличаются от верного — два верных
// ответа в одном вопросе были бы нечестной проверкой.
function depositsCheckOptions(q){
  const base = q.answer;
  if(base === null){
    // «В конце срока» капитализации нет, и сумма НИКОГДА не удваивается
    // только за счёт процентов. Верным ответом раньше стояло «через 10 лет» —
    // то есть ровно то, чего при простых процентах не бывает; вопрос
    // проверял бы неверное. Теперь верным является прямой ответ.
    return [
      { label:'Никогда: проценты в конце срока', correct:true },
      { label:'Удвоится примерно через 10 лет', correct:false },
      { label:'Удвоится примерно через 20 лет', correct:false },
    ];
  }
  const correctLabel = q.money ? depositsMoney(base) : `${base} ${depositsYearsWord(base)}`;
  const used = new Set([correctLabel]);
  const out = [{ label:correctLabel, correct:true }];
  const labelOf = (v) => q.money ? depositsMoney(v) : `${v} ${depositsYearsWord(v)}`;
  // Отвлекающие множители: сначала правдоподобные доли от верного, затем —
  // шаг в сторону. Второй набор нужен для малых сумм, где 0,6 и 1,5 от
  // ответа после округления дают одно и то же число: без него вопрос
  // остался бы с двумя одинаковыми кнопками.
  const candidates = q.years
    ? [2, 0.5, 3, 1]
    : [0.6, 1.5, 0.8, 1.25, 2, 0.35];
  for(const f of candidates){
    if(out.length >= 3) break;
    let v = Math.round(base * f);
    if(q.years) v = Math.max(1, v);
    if(v === base) continue;
    const label = labelOf(v);
    if(used.has(label)) continue;
    used.add(label);
    out.push({ label, correct:false });
  }
  return shuffle(out);
}
// Пояснение «почему такой ответ» — показывается сразу после выбора, чтобы
// игрок понял ход расчёта, а не просто угадал число.
function depositsCheckHint(q, res, p){
  const cap = res.cap.short;
  if(q.id === 'total'){
    // Для «в конце срока» прежняя формулировка («проценты остаются на счёте»)
    // была прямой неправдой: там они как раз НЕ присоединяются.
    return res.cap.months > 0
      ? `Каждый месяц сумма умножается на 1 + ${p.rate}% ÷ 12, и раз в ${cap} проценты остаются на счёте.`
      : `Проценты начисляются, но присоединяются к сумме только один раз — в конце срока.`;
  }
  if(q.id === 'profit'){
    return `Всего вложено ${depositsMoney(res.invested)}, на счёте ${depositsMoney(res.total)}: разница и есть проценты.`;
  }
  if(q.id === 'extra'){
    return `С простыми процентами было бы ${depositsMoney(res.simpleTotal)} — капитализация добавила сверху.`;
  }
  if(q.id === 'alt'){
    return `Сейчас выплата в конце срока: проценты не присоединяются. При ежемесячной капитализации на тех же условиях итог выше.`;
  }
  if(q.id === 'doubling'){
    if(res.doublingYears === null){
      return 'При выплате в конце срока проценты не присоединяются, сумма растёт только линейно.';
    }
    const approx = Math.max(1, Math.round(72 / p.rate));
    return `Ориентир «правило 72»: 72 ÷ ${p.rate} ≈ ${approx} ${depositsYearsWord(approx)}; точный срок — ${res.doublingYears.toFixed(1).replace('.', ',')} ${depositsYearsWord(res.doublingYears)}.`;
  }
  const year = res.years.find(y => Math.abs(y.end - q.value) < 1);
  return year
    ? `За ${year.year} ${depositsYearsWord(year.year)} начислено ${depositsMoney(year.profit)} процентами.`
    : 'Смотрите строку этого года в таблице расчёта.';
}


/* ============ ЭКРАН НАСТРОЙКИ ============ */
// Подсветка выбранной кнопки в группе. Плашки те же .starter-btn, что у
// остальных игр: своя оформка ради одного экрана выбивалась бы из раздела.
function depositsMarkGroup(groupId, value){
  document.querySelectorAll('#' + groupId + ' .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', String(btn.dataset.value) === String(value));
  });
}
function renderDepositsSetup(){
  const p = depositsParams();
  depositsMarkGroup('depositsAmountGroup', p.amount);
  depositsMarkGroup('depositsRateGroup', p.rate);
  depositsMarkGroup('depositsYearsGroup', p.years);
  depositsMarkGroup('depositsCapGroup', p.cap);
  depositsMarkGroup('depositsTopUpGroup', p.topup);
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
  state.depositsIndex = 0;
  state.depositsAnswers = [];
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
      <div class="deposit-bar-year">${y.year}</div>
    </div>`;
  }).join('');
}


function renderDepositsResult(){
  const p = depositsParams();
  const res = depositsSimulate(p);
  // Результат считается заново при каждом показе и кладётся в state: экран
  // «Проверка себя» и итоги берут РОВНО эти же числа, что нарисованы здесь.
  // Расхождение между таблицей и вопросами было бы ошибкой в понимании.
  state.depositsResult = {
    amount:p.amount, rate:p.rate, years:p.years, cap:p.cap, topup:p.topup,
    total:res.total, invested:res.invested, profit:res.profit,
    simpleTotal:res.simpleTotal, extraFromCap:res.extraFromCap,
    doublingYears:res.doublingYears, effective:res.effective,
  };
  saveState();
  const total = document.getElementById('depositsTotal');
  if(total) total.textContent = depositsMoney(res.total, true);
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
  const bars = document.getElementById('depositsBars');
  if(bars) bars.innerHTML = depositsBarsHtml(res.years);
  const table = document.getElementById('depositsTable');
  if(table){
    table.innerHTML = res.years.map(y=>`
      <tr>
        <td>${y.year} ${depositsYearsWord(y.year)}</td>
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
  state.depositsIndex = 0;
  state.depositsAnswers = [];
  saveState();
  exitGame('depositsGame', 'depositsSetup');
  goToDepositsSetup();
  updateResumeUI();
}


/* ============ ПРОВЕРКА СЕБЯ ============ */
// Расчёт для проверки берётся из state.depositsResult — того самого, что
// нарисован на экране расчёта. Если результата нет (экран открыт напрямую,
// минуя расчёт), он считается заново из настроек: проверка не должна падать.
function depositsSavedResult(){
  const r = state.depositsResult;
  if(r && typeof r.total === 'number' && r.years && typeof r.years === 'object') return r;
  const p = depositsParams();
  const res = depositsSimulate(p);
  return {
    amount:p.amount, rate:p.rate, years:p.years, cap:p.cap, topup:p.topup,
    total:res.total, invested:res.invested, profit:res.profit,
    simpleTotal:res.simpleTotal, extraFromCap:res.extraFromCap,
    doublingYears:res.doublingYears, effective:res.effective,
  };
}
function depositsCheckList(){
  const r = depositsSavedResult();
  const p = { amount:r.amount, rate:r.rate, years:r.years, cap:r.cap, topup:r.topup };
  return depositsCheckQuestions(depositsSimulate(p), p);
}
function startDepositsCheck(){
  state.depositsIndex = 0;
  state.depositsAnswers = [];
  saveState();
  const next = document.getElementById('depositsCheckNextBtn');
  if(next) next.style.display = 'none';
  renderDepositsCheck();
  activateSingleScreen('depositsCheck');
}
function renderDepositsCheck(){
  const list = depositsCheckList();
  const idx = Math.min(Math.max(0, Number(state.depositsIndex) || 0), list.length - 1);
  const q = list[idx];
  const total = list.length;
  const label = document.getElementById('depositsCheckLabel');
  if(label) label.textContent = `Вопрос ${idx + 1} / ${total}`;
  const fill = document.getElementById('depositsCheckFill');
  if(fill) fill.style.width = `${total ? ((idx + 1) / total) * 100 : 0}%`;
  const text = document.getElementById('depositsCheckText');
  if(text) text.textContent = q.text;
  const box = document.getElementById('depositsCheckAnswers');
  if(box){
    box.innerHTML = '';
    depositsCheckOptions(q).forEach(opt=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'znayu-answer-btn';
      btn.textContent = opt.label;
      btn.addEventListener('click', ()=>{ onDepositsAnswer(idx, opt, list); });
      box.appendChild(btn);
    });
  }
  const hint = document.getElementById('depositsCheckHint');
  if(hint){
    // Подсказка появляется только после ответа: до него она выдала бы
    // правильный ответ и превратила проверку в чтение.
    const answered = (state.depositsAnswers || [])[idx] !== undefined;
    hint.textContent = answered ? depositsCheckHint(q, depositsSimulate(depositsParams()), depositsParams()) : '';
    hint.style.display = hint.textContent ? 'block' : 'none';
  }
}


function onDepositsAnswer(idx, opt, list){
  const answers = Array.isArray(state.depositsAnswers) ? state.depositsAnswers : [];
  if(answers[idx] !== undefined) return;   // повторный клик по тому же вопросу
  answers[idx] = opt.correct ? 1 : 0;
  state.depositsAnswers = answers;
  saveState();
  const box = document.getElementById('depositsCheckAnswers');
  if(box){
    // Верный ответ подсвечивается сразу: угадывание без разбора ничему
    // не учит. Ошибочным помечается только тот, что нажали.
    const correctOpt = depositsCheckOptions(list[idx]).find(o => o.correct);
    const correctLabel = correctOpt ? correctOpt.label : '';
    Array.from(box.children).forEach(btn=>{
      btn.disabled = true;
      if(btn.textContent === correctLabel) btn.classList.add('answer-correct');
      else if(btn.textContent === opt.label) btn.classList.add('answer-wrong');
    });
  }
  const hint = document.getElementById('depositsCheckHint');
  if(hint){
    const p = depositsParams();
    hint.textContent = depositsCheckHint(list[idx], depositsSimulate(p), p);
    hint.style.display = 'block';
  }
  const next = document.getElementById('depositsCheckNextBtn');
  if(next) next.style.display = '';
  playSuccessSound();
}
function nextDepositsCheck(){
  const list = depositsCheckList();
  const idx = Number(state.depositsIndex) || 0;
  if(idx + 1 >= list.length){
    finishDepositsCheck();
    return;
  }
  state.depositsIndex = idx + 1;
  saveState();
  const next = document.getElementById('depositsCheckNextBtn');
  if(next) next.style.display = 'none';
  renderDepositsCheck();
}
function finishDepositsCheck(){
  const answers = Array.isArray(state.depositsAnswers) ? state.depositsAnswers : [];
  const list = depositsCheckList();
  const correct = answers.filter(a => a === 1).length;
  state.depositsIndex = list.length;
  saveState();
  renderDepositsSummary(correct, list.length);
  activateSingleScreen('depositsSummary');
}
function depositsScoreWord(correct, total){
  const share = total ? correct / total : 0;
  if(correct === total) return 'Отлично — вы читаете расчёт как формулу, а не как совпадение.';
  if(share >= 0.6) return 'Хорошо: основное поняли, остальное — повторите по таблице расчёта.';
  if(correct > 0) return 'Стоит вернуться к таблице: сначала посмотрите, как растёт сумма по годам.';
  return 'Начните с таблицы на экране расчёта: там по годам видно, откуда берётся итог.';
}
function renderDepositsSummary(correct, total){
  const title = document.getElementById('depositsSummaryTitle');
  if(title) title.textContent = `🏦 Вклады: ${correct} из ${total}`;
  const list = document.getElementById('depositsSummaryList');
  if(list) list.innerHTML = `<div class="biz-test-verdict">${depositsScoreWord(correct, total)}</div>`;
  const note = document.getElementById('depositsSummaryNote');
  if(note){
    const r = depositsSavedResult();
    note.textContent = `Расчёт: вклад ${depositsMoney(r.amount)} под ${r.rate}% на ${r.years} ${depositsYearsWord(r.years)}, `
      + `капитализация ${depositsCapById(r.cap).short} → ${depositsMoney(r.total)}. `
      + 'Настройки можно поменять и посчитать заново.';
  }
}
// Возврат с экрана проверки на экран расчёта: расчёт не теряется, в отличие
// от «Выход», который закрывает игру целиком.
function goToDepositsGameScreen(){
  renderDepositsResult();
  activateSingleScreen('depositsGame');
}
function exitDepositsCheck(){
  state.depositsIndex = 0;
  state.depositsAnswers = [];
  saveState();
  goToDepositsGameScreen();
}
function exitDepositsSummary(){
  goToDepositsSetup();
  state.inProgress = false;
  state.pausedMode = null;
  state.depositsIndex = 0;
  state.depositsAnswers = [];
  saveState();
  updateResumeUI();
}


/* ============ КНОПКИ И ИНИЦИАЛИЗАЦИЯ ============ */
// Один обработчик на все группы: у них одинаковая природа (выбор значения
// настройки), и пять почти одинаковых копий разъехались бы при первом же
// добавлении параметра. Список «группа → поле state» объявлен данными.
const DEPOSITS_GROUPS = [
  { id:'depositsAmountGroup', field:'depositsAmount' },
  { id:'depositsRateGroup',   field:'depositsRate' },
  { id:'depositsYearsGroup',  field:'depositsYears' },
  { id:'depositsCapGroup',    field:'depositsCap' },
  { id:'depositsTopUpGroup',  field:'depositsTopUp' },
];
DEPOSITS_GROUPS.forEach(g=>{
  document.querySelectorAll('#' + g.id + ' .starter-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      playSuccessSound();
      state[g.field] = g.field === 'depositsCap' ? btn.dataset.value : Number(btn.dataset.value);
      saveState();
      renderDepositsSetup();
    });
  });
});
document.getElementById('depositsStartBtn').addEventListener('click', ()=>{ startDepositsGame(); });
document.getElementById('depositsSetupExitBtn').addEventListener('click', ()=>{ exitDepositsSetup(); });
document.getElementById('depositsGameExitBtn').addEventListener('click', ()=>{ exitDepositsGame(); });
document.getElementById('depositsCheckStartBtn').addEventListener('click', ()=>{ startDepositsCheck(); });
document.getElementById('depositsCheckBackBtn').addEventListener('click', ()=>{ exitDepositsCheck(); });
document.getElementById('depositsCheckNextBtn').addEventListener('click', ()=>{ nextDepositsCheck(); });
document.getElementById('depositsSummaryExitBtn').addEventListener('click', ()=>{ exitDepositsSummary(); });
setupRulesModal('depositsRulesModal', 'closeDepositsRulesBtn');
renderDepositsSetup();

