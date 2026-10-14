// Браузерна перевірка вайтборда: сторінка вміщається в екран, олівець і Ctrl+Z, фігури, стікер і текст
// (клік поза ними лише завершує набір), нумерація, виділення й видалення, сторінки, збереження PNG,
// автозбереження після перезавантаження, презентація, телефон.
//   node tests/whiteboard-e2e.mjs
import assert from 'node:assert/strict';
import { startServer, launch, newPage, step } from './_harness.mjs';

const server = await startServer();
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const p = await newPage(ctx, errors);
p.setDefaultTimeout(10000);
// pdf.js вантажиться з CDN: у тестовому середовищі мережі немає — такі помилки не про дошку
const ownErrors = () => errors.filter(e => !/cdnjs|pdf\.js|pdfjs|ERR_TUNNEL|Failed to load resource/i.test(e));
await p.goto(server.url + '/tools/whiteboard');
await p.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('edvault-whiteboard'); });
await p.reload();
await p.waitForFunction(() => window.Whiteboard && window.Whiteboard.getActivePage());
const page = () => p.evaluate(() => { const g = window.Whiteboard.getActivePage(); return { strokes: g.strokes.length, objects: g.objects.map(o => ({ type: o.type, text: o.text, n: o.value })), tool: window.Whiteboard.state.tool, pages: window.Whiteboard.state.pages.length }; });
let box;
const P = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
const stroke = async (pts) => { await p.mouse.move(...P(...pts[0])); await p.mouse.down(); for (const q of pts.slice(1)) await p.mouse.move(...P(...q), { steps: 6 }); await p.mouse.up(); };

await step('сторінка вміщається в екран одразу після відкриття', async () => {
  box = await p.locator('.page-stage').first().boundingBox();
  const vp = await p.locator('#canvasViewport').boundingBox();
  assert.ok(box.x >= vp.x && box.x + box.width <= vp.x + vp.width, 'сторінка видна повністю по ширині');
  assert.ok(box.y >= vp.y && box.y + box.height <= vp.y + vp.height, 'і по висоті');
});

await step('олівець малює, Ctrl+Z і Ctrl+Shift+Z', async () => {
  await p.keyboard.press('p');
  await stroke([[.1, .2], [.2, .3], [.3, .2]]);
  assert.equal((await page()).strokes, 1);
  await p.keyboard.press('Control+z');
  assert.equal((await page()).strokes, 0);
  await p.keyboard.press('Control+Shift+z');
  assert.equal((await page()).strokes, 1);
});

await step('прямокутник і стрілка', async () => {
  await p.keyboard.press('r'); await stroke([[.4, .15], [.6, .35]]);
  await p.keyboard.press('a'); await stroke([[.75, .5], [.62, .3]]);
  const t = (await page()).objects.map(o => o.type);
  assert.deepEqual(t, ['rect', 'arrow']);
});

await step('стікер: клік поза ним лише завершує набір, нового стікера не з’являється', async () => {
  await p.keyboard.press('s');
  await p.mouse.click(...P(.7, .6));
  await p.keyboard.type('Не забути домашнє!');
  await p.mouse.click(...P(.3, .8));
  let s = await page();
  assert.equal(s.objects.filter(o => o.type === 'sticky').length, 1);
  assert.equal(s.objects.find(o => o.type === 'sticky').text, 'Не забути домашнє!');
  assert.equal(await p.locator('.canvas-edit-box').count(), 0, 'жодного відкритого поля');
  await p.keyboard.press('t'); // літера йде в перемикання інструмента, а не в стікер
  assert.equal((await page()).tool, 'text');
});

await step('текст: Ctrl+Enter завершує', async () => {
  await p.mouse.click(...P(.1, .6));
  await p.keyboard.type('Площа = a × b');
  await p.keyboard.press('Control+Enter');
  const tx = (await page()).objects.find(o => o.type === 'text');
  assert.equal(tx.text, 'Площа = a × b');
});

await step('нумерація ставить 1, 2', async () => {
  await p.keyboard.press('n');
  await p.mouse.click(...P(.42, .5)); await p.mouse.click(...P(.5, .5));
  assert.deepEqual((await page()).objects.filter(o => o.type === 'number').map(o => o.n), [1, 2]);
});

await step('виділення рамкою й видалення', async () => {
  await p.keyboard.press('v');
  await stroke([[.38, .45], [.55, .56]]); // рамка навколо двох номерів
  const sel = await p.evaluate(() => window.Whiteboard.getActivePage().selectedIds.length);
  assert.equal(sel, 2);
  await p.keyboard.press('Delete');
  assert.equal((await page()).objects.filter(o => o.type === 'number').length, 0);
  await p.keyboard.press('Control+z');
  assert.equal((await page()).objects.filter(o => o.type === 'number').length, 2);
});

await step('нова сторінка й перемикання', async () => {
  await p.click('#stripAdd');
  assert.equal((await page()).pages, 2);
  assert.equal((await page()).objects.length, 0, 'нова сторінка порожня');
  await p.click('.page-pill >> nth=0');
  assert.ok((await page()).objects.length >= 5);
});

await step('збереження PNG сторінки', async () => {
  await p.click('#btnExport');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-export="png"]')]);
  assert.match(dl.suggestedFilename(), /^doshka-storinka-1-.*\.png$/);
});

await step('автозбереження: після перезавантаження все на місці', async () => {
  const before = await page();
  await p.evaluate(() => window.Whiteboard.Persist.save());
  await p.reload();
  await p.waitForFunction(() => window.Whiteboard && window.Whiteboard.getActivePage());
  const after = await page();
  assert.equal(after.pages, 2);
  assert.equal(after.strokes, before.strokes);
  assert.deepEqual(after.objects.map(o => o.type).sort(), before.objects.map(o => o.type).sort());
});

await step('презентація: вхід і вихід Esc', async () => {
  await p.click('#btnPresent');
  assert.ok(await p.evaluate(() => document.querySelector('.app').classList.contains('presentation-mode') || document.body.classList.contains('presentation-mode')));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  assert.ok(!(await p.evaluate(() => document.querySelector('.app').classList.contains('presentation-mode') || document.body.classList.contains('presentation-mode'))));
});

await step('телефон: без горизонтальної прокрутки сторінки, аркуш видно цілком', async () => {
  const q = await newPage(await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), errors);
  await q.goto(server.url + '/tools/whiteboard');
  await q.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('edvault-whiteboard'); });
  await q.reload();
  await q.waitForFunction(() => window.Whiteboard && window.Whiteboard.getActivePage());
  assert.equal(await q.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  const b = await q.locator('.page-stage').first().boundingBox();
  assert.ok(b.x >= 0 && b.x + b.width <= 390, 'аркуш уміщається по ширині');
  await q.context().close();
});

await step('жодної помилки в консолі', async () => assert.deepEqual(ownErrors(), []));

await browser.close(); server.close();
