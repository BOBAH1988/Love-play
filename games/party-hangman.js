// games/party-hangman.js — Игра "Виселица" (раздел "Игры для одного").
// Загружается через <script src="games/party-hangman.js"></script> в index.html.
// Классическая "Виселица": угадываете случайное слово по буквам через
// экранную клавиатуру. 6 ошибок — поражение (слово открывается полностью),
// все буквы угаданы — победа. Общий счёт побед/поражений, без уровней и без
// привязки к списку игроков (имена файла/функций исторически с приставкой
// "party" — раньше игра была в разделе "Игры для компании").

const PARTY_HANGMAN_ALPHABET = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'.split('');
const PARTY_HANGMAN_MAX_WRONG = 6;
const PARTY_HANGMAN_PARTS = ['hmHead','hmBody','hmArmL','hmArmR','hmLegL','hmLegR'];

function getPartyHangmanWordsList(){
  if(typeof PARTY_HANGMAN_WORDS === 'undefined' || !Array.isArray(PARTY_HANGMAN_WORDS)) return [];
  return PARTY_HANGMAN_WORDS;
}

function renderPartyHangmanWord(){
  const word = state.partyHangmanWord || '';
  const guessed = state.partyHangmanGuessed || [];
  const html = word.split('').map(ch=>{
    const shown = guessed.includes(ch);
    return `<span class="hangman-letter-box">${shown ? ch : ''}</span>`;
  }).join('');
  const wrap = document.getElementById('partyHangmanWordRow');
  if(wrap) wrap.innerHTML = html;
}

function renderPartyHangmanFigure(){
  const wrong = state.partyHangmanWrong || 0;
  PARTY_HANGMAN_PARTS.forEach((id, i)=>{
    const el = document.getElementById(id);
    if(el) el.classList.toggle('hangman-part-visible', i < wrong);
  });
}

function renderPartyHangmanKeyboard(){
  const wrap = document.getElementById('partyHangmanKeyboard');
  if(!wrap) return;
  wrap.innerHTML = '';
  const guessed = state.partyHangmanGuessed || [];
  const word = state.partyHangmanWord || '';
  PARTY_HANGMAN_ALPHABET.forEach(ch=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hangman-key';
    btn.textContent = ch;
    const used = guessed.includes(ch);
    if(used){
      btn.disabled = true;
      btn.classList.add(word.includes(ch) ? 'hangman-key-correct' : 'hangman-key-wrong');
    }
    btn.addEventListener('click', ()=>{ partyHangmanGuessLetter(ch); });
    wrap.appendChild(btn);
  });
}

function updatePartyHangmanScoreUI(){
  const el = document.getElementById('partyHangmanScoreRow');
  if(el) el.textContent = `🏆 Побед: ${state.partyHangmanWins || 0}   ·   💀 Поражений: ${state.partyHangmanLosses || 0}`;
}

function partyHangmanStatusText(){
  const remaining = PARTY_HANGMAN_MAX_WRONG - (state.partyHangmanWrong || 0);
  return remaining > 0 ? `Осталось попыток: ${remaining}` : '';
}

function updatePartyHangmanStatus(){
  const el = document.getElementById('partyHangmanStatus');
  if(el) el.textContent = partyHangmanStatusText();
}

function partyHangmanCheckEnd(){
  const word = state.partyHangmanWord || '';
  const guessed = state.partyHangmanGuessed || [];
  const solved = word.split('').every(ch=>guessed.includes(ch));
  if(solved){
    state.partyHangmanWins = (state.partyHangmanWins || 0) + 1;
    saveState();
    updatePartyHangmanScoreUI();
    playSuccessSound();
    document.getElementById('partyHangmanStatus').textContent = '🎉 Слово угадано!';
    document.getElementById('partyHangmanNextBtn').style.display = 'flex';
    document.getElementById('partyHangmanKeyboard').classList.add('hangman-keyboard-disabled');
    return true;
  }
  if((state.partyHangmanWrong || 0) >= PARTY_HANGMAN_MAX_WRONG){
    state.partyHangmanLosses = (state.partyHangmanLosses || 0) + 1;
    saveState();
    updatePartyHangmanScoreUI();
    playErrorSound();
    document.getElementById('partyHangmanStatus').textContent = `💀 Не угадали! Слово было: ${word}`;
    document.getElementById('partyHangmanNextBtn').style.display = 'flex';
    document.getElementById('partyHangmanKeyboard').classList.add('hangman-keyboard-disabled');
    return true;
  }
  return false;
}

function partyHangmanGuessLetter(ch){
  const word = state.partyHangmanWord || '';
  if(!state.partyHangmanGuessed) state.partyHangmanGuessed = [];
  if(state.partyHangmanGuessed.includes(ch)) return;
  state.partyHangmanGuessed.push(ch);
  if(!word.includes(ch)){
    state.partyHangmanWrong = (state.partyHangmanWrong || 0) + 1;
    playErrorSound();
  } else {
    playSuccessSound();
  }
  saveState();
  renderPartyHangmanWord();
  renderPartyHangmanFigure();
  renderPartyHangmanKeyboard();
  updatePartyHangmanStatus();
  partyHangmanCheckEnd();
}

function partyHangmanDrawWord(){
  const all = getPartyHangmanWordsList();
  if(all.length === 0){
    state.partyHangmanWord = 'НЕТСЛОВ';
  } else {
    if(!state.partyHangmanUsedWords) state.partyHangmanUsedWords = [];
    let pool = all.filter(w=>!state.partyHangmanUsedWords.includes(w.word));
    if(pool.length === 0){
      pool = all;
      state.partyHangmanUsedWords = [];
      showToast('Слова показаны заново 🔀');
    }
    const card = pool[Math.floor(Math.random()*pool.length)];
    state.partyHangmanUsedWords.push(card.word);
    state.partyHangmanWord = card.word;
  }
  state.partyHangmanGuessed = [];
  state.partyHangmanWrong = 0;
  saveState();
  renderPartyHangmanWord();
  renderPartyHangmanFigure();
  renderPartyHangmanKeyboard();
  document.getElementById('partyHangmanKeyboard').classList.remove('hangman-keyboard-disabled');
  document.getElementById('partyHangmanNextBtn').style.display = 'none';
  updatePartyHangmanStatus();
}

function goToPartyHangmanGame(){
  document.getElementById('setup').classList.remove('active');
  document.getElementById('partyHangmanGame').classList.add('active');
  updatePartyHangmanScoreUI();
  partyHangmanDrawWord();
  updateMuteBtn();
  requestWakeLock();
}
function exitPartyHangmanGame(){
  exitGame('partyHangmanGame', 'setup');
  showSetupView('companyView');
}

document.getElementById('partyHangmanNextBtn').addEventListener('click', ()=>{
  playSuccessSound();
  partyHangmanDrawWord();
});
document.getElementById('partyHangmanExitBtn').addEventListener('click', ()=>{ exitPartyHangmanGame(); });
(document.getElementById('partyHangmanGameRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ document.getElementById('partyHangmanRulesModal').classList.add('show'); });
document.getElementById('closePartyHangmanRulesBtn').addEventListener('click', ()=>{ document.getElementById('partyHangmanRulesModal').classList.remove('show'); });
document.getElementById('partyHangmanRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'partyHangmanRulesModal') e.currentTarget.classList.remove('show'); });
