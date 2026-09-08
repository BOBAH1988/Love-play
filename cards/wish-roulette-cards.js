// cards/wish-roulette-cards.js — Карточки заданий для «Рулетки желаний»
// 4 уровня, по 37 заданий в каждом (всего 148 заданий):
// - Уровень 1 (Сближение) ↔ Фанты уровень 3
// - Уровень 2 (Разогрев) ↔ Фанты уровень 4  
// - Уровень 3 (Откровенно 18+) ↔ Фанты уровень 5
// - Уровень 4 (Фантазии) ↔ Фанты уровень 6
// Каждое задание соответствует номеру от 0 до 36 в рулетке

(function(){
  const fantsCards = (typeof CARDS !== 'undefined' && Array.isArray(CARDS)) ? CARDS : [];
  
  // Берем только нужные уровни из Fantы
  const fantsLevel3 = fantsCards.filter(c => c.level === 3); // Сближение (Уровень 1)
  const fantsLevel4 = fantsCards.filter(c => c.level === 4); // Разогрев (Уровень 2)
  const fantsLevel5 = fantsCards.filter(c => c.level === 5); // Откровенно 18+ (Уровень 3)
  const fantsLevel6 = fantsCards.filter(c => c.level === 6); // Фантазии (Уровень 4)

  if(fantsLevel3.length === 0 || fantsLevel4.length === 0 || fantsLevel5.length === 0 || fantsLevel6.length === 0) {
    window.WISH_ROULETTE_CARDS = [];
    return;
  }

  // Функция для создания 37 карт из исходного массива
  function createLevelCards(sourceCards, targetLevel, levelName) {
    const result = [];
    const sourceCount = sourceCards.length;

    for(let i = 0; i < 37; i++) {
      const sourceIndex = i % sourceCount;
      const sourceCard = sourceCards[sourceIndex];

      let mappedText = sourceCard.text;
      let mappedType = sourceCard.type;

      if(sourceCard.for) {
        mappedText = sourceCard.text;
        mappedType = sourceCard.type;
      }

      result.push({
        level: targetLevel,      // 1, 2, 3 или 4 (номер в рулетке)
        type: mappedType,
        text: mappedText,
        number: i,              // Номер в рулетке (0-36)
        originalName: sourceCard.text.split(' ')[0], // Первое слово в тексте
        originalLevel: sourceCard.level // Уровень в Fantы
      });
    }

    return result;
  }

  // Создаем 4 уровня по 37 карточек в каждом
  const levelCards = {
    level1: createLevelCards(fantsLevel3, 1, 'Сближение'),      // 37 карт уровня 1
    level2: createLevelCards(fantsLevel4, 2, 'Разогрев'),      // 37 карт уровня 2
    level3: createLevelCards(fantsLevel5, 3, 'Откровенно 18+'), // 37 карт уровня 3
    level4: createLevelCards(fantsLevel6, 4, 'Фантазии'),       // 37 карт уровня 4
  };

  // Объединяем все уровни в единый массив для игры
  const WISH_ROULETTE_CARDS = [
    ...levelCards.level1,
    ...levelCards.level2,
    ...levelCards.level3,
    ...levelCards.level4
  ];

  // Дополнительная структура для быстрого доступа по уровням
  const WISH_ROULETTE_CARDS_BY_LEVEL = {
    1: levelCards.level1,
    2: levelCards.level2,
    3: levelCards.level3,
    4: levelCards.level4,
  };

  // Сортируем по номеру в рулетке
  const sortedCards = WISH_ROULETTE_CARDS.sort((a, b) => a.number - b.number);

  window.WISH_ROULETTE_CARDS = sortedCards;
  window.WISH_ROULETTE_CARDS_BY_LEVEL = WISH_ROULETTE_CARDS_BY_LEVEL;
})();