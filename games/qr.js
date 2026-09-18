// games/qr.js — генератор QR-кодов без внешних зависимостей и сети.
// Зачем: на странице «О проекте» показываем QR со ссылкой на страницу
// приложения — навёл камеру телефона и открыл. Внешние API-сервисы
// генерации запрещены обещанием «данные не покидают устройство», поэтому
// кодировщик свой: байтовый режим, уровень коррекции L, версии 1–3
// (до 53 байт данных — адрес страницы влезает с запасом).
//
// Экспорт: window.renderQrCode(canvas, text) — рисует QR в canvas
// с белой тихой зоной 4 модуля; window.qrMatrix(text) — только матрица.
(function(){
  'use strict';
  // ===== Поле Галуа GF(256), образующий многочлен 0x11D =====
  const GF_EXP = new Uint8Array(512), GF_LOG = new Uint8Array(256);
  (function(){
    let x = 1;
    for(let i = 0; i < 255; i++){
      GF_EXP[i] = x; GF_LOG[x] = i;
      x <<= 1; if(x & 0x100) x ^= 0x11D;
    }
    for(let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
  })();
  function gmul(a, b){ return (a && b) ? GF_EXP[GF_LOG[a] + GF_LOG[b]] : 0; }

  // Параметры версий 1–3 (уровень L — по одному блоку Рида–Соломона).
  const VERSIONS = [
    { size: 21, dataCw: 19, eccCw: 7,  align: null },
    { size: 25, dataCw: 34, eccCw: 10, align: [6, 18] },
    { size: 29, dataCw: 55, eccCw: 15, align: [6, 22] },
  ];

  // Образующий многочлен Рида–Соломона (старшая степень первой, gen[0]=1).
  function rsGenPoly(degree){
    let poly = [1];
    for(let i = 0; i < degree; i++){
      const next = new Array(poly.length + 1).fill(0);
      for(let j = 0; j < poly.length; j++){
        next[j] ^= poly[j];
        next[j + 1] ^= gmul(poly[j], GF_EXP[i]);
      }
      poly = next;
    }
    return poly;
  }
  // Остаток от деления потока данных на образующий многочлен = коды ECC.
  function rsEcc(data, degree){
    const gen = rsGenPoly(degree);
    const res = new Uint8Array(degree);
    for(const b of data){
      const factor = b ^ res[0];
      res.copyWithin(0, 1); res[degree - 1] = 0;
      for(let i = 0; i < degree; i++) res[i] ^= gmul(gen[i + 1], factor);
    }
    return Array.from(res);
  }

  // Поток бит → кодовые слова данных + ECC (байтовый режим).
  function buildCodewords(text, ver){
    const bytes = new TextEncoder().encode(text);
    const v = VERSIONS[ver - 1];
    const capBits = v.dataCw * 8;
    if(4 + 8 + bytes.length * 8 + 4 > capBits) return null; // не влезает
    const bits = [];
    const push = (val, len) => { for(let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(4, 4);                 // режим 0100 — байтовый
    push(bytes.length, 8);      // счётчик символов
    bytes.forEach(b => push(b, 8));
    push(0, Math.min(4, capBits - bits.length)); // терминатор
    while(bits.length % 8 !== 0) bits.push(0);   // до границы кодового слова
    const cw = [];
    for(let i = 0; i < bits.length; i += 8){
      let b = 0;
      for(let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      cw.push(b);
    }
    const pads = [0xEC, 0x11];
    for(let i = 0; cw.length < v.dataCw; i++) cw.push(pads[i % 2]);
    return cw.concat(rsEcc(cw, v.eccCw));
  }

  function makeMatrix(ver, codewords){
    const v = VERSIONS[ver - 1];
    const size = v.size;
    const modules = Array.from({length: size}, () => new Array(size).fill(false));
    const isFunc = Array.from({length: size}, () => new Array(size).fill(false));
    const set = (y, x, dark) => { modules[y][x] = dark; isFunc[y][x] = true; };

    // Поисковые узоры с разделителями (центры: 3 и size-4).
    const finder = (cy, cx) => {
      for(let dy = -4; dy <= 4; dy++)
        for(let dx = -4; dx <= 4; dx++){
          const y = cy + dy, x = cx + dx;
          if(y < 0 || y >= size || x < 0 || x >= size) continue;
          const dist = Math.max(Math.abs(dy), Math.abs(dx));
          set(y, x, dist !== 2 && dist !== 4);
        }
    };
    finder(3, 3); finder(3, size - 4); finder(size - 4, 3);
    // Синхронизационные линии (ряд/столбец 6).
    for(let i = 8; i < size - 8; i++){
      const dark = i % 2 === 0;
      if(!isFunc[6][i]) set(6, i, dark);
      if(!isFunc[i][6]) set(i, 6, dark);
    }
    // Выравнивающий узор 5×5 (у v2/v3 один — в нижнем правом углу).
    if(v.align){
      const c = v.align[1];
      for(let dy = -2; dy <= 2; dy++)
        for(let dx = -2; dx <= 2; dx++)
          set(c + dy, c + dx, Math.max(Math.abs(dy), Math.abs(dx)) !== 1);
    }
    // Информация о формате (две копии вокруг поисковых узоров).
    // Пока маска не выбрана — рисуем с нулевой, только чтобы застолбить зоны.
    const drawFormatBits = (mask) => {
      const data = 1 << 3 | mask; // уровень коррекции L = 01
      let rem = data;
      for(let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const bits15 = (data << 10 | rem) ^ 0x5412;
      const bit = i => ((bits15 >>> i) & 1) !== 0;
      for(let i = 0; i <= 5; i++) set(i, 8, bit(i));
      set(7, 8, bit(6)); set(8, 8, bit(7)); set(8, 7, bit(8));
      for(let i = 9; i < 15; i++) set(8, 14 - i, bit(i));
      for(let i = 0; i < 8; i++) set(8, size - 1 - i, bit(i));
      for(let i = 8; i < 15; i++) set(size - 15 + i, 8, bit(i));
      set(size - 8, 8, true); // всегда тёмный модуль
    };
    drawFormatBits(0);

    // Данные — «змейкой» снизу вверх, парами столбцов справа налево.
    let bitIdx = 0;
    const totalBits = codewords.length * 8;
    for(let right = size - 1; right >= 1; right -= 2){
      if(right === 6) right = 5;
      for(let vert = 0; vert < size; vert++){
        for(let j = 0; j < 2; j++){
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if(!isFunc[y][x] && bitIdx < totalBits){
            modules[y][x] = ((codewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) !== 0;
            bitIdx++;
          }
        }
      }
    }

    // Маски (i — столбец x, j — строка y, по спецификации).
    const maskInverts = (mask, x, y) => {
      switch(mask){
        case 0: return (x + y) % 2 === 0;
        case 1: return x % 2 === 0;
        case 2: return y % 3 === 0;
        case 3: return (x + y) % 3 === 0;
        case 4: return (Math.floor(x / 2) + Math.floor(y / 3)) % 2 === 0;
        case 5: return (x * y) % 2 + (x * y) % 3 === 0;
        case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
        default: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
      }
    };
    const applyMask = (mask) => {
      for(let y = 0; y < size; y++)
        for(let x = 0; x < size; x++)
          if(!isFunc[y][x] && maskInverts(mask, x, y)) modules[y][x] = !modules[y][x];
    };

    // Штрафы за «плохие» узоры — по правилам спецификации.
    const penalty = () => {
      let result = 0;
      // 1) пять и более одинаковых модулей подряд (горизонталь и вертикаль)
      const line = (get) => {
        for(let a = 0; a < size; a++){
          let color = get(a, 0), run = 1;
          for(let b = 1; b < size; b++){
            if(get(a, b) === color){
              run++;
              if(run === 5) result += 3; else if(run > 5) result++;
            } else { color = get(a, b); run = 1; }
          }
        }
      };
      line((y, x) => modules[y][x]);
      line((x, y) => modules[y][x]);
      // 2) блоки 2×2 одного цвета
      for(let y = 0; y < size - 1; y++)
        for(let x = 0; x < size - 1; x++){
          const c = modules[y][x];
          if(c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) result += 3;
        }
      // 3) фрагмент 1011101 с четырьмя светлыми с одной стороны
      const scan = (seq) => {
        for(let y = 0; y < size; y++)
          for(let x = 0; x + seq.length <= size; x++){
            let ok = true;
            for(let k = 0; k < seq.length && ok; k++) ok = modules[y][x + k] === seq[k];
            if(ok) result += 40;
          }
        for(let x = 0; x < size; x++)
          for(let y = 0; y + seq.length <= size; y++){
            let ok = true;
            for(let k = 0; k < seq.length && ok; k++) ok = modules[y + k][x] === seq[k];
            if(ok) result += 40;
          }
      };
      scan([false, false, false, false, true, false, true, true, true, false, true]);
      scan([true, false, true, true, true, false, true, false, false, false, false]);
      // 4) доля тёмных модулей должна быть близка к 50%
      let dark = 0;
      for(let y = 0; y < size; y++) for(let x = 0; x < size; x++) if(modules[y][x]) dark++;
      const total = size * size;
      result += Math.max(0, Math.floor(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
      return result;
    };

    // Перебираем 8 масок, оставляем лучшую (маска самоинверсна).
    let bestMask = 0, bestScore = Infinity;
    for(let m = 0; m < 8; m++){
      applyMask(m);
      drawFormatBits(m);
      const score = penalty();
      if(score < bestScore){ bestScore = score; bestMask = m; }
      applyMask(m);
    }
    applyMask(bestMask);
    drawFormatBits(bestMask);
    return modules;
  }

  // Подбирает версию и строит матрицу; null — текст слишком длинный.
  window.qrMatrix = function(text){
    for(let ver = 1; ver <= VERSIONS.length; ver++){
      const cw = buildCodewords(text, ver);
      if(cw) return makeMatrix(ver, cw);
    }
    return null;
  };

  // Рисует QR в canvas: белая тихая зона 4 модуля, чёткие квадраты,
  // рендер в 2× для резкости на Retina.
  window.renderQrCode = function(canvas, text){
    const matrix = window.qrMatrix(text);
    if(!matrix){ canvas.style.display = 'none'; return false; }
    canvas.style.display = '';
    const size = matrix.length;
    const total = size + 8; // + тихая зона с двух сторон
    const scale = Math.max(4, Math.floor(240 / total));
    const cssPx = total * scale;
    canvas.width = cssPx * 2;
    canvas.height = cssPx * 2;
    canvas.style.width = cssPx + 'px';
    canvas.style.height = cssPx + 'px';
    const ctx = canvas.getContext ? canvas.getContext('2d') : null;
    if(!ctx){ canvas.style.display = 'none'; return false; }
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cssPx, cssPx);
    ctx.fillStyle = '#111';
    for(let y = 0; y < size; y++)
      for(let x = 0; x < size; x++)
        if(matrix[y][x]) ctx.fillRect((x + 4) * scale, (y + 4) * scale, scale, scale);
    return true;
  };
})();
