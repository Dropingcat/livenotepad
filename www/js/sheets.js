import { BRANCHES, BRANCH_KEYS, TUNING } from './constants.js';

export const SHEET_MAIN = null;

export function isActiveNote(note) {
  return !note.deletedAt && note.completedAt == null;
}

export function countActiveByBranch(notes) {
  const counts = new Map();
  for (const key of BRANCH_KEYS) counts.set(key, 0);
  for (const n of notes) {
    if (isActiveNote(n) && n.branch && BRANCH_KEYS.includes(n.branch)) {
      counts.set(n.branch, (counts.get(n.branch) || 0) + 1);
    }
  }
  return counts;
}

export function sheetTitle(key) {
  if (key == null) return 'Все';
  const name = BRANCHES[key]?.name;
  if (!name) return key;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function computeSheets(notes, threshold = TUNING.SHEET_OVERFLOW_THRESHOLD) {
  const counts = countActiveByBranch(notes);
  const overflow = BRANCH_KEYS.filter(k => (counts.get(k) || 0) > threshold);
  const overflowSet = new Set(overflow);
  let mainCount = 0;
  for (const n of notes) {
    if (isActiveNote(n)) {
      if (n.branch == null || !overflowSet.has(n.branch)) {
        mainCount++;
      }
    }
  }
  const sheets = [{ key: null, title: 'Все', count: mainCount }];
  for (const k of overflow) {
    sheets.push({ key: k, title: sheetTitle(k), count: counts.get(k) || 0 });
  }
  return sheets;
}

export function overflowKeys(sheets) {
  return sheets.slice(1).map(s => s.key);
}

export function isOnSheet(note, sheetKey, overflow) {
  const set = overflow instanceof Set ? overflow : new Set(overflow);
  if (sheetKey === null) {
    return note.branch == null || !set.has(note.branch);
  }
  return note.branch === sheetKey;
}

export function filterBySheet(notes, sheetKey, overflow) {
  const set = overflow instanceof Set ? overflow : new Set(overflow);
  return notes.filter(n => isOnSheet(n, sheetKey, set));
}

export function resolveActiveSheet(sheets, activeKey) {
  if (activeKey == null) return null;
  return sheets.some(s => s.key === activeKey) ? activeKey : null;
}

export function shiftSheet(sheets, activeKey, delta) {
  const keys = sheets.map(s => s.key);
  const i = keys.indexOf(resolveActiveSheet(sheets, activeKey));
  if (i < 0) return null;
  const next = Math.max(0, Math.min(keys.length - 1, i + delta));
  return keys[next];
}