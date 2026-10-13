// Браузерна перевірка симулятора міста: старт, дороги й зони мишкою, станція, ріст, будинок і родини, панелі,
// лабораторія даних, податки в журналі, збереження у файл, відкриття з файлу, ручні зміни, телефон.
//   node tests/city-e2e.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, launch, newPage, step } from './_harness.mjs';

const server = await startServer();
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const p = await newPage(ctx, errors);
p.setDefaultTimeout(15000);
await p.goto(server.url + '/emulators/city');
await p.evaluate(() => localStorage.clear());
await p.reload();
const S = (q = p) => q.evaluate(() => JSON.parse(JSON.stringify(window.CitySim.city.s)));
const N = 56;
// центр клітинки на екрані
const at = (x, y) => p.evaluate(([x, y]) => { const R = window.CitySim.renderer, [sx, sy] = R.tileTop(x, y), r = document.querySelector('#map').getBoundingClientRect(); return [r.left + sx, r.top + sy + 16 * R.cam.z]; }, [x, y]);
const drag = async (a, b) => { const [x0, y0] = await at(...a), [x1, y1] = await at(...b); await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 }); await p.mouse.move(x1, y1, { steps: 4 }); await p.mouse.up(); };
const click = async (x, y) => { const [sx, sy] = await at(x, y); await p.mouse.click(sx, sy); };
let site; // ділянка для будівництва

await step('стартовий екран: без імені не пускає, потім засновує місто', async () => {
  await p.waitForSelector('.start .sc');
  assert.equal(await p.locator('.start .sc').count(), 5, 'п’ять режимів');
  await p.click('[data-s-go]');
  assert.match(await p.locator('#toast').innerText(), /ім’я/);
  await p.fill('[data-v="name"]', 'Річкове');
  await p.fill('[data-v="mayor"]', 'Олена Коваль');
  await p.fill('[data-v="group"]', '7-А');
  await p.click('.sc[data-s="free"]');
  await p.click('[data-s-go]');
  await p.waitForSelector('body:not(.start-on) #top .top-in, body:not(.start-on) #top');
  await p.waitForFunction(() => !document.querySelector('.start'));
  const s = await S();
  assert.equal(s.name, 'Річкове'); assert.deepEqual(s.mayor, { name: 'Олена Коваль', group: '7-А' }); assert.equal(s.scenario, 'free');
  assert.ok(Object.values(s.bld).some(b => b.type === 'townhall'), 'є мерія');
  assert.match(await p.locator('#top').innerText(), /Річкове/);
  await p.evaluate(() => { window.CitySim.ui.speed = 0; });
});

await step('ділянка: вільна смуга від дороги біля мерії', async () => {
  site = await p.evaluate(() => {
    const s = window.CitySim.city.s, N = 56, free = (x, y) => x >= 0 && y >= 0 && x < N && y < N && s.ter[y * N + x] !== 1 && !s.road[y * N + x] && !s.bid[y * N + x];
    for (let y = 2; y < N - 6; y++) for (let x = 2; x < N - 14; x++) {
      if (!s.road[y * N + x - 1]) continue; // дорога зліва — приєднуємось до мережі
      let ok = true; for (let dy = 0; dy < 4 && ok; dy++) for (let dx = 0; dx < 12; dx++) if (!free(x + dx, y + dy)) { ok = false; break; }
      if (ok) return { x, y };
    }
    return null;
  });
  assert.ok(site, 'знайдено ділянку');
  await p.evaluate(({ x, y }) => { window.CitySim.renderer.cam.z = 1; window.CitySim.renderer.center(x + 6, y + 2); }, site);
});

await step('дорога: тягнемо мишкою, гроші списуються', async () => {
  const m0 = (await S()).money;
  await p.click('[data-act="cat"][data-k="road"]');
  assert.ok(await p.locator('.fly.on [data-act="tool"][data-k="road"].on').count());
  await drag([site.x, site.y], [site.x + 11, site.y]);
  const s = await S();
  for (let dx = 0; dx < 12; dx++) assert.equal(s.road[site.y * N + site.x + dx], 1, `дорога в клітинці ${dx}`);
  assert.ok(s.money < m0);
  assert.ok(s.journal.some(j => /^Прокладено дорогу 12 клітинок/.test(j.t)), 'журнал рішень');
});

await step('житлова зона прямокутником', async () => {
  await p.click('[data-act="cat"][data-k="zone"]');
  await p.click('[data-act="tool"][data-k="zr"]');
  await drag([site.x, site.y + 1], [site.x + 5, site.y + 2]);
  const s = await S();
  let n = 0; for (let dy = 1; dy <= 2; dy++) for (let dx = 0; dx <= 5; dx++) n += s.zone[(site.y + dy) * N + site.x + dx] === 1;
  assert.equal(n, 12);
  assert.ok((await S()).journal.some(j => /^Позначено житлову зону 12 ділянок/.test(j.t)));
});

await step('станція: меню з мініатюрами, будівництво клацанням', async () => {
  await p.click('[data-act="cat"][data-k="power"]');
  assert.equal(await p.locator('.fly.on .fi img').count(), 5, 'мініатюри станцій');
  await p.click('[data-act="tool"][data-k="b_coal"]');
  await click(site.x + 8, site.y + 2); // клацаємо в центр майбутньої станції 3×3
  const s = await S();
  const coal = Object.values(s.bld).find(b => b.type === 'coal');
  assert.ok(coal, 'ТЕС збудовано'); assert.deepEqual([coal.x, coal.y], [site.x + 7, site.y + 1]);
  await p.keyboard.press('Escape');
  assert.equal(await p.evaluate(() => window.CitySim.ui.tool), 'select');
});

await step('місто росте: будинки, жителі, родини', async () => {
  await p.evaluate(() => { const C = window.CitySim.city; for (let d = 0; d < 30 * 8; d++) C.tick(); C.recompute(); });
  const s = await S();
  let built = 0; for (let dy = 1; dy <= 2; dy++) for (let dx = 0; dx <= 5; dx++) built += s.lvl[(site.y + dy) * N + site.x + dx] > 0;
  assert.ok(built >= 6, `виросли будинки (${built})`);
  assert.ok(s.families.length > 0, 'з’явились родини');
  assert.ok(s.history.length >= 8, 'історія місяців');
});

await step('будинок: клацання показує родину й думки', async () => {
  const i = await p.evaluate(({ x, y }) => { const s = window.CitySim.city.s; for (let dy = 1; dy <= 2; dy++) for (let dx = 0; dx <= 5; dx++) { const i = (y + dy) * 56 + x + dx; if (s.families.some(f => f.i === i)) return i; } return -1; }, site);
  assert.ok(i >= 0);
  await click(i % N, Math.floor(i / N));
  await p.waitForSelector('#insp.on');
  const t = await p.locator('#insp').innerText();
  assert.match(t, /Родина/); assert.match(t, /Щастя/); assert.match(t, /«.+»/);
  await p.click('[data-act="inspClose"]');
  assert.equal(await p.locator('#insp.on').count(), 0);
});

await step('усі панелі відкриваються', async () => {
  const want = { overview: /Жителі[\s\S]*У казні/, budget: /Податки[\s\S]*Фінансування служб/, charts: /Населення/, lab: /кореляц/i, advisors: /Радники/, people: /Настрій міста/, inbox: /./, policies: /Політики/, mission: /Досягнення/, report: /Олена Коваль[\s\S]*7-А/, help: /Для викладача/ };
  for (const [k, re] of Object.entries(want)) {
    await p.click(`.rl[data-k="${k}"]`);
    await p.waitForSelector('#panel.on');
    assert.match(await p.locator('#panel').innerText(), re, `панель ${k}`);
  }
});

await step('лабораторія даних: гіпотеза дає діаграму й r', async () => {
  await p.click('.rl[data-k="lab"]');
  await p.click('[data-act="hyp"] >> nth=0');
  assert.ok(await p.locator('#panel svg.chart').count());
  assert.match(await p.locator('#panel').innerText(), /r\s*=\s*[−-]?\d/);
});

await step('податок: повзунок змінює ставку й пишеться в журнал', async () => {
  await p.click('.rl[data-k="budget"]');
  const el = p.locator('[data-in="tax"][data-k="r"]');
  await el.evaluate(e => { e.value = 12; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
  const s = await S();
  assert.equal(s.taxes.r, 12);
  assert.ok(s.journal.some(j => /Податок «житло»: 12%/.test(j.t)));
});

await step('політика вмикається й записується', async () => {
  await p.click('.rl[data-k="policies"]');
  await p.click('[data-act="policy"] >> nth=0');
  const s = await S();
  assert.equal(Object.values(s.policies).filter(Boolean).length, 1);
});

let file;
await step('збереження: файл з повним станом і латинською назвою', async () => {
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#top [data-act="saveFile"]')]);
  assert.match(dl.suggestedFilename(), /^city_Richkove_Olena-Koval_\d{4}-\d{2}\.json$/);
  file = await dl.path();
  const d = JSON.parse(fs.readFileSync(file, 'utf8')), cur = await S();
  assert.equal(d.app, 'edvault-city'); assert.equal(d.format, 1);
  assert.deepEqual(d.state, cur, 'у файлі повний стан міста');
  assert.equal(d.summary['Учень (мер)'], 'Олена Коваль');
  assert.ok(d.integrity);
});

await step('відкриття з файлу на чистій сторінці', async () => {
  const q = await newPage(await browser.newContext({ viewport: { width: 1280, height: 800 } }), errors);
  await q.goto(server.url + '/emulators/city'); await q.evaluate(() => localStorage.clear()); await q.reload();
  await q.waitForSelector('.start [data-s-open]');
  const [fc] = await Promise.all([q.waitForEvent('filechooser'), q.click('.start [data-s-open]')]);
  await fc.setFiles(file);
  await q.waitForSelector('.md.file-open');
  assert.match(await q.locator('.md.file-open').innerText(), /Олена Коваль[\s\S]*Річкове[\s\S]*Файл цілий/);
  await q.click('.md.file-open [data-f="play"]');
  await q.waitForFunction(() => !document.querySelector('.start'));
  const a = await S(q), b = JSON.parse(fs.readFileSync(file, 'utf8')).state;
  assert.equal(a.name, 'Річкове'); assert.equal(a.month, b.month); assert.deepEqual(a.road, b.road); assert.deepEqual(a.journal, b.journal);
  await q.reload(); await q.waitForFunction(() => window.CitySim.city && !window.CitySim.city.s.flags.demo);
  assert.equal(await q.evaluate(() => window.CitySim.city.s.name), 'Річкове', 'місто лишається після перезавантаження');

  // файл змінено вручну → попередження у вікні та у звіті
  const d = JSON.parse(fs.readFileSync(file, 'utf8')); d.state.money = 99999999;
  const f2 = path.join(os.tmpdir(), 'city-edited.json'); fs.writeFileSync(f2, JSON.stringify(d));
  await q.click('.rl[data-k="report"]');
  const [fc2] = await Promise.all([q.waitForEvent('filechooser'), q.click('#panel [data-act="openFile"]')]);
  await fc2.setFiles(f2);
  await q.waitForSelector('.md.file-open');
  assert.match(await q.locator('.md.file-open').innerText(), /змінювали вручну[\s\S]*буде замінено/);
  await q.click('.md.file-open [data-f="report"]');
  await q.waitForSelector('#panel.on');
  assert.equal(await q.evaluate(() => window.CitySim.city.s.money), 99999999);
  assert.equal(await q.evaluate(() => window.CitySim.ui.panel), 'report');

  // зіпсований файл — зрозуміла помилка, місто не змінюється
  const f3 = path.join(os.tmpdir(), 'city-bad.json'); fs.writeFileSync(f3, '{"app":"edvault-city","state":{"x":1}}');
  const [fc3] = await Promise.all([q.waitForEvent('filechooser'), q.click('#panel [data-act="openFile"]')]);
  await fc3.setFiles(f3);
  await q.waitForFunction(() => /пошкоджений|не збереження/.test(document.querySelector('#toast').innerText));
  assert.equal(await q.evaluate(() => window.CitySim.city.s.money), 99999999);
  const f4 = path.join(os.tmpdir(), 'city-other.json'); fs.writeFileSync(f4, '{"app":"edvault-startup","state":{}}');
  const [fc4] = await Promise.all([q.waitForEvent('filechooser'), q.click('#panel [data-act="openFile"]')]);
  await fc4.setFiles(f4);
  await q.waitForFunction(() => /стартапу/.test(document.querySelector('#toast').innerText));
  await q.context().close();
});

await step('нове місто: підтвердження й стартовий екран', async () => {
  await p.click('.rl[data-k="report"]');
  await p.click('#panel [data-act="newGame"]');
  await p.waitForSelector('.md');
  await p.click('.md .btn.danger, .md [data-md-ok]');
  await p.waitForSelector('.start .sc');
});

await step('телефон: без горизонтальної прокрутки, меню й панелі вміщаються', async () => {
  const q = await newPage(await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), errors);
  await q.goto(server.url + '/emulators/city'); await q.evaluate(() => localStorage.clear()); await q.reload();
  await q.waitForSelector('.start .sc');
  await q.evaluate(async () => { const { newCity } = await import('/emulators/citysim/js/sim.js'); const { autoplay } = await import('/emulators/citysim/js/bots.js'); const C = newCity({ seed: 42, name: 'Сонячне', mayor: 'Тест' }); window.CitySim.begin(C); autoplay(C, 24); C.recompute(); window.CitySim.ui.speed = 0; });
  const over = () => q.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.equal(await over(), 0);
  await q.click('[data-act="cat"][data-k="power"]');
  const fb = await q.locator('.fly.on').boundingBox(); assert.ok(fb.x >= 0 && fb.x + fb.width <= 390);
  await q.click('.rl[data-k="overview"]');
  const pb = await q.locator('#panel.on').boundingBox(); assert.ok(pb.x >= 0 && pb.x + pb.width <= 390);
  assert.equal(await over(), 0);
  await q.context().close();
});

await step('жодної помилки в консолі', async () => { assert.deepEqual(errors, []); });

await browser.close(); server.close();
