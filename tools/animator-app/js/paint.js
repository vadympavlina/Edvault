// Аніматор · малювальні операції на canvas: пензлі, заливка, фігури, тонування кальки, складання кадру.

export const BRUSHES = {
  pencil: { t: 'Олівець', desc: 'Тонка рівна лінія, як олівцем' },
  pen: { t: 'Пензель', desc: 'Товщина залежить від натиску й швидкості' },
  marker: { t: 'Маркер', desc: 'Напівпрозорий, не темнішає на перетинах' },
  air: { t: 'Аерограф', desc: 'М’яке розпилення фарби' },
};

const hex2rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

// Сегмент штриха. g — контекст; a, b — точки { x, y, p (натиск 0..1) }
export function strokeSeg(g, a, b, o) {
  const { brush, size, color } = o;
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (o.erase) g.globalCompositeOperation = 'destination-out';
  g.strokeStyle = g.fillStyle = o.erase ? '#000' : color;
  if (brush === 'air') {
    const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / (size * 0.25)));
    const [r, gg, bb] = hex2rgb(color);
    for (let i = 1; i <= n; i++) {
      const x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n, rad = size * (0.6 + 0.4 * (b.p ?? 0.5));
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, `rgba(${r},${gg},${bb},${o.erase ? 0.35 : 0.12})`); grad.addColorStop(1, `rgba(${r},${gg},${bb},0)`);
      g.fillStyle = grad; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
  } else {
    let wa = size, wb = size;
    if (brush === 'pen') { wa = size * width(a); wb = size * width(b); }
    if (brush === 'pencil') { wa = wb = Math.max(1, size * 0.6); }
    // сегмент змінної товщини: лінія середньої товщини + кружечки на кінцях
    g.lineWidth = (wa + wb) / 2;
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    g.beginPath(); g.arc(b.x, b.y, wb / 2, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}
// товщина пензля: натиск стилуса, а для миші — швидкість (швидко → тонше)
function width(pt) { const p = pt.p ?? 0.5; return Math.max(0.15, Math.min(1.25, 0.25 + p * 1.1)); }

// Заливка: маска з усіх точок, схожих кольором на точку кліку, + розширення на 1 px, щоб не лишалося світлої кайми біля ліній
export function floodMask(src, w, h, x0, y0, tol = 40) {
  x0 |= 0; y0 |= 0;
  if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return null;
  const i0 = (y0 * w + x0) * 4, tr = src[i0], tg = src[i0 + 1], tb = src[i0 + 2], ta = src[i0 + 3];
  const same = i => { const da = src[i + 3] - ta; if (ta < 8 && src[i + 3] < 8) return true; return Math.abs(src[i] - tr) + Math.abs(src[i + 1] - tg) + Math.abs(src[i + 2] - tb) + Math.abs(da) * 1.5 <= tol * 3; };
  const mask = new Uint8Array(w * h), stack = [x0, y0];
  let count = 0;
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    let l = x; while (l > 0 && !mask[y * w + l - 1] && same((y * w + l - 1) * 4)) l--;
    let r = x; while (r < w - 1 && !mask[y * w + r + 1] && same((y * w + r + 1) * 4)) r++;
    for (let i = l; i <= r; i++) {
      const p = y * w + i; if (mask[p]) continue; mask[p] = 1; count++;
      if (y > 0 && !mask[p - w] && same((p - w) * 4)) stack.push(i, y - 1);
      if (y < h - 1 && !mask[p + w] && same((p + w) * 4)) stack.push(i, y + 1);
    }
    if (count > w * h) break;
  }
  // розширення на 1 px
  const out = mask.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x; if (mask[p]) continue;
    if ((x > 0 && mask[p - 1]) || (x < w - 1 && mask[p + 1]) || (y > 0 && mask[p - w]) || (y < h - 1 && mask[p + w])) out[p] = 1;
  }
  return { mask: out, count };
}
export function paintMask(g, mask, w, h, color) {
  const img = g.getImageData(0, 0, w, h), d = img.data, [r, gg, b] = hex2rgb(color);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let p = 0; p < mask.length; p++) if (mask[p]) {
    const i = p * 4; d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
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
