// Конвертер зображень: розрахунки розмірів, назви, ZIP, SVG, стиснення PNG.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../tools/imgconv/js/core.js';
import { encodePng8, buildPalette } from '../tools/imgconv/js/png8.js';
import { inflateSync } from 'node:zlib';

test('розміри: вписати, обрізати, відсотки, не збільшувати', () => {
  assert.deepEqual(c.computeSize(4000, 3000, { mode: 'fit', w: 1920, h: 0, noUpscale: true }), { w: 1920, h: 1440, crop: null });
  assert.deepEqual(c.computeSize(800, 600, { mode: 'fit', w: 1920, h: 0, noUpscale: true }), { w: 800, h: 600, crop: null });
  assert.deepEqual(c.computeSize(800, 600, { mode: 'fit', w: 1920, h: 0, noUpscale: false }), { w: 1920, h: 1440, crop: null });
  assert.deepEqual(c.computeSize(800, 600, { mode: 'fit', w: 0, h: 0 }), { w: 800, h: 600, crop: null });
  const e = c.computeSize(4000, 3000, { mode: 'exact', w: 512, h: 512 });
  assert.equal(e.w, 512); assert.equal(e.h, 512);
  assert.deepEqual(e.crop, { sx: 500, sy: 0, sw: 3000, sh: 3000 });
  assert.equal(c.computeSize(512, 512, { mode: 'exact', w: 512, h: 512 }).crop, null);
  // маленьке зображення з «не збільшувати» — пропорції цілі зберігаються
  const s = c.computeSize(300, 200, { mode: 'exact', w: 1080, h: 1080, noUpscale: true });
  assert.equal(s.w, s.h); assert.ok(s.w <= 200);
  assert.deepEqual(c.computeSize(100, 50, { mode: 'percent', percent: 50 }), { w: 50, h: 25, crop: null });
  assert.deepEqual(c.orient(100, 50, 90), [50, 100]);
});

test('формат результату', () => {
  assert.equal(c.targetFormat('image/jpeg', 'same'), 'jpeg');
  assert.equal(c.targetFormat('image/gif', 'same'), 'png');
  assert.equal(c.targetFormat('image/svg+xml', 'same'), 'svg');
  assert.equal(c.targetFormat('image/svg+xml', 'webp'), 'webp');
});

test('назви файлів', () => {
  assert.equal(c.outName('{name}-{w}x{h}', { name: 'Фото 1.JPG', n: 1, w: 10, h: 20, ext: 'webp' }), 'Фото 1-10x20.webp');
  assert.equal(c.outName('a/b:{n}', { name: 'x', n: 3, w: 1, h: 1, ext: 'png' }), 'a_b_3.png');
  assert.equal(c.outName('', { name: 'x.png', n: 1, w: 1, h: 1, ext: 'jpg' }), 'x.jpg');
  assert.deepEqual(c.uniqueNames(['a.jpg', 'A.jpg', 'a.jpg', 'b.png']), ['a.jpg', 'A (2).jpg', 'a (3).jpg', 'b.png']);
});

test('SVG: розмір і очищення', () => {
  assert.deepEqual(c.svgSize('<svg viewBox="0 0 24 12">'), { w: 1024, h: 512 });
  assert.deepEqual(c.svgSize('<svg width="100" height="50px">'), { w: 100, h: 50 });
  assert.deepEqual(c.svgSize('<svg width="100%">'), { w: 1024, h: 1024 });
  assert.equal(c.minifySvg('<?xml version="1.0"?><!-- c --><svg  xmlns:inkscape="x" inkscape:v="1"><metadata>m</metadata>\n  <path d="M1.123456 2"/></svg>'), '<svg><path d="M1.123 2"/></svg>');
  assert.match(c.minifySvg('<svg viewBox="0 0 10 10" width="10"></svg>', { w: 64, h: 64 }), /^<svg width="64" height="64" viewBox="0 0 10 10">/);
});

test('числа для людей і CRC', () => {
  assert.equal(c.fmtBytes(1536), '1,5 КБ');
  assert.equal(c.fmtBytes(3 * 1024 * 1024), '3,00 МБ');
  assert.deepEqual(c.fmtDelta(1000, 250), { text: '−75%', cls: 'down' });
  assert.equal(c.crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
});

test('ZIP: правильна структура', () => {
  const z = c.makeZip([{ name: 'а.txt', data: new TextEncoder().encode('hello') }]);
  const v = new DataView(z.buffer);
  assert.equal(v.getUint32(0, true), 0x04034b50);
  assert.equal(v.getUint32(z.length - 22, true), 0x06054b50);
  assert.equal(v.getUint16(z.length - 22 + 10, true), 1);
});

test('налаштування з пошкодженого сховища', () => {
  const s = c.normSettings({ format: 'bmp', quality: 900, rotate: 45, resize: { mode: 'x' }, bg: 'red' });
  assert.equal(s.format, 'same'); assert.equal(s.quality, 100); assert.equal(s.rotate, 0);
  assert.equal(s.resize.mode, 'none'); assert.equal(s.bg, '#ffffff');
  assert.equal(c.normSettings(null).quality, 80);
});

test('PNG до 256 кольорів: коректний файл, прозорість збережено', async () => {
  const W = 40, H = 30, d = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { d[i * 4] = (i % W) * 6; d[i * 4 + 1] = (i / W | 0) * 8; d[i * 4 + 2] = 128; d[i * 4 + 3] = i % 7 ? 255 : 0; }
  assert.ok(buildPalette(d, 16).length <= 16);
  const png = await encodePng8(d, W, H, 64, true);
  assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  // розбираємо блоки й перевіряємо CRC та розмір розпакованих даних
  const v = new DataView(png.buffer, png.byteOffset);
  let i = 8; const seen = {};
  while (i < png.length) {
    const n = v.getUint32(i), type = String.fromCharCode(...png.slice(i + 4, i + 8));
    assert.equal(v.getUint32(i + 8 + n), c.crc32(png.slice(i + 4, i + 8 + n)), 'CRC ' + type);
    seen[type] = png.slice(i + 8, i + 8 + n);
    i += 12 + n;
  }
  assert.ok(seen.IHDR && seen.PLTE && seen.tRNS && seen.IDAT && seen.IEND);
  assert.equal(seen.IHDR[9], 3);
  assert.ok(seen.PLTE.length / 3 <= 64);
  const depth = seen.IHDR[8];
  assert.equal(inflateSync(seen.IDAT).length, (Math.ceil(W * depth / 8) + 1) * H);
  assert.equal(seen.tRNS[0], 0, 'перший колір палітри — прозорий');
});
