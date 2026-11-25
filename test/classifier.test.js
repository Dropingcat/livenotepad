import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEEDS_DATA, SeedsClassifier } from '../www/js/classifier.js';

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