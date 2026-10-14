// Аніматор · експорт: GIF, відео (MP4 або WebM зі звуком), PNG кадру, усі кадри в ZIP, спрайт-лист для ігор.
import { makeZip } from '../../../emulators/bloggeremu/js/zip.js';
import { trim } from './cells.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const nextTick = () => new Promise(r => setTimeout(r, 0));

// Готовий кадр fi (тло + видимі шари) у canvas потрібного розміру
export async function renderFrame(stage, fi, scale = 1, { transparent = false } = {}) {
  const P = stage.P, f = P.frames[fi];
  await Promise.all(P.layers.map(l => { const c = l.cells.get(f.id); return c && c.blob && !c.canvas ? c.load() : null; }));
  const out = mk(Math.round(P.w * scale), Math.round(P.h * scale));
  stage.composeFrame(fi, out, { withBg: !transparent });
  return out;
}
// Усі кадри по черзі (з урахуванням тривалості) — для GIF і відео
async function* frames(stage, scale, onProgress) {
  const P = stage.P;
  for (let i = 0; i < P.frames.length; i++) {
    const cv = await renderFrame(stage, i, scale);
    yield { i, cv, ms: P.frames[i].hold * 1000 / P.fps };
    if (onProgress) onProgress((i + 1) / P.frames.length);
    if (i % 8 === 7) { await trim(stage.keepCells()); await nextTick(); }
  }
}

export async function exportGif(stage, { scale = 1, onProgress } = {}) {
  const P = stage.P, list = [];
  for await (const fr of frames(stage, scale, p => onProgress && onProgress(p * 0.4))) {
    const d = fr.cv.getContext('2d').getImageData(0, 0, fr.cv.width, fr.cv.height).data;
    // однакові сусідні кадри зливаємо в один довший
    const prev = list[list.length - 1];
    if (prev && equal(prev.data, d)) { prev.delay += fr.ms; continue; }
    list.push({ data: d, delay: fr.ms });
  }
  const w = Math.round(P.w * scale), h = Math.round(P.h * scale);
  return new Promise((res, rej) => {
    const wk = new Worker(new URL('./gif-worker.js', import.meta.url), { type: 'module' });
    wk.onmessage = e => {
      if (e.data.progress != null) onProgress && onProgress(0.4 + e.data.progress * 0.6);
      else if (e.data.done) { wk.terminate(); res(new Blob([e.data.done], { type: 'image/gif' })); }
      else if (e.data.error) { wk.terminate(); rej(new Error(e.data.error)); }
    };
    wk.onerror = e => { wk.terminate(); rej(new Error(e.message || 'GIF')); };
    const payload = list.map(f => ({ buf: f.data.buffer, delay: f.delay }));
    wk.postMessage({ w, h, frames: payload }, payload.map(f => f.buf));
  });
}
function equal(a, b) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) return false; return true; }

export function videoType() {
  if (!window.MediaRecorder) return null;
  const list = [['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'mp4'], ['video/mp4', 'mp4'], ['video/webm;codecs=vp9,opus', 'webm'], ['video/webm;codecs=vp8,opus', 'webm'], ['video/webm', 'webm']];
  for (const [t, ext] of list) if (MediaRecorder.isTypeSupported(t)) return { type: t, ext };
  return null;
}
// Відео записується в реальному часі: мультфільм програється в прихованому полотні
export async function exportVideo(stage, audio, { onProgress, loops = 1 } = {}) {
  const vt = videoType(); if (!vt) throw new Error('Браузер не вміє записувати відео. Спробуйте Chrome або Edge.');
  const P = stage.P, w = P.w - (P.w % 2), h = P.h - (P.h % 2);
  const ready = [];
  for await (const fr of frames(stage, 1, p => onProgress && onProgress(p * 0.2))) ready.push({ bmp: await createImageBitmap(fr.cv), ms: fr.ms });
  const cv = mk(w, h), g = cv.getContext('2d');
  g.drawImage(ready[0].bmp, 0, 0, w, h);
  const stream = cv.captureStream(0), vtrack = stream.getVideoTracks()[0];
  let dest = null;
  if (audio && audio.buf) { dest = audio.ac.createMediaStreamDestination(); dest.stream.getAudioTracks().forEach(t => stream.addTrack(t)); await audio.ac.resume(); }
  const rec = new MediaRecorder(stream, { mimeType: vt.type, videoBitsPerSecond: 6e6 }), chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const stopped = new Promise(r => rec.onstop = r);
  const total = ready.reduce((s, f) => s + f.ms, 0) * loops;
  rec.start(250);
  if (dest) audio.play(0, dest);
  const t0 = performance.now();
  let k = 0, acc = 0;
  for (let loop = 0; loop < loops; loop++) for (const f of ready) {
    g.fillStyle = P.bg; g.fillRect(0, 0, w, h); g.drawImage(f.bmp, 0, 0, w, h);
    vtrack.requestFrame && vtrack.requestFrame();
    acc += f.ms; k++;
    const wait = t0 + acc - performance.now();
    if (onProgress) onProgress(0.2 + 0.8 * acc / total);
    await new Promise(r => setTimeout(r, Math.max(0, wait)));
  }
  // хвіст звуку, якщо він довший за мультфільм, обрізаємо — відео дорівнює мультфільму
  rec.stop(); if (dest) audio.stop();
  await stopped;
  ready.forEach(f => f.bmp.close && f.bmp.close());
  return { blob: new Blob(chunks, { type: vt.type.split(';')[0] }), ext: vt.ext };
}

export async function exportPng(stage, fi, transparent) {
  const cv = await renderFrame(stage, fi, 1, { transparent });
  return new Promise(r => cv.toBlob(r, 'image/png'));
}
export async function exportPngZip(stage, onProgress) {
  const entries = [];
  for await (const fr of frames(stage, 1, onProgress)) entries.push({ name: `kadr-${String(fr.i + 1).padStart(3, '0')}.png`, data: await new Promise(r => fr.cv.toBlob(r, 'image/png')) });
  return new Blob([await makeZip(entries)], { type: 'application/zip' });
}
// Спрайт-лист: усі кадри в сітку + опис для ігрових рушіїв
export async function exportSprite(stage, { maxW = 4096, transparent = true, onProgress } = {}) {
  const P = stage.P, n = P.frames.length;
  let cols = Math.ceil(Math.sqrt(n * P.h / P.w)), scale = 1;
  if (cols * P.w > maxW) scale = maxW / (cols * P.w);
  const fw = Math.floor(P.w * scale), fh = Math.floor(P.h * scale), rows = Math.ceil(n / cols);
  const sheet = mk(cols * fw, rows * fh), g = sheet.getContext('2d');
  for (let i = 0; i < n; i++) {
    const cv = await renderFrame(stage, i, scale, { transparent });
    g.drawImage(cv, (i % cols) * fw, Math.floor(i / cols) * fh);
    onProgress && onProgress((i + 1) / n);
    if (i % 8 === 7) { await trim(stage.keepCells()); await nextTick(); }
  }
  const png = await new Promise(r => sheet.toBlob(r, 'image/png'));
  const json = { image: 'sprite.png', frameWidth: fw, frameHeight: fh, columns: cols, rows, frames: P.frames.map((f, i) => ({ x: (i % cols) * fw, y: Math.floor(i / cols) * fh, w: fw, h: fh, durationMs: Math.round(f.hold * 1000 / P.fps) })) };
  return { png, json, cols, rows, fw, fh };
}
