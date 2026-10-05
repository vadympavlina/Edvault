// Стиснення PNG «як TinyPNG»: до 256 кольорів (median cut) з м'яким згладжуванням (Floyd–Steinberg)
// і записом палітрового PNG. Прозорість зберігається.
import { crc32, concat } from './core.js';

// rgba → індекс комірки гістограми: 5 біт на R, G, B і 3 на прозорість
const keyOf = (r, g, b, a) => ((r >> 3) << 13) | ((g >> 3) << 8) | ((b >> 3) << 3) | (a >> 5);

// Палітра: [[r,g,b,a]…], не більше max кольорів
export function buildPalette(data, max) {
  const N = 1 << 18;
  const cnt = new Uint32Array(N), sr = new Float64Array(N), sg = new Float64Array(N), sb = new Float64Array(N), sa = new Float64Array(N);
  let clear = false;
  const step = data.length > 16e6 ? 8 : data.length > 4e6 ? 4 : 1; // для великих фото — вибірка
  for (let i = 0; i < data.length; i += 4 * step) {
    const a = data[i + 3];
    if (a < 8) { clear = true; continue; }
    const k = keyOf(data[i], data[i + 1], data[i + 2], a);
    cnt[k]++; sr[k] += data[i]; sg[k] += data[i + 1]; sb[k] += data[i + 2]; sa[k] += a;
  }
  const bins = [];
  for (let k = 0; k < N; k++) if (cnt[k]) bins.push({ n: cnt[k], r: sr[k] / cnt[k], g: sg[k] / cnt[k], b: sb[k] / cnt[k], a: sa[k] / cnt[k] });
  const room = max - (clear ? 1 : 0);
  let pal;
  if (bins.length <= room) pal = bins.map(c => [c.r, c.g, c.b, c.a]);
  else {
    // median cut: ділимо коробку з найбільшою «вагою × розмахом»
    const box = items => {
      let lo = [255, 255, 255, 255], hi = [0, 0, 0, 0], n = 0;
      for (const c of items) { const v = [c.r, c.g, c.b, c.a]; for (let j = 0; j < 4; j++) { if (v[j] < lo[j]) lo[j] = v[j]; if (v[j] > hi[j]) hi[j] = v[j]; } n += c.n; }
      const span = [hi[0] - lo[0], (hi[1] - lo[1]) * 1.2, hi[2] - lo[2], (hi[3] - lo[3]) * 1.5];
      const ax = span.indexOf(Math.max(...span));
      return { items, n, ax, score: span[ax] * Math.sqrt(n) };
    };
    const boxes = [box(bins)];
    while (boxes.length < room) {
      let bi = -1, best = 0;
      boxes.forEach((b, i) => { if (b.items.length > 1 && b.score > best) { best = b.score; bi = i; } });
      if (bi < 0) break;
      const b = boxes[bi], key = ['r', 'g', 'b', 'a'][b.ax];
      b.items.sort((x, y) => x[key] - y[key]);
      let half = b.n / 2, acc = 0, cut = 1;
      for (let i = 0; i < b.items.length - 1; i++) { acc += b.items[i].n; if (acc >= half) { cut = i + 1; break; } }
      boxes.splice(bi, 1, box(b.items.slice(0, cut)), box(b.items.slice(cut)));
    }
    pal = boxes.map(b => { let r = 0, g = 0, bl = 0, a = 0; for (const c of b.items) { r += c.r * c.n; g += c.g * c.n; bl += c.b * c.n; a += c.a * c.n; } return [r / b.n, g / b.n, bl / b.n, a / b.n]; });
  }
  pal = pal.map(c => c.map(v => Math.round(v)));
  if (clear) pal.unshift([0, 0, 0, 0]);
  if (!pal.length) pal.push([0, 0, 0, 0]);
  return pal;
}

// пікселі → індекси палітри (з кешем найближчого кольору і згладжуванням)
export function mapPixels(data, w, h, pal, dither = true) {
  const out = new Uint8Array(w * h);
  const cache = new Int16Array(1 << 18).fill(-1);
  const clearIdx = pal.findIndex(c => c[3] === 0);
  const nearest = (r, g, b, a) => {
    const k = keyOf(r, g, b, a);
    let idx = cache[k];
    if (idx >= 0) return idx;
    let best = Infinity;
    for (let i = 0; i < pal.length; i++) {
      const p = pal[i];
      if (p[3] === 0 && a >= 8) continue;
      const dr = p[0] - r, dg = p[1] - g, db = p[2] - b, da = p[3] - a;
      const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11 + da * da * 0.6;
      if (d < best) { best = d; idx = i; }
    }
    cache[k] = idx;
    return idx;
  };
  // похибки поточного й наступного рядка (RGB), згладжування слабше за класичне — менше «зерна»
  const S = 0.75;
  let cur = new Float32Array((w + 2) * 3), nxt = new Float32Array((w + 2) * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, a = data[i + 3];
      if (a < 8 && clearIdx >= 0) { out[y * w + x] = clearIdx; continue; }
      const e = (x + 1) * 3;
      const r = clampB(data[i] + (dither ? cur[e] : 0)), g = clampB(data[i + 1] + (dither ? cur[e + 1] : 0)), b = clampB(data[i + 2] + (dither ? cur[e + 2] : 0));
      const idx = nearest(r, g, b, a);
      out[y * w + x] = idx;
      if (!dither) continue;
      const p = pal[idx], er = (r - p[0]) * S, eg = (g - p[1]) * S, eb = (b - p[2]) * S;
      cur[e + 3] += er * 7 / 16; cur[e + 4] += eg * 7 / 16; cur[e + 5] += eb * 7 / 16;
      nxt[e - 3] += er * 3 / 16; nxt[e - 2] += eg * 3 / 16; nxt[e - 1] += eb * 3 / 16;
      nxt[e] += er * 5 / 16; nxt[e + 1] += eg * 5 / 16; nxt[e + 2] += eb * 5 / 16;
      nxt[e + 3] += er / 16; nxt[e + 4] += eg / 16; nxt[e + 5] += eb / 16;
    }
    [cur, nxt] = [nxt, cur]; nxt.fill(0);
  }
  return out;
}
const clampB = v => (v < 0 ? 0 : v > 255 ? 255 : v);

async function zlib(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
function chunk(type, data) {
  const t = new TextEncoder().encode(type);
  const len = new DataView(new ArrayBuffer(4)); len.setUint32(0, data.length);
  const crc = new DataView(new ArrayBuffer(4)); crc.setUint32(0, crc32(concat([t, data])));
  return concat([new Uint8Array(len.buffer), t, data, new Uint8Array(crc.buffer)]);
}

// RGBA → палітровий PNG (Uint8Array)
export async function encodePng8(data, w, h, maxColors = 256, dither = true) {
  let pal = buildPalette(data, maxColors);
  // напівпрозорі кольори — на початок, щоб блок tRNS був коротким
  const order = pal.map((c, i) => i).sort((a, b) => (pal[a][3] === 255) - (pal[b][3] === 255));
  pal = order.map(i => pal[i]);
  const idx = mapPixels(data, w, h, pal, dither);
  const depth = pal.length <= 2 ? 1 : pal.length <= 4 ? 2 : pal.length <= 16 ? 4 : 8;
  const rowLen = Math.ceil(w * depth / 8);
  const raw = new Uint8Array((rowLen + 1) * h);
  for (let y = 0; y < h; y++) {
    const o = y * (rowLen + 1) + 1;
    if (depth === 8) raw.set(idx.subarray(y * w, y * w + w), o);
    else {
      const per = 8 / depth;
      for (let x = 0; x < w; x++) raw[o + ((x / per) | 0)] |= idx[y * w + x] << (8 - depth * (1 + (x % per)));
    }
  }
  const ihdr = new DataView(new ArrayBuffer(13));
  ihdr.setUint32(0, w); ihdr.setUint32(4, h); ihdr.setUint8(8, depth); ihdr.setUint8(9, 3);
  const plte = new Uint8Array(pal.length * 3);
  pal.forEach((c, i) => { plte[i * 3] = c[0]; plte[i * 3 + 1] = c[1]; plte[i * 3 + 2] = c[2]; });
  const nT = pal.findIndex(c => c[3] === 255);
  const trns = nT === -1 ? pal.length : nT;
  return concat([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', new Uint8Array(ihdr.buffer)),
    chunk('PLTE', plte),
    ...(trns ? [chunk('tRNS', new Uint8Array(pal.slice(0, trns).map(c => c[3])))] : []),
    chunk('IDAT', await zlib(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]);
}
