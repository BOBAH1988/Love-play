// games/krokodil.js — Игра "Крокодил" (компания).
// Загружается через <script src="games/krokodil.js"></script> в index.html.

/* ---------- КРОКОДИЛ (шарады: раунд на время, угадывают слова) ---------- */
// Число слов в раунде на одного игрока настраивается ("Количество заданий":
// 1/3/5/10, по умолчанию 5, см. state.krokodilWordsPerRound) — раунд
// завершается сам, как только показаны все слова (угадано или пропущено),
// даже если время ещё не истекло.
let krRemaining = 0;
let krTotal = 0;
let krIntervalId = null;
let krRoundGuessed = 0;
let krRoundSkipped = 0;
let krCurrentCard = null;
// mode: 'word' — только одиночные существительные (карточки с mode:'word'
// в cards_krokodil.js); 'action' (по умолчанию) — обычные карточки-сценки
// без этого поля; 'explain' — разновидность без пантомимы (объясняешь
// словами и описаниями, не называя само слово) — использует тот же пул
// карточек, что и 'word' (одиночные существительные подходят для устного
// объяснения так же хорошо, как и для показа жестами), без отдельного
// набора карточек.
function getKrCardsList(level, mode){
  if(typeof KROKODIL_CARDS === 'undefined' || !Array.isArray(KROKODIL_CARDS)) return [];
  return KROKODIL_CARDS.filter(c=>c.level===level && ((mode === 'word' || mode === 'explain') ? c.mode === 'word' : c.mode !== 'word'));
}
// Общий список игроков для всех "Игр для компании" (сейчас использует
// только Крокодил, но хранится на уровне группы, чтобы будущие игры тоже
// могли на него опираться): от 2 до 10, поля добавляются/удаляются
// кнопками, имена по умолчанию "Игрок N".
function renderPartyPlayers(){
  if(!state.partyPlayers || state.partyPlayers.length < 2){
    state.partyPlayers = ['Игрок 1','Игрок 2'];
  }
  const wrap = document.getElementById('partyPlayersList');
  if(!wrap) return;
  wrap.innerHTML = '';
  state.partyPlayers.forEach((name, idx)=>{
    const row = document.createElement('div');
    row.className = 'krokodil-player-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 14;
    input.placeholder = 'Игрок ' + (idx + 1);
    input.value = name;
    input.addEventListener('input', ()=>{
      state.partyPlayers[idx] = input.value.trim() || ('Игрок ' + (idx + 1));
      saveState();
    });
    row.appendChild(input);
    if(state.partyPlayers.length > 2){
      const rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.className = 'krokodil-player-remove';
      rmBtn.setAttribute('aria-label', 'Удалить игрока');
      rmBtn.textContent = '✕';
      rmBtn.addEventListener('click', ()=>{
        if(state.partyPlayers.length <= 2) return;
        state.partyPlayers.splice(idx, 1);
        saveState();
        renderPartyPlayers();
      });
      row.appendChild(rmBtn);
    }
    wrap.appendChild(row);
  });
  const addBtn = document.getElementById('partyAddPlayerBtn');
  if(addBtn) addBtn.style.display = state.partyPlayers.length >= 10 ? 'none' : '';
}
document.getElementById('partyAddPlayerBtn').addEventListener('click', ()=>{
  if(!state.partyPlayers) state.partyPlayers = ['Игрок 1','Игрок 2'];
  if(state.partyPlayers.length >= 10) return;
  state.partyPlayers.push('Игрок ' + (state.partyPlayers.length + 1));
  saveState();
  renderPartyPlayers();
});
function renderKrokodilSetupLevels(){
  const wrap = document.getElementById('krokodilSetupLevels');
  if(!wrap) return;
  wrap.innerHTML = '';
  (typeof KROKODIL_LEVELS !== 'undefined' ? KROKODIL_LEVELS : []).forEach(l=>{
    const div = document.createElement('div');
    div.className = 'level-toggle' + (state.krokodilSelectedLevel === l.id ? ' on' : '');
    div.innerHTML = `<div class="lname">${l.icon} ${l.name}</div><div class="ldesc">${l.desc}</div><div class="level-check"></div>`;
    div.addEventListener('click', ()=>{
      state.krokodilSelectedLevel = l.id;
      saveState();
      renderKrokodilSetupLevels();
    });
    wrap.appendChild(div);
  });
}
function renderKrokodilDurationGroup(){
  document.querySelectorAll('#krokodilDurationGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (state.krokodilRoundSeconds || 180));
  });
}
document.querySelectorAll('#krokodilDurationGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.krokodilRoundSeconds = parseInt(btn.dataset.value, 10);
    saveState();
    renderKrokodilDurationGroup();
  });
});
// "Сложность": Слово (только одиночные существительные) / Действие (сценки,
// по умолчанию — прежнее поведение игры до этой настройки).
const KROKODIL_MODE_SUBTITLES = {
  word: 'Один показывает слово молча — остальные угадывают',
  action: 'Один показывает слово молча — остальные угадывают',
  explain: 'Один объясняет слово своими словами, не называя его и однокоренные — остальные угадывают',
};
function renderKrokodilModeGroup(){
  const mode = state.krokodilMode || 'word';
  document.querySelectorAll('#krokodilModeGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', btn.dataset.value === mode);
  });
  const subtitle = document.getElementById('krokodilSetupSubtitle');
  if(subtitle) subtitle.textContent = KROKODIL_MODE_SUBTITLES[mode] || KROKODIL_MODE_SUBTITLES.word;
}
document.querySelectorAll('#krokodilModeGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.krokodilMode = btn.dataset.value;
    saveState();
    renderKrokodilModeGroup();
  });
});
// "Количество заданий": сколько слов подряд показывается за один раунд
// (ход одного игрока), прежде чем раунд завершится сам.
function renderKrokodilWordsCountGroup(){
  document.querySelectorAll('#krokodilWordsCountGroup .starter-btn').forEach(btn=>{
    btn.classList.toggle('on', parseInt(btn.dataset.value, 10) === (state.krokodilWordsPerRound || 5));
  });
}
document.querySelectorAll('#krokodilWordsCountGroup .starter-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.krokodilWordsPerRound = parseInt(btn.dataset.value, 10);
    saveState();
    renderKrokodilWordsCountGroup();
  });
});
function goToKrokodilSetup(){
  goToGameSetup('krokodilSetup', null, ()=>{
    renderKrokodilSetupLevels();
    renderKrokodilModeGroup();
    renderKrokodilDurationGroup();
    renderKrokodilWordsCountGroup();
  });
}
function exitKrokodilSetup(){
  document.getElementById('krokodilSetup').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('companyView');
}
function stopKrInterval(){
  krIntervalId = stopInterval(krIntervalId);
}
function updateKrBar(){
  updateProgressBar('krokodilBarFill', 'krokodilLabel', krRemaining, krTotal, true);
}
function updateKrScoreUI(){
  const players = state.partyPlayers || ['Игрок 1','Игрок 2'];
  const scores = state.krokodilScores || [];
  const idx = state.krokodilCurrentPlayerIndex || 0;
  const wrap = document.getElementById('krokodilScoreRow');
  if(wrap){
    wrap.innerHTML = '';
    players.forEach((name, i)=>{
      const span = document.createElement('span');
      span.className = 'krokodil-score-item' + (i === idx ? ' active' : '');
      span.textContent = name + ': ' + (scores[i] || 0);
      wrap.appendChild(span);
    });
  }
  const turnName = players[idx] || 'Игрок 1';
  const turnLabel = document.getElementById('krokodilTurnLabel');
  const verb = (state.krokodilMode || 'word') === 'explain' ? 'Объясняет' : 'Показывает';
  if(turnLabel) turnLabel.textContent = verb + ': ' + turnName;
}
// Слово текущего раунда, тянется без повторов внутри уровня+режима, пока
// пул не закончится — тот же принцип, что и во всех остальных играх
// приложения. "Использованные" слова хранятся отдельным ключом на каждую
// пару уровень+режим (krokodilUsed['2-word'], krokodilUsed['2-action'] и
// т.д.), чтобы переключение "Слово"/"Действие" не путало прогресс показа.
function krDrawWord(){
  const level = state.krokodilSelectedLevel || 1;
  const mode = state.krokodilMode || 'word';
  const usedKey = level + '-' + mode;
  const all = getKrCardsList(level, mode);
  if(all.length === 0){
    krCurrentCard = null;
    fadeSwapEl('krokodilCard', (el)=>{
      el.className = 'card';
      el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon">🐊</div><div class="card-text">Нет слов для этого уровня</div></div></div>`;
    });
    return;
  }
  if(!state.krokodilUsed) state.krokodilUsed = {};
  let used = state.krokodilUsed[usedKey] || [];
  let pool = all.filter(c=>!used.includes(c.text));
  if(pool.length === 0){
    pool = all;
    used = [];
    showToast('Слова этого уровня показаны заново 🔀');
  }
  const card = pool[Math.floor(Math.random()*pool.length)];
  used.push(card.text);
  state.krokodilUsed[usedKey] = used;
  saveState();
  krCurrentCard = card;
  fadeSwapEl('krokodilCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="krokodil-word-icon">${card.icon || '🐊'}</div><div class="card-text krokodil-word">${card.text}</div></div></div>`;
  });
}
function krStartRound(){
  krRoundGuessed = 0;
  krRoundSkipped = 0;
  krTotal = state.krokodilRoundSeconds || 180;
  krRemaining = krTotal;
  document.getElementById('krokodilBarTrack').style.display = '';
  document.getElementById('krokodilLabel').style.display = '';
  document.getElementById('krokodilRoundSummary').style.display = 'none';
  document.getElementById('krokodilStartRoundBtn').style.display = 'none';
  document.getElementById('krokodilNextPlayerBtn').style.display = 'none';
  document.getElementById('krokodilGuessedBtn').style.display = 'flex';
  document.getElementById('krokodilSkipBtn').style.display = 'flex';
  updateKrBar();
  krDrawWord();
  stopKrInterval();
  krIntervalId = setInterval(krTick, 1000);
}
function krTick(){
  krRemaining--;
  updateKrBar();
  if(krRemaining <= 0){
    stopKrInterval();
    // Слово, которое было на экране в момент истечения времени, не было ни
    // угадано, ни пропущено вручную — засчитываем его как пропущенное.
    if(krCurrentCard){ krRoundSkipped++; krCurrentCard = null; }
    krRoundEnd();
  }
}
function krRoundEnd(){
  stopKrInterval();
  playSuccessSound();
  const players = state.partyPlayers || ['Игрок 1','Игрок 2'];
  const idx = state.krokodilCurrentPlayerIndex || 0;
  const turnName = players[idx] || 'Игрок 1';
  if(!state.krokodilScores) state.krokodilScores = [];
  if(!state.krokodilSkipCounts) state.krokodilSkipCounts = [];
  state.krokodilScores[idx] = (state.krokodilScores[idx] || 0) + krRoundGuessed;
  state.krokodilSkipCounts[idx] = (state.krokodilSkipCounts[idx] || 0) + krRoundSkipped;
  state.krokodilTurnsPlayed = (state.krokodilTurnsPlayed || 0) + 1;
  saveState();
  updateKrScoreUI();
  document.getElementById('krokodilGuessedBtn').style.display = 'none';
  document.getElementById('krokodilSkipBtn').style.display = 'none';
  document.getElementById('krokodilBarTrack').style.display = 'none';
  document.getElementById('krokodilLabel').style.display = 'none';

  const roundsPerPlayer = state.krokodilRoundsPerPlayer || 5;
  const gameOver = state.krokodilTurnsPlayed >= players.length * roundsPerPlayer;

  // Пока игра не закончена — короткая строка под карточкой про этот раунд.
  // Когда закончена — полноценное итоговое окно (см. showKrokodilSummaryModal),
  // а не текст под карточкой (терялся при большом числе игроков и не
  // показывал пропуски по каждому игроку).
  const summary = document.getElementById('krokodilRoundSummary');
  if(summary){
    if(gameOver){
      summary.style.display = 'none';
      summary.innerHTML = '';
    } else {
      summary.style.display = '';
      summary.innerHTML = `Раунд завершён! ${turnName} угадал(а) слов: ${krRoundGuessed}` + (krRoundSkipped ? `, пропущено: ${krRoundSkipped}` : '');
    }
  }
  fadeSwapEl('krokodilCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon">🐊</div><div class="card-text">${gameOver ? 'Игра окончена' : 'Раунд окончен'}</div></div></div>`;
  });
  document.getElementById('krokodilNextPlayerBtn').style.display = gameOver ? 'none' : 'flex';
  document.getElementById('krokodilFinishBtn').style.display = gameOver ? 'flex' : 'none';
  if(gameOver) showKrokodilSummaryModal();
}
// Итоговое окно результатов — место, имя, угадано/пропущено по каждому
// игроку, отсортировано по убыванию счёта (угадано). 1-е место выделено
// цветом и медалью, 2-е и 3-е — тоже медалями, остальные — номером места.
// krokodilSummaryIsExit различает два случая закрытия модалки (см.
// closeKrokodilSummaryBtn): естественное завершение партии (все раунды
// сыграны — экран уже krokodilGame, значит после закрытия нужно вернуться
// на экран настройки) и досрочный выход через общее меню паузы (см.
// showKrokodilExitSummary — там экран уже #setup, никуда переключать не надо).
let krokodilSummaryIsExit = false;
function renderKrokodilSummaryList(){
  const players = state.partyPlayers || ['Игрок 1','Игрок 2'];
  const scores = state.krokodilScores || [];
  const skips = state.krokodilSkipCounts || [];
  const ranking = players.map((n,i)=>({n, score: scores[i] || 0, skipped: skips[i] || 0}))
    .sort((a,b)=>b.score-a.score);
  const medals = ['🥇','🥈','🥉'];
  return ranking.map((r,i)=>{
    const place = medals[i] || `${i+1}.`;
    const isFirst = i === 0;
    return `
      <div class="krokodil-summary-row${isFirst ? ' krokodil-summary-first' : ''}">
        <span class="krokodil-summary-place">${place}</span>
        <span class="krokodil-summary-name">${r.n}</span>
        <span class="krokodil-summary-score">Угадано: ${r.score} · Пропущено: ${r.skipped}</span>
      </div>
    `;
  }).join('');
}
function showKrokodilSummaryModal(){
  krokodilSummaryIsExit = false;
  const players = state.partyPlayers || ['Игрок 1','Игрок 2'];
  document.getElementById('krokodilSummaryTitle').textContent = '🏆 Игра окончена';
  document.getElementById('krokodilSummaryIntro').textContent = `Сыграно раундов: ${players.length * (state.krokodilRoundsPerPlayer || 5)} — вот кто справился лучше всех:`;
  document.getElementById('krokodilSummaryList').innerHTML = renderKrokodilSummaryList();
  showModal('krokodilSummaryModal');
}
// Досрочный выход через общее меню паузы ("Пауза" на экране игры → на
// главном экране "Закончить игру") — раньше в этом случае партия просто
// молча сбрасывалась без единого слова об итогах (см. finishGameBtn в
// games/core.js), из-за чего казалось, что у Крокодила вообще нет итогового
// окна. Теперь показываем те же итоги, что и при обычном завершении, только
// с пометкой "партия прервана" и текущим (неполным) счётом.
function showKrokodilExitSummary(){
  krokodilSummaryIsExit = true;
  // Меню паузы (#pauseMenuModal) само не закрывается при нажатии "Закончить
  // игру" — без этого оно перекрывало итоговое окно (оба модальных окна
  // получали класс .show одновременно, а позже в DOM побеждает pauseMenuModal).
  const pauseModal = document.getElementById('pauseMenuModal');
  if(pauseModal) pauseModal.classList.remove('show');
  document.getElementById('krokodilSummaryTitle').textContent = '⏸️ Партия прервана';
  document.getElementById('krokodilSummaryIntro').textContent = `Сыграно раундов: ${state.krokodilTurnsPlayed || 0}. Текущий счёт:`;
  document.getElementById('krokodilSummaryList').innerHTML = renderKrokodilSummaryList();
  showModal('krokodilSummaryModal');
}
function krNextPlayerRound(){
  const n = (state.partyPlayers || []).length || 1;
  state.krokodilCurrentPlayerIndex = ((state.krokodilCurrentPlayerIndex || 0) + 1) % n;
  saveState();
  updateKrScoreUI();
  document.getElementById('krokodilRoundSummary').style.display = 'none';
  document.getElementById('krokodilNextPlayerBtn').style.display = 'none';
  document.getElementById('krokodilStartRoundBtn').style.display = 'flex';
  fadeSwapEl('krokodilCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon">🐊</div><div class="card-text">Нажмите «▶ Начать раунд»</div></div></div>`;
  });
}
function goToKrokodilGame(){
  abandonPausedSession('davay');
  abandonPausedSession('td');
  abandonPausedSession('bingo');
  abandonPausedSession('soloBs');
  state.pausedMode = null;
  goToGame('krokodilSetup', 'krokodilGame');
  if(!state.partyPlayers || state.partyPlayers.length < 2){
    state.partyPlayers = ['Игрок 1','Игрок 2'];
  }
  const n = state.partyPlayers.length;
  state.krokodilScores = new Array(n).fill(0);
  state.krokodilSkipCounts = new Array(n).fill(0);
  state.krokodilTurnsPlayed = 0;
  state.krokodilCurrentPlayerIndex = Math.floor(Math.random() * n);
  state.inProgress = true;
  saveState();
  updateKrScoreUI();
  document.getElementById('krokodilStartRoundBtn').style.display = 'flex';
  document.getElementById('krokodilGuessedBtn').style.display = 'none';
  document.getElementById('krokodilSkipBtn').style.display = 'none';
  document.getElementById('krokodilNextPlayerBtn').style.display = 'none';
  document.getElementById('krokodilFinishBtn').style.display = 'none';
  document.getElementById('krokodilBarTrack').style.display = 'none';
  document.getElementById('krokodilLabel').style.display = 'none';
  document.getElementById('krokodilRoundSummary').style.display = 'none';
  fadeSwapEl('krokodilCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon">🐊</div><div class="card-text">Нажмите «▶ Начать раунд»</div></div></div>`;
  });
  updateMuteBtn();
  requestWakeLock();
}
// Полный выход из партии (по кнопке "Завершить игру" на итоговом экране) —
// сбрасывает счёт и возвращает на экран настройки Крокодила.
function exitKrokodilGame(){
  stopKrInterval();
  hideModal('krokodilSummaryModal');
  state.krokodilScores = [];
  state.krokodilSkipCounts = [];
  state.krokodilTurnsPlayed = 0;
  state.krokodilCurrentPlayerIndex = 0;
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  document.getElementById('krokodilGame').classList.remove('active');
  document.getElementById('krokodilSetup').classList.add('active');
}
// Пауза: вернуться в главное меню, не сбрасывая счёт и игроков — можно
// продолжить позже через общий блок "Продолжить игру" / "Закончить игру".
function pauseKrokodilGame(){
  stopKrInterval();
  state.pausedMode = 'krokodil';
  saveState();
  document.getElementById('krokodilGame').classList.remove('active');
  document.getElementById('setup').classList.add('active');
  showSetupView('companyView');
  updateResumeUI();
}
function resumeKrokodilGame(){
  state.pausedMode = null;
  saveState();
  updateResumeUI();
  document.getElementById('setup').classList.remove('active');
  document.getElementById('krokodilGame').classList.add('active');
  updateKrScoreUI();
  document.getElementById('krokodilStartRoundBtn').style.display = 'flex';
  document.getElementById('krokodilGuessedBtn').style.display = 'none';
  document.getElementById('krokodilSkipBtn').style.display = 'none';
  document.getElementById('krokodilNextPlayerBtn').style.display = 'none';
  document.getElementById('krokodilFinishBtn').style.display = 'none';
  document.getElementById('krokodilBarTrack').style.display = 'none';
  document.getElementById('krokodilLabel').style.display = 'none';
  document.getElementById('krokodilRoundSummary').style.display = 'none';
  fadeSwapEl('krokodilCard', (el)=>{
    el.className = 'card';
    el.innerHTML = `<div class="card-inner"><div class="card-body"><div class="card-icon">🐊</div><div class="card-text">Нажмите «▶ Начать раунд»</div></div></div>`;
  });
  updateMuteBtn();
  requestWakeLock();
}
function finishKrokodilGame(){
  state.krokodilScores = [];
  state.krokodilSkipCounts = [];
  state.krokodilTurnsPlayed = 0;
  state.krokodilCurrentPlayerIndex = 0;
  state.inProgress = false;
  state.pausedMode = null;
  saveState();
  updateResumeUI();
}
document.getElementById('krokodilSetupStartBtn').addEventListener('click', ()=>{ goToKrokodilGame(); });
document.getElementById('krokodilSetupExitBtn').addEventListener('click', ()=>{ exitKrokodilSetup(); });
document.getElementById('krokodilStartRoundBtn').addEventListener('click', ()=>{ krStartRound(); });
document.getElementById('krokodilGuessedBtn').addEventListener('click', ()=>{
  playSuccessSound();
  krRoundGuessed++;
  if(krRoundGuessed + krRoundSkipped >= (state.krokodilWordsPerRound || 5)){ krRoundEnd(); }
  else { krDrawWord(); }
});
document.getElementById('krokodilSkipBtn').addEventListener('click', ()=>{
  krRoundSkipped++;
  if(krRoundGuessed + krRoundSkipped >= (state.krokodilWordsPerRound || 5)){ krRoundEnd(); }
  else { krDrawWord(); }
});
document.getElementById('krokodilNextPlayerBtn').addEventListener('click', ()=>{ krNextPlayerRound(); });
document.getElementById('krokodilFinishBtn').addEventListener('click', ()=>{ exitKrokodilGame(); });
document.getElementById('closeKrokodilSummaryBtn').addEventListener('click', ()=>{
  if(krokodilSummaryIsExit){
    hideModal('krokodilSummaryModal');
    finishKrokodilGame();
  } else {
    exitKrokodilGame();
  }
});
document.getElementById('krokodilExitBtn').addEventListener('click', ()=>{
  pauseKrokodilGame();
  showToast('Игра на паузе — прогресс сохранён');
});
(document.getElementById('krokodilSetupRulesBtn')||{addEventListener:function(){}}).addEventListener('click', ()=>{ showModal('krokodilRulesModal'); });
document.getElementById('closeKrokodilRulesBtn').addEventListener('click', ()=>{ hideModal('krokodilRulesModal'); });
document.getElementById('krokodilRulesModal').addEventListener('click', (e)=>{ if(e.target.id === 'krokodilRulesModal') e.currentTarget.classList.remove('show'); });

