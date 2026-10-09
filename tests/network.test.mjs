// Мережі: адреси й маски, кабелі, ping через комутатор і роутер, DHCP, DNS, цілісність рівнів.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIp, ipStr, maskBits, sameNet, hostOk, canLink, effective, ping, checkGoals, applyOp, cloneNet, netStars } from '../trainers/networktrainer/js/logic.js';
import { LEVELS, CHAPTERS } from '../trainers/networktrainer/js/levels.js';

const M = '255.255.255.0';
const pc = (id, ip = '', gw = '', dns = '', more = {}) => ({ id, type: 'pc', name: id.toUpperCase(), ip, mask: M, gw, dns, ...more });

test('IP-адреси й маски', () => {
  assert.equal(ipStr(parseIp('192.168.1.25')), '192.168.1.25');
  for (const bad of ['192.168.1.300', '192.168.1', '192,168,1,1', '', '1.2.3.04', 'abc']) assert.equal(parseIp(bad), null, bad);
  assert.equal(maskBits('255.255.255.0'), 24);
  assert.equal(maskBits('255.255.0.0'), 16);
  assert.equal(maskBits('255.0.255.0'), null);
  assert.ok(sameNet('192.168.1.2', '192.168.1.200', M));
  assert.ok(!sameNet('192.168.1.2', '192.168.2.2', M));
  assert.ok(sameNet('192.168.1.2', '192.168.2.2', '255.255.0.0'));
  assert.ok(hostOk('192.168.1.1', M));
  assert.ok(!hostOk('192.168.1.0', M));
  assert.ok(!hostOk('192.168.1.255', M));
});

test('кабелі: одне гніздо в комп’ютера, порт роутера — для одного кабелю', () => {
  const net = { devices: [pc('a', '192.168.1.2'), pc('b', '192.168.1.3'), pc('c', '192.168.1.4'), { id: 'r', type: 'router', name: 'R', ports: { lan1: { ip: '' } } }], links: [['a', 'b']] };
  assert.match(canLink(net, 'a', 'c'), /одне гніздо/);
  assert.match(canLink(net, 'b', 'a'), /вже з’єднані/);
  assert.equal(canLink(net, 'c', 'r:lan1'), null);
  net.links.push(['c', 'r:lan1']);
  assert.match(canLink(net, 'r:lan1', 'a'), /LAN1.*зайнятий/);
});

test('ping: кабель, однакові адреси, інша мережа', () => {
  const net = { devices: [pc('a', '192.168.1.2'), pc('b', '192.168.1.3'), { id: 's', type: 'switch', name: 'S' }], links: [] };
  assert.match(ping(net, 'a', 'b').reason, /не підключено/);
  net.links.push(['a', 's'], ['b', 's']);
  const ok = ping(net, 'a', 'b');
  assert.ok(ok.ok); assert.deepEqual(ok.path, ['a', 's', 'b']);
  net.devices[1].ip = '192.168.1.2';
  assert.match(ping(net, 'a', 'b').reason, /Однакова адреса/);
  net.devices[1].ip = '192.168.2.3';
  assert.match(ping(net, 'a', 'b').reason, /поруч, але в іншій мережі/);
});

test('ping через роутер потребує шлюзу в обох — туди й назад', () => {
  const net = { devices: [pc('a', '192.168.1.2', '192.168.1.1'), pc('b', '192.168.2.2'), { id: 'r', type: 'router', name: 'Роутер', ports: { lan1: { ip: '192.168.1.1', mask: M }, lan2: { ip: '192.168.2.1', mask: M }, wan: {} } }],
    links: [['a', 'r:lan1'], ['b', 'r:lan2']] };
  assert.match(ping(net, 'a', 'b').reason, /не може відповісти/);
  net.devices[1].gw = '192.168.2.1';
  const r = ping(net, 'a', 'b');
  assert.ok(r.ok, r.reason); assert.deepEqual(r.path, ['a', 'r:lan1', 'r:lan2', 'b']);
  assert.match(ping(net, 'a', '8.8.8.8').reason, /WAN/);
});

test('DHCP роздає адреси, DNS знаходить сайт', () => {
  const net = { devices: [pc('a', '', '', '', { auto: true }), pc('b', '', '', '', { auto: true }), { id: 's', type: 'switch', name: 'S' }, { id: 'net', type: 'cloud', name: 'Інтернет' },
    { id: 'r', type: 'router', name: 'Роутер', dns: '8.8.8.8', ports: { lan1: { ip: '192.168.1.1', mask: M, dhcp: false }, wan: {} } }],
    links: [['a', 's'], ['b', 's'], ['s', 'r:lan1'], ['r:wan', 'net']] };
  assert.match(ping(net, 'a', 'edvault.online').reason, /DHCP/);
  net.devices[4].ports.lan1.dhcp = true;
  const e = effective(net);
  assert.equal(e.a.ip, '192.168.1.100'); assert.equal(e.b.ip, '192.168.1.101'); assert.equal(e.a.gw, '192.168.1.1');
  const r = ping(net, 'a', 'edvault.online');
  assert.ok(r.ok, r.reason); assert.match(r.reason, /185\.199\.108\.153/);
  assert.match(ping(net, 'a', 'journal.school').reason, /не знає/);
});

test('рівні: 5 розділів по 4, у кожного пам’ятка, мережа не працює до розв’язку й працює після', () => {
  assert.equal(LEVELS.length, 20);
  assert.equal(new Set(LEVELS.map(l => l.id)).size, 20);
  for (const ch of CHAPTERS) assert.equal(LEVELS.filter(l => l.chapter === ch.id).length, 4, ch.id);
  for (const l of LEVELS) {
    assert.equal(l.tips.length, 3, l.id);
    if (l.kind === 'quiz') {
      for (const t of l.tasks) assert.equal(t.options.filter(o => o.ok).length, 1, l.id + ': ' + t.q);
      continue;
    }
    const net = cloneNet(l);
    for (const d of net.devices) assert.ok(d.x >= 50 && d.x <= 670 && d.y >= 40 && d.y <= 350, `${l.id}: ${d.id} за межами схеми`);
    assert.ok(checkGoals(net, l.goals).some(r => !r.ok), l.id + ' уже розв’язаний');
    for (const op of l.solve) applyOp(net, op);
    for (const r of checkGoals(net, l.goals)) assert.ok(r.ok, `${l.id}: ${r.goal.from} → ${r.goal.to}: ${r.reason}`);
    // кроки розв’язку не виходять за межі дозволеного
    const need = new Set(l.solve.map(([op, , f, g]) => op === 'link' ? 'cables' : op === 'port' ? (g === 'dhcp' ? 'dhcp' : 'router') : f === 'auto' ? 'mode' : f));
    for (const n of need) assert.ok(l.edit.split(' ').includes(n), `${l.id}: потрібно «${n}», а дозволено «${l.edit}»`);
  }
});

test('зірки за перевірки', () => {
  assert.equal(netStars(0, false), 3);
  assert.equal(netStars(1, false), 3);
  assert.equal(netStars(2, false), 2);
  assert.equal(netStars(0, true), 2);
  assert.equal(netStars(5, false), 1);
});
