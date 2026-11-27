import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEEDS_DATA, SeedsClassifier, fallbackGuard } from '../www/js/classifier.js';

// ── SEEDS_DATA.bigrams ──────────────────────────────────────────────────────

test('SEEDS_DATA.bigrams: rabota содержит новые биграммы', () => {
  const bgs = SEEDS_DATA.bigrams.rabota;
  assert.ok(bgs.includes('проверить почта'));
  assert.ok(bgs.includes('согласовать бюджет'));
  assert.ok(bgs.includes('подготовить презентация'));
  assert.ok(bgs.includes('написать письмо'));
  assert.ok(bgs.includes('отправить отчёт'));
});

test('SEEDS_DATA.bigrams: byt содержит новые биграммы', () => {
  const bgs = SEEDS_DATA.bigrams.byt;
  assert.ok(bgs.includes('сходить магазин'));
  assert.ok(bgs.includes('купить продукт'));
  assert.ok(bgs.includes('оплатить счёт'));
  assert.ok(bgs.includes('помыть посуда'));
  assert.ok(bgs.includes('вынести мусор'));
});

test('SEEDS_DATA.bigrams: ljudi содержит новые биграммы', () => {
  const bgs = SEEDS_DATA.bigrams.ljudi;
  assert.ok(bgs.includes('купить подарок'));
  assert.ok(bgs.includes('пригласить гости'));
  assert.ok(bgs.includes('навестить бабушка'));
  assert.ok(bgs.includes('поздравить друг'));
});

test('SEEDS_DATA.bigrams: zdorovie содержит новые биграммы', () => {
  const bgs = SEEDS_DATA.bigrams.zdorovie;
  assert.ok(bgs.includes('сдать кровь'));
  assert.ok(bgs.includes('записаться массаж'));
  assert.ok(bgs.includes('купить витамины'));
  assert.ok(bgs.includes('пройти осмотр'));
});

test('SEEDS_DATA.bigrams: ucheba содержит новые биграммы', () => {
  const bgs = SEEDS_DATA.bigrams.ucheba;
  assert.ok(bgs.includes('сдать сессия'));
  assert.ok(bgs.includes('подготовить доклад'));
  assert.ok(bgs.includes('написать курсовой'));
  assert.ok(bgs.includes('посетить лекция'));
});

// ── SeedsClassifier.classify с новыми биграммами ──────────────────────────

test('SeedsClassifier: rabota — проверить почта', () => {
  const r = SeedsClassifier.classify('проверить почта');
  assert.ok(r);
  assert.equal(r.branch, 'rabota');
  assert.equal(r.source, 'SEED');
});

test('SeedsClassifier: byt — сходить магазин', () => {
  const r = SeedsClassifier.classify('сходить магазин');
  assert.ok(r);
  assert.equal(r.branch, 'byt');
  assert.equal(r.source, 'SEED');
});

test('SeedsClassifier: ljudi — купить подарок', () => {
  const r = SeedsClassifier.classify('купить подарок');
  assert.ok(r);
  assert.equal(r.branch, 'ljudi');
  assert.equal(r.source, 'SEED');
});

test('SeedsClassifier: zdorovie — сдать кровь', () => {
  const r = SeedsClassifier.classify('сдать кровь');
  assert.ok(r);
  assert.equal(r.branch, 'zdorovie');
  assert.equal(r.source, 'SEED');
});

test('SeedsClassifier: ucheba — сдать сессия', () => {
  const r = SeedsClassifier.classify('сдать сессия');
  assert.ok(r);
  assert.equal(r.branch, 'ucheba');
  assert.equal(r.source, 'SEED');
});

// ── fallbackGuard: M4-001 ─────────────────────────────────────────────────
test('fallbackGuard: короткий текст (0 слов) → TIME_FALLBACK пропускается', () => {
  const result = { branch: 'rabota', source: 'TIME_FALLBACK', confidence: 0.35, matched: '' };
  const guarded = fallbackGuard(result, 0);
  assert.equal(guarded.source, 'TIME_FALLBACK');
  assert.equal(guarded.branch, 'rabota');
});

test('fallbackGuard: короткий текст (1 слово) → TIME_FALLBACK пропускается', () => {
  const result = { branch: 'byt', source: 'TIME_FALLBACK', confidence: 0.30, matched: '' };
  const guarded = fallbackGuard(result, 1);
  assert.equal(guarded.source, 'TIME_FALLBACK');
  assert.equal(guarded.branch, 'byt');
});

test('fallbackGuard: короткий текст (3 слова) → TIME_FALLBACK пропускается', () => {
  const result = { branch: 'byt', source: 'TIME_FALLBACK', confidence: 0.25, matched: '' };
  const guarded = fallbackGuard(result, 3);
  assert.equal(guarded.source, 'TIME_FALLBACK');
});

test('fallbackGuard: длинный текст (4 слова) → TIME_FALLBACK блокируется → NONE', () => {
  const result = { branch: 'rabota', source: 'TIME_FALLBACK', confidence: 0.35, matched: '' };
  const guarded = fallbackGuard(result, 4);
  assert.equal(guarded.source, 'NONE');
  assert.equal(guarded.branch, '');
  assert.equal(guarded.confidence, 0);
});

test('fallbackGuard: длинный текст (5 слов) → NONE остаётся NONE', () => {
  const result = { branch: '', source: 'NONE', confidence: 0, matched: '' };
  const guarded = fallbackGuard(result, 5);
  assert.equal(guarded.source, 'NONE');
});

test('fallbackGuard: SEED не затрагивается (длинный текст)', () => {
  const result = { branch: 'rabota', source: 'SEED', confidence: 1.0, matched: 'отчёт' };
  const guarded = fallbackGuard(result, 10);
  assert.equal(guarded.source, 'SEED');
  assert.equal(guarded.branch, 'rabota');
});

test('fallbackGuard: LEARNED_CONFIRMED не затрагивается', () => {
  const result = { branch: 'zdorovie', source: 'LEARNED_CONFIRMED', confidence: 0.8, matched: 'врач' };
  const guarded = fallbackGuard(result, 10);
  assert.equal(guarded.source, 'LEARNED_CONFIRMED');
  assert.equal(guarded.branch, 'zdorovie');
});