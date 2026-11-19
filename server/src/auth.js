import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };

/**
 * Пароль хранится в формате scrypt$N$r$p$salt$hash.
 * Выбор scrypt, а не argon2id: он в стандартной библиотеке Node, без нативных
 * зависимостей на сервере. Параметры совпадают с OWASP-минимумом для scrypt.
 */
export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(password), salt, SCRYPT_PARAMS.keylen, SCRYPT_PARAMS);
  return [
    'scrypt',
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt.toString('base64'),
    hash.toString('base64'),
  ].join('$');
}

export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], 'base64');
  const expected = Buffer.from(parts[5], 'base64');
  const actual = scryptSync(String(password), salt, expected.length, { N, r, p });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function randomId() {
  return randomBytes(16).toString('hex');
}
