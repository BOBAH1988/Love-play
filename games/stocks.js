// games/stocks.js — игра «Биржа акций» (раздел «Бизнес игры»).
// Загружается через <script src="games/stocks.js"></script> в index.html.

const STOCKS_CATALOG = [
  { ticker:'AAPL', name:'Apple', base:16200, vol:0.06 },
  { ticker:'MSFT', name:'Microsoft', base:37800, vol:0.05 },
  { ticker:'GOOGL', name:'Alphabet', base:15300, vol:0.06 },
  { ticker:'AMZN', name:'Amazon', base:16650, vol:0.07 },
  { ticker:'TSLA', name:'Tesla', base:22500, vol:0.12 },
  { ticker:'NVDA', name:'NVIDIA', base:81000, vol:0.10 },
  { ticker:'META', name:'Meta', base:45000, vol:0.08 },
  { ticker:'NFLX', name:'Netflix', base:58500, vol:0.09 },
  // Китайские компании
  { ticker:'BABA', name:'Alibaba', base:7200, vol:0.09 },
  { ticker:'TCEHY', name:'Tencent', base:3600, vol:0.08 },
  // Российские компании
  { ticker:'SBER', name:'Сбербанк', base:300, vol:0.05 },
  { ticker:'GAZP', name:'Газпром', base:160, vol:0.06 },
  { ticker:'LKOH', name:'Лукойл', base:7000, vol:0.05 },
  { ticker:'YNDX', name:'Яндекс', base:4000, vol:0.09 },
  { ticker:'GMKN', name:'Норникель', base:15000, vol:0.06 }
];

const STOCKS_TAX_RATE = 0.13;

let stocksPrices = {};
let stocksPrevPrices = {};
let stocksHoldings = {};
let stocksCostBasis = {};   // тикер -> суммарная стоимость покупки текущих акций
let stocksCash = 0;
let stocksRealizedProfit = 0;
let stocksPeriod = 0;
let stocksSelectedTickers = [];
let stocksSetupQuotes = {};
let stocksInitialCash = 0;   // тикер -> { price, change } на момент настройки

function stocksGenerateQuotes(){
  stocksSetupQuotes = {};
  STOCKS_CATALOG.forEach(s => {
    const change = (Math.random() * 2 - 1) * s.vol * 0.5;
    const price = Math.round(s.base * (1 + change) * 100) / 100;
    stocksSetupQuotes[s.ticker] = { price: price, change: change };
  });
}

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
    const base = s ? s.base : 100;
    const q = stocksSetupQuotes[t];
    const p = q ? q.price : base;
    stocksPrices[t] = p;
    stocksPrevPrices[t] = p;
    stocksHoldings[t] = 0;
    stocksCostBasis[t] = 0;
  });
  stocksCash = Number(state.stocksCash) || 100000;
  stocksInitialCash = stocksCash;
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
  stocksGenerateQuotes();
  document.querySelectorAll('.stock-quote').forEach(span => {
    const t = span.dataset.ticker;
    const q = stocksSetupQuotes[t];
    if(!q) return;
    const arrow = q.change >= 0 ? '▲' : '▼';
    const color = q.change >= 0 ? '#2e7d32' : '#c62828';
    span.style.opacity = '';
    span.style.fontSize = '';
    span.innerHTML = ' <span style="opacity:0.5;font-size:12px;">' + stocksMoney(q.price) + '</span> ' +
      '<span style="color:' + color + ';font-weight:bold;">' + arrow + '</span>';
  });
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
          '<button class="btn btn-secondary btn-square" style="padding:2px 8px;font-size:14px;line-height:1;" data-act="buy" data-ticker="' + t + '">+</button> ' +
          '<button class="btn btn-secondary btn-square" style="padding:2px 8px;font-size:14px;line-height:1;" data-act="sell" data-ticker="' + t + '">-</button>' +
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
  stocksCostBasis[ticker] = (stocksCostBasis[ticker] || 0) + price;
  playSuccessSound();
  renderStocksGame();
}

function stocksSell(ticker){
  const price = stocksPrices[ticker];
  if(!price) return;
  if((stocksHoldings[ticker] || 0) <= 0){ showToast('Нет акций для продажи'); return; }
  const owned = stocksHoldings[ticker];
  const avgCost = (stocksCostBasis[ticker] || 0) / owned;
  const profit = price - avgCost;
  stocksHoldings[ticker] -= 1;
  stocksCostBasis[ticker] = (stocksCostBasis[ticker] || 0) - avgCost;
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

function stocksCashOut(){
  try {
  const details = [];
  stocksSelectedTickers.forEach(t => {
    const owned = stocksHoldings[t];
    if(owned > 0){
      const price = stocksPrices[t];
      const cost = stocksCostBasis[t] || 0;
      const avgCost = owned > 0 ? cost / owned : 0;
      const profit = (price - avgCost) * owned;
      stocksHoldings[t] = 0;
      stocksCostBasis[t] = 0;
      stocksCash += price * owned;
      stocksRealizedProfit += profit;
      details.push({ ticker:t, shares:owned, price:price, profit:profit });
    }
  });
  const tax = stocksRealizedProfit > 0 ? stocksRealizedProfit * STOCKS_TAX_RATE : 0;
  const net = stocksRealizedProfit - tax;
  let html = '';
  html += '<div class="deposit-sub">Периодов прошло: ' + stocksPeriod + '</div>';
  html += '<div class="deposit-total" style="margin:8px 0;">' + stocksMoney(stocksCash) + '</div>';
  html += '<div class="deposit-sub">Заработано чистыми: ' + stocksMoney(net) + '</div>';
  html += '<div class="deposit-sub">Налог 13%: ' + stocksMoney(tax) + '</div>';
  html += '<div class="deposit-sub" style="margin-top:8px;font-weight:bold;">По акциям:</div>';
  html += '<table class="deposit-table"><thead><tr><th>Тикер</th><th>Шт.</th><th>Цена</th><th>Прибыль</th></tr></thead><tbody>';
  details.forEach(d => {
    html += '<tr><td>' + d.ticker + '</td><td>' + d.shares + '</td><td>' + stocksMoney(d.price) + '</td><td>' + stocksMoney(d.profit) + '</td></tr>';
  });
  if(details.length === 0) html += '<tr><td colspan="4">Сделок не было</td></tr>';
  html += '</tbody></table>';
  html += '<div class="deposit-sub" style="margin-top:8px;">Стартовый капитал: ' + stocksMoney(stocksInitialCash) + '</div>';
  const body = document.getElementById('stocksSummaryBody');
  if(body) body.innerHTML = html;
  const modal = document.getElementById('stocksSummaryModal');
  if(modal) modal.classList.add('show');
  } catch (e) {
    showToast('Ошибка: ' + e.message);
    console.error(e);
  }
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
document.getElementById('stocksRulesBtn')?.addEventListener('click', () => { showModal('stocksRulesModal'); });
document.getElementById('stocksNextBtn')?.addEventListener('click', () => { stocksNextPeriod(); });
document.getElementById('stocksResetBtn')?.addEventListener('click', () => { stocksResetPortfolio(); });
document.getElementById('stocksCashOutBtn')?.addEventListener('click', () => { stocksCashOut(); });
document.getElementById('closeStocksSummaryBtn')?.addEventListener('click', () => {
  const modal = document.getElementById('stocksSummaryModal');
  if(modal) modal.classList.remove('show');
  exitStocksGame();
});
document.getElementById('stocksSetupExitBtn')?.addEventListener('click', () => {
  state.inProgress = false; state.pausedMode = null; state.lastSectionOnPause = null; saveState();
  if(typeof exitGame === 'function') exitGame('stocksSetup', null);
  showSetupView('businessView');
});
document.getElementById('stocksGameExitBtn')?.addEventListener('click', () => { exitStocksGame(); });

setupRulesModal('stocksRulesModal', 'closeStocksRulesBtn');
renderStocksSetup();

