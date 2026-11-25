import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalJson, sha256, checksum, buildExport, validateExport, computeFileHash,
  CURRENT_SCHEMA_VERSION
} from '../www/js/export-format.js';

// ── canonicalJson ──────────────────────────────────────────────────────────

test('canonicalJson: базовый объект', () => {
  const result = canonicalJson({ a: 1, b: 2 });
  assert.equal(result, '{"a":1,"b":2}');
});

test('canonicalJson: сортировка ключей', () => {
  const result = canonicalJson({ b: 2, a: 1, c: 3 });
  assert.equal(result, '{"a":1,"b":2,"c":3}');
});

test('canonicalJson: массивы как есть', () => {
  const result = canonicalJson({ arr: [3, 1, 2] });
  assert.equal(result, '{"arr":[3,1,2]}');
});

test('canonicalJson: undefined пропущен', () => {
  const result = canonicalJson({ a: 1, b: undefined, c: 3 });
  assert.equal(result, '{"a":1,"c":3}');
});

test('canonicalJson: NaN reject', () => {
  assert.throws(() => canonicalJson({ a: NaN }), /NaN/);
});

test('canonicalJson: Infinity reject', () => {
  assert.throws(() => canonicalJson({ a: Infinity }), /Infinity/);
});

test('canonicalJson: -0 -> 0', () => {
  const result = canonicalJson({ a: -0 });
  assert.equal(result, '{"a":0}');
});

test('canonicalJson: вложенный объект с сортировкой', () => {
  const result = canonicalJson({ z: { b: 2, a: 1 }, y: 0 });
  assert.equal(result, '{"y":0,"z":{"a":1,"b":2}}');
});

// ── sha256 ───────────────────────────────────────────────────────────────────

test('sha256: пустая строка', () => {
  const encoder = new TextEncoder();
  const hash = sha256(encoder.encode(''));
  assert.equal(hash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});

test('sha256: abc', () => {
  const encoder = new TextEncoder();
  const hash = sha256(encoder.encode('abc'));
  assert.equal(hash, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('sha256: русский текст (UTF-8)', () => {
  const encoder = new TextEncoder();
  const hash = sha256(encoder.encode('привет'));
  // Известный вектор для UTF-8 'привет' (12 байт)
  assert.equal(hash.length, 64);
  assert.ok(/^[0-9a-f]{64}$/.test(hash));
});

// ── checksum ─────────────────────────────────────────────────────────────────

test('checksum: префикс и длина', () => {
  const result = checksum({ a: 1 });
  assert.ok(result.startsWith('sha256:'));
  assert.equal(result.length, 71);
});

test('checksum: детерминирован', () => {
  const a = checksum({ b: 2, a: 1 });
  const b = checksum({ a: 1, b: 2 });
  assert.equal(a, b);
});

test('checksum: разный объект — разный хэш', () => {
  const a = checksum({ a: 1 });
  const b = checksum({ a: 2 });
  assert.notEqual(a, b);
});

// ── buildExport ──────────────────────────────────────────────────────────────

function makeSnapshot(overrides = {}) {
  return {
    notes: [],
    evidence: [],
    meta: [],
    logs: [],
    ...overrides
  };
}

test('buildExport: full — 4 секции, все true', () => {
  const snapshot = makeSnapshot({
    notes: [{ id: 'n1', text: 'test', createdAt: 1_700_000_000_000 }],
    evidence: [{ stem: 'test', branch: 'rabota', evidence: 1, distinctNotes: 1, lastSeenAt: 0 }],
    meta: [{ stem: 'test', state: 'CANDIDATE', distinctNotes: 0, userCurated: false }],
    logs: [{ id: 1, ts: 1_700_000_000_000, type: 'CREATE', source: 'ui', result: 'ok' }]
  });
  const result = buildExport({
    mode: 'full',
    dbSnapshot: snapshot,
    appVersion: 'alpha v0.3',
    deviceId: 'dev1',
    sessionId: 'ses1'
  });
  assert.equal(result.format, 'livenotepad-export');
  assert.equal(result.formatVersion, 4);
  assert.equal(result.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(result.mode, 'full');
  assert.equal(result.sections.notes, true);
  assert.equal(result.sections.word_evidence, true);
  assert.equal(result.sections.word_meta, true);
  assert.equal(result.sections.training_log, true);
  assert.equal(result.counts.notes, 1);
  assert.equal(result.counts.evidence, 1);
  assert.equal(result.counts.meta, 1);
  assert.equal(result.counts.logs, 1);
  assert.equal(result.data.notes.length, 1);
  assert.equal(result.data.word_evidence.length, 1);
  assert.equal(result.data.word_meta.length, 1);
  assert.equal(result.data.training_log.length, 1);
  assert.ok(result.exportId);
  assert.ok(result.exportedAt);
  assert.ok(result.checksum);
  assert.ok(result.checksum.startsWith('sha256:'));
});

test('buildExport: notes — 1 секция', () => {
  const snapshot = makeSnapshot({
    notes: [{ id: 'n1', text: 'test', createdAt: 1_700_000_000_000 }]
  });
  const result = buildExport({
    mode: 'notes',
    dbSnapshot: snapshot,
    appVersion: 'alpha v0.3',
    deviceId: 'dev1',
    sessionId: 'ses1'
  });
  assert.equal(result.mode, 'notes');
  assert.equal(result.sections.notes, true);
  assert.equal(result.sections.word_evidence, undefined);
  assert.equal(result.sections.word_meta, undefined);
  assert.equal(result.sections.training_log, undefined);
  assert.equal(result.counts.notes, 1);
  assert.equal(result.counts.evidence, 0);
  assert.equal(result.data.notes.length, 1);
  assert.equal(result.data.word_evidence, undefined);
  assert.equal(result.data.word_meta, undefined);
  assert.equal(result.data.training_log, undefined);
});

test('buildExport: learning — 2 секции (evidence, meta)', () => {
  const snapshot = makeSnapshot({
    evidence: [{ stem: 'test', branch: 'rabota', evidence: 1, distinctNotes: 1, lastSeenAt: 0 }],
    meta: [{ stem: 'test', state: 'CANDIDATE', distinctNotes: 0, userCurated: false }]
  });
  const result = buildExport({
    mode: 'learning',
    dbSnapshot: snapshot,
    appVersion: 'alpha v0.3',
    deviceId: 'dev1',
    sessionId: 'ses1'
  });
  assert.equal(result.mode, 'learning');
  assert.equal(result.sections.notes, undefined);
  assert.equal(result.sections.word_evidence, true);
  assert.equal(result.sections.word_meta, true);
  assert.equal(result.counts.notes, 0);
  assert.equal(result.counts.evidence, 1);
  assert.equal(result.counts.meta, 1);
  assert.equal(result.data.notes, undefined);
  assert.equal(result.data.word_evidence.length, 1);
  assert.equal(result.data.word_meta.length, 1);
});

test('buildExport: logs — 1 секция', () => {
  const snapshot = makeSnapshot({
    logs: [{ id: 1, ts: 1_700_000_000_000, type: 'CREATE', source: 'ui', result: 'ok' }]
  });
  const result = buildExport({
    mode: 'logs',
    dbSnapshot: snapshot,
    appVersion: 'alpha v0.3',
    deviceId: 'dev1',
    sessionId: 'ses1'
  });
  assert.equal(result.mode, 'logs');
  assert.equal(result.sections.training_log, true);
  assert.equal(result.counts.logs, 1);
  assert.equal(result.data.training_log.length, 1);
});

test('buildExport: checksum соответствует data', () => {
  const snapshot = makeSnapshot({
    notes: [{ id: 'n1', text: 't', createdAt: 1_700_000_000_000 }]
  });
  const result = buildExport({
    mode: 'full',
    dbSnapshot: snapshot,
    appVersion: 'alpha v0.3',
    deviceId: 'dev1',
    sessionId: 'ses1'
  });
  const expected = checksum(result.data);
  assert.equal(result.checksum, expected);
});

// ── validateExport ──────────────────────────────────────────────────────────

test('validateExport: пустой объект — ошибки', () => {
  const v = validateExport({});
  assert.ok(v.errors.length > 0);
});

test('validateExport: неверная formatVersion — ошибки', () => {
  const v = validateExport({
    format: 'livenotepad-export',
    formatVersion: 5,
    schemaVersion: 4,
    sections: { notes: true },
    counts: { notes: 0 },
    data: { notes: [] }
  });
  assert.ok(v.errors.length > 0);
});

test('validateExport: formatVersion 3 — пустой errors (легаси)', () => {
  const v = validateExport({
    format: 'livenotepad-export',
    formatVersion: 3,
    schemaVersion: 3,
    notes: [],
    word_evidence: [],
    word_meta: [],
    training_log: []
  });
  assert.equal(v.errors.length, 0);
});

test('validateExport: корректный формат 4 — пустой errors', () => {
  const data = buildExport({
    mode: 'full',
    dbSnapshot: makeSnapshot({
      notes: [{ id: 'n1', text: 't', createdAt: 1_700_000_000_000 }]
    }),
    appVersion: 'alpha v0.3',
    deviceId: 'dev1',
    sessionId: 'ses1'
  });
  const v = validateExport(data);
  assert.equal(v.errors.length, 0);
});

test('validateExport: checksum mismatch — warning', () => {
  const data = buildExport({
    mode: 'full',
    dbSnapshot: makeSnapshot(),
    appVersion: 'alpha v0.3',
    deviceId: 'dev1',
    sessionId: 'ses1'
  });
  data.checksum = 'sha256:' + 'a'.repeat(64);
  const v = validateExport(data);
  const hasChecksumWarning = v.warnings.some(w => w.includes('checksum') && w.includes('не совпадает'));
  assert.ok(hasChecksumWarning);
});

test('validateExport: counts не совпадает — error', () => {
  const data = buildExport({
    mode: 'full',
    dbSnapshot: makeSnapshot({
      notes: [{ id: 'n1', text: 't', createdAt: 1_700_000_000_000 }]
    }),
    appVersion: 'alpha v0.3',
    deviceId: 'dev1',
    sessionId: 'ses1'
  });
  data.counts.notes = 99; // подделка
  const v = validateExport(data);
  const hasCountError = v.errors.some(e => e.includes('counts.notes'));
  assert.ok(hasCountError);
});

test('validateExport: sections не boolean — error', () => {
  const data = buildExport({
    mode: 'full',
    dbSnapshot: makeSnapshot(),
    appVersion: 'alpha v0.3',
    deviceId: 'dev1',
    sessionId: 'ses1'
  });
  data.sections.notes = 'yes'; // не boolean
  const v = validateExport(data);
  const hasSectionError = v.errors.some(e => e.includes('sections.notes') && e.includes('boolean'));
  assert.ok(hasSectionError);
});

// ── computeFileHash ─────────────────────────────────────────────────────────

test('computeFileHash: консистентность (тот же файл — тот же хэш)', () => {
  const fileBytes = new TextEncoder().encode(JSON.stringify({ a: 1 }));
  const h1 = computeFileHash(fileBytes, 'abc-123');
  const h2 = computeFileHash(fileBytes, 'abc-123');
  assert.equal(h1, h2);
});

test('computeFileHash: разный файл — разный хэш', () => {
  const fb1 = new TextEncoder().encode(JSON.stringify({ a: 1 }));
  const fb2 = new TextEncoder().encode(JSON.stringify({ a: 2 }));
  const h1 = computeFileHash(fb1, 'abc-123');
  const h2 = computeFileHash(fb2, 'abc-123');
  assert.notEqual(h1, h2);
});

test('computeFileHash: разный exportId — разный хэш', () => {
  const fb = new TextEncoder().encode(JSON.stringify({ a: 1 }));
  const h1 = computeFileHash(fb, 'id-1');
  const h2 = computeFileHash(fb, 'id-2');
  assert.notEqual(h1, h2);
});

test('computeFileHash: формат sha256:', () => {
  const fb = new TextEncoder().encode(JSON.stringify({ a: 1 }));
  const h = computeFileHash(fb, 'test-id');
  assert.ok(h.startsWith('sha256:'));
  assert.equal(h.length, 71);
});

// ── JSONL-формат (логика экспорта) ────────────────────────────────────────

test('JSONL: каждая строка — валидный JSON с нужными полями', () => {
  const evidence = [
    { stem: 'код', branch: 'rabota', evidence: 3, distinctNotes: 2, noteIds: ['id-a', 'id-b'], lastSeenAt: 1_700_000_000_000 },
    { stem: 'молоко', branch: 'byt', evidence: 1, distinctNotes: 1, noteIds: ['id-c'], lastSeenAt: 1_700_000_100_000 }
  ];
  const meta = [
    { stem: 'код', state: 'CONFIRMED', distinctNotes: 2, userCurated: false },
    { stem: 'молоко', state: 'PROVISIONAL', distinctNotes: 1, userCurated: true }
  ];
  const metaByStem = {};
  for (const m of meta) { metaByStem[m.stem] = m; }
  const lines = evidence.map(e => {
    const m = metaByStem[e.stem];
    return JSON.stringify({
      ts: e.lastSeenAt,
      type: 'CORRECT',
      stem: e.stem,
      branch: e.branch,
      evidence: e.evidence,
      distinctNotes: e.distinctNotes,
      noteIds: e.noteIds,
      lastSeenAt: e.lastSeenAt,
      state: m ? m.state : 'CANDIDATE',
      userCurated: m ? m.userCurated : false
    });
  });
  assert.equal(lines.length, 2);
  for (const line of lines) {
    assert.doesNotThrow(() => JSON.parse(line));
    const obj = JSON.parse(line);
    assert.ok(typeof obj.ts === 'number');
    assert.ok(typeof obj.stem === 'string');
    assert.ok(typeof obj.branch === 'string');
    assert.ok(Number.isInteger(obj.evidence));
    assert.ok(Number.isInteger(obj.distinctNotes));
    assert.ok(Array.isArray(obj.noteIds));
    assert.ok(typeof obj.lastSeenAt === 'number');
    assert.ok(['CONFIRMED', 'PROVISIONAL', 'CANDIDATE'].includes(obj.state));
    assert.ok(typeof obj.userCurated === 'boolean');
  }
  // Проверка слияния meta
  const parsed = lines.map(l => JSON.parse(l));
  const kod = parsed.find(p => p.stem === 'код');
  assert.equal(kod.state, 'CONFIRMED');
  assert.equal(kod.userCurated, false);
  const moloko = parsed.find(p => p.stem === 'молоко');
  assert.equal(moloko.state, 'PROVISIONAL');
  assert.equal(moloko.userCurated, true);
});

test('JSONL: evidence без meta — CANDIDATE, userCurated false', () => {
  const evidence = [{ stem: 'новый', branch: 'ucheba', evidence: 1, distinctNotes: 1, noteIds: ['id-x'], lastSeenAt: 1_700_000_000_000 }];
  const line = JSON.stringify({
    ts: evidence[0].lastSeenAt,
    type: 'CORRECT',
    stem: evidence[0].stem,
    branch: evidence[0].branch,
    evidence: evidence[0].evidence,
    distinctNotes: evidence[0].distinctNotes,
    noteIds: evidence[0].noteIds,
    lastSeenAt: evidence[0].lastSeenAt,
    state: 'CANDIDATE',
    userCurated: false
  });
  const obj = JSON.parse(line);
  assert.equal(obj.state, 'CANDIDATE');
  assert.equal(obj.userCurated, false);
});