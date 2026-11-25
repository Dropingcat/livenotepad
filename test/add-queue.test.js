import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSerialQueue } from '../www/js/add-queue.js';

test('add-queue: order — tasks execute in sequence', async () => {
  const q = createSerialQueue();
  const order = [];
  q.enqueue(() => order.push(1));
  q.enqueue(() => order.push(2));
  // Wait for both to complete
  await new Promise(r => setTimeout(r, 10));
  assert.deepEqual(order, [1, 2]);
});

test('add-queue: second waits for first to complete', async () => {
  const q = createSerialQueue();
  let started1 = false, finished1 = false;
  let started2 = false;
  const p1 = q.enqueue(async () => {
    started1 = true;
    await new Promise(r => setTimeout(r, 20));
    finished1 = true;
  });
  const p2 = q.enqueue(() => {
    started2 = true;
  });
  await Promise.all([p1, p2]);
  assert.equal(started1, true);
  assert.equal(finished1, true);
  assert.equal(started2, true);
});

test('add-queue: reject first does not block second', async () => {
  const q = createSerialQueue();
  let secondRan = false;
  q.enqueue(() => Promise.reject(new Error('boom')));
  await q.enqueue(() => {
    secondRan = true;
  });
  assert.equal(secondRan, true);
});

test('add-queue: arguments passed to task', async () => {
  const q = createSerialQueue();
  let captured;
  await q.enqueue(() => {
    captured = 'hello';
    return 'ignored';
  });
  assert.equal(captured, 'hello');
});

test('add-queue: parallel enqueue does not interleave', async () => {
  const q = createSerialQueue();
  const order = [];
  // Enqueue two slow tasks without awaiting between enqueues
  const p1 = q.enqueue(async () => {
    order.push('a-start');
    await new Promise(r => setTimeout(r, 10));
    order.push('a-end');
  });
  const p2 = q.enqueue(async () => {
    order.push('b-start');
    await new Promise(r => setTimeout(r, 5));
    order.push('b-end');
  });
  await Promise.all([p1, p2]);
  assert.deepEqual(order, ['a-start', 'a-end', 'b-start', 'b-end']);
});