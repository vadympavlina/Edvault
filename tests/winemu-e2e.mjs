// Браузерна перевірка «Емулятор Windows» (потрібні Playwright і Chromium).
//   node tests/winemu-e2e.mjs
import assert from 'node:assert/strict';
import { startServer, launch, newPage, step } from './_harness.mjs';

const server = await startServer();
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
const p = await newPage(ctx, errors);
await p.goto(server.url + '/emulators/windows');
await p.waitForFunction(() => window.WinEmu);
await p.waitForSelector('#boot', { state: 'hidden' });

const H = 'C:\\Users\\Учень';
const node = path => p.evaluate(path => { const n = WinEmu.fs.node(path); return n ? { type: n.type, name: n.name, content: n.content } : null; }, path);
const active = () => p.locator('.win.active');
const ex = () => p.locator('.win.active .ex');
async function typeCmd(line) { await p.locator('.win.active .con-in').fill(line); await p.locator('.win.active .con-in').press('Enter'); }
// перейти до вікна програми через панель завдань (активне вікно від повторного клацання згортається — як у Windows)
async function focusApp(app) { await p.evaluate(app => { const w = WinEmu.WM.wins.find(x => x.app === app); WinEmu.WM.focus(w); }, app); }
const conText = () => p.locator('.win.active .con-out').innerText();

await step('робочий стіл: Цей ПК, Кошик, файли з папки Desktop; панель завдань і годинник', async () => {
  const icons = await p.locator('#icons .dk span').allInnerTexts();
  assert.deepEqual(icons.slice(0, 2), ['Цей ПК', 'Кошик']);
  assert.ok(icons.includes('Привіт.txt') && icons.includes('Домашнє завдання'));
  assert.equal(await p.locator('#tbApps .tb-app').count(), 4);
  assert.match(await p.textContent('#clock'), /\d\d:\d\d/);
});

await step('Провідник: подвійне клацання по «Цей ПК», потім у «Документи»', async () => {
  await p.dblclick('#icons .dk[data-key="::pc"]');
  assert.equal(await active().locator('.win-name').innerText(), 'Цей ПК');
  assert.equal(await ex().locator('.tile.drive').count(), 2);
  await ex().locator('.tile', { hasText: 'Документи' }).dblclick();
  assert.equal(await active().locator('.win-name').innerText(), 'Документи');
  assert.equal(await ex().locator('.it').count(), 3);
});

await step('кнопка «Створити → Папку» і перейменування на місці', async () => {
  await ex().locator('[data-cmd="new"]').click();
  await p.click('.cm-it:has-text("Папку")');
  const inp = ex().locator('.ren-inp');
  await inp.fill('Проєкти'); await inp.press('Enter');
  assert.equal((await node(H + '\\Documents\\Проєкти'))?.type, 'dir');
  assert.equal(await ex().locator('.it.sel .lb').innerText(), 'Проєкти');
});

await step('F2 перейменовує, недозволені символи прибираються з підказкою', async () => {
  await ex().locator('.it', { hasText: 'Нотатки.txt' }).click();
  await p.keyboard.press('F2');
  const inp = ex().locator('.ren-inp');
  await inp.fill('План');
  await inp.type('?');
  assert.equal(await inp.inputValue(), 'План');
  assert.match(await p.textContent('.tip'), /не може містити/);
  await inp.fill('План.txt'); await inp.press('Enter');
  assert.ok(await node(H + '\\Documents\\План.txt'));
});

await step('Ctrl+C / Ctrl+V: копія в іншу папку й «— копія» в тій самій', async () => {
  await ex().locator('.it', { hasText: 'План.txt' }).click();
  await p.keyboard.press('Control+KeyC');
  await p.keyboard.press('Control+KeyV');
  assert.ok(await node(H + '\\Documents\\План — копія.txt'));
  await ex().locator('.it', { hasText: 'Школа' }).dblclick();
  await p.keyboard.press('Control+KeyV');
  assert.ok(await node(H + '\\Documents\\Школа\\План.txt'));
  await p.keyboard.press('Alt+ArrowLeft');
  assert.equal(await active().locator('.win-name').innerText(), 'Документи');
});

await step('Delete — у Кошик; Кошик на робочому столі стає повним; відновлення', async () => {
  await ex().locator('.it', { hasText: 'План — копія.txt' }).click();
  await p.keyboard.press('Delete');
  assert.equal(await node(H + '\\Documents\\План — копія.txt'), null);
  assert.equal(await p.evaluate(() => WinEmu.fs.s.bin.length), 1);
  await ex().locator('.sd', { hasText: 'Кошик' }).click();
  assert.match(await ex().locator('.ex-view').innerText(), /План — копія\.txt/);
  await ex().locator('.it').click();
  await ex().locator('[data-cmd="restoreSel"]').click();
  assert.ok(await node(H + '\\Documents\\План — копія.txt'));
});

await step('перетягування файлу на папку переміщає його', async () => {
  await ex().locator('.sd', { hasText: 'Документи' }).click();
  await ex().locator('.it', { hasText: 'План — копія.txt' }).dragTo(ex().locator('.it', { hasText: 'Проєкти' }));
  assert.ok(await node(H + '\\Documents\\Проєкти\\План — копія.txt'));
  assert.equal(await node(H + '\\Documents\\План — копія.txt'), null);
});

await step('Командний рядок: команди одразу видно в Провіднику', async () => {
  await p.click('#tbApps [data-app="cmd"]');
  assert.match(await conText(), /Microsoft Windows/);
  await typeCmd('cd Documents');
  await typeCmd('md "Нова з консолі"');
  await typeCmd('echo рядок із консолі > консоль.txt');
  await typeCmd('dir /b');
  assert.match(await conText(), /Нова з консолі[\s\S]*консоль\.txt/);
  await p.waitForTimeout(100);
  const names = await p.locator('.win .ex .it .lb').allInnerTexts();
  assert.ok(names.includes('Нова з консолі') && names.includes('консоль.txt'), names.join(', '));
});

await step('історія ↑, Tab-доповнення, підтвердження rd /s', async () => {
  await p.locator('.win.active .con-in').press('ArrowUp');
  assert.equal(await p.locator('.win.active .con-in').inputValue(), 'dir /b');
  await p.locator('.win.active .con-in').fill('cd Шк');
  await p.locator('.win.active .con-in').press('Tab');
  assert.equal(await p.locator('.win.active .con-in').inputValue(), 'cd Школа');
  await p.locator('.win.active .con-in').fill('');
  await typeCmd('rd /s "Нова з консолі"');
  assert.match(await conText(), /Ви впевнені \(Y\/N\)\? $/m);
  await typeCmd('y');
  assert.equal(await node(H + '\\Documents\\Нова з консолі'), null);
});

await step('ping: відповіді з’являються по одній, Ctrl+C зупиняє -t', async () => {
  await typeCmd('ping -n 2 192.168.1.1');
  await p.waitForFunction(() => /отримано = 2/.test(document.querySelector('.win.active .con-out').innerText), null, { timeout: 5000 });
  await typeCmd('ping -t google.com');
  await p.waitForTimeout(900);
  await p.locator('.win.active .con-in').press('Control+KeyC');
  assert.match(await conText(), /Control-C\s*\^C/);
  assert.equal(await p.locator('.win.active .con-line.busy').count(), 0);
});

await step('notepad з консолі, зміна тексту, Ctrl+S; type показує новий вміст', async () => {
  await typeCmd('notepad консоль.txt');
  const ta = p.locator('.win.active .np-text');
  assert.equal(await ta.inputValue(), 'рядок із консолі\n');
  await ta.press('End'); await ta.type('ще рядок');
  assert.match(await active().locator('.win-name').innerText(), /^\*консоль\.txt/);
  await ta.press('Control+KeyS');
  assert.match(await active().locator('.win-name').innerText(), /^консоль\.txt – Блокнот/);
  assert.match((await node(H + '\\Documents\\консоль.txt')).content, /ще рядок/);
});

await step('tasklist показує Блокнот, taskkill закриває його вікно', async () => {
  await focusApp('cmd');
  await typeCmd('tasklist');
  assert.match(await conText(), /notepad\.exe/);
  await typeCmd('taskkill /im notepad.exe');
  await p.waitForTimeout(250);
  await p.waitForTimeout(200);
  assert.equal(await p.locator('.win .np').count(), 0);
});

await step('Блокнот: нове вікно, закриття з питанням і «Зберегти як»', async () => {
  await p.click('#tbApps [data-app="notepad"]');
  await p.locator('.win.active .np-text').type('Список справ');
  await active().locator('[data-act="close"]').click();
  await p.click('.dlg .btn:has-text("Зберегти")');
  await p.locator('.fdlg .fd-name').fill('справи');
  await p.click('.fdlg [data-ok]');
  assert.equal((await node(H + '\\Documents\\справи.txt'))?.content, 'Список справ');
  await p.waitForTimeout(200);
  assert.equal(await p.locator('.win .np').count(), 0);
});

await step('системні папки захищені, del видаляє назавжди', async () => {
  await focusApp('cmd');
  await typeCmd('rd /s /q C:\\Windows');
  assert.match(await conText(), /Відмовлено в доступі/);
  const before = await p.evaluate(() => WinEmu.fs.s.bin.length);
  await typeCmd('del справи.txt');
  assert.equal(await node(H + '\\Documents\\справи.txt'), null);
  assert.equal(await p.evaluate(() => WinEmu.fs.s.bin.length), before, 'Кошик не змінився');
  await typeCmd('exit');
  await p.waitForTimeout(200);
  assert.equal(await p.locator('.win .con').count(), 0);
});

await step('меню «Пуск»: пошук і відкриття файлу', async () => {
  await p.click('#startBtn');
  await p.fill('#stQ', 'розклад');
  assert.match(await p.textContent('#stBody'), /Розклад\.txt/);
  await p.press('#stQ', 'Enter');
  assert.equal(await p.locator('#start').isVisible(), false);
  assert.match(await active().locator('.win-name').innerText(), /Розклад\.txt – Блокнот/);
});

await step('вікна: згорнути, розгорнути, перетягнути', async () => {
  const w = active();
  const box = await w.boundingBox();
  await p.mouse.move(box.x + 200, box.y + 16); await p.mouse.down(); await p.mouse.move(box.x + 320, box.y + 90, { steps: 5 }); await p.mouse.up();
  const b2 = await w.boundingBox();
  assert.ok(Math.abs(b2.x - box.x - 120) < 3 && Math.abs(b2.y - box.y - 74) < 3);
  await w.locator('[data-act="max"]').click();
  assert.equal((await w.boundingBox()).width, 1366);
  const before = await p.locator('.win.min').count();
  await w.locator('[data-act="min"]').click();
  assert.equal(await p.locator('.win.min').count(), before + 1);
  await p.click('#tbApps [data-app="notepad"]');
  assert.equal(await p.locator('.win.min').count(), before);
});

await step('усе зберігається після перезавантаження сторінки, «Скинути комп’ютер» повертає початковий стан', async () => {
  await p.goto(server.url + '/emulators/windows');
  await p.waitForFunction(() => window.WinEmu);
  assert.ok(await node(H + '\\Documents\\Проєкти\\План — копія.txt'));
  await p.waitForSelector('#boot', { state: 'hidden' });
  await p.click('#startBtn'); await p.click('#powerBtn');
  await p.click('.cm-it:has-text("Скинути")');
  await p.click('.dlg .btn:has-text("Скинути")');
  assert.equal(await node(H + '\\Documents\\Проєкти'), null);
  assert.ok(await node(H + '\\Documents\\Нотатки.txt'));
});

await step('жодної помилки в консолі сторінки', async () => { assert.deepEqual(errors, []); });

await browser.close();
server.close();
