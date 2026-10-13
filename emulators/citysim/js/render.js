// Симулятор міста · ізометричний рендер: земля, дороги, вода, будинки, машини й автобуси, дим, вогонь,
// вітряки, день і ніч зі світлом у вікнах, хмари, анімація росту будинків, шари даних і підсвітка інструментів.
import { N, T, Z, B } from './data.js';
import { hash } from './maps.js';
import { TW, TH, SPR, groundTile, waterTile, roadTile, zoneLot, treeTile, resSprite, comSprite, indSprite, buildingSprite, chimneys, B_CHIMNEYS, shade } from './sprites.js';

const NN = N * N;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// Кольорові шкали для шарів даних
export const LAYERS = {
  poll: { t: 'Забруднення повітря', lo: 'чисто', hi: 'брудно', map: m => m.poll, max: 70, colors: ['#22c55e', '#facc15', '#ef4444', '#7f1d1d'] },
  lv: { t: 'Вартість землі', lo: 'дешево', hi: 'дорого', map: m => m.lv, max: 100, colors: ['#7c3aed', '#3b82f6', '#22c55e', '#facc15'] },
  traffic: { t: 'Затори на дорогах', lo: 'вільно', hi: 'затор', roads: true, map: m => m.cong, max: 1.4, colors: ['#22c55e', '#facc15', '#f97316', '#dc2626'] },
  happy: { t: 'Щастя жителів', lo: 'сумно', hi: 'щасливі', popOnly: true, map: m => m.happy, max: 100, colors: ['#dc2626', '#f97316', '#facc15', '#22c55e'] },
  crime: { t: 'Злочинність', lo: 'безпечно', hi: 'небезпечно', map: m => m.crime, max: 80, colors: ['#22c55e', '#facc15', '#ef4444', '#7f1d1d'] },
  power: { t: 'Електрика', lo: 'немає', hi: 'є', zonesOnly: true, map: m => m.powered, max: 1, colors: ['#ef4444', '#facc15'] },
  school: { t: 'Школи (покриття)', lo: 'далеко', hi: 'поруч', map: m => m.cov.school, max: 1, colors: ['#f1f5f9', '#a5b4fc', '#4f46e5'] },
  health: { t: 'Медицина (покриття)', lo: 'далеко', hi: 'поруч', map: m => m.cov.health, max: 1, colors: ['#f1f5f9', '#fda4af', '#e11d48'] },
  police: { t: 'Поліція (покриття)', lo: 'далеко', hi: 'поруч', map: m => m.cov.police, max: 1, colors: ['#f1f5f9', '#93c5fd', '#1d4ed8'] },
  fire: { t: 'Пожежники (покриття)', lo: 'далеко', hi: 'поруч', map: m => m.cov.fire, max: 1, colors: ['#f1f5f9', '#fdba74', '#dc2626'] },
  transit: { t: 'Громадський транспорт', lo: 'немає', hi: 'зручно', map: m => m.transit, max: 0.6, colors: ['#f1f5f9', '#fcd34d', '#f59e0b'] },
  park: { t: 'Парки й зелень', lo: 'немає', hi: 'багато', map: m => m.cov.park, max: 1, colors: ['#f1f5f9', '#86efac', '#16a34a'] },
};
const mix = (c1, c2, t) => { const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16); const f = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return `rgb(${f(16)},${f(8)},${f(0)})`; };
export function scale(colors, t) { t = clamp(t, 0, 1) * (colors.length - 1); const k = Math.min(colors.length - 2, Math.floor(t)); return mix(colors[k], colors[k + 1], t - k); }
const CAR = ['#e11d48', '#2563eb', '#f8fafc', '#111827', '#16a34a', '#f59e0b', '#64748b', '#7c3aed', '#0ea5e9', '#dc2626'];

export class Renderer {
  constructor(canvas, city) {
    this.cv = canvas; this.g = canvas.getContext('2d');
    this.lightCv = document.createElement('canvas'); this.lg = this.lightCv.getContext('2d');
    this.city = city;
    this.cam = { x: 0, y: N * TH / 2, z: 1 };
    this.tod = 11; this.layer = null; this.hover = -1; this.preview = null; this.dimOthers = false;
    this.cars = []; this.parts = []; this.anims = new Map(); this.prevLvl = null; this.clouds = [];
    this.alwaysDay = false; this.quality = 1; this.t = 0;
    for (let k = 0; k < 5; k++) this.clouds.push({ x: Math.random() * N * TW - N * TW / 2, y: Math.random() * N * TH, r: 140 + Math.random() * 180, s: 6 + Math.random() * 8 });
    this.resize();
  }
  setCity(c) { this.city = c; this.cars = []; this.parts = []; this.anims.clear(); this.prevLvl = null; this.center(); }
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1), r = this.cv.getBoundingClientRect();
    this.W = r.width; this.H = r.height; this.dpr = dpr;
    for (const c of [this.cv, this.lightCv]) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
  }
  center(x, y) { const [cx, cy] = x != null ? [x, y] : this.city.m?.center || [N / 2, N / 2]; this.cam.x = (cx - cy) * TW / 2; this.cam.y = (cx + cy) * TH / 2; }
  // світ ↔ екран
  w2s(wx, wy) { const z = this.cam.z; return [(wx - this.cam.x) * z + this.W / 2, (wy - this.cam.y) * z + this.H / 2]; }
  tileTop(x, y) { return this.w2s((x - y) * TW / 2, (x + y) * TH / 2); }
  s2tile(sx, sy) {
    const z = this.cam.z, wx = (sx - this.W / 2) / z + this.cam.x, wy = (sy - this.H / 2) / z + this.cam.y;
    const fx = (wx / (TW / 2) + wy / (TH / 2)) / 2, fy = (wy / (TH / 2) - wx / (TW / 2)) / 2;
    return [Math.floor(fx), Math.floor(fy), fx, fy];
  }
  zoomAt(f, sx = this.W / 2, sy = this.H / 2) {
    const z0 = this.cam.z, z1 = clamp(z0 * f, 0.35, 2.4); if (z1 === z0) return;
    const wx = (sx - this.W / 2) / z0 + this.cam.x, wy = (sy - this.H / 2) / z0 + this.cam.y;
    this.cam.z = z1; this.cam.x = wx - (sx - this.W / 2) / z1; this.cam.y = wy - (sy - this.H / 2) / z1;
  }
  pan(dx, dy) { this.cam.x -= dx / this.cam.z; this.cam.y -= dy / this.cam.z; const lim = N * TW / 2; this.cam.x = clamp(this.cam.x, -lim, lim); this.cam.y = clamp(this.cam.y, -TH * 4, N * TH + TH * 4); }
  get night() { if (this.alwaysDay) return 0; const h = this.tod; return h < 5 ? 1 : h < 7.5 ? 1 - (h - 5) / 2.5 : h < 18.5 ? 0 : h < 21 ? (h - 18.5) / 2.5 : 1; }

  /* ═════════ кадр ═════════ */
  frame(dt) {
    this.t += dt;
    const c = this.city, s = c.s, M = c.m; if (!M) return;
    const g = this.g, dpr = this.dpr, z = this.cam.z, night = this.night;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.trackGrowth();
    // тло
    const bg = g.createLinearGradient(0, 0, 0, this.H); bg.addColorStop(0, night > 0.5 ? '#0b1530' : '#bfe3f7'); bg.addColorStop(1, night > 0.5 ? '#13254a' : '#e6f4fb');
    g.fillStyle = bg; g.fillRect(0, 0, this.W, this.H);
    this.drawPlatform(g);
    // видимі клітинки
    const [x0] = this.s2tile(0, 0), [, y1] = this.s2tile(0, this.H), [x1] = this.s2tile(this.W, this.H), [, y0] = this.s2tile(this.W, 0);
    const pad = 4, minD = Math.max(0, this.s2tile(0, -40)[0] + this.s2tile(0, -40)[1] - pad), maxD = Math.min(2 * N - 2, this.s2tile(this.W, this.H + 260 * z)[0] + this.s2tile(this.W, this.H + 260 * z)[1] + pad);
    const lx = Math.max(0, x0 - pad), hx = Math.min(N - 1, x1 + pad), ly = Math.max(0, y0 - pad), hy = Math.min(N - 1, y1 + pad);
    const vis = []; for (let d = minD; d <= maxD; d++) for (let x = Math.max(lx, d - hy); x <= Math.min(hx, d - ly); x++) vis.push(d - x === undefined ? 0 : (d - x) * N + x);
    this.vis = vis;
    const L = this.layer && LAYERS[this.layer], frameW = Math.floor(this.t * 2.2) % 4;
    // 1) земля
    for (const i of vis) {
      const x = i % N, y = (i / N) | 0, [sx, sy] = this.tileTop(x, y), ter = s.ter[i];
      if (s.road[i]) this.blit(roadTile(this.mask(i, j => s.road[j]), s.road[i] === 2, ter === T.WATER), sx, sy);
      else if (ter === T.WATER) this.blit(waterTile(this.mask(i, j => s.ter[j] !== T.WATER && !s.road[j]), frameW), sx, sy);
      else if (ter === T.SAND) this.blit(groundTile('sand', i % 3), sx, sy);
      else if (!s.bid[i]) this.blit(groundTile('grass', Math.floor(hash(i, 1) * 8)), sx, sy);
      if (s.zone[i] && !s.lvl[i] && !s.aban[i] && !s.bid[i]) this.blit(zoneLot(s.zone[i]), sx, sy);
      if (L && !L.roads && !(L.popOnly && !M.pop[i]) && !(L.zonesOnly && !s.zone[i]) && ter !== T.WATER && !s.road[i]) this.tint(sx, sy, scale(L.colors, L.map(M)[i] / L.max), 0.62);
      if (L?.roads && s.road[i]) this.tint(sx, sy, scale(L.colors, M.cong[i] / L.max), 0.75);
    }
    // 2) об’єкти за глибиною
    const lg = this.lg, doLights = night > 0.04;
    if (doLights) { lg.setTransform(1, 0, 0, 1, 0, 0); lg.clearRect(0, 0, this.lightCv.width, this.lightCv.height); lg.setTransform(dpr, 0, 0, dpr, 0, 0); }
    const carsAt = new Map(); for (const car of this.cars) { const k = car.a; (carsAt.get(k) || carsAt.set(k, []).get(k)).push(car); }
    const dim = L ? 0.55 : 1;
    for (const i of vis) {
      const x = i % N, y = (i / N) | 0, [sx, sy] = this.tileTop(x, y);
      if (s.ter[i] === T.TREE && !s.road[i] && !s.bid[i] && !s.zone[i]) this.obj(treeTile(Math.floor(hash(i, 2) * 6)), sx, sy, doLights, dim, this.sway(i));
      if (s.zone[i] && (s.lvl[i] || s.aban[i])) {
        const lvl = s.lvl[i] || 1, v = Math.floor(hash(i, 3) * 6);
        const spr = s.zone[i] === Z.R ? resSprite(lvl, v) : s.zone[i] === Z.C ? comSprite(lvl, v) : indSprite(Math.min(lvl, s.ht[i] ? 4 : 3), v, s.ht[i]);
        const an = this.anims.get(i), grow = an ? clamp((this.t - an) / 1.1, 0, 1) : 1;
        const lit = doLights && !s.aban[i] && M.powered[i];
        this.obj(spr, sx, sy, lit, s.aban[i] ? 0.85 : dim, 0, grow, s.aban[i]);
        if (grow < 1 && Math.random() < 0.3) this.puff(sx, sy + TH / 2 * z, '#d6cdbd', 0.6);
        if (!s.aban[i] && s.zone[i] === Z.I && s.lvl[i] >= 2 && !s.ht[i] && (night > 0.5 ? Math.random() < 0.5 : true)) for (const [u, vv, h] of chimneys('I', Math.min(lvl, 3), 0)) if (Math.random() < 0.08 * this.quality) this.smoke(x + u, y + vv, h, '#8d8d8d', 0.9);
      }
      const id = s.bid[i];
      if (id) {
        const b = s.bld[id], S = B[b.type].size;
        if (b && x === b.x + S - 1 && y === b.y + S - 1) {
          const [bx, by] = this.tileTop(b.x, b.y), spr = buildingSprite(b.type);
          this.obj(spr, bx, by, doLights && b._on !== false, dim);
          if (b.type === 'wind') this.turbine(bx, by, b);
          const ch = B_CHIMNEYS[b.type];
          if (ch && (b._util ?? 1) > 0.1) for (const [u, vv, h, k] of ch) if (Math.random() < 0.12 * k * (b._util ?? 1) * this.quality) this.smoke(b.x + u, b.y + vv, h, b.type === 'nuclear' || b.type === 'gas' ? '#f1f5f9' : '#6b6b6b', b.type === 'coal' ? 1.4 : 1.1);
        }
      }
      const cs = carsAt.get(i); if (cs) for (const car of cs) this.drawCar(car, doLights);
    }
    // 3) ефекти: дим, вогонь
    this.drawParts(dt);
    for (const f of s.fires) { const x = f.i % N, y = (f.i / N) | 0; const [sx, sy] = this.tileTop(x, y); this.flame(sx, sy + TH / 2 * z); if (Math.random() < 0.3) this.smoke(x + 0.5, y + 0.5, 20, '#4b4b4b', 1.2); }
    // 4) тіні хмар
    for (const cl of this.clouds) { cl.x += cl.s * dt; if (cl.x > N * TW / 2 + 400) cl.x = -N * TW / 2 - 400; const [cx, cy] = this.w2s(cl.x, cl.y); const gr = g.createRadialGradient(cx, cy, 0, cx, cy, cl.r * z); gr.addColorStop(0, 'rgba(20,40,60,.13)'); gr.addColorStop(1, 'rgba(20,40,60,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, cl.r * z, cl.r * z * 0.5, 0, 0, Math.PI * 2); g.fill(); }
    // 5) ніч і вогні
    if (night > 0) { g.fillStyle = `rgba(8,16,48,${0.62 * night})`; g.fillRect(0, 0, this.W, this.H); }
    if (doLights) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, night * 1.15); g.drawImage(this.lightCv, 0, 0); g.restore(); }
    // 6) значки проблем і підсвітки
    this.drawIssues(night);
    this.drawPreview();
    if (this.hover >= 0 && !this.preview) { const x = this.hover % N, y = (this.hover / N) | 0, [sx, sy] = this.tileTop(x, y); this.outline(sx, sy, 1, 'rgba(255,255,255,.9)'); }
  }
  mask(i, f) { const x = i % N; let m = 0; if (i >= N && f(i - N)) m |= 1; if (x < N - 1 && f(i + 1)) m |= 2; if (i < NN - N && f(i + N)) m |= 4; if (x > 0 && f(i - 1)) m |= 8; return m; }
  blit(spr, sx, sy) { const z = this.cam.z; this.g.drawImage(spr.day, sx - spr.ox * z, sy - spr.oy * z, spr.W * z, spr.H * z); }
  // об’єкт: денний спрайт + (уночі) його вогні з «вирізанням» того, що позаду
  obj(spr, sx, sy, lights, alpha = 1, sway = 0, grow = 1, gray = false) {
    const g = this.g, z = this.cam.z, X = sx - spr.ox * z + sway, Y = sy - spr.oy * z, W = spr.W * z, H = spr.H * z;
    if (grow < 1) { const top = Y + H * (1 - grow); g.save(); g.beginPath(); g.rect(X - 5, top, W + 10, H); g.clip(); }
    if (alpha < 1) g.globalAlpha = alpha;
    if (gray) g.filter = 'grayscale(1) brightness(.75)';
    g.drawImage(spr.day, X, Y, W, H);
    if (gray) g.filter = 'none';
    if (alpha < 1) g.globalAlpha = 1;
    if (grow < 1) g.restore();
    if (this.night > 0.04) {
      const l = this.lg; l.globalCompositeOperation = 'destination-out'; l.drawImage(spr.day, X, Y, W, H); l.globalCompositeOperation = 'source-over';
      if (lights && spr.light && grow >= 1) l.drawImage(spr.light, X, Y, W, H);
    }
  }
  sway(i) { return Math.sin(this.t * 1.3 + i) * 0.4 * this.cam.z; }
  tint(sx, sy, color, a) { const g = this.g, z = this.cam.z; g.globalAlpha = a; g.fillStyle = color; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + TW / 2 * z, sy + TH / 2 * z); g.lineTo(sx, sy + TH * z); g.lineTo(sx - TW / 2 * z, sy + TH / 2 * z); g.closePath(); g.fill(); g.globalAlpha = 1; }
  outline(sx, sy, S, color, fill) { const g = this.g, z = this.cam.z; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + S * TW / 2 * z, sy + S * TH / 2 * z); g.lineTo(sx, sy + S * TH * z); g.lineTo(sx - S * TW / 2 * z, sy + S * TH / 2 * z); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } g.strokeStyle = color; g.lineWidth = 1.5; g.stroke(); }
  drawPlatform(g) {
    const z = this.cam.z, H = 26 * z, [ax, ay] = this.tileTop(0, N), [bx, by] = this.tileTop(N, N), [cx, cy] = this.tileTop(N, 0);
    const soil = g.createLinearGradient(0, by, 0, by + H); soil.addColorStop(0, '#8a6a46'); soil.addColorStop(1, '#5d4630');
    g.fillStyle = soil; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(bx, by + H); g.lineTo(ax, ay + H); g.closePath(); g.fill();
    g.fillStyle = '#6d5238'; g.beginPath(); g.moveTo(bx, by); g.lineTo(cx, cy); g.lineTo(cx, cy + H); g.lineTo(bx, by + H); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 1; g.beginPath(); g.moveTo(ax, ay + H * 0.4); g.lineTo(bx, by + H * 0.4); g.lineTo(cx, cy + H * 0.4); g.stroke();
  }

  /* ── ріст будинків ── */
  trackGrowth() {
    const s = this.city.s; if (!this.prevLvl) { this.prevLvl = Uint8Array.from(s.lvl); return; }
    for (let i = 0; i < NN; i++) { const l = s.lvl[i]; if (l > this.prevLvl[i]) this.anims.set(i, this.t); this.prevLvl[i] = l; }
    if (this.anims.size > 200) for (const [k, t0] of this.anims) if (this.t - t0 > 1.2) this.anims.delete(k);
  }

  /* ── вітряки ── */
  turbine(bx, by, b) {
    const g = this.g, z = this.cam.z, x = bx, y = by + TH / 2 * z, top = y - 46 * z;
    g.strokeStyle = '#e5e7eb'; g.lineWidth = 2.4 * z; g.beginPath(); g.moveTo(x, y); g.lineTo(x, top); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 0.8 * z; g.beginPath(); g.moveTo(x + 1 * z, y); g.lineTo(x + 1 * z, top); g.stroke();
    const sp = (b._out || 0) > 0 ? 2.2 + hash(b.x, b.y) : 0.2, ang = this.t * sp + b.x;
    g.fillStyle = '#f8fafc'; g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 0.5;
    for (let k = 0; k < 3; k++) { const a = ang + k * Math.PI * 2 / 3; g.beginPath(); g.moveTo(x, top); g.lineTo(x + Math.cos(a - 0.08) * 6 * z, top + Math.sin(a - 0.08) * 6 * z * 0.9); g.lineTo(x + Math.cos(a) * 22 * z, top + Math.sin(a) * 22 * z * 0.9); g.lineTo(x + Math.cos(a + 0.1) * 5 * z, top + Math.sin(a + 0.1) * 5 * z * 0.9); g.closePath(); g.fill(); g.stroke(); }
    g.fillStyle = '#cbd5e1'; g.beginPath(); g.arc(x, top, 2.4 * z, 0, Math.PI * 2); g.fill();
    if (this.night > 0.04) { const l = this.lg; l.fillStyle = Math.sin(this.t * 3) > 0 ? 'rgba(255,60,60,.9)' : 'rgba(255,60,60,.25)'; l.beginPath(); l.arc(x, top - 2 * z, 1.8 * z, 0, Math.PI * 2); l.fill(); }
  }

  /* ── частинки: дим, пил ── */
  smoke(u, v, h, color, size = 1) {
    if (this.parts.length > 520) return;
    const wx = (u - v) * TW / 2, wy = (u + v) * TH / 2 - h;
    this.parts.push({ wx, wy, vx: 6 + Math.random() * 5, vy: -9 - Math.random() * 6, life: 0, max: 3.5 + Math.random() * 2.5, r: 3 * size, color });
  }
  puff(sx, sy, color, size) {
    if (this.parts.length > 520) return;
    const z = this.cam.z, wx = (sx - this.W / 2) / z + this.cam.x, wy = (sy - this.H / 2) / z + this.cam.y;
    this.parts.push({ wx: wx + (Math.random() - 0.5) * 30, wy, vx: (Math.random() - 0.5) * 12, vy: -6 - Math.random() * 6, life: 0, max: 0.9, r: 4 * size, color });
  }
  drawParts(dt) {
    const g = this.g, z = this.cam.z, keep = [];
    for (const p of this.parts) {
      p.life += dt; if (p.life > p.max) continue; keep.push(p);
      p.wx += p.vx * dt; p.wy += p.vy * dt; p.vy *= 0.995;
      const k = p.life / p.max, [x, y] = this.w2s(p.wx, p.wy), r = (p.r + k * p.r * 3) * z;
      if (x < -50 || y < -50 || x > this.W + 50 || y > this.H + 50) continue;
      g.globalAlpha = (1 - k) * 0.55; g.fillStyle = p.color; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1; this.parts = keep;
  }
  flame(sx, sy) {
    const g = this.g, z = this.cam.z;
    for (let k = 0; k < 4; k++) { const fx = sx + Math.sin(this.t * 9 + k * 2) * 5 * z + (k - 1.5) * 4 * z, h = (12 + Math.sin(this.t * 12 + k) * 5) * z; const gr = g.createLinearGradient(fx, sy, fx, sy - h); gr.addColorStop(0, 'rgba(255,90,20,.95)'); gr.addColorStop(0.6, 'rgba(255,190,40,.8)'); gr.addColorStop(1, 'rgba(255,240,150,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(fx, sy - h / 2, 3.4 * z, h / 2, 0, 0, Math.PI * 2); g.fill(); }
    if (this.night > 0.04) { const l = this.lg, gr = l.createRadialGradient(sx, sy - 8 * z, 0, sx, sy - 8 * z, 30 * z); gr.addColorStop(0, 'rgba(255,140,40,.9)'); gr.addColorStop(1, 'rgba(255,140,40,0)'); l.fillStyle = gr; l.beginPath(); l.arc(sx, sy - 8 * z, 30 * z, 0, Math.PI * 2); l.fill(); }
  }

  /* ── машини й автобуси ── */
  updateCars(dt, speed) {
    const c = this.city, s = c.s, M = c.m; if (!M) return;
    let total = 0; const roads = [];
    for (const i of this.vis || []) if (s.road[i]) { roads.push(i); total += M.load[i]; }
    const hour = this.tod, rush = (hour > 7 && hour < 10) || (hour > 17 && hour < 20) ? 1.4 : hour < 5 || hour > 23 ? 0.25 : 0.9;
    const want = Math.min(220 * this.quality, Math.round(Math.sqrt(total) * 1.7 * rush));
    // нові машини: частіше там, де більше руху
    for (let k = 0; k < 6 && this.cars.length < want && roads.length; k++) {
      const i = roads[Math.floor(Math.random() * roads.length)]; if (Math.random() * 300 > M.load[i] + 25) continue;
      const nb = this.roadNb(i); if (!nb.length) continue;
      const bus = M.hasDepot && Math.random() < 0.08 + M.transitShare * 0.25, truck = !bus && Math.random() < 0.12;
      this.cars.push({ a: i, b: nb[Math.floor(Math.random() * nb.length)], t: Math.random(), col: CAR[Math.floor(Math.random() * CAR.length)], bus, truck, life: 20 + Math.random() * 40 });
    }
    if (this.cars.length > want * 1.2) this.cars.splice(0, this.cars.length - Math.round(want * 1.2));
    const keep = [];
    for (const car of this.cars) {
      car.life -= dt; if (car.life < 0 || !s.road[car.a] || !s.road[car.b]) continue;
      const cg = M.cong[car.a] || 0, v = (car.bus ? 0.7 : 1) * 1.6 / (1 + Math.max(0, cg - 0.5) * 3) * (speed ? 1 : 0.0);
      car.t += v * dt;
      if (car.t >= 1) { const nb = this.roadNb(car.b).filter(j => j !== car.a); const nxt = nb.length ? nb[Math.floor(Math.random() * nb.length)] : car.a; car.a = car.b; car.b = nxt; car.t -= 1; }
      keep.push(car);
    }
    this.cars = keep;
  }
  roadNb(i) { const s = this.city.s, x = i % N, out = []; if (i >= N && s.road[i - N]) out.push(i - N); if (x < N - 1 && s.road[i + 1]) out.push(i + 1); if (i < NN - N && s.road[i + N]) out.push(i + N); if (x > 0 && s.road[i - 1]) out.push(i - 1); return out; }
  drawCar(car, lights) {
    const g = this.g, z = this.cam.z;
    const ax = car.a % N + 0.5, ay = ((car.a / N) | 0) + 0.5, bx = car.b % N + 0.5, by = ((car.b / N) | 0) + 0.5;
    const dx = bx - ax, dy = by - ay, u = ax + dx * car.t + dy * 0.16, v = ay + dy * car.t - dx * 0.16; // правий бік дороги
    const [sx, sy] = this.w2s((u - v) * TW / 2, (u + v) * TH / 2 - (this.city.s.ter[car.a] === T.WATER ? 2 : 0));
    const along = Math.abs(dx) > 0, len = (car.bus ? 0.36 : car.truck ? 0.28 : 0.2), wid = 0.11, hgt = car.bus ? 7 : car.truck ? 6 : 4;
    const P = (pu, pv, h) => [sx + (pu - pv) * TW / 2 * z, sy + (pu + pv) * TH / 2 * z - h * z];
    const du = along ? len / 2 : wid / 2, dv = along ? wid / 2 : len / 2;
    const col = car.bus ? '#f59e0b' : car.truck ? '#e5e7eb' : car.col;
    const quad = (pts, f) => { g.fillStyle = f; g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
    quad([P(-du, -dv, 0), P(du, -dv, 0), P(du, dv, 0), P(-du, dv, 0)].map(([x, y]) => [x + 1.5 * z, y + 1 * z]), 'rgba(0,0,0,.25)');
    quad([P(du, -dv, 0), P(du, dv, 0), P(du, dv, hgt), P(du, -dv, hgt)], shade(col, -0.15));
    quad([P(-du, dv, 0), P(du, dv, 0), P(du, dv, hgt), P(-du, dv, hgt)], shade(col, -0.32));
    quad([P(-du, -dv, hgt), P(du, -dv, hgt), P(du, dv, hgt), P(-du, dv, hgt)], car.truck ? '#cbd5e1' : shade(col, 0.15));
    if (!car.bus && !car.truck) quad([P(-du * 0.5, -dv * 0.8, hgt), P(du * 0.4, -dv * 0.8, hgt), P(du * 0.4, dv * 0.8, hgt), P(-du * 0.5, dv * 0.8, hgt)], 'rgba(30,41,59,.55)');
    if (car.bus) for (let k = 0; k < 3; k++) quad(along ? [P(-du + k * 0.11 + 0.02, dv, 3), P(-du + k * 0.11 + 0.09, dv, 3), P(-du + k * 0.11 + 0.09, dv, 6), P(-du + k * 0.11 + 0.02, dv, 6)] : [P(du, -dv + k * 0.11 + 0.02, 3), P(du, -dv + k * 0.11 + 0.09, 3), P(du, -dv + k * 0.11 + 0.09, 6), P(du, -dv + k * 0.11 + 0.02, 6)], '#1e293b');
    if (lights) { const l = this.lg, [hx, hy] = P(dx * len / 2 + dx * 0.05, dy * len / 2 + dy * 0.05, 2), gr = l.createRadialGradient(hx, hy, 0, hx, hy, 9 * z); gr.addColorStop(0, 'rgba(255,245,200,.95)'); gr.addColorStop(1, 'rgba(255,245,200,0)'); l.fillStyle = gr; l.beginPath(); l.arc(hx, hy, 9 * z, 0, Math.PI * 2); l.fill(); const [tx, ty] = P(-dx * len / 2, -dy * len / 2, 2); l.fillStyle = 'rgba(255,40,40,.8)'; l.beginPath(); l.arc(tx, ty, 1.4 * z, 0, Math.PI * 2); l.fill(); }
  }

  /* ── значки проблем над будівлями ── */
  drawIssues(night) {
    const c = this.city, s = c.s, M = c.m, g = this.g, z = this.cam.z; if (z < 0.5) return;
    const blink = Math.sin(this.t * 4) > -0.3;
    const icon = (sx, sy, kind) => {
      g.save(); g.translate(sx, sy); g.scale(z, z);
      g.fillStyle = kind === 'power' ? '#facc15' : kind === 'road' ? '#f97316' : '#ef4444'; g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1;
      g.beginPath(); g.arc(0, 0, 6.5, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#111'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(kind === 'power' ? '⚡' : kind === 'road' ? '⛟' : '!', 0, 0.5); g.restore();
    };
    if (!blink) return;
    for (const b of Object.values(s.bld)) {
      const D = B[b.type]; if (b.type === 'townhall') continue;
      const [sx, sy] = this.tileTop(b.x + D.size / 2, b.y + D.size / 2);
      if (b._road < 0 && !D.onRoad && D.cat !== 'eco') icon(sx, sy - 40 * z, 'road');
      else if (D.power < 0 && b._on === false) icon(sx, sy - 40 * z, 'power');
    }
    for (const i of this.vis || []) if (s.zone[i] && s.lvl[i] && !M.powered[i] && !s.aban[i]) { const [sx, sy] = this.tileTop(i % N + 0.5, ((i / N) | 0) + 0.5); icon(sx, sy - 30 * z, 'power'); }
  }

  /* ── підсвітка інструмента ── */
  drawPreview() {
    const p = this.preview; if (!p) return;
    const g = this.g;
    if (p.type) {
      const [sx, sy] = this.tileTop(p.x, p.y), S = B[p.type].size;
      this.outline(sx, sy, S, p.ok ? '#22c55e' : '#ef4444', p.ok ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.3)');
      g.globalAlpha = 0.6; const spr = buildingSprite(p.type), z = this.cam.z; g.drawImage(spr.day, sx - spr.ox * z, sy - spr.oy * z, spr.W * z, spr.H * z); g.globalAlpha = 1;
      if (p.r) { const [cx, cy] = this.tileTop(p.x + S / 2, p.y + S / 2), z2 = this.cam.z; g.strokeStyle = 'rgba(99,102,241,.8)'; g.setLineDash([6, 5]); g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy, p.r * TW / 2 * z2 * 1.41, p.r * TH / 2 * z2 * 1.41, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
      return;
    }
    const col = p.color || (p.ok ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)');
    for (const i of p.tiles || []) { const [sx, sy] = this.tileTop(i % N, (i / N) | 0); this.outline(sx, sy, 1, p.ok ? 'rgba(255,255,255,.8)' : 'rgba(239,68,68,.9)', col); }
  }
}
