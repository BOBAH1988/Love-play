// games/ideas.js — Игра "Вопросы про это" (пары).
// Загружается через <script src="games/ideas.js"></script> в index.html.
// Основа взята с "Предложи партнеру" (games/core.js: drawPhotoCard/goToPhotoSetup),
// но без уровней и без картинок — просто текстовые карточки вопрос/ответ из
// cards/cards_sex_coach_qa.js (SEX_COACH_QA_CARDS). Имена функций/переменных/id
// остались "ideas*" по историческим причинам (раньше здесь была игра
// "Идеи для вас" — теперь она переехала внутрь "Предложи партнеру" уровнем,
// см. games/core.js), но само содержимое игры — вопросы и ответы сексологов.
// Избранное в игре удалено — она про чтение вопросов/ответов, не про подбор.

let ideasCurrentCard = null;

function getIdeasPool(){
  return (typeof SEX_COACH_QA_CARDS !== 'undefined' && Array.isArray(SEX_COACH_QA_CARDS)) ? SEX_COACH_QA_CARDS : [];
}

function drawIdeaCard(){
  stopIdeasSpeech();
  const pool = getIdeasPool();
  if(pool.length === 0){
    ideasCurrentCard = null;
    fadeSwapEl('ideasCard', (el)=>{
      el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon">💭</div><div class="card-text">Вопросы скоро появятся — добавьте их в cards_sex_coach_qa.js</div></div></div>`;
    });
    return;
  }
  if(!state.ideasUsed) state.ideasUsed = [];
  let used = state.ideasUsed.filter(t=>pool.some(c=>c.title===t));
  let candidates = pool.filter(c=>!used.includes(c.title));
  if(candidates.length === 0){
    candidates = pool;
    used = [];
    showToast('Вопросы показаны заново 🔀');
  }
  const card = candidates[Math.floor(Math.random()*candidates.length)];
  used.push(card.title);
  state.ideasUsed = used;
  saveState();
  ideasCurrentCard = card;
  fadeSwapEl('ideasCard', (el)=>{
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-body">
          <div class="card-icon">💬</div>
          <div class="card-split-title" id="ideasCardTitle">${card.title}</div>
          <div class="card-text" id="ideasCardText">${card.text}</div>
        </div>
        <div class="quiz-tts-hint" id="ideasTtsHint">🔊</div>
      </div>
    `;
  }, ()=>{
    if(state.autoSpeak) speakIdeasCard();
  });
}

function pickIdeasVoice(){
  if(!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const ru = voices.filter(v=>/^ru/i.test(v.lang));
  const pool = ru.length ? ru : voices;
  const female = pool.find(v=>/female|женск|milena|olga|katya/i.test(v.name));
  return female || pool[0] || null;
}
function stopIdeasSpeech(){
  stopSpeech('ideasTtsHint');
}
function speakIdeasCard(){
  const card = ideasCurrentCard;
  if(!card || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  const content = [card.title, card.text].join('. ');
  const text = typeof stripQuotesForSpeech === 'function' ? stripQuotesForSpeech(content) : content;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ru-RU';
  utter.rate = 0.95;
  const voice = pickIdeasVoice();
  if(voice) utter.voice = voice;
  const hint = document.getElementById('ideasTtsHint');
  const fire = ()=>{
    if(ideasCurrentCard !== card) return;
    if(hint) hint.classList.add('speaking');
    utter.onend = ()=>{ if(hint) hint.classList.remove('speaking'); };
    utter.onerror = ()=>{ if(hint) hint.classList.remove('speaking'); };
    synth.speak(utter);
  };
  if(synth.speaking || synth.pending){
    synth.cancel();
    setTimeout(fire, 50);
  } else {
    fire();
  }
}

function goToIdeasGame(){
  goToGame(null, 'ideasGame');
  drawIdeaCard();
  updateMuteBtn();
  requestWakeLock();
}
function exitIdeasGame(){
  stopIdeasSpeech();
  // Вход в игру — плитка «Вопросы про это» в разделе «Игры для пар 18+»
  // (#gameIdeasBtn, core.js). Раньше выход отправлял в companyView, то есть
  // в чужой раздел хаба.
  exitGame('ideasGame', 'setup');
  showSetupView('twoPlayerView');
}

document.getElementById('ideasCard').addEventListener('click', ()=>{
  speakIdeasCard();
});
document.getElementById('ideasNextBtn').addEventListener('click', ()=>{
  playSuccessSound();
  drawIdeaCard();
});
document.getElementById('ideasExitBtn').addEventListener('click', ()=>{ exitIdeasGame(); });
document.getElementById('ideasShareBtn').addEventListener('click', async ()=>{
  if(!ideasCurrentCard){
    playErrorSound();
    showToast('Сначала откройте карточку');
    return;
  }
  const params = new URLSearchParams();
  params.set('mode', 'ideas');
  const key = ideasCurrentCard.title || '';
  if(key) params.set('q', encodeURIComponent(key));
  const appUrl = location.origin + location.pathname + '?' + params.toString();
  const shareUrl = await shortenShareUrl(appUrl);
  // Формат как в «Видеорулетке»: ссылка — последней строкой text (файловая
  // нагрузка там тоже несёт ссылку в text). Поле url не задаём: text+url
  // склеивался Android в «двойную» ссылку, а на части устройств url в
  // EXTRA_TEXT от получателя терялся — в чате оставался голый текст.
  const shareText = '🎲 Давай играй\nВопросы про это:\n\n' + ideasCurrentCard.title + '\n' + ideasCurrentCard.text;
  const shareMsg = shareText + '\n\n' + shareUrl;
  // Пробуем Web Share API (mobile Safari/Chrome, PWA на iOS/Android)
  if(navigator.share){
    try{
      // title здесь намеренно не передаём: он уже первой строкой shareMsg.
      // Android/Telegram добавляет title к text — в чате получалось два
      // «🎲 Давай играй» подряд.
      await shareWithTimeout({ text: shareMsg });
      showToast('Спасибо, что делитесь! 💛');
      return;
    }catch(e){
      // Любая ошибка кроме отмены пользователем — идём в фолбэк
      if(e && (e.name === 'AbortError' || e.code === 20 || (e.message && /abort|cancel/i.test(e.message)))) return;
      // На macOS PWA/Safari navigator.share может существовать, но падать — игнорируем и падаем в clipboard
    }
  }
  // Фолбэк: буфер обмена (работает везде, где есть права)
  if(navigator.clipboard && navigator.clipboard.writeText){
    try{
      await navigator.clipboard.writeText(shareMsg);
      showToast('Скопировано в буфер обмена');
      return;
    }catch(e){
      // Нет прав на буфер — показываем текст в тосте
    }
  }
  // Последний фолбэк: показываем текст в тосте
  showToast(shareMsg);
});
openRulesModal('ideasGameRulesBtn', 'ideasRulesModal');
setupRulesModal('ideasRulesModal', 'closeIdeasRulesBtn');

// Вход по ссылке-входа ?mode=ideas&q=… — вызывается из init.js после
// полной инициализации. Открывает игру и ищет карточку по заголовку.
async function openIdeasFromLink(question){
  goToIdeasGame();
  if(question){
    const pool = getIdeasPool();
    const decoded = decodeURIComponent(question);
    const card = pool.find(c => c.title === decoded);
    if(card){
      ideasCurrentCard = card;
      fadeSwapEl('ideasCard', (el)=>{
        el.innerHTML = `
          <div class="card-inner">
            <div class="card-body">
              <div class="card-icon">💬</div>
              <div class="card-split-title" id="ideasCardTitle">${card.title}</div>
              <div class="card-text" id="ideasCardText">${card.text}</div>
            </div>
            <div class="quiz-tts-hint" id="ideasTtsHint">🔊</div>
          </div>
        `;
      }, ()=>{
        if(state.autoSpeak) speakIdeasCard();
      });
      return;
    }
  }
  // Если вопрос не найден — просто открываем игру с первой карточкой
  drawIdeaCard();
}


