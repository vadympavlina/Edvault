# Edvault

Головна сторінка й портал школи — [edvault.online](https://www.edvault.online).
Інструменти, тренажери й емулятори живуть в окремих репозиторіях і на своїх сайтах:

| Репозиторій | Сайт |
|---|---|
| [edvault-tools](https://github.com/vadympavlina/edvault-tools) | [tools.edvault.online](https://tools.edvault.online) |
| [edvault-trainers](https://github.com/vadympavlina/edvault-trainers) | [trainers.edvault.online](https://trainers.edvault.online) |
| [edvault-emulators](https://github.com/vadympavlina/edvault-emulators) | [emulators.edvault.online](https://emulators.edvault.online) |

Статичний сайт без збирання: HTML, CSS і JavaScript, що відкриваються в браузері як є.
Розміщено на GitHub Pages (домен у `CNAME`), адреси без `.html`: `/materials` → `materials.html`.

## Запуск локально

```bash
npm start          # http://localhost:8080 — сервер, що поводиться як GitHub Pages
```

Залежностей встановлювати не треба.

## Що де лежить

| Тека / файл | Що це |
|---|---|
| `index.html` | Головна сторінка |
| `admin.html`, `lesson.html`, `materials.html`, `equipment*.html` | Портал школи на Firebase: уроки, матеріали, облік техніки. Спільний код — `firebase-config.js`, `portal-common.js`, `admin-structure.js`, `styles.css` |
| `404.html` | Сторінка «не знайдено» для GitHub Pages; старі адреси `/tools/…`, `/trainers/…` і `/emulators/…` перенаправляє на нові сайти |
| `assets/og/` | Картинки для прев’ю посилань |
| `icons/` | Іконки сторінок: `<назва>.svg` — джерело, `.ico` і `-180.png` генеруються (`npm run icons`) |
| `scripts/` | Службові скрипти: іконки, прев’ю посилань (`npm run og`), локальний сервер, щоденний звіт про техніку |
| `.github/workflows/` | Щоденний звіт про техніку на пошту |
| `docs/` | Довідкові файли (зразок даних Firebase) |
| `favicon.*`, `apple-touch-icon.png` | Іконка сайту в корені (копії `icons/edvault.*`, браузери шукають їх саме тут) |

## Домовленості

- Інтерфейс український, звертання на «ви», нейтральний рід до учнів. Без емодзі в інтерфейсі.
