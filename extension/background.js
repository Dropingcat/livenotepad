// Background script: check overdue notes every 5 minutes.
// Firefox extension — uses IndexedDB directly (same DB as sidebar).
// Polyfill: Firefox `browser`, Chrome `chrome` — use `self.chrome || self.browser`.
const api = typeof browser !== 'undefined' ? browser : chrome;

api.alarms.create('check-overdue', { periodInMinutes: 5 });

api.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== 'check-overdue') return;
  try {
    const overdue = await getOverdueNotes();
    if (overdue.length === 0) return;
    api.notifications.create('livenotepad-overdue', {
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'Живой блокнот',
      message: `Просрочено: ${overdue.map(n => n.text.slice(0, 30)).join(', ')}`
    });
  } catch (err) {
    console.error('[livenotepad] background error:', err);
  }
});

api.notifications.onClicked.addListener(() => {
  // При клике на уведомление — открываем боковую панель (Firefox).
  // sidebarAction API доступен только с user gesture, поэтому просто лог.
  console.log('[livenotepad] notification clicked');
});

// ── Shared DB helper ────────────────────────────────────────────────────────
async function getOverdueNotes() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('livenotepad', 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('notes', 'readonly');
      const rq = tx.objectStore('notes').getAll();
      rq.onsuccess = () => {
        const now = Date.now();
        const overdue = rq.result.filter(n =>
          !n.deletedAt && n.completedAt == null && n.dueAt && n.dueAt <= now
        );
        resolve(overdue);
      };
      rq.onerror = () => reject(rq.error);
    };
  });
}