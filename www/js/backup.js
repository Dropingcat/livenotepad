// Определение бэкапов для удаления при превышении лимита.
// Чистая функция — без DOM и IndexedDB.

/**
 * Выбирает бэкапы для удаления, оставляя максимум maxCount штук.
 * Возвращает массив id бэкапов для удаления.
 *
 * @param {Array} backups — массив бэкапов с полем `exportedAt` (число, timestamp ms).
 * @param {number} [maxCount=3] — сколько бэкапов оставить.
 * @returns {Array} — массив id для удаления (последние).
 */
export function selectBackupsToKeep(backups, maxCount = 3) {
  if (!Array.isArray(backups)) return [];
  const limit = Number.isFinite(maxCount) && maxCount >= 0 ? Math.floor(maxCount) : (typeof maxCount === 'number' ? 0 : 3);
  if (backups.length <= limit) return [];
  const sorted = [...backups]
    .filter(b => b && typeof b.exportedAt === 'number')
    .sort((a, b) => b.exportedAt - a.exportedAt);
  return sorted.slice(limit).map(b => b.id);
}