/**
 * Хранилище: все чтения и записи базы в одном месте.
 * Клиент после переезда не должен знать, Firestore под ним или SQLite,
 * поэтому API повторяет то, что клиент умел делать с Firestore.
 */
import { randomId, hashPassword, verifyPassword } from './auth.js';
import { mergeGameStats, normalizeLevel, userToApi, gameToApi } from './model.js';

const LEVELS = ['guest', 'starter', 'plus', 'premium', 'admin'];
const isAdminRow = (row) => !!row && row.access_level === 'admin';

export function createStore(db, { adminEmails = [] } = {}) {
  const adminSet = new Set(adminEmails.map((e) => String(e).toLowerCase().trim()).filter(Boolean));

  const q = {
    userById: db.prepare('SELECT * FROM users WHERE uid = ?'),
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE'),
    insertUser: db.prepare(`INSERT INTO users
      (uid, email, password_hash, display_name, name, gender, age, role, access_level,
       is_adult, status, email_verified, created_at, updated_at, legacy_auth)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    updateLevel: db.prepare('UPDATE users SET access_level = ?, updated_at = ? WHERE uid = ?'),
    updateProfile: db.prepare(`UPDATE users
      SET name = COALESCE(?, name), gender = COALESCE(?, gender), age = COALESCE(?, age),
          updated_at = ?
      WHERE uid = ?`),
    updateDefaults: db.prepare(`UPDATE users
      SET display_name = COALESCE(display_name, ?), email_verified = CASE WHEN ? = 1 THEN 1 ELSE email_verified END,
          updated_at = ?
      WHERE uid = ?`),
    setPassword: db.prepare('UPDATE users SET password_hash = ?, legacy_auth = 0, updated_at = ? WHERE uid = ?'),
    listUsers: db.prepare('SELECT * FROM users ORDER BY email COLLATE NOCASE'),
    countUsers: db.prepare('SELECT COUNT(*) AS n FROM users'),
    statsSince: db.prepare('SELECT created_at FROM users WHERE created_at IS NOT NULL'),

    appState: db.prepare('SELECT doc FROM user_app_state WHERE uid = ?'),
    putAppState: db.prepare(`INSERT INTO user_app_state (uid, doc, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(uid) DO UPDATE SET doc = excluded.doc, updated_at = excluded.updated_at`),

    stats: db.prepare('SELECT doc FROM user_game_stats WHERE uid = ?'),
    putStats: db.prepare(`INSERT INTO user_game_stats (uid, doc, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(uid) DO UPDATE SET doc = excluded.doc, updated_at = excluded.updated_at`),
    allStats: db.prepare('SELECT uid, doc FROM user_game_stats'),

    enabledGames: db.prepare('SELECT * FROM games WHERE enabled = 1'),
    allGames: db.prepare('SELECT * FROM games ORDER BY sort_order IS NULL, sort_order, id'),
    upsertGame: db.prepare(`INSERT INTO games
      (id, title, group_slug, game_key, enabled, access_level, age_rating, sort_order, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title, group_slug = excluded.group_slug, game_key = excluded.game_key,
        enabled = excluded.enabled, access_level = excluded.access_level,
        age_rating = excluded.age_rating, sort_order = excluded.sort_order,
        updated_at = excluded.updated_at`),

    allGroups: db.prepare('SELECT * FROM game_groups ORDER BY sort_order IS NULL, sort_order, id'),
    upsertGroup: db.prepare(`INSERT INTO game_groups (id, title, slug, enabled, sort_order, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title, slug = excluded.slug, enabled = excluded.enabled,
        sort_order = excluded.sort_order, updated_at = excluded.updated_at`),

    listRequests: db.prepare('SELECT * FROM access_requests ORDER BY created_at DESC LIMIT 200'),
    insertRequest: db.prepare(`INSERT INTO access_requests
      (id, uid, email, comment, status, created_at) VALUES (?, ?, ?, ?, 'new', ?)`),
    countRecentRequests: db.prepare(
      'SELECT COUNT(*) AS n FROM access_requests WHERE email = ? AND created_at > ?'),

    insertSession: db.prepare(`INSERT INTO sessions
      (token_hash, uid, created_at, expires_at, user_agent, ip) VALUES (?, ?, ?, ?, ?, ?)`),
    sessionByHash: db.prepare('SELECT * FROM sessions WHERE token_hash = ?'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    deleteUserSessions: db.prepare('DELETE FROM sessions WHERE uid = ?'),
    purgeExpiredSessions: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),

    insertToken: db.prepare(`INSERT INTO auth_tokens
      (token_hash, uid, kind, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`),
    tokenByHash: db.prepare('SELECT * FROM auth_tokens WHERE token_hash = ?'),
    consumeToken: db.prepare('UPDATE auth_tokens SET used_at = ? WHERE token_hash = ?'),

    insertImport: db.prepare(
      'INSERT INTO import_runs (source, started_at, report) VALUES (?, ?, ?)'),
    finishImport: db.prepare('UPDATE import_runs SET finished_at = ?, report = ? WHERE id = ?'),
  };

  const now = () => Date.now();

  const store = {
    raw: db,

    findUserById(uid) {
      return q.userById.get(String(uid)) || null;
    },

    findUserByEmail(email) {
      return q.userByEmail.get(String(email).trim()) || null;
    },

    /**
     * Создание пользователя. Уровень доступа задаёт сервер: админ — по белому
     * списку почт, остальные получают starter. Клиент это значение не присылает.
     */
    createUser({ email, password, isAdult = false, role = 'user', legacyAuth = false, uid = randomId() }) {
      const cleanEmail = String(email || '').trim();
      if (!cleanEmail.includes('@')) throw new Error('Некорректный email');
      if (store.findUserByEmail(cleanEmail)) {
        const err = new Error('Email уже используется');
        err.code = 'email-in-use';
        throw err;
      }
      const level = adminSet.has(cleanEmail.toLowerCase()) ? 'admin' : 'starter';
      const ts = now();
      q.insertUser.run(
        uid, cleanEmail,
        password ? hashPassword(password) : null,
        cleanEmail.split('@')[0], null, null, null,
        role, level, isAdult ? 1 : 0, 'active',
        legacyAuth ? 0 : 1, ts, ts, legacyAuth ? 1 : 0,
      );
      return store.findUserById(uid);
    },

    /** Проверка входа: пароль или перенесённый аккаунт без пароля. */
    authenticate(email, password) {
      const row = store.findUserByEmail(email);
      if (!row) return { ok: false, reason: 'not-found' };
      if (!row.password_hash) return { ok: false, reason: 'password-not-set', user: row };
      return verifyPassword(password, row.password_hash)
        ? { ok: true, user: row }
        : { ok: false, reason: 'wrong-password' };
    },

    setPassword(uid, password) {
      q.setPassword.run(hashPassword(password), now(), String(uid));
    },

    setAccessLevel(uid, level) {
      const clean = String(level || '').toLowerCase().trim();
      if (!LEVELS.includes(clean)) throw new Error('Неизвестный уровень доступа');
      // Гостя нельзя выдать в аккаунте: это уровень «без аккаунта».
      if (clean === 'guest') throw new Error('Гость — это отсутствие аккаунта, а не уровень');
      q.updateLevel.run(clean, now(), String(uid));
      return store.findUserById(uid);
    },

    saveProfile(uid, { name, gender, age }) {
      q.updateProfile.run(
        name || null,
        gender === 'M' || gender === 'F' ? gender : null,
        Number.isFinite(Number(age)) ? Number(age) : null,
        now(), String(uid),
      );
      return store.findUserById(uid);
    },

    markDefaults(uid, { displayName, emailVerified }) {
      q.updateDefaults.run(displayName || null, emailVerified ? 1 : 0, now(), String(uid));
      return store.findUserById(uid);
    },

    listUsers() {
      return q.listUsers.all();
    },

    userCount() {
      return q.countUsers.get().n;
    },

    /** Публичный вид пользователя для клиента — без хэша пароля. */
    publicUser(row) {
      return userToApi(row);
    },

    getAppState(uid) {
      const row = q.appState.get(String(uid));
      if (!row) return null;
      try { return JSON.parse(row.doc); } catch { return null; }
    },

    /** set(..., merge: true): вложенные объекты сливаются, остальное заменяется. */
    saveAppState(uid, patch) {
      const prev = store.getAppState(uid) || {};
      const next = mergeGameStats(prev, patch && typeof patch === 'object' ? patch : {});
      q.putAppState.run(String(uid), JSON.stringify(next), now());
      return next;
    },

    getGameStats(uid) {
      const row = q.stats.get(String(uid));
      if (!row) return null;
      try { return JSON.parse(row.doc); } catch { return null; }
    },

    saveGameStats(uid, patch) {
      const prev = store.getGameStats(uid) || {};
      const next = mergeGameStats(prev, patch && typeof patch === 'object' ? patch : {});
      q.putStats.run(String(uid), JSON.stringify(next), now());
      return next;
    },

    enabledGames() {
      return q.enabledGames.all();
    },

    allGames() {
      return q.allGames.all();
    },

    upsertGame(row) {
      q.upsertGame.run(
        row.id, row.title ?? null, row.group_slug ?? null, row.game_key ?? null,
        row.enabled ? 1 : 0, normalizeLevel(row.access_level || 'guest'),
        row.age_rating || 'all', row.sort_order ?? null, row.updated_at ?? now(),
      );
    },

    gamesByGroup() {
      const byGroup = {};
      for (const row of store.enabledGames()) {
        if (!row.group_slug) continue;
        const game = gameToApi(row);
        (byGroup[row.group_slug] ||= []).push(game);
      }
      return byGroup;
    },

    allGroups() {
      return q.allGroups.all();
    },

    upsertGroup(row) {
      q.upsertGroup.run(
        row.id, row.title ?? null, row.slug ?? null, row.enabled ? 1 : 0,
        row.sort_order ?? null, row.updated_at ?? now(),
      );
    },

    listRequests() {
      return q.listRequests.all();
    },

    createRequest({ uid, email, comment }) {
      // Ограничение вместо открытого правила Firestore: одна почта не может
      // создать больше трёх заявок в сутки.
      const recent = q.countRecentRequests.get(String(email || ''), now() - 24 * 3600 * 1000).n;
      if (recent >= 3) {
        const err = new Error('Слишком много заявок с этой почты за сутки');
        err.code = 'too-many-requests';
        throw err;
      }
      const id = randomId();
      q.insertRequest.run(id, uid || null, email || null, comment || null, now());
      return { id };
    },

    /* ---------- сессии ---------- */

    createSession({ tokenHash, uid, ttlMs, userAgent, ip }) {
      const ts = now();
      q.insertSession.run(tokenHash, String(uid), ts, ts + ttlMs, userAgent || null, ip || null);
    },

    getSession(tokenHash) {
      const row = q.sessionByHash.get(String(tokenHash));
      if (!row) return null;
      if (row.expires_at < now()) {
        q.deleteSession.run(String(tokenHash));
        return null;
      }
      return row;
    },

    dropSession(tokenHash) {
      q.deleteSession.run(String(tokenHash));
    },

    dropUserSessions(uid) {
      q.deleteUserSessions.run(String(uid));
    },

    purgeSessions() {
      q.purgeExpiredSessions.run(now());
    },

    /* ---------- одноразовые токены ---------- */

    createAuthToken({ tokenHash, uid, kind, ttlMs }) {
      const ts = now();
      q.insertToken.run(tokenHash, String(uid), kind, ts, ts + ttlMs);
    },

    takeAuthToken(tokenHash, kind) {
      const row = q.tokenByHash.get(String(tokenHash));
      if (!row || row.used_at) return null;
      if (row.kind !== kind) return null;
      if (row.expires_at < now()) return null;
      q.consumeToken.run(now(), String(tokenHash));
      return row;
    },

    /* ---------- перенос ---------- */

    startImport(source) {
      const info = q.insertImport.run(source, now(), '{}');
      return Number(info.lastInsertRowid);
    },

    finishImport(id, report) {
      q.finishImport.run(now(), JSON.stringify(report), Number(id));
    },
  };

  return store;
}

export { LEVELS, isAdminRow };
