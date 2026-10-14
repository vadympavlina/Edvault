// Аніматор · полотно: показ кадру (тло, референс, калька, шари, напрямні), масштаб і рух,
// малювання мишкою, стилусом і пальцем, виділення й перенесення частини малюнка.
import { strokeSeg, floodMask, paintMask, drawShape, tint, drawGuides } from './paint.js';
import { isBlank } from './cells.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

export class Stage {
  // app: { P (проєкт), S (стан інтерфейсу), pushPixels(step), changed(kind), toast, pickColor(c) }
  constructor(canvas, app) {
    this.cv = canvas; this.g = canvas.getContext('2d'); this.app = app;
    this.view = { x: 0, y: 0, z: 1 };
    this.ptrs = new Map(); this.op = null; this.space = false;
    this.cache = new Map(); // калька: id кадру → { rev, canvas }
    this.float = null;      // плаваюче виділення
    this.hover = null;
    this.bind();
    this.resize();
  }
  get P() { return this.app.P; }
  get S() { return this.app.S; }
  resetBuffers() {
    const { w, h } = this.P;
    this.tmp = mk(w, h); this.below = mk(w, h); this.above = mk(w, h); this.onion = mk(w, h); this.tintCv = mk(w, h); this.comp = mk(w, h);
    this.cache.clear();
    this.float = null;
  }
  resize() {
    const r = this.cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    this.dpr = dpr; this.W = r.width; this.H = r.height;
    this.cv.width = Math.max(1, r.width * dpr); this.cv.height = Math.max(1, r.height * dpr);
    this.render();
  }
  fit() {
    // inset — місце під картку уроку, щоб вона не затуляла аркуш
    const pad = this.W < 640 ? 16 : 48, { w, h } = this.P, l = this.inset?.l || 0, b = this.inset?.b || 0;
    const W = this.W - l, H = this.H - b;
    this.view.z = Math.min((W - pad * 2) / w, (H - pad * 2) / h, 2);
    this.view.x = l + (W - w * this.view.z) / 2; this.view.y = (H - h * this.view.z) / 2;
    this.render(); this.app.changed('zoom');
  }
  zoomAt(f, sx = this.W / 2, sy = this.H / 2) {
    const z = Math.max(0.1, Math.min(8, this.view.z * f)), k = z / this.view.z;
    this.view.x = sx - (sx - this.view.x) * k; this.view.y = sy - (sy - this.view.y) * k; this.view.z = z;
    this.render(); this.app.changed('zoom');
  }
  toDoc(e) { const r = this.cv.getBoundingClientRect(); return { x: (e.clientX - r.left - this.view.x) / this.view.z, y: (e.clientY - r.top - this.view.y) / this.view.z }; }

  /* ── поточні шар, кадр, клітинка ── */
  get frame() { return this.P.frames[this.S.fi]; }
  get layer() { return this.P.layers[this.S.li]; }
  frameCells(fi) { const f = this.P.frames[fi]; return this.P.layers.map(l => l.cells.get(f.id) || null); }
  // завантажити згорнуті клітинки, потрібні для показу
  async prepare() {
    const need = [];
    const add = fi => { if (fi >= 0 && fi < this.P.frames.length) for (const c of this.frameCells(fi)) if (c && !c.canvas && c.blob) need.push(c); };
    add(this.S.fi);
    if (this.S.onion) for (let k = 1; k <= this.S.onionN; k++) { add(this.S.fi - k); add(this.S.fi + k); }
    if (need.length) { await Promise.all(need.map(c => c.load())); this.render(); }
  }
  // склеїти видимі шари кадру fi в canvas (без тла) — для кальки, мініатюр, експорту
  composeFrame(fi, dst, { from = 0, to = Infinity, skip = -1, withBg = false, ref = false } = {}) {
    const g = dst.getContext('2d'); g.clearRect(0, 0, dst.width, dst.height);
    if (withBg) { g.fillStyle = this.P.bg; g.fillRect(0, 0, dst.width, dst.height); }
    if (ref && this.app.refImg && this.S.refShow) { g.globalAlpha = this.S.refOpacity; g.drawImage(this.app.refImg, 0, 0, dst.width, dst.height); g.globalAlpha = 1; }
    const f = this.P.frames[fi]; if (!f) return dst;
    this.P.layers.forEach((l, i) => {
      if (i < from || i > to || i === skip || !l.visible) return;
      const c = l.cells.get(f.id), v = c && c.view();
      if (!v) return;
      g.globalAlpha = l.opacity; g.drawImage(v, 0, 0, dst.width, dst.height); g.globalAlpha = 1;
    });
    return dst;
  }
  // перескладання шарів під і над поточним (при зміні кадру/шару/видимості)
  rebuild() {
    if (!this.P || !this.below) return;
    const li = this.S.li;
    this.composeFrame(this.S.fi, this.below, { to: li - 1 });
    this.composeFrame(this.S.fi, this.above, { from: li + 1 });
    this.buildOnion();
    this.render();
  }
  buildOnion() {
    const g = this.onion.getContext('2d'); g.clearRect(0, 0, this.onion.width, this.onion.height);
    if (!this.S.onion || this.S.playing) return;
    for (let k = this.S.onionN; k >= 1; k--) {
      for (const [fi, col] of [[this.S.fi - k, '#e5484d'], [this.S.fi + k, '#2f9e6f']]) {
        if (fi < 0 || fi >= this.P.frames.length) { if (this.S.onionLoop && this.P.frames.length > 2) { /* кільце */ } continue; }
        this.composeFrame(fi, this.comp);
        tint(this.tintCv, this.comp, col);
        g.globalAlpha = this.S.onionAlpha / k; g.drawImage(this.tintCv, 0, 0); g.globalAlpha = 1;
      }
    }
  }

  /* ── показ ── */
  render() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.draw(); });
  }
  draw() {
    const g = this.g, { dpr, view } = this, P = this.P;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, this.W, this.H);
    if (!P || !this.below) return;
    g.save();
    g.translate(view.x, view.y); g.scale(view.z, view.z);
    // тінь аркуша
    g.shadowColor = 'rgba(28,40,105,.22)'; g.shadowBlur = 30 / view.z * view.z; g.shadowOffsetY = 8;
    g.fillStyle = P.bg; g.fillRect(0, 0, P.w, P.h);
    g.shadowColor = 'transparent';
    g.imageSmoothingEnabled = view.z < 2;
    if (this.app.refImg && this.S.refShow) { g.globalAlpha = this.S.refOpacity; g.drawImage(this.app.refImg, 0, 0, P.w, P.h); g.globalAlpha = 1; }
    if (this.S.playing) {
      if (this.app.playFrame) g.drawImage(this.app.playFrame, 0, 0, P.w, P.h);
    } else {
      g.drawImage(this.onion, 0, 0);
      g.drawImage(this.below, 0, 0);
      const L = this.layer, c = L && L.cells.get(this.frame.id), v = c && c.view();
      if (L && L.visible) {
        g.globalAlpha = L.opacity;
        if (v) g.drawImage(v, 0, 0);
        if (this.op && this.op.tmp) { g.globalAlpha = L.opacity * (this.op.alpha ?? 1); g.drawImage(this.tmp, 0, 0); }
        g.globalAlpha = 1;
      }
      if (this.float) this.drawFloat(g);
      g.drawImage(this.above, 0, 0);
      // напрямні уроку
      if (this.app.guides && this.S.guides) { const list = this.app.guides[this.S.fi]; if (list) drawGuides(g, list, view.z); }
      if (this.S.symmetry) { g.save(); g.strokeStyle = 'rgba(35,55,168,.45)'; g.setLineDash([6 / view.z, 6 / view.z]); g.lineWidth = 1.5 / view.z; g.beginPath(); g.moveTo(P.w / 2, 0); g.lineTo(P.w / 2, P.h); g.stroke(); g.restore(); }
      if (this.op && this.op.kind === 'marquee') this.drawMarquee(g, this.op.rect);
    }
    g.restore();
    // рамка аркуша
    g.strokeStyle = 'rgba(28,40,105,.18)'; g.lineWidth = 1;
    g.strokeRect(view.x - 0.5, view.y - 0.5, P.w * view.z + 1, P.h * view.z + 1);
    // курсор пензля
    if (this.hover && !this.S.playing && ['brush', 'eraser'].includes(this.S.tool)) {
      const s = this.hover, r = Math.max(1.5, this.S.size * (this.S.tool === 'brush' && this.S.brush === 'pencil' ? 0.6 : 1) * view.z / 2);
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.beginPath(); g.arc(s.sx, s.sy, r, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(28,40,105,.9)'; g.lineWidth = 1; g.beginPath(); g.arc(s.sx, s.sy, r, 0, Math.PI * 2); g.stroke();
    }
  }
  drawMarquee(g, r) {
    if (!r) return;
    const z = this.view.z;
    g.save(); g.lineWidth = 1.5 / z;
    g.strokeStyle = '#fff'; g.strokeRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = '#2337a8'; g.setLineDash([5 / z, 4 / z]); g.strokeRect(r.x, r.y, r.w, r.h);
    g.restore();
  }
  drawFloat(g) {
    const f = this.float, z = this.view.z;
    g.save();
    g.globalAlpha = this.layer ? this.layer.opacity : 1;
    g.translate(f.x + f.w / 2, f.y + f.h / 2); g.scale(f.flip ? -1 : 1, 1);
    g.drawImage(f.canvas, -f.w / 2, -f.h / 2, f.w, f.h);
    g.restore();
    this.drawMarquee(g, f);
    const hs = 10 / z; g.fillStyle = '#fff'; g.strokeStyle = '#2337a8'; g.lineWidth = 1.5 / z;
    g.fillRect(f.x + f.w - hs / 2, f.y + f.h - hs / 2, hs, hs); g.strokeRect(f.x + f.w - hs / 2, f.y + f.h - hs / 2, hs, hs);
  }

  /* ── введення ── */
  bind() {
    const cv = this.cv;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => this.down(e));
    cv.addEventListener('pointermove', e => this.move(e));
    cv.addEventListener('pointerup', e => this.up(e));
    cv.addEventListener('pointercancel', e => { this.ptrs.delete(e.pointerId); this.cancel(); });
    cv.addEventListener('pointerleave', () => { this.hover = null; this.render(); });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaX) < 1) { const r = cv.getBoundingClientRect(); this.zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX - r.left, e.clientY - r.top); }
      else { this.view.x -= e.deltaX; this.view.y -= e.deltaY; this.render(); }
    }, { passive: false });
  }
  locked() {
    if (this.S.playing) return 'Зупиніть програвання, щоб малювати';
    const L = this.layer;
    if (!L) return 'Немає шару';
    if (L.locked) return `Шар «${L.name}» заблоковано — розблокуйте його в панелі шарів`;
    if (!L.visible) return `Шар «${L.name}» прихований — увімкніть його, щоб малювати`;
    return '';
  }
  down(e) {
    this.cv.setPointerCapture(e.pointerId);
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.ptrs.size === 2) { // два пальці: масштаб і рух
      this.cancel();
      const [a, b] = [...this.ptrs.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      return;
    }
    if (this.ptrs.size > 2) return;
    const p = this.toDoc(e), tool = this.S.tool;
    if (e.button === 1 || this.space || tool === 'hand' || (e.button === 2)) { this.op = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: this.view.x, vy: this.view.y }; return; }
    if (this.float) {
      const f = this.float, hs = 14 / this.view.z;
      if (Math.abs(p.x - (f.x + f.w)) < hs && Math.abs(p.y - (f.y + f.h)) < hs) { this.op = { kind: 'scale', sx: p.x, sy: p.y, w0: f.w, h0: f.h, ratio: f.w / f.h }; return; }
      if (p.x >= f.x && p.x <= f.x + f.w && p.y >= f.y && p.y <= f.y + f.h) { this.op = { kind: 'drag', lx: p.x, ly: p.y }; return; }
      this.commitFloat();
      if (tool === 'select') { this.op = { kind: 'marquee', x0: p.x, y0: p.y, rect: null }; return; }
    }
    if (tool === 'picker') { this.pick(p); return; }
    const why = this.locked();
    if (why) { this.app.toast(why, 'bad'); return; }
    if (tool === 'select') { this.op = { kind: 'marquee', x0: p.x, y0: p.y, rect: null }; return; }
    if (tool === 'fill') { this.fill(p); return; }
    this.begin(p, e);
  }
  move(e) {
    if (this.ptrs.has(e.pointerId)) this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinch && this.ptrs.size === 2) {
      const [a, b] = [...this.ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, r = this.cv.getBoundingClientRect();
      this.view.x += cx - this.pinch.cx; this.view.y += cy - this.pinch.cy;
      this.zoomAt(d / this.pinch.d, cx - r.left, cy - r.top);
      this.pinch = { d, cx, cy };
      return;
    }
    const r = this.cv.getBoundingClientRect();
    this.hover = { sx: e.clientX - r.left, sy: e.clientY - r.top };
    const op = this.op;
    if (!op) { this.render(); this.cursor(this.toDoc(e)); return; }
    if (op.kind === 'pan') { this.view.x = op.vx + e.clientX - op.sx; this.view.y = op.vy + e.clientY - op.sy; this.render(); return; }
    const p = this.toDoc(e);
    if (op.kind === 'marquee') { op.rect = { x: Math.min(op.x0, p.x), y: Math.min(op.y0, p.y), w: Math.abs(p.x - op.x0), h: Math.abs(p.y - op.y0) }; this.render(); return; }
    if (op.kind === 'drag') { this.float.x += p.x - op.lx; this.float.y += p.y - op.ly; op.lx = p.x; op.ly = p.y; this.render(); return; }
    if (op.kind === 'scale') { const f = this.float; let w = Math.max(4, op.w0 + p.x - op.sx), h = Math.max(4, op.h0 + p.y - op.sy); if (!e.shiftKey) { h = w / op.ratio; } f.w = w; f.h = h; this.render(); this.app.changed('float'); return; }
    if (op.kind === 'shape') { op.s.x2 = p.x; op.s.y2 = p.y; if (e.shiftKey) this.constrain(op.s); this.preview(); return; }
    if (op.kind === 'paint') {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for (const ce of (evs.length ? evs : [e])) this.paintTo(this.toDoc(ce), ce);
      this.render();
    }
  }
  up(e) {
    this.ptrs.delete(e.pointerId);
    if (this.pinch) { if (this.ptrs.size < 2) this.pinch = null; return; }
    const op = this.op; this.op = null;
    if (!op) return;
    if (op.kind === 'paint') this.endPaint(op);
    else if (op.kind === 'shape') this.endShape(op);
    else if (op.kind === 'marquee') { if (op.rect && op.rect.w > 3 && op.rect.h > 3) this.lift(op.rect); else this.render(); }
    else if (op.kind === 'drag' || op.kind === 'scale') { this.render(); this.app.changed('float'); }
    this.cursor(this.toDoc(e));
  }
  cancel() {
    const op = this.op; this.op = null;
    if (op && op.kind === 'paint' && op.before) { const g = op.cell.canvas.getContext('2d'); g.putImageData(op.before, 0, 0); }
    this.tmp && this.tmp.getContext('2d').clearRect(0, 0, this.tmp.width, this.tmp.height);
    this.render();
  }
  cursor(p) {
    const t = this.S.tool; let c = 'crosshair';
    if (this.space || t === 'hand') c = this.op && this.op.kind === 'pan' ? 'grabbing' : 'grab';
    else if (t === 'brush' || t === 'eraser') c = 'none';
    else if (t === 'picker') c = 'copy';
    else if (t === 'select' && this.float && p) { const f = this.float; c = p.x >= f.x && p.x <= f.x + f.w && p.y >= f.y && p.y <= f.y + f.h ? 'move' : 'crosshair'; }
    this.cv.style.cursor = c;
  }

  /* ── малювання ── */
  async begin(p, e) {
    const tool = this.S.tool, L = this.layer, f = this.frame;
    const cell = this.P.ensureCell(L, f);
    if (cell.blob && !cell.canvas) { await cell.load(); }
    const canvas = cell.draw(), g = canvas.getContext('2d', { willReadFrequently: true });
    const before = g.getImageData(0, 0, canvas.width, canvas.height);
    if (tool === 'line' || tool === 'rect' || tool === 'ellipse') {
      this.op = { kind: 'shape', cell, before, s: { type: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y }, tmp: true, alpha: 1 };
      return;
    }
    const erase = tool === 'eraser', brush = erase ? 'pencil' : this.S.brush;
    const o = { brush: erase ? 'eraser' : brush, size: this.S.size * (erase ? 1.6 : 1), color: this.S.color, erase };
    // маркер малюємо в окремий шар і накладаємо з прозорістю — так він не темнішає на перетинах
    const viaTmp = !erase && (brush === 'marker' || this.S.opacity < 1);
    const tg = viaTmp ? this.tmp.getContext('2d') : g;
    if (viaTmp) tg.clearRect(0, 0, this.tmp.width, this.tmp.height);
    const pt = { x: p.x, y: p.y, p: this.pressure(e, null, p), t: performance.now() };
    this.op = { kind: 'paint', cell, before, o, g: tg, tmp: viaTmp, alpha: (brush === 'marker' ? 0.5 : 1) * this.S.opacity, last: pt, smooth: { x: p.x, y: p.y }, box: { x0: p.x, y0: p.y, x1: p.x, y1: p.y } };
    this.seg(pt, pt);
    this.render();
  }
  pressure(e, last, p) {
    if (e.pointerType === 'pen' && e.pressure > 0) return e.pressure;
    if (!last) return 0.55;
    // миша й палець: швидше — тонше
    const dt = Math.max(1, performance.now() - last.t), v = Math.hypot(p.x - last.x, p.y - last.y) / dt * this.view.z;
    return Math.max(0.2, Math.min(0.9, 0.95 - v * 0.35)) * 0.4 + (last.p ?? 0.55) * 0.6;
  }
  paintTo(p, e) {
    const op = this.op; if (!op || op.kind !== 'paint') return;
    // стабілізатор: точка тягнеться за курсором із запізненням — лінія рівніша
    const k = 1 - this.S.stabilizer * 0.9;
    op.smooth.x += (p.x - op.smooth.x) * k; op.smooth.y += (p.y - op.smooth.y) * k;
    const q = { x: op.smooth.x, y: op.smooth.y, t: performance.now() };
    if (Math.hypot(q.x - op.last.x, q.y - op.last.y) < 0.6) return;
    q.p = this.pressure(e, op.last, q);
    this.seg(op.last, q);
    op.last = q;
  }
  seg(a, b) {
    const op = this.op, { o, g } = op, w = this.P.w;
    strokeSeg(g, a, b, o);
    if (this.S.symmetry) strokeSeg(g, { ...a, x: w - a.x }, { ...b, x: w - b.x }, o);
    const pad = o.size * 1.5 + 2, bx = op.box;
    for (const x of [a.x, b.x, ...(this.S.symmetry ? [w - a.x, w - b.x] : [])]) { bx.x0 = Math.min(bx.x0, x - pad); bx.x1 = Math.max(bx.x1, x + pad); }
    for (const y of [a.y, b.y]) { bx.y0 = Math.min(bx.y0, y - pad); bx.y1 = Math.max(bx.y1, y + pad); }
  }
  endPaint(op) {
    const g = op.cell.canvas.getContext('2d', { willReadFrequently: true });
    if (op.tmp) { g.globalAlpha = op.alpha; g.drawImage(this.tmp, 0, 0); g.globalAlpha = 1; this.tmp.getContext('2d').clearRect(0, 0, this.tmp.width, this.tmp.height); }
    this.finishPixels(op.cell, op.before, op.box);
  }
  constrain(s) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    if (s.type === 'line') { const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4, l = Math.hypot(dx, dy); s.x2 = s.x1 + Math.cos(a) * l; s.y2 = s.y1 + Math.sin(a) * l; }
    else { const m = Math.max(Math.abs(dx), Math.abs(dy)); s.x2 = s.x1 + m * Math.sign(dx || 1); s.y2 = s.y1 + m * Math.sign(dy || 1); }
  }
  shapeOpts() { return { color: this.S.color, size: this.S.size, fill: this.S.shapeFill }; }
  preview() {
    const op = this.op, g = this.tmp.getContext('2d');
    g.clearRect(0, 0, this.tmp.width, this.tmp.height);
    drawShape(g, op.s, this.shapeOpts());
    if (this.S.symmetry) drawShape(g, { ...op.s, x1: this.P.w - op.s.x1, x2: this.P.w - op.s.x2 }, this.shapeOpts());
    op.alpha = this.S.opacity;
    this.render();
  }
  endShape(op) {
    const s = op.s;
    if (Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < 2) { this.tmp.getContext('2d').clearRect(0, 0, this.tmp.width, this.tmp.height); this.render(); return; }
    const g = op.cell.canvas.getContext('2d', { willReadFrequently: true });
    g.globalAlpha = this.S.opacity; g.drawImage(this.tmp, 0, 0); g.globalAlpha = 1;
    this.tmp.getContext('2d').clearRect(0, 0, this.tmp.width, this.tmp.height);
    const pad = this.S.size + 4, box = { x0: Math.min(s.x1, s.x2) - pad, y0: Math.min(s.y1, s.y2) - pad, x1: Math.max(s.x1, s.x2) + pad, y1: Math.max(s.y1, s.y2) + pad };
    if (this.S.symmetry) { box.x0 = Math.min(box.x0, this.P.w - Math.max(s.x1, s.x2) - pad); box.x1 = Math.max(box.x1, this.P.w - Math.min(s.x1, s.x2) + pad); }
    this.finishPixels(op.cell, op.before, box);
  }
  // крок історії: лише змінена ділянка
  finishPixels(cell, before, box) {
    const { w, h } = this.P;
    const x = Math.max(0, Math.floor(box.x0)), y = Math.max(0, Math.floor(box.y0));
    const x1 = Math.min(w, Math.ceil(box.x1)), y1 = Math.min(h, Math.ceil(box.y1));
    if (x1 <= x || y1 <= y) { this.render(); return; }
    const g = cell.canvas.getContext('2d', { willReadFrequently: true });
    const after = g.getImageData(x, y, x1 - x, y1 - y);
    const bc = mk(x1 - x, y1 - y).getContext('2d'); bc.putImageData(before, -x, -y);
    const beforeCrop = bc.getImageData(0, 0, x1 - x, y1 - y);
    cell.rev++;
    if (isBlank(cell.canvas)) cell.empty = true;
    this.app.pushPixels({ kind: 'px', layerId: this.layer.id, frameId: this.frame.id, cell, x, y, before: beforeCrop, after });
    this.render();
  }
  async fill(p) {
    const L = this.layer, f = this.frame, cell = this.P.ensureCell(L, f);
    if (cell.blob && !cell.canvas) await cell.load();
    const canvas = cell.draw(), g = canvas.getContext('2d', { willReadFrequently: true });
    const { w, h } = this.P;
    const before = g.getImageData(0, 0, w, h);
    // межі заливки — з усіх видимих шарів (так можна розфарбовувати контур, намальований на іншому шарі)
    let src = before.data;
    if (this.S.fillAll) { this.composeFrame(this.S.fi, this.comp); src = this.comp.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data; }
    const r = floodMask(src, w, h, p.x, p.y, this.S.fillTol);
    if (!r || r.count > w * h * 0.995 && !this.S.fillAll && before.data[3] === 0) { /* заливка всього аркуша — теж дозволена */ }
    if (!r) return;
    const box = paintMask(g, r.mask, w, h, this.S.color);
    if (!box) return;
    this.finishPixels(cell, before, { x0: box.x, y0: box.y, x1: box.x + box.w, y1: box.y + box.h });
  }
  pick(p) {
    const { w, h } = this.P; if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) return;
    this.composeFrame(this.S.fi, this.comp, { withBg: true });
    const d = this.comp.getContext('2d', { willReadFrequently: true }).getImageData(p.x | 0, p.y | 0, 1, 1).data;
    this.app.pickColor('#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join(''));
  }

  /* ── виділення: вирізати шматок, рухати, масштабувати, віддзеркалити ── */
  async lift(rect) {
    const L = this.layer, f = this.frame, cell = L.cells.get(f.id);
    if (!cell || cell.empty) { this.app.toast('На цьому шарі тут нічого немає', ''); this.render(); return; }
    if (cell.blob && !cell.canvas) await cell.load();
    const x = Math.max(0, Math.floor(rect.x)), y = Math.max(0, Math.floor(rect.y)), w = Math.min(this.P.w - x, Math.ceil(rect.w)), h = Math.min(this.P.h - y, Math.ceil(rect.h));
    if (w < 2 || h < 2) return;
    const canvas = cell.draw(), g = canvas.getContext('2d', { willReadFrequently: true });
    const before = g.getImageData(0, 0, this.P.w, this.P.h);
    const piece = mk(w, h); piece.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, w, h);
    g.clearRect(x, y, w, h);
    this.float = { canvas: piece, x, y, w, h, flip: false, cell, before, box: { x0: x, y0: y, x1: x + w, y1: y + h } };
    this.render(); this.app.changed('float');
  }
  pasteFloat(src, at) {
    const L = this.layer, why = this.locked(); if (why) { this.app.toast(why, 'bad'); return; }
    this.commitFloat();
    const cell = this.P.ensureCell(L, this.frame);
    const go = () => {
      const canvas = cell.draw(), g = canvas.getContext('2d', { willReadFrequently: true });
      const before = g.getImageData(0, 0, this.P.w, this.P.h);
      const piece = mk(src.width, src.height); piece.getContext('2d').drawImage(src, 0, 0);
      const x = at ? at.x : (this.P.w - src.width) / 2, y = at ? at.y : (this.P.h - src.height) / 2;
      this.float = { canvas: piece, x, y, w: src.width, h: src.height, flip: false, cell, before, box: { x0: x, y0: y, x1: x, y1: y } };
      this.S.tool = 'select'; this.app.changed('tool');
      this.render(); this.app.changed('float');
    };
    if (cell.blob && !cell.canvas) cell.load().then(go); else go();
  }
  commitFloat() {
    const f = this.float; if (!f) return;
    this.float = null;
    const g = f.cell.canvas.getContext('2d', { willReadFrequently: true });
    g.save(); g.globalAlpha = 1;
    g.translate(f.x + f.w / 2, f.y + f.h / 2); g.scale(f.flip ? -1 : 1, 1);
    g.drawImage(f.canvas, -f.w / 2, -f.h / 2, f.w, f.h);
    g.restore();
    const box = { x0: Math.min(f.box.x0, f.x), y0: Math.min(f.box.y0, f.y), x1: Math.max(f.box.x1, f.x + f.w), y1: Math.max(f.box.y1, f.y + f.h) };
    this.finishPixels(f.cell, f.before, { x0: box.x0 - 2, y0: box.y0 - 2, x1: box.x1 + 2, y1: box.y1 + 2 });
    this.app.changed('float');
  }
  deleteFloat() { const f = this.float; if (!f) return; f.canvas = mk(1, 1); f.w = f.h = 0; this.commitFloat(); }
  floatCanvas() {
    const f = this.float; if (!f) return null;
    const c = mk(Math.max(1, Math.round(f.w)), Math.max(1, Math.round(f.h))), g = c.getContext('2d');
    g.translate(c.width / 2, c.height / 2); g.scale(f.flip ? -1 : 1, 1); g.drawImage(f.canvas, -c.width / 2, -c.height / 2, c.width, c.height);
    return c;
  }
  nudge(dx, dy) { if (!this.float) return false; this.float.x += dx; this.float.y += dy; this.render(); return true; }
}
