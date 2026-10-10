// Браузерна перевірка входу в Windows і мережі (трей Wi‑Fi, «Мережеві підключення», IPv4, діагностика) в емуляторі.
//   node tests/winnet-e2e.mjs
import assert from 'node:assert/strict';
import { startServer, launch, newPage, step, signIn } from './_harness.mjs';

const server = await startServer();
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
const p = await newPage(ctx, errors);
await p.goto(server.url + '/emulators/windows');
await p.waitForFunction(() => window.WinEmu);
await p.waitForSelector('#boot', { state: 'hidden' });

const uac = async () => { await p.waitForSelector('.uac'); await p.fill('.uac-user', 'admin'); await p.fill('.uac-pass', 'admin'); await p.click('.uac-yes'); await p.waitForSelector('.uac', { state: 'detached' }); };
const net = () => p.evaluate(() => JSON.parse(JSON.stringify(WinEmu.fs.s.net || null)));
const out = () => p.locator('.win.active .con-out').innerText();
const toCmd = () => p.evaluate(() => { const w = WinEmu.WM.wins.find(x => x.app === 'cmd'); WinEmu.WM.focus(w); w.el.querySelector('.con-in').focus(); });
async function cmd(line) { await p.locator('.win.active .con-in').fill(line); await p.locator('.win.active .con-in').press('Enter'); await p.waitForFunction(() => !document.querySelector('.win.active .con-line.busy'), null, { timeout: 15000 }); }

await step('після запуску — екран блокування; неправильний пароль не пускає', async () => {
  assert.ok(await p.locator('#lock .lk-face').isVisible());
  assert.equal(await p.evaluate(() => document.querySelector('#desk').inert), true);
  await p.keyboard.press('Space');
  await p.fill('.lk-user', 'admin'); await p.fill('.lk-pass', '1234'); await p.press('.lk-pass', 'Enter');
  assert.match(await p.locator('.lk-err').innerText(), /Неправильний пароль/);
  await p.fill('.lk-user', 'teacher'); await p.fill('.lk-pass', 'admin'); await p.press('.lk-pass', 'Enter');
  assert.match(await p.locator('.lk-err').innerText(), /Такого користувача немає/);
  await p.click('.lk-forgot');
  assert.match(await p.locator('.lk-help').innerText(), /admin/);
  await p.fill('.lk-user', 'Admin'); await p.fill('.lk-pass', 'admin'); await p.press('.lk-pass', 'Enter');
  await p.waitForSelector('#lock', { state: 'hidden' });
  assert.equal(await p.evaluate(() => document.querySelector('#desk').inert), false);
});

await step('блокування зберігає відкриті вікна; «Вийти» їх закриває', async () => {
  await p.evaluate(() => { WinEmu.open('notepad'); });
  await p.click('#startBtn'); await p.click('.st-user'); await p.click('.cm-it:has-text("Заблокувати")');
  assert.ok(await p.locator('#lock').isVisible());
  await signIn(p);
  assert.equal(await p.locator('.win').count(), 1);
  // вікно UAC під екраном блокування не перехоплює Enter
  await p.evaluate(() => { WinEmu.open('wfmsc'); }); await p.waitForSelector('.uac');
  await p.evaluate(() => WinEmu.lock());
  await signIn(p);
  assert.equal(await p.locator('.uac').count(), 1);
  await p.click('.uac-no'); await p.waitForSelector('.uac', { state: 'detached' });
  await p.click('#startBtn'); await p.click('.st-user'); await p.click('.cm-it:has-text("Вийти")');
  await p.locator('#lock .lk-face').waitFor();
  assert.equal(await p.locator('.win').count(), 0);
  await signIn(p);
});

await step('пароль змінити не можна: Параметри й net user', async () => {
  await p.evaluate(() => { WinEmu.open('settings', 'accounts'); });
  await p.locator('[data-pw]').click();
  assert.match(await p.locator('.mdl').innerText(), /Змінити пароль не можна/);
  await p.keyboard.press('Escape');
  await p.evaluate(() => { WinEmu.open('cmd'); });
  await cmd('net user admin 12345');
  assert.match(await out(), /Відмовлено в доступі/);
  await cmd('whoami');
  assert.match(await out(), /edvault-pc\\admin/);
});

await step('ipconfig /release — немає Інтернету ні в консолі, ні в браузері; /renew повертає', async () => {
  await cmd('ipconfig /release');
  await cmd('ping 8.8.8.8 -n 1');
  assert.match(await out(), /Загальна помилка/);
  assert.equal(await p.locator('#netTray .warn-dot').count(), 0);
  await p.evaluate(() => { WinEmu.open('browser', 'https://poshuk.edvault/'); });
  await p.waitForSelector('.win.active .err-code');
  assert.equal(await p.locator('.win.active .err-code').innerText(), 'ERR_INTERNET_DISCONNECTED');
  await p.evaluate(() => { WinEmu.WM.active().close(true); });
  await toCmd();
  await cmd('ipconfig /renew');
  await cmd('ping poshuk.edvault -n 1');
  assert.match(await out(), /Відповідь від 185\.199\.110\.20/);
});

await step('трей: Wi‑Fi з паролем, «Забути»', async () => {
  await p.click('#netTray');
  await p.click('[data-pick="SCHOOL-WIFI"]');
  await p.fill('[data-pass]', 'qwerty'); await p.click('[data-go]');
  assert.match(await p.locator('.nf-err').innerText(), /Неправильний ключ/);
  await p.fill('[data-pass]', 'Shkola2026'); await p.click('[data-go]');
  await p.waitForFunction(() => WinEmu.fs.s.net.wifi.ssid === 'SCHOOL-WIFI');
  assert.match(await p.locator('.nf-w.cur').innerText(), /Підключено/);
  await p.click('[data-pick="SCHOOL-WIFI"]'); await p.click('[data-forget]');
  assert.equal((await net()).wifi.ssid, null);
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('#netFly').count(), 0);
});

await step('«Мережеві підключення»: вимкнути Ethernet (UAC) і увімкнути через діагностику', async () => {
  await p.evaluate(() => { WinEmu.open('ncpa'); });
  await p.click('.nc-it[data-ad="eth"]');
  await p.click('.nc-t[data-t="off"]'); await uac();
  await p.waitForFunction(() => !WinEmu.fs.s.net.eth.on);
  assert.match(await p.locator('.nc-it[data-ad="eth"]').innerText(), /Вимкнено/);
  assert.match(await p.getAttribute('#netTray', 'title'), /Немає підключення/);
  await p.click('.nc-t[data-t="diag"]');
  await p.waitForSelector('[data-fix]');
  assert.match(await p.locator('.diag').innerText(), /Ethernet вимкнено/);
  await p.click('[data-fix]'); await uac();
  await p.waitForSelector('.dg-h:has-text("Проблем не виявлено")');
  await p.keyboard.press('Escape');
  assert.ok((await net()).eth.on);
});

await step('IPv4 вручну: перевірка полів, хибний шлюз ламає Інтернет, діагностика виправляє', async () => {
  await p.dblclick('.nc-it[data-ad="eth"]');
  await p.click('.nstat [data-props]');
  await p.click('.aprops [data-ipv4]');
  await p.click('[name=v4ip][value=man]');
  assert.equal(await p.locator('[name=v4dns][value=auto]').isDisabled(), true);
  await p.fill('[data-f=ip]', '192.168.1.255'); await p.fill('[data-f=dns1]', '192.168.1.10');
  await p.click('.v4 [data-b="0"]');
  assert.match(await p.locator('[data-e=ip]').innerText(), /широкомовна/);
  await p.fill('[data-f=ip]', '192.168.1.60'); await p.click('[data-f=gw]');
  assert.equal(await p.inputValue('[data-f=mask]'), '255.255.255.0');
  await p.fill('[data-f=gw]', '192.168.1.5');
  await p.click('.v4 [data-b="0"]'); await uac();
  await p.waitForFunction(() => WinEmu.fs.s.net.eth.dhcp === false);
  while (await p.locator('.dlg-back').count()) await p.keyboard.press('Escape');
  await toCmd();
  await cmd('ping 8.8.8.8 -n 1');
  assert.match(await out(), /Заданий вузол недоступний/);
  await cmd('ping 192.168.1.1 -n 1');
  assert.match(await out(), /Відповідь від 192\.168\.1\.1/);
  await cmd('arp -a');
  assert.match(await out(), /192\.168\.1\.1\s+3c-52-82-1a-7f-08/);
  await p.evaluate(() => { WinEmu.open('settings', 'network'); });
  assert.match(await p.locator('.sa-pc.net').innerText(), /Немає доступу до Інтернету[\s\S]*192\.168\.1\.60 \(вручну\)/);
  await p.click('[data-np="diag"]');
  await p.waitForSelector('[data-fix]');
  assert.match(await p.locator('.diag').innerText(), /не роутер/);
  await p.click('[data-fix]'); await uac();
  await p.waitForSelector('.dg-h:has-text("Проблем не виявлено")');
  await p.keyboard.press('Escape');
  assert.equal((await net()).eth.dhcp, true);
});

await step('збереження: налаштування мережі переживають перезавантаження сторінки, вхід — щоразу', async () => {
  await p.click('#netTray'); await p.click('[data-wifi]'); await p.keyboard.press('Escape');
  assert.equal((await net()).wifi.on, false);
  await p.waitForTimeout(400);
  await p.reload(); await p.waitForFunction(() => window.WinEmu); await p.waitForSelector('#boot', { state: 'hidden' });
  assert.ok(await p.locator('#lock').isVisible());
  await signIn(p);
  assert.equal((await net()).wifi.on, false);
});

await step('жодної помилки в консолі сторінки', async () => { assert.deepEqual(errors, []); });

await browser.close();
server.close();
