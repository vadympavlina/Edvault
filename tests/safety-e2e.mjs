// Браузерна перевірка «Безпека в інтернеті» (потрібні Playwright і Chromium).
//   node tests/safety-e2e.mjs
import assert from 'node:assert/strict';
import { startServer, launch, newPage, step } from './_harness.mjs';
import { strength } from '../trainers/safetytrainer/js/logic.js';

const server = await startServer();
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
const p = await newPage(ctx, errors);
await p.goto(server.url + '/trainers/safety-trainer');
await p.waitForFunction(() => window.SafetyTrainer);

const task = () => p.evaluate(() => JSON.parse(JSON.stringify(window.SafetyTrainer.task)));
const lastScore = () => p.evaluate(() => { const s = window.SafetyTrainer.scores; return s[s.length - 1]; });
const STRONG = 'Зелений-Кіт-Пече-Хліб-77!';
// уважний учень: правильна відповідь для будь-якого типу завдання
async function solve() {
  const t = await task();
  if (t.kind === 'domain') await p.click('.ch.domain');
  else if (t.kind === 'url') await p.click(`.vbtn[data-v="${t.safe ? 1 : 0}"]`);
  else if (t.kind === 'msg') { for (const s of await p.locator('.seg:not([data-flag=""])').all()) await s.click(); await p.click(`.vbtn[data-v="${t.scam ? 1 : 0}"]`); }
  else if (t.kind === 'pick') { for (const [k, it] of t.items.entries()) if (it.bad) await p.click(`.pcard[data-k="${k}"]`); await p.click('#checkBtn'); }
  else if (t.kind === 'choice') await p.click(`.opt[data-k="${t.options.findIndex(o => o.ok)}"]`);
  else if (t.kind === 'make') { await p.fill('#pw', STRONG); await p.click('#checkBtn'); }
  else if (t.kind === 'rank') {
    const want = [...t.items].sort((a, b) => strength(a, t.personal).bits - strength(b, t.personal).bits);
    for (let k = 0; k < want.length; k++) {
      let cur = await p.locator('#rankList code').allTextContents();
      let i = cur.indexOf(want[k]);
      while (i > k) { await p.click(`.rbtn[data-mv="-1"][data-k="${i}"]`); i--; }
    }
    await p.click('#checkBtn');
  }
  await p.waitForSelector('#feedback:not([hidden])');
}
async function playLevel() {
  const n = await p.evaluate(() => window.SafetyTrainer.task && document.querySelectorAll('#dots i').length);
  for (let k = 0; k < n; k++) { await solve(); await p.click('#fbNext'); }
  await p.waitForSelector('#result:not([hidden])');
}
const open = i => p.evaluate(i => { const T = window.SafetyTrainer; T.LEVELS.slice(0, i).forEach(L => { T.progress.best[L.id] ||= { stars: 1, pct: 50 }; }); T.openLevel(i); }, i);

await step('головна: 5 розділів, 20 рівнів, відкритий лише перший', async () => {
  assert.equal(await p.locator('.chapter').count(), 5);
  assert.equal(await p.locator('.lvl').count(), 20);
  assert.equal(await p.locator('.lvl:not([disabled])').count(), 1);
});

await step('адреса: клацання справжнього домену — правильно, три зірки за рівень', async () => {
  await p.click('#continueBtn');
  await p.click('.ch.domain');
  assert.equal(await lastScore(), 1);
  assert.equal(await p.locator('.ch.real').count(), 1);
  await p.click('#fbNext');
  for (let k = 1; k < 4; k++) { await solve(); await p.click('#fbNext'); }
  await p.waitForSelector('#result:not([hidden])');
  assert.equal(await p.locator('#resStars svg.on').count(), 3);
});

await step('приманка на початку адреси: клацнути «sonyah.» — помилка з поясненням', async () => {
  await p.click('#resNext');
  await p.locator('.ch.sub').first().click();
  assert.equal(await lastScore(), 0);
  assert.match(await p.textContent('#fbList'), /card-check\.net/);
  assert.equal(await p.locator('#dots i.bad').count(), 1);
});

await step('Enter переходить до наступного завдання', async () => {
  await p.locator('body').press('Enter');
  assert.match(await p.textContent('#stepN'), /Завдання 2/);
});

await step('лист: знайдено всі ознаки й вердикт «шахрайство» — 100%', async () => {
  await open(4);
  assert.equal((await task()).kind, 'msg');
  await solve();
  assert.equal(await lastScore(), 1);
  assert.ok(await p.locator('.seg.found').count() >= 4);
});

await step('безпечний лист із зайвою позначкою — частковий бал', async () => {
  await p.click('#fbNext');
  await p.locator('.seg').first().click();
  await p.click('.vbtn[data-v="0"]');
  assert.equal(await lastScore(), 0.8);
  assert.equal(await p.locator('.seg.extra').count(), 1);
});

await step('паролі: перевірка без упорядкування — показано правильний порядок і час підбору', async () => {
  await open(8);
  await p.click('#checkBtn');
  assert.ok(await lastScore() < 1);
  assert.equal(await p.locator('#rankList .meter').count(), 4);
  assert.match(await p.textContent('#rankList'), /миттєво/);
});

await step('свій пароль: «Готово» з’являється лише після всіх правил, пароль не лишається на сторінці', async () => {
  await open(9);
  await p.fill('#pw', 'qwerty');
  assert.equal(await p.isDisabled('#checkBtn'), true);
  assert.equal(await p.locator('#rules li.ok').count() < 6, true);
  await p.fill('#pw', STRONG);
  assert.equal(await p.locator('#rules li.ok').count(), 6);
  await p.click('#checkBtn');
  assert.equal(await p.inputValue('#pw'), '•'.repeat(STRONG.length));
  assert.match(await p.textContent('#fbList'), /надійн/);
});

await step('вибір відповіді клавішею й пояснення неправильної', async () => {
  await p.click('#fbNext');
  const t = await task();
  const wrong = t.options.findIndex(o => !o.ok);
  await p.keyboard.press(String(wrong + 1));
  assert.equal(await lastScore(), 0);
  assert.equal(await p.locator('.opt.right').count(), 1);
  assert.match(await p.textContent('#fbWhy'), /Правильно:/);
});

await step('дозволи застосунків: позначити зайві', async () => {
  await open(13);
  await solve();
  assert.equal(await lastScore(), 1);
  assert.equal(await p.locator('.pcard.extra').count(), 0);
});

await step('усі 20 рівнів проходяться на три зірки', async () => {
  for (let i = 0; i < 20; i++) {
    await open(i);
    await playLevel();
    assert.equal(await p.locator('#resStars svg.on').count(), 3, `рівень ${i + 1}`);
  }
});

await step('прогрес зберігається після перезавантаження', async () => {
  await p.goto(server.url + '/trainers/safety-trainer'); await p.waitForFunction(() => window.SafetyTrainer);
  assert.equal(await p.locator('.lvl.perfect').count(), 20);
  assert.match(await p.textContent('#heroAcc'), /100%/);
});

await step('результати: без імені не завантажуються, з ім’ям — картинка', async () => {
  await p.click('#reportBtn');
  await p.click('#downloadReport');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'studentName');
  await p.fill('#studentName', 'Test Student');
  const dl = p.waitForEvent('download');
  await p.click('#downloadReport');
  assert.equal((await dl).suggestedFilename(), 'safety-test-student.png');
  await p.keyboard.press('Escape');
});

await step('жодної помилки в консолі сторінки', async () => assert.deepEqual(errors, []));

await browser.close();
server.close();
