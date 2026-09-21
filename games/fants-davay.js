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
// Отметка state.videoResetAt, при которой каталог был прочитан из базы: если
// она отстала от текущей, каталог устарел (игрок сбросил весь прогресс).
let importedDavayCatalogLoadedAt = 0;

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
// Забыть загруженный каталог видео, не трогая саму базу. Нужно после «Сбросить
// весь прогресс»: база чистится, но её список приложение держит ещё и в
// памяти — без забытья игрок видел свои прежние ролики, пока не перезагрузит
// страницу. Блоб-ссылки локальных видео освобождаем, чтобы не копить мусор.
function refreshDavayCatalogInMemory(){
  importedDavayCards.forEach(c=>{
    if(c.source === 'local' && c.video && c.video.indexOf('blob:') === 0){
      try{ URL.revokeObjectURL(c.video); }catch(err){}
    }
  });
  importedDavayCards = [];
  importedDavayVideosLoaded = false;
  importedDavayCatalogLoadedAt = 0;
}
// Загружен ли каталог уже после последнего сброса. «Сбросить весь прогресс» —
// это единственное место, где каталог меняется в обход импорта, поэтому
// отметка videoResetAt в localStorage для игры — единственный источник правды:
// её нельзя пропустить из-за незавершённой асинхронной операции.
function davayCatalogIsStale(){
  return (state.videoResetAt || 0) > (importedDavayCatalogLoadedAt || 0);
}
function ensureImportedDavayVideosLoaded(){
  if(davayCatalogIsStale()) refreshDavayCatalogInMemory();
  if(importedDavayVideosLoaded) return Promise.resolve();
  return loadAllDavayBlobs().then(rows => {
    const resetAt = state.videoResetAt || 0;
    const fresh = rows.map(r => {
      const hasUrl = !!r.url;
      const src = hasUrl ? r.url : URL.createObjectURL(r.blob);
      return {
        level: r.level || 1,
        video: src,
        id: 'imported-' + r.id,
        dbId: r.id,
        // Имя файла обязательно переносим в карточку: по нему восстанавливается
        // ссылка для записей, у которых не сохранён путь внутри папки, и оно же
        // попадает в диагностику. Раньше карточка его не имела — в отчёте было
        // видно только «imported-343» вместо имени ролика, а поиск по имени для
        // старых записей не работал вовсе.
        name: r.name || '',
        urlAt: r.urlAt || 0,
        yandexPath: r.yandexPath || null,
        imported: true,
        source: hasUrl ? 'yandex' : 'local'
      };
    });
    // Карточки, которые игра уже держит в работе (текущая и история), — это
    // ОТДЕЛЬНЫЕ объекты. После перечитывания каталога они указывали бы на
    // устаревшие объекты со старыми ссылками, поэтому подменяем их свежими
    // по id (хуки каждой игры знают про свои переменные).
    fresh.forEach(c => replaceLiveVideoCard(c.id, c));
    importedDavayCards = fresh;
    importedDavayCatalogLoadedAt = resetAt;
    importedDavayVideosLoaded = true;
  }).catch(()=>{
    importedDavayCards = [];
    importedDavayCatalogLoadedAt = state.videoResetAt || 0;
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
// Запуск — в init.js после loadState(), чтобы не перезаписать сохранённые настройки.

// ===== Интеграция с Яндекс Диском =====
// Видео берутся из ПУБЛИЧНОЙ папки Яндекс Диска: она открывается по одной
// ссылке (YANDEX_DISK_PUBLIC_KEY ниже), авторизация не нужна. Никакого токена
// в приложении нет и быть не может: код статический, всё, что попало в
// браузер, доступно посетителю, а личный OAuth-токен открывает доступ ко всему
// диску, а не только к этой папке. Закрытая папка потребовала бы бэкенда.
//
// Сами файлы не скачиваются — в папках уровней ~1600 роликов общим весом
// около 5 ГБ, столько в IndexedDB не поместится. Вместо этого сохраняем
// прямую ссылку на файл (`file` из ответа API) и путь внутри папки. Путь
// храним, чтобы ссылку можно было обновить: Яндекс подписывает её, и через
// какое-то время она перестаёт открываться. Один запрос списка даёт свежие
// ссылки сразу на все файлы папки.
//
// Структура публичной папки («Видео для игры»): внутри только папки уровней
// «Level N-M <описание>» — например «Level 1-1 Ласки разогрев». Первое число
// (N) — номер игрового уровня 1..6, второе (M) — подуровень, который пока не
// разделяем. Файлы в корне и папки не по формату игнорируются.
const YANDEX_DISK_PUBLIC_KEY = 'https://disk.yandex.ru/d/uv6GUxruxjpkzQ';
// Прежняя ссылка на папку: она лежала в state.yandexPublicKey у игроков,
// которые нажимали «Обновить видеофайлы» раньше. Старая папка больше не
// используется — подменяем сохранённый ключ на новый (см. davayYandexPublicKey).
const YANDEX_DISK_PUBLIC_KEY_OLD = 'https://disk.yandex.ru/d/fv1y_t0ZQ3YASg';
const YANDEX_DISK_API_BASE = 'https://cloud-api.yandex.net/v1/disk/public/resources';
const YANDEX_DISK_DOWNLOAD_API = 'https://cloud-api.yandex.net/v1/disk/public/resources/download';
// Ссылки на файлы Яндекс Диска переподписываются на стороне Яндекса, причём
// id в адресе меняется при каждом запросе к API. Проверено: свежая ссылка
// отдаёт 206, а сохранённая ранее — 403 (тогда <video> падает с ошибкой 4,
// MEDIA_ERR_SRC_NOT_SUPPORTED, то есть чёрный экран). Поэтому «свежей» считаем
// ссылку не старше 30 минут; перед показом ролика обновляем принудительно.
const YANDEX_HREF_TTL = 30 * 60 * 1000;
const YANDEX_VIDEO_RE = /\.(webm|mp4|m4v|mov|avi|mkv)$/i;
// Имя папки уровня на Диске: «Level 1-1 Ласки разогрев». Первое число —
// игровой уровень 1..6, подуровень «-1» пока не используем (см.
// yandexLevelFromFolderName).
const YANDEX_LEVEL_FOLDER_RE = /^Level\s+(\d+)/i;
let yandexDiskLoading = false;

function davayYandexPublicKey(){
  const stored = String(state.yandexPublicKey || '').trim();
  const key = (stored && stored !== YANDEX_DISK_PUBLIC_KEY_OLD)
    ? stored : YANDEX_DISK_PUBLIC_KEY;
  // Старый ключ из прежней папки подменяем молча: он лежал в state с прошлых
  // нажатий кнопки, папка по нему больше не используется. Вместе с ключом
  // «поедут» и ссылки — их обновит синхронизация по новым путям.
  if(stored !== key){
    state.yandexPublicKey = key;
    saveState();
  }
  return key;
}

// Запрос к API Диска. Читаем ТОЛЬКО публичную папку по ссылке: этого
// достаточно, чтобы получить список файлов и ссылки на них. Заголовка
// авторизации здесь нет намеренно — ни один запрос не должен уходить с
// личным токеном (см. комментарий к интеграции выше).
async function fetchYandexJson(url){
  // referrerPolicy:'no-referrer' — у Яндекса антихотлинк: запрос с чужим
  // доменом в Referer получает 403, без него — 200/206.
  const resp = await fetch(url, { referrerPolicy: 'no-referrer' });
  if(!resp.ok) throw new Error('Яндекс Диск ответил ' + resp.status);
  return resp.json();
}

// Список файлов в публичной папке (path — путь внутри папки, '/' — корень)
async function fetchYandexDiskFiles(path){
  const url = `${YANDEX_DISK_API_BASE}?public_key=${encodeURIComponent(davayYandexPublicKey())}`
            + `&path=${encodeURIComponent(path || '/')}&limit=1000`;
  const data = await fetchYandexJson(url);
  return data._embedded ? (data._embedded.items || []) : [];
}

// Свежая подписанная ссылка на один файл — запасной путь на случай, если в
// списке файлов поля `file` не оказалось.
async function fetchYandexDiskHref(path){
  const url = `${YANDEX_DISK_DOWNLOAD_API}?public_key=${encodeURIComponent(davayYandexPublicKey())}`
            + `&path=${encodeURIComponent(path)}`;
  const data = await fetchYandexJson(url);
  if(!data || !data.href) throw new Error('Яндекс не отдал ссылку на файл');
  return data.href;
}

// Номер игрового уровня по имени папки на Диске: «Level 1-1 Ласки разогрев»
// → 1, «Level 6-2 На троих» → 6. Папка не по формату — 0 (игнорируем).
function yandexLevelFromFolderName(name){
  const m = YANDEX_LEVEL_FOLDER_RE.exec(String(name || '').trim());
  if(!m) return 0;
  const n = parseInt(m[1], 10);
  return (n >= DAVAY_LEVEL_MIN && n <= DAVAY_LEVEL_MAX) ? n : 0;
}

// Папки уровней в корне публичной папки: [{level, path, name}]. Файлы в корне
// и папки не по формату игнорируются — смотрим только «Level N-M …».
async function fetchYandexLevelFolders(){
  const items = await fetchYandexDiskFiles('/');
  const folders = [];
  items.forEach(i=>{
    if(i.type !== 'dir') return;
    const level = yandexLevelFromFolderName(i.name);
    if(level) folders.push({ level: level, path: i.path, name: i.name });
  });
  folders.sort((a,b)=> String(a.path).localeCompare(String(b.path)));
  return folders;
}

// Все видеофайлы из папок уровней одним плоским списком — для обновления
// ссылок (refreshYandexLinks и восстановление отдельного ролика). Публичный
// API не умеет рекурсивный список, поэтому запрос идёт по каждой папке;
// папок немного (19), и пускать их параллельно быстрее, чем последовательно.
async function fetchYandexLevelFiles(){
  const folders = await fetchYandexLevelFolders();
  const out = [];
  await Promise.all(folders.map(folder =>
    fetchYandexDiskFiles(folder.path)
      .then(items => { items.forEach(i => { if(i.type === 'file' && i.file) out.push(i); }); })
      .catch(()=>{})
  ));
  return out;
}

// Форматы, которые <video> в мобильных браузерах стабильно не проигрывает
// (особенно iOS): .avi и .mkv. Из папки их лучше не брать — в игре они дадут
// чёрный экран, поэтому пропускаем их при импорте и сообщаем об этом в отчёте.
const YANDEX_SKIP_EXT_RE = /\.(avi|mkv)$/i;
function isPlayableVideoItem(item){
  return !YANDEX_SKIP_EXT_RE.test(item.name || '');
}

// Сохранить видео с Диска: новые строки добавляем, у старых (сохранённых
// прошлой версией, без пути внутри папки) дописываем путь и свежую ссылку.
// Делаем это одной транзакцией: файлов может быть больше сотни.
function saveYandexRows(rows, updates){
  const addedAt = Date.now();
  return openDavayDB().then(db => new Promise((resolve, reject)=>{
    const tx = db.transaction(DAVAY_DB_STORE, 'readwrite');
    const store = tx.objectStore(DAVAY_DB_STORE);
    rows.forEach(r => store.add(Object.assign({ addedAt: addedAt }, r)));
    updates.forEach(u=>{
      const req = store.get(u.id);
      req.onsuccess = ()=>{
        const row = req.result;
        if(!row) return;
        row.url = u.url;
        row.urlAt = u.urlAt;
        row.yandexPath = u.yandexPath;
        row.publicKey = u.publicKey;
        if(u.level) row.level = u.level;
        store.put(row);
      };
    });
    tx.oncomplete = ()=>{
      // Ссылки уже лежат в базе, но игра работает с объектами В ПАМЯТИ:
      // каталог и карточки текущей партии нужно обновить здесь же, иначе на
      // экране останется прежний (мёртвый) адрес.
      applyYandexUpdatesInMemory(updates);
      resolve(rows.length + updates.length);
    };
    tx.onerror = ()=> reject(tx.error || new Error('Не удалось сохранить видео'));
    tx.onabort = ()=> reject(tx.error || new Error('Сохранение прервано'));
  })).catch(()=> 0);
}

// Разложить свежие ссылки по объектам в памяти: каталог плюс карточки, которые
// игра уже держит (текущая и истории обеих игр).
function applyYandexUpdatesInMemory(updates){
  if(!updates || !updates.length) return;
  const byId = new Map();
  importedDavayCards.forEach(c=>{ if(c && c.id) byId.set(String(c.id), c); });
  updates.forEach(u=>{
    if(!u || !u.url) return;
    const cardId = 'imported-' + u.id;
    const card = byId.get(cardId);
    if(card){
      card.video = u.url;
      card.urlAt = u.urlAt || Date.now();
      if(u.yandexPath) card.yandexPath = u.yandexPath;
      card.hrefRefreshed = false;
    }
    applyFreshYandexHref(cardId, u.url, u.urlAt || Date.now());
  });
}

// Обновить прямые ссылки у уже сохранённых строк (по id строки в IndexedDB)
function updateYandexRows(updates){
  if(!updates.length) return Promise.resolve();
  return openDavayDB().then(db => new Promise((resolve, reject)=>{
    const tx = db.transaction(DAVAY_DB_STORE, 'readwrite');
    const store = tx.objectStore(DAVAY_DB_STORE);
    updates.forEach(u=>{
      const req = store.get(u.id);
      req.onsuccess = ()=>{
        const row = req.result;
        if(!row) return;
        row.url = u.url;
        row.urlAt = u.urlAt;
        // Путь внутри папки мог быть найден только сейчас (у старых записей
        // его не было) — сохраняем, чтобы в следующий раз не искать по имени.
        if(u.yandexPath) row.yandexPath = u.yandexPath;
        store.put(row);
      };
    });
    tx.oncomplete = ()=> resolve();
    tx.onerror = ()=> reject(tx.error);
  })).catch(()=>{});
}

// Удалить записи Диска, которых больше нет в папках (другая ссылка на папку,
// ролик переименован или удалён). Такие строки не оживут никогда — обновление
// ссылок ищет файл в папке, поэтому оставлять их значит копить в пуле уровня
// карточки, которые всегда дают чёрный экран.
function removeYandexRows(ids){
  if(!ids || !ids.length) return Promise.resolve(0);
  return openDavayDB().then(db => new Promise((resolve, reject)=>{
    const tx = db.transaction(DAVAY_DB_STORE, 'readwrite');
    const store = tx.objectStore(DAVAY_DB_STORE);
    ids.forEach(id=>{
      const req = store.get(id);
      req.onsuccess = ()=>{ if(req.result) store.delete(id); };
    });
    tx.oncomplete = ()=> resolve(ids.length);
    tx.onerror = ()=> reject(tx.error);
  })).catch(()=> 0);
}

// Синхронизировать каталог с публичной папкой: видео из папки «Level N-M …»
// попадают в игровой уровень N (подуровень пока не используем). Повторное
// нажатие кнопки дублей не создаёт: файлы с тем же именем не добавляются
// второй раз, но их ссылки ВСЕГДА переписываются свежими. Это принципиально:
// ссылка, сохранённая вчера, к сегодняшнему дню уже недействительна, а раньше
// такие строки просто пропускались (skipped++) — кнопка рапортовала «всё уже
// загружено», а в игре был чёрный экран. Записи, которых в папках больше нет,
// удаляются (removeYandexRows) — мёртвые ссылки никогда не обновятся.
// Строка прогресса в окне синхронизации (#davaySyncProgress). Окна может не
// быть (импорт вызывают и не кнопкой) — тогда просто ничего не обновляем.
function davaySyncProgress(text){
  const el = document.getElementById('davaySyncProgress');
  if(el) el.textContent = text;
}

async function importYandexVideos(){
  if(yandexDiskLoading) return { added:0, error:'Загрузка уже идёт' };
  if(!davayYandexPublicKey()) return { added:0, error:'Ссылка на папку Яндекс Диска не задана' };
  yandexDiskLoading = true;
  try{
    davaySyncProgress('Читаем облако…');
    // Кэш путей папок уровней с прошлой синхронизации (state.yandexFolderPaths):
    // список папок меняется редко, поэтому при повторном нажатии запросы к
    // папкам уходят ОДНОВРЕМЕННО с запросом корня. Раньше папки ждали корень,
    // и два быстрых запроса по ~2 с складывались в ~4 с чистой задержки.
    const cachedPaths = Array.isArray(state.yandexFolderPaths)
      ? state.yandexFolderPaths.filter(p => typeof p === 'string' && p && p !== '/')
      : [];
    const rootPromise = fetchYandexDiskFiles('/');
    const cachedPromises = cachedPaths.map(path =>
      fetchYandexDiskFiles(path)
        .then(items => ({ path: path, items: items || [] }))
        .catch(() => ({ path: path, items: [], failed: true }))
    );
    // Каталог из базы (нужен для дедупликации по имени) читаем параллельно
    // с сетью — на ~1600 записей это тоже заметное время.
    const knownPromise = loadAllDavayBlobs();
    const rootItems = await rootPromise;
    const folders = [];
    rootItems.forEach(i=>{
      if(i.type !== 'dir') return;
      const level = yandexLevelFromFolderName(i.name);
      if(level) folders.push({ level: level, path: i.path, name: i.name });
    });
    folders.sort((a,b)=> String(a.path).localeCompare(String(b.path)));
    if(!folders.length){
      return { added:0, error:'Не найдены папки уровней «Level N-M …» (файлы в корне игнорируются)' };
    }
    // Свежий список путей — кэш для следующего раза.
    state.yandexFolderPaths = folders.map(f=>f.path);
    saveState();
    const levelByPath = new Map(folders.map(f=>[f.path, f.level]));
    let doneCount = 0;
    const bump = ()=>{
      doneCount++;
      davaySyncProgress(`Папок: ${doneCount} из ${folders.length}`);
    };
    // Папки уровней читаем ПАРАЛЛЕЛЬНО: запросы не зависят друг от друга,
    // а 19 последовательных делали синхронизацию заметно долгой.
    const realPaths = new Set(folders.map(f=>f.path));
    const folderItems = [];
    let fetchFailures = 0;
    await Promise.all(cachedPromises.map(p => p.then(r => {
      // Папка могла исчезнуть с прошлого раза (переименовали/удалили) — её
      // ответ не нужен: устаревшие записи вычистит сравнение с корнем ниже.
      // Сбой чтения — другое: такой папке нельзя «прощать» видео.
      if(r.failed) fetchFailures++;
      else if(realPaths.has(r.path)){
        folderItems.push({ folder: { level: levelByPath.get(r.path), path: r.path, name: '' }, items: r.items });
      }
      // Счётчик прогресса — только по нужным папкам: иначе устаревший путь
      // из кэша показывал бы «Папок: 20 из 19».
      if(realPaths.has(r.path)) bump();
    })));
    // Папки, которых не было в кэше (первая синхронизация или новые на Диске),
    // догоняем отдельным параллельным раундом.
    const missing = folders.filter(f => cachedPaths.indexOf(f.path) < 0);
    await Promise.all(missing.map(folder =>
      fetchYandexDiskFiles(folder.path)
        .then(items => ({ folder: folder, items: items || [] }))
        .catch(() => ({ folder: folder, items: [], failed: true }))
        .then(r => {
          if(r.failed) fetchFailures++;
          folderItems.push(r);
          bump();
        })
    ));
    const known = await knownPromise;
    const byName = new Map();
    known.forEach(r=>{ if(r.name && !byName.has(r.name)) byName.set(r.name, r); });
    const publicKey = davayYandexPublicKey();
    const now = Date.now();
    const rows = [], updates = [];
    // Пути, которые есть в папках СЕЙЧАС, — по ним отличаем устаревшие записи.
    const currentPaths = new Set();
    const seenNames = new Set();
    let skipped = 0, unplayable = 0;
    for(const { folder, items } of folderItems){
      for(const item of items){
        if(item.type !== 'file' || !YANDEX_VIDEO_RE.test(item.name || '')) continue;
        if(!isPlayableVideoItem(item)){ unplayable++; continue; }
        currentPaths.add(item.path);
        // Одно и то же имя в двух папках не должно дать дубль в каталоге.
        if(seenNames.has(item.name)) continue;
        seenNames.add(item.name);
        let href = item.file;
        if(!href){
          try{ href = await fetchYandexDiskHref(item.path); }catch(e){ continue; }
        }
        const row = byName.get(item.name);
        if(row){
          // Файл уже в каталоге — второй раз не добавляем, но ссылку, путь и
          // уровень обновляем: старая ссылка к этому моменту уже могла умереть.
          skipped++;
          updates.push({ id: row.id, url: href, urlAt: now, yandexPath: item.path,
                         publicKey: publicKey, level: folder.level });
        } else {
          rows.push({ name: item.name, url: href, level: folder.level,
                      yandexPath: item.path, publicKey: publicKey, urlAt: now });
        }
      }
    }
    if(!rows.length && !updates.length){
      return { added:0, unplayable: unplayable,
               error: fetchFailures
                 ? 'Часть папок облака не прочиталась — попробуйте ещё раз'
                 : 'В папках уровней видеофайлов нет' };
    }
    const saved = await saveYandexRows(rows, updates);
    // Устаревшие записи Диска: их пути (и имена) не встречаются в папках.
    // Свои видео игрока (blob) фильтр не трогает.
    const stale = known.filter(r =>
      r.url && !r.blob && r.yandexPath && !currentPaths.has(r.yandexPath)
      && !(r.name && seenNames.has(r.name)));
    // Удалять устаревшее можно только когда ВСЕ папки прочитались: сетевой
    // сбой на одной папке иначе выглядел бы как «папка опустела», и записи
    // (вместе с привязкой избранного по id) удалялись бы из-за случайного
    // сбоя сети. Откладываем чистку до успешной синхронизации.
    const staleRemoved = stale.length > 0 && fetchFailures === 0;
    if(staleRemoved) await removeYandexRows(stale.map(r=>r.id));
    // Каталог перечитываем, когда появились новые строки ИЛИ удалены старые —
    // только так удалённые исчезнут из игры и пула «показанных». При обновлении
    // одних лишь ссылок перечитывание не нужно: saveYandexRows обновила те же
    // объекты в памяти, что держит игра (currentDavayCard/davayHistory).
    if(rows.length > 0 || staleRemoved){
      refreshDavayCatalogInMemory();
      await ensureImportedDavayVideosLoaded();
    }
    return { added: rows.length, refreshed: updates.length,
             removed: staleRemoved ? stale.length : 0, skipped: skipped,
             unplayable: unplayable, fetchFailures: fetchFailures };
  } catch(err){
    return { added:0, error: err.message || String(err) };
  } finally {
    yandexDiskLoading = false;
  }
}

// Обновить подписанные ссылки, которым больше YANDEX_HREF_TTL. Один запрос
// списка обновляет сразу все ссылки — ради этого и храним пути. force=true
// обновляет принудительно (например, когда видео не открылось).
//
// ВАЖНО: обновлять только `importedDavayCards` недостаточно. Карточки, которые
// игра уже взяла в работу, живут ОТДЕЛЬНЫМИ объектами: `currentVideoCard` и
// `videoHistory` («Видеорулетка»), `currentDavayCard` и `davayHistory` («Давай
// попробуем»). Они хранят собственную копию поля `video`, и после обновления
// каталога там оставалась прежняя мёртвая ссылка — плеер показывал чёрный
// экран, а повторно обновить её уже не получалось: флаг `hrefRefreshed` к тому
// моменту выставлен. Поэтому ссылку переписываем и в этих объектах — по id.
//
// Переменные живут в РАЗНЫХ файлах (currentVideoCard/videoHistory — в
// fants-video.js, currentDavayCard/davayHistory — здесь), и `let` из одного
// файла не виден в другом. Поэтому каждая игра сама отдаёт свои карточки через
// хуки, которые заполняются рядом со своими переменными.
let davayCollectLiveCards = null;
let davayReplaceLiveCard = null;
function collectLiveVideoCards(){
  let out = [];
  if(typeof davayCollectLiveCards === 'function') out = out.concat(davayCollectLiveCards() || []);
  if(typeof videoCollectLiveCards === 'function') out = out.concat(videoCollectLiveCards() || []);
  return out;
}
function replaceLiveVideoCard(cardId, fresh){
  if(typeof davayReplaceLiveCard === 'function') davayReplaceLiveCard(cardId, fresh);
  if(typeof videoReplaceLiveCard === 'function') videoReplaceLiveCard(cardId, fresh);
}

function applyFreshYandexHref(cardId, href, at){
  if(typeof href !== 'string' || !href) return;
  collectLiveVideoCards().forEach(card=>{
    if(!card || String(card.id) !== String(cardId)) return;
    if(card.video === href) return; // адрес тот же — попытку не возвращаем
    card.video = href;
    card.urlAt = at;
    // Ссылка реально сменилась — даём ещё одну попытку восстановления, если и
    // новая когда-нибудь откажет. При неизменившемся адресе попытку НЕ
    // возвращаем: иначе при устойчивой ошибке (err=4) цикл «ошибка →
    // обновить → ошибка» повторялся бы бесконечно.
    card.hrefRefreshed = false;
  });
}

// ===== Диагностика видео для передачи разработчику =====
// Показывает окно ошибки (штатное, с кнопкой «Скопировать отчёт») и собирает
// понятный отчёт: размеры плеера и контейнера, состояние кадра, код ошибки
// медиа и адрес. Зелёной плашки поверх игры больше нет — она мешала играть,
// а отчёт теперь уходит в готовое окно, откуда копируется одной кнопкой.
// В журнал ошибок запись НЕ пишем: диагностику вызывают многократно, журнал
// на 20 записей забился бы ею и вытеснил настоящие исключения.
function davayVideoDiagnostics(video, card, gameName){
  const code = (video && video.error && video.error.code) || 0;
  const codeText = {
    1: 'MEDIA_ERR_ABORTED (загрузку прервали)',
    2: 'MEDIA_ERR_NETWORK (сетевая ошибка)',
    3: 'MEDIA_ERR_DECODE (файл не декодируется)',
    4: 'MEDIA_ERR_SRC_NOT_SUPPORTED (источник недоступен или формат не поддержан)'
  }[code] || (code ? String(code) : 'нет');
  const rect = (el)=>{ try{ const r = el.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); }catch(e){ return '?'; } };
  const media = document.getElementById('videoMedia') || document.getElementById('davayMedia');
  const src = (video && (video.currentSrc || video.src)) || '';
  const lines = [
    'Диагностика видео — «' + gameName + '»',
    '',
    'код ошибки: ' + codeText,
    'кадр: ' + (video ? video.videoWidth + 'x' + video.videoHeight : '?'),
    'readyState: ' + (video ? video.readyState : '?') + ', paused: ' + (video ? video.paused : '?'),
    'плеер: ' + rect(video) + ', контейнер: ' + rect(media) + ', карточка: ' + rect(document.getElementById('card')),
    'источник: ' + (card && card.source) + ', файл: ' + ((card && card.name) || (card && card.id) || '?'),
    'ссылка: ' + String(src).slice(0, 200),
    '',
    appEnvInfo()
  ];
  if(typeof showDiagnosticReport === 'function'){
    showDiagnosticReport('Видео не воспроизводится (' + codeText + ')', lines.join('\n'));
  }
}

// Обновить ссылку ОДНОГО видео. Нужна в момент, когда ролик не открылся:
// перебирать всю папку ради одного кадра бессмысленно, а один запрос к API
// отвечает быстро. true — свежий адрес получен.
//
// Путь внутри папки (yandexPath) есть не у всех записей: видео, добавленные
// ДО того, как приложение начало его сохранять, лежат в базе только с именем
// файла. Раньше такие карточки молча выпадали из восстановления (ранний
// return), и их ссылки не обновлялись никогда — ролик показывал чёрный экран
// с ошибкой 4, хотя файл на Диске рабочий. Поэтому если пути нет, ищем файл
// по имени в папках уровней (файлы в корне не рассматриваем) и запоминаем
// найденный путь.
async function refreshYandexCardHref(card){
  if(!card) return false;
  try{
    let path = card.yandexPath;
    // Ссылку можно получить либо по пути, либо (запасной вариант) по имени
    // файла: эндпоинт /download принимает путь, поэтому сначала его ищем.
    let href = null;
    if(path){
      href = await fetchYandexDiskHref(path);
    } else if(card.name){
      const files = await fetchYandexLevelFiles();
      const found = files.filter(i => i.name === card.name)[0];
      if(found){
        path = found.path;
        href = found.file || await fetchYandexDiskHref(found.path);
      }
    }
    if(!href) return false;
    const at = Date.now();
    // Адрес мог не измениться — это НЕ повод считать, что восстановить не
    // удалось: Яндекс вправе отдать ту же ссылку, и она при этом рабочая.
    if(href !== card.video){
      card.video = href;
      applyFreshYandexHref(card.id, href, at);
    }
    card.urlAt = at;
    if(path) card.yandexPath = path;
    // Строку обновляем в базе в любом случае, чтобы адрес и найденный путь
    // пережили перезагрузку страницы.
    const row = importedDavayCards.find(c => c.id === card.id);
    if(row){
      if(path) row.yandexPath = path;
      if(row.dbId){
        await updateYandexRows([{ id: row.dbId, url: href, urlAt: at, yandexPath: path }]);
      }
    }
    return true;
  }catch(err){
    return false;
  }
}

async function refreshYandexLinks(force){
  // Берём все видео с Диска из папок уровней (файлы в корне не рассматриваем).
  // Путь внутри папки есть не у всех записей: добавленные до того, как
  // приложение начало его сохранять, содержат только имя файла — такие записи
  // ниже сопоставляем с папками по имени.
  const cards = importedDavayCards.filter(c => c.source === 'yandex' && c.dbId);
  if(!cards.length) return { updated:0 };
  const need = cards.filter(c => force || !c.urlAt || Date.now() - c.urlAt > YANDEX_HREF_TTL);
  if(!need.length) return { updated:0 };
  try{
    const files = await fetchYandexLevelFiles();
    const byPath = new Map(files.map(i => [i.path, i.file]));
    const byName = new Map(files.map(i => [i.name, i]));
    const now = Date.now();
    const updates = [];
    need.forEach(c=>{
      let href = c.yandexPath ? byPath.get(c.yandexPath) : null;
      let path = c.yandexPath;
      // Пути нет — ищем файл по имени и запоминаем найденный путь.
      if(!href && c.name){
        const found = byName.get(c.name);
        if(found){ href = found.file; path = found.path; }
      }
      if(!href) return;
      if(path) c.yandexPath = path;
      // Свежая ссылка — это, по сути, другое видео для игрока (раньше оно не
      // открывалось), поэтому снимаем отметку «показано» в обеих играх: иначе
      // ролик не вернётся в пул до полного круга колоды.
      forgetDavayVideoAsShown(c.id);
      c.video = href;
      c.urlAt = now;
      // Тот же id может быть сейчас на экране или в истории — обновляем и там.
      applyFreshYandexHref(c.id, href, now);
      updates.push({ id: c.dbId, url: href, urlAt: now, yandexPath: path });
    });
    await updateYandexRows(updates);
    return { updated: updates.length };
  } catch(err){
    return { updated:0, error: err.message || String(err) };
  }
}

// Убрать отметки «это видео уже показывали» по всем играм, которые берут видео
// из общего каталога («Давай попробуем» и «Видеорулетка» — у каждой свой набор).
function forgetDavayVideoAsShown(cardId){
  if(!cardId) return;
  const stamp = function(storage){
    if(!storage || typeof storage !== 'object') return false;
    let touched = false;
    Object.keys(storage).forEach((lvl)=>{
      const list = storage[lvl];
      if(Array.isArray(list) && list.indexOf(cardId) >= 0){
        storage[lvl] = list.filter(id => id !== cardId);
        touched = true;
      }
    });
    return touched;
  };
  let touched = false;
  if(stamp(state.davayUsed)) touched = true;
  if(stamp(state.videoUsed)) touched = true;
  if(touched) saveState();
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

// Свой набор из ШЕСТИ уровней (не трогает общий LEVELS, которым пользуются
// "Фанты" и остальные игры): id 1..6, потому что имя игры на уровне нигде не
// показывается, а номер нужен только для сортировки видео в базе.
// ВАЖНО: номер уровня игрока (state.davaySelectedLevel) теперь СОВПАДАЕТ с
// номером уровня видео (card.level). До этой правки в state лежал id из
// общего LEVELS (3..6), а из него вычиталась двойка: state.davaySelectedLevel
// - 2 = уровень видео. Из-за этого «1» означала «Сближение», а кнопки в
// модалке импорта были подписаны цифрами без названий.
const DAVAY_LEVELS = [
  {id:1, name:'Ласки', desc:'Прикосновения и нежность', icon:'🤲'},
  {id:2, name:'Близость', desc:'Ближе друг к другу', icon:'💞'},
  {id:3, name:'Ртом', desc:'Оральные ласки', icon:'👄'},
  {id:4, name:'Игрушки', desc:'Секс-игрушки в деле', icon:'🧸'},
  {id:5, name:'Сзади', desc:'Еще ближе', icon:'🔄'},
  {id:6, name:'Экзотика', desc:'Необычные сценарии', icon:'💫'},
];
const DAVAY_LEVEL_IDS = DAVAY_LEVELS.map(l=>l.id);
const DAVAY_LEVEL_MIN = DAVAY_LEVEL_IDS[0];
const DAVAY_LEVEL_MAX = DAVAY_LEVEL_IDS[DAVAY_LEVEL_IDS.length - 1];
// Верхний игровой уровень «Давай попробуем» — из этого же списка. Раньше здесь
// стояла константа 4: уровни брались из общего LEVELS, и добавление шестого
// уровня в одном месте не поднимало потолок в другом — кнопка «Горячее»
// упиралась в прежний максимум.
const DAVAY_MAX_LEVEL = DAVAY_LEVEL_MAX;
function davayLevelInfo(id){
  return DAVAY_LEVELS.find(l=>l.id === id) || DAVAY_LEVELS[0];
}
// Привести номер уровня к существующему 1..6.
//
// Без этого drawDavayCard() с чужим номером не находит видео и показывает
// пустой экран «нет видео» на ровном месте.
//
// ВАЖНО, почему здесь нет пересчёта старых сейвов. Раньше уровень игрока
// хранился как id общего LEVELS (3..6), и соблазн перевести их «-2» велик —
// но отличить старый сейв от нового по этому полю НЕЛЬЗЯ: оба хранят просто
// число, и «4» одинаково означает «Разогрев» (старый формат) и «Игрушки»
// (новый). Любой пересчёт ломает одну из версий: с «-2» недостижимыми
// становились уровни 4..6 — плашка «Игрушки» мгновенно превращалась в
// «Близость», и выбрать её было невозможно.
//
// Поэтому выбран такой компромисс: значение читается как есть, а последствие
// для старого сейва мягкое — у игрока, выбравшего «Разогрев» (4), откроется
// «Игрушки». Видео при этом не теряются: они лежат по уровням, а не по
// названиям.
function normalizeDavayLevel(v){
  const n = parseInt(v, 10);
  return (isFinite(n) && n >= DAVAY_LEVEL_MIN && n <= DAVAY_LEVEL_MAX) ? n : DAVAY_LEVEL_MIN;
}
let davayLevel = 1;
// Подуровень «Горячее». Базовое состояние — 1: игра играет ролики папки
// «Level N-1 …» выбранного в «Уровнях заданий» уровня, а не все папки уровня
// вперемешку. «Горячее» шагает дальше (Level 1-2 …), «Повысить уровень»
// ведёт на следующий уровень. Сбрасывается при старте новой партии; в
// просмотре избранного не применяется.
let davaySubLevel = 1;
let currentDavayCard = null;
let davayHistory = []; // для свайпов влево/вправо между уже показанными видео
let davayHistoryPos = -1;
// Отдаём свои «живые» карточки общему коду (см. collectLiveVideoCards):
// обновление ссылок на Яндекс Диске должно переписать их все, иначе на экране
// и в истории останутся мёртвые адреса.
davayCollectLiveCards = function(){
  const out = [];
  if(currentDavayCard) out.push(currentDavayCard);
  davayHistory.forEach(c=>{ if(c && out.indexOf(c) < 0) out.push(c); });
  return out;
};
davayReplaceLiveCard = function(cardId, fresh){
  if(!fresh) return;
  const swap = function(c){ return c && String(c.id) === String(cardId) ? fresh : c; };
  if(currentDavayCard) currentDavayCard = swap(currentDavayCard);
  davayHistory = davayHistory.map(swap);
};
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
  // Без значка: в строке пилюль «Давай попробуем» значки убраны намеренно
  // («Добавить свое видео», «Обновить видеофайлы» — тоже чистый текст).
  btn.textContent = davaySoundOn ? 'Звук включён' : 'Звук выключен';
  btn.classList.toggle('on', davaySoundOn);
  btn.setAttribute('aria-label', davaySoundOn ? 'Выключить звук видео' : 'Включить звук видео');
}
function setDavaySoundOn(on){
  // Вся работа — в общем переключателе (core.js): кнопка «Звук» на настройке
  // и 🔊 в игре меняют звук сразу в обеих видео-играх.
  setSharedVideoSound(on);
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
  // Кнопку «Горячее» не блокируем на максимальном уровне: внутри уровня
  // могут быть ещё папки подуровней (Level 6-2 …), и шагать по ним можно.
  // Если идти дальше некуда — обработчик сам покажет тост.
  const btn = document.getElementById('davayLevelUpBtn');
  if(!btn) return;
  btn.disabled = false;
}
function drawDavayCard(level){
  davayLevel = level;
  updateDavayLevelBtn();
  const hidden = state.davayHidden || [];
  const liked = state.davayLiked || [];
  let all = getDavayCardsList().filter(c=>c.level===level && !hidden.includes(davayCardId(c)));
  if(state.davayFavoritesOnly){
    all = all.filter(c=>liked.includes(davayCardId(c)));
  } else if(davaySubLevel > 0){
    // Играем только папку выбранного подуровня («Level N-1 …», см. davaySubLevel).
    // Фолбэк: если роликов с таким подуровнем нет (например, все видео — свои,
    // добавленные с телефона без папки на Диске), играем весь уровень, а не
    // показываем «нет видео».
    const subOnly = all.filter(c=>davayCardSubLevel(c)===davaySubLevel);
    if(subOnly.length) all = subOnly;
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

// Оверлей «Загрузка видео…» на карточке плеера «Давай попробуем» — та же
// защита от чёрного прямоугольника, что и в «Видеорулетке» (см. комментарий
// у showVideoCardLoading в fants-video.js): пока ролик буферизует, игрок
// видит подпись, а не пустой экран. Прячем на playing.
function showDavayCardLoading(){
  const el = document.getElementById('davayLoading');
  if(el) el.style.display = '';
}
function hideDavayCardLoading(){
  const el = document.getElementById('davayLoading');
  if(el) el.style.display = 'none';
}
// См. аналогичный комментарий у setupVideoPlayerElement/renderVideoCard —
// та же логика для "Давай попробуем": пока видео открыто в нативном
// полноэкранном режиме iOS, при переключении на следующее видео меняем src у
// уже существующего элемента (reuse=true) вместо пересоздания через
// innerHTML, чтобы iOS не закрывала полный экран с видимым "миганием"
// обратно на карточку с кнопками.
function setupDavayPlayerElement(video, card, level, reuse){
  // Антихотлинк Яндекса: запрос видео с чужим доменом в Referer получает 403,
  // без Referer — 206. Ставим политику на самом элементе тоже.
  try{ video.referrerPolicy = 'no-referrer'; }catch(err){}
  // Каждый показ — новая попытка: снимаем флаг «ссылку уже обновляли», иначе
  // право на восстановление тратилось один раз за партию, и со второго отказа
  // ролик больше не чинился.
  if(card) card.hrefRefreshed = false;
  video.muted = !davaySoundOn;
  video.loop = !state.davayAutoAdvance;
    if(reuse){
    video.src = card.url || card.video;
    video.load();
  }
  // Ролик грузится — показываем «Загрузка видео…» поверх чёрного прямоугольника.
  showDavayCardLoading();
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
    // У видео с Яндекс Диска ссылка подписанная и со временем перестаёт
    // работать. Один раз пробуем получить свежую и перезапустить ролик;
    // если и это не помогло — показываем заглушку, как раньше.
    const code = (video.error && video.error.code) || 0;
    // Код 1 — прерванная загрузка (переключили ролик или ушли с экрана).
    // Это не поломка: файл рабочий, чинить нечего и пугать игрока незачем.
    if(code === 1) return;
    if(card.source === 'yandex' && !card.hrefRefreshed){
      card.hrefRefreshed = true;
      // Берём свежий адрес ИМЕННО ЭТОГО файла: один запрос вместо перебора
      // всей папки. Ссылки у Яндекса переподписываются, сохранённая начинает
      // отдавать 403, и <video> падает с ошибкой 4 (чёрный экран).
      refreshYandexCardHref(card).catch(()=>false).then(ok=>{
        if(ok && card.video){
          video.src = card.video;
          video.load();
          const p = video.play();
          if(p && typeof p.catch === 'function') p.catch(()=>{});
          return;
        }
        const media = document.getElementById('davayMedia');
        if(media) media.innerHTML = '<div class="card-icon">🎬</div>';
        // Отчёт уходит в штатное окно ошибки — оттуда копируется кнопкой.
        davayVideoDiagnostics(video, card, 'Давай попробуем');
      });
      return;
    }
    const media2 = document.getElementById('davayMedia');
    if(media2) media2.innerHTML = '<div class="card-icon">🎬</div>';
    if(card.source === 'yandex') davayVideoDiagnostics(video, card, 'Давай попробуем');
  }, {once:true});
  // Видео пошло — закрываем окно диагностики от прошлой ошибки, чтобы оно
  // не перекрывало рабочий ролик. Оверлей «Загрузка видео…» тоже прячем.
  video.addEventListener('playing', ()=>{
    if(typeof hideAppError === 'function') hideAppError();
    hideDavayCardLoading();
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
    // card-empty не ставим — его .card-inner{align-items:center} сжимал бы
    // контейнер плеера по ширине и видео получило бы нулевой размер.
    el.className = 'card';
    el.style.borderTop = '';
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-split-media" id="davayMedia">
                     <video src="${card.url || card.video}" id="davayPlayer" playsinline autoplay referrerpolicy="no-referrer"></video>
          <div class="video-loading" id="davayLoading"><span class="video-loading-icon">🎬</span><span class="video-loading-text">Загрузка видео…</span></div>
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

function davaySelectedLevel(){
  return normalizeDavayLevel(state.davaySelectedLevel);
}
function setDavaySelectedLevel(level){
  const n = normalizeDavayLevel(level);
  state.davaySelectedLevel = n;
  return n;
}

function renderDavaySetupLevels(){
  const wrap = document.getElementById('davaySetupLevels');
  if(!wrap) return;
  wrap.innerHTML = '';
  const selected = davaySelectedLevel();
  DAVAY_LEVELS.forEach(l=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + (selected === l.id ? ' on' : '');
    div.dataset.id = l.id;
    div.innerHTML = `
      <div class="lname">${l.icon} ${l.name}</div>
      <div class="ldesc">${l.desc}</div>
      <div class="level-check"></div>
    `;
    div.addEventListener('click', ()=>{
      setDavaySelectedLevel(l.id);
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
  setGameMode(null);
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
  // Кнопка «Обновить видеофайлы»: синхронизируем каталог с публичной папкой.
  // Папки «Level N-M …» раскладываются по игровым уровням 1..6 (N — номер
  // уровня, M — подуровень), файлы в корне и папки не по формату игнорируются.
  if(yandexDiskLoading){
    // Синхронизация уже идёт: окно прогресса открыто и закроется само.
    return;
  }
  if(!davayYandexPublicKey()){
    showToast('❌ Ссылка на папку Яндекс Диска не задана');
    return;
  }
  // Окно прогресса вместо тоста: тост исчезал через пару секунд, а работа шла
  // в фоне — игрок не понимал, готово ли облако, и жаловался, что «кнопки
  // плохо срабатывают». Модалка перекрывает интерфейс, крутит диск и считает
  // папки; закрывается сама по завершении (успех или ошибка — ниже).
  const syncModal = document.getElementById('davaySyncModal');
  if(syncModal) syncModal.classList.add('show');
  davaySyncProgress('Подготовка…');
  const result = await importYandexVideos();
  if(syncModal) syncModal.classList.remove('show');
  if(result.error && !result.added){
    showToast('❌ ' + result.error);
    return;
  }
  const tail = result.unplayable ? ` (.avi/.mkv пропущено: ${result.unplayable})` : '';
  const removed = result.removed ? `, удалено устаревших: ${result.removed}` : '';
  const partial = result.fetchFailures ? ' (часть папок не прочиталась — нажмите ещё раз)' : '';
  if(result.added > 0){
    showToast(`✅ Синхронизация выполнена. Новых: ${result.added}. Ссылки обновлены у ${result.refreshed} видео — уровни 1–6${removed}${tail}${partial}`);
    return;
  }
  const note = result.unplayable ? `, .avi/.mkv пропущено: ${result.unplayable}` : '';
  showToast(`✅ Синхронизация выполнена. Обновлены ссылки у ${result.refreshed || 0} видео — уровни 1–6${removed}${note}${partial}`);
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
      const resp = await fetch(url, { mode:'cors', referrerPolicy:'no-referrer' });
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
  const level = davaySelectedLevel();
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
  // «Видеорулетка» — режим внутри экрана #game и в реестре игр её нет, так что
  // goToGame() её не «прикрывает»: снимаем чужую паузу сами, иначе после
  // выхода по «←» игрок попадёт в чужое меню паузы «Фантов».
  state.pausedMode = null;
  saveState();
  if(typeof updateResumeUI === 'function') updateResumeUI();
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
// Кнопки «❤️ Избранное» на странице настройки больше нет: она открывала тот же
// просмотр, что и «❤️ Смотреть совпавшие видео» на экране итогов
// (#davaySummaryFavBtn в games/fants-timer.js), но вела туда из настройки, где
// партия ещё не начата. Просмотр избранного остался на итогах — там он уместен,
// потому что избранное появляется именно по итогам партии.

// ===== Экран настройки "Предложи партнеру" (выбор уровня) =====
// Свой набор уровней (не трогает общий LEVELS, которым пользуются "Фанты").
const PHOTO_LEVELS = [
  {id:1, name:'Простые позы', desc:'Лёгкие и классические позы', icon:'🙂'},
  {id:2, name:'Интересные позы', desc:'Больше разнообразия и вариантов', icon:'😏'},
  {id:3, name:'Сложные позы', desc:'Нужны гибкость и физподготовка', icon:'🔥'},
  {id:4, name:'В авто', desc:'Позы в машине', icon:'🚗'},
  {id:5, name:'Секс-шоп', desc:'Товары с рейтингом', icon:'🛍️'},
  {id:6, name:'Коллекция', desc:'Личная коллекция', icon:'📦'},
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
  davayLevel = davaySelectedLevel();
  state.davayUsed = {};
  state.davayHidden = [];
  davayHistory = [];
  davayHistoryPos = -1;
  davaySubLevel = 1;
  // Новая партия — всегда обычный квиз, а не режим "просмотр избранного"
  // (иначе после однажды открытого избранного игра застревала бы в нём).
  state.davayFavoritesOnly = false;
  saveState();
  document.querySelector('.row1').appendChild(document.getElementById('pauseBtn'));
  document.getElementById('davaySetup').classList.remove('active');
  document.getElementById('setup').classList.remove('active');
  document.getElementById('game').classList.add('active');
  setGameMode('davay-mode');
  document.getElementById('doneBtn').textContent = 'Следующее';
  document.getElementById('pauseBtn').textContent = 'Пауза';
  updateTurnUI();
  updateLevelUI();
  updateMuteBtn();
  requestWakeLock();
  await ensureImportedDavayVideosLoaded();
  // .catch обязателен: без него сбой запроса станет необработанным отказом
  // промиса, а тот пишется в журнал ошибок и вытесняет настоящие исключения.
  refreshYandexLinks(true).catch(()=>{}); // ссылки Яндекса живут минуты — обновляем при входе
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
  // Снимаем паузу и закрываем окно итогов: раньше pausedMode сбрасывался
  // только косвенно (внутри goToDavaySetup и лишь когда он равен 'davay'),
  // а модалка итогов оставалась висеть поверх следующего экрана.
  state.pausedMode = null;
  if(typeof hideModal === 'function') hideModal('davaySummaryModal');
  const pauseModalEl = document.getElementById('pauseMenuModal');
  if(pauseModalEl) pauseModalEl.classList.remove('show');
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
  setGameMode(null);
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
  state.lastPauseView = getCurrentSetupView();
  saveState();
  if(document.fullscreenElement) document.exitFullscreen();
  davayFullscreenActive = false;
  davayNativeFullscreenActive = false;
  const video = document.getElementById('davayPlayer');
  if(video) video.pause();
  if(typeof hideModal === 'function') hideModal('davaySummaryModal');
  document.querySelector('.row2').appendChild(document.getElementById('pauseBtn'));
  // Класс режима снимаем: иначе после паузы «Фанты» или «Предложи партнёру»
  // открывались на #game.davay-mode — с чужим оформлением, а предикаты
  // isDavayMode() уводили кнопку «Выход» и стрелку «←» не в тот режим.
  setGameMode(null);
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
  setGameMode('davay-mode');
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
  setGameMode('placeholder-mode');
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
  setGameMode('placeholder-mode');
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
  setGameMode(null);
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

