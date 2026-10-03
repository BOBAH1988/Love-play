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
// • Экраны depositsSetup и depositsGame описаны в SECTION_FOR_SCREEN
//   (games/fants-timer.js) с разделом businessView, а depositsSetup — ещё и
//   в SETUP_ONLY_SCREENS и PARENT_BACK: стрелка «←» с него возвращает в хаб.
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
  // Результат считается заново при каждом показе и нигде не сохраняется:
  // экран получает те же числа, что и рисует, из одного источника.
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

