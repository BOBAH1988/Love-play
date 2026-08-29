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
  if(state.flashTheme === 'time'){
    // Тема «Время» делится на подразделы: механические / цифровые часы.
    return FLASH_WORDS.filter(w => w.theme === 'time' && w.sub === state.flashTimeSub);
  }
  if(state.flashTheme !== 'english'){
    // Тематические наборы (Животные, Глаголы и др.) — берём все карточки темы.
    return FLASH_WORDS.filter(w => w.theme === state.flashTheme);
  }
  // Английский язык: size задаёт объём подборки слов.
  // "100 слов" — базовые (group<=100), "250 слов" — остальные (group>100):
  // 150 промежуточных + 100 новых = ровно 250, без пересечения с базовыми 100.
  if(size === 100) return FLASH_WORDS.filter(w => w.theme === 'english' && w.group <= 100);
  return FLASH_WORDS.filter(w => w.theme === 'english' && w.group > 100);
}

function goToFlashSetup(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('flashSetup').classList.add('active');
  renderFlashModeGroup();
  renderFlashThemeGroup();
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
   // Подпись блока темы — постоянный заголовок "Темы" (без скобок,
   // без динамического имени темы — согласно ТЗ).
   const label = document.getElementById('flashThemeLabel');
   if(label){ label.textContent = 'Темы'; }
  // Блок «объём словаря» (100/250) — только для «Английский язык»;
  // блок подразделов «Механические/Цифровые» — только для «Время».
  const sizeBlock = document.getElementById('flashEnglishSizeBlock');
  if(sizeBlock) sizeBlock.style.display = (state.flashTheme === 'english') ? '' : 'none';
  const timeBlock = document.getElementById('flashTimeSubBlock');
  if(timeBlock) timeBlock.style.display = (state.flashTheme === 'time') ? '' : 'none';
  if(state.flashTheme === 'time') renderFlashTimeSubGroup();
}
document.querySelectorAll('#flashThemeGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    playSuccessSound();
    state.flashTheme = btn.dataset.value;
    saveState();
    renderFlashThemeGroup();
  });
});

function renderFlashTimeSubGroup(){
  if(state.flashTimeSub !== 'mech' && state.flashTimeSub !== 'digital'){ state.flashTimeSub = 'digital'; saveState(); }
  const group = document.getElementById('flashTimeSubGroup');
  if(group){
    group.querySelectorAll('.starter-btn').forEach(btn=>{
      btn.classList.toggle('on', btn.dataset.value === state.flashTimeSub);
    });
  }
}
document.querySelectorAll('#flashTimeSubGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    playSuccessSound();
    state.flashTimeSub = btn.dataset.value;
    saveState();
    renderFlashTimeSubGroup();
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

function isFlashTimeCard(card){
  return card && card.theme === 'time';
}
function drawFlashCard(){
  const card = state.flashQueue[state.flashIndex];
  if(!card){ finishFlashSession(); return; }
  flashCurrentCard = card;
  stopFlashSpeech();
  updateFlashProgress();
  const learn = state.flashMode === 'learn';
  const isTime = isFlashTimeCard(card) && Array.isArray(card.options);
  fadeSwapEl('flashCard', (el)=>{
    el.className = 'card';
    if(isTime){
      const options = card.options || [];
      const correctIdx = (typeof card.answer === 'number') ? card.answer : -1;
      const optsHtml = options.map((opt, i)=>{
        return `<button type="button" class="flash-time-option" data-time-idx="${i}" data-time-correct="${i === correctIdx}">${opt}</button>`;
      }).join('');
      el.innerHTML = `
        <div class="card-inner">
          <div class="card-body">
            <div class="flash-word">${card.word}</div>
            <div class="flash-time-options">
              ${optsHtml}
            </div>
          </div>
        </div>
        <div class="memes-tts-hint" id="flashTtsHint" style="display:none;">🔊</div>
      `;
    } else {
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
    }
  }, ()=>{
    // onDone
    updateFlashAutoSpeakBtn();
    updateFlashAnswerBtn();
    updateFlashTimeOptionsState();
    if(state.flashAutoSpeak && !isTime) speakFlashWord();
  });
}
// "Ответ" — только в режиме "Повторение": транскрипция и перевод скрыты по
// умолчанию (см. drawFlashCard), кнопка открывает их для текущей карточки.
// В режиме "Обучение" ответ виден сразу, кнопка не нужна и скрыта.
function updateFlashAnswerBtn(){
  const btn = document.getElementById('flashAnswerBtn');
  if(!btn) return;
  const learn = state.flashMode === 'learn';
  const isTime = isFlashTimeCard(flashCurrentCard);
  btn.style.display = (learn && !isTime) ? 'none' : '';
  btn.disabled = false;
}
function revealFlashAnswer(){
  const t = document.getElementById('flashTranscription');
  const tr = document.getElementById('flashTranslation');
  if(t) t.style.display = '';
  if(tr) tr.style.display = '';
  const btn = document.getElementById('flashAnswerBtn');
  if(btn) btn.disabled = true;
  revealFlashTimeCorrect();
}
function revealFlashTimeCorrect(){
  const wrap = document.getElementById('flashCard');
  if(!wrap) return;
  wrap.querySelectorAll('[data-time-correct="true"]').forEach(el=>{
    el.classList.add('correct');
    el.classList.add('revealed');
  });
}
function updateFlashTimeOptionsState(){
  const card = flashCurrentCard;
  if(!card || !isFlashTimeCard(card)) return;
  const wrap = document.getElementById('flashCard');
  if(!wrap) return;
  const btns = wrap.querySelectorAll('.flash-time-option');
  btns.forEach(btn=>{
    btn.disabled = false;
  });
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
  if(!flashCurrentCard || isFlashTimeCard(flashCurrentCard) || !('speechSynthesis' in window)) return;
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
function handleFlashTimeOption(btn){
  const wrap = document.getElementById('flashCard');
  if(!wrap) return;
  const alreadySelected = wrap.querySelector('.flash-time-option.selected');
  if(alreadySelected) return;
  const isCorrect = btn.getAttribute('data-time-correct') === 'true';
  btn.classList.add('selected');
  const allBtns = wrap.querySelectorAll('.flash-time-option');
  if(isCorrect){
    btn.classList.add('correct');
    playSuccessSound();
    showToast('✅ Верно!');
  } else {
    btn.classList.add('wrong');
    wrap.querySelectorAll('[data-time-correct="true"]').forEach(el=>{ el.classList.add('correct'); });
    playFailSound();
    showToast('❌ Неверно');
  }
  allBtns.forEach(b=>b.disabled = true);
}
document.getElementById('flashCard').addEventListener('click', (e)=>{
  if(e.target.classList.contains('flash-time-option')){
    handleFlashTimeOption(e.target);
    return;
  }
  if(!isFlashTimeCard(flashCurrentCard)){
    speakFlashWord();
  }
});
function updateFlashAutoSpeakBtn(){
  const btn = document.getElementById('flashAutoSpeakBtn');
  if(!btn) return;
  const isTime = isFlashTimeCard(flashCurrentCard);
  btn.style.display = isTime ? 'none' : '';
  btn.classList.toggle('on', !!state.flashAutoSpeak);
}
document.getElementById('flashAutoSpeakBtn').addEventListener('click', ()=>{
  state.flashAutoSpeak = !state.flashAutoSpeak;
  saveState();
  updateFlashAutoSpeakBtn();
  playSuccessSound();
  if(state.flashAutoSpeak && !isFlashTimeCard(flashCurrentCard)) speakFlashWord();
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
  document.getElementById('flashGame').classList.remove('active');
  document.getElementById('flashSetup').classList.add('active');
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
document.getElementById('flashSetupRulesBtn').addEventListener('click', ()=>{ document.getElementById('flashRulesModal').classList.add('show'); });
document.getElementById('flashGameRulesBtn').addEventListener('click', ()=>{ document.getElementById('flashRulesModal').classList.add('show'); });
document.getElementById('closeFlashRulesBtn').addEventListener('click', ()=>{ document.getElementById('flashRulesModal').classList.remove('show'); });
document.getElementById('flashRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'flashRulesModal') e.currentTarget.classList.remove('show'); });
