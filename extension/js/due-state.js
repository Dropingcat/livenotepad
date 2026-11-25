import { TUNING } from './constants.js';
import { DAY_MS, endOfDayBoundary } from './time.js';

export const DueState = {
  NONE: 'NONE',
  PENDING: 'PENDING',
  DUE_TODAY: 'DUE_TODAY',
  OVERDUE: 'OVERDUE',
  DONE: 'DONE',
  STALE: 'STALE'
};

export const DueStateCalculator = {
  of(note, now = Date.now()) {
    if (note.completedAt != null) return DueState.DONE;
    if (note.dueAt == null) return DueState.NONE;
    // STALE проверяем до OVERDUE, иначе ветка недостижима.
    if (now - note.dueAt > TUNING.STALE_AFTER_DAYS * DAY_MS) return DueState.STALE;
    if (note.dueAt < now) return DueState.OVERDUE;
    if (note.dueAt <= endOfDayBoundary(now)) return DueState.DUE_TODAY;
    return DueState.PENDING;
  },
  sortKey(state) {
    return {
      STALE: 0,
      OVERDUE: 1,
      DUE_TODAY: 2,
      PENDING: 3,
      NONE: 4,
      DONE: 5
    }[state];
  }
};

export function isOverdue(state) {
  return state === DueState.OVERDUE || state === DueState.STALE;
}
