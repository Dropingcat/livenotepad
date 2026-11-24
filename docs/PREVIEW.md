# Превью для телефона

## 1. LAN (работает сейчас)

Требования: телефон и компьютер в одной Wi-Fi сети (`netis-Fox-5G`).

1. На компьютере: `npm run dev` (порт 8080).
2. На телефоне открыть: **http://192.168.1.100:8080**

Сервер слушает все интерфейсы. В брандмауэре Windows добавлено правило `LiveNotepad dev 8080 (Private LAN)`:
- входящий TCP 8080, профиль Private, только `192.168.1.0/24`.

Если телефон не открывает:
- проверьте, что Wi-Fi тот же и это Private-сеть (не «Общедоступная»);
- проверьте `Test-NetConnection 192.168.1.100 -Port 8080` на компьютере;
- при смене IP (DHCP) адрес изменится: `Get-NetIPAddress -AddressFamily IPv4`.

Ограничения LAN:
- работает только дома;
- HTTP, не HTTPS: `crypto.subtle` и `crypto.randomUUID` отсутствуют (`isSecureContext=false`); приложение работает через fallback, но checksum экспорта на LAN появится только после JS-SHA-256 fallback в 002b. Для полного функционала — Pages HTTPS;
- `navigator.clipboard` может отсутствовать — «Копировать» использует textarea-fallback;
- IndexedDB привязан к origin `http://192.168.1.100:8080`;
- **не импортируйте новые файлы формата 4 в старые сборки (до AUD-002a):** старый `importAll` стирает базу (F-1). Новые файлы — только в текущую версию.

## 2. GitHub Pages

Репозиторий: `Dropingcat/livenotepad` (публичный). Сайт: **https://dropingcat.github.io/livenotepad/**.

Источник Pages — ветка **`gh-pages`** (содержимое `www/` в корне ветки). Обновление после изменений в `main`:

```bash
git add -A
git commit -m "..."
git push origin main
git subtree push --prefix www origin gh-pages
```

Плюсы:
- HTTPS, работает из любой сети;
- `crypto.subtle`, clipboard, downloads — в защищённом контексте;
- удобно тестировать на телефоне без привязки к домашней Wi-Fi.

Workflow `.github/workflows/pages.yml` — опциональный путь на будущее; он требует OAuth scope `workflow`
(`gh auth refresh -h github.com -s workflow`) и сейчас в репозиторий не входит.

Важно: IndexedDB **не переносится** между LAN- и Pages-origin. Заметки, созданные на `http://192.168.1.100:8080`,
не появятся на `https://dropingcat.github.io/livenotepad/`. Для переноса — экспорт/импорт или тестируйте на одном origin.

Как установить приложение на телефон и что значит «Установить приложение»: [GETTING_STARTED.md](GETTING_STARTED.md), раздел 2.

## 3. Аудит на телефоне

1. Открыть монитор (📊).
2. Вкладка **Логи** → **Скачать аудит**.
3. Файл `livenotepad-audit-*.json` сохранится в Downloads (Chrome) или откроется share sheet (Safari).
4. Если скачивание недоступно — **Копировать** и вставить в заметки/мессенджер.

Файл содержит `format`, `version`, `exportedAt`, `appVersion`, `sessionId`, `deviceId`, `userAgent`, `platform`,
`counts`, `events[]`. Полный текст заметок не пишется — только первые 100 символов в `text`.

## 4. Сброс/импорт

До появления 002d (копии/сброс/восстановление):
- не делайте «Сброс» до сохранения аудита — он очищает `training_log`;
- импорт «объединяет» и не удаляет данные;
- «заменить всё» появится только вместе с резервными копиями.
