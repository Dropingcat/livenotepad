import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDecay } from '../www/js/idb.js';

// ── applyDecay ───────────────────────────────────────────────────────────────

test('applyDecay: без изменений при now сразу после lastSeenAt', () => {
  const row = { stem: 's', branch: 'rabota', evidence: 5, distinctNotes: 3, noteIds: ['a', 'b', 'c'], lastSeenAt: 1_000_000_000_000 };
  const result = applyDecay(row, 1_000_000_000_000);
  assert.equal(result, row, 'должен вернуть тот же объект');
  assert.equal(result.evidence, 5);
});

test('applyDecay: 1 полный период → evidence −1', () => {
  const row = { stem: 's', branch: 'rabota', evidence: 5, distinctNotes: 3, noteIds: ['a'], lastSeenAt: 1_000_000_000_000 };
  const later = 1_000_000_000_000 + 31 * 86400000; // 31 день
  const result = applyDecay(row, later);
  assert.notEqual(result, row, 'должен вернуть новый объект');
  assert.equal(result.evidence, 4);
  // Остальные поля сохраняются
  assert.equal(result.stem, 's');
  assert.equal(result.branch, 'rabota');
  assert.equal(result.distinctNotes, 3);
  assert.deepEqual(result.noteIds, ['a']);
});

test('applyDecay: много периодов → clamp к 1', () => {
  const row = { stem: 's', branch: 'byt', evidence: 3, distinctNotes: 2, lastSeenAt: 1_000_000_000_000 };
  const later = 1_000_000_000_000 + 100 * 86400000; // 100 дней = 3 полных периода
  const result = applyDecay(row, later);
  assert.equal(result.evidence, 1, '3 - 3 = 0, но min = 1');
});

test('applyDecay: lastSeenAt в будущем → без изменений', () => {
  const row = { stem: 's', branch: 'ucheba', evidence: 5, distinctNotes: 2, lastSeenAt: 2_000_000_000_000 };
  const result = applyDecay(row, 1_000_000_000_000);
  assert.equal(result, row, 'будущее lastSeenAt не должно уменьшать evidence');
  assert.equal(result.evidence, 5);
});

test('applyDecay: evidence = 0 → без изменений', () => {
  const row = { stem: 's', branch: 'rabota', evidence: 0, distinctNotes: 0, lastSeenAt: 1_000_000_000_000 };
  const result = applyDecay(row, 2_000_000_000_000);
  assert.equal(result, row);
});

test('applyDecay: evidence = 1 → не уходит ниже 1', () => {
  const row = { stem: 's', branch: 'rabota', evidence: 1, distinctNotes: 1, lastSeenAt: 1_000_000_000_000 };
  const later = 1_000_000_000_000 + 90 * 86400000; // 90 дней = 3 периода
  const result = applyDecay(row, later);
  assert.equal(result.evidence, 1);
});

test('applyDecay: меньше одного периода → без изменений', () => {
  const row = { stem: 's', branch: 'ljudi', evidence: 5, distinctNotes: 1, lastSeenAt: 1_000_000_000_000 };
  const later = 1_000_000_000_000 + 29 * 86400000; // 29 дней — не полный период
  const result = applyDecay(row, later);
  assert.equal(result, row);
});

test('applyDecay: ровно один период (30 дней) → evidence −1', () => {
  const row = { stem: 's', branch: 'zdorovie', evidence: 4, distinctNotes: 1, lastSeenAt: 1_000_000_000_000 };
  const later = 1_000_000_000_000 + 30 * 86400000; // 30 дней = 1 полный период
  const result = applyDecay(row, later);
  assert.equal(result.evidence, 3);
});

test('applyDecay: не мутирует исходный объект', () => {
  const row = { stem: 's', branch: 'rabota', evidence: 5, distinctNotes: 3, lastSeenAt: 1_000_000_000_000 };
  const frozen = { ...row };
  const result = applyDecay(row, 1_000_000_000_000 + 35 * 86400000);
  assert.deepEqual(row, frozen);
});

test('applyDecay: null → возвращает null', () => {
  const result = applyDecay(null, 1_000_000_000_000);
  assert.equal(result, null);
});

test('applyDecay: undefined → возвращает undefined', () => {
  const result = applyDecay(undefined, 1_000_000_000_000);
  assert.equal(result, undefined);
});

test('applyDecay: без аргумента now использует Date.now()', () => {
  const row = { stem: 's', branch: 'rabota', evidence: 5, distinctNotes: 1, lastSeenAt: Date.now() };
  const result = applyDecay(row);
  assert.equal(result, row, 'при lastSeenAt === Date.now() нет изменений');
});