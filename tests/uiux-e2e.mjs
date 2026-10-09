// Браузерна перевірка «UI/UX-дизайнер» (потрібні Playwright і Chromium).
//   node tests/uiux-e2e.mjs
import assert from 'node:assert/strict';
import { startServer, launch, newPage, step } from './_harness.mjs';

const server = await startServer();
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, acceptDownloads: true });
const p = await newPage(ctx, errors);
await p.goto(server.url + '/trainers/uiux-trainer');
await p.waitForFunction(() => window.UiuxTrainer);

const T = fn => p.evaluate(fn);
const open = i => p.evaluate(i => { const T = window.UiuxTrainer; T.LEVELS.slice(0, i).forEach(L => { T.progress.best[L.id] ||= { stars: 1, pct: 50 }; }); T.openLevel(i); }, i);
const start = async i => { await open(i); await p.click('#goBtn'); };
const lastScore = () => T(() => { const s = window.UiuxTrainer.scores; return s[s.length - 1]; });
// розв’язок «виправ сам» перебором перемикачів
const solveFix = () => p.evaluate(() => { const T = window.UiuxTrainer, t = T.task;
  const vals = c => c.type === 'toggle' ? [false, true] : c.type === 'range' ? Array.from({ length: (c.max - c.min) / c.step + 1 }, (_, i) => c.min + i * c.step) : c.type === 'swatch' ? c.options : c.options.map(x => x[0]);
  const go = (i, s) => { if (i === t.controls.length) return t.checks.every(c => c.ok(s)) ? s : null; for (const v of vals(t.controls[i])) { const r = go(i + 1, { ...s, [t.controls[i].k]: v }); if (r) return r; } return null; };
  T.setFix(go(0, { ...t.state })); });
async function solve() {
  const t = await T(() => { const t = window.UiuxTrainer.task; return { kind: t.kind, ok: t.ok, bad: [t.bad].flat()[0], k: t.options?.findIndex(o => o.ok) }; });
  if (t.kind === 'pair') await p.click(`.vcard[data-k="${t.ok}"]`);
  else if (t.kind === 'spot') await p.click(`.spot [data-p="${t.bad}"]`);
  else if (t.kind === 'choice') await p.click(`.opt[data-k="${t.k}"]`);
  else { await solveFix(); await p.click('#fixDone'); }
}

await step('головна: 5 розділів, 20 рівнів, відкритий лише перший', async () => {
  assert.equal(await p.locator('.chapter').count(), 5);
  assert.equal(await p.locator('.lvl').count(), 20);
  assert.equal(await p.locator('.lvl:not([disabled])').count(), 1);
});

await step('пам’ятка, потім правильний вибір варіанта — бал 1 і позначки на гіршому', async () => {
  await p.click('#continueBtn');
  assert.equal(await p.locator('.stage.intro .tips li').count(), 3);
  await p.click('#goBtn');
  assert.equal(await p.locator('.vcard').count(), 2);
  await p.click('.vcard[data-k="b"]');
  assert.equal(await lastScore(), 1);
  assert.match(await p.textContent('#fbTitle'), /Правильно/);
  assert.ok(await p.locator('.vcard[data-k="a"] .mp.flag').count() >= 1);
  assert.equal(await p.locator('#fbList li').count(), 2);
});

await step('неправильний вибір: бал 0, правильний варіант позначено', async () => {
  await p.click('#fbNext');
  await p.click('.vcard[data-k="a"]');
  assert.equal(await lastScore(), 0);
  assert.equal(await p.locator('.vcard.wrong').count(), 1);
  assert.equal(await p.locator('.vcard.right[data-k="b"]').count(), 1);
  assert.match(await p.textContent('#fbWhy'), /варіант Б/);
});

await step('вибір клавішею «2»', async () => {
  await p.click('#fbNext');
  await p.keyboard.press('2');
  assert.equal(await lastScore(), 1);
});

await step('знайди проблему: хибне клацання показує правильне місце', async () => {
  await p.click('#fbNext');
  assert.equal(await T(() => window.UiuxTrainer.task.kind), 'spot');
  await p.click('.spot [data-p="title"]');
  assert.equal(await lastScore(), 0);
  assert.equal(await p.locator('.spot .mp.miss').count(), 1);
  assert.equal(await p.locator('.spot .mp.found[data-p="btn"]').count(), 1);
});

await step('виправ сам: «Готово» лише коли всі перевірки зелені, лічильник контрасту оновлюється', async () => {
  await start(3);
  assert.equal(await p.isDisabled('#fixDone'), true);
  assert.match(await p.textContent('.cmeter'), /погано/);
  await p.click('.sw[title="#374151"]');
  assert.match(await p.textContent('.cmeter'), /відмінно/);
  assert.equal(await p.locator('#checks li.ok').count(), 1);
  await p.click('#fixDone');
  assert.equal(await lastScore(), 1);
});

await step('повзунок і перемикачі; підказка дає половину балу', async () => {
  await p.click('#fbNext');
  await p.click('#fixHintBtn');
  assert.match(await p.textContent('#fixHint'), /15–16/);
  await p.locator('input[type="range"]').fill('16');
  assert.match(await p.textContent('.rv'), /16px/);
  await p.click('.opts button:has-text("1,5")');
  assert.equal(await p.locator('#checks li.ok').count(), 2);
  await p.click('#fixDone');
  assert.equal(await lastScore(), 0.5);
  await start(11); for (let k = 0; k < 2; k++) { await solve(); await p.click('#fbNext'); }
  await p.click('.tgl[data-c="icon"]');
  assert.match(await p.textContent('.tgl[data-c="icon"]'), /Увімкнено/);
});

await step('усі 20 рівнів проходяться на три зірки', async () => {
  const n = await T(() => window.UiuxTrainer.LEVELS.map(l => l.tasks.length));
  for (const [i, cnt] of n.entries()) {
    await start(i);
    for (let k = 0; k < cnt; k++) { await solve(); await p.click('#fbNext'); }
    assert.equal(await p.locator('#resStars svg.on').count(), 3, 'рівень ' + (i + 1));
  }
});

await step('прогрес зберігається після перезавантаження', async () => {
  await p.goto(server.url + '/trainers/uiux-trainer');
  await p.waitForFunction(() => window.UiuxTrainer);
  assert.equal(await p.locator('.lvl:not([disabled])').count(), 20);
  assert.match(await p.textContent('#total'), /60 \/ 60/);
});

await step('результати: без імені не завантажуються, з ім’ям — картинка', async () => {
  await p.click('#reportBtn');
  await p.fill('#studentName', '');
  await p.click('#downloadReport');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'studentName');
  await p.fill('#studentName', 'Test Student');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#downloadReport')]);
  assert.equal(dl.suggestedFilename(), 'uiux-test-student.png');
});

await step('жодної помилки в консолі сторінки', async () => { assert.deepEqual(errors, []); });

await browser.close();
server.close();
