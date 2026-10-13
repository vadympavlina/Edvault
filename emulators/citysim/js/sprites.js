// Симулятор міста · процедурні ізометричні спрайти: будинки, служби, станції, дороги, вода, дерева.
// Кожен спрайт малюється один раз у позаекранне полотно (удвічі детальніше, ніж треба), а потім лише копіюється.
// Окремо малюються «вогні» — освітлені вікна, які проступають уночі.

export const TW = 64, TH = 32, SPR = 2;           // ширина й висота клітинки, масштаб спрайтів
const cache = new Map();

/* ── кольори ── */
function hex(c) { if (c.startsWith('rgb')) return c.match(/\d+/g).slice(0, 3).map(Number); const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function shade(c, k) { const [r, g, b] = hex(c); const f = v => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)))); return `rgb(${f(r)},${f(g)},${f(b)})`; }
const rnd = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

/* ── полотно спрайта: S клітинок завширшки, top — запас угору для висоти ── */
function canvas(w, h) { const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }); return c; }
function sprite(S, top, draw) {
  const W = S * TW, H = S * TH + top + 4;
  const day = canvas(W * SPR, H * SPR), light = canvas(W * SPR, H * SPR);
  const g = day.getContext('2d'), l = light.getContext('2d');
  g.scale(SPR, SPR); l.scale(SPR, SPR);
  g.lineJoin = l.lineJoin = 'round';
  const ox = W / 2, oy = top;
  const P = (u, v, z = 0) => [ox + (u - v) * TW / 2, oy + (u + v) * TH / 2 - z];
  const api = { g, l, P, S, lit: false };
  draw(api);
  return { day, light: api.lit ? light : null, W, H, ox, oy };
}
export function get(key, make) { let s = cache.get(key); if (!s) { s = make(); cache.set(key, s); } return s; }
export const cacheSize = () => cache.size;

/* ── примітиви ── */
function poly(g, pts, fill, stroke, lw = 0.6) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } }
// Прямокутний блок: видимі грані — права (u = u1) і ліва (v = v1), плюс верх
function box(a, u0, v0, u1, v1, z0, h, color, o = {}) {
  const { g, P } = a, top = z0 + h;
  const edge = o.edge ?? 'rgba(0,0,0,.18)';
  poly(g, [P(u1, v0, z0), P(u1, v1, z0), P(u1, v1, top), P(u1, v0, top)], o.right || shade(color, -0.14), edge);
  poly(g, [P(u0, v1, z0), P(u1, v1, z0), P(u1, v1, top), P(u0, v1, top)], o.left || shade(color, -0.3), edge);
  if (!o.noTop) poly(g, [P(u0, v0, top), P(u1, v0, top), P(u1, v1, top), P(u0, v1, top)], o.top || shade(color, 0.12), edge);
}
// Вікна на гранях: rows × cols; lit — частка вікон, що світяться вночі
function windows(a, face, u0, v0, u1, v1, z0, h, rows, cols, o = {}) {
  const { g, l, P } = a, r = rnd(o.seed || 7);
  const col = o.color || '#9fc3e6', frame = o.frame, mx = o.mx ?? 0.18, my = o.my ?? 0.22;
  const len = face === 'R' ? v1 - v0 : u1 - u0, cw = len / cols, rh = h / rows;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a0 = (face === 'R' ? v0 : u0) + j * cw + cw * mx, a1 = a0 + cw * (1 - 2 * mx), z = z0 + i * rh + rh * my, z1 = z0 + (i + 1) * rh - rh * (my * 0.7);
    const pts = face === 'R' ? [P(u1, a0, z), P(u1, a1, z), P(u1, a1, z1), P(u1, a0, z1)] : [P(a0, v1, z), P(a1, v1, z), P(a1, v1, z1), P(a0, v1, z1)];
    const c = face === 'R' ? col : shade(col, -0.18);
    poly(g, pts, c, frame, 0.5);
    // відблиск на склі
    if (o.glare !== false) { const [x0, y0] = pts[0], [x1, y1] = pts[2]; g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x0 + (x1 - x0) * 0.2, y0 + (y1 - y0) * 0.8); g.lineTo(x0 + (x1 - x0) * 0.45, y0 + (y1 - y0) * 0.25); g.stroke(); }
    if (r() < (o.lit ?? 0.6)) { a.lit = true; poly(l, pts, r() < 0.2 ? '#ffb75e' : r() < 0.6 ? '#ffcf7d' : '#ffe2a8'); }
  }
}
// Двосхилий дах: гребінь уздовж осі u (або v, якщо alongV)
function gable(a, u0, v0, u1, v1, z, rh, color, alongV = false) {
  const { g, P } = a, dark = shade(color, -0.25), light = shade(color, 0.05), edge = 'rgba(0,0,0,.25)';
  if (!alongV) {
    const vm = (v0 + v1) / 2;
    poly(g, [P(u0, v0, z), P(u1, v0, z), P(u1, vm, z + rh), P(u0, vm, z + rh)], shade(color, -0.05), edge);
    poly(g, [P(u1, v0, z), P(u1, v1, z), P(u1, vm, z + rh)], shade(color, -0.4), edge); // фронтон
    poly(g, [P(u0, v1, z), P(u1, v1, z), P(u1, vm, z + rh), P(u0, vm, z + rh)], dark, edge);
  } else {
    const um = (u0 + u1) / 2;
    poly(g, [P(u0, v0, z), P(u0, v1, z), P(um, v1, z + rh), P(um, v0, z + rh)], shade(color, -0.05), edge);
    poly(g, [P(u0, v1, z), P(u1, v1, z), P(um, v1, z + rh)], shade(color, -0.45), edge);
    poly(g, [P(u1, v0, z), P(u1, v1, z), P(um, v1, z + rh), P(um, v0, z + rh)], light, edge);
  }
}
function diamond(a, u0, v0, u1, v1, z, fill, stroke, seam = false) { const { g, P } = a; poly(g, [P(u0, v0, z), P(u1, v0, z), P(u1, v1, z), P(u0, v1, z)], fill, stroke || (seam ? fill : null), seam ? 1.3 : 0.6); }
function treeAt(a, u, v, s = 1, hue = 0) {
  const { g, P } = a, [x, y] = P(u, v, 0);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(x + 3 * s, y + 1, 7 * s, 3 * s, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#6b4a2e'; g.fillRect(x - 0.8 * s, y - 6 * s, 1.6 * s, 6 * s);
  const greens = ['#3f8f3a', '#4a9e42', '#2f7d3a', '#5aa94a'];
  const c = greens[hue % greens.length];
  g.fillStyle = shade(c, -0.15); g.beginPath(); g.arc(x, y - 9 * s, 6.2 * s, 0, Math.PI * 2); g.fill();
  g.fillStyle = c; g.beginPath(); g.arc(x - 1.4 * s, y - 10.5 * s, 4.8 * s, 0, Math.PI * 2); g.fill();
  g.fillStyle = shade(c, 0.25); g.beginPath(); g.arc(x - 2.4 * s, y - 12 * s, 2.2 * s, 0, Math.PI * 2); g.fill();
}
function person(a, u, v, color) { const { g, P } = a, [x, y] = P(u, v, 0); g.fillStyle = color; g.fillRect(x - 0.8, y - 4, 1.6, 3); g.fillStyle = '#f2c9a0'; g.beginPath(); g.arc(x, y - 5, 0.9, 0, Math.PI * 2); g.fill(); }
function lamp(a, u, v) { const { g, l, P } = a, [x, y] = P(u, v, 0); g.strokeStyle = '#3a3f47'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 9); g.stroke(); g.fillStyle = '#d9dde3'; g.fillRect(x - 1.2, y - 10, 2.4, 1.2); a.lit = true; const gr = l.createRadialGradient(x, y - 9, 0, x, y - 9, 7); gr.addColorStop(0, 'rgba(255,230,160,.9)'); gr.addColorStop(1, 'rgba(255,230,160,0)'); l.fillStyle = gr; l.beginPath(); l.arc(x, y - 9, 7, 0, Math.PI * 2); l.fill(); }

/* ═════════ ЗЕМЛЯ ═════════ */
const GRASS = ['#7cb35a', '#78ae55', '#80b85f', '#74a952'];
export function groundTile(kind, v = 0) {
  return get(`g_${kind}_${v}`, () => sprite(1, 2, a => {
    const { g, P } = a, r = rnd(v * 31 + 5);
    if (kind === 'sand') { diamond(a, 0, 0, 1, 1, 0, '#e3d29b', null, true); for (let k = 0; k < 6; k++) { const [x, y] = P(r(), r()); g.fillStyle = 'rgba(160,130,80,.25)'; g.fillRect(x, y, 1, 1); } return; }
    diamond(a, 0, 0, 1, 1, 0, GRASS[v % 4], null, true);
    for (let k = 0; k < 9; k++) { const [x, y] = P(0.1 + r() * 0.8, 0.1 + r() * 0.8); g.fillStyle = r() < 0.5 ? 'rgba(40,90,30,.22)' : 'rgba(200,240,150,.2)'; g.fillRect(x, y, 1.6, 1); }
    if (v % 5 === 2) for (let k = 0; k < 3; k++) { const [x, y] = P(0.2 + r() * 0.6, 0.2 + r() * 0.6); g.fillStyle = ['#ffe066', '#ff8fab', '#ffffff'][k]; g.fillRect(x, y, 1.4, 1.4); }
  }));
}
// Вода: 4 кадри брижів; mask — з яких боків берег (біти: 1 вгору-вправо(−y), 2 вправо-вниз(+x), 4 вниз-вліво(+y), 8 вліво-вгору(−x))
export function waterTile(mask, frame) {
  return get(`w_${mask}_${frame}`, () => sprite(1, 2, a => {
    const { g, P } = a;
    diamond(a, 0, 0, 1, 1, 0, '#3b8fc4', null, true);
    const gr = g.createLinearGradient(...P(0, 0), ...P(1, 1)); gr.addColorStop(0, 'rgba(255,255,255,.08)'); gr.addColorStop(1, 'rgba(0,30,80,.12)'); poly(g, [P(0, 0), P(1, 0), P(1, 1), P(0, 1)], gr);
    const r = rnd(frame * 13 + mask * 7 + 3);
    g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 0.7;
    for (let k = 0; k < 3; k++) { const u = 0.15 + r() * 0.6, v = 0.15 + r() * 0.6, [x, y] = P(u, v); const w = 3 + r() * 4, ph = (frame / 4) * Math.PI * 2 + k; g.beginPath(); g.moveTo(x - w, y + Math.sin(ph) * 0.6); g.quadraticCurveTo(x, y - 1.2 + Math.sin(ph) * 0.6, x + w, y + Math.sin(ph) * 0.6); g.stroke(); }
    // берег: світла смуга й піна
    const edges = [[1, P(0, 0), P(1, 0)], [2, P(1, 0), P(1, 1)], [4, P(1, 1), P(0, 1)], [8, P(0, 1), P(0, 0)]];
    for (const [bit, p0, p1] of edges) if (mask & bit) { g.strokeStyle = 'rgba(230,245,255,.75)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(...p0); g.lineTo(...p1); g.stroke(); g.strokeStyle = 'rgba(120,190,230,.6)'; g.lineWidth = 3.5; g.globalAlpha = 0.5; g.beginPath(); g.moveTo(p0[0] + (p1[0] > p0[0] ? 0 : 0), p0[1]); g.lineTo(...p1); g.stroke(); g.globalAlpha = 1; }
  }));
}
// Дорога: mask — сусідні дороги (ті самі біти); avenue — проспект; bridge — над водою
export function roadTile(mask, avenue, bridge) {
  return get(`r_${mask}_${avenue ? 1 : 0}_${bridge ? 1 : 0}`, () => sprite(1, 6, a => {
    const { g, P } = a;
    if (bridge) { diamond(a, 0, 0, 1, 1, -3, '#2f6f99'); }
    // тротуар
    diamond(a, 0, 0, 1, 1, bridge ? 2 : 0, bridge ? '#a9a49a' : '#c9c4b8', null, true);
    const z = bridge ? 2 : 0, e = avenue ? 0.06 : 0.14; // ширина тротуару
    const asphalt = avenue ? '#4a4f57' : '#555a62';
    // центральний квадрат і «рукави» в бік сусідів
    poly(g, [P(e, e, z), P(1 - e, e, z), P(1 - e, 1 - e, z), P(e, 1 - e, z)], asphalt);
    const arms = { 1: [[e, 0], [1 - e, 0], [1 - e, e], [e, e]], 2: [[1 - e, e], [1, e], [1, 1 - e], [1 - e, 1 - e]], 4: [[e, 1 - e], [1 - e, 1 - e], [1 - e, 1], [e, 1]], 8: [[0, e], [e, e], [e, 1 - e], [0, 1 - e]] };
    for (const [bit, q] of Object.entries(arms)) if (mask & +bit) poly(g, q.map(([u, v]) => P(u, v, z)), asphalt);
    // розмітка
    const n = [1, 2, 4, 8].filter(b => mask & b).length, straightU = (mask & 10) === 10 && !(mask & 5), straightV = (mask & 5) === 5 && !(mask & 10);
    g.strokeStyle = avenue ? 'rgba(255,214,90,.9)' : 'rgba(255,255,255,.75)'; g.lineWidth = avenue ? 1 : 0.8; g.setLineDash(avenue ? [] : [2.5, 2.5]);
    if (straightU || (n <= 1 && mask & 10) || (!mask)) { g.beginPath(); g.moveTo(...P(0, 0.5, z)); g.lineTo(...P(1, 0.5, z)); g.stroke(); }
    if (straightV || (n <= 1 && mask & 5)) { g.beginPath(); g.moveTo(...P(0.5, 0, z)); g.lineTo(...P(0.5, 1, z)); g.stroke(); }
    g.setLineDash([]);
    if (avenue && (straightU || straightV)) { const pts = straightU ? [P(0, 0.47, z), P(1, 0.47, z), P(1, 0.53, z), P(0, 0.53, z)] : [P(0.47, 0, z), P(0.53, 0, z), P(0.53, 1, z), P(0.47, 1, z)]; poly(g, pts, '#5f9e4a'); }
    // перехрестя: «зебра»
    if (n >= 3) { g.fillStyle = 'rgba(255,255,255,.7)'; for (let k = 0; k < 4; k++) { const t = 0.25 + k * 0.14; for (const [u0, v0, u1, v1] of [[t, e + 0.02, t + 0.07, e + 0.12], [t, 1 - e - 0.12, t + 0.07, 1 - e - 0.02]]) poly(g, [P(u0, v0, z), P(u1, v0, z), P(u1, v1, z), P(u0, v1, z)], 'rgba(255,255,255,.65)'); } }
    if (bridge) { g.strokeStyle = '#7d7468'; g.lineWidth = 1.2; for (const [p0, p1] of (mask & 10) ? [[P(0, 0.05, z + 2), P(1, 0.05, z + 2)], [P(0, 0.95, z + 2), P(1, 0.95, z + 2)]] : [[P(0.05, 0, z + 2), P(0.05, 1, z + 2)], [P(0.95, 0, z + 2), P(0.95, 1, z + 2)]]) { g.beginPath(); g.moveTo(...p0); g.lineTo(...p1); g.stroke(); } }
    if (!bridge && (mask === 10 || mask === 5) && (mask & 2)) lamp(a, 0.5, 0.08);
  }));
}
export function zoneLot(z) {
  const col = { 1: '#22c55e', 2: '#3b82f6', 3: '#eab308' }[z];
  return get(`z_${z}`, () => sprite(1, 2, a => {
    const { g, P } = a;
    diamond(a, 0.04, 0.04, 0.96, 0.96, 0, shade(col, 0.55) + '', null);
    g.globalAlpha = 0.55; diamond(a, 0, 0, 1, 1, 0, null, col); g.globalAlpha = 1;
    g.strokeStyle = col; g.lineWidth = 0.8; g.setLineDash([2, 2]); poly(g, [P(0.12, 0.12), P(0.88, 0.12), P(0.88, 0.88), P(0.12, 0.88)], null, col, 0.8); g.setLineDash([]);
    // табличка «під забудову»
    const [x, y] = P(0.62, 0.62); g.fillStyle = '#7a5c3a'; g.fillRect(x, y - 7, 0.9, 7); g.fillStyle = '#fff'; g.fillRect(x - 3, y - 10, 7, 4.5); g.fillStyle = col; g.fillRect(x - 2.4, y - 9.3, 5.8, 1.2);
  }));
}
export function treeTile(v) {
  return get(`t_${v}`, () => sprite(1, 26, a => { const r = rnd(v * 17 + 1), n = 2 + (v % 3); for (let k = 0; k < n; k++) treeAt(a, 0.25 + r() * 0.5, 0.25 + r() * 0.5, 0.75 + r() * 0.4, v + k); }));
}

/* ═════════ ЗОНИ: будинки за рівнями ═════════ */
const WALLS = ['#f2e6d0', '#e8d5c0', '#dfe7ef', '#f0dcc8', '#e9e1f2', '#f5efe0', '#d9e6d3'];
const ROOFS = ['#b5523b', '#8c4a3a', '#5d6670', '#a8643c', '#6b5a7a', '#9a3b3b'];
export function resSprite(lvl, v) {
  return get(`R_${lvl}_${v}`, () => sprite(1, [0, 30, 42, 74, 178][lvl], a => {
    const r = rnd(v * 97 + lvl), wall = WALLS[v % WALLS.length], roof = ROOFS[(v + lvl) % ROOFS.length];
    diamond(a, 0, 0, 1, 1, 0, '#86bd62', null, true);
    if (lvl === 1) {
      // приватний будиночок із садком
      const fence = '#d8c7a4';
      treeAt(a, 0.18, 0.75, 0.6, v); if (v % 2) treeAt(a, 0.8, 0.2, 0.55, v + 1);
      box(a, 0.3, 0.28, 0.78, 0.7, 0, 10, wall);
      windows(a, 'R', 0.3, 0.28, 0.78, 0.7, 0, 10, 1, 2, { seed: v, color: '#8fb6d6', lit: 0.7 });
      windows(a, 'L', 0.3, 0.28, 0.78, 0.7, 0, 10, 1, 2, { seed: v + 3, color: '#8fb6d6', lit: 0.5 });
      gable(a, 0.27, 0.25, 0.81, 0.73, 10, 8, roof, v % 2 === 1);
      a.g.strokeStyle = fence; a.g.lineWidth = 0.6; a.g.beginPath(); a.g.moveTo(...a.P(0.05, 0.95)); a.g.lineTo(...a.P(0.95, 0.95)); a.g.stroke();
      if (v % 3 === 0) { const { g, P } = a; poly(g, [P(0.82, 0.55), P(0.95, 0.55), P(0.95, 0.85), P(0.82, 0.85)], '#5fb3d9'); } // басейн/ставок
    } else if (lvl === 2) {
      // таунхаус на 2 поверхи
      box(a, 0.15, 0.2, 0.85, 0.8, 0, 18, wall);
      windows(a, 'R', 0.15, 0.2, 0.85, 0.8, 0, 18, 2, 3, { seed: v, color: '#8fb6d6', lit: 0.6 });
      windows(a, 'L', 0.15, 0.2, 0.85, 0.8, 0, 18, 2, 3, { seed: v + 9, color: '#8fb6d6', lit: 0.6 });
      gable(a, 0.12, 0.17, 0.88, 0.83, 18, 9, roof, v % 2 === 0);
      treeAt(a, 0.08, 0.92, 0.55, v);
    } else if (lvl === 3) {
      // багатоповерхівка з балконами
      const h = 40 + (v % 3) * 6, c = ['#e9dfd0', '#d7dde5', '#efe2cf', '#dcd3e6'][v % 4];
      box(a, 0.12, 0.12, 0.88, 0.88, 0, h, c);
      windows(a, 'R', 0.12, 0.12, 0.88, 0.88, 0, h, Math.round(h / 8), 4, { seed: v, color: '#8db3d1', lit: 0.55 });
      windows(a, 'L', 0.12, 0.12, 0.88, 0.88, 0, h, Math.round(h / 8), 4, { seed: v + 1, color: '#8db3d1', lit: 0.55 });
      box(a, 0.3, 0.3, 0.5, 0.5, h, 4, '#9aa0a8'); // вихід на дах
      const { g, P } = a; g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.6; for (let k = 1; k < Math.round(h / 8); k++) { g.beginPath(); g.moveTo(...P(0.88, 0.12, k * 8)); g.lineTo(...P(0.88, 0.88, k * 8)); g.lineTo(...P(0.12, 0.88, k * 8)); g.stroke(); }
    } else {
      // висотка
      const h = 105 + (v % 4) * 12, c = ['#cfd8e3', '#e3dccf', '#d6e2dc', '#e0d6e6'][v % 4];
      box(a, 0.14, 0.14, 0.86, 0.86, 0, h, c);
      windows(a, 'R', 0.14, 0.14, 0.86, 0.86, 0, h, Math.round(h / 7), 4, { seed: v, color: '#7fa7c9', lit: 0.5 });
      windows(a, 'L', 0.14, 0.14, 0.86, 0.86, 0, h, Math.round(h / 7), 4, { seed: v + 2, color: '#7fa7c9', lit: 0.5 });
      box(a, 0.28, 0.28, 0.72, 0.72, h, 6, shade(c, -0.1));
      const { g, P } = a, [x, y] = P(0.5, 0.5, h + 6); g.strokeStyle = '#555'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 10); g.stroke(); a.lit = true; a.l.fillStyle = '#ff4d4d'; a.l.beginPath(); a.l.arc(x, y - 10, 1.4, 0, Math.PI * 2); a.l.fill();
    }
  }));
}
const SIGNS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];
export function comSprite(lvl, v) {
  return get(`C_${lvl}_${v}`, () => sprite(1, [0, 30, 50, 92, 212][lvl], a => {
    const { g, P } = a, sign = SIGNS[v % SIGNS.length];
    diamond(a, 0, 0, 1, 1, 0, '#cfcabe', null, true);
    if (lvl === 1) {
      box(a, 0.18, 0.18, 0.86, 0.86, 0, 12, ['#f5efe4', '#efe6f5', '#e5f1ee'][v % 3]);
      windows(a, 'R', 0.18, 0.18, 0.86, 0.86, 0, 9, 1, 2, { seed: v, color: '#a9d2ee', mx: 0.08, my: 0.15, lit: 0.95 });
      windows(a, 'L', 0.18, 0.18, 0.86, 0.86, 0, 9, 1, 2, { seed: v + 1, color: '#a9d2ee', mx: 0.08, my: 0.15, lit: 0.95 });
      // смугастий навіс
      for (let k = 0; k < 6; k++) { const u0 = 0.18 + k * 0.113, u1 = u0 + 0.113; poly(g, [P(u0, 0.86, 9), P(u1, 0.86, 9), P(u1, 0.98, 6), P(u0, 0.98, 6)], k % 2 ? '#fff' : sign); }
      box(a, 0.3, 0.86, 0.75, 0.88, 12, 4, sign, { noTop: true });
      person(a, 0.5, 1.02, '#3b82f6'); person(a, 0.9, 0.6, '#e11d48');
    } else if (lvl === 2) {
      const c = ['#f3e3d3', '#e2e8f0', '#f1e7d6'][v % 3];
      box(a, 0.12, 0.12, 0.88, 0.88, 0, 26, c);
      windows(a, 'R', 0.12, 0.12, 0.88, 0.88, 0, 10, 1, 3, { seed: v, color: '#bfe3f7', mx: 0.06, lit: 0.95 });
      windows(a, 'L', 0.12, 0.12, 0.88, 0.88, 0, 10, 1, 3, { seed: v + 2, color: '#bfe3f7', mx: 0.06, lit: 0.95 });
      windows(a, 'R', 0.12, 0.12, 0.88, 0.88, 12, 14, 2, 3, { seed: v + 3, color: '#9cc1dc', lit: 0.5 });
      windows(a, 'L', 0.12, 0.12, 0.88, 0.88, 12, 14, 2, 3, { seed: v + 4, color: '#9cc1dc', lit: 0.5 });
      box(a, 0.12, 0.88, 0.88, 0.9, 10, 3, sign, { noTop: true });
      a.lit = true; poly(a.l, [P(0.2, 0.9, 10.5), P(0.8, 0.9, 10.5), P(0.8, 0.9, 12.5), P(0.2, 0.9, 12.5)], shade(sign, 0.4));
    } else if (lvl === 3) {
      const h = 58 + (v % 3) * 8;
      box(a, 0.12, 0.12, 0.88, 0.88, 0, h, '#6f8fae', { top: '#b9c7d6' });
      windows(a, 'R', 0.12, 0.12, 0.88, 0.88, 0, h, Math.round(h / 6), 5, { seed: v, color: '#a8d0ec', mx: 0.05, my: 0.12, frame: 'rgba(40,60,80,.35)', lit: 0.45 });
      windows(a, 'L', 0.12, 0.12, 0.88, 0.88, 0, h, Math.round(h / 6), 5, { seed: v + 5, color: '#a8d0ec', mx: 0.05, my: 0.12, frame: 'rgba(40,60,80,.35)', lit: 0.45 });
      box(a, 0.12, 0.88, 0.88, 0.9, h - 8, 5, sign, { noTop: true });
    } else {
      // скляний хмарочос з «короною»
      const h = 140 + (v % 3) * 14, glass = ['#4f7ea8', '#3f8a8c', '#5b6fa8'][v % 3];
      box(a, 0.16, 0.16, 0.84, 0.84, 0, h, glass, { top: shade(glass, 0.3) });
      windows(a, 'R', 0.16, 0.16, 0.84, 0.84, 0, h, Math.round(h / 5), 6, { seed: v, color: shade(glass, 0.35), mx: 0.04, my: 0.1, glare: false, lit: 0.4 });
      windows(a, 'L', 0.16, 0.16, 0.84, 0.84, 0, h, Math.round(h / 5), 6, { seed: v + 1, color: shade(glass, 0.2), mx: 0.04, my: 0.1, glare: false, lit: 0.4 });
      box(a, 0.26, 0.26, 0.74, 0.74, h, 10, shade(glass, -0.1));
      box(a, 0.38, 0.38, 0.62, 0.62, h + 10, 10, shade(glass, 0.1));
      const [x, y] = P(0.5, 0.5, h + 20); g.strokeStyle = '#ccd'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 14); g.stroke(); a.lit = true; a.l.fillStyle = '#ff5a5a'; a.l.beginPath(); a.l.arc(x, y - 14, 1.6, 0, Math.PI * 2); a.l.fill();
    }
  }));
}
export function indSprite(lvl, v, ht) {
  return get(`I_${lvl}_${v}_${ht ? 1 : 0}`, () => sprite(1, ht ? [0, 30, 40, 64, 90][lvl] : [0, 34, 52, 64, 64][lvl], a => {
    const { g, P } = a;
    diamond(a, 0, 0, 1, 1, 0, ht ? '#b7c9b1' : '#a39d90', null, true);
    if (ht) {
      // чистий високотехнологічний кампус
      const h = 14 + lvl * 9;
      box(a, 0.12, 0.15, 0.86, 0.85, 0, h, '#eef2f5', { top: '#dfe6ea' });
      windows(a, 'R', 0.12, 0.15, 0.86, 0.85, 0, h, Math.max(1, Math.round(h / 9)), 5, { seed: v, color: '#7ec3d9', mx: 0.03, lit: 0.6 });
      windows(a, 'L', 0.12, 0.15, 0.86, 0.85, 0, h, Math.max(1, Math.round(h / 9)), 5, { seed: v + 3, color: '#7ec3d9', mx: 0.03, lit: 0.6 });
      for (let k = 0; k < 3; k++) poly(g, [P(0.2 + k * 0.2, 0.25, h), P(0.36 + k * 0.2, 0.25, h), P(0.36 + k * 0.2, 0.55, h), P(0.2 + k * 0.2, 0.55, h)], '#2d4f86', 'rgba(255,255,255,.4)');
      treeAt(a, 0.92, 0.3, 0.5, v); treeAt(a, 0.1, 0.95, 0.5, v + 1);
      return;
    }
    if (lvl === 1) {
      // склад із ребристим дахом
      box(a, 0.1, 0.18, 0.9, 0.82, 0, 14, '#c9c2b4');
      const { g: gg } = a; gg.strokeStyle = 'rgba(0,0,0,.15)'; for (let k = 1; k < 8; k++) { gg.beginPath(); gg.moveTo(...P(0.1 + k * 0.1, 0.82, 0)); gg.lineTo(...P(0.1 + k * 0.1, 0.82, 14)); gg.stroke(); }
      poly(g, [P(0.35, 0.82, 0), P(0.6, 0.82, 0), P(0.6, 0.82, 9), P(0.35, 0.82, 9)], '#6b6f75');
      box(a, 0.62, 0.86, 0.9, 0.98, 0, 5, '#e05d2c'); // вантажівка
    } else if (lvl === 2) {
      // цех із «пилкою» на даху й трубою
      box(a, 0.1, 0.15, 0.9, 0.85, 0, 16, '#b8afa0');
      for (let k = 0; k < 4; k++) { const u0 = 0.1 + k * 0.2; poly(g, [P(u0, 0.15, 16), P(u0, 0.85, 16), P(u0 + 0.2, 0.85, 22), P(u0 + 0.2, 0.15, 22)], '#8f877a', 'rgba(0,0,0,.2)'); poly(g, [P(u0 + 0.2, 0.15, 16), P(u0 + 0.2, 0.85, 16), P(u0 + 0.2, 0.85, 22), P(u0 + 0.2, 0.15, 22)], '#9fc2db'); }
      box(a, 0.72, 0.22, 0.84, 0.34, 16, 26, '#9a5a44');
      windows(a, 'L', 0.1, 0.15, 0.9, 0.85, 2, 9, 1, 5, { seed: v, color: '#ffd27a', lit: 0.9, glare: false });
    } else {
      // велике виробництво: резервуари й дві труби
      box(a, 0.08, 0.3, 0.6, 0.92, 0, 20, '#a9a196');
      windows(a, 'L', 0.08, 0.3, 0.6, 0.92, 3, 12, 1, 4, { seed: v, color: '#ffd27a', lit: 0.9, glare: false });
      for (const [u, vv] of [[0.78, 0.35], [0.78, 0.68]]) { const [x, y] = P(u, vv, 0); g.fillStyle = '#c9ccd1'; g.fillRect(x - 6, y - 16, 12, 16); g.fillStyle = '#e3e6ea'; g.beginPath(); g.ellipse(x, y - 16, 6, 3, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#9da3ab'; g.beginPath(); g.ellipse(x, y, 6, 3, 0, 0, Math.PI); g.fill(); }
      box(a, 0.15, 0.12, 0.26, 0.23, 20, 34, '#8c4b3a'); box(a, 0.36, 0.12, 0.47, 0.23, 20, 28, '#8c4b3a');
      [[0.205, 0.175, 54], [0.415, 0.175, 48]].forEach(([u, vv, z]) => { const [x, y] = P(u, vv, z); g.fillStyle = '#fff'; g.fillRect(x - 2, y + 4, 4, 2); });
    }
  }));
}
// Точки, звідки йде дим (у пікселях спрайта, відносно верхнього кута клітинки)
export function chimneys(kind, lvl, ht) {
  if (kind === 'I' && !ht) return lvl === 2 ? [[0.78, 0.28, 42]] : lvl >= 3 ? [[0.205, 0.175, 54], [0.415, 0.175, 48]] : [];
  return [];
}

/* ═════════ СЛУЖБИ Й СТАНЦІЇ ═════════ */
export function buildingSprite(type) {
  const S = { townhall: 2, coal: 3, gas: 2, wind: 1, solar: 2, nuclear: 3, school: 2, lyceum: 2, uni: 3, library: 1, clinic: 1, hospital: 2, police: 1, fire: 1, depot: 2, stop: 1, metro: 1, bikes: 1, park: 1, bigpark: 2, plaza: 2, recycle: 2, landfill: 3, stadium: 3 }[type] || 1;
  const top = { townhall: 70, coal: 90, gas: 60, wind: 10, solar: 20, nuclear: 110, school: 46, lyceum: 52, uni: 80, library: 30, clinic: 30, hospital: 70, police: 32, fire: 34, depot: 30, stop: 16, metro: 26, bikes: 14, park: 26, bigpark: 30, plaza: 40, recycle: 40, landfill: 24, stadium: 56 }[type] || 40;
  return get(`B_${type}`, () => sprite(S, top, a => DRAW[type]?.(a, S)));
}
const flag = (a, u, v, z, c1 = '#0057b7', c2 = '#ffd700') => { const { g, P } = a, [x, y] = P(u, v, z); g.strokeStyle = '#555'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 14); g.stroke(); g.fillStyle = c1; g.fillRect(x, y - 14, 8, 2.6); g.fillStyle = c2; g.fillRect(x, y - 11.4, 8, 2.6); };
const lawn = (a, S, c = '#8ec46a') => diamond(a, 0, 0, S, S, 0, c, null, true);
const pave = (a, S) => diamond(a, 0, 0, S, S, 0, '#d4cfc4', null, true);
const DRAW = {
  townhall(a, S) {
    pave(a, S); const { g, P } = a;
    box(a, 0.25, 0.3, 1.75, 1.7, 0, 30, '#efe7d6');
    windows(a, 'R', 0.25, 0.3, 1.75, 1.7, 0, 30, 3, 6, { seed: 3, color: '#9cc0dc', lit: 0.7 });
    windows(a, 'L', 0.25, 0.3, 1.75, 1.7, 0, 30, 3, 6, { seed: 4, color: '#9cc0dc', lit: 0.7 });
    for (let k = 0; k < 5; k++) box(a, 0.4 + k * 0.28, 1.7, 0.47 + k * 0.28, 1.77, 0, 22, '#fffaf0');
    poly(g, [P(0.25, 1.7, 22), P(1.75, 1.7, 22), P(1, 1.85, 32)], '#e6dcc7', 'rgba(0,0,0,.2)');
    box(a, 0.75, 0.75, 1.25, 1.25, 30, 16, '#efe7d6'); // вежа з годинником
    const [x, y] = P(1.25, 1, 40); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x - 3, y, 3, 3.6, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#333'; g.lineWidth = 0.6; g.stroke();
    gable(a, 0.72, 0.72, 1.28, 1.28, 46, 10, '#3b7a57');
    flag(a, 1, 1, 56);
    treeAt(a, 0.15, 1.85, 0.6, 1); treeAt(a, 1.85, 0.15, 0.6, 2);
  },
  coal(a, S) {
    diamond(a, 0, 0, S, S, 0, '#8e887d'); const { g, P } = a;
    box(a, 0.2, 1.2, 1.9, 2.8, 0, 26, '#8b7d6b');
    windows(a, 'L', 0.2, 1.2, 1.9, 2.8, 4, 16, 2, 6, { seed: 2, color: '#ffcf7a', lit: 0.9, glare: false });
    // градирні
    for (const [u, v] of [[0.8, 0.6], [1.9, 0.6]]) { const [x, y] = P(u, v, 0); const gr = g.createLinearGradient(x - 14, 0, x + 14, 0); gr.addColorStop(0, '#9aa0a6'); gr.addColorStop(0.5, '#d6d9dc'); gr.addColorStop(1, '#8a9096'); g.fillStyle = gr; g.beginPath(); g.moveTo(x - 15, y); g.quadraticCurveTo(x - 8, y - 22, x - 10, y - 42); g.lineTo(x + 10, y - 42); g.quadraticCurveTo(x + 8, y - 22, x + 15, y); g.closePath(); g.fill(); g.fillStyle = '#5f646a'; g.beginPath(); g.ellipse(x, y - 42, 10, 4, 0, 0, Math.PI * 2); g.fill(); }
    box(a, 2.3, 1.6, 2.55, 1.85, 26, 50, '#7a3d32');
    for (let k = 0; k < 3; k++) { const [x, y] = P(2.425, 1.725, 40 + k * 10); g.fillStyle = '#fff'; g.fillRect(x - 2.5, y, 5, 2); }
    // вугілля
    const [cx, cy] = P(2.5, 2.6, 0); g.fillStyle = '#2b2b2b'; g.beginPath(); g.ellipse(cx, cy - 3, 12, 5, 0, Math.PI, 0); g.fill();
  },
  gas(a, S) {
    diamond(a, 0, 0, S, S, 0, '#9e9a92'); const { g, P } = a;
    box(a, 0.15, 0.9, 1.3, 1.85, 0, 20, '#c9c7c0'); windows(a, 'L', 0.15, 0.9, 1.3, 1.85, 3, 12, 1, 4, { seed: 5, color: '#ffd27a', lit: 0.9, glare: false });
    for (const [u, v] of [[0.6, 0.45], [1.45, 0.5]]) { const [x, y] = P(u, v, 0); g.fillStyle = '#dfe3e6'; g.fillRect(x - 8, y - 14, 16, 14); g.fillStyle = '#f3f5f6'; g.beginPath(); g.ellipse(x, y - 14, 8, 4, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#1d6fb8'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 8, y - 6); g.lineTo(x + 8, y - 6); g.stroke(); }
    box(a, 1.55, 1.3, 1.72, 1.47, 20, 30, '#b0b4b8');
  },
  wind(a) { const { g, P } = a; diamond(a, 0, 0, 1, 1, 0, '#86bd62', null, true); const [x, y] = P(0.5, 0.5, 0); g.fillStyle = '#c8ccd0'; g.beginPath(); g.ellipse(x, y, 4, 2, 0, 0, Math.PI * 2); g.fill(); },
  solar(a, S) {
    lawn(a, S, '#9ccc7c'); const { g, P } = a;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) { const u0 = 0.15 + c * 0.9, v0 = 0.15 + r * 0.45; poly(g, [P(u0, v0, 4), P(u0 + 0.8, v0, 4), P(u0 + 0.8, v0 + 0.3, 8), P(u0, v0 + 0.3, 8)], '#24427a', 'rgba(170,200,255,.6)'); g.strokeStyle = 'rgba(170,200,255,.35)'; g.lineWidth = 0.4; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(...P(u0 + k * 0.16, v0, 4)); g.lineTo(...P(u0 + k * 0.16, v0 + 0.3, 8)); g.stroke(); } }
  },
  nuclear(a, S) {
    diamond(a, 0, 0, S, S, 0, '#a6a29a'); const { g, P } = a;
    const [x, y] = P(1, 1, 0); g.fillStyle = '#e8ebee'; g.fillRect(x - 18, y - 30, 36, 30); g.fillStyle = '#f4f6f8'; g.beginPath(); g.ellipse(x, y - 30, 18, 14, 0, Math.PI, 0); g.fill(); g.strokeStyle = 'rgba(0,0,0,.2)'; g.stroke();
    for (const [u, v] of [[2.2, 0.8], [2.2, 2.0]]) { const [cx, cy] = P(u, v, 0); const gr = g.createLinearGradient(cx - 16, 0, cx + 16, 0); gr.addColorStop(0, '#a3a9af'); gr.addColorStop(0.5, '#e2e5e8'); gr.addColorStop(1, '#9298a0'); g.fillStyle = gr; g.beginPath(); g.moveTo(cx - 17, cy); g.quadraticCurveTo(cx - 9, cy - 26, cx - 11, cy - 50); g.lineTo(cx + 11, cy - 50); g.quadraticCurveTo(cx + 9, cy - 26, cx + 17, cy); g.closePath(); g.fill(); }
    box(a, 0.3, 1.9, 1.6, 2.8, 0, 18, '#d5d2c9'); windows(a, 'L', 0.3, 1.9, 1.6, 2.8, 3, 10, 1, 5, { seed: 8, color: '#9cc0dc', lit: 0.8 });
    const [sx, sy] = P(1.2, 2.5, 20); g.fillStyle = '#facc15'; g.beginPath(); g.arc(sx, sy, 3, 0, Math.PI * 2); g.fill();
  },
  school(a, S) {
    lawn(a, S); const { g, P } = a;
    box(a, 0.2, 0.25, 1.35, 1.55, 0, 22, '#f2c46d');
    windows(a, 'R', 0.2, 0.25, 1.35, 1.55, 0, 22, 2, 5, { seed: 2, color: '#a4cbe8', lit: 0.4 });
    windows(a, 'L', 0.2, 0.25, 1.35, 1.55, 0, 22, 2, 4, { seed: 3, color: '#a4cbe8', lit: 0.4 });
    gable(a, 0.17, 0.22, 1.38, 1.58, 22, 8, '#b5523b');
    // стадіончик
    poly(g, [P(1.45, 0.2, 0), P(1.9, 0.2, 0), P(1.9, 1.8, 0), P(1.45, 1.8, 0)], '#c86a43'); poly(g, [P(1.55, 0.35, 0), P(1.8, 0.35, 0), P(1.8, 1.65, 0), P(1.55, 1.65, 0)], '#4d9c47');
    flag(a, 0.7, 1.75, 0); person(a, 1.2, 1.8, '#ef4444'); person(a, 1.3, 1.85, '#3b82f6'); person(a, 1.62, 1, '#facc15');
  },
  lyceum(a, S) {
    lawn(a, S); box(a, 0.15, 0.2, 1.85, 1.3, 0, 30, '#e6b8a2'); windows(a, 'R', 0.15, 0.2, 1.85, 1.3, 0, 30, 3, 4, { seed: 4, color: '#a4cbe8', lit: 0.4 }); windows(a, 'L', 0.15, 0.2, 1.85, 1.3, 0, 30, 3, 7, { seed: 5, color: '#a4cbe8', lit: 0.4 });
    box(a, 0.8, 1.3, 1.2, 1.45, 0, 24, '#f4ead9'); flag(a, 1.6, 1.7, 0); treeAt(a, 0.3, 1.75, 0.6, 1); treeAt(a, 1.1, 1.8, 0.6, 3);
  },
  uni(a, S) {
    lawn(a, S, '#93c771'); const { g, P } = a;
    box(a, 0.3, 0.3, 2.7, 1.4, 0, 34, '#e9e2d3'); windows(a, 'R', 0.3, 0.3, 2.7, 1.4, 0, 34, 3, 4, { seed: 6, color: '#9cc0dc', lit: 0.5 }); windows(a, 'L', 0.3, 0.3, 2.7, 1.4, 0, 34, 3, 10, { seed: 7, color: '#9cc0dc', lit: 0.5 });
    for (let k = 0; k < 6; k++) box(a, 0.8 + k * 0.25, 1.4, 0.86 + k * 0.25, 1.46, 0, 26, '#fffaf0');
    box(a, 1.2, 0.6, 1.8, 1.2, 34, 18, '#e9e2d3');
    const [x, y] = P(1.5, 0.9, 52); g.fillStyle = '#4a7c9d'; g.beginPath(); g.ellipse(x, y, 13, 10, 0, Math.PI, 0); g.fill();
    box(a, 0.3, 1.8, 1.2, 2.7, 0, 22, '#d9cdb8'); windows(a, 'L', 0.3, 1.8, 1.2, 2.7, 0, 22, 2, 4, { seed: 9, color: '#9cc0dc', lit: 0.5 });
    for (const [u, v] of [[2, 2], [2.5, 2.4], [1.6, 2.5], [2.6, 1.8]]) treeAt(a, u, v, 0.7, Math.round(u * 3));
    person(a, 1.8, 2.1, '#6366f1'); person(a, 2.2, 2.6, '#ec4899');
  },
  library(a) { lawn(a, 1); box(a, 0.15, 0.2, 0.85, 0.85, 0, 16, '#cfa77d'); windows(a, 'L', 0.15, 0.2, 0.85, 0.85, 0, 16, 1, 3, { seed: 1, color: '#ffe7a6', lit: 0.9 }); windows(a, 'R', 0.15, 0.2, 0.85, 0.85, 0, 16, 1, 3, { seed: 2, color: '#ffe7a6', lit: 0.9 }); gable(a, 0.12, 0.17, 0.88, 0.88, 16, 7, '#4f6d7a'); },
  clinic(a) { pave(a, 1); const { g, P } = a; box(a, 0.15, 0.15, 0.85, 0.85, 0, 16, '#f7f7f7'); windows(a, 'R', 0.15, 0.15, 0.85, 0.85, 0, 16, 2, 3, { seed: 3, color: '#a4cbe8', lit: 0.8 }); windows(a, 'L', 0.15, 0.15, 0.85, 0.85, 0, 16, 2, 3, { seed: 4, color: '#a4cbe8', lit: 0.8 }); const [x, y] = P(0.5, 0.5, 16); g.fillStyle = '#e11d48'; g.fillRect(x - 4, y - 1.5, 8, 3); g.fillRect(x - 1.5, y - 4, 3, 8); },
  hospital(a, S) {
    pave(a, S); const { g, P } = a;
    box(a, 0.2, 0.2, 1.8, 1.3, 0, 46, '#f5f6f7'); windows(a, 'R', 0.2, 0.2, 1.8, 1.3, 0, 46, 6, 4, { seed: 5, color: '#a4cbe8', lit: 0.8 }); windows(a, 'L', 0.2, 0.2, 1.8, 1.3, 0, 46, 6, 7, { seed: 6, color: '#a4cbe8', lit: 0.8 });
    box(a, 0.2, 1.3, 1.1, 1.8, 0, 18, '#eef0f2'); windows(a, 'L', 0.2, 1.3, 1.1, 1.8, 0, 18, 2, 4, { seed: 7, color: '#a4cbe8', lit: 0.8 });
    const [x, y] = P(1, 0.75, 46); a.g.fillStyle = '#e11d48'; a.g.beginPath(); a.g.ellipse(x, y, 9, 4.5, 0, 0, Math.PI * 2); a.g.fill(); a.g.fillStyle = '#fff'; a.g.font = 'bold 7px sans-serif'; a.g.textAlign = 'center'; a.g.fillText('H', x, y + 2.5);
    box(a, 1.4, 1.5, 1.8, 1.75, 0, 7, '#f8fafc'); poly(g, [P(1.4, 1.75, 4), P(1.8, 1.75, 4), P(1.8, 1.75, 6), P(1.4, 1.75, 6)], '#e11d48');
  },
  police(a) { pave(a, 1); box(a, 0.15, 0.15, 0.85, 0.85, 0, 18, '#dbe4f0'); windows(a, 'R', 0.15, 0.15, 0.85, 0.85, 0, 18, 2, 3, { seed: 2, color: '#a4cbe8', lit: 0.8 }); windows(a, 'L', 0.15, 0.15, 0.85, 0.85, 0, 18, 2, 3, { seed: 3, color: '#a4cbe8', lit: 0.8 }); box(a, 0.15, 0.85, 0.85, 0.87, 13, 4, '#1e3a8a', { noTop: true }); box(a, 0.6, 0.9, 0.85, 1, 0, 4, '#f8fafc'); const { l, P } = a; a.lit = true; l.fillStyle = '#3b82f6'; const [x, y] = P(0.72, 0.95, 5); l.beginPath(); l.arc(x, y, 2.4, 0, Math.PI * 2); l.fill(); },
  fire(a) { pave(a, 1); const { g, P } = a; box(a, 0.12, 0.12, 0.88, 0.88, 0, 20, '#c0392b'); poly(g, [P(0.25, 0.88, 0), P(0.75, 0.88, 0), P(0.75, 0.88, 13), P(0.25, 0.88, 13)], '#3f3f46'); for (let k = 1; k < 4; k++) { g.strokeStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.moveTo(...P(0.25, 0.88, k * 3.2)); g.lineTo(...P(0.75, 0.88, k * 3.2)); g.stroke(); } windows(a, 'R', 0.12, 0.12, 0.88, 0.88, 10, 10, 1, 3, { seed: 4, color: '#ffe0a6', lit: 0.9 }); box(a, 0.14, 0.14, 0.3, 0.3, 20, 10, '#a93226'); },
  depot(a, S) { pave(a, S); const { g, P } = a; box(a, 0.2, 0.2, 1.8, 1.2, 0, 18, '#e2e8f0'); for (let k = 0; k < 4; k++) poly(g, [P(0.3 + k * 0.38, 1.2, 0), P(0.6 + k * 0.38, 1.2, 0), P(0.6 + k * 0.38, 1.2, 12), P(0.3 + k * 0.38, 1.2, 12)], '#475569'); for (let k = 0; k < 3; k++) box(a, 0.3 + k * 0.5, 1.4, 0.68 + k * 0.5, 1.8, 0, 7, '#f59e0b'); },
  stop(a) { const { g, P } = a; diamond(a, 0, 0, 1, 1, 0, '#d4cfc4'); box(a, 0.3, 0.45, 0.8, 0.6, 0, 9, '#7dd3fc', { top: '#e2e8f0' }); const [x, y] = P(0.2, 0.75, 0); g.strokeStyle = '#334155'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 12); g.stroke(); g.fillStyle = '#f59e0b'; g.beginPath(); g.arc(x, y - 12, 2.4, 0, Math.PI * 2); g.fill(); person(a, 0.55, 0.75, '#22c55e'); },
  metro(a) { pave(a, 1); const { g, P } = a; box(a, 0.2, 0.2, 0.8, 0.8, 0, 8, '#e5e7eb'); poly(g, [P(0.32, 0.8, 0), P(0.68, 0.8, 0), P(0.68, 0.8, 6), P(0.32, 0.8, 6)], '#1f2937'); const [x, y] = P(0.5, 0.5, 8); g.strokeStyle = '#334155'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 12); g.stroke(); g.fillStyle = '#ef4444'; g.beginPath(); g.arc(x, y - 14, 4, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 6px sans-serif'; g.textAlign = 'center'; g.fillText('M', x, y - 12); },
  bikes(a) { const { g, P } = a; diamond(a, 0, 0, 1, 1, 0, '#d4cfc4'); for (let k = 0; k < 4; k++) { const [x, y] = P(0.25 + k * 0.15, 0.5, 0); g.strokeStyle = '#16a34a'; g.lineWidth = 0.8; g.beginPath(); g.arc(x - 2, y - 2, 1.8, 0, Math.PI * 2); g.arc(x + 2.5, y - 2, 1.8, 0, Math.PI * 2); g.stroke(); } box(a, 0.15, 0.75, 0.85, 0.85, 0, 2, '#16a34a'); },
  park(a) { lawn(a, 1, '#79c05a'); const { g, P } = a; poly(g, [P(0.45, 0, 0), P(0.55, 0, 0), P(0.55, 1, 0), P(0.45, 1, 0)], '#e3d7b8'); treeAt(a, 0.25, 0.3, 0.75, 1); treeAt(a, 0.75, 0.7, 0.8, 2); treeAt(a, 0.25, 0.8, 0.6, 3); const [x, y] = P(0.75, 0.25, 0); g.fillStyle = '#8b5e34'; g.fillRect(x - 3, y - 2, 6, 1.5); },
  bigpark(a, S) {
    lawn(a, S, '#79c05a'); const { g, P } = a;
    poly(g, [P(0.9, 0, 0), P(1.1, 0, 0), P(1.1, 2, 0), P(0.9, 2, 0)], '#e3d7b8'); poly(g, [P(0, 0.9, 0), P(2, 0.9, 0), P(2, 1.1, 0), P(0, 1.1, 0)], '#e3d7b8');
    const [x, y] = P(1, 1, 0); g.fillStyle = '#cfd8dc'; g.beginPath(); g.ellipse(x, y, 12, 6, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#4fb3e8'; g.beginPath(); g.ellipse(x, y, 9.5, 4.6, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#e0f2fe'; g.fillRect(x - 1, y - 8, 2, 8);
    for (const [u, v] of [[0.3, 0.3], [0.5, 0.6], [1.6, 0.4], [1.4, 0.7], [0.4, 1.6], [0.7, 1.4], [1.6, 1.6], [1.3, 1.5]]) treeAt(a, u, v, 0.75, Math.round(u * 5 + v));
    person(a, 1.05, 0.5, '#f43f5e'); person(a, 0.5, 1.05, '#0ea5e9'); lamp(a, 1.15, 1.6);
  },
  plaza(a, S) {
    diamond(a, 0, 0, S, S, 0, '#e2d6c3'); const { g, P } = a;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2) poly(g, [P(c / 4, r / 4, 0), P((c + 1) / 4, r / 4, 0), P((c + 1) / 4, (r + 1) / 4, 0), P(c / 4, (r + 1) / 4, 0)], '#d6c8b2');
    box(a, 0.85, 0.85, 1.15, 1.15, 0, 6, '#bfb6a6'); box(a, 0.92, 0.92, 1.08, 1.08, 6, 24, '#d8cfbf'); const [x, y] = P(1, 1, 30); g.fillStyle = '#c9a227'; g.beginPath(); g.arc(x, y - 3, 3, 0, Math.PI * 2); g.fill();
    for (const [u, v] of [[0.2, 0.2], [1.8, 0.2], [0.2, 1.8], [1.8, 1.8]]) treeAt(a, u, v, 0.6, 2);
    for (let k = 0; k < 6; k++) person(a, 0.4 + (k * 0.27) % 1.3, 0.5 + (k * 0.41) % 1.2, SIGNS[k]);
    lamp(a, 0.5, 1.5); lamp(a, 1.5, 0.5);
  },
  recycle(a, S) { pave(a, S); box(a, 0.2, 0.3, 1.6, 1.4, 0, 20, '#4b8b5a'); windows(a, 'L', 0.2, 0.3, 1.6, 1.4, 3, 10, 1, 4, { seed: 2, color: '#ffe0a6', lit: 0.8, glare: false }); const cols = ['#3b82f6', '#facc15', '#22c55e', '#9ca3af']; cols.forEach((c, k) => box(a, 0.25 + k * 0.38, 1.55, 0.5 + k * 0.38, 1.8, 0, 6, c)); const { g, P } = a, [x, y] = P(0.9, 0.85, 20); g.strokeStyle = '#fff'; g.lineWidth = 1.4; g.beginPath(); g.arc(x, y, 4, 0.2, Math.PI * 1.7); g.stroke(); },
  landfill(a, S) { diamond(a, 0, 0, S, S, 0, '#8f8a6e'); const { g, P } = a; const r = rnd(9); for (let k = 0; k < 9; k++) { const [x, y] = P(0.4 + r() * 2.2, 0.4 + r() * 2.2, 0); g.fillStyle = ['#6b6550', '#7d6f55', '#5c5745', '#8a7a5a'][k % 4]; g.beginPath(); g.ellipse(x, y - 4, 10 + r() * 8, 5 + r() * 4, 0, Math.PI, 0); g.fill(); } for (let k = 0; k < 20; k++) { const [x, y] = P(0.3 + r() * 2.4, 0.3 + r() * 2.4, 4); g.fillStyle = SIGNS[k % 6]; g.fillRect(x, y, 1.6, 1.2); } box(a, 2.3, 2.4, 2.8, 2.7, 0, 6, '#f59e0b'); },
  stadium(a, S) {
    diamond(a, 0, 0, S, S, 0, '#c9c4b8'); const { g, P } = a, [x, y] = P(1.5, 1.5, 0);
    g.fillStyle = '#9aa3ad'; g.beginPath(); g.ellipse(x, y - 14, 58, 29, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c4cbd3'; g.beginPath(); g.ellipse(x, y - 18, 56, 27, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3f9d4a'; g.beginPath(); g.ellipse(x, y - 18, 38, 17, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(x, y - 18, 8, 4, 0, 0, Math.PI * 2); g.moveTo(x, y - 35); g.lineTo(x, y - 1); g.stroke();
    const r = rnd(4); for (let k = 0; k < 140; k++) { const t = r() * Math.PI * 2, rr = 0.78 + r() * 0.2; g.fillStyle = SIGNS[k % 6]; g.fillRect(x + Math.cos(t) * 55 * rr, y - 18 + Math.sin(t) * 26 * rr, 1.2, 1.2); }
    for (const [u, v] of [[0.2, 0.2], [2.8, 0.2], [0.2, 2.8], [2.8, 2.8]]) { const [px, py] = P(u, v, 0); g.strokeStyle = '#555'; g.lineWidth = 1; g.beginPath(); g.moveTo(px, py); g.lineTo(px, py - 46); g.stroke(); g.fillStyle = '#eee'; g.fillRect(px - 4, py - 50, 8, 4); a.lit = true; const gr = a.l.createRadialGradient(px, py - 48, 0, px, py - 48, 16); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(1, 'rgba(255,255,230,0)'); a.l.fillStyle = gr; a.l.beginPath(); a.l.arc(px, py - 48, 16, 0, Math.PI * 2); a.l.fill(); }
  },
};
// Димарі станцій (u, v, z у клітинках і пікселях)
export const B_CHIMNEYS = { coal: [[0.8, 0.6, 42, 1.4], [1.9, 0.6, 42, 1.4], [2.425, 1.725, 76, 0.8]], gas: [[1.635, 1.385, 50, 0.5]], nuclear: [[2.2, 0.8, 50, 1.6], [2.2, 2.0, 50, 1.6]], landfill: [], recycle: [] };
