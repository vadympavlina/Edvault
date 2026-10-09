// Тренажер пера · перо як в Illustrator / Figma.
//   клік — кутова точка; натиснути й тягнути — плавна точка з ручками;
//   Alt під час перетягування — ламає ручку (змінюється лише та, що попереду);
//   клік у першу точку — замкнути контур; Shift — кути по 45°;
//   після малювання: тягніть точки й ручки; Alt+клік по точці — прибрати ручки, Alt+тягнути — витягти нові;
//   клік по кінцевій точці відкритого контуру — продовжити малювати.
import { cloneAnchors, toPath, dist } from './geom.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const mirror = (a, p) => ({ x: 2 * a.x - p.x, y: 2 * a.y - p.y });
// Shift: кут кратний 45° відносно точки o
function snap45(o, p) {
  const v = sub(p, o), len = Math.hypot(v.x, v.y);
  const ang = Math.round(Math.atan2(v.y, v.x) / (Math.PI / 4)) * (Math.PI / 4);
  return { x: o.x + Math.cos(ang) * len, y: o.y + Math.sin(ang) * len };
}
// чи ручки «зв'язані» (на одній прямій у протилежні боки)
function linked(a) {
  if (!a.hin || !a.hout) return false;
  const vi = sub(a.hin, a), vo = sub(a.hout, a), li = Math.hypot(vi.x, vi.y), lo = Math.hypot(vo.x, vo.y);
  if (li < 0.5 || lo < 0.5) return false;
  return (vi.x * vo.x + vi.y * vo.y) / (li * lo) < -0.995;
}

export class PenEditor {
  constructor(svg, { onChange } = {}) {
    this.svg = svg;
    this.onChange = onChange || (() => {});
    this.layer = el('g', { class: 'pen-layer' }, svg);
    this.pathEl = el('path', { class: 'pen-path' }, this.layer);
    this.previewEl = el('path', { class: 'pen-preview' }, this.layer);
    this.handlesEl = el('g', { class: 'pen-handles' }, this.layer);
    this.anchorsEl = el('g', { class: 'pen-anchors' }, this.layer);
    this.anchors = []; this.closed = false; this.drawing = false;
    this.undoStack = []; this.redoStack = [];
    this.altLock = false; this.enabled = true;
    this.hover = null; this.cursor = null; this.drag = null;
    svg.addEventListener('pointerdown', e => this.down(e));
    svg.addEventListener('pointermove', e => this.move(e));
    svg.addEventListener('pointerup', e => this.up(e));
    svg.addEventListener('pointercancel', e => this.up(e));
    svg.addEventListener('pointerleave', () => { if (!this.drag) { this.cursor = null; this.render(); } });
    // Alt під час перетягування — одразу перемальовуємо
    const key = e => {
      if (e.key !== 'Alt' && e.key !== 'Shift') return;
      if (e.key === 'Alt') e.preventDefault(); // інакше Windows фокусує меню браузера
      if (this.lastEvent) this.move({ ...this.lastEvent, altKey: e.key === 'Alt' ? e.type === 'keydown' : e.altKey, shiftKey: e.key === 'Shift' ? e.type === 'keydown' : e.shiftKey }, true);
    };
    window.addEventListener('keydown', key); window.addEventListener('keyup', key);
    this.render();
  }

  // ── стан ──
  get state() { return { anchors: cloneAnchors(this.anchors), closed: this.closed, drawing: this.drawing }; }
  set state(s) { this.anchors = cloneAnchors(s.anchors); this.closed = s.closed; this.drawing = s.drawing; this.render(); this.onChange(); }
  snapshot() { this.undoStack.push(this.state); if (this.undoStack.length > 200) this.undoStack.shift(); this.redoStack = []; }
  undo() { if (!this.undoStack.length) return false; this.redoStack.push(this.state); this.state = this.undoStack.pop(); return true; }
  redo() { if (!this.redoStack.length) return false; this.undoStack.push(this.state); this.state = this.redoStack.pop(); return true; }
  clear() { if (this.anchors.length) this.snapshot(); this.anchors = []; this.closed = false; this.drawing = false; this.render(); this.onChange(); }
  reset() { this.anchors = []; this.closed = false; this.drawing = false; this.undoStack = []; this.redoStack = []; this.render(); this.onChange(); }
  // Backspace: під час малювання — прибрати останню точку
  deleteLast() {
    if (!this.anchors.length) return;
    this.snapshot();
    if (this.closed) this.closed = false;
    this.anchors.pop();
    this.drawing = this.anchors.length > 0;
    this.render(); this.onChange();
  }
  finish() { if (this.drawing) { this.drawing = false; this.render(); this.onChange(); } }
  get path() { return { anchors: cloneAnchors(this.anchors), closed: this.closed }; }

  // ── координати ──
  toLocal(e) {
    const p = this.svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const m = this.svg.getScreenCTM();
    const r = p.matrixTransform(m.inverse());
    return { x: r.x, y: r.y };
  }
  get px() { const m = this.svg.getScreenCTM(); return m ? 1 / m.a : 1; } // одиниць поля в одному пікселі
  hit(p) {
    const tol = 9 * this.px;
    // спершу ручки (вони дрібніші й лежать поверх)
    for (let i = this.anchors.length - 1; i >= 0; i--) {
      const a = this.anchors[i];
      for (const w of ['hout', 'hin']) if (a[w] && this.handleVisible(i, w) && dist(a[w], p) <= tol) return { kind: 'handle', i, w };
    }
    for (let i = this.anchors.length - 1; i >= 0; i--) if (dist(this.anchors[i], p) <= tol) return { kind: 'anchor', i };
    return null;
  }
  // у відкритому контурі «зовнішні» ручки крайніх точок не впливають на форму — показуємо лише під час малювання
  handleVisible(i, w) {
    if (this.closed) return true;
    if (i === 0 && w === 'hin') return false;
    if (i === this.anchors.length - 1 && w === 'hout') return this.drawing;
    return true;
  }

  // ── миша / дотик ──
  down(e) {
    if (!this.enabled || e.button > 0) return;
    e.preventDefault();
    this.svg.setPointerCapture(e.pointerId);
    this.remember(e);
    const alt = e.altKey || this.altLock;
    let p = this.toLocal(e);
    const h = this.hit(p);
    const last = this.anchors[this.anchors.length - 1];
    if (this.drawing) {
      if (h && h.kind === 'anchor' && h.i === 0 && this.anchors.length >= 2) {
        this.snapshot(); this.closed = true; this.drawing = false;
        this.drag = { type: 'close', i: 0, start: p, moved: false, hout0: this.anchors[0].hout };
      } else if (h && h.kind === 'handle' && (h.i === this.anchors.length - 1 || e.ctrlKey || e.metaKey)) {
        this.startHandle(h, p);
      } else if (h && h.kind === 'anchor' && (e.ctrlKey || e.metaKey)) {
        this.snapshot(); this.drag = { type: 'anchor', i: h.i, start: p, moved: false };
      } else {
        if (e.shiftKey && last) p = snap45(last, p);
        this.snapshot();
        this.anchors.push({ x: p.x, y: p.y, hin: null, hout: null });
        this.drag = { type: 'new', i: this.anchors.length - 1, start: p, moved: false };
      }
    } else if (h && h.kind === 'handle') {
      this.startHandle(h, p);
    } else if (h && h.kind === 'anchor') {
      const a = this.anchors[h.i];
      this.snapshot();
      if (alt && (a.hin || a.hout)) { a.hin = null; a.hout = null; this.drag = null; this.render(); this.onChange(); return; }
      this.drag = alt ? { type: 'pull', i: h.i, start: p, moved: false } : { type: 'anchor', i: h.i, start: p, moved: false };
    } else if (!this.anchors.length) {
      this.snapshot();
      this.anchors.push({ x: p.x, y: p.y, hin: null, hout: null });
      this.drawing = true; this.closed = false;
      this.drag = { type: 'new', i: 0, start: p, moved: false };
    }
    this.render(); this.onChange();
  }
  remember(e) { this.lastEvent = { clientX: e.clientX, clientY: e.clientY, altKey: e.altKey, shiftKey: e.shiftKey }; }
  startHandle(h, p) {
    this.snapshot();
    const a = this.anchors[h.i];
    this.drag = { type: 'handle', i: h.i, w: h.w, start: p, moved: false, linked: linked(a) };
  }
  move(e, fromKey) {
    if (!fromKey) this.remember(e);
    if (!this.enabled) return;
    const alt = e.altKey || this.altLock;
    let p = this.toLocal(e);
    if (!this.drag) {
      this.cursor = p;
      this.hover = this.hit(p);
      this.svg.classList.toggle('can-close', !!(this.drawing && this.hover && this.hover.kind === 'anchor' && this.hover.i === 0 && this.anchors.length >= 2));
      this.svg.classList.toggle('on-point', !!this.hover);
      this.renderPreview(e.shiftKey);
      return;
    }
    const d = this.drag, a = this.anchors[d.i];
    if (dist(p, d.start) > 2 * this.px) d.moved = true;
    if (!d.moved) return;
    if (d.type === 'new' || d.type === 'pull') {
      if (e.shiftKey) p = snap45(a, p);
      a.hout = p;
      // Alt — передня ручка рухається окремо, задня лишається там, де була
      if (!alt || !a.hin) a.hin = mirror(a, p);
    } else if (d.type === 'close') {
      if (e.shiftKey) p = snap45(a, p);
      // тягнемо «вперед» від першої точки: задня ручка — дзеркально, передня — як була (з Alt) або теж дзеркально
      a.hin = mirror(a, p);
      if (!alt) a.hout = p; else a.hout = d.hout0;
    } else if (d.type === 'anchor') {
      if (e.shiftKey) p = snap45(d.start, p);
      const delta = sub(p, a);
      a.x = p.x; a.y = p.y;
      if (a.hin) a.hin = add(a.hin, delta);
      if (a.hout) a.hout = add(a.hout, delta);
    } else if (d.type === 'handle') {
      if (e.shiftKey) p = snap45(a, p);
      a[d.w] = p;
      const other = d.w === 'hin' ? 'hout' : 'hin';
      if (d.linked && !alt && a[other]) {
        const v = sub(p, a), len = Math.hypot(v.x, v.y) || 1, ol = dist(a[other], a);
        a[other] = { x: a.x - v.x / len * ol, y: a.y - v.y / len * ol };
      }
    }
    this.render(); this.onChange();
  }
  up(e) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    const a = this.anchors[d.i];
    if (d.type === 'new' && !d.moved && a) { a.hin = null; a.hout = null; }
    // клік без руху нічого не змінив — прибираємо зайвий крок скасування
    if (!d.moved && (d.type === 'anchor' || d.type === 'handle' || d.type === 'pull')) this.undoStack.pop();
    // клік по кінцевій точці відкритого контуру — продовжуємо малювати від неї
    if (d.type === 'anchor' && !d.moved && !this.closed && !this.drawing) {
      if (d.i === this.anchors.length - 1) this.drawing = true;
      else if (d.i === 0 && this.anchors.length > 1) { this.anchors.reverse().forEach(x => { [x.hin, x.hout] = [x.hout, x.hin]; }); this.drawing = true; }
    }
    try { this.svg.releasePointerCapture(e.pointerId); } catch { /* вже відпущено */ }
    this.render(); this.onChange();
  }

  // ── малювання ──
  renderPreview(shift) {
    const last = this.anchors[this.anchors.length - 1];
    if (!this.drawing || !last || !this.cursor || this.drag) { this.previewEl.setAttribute('d', ''); return; }
    let c = this.cursor;
    if (shift) c = snap45(last, c);
    const near0 = this.anchors.length >= 2 && dist(c, this.anchors[0]) <= 9 * this.px;
    const end = near0 ? this.anchors[0] : c;
    const c2 = near0 && this.anchors[0].hin ? this.anchors[0].hin : end;
    this.previewEl.setAttribute('d', last.hout || c2 !== end
      ? `M${last.x} ${last.y} C${(last.hout || last).x} ${(last.hout || last).y} ${c2.x} ${c2.y} ${end.x} ${end.y}`
      : `M${last.x} ${last.y} L${end.x} ${end.y}`);
  }
  render() {
    const s = this.px, r = 4.5 * s, hr = 3.5 * s;
    this.pathEl.setAttribute('d', toPath(this.anchors, this.closed));
    this.pathEl.style.strokeWidth = 2.5 * s;
    this.previewEl.style.strokeWidth = 1.5 * s;
    this.handlesEl.innerHTML = ''; this.anchorsEl.innerHTML = '';
    this.anchors.forEach((a, i) => {
      for (const w of ['hin', 'hout']) {
        if (!a[w] || !this.handleVisible(i, w)) continue;
        el('line', { x1: a.x, y1: a.y, x2: a[w].x, y2: a[w].y, 'stroke-width': s }, this.handlesEl);
        el('circle', { cx: a[w].x, cy: a[w].y, r: hr, 'stroke-width': s, class: 'h' }, this.handlesEl);
      }
      const last = i === this.anchors.length - 1 && this.drawing;
      el('rect', { x: a.x - r, y: a.y - r, width: 2 * r, height: 2 * r, 'stroke-width': 1.5 * s,
        class: 'a' + (last ? ' last' : '') + (i === 0 && this.drawing && this.anchors.length >= 2 ? ' first' : '') }, this.anchorsEl);
    });
    if (this.drawing && this.anchors.length >= 2) {
      const a = this.anchors[0];
      el('circle', { cx: a.x, cy: a.y, r: 9 * s, 'stroke-width': 1.5 * s, class: 'close-ring' }, this.anchorsEl);
    }
    this.renderPreview(this.lastEvent && this.lastEvent.shiftKey);
  }
}
