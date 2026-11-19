import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

/**
 * Открывает базу и доводит схему до последней версии.
 * @param {string} file путь к файлу базы или ':memory:'
 */
export function openDb(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  migrate(db);
  return db;
}

export function migrate(db) {
  const applied = db.prepare('PRAGMA user_version').get().user_version;
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();
  for (const file of files) {
    const version = Number(file.slice(0, 3));
    if (version <= applied) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${version}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`Миграция ${file} не применилась: ${err.message}`);
    }
  }
  return db.prepare('PRAGMA user_version').get().user_version;
}

export function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
