# PWA на Android

Цель: установить «Живой блокнот» на домашний экран Android как приложение, без APK и стора. Позже — отдельная Capacitor-оболочка (APK), если понадобятся нативные функции.

## 1. Что входит в PWA-срез

- `www/manifest.webmanifest`:
  - `name`, `short_name`, `start_url: "./"`, `scope: "./"`, `display: "standalone"`,
  - `background_color`, `theme_color`, `orientation: "portrait"`,
  - иконки 192×192, 512×512, maskable 512×512.
- `www/sw.js`:
  - кэш app shell (`index.html`, `js/*`, manifest, иконки);
  - network-first для навигации и same-origin GET;
  - versioned cache, удаление старых кэшей;
  - `skipWaiting` + `clients.claim`.
- `index.html`: `link rel="manifest"`, `apple-touch-icon`, регистрация SW (`updateViaCache: 'none'`).
- `test/pwa.test.js`: manifest-поля, наличие иконок, базовые инварианты SW.
- Метрика гейта: `navigator.serviceWorker.ready` + offline reload.

## 2. Как установить на Android

1. Открыть **https://dropingcat.github.io/livenotepad/** в Chrome.
2. Меню ⋮ → **Установить приложение** / **Добавить на главный экран**.
3. Запустить с иконки: standalone-окно, без адресной строки.
4. Проверить офлайн: включить авиарежим, закрыть/открыть приложение — лист должен открыться, данные на месте.

LAN-вариант `http://192.168.1.100:8080` тоже работает, но установка PWA и service worker надёжнее на HTTPS. IndexedDB у LAN и Pages — разные origin: данные не переносятся автоматически.

## 3. Ограничения (осознанные)

- Фоновых уведомлений о сроках нет — решение пользователя: достаточно бейджа/списка «Просрочено» при открытии.
- Синхронизации между устройствами нет — локальные данные + экспорт/импорт файлами.
- Нет нативных share/haptics/splash/deep links — это Capacitor-APK (позже), не PWA.
- Аудит и заметки хранятся в IndexedDB телефона; выгрузка — вручную через «Скачать аудит»/экспорт.

## 4. Обновления

Pages деплоит `www/` при каждом пуше в `main`. SW использует network-first: онлайн-версия обновляется, офлайн — из кэша. После обновления может понадобиться один перезапуск приложения (SW активируется и забирает управление).

## 5. Проверка

- `npm test` — manifest/иконки/SW-инварианты.
- `node --check www/sw.js`.
- Браузерный гейт: SW `ready`, offline reload, IndexedDB на месте, `consoleErrors` пустые, `appHash`/`stepCount/passCount` в артефакте.
- На телефоне: установка, открытие с иконки, создание заметки, аудит → «Скачать аудит», авиарежим → перезапуск.
