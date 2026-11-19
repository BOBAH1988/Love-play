/**
 * Перенос данных из Firebase в свою базу.
 *
 * Источник — либо REST API Firestore (ключ веб-приложения из firebase-config.js),
 * либо заранее выгруженный JSON из консоли Firebase (gcloud firestore export
 * + конвертер, см. deploy/README.md). Второй путь нужен, если правила Firestore
 * не пускают чтение без пользователя.
 *
 * Запуск:
 *   node src/migrate-cli.js            # из Firestore по ключу
 *   node src/migrate-cli.js --file dump.json
 *   node src/migrate-cli.js --dry-run  # только отчёт, без записи
 */
import { readFileSync } from 'node:fs';
import { openDb, tx } from './db.js';
import { createStore } from './store.js';
import { loadConfig } from './config.js';
import {
  firestoreReader, toUserRow, toGameRow, toGroupRow, toRequestRow, docToObject,
} from './firestore.js';
import { mergeGameStats } from './model.js';

/**
 * @param {object} options
 * @param {import('node:sqlite').DatabaseSync} options.db
 * @param {() => Promise<{users: object[], games: object[], groups: object[], requests: object[]}>} options.load
 */
export function migrate({ db, load, dryRun = false, source = 'firestore', log = console.log }) {
  const store = createStore(db, {});
  return load().then((raw) => {
    const report = {
      users: { read: 0, written: 0, skipped: [] },
      games: { read: 0, written: 0 },
      groups: { read: 0, written: 0 },
      requests: { read: 0, written: 0 },
      stats: { users: 0 },
    };
    const runId = dryRun ? null : store.startImport(source);

    const apply = () => {
      for (const doc of raw.users || []) {
        report.users.read += 1;
        const row = toUserRow(doc);
        if (!row) {
          report.users.skipped.push(doc.name || '(без имени)');
          continue;
        }
        // Перенесённый пользователь: пароля нет, вход по письму.
        // legacy_auth = 1 — клиент покажет объяснение.
        const { game_stats: gameStats } = row;
        try {
          const existing = store.findUserById(row.uid);
          if (!existing) {
            store.raw.prepare(`INSERT INTO users
              (uid, email, password_hash, display_name, name, gender, age, role, access_level,
               is_adult, status, email_verified, created_at, updated_at, legacy_auth)
              VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`).run(
              row.uid, row.email, row.display_name, row.name, row.gender, row.age,
              row.role, row.access_level, row.is_adult, row.status,
              row.email_verified, row.created_at, row.updated_at,
            );
          }
        } catch (err) {
          if (!/UNIQUE/.test(err.message)) throw err;
          report.users.skipped.push(`${row.email} (email уже занят другим uid)`);
          continue;
        }
        report.users.written += 1;
        if (gameStats) {
          const prev = store.getGameStats(row.uid);
          store.raw.prepare(`INSERT INTO user_game_stats (uid, doc, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(uid) DO UPDATE SET doc = excluded.doc, updated_at = excluded.updated_at`)
            .run(row.uid, JSON.stringify(mergeGameStats(prev, gameStats)), Date.now());
          report.stats.users += 1;
        }
      }

      for (const doc of raw.games || []) {
        report.games.read += 1;
        store.upsertGame(toGameRow(doc));
        report.games.written += 1;
      }
      for (const doc of raw.groups || []) {
        report.groups.read += 1;
        store.upsertGroup(toGroupRow(doc));
        report.groups.written += 1;
      }
      for (const doc of raw.requests || []) {
        report.requests.read += 1;
        const row = toRequestRow(doc);
        try {
          store.raw.prepare(`INSERT OR IGNORE INTO access_requests
            (id, uid, email, comment, status, created_at, handled_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
            row.id, row.uid, row.email, row.comment, row.status, row.created_at, row.handled_by,
          );
          report.requests.written += 1;
        } catch (err) {
          log('заявка не перенесена:', row.id, err.message);
        }
      }
    };

    if (dryRun) apply();
    else tx(db, apply);

    if (runId) store.finishImport(runId, report);
    log(JSON.stringify(report, null, 2));
    return report;
  });
}

/** Загружает документы из Firestore REST API. */
export async function loadFromFirestore(config) {
  const reader = firestoreReader({ projectId: config.firebase.projectId, apiKey: config.firebase.apiKey });
  const [users, games, groups, requests] = await Promise.all([
    reader.listUsers(), reader.listGames(), reader.listGroups(), reader.listRequests(),
  ]);
  // Состояние приложения и gameStats лежат внутри документа пользователя,
  // поэтому отдельный проход не нужен: toUserRow берёт gameStats оттуда.
  return { users, games, groups, requests };
}

/**
 * Выгрузка из консоли Firebase — файл вида:
 *   { "users": [{ "id": "...", "data": {...}}, ...], "games": [...] }
 * Приводим к форме документов REST (name/fields), чтобы остальной код
 * работал одинаково.
 */
export function loadFromFile(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const toDoc = (coll, item) => {
    const id = item.id || item.name || item._id;
    const data = item.data || item.fields || item;
    const fields = {};
    for (const [k, v] of Object.entries(data)) fields[k] = toFirestoreValue(v);
    return { name: `projects/x/databases/(default)/documents/${coll}/${id}`, fields };
  };
  const coll = (key) => (raw[key] || []).map((item) => toDoc(key, item));
  return Promise.resolve({
    users: coll('users'),
    games: coll('games'),
    groups: coll('gameGroups'),
    requests: coll('accessRequests'),
  });
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object') {
    if (typeof v.toMillis === 'function') {
      return { timestampValue: new Date(v.toMillis()).toISOString() };
    }
    if ('_seconds' in v) return { timestampValue: new Date(v._seconds * 1000).toISOString() };
    return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFirestoreValue(x)])) } };
  }
  return { nullValue: null };
}

/* ---------- CLI ---------- */

const isMain = process.argv[1] && /migrate\.js$/.test(process.argv[1]);
if (isMain) {
  const args = process.argv.slice(2);
  const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;
  const dryRun = args.includes('--dry-run');
  const config = loadConfig();
  const db = openDb(config.dbFile);
  const load = fileArg ? () => loadFromFile(fileArg) : () => loadFromFirestore(config);
  migrate({ db, load, dryRun, source: fileArg ? `file:${fileArg}` : 'firestore' })
    .then((report) => {
      console.log(dryRun ? 'Пробный прогон: в базу ничего не записано.' : 'Перенос завершён.');
      if (report.users.skipped.length) {
        console.log('Пропущены пользователи (нет почты или конфликт):', report.users.skipped.join(', '));
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('Перенос не удался:', err.message);
      process.exit(1);
    });
}

export { docToObject };
