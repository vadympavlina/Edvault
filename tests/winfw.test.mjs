// Емулятор Windows: брандмауер — перевірка пакетів, netsh, вплив на ping і curl, журнал.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { FS } from '../emulators/windowsemu/js/fs.js';
import { Cmd } from '../emulators/windowsemu/js/cmd.js';
import { fwOf, evaluate, validPorts, validAddr, allowedApps, setAppProfile, PROGRAMS, LOG_FILE } from '../emulators/windowsemu/js/fw.js';

const run = (c, l) => c.run(l).out.join('\n');
const setup = () => { const fs = new FS(); return { fs, fw: fwOf(fs), user: new Cmd(fs, { live: false }), admin: new Cmd(fs, { live: false, admin: true }) }; };
const pingOut = { dir: 'out', protocol: 'ICMPv4', icmpType: 8, remoteIp: '8.8.8.8', program: PROGRAMS.ping };
const pingIn = { dir: 'in', protocol: 'ICMPv4', icmpType: 8, remoteIp: '192.168.1.15', program: 'System' };

test('правила: за замовчуванням вхідні блокуються, вихідні дозволені; блокування сильніше', () => {
  const { fw } = setup();
  assert.equal(evaluate(fw, pingOut).allow, true);
  assert.equal(evaluate(fw, pingIn).allow, false, 'вхідний ping заблоковано, поки правило вимкнене');
  fw.rules.find(r => r.name.startsWith('Спільний доступ до файлів і принтерів (луна-запит — ICMPv4-вхідний)')).enabled = true;
  assert.equal(evaluate(fw, pingIn).allow, true);
  fw.profiles.private.inbound = 'blockall';
  assert.equal(evaluate(fw, pingIn).allow, false, '«блокувати всі» сильніше за дозвіл');
  fw.profiles.private.inbound = 'block';
  fw.rules.push({ ...fw.rules[0], id: 'x', name: 'Блок', action: 'block', protocol: 'ICMPv4', icmp: 'any', remoteAddr: ['192.168.1.0/24'], localPorts: 'any', remotePorts: 'any', program: 'any', profiles: 'any', enabled: true });
  assert.equal(evaluate(fw, pingIn).allow, false, 'правило «Блокувати» перемагає «Дозволити»');
  fw.profiles.private.on = false;
  assert.equal(evaluate(fw, pingIn).why, 'off');
  assert.ok(validPorts('80,443,8000-8080') && !validPorts('70000') && !validPorts('a'));
  assert.ok(validAddr('10.0.0.0/8') && validAddr('LocalSubnet') && validAddr('1.1.1.1-1.1.1.9') && !validAddr('300.1.1.1'));
});

test('ping і curl слухаються брандмауера, журнал записує заблоковане', () => {
  const { fs, fw, user } = setup();
  assert.match(run(user, 'ping -n 1 8.8.8.8'), /Відповідь від 8\.8\.8\.8/);
  fw.profiles.private.outbound = 'block';
  fw.profiles.private.log.dropped = true;
  assert.match(run(user, 'ping -n 2 8.8.8.8'), /Загальна помилка[\s\S]*втрачено = 2/);
  assert.match(run(user, 'curl edvault.online'), /Failed to connect.*Timed out/);
  assert.match(fs.readFile(LOG_FILE), /DROP ICMP 192\.168\.1\.27 8\.8\.8\.8/);
  fw.rules.find(r => r.name === 'Спільний доступ до файлів і принтерів (луна-запит — ICMPv4-вихідний)').enabled = true;
  assert.match(run(user, 'ping -n 1 google.com'), /Відповідь від/, 'DNS дозволено правилом, ICMP — увімкненим правилом');
  fw.rules.find(r => r.name.startsWith('Основні мережеві засоби — DNS')).enabled = false;
  assert.match(run(user, 'ping -n 1 google.com'), /не змогла знайти вузол/, 'без DNS імена не знаходяться');
  assert.match(run(user, 'ping -n 1 127.0.0.1'), /Відповідь від 127\.0\.0\.1/, 'сам до себе — завжди');
  assert.match(run(user, 'type C:\\Windows\\System32\\LogFiles\\Firewall\\pfirewall.log'), /#Software: Microsoft Windows Firewall/);
});

test('netsh: перегляд для всіх, зміни лише адміністратору', () => {
  const { fw, user, admin } = setup();
  assert.match(run(user, 'netsh advfirewall show currentprofile'), /Приватний.*\(поточний\)[\s\S]*УВІМКНЕНО/);
  assert.match(run(user, 'netsh advfirewall set allprofiles state off'), /вимагає підвищення прав/);
  assert.equal(fw.profiles.public.on, true);
  assert.match(run(admin, 'netsh advfirewall set allprofiles state off'), /ОК\./);
  assert.equal(fw.profiles.public.on, false);
  run(admin, 'netsh advfirewall set allprofiles state on');
  assert.match(run(admin, 'netsh advfirewall firewall add rule name="Без Google" dir=out action=block remoteip=142.250.74.110'), /ОК\./);
  assert.match(run(admin, 'ping -n 1 google.com'), /Загальна помилка/);
  assert.match(run(user, 'netsh advfirewall firewall show rule name="Без Google"'), /Блокувати/);
  assert.match(run(admin, 'netsh advfirewall firewall add rule name=Веб dir=in action=allow localport=80'), /лише для протоколів TCP і UDP/);
  assert.match(run(admin, 'netsh advfirewall firewall add rule name=Веб dir=in action=allow protocol=tcp localport=99999'), /Неправильний номер порту/);
  assert.match(run(admin, 'netsh advfirewall firewall set rule name="Без Google" new enable=no'), /Оновлено правил: 1/);
  assert.match(run(admin, 'ping -n 1 google.com'), /Відповідь від/);
  assert.match(run(admin, 'netsh advfirewall firewall delete rule name="Без Google"'), /Видалено правил: 1/);
  assert.match(run(admin, 'netsh advfirewall firewall delete rule name="Без Google"'), /Не знайдено правил/);
  assert.equal(admin.prompt, 'C:\\Windows\\System32>');
  run(admin, 'netsh advfirewall set publicprofile firewallpolicy blockinboundalways,blockoutbound');
  assert.equal(fw.profiles.public.inbound, 'blockall'); assert.equal(fw.profiles.public.outbound, 'block');
  run(admin, 'netsh advfirewall reset');
  assert.equal(fwOf(admin.fs).profiles.public.outbound, 'allow');
});

test('дозволені програми з Панелі керування', () => {
  const { fw } = setup();
  const apps = allowedApps(fw);
  const fps = apps.find(a => a.key === 'Спільний доступ до файлів і принтерів');
  assert.ok(fps && !fps.private && !fps.public);
  setAppProfile(fw, fps.key, 'private', true);
  const after = allowedApps(fw).find(a => a.key === fps.key);
  assert.ok(after.private && !after.public);
  assert.equal(evaluate(fw, pingIn).allow, true, 'приватна мережа — ping до цього ПК тепер дозволено');
});
