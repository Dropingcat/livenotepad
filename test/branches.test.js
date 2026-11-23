import { test } from 'node:test';
import assert from 'node:assert/strict';
import { branchLastActivity, branchStatuses } from '../www/js/branches.js';

const NOW = new Date(2026, 10, 21, 12, 0, 0, 0).getTime();
const DAY = 24 * 60 * 60 * 1000;
const KEYS = ['rabota', 'byt', 'ljudi', 'zdorovie', 'ucheba'];

const note = (branch, overrides = {}) => ({
  id: Math.random().toString(36),
  branch,
  createdAt: NOW,
  completedAt: null,
  deletedAt: null,
  ...overrides
});

test('ветка без заметок не спит', () => {
  const statuses = branchStatuses([], KEYS, NOW);
  assert.equal(statuses.length, 5);
  assert.ok(statuses.every(s => s.sleeping === false));
  assert.ok(statuses.every(s => s.lastUsedAt === null));
});

test('ветка с заметкой 20 дней назад — спит', () => {
  const notes = [note('rabota', { createdAt: NOW - 20 * DAY })];
  const rabota = branchStatuses(notes, KEYS, NOW).find(s => s.key === 'rabota');
  assert.equal(rabota.sleeping, true);
  assert.equal(rabota.lastUsedAt, NOW - 20 * DAY);
});

test('ветка с заметкой 13 дней назад — не спит', () => {
  const notes = [note('byt', { createdAt: NOW - 13 * DAY })];
  const byt = branchStatuses(notes, KEYS, NOW).find(s => s.key === 'byt');
  assert.equal(byt.sleeping, false);
});

test('ровно 14 дней — ещё не спит, больше 14 — спит', () => {
  const exactly = branchStatuses([note('ljudi', { createdAt: NOW - 14 * DAY })], KEYS, NOW)
    .find(s => s.key === 'ljudi');
  const over = branchStatuses([note('ljudi', { createdAt: NOW - 14 * DAY - 1 })], KEYS, NOW)
    .find(s => s.key === 'ljudi');
  assert.equal(exactly.sleeping, false);
  assert.equal(over.sleeping, true);
});

test('закрытая заметка обновляет активность ветки', () => {
  const notes = [
    note('zdorovie', { createdAt: NOW - 30 * DAY, completedAt: NOW - 2 * DAY })
  ];
  const z = branchStatuses(notes, KEYS, NOW).find(s => s.key === 'zdorovie');
  assert.equal(z.lastUsedAt, NOW - 2 * DAY);
  assert.equal(z.sleeping, false);
});

test('удалённая заметка не считается активностью', () => {
  const notes = [note('ucheba', { createdAt: NOW - 2 * DAY, deletedAt: NOW - DAY })];
  const u = branchStatuses(notes, KEYS, NOW).find(s => s.key === 'ucheba');
  assert.equal(u.lastUsedAt, null);
  assert.equal(u.sleeping, false);
});

test('активность берётся по самой свежей заметке ветки', () => {
  const notes = [
    note('rabota', { createdAt: NOW - 40 * DAY }),
    note('rabota', { createdAt: NOW - 3 * DAY })
  ];
  const last = branchLastActivity(notes);
  assert.equal(last.get('rabota'), NOW - 3 * DAY);
});
