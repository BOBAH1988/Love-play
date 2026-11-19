import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/index.js';
import { hashPassword, verifyPassword } from '../src/auth.js';
import { mergeGameStats, normalizeLevel } from '../src/model.js';

let app;
let server;
let base;

function cookieFrom(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
  const first = (raw || []).find((c) => c && c.startsWith('cop_session=')) || '';
  return first.split(';')[0];
}

async function api(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, cookie: cookieFrom(res) };
}

before(async () => {
  app = createApp({
    config: {
      dbFile: ':memory:',
      publicUrl: 'https://example.test',
      cookieSecure: false,
      rateLimitPerMinute: 1000,
      adminEmails: ['admin@example.test'],
    },
  });
  // Перекрываем конфиг в приложении, потому что createApp читает его один раз.
  await new Promise((resolve) => {
    server = app.server.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
});

test('пароли хешируются и проверяются', () => {
  const stored = hashPassword('секрет123');
  assert.match(stored, /^scrypt\$/);
  assert.equal(verifyPassword('секрет123', stored), true);
  assert.equal(verifyPassword('другой', stored), false);
  assert.equal(verifyPassword('секрет123', null), false);
});

test('слияние статистики не затирает ранние счётчики', () => {
  const first = { totalGames: 5, games: { fants: { started: 5, finished: 4, totalMs: 100 } } };
  const next = { games: { fants: { started: 7 } } };
  const merged = mergeGameStats(first, next);
  assert.equal(merged.totalGames, 5);
  assert.equal(merged.games.fants.started, 7);
  assert.equal(merged.games.fants.finished, 4);
});

test('историческое значение уровня full считается премиумом', () => {
  assert.equal(normalizeLevel('full'), 'premium');
  assert.equal(normalizeLevel('ADMIN'), 'admin');
  assert.equal(normalizeLevel('мусор'), 'starter');
});

test('здоровье сервера отвечает', async () => {
  const res = await api('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.data.ok, true);
});

test('регистрация, сессия, уровень по умолчанию starter', async () => {
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { email: 'new@example.test', password: 'пароль123', isAdult: true },
  });
  assert.equal(reg.status, 201);
  assert.equal(reg.data.accessLevel, 'starter');
  assert.equal(reg.data.isAdult, true);

  const session = await api('/api/auth/session', { cookie: reg.cookie });
  assert.equal(session.data.user.email, 'new@example.test');
});

test('админ по белому списку получает admin', async () => {
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { email: 'admin@example.test', password: 'пароль123', isAdult: true },
  });
  assert.equal(reg.data.accessLevel, 'admin');
});

test('регистрация без 18+ отклоняется', async () => {
  const res = await api('/api/auth/register', {
    method: 'POST',
    body: { email: 'kid@example.test', password: 'пароль123' },
  });
  assert.equal(res.status, 400);
});

test('короткий пароль отклоняется', async () => {
  const res = await api('/api/auth/register', {
    method: 'POST',
    body: { email: 'short@example.test', password: '123', isAdult: true },
  });
  assert.equal(res.status, 400);
});

test('вход неверным паролем и повторная регистрация', async () => {
  const wrong = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'new@example.test', password: 'неверный' },
  });
  assert.equal(wrong.status, 401);

  const dup = await api('/api/auth/register', {
    method: 'POST',
    body: { email: 'new@example.test', password: 'пароль123', isAdult: true },
  });
  assert.equal(dup.status, 409);
});

test('уровень не выдаётся клиентом при регистрации', async () => {
  const res = await api('/api/auth/register', {
    method: 'POST',
    body: { email: 'sneaky@example.test', password: 'пароль123', isAdult: true, accessLevel: 'admin' },
  });
  assert.equal(res.data.accessLevel, 'starter');
});

test('состояние и статистика сохраняются и сливаются', async () => {
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'new@example.test', password: 'пароль123' },
  });
  const cookie = login.cookie;

  const put = await api('/api/me/state', {
    method: 'PUT', cookie, body: { state: { muted: false, score: { one: 1 } } },
  });
  assert.equal(put.status, 200);

  await api('/api/me/state', { method: 'PUT', cookie, body: { state: { score: { two: 2 } } } });
  const got = await api('/api/me/state', { cookie });
  assert.equal(got.data.state.muted, false);
  assert.equal(got.data.state.score.one, 1);
  assert.equal(got.data.state.score.two, 2);

  await api('/api/stats/push', { method: 'POST', cookie, body: { gameStats: { totalGames: 3 } } });
  await api('/api/stats/push', {
    method: 'POST', cookie, body: { gameStats: { games: { fants: { started: 1 } } } },
  });
  const multi = await api('/api/admin/stats/users', { cookie });
  assert.equal(multi.status, 403, 'обычный пользователь не читает чужую статистику');
});

test('админ видит агрегаты и меняет уровень', async () => {
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.test', password: 'пароль123' },
  });
  const cookie = login.cookie;

  const users = await api('/api/admin/users', { cookie });
  assert.equal(users.status, 200);
  const target = users.data.users.find((u) => u.email === 'new@example.test');
  assert.ok(target);

  const patch = await api(`/api/admin/users/${target.uid}`, {
    method: 'PATCH', cookie, body: { accessLevel: 'premium' },
  });
  assert.equal(patch.status, 200);
  assert.equal(patch.data.user.accessLevel, 'premium');

  const bad = await api(`/api/admin/users/${target.uid}`, {
    method: 'PATCH', cookie, body: { accessLevel: 'root' },
  });
  assert.equal(bad.status, 400);

  const stats = await api('/api/admin/stats/general', { cookie });
  assert.equal(stats.status, 200);
  assert.ok(stats.data.total >= 3);
});

test('игра без авторизации может только читать реестр и заявки не спамит', async () => {
  const games = await api('/api/games');
  assert.equal(games.status, 200);

  const anon = await api('/api/access-requests', { method: 'POST', body: { email: 'x@y.z' } });
  assert.equal(anon.status, 401);
});

test('сброс пароля по ссылке', async () => {
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'new@example.test', password: 'пароль123' },
  });
  const forgot = await api('/api/auth/password/forgot', {
    method: 'POST', body: { email: 'new@example.test' },
  });
  assert.equal(forgot.status, 200);

  // Токен берём из почты в dry-run режиме: письмо пишется в лог.
  const token = lastResetToken();
  assert.ok(token, 'ссылка на сброс должна появиться');

  const set = await api('/api/auth/password/set', {
    method: 'POST', body: { password: 'новыйпароль', token },
  });
  assert.equal(set.status, 200);

  const oldLogin = await api('/api/auth/login', {
    method: 'POST', body: { email: 'new@example.test', password: 'пароль123' },
  });
  assert.equal(oldLogin.status, 401, 'старая сессия и пароль отозваны');

  const newLogin = await api('/api/auth/login', {
    method: 'POST', body: { email: 'new@example.test', password: 'новыйпароль' },
  });
  assert.equal(newLogin.status, 200);

  const reuse = await api('/api/auth/password/set', {
    method: 'POST', body: { password: 'ещёпароль', token },
  });
  assert.equal(reuse.status, 400, 'токен одноразовый');
});

test('перенесённый аккаунт без пароля приглашает установить новый', async () => {
  app.store.raw.prepare(`INSERT INTO users
    (uid, email, password_hash, display_name, role, access_level, is_adult, status,
     email_verified, created_at, updated_at, legacy_auth)
    VALUES ('legacy-1', 'old@example.test', NULL, 'old', 'user', 'premium', 1, 'active', 0, ?, ?, 1)`)
    .run(Date.now(), Date.now());

  const res = await api('/api/auth/login', {
    method: 'POST', body: { email: 'old@example.test', password: 'любой' },
  });
  assert.equal(res.status, 409);
  assert.equal(res.data.code, 'auth/password-not-set');
});

test('выход завершает сессию', async () => {
  const login = await api('/api/auth/login', {
    method: 'POST', body: { email: 'admin@example.test', password: 'пароль123' },
  });
  const out = await api('/api/auth/logout', { method: 'POST', cookie: login.cookie });
  assert.equal(out.status, 200);
  const session = await api('/api/auth/session', { cookie: login.cookie });
  assert.equal(session.data.user, null);
});

/* ловим токен из dry-run письма */
let captureToken = null;
const origLog = console.log;
console.log = (...args) => {
  const line = args.join(' ');
  const m = line.match(/token=([A-Za-z0-9_-]+)/);
  if (m) captureToken = m[1];
  origLog(...args);
};
function lastResetToken() { return captureToken; }

test('ссылка из письма открывается повторно, пока пароль не установлен', async () => {
  await api('/api/auth/register', {
    method: 'POST', body: { email: 'link@example.test', password: 'пароль123', isAdult: true },
  });
  await api('/api/auth/password/forgot', { method: 'POST', body: { email: 'link@example.test' } });
  const token = lastResetToken();
  assert.ok(token);

  const viaHttp = async (path) => {
    const res = await fetch(base + path, { redirect: 'manual' });
    return { status: res.status, location: res.headers.get('location') };
  };

  const first = await viaHttp('/api/auth/reset?token=' + token);
  assert.equal(first.status, 302);
  assert.match(first.location, /cop_reset_token=/);

  // Повторное открытие ссылки не расходует токен: иначе перезагрузка ломала бы вход.
  const second = await viaHttp('/api/auth/reset?token=' + token);
  assert.equal(second.status, 302);

  const broken = await viaHttp('/api/auth/reset?token=неверный');
  assert.equal(broken.status, 400);
});
