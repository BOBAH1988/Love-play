// cards/wish-roulette-cards.js — Сборка банка заданий для «Рулетки желаний».
// Источники данных:
//   - Уровни 1..4: колода фантов cards/cards_fants.js (CARDS): уровни 3..6 → уровни 1..4 рулетки.
//   - Уровень 5 (Камасутра): позы из cards/cards_kamasutra_positions.js (KAMASUTRA_POSITIONS_CARDS).
//       Все 37 карточек берутся из общего пула случайно, без разделения по рейтингам.
//       Исполнитель определяется только цветом колеса: красное → женщина, чёрное → мужчина, зеро → оба
//   - Уровень 6 (Желания): желания из cards/cards_desires_women.js и cards/cards_desires_men.js.
//       Красные → Желания женщин, Чёрные и Зеро → Желания мужчин (без дубликатов текста)
// Цвет сектора колеса определяет ИСПОЛНИТЕЛЯ задания:
//   ⚫ чёрный (18 секторов) — выполняет МУЖЧИНА  → карточки для мужчины;
//   🔴 красный (18 секторов) — выполняет ЖЕНЩИНА → карточки для женщины;
//   🟢 зеро (сектор 0) — ОБЩЕЕ задание для пары  → нейтральная карточка.
// Используются ТОЛЬКО действия (type:'dare'). Карточки с вопросом (type:'truth')
//   не участвуют в формировании банка.
// Результат:
//   window.WISH_ROULETTE_CARDS          — плоский массив всех карточек;
//   window.WISH_ROULETTE_CARDS_BY_LEVEL — разложение по уровням 1..6.
// Карточка: { level, type:'dare', text, title?, number:0..36, who:'M'|'F'|'both' }

(function(){
  const fants = (typeof CARDS !== 'undefined' && Array.isArray(CARDS)) ? CARDS : [];
  const kamasutra = (typeof KAMASUTRA_POSITIONS_CARDS !== 'undefined' && Array.isArray(KAMASUTRA_POSITIONS_CARDS)) ? KAMASUTRA_POSITIONS_CARDS : [];
  const desiresWomen = (typeof DESIRES_WOMEN_CARDS !== 'undefined' && Array.isArray(DESIRES_WOMEN_CARDS)) ? DESIRES_WOMEN_CARDS : [];
  const desiresMen = (typeof DESIRES_MEN_CARDS !== 'undefined' && Array.isArray(DESIRES_MEN_CARDS)) ? DESIRES_MEN_CARDS : [];

  // Уровень рулетки → уровень фантов
  const FANTS_LEVEL = { 1: 3, 2: 4, 3: 5, 4: 6 };

  // Красные номера колеса — как в games/wish-roulette.js (18 шт.)
  const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

  // 🛡️ Дефолтные карточки — фallback если пулы фантов пустые
  const FALLBACK = {
    M: [
      { type: 'dare', text: 'Нежно проведи пальцами по волосам партнёрши и скажи, что чувствуешь.' },
      { type: 'dare', text: 'Обними партнёршу сзади и прошепчи что-нибудь нежное на ухо.' },
      { type: 'dare', text: 'Поцелуй партнёршу в шею, пока она не скажет тебе «стоп».' },
      { type: 'dare', text: 'Сядь рядом с партнёршей и положи её голову себе на плечо на 2 минуты.' },
      { type: 'dare', text: 'Возьми партнёршу за руку и смотри ей в глаза 30 секунд.' },
      { type: 'dare', text: 'Сделай партнёрше массаж плеч в течение 2 минут.' },
      { type: 'dare', text: 'Тронь партнёршу за щёку и нежно проведи пальцем по её губам.' },
      { type: 'dare', text: 'Встань позади партнёрши и обними её крепко 30 секунд.' },
      { type: 'dare', text: 'Поцелуй партнёршу в макушку и скажи, что она тебе нравится.' },
      { type: 'dare', text: 'Проведи ладонью по спине партнёрши и остановись, когда она захочет большего.' },
      { type: 'dare', text: 'Нежно поцелуй партнёршу в уголок губ и остановись.' },
      { type: 'dare', text: 'Обними партнёршу за талию и притяни к себе на 30 секунд.' },
      { type: 'dare', text: 'Сделай партнёрше массаж ладони и пальцев 1 мин.' },
      { type: 'dare', text: 'Проведи пальцами по волосам партнёрши и опиши свои ощущения.' },
      { type: 'dare', text: 'Включи медленную музыку и потанцуй вместе с партнёршей, прижавшись крепко.' },
      { type: 'dare', text: 'Сядь рядом, закрой глаза и угадывай, к какой части тела прикасается партнёрша.' },
      { type: 'dare', text: 'Нежно погладь партнёршу по коленке и остановись, когда она улыбнётся.' },
      { type: 'dare', text: 'Обними партнёршу крепко-крепко и не отпускай 15 секунд.' }
    ],
    F: [
      { type: 'dare', text: 'Сядь партнёру на колени и обними его за шею.' },
      { type: 'dare', text: 'Проведи пальцами по груди партнёра и опиши, что чувствуешь.' },
      { type: 'dare', text: 'Поцелуй партнёра в шею так, чтобы он это почувовал.' },
      { type: 'dare', text: 'Возьми партнёра за руки и смотри ему в глаза 30 секунд.' },
      { type: 'dare', text: 'Встань позади партнёра и обними его за грудь.' },
      { type: 'dare', text: 'Потрогай партнёра за ухом и нежно проведи пальцами по его шее.' },
      { type: 'dare', text: 'Сделай партнёру массаж плеч в течение 2 минут.' },
      { type: 'dare', text: 'Тронь партнёра за щёку и нежно проведи пальцем по его губам.' },
      { type: 'dare', text: 'Встань на колени перед партнёром и обними его за талию.' },
      { type: 'dare', text: 'Поцелуй партнёра в макушку и скажи, что он тебе нравится.' },
      { type: 'dare', text: 'Проведи ладонью по спине партнёра медленно и останавливайся.' },
      { type: 'dare', text: 'Нежно поцелуй партнёра в уголок губ и остановись.' },
      { type: 'dare', text: 'Обними партнёра за талию и прижмись к нему на 30 секунд.' },
      { type: 'dare', text: 'Сделай партнёру массаж ладони и пальцев 1 мин.' },
      { type: 'dare', text: 'Проведи пальцами по волосам партнёра и опиши свои ощущения.' },
      { type: 'dare', text: 'Включи медленную музыку и потанцуй вместе с партнёром, прижавшись крепко.' },
      { type: 'dare', text: 'Сядь рядом, закрой глаза и угадывай, к какой части тела прикасается партнёр.' },
      { type: 'dare', text: 'Нежно погладь партнёра по коленке и остановись, когда он улыбнётся.' }
    ]
  };

  // Генератор: берёт случайную карточку из очереди, избегая повторов пока есть новые
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

  // Сборка уровней 1..4 из фантов
  function buildPools(fantsLevel){
    const all = fants.filter(function(c){ return c.type === 'dare' && c.level === fantsLevel; });
    const M = all.filter(function(c){ return c.for === 'M'; });
    const F = all.filter(function(c){ return c.for === 'F'; });
    const neutral = all.filter(function(c){ return !c.for; });
    const spareDare = all.filter(function(c){ return c.type === 'dare'; });
    return { queueM: M, queueF: F, neutral: neutral, spareDare: spareDare };
  }

  const byLevel = {};
  const all = [];

  // Уровень 5 (Камасутра): позы из KAMASUTRA_POSITIONS_CARDS
  // Все 37 карточек берутся из общего пула случайно, без разделения по рейтингам.
  // Исполнитель определяется только цветом колеса: красное → женщина, чёрное → мужчина, зеро → оба
  function buildKamasutraCards(){
    const pool = kamasutra.length > 0 ? kamasutra : [{text: 'Поза лотоса', title: 'Поза лотоса'}];
    const used = new Set();
    const taker = makeTaker(pool, used);

    const out = [];
    for (let n = 0; n < 37; n++) {
      const who = (n === 0) ? 'both' : (RED.has(n) ? 'F' : 'M');
      const src = taker();
      const card = { level: 5, type: 'dare', text: src.text, number: n, who: who };
      if (src.title) card.title = src.title;
      out.push(card);
    }
    return out;
  }

  // Уровень 6 (Желания): желания из DESIRES_WOMEN_CARDS и DESIRES_MEN_CARDS
  // Красные → Желания женщин, Чёрные и Зеро → Желания мужчин (без дубликатов текста)
  function buildDesiresCards(){
    const womenTexts = new Set(desiresWomen.map(function(c){ return c.text; }));
    const menFiltered = desiresMen.filter(function(c){ return !womenTexts.has(c.text); });
    const menPool = menFiltered.length > 0 ? menFiltered : desiresMen;

    const zeroCard = menPool.length > 0 ? [...menPool].sort(function(a, b){ return ((b.womenRating||0)+(b.menRating||0)) - ((a.womenRating||0)+(a.menRating||0)); })[0] : {text: 'Партнёрша инициирует первой'};
    const used = new Set();
    if (zeroCard) used.add(zeroCard);

    const takerWomen = makeTaker(desiresWomen.length > 0 ? desiresWomen : [{text: 'Романтический вечер'}], new Set());
    const takerMen = makeTaker(menPool.length > 0 ? menPool : [{text: 'Партнёрша инициирует первой'}], used);

    const out = [];
    for (let n = 0; n < 37; n++) {
      const who = (n === 0) ? 'both' : (RED.has(n) ? 'F' : 'M');
      let src;
      if (who === 'both') {
        src = zeroCard;
      } else if (who === 'F') {
        src = takerWomen();
      } else {
        src = takerMen();
      }
      const card = { level: 6, type: 'dare', text: src.text, number: n, who: who };
      if (src.title) card.title = src.title;
      out.push(card);
    }
    return out;
  }

  [1, 2, 3, 4].forEach(function(wrLevel){
    const pools = buildPools(FANTS_LEVEL[wrLevel]);
    const used = new Set();

    // 🛡️ Fallback: если пулы пустые — используем дефолтные карточки
    const queueM = pools.queueM.length > 0 ? pools.queueM : FALLBACK.M.slice();
    const queueF = pools.queueF.length > 0 ? pools.queueF : FALLBACK.F.slice();

    // 🟢 зеро — общее задание: нейтральное действие, иначе действие из уровня
    const zeroCard = pools.neutral[0] || pools.spareDare[pools.spareDare.length - 1] || null;
    if (zeroCard) used.add(zeroCard);

    const takerM = makeTaker(queueM, used);
    const takerF = makeTaker(queueF, used);

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

  // Уровень 5 — Камасутра
  const kamasutraCards = buildKamasutraCards();
  byLevel[5] = kamasutraCards;
  all.push.apply(all, kamasutraCards);

  // Уровень 6 — Желания
  const desiresCards = buildDesiresCards();
  byLevel[6] = desiresCards;
  all.push.apply(all, desiresCards);

  window.WISH_ROULETTE_CARDS = all;
  window.WISH_ROULETTE_CARDS_BY_LEVEL = byLevel;
})();
