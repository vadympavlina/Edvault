// Аніматор · файл проєкту (.edanim — ZIP із описом, малюнками кадрів і звуком), автозбереження в браузері, звук.
import { makeZip, readZip } from '../../../shared/zip.js';
import { checksum, slug } from '../../../shared/savefile.js';
import { Cell, store } from './cells.js';
import { okMeta, projectFromMeta, FILE_FORMAT } from './model.js';

export const FILE_EXT = '.edanim';

export function fileName(P) {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return ['multik', slug(P.title) || 'bez-nazvy', slug(P.author || ''), `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`].filter(Boolean).join('_');
}

/* ── збереження у файл ── */
export async function packProject(P, extras = {}) {
  const meta = P.meta();
  const entries = [];
  for (const [li, l] of P.layers.entries()) for (const f of P.frames) {
    const c = l.cells.get(f.id); if (!c || c.empty) continue;
    const png = await c.png(); if (png) entries.push({ name: `cells/${li}-${f.id}.png`, data: png });
  }
  if (extras.audio) entries.push({ name: 'audio/' + (P.audio?.name || 'zvuk'), data: extras.audio });
  if (extras.ref) entries.push({ name: 'ref.png', data: extras.ref });
  meta.savedAt = new Date().toISOString();
  meta.ref = extras.ref ? { show: !!extras.refShow, opacity: extras.refOpacity ?? 0.4 } : null;
  meta.integrity = checksum(JSON.stringify({ frames: meta.frames, layers: meta.layers, title: meta.title, author: meta.author }));
  meta.about = 'Мультфільм із «Аніматора» Edvault (edvault.online/tools/animator). Відкрийте файл в Аніматорі кнопкою «Відкрити».';
  entries.unshift({ name: 'project.json', data: JSON.stringify(meta, null, 1) });
  entries.push({ name: 'README.txt', data: `Мультфільм «${meta.title}»${meta.author ? ', автор: ' + meta.author : ''}.\nКадрів: ${meta.frames.length}, шарів: ${meta.layers.length}, частота ${meta.fps} кадр/с.\nВідкрийте цей файл в Аніматорі на edvault.online/tools/animator.\n` });
  return new Blob([await makeZip(entries)], { type: 'application/zip' });
}

/* ── відкриття з файлу ── */
export async function unpackProject(file) {
  let zip;
  try { zip = await readZip(file); } catch { return { ok: false, error: 'Це не файл Аніматора: його не вдалося прочитати.' }; }
  const pj = zip.get('project.json');
  if (!pj) return { ok: false, error: zip.has('state.json') || zip.has('README.txt') ? 'Цей архів належить іншому інструменту.' : 'У файлі немає проєкту Аніматора.' };
  let meta;
  try { meta = JSON.parse(await pj.text()); } catch { return { ok: false, error: 'Файл пошкоджений: опис проєкту не читається.' }; }
  if (meta.format > FILE_FORMAT) return { ok: false, error: 'Файл збережено новішою версією Аніматора. Оновіть сторінку.' };
  if (!okMeta(meta)) return { ok: false, error: 'Файл пошкоджений або це не мультфільм з Аніматора.' };
  const blobs = new Map();
  for (const [li, lm] of meta.layers.entries()) for (const fid of lm.cells) {
    const e = zip.get(`cells/${li}-${fid}.png`); if (e) blobs.set(li + '|' + fid, await e.blob('image/png'));
  }
  const P = projectFromMeta(store, meta, (lm, fid, li) => { const b = blobs.get(li + '|' + fid); return b ? Cell.fromBlob(b) : null; });
  let audio = null, ref = null;
  for (const [name, e] of zip) { if (name.startsWith('audio/')) audio = await e.blob(meta.audio?.type || ''); if (name === 'ref.png') ref = await e.blob('image/png'); }
  if (!audio) P.audio = null;
  const edited = !!meta.integrity && checksum(JSON.stringify({ frames: meta.frames, layers: meta.layers, title: meta.title, author: meta.author })) !== meta.integrity;
  return { ok: true, P, audio, ref, refMeta: meta.ref || null, edited, savedAt: meta.savedAt || null };
}

/* ═════════ Автозбереження (IndexedDB): опис + PNG змінених клітинок ═════════ */
const DB = 'edvault-animator';
let db = null;
function open() {
  return new Promise(res => {
    if (db) return res(db);
    if (!window.indexedDB) return res(null);
    let rq; try { rq = indexedDB.open(DB, 1); } catch { return res(null); }
    rq.onupgradeneeded = () => { rq.result.createObjectStore('kv'); rq.result.createObjectStore('cells'); };
    rq.onsuccess = () => { db = rq.result; res(db); };
    rq.onerror = rq.onblocked = () => res(null);
  });
}
const tx = (st, mode, fn) => new Promise((res, rej) => { const t = db.transaction(st, mode), r = fn(t.objectStore(st)); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); });
const saved = new WeakMap(); // клітинка → номер версії, вже записаної в базу

export async function autosave(P, extras = {}) {
  if (!(await open())) return false;
  const keys = new Set();
  for (const l of P.layers) for (const f of P.frames) {
    const c = l.cells.get(f.id); if (!c || c.empty) continue;
    const key = l.id + '|' + f.id; keys.add(key);
    if (saved.get(c) === c.rev + ':' + key) continue;
    const png = await c.png(); if (!png) continue;
    await tx('cells', 'readwrite', s => s.put(png, key));
    saved.set(c, c.rev + ':' + key);
  }
  const old = await tx('cells', 'readonly', s => s.getAllKeys());
  const stale = (old || []).filter(k => !keys.has(k));
  if (stale.length) await tx('cells', 'readwrite', s => { stale.forEach(k => s.delete(k)); });
  await tx('kv', 'readwrite', s => s.put({ meta: P.meta(), ui: extras.ui || {}, t: Date.now() }, 'project'));
  await tx('kv', 'readwrite', s => extras.audio ? s.put(extras.audio, 'audio') : s.delete('audio'));
  await tx('kv', 'readwrite', s => extras.ref ? s.put(extras.ref, 'ref') : s.delete('ref'));
  return true;
}
export async function restore() {
  if (!(await open())) return null;
  try {
    const rec = await tx('kv', 'readonly', s => s.get('project'));
    if (!rec || !okMeta(rec.meta)) return null;
    const blobs = new Map(), lids = rec.meta.layers.map(l => l.id);
    for (const [li, lm] of rec.meta.layers.entries()) for (const fid of lm.cells) { const b = await tx('cells', 'readonly', s => s.get(lids[li] + '|' + fid)); if (b) blobs.set(li + '|' + fid, b); }
    const P = projectFromMeta(store, rec.meta, (lm, fid, li) => { const b = blobs.get(li + '|' + fid); if (!b) return null; const c = Cell.fromBlob(b); saved.set(c, c.rev + ':' + lm.id + '|' + fid); return c; });
    const audio = await tx('kv', 'readonly', s => s.get('audio'));
    const ref = await tx('kv', 'readonly', s => s.get('ref'));
    if (!audio) P.audio = null;
    return { P, ui: rec.ui || {}, audio: audio || null, ref: ref || null };
  } catch { return null; }
}
export async function clearAutosave() { if (!(await open())) return; await tx('kv', 'readwrite', s => s.clear()); await tx('cells', 'readwrite', s => s.clear()); }

/* ═════════ Звук: одна доріжка під мультфільм ═════════ */
export class Audio {
  constructor() { this.blob = null; this.buf = null; this.ctx = null; this.src = null; }
  get ac() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); return this.ctx; }
  async set(blob) {
    this.stop(); this.blob = blob; this.buf = null;
    if (!blob) return true;
    try { this.buf = await this.ac.decodeAudioData(await blob.arrayBuffer()); return true; } catch { this.blob = null; return false; }
  }
  get duration() { return this.buf ? this.buf.duration : 0; }
  play(at = 0, dest) {
    this.stop(); if (!this.buf || at >= this.buf.duration) return;
    const s = this.ac.createBufferSource(); s.buffer = this.buf; s.connect(dest || this.ac.destination); s.start(0, at); this.src = s;
  }
  stop() { if (this.src) { try { this.src.stop(); } catch { /* уже зупинено */ } this.src.disconnect(); this.src = null; } }
  // хвиля для плівки: максимуми на n відрізках
  peaks(n) {
    if (!this.buf) return [];
    const d = this.buf.getChannelData(0), step = Math.max(1, Math.floor(d.length / n)), out = [];
    for (let i = 0; i < n; i++) { let m = 0; for (let k = i * step; k < Math.min(d.length, (i + 1) * step); k += 16) m = Math.max(m, Math.abs(d[k])); out.push(m); }
    return out;
  }
}

/* запис із мікрофона */
export async function recordMic(seconds, onTick) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : {}), chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const done = new Promise(r => rec.onstop = r);
  rec.start();
  const t0 = performance.now();
  const ctl = { stop: () => rec.state !== 'inactive' && rec.stop() };
  const timer = setInterval(() => { const s = (performance.now() - t0) / 1000; onTick && onTick(s); if (s >= seconds) ctl.stop(); }, 100);
  ctl.result = done.then(() => { clearInterval(timer); stream.getTracks().forEach(t => t.stop()); return new Blob(chunks, { type: rec.mimeType || 'audio/webm' }); });
  return ctl;
}
