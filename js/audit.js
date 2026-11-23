// Аудит «Живого блокнота» — чистые функции без DOM.
// storage инъектируется: localStorage, фейк в тестах или null.

export const DEFAULT_DEVICE_KEY = 'livenotepad.deviceId';
export const DEFAULT_FALLBACK_KEY = 'livenotepad.auditFallback';
export const DEFAULT_APP_VERSION = 'alpha v0.3';
export const AUDIT_FORMAT = 'livenotepad-audit';
export const AUDIT_VERSION = 1;

// Поля верхнего уровня, которые читает существующий renderLogs (и легаси-логи).
export const LEGACY_FIELDS = Object.freeze(['noteId', 'branch', 'text', 'from', 'to', 'mode', 'counts']);

function uuidFallback() {
  const bytes = new Uint8Array(16);
  try {
    if (typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
  } catch (e) {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// UUID v4; crypto.randomUUID, если есть, иначе безопасный fallback.
export function newId() {
  try {
    if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') {
      const id = crypto.randomUUID();
      if (typeof id === 'string' && id.length > 0) return id;
    }
  } catch (e) { /* deterministic fallback below */ }
  return uuidFallback();
}

export function createSessionId() {
  return newId();
}

export function getOrCreateDeviceId(storage, key = DEFAULT_DEVICE_KEY) {
  let existing = null;
  try {
    existing = storage && typeof storage.getItem === 'function' ? storage.getItem(key) : null;
  } catch (e) {
    existing = null;
  }
  if (typeof existing === 'string' && existing.trim() !== '') return existing;
  const id = newId();
  try {
    if (storage && typeof storage.setItem === 'function') storage.setItem(key, id);
  } catch (e) { /* deviceId остаётся только в памяти */ }
  return id;
}

// Полный текст заметки в аудит не пишется: максимум первых 100 символов.
export function truncateText(text, max = 100) {
  const s = text == null ? '' : String(text);
  const limit = Number.isFinite(max) && max >= 0 ? Math.floor(max) : 100;
  return s.length > limit ? s.slice(0, limit) : s;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// payload → событие схемы аудита. Legacy-поля сохраняются на верхнем уровне.
export function makeEvent(payload = {}, meta = {}) {
  const p = isPlainObject(payload) ? payload : {};
  const m = isPlainObject(meta) ? meta : {};
  const type = typeof p.type === 'string' && p.type ? p.type : 'UNKNOWN';
  const details = {};
  if (isPlainObject(p.details)) Object.assign(details, p.details);
  if (p.noteId !== undefined && details.noteId === undefined) details.noteId = p.noteId;
  if (p.branch !== undefined && details.branch === undefined) details.branch = p.branch;
  if (p.action !== undefined && details.action === undefined) details.action = p.action;
  if (p.counts !== undefined && details.counts === undefined) details.counts = p.counts;
  if (details.text !== undefined) details.text = truncateText(details.text);

  const event = {
    eventId: typeof p.eventId === 'string' && p.eventId ? p.eventId : newId(),
    ts: typeof p.ts === 'number' && Number.isFinite(p.ts) ? p.ts : Date.now(),
    sessionId: p.sessionId || m.sessionId || '',
    deviceId: p.deviceId || m.deviceId || '',
    type,
    source: p.source || 'system',
    result: p.result || 'ok',
    appVersion: p.appVersion || m.appVersion || DEFAULT_APP_VERSION,
    context: p.context || '',
    message: typeof p.message === 'string' ? p.message : '',
    stack: typeof p.stack === 'string' ? p.stack : '',
    details
  };

  for (const key of LEGACY_FIELDS) {
    if (p[key] === undefined) continue;
    event[key] = key === 'text' ? truncateText(p[key]) : p[key];
  }
  return event;
}

function normalizeError(err) {
  if (err instanceof Error) {
    return { message: err.message || err.name || 'Error', stack: err.stack || '' };
  }
  if (typeof err === 'string') return { message: err, stack: '' };
  if (err === null || err === undefined) return { message: 'Unknown error', stack: '' };
  if (typeof err === 'object') {
    let message = typeof err.message === 'string' ? err.message : '';
    if (!message && typeof err.name === 'string') message = err.name;
    if (!message) {
      try { message = JSON.stringify(err); } catch (e) { message = String(err); }
    }
    return { message: message || 'Unknown error', stack: typeof err.stack === 'string' ? err.stack : '' };
  }
  return { message: String(err), stack: '' };
}

// Ошибка любого вида → событие ERROR с context/message/stack.
export function errorEvent(context, err, meta = {}) {
  const m = isPlainObject(meta) ? meta : {};
  const norm = normalizeError(err);
  const details = {};
  if (isPlainObject(m.details)) Object.assign(details, m.details);
  if (context) details.context = context;
  return makeEvent({
    type: 'ERROR',
    source: m.source || 'system',
    result: 'error',
    context: context || 'unknown',
    message: norm.message,
    stack: norm.stack,
    details
  }, m);
}

// Чтение логов из БД для экспорта. Сбой чтения пробрасывается (R-1):
// пустой список допустим только при реально пустой БД, а не при ошибке.
export async function readAuditLogs(getAllLogs) {
  if (typeof getAllLogs !== 'function') throw new TypeError('getAllLogs is not a function');
  const logs = await getAllLogs();
  return Array.isArray(logs) ? logs.filter(e => isPlainObject(e)) : [];
}

// Экспорт аудита: мета + все события, отсортированные по ts.
// meta.pendingEvents (fallback-очередь) подмешивается с дедупликацией по eventId,
// чтобы событие, не дошедшее до БД в этой сессии, не пропало из выгрузки.
export function buildAuditExport(events, meta = {}) {
  const m = isPlainObject(meta) ? meta : {};
  const list = Array.isArray(events) ? events.filter(e => isPlainObject(e)) : [];
  const pendingList = Array.isArray(m.pendingEvents) ? m.pendingEvents.filter(e => isPlainObject(e)) : [];

  const seen = new Set();
  const merged = [];
  function addEvent(event) {
    const id = typeof event.eventId === 'string' && event.eventId ? event.eventId : '';
    if (id) {
      if (seen.has(id)) return;
      seen.add(id);
    }
    merged.push(event);
  }
  for (const event of list) addEvent(event);
  for (const event of pendingList) addEvent(event);

  const sorted = merged
    .map((event, index) => ({ event, index }))
    .sort((a, b) => {
      const ta = typeof a.event.ts === 'number' && Number.isFinite(a.event.ts) ? a.event.ts : 0;
      const tb = typeof b.event.ts === 'number' && Number.isFinite(b.event.ts) ? b.event.ts : 0;
      return ta === tb ? a.index - b.index : ta - tb;
    })
    .map(entry => entry.event);
  // errors — любая ошибка (тип ERROR или result:'error'); failed — только result:'error'.
  const failed = sorted.filter(e => e.result === 'error').length;
  const errors = sorted.filter(e => e.type === 'ERROR' || e.result === 'error').length;
  const pending = Number.isFinite(m.pending) ? Math.max(0, Math.floor(m.pending)) : pendingList.length;
  const lost = Number.isFinite(m.lost) ? Math.max(0, Math.floor(m.lost)) : 0;
  return {
    format: AUDIT_FORMAT,
    version: AUDIT_VERSION,
    exportedAt: typeof m.exportedAt === 'string' && m.exportedAt ? m.exportedAt : new Date().toISOString(),
    appVersion: m.appVersion || DEFAULT_APP_VERSION,
    sessionId: m.sessionId || '',
    deviceId: m.deviceId || '',
    userAgent: m.userAgent || '',
    platform: m.platform || '',
    counts: { events: sorted.length, errors, failed },
    pending,
    lost,
    events: sorted
  };
}

// Кольцевая очередь в localStorage на случай недоступной БД.
// storage может быть null или бросать — функции не падают.
export function createFallbackQueue(storage, key = DEFAULT_FALLBACK_KEY, limit = 200) {
  const max = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 200;
  // Потери в памяти: сбой записи и вытеснение кольцом. Наружу — через lost().
  let lost = 0;

  function read() {
    try {
      if (!storage || typeof storage.getItem !== 'function') return [];
      const raw = storage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(item => isPlainObject(item)) : [];
    } catch (e) {
      return [];
    }
  }

  function write(list) {
    try {
      if (!storage || typeof storage.setItem !== 'function') return false;
      storage.setItem(key, JSON.stringify(list));
      return true;
    } catch (e) {
      return false;
    }
  }

  return {
    push(event) {
      if (!isPlainObject(event)) return false;
      const list = read();
      list.push(event);
      let dropped = 0;
      while (list.length > max) { list.shift(); dropped++; }
      const ok = write(list);
      if (!ok) { lost += 1 + dropped; return false; }
      lost += dropped;
      return true;
    },
    drain() {
      const list = read();
      write([]);
      return list;
    },
    // Текущее содержимое очереди без удаления (для выгрузки и безопасного flush).
    snapshot() {
      return read();
    },
    // Первое событие без удаления (null, если пусто).
    peek() {
      const list = read();
      return list.length > 0 ? list[0] : null;
    },
    // Удаляет первое событие; вызывать только после успешной записи в БД.
    shift() {
      const list = read();
      if (list.length === 0) return null;
      const first = list.shift();
      write(list);
      return first;
    },
    // Возвращает неуспешные события в начало очереди (для flush при сбое).
    restore(events) {
      const add = Array.isArray(events) ? events.filter(item => isPlainObject(item)) : [];
      if (add.length === 0) return true;
      const current = read();
      const merged = add.concat(current);
      let dropped = 0;
      while (merged.length > max) { merged.pop(); dropped++; }
      const ok = write(merged);
      if (!ok) { lost += add.length; return false; }
      lost += dropped;
      return true;
    },
    size() {
      return read().length;
    },
    // Счётчик потерянных событий (в памяти, без сохранения).
    lost() {
      return lost;
    }
  };
}

// Перенос очереди в БД без потерь: событие удаляется из очереди только после
// успешного addLog; неуспешные возвращаются в начало очереди.
// addLog(event) может быть sync или async; ошибки не пробрасываются.
export async function flushAuditQueue(queue, addLog) {
  let written = 0;
  let lastError = null;
  const failed = [];
  const total = queue.size();
  for (let i = 0; i < total; i++) {
    const ev = queue.peek();
    if (!ev) break;
    try {
      await addLog(ev);
      // Удаляем только успешно записанное (при падении между addLog и shift
      // событие останется в очереди — дубль лучше потери).
      queue.shift();
      written++;
    } catch (err) {
      // Сдвигаем сбойное событие, чтобы продолжить; в конце вернём в очередь.
      queue.shift();
      failed.push(ev);
      lastError = err;
    }
  }
  if (failed.length > 0) queue.restore(failed);
  return { written, failed: failed.length, lastError };
}

