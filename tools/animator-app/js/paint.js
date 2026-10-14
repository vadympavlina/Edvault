// Аніматор · малювальні операції на canvas: пензлі, заливка, фігури, тонування кальки, складання кадру.

// kind: round — круглий слід змінної товщини; nib — плоске перо; air — розпилення
// size — частка від «Розміру»; press — наскільки натиск змінює товщину; taper — тоншає на кінцях; grain — фактура паперу
export const BRUSHES = {
  pencil: { t: 'Олівець', desc: 'Тонка лінія з легкою фактурою паперу', kind: 'round', size: 0.45, press: 0.35, taper: 0.4, grain: 'pencil' },
  pen: { t: 'Туш', desc: 'Гладка лінія: тоншає на кінцях і від швидкості чи натиску', kind: 'round', size: 1, press: 0.85, taper: 1 },
  marker: { t: 'Маркер', desc: 'Рівний і напівпрозорий, не темнішає на перетинах', kind: 'round', size: 1, press: 0, taper: 0, alpha: 0.5 },
  calli: { t: 'Каліграфія', desc: 'Плоске перо під кутом: товсто вниз, тонко вбік', kind: 'nib', size: 1, press: 0.5, taper: 0 },
  chalk: { t: 'Крейда', desc: 'Шорсткий слід, як крейда чи пастель', kind: 'round', size: 1, press: 0.3, taper: 0.2, grain: 'chalk' },
  air: { t: 'Аерограф', desc: 'М’яке розпилення фарби — для тіней і неба', kind: 'air', size: 1.4, press: 0.4 },
};
export const ERASERS = {
  hard: { kind: 'round', size: 1, press: 0, taper: 0 },
  soft: { kind: 'air', size: 1.2, press: 0, soft: 0.35 },
};

const hex2rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const NIB = -Math.PI / 4; // кут пера каліграфії

// Радіус сліду в точці з натиском p (0..1)
export function brushRadius(B, size, p = 0.6) {
  const base = size * B.size / 2, k = B.press ? 1 - B.press + B.press * Math.min(1.3, p * 1.25) : 1;
  return Math.max(0.5, base * k);
}

// Один штрих: згладжування кривими, крок між точками, звуження кінців, дзеркало.
// Малює в окремий контекст g (непрозоро) — прозорість і режим накладання застосовуються при складанні.
export class Stroke {
  constructor(g, B, o) {
    this.g = g; this.B = B; this.o = o; // o: { size, color, mirrorW (ширина аркуша для дзеркала або 0) }
    this.raw = []; this.spine = []; this.dist = 0;
    this.box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    this.taperLen = Math.max(4, o.size * 3);
  }
  add(pt) {
    const raw = this.raw; raw.push(pt);
    const n = raw.length;
    if (n === 1) { this.push(pt); this.flush(); return; }
    // крива через середини сусідніх відрізків — лінія гладка навіть при швидкому русі мишки
    const a = n === 2 ? raw[0] : mid(raw[n - 3], raw[n - 2]), c = raw[n - 2], b = mid(raw[n - 2], raw[n - 1]);
    this.curve(a, c, b);
    this.flush();
  }
  end() {
    const raw = this.raw, n = raw.length;
    if (n >= 2) this.curve(mid(raw[n - 2], raw[n - 1]), raw[n - 1], raw[n - 1]);
    if (this.B.taper && this.spine.length > 2) this.redraw(true); else this.flush();
  }
  curve(a, c, b) {
    const last = this.spine[this.spine.length - 1] || a;
    const len = Math.hypot(c.x - a.x, c.y - a.y) + Math.hypot(b.x - c.x, b.y - c.y);
    const step = Math.max(0.6, brushRadius(this.B, this.o.size, c.p) * (this.B.kind === 'air' ? 0.3 : 0.4));
    const n = Math.max(1, Math.ceil(len / step));
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t;
      const x = u * u * a.x + 2 * u * t * c.x + t * t * b.x, y = u * u * a.y + 2 * u * t * c.y + t * t * b.y;
      if (Math.hypot(x - last.x, y - last.y) < step * 0.5 && i < n) continue;
      this.push({ x, y, p: u * (a.p ?? 0.6) + t * (b.p ?? 0.6) });
    }
  }
  push(q) {
    const prev = this.spine[this.spine.length - 1];
    if (prev) this.dist += Math.hypot(q.x - prev.x, q.y - prev.y);
    q.d = this.dist; this.spine.push(q);
  }
  // домалювати нові точки
  flush() {
    const s = this.spine;
    for (let i = this.drawn || 0; i < s.length; i++) this.seg(s[Math.max(0, i - 1)], s[i], 1, 1);
    this.drawn = s.length;
  }
  // перемалювати весь штрих (у кінці — зі звуженням хвоста)
  redraw(withEnd) {
    const g = this.g, s = this.spine, total = this.dist;
    g.clearRect(0, 0, g.canvas.width, g.canvas.height);
    const T = Math.min(this.taperLen, total * 0.35);
    for (let i = 0; i < s.length; i++) {
      const ta = withEnd ? taperK(total - s[Math.max(0, i - 1)].d, T, this.B.taper) : 1, tb = withEnd ? taperK(total - s[i].d, T, this.B.taper) : 1;
      this.seg(s[Math.max(0, i - 1)], s[i], ta, tb);
    }
    this.drawn = s.length;
  }
  radius(q, k) {
    const T = Math.min(this.taperLen, Math.max(this.dist, 1) * 0.35);
    return brushRadius(this.B, this.o.size, q.p) * k * (this.B.taper ? taperK(q.d, T, this.B.taper) : 1);
  }
  seg(a, b, ka, kb) {
    const ra = this.radius(a, ka), rb = this.radius(b, kb);
    this.draw(a, b, ra, rb, false);
    if (this.o.mirrorW) this.draw({ x: this.o.mirrorW - a.x, y: a.y }, { x: this.o.mirrorW - b.x, y: b.y }, ra, rb, true);
  }
  draw(a, b, ra, rb, mirrored) {
    const g = this.g, B = this.B, bx = this.box, R = Math.max(ra, rb) * (B.kind === 'nib' ? 1.2 : 1) + 2;
    bx.x0 = Math.min(bx.x0, a.x - R, b.x - R); bx.y0 = Math.min(bx.y0, a.y - R, b.y - R);
    bx.x1 = Math.max(bx.x1, a.x + R, b.x + R); bx.y1 = Math.max(bx.y1, a.y + R, b.y + R);
    if (B.kind === 'air') { airSeg(g, a, b, rb, this.o.color, B.soft ?? 0.1); return; }
    g.fillStyle = this.o.color;
    if (B.kind === 'nib') {
      // плоске перо: паралелограм між двома положеннями пера
      const ang = mirrored ? Math.PI - NIB : NIB, cx = Math.cos(ang), cy = Math.sin(ang);
      // сусідні чотирикутники трохи заходять один на одного — без світлих швів
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, ex = (b.x - a.x) / d * 0.8, ey = (b.y - a.y) / d * 0.8;
      a = { x: a.x - ex, y: a.y - ey }; b = { x: b.x + ex, y: b.y + ey };
      g.beginPath();
      g.moveTo(a.x + cx * ra, a.y + cy * ra); g.lineTo(b.x + cx * rb, b.y + cy * rb);
      g.lineTo(b.x - cx * rb, b.y - cy * rb); g.lineTo(a.x - cx * ra, a.y - cy * ra);
      g.closePath(); g.fill();
      return;
    }
    capsule(g, a.x, a.y, ra, b.x, b.y, rb);
  }
}
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, p: ((a.p ?? 0.6) + (b.p ?? 0.6)) / 2 });
// звуження: 0 біля кінця → 1 на відстані T
function taperK(d, T, amount) { if (!(T > 0) || d >= T) return 1; const t = Math.max(0, d / T); return 1 - amount + amount * (0.15 + 0.85 * Math.sqrt(t)); }

// «Капсула»: два кола й дотичні між ними — відрізок змінної товщини без зазубрин
export function capsule(g, x1, y1, r1, x2, y2, r2) {
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
  g.beginPath();
  if (d <= Math.abs(r1 - r2) + 0.01) { const big = r1 > r2; g.arc(big ? x1 : x2, big ? y1 : y2, Math.max(r1, r2), 0, Math.PI * 2); g.fill(); return; }
  const a = Math.atan2(dy, dx), o = Math.acos((r1 - r2) / d);
  g.arc(x1, y1, r1, a + o, a - o + Math.PI * 2);
  g.arc(x2, y2, r2, a - o, a + o);
  g.closePath(); g.fill();
}
function airSeg(g, a, b, r, color, alpha) {
  const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / (r * 0.3))), [cr, cg, cb] = hex2rgb(color);
  for (let i = 1; i <= n; i++) {
    const x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha})`); gr.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
}

// Фактура паперу: шум, що «вигризає» частину сліду. Прив’язана до аркуша, а не до штриха — як справжній папір
const grains = {};
export function grain(kind) {
  if (grains[kind]) return grains[kind];
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  let seed = kind === 'chalk' ? 7 : 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // низькочастотний шум для крейди: сітка 16×16 з білінійною інтерполяцією
  const N = 16, lo = Array.from({ length: (N + 1) * (N + 1) }, rnd);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4, r = rnd();
    let a;
    if (kind === 'chalk') {
      const gx = x / S * N, gy = y / S * N, ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy, L = (ix2, iy2) => lo[(iy2 % N) * (N + 1) + (ix2 % N)];
      const v = (L(ix, iy) * (1 - fx) + L(ix + 1, iy) * fx) * (1 - fy) + (L(ix, iy + 1) * (1 - fx) + L(ix + 1, iy + 1) * fx) * fy;
      a = Math.min(1, Math.max(0, (r * 0.75 + v * 0.5) - 0.42) * 1.6);
    } else a = r > 0.55 ? (r - 0.55) * 1.3 : 0;
    d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = Math.round(a * 255);
  }
  g.putImageData(img, 0, 0);
  return (grains[kind] = c);
}

// Зразок пензля для меню вибору
export function sampleStroke(canvas, B, color, size) {
  const g = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  g.clearRect(0, 0, w, h);
  const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
  const st = new Stroke(tmp.getContext('2d'), B, { size, color });
  const n = 24;
  for (let i = 0; i <= n; i++) { const t = i / n; st.add({ x: 10 + t * (w - 20), y: h / 2 + Math.sin(t * Math.PI * 2) * h * 0.22, p: 0.35 + 0.6 * Math.sin(t * Math.PI) }); }
  st.end();
  if (B.grain) { const tg = tmp.getContext('2d'); tg.globalCompositeOperation = 'destination-out'; tg.fillStyle = tg.createPattern(grain(B.grain), 'repeat'); tg.fillRect(0, 0, w, h); }
  g.globalAlpha = B.alpha ?? 1; g.drawImage(tmp, 0, 0); g.globalAlpha = 1;
}

// Заливка. Маска: 1 — область кліку, 2 — облямівка під лініями (фарба лягає під антиаліасинг контуру).
// gap — закривати щілини в контурі до стількох пікселів
export function floodMask(src, w, h, x0, y0, tol = 40, gap = 0) {
  x0 |= 0; y0 |= 0;
  if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return null;
  const N = w * h, i0 = (y0 * w + x0) * 4, tr = src[i0], tg = src[i0 + 1], tb = src[i0 + 2], ta = src[i0 + 3];
  // перешкода: піксель, не схожий на точку кліку
  const bar = new Uint8Array(N);
  for (let p = 0, i = 0; p < N; p++, i += 4) {
    const a = src[i + 3];
    if (ta < 8 && a < 8) continue;
    if (Math.abs(src[i] - tr) + Math.abs(src[i + 1] - tg) + Math.abs(src[i + 2] - tb) + Math.abs(a - ta) * 1.5 > tol * 3) bar[p] = 1;
  }
  let wall = bar;
  if (gap > 0) { wall = dilate(bar, w, h, gap); if (wall[y0 * w + x0]) wall = bar; }
  const mask = new Uint8Array(N), stack = [x0, y0];
  let count = 0;
  while (stack.length) {
    const y = stack.pop(), x = stack.pop(), row = y * w;
    if (mask[row + x] || wall[row + x]) continue;
    let l = x; while (l > 0 && !mask[row + l - 1] && !wall[row + l - 1]) l--;
    let r = x; while (r < w - 1 && !mask[row + r + 1] && !wall[row + r + 1]) r++;
    let up = false, dn = false;
    for (let i = l; i <= r; i++) {
      mask[row + i] = 1; count++;
      if (y > 0) { const q = row - w + i, ok = !mask[q] && !wall[q]; if (ok && !up) stack.push(i, y - 1); up = ok; }
      if (y < h - 1) { const q = row + w + i, ok = !mask[q] && !wall[q]; if (ok && !dn) stack.push(i, y + 1); dn = ok; }
    }
  }
  // щілини закривали «потовщеним» контуром — тепер доливаємо до справжніх ліній
  if (gap > 0 && wall !== bar) grow(mask, w, h, gap + 1, p => !bar[p], 1);
  // облямівка на 2 px під лінії (лише по самих лініях, щоб не протекти за тонкий контур)
  grow(mask, w, h, 2, p => bar[p], 2);
  return { mask, count };
}
function dilate(src, w, h, r) {
  let a = src.slice(), b = new Uint8Array(a.length);
  for (let k = 0; k < r; k++) {
    b.set(a);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x; if (a[p]) continue;
      if ((x > 0 && a[p - 1]) || (x < w - 1 && a[p + 1]) || (y > 0 && a[p - w]) || (y < h - 1 && a[p + w]) ||
        (k % 2 && ((x > 0 && y > 0 && a[p - w - 1]) || (x < w - 1 && y > 0 && a[p - w + 1]) || (x > 0 && y < h - 1 && a[p + w - 1]) || (x < w - 1 && y < h - 1 && a[p + w + 1])))) b[p] = 1;
    }
    [a, b] = [b, a];
  }
  return a;
}
function grow(mask, w, h, r, ok, val) {
  for (let k = 0; k < r; k++) {
    const add = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x; if (mask[p] || !ok(p)) continue;
      if ((x > 0 && mask[p - 1]) || (x < w - 1 && mask[p + 1]) || (y > 0 && mask[p - w]) || (y < h - 1 && mask[p + w])) add.push(p);
    }
    for (const p of add) mask[p] = val;
  }
}
// Фарбування за маскою. lock — лише там, де на шарі вже є малюнок
export function paintMask(g, mask, w, h, color, lock = false) {
  const img = g.getImageData(0, 0, w, h), d = img.data, [r, gg, b] = hex2rgb(color);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let p = 0; p < mask.length; p++) {
    const m = mask[p]; if (!m) continue;
    const i = p * 4, a = d[i + 3] / 255;
    if (lock) { if (!a) continue; d[i] = r; d[i + 1] = gg; d[i + 2] = b; }
    else if (m === 1) { d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255; }
    else { d[i] = d[i] * a + r * (1 - a); d[i + 1] = d[i + 1] * a + gg * (1 - a); d[i + 2] = d[i + 2] * a + b * (1 - a); d[i + 3] = 255; }
    const x = p % w, y = (p / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  g.putImageData(img, 0, 0);
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// Фігури: line, rect, ellipse; fill — 'stroke' | 'fill'
export function drawShape(g, s, o) {
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = g.fillStyle = o.color; g.lineWidth = o.size;
  const x = Math.min(s.x1, s.x2), y = Math.min(s.y1, s.y2), w = Math.abs(s.x2 - s.x1), h = Math.abs(s.y2 - s.y1);
  g.beginPath();
  if (s.type === 'line') { g.moveTo(s.x1, s.y1); g.lineTo(s.x2, s.y2); g.stroke(); }
  else {
    if (s.type === 'rect') g.rect(x, y, w, h); else g.ellipse(x + w / 2, y + h / 2, Math.max(0.5, w / 2), Math.max(0.5, h / 2), 0, 0, Math.PI * 2);
    if (o.fill === 'fill') g.fill(); else g.stroke();
  }
  g.restore();
}

// Тонування кадру для кальки: попередні — червонуваті, наступні — зеленуваті
export function tint(dst, src, color) {
  const g = dst.getContext('2d');
  g.clearRect(0, 0, dst.width, dst.height);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, dst.width, dst.height);
  g.globalCompositeOperation = 'source-over';
}

// Напрямні уроку (контури на полотні)
export function drawGuides(g, list, z) {
  g.save();
  g.strokeStyle = 'rgba(37, 99, 235, .75)'; g.fillStyle = 'rgba(37, 99, 235, .06)';
  g.lineWidth = 2 / z; g.setLineDash([8 / z, 6 / z]);
  for (const s of list) {
    g.beginPath();
    if (s.type === 'ellipse') { g.ellipse(s.x, s.y, s.rx, s.ry, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
    else if (s.type === 'floor') { g.setLineDash([]); g.strokeStyle = 'rgba(37, 99, 235, .35)'; g.moveTo(0, s.y); g.lineTo(1e5, s.y); g.stroke(); g.setLineDash([8 / z, 6 / z]); g.strokeStyle = 'rgba(37, 99, 235, .75)'; }
    else if (s.type === 'line') { g.moveTo(s.x1, s.y1); g.lineTo(s.x2, s.y2); g.stroke(); }
    else if (s.type === 'pivot') { g.arc(s.x, s.y, 6 / z, 0, Math.PI * 2); g.stroke(); }
    else if (s.type === 'curve') { g.moveTo(s.x1, s.y1); g.quadraticCurveTo(s.cx, s.cy, s.x2, s.y2); g.stroke(); }
    else if (s.type === 'leaf') { g.ellipse(s.x + s.s * 0.8, s.y, s.s, s.s * 0.45, -0.5, 0, Math.PI * 2); g.stroke(); }
    else if (s.type === 'flower') { for (let k = 0; k < s.petals; k++) { const a = k / s.petals * Math.PI * 2; g.moveTo(s.x + Math.cos(a) * s.r * 1.4 + s.r * 0.5, s.y + Math.sin(a) * s.r * 1.4); g.ellipse(s.x + Math.cos(a) * s.r * 1.4, s.y + Math.sin(a) * s.r * 1.4, s.r * 0.5, s.r * 0.5, 0, 0, Math.PI * 2); } g.stroke(); g.beginPath(); g.arc(s.x, s.y, s.r * 0.7, 0, Math.PI * 2); g.stroke(); }
    else if (s.type === 'path') { g.setLineDash([2 / z, 8 / z]); g.moveTo(s.from[0], s.from[1]); g.quadraticCurveTo(s.from[0] + (s.to[0] - s.from[0]) * 0.75, s.from[1], s.to[0], s.to[1]); g.stroke(); g.setLineDash([8 / z, 6 / z]); }
    else if (s.type === 'rocket') {
      g.save(); g.translate(s.x, s.y); g.rotate(s.a);
      g.moveTo(s.s, 0); g.lineTo(-s.s * 0.6, -s.s * 0.35); g.lineTo(-s.s * 0.6, s.s * 0.35); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
  }
  g.restore();
}
