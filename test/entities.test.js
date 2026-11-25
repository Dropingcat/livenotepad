import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractEntities, computeCooccurrence } from '../www/js/entities.js';

test('extractEntities: basic case — multiple words', () => {
  const result = extractEntities('купить молоко хлеб масло');
  // 'купить' is a verb stop-word, removed; 'молоко', 'хлеб', 'масло' kept
  assert.deepEqual([...result].sort(), ['масло', 'молоко', 'хлеб']);
});

test('extractEntities: all stop words removed', () => {
  const result = extractEntities('купить сделать в на');
  assert.deepEqual(result, []);
});

test('extractEntities: minimum length 4', () => {
  const result = extractEntities('на с по и да ну');
  assert.deepEqual(result, []);
});

test('extractEntities: short tokens filtered', () => {
  const result = extractEntities('он мы ты да на');
  assert.deepEqual(result, []);
});

test('extractEntities: empty input', () => {
  assert.deepEqual(extractEntities(''), []);
  assert.deepEqual(extractEntities(null), []);
  assert.deepEqual(extractEntities(undefined), []);
});

test('extractEntities: deduplication', () => {
  const result = extractEntities('молоко хлеб молоко масло хлеб');
  assert.deepEqual([...result].sort(), ['масло', 'молоко', 'хлеб']);
});

test('extractEntities: punctuation removal', () => {
  const result = extractEntities('молоко, хлеб! масло?');
  assert.deepEqual([...result].sort(), ['масло', 'молоко', 'хлеб']);
});

test('extractEntities: mixed case normalization', () => {
  const result = extractEntities('Молоко Хлеб Масло');
  assert.deepEqual([...result].sort(), ['масло', 'молоко', 'хлеб']);
});

test('computeCooccurrence: pairs from 3 sorted entities', () => {
  const result = computeCooccurrence(['молоко', 'хлеб', 'масло']);
  // sorted: ['масло', 'молоко', 'хлеб']
  // pairs: (масло, молоко), (масло, хлеб), (молоко, хлеб)
  assert.deepEqual(result, [
    { entityA: 'масло', entityB: 'молоко', weight: 1 },
    { entityA: 'масло', entityB: 'хлеб', weight: 1 },
    { entityA: 'молоко', entityB: 'хлеб', weight: 1 }
  ]);
});

test('computeCooccurrence: less than 2 entities returns []', () => {
  assert.deepEqual(computeCooccurrence(['молоко']), []);
  assert.deepEqual(computeCooccurrence([]), []);
  assert.deepEqual(computeCooccurrence(null), []);
  assert.deepEqual(computeCooccurrence(undefined), []);
});

test('computeCooccurrence: single pair', () => {
  const result = computeCooccurrence(['молоко', 'хлеб']);
  assert.deepEqual(result, [
    { entityA: 'молоко', entityB: 'хлеб', weight: 1 }
  ]);
});