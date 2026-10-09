// Браузерна перевірка «Мишка й точність» (потрібні Playwright і Chromium).
//   node tests/mouse-e2e.mjs
import assert from 'node:assert/strict';
import { startServer, launch, newPage, step } from './_harness.mjs';

const server = await startServer();
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, acceptDownloads: true });
const p = await newPage(ctx, errors);
await p.goto(server.url + '/tools/mouse-trainer.html');
await p.waitForFunction(() => window.MouseTrainer);

const open = i => p.evaluate(i => { const T = window.MouseTrainer; T.LEVELS.slice(0, i).forEach(L => { T.progress.best[L.id] ||= { stars: 1, time: 99, misses: 9, acc: 50 }; }); T.openLevel(i); }, i);
const center = async loc => { await p.waitForTimeout(170); const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const game = () => p.evaluate(() => { const G = window.MouseTrainer.game; return { hits: G.hits, misses: G.misses, total: G.total, done: !!G.done }; });
const waitResult = () => p.waitForSelector('#result:not([hidden])', { timeout: 15000 });
const litStars = () => p.locator('#resStars svg.on').count();
// точка поля, де гарантовано немає цілі
async function emptySpot() {
  const f = await p.locator('#field').boundingBox(), t = await center(p.locator('.tg').first());
  return { x: t.x < f.x + f.width / 2 ? f.x + f.width - 30 : f.x + 30, y: t.y < f.y + f.height / 2 ? f.y + f.height - 30 : f.y + 30 };
}

await step('головна: 6 розділів по 4 рівні, відкритий лише перший', async () => {
  assert.equal(await p.locator('.chapter').count(), 6);
  assert.equal(await p.locator('.lvl').count(), 24);
  assert.equal(await p.locator('.lvl:not([disabled])').count(), 1);
});

await step('клацання: промах повз кульку рахується, Esc зупиняє гру', async () => {
  await p.click('#continueBtn');
  assert.equal(await p.isVisible('#startOv'), true);
  await p.click('#startBtn');
  const s = await emptySpot();
  await p.mouse.click(s.x, s.y);
  assert.equal((await game()).misses, 1);
  assert.equal(await p.textContent('#hudMiss'), '1');
  await p.keyboard.press('Escape');
  assert.equal(await p.isVisible('#startOv'), true);
  assert.equal(await p.locator('.tg').count(), 0);
});

await step('клацання: шість кульок — три зірки й наступний рівень', async () => {
  await p.keyboard.press('Enter');
  for (let i = 0; i < 6; i++) { const c = await center(p.locator('.tg').first()); await p.mouse.click(c.x, c.y); }
  await waitResult();
  assert.equal(await litStars(), 3);
  assert.equal(await p.textContent('#resAcc'), '100%');
  await p.click('#resNext');
  assert.match(await p.textContent('#lvlName'), /Менші кульки/);
});

await step('рухомі кульки наздоганяються й лопаються', async () => {
  await open(3); await p.click('#startBtn');
  for (let i = 0; i < 8; i++) { const c = await center(p.locator('.tg').first()); await p.mouse.click(c.x, c.y); }
  await waitResult();
  assert.ok((await game()).misses <= 1);
});

await step('подвійне клацання: одне клацання — промах, два — ціль', async () => {
  await open(4); await p.click('#startBtn');
  let c = await center(p.locator('.tg').first());
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(800);
  assert.equal((await game()).misses, 1);
  for (let i = 0; i < 5; i++) { c = await center(p.locator('.tg').first()); await p.mouse.dblclick(c.x, c.y); }
  await waitResult();
  assert.equal((await game()).hits, 5);
});

await step('ліва чи права: кнопка за значком на цілі, без промахів', async () => {
  await open(10); await p.click('#startBtn');
  const needs = new Set();
  for (let i = 0; i < 10; i++) {
    const t = p.locator('.tg').first(), need = await t.getAttribute('data-need'), c = await center(t);
    needs.add(need);
    await p.mouse.click(c.x, c.y, { button: need === 'R' ? 'right' : 'left' });
  }
  await waitResult();
  assert.equal((await game()).misses, 0);
  assert.ok(needs.size === 2, 'трапляються обидві кнопки');
});

await step('контекстне меню: права кнопка відкриває меню, колір — як у рамки', async () => {
  await open(11); await p.click('#startBtn');
  for (let i = 0; i < 5; i++) {
    const t = p.locator('.tg').first(), want = await t.getAttribute('data-want'), c = await center(t);
    await p.mouse.click(c.x, c.y, { button: 'right' });
    await p.waitForSelector('.ctx');
    if (i === 0) { await p.click(`.ctx-item[data-color]:not([data-color="${want}"])`); assert.equal((await game()).misses, 1); }
    await p.click(`.ctx-item[data-color="${want}"]`);
    await p.waitForTimeout(250);
  }
  await waitResult();
  assert.equal((await game()).hits, 5);
});

async function dragTo(from, to) {
  await p.mouse.move(from.x, from.y); await p.mouse.down();
  for (let k = 1; k <= 8; k++) await p.mouse.move(from.x + (to.x - from.x) * k / 8, from.y + (to.y - from.y) * k / 8);
  await p.mouse.up();
}
await step('перетягування: чужий контур — промах і фігура повертається', async () => {
  await open(12); await p.click('#startBtn');
  const k = await p.locator('.item').first().getAttribute('data-k'), it = p.locator(`.item[data-k="${k}"]`), home = await center(it);
  await dragTo(home, await center(p.locator(`.slot-sh:not([data-k="${k}"])`).first()));
  assert.equal((await game()).misses, 1);
  await p.waitForTimeout(300);
  const back = await center(it);
  assert.ok(Math.hypot(back.x - home.x, back.y - home.y) < 2, JSON.stringify([home, back]));
});

await step('перетягування: вісім дрібних фігур точно в контури', async () => {
  await open(15); await p.click('#startBtn');
  for (let i = 0; i < 8; i++) {
    const it = p.locator('.item:not(.placed)').first(), k = await it.getAttribute('data-k');
    await dragTo(await center(it), await center(p.locator(`.slot-sh[data-k="${k}"]`)));
  }
  await waitResult();
  assert.equal(await p.locator('.item.placed').count(), 8);
  assert.equal((await game()).misses, 0);
});

await step('рамка: частина зірок — промах, усі без камінців — раунд зараховано', async () => {
  await open(18); await p.click('#startBtn');
  const f = await p.locator('#field').boundingBox();
  for (let i = 0; i < 4; i++) {
    const r = await p.evaluate(() => window.MouseTrainer.game.mq.rect);
    if (i === 0) { await dragTo({ x: f.x + r.x, y: f.y + r.y }, { x: f.x + r.x + 5, y: f.y + r.y + 5 }); assert.equal((await game()).misses, 0, 'крихітна рамка — не промах'); }
    if (i === 0) { await dragTo({ x: f.x + r.x, y: f.y + r.y }, { x: f.x + r.x + r.w / 2, y: f.y + r.y + r.h / 2 }); }
    await dragTo({ x: f.x + r.x, y: f.y + r.y }, { x: f.x + r.x + r.w, y: f.y + r.y + r.h });
    await p.waitForTimeout(650);
  }
  await waitResult();
  const g = await game();
  assert.equal(g.hits, 4); assert.ok(g.misses <= 1);
});

async function scrollAndClick(sel) {
  const f = await p.locator('#field').boundingBox();
  await p.mouse.move(f.x + f.width / 2, f.y + f.height / 2);
  for (let k = 0; k < 60; k++) {
    const b = await p.locator(sel).boundingBox();
    if (b.y > f.y + 10 && b.y + b.height < f.y + f.height - 10) break;
    await p.mouse.wheel(0, b.y < f.y ? -250 : 250);
    await p.waitForTimeout(60);
  }
  const c = await center(p.locator(sel));
  await p.mouse.click(c.x, c.y);
}
await step('прокручування: стрілка підказує, зірки знаходяться коліщатком', async () => {
  await open(21); await p.click('#startBtn');
  assert.equal(await p.isVisible('.sc-arrow'), true);
  for (let i = 0; i < 5; i++) await scrollAndClick('.sc-star');
  await waitResult();
  assert.equal((await game()).misses, 0);
});

await step('будинок за номером: чужий будинок — промах із підказкою', async () => {
  await open(23); await p.click('#startBtn');
  for (let i = 0; i < 4; i++) {
    const n = await p.evaluate(() => window.MouseTrainer.game.want);
    assert.match(await p.textContent('#taskText'), new RegExp('№ ' + n));
    if (i === 0) { await p.locator('.house').filter({ hasNotText: new RegExp(`^${n}$`) }).first().click(); assert.equal((await game()).misses, 1); }
    await scrollAndClick(`.house[data-n="${n}"]`);
  }
  await waitResult();
  assert.equal((await game()).hits, 4);
});

await step('прогрес зберігається після перезавантаження', async () => {
  await p.goto(server.url + '/tools/mouse-trainer.html'); await p.waitForFunction(() => window.MouseTrainer);
  assert.equal(await p.evaluate(() => window.MouseTrainer.progress.best['click-1'].stars), 3);
  assert.ok(await p.locator('.lvl.perfect').count() >= 1);
});

await step('результати: без імені не завантажуються, з ім’ям — картинка', async () => {
  await p.click('#reportBtn');
  await p.click('#downloadReport');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'studentName');
  await p.fill('#studentName', 'Test Student');
  const dl = p.waitForEvent('download');
  await p.click('#downloadReport');
  assert.equal((await dl).suggestedFilename(), 'mouse-test-student.png');
  await p.keyboard.press('Escape');
});

await step('жодної помилки в консолі сторінки', async () => assert.deepEqual(errors, []));

await browser.close();
server.close();
