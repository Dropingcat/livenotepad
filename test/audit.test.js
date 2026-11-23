import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeEvent,
  errorEvent,
  newId,
  createSessionId,
  getOrCreateDeviceId,
  truncateText,
  buildAuditExport,
  createFallbackQueue,
  flushAuditQueue,
  readAuditLogs,
  LEGACY_FIELDS
} from '../www/js/audit.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const META = { sessionId: 'sess-1', deviceId: 'dev-1', appVersion: 'alpha v0.3' };

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    }
  };
}

const throwingStorage = {
  getItem() { throw new Error('storage denied'); },
  setItem() { throw new Error('storage denied'); }
};

test('makeEvent: схема события и мета', () => {
  const ev = makeEvent({ type: 'CREATE', source: 'ui', result: 'ok' }, META);
  assert.equal(ev.type, 'CREATE');
  assert.equal(ev.source, 'ui');
  assert.equal(ev.result, 'ok');
  assert.equal(ev.sessionId, 'sess-1');
  assert.equal(ev.deviceId, 'dev-1');
  assert.equal(ev.appVersion, 'alpha v0.3');
  assert.equal(ev.context, '');
  assert.equal(ev.message, '');
  assert.equal(ev.stack, '');
  assert.deepEqual(ev.details, {});
  assert.equal(typeof ev.ts, 'number');
  assert.ok(ev.ts > 0);
});

test('makeEvent: eventId — UUID, ts сохраняется', () => {
  const ev = makeEvent({ ts: 1764000000000 }, META);
  assert.match(ev.eventId, UUID_RE);
  assert.equal(ev.ts, 1764000000000);
  assert.notEqual(makeEvent({}, META).eventId, makeEvent({}, META).eventId);
});

test('makeEvent: legacy-поля остаются на верхнем уровне', () => {
  const ev = makeEvent({
    type: 'CORRECT',
    noteId: 'n1',
    branch: 'byt',
    text: 'купить молоко',
    from: 'rabota',
    to: 'byt',
    mode: 'merge',
    counts: { notesAdded: 2 }
  }, META);
  for (const key of LEGACY_FIELDS) assert.ok(key in ev, `нет legacy-поля ${key}`);
  assert.equal(ev.noteId, 'n1');
  assert.equal(ev.branch, 'byt');
  assert.equal(ev.from, 'rabota');
  assert.equal(ev.to, 'byt');
  assert.equal(ev.mode, 'merge');
  assert.deepEqual(ev.counts, { notesAdded: 2 });
});

test('makeEvent: details дополняется noteId/branch/action/counts', () => {
  const ev = makeEvent({ type: 'UI', noteId: 'n2', branch: 'ljudi', action: 'startEdit', counts: { x: 1 } }, META);
  assert.equal(ev.details.noteId, 'n2');
  assert.equal(ev.details.branch, 'ljudi');
  assert.equal(ev.details.action, 'startEdit');
  assert.deepEqual(ev.details.counts, { x: 1 });
});

test('makeEvent: полный текст обрезается до 100 символов', () => {
  const long = 'я'.repeat(150);
  const ev = makeEvent({ type: 'CREATE', text: long, details: { text: long } }, META);
  assert.equal(ev.text.length, 100);
  assert.equal(ev.details.text.length, 100);
  assert.equal(ev.text, long.slice(0, 100));
});

test('truncateText: null, короткий и длинный текст', () => {
  assert.equal(truncateText(null), '');
  assert.equal(truncateText(undefined), '');
  assert.equal(truncateText('коротко'), 'коротко');
  assert.equal(truncateText('абвгд', 3), 'абв');
  assert.equal(truncateText('я'.repeat(120)).length, 100);
});

test('errorEvent: Error → ERROR с message и stack', () => {
  const err = new Error('boom');
  const ev = errorEvent('db', err, META);
  assert.equal(ev.type, 'ERROR');
  assert.equal(ev.result, 'error');
  assert.equal(ev.context, 'db');
  assert.equal(ev.message, 'boom');
  assert.equal(typeof ev.stack, 'string');
  assert.ok(ev.stack.includes('boom'));
  assert.equal(ev.sessionId, 'sess-1');
});

test('errorEvent: строка → ERROR', () => {
  const ev = errorEvent('window', 'строковая ошибка', META);
  assert.equal(ev.type, 'ERROR');
  assert.equal(ev.result, 'error');
  assert.equal(ev.context, 'window');
  assert.equal(ev.message, 'строковая ошибка');
  assert.equal(ev.stack, '');
});

test('errorEvent: объект → ERROR', () => {
  const ev = errorEvent('promise', { message: 'rejected', stack: 'at x' }, META);
  assert.equal(ev.type, 'ERROR');
  assert.equal(ev.message, 'rejected');
  assert.equal(ev.stack, 'at x');
});

test('errorEvent: object без message и name → сериализуется', () => {
  const ev = errorEvent('import', { code: 42 }, META);
  assert.equal(ev.type, 'ERROR');
  assert.equal(ev.message, '{"code":42}');
});

test('errorEvent: null → ERROR с безопасным message', () => {
  const ev = errorEvent('note', null, META);
  assert.equal(ev.type, 'ERROR');
  assert.equal(ev.result, 'error');
  assert.equal(ev.message, 'Unknown error');
  assert.equal(ev.stack, '');
});

test('buildAuditExport: формат, версия и мета', () => {
  const data = buildAuditExport([], {
    ...META,
    exportedAt: '2026-11-23T10:00:00.000Z',
    userAgent: 'UA/1',
    platform: 'Win32'
  });
  assert.equal(data.format, 'livenotepad-audit');
  assert.equal(data.version, 1);
  assert.equal(data.exportedAt, '2026-11-23T10:00:00.000Z');
  assert.equal(data.appVersion, 'alpha v0.3');
  assert.equal(data.sessionId, 'sess-1');
  assert.equal(data.deviceId, 'dev-1');
  assert.equal(data.userAgent, 'UA/1');
  assert.equal(data.platform, 'Win32');
  assert.deepEqual(data.counts, { events: 0, errors: 0, failed: 0 });
  assert.equal(data.pending, 0);
  assert.equal(data.lost, 0);
  assert.deepEqual(data.events, []);
});

test('buildAuditExport: counts events/errors и сортировка по ts', () => {
  const events = [
    makeEvent({ eventId: 'c', ts: 300, type: 'CREATE' }, META),
    makeEvent({ eventId: 'a', ts: 100, type: 'ERROR', result: 'error' }, META),
    makeEvent({ eventId: 'b', ts: 200, type: 'COMPLETE' }, META),
    makeEvent({ eventId: 'd', ts: 400, type: 'ERROR', result: 'error' }, META)
  ];
  const data = buildAuditExport(events, META);
  assert.deepEqual(data.events.map(e => e.eventId), ['a', 'b', 'c', 'd']);
  assert.deepEqual(data.counts, { events: 4, errors: 2, failed: 2 });
});

test('buildAuditExport: counts.errors включает result:error (IMPORT), failed — отдельно', () => {
  const events = [
    makeEvent({ eventId: 'a', ts: 100, type: 'CREATE' }, META),
    makeEvent({ eventId: 'b', ts: 200, type: 'IMPORT', source: 'import', result: 'error' }, META),
    makeEvent({ eventId: 'c', ts: 300, type: 'CREATE' }, META),
    makeEvent({ eventId: 'd', ts: 400, type: 'ERROR', result: 'error' }, META)
  ];
  const data = buildAuditExport(events, META);
  assert.deepEqual(data.counts, { events: 4, errors: 2, failed: 2 });

  const onlyImport = buildAuditExport([
    makeEvent({ eventId: 'i', ts: 1, type: 'IMPORT', result: 'error' }, META)
  ], META);
  assert.deepEqual(onlyImport.counts, { events: 1, errors: 1, failed: 1 });
});

test('buildAuditExport: pending-события попадают в выгрузку и дедуплицируются по eventId', () => {
  const inDb = makeEvent({ eventId: 'dup', ts: 100, type: 'CREATE' }, META);
  const pendingOnly = makeEvent({ eventId: 'pend', ts: 300, type: 'UI' }, META);
  const pendingDup = makeEvent({ eventId: 'dup', ts: 100, type: 'CREATE' }, META);
  const data = buildAuditExport([inDb], {
    ...META,
    pendingEvents: [pendingDup, pendingOnly],
    pending: 2,
    lost: 3
  });
  assert.deepEqual(data.events.map(e => e.eventId), ['dup', 'pend']);
  assert.equal(data.counts.events, 2);
  assert.equal(data.pending, 2);
  assert.equal(data.lost, 3);
});

test('buildAuditExport: мусор в pendingEvents игнорируется, pending по умолчанию из списка', () => {
  const data = buildAuditExport([], { ...META, pendingEvents: [null, 42, { eventId: 'p1', ts: 5, type: 'UI' }] });
  assert.equal(data.events.length, 1);
  assert.equal(data.pending, 1);
  assert.equal(data.lost, 0);
});

test('readAuditLogs: сбой чтения БД пробрасывается, а не превращается в пустой экспорт', async () => {
  await assert.rejects(
    readAuditLogs(async () => { throw new Error('DB not initialized'); }),
    /DB not initialized/
  );
  await assert.rejects(readAuditLogs(null), /getAllLogs/);

  const logs = await readAuditLogs(async () => [null, { eventId: 'e1', type: 'UI' }]);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].eventId, 'e1');
  assert.deepEqual(await readAuditLogs(async () => null), []);
});

test('buildAuditExport: устойчив к не-массиву и мусору', () => {
  assert.deepEqual(buildAuditExport(null, META).counts, { events: 0, errors: 0, failed: 0 });
  const data = buildAuditExport([null, 42, 'x', { ts: 1, type: 'UI' }], META);
  assert.deepEqual(data.counts, { events: 1, errors: 0, failed: 0 });
});

test('getOrCreateDeviceId: создаёт и сохраняет', () => {
  const storage = fakeStorage();
  const first = getOrCreateDeviceId(storage);
  assert.match(first, UUID_RE);
  assert.equal(storage.data['livenotepad.deviceId'], first);
});

test('getOrCreateDeviceId: переиспользует существующий', () => {
  const storage = fakeStorage({ 'livenotepad.deviceId': 'dev-existing' });
  assert.equal(getOrCreateDeviceId(storage), 'dev-existing');
});

test('getOrCreateDeviceId: storage=null и бросающий storage не падают', () => {
  assert.match(getOrCreateDeviceId(null), UUID_RE);
  assert.match(getOrCreateDeviceId(throwingStorage), UUID_RE);
});

test('createSessionId/newId: UUID', () => {
  assert.match(createSessionId(), UUID_RE);
  assert.match(newId(), UUID_RE);
});

test('createFallbackQueue: push и drain', () => {
  const storage = fakeStorage();
  const queue = createFallbackQueue(storage, 'audit.q', 200);
  queue.push(makeEvent({ eventId: 'e1', ts: 1 }, META));
  queue.push(makeEvent({ eventId: 'e2', ts: 2 }, META));
  assert.equal(queue.size(), 2);
  const drained = queue.drain();
  assert.deepEqual(drained.map(e => e.eventId), ['e1', 'e2']);
  assert.equal(queue.size(), 0);
  assert.deepEqual(queue.drain(), []);
});

test('createFallbackQueue: limit — ring buffer, старые вытесняются', () => {
  const storage = fakeStorage();
  const queue = createFallbackQueue(storage, 'audit.q', 2);
  queue.push({ eventId: 'a' });
  queue.push({ eventId: 'b' });
  queue.push({ eventId: 'c' });
  assert.deepEqual(queue.drain().map(e => e.eventId), ['b', 'c']);
});

test('createFallbackQueue: storage=null не падает', () => {
  const queue = createFallbackQueue(null, 'audit.q', 200);
  assert.equal(queue.push({ eventId: 'a' }), false);
  assert.deepEqual(queue.drain(), []);
  assert.equal(queue.size(), 0);
});

test('createFallbackQueue: бросающий storage не падает', () => {
  const queue = createFallbackQueue(throwingStorage, 'audit.q', 200);
  assert.equal(queue.push({ eventId: 'a' }), false);
  assert.deepEqual(queue.drain(), []);
  assert.equal(queue.size(), 0);
});

test('createFallbackQueue: битый JSON в storage игнорируется', () => {
  const storage = fakeStorage({ 'audit.q': '{не json' });
  const queue = createFallbackQueue(storage, 'audit.q', 200);
  assert.equal(queue.size(), 0);
  queue.push({ eventId: 'a' });
  assert.deepEqual(queue.drain().map(e => e.eventId), ['a']);
});

test('createFallbackQueue: snapshot не удаляет, peek/shift/restore работают', () => {
  const storage = fakeStorage();
  const queue = createFallbackQueue(storage, 'audit.q', 200);
  queue.push({ eventId: 'a' });
  queue.push({ eventId: 'b' });

  assert.deepEqual(queue.snapshot().map(e => e.eventId), ['a', 'b']);
  assert.equal(queue.size(), 2, 'snapshot не должен удалять события');
  assert.equal(queue.peek().eventId, 'a');
  assert.equal(queue.peek().eventId, 'a', 'peek не удаляет');
  assert.equal(queue.shift().eventId, 'a');
  assert.deepEqual(queue.snapshot().map(e => e.eventId), ['b']);

  assert.equal(queue.restore([{ eventId: 'a' }]), true);
  assert.deepEqual(queue.snapshot().map(e => e.eventId), ['a', 'b'], 'restore кладёт в начало');

  assert.deepEqual(queue.drain().map(e => e.eventId), ['a', 'b']);
  assert.equal(queue.peek(), null);
  assert.equal(queue.shift(), null);
});

test('createFallbackQueue: lost() считает сбои записи и вытеснение кольцом', () => {
  const nullQueue = createFallbackQueue(null, 'audit.q', 200);
  assert.equal(nullQueue.push({ eventId: 'a' }), false);
  assert.equal(nullQueue.lost(), 1);
  assert.equal(nullQueue.push({ eventId: 'b' }), false);
  assert.equal(nullQueue.lost(), 2);

  const storage = fakeStorage();
  const queue = createFallbackQueue(storage, 'audit.q', 2);
  queue.push({ eventId: 'a' });
  queue.push({ eventId: 'b' });
  assert.equal(queue.lost(), 0);
  queue.push({ eventId: 'c' }); // вытесняет 'a'
  assert.equal(queue.lost(), 1);
  assert.deepEqual(queue.snapshot().map(e => e.eventId), ['b', 'c']);
});

test('flushAuditQueue: пишет до удаления и очищает очередь при успехе', async () => {
  const storage = fakeStorage();
  const queue = createFallbackQueue(storage, 'audit.q', 200);
  queue.push({ eventId: 'a' });
  queue.push({ eventId: 'b' });

  const written = [];
  const res = await flushAuditQueue(queue, async ev => {
    // Ключевое для R-10: на момент записи событие ещё в очереди.
    assert.ok(queue.snapshot().some(e => e.eventId === ev.eventId), 'событие удалено до записи');
    written.push(ev.eventId);
  });

  assert.deepEqual(written, ['a', 'b']);
  assert.equal(res.written, 2);
  assert.equal(res.failed, 0);
  assert.equal(res.lastError, null);
  assert.equal(queue.size(), 0);
});

test('flushAuditQueue: сбой addLog возвращает события в очередь, успешные удалены', async () => {
  const storage = fakeStorage();
  const queue = createFallbackQueue(storage, 'audit.q', 200);
  queue.push({ eventId: 'a' });
  queue.push({ eventId: 'b' });
  queue.push({ eventId: 'c' });

  const res = await flushAuditQueue(queue, async ev => {
    if (ev.eventId === 'b') throw new Error('write failed');
  });

  assert.equal(res.written, 2);
  assert.equal(res.failed, 1);
  assert.ok(res.lastError instanceof Error);
  assert.deepEqual(queue.snapshot().map(e => e.eventId), ['b'], 'сбойное событие вернулось в очередь');
});

test('flushAuditQueue: полный сбой записи сохраняет все события и порядок', async () => {
  const storage = fakeStorage();
  const queue = createFallbackQueue(storage, 'audit.q', 200);
  queue.push({ eventId: 'a' });
  queue.push({ eventId: 'b' });

  const res = await flushAuditQueue(queue, async () => { throw new Error('DB not initialized'); });

  assert.equal(res.written, 0);
  assert.equal(res.failed, 2);
  assert.deepEqual(queue.snapshot().map(e => e.eventId), ['a', 'b']);
  assert.equal(queue.size(), 2);
});
