// fants-davay.js — вынесено из games/core.js при разделении монолита.
//
// Зачем: core.js вырос до 6700 строк, и чтение его целиком для правки одной
// функции стоило 100+ тыс. токенов контекста. Теперь каждая тема — отдельный
// файл, и правка читает 700–1700 строк вместо 6700.
//
// Порядок подключения сохранён как в исходном core.js: функции объявляются
// в глобальной области и вызывают друг друга по имени, поэтому файлы должны
// грузиться после core.js и до init.js.

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
    importedDavayCards = rows.map(r => {
      const hasUrl = !!r.url;
      const src = hasUrl ? r.url : URL.createObjectURL(r.blob);
      return {
        level: r.level || 1,
        video: src,
        id: 'imported-' + r.id,
        imported: true,
        source: hasUrl ? 'yandex' : 'local'
      };
    });
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

// ===== Интеграция с Яндекс Диск (прототип) =====
// Загрузка видео с Яндекс Диск через API v1.
// Публичная папка: https://disk.yandex.ru/d/fv1y_t0ZQ3YASg
// Получаем список файлов и прямые ссылки на скачивание через API.
const YANDEX_DISK_PUBLIC_KEY = 'https://disk.yandex.ru/d/fv1y_t0ZQ3YASg';
const YANDEX_DISK_API_BASE = 'https://cloud-api.yandex.net/v1/disk/public/resources';
let yandexDiskLoading = false;

// Папки на диске шире, чем 4 игровых уровня: несколько папок могут
// привязываться к одному уровню (davaySetupLevel 3..6).
// ЗАМЕЧАНИЕ (2026-09-20): папки переименованы/убраны владельцем — сейчас
// корень публичной ссылки это плоский список из ~172 .webm без подпапок.
// Поэтому грузим рекурсивно весь корень и делим видео по 4 игровым уровням
// поровну (round-robin), вместо запросов к несуществующим path=/Level 00X.
const DAVAY_DISK_LEVELS = [
  {id:1, setupLevel:3, name:'Ласки разогрев', path:'/'},
  {id:2, setupLevel:3, name:'Нежные прикосновения', path:'/'},
  {id:3, setupLevel:4, name:'Разогрев', path:'/'},
  {id:4, setupLevel:4, name:'Прелюдия', path:'/'},
  {id:5, setupLevel:4, name:'Устная ласка', path:'/'},
  {id:6, setupLevel:5, name:'Кунилингус', path:'/'},
  {id:7, setupLevel:5, name:'Минет', path:'/'},
  {id:8, setupLevel:5, name:'Классика', path:'/'},
  {id:9, setupLevel:5, name:'Глубокое проникновение', path:'/'},
  {id:10, setupLevel:5, name:'Позы сзади', path:'/'},
  {id:11, setupLevel:6, name:'Наездница', path:'/'},
  {id:12, setupLevel:6, name:'Анальные ласки', path:'/'},
  {id:13, setupLevel:6, name:'Анальный секс', path:'/'},
  {id:14, setupLevel:6, name:'Групповой', path:'/'},
  {id:15, setupLevel:6, name:'БДСМ', path:'/'},
  {id:16, setupLevel:6, name:'Фистинг', path:'/'},
  {id:17, setupLevel:6, name:'Фетиш', path:'/'},
  {id:18, setupLevel:6, name:'Игрушки', path:'/'},
];


// Получить список файлов в публичной папке/подпапке через API
async function fetchYandexDiskFiles(path){
  const publicKey = state.yandexPublicKey || YANDEX_DISK_PUBLIC_KEY;
    let url = `${YANDEX_DISK_API_BASE}?public_key=${encodeURIComponent(publicKey)}&path=${encodeURIComponent(path || '/')}&limit=1000`;
  const headers = {};
  if(state.yandexOAuthToken){
    headers['Authorization'] = `OAuth ${state.yandexOAuthToken}`;
  }
  const resp = await fetch(url, { headers });
  if(!resp.ok){
    throw new Error('Yandex API error: ' + resp.status);
  }
  const data = await resp.json();
  return data._embedded ? data._embedded.items : [];
}

// Сохранить прямую ссылку на видео в IndexedDB (без загрузки blob — обход CORS Яндекс Диска)
async function saveDavayUrl(url, level, name){
  return new Promise((resolve, reject)=>{
    openDavayDB().then(db=>{
      const tx = db.transaction(DAVAY_DB_STORE, 'readwrite');
      const store = tx.objectStore(DAVAY_DB_STORE);
      const entry = { name:name||'video', url:url, level:level, addedAt:Date.now() };
      store.add(entry);
      tx.oncomplete = ()=> resolve(entry);
      tx.onerror = ()=> reject(tx.error);
    }).catch(reject);
  });
}

// Получить прямую ссылку на видео и сохранить в IndexedDB
async function downloadYandexDiskFile(fileInfo, level){
  const directLink = fileInfo.file;
  if(!directLink) throw new Error('Нет ссылки на файл: ' + fileInfo.name);
  await saveDavayUrl(directLink, level, fileInfo.name);
  return { name:fileInfo.name, level:level };
}

// ===== Загрузить видео с Яндекс Диска: рекурсивный обход корня публичной папки,
// // видео делятся по 4 игровым уровням поровну (round-robin по алфавиту имён).
// // gameLevels — массив игровых уровней 1..4 для распределения.
async function loadYandexDiskLevel(level, path, gameLevels){
  if(yandexDiskLoading) return { added:0, level:level, error: 'Загрузка уже идёт' };
  yandexDiskLoading = true;
  try {
    const items = await fetchYandexDiskFiles(path || '/');
    // Рекурсивный обход подпапок отключён: грузим только файлы из корня.
    // Папки игнорируем — раньше здесь был цикл по подпапкам и отладочные
    // console.log, удалены при чистке.
    let videoItems = items.filter(i => i.type === 'file' && /\.(webm|mp4|mov|avi)$/i.test(i.name));

    if(videoItems.length === 0 && items.length === 0){
      yandexDiskLoading = false;
      return { added:0, level:level, error: 'Папка пуста или не найдена.' };
    }
    
    
    if(videoItems.length === 0){
      yandexDiskLoading = false;
      const fileNames = items.slice(0, 10).map(i=>i.name).join(', ');
      const allTypes = [...new Set(items.map(i=>i.type))].join(', ');
      return { added:0, level:level, error: `В папке ${items.length} файл(ов) типа: ${allTypes}. Видео не найдены. Примеры: ${fileNames || 'пусто'}` };
    }
    
    // Распределяем видео по уровням: текущий уровень забирает только свою долю (round-robin).
    videoItems.sort((a,b)=> (a.name||'').localeCompare(b.name||''));
    const allLevels = (gameLevels && gameLevels.length) ? gameLevels : [level];
    const myIdx = allLevels.indexOf(level);
    const myVideos = videoItems.filter((_, i)=> i % allLevels.length === (myIdx < 0 ? 0 : myIdx));
    const results = await Promise.all(myVideos.map(i => downloadYandexDiskFile(i, level).catch(e => { 
      return { error: e.message };
    })));
    const added = results.filter(r => r && !r.error).length;
    const errors = results.filter(r => r && r.error);
    
    if(added > 0){
      importedDavayVideosLoaded = false;
      await ensureImportedDavayVideosLoaded();
    }
    
    yandexDiskLoading = false;
    if(added === 0 && errors.length > 0){
      return { added:0, level:level, error: `Ошибка загрузки: ${errors[0].error}` };
    }
    return { added:added, level:level, total:videoItems.length };
  } catch(err){
    yandexDiskLoading = false;
    return { added:0, level:level, error: err.message };
  }
}
// ===== Модалка выбора уровня для только что выбранных файлов =====
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
    video.src = card.url || card.video;
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
                     <video src="${card.url || card.video}" id="davayPlayer" playsinline autoplay></video>
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
  // Отменяем незавершённую паузу «Давай попробуем»: игрок вместо «Продолжить»
  // открывает настройку заново, значит старая партия не нужна — чистим её
  // состояние и следы режима. Раньше это делала отдельная функция
  // abandonPausedDavaySession(), но её никто не вызывал: весь код пользовался
  // общим abandonPausedSession('davay'), который только снимает паузу,
  // оставляя историю и квиз от прошлой партии.
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
  goToGameSetup('davaySetup', null, ()=>{
    renderDavaySetupStarterGroup();
    renderDavaySetupLevels();
    updateDavaySetupStarterLabels();
    updateDavaySetupSoundBtn();
  });
}
function exitDavaySetup(){
  document.getElementById('davaySetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}
document.getElementById('davaySetupImportBtn').addEventListener('click', ()=>{
  davayImportInputEl.click();
});
document.getElementById('davaySetupYandexBtn').addEventListener('click', async ()=>{
  // Автоматическая загрузка видео с Яндекс Диска через API
  if(!state.yandexOAuthToken){
    showToast('❌ Нет OAuth-токена. Нажмите ⚙️ Настройки и введите токен');
    return;
  }
  // Один игровой уровень (3..6) может объединять несколько папок на диске:
  // загружаем все папки с setupLevel === текущий уровень.
  const folders = DAVAY_DISK_LEVELS.filter(l => l.setupLevel === state.davaySelectedLevel);
  const levels = folders.length ? folders : DAVAY_DISK_LEVELS.filter(l => l.id === state.davaySelectedLevel);
  if(!levels.length){
    showToast('Уровень не найден в списке Яндекс Диска');
    return;
  }
  showToast(`Загрузка видео...`);
  // Игровой уровень 1..4 (davaySelectedLevel 3..6 → gameLevel = id - 2):
  // видео сохраняем под ним, иначе drawDavayCard их не найдёт.
  const gameLevel = state.davaySelectedLevel - 2;
  // distribute: каждый игровой уровень забирает свою долю из общего списка
  const allGameLevels = [1,2,3,4];
  const result = await loadYandexDiskLevel(gameLevel, '/', allGameLevels);
  let addedTotal = result.added || 0, lastError = result.error || '';
  if(lastError && addedTotal === 0){
    showToast('❌ ' + lastError);
  } else if(addedTotal > 0){
    showToast(`✅ Загружено видео: ${addedTotal}`);
  } else {
    showToast('ℹ️ Видео не найдены или уже загружены');
  }
});
document.getElementById('davaySetupYandexSettingsBtn').addEventListener('click', ()=>{
  // Открываем модалку настроек Яндекс Диска
  document.getElementById('yandexTokenInput').value = state.yandexOAuthToken || '';
  document.getElementById('yandexPublicKeyInput').value = state.yandexPublicKey || YANDEX_DISK_PUBLIC_KEY;
  document.getElementById('yandexSettingsModal').classList.add('show');
});
document.getElementById('yandexSettingsCloseBtn').addEventListener('click', ()=>{
  document.getElementById('yandexSettingsModal').classList.remove('show');
});
document.getElementById('yandexSettingsSaveBtn').addEventListener('click', ()=>{
  state.yandexOAuthToken = document.getElementById('yandexTokenInput').value.trim();
  state.yandexPublicKey = document.getElementById('yandexPublicKeyInput').value.trim();
  saveState();
  document.getElementById('yandexSettingsModal').classList.remove('show');
  showToast('Настройки Яндекс Диска сохранены');
});
document.getElementById('yandexLinksCloseBtn').addEventListener('click', ()=>{
  document.getElementById('yandexLinksModal').classList.remove('show');
});
document.getElementById('yandexLinksImportBtn').addEventListener('click', async ()=>{
  const textarea = document.getElementById('yandexLinksInput');
  const urls = textarea.value.split('\n').map(l=>l.trim()).filter(l=>l.length>0);
  if(urls.length === 0){
    showToast('Введите хотя бы одну ссылку');
    return;
  }
  const level = parseInt(document.getElementById('yandexLinksLevelSelect').value, 10);
  document.getElementById('yandexLinksModal').classList.remove('show');
  showToast(`Загрузка ${urls.length} файлов...`);
  let added = 0;
  for(const url of urls){
    try{
      const resp = await fetch(url, { mode:'cors' });
      if(!resp.ok) continue;
      const blob = await resp.blob();
      const filename = url.split('/').pop().split('?')[0] || 'video.webm';
      const file = new File([blob], filename, { type:blob.type || 'video/webm' });
      await saveDavayBlob(file, level);
      added++;
    }catch(e){}
  }
  if(added > 0){
    importedDavayVideosLoaded = false;
    ensureImportedDavayVideosLoaded();
    showToast(`Загружено ${added} видео`);
  } else {
    showToast('Не удалось загрузить файлы. Проверьте ссылки и CORS.');
  }
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
  goToGameSetup('photoSetup', null, ()=>{
    renderPhotoSetupLevels();
    updateMuteBtn();
  });
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
  state.name1 = n1raw || 'Парень';
  state.name2 = n2raw || 'Девушка';
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

function goToPlaceholderGame(){
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
  const n1raw = document.getElementById('name1').value.trim();
  const n2raw = document.getElementById('name2').value.trim();
  state.name1 = n1raw || 'Парень';
  state.name2 = n2raw || 'Девушка';
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
  stopAllSounds();
  state.inProgress = false;
  state.photoFavView = false;
  state.pausedMode = null;
  const pauseModalEl = document.getElementById('pauseMenuModal');
  if(pauseModalEl) pauseModalEl.classList.remove('show');
  saveState();
  document.getElementById('game').classList.remove('placeholder-mode');
  document.getElementById('game').classList.remove('photo-favview');
  document.getElementById('doneBtn').textContent = '💕 Готово';
  document.getElementById('pauseBtn').textContent = 'Пауза';
  // Выход в меню игры «Предложи партнеру» (экран настройки уровня), а не
  // в общий хаб: goToPhotoSetup гасит все активные экраны и перерисовывает
  // список уровней. Раньше здесь был returnToSetupUI(), который открывал
  // экран настройки «Фантов» — из-за этого выход из «Предложи партнеру»
  // по виду совпадал с паузой «Фантов».
  goToPhotoSetup();
  if(typeof releaseWakeLockNow === 'function') releaseWakeLockNow();
}

