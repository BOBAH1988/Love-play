// games/core.js — Общий каркас приложения: состояние (state), сохранение/загрузка, утилиты, wake lock, а также сама первая игра приложения — "Фанты для двоих" (экран настройки, подбор карт, экран игры, избранное, свои задания, свайпы). Здесь же живёт общая для ВСЕХ игр логика паузы и итогов (кнопки #resetHiddenBtn, #finishGameBtn, #closeSummaryBtn, updateResumeUI, blockedByDavayPause) — она исторически вплетена в этот файл и вызывает функции завершения других игр (finishXGame и т.д.) по имени, поэтому все games/*.js должны быть загружены ДО первого клика пользователя (порядок загрузки между ними не важен), а games/init.js — ПОСЛЕ всех остальных games/*.js (см. его собственный комментарий).
// Загружается через <script src="games/core.js"></script> в index.html.


/* ============ КОНТЕКСТ ЗАПУСКА ПАРТИИ ============
 * «Шаг назад» обязан вести на экран, с которого игрок пришёл:
 *     Главная → группа игр → (экран настройки игры) → партия.
 * Здесь только объявление: какой экран был активен перед запуском партии.
 * Объявлено в самом начале файла (а не рядом с goToGame()), потому что
 * переходы экранов случаются уже при загрузке скриптов — например магазин
 * при инициализации зовёт showSetupView(). `let` в середине файла в этот
 * момент ещё не инициализирован, и запись в него роняет приложение (TDZ).
 * Подробности механизма — в блоке «КОНТЕКСТ ЗАПУСКА ПАРТИИ» ниже.
 */
let screenSeenActive = 'setup';


/* ============ ДАННЫЕ КАРТ ============ */
const LEVELS = [
  {id:1, key:'meet', name:'Знакомство', desc:'Лёгкие вопросы для начала', color:'#8fd9c4', icon:'🤝'},
  {id:2, key:'romance', name:'Романтика', desc:'Нежность и тёплые слова', color:'#ff9fb0', icon:'💗'},
  {id:3, key:'sensual', name:'Сближение', desc:'Прикосновения и близость', color:'#b07bff', icon:'🔥'},
  {id:4, key:'flirt', name:'Разогрев', desc:'Игривые поддразнивания', color:'#ff9a5e', icon:'💋'},
  {id:5, key:'hot', name:'Откровенно 18+', desc:'Самое смелое', color:'#ff3b5c', icon:'🌶️'},
  {id:6, key:'fantasy', name:'Фантазии', desc:'Самые смелые мечты', color:'#7a5cff', icon:'💫'},
];

/* ============ СОСТОЯНИЕ ============ */
const STORAGE_KEY = 'couple-game-state-v1';

/* ============ ВЕРСИЯ СХЕМЫ СОХРАНЕНИЙ ============
 * Поле state.schemaVersion показывает, по какой версии формата записаны
 * данные игрока. Если структура state изменится (поле переименуют, сменится
 * тип, два поля объединятся в одно), старая запись не сломается: MIGRATIONS
 * применит нужные шаги по порядку — от версии игрока до текущей.
 *
 * ПОЧЕМУ ЭТО НУЖНО. Раньше проверки вида `if (state.foo === undefined)`
 * лежали подряд в loadState() и выполнялись при КАЖДОЙ загрузке. Проблемы:
 *   — непонятно, какие из них ещё актуальны, а какие можно удалить;
 *   — порядок не зафиксирован: вставив проверку не туда, легко получить
 *     зависимость от ещё не мигрировавшего поля;
 *   — нельзя проверить «что увидит игрок с версии 1», не правя localStorage.
 * Теперь у каждого шага есть номер, и он выполняется один раз.
 *
 * КАК ДОБАВИТЬ МИГРАЦИЮ. Меняете структуру state — увеличьте SCHEMA_VERSION
 * на 1 и добавьте в MIGRATIONS запись с этим номером:
 *
 *   MIGRATIONS[2] = (s) => { s.newField = s.oldField; delete s.oldField; };
 *
 * Старые шаги не удаляйте: у кого-то сохранение может быть с версии 1,
 * и ему нужно пройти весь путь по порядку.
 */
const SCHEMA_VERSION = 2;
// Таблица миграций: ключ — номер версии, значение — функция (state) => void.
// Версия 1 — стартовая: сюда вошли все проверки, которые раньше лежали
// подряд в loadState() (поля сапёра и «Счастливого билета», имена игроков
// «Игрок N» → порядковые, «Команда 1/2» → «Первая/Вторая» и т.д.).
// Они выполняются один раз для сейвов без версии — то есть для всех, кто
// играл до введения версионирования.
const MIGRATIONS = {};

/**
 * Версия 1: разовые миграции, которые до этого выполнялись при каждой
 * загрузке безусловно. Логика та же — изменилось только то, что теперь
 * они применяются однократно и только к старым сохранениям.
 */
MIGRATIONS[1] = function(s){
  // Поля, добавленные в новых версиях: старые сейвы без них могли ронять
  // логику из-за undefined в условиях.
  if(s.kidsSaperLevel === undefined) s.kidsSaperLevel = 1;
  if(s.kidsSaperCurrentTeamIndex === undefined) s.kidsSaperCurrentTeamIndex = 0;
  if(!s.kidsSaperTeamTurnCount) s.kidsSaperTeamTurnCount = [0,0];
  if(!s.kidsSaperCompleted) s.kidsSaperCompleted = [];
    if(s.luckyLevel === undefined) s.luckyLevel = 1;
  if(s.luckyCurrentTeamIndex === undefined) s.luckyCurrentTeamIndex = 0;
  if(!s.luckyTeamTurnCount) s.luckyTeamTurnCount = [0,0];
  // luckyLinesToWin удалён из настроек (игра всегда до 5 линий): у старых
  // сейвов поле просто игнорируется, отдельно мигрировать нечего.
  if(s.lastSectionOnPause === undefined) s.lastSectionOnPause = null;

  // «Игры для компании»: прежние «Игрок 1/2/...» → порядковые
  // «Первый/Второй/...». Заменяем ТОЛЬКО точные старые дефолты —
  // введённые вручную имена не трогаем.
  if(Array.isArray(s.partyPlayers)){
    s.partyPlayers = s.partyPlayers.map((n,i)=>
      (typeof n === 'string' && /^Игрок\s+\d+$/.test(n.trim()))
        ? partyDefaultName(parseInt(n.trim().replace(/\D/g,''),10)-1)
        : (n || partyDefaultName(i)));
  }
  // «Игры с детьми»: «Игрок N» → «Родитель/Ребёнок/...».
  if(Array.isArray(s.kidsPlayers)){
    s.kidsPlayers = s.kidsPlayers.map((n,i)=>
      (typeof n === 'string' && /^Игрок\s+\d+$/.test(n.trim()))
        ? kidsDefaultName(parseInt(n.trim().replace(/\D/g,''),10)-1)
        : (n || kidsDefaultName(i)));
  }
  // Бизнес-игры: «Игрок N» → должности (Предприниматель/Управляющий/...).
  if(Array.isArray(s.businessPlayers)){
    s.businessPlayers = s.businessPlayers.map((n,i)=>
      (typeof n === 'string' && /^Игрок\s+\d+$/.test(n.trim()))
        ? businessDefaultName(parseInt(n.trim().replace(/\D/g,''),10)-1)
        : (n || businessDefaultName(i)));
  }
  // «Знаю тебя»: семьи — продолжение общего ряда (Семья 2 → «Третий/Четвёртый»).
  if(Array.isArray(s.famZnayuFamilies)){
    s.famZnayuFamilies = s.famZnayuFamilies.map((f,fIdx)=>{
      if(!f || typeof f !== 'object') return f;
      const out = Object.assign({}, f);
      if(out.p1 === 'Игрок 1') out.p1 = partyDefaultName(fIdx*2);
      if(out.p2 === 'Игрок 2') out.p2 = partyDefaultName(fIdx*2+1);
      return out;
    });
  }
  // «Счастливый билет»: «Команда 1/2» → «Первая/Вторая».
  // Поля участников (m/f) удалены из настроек — чистятся в ensureLuckyTeams.
  if(Array.isArray(s.luckyTeams)){
    s.luckyTeams = s.luckyTeams.map(t=>{
      if(!t || typeof t !== 'object') return t;
      const out = Object.assign({}, t);
      if(out.name === 'Команда 1') out.name = 'Первая команда';
      if(out.name === 'Команда 2') out.name = 'Вторая команда';
      delete out.m;
      delete out.f;
      return out;
    });
  }
};
/**
 * Версия 2: новые настройки по умолчанию «Пройди квеста» — количество 5,
 * выбор «Случайно», режим «Плавный». Применяется один раз к уже
 * установленным приложениям: их сейвы хранят старые значения (в том числе
 * оставшиеся с тестов), и без миграции новые дефолты до них бы не дошли.
 * Осознанный выбор пользователей этими значениями перезаписывается —
 * так задумано (запрос владельца, 2026-09-27).
 */
MIGRATIONS[2] = function(s){
  s.sexQuestCount = 5;
  s.sexQuestMode = 'random';
  s.sexQuestPlayMode = 'smooth';
};
// Дефолтные имена игроков «Игр для компании» — порядковые: «Первый», «Второй», …
// до «Десятый» (список ограничен 10). Используется renderPartyPlayers() в
// games/krokodil.js и всеми играми компании как фолбэк вместо прежних «Игрок N».
// Списки «Игр с детьми» (kidsPlayers) и бизнес-игр (businessPlayers) имеют
// собственные тематические дефолты (Родитель/Ребёнок и Предприниматель/…).
const PARTY_PLAYER_DEFAULTS = ['Первый','Второй','Третий','Четвёртый','Пятый','Шестой','Седьмой','Восьмой','Девятый','Десятый'];
function partyDefaultName(idx){
  idx = parseInt(idx, 10);
  if(isNaN(idx) || idx < 0) idx = 0;
  return PARTY_PLAYER_DEFAULTS[idx] || ('Игрок ' + (idx + 1));
}
function kidsDefaultName(idx){
  idx = parseInt(idx, 10);
  if(isNaN(idx) || idx < 0) idx = 0;
  if(idx === 0) return 'Родитель';
  if(idx === 1) return 'Ребёнок';
  if(idx === 2) return 'Второй родитель';
  if(idx === 3) return 'Второй ребёнок';
  return (idx + 1) + '-й ребёнок';
}
// Дефолты бизнес-игр: тематические должности вместо «Игрок N».
const BUSINESS_PLAYER_DEFAULTS = ['Предприниматель','Управляющий','Коммерсант','Директор','Финансист','Инвестор','Маркетолог','Логист','Аудитор','Банкир'];
function businessDefaultName(idx){
  idx = parseInt(idx, 10);
  if(isNaN(idx) || idx < 0) idx = 0;
  return BUSINESS_PLAYER_DEFAULTS[idx] || ('Игрок ' + (idx + 1));
}
let state = {
  // Версия формата сохранений (см. SCHEMA_VERSION и MIGRATIONS выше).
  // У нового игрока сразу текущая — миграции ему не нужны.
  schemaVersion: SCHEMA_VERSION,
  name1:'', name2:'', activeLevels:[3,4,5,6],
  starter:'random',
  gameMode:'hot', autoMilestone:0, turnsPlayed:0, turnsAtLastLevelUp:0,
  currentPlayer:1, score1:0, score2:0,
  levelTurnCounts:{1:0, 2:0}, pendingLevelUp:false,
  levelCap:3, usedIndexes:[], hiddenIndexes:[],
  muted:false, autoSpeak:true, inProgress:false, completedCount:0, skippedCount:0,
  customCards:[], favoriteIndexes:[], favoritesOnly:false,
  gameType:'fanty',
  /* Рулетка желаний */
  wrSelectedLevel:1, wrScore1:0, wrScore2:0, /* 'fanty' — случайный тип карты; 'td' — игрок выбирает Правда/Действие перед ходом */
  photoUsed:{}, photoHidden:[], photoDone:[], sexshopOwned:[], photoSelectedLevel:1, photoFavView:false,
  photoOrderMode:false, photoSeqIndex:{},
  videoUsed:{}, videoHidden:[], videoLiked:[], videoFavoritesOnly:false, videoAutoAdvance:false, videoSoundOn:false,
  videoDbMigrated:false, videoResetAt:0,
  davayUsed:{}, davayHidden:[], davayLiked:[], davayFavoritesOnly:false, davayAutoAdvance:false,
  davayFavYes:[], davayFavLater:[], davayFavNo:[],
  davayQuizActivePlayer:0, davayQuizQueue:[], davayQuizIndex:0, davayQuizAnswers:{},
  davayQuizP1Done:false, davayQuizP2Done:false, davayQuizPendingNext:0,
  // Уровень «Давай попробуем» = номер уровня видео (см. DAVAY_LEVELS в
  // fants-davay.js): 1..6. Раньше здесь лежал id общего LEVELS (3), из
  // которого игра вычитала двойку; читается через davaySelectedLevel().
  davayStarter:'random', davaySelectedLevel:1, davaySoundOn:false,
  // Ссылка на ПУБЛИЧНУЮ папку Яндекс Диска. Токена здесь нет и быть не должно:
  // он личный и открывает весь диск, а код статический — любой секрет в
  // браузере виден посетителю. Папка читается по одной ссылке без авторизации.
  // Внутри папки — папки уровней «Level N-M …», см. fants-davay.js.
  yandexPublicKey:'https://disk.yandex.ru/d/uv6GUxruxjpkzQ',
  // Кэш путей папок уровней «Level N-M …» с прошлой синхронизации: список
  // папок меняется редко, поэтому при повторном «Обновить видеофайлы» запросы
  // к папкам уходят одновременно с запросом корня — без его ожидания.
  yandexFolderPaths:[],
  pausedMode:null, lastSectionOnPause:null, lastPauseView:null,
  // Правда или действие
  tdSelectedLevel:3, tdCurrentPlayer:1, tdScore1:0, tdScore2:0, tdUsed:{}, tdHidden:[],
  tdCompletedCount:0, tdSkippedCount:0,
  tdLevelTurnCounts:{1:0, 2:0}, tdPendingLevelUp:false,
  // Секс-бинго
  bingoSelectedLevel:1, bingoGridLevel:0, bingoGrid:[], bingoChecked:[], bingoWonLines:[], bingoUsedBonus:[], bingoCurrentLevel:1,
  bingoEscalatedTo2:false, bingoEscalatedTo3:false, bingoVictoryMilestones:[], bingoFinished:false,
  // Задания бинго по умолчанию скрыты (карта стартует клетками 🎁) —
  // точное значение всё равно выставляет generateBingoGrid при старте.
  bingoTasksHidden:true, bingoRevealed:[],
  // Накопительный чек-лист бонусных заданий — в отличие от остального
  // состояния карты НЕ сбрасывается между партиями, только вручную.
  bingoBonusChecklist:[],
  // Таймер
  timerSelectedLevel:1, timerUsed:{}, timerGameMode:'fast', timerLevelUpCounts:{1:0, 2:0}, timerPendingLevelUp:false, timerCustomSeconds:10,
  timerLevelUpCadence:5,
  timerCurrentPlayer:1, timerScore1:0, timerScore2:0, timerCompletedCount:0, timerSkippedCount:0,
  // Твои желания
  wishlistStarter:'random', wishlistQueue:[], wishlistIndex:0, wishlistAnswers:{},
  wishlistActivePlayer:0, wishlistP1Done:false, wishlistP2Done:false, wishlistPendingNext:0,
  wishlistMatchHistory:[], wishlistHidden:[],
  // Тайные ответы (квиз "насколько хорошо вы знаете предпочтения друг друга")
  znayuStarter:'random', znayuQueue:[], znayuIndex:0, znayuAnswers:{},
  znayuActivePlayer:0, znayuP1Done:false, znayuP2Done:false, znayuPendingNext:0,
  znayuMatchHistory:[], znayuHidden:[],
  // Крокодил
  krokodilSelectedLevel:2, krokodilRoundSeconds:180, krokodilUsed:{},
  krokodilMode:'word', krokodilWordsPerRound:5,
  partyPlayers:['Первый','Второй'], krokodilScores:[], krokodilSkipCounts:[], krokodilCurrentPlayerIndex:0,
  krokodilTurnsPlayed:0, krokodilRoundsPerPlayer:5,
  // Игры с детьми (список игроков отдельный от "Игры для компании")
  // kidsAge по умолчанию = 2 (7 лет) — см. просьбу сделать 7 лет базовым
  // возрастом раздела вместо прежних 5 лет.
  kidsPlayers:['Родитель','Ребёнок'], kidsAge:2,
  // Мемори
  kidsMemoryLevel:1, kidsMemoryDeck:[], kidsMemoryScores:[], kidsMemoryCurrentPlayerIndex:0,
  // Правда/Действие (дети)
  kidsTdCompleted:[], kidsTdSkipped:[], kidsTdCurrentPlayerIndex:0, kidsTdCurrentType:null, kidsTdUsed:{},
  // Мемасики
  memesSelectedLevel:2, memesUsed:{}, memesHidden:[], memesAutoSpeak:false,
  // Фанты (компания)
  partyFantsSelectedLevel:2, partyFantsUsed:{}, partyFantsCompleted:[], partyFantsSkipped:[],
  partyFantsCurrentPlayerIndex:0,
  // Правда/Действие (компания)
  partyTdSelectedLevel:2, partyTdUsed:{}, partyTdCompleted:[], partyTdSkipped:[],
  partyTdCurrentPlayerIndex:0, partyTdCurrentType:null,
  // Знаю тебя (компания, семьями)
  famZnayuFamilyCount:1,
  famZnayuFamilies:[{p1:'Первый', p2:'Второй', p1Gender:'m', p2Gender:'f'}],
  famZnayuSelectedLevel:1, famZnayuUsed:{}, famZnayuCurrentFamilyIndex:0,
  // famZnayuHeroSide[i] = 1 или 2 — кто из пары семьи является "героем"
  // вопроса №i в текущей очереди (герой отвечает как есть, второй угадывает
  // его ответ). Назначается заново при каждой жеребьёвке вопросов семьи —
  // см. drawFamZnayuFamilyQueue().
  famZnayuHeroSide:[],
  famZnayuQueue:[], famZnayuIndex:0, famZnayuAnswers:{}, famZnayuActivePlayer:0,
  famZnayuP1Done:false, famZnayuP2Done:false, famZnayuResults:[], famZnayuPendingNext:0,
  // Счастливый билет (общее поле 5x5 на 2 команды, как в Секс-бинго —
  // уровень растёт автоматически после 1-й и 3-й собранной линии).
  // Ровно 2 команды, в каждой пара. Внутри команды партнёры выполняют ход
  // по очереди: если задание не для конкретного партнёра, ходит следующий
  // по очереди. luckyTeamTurnCount хранит, сколько раз уже ходила каждая
  // команда (порядок очереди).
  luckyTeams:[{name:'Первая команда'},{name:'Вторая команда'}],
  luckyTeamTurnCount:[0,0],
  luckyLevel:1, luckyGrid:[], luckyChecked:[], luckyCurrentTeamIndex:0,
  luckyCompleted:[], luckyWonLines:[], luckyEscalatedTo2:false, luckyEscalatedTo3:false,
  luckyFinished:false, luckyUsed:{},
  luckyTasksHidden:true, luckyRevealed:[],
  // Викторина (пары) — каждый игрок отвечает на все свои вопросы подряд
  // (quizQuestionCount штук), затем передаёт телефон следующему; см. games/quiz.js.
  quizSelectedLevel:1, quizAnswerSeconds:15, quizQuestionCount:5, quizUsed:{},
  quizQueue:[], quizIndex:0, quizCurrentPlayerIndex:0, quizCorrect:[], quizTimeMs:[],
  quizAutoSpeak:false,
  // Викторина (компания) — та же логика, все игроки из partyPlayers по очереди.
  partyQuizSelectedLevel:1, partyQuizAnswerSeconds:15, partyQuizQuestionCount:5, partyQuizUsed:{},
  partyQuizQueue:[], partyQuizIndex:0, partyQuizCurrentPlayerIndex:0, partyQuizCorrect:[], partyQuizTimeMs:[],
  partyQuizAutoSpeak:false,
  // Викторина (дети) — уровень берётся из kidsAge, а не из своего селектора.
  kidsQuizAnswerSeconds:15, kidsQuizQuestionCount:5, kidsQuizUsed:{},
  kidsQuizQueue:[], kidsQuizIndex:0, kidsQuizCurrentPlayerIndex:0, kidsQuizCorrect:[], kidsQuizTimeMs:[],
  kidsQuizAutoSpeak:false,
  // Идеи для вас (без уровней — единая колода из 100 карточек)
  ideasUsed:[],
  // Секс-квест — очередь желаний текущей партии и ответы по
  // каждому желанию; sexQuestChecklists — история завершённых партий
  // ("чек-листы" в избранном, см. games/sexquest.js).
  sexQuestQueue:[], sexQuestIndex:0, sexQuestResults:[], sexQuestChecklists:[],
  // Настройки партии: сколько желаний играть (1/5/10/'all') и режим выбора —
  // 'random' (случайно из всего пула) или 'manual' (отмечены вручную в
  // sexQuestManualIds, см. модалку выбора вопросов в games/sexquest.js).
  // sexQuestPlayMode — порядок заданий: 'smooth' (по умолчанию) — в обратном
  // порядке колоды, от самого простого к самому смелому; 'fast' — случайно,
  // как было раньше.
  sexQuestCount:5, sexQuestMode:'random', sexQuestManualIds:[], sexQuestPlayMode:'smooth',
  // Желания, исключённые крестиком из чек-листа — не участвуют в случайной
  // выдаче (но по-прежнему доступны для ручного выбора, см. sexquest.js).
  sexQuestExcluded:[],
  // Карта страсти — независимая игра (games/passionmap.js): та же структура
  // состояния, что у секс-квеста, но свои ключи passionMap*.
  passionMapQueue:[], passionMapIndex:0, passionMapScore:0, passionMapResults:[], passionMapChecklists:[],
  passionMapCount:1, passionMapMode:'random', passionMapManualIds:[], passionMapExcluded:[],
  // Твистер — приложение только объявляет ходы, поле физическое
  twisterDuration:10,
  // Бизнес игры — список игроков отдельный от "Игры для компании"
  businessPlayers:[businessDefaultName(0), businessDefaultName(1)],
  // Оцени бизнес (тренажёр маржи/наценки/точки безубыточности, Уровень 2
  // "Наблюдатель") — вопросы генерируются на лету, игроки из businessPlayers
  // отвечают по очереди bizObsQuestionCount вопросов подряд, см. games/business-observer.js.
  bizObsQuestionCount:5, bizObsQueue:[], bizObsIndex:0, bizObsCurrentPlayerIndex:0, bizObsCorrect:[],
  // Во что поиграть? (дети) — без уровней, единая колода описаний игр
  whatToPlayUsed:[], whatToPlayFavorites:[], whatToPlayFavView:false,
  // Крокодил (дети) — уровень берётся из kidsAge, игроки из kidsPlayers
  kidsKrokodilMode:'word', kidsKrokodilRoundSeconds:180, kidsKrokodilWordsPerRound:5,
  kidsKrokodilRoundsPerPlayer:5, kidsKrokodilUsed:{},
  kidsKrokodilScores:[], kidsKrokodilSkipCounts:[], kidsKrokodilCurrentPlayerIndex:0,
  kidsKrokodilTurnsPlayed:0,
  // Мемасики (дети) — уровень берётся из kidsAge
  kidsMemesUsed:{}, kidsMemesHidden:[], kidsMemesAutoSpeak:false,
  // Флеш-карты (дети) — flashTheme: тема подборки ('english'/'animals'/'verbs'),
  
  // flashQueue/flashIndex — карточки текущей партии
  // (фиксированное количество, не бесконечная колода).
  flashMode:'learn', flashTheme:'english', flashTimeSub:'digital', flashCount:25,
  flashQueue:[], flashIndex:0, flashAutoSpeak:true,
  // «Время» (обучающая игра — часы) — вынесена в отдельную игру (games/kids-flash-time.js).
  // flashTimeCount — количество карточек за партию (5/10/25/50, как в «Английском»).
  flashTimePool:[], flashTimeIndex:0, flashTimeScore:0, flashTimeErrors:0, flashTimeCount:10,
  // Флаги — уровень, размер партии, текущая очередь и результат.
  flagsSelectedLevel:1, flagsAnswerSeconds:10, flagsQuestionCount:10,
  flagsUsed:{}, flagsQueue:[], flagsIndex:0, flagsCorrect:0, flagsTimeMs:0,
  // Столицы — уровень, размер партии, текущая очередь и результат.
  capitalsSelectedLevel:1, capitalsAnswerSeconds:10, capitalsQuestionCount:10,
  capitalsUsed:{}, capitalsQueue:[], capitalsIndex:0, capitalsCorrect:0, capitalsTimeMs:0,
  // Арифметика — тема (операция), уровень, размер партии, очередь и результат (карточки генерируются).
  timesTableTopic:'multiply', timesTableSelectedLevel:1, timesTableAnswerSeconds:5, timesTableQuestionCount:10,
  timesTableUsed:{}, timesTableQueue:[], timesTableIndex:0, timesTableCorrect:0, timesTableTimeMs:0,
  // Сапёр (дети) — настоящая сапёрская механика (минное поле, цифры,
  // флажки, победа/поражение). kidsSaperWonLines/kidsSaperEscalated* — устарели,
  // оставлены для обратной совместимости со старыми сохранениями.
  kidsSaperGrid:[], kidsSaperChecked:[], kidsSaperFlags:[], kidsSaperWonLines:[],
  kidsSaperCurrentLevel:1, kidsSaperEscalatedTo2:false, kidsSaperEscalatedTo3:false,
  kidsSaperFinished:false, kidsSaperBonusChecklist:[], kidsSaperTasksHidden:true,
  // Виселица (компания) — без уровней, общий счёт побед/поражений
  partyHangmanWord:'', partyHangmanGuessed:[], partyHangmanWrong:0,
  partyHangmanUsedWords:[], partyHangmanWins:0, partyHangmanLosses:0,
  // Магазин (дети)
  shopMode:'buyer', shopHintVisible:true,
  // Рулетка (компания) — баланс по игрокам, сохраняется между заходами
  rouletteBalances:[], rouletteCurrentPlayerIndex:0,
  // Викторина (один) — использует тот же банк вопросов, что и Викторина
  // (компания), но со своим прогрессом "показанных" вопросов и своим счётом.
  soloQuizSelectedLevel:1, soloQuizAnswerSeconds:15, soloQuizQuestionCount:10,
  soloQuizUsed:{}, soloQuizQueue:[], soloQuizIndex:0, soloQuizCorrect:0, soloQuizTimeMs:0,
  soloQuizAutoSpeak:false,
  // Мемори (один) — использует те же данные, что и детское Мемори
  // (KIDS_MEMORY_LEVELS/KIDS_MEMORY_ICONS), свой прогресс и статистика ходов/времени,
  // таблица лидеров — топ-10 {name, timeMs}, отсортированных по времени.
  soloMemoryLevel:1, soloMemoryDeck:[], soloMemorySteps:0, soloMemoryElapsedMs:0,
  soloMemoryLeaderboard:[], soloMemoryLastName:'',
  // Лимонадный ларёк (бизнес) — партия без ограничения по дням: утро
  // (погода/событие/апгрейды) → место → время работы → закупка →
  // приготовление напитков → цена → итоги дня, капитал переносится между
  // днями (не может уйти ниже 0). Партия завершается, когда накопленная
  // чистая прибыль достигнет цели (businessLemonadeGoal), затем мини-проверка.
  businessLemonadeDay:1, businessLemonadeMoney:0, businessLemonadeReserve:200,
  businessLemonadeUpgrades:{sign:false, music:false, recipe:false, seller:false, secondStand:false},
  businessLemonadeWeatherKey:'normal', businessLemonadeEventIdx:-1, businessLemonadeLocation:null,
  businessLemonadeHours:null, businessLemonadeOptions:{},
  businessLemonadeLemonStock:0, businessLemonadeLemonBoughtDay:null, businessLemonadeTeaStock:0, businessLemonadeCompetitorPrice:null,
  businessLemonadeLoanOwed:0, businessLemonadeLoanDueDay:null,
  businessLemonadeCups:10, businessLemonadePrice:40, businessLemonadeTeaCups:10, businessLemonadeTeaPrice:10, businessLemonadeDrinkType:'lemonade', businessLemonadeSold:0,
  businessLemonadeGoal:5000, businessLemonadeGoalName:'ролики',
  businessLemonadeRevenue:0, businessLemonadeNetProfit:0, businessLemonadeDayProfits:[], businessLemonadeDayLog:[],
  businessLemonadeQuizIndex:0, businessLemonadeQuizCorrect:0, businessLemonadeQuizItems:[],
  // Крестики нолики (дети) — счёт партии переживает раунды, обнуляется только при выходе.
  // kidsXoBoardSize: 3 (3×3, три в ряд) или 5 (5×5, четыре в ряд).
  kidsXoBoard:[], kidsXoBoardSize:3, kidsXoCurrentPlayer:'X', kidsXoRoundOver:false, kidsXoStartingPlayer:'X',
  kidsXoScoreX:0, kidsXoScoreO:0, kidsXoDraws:0,
  // Крестики нолики (для одного) — та же механика, но против бота: игрок
  // всегда крестики (X), бот всегда нолики (O).
  soloXoBoard:[], soloXoBoardSize:3, soloXoCurrentPlayer:'X', soloXoRoundOver:false, soloXoStartingPlayer:'X',
  soloXoScorePlayer:0, soloXoScoreBot:0, soloXoDraws:0,
  // «Четыре в ряд» (соло, против бота) — копия механики kidsC4, но игрок
  // всегда красные (R), бот жёлтые (Y). Счёт партии переживает раунды.
  soloC4Board:[], soloC4CurrentPlayer:'R', soloC4RoundOver:false, soloC4StartingPlayer:'R',
  soloC4ScorePlayer:0, soloC4ScoreBot:0, soloC4Draws:0,
  // «Четыре в ряд» (дети) — поле 7 колонок × 6 рядов, шашки падают вниз.
  // kidsC4Board — 42 ячейки (индекс = row*7+col, row 0 — верхний ряд);
  // 'R' — красные (игрок 1), 'Y' — жёлтые (игрок 2). Счёт партии переживает
  // раунды, обнуляется только при выходе (см. games/kids-connect4.js).
  kidsC4Board:[], kidsC4CurrentPlayer:'R', kidsC4RoundOver:false, kidsC4StartingPlayer:'R',
  kidsC4ScoreR:0, kidsC4ScoreY:0, kidsC4Draws:0,
  // "Я никогда не" (компания)
  partyNeverSelectedLevel:1, partyNeverUsed:{},
  // Морской бой (дети) — battleshipBoards[0]/[1] — флоты игроков 0/1, каждый
  // {cells:[{ship,shipId,shot}], ships:[{id,size,hits,sunk}]}; ходит всегда
  // тот, чей индекс в battleshipCurrentPlayer — стреляет по ДРУГОМУ игроку.
   battleshipBoards:[], battleshipCurrentPlayer:0, battleshipWinner:null, battleshipShotsCount:[0,0], battleshipWins:[0,0],
   // Морской бой (одиночка, против бота). soloBsPlayerBoard — наше поле
   // (бот туда стреляет), soloBsBotBoard — поле бота (стреляем мы); ходит
   // тот, чей ход в soloBsCurrentPlayer ('player'|'bot').
   soloBsPlayerBoard:[], soloBsBotBoard:[], soloBsCurrentPlayer:'player', soloBsWinner:null, soloBsShots:{player:0,bot:0}, soloBsWins:{player:0,bot:0}
 };

/* currentPlayer 1 = мужчина (М), currentPlayer 2 = женщина (Ж) */
function pickStartingPlayerValue(v){
  if(v==='M') return 1;
  if(v==='F') return 2;
  return Math.random() < 0.5 ? 1 : 2;
}
function pickStartingPlayer(){
  return pickStartingPlayerValue(state.starter);
}
function currentGender(){ return state.currentPlayer===1 ? 'M' : 'F'; }
function getSortedActiveLevels(){ return [...state.activeLevels].sort((a,b)=>a-b); }

/**
 * Применяет миграции схемы к загруженному состоянию.
 *
 * Шаги выполняются по порядку — от версии, в которой записан сейв игрока,
 * до текущей SCHEMA_VERSION. Сбой одного шага не блокирует остальные (иначе
 * одна ошибка навсегда лишила бы игрока обновления), но попадает в журнал.
 *
 * @param {object} s — объект состояния из localStorage
 * @returns {number} сколько шагов применили
 */
function applyMigrations(s){
  // Сейв без версии — очень старое сохранение или запись до введения
  // версионирования. Считаем версией 0 и прогоняем через все шаги.
  const from = (typeof s.schemaVersion === 'number') ? s.schemaVersion : 0;

  if(from > SCHEMA_VERSION){
    // Сейв новее приложения: игрок открыл старую версию из кэша. Откатывать
    // нельзя — новых полей мы не понимаем. Предупреждаем и работаем как есть.
    try{ console.warn('[Love-play] сейв v' + from + ' новее приложения v' + SCHEMA_VERSION); }catch(_){}
    return 0;
  }

  let applied = 0;
  for(let v = from + 1; v <= SCHEMA_VERSION; v++){
    const step = MIGRATIONS[v];
    if(typeof step !== 'function') continue;
    try{
      step(s);
      applied++;
    }catch(err){
      if(typeof logAppError === 'function'){
        logAppError({
          time: new Date().toISOString(),
          message: 'миграция схемы v' + v + ' не удалась: ' + (err && err.message),
          source: 'loadState',
        });
      }
    }
  }
  s.schemaVersion = SCHEMA_VERSION;
  return applied;
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const s = JSON.parse(raw);
      // Миграции схемы применяем ДО слияния с дефолтами: шаг может
      // переименовать или удалить поле, и тогда Object.assign подставил бы
      // устаревший дефолт поверх уже мигрированного значения.
      const migrationsApplied = applyMigrations(s);
      state = Object.assign(state, s);
      // Единый звук видео (см. setSharedVideoSound): старые сейвы могли
      // хранить разные значения в davaySoundOn/videoSoundOn. Master —
      // davaySoundOn: именно его показывает кнопка «Звук» на странице
      // настройки, и игрок ожидает, что звук после включения там работает
      // в обеих играх.
      if(state.videoSoundOn !== state.davaySoundOn){
        state.videoSoundOn = state.davaySoundOn;
      }
      if(migrationsApplied > 0) saveState(); // фиксируем, чтобы не повторять
      // Миграция старых сейвов: flashAutoSpeak раньше был false по умолчанию,
      // из-за этого после обновления он оставался выключенным у существующих
      // пользователей. Включаем один раз (отдельный флаг — как у
      // age-verified/kids-mode) без затирания их последующего ручного выключения.
      if(localStorage.getItem('couple-game-flash-migrated-v1') !== '1'){
        state.flashAutoSpeak = true;
        localStorage.setItem('couple-game-flash-migrated-v1','1');
        saveState();
      }
      if(localStorage.getItem('couple-game-autospeak-migrated-v1') !== '1'){
        state.autoSpeak = true;
        localStorage.setItem('couple-game-autospeak-migrated-v1','1');
        saveState();
      }
      // Миграция дефолта размера партии «Флагов»/«Столиц»: 5 → 10 карточек,
      // однократно (по образцу flash-migrated-v1). Значение 5 было единственным
      // дефолтом с момента появления настройки — почти все сохранённые пятёрки
      // выбраны не вручную; осознанный выбор пользователю не навязывается.
      if(localStorage.getItem('couple-game-default-count-v1') !== '1'){
        if(state.flagsQuestionCount === 5) state.flagsQuestionCount = 10;
        if(state.capitalsQuestionCount === 5) state.capitalsQuestionCount = 10;
        localStorage.setItem('couple-game-default-count-v1','1');
        saveState();
      }
    }
  }catch(e){}
  // Разовые миграции старых сохранений выполняет applyMigrations() —
  // они переехали в таблицу MIGRATIONS с номерами версий (см. выше).
  // Здесь остаётся только то, что должно срабатывать при КАЖДОМ запуске.
}
function saveState(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){
    // Квота localStorage исчерпана — уведомляем пользователя, чтобы он
    // знал, почему прогресс может не сохраниться.
    if(e && e.name === 'QuotaExceededError' && typeof showToast === 'function'){
      showToast('⚠️ Хранилище переполнено — очистите историю или сделайте сброс');
    }
  }
}

// ===== Резервная копия данных (без сервера и регистрации) =====
// Сохраняет весь прогресс/избранное/настройки в JSON-файл, который можно
// перенести на другое устройство или сохранить в облако вручную (iCloud,
// Google Диск и т.п.) и потом загрузить обратно кнопкой "Импортировать".
// Сами видеофайлы, добавленные с телефона, в бэкап не входят — они хранятся
// в IndexedDB на устройстве.
function exportGameData(){
  saveState();
  const payload = {
    app: 'Игры для двоих',
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    state: state
  };
  try{
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `igra-dlya-dvoih-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
    showToast('Файл с данными сохранён 📤');
  }catch(e){
    playErrorSound();
    showToast('Не удалось создать файл резервной копии');
  }
}
function importGameDataFromFile(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const payload = JSON.parse(String(reader.result));
      const incoming = payload && typeof payload === 'object' && payload.state ? payload.state : payload;
      if(!incoming || typeof incoming !== 'object' || Array.isArray(incoming)){
        throw new Error('Некорректный файл');
      }
      // Импорт полностью заменяет текущий прогресс — подтверждение защищает
      // от случайного выбора не того файла.
      if(!confirm('Заменить текущий прогресс данными из этого файла? Это действие нельзя отменить.')){
        return;
      }
      state = Object.assign({}, state, incoming);
      saveState();
      document.getElementById('name1').value = state.name1 || '';
      document.getElementById('name2').value = state.name2 || '';
      updateStarterLabels();
      renderModeGroup();
      renderLevelToggles();
      updateResumeUI();
      updateFavoriteBtn();
      showToast('Данные восстановлены ✅');
    }catch(e){
      playErrorSound();
      showToast('Не удалось прочитать файл — это не резервная копия игры');
    }
  };
  reader.onerror = ()=>{
    playErrorSound();
    showToast('Не удалось прочитать файл');
  };
  reader.readAsText(file, 'utf-8');
}
// Кнопки старого блока резервного копирования (#exportDataBtn/#importDataBtn/
// #backupToggle и контейнер #backupField) удалены из разметки при переносе
// экспорта/импорта в глобальное меню (#menuExportBtn/#menuImportBtn, см.
// обработчики ниже). Здесь остаётся только обработчик выбора файла — к нему
// ведут оба пути импорта (кнопка меню вызывает #importDataInput.click()).
document.getElementById('importDataInput').addEventListener('change', (e)=>{
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  importGameDataFromFile(file);
});
// Главная страница (#setup) содержит 4 блока-«вида» (главный хаб, игры для
// двоих, игры для компании, заглушка игр с детьми), но всегда остаётся тем
// же самым экраном #setup — переходы "назад в #setup" из любой игры трогать
// не нужно, они как и раньше просто делают #setup активным экраном. Здесь
// только переключение, какой из 4 блоков внутри него показан.
const SETUP_VIEW_IDS = ['homeView','twoPlayerView','companyView','kidsView','businessView','soloView','learningView'];
function showSetupView(name){
  // ФИКС критического бага «исчезли все игры в группе»: флаг inProgress мог
  // застревать после выхода из игры (не все exit-функции его сбрасывали) и
  // навсегда прятал список игр группы. Переход пользователя по меню — верный
  // признак, что активной игры больше нет: сбрасываем устаревший флаг.
  if(state.inProgress && !state.pausedMode){
    state.inProgress = false;
    saveState();
  }
  // Также принудительно возвращаем видимость всем спискам игр групп — их мог
  // спрятать inline display:none из updateResumeUI при прежней (багованной)
  // логике; повторный показ здесь гарантирует, что в любую группу всегда
  // можно зайти и увидеть её игры.
  ['gameSelectField','partyGameSelectField','kidsGameSelectField','soloGameSelectList','businessGameSelectField'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.style.display = '';
  });
  SETUP_VIEW_IDS.forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.classList.toggle('section-open', id === name);
  });
  // Перерисовываем список игроков в открываемом разделе — чтобы изменения
  // (из localStorage после перезагрузки/обновления, импорт, переименование)
  // сразу отражались в полях ввода, а не оставались старыми дефолтами.
  if(name === 'kidsView' && typeof renderKidsPlayers === 'function') renderKidsPlayers();
  else if(name === 'businessView' && typeof renderBusinessPlayers === 'function') renderBusinessPlayers();
  else if((name === 'companyView' || name === 'twoPlayerView') && typeof renderPartyPlayers === 'function') renderPartyPlayers();
  // Хаб снова ВИДИМЫЙ экран (не просто переключили класс у невидимого блока) —
  // значит, «родитель» для любой игры, запущенной отсюда, именно хаб. Это
  // закрывает целый класс багов «выход ведёт в меню ПРОШЛОЙ игры»: точка входа
  // запоминалась только в goToGameSetup(), а игры, которые стартуют прямо из
  // плитки без своего экрана настройки («Бинго», «Виселица», «Рулетка»,
  // «Твистер», «Сапёр», «Ответы на вопросы», «Во что поиграть»), её не
  // обновляли — и выход возвращал в экран настройки игры, сыгранной раньше.
  // Раздел запоминаем вместе с хабом: возврат откроет ту же группу.
  // Условие «#setup активен» важно: в goToGameSetup() showSetupView() зовётся,
  // когда активен уже целевой экран настройки — там точку входа перезаписывать
  // нельзя (иначе выход возвращал бы в хаб вместо самой настройки игры).
  const hubEl = document.getElementById('setup');
  if(hubEl && hubEl.classList.contains('active')){
    noteVisibleScreen('setup');
    // Во время паузы хаб показывается «поверх партии»: это не выход игрока в
    // меню, поэтому точку входа не трогаем — иначе после «Продолжить игру»
    // выход из партии вёл бы в хаб, а не в меню самой игры.
    if(!state.pausedMode) rememberReturnScreen('setup', name);
  }
}
document.getElementById('homeTwoPlayerBtn').addEventListener('click', ()=>{ playSuccessSound(); showSetupView('twoPlayerView'); });
document.getElementById('homeCompanyBtn').addEventListener('click', ()=>{ playSuccessSound(); showSetupView('companyView'); });
document.getElementById('homeKidsBtn').addEventListener('click', ()=>{ playSuccessSound(); showSetupView('kidsView'); });
document.getElementById('homeBusinessBtn').addEventListener('click', ()=>{ playSuccessSound(); showSetupView('businessView'); });
document.getElementById('homeSoloBtn').addEventListener('click', ()=>{ playSuccessSound(); showSetupView('soloView'); });
document.getElementById('homeLearningBtn').addEventListener('click', ()=>{ playSuccessSound(); showSetupView('learningView'); });
document.getElementById('twoPlayerExitBtn').addEventListener('click', ()=>{ showSetupView('homeView'); });
document.getElementById('companyExitBtn').addEventListener('click', ()=>{ showSetupView('homeView'); });
document.getElementById('kidsExitBtn').addEventListener('click', ()=>{ showSetupView('homeView'); });
document.getElementById('businessExitBtn').addEventListener('click', ()=>{ showSetupView('homeView'); });
document.getElementById('soloExitBtn').addEventListener('click', ()=>{ showSetupView('homeView'); });
document.getElementById('learningExitBtn').addEventListener('click', ()=>{ showSetupView('homeView'); });

/* ============ УНИВЕРСАЛЬНЫЙ ПЕРЕХОД В НАСТРОЙКИ ИГРЫ ============ */
// Вместо ~50 одинаковых функций goToXxxSetup() (каждая просто
// переключает #setup и нужный #xxxSetup) — единый помощник.
//   goToGameSetup('fantySetup')           // просто переключает экраны
//   goToGameSetup('fantySetup', 'twoPlayerView')  // + открывает нужный раздел
//   goToGameSetup('quizSetup', () => renderQuizExtra())
//   goToGameSetup('favoritesSetup', null, () => { ... }) // кастомный cleanup
//
// Поведение:
//  1) гасит экран #setup (на случай, если шли из #xxxSetup назад на #setup, а
//     потом хотим вернуться в этот же #xxxSetup — он не должен оставаться
//     активным, иначе будут наложения),
//  2) включает #gameSetupId,
//  3) опционально открывает нужный раздел главного меню (#homeView и т.п.) —
//     полезно, если настройка спрятана в подменю, и нужно сразу подсветить
//     группу, из которой мы пришли,
//  4) опционально зовёт beforeSwitch() — для лёгкого «сброса фильтров»
//     конкретной настройки (например, подтянуть актуальные данные из state).
//
// Все ранее существовавшие goToXxxSetup() определены как алиасы через эту
// функцию (см. games/<game>.js), чтобы не ломать ни обработчики в core.js,
// ни обратную совместимость с уже подключёнными файлами.
function goToGameSetup(gameSetupId, targetView, beforeSwitch){
  if(typeof gameSetupId !== 'string' || !gameSetupId){
    console.warn('goToGameSetup: не передан id экрана настроек');
    return;
  }
  // 1) гасим ВСЕ активные экраны (не только #setup: подменю вроде
  //    #kidsBoardGamesMenu и другие настройки тоже должны гаснуть), чтобы
  //    не оставалось «экрана, поделённого на 2 части» при наложении.
  //    Точку входа запоминаем ДО гашения — по ней вернёт кнопка «Назад».
  rememberReturnScreen(gameSetupId, targetView);
  document.querySelectorAll('.screen.active').forEach(el=>el.classList.remove('active'));
  // 2) включаем нужный экран настроек
  const targetEl = document.getElementById(gameSetupId);
  if(targetEl){
    targetEl.classList.add('active');
    // Для запуска партии важно, что игрок сейчас на экране настройки этой игры
    // (см. «КОНТЕКСТ ЗАПУСКА ПАРТИИ»): тогда выход вернёт сюда, а не в хаб.
    noteVisibleScreen(gameSetupId);
  } else {
    console.warn('goToGameSetup: экран #'+gameSetupId+' не найден в DOM');
  }
  // 3) опционально переключаем внутренний раздел #setup
  if(targetView && typeof showSetupView === 'function'){
    showSetupView(targetView);
  }
  // 4) опциональный pre-render / cleanup
  if(typeof beforeSwitch === 'function'){
    try { beforeSwitch(); } catch(e){ console.error('goToGameSetup.beforeSwitch:', e); }
  }
}

// Список игроков для "Игры с детьми" — тот же паттерн, что renderPartyPlayers
// в games/krokodil.js, но отдельное состояние (kidsPlayers), т.к. это не
// связано с "Играми для компании": от 2 до 10, поля добавляются/удаляются
// кнопками, имена по умолчанию "Игрок N".
function renderKidsPlayers(){
  if(!state.kidsPlayers || state.kidsPlayers.length < 2){
    state.kidsPlayers = ['Родитель','Ребёнок'];
  }
  const wrap = document.getElementById('kidsPlayersList');
  if(!wrap) return;
  wrap.innerHTML = '';
  state.kidsPlayers.forEach((name, idx)=>{
    const row = document.createElement('div');
    row.className = 'krokodil-player-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 14;
    input.placeholder = kidsDefaultName(idx);
    input.value = name;
    input.addEventListener('input', ()=>{
      state.kidsPlayers[idx] = input.value.trim() || kidsDefaultName(idx);
      saveState();
    });
    row.appendChild(input);
    if(state.kidsPlayers.length > 2){
      const rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.className = 'krokodil-player-remove';
      rmBtn.setAttribute('aria-label', 'Удалить игрока');
      rmBtn.textContent = '✕';
      rmBtn.addEventListener('click', ()=>{
        if(state.kidsPlayers.length <= 2) return;
        state.kidsPlayers.splice(idx, 1);
        saveState();
        renderKidsPlayers();
      });
      row.appendChild(rmBtn);
    }
    wrap.appendChild(row);
  });
  const addBtn = document.getElementById('kidsAddPlayerBtn');
  if(addBtn) addBtn.style.display = state.kidsPlayers.length >= 10 ? 'none' : '';
}
document.getElementById('kidsAddPlayerBtn').addEventListener('click', ()=>{
  if(!state.kidsPlayers) state.kidsPlayers = ['Родитель','Ребёнок'];
  if(state.kidsPlayers.length >= 10) return;
  state.kidsPlayers.push(kidsDefaultName(state.kidsPlayers.length));
  saveState();
  renderKidsPlayers();
});
renderKidsPlayers();
// Список игроков для "Бизнес игр" — тот же паттерн, что renderPartyPlayers/
// renderKidsPlayers, но отдельное состояние (businessPlayers).
function renderBusinessPlayers(){
  if(!state.businessPlayers || state.businessPlayers.length < 2){
    state.businessPlayers = [businessDefaultName(0), businessDefaultName(1)];
  }
  const wrap = document.getElementById('businessPlayersList');
  if(!wrap) return;
  wrap.innerHTML = '';
  state.businessPlayers.forEach((name, idx)=>{
    const row = document.createElement('div');
    row.className = 'krokodil-player-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 16;
    input.placeholder = businessDefaultName(idx);
    input.value = name;
    input.addEventListener('input', ()=>{
      state.businessPlayers[idx] = input.value.trim() || businessDefaultName(idx);
      saveState();
    });
    row.appendChild(input);
    if(state.businessPlayers.length > 2){
      const rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.className = 'krokodil-player-remove';
      rmBtn.setAttribute('aria-label', 'Удалить игрока');
      rmBtn.textContent = '✕';
      rmBtn.addEventListener('click', ()=>{
        if(state.businessPlayers.length <= 2) return;
        state.businessPlayers.splice(idx, 1);
        saveState();
        renderBusinessPlayers();
      });
      row.appendChild(rmBtn);
    }
    wrap.appendChild(row);
  });
  const addBtn = document.getElementById('businessAddPlayerBtn');
  if(addBtn) addBtn.style.display = state.businessPlayers.length >= 10 ? 'none' : '';
}
document.getElementById('businessAddPlayerBtn').addEventListener('click', ()=>{
  if(!state.businessPlayers) state.businessPlayers = [businessDefaultName(0), businessDefaultName(1)];
  if(state.businessPlayers.length >= 10) return;
  state.businessPlayers.push(businessDefaultName(state.businessPlayers.length));
  saveState();
  renderBusinessPlayers();
});
renderBusinessPlayers();
// "Лимонадный ларёк" (бизнес) — goToBusinessLemonadeSetup() определена в games/business-lemonade.js.
document.getElementById('gameBusiness1Btn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToBusinessLemonadeSetup();
});
// "Оцени бизнес" — goToBizObsSetup() определена в games/business-observer.js.
document.getElementById('gameBizObserverBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToBizObsSetup();
});
// "Секс квест" реализован (см. games/sexquest.js: goToSexQuestSetup).
// "Карта секса" пока остаётся заглушкой.
document.getElementById('gameSexQuestBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToSexQuestSetup();
});
// «Карта страсти» — независимая игра (см. games/passionmap.js: goToPassionMapSetup).
document.getElementById('gameSexMapBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToPassionMapSetup();
});
// Возраст ребёнка — общий переключатель для игр раздела "Игры с детьми",
// которым важен возраст (сейчас — "Правда/Действие"): 1=5 лет, 2=7 лет,
// 3=10 лет, 4=14 лет. Тот же паттерн, что renderKrokodilDurationGroup.
function renderKidsAgeGroup(){
  document.querySelectorAll('#kidsAgeGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (state.kidsAge || 1));
  });
}
document.querySelectorAll('#kidsAgeGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.kidsAge = parseInt(btn.dataset.value, 10);
    saveState();
    renderKidsAgeGroup();
  });
});
renderKidsAgeGroup();
// "Мемори" — первая настоящая игра в разделе, goToKidsMemorySetup() определена
// в games/kids-memory.js (грузится позже, но объявления function поднимаются
// в общую область видимости — тот же приём, что и с остальными играми ниже).
document.getElementById('gameKidsMemoryBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToKidsMemorySetup();
});
// "Во что поиграть?" — goToWhatToPlayGame() определена в games/whattoplay.js.
document.getElementById('gameKidsWhatToPlayBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToWhatToPlayGame();
});
// "Крокодил" (дети) — goToKidsKrokodilSetup() определена в games/kids-krokodil.js.
document.getElementById('gameKidsKrokodilBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToKidsKrokodilSetup();
});
// "Мемасики" (дети) — goToKidsMemesSetup() определена в games/kids-memes.js.
document.getElementById('gameKidsMemesBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToKidsMemesSetup();
});
// "Магазин" (бизнес) — goToShopSetup() определена в games/shop.js.
document.getElementById('gameShopBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToShopSetup();
});
// "Настольные игры" (дети) — подменю с Крестиками-ноликами и Морским боем,
// чтобы не загромождать общий список "Игры с детьми" лишними иконками.
document.getElementById('gameKidsBoardGamesBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('kidsBoardGamesMenu').classList.add('active');
});
document.getElementById('kidsBoardGamesExitBtn').addEventListener('click', ()=>{
  document.getElementById('kidsBoardGamesMenu').classList.remove('active');
  document.getElementById('setup').classList.add('active');
});
// "Крестики нолики" (дети) — goToKidsXoSetup() определена в games/kids-xo.js.
document.getElementById('gameKidsXoBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToKidsXoSetup();
});
// "Морской бой" (дети) — goToKidsBattleshipSetup() определена в games/kids-battleship.js.
document.getElementById('gameKidsBattleshipBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToKidsBattleshipSetup();
});
// «Четыре в ряд» (дети) — goToKidsC4Setup() определена в games/kids-connect4.js.
document.getElementById('gameKidsC4Btn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToKidsC4Setup();
});
// "Правда/Действие" (дети) — goToKidsTdSetup() определена в games/kids-td.js.
document.getElementById('gameKidsTdBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToKidsTdSetup();
});
document.getElementById('gameKidsQuizBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToKidsQuizSetup();
});
// "Морской бой" (игры для одного) — goToSoloBattleshipSetup() определена в games/solo-battleship.js.
document.getElementById('gameSoloBattleshipBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToSoloBattleshipSetup();
});
// «Четыре в ряд» (соло, против бота) — goToSoloC4Setup() определена в games/solo-connect4.js.
document.getElementById('gameSoloC4Btn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToSoloC4Setup();
});
// "Английский язык" (обучающие игры) — goToFlashSetup() определена в games/kids-flash.js.
document.getElementById('gameLearningFlashBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToFlashSetup();
});
// «Время» (обучающая игра — часы) — goToFlashTimeSetup() определена в games/kids-flash-time.js.
document.getElementById('gameFlashTimeBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToFlashTimeSetup();
});
// "Флаги" (обучающая игра) — goToFlagsSetup() определена в games/flags.js.
document.getElementById('gameFlagsBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToFlagsSetup();
});
// "Столицы" (обучающая игра) — goToCapitalsSetup() определена в games/capitals.js.
document.getElementById('gameCapitalsBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToCapitalsSetup();
});
// «Таблица умножения» (обучающая игра) — goToTimesTableSetup() определена в games/times-table.js.
document.getElementById('gameTimesTableBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToTimesTableSetup();
});
// "Сапёр" (дети) — goToKidsSaperGame() определена в games/kids-saper.js.
document.getElementById('gameKidsMinesweeperBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToKidsSaperGame();
});

/* ============ УТИЛИТЫ ============ */
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function showToast(msg, duration){
  const t = document.getElementById('toast');
  t.innerHTML = msg.replace(/\n/g, '<br>');
  t.classList.add('show');
  clearTimeout(showToast._tm);
  // duration === 0 — «не гаснуть»: тост держится до следующего showToast.
  // Нужно для длинных операций (синхронизация с Яндекс Диском), когда игрок
  // должен видеть «идёт работа», а не пустой экран: «Синхронизируем…» висит,
  // пока результат (успех/ошибка) не придёт ему на смену.
  if(duration === 0) return;
  showToast._tm = setTimeout(()=>t.classList.remove('show'), duration || 1800);
}
/* Коррекция позиции подсказки [data-tt], чтобы не вылезала за края экрана. */
function fixTooltipPosition(el){
  if(!el) return;
  const r = el.getBoundingClientRect();
  const tipW = 160;
  const leftEdge = r.left + r.width/2 - tipW/2;
  const rightEdge = r.left + r.width/2 + tipW/2;
  let shift = 0;
  if(leftEdge < 8) shift = 8 - leftEdge;
  else if(rightEdge > window.innerWidth - 8) shift = window.innerWidth - 8 - rightEdge;
  el.style.setProperty('--tt-shift', shift + 'px');
}
document.addEventListener('mouseover', e=>{
  const el = e.target.closest('[data-tt]');
  if(el) fixTooltipPosition(el);
});
document.addEventListener('touchstart', e=>{
  const el = e.target.closest('[data-tt]');
  if(el) fixTooltipPosition(el);
}, {passive:true});

/* ============ УНИВЕРСАЛЬНАЯ ОСТАНОВКА РЕЧИ (TTS) ============ */
// Все stopXxxSpeech() были идентичными обёртками над speechSynthesis.cancel()
// + снятием класса .speaking с hint-элемента. Теперь одна функция на всех.
// hintId — id элемента с подсказкой TTS (опционально).
function stopSpeech(hintId){
  if('speechSynthesis' in window) speechSynthesis.cancel();
  if(hintId){
    const hint = document.getElementById(hintId);
    if(hint) hint.classList.remove('speaking');
  }
}

/* ============ УНИВЕРСАЛЬНАЯ ОСТАНОВКА ИНТЕРВАЛОВ ============ */
// Все stopXxxInterval() — однотипные обёртки над clearInterval(id) с обнулением
// переменной. Чтобы не дублировать, локальные алиасы просто вызывают эту
// функцию, передавая СВОЮ переменную по ссылке через обёртку-объект (просто
// через прямое обращение — у нас всё равно идёт через `state`-style структуру).
// Использование:
//   function stopQuizInterval(){ stopInterval(quizIntervalId); quizIntervalId = null; }
// или, если хочется ещё короче, заводится локальный хелпер через замыкание,
// но это лишний слой — простой алиас в одну строку (на 2 строки короче оригинала).
function stopInterval(id){
  if(id){ clearInterval(id); return null; }
  return null;
}

/* ============ УНИВЕРСАЛЬНОЕ ПОКАЗАТЬ / СКРЫТЬ МОДАЛКУ ============ */
// Самый частый паттерн в проекте (~200 вхождений в 37 файлах):
//   showModal('xxxModal');   // открыть
//   hideModal('xxxModal'); // закрыть
// Теперь одна строка в обе стороны.
function showModal(id){
  const m = document.getElementById(id);
  if(m) m.classList.add('show');
}
function hideModal(id){
  const m = document.getElementById(id);
  if(m) m.classList.remove('show');
}

// Гарантирует, что активен только #setup — чинит «экран, поделённый на 2 части».
// Вынесена в глобальную область, чтобы вызов из обработчика resumeBtn (строка ~1347)
// видел функцию. function declaration поднимается (hoisting) в начало области видимости.
function ensureSingleActiveScreen(){
  const screens = document.querySelectorAll('.screen.active');
  if(screens.length <= 1) return false;
  const setup = document.getElementById('setup');
  screens.forEach(s=>{ if(s !== setup) s.classList.remove('active'); });
  if(setup && !setup.classList.contains('active')) setup.classList.add('active');
  window.scrollTo(0, 0);
  return true;
}

/* ============ УНИВЕРСАЛЬНОЕ ПОДКЛЮЧЕНИЕ RULES-МОДАЛКИ ============ */
// Каждая игра дублировала 2 строки:
//   closeXxxRulesBtn.click -> hideModal('xxxRulesModal')
//   xxxRulesModal.click (backdrop) -> hideModal('xxxRulesModal')
// Теперь одна функция: setupRulesModal(modalId, closeBtnId)
function setupRulesModal(modalId, closeBtnId){
  const closeBtn = document.getElementById(closeBtnId);
  if(closeBtn) closeBtn.addEventListener('click', ()=>{ hideModal(modalId); });
  const modal = document.getElementById(modalId);
  if(modal) modal.addEventListener('click', (e)=>{ if(e.target.id === modalId) hideModal(modalId); });
}

// Открытие RulesModal по кнопке (с защитой от отсутствующего элемента).
// Заменяет длинную конструкцию: (document.getElementById('xxx')||{...}).addEventListener(...)
function openRulesModal(openBtnId, modalId){
  const btn = document.getElementById(openBtnId);
  if(btn) btn.addEventListener('click', ()=>{ showModal(modalId); });
}

/* ============ УНИВЕРСАЛЬНЫЙ ПРОГРЕСС-БАР (таймер) ============ */
// updateKkrBar / updateKrBar / updateMtBar / updateTwisterBar —
// все делают одно и то же: ширина fill + текст label (MM:SS или SS).
function updateProgressBar(fillId, labelId, remaining, total, showMinutes){
  const fill = document.getElementById(fillId);
  const label = document.getElementById(labelId);
  if(!fill || !label) return;
  const pct = total > 0 ? Math.round((remaining / total) * 100) : 0;
  fill.style.width = pct + '%';
  if(showMinutes){
    const mm = String(Math.floor(remaining / 60)).padStart(2,'0');
    const ss = String(remaining % 60).padStart(2,'0');
    label.textContent = mm + ':' + ss;
  } else {
    label.textContent = '00:' + String(remaining).padStart(2,'0');
  }
}

/* ============ УНИВЕРСАЛЬНЫЕ ПЕРЕХОДЫ МЕЖДУ ЭКРАНАМИ ============ */
// Раньше каждая игра дублировала пары:
//   document.getElementById('XxxSetup').classList.remove('active');
//   document.getElementById('XxxGame').classList.add('active');
// и обратную (exitXxxGame). Теперь оба перехода — одна строка.
function goToGame(setupId, gameId, beforeSwitch){
  // Откуда игрок запускает партию — читаем ДО гашения экранов: это решает,
  // куда вернёт выход (см. «КОНТЕКСТ ЗАПУСКА ПАРТИИ»). Игры со своим экраном
  // настройки доходят сюда с него — там точку входа уже записал
  // goToGameSetup(). А если партия стартовала из плитки раздела или из
  // подменю хаба, то «на шаг назад» — это сам хаб с текущим разделом: иначе
  // игрок попадёт в меню игры, которую он играл РАНЬШЕ.
  const launchOrigin = screenSeenActive;
  if(beforeSwitch) beforeSwitch();
  // Гарантируем единственный активный экран: убираем active со всех текущих
  // экранов (включая #setup и подменю вроде #kidsBoardGamesMenu), затем
  // включаем только целевой игровой экран. setupId больше не нужен для
  // точечного снятия, но сигнатура сохранена ради совместимости.
  // ВАЖНО: точку входа здесь НЕ перезаписываем. Игрок уже стоит на экране
  // настройки игры, а сама игра — это то, куда он уходит; запоминать нужно
  // именно покидаемый экран настройки (это сделал goToGameSetup). Иначе выход
  // возвращал бы игрока в саму игру, из которой он только что вышел.
  document.querySelectorAll('.screen.active').forEach(el=>el.classList.remove('active'));
  const game = document.getElementById(gameId);
  if(game) game.classList.add('active');
  // Старт из хаба (плитка раздела или подменю) — точкой входа становится хаб с
  // текущим разделом. Проверка стоит ПОСЛЕ включения игрового экрана, поэтому
  // rememberReturnScreen уже не может быть перетёрт перерисовкой разделов.
  // «Продолжить игру» (resumingPausedSession) — исключение: это возврат в уже
  // начатую партию, и выход из неё должен вести в меню самой игры.
  if(launchedFromHubMenu(launchOrigin) && !resumingPausedSession){
    rememberReturnScreen('setup', getCurrentSetupView());
  }
  noteVisibleScreen(gameId);
  // Чужую паузу снимаем ЗДЕСЬ, а не в каждом обработчике меню по отдельности.
  // Раньше сброс pausedMode/inProgress был «размазан» по кнопкам хаба: где-то
  // его продублировали (gameWrBtn), где-то забыли (gameIdeasBtn) — и после
  // запуска игры без паузы поверх паузы «Фантов» игрок при выходе попадал в
  // чужое меню «Пауза — 💘 Фанты» с заблокированными настройками. Все запуски
  // партий идут через эту функцию, поэтому здесь сброс гарантирован.
  // При этом:
  //   * своя пауза (pausedMode совпадает с режимом этой игры) сохраняется —
  //     иначе ломается «Продолжить игру» из хаба для игр без resume-ветки;
  //   * игры, которые не ходят сюда (Экран #game: «Фанты», видеорежимы),
  //     по-прежнему сбрасывают паузу сами — у них своя логика экрана.
  let ownMode = null;
  try{
    const g = (typeof gameByScreen === 'function') ? gameByScreen(gameId) : null;
    ownMode = g ? g.mode : null;
  }catch(e){ /* реестр не должен ломать переход */ }
  if(state.pausedMode && state.pausedMode !== ownMode) state.pausedMode = null;
  if(!state.inProgress) state.inProgress = true;
  const pauseModalEl = document.getElementById('pauseMenuModal');
  if(pauseModalEl && pauseModalEl.classList.contains('show')) pauseModalEl.classList.remove('show');
  if(typeof updateResumeUI === 'function') updateResumeUI();
  if(typeof updateSettingsLockUI === 'function') updateSettingsLockUI();
  // Статистика: отмечаем начало партии. Ключ игры берём из реестра по
  // экрану — так счётчик не зависит от того, кто вызвал переход.
  try{
    const g = (typeof gameByScreen === 'function') ? gameByScreen(gameId) : null;
    if(g && window.AppStats) window.AppStats.gameStart(g.mode);
  }catch(e){ /* статистика не должна ломать переход между экранами */ }
}
function exitGame(gameId, setupId){
  const game = document.getElementById(gameId);
  if(game) game.classList.remove('active');
  // Убираем active со всех оставшихся экранов — иначе по дороге назад могут
  // остаться висеть подменю (например, после выхода из «Морского боя» у детей
  // оставался активным #kidsBoardGamesMenu) и экраны наложатся друг на друга.
  document.querySelectorAll('.screen.active').forEach(el=>el.classList.remove('active'));
  // Возврат «откуда пришёл»: если игрок запускал партию со своего экрана
  // настройки, ведём его туда, а не в общий хаб #setup. Параметр setupId
  // остаётся запасным путём для случаев, когда точку входа запомнить не
  // удалось (например, прямой вызов без прохода через goToGame()).
  // Партия прервана — снимаем ОБА связанных флага вместе (правило из
  // AGENTS.md): забытый inProgress блокирует настройки в хабе, забытый
  // pausedMode оставляет висеть чужое меню «Пауза». Раньше этим занималась
  // каждая игра по отдельности, и в восьми из них сброс был пропущен.
  state.inProgress = false;
  state.pausedMode = null;
  state.lastSectionOnPause = null;
  saveState();
  const pauseModalEl = document.getElementById('pauseMenuModal');
  if(pauseModalEl) pauseModalEl.classList.remove('show');
  const resumed = (typeof returnToEntryScreen === 'function') && returnToEntryScreen();
  if(!resumed){
    const setup = document.getElementById(setupId || 'setup');
    if(setup){
      setup.classList.add('active');
      noteVisibleScreen(setupId || 'setup');
    }
  }
  if(typeof updateResumeUI === 'function') updateResumeUI();
  // Останавливаем все звуки (Web Audio API + SpeechSynthesis)
  stopAllSounds();
  // Статистика: партия прервана. Если игра вообще не начиналась (выход из
  // настройки), считаем это выходом «из настройки» — он не означает, что
  // игра не понравилась.
  try{
    if(window.AppStats){
      window.AppStats.gameExit(state.inProgress ? 'midgame' : 'setup');
    }
  }catch(e){}
}
// Правило для «Только избранное»: либо 10+ карточек на двоих, либо минимум по 5 карточек,
// доступных каждому партнёру отдельно (общая карточка засчитывается обоим).
function favoritesEligibility(){
  const all = getAllCards();
  const favs = (state.favoriteIndexes||[]).map(i=>all[i]).filter(Boolean);
  const total = favs.length;
  const forM = favs.filter(c=>!c.for || c.for==='M').length;
  const forF = favs.filter(c=>!c.for || c.for==='F').length;
  const ok = total>=10 || (forM>=5 && forF>=5);
  return { ok, total, forM, forF };
}
function levelById(id){ return LEVELS.find(l=>l.id===id); }

/* ============ WAKE LOCK (экран не гаснет во время игры) ============ */
let wakeLock = null;
async function requestWakeLock(){
  try{
    if('wakeLock' in navigator){
      wakeLock = await navigator.wakeLock.request('screen');
    }
  }catch(e){ /* недоступно — просто игнорируем */ }
}
function releaseWakeLockNow(){
  if(wakeLock){
    try{ wakeLock.release(); }catch(e){}
    wakeLock = null;
  }
}
document.addEventListener('visibilitychange', ()=>{
  const gameScreen = document.getElementById('game');
  if(document.visibilityState === 'visible' && gameScreen && gameScreen.classList.contains('active')){
    requestWakeLock();
  }
});

/* ============ SETUP SCREEN ============ */
function renderLevelToggles(){
  const wrap = document.getElementById('levelToggles');
  wrap.innerHTML = '';
  LEVELS.forEach(l=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + (state.activeLevels.includes(l.id) ? ' on' : '');
    div.dataset.id = l.id;
    div.innerHTML = `
      <div class="lname">${l.icon} ${l.name}</div>
      <div class="ldesc">${l.desc}</div>
      <div class="level-check"></div>
    `;
    div.addEventListener('click', ()=>{
      const id = l.id;
      const idx = state.activeLevels.indexOf(id);
      if(idx>=0){
        if(state.activeLevels.length>1) state.activeLevels.splice(idx,1);
        else showToast('Нужен хотя бы один уровень');
      } else {
        state.activeLevels.push(id);
      }
      renderLevelToggles();
    });
    wrap.appendChild(div);
  });
}

function renderStarterGroup(){
  document.querySelectorAll('#starterGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', btn.dataset.value === state.starter);
  });
}
document.querySelectorAll('#starterGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.starter = btn.dataset.value;
    renderStarterGroup();
  });
});

function renderModeGroup(){
  document.querySelectorAll('#modeGroup .mode-btn').forEach(btn=>{
    btn.classList.toggle('on', btn.dataset.value === state.gameMode);
  });
}
document.querySelectorAll('#modeGroup .mode-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.gameMode = btn.dataset.value;
    if(state.gameMode === 'romantic') state.activeLevels = [1,2,3,4];
    else if(state.gameMode === 'hot') state.activeLevels = [3,4,5,6];
    else if(state.gameMode === 'custom') state.activeLevels = [];
    renderModeGroup();
    renderLevelToggles();
  });
});
document.querySelectorAll('#gameTypeGroup .game-type-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.gameType = btn.dataset.value;
    document.querySelectorAll('#gameTypeGroup .game-type-btn').forEach(b=>{
      b.classList.toggle('active', b === btn);
    });
  });
});

function updateStarterLabels(){
  const n1 = document.getElementById('name1');
  const n2 = document.getElementById('name2');
  const label1 = (n1.value.trim() || n1.placeholder || 'М');
  const label2 = (n2.value.trim() || n2.placeholder || 'Ж');
  document.querySelector('#starterGroup .starter-btn[data-value="M"]').textContent = label1;
  document.querySelector('#starterGroup .starter-btn[data-value="F"]').textContent = label2;
}
document.getElementById('name1').addEventListener('input', updateStarterLabels);
document.getElementById('name2').addEventListener('input', updateStarterLabels);

document.getElementById('startBtn').addEventListener('click', ()=>{
  if(state.gameMode === 'custom' && state.activeLevels.length === 0){
    playErrorSound();
    showToast('Выберите хотя бы один уровень');
    return;
  }
  const n1raw = document.getElementById('name1').value.trim();
  const n2raw = document.getElementById('name2').value.trim();
  if((n1raw && n1raw.length<2) || (n2raw && n2raw.length<2)){
    playErrorSound();
    showToast('Имя должно быть не короче 2 символов');
    return;
  }
  if(state.favoritesOnly){
    const elig = favoritesEligibility();
    if(!elig.ok){
      playErrorSound();
      showToast(`Добавьте больше карточек: М добавлено ${elig.forM}, Ж добавлено ${elig.forF}`, 2000);
      return;
    }
  }
  playSuccessSound();
  state.name1 = n1raw || 'Парень';
  state.name2 = n2raw || 'Девушка';
  state.currentPlayer = pickStartingPlayer();
  state.score1 = 0; state.score2 = 0;
  state.autoMilestone = 0;
  state.turnsPlayed = 0; state.turnsAtLastLevelUp = 0;
  state.levelTurnCounts = {1:0, 2:0}; state.pendingLevelUp = false;
  state.completedCount = 0; state.skippedCount = 0;
  state.levelCap = getSortedActiveLevels()[0];
  state.inProgress = true;
  saveState();
  resumeFantyGame();
});
document.getElementById('videoExtraToggle').addEventListener('click', ()=>{
  document.querySelector('.controls').classList.toggle('video-extra-open');
});
function blockedByDavayPause(){
  if(!state.pausedMode) return false;
  // Если пользователь уже в меню настроек (#setup активно) — сбрасываем
  // зависший pausedMode и разрешаем вход. Это защита от бага, когда после
  // выхода из игры pausedMode остаётся установленным и блокирует вход.
  const setupEl = document.getElementById('setup');
  if(setupEl && setupEl.classList.contains('active')){
    state.pausedMode = null;
    state.inProgress = false;
    updateResumeUI();
    return false;
  }
  playErrorSound();
  const label = gameTitle(state.pausedMode);
  showToast(`Сначала завершите ${label} — «Продолжить игру» или «Закончить игру»`);
  return true;
}
// Универсальная функция сброса паузы. Вызывается напрямую с ключом игры:
// abandonPausedSession('krokodil') и т.д. Раньше на каждую игру существовала
// ещё и функция-обёртка вида abandonPausedKrokodilSession(), но все они
// дублировали одну строку и нигде не вызывались — удалены при чистке.
function abandonPausedSession(key){
  if(state.pausedMode === key) state.pausedMode = null;
}
// Единственная обёртка, которая реально используется: запуск другой игры
// из меню должен снять «чужую» паузу базовых «Фантов» (через pauseGame()).
function abandonPausedFantySession(){ abandonPausedSession('fanty'); }
document.getElementById('gameFantyBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToFantySetup();
});
document.getElementById('gameDavayBtn').addEventListener('click', ()=>{
  playSuccessSound();
  goToDavaySetup();
});
document.getElementById('gamePhotoBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToPhotoSetup();
});
// "Викторина" пока не сделана — по одной временной заглушке в каждом из
// трёх разделов (Игры для пар 18+ / Игры для компании / Игры с детьми),
// тот же приём, что раньше был у gameKidsStub2Btn.
document.getElementById('gameQuizBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToQuizSetup();
});
document.getElementById('gameIdeasBtn').addEventListener('click', ()=>{
  // Сброс чужой паузы делает сам goToGame() — здесь только проверка
  // «сначала завершите прошлую партию» и переход.
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToIdeasGame();
});
document.getElementById('gameWrBtn').addEventListener('click', ()=>{
  state.pausedMode = null;
  state.inProgress = false;
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToWrSetup();
});
document.getElementById('gameBingoBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToBingoGame();
});
document.getElementById('gameTimerBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToTimerSetup();
});
document.getElementById('gameKrokodilBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToKrokodilSetup();
});
document.getElementById('gameMemesBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToMemesSetup();
});
document.getElementById('gamePartyFantsBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToPartyFantsSetup();
});
document.getElementById('gamePartyTdBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToPartyTdSetup();
});
document.getElementById('gameFamZnayuBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToFamZnayuSetup();
});
document.getElementById('gameLuckyBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToLuckySetup();
});
document.getElementById('gamePartyQuizBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToPartyQuizSetup();
});
document.getElementById('gameTwisterBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToTwisterGame();
});
// "Виселица" (игры для одного) — goToPartyHangmanGame() определена в games/party-hangman.js.
document.getElementById('gamePartyHangmanBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToPartyHangmanGame();
});
// "Викторина" (игры для одного) — goToSoloQuizSetup() определена в games/solo-quiz.js.
document.getElementById('gameSoloQuizBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToSoloQuizSetup();
});
// "Мемори" (игры для одного) — goToSoloMemorySetup() определена в games/solo-memory.js.
document.getElementById('gameSoloMemoryBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToSoloMemorySetup();
});
// "Крестики нолики" (игры для одного, против бота) — goToSoloXoSetup() определена в games/solo-xo.js.
document.getElementById('gameSoloXoBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToSoloXoSetup();
});
// "Рулетка" (компания) — goToPartyRouletteGame() определена в games/party-roulette.js.
document.getElementById('gamePartyRouletteBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToPartyRouletteGame();
});
// "Я никогда не" (компания) — goToPartyNeverSetup() определена в games/party-never.js.
document.getElementById('gamePartyNeverBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToPartyNeverSetup();
});
document.getElementById('gameWishlistBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToWishlistSetup();
});
document.getElementById('gameZnayuBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToZnayuSetup();
});
function goToFantySetup(){
  goToGameSetup('fantySetup', null, ()=>{
    updateResumeUI();
  });
}
document.getElementById('fantyExitBtn').addEventListener('click', ()=>{
  document.getElementById('fantySetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
});

document.getElementById('resumeBtn').addEventListener('click', ()=>{
  // Продолжение партии: функция берётся из реестра игр (games/game-registry.js).
  // Раньше здесь было 26 веток «если pausedMode === X, вызови resumeX()» —
  // при добавлении игры ветку легко было забыть. Теперь достаточно записи
  // в реестре. См. историю бага «Закончить игру не работала у 4 игр».
  const game = gameByMode(state.pausedMode);
  // Помечаем, что это продолжение партии: goToGame() внутри resume-функции не
  // должен переписывать точку входа на хаб (см. «КОНТЕКСТ ЗАПУСКА ПАРТИИ»).
  resumingPausedSession = true;
  try{
    if(game && callGame(game.resume)){
      ensureSingleActiveScreen();
      return;
    }
    // Запасной путь: у «Фантов» продолжение идёт через общую механику карточек.
    resumeFantyGame();
  } finally {
    resumingPausedSession = false;
  }
});


/* ============ ОБНОВЛЕНИЕ ПРИЛОЖЕНИЯ ============
   В установленной PWA (иконка на домашнем экране) нет адресной строки и
   кнопки «Обновить», поэтому обновление запускается только отсюда.
   Единственный видимый игроку вход — кнопка «Обновить» на плашке
   #updateToast, которую Service Worker показывает сам, когда нашёл новую
   версию (см. блок регистрации в index.html). Пункт «🔄 Обновить приложение»
   из меню «☰» убран: он дублировал эту автоматику. Служебная #updateAppBtn
   в скрытом блоке осталась запасным путём (обработчик ниже).

   Почему офлайн — особый случай. Обычный сценарий: снимаем Service Worker,
   стираем кэши, перезагружаем страницу по уникальному адресу — браузер
   обязан сходить в сеть и получить свежие файлы. Но если в этот момент нет
   интернета, перезагрузка уходит «в пустоту»: кэш уже удалён, и приложение
   не откроется вовсе. Поэтому без сети НИЧЕГО не трогаем и честно говорим
   об этом — старый кэш лучше, чем неработающее приложение.

   Индикация. Игрок жмёт «Обновить» — интерфейс сразу перекрывает экран
   #updateSplash (спиннер + «Обновляю приложение…»): мгновенный отклик,
   случайные нажатия по «полуживым» кнопкам исключены. После перезагрузки
   тот же экран остаётся виден (флаг в sessionStorage), пока init.js не
   закончит загрузку, — вместо «кнопки есть, но не работают». */
async function hardUpdateApp(){
  // navigator.onLine === false — достоверный признак отсутствия сети.
  // Значение true ничего не гарантирует, но в этом случае обычный сценарий
  // безопасен: если сеть на самом деле отвалилась, сработает .catch ниже.
  if(navigator.onLine === false){
    showToast('Нет интернета — обновление возможно только онлайн');
    return;
  }
  // Экран обновления показываем ДО любых сетевых действий: на медленной сети
  // unregister+delete занимают заметное время, и без сплеша страница выглядит
  // «зависшей», а кнопки — сломанными.
  const splash = document.getElementById('updateSplash');
  if(splash){
    splash.hidden = false;
    const prog = document.getElementById('updateSplashProgress');
    if(prog) prog.textContent = 'Готовим обновление…';
  }
  try{
    if('caches' in window){
      const keys = await caches.keys();
      await Promise.all(keys.map(k=>caches.delete(k)));
    }
    // Service Worker снимается после чистки кэшей: у нового воркера не будет
    // ни одного препятствия взять управление страницей сразу (clients.claim),
    // и загрузка свежих файлов начнётся с первой же перезагрузки.
    if('serviceWorker' in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.unregister()));
    }
    // Флаг читают: инлайновый скрипт в index.html (показ сплеша сразу,
    // до загрузки скриптов) и games/init.js (тост «Обновлено до последней версии»).
    sessionStorage.setItem('appJustUpdated', '1');
  }catch(e){
    if(splash) splash.hidden = true;
    showToast('Не удалось обновить — попробуйте ещё раз');
    return;
  }
  // Параметр _r=… делает адрес уникальным: так браузер гарантированно
  // обходит кэш навигации. Служебный параметр убирает init.js после загрузки.
  const url = new URL(location.href);
  url.searchParams.set('_r', Date.now());
  location.replace(url.toString());
}
// Служебная кнопка в скрытом блоке (исторически использовалась для ручного
// обновления при отладке). Обработчик висит с проверкой на существование:
// элемент есть в разметке, но приложение не должно падать, если его уберут.
const __updateAppBtnEl = document.getElementById('updateAppBtn');
if(__updateAppBtnEl){
  __updateAppBtnEl.addEventListener('click', ()=>hardUpdateApp());
}

/* ============ ПОДТВЕРЖДЕНИЕ СБРОСА ПРОГРЕССА ============
   Кастомная модалка #resetConfirmModal вместо нативного confirm():
   нативный диалог в PWA-обёртке не помещается на экран, а модалка
   использует общие стили .modal-overlay/.modal-card (max-width 360px,
   max-height 80vh, скролл при нехватке места). Показываем компактный
   текст и две кнопки; возвращаем Promise<boolean>. */
let __resetConfirmResolve = null;
function showResetConfirm(title, text){
  return new Promise(resolve=>{
    const modal = document.getElementById('resetConfirmModal');
    if(!modal){ resolve(true); return; } // модалки нет — ведём себя как старый confirm(true)
    // Заголовок и текст можно переопределить — используется для подтверждения
    // очистки статистики. Без параметров модалка остаётся прежней.
    const titleEl = modal.querySelector('.modal-title');
    const textEl = modal.querySelector('.reset-confirm-lead');
    if(titleEl) titleEl.textContent = title || '⚠️ Сбросить весь прогресс?';
    if(textEl) textEl.textContent = text || 'Сотрётся безвозвратно:';
    __resetConfirmResolve = resolve;
    modal.classList.add('show');
  });
}
function __closeResetConfirm(result){
  const modal = document.getElementById('resetConfirmModal');
  if(modal) modal.classList.remove('show');
  if(typeof __resetConfirmResolve === 'function'){
    const r = __resetConfirmResolve;
    __resetConfirmResolve = null;
    r(result);
  }
}
const __rcModal = document.getElementById('resetConfirmModal');
if(__rcModal){
  const __rcOk = document.getElementById('resetConfirmOk');
  const __rcCancel = document.getElementById('resetConfirmCancel');
  if(__rcOk) __rcOk.addEventListener('click', ()=>__closeResetConfirm(true));
  if(__rcCancel) __rcCancel.addEventListener('click', ()=>__closeResetConfirm(false));
  // Закрытие по фону или по крестику — считаем отказом
  __rcModal.addEventListener('click', e=>{
    if(e.target === __rcModal || (e.target.classList && e.target.classList.contains('modal-close-btn'))){
      __closeResetConfirm(false);
    }
  });
}

document.getElementById('resetHiddenBtn').addEventListener('click', async ()=>{
  // Необратимое действие сразу по всем играм — подтверждение защищает от
  // случайного тапа (аналогично подтверждению при импорте бэкапа).
  if(!(await showResetConfirm())){
    return;
  }
  performFullReset();
});

// Единая логика полного сброса прогресса во всех играх: используется и из
// страницы настроек (#resetHiddenBtn), и из плавающего меню (#menuResetBtn),
// чтобы текст модалки подтверждения всегда соответствовал реальности.
function performFullReset(){
   // Версия схемы остаётся текущей: сбрасываем данные, а не формат.
   // Если поставить 0, при следующей загрузке миграции пройдут заново и
   // могут вернуть значения, которые игрок только что сбросил.
   state.schemaVersion = SCHEMA_VERSION;
   // Обычная игра (карточки)
   state.hiddenIndexes = [];
   state.usedIndexes = [];
   // Имена игроков (команд) — сбрасываются на дефолтные, как обещано в диалоге
   // подтверждения ("имена команд… будут сброшены").
   state.kidsPlayers = ['Родитель','Ребёнок'];
   state.businessPlayers = [businessDefaultName(0), businessDefaultName(1)];
   state.partyPlayers = [partyDefaultName(0), partyDefaultName(1)];
   state.name1 = 'Парень';
   state.name2 = 'Девушка';
   // Настройки звука — к дефолтам. muted (общий выключатель звука) сознательно
   // НЕ трогаем: это настройка устройства, а не прогресс партии, и «внезапно
   // зазвучало» после сброса — неприятный сюрприз.
   state.autoSpeak = true;
   state.gameMode = 'hot';
   state.activeLevels = [3,4,5,6];
   state.levelCap = 3;
   state.autoMilestone = 0;
   state.turnsAtLastLevelUp = 0;
   state.starter = 'random';
   state.favoritesOnly = false;
   state.favoriteIndexes = [];
   // Прогресс внутри партии «Фантов»: чей ход и сколько ходов набрано на
   // текущем уровне. Без этого после сброса партия продолжалась бы с
   // накопленным счётчиком повышения уровня (state.levelCap) прошлой игры.
   state.currentPlayer = 1;
   state.levelTurnCounts = {1:0, 2:0};
   state.pendingLevelUp = false;
   state.turnsPlayed = 0;
   state.completedCount = 0;
   state.skippedCount = 0;
   state.score1 = 0;
   state.score2 = 0;
   state.gameType = 'fanty';
   state.photoOrderMode = false;
   state.tdSelectedLevel = 3;
   state.bingoSelectedLevel = 1;
   state.timerSelectedLevel = 1;
   state.timerLevelUpCadence = 5;
   state.timerCurrentPlayer = 1;
   state.wishlistStarter = 'random';
   state.znayuStarter = 'random';
   state.krokodilSelectedLevel = 2;
   state.krokodilMode = 'word';
   state.kidsMemoryLevel = 1;
   state.memesSelectedLevel = 2;
   state.partyFantsSelectedLevel = 2;
   state.partyTdSelectedLevel = 2;
   state.famZnayuFamilyCount = 1;
   state.famZnayuFamilies = [{p1:'Первый', p2:'Второй', p1Gender:'m', p2Gender:'f'}];
   state.famZnayuSelectedLevel = 1;
   state.quizSelectedLevel = 1;
   state.quizAutoSpeak = false;
   state.partyQuizSelectedLevel = 1;
   state.partyQuizAutoSpeak = false;
   state.kidsQuizAnswerSeconds = 15;
   state.kidsQuizAutoSpeak = false;
   state.soloQuizSelectedLevel = 1;
   state.soloQuizAutoSpeak = false;
   state.sexQuestCount = 5;
   state.sexQuestMode = 'random';
   state.sexQuestPlayMode = 'smooth';
   state.sexQuestManualIds = [];
   state.sexQuestExcluded = [];
   state.passionMapCount = 1;
   state.passionMapMode = 'random';
   state.passionMapManualIds = [];
   state.passionMapExcluded = [];
   state.bizObsQuestionCount = 5;
   state.bizObsCurrentPlayerIndex = 0;
   state.kidsKrokodilMode = 'word';
   state.kidsKrokodilRoundSeconds = 180;
   state.kidsKrokodilWordsPerRound = 5;
   state.kidsKrokodilRoundsPerPlayer = 5;
   state.flashMode = 'learn';
   state.flashTheme = 'english';
   state.flashTimeSub = 'digital';
   state.flashCount = 25;
   state.flashAutoSpeak = true;
   state.flashTimePool = [];
   state.flashTimeIndex = 0;
   state.flashTimeScore = 0;
   state.flashTimeErrors = 0;
   state.flashTimeCount = 10;
   state.flagsSelectedLevel = 1;
   state.flagsAnswerSeconds = 10;
   state.flagsQuestionCount = 10;
   state.flagsUsed = {};
   state.flagsQueue = [];
   state.flagsIndex = 0;
   state.flagsCorrect = 0;
   state.flagsTimeMs = 0;
   state.capitalsSelectedLevel = 1;
   state.capitalsAnswerSeconds = 10;
   state.capitalsQuestionCount = 10;
   state.capitalsUsed = {};
   state.capitalsQueue = [];
   state.capitalsIndex = 0;
   state.capitalsCorrect = 0;
   state.capitalsTimeMs = 0;
   state.timesTableTopic = 'multiply';
   state.timesTableSelectedLevel = 1;
   state.timesTableAnswerSeconds = 5;
   state.timesTableQuestionCount = 10;
   state.timesTableUsed = {};
   state.timesTableQueue = [];
   state.timesTableIndex = 0;
   state.timesTableCorrect = 0;
   state.timesTableTimeMs = 0;
   state.shopMode = 'buyer';
   state.shopHintVisible = true;
   state.kidsTdCompleted = [];
   state.kidsTdSkipped = [];
   state.kidsTdCurrentPlayerIndex = 0;
   state.kidsTdCurrentType = null;
   state.kidsXoBoardSize = 3;
   state.soloXoBoardSize = 3;
   // Свои добавленные задания, «Понравившиеся» (избранное) и загруженные
   // пользователем видео НЕ трогаем — см. диалог подтверждения.
   // Предложи партнеру (фото)
   state.photoUsed = {};
   state.photoHidden = [];
   state.photoDone = [];
   state.sexshopOwned = [];
  // Видеорулетка
  state.videoUsed = {};
  state.videoHidden = [];
  state.videoLiked = [];
  state.videoFavoritesOnly = false;
  state.videoAutoAdvance = false;
  // Давай попробуем
  state.davayUsed = {};
  state.davayHidden = [];
  state.davayFavoritesOnly = false;
  state.davayAutoAdvance = false;
  state.davayFavYes = [];
  state.davayFavLater = [];
  state.davayFavNo = [];
  state.davayLiked = [];
  state.davayQuizActivePlayer = 0;
  state.davayQuizQueue = [];
  state.davayQuizIndex = 0;
  state.davayQuizAnswers = {};
  state.davayQuizP1Done = false;
  state.davayQuizP2Done = false;
  state.davayQuizPendingNext = 0;
  document.getElementById('game').classList.remove('davay-handoff');
  state.davayStarter = 'random';
  state.davaySelectedLevel = 1;
  if(state.pausedMode === 'davay'){
    state.pausedMode = null;
    state.inProgress = false;
    currentDavayCard = null;
    davayHistory = [];
    davayHistoryPos = -1;
  }
  // Твои желания
  state.wishlistHidden = [];
  state.wishlistMatchHistory = [];
  state.wishlistQueue = []; state.wishlistIndex = 0; state.wishlistAnswers = {};
  state.wishlistActivePlayer = 0; state.wishlistP1Done = false; state.wishlistP2Done = false; state.wishlistPendingNext = 0;
  // Правда или действие
  state.tdUsed = {};
  state.tdHidden = [];
  state.tdScore1 = 0; state.tdScore2 = 0;
  state.tdCompletedCount = 0; state.tdSkippedCount = 0;
  state.tdLevelTurnCounts = {1:0, 2:0}; state.tdPendingLevelUp = false;
  // Секс-бинго
  state.bingoGrid = []; state.bingoChecked = []; state.bingoWonLines = []; state.bingoUsedBonus = [];
  state.bingoCurrentLevel = 1; state.bingoEscalatedTo2 = false; state.bingoEscalatedTo3 = false;
  state.bingoVictoryMilestones = []; state.bingoFinished = false; state.bingoBonusChecklist = [];
  state.bingoTasksHidden = true; state.bingoRevealed = [];
  // Таймер страсти
  state.timerUsed = {};
  state.timerScore1 = 0; state.timerScore2 = 0;
  state.timerCompletedCount = 0; state.timerSkippedCount = 0;
  state.timerLevelUpCounts = {1:0, 2:0}; state.timerPendingLevelUp = false;
  // Я знаю все ("Тайные ответы") — вопросы, скрытые кнопкой "Не хочу отвечать",
  // и история совпадений
  state.znayuHidden = [];
  state.znayuMatchHistory = [];
  state.znayuQueue = []; state.znayuIndex = 0; state.znayuAnswers = {};
  state.znayuActivePlayer = 0; state.znayuP1Done = false; state.znayuP2Done = false; state.znayuPendingNext = 0;
  // Крокодил
  state.krokodilUsed = {};
  state.krokodilScores = []; state.krokodilSkipCounts = []; state.krokodilTurnsPlayed = 0; state.krokodilCurrentPlayerIndex = 0;
  // Мемасики
  state.memesUsed = {};
  state.memesHidden = [];
  // "Я никогда не"
  state.partyNeverUsed = {};
  // Идеи для вас
  state.ideasUsed = [];
  // Секс-квест
  state.sexQuestQueue = [];
  state.sexQuestIndex = 0;
  state.sexQuestResults = [];
  state.sexQuestChecklists = [];
  // Карта страсти (независимая копия квеста)
  state.passionMapQueue = [];
  state.passionMapIndex = 0;
  state.passionMapScore = 0;
  state.passionMapResults = [];
  state.passionMapChecklists = [];
  // Карта страсти
  state.passionMapQueue = [];
  state.passionMapIndex = 0;
  state.passionMapScore = 0;
  state.passionMapResults = [];
  state.passionMapChecklists = [];
  // Во что поиграть? (дети)
  state.whatToPlayUsed = [];
  state.whatToPlayFavorites = [];
  state.whatToPlayFavView = false;
  // Крокодил (дети)
  state.kidsKrokodilUsed = {};
  state.kidsKrokodilScores = []; state.kidsKrokodilSkipCounts = [];
  state.kidsKrokodilCurrentPlayerIndex = 0; state.kidsKrokodilTurnsPlayed = 0;
  // Мемасики (дети)
  state.kidsMemesUsed = {};
  state.kidsMemesHidden = [];
  // Флеш карты (дети) — очередь текущей партии; настройки режима/темы/
  // количества карточек не трогаем, это сохранённые предпочтения.
  state.flashQueue = []; state.flashIndex = 0;
  state.bizObsQueue = []; state.bizObsIndex = 0; state.bizObsCorrect = [];
  // Сапёр (дети)
  state.kidsSaperGrid = []; state.kidsSaperChecked = []; state.kidsSaperFlags = [];
  state.kidsSaperWonLines = [];
  state.kidsSaperCurrentLevel = 1;
  state.kidsSaperEscalatedTo2 = false; state.kidsSaperEscalatedTo3 = false;
  state.kidsSaperFinished = false; state.kidsSaperBonusChecklist = [];
  state.kidsSaperTasksHidden = true;
  // Твистер — возвращаем время на ход к дефолту (10 сек)
  state.twisterDuration = 10;
  // Виселица (компания)
  state.partyHangmanWord = ''; state.partyHangmanGuessed = []; state.partyHangmanWrong = 0;
  state.partyHangmanUsedWords = []; state.partyHangmanWins = 0; state.partyHangmanLosses = 0;
    // Рулетка (компания) — сброс баланса всех игроков к стартовому
  state.rouletteBalances = []; state.rouletteCurrentPlayerIndex = 0;
  state.roulettePlayerBets = [];
  // Викторина (один)
  state.soloQuizUsed = {}; state.soloQuizQueue = []; state.soloQuizIndex = 0;
  state.soloQuizCorrect = 0; state.soloQuizTimeMs = 0;
  // Мемори (один)
  state.soloMemoryDeck = []; state.soloMemorySteps = 0; state.soloMemoryElapsedMs = 0;
  state.soloMemoryLeaderboard = []; state.soloMemoryLastName = '';
  // Лимонадный ларёк (бизнес)
  state.businessLemonadeDay = 1; state.businessLemonadeMoney = 200;
  state.businessLemonadeUpgrades = {sign:false, music:false, recipe:false, seller:false, secondStand:false};
  state.businessLemonadeWeatherKey = 'normal'; state.businessLemonadeEventIdx = -1;
  state.businessLemonadeLocation = null; state.businessLemonadeHours = null; state.businessLemonadeOptions = {};
  state.businessLemonadeLemonStock = 0; state.businessLemonadeLemonBoughtDay = null; state.businessLemonadeTeaStock = 0;
  state.businessLemonadeCompetitorPrice = null;
  state.businessLemonadeLoanOwed = 0; state.businessLemonadeLoanDueDay = null;
  state.businessLemonadeCups = 10; state.businessLemonadePrice = 40; state.businessLemonadeSold = 0;
  state.businessLemonadeTeaCups = 10; state.businessLemonadeTeaPrice = 10; state.businessLemonadeTeaStock = 0; state.businessLemonadeDrinkType = 'lemonade';
  state.businessLemonadeRevenue = 0; state.businessLemonadeNetProfit = 0; state.businessLemonadeDayProfits = [];
  state.businessLemonadeDayLog = [];
  state.businessLemonadeGoal = 5000; state.businessLemonadeGoalName = 'ролики';
  state.businessLemonadeQuizIndex = 0; state.businessLemonadeQuizCorrect = 0; state.businessLemonadeQuizItems = [];
  // Крестики нолики (дети)
  state.kidsXoBoard = []; state.kidsXoCurrentPlayer = 'X'; state.kidsXoRoundOver = false;
  state.kidsXoStartingPlayer = 'X'; state.kidsXoScoreX = 0; state.kidsXoScoreO = 0; state.kidsXoDraws = 0;
  // Крестики нолики (для одного)
  state.soloXoBoard = []; state.soloXoCurrentPlayer = 'X'; state.soloXoRoundOver = false;
  state.soloXoStartingPlayer = 'X'; state.soloXoScorePlayer = 0; state.soloXoScoreBot = 0; state.soloXoDraws = 0;
  // Морской бой (дети)
   state.battleshipBoards = []; state.battleshipCurrentPlayer = 0; state.battleshipWinner = null;
   state.battleshipShotsCount = [0,0];
   // Морской бой (одиночка, против бота)
   state.soloBsPlayerBoard = []; state.soloBsBotBoard = []; state.soloBsCurrentPlayer = 'player';
   state.soloBsWinner = null; state.soloBsShots = {player:0,bot:0};
  state.partyFantsUsed = {};
  state.partyFantsCompleted = []; state.partyFantsSkipped = []; state.partyFantsCurrentPlayerIndex = 0;
  // Правда/Действие (компания)
  state.partyTdUsed = {};
  state.partyTdCompleted = []; state.partyTdSkipped = []; state.partyTdCurrentPlayerIndex = 0; state.partyTdCurrentType = null;
  // Знаю тебя (компания, семьями)
  state.famZnayuUsed = {};
  state.famZnayuCurrentFamilyIndex = 0; state.famZnayuQueue = []; state.famZnayuIndex = 0;
  state.famZnayuAnswers = {}; state.famZnayuActivePlayer = 0; state.famZnayuHeroSide = [];
  state.famZnayuP1Done = false; state.famZnayuP2Done = false; state.famZnayuResults = [];
  state.famZnayuPendingNext = 0;
  // Счастливый билет (общее поле 5x5 на 2 команды)
  state.luckyUsed = {};
  state.luckyTeams = [{name:'Первая команда'},{name:'Вторая команда'}];
  state.luckyTeamTurnCount = [0,0];
  state.luckyGrid = []; state.luckyChecked = []; state.luckyCurrentTeamIndex = 0;
  state.luckyCompleted = []; state.luckyWonLines = []; state.luckyLevel = 1;
    state.luckyEscalatedTo2 = false; state.luckyEscalatedTo3 = false; state.luckyFinished = false;
  state.luckyTasksHidden = true; state.luckyRevealed = [];
  // Викторина (пары/компания/дети)
  state.quizUsed = {}; state.quizQueue = []; state.quizIndex = 0; state.quizCurrentPlayerIndex = 0;
  state.quizCorrect = []; state.quizTimeMs = [];
  state.partyQuizUsed = {}; state.partyQuizQueue = []; state.partyQuizIndex = 0; state.partyQuizCurrentPlayerIndex = 0;
  state.partyQuizCorrect = []; state.partyQuizTimeMs = [];
  state.kidsQuizUsed = {}; state.kidsQuizQueue = []; state.kidsQuizIndex = 0; state.kidsQuizCurrentPlayerIndex = 0;
  state.kidsQuizCorrect = []; state.kidsQuizTimeMs = [];
  // Рулетка желаний — сброс уровня на дефолтный (1 — Сближение)
  state.wrSelectedLevel = 1;
  state.wrScore1 = 0;
  state.wrScore2 = 0;
  state.wishCurrentCard = null;
  if(state.pausedMode === 'wishRoulette'){
    state.pausedMode = null;
    state.inProgress = false;
    wishWheelTotalRotation = 0;
    if(wishSpinTimer){ clearTimeout(wishSpinTimer); wishSpinTimer = null; }
    wishSpinning = false;
    wishCurrentCard = null;
  }
  // Сбрасываем и возможную «зависшую» паузу — если пользователь попал
  // в состояние, когда pausedMode выставлен, а выйти из него невозможно
  // (например, пропала модалка паузы), сброс прогресса вернёт управление.
  if(state.pausedMode){
    state.pausedMode = null;
    state.inProgress = false;
  }
  saveState();
  renderModeGroup();
  renderLevelToggles();
  renderStarterGroup();
  renderDavaySetupStarterGroup();
  renderDavaySetupLevels();
  if(typeof wrRenderSetupLevels === 'function') wrRenderSetupLevels();
  if(typeof drawWishWheel === 'function') drawWishWheel();
  updateFavoritesOnlyBtn();
  updateResumeUI();
  // Перерисовываем настройки остальных игр, которые сброшены выше: уровни,
  // режимы, состав семей, возраст ребёнка. Без этого state уже дефолтный, а
  // подсветка кнопок и поля ввода на экранах настроек показывают прежние
  // значения — игрок видит «сброшено не всё» и путается. Ссылки на функции
  // берём по имени строкой и проверяем через typeof: многие из них живут в
  // модулях игр, которые могут быть не подключены в index.html, а прямое
  // обращение к необъявленному имени упало бы с ReferenceError.
  [
    'renderKidsPlayers', 'renderBusinessPlayers', 'renderPartyPlayers',
    'renderKidsAgeGroup', 'renderKidsMemoryLevels',
    'renderTdSetupLevels', 'renderTimerSetupLevels', 'renderTimerLevelUpGroup',
    'renderMemesSetupLevels', 'renderKrokodilSetupLevels', 'renderKrokodilModeGroup',
    'renderPartyFantsSetupLevels', 'renderPartyTdSetupLevels', 'renderPartyNeverSetupLevels',
    'renderFamZnayuSetupLevels', 'renderFamZnayuFamilyCountGroup', 'renderFamZnayuFamiliesFields',
    'renderQuizSetupLevels', 'renderPartyQuizSetupLevels', 'renderSoloQuizSetupLevels',
    'renderQuizAnswerTimeGroup', 'renderQuizQuestionCountGroup',
    'renderPartyQuizAnswerTimeGroup', 'renderPartyQuizQuestionCountGroup',
    'renderSoloQuizAnswerTimeGroup', 'renderSoloQuizQuestionCountGroup',
    'renderKidsQuizAnswerTimeGroup', 'renderKidsQuizQuestionCountGroup',
    'renderShopModeGroup', 'renderPhotoSetupLevels',
    'renderSexQuestCountGroup', 'renderSexQuestModeGroup',
    'renderPassionMapCountGroup', 'renderPassionMapModeGroup',
    'renderBizObsQuestionCountGroup',
    'renderFlashModeGroup', 'renderFlashThemeGroup', 'renderFlashTimeSubGroup', 'renderFlashCountGroup',
    'renderKidsKrokodilModeGroup', 'renderKidsKrokodilDurationGroup', 'renderKidsKrokodilWordsCountGroup',
    'renderTimerDurationGroup', 'renderTimerModeGroup',
    'renderKrokodilDurationGroup', 'renderKrokodilWordsCountGroup',
    'renderTwisterDurationGroup',
    'renderWishlistSetupStarterGroup', 'renderZnayuSetupStarterGroup',
    'renderKidsXoSizeGroup', 'renderSoloXoSizeGroup', 'renderSoloMemoryLevels'
  ].forEach(fnName=>{
    const fn = window[fnName];
    if(typeof fn === 'function') fn();
  });
  clearAllVideoBlobs(); // архивное хранилище "Видеорулетки" — на всякий случай, обычно уже пусто после миграции
  clearErrorLog(); // журнал ошибок тоже чистим — сброс есть сброс
  clearAllDavayBlobs(); // общий каталог видео: чистится в IndexedDB, см. сброс ниже
  // Память о сбросе: clearAllDavayBlobs() завершается асинхронно, а «Вселенная»
  // игры узнаёт об очистке только из флагов в localStorage. Без этой отметки
  // каталог и «показанные» видео переживали сброс: игрок жал «Сбросить весь
  // прогресс», возвращался в игру — и видел свои прежние ролики.
  state.videoResetAt = Date.now();
  refreshDavayCatalogInMemory();
  // Закрываем все модальные окна (рулетка и другие)
  document.querySelectorAll('.modal.show, [class*="modal"].show, .show').forEach(el=>{
    if(el.classList.contains('modal') || el.querySelector('.modal-content')){
      el.classList.remove('show');
    }
  });
  // Закрываем модальные окна рулетки желаний явно
  const wrModal = document.getElementById('wrSpinModal');
  const wrSum = document.getElementById('wrSummaryModal');
  if(wrModal) wrModal.classList.remove('show');
  if(wrSum) wrSum.classList.remove('show');
  // Выход на главную страницу
  document.querySelectorAll('.screen.active').forEach(el=>el.classList.remove('active'));
  const setupEl = document.getElementById('setup');
  if(setupEl) setupEl.classList.add('active');
  if(typeof showSetupView === 'function') showSetupView('homeView');
  showToast('Прогресс и настройки сброшены. Свои задания в «Фантах» сохранены');
}

/* ============ ПОДБОР КАРТ ============ */
function getAllCards(){
  // Порядок важен: customCards идут сразу за CARDS (как и раньше), чтобы не сбить уже
  // сохранённые индексы usedIndexes/hiddenIndexes/favoriteIndexes. USER_CARDS — новые,
  // добавляются в конец и ни на что старое не влияют.
  const userCards = (typeof USER_CARDS !== 'undefined' && Array.isArray(USER_CARDS)) ? USER_CARDS : [];
  return CARDS.concat(state.customCards||[]).concat(userCards);
}
function scopeIndexes(forceLevel){
  const all = getAllCards();
  return all
    .map((c,i)=>i)
    .filter(i=>{
      const c = all[i];
      if(c.deleted) return false;
      if(state.favoritesOnly && !state.favoriteIndexes.includes(i)) return false;
      if(forceLevel) return c.level === forceLevel;
      return c.level === state.levelCap;
    });
}
function drawFromPool(forceLevel){
  const all = getAllCards();
  const gender = currentGender();
  const scope = scopeIndexes(forceLevel).filter(i=>!state.hiddenIndexes.includes(i));
  let pool = scope
    .map(i=>({...all[i], idx:i}))
    .filter(c => !c.for || c.for===gender)
    .filter(c => !state.usedIndexes.includes(c.idx));

  if(pool.length===0){
    // сбрасываем "использованные" только в рамках текущей области видимости (уровни + пол)
    const scopeSet = new Set(scope);
    state.usedIndexes = state.usedIndexes.filter(i=>!scopeSet.has(i));
    pool = scope
      .map(i=>({...all[i], idx:i}))
      .filter(c => !c.for || c.for===gender);
    if(pool.length>0) showToast('Колода перемешана заново 🔀');
  }
  if(pool.length===0) return null;
  return pool[Math.floor(Math.random()*pool.length)];
}

/* ============ GAME SCREEN ============ */
function resumeFantyGame(){
  abandonPausedSession('davay');
  abandonPausedSession('td');
  abandonPausedSession('bingo');
  abandonPausedSession('krokodil');
  abandonPausedSession('wishlist');
  abandonPausedSession('znayu');
  abandonPausedSession('timer');
  abandonPausedSession('partyFants');
  abandonPausedSession('partyTd');
  abandonPausedSession('famZnayu');
  abandonPausedSession('lucky');
  abandonPausedSession('kidsMemory');
  abandonPausedSession('kidsTd');
  abandonPausedSession('kidsC4');
  abandonPausedSession('fanty');
  abandonPausedSession('quiz');
  abandonPausedSession('partyQuiz');
  abandonPausedSession('kidsQuiz');
  abandonPausedSession('soloBs');
  abandonPausedSession('soloC4');
  abandonPausedSession('shop');
  abandonPausedSession('kidsSaper');
  // Своя пауза Фантов сбрасывается явно (не через abandonPausedFantySession
  // — это возврат в СВОЮ же игру после паузы, а не "чужая" сессия), и здесь
  // же нужно закрыть глобальную модалку паузы (см. правку с пропавшими
  // кнопками паузы у базовых "Фантов" — раньше модалка не была скрыта
  // при resume, потому что resumeFantyGame() не вызывал updateResumeUI()).
  state.pausedMode = null;
  state.inProgress = true;
  saveState();
  updateResumeUI();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('fantySetup').classList.remove('active');
  // Возврат в базовые «Фанты»: снимаем ЛЮБОЙ чужой режим экрана #game.
  setGameMode(null);
  document.getElementById('game').classList.add('active');
  document.getElementById('doneBtn').textContent = '💕 Готово';
  document.getElementById('pauseBtn').textContent = 'Пауза';
  updateTurnUI();
  updateLevelUI();
  updateMuteBtn();
  requestWakeLock();
  if(state.gameType === 'td'){
    /* В режиме Правда/Действие — пустая карточка с кнопками выбора, без вытягивания */
    renderTdChoiceCard();
  } else {
    drawCard();
  }
}
function isPlaceholderMode(){
  const el = document.getElementById('game');
  return !!(el && el.classList.contains('placeholder-mode'));
}
// Режимы экрана #game переключаются CSS-классами, и «свои» классы каждая
// игра снимала сама, а «чужие» — забывала. Из-за этого после паузы «Давай
// попробуем» базовые «Фанты» открывались с классом davay-mode: CSS рисовал
// чужой режим, а предикаты isDavayMode()/isPlaceholderMode() уводили кнопку
// «Выход» и стрелку «←» не туда. Теперь класс режима ставит ОДНА функция,
// и она же гарантированно снимает два остальных.
const GAME_MODE_CLASSES = ['video-mode','davay-mode','placeholder-mode'];
// Карточка #card лежит в разметке общей для четырёх игр и при первой загрузке
// страницы показывает нейтральное «Загрузка задания…» с иконкой игральной
// карты 🃏. В играх с видео это неверно: игрок видит чужую иконку, пока
// подтягивается каталог из IndexedDB (и вообще при каждом входе, потому что
// разметка не перерисовывается между заходами). Поэтому при включении режима
// сразу подставляем иконку и текст этой игры. У «Давай попробуем» и
// «Видеорулетки» иконка одна — 🎬, как в меню, заголовке и реестре игр
// (menuTitle), а не 🃏.
const GAME_MODE_LOADING_CARD = {
  'davay-mode': { icon: '🎬', text: 'Загрузка видео…' },
  'video-mode': { icon: '🎬', text: 'Загрузка видео…' },
};
function paintGameModeLoadingCard(mode){
  const info = GAME_MODE_LOADING_CARD[mode];
  if(!info) return;
  const icon = document.getElementById('cardLoadingIcon');
  const text = document.getElementById('cardLoadingText');
  if(icon) icon.textContent = info.icon;
  if(text) text.textContent = info.text;
}
/* ============ ПОДУРОВНИ ПАПОК ЯНДЕКС-ДИСКА («Level N-M …») ============
 * Папки на Диске называются «Level 1-1 Ласки разогрев», «Level 1-2 Ласки
 * легкие»…: первое число — игровой уровень (1..6), второе — подуровень.
 * По умолчанию обе видео-игры играют подуровни вперемешку (как раньше), а
 * кнопка «Горячее» шагает по ним по порядку: Level 1-1 → Level 1-2 → …, а
 * когда своих папок в уровне больше нет — на следующий уровень (Level 2-1).
 * Хелперы живут в core.js, потому что нужны обеим играм: «Видеорулетке»
 * (fants-video.js) и «Давай попробуем» (fants-davay.js). */
// Под уровень из yandexPath записи: 'disk:/Level 1-2 Ласки легкие/f.webm' → 2.
// Путь хранится у всех роликов Яндекса (см. importYandexVideos в fants-davay.js),
// у своих видео с телефона пути нет — они считаются подуровнем 0 (базовым).
function davaySubLevelFromPath(path){
  if(!path) return 0;
  const m = String(path).match(/\/Level\s+\d+-(\d+)(?:\s|\/|$)/i);
  return m ? (parseInt(m[1], 10) || 0) : 0;
}
// Подуровень конкретной карточки каталога.
function davayCardSubLevel(card){
  return davaySubLevelFromPath(card && card.yandexPath);
}
// Следующий подуровень с видео ВЫШЕ текущего в этом же уровне (0 — своих
// папок выше нет). Каталог один на обе игры, поэтому функция общая; текущий
// подуровень передаётся явно, потому что в момент вызова он ещё старый.
function nextDavaySubLevel(level, currentSub){
  let best = 0;
  getDavayCardsList().forEach(c=>{
    if(c.level !== level) return;
    const s = davayCardSubLevel(c);
    if(s > currentSub && (best === 0 || s < best)) best = s;
  });
  return best;
}
// Сменить уровень/подуровень активной видео-игры. Посреди раунда «Давай
// попробуем» (вопросы или карточка «Передайте телефон») уровень менять
// нельзя: очередь из 10 видео строится под уровень, и смена разорвала бы
// связь между ответами и карточками. Возвращает true, если переход сделан.
function switchVideoLevel(level, sub){
  let n = parseInt(level, 10); if(!isFinite(n) || n < 1) n = 1;
  let s = parseInt(sub, 10); if(!isFinite(s) || s < 0) s = 0;
  if(typeof isDavayMode === 'function' && isDavayMode()){
    const quizBusy = (state.davayQuizActivePlayer !== 0) || (state.davayQuizPendingNext !== 0);
    if(quizBusy){
      // Раунд «Готовы повторить?» идёт: очередь из 10 видео собрана из уровня,
      // на котором игра началась, а сравнение ответов игроков требует, чтобы
      // ОБА видели одни и те же ролики — «докрутить» новый уровень в идущую
      // очередь нельзя. Вместо отказа раунд начинается заново на выбранном
      // уровне (см. restartDavayRoundAtLevel в fants-timer.js).
      if(typeof restartDavayRoundAtLevel === 'function'){
        return restartDavayRoundAtLevel(n, s) ? { restarted: true } : false;
      }
      playErrorSound();
      showToast('Сначала закончите раунд — уровень меняется между раундами');
      return false;
    }
    davayLevel = normalizeDavayLevel(n);
    davaySubLevel = s;
    davayHistory = []; davayHistoryPos = -1; davayFavIndex = -1;
    saveState();
    updateDavayLevelBtn();
    if(state.davayFavoritesOnly){
      // Просмотр избранного — свой список (по уровню, без подуровня).
      showDavayFavoriteAt(0);
    } else {
      drawDavayCard(davayLevel);
    }
    return true;
  }
  if(typeof isVideoMode === 'function' && isVideoMode()){
    const max = (typeof VIDEO_MAX_LEVEL === 'number') ? VIDEO_MAX_LEVEL : 6;
    videoLevel = Math.min(Math.max(n, 1), max);
    videoSubLevel = s;
    videoHistory = []; videoHistoryPos = -1;
    saveState();
    updateVideoLevelBtn();
    drawVideoCard(videoLevel, true);
    return true;
  }
  return false;
}

function setGameMode(mode){
  // Любая смена режима — это выход/пауза/вход в игру: гасим видео карточки,
  // чтобы ничто не продолжало играть в фоне (см. stopCardVideos). В момент
  // входа в video/davay-mode карточка ещё не нарисована, так что потерять
  // нечего; при выходе через эту точку проходят ВСЕ пути (кнопки, стрелка,
  // «Закончить игру» из реестра).
  stopCardVideos();
  const el = document.getElementById('game');
  if(!el) return;
  GAME_MODE_CLASSES.forEach(cls=>{
    if(cls !== mode) el.classList.remove(cls);
  });
  if(mode) el.classList.add(mode);
  paintGameModeLoadingCard(mode);
}

/* ============ ЕДИНЫЙ ВОЗВРАТ «ОТКУДА ПРИШЁЛ» ============
 * Класс багов, который повторялся в проекте много раз: выход из игры вёл не
 * туда, куда игрок пришёл. Игра запускается со СВОЕГО экрана настройки
 * (#krokodilSetup), а выход выбрасывал в общий хаб #setup — игрок
 * «перепрыгивал» через уровень. Или наоборот: игрок вошёл из хаба, а выход
 * уводил на экран настройки, которого он не видел. Каждая игра решала это
 * по-своему, поэтому возврат получался разным у разных игр и расходился ещё
 * и между кнопкой «Выход» и стрелкой «←».
 *
 * Теперь точка входа запоминается в ОДНОМ месте — rememberReturnScreen(),
 * которую вызывает goToGame()/goToGameSetup(), а выход просто возвращается по
 * ней: returnToEntryScreen(). Никаких «догадок» вида «#game принадлежит
 * Фантам, значит вернёмся в Фанты» здесь больше нет.
 */
// Объект, а не примитив: ссылка остаётся той же, поэтому состояние видно и
// снаружи модуля (важно для тестов, которые читают точку входа напрямую).
const entryScreenState = { id: null, view: null };

/** Экраны настройки игр: для них «назад» = в тот раздел хаба, откуда пришли. */
function isGameSetupScreen(id){
  return typeof id === 'string' && /Setup$/.test(id) && !!document.getElementById(id);
}
/** Показать ровно один экран: гасим все .screen, включаем нужный. */
function activateSingleScreen(id){
  if(!id) return false;
  const el = document.getElementById(id);
  if(!el){ console.warn('activateSingleScreen: экран #' + id + ' не найден'); return false; }
  document.querySelectorAll('.screen.active').forEach(s=>s.classList.remove('active'));
  el.classList.add('active');
  noteVisibleScreen(id);
  window.scrollTo(0, 0);
  return true;
}
// Текущий активный раздел настроек (homeView/twoPlayerView/kidsView и т.д.) —
// нужно для корректного возврата после паузы, когда точка входа не сохранена.
function getCurrentSetupView(){
  for(const id of SETUP_VIEW_IDS){
    const el = document.getElementById(id);
    if(el && el.classList.contains('section-open')) return id;
  }
  return null;
}
/* ============ КОНТЕКСТ ЗАПУСКА ПАРТИИ ============
 * «Шаг назад» обязан вести на экран, с которого игрок пришёл:
 *     Главная → группа игр → (экран настройки игры) → партия.
 * Проблема: класс .active ставят десятки мест в 30 файлах (в том числе
 * вручную, без общих хелперов), поэтому «откуда пришёл» нельзя надёжно
 * посчитать в каждой функции запуска. Именно из-за таких догадок повторялся
 * баг «выход возвращает в меню ПРОШЛОЙ игры»: у игр, которые стартуют прямо
 * из плитки раздела («Ваше бинго», «Виселица», «Рулетка», «Твистер»,
 * «Сапёр», «Знаю тебя», «Во что поиграть?»), своего экрана настройки нет
 * вовсе, точка входа оставалась от предыдущей игры, и выход уводил в её
 * меню — на шаг назад в чужой ветке.
 *
 * Решение: единственный наблюдатель за классом .screen запоминает, какой экран
 * был активен перед запуском партии (screenSeenActive), а goToGame() по нему
 * решает, что возвращать «на шаг назад»: свой экран настройки (если игрок его
 * открывал) или сам хаб с текущим разделом.
 * Само поле screenSeenActive объявлено в начале файла (см. TDZ-комментарий).
 */
function noteVisibleScreen(id){
  if(id) screenSeenActive = id;
}
// Наружу — для тестовой среды: в браузере ту же роль играет MutationObserver
// ниже, в Node (tools/dom-stub.js) заглушка DOM сама зовёт этот хук, когда
// экран получает класс .active. Так сценарии навигации проверяются честно.
window.__noteActiveScreen = noteVisibleScreen;
// Экраны-«меню»: игрок в хабе и запускает игру прямо из списка раздела.
// #kidsBoardGamesMenu — подменю настольных игр детей: партия из него
// запускается так же, как из плитки раздела, и «назад» должно вести в хаб.
const HUB_MENU_SCREENS = new Set(['setup','kidsBoardGamesMenu']);
function launchedFromHubMenu(screenId){
  return HUB_MENU_SCREENS.has(screenId || '');
}
// Флаг «партия не начинается заново, а продолжается после паузы». Ставит его
// обработчик #resumeBtn на время вызова resume-функции игры: продолжение —
// это возврат в ту же партию, поэтому точку входа переписывать нельзя (иначе
// выход уводил бы в хаб вместо меню игры, которую игрок продолжает).
let resumingPausedSession = false;
// Подключаем наблюдатель за .screen (в браузере): он ловит ВСЕ места, где
// экран включается вручную (в том числе в играх), поэтому механизм не зависит
// от аккуратности каждой функции. В тестовой среде (Node, без DOM) наблюдателя
// нет — там состояние обновляют явные вызовы noteVisibleScreen() из
// goToGameSetup(), activateSingleScreen(), showSetupView() и goToGame().
(function startScreenWatcher(){
  if(typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
  const screens = document.querySelectorAll ? document.querySelectorAll('.screen') : [];
  if(!screens || !screens.length) return;
  const observer = new MutationObserver(()=>{
    screens.forEach(el=>{
      if(el.classList && el.classList.contains('active')) noteVisibleScreen(el.id);
    });
  });
  screens.forEach(el=>observer.observe(el, {attributes:true, attributeFilter:['class']}));
})();
// Запомнить точку входа. view — раздел хаба (#setup), в котором был игрок:
// он нужен, если возвращаться придётся в сам хаб (например из «Виселицы»).
function rememberReturnScreen(id, view){
  if(!id) return;
  entryScreenState.id = id;
  if(view) entryScreenState.view = view;
}
// Вернуться туда, откуда игрок пришёл. Если такой экран больше не существует —
// показываем хаб и подсвечиваем раздел по текущей паузе, чтобы игрок не
// оказался в случайном месте.
// Копия точки входа (для диагностики и тестов): состояние — переменная модуля,
// снаружи напрямую не видна, а знать, куда вернёт выход, бывает нужно.
function getEntryScreenState(){
  return { id: entryScreenState.id, view: entryScreenState.view };
}
function returnToEntryScreen(){
  const entry = getEntryScreenState();
  const saved = entry.id;
  // Возврат в ХАБ: игру запускали прямо из раздела меню, без своего экрана
  // настройки. Открываем #setup и тот же раздел — иначе игрок увидел бы
  // группу, из которой уходил в прошлый раз, то есть «шаг назад не туда».
  if(saved === 'setup'){
    if(!activateSingleScreen('setup')) return false;
    if(entry.view && typeof showSetupView === 'function') showSetupView(entry.view);
    if(typeof releaseWakeLockNow === 'function') releaseWakeLockNow();
    return true;
  }
  if(saved && activateSingleScreen(saved)){
    const setup = document.getElementById('setup');
    const wasInSetup = !!(setup && setup.classList.contains('active'));
    if(!wasInSetup && isGameSetupScreen(saved) && typeof updateResumeUI === 'function'){
      updateResumeUI();
    }
    if(typeof releaseWakeLockNow === 'function') releaseWakeLockNow();
    return true;
  }
  if(typeof returnToSetupUI === 'function'){
    returnToSetupUI();
    const view = entry.view || state.lastPauseView;
    if(view && typeof showSetupView === 'function') showSetupView(view);
    return false;
  }
  return false;
}
function returnToSetupUI(){
  // Сначала убираем active со ВСЕХ экранов, затем активируем только #setup —
  // это предотвращает «экран, поделённый на 2 части», когда при возврате
  // из игры/предыдущей сессии несколько экранов остаются активными.
  document.querySelectorAll('.screen.active').forEach(s=>s.classList.remove('active'));
  document.getElementById('setup').classList.add('active');
  document.getElementById('name1').value = state.name1 || '';
  document.getElementById('name2').value = state.name2 || '';
  updateStarterLabels();
  renderModeGroup();
  renderLevelToggles();
  updateResumeUI();
  releaseWakeLockNow();
  // Хаб показан — фиксируем его как точку входа (см. комментарий в
  // showSetupView): сюда вернёт выход из игры, запущенной прямо из плитки.
  // Но не во время паузы: пауза лишь показывает хаб «поверх партии», и выход
  // из неё должен вести в меню самой игры.
  noteVisibleScreen('setup');
  if(!state.pausedMode) rememberReturnScreen('setup', getCurrentSetupView());
}
// Пауза: выйти в настройки, не сбрасывая счёт и прогресс — можно продолжить позже
function pauseGame(){
  state.pausedMode = 'fanty';
  state.lastPauseView = getCurrentSetupView();
  saveState();
  returnToSetupUI();
}
// Полный сброс (после завершения игры и просмотра итогов)
function goToSetup(){
  state.score1 = 0; state.score2 = 0;
  state.autoMilestone = 0;
  state.turnsPlayed = 0; state.turnsAtLastLevelUp = 0;
  state.levelTurnCounts = {1:0, 2:0}; state.pendingLevelUp = false;
  state.completedCount = 0; state.skippedCount = 0;
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  returnToSetupUI();
}
function updateSettingsLockUI(){
  const locked = !!state.inProgress;
  ['modeGroup','favoritesOnlyBtn'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.classList.toggle('locked-settings', locked);
  });
  // «Уровни заданий» и «Первым начинает» не относятся к уже идущей партии —
  // во время паузы просто скрываем их, а не блокируем.
  ['levelsField','starterField'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.style.display = locked ? 'none' : '';
  });
}
// Клик по заблокированным во время паузы настройкам — подсказка вместо тишины.
// ВАЖНО: этот обработчик был случайно УДАЛЁН при правке клавиши «стрелка влево»
// (коммит f410151): на его место встал обработчик keydown. Из-за этого клик по
// заблокированному полю перестал что-либо объяснять — игрок видел, что поле
// неактивно (CSS .locked-settings с cursor:not-allowed), но не понимал почему.
document.addEventListener('click', (e)=>{
  const lockedEl = e.target.closest('.locked-settings');
  if(lockedEl){
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    showToast('Завершите игру, чтобы изменить настройки', 2000);
  }
}, true);

// Стрелка «влево» — как системная кнопка «Назад» на телефоне: в видеорежиме
// выходим из него, в остальных случаях уходим на паузу. Обработчик висит на
// document, поэтому не срабатывает, когда фокус в поле ввода (там стрелка
// двигает курсор).
document.addEventListener('keydown', (e)=>{
  if(e.key !== 'ArrowLeft') return;
  const tag = (e.target && e.target.tagName) || '';
  if(tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
  // Вложенные экраны (история, итоги «Пройди квеста»/«Карты страсти»):
  // клавиатурная «←» — тоже «шаг назад» в настройки игры, а не в хаб.
  // Единая точка с кнопкой «←» в шапке — window.handleNestedBack
  // (games/fants-timer.js): там карта PARENT_BACK вызывает штатную функцию
  // выхода экрана. Ветка идёт ПЕРВОЙ: на этих экранах партии нет
  // (inProgress=false), и без неё клавиша просто ничего бы не делала.
  if(typeof window.handleNestedBack === 'function' && window.handleNestedBack()){
    e.preventDefault();
    return;
  }
  // Ветки режимов экрана #game должны совпадать с кнопкой «←» в шапке
  // (games/fants-timer.js) и с кнопкой «Пауза/Выход». Раньше здесь была
  // только ветка видео: в «Давай попробуем» и «Предложи партнёру» клавиша
  // проваливалась в общую паузу «Фантов» — игрок попадал в чужое меню, а
  // «Продолжить игру» запускало не ту игру.
  if(typeof isVideoMode === 'function' && isVideoMode()){
    e.preventDefault();
    if(typeof exitVideoGame === 'function') exitVideoGame();
    return;
  }
  if(typeof isPlaceholderMode === 'function' && isPlaceholderMode()){
    e.preventDefault();
    if(typeof exitPlaceholderGame === 'function') exitPlaceholderGame();
    return;
  }
  if(typeof isDavayMode === 'function' && isDavayMode()){
    e.preventDefault();
    // Просмотр избранного — не партия: выходим полностью, как и кнопкой.
    if(state.davayFavoritesOnly){
      if(typeof exitDavayGame === 'function') exitDavayGame(true);
    } else if(typeof pauseDavayGame === 'function'){
      pauseDavayGame();
    }
    return;
  }
  // Пауза имеет смысл только во время партии — вне игры стрелка не мешает.
  if(state.inProgress){
    e.preventDefault();
    pauseGame();
  }
});
// Группа, к которой относится игра на паузе (для видимости списков игр и
// выбора блока при возобновлении). Единый источник истины: сюда включены ВСЕ
// pausedMode. Возвращает 'party' | 'kids' | 'solo' | 'business' | 'two' | null.
function getPausedGroup(){
  // К какой категории хаба относится текущая пауза. Раньше здесь были
  // четыре списка строк — при добавлении игры их легко было не обновить,
  // из-за чего список чужой группы прятался (баг «исчезают все игры»).
  // Теперь источник один — реестр игр (games/game-registry.js).
  return gameByMode(state.pausedMode)?.group || (state.pausedMode ? 'two' : null);
}
function updateResumeUI(){
  if(state.pausedMode === 'flags'){
    state.pausedMode = null;
    state.inProgress = false;
    state.lastSectionOnPause = null;
    saveState();
  }
  const pauseModal = document.getElementById('pauseMenuModal');
  // Базовая парная игра "Фанты" (через общую pauseGame()/#pauseBtn) теперь
  // тоже выставляет state.pausedMode = 'fanty' (см. pauseGame()) — раньше
  // не выставляла, из-за чего модалка паузы вообще не показывалась и
  // кнопки "Продолжить игру"/"Закончить игру" у Фантов пропадали.
  if(pauseModal) pauseModal.classList.toggle('show', !!state.pausedMode);
  const pauseTitle = document.getElementById('pauseMenuTitle');
  if(pauseTitle){
    const name = gameMenuTitle(state.pausedMode) || '⏸️ Игра';
    pauseTitle.innerHTML = `${name}<span class="pause-title-sub">Пауза</span>`;
  }
  // В меню паузы (когда видны "Продолжить игру"/"Закончить игру") незачем
  // показывать выбор другой игры и резервную копию — только сама пауза.
  // Исключения: если на паузе игра именно из этого блока (company/kids/solo/
  // twoPlayer), список игр остаётся виден (там же список игроков/кнопки).
  // ВАЖНО (критический баг «исчезли все игры в группе»): группа паузы теперь
  // определяется ЕДИНЫМ helper getPausedGroup(), куда включены ВСЕ игры с
  // паузой. Раньше списки is*Pause не знали о businessLemonade, kidsKrokodil,
  // soloQuiz, partyHangman — пауза такой игры считалась «двухместной»,
  // прятала список бизнес/детских игр и открывала не тот блок. Кроме того,
  // условие «inProgress && …» прятало списки ВО ВСЕХ группах, пока флаг
  // inProgress застревал после выхода из игры.
  const pausedGroup = (typeof getPausedGroup === 'function') ? getPausedGroup() : null;
  const isPartyPause = pausedGroup === 'party';
  const isKidsPause = pausedGroup === 'kids';
  const isSoloPause = pausedGroup === 'solo';
  const isBusinessPause = pausedGroup === 'business';
  const isTwoPlayerPause = pausedGroup === 'two';
  const gameSelectField = document.getElementById('gameSelectField');
  if(gameSelectField) gameSelectField.style.display = isTwoPlayerPause ? 'none' : '';
  const partyGameSelectField = document.getElementById('partyGameSelectField');
  if(partyGameSelectField) partyGameSelectField.style.display = '';
  const kidsGameSelectField = document.getElementById('kidsGameSelectField');
  if(kidsGameSelectField) kidsGameSelectField.style.display = '';
  const soloGameSelectList = document.getElementById('soloGameSelectList');
  if(soloGameSelectList) soloGameSelectList.style.display = '';
  // Список бизнес-игр (в нём же — список игроков) виден всегда, когда блок
  // открыт: пауза Магазина/Лимонадного ларька не должна прятать его, а
  // застрявший inProgress больше не влияет на списки групп.
  const businessGameSelectField = document.getElementById('businessGameSelectField');
  if(businessGameSelectField) businessGameSelectField.style.display = '';
  const backupField = document.getElementById('backupField');
  if(backupField) backupField.style.display = state.inProgress ? 'none' : '';
  // Пока игра компании на паузе — заголовок и описание блока меняются на
  // паузу этой игры.
  const partyTitleText = document.getElementById('partyGamesTitleText');
  const partyDesc = document.getElementById('partyGamesDesc');
  if(partyTitleText) partyTitleText.textContent = isPartyPause ? (gameMenuTitle(state.pausedMode) || '🎉 Игры для компании') : '🎉 Игры для компании';
  if(partyDesc) partyDesc.textContent = isPartyPause
    ? 'Счёт и игроки сохранены — продолжите партию или закончите её кнопкой выше.'
    : 'Шумные и весёлые игры для компании';
  // Симметрично "Играм для компании" — пока Мемори на паузе, заголовок и
  // описание блока "Игры с детьми" тоже меняются на паузу этой игры.
  const kidsTitleText = document.getElementById('kidsGamesTitleText');
  const kidsDesc = document.getElementById('kidsGamesDesc');
  if(kidsTitleText) kidsTitleText.textContent = isKidsPause ? (gameMenuTitle(state.pausedMode) || '🧸 Игры с детьми') : '🧸 Игры с детьми';
  if(kidsDesc) kidsDesc.textContent = isKidsPause
    ? 'Поле и счёт сохранены — продолжите партию или закончите её кнопкой выше.'
    : 'Давай играй, чтобы играть вместе с ребёнком';
  // Пока какая-нибудь игра на паузе — на #setup сразу открыт нужный блок
  // (игры для двоих / игры для компании / игры с детьми), чтобы после
  // "Закончить игру" не приходилось лишний раз возвращаться туда через главную.
  if(isPartyPause) showSetupView('companyView');
  else if(isKidsPause) showSetupView('kidsView');
  else if(isSoloPause) showSetupView('soloView');
  else if(isBusinessPause) showSetupView('businessView');
  else if(isTwoPlayerPause) showSetupView('twoPlayerView');
  updateSettingsLockUI();
}

function updateTurnUI(){
  document.getElementById('score1').textContent = `${state.name1}: ${state.score1}`;
  document.getElementById('score2').textContent = `${state.name2}: ${state.score2}`;
  // Заголовок экрана #game и метка хода.
  // Экран #game обслуживает четыре игры (см. gameScreenTitle): название игры
  // всегда идёт в штатный заголовок .game-level-label, как и на остальных
  // экранах. Метку хода «Ходит: …» показываем только там, где она несёт
  // смысл: в «Фантах» ход виден на карточке задания, поэтому метка скрыта,
  // чтобы не дублировать заголовок.
  const titleLabel = document.getElementById('gameLevelLabel');
  const turnLabel = document.getElementById('gameTurnLabel');
  const title = gameScreenTitle();
  if(titleLabel && gameScreenHasTitle()){
    titleLabel.textContent = title || '';
    titleLabel.style.display = 'block';
  }
  if(turnLabel){
    const showTurn = !isFantyGameScreen();
    turnLabel.style.display = showTurn ? '' : 'none';
    if(showTurn){
      const currentName = state.currentPlayer === 1 ? state.name1 : state.name2;
      turnLabel.textContent = 'Ходит: ' + currentName;
    }
  }
  // Подсветка активного игрока (если есть score-row с .krokodil-score-item)
  const row = document.getElementById('gameScoreRow');
  if(row){
    row.querySelectorAll('.krokodil-score-item').forEach((el, i)=>{
      el.classList.toggle('active', i === (state.currentPlayer - 1));
    });
  }
  updateLevelProgressUI();
}

function updateMuteBtn(){
  const btn = document.getElementById('muteBtn');
  if(btn){
    btn.textContent = state.muted ? '🔇 Звук выключен' : '🔊 Звук включён';
    btn.setAttribute('aria-label', state.muted ? 'Включить звук' : 'Выключить звук');
    btn.classList.toggle('on', !!state.muted);
  }
  const resumeBtn = document.getElementById('resumeMuteBtn');
  if(resumeBtn){
    resumeBtn.textContent = state.muted ? '🔇' : '🔊';
    resumeBtn.setAttribute('aria-label', state.muted ? 'Включить звук' : 'Выключить звук');
    resumeBtn.classList.toggle('on', !!state.muted);
  }
  const menuMuteBtn = document.getElementById('menuMuteBtn');
  if(menuMuteBtn){
    const icon = menuMuteBtn.querySelector('.menu-icon');
    if(icon) icon.textContent = state.muted ? '🔇' : '🔊';
  }
}
function updateAutoSpeakBtn(){
  const menuAutoSpeakBtn = document.getElementById('menuAutoSpeakBtn');
  if(menuAutoSpeakBtn){
    const icon = menuAutoSpeakBtn.querySelector('.menu-icon');
    // ▶ — режим включён, ⏸ — выключен (те же глифы, что у кнопок таймера «▶ Старт»/«⏸ Пауза»)
    if(icon) icon.textContent = state.autoSpeak ? '▶' : '⏸';
  }
}
document.getElementById('muteBtn').addEventListener('click', ()=>{
  state.muted = !state.muted;
  saveState();
  updateMuteBtn();
});
document.getElementById('resumeMuteBtn').addEventListener('click', ()=>{
  state.muted = !state.muted;
  saveState();
  updateMuteBtn();
});

// «Фанты» (двоих): общий экран #game без видео/davay/placeholder режимов.
// В этом режиме название игры показывается в заголовке, а не в метке хода.
function isFantyGameScreen(){
  const el = document.getElementById('game');
  return !!(el
    && !el.classList.contains('video-mode')
    && !el.classList.contains('davay-mode')
    && !el.classList.contains('placeholder-mode'));
}

// Заголовок для экрана #game по текущему режиму.
// Экран #game один, но обслуживает четыре разных игры, и у каждой должно быть
// своё название в штатном заголовке (.game-level-label):
//   Фанты        — «💘 Фанты» / «❓ Правда/Действие» (по state.gameType)
//   Видеорулетка — «🎥 Видеорулетка»
//   Давай попробуем — «🎬 Давай попробуем»
//   Предложи партнёру (placeholder) — заголовок заполняет updateLevelUI уровнем
// Возвращает null, если заголовок этим режимом не управляется.
// Раньше здесь была «размазана» та же логика: режимы видео/davay просто
// скрывали заголовок, и игрок не видел, в какой из двух игр он находится.
function gameScreenTitle(){
  const el = document.getElementById('game');
  if(!el) return null;
  if(el.classList.contains('video-mode')) return '🎥 Видеорулетка';
  if(el.classList.contains('davay-mode')) return '🎬 Давай попробуем';
  if(el.classList.contains('placeholder-mode')) return null; // уровнем заведует updateLevelUI
  return state.gameType === 'td' ? '❓ Правда/Действие' : '💘 Фанты';
}

// Заголовок нужен всем режимам #game, кроме placeholder («Предложи партнёру»),
// где .game-level-label показывает уровень и заполняется в updateLevelUI.
function gameScreenHasTitle(){
  const el = document.getElementById('game');
  return !!(el && !el.classList.contains('placeholder-mode'));
}

function updateLevelUI(){
  const btn = document.getElementById('levelUpBtn');
  const levelLabel = document.getElementById('gameLevelLabel');
  if(isPlaceholderMode()){
    btn.disabled = false;
    btn.textContent = 'Следующий вариант';
    const downBtn = document.getElementById('levelDownBtn');
    if(downBtn) downBtn.disabled = false;
    const el = document.getElementById('levelProgress');
    // Пилюлю нужно очистить и от текста, и от ФОНА: updateLevelProgressUI
    // («Фанты») красит её цветом уровня (#b07bff «Сближение» и т.п.), и
    // пустая окрашенная пилюля видна в «Предложи партнёру» как цветная
    // полоска над карточкой.
    if(el){ el.textContent = ''; el.style.background = ''; }
    if(levelLabel){
      const lvl = PHOTO_LEVELS.find(l => l.id === photoLevel);
      levelLabel.textContent = lvl ? `${lvl.icon} ${lvl.name}` : '';
      levelLabel.style.display = lvl ? 'block' : 'none';
    }
    return;
  }
  // Заголовок #game заполняет updateTurnUI (название игры для Фантов,
  // Видеорулетки и «Давай попробуем»). Гасим его здесь только в тех режимах,
  // где заголовок не нужен вовсе — иначе название пропадёт: updateLevelUI
  // вызывается ПОСЛЕ updateTurnUI и раньше безусловно ставил display:none.
  if(levelLabel && !gameScreenHasTitle()) levelLabel.style.display = 'none';
  if(isVideoMode() || isDavayMode()){
    btn.disabled = false;
    btn.textContent = 'Сложнее';
    const el = document.getElementById('levelProgress');
    // Сбрасываем и фон — как в placeholder-ветке выше: пилюля скрыта CSS-ом,
    // но остаточный инлайн-стиль не должен переживать смену режима.
    if(el){ el.textContent = ''; el.style.background = ''; }
    return;
  }
  const levels = getSortedActiveLevels();
  const isMax = levels.indexOf(state.levelCap) === levels.length-1;
  btn.disabled = isMax;
  btn.textContent = isMax ? 'Максимальный уровень' : '🔥 Горячее';
  const hotCard = document.getElementById('cardLevelUpBtn');
  if(hotCard) hotCard.disabled = isMax;
  updateLevelProgressUI();
}

function updateLevelProgressUI(){
  const el = document.getElementById('levelProgress');
  if(!el) return;
  const levels = getSortedActiveLevels();
  const isMax = levels.indexOf(state.levelCap) === levels.length-1;
  const currentLevel = levelById(state.levelCap);
  let text = '';
  if(isMax){ text = ''; }
  else if(state.gameMode === 'romantic'){
    const target = ((state.autoMilestone||0)+1)*10;
    const cur = Math.min(state.score1, state.score2);
    text = `До след. уровня: ${Math.max(0, target-cur)} очк. (у обоих партнёров)`;
  } else if(state.gameMode === 'hot'){
    if(!state.autoMilestone){
      const cur = Math.max(state.score1, state.score2);
      text = `До след. уровня: ${Math.max(0, 5-cur)} очк.`;
    } else {
      const since = (state.turnsPlayed||0) - (state.turnsAtLastLevelUp||0);
      text = `До след. уровня: ${Math.max(0, 10-since)} карт`;
    }
  }
  el.textContent = text;
  if(currentLevel){
    el.style.background = currentLevel.color;
  }
  // Прогресс-бар под строками счёта
  const fill = document.getElementById('fantsProgressFill');
  const label = document.getElementById('fantsProgressLabel');
  const progressRow = document.getElementById('fantsProgressRow');
  if(state.gameMode === 'custom'){
    if(progressRow) progressRow.style.display = 'none';
    if(fill) fill.style.width = '0%';
    if(label) label.textContent = '';
    return;
  }
  if(progressRow) progressRow.style.display = '';
  if(fill && label){
    let pct = 0;
    let labelText = '';
    if(!isMax){
      if(state.gameMode === 'romantic'){
        const target = ((state.autoMilestone||0)+1)*10;
        const cur = Math.min(state.score1, state.score2);
        pct = target > 0 ? Math.round((cur/target)*100) : 0;
        labelText = `До след. уровня: ${Math.max(0, target-cur)}`;
      } else if(state.gameMode === 'hot'){
        if(!state.autoMilestone){
          const cur = Math.max(state.score1, state.score2);
          pct = 5 > 0 ? Math.round((cur/5)*100) : 0;
          labelText = `До след. уровня: ${Math.max(0, 5-cur)}`;
        } else {
          const since = (state.turnsPlayed||0) - (state.turnsAtLastLevelUp||0);
          pct = 10 > 0 ? Math.round((since/10)*100) : 0;
          labelText = `До след. уровня: ${Math.max(0, 10-since)}`;
        }
      }
    }
    fill.style.width = pct + '%';
    label.textContent = labelText;
  }
  }

function advanceLevel(){
  const levels = getSortedActiveLevels();
  const idx = levels.indexOf(state.levelCap);
  if(idx>=0 && idx<levels.length-1){
    playLevelUpSound();
    state.levelCap = levels[idx+1];
    state.levelTurnCounts = {1:0, 2:0};
    state.pendingLevelUp = false;
    saveState();
    updateLevelUI();
    const lvl = levelById(state.levelCap);
    showToast(`Уровень повышен для обоих: ${lvl.icon} ${lvl.name}`);
    return true;
  }
  return false;
}
// Ручное "Повысить уровень": если партнёры ещё не сыграли поровну карточек
// текущего уровня, повышение откладывается до тех пор, пока отстающий
// игрок не сделает свой ход на этом же уровне (см. nextTurn()).
function levelUp(){
  const levels = getSortedActiveLevels();
  const isMax = levels.indexOf(state.levelCap) === levels.length-1;
  if(isMax){
    showToast('Это максимальный уровень 🔥');
    return;
  }
  const counts = state.levelTurnCounts || {1:0, 2:0};
  // Повышение доступно, только когда оба партнёра сыграли поровну карточек
  // текущего уровня И хотя бы по одной — сразу после повышения счётчики
  // обнуляются, и без этого условия можно было бы повысить уровень второй раз
  // подряд, не сыграв на новом уровне ни одной карточки.
  const ready = (counts[1]||0) === (counts[2]||0) && (counts[1]||0) >= 1;
  if(!ready){
    state.pendingLevelUp = true;
    saveState();
    showToast('Уровень повысится после хода партнёра');
    return;
  }
  if(advanceLevel()){
    drawCard(state.levelCap);
  } else {
    showToast('Это максимальный уровень 🔥');
  }
}
function checkAutoLevelUp(){
  if(state.gameMode === 'romantic'){
    const milestone = Math.floor(Math.min(state.score1, state.score2)/10);
    if(milestone > (state.autoMilestone||0)){
      state.autoMilestone = milestone;
      advanceLevel();
    }
  } else if(state.gameMode === 'hot'){
    if(!state.autoMilestone){
      // первое повышение — как только любой игрок набирает 5 очков
      if(Math.max(state.score1, state.score2) >= 5){
        if(advanceLevel()){
          state.autoMilestone = 1;
          state.turnsAtLastLevelUp = state.turnsPlayed||0;
        }
      }
    } else {
      // далее — каждое следующее повышение через 10 сыгранных карт
      const since = (state.turnsPlayed||0) - (state.turnsAtLastLevelUp||0);
      if(since >= 10){
        if(advanceLevel()){
          state.autoMilestone++;
          state.turnsAtLastLevelUp = state.turnsPlayed||0;
        }
      }
    }
  }
}

// Разбивает текст на предложения по точкам; если в конце остался кусок без
// точки — он тоже считается отдельным "предложением" (обрежется первым).
function splitIntoSentences(text){
  const sentences = text.match(/[^.]+\.+/g) || [];
  const matchedLength = sentences.join('').length;
  if(matchedLength < text.length){
    const rest = text.slice(matchedLength);
    if(rest.trim()) sentences.push(rest);
  }
  return sentences;
}

// Если текст не влезает в контейнер — обрезает его с конца до ближайшей
// точки (конца предложения), а не посреди слова/предложения.
function fitTextToContainer(containerEl, textEl, fullText){
  if(!containerEl || !textEl) return;
  textEl.textContent = fullText;
  if(containerEl.scrollHeight <= containerEl.clientHeight + 1) return;
  const sentences = splitIntoSentences(fullText);
  if(sentences.length <= 1) return; // обрезать некуда — точек нет
  for(let count = sentences.length - 1; count >= 1; count--){
    const truncated = sentences.slice(0, count).join('').trim();
    textEl.textContent = truncated;
    if(containerEl.scrollHeight <= containerEl.clientHeight + 1) return;
  }
  textEl.textContent = sentences[0].trim();
}

let cardTransitionLocked = false; // защита от двойного тапа на время анимации смены карточки
// Полная остановка всех видео внутри игровой карточки #card. Плееры создаются
// динамически внутри карточки (renderVideoCard/renderDavayCard), и любая
// перезапись её innerHTML — карточка «Передайте телефон», заглушка, фолбэк
// ошибки, следующее видео — ОТРЫВАЕТ играющий <video> от DOM. Оторванный
// элемент продолжает играть со звуком в фоне, а getElementById его уже не
// находит — остановить нечем (пользователь слышал звук видео, уже войдя в
// другую игру). Поэтому останавливаем видео ДО перезаписи, пока оно ещё в DOM.
// Вызывается в fadeSwapCard (любая смена карточки) и в setGameMode (любой
// выход/пауза/вход в режим — через неё проходят все пути выхода обеих игр).
function stopCardVideos(){
  document.querySelectorAll('#card video').forEach(v=>{
    try{ v.pause(); }catch(err){}
    try{
      v.removeAttribute('src');
      v.load(); // сбросить буфер и прервать загрузку/воспроизведение
    }catch(err){}
  });
}
function fadeSwapCard(paintFn){
  const el = document.getElementById('card');
  const inner = el.querySelector('.card-inner');
  const doPaint = ()=>{
    // Старое видео ещё в DOM — гасим его до перезаписи innerHTML, иначе оно
    // уедет в фон играющим (см. комментарий у stopCardVideos).
    stopCardVideos();
    paintFn(el); // задаёт className карточки и innerHTML, обёрнутый в .card-inner
    const newInner = el.querySelector('.card-inner');
    if(newInner){
      newInner.classList.add('card-hidden');
      void newInner.offsetWidth; // форсируем перерасчёт стилей перед снятием класса
      requestAnimationFrame(()=>{
        newInner.classList.remove('card-hidden');
      });
    }
    cardTransitionLocked = false;
  };
  if(inner){
    cardTransitionLocked = true;
    inner.classList.add('card-hidden');
    setTimeout(doPaint, 220);
  } else {
    doPaint();
  }
}

// Такая же плавная смена содержимого карточки, но для отдельных экранов новых
// игр (у каждой свой элемент карточки, не общий #card) — с колбэком onDone,
// чтобы вызывающая игра могла снять собственную блокировку двойного тапа.
function fadeSwapEl(elId, paintFn, onDone){
  const el = document.getElementById(elId);
  if(!el){ if(onDone) onDone(); return; }
  const inner = el.querySelector('.card-inner');
  const doPaint = ()=>{
    paintFn(el);
    const newInner = el.querySelector('.card-inner');
    if(newInner){
      newInner.classList.add('card-hidden');
      void newInner.offsetWidth;
      requestAnimationFrame(()=>{
        newInner.classList.remove('card-hidden');
      });
    }
    if(onDone) onDone();
  };
  if(inner){
    inner.classList.add('card-hidden');
    setTimeout(doPaint, 220);
  } else {
    doPaint();
  }
}

function renderNoCards(){
  clearInterval(timerInterval);
  timerInterval = null;
  fadeSwapCard((card)=>{
    card.className = 'card card-empty';
    card.style.borderTop = '';
    card.innerHTML = `<div class="card-inner"><div class="card-icon">🃏</div><div class="card-text">Нет доступных заданий — выберите уровень в настройках</div></div>`;
  });
}

// Заглушка: показывается, если cards_poses.js ещё не заполнен реальными карточками
function renderPlaceholderCard(){
  clearInterval(timerInterval);
  timerInterval = null;
  currentCard = null;
  fadeSwapCard((card)=>{
    card.className = 'card card-empty';
    card.style.borderTop = '';
    card.innerHTML = `<div class="card-inner"><div class="card-icon">🃏</div><div class="card-text">Скоро здесь появятся карточки — добавьте их в cards_poses.js</div></div>`;
  });
}

function getPhotoCardsList(){
  const poses = (typeof PHOTO_CARDS !== 'undefined' && Array.isArray(PHOTO_CARDS)) ? PHOTO_CARDS : [];
  // 5-й модуль "Секс-шоп" — отдельный файл cards_sexshop.js, объединяется с
  // позами по тому же принципу (level=5 выступает как отдельная категория).
  const shop = (typeof SEXSHOP_CARDS !== 'undefined' && Array.isArray(SEXSHOP_CARDS)) ? SEXSHOP_CARDS : [];
  // 6-й модуль "Коллекция" — отдельный файл cards_collection.js, тот же принцип
  // объединения, что и с "Секс-шоп" (level=6 выступает как отдельная категория).
  const collection = (typeof COLLECTION_CARDS !== 'undefined' && Array.isArray(COLLECTION_CARDS)) ? COLLECTION_CARDS : [];
  // 7-й и 8-й модули "Желания женщины"/"Желания мужчины" — текстовые карточки
  // без фото (у них просто нет поля image, renderPhotoCard не рендерит медиа-блок).
  const desiresWomen = (typeof DESIRES_WOMEN_CARDS !== 'undefined' && Array.isArray(DESIRES_WOMEN_CARDS)) ? DESIRES_WOMEN_CARDS : [];
  const desiresMen = (typeof DESIRES_MEN_CARDS !== 'undefined' && Array.isArray(DESIRES_MEN_CARDS)) ? DESIRES_MEN_CARDS : [];
  // 9-й модуль "Советы сексологов" — текстовые карточки без фото.
  const coachTips = (typeof SEX_COACH_TIPS_CARDS !== 'undefined' && Array.isArray(SEX_COACH_TIPS_CARDS)) ? SEX_COACH_TIPS_CARDS : [];
  // 10-й модуль — теперь "Идеи для вас" (переехала сюда из отдельной игры,
  // см. games/ideas.js — та же кнопка в меню пар теперь открывает "Ответы на
  // вопросы" на основе SEX_COACH_QA_CARDS). У IDEAS_CARDS нет поля level,
  // поэтому оно добавляется здесь же через map, без мутации исходного массива.
  const ideas = (typeof IDEAS_CARDS !== 'undefined' && Array.isArray(IDEAS_CARDS)) ? IDEAS_CARDS.map(c => Object.assign({level: 10}, c)) : [];
  // 11-й и 12-й модули "Ласки камасутры"/"Позы камасутры" — тоже текстовые
  // карточки без фото.
  const kamasutraCaresses = (typeof KAMASUTRA_CARESSES_CARDS !== 'undefined' && Array.isArray(KAMASUTRA_CARESSES_CARDS)) ? KAMASUTRA_CARESSES_CARDS : [];
  const kamasutraPositions = (typeof KAMASUTRA_POSITIONS_CARDS !== 'undefined' && Array.isArray(KAMASUTRA_POSITIONS_CARDS)) ? KAMASUTRA_POSITIONS_CARDS : [];
  return poses.concat(shop).concat(collection).concat(desiresWomen).concat(desiresMen)
    .concat(coachTips).concat(ideas).concat(kamasutraCaresses).concat(kamasutraPositions);
}

const PHOTO_MAX_LEVEL = 12;
let photoLevel = 1;
let currentPhotoCard = null;

// Ключ карточки для списков photoUsed/photoHidden/photoDone/sexshopOwned —
// обычно путь к фото (уникален сам по себе), но у текстовых модулей
// "Желания женщины"/"Желания мужчины" (уровни 7-8) поля image вообще нет,
// поэтому для них ключ собирается из level+rank (тоже гарантированно
// уникален внутри своего уровня).
function photoCardKey(card){
  return card.image || ('L' + card.level + '-' + card.rank);
}

function drawPhotoCard(level){
  photoLevel = level;
  updateLevelUI();
  const hidden = state.photoHidden || [];
  const all = getPhotoCardsList().filter(c=>c.level===level && !hidden.includes(photoCardKey(c)));
  if(all.length===0){ currentPhotoCard = null; renderPlaceholderCard(); return; }
  // Показ "по порядку" (кнопка-переключатель рядом с "Следующая") — вместо
  // случайной карточки из непоказанного пула просто идём по списку уровня
  // от начала, храня указатель на каждый уровень отдельно (state.photoSeqIndex).
  if(state.photoOrderMode){
    if(!state.photoSeqIndex) state.photoSeqIndex = {};
    let idx = state.photoSeqIndex[level] || 0;
    if(idx >= all.length) idx = 0;
    const card = all[idx];
    state.photoSeqIndex[level] = idx + 1;
    currentPhotoCard = card;
    saveState();
    renderPhotoCard(card, level);
    return;
  }
  if(!state.photoUsed) state.photoUsed = {};
  let used = state.photoUsed[level] || [];
  let pool = all.filter(c=>!used.includes(photoCardKey(c)));
  if(pool.length===0){
    pool = all;
    used = [];
    showToast('Карточки этого уровня показаны заново 🔀');
  }
  const card = pool[Math.floor(Math.random()*pool.length)];
  used.push(photoCardKey(card));
  state.photoUsed[level] = used;
  currentPhotoCard = card;
  saveState();
  renderPhotoCard(card, level);
}

function renderPhotoCard(card, level){
  clearInterval(timerInterval);
  timerInterval = null;
  currentCard = null;
  fadeSwapCard((el)=>{
    el.className = 'card card-empty';
    el.style.borderTop = '';
    // Модули "Желания женщины"/"Желания мужчины" (уровни 7-8) — текстовые
    // карточки без фото, поэтому медиа-блок вообще не рендерится (иначе
    // <img> с пустым src каждый раз падал бы в onerror-заглушку 🃏).
    el.innerHTML = `
       <div class="card-inner card-split${card.image ? '' : ' card-split-text-only'}">
         ${card.image && card.rank ? `<div class="card-rank-badge card-rank-badge-outside">№${card.rank}</div>` : ''}
         ${card.image ? `
         <div class="card-split-media" id="placeholderMedia">
           <img src="${card.image}" alt="" id="placeholderImg">
         </div>
         ` : ''}
         ${!card.image && card.rank ? `<div class="card-rank-badge">№${card.rank}</div>` : ''}
         <div class="card-split-desc" id="placeholderDesc">
           ${card.title ? `<div class="card-split-title">${card.title}</div>` : ''}
           <div class="card-text" id="placeholderText"></div>
           <div class="card-forwhom-row" id="placeholderForWhom"></div>
         </div>
         <div class="card-rating-row" id="placeholderRating"></div>
      </div>
      <button type="button" class="card-photo-nav card-photo-prev" id="photoPrevCardBtn" data-tt="Предыдущий вариант" aria-label="Предыдущий вариант">◀</button>
      <button type="button" class="card-photo-nav card-photo-next" id="photoNextCardBtn" data-tt="Следующий вариант" aria-label="Следующий вариант">▶</button>
    `;
    const img = document.getElementById('placeholderImg');
    if(img){
      img.addEventListener('error', ()=>{
        const media = document.getElementById('placeholderMedia');
        if(media) media.innerHTML = '<div class="card-icon">🃏</div>';
      });
      img.addEventListener('click', ()=>openImageZoom(card.image));
    }
    // Стрелки в нижних углах карточки: ◀ = «Предыдущий вариант» (levelDownBtn),
    // ▶ = «Следующий вариант» (levelUpBtn). Навешиваем обработчики каждый раз,
    // потому что карточка (и кнопки) пересоздаются при каждой перерисовке.
    const navPrevBtn = document.getElementById('photoPrevCardBtn');
    if(navPrevBtn) navPrevBtn.addEventListener('click', ()=>{
      const b = document.getElementById('levelDownBtn');
      if(b) b.click();
    });
    const navNextBtn = document.getElementById('photoNextCardBtn');
    if(navNextBtn) navNextBtn.addEventListener('click', ()=>{
      const b = document.getElementById('levelUpBtn');
      if(b) b.click();
    });
    fitTextToContainer(
      document.getElementById('placeholderDesc'),
      document.getElementById('placeholderText'),
      card.text
    );
    // "Подходит: ..." (модуль "Секс-шоп") — отдельной строкой под описанием.
    const forWhomEl = document.getElementById('placeholderForWhom');
    if(forWhomEl){
      if(card.forWhom){
        forWhomEl.innerHTML = `<span class="forwhom-pill">Подходит: ${card.forWhom}</span>`;
        forWhomEl.style.display = 'flex';
      } else {
        forWhomEl.innerHTML = '';
        forWhomEl.style.display = 'none';
      }
    }
    // Оценки партнёров (модуль "Секс-шоп") — отдельной строкой ниже.
    const ratingEl = document.getElementById('placeholderRating');
    if(ratingEl){
      if(card.womenRating !== undefined && card.menRating !== undefined){
        ratingEl.innerHTML = `
          <span class="rating-pill rating-women">♀ ${card.womenRating}/10</span>
          <span class="rating-pill rating-men">♂ ${card.menRating}/10</span>
        `;
        ratingEl.style.display = 'flex';
      } else {
        ratingEl.innerHTML = '';
        ratingEl.style.display = 'none';
      }
    }
  });
  updateFavoriteBtn();
}

function openImageZoom(src){
  const modal = document.getElementById('imageZoomModal');
  const img = document.getElementById('zoomedImage');
  if(!modal || !img) return;
  img.src = src;
  modal.classList.add('show');
}
function closeImageZoom(){
  const modal = document.getElementById('imageZoomModal');
  if(modal) modal.classList.remove('show');
}
document.getElementById('imageZoomModal').addEventListener('click', closeImageZoom);

/* ============ "ПО ПОРЯДКУ" / СЛУЧАЙНО ("Предложи партнеру") ============ */
// Кнопка рядом с "Следующая" — по умолчанию карточки идут в случайном
// порядке (как раньше); при выключении рандома показ переключается на
// последовательный, от карточки №1, отдельно для каждого уровня
// (state.photoSeqIndex[level]), см. drawPhotoCard.
function updatePhotoRandomToggleBtn(){
  const btn = document.getElementById('photoRandomToggleBtn');
  if(!btn) return;
  if(!isPlaceholderMode() || state.photoFavView){
    btn.style.display = 'none';
    return;
  }
  btn.style.display = 'flex';
  const ordered = !!state.photoOrderMode;
  btn.textContent = ordered ? '📶' : '🔀';
  btn.setAttribute('aria-label', ordered ? 'Показ по порядку — нажмите для случайного' : 'Случайный порядок — нажмите для показа по порядку');
}
document.getElementById('photoRandomToggleBtn').addEventListener('click', ()=>{
  if(!isPlaceholderMode()) return;
  state.photoOrderMode = !state.photoOrderMode;
  if(state.photoOrderMode){
    if(!state.photoSeqIndex) state.photoSeqIndex = {};
    state.photoSeqIndex[photoLevel] = 0;
  }
  saveState();
  updatePhotoRandomToggleBtn();
  playSuccessSound();
  if(!state.photoFavView) drawPhotoCard(photoLevel);
});

/* ============ ИЗБРАННОЕ / "СДЕЛАНО" ============ */
function updateOwnedBtn(){
  const btn = document.getElementById('sexshopOwnedBtn');
  if(!btn) return;
  if(!isPlaceholderMode() || !currentPhotoCard || currentPhotoCard.level !== 5){
    btn.style.display = 'none';
    return;
  }
  btn.style.display = 'flex';
  const isOwned = (state.sexshopOwned||[]).includes(photoCardKey(currentPhotoCard));
  btn.textContent = isOwned ? '✅' : '🛍️';
  btn.classList.toggle('active', isOwned);
}
function toggleOwned(){
  if(!isPlaceholderMode() || !currentPhotoCard || currentPhotoCard.level !== 5) return;
  if(!state.sexshopOwned) state.sexshopOwned = [];
  const pos = state.sexshopOwned.indexOf(photoCardKey(currentPhotoCard));
  if(pos>=0){
    state.sexshopOwned.splice(pos,1);
    showToast('Отметка «уже есть» снята');
  } else {
    state.sexshopOwned.push(photoCardKey(currentPhotoCard));
    playSuccessSound();
    showToast('Отмечено: уже есть ✅');
  }
  saveState();
  updateOwnedBtn();
}
document.getElementById('sexshopOwnedBtn').addEventListener('click', toggleOwned);
function updateFavoriteBtn(){
  updateOwnedBtn();
  updatePhotoRandomToggleBtn();
  const btn = document.getElementById('favoriteBtn');
  if(!btn) return;
  if(isPlaceholderMode()){
    if(!currentPhotoCard){ btn.textContent = '🤍'; btn.classList.remove('active'); return; }
    const isDone = (state.photoDone||[]).includes(photoCardKey(currentPhotoCard));
    btn.textContent = isDone ? '❤️' : '🤍';
    btn.classList.toggle('active', isDone);
    return;
  }
  if(isVideoMode()){
    if(!currentVideoCard){ btn.textContent = '🤍'; btn.classList.remove('active'); return; }
    const isLiked = (state.videoLiked||[]).includes(videoCardId(currentVideoCard));
    btn.textContent = isLiked ? '❤️' : '🤍';
    btn.classList.toggle('active', isLiked);
    return;
  }
  if(isDavayMode()){
    // В "Давай попробуем" кнопки-сердечка нет — избранное формируется
    // только совпадением "Да" у обоих игроков.
    return;
  }
  if(!currentCard) return;
  const isFav = state.favoriteIndexes.includes(currentCard.idx);
  btn.textContent = isFav ? '⭐' : '☆';
  btn.classList.toggle('active', isFav);
  const cardBtn = document.getElementById('cardFavoriteBtn');
  if(cardBtn){ cardBtn.textContent = isFav ? '⭐' : '☆'; cardBtn.classList.toggle('active', isFav); }
}
function toggleFavorite(){
  if(isPlaceholderMode()){
    if(!currentPhotoCard) return;
    if(!state.photoDone) state.photoDone = [];
    const pos = state.photoDone.indexOf(photoCardKey(currentPhotoCard));
    if(pos>=0){
      state.photoDone.splice(pos,1);
      showToast('Отметка «сделано» снята');
    } else {
      state.photoDone.push(photoCardKey(currentPhotoCard));
      playSuccessSound();
      showToast('Отмечено как сделано ✅');
    }
    saveState();
    updateFavoriteBtn();
    return;
  }
  if(isVideoMode()){
    if(!currentVideoCard) return;
    if(!state.videoLiked) state.videoLiked = [];
    const vid = videoCardId(currentVideoCard);
    const pos = state.videoLiked.indexOf(vid);
    if(pos>=0){
      state.videoLiked.splice(pos,1);
      showToast('Убрано из избранного');
    } else {
      state.videoLiked.push(vid);
      playSuccessSound();
      showToast('Добавлено в избранное ❤️');
    }
    saveState();
    updateFavoriteBtn();
    return;
  }
  if(isDavayMode()) return;
  if(!currentCard) return;
  const idx = currentCard.idx;
  const pos = state.favoriteIndexes.indexOf(idx);
  if(pos>=0){
    state.favoriteIndexes.splice(pos,1);
    showToast('Убрано из избранного');
  } else {
    state.favoriteIndexes.push(idx);
    playSuccessSound();
    showToast('Добавлено в избранное ⭐');
  }
  saveState();
  updateFavoriteBtn();
}
document.getElementById('favoriteBtn').addEventListener('click', toggleFavorite);
function updateFavoritesOnlyBtn(){
  const btn = document.getElementById('favoritesOnlyBtn');
  if(!btn) return;
  btn.classList.toggle('on', !!state.favoritesOnly);
  btn.setAttribute('aria-pressed', state.favoritesOnly ? 'true' : 'false');
}
document.getElementById('favoritesOnlyBtn').addEventListener('click', ()=>{
  if(!state.favoritesOnly){
    const elig = favoritesEligibility();
    if(!elig.ok){
      playErrorSound();
      showToast(`Добавьте больше карточек: М добавлено ${elig.forM}, Ж добавлено ${elig.forF}`, 2000);
      return;
    }
  }
  state.favoritesOnly = !state.favoritesOnly;
  saveState();
  updateFavoritesOnlyBtn();
});

/* ============ УТИЛИТЫ ЗАЩИТЫ ============ */
/* Глобальная защита от непойманных ошибок.
 *
 * Раньше здесь был только console.warn — на телефоне игрока этого никто не
 * видит, и приложение просто «залипало» или показывало пустой экран без
 * объяснений. Теперь ошибка:
 *   1) попадает в журнал (последние MAX_ERROR_LOG записей, хранится в
 *      localStorage отдельным ключом — переживает перезапуск);
 *   2) показывает игроку понятный экран с тремя путями выхода;
 *   3) не спамит: повторные ошибки в течение минуты не открывают окно снова,
 *      иначе одна сломанная анимация заблокировала бы игру.
 *
 * Экран ошибки НЕ показывается, пока идёт партия с незавершённым ходом, —
 * сначала сохраняем прогресс, чтобы «Перезапустить» ничего не потеряло.
 */
const ERROR_LOG_KEY = 'couple-game-error-log-v1';
const MAX_ERROR_LOG = 20;
const ERROR_REPEAT_WINDOW = 60000; // мс: как часто показывать окно повторно
let lastErrorShownAt = 0;

// Одинаковые ошибки, повторяющиеся подряд, схлопываем в одну запись со
// счётчиком. Без этого журнал на 20 записей забивался одним и тем же
// сообщением: например, недоступный файл видео даёт отказ на каждое
// переключение, и настоящие исключения вытеснялись повторами. Ключ — текст
// ошибки без времени; храним последние, чтобы не путать разные сбои.
const ERROR_DEDUPE_WINDOW = 10 * 60 * 1000; // мс: окно схлопывания

// Сбои, которые для приложения ожидаемы и не означают поломку: недоступный
// или неподдержанный файл видео, прерванная загрузка медиа (пользователь
// ушёл с экрана), отменённый запрос. Такие отказы промисов сыплются пачками
// (на каждое переключение ролика), поэтому в журнал ошибок и в окно «что-то
// пошло не так» они не попадают — у видео есть своя обработка с диагностикой.
const EXPECTED_FAILURE_MARKERS = [
  'MEDIA_ERR_SRC_NOT_SUPPORTED',
  'MEDIA_ERR_DECODE',
  'MEDIA_ERR_ABORTED',
  'The play() request was interrupted',
  'The operation was aborted',
  'AbortError',
  'NotSupportedError',
  'Failed to load because no supported source was found',
  'The element has no supported sources',
  'A network error occurred',
  'Load failed',
  'NetworkError when attempting to fetch resource',
];

/** Ожидаемый ли это сбой (медиа/сеть) — тогда журнал и окно не трогаем. */
function isExpectedMediaFailure(message){
  const text = String(message || '');
  if(!text) return false;
  return EXPECTED_FAILURE_MARKERS.some(marker => text.indexOf(marker) >= 0);
}

/** Есть ли уже такая ошибка в журнале за последнее окно (тогда только счётчик). */
function findRecentSameError(log, message){
  for(let i = log.length - 1; i >= 0; i--){
    const e = log[i];
    if(!e || e.message !== message) continue;
    const at = Date.parse(e.time);
    if(isNaN(at)) return null;
    if(Date.now() - at > ERROR_DEDUPE_WINDOW) return null;
    return e;
  }
  return null;
}

/** Дописывает ошибку в журнал (в памяти и в localStorage). */
function logAppError(info){
  try{
    const log = (() => {
      try{ return JSON.parse(localStorage.getItem(ERROR_LOG_KEY) || '[]'); }catch(_){ return []; }
    })();
    // Повтор той же ошибки не добавляем новой записью: увеличиваем счётчик и
    // обновляем время. Иначе журнал (20 записей) заполнялся повторами одного
    // сбоя, и по нему нельзя было понять, что происходило на самом деле.
    const same = info && info.message ? findRecentSameError(log, info.message) : null;
    if(same){
      same.count = (same.count || 1) + 1;
      same.time = info.time || new Date().toISOString();
      if(info.source) same.source = info.source;
      if(info.detail) same.detail = info.detail;
    } else {
      log.push(Object.assign({ count: 1 }, info));
    }
    while(log.length > MAX_ERROR_LOG) log.shift();
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(log));
  }catch(_){ /* переполнение или приватный режим — журнал не критичен */ }
}

/** Возвращает журнал ошибок (новые — первыми). */
function getErrorLog(){
  try{ return JSON.parse(localStorage.getItem(ERROR_LOG_KEY) || '[]').reverse(); }catch(_){ return []; }
}

/** Очищает журнал (вызывается при полном сбросе прогресса). */
function clearErrorLog(){
  try{ localStorage.removeItem(ERROR_LOG_KEY); }catch(_){}
}

/** Короткое описание окружения — чтобы понять, где именно сломалось. */
function appEnvInfo(){
  const sw = (navigator.serviceWorker && navigator.serviceWorker.controller) ? 'да' : 'нет';
  return [
    'версия сборки: ' + (window.APP_BUILD || 'неизвестна'),
    'страница: ' + location.href,
    'браузер: ' + navigator.userAgent,
    'экран: ' + (window.screen ? screen.width + 'x' + screen.height : '?'),
    'PWA: ' + (document.documentElement.classList.contains('pwa-standalone') ? 'да' : 'нет'),
    'Service Worker: ' + sw,
    'пауза: ' + (state && state.pausedMode ? state.pausedMode : 'нет'),
  ].join('\n');
}

/** Текст отчёта для копирования в буфер (или отправки разработчику). */
function buildErrorReport(){
  // Записей больше, чем раньше (5): повторы теперь схлопываются в одну
  // строку со счётчиком, поэтому в журнале лежат реально разные ошибки.
  const log = getErrorLog().slice(0, 10);
  const lines = ['Ошибка в приложении «Давай играй»', '', appEnvInfo(), '', 'Последние ошибки:'];
  if(log.length === 0) lines.push('  (журнал пуст)');
  log.forEach((e, i) => {
    const times = e.count > 1 ? `  (повторов: ${e.count})` : '';
    lines.push(`  ${i + 1}) ${e.time}${times}`);
    lines.push(`     ${e.message}`);
    if(e.detail) lines.push(`     детали: ${e.detail}`);
    if(e.source) lines.push(`     источник: ${e.source}`);
  });
  return lines.join('\n');
}

/** Показывает экран ошибки (не чаще, чем раз в ERROR_REPEAT_WINDOW). */
function showAppError(message, source){
  const now = Date.now();
  if(now - lastErrorShownAt < ERROR_REPEAT_WINDOW) return;
  lastErrorShownAt = now;

  const modal = document.getElementById('appErrorModal');
  if(!modal) return; // разметка не готова — молча выходим, ошибка уже в журнале

  const textEl = document.getElementById('appErrorText');
  const detailsEl = document.getElementById('appErrorDetails');
  if(textEl){
    textEl.textContent = message
      ? 'Произошла ошибка: ' + message + '. Прогресс сохранён — можно продолжать.'
      : 'Игра столкнулась с неожиданной ошибкой. Прогресс сохранён.';
  }
  if(detailsEl){
    // Технические детали показываем только в отладочном режиме (localhost),
    // обычному игроку они не нужны и только пугают.
    const isDev = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    detailsEl.textContent = source || '';
    detailsEl.style.display = isDev && source ? 'block' : 'none';
  }
  modal.classList.add('show');
}

// Отдельный текст для кнопки «Скопировать отчёт», когда окно открыто не из-за
// исключения, а по диагностике видео. buildErrorReport читает журнал ошибок,
// но диагностику мы в журнал не пишем (иначе он забьётся), поэтому здесь
// собираем отчёт из переданного текста + окружение.
let __pendingErrorReport = null;

/**
 * Показать окно ошибки с конкретным отчётом (для диагностики, не для
 * исключений). В отличие от showAppError:
 *   • показывает детали ВСЕГДА, а не только на localhost — без них отчёт
 *     бесполезен, а именно его игрок и передаёт разработчику;
 *   • не срабатывает защита от повторов: диагностику запрашивает сам игрок;
 *   • кнопка «Скопировать отчёт» отдаёт переданный текст, а не журнал ошибок.
 */
function showDiagnosticReport(title, details){
  const modal = document.getElementById('appErrorModal');
  if(!modal) return false;
  const textEl = document.getElementById('appErrorText');
  if(textEl) textEl.textContent = title || 'Диагностика';
  const detailsEl = document.getElementById('appErrorDetails');
  if(detailsEl){
    detailsEl.textContent = details || '';
    detailsEl.style.display = details ? 'block' : 'none';
  }
  __pendingErrorReport = details || title || '';
  modal.classList.add('show');
  return true;
}

/** Скрывает экран ошибки. */
function hideAppError(){
  // Сбрасываем отчёт диагностики: иначе он «протёк» бы в следующее окно,
  // открытое уже из-за настоящего исключения.
  __pendingErrorReport = null;
  const modal = document.getElementById('appErrorModal');
  if(modal) modal.classList.remove('show');
}

// Непойманные синхронные ошибки.
window.addEventListener('error', (ev)=>{
  const info = {
    time: new Date().toISOString(),
    message: ev.message || String(ev.error || 'неизвестная ошибка'),
    source: (ev.filename || '?') + ':' + (ev.lineno || '?') + ':' + (ev.colno || '?'),
  };
  try{ console.warn('[Love-play] uncaught:', info.message, '@', info.source); }catch(_){}
  // Ошибки загрузки сторонних ресурсов (img/video) сюда тоже попадают,
  // но у них нет message — их не показываем игроку, только логируем.
  if(!ev.message) return;
  logAppError(info);
  showAppError(info.message, info.source);
});

// Непойманные отказы промисов (fetch, IndexedDB, audio.play()).
window.addEventListener('unhandledrejection', (ev)=>{
  const reason = ev.reason;
  const info = {
    time: new Date().toISOString(),
    message: (reason && reason.message) ? reason.message : String(reason),
    source: (reason && reason.stack) ? String(reason.stack).split('\n')[1]?.trim() || '' : '',
  };
  try{ console.warn('[Love-play] unhandled rejection:', info.message); }catch(_){}
  // Недоступный файл видео и отменённые запросы — ожидаемые ситуации, а не
  // сбой приложения: у видео своя обработка ошибок, включая окно с
  // диагностикой. В журнал их не пишем и окном не пугаем — иначе журнал на
  // 20 записей забивался повторами и вытеснял настоящие исключения.
  if(isExpectedMediaFailure(info.message)){
    try{ console.warn('[Love-play] это ожидаемый сбой медиа — в журнал не пишем'); }catch(_){}
    return;
  }
  logAppError(info);
  showAppError(info.message, info.source);
});

// Кнопки на экране ошибки.
const __errReloadBtn = document.getElementById('appErrorReloadBtn');
if(__errReloadBtn) __errReloadBtn.addEventListener('click', ()=>{
  hideAppError();
  saveState();            // сохраняем прогресс перед перезапуском
  const url = new URL(location.href);
  url.searchParams.set('_r', Date.now());
  location.replace(url.toString());
});
const __errReportBtn = document.getElementById('appErrorReportBtn');
if(__errReportBtn) __errReportBtn.addEventListener('click', async ()=>{
  // Если окно открыто диагностикой (showDiagnosticReport) — копируем её отчёт,
  // а не журнал ошибок: диагностику в журнал не пишем, чтобы не забивать его.
  const report = __pendingErrorReport || buildErrorReport();
  let copied = false;
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(report);
      copied = true;
    }
  }catch(_){}
  if(!copied){
    // Фолбэк для http:// (буфер обмена доступен только на https/localhost)
    // и старых WebView: показываем текст, чтобы выделить вручную.
    const detailsEl = document.getElementById('appErrorDetails');
    if(detailsEl){ detailsEl.textContent = report; detailsEl.style.display = 'block'; }
    // Плюс выделяем текст: на телефоне так проще нажать «Копировать».
    try{
      const range = document.createRange();
      range.selectNodeContents(detailsEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }catch(_){}
  }
  showToast(copied ? 'Отчёт скопирован — вставьте его в сообщение о проблеме' : 'Отчёт показан ниже — выделите и скопируйте');
});
const __errCloseBtn = document.getElementById('appErrorCloseBtn');
if(__errCloseBtn) __errCloseBtn.addEventListener('click', ()=>{
  __pendingErrorReport = null;
  hideAppError();
});

// Очистка журнала ошибок без полного сброса прогресса. Нужна, когда журнал
// заполнен старыми записями (он рассчитан на 20 штук), а хочется увидеть
// свежие: иначе новая ошибка вытесняет старую, и по отчёту трудно понять,
// что происходит сейчас. Прогресс партий и настройки не трогаются.
const __errClearLogBtn = document.getElementById('appErrorClearLogBtn');
if(__errClearLogBtn) __errClearLogBtn.addEventListener('click', ()=>{
  clearErrorLog();
  const detailsEl = document.getElementById('appErrorDetails');
  if(detailsEl){
    detailsEl.textContent = 'Журнал ошибок очищен. Прогресс и настройки не тронуты.';
    detailsEl.style.display = 'block';
  }
  __pendingErrorReport = null;
  showToast('Журнал ошибок очищен');
});

// debounce(fn, ms) — обёртка: пропускает вызов fn, пока между нажатиями не
// прошло ms миллисекунд. Используется для кнопок с быстрым повтором
// (например, бинго/сапёр), где двойное нажатие за <300мс часто случайно.
function debounce(fn, ms){
  let last = 0, timer = null;
  return function(...args){
    const now = Date.now();
    const wait = Math.max(0, ms - (now - last));
    clearTimeout(timer);
    timer = setTimeout(()=>{ last = Date.now(); fn.apply(this, args); }, wait);
  };
}

/* ============ СВОИ ЗАДАНИЯ ============ */
let newCardType = 'truth';
let newCardFor = '';
function populateNewCardLevelSelect(){
  const sel = document.getElementById('newCardLevel');
  sel.innerHTML = LEVELS.map(l=>`<option value="${l.id}">${l.icon} ${l.name}</option>`).join('');
}
document.querySelectorAll('#newCardTypeGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    newCardType = btn.dataset.value;
    document.querySelectorAll('#newCardTypeGroup .starter-btn').forEach(b=>b.classList.toggle('on', b===btn));
  });
});
document.querySelectorAll('#newCardForGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    newCardFor = btn.dataset.value;
    document.querySelectorAll('#newCardForGroup .starter-btn').forEach(b=>b.classList.toggle('on', b===btn));
  });
});
function renderCustomCardsList(){
  const wrap = document.getElementById('customCardsList');
  const items = (state.customCards||[])
    .map((c,i)=>({c,i}))
    .filter(x=>!x.c.deleted);
  if(items.length===0){ wrap.innerHTML = '<div class="custom-cards-empty">Своих заданий пока нет</div>'; return; }
  wrap.innerHTML = items.map(({c,i})=>{
    const lvl = levelById(c.level);
    const forLabel = c.for==='M' ? ' · Мужчине' : c.for==='F' ? ' · Женщине' : '';
    return `<div class="custom-card-row" data-i="${i}">
      <div class="custom-card-text">${lvl ? lvl.icon : ''} ${c.text}${forLabel}</div>
      <button type="button" class="custom-card-del" data-i="${i}" aria-label="Удалить">🗑</button>
    </div>`;
  }).join('');
  wrap.querySelectorAll('.custom-card-del').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const i = parseInt(btn.dataset.i, 10);
      if(state.customCards[i]){
        state.customCards[i].deleted = true;
        saveState();
        renderCustomCardsList();
        showToast('Задание удалено');
      }
    });
  });
}
document.getElementById('saveCardBtn').addEventListener('click', ()=>{
  const textEl = document.getElementById('newCardText');
  const text = textEl.value.trim();
  if(text.length<3){
    playErrorSound();
    showToast('Напишите текст задания');
    return;
  }
  const level = parseInt(document.getElementById('newCardLevel').value, 10);
  const card = { level, type:newCardType, text };
  if(newCardFor) card.for = newCardFor;
  state.customCards.push(card);
  saveState();
  textEl.value = '';
  renderCustomCardsList();
  playSuccessSound();
  showToast('Задание добавлено ✓');
});
// Экспорт своих заданий в текст для файла cards_fants_users.js (сохраняются в git отдельно от cards_fants.js)
function buildUserCardsExportText(){
  const items = (state.customCards||[]).filter(c=>!c.deleted);
  const lines = items.map(c=>{
    const parts = [`level:${c.level}`, `type:${JSON.stringify(c.type)}`, `text:${JSON.stringify(c.text)}`];
    if(c.for) parts.push(`for:${JSON.stringify(c.for)}`);
    return `  {${parts.join(', ')}},`;
  });
  return `// cards_fants_users.js — задания, добавленные через приложение.\n// Замените этот файл в репозитории (GitHub), чтобы сохранить их навсегда.\nconst USER_CARDS = [\n${lines.join('\n')}\n];`;
}
const exportCardsBtnEl = document.getElementById('exportCardsBtn');
if(exportCardsBtnEl) exportCardsBtnEl.addEventListener('click', ()=>{
  const items = (state.customCards||[]).filter(c=>!c.deleted);
  if(items.length===0){
    showToast('Нет своих заданий для скачивания');
    return;
  }
  const text = buildUserCardsExportText();
  const blob = new Blob([text], {type:'application/javascript'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cards_fants_users.js';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
  showToast('Файл cards_fants_users.js скачан', 2200);
});
// Загрузка заданий из файла (например, ранее скачанного cards_fants_users.js) — добавляет их в игру на этом устройстве
function parseCardsFromText(text){
  const matches = text.match(/\{[^{}]*\}/g) || [];
  const cards = [];
  matches.forEach(m=>{
    try{
      const obj = Function('"use strict"; return (' + m + ')')();
      if(obj && typeof obj.level === 'number' && (obj.type==='truth'||obj.type==='dare') && typeof obj.text === 'string' && obj.text.trim()){
        const card = { level: obj.level, type: obj.type, text: obj.text };
        if(obj.for === 'M' || obj.for === 'F') card.for = obj.for;
        cards.push(card);
      }
    }catch(e){}
  });
  return cards;
}
const importCardsBtnEl = document.getElementById('importCardsBtn');
if(importCardsBtnEl){
  importCardsBtnEl.addEventListener('click', ()=>{
    // Скрытый input для выбора файла. Раньше здесь было обращение без проверки:
    // работало только потому, что кнопка #importCardsBtn отсутствует в разметке
    // (обработчик не вешается) — то есть код был живой только «по случайности».
    const input = document.getElementById('importCardsInput');
    if(input) input.click();
  });
}
const importCardsInputEl = document.getElementById('importCardsInput');
if(importCardsInputEl) importCardsInputEl.addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    const parsed = parseCardsFromText(String(reader.result||''));
    if(parsed.length===0){
      playErrorSound();
      showToast('Не нашлось заданий для загрузки');
      e.target.value = '';
      return;
    }
    const existing = new Set((state.customCards||[]).filter(c=>!c.deleted).map(c=>`${c.level}|${c.type}|${c.text}|${c.for||''}`));
    let added = 0;
    parsed.forEach(c=>{
      const key = `${c.level}|${c.type}|${c.text}|${c.for||''}`;
      if(!existing.has(key)){
        state.customCards.push(c);
        existing.add(key);
        added++;
      }
    });
    saveState();
    renderCustomCardsList();
    e.target.value = '';
    if(added>0){
      playSuccessSound();
      showToast(`Загружено заданий: ${added}`);
    } else {
      showToast('Все задания уже есть в списке');
    }
  };
  reader.readAsText(file);
});
document.getElementById('addCardBtn').addEventListener('click', ()=>{
  populateNewCardLevelSelect();
  renderCustomCardsList();
  showModal('addCardModal');
});
document.getElementById('closeAddCardBtn').addEventListener('click', ()=>{
  hideModal('addCardModal');
});
document.getElementById('addCardModal').addEventListener('click', (e)=>{
  if(e.target.id === 'addCardModal') e.currentTarget.classList.remove('show');
});

/* ============ СВАЙПЫ НА КАРТОЧКЕ ============ */
(function setupSwipe(){
  const cardEl = document.getElementById('card');
  let startX = 0, startY = 0, tracking = false;
  cardEl.addEventListener('touchstart', (e)=>{
    if(e.touches.length!==1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, {passive:true});
  cardEl.addEventListener('touchend', (e)=>{
    if(!tracking) return;
    tracking = false;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    const absX = Math.abs(dx), absY = Math.abs(dy);
    const threshold = 70;
    if(absX < threshold && absY < threshold) return; // обычный тап — игнорируем

    if(isVideoMode()){
      if(!currentVideoCard) return;
      if(absX > absY){
        if(dx > 0) videoSwipeNext(); // вправо — следующее видео
        else videoSwipePrev(); // влево — предыдущее видео
      } else if(dy < 0){
        const vid = videoCardId(currentVideoCard);
        if(!(state.videoLiked||[]).includes(vid)) toggleFavorite();
      }
      return;
    }

    if(isDavayMode()){
      if(!currentDavayCard) return;
      // Пока идёт опрос (выбран игрок), порядок видео фиксирован — свайпы
      // влево/вправо отключены, чтобы не сбить очередь из 10 видео.
      if(state.davayQuizActivePlayer){
        if(dy < 0){
          const vid = davayCardId(currentDavayCard);
          if(!(state.davayLiked||[]).includes(vid)) toggleFavorite();
        }
        return;
      }
      if(absX > absY){
        if(dx > 0) davaySwipeNext(); // вправо — следующее видео
        else davaySwipePrev(); // влево — предыдущее видео
      } else if(dy < 0){
        const vid = davayCardId(currentDavayCard);
        if(!(state.davayLiked||[]).includes(vid)) toggleFavorite();
      }
      return;
    }

    if(!currentCard) return;
    if(absX > absY){
      if(dx > 0){ playSuccessSound(); nextTurn(true); }
      else { playFailSound(); nextTurn(false); }
    } else {
      if(dy < 0) dislikeCurrentCard();
    }
  }, {passive:true});
})();

// Свайп на карточке "Правда/Действие" — как в Фантах: вправо «Готово»,
// влево «🚫 Отказ». Работает только пока показан ряд ответа (после выбора
// «Правда»/«Действие»), а не во время самого выбора типа задания.
(function setupTdSwipe(){
  const cardEl = document.getElementById('tdCard');
  if(!cardEl) return;
  let startX = 0, startY = 0, tracking = false;
  cardEl.addEventListener('touchstart', (e)=>{
    if(e.touches.length!==1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, {passive:true});
  cardEl.addEventListener('touchend', (e)=>{
    if(!tracking) return;
    tracking = false;
    if(tdLocked) return;
    const answerRow = document.getElementById('tdAnswerRow');
    if(!answerRow || answerRow.style.display === 'none') return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    const absX = Math.abs(dx), absY = Math.abs(dy);
    const threshold = 70;
    if(absX < threshold || absX < absY) return;
    if(dx > 0){ playSuccessSound(); tdNextTurn(true); }
    else { playFailSound(); tdNextTurn(false); }
  }, {passive:true});
})();


/* ============ ЗВУКОВОЙ ДВИЖОК ============
 * Живёт здесь, а не в fants-timer.js: core.js грузится ПЕРВЫМ, а вызовы
 * playSuccessSound/playErrorSound разбросаны по всем файлам и срабатывают по
 * клику. Когда fants-timer.js не выполнился (сбой загрузки при смене кэша
 * Service Worker), каждый клик по кнопке давал ReferenceError. Звуковые
 * функции обязаны определяться в самом раннем файле приложения.
 */
// Один общий AudioContext на всё приложение вместо нового на каждый звук —
// iOS Safari ограничивает число одновременно живых AudioContext, и при частых
// звуках (например, быстрые свайпы подряд) более старый подход мог "тихо" не срабатывать.
let sharedAudioCtx = null;
const activeOscillators = [];
/* ===== Единый звук видео для обеих видео-игр =====
 * Кнопка «Звук» на странице настройки «Давай попробуем» и кнопки 🔊 внутри
 * «Давай попробуем» и «Видеорулетки» управляют ОДНОЙ настройкой. Раньше
 * state.davaySoundOn и state.videoSoundOn жили отдельно: включённый на
 * настройке звук не действовал на «Видеорулетку» — его приходилось включать
 * второй раз кнопкой 🔊 в самой игре. Функция живёт в core.js, потому что
 * оба сеттера (setDavaySoundOn/setVideoSoundOn) определены в разных файлах;
 * вызывается она по клику, когда все скрипты уже загружены, а кнопки
 * обновляет через typeof-проверки (на момент определения core.js их ещё нет). */
function setSharedVideoSound(on){
  // ЕДИНАЯ точка записи звука видео для обеих игр: кнопка «Звук» на странице
  // настройки «Давай попробуем» и кнопки 🔊 в самих играх пишут только сюда.
  // Пишем ОБА поля state (старые сейвы нормализует loadState), ОБЕ модульные
  // переменные (их читают кнопки 🔊, кнопка «Звук» на настройке и рендер
  // карточек при выставлении video.muted), гасим/включаем оба плеера и
  // обновляем обе кнопки. Присвоение let-переменных из fants-video.js/
  // fants-davay.js допустимо: глобальные lexical-связывания общие для всех
  // скриптов, а вызов возможен только после полной загрузки страницы.
  state.davaySoundOn = !!on;
  state.videoSoundOn = !!on;
  davaySoundOn = !!on;
  videoSoundOn = !!on;
  saveState();
  const davayVideo = document.getElementById('davayPlayer');
  if(davayVideo) davayVideo.muted = !on;
  const videoEl = document.getElementById('videoPlayer');
  if(videoEl) videoEl.muted = !on;
  if(typeof updateDavayMuteBtn === 'function') updateDavayMuteBtn();
  if(typeof updateVideoMuteBtn === 'function') updateVideoMuteBtn();
}
function getAudioCtx(){
  try{
    if(!sharedAudioCtx){
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return null;
      sharedAudioCtx = new Ctx();
    }
    if(sharedAudioCtx.state === 'suspended'){
      sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  }catch(e){ return null; }
}
function stopAllSounds(){
  // Останавливаем все активные осцилляторы (Web Audio API)
  while(activeOscillators.length){
    const osc = activeOscillators.pop();
    try{ osc.stop(); }catch(e){}
  }
  // Останавливаем речь (SpeechSynthesis) — дважды для надёжности в Chrome
  if('speechSynthesis' in window){
    speechSynthesis.cancel();
    setTimeout(()=>speechSynthesis.cancel(), 50);
  }
}

function playTimerAlarm(){
  if(state.muted) return;
  try{
    const ctx = getAudioCtx();
    if(!ctx) return;
    const beepTimes = [0, 0.22, 0.44];
    beepTimes.forEach(t=>{
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.2);
    });
  }catch(e){}
  if(navigator.vibrate) navigator.vibrate([150,80,150,80,150]);
}

function playSuccessSound(){
  if(state.muted) return;
  try{
    const ctx = getAudioCtx();
    if(!ctx) return;
    const notes = [523.25, 659.25]; // приятный восходящий перезвон (до — ми)
    notes.forEach((freq, i)=>{
      const t = i*0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.4);
      activeOscillators.push(osc);
      osc.onended = ()=>{ const idx = activeOscillators.indexOf(osc); if(idx!==-1) activeOscillators.splice(idx,1); };
    });
  }catch(e){}
}

function playLevelUpSound(){
  if(state.muted) return;
  try{
    const ctx = getAudioCtx();
    if(!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // до-ми-соль-до, торжествующее трезвучие
    notes.forEach((freq, i)=>{
      const t = i*0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.5);
    });
  }catch(e){}
  if(navigator.vibrate) navigator.vibrate([60,40,60,40,120]);
}

function playBingoVictorySound(){
  if(state.muted) return;
  try{
    const ctx = getAudioCtx();
    if(!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // до-ми-соль-до-ми — яркая победная фанфара за линии/финал бинго
    notes.forEach((freq, i)=>{
      const t = i*0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.55);
    });
  }catch(e){}
  if(navigator.vibrate) navigator.vibrate([100,50,100,50,200]);
}

function playFailSound(){
  if(state.muted) return;
  try{
    const ctx = getAudioCtx();
    if(!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.42);
  }catch(e){}
}

function playNeutralSound(){
  if(state.muted) return;
  try{
    const ctx = getAudioCtx();
    if(!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  }catch(e){}
}

// Восходящий «вжух» при старте вращения рулетки — эффект раскрутки колеса
function playSpinStartSound(){
  if(state.muted) return;
  try{
    const ctx = getAudioCtx();
    if(!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(760, ctx.currentTime + 0.45);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.55);
  }catch(e){}
}

function playErrorSound(){
  if(state.muted) return;
  try{
    const ctx = getAudioCtx();
    if(!ctx) return;
    const beepTimes = [0, 0.14];
    beepTimes.forEach(t=>{
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 180;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.13);
    });
  }catch(e){}
  if(navigator.vibrate) navigator.vibrate([80,60,80]);
}

// Короткий "удар" для попадания в Морском бою — намеренно резче и короче
// playSuccessSound (квадратная волна вместо синусоиды, нисходящий тон), чтобы
// не путаться с общим "успехом" остальных игр приложения.
function playHitSound(){
  if(state.muted) return;
  try{
    const ctx = getAudioCtx();
    if(!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.18);
  }catch(e){}
  if(navigator.vibrate) navigator.vibrate(40);
}
