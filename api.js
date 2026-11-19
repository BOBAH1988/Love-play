/**
 * Старый клиент → новый API.
 * Скрипт лежит в основе core.js/fants-timer.js на время перехода: клиент
 * вызывает те же методы, что и раньше, а внутри решается, куда идти —
 * в Firebase или на собственный сервер.
 *
 * Правила перехода задаются window.COP_BACKEND:
 *   { mode: 'firebase' }  — как сейчас, своего сервера не касаемся;
 *   { mode: 'dual' }      — читаем и пишем в оба, чтение из Firebase (этап «до»);
 *   { mode: 'server' }    — читаем и пишем только на сервер (этап «после»).
 * Если блок не задан, режим берётся из localStorage (cop-backend-mode),
 * иначе 'firebase'.
 */
(function () {
  'use strict';

  var SESSION_KEY = 'cop-session-cache-v1';
  var MODE_KEY = 'cop-backend-mode';
  var DEFAULT_BASE = '';

  function settings() {
    return (typeof window !== 'undefined' && window.COP_BACKEND) || {};
  }

  function mode() {
    var s = settings();
    if (s.mode) return s.mode;
    try {
      var stored = localStorage.getItem(MODE_KEY);
      if (stored === 'server' || stored === 'dual' || stored === 'firebase') return stored;
    } catch (e) {}
    return 'firebase';
  }

  function setMode(next) {
    if (['server', 'dual', 'firebase'].indexOf(next) < 0) return false;
    try { localStorage.setItem(MODE_KEY, next); } catch (e) {}
    if (window.COP_BACKEND) window.COP_BACKEND.mode = next;
    return true;
  }

  function base() {
    var s = settings();
    if (typeof s.baseUrl === 'string') return s.baseUrl.replace(/\/+$/, '');
    if (s.baseUrl === false) return '';
    return DEFAULT_BASE;
  }

  /** Сервер известен, если явно задан baseUrl или включён не-Firebase режим. */
  function serverConfigured() {
    var s = settings();
    return s.baseUrl === '' || typeof s.baseUrl === 'string';
  }

  function usesServer() {
    return serverConfigured() && (mode() === 'server' || mode() === 'dual');
  }

  function onServer() {
    return serverConfigured() && mode() === 'server';
  }

  /* ---------- низкоуровневый вызов ---------- */

  function request(path, options) {
    options = options || {};
    var url = base() + path;
    var opts = {
      method: options.method || 'GET',
      credentials: 'same-origin',
      headers: { 'accept': 'application/json' },
      cache: 'no-store',
    };
    if (base() && base() !== location.origin) {
      // Свой домен API при чужом домене приложения: нужны cookies и CORS.
      opts.credentials = 'include';
    }
    if (options.body !== undefined) {
      opts.headers['content-type'] = 'application/json';
      opts.body = JSON.stringify(options.body);
    }
    return fetch(url, opts).then(function (res) {
      var isJson = (res.headers.get('content-type') || '').indexOf('application/json') >= 0;
      return (isJson ? res.json().catch(function () { return {}; }) : Promise.resolve({}))
        .then(function (data) {
          if (!res.ok) {
            var err = new Error((data && data.error) || ('HTTP ' + res.status));
            err.status = res.status;
            err.code = (data && data.code) || ('server/' + res.status);
            throw err;
          }
          return data;
        });
    });
  }

  /* ---------- сессия ---------- */

  var cached = null;

  function readCache() {
    if (cached) return cached;
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (raw) cached = JSON.parse(raw);
    } catch (e) {}
    return cached;
  }

  function writeCache(data) {
    cached = data;
    try {
      if (data && data.user) localStorage.setItem(SESSION_KEY, JSON.stringify(data));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  /** Кэш уровня доступа — чтобы при запуске PWA не мигал «гостевой» экран. */
  function applyCachedLevel() {
    var c = readCache();
    var lvl = (c && c.accessLevel) || 'guest';
    try {
      localStorage.setItem('__userAccessLevel', lvl);
      localStorage.setItem('__userIsAdult', (c && c.isAdult) ? 'true' : 'false');
    } catch (e) {}
    window.__userAccessLevel = lvl;
    window.__userIsAdult = !!(c && c.isAdult);
  }

  function refreshSession() {
    if (!serverConfigured()) return Promise.resolve(null);
    return request('/api/auth/session').then(function (data) {
      writeCache(data);
      return data;
    }).catch(function () {
      return null;
    });
  }

  /* ---------- Firebase-ветка ---------- */

  function firebaseAuth() {
    var f = window.ComeOnPlayFirebase;
    return f && f.auth;
  }

  function firebaseDb() {
    var f = window.ComeOnPlayFirebase;
    return f && f.db;
  }

  /**
   * В режиме требования нового пароля берём адрес из письма: сервер шлёт
   * ссылку на /api/auth/reset, которое перенаправляет сюда.
   */
  function resetTokenFromUrl() {
    try {
      var params = new URLSearchParams(location.search || '');
      var tok = params.get('cop_reset_token');
      if (tok) return { token: tok, kind: params.get('cop_reset_kind') || 'reset' };
    } catch (e) {}
    return null;
  }

  function firebaseSessionLike() {
    var auth = firebaseAuth();
    var user = auth && auth.currentUser;
    if (!user) return null;
    var db = firebaseDb();
    return {
      uid: user.uid,
      email: user.email || '',
      emailVerified: !!user.emailVerified,
      getProfile: function () {
        if (!db) return Promise.resolve({});
        return db.collection('users').doc(user.uid).get().then(function (doc) {
          return doc && doc.exists ? (doc.data() || {}) : {};
        });
      },
      reload: function () { return user.reload ? user.reload() : Promise.resolve(); },
    };
  }

  /* ---------- публичный интерфейс ---------- */

  var api = {
    mode: mode,
    setMode: setMode,
    usesServer: usesServer,
    onServer: onServer,
    serverConfigured: serverConfigured,

    request: request,
    refreshSession: refreshSession,
    applyCachedLevel: applyCachedLevel,
    resetTokenFromUrl: resetTokenFromUrl,

    /** Спека для адаптера внутри core.js: кто считает пользователя вошедшим. */
    currentSession: function () {
      if (onServer()) {
        var c = readCache();
        return c && c.user ? c : null;
      }
      return firebaseSessionLike();
    },

    /** Двойной вызов: основная цель — Firebase, сервер получает копию. */
    mirror: function (path, options) {
      if (mode() !== 'dual') return;
      request(path, options).catch(function (err) {
        console.warn('[api:mirror]', path, err && err.message);
      });
    },

    /** Глубина «статистика всех пользователей» — админские экраны. */
    admin: {
      userStats: function () { return request('/api/admin/stats/users'); },
      generalStats: function () { return request('/api/admin/stats/general'); },
      users: function () { return request('/api/admin/users'); },
      setLevel: function (uid, accessLevel) {
        return request('/api/admin/users/' + encodeURIComponent(uid), {
          method: 'PATCH',
          body: { accessLevel: accessLevel },
        });
      },
    },

    games: function () {
      return request('/api/games');
    },

    state: {
      pull: function () { return request('/api/me/state').then(function (d) { return d.state || null; }); },
      push: function (state) {
        return request('/api/me/state', { method: 'PUT', body: { state: state } });
      },
    },

    stats: {
      push: function (gameStats) {
        return request('/api/stats/push', { method: 'POST', body: { gameStats: gameStats } });
      },
    },

    profile: {
      save: function (profile) {
        return request('/api/me', { method: 'PATCH', body: { profile: profile } });
      },
      defaults: function (defaults) {
        return request('/api/me', { method: 'PATCH', body: { defaults: defaults } });
      },
    },

    resetPassword: function (password, token, kind) {
      return request('/api/auth/password/set', {
        method: 'POST',
        body: { password: password, token: token, kind: kind || 'reset' },
      }).then(function (data) { writeCache(data); return data; });
    },
  };

  if (typeof window !== 'undefined') {
    window.ComeOnPlayApi = api;
    if (window.COP_BACKEND && window.COP_BACKEND.mode) {
      try { localStorage.setItem(MODE_KEY, window.COP_BACKEND.mode); } catch (e) {}
    }
  }

  // Сквозная поддержка ссылки «установить пароль» из письма.
  var reset = resetTokenFromUrl();
  if (reset && window.ComeOnPlayApi) {
    window.__copResetPending = reset;
  }
})();
