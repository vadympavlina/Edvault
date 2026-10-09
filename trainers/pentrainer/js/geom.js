// Тренажер пера · геометрія: контур як список опорних точок із ручками, криві Безьє, оцінка схожості.
// Без DOM — працює і в сторінці, і в Node (тести).
//
// Контур: { anchors: [{ x, y, hin, hout }], closed }
//   hin/hout — ручки ({ x, y }) або null (без ручки — кут).

const pt = (x, y) => ({ x, y });
const copyPt = p => (p ? { x: p.x, y: p.y } : null);
export const cloneAnchors = list => list.map(a => ({ x: a.x, y: a.y, hin: copyPt(a.hin), hout: copyPt(a.hout) }));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// SVG-шлях (лише M, L, C, Z — абсолютні) → контур
export function parsePath(d) {
  const tok = String(d).match(/[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) || [];
  const anchors = [];
  let i = 0, cmd = '', closed = false;
  const num = () => parseFloat(tok[i++]);
  while (i < tok.length) {
    if (/[MLCZ]/i.test(tok[i])) cmd = tok[i++].toUpperCase();
    if (cmd === 'Z') { closed = true; continue; }
    if (cmd === 'M' || cmd === 'L') anchors.push({ x: num(), y: num(), hin: null, hout: null });
    else if (cmd === 'C') {
      const c1 = pt(num(), num()), c2 = pt(num(), num()), p = pt(num(), num());
      const prev = anchors[anchors.length - 1];
      if (prev && (c1.x !== prev.x || c1.y !== prev.y)) prev.hout = c1;
      anchors.push({ x: p.x, y: p.y, hin: c2.x === p.x && c2.y === p.y ? null : c2, hout: null });
    } else i++;
  }
  // замкнений контур, що закінчується в першій точці: зливаємо дубль
  if (closed && anchors.length > 1) {
    const a = anchors[0], b = anchors[anchors.length - 1];
    if (dist(a, b) < 0.01) { a.hin = b.hin; anchors.pop(); }
  }
  return { anchors, closed };
}

const f = v => String(Math.round(v * 10) / 10);
const P = p => f(p.x) + ' ' + f(p.y);
// контур → SVG-шлях
export function toPath(anchors, closed) {
  if (!anchors.length) return '';
  let d = 'M' + P(anchors[0]);
  const seg = (a, b) => (a.hout || b.hin) ? ' C' + P(a.hout || a) + ' ' + P(b.hin || b) + ' ' + P(b) : ' L' + P(b);
  for (let i = 1; i < anchors.length; i++) d += seg(anchors[i - 1], anchors[i]);
  if (closed && anchors.length > 1) {
    const a = anchors[anchors.length - 1], b = anchors[0];
    if (a.hout || b.hin) d += seg(a, b);
    d += ' Z';
  }
  return d;
}

// точка на кубічній кривій
const bez = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return pt(u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y);
};
// відрізки контуру: [p0, c1, c2, p3]
export function segments(anchors, closed) {
  const out = [];
  const n = anchors.length;
  for (let i = 0; i < n - 1 + (closed && n > 1 ? 1 : 0); i++) {
    const a = anchors[i], b = anchors[(i + 1) % n];
    out.push([pt(a.x, a.y), a.hout || pt(a.x, a.y), b.hin || pt(b.x, b.y), pt(b.x, b.y)]);
  }
  return out;
}
// рівномірні точки вздовж контуру (приблизно через step одиниць)
export function sample(anchors, closed, step = 2) {
  const out = [];
  if (anchors.length === 1) return [pt(anchors[0].x, anchors[0].y)];
  for (const [p0, c1, c2, p3] of segments(anchors, closed)) {
    const approx = dist(p0, c1) + dist(c1, c2) + dist(c2, p3);
    const n = Math.max(2, Math.ceil(approx / step));
    for (let k = 0; k < n; k++) out.push(bez(p0, c1, c2, p3, k / n));
  }
  if (!closed && anchors.length) { const l = anchors[anchors.length - 1]; out.push(pt(l.x, l.y)); }
  return out;
}

// найближча відстань від кожної точки a до множини b (сітка для швидкості)
function nearest(a, b, cell = 16) {
  const grid = new Map();
  const key = (x, y) => x + ',' + y;
  for (const p of b) {
    const k = key(Math.floor(p.x / cell), Math.floor(p.y / cell));
    (grid.get(k) || grid.set(k, []).get(k)).push(p);
  }
  return a.map(p => {
    const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell);
    let best = Infinity;
    for (let r = 0; r < 64; r++) {
      for (let x = cx - r; x <= cx + r; x++) for (let y = cy - r; y <= cy + r; y++) {
        if (r && x > cx - r && x < cx + r && y > cy - r && y < cy + r) continue; // лише край кільця
        const list = grid.get(key(x, y));
        if (list) for (const q of list) { const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2; if (d < best) best = d; }
      }
      // на кільці r знайшли — далі ближчих уже не буде (з запасом на одну клітинку)
      if (best < Infinity && Math.sqrt(best) <= r * cell) break;
    }
    return Math.sqrt(best);
  });
}
const mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))] || 0; };

// вирівнювання для «за зразком»: розмір і місце не важливі — підганяємо центр і масштаб
function normalize(points) {
  const c = pt(mean(points.map(p => p.x)), mean(points.map(p => p.y)));
  const s = Math.sqrt(mean(points.map(p => (p.x - c.x) ** 2 + (p.y - c.y) ** 2))) || 1;
  return { c, s };
}
export function alignTo(userAnchors, targetAnchors, closedU, closedT) {
  const u = normalize(sample(userAnchors, closedU, 3)), t = normalize(sample(targetAnchors, closedT, 3));
  const k = t.s / u.s;
  const map = p => (p ? pt(t.c.x + (p.x - u.c.x) * k, t.c.y + (p.y - u.c.y) * k) : null);
  return userAnchors.map(a => ({ ...map(a), hin: map(a.hin), hout: map(a.hout) }));
}

// Оцінка: наскільки контур учня збігся з фігурою.
// Рахуємо в обидва боки (чи вся фігура обведена і чи немає зайвого), середнє й «найгірші 5%».
export const STAR_LEVELS = [65, 80, 92];
export function score(target, user, opts = {}) {
  const T = sample(target.anchors, target.closed, 2);
  const U = sample(user.anchors, user.closed, 2);
  if (U.length < 2) return { accuracy: 0, stars: 0, errors: [], reason: 'Поставте хоча б дві точки' };
  const dT = nearest(T, U), dU = nearest(U, T);
  const avg = (mean(dT) + mean(dU)) / 2;
  const worst = Math.max(pct(dT, 0.95), pct(dU, 0.95));
  let accuracy = Math.round(Math.max(0, Math.min(100, 100 - avg * 3.5 - worst * 0.9)));
  let reason = '';
  if (target.closed && !user.closed) { accuracy = Math.min(accuracy, 60); reason = 'Контур не замкнено — клацніть у першу точку'; }
  let stars = STAR_LEVELS.filter(v => accuracy >= v).length;
  const ideal = target.anchors.length, used = user.anchors.length;
  const extra = used - ideal;
  const tooMany = extra > Math.max(1, Math.round(ideal * 0.25));
  if (tooMany && stars === 3) { stars = 2; reason = reason || 'Забагато точок — спробуйте обійтися меншою кількістю'; }
  // місця, де фігуру пропущено (для підсвічування)
  const errors = T.filter((p, i) => dT[i] > (opts.errorAt || 10) && i % 3 === 0);
  return { accuracy, stars, ideal, used, errors, reason, avg, worst };
}
