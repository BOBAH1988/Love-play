// games/stocks.js — игра «Биржа акций» (раздел «Бизнес игры»).
// Загружается через <script src="games/stocks.js"></script> в index.html.

const STOCKS_CATALOG = [
  { ticker:'AAPL', name:'Apple', base:180, vol:0.06 },
  { ticker:'MSFT', name:'Microsoft', base:420, vol:0.05 },
  { ticker:'GOOGL', name:'Alphabet', base:170, vol:0.06 },
  { ticker:'AMZN', name:'Amazon', base:185, vol:0.07 },
  { ticker:'TSLA', name:'Tesla', base:250, vol:0.12 },
  { ticker:'NVDA', name:'NVIDIA', base:900, vol:0.10 },
  { ticker:'META', name:'Meta', base:500, vol:0.08 },
  { ticker:'NFLX', name:'Netflix', base:650, vol:0.09 }
];

const STOCKS_TAX_RATE = 0.13;

let stocksPrices = {};
let stocksPrevPrices = {};
let stocksHoldings = {};
let stocksCash = 0;
let stocksRealizedProfit = 0;
let stocksPeriod = 0;
let stocksSelectedTickers = [];

function stocksMoney(n){
  return Math.round(n).toLocaleString('ru-RU') + ' ₽';
}

function stocksFind(ticker){
  return STOCKS_CATALOG.find(s => s.ticker === ticker);
}

function stocksInitSession(){
  stocksSelectedTickers = (Array.isArray(state.stocksSelected) && state.stocksSelected.length)
    ? state.stocksSelected.slice() : ['AAPL','MSFT','GOOGL'];
  stocksPrices = {};
  stocksPrevPrices = {};
  stocksHoldings = {};
  stocksSelectedTickers.forEach(t => {
    const s = stocksFind(t);
    const p = s ? s.base : 100;
    stocksPrices[t] = p;
    stocksPrevPrices[t] = p;
    stocksHoldings[t] = 0;
  });
  stocksCash = Number(state.stocksCash) || 100000;
  stocksRealizedProfit = 0;
  stocksPeriod = 0;
}

function goToStocksSetup(){
  goToGameSetup('stocksSetup', 'businessView', ()=>{
    renderStocksSetup();
  });
}

function exitStocksSetup(){
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

function renderStocksSetup(){
  const checks = document.querySelectorAll('#stocksChecks input[type="checkbox"]');
  checks.forEach(cb => {
    const t = cb.dataset.ticker;
    cb.checked = (state.stocksSelected || []).includes(t);
  });
  const scale = state.stocksTimeScale || 'week';
  document.querySelectorAll('#stocksScaleGroup .starter-btn').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.value === scale);
  });
  const range = document.getElementById('stocksCashRange');
  if(range){ range.value = state.stocksCash || 100000; }
  const out = document.getElementById('stocksCashValue');
  if(out){ out.textContent = stocksMoney(state.stocksCash || 100000); }
}
function startStocksGame(){
  const selected = [];
  document.querySelectorAll('#stocksChecks input[type="checkbox"]').forEach(cb => {
    if(cb.checked) selected.push(cb.dataset.ticker);
  });
  if(selected.length === 0){ showToast('Выберите хотя бы одну акцию'); return; }
  state.stocksSelected = selected;
  const scaleBtn = document.querySelector('#stocksScaleGroup .starter-btn.on');
  state.stocksTimeScale = scaleBtn ? scaleBtn.dataset.value : (state.stocksTimeScale || 'week');
  const range = document.getElementById('stocksCashRange');
  state.stocksCash = range ? Number(range.value) : (state.stocksCash || 100000);
  saveState();
  stocksInitSession();
  renderStocksGame();
  goToGame('stocksSetup', 'stocksGame');
  updateMuteBtn();
}

function stocksPortfolioValue(){
  let v = 0;
  stocksSelectedTickers.forEach(t => {
    v += (stocksHoldings[t] || 0) * (stocksPrices[t] || 0);
  });
  return v;
}

function renderStocksGame(){
  const total = stocksCash + stocksPortfolioValue();
  const totalEl = document.getElementById('stocksTotal');
  if(totalEl) totalEl.textContent = stocksMoney(total);
  const cashEl = document.getElementById('stocksCash');
  if(cashEl) cashEl.textContent = 'Кэш: ' + stocksMoney(stocksCash);
  const profitEl = document.getElementById('stocksProfit');
  if(profitEl) profitEl.textContent = 'Зафиксированная прибыль: ' + stocksMoney(stocksRealizedProfit);
  const taxEl = document.getElementById('stocksTax');
  if(taxEl) taxEl.textContent = 'Налог 13%: ' + stocksMoney(stocksRealizedProfit > 0 ? stocksRealizedProfit * STOCKS_TAX_RATE : 0);

  const tbody = document.getElementById('stocksRows');
  if(tbody){
    tbody.innerHTML = stocksSelectedTickers.map(t => {
      const s = stocksFind(t);
      const price = stocksPrices[t] || 0;
      const prev = stocksPrevPrices[t] || price;
      const change = prev ? ((price - prev) / prev * 100) : 0;
      const sign = change >= 0 ? '+' : '';
      const cls = change >= 0 ? 'stock-up' : 'stock-down';
      const owned = stocksHoldings[t] || 0;
      return '<tr>' +
        '<td><b>' + t + '</b><br><span style="font-size:11px;opacity:.7">' + (s ? s.name : '') + '</span></td>' +
        '<td>' + stocksMoney(price) + '</td>' +
        '<td class="' + cls + '">' + sign + change.toFixed(2) + '%</td>' +
        '<td>' + owned + ' шт.</td>' +
        '<td style="white-space:nowrap;">' +
          '<button class="btn btn-secondary btn-square" data-act="buy" data-ticker="' + t + '">+</button> ' +
          '<button class="btn btn-secondary btn-square" data-act="sell" data-ticker="' + t + '">-</button>' +
        '</td>' +
      '</tr>';
    }).join('');
    tbody.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.ticker;
        if(btn.dataset.act === 'buy') stocksBuy(t);
        else stocksSell(t);
      });
    });
  }
}

function stocksBuy(ticker){
  const price = stocksPrices[ticker];
  if(!price) return;
  if(stocksCash < price){ showToast('Недостаточно средств'); return; }
  stocksCash -= price;
  stocksHoldings[ticker] = (stocksHoldings[ticker] || 0) + 1;
  playSuccessSound();
  renderStocksGame();
}

function stocksSell(ticker){
  const price = stocksPrices[ticker];
  if(!price) return;
  if((stocksHoldings[ticker] || 0) <= 0){ showToast('Нет акций для продажи'); return; }
  const s = stocksFind(ticker);
  const base = s ? s.base : price;
  const profit = price - base;
  stocksHoldings[ticker] -= 1;
  stocksCash += price;
  stocksRealizedProfit += profit;
  playSuccessSound();
  renderStocksGame();
}

function stocksNextPeriod(){
  const scale = state.stocksTimeScale || 'week';
  const factor = scale === 'day' ? 1 : (scale === 'week' ? 5 : 20);
  stocksSelectedTickers.forEach(t => {
    const s = stocksFind(t);
    const vol = (s ? s.vol : 0.07) * Math.sqrt(factor);
    const change = (Math.random() * 2 - 1) * vol;
    stocksPrevPrices[t] = stocksPrices[t];
    let np = stocksPrices[t] * (1 + change);
    if(np < 1) np = 1;
    stocksPrices[t] = Math.round(np * 100) / 100;
  });
  stocksPeriod++;
  renderStocksGame();
  showToast('Период ' + stocksPeriod);
}

function stocksResetPortfolio(){
  if(!confirm('Сбросить портфель и начать заново?')) return;
  stocksInitSession();
  renderStocksGame();
}

function exitStocksGame(){
  state.inProgress = false;
  state.pausedMode = null;
  state.lastSectionOnPause = null;
  state.stocksCash = stocksCash;
  state.stocksSelected = stocksSelectedTickers.slice();
  saveState();
  exitGame('stocksGame', 'stocksSetup');
  goToStocksSetup();
  updateResumeUI();
}

document.querySelectorAll('#stocksScaleGroup .starter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    playSuccessSound();
    document.querySelectorAll('#stocksScaleGroup .starter-btn').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    state.stocksTimeScale = btn.dataset.value;
    saveState();
  });
});

const stocksCashRange = document.getElementById('stocksCashRange');
if(stocksCashRange){
  stocksCashRange.addEventListener('input', () => {
    state.stocksCash = Number(stocksCashRange.value);
    saveState();
    const out = document.getElementById('stocksCashValue');
    if(out) out.textContent = stocksMoney(state.stocksCash);
  });
}

document.getElementById('stocksStartBtn')?.addEventListener('click', () => { startStocksGame(); });
document.getElementById('stocksNextBtn')?.addEventListener('click', () => { stocksNextPeriod(); });
document.getElementById('stocksResetBtn')?.addEventListener('click', () => { stocksResetPortfolio(); });
document.getElementById('stocksSetupExitBtn')?.addEventListener('click', () => {
  state.inProgress = false; state.pausedMode = null; state.lastSectionOnPause = null; saveState();
  if(typeof exitGame === 'function') exitGame('stocksSetup', null);
  showSetupView('businessView');
});
document.getElementById('stocksGameExitBtn')?.addEventListener('click', () => { exitStocksGame(); });

setupRulesModal('stocksRulesModal', 'closeStocksRulesBtn');
renderStocksSetup();

