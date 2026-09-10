// games/stats.js — локальная статистика использования.
//
// ЧТО ЭТО. Локальный счётчик того, во что и как долго играют на ЭТОМ
// устройстве. Нужен владельцу приложения, чтобы понимать свои партии
// (сколько играю, какие игры заходят, где бросаю) и видеть, как ведёт себя
// приложение после обновлений.
//
// ЧЕГО ЭТО НЕ ДЕЛАЕТ. Ничего никуда не отправляет: нет сети, нет сервера,
// нет аналитики. Данные лежат в localStorage отдельным ключом
// (couple-game-stats-v1) и не попадают в state — поэтому не ломают
// сохранения и переживают сброс прогресса.
//
// ВАЖНОЕ ОГРАНИЧЕНИЕ. Статистика привязана к устройству и браузеру:
// телефон и компьютер считаются отдельно, а данные чужого игрока вы
// увидеть не сможете — только если он сам выгрузит файл через
// «Экспортировать». Это плата за обещание «данные не покидают устройство»
// (см. README, раздел «Приватность»).
//
// СТРУКТУРА ЗАПИСИ:
//   {
//     version: 1,
//     enabled: true,          // можно отключить в меню
//     firstSeen: ISO,         // первое открытие приложения
//     days: ['2026-09-19', …],// уникальные дни использования
//     totalGames: 12,         // сколько партий начато
//     games: {                // по режиму игры (state.pausedMode/реестр)
//       fants: { started: 5, finished: 3, totalMs: 240000, lastAt: ISO },
//     },
//     exits: {                // где выходят: 'setup' | 'midgame'
//       setup: 2, midgame: 1,
//     },
//     lastOpenAt: ISO,
//   }

(function () {
  'use strict';

  const STATS_KEY = 'couple-game-stats-v1';
  const STATS_VERSION = 1;

  /** Пустой набор статистики для нового устройства. */
  function emptyStats() {
    return {
      version: STATS_VERSION,
      enabled: true,
      firstSeen: new Date().toISOString(),
      days: [],
      totalGames: 0,
      games: {},
      exits: { setup: 0, midgame: 0 },
      lastOpenAt: new Date().toISOString(),
    };
  }

  let statsCache = null;

  /** Читает статистику (с кэшем в памяти — вызывается часто). */
  function loadStats() {
    if (statsCache) return statsCache;
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Слияние с пустой структурой: если в новых версиях появятся поля,
        // старые записи не сломаются.
        statsCache = Object.assign(emptyStats(), parsed);
        statsCache.games = parsed.games || {};
        statsCache.exits = Object.assign({ setup: 0, midgame: 0 }, parsed.exits || {});
        statsCache.days = Array.isArray(parsed.days) ? parsed.days : [];
        return statsCache;
      }
    } catch (e) { /* повреждённая запись — начинаем заново */ }
    statsCache = emptyStats();
    return statsCache;
  }

  /** Сохраняет статистику. Сбой записи не должен ломать игру. */
  function saveStats() {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(loadStats()));
    } catch (e) { /* квота или приватный режим — статистика не критична */ }
  }

  /** Включена ли статистика (переключатель в меню). */
  function statsEnabled() {
    const g = loadStats();
    return !!g.enabled;
  }

  /** Включает или выключает сбор. При выключении данные не удаляются. */
  function setStatsEnabled(on) {
    loadStats().enabled = !!on;
    saveStats();
  }

  /** Сегодняшняя дата в виде YYYY-MM-DD (локальная, не UTC). */
  function todayKey() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /** Отмечает факт открытия приложения: новый день — в список дней. */
  function statsMarkOpen() {
    if (!statsEnabled()) return;
    const g = loadStats();
    const today = todayKey();
    if (!g.days.includes(today)) g.days.push(today);
    g.lastOpenAt = new Date().toISOString();
    saveStats();
  }

  // Партия, начатая прямо сейчас. Держим отдельно от записи, чтобы
  // «начали и не доиграли» не считалось завершением.
  let currentSession = null;

  /**
   * Игра началась. Вызывается из goToGame().
   * @param {string} mode — ключ игры из реестра (game-registry.js)
   */
  function statsGameStart(mode) {
    if (!statsEnabled() || !mode) return;
    const g = loadStats();
    if (!g.games[mode]) g.games[mode] = { started: 0, finished: 0, totalMs: 0, lastAt: null };
    g.games[mode].started++;
    g.games[mode].lastAt = new Date().toISOString();
    g.totalGames++;
    saveStats();
    currentSession = { mode, at: Date.now() };
  }

  /** Игра завершена честно (дошла до итогов). */
  function statsGameFinish(mode) {
    if (!statsEnabled()) return;
    const g = loadStats();
    const key = mode || (currentSession && currentSession.mode);
    if (!key || !g.games[key]) { currentSession = null; return; }
    g.games[key].finished++;
    if (currentSession && currentSession.mode === key) {
      g.games[key].totalMs += Date.now() - currentSession.at;
    }
    saveStats();
    currentSession = null;
  }

  /**
   * Игрок вышел, не доиграв.
   * @param {'setup'|'midgame'} where — вышел из настройки или посреди партии
   */
  function statsGameExit(where) {
    if (!statsEnabled()) return;
    const g = loadStats();
    const key = where === 'setup' ? 'setup' : 'midgame';
    g.exits[key] = (g.exits[key] || 0) + 1;
    if (key === 'midgame' && currentSession) {
      // Партия прервана: время всё равно учитываем — иначе статистика
      // длительности сместится в сторону только удачных партий.
      const rec = g.games[currentSession.mode];
      if (rec) rec.totalMs += Date.now() - currentSession.at;
    }
    saveStats();
    currentSession = null;
  }

  /** Очищает статистику (кнопка «Очистить» на экране статистики). */
  function clearStats() {
    statsCache = emptyStats();
    saveStats();
  }

  /** Сводка для экрана статистики: посчитанные значения, готовые к показу. */
  function statsSummary() {
    const g = loadStats();
    const rows = Object.keys(g.games).map((mode) => {
      const r = g.games[mode];
      const reg = (typeof gameByMode === 'function') ? gameByMode(mode) : null;
      return {
        mode,
        title: reg ? reg.title.replace(/[«»]/g, '') : mode,
        icon: reg && reg.menuTitle ? reg.menuTitle.split(' ')[0] : '🎮',
        started: r.started,
        finished: r.finished,
        avgMs: r.started > 0 ? Math.round(r.totalMs / r.started) : 0,
        lastAt: r.lastAt,
      };
    }).sort((a, b) => b.started - a.started);

    const totalMs = Object.keys(g.games).reduce((sum, k) => sum + (g.games[k].totalMs || 0), 0);
    return {
      enabled: g.enabled,
      firstSeen: g.firstSeen,
      days: g.days.length,
      totalGames: g.totalGames,
      games: rows,
      exits: g.exits,
      totalMs,
      lastOpenAt: g.lastOpenAt,
    };
  }

  /** Человекочитаемая длительность: 90000 → «1 мин 30 с». */
  function formatDuration(ms) {
    if (!ms || ms < 1000) return 'меньше секунды';
    const totalSec = Math.round(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min === 0) return sec + ' с';
    if (min < 60) return min + ' мин' + (sec ? ' ' + sec + ' с' : '');
    const h = Math.floor(min / 60);
    return h + ' ч ' + (min % 60) + ' мин';
  }

  /** Текст для выгрузки в файл (JSON — его удобно обработать скриптом). */
  function statsExportText() {
    const g = loadStats();
    return JSON.stringify({
      приложение: 'Давай играй',
      сборка: window.APP_BUILD || 'неизвестна',
      выгружено: new Date().toISOString(),
      устройство: navigator.userAgent,
      статистика: g,
    }, null, 2);
  }

  // Публичный интерфейс модуля.
  window.AppStats = {
    load: loadStats,
    markOpen: statsMarkOpen,
    gameStart: statsGameStart,
    gameFinish: statsGameFinish,
    gameExit: statsGameExit,
    clear: clearStats,
    summary: statsSummary,
    enabled: statsEnabled,
    setEnabled: setStatsEnabled,
    formatDuration,
    exportText: statsExportText,
  };
})();
