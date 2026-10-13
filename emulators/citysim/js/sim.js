// Симулятор міста · рушій. Без DOM: працює і в браузері, і в тестах (node).
// Один хід — день; щомісяця — бюджет, освіта, настрій жителів, події, вибори, статистика.
import { N, T, Z, B, ROADS, ZONES, POLICIES, SCENARIOS, START_YEAR, DAYS, ZONE_COST, BRIDGE_MUL, TREE_COST, BULLDOZE_COST, R_POP } from './data.js';
import { computeMaps, hash, tilePop, tileJobs } from './maps.js';
import { syncFamilies, monthlyVoices, streetOf } from './people.js';

const NN = N * N;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const sum = a => a.reduce((x, y) => x + y, 0);
export const MONTHS = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
const MONTHS_G = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
export const dateText = (month, day = 0) => `${day + 1} ${MONTHS_G[month % 12]} ${START_YEAR + Math.floor(month / 12)}`;
export const monthText = m => `${MONTHS[m % 12]} ${START_YEAR + Math.floor(m / 12)}`;
export const money = (n, sign = false) => { const s = sign && n > 0 ? '+' : n < 0 ? '−' : '', a = Math.abs(Math.round(n)); return `${s}${a.toLocaleString('uk-UA').replace(/\s/g, ' ')} ₴`; };
export const num = n => Math.round(n).toLocaleString('uk-UA').replace(/\s/g, ' ');
export const pct = (x, d = 0) => (x * 100).toFixed(d).replace('.', ',') + '%';
export const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k >= 2 && k <= 4 ? b : c; };

/* ═════════ випадковість із зерном (зберігається разом із грою) ═════════ */
export function rng(st) {
  return () => { let t = st.rs = (st.rs + 0x6D2B79F5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ═════════ рельєф: річка, озеро, ліси ═════════ */
function noise(seed) {
  const g = (x, y) => hash(x * 7919 + y * 104729, seed);
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => { const X = Math.floor(x), Y = Math.floor(y), fx = sm(x - X), fy = sm(y - Y); const a = g(X, Y), b = g(X + 1, Y), c = g(X, Y + 1), d = g(X + 1, Y + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
}
function terrain(seed, kind = 'river') {
  const ter = new Array(NN).fill(T.GRASS), nz = noise(seed), nz2 = noise(seed + 1);
  const r = rng({ rs: seed });
  // річка: звивиста, з одного краю мапи до іншого
  const vertical = r() < 0.5, base = N * (0.18 + r() * 0.12), amp = 3 + r() * 4, freq = 0.08 + r() * 0.06, ph = r() * 6;
  for (let a = 0; a < N; a++) {
    const c = base + Math.sin(a * freq + ph) * amp + (nz(a * 0.15, 3) - 0.5) * 5, w = 1.4 + nz(a * 0.2, 9) * 1.4;
    for (let b = Math.floor(c - w); b <= Math.ceil(c + w); b++) if (b >= 0 && b < N) { const i = vertical ? a * N + b : b * N + a; ter[i] = T.WATER; }
  }
  // озеро в протилежній частині
  const lx = N * (0.68 + r() * 0.16), ly = N * (0.7 + r() * 0.15), lr = 3 + r() * 3;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.hypot((x - lx) / 1.25, y - ly) + (nz2(x * 0.3, y * 0.3) - 0.5) * 2.5; if (d < lr) ter[y * N + x] = T.WATER; }
  // ліси (купками) і пісок біля води
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x; if (ter[i] === T.WATER) continue;
    const f = nz(x * 0.13 + 40, y * 0.13 + 40) * 0.7 + nz2(x * 0.4, y * 0.4) * 0.3;
    if (f > 0.66) ter[i] = T.TREE;
    let wn = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < N && Y < N && ter[Y * N + X] === T.WATER) wn++; }
    if (wn && hash(i, seed) < 0.55) ter[i] = T.SAND;
  }
  return ter;
}

/* ═════════ нове місто ═════════ */
export function newCity({ scenario = 'free', seed, name = 'Нове місто', mayor = '', group = '' } = {}) {
  seed = (seed ?? Date.now() % 1e6) | 0;
  const sc = SCENARIOS[scenario] || SCENARIOS.free;
  const s = {
    v: 1, rs: seed, seed, seq: 1, name, mayor: { name: mayor, group }, scenario, month: 0, day: 0,
    money: sc.money, taxes: { r: 9, c: 9, i: 9 }, funding: { edu: 100, health: 100, police: 100, fire: 100, transit: 100, park: 100 }, policies: {},
    ter: terrain(seed), zone: new Array(NN).fill(0), lvl: new Array(NN).fill(0), aban: new Array(NN).fill(0), ht: new Array(NN).fill(0), road: new Array(NN).fill(0),
    bid: new Array(NN).fill(0), bld: {}, born: new Array(NN).fill(-99), noPow: new Array(NN).fill(0),
    fires: [], families: [], news: [], journal: [], history: [], inbox: [], loans: [], flags: {}, demand: { r: 0.5, c: 0.1, i: 0.2 },
    edu: { basic: 0.55, high: 0.1 }, approval: 62, stats: {}, over: null, ach: {}, landfill: 0,
  };
  const c = new City(s);
  // мерія ближче до центру на суші, з дорогами навколо
  let best = null;
  for (let k = 0; k < 400 && !best; k++) {
    const x = Math.floor(N / 2 - 6 + c.r() * 12), y = Math.floor(N / 2 - 6 + c.r() * 12);
    let ok = true; for (let dy = -2; dy < 4; dy++) for (let dx = -2; dx < 4; dx++) if (s.ter[(y + dy) * N + x + dx] === T.WATER) ok = false;
    if (ok) best = [x, y];
  }
  const [hx, hy] = best || [N / 2, N / 2];
  for (let dy = -1; dy < 3; dy++) for (let dx = -1; dx < 3; dx++) { const i = (hy + dy) * N + hx + dx; if (s.ter[i] !== T.WATER) s.ter[i] = T.GRASS; }
  c.addBuilding('townhall', hx, hy, true);
  const ring = [];
  for (let x = hx - 1; x <= hx + 2; x++) ring.push((hy - 1) * N + x, (hy + 2) * N + x);
  for (let y = hy; y <= hy + 1; y++) ring.push(y * N + hx - 1, y * N + hx + 2);
  for (const i of ring) { s.road[i] = 1; s.ter[i] = s.ter[i] === T.TREE ? T.GRASS : s.ter[i]; }
  c.dirty = true; c.recompute();
  if (scenario !== 'free') buildScenario(c, scenario);
  c.recompute();
  s.base = c.metrics();
  c.mail({ from: 'Радниця з фінансів', adv: 'money', title: 'Вітаємо, пане мере!', body: scenario === 'free'
    ? `Місто «${name}» поки що — мерія й кілька доріг. У казні ${money(s.money)}.\n\nПочніть із доріг і житлових зон (зелених). Людям потрібні робота (комерційні й промислові зони), електрика й школи. Стежте за бюджетом і за тим, що кажуть жителі.`
    : `${sc.desc}\n\nУ вас ${sc.years} ${plural(sc.years, 'рік', 'роки', 'років')}. Цілі — у розділі «Місія». Удачі!` });
  c.log(`Засновано місто «${name}» (${sc.t}).`);
  return c;
}

/* ═════════ місто ═════════ */
export class City {
  constructor(state) {
    this.s = state; this.r = rng(this.s); this.m = null; this.dirty = true; this.events = [];
    const s = this.s;
    s.flags ||= {}; s.inbox ||= []; s.news ||= []; s.journal ||= []; s.families ||= []; s.loans ||= []; s.ach ||= {};
  }
  id(p = 'x') { return p + (this.s.seq++); }
  get year() { return START_YEAR + Math.floor(this.s.month / 12); }
  recompute() { computeMaps(this); this.dirty = false; return this.m; }
  emit(e) { this.events.push(e); }
  log(t) { this.s.journal.push({ m: this.s.month, t }); }
  news(n) { this.s.news.unshift({ id: this.id('n'), m: this.s.month, ...n }); if (this.s.news.length > 120) this.s.news.length = 120; this.emit({ k: 'news', n: this.s.news[0] }); }
  mail(m) { const e = { id: this.id('e'), m: this.s.month, read: false, ...m }; this.s.inbox.unshift(e); if (this.s.inbox.length > 200) this.s.inbox.length = 200; this.emit({ k: 'mail', e }); return e; }
  award(k, t) { if (this.s.ach[k]) return; this.s.ach[k] = this.s.month + 1; this.emit({ k: 'ach', id: k, t }); }

  /* ── будівництво ── */
  inMap(x, y) { return x >= 0 && y >= 0 && x < N && y < N; }
  unlocked(type) { const D = B[type]; return !D.unlock || (this.m?.P || 0) >= D.unlock || this.s.flags.unlockAll; }
  footprint(type, x, y) { const S = B[type].size, out = []; for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) out.push((y + dy) * N + x + dx); return out; }
  canBuild(type, x, y) {
    const s = this.s, D = B[type]; if (!D) return { ok: false, msg: 'Невідома будівля' };
    if (!this.unlocked(type)) return { ok: false, msg: `Відкриється, коли в місті буде ${num(D.unlock)} жителів` };
    if (D.needUni && !Object.values(s.bld).some(b => b.type === 'uni')) return { ok: false, msg: 'Спершу збудуйте університет: потрібні інженери' };
    const S = D.size; if (!this.inMap(x, y) || !this.inMap(x + S - 1, y + S - 1)) return { ok: false, msg: 'За межами мапи' };
    let trees = 0;
    for (const i of this.footprint(type, x, y)) {
      if (s.ter[i] === T.WATER) return { ok: false, msg: 'Не можна будувати на воді' };
      if (s.road[i]) return { ok: false, msg: 'Тут дорога' };
      if (s.bid[i]) return { ok: false, msg: 'Тут уже є будівля' };
      if (s.ter[i] === T.TREE) trees++;
    }
    if (D.onRoad) { const i = y * N + x, nb = [i - 1, i + 1, i - N, i + N].filter(j => j >= 0 && j < NN); if (!nb.some(j => s.road[j])) return { ok: false, msg: 'Зупинку ставлять біля дороги' }; }
    const cost = D.cost + trees * TREE_COST;
    if (s.money < cost) return { ok: false, msg: `Не вистачає грошей: потрібно ${money(cost)}` };
    return { ok: true, cost };
  }
  addBuilding(type, x, y, free = false) {
    const s = this.s, id = this.id('b');
    s.bld[id] = { id, type, x, y, at: s.month };
    for (const i of this.footprint(type, x, y)) { s.bid[i] = id; s.zone[i] = 0; s.lvl[i] = 0; s.aban[i] = 0; s.ht[i] = 0; if (s.ter[i] === T.TREE) s.ter[i] = T.GRASS; s.born[i] = s.month; }
    this.dirty = true;
    if (type === 'uni') s.flags.uniOk = true;
    return s.bld[id];
  }
  build(type, x, y) {
    const r = this.canBuild(type, x, y); if (!r.ok) return r;
    this.s.money -= r.cost; const b = this.addBuilding(type, x, y);
    this.log(`Збудовано: ${B[type].t} (${money(r.cost)}).`);
    this.emit({ k: 'built', b });
    return { ok: true, cost: r.cost, b };
  }
  // Дороги: список клітинок (лінія чи «буквою Г»)
  roadCost(list, kind = 'road') {
    const s = this.s; let cost = 0, n = 0;
    for (const i of list) { if (s.bid[i]) continue; if (s.road[i] >= (kind === 'avenue' ? 2 : 1)) continue; cost += ROADS[kind].cost * (s.ter[i] === T.WATER ? BRIDGE_MUL : 1) + (s.ter[i] === T.TREE ? TREE_COST : 0); n++; }
    return { cost, n };
  }
  placeRoad(list, kind = 'road') {
    const s = this.s, { cost, n } = this.roadCost(list, kind);
    if (!n) return { ok: false, msg: 'Тут уже є дорога' };
    if (s.money < cost) return { ok: false, msg: `Не вистачає грошей: потрібно ${money(cost)}` };
    let blocked = 0;
    for (const i of list) {
      if (s.bid[i]) { blocked++; continue; }
      if (s.road[i] >= (kind === 'avenue' ? 2 : 1)) continue;
      s.road[i] = kind === 'avenue' ? 2 : 1; s.zone[i] = 0; s.lvl[i] = 0; s.aban[i] = 0; s.ht[i] = 0;
      if (s.ter[i] === T.TREE) s.ter[i] = T.GRASS;
    }
    s.money -= cost; this.dirty = true;
    s.flags.roads = (s.flags.roads || 0) + n;
    return { ok: true, cost, n, blocked };
  }
  zoneCost(list, z) { const s = this.s; let n = 0; for (const i of list) if (z && !s.road[i] && !s.bid[i] && s.ter[i] !== T.WATER && s.zone[i] !== z) n++; return { cost: n * ZONE_COST, n }; }
  placeZone(list, z) {
    const s = this.s, { cost, n } = this.zoneCost(list, z);
    if (z && !n) return { ok: false, msg: 'Тут уже ця зона або не можна будувати' };
    if (s.money < cost) return { ok: false, msg: `Не вистачає грошей: потрібно ${money(cost)}` };
    let cleared = 0;
    for (const i of list) {
      if (s.road[i] || s.bid[i] || s.ter[i] === T.WATER) continue;
      if (!z) { if (s.zone[i]) { s.zone[i] = 0; s.lvl[i] = 0; s.aban[i] = 0; s.ht[i] = 0; cleared++; } continue; }
      if (s.zone[i] === z) continue;
      s.zone[i] = z; s.lvl[i] = 0; s.aban[i] = 0; s.ht[i] = 0; if (s.ter[i] === T.TREE) s.ter[i] = T.GRASS;
    }
    s.money -= cost; this.dirty = true;
    if (z) { s.flags.zoned = (s.flags.zoned || 0) + n; s.flags['z' + z] = (s.flags['z' + z] || 0) + n; }
    return { ok: true, cost, n: z ? n : cleared };
  }
  bulldoze(list) {
    const s = this.s, seen = new Set(); let n = 0;
    const cost = list.length * BULLDOZE_COST; if (s.money < cost) return { ok: false, msg: 'Не вистачає грошей на знесення' };
    for (const i of list) {
      if (s.bid[i]) { const id = s.bid[i]; if (seen.has(id)) continue; seen.add(id); const b = s.bld[id]; if (b.type === 'townhall') continue; for (const j of this.footprint(b.type, b.x, b.y)) { s.bid[j] = 0; s.born[j] = s.month; } delete s.bld[id]; this.log(`Знесено: ${B[b.type].t}.`); n++; continue; }
      if (s.road[i]) { s.road[i] = 0; n++; continue; }
      if (s.zone[i] && s.lvl[i]) { s.lvl[i] = 0; s.aban[i] = 0; s.ht[i] = 0; n++; continue; }
      if (s.zone[i]) { s.zone[i] = 0; n++; continue; }
      if (s.ter[i] === T.TREE) { s.ter[i] = T.GRASS; n++; }
    }
    if (!n) return { ok: false, msg: 'Тут нічого зносити' };
    s.money -= cost; this.dirty = true;
    return { ok: true, n, cost };
  }
  plantTrees(list) {
    const s = this.s; const ok = list.filter(i => s.ter[i] === T.GRASS && !s.road[i] && !s.bid[i] && !s.zone[i]);
    const cost = ok.length * TREE_COST; if (!ok.length) return { ok: false, msg: 'Дерева садять на вільній траві' };
    if (s.money < cost) return { ok: false, msg: 'Не вистачає грошей' };
    for (const i of ok) s.ter[i] = T.TREE; s.money -= cost; this.dirty = true;
    s.flags.trees = (s.flags.trees || 0) + ok.length; if (s.flags.trees >= 50) this.award('green', 'Зелене місто');
    return { ok: true, n: ok.length, cost };
  }
  setTax(k, v) { const old = this.s.taxes[k]; this.s.taxes[k] = clamp(Math.round(v), 0, 20); if (old !== this.s.taxes[k]) this.s.flags.taxChanged = true; }
  setFunding(k, v) { this.s.funding[k] = clamp(Math.round(v / 10) * 10, 0, 150); this.dirty = true; }
  togglePolicy(id) {
    const s = this.s, P = POLICIES[id]; if (!P) return false;
    s.policies[id] = !s.policies[id]; if (!s.policies[id]) delete s.policies[id];
    this.log(`${s.policies[id] ? 'Запроваджено' : 'Скасовано'} політику «${P.t}».`); this.dirty = true;
    return !!s.policies[id];
  }
  takeLoan(amt) {
    const s = this.s; if (s.loans.length >= 3) return { ok: false, msg: 'Банк не дає більше трьох кредитів одночасно' };
    const n = 60, i = 0.09 / 12, pay = Math.round(amt * i / (1 - Math.pow(1 + i, -n)));
    s.loans.push({ amt, left: n, pay, m: s.month }); s.money += amt;
    this.log(`Узято кредит ${money(amt)} на 5 років (${money(pay)} щомісяця).`);
    return { ok: true, pay };
  }
  repayLoan(k) { const s = this.s, L = s.loans[k]; if (!L) return false; const rest = L.pay * L.left * 0.92; if (s.money < rest) return false; s.money -= rest; s.loans.splice(k, 1); this.log(`Достроково погашено кредит (${money(rest)}).`); return true; }

  /* ── показники ── */
  metrics() {
    const M = this.m || this.recompute(), s = this.s, last = s.history.at(-1);
    let ind = 0, ht = 0; for (let i = 0; i < NN; i++) if (s.zone[i] === Z.I && s.lvl[i] && !s.aban[i]) { ind++; if (s.ht[i]) ht++; }
    const renew = sum(Object.values(s.bld).filter(b => ['wind', 'solar', 'nuclear'].includes(b.type)).map(b => b._out || 0)), allP = sum(Object.values(s.bld).filter(b => B[b.type].power > 0).map(b => b._out || 0));
    return { pop: M.P, money: s.money, balance: last?.balance ?? 0, approval: s.approval, aqi: M.aqi, co2: last?.co2 ?? this.co2(), congestion: M.avgCong, transitShare: M.transitShare, eduHigh: s.edu.high, hightech: ind ? ht / ind : 0, unemp: M.unemp, crime: M.crimeAvg, happy: M.happyAvg, power: M.demand ? M.supply / M.demand : 1, green: allP ? renew / allP : 0, commute: M.avgCommute };
  }
  co2() {
    const M = this.m, s = this.s; let t = 0;
    for (const b of Object.values(s.bld)) { const D = B[b.type]; if (D.co2) t += D.co2 * (D.power ? (b._util ?? 1) : 1); }
    t += M.carTrips * 0.09 * 4.3 + M.iJobs * 0.6 - M.htJobs * 0.4 + M.P * 0.12;
    return Math.round(t);
  }

  /* ═════════ ХІД: один день ═════════ */
  tick() {
    const s = this.s; if (s.over && !s.flags.keepPlaying) return;
    if (this.dirty || s.day % 5 === 0 || !this.m) this.recompute();
    // ріст: щодня — тридцята частина клітинок
    for (let i = s.day; i < NN; i += DAYS) this.growTile(i);
    this.fireStep();
    if (s.flags.matchDay) s.flags.matchDay--;
    s.day++;
    if (s.day >= DAYS) this.monthEnd();
  }
  // Привабливість клітинки для забудови (−1…1)
  desire(i) {
    const s = this.s, M = this.m, z = s.zone[i], d = s.demand, lv = M.lv[i], pol = s.policies;
    if (z === Z.R) return d.r * 0.5 + (lv - 45) / 55 * 0.35 - M.poll[i] / 100 * 0.55 - Math.max(0, M.commute[i] - 35) / 60 * 0.3 - M.crime[i] / 100 * 0.25 + M.cov.school[i] * 0.08 + M.cov.park[i] * 0.08 + M.cov.health[i] * 0.05;
    if (z === Z.C) { const r = M.nearRoad[i], traffic = r >= 0 ? Math.min(1, M.load[r] / 300) : 0; return d.c * 0.55 + (lv - 40) / 60 * 0.3 + traffic * 0.12 - M.crime[i] / 100 * 0.2 + (pol.carFree ? 0.03 : 0); }
    if (z === Z.I) { const r = M.nearRoad[i]; return d.i * 0.6 - (lv - 50) / 100 * 0.1 + (r >= 0 && s.road[r] === 2 ? 0.08 : 0) - (M.cong[r] > 1.2 ? 0.1 : 0); }
    return 0;
  }
  growTile(i) {
    const s = this.s, M = this.m, z = s.zone[i]; if (!z) return;
    const access = M.roadDist[i] <= 3, pw = M.powered[i], r = this.r;
    if (!pw && s.lvl[i]) s.noPow[i]++; else s.noPow[i] = 0;
    if (s.aban[i]) { if (access && pw && this.desire(i) > 0.15 && r() < 0.12) { s.aban[i] = 0; s.lvl[i] = 1; s.born[i] = s.month; } return; }
    if (!access) { if (s.lvl[i] && r() < 0.15) s.lvl[i]--; return; }
    const D = this.desire(i), lv = M.lv[i], L = s.lvl[i];
    let max = lv < 30 ? 2 : lv < 52 ? 3 : 4;
    if (z === Z.I) max = s.ht[i] ? 4 : 3;
    if (L >= 3 && M.P < 4000) max = Math.min(max, 3);
    if (s.noPow[i] > 2 && L && r() < 0.12) { s.aban[i] = 1; this.emit({ k: 'aban', i }); return; }
    if (pw && L < max && s.month - s.born[i] >= 2 + L && D > 0.04 + L * 0.09 && r() < 0.07 + D * 0.3) {
      s.lvl[i]++; s.born[i] = s.month;
      // освічені люди й пільги для IT перетворюють заводи на чисті високотехнологічні компанії
      if (z === Z.I && s.lvl[i] >= 2 && !s.ht[i] && s.edu.high > 0.22 && r() < (s.edu.high - 0.15) * (s.policies.itPark ? 1.6 : 0.9)) s.ht[i] = 1;
      if (L === 0) this.emit({ k: 'grow', i });
    } else if (L && D < -0.22 - L * 0.04 && r() < 0.18) {
      s.lvl[i]--; if (!s.lvl[i] && D < -0.45 && r() < 0.4) s.aban[i] = 1;
    } else if (z === Z.I && s.ht[i] && s.edu.high < 0.12 && r() < 0.05) s.ht[i] = 0;
  }
  // Пожежі: зароджуються там, де немає пожежників, і перекидаються на сусідів
  fireStep() {
    const s = this.s, M = this.m, r = this.r;
    if (r() < 0.004 * (1 + M.P / 20000)) {
      const i = Math.floor(r() * NN);
      if ((s.zone[i] && s.lvl[i]) && M.cov.fire[i] < 0.55 && r() > M.cov.fire[i]) { s.fires.push({ i, d: 0 }); this.emit({ k: 'fire', i }); this.news({ kind: 'alert', who: 'Служба 101', text: `Пожежа на ${streetOf(this, i)}! ${M.cov.fire[i] < 0.1 ? 'Пожежна частина далеко.' : 'Пожежники вже їдуть.'}`, bad: true, i }); }
    }
    const next = [];
    for (const f of s.fires) {
      f.d++;
      const put = M.cov.fire[f.i] * 0.45 + 0.08;
      if (r() < put) { if (f.d > 4) { s.lvl[f.i] = Math.max(0, s.lvl[f.i] - 1); } continue; }
      if (f.d > 8) { s.lvl[f.i] = 0; s.aban[f.i] = 0; s.born[f.i] = s.month; s.flags.burned = (s.flags.burned || 0) + 1; continue; }
      next.push(f);
      if (r() < 0.12 * (1 - M.cov.fire[f.i])) { const j = f.i + [1, -1, N, -N][Math.floor(r() * 4)]; if (j >= 0 && j < NN && s.zone[j] && s.lvl[j] && !s.fires.some(x => x.i === j) && !next.some(x => x.i === j)) next.push({ i: j, d: 0 }); }
    }
    s.fires = next;
  }

  /* ═════════ МІСЯЦЬ ═════════ */
  monthEnd() {
    const s = this.s, M = this.recompute(), r = this.r, pol = s.policies;
    s.day = 0;
    // попит на житло, магазини й заводи
    const happy = M.happyAvg, jobs = M.jobs, workers = M.workers;
    s.demand = {
      r: clamp((jobs - workers * 0.95) / (120 + workers * 0.25) + 0.35 - (s.taxes.r - 9) * 0.05 + (happy - 55) / 120 - M.blackoutShare * 0.6, -1, 1),
      c: clamp((M.P * 0.22 - M.cJobs) / (60 + M.cJobs * 0.4) - (s.taxes.c - 9) * 0.05 + s.edu.basic * 0.05, -1, 1),
      i: clamp((workers * 0.5 - M.iJobs - M.cJobs * 0.3) / (90 + M.iJobs * 0.5) + 0.18 - (s.taxes.i - 9) * 0.05 - (pol.greenTax ? 0.12 : 0) + (pol.itPark && s.edu.high > 0.25 ? 0.08 : 0), -1, 1),
    };
    // бюджет
    const t = s.taxes, unempF = 1 - M.unemp * 0.5;
    const inc = {
      r: M.P * t.r * 0.05 * unempF,
      c: M.cJobs * t.c * 0.07,
      i: (M.iJobs - M.htJobs) * t.i * 0.055 + M.htJobs * t.i * 0.1,
      other: (pol.greenTax ? (M.iJobs - M.htJobs) * 0.35 : 0) + sum(Object.values(s.bld).filter(b => b.type === 'plaza' || b.type === 'stadium').map(b => b.type === 'stadium' ? 900 : 300)),
    };
    const FK = { edu: 'edu', safe: null, transit: 'transit', eco: 'park', power: null };
    const exp = { services: 0, power: 0, roads: 0, policies: 0, loans: 0 };
    for (const b of Object.values(s.bld)) {
      const D = B[b.type];
      if (D.cat === 'power') exp.power += D.upkeep * (b.type === 'coal' || b.type === 'gas' ? 0.4 + 0.6 * (b._util ?? 1) : 1); // паливо — за спожиту енергію
      else { const k = D.cat === 'safe' ? (D.svc === 'health' ? 'health' : D.svc) : FK[D.cat]; exp.services += D.upkeep * ((k ? s.funding[k] ?? 100 : 100) / 100); }
    }
    let roadN = 0, aveN = 0; for (let i = 0; i < NN; i++) { if (s.road[i] === 1) roadN++; else if (s.road[i] === 2) aveN++; }
    exp.roads = roadN * ROADS.road.upkeep + aveN * ROADS.avenue.upkeep;
    for (const k of Object.keys(pol)) exp.policies += Math.max(0, POLICIES[k].cost) * (1 + M.P / 30000);
    for (const L of s.loans) { exp.loans += L.pay; L.left--; }
    s.loans = s.loans.filter(L => L.left > 0);
    const income = sum(Object.values(inc)), expense = sum(Object.values(exp)), balance = income - expense;
    s.money += balance;
    // освіта змінюється повільно: роками
    let kidsCov = 0, teenCov = 0, w = 0;
    for (let i = 0; i < NN; i++) if (M.pop[i]) { kidsCov += M.cov.school[i] * M.pop[i]; teenCov += (M.cov.high[i] * 0.7 + M.cov.lib[i] * 0.15) * M.pop[i]; w += M.pop[i]; }
    const sb = w ? kidsCov / w : 0, hb = w ? teenCov / w : 0, uni = M.cov.uni[0] || 0;
    s.edu.basic = clamp(s.edu.basic + (0.35 + sb * 0.6 - s.edu.basic) * 0.05, 0, 1);
    s.edu.high = clamp(s.edu.high + ((0.06 + hb * 0.25 + uni * 0.45) * s.edu.basic - s.edu.high) * 0.03, 0, 0.9);
    // сміття
    const waste = (M.P * 0.5 + M.jobs * 0.3) * (pol.sorting ? 0.8 : 1);
    let cap = 0; for (const b of Object.values(s.bld)) if (B[b.type].waste && b._on) cap += B[b.type].waste * (b.type === 'recycle' && pol.sorting ? 1.25 : 1);
    s.landfill += Math.max(0, Math.min(waste, cap) - sum(Object.values(s.bld).filter(b => b.type === 'recycle' && b._on).map(() => 5000)));
    s.flags.garbage = waste > cap * 1.05 && M.P > 1500 ? clamp((waste - cap) / Math.max(waste, 1) * 2.5, 0.3, 2) : 0;
    // підтримка мера
    const pen = (balance < 0 && s.money < 0 ? 4 : 0) + (s.flags.taxChanged && t.r > 11 ? 3 : 0);
    s.approval = clamp(s.approval + (happy - s.approval) * 0.22 - pen, 0, 100);
    s.flags.taxChanged = false;
    // статистика місяця
    const co2 = this.co2(), m = this.metrics();
    s.history.push({ m: s.month, pop: Math.round(M.P), money: Math.round(s.money), income: Math.round(income), expense: Math.round(expense), balance: Math.round(balance), inc: Object.fromEntries(Object.entries(inc).map(([k, v]) => [k, Math.round(v)])), exp: Object.fromEntries(Object.entries(exp).map(([k, v]) => [k, Math.round(v)])),
      happy: Math.round(happy), approval: Math.round(s.approval), aqi: Math.round(M.aqi * 10) / 10, co2, cong: Math.round(M.avgCong * 100) / 100, commute: Math.round(M.avgCommute), transit: Math.round(M.transitShare * 100) / 100,
      jobs: Math.round(M.jobs), unemp: Math.round(M.unemp * 1000) / 1000, crime: Math.round(M.crimeAvg), power: Math.round(M.supply), demandP: Math.round(M.demand), green: Math.round(m.green * 100) / 100,
      eduB: Math.round(s.edu.basic * 100) / 100, eduH: Math.round(s.edu.high * 100) / 100, landfill: Math.round(s.landfill), dem: { ...s.demand }, taxes: { ...t } });
    if (s.history.length > 600) s.history.shift();
    // жителі
    syncFamilies(this);
    monthlyVoices(this, 2 + (r() < 0.5 ? 1 : 0));
    this.advise(m);
    this.rollEvents(m);
    this.achievements(m);
    // вибори раз на 4 роки
    if (s.month % 48 === 47 && !s.flags.building) this.election();
    this.checkGoals(m);
    // сезонні прапорці на наступний місяць
    const nm = (s.month + 1) % 12;
    s.flags.heatWave = (nm === 6 || nm === 7) && r() < 0.35 ? 1 : 0;
    s.flags.snow = (nm === 0 || nm === 1 || nm === 11) && r() < 0.3 ? 1 : 0;
    if (s.flags.heatWave) this.news({ kind: 'weather', who: 'Синоптики', text: 'Наступного місяця спека до +36°: кондиціонери ввімкнуть усі, споживання електрики зросте.', i: -1 });
    if (s.flags.snow) this.news({ kind: 'weather', who: 'Синоптики', text: 'Прогнозують сильні снігопади: дороги стануть повільнішими, можливі затори.', i: -1 });
    s.flags.festival = 0;
    s.month++;
    this.dirty = true;
    this.emit({ k: 'month' });
  }

  /* ── радники: короткі поради з даних ── */
  advise(m) {
    const s = this.s, M = this.m, adv = (k, title, body, key) => { if (s.flags['adv_' + key] && s.month - s.flags['adv_' + key] < 8) return; s.flags['adv_' + key] = s.month; this.mail({ adv: k, title, body, key }); };
    if (m.power < 1 && M.demand > 0) adv('energy', 'Енергії не вистачає', `Місто споживає ${num(M.demand)} МВт, а станції дають ${num(M.supply)} МВт. ${pct(M.blackoutShare)} жителів сидять без світла — вони злі й можуть виїхати. Збудуйте ще станцію і перевірте, що вона стоїть біля дороги, з’єднаної з районами.`, 'power');
    if (M.avgCong > 0.75) adv('traffic', 'Затори', `Дороги завантажені на ${pct(M.avgCong)}. Людина в середньому їде на роботу ${Math.round(M.avgCommute)} хв. Допоможуть автобуси (депо + зупинки), проспекти на головних вулицях і робота ближче до дому.`, 'jam');
    if (M.aqi > 32) adv('eco', 'Брудне повітря', `Середнє забруднення там, де живуть люди, — ${Math.round(M.aqi)} зі 100. Головні джерела: ${Object.values(s.bld).some(b => b.type === 'coal') ? 'вугільна станція, ' : ''}заводи й машини. Відсуньте житло від промисловості, посадіть дерева, замініть вугілля на чисту енергію.`, 'aqi');
    if (s.history.length >= 3 && s.history.slice(-3).every(h => h.balance < 0)) adv('money', 'Бюджет у мінусі', `Уже три місяці витрати більші за доходи (${money(s.history.at(-1).balance)} минулого місяця). Перевірте податки й фінансування служб у розділі «Бюджет», не будуйте дорогого, поки не вийдете в плюс.`, 'deficit');
    if (s.edu.high < 0.15 && M.P > 3000 && !Object.values(s.bld).some(b => b.type === 'lyceum')) adv('edu', 'Мало освічених людей', `Лише ${pct(s.edu.high)} дорослих мають вищу освіту. Без ліцею й університету не з’являться високотехнологічні компанії, які платять більше податків і не забруднюють повітря.`, 'edu');
    if (M.crimeAvg > 38) adv('safety', 'Злочинність зростає', `Середня злочинність — ${Math.round(M.crimeAvg)}. Найгірше там, де немає поліції і багато безробітних. Збудуйте поліцію у проблемних районах.`, 'crime');
    if (M.unemp > 0.15 && M.P > 500) adv('money', 'Безробіття', `${pct(M.unemp)} людей не мають роботи або не можуть до неї доїхати. Додайте комерційні чи промислові зони й з’єднайте їх дорогами з житлом.`, 'unemp');
    if (s.flags.garbage) adv('eco', 'Сміття не вивозять', 'Сміття більше, ніж можуть прийняти звалище й сортувальні станції. Збудуйте сортувальну станцію або запровадьте сортування сміття.', 'garbage');
  }

  /* ── події з вибором ── */
  rollEvents(m) {
    const s = this.s, r = this.r, M = this.m;
    const pool = Object.entries(EVENTS).filter(([id, e]) => (!s.flags['ev_' + id] || s.month - s.flags['ev_' + id] >= (e.every || 24)) && e.when(this, m));
    if (!pool.length || r() > 0.45) return;
    const [id, e] = pool[Math.floor(r() * pool.length)];
    s.flags['ev_' + id] = s.month;
    const made = e.make(this, m);
    this.mail({ ev: id, from: made.from, title: made.title, body: made.body, choices: e.choices ? e.choices(this).map(c => c.t) : null, data: made.data, until: s.month + 1 });
  }
  choose(eid, ci) {
    const e = this.s.inbox.find(x => x.id === eid); if (!e || !e.choices || e.chosen != null) return null;
    const ch = EVENTS[e.ev]?.choices(this, e)[ci]; if (!ch) return null;
    e.chosen = ci; e.read = true; e.result = ch.do(this, e) || '';
    this.log(`Рішення «${e.title}»: ${e.choices[ci]}.`);
    this.dirty = true;
    return e.result;
  }
  election() {
    const s = this.s, a = s.approval, win = a >= 50;
    s.flags.elections = (s.flags.elections || 0) + 1;
    this.log(`Вибори мера: ${win ? 'перемога' : 'поразка'} (${Math.round(a)}% підтримки).`);
    if (win) { this.award('reelected', 'Другий термін'); this.mail({ from: 'Міська виборча комісія', title: 'Вас переобрано!', body: `За вас проголосували ${Math.round(a)}% виборців. Жителі довіряють вашим рішенням ще на 4 роки.` }); }
    else { s.over = { kind: 'lost', m: s.month, a: Math.round(a) }; this.mail({ from: 'Міська виборча комісія', title: 'Ви програли вибори', body: `Лише ${Math.round(a)}% виборців підтримали вас. Подивіться у звіті й на картах, що найбільше турбувало жителів.` }); this.emit({ k: 'over' }); }
  }
  // Мета сценарію: перевірка цілей
  goals(m = this.metrics()) {
    const s = this.s, sc = SCENARIOS[s.scenario]; if (!sc?.goals?.length) return [];
    return sc.goals.map(g => { const base = s.base?.[g.k] || 1, v = g.rel ? m[g.k] / Math.max(1e-9, base) : m[g.k]; const ok = g.op === '<' ? v < g.v : g.op === '<=' ? v <= g.v : g.op === '>' ? v > g.v : v >= g.v; return { ...g, val: v, ok }; });
  }
  checkGoals(m) {
    const s = this.s, sc = SCENARIOS[s.scenario]; if (!sc?.years || s.over || s.flags.building) return;
    const G = this.goals(m);
    if (G.every(g => g.ok) && s.month >= 12) { s.over = { kind: 'win', m: s.month }; this.award('mission', 'Місію виконано'); this.log('Місію виконано!'); this.emit({ k: 'over' }); return; }
    if (s.month + 1 >= sc.years * 12) { s.over = { kind: 'fail', m: s.month, done: G.filter(g => g.ok).length, all: G.length }; this.log('Час місії вийшов.'); this.emit({ k: 'over' }); }
  }
  achievements(m) {
    if (m.pop >= 1000) this.award('pop1k', 'Тисяча жителів');
    if (m.pop >= 10000) this.award('pop10k', 'Справжнє місто');
    if (m.pop >= 50000) this.award('pop50k', 'Мегаполіс');
    if (m.green >= 0.5 && this.m.supply > 100) this.award('greenPower', 'Зелена енергія');
    if (m.transitShare >= 0.3) this.award('transit', 'Без авто');
    if (m.eduHigh >= 0.3) this.award('smart', 'Місто знань');
    if (this.s.history.length >= 12 && this.s.history.slice(-12).every(h => h.balance > 0)) this.award('budget', 'Бюджет у плюсі цілий рік');
    if (m.approval >= 80 && m.pop > 2000) this.award('loved', 'Улюблений мер');
  }
}

/* ═════════ події ═════════ */
export const EVENTS = {
  factory: { every: 18, when: (c, m) => c.s.demand.i > 0.1 && m.pop > 800,
    make: () => ({ from: 'Компанія «МеталПром»', title: 'Хочемо збудувати завод', body: 'Ми готові інвестувати в місто й дати 400 робочих місць. Але наш завод старого типу: дим і шум. Просимо землю й податкові пільги на 2 роки. Відкриття принесе місту 25 000 одразу.' }),
    choices: () => [
      { t: 'Погодитися (+25 000)', do: c => { c.s.money += 25000; c.s.flags.dirtyDeal = c.s.month + 24; c.s.demand.i = 1; return 'Завод будують. Роботи більше, але повітря в промислових районах гіршатиме найближчі два роки.'; } },
      { t: 'Лише якщо поставлять фільтри', do: c => { if (c.r() < 0.5) { c.s.money += 12000; return 'Компанія погодилася на фільтри й менші пільги. Чистіше, хоча грошей менше.'; } return 'Компанія відмовилася й пішла в сусіднє місто.'; } },
      { t: 'Відмовити', do: c => { c.s.approval = Math.min(100, c.s.approval + 1); return 'Екоактивісти дякують, але частина безробітних незадоволена.'; } }] },
  grant: { every: 30, when: (c, m) => m.green >= 0.3 && m.pop > 1500,
    make: () => ({ from: 'Фонд зеленої енергії', title: 'Грант на чисту енергію', body: 'Ваше місто отримує значну частку енергії з чистих джерел. Ми готові дати грант 30 000 на розвиток.' }),
    choices: () => [{ t: 'Прийняти грант', do: c => { c.s.money += 30000; c.award('grant', 'Зелений грант'); return 'Гроші на рахунку міста.'; } }] },
  festival: { every: 12, when: (c, m) => m.pop > 1200 && c.s.money > 5000,
    make: c => ({ from: 'Відділ культури', title: 'Міське свято', body: `Пропонуємо провести День міста «${c.s.name}»: концерти, ярмарок, феєрверк. Коштуватиме 4 000.` }),
    choices: () => [{ t: 'Провести свято (−4 000)', do: c => { c.s.money -= 4000; c.s.flags.festival = 1; c.s.approval = Math.min(100, c.s.approval + 3); return 'Свято вдалося! Жителі в захваті.'; } }, { t: 'Цього року без свята', do: () => 'Гроші зекономлено, але дехто розчарований.' }] },
  protest: { every: 8, when: (c, m) => m.approval < 38 && m.pop > 500,
    make: c => ({ from: 'Ініціативна група жителів', title: 'Мітинг під мерією', body: `Кілька сотень людей вийшли під мерію. Головні вимоги: ${worstIssue(c)}.` }),
    choices: () => [{ t: 'Вийти до людей і пообіцяти зміни', do: c => { c.s.approval = Math.min(100, c.s.approval + 4); c.s.flags.promise = c.s.month; return 'Люди чекають дій. Якщо за пів року нічого не зміниться — буде гірше.'; } }, { t: 'Знизити податок на житло на 2%', do: c => { c.setTax('r', c.s.taxes.r - 2); c.s.approval = Math.min(100, c.s.approval + 6); return 'Податок знижено. Бюджет отримає менше.'; } }, { t: 'Ігнорувати', do: c => { c.s.approval = Math.max(0, c.s.approval - 5); return 'Мітинг тривав тиждень. Підтримка знизилася.'; } }] },
  strike: { every: 18, when: c => (c.s.funding.transit ?? 100) < 80 && c.m.hasDepot,
    make: () => ({ from: 'Профспілка водіїв', title: 'Водії автобусів страйкують', body: 'Через урізане фінансування водіям не платять вчасно. Вимагаємо повернути фінансування транспорту.' }),
    choices: () => [{ t: 'Повернути фінансування до 100%', do: c => { c.setFunding('transit', 100); return 'Автобуси знову їздять.'; } }, { t: 'Ні', do: c => { c.s.approval = Math.max(0, c.s.approval - 4); c.s.funding.transit = 30; return 'Автобуси майже не їздять. Люди пересіли на авто — на дорогах затори.'; } }] },
  match: { every: 2, when: c => Object.values(c.s.bld).some(b => b.type === 'stadium'),
    make: () => ({ from: 'Стадіон', title: 'Великий матч', body: 'Цього місяця — фінал кубка. На стадіон приїдуть 30 000 уболівальників. Квитки продано, місто отримає 6 000.' }),
    choices: () => [{ t: 'Чудово!', do: c => { c.s.money += 6000; c.s.flags.matchDay = 3; return 'Будуть затори біля стадіону, зате місто заробило.'; } }] },
  heat: { every: 12, when: c => c.s.month % 12 === 6 && c.m.supply < c.m.demand * 1.15,
    make: () => ({ from: 'Енергетики', title: 'Спека і запас потужності', body: 'Спека, всі вмикають кондиціонери. Запас потужності станцій дуже малий — можливі відключення. Можемо купити енергію в сусідів.' }),
    choices: () => [{ t: 'Купити енергію (−5 000)', do: c => { c.s.money -= 5000; c.s.flags.heatWave = 0; return 'Відключень не буде.'; } }, { t: 'Ризикнути', do: c => { c.s.flags.heatWave = 1; return 'Тримаємо кулаки.'; } }] },
};
function worstIssue(c) {
  const M = c.m, s = c.s, items = [];
  if (M.blackoutShare > 0.05) items.push('світло без відключень');
  if (M.aqi > 30) items.push('чисте повітря');
  if (M.avgCong > 0.7) items.push('менше заторів');
  if (M.unemp > 0.12) items.push('робочі місця');
  if (s.taxes.r > 11) items.push('нижчі податки');
  if (M.crimeAvg > 35) items.push('безпека на вулицях');
  return items.length ? items.slice(0, 3).join(', ') : 'кращі послуги для жителів';
}

/* ═════════ готові міста для сценаріїв ═════════ */
// Простий «забудовник»: сітка вулиць, зони, станції — і кілька років росту
export function buildScenario(c, kind) {
  const s = c.s; s.flags.unlockAll = true; s.flags.building = true; s.money = 1e7;
  const [cx, cy] = c.m.center;
  const land = i => s.ter[i] !== T.WATER;
  const line = (x0, y0, x1, y1, k = 'road') => { const list = []; if (y0 === y1) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) list.push(y0 * N + x); else for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) list.push(y * N + x0); c.placeRoad(list.filter(i => i >= 0 && i < NN && c.inMap(i % N, (i / N) | 0)), k); };
  // планування: «Місто заторів» — великі квартали й мало вулиць між житлом і роботою
  const L = { smog: { R: 12, step: 5 }, jam: { R: 14, step: 7 }, debt: { R: 12, step: 5 }, smart: { R: 12, step: 5 } }[kind] || { R: 11, step: 5 };
  const { R, step } = L;
  for (let d = -R; d <= R; d += step) {
    // у «Місті заторів» житло й робота з’єднані лише однією поперечною вулицею
    if (kind !== 'jam' || d === 0) line(cx - R, cy + d, cx + R, cy + d, d === 0 && kind !== 'jam' ? 'avenue' : 'road');
    line(cx + d, cy - R, cx + d, cy + R);
  }
  const zoneBlock = (x0, y0, z) => { const list = []; for (let y = y0 + 1; y < y0 + step; y++) for (let x = x0 + 1; x < x0 + step; x++) if (c.inMap(x, y) && land(y * N + x)) list.push(y * N + x); c.placeZone(list, z); };
  for (let by = -R; by < R; by += step) for (let bx = -R; bx < R; bx += step) {
    const east = bx >= R - 2 * step, west = bx < 0, centre = Math.abs(bx + step / 2) <= step && Math.abs(by + step / 2) <= step;
    const z = kind === 'smog' ? (east || (by < -step && !west) ? Z.I : centre ? Z.C : Z.R)
      : kind === 'jam' ? (west ? Z.R : east ? Z.I : Z.C)
      : kind === 'smart' ? (east || by >= R - 2 * step ? Z.I : centre ? Z.C : Z.R)
      : (east ? Z.I : centre ? Z.C : Z.R);
    zoneBlock(cx + bx, cy + by, z);
  }
  // місце поруч із дорогою (до 2 клітинок від будівлі)
  const byRoad = (type, x, y) => { const S = B[type].size; for (let yy = y - 2; yy < y + S + 2; yy++) for (let xx = x - 2; xx < x + S + 2; xx++) if (c.inMap(xx, yy) && s.road[yy * N + xx]) return true; return false; };
  const place = (type, near = [cx, cy], spread = 26) => { for (let k = 0; k < 3000; k++) { const x = near[0] + Math.floor((c.r() - 0.5) * spread), y = near[1] + Math.floor((c.r() - 0.5) * spread); if (c.canBuild(type, x, y).ok && byRoad(type, x, y)) { c.build(type, x, y); return true; } } return false; };
  if (kind === 'smog') { place('coal', [cx + 4, cy - 4], 8); place('coal', [cx - 4, cy + 5], 8); place('landfill', [cx - 8, cy - 8], 8); }
  else { place(kind === 'smart' ? 'gas' : 'coal', [cx + 9, cy], 10); place('coal', [cx - 8, cy + 8], 12); }
  for (const t of ['school', 'school', 'clinic', 'police', 'fire', 'park', 'park']) place(t);
  if (kind === 'smart') { place('library'); place('park'); }
  if (kind === 'jam') { place('school'); place('hospital'); place('landfill', [cx - 12, cy - 12], 8); }
  if (kind === 'debt') { place('bigpark'); place('stadium'); place('hospital'); place('lyceum'); place('landfill', [cx - 12, cy - 12], 8); }
  if (kind === 'smart') place('landfill', [cx - 12, cy + 12], 8);
  // кілька років росту без витрат
  s.taxes = { r: 9, c: 9, i: 9 };
  for (let k = 0; k < 30 * 36; k++) { c.tick(); s.money = 1e7; }
  const keep = { uniOk: s.flags.uniOk };
  s.history = []; s.news = []; s.inbox = []; s.journal = []; s.flags = keep; s.month = 0; s.day = 0; s.ach = {}; s.over = null; s.fires = [];
  if (kind === 'debt') { s.taxes = { r: 6, c: 6, i: 6 }; s.loans = [{ amt: 80000, left: 48, pay: 2000, m: 0 }, { amt: 40000, left: 30, pay: 1450, m: 0 }]; s.funding = { edu: 130, health: 130, police: 120, fire: 110, transit: 100, park: 140 }; s.policies = { freeBus: true, nightLight: true, saveEnergy: true }; }
  if (kind === 'jam') s.approval = 48;
  if (kind === 'smog') s.approval = 42;
  if (kind === 'smart') s.edu = { basic: 0.6, high: 0.08 };
  s.money = SCENARIOS[kind].money;
  for (const f of s.families) f.since = 0;
}

export const okState = s => !!s && s.v === 1 && Array.isArray(s.ter) && s.ter.length === NN && Array.isArray(s.zone) && typeof s.bld === 'object' && Number.isFinite(s.money) && Number.isFinite(s.month);
export { tilePop, tileJobs, streetOf, R_POP, ZONES };
