// Транзакции IndexedDB: промис-обёртка и применение плана слияния.
// Модуль без DOM; работает с любым IDB-подобным объектом (в тестах — fake),
// поэтому атомарность проверяется без браузера.

export function promTx(tx, req) {
  return new Promise((resolve, reject) => {
    let result;
    req.onsuccess = () => { result = req.result; };
    req.onerror = () => reject(req.error || tx.error || new Error('Request failed'));
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error('Transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

/**
 * Читает четыре store (notes/word_evidence/word_meta/training_log) одной
 * уже открытой readonly-транзакцией. Все getAll() создаются синхронно,
 * результат собирается на tx.oncomplete — поэтому снимок согласован:
 * между чтениями не может закоммититься запись (нет torn baseline).
 * Никаких await внутри транзакции; ошибка транзакции — reject с Error.
 */
export function readSnapshot(tx) {
  return new Promise((resolve, reject) => {
    const notesReq = tx.objectStore('notes').getAll();
    const evidenceReq = tx.objectStore('word_evidence').getAll();
    const metaReq = tx.objectStore('word_meta').getAll();
    const logsReq = tx.objectStore('training_log').getAll();
    tx.oncomplete = () => resolve({
      notes: notesReq.result,
      evidence: evidenceReq.result,
      meta: metaReq.result,
      logs: logsReq.result
    });
    tx.onerror = () => reject(tx.error || new Error('Snapshot transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('Snapshot transaction aborted'));
  });
}

/**
 * Синхронно раскладывает план по четырём store в уже открытой readwrite-
 * транзакции. Логи с целым id >= 0 идут через put (id сохраняется),
 * логи без id — через add (id снимается, сработает autoIncrement).
 * Возвращает запрос count по notes — последний запрос транзакции.
 * При любом синхронном исключении откатывает транзакцию и пробрасывает
 * исходную ошибку (сбой tx.abort() её не затирает).
 */
export function applyMergePlan(tx, plan) {
  try {
    for (const note of (plan.notes || [])) tx.objectStore('notes').put(note);
    for (const row of (plan.evidence || [])) tx.objectStore('word_evidence').put(row);
    for (const row of (plan.meta || [])) tx.objectStore('word_meta').put(row);
    for (const entry of (plan.logs || [])) {
      if (Number.isInteger(entry.id) && entry.id >= 0) {
        tx.objectStore('training_log').put(entry);
      } else {
        const { id, ...rest } = entry;
        tx.objectStore('training_log').add(rest);
      }
    }
    return tx.objectStore('notes').count();
  } catch (e) {
    try { tx.abort(); } catch (_) {}
    throw e;
  }
}
