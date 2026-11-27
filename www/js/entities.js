import { STOP_WORDS } from './stopwords.js';
import { TUNING } from './constants.js';

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

/**
 * Вычисление IDF-взвешенного веса ребра между двумя сущностями.
 * weight = cooccurrence * (log(N/freqA) + log(N/freqB))
 *        + sameBranch * GRAPH_SAME_BRANCH_WEIGHT
 *        + temporalDistance * GRAPH_TEMPORAL_WEIGHT
 * Если weight < GRAPH_EDGE_THRESHOLD, обнуляем.
 * Чистая функция.
 * @param {number} cooccurrence — количество совместных встреч сущностей
 * @param {Object<string, number>} entityFrequencies — мапа {сущность: частота} (по всем заметкам)
 * @param {string} a — первая сущность
 * @param {string} b — вторая сущность
 * @param {number} [sameBranch=0] — доля попаданий в одну ветку (0…1)
 * @param {number} [temporalDistance=0] — обратная временна́я дистанция (макс 1)
 * @param {number} [N] — общее количество заметок (по умолчанию max из частот)
 * @returns {number}
 */
export function computeEdgeWeight(cooccurrence, entityFrequencies, a, b, sameBranch = 0, temporalDistance = 0, N) {
  const freqA = entityFrequencies[a] || 0;
  const freqB = entityFrequencies[b] || 0;
  if (freqA === 0 || freqB === 0) return 0;
  const total = N || Math.max(...Object.values(entityFrequencies));
  const idf = Math.log(total / freqA) + Math.log(total / freqB);
  const weight = cooccurrence * idf
    + sameBranch * TUNING.GRAPH_SAME_BRANCH_WEIGHT
    + temporalDistance * TUNING.GRAPH_TEMPORAL_WEIGHT;
  return weight >= TUNING.GRAPH_EDGE_THRESHOLD ? weight : 0;
}

/**
 * Кластеризация заметок на основе общих сущностей и IDF-взвешенных рёбер.
 * Для каждой пары заметок с общими сущностями вычисляем edgeWeight.
 * Если вес > порога, заметки попадают в один кластер.
 * @param {Array<{id: string, text: string, branch?: string, createdAt: number}>} notes
 * @param {Object<string, string[]>} entitiesByNoteId — мапа {noteId: [entity,…]}
 * @param {Array<{entityA: string, entityB: string, weight: number}>} cooccurrences — глобальные кокурренции (не используется напрямую, нужен для интерфейса)
 * @param {Object<string, number>} entityFrequencies — мапа {сущность: частота}
 * @returns {Map<number, string[]>} — Map<clusterId, noteId[]>
 */
export function clusterNotes(notes, entitiesByNoteId, cooccurrences, entityFrequencies) {
  if (!notes || notes.length === 0) return new Map();
  if (!entitiesByNoteId || !entityFrequencies) return new Map();

  const totalNotes = notes.length;

  // Для каждой заметки — её сущности в сете
  const noteEntitySets = new Map();
  for (const note of notes) {
    const entities = entitiesByNoteId[note.id] || [];
    noteEntitySets.set(note.id, new Set(entities));
  }

  // Вычислить рёбра между парами заметок
  const edges = []; // {i, j, weight}
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const a = notes[i];
      const b = notes[j];
      const entitiesA = noteEntitySets.get(a.id);
      const entitiesB = noteEntitySets.get(b.id);
      if (!entitiesA || !entitiesB) continue;

      // Найти общие сущности
      const sharedEntities = [...entitiesA].filter(e => entitiesB.has(e));
      if (sharedEntities.length === 0) continue;

      // IDF: сумма IDF всех общих сущностей (редкие сущности дают большой вес)
      let idfSum = 0;
      for (const ent of sharedEntities) {
        const freq = entityFrequencies[ent] || 1;
        idfSum += Math.log(totalNotes / freq);
      }

      // sameBranch: 1 если ветки совпадают, иначе 0
      const sameBranch = (a.branch && b.branch && a.branch === b.branch) ? 1 : 0;

      // Временная дистанция: обратная разница создания (макс 1)
      const timeDiff = Math.abs((a.createdAt || 0) - (b.createdAt || 0));
      const temporalDistance = timeDiff < TUNING.GRAPH_TEMPORAL_SCALE_MS
        ? 1 - timeDiff / TUNING.GRAPH_TEMPORAL_SCALE_MS
        : 0;

      const weight = idfSum
        + sameBranch * TUNING.GRAPH_SAME_BRANCH_WEIGHT
        + temporalDistance * TUNING.GRAPH_TEMPORAL_WEIGHT;

      if (weight >= TUNING.GRAPH_EDGE_THRESHOLD) {
        edges.push({ i, j, weight });
      }
    }
  }

  // Union-Find кластеризация
  const parent = Array.from({ length: notes.length }, (_, i) => i);
  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function union(x, y) {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent[ry] = rx;
  }

  for (const edge of edges) {
    union(edge.i, edge.j);
  }

  // Собрать кластеры (только > 1 заметки)
  const rootToIds = new Map();
  for (let i = 0; i < notes.length; i++) {
    const root = find(i);
    if (!rootToIds.has(root)) {
      rootToIds.set(root, []);
    }
    rootToIds.get(root).push(notes[i].id);
  }

  // Перенумеровать кластеры
  const result = new Map();
  let clusterId = 1;
  for (const ids of rootToIds.values()) {
    if (ids.length >= 2) {
      result.set(clusterId, ids);
      clusterId++;
    }
  }

  return result;
}