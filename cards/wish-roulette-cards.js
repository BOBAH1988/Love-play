// cards/wish-roulette-cards.js — Сборка банка заданий для «Рулетки желаний».
// Источник — колода фантов cards/cards_fants.js (CARDS): уровни 3..6 → уровни 1..4 рулетки.
// Цвет сектора колеса определяет ИСПОЛНИТЕЛЯ задания:
//   ⚫ чёрный (18 секторов) — выполняет МУЖЧИНА  → карточки с for:'M';
//   🔴 красный (18 секторов) — выполняет ЖЕНЩИНА → карточки с for:'F';
//   🟢 зеро (сектор 0) — ОБЩЕЕ задание для пары  → нейтральная карточка (без for),
//      а если в уровне нейтральных нет — действие из пула уровня.
// Используются ТОЛЬКО действия (type:'dare'). Карточки с вопросом (type:'truth')
//   не участвуют в формировании банка.
// Результат:
//   window.WISH_ROULETTE_CARDS          — плоский массив всех карточек;
//   window.WISH_ROULETTE_CARDS_BY_LEVEL — разложение по уровням 1..4.
// Карточка: { level, type:'dare', text, number:0..36, who:'M'|'F'|'both' }

(function(){
  const fants = (typeof CARDS !== 'undefined' && Array.isArray(CARDS)) ? CARDS : [];

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
      { type: 'dare', text: 'Позволь партнёрше сделать тебе короткую ласку, а потом попроси её повторить, но ещё медленнее.' },
      { type: 'dare', text: 'Произнеси 3 предложения, начинающихся со слов: «Я хочу тебя потому, что...».' }
    ],
    F: [
      { type: 'dare', text: 'Нежно проведи пальцами по волосам партнёра и скажи, что чувствуешь.' },
      { type: 'dare', text: 'Обними партнёра сзади и прошепчи что-нибудь нежное на ухо.' },
      { type: 'dare', text: 'Поцелуй партнёра в шею, пока он не скажет тебе «стоп».' },
      { type: 'dare', text: 'Сядь рядом с партнёром и положи голову ему на плечо на 2 минуты.' },
      { type: 'dare', text: 'Возьми партнёра за руку и смотри ему в глаза 30 секунд.' },
      { type: 'dare', text: 'Сделай партнёру массаж плеч в течение 2 минут.' },
      { type: 'dare', text: 'Тронь партнёра за щёку и нежно проведи пальцем по его губам.' },
      { type: 'dare', text: 'Встань позади партнёра и обними его крепко 30 секунд.' },
      { type: 'dare', text: 'Поцелуй партнёра в макушку и скажи, что он тебе нравится.' },
      { type: 'dare', text: 'Проведи ладонью по груди партнёра и остановись, когда он захочет большего.' },
      { type: 'dare', text: 'Нежно поцелуй партнёра в уголок губ и остановись.' },
      { type: 'dare', text: 'Обними партнёра за талию и притяни к себе на 30 секунд.' },
      { type: 'dare', text: 'Сделай партнёру массаж ладони и пальцев 1 мин.' },
      { type: 'dare', text: 'Проведи пальцами по волосам партнёра и опиши свои ощущения.' },
      { type: 'dare', text: 'Включи медленную музыку и потанцуй вместе с партнёром, прижавшись крепко.' },
      { type: 'dare', text: 'Сядь рядом, закрой глаза и угадывай, к какой части тела прикасается партнёр.' },
      { type: 'dare', text: 'Позволь партнёру сделать тебе короткую ласку, а потом попроси его повторить, но ещё медленнее.' },
      { type: 'dare', text: 'Произнеси 3 предложения, начинающихся со слов: «Я хочу тебя потому, что...».' }
    ]
  };

  // Пулы уровня: только действия (dare). Мужские, женские и нейтральные.
  function buildPools(fantsLevel){
    const lv = fants.filter(function(c){
      return c.level === fantsLevel && c.text && c.type === 'dare';
    });
    const by = function(forWho){
      return lv.filter(function(c){
        return forWho === null ? !c.for : c.for === forWho;
      });
    };
    return {
      queueM:  by('M'),
      queueF:  by('F'),
      neutral: by(null),
      spareDare: by('M').concat(by('F')) // источник зеро, если нейтральных действий нет
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

  window.WISH_ROULETTE_CARDS = all;
  window.WISH_ROULETTE_CARDS_BY_LEVEL = byLevel;
})();