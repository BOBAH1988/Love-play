// cards/capitals.js — данные для игры «Столицы» (games/capitals.js).
// CAPITALS_LEVELS — 3 уровня сложности (id, name, desc, icon).
// CAPITALS_CARDS — { level, country, flag: путь к SVG-флагу, a: [столица, ...3 неверных] },
// все 43 флага из flags-svg/ распределены по уровням: 15 (лёгкий) / 14 (средний) / 14 (трудный).
// Структура карточки как у Флагов: a[0] — правильный ответ (столица),
// a[1..3] — дистрактеры (города той же страны или соседних стран).

const CAPITALS_LEVELS = [
  { id: 1, icon: '🟢', name: 'Лёгкий', desc: '15 стран с известными столицами' },
  { id: 2, icon: '🟡', name: 'Средний', desc: 'Ещё 14 стран — узнайте столицу' },
  { id: 3, icon: '🔴', name: 'Трудный', desc: 'Последние 14 стран — сложные столицы' },
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
  { level: 1, country: 'Корея', flag: 'flags-svg/flag-kr.svg', a: ['Сеул', 'Пусан', 'Инчхон', 'Тэгу'] },
  { level: 1, country: 'Великобритания', flag: 'flags-svg/flag-gb.svg', a: ['Лондон', 'Бирмингем', 'Ливерпуль', 'Лидс'] },
  { level: 1, country: 'Канада', flag: 'flags-svg/flag-ca.svg', a: ['Оттава', 'Торонто', 'Ванкувер', 'Калгари'] },
  { level: 1, country: 'Австралия', flag: 'flags-svg/flag-au.svg', a: ['Канберра', 'Сидней', 'Мельбурн', 'Брисбен'] },
  { level: 1, country: 'Бразилия', flag: 'flags-svg/flag-br.svg', a: ['Бразилиа', 'Рио-де-Жанейро', 'Сан-Паулу', 'Сальвадор'] },
  { level: 1, country: 'Мексика', flag: 'flags-svg/flag-mx.svg', a: ['Мехико', 'Гвадалахара', 'Монтеррей', 'Пуэбла'] },
  { level: 1, country: 'Индия', flag: 'flags-svg/flag-in.svg', a: ['Нью-Дели', 'Мумбаи', 'Бангалор', 'Хайдарабад'] },
  // ---------- Уровень 2 ----------
  { level: 2, country: 'Польша', flag: 'flags-svg/flag-pl.svg', a: ['Варшава', 'Краков', 'Вроцлав', 'Гданьск'] },
  { level: 2, country: 'Нидерланды', flag: 'flags-svg/flag-nl.svg', a: ['Амстердам', 'Роттердам', 'Гаага', 'Утрехт'] },
  { level: 2, country: 'Бельгия', flag: 'flags-svg/flag-be.svg', a: ['Брюссель', 'Антверпен', 'Гент', 'Льеж'] },
  { level: 2, country: 'Швеция', flag: 'flags-svg/flag-se.svg', a: ['Стокгольм', 'Гётеборг', 'Мальмё', 'Уппсала'] },
  { level: 2, country: 'Норвегия', flag: 'flags-svg/flag-no.svg', a: ['Осло', 'Берген', 'Тромсё', 'Ставангер'] },
  { level: 2, country: 'Финляндия', flag: 'flags-svg/flag-fi.svg', a: ['Хельсинки', 'Эспоо', 'Тампере', 'Турку'] },
  { level: 2, country: 'Ирландия', flag: 'flags-svg/flag-ie.svg', a: ['Дублин', 'Корк', 'Голуэй', 'Лимерик'] },
  { level: 2, country: 'Португалия', flag: 'flags-svg/flag-pt.svg', a: ['Лиссабон', 'Порту', 'Брага', 'Фару'] },
  { level: 2, country: 'Азербайджан', flag: 'flags-svg/flag-az.svg', a: ['Баку', 'Гянджа', 'Сумгаит', 'Шеки'] },
  { level: 2, country: 'Перу', flag: 'flags-svg/flag-pe.svg', a: ['Лима', 'Куско', 'Арекипа', 'Трухильо'] },
  { level: 2, country: 'Казахстан', flag: 'flags-svg/flag-kz.svg', a: ['Астана', 'Алматы', 'Шымкент', 'Караганда'] },
  { level: 2, country: 'Армения', flag: 'flags-svg/flag-am.svg', a: ['Ереван', 'Гюмри', 'Ванадзор', 'Севан'] },
  { level: 2, country: 'Грузия', flag: 'flags-svg/flag-ge.svg', a: ['Тбилиси', 'Батуми', 'Кутаиси', 'Рустави'] },
  { level: 2, country: 'Узбекистан', flag: 'flags-svg/flag-uz.svg', a: ['Ташкент', 'Самарканд', 'Бухара', 'Хива'] },
  // ---------- Уровень 3 ----------
  { level: 3, country: 'Киргизия', flag: 'flags-svg/flag-kg.svg', a: ['Бишкек', 'Ош', 'Джалал-Абад', 'Каракол'] },
  { level: 3, country: 'Таджикистан', flag: 'flags-svg/flag-tj.svg', a: ['Душанбе', 'Худжанд', 'Куляб', 'Бохтар'] },
  { level: 3, country: 'Лихтенштейн', flag: 'flags-svg/flag-li.svg', a: ['Вадуц', 'Шаан', 'Бальцерс', 'Эшен'] },
  { level: 3, country: 'Сан-Марино', flag: 'flags-svg/flag-sm.svg', a: ['Сан-Марино', 'Серравалле', 'Борго-Маджоре', 'Фаэтано'] },
  { level: 3, country: 'Монако', flag: 'flags-svg/flag-mc.svg', a: ['Монако', 'Монте-Карло', 'Ла-Кондамин', 'Фонвьей'] },
  { level: 3, country: 'Сан-Томе', flag: 'flags-svg/flag-st.svg', a: ['Сан-Томе', 'Триндади', 'Невис', 'Гуадалупе'] },
  { level: 3, country: 'Кувейт', flag: 'flags-svg/flag-kw.svg', a: ['Кувейт', 'Эль-Ахмади', 'Эль-Джахра', 'Хавалли'] },
  { level: 3, country: 'Сирия', flag: 'flags-svg/flag-sy.svg', a: ['Дамаск', 'Алеппо', 'Хомс', 'Латакия'] },
  { level: 3, country: 'Мьянма', flag: 'flags-svg/flag-mm.svg', a: ['Нейпьидо', 'Янгон', 'Мандалай', 'Баган'] },
  { level: 3, country: 'ЦАР', flag: 'flags-svg/flag-cf.svg', a: ['Банги', 'Бимбо', 'Берберати', 'Бангассу'] },
  { level: 3, country: 'Нигер', flag: 'flags-svg/flag-ne.svg', a: ['Ниамей', 'Зиндер', 'Маради', 'Агадес'] },
  { level: 3, country: 'Чад', flag: 'flags-svg/flag-td.svg', a: ['Нджамена', 'Мунду', 'Абеше', 'Сарх'] },
  { level: 3, country: 'Сьерра-Леоне', flag: 'flags-svg/flag-sl.svg', a: ['Фритаун', 'Бо', 'Кенема', 'Макени'] },
  { level: 3, country: 'Того', flag: 'flags-svg/flag-tg.svg', a: ['Ломе', 'Сокоде', 'Кара', 'Атакпаме'] },
];
