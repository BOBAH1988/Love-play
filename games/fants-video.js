// fants-video.js — вынесено из games/core.js при разделении монолита.
//
// Зачем: core.js вырос до 6700 строк, и чтение его целиком для правки одной
// функции стоило 100+ тыс. токенов контекста. Теперь каждая тема — отдельный
// файл, и правка читает 700–1700 строк вместо 6700.
//
// Порядок подключения сохранён как в исходном core.js: функции объявляются
// в глобальной области и вызывают друг друга по имени, поэтому файлы должны
// грузиться после core.js и до init.js.

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
    card.innerHTML = `<div class="card-inner"><div class="card-icon">🎬</div><div class="card-text">Видео пока нет — добавьте их на странице «Давай попробуем» кнопкой «Добавить свое видео»</div></div>`;
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

// Потолок уровней «Видеорулетки». Раньше здесь стояло 4 — потолок не подняли,
// когда у «Давай попробуем» появились уровни 5 и 6, и кнопка уровней в
// «Видеорулетке» упиралась в несуществующий максимум. Уровней в каталоге 6.
const VIDEO_MAX_LEVEL = 6;
let videoLevel = 1;
// Подуровень «Горячее». Базовое состояние — 1: игра играет ролики папки
// «Level N-1 …» уровня из «Уровней заданий» (state.davaySelectedLevel), а не
// все папки уровня вперемешку. «Горячее» шагает дальше (Level 1-2 …),
// «Повысить уровень» ведёт на следующий уровень. В просмотре избранного
// не применяется.
let videoSubLevel = 1;
let currentVideoCard = null;
let videoHistory = []; // для свайпов влево/вправо между уже показанными видео
let videoHistoryPos = -1;
// Отдаём свои «живые» карточки общему коду (см. collectLiveVideoCards в
// fants-davay.js): при обновлении ссылок на Яндекс Диске они должны получить
// свежий адрес, иначе показанное видео останется с мёртвой ссылкой и плеер
// покажет чёрный экран.
videoCollectLiveCards = function(){
  const out = [];
  if(currentVideoCard) out.push(currentVideoCard);
  videoHistory.forEach(c=>{ if(c && out.indexOf(c) < 0) out.push(c); });
  return out;
};
videoReplaceLiveCard = function(cardId, fresh){
  if(!fresh) return;
  const swap = function(c){ return c && String(c.id) === String(cardId) ? fresh : c; };
  if(currentVideoCard) currentVideoCard = swap(currentVideoCard);
  videoHistory = videoHistory.map(swap);
};
let videoSoundOn = false;
function updateVideoMuteBtn(){
  const btn = document.getElementById('videoMuteBtn');
  if(!btn) return;
  btn.textContent = videoSoundOn ? '🔊' : '🔇';
  btn.setAttribute('aria-label', videoSoundOn ? 'Выключить звук видео' : 'Включить звук видео');
  // Подсказка называет состояние — как у 🔀/🔁 рядом в блоке «Дополнительно».
  btn.dataset.tt = videoSoundOn ? 'Звук вкл' : 'Звук выкл';
}
function setVideoSoundOn(on){
  // Вся работа — в общем переключателе (core.js): 🔊 «Видеорулетки» меняет
  // звук сразу в обеих видео-играх и подпись кнопки «Звук» на настройке.
  setSharedVideoSound(on);
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
  btn.dataset.tt = state.videoAutoAdvance ? 'Автоповтор вкл' : 'Автоповтор выкл';
}
document.getElementById('videoLoopBtn').addEventListener('click', ()=>{
  state.videoAutoAdvance = !state.videoAutoAdvance;
  saveState();
  updateVideoLoopBtn();
  const video = document.getElementById('videoPlayer');
  if(video) video.loop = !state.videoAutoAdvance;
  showToast(state.videoAutoAdvance
    ? 'Автоповтор вкл 🔁'
    : 'Автоповтор выкл');
});

function updateVideoRandomBtn(){
  const btn = document.getElementById('videoRandomBtn');
  if(!btn) return;
  btn.classList.toggle('active', !!state.videoRandomMode);
  btn.setAttribute('aria-label', state.videoRandomMode
    ? 'Выключить случайный порядок'
    : 'Включить случайный порядок');
  btn.dataset.tt = state.videoRandomMode ? 'Случайный порядок вкл' : 'Случайный порядок выкл';
}
document.getElementById('videoRandomBtn').addEventListener('click', ()=>{
  state.videoRandomMode = !state.videoRandomMode;
  saveState();
  updateVideoRandomBtn();
  showToast(state.videoRandomMode
    ? 'Случайный порядок вкл 🎲'
    : 'Случайный порядок выкл');
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
  // Кнопка ⭐ «смотреть избранное» удалена из «Видеорулетки»: логика избранного
  // остаётся только в «Давай попробуем» (сердечко 🤍 на карточке). Осталась
  // заготовка, чтобы вызовы из других мест не падали.
  const btn = document.getElementById('videoFavoritesBtn');
  if(!btn) return;
  btn.classList.toggle('active', !!state.videoFavoritesOnly);
  btn.setAttribute('aria-label', state.videoFavoritesOnly ? 'Показывать все видео' : 'Только избранное');
}
document.getElementById('videoFavoritesBtn')?.addEventListener('click', ()=>{
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

// Ссылка-вход в приложение: ?mode=video&e=…&level=… — ею делится кнопка ⤴
// (см. обработчик ниже), читает её games/init.js при загрузке.
// e — ключ видео для поиска в каталоге получателя: путь на Яндекс Диске
// (стабилен между устройствами), затем имя файла, затем id карточки
// (работает только на том же устройстве) — в этом приоритете.
function videoEntryKey(c){
  if(!c) return '';
  return c.yandexPath || c.name || videoCardId(c) || '';
}
function videoEntryPointUrl(card, level){
  const params = new URLSearchParams();
  params.set('mode', 'video');
  const key = videoEntryKey(card);
  if(key) params.set('e', String(key));
  const lvl = parseInt(level, 10);
  if(isFinite(lvl) && lvl >= 1) params.set('level', String(lvl));
  // Адрес приложения без прежних параметров и якоря — ссылка самодостаточна.
  return location.origin + location.pathname + '?' + params.toString();
}

// Поддерживает ли платформа отправку файлов (Web Share API второго уровня).
// Проверяем ДО чтения ролика: если файлы не поддержаны (например, десктопный
// браузер), незачем тянуть мегабайты видео — поделимся ссылкой.
function shareSupportsFiles(){
  if(typeof navigator.share !== 'function') return false;
  if(typeof navigator.canShare !== 'function') return false;
  try{
    // canShare принимает только настоящий File — для проверки годится пустой.
    return navigator.canShare({ files:[new File([''], 'probe.txt', { type:'text/plain' })] });
  }catch(e){
    return false;
  }
}

// Имя и тип файла для отправки: родное имя ролика, а если его нет — из адреса.
function videoShareFileName(card){
  const name = String((card && card.name) || '');
  if(name) return name;
  const fromUrl = String((card && card.video) || '').split('?')[0].split('/').pop() || '';
  return fromUrl || 'video.mp4';
}
function videoShareFileType(blob, name){
  if(blob && blob.type) return blob.type;
  if(/\.webm$/i.test(name)) return 'video/webm';
  if(/\.mov$/i.test(name)) return 'video/quicktime';
  if(/\.m4v$/i.test(name)) return 'video/x-m4v';
  return 'video/mp4';
}

// Размер ролика, который ещё можно прочитать в память и отдать в мессенджер.
// Большие файлы тянуть нельзя: blob целиком лежит в памяти вкладки, и видео на
// сотни мегабайт уронит страницу на телефоне. Такие ролики делим ссылкой.
const VIDEO_SHARE_MAX_BYTES = 100 * 1024 * 1024;

// Сам ролик как File — его и получает мессенджер (Telegram принимает файлом,
// поэтому в чате появляется видео, а не только текст). Локальное видео с
// телефона читаем по blob-адресу, облачное — по подписанной ссылке Яндекса:
// она отдаёт `Access-Control-Allow-Origin: *`, поэтому fetch из браузера не
// блокируется (проверено на реальной ссылке в облаке — ответ приходит с
// `Content-Type: video/webm` и `Access-Control-Allow-Origin: *`).
// Не удалось прочитать (ролик удалён, ссылка устарела, сеть, слишком большой
// файл) — возвращаем null, и кнопка ⤴ отправит ссылку-вход (обработчик ниже).
async function videoShareFile(card){
  if(!card || !card.video) return null;
  try{
    const resp = await fetch(card.video, { mode:'cors' });
    if(!resp || !resp.ok) return null;
    // Размер проверяем по заголовку — до вычитывания тела: иначе большой ролик
    // успеет занять память ещё до отказа от отправки.
    const declared = Number((resp.headers && resp.headers.get && resp.headers.get('content-length')) || 0);
    if(declared > VIDEO_SHARE_MAX_BYTES) return null;
    const blob = await resp.blob();
    if(!blob || !blob.size || blob.size > VIDEO_SHARE_MAX_BYTES) return null;
    const name = videoShareFileName(card);
    return new File([blob], name, { type: videoShareFileType(blob, name) });
  }catch(e){
    return null;
  }
}

// Web Share API на некоторых платформах (iOS, отдельные Android-версии)
// зависает навсегда — меню «Поделиться» не закрывается и не вызывает
// колбэк. Через 10 секунд считаем отправку неудачной и переключаемся
// на передачу ссылки (шаг 2 ниже).
function shareWithTimeout(payload, timeoutMs){
  return Promise.race([
    navigator.share(payload),
    new Promise((_, reject)=>{
      setTimeout(()=>reject(new Error('share-timeout')), timeoutMs || 10000);
    })
  ]);
}
// Проверка конкретной нагрузки перед отправкой: помимо поддержки файлов у
// платформ бывают свои ограничения (размер, набор полей). canShare отвечает
// на тот же вопрос, что и share, но без открытия меню — поэтому спрашиваем
// именно у платформы, а не угадываем.
function canShareData(data){
  if(typeof navigator.canShare !== 'function') return false;
  try{
    return !!navigator.canShare(data);
  }catch(e){
    return false;
  }
}

// Сокращаем ссылку-вход через clck.ru — yandexPath в параметре ?e= может
// занимать 70+ символов (особенно с кириллицей), а в Telegram ссылка должна
// быть короткой. Если сокращение не удалось (CORS, сеть, лимит) — возвращаем
// оригинал: шеринг всё равно работает, просто длиннее.
async function shortenShareUrl(url){
  // Без таймаута зависший clck.ru держал кнопку «Поделиться» без отклика
  // десятки секунд (на телефоне шторка ОС открывалась уже после потери user
  // activation — «5 секунд тишины, потом бесконечная подготовка»).
  // AbortController + 2.5с: не успел — отдаём оригинальную ссылку.
  try{
    const ctrl = new AbortController();
    const tm = setTimeout(()=>ctrl.abort(), 2500);
    const resp = await fetch('https://clck.ru/--?url=' + encodeURIComponent(url), {
      method: 'GET',
      referrerPolicy: 'no-referrer',
      signal: ctrl.signal
    });
    clearTimeout(tm);
    if(resp.ok){
      const text = await resp.text();
      const short = text.trim();
      if(short && short.startsWith('http') && short.length < url.length) return short;
    }
  }catch(e){}
  return url;
}

// Кнопка ⤴ «Поделиться видео» — стандартное системное меню «Поделиться»
// (Web Share API, как в Telegram), на десктопе — фолбэк: копирование ссылки
// в буфер обмена. К сообщению прикладывается САМ ролик (navigator.share с
// files), а ссылка-вход на игру уходит подписью: получатель видит видео прямо
// в чате и может открыть игру на том же ролике.
// Раньше отправлялась только ссылка-вход (?mode=video&e=…&level=…), и в
// мессенджер приходил один текст: страница приложения — статический сайт, в
// превью ссылки видео отдать нечем (og:video требует серверной подстановки).
// Ссылка сокращается через clck.ru перед отправкой (shortenShareUrl).
document.getElementById('videoShareBtn').addEventListener('click', async ()=>{
  if(!currentVideoCard || !currentVideoCard.video){
    playErrorSound();
    showToast('Сначала откройте видео');
    return;
  }
  // Ссылка-вход ведёт в приложение (?mode=video&e=…&level=…), а не на файл:
  // по ней у получателя откроется «Видеорулетка» — с этого же ролика, если
  // видео есть в его каталоге, иначе с этого же уровня.
  const appUrl = videoEntryPointUrl(currentVideoCard, videoLevel);
  const shareUrl = await shortenShareUrl(appUrl);
  const shareText = 'Смотри, какое видео выпало в «Видеорулетке» 😉\n' + shareUrl;
  // 1) Прикладываем сам ролик. Ссылки на видео Яндекса отдают CORS-разрешение,
  //    поэтому файл читается прямо в браузере.
  if(shareSupportsFiles()){
    showToast('Готовим видео…');
    const file = await videoShareFile(currentVideoCard);
    if(file){
      // Ссылку кладём в text, а не в url: спецификация Web Share запрещает
      // files вместе с url (иначе TypeError), а files + text — разрешает.
      // Если платформа подпись с файлом не принимает, отправляем файл без неё:
      // видео в чате важнее подписи.
      const withText = { files:[file], text: shareText, title:'🎲 Давай попробуем' };
      const fileOnly = { files:[file], title:'🎲 Давай попробуем' };
      const payload = canShareData(withText) ? withText : (canShareData(fileOnly) ? fileOnly : null);
      if(payload){
        try{
          await shareWithTimeout(payload);
          showToast('Спасибо, что делитесь! 💛');
          return;
        }catch(e){
          // Игрок закрыл системное меню — не ошибка и не повод слать ссылку.
          // На iOS/Android имя ошибки может отличаться от 'AbortError',
          // поэтому проверяем по содержимому сообщения и коду.
          if(e && (e.name === 'AbortError' || e.code === 20 || (e.message && /abort|cancel/i.test(e.message)))) return;
          // Платформа отказала уже на отправке — ниже уйдёт ссылка.
        }
      }
    }
  }
  // 2) Файл приложить нельзя (нет поддержки, ролик не прочитался, слишком
  //    большой) — делимся ссылкой-входом: получатель откроет «Видеорулетку»
  //    на том же ролике.
  try{
    if(navigator.share){
      await shareWithTimeout({
        title: '🎲 Давай попробуем',
        text: 'Смотри, какое видео выпало в «Видеорулетке» 😉',
        url: shareUrl
      });
      showToast('Спасибо, что делитесь! 💛');
      return;
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(shareUrl);
      showToast('Ссылка скопирована');
      return;
    }
    showToast('Ссылка: ' + shareUrl);
  }catch(e){
    // Пользователь закрыл системное меню — не ошибка.
    // На iOS/Android имя ошибки может отличаться от 'AbortError'.
    if(e && (e.name === 'AbortError' || e.code === 20 || (e.message && /abort|cancel/i.test(e.message)))) return;
    showToast('Не удалось поделиться — попробуйте позже');
  }
});


// Подгоняет ширину/aspect-ratio карточки под текущее видео и доступную
// область (.card-area). Высота карточки всегда занимает всё доступное
// место; ширину сужаем только если видео "уже" области (портретное) — для
// широких видео ширина остаётся на весь экран, чтобы высота не уменьшилась.
// Вызывается и при загрузке видео, и при повороте экрана (см. ниже), чтобы
// уже открытое видео корректно перестраивалось под новую ориентацию.
// Подогнать карточку с видео под доступную область.
// ВАЖНО: карточка растянута по высоте через flex:1 и обрезает содержимое
// (overflow:hidden). Раньше здесь выставлялись width:auto + aspect-ratio от
// размеров видео — при этом высота карточки получалась от ширины и могла
// превысить доступную, а видео выдавливалось за нижнюю границу: игрок видел
// чёрный прямоугольник карточки. Теперь ширину сужаем под портретное видео,
// но так, чтобы высота при этом соотношении сторон точно помещалась.
function fitCardVideoToArea(video, el){
  if(!video || !el || !(video.videoWidth && video.videoHeight)) return;
  const area = document.querySelector('.card-area');
  const availW = area ? area.clientWidth : window.innerWidth;
  const availH = area ? area.clientHeight : window.innerHeight;
  const videoRatio = video.videoWidth / video.videoHeight;
  const areaRatio = availW / (availH || 1);
  el.style.aspectRatio = '';
  el.style.maxHeight = '100%';
  if(videoRatio <= areaRatio){
    // Видео «уже» области: ширина, при которой высота ещё укладывается,
    // равна availH * videoRatio.
    const fitW = Math.round(Math.min(availW, (availH || availW) * videoRatio));
    el.style.width = fitW > 0 ? (fitW + 'px') : '100%';
  } else {
    el.style.width = '100%';
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
  // Кнопку «Горячее» не блокируем на максимальном уровне: внутри уровня
  // могут быть ещё папки подуровней (Level 6-2 …), и шагать по ним можно.
  // Если идти дальше некуда — обработчик сам покажет тост.
  // 🔥 в строке ответов и 🔥 в блоке «Дополнительно» делают одно и то же
  // (общий обработчик videoHotAction), поэтому и состояние у них общее —
  // разойтись оно не должно.
  const btn = document.getElementById('videoLevelUpBtn');
  if(btn) btn.disabled = false;
  const quickBtn = document.getElementById('videoHotBtn');
  if(quickBtn) quickBtn.disabled = false;
}
function drawVideoCard(level, announceEmpty){
  videoLevel = level;
  updateVideoLevelBtn();
  const hidden = state.videoHidden || [];
  const liked = state.videoLiked || [];
  // Видео берутся из общего каталога "Давай попробуем" — своей отдельной
  // колоды у "Видеорулетки" больше нет.
  let all = getDavayCardsList().filter(c=>c.level===level && !hidden.includes(videoCardId(c)));
  if(state.videoRandomMode){
    all = getDavayCardsList().filter(c=>!hidden.includes(videoCardId(c)));
  }
  if(state.videoFavoritesOnly){
    all = all.filter(c=>liked.includes(videoCardId(c)));
  } else if(videoSubLevel > 0 && !state.videoRandomMode){
    // Играем только папку выбранного подуровня («Level N-1 …», см. videoSubLevel).
    // Фолбэк: если роликов с таким подуровнем нет (например, все видео — свои,
    // добавленные с телефона без папки на Диске), играем весь уровень, а не
    // показываем «нет видео»/демо.
    const subOnly = all.filter(c=>davayCardSubLevel(c)===videoSubLevel);
    if(subOnly.length) all = subOnly;
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
  // Битые ролики (те, что уже не открылись) из выбора исключаем — иначе игра
  // будет натыкаться на них снова и снова. Если после исключения не осталось
  // ничего, метки снимаем: ссылки могли обновиться и видео ожило. Демо при
  // этом НЕ включаем — оно только для случая «своих видео нет вовсе».
  let selectable = all.filter(c => !isVideoBroken(c));
  if(selectable.length === 0){
    all.forEach(c => brokenVideoIds.delete(String(c.id)));
    selectable = all;
  }
  if(!state.videoUsed) state.videoUsed = {};
  const usedKey = state.videoRandomMode ? '*' : String(level);
  let used = state.videoUsed[usedKey] || [];
  let pool = selectable.filter(c=>!used.includes(videoCardId(c)));
  if(pool.length===0){
    pool = selectable;
    used = [];
    showToast(state.videoRandomMode ? 'Видео показаны заново 🔀' : 'Видео этого уровня показаны заново 🔀');
  }
  const card = pool[Math.floor(Math.random()*pool.length)];
  used.push(videoCardId(card));
  state.videoUsed[usedKey] = used;
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

// Показать заглушку, когда своё видео действительно не проигрывается.
//
// ВАЖНО про демо-ролик: он включается ТОЛЬКО когда своих видео нет вообще
// (см. playFallbackVideoCard из drawVideoCard). Если видео добавлены, но
// конкретный файл не открылся, демо показывать нельзя — иначе демо мелькает
// через каждый ролик и игрок думает, что игра сломана. В этом случае берём
// следующее СВОЁ видео, а битое запоминаем, чтобы не наткнуться на него
// снова и не зациклиться, когда не открывается всё подряд.
const BROKEN_VIDEO_TTL = 10 * 60 * 1000; // мс: сколько помним «битый» ролик
let brokenVideoIds = new Map(); // id карточки -> время, когда признали битой

function markVideoBroken(card){
  if(!card || !card.id) return;
  brokenVideoIds.set(String(card.id), Date.now());
}
function isVideoBroken(card){
  if(!card || !card.id) return false;
  const at = brokenVideoIds.get(String(card.id));
  if(!at) return false;
  if(Date.now() - at > BROKEN_VIDEO_TTL){ brokenVideoIds.delete(String(card.id)); return false; }
  return true;
}
function forgetBrokenVideos(){
  brokenVideoIds = new Map();
}

// Показать следующее СВОЁ видео того же уровня, пропуская признанные битыми.
// Возвращает true, если получилось (тогда демо не нужно).
function playNextOwnVideo(level){
  const hidden = state.videoHidden || [];
  const broken = [];
  const all = getDavayCardsList().filter(c => c.level === level && !hidden.includes(videoCardId(c)));
  all.forEach(c=>{ if(isVideoBroken(c)) broken.push(c); });
  const usable = all.filter(c => !isVideoBroken(c));
  // Ничего, кроме битых, не осталось — снимаем с них метку: пусть игра
  // попробует ещё раз (ссылки Яндекса обновляются и могли ожить), иначе
  // игрок упёрся бы в тупик.
  if(usable.length === 0 && broken.length > 0){
    broken.forEach(c => brokenVideoIds.delete(String(c.id)));
    if(all.length === 0) return false;
  } else if(usable.length === 0){
    return false;
  }
  drawVideoCard(level, false);
  return true;
}

function showVideoErrorFallback(card, level, errorCode){
  // Своё видео не открылось — запоминаем его как битое и показываем другое
  // СВОЁ. Демо-ролик здесь намеренно не используется: он остаётся только для
  // случая «своих видео нет вовсе».
  //
  // Метку «битое» ставим НЕ на любую ошибку. Код 1 (MEDIA_ERR_ABORTED) —
  // это прерванная загрузка: так бывает при быстром переключении роликов,
  // когда браузер не успел докачать предыдущий, и при уходе с экрана. Файл
  // при этом полностью рабочий, и помечать его битым нельзя — иначе рабочие
  // видео с Диска постепенно выпадали бы из игры. Реальная недоступность
  // источника — это код 4 (MEDIA_ERR_SRC_NOT_SUPPORTED); его и считаем
  // признаком проблемы (код 2 — сеть, код 3 — не декодируется).
  const realFailure = (errorCode === 0 || errorCode === 2 || errorCode === 3 || errorCode === 4);
  if(realFailure) markVideoBroken(card);
  const hasOwn = getDavayCardsList().some(c=>c.level===level);
  if(hasOwn && typeof drawVideoCard === 'function'){
    // Если после исключения битых своих видео не осталось — playNextOwnVideo
    // сам снимет метки и попробует ещё раз.
    renderVideoPlaceholderCard();
    setTimeout(()=>{ playNextOwnVideo(level); }, 0);
    return;
  }
  const media = document.getElementById('videoMedia');
  if(media){
    // Внутри media лежит сам <video>: перезапись innerHTML оторвала бы его от
    // DOM играющим (см. stopCardVideos в core.js) — сначала останавливаем.
    stopCardVideos();
    media.innerHTML = '<div class="card-icon">🎬</div>';
  }
}

// Оверлей «Загрузка видео…» на карточке плеера. Первый старт ролика — самый
// долгий (браузер открывает новое соединение с CDN Яндекса и качает первые
// байты), и без подписи игрок видел только чёрный прямоугольник, пока <video>
// буферизует, — и мог выйти, решив что приложение сломано. Оверлей показываем
// при каждой смене ролика и прячем, как только плеер реально пошёл (playing).
function showVideoCardLoading(){
  const el = document.getElementById('videoLoading');
  if(el) el.style.display = '';
}
function hideVideoCardLoading(){
  const el = document.getElementById('videoLoading');
  if(el) el.style.display = 'none';
}
// Общая настройка <video> для "Видеорулетки" — вынесена отдельно от
// renderVideoCard, чтобы можно было применить её и к УЖЕ существующему
// элементу (reuse=true), а не только к только что вставленному через
// innerHTML (reuse=false). См. причину в renderVideoCard ниже.
function setupVideoPlayerElement(video, card, level, reuse){
  // Антихотлинк Яндекса: запрос видео с чужим доменом в Referer получает 403,
  // без Referer — 206. Ставим политику и на элементе тоже (не только в теге и
  // <meta>): элемент может быть переиспользован, а свойство надёжнее атрибута.
  try{ video.referrerPolicy = 'no-referrer'; }catch(err){}
  // Каждый показ ролика — новая попытка. Флаг «ссылку уже обновляли» снимаем:
  // карточка живёт в каталоге и в истории, поэтому без сброса право на
  // восстановление ссылки тратилось один раз за всю партию, и со второго
  // отказа ролик уже не чинился — он молча пропускался как «битый».
  if(card) card.hrefRefreshed = false;
  video.muted = !videoSoundOn;
  video.loop = !state.videoAutoAdvance;
  if(reuse){
    // Меняем src у уже существующего элемента вместо пересоздания — именно
    // это позволяет iOS не закрывать нативный полноэкранный плеер.
    video.src = card.video;
    video.load();
  }
  // Ролик грузится — показываем «Загрузка видео…» поверх чёрного прямоугольника.
  showVideoCardLoading();
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
    // Своё видео с Яндекс Диска живёт по ссылке, которую Яндекс переподписывает:
    // сохранённый адрес начинает отдавать 403, и <video> падает с ошибкой 4
    // (MEDIA_ERR_SRC_NOT_SUPPORTED) — игрок видит чёрный экран. Берём свежий
    // адрес ИМЕННО ЭТОГО файла (один запрос вместо перебора всей папки) и
    // перезапускаем ролик.
    const code = (video.error && video.error.code) || 0;
    // Прерванная загрузка (код 1) — НЕ повод что-то чинить: так браузер
    // сообщает, что не стал докачивать ролик, который уже не показывается
    // (быстрое переключение или уход с экрана). Файл рабочий, ссылку
    // обновлять не нужно, и помечать его битым тем более.
    if(code === 1) return;
    if(card.source === 'yandex' && !card.hrefRefreshed && typeof refreshYandexCardHref === 'function'){
      card.hrefRefreshed = true;
      refreshYandexCardHref(card).catch(()=>false).then(ok=>{
        if(ok && card.video && !videoNativeFullscreenActive){
          video.src = card.video;
          video.load();
          const p = video.play();
          if(p && typeof p.catch === 'function') p.catch(()=>{});
          return;
        }
        // Ссылку обновить не удалось — вот теперь показываем другое видео
        // (showVideoErrorFallback пометит это битым, только если отказ
        // настоящий, а не прерванная загрузка).
        showVideoErrorFallback(card, level, code);
        // Отчёт в штатном окне ошибки: оттуда он копируется кнопкой.
        if(typeof davayVideoDiagnostics === 'function'){
          davayVideoDiagnostics(video, card, 'Видеорулетка');
        }
      });
      return;
    }
    // Повторная ошибка того же ролика либо локальный файл.
    showVideoErrorFallback(card, level, code);
    if(card.source === 'yandex' && typeof davayVideoDiagnostics === 'function'){
      davayVideoDiagnostics(video, card, 'Видеорулетка');
    }
  }, {once:true});
  // Видео пошло — окно диагностики (если было открыто после прошлой ошибки)
  // закрываем сами: игрок уже видит рабочий ролик, отчёт ему больше не нужен
  // и только перекрывал бы картинку. Оверлей «Загрузка видео…» тоже прячем.
  video.addEventListener('playing', ()=>{
    if(typeof hideAppError === 'function') hideAppError();
    hideVideoCardLoading();
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
    updateVideoRandomBtn();
    updateVideoFavoritesBtn();
    updateFavoriteBtn();
    return;
  }
  fadeSwapCard((el)=>{
    // Класс card-empty здесь НЕ ставим: он для пустых карточек-заглушек, а
    // его правило .card-inner{align-items:center} сжимало контейнер плеера
    // по ширине (видео лежит position:absolute и содержимого не даёт) —
    // видео получало нулевой размер, и был виден только чёрный фон карточки.
    el.className = 'card';
    el.style.borderTop = '';
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-split-media" id="videoMedia">
          <video src="${card.video}" id="videoPlayer" playsinline autoplay preload="auto" referrerpolicy="no-referrer" fetchpriority="high"></video>
          <div class="video-loading" id="videoLoading"><span class="video-loading-icon">🎬</span><span class="video-loading-text">Загрузка видео…</span></div>
        </div>
      </div>
    `;
    const video = document.getElementById('videoPlayer');
    if(video) setupVideoPlayerElement(video, card, level, false);
    updateVideoMuteBtn();
    updateVideoLoopBtn();
    updateVideoRandomBtn();
    updateVideoFavoritesBtn();
  });
  updateFavoriteBtn();
}

async function goToVideoGame(entry){
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
  // Стартуем с уровня, выбранного в «Уровнях заданий» страницы «Давай
  // попробуем» (тот же, что и у самой игры), а не с первого по умолчанию —
  // раньше видеорулетка всегда начинала с уровня 1, и выбранное в настройках
  // игнорировалось.
  videoLevel = davaySelectedLevel();
  // Ссылка-вход может нести свой уровень (?level=): он приоритетнее выбранного
  // в «Уровнях заданий», но только для этого запуска — state.davaySelectedLevel
  // не переписываем, настройки игрока остаются как были.
  if(entry){
    const lvl = parseInt(entry.level, 10);
    if(isFinite(lvl) && lvl >= 1 && lvl <= VIDEO_MAX_LEVEL) videoLevel = lvl;
  }
  videoSubLevel = 1;
  state.videoUsed = {};
  state.videoHidden = [];
  // Новая партия — начинаем с чистого листа: список «битых» роликов сбрасываем,
  // чтобы игра попробовала все свои видео заново (ссылки Яндекса могли
  // обновиться, и то, что не открылось в прошлый раз, теперь работает).
  forgetBrokenVideos();
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
  setGameMode('video-mode');
  document.getElementById('doneBtn').textContent = 'Следующее';
  document.getElementById('pauseBtn').textContent = 'Выход';
  updateTurnUI();
  updateLevelUI();
  updateMuteBtn();
  updateVideoFavoritesBtn();
  updateVideoRandomBtn();
  requestWakeLock();
  // Каталог видео загружаем не блокируя запуск: если уже в памяти —
  // карточка рисуется сразу, иначе — рисуемся после загрузки.
  // Первый ролик (и все последующие при быстром переходе) не ждёт
  // чтения IndexedDB, пока каталог уже был загруж ранее.
  const tryDraw = () => {
    const entryCard = entry && entry.key ? findVideoCardByEntryKey(entry.key) : null;
    if(entryCard){
      showVideoCardDirect(entryCard);
    } else {
      drawVideoCard(videoLevel);
    }
    refreshYandexLinks(true).catch(()=>{});
  };
  if(importedDavayVideosLoaded){
    tryDraw();
  } else {
    ensureImportedDavayVideosLoaded().then(tryDraw);
  }
}

// Поиск карточки каталога по ключу из ссылки-входа (videoEntryKey): ключ
// сравнивается с каждым полем по отдельности — у получателя запись может нести
// те же данные под другим приоритетом (путь на Диске появился после
// синхронизации, а у отправителя была только имя файла).
function findVideoCardByEntryKey(key){
  if(!key) return null;
  const k = String(key);
  return getDavayCardsList().find(c =>
    String(c.yandexPath || '') === k ||
    String(c.name || '') === k ||
    String(videoCardId(c) || '') === k
  ) || null;
}
// Показать конкретное видео каталога вместо случайного первого показа —
// используется только входом по ссылке (см. goToVideoGame(entry)). Повторяет
// хвост drawVideoCard: уровень/подуровень карточки, отметка «показано»
// (чтобы «Следующее» не вернуло тот же ролик сразу), история для свайпов.
function showVideoCardDirect(card){
  videoLevel = card.level;
  const sub = davayCardSubLevel(card);
  videoSubLevel = sub > 0 ? sub : 1;
  updateVideoLevelBtn();
  if(!state.videoUsed) state.videoUsed = {};
  const usedKey = state.videoRandomMode ? '*' : String(videoLevel);
  const used = state.videoUsed[usedKey] || [];
  if(!used.includes(videoCardId(card))) used.push(videoCardId(card));
  state.videoUsed[usedKey] = used;
  currentVideoCard = card;
  saveState();
  videoHistory.push(card);
  videoHistoryPos = videoHistory.length - 1;
  renderVideoCard(card, videoLevel);
}
// Вход по ссылке-входа ?mode=video&e=…&level=… — вызывается из init.js после
// полной инициализации. Протокол повторяет кнопку «🎥 Видеорулетка»
// (davaySetupVideoBtn): снять чужую паузу, снять флаги, открыть игру.
async function openVideoFromLink(entry){
  if(blockedByDavayPause()) return;
  state.pausedMode = null;
  saveState();
  if(typeof updateResumeUI === 'function') updateResumeUI();
  await goToVideoGame(entry);
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
  videoLevel = pickVideoFavoritesStartLevel();
  videoSubLevel = 1;
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
  setGameMode('video-mode');
  document.getElementById('doneBtn').textContent = 'Следующее';
  document.getElementById('pauseBtn').textContent = 'Выход';
  updateTurnUI();
  updateLevelUI();
  updateMuteBtn();
  updateVideoFavoritesBtn();
  requestWakeLock();
  // Не блокируем запуск на чтении каталога — рисуем карточку
  // сразу или после загрузки (если ранее не была загружена).
  const tryDraw = () => drawVideoCard(videoLevel);
  if(importedDavayVideosLoaded){
    tryDraw();
  } else {
    ensureImportedDavayVideosLoaded().then(tryDraw);
  }
}

function exitVideoGame(){
  state.inProgress = false;
  // Снимаем «чужую» паузу. Без этого при выходе из видеорежима стрелкой «←»
  // игрок попадал в меню паузы «Фантов»: видео — режим внутри базовой парной
  // игры (#game), и её pausedMode оставался выставленным.
  if(typeof abandonPausedSession === 'function') abandonPausedSession('fanty');
  if(state.pausedMode) state.pausedMode = null;
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
  setGameMode(null);
  document.getElementById('doneBtn').textContent = '💕 Готово';
  document.getElementById('pauseBtn').textContent = 'Пауза';
  // «Видеорулетка» запускается кнопкой со страницы настройки «Давай попробуем»
  // и делит с ней один каталог видео, поэтому выход — на шаг назад, в это же
  // меню настройки (#davaySetup), а не в список «Игры для пар 18+». Раньше тут
  // открывался общий #setup (хаб пар), и выход «перепрыгивал» через уровень,
  // из которого игру запустили.
  // Экран настроек включаем сами: goToDavaySetup() заодно сбрасывает
  // выбранные уровни и прокрутку — для обычного выхода это лишнее.
  releaseWakeLockNow();
  document.querySelectorAll('.screen.active').forEach(s=>s.classList.remove('active'));
  const davaySetup = document.getElementById('davaySetup');
  if(davaySetup) davaySetup.classList.add('active');
  if(typeof updateDavaySetupStarterLabels === 'function') updateDavaySetupStarterLabels();
  updateDavaySetupSoundBtn();
  updateMuteBtn();
  updateDavayFavoritesBtn();
  updateResumeUI();
  window.scrollTo(0, 0);
}

function isVideoMode(){
  const el = document.getElementById('game');
  return !!(el && el.classList.contains('video-mode'));
}

