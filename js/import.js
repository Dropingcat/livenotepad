// Импорт: валидация файла и слияние снимков.
// Модуль чистый — без DOM и IndexedDB, чтобы правила проверялись тестами.

import { BRANCHES, BRANCH_SOURCES, TUNING } from './constants.js';

export const CURRENT_VERSION = 'alpha-v0.3';
export const CURRENT_SCHEMA_VERSION = 3;

const SECTION_NAMES = ['notes', 'word_evidence', 'word_meta', 'training_log'];
const NOTE_TIME_FIELDS = ['completedAt', 'reopenedAt', 'dueAt', 'deletedAt'];

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function toCount(value) {
  return isFiniteNumber(value) ? value : 0;
}

function evidenceKey(row) {
  return String(row.stem) + '\u0000' + String(row.branch);
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray !== bIsArray) return false;
  if (aIsArray) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(key => hasOwn(b, key) && deepEqual(a[key], b[key]));
}

/**
 * Валидация файла импорта. Принимает новый формат {data: {...}} и старый
 * верхнеуровневый. Возвращает только данные, ничего не пишет в БД.
 */
export function validateImport(input) {
  const errors = [];
  const warnings = [];
  const sections = { notes: [], word_evidence: [], word_meta: [], training_log: [] };
  const counts = { notes: 0, word_evidence: 0, word_meta: 0, training_log: 0 };

  if (!isPlainObject(input)) {
    errors.push('импорт: ожидается JSON-объект, а не ' + (Array.isArray(input) ? 'массив' : typeof input));
    return { errors, warnings, sections, counts };
  }

  const source = isPlainObject(input.data) ? input.data : input;

  if (hasOwn(input, 'tuning') || (source !== input && hasOwn(source, 'tuning'))) {
    warnings.push('tuning: настройки классификатора не применяются');
  }
  if (input.version !== undefined && input.version !== CURRENT_VERSION) {
    warnings.push(`version: ${String(input.version)} вместо ${CURRENT_VERSION}`);
  }
  if (input.schemaVersion !== undefined && input.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    warnings.push(`schemaVersion: ${String(input.schemaVersion)} вместо ${CURRENT_SCHEMA_VERSION}`);
  }

  const hasLogsAlias = hasOwn(source, 'logs');
  const hasTrainingLog = hasOwn(source, 'training_log');
  if (hasLogsAlias && hasTrainingLog) {
    warnings.push('logs отброшен: используется training_log');
  } else if (hasLogsAlias) {
    warnings.push('logs → training_log');
  }

  const present = {
    notes: hasOwn(source, 'notes'),
    word_evidence: hasOwn(source, 'word_evidence'),
    word_meta: hasOwn(source, 'word_meta'),
    training_log: hasOwn(source, 'training_log') || hasLogsAlias
  };
  const raw = {
    notes: source.notes,
    word_evidence: source.word_evidence,
    word_meta: source.word_meta,
    training_log: hasOwn(source, 'training_log') ? source.training_log : (hasLogsAlias ? source.logs : undefined)
  };

  if (!SECTION_NAMES.some(name => present[name])) {
    errors.push('нет известных секций (notes, word_evidence, word_meta, training_log)');
    return { errors, warnings, sections, counts };
  }

  for (const name of SECTION_NAMES) {
    if (!present[name]) continue;
    if (!Array.isArray(raw[name])) {
      errors.push(`секция ${name}: ожидается массив`);
    } else {
      sections[name] = raw[name];
      counts[name] = raw[name].length;
    }
  }

  const missing = SECTION_NAMES.filter(name => !present[name]);
  if (missing.length > 0) {
    warnings.push('частичный файл: отсутствуют ' + missing.join(', ') + ' (режим «объединить»)');
  }

  const unknownBranches = new Set();
  const unknownSources = new Set();
  const seenNoteIds = new Set();

  sections.notes.forEach((note, index) => {
    if (!isPlainObject(note)) {
      errors.push(`notes[${index}]: ожидается объект`);
      return;
    }
    if (!isNonEmptyString(note.id)) {
      errors.push(`notes[${index}]: id должен быть непустой строкой`);
    } else if (seenNoteIds.has(note.id)) {
      errors.push(`notes[${index}]: дубль id ${note.id}`);
    } else {
      seenNoteIds.add(note.id);
    }
    if (!isNonEmptyString(note.text)) errors.push(`notes[${index}]: пустой text`);
    if (!isFiniteNumber(note.createdAt)) errors.push(`notes[${index}]: createdAt должен быть конечным числом`);
    for (const field of NOTE_TIME_FIELDS) {
      const value = note[field];
      if (value !== undefined && value !== null && !isFiniteNumber(value)) {
        errors.push(`notes[${index}]: ${field} должен быть null или числом`);
      }
    }
    if (note.branchConfidence !== undefined && !isFiniteNumber(note.branchConfidence)) {
      errors.push(`notes[${index}]: branchConfidence должен быть числом`);
    }
    if (note.branch !== undefined && note.branch !== '' &&
        !(typeof note.branch === 'string' && hasOwn(BRANCHES, note.branch))) {
      unknownBranches.add(String(note.branch));
    }
    if (note.branchSource !== undefined && !BRANCH_SOURCES.includes(note.branchSource)) {
      unknownSources.add(String(note.branchSource));
    }
  });

  const seenEvidence = new Set();
  const duplicateEvidence = new Set();
  sections.word_evidence.forEach((row, index) => {
    if (!isPlainObject(row)) {
      errors.push(`word_evidence[${index}]: ожидается объект`);
      return;
    }
    if (!isNonEmptyString(row.stem)) errors.push(`word_evidence[${index}]: stem обязателен`);
    if (!hasOwn(row, 'branch') || typeof row.branch !== 'string') {
      errors.push(`word_evidence[${index}]: branch должен быть строкой`);
    }
    if (row.evidence !== undefined && !isFiniteNumber(row.evidence)) {
      errors.push(`word_evidence[${index}]: evidence должен быть числом`);
    }
    if (row.distinctNotes !== undefined && !isFiniteNumber(row.distinctNotes)) {
      errors.push(`word_evidence[${index}]: distinctNotes должен быть числом`);
    }
    if (isNonEmptyString(row.stem) && typeof row.branch === 'string') {
      const key = evidenceKey(row);
      if (seenEvidence.has(key)) duplicateEvidence.add(`${row.stem} / ${row.branch === '' ? '""' : row.branch}`);
      else seenEvidence.add(key);
    }
    if (typeof row.branch === 'string' && row.branch !== '' && !hasOwn(BRANCHES, row.branch)) {
      unknownBranches.add(row.branch);
    }
  });
  if (duplicateEvidence.size > 0) {
    warnings.push('дубли (stem, branch) схлопнутся put: ' + [...duplicateEvidence].join(', '));
  }

  const seenStems = new Set();
  const duplicateStems = new Set();
  sections.word_meta.forEach((row, index) => {
    if (!isPlainObject(row)) {
      errors.push(`word_meta[${index}]: ожидается объект`);
      return;
    }
    if (!isNonEmptyString(row.stem)) {
      errors.push(`word_meta[${index}]: stem обязателен`);
      return;
    }
    if (seenStems.has(row.stem)) duplicateStems.add(row.stem);
    else seenStems.add(row.stem);
    if (hasOwn(row, 'userCurated') && typeof row.userCurated !== 'boolean') {
      warnings.push(`word_meta[${index}]: userCurated должен быть boolean, будет проигнорирован`);
    }
  });
  if (duplicateStems.size > 0) {
    warnings.push('дубли stem схлопнутся put: ' + [...duplicateStems].join(', '));
  }

  sections.training_log.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      errors.push(`training_log[${index}]: ожидается объект`);
      return;
    }
    if (entry.id !== undefined && (!Number.isInteger(entry.id) || entry.id < 0)) {
      errors.push(`training_log[${index}]: id должен быть целым >= 0`);
    }
    if (entry.ts !== undefined && !isFiniteNumber(entry.ts)) {
      warnings.push(`training_log[${index}]: ts должен быть конечным числом`);
    }
    if (entry.type !== undefined && !isNonEmptyString(entry.type)) {
      warnings.push(`training_log[${index}]: type должен быть непустой строкой`);
    }
  });

  for (const branch of unknownBranches) warnings.push('неизвестный branch: ' + branch);
  for (const branchSource of unknownSources) warnings.push('неизвестный branchSource: ' + branchSource);

  return { errors, warnings, sections, counts };
}

/**
 * Пересчёт word_meta по строкам evidence. Повторяет пороги
 * WordLearningService.recomputeMeta, но без БД. Возвращает строки
 * для объединения stem из evidence и existingMeta.
 *
 * Tie-break при равном evidence повторяет рантайм: recomputeMeta читает
 * getAll() (возрастание ключа ['stem','branch']) и берёт последний максимум
 * через `>`; здесь positive сортируется по branch и максимум тоже берётся
 * последним, иначе равные evidence дают другой distinctNotes/state.
 */
export function computeMetaFromEvidence(evidenceRows, existingMeta = []) {
  const rows = Array.isArray(evidenceRows) ? evidenceRows : [];
  const metas = Array.isArray(existingMeta)
    ? existingMeta.filter(isPlainObject)
    : (isPlainObject(existingMeta) ? [existingMeta] : []);

  const stems = [];
  const seen = new Set();
  for (const meta of metas) {
    if (typeof meta.stem === 'string' && !seen.has(meta.stem)) { seen.add(meta.stem); stems.push(meta.stem); }
  }
  for (const row of rows) {
    if (typeof row.stem === 'string' && !seen.has(row.stem)) { seen.add(row.stem); stems.push(row.stem); }
  }

  return stems.map(stem => {
    const metaRows = metas.filter(meta => meta.stem === stem);
    const merged = metaRows.reduce((acc, meta) => ({ ...acc, ...meta }), {});
    const userCurated = metaRows.some(meta => meta.userCurated === true);
    const positive = rows.filter(row => row.stem === stem && toCount(row.evidence) > 0);

    if (positive.length === 0) {
      return { ...merged, stem, state: 'CANDIDATE', distinctNotes: 0, userCurated };
    }

    const total = positive.reduce((sum, row) => sum + toCount(row.evidence), 0);
    const ordered = [...positive].sort((a, b) => {
      const ba = String(a.branch);
      const bb = String(b.branch);
      if (ba === bb) return 0;
      return ba < bb ? -1 : 1;
    });
    const best = ordered.reduce((a, b) => toCount(a.evidence) > toCount(b.evidence) ? a : b);
    const ratio = toCount(best.evidence) / total;
    const bestDistinctNotes = toCount(best.distinctNotes);
    const state = (toCount(best.evidence) >= TUNING.CONFIRMED_MIN_EVIDENCE &&
        bestDistinctNotes >= TUNING.CONFIRMED_MIN_DISTINCT_NOTES &&
        ratio >= TUNING.CONFIRMED_MIN_RATIO)
      ? 'CONFIRMED'
      : (bestDistinctNotes >= TUNING.PROVISIONAL_MIN_DISTINCT_NOTES ? 'PROVISIONAL' : 'CANDIDATE');

    return { ...merged, stem, state, distinctNotes: bestDistinctNotes, userCurated };
  });
}

/**
 * План слияния текущего состояния с импортируемым. Не мутирует входы.
 * Возвращает полные наборы для одной транзакции и статистику.
 */
export function planImport(current = {}, incoming = {}) {
  const currentNotes = Array.isArray(current.notes) ? current.notes : [];
  const incomingNotes = Array.isArray(incoming.notes) ? incoming.notes : [];
  const currentEvidence = Array.isArray(current.evidence) ? current.evidence : [];
  const incomingEvidence = Array.isArray(incoming.evidence) ? incoming.evidence : [];
  const currentMeta = Array.isArray(current.meta) ? current.meta : [];
  const incomingMeta = Array.isArray(incoming.meta) ? incoming.meta : [];
  const currentLogs = Array.isArray(current.logs) ? current.logs : [];
  const incomingLogs = Array.isArray(incoming.logs) ? incoming.logs : [];

  let notesAdded = 0;
  let notesUpdated = 0;
  let notesUnchanged = 0;
  const notes = currentNotes.map(note => ({ ...note }));
  const noteIndex = new Map();
  notes.forEach((note, index) => noteIndex.set(note.id, index));

  for (const incomingNote of incomingNotes) {
    if (!isPlainObject(incomingNote)) continue;
    const index = noteIndex.get(incomingNote.id);
    if (index === undefined) {
      notes.push({ ...incomingNote });
      noteIndex.set(incomingNote.id, notes.length - 1);
      notesAdded += 1;
      continue;
    }
    const merged = { ...notes[index], ...incomingNote, id: incomingNote.id };
    if (deepEqual(notes[index], merged)) {
      notesUnchanged += 1;
    } else {
      notes[index] = merged;
      notesUpdated += 1;
    }
  }

  let evidenceAdded = 0;
  let evidenceUpdated = 0;
  let evidenceUnchanged = 0;
  const evidence = currentEvidence.map(row => ({ ...row }));
  const evidenceIndex = new Map();
  evidence.forEach((row, index) => evidenceIndex.set(evidenceKey(row), index));

  const incomingByKey = new Map();
  for (const row of incomingEvidence) {
    if (!isPlainObject(row)) continue;
    incomingByKey.set(evidenceKey(row), row);
  }
  const legacyEvidence = incomingByKey.size;

  for (const [key, incomingRow] of incomingByKey) {
    const index = evidenceIndex.get(key);
    if (index === undefined) {
      evidence.push({
        ...incomingRow,
        stem: incomingRow.stem,
        branch: incomingRow.branch,
        evidence: toCount(incomingRow.evidence),
        distinctNotes: toCount(incomingRow.distinctNotes),
        lastSeenAt: toCount(incomingRow.lastSeenAt)
      });
      evidenceIndex.set(key, evidence.length - 1);
      evidenceAdded += 1;
      continue;
    }
    const existing = evidence[index];
    const merged = {
      ...existing,
      ...incomingRow,
      stem: incomingRow.stem,
      branch: incomingRow.branch,
      evidence: Math.max(toCount(existing.evidence), toCount(incomingRow.evidence)),
      distinctNotes: Math.max(toCount(existing.distinctNotes), toCount(incomingRow.distinctNotes)),
      lastSeenAt: Math.max(toCount(existing.lastSeenAt), toCount(incomingRow.lastSeenAt))
    };
    if (deepEqual(existing, merged)) {
      evidenceUnchanged += 1;
    } else {
      evidence[index] = merged;
      evidenceUpdated += 1;
    }
  }

  const meta = computeMetaFromEvidence(evidence, [...currentMeta, ...incomingMeta]);
  const currentMetaByStem = new Map();
  for (const row of currentMeta) {
    if (isPlainObject(row) && typeof row.stem === 'string') currentMetaByStem.set(row.stem, row);
  }
  const stateChanges = [];
  for (const row of meta) {
    const before = currentMetaByStem.get(row.stem);
    if (before && before.state !== row.state) {
      stateChanges.push({ stem: row.stem, from: before.state, to: row.state });
    }
  }

  const logs = currentLogs.map(entry => ({ ...entry }));
  const knownEventIds = new Set();
  const knownIds = new Set();
  for (const entry of logs) {
    if (typeof entry.eventId === 'string' && entry.eventId !== '') knownEventIds.add(entry.eventId);
    if (Number.isInteger(entry.id) && entry.id >= 0) knownIds.add(entry.id);
  }

  let logsAdded = 0;
  for (const incomingLog of incomingLogs) {
    if (!isPlainObject(incomingLog)) continue;
    const eventId = typeof incomingLog.eventId === 'string' && incomingLog.eventId !== ''
      ? incomingLog.eventId
      : null;
    const rawId = Number.isInteger(incomingLog.id) && incomingLog.id >= 0 ? incomingLog.id : null;

    if (eventId && knownEventIds.has(eventId)) continue;
    if (!eventId && rawId !== null && knownIds.has(rawId)) continue;

    let entry = { ...incomingLog };
    if (rawId !== null && knownIds.has(rawId)) {
      delete entry.id;
    }
    logs.push(entry);
    if (eventId) knownEventIds.add(eventId);
    if (Number.isInteger(entry.id) && entry.id >= 0) knownIds.add(entry.id);
    logsAdded += 1;
  }

  return {
    notes,
    evidence,
    meta,
    logs,
    stats: {
      notesAdded,
      notesUpdated,
      notesUnchanged,
      evidenceAdded,
      evidenceUpdated,
      evidenceUnchanged,
      metaRecomputed: meta.length,
      logsAdded,
      stateChanges,
      legacyEvidence
    }
  };
}
