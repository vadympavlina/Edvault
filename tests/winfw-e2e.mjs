// Браузерна перевірка брандмауера в «Емуляторі Windows» (потрібні Playwright і Chromium).
//   node tests/winfw-e2e.mjs
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

const fw = () => p.evaluate(() => JSON.parse(JSON.stringify(WinEmu.fs.s.fw || null)));
const rule = name => p.evaluate(n => (WinEmu.fs.s.fw?.rules || []).find(r => r.name.trim() === n) || null, name);
async function login(user = 'admin', pass = 'admin') { await p.waitForSelector('.uac'); await p.fill('.uac-user', user); await p.fill('.uac-pass', pass); await p.click('.uac-yes'); }
const closeAll = () => p.evaluate(() => WinEmu.WM.wins.forEach(w => w.close(true)));
const next = () => p.click('.wiz .dlg-foot .btn >> nth=1');
const conText = () => p.locator('.win.active .con-out').innerText();
async function typeCmd(line) { await p.locator('.win.active .con-in').fill(line); await p.locator('.win.active .con-in').press('Enter'); }

await step('Безпека Windows: стан мереж, вимкнення брандмауера просить пароль адміністратора', async () => {
  await p.evaluate(() => WinEmu.open('security'));
  await p.click('.sn[data-go="firewall"]');
  assert.equal(await p.locator('.net-row').count(), 3);
  assert.match(await p.locator('.net-row', { hasText: 'Приватна мережа' }).innerText(), /\(активна\)[\s\S]*Брандмауер увімкнено/);
  await p.click('.net-row[data-go="private"]');
  await p.click('[data-toggle="private"]');
  await login('admin', 'qwerty');
  assert.match(await p.locator('.uac-err').innerText(), /Неправильне ім’я користувача або пароль/);
  await p.click('.uac-no');
  await p.waitForSelector('.uac', { state: 'detached' });
  assert.equal((await fw()).profiles.private.on, true, '«Ні» — нічого не змінилося');
  await p.click('[data-toggle="private"]');
  await login();
  await p.waitForSelector('.toggle:not(.on)');
  assert.equal((await fw()).profiles.private.on, false);
  assert.ok(await p.locator('#fwTray.bad').count(), 'у треї червоний щит');
  await p.click('.sn[data-go="home"]');
  await p.click('.tile-s [data-fixall]');
  await login();
  await p.waitForFunction(() => WinEmu.fs.s.fw.profiles.private.on);
  assert.equal(await p.locator('#fwTray.bad').count(), 0);
});

await step('Панель керування: дозволені програми редагуються лише після «Змінити параметри»', async () => {
  await closeAll();
  await p.evaluate(() => WinEmu.open('firewallcpl', 'allow'));
  const fps = p.locator('.allow-tbl tr', { hasText: 'Спільний доступ до файлів і принтерів' });
  assert.ok(await fps.locator('[data-p$=":private"]').isDisabled());
  await p.click('[data-unlock]');
  await login();
  await fps.locator('[data-p$=":private"]').check();
  await p.click('.cpl-foot [data-ok]');
  const echo = await rule('Спільний доступ до файлів і принтерів (луна-запит — ICMPv4-вхідний)');
  assert.equal(echo.enabled, true);
  assert.deepEqual(echo.profiles, ['private']);
  assert.match(await p.locator('.cpl-net', { hasText: 'Приватні мережі' }).innerText(), /Увімк\./);
});

await step('wf.msc: відкривається лише з паролем, дерево, таблиця правил, фільтр, сортування', async () => {
  await closeAll();
  await p.evaluate(() => { WinEmu.open('wfmsc'); });
  await login('admin', '');
  assert.match(await p.locator('.uac-err').innerText(), /Введіть ім’я користувача та пароль/);
  await p.fill('.uac-pass', 'admin'); await p.click('.uac-yes');
  await p.waitForSelector('.mmc');
  assert.match(await p.locator('.ov').innerText(), /Приватний профіль\s*активний/);
  await p.click('.tn[data-node="in"]');
  const total = await p.locator('table.rules tbody tr').count();
  assert.ok(total > 10);
  await p.click('.ma[data-do="fprofile"]');
  await p.locator('.cm-it', { hasText: 'Загальнодоступний' }).dispatchEvent('click');
  assert.ok(await p.locator('table.rules tbody tr').count() < total);
  assert.match(await p.locator('.mmc-filter').innerText(), /Фільтр профілю: Загальнодоступний/);
  await p.click('.mmc-filter .link');
  assert.equal(await p.locator('table.rules tbody tr').count(), total);
  await p.click('th[data-sort="action"]');
  assert.match(await p.locator('table.rules tbody tr >> nth=0').innerText(), /Блокувати/);
});

await step('майстер: вихідне правило «Блокувати ICMPv4» — і ping у консолі перестає працювати', async () => {
  await p.click('.tn[data-node="out"]');
  await p.click('.ma[data-do="newrule"]');
  await p.click('.wiz input[name=type][value=custom]');
  assert.match(await p.locator('.wz-steps').innerText(), /Область/);
  await next(); // програма → усі
  await next();
  await p.selectOption('[data-f="proto2"]', 'ICMPv4');
  assert.ok(await p.locator('[data-f="lp"]').isDisabled(), 'порти лише для TCP/UDP');
  await p.click('[data-icmp]');
  await p.click('.icmp input[name=it][value=some]');
  await p.check('[data-it="8"]');
  await p.click('.icmp .dlg-foot .btn.primary');
  assert.match(await p.locator('.wz-grid').innerText(), /Луна-запит/);
  await next();
  await p.click('.wiz input[name=raddr][value=list]');
  await p.fill('[data-f="raddrlist"]', '8.8.8.300');
  await next();
  assert.match(await p.locator('.dlg-text').innerText(), /неправильна IP-адреса/);
  await p.click('.dlg .btn.primary >> nth=-1');
  await p.fill('[data-f="raddrlist"]', '8.8.8.8, 1.1.1.0/24');
  await next();
  await p.click('.wiz input[name=action][value=block]');
  await next();
  await next();
  await next();
  assert.match(await p.locator('.dlg-text').innerText(), /Укажіть ім’я правила/);
  await p.click('.dlg .btn.primary >> nth=-1');
  await p.fill('[data-f="name"]', 'Без ping до Google DNS');
  await next();
  const r = await rule('Без ping до Google DNS');
  assert.deepEqual([r.dir, r.action, r.protocol, r.icmp, r.remoteAddr], ['out', 'block', 'ICMPv4', [8], ['8.8.8.8', '1.1.1.0/24']]);
  assert.match(await p.locator('table.rules tr.sel').innerText(), /Без ping до Google DNS/);
  await p.evaluate(() => WinEmu.open('cmd'));
  await typeCmd('ping -n 1 8.8.8.8');
  await p.waitForFunction(() => /Загальна помилка/.test(document.querySelector('.win.active .con-out').innerText), null, { timeout: 5000 });
  await typeCmd('ping -n 1 9.9.9.9');
  await p.waitForFunction(() => /Відповідь від 9\.9\.9\.9/.test(document.querySelector('.win.active .con-out').innerText), null, { timeout: 5000 });
});

await step('властивості правила: вкладки, вимкнення, «Застосувати»; ping знову працює', async () => {
  await p.evaluate(() => { const w = WinEmu.WM.wins.find(x => x.app === 'wfmsc'); WinEmu.WM.focus(w); });
  await p.dblclick('table.rules tr.sel td >> nth=0');
  const tabs = await p.locator('.rprops .tab').allInnerTexts();
  assert.deepEqual(tabs, ['Загальні', 'Програми й служби', 'Віддалені комп’ютери', 'Протоколи й порти', 'Область', 'Додатково', 'Локальні принципали', 'Віддалені користувачі']);
  assert.ok(await p.locator('.rprops .dlg-foot .btn >> nth=2').isDisabled(), '«Застосувати» неактивна без змін');
  await p.uncheck('[data-g="enabled"]');
  await p.click('.rprops [data-tab="scope"]');
  assert.deepEqual(await p.locator('[data-alist="remoteAddr"] option').allInnerTexts(), ['8.8.8.8', '1.1.1.0/24']);
  await p.click('.rprops .dlg-foot .btn >> nth=2');
  assert.equal((await rule('Без ping до Google DNS')).enabled, false);
  await p.click('.rprops [data-tab="ports"]');
  await p.selectOption('[data-g="protocol"]', 'TCP');
  await p.fill('[data-p="remotePorts"]', '99999');
  await p.click('.rprops .dlg-foot .btn.primary');
  assert.match(await p.locator('.dlg-text').innerText(), /Неправильне значення порту/);
  await p.click('.dlg .btn.primary >> nth=-1');
  await p.click('.rprops .dlg-foot .btn >> nth=1');
  assert.equal((await rule('Без ping до Google DNS')).protocol, 'ICMPv4', '«Скасувати» не зберігає');
  assert.ok(await p.locator('table.rules tr.sel.dis').count());
  await p.evaluate(() => { const w = WinEmu.WM.wins.find(x => x.app === 'cmd'); WinEmu.WM.focus(w); });
  await typeCmd('cls');
  await typeCmd('ping -n 1 8.8.8.8');
  await p.waitForFunction(() => /Відповідь від 8\.8\.8\.8/.test(document.querySelector('.win.active .con-out').innerText), null, { timeout: 5000 });
});

await step('вхідне правило для порту через майстер, видалення й копіювання правил', async () => {
  await p.evaluate(() => { const w = WinEmu.WM.wins.find(x => x.app === 'wfmsc'); WinEmu.WM.focus(w); });
  await p.click('.tn[data-node="in"]');
  await p.click('.ma[data-do="newrule"]');
  await p.click('.wiz input[name=type][value=port]');
  await next();
  await p.fill('[data-f="ports"]', '25565');
  await next(); await next();
  await p.uncheck('[data-prof="public"]'); await p.uncheck('[data-prof="domain"]');
  await next();
  await p.fill('[data-f="name"]', 'Сервер Minecraft');
  await next();
  const r = await rule('Сервер Minecraft');
  assert.deepEqual([r.dir, r.protocol, r.localPorts, r.profiles, r.action], ['in', 'TCP', '25565', ['private'], 'allow']);
  await p.click('table.rules tr.sel td >> nth=0', { button: 'right' });
  await p.locator('.cm-it', { hasText: 'Копіювати' }).dispatchEvent('click');
  await p.click('.ma[data-do="paste"]');
  assert.equal((await fw()).rules.filter(x => x.name === 'Сервер Minecraft').length, 2);
  await p.keyboard.press('Delete');
  await p.click('.dlg .btn.primary');
  assert.equal((await fw()).rules.filter(x => x.name === 'Сервер Minecraft').length, 1);
});

await step('властивості брандмауера: вихідні «Блокувати» для приватного профілю, журнал у Блокноті', async () => {
  await p.click('.tn[data-node="root"]');
  await p.click('.ma[data-do="fwprops"]');
  assert.deepEqual(await p.locator('.fwp .tab').allInnerTexts(), ['Профіль домену', 'Приватний профіль', 'Загальнодоступний профіль', 'Параметри IPsec']);
  await p.click('.fwp [data-tab="private"]');
  await p.selectOption('[data-pf="private:outbound"]', 'block');
  await p.click('[data-sub="log:private"]');
  await p.selectOption('[data-l="dropped"]', '1');
  await p.click('.mdl.small .btn.primary');
  await p.click('.fwp .dlg-foot .btn.primary');
  const st = await fw();
  assert.equal(st.profiles.private.outbound, 'block');
  assert.equal(st.profiles.private.log.dropped, true);
  assert.match(await p.locator('.ov').innerText(), /Вихідні підключення, що не відповідають правилу, заблоковано/);
  await p.evaluate(() => { const w = WinEmu.WM.wins.find(x => x.app === 'cmd'); WinEmu.WM.focus(w); });
  await typeCmd('cls');
  await typeCmd('curl edvault.online');
  assert.match(await conText(), /Failed to connect/);
  await p.evaluate(() => { const w = WinEmu.WM.wins.find(x => x.app === 'wfmsc'); WinEmu.WM.focus(w); });
  await p.click('.tn[data-node="mon"]');
  assert.match(await p.locator('table.ev').innerText(), /Вихідне\s+TCP 443[\s\S]*Заблоковано/);
  await p.click('.ma[data-do="openlog"]');
  await p.waitForSelector('.win.active .np');
  assert.match(await p.locator('.win.active textarea').inputValue(), /DROP TCP 192\.168\.1\.27/);
});

await step('консоль адміністратора: netsh змінює правила, «Відновити стандартну політику»', async () => {
  await p.evaluate(() => { WinEmu.open('cmd-admin'); });
  await login();
  await p.waitForFunction(() => /Адміністратор: Командний рядок/.test(document.querySelector('.win.active .win-name')?.textContent || ''));
  await typeCmd('netsh advfirewall set privateprofile firewallpolicy blockinbound,allowoutbound');
  assert.match(await conText(), /ОК\./);
  assert.equal((await fw()).profiles.private.outbound, 'allow');
  await typeCmd('netsh advfirewall firewall add rule name="Веб" dir=in action=allow protocol=tcp localport=80');
  assert.ok(await rule('Веб'));
  await p.evaluate(() => { const w = WinEmu.WM.wins.find(x => x.app === 'wfmsc'); WinEmu.WM.focus(w); });
  await p.click('.tn[data-node="in"]');
  assert.ok(await p.locator('table.rules tr', { hasText: 'Веб' }).count(), 'таблиця оновилася сама');
  await p.click('.tn[data-node="root"]');
  await p.click('.ma[data-do="restore"]');
  await p.click('.dlg .btn.primary');
  assert.equal(await rule('Веб'), null);
  assert.equal(await rule('Без ping до Google DNS'), null);
});

await step('«Пуск»: пошук «брандмауер» знаходить усі три вікна', async () => {
  await closeAll();
  await p.evaluate(() => WinEmu.openStart());
  await p.fill('#stQ', 'брандмауер');
  const res = await p.locator('.st-r b').allInnerTexts();
  assert.ok(res.includes('Брандмауер Захисника Windows') && res.includes('Брандмауер у режимі підвищеної безпеки'));
  await p.keyboard.press('Escape');
});

await step('жодної помилки в консолі сторінки', async () => { assert.deepEqual(errors, []); });

await browser.close();
server.close();
