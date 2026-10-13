// Мінімальний ZIP без сторонніх бібліотек: запис без стиснення (фото й відео вже стиснуті),
// читання — і наших архівів, і перепакованих іншою програмою (стиснення deflate).
// Великі файли не копіюються в пам'ять: архів складається з частин Blob, читання — через slice().

const enc = new TextEncoder(), dec = new TextDecoder();
const MAX = 0xFFFFFFFF;

/* ── CRC-32 ── */
const TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crcUpdate(c, bytes) { for (let i = 0; i < bytes.length; i++) c = TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return c; }
async function crcOf(blob) {
  let c = 0xFFFFFFFF;
  if (blob.stream) { const rd = blob.stream().getReader(); for (;;) { const { done, value } = await rd.read(); if (done) break; c = crcUpdate(c, value); } }
  else c = crcUpdate(c, new Uint8Array(await blob.arrayBuffer()));
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function dosTime(d) {
  return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
}

// entries: [{ name, data: Blob | string }] → Blob (application/zip)
export async function makeZip(entries, onProgress) {
  const parts = [], central = [], when = dosTime(new Date());
  let offset = 0, done = 0;
  for (const e of entries) {
    const data = typeof e.data === 'string' ? new Blob([enc.encode(e.data)]) : e.data;
    const name = enc.encode(e.name), size = data.size, crc = await crcOf(data);
    if (size >= MAX || offset >= MAX) throw new Error('Збереження завелике (понад 4 ГБ). Видаліть кілька великих відео в Галереї.');
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, when.time, true); lh.setUint16(12, when.date, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(lh.buffer, name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, when.time, true); ch.setUint16(14, when.date, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(ch.buffer, name);
    offset += 30 + name.length + size;
    onProgress?.(++done, entries.length);
  }
  const cdSize = central.reduce((a, x) => a + x.byteLength, 0);
  if (offset + cdSize >= MAX) throw new Error('Збереження завелике (понад 4 ГБ). Видаліть кілька великих відео в Галереї.');
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}

const u8 = async blob => new Uint8Array(await blob.arrayBuffer());

// Blob → Map(name → { blob(), text(), size })
export async function readZip(file) {
  const tailLen = Math.min(file.size, 65557), tail = await u8(file.slice(file.size - tailLen));
  let p = -1;
  for (let i = tail.length - 22; i >= 0; i--) if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x05 && tail[i + 3] === 0x06) { p = i; break; }
  if (p < 0) throw new Error('not-zip');
  const ev = new DataView(tail.buffer, tail.byteOffset + p, 22), count = ev.getUint16(10, true), cdSize = ev.getUint32(12, true), cdOff = ev.getUint32(16, true);
  const cd = await u8(file.slice(cdOff, cdOff + cdSize)), dv = new DataView(cd.buffer);
  const out = new Map();
  for (let i = 0, q = 0; i < count; i++) {
    if (dv.getUint32(q, true) !== 0x02014b50) throw new Error('bad-zip');
    const method = dv.getUint16(q + 10, true), csize = dv.getUint32(q + 20, true), size = dv.getUint32(q + 24, true);
    const nlen = dv.getUint16(q + 28, true), xlen = dv.getUint16(q + 30, true), clen = dv.getUint16(q + 32, true), lho = dv.getUint32(q + 42, true);
    const name = dec.decode(cd.subarray(q + 46, q + 46 + nlen));
    q += 46 + nlen + xlen + clen;
    if (name.endsWith('/')) continue;
    const entry = { name, size, method, lho, csize };
    entry.raw = async () => {
      const lh = new DataView(await file.slice(lho, lho + 30).arrayBuffer());
      const start = lho + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
      return file.slice(start, start + csize);
    };
    entry.blob = async (type = '') => {
      const raw = await entry.raw();
      if (method === 0) return type ? raw.slice(0, raw.size, type) : raw;
      if (method === 8 && typeof DecompressionStream !== 'undefined') return new Blob([await new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()], { type });
      throw new Error('method');
    };
    entry.text = async () => dec.decode(await (await entry.blob()).arrayBuffer());
    out.set(name, entry);
  }
  return out;
}
