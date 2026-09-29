// Мікшування звуку для експорту: блоками, щоб довгі відео не займали всю пам'ять.
// Швидкість кліпу змінюється без зміни тону (granular overlap-add).
import { AudioBufferSink } from '../vendor/mediabunny.min.mjs';
import { S, media, layout, musicDur } from './state.js';
import { fadeAlpha } from './render.js';

export const SR = 48000;
const sinks = new Map();
const sinkFor = m => { if (!sinks.has(m.id)) sinks.set(m.id, new AudioBufferSink(m.at)); return sinks.get(m.id); };
export function resetAudioSinks() { sinks.clear(); }

// Читає PCM джерела [from, to) і перераховує в SR. Повертає [L, R].
async function readPCM(m, from, to) {
  from = Math.max(0, from); to = Math.min(m.duration, to);
  const len = Math.max(0, Math.ceil((to - from) * SR));
  const L = new Float32Array(len), R = new Float32Array(len);
  if (!len) return [L, R];
  for await (const w of sinkFor(m).buffers(from, to)) {
    const b = w.buffer, sr = b.sampleRate;
    const c0 = b.getChannelData(0), c1 = b.getChannelData(Math.min(1, b.numberOfChannels - 1));
    const j0 = Math.max(0, Math.floor((w.timestamp - from) * SR));
    const j1 = Math.min(len, Math.ceil((w.timestamp + w.duration - from) * SR));
    for (let j = j0; j < j1; j++) {
      const pos = ((from + j / SR) - w.timestamp) * sr;
      const i = Math.floor(pos);
      if (i < 0 || i >= c0.length) continue;
      const f = pos - i, i2 = Math.min(c0.length - 1, i + 1);
      L[j] = c0[i] + (c0[i2] - c0[i]) * f;
      R[j] = c1[i] + (c1[i2] - c1[i]) * f;
    }
  }
  return [L, R];
}

// Сегменти звуку, що потрапляють у [t0, t1)
function segments(t0, t1) {
  const out = [];
  for (const l of layout()) {
    if (l.end <= t0 || l.start >= t1) continue;
    const c = l.clip, m = media.get(c.mediaId);
    if (!m || !m.at || !m.canDecodeA || c.muted || (c.volume ?? 1) <= 0) continue;
    out.push({ m, start: l.start, end: l.end, srcIn: c.in, speed: c.speed || 1, vol: c.volume ?? 1, fin: c.fadeIn || 0, fout: c.fadeOut || 0 });
  }
  for (const mu of S.project.music) {
    const m = media.get(mu.mediaId);
    const d = musicDur(mu);
    if (!m || !m.at || !m.canDecodeA || mu.start + d <= t0 || mu.start >= t1) continue;
    out.push({ m, start: mu.start, end: mu.start + d, srcIn: mu.in, speed: 1, vol: mu.volume ?? 1, fin: mu.fadeIn || 0, fout: mu.fadeOut || 0 });
  }
  return out;
}

const GRAIN = Math.round(0.05 * SR), HOP = GRAIN / 2;
const WIN = new Float32Array(GRAIN).map((_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / GRAIN)); // періодичне вікно Ганна: сума з 50% перекриттям = 1

// Рендерить блок [t0, t1) таймлайну в AudioBuffer (48 кГц, стерео)
export async function renderBlock(t0, t1) {
  const n = Math.max(1, Math.round((t1 - t0) * SR));
  const outL = new Float32Array(n), outR = new Float32Array(n);
  for (const s of segments(t0, t1)) {
    const a = Math.max(t0, s.start), b = Math.min(t1, s.end);
    const o0 = Math.round((a - t0) * SR), o1 = Math.round((b - t0) * SR);
    if (o1 <= o0) continue;
    const gain = j => s.vol * fadeAlpha(t0 + j / SR, s.start, s.end - s.start, s.fin, s.fout);
    if (Math.abs(s.speed - 1) < 1e-3) {
      const from = s.srcIn + (a - s.start);
      const [L, R] = await readPCM(s.m, from, from + (o1 - o0) / SR + 1 / SR);
      for (let j = o0, i = 0; j < o1; j++, i++) { const g = gain(j); outL[j] += (L[i] || 0) * g; outR[j] += (R[i] || 0) * g; }
      continue;
    }
    // зміна швидкості без зміни тону: зерна по 50 мс, крок виходу HOP, крок у джерелі HOP*speed
    const segStartIdx = Math.round((s.start - t0) * SR); // індекс початку сегмента відносно блока (може бути від'ємним)
    const rel0 = o0 - segStartIdx, rel1 = o1 - segStartIdx; // позиції всередині сегмента (у вихідних семплах)
    const k0 = Math.max(0, Math.floor((rel0 - GRAIN) / HOP) + 1), k1 = Math.floor((rel1 - 1) / HOP);
    const srcFrom = s.srcIn + (k0 * HOP * s.speed) / SR;
    const srcTo = s.srcIn + (k1 * HOP * s.speed + GRAIN) / SR;
    const [L, R] = await readPCM(s.m, srcFrom, srcTo + 1 / SR);
    const base = Math.round(srcFrom * SR);
    for (let k = k0; k <= k1; k++) {
      const oStart = k * HOP;                                 // початок зерна у виході (відносно сегмента)
      const sStart = Math.round(s.srcIn * SR + oStart * s.speed) - base; // початок зерна в прочитаному PCM
      for (let i = 0; i < GRAIN; i++) {
        const rel = oStart + i;
        if (rel < rel0 || rel >= rel1) continue;
        const j = rel + segStartIdx;
        const si = sStart + i;
        if (si < 0 || si >= L.length) continue;
        const g = gain(j) * WIN[i];
        outL[j] += L[si] * g; outR[j] += R[si] * g;
      }
    }
  }
  // м'яке обмеження, щоб суміш не «хрипіла»
  for (let j = 0; j < n; j++) {
    if (outL[j] > 1 || outL[j] < -1) outL[j] = Math.tanh(outL[j]);
    if (outR[j] > 1 || outR[j] < -1) outR[j] = Math.tanh(outR[j]);
  }
  const buf = new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate: SR });
  buf.copyToChannel(outL, 0); buf.copyToChannel(outR, 1);
  return buf;
}

export function hasAnyAudio() {
  return layout().some(l => { const m = media.get(l.clip.mediaId); return m && m.at && m.canDecodeA && !l.clip.muted; })
    || S.project.music.some(mu => { const m = media.get(mu.mediaId); return m && m.at && m.canDecodeA; });
}
