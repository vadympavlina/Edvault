# Тести відеоредактора

- `node --test tests/*.test.mjs` — швидкі перевірки логіки моделі (`tools/videocut/js/state.js`), без браузера.
- `node tests/videocut-e2e.mjs` — перевірка в справжньому Chromium (потрібні `playwright`, `ffmpeg`);
  шляхи задаються змінними `PLAYWRIGHT_MODULE` і `CHROME`.
