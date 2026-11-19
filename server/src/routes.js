/**
 * Маршруты API. Формы запросов и ответов повторяют то, что клиент уже делает
 * с Firebase, чтобы переход был заменой вызова, а не переписыванием экрана.
 */
import { readJson, parseCookies, asObject, HttpError, badRequest, unauthorized, forbidden, notFound } from './http.js';
import { randomToken, sha256 } from './auth.js';
import { LEVELS } from './store.js';

const SESSION_COOKIE = 'cop_session';
const SESSION_TTL_MS = 14 * 24 * 3600 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const WELCOME_TTL_MS = 14 * 24 * 3600 * 1000;
const MIN_PASSWORD = 6;
const RANK = { guest: 0, starter: 1, plus: 2, premium: 3, admin: 4 };

/**
 * @param {object} deps
 * @param {ReturnType<import('./store.js').createStore>} deps.store
 * @param {object} deps.config
 * @param {(email: string) => void} [deps.onRequestAccess]
 * @param {(email: string, link: string) => void} [deps.onResetPassword]
 * @param {(email: string, link: string) => void} [deps.onWelcome]
 * @param {object} deps.limit
 */
export function createRoutes({ store, config, onRequestAccess, onResetPassword, onWelcome, limit }) {
  const cookieAttrs = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
    + (config.cookieSecure ? '; Secure' : '');

  function setSession(res, token) {
    const prev = res.getHeader('set-cookie');
    const cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${cookieAttrs}`;
    res.setHeader('set-cookie', prev ? [].concat(prev, cookie) : cookie);
  }

  function clearSession(res) {
    res.setHeader('set-cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
      + (config.cookieSecure ? '; Secure' : ''));
  }

  function startSession(req, res, uid) {
    const token = randomToken();
    store.createSession({
      tokenHash: sha256(token),
      uid,
      ttlMs: SESSION_TTL_MS,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
      ip: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').slice(0, 100),
    });
    setSession(res, token);
  }

  function currentUser(req) {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!token) return null;
    const session = store.getSession(sha256(token));
    if (!session) return null;
    return store.findUserById(session.uid);
  }

  function requireUser(req) {
    const user = currentUser(req);
    if (!user) throw unauthorized();
    return user;
  }

  function requireAdmin(req) {
    const user = requireUser(req);
    if (user.access_level !== 'admin' && !config.adminEmails.includes(user.email.toLowerCase())) {
      throw forbidden();
    }
    return user;
  }

  /** Ответ пользователю — без хэша пароля, путь к нему один. */
  function sessionPayload(user) {
    return {
      user: store.publicUser(user),
      accessLevel: user.access_level,
      isAdult: user.is_adult === 1
        || RANK[user.access_level] >= RANK.plus,
      legacyAuth: user.legacy_auth === 1,
    };
  }

  function checkPassword(password) {
    if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
      throw badRequest(`Слишком короткий пароль (минимум ${MIN_PASSWORD} символов)`);
    }
  }

  function resetLink(token) {
    return `${config.publicUrl}/api/auth/reset?token=${encodeURIComponent(token)}`;
  }

  return async function route(req, res, url) {
    const method = req.method || 'GET';
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const is = (m, p) => method === m && path === p;

    /* ---------- служебное ---------- */

    if (is('GET', '/api/health')) {
      res.setHeader('cache-control', 'no-store');
      return { status: 200, body: { ok: true, users: store.userCount(), time: Date.now() } };
    }

    /* ---------- аккаунт ---------- */

    if (is('GET', '/api/auth/session')) {
      const user = currentUser(req);
      return { status: 200, body: user ? sessionPayload(user) : { user: null, accessLevel: 'guest' } };
    }

    if (is('POST', '/api/auth/register')) {
      if (!limit('register')(req)) throw new HttpError(429, 'Слишком много попыток, попробуйте позже');
      const body = await readJson(req);
      const email = String(body.email || '').trim();
      checkPassword(body.password);
      if (!email.includes('@')) throw badRequest('Некорректный email');
      if (body.isAdult !== true) throw badRequest('Регистрация только для 18+');
      let user;
      try {
        user = store.createUser({ email, password: body.password, isAdult: true });
      } catch (err) {
        if (err.code === 'email-in-use') throw new HttpError(409, err.message, 'auth/email-already-in-use');
        throw err;
      }
      startSession(req, res, user.uid);
      return { status: 201, body: sessionPayload(user) };
    }

    if (is('POST', '/api/auth/login')) {
      if (!limit('login')(req)) throw new HttpError(429, 'Слишком много попыток, попробуйте позже');
      const body = await readJson(req);
      const email = String(body.email || '').trim();
      const result = store.authenticate(email, body.password);
      if (!result.ok) {
        if (result.reason === 'password-not-set') {
          // Аккаунт перенесён из Firebase: пароля на сервере ещё нет.
          const tok = randomToken();
          store.createAuthToken({ tokenHash: sha256(tok), uid: result.user.uid, kind: 'welcome', ttlMs: WELCOME_TTL_MS });
          if (onWelcome) onWelcome(result.user.email, resetLink(tok));
          throw new HttpError(409,
            'Аккаунт перенесён. На вашу почту отправлена ссылка для установки нового пароля.',
            'auth/password-not-set');
        }
        throw new HttpError(401, 'Неверный email или пароль', 'auth/wrong-password');
      }
      startSession(req, res, result.user.uid);
      return { status: 200, body: sessionPayload(result.user) };
    }

    if (is('POST', '/api/auth/logout')) {
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
      if (token) store.dropSession(sha256(token));
      clearSession(res);
      return { status: 200, body: { ok: true } };
    }

    if (is('POST', '/api/auth/password/forgot')) {
      if (!limit('forgot')(req)) throw new HttpError(429, 'Слишком много попыток, попробуйте позже');
      const body = await readJson(req);
      const email = String(body.email || '').trim();
      const user = store.findUserByEmail(email);
      // Ответ одинаковый, есть такой адрес или нет: иначе сервис подсказывает,
      // кто зарегистрирован.
      if (user && onResetPassword) {
        const tok = randomToken();
        store.createAuthToken({ tokenHash: sha256(tok), uid: user.uid, kind: 'reset', ttlMs: RESET_TTL_MS });
        onResetPassword(user.email, resetLink(tok));
      }
      return { status: 200, body: { ok: true, message: 'Если почта зарегистрирована, письмо отправлено' } };
    }

    if (is('POST', '/api/auth/password/set')) {
      if (!limit('set-password')(req)) throw new HttpError(429, 'Слишком много попыток, попробуйте позже');
      const body = await readJson(req);
      checkPassword(body.password);
      const row = store.takeAuthToken(sha256(String(body.token || '')), body.kind === 'welcome' ? 'welcome' : 'reset');
      if (!row) throw badRequest('Ссылка недействительна или устарела');
      store.setPassword(row.uid, body.password);
      store.dropUserSessions(row.uid);
      const user = store.findUserById(row.uid);
      startSession(req, res, user.uid);
      return { status: 200, body: sessionPayload(user) };
    }

    /* ---------- ссылка из письма ---------- */

    if (is('GET', '/api/auth/reset')) {
      const token = String(url.searchParams.get('token') || '');
      // Проверяем токен, но не тратим: он одноразовый и нужен для отправки
      // нового пароля. Иначе перезагрузка страницы ломала бы ссылку.
      const tokenRow = token ? store.findAuthToken(sha256(token)) : null;
      if (!tokenRow) {
        res.writeHead(400, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        res.end(resetPageHtml({ ok: false, message: 'Ссылка недействительна или устарела. Запросите новую на странице входа.' }));
        return null;
      }
      const appUrl = `${config.publicUrl}/?cop_reset_token=${encodeURIComponent(token)}&cop_reset_kind=${tokenRow.kind}`;
      res.writeHead(302, { location: appUrl, 'cache-control': 'no-store' });
      res.end();
      return null;
    }

    /* ---------- реестр игр ---------- */

    if (is('GET', '/api/games')) {
      return { status: 200, body: { groups: store.gamesByGroup(), allGroups: store.allGroups() } };
    }

    /* ---------- профиль ---------- */

    if (is('GET', '/api/me')) {
      const user = requireUser(req);
      return { status: 200, body: sessionPayload(user) };
    }

    if (is('PATCH', '/api/me')) {
      const user = requireUser(req);
      const body = await readJson(req);
      let row = user;
      if (body.profile && typeof body.profile === 'object') {
        row = store.saveProfile(user.uid, body.profile);
      }
      if (body.defaults && typeof body.defaults === 'object') {
        row = store.markDefaults(user.uid, {
          displayName: body.defaults.displayName,
          emailVerified: !!body.defaults.emailVerified,
        });
      }
      return { status: 200, body: sessionPayload(row) };
    }

    if (is('GET', '/api/me/state')) {
      const user = requireUser(req);
      return { status: 200, body: { state: store.getAppState(user.uid) } };
    }

    if (is('PUT', '/api/me/state')) {
      const user = requireUser(req);
      const body = await readJson(req, 1024 * 1024);
      const state = store.saveAppState(user.uid, asObject(body.state ?? body));
      return { status: 200, body: { ok: true, keys: Object.keys(state).length } };
    }

    if (is('POST', '/api/stats/push')) {
      const user = requireUser(req);
      const body = await readJson(req, 512 * 1024);
      const stats = store.saveGameStats(user.uid, asObject(body.gameStats ?? body));
      return { status: 200, body: { ok: true, totalGames: stats.totalGames || 0 } };
    }

    /* ---------- статистика (админ) ---------- */

    if (is('GET', '/api/admin/stats/users')) {
      requireAdmin(req);
      const docs = store.allStats().map((row) => {
        try { return JSON.parse(row.doc); } catch { return {}; }
      });
      return { status: 200, body: aggregateUserStats(docs) };
    }

    if (is('GET', '/api/admin/stats/general')) {
      requireAdmin(req);
      return { status: 200, body: aggregateGeneral(store.listUsers()) };
    }

    if (is('GET', '/api/admin/users')) {
      requireAdmin(req);
      return { status: 200, body: { users: store.listUsers().map((u) => store.publicUser(u)) } };
    }

    if (method === 'PATCH' && path.startsWith('/api/admin/users/')) {
      requireAdmin(req);
      const uid = decodeURIComponent(path.slice('/api/admin/users/'.length));
      const body = await readJson(req);
      if (!store.findUserById(uid)) throw notFound('Пользователь не найден');
      try {
        const row = store.setAccessLevel(uid, body.accessLevel);
        return { status: 200, body: { user: store.publicUser(row) } };
      } catch (err) {
        throw badRequest(err.message);
      }
    }

    if (is('GET', '/api/admin/requests')) {
      requireAdmin(req);
      return { status: 200, body: { requests: store.listRequests() } };
    }

    /* ---------- заявки ---------- */

    if (is('POST', '/api/access-requests')) {
      const user = requireUser(req);
      if (!limit('access-request')(req)) throw new HttpError(429, 'Слишком много заявок');
      const body = await readJson(req);
      try {
        const result = store.createRequest({
          uid: user.uid,
          email: body.email || user.email,
          comment: String(body.comment || '').slice(0, 1000),
        });
        if (onRequestAccess) onRequestAccess(user.email);
        return { status: 201, body: result };
      } catch (err) {
        if (err.code === 'too-many-requests') throw new HttpError(429, err.message);
        throw err;
      }
    }

    throw notFound(`Нет маршрута ${method} ${path}`);
  };
}

/** Суммирование gameStats по всем пользователям — то, что сейчас считается в браузере. */
function resetPageHtml({ ok, message }) {
  const body = ok
    ? '<p>Переходим в приложение…</p>'
    : `<p>${message}</p><p><a href="${'/'.replace('/', '/')}">Открыть приложение</a></p>`;
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<title>«Давай играй»: пароль</title>`
    + `<style>body{font-family:-apple-system,"Segoe UI",Arial,sans-serif;background:#f6f1f7;`
    + `color:#2b0f2e;padding:32px 20px;max-width:520px;margin:0 auto;line-height:1.5}`
    + `a{color:#6a2c7d}</style></head><body><h1>Смена пароля</h1>${body}</body></html>`;
}

export function aggregateUserStats(docs) {
  let totalGames = 0, finishedGames = 0, totalMs = 0, totalDays = 0, devices = 0, usersWithStats = 0;
  const games = {};
  const exits = { setup: 0, midgame: 0 };
  for (const gs of docs) {
    if (!gs || typeof gs !== 'object') continue;
    usersWithStats += 1;
    totalGames += Number(gs.totalGames) || 0;
    totalDays += Array.isArray(gs.days) ? gs.days.length : (Number(gs.days) || 0);
    devices += Number(gs.deviceCount) || 0;
    if (gs.exits && typeof gs.exits === 'object') {
      exits.setup += Number(gs.exits.setup) || 0;
      exits.midgame += Number(gs.exits.midgame) || 0;
    }
    for (const [mode, r] of Object.entries(gs.games || {})) {
      if (!games[mode]) games[mode] = { started: 0, finished: 0, totalMs: 0 };
      games[mode].started += Number(r?.started) || 0;
      games[mode].finished += Number(r?.finished) || 0;
      games[mode].totalMs += Number(r?.totalMs) || 0;
    }
  }
  for (const r of Object.values(games)) {
    finishedGames += r.finished;
    totalMs += r.totalMs;
  }
  return {
    users: usersWithStats,
    totalGames,
    finishedGames,
    totalDays,
    devices,
    exits,
    totalMs,
    games: Object.entries(games)
      .map(([mode, r]) => ({ mode, ...r, avgMs: r.started ? Math.round(r.totalMs / r.started) : 0 }))
      .sort((a, b) => b.started - a.started),
  };
}

export function aggregateGeneral(users, now = Date.now()) {
  const day = 24 * 3600 * 1000;
  const levels = Object.fromEntries(LEVELS.map((l) => [l, 0]));
  let new1 = 0, new7 = 0, new30 = 0, active = 0, withName = 0, male = 0, female = 0;
  for (const u of users) {
    if (u.created_at) {
      if (u.created_at >= now - day) new1 += 1;
      if (u.created_at >= now - 7 * day) new7 += 1;
      if (u.created_at >= now - 30 * day) new30 += 1;
    }
    levels[u.access_level] = (levels[u.access_level] || 0) + 1;
    if (String(u.status || 'active').toLowerCase() === 'active') active += 1;
    if (u.name && String(u.name).trim()) withName += 1;
    if (u.gender === 'M') male += 1;
    if (u.gender === 'F') female += 1;
  }
  return {
    total: users.length,
    new24h: new1,
    new7d: new7,
    new30d: new30,
    avgPerDay30: Number((new30 / 30).toFixed(1)),
    levels,
    active,
    withName,
    male,
    female,
  };
}

export { SESSION_COOKIE, RANK };
