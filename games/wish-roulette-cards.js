// games/wish-roulette-cards.js — Сборка банка заданий для «Рулетки желаний».
// Источник — колода фантов cards/cards_fants.js (CARDS): уровни 3..6 → уровни 1..4 рулетки.
// Цвет сектора колеса определяет ИСПОЛНИТЕЛЯ задания:
//   ⚫ чёрный (18 секторов) — выполняет МУЖЧИНА  → карточки с for:'M';
//   🔴 красный (18 секторов) — выполняет ЖЕНЩИНА → карточки с for:'F';
//   🟢 зеро (сектор 0) — ОБЩЕЕ задание для пары  → нейтральная карточка (без for),
//      а если в уровне нейтральных нет — действие из пула уровня.
// Приоритет — действия (dare); если действий с нужным исполнителем меньше 18,
// пул добирается вопросами (truth) того же уровня и того же исполнителя.
// Результат:
//   window.WISH_ROULETTE_CARDS          — плоский массив всех карточек;
//   window.WISH_ROULETTE_CARDS_BY_LEVEL — разложение по уровням 1..4.
// Карточка: { level, type:'dare'|'truth', text, number:0..36, who:'M'|'F'|'both' }

(function(){
  const fants = (typeof CARDS !== 'undefined' && Array.isArray(CARDS)) ? CARDS : [];

  // Уровень рулетки → уровень фантов
  const FANTS_LEVEL = { 1: 3, 2: 4, 3: 5, 4: 6 };

  // Красные номера колеса — как в games/wish-roulette.js (18 шт.)
  const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

  // Пулы уровня: M/F — по полу (действия + добор вопросами), нейтральные — для зеро
  function buildPools(fantsLevel){
    const lv = fants.filter(function(c){ return c.level === fantsLevel && c.text; });
    const by = function(type, forWho){
      return lv.filter(function(c){
        return c.type === type && (forWho === null ? !c.for : c.for === forWho);
      });
    };
    return {
      queueM:    by('dare','M').concat(by('truth','M')),
      queueF:    by('dare','F').concat(by('truth','F')),
      neutral:   by('dare',null).concat(by('truth',null)),
      spareDare: by('dare','M').concat(by('dare','F')) // источник зеро, если нейтральных нет
    };
  }

  // Очередь с пропуском уже использованных; когда свободных нет — идём по кругу
  function makeTaker(queue, used){
    const original = queue.slice();
    let idx = 0;
    return function(){
      for (let guard = 0; guard < original.length; guard++) {
        const c = original[idx % original.length];
        idx++;
        if (!used.has(c)) { used.add(c); return c; }
      }
      const c = original[idx % original.length];
      idx++;
      return c;
    };
  }

  const all = [];
  const byLevel = {};
  [1, 2, 3, 4].forEach(function(wrLevel){
    const pools = buildPools(FANTS_LEVEL[wrLevel]);
    const used = new Set();

    // 🟢 зеро — общее задание: нейтральная карточка, иначе действие из уровня
    const zeroCard = pools.neutral[0] || pools.spareDare[pools.spareDare.length - 1] || null;
    if (zeroCard) used.add(zeroCard);

    const takerM = makeTaker(pools.queueM, used);
    const takerF = makeTaker(pools.queueF, used);

    const out = [];
    for (let n = 0; n < 37; n++) {
      const who = (n === 0) ? 'both' : (RED.has(n) ? 'F' : 'M');
      const src = (who === 'both') ? (zeroCard || { type: 'dare', text: 'Общее задание: поцелуйтесь и обнимитесь одну минуту.' })
                : (who === 'M') ? takerM()
                : takerF();
      out.push({ level: wrLevel, type: src.type, text: src.text, number: n, who: who });
    }
    byLevel[wrLevel] = out;
    all.push.apply(all, out);
  });

  window.WISH_ROULETTE_CARDS = all;
  window.WISH_ROULETTE_CARDS_BY_LEVEL = byLevel;
})();