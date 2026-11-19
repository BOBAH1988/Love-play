/**
 * Перевод документов Firestore в строки своей базы и обратно.
 * Отдельный модуль — чтобы перенос и сверка пользовались одной и той же
 * нормализацией, иначе расхождение будет создавать сам скрипт проверки.
 */

const LEVELS = ['guest', 'starter', 'plus', 'premium', 'admin'];

export function normalizeLevel(raw) {
  const level = String(raw || 'starter').toLowerCase().trim();
  if (LEVELS.includes(level)) return level;
  // Исторически в базе встречалось значение 'full' — оно означало премиум.
  return level === 'full' ? 'premium' : 'starter';
}

/** Firestore Timestamp → unix ms */
export function toMillis(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return null;
}

/**
 * Документ users/{uid} → строка users.
 * Перенос не выдумывает данных: чего нет в Firestore, того нет и здесь.
 */
export function userFromDoc(uid, data = {}) {
  const email = String(data.email || '').trim();
  const displayName = data.displayName || (email.includes('@') ? email.split('@')[0] : email) || null;
  return {
    uid: String(uid),
    email,
    display_name: displayName,
    name: data.name || null,
    gender: data.gender === 'M' || data.gender === 'F' ? data.gender : null,
    age: Number.isFinite(Number(data.age)) && Number(data.age) > 0 ? Number(data.age) : null,
    role: data.role || 'user',
    access_level: normalizeLevel(data.accessLevel),
    is_adult: data.isAdult === true ? 1 : 0,
    status: data.status || 'active',
    email_verified: data.emailVerified === true ? 1 : 0,
    created_at: toMillis(data.createdAt),
    updated_at: toMillis(data.updatedAt),
    game_stats: data.gameStats && typeof data.gameStats === 'object' ? data.gameStats : null,
  };
}

/** Строка users → документ в форме, которую ждёт клиент после переезда. */
export function userToApi(row) {
  return {
    uid: row.uid,
    email: row.email,
    displayName: row.display_name,
    name: row.name,
    gender: row.gender,
    age: row.age,
    role: row.role,
    accessLevel: row.access_level,
    isAdult: row.is_adult === 1,
    status: row.status,
    emailVerified: row.email_verified === 1,
    createdAt: row.created_at,
    gameStats: row.game_stats || undefined,
  };
}

export function gameFromDoc(id, data = {}) {
  return {
    id: String(id),
    title: data.title || null,
    group_slug: data.groupSlug || null,
    game_key: data.gameKey || null,
    enabled: data.enabled === true ? 1 : 0,
    access_level: normalizeLevel(data.accessLevel || 'guest'),
    age_rating: data.ageRating || 'all',
    sort_order: Number.isFinite(Number(data.order)) ? Number(data.order) : null,
    updated_at: toMillis(data.updatedAt),
  };
}

export function gameToApi(row) {
  return {
    id: row.id,
    title: row.title,
    groupSlug: row.group_slug,
    gameKey: row.game_key,
    enabled: row.enabled === 1,
    accessLevel: row.access_level,
    ageRating: row.age_rating,
    order: row.sort_order,
  };
}

export function groupFromDoc(id, data = {}) {
  return {
    id: String(id),
    title: data.title || null,
    slug: data.slug || null,
    enabled: data.enabled === true ? 1 : 0,
    sort_order: Number.isFinite(Number(data.order)) ? Number(data.order) : null,
    updated_at: toMillis(data.updatedAt),
  };
}

export function accessRequestFromDoc(id, data = {}) {
  return {
    id: String(id),
    uid: data.uid || null,
    email: data.email || null,
    comment: data.comment || data.text || null,
    status: data.status || 'new',
    created_at: toMillis(data.createdAt) ?? Date.now(),
    handled_by: data.handledBy || null,
  };
}

/**
 * Слияние gameStats по правилам Firestore set(..., merge: true):
 * вложенные объекты сливаются, числа и массивы заменяются.
 * Простой INSERT затёр бы более ранние счётчики — именно на этом теряются данные.
 */
export function mergeGameStats(prev, next) {
  if (!prev || typeof prev !== 'object') return next && typeof next === 'object' ? next : prev;
  if (!next || typeof next !== 'object' || Array.isArray(next)) return next;
  const out = { ...prev };
  for (const [key, value] of Object.entries(next)) {
    const old = prev[key];
    const bothObjects = old && value && typeof old === 'object' && typeof value === 'object'
      && !Array.isArray(old) && !Array.isArray(value);
    out[key] = bothObjects ? mergeGameStats(old, value) : value;
  }
  return out;
}
