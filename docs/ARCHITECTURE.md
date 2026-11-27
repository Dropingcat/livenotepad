# Архитектура

## 1. Общая схема

Приложение — статический `www/` без сборки: `index.html` + ES-модули `www/js/*`. Данные — IndexedDB `livenotepad`. Сервер нужен только для раздачи файлов (`scripts/serve.js`); на GitHub Pages `www/` раздаётся как есть.

```
www/index.html          UI, inline module, DB, Monitor, Corrections
www/js/constants.js     TUNING, BRANCHES, BRANCH_KEYS, BRANCH_SOURCES
www/js/time.js          startOfDay, nextMidnight
www/js/stemmer.js       токенизация и стемминг
www/js/stopwords.js     стоп-лист
www/js/distance.js      расстояние/похожесть
www/js/classifier.js    seed-классификатор
www/js/due-parser.js    разбор сроков
www/js/due-state.js     состояние срока, STALE/OVERDUE
www/js/live-sheet.js    живой лист, корзина дня
www/js/branches.js      статусы веток, спящие
www/js/note-edit.js     правка текста без смены ветки
www/js/gestures.js      чистые решатели жестов (тап/свайп/long-press, мышь)
www/js/dedup.js         дедуп добавления
www/js/import.js        validateImport, planImport, computeMetaFromEvidence
www/js/idb.js           promTx, applyMergePlan
www/js/audit.js         события аудита, ошибки, выгрузка
www/js/action-log.js    журнал действий
www/js/add-queue.js     очередь добавления
www/js/backup.js        резервное копирование
www/js/capacitor.js     нативная оболочка (Capacitor плагины)
www/js/entities.js      извлечение сущностей, граф, дайджест
www/js/export-format.js формат экспорта
```

## 2. Хранилища IndexedDB

| Store | Ключ | Назначение |
|---|---|---|
| `notes` | `id` | заметки |
| `word_evidence` | `['stem','branch']` | счётчики обучения по слову и ветке |
| `word_meta` | `stem` | состояние слова: CANDIDATE/PROVISIONAL/CONFIRMED, `userCurated` |
| `training_log` | `id` autoIncrement | журнал действий и аудита (append-only) |
| `note_entities` | `id` autoIncrement | извлечённые сущности заметок |
| `entity_cooccurrence` | `['entityA','entityB']` | совместная встречаемость сущностей |
| `backup` | `id` autoIncrement | резервные копии (появится в 002d) |

Версии: DB v1 сейчас, v2 — в 002d (`backup`), v3 — SHIP-002 (`note_entities`, `entity_cooccurrence`). Формат экспорта: v4 (002b). `note.schemaVersion` остаётся 3.

## 3. Инварианты импорта

1. Сначала `JSON.parse` + `validateImport`; при `errors` БД не трогается.
2. Частичный импорт — upsert без удаления: заметки по `id`, evidence по `['stem','branch']`, meta по `stem`; отсутствующие разделы не меняются.
3. Обучение сливается по **max** (`evidence`, `distinctNotes`, `lastSeenAt`); `state` пересчитывается `recomputeMeta`, `userCurated` — логическое ИЛИ. Точное union по `noteCounts`/`corrections` — M3.
4. Запись — одна `readwrite`-транзакция на 4 store, синхронные циклы без `await`, `tx.abort()` при синхронном исключении, `promTx` реджектит не-null `Error`. Тесты: `test/idb.test.js` (fake-транзакция), эмпирика Chrome S2/S3.
5. `logs` — legacy-алиас `training_log`; при обоих `training_log` выигрывает, `logs` отбрасывается с warning.
6. «Заменить всё» и сброс появятся только вместе с резервной копией (002d).
7. Экспорт и импорт читают состояние через `DB.getSnapshot()` — одна readonly-транзакция на 4 store; иначе возможен torn baseline (F-2).

## 4. Аудит

Событие:
`eventId, ts, sessionId, deviceId, type, source, result, appVersion, context, message, stack, details` + legacy-поля
(`noteId`, `branch`, `text`, `from`, `to`, `mode`, `counts`), которые читает монитор.

Типы: `APP_START`, `APP_RESUME`, `APP_HIDDEN`, `MIDNIGHT`, `CREATE`, `COMPLETE`, `REOPEN`, `EDIT`, `DELETE`,
`RESTORE`, `UNDO_DELETE`, `BRANCH_CHANGE`, `IMPORT`, `EXPORT`, `EXPORT_AUDIT`, `ERROR`, `UI`, позже
`RESET`, `BACKUP`, `RESTORE_BACKUP`.

Источники ошибок: `window.onerror`, `unhandledrejection`, явные `Audit.error(context, err)` в catch
(DB, render, import, export, corrections, startup). `Audit.log` не блокирует UI; при сбое БД — fallback-очередь
в `localStorage` и flush при `APP_START`.

Выгрузка: `format: livenotepad-audit`, `version: 1`, meta + `events[]`, сортировка по `ts`, counts events/errors/failed, `pending`/`lost`. Pending-события fallback подмешиваются с дедупликацией по `eventId`; сбой чтения БД не маскируется пустым файлом. «Скачать аудит» на телефоне: URL файла отзывается через 1 с после клика.

## 5. Жесты и ввод

`www/js/gestures.js` — чистые решатели без DOM и времени: `GESTURE` (`TAP_MAX_MS: 300`, `MOVE_THRESHOLD: 8`, `SWIPE_MIN: 60`, `SWIPE_MAX: 150`), `resolveTouchAction({ dx, dy, durationMs, longPressed })` и `resolveMouseAction({ button, moved, durationMs, longPressed })` → `'menu' | 'toggle' | 'none'`. Координаты, длительность и факт long-press передаются аргументами.

| Ввод | Действие |
|---|---|
| Касание, тап < 300 мс | выполнено/снять (`toggleNote`) |
| Свайп влево ≥ 60 px и левее вертикали | выполнено/снять; зелёная подсказка «выполнено»/«снять» |
| Свайп вправо, вертикальный скролл, диагональ, мультитач | ничего |
| Long-press 300 мс (касание, ЛКМ или ПКМ) | меню ветки |
| ЛКМ тап | выполнено/снять |
| ПКМ и средняя кнопка | только меню (`contextmenu`, `preventDefault`); `completedAt` не меняется |
| Перетаскивание мышью | ничего (свайп мышью отключён) |

**Compatibility mouse events.** После `touchend` браузер шлёт `mousedown → mouseup → click`; без защиты тап даёт двойной `toggle`, а long-press закрывает меню. Защита трёхуровневая: `touchend` слушается с `{ passive: false }` и вызывает `preventDefault()`; в `mousedown`/`mousemove`/`mouseup`/`contextmenu` первым стоит guard `e.sourceCapabilities.firesTouchEvents || Date.now() - lastTouchTs < 700`; на `.note` стоит `user-select: none`.

**Меню.** Позиционируется через чистую `placeMenu` (раскрытие вверх, если снизу не помещается; кламп по фактической высоте `getBoundingClientRect`), `max-height: calc(100vh - 16px)` + прокрутка. Клик, который браузер шлёт сразу после открытия (или после отпускания long-press), гасится окном `suppressMenuClickUntil` (150 мс), продлеваемым на `mouseup`; осознанный тап по пункту после этого окна работает.

Удаление возможно только пунктом «Удалить» в меню ветки: Листик + undo 3.5 с, события `DELETE`/`UNDO_DELETE` в аудите. Ни один путь touch/mouse не вызывает `deleteNote`. `restoreNote` прячет Листика и чистит `pendingDelete`, поэтому повторный `undoDelete` не пишет ложный `UNDO_DELETE`.

Корзина дня — свёрнутый блок `.trash-block` внизу листа; состояние в `state.trashExpanded` (по умолчанию `false`). Голова «Корзина · N» раскрывает `.trash-body` без вызова `render()` (не сбрасывает прокрутку), «вернуть» вызывает `restoreNote`. При нуле удалённых блок не рисуется; раскрытие переживает `render()`. Текст удалённой заметки — явный контрастный цвет (`#6f6f6a` / `#a9a9a3` в тёмной теме), без `opacity` на тексте.

## 6. Тесты и гейты

- `npm test` — `node --test`, чистые модули; сейчас 362 теста (в т.ч. 25 на `gestures`).
- `node --check` модулей.
- Inline-модуль: извлечение по маркерам `<script type="module">…</script>`, не по номерам строк.
- **DOM-гейт:** headless Chrome + CDP (`C:\Temp\opencode\app-gate.mjs`), свежий профиль на прогон (герметичность), сценарий в контексте страницы, артефакт с `appHash`, `expressionHash`, `stepCount/passCount`, `consoleErrors`. Для UX-001 — 27 шагов.
- **Real-touch гейт:** `C:\Temp\opencode\touch-gate.mjs` — `Emulation.setTouchEmulationEnabled` + `Input.dispatchTouchEvent` (mobile 390×844), потому что синтетические JS-события не порождают compatibility mouse events. Для UX-001 — 7 шагов.
- Артефакты — `.runs/M2/artifacts/<CARD>/`, отчёты — `.runs/M2/reports/`.

## 7. Процесс

`worker → reviewer → (REQUEST_CHANGES → fix → re-review) → auditor → analyst → researcher → deploy`.

- Роли исполняются `general`-субагентами; фактический тип фиксируется в `.runs/M2/journal.jsonl`.
- Каждая карта: цель, файлы, сложность, DoD, проверки, зависимости, откат `.runs/M2/before/<CARD>/`, эскалация.
- Находки классифицируются по 09 (уровни 1/2/3), техдолги — `TD-DEV-*` в `docs/PROBLEMS_REGISTER.md`.
- Снапшот `.runs/M2/snapshot/` обновляется после закрытия карты; финальный — при деплое M2.

## 8. Параметры обучения

Пороги классификации веток (`www/js/constants.js` → `TUNING`):

| Параметр | Значение | Описание |
|---|---|---|
| `CONFLICT_RATIO_THRESHOLD` | 0.55 | Минимальная доля `best.evidence / total` для `effectiveBranch`. Ниже — `null` (конфликт веток) |
| `HIGH_CONFIDENCE_GUARD` | 0.7 | Seed-confidence выше этого не корректируется обучением |
| `PROVISIONAL_MIN_DISTINCT_NOTES` | 2 | Минимум уникальных заметок для статуса PROVISIONAL |
| `CONFIRMED_MIN_EVIDENCE` | 4 | Минимум evidence для CONFIRMED |
| `CONFIRMED_MIN_DISTINCT_NOTES` | 3 | Минимум уникальных заметок для CONFIRMED |
| `CONFIRMED_MIN_RATIO` | 0.7 | Доля best-ветки в общем evidence для CONFIRMED |
| `LEARNED_MIN_CONFIDENCE` | 0.5 | Порог `confidence` для `LEARNED_PROVISIONAL` в `classify()` |
| `LEARNED_CONFIRMED_CONFIDENCE` | 0.7 | Порог `confidence` для `LEARNED_CONFIRMED` в `classify()` |
| `SEED_HIGH_CONFIDENCE` | 0.6 | Seed-confidence выше этого даёт `source: 'SEED'` минуя обучение |

**Расчёт confidence в `effectiveBranch`:**
- `confidence = (state === 'CONFIRMED') ? max(CONFIRMED_MIN_RATIO, ratio) : max(LEARNED_MIN_CONFIDENCE, ratio)`
- `ratio = best.evidence / total`

**Жизненный цикл:** `CANDIDATE → PROVISIONAL (≥2 distinctNotes) → CONFIRMED (≥4 evidence, ≥3 distinctNotes, ≥0.7 ratio)`.

## 9. Ограничения

- Один пользователь, один браузер, локальные данные; синхронизации нет.
- `training_log` не переживает «Сброс»; отдельный append-only store — 002d.
- `mergeAll` переписывает все строки (O(n), узкое окно lost update) — TD-DEV-5.
- Fake-транзакция не доказывает реальный rollback IndexedDB — TD-DEV-7.
- `renderLogs` без typeof-гардов на числовые поля — TD-DEV-4.
- LAN HTTP (`192.168.1.100:8080`) — не secure context: нет `crypto.subtle`/`randomUUID`; нужен JS-fallback SHA-256 (002b) или HTTPS (Pages/M6).
- Старые сборки до AUD-002a на файле формата 4 стирают базу (F-1); откат — только снапшот/бэкап.

## 10. Контекст (M4-001)

При добавлении заметки формируется контекстный срез (`collectContext`), который сохраняется в `note.context` и передаётся в `classify()`.

**Поля `collectContext(text)`:**

| Поле | Источник | Назначение |
|---|---|---|
| `ts` | `Date.now()` | временная метка |
| `hour` | `d.getHours()` | час для time-based fallback |
| `dayOfWeek` | `d.getDay()` | день недели |
| `isWeekend` | `dow === 0 \|\| dow === 6` | выходной ли |
| `bootMs` | `performance.now()` | мс с загрузки страницы |
| `isOnline` | `navigator.onLine` | онлайн-статус |
| `wordCount` | длина `trim().split(/\\s+/)` | число слов в тексте |
| `isBoot` | `bootMs < MIN_BOOT_MS_FOR_FALLBACK` | ранняя загрузка |
| `activeBranches` | топ веток среди открытых заметок сегодня | популярные ветки |
| `recentBranches` | ветки последних 5 созданных сегодня заметок | свежие ветки |

**Boot guard:** Если `ctx.bootMs < TUNING.MIN_BOOT_MS_FOR_FALLBACK` (300 с), time-based fallback не срабатывает — сразу возвращается `source: 'NONE'`.

**Fallback-порог (M4-001):** После прохода всех классификаторов (SEED, learned) на последней стадии (`TIME_FALLBACK` / `NONE`) применяется `fallbackGuard()` из `classifier.js`:
- `wordCount >= 4` → `NONE` (не угадываем ветку для длинного текста)
- `wordCount < 4` → разрешаем `TIME_FALLBACK` (короткие / однословные задачи)

---

## 11. Граф и дайджест

`www/js/entities.js` — извлечение сущностей, построение графа совместной встречаемости и кластеризация для дайджеста.

### 11.1. Хранилища

| Store | Ключ | Назначение |
|---|---|---|
| `note_entities` | `id` autoIncrement | сущности, извлечённые из заметки: `{ noteId, entity, freq, tf, idf, weight, ts }` |
| `entity_cooccurrence` | `[entityA, entityB]` | совместная встречаемость: `{ entityA, entityB, count, lastSeen }` |

### 11.2. Функции

- `extractEntities(text, noteId)` — токенизация, фильтр стоп-слов, стемминг, IDF-взвешивание; запись в `note_entities`.
- `computeCooccurrence(noteId)` — для всех пар сущностей заметки инкрементирует `entity_cooccurrence`.
- `computeEdgeWeight(a, b)` — вес ребра = `cooc(a,b) / (sqrt(count(a)) * sqrt(count(b)))`; Jaccard-подобная нормализация.
- `clusterNotes(activeNoteIds)` — агломеративная кластеризация по порогу `SIMILARITY_THRESHOLD = 0.3`; бонусы за общую ветку (+0.15) и близость по времени (≤ 4 ч, +0.1).

### 11.3. Дайджест

- Вызывается в `render()` только при состоянии `OVERDUE` или `DUE_TODAY`.
- `DIGEST_MAX_CLUSTER_HINT = 3` — максимум подсказок на кластер.
- Формат: «Ещё N похожих: … (ветка X)».

---

## 12. Нативная оболочка (Capacitor)

### 12.1. Конфигурация

`capacitor.config.json` — корень проекта:

```json
{
  "appId": "com.dropingcat.livenotepad",
  "appName": "Живой блокнот",
  "webDir": "www",
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 1000,
      "launchAutoHide": true
    }
  },
  "server": {
    "androidScheme": "https"
  }
}
```

### 12.2. Плагины (`www/js/capacitor.js`)

- **LocalNotifications** — уведомления о просроченных сроках.
- **Share** — шеринг заметки/экспорта.
- **Haptics** — тактильный отклик при жестах.
- **SplashScreen** — заставка при запуске.
- **App** — обработка `appStateChange` (фон/активность).

Каждый плагин обёрнут в проверку `window.Capacitor?.isNativePlatform()`; на PWA/десктопе — no-op.

### 12.3. Сборка

```bash
npm run build:android
npx cap open android
cd android
.\gradlew.bat assembleDebug
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

### 12.4. Service Worker

В `www/sw.js` в ASSETS добавлены `./js/capacitor.js`.

---

## 13. Настройки и доступность

### 13.1. Вкладка настроек

6-я вкладка монитора «Настройки»: `renderSettings()`.

Содержимое:
- Переключатель тёмной темы (`data-force-dark`).
- Информация о версии приложения.
- Сброс обучения.

### 13.2. Тёмная тема

- Атрибут `data-force-dark` на `<html>` принудительно включает тёмную тему.
- По умолчанию — `prefers-color-scheme: dark` из медиа-запроса.
- `data-force-dark` имеет приоритет над медиа-запросом.

### 13.3. ARIA

- `#draft` → `aria-label="Текст заметки"`
- `#monitorBtn` → `aria-label="Открыть монитор"`
- `#monitorClose` → `aria-label="Закрыть монитор"`

### 13.4. Предпочтение движения

- `prefers-reduced-motion: reduce` отключает анимации переходов и пульсации.
- CSS-класс `.no-animation` на `<html>` при активном медиа-запросе.

---

## 14. Листы веток (M8)

`www/js/sheets.js` — модель листов веток. Лист = фильтр рендера: при 6+ активных заметках в ветке открывается отдельный лист.

### 14.1. Функции

| Функция | Назначение |
|---|---|
| `computeSheets(activeNotes)` | Разбить заметки на листы по веткам; вернуть `{ sheets }` |
| `filterBySheet(notes, sheetId)` | Вернуть заметки только указанного листа (или `__main__` для главного) |
| `resolveActiveSheet(currentSheet, sheets, event)` | По свайпу влево/вправо переключить лист |
| `shiftSheet(direction, sheets, currentSheet)` | Сдвиг на соседний лист (← / →) |

### 14.2. Порог

`SHEET_OVERFLOW_THRESHOLD: 5` — если число активных заметок ветки ≤ 5, лист для этой ветки не создаётся. Выполненные заметки не считаются. Порог только для активных.

### 14.3. Нижняя полоска

- `.sheet-bar` — 44 px, содержит точки (активная подсвечена), стрелки ←/→, заголовок текущего листа.
- Тап по точке / стрелке переключает лист.
- На главном листе полоска показывает количество листов; на листе ветки — точки навигируют между главным и листами веток.

### 14.4. Фильтрация рендера

- `render()` → `computeSheets()` → `filterBySheet()` → отрисовка только заметок активного листа.
- Блок «Просрочено» — глобальный на главном листе (все ветки); на листе ветки — только её просроченные.
- Дайджест — только на главном листе.

### 14.5. API тостов

- `notifyIfOtherSheet(note, sheets)` — если заметка добавлена в ветку, чей лист уже есть и не активен, тост «Открыть» с переходом на этот лист.
- `checkSheetDisappear(beforeSheets, afterSheets)` — если после сворачивания заметки лист исчезает, тост «Лист X свернулся».

### 14.6. Service Worker

SW v4, CACHE `livenotepad-v4`, ASSETS `./js/sheets.js`.
