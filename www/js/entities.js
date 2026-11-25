import { STOP_WORDS } from './stopwords.js';

/**
 * Извлечение сущностей (entity-токенов) из текста.
 * Нормализация: нижний регистр, удаление знаков препинания.
 * Фильтр: токены >= 4 символов, не стоп-слова.
 * Возвращает массив уникальных строк.
 * @param {string} text
 * @returns {string[]}
 */
export function extractEntities(text) {
  if (!text) return [];
  const allStopWords = new Set([
    ...STOP_WORDS.homo,
    ...STOP_WORDS.func,
    ...STOP_WORDS.verbs
  ]);
  const tokens = text.toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(w => w.length >= 4 && !allStopWords.has(w));
  return [...new Set(tokens)];
}

/**
 * Вычисление пар кокурренции из списка сущностей.
 * Для всех пар (a, b) где a < b (лексикографически),
 * возвращает [{entityA, entityB, weight: 1}].
 * Чистая функция.
 * @param {string[]} entities
 * @returns {Array<{entityA: string, entityB: string, weight: number}>}
 */
export function computeCooccurrence(entities) {
  if (!entities || entities.length < 2) return [];
  const sorted = [...entities].sort();
  const pairs = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      pairs.push({ entityA: sorted[i], entityB: sorted[j], weight: 1 });
    }
  }
  return pairs;
}