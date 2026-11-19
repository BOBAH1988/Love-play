/**
 * Простейший ограничитель частоты: окно в памяти процесса.
 * На один сервер этого достаточно. За прокси все клиенты выглядят одним IP,
 * поэтому ключ — IP из X-Forwarded-For, если он есть (Caddy ставит его сам).
 */
export function createLimiter({ windowMs = 60_000, max = 30 } = {}) {
  const buckets = new Map();

  function keyOf(req) {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
    return req.socket?.remoteAddress || 'unknown';
  }

  return function limit(scope, extraKey = '') {
    return function check(req) {
      const now = Date.now();
      const key = `${scope}|${keyOf(req)}|${extraKey}`;
      const bucket = buckets.get(key);
      if (!bucket || bucket.reset <= now) {
        buckets.set(key, { count: 1, reset: now + windowMs });
        return true;
      }
      bucket.count += 1;
      return bucket.count <= max;
    };
  };
}

/** Убирает просроченные окна, чтобы карта не росла бесконечно. */
export function sweepLimiter(store, now = Date.now()) {
  for (const [key, bucket] of store) {
    if (bucket.reset <= now) store.delete(key);
  }
}
