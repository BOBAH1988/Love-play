import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { createStore } from './store.js';
import { createRoutes } from './routes.js';
import { createLimiter, sweepLimiter } from './ratelimit.js';
import { HttpError } from './http.js';
import { loadConfig } from './config.js';
import { makeMailer } from './mailer.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..'); // корень проекта «Давай играй»

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Сборка приложения без зависимостей: http-сервер, API, статика.
 * Фреймворка нет намеренно: меньше того, что надо обновлять на своём сервере.
 */
export function createApp(overrides = {}) {
  const config = { ...loadConfig(), ...overrides.config };
  const db = overrides.db || openDb(config.dbFile);
  const store = createStore(db, { adminEmails: config.adminEmails });
  const mailer = overrides.mailer || makeMailer(config);
  const limiter = createLimiter({ windowMs: 60_000, max: config.rateLimitPerMinute });
  const bucketStore = limiter.store;

  const route = createRoutes({
    store,
    config,
    limit: limiter,
    onResetPassword: (email, link) => mailer.sendPasswordReset(email, link),
    onWelcome: (email, link) => mailer.sendWelcome(email, link),
    onRequestAccess: (email) => mailer.sendAccessNotice(email),
  });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    try {
      if (url.pathname.startsWith('/api/')) {
        const result = await route(req, res, url);
        // Маршрут может ответить сам (редирект по ссылке из письма, HTML-страница).
        if (!result || res.headersSent) return;
        const payload = JSON.stringify(result.body ?? {});
        res.writeHead(result.status || 200, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        });
        res.end(payload);
        return;
      }
      await serveStatic(req, res, url, config);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status >= 500) console.error('[api]', req.method, url.pathname, err);
      res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      });
      res.end(JSON.stringify({
        error: status >= 500 && !config.debug ? 'Внутренняя ошибка сервера' : err.message,
        code: err.code || null,
      }));
    }
  });

  const sweep = setInterval(() => {
    sweepLimiter(bucketStore);
    store.purgeSessions();
  }, 10 * 60 * 1000);
  sweep.unref?.();

  return { server, db, store, config };
}

async function serveStatic(req, res, url, config) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' });
    res.end();
    return;
  }

  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';

  // Только статика приложения. Серверные каталоги, служебные файлы и .git
  // наружу не отдаются, даже если лежат внутри корня.
  const blocked = /^\/(server|\.git|\.github|\.kilo|node_modules|tools)(\/|$)/.test(pathname)
    || /(^|\/)(\.env|package-lock\.json|firebase-config\.js)$/.test(pathname);
  if (blocked) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Не найдено');
    return;
  }

  const target = normalize(join(ROOT, pathname));
  if (!target.startsWith(ROOT)) {
    res.writeHead(403);
    res.end();
    return;
  }

  try {
    const data = await readFile(target);
    const ext = extname(target).toLowerCase();
    const immutable = /[?&]v=/.test(url.search);
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'content-length': data.length,
      'cache-control': immutable
        ? 'public, max-age=31536000, immutable'
        : (ext === '.html' ? 'no-cache' : 'public, max-age=3600'),
      'x-content-type-options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    // Клиентский маршрут без файла — отдаём index.html, если он есть.
    if (!extname(pathname) && existsSync(join(ROOT, 'index.html'))) {
      const html = await readFile(join(ROOT, 'index.html'));
      res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-cache' });
      res.end(html);
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Не найдено');
  }
}

const isMain = process.argv[1] && normalize(process.argv[1]) === normalize(fileURLToPath(import.meta.url));
if (isMain) {
  const { server, config } = createApp();
  server.listen(config.port, config.host, () => {
    console.log(`«Давай играй»: http://${config.host}:${config.port} (health: /api/health)`);
    if (!config.publicUrl) console.log('ВНИМАНИЕ: PUBLIC_URL не задан — ссылки в письмах будут неверными');
  });
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

/** Для тестов: конфиг из переменных окружения с разумными умолчаниями. */
export function readConfigFile(path) {
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return {}; }
}
