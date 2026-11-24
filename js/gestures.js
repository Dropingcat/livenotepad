// Жесты: чистые решатели намерения.
// Модуль не трогает DOM, не читает время и не имеет побочных эффектов:
// координаты, длительность и факт long-press передаются аргументами.
// Свайп влево — только «выполнено/снять», удаление живёт в меню.

export const GESTURE = Object.freeze({
  TAP_MAX_MS: 300,
  MOVE_THRESHOLD: 8,
  SWIPE_MIN: 60,
  SWIPE_MAX: 150
});

/**
 * Намерение по завершении касания.
 * 'menu' — меню уже открыто long-press'ом, дополнительных действий не требуется.
 * @param {{dx?: number, dy?: number, durationMs?: number, longPressed?: boolean}} [input]
 * @returns {'menu'|'toggle'|'none'}
 */
export function resolveTouchAction({ dx = 0, dy = 0, durationMs = 0, longPressed = false } = {}) {
  if (longPressed) return 'menu';
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax > GESTURE.MOVE_THRESHOLD || ay > GESTURE.MOVE_THRESHOLD) {
    // только горизонталь влево и заметно левее вертикали
    if (dx <= -GESTURE.SWIPE_MIN && ax > ay) return 'toggle';
    return 'none';
  }
  return durationMs < GESTURE.TAP_MAX_MS ? 'toggle' : 'none';
}

/**
 * Намерение по завершении мышиного жеста.
 * Нулевая кнопка — левая; любая другая (правая, средняя) действий не даёт.
 * @param {{button?: number, moved?: boolean, durationMs?: number, longPressed?: boolean}} [input]
 * @returns {'menu'|'toggle'|'none'}
 */
export function resolveMouseAction({ button = 0, moved = false, durationMs = 0, longPressed = false } = {}) {
  if (button !== 0) return 'none';
  if (longPressed) return 'menu';
  if (moved) return 'none';
  return durationMs < GESTURE.TAP_MAX_MS ? 'toggle' : 'none';
}

/**
 * Позиция контекстного меню относительно точки открытия.
 * Меню не должно накрывать точку отпускания: если снизу не помещается —
 * раскрывается вверх. По краям клампится к отступу edge.
 * @param {{x: number, y: number, vw: number, vh: number, menuW: number, menuH: number, gap?: number, edge?: number}} input
 * @returns {{left: number, top: number}}
 */
export function placeMenu({ x, y, vw, vh, menuW, menuH, gap = 10, edge = 8 }) {
  const left = Math.max(edge, Math.min(x, vw - menuW - edge));
  let top = y + gap;
  if (top + menuH > vh - edge) top = y - menuH - gap;   // раскрыть вверх
  top = Math.max(edge, Math.min(top, vh - menuH - edge));
  return { left, top };
}
