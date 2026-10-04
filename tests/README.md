# Тести

- `node --test tests/*.test.mjs` — швидкі перевірки логіки відеоредактора, без браузера.
- `node tests/videocut-e2e.mjs` — відеоредактор у справжньому Chromium.
- `node tests/textcraft-e2e.mjs` — текстовий редактор TextCraft у справжньому Chromium: набір, Markdown-скорочення,
  undo/redo, вставка з очищенням небезпечного коду, таблиці, картинки, збереження, експорт/імпорт, дві вкладки.

Браузерним тестам потрібні `playwright` і `ffmpeg`; шляхи задаються змінними `PLAYWRIGHT_MODULE` і `CHROME`.
Спільний код (сервер, запуск браузера) — у `tests/_harness.mjs`.
