// cards_shop.js — данные для игры «Магазин» (дети): товары с ценами и
// номиналы игрушечных денег (учимся считать и давать точную сумму/сдачу).
// SHOP_PRODUCTS — { name, price, icon }, цены — круглые числа в рублях.
// SHOP_MONEY — { value, type: 'coin'|'bill' } — по образцу реальных
// российских монет и купюр.

const SHOP_PRODUCTS = [
  { name: 'Яблоко', price: 15, icon: '🍎' },
  { name: 'Банан', price: 20, icon: '🍌' },
  { name: 'Апельсин', price: 25, icon: '🍊' },
  { name: 'Груша', price: 18, icon: '🍐' },
  { name: 'Виноград', price: 40, icon: '🍇' },
  { name: 'Арбуз', price: 90, icon: '🍉' },
  { name: 'Клубника', price: 60, icon: '🍓' },
  { name: 'Батон хлеба', price: 35, icon: '🍞' },
  { name: 'Молоко', price: 55, icon: '🥛' },
  { name: 'Сыр', price: 120, icon: '🧀' },
  { name: 'Яйца', price: 70, icon: '🥚' },
  { name: 'Мёд', price: 150, icon: '🍯' },
  { name: 'Печенье', price: 45, icon: '🍪' },
  { name: 'Шоколадка', price: 65, icon: '🍫' },
  { name: 'Мороженое', price: 50, icon: '🍦' },
  { name: 'Пирожное', price: 80, icon: '🧁' },
  { name: 'Пицца', price: 250, icon: '🍕' },
  { name: 'Сок', price: 60, icon: '🧃' },
  { name: 'Газировка', price: 45, icon: '🥤' },
  { name: 'Чай', price: 90, icon: '🍵' },
  { name: 'Игрушечная машинка', price: 200, icon: '🚗' },
  { name: 'Мяч', price: 180, icon: '⚽' },
  { name: 'Воздушный шарик', price: 30, icon: '🎈' },
  { name: 'Плюшевый мишка', price: 350, icon: '🧸' },
  { name: 'Книжка', price: 220, icon: '📖' },
  { name: 'Карандаши', price: 90, icon: '✏️' },
  { name: 'Тетрадь', price: 25, icon: '📓' },
  { name: 'Наклейки', price: 40, icon: '⭐' },
  { name: 'Зубная щётка', price: 75, icon: '🪥' },
  { name: 'Мыло', price: 35, icon: '🧼' },
];

const SHOP_MONEY = [
  { value: 1, type: 'coin' },
  { value: 2, type: 'coin' },
  { value: 5, type: 'coin' },
  { value: 10, type: 'coin' },
  { value: 50, type: 'bill' },
  { value: 100, type: 'bill' },
  { value: 200, type: 'bill' },
  { value: 500, type: 'bill' },
  { value: 1000, type: 'bill' },
];
