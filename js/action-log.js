// Модуль журнала действий — обёртка над аудитом с дополнительными полями.
import { makeEvent as auditMakeEvent } from './audit.js';

/**
 * Создаёт событие для журнала действий через audit.makeEvent.
 * @param {Object} opts
 * @param {string} opts.type       — CREATE | COMPLETE | REOPEN | CORRECT | DELETE | RESTORE | UNDO_DELETE | EDIT | IMPORT | EXPORT | EXPORT_AUDIT | RESET | BACKUP | RESTORE_BACKUP | UI | APP_START | APP_RESUME | APP_HIDDEN | MIDNIGHT | ERROR
 * @param {string} [opts.source='system'] — 'ui' | 'system' | 'export' | 'import'
 * @param {string} [opts.result='ok']     — 'ok' | 'error'
 * @param {string} [opts.noteId]
 * @param {string} [opts.text]
 * @param {string} [opts.branch]
 * @param {string} [opts.from]
 * @param {string} [opts.to]
 * @param {Object} [opts.counts]          — { notes?, evidence?, meta?, logs? }
 * @param {string} [opts.mode]            — 'full' | 'partial' | 'merge' | 'replace'
 * @param {string} [opts.fileHash]        — 'sha256:...'
 * @param {number} [opts.backupId]
 * @param {Object} [opts.details]
 * @returns {Object} событие аудита
 */
export function makeEvent({ type, source, result, noteId, text, branch, from, to, counts, mode, fileHash, backupId, details } = {}) {
  const eventId = crypto.randomUUID();
  const ts = Date.now();

  const payload = {
    eventId,
    ts,
    type: type || 'UNKNOWN',
    source: source || 'system',
    result: result || 'ok'
  };

  if (noteId !== undefined) payload.noteId = noteId;
  if (text !== undefined) payload.text = text;
  if (branch !== undefined) payload.branch = branch;
  if (from !== undefined) payload.from = from;
  if (to !== undefined) payload.to = to;
  if (counts !== undefined) payload.counts = counts;
  if (mode !== undefined) payload.mode = mode;
  const extraDetails = {};
  if (fileHash !== undefined) extraDetails.fileHash = fileHash;
  if (backupId !== undefined) extraDetails.backupId = backupId;
  if (details !== undefined) Object.assign(extraDetails, details);
  if (Object.keys(extraDetails).length > 0) payload.details = extraDetails;

  return auditMakeEvent(payload);
}

/**
 * Сливает два массива логов по eventId (дедупликация).
 * incoming заменяет записи с тем же eventId.
 * Не мутирует исходные массивы.
 * @param {Array} existing
 * @param {Array} incoming
 * @returns {Array} новый массив
 */
export function mergeEvents(existing, incoming) {
  const existingArr = Array.isArray(existing) ? existing : [];
  const incomingArr = Array.isArray(incoming) ? incoming : [];

  const seen = new Set();
  const result = [];

  for (const e of existingArr) {
    if (e && typeof e === 'object') {
      const id = typeof e.eventId === 'string' && e.eventId ? e.eventId : '';
      if (id && !seen.has(id)) {
        seen.add(id);
        result.push(e);
      }
    }
  }

  for (const e of incomingArr) {
    if (e && typeof e === 'object') {
      const id = typeof e.eventId === 'string' && e.eventId ? e.eventId : '';
      if (id) {
        if (seen.has(id)) {
          // Замена существующего с тем же eventId
          const idx = result.findIndex(r => r.eventId === id);
          if (idx !== -1) result[idx] = e;
        } else {
          seen.add(id);
          result.push(e);
        }
      } else {
        // Без eventId — просто добавляем
        if (e.eventId === undefined || e.eventId === null) {
          result.push(e);
        }
      }
    }
  }

  return result;
}

/**
 * Возвращает массив строк-типов для фильтра монитора.
 * @returns {string[]}
 */
export function typeFilterTypes() {
  return [
    'ALL', 'CREATE', 'COMPLETE', 'REOPEN', 'CORRECT',
    'DELETE', 'RESTORE', 'UNDO_DELETE', 'EDIT',
    'IMPORT', 'EXPORT', 'EXPORT_AUDIT',
    'RESET', 'BACKUP', 'RESTORE_BACKUP',
    'UI', 'MIDNIGHT', 'ERROR'
  ];
}

/**
 * Возвращает CSS-класс для тега по типу события.
 * @param {string} type
 * @returns {string}
 */
export function typeTagClass(type) {
  switch (type) {
    case 'CREATE':   return 'create';
    case 'COMPLETE': return 'complete';
    case 'CORRECT':  return 'correct';
    case 'REOPEN':   return 'reopen';
    case 'DELETE':   return 'delete';
    case 'RESTORE':
    case 'UNDO_DELETE': return 'restore';
    case 'IMPORT':   return 'import';
    case 'EXPORT':
    case 'EXPORT_AUDIT': return 'export';
    case 'ERROR':    return 'error';
    case 'RESET':    return 'reset';
    case 'BACKUP':
    case 'RESTORE_BACKUP': return 'backup';
    default:         return 'default';
  }
}