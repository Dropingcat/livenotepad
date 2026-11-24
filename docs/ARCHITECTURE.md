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
```

## 2. Хранилища IndexedDB

| Store | Ключ | Назначение |
|---|---|---|
| `notes` | `id` | заметки |
| `word_evidence` | `['stem','branch']` | счётчики обучения по слову и ветке |
| `word_meta` | `stem` | состояние слова: CANDIDATE/PROVISIONAL/CONFIRMED, `userCurated` |
| `training_log` | `id` autoIncrement | журнал действий и аудита (append-only) |
| `backup` | `id` autoIncrement | резервные копии (появится в 002d) |

Версии: DB v1 сейчас, v2 — в 002d (`backup`). Формат экспорта: v4 (002b). `note.schemaVersion` остаётся 3.

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

- `npm test` — `node --test`, чистые модули; сейчас 242 теста (в т.ч. 25 на `gestures`).
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

## 8. Ограничения

- Один пользователь, один браузер, локальные данные; синхронизации нет.
- `training_log` не переживает «Сброс»; отдельный append-only store — 002d.
- `mergeAll` переписывает все строки (O(n), узкое окно lost update) — TD-DEV-5.
- Fake-транзакция не доказывает реальный rollback IndexedDB — TD-DEV-7.
- `renderLogs` без typeof-гардов на числовые поля — TD-DEV-4.
- LAN HTTP (`192.168.1.100:8080`) — не secure context: нет `crypto.subtle`/`randomUUID`; нужен JS-fallback SHA-256 (002b) или HTTPS (Pages/M6).
- Старые сборки до AUD-002a на файле формата 4 стирают базу (F-1); откат — только снапшот/бэкап.
