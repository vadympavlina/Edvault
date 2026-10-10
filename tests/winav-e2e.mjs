// Браузерна перевірка антивіруса («Безпека Windows» → «Захист від вірусів і загроз») в емуляторі Windows.
//   node tests/winav-e2e.mjs
import assert from 'node:assert/strict';
import { startServer, launch, newPage, step, signIn } from './_harness.mjs';

const server = await startServer();
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
const p = await newPage(ctx, errors);
await p.goto(server.url + '/emulators/windows');
await p.waitForFunction(() => window.WinEmu);
await p.waitForSelector('#boot', { state: 'hidden' }); await signIn(p);

const H = 'C:\\Users\\Учень';
const AV = () => p.evaluate(() => JSON.parse(JSON.stringify(WinEmu.fs.s.av || null, (k, v) => k === 'node' ? undefined : v)));
const exists = path => p.evaluate(path => !!WinEmu.fs.node(path), path);
const sec = page => p.evaluate(page => { WinEmu.open('security', page); }, page);
async function login() { await p.waitForSelector('.uac'); await p.fill('.uac-user', 'admin'); await p.fill('.uac-pass', 'admin'); await p.click('.uac-yes'); }
const scanDone = (type, n = 1) => p.waitForFunction(([t, n]) => WinEmu.fs.s.av?.history.filter(h => h.kind === 'scan' && h.text.startsWith(t)).length >= n, [type, n], { timeout: 30000 });

await step('швидка перевірка знаходить загрози в «Завантаженнях»; щит у треї червоніє', async () => {
  await sec('virus');
  assert.match(await p.locator('.sec-main').innerText(), /Немає поточних загроз[\s\S]*Перевірок ще не було/);
  await p.click('[data-avscan="quick"]');
  assert.match(await p.locator('.av-scan').innerText(), /Швидка перевірка триває/);
  await scanDone('Швидка');
  const t = await p.locator('.av-threats').innerText();
  assert.match(t, /Trojan:Win32\/FakeInstaller[\s\S]*setup\.exe/);
  assert.match(t, /PUA:Win32\/Bundler/);
  assert.doesNotMatch(t, /Autorun|Masquerade/, 'диск D: швидка перевірка не дивиться');
  assert.ok(await p.locator('#fwTray.bad').count());
});

await step('«Почати дії»: карантин, видалення, дозвіл', async () => {
  await p.locator('.av-th', { hasText: 'PUA' }).locator('select').selectOption('allow');
  await p.locator('.av-th', { hasText: 'FakeInstaller' }).locator('select').selectOption('quarantine');
  await p.click('[data-avstart]');
  assert.equal(await exists(H + '\\Downloads\\setup.exe'), false);
  assert.equal(await exists(H + '\\Downloads\\архів.zip'), true);
  const av = await AV();
  assert.deepEqual([av.pending.length, av.quarantine.length, av.allowed.length], [0, 1, 1]);
  assert.equal(await p.locator('#fwTray.bad').count(), 0);
});

await step('повна перевірка знаходить те, що пропустила швидка (диск D:)', async () => {
  await p.click('.sec-links [data-go="virus-options"]');
  await p.click('input[name=avopt][value=full]');
  await p.click('[data-avrun]');
  await scanDone('Повна');
  const t = await p.locator('.av-threats').innerText();
  assert.match(t, /Worm:Win32\/Autorun\.gen[\s\S]*D:\\autorun\.inf/);
  assert.match(t, /Trojan:Win32\/Masquerade\.A[\s\S]*Екскурсія\.jpg\.exe/);
  assert.doesNotMatch(t, /Bundler/, 'дозволену загрозу більше не показує');
  await p.locator('.av-th', { hasText: 'Autorun' }).locator('select').selectOption('remove');
  await p.click('[data-avstart]');
  assert.equal(await exists('D:\\autorun.inf'), false);
  assert.equal((await AV()).history.some(h => h.kind === 'removed' && h.path === 'D:\\autorun.inf'), true);
});

await step('журнал захисту: відновлення з карантину (потрібен адміністратор)', async () => {
  await sec('virus-history');
  await p.locator('.av-hh', { hasText: 'FakeInstaller' }).click();
  await p.click('[data-avrestore]');
  await login();
  await p.click('.dlg .btn >> nth=0');
  await p.waitForFunction(h => WinEmu.fs.node(h + '\\Downloads\\setup.exe'), H);
  assert.ok((await AV()).allowed.some(a => a.path.endsWith('setup.exe')));
});

await step('захист у реальному часі: завантажений тестовий «вірус» EICAR одразу йде в карантин', async () => {
  await p.evaluate(() => { WinEmu.open('browser', 'https://fayly.edvault/'); });
  await p.waitForFunction(() => WinEmu.WM.active()?.browser?.active().url === 'https://fayly.edvault/' && !WinEmu.WM.active().browser.active().loading);
  await p.locator('.win.active .file-r', { hasText: 'eicar_test.txt' }).locator('button').click();
  await p.waitForFunction(() => WinEmu.fs.s.av.quarantine.some(q => q.path.endsWith('eicar_test.txt')), null, { timeout: 6000 });
  assert.equal(await exists(H + '\\Downloads\\eicar_test.txt'), false);
  assert.match(await p.locator('#toast').innerText(), /EICAR[\s\S]*карантин/);
  assert.ok((await AV()).history.some(h => h.auto && h.name === 'Virus:DOS/EICAR_Test_File'));
});

await step('файл, перейменований на «.jpg.exe», теж помічається одразу', async () => {
  await p.evaluate(h => { WinEmu.fs.writeFile(h + '\\Desktop\\мем.jpg', 'картинка'); WinEmu.fs.rename(h + '\\Desktop\\мем.jpg', 'мем.jpg.exe'); }, H);
  await p.waitForFunction(() => WinEmu.fs.s.av.quarantine.some(q => q.path.endsWith('мем.jpg.exe')), null, { timeout: 4000 });
});

await step('вимкнений захист у реальному часі: файл залишається, допоможе лише перевірка', async () => {
  await sec('virus-settings');
  await p.click('[data-avsw="rt"]');
  await login();
  await p.click('.dlg .btn >> nth=0');
  await p.waitForFunction(() => WinEmu.fs.s.av.rt === false);
  assert.ok(await p.locator('#fwTray.bad').count());
  await p.evaluate(h => WinEmu.fs.writeFile(h + '\\Downloads\\тест.txt', 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'), H);
  await p.waitForTimeout(600);
  assert.equal(await exists(H + '\\Downloads\\тест.txt'), true);
  await sec('home');
  assert.match(await p.locator('.tile-s.bad').first().innerText(), /Захист у реальному часі вимкнено/);
  await sec('virus');
  await p.click('[data-avrt]');
  await login();
  await p.waitForFunction(() => WinEmu.fs.s.av.rt === true);
  await p.click('[data-avscan="quick"]');
  await scanDone('Швидка', 2);
  assert.match(await p.locator('.av-threats').innerText(), /EICAR[\s\S]*тест\.txt/);
  await p.click('[data-avstart]');
  assert.equal(await exists(H + '\\Downloads\\тест.txt'), false);
});

await step('вибіркова перевірка, виключення й оновлення бази', async () => {
  await sec('virus-excl');
  await p.click('[data-avexadd]');
  await login();
  await p.fill('[data-xv]', 'D:\\Інформатика');
  await p.click('.mdl .btn.primary');
  assert.match(await p.locator('.sec-main').innerText(), /D:\\Інформатика/);
  await p.evaluate(() => WinEmu.fs.writeFile('D:\\Інформатика\\прибирання.bat', 'del /s /q C:\\*.*'));
  await p.waitForTimeout(500);
  assert.equal(await exists('D:\\Інформатика\\прибирання.bat'), true, 'виключення: захист у реальному часі не чіпає');
  await sec('virus-options');
  await p.click('input[name=avopt][value=custom]');
  await p.click('[data-avrun]');
  await p.check('input[name=avp][value="D:\\\\"]');
  await p.click('.mdl .btn.primary');
  await scanDone('Вибіркова');
  assert.match(await p.locator('.sec-main').innerText(), /Немає поточних загроз/, 'папка у виключеннях — .bat не знайдено');
  await sec('virus-excl');
  await p.click('[data-avexdel="0"]');
  await login();
  await sec('virus-options');
  await p.click('input[name=avopt][value=custom]');
  await p.click('[data-avrun]');
  await p.check('input[name=avp][value="D:\\\\"]');
  await p.click('.mdl .btn.primary');
  await scanDone('Вибіркова', 2);
  assert.match(await p.locator('.av-threats').innerText(), /Trojan:BAT\/Killfiles/);
  await p.click('[data-avstart]');
  await sec('virus-updates');
  const v0 = (await AV()).sig;
  await p.click('[data-avupd]');
  await p.waitForFunction(v => WinEmu.fs.s.av.sig !== v, v0, { timeout: 5000 });
});

await step('автономна перевірка: «перезавантаження» й перевірка до запуску Windows', async () => {
  await sec('virus-options');
  await p.click('input[name=avopt][value=offline]');
  await p.click('[data-avrun]');
  await p.click('.dlg .btn.primary');
  await p.waitForSelector('#avoffline');
  await p.waitForSelector('#avoffline', { state: 'detached', timeout: 20000 });
  await p.waitForFunction(() => WinEmu.WM.wins.some(w => w.app === 'security'), null, { timeout: 8000 });
  assert.match((await AV()).history.find(h => h.kind === 'scan').text, /Defender Offline/);
});

await step('«Скинути цей ПК» повертає антивірус і «заражені» файли до початку', async () => {
  await p.evaluate(() => WinEmu.sys.factoryReset());
  await p.waitForSelector('#resetting', { state: 'detached', timeout: 8000 });
  const av = await AV();
  assert.deepEqual([av.rt, av.quarantine.length, av.history.length, av.excl.length], [true, 0, 0, 0]);
  assert.equal(await exists('D:\\autorun.inf'), true);
});

await step('жодної помилки в консолі сторінки', async () => { assert.deepEqual(errors, []); });

await browser.close();
server.close();
