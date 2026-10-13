// Симулятор міста · карти міста: дороги й доступ, енергомережа, служби, транспорт, забруднення,
// вартість землі, злочинність, щастя. Усе рахується з поточного стану й не зберігається у файл.
import { N, T, Z, B, ROADS, R_POP, C_JOBS, I_JOBS } from './data.js';

const NN = N * N;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const DIRS = [1, -1, N, -N];
export const xy = i => [i % N, (i / N) | 0];
const nb4 = i => { const x = i % N, out = []; if (x > 0) out.push(i - 1); if (x < N - 1) out.push(i + 1); if (i >= N) out.push(i - N); if (i < NN - N) out.push(i + N); return out; };

// Детермінований «шум» клітинки (варіанти будинків, вітер, ротація відключень)
export const hash = (i, k = 0) => { let h = (i * 374761393 + k * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// Працівники, жителі й робочі місця клітинки
export function tilePop(s, i) { return s.zone[i] === Z.R && !s.aban[i] ? R_POP[s.lvl[i]] : 0; }
export function tileJobs(s, i) {
  if (s.aban[i]) return 0;
  if (s.zone[i] === Z.C) return C_JOBS[s.lvl[i]];
  if (s.zone[i] === Z.I) return Math.round(I_JOBS[s.lvl[i]] * (s.ht[i] ? 0.75 : 1));
  return 0;
}
export const bJobs = b => ({ coal: 120, gas: 80, nuclear: 400, solar: 6, wind: 2, school: 60, lyceum: 90, uni: 400, library: 10, clinic: 30, hospital: 260, police: 40, fire: 30, depot: 60, stop: 0, metro: 20, recycle: 50, landfill: 20, stadium: 60, plaza: 15, townhall: 80 }[b.type] || 0);

export function computeMaps(c) {
  const s = c.s, M = c.m = c.m || {};
  const pol = s.policies || {};

  /* ── відстань до дороги й найближча дорога ── */
  const rd = M.roadDist = new Int16Array(NN).fill(99), near = M.nearRoad = new Int32Array(NN).fill(-1);
  const q = [];
  for (let i = 0; i < NN; i++) if (s.road[i]) { rd[i] = 0; near[i] = i; q.push(i); }
  for (let h = 0; h < q.length; h++) { const i = q[h]; if (rd[i] >= 4) continue; for (const j of nb4(i)) if (rd[j] > rd[i] + 1) { rd[j] = rd[i] + 1; near[j] = near[i]; q.push(j); } }

  /* ── компоненти дорожньої мережі ── */
  const comp = M.comp = new Int32Array(NN).fill(-1); let nc = 0;
  for (let i = 0; i < NN; i++) if (s.road[i] && comp[i] < 0) { const st = [i]; comp[i] = nc; while (st.length) { const a = st.pop(); for (const j of nb4(a)) if (s.road[j] && comp[j] < 0) { comp[j] = nc; st.push(j); } } nc++; }
  M.nComp = nc;
  const compOf = i => { const r = near[i]; return r >= 0 && rd[i] <= 3 ? comp[r] : -1; };
  M.compOf = compOf;

  /* ── будівлі: доступ до дороги ── */
  const blds = Object.values(s.bld);
  const bAccess = b => { const S = B[b.type].size; let best = 99, r = -1; for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) { const i = (b.y + dy) * N + b.x + dx; if (rd[i] < best) { best = rd[i]; r = near[i]; } } return best <= 2 ? r : -1; };
  for (const b of blds) { b._road = bAccess(b); b._comp = b._road >= 0 ? comp[b._road] : -1; }

  /* ── енергомережа: кожна дорожня мережа — окрема мережа живлення ── */
  const month = (s.month % 12) + 1, season = [0, .55, .65, .85, 1, 1.15, 1.25, 1.25, 1.15, .95, .75, .55, .5][month];
  const supply = new Float64Array(nc + 1), demand = new Float64Array(nc + 1);
  const saveF = pol.saveEnergy ? 0.85 : 1, heat = s.flags.heatWave ? 1.15 : 1;
  M.tileDemand = new Float32Array(NN);
  for (let i = 0; i < NN; i++) {
    if (!s.zone[i] || s.aban[i] || !s.lvl[i]) continue;
    const d = (s.zone[i] === Z.R ? tilePop(s, i) * 0.02 : s.zone[i] === Z.C ? tileJobs(s, i) * 0.04 : tileJobs(s, i) * (s.ht[i] ? 0.05 : 0.08)) * saveF * heat;
    M.tileDemand[i] = d; const k = compOf(i); if (k >= 0) demand[k] += d;
  }
  let totalSupply = 0, totalDemand = 0, windNow = 0.6 + 0.6 * hash(s.month, 7);
  for (const b of blds) {
    const D = B[b.type]; if (!D.power) continue;
    if (D.power > 0) {
      let out = D.power * (b.type === 'solar' ? season : b.type === 'wind' ? windNow : 1);
      if (b.type === 'nuclear' && !s.flags.uniOk) out *= 0.25;
      if (b._road < 0) out = 0; // без дороги лінію електропередач не протягнути
      b._out = out; if (b._comp >= 0) supply[b._comp] += out; totalSupply += out;
    } else { const d = -D.power * saveF; if (b._comp >= 0) demand[b._comp] += d; }
  }
  for (let k = 0; k < nc; k++) totalDemand += demand[k];
  M.supply = totalSupply; M.demand = totalDemand;
  // станції працюють лише на стільки, скільки енергії споживає їхня мережа
  for (const b of blds) { const D = B[b.type]; if (D.power > 0) b._util = b._comp >= 0 && supply[b._comp] > 0 ? clamp(demand[b._comp] / supply[b._comp], 0.12, 1) : 0.12; }
  const ratio = new Float64Array(nc + 1); for (let k = 0; k < nc; k++) ratio[k] = demand[k] > 0 ? supply[k] / demand[k] : supply[k] > 0 ? 9 : 0;
  M.powerRatio = ratio;
  // нестача — віялові відключення: частина клітинок без світла, щомісяця різна
  const powered = M.powered = new Uint8Array(NN);
  let unpoweredPop = 0, popAll = 0;
  for (let i = 0; i < NN; i++) {
    if (!s.zone[i]) continue;
    const k = compOf(i), r = k >= 0 ? ratio[k] : 0;
    powered[i] = r >= 1 || (r > 0 && hash(i, s.month) < r) ? 1 : 0;
    const p = tilePop(s, i); popAll += p; if (!powered[i]) unpoweredPop += p;
  }
  // будівля працює: станції — якщо є дорога (по ній іде лінія), споживачі — якщо мережа має досить енергії
  for (const b of blds) {
    const D = B[b.type];
    b._on = D.power > 0 ? b._road >= 0 : D.power < 0 ? b._comp >= 0 && (ratio[b._comp] >= 1 || hash(b.x * N + b.y, s.month) < ratio[b._comp]) : b._road >= 0 || D.cat === 'eco' || D.onRoad;
    if (D.power > 0 && b._road < 0) b._out = 0;
  }
  M.blackoutShare = popAll ? unpoweredPop / popAll : 0;

  /* ── населення, робочі місця ── */
  const pop = M.pop = new Float32Array(NN);
  let P = 0, cJobs = 0, iJobs = 0, svcJobs = 0, htJobs = 0;
  for (let i = 0; i < NN; i++) { const p = tilePop(s, i); pop[i] = p; P += p; if (s.zone[i] === Z.C) cJobs += tileJobs(s, i); if (s.zone[i] === Z.I) { const j = tileJobs(s, i); iJobs += j; if (s.ht[i]) htJobs += j; } }
  for (const b of blds) svcJobs += bJobs(b);
  M.P = P; M.cJobs = cJobs; M.iJobs = iJobs; M.htJobs = htJobs; M.svcJobs = svcJobs; M.jobs = cJobs + iJobs + svcJobs;

  /* ── служби: покриття з урахуванням місткості й фінансування ── */
  const fund = k => (s.funding?.[k] ?? 100) / 100;
  const FUNDK = { school: 'edu', high: 'edu', uni: 'edu', lib: 'edu', health: 'health', police: 'police', fire: 'fire', transit: 'transit', metro: 'transit', bike: 'transit', park: 'park' };
  const cov = M.cov = {};
  for (const k of Object.keys(FUNDK)) cov[k] = new Float32Array(NN);
  const hasDepot = blds.some(b => b.type === 'depot' && b._on && b._road >= 0);
  const metroN = blds.filter(b => b.type === 'metro' && b._on && b._road >= 0).length;
  M.hasDepot = hasDepot; M.metroN = metroN;
  for (const b of blds) {
    const D = B[b.type]; if (!D.svc || !b._on || (b._road < 0 && !D.onRoad)) continue;
    if (D.svc === 'transit' && !hasDepot) continue;
    if (D.svc === 'metro' && metroN < 2) continue;
    const S = D.size, cx = b.x + S / 2 - .5, cy = b.y + S / 2 - .5, R = D.r;
    if (R >= 99) { // на все місто
      const need = D.svc === 'uni' ? P * 0.12 : P; const eff = clamp((D.cap * fund(FUNDK[D.svc])) / Math.max(need, 1), 0, 1);
      for (let i = 0; i < NN; i++) cov[D.svc][i] = clamp(cov[D.svc][i] + eff, 0, 1);
      continue;
    }
    // скільки людей у радіусі — щоб урахувати переповненість
    let need = 0; const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(N - 1, Math.ceil(cx + R)), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(N - 1, Math.ceil(cy + R));
    const share = D.svc === 'school' ? 0.18 : D.svc === 'high' ? 0.1 : 1;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const d = Math.hypot(x - cx, y - cy); if (d <= R) need += pop[y * N + x] * share; }
    const eff = D.cap ? clamp((D.cap * fund(FUNDK[D.svc])) / Math.max(need, 1), 0.15, 1) : fund(FUNDK[D.svc]);
    b._load = D.cap ? need / D.cap : 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const d = Math.hypot(x - cx, y - cy); if (d > R) continue; const i = y * N + x; cov[D.svc][i] = clamp(cov[D.svc][i] + eff * (1 - (d / R) ** 2 * 0.6), 0, 1); }
  }
  // мерія трохи «прикриває» центр (адмінпослуги)
  const th = blds.find(b => b.type === 'townhall'); M.center = th ? [th.x + 1, th.y + 1] : [N / 2, N / 2];

  /* ── транспорт: частка людей без авто й завантаженість доріг ── */
  const tShare = M.transit = new Float32Array(NN);
  const tf = fund('transit') * (pol.freeBus ? 1.35 : 1);
  for (let i = 0; i < NN; i++) tShare[i] = clamp((cov.transit[i] * 0.34 + cov.metro[i] * 0.5 + cov.bike[i] * 0.16 + (pol.bikeLanes ? 0.06 : 0)) * tf, 0, 0.75);
  // кожна робоча клітинка тягне працівників до найближчих доріг; шлях — до найближчої роботи по дорогах
  const jobRoad = new Float32Array(NN); // робочі місця, прив’язані до доріг
  for (let i = 0; i < NN; i++) { const j = tileJobs(s, i); if (j && near[i] >= 0 && rd[i] <= 3) jobRoad[near[i]] += j; }
  for (const b of blds) { const j = bJobs(b); if (j && b._road >= 0) jobRoad[b._road] += j; }
  const dist = new Int32Array(NN).fill(-1), par = new Int32Array(NN).fill(-1), qq = [];
  for (let i = 0; i < NN; i++) if (s.road[i] && jobRoad[i] > 0) { dist[i] = 0; qq.push(i); }
  for (let h = 0; h < qq.length; h++) { const i = qq[h]; for (const j of nb4(i)) if (s.road[j] && dist[j] < 0) { dist[j] = dist[i] + 1; par[j] = i; qq.push(j); } }
  // рівноцінні маршрути: машини розподіляються між паралельними вулицями, а не йдуть однією
  for (const i of qq) { if (!dist[i]) continue; const cand = nb4(i).filter(j => s.road[j] && dist[j] === dist[i] - 1); if (cand.length > 1) par[i] = cand[Math.floor(hash(i, 5) * cand.length)]; }
  const load = M.load = new Float32Array(NN);
  let trips = 0, carTrips = 0, transitTrips = 0, reachW = 0, workers = 0, distSum = 0;
  const carF = pol.carFree ? 1 : 1;
  for (let i = 0; i < NN; i++) {
    if (!pop[i]) continue;
    const w = pop[i] * 0.52; workers += w;
    const o = rd[i] <= 3 ? near[i] : -1;
    if (o < 0 || dist[o] < 0) continue;
    reachW += w;
    const share = tShare[i], cars = w * (1 - share) * carF * 0.6; // частина ходить пішки або їде разом
    trips += w; carTrips += cars; transitTrips += w * share; distSum += w * dist[o];
    // шлях до роботи: відкладаємо навантаження на кожну дорогу
    let r = o, guard = 0; while (r >= 0 && guard++ < 90) { load[r] += cars; r = par[r]; }
  }
  // покупці й доставка: трохи руху до комерційних і промислових зон
  for (let i = 0; i < NN; i++) if (jobRoad[i]) load[i] += jobRoad[i] * 0.25;
  // стадіон у дні подій
  if (s.flags.matchDay) for (const b of blds) if (b.type === 'stadium' && b._road >= 0) { let r = b._road; for (let k = 0; k < 6 && r >= 0; k++) { load[r] += 900; r = par[r]; } }
  const cong = M.cong = new Float32Array(NN);
  let congSum = 0, congW = 0;
  const bikeF = pol.bikeLanes ? 0.92 : 1;
  for (let i = 0; i < NN; i++) if (s.road[i]) {
    const cap = ROADS[s.road[i] === 2 ? 'avenue' : 'road'].cap * (s.flags.snow ? 0.7 : 1);
    load[i] *= bikeF; cong[i] = load[i] / cap; congSum += Math.min(cong[i], 2) * (load[i] + 1); congW += load[i] + 1;
  }
  // час у дорозі: що заторніше шлях, то довше
  const commute = M.commute = new Float32Array(NN);
  let cmSum = 0, cmW = 0;
  for (let i = 0; i < NN; i++) {
    if (!pop[i]) continue; const o = rd[i] <= 3 ? near[i] : -1; if (o < 0 || dist[o] < 0) { commute[i] = 90; continue; }
    let r = o, t = 0, guard = 0; while (r >= 0 && guard++ < 90) { const cg = cong[r]; t += 1.4 * (1 + 2.6 * Math.max(0, cg - 0.6) ** 2 + 0.25 * cg); r = par[r]; }
    const share = tShare[i]; commute[i] = 8 + t * (1 - share * 0.35); cmSum += commute[i] * pop[i]; cmW += pop[i];
  }
  M.workers = workers; M.reachW = reachW; M.trips = trips; M.carTrips = carTrips; M.transitShare = trips ? transitTrips / trips : 0;
  M.avgCong = congW ? congSum / congW : 0; M.avgCommute = cmW ? cmSum / cmW : 0;
  M.employed = Math.min(reachW, M.jobs); M.unemp = workers ? clamp(1 - M.employed / workers, 0, 1) : 0;

  /* ── забруднення повітря ── */
  const src = new Float32Array(NN);
  const gT = pol.greenTax ? 0.75 : 1;
  for (let i = 0; i < NN; i++) {
    if (s.zone[i] === Z.I && !s.aban[i] && s.lvl[i]) src[i] += (s.ht[i] ? 2 : 12 + s.lvl[i] * 7 + (s.flags.dirtyDeal > s.month ? 6 : 0)) * gT;
    if (s.zone[i] === Z.R && s.lvl[i] && (s.month % 12 < 2 || s.month % 12 > 9)) src[i] += pol.smokeBan ? 0.5 : 2.5; // опалення взимку
    if (s.road[i]) src[i] += Math.min(load[i], 1400) * 0.022;
  }
  for (const b of blds) {
    const D = B[b.type]; if (!D.poll) continue;
    const S = D.size, cx = b.x + S / 2 - .5, cy = b.y + S / 2 - .5, R = D.pr || 4, k = b.type === 'coal' || b.type === 'gas' ? clamp((b._util ?? 1) * 1.1, 0.25, 1) : 1;
    for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(N - 1, Math.ceil(cy + R)); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(N - 1, Math.ceil(cx + R)); x++) { const d = Math.hypot(x - cx, y - cy); if (d <= R) src[y * N + x] += D.poll * k * (1 - d / (R + 1)); }
  }
  if (s.flags.garbage) for (let i = 0; i < NN; i++) if (pop[i]) src[i] += 3 * s.flags.garbage;
  // розсіювання вітром: кілька проходів розмиття; дерева й парки поглинають
  let P0 = src, P1 = new Float32Array(NN);
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < NN; i++) { let a = P0[i] * 0.52, n = 0; for (const j of nb4(i)) { a += P0[j] * 0.12; n++; } P1[i] = a + (4 - n) * 0.12 * P0[i]; }
    [P0, P1] = [P1, P0];
  }
  const absorb = new Float32Array(NN);
  for (let i = 0; i < NN; i++) if (s.ter[i] === T.TREE) absorb[i] += 3;
  for (const b of blds) { const D = B[b.type]; if (!D.absorb) continue; const S = D.size, cx = b.x + S / 2 - .5, cy = b.y + S / 2 - .5, R = 4 + S; for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(N - 1, Math.ceil(cy + R)); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(N - 1, Math.ceil(cx + R)); x++) { const d = Math.hypot(x - cx, y - cy); if (d <= R) absorb[y * N + x] += D.absorb * (1 - d / (R + 1)); } }
  const poll = M.poll = new Float32Array(NN);
  let aq = 0, aqW = 0;
  for (let i = 0; i < NN; i++) { poll[i] = clamp(P0[i] * 3 - absorb[i] * 0.9, 0, 100); if (pop[i]) { aq += poll[i] * pop[i]; aqW += pop[i]; } }
  M.aqi = aqW ? aq / aqW : 0;

  /* ── злочинність ── */
  const crime = M.crime = new Float32Array(NN);
  let crSum = 0;
  for (let i = 0; i < NN; i++) {
    if (!pop[i] && s.zone[i] !== Z.C) continue;
    const dens = (pop[i] + tileJobs(s, i)) / 320;
    crime[i] = clamp((18 + dens * 30 + M.unemp * 70 + (s.aban[i] ? 30 : 0)) * (1 - cov.police[i] * 0.85) * (pol.nightLight ? 0.85 : 1), 0, 100);
    crSum += crime[i] * pop[i];
  }
  M.crimeAvg = P ? crSum / P : 0;

  /* ── вартість землі ── */
  const lv = M.lv = new Float32Array(NN);
  const waterNear = new Uint8Array(NN);
  for (let i = 0; i < NN; i++) if (s.ter[i] === T.WATER) { const [x, y] = xy(i); for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < N && Y < N) waterNear[Y * N + X] = 1; } }
  const lvFx = new Float32Array(NN);
  for (const b of blds) { const D = B[b.type]; if (!D.lv) continue; const S = D.size, cx = b.x + S / 2 - .5, cy = b.y + S / 2 - .5, R = 5 + S; for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(N - 1, Math.ceil(cy + R)); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(N - 1, Math.ceil(cx + R)); x++) { const d = Math.hypot(x - cx, y - cy); if (d <= R) lvFx[y * N + x] += D.lv * (1 - d / (R + 1)); } }
  const [mx, my] = M.center;
  for (let i = 0; i < NN; i++) {
    const [x, y] = xy(i), dc = Math.hypot(x - mx, y - my);
    let v = 36 + (waterNear[i] ? 12 : 0) + Math.max(0, 12 - dc * 0.5) + lvFx[i] + cov.school[i] * 6 + cov.health[i] * 5 + cov.police[i] * 4 + cov.metro[i] * 10 + cov.transit[i] * 3
      - poll[i] * 0.7 - crime[i] * 0.25 - (s.road[i] ? 0 : Math.min(30, (s.road[i - 1] ? load[i - 1] : 0) / 80 + (s.road[i + 1] ? load[i + 1] : 0) / 80));
    if (pol.carFree && dc < 7) v += 10;
    let trees = 0; for (const j of nb4(i)) if (s.ter[j] === T.TREE) trees++; v += trees * 2;
    lv[i] = clamp(v, 0, 100);
  }

  /* ── щастя жителів ── */
  const happy = M.happy = new Float32Array(NN);
  const taxPen = (s.taxes.r - 9) * 2.4;
  let hSum = 0;
  for (let i = 0; i < NN; i++) {
    if (!pop[i]) continue;
    let hp = 60 + cov.school[i] * 7 + cov.health[i] * 8 + cov.police[i] * 4 + cov.fire[i] * 3 + cov.park[i] * 9 + tShare[i] * 8 + (lv[i] - 45) * 0.18
      - poll[i] * 0.45 - Math.max(0, commute[i] - 25) * 0.35 - crime[i] * 0.22 - taxPen - (powered[i] ? 0 : 26) - M.unemp * 40 - (s.flags.garbage ? 4 * s.flags.garbage : 0)
      + (pol.freeBus ? 3 : 0) - (pol.smokeBan ? 1 : 0) + (s.flags.festival ? 5 : 0);
    happy[i] = clamp(hp, 0, 100); hSum += happy[i] * pop[i];
  }
  M.happyAvg = P ? hSum / P : 50;
  M.time = (M.time || 0) + 1;
  return M;
}
