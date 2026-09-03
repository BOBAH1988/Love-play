// games/kids-flash.js — обучающая игра «Английский язык» (раздел
// «Обучающие игры»). Загружается через <script src="games/kids-flash.js">
// в index.html, данные — cards/cards_flash.js (FLASH_WORDS, theme==='english').
//
// Настройки: режим игры (обучение/повторение), объём подборки слов
// (100 или 250 слов), количество карточек за партию (5/10/25/50).
// Партия — фиксированный набор случайных карточек из подборки; после
// последней карточки партия завершается и игрок возвращается в настройки.
//
// Обучение — карточка показывает слово, транскрипцию и перевод сразу.
// Повторение — только слово, без подсказок: играющие проверяют себя сами.
// В обоих режимах кнопка автоозвучки читает только английское слово.
// Проверки правильности ответа в приложении нет — партнёры/родитель с
// ребёнком сверяются друг с другом сами.

let flashCurrentCard = null;

function getFlashPool(size){
  if(typeof FLASH_WORDS === 'undefined' || !Array.isArray(FLASH_WORDS)) return [];
  // Английский язык: size задаёт объём подборки слов.
  // "100 слов" — базовые (group<=100), "250 слов" — остальные (group>100):
  // 150 промежуточных + 100 новых = ровно 250, без пересечения с базовыми 100.
  if(size === 100) return FLASH_WORDS.filter(w => w.theme === 'english' && w.group <= 100);
  return FLASH_WORDS.filter(w => w.theme === 'english' && w.group > 100);
}

function goToFlashSetup(){
  goToGameSetup('flashSetup', null, ()=>{
    renderFlashModeGroup();
    renderFlashThemeSizeGroup();
    renderFlashCountGroup();
  });
}
function exitFlashSetup(){
  document.getElementById('flashSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('kidsView');
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
document.querySelectorAll('#flashThemeGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    playSuccessSound();
    state.flashTheme = btn.dataset.value;
    saveState();
    renderFlashThemeGroup();
  });
});

function renderFlashThemeGroup(){
  if(typeof FLASH_THEMES !== 'undefined' && Array.isArray(FLASH_THEMES) && FLASH_THEMES.length){
    if(!FLASH_THEMES.some(t => t.id === state.flashTheme)){ state.flashTheme = FLASH_THEMES[0].id; saveState(); }
  } else if(state.flashTheme !== 'english'){
    state.flashTheme = 'english'; saveState();
  }
  const group = document.getElementById('flashThemeGroup');
  if(group){
    group.querySelectorAll('.starter-btn').forEach(btn=>{
      btn.classList.toggle('on', btn.dataset.value === state.flashTheme);
    });
  }
  // Блок «объём словаря» (100/250) — только для «Английский язык».
  const sizeBlock = document.getElementById('flashEnglishSizeBlock');
  if(sizeBlock) sizeBlock.style.display = (state.flashTheme === 'english') ? '' : 'none';
}

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
  goToGame('flashSetup', 'flashGame');
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
  fadeSwapEl('flashCard', function(el){
    el.className = 'card';
    el.innerHTML = `
        <div class="card-inner">
          <div class="card-body">
            <div class="flash-word">${card.word}</div>
            ${learn ? `
              <div class="flash-transcription">[${card.transcription}]</div>
              <div class="flash-translation">${card.translation}</div>
            ` : `
              <div class="flash-transcription" id="flashTranscription" style="display:none;">[${card.transcription}]</div>
              <div class="flash-translation" id="flashTranslation" style="display:none;">${card.translation}</div>
            `}
          </div>
        </div>
        <div class="memes-tts-hint" id="flashTtsHint">🔊</div>
      `;
  }, function(){
    // onDone
    updateFlashAnswerBtn();
    if(state.autoSpeak) speakFlashWord();
  });
}
// "Ответ" — только в режиме "Повторение": транскрипция и перевод скрыты по
// умолчанию (см. drawFlashCard), кнопка открывает их для текущей карточки.
// В режиме "Обучение" ответ виден сразу, кнопка не нужна и скрыта.
function updateFlashAnswerBtn(){
  const btn = document.getElementById('flashAnswerBtn');
  if(!btn) return;
  const learn = state.flashMode === 'learn';
  btn.style.display = learn ? 'none' : '';
  btn.disabled = false;
}
function revealFlashAnswer(){
  const t = document.getElementById('flashTranscription');
  const tr = document.getElementById('flashTranslation');
  if(t) t.style.display = '';
  if(tr) tr.style.display = '';
  const btn = document.getElementById('flashAnswerBtn');
  if(btn) btn.disabled = true;
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
  stopSpeech('flashTtsHint');
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
document.getElementById('flashCard').addEventListener('click', (e)=>{
  {
    speakFlashWord();
  }
});
document.getElementById('flashAnswerBtn').addEventListener('click', ()=>{
  playSuccessSound();
  revealFlashAnswer();
});
document.getElementById('flashNextBtn').addEventListener('click', ()=>{
  playSuccessSound();
  state.flashIndex++;
  saveState();
  drawFlashCard();
});
function exitFlashGame(){
  stopFlashSpeech();
  exitGame('flashGame', 'flashSetup');
}
document.getElementById('flashSetupStartBtn').addEventListener('click', ()=>{ goToFlashGame(); });
document.getElementById('flashSetupExitBtn').addEventListener('click', ()=>{ exitFlashSetup(); });
document.getElementById('flashExitBtn').addEventListener('click', ()=>{ exitFlashGame(); });
// "Дополнительно": раскрывает/сворачивает строку с автоозвучкой, правилами и выходом.
document.getElementById('flashMoreBtn').addEventListener('click', ()=>{
  const row = document.getElementById('flashExtraRow');
  if(!row) return;
  const expanded = row.style.display !== 'none';
  row.style.display = expanded ? 'none' : '';
  const btn = document.getElementById('flashMoreBtn');
  if(btn){ btn.setAttribute('aria-expanded', String(!expanded)); }
});
(document.getElementById('flashSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ showModal('flashRulesModal'); });
openRulesModal('flashGameRulesBtn', 'flashRulesModal');
setupRulesModal('flashRulesModal', 'closeFlashRulesBtn');

