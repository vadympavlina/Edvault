// Конвертер зображень · Edvault — чисті розрахунки без DOM: розміри, назви, ZIP, ICO, SVG.
// Працює і в сторінці, і у фоновому потоці, і в Node (тести).

// ── Формати ──
export const FORMATS = {
  same: { label: 'Як є' },
  jpeg: { label: 'JPG', mime: 'image/jpeg', ext: 'jpg', lossy: true },
  png: { label: 'PNG', mime: 'image/png', ext: 'png' },
  webp: { label: 'WebP', mime: 'image/webp', ext: 'webp', lossy: true, alpha: true },
  avif: { label: 'AVIF', mime: 'image/avif', ext: 'avif', lossy: true, alpha: true },
  ico: { label: 'ICO', mime: 'image/x-icon', ext: 'ico' },
};
FORMATS.png.alpha = true; FORMATS.ico.alpha = true;
export const ICO_SIZES = [16, 32, 48, 256];

// що вийде з файлу типу mime при виборі format (svg лишається svg лише в «Як є»)
export function targetFormat(mime, format) {
  if (format !== 'same') return format;
  if (mime === 'image/svg+xml') return 'svg';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpeg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/avif') return 'avif';
  if (mime === 'image/x-icon' || mime === 'image/vnd.microsoft.icon') return 'ico';
  return 'png'; // png, gif, bmp, heic, tiff…
}

// ── Розмір ──
// rs: { mode: 'none' | 'percent' | 'fit' | 'exact', percent, w, h, noUpscale }
// fit — вписати в рамку (зберігаючи пропорції; одна сторона може бути порожня),
// exact — рівно w×h, зайве обрізається по центру.
// Повертає { w, h, crop: null | { sx, sy, sw, sh } } у координатах джерела.
export function computeSize(W, H, rs) {
  const r = rs || {};
  const round = v => Math.max(1, Math.round(v));
  const pos = v => (Number(v) > 0 ? Number(v) : 0);
  if (r.mode === 'percent') {
    let k = pos(r.percent) / 100 || 1;
    if (r.noUpscale) k = Math.min(1, k);
    return { w: round(W * k), h: round(H * k), crop: null };
  }
  if (r.mode === 'fit') {
    const bw = pos(r.w), bh = pos(r.h);
    if (!bw && !bh) return { w: W, h: H, crop: null };
    let k = Math.min(bw ? bw / W : Infinity, bh ? bh / H : Infinity);
    if (r.noUpscale) k = Math.min(1, k);
    return { w: round(W * k), h: round(H * k), crop: null };
  }
  if (r.mode === 'exact') {
    let tw = pos(r.w) || W, th = pos(r.h) || H;
    // обрізаємо по центру до потрібних пропорцій
    const ar = tw / th;
    let sw = W, sh = H;
    if (W / H > ar) sw = H * ar; else sh = W / ar;
    if (r.noUpscale && (tw > sw || th > sh)) { const k = Math.min(sw / tw, sh / th); tw *= k; th *= k; }
    const crop = { sx: (W - sw) / 2, sy: (H - sh) / 2, sw, sh };
    const same = Math.abs(sw - W) < 0.5 && Math.abs(sh - H) < 0.5;
    return { w: round(tw), h: round(th), crop: same ? null : crop };
  }
  return { w: W, h: H, crop: null };
}
// розміри після повороту
export const orient = (W, H, rotate) => (rotate % 180 ? [H, W] : [W, H]);

// ── Назви ──
export const baseName = n => String(n || 'image').replace(/\.[^.\\/]+$/, '') || 'image';
const safe = s => String(s).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim() || 'image';
export function outName(pattern, { name, n, w, h, ext }) {
  const p = String(pattern || '{name}').trim() || '{name}';
  const s = p.replace(/\{(name|n|w|h|ext)\}/g, (_, k) => k === 'name' ? baseName(name) : k === 'n' ? String(n) : k === 'w' ? String(w) : k === 'h' ? String(h) : ext);
  return safe(s) + '.' + ext;
}
// однакові назви в архіві: «фото.jpg», «фото (2).jpg»…
export function uniqueNames(names) {
  const seen = new Map();
  return names.map(n => {
    const key = n.toLowerCase();
    const c = seen.get(key) || 0;
    seen.set(key, c + 1);
    if (!c) return n;
    const dot = n.lastIndexOf('.');
    let cand, i = c + 1;
    do { cand = (dot > 0 ? n.slice(0, dot) : n) + ' (' + i + ')' + (dot > 0 ? n.slice(dot) : ''); i++; } while (seen.has(cand.toLowerCase()));
    seen.set(cand.toLowerCase(), 1);
    return cand;
  });
}

// ── Числа для людей ──
export function fmtBytes(b) {
  if (!(b >= 0)) return '—';
  if (b < 1024) return b + ' Б';
  if (b < 1024 * 1024) return (b / 1024).toFixed(b < 10240 ? 1 : 0).replace('.', ',') + ' КБ';
  return (b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 2 : 1).replace('.', ',') + ' МБ';
}
export function fmtDelta(before, after) {
  if (!before || !(after >= 0)) return { text: '', cls: '' };
  const d = Math.round((after / before - 1) * 100);
  if (d === 0) return { text: '0%', cls: 'same' };
  return { text: (d > 0 ? '+' : '−') + Math.abs(d) + '%', cls: d < 0 ? 'down' : 'up' };
}

// ── CRC-32 (ZIP, PNG) ──
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(bytes, crc = 0) {
  let c = ~crc >>> 0;
  for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return ~c >>> 0;
}

// ── ZIP без стиснення (зображення вже стиснуті) ──
// files: [{ name, data: Uint8Array, date? }] → Uint8Array
export function makeZip(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const dosTime = d => ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
  const dosDate = d => (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
  for (const f of files) {
    const name = enc.encode(f.name), data = f.data, crc = crc32(data), d = f.date || new Date();
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); // UTF-8 назви
    lh.setUint16(8, 0, true); lh.setUint16(10, dosTime(d), true); lh.setUint16(12, dosDate(d), true);
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
    lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true); ch.setUint16(12, dosTime(d), true); ch.setUint16(14, dosDate(d), true);
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
    ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return concat([...parts, ...central, new Uint8Array(end.buffer)]);
}
export function concat(arrs) {
  const out = new Uint8Array(arrs.reduce((s, a) => s + a.length, 0));
  let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}

// ── ICO з PNG-картинок ──  images: [{ size, data: Uint8Array (PNG) }]
export function makeIco(images) {
  const head = new DataView(new ArrayBuffer(6 + 16 * images.length));
  head.setUint16(2, 1, true); head.setUint16(4, images.length, true);
  let offset = 6 + 16 * images.length;
  images.forEach((im, i) => {
    const o = 6 + 16 * i;
    head.setUint8(o, im.size >= 256 ? 0 : im.size); head.setUint8(o + 1, im.size >= 256 ? 0 : im.size);
    head.setUint16(o + 4, 1, true); head.setUint16(o + 6, 32, true);
    head.setUint32(o + 8, im.data.length, true); head.setUint32(o + 12, offset, true);
    offset += im.data.length;
  });
  return concat([new Uint8Array(head.buffer), ...images.map(i => i.data)]);
}

// ── SVG ──
// розміри з width/height або viewBox; без них — 1024 по більшій стороні
export function svgSize(text) {
  const root = (String(text).match(/<svg\b[^>]*>/i) || [''])[0];
  const attr = n => { const m = root.match(new RegExp('\\s' + n + '\\s*=\\s*["\']([^"\']*)["\']', 'i')); return m ? m[1] : ''; };
  const px = v => { const m = /^\s*([\d.]+)\s*(px)?\s*$/i.exec(v); return m ? parseFloat(m[1]) : 0; };
  let w = px(attr('width')), h = px(attr('height'));
  const vb = attr('viewBox').trim().split(/[\s,]+/).map(Number);
  const vw = vb.length === 4 && vb[2] > 0 ? vb[2] : 0, vh = vb.length === 4 && vb[3] > 0 ? vb[3] : 0;
  if (!w && !h && vw && vh) { const k = 1024 / Math.max(vw, vh); w = vw * k; h = vh * k; }
  else if (w && !h) h = vh && vw ? w * vh / vw : w;
  else if (h && !w) w = vh && vw ? h * vw / vh : h;
  if (!w || !h) { w = 1024; h = 1024; }
  return { w: Math.round(w), h: Math.round(h) };
}
// стиснення SVG без зміни вигляду: коментарі, службові дані редакторів, зайві пробіли, довгі дроби
export function minifySvg(text, size) {
  let s = String(text);
  s = s.replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<metadata[\s\S]*?<\/metadata>/gi, '');
  s = s.replace(/<(sodipodi|inkscape):[\w-]+\b[^>]*\/>/g, '').replace(/<(sodipodi|inkscape):[\w-]+\b[\s\S]*?<\/\1:[\w-]+>/g, '');
  s = s.replace(/\s(?:sodipodi|inkscape):[\w-]+\s*=\s*"[^"]*"/g, '').replace(/\sxmlns:(?:sodipodi|inkscape|rdf|cc|dc)\s*=\s*"[^"]*"/g, '');
  s = s.replace(/(\d+\.\d{3})\d+/g, '$1');
  s = s.replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').replace(/\s+(\/?>)/g, '$1').trim();
  if (size) {
    s = s.replace(/<svg\b[^>]*>/i, tag => {
      let t = tag.replace(/\s(width|height)\s*=\s*["'][^"']*["']/gi, '');
      if (!/\sviewBox\s*=/i.test(t)) { const o = svgSize(text); t = t.replace(/<svg\b/i, '<svg viewBox="0 0 ' + o.w + ' ' + o.h + '"'); }
      return t.replace(/<svg\b/i, '<svg width="' + size.w + '" height="' + size.h + '"');
    });
  }
  return s;
}

// ── Налаштування ──
export const DEFAULTS = {
  format: 'same', quality: 80, png8: true,
  target: { on: false, kb: 200 },
  resize: { mode: 'none', percent: 50, w: 1920, h: 1080, noUpscale: true },
  rotate: 0, flipH: false, flipV: false,
  bg: '#ffffff', name: '{name}', keepSmaller: true,
};
export function normSettings(s) {
  const d = JSON.parse(JSON.stringify(DEFAULTS));
  if (!s || typeof s !== 'object') return d;
  const o = Object.assign(d, s, { target: Object.assign(d.target, s.target || {}), resize: Object.assign(d.resize, s.resize || {}) });
  if (!FORMATS[o.format]) o.format = 'same';
  o.quality = Math.min(100, Math.max(5, Math.round(+o.quality || 80)));
  o.rotate = [0, 90, 180, 270].includes(+o.rotate) ? +o.rotate : 0;
  if (!['none', 'percent', 'fit', 'exact'].includes(o.resize.mode)) o.resize.mode = 'none';
  if (!/^#[0-9a-f]{6}$/i.test(o.bg)) o.bg = '#ffffff';
  return o;
}
// кількість кольорів для стиснення PNG за «якістю»
export const pngColors = q => Math.max(16, Math.min(256, Math.round(16 + (q / 100) * 240)));

// чи щось змінюється, крім формату (для «залишити оригінал, якщо він менший»)
export const changesPixels = s => s.resize.mode !== 'none' || s.rotate || s.flipH || s.flipV;
