// Перегляд: відтворення через <video>/<audio> з синхронізацією за таймлайном.
import { S, media, emit, on, layout, clipAt, srcTime, duration, musicDur, outputSize } from './state.js';
import { renderScene, fadeAlpha } from './render.js';

let canvas, ctx;
let actx = null;
const gains = new Map(); // HTMLMediaElement → GainNode
let raf = 0, startPerf = 0, startT = 0;
let seekPending = new Set();

export function initPlayer(cv) {
  canvas = cv;
  ctx = canvas.getContext('2d');
  on('project', () => { if (!S.playing) requestDraw(); });
  on('media', () => { if (!S.playing) requestDraw(); });
  on('tails', () => { if (!S.playing) requestDraw(); });
}

export function resizeCanvas(maxW, maxH) {
  const { W, H } = outputSize();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = Math.min(maxW / W, maxH / H);
  const cssW = Math.max(40, Math.floor(W * r)), cssH = Math.max(40, Math.floor(H * r));
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  const scale = Math.min(1, (cssW * dpr) / W);
  const pw = Math.round(W * scale), ph = Math.round(H * scale);
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  requestDraw();
  return { cssW, cssH };
}

function audioCtx() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) actx = new AC();
  }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
function gainFor(el) {
  if (gains.has(el)) return gains.get(el);
  const a = audioCtx();
  if (!a) return null;
  try {
    const src = a.createMediaElementSource(el);
    const g = a.createGain();
    src.connect(g).connect(a.destination);
    gains.set(el, g);
    return g;
  } catch (e) { gains.set(el, null); return null; }
}
function setVolume(el, v) {
  if (S.recMute) v = 0; // під час запису голосу — тиша, щоб звук не потрапив у мікрофон
  const g = gains.get(el) ?? (S.playing ? gainFor(el) : null);
  if (g) { g.gain.value = v; el.volume = 1; }
  else el.volume = Math.max(0, Math.min(1, v));
}

// джерело кадру для перегляду — відеоелемент або зображення
function previewProvider(l) {
  const m = media.get(l.clip.mediaId);
  if (!m || !m.el) return null;
  if (m.kind === 'image') return { src: m.el, w: m.width, h: m.height };
  const v = m.el;
  if (v.readyState < 2) return null;
  return { src: v, w: v.videoWidth || m.width, h: v.videoHeight || m.height };
}

let drawQueued = false;
export function requestDraw() {
  if (drawQueued || !ctx) return;
  drawQueued = true;
  requestAnimationFrame(() => { drawQueued = false; draw(); });
}
function draw() {
  if (!ctx) return;
  renderScene(ctx, canvas.width, canvas.height, S.t, previewProvider, undefined, { editing: !S.playing });
}

// ── перемотування ──
export function seek(t) {
  const d = duration();
  S.t = Math.max(0, Math.min(t, d));
  if (S.playing) { startPerf = performance.now(); startT = S.t; syncElements(true); }
  else syncPaused();
  requestDraw();
  emit('time');
}

function syncPaused() {
  const l = clipAt(S.t);
  if (!l) return;
  const m = media.get(l.clip.mediaId);
  if (!m || m.kind !== 'video') return;
  const v = m.el, st = srcTime(l, S.t);
  if (Math.abs(v.currentTime - st) > 0.02 || v.readyState < 2) {
    if (!seekPending.has(v)) {
      seekPending.add(v);
      v.addEventListener('seeked', () => { seekPending.delete(v); requestDraw(); if (!S.playing) syncPaused(); }, { once: true });
    }
    v.currentTime = st;
  }
}

// ── відтворення ──
export function play() {
  if (S.playing) return;
  const d = duration();
  if (d <= 0) return;
  if (S.t >= d - 0.02) S.t = 0;
  audioCtx();
  S.playing = true;
  startPerf = performance.now(); startT = S.t;
  syncElements(true);
  emit('play');
  raf = requestAnimationFrame(tick);
}
export function pause() {
  if (!S.playing) return;
  S.playing = false;
  cancelAnimationFrame(raf);
  media.forEach(m => { if (m.el && m.el.pause) m.el.pause(); });
  emit('play');
  syncPaused();
  requestDraw();
}
export const toggle = () => (S.playing ? pause() : play());

function tick(now) {
  if (!S.playing) return;
  const d = duration();
  let t = startT + (now - startPerf) / 1000;
  const L = layout();
  // якщо активне відео підвисло (буферизація) — тримаємо годинник за ним
  const l = clipAt(t, L);
  if (l) {
    const m = media.get(l.clip.mediaId);
    if (m && m.kind === 'video' && !m.el.paused && m.el.readyState < 3) { startPerf = now; startT = S.t; t = S.t; }
  }
  if (t >= d) { S.t = d; pause(); emit('time'); return; }
  S.t = t;
  syncElements(false, L);
  draw();
  emit('time');
  raf = requestAnimationFrame(tick);
}

function syncElements(hard, L = layout()) {
  const t = S.t;
  const active = new Set();
  const l = clipAt(t, L);
  if (l) {
    const c = l.clip, m = media.get(c.mediaId);
    if (m && m.kind === 'video') {
      const v = m.el, st = srcTime(l, t);
      active.add(v);
      const rate = c.speed || 1;
      if (v.playbackRate !== rate) v.playbackRate = rate;
      v.preservesPitch = true;
      const drift = Math.abs(v.currentTime - st);
      if (hard || drift > 0.25 || v.paused && drift > 0.05) v.currentTime = st;
      const vol = c.muted ? 0 : (c.volume ?? 1) * fadeAlpha(t, l.start, l.end - l.start, c.fadeIn || 0, c.fadeOut || 0);
      setVolume(v, vol);
      if (v.paused) v.play().catch(() => {});
    }
  }
  for (const mu of S.project.music) {
    const m = media.get(mu.mediaId);
    if (!m || !m.el) continue;
    const md = musicDur(mu);
    if (t < mu.start || t >= mu.start + md) continue;
    const a = m.el, st = mu.in + (t - mu.start);
    active.add(a);
    if (hard || Math.abs(a.currentTime - st) > 0.3) a.currentTime = st;
    setVolume(a, (mu.volume ?? 1) * fadeAlpha(t, mu.start, md, mu.fadeIn || 0, mu.fadeOut || 0));
    if (a.paused) a.play().catch(() => {});
  }
  media.forEach(m => { if (m.el && m.el.pause && !active.has(m.el) && !m.el.paused) m.el.pause(); });
}

// знімок поточного кадру в PNG у повній роздільності
export async function snapshot() {
  const { W, H } = outputSize();
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  renderScene(c.getContext('2d'), W, H, S.t, previewProvider);
  return new Promise(r => c.toBlob(r, 'image/png'));
}

export const previewCanvas = () => canvas;
