// Экспорт: манифест, счётчики, checksum, формат 4.
// Чистый модуль — без DOM и IndexedDB.
// Содержит canonicalJson, sha256, checksum, buildExport, validateExport, computeFileHash.

import { TUNING } from './constants.js';

export const CURRENT_SCHEMA_VERSION = 4;
export const SUPPORTED_SCHEMA_VERSIONS = [3, 4];

// ── SHA-256 (FIPS 180‑4, чистый JS) ──────────────────────────────────────────

/** SHA-256 round constants (первые 32 бита дробных частей кубических корней
 *  первых 64 простых чисел). */
const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

/** Начальные значения H (первые 32 бита дробных частей квадратных корней
 *  первых 8 простых чисел). */
const H0 = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
]);

function rightRotate(x, n) {
  return (x >>> n) | (x << (32 - n));
}

/**
 * SHA-256 дайджест по FIPS 180‑4.
 * @param {Uint8Array} message — байты сообщения.
 * @returns {string} — 64-символьная hex-строка (lowercase).
 */
export function sha256(message) {
  // Дополнение: добавляем 0x80, потом нули до кратного 64 байтам минус 8,
  // потом длина в битах (64-bit big-endian).
  const ml = message.length * 8;
  // Количество байт после дополнения
  const paddedLen = (((message.length + 9 + 63) >>> 6) << 6); // кратно 64, >= len+9
  const padded = new Uint8Array(paddedLen);
  padded.set(message);
  padded[message.length] = 0x80;
  // Длина в битах — big-endian, последние 8 байт
  const dv = new DataView(padded.buffer);
  dv.setUint32(paddedLen - 8, Math.floor(ml / 0x100000000), false); // старшие 32 бита
  dv.setUint32(paddedLen - 4, ml >>> 0, false); // младшие 32 бита

  const H = new Uint32Array(H0);
  const W = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    // Подготовка W
    for (let t = 0; t < 16; t++) {
      W[t] = dv.getUint32(offset + t * 4, false); // big-endian
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rightRotate(W[t - 15], 7) ^ rightRotate(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      const s1 = rightRotate(W[t - 2], 17) ^ rightRotate(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }

    let a = H[0], b = H[1], c = H[2], d = H[3];
    let e = H[4], f = H[5], g = H[6], h = H[7];

    for (let t = 0; t < 64; t++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (h + S1 + ch + K256[t] + W[t]) >>> 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g; g = f; f = e;
      e = (d + temp1) >>> 0;
      d = c; c = b; b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  // Сборка hex
  let hex = '';
  for (let i = 0; i < 8; i++) {
    hex += H[i].toString(16).padStart(8, '0');
  }
  return hex;
}

// ── Служебные ────────────────────────────────────────────────────────────────

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function uint8ArrayFromString(s) {
  return new TextEncoder().encode(s);
}

// ── canonicalJson — каноническая JSON-сериализация ──────────────────────────

/**
 * Каноническая JSON-сериализация.
 * Ключи сортируются в code-unit order (UTF-16).
 * undefined-значения пропускаются.
 * NaN, Infinity → throw.
 * Массивы как есть; undefined-элементы → throw.
 * -0 → 0.
 * Без Unicode-нормализации.
 */
export function canonicalJson(data) {
  return _canonicalJson(data);
}

function _canonicalJson(value) {
  if (value === null) return 'null';
  if (value === true) return 'true';
  if (value === false) return 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (Number.isNaN(value)) throw new Error('NaN недопустим в canonicalJson');
    if (!Number.isFinite(value)) throw new Error('Infinity недопустим в canonicalJson');
    if (Object.is(value, -0)) return '0';
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const parts = [];
    for (let i = 0; i < value.length; i++) {
      if (value[i] === undefined) throw new Error('undefined-элемент массива недопустим');
      parts.push(_canonicalJson(value[i]));
    }
    return '[' + parts.join(',') + ']';
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value).filter(k => value[k] !== undefined);
    keys.sort(); // code-unit order
    const parts = keys.map(k => JSON.stringify(k) + ':' + _canonicalJson(value[k]));
    return '{' + parts.join(',') + '}';
  }
  throw new Error('Недопустимый тип в canonicalJson: ' + typeof value);
}

// ── checksum ─────────────────────────────────────────────────────────────────

/**
 * SHA-256 checksum канонического JSON.
 * Возвращает 'sha256:' + lowercase hex.
 */
export function checksum(data) {
  const canon = canonicalJson(data);
  const hash = sha256(uint8ArrayFromString(canon));
  return 'sha256:' + hash.toLowerCase();
}

// ── buildExport — построение манифеста экспорта ─────────────────────────────

/**
 * Собирает объект экспорта формата 4.
 * @param {Object} opts
 * @param {string} opts.mode — 'full' | 'notes' | 'learning' | 'logs'
 * @param {Object} opts.dbSnapshot — результат DB.getSnapshot()
 * @param {string} opts.appVersion
 * @param {string} opts.deviceId
 * @param {string} opts.sessionId
 * @param {number} [opts.exportsSince]
 * @param {Object} [opts.extra] — доп. поля (опционально)
 * @returns {Object} — манифест { format, formatVersion, schemaVersion, appVersion, exportedAt, exportId, mode, sections, counts, tuning, data, checksum }
 */
export function buildExport(opts) {
  const { mode, dbSnapshot, appVersion, deviceId, sessionId, exportsSince, extra } = opts;

  const sections = {};
  const data = {};

  if (mode === 'full' || mode === 'notes') {
    sections.notes = true;
    data.notes = dbSnapshot.notes || [];
  }
  if (mode === 'full' || mode === 'learning') {
    sections.word_evidence = true;
    sections.word_meta = true;
    data.word_evidence = dbSnapshot.evidence || [];
    data.word_meta = dbSnapshot.meta || [];
  }
  if (mode === 'full' || mode === 'logs') {
    sections.training_log = true;
    data.training_log = dbSnapshot.logs || [];
  }

  const counts = {};
  counts.notes = (data.notes || []).length;
  counts.evidence = (data.word_evidence || []).length;
  counts.meta = (data.word_meta || []).length;
  counts.logs = (data.training_log || []).length;

  // Генерация exportId
  let exportId;
  try {
    exportId = crypto.randomUUID();
  } catch (e) {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    arr[6] = (arr[6] & 0x0f) | 0x40; // version 4
    arr[8] = (arr[8] & 0x3f) | 0x80; // variant 10
    exportId = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
    exportId = exportId.slice(0, 8) + '-' + exportId.slice(8, 12) + '-' + exportId.slice(12, 16) + '-' + exportId.slice(16, 20) + '-' + exportId.slice(20);
  }

  const manifest = {
    format: 'livenotepad-export',
    formatVersion: 4,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion,
    exportedAt: new Date().toISOString(),
    exportId,
    mode,
    sections,
    counts,
    tuning: TUNING,
    data
  };

  if (exportsSince !== undefined) manifest.exportsSince = exportsSince;
  if (extra) Object.assign(manifest, extra);

  // Checksum только по data
  manifest.checksum = checksum(data);

  return manifest;
}

// ── validateExport — валидация импортируемого файла ─────────────────────────

/**
 * Расширение validateImport для формата 4.
 * Проверяет манифест (format, formatVersion, schemaVersion, sections, counts, checksum).
 * Возвращает { errors, warnings, content, counts }.
 * При formatVersion === 3 принимает как легаси.
 * Внутренний результат назван `content` (не `sections`), чтобы не путать с манифестом.
 */
export function validateExport(data) {
  const errors = [];
  const warnings = [];
  const content = { notes: [], word_evidence: [], word_meta: [], training_log: [] };
  const counts = { notes: 0, word_evidence: 0, word_meta: 0, training_log: 0 };

  if (!isPlainObject(data)) {
    errors.push('экспорт: ожидается объект, а не ' + (Array.isArray(data) ? 'массив' : typeof data));
    return { errors, warnings, content, counts };
  }

  if (!hasOwn(data, 'format')) {
    errors.push('отсутствует format');
  } else if (data.format !== 'livenotepad-export') {
    errors.push('format: ожидается livenotepad-export, получен ' + JSON.stringify(data.format));
  }

  const fv = data.formatVersion;
  if (fv === undefined) {
    warnings.push('formatVersion отсутствует (legacy-файл)');
  } else if (fv !== 3 && fv !== 4) {
    errors.push('formatVersion: ' + fv + ' не поддерживается (поддерживаются 3, 4)');
  }

  const sv = data.schemaVersion;
  if (sv === undefined) {
    warnings.push('schemaVersion отсутствует (legacy)');
  } else if (!SUPPORTED_SCHEMA_VERSIONS.includes(sv)) {
    warnings.push('schemaVersion: ' + sv + ' не из поддерживаемых ' + JSON.stringify(SUPPORTED_SCHEMA_VERSIONS));
  } else if (sv !== CURRENT_SCHEMA_VERSION) {
    warnings.push('schemaVersion: ' + sv + ' (легаси-схема, данные совместимы)');
  }

  // Для formatVersion === 3 — легаси, принимаем как есть
  if (fv === 3) {
    // Легаси-формат: данные на верхнем уровне
    const source = data;
    const present = {
      notes: hasOwn(source, 'notes'),
      word_evidence: hasOwn(source, 'word_evidence'),
      word_meta: hasOwn(source, 'word_meta'),
      training_log: hasOwn(source, 'training_log')
    };
    const SECTION_NAMES = ['notes', 'word_evidence', 'word_meta', 'training_log'];
    for (const name of SECTION_NAMES) {
      if (present[name]) {
        if (!Array.isArray(source[name])) {
          errors.push('секция ' + name + ': ожидается массив');
        } else {
          content[name] = source[name];
          counts[name] = source[name].length;
        }
      }
    }
    return { errors, warnings, content, counts };
  }

  // formatVersion === 4
  if (!isPlainObject(data.sections)) {
    errors.push('sections: ожидается объект');
  }
  if (!isPlainObject(data.counts)) {
    errors.push('counts: ожидается объект');
  }
  if (!isPlainObject(data.data)) {
    errors.push('data: ожидается объект');
  }

  // Проверка mode
  if (data.mode !== undefined && !['full', 'notes', 'learning', 'logs'].includes(data.mode)) {
    warnings.push('mode: неизвестный режим ' + JSON.stringify(data.mode));
    // не фатально
  }

  if (errors.length > 0) return { errors, warnings, content, counts };

  const SECTION_KEYS = ['notes', 'word_evidence', 'word_meta', 'training_log'];
  const sectionMap = { notes: 'notes', word_evidence: 'word_evidence', word_meta: 'word_meta', training_log: 'training_log' };

  // Проверяем sections (boolean-карта)
  for (const key of SECTION_KEYS) {
    const present = data.sections[key];
    if (present !== undefined && present !== true && present !== false) {
      errors.push('sections.' + key + ': ожидается boolean');
    }
  }

  // Собираем content по sections
  const presentSections = [];
  for (const key of SECTION_KEYS) {
    if (data.sections && data.sections[key] === true) {
      presentSections.push(key);
      const arr = data.data[key];
      if (!Array.isArray(arr)) {
        errors.push('data.' + key + ': ожидается массив');
      } else {
        content[key] = arr;
        counts[key] = arr.length;
      }
    }
  }

  if (presentSections.length === 0) {
    errors.push('нет известных секций в sections');
  }

  // Проверка counts: должны совпадать с длинами
  const countKeys = ['notes', 'evidence', 'meta', 'logs'];
  for (const key of countKeys) {
    const expected = counts[key] !== undefined ? counts[key] : 0;
    const declared = data.counts ? data.counts[key] : undefined;
    if (declared !== undefined && declared !== expected) {
      errors.push('counts.' + key + ': объявлено ' + declared + ', фактически ' + expected);
    }
  }

  // Проверка checksum
  if (hasOwn(data, 'checksum')) {
    try {
      const actual = checksum(data.data);
      if (actual !== data.checksum) {
        warnings.push('checksum: не совпадает (ожидался ' + actual + ', получен ' + data.checksum + ')');
      }
    } catch (e) {
      warnings.push('checksum: ошибка вычисления: ' + e.message);
    }
  } else {
    warnings.push('checksum: отсутствует (файл без проверки целостности)');
  }

  return { errors, warnings, content, counts };
}

// ── computeFileHash — SHA-256 файла с exportId ──────────────────────────────

/**
 * Вычисляет хэш файла для IMPORT-события.
 * @param {Uint8Array} fileBytes — байты JSON-файла.
 * @param {string} exportId — exportId из манифеста.
 * @returns {string} — 'sha256:' + lowercase hex.
 */
export function computeFileHash(fileBytes, exportId) {
  const fileCanon = canonicalJson({ fileBytes: Array.from(new Uint8Array(fileBytes)), exportId });
  const hash = sha256(uint8ArrayFromString(fileCanon));
  return 'sha256:' + hash.toLowerCase();
}