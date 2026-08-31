// games/core.js — Общий каркас приложения: состояние (state), сохранение/загрузка, утилиты, wake lock, а также сама первая игра приложения — "Фанты для двоих" (экран настройки, подбор карт, экран игры, избранное, свои задания, свайпы). Здесь же живёт общая для ВСЕХ игр логика паузы и итогов (кнопки #resetHiddenBtn, #finishGameBtn, #closeSummaryBtn, updateResumeUI, blockedByDavayPause) — она исторически вплетена в этот файл и вызывает функции завершения других игр (finishXGame и т.д.) по имени, поэтому все games/*.js должны быть загружены ДО первого клика пользователя (порядок загрузки между ними не важен), а games/init.js — ПОСЛЕ всех остальных games/*.js (см. его собственный комментарий).
// Загружается через <script src="games/core.js"></script> в index.html.


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
let state = {
  name1:'', name2:'', activeLevels:[3,4,5,6],
  starter:'random',
  gameMode:'hot', autoMilestone:0, turnsPlayed:0, turnsAtLastLevelUp:0,
  currentPlayer:1, score1:0, score2:0,
  levelTurnCounts:{1:0, 2:0}, pendingLevelUp:false,
  levelCap:3, usedIndexes:[], hiddenIndexes:[],
  muted:false, autoSpeak:true, inProgress:false, completedCount:0, skippedCount:0,
  customCards:[], favoriteIndexes:[], favoritesOnly:false,
  photoUsed:{}, photoHidden:[], photoDone:[], sexshopOwned:[], photoSelectedLevel:1, photoFavView:false,
  photoOrderMode:false, photoSeqIndex:{},
  videoUsed:{}, videoHidden:[], videoLiked:[], videoFavoritesOnly:false, videoAutoAdvance:false, videoSoundOn:false,
  videoDbMigrated:false,
  davayUsed:{}, davayHidden:[], davayLiked:[], davayFavoritesOnly:false, davayAutoAdvance:false,
  davayFavYes:[], davayFavLater:[], davayFavNo:[],
  davayQuizActivePlayer:0, davayQuizQueue:[], davayQuizIndex:0, davayQuizAnswers:{},
  davayQuizP1Done:false, davayQuizP2Done:false, davayQuizPendingNext:0,
  davayStarter:'random', davaySelectedLevel:3, davaySoundOn:false,
  pausedMode:null,
  // Правда или действие
  tdSelectedLevel:3, tdCurrentPlayer:1, tdScore1:0, tdScore2:0, tdUsed:{}, tdHidden:[],
  tdCompletedCount:0, tdSkippedCount:0,
  tdLevelTurnCounts:{1:0, 2:0}, tdPendingLevelUp:false,
  // Секс-бинго
  bingoSelectedLevel:1, bingoGridLevel:0, bingoGrid:[], bingoChecked:[], bingoWonLines:[], bingoUsedBonus:[], bingoCurrentLevel:1,
  bingoEscalatedTo2:false, bingoEscalatedTo3:false, bingoVictoryMilestones:[], bingoFinished:false,
  bingoTasksHidden:false, bingoRevealed:[],
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
  partyPlayers:['Игрок 1','Игрок 2'], krokodilScores:[], krokodilSkipCounts:[], krokodilCurrentPlayerIndex:0,
  krokodilTurnsPlayed:0, krokodilRoundsPerPlayer:5,
  // Игры с детьми (список игроков отдельный от "Игры для компании")
  // kidsAge по умолчанию = 2 (7 лет) — см. просьбу сделать 7 лет базовым
  // возрастом раздела вместо прежних 5 лет.
  kidsPlayers:['Игрок 1','Игрок 2'], kidsAge:2,
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
  famZnayuFamilies:[{p1:'Игрок 1', p2:'Игрок 2', p1Gender:'m', p2Gender:'f'}],
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
  // Ровно 2 команды, в каждой мужчина и женщина ("m"/"f") — задания на поле
  // выполняются для своего партнёра по команде. luckyTeamTurnCount хранит,
  // сколько раз уже ходила каждая команда — по чётности переключает, кто
  // сейчас исполнитель (м или ж) внутри команды.
  luckyTeams:[{name:'Команда 1', m:'Он', f:'Она'},{name:'Команда 2', m:'Он', f:'Она'}],
  luckyTeamTurnCount:[0,0],
  luckyLevel:1, luckyGrid:[], luckyChecked:[], luckyCurrentTeamIndex:0,
  luckyCompleted:[], luckyWonLines:[], luckyEscalatedTo2:false, luckyEscalatedTo3:false,
  luckyFinished:false, luckyUsed:{}, luckyUsedBonus:[], luckyPendingBonusText:'', luckyBonusChecklist:[],
  luckyTasksHidden:false, luckyRevealed:[],
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
  ideasUsed:[], ideasFavorites:[], ideasFavView:false,
  // Секс-квест — очередь желаний текущей партии, счёт и результаты по
  // каждому желанию; sexQuestChecklists — история завершённых партий
  // ("чек-листы" в избранном, см. games/sexquest.js).
  sexQuestQueue:[], sexQuestIndex:0, sexQuestScore:0, sexQuestResults:[], sexQuestChecklists:[],
  // Настройки партии: сколько желаний играть (1/5/10/'all') и режим выбора —
  // 'random' (случайно из всего пула) или 'manual' (отмечены вручную в
  // sexQuestManualIds, см. модалку выбора вопросов в games/sexquest.js).
  sexQuestCount:1, sexQuestMode:'random', sexQuestManualIds:[],
  // Желания, исключённые крестиком из чек-листа — не участвуют в случайной
  // выдаче (но по-прежнему доступны для ручного выбора, см. sexquest.js).
  sexQuestExcluded:[],
  // Твистер — приложение только объявляет ходы, поле физическое
  twisterDuration:10,
  // Бизнес игры — список игроков отдельный от "Игры для компании"
  businessPlayers:['Игрок 1','Игрок 2'],
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
  // Флеш карты (дети) — flashTheme: тема подборки ('english'/'animals'),
  // flashThemeSize: 100 или 250 (объём подборки слов английского языка).
  // flashQueue/flashIndex — карточки текущей партии
  // (фиксированное количество, не бесконечная колода).
  flashMode:'learn', flashTheme:'english', flashThemeSize:100, flashTimeSub:'digital', flashCount:25,
  flashQueue:[], flashIndex:0, flashAutoSpeak:true,
  // Сапёр (дети) — настоящая сапёрская механика (минное поле, цифры,
  // флажки, победа/поражение). kidsSaperWonLines/kidsSaperEscalated* — устарели,
  // оставлены для обратной совместимости со старыми сохранениями.
  kidsSaperGrid:[], kidsSaperChecked:[], kidsSaperFlags:[], kidsSaperWonLines:[],
  kidsSaperUsedBonus:[],
  kidsSaperCurrentLevel:1, kidsSaperEscalatedTo2:false, kidsSaperEscalatedTo3:false,
  kidsSaperFinished:false, kidsSaperBonusChecklist:[], kidsSaperTasksHidden:true,
  // Виселица (компания) — без уровней, общий счёт побед/поражений
  partyHangmanWord:'', partyHangmanGuessed:[], partyHangmanWrong:0,
  partyHangmanUsedWords:[], partyHangmanWins:0, partyHangmanLosses:0,
  // Магазин (дети)
  shopMode:'buyer',
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
  businessLemonadeDay:1, businessLemonadeCapital:200,
  businessLemonadeUpgrades:{sign:false, music:false, recipe:false, seller:false, secondStand:false},
  businessLemonadeWeatherKey:'normal', businessLemonadeEventIdx:-1, businessLemonadeLocation:null,
  businessLemonadeHours:null, businessLemonadeOptions:{},
  businessLemonadeLemonStock:0, businessLemonadeLemonBoughtDay:null, businessLemonadeTeaStock:0, businessLemonadeCompetitorPrice:null,
  businessLemonadeLoanOwed:0, businessLemonadeLoanDueDay:null,
  businessLemonadeCups:10, businessLemonadePrice:40, businessLemonadeTeaCups:10, businessLemonadeTeaPrice:15, businessLemonadeDrinkType:'lemonade', businessLemonadeSold:0,
  businessLemonadeGoal:1000, businessLemonadeGoalName:'кафе',
  businessLemonadeRevenue:0, businessLemonadeNetProfit:0, businessLemonadeDayProfits:[], businessLemonadeDayLog:[],
  businessLemonadeQuizIndex:0, businessLemonadeQuizCorrect:0, businessLemonadeQuizItems:[],
  // Крестики-нолики (дети) — счёт партии переживает раунды, обнуляется только при выходе.
  // kidsXoBoardSize: 3 (3×3, три в ряд) или 5 (5×5, четыре в ряд).
  kidsXoBoard:[], kidsXoBoardSize:3, kidsXoCurrentPlayer:'X', kidsXoRoundOver:false, kidsXoStartingPlayer:'X',
  kidsXoScoreX:0, kidsXoScoreO:0, kidsXoDraws:0,
  // Крестики-нолики (для одного) — та же механика, но против бота: игрок
  // всегда крестики (X), бот всегда нолики (O).
  soloXoBoard:[], soloXoBoardSize:3, soloXoCurrentPlayer:'X', soloXoRoundOver:false, soloXoStartingPlayer:'X',
  soloXoScorePlayer:0, soloXoScoreBot:0, soloXoDraws:0,
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

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const s = JSON.parse(raw);
      state = Object.assign(state, s);
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
    }
  }catch(e){}
}
function saveState(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
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

// Список игроков для "Игры с детьми" — тот же паттерн, что renderPartyPlayers
// в games/krokodil.js, но отдельное состояние (kidsPlayers), т.к. это не
// связано с "Играми для компании": от 2 до 10, поля добавляются/удаляются
// кнопками, имена по умолчанию "Игрок N".
function renderKidsPlayers(){
  if(!state.kidsPlayers || state.kidsPlayers.length < 2){
    state.kidsPlayers = ['Игрок 1','Игрок 2'];
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
    input.placeholder = 'Игрок ' + (idx + 1);
    input.value = name;
    input.addEventListener('input', ()=>{
      state.kidsPlayers[idx] = input.value.trim() || ('Игрок ' + (idx + 1));
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
  if(!state.kidsPlayers) state.kidsPlayers = ['Игрок 1','Игрок 2'];
  if(state.kidsPlayers.length >= 10) return;
  state.kidsPlayers.push('Игрок ' + (state.kidsPlayers.length + 1));
  saveState();
  renderKidsPlayers();
});
renderKidsPlayers();
// Список игроков для "Бизнес игр" — тот же паттерн, что renderPartyPlayers/
// renderKidsPlayers, но отдельное состояние (businessPlayers).
function renderBusinessPlayers(){
  if(!state.businessPlayers || state.businessPlayers.length < 2){
    state.businessPlayers = ['Игрок 1','Игрок 2'];
  }
  const wrap = document.getElementById('businessPlayersList');
  if(!wrap) return;
  wrap.innerHTML = '';
  state.businessPlayers.forEach((name, idx)=>{
    const row = document.createElement('div');
    row.className = 'krokodil-player-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 14;
    input.placeholder = 'Игрок ' + (idx + 1);
    input.value = name;
    input.addEventListener('input', ()=>{
      state.businessPlayers[idx] = input.value.trim() || ('Игрок ' + (idx + 1));
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
  if(!state.businessPlayers) state.businessPlayers = ['Игрок 1','Игрок 2'];
  if(state.businessPlayers.length >= 10) return;
  state.businessPlayers.push('Игрок ' + (state.businessPlayers.length + 1));
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
document.getElementById('gameSexMapBtn').addEventListener('click', ()=>{
  showToast('Эта игра ещё в разработке 🚧 Загляните позже');
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
// "Крестики-нолики" (дети) — goToKidsXoSetup() определена в games/kids-xo.js.
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
// "Флеш карты" (обучающие игры) — goToFlashSetup() определена в games/kids-flash.js.
document.getElementById('gameLearningFlashBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToFlashSetup();
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
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._tm);
  showToast._tm = setTimeout(()=>t.classList.remove('show'), duration || 1800);
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
    renderModeGroup();
    renderLevelToggles();
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
  state.name1 = n1raw || 'Men';
  state.name2 = n2raw || 'Sexy';
  state.currentPlayer = pickStartingPlayer();
  state.score1 = 0; state.score2 = 0;
  state.autoMilestone = 0;
  state.turnsPlayed = 0; state.turnsAtLastLevelUp = 0;
  state.levelTurnCounts = {1:0, 2:0}; state.pendingLevelUp = false;
  state.completedCount = 0; state.skippedCount = 0;
  state.levelCap = getSortedActiveLevels()[0];
  state.inProgress = true;
  saveState();
  goToGame();
});
document.getElementById('videoExtraToggle').addEventListener('click', ()=>{
  document.querySelector('.controls').classList.toggle('video-extra-open');
});
// Пока партия "Давай попробуем" не завершена (стоит на паузе), весь блок
// "Выбери игру" скрыт (см. updateResumeUI) — эта проверка остаётся как
// подстраховка на случай прямого вызова обработчика.
// Человекочитаемые названия для всех режимов, которые умеют вставать на
// паузу через общий блок "Продолжить игру"/"Закончить игру" на главном экране.
const PAUSED_MODE_LABELS = {
  fanty: '«Фанты»',
  davay: '«Давай попробуем»',
  bingo: '«Секс-бинго»',
  krokodil: '«Крокодил»',
  td: '«Правда/Действие»',
  wishlist: '«Твои желания»',
  znayu: '«Тайные ответы»',
  timer: '«Таймер страсти»',
  partyFants: '«Фанты» (компания)',
  partyTd: '«Правда/Действие» (компания)',
  famZnayu: '«Знаю тебя» (компания)',
  lucky: '«Счастливый билет»',
  kidsMemory: '«Мемори»',
  kidsTd: '«Правда/Действие» (дети)',
  quiz: '«Викторина»',
  partyQuiz: '«Викторина» (компания)',
   kidsQuiz: '«Викторина» (дети)',
   soloBs: '«Морской бой» (бот)',
};
function blockedByDavayPause(){
  if(!state.pausedMode) return false;
  playErrorSound();
  const label = PAUSED_MODE_LABELS[state.pausedMode] || '«Правда/Действие»';
  showToast(`Сначала завершите ${label} — «Продолжить игру» или «Закончить игру»`);
  return true;
}
// Симметрично остальным abandonPausedXSession() — сбрасывает "чужую" паузу
// базовой парной игры "Фанты" (через общую pauseGame()), если вдруг
// начинается другая игра (страховка).
function abandonPausedFantySession(){
  if(state.pausedMode === 'fanty'){
    state.pausedMode = null;
  }
}
// Симметрично abandonPausedDavaySession() — сбрасывает "чужую" паузу
// "Правда или действие", если вдруг начинается другая игра (страховка,
// т.к. в обычном UI выбор игры скрыт, пока есть активная пауза).
function abandonPausedTdSession(){
  if(state.pausedMode === 'td'){
    state.pausedMode = null;
  }
}
// Симметрично abandonPausedTdSession() — сбрасывает "чужую" паузу
// "Секс-бинго", если вдруг начинается другая игра (страховка).
function abandonPausedBingoSession(){
  if(state.pausedMode === 'bingo'){
    state.pausedMode = null;
  }
}
// Симметрично остальным — сбрасывает "чужую" паузу «Крокодила» (страховка).
function abandonPausedKrokodilSession(){
  if(state.pausedMode === 'krokodil'){
    state.pausedMode = null;
  }
}
// Симметрично остальным — сбрасывает "чужие" паузы «Твоих желаний»,
// «Тайных ответов» и «Таймера страсти» (страховка).
function abandonPausedWishlistSession(){
  if(state.pausedMode === 'wishlist'){
    state.pausedMode = null;
  }
}
function abandonPausedZnayuSession(){
  if(state.pausedMode === 'znayu'){
    state.pausedMode = null;
  }
}
function abandonPausedTimerSession(){
  if(state.pausedMode === 'timer'){
    state.pausedMode = null;
  }
}
function abandonPausedPartyFantsSession(){
  if(state.pausedMode === 'partyFants'){
    state.pausedMode = null;
  }
}
function abandonPausedPartyTdSession(){
  if(state.pausedMode === 'partyTd'){
    state.pausedMode = null;
  }
}
function abandonPausedFamZnayuSession(){
  if(state.pausedMode === 'famZnayu'){
    state.pausedMode = null;
  }
}
function abandonPausedLuckySession(){
  if(state.pausedMode === 'lucky'){
    state.pausedMode = null;
  }
}
// Симметрично остальным — сбрасывает "чужую" паузу «Мемори» (страховка).
function abandonPausedKidsMemorySession(){
  if(state.pausedMode === 'kidsMemory'){
    state.pausedMode = null;
  }
}
// Симметрично остальным — сбрасывает "чужую" паузу «Правда/Действие» (дети).
function abandonPausedKidsTdSession(){
  if(state.pausedMode === 'kidsTd'){
    state.pausedMode = null;
  }
}
// Симметрично остальным — сбрасывает "чужие" паузы «Викторины» во всех трёх
// разделах (пары/компания/дети) — каждый раздел хранит свою игру отдельно.
function abandonPausedQuizSession(){
  if(state.pausedMode === 'quiz'){
    state.pausedMode = null;
  }
}
function abandonPausedPartyQuizSession(){
  if(state.pausedMode === 'partyQuiz'){
    state.pausedMode = null;
  }
}
// Симметрично остальным — сбрасывает "чужую" паузу «Викторины» (дети)
// (страховка).
function abandonPausedKidsQuizSession(){
  if(state.pausedMode === 'kidsQuiz'){
    state.pausedMode = null;
  }
}
// Симметрично остальным — сбрасывает "чужую" паузу «Морского боя (бот)»
// (страховка).
function abandonPausedSoloBsSession(){
  if(state.pausedMode === 'soloBs'){
    state.pausedMode = null;
  }
}
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
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToIdeasGame();
});
document.getElementById('gameTdBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToTdSetup();
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
// "Крестики-нолики" (игры для одного, против бота) — goToSoloXoSetup() определена в games/solo-xo.js.
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
  document.getElementById('setup').classList.remove('active');
  document.getElementById('fantySetup').classList.add('active');
  updateResumeUI();
}
document.getElementById('fantyExitBtn').addEventListener('click', ()=>{
  document.getElementById('fantySetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
});

document.getElementById('resumeBtn').addEventListener('click', ()=>{
  if(state.pausedMode === 'davay'){
    resumeDavayGame();
    return;
  }
  if(state.pausedMode === 'td'){
    resumeTdGame();
    return;
  }
  if(state.pausedMode === 'bingo'){
    resumeBingoGame();
    return;
  }
  if(state.pausedMode === 'krokodil'){
    resumeKrokodilGame();
    return;
  }
  if(state.pausedMode === 'wishlist'){
    resumeWishlistGame();
    return;
  }
  if(state.pausedMode === 'znayu'){
    resumeZnayuGame();
    return;
  }
  if(state.pausedMode === 'timer'){
    resumeTimerGame();
    return;
  }
  if(state.pausedMode === 'partyFants'){
    resumePartyFantsGame();
    return;
  }
  if(state.pausedMode === 'partyTd'){
    resumePartyTdGame();
    return;
  }
  if(state.pausedMode === 'famZnayu'){
    resumeFamZnayuGame();
    return;
  }
  if(state.pausedMode === 'lucky'){
    resumeLuckyGame();
    return;
  }
  if(state.pausedMode === 'kidsMemory'){
    resumeKidsMemoryGame();
    return;
  }
  if(state.pausedMode === 'kidsTd'){
    resumeKidsTdGame();
    return;
  }
  if(state.pausedMode === 'quiz'){
    resumeQuizGame();
    return;
  }
  if(state.pausedMode === 'partyQuiz'){
    resumePartyQuizGame();
    return;
  }
  if(state.pausedMode === 'kidsQuiz'){
    resumeKidsQuizGame();
    return;
  }
  if(state.pausedMode === 'soloBs'){
    resumeSoloBsGame();
    return;
  }
  goToGame();
});


document.getElementById('updateAppBtn').addEventListener('click', async ()=>{
  // Жёсткое обновление: сбрасываем Service Worker, очищаем ВСЕ кэши и
  // перезагружаем страницу. Это гарантирует, что браузер подтянет свежие
  // версии ВСЕХ файлов (JS, CSS, HTML), а не закэшированные.
  try{
    if('serviceWorker' in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.unregister()));
    }
    if('caches' in window){
      const keys = await caches.keys();
      await Promise.all(keys.map(k=>caches.delete(k)));
    }
    sessionStorage.setItem('appJustUpdated', '1');
  }catch(e){}
  const url = new URL(location.href);
  url.searchParams.set('_r', Date.now());
  location.replace(url.toString());
});

document.getElementById('resetHiddenBtn').addEventListener('click', ()=>{
  // Необратимое действие сразу по всем играм — подтверждение защищает от
  // случайного тапа (аналогично подтверждению при импорте бэкапа).
  if(!confirm('Сбросить весь прогресс во всех играх? Счёт, избранное, имена команд и историю совпадений будет не вернуть. Свои добавленные задания в «Фантах» при этом сохранятся. Это действие нельзя отменить.')){
    return;
  }
   // Обычная игра (карточки)
   state.hiddenIndexes = [];
   state.usedIndexes = [];
   // Имена игроков (команд) — сбрасываются на дефолтные, как обещано в диалоге
   // подтверждения ("имена команд… будут сброшены"). Возраст ребёнка (kidsAge)
   // остается — это настройка, а не прогресс.
   state.kidsPlayers = ['Игрок 1','Игрок 2'];
   state.businessPlayers = ['Игрок 1','Игрок 2'];
   state.partyPlayers = ['Игрок 1','Игрок 2'];
  state.gameMode = 'hot';
  state.activeLevels = [3,4,5,6];
  state.levelCap = 3;
  state.autoMilestone = 0;
  state.turnsAtLastLevelUp = 0;
  state.starter = 'random';
  state.favoritesOnly = false;
  state.favoriteIndexes = [];
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
  state.davaySelectedLevel = 3;
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
  state.bingoTasksHidden = false; state.bingoRevealed = [];
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
  state.ideasFavorites = [];
  state.ideasFavView = false;
  // Секс-квест
  state.sexQuestQueue = [];
  state.sexQuestIndex = 0;
  state.sexQuestScore = 0;
  state.sexQuestResults = [];
  state.sexQuestChecklists = [];
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
  state.kidsSaperUsedBonus = []; state.kidsSaperCurrentLevel = 1;
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
  // Викторина (один)
  state.soloQuizUsed = {}; state.soloQuizQueue = []; state.soloQuizIndex = 0;
  state.soloQuizCorrect = 0; state.soloQuizTimeMs = 0;
  // Мемори (один)
  state.soloMemoryDeck = []; state.soloMemorySteps = 0; state.soloMemoryElapsedMs = 0;
  state.soloMemoryLeaderboard = []; state.soloMemoryLastName = '';
  // Лимонадный ларёк (бизнес)
  state.businessLemonadeDay = 1; state.businessLemonadeCapital = 200;
  state.businessLemonadeUpgrades = {sign:false, music:false, recipe:false, seller:false, secondStand:false};
  state.businessLemonadeWeatherKey = 'normal'; state.businessLemonadeEventIdx = -1;
  state.businessLemonadeLocation = null; state.businessLemonadeHours = null; state.businessLemonadeOptions = {};
  state.businessLemonadeLemonStock = 0; state.businessLemonadeLemonBoughtDay = null; state.businessLemonadeTeaStock = 0;
  state.businessLemonadeCompetitorPrice = null;
  state.businessLemonadeLoanOwed = 0; state.businessLemonadeLoanDueDay = null;
  state.businessLemonadeCups = 10; state.businessLemonadePrice = 40; state.businessLemonadeSold = 0;
  state.businessLemonadeTeaCups = 10; state.businessLemonadeTeaPrice = 15; state.businessLemonadeTeaStock = 0; state.businessLemonadeDrinkType = 'lemonade';
  state.businessLemonadeRevenue = 0; state.businessLemonadeNetProfit = 0; state.businessLemonadeDayProfits = [];
  state.businessLemonadeDayLog = [];
  state.businessLemonadeGoal = 1000; state.businessLemonadeGoalName = 'кафе';
  state.businessLemonadeQuizIndex = 0; state.businessLemonadeQuizCorrect = 0; state.businessLemonadeQuizItems = [];
  // Крестики-нолики (дети)
  state.kidsXoBoard = []; state.kidsXoCurrentPlayer = 'X'; state.kidsXoRoundOver = false;
  state.kidsXoStartingPlayer = 'X'; state.kidsXoScoreX = 0; state.kidsXoScoreO = 0; state.kidsXoDraws = 0;
  // Крестики-нолики (для одного)
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
  state.luckyTeams = [{name:'Команда 1', m:'Он', f:'Она'},{name:'Команда 2', m:'Он', f:'Она'}];
  state.luckyTeamTurnCount = [0,0];
  state.luckyGrid = []; state.luckyChecked = []; state.luckyCurrentTeamIndex = 0;
  state.luckyCompleted = []; state.luckyWonLines = []; state.luckyLevel = 1;
  state.luckyEscalatedTo2 = false; state.luckyEscalatedTo3 = false; state.luckyFinished = false;
  state.luckyUsedBonus = []; state.luckyPendingBonusText = ''; state.luckyBonusChecklist = [];
  state.luckyTasksHidden = false; state.luckyRevealed = [];
  // Викторина (пары/компания/дети)
  state.quizUsed = {}; state.quizQueue = []; state.quizIndex = 0; state.quizCurrentPlayerIndex = 0;
  state.quizCorrect = []; state.quizTimeMs = [];
  state.partyQuizUsed = {}; state.partyQuizQueue = []; state.partyQuizIndex = 0; state.partyQuizCurrentPlayerIndex = 0;
  state.partyQuizCorrect = []; state.partyQuizTimeMs = [];
  state.kidsQuizUsed = {}; state.kidsQuizQueue = []; state.kidsQuizIndex = 0; state.kidsQuizCurrentPlayerIndex = 0;
  state.kidsQuizCorrect = []; state.kidsQuizTimeMs = [];
  saveState();
  renderModeGroup();
  renderLevelToggles();
  renderStarterGroup();
  renderDavaySetupStarterGroup();
  renderDavaySetupLevels();
  updateFavoritesOnlyBtn();
  updateResumeUI();
  clearAllVideoBlobs(); // архивное хранилище "Видеорулетки" — на всякий случай, обычно уже пусто после миграции
  clearAllDavayBlobs().then(()=>{
    importedDavayCards = [];
    importedDavayVideosLoaded = true;
  });
  showToast('Прогресс всех игр сброшен, добавленные видео удалены');
});

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
function goToGame(){
  abandonPausedDavaySession();
  abandonPausedTdSession();
  abandonPausedBingoSession();
  abandonPausedKrokodilSession();
  abandonPausedWishlistSession();
  abandonPausedZnayuSession();
  abandonPausedTimerSession();
  abandonPausedPartyFantsSession();
  abandonPausedPartyTdSession();
  abandonPausedFamZnayuSession();
  abandonPausedLuckySession();
  abandonPausedKidsMemorySession();
  abandonPausedKidsTdSession();
  abandonPausedFantySession();
  abandonPausedQuizSession();
  abandonPausedPartyQuizSession();
  abandonPausedKidsQuizSession();
  abandonPausedSoloBsSession();
  // Своя пауза Фантов сбрасывается явно (не через abandonPausedFantySession
  // — это возврат в СВОЮ же игру после паузы, а не "чужая" сессия), и здесь
  // же нужно закрыть глобальную модалку паузы (см. правку с пропавшими
  // кнопками паузы у базовых "Фантов" — раньше модалка не была скрыта
  // при resume, потому что goToGame() не вызывал updateResumeUI()).
  state.pausedMode = null;
  state.inProgress = true;
  saveState();
  updateResumeUI();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('fantySetup').classList.remove('active');
  document.getElementById('game').classList.remove('placeholder-mode');
  document.getElementById('game').classList.remove('video-mode');
  document.getElementById('game').classList.add('active');
  document.getElementById('doneBtn').textContent = '💕 Готово';
  document.getElementById('pauseBtn').textContent = 'Пауза';
  updateTurnUI();
  updateLevelUI();
  updateMuteBtn();
  requestWakeLock();
  drawCard();
}
function isPlaceholderMode(){
  const el = document.getElementById('game');
  return !!(el && el.classList.contains('placeholder-mode'));
}
function returnToSetupUI(){
  document.getElementById('game').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  document.getElementById('name1').value = state.name1 || '';
  document.getElementById('name2').value = state.name2 || '';
  updateStarterLabels();
  renderModeGroup();
  renderLevelToggles();
  updateResumeUI();
  releaseWakeLockNow();
}
// Пауза: выйти в настройки, не сбрасывая счёт и прогресс — можно продолжить позже
function pauseGame(){
  state.pausedMode = 'fanty';
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
// Клик по заблокированным во время паузы настройкам — подсказка вместо тишины
document.addEventListener('click', (e)=>{
  const lockedEl = e.target.closest('.locked-settings');
  if(lockedEl){
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    showToast('Завершите игру, чтобы изменить настройки', 2000);
  }
}, true);
// Единое меню паузы — одна и та же модалка (иконка+название игры,
// "Продолжить игру", "Закончить игру", кнопка звука) для абсолютно всех
// игр приложения, по центру экрана поверх всего (см. #pauseMenuModal).
const PAUSE_MENU_TITLES = {
  fanty: '💘 Фанты',
  davay: '🎬 Давай попробуем',
  td: '❓ Правда/Действие',
  bingo: '🎱 Секс-бинго',
  timer: '⏱️ Таймер страсти',
  wishlist: '💌 Твои желания',
  znayu: '💑 Тайные ответы',
  krokodil: '🐊 Крокодил',
  partyFants: '🎉 Фанты',
  partyTd: '🗣️ Правда/Действие (компания)',
  famZnayu: '🧠 Знаю тебя',
  lucky: '🎫 Счастливый билет',
  kidsMemory: '🧠 Мемори',
  kidsTd: '🗣️ Правда/Действие',
  quiz: '🎯 Викторина',
  partyQuiz: '🎯 Викторина',
   kidsQuiz: '🎯 Викторина',
   soloBs: '🚢 Морской бой (бот)',
};
function updateResumeUI(){
  const pauseModal = document.getElementById('pauseMenuModal');
  // Базовая парная игра "Фанты" (через общую pauseGame()/#pauseBtn) теперь
  // тоже выставляет state.pausedMode = 'fanty' (см. pauseGame()) — раньше
  // не выставляла, из-за чего модалка паузы вообще не показывалась и
  // кнопки "Продолжить игру"/"Закончить игру" у Фантов пропадали.
  if(pauseModal) pauseModal.classList.toggle('show', !!state.pausedMode);
  const pauseTitle = document.getElementById('pauseMenuTitle');
  if(pauseTitle){
    const name = PAUSE_MENU_TITLES[state.pausedMode] || '⏸️ Игра';
    pauseTitle.innerHTML = `${name}<span class="pause-title-sub">Пауза</span>`;
  }
  // В меню паузы (когда видны "Продолжить игру"/"Закончить игру") незачем
  // показывать выбор другой игры и резервную копию — только сама пауза.
  const gameSelectField = document.getElementById('gameSelectField');
  if(gameSelectField) gameSelectField.style.display = state.inProgress ? 'none' : '';
  // "Игры для компании" — исключение: если на паузе игра именно из этого
  // блока (Крокодил, Фанты-компания и т.д.), сам блок остаётся виден (там
  // же список игроков), хотя сами кнопки паузы теперь всегда в модалке.
  const isPartyPause = state.pausedMode === 'krokodil' || state.pausedMode === 'partyFants' || state.pausedMode === 'partyTd' || state.pausedMode === 'famZnayu' || state.pausedMode === 'lucky' || state.pausedMode === 'partyQuiz';
  const isKidsPause = state.pausedMode === 'kidsMemory' || state.pausedMode === 'kidsTd' || state.pausedMode === 'kidsQuiz';
  const isSoloPause = state.pausedMode === 'soloBs';
  const isTwoPlayerPause = !!state.pausedMode && !isPartyPause && !isKidsPause && !isSoloPause;
  const partyGameSelectField = document.getElementById('partyGameSelectField');
  if(partyGameSelectField) partyGameSelectField.style.display = (state.inProgress && !isPartyPause) ? 'none' : '';
  const kidsGameSelectField = document.getElementById('kidsGameSelectField');
  if(kidsGameSelectField) kidsGameSelectField.style.display = (state.inProgress && !isKidsPause) ? 'none' : '';
  const soloGameSelectList = document.getElementById('soloGameSelectList');
  if(soloGameSelectList) soloGameSelectList.style.display = (state.inProgress && !isSoloPause) ? 'none' : '';
  const backupField = document.getElementById('backupField');
  if(backupField) backupField.style.display = state.inProgress ? 'none' : '';
  // Пока игра компании на паузе — заголовок и описание блока меняются на
  // паузу этой игры.
  const partyTitleText = document.getElementById('partyGamesTitleText');
  const partyDesc = document.getElementById('partyGamesDesc');
  if(partyTitleText) partyTitleText.textContent = isPartyPause ? (PAUSE_MENU_TITLES[state.pausedMode] || '🎉 Игры для компании') : '🎉 Игры для компании';
  if(partyDesc) partyDesc.textContent = isPartyPause
    ? 'Счёт и игроки сохранены — продолжите партию или закончите её кнопкой выше.'
    : 'Шумные и весёлые игры для компании';
  // Симметрично "Играм для компании" — пока Мемори на паузе, заголовок и
  // описание блока "Игры с детьми" тоже меняются на паузу этой игры.
  const kidsTitleText = document.getElementById('kidsGamesTitleText');
  const kidsDesc = document.getElementById('kidsGamesDesc');
  if(kidsTitleText) kidsTitleText.textContent = isKidsPause ? (PAUSE_MENU_TITLES[state.pausedMode] || '🧸 Игры с детьми') : '🧸 Игры с детьми';
  if(kidsDesc) kidsDesc.textContent = isKidsPause
    ? 'Поле и счёт сохранены — продолжите партию или закончите её кнопкой выше.'
    : 'Весёлые игры, чтобы играть вместе с ребёнком';
  // Пока какая-нибудь игра на паузе — на #setup сразу открыт нужный блок
  // (игры для двоих / игры для компании / игры с детьми), чтобы после
  // "Закончить игру" не приходилось лишний раз возвращаться туда через главную.
  if(isPartyPause) showSetupView('companyView');
  else if(isKidsPause) showSetupView('kidsView');
  else if(isSoloPause) showSetupView('soloView');
  else if(isTwoPlayerPause) showSetupView('twoPlayerView');
  updateSettingsLockUI();
}

function updateTurnUI(){
  document.getElementById('score1').textContent = `${state.name1}: ${state.score1}`;
  document.getElementById('score2').textContent = `${state.name2}: ${state.score2}`;
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
    if(icon) icon.textContent = state.autoSpeak ? '🔊' : '🔇';
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

function updateLevelUI(){
  const btn = document.getElementById('levelUpBtn');
  if(isPlaceholderMode()){
    const atMax = photoLevel >= PHOTO_MAX_LEVEL;
    btn.disabled = false;
    btn.textContent = atMax ? 'Следующий' : 'Ещё варианты';
    const downBtn = document.getElementById('levelDownBtn');
    if(downBtn) downBtn.disabled = photoLevel <= 1;
    const el = document.getElementById('levelProgress');
    if(el) el.textContent = '';
    return;
  }
  if(isVideoMode() || isDavayMode()){
    btn.disabled = false;
    btn.textContent = 'Сложнее';
    const el = document.getElementById('levelProgress');
    if(el) el.textContent = '';
    return;
  }
  const levels = getSortedActiveLevels();
  const isMax = levels.indexOf(state.levelCap) === levels.length-1;
  btn.disabled = isMax;
  btn.textContent = isMax ? 'Максимальный уровень' : '🔥 Горячее';
  updateLevelProgressUI();
}

function updateLevelProgressUI(){
  const el = document.getElementById('levelProgress');
  if(!el) return;
  const levels = getSortedActiveLevels();
  const isMax = levels.indexOf(state.levelCap) === levels.length-1;
  if(isMax){ el.textContent = ''; return; }
  if(state.gameMode === 'romantic'){
    const target = ((state.autoMilestone||0)+1)*10;
    const cur = Math.min(state.score1, state.score2);
    el.textContent = `До след. уровня: ${Math.max(0, target-cur)} очк. (у обоих партнёров)`;
  } else if(state.gameMode === 'hot'){
    if(!state.autoMilestone){
      const cur = Math.max(state.score1, state.score2);
      el.textContent = `До след. уровня: ${Math.max(0, 5-cur)} очк.`;
    } else {
      const since = (state.turnsPlayed||0) - (state.turnsAtLastLevelUp||0);
      el.textContent = `До след. уровня: ${Math.max(0, 10-since)} карт`;
    }
  } else {
    el.textContent = '';
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
function fadeSwapCard(paintFn){
  const el = document.getElementById('card');
  const inner = el.querySelector('.card-inner');
  const doPaint = ()=>{
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
        ${card.image ? `
        <div class="card-split-media" id="placeholderMedia">
          <img src="${card.image}" alt="" id="placeholderImg">
        </div>
        ` : ''}
        <div class="card-split-desc" id="placeholderDesc">
          ${card.rank ? `<div class="card-split-rank-badge">№${card.rank}</div>` : ''}
          ${card.title ? `<div class="card-split-title">${card.title}</div>` : ''}
          <div class="card-text" id="placeholderText"></div>
          <div class="card-forwhom-row" id="placeholderForWhom"></div>
          <div class="card-rating-row" id="placeholderRating"></div>
        </div>
      </div>
    `;
    const img = document.getElementById('placeholderImg');
    if(img){
      img.addEventListener('error', ()=>{
        const media = document.getElementById('placeholderMedia');
        if(media) media.innerHTML = '<div class="card-icon">🃏</div>';
      });
      img.addEventListener('click', ()=>openImageZoom(card.image));
    }
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

/* ============ ВИДЕОРУЛЕТКА (видео из корневой папки проекта, см. cards_video.js) ============ */
// Прямая потоковая загрузка видео с Яндекс.Диска не работает: сервер Яндекса
// не разрешает браузеру читать видео с чужого домена (нет CORS-заголовков ни
// у списка файлов, ни у самих видео) — это ограничение на стороне Яндекса,
// обойти его без собственного сервера-прокси нельзя. Поэтому видео снова
// берутся только локально, из корневой папки проекта.

// Видео-заглушка на случай, если для уровня нет видео или файл не воспроизвёлся —
// используем образец из cards_video.js (первую запись), а не пустую иконку.
function getFallbackVideoCard(){
  if(typeof VIDEO_CARDS !== 'undefined' && Array.isArray(VIDEO_CARDS) && VIDEO_CARDS.length > 0){
    return VIDEO_CARDS[0];
  }
  return null;
}
// Когда в общем каталоге ("Давай попробуем") нет ни одного видео нужного
// уровня, вместо пустой заглушки-иконки включаем демо-видео (demo.webm,
// первая запись VIDEO_CARDS) — так "Видеорулетка" не выглядит сломанной.
// announceEmpty=true показывает тост-подсказку "Добавьте видео" — только при
// явном действии игрока (свайп/«Следующее»/«Горячее»), не при первом входе
// в игру и не при автопереключении по окончании ролика, чтобы не спамить.
function playFallbackVideoCard(level, announceEmpty){
  const fallback = getFallbackVideoCard();
  if(!fallback){ renderVideoPlaceholderCard(); return true; }
  if(announceEmpty){
    showToast('Своих видео пока нет — включили демо. Добавьте видео на странице «Давай попробуем»');
  }
  currentVideoCard = fallback;
  saveState();
  videoHistory.push(fallback);
  videoHistoryPos = videoHistory.length - 1;
  renderVideoCard(fallback, level);
  return true;
}
// Заглушка: показывается, если видео нет
// Заглушка: показывается, если для этого уровня в общем каталоге ("Давай
// попробуем") ещё нет видео. Видеорулетка своей отдельной колоды-образца
// больше не показывает (getFallbackVideoCard используется только при ошибке
// воспроизведения конкретного файла, см. renderVideoCard) — так поведение
// совпадает с "Давай попробуем", у которой то же самое пустое состояние.
function renderVideoPlaceholderCard(){
  clearInterval(timerInterval);
  timerInterval = null;
  currentCard = null;
  fadeSwapCard((card)=>{
    card.className = 'card card-empty';
    card.style.borderTop = '';
    card.innerHTML = `<div class="card-inner"><div class="card-icon">🎬</div><div class="card-text">Видео пока нет — добавьте их на странице «Давай попробуем» кнопкой «➕ Добавить видео»</div></div>`;
  });
}

function videoCardId(c){
  return c && (c.id || c.video);
}

// ===== Видео для "Видеорулетки" =====
// У "Видеорулетки" больше нет своей кнопки "Добавить видео" — она использует
// тот же общий каталог, что и "Давай попробуем" (getDavayCardsList() ниже, в
// разделе давай-попробуем-видео). Здесь остаётся только доступ к её СТАРОМУ,
// теперь архивному хранилищу IndexedDB (LovePlayVideoDB) — он нужен только
// для одноразового переноса ранее добавленных видео в общий каталог (см.
// migrateVideoDbIntoDavay ниже) и для "Сбросить прогресс".
const VIDEO_DB_NAME = 'LovePlayVideoDB';
const VIDEO_DB_STORE = 'videos';
let videoDBPromise = null;

function openVideoDB(){
  if(videoDBPromise) return videoDBPromise;
  videoDBPromise = new Promise((resolve, reject)=>{
    if(!('indexedDB' in window)){ reject(new Error('IndexedDB не поддерживается')); return; }
    const req = indexedDB.open(VIDEO_DB_NAME, 1);
    req.onupgradeneeded = ()=>{
      const db = req.result;
      if(!db.objectStoreNames.contains(VIDEO_DB_STORE)){
        db.createObjectStore(VIDEO_DB_STORE, {keyPath:'id', autoIncrement:true});
      }
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
  return videoDBPromise;
}
function loadAllVideoBlobs(){
  return openVideoDB().then(db => new Promise((resolve, reject)=>{
    const tx = db.transaction(VIDEO_DB_STORE, 'readonly');
    const req = tx.objectStore(VIDEO_DB_STORE).getAll();
    req.onsuccess = ()=> resolve(req.result || []);
    req.onerror = ()=> reject(req.error);
  }));
}
function clearAllVideoBlobs(){
  return openVideoDB().then(db => new Promise((resolve, reject)=>{
    const tx = db.transaction(VIDEO_DB_STORE, 'readwrite');
    tx.objectStore(VIDEO_DB_STORE).clear();
    tx.oncomplete = ()=> resolve();
    tx.onerror = ()=> reject(tx.error);
  })).catch(()=>{});
}

const VIDEO_MAX_LEVEL = 4;
let videoLevel = 1;
let currentVideoCard = null;
let videoHistory = []; // для свайпов влево/вправо между уже показанными видео
let videoHistoryPos = -1;
let videoSoundOn = false;
function updateVideoMuteBtn(){
  const btn = document.getElementById('videoMuteBtn');
  if(!btn) return;
  btn.textContent = videoSoundOn ? '🔊' : '🔇';
  btn.setAttribute('aria-label', videoSoundOn ? 'Выключить звук видео' : 'Включить звук видео');
}
function setVideoSoundOn(on){
  videoSoundOn = on;
  state.videoSoundOn = on;
  saveState();
  const video = document.getElementById('videoPlayer');
  if(video) video.muted = !videoSoundOn;
  updateVideoMuteBtn();
}
document.getElementById('videoMuteBtn').addEventListener('click', ()=>{
  setVideoSoundOn(!videoSoundOn);
});

function updateVideoLoopBtn(){
  const btn = document.getElementById('videoLoopBtn');
  if(!btn) return;
  btn.classList.toggle('active', !!state.videoAutoAdvance);
  btn.setAttribute('aria-label', state.videoAutoAdvance
    ? 'Выключить автопереключение на следующее видео'
    : 'Включить автопереключение на следующее видео');
}
document.getElementById('videoLoopBtn').addEventListener('click', ()=>{
  state.videoAutoAdvance = !state.videoAutoAdvance;
  saveState();
  updateVideoLoopBtn();
  const video = document.getElementById('videoPlayer');
  if(video) video.loop = !state.videoAutoAdvance;
  showToast(state.videoAutoAdvance
    ? 'Автопереключение включено 🔁'
    : 'Видео будет повторяться само');
});

// Флаги "мы сейчас в полноэкранном режиме видео" — чтобы при переходе на
// следующее/предыдущее видео (свайп или кнопка) снова включать полный экран
// автоматически, а не только для одного ролика.
let videoFullscreenActive = false; // обычный Fullscreen API (карточка целиком)
let videoNativeFullscreenActive = false; // нативный полноэкранный режим iOS (только видео)
const isIOSDevice = /iP(hone|ad|od)/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

document.addEventListener('fullscreenchange', ()=>{
  videoFullscreenActive = !!document.fullscreenElement;
  davayFullscreenActive = !!document.fullscreenElement;
});
document.addEventListener('webkitfullscreenchange', ()=>{
  videoFullscreenActive = !!document.webkitFullscreenElement;
  davayFullscreenActive = !!document.webkitFullscreenElement;
});

// Общий вход/выход из полноэкранного режима для видео в "Видеорулетке" и
// "Давай попробуем" — используется и ручной кнопкой ⛶, и авто-переключением
// при повороте экрана (см. handleOrientationFullscreen ниже).
function getActiveGameVideoEl(){
  return document.getElementById('videoPlayer') || document.getElementById('davayPlayer');
}
function isCardFullscreenActive(){
  return !!(document.fullscreenElement || document.webkitFullscreenElement
    || videoNativeFullscreenActive || davayNativeFullscreenActive);
}
function enterCardFullscreen(){
  const videoEl = document.getElementById('videoPlayer');
  const davayEl = document.getElementById('davayPlayer');
  const video = videoEl || davayEl;
  const cardEl = document.getElementById('card');
  if(!video || !cardEl || isCardFullscreenActive()) return;
  // На iPhone/iPad свайпы во время полного экрана работать не будут — это
  // системный полноэкранный плеер видео, страница туда "не достаёт" жестами.
  // На остальных устройствах разворачиваем всю карточку (не только видео),
  // тогда свайпы продолжают работать и полный экран сохраняется при
  // переключении на следующее/предыдущее видео.
  if(isIOSDevice && video.webkitEnterFullscreen){
    try{
      video.webkitEnterFullscreen();
      if(videoEl) videoNativeFullscreenActive = true;
      if(davayEl) davayNativeFullscreenActive = true;
      return;
    } catch(err){ /* падаем ниже на стандартный способ */ }
  }
  try{
    if(cardEl.requestFullscreen){
      const result = cardEl.requestFullscreen();
      if(result && typeof result.catch === 'function'){
        result.catch(()=>{
          if(cardEl.webkitRequestFullscreen) cardEl.webkitRequestFullscreen();
        });
      }
      return;
    }
    if(cardEl.webkitRequestFullscreen){
      cardEl.webkitRequestFullscreen();
    }
  } catch(err){ /* полный экран недоступен — просто остаёмся в обычном виде */ }
}
function exitCardFullscreen(){
  try{
    if(document.fullscreenElement && document.exitFullscreen){
      document.exitFullscreen();
    } else if(document.webkitFullscreenElement && document.webkitExitFullscreen){
      document.webkitExitFullscreen();
    }
  } catch(err){}
  const video = getActiveGameVideoEl();
  if(isIOSDevice && video && video.webkitDisplayingFullscreen && video.webkitExitFullscreen){
    try{ video.webkitExitFullscreen(); } catch(err){}
  }
}
function toggleVideoFullscreen(){
  if(isCardFullscreenActive()){
    exitCardFullscreen();
    return;
  }
  const video = document.getElementById('videoPlayer');
  const cardEl = document.getElementById('card');
  if(!video || !cardEl) return;
  if(!(isIOSDevice && video.webkitEnterFullscreen) && !cardEl.requestFullscreen && !cardEl.webkitRequestFullscreen){
    showToast('Полный экран не поддерживается на этом устройстве');
    return;
  }
  enterCardFullscreen();
}
document.getElementById('videoFullscreenBtn').addEventListener('click', toggleVideoFullscreen);

function updateVideoFavoritesBtn(){
  const btn = document.getElementById('videoFavoritesBtn');
  if(!btn) return;
  btn.classList.toggle('active', !!state.videoFavoritesOnly);
  btn.setAttribute('aria-label', state.videoFavoritesOnly ? 'Показывать все видео' : 'Только избранное');
}
document.getElementById('videoFavoritesBtn').addEventListener('click', ()=>{
  if(!state.videoFavoritesOnly && (state.videoLiked||[]).length===0){
    playErrorSound();
    showToast('Сначала добавьте видео в избранное сердечком 🤍');
    return;
  }
  state.videoFavoritesOnly = !state.videoFavoritesOnly;
  saveState();
  updateVideoFavoritesBtn();
  showToast(state.videoFavoritesOnly ? 'Показываю только избранное ⭐' : 'Показываю все видео');
  drawVideoCard(videoLevel || 1);
});

// Подгоняет ширину/aspect-ratio карточки под текущее видео и доступную
// область (.card-area). Высота карточки всегда занимает всё доступное
// место; ширину сужаем только если видео "уже" области (портретное) — для
// широких видео ширина остаётся на весь экран, чтобы высота не уменьшилась.
// Вызывается и при загрузке видео, и при повороте экрана (см. ниже), чтобы
// уже открытое видео корректно перестраивалось под новую ориентацию.
function fitCardVideoToArea(video, el){
  if(!video || !el || !(video.videoWidth && video.videoHeight)) return;
  const area = document.querySelector('.card-area');
  const availW = area ? area.clientWidth : window.innerWidth;
  const availH = area ? area.clientHeight : window.innerHeight;
  const videoRatio = video.videoWidth / video.videoHeight;
  const areaRatio = availW / (availH || 1);
  if(videoRatio <= areaRatio){
    el.style.width = 'auto';
    el.style.aspectRatio = video.videoWidth + ' / ' + video.videoHeight;
  } else {
    el.style.width = '100%';
    el.style.aspectRatio = '';
  }
}
// true, только если сейчас реально открыт игровой экран в режиме
// "Видеорулетка" или "Давай попробуем" — на всех остальных страницах
// (главное меню, Фанты, Предложи партнеру, новые мини-игры и т.д.)
// поворот экрана ни на что не влияет.
function isActiveVideoOrDavayMode(){
  const gameEl = document.getElementById('game');
  return !!(gameEl && gameEl.classList.contains('active')
    && (gameEl.classList.contains('video-mode') || gameEl.classList.contains('davay-mode')));
}
// Принудительная вертикальная ориентация везде, кроме "Видеорулетки" и
// "Давай попробуем". Раньше это делалось визуальным разворотом #app на 90°
// через CSS transform — от него то и дело оставались белые полосы и
// заметный глазу "щелчок" при повороте (см. комментарий у #rotateStub в
// стилях). Вместо трансформации просто показываем заглушку с просьбой
// повернуть телефон обратно поверх всего — никаких трансформаций и
// пересчётов размеров, а значит и нечему давать сбой.
function updateForcedPortraitLock(){
  const html = document.documentElement;
  const stub = document.getElementById('rotateStub');
  let isLandscape = false;
  try{ isLandscape = window.matchMedia('(orientation: landscape)').matches; }catch(e){}
  // orientation:landscape срабатывает просто от широкого окна, а не только от
  // реального поворота телефона — на десктопе обычное окно браузера почти
  // всегда "landscape", и без этой проверки заглушка показывалась бы прямо
  // при открытии в браузере на компьютере. Поэтому включаем её только на
  // устройствах с сенсорным (неточным) вводом — там же, где вообще бывает
  // физический поворот экрана.
  let isTouchDevice = false;
  try{ isTouchDevice = window.matchMedia('(pointer: coarse)').matches; }catch(e){}
  const isActiveMedia = isActiveVideoOrDavayMode();
  const shouldLock = isLandscape && isTouchDevice && !isActiveMedia;
  // В "Видеорулетке"/"Давай попробуем" поворот на бок не блокируется — экран
  // остаётся горизонтальным, чтобы видео заняло максимум места. Но обычная
  // медиа-настройка #app (колонка максимум 480px по центру, для комфортного
  // вида на компьютере) в этом случае тоже срабатывает от одной лишь ширины
  // окна и сжимает приложение в узкую рамку прямо посреди широкого
  // горизонтального экрана телефона. Отдельным классом снимаем это
  // ограничение именно на время активного видео-режима в ландшафте.
  html.classList.toggle('video-landscape-fill', isLandscape && isTouchDevice && isActiveMedia);
  if(stub) stub.classList.toggle('show', shouldLock);
}
window.addEventListener('orientationchange', updateForcedPortraitLock);
window.addEventListener('resize', updateForcedPortraitLock);
if(window.visualViewport) window.visualViewport.addEventListener('resize', updateForcedPortraitLock);
// #game — общий экран для Фантов/Видеорулетки/"Давай попробуем": входы и
// выходы из видео-режимов всегда меняют его класс, поэтому достаточно
// следить за атрибутом class именно этого экрана, чтобы блокировка
// включалась/выключалась сразу при переходе между играми, а не только по
// факту физического поворота.
(function watchGameModeForPortraitLock(){
  const gameEl = document.getElementById('game');
  if(gameEl && window.MutationObserver){
    new MutationObserver(updateForcedPortraitLock).observe(gameEl, {attributes:true, attributeFilter:['class']});
  }
  updateForcedPortraitLock();
})();
// При повороте телефона пересчитываем размер уже открытого видео в
// "Видеорулетке"/"Давай попробуем" под новую ориентацию экрана.
function refitCurrentCardVideo(){
  if(!isActiveVideoOrDavayMode()) return;
  const el = document.getElementById('card');
  if(!el) return;
  const video = document.getElementById('videoPlayer') || document.getElementById('davayPlayer');
  if(video) fitCardVideoToArea(video, el);
}
// Поворот в горизонтальное положение — видео разворачивается на весь экран;
// поворот обратно в вертикальное — полноэкранный режим снимается сам.
function handleOrientationFullscreen(){
  if(!isActiveVideoOrDavayMode()) return;
  const isLandscape = window.matchMedia('(orientation: landscape)').matches;
  if(isLandscape){
    enterCardFullscreen();
  } else {
    exitCardFullscreen();
  }
}
window.addEventListener('orientationchange', ()=>{
  setTimeout(()=>{
    refitCurrentCardVideo();
    handleOrientationFullscreen();
  }, 250);
});
if(window.visualViewport){
  window.visualViewport.addEventListener('resize', refitCurrentCardVideo);
} else {
  window.addEventListener('resize', refitCurrentCardVideo);
}

function updateVideoLevelBtn(){
  const btn = document.getElementById('videoLevelUpBtn');
  if(!btn) return;
  btn.disabled = videoLevel >= VIDEO_MAX_LEVEL;
}
function drawVideoCard(level, announceEmpty){
  videoLevel = level;
  updateVideoLevelBtn();
  const hidden = state.videoHidden || [];
  const liked = state.videoLiked || [];
  // Видео берутся из общего каталога "Давай попробуем" — своей отдельной
  // колоды у "Видеорулетки" больше нет.
  let all = getDavayCardsList().filter(c=>c.level===level && !hidden.includes(videoCardId(c)));
  if(state.videoFavoritesOnly){
    all = all.filter(c=>liked.includes(videoCardId(c)));
  }
  if(all.length===0){
    currentVideoCard = null;
    if(state.videoFavoritesOnly){
      showToast('В избранном пока нет видео');
      state.videoFavoritesOnly = false;
      saveState();
      updateVideoFavoritesBtn();
      all = getDavayCardsList().filter(c=>c.level===level && !hidden.includes(videoCardId(c)));
      if(all.length===0){ return playFallbackVideoCard(level, announceEmpty); }
    } else {
      return playFallbackVideoCard(level, announceEmpty);
    }
  }
  if(!state.videoUsed) state.videoUsed = {};
  let used = state.videoUsed[level] || [];
  let pool = all.filter(c=>!used.includes(videoCardId(c)));
  if(pool.length===0){
    pool = all;
    used = [];
    showToast('Видео этого уровня показаны заново 🔀');
  }
  const card = pool[Math.floor(Math.random()*pool.length)];
  used.push(videoCardId(card));
  state.videoUsed[level] = used;
  currentVideoCard = card;
  saveState();
  // Новое видео всегда дописывается в конец истории (ничего не теряем,
  // даже если до этого свайпали назад) — так свайп влево всегда может
  // довести обратно до самого первого показанного видео.
  videoHistory.push(card);
  videoHistoryPos = videoHistory.length - 1;
  renderVideoCard(card, level);
  return false;
}

// Показать видео из истории (свайпы влево/вправо), не трогая "показанные"/избранное
function renderVideoCardFromHistory(pos){
  if(pos < 0 || pos >= videoHistory.length) return;
  videoHistoryPos = pos;
  currentVideoCard = videoHistory[pos];
  renderVideoCard(currentVideoCard, videoLevel);
}

function videoSwipePrev(){
  // Бесконечная прокрутка: если в истории раньше некуда — просто показываем
  // новое случайное видео, а не упираемся в сообщение "это первое видео".
  if(videoHistoryPos <= 0){
    drawVideoCard(videoLevel, true);
    return;
  }
  renderVideoCardFromHistory(videoHistoryPos - 1);
}

function videoSwipeNext(){
  if(videoHistoryPos < videoHistory.length - 1){
    renderVideoCardFromHistory(videoHistoryPos + 1);
  } else {
    drawVideoCard(videoLevel, true);
  }
}

// Общая настройка <video> для "Видеорулетки" — вынесена отдельно от
// renderVideoCard, чтобы можно было применить её и к УЖЕ существующему
// элементу (reuse=true), а не только к только что вставленному через
// innerHTML (reuse=false). См. причину в renderVideoCard ниже.
function setupVideoPlayerElement(video, card, level, reuse){
  video.muted = !videoSoundOn;
  video.loop = !state.videoAutoAdvance;
  if(reuse){
    // Меняем src у уже существующего элемента вместо пересоздания — именно
    // это позволяет iOS не закрывать нативный полноэкранный плеер.
    video.src = card.video;
    video.load();
  }
  // Атрибут autoplay сам по себе не всегда срабатывает для видео,
  // вставленного динамически (особенно при быстрых свайпах подряд) —
  // из-за этого видео иногда "зависало" на первом кадре и не играло, а
  // проблема тянулась и на все следующие карточки. Запускаем воспроизведение
  // явно и, если браузер отклонил первую попытку, пробуем ещё раз.
  const attemptPlay = ()=>{
    const p = video.play();
    if(p && typeof p.catch === 'function'){
      p.catch(()=>{ setTimeout(()=>{ video.play().catch(()=>{}); }, 150); });
    }
  };
  attemptPlay();
  const cardEl = document.getElementById('card');
  // {once:true} — при reuse=true эти слушатели навешиваются заново на каждую
  // смену видео на одном и том же элементе; без once они бы копились один
  // поверх другого при каждом переключении.
  video.addEventListener('loadedmetadata', ()=>{
    // Высота карточки всегда занимает всё доступное место. Ширину сужаем
    // под видео, только если оно "уже" доступной области (портретное) —
    // тогда по бокам не остаётся пустого места. Если видео горизонтальное
    // и шире экрана, ширину карточки не трогаем (остаётся на весь экран),
    // чтобы высота не уменьшилась — такое видео просто обрежется по бокам.
    fitCardVideoToArea(video, cardEl);
    // iOS: если предыдущее видео смотрели в полном экране — открываем
    // следующее тоже сразу в полном экране (обычный <video> без этого
    // каждый раз сбрасывается в обычный режим). Вызывать это нужно именно
    // после loadedmetadata — сразу после вставки нового <video> в DOM
    // (readyState ещё 0) webkitEnterFullscreen молча не срабатывает, и
    // видео при автопереключении/повторе показывалось уже не на весь экран.
    if(videoNativeFullscreenActive && video.webkitEnterFullscreen && !video.webkitDisplayingFullscreen){
      try{ video.webkitEnterFullscreen(); } catch(err){}
    }
  }, {once:true});
  video.addEventListener('error', ()=>{
    const fallback = getFallbackVideoCard();
    // Если сломался не сам образец — показываем вместо него образец из
    // cards_video.js. Если сломался и он тоже — тогда уже просто иконка,
    // чтобы не зациклиться.
    if(fallback && card.video !== fallback.video){
      renderVideoCard(fallback, level);
      return;
    }
    const media = document.getElementById('videoMedia');
    if(media) media.innerHTML = '<div class="card-icon">🎬</div>';
  }, {once:true});
  video.addEventListener('ended', ()=>{
    if(state.videoAutoAdvance) drawVideoCard(videoLevel);
  }, {once:true});
  if(!reuse){
    video.addEventListener('webkitendfullscreen', ()=>{ videoNativeFullscreenActive = false; });
  }
}
function renderVideoCard(card, level){
  clearInterval(timerInterval);
  timerInterval = null;
  currentCard = null;
  // Пока видео открыто в НАТИВНОМ полноэкранном режиме iOS
  // (webkitEnterFullscreen), обычная пересборка карточки (fadeSwapCard)
  // полностью уничтожает и создаёт заново <video> через innerHTML — а
  // системный полноэкранный плеер iOS привязан именно к этому DOM-узлу.
  // Когда узел исчезает, iOS принудительно и ЗАМЕТНО закрывает полный
  // экран, и следующее видео открывалось уже не сразу в полном экране, а с
  // видимым "миганием" обратно на карточку с кнопками управления. Пока мы
  // в полном экране, вместо пересборки карточки просто меняем src у уже
  // существующего <video> — iOS продолжает показывать тот же системный
  // плеер без выхода из полного экрана, и видео идут одно за другим уже в
  // развёрнутом виде.
  const existingVideo = document.getElementById('videoPlayer');
  if(videoNativeFullscreenActive && existingVideo){
    setupVideoPlayerElement(existingVideo, card, level, true);
    updateVideoMuteBtn();
    updateVideoLoopBtn();
    updateVideoFavoritesBtn();
    updateFavoriteBtn();
    return;
  }
  fadeSwapCard((el)=>{
    el.className = 'card card-empty';
    el.style.borderTop = '';
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-split-media" id="videoMedia">
          <video src="${card.video}" id="videoPlayer" playsinline autoplay></video>
        </div>
      </div>
    `;
    const video = document.getElementById('videoPlayer');
    if(video) setupVideoPlayerElement(video, card, level, false);
    updateVideoMuteBtn();
    updateVideoLoopBtn();
    updateVideoFavoritesBtn();
  });
  updateFavoriteBtn();
}

async function goToVideoGame(){
  abandonPausedDavaySession();
  abandonPausedTdSession();
  abandonPausedBingoSession();
  abandonPausedKrokodilSession();
  abandonPausedWishlistSession();
  abandonPausedZnayuSession();
  abandonPausedTimerSession();
  abandonPausedPartyFantsSession();
  abandonPausedPartyTdSession();
  abandonPausedFamZnayuSession();
  abandonPausedLuckySession();
  abandonPausedKidsMemorySession();
  abandonPausedKidsTdSession();
  abandonPausedFantySession();
  abandonPausedQuizSession();
  abandonPausedPartyQuizSession();
  abandonPausedKidsQuizSession();
  abandonPausedSoloBsSession();
  const n1raw = document.getElementById('name1').value.trim();
  const n2raw = document.getElementById('name2').value.trim();
  state.name1 = n1raw || 'Men';
  state.name2 = n2raw || 'Sexy';
  state.currentPlayer = pickStartingPlayer();
  state.score1 = 0; state.score2 = 0;
  state.autoMilestone = 0;
  state.turnsPlayed = 0; state.turnsAtLastLevelUp = 0;
  state.levelTurnCounts = {1:0, 2:0}; state.pendingLevelUp = false;
  state.completedCount = 0; state.skippedCount = 0;
  state.inProgress = true;
  videoLevel = 1;
  state.videoUsed = {};
  state.videoHidden = [];
  // Новая партия — всегда все видео, а не режим "только избранное" (иначе
  // после захода в избранное через сердечко на davaySetup игра застревала
  // бы в этом фильтре). Аналогично сделано для "Давай попробуем".
  state.videoFavoritesOnly = false;
  videoHistory = [];
  videoHistoryPos = -1;
  saveState();
  document.querySelector('.controls').classList.remove('video-extra-open');
  // В "Видеорулетке" кнопка "Выход" всегда на виду — переносим её в верхний
  // ряд, после сердечка (в других режимах она остаётся в обычном месте).
  document.querySelector('.row1').appendChild(document.getElementById('pauseBtn'));
  // Запуск идёт с экрана настройки "Давай попробуем" — его тоже нужно скрыть,
  // иначе "Видеорулетка" открывается поверх/вместе с меню настроек, а не как
  // отдельная полноценная страница (как #setup у обычных игр).
  document.getElementById('davaySetup').classList.remove('active');
  document.getElementById('setup').classList.remove('active');
  document.getElementById('game').classList.add('active');
  document.getElementById('game').classList.add('video-mode');
  document.getElementById('doneBtn').textContent = 'Следующее';
  document.getElementById('pauseBtn').textContent = 'Выход';
  updateTurnUI();
  updateLevelUI();
  updateMuteBtn();
  updateVideoFavoritesBtn();
  requestWakeLock();
  await ensureImportedDavayVideosLoaded();
  drawVideoCard(videoLevel);
}

// Уровень, с которого нужно начать просмотр избранного видео из "Видеорулетки" —
// первый уровень, где реально есть хоть одно понравившееся видео. Если просто
// стартовать с уровня 1, drawVideoCard() при пустом уровне сам сбросит фильтр
// "только избранное" и покажет случайное НЕ понравившееся видео — не то, что
// ожидает пользователь, нажимая на кнопку с сердечком.
function pickVideoFavoritesStartLevel(){
  const liked = state.videoLiked || [];
  const hidden = state.videoHidden || [];
  for(let lvl=1; lvl<=VIDEO_MAX_LEVEL; lvl++){
    const has = getDavayCardsList().some(c=>c.level===lvl && !hidden.includes(videoCardId(c)) && liked.includes(videoCardId(c)));
    if(has) return lvl;
  }
  return 1;
}
// Быстрый переход в "Видеорулетку" сразу с фильтром "только избранное" — по
// кнопке с сердечком рядом с "🎥 Видеорулетка" на странице настройки "Давай
// попробуем". Хранится это избранное в state.videoLiked — отдельно от
// избранного "Давай попробуем" (state.davayLiked), т.к. лайки ставятся по
// каждой игре отдельно, хотя видео и берутся из одного каталога.
async function goToVideoFavoritesView(){
  abandonPausedDavaySession();
  abandonPausedTdSession();
  abandonPausedBingoSession();
  abandonPausedKrokodilSession();
  abandonPausedWishlistSession();
  abandonPausedZnayuSession();
  abandonPausedTimerSession();
  abandonPausedPartyFantsSession();
  abandonPausedPartyTdSession();
  abandonPausedFamZnayuSession();
  abandonPausedLuckySession();
  abandonPausedKidsMemorySession();
  abandonPausedKidsTdSession();
  abandonPausedFantySession();
  abandonPausedQuizSession();
  abandonPausedPartyQuizSession();
  abandonPausedKidsQuizSession();
  abandonPausedSoloBsSession();
  const n1raw = document.getElementById('name1').value.trim();
  const n2raw = document.getElementById('name2').value.trim();
  state.name1 = n1raw || 'Men';
  state.name2 = n2raw || 'Sexy';
  state.currentPlayer = pickStartingPlayer();
  state.score1 = 0; state.score2 = 0;
  state.autoMilestone = 0;
  state.turnsPlayed = 0; state.turnsAtLastLevelUp = 0;
  state.levelTurnCounts = {1:0, 2:0}; state.pendingLevelUp = false;
  state.completedCount = 0; state.skippedCount = 0;
  state.inProgress = true;
  await ensureImportedDavayVideosLoaded();
  videoLevel = pickVideoFavoritesStartLevel();
  state.videoUsed = {};
  state.videoHidden = [];
  state.videoFavoritesOnly = true;
  videoHistory = [];
  videoHistoryPos = -1;
  saveState();
  document.querySelector('.controls').classList.remove('video-extra-open');
  document.querySelector('.row1').appendChild(document.getElementById('pauseBtn'));
  document.getElementById('davaySetup').classList.remove('active');
  document.getElementById('setup').classList.remove('active');
  document.getElementById('game').classList.add('active');
  document.getElementById('game').classList.add('video-mode');
  document.getElementById('doneBtn').textContent = 'Следующее';
  document.getElementById('pauseBtn').textContent = 'Выход';
  updateTurnUI();
  updateLevelUI();
  updateMuteBtn();
  updateVideoFavoritesBtn();
  requestWakeLock();
  drawVideoCard(videoLevel);
}

function exitVideoGame(){
  state.inProgress = false;
  saveState();
  if(document.fullscreenElement) document.exitFullscreen();
  videoFullscreenActive = false;
  videoNativeFullscreenActive = false;
  // Останавливаем видео полностью, иначе оно продолжает играть в фоне после выхода
  const video = document.getElementById('videoPlayer');
  if(video){
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
  currentVideoCard = null;
  // Сбрасываем подогнанные под видео размеры карточки, чтобы они не остались
  // висеть в других режимах игры
  document.getElementById('card').style.aspectRatio = '';
  document.getElementById('card').style.width = '';
  // Возвращаем кнопку "Пауза" на обычное место (конец второго ряда)
  document.querySelector('.row2').appendChild(document.getElementById('pauseBtn'));
  document.getElementById('game').classList.remove('video-mode');
  document.getElementById('doneBtn').textContent = '💕 Готово';
  document.getElementById('pauseBtn').textContent = 'Пауза';
  returnToSetupUI();
}

function isVideoMode(){
  const el = document.getElementById('game');
  return !!(el && el.classList.contains('video-mode'));
}

/* ============ ДАВАЙ ПОПРОБУЕМ (независимая копия "Видеорулетки") ============
   Полный дубликат механики видеорулетки под новую кнопку — своя колода, своё
   локальное хранилище добавленных видео, свои уровни и настройки. Дальше эту
   копию будем менять шаг за шагом, не трогая оригинальную "Видеорулетку". */

function renderDavayPlaceholderCard(){
  clearInterval(timerInterval);
  timerInterval = null;
  currentCard = null;
  currentDavayCard = null;
  const msg = state.davayFavoritesOnly
    ? 'В избранном этого уровня пока нет видео'
    : 'Пока нет видео этого уровня — добавьте их кнопкой «+»';
  fadeSwapCard((card)=>{
    card.className = 'card card-empty';
    card.style.borderTop = '';
    card.innerHTML = `<div class="card-inner"><div class="card-icon">🎬</div><div class="card-text">${msg}</div></div>`;
  });
}

function davayCardId(c){
  return c && (c.id || c.video);
}

function getDavayCardsList(){
  // Встроенные образцы видео в этой игре не показываются — используются
  // только видео, добавленные игроками со своего устройства.
  return importedDavayCards;
}

// ===== Свои видео с телефона для "Давай попробуем" (отдельное хранилище IndexedDB) =====
const DAVAY_DB_NAME = 'LovePlayDavayDB';
const DAVAY_DB_STORE = 'davayVideos';
let davayDBPromise = null;
let importedDavayCards = [];
let importedDavayVideosLoaded = false;

function openDavayDB(){
  if(davayDBPromise) return davayDBPromise;
  davayDBPromise = new Promise((resolve, reject)=>{
    if(!('indexedDB' in window)){ reject(new Error('IndexedDB не поддерживается')); return; }
    const req = indexedDB.open(DAVAY_DB_NAME, 1);
    req.onupgradeneeded = ()=>{
      const db = req.result;
      if(!db.objectStoreNames.contains(DAVAY_DB_STORE)){
        db.createObjectStore(DAVAY_DB_STORE, {keyPath:'id', autoIncrement:true});
      }
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
  return davayDBPromise;
}
function saveDavayBlob(file, level){
  return openDavayDB().then(db => new Promise((resolve, reject)=>{
    const tx = db.transaction(DAVAY_DB_STORE, 'readwrite');
    const store = tx.objectStore(DAVAY_DB_STORE);
    const req = store.add({ name:file.name, blob:file, level:level, addedAt:Date.now() });
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  }));
}
function loadAllDavayBlobs(){
  return openDavayDB().then(db => new Promise((resolve, reject)=>{
    const tx = db.transaction(DAVAY_DB_STORE, 'readonly');
    const req = tx.objectStore(DAVAY_DB_STORE).getAll();
    req.onsuccess = ()=> resolve(req.result || []);
    req.onerror = ()=> reject(req.error);
  }));
}
function clearAllDavayBlobs(){
  return openDavayDB().then(db => new Promise((resolve, reject)=>{
    const tx = db.transaction(DAVAY_DB_STORE, 'readwrite');
    tx.objectStore(DAVAY_DB_STORE).clear();
    tx.oncomplete = ()=> resolve();
    tx.onerror = ()=> reject(tx.error);
  })).catch(()=>{});
}
function ensureImportedDavayVideosLoaded(){
  if(importedDavayVideosLoaded) return Promise.resolve();
  return loadAllDavayBlobs().then(rows => {
    importedDavayCards = rows.map(r => ({
      level: r.level || 1,
      video: URL.createObjectURL(r.blob),
      id: 'imported-' + r.id,
      imported: true
    }));
    importedDavayVideosLoaded = true;
  }).catch(()=>{
    importedDavayCards = [];
    importedDavayVideosLoaded = true;
  });
}

// Разовый перенос старых видео "Видеорулетки" в общий каталог ==========
// Раньше у "Видеорулетки" было своё собственное хранилище (LovePlayVideoDB).
// Теперь она использует общий каталог "Давай попробуем", поэтому при первом
// запуске после обновления переносим всё, что там уже было добавлено, чтобы
// ничего из ранее загруженных видео не потерялось. После переноса старое
// хранилище очищается, а флаг state.videoDbMigrated не даёт повторять это
// при каждом запуске.
function migrateVideoDbIntoDavay(){
  if(state.videoDbMigrated) return Promise.resolve();
  return loadAllVideoBlobs().then(rows => {
    if(!rows.length){
      state.videoDbMigrated = true;
      saveState();
      return;
    }
    return openDavayDB().then(db => new Promise((resolve, reject)=>{
      const tx = db.transaction(DAVAY_DB_STORE, 'readwrite');
      const store = tx.objectStore(DAVAY_DB_STORE);
      rows.forEach(r=>{
        store.add({ name:r.name, blob:r.blob, level:r.level || 1, addedAt:r.addedAt || Date.now() });
      });
      tx.oncomplete = ()=> resolve();
      tx.onerror = ()=> reject(tx.error);
    })).then(()=> clearAllVideoBlobs()).then(()=>{
      importedDavayVideosLoaded = false; // при следующем обращении подтянутся и перенесённые
      state.videoDbMigrated = true;
      saveState();
      showToast('Видео из «Видеорулетки» перенесены в общий каталог 🎬');
    });
  }).catch(()=>{
    // IndexedDB недоступен или чтение не удалось — не повторяем попытку на
    // каждом запуске впустую.
    state.videoDbMigrated = true;
    saveState();
  });
}
migrateVideoDbIntoDavay();

// Модалка выбора уровня для только что выбранных файлов
let pendingDavayImportFiles = [];
const davayImportInputEl = document.getElementById('davayImportInput');
const davayLevelModalEl = document.getElementById('davayLevelModal');
davayImportInputEl.addEventListener('change', ()=>{
  const files = Array.from(davayImportInputEl.files || []).filter(f=>f.type.startsWith('video/'));
  davayImportInputEl.value = '';
  if(files.length === 0) return;
  pendingDavayImportFiles = files;
  document.getElementById('davayLevelModalCount').textContent = `Выбрано файлов: ${files.length}`;
  davayLevelModalEl.classList.add('show');
});
document.getElementById('cancelDavayLevelBtn').addEventListener('click', ()=>{
  pendingDavayImportFiles = [];
  davayLevelModalEl.classList.remove('show');
});
document.querySelectorAll('.davay-level-choice').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const level = parseInt(btn.dataset.level, 10);
    const files = pendingDavayImportFiles;
    pendingDavayImportFiles = [];
    davayLevelModalEl.classList.remove('show');
    if(files.length === 0) return;
    showToast('Добавляем видео…');
    Promise.all(files.map(f => saveDavayBlob(f, level).catch(()=>null))).then(results => {
      const added = results.filter(r => r !== null).length;
      importedDavayVideosLoaded = false;
      ensureImportedDavayVideosLoaded().then(()=>{
        showToast(added > 0 ? `Добавлено видео: ${added}` : 'Не удалось добавить видео');
      });
    });
  });
});

const DAVAY_MAX_LEVEL = 4;
let davayLevel = 1;
let currentDavayCard = null;
let davayHistory = []; // для свайпов влево/вправо между уже показанными видео
let davayHistoryPos = -1;
let davaySoundOn = false;
function updateDavayMuteBtn(){
  const btn = document.getElementById('davayMuteBtn');
  if(btn){
    btn.textContent = davaySoundOn ? '🔊' : '🔇';
    btn.setAttribute('aria-label', davaySoundOn ? 'Выключить звук видео' : 'Включить звук видео');
  }
  updateDavaySetupSoundBtn();
}
function updateDavaySetupSoundBtn(){
  const btn = document.getElementById('davaySetupSoundBtn');
  if(!btn) return;
  btn.textContent = davaySoundOn ? '🔊 Звук включён' : '🔇 Звук выключен';
  btn.classList.toggle('on', davaySoundOn);
  btn.setAttribute('aria-label', davaySoundOn ? 'Выключить звук видео' : 'Включить звук видео');
}
function setDavaySoundOn(on){
  davaySoundOn = on;
  state.davaySoundOn = on;
  saveState();
  const video = document.getElementById('davayPlayer');
  if(video) video.muted = !davaySoundOn;
  updateDavayMuteBtn();
}
document.getElementById('davayMuteBtn').addEventListener('click', ()=>{
  setDavaySoundOn(!davaySoundOn);
});
document.getElementById('davaySetupSoundBtn').addEventListener('click', ()=>{
  setDavaySoundOn(!davaySoundOn);
});

// Автопереключение и полноэкранный режим в "Давай попробуем" убраны вместе
// с блоком "Дополнительно" — только звук (davayMuteBtn) остался, сразу в
// основном ряду кнопок. davayFullscreenActive/davayNativeFullscreenActive
// оставлены — на них по-прежнему ссылаются общие обработчики fullscreenchange
// и сброс состояния при выходе/паузе.
let davayFullscreenActive = false; // обычный Fullscreen API (карточка целиком)
let davayNativeFullscreenActive = false; // нативный полноэкранный режим iOS (только видео)

function updateDavayFavoritesBtn(){
  const gameEl = document.getElementById('game');
  if(gameEl) gameEl.classList.toggle('davay-favview', !!state.davayFavoritesOnly);
}
// Список избранных видео текущего уровня и перелистывание по нему кнопками
// "Следующее"/"Предыдущее" в режиме просмотра избранного.
let davayFavIndex = -1;
function getDavayFavoritesList(){
  const liked = state.davayLiked || [];
  return getDavayCardsList().filter(c => c.level === davayLevel && liked.includes(davayCardId(c)));
}
function showDavayFavoriteAt(index){
  const list = getDavayFavoritesList();
  if(list.length === 0){
    davayFavIndex = -1;
    currentDavayCard = null;
    renderDavayPlaceholderCard();
    return;
  }
  if(index < 0) index = list.length - 1;
  if(index >= list.length) index = 0;
  davayFavIndex = index;
  const card = list[davayFavIndex];
  currentDavayCard = card;
  renderDavayCard(card, davayLevel);
}
function davayFavNext(){ showDavayFavoriteAt(davayFavIndex + 1); }
function davayFavPrev(){ showDavayFavoriteAt(davayFavIndex - 1); }
document.getElementById('davayFavNextBtn').addEventListener('click', ()=>{
  playSuccessSound();
  davayFavNext();
});
document.getElementById('davayFavPrevBtn').addEventListener('click', ()=>{
  davayFavPrev();
});

function updateDavayLevelBtn(){
  const btn = document.getElementById('davayLevelUpBtn');
  if(!btn) return;
  btn.disabled = davayLevel >= DAVAY_MAX_LEVEL;
}
function drawDavayCard(level){
  davayLevel = level;
  updateDavayLevelBtn();
  const hidden = state.davayHidden || [];
  const liked = state.davayLiked || [];
  let all = getDavayCardsList().filter(c=>c.level===level && !hidden.includes(davayCardId(c)));
  if(state.davayFavoritesOnly){
    all = all.filter(c=>liked.includes(davayCardId(c)));
  }
  if(all.length===0){
    currentDavayCard = null;
    if(state.davayFavoritesOnly){
      showToast('В избранном пока нет видео');
      state.davayFavoritesOnly = false;
      saveState();
      updateDavayFavoritesBtn();
      all = getDavayCardsList().filter(c=>c.level===level && !hidden.includes(davayCardId(c)));
      if(all.length===0){ renderDavayPlaceholderCard(); return; }
    } else {
      renderDavayPlaceholderCard();
      return;
    }
  }
  if(!state.davayUsed) state.davayUsed = {};
  let used = state.davayUsed[level] || [];
  let pool = all.filter(c=>!used.includes(davayCardId(c)));
  if(pool.length===0){
    pool = all;
    used = [];
    showToast('Видео этого уровня показаны заново 🔀');
  }
  const card = pool[Math.floor(Math.random()*pool.length)];
  used.push(davayCardId(card));
  state.davayUsed[level] = used;
  currentDavayCard = card;
  saveState();
  davayHistory.push(card);
  davayHistoryPos = davayHistory.length - 1;
  renderDavayCard(card, level);
}

// Показать видео из истории (свайпы влево/вправо), не трогая "показанные"/избранное
function renderDavayCardFromHistory(pos){
  if(pos < 0 || pos >= davayHistory.length) return;
  davayHistoryPos = pos;
  currentDavayCard = davayHistory[pos];
  renderDavayCard(currentDavayCard, davayLevel);
}

function davaySwipePrev(){
  // Бесконечная прокрутка: если в истории раньше некуда — просто показываем
  // новое случайное видео.
  if(davayHistoryPos <= 0){
    drawDavayCard(davayLevel);
    return;
  }
  renderDavayCardFromHistory(davayHistoryPos - 1);
}

function davaySwipeNext(){
  if(davayHistoryPos < davayHistory.length - 1){
    renderDavayCardFromHistory(davayHistoryPos + 1);
  } else {
    drawDavayCard(davayLevel);
  }
}

// См. аналогичный комментарий у setupVideoPlayerElement/renderVideoCard —
// та же логика для "Давай попробуем": пока видео открыто в нативном
// полноэкранном режиме iOS, при переключении на следующее видео меняем src у
// уже существующего элемента (reuse=true) вместо пересоздания через
// innerHTML, чтобы iOS не закрывала полный экран с видимым "миганием"
// обратно на карточку с кнопками.
function setupDavayPlayerElement(video, card, level, reuse){
  video.muted = !davaySoundOn;
  video.loop = !state.davayAutoAdvance;
  if(reuse){
    video.src = card.video;
    video.load();
  }
  const attemptPlay = ()=>{
    const p = video.play();
    if(p && typeof p.catch === 'function'){
      p.catch(()=>{ setTimeout(()=>{ video.play().catch(()=>{}); }, 150); });
    }
  };
  attemptPlay();
  const cardEl = document.getElementById('card');
  video.addEventListener('loadedmetadata', ()=>{
    fitCardVideoToArea(video, cardEl);
    // См. аналогичный комментарий в renderVideoCard — вызывать нужно
    // после loadedmetadata, иначе на iOS повторный вход в полноэкранный
    // режим при автопереключении/повторе молча не срабатывает.
    if(davayNativeFullscreenActive && video.webkitEnterFullscreen && !video.webkitDisplayingFullscreen){
      try{ video.webkitEnterFullscreen(); } catch(err){}
    }
  }, {once:true});
  video.addEventListener('error', ()=>{
    const media = document.getElementById('davayMedia');
    if(media) media.innerHTML = '<div class="card-icon">🎬</div>';
  }, {once:true});
  video.addEventListener('ended', ()=>{
    if(state.davayAutoAdvance) drawDavayCard(davayLevel);
  }, {once:true});
  if(!reuse){
    video.addEventListener('webkitendfullscreen', ()=>{ davayNativeFullscreenActive = false; });
  }
}
function renderDavayCard(card, level){
  clearInterval(timerInterval);
  timerInterval = null;
  currentCard = null;
  const existingVideo = document.getElementById('davayPlayer');
  if(davayNativeFullscreenActive && existingVideo){
    setupDavayPlayerElement(existingVideo, card, level, true);
    updateDavayMuteBtn();
    updateDavayFavoritesBtn();
    updateFavoriteBtn();
    return;
  }
  fadeSwapCard((el)=>{
    el.className = 'card card-empty';
    el.style.borderTop = '';
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-split-media" id="davayMedia">
          <video src="${card.video}" id="davayPlayer" playsinline autoplay></video>
        </div>
      </div>
    `;
    const video = document.getElementById('davayPlayer');
    if(video) setupDavayPlayerElement(video, card, level, false);
    updateDavayMuteBtn();
    updateDavayFavoritesBtn();
  });
  updateFavoriteBtn();
}

// ===== Экран настройки "Давай попробуем" (Первым начинает + Уровни заданий) =====
// LEVELS id 3..6 ("Сближение","Разогрев","Откровенно 18+","Фантазии") — эти же
// уровни используются для сортировки добавленных видео (davayLevel = id - 2).
const DAVAY_SETUP_LEVEL_IDS = [3,4,5,6];

function renderDavaySetupLevels(){
  const wrap = document.getElementById('davaySetupLevels');
  if(!wrap) return;
  wrap.innerHTML = '';
  LEVELS.filter(l=>DAVAY_SETUP_LEVEL_IDS.includes(l.id)).forEach(l=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + (state.davaySelectedLevel === l.id ? ' on' : '');
    div.dataset.id = l.id;
    div.innerHTML = `
      <div class="lname">${l.icon} ${l.name}</div>
      <div class="ldesc">${l.desc}</div>
      <div class="level-check"></div>
    `;
    div.addEventListener('click', ()=>{
      state.davaySelectedLevel = l.id;
      saveState();
      renderDavaySetupLevels();
    });
    wrap.appendChild(div);
  });
}

function renderDavaySetupStarterGroup(){
  document.querySelectorAll('#davaySetupStarterGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', btn.dataset.value === state.davayStarter);
  });
}
document.querySelectorAll('#davaySetupStarterGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.davayStarter = btn.dataset.value;
    saveState();
    renderDavaySetupStarterGroup();
  });
});

function updateDavaySetupStarterLabels(){
  const n1 = document.getElementById('name1');
  const n2 = document.getElementById('name2');
  const label1 = (n1.value.trim() || n1.placeholder || 'М');
  const label2 = (n2.value.trim() || n2.placeholder || 'Ж');
  const b1 = document.querySelector('#davaySetupStarterGroup .starter-btn[data-value="M"]');
  const b2 = document.querySelector('#davaySetupStarterGroup .starter-btn[data-value="F"]');
  if(b1) b1.textContent = label1;
  if(b2) b2.textContent = label2;
}
document.getElementById('name1').addEventListener('input', updateDavaySetupStarterLabels);
document.getElementById('name2').addEventListener('input', updateDavaySetupStarterLabels);

function goToDavaySetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('davaySetup').classList.add('active');
  renderDavaySetupStarterGroup();
  renderDavaySetupLevels();
  updateDavaySetupStarterLabels();
  updateDavaySetupSoundBtn();
}
function exitDavaySetup(){
  document.getElementById('davaySetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}
document.getElementById('davaySetupImportBtn').addEventListener('click', ()=>{
  davayImportInputEl.click();
});
document.getElementById('davaySetupStartBtn').addEventListener('click', async ()=>{
  await ensureImportedDavayVideosLoaded();
  const level = (state.davaySelectedLevel || 3) - 2;
  const hasVideos = getDavayCardsList().some(c=>c.level===level);
  if(!hasVideos){
    playErrorSound();
    showToast('Сначала добавьте видео');
    return;
  }
  playSuccessSound();
  goToDavayGame();
});
document.getElementById('davaySetupExitBtn').addEventListener('click', ()=>{
  exitDavaySetup();
});
// "Видеорулетка" переехала сюда с главного меню — обе игры делят один и тот
// же каталог видео, поэтому логично запускать её прямо со страницы "Давай
// попробуем". Проверка blockedByDavayPause() — та же, что была у кнопки в
// меню: не даёт молча бросить паузу другой игры (бинго/ПоД).
document.getElementById('davaySetupVideoBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  playSuccessSound();
  goToVideoGame();
});
// Сердечко рядом с "Видеорулеткой" — отдельное избранное именно этой игры
// (state.videoLiked), отличное от "❤️ Избранное" ниже, которое показывает
// избранное "Давай попробуем" (state.davayLiked).
document.getElementById('davaySetupVideoFavBtn').addEventListener('click', ()=>{
  if(blockedByDavayPause()) return;
  if(!(state.videoLiked && state.videoLiked.length)){
    playErrorSound();
    showToast('Пока нет избранных видео — сначала лайкните что-нибудь в видеорулетке');
    return;
  }
  playSuccessSound();
  goToVideoFavoritesView();
});
document.getElementById('davaySetupFavoritesBtn').addEventListener('click', ()=>{
  goToDavayFavoritesView();
});

// ===== Экран настройки "Предложи партнеру" (выбор уровня) =====
// Свой набор уровней (не трогает общий LEVELS, которым пользуются "Фанты").
const PHOTO_LEVELS = [
  {id:1, name:'Простые позы', desc:'Лёгкие и классические позы', icon:'🙂'},
  {id:2, name:'Интересные позы', desc:'Больше разнообразия и вариантов', icon:'😏'},
  {id:3, name:'Сложные позы', desc:'Нужны гибкость и физподготовка', icon:'🔥'},
  {id:4, name:'В авто', desc:'Позы в машине', icon:'🚗'},
  {id:5, name:'Секс-шоп', desc:'Товары с рейтингом', icon:'🛍️'},
  {id:6, name:'Коллекция', desc:'Позиции личной коллекции', icon:'📦'},
  {id:7, name:'Желания женщины', desc:'Топ женских фантазий', icon:'💗'},
  {id:8, name:'Желания мужчины', desc:'Топ мужских фантазий', icon:'💙'},
  {id:9, name:'Советы сексологов', desc:'Советы для пары', icon:'🧑‍⚕️'},
  {id:10, name:'Идеи для вас', desc:'Сценарии вечера вдвоём', icon:'✨'},
  {id:11, name:'Ласки камасутры', desc:'Техники прелюдии', icon:'🌸'},
  {id:12, name:'Позы камасутры', desc:'Позы без фото', icon:'🕉️'},
];
function renderPhotoSetupLevels(){
  const wrap = document.getElementById('photoSetupLevels');
  if(!wrap) return;
  wrap.innerHTML = '';
  PHOTO_LEVELS.forEach(l=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + (state.photoSelectedLevel === l.id ? ' on' : '');
    div.dataset.id = l.id;
    div.innerHTML = `
      <div class="lname">${l.icon} ${l.name}</div>
      <div class="ldesc">${l.desc}</div>
      <div class="level-check"></div>
    `;
    div.addEventListener('click', ()=>{
      state.photoSelectedLevel = l.id;
      saveState();
      renderPhotoSetupLevels();
    });
    wrap.appendChild(div);
  });
}
function goToPhotoSetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('photoSetup').classList.add('active');
  renderPhotoSetupLevels();
  updateMuteBtn();
}
function exitPhotoSetup(){
  document.getElementById('photoSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}
document.getElementById('photoSetupExitBtn').addEventListener('click', ()=>{
  exitPhotoSetup();
});
document.getElementById('photoSetupStartBtn').addEventListener('click', ()=>{
  const level = state.photoSelectedLevel || 1;
  const hasPhotos = getPhotoCardsList().some(c=>c.level===level);
  if(!hasPhotos){
    playErrorSound();
    showToast('На этом уровне пока нет карточек');
    return;
  }
  playSuccessSound();
  goToPlaceholderGame();
});

// Просмотр избранных видео (совпавшие "Да" из прошлых раундов) прямо со
// страницы настройки, без прохождения квиза заново.
function goToDavayFavoritesView(){
  if(!(state.davayLiked && state.davayLiked.length)){
    playErrorSound();
    showToast('Пока нет избранных видео — сначала пройдите игру');
    return;
  }
  abandonPausedDavaySession();
  abandonPausedTdSession();
  abandonPausedBingoSession();
  abandonPausedKrokodilSession();
  abandonPausedWishlistSession();
  abandonPausedZnayuSession();
  abandonPausedTimerSession();
  abandonPausedPartyFantsSession();
  abandonPausedPartyTdSession();
  abandonPausedFamZnayuSession();
  abandonPausedLuckySession();
  abandonPausedKidsMemorySession();
  abandonPausedKidsTdSession();
  abandonPausedFantySession();
  abandonPausedQuizSession();
  abandonPausedPartyQuizSession();
  abandonPausedKidsQuizSession();
  abandonPausedSoloBsSession();
  state.pausedMode = null;
  state.inProgress = true;
  davayLevel = (state.davaySelectedLevel || 3) - 2;
  davayHistory = [];
  davayHistoryPos = -1;
  saveState();
  document.querySelector('.row1').appendChild(document.getElementById('pauseBtn'));
  document.getElementById('davaySetup').classList.remove('active');
  document.getElementById('setup').classList.remove('active');
  document.getElementById('game').classList.add('active');
  document.getElementById('game').classList.add('davay-mode');
  document.getElementById('doneBtn').textContent = 'Следующее';
  // Просмотр избранного — это не партия, которую можно поставить на паузу,
  // поэтому кнопка сразу подписана "Выход" (обработчик см. ниже, у pauseBtn).
  document.getElementById('pauseBtn').textContent = 'Выход';
  updateTurnUI();
  updateLevelUI();
  updateMuteBtn();
  requestWakeLock();
  updateDavayPlayerButtons();
  if(!state.davayFavoritesOnly){
    state.davayFavoritesOnly = true;
    saveState();
  }
  updateDavayFavoritesBtn();
  showDavayFavoriteAt(0);
}

async function goToDavayGame(){
  state.pausedMode = null;
  const n1raw = document.getElementById('name1').value.trim();
  const n2raw = document.getElementById('name2').value.trim();
  state.name1 = n1raw || 'Men';
  state.name2 = n2raw || 'Sexy';
  state.currentPlayer = pickStartingPlayerValue(state.davayStarter);
  state.score1 = 0; state.score2 = 0;
  state.autoMilestone = 0;
  state.turnsPlayed = 0; state.turnsAtLastLevelUp = 0;
  state.levelTurnCounts = {1:0, 2:0}; state.pendingLevelUp = false;
  state.completedCount = 0; state.skippedCount = 0;
  state.inProgress = true;
  davayLevel = (state.davaySelectedLevel || 3) - 2;
  state.davayUsed = {};
  state.davayHidden = [];
  davayHistory = [];
  davayHistoryPos = -1;
  // Новая партия — всегда обычный квиз, а не режим "просмотр избранного"
  // (иначе после однажды открытого избранного игра застревала бы в нём).
  state.davayFavoritesOnly = false;
  saveState();
  document.querySelector('.row1').appendChild(document.getElementById('pauseBtn'));
  document.getElementById('davaySetup').classList.remove('active');
  document.getElementById('setup').classList.remove('active');
  document.getElementById('game').classList.add('active');
  document.getElementById('game').classList.add('davay-mode');
  document.getElementById('doneBtn').textContent = 'Следующее';
  document.getElementById('pauseBtn').textContent = 'Пауза';
  updateTurnUI();
  updateLevelUI();
  updateMuteBtn();
  requestWakeLock();
  await ensureImportedDavayVideosLoaded();
  resetDavayQuiz();
  updateDavayPlayerButtons();
  updateDavayFavoritesBtn();
  // Кто начинает первым — уже выбрано на странице настройки, повторный
  // выбор в самой игре не нужен: сразу запускаем вопросы для этого игрока.
  startDavayQuizPlayer(pickStartingPlayerValue(state.davayStarter));
}

// toDavaySetup=true — выйти не на главный экран, а сразу в меню настроек
// "Давай попробуем" (используется кнопкой "Выход" на экране итогов).
function exitDavayGame(toDavaySetup){
  state.inProgress = false;
  saveState();
  if(document.fullscreenElement) document.exitFullscreen();
  davayFullscreenActive = false;
  davayNativeFullscreenActive = false;
  const video = document.getElementById('davayPlayer');
  if(video){
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
  currentDavayCard = null;
  resetDavayQuiz();
  document.getElementById('card').style.aspectRatio = '';
  document.getElementById('card').style.width = '';
  document.querySelector('.row2').appendChild(document.getElementById('pauseBtn'));
  document.getElementById('game').classList.remove('active');
  document.getElementById('game').classList.remove('davay-mode');
  document.getElementById('doneBtn').textContent = '💕 Готово';
  document.getElementById('pauseBtn').textContent = 'Пауза';
  if(toDavaySetup){
    releaseWakeLockNow();
    goToDavaySetup();
  } else {
    returnToSetupUI();
  }
}

function isDavayMode(){
  const el = document.getElementById('game');
  return !!(el && el.classList.contains('davay-mode'));
}

// Пауза (как в основной игре): прогресс квиза сохраняется, экран уходит в
// настройки, дальше можно продолжить через «Продолжить игру» или завершить
// через «Закончить игру».
function pauseDavayGame(){
  state.pausedMode = 'davay';
  saveState();
  if(document.fullscreenElement) document.exitFullscreen();
  davayFullscreenActive = false;
  davayNativeFullscreenActive = false;
  const video = document.getElementById('davayPlayer');
  if(video) video.pause();
  document.querySelector('.row2').appendChild(document.getElementById('pauseBtn'));
  returnToSetupUI();
  showToast('Игра на паузе — прогресс сохранён');
}

function resumeDavayGame(){
  state.pausedMode = null;
  saveState();
  updateResumeUI();
  document.querySelector('.row1').appendChild(document.getElementById('pauseBtn'));
  document.getElementById('setup').classList.remove('active');
  document.getElementById('game').classList.add('active');
  document.getElementById('game').classList.add('davay-mode');
  document.getElementById('doneBtn').textContent = 'Следующее';
  document.getElementById('pauseBtn').textContent = 'Пауза';
  updateTurnUI();
  updateLevelUI();
  updateMuteBtn();
  requestWakeLock();
  updateDavayPlayerButtons();
  if(state.davayQuizPendingNext){
    renderDavayHandoffCard(state.davayQuizPendingNext);
  } else if(state.davayQuizActivePlayer && state.davayQuizQueue.length){
    showDavayQuizCurrentCard();
  } else if(currentDavayCard){
    renderDavayCard(currentDavayCard, davayLevel);
  } else {
    renderDavayPlaceholderCard();
  }
}

// Полностью отменить незавершённую паузу "Давай попробуем" — используется,
// если игрок вместо "Продолжить" запускает какую-то другую игру.
function abandonPausedDavaySession(){
  if(state.pausedMode === 'davay'){
    state.pausedMode = null;
    state.davayUsed = {};
    state.davayHidden = [];
    resetDavayQuiz();
    currentDavayCard = null;
    davayHistory = [];
    davayHistoryPos = -1;
    saveState();
  }
  document.getElementById('game').classList.remove('davay-mode');
}

function goToPlaceholderGame(){
  abandonPausedDavaySession();
  abandonPausedTdSession();
  abandonPausedBingoSession();
  abandonPausedKrokodilSession();
  abandonPausedWishlistSession();
  abandonPausedZnayuSession();
  abandonPausedTimerSession();
  abandonPausedPartyFantsSession();
  abandonPausedPartyTdSession();
  abandonPausedFamZnayuSession();
  abandonPausedLuckySession();
  abandonPausedKidsMemorySession();
  abandonPausedKidsTdSession();
  abandonPausedFantySession();
  abandonPausedQuizSession();
  abandonPausedPartyQuizSession();
  abandonPausedKidsQuizSession();
  abandonPausedSoloBsSession();
  const n1raw = document.getElementById('name1').value.trim();
  const n2raw = document.getElementById('name2').value.trim();
  state.name1 = n1raw || 'Men';
  state.name2 = n2raw || 'Sexy';
  state.currentPlayer = pickStartingPlayer();
  state.score1 = 0; state.score2 = 0;
  state.autoMilestone = 0;
  state.turnsPlayed = 0; state.turnsAtLastLevelUp = 0;
  state.levelTurnCounts = {1:0, 2:0}; state.pendingLevelUp = false;
  state.completedCount = 0; state.skippedCount = 0;
  state.inProgress = true;
  photoLevel = state.photoSelectedLevel || 1;
  state.photoUsed = {};
  state.photoHidden = [];
  state.photoSeqIndex = {};
  // Новая партия — всегда обычная колода, а не режим "просмотр избранного"
  // (иначе после однажды открытого избранного игра застревала бы в нём).
  state.photoFavView = false;
  saveState();
  document.getElementById('photoSetup').classList.remove('active');
  document.getElementById('game').classList.add('active');
  document.getElementById('game').classList.add('placeholder-mode');
  document.getElementById('game').classList.remove('photo-favview');
  document.getElementById('doneBtn').textContent = 'Следующая';
  document.getElementById('pauseBtn').textContent = 'Выход';
  updateTurnUI();
  updateLevelUI();
  updateMuteBtn();
  requestWakeLock();
  if(getPhotoCardsList().length>0){
    drawPhotoCard(photoLevel);
  } else {
    renderPlaceholderCard();
  }
}

// Просмотр избранных карточек "Предложи партнеру" (отмеченных ❤️ во время
// игры) прямо со страницы настройки, без прохождения колоды заново.
let photoFavIndex = -1;
function getPhotoFavoritesList(){
  const done = state.photoDone || [];
  return getPhotoCardsList().filter(c => done.includes(photoCardKey(c)));
}
function showPhotoFavoriteAt(index){
  const list = getPhotoFavoritesList();
  if(list.length === 0){
    photoFavIndex = -1;
    currentPhotoCard = null;
    renderPlaceholderCard();
    return;
  }
  if(index < 0) index = list.length - 1;
  if(index >= list.length) index = 0;
  photoFavIndex = index;
  const card = list[photoFavIndex];
  currentPhotoCard = card;
  renderPhotoCard(card, card.level);
}
function photoFavNext(){ showPhotoFavoriteAt(photoFavIndex + 1); }
function photoFavPrev(){ showPhotoFavoriteAt(photoFavIndex - 1); }
function goToPhotoFavoritesView(){
  if(!(state.photoDone && state.photoDone.length)){
    playErrorSound();
    showToast('Пока нет избранного — сначала отметьте карточки ❤️');
    return;
  }
  abandonPausedDavaySession();
  abandonPausedTdSession();
  abandonPausedBingoSession();
  abandonPausedKrokodilSession();
  abandonPausedWishlistSession();
  abandonPausedZnayuSession();
  abandonPausedTimerSession();
  abandonPausedPartyFantsSession();
  abandonPausedPartyTdSession();
  abandonPausedFamZnayuSession();
  abandonPausedLuckySession();
  abandonPausedKidsMemorySession();
  abandonPausedKidsTdSession();
  abandonPausedFantySession();
  abandonPausedQuizSession();
  abandonPausedPartyQuizSession();
  abandonPausedKidsQuizSession();
  abandonPausedSoloBsSession();
  state.pausedMode = null;
  state.inProgress = true;
  state.photoFavView = true;
  saveState();
  document.getElementById('photoSetup').classList.remove('active');
  document.getElementById('game').classList.add('active');
  document.getElementById('game').classList.add('placeholder-mode');
  document.getElementById('game').classList.add('photo-favview');
  document.getElementById('pauseBtn').textContent = 'Выход';
  updateMuteBtn();
  requestWakeLock();
  photoFavIndex = -1;
  showPhotoFavoriteAt(0);
}
document.getElementById('photoSetupFavoritesBtn').addEventListener('click', ()=>{
  goToPhotoFavoritesView();
});
document.getElementById('photoFavNextBtn').addEventListener('click', ()=>{
  playSuccessSound();
  photoFavNext();
});
document.getElementById('photoFavPrevBtn').addEventListener('click', ()=>{
  photoFavPrev();
});

function exitPlaceholderGame(){
  state.inProgress = false;
  state.photoFavView = false;
  saveState();
  document.getElementById('game').classList.remove('placeholder-mode');
  document.getElementById('game').classList.remove('photo-favview');
  document.getElementById('doneBtn').textContent = '💕 Готово';
  document.getElementById('pauseBtn').textContent = 'Пауза';
  returnToSetupUI();
}

/* ============ ТАЙМЕР ЗАДАНИЯ ============ */
let timerInterval = null;
let timerDuration = 60; // по умолчанию 1 минута
let timerSeconds = timerDuration;

function formatTime(s){
  const m = Math.floor(s/60);
  const sec = s%60;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function resetTimer(){
  clearInterval(timerInterval);
  timerInterval = null;
  timerSeconds = timerDuration;
  const disp = document.getElementById('timerDisplay');
  const btn = document.getElementById('timerBtn');
  if(disp) disp.textContent = formatTime(timerSeconds);
  if(btn){ btn.textContent = '▶ Старт'; btn.classList.remove('running'); }
}

// Один общий AudioContext на всё приложение вместо нового на каждый звук —
// iOS Safari ограничивает число одновременно живых AudioContext, и при частых
// звуках (например, быстрые свайпы подряд) более старый подход мог "тихо" не срабатывать.
let sharedAudioCtx = null;
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

function selectTimerDuration(sec, btnEl){
  timerDuration = sec;
  document.querySelectorAll('.timer-dur-btn').forEach(b=>b.classList.toggle('on', b===btnEl));
  resetTimer();
}

function toggleTimer(){
  const btn = document.getElementById('timerBtn');
  const disp = document.getElementById('timerDisplay');
  if(timerInterval){
    clearInterval(timerInterval);
    timerInterval = null;
    btn.textContent = '▶ Продолжить';
    btn.classList.remove('running');
    return;
  }
  btn.textContent = '⏸ Пауза';
  btn.classList.add('running');
  timerInterval = setInterval(()=>{
    timerSeconds--;
    if(disp) disp.textContent = formatTime(timerSeconds);
    if(timerSeconds<=0){
      clearInterval(timerInterval);
      timerInterval = null;
      showToast('Время вышло! ⏰');
      playTimerAlarm();
      const cardEl = document.getElementById('card');
      if(disp){
        disp.classList.add('done');
        setTimeout(()=>disp.classList.remove('done'), 2000);
      }
      if(cardEl){
        cardEl.classList.add('done-shake');
        setTimeout(()=>cardEl.classList.remove('done-shake'), 400);
      }
      timerSeconds = timerDuration;
      if(disp) disp.textContent = formatTime(timerSeconds);
      if(btn){ btn.textContent = '▶ Старт'; btn.classList.remove('running'); }
    }
  }, 1000);
}

function drawCard(forceLevel){
  let card = drawFromPool(forceLevel);
  if(!card && forceLevel){
    card = drawFromPool(); // если у нового уровня карточек нет — берём из общего пула
  }
  if(!card){
    renderNoCards();
    showToast('Выберите хотя бы один уровень в настройках');
    return;
  }
  state.usedIndexes.push(card.idx);
  saveState();
  renderCard(card);
}

function refreshCard(){
  if(!currentCard) return;
  showToast('Новое задание 🔄');
  drawCard();
}

function dislikeCurrentCard(){
  if(!currentCard) return;
  playErrorSound();
  if(!state.hiddenIndexes.includes(currentCard.idx)){
    state.hiddenIndexes.push(currentCard.idx);
  }
  saveState();
  showToast('Карточка скрыта навсегда 🚫');
  drawCard();
}

const GENDER_COLORS = { M:'#6ec6ff', F:'#ff9fb0' };

let currentCard = null;

function renderCard(card){
  const lvl = levelById(card.level);
  const turnName = state.currentPlayer===1 ? state.name1 : state.name2;
  const genderColor = GENDER_COLORS[currentGender()];
  currentCard = card;
  fadeSwapCard((el)=>{
    el.className = 'card';
    el.style.borderTop = `10px solid ${genderColor}`;
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-header">
          <div class="card-turn">
            <div class="card-turn-label">Ход игрока</div>
            <div class="card-turn-name">${turnName}</div>
          </div>
          <div class="badge">
            <span class="level-pill" style="background:${lvl.color}">${lvl.icon} ${lvl.name}</span>
          </div>
        </div>
        <div class="card-type-row">
          <span class="type-pill">${card.type==='truth' ? 'Правда' : 'Действие'}</span>
        </div>
        <div class="card-body" id="cardBody">
          <div class="card-text" id="cardText"></div>
        </div>
        <div class="card-timer">
          <div class="timer-durations">
            <button type="button" class="timer-dur-btn ${timerDuration===30 ? 'on' : ''}" data-sec="30">30 сек</button>
            <button type="button" class="timer-dur-btn ${timerDuration===60 ? 'on' : ''}" data-sec="60">1 мин</button>
            <button type="button" class="timer-dur-btn ${timerDuration===120 ? 'on' : ''}" data-sec="120">2 мин</button>
          </div>
          <div class="timer-controls">
            <div class="timer-display" id="timerDisplay">${formatTime(timerDuration)}</div>
            <button type="button" class="timer-btn" id="timerBtn">▶ Старт</button>
          </div>
        </div>
      </div>
    `;
    resetTimer();
    document.getElementById('timerBtn').addEventListener('click', toggleTimer);
    document.querySelectorAll('.timer-dur-btn').forEach(b=>{
      b.addEventListener('click', ()=>selectTimerDuration(parseInt(b.dataset.sec,10), b));
    });
    fitTextToContainer(
      document.getElementById('cardBody'),
      document.getElementById('cardText'),
      card.text
    );
  });
  updateFavoriteBtn();
}

function nextTurn(completed){
  if(completed){
    if(state.currentPlayer===1) state.score1++; else state.score2++;
    state.completedCount = (state.completedCount||0) + 1;
  } else {
    state.skippedCount = (state.skippedCount||0) + 1;
  }
  state.turnsPlayed = (state.turnsPlayed||0) + 1;
  if(!state.levelTurnCounts) state.levelTurnCounts = {1:0, 2:0};
  state.levelTurnCounts[state.currentPlayer] = (state.levelTurnCounts[state.currentPlayer]||0) + 1;
  checkAutoLevelUp();
  state.currentPlayer = state.currentPlayer===1 ? 2 : 1;
  // Если повышение уровня было отложено — как только оба партнёра сыграли
  // поровну карточек текущего уровня, применяем его прямо сейчас.
  if(state.pendingLevelUp && (state.levelTurnCounts[1]||0) === (state.levelTurnCounts[2]||0) && (state.levelTurnCounts[1]||0) >= 1){
    advanceLevel();
  }
  saveState();
  updateTurnUI();
  drawCard();
}

document.getElementById('doneBtn').addEventListener('click', ()=>{
  if(cardTransitionLocked) return;
  playSuccessSound();
  if(isPlaceholderMode()){
    drawPhotoCard(photoLevel || 1);
    return;
  }
  if(isVideoMode()){
    drawVideoCard(videoLevel || 1, true);
    return;
  }
  if(isDavayMode()){
    drawDavayCard(davayLevel || 1);
    return;
  }
  nextTurn(true);
});
document.getElementById('skipBtn').addEventListener('click', ()=>{
  if(cardTransitionLocked) return;
  playFailSound();
  nextTurn(false);
});
document.getElementById('pauseBtn').addEventListener('click', ()=>{
  if(isPlaceholderMode()){
    exitPlaceholderGame();
    return;
  }
  if(isVideoMode()){
    exitVideoGame();
    return;
  }
  if(isDavayMode()){
    // Просмотр избранного — не настоящая партия, поэтому кнопка здесь
    // подписана "Выход" и должна полностью выходить, а не ставить на паузу.
    if(state.davayFavoritesOnly){
      exitDavayGame(true);
      return;
    }
    pauseDavayGame();
    return;
  }
  pauseGame();
  showToast('Игра на паузе — прогресс сохранён');
});
document.getElementById('finishGameBtn').addEventListener('click', ()=>{
  if(state.pausedMode === 'davay'){
    state.inProgress = false;
    abandonPausedDavaySession();
    saveState();
    updateResumeUI();
    showToast('Игра завершена');
    return;
  }
  if(state.pausedMode === 'td'){
    if((state.tdScore1||0) === 0 && (state.tdScore2||0) === 0){ finishTdGame(); return; }
    showTdSummary();
    return;
  }
  if(state.pausedMode === 'bingo'){
    const bingoCheckedCount = (state.bingoChecked || []).filter(Boolean).length;
    if(bingoCheckedCount === 0){ finishBingoGame(); return; }
    showBingoExitSummary();
    return;
  }
  if(state.pausedMode === 'krokodil'){
    const krokodilTotal = (state.krokodilScores || []).reduce((a,b)=>a+(b||0), 0);
    if(krokodilTotal === 0){ finishKrokodilGame(); return; }
    showKrokodilExitSummary();
    return;
  }
  if(state.pausedMode === 'wishlist'){
    finishWishlistGame();
    showToast('Игра завершена');
    return;
  }
  if(state.pausedMode === 'znayu'){
    finishZnayuGame();
    showToast('Игра завершена');
    return;
  }
  if(state.pausedMode === 'timer'){
    if((state.timerScore1||0) === 0 && (state.timerScore2||0) === 0){ exitTimerGame(); return; }
    showTimerSummary();
    return;
  }
  if(state.pausedMode === 'partyFants'){
    const partyFantsTotal = (state.partyFantsCompleted || []).reduce((a,b)=>a+(b||0), 0);
    if(partyFantsTotal === 0){ exitPartyFantsGame(); return; }
    finishPartyFantsGame();
    return;
  }
  if(state.pausedMode === 'partyTd'){
    const partyTdTotal = (state.partyTdCompleted || []).reduce((a,b)=>a+(b||0), 0);
    if(partyTdTotal === 0){ exitPartyTdGame(); return; }
    finishPartyTdGame();
    return;
  }
  if(state.pausedMode === 'famZnayu'){
    finishFamZnayuGame();
    showToast('Игра завершена');
    return;
  }
  if(state.pausedMode === 'lucky'){
    finishLuckyGame();
    showToast('Игра завершена');
    return;
  }
  if(state.pausedMode === 'kidsMemory'){
    finishKidsMemoryGame();
    showToast('Игра завершена');
    return;
  }
  if(state.pausedMode === 'kidsTd'){
    finishKidsTdGame();
    showToast('Игра завершена');
    return;
  }
  if(state.pausedMode === 'quiz'){
    finishQuizGame();
    showToast('Игра завершена');
    return;
  }
  if(state.pausedMode === 'partyQuiz'){
    finishPartyQuizGame();
    showToast('Игра завершена');
    return;
  }
   if(state.pausedMode === 'kidsQuiz'){
     finishKidsQuizGame();
     showToast('Игра завершена');
     return;
   }
   if(state.pausedMode === 'soloBs'){
     finishSoloBsGame();
     return;
   }
   if((state.score1||0) === 0 && (state.score2||0) === 0){ goToSetup(); return; }
   showSummary();
});

// Определяет, что делать при закрытии общего окна итогов (#summaryModal) —
// сброс Фантов или завершение "Правда или действие" (обе игры используют
// одну и ту же модалку итогов, только с разными данными).
let summaryModalMode = 'fanty';
function showSummary(){
  summaryModalMode = 'fanty';
  document.getElementById('summaryBonusText').style.display = 'none';
  const winnerEl = document.getElementById('summaryWinner');
  if(state.score1 === state.score2){
    winnerEl.textContent = '🤝 Ничья!';
  } else {
    const winnerName = state.score1 > state.score2 ? state.name1 : state.name2;
    winnerEl.textContent = `🏆 Победил ${winnerName}`;
  }
  document.getElementById('summaryScore').textContent = `${state.name1}: ${state.score1}  ·  ${state.name2}: ${state.score2}`;
  document.getElementById('summaryCounts').textContent = `Выполнено: ${state.completedCount||0}  ·  Пропущено: ${state.skippedCount||0}`;
  document.getElementById('summaryModal').classList.add('show');
}
document.getElementById('closeSummaryBtn').addEventListener('click', ()=>{
  document.getElementById('summaryModal').classList.remove('show');
  if(summaryModalMode === 'td'){
    finishTdGame();
    return;
  }
  if(summaryModalMode === 'timer'){
    exitTimerGame();
    return;
  }
  if(summaryModalMode === 'bingo'){
    exitBingoGameToSetup();
    return;
  }
  if(summaryModalMode === 'bingoExit'){
    finishBingoGame();
    return;
  }
  goToSetup();
});

(document.getElementById('rulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{
  document.getElementById('rulesModal').classList.add('show');
});
document.getElementById('closeRulesBtn').addEventListener('click', ()=>{
  document.getElementById('rulesModal').classList.remove('show');
});
document.getElementById('rulesModal').addEventListener('click', (e)=>{
  if(e.target.id === 'rulesModal') e.currentTarget.classList.remove('show');
});

// ===== ГЛОБАЛЬНОЕ МЕНЮ =====
(function(){
  const menuBtn = document.getElementById('globalMenuBtn');
  const menuModal = document.getElementById('globalMenuModal');
  if(!menuBtn || !menuModal) return;

  menuBtn.addEventListener('click', ()=>{
    menuModal.classList.add('show');
    updateMuteBtn();
    updateAutoSpeakBtn();
  });
  menuModal.addEventListener('click', (e)=>{
    if(e.target.id === 'globalMenuModal') menuModal.classList.remove('show');
  });
  document.getElementById('globalMenuCloseBtn').addEventListener('click', ()=>{
    menuModal.classList.remove('show');
  });

  const closeMenu = ()=> menuModal.classList.remove('show');

  document.getElementById('menuRulesBtn').addEventListener('click', ()=>{
    closeMenu();
    if(window.__openRulesHub) window.__openRulesHub();
  });
  document.getElementById('menuMuteBtn').addEventListener('click', ()=>{
    state.muted = !state.muted;
    saveState();
    updateMuteBtn();
  });
  document.getElementById('menuAutoSpeakBtn').addEventListener('click', ()=>{
    state.autoSpeak = !state.autoSpeak;
    saveState();
    updateAutoSpeakBtn();
    playSuccessSound();
  });
  document.getElementById('menuExportBtn').addEventListener('click', ()=>{
    closeMenu();
    exportGameData();
  });
  document.getElementById('menuImportBtn').addEventListener('click', ()=>{
    closeMenu();
    document.getElementById('importDataInput').click();
  });
  document.getElementById('menuUpdateBtn').addEventListener('click', ()=>{
    closeMenu();
    try{ sessionStorage.setItem('appJustUpdated', '1'); }catch(e){}
    location.reload(true);
  });
  document.getElementById('menuInstallBtn').addEventListener('click', ()=>{
    closeMenu();
    // Используем общую логику: если есть системный диалог установки (PWA) —
    // вызываем его, иначе показываем инструкцию #installModal.
    tryInstallApp();
  });
  document.getElementById('menuResetBtn').addEventListener('click', ()=>{
    closeMenu();
    if(confirm('Сбросить весь прогресс во всех играх? Счёт, избранное, имена команд и историю совпадений будет не вернуть. Свои добавленные задания в «Фантах» при этом сохранятся. Это действие нельзя отменить.')){
      state.hiddenIndexes = [];
      state.usedIndexes = [];
      state.kidsPlayers = ['Игрок 1','Игрок 2'];
      state.businessPlayers = ['Игрок 1','Игрок 2'];
      state.partyPlayers = ['Игрок 1','Игрок 2'];
      saveState();
      showToast('Прогресс сброшен 🗑');
    }
  });
})();

// ===== СТРАНИЦА ПРАВИЛ ВСЕХ ИГР (меню → «Правила игр») =====
// Структура: группа → игра → вложенная игра (если есть).
// Каждая игра переиспользует свою существующую модалку правил.
(function(){
  const hub = document.getElementById('rulesHubModal');
  const list = document.getElementById('rulesHubList');
  if(!hub || !list) return;

  const RULES_HUB = [
    { icon:'💕', name:'Игры для пар 18+', games:[
      ['🎯','Викторина','quizRulesModal'],
      ['💬','Ответы на вопросы','ideasRulesModal'],
      ['💘','Фанты','rulesModal'],
      ['❓','Правда/Действие','tdRulesModal'],
      ['💑','Тайные ответы','znayuRulesModal'],
      ['💌','Твои желания','wishlistRulesModal'],
      ['🎱','Секс-бинго','bingoRulesModal'],
      ['⏱️','Таймер страсти','timerRulesModal'],
      ['💃','Предложи партнеру','photoRulesModal'],
      ['🎬','Давай попробуем','davayRulesModal'],
      ['🧩','Секс квест','sexQuestRulesModal'],
    ]},
    { icon:'🎉', name:'Игры для компании', games:[
      ['🐊','Крокодил','krokodilRulesModal'],
      ['😂','Мемасики','memesRulesModal'],
      ['🎉','Фанты','partyFantsRulesModal'],
      ['🗣️','Правда/Действие','partyTdRulesModal'],
      ['🧠','Знаю тебя','famZnayuRulesModal'],
      ['🎫','Счастливый билет','luckyRulesModal'],
      ['🎯','Викторина','partyQuizRulesModal'],
      ['🤸','Твистер','twisterRulesModal'],
      ['🎡','Рулетка','partyRouletteRulesModal'],
      ['🙊','Я никогда не','partyNeverRulesModal'],
    ]},
    { icon:'🧸', name:'Игры с детьми', games:[
      ['🐊','Крокодил','kidsKrokodilRulesModal'],
      ['😂','Мемасики','kidsMemesRulesModal'],
      ['🧠','Мемори','kidsMemoryRulesModal'],
      ['🗣️','Правда/Действие','kidsTdRulesModal'],
      ['🎯','Викторина','kidsQuizRulesModal'],
      ['💣','Сапёр','kidsSaperRulesModal'],
      ['🎲','Во что поиграть?','whatToPlayRulesModal'],
      { sub:'♟️ Настольные игры', games:[
        ['⭕','Крестики-нолики','kidsXoRulesModal'],
        ['🚢','Морской бой','kidsBattleshipRulesModal'],
      ]},
    ]},
    { icon:'💼', name:'Бизнес игры', games:[
      ['🍋','Лимонадный ларёк','businessLemonadeRulesModal'],
      ['🛍️','Магазин','shopRulesModal'],
      ['🔍','Оцени бизнес','bizObsRulesModal'],
    ]},
    { icon:'📱', name:'Игры для одного', games:[
      ['🪢','Виселица','partyHangmanRulesModal'],
      ['🎯','Викторина','soloQuizRulesModal'],
      ['🧠','Мемори','soloMemoryRulesModal'],
      ['⭕','Крестики-нолики','soloXoRulesModal'],
      ['🚢','Морской бой','soloBattleshipRulesModal'],
    ]},
    { icon:'📚', name:'Обучающие игры', games:[
      ['🗂️','Флеш карты','flashRulesModal'],
    ]},
  ];

  // Рендер групп и игр
  list.innerHTML = RULES_HUB.map(g=>{
    const items = g.games.map(it=>{
      if(Array.isArray(it)){
        return `<button type="button" class="rules-item" data-rules-modal="${it[2]}"><span class="rules-icon">${it[0]}</span><span class="rules-name">${it[1]}</span><span class="rules-chev">›</span></button>`;
      }
      return `<div class="rules-subgroup">${it.sub}</div>` + it.games.map(n=>
        `<button type="button" class="rules-item nested" data-rules-modal="${n[2]}"><span class="rules-icon">${n[0]}</span><span class="rules-name">${n[1]}</span><span class="rules-chev">›</span></button>`
      ).join('');
    }).join('');
    return `<div class="rules-group"><button type="button" class="rules-group-head"><span>${g.icon} ${g.name}</span><span class="rules-chev">▸</span></button><div class="rules-group-body">${items}</div></div>`;
  }).join('');

  // Раскрытие групп
  list.querySelectorAll('.rules-group-head').forEach(h=>{
    h.addEventListener('click', ()=> h.closest('.rules-group').classList.toggle('open'));
  });

  // Открытие правил конкретной игры
  list.querySelectorAll('.rules-item').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const modal = document.getElementById(btn.dataset.rulesModal);
      if(modal) modal.classList.add('show');
    });
  });

  // Закрытие хаба
  const closeHub = ()=> hub.classList.remove('show');
  document.getElementById('rulesHubCloseBtn').addEventListener('click', closeHub);
  hub.addEventListener('click', (e)=>{ if(e.target.id === 'rulesHubModal') closeHub(); });

  // Любую модалку правил можно закрыть кликом по фону
  document.querySelectorAll('.modal-overlay[id$="RulesModal"], #rulesModal').forEach(ov=>{
    ov.addEventListener('click', (e)=>{ if(e.target === ov) ov.classList.remove('show'); });
  });

  // Для меню и кнопки «назад»
  window.__openRulesHub = ()=> hub.classList.add('show');
  window.__closeRulesHub = closeHub;
})();

// ===== КНОПКА "НАЗАД" (ПАУЗА / НАЗАД НА 1 УРОВЕНЬ) =====
(function(){
  const backBtn = document.getElementById('globalBackBtn');
  if(!backBtn) return;

  // Собираем ВСЕ активные экраны игр (не #setup)
  function getActiveGameScreenIds(){
    const ids = [];
    document.querySelectorAll('.screen.active').forEach(s=>{
      if(s.id !== 'setup') ids.push(s.id);
    });
    return ids;
  }

  // Гарантирует, что активен только #setup — чинит "экран, поделённый на 2 части"
  function ensureSingleActiveScreen(){
    const screens = document.querySelectorAll('.screen.active');
    if(screens.length <= 1) return false;
    const setup = document.getElementById('setup');
    screens.forEach(s=>{ if(s !== setup) s.classList.remove('active'); });
    if(setup && !setup.classList.contains('active')) setup.classList.add('active');
    window.scrollTo(0, 0);
    return true;
  }

  backBtn.addEventListener('click', ()=>{
    // Закрываем глобальное меню если открыто
    const menuModal = document.getElementById('globalMenuModal');
    if(menuModal) menuModal.classList.remove('show');

    // Если открыта страница правил — закрываем её
    const rulesHub = document.getElementById('rulesHubModal');
    if(rulesHub && rulesHub.classList.contains('show')){ rulesHub.classList.remove('show'); return; }

    // Если показано итоговое окно — закрываем и выходим на главный хаб
    const summaryModal = document.getElementById('summaryModal');
    if(summaryModal && summaryModal.classList.contains('show')){
      summaryModal.classList.remove('show');
      document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
      const setup = document.getElementById('setup');
      if(setup) setup.classList.add('active');
      if(typeof showSetupView === 'function') showSetupView('homeView');
      window.scrollTo(0, 0);
      if(typeof state !== 'undefined'){
        state.inProgress = false;
        state.pausedMode = null;
      }
      if(typeof updateResumeUI === 'function') updateResumeUI();
      return;
    }

    const setup = document.getElementById('setup');
    const homeView = document.getElementById('homeView');
    const isSetupActive = setup && setup.classList.contains('active');
    const isHomeView = homeView && homeView.classList.contains('section-open');
    const pauseModal = document.getElementById('pauseMenuModal');
    const isPauseShown = pauseModal && pauseModal.classList.contains('show');

    // 1. Главный хаб — ничего не делаем
    if(isSetupActive && isHomeView) return;

    // 2. Группа игр (не homeView) — возврат на главный хаб
    if(isSetupActive && !isHomeView){
      if(typeof showSetupView === 'function') showSetupView('homeView');
      window.scrollTo(0, 0);
      return;
    }

    // 3. В игре — если пауза показана, выходим полностью
    if(isPauseShown){
      if(pauseModal) pauseModal.classList.remove('show');
      document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
      if(setup) setup.classList.add('active');
      if(typeof showSetupView === 'function') showSetupView('homeView');
      window.scrollTo(0, 0);
      if(typeof state !== 'undefined'){
        state.inProgress = false;
        state.pausedMode = null;
      }
      if(typeof updateResumeUI === 'function') updateResumeUI();
      return;
    }

    // 4. Игра активна — ставим на паузу через ФУНКЦИЮ ИГРЫ
    const screenIds = getActiveGameScreenIds();
    const PAUSE_MAP = {
      game: 'pauseGame',
      bingoGame: 'pauseBingoGame',
      krokodilSetup: 'pauseKrokodilGame', krokodilGame: 'pauseKrokodilGame',
      tdSetup: 'pauseTdGame', tdGame: 'pauseTdGame',
      truthDareSetup: 'pauseTdGame', truthDareGame: 'pauseTdGame',
      wishlistSetup: 'pauseWishlistGame', wishlistGame: 'pauseWishlistGame',
      desireSetup: 'pauseWishlistGame', desireGame: 'pauseWishlistGame',
      znayuSetup: 'pauseZnayuGame', znayuGame: 'pauseZnayuGame',
      timerSetup: 'pauseTimerGame', timerGame: 'pauseTimerGame',
      quizSetup: 'pauseQuizGame', quizGame: 'pauseQuizGame',
      partyQuizSetup: 'pausePartyQuizGame', partyQuizGame: 'pausePartyQuizGame',
      partyFantsSetup: 'pausePartyFantsGame', partyFantsGame: 'pausePartyFantsGame',
      partyTdSetup: 'pausePartyTdGame', partyTdGame: 'pausePartyTdGame',
      luckySetup: 'pauseLuckyGame', luckyGame: 'pauseLuckyGame',
      kidsMemorySetup: 'pauseKidsMemoryGame', kidsMemoryGame: 'pauseKidsMemoryGame',
      kidsTdSetup: 'pauseKidsTdGame', kidsTdGame: 'pauseKidsTdGame',
      kidsTdChoice: 'pauseKidsTdGame',
      kidsQuizSetup: 'pauseKidsQuizGame', kidsQuizGame: 'pauseKidsQuizGame',
      kidsSaperSetup: 'pauseKidsSaperGame', kidsSaperGame: 'pauseKidsSaperGame',
      famZnayuSetup: 'pauseFamZnayuGame', famZnayuGame: 'pauseFamZnayuGame',
      davaySetup: 'pauseDavayGame', davayGame: 'pauseDavayGame', davayQuiz: 'pauseDavayGame',
      soloBsSetup: 'pauseSoloBattleshipGame', soloBsGame: 'pauseSoloBattleshipGame',
      soloBattleshipSetup: 'pauseSoloBattleshipGame', soloBattleshipGame: 'pauseSoloBattleshipGame',
    };
    // Ищем pause-функцию по ЛЮБОМУ из активных экранов
    let fnName = null;
    for(const sid of screenIds){
      if(PAUSE_MAP[sid]){ fnName = PAUSE_MAP[sid]; break; }
    }
    if(fnName && typeof window[fnName] === 'function'){
      window[fnName]();
      // Страховка: pause-функция могла оставить лишний экран активным
      setTimeout(ensureSingleActiveScreen, 0);
      return;
    }
    // Fallback: для игр без dedicated pause-функции — универсальная пауза.
    // ВАЖНО: скрываем ВСЕ активные игровые экраны, иначе экран делится на 2 части
    if(screenIds.length && typeof state !== 'undefined'){
      const setupEl2 = document.getElementById('setup');
      screenIds.forEach(sid=>{
        const gameScreen = document.getElementById(sid);
        if(gameScreen) gameScreen.classList.remove('active');
      });
      if(setupEl2) setupEl2.classList.add('active');
      const mainId = screenIds.includes('game') ? 'game' : screenIds[0];
      if(mainId.includes('fanty') || mainId === 'game') state.pausedMode = 'fanty';
      else state.pausedMode = null;
      saveState();
      if(typeof updateResumeUI === 'function') updateResumeUI();
      window.scrollTo(0, 0);
    }
  });

  // Автоматическое скрытие/показ кнопки "Назад"
  const setupEl = document.getElementById('setup');
  const homeViewEl = document.getElementById('homeView');
  if(setupEl && homeViewEl && 'MutationObserver' in window){
    function updateBackBtn(){
      const isSetupActive = setupEl.classList.contains('active');
      const isHomeView = homeViewEl.classList.contains('section-open');
      const isHome = isSetupActive && isHomeView;
      backBtn.style.opacity = isHome ? '0' : '1';
      backBtn.style.pointerEvents = isHome ? 'none' : 'auto';
    }
    new MutationObserver(updateBackBtn).observe(setupEl, {attributes:true, attributeFilter:['class']});
    new MutationObserver(updateBackBtn).observe(homeViewEl, {attributes:true, attributeFilter:['class']});
    updateBackBtn();
  }
})();

(document.getElementById('davaySetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{
  document.getElementById('davayRulesModal').classList.add('show');
});
document.getElementById('closeDavayRulesBtn').addEventListener('click', ()=>{
  document.getElementById('davayRulesModal').classList.remove('show');
});
document.getElementById('davayRulesModal').addEventListener('click', (e)=>{
  if(e.target.id === 'davayRulesModal') e.currentTarget.classList.remove('show');
});
(document.getElementById('photoSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{
  document.getElementById('photoRulesModal').classList.add('show');
});
document.getElementById('closePhotoRulesBtn').addEventListener('click', ()=>{
  document.getElementById('photoRulesModal').classList.remove('show');
});
document.getElementById('photoRulesModal').addEventListener('click', (e)=>{
  if(e.target.id === 'photoRulesModal') e.currentTarget.classList.remove('show');
});
// Кнопка «Установить»: на платформах, где доступен системный диалог установки
// (Chrome/Android, новая версия Chromium-браузеров на десктопе), вызываем его
// напрямую (beforeinstallprompt). Везде, где события нет (iOS Safari, уже
// установленное приложение), показываем модалку с инструкцией по установке —
// именно для этого у нас и есть #installModal.
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  // Не даём браузеру показать свой авто-баннер — мы берём установку на себя.
  e.preventDefault();
  deferredInstallPrompt = e;
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
});
// Общая функция установки: если браузер поддерживает установку PWA
// (сработал beforeinstallprompt и приложение ещё не установлено) — вызываем
// системный диалог установки. Иначе (iOS Safari, уже установлено, без
// поддержки) — показываем пошаговую инструкцию #installModal.
function tryInstallApp(){
  if (deferredInstallPrompt) {
    // Есть системный диалог установки (beforeinstallprompt) — вызываем его.
    // prompt() можно вызвать на событии один раз; после вызова объект обнуляем.
    deferredInstallPrompt.prompt();
    deferredInstallPrompt = null;
    return;
  }
  // Системной установки нет — показываем пошаговую инструкцию.
  document.getElementById('installModal').classList.add('show');
}
document.getElementById('installBtn').addEventListener('click', ()=>{
  tryInstallApp();
});
document.getElementById('closeInstallBtn').addEventListener('click', ()=>{
  document.getElementById('installModal').classList.remove('show');
});
document.getElementById('installModal').addEventListener('click', (e)=>{
  if(e.target.id === 'installModal') e.currentTarget.classList.remove('show');
});
// Возрастное предупреждение (18+) — флаги хранятся отдельными ключами в
// localStorage (не внутри основного state), намеренно: чтобы "Сбросить
// прогресс" и импорт/экспорт резервной копии их не трогали, и выбор не
// терялся вместе с прогрессом игр. "Мне нет 18" не блокирует сайт, а
// включает детский режим — см. isKidsModeRestricted/applyKidsModeRestrictions
// ниже. Это клиентский фильтр интерфейса, а не настоящая защита (тот, кто
// откроет исходный код, легко его обойдёт) — временное решение для
// собственного устройства ребёнка, до появления полноценных аккаунтов.
function isKidsModeRestricted(){
  try{ return localStorage.getItem('couple-game-kids-mode-v1') === '1'; }catch(e){ return false; }
}
// Прячет взрослые разделы меню и не даёт Викторине "для одного" показывать
// уровни 18+/Пошлые (она использует общий банк вопросов компании, см.
// games/solo-quiz.js). Вызывается один раз при загрузке и каждый раз, когда
// рендерится список уровней Викторины для одного.
function applyKidsModeRestrictions(){
  if(!isKidsModeRestricted()) return;
  const twoPlayerBtn = document.getElementById('homeTwoPlayerBtn');
  const companyBtn = document.getElementById('homeCompanyBtn');
  if(twoPlayerBtn) twoPlayerBtn.style.display = 'none';
  if(companyBtn) companyBtn.style.display = 'none';
}
document.getElementById('ageGateAdultBtn').addEventListener('click', ()=>{
  try{ localStorage.setItem('couple-game-age-verified-v1', '1'); }catch(e){}
  document.getElementById('ageGateModal').classList.remove('show');
});
document.getElementById('ageGateMinorBtn').addEventListener('click', ()=>{
  try{ localStorage.setItem('couple-game-kids-mode-v1', '1'); }catch(e){}
  document.getElementById('ageGateModal').classList.remove('show');
  applyKidsModeRestrictions();
});
// Долгое нажатие (1.5 сек) на заголовок "Весёлые игры" — скрытый способ для
// родителя вернуть полный доступ на этом устройстве: сбрасывает оба флага
// возрастного экрана и перезагружает страницу, чтобы окно 18+ показалось
// заново.
(function(){
  const titleEl = document.getElementById('homeTitle');
  if(!titleEl) return;
  let pressTimer = null;
  const clearPressTimer = ()=>{ if(pressTimer){ clearTimeout(pressTimer); pressTimer = null; } };
  titleEl.addEventListener('pointerdown', ()=>{
    clearPressTimer();
    pressTimer = setTimeout(()=>{
      if(confirm('Сбросить выбор возраста и снова показать окно 18+?')){
        try{
          localStorage.removeItem('couple-game-age-verified-v1');
          localStorage.removeItem('couple-game-kids-mode-v1');
        }catch(e){}
        location.reload();
      }
    }, 1500);
  });
  titleEl.addEventListener('pointerup', clearPressTimer);
  titleEl.addEventListener('pointerleave', clearPressTimer);
  titleEl.addEventListener('pointercancel', clearPressTimer);
})();
applyKidsModeRestrictions();
document.getElementById('videoLevelUpBtn').addEventListener('click', ()=>{
  if(videoLevel < VIDEO_MAX_LEVEL){
    playLevelUpSound();
    const newLevel = videoLevel + 1;
    // announceEmpty=false здесь — свою подсказку "Добавьте видео" покажем
    // сами ниже, чтобы она не перекрывалась тостом "Уровень повышен"
    // (общий #toast может показывать только одно сообщение одновременно).
    const usedFallback = drawVideoCard(newLevel, false);
    if(usedFallback){
      showToast(`Уровень повышен: ${newLevel} — своих видео здесь нет, показываем демо. Добавьте видео на странице «Давай попробуем»`);
    } else {
      showToast(`Уровень повышен: ${newLevel}`);
    }
  } else {
    showToast('Это максимальный уровень 🔥');
  }
});
document.getElementById('davayLevelUpBtn').addEventListener('click', ()=>{
  if(davayLevel < DAVAY_MAX_LEVEL){
    playLevelUpSound();
    drawDavayCard(davayLevel + 1);
    showToast(`Уровень повышен: ${davayLevel}`);
  } else {
    showToast('Это максимальный уровень 🔥');
  }
});
// "Готовы повторить?" — игра на двоих: сначала выбирается, кто отвечает
// первым, ему показывают 10 разных видео, на каждое — Да/Не сейчас/Нет.
// Затем те же 10 видео в том же порядке показываются второму игроку. После
// обоих — сколько ответов совпало по каждой категории, и видео, на которые
// ОБА ответили "Да", попадают в избранное (❤️).

function getDavayQuizPool(){
  const seen = new Set();
  const pool = [];
  const hidden = state.davayHidden || [];
  getDavayCardsList().filter(c=>c.level===davayLevel && !hidden.includes(davayCardId(c))).forEach(c=>{
    const id = davayCardId(c);
    if(seen.has(id)) return;
    seen.add(id);
    pool.push(c);
  });
  return pool;
}
function davayQuizCardById(id){
  return getDavayCardsList().find(c=>davayCardId(c)===id) || null;
}
function updateDavayPlayerButtons(){
  const p1 = document.getElementById('davayPlayer1Btn');
  const p2 = document.getElementById('davayPlayer2Btn');
  if(p1){
    p1.textContent = state.name1 || 'Игрок 1';
    p1.classList.toggle('active', state.davayQuizActivePlayer === 1);
    p1.classList.toggle('done', !!state.davayQuizP1Done);
  }
  if(p2){
    p2.textContent = state.name2 || 'Игрок 2';
    p2.classList.toggle('active', state.davayQuizActivePlayer === 2);
    p2.classList.toggle('done', !!state.davayQuizP2Done);
  }
  updateDavayProgressBar();
}
function updateDavayProgressBar(){
  const fill = document.getElementById('davayProgressFill');
  const label = document.getElementById('davayProgressLabel');
  if(!fill || !label) return;
  const total = state.davayQuizQueue.length;
  const done = Math.min(state.davayQuizIndex, total);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  fill.style.width = pct + '%';
  label.textContent = total > 0 ? `${done} / ${total}` : '0 / 10';
}
function resetDavayQuiz(){
  state.davayQuizActivePlayer = 0;
  state.davayQuizQueue = [];
  state.davayQuizIndex = 0;
  state.davayQuizAnswers = {};
  state.davayQuizP1Done = false;
  state.davayQuizP2Done = false;
  state.davayQuizPendingNext = 0;
  const gameEl = document.getElementById('game');
  if(gameEl) gameEl.classList.remove('davay-handoff');
  saveState();
  updateDavayPlayerButtons();
}
// Пустая карточка "передайте телефон следующему игроку" между раундами
function renderDavayHandoffCard(nextPlayerNum){
  const gameEl = document.getElementById('game');
  if(gameEl) gameEl.classList.add('davay-handoff');
  const nextName = nextPlayerNum === 2 ? (state.name2 || 'Игрок 2') : (state.name1 || 'Игрок 1');
  clearInterval(timerInterval);
  timerInterval = null;
  currentCard = null;
  currentDavayCard = null;
  fadeSwapCard((card)=>{
    card.className = 'card card-empty';
    card.style.borderTop = '';
    card.innerHTML = `<div class="card-inner"><div class="card-icon">💞</div><div class="card-text davay-handoff-text">Передайте телефон игроку «${nextName}»</div></div>`;
  });
  updateFavoriteBtn();
}
document.getElementById('davayHandoffStartBtn').addEventListener('click', ()=>{
  const gameEl = document.getElementById('game');
  if(gameEl) gameEl.classList.remove('davay-handoff');
  const next = state.davayQuizPendingNext || 2;
  state.davayQuizPendingNext = 0;
  saveState();
  startDavayQuizPlayer(next);
});
function showDavayQuizCurrentCard(){
  const id = state.davayQuizQueue[state.davayQuizIndex];
  const card = id ? davayQuizCardById(id) : null;
  if(card){
    currentDavayCard = card;
    renderDavayCard(card, davayLevel);
  } else {
    renderDavayPlaceholderCard();
  }
}
function startDavayQuizPlayer(playerNum){
  if(state.davayQuizActivePlayer !== 0) return; // уже кто-то отвечает
  if(playerNum === 1 && state.davayQuizP1Done) return;
  if(playerNum === 2 && state.davayQuizP2Done) return;
  // Очередь из 10 видео формируется один раз — на старте первого игрока —
  // и остаётся той же самой для второго.
  if(state.davayQuizQueue.length === 0){
    const pool = shuffle(getDavayQuizPool()).slice(0, 10);
    if(pool.length === 0){
      showToast('Нет видео для этого уровня — добавьте видео кнопкой «+»');
      return;
    }
    if(pool.length < 10){
      showToast(`Пока доступно только ${pool.length} видео — используем их`);
    }
    state.davayQuizQueue = pool.map(c=>davayCardId(c));
  }
  state.davayQuizIndex = 0;
  state.davayQuizActivePlayer = playerNum;
  saveState();
  updateDavayPlayerButtons();
  showDavayQuizCurrentCard();
}
// Ряд с именами игроков теперь только показывает, чей сейчас ход — выбор
// игрока сделан заранее на странице настройки, кликать по кнопкам не нужно.

function finishDavayQuizSummary(){
  // "Нет": "Нет" от ЛЮБОГО из игроков — видео исключается из игры до сброса
  // прогресса (приоритет выше остальных вариантов).
  // "Да": оба ответили "Да" — в избранное.
  // "Не сейчас": оба ответили "Не сейчас", ИЛИ один "Не сейчас" а другой "Да" —
  // видео остаётся в игре и может снова попасться случайно в будущих раундах.
  let matchYes = 0, matchLater = 0, matchNo = 0;
  const newFavorites = [];
  const newLater = [];
  const newHidden = [];
  state.davayQuizQueue.forEach(id=>{
    const a = state.davayQuizAnswers[id];
    if(!a || !a.p1 || !a.p2) return;
    if(a.p1 === 'no' || a.p2 === 'no'){
      matchNo++;
      newHidden.push(id);
    } else if(a.p1 === 'yes' && a.p2 === 'yes'){
      matchYes++;
      newFavorites.push(id);
    } else if(
      (a.p1 === 'later' && a.p2 === 'later') ||
      (a.p1 === 'later' && a.p2 === 'yes') ||
      (a.p1 === 'yes' && a.p2 === 'later')
    ){
      matchLater++;
      newLater.push(id);
    }
  });
  if(!state.davayLiked) state.davayLiked = [];
  newFavorites.forEach(id=>{
    if(!state.davayLiked.includes(id)) state.davayLiked.push(id);
  });
  if(!state.davayFavLater) state.davayFavLater = [];
  newLater.forEach(id=>{
    if(!state.davayFavLater.includes(id)) state.davayFavLater.push(id);
  });
  if(!state.davayHidden) state.davayHidden = [];
  newHidden.forEach(id=>{
    if(!state.davayHidden.includes(id)) state.davayHidden.push(id);
  });
  saveState();
  updateFavoriteBtn();
  resetDavayQuiz();
  renderDavayPlaceholderCard();
  showDavaySummaryModal(matchYes, matchLater, matchNo);
}

function showDavaySummaryModal(matchYes, matchLater, matchNo){
  const introEl = document.getElementById('davaySummaryIntro');
  if(introEl){
    introEl.textContent = matchYes > 0
      ? 'Совпавшие «Да» уже добавлены в избранное ❤️'
      : 'Совпадений «Да» в этот раз нет — попробуйте другой уровень или добавьте ещё видео.';
  }
  const yesEl = document.getElementById('davaySummaryYes');
  if(yesEl) yesEl.textContent = `❤️ Да: ${matchYes}`;
  const laterEl = document.getElementById('davaySummaryLater');
  if(laterEl) laterEl.textContent = `🤔 Не сейчас: ${matchLater}`;
  const favBtn = document.getElementById('davaySummaryFavBtn');
  if(favBtn) favBtn.style.display = matchYes > 0 ? 'flex' : 'none';
  const modal = document.getElementById('davaySummaryModal');
  if(modal) modal.classList.add('show');
}
document.getElementById('closeDavaySummaryBtn').addEventListener('click', ()=>{
  document.getElementById('davaySummaryModal').classList.remove('show');
  exitDavayGame(true);
});
document.getElementById('davaySummaryModal').addEventListener('click', (e)=>{
  if(e.target.id === 'davaySummaryModal') e.currentTarget.classList.remove('show');
});
document.getElementById('davaySummaryFavBtn').addEventListener('click', ()=>{
  document.getElementById('davaySummaryModal').classList.remove('show');
  if(!state.davayFavoritesOnly){
    state.davayFavoritesOnly = true;
    saveState();
  }
  // Просмотр избранного — это не партия, которую можно поставить на паузу,
  // поэтому кнопка сразу подписана "Выход" (обработчик см. у pauseBtn).
  document.getElementById('pauseBtn').textContent = 'Выход';
  updateDavayFavoritesBtn();
  showDavayFavoriteAt(0);
});

function answerDavayQuiz(answer){
  if(!state.davayQuizActivePlayer){
    playErrorSound();
    showToast('Выберите имя игрока, кто начинает первым');
    return;
  }
  const id = state.davayQuizQueue[state.davayQuizIndex];
  if(!id) return;
  if(!state.davayQuizAnswers[id]) state.davayQuizAnswers[id] = {};
  const key = state.davayQuizActivePlayer === 1 ? 'p1' : 'p2';
  state.davayQuizAnswers[id][key] = answer;
  state.davayQuizIndex++;
  if(state.davayQuizIndex < state.davayQuizQueue.length){
    saveState();
    updateDavayProgressBar();
    showDavayQuizCurrentCard();
    return;
  }
  // Игрок ответил на все 10 — переходим к следующему шагу. Кто именно
  // закончил первым (игрок 1 или 2), зависит от выбора "Первым начинает" на
  // странице настройки, поэтому нельзя жёстко привязываться к номеру игрока —
  // переходим к итогам только когда оба отмечены как завершившие.
  const finishedPlayer = state.davayQuizActivePlayer;
  if(finishedPlayer === 1) state.davayQuizP1Done = true;
  else state.davayQuizP2Done = true;
  state.davayQuizActivePlayer = 0;
  const otherAlreadyDone = finishedPlayer === 1 ? state.davayQuizP2Done : state.davayQuizP1Done;
  if(!otherAlreadyDone){
    const nextPlayer = finishedPlayer === 1 ? 2 : 1;
    state.davayQuizPendingNext = nextPlayer;
    saveState();
    updateDavayPlayerButtons();
    renderDavayHandoffCard(nextPlayer);
  } else {
    saveState();
    finishDavayQuizSummary();
  }
}
document.getElementById('davayYesBtn').addEventListener('click', ()=>{
  if(cardTransitionLocked) return;
  playSuccessSound();
  answerDavayQuiz('yes');
});
document.getElementById('davayLaterBtn').addEventListener('click', ()=>{
  if(cardTransitionLocked) return;
  answerDavayQuiz('later');
});
document.getElementById('davayNoBtn').addEventListener('click', ()=>{
  if(cardTransitionLocked) return;
  playFailSound();
  answerDavayQuiz('no');
});
document.getElementById('levelUpBtn').addEventListener('click', ()=>{
  // Примечание: этой кнопкой пользуются только Фанты и "Предложи партнеру" —
  // в Видеорулетке и "Давай попробуем" она скрыта CSS (там свои кнопки
  // videoLevelUpBtn/davayLevelUpBtn), поэтому здесь нет веток под эти режимы.
  if(isPlaceholderMode()){
    playLevelUpSound();
    drawPhotoCard(photoLevel < PHOTO_MAX_LEVEL ? photoLevel + 1 : 1);
    return;
  }
  levelUp();
});
document.getElementById('levelDownBtn').addEventListener('click', ()=>{
  // См. примечание у levelUpBtn — в Видеорулетке/"Давай попробуем" кнопка скрыта.
  if(isPlaceholderMode()){
    if(photoLevel > 1){
      playNeutralSound();
      drawPhotoCard(photoLevel - 1);
      showToast(`Уровень понижен: ${photoLevel}`);
    } else {
      showToast('Это минимальный уровень');
    }
  }
});
document.getElementById('dislikeBtn').addEventListener('click', ()=>{
  if(isPlaceholderMode()){
    if(!currentPhotoCard) return;
    playErrorSound();
    if(!state.photoHidden) state.photoHidden = [];
    if(!state.photoHidden.includes(photoCardKey(currentPhotoCard))){
      state.photoHidden.push(photoCardKey(currentPhotoCard));
    }
    saveState();
    showToast('Карточка скрыта 🚫');
    drawPhotoCard(photoLevel);
    return;
  }
  if(isVideoMode()){
    if(!currentVideoCard) return;
    playErrorSound();
    if(!state.videoHidden) state.videoHidden = [];
    const vid = videoCardId(currentVideoCard);
    if(!state.videoHidden.includes(vid)){
      state.videoHidden.push(vid);
    }
    saveState();
    showToast('Видео скрыто 🚫');
    drawVideoCard(videoLevel, true);
    return;
  }
  if(isDavayMode()){
    if(!currentDavayCard) return;
    playErrorSound();
    if(!state.davayHidden) state.davayHidden = [];
    const vid = davayCardId(currentDavayCard);
    if(!state.davayHidden.includes(vid)){
      state.davayHidden.push(vid);
    }
    saveState();
    showToast('Видео скрыто 🚫');
    drawDavayCard(davayLevel);
    return;
  }
  dislikeCurrentCard();
});

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
document.getElementById('exportCardsBtn').addEventListener('click', ()=>{
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
document.getElementById('importCardsBtn').addEventListener('click', ()=>{
  document.getElementById('importCardsInput').click();
});
document.getElementById('importCardsInput').addEventListener('change', (e)=>{
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
  document.getElementById('addCardModal').classList.add('show');
});
document.getElementById('closeAddCardBtn').addEventListener('click', ()=>{
  document.getElementById('addCardModal').classList.remove('show');
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

