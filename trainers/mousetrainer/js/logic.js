// Мишка й точність · розміщення цілей, перевірка рамки, зірки. Без DOM — перевіряється тестами.

// Детермінований генератор випадкових чисел (mulberry32): однаковий seed — однакове поле.
export function rng(seed = Date.now()) {
  let a = seed >>> 0;
  const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  f.shuffle = arr => { const r = [...arr]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
  return f;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const PAD = 10;

// Наступна ціль: усередині поля й не надто близько до попередньої — щоб мишку доводилося вести.
export function placeNext(W, H, size, prev, r) {
  const m = size / 2 + PAD, far = Math.min(260, (W + H) / 6);
  let best = null, bd = -1;
  for (let k = 0; k < 40; k++) {
    const p = { x: m + r() * Math.max(1, W - 2 * m), y: m + r() * Math.max(1, H - 2 * m) };
    if (!prev) return p;
    const d = dist(p, prev);
    if (d >= far) return p;
    if (d > bd) { bd = d; best = p; }
  }
  return best;
}

const inside = (p, R) => p.x >= R.x && p.x <= R.x + R.w && p.y >= R.y && p.y <= R.y + R.h;
const grow = (R, g) => ({ x: R.x - g, y: R.y - g, w: R.w + 2 * g, h: R.h + 2 * g });
export const inRect = inside;

// Нормалізує рамку, намальовану з будь-якого кута.
export const normRect = (x0, y0, x1, y1) => ({ x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) });

// Раунд «виділи рамкою»: зірки всередині прямокутника R, камінці — поза R із запасом margin.
// Отже рамка навколо зірок без жодного камінця завжди існує.
export function marqueeRound({ goods, bads, size, margin }, W, H, r) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const cols = Math.ceil(Math.sqrt(goods)), rows = Math.ceil(goods / cols);
    const rw = Math.min(W * 0.55, size * (cols * 1.7 + 0.8) * (1 + r() * 0.5));
    const rh = Math.min(H * 0.55, size * (rows * 1.7 + 0.8) * (1 + r() * 0.5));
    const R = { x: PAD + size + r() * (W - rw - 2 * (PAD + size)), y: PAD + size + r() * (H - rh - 2 * (PAD + size)), w: rw, h: rh };
    const g = [], b = [], min = size * 1.2;
    const free = p => [...g, ...b].every(q => dist(p, q) >= min);
    for (let k = 0; k < 400 && g.length < goods; k++) {
      const p = { x: R.x + size / 2 + r() * (R.w - size), y: R.y + size / 2 + r() * (R.h - size) };
      if (free(p)) g.push(p);
    }
    if (g.length < goods) continue;
    const keep = grow(R, margin + size / 2), m = size / 2 + PAD;
    for (let k = 0; k < 2000 && b.length < bads; k++) {
      // половина камінців тулиться до рамки — так завдання цікавіше
      const near = k % 2 === 0;
      const p = near
        ? { x: keep.x - size + r() * (keep.w + 2 * size), y: keep.y - size + r() * (keep.h + 2 * size) }
        : { x: m + r() * (W - 2 * m), y: m + r() * (H - 2 * m) };
      if (p.x < m || p.y < m || p.x > W - m || p.y > H - m || inside(p, keep) || !free(p)) continue;
      b.push(p);
    }
    if (b.length < bads) continue;
    return { goods: g, bads: b, rect: R };
  }
  throw new Error('marqueeRound: не вдалося розмістити');
}

// Оцінка рамки: усі зірки (за центром) усередині, жодного камінця.
export function judgeSelection(rect, goods, bads) {
  const missed = goods.map((p, i) => inside(p, rect) ? -1 : i).filter(i => i >= 0);
  const extra = bads.map((p, i) => inside(p, rect) ? i : -1).filter(i => i >= 0);
  return { ok: !missed.length && !extra.length, missed, extra };
}

// Перетягування: фігури ліворуч, контури праворуч, у сітці без перекриттів.
export function dragLayout(n, size, W, H, r) {
  const cell = size * 1.5;
  const grid = (x0, x1) => {
    const cols = Math.max(1, Math.floor((x1 - x0) / cell)), rows = Math.max(1, Math.floor((H - 2 * PAD) / cell));
    const cells = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) cells.push({ x: x0 + cell * (i + 0.5) + (x1 - x0 - cols * cell) / 2, y: PAD + cell * (j + 0.5) + (H - 2 * PAD - rows * cell) / 2 });
    return r.shuffle(cells).slice(0, n).map(c => ({ x: c.x + (r() - 0.5) * size * 0.3, y: c.y + (r() - 0.5) * size * 0.3 }));
  };
  const items = grid(PAD, W * 0.4), slots = grid(W * 0.52, W - PAD);
  if (items.length < n || slots.length < n) throw new Error('dragLayout: замале поле');
  return { items, slots };
}

export const accuracy = (hits, misses) => hits + misses ? Math.round(hits / (hits + misses) * 100) : 100;

// Зірки: швидко й майже без промахів — 3; трохи повільніше або кілька промахів — 2; інакше 1.
export function starsFor(time, misses, par) {
  if (time <= par && misses <= 1) return 3;
  if (time <= par * 1.6 && misses <= 4) return 2;
  return 1;
}
export const fmtTime = s => s < 60 ? s.toFixed(1).replace('.', ',') + ' с' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
