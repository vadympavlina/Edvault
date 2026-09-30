// Операції редагування — кожна змінює проєкт і записує крок в історію.
import { S, media, uid, emit, layout, clipAt, srcTime, clipDur, musicDur, mainEnd, duration, commit, select, findSel, rippleShift, outputSize, ASPECTS } from './state.js';
import { seek } from './player.js';
import { toast } from './ui.js';

const FPS_EPS = 0.05;

function nearestAspect(w, h) {
  const r = w / h;
  let best = '16:9', bd = Infinity;
  for (const [k, [aw, ah]] of Object.entries(ASPECTS)) { const d = Math.abs(Math.log(r / (aw / ah))); if (d < bd) { bd = d; best = k; } }
  return best;
}

export function newClip(m) {
  return { id: uid('c'), mediaId: m.id, in: 0, out: m.kind === 'image' ? 5 : m.duration, speed: 1, volume: 1, muted: false, fadeIn: 0, fadeOut: 0, fit: 'contain', zoom: 1, zx: 0.5, zy: 0.5 };
}

// Додає відео/фото в кінець основної доріжки, аудіо — на музичну доріжку
export function addToTimeline(m, { silent = false, at = null } = {}) {
  const p = S.project;
  if (m.kind === 'audio') return addMusic(m, silent);
  if (!p.clips.length && m.width && m.height) p.aspect = nearestAspect(m.width, m.height);
  const c = newClip(m);
  if (at != null) p.clips.splice(at, 0, c); else p.clips.push(c);
  commit();
  if (!silent) { select('clip', c.id); toast(`«${m.name}» додано на таймлайн`); }
  return c;
}

export function addMusic(m, silent) {
  const p = S.project;
  const start = p.music.length ? Math.min(S.t, duration()) : 0;
  const len = mainEnd() > 0 ? Math.min(m.duration, Math.max(1, mainEnd() - start)) : m.duration;
  const x = { id: uid('a'), mediaId: m.id, start, in: 0, out: len, volume: mainEnd() > 0 ? 0.35 : 1, fadeIn: 0.5, fadeOut: 1.5 };
  p.music.push(x);
  commit();
  if (!silent) { select('music', x.id); toast(mainEnd() > 0 ? 'Музику додано під відео — гучність 35%, щоб не заглушати голос' : 'Аудіо додано'); }
  return x;
}

// ── розрізання ──
function splitList(list, id, t) {
  const i = list.findIndex(x => x.id === id);
  const o = list[i];
  if (!o || t <= o.start + 0.1 || t >= o.start + o.dur - 0.1) return false;
  const b = { ...structuredClone(o), id: uid(o.id[0]), start: t, dur: o.start + o.dur - t };
  o.dur = t - o.start;
  list.splice(i + 1, 0, b);
  return b;
}
export function splitAt(t = S.t) {
  const p = S.project, sel = findSel();
  // спершу — виділений елемент, якщо курсор на ньому
  if (sel && S.sel.kind === 'overlay' && splitList(p.overlays, sel.id, t)) { commit(); toast('Розрізано'); return true; }
  if (sel && S.sel.kind === 'caption' && splitList(p.captions, sel.id, t)) { commit(); toast('Розрізано'); return true; }
  if (sel && S.sel.kind === 'music') {
    const m = sel, d = musicDur(m);
    if (t > m.start + 0.1 && t < m.start + d - 0.1) {
      const b = { ...structuredClone(m), id: uid('a'), start: t, in: m.in + (t - m.start), fadeIn: 0 };
      m.out = m.in + (t - m.start); m.fadeOut = 0;
      p.music.splice(p.music.indexOf(m) + 1, 0, b);
      commit(); toast('Розрізано'); return true;
    }
  }
  const l = clipAt(t);
  if (!l || t <= l.start + FPS_EPS || t >= l.end - FPS_EPS) { toast('Поставте курсор усередину кліпу, щоб розрізати'); return false; }
  const c = l.clip, st = srcTime(l, t);
  const b = { ...structuredClone(c), id: uid('c'), in: st, fadeIn: 0 };
  c.out = st; c.fadeOut = 0;
  p.clips.splice(p.clips.indexOf(c) + 1, 0, b);
  commit();
  emit('did-cut');
  select('clip', b.id);
  return true;
}

// ── видалення ──
export function deleteSel() {
  const s = S.sel, o = findSel();
  if (!s || !o) return false;
  const p = S.project;
  if (s.kind === 'clip') {
    const l = layout().find(x => x.clip.id === o.id);
    p.clips = p.clips.filter(c => c.id !== o.id);
    rippleShift(l.start, -(l.end - l.start));
    if (S.t > l.start) seek(Math.max(l.start, S.t - (l.end - l.start)));
    emit('did-cut');
  } else if (s.kind === 'overlay') p.overlays = p.overlays.filter(x => x.id !== o.id);
  else if (s.kind === 'caption') p.captions = p.captions.filter(x => x.id !== o.id);
  else if (s.kind === 'music') p.music = p.music.filter(x => x.id !== o.id);
  select(null);
  commit();
  return true;
}

export function duplicateSel() {
  const s = S.sel, o = findSel();
  if (!o) return;
  const p = S.project;
  const copy = { ...structuredClone(o), id: uid(o.id[0]) };
  if (s.kind === 'clip') p.clips.splice(p.clips.indexOf(o) + 1, 0, copy);
  else if (s.kind === 'music') { copy.start = o.start + musicDur(o); p.music.push(copy); }
  else {
    copy.start = o.start + o.dur;
    (s.kind === 'overlay' ? p.overlays : p.captions).push(copy);
  }
  commit();
  select(s.kind, copy.id);
}

// ── вирізання діапазону [a, b) з основної доріжки ──
export function cutRange(a, b) {
  if (a == null || b == null) { toast('Спочатку позначте початок (I) і кінець (O) шматка'); return false; }
  if (b < a) [a, b] = [b, a];
  const end = mainEnd();
  b = Math.min(b, end);
  if (b - a < 0.05) { toast('Позначений шматок порожній'); return false; }
  const p = S.project;
  const out = [];
  for (const l of layout()) {
    const c = l.clip, sp = c.speed || 1;
    if (l.end <= a || l.start >= b) { out.push(c); continue; }
    if (l.start < a) { const left = { ...structuredClone(c), out: c.in + (a - l.start) * sp, fadeOut: 0 }; out.push(left); }
    if (l.end > b) { const right = { ...structuredClone(c), id: l.start < a ? uid('c') : c.id, in: c.in + (b - l.start) * sp, fadeIn: 0 }; out.push(right); }
  }
  p.clips = out;
  rippleShift(a, -(b - a));
  S.markIn = S.markOut = null;
  select(null);
  commit();
  seek(a);
  toast(`Вирізано ${(b - a).toFixed(1).replace('.', ',')} с`);
  emit('did-cut');
  return true;
}

// ── текст і елементи ──
export const TEXT_PRESETS = {
  title: { label: 'Заголовок', o: { text: 'Заголовок', size: 116, weight: 800, color: '#ffffff', bg: 'shadow', align: 'center', x: 0.08, y: 0.36, w: 0.84 } },
  subtitle: { label: 'Підзаголовок', o: { text: 'Короткий опис теми', size: 60, weight: 600, color: '#ffffff', bg: 'shadow', align: 'center', x: 0.12, y: 0.56, w: 0.76 } },
  lower: { label: 'Підпис (нижня третина)', o: { text: 'Ім’я Прізвище\nвчитель інформатики', size: 46, weight: 700, color: '#ffffff', bg: 'box', bgColor: '#4F6BF4', bgAlpha: 0.94, align: 'left', x: 0.05, y: 0.73, w: 0.4 } },
  step: { label: 'Крок', o: { text: 'Крок 1', size: 56, weight: 800, color: '#1a1d23', bg: 'box', bgColor: '#ffd43b', bgAlpha: 1, align: 'center', x: 0.04, y: 0.06, w: 0.16 } },
  note: { label: 'Примітка', o: { text: 'Зверніть увагу!', size: 50, weight: 700, color: '#ffffff', bg: 'box', bgColor: '#000000', bgAlpha: 0.72, align: 'left', x: 0.54, y: 0.07, w: 0.42 } },
  plain: { label: 'Звичайний текст', o: { text: 'Текст', size: 64, weight: 700, color: '#ffffff', bg: 'outline', bgColor: '#000000', align: 'left', x: 0.08, y: 0.1, w: 0.5 } },
};

export function addOverlay(type, extra = {}) {
  const p = S.project;
  const { W, H } = outputSize();
  const base = { id: uid('o'), type, start: Math.min(S.t, Math.max(0, duration() - 0.5)), dur: 4, fade: type === 'text' };
  let o;
  if (type === 'text') o = { ...base, ...structuredClone(TEXT_PRESETS[extra.preset || 'plain'].o) };
  else if (type === 'rect') o = { ...base, x: 0.3, y: 0.3, w: 0.4, h: 0.3, color: '#ef4444', stroke: 8, radius: 16, fill: false };
  else if (type === 'arrow') o = { ...base, x: 0.28, y: 0.3, w: 0.18, h: 0.16 * W / H, color: '#ef4444', stroke: 10 };
  else if (type === 'blur') o = { ...base, x: 0.35, y: 0.35, w: 0.3, h: 0.2, strength: 20, pixel: false, dur: 5 };
  else if (type === 'spot') o = { ...base, x: 0.3, y: 0.25, w: 0.4, h: 0.45, dim: 0.62, shape: 'rect', dur: 5, fade: true };
  else if (type === 'image') {
    const m = media.get(extra.mediaId);
    const w = 0.22, h = m ? w * (W / H) * (m.height / m.width) : 0.2;
    o = { ...base, mediaId: extra.mediaId, x: 0.74, y: 0.05, w, h, radius: 0, dur: Math.max(4, duration() - base.start) };
  }
  if (!o) return null;
  if (S.t >= duration() && duration() === 0) o.start = 0;
  p.overlays.push(o);
  commit();
  select('overlay', o.id);
  return o;
}

export function moveZ(dir) {
  const s = S.sel; if (!s || s.kind !== 'overlay') return;
  const a = S.project.overlays, i = a.findIndex(o => o.id === s.id);
  const j = dir > 0 ? a.length - 1 : 0;
  if (i < 0 || i === j) return;
  const [o] = a.splice(i, 1);
  if (dir > 0) a.push(o); else a.unshift(o);
  commit();
}

// ── субтитри ──
export function addCaption(text = '') {
  const p = S.project;
  const start = S.t;
  // не накладаємо на наступний субтитр
  const next = p.captions.filter(c => c.start > start + 0.01).sort((a, b) => a.start - b.start)[0];
  const dur = Math.max(0.5, Math.min(3, next ? next.start - start : 3));
  const c = { id: uid('s'), start, dur, text: text || 'Новий субтитр' };
  p.captions.push(c);
  p.captions.sort((a, b) => a.start - b.start);
  commit();
  select('caption', c.id);
  return c;
}
export function setCaptions(list, replace) {
  const p = S.project;
  const items = list.map(c => ({ id: uid('s'), start: c.start, dur: c.dur, text: c.text }));
  p.captions = replace ? items : p.captions.concat(items).sort((a, b) => a.start - b.start);
  commit();
}

export function trimMusicToVideo(x) {
  const end = mainEnd();
  if (end <= x.start) return;
  x.out = Math.min(x.out, x.in + (end - x.start));
  commit();
}

export function clipLabel(c) { const m = media.get(c.mediaId); return m ? m.name : 'Кліп'; }
export { clipDur };
