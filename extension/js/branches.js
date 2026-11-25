import { DAY_MS } from './time.js';
import { TUNING } from './constants.js';

export function branchLastActivity(notes) {
  const last = new Map();
  for (const n of notes) {
    if (!n.branch || n.deletedAt) continue;
    const ts = n.completedAt ?? n.createdAt ?? 0;
    if (!last.has(n.branch) || ts > last.get(n.branch)) last.set(n.branch, ts);
  }
  return last;
}

export function branchStatuses(notes, branchKeys, now = Date.now()) {
  const last = branchLastActivity(notes);
  return branchKeys.map(key => {
    const lastUsedAt = last.has(key) ? last.get(key) : null;
    return {
      key,
      lastUsedAt,
      sleeping: lastUsedAt !== null && now - lastUsedAt > TUNING.SLEEPING_BRANCH_DAYS * DAY_MS
    };
  });
}
