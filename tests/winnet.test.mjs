// Модель мережі емулятора Windows (net.js) і мережеві команди
import test from 'node:test';
import assert from 'node:assert/strict';
import { FS } from '../emulators/windowsemu/js/fs.js';
import { Cmd } from '../emulators/windowsemu/js/cmd.js';
import { netOf, adapters, primary, reach, resolveName, checkIPv4, diagnose, wifiConnect, maskOk, sameNet } from '../emulators/windowsemu/js/net.js';

const fresh = () => { const fs = new FS(); return { fs, c: new Cmd(fs, { live: false, open() {} }) }; };
const run = (c, l) => c.run(l).out.join('\n');
const look = x => ({ 'poshuk.edvault': '185.199.110.20' })[x];

test('стандартно: Ethernet у шкільній мережі, Wi‑Fi не підключено', () => {
  const { fs } = fresh();
  const [eth, wifi] = adapters(fs);
  assert.equal(eth.status, 'connected'); assert.equal(eth.ip, '192.168.1.27');
  assert.equal(wifi.status, 'disconnected');
  assert.ok(reach(fs, '8.8.8.8').ok);
  assert.equal(resolveName(fs, 'poshuk.edvault', look).ip, '185.199.110.20');
  assert.ok(diagnose(fs).every(([k]) => k === 'ok'));
});

test('ipconfig /release і /renew', () => {
  const { fs, c } = fresh();
  run(c, 'ipconfig /release');
  assert.equal(primary(fs), null);
  assert.match(run(c, 'ping 8.8.8.8'), /Загальна помилка/);
  assert.match(diagnose(fs)[0][1], /ipconfig \/renew/);
  run(c, 'ipconfig /renew');
  assert.match(run(c, 'ping 8.8.8.8'), /отримано = 4/);
});

test('ручні налаштування: неправильний шлюз і DNS', () => {
  const { fs, c } = fresh(); const S = netOf(fs);
  Object.assign(S.eth, { dhcp: false, ip: '192.168.1.50', mask: '255.255.255.0', gw: '192.168.1.2', dnsAuto: false, dns1: '192.168.1.10', dns2: '' });
  assert.equal(reach(fs, '8.8.8.8').err, 'unreach');
  assert.match(run(c, 'ping 8.8.8.8'), /Заданий вузол недоступний/);
  assert.ok(reach(fs, '192.168.1.1').ok, 'сусіди в мережі доступні');
  S.eth.gw = '192.168.1.1'; S.eth.dns1 = '192.168.1.99';
  assert.ok(reach(fs, '8.8.8.8').ok);
  assert.equal(resolveName(fs, 'poshuk.edvault', look).err, 'timeout');
  assert.match(run(c, 'ping poshuk.edvault'), /не змогла знайти вузол/);
  S.eth.ip = '192.168.1.15';
  assert.equal(reach(fs, '8.8.8.8').conflict, true);
  assert.match(diagnose(fs).at(-1)[1], /Конфлікт/);
});

test('Wi‑Fi: пароль і перехід на Wi‑Fi без кабелю', () => {
  const { fs } = fresh(); const S = netOf(fs);
  assert.equal(wifiConnect(fs, 'SCHOOL-WIFI', 'nope').badPass, true);
  assert.ok(wifiConnect(fs, 'SCHOOL-WIFI', 'Shkola2026').ok);
  S.eth.on = false;
  assert.equal(primary(fs).id, 'wifi'); assert.equal(primary(fs).ip, '192.168.1.58');
  assert.ok(wifiConnect(fs, 'Kavyarnya_Free', '').ok);
  assert.equal(primary(fs).net.profile, 'public');
});

test('перевірка полів IPv4', () => {
  assert.deepEqual(checkIPv4({ ip: '192.168.1.50', mask: '255.255.255.0', gw: '192.168.1.1', dns1: '8.8.8.8' }), {});
  assert.ok(checkIPv4({ ip: '192.168.1.0', mask: '255.255.255.0' }).ip);
  assert.ok(checkIPv4({ ip: '192.168.1.255', mask: '255.255.255.0' }).ip);
  assert.ok(checkIPv4({ ip: '300.1.1.1', mask: '255.255.255.0' }).ip);
  assert.ok(checkIPv4({ ip: '192.168.1.5', mask: '255.0.255.0' }).mask);
  assert.ok(checkIPv4({ ip: '192.168.1.5', mask: '255.255.255.0', gw: '10.0.0.1' }).gw);
  assert.ok(maskOk('255.255.252.0') && !maskOk('255.255.255.1'));
  assert.ok(sameNet('10.0.0.5', '10.0.0.200', '255.255.255.0'));
});

test('команди: tracert, arp, getmac, net user, flushdns', () => {
  const { c } = fresh();
  assert.match(run(c, 'tracert 8.8.8.8'), /router\.school\.local[\s\S]*8\.8\.8\.8\s*\n\nТрасування завершено/);
  run(c, 'ping 192.168.1.104');
  assert.match(run(c, 'arp -a'), /192\.168\.1\.104\s+00-80-77-4d-aa-10/);
  assert.match(run(c, 'getmac'), /3C-52-82-1A-7F-09/);
  assert.match(run(c, 'net user admin'), /Пароль можна змінювати\s+Ні/);
  assert.match(run(c, 'net user admin 12345'), /Відмовлено в доступі/);
  run(c, 'ping poshuk.edvault');
  assert.match(run(c, 'ipconfig /displaydns'), /poshuk\.edvault/);
  run(c, 'ipconfig /flushdns');
  assert.match(run(c, 'ipconfig /displaydns'), /порожній/);
});
