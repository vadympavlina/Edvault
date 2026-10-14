// Аніматор · кодер GIF без сторонніх бібліотек.
// Одна спільна палітра на всю анімацію (медіанний переріз по вибірці пікселів усіх кадрів),
// кожен наступний кадр зберігає лише змінену ділянку, а незмінені пікселі — прозорі.
// Так мультики з лінійним малюнком важать у рази менше.

const TRANSPARENT = 255; // індекс прозорого кольору; палітра має до 255 справжніх кольорів

/* ── палітра: медіанний переріз ── */
export function buildPalette(frames, maxColors = 255) {
  // вибірка пікселів з усіх кадрів, не більше ~160 тис.
  const total = frames.reduce((s, f) => s + f.length / 4, 0);
  const step = Math.max(1, Math.floor(total / 160000));
  const px = [];
  let k = 0;
  for (const f of frames) for (let i = 0; i < f.length; i += 4) { if (k++ % step) continue; px.push((f[i] << 16) | (f[i + 1] << 8) | f[i + 2]); }
  // спершу унікальні кольори: якщо їх мало — палітра точна
  const uniq = [...new Set(px)];
  if (uniq.length <= maxColors) return uniq.map(c => [(c >> 16) & 255, (c >> 8) & 255, c & 255]);
  let boxes = [px];
  while (boxes.length < maxColors) {
    // ділимо найбільшу за розкидом коробку
    let bi = -1, bestRange = -1, bestCh = 0;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      const mn = [255, 255, 255], mx = [0, 0, 0];
      for (const c of b) { const r = (c >> 16) & 255, g = (c >> 8) & 255, bl = c & 255; if (r < mn[0]) mn[0] = r; if (r > mx[0]) mx[0] = r; if (g < mn[1]) mn[1] = g; if (g > mx[1]) mx[1] = g; if (bl < mn[2]) mn[2] = bl; if (bl > mx[2]) mx[2] = bl; }
      const rg = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]], ch = rg.indexOf(Math.max(...rg)), range = rg[ch] * Math.sqrt(b.length);
      if (range > bestRange) { bestRange = range; bi = i; bestCh = ch; }
    });
    if (bi < 0 || bestRange <= 0) break;
    const shift = [16, 8, 0][bestCh], b = boxes[bi];
    b.sort((x, y) => ((x >> shift) & 255) - ((y >> shift) & 255));
    const mid = b.length >> 1;
    boxes.splice(bi, 1, b.slice(0, mid), b.slice(mid));
  }
  return boxes.filter(b => b.length).map(b => {
    let r = 0, g = 0, bl = 0;
    for (const c of b) { r += (c >> 16) & 255; g += (c >> 8) & 255; bl += c & 255; }
    return [Math.round(r / b.length), Math.round(g / b.length), Math.round(bl / b.length)];
  });
}

function mapper(palette) {
  const cache = new Map();
  return (r, g, b) => {
    const key = (r << 16) | (g << 8) | b;
    let idx = cache.get(key);
    if (idx !== undefined) return idx;
    let best = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i], dr = p[0] - r, dg = p[1] - g, db = p[2] - b, d = dr * dr * 2 + dg * dg * 4 + db * db * 3;
      if (d < best) { best = d; idx = i; if (!d) break; }
    }
    cache.set(key, idx);
    return idx;
  };
}

/* ── LZW ── */
function lzw(indices, minCode, out) {
  out.byte(minCode);
  const clear = 1 << minCode, eoi = clear + 1;
  let codeSize = minCode + 1, next = eoi + 1, dict = new Map();
  let cur = 0, bits = 0;
  const block = [];
  const flushBlock = () => { if (!block.length) return; out.byte(block.length); out.bytes(block); block.length = 0; };
  const emit = code => { cur |= code << bits; bits += codeSize; while (bits >= 8) { block.push(cur & 255); if (block.length === 255) flushBlock(); cur >>>= 8; bits -= 8; } };
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const c = indices[i], key = prefix * 4096 + c, hit = dict.get(key);
    if (hit !== undefined) { prefix = hit; continue; }
    emit(prefix);
    if (next < 4096) { dict.set(key, next++); if (next > (1 << codeSize) && codeSize < 12) codeSize++; }
    else { emit(clear); dict = new Map(); codeSize = minCode + 1; next = eoi + 1; }
    prefix = c;
  }
  emit(prefix); emit(eoi);
  if (bits > 0) block.push(cur & 255);
  flushBlock();
  out.byte(0);
}

class Bytes {
  constructor() { this.buf = new Uint8Array(1 << 16); this.n = 0; }
  grow(k) { if (this.n + k <= this.buf.length) return; let s = this.buf.length; while (s < this.n + k) s *= 2; const b = new Uint8Array(s); b.set(this.buf.subarray(0, this.n)); this.buf = b; }
  byte(v) { this.grow(1); this.buf[this.n++] = v & 255; }
  bytes(a) { this.grow(a.length); this.buf.set(a, this.n); this.n += a.length; }
  word(v) { this.byte(v); this.byte(v >> 8); }
  str(s) { for (const ch of s) this.byte(ch.charCodeAt(0)); }
  result() { return this.buf.slice(0, this.n); }
}

// frames: [{ data: Uint8ClampedArray RGBA (w×h), delay: мс }]; loop: 0 — без кінця
export function encodeGif(width, height, frames, { loop = 0, onProgress } = {}) {
  if (!frames.length) throw new Error('немає кадрів');
  const palette = buildPalette(frames.map(f => f.data), 255);
  const map = mapper(palette);
  const out = new Bytes();
  out.str('GIF89a'); out.word(width); out.word(height);
  out.byte(0xF7); out.byte(0); out.byte(0); // глобальна палітра 256 кольорів
  for (let i = 0; i < 256; i++) { const p = palette[i] || [0, 0, 0]; out.byte(p[0]); out.byte(p[1]); out.byte(p[2]); }
  out.byte(0x21); out.byte(0xFF); out.byte(11); out.str('NETSCAPE2.0'); out.byte(3); out.byte(1); out.word(loop); out.byte(0);
  let prev = null;
  frames.forEach((f, fi) => {
    const idx = new Uint8Array(width * height), d = f.data;
    for (let p = 0, q = 0; p < idx.length; p++, q += 4) idx[p] = map(d[q], d[q + 1], d[q + 2]);
    // змінена ділянка відносно попереднього кадру
    let x0 = 0, y0 = 0, x1 = width - 1, y1 = height - 1;
    if (prev) {
      x0 = width; y0 = height; x1 = -1; y1 = -1;
      for (let y = 0; y < height; y++) for (let x = 0, p = y * width; x < width; x++, p++) if (idx[p] !== prev[p]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0; } // кадр не змінився — один прозорий піксель
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, sub = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = (y + y0) * width + x + x0;
      sub[y * w + x] = prev && idx[p] === prev[p] ? TRANSPARENT : idx[p];
    }
    const delay = Math.max(2, Math.round((f.delay || 100) / 10));
    out.byte(0x21); out.byte(0xF9); out.byte(4); out.byte(prev ? 0x05 : 0x04); out.word(delay); out.byte(TRANSPARENT); out.byte(0);
    out.byte(0x2C); out.word(x0); out.word(y0); out.word(w); out.word(h); out.byte(0);
    lzw(sub, 8, out);
    prev = idx;
    if (onProgress) onProgress((fi + 1) / frames.length);
  });
  out.byte(0x3B);
  return out.result();
}

/* ── розбір GIF (для тестів і перевірки): кількість кадрів, розмір, затримки, перший кадр ── */
export function inspectGif(bytes) {
  const b = bytes, txt = String.fromCharCode(...b.slice(0, 6));
  if (txt !== 'GIF89a' && txt !== 'GIF87a') throw new Error('не GIF');
  const w = b[6] | (b[7] << 8), h = b[8] | (b[9] << 8), flags = b[10];
  let p = 13 + (flags & 0x80 ? 3 * (1 << ((flags & 7) + 1)) : 0);
  const delays = [];
  let frames = 0, loop = null;
  const skipBlocks = () => { while (b[p]) p += b[p] + 1; p++; };
  while (p < b.length) {
    const t = b[p++];
    if (t === 0x3B) break;
    if (t === 0x21) {
      const label = b[p++];
      if (label === 0xF9) { delays.push((b[p + 2] | (b[p + 3] << 8)) * 10); }
      if (label === 0xFF && String.fromCharCode(...b.slice(p + 1, p + 12)) === 'NETSCAPE2.0') loop = b[p + 14] | (b[p + 15] << 8);
      skipBlocks();
    } else if (t === 0x2C) {
      const lf = b[p + 8]; p += 9; if (lf & 0x80) p += 3 * (1 << ((lf & 7) + 1));
      p++; skipBlocks(); frames++;
    } else throw new Error('пошкоджений GIF');
  }
  return { width: w, height: h, frames, delays, loop };
}

// Повне декодування першого кадру (індекси) — для тестів LZW
export function decodeFirstFrameIndices(bytes) {
  const b = bytes, flags = b[10];
  let p = 13 + (flags & 0x80 ? 3 * (1 << ((flags & 7) + 1)) : 0);
  while (b[p] === 0x21) { p += 2; while (b[p]) p += b[p] + 1; p++; }
  if (b[p] !== 0x2C) throw new Error('немає кадру');
  const w = b[p + 5] | (b[p + 6] << 8), h = b[p + 7] | (b[p + 8] << 8); p += 10;
  const minCode = b[p++], data = [];
  while (b[p]) { data.push(...b.slice(p + 1, p + 1 + b[p])); p += b[p] + 1; }
  const clear = 1 << minCode, eoi = clear + 1, out = [];
  let codeSize = minCode + 1, dict = [], cur = 0, bits = 0, bi = 0, prev = null;
  const reset = () => { dict = []; for (let i = 0; i < clear; i++) dict[i] = [i]; dict[clear] = []; dict[eoi] = []; codeSize = minCode + 1; prev = null; };
  reset();
  for (;;) {
    while (bits < codeSize) { if (bi >= data.length) return { w, h, idx: out }; cur |= data[bi++] << bits; bits += 8; }
    const code = cur & ((1 << codeSize) - 1); cur >>>= codeSize; bits -= codeSize;
    if (code === clear) { reset(); continue; }
    if (code === eoi) break;
    let entry;
    if (code < dict.length) entry = dict[code];
    else if (prev) entry = prev.concat(prev[0]);
    else throw new Error('LZW');
    out.push(...entry);
    if (prev) { dict.push(prev.concat(entry[0])); if (dict.length === (1 << codeSize) && codeSize < 12) codeSize++; }
    prev = entry;
  }
  return { w, h, idx: out };
}
