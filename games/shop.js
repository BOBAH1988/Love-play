// games/shop.js — Игра "Магазин" (дети).
// Загружается через <script src="games/shop.js"></script> в index.html.
// Два режима (см. настройку state.shopMode):
//  - "Покупатель": листаете карточки товаров, добавляете в корзину, затем
//    нужно расплатиться игрушечными деньгами БЕЗ СДАЧИ — сумма должна
//    совпасть с итогом корзины ровно.
//  - "Продавец": на карточке кассы — случайный список купленных товаров,
//    итоговая сумма и сумма наличных от покупателя; нужно отсчитать и
//    выдать правильную сдачу.
// Прогресс партии не сохраняется между сессиями (простая игра для тренировки
// счёта, без общего меню паузы) — тот же принцип, что у детских Мемасиков.

let shopCurrentProduct = null;
let shopUsedProducts = [];
let shopCart = [];
let shopStage = 'shopping'; // 'shopping' | 'paying' — только для режима "Покупатель"
let shopMoneySelected = [];
let shopMoneyTarget = 0;
let shopMoneyMode = 'pay'; // 'pay' (Покупатель) | 'change' (Продавец)
let shopSaleItems = [];
let shopSaleTotal = 0;
let shopCashGiven = 0;

function getShopProductsList(){
  if(typeof SHOP_PRODUCTS === 'undefined' || !Array.isArray(SHOP_PRODUCTS)) return [];
  return SHOP_PRODUCTS;
}

/* ============ НАСТРОЙКА ============ */
function renderShopModeGroup(){
  document.querySelectorAll('#shopModeGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', btn.dataset.value === (state.shopMode || 'buyer'));
  });
}
document.querySelectorAll('#shopModeGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.shopMode = btn.dataset.value;
    saveState();
    renderShopModeGroup();
  });
});
function goToShopSetup(){
  goToGameSetup('shopSetup', null, ()=>{
    renderShopModeGroup();
  });
}
function exitShopSetup(){
  document.getElementById('shopSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('soloView');
}

/* ============ ОБЩИЙ ДЕНЕЖНЫЙ ЛОТОК (и оплата, и сдача) ============ */
function formatRub(n){ return n + ' ₽'; }
function shopMoneySum(){ return shopMoneySelected.reduce((a,b)=>a+b, 0); }
function renderShopMoneyGrid(){
  const wrap = document.getElementById('shopMoneyGrid');
  if(!wrap) return;
  wrap.innerHTML = '';
  const list = (typeof SHOP_MONEY !== 'undefined' && Array.isArray(SHOP_MONEY)) ? SHOP_MONEY : [];
  const groups = [
    { type: 'coin', label: 'Монеты' },
    { type: 'bill', label: 'Купюры' }
  ];
  groups.forEach(g=>{
    const items = list.filter(m=>m.type === g.type);
    if(items.length === 0) return;
    const groupEl = document.createElement('div');
    groupEl.className = 'shop-money-group';
    const labelEl = document.createElement('div');
    labelEl.className = 'shop-money-group-label';
    labelEl.textContent = g.label;
    groupEl.appendChild(labelEl);
    const rowEl = document.createElement('div');
    rowEl.className = 'shop-money-row';
    items.forEach(m=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shop-money-btn shop-money-' + m.type;
      btn.textContent = formatRub(m.value);
      btn.addEventListener('click', ()=>{
        shopMoneySelected.push(m.value);
        renderShopMoneySelected();
      });
      rowEl.appendChild(btn);
    });
    groupEl.appendChild(rowEl);
    wrap.appendChild(groupEl);
  });
}
function renderShopMoneySelected(){
  const sumEl = document.getElementById('shopMoneySum');
  if(sumEl) sumEl.textContent = formatRub(shopMoneySum());
  const wrap = document.getElementById('shopMoneySelected');
  if(wrap){
    const byValue = {};
    (typeof SHOP_MONEY !== 'undefined' ? SHOP_MONEY : []).forEach(m=>{ byValue[m.value] = m.type; });
    wrap.innerHTML = shopMoneySelected.map((v,i)=>{
      const icon = byValue[v] === 'bill' ? '💵' : '🪙';
      return `<button type="button" class="shop-money-chip" data-idx="${i}">${icon} ${formatRub(v)}<span class="shop-money-chip-remove">✕</span></button>`;
    }).join('');
    wrap.querySelectorAll('.shop-money-chip').forEach(chip=>{
      chip.addEventListener('click', ()=>{
        const idx = parseInt(chip.dataset.idx, 10);
        shopMoneySelected.splice(idx, 1);
        renderShopMoneySelected();
      });
    });
  }
}
function openShopMoneyPanel(target, mode){
  shopMoneyTarget = target;
  shopMoneyMode = mode;
  shopMoneySelected = [];
  const label = document.getElementById('shopMoneyTargetLabel');
  if(label){
    label.textContent = mode === 'pay'
      ? `Нужно заплатить без сдачи: ${formatRub(target)}`
      : `Нужно отдать сдачу: ${formatRub(target)}`;
  }
  renderShopMoneyGrid();
  renderShopMoneySelected();
  document.getElementById('shopMoneyPanel').style.display = '';
}
function closeShopMoneyPanel(){
  document.getElementById('shopMoneyPanel').style.display = 'none';
}
document.getElementById('shopMoneyClearBtn').addEventListener('click', ()=>{
  shopMoneySelected = [];
  renderShopMoneySelected();
});
document.getElementById('shopMoneySubmitBtn').addEventListener('click', ()=>{
  const sum = shopMoneySum();
  if(sum === shopMoneyTarget){
    playSuccessSound();
    if(shopMoneyMode === 'pay'){
      showToast('Отлично! Сумма совпала копейка в копейку 🎉');
      shopCart = [];
      shopStage = 'shopping';
      closeShopMoneyPanel();
      renderShopCart();
      document.getElementById('shopBuyerShopping').style.display = '';
      shopDrawProduct();
    } else {
      showToast('Верно! Сдача выдана правильно 🎉');
      shopNewSale();
    }
  } else {
    playErrorSound();
    const diff = sum - shopMoneyTarget;
    showToast(diff > 0 ? `Слишком много — уберите ${formatRub(diff)}` : `Не хватает ${formatRub(-diff)}`);
  }
});

/* ============ РЕЖИМ "ПОКУПАТЕЛЬ" ============ */
function shopCartTotal(){ return shopCart.reduce((a,c)=>a+c.price, 0); }
function renderShopCart(){
  const list = document.getElementById('shopCartList');
  if(list){
    list.innerHTML = shopCart.length === 0
      ? '<li class="shop-cart-empty">Корзина пуста</li>'
      : shopCart.map(c=>`<li>${c.icon} ${c.name} — ${formatRub(c.price)}</li>`).join('');
  }
  const totalEl = document.getElementById('shopCartTotal');
  if(totalEl) totalEl.textContent = `Итого: ${formatRub(shopCartTotal())}`;
  const payBtn = document.getElementById('shopGoToPayBtn');
  if(payBtn) payBtn.disabled = shopCart.length === 0;
}
function shopDrawProduct(){
  const all = getShopProductsList();
  if(all.length === 0){ shopCurrentProduct = null; return; }
  let pool = all.filter(p=>!shopUsedProducts.includes(p.name));
  if(pool.length === 0){
    pool = all;
    shopUsedProducts = [];
  }
  const card = pool[Math.floor(Math.random()*pool.length)];
  shopUsedProducts.push(card.name);
  shopCurrentProduct = card;
  fadeSwapEl('shopProductCard', (el)=>{
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-body">
          <div class="card-icon" style="font-size:64px;">${card.icon}</div>
          <div class="card-split-title">${card.name}</div>
          <div class="card-text">${formatRub(card.price)}</div>
        </div>
      </div>
    `;
  });
}
document.getElementById('shopAddToCartBtn').addEventListener('click', ()=>{
  if(!shopCurrentProduct) return;
  playSuccessSound();
  shopCart.push(shopCurrentProduct);
  renderShopCart();
  shopDrawProduct();
});
document.getElementById('shopSkipProductBtn').addEventListener('click', ()=>{
  shopDrawProduct();
});
document.getElementById('shopGoToPayBtn').addEventListener('click', ()=>{
  if(shopCart.length === 0) return;
  shopStage = 'paying';
  document.getElementById('shopBuyerShopping').style.display = 'none';
  openShopMoneyPanel(shopCartTotal(), 'pay');
});
document.getElementById('shopBackToShoppingBtn').addEventListener('click', ()=>{
  shopStage = 'shopping';
  closeShopMoneyPanel();
  document.getElementById('shopBuyerShopping').style.display = '';
});

/* ============ РЕЖИМ "ПРОДАВЕЦ" ============ */
// Сколько наличных даёт покупатель: случайная купюра не меньше суммы покупки
// (иногда — ровно сумма, тогда сдачи не будет вовсе).
function pickShopCashGiven(total){
  const bills = (typeof SHOP_MONEY !== 'undefined' ? SHOP_MONEY : []).filter(m=>m.type==='bill').map(m=>m.value);
  const candidates = bills.filter(v=>v>=total);
  candidates.push(total);
  return candidates[Math.floor(Math.random()*candidates.length)];
}
function shopNewSale(){
  const all = getShopProductsList();
  const count = 2 + Math.floor(Math.random()*3); // 2-4 товара
  const items = [];
  for(let i=0;i<count;i++){
    items.push(all[Math.floor(Math.random()*all.length)]);
  }
  shopSaleItems = items;
  shopSaleTotal = items.reduce((a,c)=>a+c.price, 0);
  shopCashGiven = pickShopCashGiven(shopSaleTotal);
  const list = document.getElementById('shopSaleList');
  if(list) list.innerHTML = items.map(c=>`<li>${c.icon} ${c.name} — ${formatRub(c.price)}</li>`).join('');
  const totalEl = document.getElementById('shopSaleTotal');
  if(totalEl) totalEl.textContent = `Итого: ${formatRub(shopSaleTotal)}`;
  const cashEl = document.getElementById('shopCashGivenText');
  if(cashEl) cashEl.textContent = `Покупатель даёт: ${formatRub(shopCashGiven)}`;
  openShopMoneyPanel(shopCashGiven - shopSaleTotal, 'change');
}
document.getElementById('shopNextSaleBtn').addEventListener('click', ()=>{
  shopNewSale();
});

/* ============ ВХОД/ВЫХОД ИЗ ИГРЫ ============ */
function goToShopGame(){
  goToGame('shopSetup', 'shopGame');
  const mode = state.shopMode || 'buyer';
  document.getElementById('shopBuyerShopping').style.display = mode === 'buyer' ? '' : 'none';
  document.getElementById('shopSellerPanel').style.display = mode === 'seller' ? '' : 'none';
  document.getElementById('shopBackToShoppingBtn').style.display = mode === 'buyer' ? '' : 'none';
  document.getElementById('shopNextSaleBtn').style.display = mode === 'seller' ? '' : 'none';
  if(mode === 'buyer'){
    shopCart = [];
    shopUsedProducts = [];
    shopStage = 'shopping';
    closeShopMoneyPanel();
    renderShopCart();
    shopDrawProduct();
  } else {
    closeShopMoneyPanel();
    shopNewSale();
  }
  updateMuteBtn();
  requestWakeLock();
}
function exitShopGame(){
  exitGame('shopGame', 'shopSetup');
}
document.getElementById('shopSetupStartBtn').addEventListener('click', ()=>{ goToShopGame(); });
document.getElementById('shopSetupExitBtn').addEventListener('click', ()=>{ exitShopSetup(); });
document.getElementById('shopExitBtn').addEventListener('click', ()=>{ exitShopGame(); });
(document.getElementById('shopGameRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ document.getElementById('shopRulesModal').classList.add('show'); });
document.getElementById('closeShopRulesBtn').addEventListener('click', ()=>{ document.getElementById('shopRulesModal').classList.remove('show'); });
document.getElementById('shopRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'shopRulesModal') e.currentTarget.classList.remove('show'); });
