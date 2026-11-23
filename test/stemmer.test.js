import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tokenizer } from '../www/js/stemmer.js';

test('биграммы сохраняют глагольные стемы: купить молоко', () => {
  assert.ok(
    Tokenizer.bigrams('купить молоко').includes('купит молок'),
    `получено: ${JSON.stringify(Tokenizer.bigrams('купить молоко'))}`
  );
});

test('биграммы сохраняют глагольные стемы: позвонить маме', () => {
  assert.ok(
    Tokenizer.bigrams('позвонить маме').includes('позвонит мам'),
    `получено: ${JSON.stringify(Tokenizer.bigrams('позвонить маме'))}`
  );
});

test('одиночный глагол не даёт словесных стемов', () => {
  assert.deepEqual(Tokenizer.stems('купить'), []);
});

test('словесные стемы по-прежнему отбрасывают глаголы', () => {
  assert.deepEqual(Tokenizer.stems('купить молоко'), ['молок']);
});
