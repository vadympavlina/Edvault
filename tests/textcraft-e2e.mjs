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
  assert.match(text, /<span class="tk-kw">print<\/span>|<span class="tk-fn">print<\/span>|<span class="tk-num">1<\/span>/, 'код має бути підсвічений');
});

await step('підсвітка коду в редакторі не змінює текст блоку', async () => {
  const r = await page.evaluate(() => ({ n: CSS.highlights ? [...CSS.highlights.keys()].filter(k => k.startsWith('tc-')).length : -1, inner: document.querySelector('#editor pre.tc-code code').innerHTML }));
  assert.ok(r.n > 0, 'мають бути зареєстровані підсвітки');
  assert.doesNotMatch(r.inner, /<span/);
});

await step('назва без заповнення береться з першого заголовка; посилання «Інструменти» немає', async () => {
  await page.fill('#docTitle', '');
  await page.evaluate(() => document.getElementById('docTitle').dispatchEvent(new Event('input', { bubbles: true })));
  const r = await page.evaluate(() => ({ ph: document.getElementById('docTitle').placeholder, h1: document.querySelector('#editor h1').textContent, back: document.querySelectorAll('a[href$="tools.html"]').length }));
  assert.equal(r.ph, r.h1);
  assert.equal(r.back, 0);
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

await step('шапка: рівна, без дубля заголовка, потрапляє в експорт', async () => {
  await page.fill('#docTitle', ''); // назва документа порожня — шапка бере текст першого заголовка
  const t = await page.evaluate(() => document.querySelector('#editor h1').textContent);
  await page.evaluate(() => document.querySelector('[data-act="header"]').click());
  await page.waitForSelector('#headerModal.open');
  assert.equal(await page.evaluate(() => document.getElementById('hdrDupWrap').hidden), false, 'має пропонувати прибрати однаковий заголовок');
  await page.fill('#hdrTag', 'Інформатика');
  await page.click('#hdrStyle [data-style="soft"]');
  await page.click('#hdrApply');
  const r = await page.evaluate(() => ({ wave: !!document.querySelector('.doc-header-wave'), title: document.querySelector('#docHeaderSlot .doc-header-title').textContent, soft: document.querySelector('#docHeaderSlot .doc-header').classList.contains('style-soft'), h1: document.querySelector('#editor > h1') ? document.querySelector('#editor > h1').textContent : null }));
  assert.equal(r.wave, false);
  assert.equal(r.title, t);
  assert.equal(r.soft, true);
  assert.notEqual(r.h1, t, 'однаковий заголовок має зникнути з тексту');
  await page.keyboard.press('Control+KeyZ'); // повернути заголовок у текст для наступних перевірок
  assert.equal(await page.evaluate(() => document.querySelector('#editor > h1').textContent), t);
});

await step('готові шаблони шапки: «Домашнє завдання» ставить мітку, підзаголовок і колір', async () => {
  await page.evaluate(() => document.querySelector('[data-act="header"]').click());
  await page.waitForSelector('#headerModal.open');
  assert.equal(await page.locator('#hdrPresets [data-preset]').count(), 8);
  await page.click('#hdrPresets [data-preset="homework"]');
  const r = await page.evaluate(() => ({ tag: document.getElementById('hdrTag').value, sub: document.getElementById('hdrSubtitle').value, on: document.querySelector('#hdrPresets .on')?.dataset.preset, prev: document.querySelector('#hdrPreview .doc-header-tag')?.textContent }));
  assert.equal(r.tag, 'Домашнє завдання');
  assert.equal(r.prev, 'Домашнє завдання');
  assert.equal(r.on, 'homework');
  assert.ok(r.sub);
  await page.evaluate(() => { document.getElementById('hdrDup').checked = false; }); // заголовок у тексті потрібен наступним крокам
  await page.click('#hdrApply');
  assert.equal(await page.evaluate(() => document.querySelector('#docHeaderSlot .doc-header-tag').textContent), 'Домашнє завдання');
});

await step('друга вкладка з тим самим документом — лише перегляд, зміни не перезаписуються', async () => {
  const p2 = await open(ctx);
  assert.equal(await p2.evaluate(() => window.TextCraft.state.docId), await page.evaluate(() => window.TextCraft.state.docId));
  await p2.waitForSelector('.tc-lockbar:not([hidden])');
  assert.equal(await p2.evaluate(() => document.getElementById('editor').isContentEditable), false);
  assert.equal(await page.evaluate(() => document.getElementById('editor').isContentEditable), true);
  // правка в першій вкладці з'являється в другій
  await page.click('#editor h1'); await page.keyboard.press('End'); await page.keyboard.type(' (оновлено)');
  await page.evaluate(() => window.TextCraft.flushSave());
  await p2.waitForFunction(() => /оновлено/.test(document.querySelector('#editor h1').textContent), null, { timeout: 5000 });
  // друга вкладка забирає редагування — перша переходить у перегляд
  await p2.click('.tc-lockbar-btn');
  await p2.waitForFunction(() => document.getElementById('editor').isContentEditable, null, { timeout: 5000 });
  await page.waitForFunction(() => !document.getElementById('editor').isContentEditable, null, { timeout: 5000 });
  await p2.click('#editor h1'); await p2.keyboard.press('End'); await p2.keyboard.type(' 2');
  await p2.evaluate(() => window.TextCraft.flushSave());
  // перша вкладка не може затерти: її збереження вимкнено, а текст оновився
  await page.evaluate(() => window.TextCraft.saveNow());
  await page.waitForFunction(() => /оновлено\) 2/.test(document.querySelector('#editor h1').textContent), null, { timeout: 5000 });
  const stored = await page.evaluate(async () => { const r = await window.TextCraft.Store.get(window.TextCraft.state.docId); return /<h1[^>]*>([^<]*)/.exec(r.html)[1]; });
  assert.match(stored, /оновлено\) 2$/);
  // друга вкладка закрилась — перша пропонує редагувати
  await p2.close();
  await page.waitForFunction(() => /закрилась/.test(document.querySelector('.tc-lockbar').textContent), null, { timeout: 5000 });
  await page.click('.tc-lockbar-btn');
  await page.waitForFunction(() => document.getElementById('editor').isContentEditable, null, { timeout: 5000 });
});

await step('жодної помилки в консолі сторінки', async () => assert.deepEqual(errors, []));

await browser.close(); server.close();
