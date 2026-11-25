export const DUPLICATE_ADD_WINDOW_MS = 2000;

export function isDuplicateAdd(last, text, now = Date.now(), windowMs = DUPLICATE_ADD_WINDOW_MS) {
  if (!last) return false;
  return last.text === text.trim() && now - last.ts < windowMs;
}
