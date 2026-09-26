/**
 * tools/dom-stub.js — минимальная эмуляция браузерного окружения для Node.
 *
 * Зачем: приложение состоит из 80+ скриптов, которые работают в глобальной
 * области видимости и активно трогают DOM. Чтобы проверить их без браузера,
 * нужна заглушка, которая ведёт себя достаточно похоже на настоящий DOM:
 *   - getElementById отдаёт элемент ТОЛЬКО если такой id есть в index.html
 *     (иначе null — как в браузере; это и ловит опечатки в id);
 *   - у элемента есть classList, style, dataset и методы-пустышки;
 *   - localStorage/sessionStorage хранят данные в памяти;
 *   - fetch/caches/indexedDB отвечают заглушками, чтобы не тянуть сеть.
 *
 * Важно: заглушка НЕ проверяет визуальную часть (вёрстку, размеры, цвета).
 * Она отвечает на вопрос «скрипты грузятся и выполняются без ошибок».
 *   - addEventListener отслеживает обработчики (опционально, для тестов).
 */

'use strict';

const fs = require('fs');

/**
 * Присваивает глобальную переменную, даже если в Node она объявлена
 * «только для чтения» — так ведут себя navigator и location в Node 22+.
 * Через defineProperty это работает всегда.
 */
function setGlobal(name, value) {
  Object.defineProperty(global, name, { value, writable: true, configurable: true });
}

/**
 * Создаёт окружение и возвращает объект с результатом загрузки скриптов.
 * @param {string} html — содержимое index.html (нужен список id и скриптов)
 * @returns {{ loaded: string[], failed: Array<{file:string,error:string}>, missingIds: string[] }}
 */
function createDomStub(html, { trackHandlers = false } = {}) {
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  // Экраны (<... class="screen ...">) — как в браузере, где смена их класса
  // ловится MutationObserver'ом (games/core.js, «КОНТЕКСТ ЗАПУСКА ПАРТИИ»).
  // Заглушка повторяет это: когда экран получает класс .active, она сообщает
  // приложению, какой экран теперь виден. Без этого сценарии «выход/возврат»
  // в Node не воспроизводились: код, который вручную включает #setup
  // (десятки мест в играх), оставался для теста незамеченным — и настоящий
  // баг «выход ведёт в меню прошлой игры» тесты не ловили.
  const screenIds = new Set(
    [...html.matchAll(/<[a-zA-Z][^>]*>/g)]
      .map((m) => m[0])
      .map((tag) => {
        const id = /id="([^"]+)"/.exec(tag);
        const cls = /class="([^"]*)"/.exec(tag);
        return id && cls && /(^|\s)screen(\s|$)/.test(cls[1]) ? id[1] : null;
      })
      .filter(Boolean)
  );
  // Сообщаем приложению о «стал активным экран X» — если core.js это слушает.
  function noteScreenActive(id) {
    if (typeof global.__noteActiveScreen === 'function') global.__noteActiveScreen(id);
  }
  // Элементы экранов: создаём лениво, но в общем store — чтобы тот же объект
  // отдавал и getElementById, и document.querySelector('.screen').
  function elById(id) {
    if (!store.has(id)) store.set(id, makeEl(id, trackHandlers));
    return store.get(id);
  }
  function screenEls() {
    return [...screenIds].map((id) => elById(id));
  }
  const store = new Map();
  const missingIds = new Set();

  // Элемент-пустышка. Всё, что не реализовано явно, — no-op, чтобы код
  // приложения не падал на обращении к методу, которого нет в заглушке.
  // Для тестов: addEventListener с опцией trackHandlers сохраняет обработчики,
  // чтобы их можно было вызвать программно (симуляция кликов).
  function makeEl(id, trackHandlers = false) {
    const classes = new Set();
    const handlers = new Map(); // event type -> array of handlers
    const el = {
      id,
      style: {},
      dataset: {},
      children: [],
      value: '',
      checked: false,
      disabled: false,
      classList: {
        add: (...c) => c.forEach((x) => {
          classes.add(x);
          // Экран стал видимым — сообщаем приложению (аналог MutationObserver).
          if (x === 'active' && screenIds.has(id)) noteScreenActive(id);
        }),
        remove: (...c) => c.forEach((x) => classes.delete(x)),
        // По спецификации DOM аргумент force обязателен: true — добавить,
        // false — удалить, а БЕЗ второго аргумента класс переключается.
        // Раньше здесь стояло `if (force) ... else delete`, то есть toggle(c)
        // без аргумента удалял класс вместо переключения. Расхождение с
        // браузером маскировало ошибки: код, который в реальности переключал
        // класс, в тестах выглядел работающим и наоборот.
        toggle: (c, force) => {
          const shouldAdd = (force === undefined) ? !classes.has(c) : !!force;
          if (shouldAdd) {
            classes.add(c);
            if (c === 'active' && screenIds.has(id)) noteScreenActive(id);
          } else {
            classes.delete(c);
          }
        },
        contains: (c) => classes.has(c),
      },
      // className в стабе отсутствовал, хотя в браузере есть. Тесты, читавшие
      // element.className, получали undefined и не могли ничего проверить.
      get className() { return [...classes].join(' '); },
      set className(v) {
        classes.clear();
        String(v).split(/\s+/).filter(Boolean).forEach(x => classes.add(x));
      },
      _text: '',
      _html: '',
      get textContent() { return this._text; },
      set textContent(v) { this._text = String(v); },
      get innerHTML() { return this._html; },
      set innerHTML(v) { this._html = String(v); },
      addEventListener(type, handler, options) {
        if (trackHandlers) {
          if (!handlers.has(type)) handlers.set(type, []);
          handlers.get(type).push({ handler, options });
        }
      },
      removeEventListener() {},
      dispatchEvent() { return true; },
      appendChild() {}, removeChild() {}, insertBefore() {}, replaceChild() {},
      remove() {}, replaceWith() {}, after() {}, before() {},
      cloneNode() { return makeEl(id); },
      setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
      hasAttribute() { return false; },
      focus() {}, blur() {},
      click() {
        // Симуляция клика: вызываем все зарегистрированные обработчики click
        if (handlers.has('click')) {
          const clickHandlers = handlers.get('click');
          clickHandlers.forEach(({ handler, options }) => {
            try { handler({ type: 'click', target: el, currentTarget: el, preventDefault: () => {}, stopPropagation: () => {} }); }
            catch (e) { /* ошибка в обработчике — фиксим, но не прерываем */ }
          });
        }
      },
      scrollIntoView() {},
      play() { return Promise.resolve(); }, pause() {}, load() {},
      getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }; },
      contains() { return false; }, matches() { return false; }, closest() { return null; },
      querySelector() { return makeEl('_q'); },
      querySelectorAll() { return []; },
      getContext() { return null; },
      toDataURL() { return ''; },
      // Для тестов: доступ к обработчикам
      _getHandlers() { return handlers; },
      _hasHandler(type) { return handlers.has(type); },
    };
    return el;
  }

  global.window = global;
  global.addEventListener = () => {};
  global.removeEventListener = () => {};
  global.dispatchEvent = () => true;
  // Прокрутка: обработчик кнопки «Назад» вызывает window.scrollTo после
  // возврата в меню. Без заглушки такой сценарий падал в тестах с
  // «window.scrollTo is not a function», и падение маскировало настоящую
  // причину — проверка не доходила до своих утверждений.
  global.scrollTo = () => {};
  global.scrollBy = () => {};

  global.document = {
    // Ключевой момент: неизвестный id → null, как в браузере.
    getElementById(id) {
      if (!ids.has(id)) { missingIds.add(id); return null; }
      return elById(id);
    },
    // Селекторы экранов ведут себя как в браузере: по ним навигация гасит
    // старые экраны и включает целевой (см. core.js: ensureSingleActiveScreen,
    // activateSingleScreen, goToGame, exitGame). Без этого «экран делится на
    // две части» и «остался активным чужой экран» в тестах не воспроизводились
    // бы вовсе. Для остальных селекторов поведение прежнее — пустая заглушка.
    querySelector(selector) {
      if (selector === '.screen.active') return screenEls().find((el) => el.classList.contains('active')) || null;
      if (selector === '.screen') return screenEls()[0] || null;
      return makeEl('_q');
    },
    querySelectorAll(selector) {
      if (selector === '.screen') return screenEls();
      if (selector === '.screen.active') return screenEls().filter((el) => el.classList.contains('active'));
      return [];
    },
    createElement(tag) { return makeEl('_' + tag); },
    createTextNode() { return {}; },
    createDocumentFragment() { return makeEl('_frag'); },
    addEventListener() {}, removeEventListener() {},
    body: makeEl('body'), documentElement: makeEl('html'),
    head: makeEl('head'), readyState: 'complete', cookie: '', title: '',
    hidden: false, visibilityState: 'visible',
    execCommand() { return true; },
  };

  setGlobal('navigator', {
    userAgent: 'node-check', onLine: true, language: 'ru-RU', languages: ['ru-RU'],
    vibrate() {}, standalone: false,
    serviceWorker: {
      getRegistrations: () => Promise.resolve([]),
      getRegistration: () => Promise.resolve(null),
      register: () => Promise.resolve({ addEventListener() {}, update() {} }),
      addEventListener() {}, controller: null, ready: Promise.resolve({}),
    },
    mediaSession: null, clipboard: { writeText: () => Promise.resolve() },
    share: () => Promise.resolve(),
  });

  const locationStub = {
    href: 'https://example.test/', search: '', hash: '', pathname: '/',
    origin: 'https://example.test',
    replace() {}, reload() {}, assign() {}, toString() { return this.href; },
  };
  setGlobal('location', locationStub);
  global.history = { replaceState() {}, pushState() {}, back() {}, forward() {} };

  function makeStorage() {
    const data = new Map();
    return {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => { data.set(k, String(v)); },
      removeItem: (k) => { data.delete(k); },
      clear: () => { data.clear(); },
      key: (i) => [...data.keys()][i] ?? null,
      get length() { return data.size; },
    };
  }
  global.localStorage = makeStorage();
  global.sessionStorage = makeStorage();

  global.matchMedia = () => ({
    matches: false, media: '', addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
  });

  global.indexedDB = {
    open() {
      const req = {
        result: {
          createObjectStore() { return {}; },
          transaction() {
            return {
              objectStore() {
                return {
                  get() { return {}; }, put() { return {}; }, add() { return {}; },
                  delete() { return {}; }, getAll() { return {}; }, clear() { return {}; },
                  index() { return { getAll() { return {}; } }; },
                };
              },
              oncomplete: null, onerror: null,
            };
          },
        },
        onerror: null, onsuccess: null, onupgradeneeded: null,
      };
      setTimeout(() => { if (req.onsuccess) req.onsuccess({ target: req }); }, 0);
      return req;
    },
    deleteDatabase() { return { onsuccess: null, onerror: null }; },
  };

  global.caches = {
    open: () => Promise.resolve({
      add: () => Promise.resolve(), addAll: () => Promise.resolve(),
      put: () => Promise.resolve(), match: () => Promise.resolve(null),
      keys: () => Promise.resolve([]), delete: () => Promise.resolve(true),
    }),
    keys: () => Promise.resolve([]),
    match: () => Promise.resolve(null),
    delete: () => Promise.resolve(true),
    has: () => Promise.resolve(false),
  };

  global.fetch = () => Promise.resolve({
    ok: true, status: 200, statusText: 'OK',
    text: () => Promise.resolve(''), json: () => Promise.resolve({}),
    blob: () => Promise.resolve({}), arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    clone() { return this; },
  });

  // Аудио: приложение много работает со звуком, нужны рабочие заглушки.
  global.Audio = function Audio() {
    return {
      play: () => Promise.resolve(), pause() {}, load() {},
      addEventListener() {}, removeEventListener() {},
      currentTime: 0, duration: 0, volume: 1, muted: false, loop: false, src: '',
    };
  };
  const audioNode = () => ({
    connect() {}, disconnect() {}, start() {}, stop() {},
    frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
    gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
    type: '', buffer: null, onended: null,
  });
  global.AudioContext = function AudioContext() {
    return {
      createOscillator: audioNode, createGain: audioNode,
      createBufferSource: audioNode, createBiquadFilter: audioNode,
      decodeAudioData: () => Promise.resolve({}),
      destination: {}, currentTime: 0, state: 'running',
      resume: () => Promise.resolve(), close: () => Promise.resolve(),
      sampleRate: 44100,
    };
  };
  global.webkitAudioContext = global.AudioContext;

  global.speechSynthesis = { speak() {}, cancel() {}, pause() {}, resume() {}, getVoices: () => [] };
  global.SpeechSynthesisUtterance = function SpeechSynthesisUtterance() { return {}; };

  global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  global.requestIdleCallback = (cb) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 0);
  global.cancelIdleCallback = (id) => clearTimeout(id);

  // Браузерные Blob/File хранят куски и их размер, а File — ещё имя и тип.
  // Заглушки это повторяют: код отправки видео проверяет blob.size и отдаёт
  // файл с именем ролика, и на пустых объектах такие проверки ничего не значат.
  global.Blob = function Blob(parts, opts) {
    const list = Array.isArray(parts) ? parts : [];
    let size = 0;
    list.forEach((p) => {
      if (p && typeof p.size === 'number') size += p.size;
      else size += String(p == null ? '' : p).length;
    });
    return { size, type: (opts && opts.type) || '' };
  };
  global.File = function File(parts, name, opts) {
    const base = global.Blob(parts, opts);
    return { name: String(name || ''), type: base.type, size: base.size };
  };
  global.URL.createObjectURL = () => 'blob:stub';
  global.URL.revokeObjectURL = () => {};
  global.FileReader = function FileReader() {
    return { readAsText() {}, readAsDataURL() {}, readAsArrayBuffer() {}, addEventListener() {}, result: null };
  };
  global.FormData = function FormData() { return { append() {}, delete() {}, get() { return null; } }; };

  global.CustomEvent = function CustomEvent(type, opts) { this.type = type; this.detail = opts && opts.detail; };
  global.Event = function Event(type) { this.type = type; };
  global.Image = function Image() { return { src: '', onload: null, onerror: null, addEventListener() {} }; };
  global.XMLHttpRequest = function XMLHttpRequest() {
    return { open() {}, send() {}, setRequestHeader() {}, addEventListener() {}, abort() {} };
  };

  global.alert = () => {};
  global.confirm = () => true;
  global.prompt = () => null;
  global.getComputedStyle = () => ({ getPropertyValue: () => '', width: '0px', height: '0px' });
  global.wakeLock = { request: () => Promise.resolve({ release: () => Promise.resolve(), addEventListener() {} }) };
  if (global.navigator) global.navigator.wakeLock = global.wakeLock;

  return { ids, missingIds, makeEl };
}

/**
 * Загружает все скрипты приложения в том порядке, в котором их подключает
 * index.html. Возвращает статистику: сколько загрузилось и что упало.
 * Если передан флаг trackHandlers, элементы будут хранить обработчики событий
 * для последующей симуляции кликов (используется в smoke-тестах).
 */
function loadAppScripts(html, { root = process.cwd(), trackHandlers = false } = {}) {
  const stub = createDomStub(html, { trackHandlers });

  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');


  // Порядок важен: он определяет, в какой момент скрипт увидит зависимости.
  const sources = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]
    .map((m) => m[1].split('?')[0]);

  const loaded = [];
  const failed = [];

  for (const rel of sources) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) {
      failed.push({ file: rel, error: 'файл не найден' });
      continue;
    }
    try {
      vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: rel });
      loaded.push(rel);
    } catch (e) {
      const line = (e.stack || '').split('\n')[1] || '';
      failed.push({ file: rel, error: `${e.message.split('\n')[0]} ${line.trim()}` });
    }
  }

  return { loaded, failed, missingIds: [...stub.missingIds], stub };
}

/**
 * Вспомогательная функция для smoke-тестов: получает элемент по id из загруженного
 * окружения. Если trackHandlers был включён, позволяет проверить, зарегистрированы
 * ли обработчики на элементе.
 */
function getElById(stub, id) {
  // stub — это объект, возвращённый loadAppScripts.
  // Элементы доступны через global.document (установлен в createDomStub)
  if (!global || !global.document) return null;
  return global.document.getElementById(id);
}

module.exports = { createDomStub, loadAppScripts, getElById };
