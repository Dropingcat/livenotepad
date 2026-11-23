# Аудит: как сохранить и разобрать

## 1. Что пишется

Каждое значимое действие и ошибка:

- `APP_START`, `APP_RESUME`, `APP_HIDDEN`, `MIDNIGHT`;
- `CREATE`, `COMPLETE`, `REOPEN`, `EDIT`, `DELETE`, `RESTORE`, `UNDO_DELETE`, `BRANCH_CHANGE`;
- `IMPORT`, `EXPORT`, `EXPORT_AUDIT`;
- `ERROR` — `window.onerror`, `unhandledrejection`, явные catch (DB, render, import, export, corrections, startup);
- `UI` — открытие монитора, смена вкладки, меню ветки, старт правки.

Событие:

```json
{
  "eventId": "uuid",
  "ts": 1764000000000,
  "sessionId": "uuid",
  "deviceId": "uuid",
  "type": "CREATE",
  "source": "ui",
  "result": "ok",
  "appVersion": "alpha v0.3",
  "noteId": "...",
  "branch": "byt",
  "text": "купить молоко",
  "details": {}
}
```

Текст заметки — не более 100 символов. Полный текст в аудит не пишется.

## 2. Как сохранить

1. Монитор (📊) → **Логи**.
2. **Скачать аудит** → `livenotepad-audit-*.json`.
3. Если скачивание недоступно — **Копировать** и вставить JSON в файл/сообщение.

Файл:

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
  "counts": { "events": 123, "errors": 2, "failed": 2 },
  "pending": 0,
  "lost": 0,
  "events": [ ... ]
}
```

- `errors` — события `type:"ERROR"` **и** `result:"error"`; `failed` — только `result:"error"`.
- `pending` — сколько событий ещё в fallback-очереди (сбои записи); они уже включены в `events` с дедупликацией по `eventId`.
- `lost` — сколько событий не удалось сохранить в fallback (квота/недоступный `localStorage`); в норме `0`.
- Если чтение БД при выгрузке упало, кнопка показывает «Ошибка выгрузки аудита», а не пустой файл с `events:0`.
- На телефоне URL файла отзывается через 1 с после клика, чтобы загрузка успела начаться.

## 3. Быстрый разбор

```bash
# сколько событий и ошибок
jq '.counts' livenotepad-audit-*.json

# все ошибки
jq '.events[] | select(.type=="ERROR") | {ts, context, message, stack}' livenotepad-audit-*.json

# импорт/экспорт
jq '.events[] | select(.type|test("IMPORT|EXPORT")) | {ts, type, mode, result, counts}' livenotepad-audit-*.json

# хронология действий по заметке
jq '.events[] | select(.noteId=="<id>") | {ts, type, branch, text}' livenotepad-audit-*.json
```

Node без jq:

```js
const a = require('./livenotepad-audit-xxx.json');
console.log(a.counts);
console.table(a.events.filter(e => e.type === 'ERROR').map(e => ({ ts: new Date(e.ts).toISOString(), context: e.context, message: e.message })));
```

## 4. На что смотреть

- `counts.events`, `counts.errors`, `counts.failed`, `pending`, `lost`:
  - `errors`/`failed` > 0 — были сбои; смотрите `type:"ERROR"` и `result:"error"`.
  - `pending` > 0 — часть событий пришла из fallback-очереди (запись в БД в этой сессии падала); они включены в файл.
  - `lost` > 0 — события не поместились/не записались даже в fallback; это сигнал о проблеме с хранилищем.
- `ERROR` с `context`: `db`, `render`, `import`, `export`, `window`, `promise`, `corrections`, `startup`.
- `APP_HIDDEN`/`APP_RESUME`: не было ли потери ввода/двойного рендера.
- `IMPORT` с `result:error`: не осталось ли частично применённого импорта (не должно).
- `EXPORT_AUDIT`: сохранился ли сам аудит; `details.pending/lost` — состояние очереди на момент выгрузки.
- `result:error` у действий: где именно упало.

## 5. Приватность

Аудит хранится локально в IndexedDB (`training_log`) и выгружается только по кнопке. В репозиторий и на GitHub Pages данные заметок не попадают. Не публикуйте файл аудита без необходимости: в нём есть тексты заметок (до 100 символов) и `userAgent`.
