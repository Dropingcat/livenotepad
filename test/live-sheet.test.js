import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterLiveSheet } from '../www/js/live-sheet.js';
import { filterDeletedToday } from '../www/js/live-sheet.js';
import { addDays, startOfDay } from '../www/js/time.js';

const NOW = new Date(2026, 10, 17, 10, 0, 0, 0).getTime();
const TODAY = startOfDay(NOW);
const YESTERDAY = addDays(TODAY, -1);

const note = (id, overrides = {}) => ({
  id,
  createdAt: NOW,
  completedAt: null,
  deletedAt: null,
  ...overrides
});

const ids = notes => notes.map(n => n.id);

test('создана сегодня, открыта — видна', () => {
  const notes = [note('today-open')];
  assert.deepEqual(ids(filterLiveSheet(notes, NOW)), ['today-open']);
});

test('создана вчера, не закрыта — видна', () => {
  const notes = [note('yesterday-open', { createdAt: YESTERDAY })];
  assert.deepEqual(ids(filterLiveSheet(notes, NOW)), ['yesterday-open']);
});

test('закрыта вчера — не видна', () => {
  const notes = [note('closed-yesterday', { completedAt: YESTERDAY + 12 * 3600000 })];
  assert.deepEqual(ids(filterLiveSheet(notes, NOW)), []);
});

test('закрыта сегодня — видна зачёркнутой', () => {
  const notes = [note('closed-today', { completedAt: TODAY + 9 * 3600000 })];
  assert.deepEqual(ids(filterLiveSheet(notes, NOW)), ['closed-today']);
});

test('создана сегодня, закрыта и переоткрыта — видна открытой', () => {
  const notes = [
    note('reopened', {
      createdAt: TODAY + 8 * 3600000,
      completedAt: null,
      reopenedAt: TODAY + 9 * 3600000
    })
  ];
  assert.deepEqual(ids(filterLiveSheet(notes, NOW)), ['reopened']);
});

test('помечена deleted — не видна', () => {
  const notes = [note('deleted', { deletedAt: NOW - 1000 })];
  assert.deepEqual(ids(filterLiveSheet(notes, NOW)), []);
});

test('закрыта ровно в полночь — ещё видна', () => {
  const notes = [note('closed-at-midnight', { completedAt: TODAY })];
  assert.deepEqual(ids(filterLiveSheet(notes, NOW)), ['closed-at-midnight']);
});

test('удалённая и закрытая сегодня — не видна', () => {
  const notes = [
    note('deleted-closed', {
      completedAt: TODAY + 9 * 3600000,
      deletedAt: NOW - 1000
    })
  ];
  assert.deepEqual(ids(filterLiveSheet(notes, NOW)), []);
});

test('корзина дня: удалена сегодня — видна', () => {
  const notes = [note('deleted-today', { deletedAt: NOW - 1000 })];
  assert.deepEqual(ids(filterDeletedToday(notes, NOW)), ['deleted-today']);
});

test('корзина дня: удалена вчера — не видна', () => {
  const notes = [note('deleted-yesterday', { deletedAt: YESTERDAY + 12 * 3600000 })];
  assert.deepEqual(ids(filterDeletedToday(notes, NOW)), []);
});

test('корзина дня: не удалённые не попадают', () => {
  const notes = [note('alive')];
  assert.deepEqual(ids(filterDeletedToday(notes, NOW)), []);
});

test('корзина дня: удалена ровно в полночь — видна', () => {
  const notes = [note('deleted-at-midnight', { deletedAt: TODAY })];
  assert.deepEqual(ids(filterDeletedToday(notes, NOW)), ['deleted-at-midnight']);
});

test('корзина дня: закрытая вчера и удалённая сегодня — видна', () => {
  const notes = [note('closed-yesterday-deleted-today', {
    completedAt: YESTERDAY + 12 * 3600000,
    deletedAt: NOW - 1000
  })];
  assert.deepEqual(ids(filterDeletedToday(notes, NOW)), ['closed-yesterday-deleted-today']);
});
