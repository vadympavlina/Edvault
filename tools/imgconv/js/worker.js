// Конвертер зображень · фоновий потік: відкрити → повернути → змінити розмір → закодувати.
import { FORMATS, ICO_SIZES, computeSize, orient, makeIco, pngColors } from './core.js';
import { encodePng8 } from './png8.js';

const canvas = (w, h) => new OffscreenCanvas(w, h);

// які формати браузер уміє записувати
async function caps() {
  const c = canvas(2, 2); c.getContext('2d').fillRect(0, 0, 1, 1);
  const out = {};
  for (const k of ['jpeg', 'png', 'webp', 'avif']) {
    try { const b = await c.convertToBlob({ type: FORMATS[k].mime, quality: 0.8 }); out[k] = b.type === FORMATS[k].mime; } catch { out[k] = false; }
  }
  return out;
}

// поворот і віддзеркалення (повертає нове зображення або те саме)
async function orientBitmap(bmp, rotate, flipH, flipV) {
  if (!rotate && !flipH && !flipV) return bmp;
  const [w, h] = orient(bmp.width, bmp.height, rotate);
  const c = canvas(w, h), x = c.getContext('2d');
  x.translate(w / 2, h / 2);
  x.rotate(rotate * Math.PI / 180);
  x.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  x.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  return createImageBitmap(c);
}

// зміна розміру: якісне зменшення засобами браузера; scale — скільки реальних пікселів на «логічний» (для SVG)
async function resize(bmp, rs, scale = 1) {
  const lw = bmp.width / scale, lh = bmp.height / scale;
  const sz = computeSize(lw, lh, rs);
  const crop = sz.crop ? { sx: sz.crop.sx * scale, sy: sz.crop.sy * scale, sw: sz.crop.sw * scale, sh: sz.crop.sh * scale } : { sx: 0, sy: 0, sw: bmp.width, sh: bmp.height };
  if (!sz.crop && sz.w === bmp.width && sz.h === bmp.height) return bmp;
  // сильне зменшення — у кілька кроків, щоб не було «сходинок»
  let src = bmp, c = crop;
  while (c.sw / sz.w > 2.5 && c.sh / sz.h > 2.5) {
    src = await createImageBitmap(src, Math.round(c.sx), Math.round(c.sy), Math.round(c.sw), Math.round(c.sh), { resizeWidth: Math.max(sz.w, Math.round(c.sw / 2)), resizeHeight: Math.max(sz.h, Math.round(c.sh / 2)), resizeQuality: 'high' });
    c = { sx: 0, sy: 0, sw: src.width, sh: src.height };
  }
  return createImageBitmap(src, Math.round(c.sx), Math.round(c.sy), Math.max(1, Math.round(c.sw)), Math.max(1, Math.round(c.sh)), { resizeWidth: sz.w, resizeHeight: sz.h, resizeQuality: 'high' });
}

function draw(bmp, bg) {
  const c = canvas(bmp.width, bmp.height), x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); }
  x.drawImage(bmp, 0, 0);
  return c;
}
const encode = (c, fmt, q) => c.convertToBlob({ type: FORMATS[fmt].mime, quality: q });

// стиснення до потрібного розміру: двійковий пошук якості
async function encodeTarget(c, fmt, bytes) {
  let lo = 0.04, hi = 0.95, best = null, small = null;
  for (let i = 0; i < 7; i++) {
    const q = (lo + hi) / 2, b = await encode(c, fmt, q);
    if (!small || b.size < small.size) small = b;
    if (b.size <= bytes) { best = b; lo = q; } else hi = q;
  }
  if (!best) { const b = await encode(c, fmt, 0.03); return { blob: b.size < small.size ? b : small, miss: true }; }
  return { blob: best, miss: false };
}

async function png(c, s, target) {
  if (!s.png8) return { blob: await c.convertToBlob({ type: 'image/png' }), miss: false };
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const make = async n => new Blob([await encodePng8(d, c.width, c.height, n, true)], { type: 'image/png' });
  if (!target) return { blob: await make(pngColors(s.quality)), miss: false };
  let last = null;
  for (const n of [256, 128, 64, 32, 16, 8]) { last = await make(n); if (last.size <= target) return { blob: last, miss: false }; }
  return { blob: last, miss: true };
}

async function ico(bmp) {
  // квадрат: вписуємо по центру на прозоре тло
  const side = Math.max(bmp.width, bmp.height);
  const sizes = ICO_SIZES.filter(n => n <= Math.max(side, 16));
  const imgs = [];
  for (const n of sizes) {
    const k = n / side, w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
    const sm = await createImageBitmap(bmp, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
    const c = canvas(n, n); c.getContext('2d').drawImage(sm, (n - w) / 2, (n - h) / 2);
    imgs.push({ size: n, data: new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer()) });
  }
  return { blob: new Blob([makeIco(imgs)], { type: 'image/x-icon' }), miss: false, w: sizes[sizes.length - 1], h: sizes[sizes.length - 1] };
}

async function convert({ src, scale, fmt, s }) {
  let bmp = src instanceof Blob ? await createImageBitmap(src) : src;
  const srcW = Math.round(bmp.width / (scale || 1)), srcH = Math.round(bmp.height / (scale || 1));
  bmp = await orientBitmap(bmp, s.rotate, s.flipH, s.flipV);
  bmp = await resize(bmp, s.resize, scale || 1);
  const target = s.target.on && fmt !== 'ico' ? Math.max(1, s.target.kb) * 1024 : 0;
  let r;
  if (fmt === 'ico') r = await ico(bmp);
  else {
    const c = draw(bmp, FORMATS[fmt].alpha ? null : s.bg);
    if (fmt === 'png') r = await png(c, s, target);
    else if (target) r = await encodeTarget(c, fmt, target);
    else r = { blob: await encode(c, fmt, s.quality / 100), miss: false };
  }
  return { blob: r.blob, miss: r.miss, w: r.w || bmp.width, h: r.h || bmp.height, srcW, srcH };
}

self.onmessage = async e => {
  const { id, type } = e.data;
  try {
    if (type === 'caps') postMessage({ id, ok: true, result: await caps() });
    else if (type === 'convert') postMessage({ id, ok: true, result: await convert(e.data) });
  } catch (err) {
    postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
