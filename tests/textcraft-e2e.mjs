// Браузерна перевірка текстового редактора TextCraft (потрібні Playwright і Chromium).
//   node tests/textcraft-e2e.mjs
// Змінні: PLAYWRIGHT_MODULE (шлях до playwright), CHROME (шлях до chromium)
import assert from 'node:assert/strict';
import { writeFile, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launch, newPage, step } from './_harness.mjs';

const server = await startServer();
const URL_TC = server.url + '/tools/text-craft.html';
const browser = await launch();
const tmp = await mkdtemp(join(tmpdir(), 'tc-'));
const errors = [];

const open = async ctx => {
  const p = await newPage(ctx, errors);
  await p.goto(URL_TC);
  await p.waitForFunction(() => window.TextCraft && window.TextCraft.state.docId);
  return p;
};
const html = p => p.evaluate(() => document.getElementById('editor').innerHTML);
// курсор у кінець першого абзацу після заголовка
const caretToFirstP = p => p.evaluate(() => {
  const el = document.querySelector('#editor > p'); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.getElementById('editor').focus();
});

const ctx = await browser.newContext({ viewport: { width: 1300, height: 860 }, acceptDownloads: true });
const page = await open(ctx);

await step('порожній документ: заголовок і абзац', async () => {
  const h = await html(page);
  assert.match(h, /^<h1>/);
  assert.match(h, /<p>/);
});

await step('набір у заголовку, Enter у кінці — новий звичайний абзац', async () => {
  await page.click('#editor h1');
  await page.keyboard.type('Урок про цикли');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Перший абзац');
  const h = await html(page);
  assert.match(h, /<h1>Урок про цикли<\/h1>/);
  assert.match(h, /<p>Перший абзац<\/p>/);
});

await step('Markdown-скорочення: «## » — підзаголовок, «- » — список', async () => {
  await page.keyboard.press('Enter');
  await page.keyboard.type('## Розділ');
  await page.keyboard.press('Enter');
  await page.keyboard.type('- пункт один');
  await page.keyboard.press('Enter');
  await page.keyboard.type('пункт два');
  const h = await html(page);
  assert.match(h, /<h2>Розділ<\/h2>/);
  assert.match(h, /<ul><li>пункт один<\/li><li>пункт два<\/li><\/ul>/);
});

await step('Ctrl+B робить жирний текст, Ctrl+Z скасовує, Ctrl+Shift+Z повертає', async () => {
  await caretToFirstP(page);
  await page.keyboard.down('Shift'); for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft'); await page.keyboard.up('Shift');
  await page.keyboard.press('Control+KeyB');
  assert.match(await html(page), /<(b|strong)>абзац<\/(b|strong)>/);
  await page.keyboard.press('Control+KeyZ');
  assert.doesNotMatch(await html(page), /<(b|strong)>абзац/);
  await page.keyboard.press('Control+Shift+KeyZ');
  assert.match(await html(page), /<(b|strong)>абзац<\/(b|strong)>/);
});

await step('блок коду: «```py» + Enter', async () => {
  await page.evaluate(() => { const ed = document.getElementById('editor'); const p = document.createElement('p'); p.innerHTML = '<br>'; ed.appendChild(p); const r = document.createRange(); r.setStart(p, 0); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r); ed.focus(); });
  await page.keyboard.type('```py');
  await page.keyboard.press('Enter');
  await page.keyboard.type('print(1)');
  const h = await html(page);
  assert.match(h, /<pre class="tc-code"[^>]*data-lang="python"[^>]*>[^]*print\(1\)/);
});

await step('вставка з чужого сайту очищується від небезпечного коду', async () => {
  await caretToFirstP(page);
  let dialogs = 0; page.on('dialog', d => { dialogs++; d.dismiss(); });
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData('text/html', '<p>Безпечний текст<img src=x onerror="alert(1)"><a href="javascript:alert(2)">посилання</a><script>alert(3)</script></p>');
    dt.setData('text/plain', 'Безпечний текст');
    document.getElementById('editor').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(300);
  const h = await html(page);
  assert.match(h, /Безпечний текст/);
  assert.doesNotMatch(h, /onerror|javascript:|<script/i);
  assert.equal(dialogs, 0);
});

await step('таблиця вставляється командою', async () => {
  await caretToFirstP(page);
  await page.evaluate(() => window.TextCraft.run('table'));
  assert.equal(await page.evaluate(() => document.querySelectorAll('#editor table tr').length), 3);
});

await step('картинка вставляється і зберігається після перезавантаження', async () => {
  const png = join(tmp, 'a.png');
  // 2×2 PNG
  await writeFile(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64'));
  await caretToFirstP(page);
  await page.setInputFiles('#imgInput', png);
  await page.waitForFunction(() => document.querySelector('#editor figure img[data-asset]'));
  await page.evaluate(() => window.TextCraft.flushSave());
  await page.reload();
  await page.waitForFunction(() => window.TextCraft && window.TextCraft.state.docId);
  const ok = await page.evaluate(() => { const i = document.querySelector('#editor figure img[data-asset]'); return !!i && /^blob:/.test(i.src); });
  assert.ok(ok, 'картинка має відновитися з IndexedDB');
});

await step('текст зберігається після перезавантаження', async () => {
  const h = await html(page);
  assert.match(h, /Урок про цикли/);
  assert.match(h, /<h2>Розділ<\/h2>/);
});

await step('експорт у HTML: зміст, без редагування, з кнопкою копіювання', async () => {
  const dl = page.waitForEvent('download');
  await page.evaluate(() => { document.querySelector('[data-act="export"]').click(); });
  await page.locator('.menu-item', { hasText: 'HTML-сторінка' }).click();
  const d = await dl;
  const text = await readFile(await d.path(), 'utf8');
  assert.match(text, /<title>Урок про цикли<\/title>/);
  assert.match(text, /class="x-toc"/);
  assert.match(text, /tc-copy/);
  assert.doesNotMatch(text, /contenteditable/);
});

await step('експорт у Markdown', async () => {
  const md = await page.evaluate(() => window.TextCraft.toMarkdown(document.getElementById('editor'), {}));
  assert.match(md, /^# Урок про цикли/m);
  assert.match(md, /^## Розділ/m);
  assert.match(md, /^- пункт один/m);
  assert.match(md, /```python\nprint\(1\)\n```/);
});

await step('імпорт Markdown створює новий документ', async () => {
  const f = join(tmp, 'lesson.md');
  await writeFile(f, '# Імпортований\n\nТекст **жирний**.\n\n1. перший\n2. другий\n');
  const before = await page.evaluate(() => window.TextCraft.state.docId);
  await page.setInputFiles('#importInput', f);
  await page.waitForFunction(b => window.TextCraft.state.docId !== b, before, { timeout: 8000 }).catch(async e => { throw new Error('toast: ' + await page.evaluate(() => document.querySelector('.toast, #toast')?.textContent)); });
  const h = await html(page);
  assert.match(h, /<h1>Імпортований<\/h1>/);
  assert.match(h, /<strong>жирний<\/strong>/);
  assert.match(h, /<ol><li>перший<\/li><li>другий<\/li><\/ol>/);
  const list = await page.evaluate(async () => (await window.TextCraft.Store.list()).length);
  assert.ok(list >= 2);
});

await step('жодної помилки в консолі сторінки', async () => assert.deepEqual(errors, []));

await browser.close(); server.close();
