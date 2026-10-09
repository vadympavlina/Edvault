// Браузерна перевірка «Алгоритми з роботом» (потрібні Playwright і Chromium).
//   node tests/robot-e2e.mjs
import assert from 'node:assert/strict';
import { startServer, launch, newPage, step } from './_harness.mjs';

const server = await startServer();
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, acceptDownloads: true });
const p = await newPage(ctx, errors);
await p.goto(server.url + '/trainers/robot.html');
await p.waitForFunction(() => window.RobotTrainer);
const blocks = () => p.evaluate(() => JSON.stringify(window.RobotTrainer.program.map(function s(b) { return b.t + (b.n ? b.n : '') + (b.c ? ':' + b.c : '') + (b.body ? '[' + b.body.map(s).join(',') + ']' : '') + (b.alt && b.alt.length ? '{' + b.alt.map(s).join(',') + '}' : ''); })));
const open = i => p.evaluate(i => { const T = window.RobotTrainer; T.LEVELS.slice(0, i).forEach(L => { T.progress.best[L.id] ||= { stars: 1, blocks: 99 }; }); T.openLevel(i); }, i);
const fast = () => p.fill('#speed', '5');

await step('головна: 6 розділів, відкритий лише перший рівень', async () => {
  assert.equal(await p.locator('.chapter').count(), 6);
  assert.equal(await p.locator('.lvl:not([disabled])').count(), 1);
});

await step('рівень 1: кліками додаємо «Вперед», замало — помилка з поясненням', async () => {
  await p.click('#continueBtn');
  assert.equal(await p.locator('#palette .pal').count(), 1, 'лише «Вперед»');
  for (let i = 0; i < 3; i++) await p.click('[data-add="F"]');
  await fast();
  await p.click('#runBtn');
  await p.waitForFunction(() => document.getElementById('status').classList.contains('err'), null, { timeout: 8000 });
  assert.match(await p.textContent('#status'), /не дійшов/);
});

await step('ще один крок стрілкою на клавіатурі — прапорець і три зірки', async () => {
  await p.keyboard.press('ArrowUp');
  assert.equal(await blocks(), '["F","F","F","F"]');
  await p.click('#runBtn');
  await p.waitForSelector('#result:not([hidden])', { timeout: 8000 });
  assert.equal(await p.locator('#resStars svg.on').count(), 3);
  await p.click('#resNext');
  assert.match(await p.textContent('#lvlName'), /Перший поворот/);
});

await step('стіна: робот зупиняється, блок із помилкою підсвічено', async () => {
  await p.click('[data-add="F"]'); await p.click('[data-add="F"]'); await p.click('[data-add="F"]');
  await fast(); await p.click('#runBtn');
  await p.waitForFunction(() => document.getElementById('status').classList.contains('err'), null, { timeout: 8000 });
  assert.match(await p.textContent('#status'), /стіну/);
  assert.equal(await p.locator('.blk.bad').count(), 1);
});

await step('Backspace прибирає блок, Ctrl+Z повертає', async () => {
  await p.keyboard.press('Backspace');
  assert.equal(await blocks(), '["F","F"]');
  await p.keyboard.press('Control+z');
  assert.equal(await blocks(), '["F","F","F"]');
});

await step('«Повторити» з «Вперед» усередині й лічильник повторів', async () => {
  await open(4);
  await p.click('[data-add="rep"]'); // курсор переходить усередину циклу
  await p.click('[data-add="F"]');
  for (let i = 0; i < 6; i++) await p.click('.num button[data-d="1"]');
  assert.equal(await blocks(), '["rep9[F]"]');
  await fast(); await p.click('#runBtn');
  await p.waitForSelector('#result:not([hidden])', { timeout: 10000 });
  assert.equal(await p.locator('#resStars svg.on').count(), 3);
});

await step('перетягування блоку з палітри всередину циклу', async () => {
  await open(5);
  await p.click('[data-add="rep"]');
  await p.click('.program', { position: { x: 5, y: 5 } }); // курсор у кінець програми
  await p.locator('[data-add="F"]').dragTo(p.locator('.blk-body .slot').first());
  assert.equal(await blocks(), '["rep3[F]"]');
});

await step('умова з «інакше»: правило проводить робота спіраллю', async () => {
  await open(12);
  await p.click('[data-add="rep"]'); await p.click('[data-add="if"]'); await p.click('[data-add="F"]');
  await p.click('.blk-else + .blk-body .slot');
  await p.click('[data-add="R"]');
  await p.evaluate(() => { const T = window.RobotTrainer, pr = JSON.parse(JSON.stringify(T.program)); pr[0].n = 20; T.setProgram(pr); });
  assert.equal(await blocks(), '["rep20[if:ahead[F]{R}]"]');
  await fast(); await p.click('#runBtn');
  await p.waitForSelector('#result:not([hidden])', { timeout: 20000 });
  assert.equal(await p.locator('#resStars svg.on').count(), 3);
});

await step('два лабіринти: «поки» й правило правої руки проходять обидва', async () => {
  await open(18);
  await p.click('[data-add="while"]');
  await p.click('[data-add="if"]');
  await p.selectOption('.blk .blk .cond', 'right');
  await p.click('[data-add="R"]');
  await p.evaluate(() => { const T = window.RobotTrainer, pr = JSON.parse(JSON.stringify(T.program)); pr[0].body.push({ t: 'if', c: 'ahead', body: [{ t: 'F' }], alt: [{ t: 'L' }] }); T.setProgram(pr); });
  assert.equal(await blocks(), '["while:goal[if:right[R],if:ahead[F]{L}]"]');
  assert.equal(await p.locator('#mapTabs button').count(), 2);
  await fast(); await p.click('#runBtn');
  await p.waitForSelector('#result:not([hidden])', { timeout: 60000 });
  assert.equal(await p.locator('#mapTabs i.ok').count(), 2);
});

await step('чернетка програми зберігається після перезавантаження', async () => {
  await p.reload(); await p.waitForFunction(() => window.RobotTrainer);
  await p.evaluate(() => window.RobotTrainer.openLevel(18));
  assert.equal(await blocks(), '["while:goal[if:right[R],if:ahead[F]{L}]"]');
  assert.equal(await p.evaluate(() => window.RobotTrainer.progress.best['while-3'].stars), 3);
});

await step('результати: без імені не завантажуються, з ім’ям — картинка', async () => {
  await p.click('#reportBtn');
  await p.click('#downloadReport');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'studentName');
  await p.fill('#studentName', 'Test Student');
  const dl = p.waitForEvent('download');
  await p.click('#downloadReport');
  assert.equal((await dl).suggestedFilename(), 'robot-test-student.png');
  await p.keyboard.press('Escape');
});

await step('жодної помилки в консолі сторінки', async () => assert.deepEqual(errors, []));

await browser.close();
server.close();
