-- Схема бэкенда «Давай играй».
-- Имена полей повторяют документы Firestore, чтобы перенос был копированием,
-- а не переписыванием. Миграция версии: PRAGMA user_version.

CREATE TABLE IF NOT EXISTS users (
  uid            TEXT PRIMARY KEY,             -- тот же идентификатор, что в Firebase
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash  TEXT,                         -- NULL, пока пароль не сменён после переезда
  display_name   TEXT,
  name           TEXT,
  gender         TEXT CHECK (gender IN ('M','F') OR gender IS NULL),
  age            INTEGER,
  role           TEXT NOT NULL DEFAULT 'user',
  access_level   TEXT NOT NULL DEFAULT 'starter'
                 CHECK (access_level IN ('guest','starter','plus','premium','admin')),
  is_adult       INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active',
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER,                      -- unix ms
  updated_at     INTEGER,
  legacy_auth    INTEGER NOT NULL DEFAULT 0    -- 1: аккаунт перенесён, пароль ещё от Firebase
);

CREATE INDEX IF NOT EXISTS idx_users_access_level ON users(access_level);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Личное состояние приложения. В Firestore это users/{uid}/app/state —
-- слияние set(..., merge: true) поверх документа, поэтому здесь тоже
-- json-патч по ключам верхнего уровня, а не перезапись целиком.
CREATE TABLE IF NOT EXISTS user_app_state (
  uid         TEXT PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
  doc         TEXT NOT NULL,                   -- JSON
  updated_at  INTEGER NOT NULL
);

-- gameStats из документа пользователя (личная статистика) вынесена в json-колонку,
-- потому что структура вложенная и меняется вместе с играми.
CREATE TABLE IF NOT EXISTS user_game_stats (
  uid         TEXT PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
  doc         TEXT NOT NULL,                   -- JSON: {totalGames, days[], devices, exits{}, games{}}
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  id            TEXT PRIMARY KEY,
  title         TEXT,
  group_slug    TEXT,
  game_key      TEXT,
  enabled       INTEGER NOT NULL DEFAULT 0,
  access_level  TEXT NOT NULL DEFAULT 'guest',
  age_rating    TEXT NOT NULL DEFAULT 'all',
  sort_order    INTEGER,
  updated_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_games_enabled ON games(enabled, group_slug);

CREATE TABLE IF NOT EXISTS game_groups (
  id          TEXT PRIMARY KEY,
  title       TEXT,
  slug        TEXT,
  enabled     INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER,
  updated_at  INTEGER
);

CREATE TABLE IF NOT EXISTS access_requests (
  id          TEXT PRIMARY KEY,
  uid         TEXT,
  email       TEXT,
  comment     TEXT,
  status      TEXT NOT NULL DEFAULT 'new',
  created_at  INTEGER NOT NULL,
  handled_by  TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,                -- sha256 от cookie, сам токен не храним
  uid         TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  user_agent  TEXT,
  ip          TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_uid ON sessions(uid);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Одноразовые токены: сброс пароля и приглашение установить пароль при переезде.
CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash  TEXT PRIMARY KEY,
  uid         TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('reset','verify','welcome')),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_uid ON auth_tokens(uid, kind);

-- Журнал переноса: сколько прочитано и записано по каждой коллекции.
CREATE TABLE IF NOT EXISTS import_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  source      TEXT NOT NULL,
  started_at  INTEGER NOT NULL,
  finished_at INTEGER,
  report      TEXT                              -- JSON
);

PRAGMA user_version = 1;
