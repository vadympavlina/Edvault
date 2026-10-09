// Браузерна перевірка «Гарячі клавіші» (потрібні Playwright і Chromium).
//   node tests/hotkeys-e2e.mjs
import assert from 'node:assert/strict';
import { startServer, launch, newPage, step } from './_harness.mjs';
import { parseCombo } from '../trainers/hotkeystrainer/js/logic.js';

const server = await startServer();
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const p = await newPage(ctx, errors);
await p.goto(server.url + '/trainers/hotkeys-trainer');
await p.waitForFunction(() => window.HotkeysTrainer);

// комбінація з рівнів → натискання Playwright за фізичними клавішами
const pw = combo => { const c = parseCombo(combo); return [c.ctrl && 'Control', c.shift && 'Shift', c.alt && 'Alt', c.code].filter(Boolean).join('+'); };
const task = () => p.evaluate(() => JSON.parse(JSON.stringify(window.HotkeysTrainer.task)));
const lastScore = () => p.evaluate(() => { const s = window.HotkeysTrainer.scores; return s[s.length - 1]; });
const doc = () => p.evaluate(() => JSON.parse(JSON.stringify(window.HotkeysTrainer.doc)));
const words = async (l = 0) => (await doc()).lines[l].map(w => w.t).join(' ');
const open = i => p.evaluate(i => { const T = window.HotkeysTrainer; T.LEVELS.slice(0, i).forEach(L => { T.progress.best[L.id] ||= { stars: 1, pct: 50 }; }); T.openLevel(i); }, i);
async function solve() {
  const t = await task();
  if (t.kind === 'press') await p.keyboard.press(pw(t.combo));
  else await p.click(`.opt[data-k="${t.options.findIndex(o => o.ok)}"]`);
}
async function next() { if (await p.isVisible('#fbNext')) await p.click('#fbNext'); else await p.waitForTimeout(500); }

await step('головна: 5 розділів, 20 рівнів, відкритий лише перший', async () => {
  assert.equal(await p.locator('.chapter').count(), 5);
  assert.equal(await p.locator('.lvl').count(), 20);
  assert.equal(await p.locator('.lvl:not([disabled])').count(), 1);
});

await step('пам’ятка, потім Ctrl+C копіює слово в буфер (з першої спроби — 100%)', async () => {
  await p.click('#continueBtn');
  assert.equal(await p.locator('.stage.intro .tips li').count(), 3);
  await p.click('#goBtn');
  await p.keyboard.press('Control+KeyC');
  assert.equal(await lastScore(), 1);
  assert.match(await p.textContent('.clip'), /кіт/);
  assert.equal(await p.locator('#keyboard .key.target').count(), 2);
});

await step('Ctrl+V вставляє слово в документ', async () => {
  await p.click('#fbNext');
  await p.keyboard.press('Control+KeyV');
  assert.equal(await words(), 'Наш кіт кіт любить спати на сонці.');
});

await step('неправильна комбінація пояснюється, а бал зменшується', async () => {
  await p.click('#fbNext');
  await p.keyboard.press('Control+KeyX');
  assert.match(await p.textContent('#pressMsg'), /вирізати/);
  assert.equal(await p.evaluate(() => window.HotkeysTrainer.answered), false);
  await p.keyboard.press('Control+KeyC');
  assert.equal(await lastScore(), 0.5);
});

await step('підказка підсвічує клавіші, «Не знаю» — бал 0', async () => {
  await p.click('#fbNext');
  await p.click('#hintBtn');
  assert.equal(await p.locator('#keyboard .key.hint').count(), 2);
  await p.click('#giveBtn');
  await p.keyboard.press('Control+KeyV');
  assert.equal(await lastScore(), 0);
  await p.click('#fbNext');
  await p.waitForSelector('#result:not([hidden])');
  assert.ok(await p.locator('#resStars svg.on').count() < 3);
});

await step('вирізати, вставити в кінець і двічі скасувати — текст як був', async () => {
  await open(1); await p.click('#goBtn');
  await p.keyboard.press('Control+KeyX'); assert.equal(await words(), 'Наш любить спати на сонці.'); await next();
  await p.keyboard.press('Control+KeyV'); assert.equal(await words(), 'Наш любить спати на сонці. кіт'); await next();
  await p.keyboard.press('Control+KeyZ'); await next();
  await p.keyboard.press('Control+KeyZ');
  assert.equal(await words(), 'Наш кіт любить спати на сонці.');
});

await step('форматування: Ctrl+B робить жирним, Ctrl+S прибирає зірочку незбереженого', async () => {
  await open(5); await p.click('#goBtn');
  await p.keyboard.press('Control+KeyB');
  assert.equal(await p.locator('.w.b').count(), 1);
  assert.match(await p.textContent('.mk-title'), /\*/);
  await next(); await p.keyboard.press('Control+KeyS');
  assert.doesNotMatch(await p.textContent('.mk-title'), /\*/);
  await next(); await p.keyboard.press('Control+KeyF');
  assert.equal(await p.locator('.mk-find').count(), 1);
  await next(); await p.keyboard.press('Control+KeyP');
  assert.equal(await p.locator('.mk-dialog').count(), 1);
});

await step('браузер: Ctrl + «+» збільшує масштаб, F5 не перезавантажує сторінку тренажера', async () => {
  await open(8); await p.click('#goBtn');
  await p.keyboard.press('Control+Equal');
  assert.equal(await p.evaluate(() => window.HotkeysTrainer.web.zoom), 110);
  await open(9); await p.click('#goBtn');
  await p.keyboard.press('F5');
  assert.equal(await lastScore(), 1, 'F5 перехоплено');
  assert.ok(await p.evaluate(() => !!window.HotkeysTrainer));
});

await step('системні комбінації — вибір відповіді з клавішами', async () => {
  await open(12); await p.click('#goBtn');
  assert.ok(await p.locator('.opt kbd').count() >= 6);
  await p.click('.opt[data-k="1"]');
  assert.equal(await lastScore(), 0);
  assert.match(await p.textContent('#fbWhy'), /Правильно/);
});

await step('провідник: F2 перейменовує, Delete видаляє, Ctrl+Z повертає', async () => {
  await open(14); await p.click('#goBtn');
  await solve(); await next();
  await p.keyboard.press('F2');
  assert.match(await p.textContent('.win-files'), /Реферат з історії/); await next();
  await p.keyboard.press('Delete');
  assert.doesNotMatch(await p.textContent('.win-files'), /чернетка/); await next();
  await p.keyboard.press('Control+KeyZ');
  assert.match(await p.textContent('.win-files'), /чернетка/);
});

await step('швидкісний рівень: таймер і автоматичний перехід', async () => {
  await open(16); await p.click('#goBtn');
  assert.equal(await p.isVisible('#timer'), true);
  for (let k = 0; k < 6; k++) { await solve(); await p.waitForTimeout(550); }
  await p.waitForSelector('#result:not([hidden])');
  assert.match(await p.textContent('#resMsg'), /час/);
});

await step('усі 20 рівнів проходяться на три зірки', async () => {
  for (let i = 0; i < 20; i++) {
    await open(i); await p.click('#goBtn');
    const n = await p.locator('#dots i').count();
    for (let k = 0; k < n; k++) { await solve(); await next(); }
    await p.waitForSelector('#result:not([hidden])');
    assert.equal(await p.locator('#resStars svg.on').count(), 3, `рівень ${i + 1}`);
  }
});

await step('прогрес зберігається після перезавантаження', async () => {
  await p.goto(server.url + '/trainers/hotkeys-trainer'); await p.waitForFunction(() => window.HotkeysTrainer);
  assert.equal(await p.locator('.lvl.perfect').count(), 20);
  assert.ok(+(await p.textContent('#heroAcc')) >= 40);
});

await step('результати: без імені не завантажуються, з ім’ям — картинка', async () => {
  await p.click('#reportBtn');
  await p.click('#downloadReport');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'studentName');
  await p.fill('#studentName', 'Test Student');
  const dl = p.waitForEvent('download');
  await p.click('#downloadReport');
  assert.equal((await dl).suggestedFilename(), 'hotkeys-test-student.png');
  await p.keyboard.press('Escape');
});

await step('жодної помилки в консолі сторінки', async () => assert.deepEqual(errors, []));

await browser.close();
server.close();
