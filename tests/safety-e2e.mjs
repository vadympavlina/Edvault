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
  if (t.kind === 'yesno') await p.click(`.vbtn[data-v="${t.yes ? 1 : 0}"]`);
  else if (t.kind === 'which') await p.click(`.lopt[data-k="${t.answer}"]`);
  else if (t.kind === 'msg') await p.click(`.vbtn[data-v="${t.scam ? 1 : 0}"]`);
  else if (t.kind === 'pair') await p.click(`.pw-card[data-p="${strength(t.a).bits > strength(t.b).bits ? t.a : t.b}"]`);
  else if (t.kind === 'pick') { for (const [k, it] of t.items.entries()) if (it.bad) await p.click(`.pcard[data-k="${k}"]`); await p.click('#checkBtn'); }
  else if (t.kind === 'choice') await p.click(`.opt[data-k="${t.options.findIndex(o => o.ok)}"]`);
  else if (t.kind === 'make') { await p.fill('#pw', STRONG); await p.click('#checkBtn'); }
  await p.waitForSelector('#feedback:not([hidden])');
}
async function playLevel() {
  await p.click('#goBtn');
  const n = await p.locator('#dots i').count();
  for (let k = 0; k < n; k++) { await solve(); await p.click('#fbNext'); }
  await p.waitForSelector('#result:not([hidden])');
}
const open = i => p.evaluate(i => { const T = window.SafetyTrainer; T.LEVELS.slice(0, i).forEach(L => { T.progress.best[L.id] ||= { stars: 1, pct: 50 }; }); T.openLevel(i); }, i);

await step('головна: 5 розділів, 20 рівнів, відкритий лише перший', async () => {
  assert.equal(await p.locator('.chapter').count(), 5);
  assert.equal(await p.locator('.lvl').count(), 20);
  assert.equal(await p.locator('.lvl:not([disabled])').count(), 1);
});

await step('рівень починається з пам’ятки, Enter — почати', async () => {
  await p.click('#continueBtn');
  assert.equal(await p.locator('.stage.intro .tips li').count(), 3);
  assert.match(await p.textContent('#stepN'), /Пам’ятка/);
  assert.equal(await p.isVisible('#tipsBtn'), false);
  await p.locator('body').press('Enter');
  assert.match(await p.textContent('#stepN'), /Завдання 1/);
});

await step('«Так / Ні» з адресою: після відповіді підсвічено ім’я сайту', async () => {
  await solve();
  assert.equal(await lastScore(), 1);
  assert.equal(await p.locator('.ch.real').textContent(), 'sonyah.ua');
  assert.match(await p.textContent('#fbList'), /Ім’я сайту: sonyah\.ua/);
});

await step('неправильна відповідь — червоне й пояснення; пам’ятку можна відкрити', async () => {
  await p.click('#fbNext'); await p.click('#fbNext').catch(() => {});
  await open(1); await p.click('#goBtn');
  await p.click('.vbtn[data-v="1"]'); // «Так» для s0nyah.ua
  assert.equal(await lastScore(), 0);
  assert.equal(await p.locator('.vbtn.wrong').count(), 1);
  assert.match(await p.textContent('#fbWhy'), /нуль/);
  await p.click('#tipsBtn');
  assert.equal(await p.isVisible('#lvlHint .tips'), true);
});

await step('«Яке посилання справжнє?» — вибір з трьох адрес', async () => {
  await open(0); await p.click('#goBtn');
  for (let k = 0; k < 3; k++) { await solve(); await p.click('#fbNext'); }
  assert.equal((await task()).kind, 'which');
  await p.click('.lopt[data-k="2"]');
  assert.equal(await lastScore(), 0);
  assert.equal(await p.locator('.lopt.right').count(), 1);
  assert.equal(await p.locator('.lopt .ch.real').count(), 3);
});

await step('лист: вердикт «Це обман» — підозрілі місця показано автоматично', async () => {
  await open(4); await p.click('#goBtn');
  assert.equal(await p.locator('.seg.flag').count(), 0, 'до відповіді нічого не підказуємо');
  await solve();
  assert.equal(await lastScore(), 1);
  assert.ok(await p.locator('.seg.flag').count() >= 4);
  assert.ok(await p.locator('#fbList li').count() >= 4);
});

await step('два паролі: обрати надійніший — показано шкалу для обох', async () => {
  await open(8); await p.click('#goBtn');
  await solve();
  assert.equal(await lastScore(), 1);
  assert.equal(await p.locator('.pw-card .meter').count(), 2);
});

await step('свій пароль: «Готово» лише після всіх правил, пароль не лишається на сторінці', async () => {
  await open(9); await p.click('#goBtn');
  await p.fill('#pw', 'qwerty');
  assert.equal(await p.isDisabled('#checkBtn'), true);
  await p.fill('#pw', STRONG);
  assert.equal(await p.locator('#rules li.ok').count(), 5);
  await p.click('#checkBtn');
  assert.equal(await p.inputValue('#pw'), '•'.repeat(STRONG.length));
});

await step('вибір відповіді клавішею; неправильна — з правильною відповіддю', async () => {
  await p.click('#fbNext');
  const t = await task();
  await p.keyboard.press(String(t.options.findIndex(o => !o.ok) + 1));
  assert.equal(await lastScore(), 0);
  assert.match(await p.textContent('#fbWhy'), /Правильна відповідь/);
});

await step('«познач усі»: видно, скільки треба знайти', async () => {
  await open(13); await p.click('#goBtn');
  assert.match(await p.textContent('#markedN'), /Позначено 0 з 3/);
  await solve();
  assert.equal(await lastScore(), 1);
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
