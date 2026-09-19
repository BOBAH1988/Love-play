// cards/flags.js — данные для игры "Флаги" (games/flags.js).
// FLAGS_LEVELS — 3 уровня сложности (id, name, desc, icon).
// FLAGS_CARDS — { level, flag: путь к изображению флага (svg/png), a: [верный, ...3 неверных] },
// все 43 флага из flags-svg/ распределены по уровням: 15 (лёгкий) / 14 (средний) / 14 (трудный).

const FLAGS_LEVELS = [
  { id: 1, icon: '🟢', name: 'Лёгкий', desc: '15 стран с известными флагами' },
  { id: 2, icon: '🟡', name: 'Средний', desc: 'Ещё 14 стран — узнайте флаг' },
  { id: 3, icon: '🔴', name: 'Трудный', desc: 'Последние 14 стран — сложные флаги' },
];

const FLAGS_CARDS = [
  // ---------- Уровень 1 ----------
  { level: 1, flag: 'flags-svg/flag-ru.svg', a: ['Россия', 'Казахстан', 'Украина', 'Беларусь'] },
  { level: 1, flag: 'flags-svg/flag-fr.svg', a: ['Франция', 'Италия', 'Испания', 'Португалия'] },
  { level: 1, flag: 'flags-svg/flag-jp.svg', a: ['Япония', 'Корея', 'Китай', 'Тайвань'] },
  { level: 1, flag: 'flags-svg/flag-us.svg', a: ['США', 'Канада', 'Мексика', 'Бразилия'] },
  { level: 1, flag: 'flags-svg/flag-de.svg', a: ['Германия', 'Австрия', 'Швейцария', 'Нидерланды'] },
  { level: 1, flag: 'flags-svg/flag-gb.svg', a: ['Великобритания', 'Австралия', 'Канада', 'Новая Зеландия'] },
  { level: 1, flag: 'flags-svg/flag-it.svg', a: ['Италия', 'Испания', 'Португалия', 'Греция'] },
  { level: 1, flag: 'flags-svg/flag-cn.svg', a: ['Китай', 'Тайвань', 'Гонконг', 'Макао'] },
  { level: 1, flag: 'flags-svg/flag-kr.svg', a: ['Корея', 'Япония', 'Китай', 'Тайвань'] },
  { level: 1, flag: 'flags-svg/flag-br.svg', a: ['Бразилия', 'Аргентина', 'Колумбия', 'Чили'] },
  { level: 1, flag: 'flags-svg/flag-es.svg', a: ['Испания', 'Португалия', 'Италия', 'Мексика'] },
  { level: 1, flag: 'flags-svg/flag-au.svg', a: ['Австралия', 'Новая Зеландия', 'Великобритания', 'Канада'] },
  { level: 1, flag: 'flags-svg/flag-ca.svg', a: ['Канада', 'США', 'Мексика', 'Перу'] },
  { level: 1, flag: 'flags-svg/flag-mx.svg', a: ['Мексика', 'Гватемала', 'Сальвадор', 'Коста-Рика'] },
  { level: 1, flag: 'flags-svg/flag-in.svg', a: ['Индия', 'Пакистан', 'Бангладеш', 'Шри-Ланка'] },
  // ---------- Уровень 2 ----------
  { level: 2, flag: 'flags-svg/flag-pl.svg', a: ['Польша', 'Германия', 'Чехия', 'Словакия'] },
  { level: 2, flag: 'flags-svg/flag-se.svg', a: ['Швеция', 'Норвегия', 'Дания', 'Финляндия'] },
  { level: 2, flag: 'flags-svg/flag-no.svg', a: ['Норвегия', 'Швеция', 'Дания', 'Финляндия'] },
  { level: 2, flag: 'flags-svg/flag-fi.svg', a: ['Финляндия', 'Швеция', 'Норвегия', 'Дания'] },
  { level: 2, flag: 'flags-svg/flag-nl.svg', a: ['Нидерланды', 'Германия', 'Бельгия', 'Люксембург'] },
  { level: 2, flag: 'flags-svg/flag-be.svg', a: ['Бельгия', 'Нидерланды', 'Германия', 'Люксембург'] },
  { level: 2, flag: 'flags-svg/flag-ie.svg', a: ['Ирландия', 'Великобритания', 'Исландия', 'Мальта'] },
  { level: 2, flag: 'flags-svg/flag-pt.svg', a: ['Португалия', 'Испания', 'Италия', 'Греция'] },
  { level: 2, flag: 'flags-svg/flag-kz.svg', a: ['Казахстан', 'Узбекистан', 'Киргизия', 'Таджикистан'] },
  { level: 2, flag: 'flags-svg/flag-am.svg', a: ['Армения', 'Грузия', 'Азербайджан', 'Россия'] },
  { level: 2, flag: 'flags-svg/flag-ge.svg', a: ['Грузия', 'Армения', 'Азербайджан', 'Турция'] },
  { level: 2, flag: 'flags-svg/flag-uz.svg', a: ['Узбекистан', 'Таджикистан', 'Киргизия', 'Туркмения'] },
  { level: 2, flag: 'flags-svg/flag-az.svg', a: ['Азербайджан', 'Грузия', 'Армения', 'Туркмения'] },
  { level: 2, flag: 'flags-svg/flag-pe.svg', a: ['Перу', 'Боливия', 'Колумбия', 'Эквадор'] },
  // ---------- Уровень 3 ----------
  { level: 3, flag: 'flags-svg/flag-td.svg', a: ['Чад', 'Судан', 'Эфиопия', 'Эритрея'] },
  { level: 3, flag: 'flags-svg/flag-ne.svg', a: ['Нигер', 'Мали', 'Буркина-Фасо', 'Сенегал'] },
  { level: 3, flag: 'flags-svg/flag-kw.svg', a: ['Кувейт', 'Саудовская Аравия', 'ОАЭ', 'Катар'] },
  { level: 3, flag: 'flags-svg/flag-sy.svg', a: ['Сирия', 'Ливан', 'Иордания', 'Ирак'] },
  { level: 3, flag: 'flags-svg/flag-mm.svg', a: ['Мьянма', 'Таиланд', 'Лаос', 'Вьетнам'] },
  { level: 3, flag: 'flags-svg/flag-cf.svg', a: ['ЦАР', 'Демократическая Республика Конго', 'Ангола', 'Замбия'] },
  { level: 3, flag: 'flags-svg/flag-sl.svg', a: ['Сьерра-Леоне', 'Гвинея', 'Либерия', 'Гана'] },
  { level: 3, flag: 'flags-svg/flag-tg.svg', a: ['Того', 'Бенин', 'Нигер', 'Мали'] },
  { level: 3, flag: 'flags-svg/flag-kg.svg', a: ['Киргизия', 'Казахстан', 'Узбекистан', 'Таджикистан'] },
  { level: 3, flag: 'flags-svg/flag-tj.svg', a: ['Таджикистан', 'Иран', 'Киргизия', 'Узбекистан'] },
  { level: 3, flag: 'flags-svg/flag-li.svg', a: ['Лихтенштейн', 'Австрия', 'Швейцария', 'Люксембург'] },
  { level: 3, flag: 'flags-svg/flag-sm.svg', a: ['Сан-Марино', 'Италия', 'Монако', 'Лихтенштейн'] },
  { level: 3, flag: 'flags-svg/flag-mc.svg', a: ['Монако', 'Франция', 'Польша', 'Мальта'] },
  { level: 3, flag: 'flags-svg/flag-st.svg', a: ['Сан-Томе и Принсипи', 'Кабо-Верде', 'Гана', 'Сьерра-Леоне'] },
];

