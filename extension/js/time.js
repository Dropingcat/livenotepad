export const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(ts) {
  const d = new Date(ts);
  d.setHours(23, 59, 0, 0);
  return d.getTime();
}

export function endOfDayBoundary(ts) {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function addDays(ts, n) {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function nextWeekday(ts, targetDow) {
  const d = new Date(ts);
  let diff = targetDow - d.getDay();
  if (diff < 0) diff += 7;
  d.setDate(d.getDate() + diff);
  return startOfDay(d.getTime());
}

export function atTime(ts, hours, minutes = 0) {
  const d = new Date(ts);
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

// 00:00:01 следующего дня — секунда запаса, чтобы «полночь» уже наступила.
export function nextMidnight(ts) {
  const d = new Date(ts);
  d.setHours(24, 0, 1, 0);
  return d.getTime();
}
