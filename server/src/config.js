import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfigFile } from './index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

/**
 * Конфигурация из окружения с умолчаниями. Секретов в коде нет:
 * пароль SMTP и прочее приходят только через переменные окружения
 * (systemd EnvironmentFile или файл .env на сервере).
 */
export function loadConfig(env = process.env) {
  const fromFirebase = readFirebaseConfig(env.FIREBASE_CONFIG_PATH || join(ROOT, 'firebase-config.js'));
  const adminEmails = String(env.ADMIN_EMAILS || fromFirebase.adminHints || '79042044926@ya.ru')
    .split(',').map((e) => e.toLowerCase().trim()).filter(Boolean);

  return {
    host: env.HOST || '127.0.0.1',
    port: Number(env.PORT || 8080),
    publicUrl: (env.PUBLIC_URL || '').replace(/\/+$/, '') || `http://localhost:${env.PORT || 8080}`,
    dbFile: env.DB_FILE || join(HERE, '..', 'data', 'come-on-play.db'),
    cookieSecure: env.COOKIE_SECURE !== '0',
    debug: env.DEBUG === '1',
    rateLimitPerMinute: Number(env.RATE_LIMIT_PER_MINUTE || 30),
    adminEmails,
    firebase: {
      projectId: env.FIREBASE_PROJECT_ID || fromFirebase.projectId || '',
      apiKey: env.FIREBASE_API_KEY || fromFirebase.apiKey || '',
    },
    mail: {
      host: env.SMTP_HOST || '',
      port: Number(env.SMTP_PORT || 587),
      secure: env.SMTP_SECURE === '1',
      user: env.SMTP_USER || '',
      pass: env.SMTP_PASS || '',
      from: env.MAIL_FROM || 'no-reply@localhost',
    },
  };
}

/**
 * Читает firebase-config.js как данные, а не как код: ключ веб-приложения
 * публичен (он и так лежит в статике), но выполнять чужой JS ради него нельзя.
 */
export function readFirebaseConfig(path) {
  if (!existsSync(path)) return {};
  const cfg = readConfigFile(path);
  return {
    projectId: cfg.projectId || '',
    apiKey: cfg.apiKey || '',
    adminHints: '',
  };
}
