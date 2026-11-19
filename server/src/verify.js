/**
 * Сверка: сравнивает Firestore со своей базой по содержимому, а не по числу
 * строк. Нужна, чтобы «перенеслось N из N» означало совпадение, а не совпадение
 * количества при разном содержимом.
 *
 * Запуск:
 *   node src/verify.js            # из Firestore по ключу
 *   node src/verify.js --file dump.json
 */
import { openDb } from './db.js';
import { loadConfig } from './config.js';
import { loadFromFirestore, loadFromFile } from './migrate.js';
import { toUserRow, toGameRow, toGroupRow } from './firestore.js';
import { normalizeLevel } from './model.js';

/**
 * @returns {{ok:boolean, diffs:object[], summary:object}}
 */
export function verify({ db, load }) {
  return load().then((raw) => {
    const diffs = [];
    const summary = { users: 0, games: 0, groups: 0, checked: { users: 0, games: 0, groups: 0 } };

    for (const doc of raw.users || []) {
      summary.checked.users += 1;
      const want = toUserRow(doc);
      if (!want) continue;
      const got = db.prepare('SELECT * FROM users WHERE uid = ?').get(want.uid);
      if (!got) {
        diffs.push({ kind: 'user', uid: want.uid, field: 'missing', want: want.email, got: null });
        continue;
      }
      summary.users += 1;
      const pairs = [
        ['email', want.email, got.email],
        ['name', want.name || null, got.name || null],
        ['gender', want.gender || null, got.gender || null],
        ['age', want.age || null, got.age || null],
        ['accessLevel', normalizeLevel(want.access_level), normalizeLevel(got.access_level)],
        ['isAdult', want.is_adult === 1, got.is_adult === 1],
        ['status', want.status || 'active', got.status || 'active'],
      ];
      for (const [field, a, b] of pairs) {
        if (String(a) !== String(b)) {
          diffs.push({ kind: 'user', uid: want.uid, field, want: a, got: b });
        }
      }
      if (want.game_stats) {
        const stats = db.prepare('SELECT doc FROM user_game_stats WHERE uid = ?').get(want.uid);
        if (!stats) {
          diffs.push({ kind: 'user', uid: want.uid, field: 'gameStats', want: 'есть', got: 'нет' });
        } else {
          const stored = JSON.parse(stats.doc);
          const wantGames = Number(want.game_stats.totalGames) || 0;
          const gotGames = Number(stored.totalGames) || 0;
          if (wantGames !== gotGames) {
            diffs.push({ kind: 'user', uid: want.uid, field: 'totalGames', want: wantGames, got: gotGames });
          }
        }
      }
    }

    for (const doc of raw.games || []) {
      summary.checked.games += 1;
      const want = toGameRow(doc);
      const got = db.prepare('SELECT * FROM games WHERE id = ?').get(want.id);
      if (!got) {
        diffs.push({ kind: 'game', id: want.id, field: 'missing' });
        continue;
      }
      summary.games += 1;
      if ((got.enabled === 1) !== (want.enabled === 1)) {
        diffs.push({ kind: 'game', id: want.id, field: 'enabled', want: want.enabled, got: got.enabled });
      }
      if (normalizeLevel(got.access_level) !== normalizeLevel(want.access_level)) {
        diffs.push({
          kind: 'game', id: want.id, field: 'accessLevel',
          want: want.access_level, got: got.access_level,
        });
      }
    }

    for (const doc of raw.groups || []) {
      summary.checked.groups += 1;
      const want = toGroupRow(doc);
      const got = db.prepare('SELECT * FROM game_groups WHERE id = ?').get(want.id);
      if (!got) {
        diffs.push({ kind: 'group', id: want.id, field: 'missing' });
        continue;
      }
      summary.groups += 1;
    }

    return { ok: diffs.length === 0, diffs, summary };
  });
}

const isMain = process.argv[1] && /verify\.js$/.test(process.argv[1]);
if (isMain) {
  const args = process.argv.slice(2);
  const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;
  const config = loadConfig();
  const db = openDb(config.dbFile);
  const load = fileArg ? () => loadFromFile(fileArg) : () => loadFromFirestore(config);
  verify({ db, load }).then((res) => {
    console.log(`Проверено: ${res.summary.checked.users} пользователей, `
      + `${res.summary.checked.games} игр, ${res.summary.checked.groups} групп.`);
    if (res.ok) {
      console.log('Расхождений нет.');
      process.exit(0);
    }
    console.log(`Расхождений: ${res.diffs.length}`);
    for (const d of res.diffs.slice(0, 50)) console.log(' •', JSON.stringify(d));
    if (res.diffs.length > 50) console.log(` … и ещё ${res.diffs.length - 50}`);
    process.exit(2);
  }).catch((err) => {
    console.error('Сверка не удалась:', err.message);
    process.exit(1);
  });
}
