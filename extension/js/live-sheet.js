import { startOfDay } from './time.js';

export function filterLiveSheet(notes, now = Date.now()) {
  const start = startOfDay(now);
  return notes.filter(n => !n.deletedAt && (n.completedAt == null || n.completedAt >= start));
}

// Корзина дня: удалённое сегодня видно серым до полуночи.
export function filterDeletedToday(notes, now = Date.now()) {
  const start = startOfDay(now);
  return notes.filter(n => n.deletedAt != null && n.deletedAt >= start);
}
