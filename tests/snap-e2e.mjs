// Браузерна перевірка SnapEdit (редактор скріншотів): відкриття, стрілка мишкою, текст, кроки й перенумерація,
// гумка, підсвічування, рамка в експорті, обрізання, скасування, збереження PNG, відновлення роботи, телефон.
//   node tests/snap-e2e.mjs
import assert from 'node:assert/strict';
import { startServer, launch, newPage, step } from './_harness.mjs';

const server = await startServer();
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const p = await newPage(ctx, errors);
p.setDefaultTimeout(10000);
await p.goto(server.url + '/tools/snap-editor');
await p.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('edvault-snapedit'); });
await p.reload();
const S = () => p.evaluate(() => JSON.parse(JSON.stringify({ objects: window.SnapEdit.S.objects, doc: window.SnapEdit.S.doc, frame: window.SnapEdit.S.frame, tool: window.SnapEdit.S.tool })));
// точка зображення → точка на екрані
const at = (x, y) => p.evaluate(([x, y]) => { const v = window.SnapEdit.S.view, r = document.getElementById('viewport').getBoundingClientRect(); return [r.left + v.x + x * v.z, r.top + v.y + y * v.z]; }, [x, y]);
const drag = async (a, b) => { const [x0, y0] = await at(...a), [x1, y1] = await at(...b); await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 }); await p.mouse.move(x1, y1, { steps: 4 }); await p.mouse.up(); };
const click = async (x, y) => { const [a, b] = await at(x, y); await p.mouse.click(a, b); };

await step('порожній стан і відкриття зображення перетягуванням', async () => {
  await p.waitForSelector('#empty:not(.hidden)');
  await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 800; c.height = 500; const g = c.getContext('2d');
    g.fillStyle = '#eef1f5'; g.fillRect(0, 0, 800, 500); g.fillStyle = '#2563eb'; g.fillRect(300, 300, 200, 50);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'shot.png', { type: 'image/png' }));
    document.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await p.waitForSelector('#empty.hidden', { state: 'attached' });
  const s = await S();
  assert.deepEqual([s.doc.w, s.doc.h], [800, 500]);
  assert.match(await p.locator('#toast').innerText(), /shot\.png/);
});

await step('стрілка мишкою, колір із панелі', async () => {
  await p.keyboard.press('KeyA');
  await p.click('#propbar [data-p="color"][data-v="#3b82f6"]');
  await drag([100, 100], [300, 200]);
  const a = (await S()).objects.find(o => o.type === 'arrow');
  assert.ok(a); assert.equal(a.color, '#3b82f6');
  assert.ok(Math.abs(a.x1 - 100) < 2 && Math.abs(a.y2 - 200) < 2);
  assert.equal(await p.getAttribute('#propbar [data-p="color"][data-v="#3b82f6"]', 'aria-label'), 'Синій');
});

await step('текст: клік і набір, підпис біля краю не вилазить за зображення', async () => {
  await p.keyboard.press('KeyT');
  await click(780, 60);
  await p.keyboard.type('Натисніть тут');
  await p.keyboard.press('Enter');
  const t = (await S()).objects.find(o => o.type === 'text');
  assert.equal(t.text, 'Натисніть тут');
  const w = await p.evaluate(() => { const o = window.SnapEdit.S.objects.find(x => x.type === 'text'); const c = document.createElement('canvas').getContext('2d'); c.font = '700 ' + o.size + 'px Commissioner'; return c.measureText(o.text).width; });
  assert.ok(t.x + w <= 800, 'текст у межах зображення');
});

await step('нумерація кроків і перенумерація після видалення', async () => {
  await p.keyboard.press('KeyN');
  await click(100, 300); await click(200, 300); await click(300, 420);
  let steps = (await S()).objects.filter(o => o.type === 'step').map(o => o.n);
  assert.deepEqual(steps, [1, 2, 3]);
  await p.keyboard.press('KeyV');
  await click(200, 300);
  await p.keyboard.press('Delete');
  steps = (await S()).objects.filter(o => o.type === 'step').map(o => o.n);
  assert.deepEqual(steps, [1, 2], 'після видалення другого кроку третій став другим');
  await p.keyboard.press('KeyN');
  await click(400, 420);
  assert.deepEqual((await S()).objects.filter(o => o.type === 'step').map(o => o.n), [1, 2, 3]);
});

await step('гумка прибирає позначку, Ctrl+Z повертає', async () => {
  const n0 = (await S()).objects.length;
  await p.keyboard.press('KeyX');
  await drag([195, 145], [205, 155]);
  assert.equal((await S()).objects.length, n0 - 1);
  await p.keyboard.press('Control+KeyZ');
  assert.equal((await S()).objects.length, n0);
  await p.keyboard.press('Control+Shift+KeyZ');
  assert.equal((await S()).objects.length, n0 - 1);
});

await step('підсвічування: решта зображення темніє', async () => {
  await p.keyboard.press('KeyF');
  assert.match(await p.locator('#propbar').innerText(), /Підсвітити[\s\S]*Затемнення/);
  await drag([280, 280], [520, 370]);
  const sp = (await S()).objects.find(o => o.type === 'spot');
  assert.ok(sp && sp.w > 200);
  const px = await p.evaluate(() => { const c = window.SnapEdit.exportCanvas().getContext('2d'); return [Array.from(c.getImageData(20, 450, 1, 1).data), Array.from(c.getImageData(400, 320, 1, 1).data)]; });
  assert.ok(px[0][0] < 150, 'поза ділянкою темно'); assert.deepEqual(px[1].slice(0, 3), [37, 99, 235], 'усередині — без змін');
});

await step('рамка: поля, тло й заокруглення потрапляють в експорт', async () => {
  await p.click('[data-act="frame"]');
  await p.click('#pop [data-f="pad"][data-fv="m"]');
  await p.click('#pop [data-f="bg"][data-fv="white"]');
  const s = await S();
  assert.equal(s.frame.pad, 'm');
  const r = await p.evaluate(() => { const c = window.SnapEdit.exportCanvas(); return { w: c.width, h: c.height, corner: Array.from(c.getContext('2d').getImageData(2, 2, 1, 1).data) }; });
  assert.equal(r.w, 800 + 2 * 35); assert.equal(r.h, 500 + 2 * 35);
  assert.deepEqual(r.corner, [255, 255, 255, 255]);
  assert.ok(await p.evaluate(() => document.getElementById('scene').classList.contains('framed')));
  await p.keyboard.press('Escape');
  await p.keyboard.press('Control+KeyZ'); // рамку можна скасувати
  assert.equal((await S()).frame.bg, 'paper');
  await p.keyboard.press('Control+Shift+KeyZ');
});

await step('збереження PNG і відновлення роботи після перезавантаження', async () => {
  const [dl] = await Promise.all([p.waitForEvent('download'), p.keyboard.press('Control+KeyS')]);
  assert.match(dl.suggestedFilename(), /^snapedit-\d{4}-\d{2}-\d{2}-\d{4}\.png$/);
  const before = await S();
  await p.evaluate(() => window.SnapEdit.saveSession());
  await p.reload();
  await p.waitForFunction(() => window.SnapEdit && window.SnapEdit.S.doc);
  const after = await S();
  assert.equal(after.objects.length, before.objects.length);
  assert.deepEqual(after.frame, before.frame, 'рамка теж відновлюється');
});

await step('обрізання зсуває позначки', async () => {
  const a0 = (await S()).objects.find(o => o.type === 'step');
  await p.keyboard.press('KeyC');
  await p.evaluate(() => { window.SnapEdit.S.crop = { x: 50, y: 40, w: 600, h: 400 }; });
  await p.keyboard.press('Enter');
  const s = await S();
  assert.deepEqual([s.doc.w, s.doc.h], [600, 400]);
  const a = s.objects.find(o => o.type === 'step');
  assert.equal(a.x, a0.x - 50); assert.equal(a.y, a0.y - 40);
});

await step('телефон: без горизонтальної прокрутки, інструменти внизу', async () => {
  const q = await newPage(await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), errors);
  await q.goto(server.url + '/tools/snap-editor');
  await q.waitForSelector('#rail');
  assert.equal(await q.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  const r = await q.locator('#rail').boundingBox();
  assert.ok(r.y > 700, 'панель інструментів унизу');
  await q.context().close();
});

await step('жодної помилки в консолі', async () => assert.deepEqual(errors, []));

await browser.close(); server.close();
