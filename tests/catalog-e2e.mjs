// Браузерна перевірка каталогів /tools/ і /trainers/ та старих адрес (потрібні Playwright і Chromium).
//   node tests/catalog-e2e.mjs
import assert from 'node:assert/strict';
import { startServer, launch, newPage, step } from './_harness.mjs';
import { TOOLS, TRAINERS } from '../assets/catalog-data.js';

const server = await startServer();
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const p = await newPage(ctx, errors);

await step('інструменти: усі картки в розділах, адреси без .html, без згадок про тренажери', async () => {
  await p.goto(server.url + '/tools/');
  await p.waitForSelector('.card');
  assert.equal(await p.locator('.card').count(), TOOLS.length);
  assert.equal(await p.locator('.section').count(), 4);
  const hrefs = await p.locator('.card').evaluateAll(a => a.map(x => x.getAttribute('href')));
  assert.ok(hrefs.every(h => /^\/tools\/[\w-]+$/.test(h)), hrefs.join(' '));
  assert.equal(await p.locator('a[href^="/trainers"]').count(), 0);
  assert.doesNotMatch(await p.textContent('body'), /[Тт]ренажер/);
});

await step('кожне посилання каталогу відкриває свою сторінку', async () => {
  for (const [kind, list] of [['tools', TOOLS], ['trainers', TRAINERS]]) {
    for (const t of list) {
      const r = await p.request.get(`${server.url}/${kind}/${t.file.replace(/\.html$/, '')}`);
      assert.equal(r.status(), 200, t.file);
      assert.match(await r.text(), /<title>/, t.file);
    }
  }
});

await step('пошук і вкладки категорій', async () => {
  await p.fill('#q', 'відео');
  assert.ok(await p.locator('.card').count() >= 2);
  assert.ok(await p.locator('.card mark').count() >= 1);
  await p.fill('#q', 'щось неіснуюче');
  assert.equal(await p.isVisible('#empty'), true);
  await p.click('#emptyReset');
  await p.click('.tab[data-f="design"]');
  assert.equal(await p.locator('.card').count(), 2);
  assert.match(p.url(), /#design$/);
  await p.reload(); await p.waitForSelector('.card');
  assert.equal(await p.locator('.card').count(), 2, 'категорія з адреси');
  await p.click('.tab[data-f="all"]');
});

await step('Enter відкриває перший результат, перехід запам’ятовується в «нещодавніх»', async () => {
  await p.keyboard.press('/');
  await p.keyboard.type('голосування');
  await Promise.all([p.waitForURL(/\/tools\/vote$/), p.keyboard.press('Enter')]);
  await p.goto(server.url + '/tools/'); await p.waitForSelector('.card');
  assert.equal(await p.isVisible('#recent'), true);
  assert.match(await p.textContent('#recentRow'), /Голосування/);
});

await step('тренажери: прогрес зі сховища кожного тренажера', async () => {
  await p.evaluate(() => {
    localStorage.setItem('edvault-robot', JSON.stringify({ best: { 'seq-1': { stars: 3 }, 'seq-2': { stars: 2 } } }));
    localStorage.setItem('edvault-typing', JSON.stringify({ best: { uk: { a: { stars: 3 } }, en: { b: { stars: 1 } } } }));
  });
  await p.goto(server.url + '/trainers/');
  await p.waitForSelector('.card');
  assert.equal(await p.locator('.card').count(), TRAINERS.length);
  const robot = p.locator('.card[data-id="robot"]');
  assert.match(await robot.textContent(), /5 \/ 72/);
  assert.match(await robot.textContent(), /2 з 24/);
  assert.match(await robot.textContent(), /Продовжити/);
  assert.match(await p.locator('.card[data-id="typing-trainer"]').textContent(), /4 \/ 153/);
  assert.match(await p.locator('.card[data-id="pen-trainer"]').textContent(), /Почати/);
  assert.match(await p.textContent('#stats'), /9/);
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

await step('тренажер відкривається за адресою без .html', async () => {
  await Promise.all([p.waitForURL(/\/trainers\/robot$/), p.click('.card[data-id="robot"]')]);
  await p.waitForFunction(() => window.RobotTrainer);
  assert.equal(await p.locator('.chapter').count(), 6);
});

await step('старі адреси перенаправляються', async () => {
  await p.goto(server.url + '/tools.html'); await p.waitForURL(/\/tools\/$/);
  await p.goto(server.url + '/tools/mouse-trainer.html'); await p.waitForURL(/\/trainers\/mouse-trainer$/);
  await p.waitForFunction(() => window.MouseTrainer);
  await p.goto(server.url + '/tools/pen-trainer'); await p.waitForURL(/\/trainers\/pen-trainer$/);
  await p.goto(server.url + '/tools-admin.html'); await p.waitForURL(/\/tools\/$/);
});

await step('невідома адреса — сторінка 404 з посиланнями', async () => {
  const r = await p.goto(server.url + '/немає-такої');
  assert.equal(r.status(), 404);
  assert.match(await p.textContent('h1'), /немає/);
  assert.equal(await p.locator('a[href="/trainers/"]').count(), 1);
});

await step('жодної помилки в консолі сторінки', async () => assert.deepEqual(errors, []));

await browser.close();
server.close();
