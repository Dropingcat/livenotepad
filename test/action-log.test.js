import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEvent, mergeEvents, typeFilterTypes, typeTagClass } from '../www/js/action-log.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ── makeEvent ──────────────────────────────────────────────────────────────

test('makeEvent: обязательные поля type, eventId, ts', () => {
  const ev = makeEvent({ type: 'CREATE' });
  assert.equal(ev.type, 'CREATE');
  assert.match(ev.eventId, UUID_RE);
  assert.equal(typeof ev.ts, 'number');
  assert.ok(ev.ts > 0);
});

test('makeEvent: UUID формат eventId для разных типов', () => {
  assert.match(makeEvent({ type: 'ERROR' }).eventId, UUID_RE);
  assert.match(makeEvent({ type: 'IMPORT' }).eventId, UUID_RE);
  assert.match(makeEvent({ type: 'BACKUP' }).eventId, UUID_RE);
});

test('makeEvent: source и result по умолчанию', () => {
  const ev = makeEvent({ type: 'CREATE' });
  assert.equal(ev.source, 'system');
  assert.equal(ev.result, 'ok');
});

test('makeEvent: source и result передаются явно', () => {
  const ev = makeEvent({ type: 'IMPORT', source: 'ui', result: 'error' });
  assert.equal(ev.source, 'ui');
  assert.equal(ev.result, 'error');
});

test('makeEvent: опциональные поля counts, mode, fileHash, backupId', () => {
  const ev = makeEvent({
    type: 'IMPORT',
    counts: { notes: 5, evidence: 3 },
    mode: 'merge',
    fileHash: 'sha256:abc',
    backupId: 42
  });
  assert.deepEqual(ev.counts, { notes: 5, evidence: 3 });
  assert.equal(ev.mode, 'merge');
  assert.equal(ev.details.fileHash, 'sha256:abc');
  assert.equal(ev.details.backupId, 42);
});

test('makeEvent: опциональные поля noteId, text, branch, from, to, details', () => {
  const ev = makeEvent({
    type: 'CORRECT',
    noteId: 'n1',
    text: 'купить молоко',
    branch: 'byt',
    from: 'rabota',
    to: 'byt',
    details: { reason: 'wrong branch' }
  });
  assert.equal(ev.noteId, 'n1');
  assert.equal(ev.text, 'купить молоко');
  assert.equal(ev.branch, 'byt');
  assert.equal(ev.from, 'rabota');
  assert.equal(ev.to, 'byt');
  assert.equal(ev.details.reason, 'wrong branch');
});

// ── mergeEvents ────────────────────────────────────────────────────────────

test('mergeEvents: пустые и невалидные массивы', () => {
  assert.deepEqual(mergeEvents([], []), []);
  assert.deepEqual(mergeEvents(null, []), []);
  assert.deepEqual(mergeEvents([], null), []);
  assert.deepEqual(mergeEvents(undefined, undefined), []);
});

test('mergeEvents: дубли по eventId замещаются новыми', () => {
  const existing = [
    { eventId: 'a', type: 'CREATE', ts: 100 },
    { eventId: 'b', type: 'COMPLETE', ts: 200 }
  ];
  const incoming = [
    { eventId: 'b', type: 'EDIT', ts: 300 },
    { eventId: 'c', type: 'DELETE', ts: 400 }
  ];
  const result = mergeEvents(existing, incoming);
  assert.equal(result.length, 3, 'должно быть 3 уникальных eventId');
  assert.equal(result[0].eventId, 'a');
  assert.equal(result[0].type, 'CREATE');
  assert.equal(result[1].eventId, 'b');
  assert.equal(result[1].type, 'EDIT', 'incoming заменил existing по eventId b');
  assert.equal(result[2].eventId, 'c');
  assert.equal(result[2].type, 'DELETE');
});

test('mergeEvents: исходные массивы не мутированы', () => {
  const existing = [{ eventId: 'a', type: 'CREATE', ts: 100 }];
  const incoming = [{ eventId: 'b', type: 'COMPLETE', ts: 200 }];
  const result = mergeEvents(existing, incoming);
  assert.equal(result.length, 2);
  assert.equal(existing.length, 1, 'existing не изменился');
  assert.equal(incoming.length, 1, 'incoming не изменился');
  assert.deepEqual(existing[0], { eventId: 'a', type: 'CREATE', ts: 100 });
});

test('mergeEvents: мусор в массивах игнорируется', () => {
  const existing = [null, { eventId: 'a', type: 'CREATE', ts: 100 }, 'x'];
  const incoming = [42, { eventId: 'b', type: 'COMPLETE', ts: 200 }, undefined];
  const result = mergeEvents(existing, incoming);
  assert.equal(result.length, 2);
  assert.equal(result[0].eventId, 'a');
  assert.equal(result[1].eventId, 'b');
});

// ── typeTagClass ───────────────────────────────────────────────────────────

test('typeTagClass: CREATE → create', () => {
  assert.equal(typeTagClass('CREATE'), 'create');
});

test('typeTagClass: ERROR → error', () => {
  assert.equal(typeTagClass('ERROR'), 'error');
});

test('typeTagClass: BACKUP → backup', () => {
  assert.equal(typeTagClass('BACKUP'), 'backup');
});

test('typeTagClass: RESTORE и UNDO_DELETE → restore', () => {
  assert.equal(typeTagClass('RESTORE'), 'restore');
  assert.equal(typeTagClass('UNDO_DELETE'), 'restore');
});

test('typeTagClass: EXPORT и EXPORT_AUDIT → export', () => {
  assert.equal(typeTagClass('EXPORT'), 'export');
  assert.equal(typeTagClass('EXPORT_AUDIT'), 'export');
});

test('typeTagClass: неизвестный тип → default', () => {
  assert.equal(typeTagClass('UNKNOWN'), 'default');
  assert.equal(typeTagClass('FOO'), 'default');
  assert.equal(typeTagClass(''), 'default');
});

// ── typeFilterTypes ────────────────────────────────────────────────────────

test('typeFilterTypes: содержит все ожидаемые типы, ALL первым', () => {
  const types = typeFilterTypes();
  assert.ok(Array.isArray(types));
  assert.ok(types.includes('ALL'));
  assert.ok(types.includes('CREATE'));
  assert.ok(types.includes('COMPLETE'));
  assert.ok(types.includes('REOPEN'));
  assert.ok(types.includes('CORRECT'));
  assert.ok(types.includes('DELETE'));
  assert.ok(types.includes('RESTORE'));
  assert.ok(types.includes('UNDO_DELETE'));
  assert.ok(types.includes('EDIT'));
  assert.ok(types.includes('IMPORT'));
  assert.ok(types.includes('EXPORT'));
  assert.ok(types.includes('EXPORT_AUDIT'));
  assert.ok(types.includes('RESET'));
  assert.ok(types.includes('BACKUP'));
  assert.ok(types.includes('RESTORE_BACKUP'));
  assert.ok(types.includes('UI'));
  assert.ok(types.includes('MIDNIGHT'));
  assert.ok(types.includes('ERROR'));
  assert.equal(types[0], 'ALL', 'первый элемент — ALL');
});