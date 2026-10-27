// Браузерна перевірка каталогів /tools/ і /trainers/ та старих адрес (потрібні Playwright і Chromium).
//   node tests/catalog-e2e.mjs
import assert from 'node:assert/strict';
import { startServer, launch, newPage, step } from './_harness.mjs';
import { TOOLS_SITE, TRAINERS_SITE, TOOLS, TRAINERS } from '../assets/catalog-data.js';

const server = await startServer();
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const p = await newPage(ctx, errors);
// зовнішні сайти в тесті не відкриваємо: перехоплюємо запити
for (const site of [TOOLS_SITE, TRAINERS_SITE, 'https://emulators.edvault.online/'])
  await ctx.route(site + '**', r => r.fulfill({ contentType: 'text/html', body: '<title>ok</title>' }));

await step('інструменти: усі картки в розділах, посилання на сайт інструментів, без згадок про тренажери', async () => {
  await p.goto(server.url + '/tools/');
  await p.waitForSelector('.card');
  assert.equal(await p.locator('.card').count(), TOOLS.length);
  assert.equal(await p.locator('.section').count(), 4);
  const hrefs = await p.locator('.card').evaluateAll(a => a.map(x => x.getAttribute('href')));
  assert.deepEqual(hrefs.sort(), TOOLS.map(t => TOOLS_SITE + t.file).sort());
  assert.equal(await p.locator('a[href*="trainers"]').count(), 0);
  assert.doesNotMatch(await p.textContent('body'), /[Тт]ренажер/);
});

await step('пошук і вкладки категорій', async () => {
  await p.fill('#q', 'відео');
  assert.ok(await p.locator('.card').count() >= 2);
  assert.ok(await p.locator('.card mark').count() >= 1);
  await p.fill('#q', 'щось неіснуюче');
  assert.equal(await p.isVisible('#empty'), true);
  await p.click('#emptyReset');
  await p.click('.tab[data-f="design"]');
  assert.equal(await p.locator('.card').count(), 3);
  assert.match(p.url(), /#design$/);
  await p.reload(); await p.waitForSelector('.card');
  assert.equal(await p.locator('.card').count(), 3, 'категорія з адреси');
  await p.click('.tab[data-f="all"]');
});

await step('Enter відкриває перший результат, перехід запам’ятовується в «нещодавніх»', async () => {
  await p.keyboard.press('/');
  await p.keyboard.type('голосування');
  await Promise.all([p.waitForURL(TOOLS_SITE + 'vote.html'), p.keyboard.press('Enter')]);
  await p.goto(server.url + '/tools/'); await p.waitForSelector('.card');
  assert.equal(await p.isVisible('#recent'), true);
  assert.match(await p.textContent('#recentRow'), /Голосування/);
});

await step('тренажери: картки з кількістю рівнів ведуть на сайт тренажерів', async () => {
  await p.goto(server.url + '/trainers/');
  await p.waitForSelector('.card');
  assert.equal(await p.locator('.card').count(), TRAINERS.length);
  const hrefs = await p.locator('.card').evaluateAll(a => a.map(x => x.getAttribute('href')));
  assert.deepEqual(hrefs.sort(), TRAINERS.map(t => TRAINERS_SITE + t.file).sort());
  assert.match(await p.locator('.card[data-id="robot"]').textContent(), /24 рівні/);
  assert.match(await p.textContent('#stats'), /257/);
  assert.equal(await p.locator('a[href^="/tools"]').count(), 0);
  assert.doesNotMatch(await p.textContent('body'), /Інструменти|інструментів/);
});

await step('вигляд «список» запам’ятовується', async () => {
  await p.click('#vList');
  await p.reload(); await p.waitForSelector('.card');
  const grids = await p.locator('#list .grid').count();
  assert.ok(grids > 1);
  assert.equal(await p.locator('#list .grid.list').count(), grids);
  await p.click('#vGrid');
});

await step('тренажер відкривається на своєму сайті', async () => {
  await Promise.all([p.waitForURL(TRAINERS_SITE + 'robot.html'), p.click('.card[data-id="robot"]')]);
});

await step('старі адреси перенаправляються', async () => {
  await p.goto(server.url + '/tools.html'); await p.waitForURL(/\/tools\/$/);
  await p.goto(server.url + '/tools/mouse-trainer.html'); await p.waitForURL(TRAINERS_SITE + 'mouse-trainer.html');
  await p.goto(server.url + '/tools/pen-trainer'); await p.waitForURL(TRAINERS_SITE + 'pen-trainer.html');
  await p.goto(server.url + '/trainers/robot'); await p.waitForURL(TRAINERS_SITE + 'robot.html');
  await p.goto(server.url + '/trainers/uiux-trainer.html'); await p.waitForURL(TRAINERS_SITE + 'uiux-trainer.html');
  await p.goto(server.url + '/tools-admin.html'); await p.waitForURL(/\/tools\/$/);
  // інструменти й емулятори переїхали на окремі сайти
  await p.goto(server.url + '/tools/whiteboard'); await p.waitForURL(TOOLS_SITE + 'whiteboard.html');
  await p.goto(server.url + '/emulators/windows'); await p.waitForURL('https://emulators.edvault.online/windows.html');
  await p.goto(server.url + '/emulators/startup.html'); await p.waitForURL('https://emulators.edvault.online/startup.html');
});

await step('невідома адреса — сторінка 404 лише з кнопкою «Повернутися назад»', async () => {
  await p.goto(server.url + '/trainers/');
  // перехід за зламаним посиланням з іншої сторінки сайту
  const [r] = await Promise.all([p.waitForNavigation(), p.evaluate(() => { const a = document.createElement('a'); a.href = '/немає-такої'; document.body.append(a); a.click(); })]);
  assert.equal(r.status(), 404);
  assert.match(await p.textContent('h1'), /немає/);
  assert.equal(await p.locator('a').count(), 1);
  assert.equal(await p.locator('a[href="/trainers/"], a[href="/tools/"]').count(), 0);
  await p.click('#back'); await p.waitForURL(/\/trainers\/$/);
  // відкрили напряму — кнопка веде на головну
  const q = await ctx.newPage(); await q.goto(server.url + '/немає-такої'); await q.click('#back'); await q.waitForURL(server.url + '/'); await q.close();
});

await step('жодної помилки в консолі сторінки', async () => assert.deepEqual(errors, []));

await browser.close();
server.close();
