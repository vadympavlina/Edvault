# Edvault

Інструменти для вчителя, тренажери й емулятори для учнів — [edvault.online](https://www.edvault.online).
Статичний сайт без збирання: HTML, CSS і модулі JavaScript, що відкриваються в браузері як є.
Розміщено на GitHub Pages (домен у `CNAME`), адреси без `.html`: `/tools/animator` → `tools/animator.html`.

## Запуск локально

```bash
npm start          # http://localhost:8080 — сервер, що поводиться як GitHub Pages
npm test           # швидкі перевірки логіки в Node, без браузера
npm run test:e2e   # усі браузерні тести (потрібен Playwright з Chromium)
npm run test:e2e -- animator   # лише тести, у назві яких є «animator»
```

Залежностей встановлювати не треба. Браузерним тестам потрібні `playwright` і Chromium
(шляхи — змінні `PLAYWRIGHT_MODULE` і `CHROME`), деяким — `ffmpeg`. Опис кожного тесту — у [tests/README.md](tests/README.md).

## Що де лежить

| Тека / файл | Що це |
|---|---|
| `index.html` | Головна сторінка |
| `tools/` | Інструменти для вчителя: сторінка `tools/<назва>.html`, код більших інструментів — у теці поруч (`animator-app/`, `videocut-app/`, `imgconv/`, `textcraft/`). `tools/index.html` — каталог |
| `trainers/` | Тренажери для учнів: так само `trainers/<назва>.html` + тека з кодом. `trainers/index.html` — каталог |
| `emulators/` | Великі симулятори: Windows, блогер, місто, стартап — сторінка + тека з кодом (`windowsemu/`, `bloggeremu/`, `citysim/`, `startupsim/`) |
| `shared/` | Спільні модулі для кількох інструментів: `zip.js` (ZIP без бібліотек), `savefile.js` (збереження у файл і відкриття, назви файлів, контрольна сума) |
| `assets/` | Каталог (`catalog-data.js` — назви, описи, іконки карток), стилі каталогу, картинки для прев’ю посилань (`og/`) |
| `icons/` | Іконки сторінок: `<назва>.svg` — джерело, `.ico` і `-180.png` генеруються |
| `scripts/` | Службові скрипти: іконки, прев’ю посилань, локальний сервер, щоденний звіт про техніку |
| `tests/` | Модульні (`*.test.mjs`) і браузерні (`*-e2e.mjs`) тести, спільний помічник `_harness.mjs` |
| `docs/` | Довідкові файли (зразок даних Firebase) |
| `admin.html`, `lesson.html`, `materials.html`, `equipment*.html` | Портал школи на Firebase: уроки, матеріали, облік техніки. Спільний код — `firebase-config.js`, `portal-common.js`, `admin-structure.js`, `styles.css` |
| `tools.html` | Стара адреса каталогу — переадресація на `/tools/` |
| `404.html` | Сторінка «не знайдено» для GitHub Pages |
| `favicon.*`, `apple-touch-icon.png` | Іконка сайту в корені (копії `icons/edvault.*`, браузери шукають їх саме тут) |

## Як додати новий інструмент чи тренажер

1. Сторінка `tools/<назва>.html` (або `trainers/…`), код — у теці поруч. Тека **не може** називатися так само,
   як сторінка (`tools/animator/` поруч з `animator.html` зламає адресу без `.html`) — додайте `-app` чи скорочення.
2. Картка в каталозі: запис у `assets/catalog-data.js` (`TOOLS` чи `TRAINERS`).
3. Іконка: `icons/<назва>.svg`, далі `npm run icons` — з’являться `.ico` і `-180.png`. На сторінці:
   ```html
   <link rel="icon" href="/icons/<назва>.ico" sizes="32x32">
   <link rel="icon" href="/icons/<назва>.svg" type="image/svg+xml">
   <link rel="apple-touch-icon" href="/icons/<назва>-180.png">
   ```
4. Прев’ю посилань: `OG_ONLY=tool-<назва> npm run og` — картинка в `assets/og/` і теги в `<head>`.
5. Тести: `tests/<назва>.test.mjs` для логіки без DOM і `tests/<назва>-e2e.mjs` для браузера; опис — у `tests/README.md`.
   `npm test` перевіряє, що в каталозі все узгоджено (`tests/catalog.test.mjs`).
6. Модуль, потрібний кільком інструментам, кладіть у `shared/`, а не в теку одного з них.

## Домовленості

- Інтерфейс український, звертання на «ви», нейтральний рід до учнів. Без емодзі в інтерфейсі.
- Кожен інструмент працює без реєстрації, дані — у браузері (localStorage, IndexedDB) і в файлах, які учень зберігає сам.
- Зовнішні бібліотеки, якщо потрібні, лежать у `vendor/` поруч із кодом інструмента разом із ліцензією.
