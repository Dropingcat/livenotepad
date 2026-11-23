# Изменения

## 2026-11-23 — M0/M1/M2

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
- **M6-PWA-001** — manifest/service worker/иконки, установка на Android — в работе.

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
