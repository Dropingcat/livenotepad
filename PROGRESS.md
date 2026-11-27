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
- [x] Правка текста
- [x] Дедуп Enter
- [x] Фикс `Monitor.currentTab` — AUD-001: APPROVE ревьюера и аудитора, браузерная проверка 2026-11-23

> M2 закрыт. Все пункты выполнены: правка текста (note-edit.js), дедуп Enter (dedup.js), жесты/корзина/аудит/импорт-экспорт — APPROVE ревьюера и аудитора, браузерные проверки. 362 теста.

## M3 — обучение ✅

- [x] Биграммы и стоп-лист (22 seed bigrams, `SeedsClassifier`, `stopwords-*.js`)
- [x] Иерархия сигналов, `branchSource` (сигналы: SEED > LEARNED > CONTEXT > FALLBACK)
- [x] Guard, conflict ratio (`fallbackGuard`, порог конфликта, TIME_FALLBACK при textLikelihood < 0.4)
- [x] `distinctNotes` через `noteIds` (`computeMetaFromEvidence`)
- [x] Дебаунс 5 сек + разрыв 30 сек (`debounceTrain`, `MIN_GAP_MS`)
- [x] `userCurated`, decay, JSONL (`applyDecay`, JSONL-экспорт, userCurated при импорте)

## M4 — контекст ✅

- [x] `ContextSnapshot` группа C, web-срез (`collectContext`, `ContextSnapshot`)
- [x] Boot guard (`bootGuard`, не тренируется на старте)
- [x] Fallback только при тексте < 0.4 (`fallbackGuard`, textLikelihood < 0.4 → NONE)

## M5 — граф и дайджест ✅

- [x] Сущности, `note_entities`, `entity_cooccurrence` (`extractEntities`, `computeCooccurrence`, DBv3)
- [x] Рёбра IDF + ветка + время, порог 0.3 (`computeEdgeWeight`, IDF weight, branch bonus, temporal bonus)
- [x] Кластеризация листа (`clusterNotes`)
- [x] Дайджест только при OVERDUE/DUE_TODAY (digest показывается только для просроченных/сегодняшних)

## M6 — Capacitor (частично)

- [x] Оболочка, `www` как webDir (Capacitor init, android platform, `capacitor.config.json`, webDir: www)
- [~] `onResume`-планировщик — web resume (`visibilitychange`/`pageshow`/`focus`) работает, нативный `App.addListener('appStateChange')` не добавлен
- [ ] Preferences, бэкапы zip — не сделаны
- [x] Уведомления, share, haptics, splash; deep links не сделаны
- [ ] Release-подпись, APK — debug build attempt pending

## M7 — полировка (частично)

- [x] Настройки, диагностика 7 тапов (настройки темы, сброс обучения, диагностика 7 тапов)
- [x] Экран «что выучено» (`learned-words.js`, показывает все слова с evidence)
- [x] Доступность, логи (force dark theme, `prefers-reduced-motion`, `AUDIT.log`)
- [ ] Финальный APK — debug build attempt pending

## M8 — экраны веток (план)

Модель: **лист = фильтр**. При тапе на название ветки лист переключается в режим фильтра по этой ветке.

- [ ] Фильтр ветки: лист показывает только заметки выбранной ветки
- [ ] Порог 5: если заметок ветки ≤ 5, показывать на листе весь день без фильтра
- [ ] Индикатор активного фильтра в шапке
- [ ] Сброс фильтра тапом «Все заметки» / повторным тапом на ветку
