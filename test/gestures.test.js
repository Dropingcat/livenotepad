import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GESTURE, resolveTouchAction, resolveMouseAction, placeMenu, resolveSheetSwipe } from '../www/js/gestures.js';

test('касание: тап 120 мс — toggle', () => {
  assert.equal(resolveTouchAction({ dx: 0, dy: 0, durationMs: 120 }), 'toggle');
});

test('касание: удержание 400 мс без движения — none', () => {
  assert.equal(resolveTouchAction({ dx: 0, dy: 0, durationMs: 400 }), 'none');
});

test('касание: свайп влево −100 при dy 0 — toggle', () => {
  assert.equal(resolveTouchAction({ dx: -100, dy: 0, durationMs: 200 }), 'toggle');
});

test('касание: свайп влево −40 меньше порога — none', () => {
  assert.equal(resolveTouchAction({ dx: -40, dy: 0, durationMs: 200 }), 'none');
});

test('касание: свайп вправо +100 — none', () => {
  assert.equal(resolveTouchAction({ dx: 100, dy: 0, durationMs: 200 }), 'none');
});

test('касание: диагональ −100 / +150 — none', () => {
  assert.equal(resolveTouchAction({ dx: -100, dy: 150, durationMs: 200 }), 'none');
});

test('касание: long-press — menu', () => {
  assert.equal(resolveTouchAction({ dx: 0, dy: 0, durationMs: 350, longPressed: true }), 'menu');
});

test('касание: граница 0/0/0 — toggle', () => {
  assert.equal(resolveTouchAction({ dx: 0, dy: 0, durationMs: 0 }), 'toggle');
});

test('касание: аргументы по умолчанию — пустой вызов даёт toggle', () => {
  assert.equal(resolveTouchAction(), 'toggle');
});

test('мышь: правая кнопка (button 2) — none', () => {
  assert.equal(resolveMouseAction({ button: 2, moved: false, durationMs: 100 }), 'none');
});

test('мышь: средняя кнопка (button 1) — none', () => {
  assert.equal(resolveMouseAction({ button: 1, moved: false, durationMs: 100 }), 'none');
});

test('мышь: ЛКМ без движения 100 мс — toggle', () => {
  assert.equal(resolveMouseAction({ button: 0, moved: false, durationMs: 100 }), 'toggle');
});

test('мышь: ЛКМ с перетаскиванием — none', () => {
  assert.equal(resolveMouseAction({ button: 0, moved: true, durationMs: 100 }), 'none');
});

test('мышь: long-press — menu', () => {
  assert.equal(resolveMouseAction({ button: 0, moved: false, durationMs: 350, longPressed: true }), 'menu');
});

test('мышь: ЛКМ 500 мс без движения — none', () => {
  assert.equal(resolveMouseAction({ button: 0, moved: false, durationMs: 500 }), 'none');
});

test('касание: граница свайпа −60 — toggle, −59 — none', () => {
  assert.equal(resolveTouchAction({ dx: -GESTURE.SWIPE_MIN, dy: 0, durationMs: 200 }), 'toggle');
  assert.equal(resolveTouchAction({ dx: -(GESTURE.SWIPE_MIN - 1), dy: 0, durationMs: 200 }), 'none');
});

test('касание: граница тапа 299 — toggle, 300 — none', () => {
  assert.equal(resolveTouchAction({ dx: 0, dy: 0, durationMs: GESTURE.TAP_MAX_MS - 1 }), 'toggle');
  assert.equal(resolveTouchAction({ dx: 0, dy: 0, durationMs: GESTURE.TAP_MAX_MS }), 'none');
});

test('касание: равная диагональ −100/−100 — none', () => {
  assert.equal(resolveTouchAction({ dx: -100, dy: -100, durationMs: 200 }), 'none');
});

test('касание: сдвиг ровно на порог движения 8 — ещё тап', () => {
  assert.equal(resolveTouchAction({ dx: GESTURE.MOVE_THRESHOLD, dy: 0, durationMs: 100 }), 'toggle');
});

test('инвариант: порог свайпа больше порога движения', () => {
  assert.ok(GESTURE.SWIPE_MIN > GESTURE.MOVE_THRESHOLD);
});

test('меню: помещается снизу от точки отпускания', () => {
  const { left, top } = placeMenu({ x: 100, y: 100, vw: 400, vh: 800, menuW: 200, menuH: 300 });
  assert.equal(left, 100);
  assert.equal(top, 110);
});

test('меню: у нижней кромки раскрывается вверх и не выходит за низ', () => {
  const { top } = placeMenu({ x: 100, y: 780, vw: 400, vh: 800, menuW: 200, menuH: 300 });
  assert.equal(top, 470);
  assert.ok(top + 300 <= 800);
  assert.ok(top >= 8);
});

test('меню: клампится по левому и правому краю', () => {
  assert.equal(placeMenu({ x: -50, y: 100, vw: 400, vh: 800, menuW: 200, menuH: 300 }).left, 8);
  assert.equal(placeMenu({ x: 390, y: 100, vw: 400, vh: 800, menuW: 200, menuH: 300 }).left, 192);
});

test('меню: клампится сверху при крошечном viewport', () => {
  const { top } = placeMenu({ x: 100, y: 50, vw: 400, vh: 100, menuW: 200, menuH: 300 });
  assert.equal(top, 8);
});

test('меню: значения по умолчанию gap=10 и edge=8', () => {
  const { left, top } = placeMenu({ x: 0, y: 100, vw: 400, vh: 800, menuW: 200, menuH: 300 });
  assert.equal(left, 8);
  assert.equal(top, 110);
  assert.equal(placeMenu({ x: 100, y: 795, vw: 400, vh: 800, menuW: 200, menuH: 300 }).top, 795 - 10 - 300);
});

test('sheetSwipe: −40 → next, +40 → prev, −39 → none', () => {
  assert.equal(resolveSheetSwipe({ dx: -40, dy: 0 }), 'next');
  assert.equal(resolveSheetSwipe({ dx: 40, dy: 0 }), 'prev');
  assert.equal(resolveSheetSwipe({ dx: -39, dy: 0 }), 'none');
});

test('sheetSwipe: diagonal equal → none', () => {
  assert.equal(resolveSheetSwipe({ dx: -40, dy: -40 }), 'none');
  assert.equal(resolveSheetSwipe({ dx: 40, dy: 40 }), 'none');
});

test('sheetSwipe: vertical → none', () => {
  assert.equal(resolveSheetSwipe({ dx: 0, dy: -60 }), 'none');
  assert.equal(resolveSheetSwipe({ dx: 0, dy: 60 }), 'none');
});

test('sheetSwipe: defaults → none', () => {
  assert.equal(resolveSheetSwipe(), 'none');
});

test('sheetSwipe: invariant SWIPE_MIN > MOVE_THRESHOLD', () => {
  assert.ok(GESTURE.SHEET_SWIPE_MIN > GESTURE.MOVE_THRESHOLD);
});
