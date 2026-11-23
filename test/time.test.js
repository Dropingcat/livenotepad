import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextMidnight } from '../www/js/time.js';

const at = (day, h, m, s = 0) => new Date(2026, 10, day, h, m, s, 0).getTime();

test('следующая полночь: вечером — через несколько секунд после 00:00', () => {
  assert.equal(nextMidnight(at(21, 23, 59, 30)), at(22, 0, 0, 1));
});

test('следующая полночь: утром — завтрашняя', () => {
  assert.equal(nextMidnight(at(21, 10, 0)), at(22, 0, 0, 1));
});

test('следующая полночь: ровно в полночь — следующая', () => {
  assert.equal(nextMidnight(at(21, 0, 0)), at(22, 0, 0, 1));
});
