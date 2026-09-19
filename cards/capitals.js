// cards/capitals.js — данные для игры «Столицы» (games/capitals.js).
// CAPITALS_LEVELS — 3 уровня сложности (id, name, desc, icon).
// CAPITALS_CARDS — { level, country, flag: путь к SVG-флагу, a: [столица, ...3 неверных] },
// по 10 вопросов на каждый уровень.
// Структура карточки как у Флагов: a[0] — правильный ответ (столица),
// a[1..3] — дистрактеры (города того же региона или других стран).

const CAPITALS_LEVELS = [
  { id: 1, icon: '🟢', name: 'Лёгкий', desc: '10 стран с известными столицами' },
  { id: 2, icon: '🟡', name: 'Средний', desc: 'Ещё 10 стран — узнайте столицу' },
  { id: 3, icon: '🔴', name: 'Трудный', desc: 'Последние 10 стран — сложные столицы' },
];

const CAPITALS_CARDS = [
  // ---------- Уровень 1 ----------
  { level: 1, country: 'Россия', flag: 'flags-svg/flag-ru.svg', a: ['Москва', 'Санкт-Петербург', 'Казань', 'Екатеринбург'] },
  { level: 1, country: 'Франция', flag: 'flags-svg/flag-fr.svg', a: ['Париж', 'Марсель', 'Лион', 'Тулуза'] },
  { level: 1, country: 'Германия', flag: 'flags-svg/flag-de.svg', a: ['Берлин', 'Мюнхен', 'Гамбург', 'Кёльн'] },
  { level: 1, country: 'Италия', flag: 'flags-svg/flag-it.svg', a: ['Рим', 'Милан', 'Неаполь', 'Турин'] },
  { level: 1, country: 'Испания', flag: 'flags-svg/flag-es.svg', a: ['Мадрид', 'Барселона', 'Валенсия', 'Севилья'] },
  { level: 1, country: 'США', flag: 'flags-svg/flag-us.svg', a: ['Вашингтон', 'Нью-Йорк', 'Лос-Анджелес', 'Чикаго'] },
  { level: 1, country: 'Япония', flag: 'flags-svg/flag-jp.svg', a: ['Токио', 'Осака', 'Нагоя', 'Саппоро'] },
  { level: 1, country: 'Китай', flag: 'flags-svg/flag-cn.svg', a: ['Пекин', 'Шанхай', 'Гуанчжоу', 'Чэнду'] },
  { level: 1, country: 'Корея', flag: 'flags-svg/flag-kr.svg', a: ['Сеул', 'Пусан', 'Инчхон', 'Дэкью'] },
  { level: 1, country: 'Великобритания', flag: 'flags-svg/flag-gb.svg', a: ['Лондон', 'Бирмингем', 'Ливерпуль', 'Ледс'] },
  // ---------- Уровень 2 ----------
  { level: 2, country: 'Австралия', flag: 'flags-svg/flag-au.svg', a: ['Канберра', 'Сидней', 'Мельбурн', 'Брисбен'] },
  { level: 2, country: 'Канада', flag: 'flags-svg/flag-ca.svg', a: ['Оттава', 'Торонто', 'Ванкувер', 'Калгария'] },
  { level: 2, country: 'Бразилия', flag: 'flags-svg/flag-br.svg', a: ['Бразилиа', 'Рио-де-Жанейро', 'Сан-Паулу', 'Сальвадор'] },
  { level: 2, country: 'Индия', flag: 'flags-svg/flag-in.svg', a: ['Нью-Дели', 'Мумбаи', 'Бангалор', 'Хайдарабад'] },
  { level: 2, country: 'Мексика', flag: 'flags-svg/flag-mx.svg', a: ['Мехико', 'Гвадалахара', 'Монтеррей', 'Пума'] },
  { level: 2, country: 'Польша', flag: 'flags-svg/flag-pl.svg', a: ['Варшава', 'Краков', 'Вроцлав', 'Гданьск'] },
  { level: 2, country: 'Нидерланды', flag: 'flags-svg/flag-nl.svg', a: ['Амстердам', 'Роттердам', 'Гаага', 'Утрехт'] },
  { level: 2, country: 'Бельгия', flag: 'flags-svg/flag-be.svg', a: ['Брюссель', 'Антверпия', 'Гент', 'Льеж'] },
  { level: 2, country: 'Швеция', flag: 'flags-svg/flag-se.svg', a: ['Стокгольм', 'Гётеборг', 'Мальмё', 'Уппсала'] },
  { level: 2, country: 'Норвегия', flag: 'flags-svg/flag-no.svg', a: ['Осло', 'Берген', 'Тромсьо', 'Ставхель'] },
  // ---------- Уровень 3 ----------
  { level: 3, country: 'Казахстан', flag: 'flags-svg/flag-kz.svg', a: ['Астана', 'Алматы', 'Шымкент', 'Караганда'] },
  { level: 3, country: 'Армения', flag: 'flags-svg/flag-am.svg', a: ['Ереван', 'Гюмри', 'Дилижан', 'Севан'] },
  { level: 3, country: 'Грузия', flag: 'flags-svg/flag-ge.svg', a: ['Тбилиси', 'Батуми', 'Кутаиси', 'Рустави'] },
  { level: 3, country: 'Узбекистан', flag: 'flags-svg/flag-uz.svg', a: ['Ташкент', 'Самарканд', 'Бухара', 'Хива'] },
  { level: 3, country: 'Киргизия', flag: 'flags-svg/flag-kg.svg', a: ['Бишкек', 'Ош', 'Джалал-Абад', 'Иссык-Куль'] },
  { level: 3, country: 'Таджикистан', flag: 'flags-svg/flag-tj.svg', a: ['Душанбе', 'Худжанд', 'Куляб', 'Бадкен'] },
  { level: 3, country: 'Лихтенштейн', flag: 'flags-svg/flag-li.svg', a: ['Вадуц', 'Шаан', 'Валац', 'Мальц'] },
  { level: 3, country: 'Сан-Марино', flag: 'flags-svg/flag-sm.svg', a: ['Сан-Марино', 'Серравале', 'Меринато', 'Борж'] },
  { level: 3, country: 'Монако', flag: 'flags-svg/flag-mc.svg', a: ['Монако', 'Ла-Консетиль', 'Монте-Карло', 'Никс-с-Бодони'] },
  { level: 3, country: 'Сан-Томе', flag: 'flags-svg/flag-st.svg', a: ['Сан-Томе', 'Пратос-ду-Сол', 'Мехета', 'Новобене'] },
];
