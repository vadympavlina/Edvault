// Браузерна перевірка «Мережі» (потрібні Playwright і Chromium).
//   node tests/network-e2e.mjs
import assert from 'node:assert/strict';
import { startServer, launch, newPage, step } from './_harness.mjs';

const server = await startServer();
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, acceptDownloads: true });
const p = await newPage(ctx, errors);
await p.goto(server.url + '/trainers/network-trainer');
await p.waitForFunction(() => window.NetworkTrainer);

const T = fn => p.evaluate(fn);
const open = i => p.evaluate(i => { const T = window.NetworkTrainer; T.LEVELS.slice(0, i).forEach(L => { T.progress.best[L.id] ||= { stars: 1, pct: 50 }; }); T.openLevel(i); }, i);
const start = async i => { await open(i); await p.click('#goBtn'); };
// точка пристрою (або порту роутера) на екрані
async function at(ep) {
  const box = await p.locator('#board').boundingBox();
  const pos = await p.evaluate(ep => { const T = window.NetworkTrainer, [id, port] = ep.split(':'), d = T.net.devices.find(x => x.id === id);
    if (!port) return { x: d.x, y: d.y }; if (port === 'wan') return { x: d.x, y: d.y - 46 };
    return { x: d.x, y: d.y + 44 + Object.keys(d.ports).filter(k => k !== 'wan').indexOf(port) * 24 }; }, ep);
  return { x: box.x + pos.x / 720 * box.width, y: box.y + pos.y / 440 * box.height };
}
async function cable(a, b) {
  const A = await at(a), B = await at(b);
  await p.mouse.move(A.x, A.y); await p.mouse.down();
  await p.mouse.move((A.x + B.x) / 2, (A.y + B.y) / 2, { steps: 4 }); await p.mouse.move(B.x, B.y, { steps: 4 });
  await p.mouse.up();
}
const clickDev = async id => { const A = await at(id); await p.mouse.click(A.x, A.y); };
const links = () => T(() => window.NetworkTrainer.net.links.map(l => l.join('-')));
async function checkAndWait() { await p.click('#checkBtn'); await p.waitForFunction(() => !document.getElementById('checkBtn')?.disabled || !document.getElementById('feedback').hidden); await p.waitForTimeout(100); }

await step('головна: 5 розділів, 20 рівнів, відкритий лише перший', async () => {
  assert.equal(await p.locator('.chapter').count(), 5);
  assert.equal(await p.locator('.lvl').count(), 20);
  assert.equal(await p.locator('.lvl:not([disabled])').count(), 1);
});

await step('пам’ятка, потім кабель мишкою від ПК-1 до ПК-2 — і мережа працює з першої перевірки', async () => {
  await p.click('#continueBtn');
  assert.equal(await p.locator('.stage.intro .tips li').count(), 3);
  await p.click('#goBtn');
  await cable('pc1', 'pc2');
  assert.deepEqual(await links(), ['pc1-pc2']);
  await checkAndWait();
  assert.match(await p.textContent('#fbTitle'), /Мережа працює/);
  await p.click('#fbNext');
  assert.equal(await p.locator('#resStars svg.on').count(), 3);
  assert.equal(await T(() => window.NetworkTrainer.progress.best['net-cable'].stars), 3);
});

await step('клацання по кабелю від’єднує його', async () => {
  await p.click('#resRetry'); await p.click('#goBtn');
  await cable('pc1', 'pc2');
  const A = await at('pc1'), B = await at('pc2');
  await p.mouse.click((A.x + B.x) / 2, (A.y + B.y) / 2);
  assert.deepEqual(await links(), []);
});

await step('у комп’ютера одне гніздо: другий кабель не підключається й пояснюється', async () => {
  await start(1);
  await cable('pc1', 'pc2');
  await cable('pc1', 'sw');
  assert.deepEqual(await links(), ['pc1-pc2']);
  assert.match(await p.textContent('#boardHelp'), /одне гніздо/);
});

await step('невдала перевірка показує причину під ціллю, а підказка обмежує до двох зірок', async () => {
  await checkAndWait();
  assert.equal(await p.locator('.goal-list li.bad').count(), 2);
  assert.match(await p.textContent('.goal-list'), /ПК-3 не підключено кабелем/);
  await p.click('#hintBtn');
  assert.match(await p.textContent('#hintBox'), /комутатор/);
  await p.mouse.click(...Object.values(await (async () => { const A = await at('pc1'), B = await at('pc2'); return { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }; })()));
  for (const id of ['pc1', 'pc2', 'pc3']) await cable(id, 'sw');
  await checkAndWait();
  await p.click('#fbNext');
  assert.equal(await p.locator('#resStars svg.on').count(), 2);
});

await step('налаштування пристрою: вписати IP у ПК-3', async () => {
  await start(5);
  await clickDev('pc3');
  assert.match(await p.textContent('.insp-head'), /ПК-3/);
  assert.equal(await p.locator('.insp input[data-f="gw"]').isDisabled(), true, 'шлюз на цьому рівні змінювати не можна');
  await p.fill('.insp input[data-f="ip"]', '192.168.1.300');
  assert.match(await p.getAttribute('.insp input[data-f="ip"]', 'class'), /bad/);
  await p.fill('.insp input[data-f="ip"]', '192.168.1.4');
  assert.match(await p.textContent('.dev[data-ep="pc3"]'), /192\.168\.1\.4/);
  await checkAndWait();
  assert.match(await p.textContent('#fbTitle'), /Мережа працює/);
});

await step('кабель на роутер займає вільний порт LAN2, адресу порту можна вписати', async () => {
  await start(9);
  await cable('sw2', 'r1');
  assert.ok((await links()).includes('sw2-r1:lan2'));
  await clickDev('r1');
  await p.fill('.port-card[data-port="lan2"] input[data-f="lan2.ip"]', '192.168.2.1');
  await checkAndWait();
  assert.match(await p.textContent('#fbTitle'), /Мережа працює/);
});

await step('ping з налаштувань комп’ютера: без WAN інтернету немає', async () => {
  await start(10);
  await clickDev('pc1');
  await p.fill('#pingInp', '8.8.8.8');
  await p.press('#pingInp', 'Enter');
  assert.match(await p.textContent('#pingLog'), /WAN/);
  await cable('r1:wan', 'net');
  await clickDev('pc1');
  await p.fill('#pingInp', '8.8.8.8'); await p.click('#pingBtn');
  assert.match(await p.textContent('#pingLog'), /Відповідь від 8\.8\.8\.8/);
});

await step('DHCP: перемикач на роутері й режим «Автоматично» в ноутбука', async () => {
  await start(13);
  await clickDev('r1');
  await p.click('.tgl');
  assert.equal(await T(() => window.NetworkTrainer.net.devices.find(d => d.id === 'r1').ports.lan1.dhcp), true);
  assert.match(await p.textContent('.dev[data-ep="pc1"]'), /192\.168\.1\.10\d/);
  await clickDev('lap');
  await p.click('[data-mode="auto"]');
  assert.match(await p.textContent('.insp'), /отримано від DHCP/);
  await checkAndWait();
  assert.match(await p.textContent('#fbTitle'), /Мережа працює/);
});

await step('запитання: правильна й неправильна відповідь', async () => {
  await start(4);
  await p.click('.opt:has-text("Номер пристрою")');
  assert.match(await p.textContent('#fbTitle'), /Правильно/);
  await p.click('#fbNext');
  await p.click('.opt:has-text("192.168.1.300")');
  assert.match(await p.textContent('#fbWhy'), /від 0 до 255/);
  assert.equal(await p.locator('.opt.right').count(), 1);
});

await step('усі 20 рівнів проходяться на три зірки', async () => {
  const L = await T(() => window.NetworkTrainer.LEVELS.map(l => ({ kind: l.kind, solve: l.solve, tasks: l.tasks?.map(t => t.options.findIndex(o => o.ok)) })));
  for (const [i, l] of L.entries()) {
    await start(i);
    if (l.kind === 'net') {
      for (const op of l.solve) await p.evaluate(op => window.NetworkTrainer.apply(op), op);
      await checkAndWait();
      assert.match(await p.textContent('#fbTitle'), /Мережа працює/, 'рівень ' + (i + 1));
      await p.click('#fbNext');
    } else for (const k of l.tasks) { await p.click(`.opt[data-k="${k}"]`); await p.click('#fbNext'); }
    assert.equal(await p.locator('#resStars svg.on').count(), 3, 'рівень ' + (i + 1));
  }
});

await step('прогрес зберігається після перезавантаження', async () => {
  await p.goto(server.url + '/trainers/network-trainer');
  await p.waitForFunction(() => window.NetworkTrainer);
  assert.equal(await p.locator('.lvl:not([disabled])').count(), 20);
  assert.match(await p.textContent('#total'), /60 \/ 60/);
});

await step('результати: без імені не завантажуються, з ім’ям — картинка', async () => {
  await p.click('#reportBtn');
  await p.fill('#studentName', '');
  await p.click('#downloadReport');
  assert.equal(await p.isVisible('#report'), true);
  assert.equal(await p.evaluate(() => document.activeElement.id), 'studentName');
  await p.fill('#studentName', 'Test Student');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#downloadReport')]);
  assert.equal(dl.suggestedFilename(), 'network-test-student.png');
});

await step('жодної помилки в консолі сторінки', async () => { assert.deepEqual(errors, []); });

await browser.close();
server.close();
