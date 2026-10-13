// Симулятор міста · бот-мер для перевірки балансу (тести) і для швидкого старту сценаріїв.
// Будує квартали спіраллю від мерії, зонує за попитом, стежить за енергією, службами й сміттям.
import { N, T, Z, B } from './data.js';

const STEP = 6; // дорога кожні 6 клітинок → квартал 5×5
function blocks(c) {
  const [cx, cy] = c.m.center, out = [], seen = new Set();
  for (let ring = 0; ring < 6; ring++) for (let by = -ring; by <= ring; by++) for (let bx = -ring; bx <= ring; bx++) {
    if (Math.max(Math.abs(bx), Math.abs(by)) !== ring) continue;
    const x0 = cx + 3 + bx * STEP - STEP, y0 = cy + 3 + by * STEP - STEP, k = x0 + ',' + y0;
    if (seen.has(k) || x0 < 1 || y0 < 1 || x0 + STEP >= N - 1 || y0 + STEP >= N - 1) continue;
    seen.add(k); out.push({ x0, y0, ring, bx, by });
  }
  return out;
}
const interior = b => { const a = []; for (let y = b.y0 + 1; y < b.y0 + STEP; y++) for (let x = b.x0 + 1; x < b.x0 + STEP; x++) a.push(y * N + x); return a; };
const ring = b => { const a = []; for (let x = b.x0; x <= b.x0 + STEP; x++) a.push(b.y0 * N + x, (b.y0 + STEP) * N + x); for (let y = b.y0 + 1; y < b.y0 + STEP; y++) a.push(y * N + b.x0, y * N + b.x0 + STEP); return a; };

export function mayorMonth(c, o = {}) {
  const s = c.s, M = c.m || c.recompute(), bl = (s.flags.botBlocks ||= blocks(c).map(b => ({ ...b, use: null })));
  const land = b => interior(b).filter(i => s.ter[i] !== T.WATER).length;
  const free = bl.filter(b => !b.use && land(b) >= 18 && !interior(b).some(i => s.bid[i]));
  const P = M.P;
  // 1) енергія із запасом
  const need = M.demand * 1.25 + 40;
  if (M.supply < need) {
    const type = o.green ? (s.money > 6000 ? 'solar' : 'wind') : P < 6000 || s.money < 10000 ? 'coal' : o.clean ? 'gas' : 'coal';
    placeIn(c, type, free.filter(b => b.ring >= 2), 'power');
  }
  // 2) служби там, де їх бракує
  const cover = k => { let a = 0, w = 0; for (let i = 0; i < N * N; i++) if (M.pop[i]) { a += M.cov[k][i] * M.pop[i]; w += M.pop[i]; } return w ? a / w : 1; };
  const want = [];
  if (P > 300 && cover('school') < 0.6) want.push('school');
  if (P > 600 && cover('police') < 0.55) want.push('police');
  if (P > 600 && cover('fire') < 0.55) want.push('fire');
  if (P > 500 && cover('health') < 0.5) want.push(c.unlocked('hospital') ? 'hospital' : 'clinic');
  if (P > 400 && cover('park') < 0.4) want.push(s.money > 8000 ? 'bigpark' : 'park');
  if (P > 1200 && s.flags.garbage) want.push(s.money > 12000 ? 'recycle' : 'landfill');
  if (c.unlocked('lyceum') && cover('high') < 0.5) want.push('lyceum');
  if (c.unlocked('uni') && !Object.values(s.bld).some(b => b.type === 'uni') && s.money > 45000) want.push('uni');
  if (M.avgCong > 0.6 && !M.hasDepot && s.money > 8000) want.push('depot');
  for (const t of want.slice(0, 2)) if (s.money > B[t].cost * 1.3) placeIn(c, t, free, t === 'landfill' ? 'far' : 'svc');
  if (M.hasDepot && M.avgCong > 0.5 && s.money > 2000) addStops(c);
  // 3) нові квартали за попитом
  const d = s.demand, z = d.r >= d.c && d.r >= d.i ? Z.R : d.c >= d.i ? Z.C : Z.I;
  const unbuilt = [Z.R, Z.C, Z.I].map(k => { let n = 0; for (let i = 0; i < N * N; i++) if (s.zone[i] === k && !s.lvl[i] && !s.aban[i]) n++; return n; });
  if (Math.max(d.r, d.c, d.i) > 0.15 && unbuilt[z - 1] < 8 && s.money > 1800) {
    const cands = free.filter(b => z === Z.I ? b.ring >= 2 : b.ring <= 3).sort((a, b) => a.ring - b.ring);
    const b = z === Z.I ? cands.find(x => x.bx >= 1) || cands[0] : cands[0];
    if (b) { c.placeRoad(ring(b)); c.placeZone(interior(b), z); b.use = 'z' + z; } // навіть якщо не вдалося — не пробуємо той самий квартал щомісяця
  }
  s.taxes = { r: 9, c: 9, i: 9, ...(o.taxes || {}) };
}
function placeIn(c, type, list, why) {
  const S = B[type].size;
  for (const b of list) {
    for (let y = b.y0 + 1; y + S <= b.y0 + STEP; y++) for (let x = b.x0 + 1; x + S <= b.x0 + STEP; x++) {
      if (!c.canBuild(type, x, y).ok) continue;
      c.placeRoad(ring(b)); const r = c.build(type, x, y); if (r.ok) { b.use = b.use || why; return true; }
    }
  }
  return false;
}
function addStops(c) {
  const s = c.s, M = c.m;
  for (let i = 0; i < N * N && s.money > 600; i++) {
    if (!M.pop[i] || M.cov.transit[i] > 0.3) continue;
    const r = M.nearRoad[i]; if (r < 0) continue;
    for (const j of [r - 1, r + 1, r - N, r + N]) if (j >= 0 && j < N * N && !s.road[j] && !s.bid[j] && s.ter[j] !== T.WATER && !s.zone[j]) { const x = j % N, y = (j / N) | 0; if (c.build('stop', x, y).ok) return; }
  }
}
export function autoplay(c, months, o = {}) { for (let m = 0; m < months && !(c.s.over && !c.s.flags.keepPlaying); m++) { mayorMonth(c, o); for (let d = 0; d < 30; d++) c.tick(); } return c; }
