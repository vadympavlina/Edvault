# Edvault

Головна сторінка, каталоги й портал школи — [edvault.online](https://www.edvault.online).
Самі інструменти, тренажери й емулятори живуть в окремих репозиторіях і на своїх сайтах:

| Репозиторій | Сайт |
|---|---|
| [edvault-tools](https://github.com/vadympavlina/edvault-tools) | [tools.edvault.online](https://tools.edvault.online) |
| [edvault-trainers](https://github.com/vadympavlina/edvault-trainers) | [trainers.edvault.online](https://trainers.edvault.online) |
| [edvault-emulators](https://github.com/vadympavlina/edvault-emulators) | [emulators.edvault.online](https://emulators.edvault.online) |
Статичний сайт без збирання: HTML, CSS і модулі JavaScript, що відкриваються в браузері як є.
Розміщено на GitHub Pages (домен у `CNAME`), адреси без `.html`: `/materials` → `materials.html`.

## Запуск локально

```bash
npm start          # http://localhost:8080 — сервер, що поводиться як GitHub Pages
npm test           # швидкі перевірки логіки в Node, без браузера
npm run test:e2e   # усі браузерні тести (потрібен Playwright з Chromium)
npm run test:e2e -- catalog   # лише тести, у назві яких є «catalog»
```

Залежностей встановлювати не треба. Браузерним тестам потрібні `playwright` і Chromium
(шляхи — змінні `PLAYWRIGHT_MODULE` і `CHROME`). Опис кожного тесту — у [tests/README.md](tests/README.md).

## Що де лежить

| Тека / файл | Що це |
|---|---|
| `index.html` | Головна сторінка |
| `tools/` | Лише каталог інструментів (`tools/index.html`): картки ведуть на окремий сайт інструментів |
| `trainers/` | Лише каталог тренажерів (`trainers/index.html`): картки ведуть на сайт тренажерів |
| `assets/` | Каталог (`catalog-data.js` — назви, описи, іконки карток), стилі каталогу, картинки для прев’ю посилань (`og/`) |
| `icons/` | Іконки сторінок: `<назва>.svg` — джерело, `.ico` і `-180.png` генеруються |
| `scripts/` | Службові скрипти: іконки, прев’ю посилань, локальний сервер, щоденний звіт про техніку |
| `tests/` | Модульні (`*.test.mjs`) і браузерні (`*-e2e.mjs`) тести, спільний помічник `_harness.mjs` |
| `docs/` | Довідкові файли (зразок даних Firebase) |
| `admin.html`, `lesson.html`, `materials.html`, `equipment*.html` | Портал школи на Firebase: уроки, матеріали, облік техніки. Спільний код — `firebase-config.js`, `portal-common.js`, `admin-structure.js`, `styles.css` |
| `tools.html` | Стара адреса каталогу — переадресація на `/tools/` |
| `404.html` | Сторінка «не знайдено» для GitHub Pages; старі адреси `/tools/<назва>`, `/trainers/<назва>` і `/emulators/<назва>` перенаправляє на нові сайти |
| `favicon.*`, `apple-touch-icon.png` | Іконка сайту в корені (копії `icons/edvault.*`, браузери шукають їх саме тут) |

## Як додати новий інструмент чи тренажер

Сам інструмент чи тренажер додається у свій репозиторій (`edvault-tools` чи `edvault-trainers`), а тут — лише картка
в каталозі: запис у `assets/catalog-data.js` (`TOOLS` чи `TRAINERS`, поле `file` — назва сторінки на тому сайті).
`npm test` перевіряє, що записи каталогу узгоджені (`tests/catalog.test.mjs`).

## Домовленості

- Інтерфейс український, звертання на «ви», нейтральний рід до учнів. Без емодзі в інтерфейсі.
- Кожен інструмент працює без реєстрації, дані — у браузері (localStorage, IndexedDB) і в файлах, які учень зберігає сам.
- Зовнішні бібліотеки, якщо потрібні, лежать у `vendor/` поруч із кодом інструмента разом із ліцензією.
