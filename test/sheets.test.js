import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BRANCH_KEYS } from '../www/js/constants.js';
import {
  isActiveNote, countActiveByBranch, sheetTitle,
  computeSheets, overflowKeys, isOnSheet, filterBySheet,
  resolveActiveSheet, shiftSheet
} from '../www/js/sheets.js';

function note(id, overrides = {}) {
  return { id, createdAt: Date.now(), completedAt: null, deletedAt: null, ...overrides };
}

const ids = notes => notes.map(n => n.id);

test('isActiveNote: not deleted and not completed', () => {
  assert.ok(isActiveNote(note('a')));
  assert.ok(!isActiveNote(note('b', { deletedAt: Date.now() })));
  assert.ok(!isActiveNote(note('c', { completedAt: Date.now() })));
  assert.ok(!isActiveNote(note('d', { completedAt: Date.now(), deletedAt: Date.now() })));
});

test('countActiveByBranch: 5 rabota, 5 byt', () => {
  const notes = [];
  for (let i = 0; i < 5; i++) notes.push(note('r' + i, { branch: 'rabota' }));
  for (let i = 0; i < 5; i++) notes.push(note('b' + i, { branch: 'byt' }));
  const counts = countActiveByBranch(notes);
  assert.equal(counts.get('rabota'), 5);
  assert.equal(counts.get('byt'), 5);
});

test('computeSheets: 5 active in rabota → 1 sheet', () => {
  const notes = [];
  for (let i = 0; i < 5; i++) notes.push(note('r' + i, { branch: 'rabota' }));
  const sheets = computeSheets(notes);
  assert.equal(sheets.length, 1);
  assert.equal(sheets[0].key, null);
  assert.equal(sheets[0].title, 'Все');
  assert.equal(sheets[0].count, 5);
});

test('computeSheets: 6 active in rabota → 2 sheets, main empty', () => {
  const notes = [];
  for (let i = 0; i < 6; i++) notes.push(note('r' + i, { branch: 'rabota' }));
  const sheets = computeSheets(notes);
  assert.equal(sheets.length, 2);
  assert.equal(sheets[0].key, null);
  assert.equal(sheets[0].count, 0);
  assert.equal(sheets[1].key, 'rabota');
  assert.equal(sheets[1].title, 'Работа');
  assert.equal(sheets[1].count, 6);
});

test('computeSheets: 6 with one completed → 1 sheet', () => {
  const notes = [];
  for (let i = 0; i < 5; i++) notes.push(note('r' + i, { branch: 'rabota' }));
  notes.push(note('r5', { branch: 'rabota', completedAt: Date.now() }));
  assert.equal(computeSheets(notes).length, 1);
});

test('computeSheets: 6 with one deleted → 1 sheet', () => {
  const notes = [];
  for (let i = 0; i < 5; i++) notes.push(note('r' + i, { branch: 'rabota' }));
  notes.push(note('r5', { branch: 'rabota', deletedAt: Date.now() }));
  assert.equal(computeSheets(notes).length, 1);
});

test('computeSheets: branch null never creates sheet', () => {
  const notes = [];
  for (let i = 0; i < 10; i++) notes.push(note('n' + i));
  assert.equal(computeSheets(notes).length, 1);
  assert.equal(computeSheets(notes)[0].count, 10);
});

test('computeSheets: unknown branch stays on main', () => {
  const notes = [];
  for (let i = 0; i < 10; i++) notes.push(note('x' + i, { branch: 'unknown' }));
  const sheets = computeSheets(notes);
  assert.equal(sheets.length, 1);
  assert.equal(sheets[0].count, 10);
});

test('computeSheets: order is BRANCH_KEYS regardless of counts', () => {
  const notes = [];
  for (let i = 0; i < 10; i++) notes.push(note('r' + i, { branch: 'rabota' }));
  for (let i = 0; i < 7; i++) notes.push(note('b' + i, { branch: 'byt' }));
  for (let i = 0; i < 9; i++) notes.push(note('z' + i, { branch: 'zdorovie' }));
  const sheets = computeSheets(notes, 5);
  const keys = sheets.slice(1).map(s => s.key);
  assert.deepEqual(keys, ['rabota', 'byt', 'zdorovie']);
});

test('computeSheets: sum of counts = total active, each active on exactly one sheet', () => {
  const notes = [];
  for (let i = 0; i < 6; i++) notes.push(note('r' + i, { branch: 'rabota' }));
  for (let i = 0; i < 3; i++) notes.push(note('b' + i, { branch: 'byt' }));
  for (let i = 0; i < 6; i++) notes.push(note('z' + i, { branch: 'zdorovie' }));
  const sheets = computeSheets(notes, 5);
  const total = sheets.reduce((s, x) => s + x.count, 0);
  assert.equal(total, 15);
  assert.equal(sheets[0].count, 3);
});

test('filterBySheet: main excludes overflow branches', () => {
  const notes = [note('r1', { branch: 'rabota' }), note('b1', { branch: 'byt' })];
  const overflow = new Set(['rabota']);
  assert.deepEqual(ids(filterBySheet(notes, null, overflow)), ['b1']);
});

test('filterBySheet: branch key shows only its branch', () => {
  const notes = [note('r1', { branch: 'rabota' }), note('b1', { branch: 'byt' })];
  const overflow = new Set(['rabota']);
  assert.deepEqual(ids(filterBySheet(notes, 'rabota', overflow)), ['r1']);
});

test('filterBySheet: completed and deleted also filtered per sheet', () => {
  const notes = [
    note('r1', { branch: 'rabota', completedAt: Date.now() }),
    note('r2', { branch: 'rabota', deletedAt: Date.now() }),
    note('b1', { branch: 'byt' })
  ];
  const overflow = new Set(['rabota']);
  assert.deepEqual(ids(filterBySheet(notes, null, overflow)), ['b1']);
  assert.deepEqual(ids(filterBySheet(notes, 'rabota', overflow)), ['r1', 'r2']);
});

test('resolveActiveSheet: existing key preserved, null stays null', () => {
  const sheets = [
    { key: null, title: 'Все', count: 0 },
    { key: 'rabota', title: 'Работа', count: 6 }
  ];
  assert.equal(resolveActiveSheet(sheets, 'rabota'), 'rabota');
  assert.equal(resolveActiveSheet(sheets, null), null);
});

test('resolveActiveSheet: missing key falls to null', () => {
  const sheets = [{ key: null, title: 'Все', count: 10 }];
  assert.equal(resolveActiveSheet(sheets, 'rabota'), null);
  assert.equal(resolveActiveSheet(sheets, null), null);
});

test('shiftSheet: clamps at ends, ±1', () => {
  const sheets = [
    { key: null, count: 0 },
    { key: 'rabota', count: 6 },
    { key: 'byt', count: 7 }
  ];
  assert.equal(shiftSheet(sheets, null, -1), null);
  assert.equal(shiftSheet(sheets, null, 1), 'rabota');
  assert.equal(shiftSheet(sheets, 'rabota', 1), 'byt');
  assert.equal(shiftSheet(sheets, 'byt', 1), 'byt');
  assert.equal(shiftSheet(sheets, 'rabota', -1), null);
});

test('sheetTitle: main, branch, unknown', () => {
  assert.equal(sheetTitle(null), 'Все');
  assert.equal(sheetTitle('rabota'), 'Работа');
  assert.equal(sheetTitle('ucheba'), 'Учёба');
  assert.equal(sheetTitle('unknown'), 'unknown');
});

test('overflowKeys: returns branch keys from sheets', () => {
  const sheets = [
    { key: null, title: 'Все', count: 0 },
    { key: 'rabota', title: 'Работа', count: 6 }
  ];
  assert.deepEqual(overflowKeys(sheets), ['rabota']);
  assert.deepEqual(overflowKeys([{ key: null, title: 'Все', count: 10 }]), []);
});