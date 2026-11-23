import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promTx, applyMergePlan, readSnapshot } from '../www/js/idb.js';

// ── fake IDB (без indexedDB) ────────────────────────────────────────────────

function makeFakeReq(result) {
  return { result, error: null, onsuccess: null, onerror: null };
}

function makeFakeTx(base = {}) {
  const tx = {
    error: null,
    oncomplete: null,
    onerror: null,
    onabort: null,
    ...base
  };
  return tx;
}

function makeFakeDbTx({ shouldFail, error } = {}) {
  const log = [];
  let aborted = false;
  const countReq = makeFakeReq(0);
  const stores = new Map();

  const maybeFail = (storeName, op, row) => {
    if (shouldFail && shouldFail(storeName, op, row)) throw error;
  };

  function makeStore(name) {
    return {
      put(row) { maybeFail(name, 'put', row); log.push({ name, op: 'put', row }); },
      add(row) { maybeFail(name, 'add', row); log.push({ name, op: 'add', row }); },
      count() { log.push({ name, op: 'count' }); return countReq; }
    };
  }

  const tx = makeFakeTx({
    abort() { aborted = true; },
    objectStore(name) {
      if (!stores.has(name)) stores.set(name, makeStore(name));
      return stores.get(name);
    }
  });

  return { tx, log, countReq, isAborted: () => aborted };
}

function makeFakeSnapshotTx(data = {}) {
  const requested = [];
  const requests = {};
  const tx = makeFakeTx({
    objectStore(name) {
      requested.push(name);
      return {
        getAll() {
          const req = makeFakeReq(data[name] === undefined ? [] : data[name]);
          requests[name] = req;
          return req;
        }
      };
    }
  });
  return { tx, requested, requests };
}

function makePlan(overrides = {}) {
  return {
    notes: [{ id: 'n1', text: 'a' }],
    evidence: [{ stem: 's', branch: 'rabota', evidence: 1 }],
    meta: [{ stem: 's', state: 'CANDIDATE', distinctNotes: 1 }],
    logs: [{ id: 3, type: 'CREATE', ts: 1 }],
    ...overrides
  };
}

// ── promTx ──────────────────────────────────────────────────────────────────

test('promTx: resolve 0 по tx.oncomplete (falsy — валидный результат)', async () => {
  const req = makeFakeReq(0);
  const tx = makeFakeTx();
  const promise = promTx(tx, req);
  req.onsuccess();
  tx.oncomplete();
  assert.equal(await promise, 0);
});

test('promTx: req.onerror отдаёт req.error, а не null', async () => {
  const reqError = new Error('DataError');
  const req = makeFakeReq(undefined);
  req.error = reqError;
  const tx = makeFakeTx({ error: null });
  const promise = promTx(tx, req);
  req.onerror();
  await assert.rejects(promise, err => err === reqError);
});

test('promTx: tx.onerror без tx.error реджектит Error, а не null', async () => {
  const req = makeFakeReq(undefined);
  const tx = makeFakeTx({ error: null });
  const promise = promTx(tx, req);
  tx.onerror();
  await assert.rejects(promise, err => err instanceof Error && err.message === 'Transaction failed');
});

test('promTx: tx.onabort без tx.error реджектит Error, а не null', async () => {
  const req = makeFakeReq(undefined);
  const tx = makeFakeTx({ error: null });
  const promise = promTx(tx, req);
  tx.onabort();
  await assert.rejects(promise, err => err instanceof Error && err.message === 'Transaction aborted');
});

// ── readSnapshot: целостный baseline одной транзакцией ─────────────────────

test('readSnapshot: одна транзакция, 4 store, oncomplete → {notes,evidence,meta,logs}', async () => {
  const data = {
    notes: [{ id: 'n1', text: 'a' }],
    word_evidence: [{ stem: 's', branch: 'rabota', evidence: 2 }],
    word_meta: [{ stem: 's', state: 'CANDIDATE' }],
    training_log: [{ id: 1, type: 'CREATE' }]
  };
  const { tx, requested } = makeFakeSnapshotTx(data);
  const promise = readSnapshot(tx);
  assert.deepEqual(requested, ['notes', 'word_evidence', 'word_meta', 'training_log']);
  tx.oncomplete();
  assert.deepEqual(await promise, {
    notes: data.notes,
    evidence: data.word_evidence,
    meta: data.word_meta,
    logs: data.training_log
  });
});

test('readSnapshot: берёт request.result на oncomplete, а не в момент getAll', async () => {
  const { tx, requests } = makeFakeSnapshotTx({ notes: [{ id: 'old' }] });
  const promise = readSnapshot(tx);
  requests.notes.result = [{ id: 'new' }];
  tx.oncomplete();
  assert.deepEqual((await promise).notes, [{ id: 'new' }]);
});

test('readSnapshot: все 4 getAll вызваны синхронно до oncomplete', async () => {
  const { tx, requested } = makeFakeSnapshotTx();
  let settled = false;
  const promise = readSnapshot(tx).finally(() => { settled = true; });
  assert.equal(requested.length, 4);
  await Promise.resolve();
  assert.equal(settled, false, 'снимок не должен резолвиться до завершения транзакции');
  tx.oncomplete();
  await promise;
  assert.equal(settled, true);
});

test('readSnapshot: tx.onabort → reject с Error, а не null', async () => {
  const { tx } = makeFakeSnapshotTx();
  const promise = readSnapshot(tx);
  tx.onabort();
  await assert.rejects(promise, err => err instanceof Error && err.message === 'Snapshot transaction aborted');
});

test('readSnapshot: tx.onerror → reject с Error, а не null', async () => {
  const { tx } = makeFakeSnapshotTx();
  const promise = readSnapshot(tx);
  tx.onerror();
  await assert.rejects(promise, err => err instanceof Error && err.message === 'Snapshot transaction failed');
});

test('readSnapshot: tx.error пробрасывается при abort', async () => {
  const txError = new Error('QuotaExceededError');
  const { tx } = makeFakeSnapshotTx();
  tx.error = txError;
  const promise = readSnapshot(tx);
  tx.onabort();
  await assert.rejects(promise, err => err === txError);
});

test('readSnapshot: повторный вызов на новом tx даёт независимый снимок', async () => {
  const first = makeFakeSnapshotTx({ notes: [{ id: 'a' }], training_log: [{ id: 1 }] });
  const p1 = readSnapshot(first.tx);
  first.tx.oncomplete();
  const s1 = await p1;

  const second = makeFakeSnapshotTx({ notes: [{ id: 'b' }, { id: 'c' }], training_log: [] });
  const p2 = readSnapshot(second.tx);
  second.tx.oncomplete();
  const s2 = await p2;

  assert.notEqual(first.tx, second.tx);
  assert.deepEqual(s1.notes, [{ id: 'a' }]);
  assert.deepEqual(s1.logs, [{ id: 1 }]);
  assert.deepEqual(s2.notes, [{ id: 'b' }, { id: 'c' }]);
  assert.deepEqual(s2.logs, []);
  assert.equal(first.requested.length, 4);
  assert.equal(second.requested.length, 4);
});

// ── applyMergePlan: атомарность ─────────────────────────────────────────────

test('applyMergePlan: DataError в середине → abort вызван, исходная ошибка проброшена', () => {
  const dataError = new Error('DataError');
  dataError.name = 'DataError';
  const { tx, isAborted } = makeFakeDbTx({
    error: dataError,
    shouldFail: (name, op, row) => name === 'word_evidence' && op === 'put' && row.stem === 'bad'
  });
  const plan = makePlan({
    evidence: [
      { stem: 'ok', branch: 'rabota', evidence: 1 },
      { stem: 'bad', branch: 'rabota', evidence: 1 }
    ]
  });
  assert.throws(() => applyMergePlan(tx, plan), err => err === dataError);
  assert.equal(isAborted(), true, 'без tx.abort() частичный импорт остался бы в базе');
});

test('applyMergePlan: DataCloneError → abort вызван, исходная ошибка проброшена', () => {
  const cloneError = new Error('DataCloneError');
  cloneError.name = 'DataCloneError';
  const { tx, isAborted } = makeFakeDbTx({
    error: cloneError,
    shouldFail: (name, op) => name === 'word_meta' && op === 'put'
  });
  assert.throws(() => applyMergePlan(tx, makePlan()), err => err === cloneError);
  assert.equal(isAborted(), true);
});

test('applyMergePlan: сбой tx.abort() не затирает исходную ошибку', () => {
  const dataError = new Error('DataError');
  const { tx } = makeFakeDbTx({
    error: dataError,
    shouldFail: (name, op) => name === 'notes' && op === 'put'
  });
  tx.abort = () => { throw new Error('InvalidStateError'); };
  assert.throws(() => applyMergePlan(tx, makePlan()), err => err === dataError);
});

test('applyMergePlan: успех → abort не вызван, возвращён count request, promTx даёт 0', async () => {
  const { tx, log, countReq, isAborted } = makeFakeDbTx();
  const result = applyMergePlan(tx, makePlan());
  assert.equal(result, countReq);
  assert.equal(isAborted(), false);
  assert.deepEqual(log.map(c => `${c.name}:${c.op}`), [
    'notes:put', 'word_evidence:put', 'word_meta:put', 'training_log:put', 'notes:count'
  ]);
  const promise = promTx(tx, result);
  result.onsuccess();
  tx.oncomplete();
  assert.equal(await promise, 0);
});

test('applyMergePlan: лог без id уходит в add без поля id', () => {
  const { tx, log } = makeFakeDbTx();
  applyMergePlan(tx, makePlan({ logs: [{ type: 'IMPORT', ts: 1 }] }));
  const entry = log.find(c => c.name === 'training_log');
  assert.equal(entry.op, 'add');
  assert.equal('id' in entry.row, false);
});

test('applyMergePlan: пустой план возвращает count request и ничего не пишет', () => {
  const { tx, log, countReq } = makeFakeDbTx();
  const plan = { notes: [], evidence: [], meta: [], logs: [] };
  assert.equal(applyMergePlan(tx, plan), countReq);
  assert.deepEqual(log.map(c => `${c.name}:${c.op}`), ['notes:count']);
});
