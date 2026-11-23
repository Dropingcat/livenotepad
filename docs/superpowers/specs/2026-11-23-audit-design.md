# Дизайн: аудит действий и ошибок «Живого блокнота»

Дата: 2026-11-23. Статус: к исполнению (карта `M2-AUDIT-001`). Код не писался.
Основание: требование пользователя — аудит сам пишет все действия и ошибки; после теста пользователь сохраняет файл и разбирает.

## 1. Цель

Любое значимое действие и любая ошибка автоматически попадают в журнал, который можно выгрузить одним файлом с телефона и разобрать офлайн. Журнал не должен теряться при сбое UI и должен переживать перезапуск приложения.

## 2. Схема события

```json
{
  "eventId": "uuid",
  "ts": 1764000000000,
  "sessionId": "uuid",
  "deviceId": "uuid",
  "type": "CREATE|COMPLETE|REOPEN|EDIT|DELETE|RESTORE|UNDO_DELETE|BRANCH_CHANGE|IMPORT|EXPORT|EXPORT_AUDIT|APP_START|APP_RESUME|APP_HIDDEN|MIDNIGHT|ERROR|UI|RESET|BACKUP|RESTORE_BACKUP",
  "source": "ui|system|import|export",
  "result": "ok|error",
  "appVersion": "alpha v0.3",
  "context": "note|db|render|import|export|window|promise",
  "message": "краткое описание (для ERROR)",
  "stack": "стек (для ERROR)",
  "details": { "noteId": "...", "branch": "...", "counts": {}, "action": "..." }
}
```

- `eventId` — UUID, стабильный; `sessionId` — на запуск приложения; `deviceId` — постоянный UUID в `localStorage`, чтобы различать устройства.
- Текст заметки — не более 100 символов, как в существующих логах; полный текст в аудит не пишется.
- `type` расширяется без миграции схемы (object store без схемы).

## 3. Что логируется

- **Жизненный цикл:** `APP_START` (версия, UA, counts на старте), `APP_RESUME`, `APP_HIDDEN`, `MIDNIGHT` (сброс листа).
- **Заметки:** `CREATE`, `COMPLETE`, `REOPEN`, `EDIT`, `DELETE`, `RESTORE`, `UNDO_DELETE`, `BRANCH_CHANGE`.
- **Импорт/экспорт:** `IMPORT`, `EXPORT`, `EXPORT_AUDIT`.
- **Ошибки:** `ERROR` с `context`, `message`, `stack`.
- **UI:** `UI` с `details.action` — открытие монитора, смена вкладки, открытие меню ветки, старт правки (без поштучного логирования каждого клика).

## 4. Перехват ошибок

1. `window.addEventListener('error', ...)` — runtime-ошибки и ошибки ресурсов.
2. `window.addEventListener('unhandledrejection', ...)` — необработанные промисы.
3. Явный `Audit.error(context, err)` в существующих `catch`: DB-операции, `renderTab`, импорт/экспорт, коррекции, старт.
4. `Audit.log` не блокирует UI: `DB.addLog(event).catch(...)`; при сбое БД — fallback в `localStorage` (`livenotepad.auditFallback`, ring buffer 200) и `console.error`.
5. На `APP_START` — `flush()` fallback-очереди в БД.

## 5. Хранение и выгрузка

- Основное хранилище — существующий `training_log` (append-only).
- Кнопка **«Скачать аудит»** в мониторе (вкладка «Логи» или футер): собирает все события + мета:
  ```json
  {
    "format": "livenotepad-audit",
    "version": 1,
    "exportedAt": "...",
    "appVersion": "alpha v0.3",
    "sessionId": "...",
    "deviceId": "...",
    "userAgent": "...",
    "platform": "...",
    "counts": { "events": 123, "errors": 2 },
    "events": [ ... ]
  }
  ```
- `downloadJSON` на телефон: Chrome — файл в Downloads; Safari — share sheet. Дополнительно кнопка **«Копировать»** (clipboard) и текстовое поле с JSON как fallback.
- Выгрузка аудита сама логируется событием `EXPORT_AUDIT` (result ok/error).
- Разрушительные операции (импорт-replace, сброс) предупреждают, что журнал будет очищен; перед ними предлагается «Скачать аудит». Полное сохранение аудита при сбросе — в 002d (отдельный store/бэкап).

## 6. Файлы

- `www/js/audit.js` — чистые функции: `makeEvent`, `errorEvent`, `sessionId`, `deviceId`, `buildAuditExport`, `fallbackQueue` (без DOM; `localStorage` инъектируется).
- `test/audit.test.js` — схема события, `errorEvent` из Error/строки/объекта, `buildAuditExport` (counts, сортировка по ts, meta), fallback-очередь, отсутствие полного текста.
- `www/index.html` — инициализация аудита, глобальные обработчики, замена `DB.addLog` на `Audit.log`, `Audit.error` в catch, кнопки выгрузки, `APP_START`/`APP_RESUME`/`APP_HIDDEN`/`MIDNIGHT`.

## 7. DoD

1. `APP_START` пишется при каждом запуске, содержит `sessionId`, `deviceId`, `appVersion`, UA, counts.
2. Все существующие действия пишутся через `Audit.log` с `eventId/sessionId/result`.
3. `window.onerror` и `unhandledrejection` создают `ERROR`-события; проверено в браузере инъекцией ошибки.
4. Ошибки DB/import/export/render логируются с контекстом.
5. «Скачать аудит» отдаёт валидный JSON с мета и всеми событиями; «Копировать» работает как fallback.
6. Fallback-очередь: при недоступной БД событие не теряется, при следующем старте попадает в БД.
7. Тесты `npm test` зелёные; браузерный гейт: инъекция ошибки → `ERROR` в БД и в выгруженном JSON, `consoleErrors` не растёт сверх ожидаемого.
8. Скоуп: `Monitor`, `renderNote`, `renderTab` не переписываются, кроме добавления `Audit.log/error`; CSS — минимальный для кнопок.

## 8. Порядок

`M2-AUDIT-001` → `M2-AUD-002b` (экспорт формат 4, использует `Audit.log` для `EXPORT`) → `M2-AUD-002c` (фильтры/детали монитора) → `M2-AUD-002d` (копии/сброс/восстановление) → AUD-003 → AUD-006 → VERIFY-007.

## 9. Открытые вопросы (решаю сам, если не возразите)

- Хранить аудит в `training_log` сейчас; отдельный append-only store, переживающий сброс, — в 002d.
- `UI`-события: только открытие монитора/смена вкладки/меню/правка, без каждого клика.
- Текст заметки — до 100 символов, как сейчас.
