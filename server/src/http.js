export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || null;
  }
}

export const badRequest = (message) => new HttpError(400, message, 'bad-request');
export const unauthorized = (message = 'Нужно войти в аккаунт') => new HttpError(401, message, 'unauthenticated');
export const forbidden = (message = 'Недостаточно прав') => new HttpError(403, message, 'permission-denied');
export const notFound = (message = 'Не найдено') => new HttpError(404, message, 'not-found');

export function readJson(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, 'Тело запроса слишком большое'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(parsed && typeof parsed === 'object' ? parsed : {});
      } catch {
        reject(badRequest('Тело запроса — не JSON'));
      }
    });
    req.on('error', reject);
  });
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    if (!name) continue;
    out[name] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

/** Нормализация странного входа: клиент шлёт то объект, то строку. */
export function asObject(value) {
  if (value == null) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
