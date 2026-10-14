// Браузерна перевірка аніматора: стартове вікно, малювання й Ctrl+Z, копія кадру й калька, тривалість кадру,
// шари (додати, сховати, порядок), заливка, виділення й перенесення, програвання, урок з напрямними,
// експорт GIF і PNG, збереження у файл і відкриття, автозбереження після перезавантаження, телефон.
//   node tests/animator-e2e.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startServer, launch, newPage, step } from './_harness.mjs';
import { inspectGif } from '../tools/animator-app/js/gif.js';

const server = await startServer();
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const p = await newPage(ctx, errors);
p.setDefaultTimeout(15000);
await p.goto(server.url + '/tools/animator');
await p.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('edvault-animator'); });
await p.reload();
await p.waitForFunction(() => window.Animator && window.Animator.P);

const st = () => p.evaluate(() => { const { P, S, hist } = window.Animator; return { frames: P.frames.length, layers: P.layers.map(l => l.name), fi: S.fi, li: S.li, tool: S.tool, holds: P.frames.map(f => f.hold), undo: hist.canUndo, playing: S.playing, title: P.title, author: P.author }; });
// скільки непрозорих пікселів у клітинці (шар li, кадр fi)
const ink = (li, fi) => p.evaluate(([li, fi]) => {
  const { P } = window.Animator, c = P.layers[li].cells.get(P.frames[fi].id);
  if (!c || !c.canvas) return 0;
  const d = c.canvas.getContext('2d').getImageData(0, 0, c.canvas.width, c.canvas.height).data;
  let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++; return n;
}, [li, fi]);
// колір пікселя в документних координатах на шарі
const px = (li, fi, x, y) => p.evaluate(([li, fi, x, y]) => {
  const { P } = window.Animator, c = P.layers[li].cells.get(P.frames[fi].id);
  if (!c || !c.canvas) return [0, 0, 0, 0];
  return [...c.canvas.getContext('2d').getImageData(x, y, 1, 1).data];
}, [li, fi, x, y]);
let box;
const D = (x, y) => p.evaluate(([x, y]) => { const { stage } = window.Animator, r = stage.cv.getBoundingClientRect(); return [r.left + stage.view.x + x * stage.view.z, r.top + stage.view.y + y * stage.view.z]; }, [x, y]);
const drag = async (pts, steps = 6) => { await p.mouse.move(...await D(...pts[0])); await p.mouse.down(); for (const q of pts.slice(1)) await p.mouse.move(...await D(...q), { steps }); await p.mouse.up(); await p.waitForTimeout(60); };

await step('стартове вікно: розмір аркуша, назва, автор', async () => {
  await p.locator('.md-wrap').waitFor();
  await p.click('[data-size="square"]');
  await p.fill('[data-st="title"]', 'Стрибок м’яча');
  await p.fill('[data-st="author"]', 'Олена Коваль');
  await p.click('[data-go]');
  await p.waitForSelector('.md-wrap', { state: 'detached' });
  const s = await st();
  assert.equal(s.title, 'Стрибок м’яча'); assert.equal(s.author, 'Олена Коваль');
  assert.deepEqual(await p.evaluate(() => [window.Animator.P.w, window.Animator.P.h]), [720, 720]);
  assert.deepEqual(s.layers, ['Фон', 'Персонаж']); assert.equal(s.li, 1);
  box = await p.locator('#view').boundingBox();
});

await step('аркуш видно цілком', async () => {
  const [x0, y0] = await D(0, 0), [x1, y1] = await D(720, 720);
  assert.ok(x0 >= box.x && y0 >= box.y && x1 <= box.x + box.width && y1 <= box.y + box.height);
});

await step('пензель малює, Ctrl+Z прибирає, Ctrl+Shift+Z повертає', async () => {
  await drag([[200, 200], [300, 260], [420, 220]]);
  const n = await ink(1, 0); assert.ok(n > 300, 'є лінія: ' + n);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  assert.equal(await ink(1, 0), 0);
  await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(100);
  assert.equal(await ink(1, 0), n);
});

await step('копія кадру (D) і новий порожній (N), калька показує попередній', async () => {
  await p.keyboard.press('d'); await p.waitForTimeout(150);
  let s = await st(); assert.equal(s.frames, 2); assert.equal(s.fi, 1);
  assert.equal(await ink(1, 1), await ink(1, 0), 'копія однакова');
  await p.keyboard.press('n'); await p.waitForTimeout(150);
  s = await st(); assert.equal(s.frames, 3); assert.equal(s.fi, 2);
  assert.equal(await ink(1, 2), 0, 'новий кадр порожній');
  // калька: на екрані видно лінію з попереднього кадру
  const seen = await p.evaluate(() => { const { stage } = window.Animator; return !!stage.onion; });
  assert.ok(seen, 'калька зібрана');
  await p.waitForSelector('.fr[data-frame="2"] canvas');
});

await step('плівка: клік вибирає кадр, кома й крапка гортають', async () => {
  await p.click('.fr[data-frame="0"]'); assert.equal((await st()).fi, 0);
  await p.keyboard.press('.'); assert.equal((await st()).fi, 1);
  await p.keyboard.press(','); assert.equal((await st()).fi, 0);
  await p.keyboard.press('End'); assert.equal((await st()).fi, 2);
});

await step('меню кадру: довше в 3 рази, видалити, Ctrl+Z повертає', async () => {
  await p.click('.fr[data-frame="1"]', { button: 'right' });
  await p.click('#pop [data-v="hold3"]');
  let s = await st(); assert.deepEqual(s.holds, [1, 3, 1]);
  await p.waitForSelector('.fr[data-frame="1"] .hold');
  await p.click('.fr[data-frame="2"]', { button: 'right' });
  await p.click('#pop [data-v="del"]');
  s = await st(); assert.equal(s.frames, 2);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  assert.equal((await st()).frames, 3);
});

await step('перетягування кадру на плівці змінює порядок', async () => {
  const ids = () => p.evaluate(() => window.Animator.P.frames.map(f => f.id));
  const before = await ids();
  const a = await p.locator('.fr[data-frame="0"]').boundingBox(), b = await p.locator('.fr[data-frame="2"]').boundingBox();
  await p.mouse.move(a.x + 40, a.y + 40); await p.mouse.down();
  await p.mouse.move(a.x + 80, a.y + 40, { steps: 4 }); await p.mouse.move(b.x + b.width - 10, b.y + 40, { steps: 8 }); await p.mouse.up();
  const after = await ids();
  assert.deepEqual(after, [before[1], before[2], before[0]]);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  assert.deepEqual(await ids(), before);
});

await step('шари: новий, сховати, вище й нижче, прозорість', async () => {
  await p.click('[data-act="layerAdd"]');
  let s = await st(); assert.equal(s.layers.length, 3); assert.equal(s.li, 2);
  await p.click('[data-act="layerDown"]'); s = await st(); assert.equal(s.li, 1); assert.equal(s.layers[1], 'Шар 3');
  await p.click('[data-act="layerUp"]'); s = await st(); assert.equal(s.li, 2);
  await p.click('[data-lvis="2"]');
  assert.equal(await p.evaluate(() => window.Animator.P.layers[2].visible), false);
  await p.click('[data-lvis="2"]');
  await p.click('[data-act="layerDel"]'); await p.click('.md [data-v="1"]');
  s = await st(); assert.equal(s.layers.length, 2);
  await p.click('[data-layer="1"]');
});

await step('заливка на шарі «Фон» зупиняється на контурі з шару «Персонаж»', async () => {
  await p.click('.fr[data-frame="0"]');
  await p.keyboard.press('b');
  await p.click('#brushBtn'); await p.click('#pop [data-v="pen"]');
  await drag([[100, 100], [300, 100], [300, 300], [100, 300], [100, 100]], 10);
  await p.click('[data-layer="0"]');
  await p.keyboard.press('g');
  await p.click('[data-color="#facc15"]');
  await p.mouse.click(...await D(200, 200)); await p.waitForTimeout(150);
  const inside = await px(0, 0, 200, 200), outside = await px(0, 0, 500, 500);
  assert.deepEqual(inside.slice(0, 3), [250, 204, 21]);
  assert.equal(outside[3], 0, 'поза контуром не залито');
  await p.click('[data-layer="1"]');
});

await step('виділення: обвести, перенести, «Готово»', async () => {
  await p.keyboard.press('s');
  const n0 = await ink(1, 0);
  await drag([[80, 80], [330, 330]]);
  await p.waitForFunction(() => !!window.Animator.stage.float);
  await drag([[200, 200], [500, 500]]);
  await p.click('[data-float="done"]');
  assert.equal(await p.evaluate(() => window.Animator.stage.float), null);
  const n1 = await ink(1, 0);
  assert.ok(Math.abs(n1 - n0) < n0 * 0.05, 'малюнок не загубився');
  assert.equal((await px(1, 0, 100, 200))[3], 0, 'старе місце порожнє');
  assert.ok((await px(1, 0, 400, 500))[3] > 0, 'контур на новому місці');
});

await step('програвання: пробіл грає й зупиняє, лічильник змінюється', async () => {
  await p.keyboard.press('Space');
  await p.waitForFunction(() => window.Animator.S.playing);
  await p.waitForTimeout(700);
  await p.keyboard.press('Space');
  assert.equal((await st()).playing, false);
  await p.waitForSelector('#count');
});

await step('експорт GIF: файл відкривається, кадрів стільки, скільки треба', async () => {
  await p.click('[data-act="export"]');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-ex="gif"]')]);
  assert.match(dl.suggestedFilename(), /^multik_.+\.gif$/);
  const g = inspectGif(new Uint8Array(await readFile(await dl.path())));
  assert.equal(g.width, 720); assert.equal(g.height, 720);
  assert.ok(g.frames >= 2 && g.frames <= 3, 'кадрів: ' + g.frames);
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('[data-ex="png"]')]);
  assert.match(dl2.suggestedFilename(), /kadr-1\.png$/);
  await p.click('.md [data-close]');
});

let saved;
await step('збереження у файл .edanim і відкриття', async () => {
  const [dl] = await Promise.all([p.waitForEvent('download'), p.keyboard.press('Control+s')]);
  assert.match(dl.suggestedFilename(), /^multik_.+_\d{4}-\d\d-\d\d\.edanim$/);
  saved = await dl.path();
  const before = await st();
  // ламаємо проєкт, потім відкриваємо файл
  await p.keyboard.press('n'); await p.keyboard.press('n');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.keyboard.press('Control+o')]);
  await fc.setFiles({ name: 'm.edanim', mimeType: 'application/zip', buffer: await readFile(saved) });
  await p.click('.md [data-go]');
  await p.waitForFunction(n => window.Animator.P.frames.length === n, before.frames);
  const s = await st();
  assert.deepEqual(s.holds, before.holds); assert.equal(s.title, before.title);
  await p.waitForTimeout(300);
  assert.ok(await p.evaluate(async () => { const { P } = window.Animator, c = P.layers[0].cells.get(P.frames[0].id); await c.load(); return !c.empty; }), 'заливка на місці');
});

await step('автозбереження: після перезавантаження мультфільм на місці', async () => {
  const before = await st();
  await p.evaluate(() => new Promise(r => setTimeout(r, 1600)));
  await p.reload();
  await p.waitForFunction(() => window.Animator && window.Animator.P && window.Animator.P.title !== 'Мій мультфільм');
  const s = await st();
  assert.equal(s.frames, before.frames); assert.equal(s.title, before.title); assert.deepEqual(s.holds, before.holds);
  assert.equal(await p.locator('.md-wrap').count(), 0, 'стартове вікно не відкривається');
});

await step('урок «М’яч»: напрямні й картка з кроками', async () => {
  await p.click('[data-act="lessons"]');
  await p.click('[data-lesson="ball"]');
  await p.click('.md [data-v="1"]');
  await p.waitForFunction(() => window.Animator.P.lesson === 'ball');
  const s = await st(); assert.equal(s.frames, 16);
  await p.locator('#lessonCard:not([hidden])').waitFor();
  assert.ok(await p.evaluate(() => Array.isArray(window.Animator.app.guides) && window.Animator.app.guides.length === 16));
});

// далі — інструменти малювання, кожен на новому порожньому кадрі
const fresh = async () => { await p.keyboard.press('Escape'); await p.keyboard.press('n'); await p.waitForTimeout(80); return (await st()).fi; };
const setS = o => p.evaluate(o => Object.assign(window.Animator.S, o), o);

await step('усі шість пензлів малюють, у туші кінці тонші за середину', async () => {
  const fi = await fresh();
  await p.keyboard.press('b');
  for (const [i, br] of ['pencil', 'pen', 'marker', 'calli', 'chalk', 'air'].entries()) {
    await setS({ brush: br, size: 12, stabilizer: 0, color: '#1d2236', opacity: 1 });
    const y = 60 + i * 60, before = await ink(1, fi);
    await drag([[60, y], [200, y], [340, y]], 12);
    assert.ok(await ink(1, fi) > before + 50, 'пензель ' + br);
  }
  // туш: товщина посередині більша, ніж біля кінця
  const col = x => p.evaluate(([fi, x]) => { const { P } = window.Animator, c = P.layers[1].cells.get(P.frames[fi].id).canvas, d = c.getContext('2d').getImageData(x, 90, 1, 60).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++; return n; }, [fi, x]);
  assert.ok(await col(200) > await col(64), 'звуження на кінці');
});

await step('заливка: щілина в контурі — без закриття витікає, з «Великі» лишається всередині', async () => {
  const fi = await fresh();
  await setS({ brush: 'pen', size: 4, stabilizer: 0, color: '#1d2236', alphaLock: false });
  await p.keyboard.press('b');
  // квадрат із розривом 5 px у верхній стороні
  await drag([[205, 100], [300, 100], [300, 300], [100, 300], [100, 100], [195, 100]], 10);
  await p.keyboard.press('g');
  await p.click('[data-set="fillAll"][data-v="false"]');
  await p.click('[data-set="fillGap"][data-v="0"]');
  await p.click('[data-color="#22c55e"]');
  await p.mouse.click(...await D(200, 200)); await p.waitForTimeout(150);
  assert.ok((await px(1, fi, 400, 400))[3] > 0, 'без закриття щілин фарба витекла');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(150);
  assert.equal((await px(1, fi, 400, 400))[3], 0);
  await p.click('[data-set="fillGap"][data-v="7"]');
  await p.mouse.click(...await D(200, 200)); await p.waitForTimeout(150);
  assert.deepEqual((await px(1, fi, 200, 200)).slice(0, 3), [34, 197, 94]);
  assert.equal((await px(1, fi, 400, 400))[3], 0, 'назовні не витекло');
  await p.click('[data-set="fillGap"][data-v="0"]'); await p.click('[data-set="fillAll"][data-v="true"]');
});

await step('ласо-заливка (A): обведена область зафарбована', async () => {
  const fi = await fresh();
  await p.keyboard.press('a');
  assert.equal((await st()).tool, 'lasso');
  await p.click('[data-color="#e5484d"]');
  await drag([[100, 100], [300, 100], [200, 280], [100, 100]], 10);
  assert.deepEqual((await px(1, fi, 200, 160)).slice(0, 4), [229, 72, 77, 255]);
  assert.equal((await px(1, fi, 120, 260))[3], 0, 'поза ласо порожньо');
});

await step('«Лише по малюнку»: фарба лягає тільки на намальоване', async () => {
  const fi = await fresh();
  await p.keyboard.press('a'); await p.click('[data-color="#1d2236"]');
  await drag([[100, 100], [200, 100], [200, 200], [100, 200], [100, 100]], 6);
  await p.keyboard.press('b');
  await setS({ brush: 'marker', size: 30, opacity: 1 });
  await p.click('[data-toggle="alphaLock"]');
  await p.click('[data-color="#facc15"]');
  await drag([[50, 150], [250, 150]], 10);
  const inside = await px(1, fi, 150, 150), outside = await px(1, fi, 60, 150);
  assert.equal(outside[3], 0, 'поза малюнком не з’явилось');
  assert.ok(inside[0] > 100 && inside[1] > 100, 'на малюнку жовтіє: ' + inside);
  await p.click('[data-toggle="alphaLock"]');
});

await step('затримати пензель у кінці — лінія стає прямою', async () => {
  const fi = await fresh();
  await setS({ brush: 'pen', size: 6, stabilizer: 0, color: '#1d2236' });
  await p.mouse.move(...await D(100, 400)); await p.mouse.down();
  for (let k = 1; k <= 20; k++) await p.mouse.move(...await D(100 + k * 15, 400 + (k % 2 ? 25 : -25)), { steps: 2 });
  await p.mouse.move(...await D(420, 400), { steps: 2 });
  await p.waitForTimeout(800);
  await p.mouse.up(); await p.waitForTimeout(100);
  assert.ok((await px(1, fi, 250, 400))[3] > 200, 'середина прямої');
  assert.equal((await px(1, fi, 250, 425))[3], 0, 'зигзагу немає');
});

await step('Shift+клік — пряма від кінця попередньої лінії', async () => {
  const fi = await fresh();
  await drag([[100, 100], [104, 100]]);
  await p.keyboard.down('Shift'); await p.mouse.click(...await D(400, 100)); await p.keyboard.up('Shift');
  await p.waitForTimeout(80);
  assert.ok((await px(1, fi, 250, 100))[3] > 200);
});

await step('виділення: поворот на 90° і ласо-виділення', async () => {
  const fi = await fresh();
  await setS({ brush: 'marker', size: 10, opacity: 1 });
  await drag([[100, 200], [300, 200]], 10); // горизонтальна смуга
  await p.keyboard.press('s');
  await p.click('[data-set="selMode"][data-v="rect"]');
  await drag([[80, 180], [320, 220]]);
  await p.waitForFunction(() => !!window.Animator.stage.float);
  await p.click('[data-float="rot90"]');
  await p.click('[data-float="done"]');
  assert.ok((await px(1, fi, 200, 120))[3] > 0, 'після повороту смуга вертикальна');
  assert.equal((await px(1, fi, 120, 200))[3], 0, 'горизонтальної вже немає');
  // ласо: обвести лише верхню половину й посунути праворуч
  await p.click('[data-set="selMode"][data-v="lasso"]');
  await drag([[170, 90], [230, 90], [230, 195], [170, 195], [170, 90]], 8);
  await p.waitForFunction(() => !!window.Animator.stage.float);
  await drag([[200, 140], [500, 140]], 8);
  await p.click('[data-float="done"]');
  assert.ok((await px(1, fi, 500, 140))[3] > 0, 'верхня частина переїхала');
  assert.ok((await px(1, fi, 200, 260))[3] > 0, 'нижня лишилась на місці');
  await p.click('[data-set="selMode"][data-v="rect"]');
});

await step('планшет: дотик двома пальцями — скасувати, трьома — повторити', async () => {
  await p.keyboard.press('b');
  const fi = await fresh();
  await drag([[100, 100], [300, 120]]);
  const n = await ink(1, fi);
  const tap = k => p.evaluate(k => {
    const cv = document.querySelector('#view'), r = cv.getBoundingClientRect(), ev = (t, id, i) => cv.dispatchEvent(new PointerEvent(t, { pointerId: 50 + id, pointerType: 'touch', clientX: r.left + 200 + i * 40, clientY: r.top + 200, bubbles: true, isPrimary: id === 0 }));
    for (let i = 0; i < k; i++) ev('pointerdown', i, i);
    for (let i = 0; i < k; i++) ev('pointerup', i, i);
  }, k);
  await tap(2); await p.waitForTimeout(150);
  assert.equal(await ink(1, fi), 0, 'скасовано');
  await tap(3); await p.waitForTimeout(150);
  assert.equal(await ink(1, fi), n, 'повторено');
});

await step('телефон: без горизонтальної прокрутки, аркуш видно, панель шарів висувається', async () => {
  const q = await newPage(await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), errors);
  await q.goto(server.url + '/tools/animator');
  await q.waitForFunction(() => window.Animator && window.Animator.P);
  await q.click('[data-go]');
  assert.equal(await q.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  const v = await q.locator('#view').boundingBox();
  assert.ok(v.width > 300 && v.height > 200, 'полотно помітне');
  await q.click('[data-act="side"]');
  await q.waitForFunction(() => document.querySelector('#side').classList.contains('open'));
  await q.context().close();
});

await step('жодної помилки в консолі', async () => assert.deepEqual(errors, []));

await browser.close(); server.close();
