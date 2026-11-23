import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTextEdit } from '../www/js/note-edit.js';

const NOW = new Date(2026, 10, 21, 12, 0, 0, 0).getTime();
const note = (overrides = {}) => ({
  id: 'n1',
  text: 'купить молоко',
  branch: 'byt',
  branchSource: 'SEED',
  branchConfidence: 0.95,
  matchedToken: 'молоко',
  dueAt: null,
  dueSource: 'NONE',
  dueConfidence: 0,
  ...overrides
});

test('правка текста сохраняет ветку и её источник', () => {
  const updated = applyTextEdit(note(), 'купить хлеб', NOW);
  assert.equal(updated.text, 'купить хлеб');
  assert.equal(updated.branch, 'byt');
  assert.equal(updated.branchSource, 'SEED');
  assert.equal(updated.branchConfidence, 0.95);
  assert.equal(updated.matchedToken, 'молоко');
});

test('правка пересчитывает срок', () => {
  const updated = applyTextEdit(note(), 'купить молоко завтра до 20', NOW);
  assert.equal(updated.dueAt, new Date(2026, 10, 22, 20, 0, 0, 0).getTime());
  assert.equal(updated.dueSource, 'PARSED');
  assert.ok(updated.dueConfidence > 0);
});

test('правка убирает срок, если он стёрт из текста', () => {
  const updated = applyTextEdit(note({ dueAt: NOW + 3600000, dueSource: 'PARSED' }), 'купить хлеб', NOW);
  assert.equal(updated.dueAt, null);
  assert.equal(updated.dueSource, 'NONE');
});

test('пустой текст не применяется', () => {
  assert.equal(applyTextEdit(note(), '   ', NOW), null);
});

test('тот же текст не применяется', () => {
  assert.equal(applyTextEdit(note(), 'купить молоко', NOW), null);
});

test('правка обрезает пробелы и ставит editedAt', () => {
  const updated = applyTextEdit(note(), '  купить хлеб  ', NOW);
  assert.equal(updated.text, 'купить хлеб');
  assert.equal(updated.editedAt, NOW);
});
