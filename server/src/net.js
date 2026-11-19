import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { URL } from 'node:url';

/**
 * Минимальный HTTP-клиент для Node без зависимостей: JSON и HTML-тело.
 * Нужен для API и для двух мест клиента, где страница должна получить ответ
 * (письмо «установите пароль») без лишнего файла в статике.
 */
export function requestJson(url, { method = 'GET', body, headers = {}, timeoutMs = 8000, agent } = {}) {
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(url);
    } catch {
      reject(new Error('Некорректный URL: ' + url));
      return;
    }
    const isHttps = target.protocol === 'https:';
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = (isHttps ? httpsRequest : httpRequest)({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (isHttps ? 443 : 80),
      path: target.pathname + target.search,
      method,
      agent: agent || undefined,
      headers: {
        'accept': 'application/json',
        ...(payload ? { 'content-type': 'application/json', 'content-length': payload.length } : {}),
        ...headers,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
        resolve({ status: res.statusCode || 0, headers: res.headers, body: parsed, text });
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Таймаут запроса к ' + target.host)));
    if (payload) req.write(payload);
    req.end();
  });
}

/** Ответ-редирект с уже установленной сессионной cookie. */
export function redirect(res, location, headers = {}) {
  res.writeHead(302, { location, 'cache-control': 'no-store', ...headers });
  res.end();
}
