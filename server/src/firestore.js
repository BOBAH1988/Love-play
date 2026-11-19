import { requestJson } from './net.js';
import { userFromDoc, gameFromDoc, groupFromDoc, accessRequestFromDoc, normalizeLevel } from './model.js';

const BASE = 'https://firestore.googleapis.com/v1/projects';

/**
 * Чтение Firestore REST API ключом веб-приложения.
 * Ключ лежит в firebase-config.js и известен любому посетителю — это не секрет,
 * поэтому чтение через него ничего не раскрывает сверх того, что уже доступно
 * в браузере. Правила Firestore при этом обходятся? Нет: REST с API-ключом
 * подчиняется тем же правилам. Если проект закрыт правилами, чтение без
 * idToken вернёт 403, и тогда нужен экспорт из консоли Firebase
 * (см. deploy/README.md, раздел «Экспорт»).
 */
export function firestoreReader({ projectId, apiKey }) {
  if (!projectId || !apiKey) throw new Error('Нужны projectId и apiKey');

  async function listCollection(name, pageSize = 300) {
    const docs = [];
    let pageToken = '';
    do {
      const url = `${BASE}/${encodeURIComponent(projectId)}/databases/(default)/documents/${name}`
        + `?key=${encodeURIComponent(apiKey)}&pageSize=${pageSize}`
        + (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
      const res = await requestJson(url);
      if (res.status !== 200) {
        throw new Error(`Firestore ${name}: HTTP ${res.status} ${res.text.slice(0, 200)}`);
      }
      for (const doc of res.body?.documents || []) docs.push(doc);
      pageToken = res.body?.nextPageToken || '';
    } while (pageToken);
    return docs;
  }

  return {
    projectId,
    listUsers: () => listCollection('users'),
    listGames: () => listCollection('games'),
    listGroups: () => listCollection('gameGroups'),
    listRequests: () => listCollection('accessRequests'),
    async listAppState(uid) {
      return listCollection(`users/${uid}/app`, 50);
    },
  };
}

/**
 * Плоское / объект значение Firestore REST → обычный JS.
 */
export function fromFirestoreValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return { seconds: Math.floor(Date.parse(value.timestampValue) / 1000) };
  if ('mapValue' in value) {
    const out = {};
    for (const [k, v] of Object.entries(value.mapValue?.fields || {})) out[k] = fromFirestoreValue(v);
    return out;
  }
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(fromFirestoreValue);
  return null;
}

export function docToObject(doc) {
  const data = {};
  for (const [k, v] of Object.entries(doc.fields || {})) data[k] = fromFirestoreValue(v);
  const id = (doc.name || '').split('/').pop();
  return { id, data };
}

/** Приводит пользователя при переносе к строке users. */
export function toUserRow(doc) {
  const { id, data } = docToObject(doc);
  const row = userFromDoc(id, data);
  if (!row.email) return null; // документ без почты перенести нельзя: вход по почте
  return row;
}

export function toGameRow(doc) {
  const { id, data } = docToObject(doc);
  const row = gameFromDoc(id, data);
  row.access_level = normalizeLevel(row.access_level);
  return row;
}

export function toGroupRow(doc) {
  const { id, data } = docToObject(doc);
  return groupFromDoc(id, data);
}

export function toRequestRow(doc) {
  const { id, data } = docToObject(doc);
  return accessRequestFromDoc(id, data);
}

export { docToObject as firestoreDocToObject };
