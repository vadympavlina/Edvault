// Браузерна перевірка тренажера «Колір на око» (потрібні Playwright і Chromium).
//   node tests/colortrainer-e2e.mjs
import assert from 'node:assert/strict';
import { startServer, launch, newPage, step } from './_harness.mjs';

const server = await startServer();
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, acceptDownloads: true });
const p = await newPage(ctx, errors);
await p.goto(server.url + '/trainers/color-trainer.html');
await p.waitForFunction(() => window.ColorTrainer);

const open = async id => {
  await p.evaluate(id => { const T = window.ColorTrainer, i = T.LEVELS.findIndex(l => l.id === id); T.LEVELS.slice(0, i).forEach(L => { T.progress.best[L.id] ||= { acc: 70, stars: 1 }; }); T.openLevel(i); }, id);
  await p.waitForSelector('#play:not([hidden])');
};
const fb = () => p.evaluate(() => ({ acc: parseInt(document.getElementById('fbAcc').textContent), tips: document.getElementById('fbTips').textContent }));
// точна відповідь через повзунки: виставляємо колір зразка
const answer = () => p.evaluate(() => { const T = window.ColorTrainer; T.setUser(T.round.targets[0]); });

await step('головна: 7 розділів, відкритий лише перший рівень', async () => {
  assert.equal(await p.locator('.chapter').count(), 7);
  assert.equal(await p.locator('.lvl:not([disabled])').count(), 1);
  assert.match(await p.textContent('#continueBtn'), /Почати: рівень 1/);
});

await step('відтінок: повзунок змінює колір, підказки лише про відтінок', async () => {
  await p.click('#continueBtn');
  // клік навпроти загаданого відтінку — свідомо погана відповідь
  const target = await p.evaluate(() => window.ColorTrainer.round.target.h);
  const bb = await p.locator('.hue-bar').boundingBox();
  await p.mouse.click(bb.x + bb.width * ((target / 360 + 0.5) % 1), bb.y + 13);
  const after = await p.evaluate(() => window.ColorTrainer.user);
  const arc = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
  assert.ok(arc(after.h, target) > 150, `відтінок ${after.h} мав стати протилежним до ${target}`);
  await p.keyboard.press('Enter');
  const f = await fb();
  assert.ok(f.acc < 60);
  assert.doesNotMatch(f.tips, /темніше|світліше|насичен/);
});

await step('три раунди: середня оцінка; правильні відповіді — 100% і три зірки, відкривається наступний рівень', async () => {
  await p.keyboard.press('Enter'); // наступний раунд
  for (let k = 0; k < 2; k++) { await answer(); await p.keyboard.press('Enter'); assert.equal((await fb()).acc, 100); await p.keyboard.press('Enter'); }
  await p.waitForSelector('#result:not([hidden])');
  assert.ok(+(await p.textContent('#resAcc')) < 100, 'середнє з одним поганим раундом — менше 100');
  assert.ok(await p.locator('#resStars svg.on').count() < 3);
  await p.click('#resRetry');
  for (let k = 0; k < 3; k++) { await answer(); await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); }
  await p.waitForSelector('#result:not([hidden])');
  assert.equal(await p.textContent('#resAcc'), '100');
  assert.equal(await p.locator('#resStars svg.on').count(), 3);
  assert.equal(await p.isEnabled('#resNext'), true);
});

await step('квадрат насиченості й яскравості: клік ставить потрібну точку', async () => {
  await open('sb-1');
  const bb = await p.locator('.sbq').boundingBox();
  await p.mouse.click(bb.x + bb.width * 0.8, bb.y + bb.height * 0.25);
  const u = await p.evaluate(() => window.ColorTrainer.user);
  assert.ok(Math.abs(u.s - 80) < 2 && Math.abs(u.b - 75) < 2, JSON.stringify(u));
});

await step('RGB: поле з числом змінює колір', async () => {
  await open('rgb-1');
  for (const [k, v] of [['R', '255'], ['G', '128'], ['B', '0']]) await p.fill(`input[aria-label="${k}"]`, v);
  const hex = await p.evaluate(async () => { const c = await import('./colortrainer/js/color.js'); return c.toHex(c.hsbToRgb(window.ColorTrainer.user)); });
  assert.equal(hex, '#FF8000');
});

await step('знайдіть колір: вибір на око, без вибору не перевіряє, клавіші, підсвітка відповіді; зайва плитка', async () => {
  await open('hex-1');
  assert.equal(await p.locator('.pick-opt').count(), 4);
  assert.equal(await p.locator('#swatches').isHidden(), true);
  assert.equal(await p.locator('.pick-ask').count(), 1);
  await p.keyboard.press('Enter');
  assert.equal(await p.isHidden('#feedback'), true, 'без вибору не перевіряє');
  const T = () => p.evaluate(() => window.ColorTrainer.round);
  const r = await T();
  await p.keyboard.press(String((r.answer + 1) % 4 + 1));
  assert.equal(await p.locator('.pick-opt.sel').count(), 1);
  await p.keyboard.press('Enter');
  assert.equal(await p.textContent('#fbAcc'), 'Не той');
  assert.equal(await p.locator('.pick-opt.ok').count(), 1); assert.equal(await p.locator('.pick-opt.bad').count(), 1);
  await p.keyboard.press('Enter');
  for (let k = 1; k < 5; k++) {
    const rr = await T();
    await p.click(`.pick-opt[data-pick="${rr.answer}"]`);
    await p.keyboard.press('Enter');
    assert.equal(await p.textContent('#fbAcc'), 'Правильно');
    await p.keyboard.press('Enter');
  }
  await p.waitForSelector('#result:not([hidden])');
  assert.equal(await p.textContent('#resAcc'), '80');
  assert.equal(await p.locator('#resStars svg.on').count(), 2);
  await open('hex-3');
  assert.equal(await p.locator('.pick.odd .pick-opt').count(), 9);
  const o = await T();
  await p.click(`.pick-opt[data-pick="${o.answer}"]`); await p.keyboard.press('Enter');
  assert.equal(await p.textContent('#fbAcc'), 'Правильно');
});

await step('гармонія: правильний відтінок на колі — 100%', async () => {
  await open('harm-2');
  assert.equal(await p.locator('.wheel').count(), 1);
  await p.evaluate(() => { const T = window.ColorTrainer; T.setUser(T.round.targets[1]); }); // будь-який із двох у тріаді
  await p.keyboard.press('Enter');
  assert.equal((await fb()).acc, 100);
});

await step('по пам’яті: зразок ховається після відліку', async () => {
  await open('hsb-4');
  assert.match(await p.textContent('#swCover'), /2/);
  await p.waitForFunction(() => /\?/.test(document.getElementById('swCover').textContent), null, { timeout: 4000 });
});

await step('по порядку: перетягування плиток і оцінка', async () => {
  await open('ord-1');
  const n = await p.locator('.tile').count();
  // розставляємо правильно перетягуванням: щоразу беремо потрібну плитку й кладемо на її місце
  for (let pos = 1; pos < n - 1; pos++) {
    const from = await p.evaluate(pos => window.ColorTrainer.order.indexOf(pos), pos);
    if (from === pos) continue;
    const a = await p.locator('.tile').nth(from).boundingBox(), b = await p.locator('.tile').nth(pos).boundingBox();
    await p.mouse.move(a.x + a.width / 2, a.y + 30); await p.mouse.down();
    await p.mouse.move(b.x + b.width / 2, b.y + 30, { steps: 10 }); await p.mouse.up();
  }
  assert.deepEqual(await p.evaluate(() => window.ColorTrainer.order), Array.from({ length: n }, (_, i) => i));
  await p.keyboard.press('Enter');
  assert.equal((await fb()).acc, 100);
  assert.equal(await p.locator('.tile.ok').count(), n);
});

await step('прогрес зберігається після перезавантаження', async () => {
  await p.reload(); await p.waitForFunction(() => window.ColorTrainer);
  const b = await p.evaluate(() => window.ColorTrainer.progress.best['hue-1']);
  assert.ok(b && b.stars === 3 && b.pairs.length === 3);
});

await step('результати: без імені не завантажуються, з ім’ям — картинка', async () => {
  await p.click('#reportBtn');
  await p.click('#downloadReport');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'studentName');
  await p.fill('#studentName', 'Test Student');
  const dl = p.waitForEvent('download');
  await p.click('#downloadReport');
  assert.equal((await dl).suggestedFilename(), 'color-trainer-test-student.png');
  await p.keyboard.press('Escape');
});

await step('жодної помилки в консолі сторінки', async () => assert.deepEqual(errors, []));

await browser.close();
server.close();
