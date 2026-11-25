import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectBackupsToKeep } from '../www/js/backup.js';

function makeBackup(id, exportedAt) {
  return { id, exportedAt };
}

// ── selectBackupsToKeep ──────────────────────────────────────────────────────

test('selectBackupsToKeep: пустой массив → []', () => {
  assert.deepEqual(selectBackupsToKeep([]), []);
});

test('selectBackupsToKeep: null/undefined → []', () => {
  assert.deepEqual(selectBackupsToKeep(null), []);
  assert.deepEqual(selectBackupsToKeep(undefined), []);
});

test('selectBackupsToKeep: массив меньше лимита → ничего не удаляем', () => {
  const backups = [
    makeBackup('b1', 200),
    makeBackup('b2', 100),
  ];
  assert.deepEqual(selectBackupsToKeep(backups, 3), []);
});

test('selectBackupsToKeep: массив равен лимиту → ничего не удаляем', () => {
  const backups = [
    makeBackup('b1', 300),
    makeBackup('b2', 200),
    makeBackup('b3', 100),
  ];
  assert.deepEqual(selectBackupsToKeep(backups, 3), []);
});

test('selectBackupsToKeep: массив больше лимита → удаляем старые', () => {
  const backups = [
    makeBackup('b1', 400),
    makeBackup('b2', 300),
    makeBackup('b3', 200),
    makeBackup('b4', 100),
    makeBackup('b5', 50),
  ];
  const toDelete = selectBackupsToKeep(backups, 3);
  assert.equal(toDelete.length, 2);
  assert.deepEqual(toDelete, ['b4', 'b5']);
});

test('selectBackupsToKeep: сортировка по убыванию exportedAt', () => {
  const backups = [
    makeBackup('old', 100),
    makeBackup('new', 300),
    makeBackup('mid', 200),
  ];
  const toDelete = selectBackupsToKeep(backups, 1);
  assert.equal(toDelete.length, 2);
  assert.deepEqual(toDelete, ['mid', 'old']);
});

test('selectBackupsToKeep: записи без exportedAt фильтруются перед сортировкой', () => {
  const backups = [
    makeBackup('b1', 300),
    { id: 'b2', reason: 'no-date' },
    makeBackup('b3', 100),
  ];
  const toDelete = selectBackupsToKeep(backups, 1);
  assert.equal(toDelete.length, 1);
  assert.deepEqual(toDelete, ['b3']);
});

test('selectBackupsToKeep: maxCount 0 → удаляем все', () => {
  const backups = [
    makeBackup('b1', 300),
    makeBackup('b2', 200),
  ];
  const toDelete = selectBackupsToKeep(backups, 0);
  assert.equal(toDelete.length, 2);
  assert.deepEqual(toDelete, ['b1', 'b2']);
});

test('selectBackupsToKeep: maxCount отрицательный → как 0', () => {
  const backups = [
    makeBackup('b1', 300),
  ];
  const toDelete = selectBackupsToKeep(backups, -1);
  assert.equal(toDelete.length, 1);
  assert.deepEqual(toDelete, ['b1']);
});

test('selectBackupsToKeep: maxCount не число → лимит 3', () => {
  const backups = [
    makeBackup('b1', 400),
    makeBackup('b2', 300),
    makeBackup('b3', 200),
    makeBackup('b4', 100),
  ];
  const toDelete = selectBackupsToKeep(backups, 'foo');
  assert.equal(toDelete.length, 1);
  assert.deepEqual(toDelete, ['b4']);
});