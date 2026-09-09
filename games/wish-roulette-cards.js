// games/wish-roulette-cards.js — Сборка банка заданий для «Рулетки желаний».
// Источник — отдельная колода cards/cards_wish_roulette.js (WISH_ROULETTE_DECK):
// 4 уровня по 37 карточек-действий (type:'dare'), каждая привязывается к номеру
// сектора колеса number: 0..36 (37 секторов, как у настоящей рулетки).
// Результат:
//   window.WISH_ROULETTE_CARDS          — плоский массив всех карточек;
//   window.WISH_ROULETTE_CARDS_BY_LEVEL — разложение по уровням 1..4.

(function(){
  const deck = (typeof WISH_ROULETTE_DECK !== 'undefined' && Array.isArray(WISH_ROULETTE_DECK)) ? WISH_ROULETTE_DECK : [];

  // Группируем колоду по уровням 1..4 (только карточки-действия с текстом)
  const sourceByLevel = { 1: [], 2: [], 3: [], 4: [] };
  deck.forEach(function(c){
    if (sourceByLevel[c.level] && c.text) {
      sourceByLevel[c.level].push({ type: c.type || 'dare', text: c.text });
    }
  });

  // На каждый уровень ровно 37 секторов: если карточек меньше — повторяем
  // по кругу, если больше — берём первые 37.
  const all = [];
  const byLevel = {};
  [1, 2, 3, 4].forEach(function(level){
    const src = sourceByLevel[level];
    const out = [];
    for (let i = 0; i < 37; i++) {
      const srcCard = src.length ? src[i % src.length] : { type: 'dare', text: 'Задание не найдено' };
      out.push({ level: level, type: srcCard.type, text: srcCard.text, number: i });
    }
    byLevel[level] = out;
    all.push.apply(all, out);
  });

  window.WISH_ROULETTE_CARDS = all;
  window.WISH_ROULETTE_CARDS_BY_LEVEL = byLevel;
})();