// Браузерна перевірка тренажера сліпого друку (потрібні Playwright і Chromium).
//   node tests/typing-e2e.mjs
import assert from 'node:assert/strict';
import { startServer, launch, newPage, step } from './_harness.mjs';

const server = await startServer();
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, acceptDownloads: true });
const p = await newPage(ctx, errors);
await p.goto(server.url + '/tools/typing-trainer.html');
await p.waitForFunction(() => window.TypingTrainer);

// Playwright не вміє «натискати» кириличні клавіші, тож надсилаємо подію keydown напряму
const key = (ch, code = '') => p.evaluate(([ch, code]) => document.dispatchEvent(new KeyboardEvent('keydown', { key: ch, code, bubbles: true, cancelable: true })), [ch, code]);
const typeAll = async (from = 0, delay = 0) => {
  const t = await p.evaluate(() => window.TypingTrainer.run.text);
  for (let i = from; i < t.length; i++) { await key(t[i]); if (delay) await p.waitForTimeout(delay); }
};
const run = () => p.evaluate(() => { const r = window.TypingTrainer.run; return { pos: r.pos, errors: r.errors, strokes: r.strokes, len: r.text.length }; });

await step('головна: розділи, відкритий лише перший рівень, дві розкладки', async () => {
  assert.equal(await p.locator('.chapter').count(), 5);
  assert.equal(await p.locator('.lvl:not([disabled])').count(), 1);
  assert.equal(await p.locator('#layoutSeg button').count(), 2);
  assert.equal(await p.isVisible('#weak'), false, 'слабких клавіш ще немає');
});

await step('рівень 1: підсвічено наступну клавішу й палець', async () => {
  await p.click('#continueBtn');
  const first = await p.evaluate(() => window.TypingTrainer.run.text[0]);
  const code = first === 'а' ? 'KeyF' : 'KeyJ';
  assert.equal(await p.getAttribute('.k.next', 'data-code'), code);
  assert.match(await p.textContent('#finger'), /вказівний/);
});

await step('латинська літера замість кириличної — попередження, а не помилка', async () => {
  await key('f', 'KeyF');
  assert.equal(await p.isVisible('#layoutWarn'), true);
  assert.equal((await run()).errors, 0);
});

await step('помилка рахується, курсор стоїть, доки не натиснете правильну', async () => {
  const t = await p.evaluate(() => window.TypingTrainer.run.text);
  await key(t[0]);
  assert.equal(await p.isVisible('#layoutWarn'), false);
  await key('ж', 'Semicolon');
  const r = await run();
  assert.equal(r.pos, 1); assert.equal(r.errors, 1);
  assert.equal(await p.locator('.text .c.cur.err').count(), 1);
});

await step('друк до кінця: результат зі швидкістю, точністю й зірками', async () => {
  await typeAll(1, 0);
  await p.waitForSelector('#result:not([hidden])');
  const acc = +(await p.textContent('#resAcc'));
  assert.ok(acc >= 95 && acc < 100, 'одна помилка знижує точність: ' + acc);
  assert.ok(+(await p.textContent('#resCpm')) > 0);
  assert.match(await p.textContent('#resKeys'), /Помилки/);
  assert.equal(await p.isEnabled('#resNext'), true, 'з 1+ зіркою відкривається наступний рівень');
});

await step('Enter у вікні результату — наступний рівень; Esc — почати рівень заново', async () => {
  await p.keyboard.press('Enter');
  await p.waitForSelector('#result', { state: 'hidden' });
  assert.equal(await p.textContent('#lvlName'), 'Клавіші В Л');
  await key('ф', 'KeyA');
  await p.keyboard.press('Escape');
  assert.equal((await run()).strokes, 0);
});

await step('статистика клавіш накопичується, з’являються слабкі клавіші', async () => {
  await p.evaluate(() => { const k = window.TypingTrainer.progress.keys.uk; k['ж'] = { h: 10, e: 6 }; k['є'] = { h: 12, e: 4 }; });
  await p.click('#backBtn');
  assert.equal(await p.isVisible('#weak'), true);
  assert.match(await p.textContent('#weakText'), /Ж.*Є/);
  await p.click('#weakBtn');
  assert.match(await p.evaluate(() => window.TypingTrainer.run.text), /[жє]/);
});

await step('свій текст: незнайомі знаки відхиляються, звичайний текст друкується', async () => {
  await p.click('#backBtn');
  await p.click('#customBtn');
  await p.fill('#customText', 'Привіт © світ');
  await p.click('#customStart');
  assert.equal(await p.isVisible('#custom'), true);
  await p.fill('#customText', 'Привіт, світе! Як справи?');
  await p.click('#customStart');
  await typeAll();
  await p.waitForSelector('#result:not([hidden])');
  assert.equal(await p.isVisible('#resNext'), false, 'для свого тексту «Далі» не показуємо');
  await p.click('#resLevels');
});

await step('англійська розкладка має свої рівні й прогрес', async () => {
  await p.click('[data-layout="en"]');
  assert.match(await p.textContent('#continueBtn'), /F і J/);
  assert.equal(await p.locator('.lvl.perfect, .lvl .stars svg.on').count(), 0);
  await p.click('#continueBtn');
  await typeAll();
  await p.waitForSelector('#result:not([hidden])');
  await p.click('#resLevels');
  await p.click('[data-layout="uk"]');
});

await step('прогрес зберігається після перезавантаження', async () => {
  await p.reload(); await p.waitForFunction(() => window.TypingTrainer);
  const pr = await p.evaluate(() => window.TypingTrainer.progress);
  assert.ok(pr.best.uk['home-ао'] && pr.best.en['home-fj']);
  assert.ok(pr.keys.uk['а'] && pr.keys.uk['а'].h > 0);
});

await step('результати: без імені не завантажуються, з ім’ям — картинка', async () => {
  await p.click('#reportBtn');
  await p.click('#downloadReport');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'studentName');
  await p.fill('#studentName', 'Test Student');
  const dl = p.waitForEvent('download');
  await p.click('#downloadReport');
  assert.equal((await dl).suggestedFilename(), 'typing-trainer-test-student.png');
  await p.keyboard.press('Escape');
});

await step('жодної помилки в консолі сторінки', async () => assert.deepEqual(errors, []));

await browser.close();
server.close();
