// games/kids-flash.js — игра «Флеш карты» (раздел «Игры с детьми»).
// Загружается через <script src="games/kids-flash.js"></script> в index.html,
// данные — cards/cards_flash.js (FLASH_THEMES/FLASH_WORDS).
//
// Настройки: режим игры (обучение/повторение), тема со своей подборкой слов
// (пока только «Английский язык», 100 или 250 слов), количество карточек за
// партию (5/10/25/50). Партия — это фиксированный набор случайных карточек
// из выбранной подборки; после последней карточки партия завершается и игрок
// возвращается в настройки — это не бесконечная колода, как в "Мемасиках".
//
// Обучение — карточка показывает слово, транскрипцию и перевод сразу.
// Повторение — только слово, без подсказок: играющие проверяют себя сами.
// В обоих режимах кнопка автоозвучки читает только английское слово.
// Проверки правильности ответа в приложении нет — партнёры/родитель с
// ребёнком сверяются друг с другом сами.

let flashCurrentCard = null;

function getFlashPool(size){
  if(typeof FLASH_WORDS === 'undefined' || !Array.isArray(FLASH_WORDS)) return [];
  const max = size === 250 ? 250 : 100;
  return FLASH_WORDS.filter(w => w.theme === 'english' && w.group <= max);
}

function goToFlashSetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('flashSetup').classList.add('active');
  renderFlashModeGroup();
  renderFlashThemeSizeGroup();
  renderFlashCountGroup();
}
function exitFlashSetup(){
  document.getElementById('flashSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
}

function renderFlashModeGroup(){
  if(state.flashMode !== 'learn' && state.flashMode !== 'review'){ state.flashMode = 'learn'; saveState(); }
  document.querySelectorAll('#flashModeGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', btn.dataset.value === state.flashMode);
  });
}
document.querySelectorAll('#flashModeGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    playSuccessSound();
    state.flashMode = btn.dataset.value;
    saveState();
    renderFlashModeGroup();
  });
});

function renderFlashThemeSizeGroup(){
  if(state.flashThemeSize !== 100 && state.flashThemeSize !== 250){ state.flashThemeSize = 100; saveState(); }
  document.querySelectorAll('#flashThemeSizeGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === state.flashThemeSize);
  });
}
document.querySelectorAll('#flashThemeSizeGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    playSuccessSound();
    state.flashThemeSize = parseInt(btn.dataset.value, 10);
    saveState();
    renderFlashThemeSizeGroup();
  });
});

const FLASH_COUNT_VALUES = [5, 10, 25, 50];
function renderFlashCountGroup(){
  if(!FLASH_COUNT_VALUES.includes(state.flashCount)){ state.flashCount = 25; saveState(); }
  document.querySelectorAll('#flashCountGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === state.flashCount);
  });
}
document.querySelectorAll('#flashCountGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    playSuccessSound();
    state.flashCount = parseInt(btn.dataset.value, 10);
    saveState();
    renderFlashCountGroup();
  });
});

function shuffleFlashPool(pool){
  const arr = pool.slice();
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function updateFlashProgress(){
  const el = document.getElementById('flashProgressLabel');
  if(!el) return;
  el.textContent = `Карточка ${state.flashIndex + 1} из ${state.flashQueue.length}`;
}

function goToFlashGame(){
  const pool = getFlashPool(state.flashThemeSize);
  const count = Math.min(state.flashCount, pool.length);
  state.flashQueue = shuffleFlashPool(pool).slice(0, count);
  state.flashIndex = 0;
  saveState();
  document.getElementById('flashSetup').classList.remove('active');
  document.getElementById('flashGame').classList.add('active');
  drawFlashCard();
  updateMuteBtn();
  requestWakeLock();
}

function drawFlashCard(){
  const card = state.flashQueue[state.flashIndex];
  if(!card){ finishFlashSession(); return; }
  flashCurrentCard = card;
  stopFlashSpeech();
  updateFlashProgress();
  const learn = state.flashMode === 'learn';
  fadeSwapEl('flashCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-body">
          <div class="flash-word">${card.word}</div>
          ${learn ? `
            <div class="flash-transcription">[${card.transcription}]</div>
            <div class="flash-translation">${card.translation}</div>
          ` : ''}
        </div>
      </div>
      <div class="memes-tts-hint" id="flashTtsHint">🔊</div>
    `;
  });
  updateFlashAutoSpeakBtn();
  if(state.flashAutoSpeak) speakFlashWord();
}

function finishFlashSession(){
  stopFlashSpeech();
  showToast('🎉 Карточки закончились — партия пройдена');
  exitFlashGame();
}

function pickEnglishVoice(){
  if(!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const en = voices.filter(v=>/^en/i.test(v.lang));
  return en[0] || voices[0] || null;
}
function stopFlashSpeech(){
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  const hint = document.getElementById('flashTtsHint');
  if(hint) hint.classList.remove('speaking');
}
function speakFlashWord(){
  if(!flashCurrentCard || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  const card = flashCurrentCard;
  const utter = new SpeechSynthesisUtterance(card.word);
  utter.lang = 'en-US';
  utter.rate = 0.9;
  const voice = pickEnglishVoice();
  if(voice) utter.voice = voice;
  const hint = document.getElementById('flashTtsHint');
  const fire = ()=>{
    if(flashCurrentCard !== card) return; // карточка уже сменилась — не озвучиваем устаревшее слово
    if(hint) hint.classList.add('speaking');
    utter.onend = ()=>{ if(hint) hint.classList.remove('speaking'); };
    utter.onerror = ()=>{ if(hint) hint.classList.remove('speaking'); };
    synth.speak(utter);
  };
  // speak(), вызванный сразу вслед за cancel() в тот же тик, иногда молча
  // "проглатывается" браузером — но задержка перед КАЖДЫМ speak() на
  // мобильных браузерах рвёт связь с пользовательским жестом, и озвучка
  // перестаёт работать вообще. Поэтому если движок сейчас свободен — говорим
  // сразу и синхронно; отменяем и ждём короткую паузу, только если правда
  // нужно прервать уже звучащее слово (смена карточки на лету).
  if(synth.speaking || synth.pending){
    synth.cancel();
    setTimeout(fire, 50);
  } else {
    fire();
  }
}
document.getElementById('flashCard').addEventListener('click', ()=>{
  speakFlashWord();
});
function updateFlashAutoSpeakBtn(){
  const btn = document.getElementById('flashAutoSpeakBtn');
  if(!btn) return;
  btn.classList.toggle('on', !!state.flashAutoSpeak);
}
document.getElementById('flashAutoSpeakBtn').addEventListener('click', ()=>{
  state.flashAutoSpeak = !state.flashAutoSpeak;
  saveState();
  updateFlashAutoSpeakBtn();
  playSuccessSound();
  if(state.flashAutoSpeak) speakFlashWord();
});
document.getElementById('flashNextBtn').addEventListener('click', ()=>{
  playSuccessSound();
  state.flashIndex++;
  saveState();
  drawFlashCard();
});
function exitFlashGame(){
  stopFlashSpeech();
  document.getElementById('flashGame').classList.remove('active');
  document.getElementById('flashSetup').classList.add('active');
}
document.getElementById('flashSetupStartBtn').addEventListener('click', ()=>{ goToFlashGame(); });
document.getElementById('flashSetupExitBtn').addEventListener('click', ()=>{ exitFlashSetup(); });
document.getElementById('flashExitBtn').addEventListener('click', ()=>{ exitFlashGame(); });
document.getElementById('flashSetupRulesBtn').addEventListener('click', ()=>{ document.getElementById('flashRulesModal').classList.add('show'); });
document.getElementById('flashGameRulesBtn').addEventListener('click', ()=>{ document.getElementById('flashRulesModal').classList.add('show'); });
document.getElementById('closeFlashRulesBtn').addEventListener('click', ()=>{ document.getElementById('flashRulesModal').classList.remove('show'); });
document.getElementById('flashRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'flashRulesModal') e.currentTarget.classList.remove('show'); });
