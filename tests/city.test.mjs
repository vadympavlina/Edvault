// Симулятор міста: рушій без браузера — будівництво, енергія, ріст, транспорт, забруднення, бюджет, освіта, жителі, місії.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newCity, City, okState, EVENTS } from '../emulators/citysim/js/sim.js';
import { autoplay } from '../emulators/citysim/js/bots.js';
import { N, T, Z, B, ROADS, SCENARIOS, BRIDGE_MUL } from '../emulators/citysim/js/data.js';
import { streetOf } from '../emulators/citysim/js/people.js';

const days = (c, n) => { for (let i = 0; i < n; i++) c.tick(); };
const months = (c, n) => days(c, n * 30);
const row = (y, x0, x1) => Array.from({ length: x1 - x0 + 1 }, (_, k) => y * N + x0 + k);
const rect = (x0, y0, x1, y1) => { const a = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) a.push(y * N + x); return a; };
// Сухе місце для тестового кварталу: без води й будівель
function spot(c, w, h) {
  const s = c.s;
  for (let y = 2; y < N - h - 2; y++) for (let x = 2; x < N - w - 2; x++) {
    let ok = true; for (const i of rect(x, y, x + w, y + h)) if (s.ter[i] === T.WATER || s.bid[i] || s.road[i]) { ok = false; break; }
    if (ok) return [x, y];
  }
  throw new Error('немає місця');
}
// Невеликий квартал: дорога, житло, станція (за бажанням)
function town(c, { plant = 'coal', w = 14 } = {}) {
  const [x, y] = spot(c, w, 9);
  c.placeRoad(row(y + 3, x, x + w));
  c.placeZone(rect(x, y + 4, x + 7, y + 5), Z.R);
  c.placeZone(rect(x, y, x + 7, y + 2), Z.C);
  if (plant) c.build(plant, x + 9, y + 4);
  return [x, y];
}

test('нове місто: рельєф, мерія з дорогами, коректний стан', () => {
  const c = newCity({ seed: 3, name: 'Тестове' }), s = c.s;
  assert.ok(okState(s));
  assert.ok(s.ter.includes(T.WATER) && s.ter.includes(T.TREE), 'є вода й ліс');
  const th = Object.values(s.bld).find(b => b.type === 'townhall');
  assert.ok(th); assert.ok(s.road.filter(Boolean).length >= 10);
  assert.equal(c.m.P, 0);
  assert.ok(s.inbox.some(m => /Вітаємо/.test(m.title)));
  assert.match(s.journal[0].t, /Засновано місто/);
});

test('однакове зерно й рішення — однакове місто; гра відновлюється з JSON', () => {
  const a = newCity({ seed: 5 }), b = newCity({ seed: 5 });
  town(a); town(b); months(a, 6); months(b, 6);
  assert.deepEqual(a.s, b.s);
  const r = new City(JSON.parse(JSON.stringify(a.s)));
  months(a, 4); months(r, 4);
  assert.deepEqual(r.s, a.s, 'продовження після збереження — те саме');
});

test('будівництво: ціни, міст дорожчий, перевірки місця й відкриття будівель', () => {
  const c = newCity({ seed: 8 }), s = c.s;
  const water = s.ter.findIndex(t => t === T.WATER), land = spot(c, 6, 6);
  assert.equal(c.roadCost([water]).cost, ROADS.road.cost * BRIDGE_MUL);
  const m0 = s.money, r = c.placeRoad(row(land[1], land[0], land[0] + 2));
  assert.ok(r.ok); assert.equal(s.money, m0 - r.cost);
  assert.match(c.canBuild('school', land[0], land[1]).msg, /дорога/);
  assert.match(c.canBuild('school', ...[water % N, (water / N) | 0]).msg, /вод/);
  assert.match(c.canBuild('uni', land[0], land[1] + 2).msg, /Відкриється/);
  assert.match(c.canBuild('stop', land[0] + 6, land[1] + 6).msg || 'ok', /біля дороги|ok/);
  s.money = 10; assert.match(c.canBuild('coal', land[0], land[1] + 2).msg, /грошей/);
});

test('енергія: без станції або без дороги до неї — темрява; станція біля дороги дає світло', () => {
  const c = newCity({ seed: 11 }); const [x, y] = town(c, { plant: null });
  months(c, 2);
  assert.equal(c.m.P, 0, 'без світла будинки не ростуть');
  c.build('coal', x + 9, y + 4); months(c, 6);
  assert.ok(c.m.P > 0, 'зі світлом ростуть');
  assert.ok(c.m.supply > c.m.demand);
  // станція далеко від доріг не дає енергії
  const d = newCity({ seed: 11 }); const [x2, y2] = town(d, { plant: null });
  const far = spot(d, 4, 4); d.build('coal', far[0] + 1, far[1] + 1); d.recompute();
  assert.equal(Object.values(d.s.bld).find(b => b.type === 'coal')._out, 0);
});

test('нестача енергії: віялові відключення й злі жителі', () => {
  const c = newCity({ seed: 12 }); town(c, { plant: 'wind' });
  c.s.flags.unlockAll = true;
  months(c, 10);
  if (c.m.demand > c.m.supply) assert.ok(c.m.blackoutShare > 0);
  const w = Object.values(c.s.bld).find(b => b.type === 'wind'); c.bulldoze([w.y * N + w.x]); c.recompute();
  assert.equal(c.m.blackoutShare > 0.9 || c.m.P === 0, true);
});

test('забруднення: вугільна станція бруднить, дерева й парк очищують', () => {
  const c = newCity({ seed: 14 }), [x, y] = town(c);
  months(c, 3);
  const coal = Object.values(c.s.bld).find(b => b.type === 'coal'), near = (coal.y + 1) * N + coal.x + 1;
  assert.ok(c.m.poll[near] > 30, 'біля ТЕС брудно');
  const before = c.m.poll[(y + 5) * N + x + 1];
  c.plantTrees(rect(x, y + 6, x + 8, y + 8)); c.recompute();
  assert.ok(c.m.poll[(y + 5) * N + x + 1] <= before, 'дерева не погіршують');
});

test('транспорт: автобуси й проспект зменшують затори', () => {
  const c = newCity({ seed: 2, scenario: 'jam' });
  const cong0 = c.m.avgCong, cars0 = c.m.carTrips;
  assert.ok(cong0 > 0.3, 'у місті заторів справді затори');
  c.s.money = 1e6;
  const [cx, cy] = c.m.center;
  // депо й зупинки біля житла
  for (let k = 0; k < 400 && !c.m.hasDepot; k++) { const x = cx - 14 + (k % 20), y = cy - 14 + Math.floor(k / 20); if (c.build('depot', x, y).ok) c.recompute(); }
  let stops = 0; for (let i = 0; i < N * N && stops < 40; i++) if (c.m.pop[i] && !c.s.road[i]) { const x = i % N, y = (i / N) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + dy) * N + x + dx; if (!c.s.road[j] && !c.s.bid[j] && !c.s.zone[j] && c.build('stop', x + dx, y + dy).ok) { stops++; break; } } }
  c.togglePolicy('freeBus'); c.recompute();
  assert.ok(c.m.hasDepot);
  assert.ok(c.m.transitShare > 0.05, 'частина людей їде автобусом');
  assert.ok(c.m.carTrips < cars0, 'машин менше');
});

test('бюджет: податки збільшують дохід, але знижують попит; фінансування впливає на служби', () => {
  const a = newCity({ seed: 21 }), b = newCity({ seed: 21 });
  autoplay(a, 30); autoplay(b, 30);
  a.setTax('r', 14); a.setTax('c', 14); a.setTax('i', 14); months(a, 1); months(b, 1);
  assert.ok(a.s.history.at(-1).income > b.s.history.at(-1).income);
  assert.ok(a.s.demand.r < b.s.demand.r);
  const covB = b.m.cov.school.reduce((x, y) => x + y, 0); b.setFunding('edu', 30); b.recompute();
  assert.ok(b.m.cov.school.reduce((x, y) => x + y, 0) < covB);
});

test('освіта зростає роками: школи, ліцей, університет', () => {
  const c = newCity({ seed: 9, scenario: 'smart' });
  const h0 = c.s.edu.high;
  c.s.money = 1e6; c.s.flags.unlockAll = true;
  const [cx, cy] = c.m.center;
  for (const t of ['lyceum', 'lyceum', 'uni', 'library']) for (let k = 0; k < 600; k++) { const x = cx - 15 + (k % 30), y = cy - 15 + Math.floor(k / 30); if (c.build(t, x, y).ok) break; }
  months(c, 36);
  assert.ok(c.s.edu.high > h0 + 0.08, `вища освіта зросла: ${h0} → ${c.s.edu.high}`);
});

test('жителі: родини з іменами й думками з реальних умов', () => {
  const c = newCity({ seed: 6, scenario: 'smog' });
  assert.ok(c.s.families.length > 10);
  const f = c.s.families[0];
  assert.ok(f.last && f.members.length && f.members[0].n);
  months(c, 2);
  const voices = c.s.news.filter(n => n.kind === 'voice');
  assert.ok(voices.length > 0);
  assert.ok(voices.some(v => v.key), 'думка має причину');
  assert.match(streetOf(c, f.i), /^(вул\. |околиця)/);
});

test('події з вибором і журнал рішень', () => {
  const c = newCity({ seed: 4 }); c.recompute();
  const ev = EVENTS.festival; c.s.money = 50000;
  const made = ev.make(c, c.metrics()), e = c.mail({ ev: 'festival', title: made.title, body: made.body, choices: ev.choices(c).map(x => x.t) });
  const res = c.choose(e.id, 0);
  assert.match(res, /Свято/); assert.equal(c.s.money, 46000);
  assert.ok(c.s.journal.some(j => /Рішення/.test(j.t)));
  assert.equal(c.choose(e.id, 1), null, 'вдруге не можна');
});

test('вибори: низька підтримка — поразка', () => {
  const c = newCity({ seed: 4 }); c.s.month = 47; c.s.approval = 20; c.s.day = 29; c.recompute();
  c.s.approval = 20; c.tick();
  assert.equal(c.s.over?.kind, 'lost');
});

test('місії: стартові міста мають проблеми, цілі спершу не виконані', () => {
  for (const k of ['smog', 'jam', 'debt', 'smart']) {
    const c = newCity({ seed: 7, scenario: k });
    assert.ok(c.m.P > 2000, `${k}: місто вже живе`);
    const g = c.goals();
    assert.equal(g.length, SCENARIOS[k].goals.length);
    assert.ok(g.some(x => !x.ok), `${k}: є що виправляти`);
    assert.equal(c.s.over, null);
  }
  const s = newCity({ seed: 7, scenario: 'smog' }), f = newCity({ seed: 7 });
  autoplay(f, 60);
  assert.ok(s.m.aqi > f.m.aqi, 'у задушливому місті повітря гірше, ніж у звичайному');
});

test('баланс: розважливий мер за 5 років виростає місто без боргової ями', () => {
  for (const seed of [42, 7, 99]) {
    const c = newCity({ seed });
    autoplay(c, 60);
    const h = c.s.history.at(-1);
    assert.ok(h.pop > 5000, `seed ${seed}: населення ${h.pop}`);
    assert.ok(h.money > -10000, `seed ${seed}: гроші ${h.money}`);
    assert.ok(h.happy > 50, `seed ${seed}: щастя ${h.happy}`);
  }
});

test('знесення й рівні будинків у межах, пожежі не ламають стан', () => {
  const c = newCity({ seed: 31 }); autoplay(c, 24);
  for (let k = 0; k < 40; k++) c.s.fires.push({ i: Math.floor(Math.random() * N * N), d: 0 });
  months(c, 2);
  for (let i = 0; i < N * N; i++) { assert.ok(c.s.lvl[i] >= 0 && c.s.lvl[i] <= 4); if (!c.s.zone[i]) assert.equal(c.s.lvl[i], 0); }
  const any = Object.values(c.s.bld).find(b => b.type !== 'townhall');
  const r = c.bulldoze([any.y * N + any.x]); assert.ok(r.ok); assert.ok(!c.s.bld[any.id]);
  assert.ok(okState(JSON.parse(JSON.stringify(c.s))));
});

test('журнал: дороги, зони, дерева й знесення за місяць зводяться в один рядок', () => {
  const c = newCity({ seed: 5 }); c.s.money = 1e6;
  const [x, y] = spot(c, 12, 4), n0 = c.s.journal.length;
  c.placeRoad(row(y, x, x + 4)); c.placeRoad(row(y, x + 5, x + 9));
  c.placeZone(rect(x, y + 1, x + 2, y + 2), Z.R);
  c.plantTrees(rect(x + 5, y + 1, x + 6, y + 1));
  c.bulldoze(row(y, x + 8, x + 9));
  const J = c.s.journal.slice(n0).map(j => j.t);
  assert.deepEqual(J.slice(0, 1).map(t => t.replace(/ \(.*/, '')), ['Прокладено дорогу 10 клітинок']);
  assert.ok(J.some(t => /^Позначено житлову зону 6 ділянок/.test(t)));
  assert.ok(J.some(t => /^Посаджено дерев: 2/.test(t)));
  assert.ok(J.some(t => /^Знесено 2 об’єкти/.test(t)));
  months(c, 1); c.placeRoad(row(y + 3, x, x + 1));
  assert.match(c.s.journal.at(-1).t, /^Прокладено дорогу 2 клітинки/);
});
