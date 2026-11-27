# SHIP-001: status & numbers

## Section 0: задача, файлы, проверки

### Задача
Обновить статусные файлы проекта: PROGRESS.md, README.md, docs/CHANGELOG.md.
- M2: отметить «Правка текста» и «Дедуп Enter» как выполненные
- M3–M5: отметить все пункты как выполненные
- M6–M7: честный статус (частично)
- M8: добавить план (экраны веток)
- README: npm test → 362, обновить статус M0–M7, добавить установку (PWA/extension/APK), известные ограничения, убрать «M3–M7 — спеки пишутся»
- CHANGELOG: добавить записи M3-001…M7-001 с хэшами коммитов
- Исправить устаревшие числа (242 → 362) в ARCHITECTURE.md, GETTING_STARTED.md

### Файлы
- `PROGRESS.md` — изменён
- `README.md` — изменён
- `docs/CHANGELOG.md` — изменён
- `docs/ARCHITECTURE.md` — изменён (242 → 362)
- `docs/GETTING_STARTED.md` — изменён (242 → 362)

### Проверки
1. `npm test` → pass 362, fail 0
2. Никаких устаревших чисел 242/336/alpha v0.3 в изменённых строках
3. Коммит: `SHIP-001: status & numbers`

### Число тестов на момент закрытия
**362**

---

## Файлы

### PROGRESS.md
Текущее состояние:
- M0 — фундамент ✅ (94 теста, всё готово)
- M1 — ядро листа ✅ (тикер, полночь, resume, спящие ветки, тёмная палитра)
- M2 — взаимодействие ✅ (все пункты [x], примечание обновлено)
- M3 — обучение ✅ (6/6 пунктов)
- M4 — контекст ✅ (3/3 пунктов)
- M5 — граф и дайджест ✅ (4/4 пунктов)
- M6 — Capacitor (частично): [x] оболочка/www/webDir, [~] onResume, [ ] Preferences/zip, [x] уведомления/share/haptics/splash, [ ] APK
- M7 — полировка (частично): [x] настройки/диагностика, [x] экран обучения, [x] доступность/логи, [ ] финальный APK
- M8 — экраны веток (план): лист = фильтр, порог 5

### README.md
- npm test → 362
- M2 статус: готово (362 теста, все карты закрыты)
- M3–M5: готово
- M6–M7: частично (с примечаниями)
- Добавлен раздел «Установка» (PWA / extension / APK)
- Убрана строка «M3–M7 — спеки пишутся»
- Техдолги: ссылка на PROBLEMS_REGISTER.md

### docs/CHANGELOG.md
Добавлен раздел 2026-11-27 с записями:
- M3-001: noteIds, decay, JSONL (77b8530)
- M3-002: JSONL export, 22 seed bigrams (9930d5c)
- M3 complete: thresholds, guard (9f6cc4c)
- M4-001: ContextSnapshot, boot guard (ae2519d)
- M5-001: entities, cooccurrence, DBv3 (22c7536)
- M5-002: IDF, clustering, digest (ad6d0fb)
- M6-001: Capacitor init, plugins (fc07a35)
- M6-002: share, haptics, notifications (5e16ec9)
- M6-003: icons, splash, build script
- M7-001: settings, accessibility, force dark (88e732d)

### docs/ARCHITECTURE.md
- «сейчас 242 теста» → «сейчас 362 теста»

### docs/GETTING_STARTED.md
- «242 теста» → «362 теста»

### Не тронутые (по границам)
www/, extension/, android/, test/, scripts/, package.json, .gitignore, capacitor.config.json — не изменялись.

## Итог
WROTE SHIP-001: 5 файлов. npm test: fail 0.