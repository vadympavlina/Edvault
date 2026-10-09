// Браузерна перевірка тренажера пера (потрібні Playwright і Chromium).
//   node tests/pentrainer-e2e.mjs
import assert from 'node:assert/strict';
import { startServer, launch, newPage, step } from './_harness.mjs';

const server = await startServer();
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, acceptDownloads: true });
const p = await newPage(ctx, errors);
await p.goto(server.url + '/trainers/pen-trainer.html');
await p.waitForFunction(() => window.PenTrainer);

// координати поля 600×600 → екран
const at = (x, y) => p.evaluate(([x, y]) => { const m = document.getElementById('board').getScreenCTM(); return [m.e + x * m.a, m.f + y * m.d]; }, [x, y]);
const click = async (x, y) => p.mouse.click(...await at(x, y));
const drag = async (x, y, x2, y2) => { await p.mouse.move(...await at(x, y)); await p.mouse.down(); await p.mouse.move(...await at(x2, y2), { steps: 8 }); await p.mouse.up(); };
const result = async () => {
  await p.keyboard.press('Enter');
  await p.waitForSelector('#result:not([hidden])');
  return p.evaluate(() => ({ acc: +document.getElementById('resAcc').textContent, stars: document.querySelectorAll('#resStars svg.on').length }));
};
const level = id => p.evaluate(id => window.PenTrainer.LEVELS.findIndex(l => l.id === id), id);
// відкрити рівень, позначивши попередні пройденими
const open = async id => {
  await p.evaluate(i => { const T = window.PenTrainer; T.LEVELS.slice(0, i).forEach(L => { T.progress.best[L.id] ||= { acc: 70, stars: 1, used: 1, ideal: 1, d: '' }; }); T.openLevel(i); }, await level(id));
  await p.waitForSelector('#play:not([hidden])');
};

await step('головна: розділи й рівні, відкритий лише перший', async () => {
  assert.equal(await p.locator('.chapter').count(), 5);
  assert.ok(await p.locator('.lvl').count() >= 20);
  assert.equal(await p.locator('.lvl:not([disabled])').count(), 1);
});

await step('відрізок двома кліками — три зірки, відкривається наступний рівень', async () => {
  await p.click('.lvl[data-level="0"]');
  await click(150, 300); await click(450, 300);
  const r = await result();
  assert.ok(r.acc >= 92, 'точність ' + r.acc); assert.equal(r.stars, 3);
  assert.equal(await p.isEnabled('#resNext'), true);
  await p.click('#resLevels');
  assert.equal(await p.locator('.lvl:not([disabled])').count(), 2);
});

await step('трикутник: клік у першу точку замикає контур', async () => {
  await open('triangle');
  await click(300, 140); await click(470, 440); await click(130, 440); await click(300, 140);
  assert.equal(await p.evaluate(() => window.PenTrainer.editor.closed), true);
  assert.ok((await result()).acc >= 92);
});

await step('коло: чотири плавні точки з ручками', async () => {
  await open('circle');
  await drag(300, 140, 388, 140); await drag(460, 300, 460, 388); await drag(300, 460, 212, 460); await drag(140, 300, 140, 212); await drag(300, 140, 388, 140);
  const r = await result();
  assert.ok(r.acc >= 92, 'точність ' + r.acc); assert.equal(r.stars, 3);
});

await step('пагорби: Alt ламає ручку — гострий кут на кривій', async () => {
  await open('hills');
  await drag(80, 400, 80, 260);
  for (const x of [220, 380]) {
    await p.mouse.move(...await at(x, 400)); await p.mouse.down();
    await p.mouse.move(...await at(x, 540), { steps: 6 });
    await p.keyboard.down('Alt'); await p.mouse.move(...await at(x, 260), { steps: 8 }); await p.mouse.up(); await p.keyboard.up('Alt');
  }
  await drag(520, 400, 520, 540);
  const a = await p.evaluate(() => window.PenTrainer.editor.anchors[1]);
  assert.ok(a.hin.y < 300 && a.hout.y < 300, 'обидві ручки вгору');
  assert.ok((await result()).acc >= 92);
});

await step('скасування, повтор, Backspace і підправлення точки', async () => {
  await open('zigzag');
  await click(100, 380); await click(200, 220); await click(300, 300);
  await p.keyboard.press('Control+z');
  assert.equal(await p.evaluate(() => window.PenTrainer.editor.anchors.length), 2);
  await p.keyboard.press('Control+Shift+z');
  assert.equal(await p.evaluate(() => window.PenTrainer.editor.anchors.length), 3);
  await p.keyboard.press('Backspace');
  assert.equal(await p.evaluate(() => window.PenTrainer.editor.anchors.length), 2);
  await click(300, 380); await click(400, 220); await click(500, 380); await p.keyboard.press('Escape');
  await drag(300, 380, 300, 380); // клік без руху нічого не ламає
  await drag(400, 220, 400, 230); await drag(400, 230, 400, 220);
  assert.equal(await p.evaluate(() => window.PenTrainer.editor.drawing), false);
  assert.ok((await result()).acc >= 90);
});

await step('за зразком: малюємо меншим і в іншому місці — форма зараховується', async () => {
  await open('copy-circle');
  assert.equal(await p.isVisible('#sample'), true);
  const c = [200, 330], r = 90, k = r * 0.5523;
  await drag(c[0], c[1] - r, c[0] + k, c[1] - r); await drag(c[0] + r, c[1], c[0] + r, c[1] + k); await drag(c[0], c[1] + r, c[0] - k, c[1] + r); await drag(c[0] - r, c[1], c[0] - r, c[1] - k); await drag(c[0], c[1] - r, c[0] + k, c[1] - r);
  const res = await result();
  assert.ok(res.acc >= 90, 'точність ' + res.acc);
});

await step('кожен рівень проходиться точно за покроковою підказкою', async () => {
  const total = await p.evaluate(() => window.PenTrainer.LEVELS.length);
  const bad = [];
  for (let i = 0; i < total; i++) {
    const id = await p.evaluate(i => window.PenTrainer.LEVELS[i].id, i);
    await open(id);
    const plan = await p.evaluate(async () => {
      const g = await import('./pentrainer/js/geom.js'), st = await import('./pentrainer/js/steps.js');
      const L = window.PenTrainer.LEVELS[window.PenTrainer.current], t = g.parsePath(L.d);
      return { anchors: t.anchors, steps: st.planSteps(t) };
    });
    if (!(await p.evaluate(() => document.getElementById('hintBtn').classList.contains('on')))) await p.keyboard.press('h');
    for (const [k, s] of plan.steps.entries()) {
      const a = plan.anchors[s.i];
      // підказка, яку бачить учень у цей момент, — саме цей крок
      const label = await p.textContent('#stepLabel'), shown = await p.textContent('#stepText');
      if (label !== `Крок ${k + 1} / ${plan.steps.length}` || shown !== s.text) bad.push(`${id}: на кроці ${k + 1} показано «${label}: ${shown}»`);
      if (s.act === 'click') await click(a.x, a.y);
      else {
        if (s.altHold) await p.keyboard.down('Alt');
        await p.mouse.move(...await at(a.x, a.y)); await p.mouse.down();
        await p.mouse.move(...await at(s.to.x, s.to.y), { steps: 6 });
        if (s.alt) { await p.keyboard.down('Alt'); await p.mouse.move(...await at(s.alt.x, s.alt.y), { steps: 6 }); }
        await p.mouse.up();
        if (s.alt || s.altHold) await p.keyboard.up('Alt');
      }
      if (s.then === 'click') await click(a.x, a.y);
      if (s.then === 'drag') await drag(a.x, a.y, s.thenTo.x, s.thenTo.y);
    }
    const r = await result();
    if (r.acc < 90 || r.stars < 2) bad.push(`${id}: ${r.acc}% ${r.stars}★`);
  }
  if (bad.length) console.log(bad.join('\n'));
  assert.deepEqual(bad, []);
});

await step('прогрес зберігається після перезавантаження', async () => {
  await p.reload(); await p.waitForFunction(() => window.PenTrainer);
  const b = await p.evaluate(() => window.PenTrainer.progress.best.circle);
  assert.ok(b && b.stars === 3 && b.d.startsWith('M'));
});

await step('результати: без імені не завантажуються, з ім’ям — картинка', async () => {
  await p.click('#reportBtn');
  await p.click('#downloadReport');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'studentName');
  await p.fill('#studentName', 'Test Student');
  const dl = p.waitForEvent('download');
  await p.click('#downloadReport');
  const d = await dl;
  assert.equal(d.suggestedFilename(), 'pen-trainer-test-student.png');
  await p.keyboard.press('Escape');
  assert.equal(await p.isVisible('#report'), false);
});

await step('жодної помилки в консолі сторінки', async () => assert.deepEqual(errors, []));

await browser.close();
server.close();
