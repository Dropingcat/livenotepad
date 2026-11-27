# Дизайн: M3-001 — noteIds + decay для обучения «Живого блокнота»

Дата: 2026-11-26. Статус: к исполнению (карта `M3-001`). Код не писался.
Основание: пункты M3 из `PROGRESS.md` — distinctNotes через noteIds, реализация decay, персистентный учёт заметок-доноров.

---

## 1. Проблема

### 1.1. `distinctNotes` — простой инкремент

Сейчас `WordLearningService.onCorrection` увеличивает `distinctNotes` на 1 при каждой коррекции (строка 536 `index.html`):

```js
existing
  ? { ...existing, evidence: existing.evidence + 1, distinctNotes: existing.distinctNotes + 1, lastSeenAt: now }
  : { stem, branch: toBranch, evidence: 1, distinctNotes: 1, lastSeenAt: now };
```

**Проблема:** если одна и та же заметка корректируется дважды в одну ветку, `distinctNotes` растёт, хотя заметка та же. Это завышает счётчик и может преждевременно перевести слово в CONFIRMED.

### 1.2. Decay не реализован

В `constants.js` определены `DECAY_DAYS: 30` и `DECAY_AMOUNT: 1`, но ни одна функция их не использует. Со временем устаревшие свидетельства (например, слово «код» случайно привязалось к ветке «быт» через единичную коррекцию) не ослабевают, и обучение «застывает».

---

## 2. Решение

### 2.1. `noteIds` — массив строк в `word_evidence`

Добавить поле `noteIds` в каждую запись `word_evidence` — массив уникальных строковых идентификаторов заметок, которые дали evidence для данного (stem, branch).

**Формат записи:**
```json
{
  "stem": "код",
  "branch": "rabota",
  "evidence": 2,
  "distinctNotes": 2,
  "noteIds": ["id-abc", "id-def"],
  "lastSeenAt": 1764000000000
}
```

**Изменения:**
- `onCorrection` — вместо `distinctNotes + 1` проверять `noteIds.includes(noteId)`:
  - Если `noteId` уже есть: `evidence++`, `distinctNotes` не меняется.
  - Если `noteId` новый: `evidence++`, `distinctNotes++`, `push(noteId)`.
- `recomputeMeta` — `distinctNotes` берётся из `best.distinctNotes` (остаётся без изменений, т.к. уже из хранимого поля).
- `planImport` — при слиянии `noteIds` объединяются массивы с дедупликацией; `distinctNotes` = длина объединённого массива.
- `buildExport` / `validateExport` — `noteIds` не требует миграции схемы (формат 4, расширяемое поле), при отсутствии считается пустым массивом.
- `computeMetaFromEvidence` — учитывает `noteIds` при расчёте `distinctNotes`.

### 2.2. Функция decay

Чистая функция, уменьшающая `evidence` на основе разницы между `now` и `lastSeenAt`:

```js
export function applyDecay(row, now, decayDays = TUNING.DECAY_DAYS, decayAmount = TUNING.DECAY_AMOUNT) {
  if (!row || row.evidence <= 0) return row;
  const elapsed = now - (row.lastSeenAt || now);
  if (elapsed <= 0) return row;
  const periods = Math.floor(elapsed / (decayDays * 86400000));
  if (periods <= 0) return row;
  const newEvidence = Math.max(0, row.evidence - periods * decayAmount);
  if (newEvidence === row.evidence) return row;
  return { ...row, evidence: newEvidence };
}
```

- `applyDecay` — детерминированная, без сайд-эффектов.
- Если `evidence` достигает 0, запись не удаляется автоматически (сохраняется для истории), но `recomputeMeta` её игнорирует (фильтр `e.evidence > 0` уже есть).

### 2.3. Decay pass на загрузке

При каждом `loadNotes()` (и при `APP_START`) запускать `decayAllEvidence()`:

```js
async function decayAllEvidence() {
  const all = await DB.getAllEvidence();
  const now = Date.now();
  for (const row of all) {
    const decayed = applyDecay(row, now);
    if (decayed !== row) {
      await DB.putEvidence(decayed);
      await WordLearningService.recomputeMeta(row.stem);
    }
  }
}
```

- Вызов на `loadNotes` гарантирует, что decay срабатывает при каждом открытии/фокусе/полуночи (все пути идут через `loadNotes`).
- Для производительности: пересчитывать `recomputeMeta` только для тех stem, у которых изменилось evidence.

### 2.4. Схема миграции БД

Версия базы данных не меняется (остаётся `2`). Поле `noteIds` опционально:
- существующие записи без `noteIds` → при следующей коррекции `noteIds` устанавливается в `[noteId]`.
- `computeMetaFromEvidence` при отсутствии `noteIds` читает `distinctNotes` как есть (обратная совместимость).

---

## 3. Файлы

| Файл | Изменения |
|------|-----------|
| `www/js/constants.js` | (без изменений, DECAY_DAYS/DECAY_AMOUNT уже есть) |
| `www/index.html` | — `WordLearningService.onCorrection`: добавить проверку `noteIds`, хранить массив<br>— `WordLearningService.recomputeMeta`: исправить подсчёт `distinctNotes` из noteIds<br>— Добавить `applyDecay` (или импорт из модуля)<br>— Добавить `decayAllEvidence`, вызвать в `loadNotes`<br>— Корректировка передачи `noteId` в `onCorrection` |
| `www/js/import.js` | — `mergeEvidenceRows`: при слиянии объединять `noteIds` с дедупликацией<br>— `computeMetaFromEvidence`: учитывать `noteIds` для `distinctNotes` |
| `www/js/export-format.js` | — `buildExport`: `noteIds` в data.word_evidence (автоматически, т.к. поле в объекте)<br>— `validateExport`: не требует валидации noteIds |
| `test/learning.test.js` | Новый файл: тесты для `applyDecay`, `onCorrection` с noteIds, `decayAllEvidence` |
| `test/import.test.js` | Добавить тесты слияния evidence с noteIds |
| `test/export-format.test.js` | Добавить тест экспорта/импорта с noteIds |

---

## 4. DoD (Definition of Done)

1. **noteIds в onCorrection:** повторная коррекция той же заметки в ту же ветку не увеличивает `distinctNotes`, но увеличивает `evidence`.
2. **noteIds в import:** при слиянии evidence из разных источников массивы `noteIds` объединяются, `distinctNotes` = длина уникального объединения.
3. **applyDecay:** чистая функция: при `elapsed < DECAY_DAYS` не меняет evidence; при `elapsed >= DECAY_DAYS` уменьшает на `DECAY_AMOUNT` за каждый полный период; не уходит ниже 0.
4. **decayAllEvidence:** вызывается в `loadNotes`, корректно пересчитывает meta для затронутых stem.
5. **Обратная совместимость:** существующие записи без `noteIds` продолжают работать; `distinctNotes` читается как раньше при отсутствии `noteIds`.
6. **Тесты:** `npm test` зелёный; новый `test/learning.test.js` покрывает `applyDecay`, noteIds в `onCorrection`.
7. **Браузерный гейт:** консоль без ошибок; коррекция ветки → evidence растёт; та же заметка → distinctNotes не растёт; монитор «Обучение» показывает корректные счётчики.

---

## 5. Порядок

1. Написать чистую функцию `applyDecay` — тесты.
2. Расширить `onCorrection` — `noteIds` (массив, проверка включения).
3. Адаптировать `computeMetaFromEvidence` и `planImport`.
4. Добавить `decayAllEvidence` → вызов в `loadNotes`.
5. Адаптировать рендер монитора (вкладка «Обучение») для отображения noteIds.
6. Тесты, прогон, браузерная проверка.

---

## 6. Зависимости

- **M3-001** не зависит от M3-002/M3-003.
- **M3-001** блокирует M3-002 (JSONL экспорт должен использовать noteIds для точного `distinctNotes`).
- Импорт/экспорт (текущий `export-format.js`) не меняет схему, только расширяет данные — никаких ломающих изменений.