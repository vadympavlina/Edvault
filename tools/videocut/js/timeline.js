// Таймлайн: доріжки, перетягування, обрізання, прилипання, зум.
// Мініатюри й хвилі малюються лише для видимої частини — це тримає швидкість навіть на годинних відео.
import { S, media, emit, on, layout, duration, clipDur, musicDur, snap, commit, rippleShift, select, findSel } from './state.js';
import { thumbAt, PEAKS_RATE } from './media.js';
import { seek } from './player.js';
import { $, esc, icon, clamp, fmt } from './ui.js';

const ROW = 28, CC_H = 30, V_H = 66, A_H = 44, RULER_H = 26;
const OV_LABEL = { text: 'Текст', rect: 'Рамка', arrow: 'Стрілка', blur: 'Розмиття', spot: 'Прожектор', image: 'Зображення', emoji: 'Емодзі', progress: 'Прогрес' };
const OV_ICON = { text: 'text', rect: 'rect', arrow: 'arrow', blur: 'blur', spot: 'spot', image: 'image', emoji: 'smile', progress: 'progress' };
const TR_NAMES = { fade: 'Розчинення', black: 'Через чорне', slide: 'Зсув', wipe: 'Шторка', zoom: 'Наближення' };

let scroll, inner, lanes, heads, ruler, playheadEl, rangeEl, insertEl;
let vCanvas, aCanvas;
let ovRows = 1;
let muRows = 1, muRowOf = new Map();

export function initTimeline() {
  scroll = $('tlScroll'); inner = $('tlInner'); lanes = $('tlLanes'); heads = $('tlHeads');
  ruler = $('tlRuler'); playheadEl = $('tlPlayhead'); rangeEl = $('tlRange'); insertEl = $('tlInsert');
  on('project', render);
  on('select', render);
  on('media', render);
  on('thumbs', drawCanvases);
  on('peaks', drawCanvases);
  on('time', () => { placePlayhead(); if (S.playing) follow(); });
  on('marks', () => { placeRange(); drawRuler(); });
  on('silences', render);
  scroll.addEventListener('scroll', () => { heads.scrollTop = scroll.scrollTop; drawCanvases(); drawRuler(); });
  window.addEventListener('resize', () => { render(); });
  scroll.addEventListener('wheel', onWheel, { passive: false });
  inner.addEventListener('pointerdown', onDown);
  inner.addEventListener('dblclick', e => {
    const it = e.target.closest('.it');
    if (it) { select(it.dataset.kind, it.dataset.id); emit('focus-inspector'); }
  });
  $('tlZoom').addEventListener('input', e => setZoom(zoomFromSlider(+e.target.value)));
  render();
}

// ── зум ──
const ZMIN = 2, ZMAX = 400;
const sliderFromZoom = z => Math.round(100 * Math.log(z / ZMIN) / Math.log(ZMAX / ZMIN));
const zoomFromSlider = v => ZMIN * Math.pow(ZMAX / ZMIN, v / 100);
export function setZoom(pps, anchorT = S.t) {
  pps = clamp(pps, ZMIN, ZMAX);
  const ax = anchorT * S.pps - scroll.scrollLeft;
  S.pps = pps;
  render();
  scroll.scrollLeft = Math.max(0, anchorT * pps - ax);
  $('tlZoom').value = sliderFromZoom(pps);
  drawCanvases(); drawRuler();
}
export function zoomBy(f) { setZoom(S.pps * f); }
export function zoomFit() {
  const d = Math.max(1, duration());
  setZoom((scroll.clientWidth - 40) / d, 0);
  scroll.scrollLeft = 0;
}
function onWheel(e) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    const rect = scroll.getBoundingClientRect();
    const t = (e.clientX - rect.left + scroll.scrollLeft) / S.pps;
    const pps = clamp(S.pps * Math.pow(1.0015, -e.deltaY), ZMIN, ZMAX);
    const ax = e.clientX - rect.left;
    S.pps = pps; render();
    scroll.scrollLeft = Math.max(0, t * pps - ax);
    $('tlZoom').value = sliderFromZoom(pps);
    drawCanvases(); drawRuler();
  } else if (!e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    // коліщатко: якщо доріжок більше, ніж вміщується, — прокручуємо їх вертикально,
    // а в кінці (або якщо все вміщується) — рухаємо таймлайн по горизонталі
    const canV = scroll.scrollHeight > scroll.clientHeight + 1;
    const atEdge = e.deltaY > 0 ? scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 1 : scroll.scrollTop <= 0;
    if (canV && !atEdge) return;
    e.preventDefault();
    scroll.scrollLeft += e.deltaY;
  }
}

// ── рендер ──
function assignRows(items) {
  const rows = [];
  const sorted = items.slice().sort((a, b) => a.start - b.start);
  const rowOf = new Map();
  for (const o of sorted) {
    let r = rows.findIndex(end => end <= o.start + 1e-6);
    if (r < 0) { r = rows.length; rows.push(0); }
    rows[r] = o.start + o.dur;
    rowOf.set(o.id, r);
  }
  return { rowOf, n: Math.max(1, rows.length) };
}

export function render() {
  if (!scroll) return;
  const p = S.project, pps = S.pps;
  const d = duration();
  const width = Math.max(scroll.clientWidth, (d + 8) * pps);
  inner.style.width = width + 'px';
  const sel = S.sel;
  const selCls = (k, id) => (sel && sel.kind === k && sel.id === id ? ' sel' : '');
  const hnd = '<i class="h h-l"></i><i class="h h-r"></i>';

  const { rowOf, n } = assignRows(p.overlays);
  ovRows = n;
  const ovH = n * ROW + 6;

  const ov = p.overlays.map(o => {
    const label = o.type === 'text' ? (o.text || '').split('\n')[0] : o.type === 'emoji' ? (o.emoji || '') + ' ' + OV_LABEL.emoji : OV_LABEL[o.type];
    return `<div class="it ov ov-${o.type}${selCls('overlay', o.id)}" data-kind="overlay" data-id="${o.id}" style="left:${o.start * pps}px;width:${Math.max(4, o.dur * pps)}px;top:${3 + rowOf.get(o.id) * ROW}px">${icon(OV_ICON[o.type] || 'shapes')}<span>${esc(label)}</span>${hnd}</div>`;
  }).join('');
  const cc = p.captions.map(c => `<div class="it cc${selCls('caption', c.id)}" data-kind="caption" data-id="${c.id}" style="left:${c.start * pps}px;width:${Math.max(4, c.dur * pps)}px"><span>${esc(c.text)}</span>${hnd}</div>`).join('');
  const clips = layout().map((l, idx) => {
    const c = l.clip, m = media.get(c.mediaId);
    const badges = [];
    if (c.look && c.look !== 'none') badges.push('фільтр');
    if ((c.speed || 1) !== 1) badges.push(`${String(c.speed).replace('.', ',')}×`);
    if (c.muted) badges.push('без звуку');
    if ((c.zoom || 1) > 1.001) badges.push('зум');
    const fi = c.fadeIn ? `<b class="fade fi" style="width:${Math.min(c.fadeIn * pps, (l.end - l.start) * pps / 2)}px"></b>` : '';
    const fo = c.fadeOut ? `<b class="fade fo" style="width:${Math.min(c.fadeOut * pps, (l.end - l.start) * pps / 2)}px"></b>` : '';
    const trm = c.tr && idx > 0 ? `<b class="tr-zone" style="width:${Math.min((c.tr.d || 0.6) * pps, (l.end - l.start) * pps)}px" title="Перехід: ${TR_NAMES[c.tr.type] || ''}"></b>` : '';
    return `<div class="it clip${selCls('clip', c.id)}${m ? '' : ' missing'}" data-kind="clip" data-id="${c.id}" style="left:${l.start * pps}px;width:${Math.max(4, (l.end - l.start) * pps)}px">${fi}${fo}${trm}<span class="lbl">${esc(m ? m.name : 'Файл відсутній')}${badges.length ? ' · ' + badges.join(' · ') : ''}</span>${hnd}</div>`;
  }).join('');
  const mr = assignRows(p.music.map(x => ({ id: x.id, start: x.start, dur: musicDur(x) })));
  muRows = mr.n; muRowOf = mr.rowOf;
  const mu = p.music.map(x => {
    const m = media.get(x.mediaId);
    return `<div class="it mu${x.voice ? ' voice' : ''}${selCls('music', x.id)}" data-kind="music" data-id="${x.id}" style="left:${x.start * pps}px;width:${Math.max(4, musicDur(x) * pps)}px;top:${4 + (muRowOf.get(x.id) || 0) * A_H}px"><span class="lbl">${icon(x.voice ? 'mic' : 'music')}${esc(x.voice ? 'Голос' : m ? m.name : 'Файл відсутній')}</span>${hnd}</div>`;
  }).join('');
  const sil = (S.silPreview || []).map(([a, b]) => `<div class="sil" style="left:${a * pps}px;width:${Math.max(2, (b - a) * pps)}px"></div>`).join('');

  const empty = (cond, text) => (cond ? `<div class="lane-empty">${text}</div>` : '');
  // основне відео — одразу під лінійкою, щоб завжди було видно
  lanes.innerHTML =
    `<div class="lane lane-v" style="height:${V_H}px"><canvas class="lane-canvas" id="tlVCanvas"></canvas>${empty(!p.clips.length, 'Перетягніть сюди відео або фото')}${clips}${sil}</div>` +
    `<div class="lane lane-a" style="height:${A_H * muRows}px"><canvas class="lane-canvas" id="tlACanvas"></canvas>${empty(!p.music.length, 'Музика та озвучення')}${mu}</div>` +
    `<div class="lane lane-cc" style="height:${CC_H}px">${empty(!p.captions.length, 'Субтитри — вкладка «Субтитри» ліворуч')}${cc}</div>` +
    `<div class="lane lane-ov" style="height:${ovH}px">${empty(!p.overlays.length, 'Текст, стрілки, розмиття — вкладки «Текст» і «Елементи»')}${ov}</div>`;
  heads.innerHTML =
    `<div class="head" style="height:${RULER_H}px"></div>` +
    `<div class="head head-v" style="height:${V_H}px">${icon('video')}<span>Відео</span></div>` +
    `<div class="head" style="height:${A_H * muRows}px">${icon('music')}<span>Звук</span></div>` +
    `<div class="head" style="height:${CC_H}px">${icon('cc')}<span>Субтитри</span></div>` +
    `<div class="head" style="height:${ovH}px">${icon('text')}<span>Графіка</span></div><div style="height:40px"></div>`;
  vCanvas = $('tlVCanvas'); aCanvas = $('tlACanvas');
  placePlayhead(); placeRange(); drawRuler(); drawCanvases();
  $('tlDur').textContent = fmt(d, true);
}

function placePlayhead() {
  playheadEl.style.transform = `translateX(${S.t * S.pps}px)`;
  $('tlTime').textContent = fmt(S.t, true);
}
function placeRange() {
  const a = S.markIn, b = S.markOut;
  if (a == null && b == null) { rangeEl.hidden = true; return; }
  const x0 = (a ?? 0) * S.pps, x1 = (b ?? duration()) * S.pps;
  rangeEl.hidden = false;
  rangeEl.style.left = Math.min(x0, x1) + 'px';
  rangeEl.style.width = Math.max(1, Math.abs(x1 - x0)) + 'px';
}
function follow() {
  const x = S.t * S.pps, w = scroll.clientWidth;
  if (x > scroll.scrollLeft + w - 60) scroll.scrollLeft = x - 80;
  else if (x < scroll.scrollLeft) scroll.scrollLeft = Math.max(0, x - 80);
}

function sizeCanvas(c, h) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = scroll.clientWidth;
  c.style.left = scroll.scrollLeft + 'px';
  c.style.width = w + 'px'; c.style.height = h + 'px';
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  return g;
}

function drawWave(g, m, srcFrom, speed, x0, x1, top, h, color, pps) {
  if (!m || !m.peaks) return;
  g.fillStyle = color;
  const mid = top + h / 2;
  for (let x = Math.max(0, Math.floor(x0)); x < x1; x += 2) {
    const tA = srcFrom + ((x - x0) / pps) * speed, tB = tA + (2 / pps) * speed;
    let peak = 0;
    for (let i = Math.floor(tA * PEAKS_RATE), e = Math.max(i + 1, Math.ceil(tB * PEAKS_RATE)); i < e && i < m.peaks.length; i++) if (m.peaks[i] > peak) peak = m.peaks[i];
    const a = Math.max(0.5, Math.min(1, Math.sqrt(peak)) * h / 2);
    g.fillRect(x, mid - a, 1.5, a * 2);
  }
}

function drawCanvases() {
  if (!vCanvas || !aCanvas) return;
  const sl = scroll.scrollLeft, w = scroll.clientWidth, pps = S.pps;
  const gv = sizeCanvas(vCanvas, V_H);
  for (const l of layout()) {
    const x0 = l.start * pps - sl, x1 = l.end * pps - sl;
    if (x1 < 0 || x0 > w) continue;
    const c = l.clip, m = media.get(c.mediaId);
    if (!m) continue;
    const top = 3, h = V_H - 6;
    g_clip(gv, x0 + 1, top, x1 - x0 - 2, h, 6);
    gv.save(); gv.clip();
    if (m.thumbs.length) {
      const th = m.thumbs[0].c;
      const tw = Math.max(20, h * th.width / th.height);
      const startTile = Math.max(0, Math.floor(-x0 / tw));
      for (let x = x0 + startTile * tw; x < Math.min(x1, w); x += tw) {
        const st = m.kind === 'image' ? 0 : c.in + ((x - x0 + tw / 2) / pps) * (c.speed || 1);
        const img = m.kind === 'image' ? th : thumbAt(m, st);
        if (img) gv.drawImage(img, x, top, tw, h);
      }
    }
    // хвиля звуку в нижній частині кліпу
    if (m.peaks && !c.muted) {
      gv.fillStyle = 'rgba(0,0,0,.35)'; gv.fillRect(x0, top + h - 18, x1 - x0, 18);
      drawWave(gv, m, c.in, c.speed || 1, x0, Math.min(x1, w), top + h - 17, 16, 'rgba(255,255,255,.85)', pps);
    }
    gv.restore();
  }
  const ga = sizeCanvas(aCanvas, A_H * muRows);
  const waveA = getComputedStyle(document.documentElement).getPropertyValue('--wave-a').trim() || '#10b981';
  for (const mu of S.project.music) {
    const x0 = mu.start * pps - sl, x1 = (mu.start + musicDur(mu)) * pps - sl;
    if (x1 < 0 || x0 > w) continue;
    const top = (muRowOf.get(mu.id) || 0) * A_H;
    drawWave(ga, media.get(mu.mediaId), mu.in, 1, x0, Math.min(x1, w), top + 6, A_H - 12, mu.voice ? '#f97316' : waveA, pps);
  }
}
function g_clip(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, Math.max(0, w), h, r); else g.rect(x, y, Math.max(0, w), h);
}

function drawRuler() {
  if (!ruler) return;
  const g = sizeCanvas(ruler, RULER_H);
  const sl = scroll.scrollLeft, w = scroll.clientWidth, pps = S.pps;
  const cs = getComputedStyle(document.documentElement);
  const muted = cs.getPropertyValue('--muted').trim() || '#8a919e';
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800];
  const major = steps.find(s => s * pps >= 70) || 3600;
  const minor = steps.slice().reverse().find(s => s < major && major / s <= 10 && s * pps >= 7) || major;
  g.fillStyle = muted; g.strokeStyle = muted;
  g.font = '10.5px Inter, system-ui, sans-serif';
  g.globalAlpha = 0.5;
  for (let t = Math.floor(sl / pps / minor) * minor; t * pps - sl < w; t += minor) {
    const x = Math.round(t * pps - sl) + 0.5;
    g.beginPath(); g.moveTo(x, RULER_H - 5); g.lineTo(x, RULER_H); g.stroke();
  }
  g.globalAlpha = 1;
  for (let t = Math.floor(sl / pps / major) * major; t * pps - sl < w; t += major) {
    const x = Math.round(t * pps - sl) + 0.5;
    g.beginPath(); g.moveTo(x, RULER_H - 11); g.lineTo(x, RULER_H); g.stroke();
    const lbl = major < 1 ? fmt(t, true) : fmt(t);
    g.fillText(lbl, x + 4, 12);
  }
  if (S.markIn != null || S.markOut != null) {
    g.fillStyle = cs.getPropertyValue('--accent').trim();
    [S.markIn, S.markOut].forEach((m, i) => {
      if (m == null) return;
      const x = m * pps - sl;
      g.beginPath();
      if (i === 0) { g.moveTo(x, RULER_H); g.lineTo(x, RULER_H - 12); g.lineTo(x + 7, RULER_H - 12); }
      else { g.moveTo(x, RULER_H); g.lineTo(x, RULER_H - 12); g.lineTo(x - 7, RULER_H - 12); }
      g.closePath(); g.fill();
    });
  }
}

// ── взаємодія ──
let drag = null;
const timeAt = e => (e.clientX - inner.getBoundingClientRect().left) / S.pps;

function onDown(e) {
  if (e.button !== 0) return;
  const it = e.target.closest('.it');
  if (!it) {
    // клік по лінійці або порожньому місцю — перемотування (і скидання виділення на доріжках)
    if (e.target.closest('.lane')) select(null);
    scrub(e);
    return;
  }
  e.preventDefault();
  const kind = it.dataset.kind, id = it.dataset.id;
  select(kind, id);
  const mode = e.target.classList.contains('h-l') ? 'l' : e.target.classList.contains('h-r') ? 'r' : 'move';
  drag = { kind, id, mode, x0: e.clientX, t0: timeAt(e), orig: structuredClone(S.project), moved: false, pointerId: e.pointerId };
  inner.setPointerCapture(e.pointerId);
  inner.addEventListener('pointermove', onMove);
  inner.addEventListener('pointerup', onUp, { once: true });
  inner.addEventListener('pointercancel', onUp, { once: true });
}

function scrub(e) {
  inner.setPointerCapture(e.pointerId);
  const go = ev => seek(Math.max(0, snap(timeAt(ev), null, 6)));
  go(e);
  const mv = ev => go(ev);
  inner.addEventListener('pointermove', mv);
  inner.addEventListener('pointerup', () => inner.removeEventListener('pointermove', mv), { once: true });
}

function onMove(e) {
  if (!drag) return;
  if (!drag.moved && Math.abs(e.clientX - drag.x0) < 3) return;
  drag.moved = true;
  const dt = timeAt(e) - drag.t0;
  const P = S.project = structuredClone(drag.orig);
  if (drag.kind === 'clip') moveClip(P, dt, e);
  else if (drag.kind === 'music') moveMusic(P, dt);
  else moveTimed(P, drag.kind === 'overlay' ? P.overlays : P.captions, dt);
  emit('project', { live: true });
}

function snapBoth(start, dur, id) {
  const s1 = snap(start, id), s2 = snap(start + dur, id) - dur;
  if (!S.snap) return start;
  return Math.abs(s1 - start) <= Math.abs(s2 - start) ? (s1 !== start ? s1 : s2) : s2;
}

function moveTimed(P, list, dt) {
  const o = list.find(x => x.id === drag.id), orig = (drag.kind === 'overlay' ? drag.orig.overlays : drag.orig.captions).find(x => x.id === drag.id);
  if (!o) return;
  const end = orig.start + orig.dur;
  if (drag.mode === 'move') o.start = Math.max(0, snapBoth(orig.start + dt, orig.dur, o.id));
  else if (drag.mode === 'l') { o.start = clamp(snap(orig.start + dt, o.id), 0, end - 0.2); o.dur = end - o.start; }
  else o.dur = Math.max(0.2, snap(end + dt, o.id) - orig.start);
}

function moveMusic(P, dt) {
  const x = P.music.find(v => v.id === drag.id), orig = drag.orig.music.find(v => v.id === drag.id);
  if (!x) return;
  const m = media.get(x.mediaId), max = m ? m.duration : orig.out;
  if (drag.mode === 'move') x.start = Math.max(0, snapBoth(orig.start + dt, musicDur(orig), x.id));
  else if (drag.mode === 'l') {
    let ns = snap(orig.start + dt, x.id);
    let nin = orig.in + (ns - orig.start);
    if (nin < 0) { ns -= nin; nin = 0; }
    if (nin > orig.out - 0.2) { nin = orig.out - 0.2; ns = orig.start + (nin - orig.in); }
    x.in = nin; x.start = Math.max(0, ns);
  } else x.out = clamp(orig.out + (snap(orig.start + musicDur(orig) + dt, x.id) - (orig.start + musicDur(orig))), orig.in + 0.2, max);
}

function moveClip(P, dt, e) {
  const idx = P.clips.findIndex(c => c.id === drag.id);
  if (idx < 0) return;
  const c = P.clips[idx], orig = drag.orig.clips[idx];
  const m = media.get(c.mediaId);
  const sp = c.speed || 1;
  const L0 = (() => { let t = 0; return drag.orig.clips.map(x => { const s = t; t += clipDur(x); return { s, e: t }; }); })();
  const oldEnd = L0[idx].e;
  if (drag.mode === 'move') {
    // переставлення кліпу: місце вставки за положенням курсора
    const t = timeAt(e);
    let target = drag.orig.clips.length;
    for (let i = 0; i < L0.length; i++) { if (t < (L0[i].s + L0[i].e) / 2) { target = i; break; } }
    drag.target = target;
    const x = (target < L0.length ? L0[target].s : L0[L0.length - 1].e) * S.pps;
    insertEl.hidden = target === idx || target === idx + 1;
    insertEl.style.transform = `translateX(${x}px)`;
    return;
  }
  if (m && m.kind === 'image') {
    const d0 = orig.out - orig.in;
    const nd = drag.mode === 'r' ? Math.max(0.3, d0 + dt) : Math.max(0.3, d0 - dt);
    c.in = 0; c.out = nd * sp;
  } else if (drag.mode === 'l') {
    c.in = clamp(orig.in + dt * sp, 0, orig.out - 0.1 * sp);
  } else {
    const maxOut = m ? m.duration : orig.out;
    const newEnd = snap(oldEnd + dt, c.id);
    c.out = clamp(orig.out + (newEnd - oldEnd) * sp, orig.in + 0.1 * sp, maxOut);
  }
  // решта таймлайну (текст, субтитри) зсувається разом із вмістом кліпу
  const delta = clipDur(c) - clipDur(orig);
  if (drag.mode === 'l') rippleShift(L0[idx].s, delta);
  else rippleShift(oldEnd + Math.min(0, delta), delta);
}

function onUp() {
  inner.removeEventListener('pointermove', onMove);
  if (!drag) return;
  const d = drag; drag = null;
  insertEl.hidden = true;
  if (!d.moved) return;
  if (d.kind === 'clip' && d.mode === 'move') {
    S.project = structuredClone(d.orig);
    const i = S.project.clips.findIndex(c => c.id === d.id);
    let target = d.target ?? i;
    if (target !== i && target !== i + 1) {
      const [c] = S.project.clips.splice(i, 1);
      if (target > i) target--;
      S.project.clips.splice(target, 0, c);
    }
  }
  if (!commit()) emit('project', {});
  else if (d.kind === 'clip' && d.mode !== 'move') emit('did-cut');
}

// ── перетягування файлів на таймлайн ──
export function timelineDropTarget() { return $('tl'); }
export const selectedLabel = () => findSel();
