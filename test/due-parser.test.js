import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DueParser } from '../www/js/due-parser.js';

// Вторник, 17 ноября 2026, 10:00 — локальное время.
const NOW = new Date(2026, 10, 17, 10, 0, 0, 0).getTime();
const at = (day, h = 23, m = 59, month = 10) =>
  new Date(2026, month, day, h, m, 0, 0).getTime();

const cases = [
  ['врач', null],
  ['врач сегодня', at(17)],
  ['завтра врач', at(18)],
  ['послезавтра врач', at(19)],
  ['врач до 20', at(17, 20, 0)],
  ['врач к 20:30', at(17, 20, 30)],
  ['врач в 9', at(17, 9, 0)],
  ['завтра врач до 20', at(18, 20, 0)],
  ['через 3 дня врач', at(20)],
  ['через 2 часа', at(17, 12, 0)],
  ['в пятницу врач', at(20)],
  ['до 99', null],
  ['до 25', null],
  ['позвонить маме до 20', at(17, 20, 0)],
  ['дочитать отчёт завтра в 11', at(18, 11, 0)],
  ['записаться к зубу в пятницу', at(20)],
  ['завтра в 11', at(18, 11, 0)],
  ['сегодня в 23:59', at(17, 23, 59)],
  ['в среду', at(18)],
  ['в субботу', at(21)],
  ['в воскресенье', at(22)],
  ['в понедельник', at(23)],
  ['во вторник', at(17)],
  ['в четверг', at(19)],
  ['через 30 минут', at(17, 10, 30)],
  ['через 1 час', at(17, 11, 0)],
  ['через 5 часов', at(17, 15, 0)],
  ['через 1 день', at(18)],
  ['через 2 недели', at(1, 23, 59, 11)],
  ['послезавтра до 18', at(19, 18, 0)],
  ['завтра к 9:15', at(18, 9, 15)],
  ['в 20:00', at(17, 20, 0)],
  ['к 23:59', at(17, 23, 59)],
  ['в 0', at(17, 0, 0)],
  ['в 24', null],
  ['в 12:60', null],
  ['до 20:30', at(17, 20, 30)],
  ['через 2 часа врач', at(17, 12, 0)],
  ['завтра', at(18)],
  ['сегодня', at(17)]
];

for (const [text, expected] of cases) {
  test(`парсер: ${JSON.stringify(text)}`, () => {
    const result = DueParser.parse(text, NOW);
    if (expected === null) {
      assert.equal(result, null);
      return;
    }
    assert.ok(result, `ожидался срок для ${JSON.stringify(text)}`);
    assert.equal(result.dueAt, expected);
    assert.equal(result.source, 'PARSED');
  });
}

test('парсер: регистр и пунктуация не мешают', () => {
  assert.equal(DueParser.parse('В пятницу', NOW).dueAt, at(20));
  assert.equal(DueParser.parse('завтра, врач', NOW).dueAt, at(18));
});

test('парсер: через 2 часа поздно вечером переходит на следующий день', () => {
  const late = new Date(2026, 10, 17, 23, 30, 0, 0).getTime();
  assert.equal(DueParser.parse('через 2 часа', late).dueAt, at(18, 1, 30));
});

test('парсер: прошедшее «до 20» не переносится на завтра', () => {
  const late = new Date(2026, 10, 17, 21, 0, 0, 0).getTime();
  assert.equal(DueParser.parse('врач до 20', late).dueAt, at(17, 20, 0));
});

test('парсер: «в пятницу» в пятницу — это сегодня', () => {
  const friday = new Date(2026, 10, 20, 10, 0, 0, 0).getTime();
  assert.equal(DueParser.parse('в пятницу', friday).dueAt, at(20));
});

test('парсер: «в пятницу до 20» в пятницу вечером — уже прошедшее время', () => {
  const fridayLate = new Date(2026, 10, 20, 21, 0, 0, 0).getTime();
  assert.equal(DueParser.parse('в пятницу до 20', fridayLate).dueAt, at(20, 20, 0));
});

test('парсер: через 1 неделю', () => {
  assert.equal(DueParser.parse('через 1 неделю', NOW).dueAt, at(24));
});

test('парсер: через 0 дней — сегодня до конца дня', () => {
  assert.equal(DueParser.parse('через 0 дней', NOW).dueAt, at(17));
});
