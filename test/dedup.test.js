import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDuplicateAdd } from '../www/js/dedup.js';

const NOW = 1_800_000_000_000;

test('первое добавление не дубль', () => {
  assert.equal(isDuplicateAdd(null, 'купить молоко', NOW), false);
});

test('тот же текст в пределах окна — дубль', () => {
  assert.equal(isDuplicateAdd({ text: 'купить молоко', ts: NOW - 1000 }, 'купить молоко', NOW), true);
});

test('тот же текст после окна — не дубль', () => {
  assert.equal(isDuplicateAdd({ text: 'купить молоко', ts: NOW - 5000 }, 'купить молоко', NOW), false);
});

test('другой текст — не дубль', () => {
  assert.equal(isDuplicateAdd({ text: 'купить молоко', ts: NOW - 1000 }, 'купить хлеб', NOW), false);
});

test('пробелы по краям не мешают распознать дубль', () => {
  assert.equal(isDuplicateAdd({ text: 'купить молоко', ts: NOW - 1000 }, '  купить молоко  ', NOW), true);
});
