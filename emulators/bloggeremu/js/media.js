// Симулятор блогера · власні фото й відео: зберігаються лише в цьому браузері (IndexedDB), нікуди не надсилаються.
// Під час додавання файл зменшується (фото) і вимірюється: яскравість, контраст, різкість, кольори, рух на початку відео.
const DB = 'edvault-blogger-media', ST = 'files';
const urls = new Map(); // mid → { src, thumb, frames: [] }
let dbp = null;

function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('Сховище браузера недоступне'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('Сховище зайняте іншою вкладкою'));
  });
  dbp.catch(() => { dbp = null; });
  return dbp;
}
function req(mode, fn) {
  return db().then(d => new Promise((res, rej) => {
    const t = d.transaction(ST, mode), r = fn(t.objectStore(ST));
    t.oncomplete = () => res(r?.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Не вдалося зберегти файл'));
  }));
}
const withTimeout = (p, ms, v) => Promise.race([p, new Promise(r => setTimeout(() => r(v), ms))]);

function register(mid, rec) {
  const old = urls.get(mid); if (old) forget(old);
  const u = b => (b ? URL.createObjectURL(b) : '');
  urls.set(mid, { src: u(rec.blob), thumb: u(rec.thumb || rec.blob), frames: (rec.frames || []).map(u), kind: rec.kind, size: rec.size || 0 });
}
function forget(x) { for (const k of [x.src, x.thumb, ...x.frames]) if (k) URL.revokeObjectURL(k); }

// Завантажити всі збережені файли (під час запуску)
export async function loadMedia() {
  try {
    await withTimeout(req('readonly', st => {
      const c = st.openCursor();
      c.onsuccess = () => { const cur = c.result; if (!cur) return; register(cur.key, cur.value); cur.continue(); };
      return c;
    }), 5000);
  } catch { /* приватний режим або сховище вимкнене: працюємо без власних файлів */ }
}
export const mediaUrl = (mid, k = 'src') => { const x = urls.get(mid); return !x ? '' : k === 'thumb' ? x.thumb : k.startsWith('f') ? x.frames[+k.slice(1)] || x.thumb : x.src; };
export const hasMedia = mid => urls.has(mid);
export const frameCount = mid => urls.get(mid)?.frames.length || 0;
export function mediaUsage() { let bytes = 0, n = 0; for (const x of urls.values()) { bytes += x.size; n++; } return { n, bytes }; }

export async function removeMedia(mid) {
  const x = urls.get(mid); if (x) { forget(x); urls.delete(mid); }
  try { await req('readwrite', st => st.delete(mid)); } catch { /* немає сховища */ }
}
export async function clearMedia() {
  for (const x of urls.values()) forget(x); urls.clear();
  try { await req('readwrite', st => st.clear()); } catch { /* немає сховища */ }
}

/* ═════════ додавання файлів ═════════ */
const newMid = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const MAX_VIDEO = 400 * 1024 * 1024;

// Повертає опис для Галереї або кидає помилку зі зрозумілим текстом
export async function importFile(file) {
  const kind = /^video\//.test(file.type) || /\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name) ? 'video' : /^image\//.test(file.type) || /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(file.name) ? 'photo' : '';
  if (!kind) throw new Error(`«${short(file.name)}» — це не фото й не відео`);
  return kind === 'photo' ? importPhoto(file) : importVideo(file);
}
const short = n => (n.length > 28 ? n.slice(0, 25) + '…' : n);

async function importPhoto(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error(/hei[cf]/i.test(file.type + file.name) ? 'Фото у форматі HEIC браузер не відкриває. Збережіть його як JPG і спробуйте ще раз.' : `Не вдалося відкрити «${short(file.name)}» як фото`); }
  const w = bmp.width, h = bmp.height;
  const blob = await jpeg(bmp, 1600, 0.86), thumb = await jpeg(bmp, 420, 0.8);
  const an = measure(bmp, w, h);
  bmp.close?.();
  const mid = newMid(), rec = { kind: 'photo', blob, thumb, size: blob.size + thumb.size, name: file.name };
  await save(mid, rec);
  return { type: 'photo', own: true, mid, w, h, an, name: file.name.slice(0, 60) };
}

async function importVideo(file) {
  if (file.size > MAX_VIDEO) throw new Error('Відео завелике (понад 400 МБ). Оберіть коротше або стисніть його.');
  const src = URL.createObjectURL(file), v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = src;
  try {
    const ok = await wait(v, 'loadeddata', 15000);
    if (!ok || !v.videoWidth) throw new Error(`Браузер не може відтворити «${short(file.name)}». Спробуйте відео у форматі MP4 або WebM.`);
    // деякі записи (наприклад, з камери в браузері) не знають своєї тривалості, доки їх не перемотати в кінець
    if (!Number.isFinite(v.duration)) { v.currentTime = 1e7; await wait(v, 'seeked', 5000); }
    const dur = Number.isFinite(v.duration) ? v.duration : 0;
    if (dur < 1) throw new Error('Відео закоротке або пошкоджене');
    const w = v.videoWidth, h = v.videoHeight;
    // початок: кадри кожні пів секунди — коли щось починає рухатися
    const early = [], step = 0.5, until = Math.min(dur - 0.1, 10);
    for (let t = 0.05; t <= until; t += step) { const f = await grab(v, t); if (f) early.push({ t, f }); }
    const ds = early.slice(1).map((x, i) => ({ t: early[i].t, d: diff(early[i].f.g, x.f.g) }));
    // «щось відбувається» — помітно більше руху, ніж зазвичай у цьому відео
    const p75 = ds.map(x => x.d).sort((a, b) => a - b)[Math.floor(ds.length * 0.75)] || 0, edge = Math.max(0.006, p75 * 0.4);
    const first = ds.find(x => x.d > edge), motionSum = ds.reduce((a, x) => a + x.d, 0), motionN = ds.length;
    const intro = p75 < 0.004 ? until : first ? first.t : 0;
    // кілька кадрів по всьому відео: яскравість і різкість, а також варіанти обкладинки
    const pts = [0.12, 0.3, 0.5, 0.7, 0.88].map(k => k * dur), shots = [];
    let lum = 0, sharp = 0, col = 0, n = 0, prev = null, mot = 0, motN = 0;
    for (const t of pts) {
      const f = await grab(v, t, 640); if (!f) continue;
      lum += f.m.lum; sharp += f.m.sharp; col += f.m.col; n++;
      if (prev) { mot += diff(prev, f.g); motN++; } prev = f.g;
      shots.push(f.canvas);
    }
    if (!n) throw new Error(`Не вдалося прочитати кадри з «${short(file.name)}»`);
    const frames = await Promise.all(shots.slice(1, 4).map(c => toBlob(c, 0.8)));
    const thumb = await toBlob(shots[0], 0.8);
    const an = { lum: r3(lum / n), sharp: Math.round(sharp / n), col: Math.round(col / n), intro: Math.round(intro * 2) / 2, motion: r3(motionN ? motionSum / motionN : 0), change: r3(motN ? mot / motN : 0) };
    const mid = newMid(), rec = { kind: 'video', blob: file, thumb, frames, size: file.size + thumb.size + frames.reduce((a, b) => a + b.size, 0), name: file.name };
    await save(mid, rec);
    return { type: 'video', own: true, mid, w, h, dur: Math.round(dur * 10) / 10, an, name: file.name.slice(0, 60) };
  } finally { v.removeAttribute('src'); v.load(); URL.revokeObjectURL(src); }
}
async function save(mid, rec) {
  try { await req('readwrite', st => st.put(rec, mid)); }
  catch (e) { throw new Error(/quota/i.test(String(e?.name || e)) ? 'У браузері закінчилося місце. Видаліть кілька своїх файлів у Галереї.' : 'Не вдалося зберегти файл у браузері'); }
  register(mid, rec);
}

// подія або тайм-аут; false — помилка чи тайм-аут
function wait(el, ev, ms) {
  return new Promise(res => {
    const done = v => { clearTimeout(t); el.removeEventListener(ev, ok); el.removeEventListener('error', bad); res(v); };
    const ok = () => done(true), bad = () => done(false), t = setTimeout(() => done(false), ms);
    el.addEventListener(ev, ok); el.addEventListener('error', bad);
  });
}
async function grab(v, t, size = 160) {
  v.currentTime = Math.max(0, Math.min(t, v.duration - 0.05 || t));
  if (!(await wait(v, 'seeked', 4000))) return null;
  const k = Math.min(1, size / Math.max(v.videoWidth, v.videoHeight)), w = Math.max(1, Math.round(v.videoWidth * k)), h = Math.max(1, Math.round(v.videoHeight * k));
  const c = canvas(w, h), x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(v, 0, 0, w, h);
  const m = stats(x.getImageData(0, 0, w, h));
  // маленька сіра копія для порівняння кадрів
  const s = canvas(48, 48), sx = s.getContext('2d', { willReadFrequently: true }); sx.drawImage(c, 0, 0, 48, 48);
  return { m, g: gray(sx.getImageData(0, 0, 48, 48)), canvas: c };
}

/* ═════════ вимірювання кадру ═════════ */
const r3 = x => Math.round(x * 1000) / 1000;
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const toBlob = (c, q) => new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Не вдалося стиснути кадр'))), 'image/jpeg', q));
async function jpeg(src, max, q) {
  const k = Math.min(1, max / Math.max(src.width, src.height)), c = canvas(Math.round(src.width * k), Math.round(src.height * k)), x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height);
  return toBlob(c, q);
}
function measure(src) {
  const k = Math.min(1, 512 / Math.max(src.width, src.height)), c = canvas(Math.max(1, Math.round(src.width * k)), Math.max(1, Math.round(src.height * k))), x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(src, 0, 0, c.width, c.height);
  return stats(x.getImageData(0, 0, c.width, c.height));
}
function gray(img) { const d = img.data, g = new Float32Array(d.length / 4); for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; return g; }
const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
// lum — середня яскравість 0..1; con — контраст; sharp — різкість (дисперсія лапласіана);
// col — насиченість кольорів (метрика Гаслера–Зюсструнка); hi/lo — частка пересвічених і «провалених» у чорне пікселів
export function stats(img) {
  const { data: d, width: w, height: h } = img, n = w * h, L = new Float32Array(n);
  let sum = 0, sq = 0, hi = 0, lo = 0, rg = 0, rg2 = 0, yb = 0, yb2 = 0;
  for (let i = 0, j = 0; j < n; i += 4, j++) {
    const r = d[i], g = d[i + 1], b = d[i + 2], l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    L[j] = l; sum += l; sq += l * l; if (l > 0.97) hi++; if (l < 0.03) lo++;
    const a = r - g, y = 0.5 * (r + g) - b; rg += a; rg2 += a * a; yb += y; yb2 += y * y;
  }
  const lum = sum / n, con = Math.sqrt(Math.max(0, sq / n - lum * lum));
  const mrg = rg / n, myb = yb / n, col = Math.sqrt(Math.max(0, rg2 / n - mrg * mrg) + Math.max(0, yb2 / n - myb * myb)) + 0.3 * Math.sqrt(mrg * mrg + myb * myb);
  let ls = 0, ls2 = 0, m = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x, v = (L[i - 1] + L[i + 1] + L[i - w] + L[i + w] - 4 * L[i]) * 255; ls += v; ls2 += v * v; m++; }
  const sharp = m ? ls2 / m - (ls / m) ** 2 : 0;
  return { lum: r3(lum), con: r3(con), sharp: Math.round(sharp), col: Math.round(col), hi: r3(hi / n), lo: r3(lo / n) };
}
