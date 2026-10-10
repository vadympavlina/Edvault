// Браузерна перевірка «Емулятора Windows»: Параметри (скидання ПК), Диспетчер завдань, властивості файлів,
// пошук у Провіднику, браузер із навчальними сайтами, вебінтерфейс роутера. Потрібні Playwright і Chromium.
//   node tests/winplus-e2e.mjs
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
const node = path => p.evaluate(path => { const n = WinEmu.fs.node(path); return n ? { name: n.name, attrs: n.attrs, size: n.binary ? n.size : n.content.length } : null; }, path);
const open = (a, x) => p.evaluate(([a, x]) => { WinEmu.open(a, x); }, [a, x]);
const closeAll = () => p.evaluate(() => WinEmu.WM.wins.forEach(w => w.close(true)));
const active = () => p.locator('.win.active');
const page = () => p.locator('.win.active .bw-page:not([hidden])');
async function go(u) { await p.fill('.win.active .bw-in', u); await p.press('.win.active .bw-in', 'Enter'); await p.waitForFunction(() => !WinEmu.WM.active().browser.active().loading, null, { timeout: 5000 }); }
const curUrl = () => p.evaluate(() => WinEmu.WM.active().browser.active().url);
const R = () => p.evaluate(() => JSON.parse(JSON.stringify(WinEmu.fs.s.router || null)));
async function typeCmd(line) { await p.locator('.win.active .con-in').fill(line); await p.locator('.win.active .con-in').press('Enter'); }

await step('Властивості файлу: вкладки, перейменування в полі імені, атрибут «Прихований»', async () => {
  await p.evaluate(h => WinEmu.sys.props(h + '\\Documents\\Нотатки.txt'), H);
  assert.deepEqual(await p.locator('.fprops .tab').allInnerTexts(), ['Загальні', 'Безпека', 'Подробиці', 'Попередні версії']);
  assert.match(await p.locator('.fprops .pr-t').innerText(), /Відкривати за допомогою:\s+Блокнот[\s\S]*На диску:\s+4(,0)? КБ/);
  await p.click('.fprops [data-tab="details"]');
  assert.match(await p.locator('.pr-det').innerText(), /Рядків\s+2/);
  await p.click('.fprops [data-tab="security"]');
  await p.click('[data-acl="3"]');
  assert.match(await p.locator('[data-who]').innerText(), /Користувачі/);
  await p.click('.fprops [data-tab="general"]');
  await p.fill('.fprops [data-name]', 'Плани.txt');
  await p.check('.fprops [data-a="h"]');
  await p.click('.fprops .dlg-foot .btn.primary');
  assert.equal(await node(H + '\\Documents\\Нотатки.txt'), null);
  assert.equal((await node(H + '\\Documents\\Плани.txt')).attrs.h, true);
  await p.evaluate(h => WinEmu.sys.props(h + '\\Documents\\Школа'), H);
  assert.deepEqual(await p.locator('.fprops .tab').allInnerTexts(), ['Загальні', 'Спільний доступ', 'Безпека', 'Попередні версії', 'Налаштування']);
  await p.keyboard.press('Escape');
});

await step('Пошук у Провіднику: шаблон, увесь ПК, фільтр типу, пошук у тексті, «Відкрити розташування»', async () => {
  await open('explorer', H + '\\Documents');
  await p.fill('.win.active .ex-search input', '*.txt');
  await p.press('.win.active .ex-search input', 'Enter');
  assert.deepEqual(await active().locator('.ex-view .it .lb').allInnerTexts(), ['Розклад.txt'], 'Плани.txt прихований — не видно');
  await p.click('.win.active .sd[data-go="::pc"]');
  await p.fill('.win.active .ex-search input', 'урок');
  await p.press('.win.active .ex-search input', 'Enter');
  const names = await active().locator('.ex-view .it .lb').allInnerTexts();
  assert.ok(names.includes('Урок 1.txt') && names.includes('Пісня_для_уроку_музики.mp3') === false && names.length >= 2);
  await p.click('.win.active [data-sf="kind"]');
  await p.locator('.cm-it', { hasText: 'Папки' }).dispatchEvent('click');
  assert.equal(await active().locator('.ex-view .it').count(), 0, 'серед папок «урок» немає');
  await p.click('.win.active [data-sf="kind"]');
  await p.locator('.cm-it', { hasText: 'Усі' }).dispatchEvent('click');
  await p.fill('.win.active .ex-search input', 'біологія');
  await p.press('.win.active .ex-search input', 'Enter');
  assert.equal(await active().locator('.ex-view .it').count(), 0);
  await p.check('.win.active [data-sfc]');
  assert.deepEqual(await active().locator('.ex-view .it .lb').allInnerTexts(), ['Розклад.txt']);
  await active().locator('.ex-view .it').click({ button: 'right' });
  await p.locator('.cm-it', { hasText: 'Відкрити розташування файлу' }).dispatchEvent('click');
  assert.equal(await active().locator('.win-name').innerText(), 'Школа');
  assert.equal(await active().locator('.ex-view .it.sel .lb').innerText(), 'Розклад.txt');
  await closeAll();
});

await step('Диспетчер завдань: процеси, зняти завдання, служби, автозавантаження, tasklist/taskkill', async () => {
  await open('notepad'); await open('taskmgr');
  await p.waitForSelector('.tm-t');
  assert.match(await p.locator('.tm-t').innerText(), /Програми \(2\)[\s\S]*Блокнот[\s\S]*Фонові процеси[\s\S]*Процеси Windows/);
  await p.locator('.tm-t tr', { hasText: 'Блокнот' }).click();
  await p.click('[data-act="end"]');
  await p.waitForFunction(() => !WinEmu.WM.wins.some(w => w.app === 'notepad'));
  await p.click('[data-page="perf"]');
  assert.match(await p.locator('.pf-main').innerText(), /Навчальний процесор[\s\S]*Ядра:\s+4/);
  await p.click('[data-perf="net"]');
  assert.match(await p.locator('.pf-main').innerText(), /192\.168\.1\.27/);
  await p.click('[data-page="services"]');
  await p.locator('tr[data-svc="Spooler"]').click();
  await p.click('[data-act="svcStop"]');
  assert.match(await p.locator('tr[data-svc="Spooler"]').innerText(), /Зупинено/);
  await p.click('[data-act="svcStart"]');
  assert.match(await p.locator('tr[data-svc="Spooler"]').innerText(), /Виконується/);
  await p.click('[data-page="startup"]');
  await p.locator('tr[data-start="updater"]').click();
  await p.click('[data-act="toggleStart"]');
  assert.equal(await p.evaluate(() => WinEmu.fs.s.startup.updater), false);
  await open('cmd');
  await typeCmd('tasklist');
  assert.match(await p.locator('.win.active .con-out').innerText(), /csrss\.exe[\s\S]*Taskmgr\.exe/);
  await typeCmd('taskkill /im OneDrive.exe');
  assert.match(await p.locator('.win.active .con-out').innerText(), /УСПІХ: надіслано сигнал завершення процесу «OneDrive\.exe»/);
  await typeCmd('taskkill /im csrss.exe');
  assert.match(await p.locator('.win.active .con-out').innerText(), /потрібен системі/);
});

await step('завершення критичного процесу — «синій екран» і перезавантаження', async () => {
  await p.evaluate(() => { WinEmu.WM.focus(WinEmu.WM.wins.find(w => w.app === 'taskmgr')); });
  await p.click('[data-page="details"]');
  await p.locator('.tm-t tr', { hasText: 'csrss.exe' }).click();
  await p.click('[data-act="end"]');
  await p.click('.dlg .btn >> nth=0');
  await p.waitForSelector('#bsod');
  assert.match(await p.locator('#bsod').innerText(), /CRITICAL_PROCESS_DIED/);
  await p.waitForSelector('#bsod', { state: 'detached', timeout: 15000 });
  await p.waitForSelector('#boot', { state: 'hidden' });
  assert.equal(await p.evaluate(() => WinEmu.WM.wins.length), 0);
  assert.equal(await p.evaluate(() => WinEmu.sys.procs.killed.size), 0, 'після перезавантаження всі процеси знову запущені');
});

await step('браузер: нова вкладка, пошук, перехід за результатом, закладка, вкладки, історія', async () => {
  await p.evaluate(() => { WinEmu.open('browser'); });
  await p.waitForSelector('.win.active .nt');
  await go('що таке DNS');
  assert.equal(await curUrl(), 'https://poshuk.edvault/search?q=%D1%89%D0%BE+%D1%82%D0%B0%D0%BA%D0%B5+DNS'.replace(/\+/g, '%20'));
  await page().locator('.srch-r a', { hasText: 'DNS' }).first().click();
  await p.waitForFunction(() => !WinEmu.WM.active().browser.active().loading);
  assert.match(await page().innerText(), /Телефонна книга/);
  await p.click('.win.active [data-b="back"]');
  await p.waitForFunction(() => /search/.test(WinEmu.WM.active().browser.active().url) && !WinEmu.WM.active().browser.active().loading);
  await p.keyboard.press('Control+t');
  assert.equal(await p.locator('.win.active .bw-tab').count(), 2);
  await go('shkola.edvault/kontakty');
  await page().locator('button.btn.primary').click();
  assert.match(await page().locator('.form-err').innerText(), /Вкажіть ім’я/);
  await page().locator('[name=n]').fill('Оля'); await page().locator('[name=e]').fill('olia@ex.ua'); await page().locator('[name=m]').fill('Коли олімпіада?');
  await page().locator('button.btn.primary').click();
  assert.match(await page().innerText(), /Дякуємо, Оля!/);
  await p.click('.win.active [data-b="star"]');
  await p.click('.mdl .btn.primary');
  assert.ok(await p.evaluate(() => WinEmu.fs.s.browser.bookmarks.some(b => b.url === 'https://shkola.edvault/kontakty')));
  assert.ok(await p.locator('.win.active .bm', { hasText: 'Школа №1' }).count() >= 2);
  await go('browser://history');
  assert.match(await page().innerText(), /Сьогодні[\s\S]*Контакти — Школа №1/);
});

await step('браузер: завантаження файлу в «Завантаження», попередження про .exe', async () => {
  await go('fayly.edvault');
  await page().locator('[data-dl="3"]').click();
  await p.waitForFunction(h => WinEmu.fs.node(h + '\\Downloads\\Конспект_мережі.txt'), H, { timeout: 5000 });
  assert.match(await p.locator('.bw-fly').innerText(), /Конспект_мережі\.txt[\s\S]*Готово/);
  await page().locator('[data-dl="5"]').click();
  assert.match(await p.locator('.dlg-text').innerText(), /може зашкодити/);
  await p.click('.dlg .btn.primary');
  assert.equal(await node(H + '\\Downloads\\super_game_FREE_setup.exe'), null);
});

await step('браузер і мережа: помилки DNS, брандмауер, чужа підмережа, фішинг', async () => {
  await go('nosuchsite-zzz.edvault');
  assert.match(await page().innerText(), /ERR_NAME_NOT_RESOLVED/);
  await go('192.168.0.1');
  assert.match(await page().innerText(), /ERR_CONNECTION_TIMED_OUT[\s\S]*|ipconfig/);
  await go('google.com');
  assert.match(await page().innerText(), /немає в навчальному інтернеті/);
  await p.evaluate(() => { const fw = WinEmu.fs.s.fw || (WinEmu.sys.fs.s.fw); });
  await p.evaluate(() => { const fw = WinEmu.fs.s.fw; fw.rules.push({ ...fw.rules[0], id: 'rb', name: 'Без браузера', dir: 'out', action: 'block', protocol: 'TCP', program: 'C:\\Program Files\\Browser\\browser.exe', localPorts: 'any', remotePorts: 'any', remoteAddr: 'any', localAddr: 'any', profiles: 'any', enabled: true }); });
  await go('poshuk.edvault');
  assert.match(await page().innerText(), /Немає доступу до Інтернету[\s\S]*«Без браузера»[\s\S]*ERR_NETWORK_ACCESS_DENIED/);
  await p.evaluate(() => { const fw = WinEmu.fs.s.fw; fw.rules = fw.rules.filter(r => r.id !== 'rb'); });
  await go('pryz-vygraj.edvault');
  assert.match(await page().innerText(), /Небезпечний сайт/);
  assert.match(await p.locator('.win.active .bw-sec').innerText(), /Небезпечно/);
  await page().locator('[data-go]').click();
  await p.waitForFunction(() => !WinEmu.WM.active().browser.active().loading);
  await page().locator('.ph-f button').click();
  assert.match(await page().innerText(), /Це була пастка!/);
});

await step('роутер: вхід, помилки, майстер швидкого налаштування з перевірками', async () => {
  await go('192.168.1.1');
  assert.match(await p.locator('.win.active .bw-sec').innerText(), /Не захищено/);
  await page().locator('[name=user]').fill('admin'); await page().locator('[name=pass]').fill('12345');
  await page().locator('.rt-lf .rt-btn').click();
  assert.match(await page().locator('.rt-lerr').innerText(), /Неправильне ім’я користувача або пароль. Залишилось спроб: 4/);
  await page().locator('[name=pass]').fill('admin');
  await page().locator('.rt-lf .rt-btn').click();
  await p.waitForSelector('.win.active .rt-steps');
  const next = () => page().locator('.rt-form .rt-btn.primary').click();
  await page().locator('[name=p1]').fill('admin'); await page().locator('[name=p2]').fill('admin'); await next();
  assert.match(await page().locator('.rt-err:not([hidden])').innerText(), /не «admin»/);
  await page().locator('[name=p1]').fill('Kotyk2026'); await page().locator('[name=p2]').fill('Kotyk2026'); await next();
  await next(); // часовий пояс
  await page().locator('input[name=type][value=pppoe]').check(); await next();
  await next();
  assert.match(await page().innerText(), /Вкажіть ім’я користувача з договору/);
  await page().locator('[name=pppUser]').fill('uchen123'); await page().locator('[name=pppPass]').fill('secret'); await next();
  await page().locator('[name=s24]').fill('Kvartyra_42'); await page().locator('[name=p]').fill('1234'); await next();
  assert.match(await page().innerText(), /від 8 до 63 символів/);
  await page().locator('[name=p]').fill('dovgyi-parol-42'); await next();
  assert.match(await page().locator('.rt-sum').innerText(), /PPPoE[\s\S]*Kvartyra_42/);
  await next();
  await page().locator('.rt-apply a.rt-btn').waitFor({ timeout: 5000 });
  const r = await R();
  assert.deepEqual([r.setup, r.admin.pass, r.wan.type, r.wifi.b24.ssid, r.wifi.b5.ssid, r.wifi.b24.pass], [true, 'Kotyk2026', 'pppoe', 'Kvartyra_42', 'Kvartyra_42', 'dovgyi-parol-42']);
});

await step('роутер: Wi‑Fi, LAN, переадресація портів, батьківський контроль — з перевірками полів', async () => {
  await go('192.168.1.1/wifi');
  await page().locator('[name=sec]').selectOption('none');
  assert.match(await page().locator('[data-secwarn]').innerText(), /Без шифрування/);
  await page().locator('[name=sec]').selectOption('wpa3');
  await page().locator('[name=ssid]').fill('');
  await page().locator('.rt-actions .rt-btn.primary').first().click();
  assert.match(await page().locator('.rt-err:not([hidden])').innerText(), /від 1 до 32 символів/);
  await page().locator('[name=ssid]').fill('Domivka');
  await page().locator('.rt-actions .rt-btn.primary').first().click();
  assert.match(await page().locator('.rt-flash').innerText(), /збережено/);
  assert.equal((await R()).wifi.b24.sec, 'wpa3');
  await go('192.168.1.1/lan');
  await page().locator('[name=start]').fill('10.0.0.5');
  await page().locator('.rt-btn.primary').first().click();
  assert.match(await page().locator('.rt-err:not([hidden])').innerText(), /Пул має бути в мережі роутера/);
  await go('192.168.1.1/forward');
  await page().locator('[name=tpl]').selectOption('mc');
  assert.equal(await page().locator('[name=ext]').inputValue(), '25565');
  await page().locator('[name=dev]').selectOption('192.168.1.27');
  await page().locator('.rt-btn.primary').click();
  assert.match(await page().locator('.rt-t').innerText(), /Сервер Minecraft\s+25565\s+192\.168\.1\.27/);
  await page().locator('[name=tpl]').selectOption('mc'); await page().locator('[name=ip]').fill('192.168.1.102');
  await page().locator('.rt-btn.primary').click();
  assert.match(await page().locator('.rt-err:not([hidden])').innerText(), /уже використовує інше правило/);
  await go('192.168.1.1/parental');
  await page().locator('[name=name]').fill('Оля');
  await page().locator('.rt-btn.primary').click();
  assert.match(await page().innerText(), /Виберіть хоча б один пристрій/);
  await page().locator('[name="d_A4-C3-F0-12-9B-44"]').check();
  await page().locator('.rt-btn.primary').click();
  await page().locator('[data-act="pause"]').click();
  assert.equal((await R()).parental.profiles[0].paused, true);
});

await step('роутер: вихід, вхід з новим паролем, RESET на корпусі — знову admin / admin', async () => {
  await page().locator('[data-logout]').click();
  await p.waitForFunction(() => !WinEmu.WM.active().browser.active().loading);
  await page().locator('[name=user]').fill('admin'); await page().locator('[name=pass]').fill('admin');
  await page().locator('.rt-lf .rt-btn').click();
  assert.match(await page().locator('.rt-lerr').innerText(), /Неправильне/, 'старий пароль більше не підходить');
  await page().locator('[data-forgot]').click();
  await page().locator('[data-reset]').scrollIntoViewIfNeeded();
  const b = await page().locator('[data-reset]').boundingBox();
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down();
  await p.waitForTimeout(5400); await p.mouse.up();
  await page().locator('.rt-boot').waitFor();
  assert.equal((await R()).setup, false);
  await p.waitForFunction(() => WinEmu.WM.active().browser.active().view.querySelector('.rt-login'), null, { timeout: 12000 });
  await page().locator('[name=user]').fill('admin'); await page().locator('[name=pass]').fill('admin');
  await page().locator('.rt-lf .rt-btn').click();
  await p.waitForSelector('.win.active .rt-steps');
});

await step('консоль відкриває браузер і Диспетчер; «Параметри» → «Скинути цей ПК»', async () => {
  await closeAll();
  await open('cmd');
  await typeCmd('start https://pogoda.edvault');
  await p.waitForFunction(() => WinEmu.WM.wins.some(w => w.app === 'browser'));
  await p.waitForFunction(() => WinEmu.WM.active()?.browser?.active().url === 'https://pogoda.edvault/' && !WinEmu.WM.active().browser.active().loading);
  assert.match(await page().innerText(), /Київ: прогноз на 5 днів/);
  await p.evaluate(h => WinEmu.fs.writeFile(h + '\\Documents\\Моє.txt', 'привіт'), H);
  await open('settings');
  await p.click('[data-reset]');
  assert.ok(await p.locator('.reset-dlg .btn.primary').isDisabled());
  await p.check('[data-sure]');
  await p.click('.reset-dlg .btn.primary');
  await p.waitForSelector('#resetting', { state: 'detached', timeout: 8000 });
  await p.waitForSelector('#boot', { state: 'hidden' });
  assert.equal(await node(H + '\\Documents\\Моє.txt'), null);
  assert.ok(await node(H + '\\Documents\\Нотатки.txt'));
  assert.equal(await p.evaluate(() => WinEmu.fs.s.router || null), null, 'роутер теж скинуто');
  assert.equal(await p.evaluate(() => WinEmu.fs.s.browser || null), null);
});

await step('жодної помилки в консолі сторінки', async () => { assert.deepEqual(errors, []); });

await browser.close();
server.close();
