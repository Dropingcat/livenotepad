// Chrome Manifest V3 background service worker.
// Polyfill: Chrome uses `chrome.*`, Firefox uses `browser.*`.
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
  console.log('[livenotepad] notification clicked');
});

async function getOverdueNotes() {
  const dbs = await new Promise((resolve, reject) => {
    const r = indexedDB.open('livenotepad');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const all = await new Promise((resolve, reject) => {
    const tx = dbs.transaction('notes', 'readonly');
    const rq = tx.objectStore('notes').getAll();
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
  const now = Date.now();
  return all.filter(n => !n.deletedAt && n.completedAt == null && n.dueAt && n.dueAt <= now);
}