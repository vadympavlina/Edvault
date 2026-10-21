// Браузерна перевірка плавності й «без глюків» емулятора Windows: вікна (подвійний клік, розгортання, краї
// екрана, менший браузер, панель завдань, тисячі перемикань, сенсорний екран), скасування файлових дій Ctrl+Z,
// усі програми на мінімальному розмірі вікна, вартість перемикання вікон і друку у великому файлі.
//   node tests/winux-e2e.mjs
import assert from 'node:assert/strict';
import { startServer, launch, newPage, signIn, step } from './_harness.mjs';

const srv = await startServer(), b = await launch();
const errs = [];
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await newPage(ctx, errs);
await p.goto(srv.url + '/emulators/windows'); await p.evaluate(() => localStorage.clear()); await p.reload(); await signIn(p);
const W = () => p.evaluate(() => window.WinEmu.WM.wins.map(w => { const r = w.el.getBoundingClientRect(); return { app: w.app, min: w.min, max: w.max, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), z: w.z, act: w.el.classList.contains('active') }; }));
const open = a => p.evaluate(a => { window.WinEmu.sys.open(a); }, a);
const tb = async () => (await p.locator('#taskbar').boundingBox());

await step('подвійний клік по заголовку ×4: розгорнути/відновити, розмір повертається', async () => {
  await open('explorer'); await p.waitForTimeout(300);
  const before = (await W())[0];
  const t = await p.locator('.win[data-app="explorer"] .win-title').boundingBox();
  for (let i = 0; i < 4; i++) { const tt = await p.locator('.win[data-app="explorer"] .win-title').boundingBox(); await p.mouse.dblclick(tt.x + 200, tt.y + 15); await p.waitForTimeout(600); assert.equal((await W())[0].max, i % 2 === 0, "крок " + i); }
  const after = (await W())[0];
  assert.equal(after.max, false); assert.deepEqual([after.x, after.y, after.w, after.h], [before.x, before.y, before.w, before.h]);
});
await step('розгорнуте вікно не заходить під панель завдань', async () => {
  const t = await p.locator('.win[data-app="explorer"] .win-title').boundingBox();
  await p.mouse.dblclick(t.x + 200, t.y + 15); await p.waitForTimeout(250);
  const w = (await W())[0], bar = await tb();
  assert.ok(w.max); assert.ok(w.y + w.h <= bar.y + 1, `низ вікна ${w.y + w.h}, панель ${bar.y}`); assert.ok(w.x >= 0 && w.w <= 1440);
  // простий клік по заголовку розгорнутого вікна не повинен його відновлювати
  await p.mouse.click(400, 15); await p.waitForTimeout(250);
  assert.ok((await W())[0].max, 'клік по заголовку не «відклеює» вікно');
  await p.mouse.dblclick(400, 15); await p.waitForTimeout(250);
  assert.ok(!(await W())[0].max);
});
await step('вікно не можна витягнути за верх чи сховати заголовок під панель', async () => {
  const t = await p.locator('.win[data-app="explorer"] .win-title').boundingBox();
  await p.mouse.move(t.x + 200, t.y + 15); await p.mouse.down(); await p.mouse.move(700, 2000, { steps: 8 }); await p.mouse.up();
  let w = (await W())[0], bar = await tb();
  assert.ok(w.y + 30 <= bar.y, `заголовок під панеллю: y=${w.y}`);
  const t2 = await p.locator('.win[data-app="explorer"] .win-title').boundingBox();
  await p.mouse.move(t2.x + 200, t2.y + 15); await p.mouse.down(); await p.mouse.move(-3000, t2.y + 15, { steps: 8 }); await p.mouse.up();
  w = (await W())[0]; assert.ok(w.x + w.w >= 100, `вікно пішло за лівий край: x=${w.x}`);
});
await step('браузер став меншим — вікна повертаються на екран', async () => {
  await p.evaluate(() => { const w = window.WinEmu.WM.wins[0]; w.el.style.left = '1100px'; w.el.style.top = '500px'; });
  await p.setViewportSize({ width: 900, height: 600 }); await p.waitForTimeout(400);
  const w = (await W())[0]; assert.ok(w.x < 900 - 100 && w.y < 600 - 60, JSON.stringify(w));
  await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(300);
});
await step('згорнути все й відкрити з панелі; клік по активному згортає', async () => {
  await open('cmd'); await open('notepad'); await p.waitForTimeout(300);
  for (const a of ['explorer', 'cmd', 'notepad']) { await p.click(`.tb-app[data-app="${a}"]`); }
  let ws = await W(); const act = ws.find(w => w.act);
  await p.click(`.tb-app[data-app="${act.app}"]`); await p.waitForTimeout(100);
  ws = await W(); assert.ok(ws.find(w => w.app === act.app).min, 'активне згорнулось');
  await p.click(`.tb-app[data-app="${act.app}"]`); await p.waitForTimeout(100);
  ws = await W(); assert.ok(!ws.find(w => w.app === act.app).min && ws.find(w => w.app === act.app).act);
});
await step('швидкі кліки по панелі ×60 — рівно одне активне вікно, жодного «загубленого»', async () => {
  for (let i = 0; i < 60; i++) await p.click(`.tb-app[data-app="${['explorer', 'cmd', 'notepad'][i % 3]}"]`, { delay: 0 });
  await p.waitForTimeout(200);
  const ws = await W(); assert.equal(ws.filter(w => w.act).length <= 1, true);
  const vis = ws.filter(w => !w.min); if (vis.length) assert.equal(ws.filter(w => w.act).length, 1);
});
await step('6000 перемикань: вікна ніколи не вище за панель завдань і меню', async () => {
  await p.evaluate(() => { const { WM } = window.WinEmu; for (let i = 0; i < 6000; i++) WM.focus(WM.wins[i % WM.wins.length]); });
  await p.click('#startBtn'); await p.waitForTimeout(200);
  const top = await p.evaluate(() => { const r = document.querySelector('#start').getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + 40)?.closest('#start') ? 'start' : 'інше'; });
  assert.equal(top, 'start', 'меню Пуск поверх вікон');
  await p.click('#startBtn');
  const bar = await tb(); const hit = await p.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('#taskbar') ? 1 : 0, [bar.x + 30, bar.y + 20]);
  assert.equal(hit, 1, 'панель завдань поверх вікон');
  const zs = await p.evaluate(() => window.WinEmu.WM.wins.map(w => w.z)); assert.ok(Math.max(...zs) < 9000, 'z: ' + zs);
});
await step('закриття під час анімації й одразу нове вікно — без привидів', async () => {
  for (let i = 0; i < 10; i++) { await open('notepad'); await p.evaluate(() => window.WinEmu.WM.wins.filter(w => w.app === 'notepad').forEach(w => w.close(true))); }
  await p.waitForTimeout(400);
  const ghosts = await p.evaluate(() => [...document.querySelectorAll('.win')].filter(el => !window.WinEmu.WM.wins.some(w => w.el === el)).length);
  assert.equal(ghosts, 0);
});
await step('діалог «Зберегти зміни?» поверх вікна; Escape закриває лише діалог', async () => {
  const w = await open('notepad'); await p.waitForTimeout(200);
  await p.keyboard.type('привіт');
  await p.click('.win[data-app="notepad"] [data-act="close"]'); await p.waitForSelector('.dlg-back');
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  assert.equal(await p.locator('.dlg-back').count(), 0); assert.ok((await W()).some(w => w.app === 'notepad'), 'Блокнот лишився');
});
await step('сенсорний екран: вікно тягнеться пальцем', async () => {
  const tctx = await b.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  const q = await newPage(tctx, errs);
  await q.goto(srv.url + '/emulators/windows'); await signIn(q);
  await q.evaluate(() => window.WinEmu.sys.open('explorer')); await q.waitForTimeout(300);
  const cdp = await tctx.newCDPSession(q);
  const t = await q.locator('.win[data-app="explorer"] .win-title').boundingBox();
  const before = await q.evaluate(() => window.WinEmu.WM.wins[0].el.getBoundingClientRect().x);
  const sx = t.x + 150, sy = t.y + 15;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] });
  for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx - i * 15, y: sy + i * 5 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await q.waitForTimeout(150);
  const after = await q.evaluate(() => window.WinEmu.WM.wins[0].el.getBoundingClientRect().x);
  assert.ok(before - after > 100, `зсув ${before - after}`);
  await tctx.close();
});
await step('розгорнуте вікно тягнеться — відновлюється під курсором; до верхнього краю — розгортається', async () => {
  await p.evaluate(() => { const { WM } = window.WinEmu; const w = WM.wins.find(x => x.app === 'explorer'); WM.focus(w); if (!w.max) WM.toggleMax(w); });
  await p.mouse.move(600, 15); await p.mouse.down(); await p.mouse.move(650, 200, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(150);
  let w = (await W()).find(x => x.app === 'explorer');
  assert.ok(!w.max, 'відновилось'); assert.ok(w.x < 650 && w.x + w.w > 650 && w.y < 200 && w.y + 40 > 200, 'під курсором: ' + JSON.stringify(w));
  const t = await p.locator('.win[data-app="explorer"] .win-title').boundingBox();
  await p.mouse.move(t.x + 150, t.y + 15); await p.mouse.down(); await p.mouse.move(700, 1, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(150);
  w = (await W()).find(x => x.app === 'explorer'); assert.ok(w.max, 'розгорнулось біля верхнього краю');
});

const D = 'C:\\Users\\Учень\\Documents';
const ls = dir => p.evaluate(d => window.WinEmu.fs.list(d).map(n => n.name).sort(), dir);
await p.evaluate(() => window.WinEmu.WM.wins.slice().forEach(w => w.close(true)));
await p.evaluate(D => { const { fs } = window.WinEmu; fs.mkdir(D + '\\Проєкт'); for (const n of ['а.txt', 'б.txt', 'в.txt']) fs.writeFile(D + '\\Проєкт\\' + n, n); }, D);
await p.evaluate(D => window.WinEmu.sys.open('explorer', D + '\\Проєкт'), D); await p.waitForTimeout(400);
const ex = '.win[data-app="explorer"]';
const focusList = () => p.click(ex + ' .win-body', { position: { x: 700, y: 330 } });
await step('видалити 2 файли → Ctrl+Z повертає їх на місце', async () => {
  await focusList(); await p.keyboard.press('Control+a'); await p.keyboard.press('Delete'); await p.waitForTimeout(150);
  if (await p.locator('.dlg-back').count()) await p.keyboard.press('Enter');
  await p.waitForTimeout(200);
  assert.deepEqual(await ls(D + '\\Проєкт'), []);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
  assert.deepEqual(await ls(D + '\\Проєкт'), ['а.txt', 'б.txt', 'в.txt']);
  assert.equal(await p.evaluate(() => window.WinEmu.fs.s.bin.length), 0, 'Кошик порожній');
});
await step('перейменувати F2 → Ctrl+Z повертає стару назву', async () => {
  await p.click(ex + ' [data-key$="а.txt"]'); await p.keyboard.press('F2'); await p.keyboard.press('Control+a'); await p.keyboard.type('нове.txt'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  assert.ok((await ls(D + '\\Проєкт')).includes('нове.txt'));
  await focusList(); await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
  assert.deepEqual(await ls(D + '\\Проєкт'), ['а.txt', 'б.txt', 'в.txt']);
});
await step('вирізати й вставити в іншу папку → Ctrl+Z повертає', async () => {
  await p.evaluate(D => window.WinEmu.fs.mkdir(D + '\\Інша'), D);
  await p.click(ex + ' [data-key$="б.txt"]'); await p.keyboard.press('Control+x');
  await p.evaluate(D => window.WinEmu.sys.paste(D + '\\Інша'), D); await p.waitForTimeout(200);
  assert.deepEqual(await ls(D + '\\Інша'), ['б.txt']);
  await focusList(); await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
  assert.deepEqual(await ls(D + '\\Інша'), []); assert.ok((await ls(D + '\\Проєкт')).includes('б.txt'));
});
await step('нова папка → Ctrl+Z прибирає її; контекстне меню показує «Скасувати»', async () => {
  await focusList(); await p.keyboard.press('Control+Shift+n'); await p.waitForTimeout(150); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  assert.ok((await ls(D + '\\Проєкт')).includes('Нова папка'));
  await p.click(ex + ' .win-body', { position: { x: 700, y: 400 }, button: 'right' });
  await p.click('.cm-it:has-text("Скасувати створення")'); await p.waitForTimeout(200);
  assert.ok(!(await ls(D + '\\Проєкт')).includes('Нова папка'));
});
await step('робочий стіл: видалити значок → Ctrl+Z', async () => {
  await p.evaluate(() => window.WinEmu.WM.wins.slice().forEach(w => w.close(true))); await p.waitForTimeout(200);
  await p.evaluate(() => window.WinEmu.fs.writeFile('C:\\Users\\Учень\\Desktop\\мітка.txt', '')); await p.waitForTimeout(400);
  await p.click('#desk .dk[data-key$="мітка.txt"]'); await p.keyboard.press('Delete'); await p.waitForTimeout(200);
  assert.equal(await p.locator('#desk .dk[data-key$="мітка.txt"]').count(), 0);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
  assert.equal(await p.locator('#desk .dk[data-key$="мітка.txt"]').count(), 1);
});

await step('швидкодія: перемикання вікна не перебудовує Диспетчер завдань, друк у великому файлі легкий', async () => {
  await p.evaluate(() => window.WinEmu.WM.wins.slice().forEach(w => w.close(true))); await p.waitForTimeout(200);
  for (const a of ['explorer', 'taskmgr', 'cmd']) { await open(a); await p.waitForTimeout(300); }
  const emit = await p.evaluate(() => { const { WM } = window.WinEmu, t = performance.now(); for (let i = 0; i < 50; i++) WM.focus(WM.wins[i % WM.wins.length]); return (performance.now() - t) / 50; });
  assert.ok(emit < 8, `фокус вікна ${emit.toFixed(1)} мс`);
  await p.evaluate(() => window.WinEmu.WM.wins.slice().forEach(w => w.close(true))); await open('notepad'); await p.waitForTimeout(300);
  const key = await p.evaluate(async () => {
    const ta = document.querySelector('.win[data-app="notepad"] textarea'), t = 'Рядок для перевірки.\n'.repeat(40000);
    ta.value = t; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); ta.setSelectionRange(t.length / 2, t.length / 2);
    let js = 0; for (let i = 0; i < 10; i++) { ta.setRangeText('я', ta.selectionStart, ta.selectionEnd, 'end'); const t0 = performance.now(); ta.dispatchEvent(new InputEvent('input', { bubbles: true })); ta.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true })); js += performance.now() - t0; }
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { js: js / 10, pos: document.querySelector('.np-pos').textContent };
  });
  assert.ok(key.js < 10, `обробка клавіші ${key.js.toFixed(1)} мс`); assert.match(key.pos, /Рядок 20001, Стовпець 11/);
});

await step('усі програми на мінімальному розмірі: нічого не вилазить за вікно', async () => {
  const issues = [];
  for (const a of ['explorer', 'cmd', 'notepad', 'taskmgr', 'settings', 'browser', 'security', 'firewallcpl', 'ncpa']) {
    await p.evaluate(() => window.WinEmu.WM.wins.slice().forEach(w => w.close(true))); await p.waitForTimeout(150);
    await open(a); await p.waitForTimeout(500);
    await p.evaluate(() => { const w = window.WinEmu.WM.wins.at(-1); Object.assign(w.el.style, { left: '20px', top: '20px', width: w.minW + 'px', height: w.minH + 'px' }); w.onResize?.(); });
    await p.waitForTimeout(150);
    const bad = await p.evaluate(() => { const w = window.WinEmu.WM.wins.at(-1), b = w.body; return b.scrollWidth > b.clientWidth + 2 ? `${w.app}: ${b.scrollWidth} > ${b.clientWidth}` : ''; });
    if (bad) issues.push(bad);
  }
  assert.deepEqual(issues, []);
});

await step('без помилок у консолі', async () => assert.deepEqual(errs, []));
await b.close(); srv.close();
