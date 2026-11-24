# Живой блокнот — прогресс

## M0 — фундамент ✅

- [x] `www/index.html` создан из `блокнот_0_7.html`
- [x] Модули `www/js/*`: constants, time, stopwords, distance, stemmer, classifier, due-parser, due-state, live-sheet
- [x] Тесты `test/*`: 68 тестов
- [x] RED: 45 падений на кириллическом `\b`, относительных часах, `STALE`, глаголах в биграммах
- [x] GREEN: `npm test` → 68/68
- [x] Модули подключены к `www/index.html`, дубли удалены
- [x] Приложение открывается через `npm run dev`, ошибок в консоли нет
- [x] Проверено в браузере: seed-заметки, парсинг сроков, классификация веток, добавление заметки

## M1 — ядро листа

- [x] Живой лист (фильтр `filterLiveSheet`)
- [x] Тикер 60 сек
- [x] Полночь: перерисовка и сброс листа
- [x] Resume: `visibilitychange` / `focus` / `pageshow`
- [x] Подпись срока (`formatDue`)
- [x] Placeholder ввода
- [x] Блок «Просрочено (N)»
- [x] Спящие ветки (`SLEEPING_BRANCH_DAYS = 14`)
- [x] Формы полосок (solid/dotted/dashed/wavy/double)
- [x] Тёмная палитра

> M1-пункты «Полночь», «Resume», «Спящие ветки», «Тёмная палитра» подтверждены по коду 2026-11-23: `nextMidnight` + планировщик, `visibilitychange`/`pageshow`, `branchStatuses`/`SLEEPING_BRANCH_DAYS`, `prefers-color-scheme` с палитрой.

## M2 — взаимодействие

- [x] Свайп влево = выполнено/снять (без удаления) + Листик и undo 3.5 с на удаление из меню — UX-001, APPROVE ревьюера (3 раунда) и аудитора (2 раунда); real-touch 7/7
- [x] Корзина дня — свёрнутый блок внизу листа, «вернуть» до полуночи — UX-001, DOM-гейт 27/27
- [x] Long-press 300 мс — меню ветки и пункт «Удалить» (было 400) — UX-001, M-1/M-2 закрыты
- [ ] Правка текста
- [ ] Дедуп Enter
- [x] Фикс `Monitor.currentTab` — AUD-001: APPROVE ревьюера и аудитора, браузерная проверка 2026-11-23

> AUD-001 и UX-001 закрыты. Остальные пункты M2 закрываются картами AUD-002a–d, AUD-003, AUD-006 и проверкой VERIFY-007; до этого галочки не ставятся. TD-DEV-18…21 — остаточные UX/гейт-вопросы, не блокируют M2.

## M3 — обучение

- [ ] Биграммы и стоп-лист
- [ ] Иерархия сигналов, `branchSource`
- [ ] Guard, conflict ratio
- [ ] `distinctNotes` через `noteIds`
- [ ] Дебаунс 5 сек + разрыв 30 сек
- [ ] `userCurated`, decay, JSONL

## M4 — контекст

- [ ] `ContextSnapshot` группа C, web-срез
- [ ] Boot guard
- [ ] Fallback только при тексте < 0.4

## M5 — граф и дайджест

- [ ] Сущности, `note_entities`, `entity_cooccurrence`
- [ ] Рёбра IDF + ветка + время, порог 0.3
- [ ] Кластеризация листа
- [ ] Дайджест только при OVERDUE/DUE_TODAY

## M6 — Capacitor

- [ ] Оболочка, `www` как webDir
- [ ] `onResume`-планировщик
- [ ] Preferences, бэкапы zip
- [ ] Уведомления, share, haptics, splash, deep links
- [ ] Release-подпись, APK

## M7 — полировка

- [ ] Настройки, диагностика 7 тапов
- [ ] Экран «что выучено»
- [ ] Доступность, логи
- [ ] Финальный APK
