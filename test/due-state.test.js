import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DueState, DueStateCalculator, isOverdue } from '../www/js/due-state.js';

const NOW = new Date(2026, 10, 17, 10, 0, 0, 0).getTime();
const at = (day, h, m = 0) => new Date(2026, 10, day, h, m, 0, 0).getTime();
const note = (overrides = {}) => ({ completedAt: null, dueAt: null, ...overrides });

test('без срока — NONE', () => {
  assert.equal(DueStateCalculator.of(note(), NOW), DueState.NONE);
});

test('срок сегодня впереди — DUE_TODAY', () => {
  assert.equal(DueStateCalculator.of(note({ dueAt: at(17, 20) }), NOW), DueState.DUE_TODAY);
});

test('срок сегодня уже прошёл — OVERDUE', () => {
  assert.equal(DueStateCalculator.of(note({ dueAt: at(17, 9) }), NOW), DueState.OVERDUE);
});

test('срок завтра — PENDING', () => {
  assert.equal(DueStateCalculator.of(note({ dueAt: at(18, 20) }), NOW), DueState.PENDING);
});

test('закрытая задача — DONE', () => {
  assert.equal(
    DueStateCalculator.of(note({ dueAt: at(17, 20), completedAt: NOW - 1000 }), NOW),
    DueState.DONE
  );
});

test('просрочено больше 7 дней — STALE', () => {
  assert.equal(
    DueStateCalculator.of(note({ dueAt: new Date(2026, 10, 9, 10, 0, 0, 0).getTime() }), NOW),
    DueState.STALE
  );
});

test('просрочено ровно 7 дней — ещё OVERDUE, не STALE', () => {
  assert.equal(
    DueStateCalculator.of(note({ dueAt: new Date(2026, 10, 10, 10, 0, 0, 0).getTime() }), NOW),
    DueState.OVERDUE
  );
});

test('STALE и OVERDUE считаются просроченными для UI', () => {
  assert.equal(isOverdue(DueState.OVERDUE), true);
  assert.equal(isOverdue(DueState.STALE), true);
  assert.equal(isOverdue(DueState.DUE_TODAY), false);
  assert.equal(isOverdue(DueState.PENDING), false);
});

test('порядок сортировки: STALE → OVERDUE → DUE_TODAY → PENDING → NONE → DONE', () => {
  assert.deepEqual(
    [
      DueState.DONE,
      DueState.NONE,
      DueState.PENDING,
      DueState.DUE_TODAY,
      DueState.OVERDUE,
      DueState.STALE
    ]
      .map(DueStateCalculator.sortKey)
      .sort((a, b) => a - b),
    [0, 1, 2, 3, 4, 5]
  );
});
