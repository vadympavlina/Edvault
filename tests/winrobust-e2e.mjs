// Надійність «Емулятора Windows»: без витоків після закриття вікон, одне перемальовування на серію змін,
// пошкоджене збереження, сторінка не залишається через посилання чи форму. Потрібні Playwright і Chromium.
//   node tests/winrobust-e2e.mjs
import assert from 'node:assert/strict';
import { startServer, launch, newPage, step } from './_harness.mjs';

const server = await startServer();
const browser = await launch();
const errors = [];
const p = await newPage(await browser.newContext({ viewport: { width: 1366, height: 820 } }), errors);
const boot = async () => { await p.goto(server.url + '/emulators/windows'); await p.waitForFunction(() => window.WinEmu); await p.waitForSelector('#boot', { state: 'hidden' }); };
await boot();
const H = 'C:\\Users\\Учень';

await step('закриття вікон (кнопкою «×» і примусово) прибирає підписки й таймери', async () => {
  const before = await p.evaluate(() => [WinEmu.fs.subs.size, WinEmu.WM.subs.size]);
  for (const a of ['explorer', 'cmd', 'notepad', 'security', 'firewallcpl', 'taskmgr', 'settings', 'browser']) {
    await p.evaluate(a => WinEmu.open(a), a);
    await p.waitForFunction(a => WinEmu.WM.wins.some(w => w.app === a), a);
    await p.click('.win.active [data-act="close"]');
    await p.evaluate(a => WinEmu.open(a), a);
    await p.waitForFunction(a => WinEmu.WM.wins.some(w => w.app === a), a);
    await p.evaluate(() => WinEmu.WM.wins.slice().forEach(w => w.close(true)));
  }
  await p.waitForTimeout(300);
  assert.deepEqual(await p.evaluate(() => [WinEmu.fs.subs.size, WinEmu.WM.subs.size]), before);
  assert.equal(await p.evaluate(() => WinEmu.sys.explorers.size), 0);
});

await step('200 нових файлів — Провідник перемальовується один раз і швидко', async () => {
  await p.evaluate(h => WinEmu.open('explorer', h + '\\Documents'), H);
  const [ms, renders] = await p.evaluate(h => { const e = [...WinEmu.sys.explorers][0]; let n = 0; const o = e.render.bind(e); e.render = () => { n++; o(); };
    const t = performance.now(); for (let i = 0; i < 200; i++) WinEmu.fs.writeFile(h + '\\Documents\\f' + i + '.txt', 'x');
    return new Promise(r => queueMicrotask(() => r([performance.now() - t, n]))); }, H);
  assert.equal(renders, 1);
  assert.ok(ms < 500, `надто повільно: ${ms} мс`);
  assert.equal(await p.locator('.win.active .ex-view .it').count(), 203);
});

await step('перейменування нової папки не зривається оновленням Провідника', async () => {
  await p.locator('.win.active [data-cmd="new"]').click();
  await p.click('.cm-it:has-text("Папку")');
  await p.locator('.win.active .ren-inp').fill('Стабільно');
  await p.locator('.win.active .ren-inp').press('Enter');
  assert.ok(await p.evaluate(h => WinEmu.fs.isDir(h + '\\Documents\\Стабільно'), H));
});

await step('посилання й форми не переводять зі сторінки емулятора', async () => {
  await p.evaluate(() => { const a = document.createElement('a'); a.href = 'https://example.com/'; a.textContent = 'x'; a.id = 'lnk'; a.style.cssText = 'position:fixed;top:0;left:0;z-index:99999'; document.body.appendChild(a); const f = document.createElement('form'); f.action = 'https://example.com/'; f.id = 'frm'; document.body.appendChild(f); });
  await p.evaluate(() => document.getElementById('lnk').click());
  await p.evaluate(() => document.getElementById('frm').requestSubmit());
  await p.waitForTimeout(300);
  assert.ok(await p.evaluate(() => !!window.WinEmu && location.pathname.endsWith('/emulators/windows')));
});

await step('браузер: Ctrl+W на останній вкладці, а потім F5 — без помилок', async () => {
  await p.evaluate(() => WinEmu.open('browser'));
  await p.waitForSelector('.win.active .bw');
  await p.keyboard.press('Control+w');
  await p.keyboard.press('F5');
  await p.keyboard.press('Alt+ArrowLeft');
  await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => WinEmu.WM.wins.some(w => w.app === 'browser')), false);
});

await step('пошкоджене збереження — чистий комп’ютер і підказка замість «зависання»', async () => {
  await p.evaluate(() => localStorage.setItem('edvault-windows', JSON.stringify({ fs: { drives: { C: { name: 'C:' } } } })));
  await boot();
  assert.ok(await p.evaluate(h => WinEmu.fs.isDir(h + '\\Documents'), H));
  await p.waitForFunction(() => /пошкоджений/.test(document.querySelector('#toast').textContent));
});

await step('жодної помилки в консолі сторінки', async () => { assert.deepEqual(errors, []); });

await browser.close();
server.close();
