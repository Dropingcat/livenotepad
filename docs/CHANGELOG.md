# Изменения

## 2026-11-25 — Extension (Firefox sidebar)

- `extension/manifest.json` — Firefox Manifest V2, `sidebar_action`, уведомления о просрочке.
- `extension/sidebar.html` — компактный ввод + список + корзина + плавающий лог.
- `extension/sidebar.js` — уменьшенная копия ядра (`addNote`, `toggleNote`, `deleteNote`, корзина).
- `extension/background.js` — `alarms` каждые 5 минут → `notifications.create` при просрочке.
- `extension/build.cjs` — копирует `www/js/*.js` → `extension/js/` (общие модули).
- Иконки 48/96/128, тесты (+6), `npm test` 248/248.
- Ветка `extension` залита в `Dropingcat/livenotepad`: `git checkout extension`.

## 2026-11-23-25 — M2-UX-001

### M0 — фундамент
- `www/index.html` из `блокнот_0_7.html`.
- Модули: constants, time, stopwords, distance, stemmer, classifier, due-parser, due-state, live-sheet.
- Тесты: 94/94.
- Приложение открывается через `npm run dev`.

### M1 — ядро листа
- Живой лист, тикер 60 сек, полночь (`nextMidnight`), resume (`visibilitychange`/`pageshow`/`focus`).
- Подпись срока, «Просрочено (N)», спящие ветки (14 дней), формы полосок, тёмная палитра.

### M2 — взаимодействие
- **AUD-001** — вкладки монитора: `setTab` вместо записи в свойство; APPROVE ревьюера и аудитора, браузерная проверка.
- **AUD-002a** — безопасный импорт:
  - `validateImport` (структура, типы, `createdAt`, `branchConfidence`, дубли, `logs`-алиас);
  - `planImport` (upsert заметок, max-слияние обучения, пересчёт meta, `userCurated` ИЛИ, дедуп логов);
  - `DB.mergeAll` — одна транзакция, `applyMergePlan` + `promTx` в `www/js/idb.js`, `tx.abort()` при синхронном сбое;
  - 171/171 тестов, браузерный гейт 10/10, `appHash`.
- **AUDIT-001** — аудит действий и ошибок + выгрузка: **закрыт**.
  - `APP_START`, действия, `ERROR` (window/promise/DB/render/import/export), `EXPORT_AUDIT`.
  - «Скачать аудит»/«Копировать», fallback-очередь, `pending`/`lost`, `counts.errors/failed`.
  - 203/203 тестов, браузерный гейт 10/10, `appHash fd4df2d9…`.
  - TD-DEV-9…13 — остаточные окна/покрытие; фильтры новых типов — 002c.
- **AUD-002a-fix2** — целостный `DB.getSnapshot()` для импорта (F-2): **закрыт**, APPROVE ревьюера и аудитора, 210/210 тестов, гейт 10/10 (битый импорт данные не меняет, `IMPORT result:error` пишется).
- **AUD-002b** — экспорт формат 4 (следующая).
- **AUD-002c** — журнал/фильтры монитора.
- **AUD-002d** — резервные копии, «заменить всё», сброс, восстановление.
- **AUD-003** — потеря ввода при Enter.
- **AUD-006** — CSS корзины/правки.
- **VERIFY-007** — браузерная проверка M2 с артефактами.
- **M6-PWA-001** — manifest/service worker/иконки, установка на Android, офлайн: **закрыт**.
  - Manifest `id/start_url/scope "./"`, standalone, иконки 192/512/maskable; SW network-first, offline fallback, `skipWaiting`/`claim`.
  - 217/217 тестов, `node --check`, PWA-гейт 6/6 на `localhost` и на Pages.
  - MIME Pages: `manifest.webmanifest` → `application/manifest+json`, `sw.js` → `application/javascript`.
  - TD-DEV-15/16 закрыты; TD-DEV-17 (точность отчёта) — OPEN, не блокирует.

### Документация
- **`docs/GETTING_STARTED.md`** — подробное руководство: что за приложение, открытие на компьютере, что значит «Установить приложение», отличия от вкладки, **жесты (выполнено/удаление/меню)**, проверка офлайна, сохранение аудита, где хранятся данные, разбор типовых проблем.
- README: раздел «Телефон» с шагами установки, актуальные 242 теста, ссылки на все доки.
- `docs/PWA.md` §2: пошаговая установка, таблица «вкладка ↔ приложение», признаки installability, troubleshooting.

### M2-UX-001 — жесты, мышь, корзина
- Свайп влево = **выполнено/снять**, удаление свайпом убрано.
- Удаление — только пункт **«Удалить»** в меню (long-press 300 мс): Листик + undo 3.5 с, события `UI{menuDelete}` + `DELETE`/`UNDO_DELETE`.
- Мышь: ЛКМ = выполнено, ПКМ = только меню, протяжка мышью ничего не делает (`e.button`/`e.buttons` проверяются).
- **Compatibility mouse events** после `touchend` подавлены: `touchend` с `{passive:false}` + `preventDefault()`, guard `sourceCapabilities.firesTouchEvents`/`lastTouchTs<700` во всех мышиных обработчиках, `user-select:none` на `.note`.
- Корзина — отдельный **свёрнутый** блок «Корзина · N» внизу листа; раскрытие не сбрасывает прокрутку; текст контрастный (4.83:1 / 7.36:1).
- Меню: `placeMenu` (раскрытие вверх, кламп по фактической высоте, `max-height` + прокрутка); клик-хвост после открытия/отпускания гасится окном 150 мс, осознанный тап по пункту работает.
- Новый `www/js/gestures.js` (`resolveTouchAction`/`resolveMouseAction`/`placeMenu`) + 25 тестов; `npm test` 242/242.
- Гейты: DOM **27/27**, real-touch **7/7** (`Input.dispatchTouchEvent`, mobile 390×844), `appHash 8268dc14…`, `consoleErrors: []`.
- Побочно: `gestures.js` в `ASSETS`, SW кэш `v2`, `toggleNote` пишет `reopenedAt`, `render()` без раннего `return`, `restoreNote`/`undoDelete` без ложного `UNDO_DELETE`.
- TD-DEV-18…21 — остаточные UX/гейт-вопросы (просроченные без меню, семантика окна меню, геометрия шага, мультитач вне заметки); не блокируют.

### Git / Pages
- Публичный репозиторий: `https://github.com/Dropingcat/livenotepad`.
- Live: `https://dropingcat.github.io/livenotepad/` (ветка `gh-pages`, содержимое `www/`).

### Техдолги
- `TD-DEV-1…8` — см. `docs/PROBLEMS_REGISTER.md`.

### Ресерч AUD-002a (Q1–Q9)
- `crypto.subtle` есть на localhost/Pages HTTPS и в Node; на LAN HTTP — нет; нужен JS fallback.
- Канонизация JSON зафиксирована; хэш только `data` + инварианты `counts/mode/sections`.
- Версии: `schemaVersion=4`, принимать 3/4, `formatVersion` отдельно.
- Старая сборка на формате 4 стирает базу (F-1) — релиз-нота, откат только снапшотом.
- Импорт читает baseline 4 транзакциями (F-2) — карта `AUD-002a-fix2` с `DB.getSnapshot()`.
- LAN HTTP без `subtle/randomUUID` (F-3) — fallback в приложении/аудите, checksum — в 002b.

## 2026-11-23 — процесс
- Гибридная фабрика: `docs/superpowers/specs/2026-11-23-factory-hybrid-design.md`.
- План M2: `docs/superpowers/plans/2026-11-23-m2-plan.md`.
- Дизайн импорта/экспорта: `docs/superpowers/specs/2026-11-23-import-export-design.md`.
- Дизайн аудита: `docs/superpowers/specs/2026-11-23-audit-design.md`.
- Git: публичный `Dropingcat/livenotepad`, GitHub Pages из `www/` (после AUDIT-001).
