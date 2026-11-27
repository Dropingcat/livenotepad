import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractEntities, computeCooccurrence, computeEdgeWeight, clusterNotes } from '../www/js/entities.js';
import { TUNING } from '../www/js/constants.js';

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

// ── computeEdgeWeight ─────────────────────────────────────────────────────

test('computeEdgeWeight: basic IDF weight above threshold', () => {
  const freq = { молоко: 2, хлеб: 3, масло: 1 };
  // N=3 (макс), IDF = ln(3/2) + ln(3/3) = ln(1.5) + ln(1) ≈ 0.405
  const weight = computeEdgeWeight(2, freq, 'молоко', 'хлеб', 0, 0, 3);
  assert.ok(weight > 0, 'weight should be positive');
  assert.ok(weight >= TUNING.GRAPH_EDGE_THRESHOLD, 'weight should meet threshold');
});

test('computeEdgeWeight: below threshold returns 0', () => {
  const freq = { редкая: 5, частая: 5 };
  // N=5, IDF = ln(5/5) + ln(5/5) = 0, cooc=1 → 0
  const weight = computeEdgeWeight(1, freq, 'редкая', 'частая', 0, 0, 5);
  assert.strictEqual(weight, 0);
});

test('computeEdgeWeight: same branch bonus pushes over threshold', () => {
  const freq = { a: 5, b: 5 };
  // IDF = 0 + 0 = 0, cooc * IDF = 0
  // sameBranch=1 * 0.2 = 0.2 → still below 0.3
  const weight = computeEdgeWeight(1, freq, 'a', 'b', 1, 0, 5);
  assert.strictEqual(weight, 0);
});

test('computeEdgeWeight: temporal bonus included', () => {
  const freq = { a: 3, b: 2 };
  // IDF = ln(N/a) + ln(N/b), N=3: ln(3/3)=0 + ln(3/2)=0.405 = 0.405
  // cooc=2 * 0.405 = 0.81 → above threshold
  const weight = computeEdgeWeight(2, freq, 'a', 'b', 0, 0.5, 3);
  assert.ok(weight > TUNING.GRAPH_EDGE_THRESHOLD);
});

test('computeEdgeWeight: zero frequency entity returns 0', () => {
  const freq = { a: 3 };
  const weight = computeEdgeWeight(1, freq, 'a', 'b', 0, 0, 3);
  assert.strictEqual(weight, 0);
});

// ── clusterNotes ──────────────────────────────────────────────────────────

function makeNote(id, text, branch, createdAt) {
  return { id, text, branch, createdAt: createdAt || Date.now() };
}

test('clusterNotes: two notes with shared rare entity form a cluster', () => {
  const notes = [
    makeNote('n1', 'раритетный термин'),
    makeNote('n2', 'раритетный маркер'),
    makeNote('n3', 'обычный шум')
  ];
  const entitiesByNoteId = {
    n1: ['раритетный', 'термин'],
    n2: ['раритетный', 'маркер'],
    n3: ['обычный', 'шум']
  };
  const cooccurrences = [
    { entityA: 'раритетный', entityB: 'термин', weight: 2 },
    { entityA: 'раритетный', entityB: 'маркер', weight: 1 },
    { entityA: 'термин', entityB: 'маркер', weight: 0 }
  ];
  // раритетный: freq=2 из 3 заметок → IDF = ln(3/2) ≈ 0.405
  const entityFrequencies = { раритетный: 2, термин: 1, маркер: 1, обычный: 1, шум: 1 };

  const clusters = clusterNotes(notes, entitiesByNoteId, cooccurrences, entityFrequencies);
  assert.strictEqual(clusters.size, 1, 'should form one cluster');
  const ids = [...clusters.values()][0];
  assert.ok(ids.includes('n1') && ids.includes('n2'), 'both notes in cluster');
});

test('clusterNotes: no shared entities returns empty map', () => {
  const notes = [
    makeNote('n1', 'купить молоко'),
    makeNote('n2', 'позвонить маме')
  ];
  const entitiesByNoteId = {
    n1: ['молоко'],
    n2: ['маме']
  };
  const cooccurrences = [];
  const entityFrequencies = { молоко: 1, маме: 1 };

  const clusters = clusterNotes(notes, entitiesByNoteId, cooccurrences, entityFrequencies);
  assert.strictEqual(clusters.size, 0);
});

test('clusterNotes: empty notes returns empty map', () => {
  const clusters = clusterNotes([], {}, [], {});
  assert.strictEqual(clusters.size, 0);
});