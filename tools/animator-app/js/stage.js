// Аніматор · полотно: показ кадру (тло, референс, калька, шари, напрямні), масштаб і рух,
// малювання мишкою, стилусом і пальцем, виділення й перенесення частини малюнка.
import { BRUSHES, ERASERS, Stroke, brushRadius, grain, floodMask, paintMask, drawShape, tint, drawGuides } from './paint.js';
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
    this.tmp = mk(w, h); this.grainCv = mk(w, h); this.mix = mk(w, h); this.below = mk(w, h); this.above = mk(w, h); this.onion = mk(w, h); this.tintCv = mk(w, h); this.comp = mk(w, h);
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
        const op = this.op;
        if (op && op.tmp && op.mode && op.mode !== 'over') {
          // гумка й «лише по малюнку»: показуємо результат так, як він ляже на шар
          const m = this.mix.getContext('2d'); m.clearRect(0, 0, P.w, P.h);
          if (v) m.drawImage(v, 0, 0);
          m.globalCompositeOperation = op.mode === 'erase' ? 'destination-out' : 'source-atop'; m.globalAlpha = op.alpha ?? 1;
          m.drawImage(this.strokeCanvas(op), 0, 0);
          m.globalCompositeOperation = 'source-over'; m.globalAlpha = 1;
          g.globalAlpha = L.opacity; g.drawImage(this.mix, 0, 0);
        } else {
          g.globalAlpha = L.opacity;
          if (v) g.drawImage(v, 0, 0);
          if (op && op.tmp) { g.globalAlpha = L.opacity * (op.alpha ?? 1); g.drawImage(this.strokeCanvas(op), 0, 0); }
        }
        g.globalAlpha = 1;
      }
      if (this.float) this.drawFloat(g);
      g.drawImage(this.above, 0, 0);
      // напрямні уроку
      if (this.app.guides && this.S.guides) { const list = this.app.guides[this.S.fi]; if (list) drawGuides(g, list, view.z); }
      if (this.S.symmetry) { g.save(); g.strokeStyle = 'rgba(35,55,168,.45)'; g.setLineDash([6 / view.z, 6 / view.z]); g.lineWidth = 1.5 / view.z; g.beginPath(); g.moveTo(P.w / 2, 0); g.lineTo(P.w / 2, P.h); g.stroke(); g.restore(); }
      if (this.op && this.op.kind === 'marquee') this.drawMarquee(g, this.op.rect);
      if (this.op && (this.op.kind === 'lassoSel' || this.op.kind === 'lasso')) this.drawLasso(g, this.op.pts);
      // «нитка» стабілізатора: від курсора до кінчика пензля
      if (this.op && this.op.kind === 'paint' && this.op.R > 0 && this.op.cur && !this.op.quick) {
        const a = this.op.cur, b = this.op.lazy;
        g.save(); g.strokeStyle = 'rgba(35,55,168,.55)'; g.lineWidth = 1.5 / view.z; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
        g.fillStyle = '#2337a8'; g.beginPath(); g.arc(b.x, b.y, 2.5 / view.z, 0, Math.PI * 2); g.fill(); g.restore();
      }
    }
    g.restore();
    // рамка аркуша
    g.strokeStyle = 'rgba(28,40,105,.18)'; g.lineWidth = 1;
    g.strokeRect(view.x - 0.5, view.y - 0.5, P.w * view.z + 1, P.h * view.z + 1);
    // курсор пензля
    if (this.hover && !this.S.playing && ['brush', 'eraser'].includes(this.S.tool) && !(this.op && this.op.kind === 'pan')) {
      const B = this.brushDef(), sx = this.hover.sx, sy = this.hover.sy, r = Math.max(1.5, brushRadius(B, this.S.size, 0.6) * view.z);
      g.save();
      const ring = (w, c) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath();
        if (B.kind === 'nib') { const cx = Math.cos(-Math.PI / 4) * r, cy = Math.sin(-Math.PI / 4) * r; g.moveTo(sx - cx, sy - cy); g.lineTo(sx + cx, sy + cy); } else g.arc(sx, sy, r, 0, Math.PI * 2);
        g.stroke(); };
      ring(3, 'rgba(255,255,255,.9)'); ring(1, 'rgba(28,40,105,.9)');
      if (r > 6) { g.fillStyle = 'rgba(28,40,105,.9)'; g.fillRect(sx - 0.5, sy - 0.5, 1, 1); }
      g.restore();
    }
    // підказка розміру пензля по центру (після зміни розміру)
    const since = performance.now() - (this.sizeFlash || 0);
    if (since < 700 && ['brush', 'eraser', 'line', 'rect', 'ellipse'].includes(this.S.tool)) {
      const B = this.brushDef(), r = Math.max(1, brushRadius(B, this.S.size, 0.6) * view.z), cx = this.W / 2, cy = this.H / 2;
      g.save(); g.globalAlpha = Math.min(1, (700 - since) / 250);
      g.fillStyle = this.S.tool === 'eraser' ? 'rgba(255,255,255,.7)' : this.S.color; g.strokeStyle = 'rgba(28,40,105,.9)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = 'rgba(28,40,105,.9)'; g.font = '600 13px Commissioner, system-ui, sans-serif'; g.textAlign = 'center';
      g.fillText(this.S.size + ' px', cx, cy + r + 18);
      g.restore();
      clearTimeout(this.flashT); this.flashT = setTimeout(() => this.render(), 40);
    }
  }
  flashSize() { this.sizeFlash = performance.now(); this.render(); }
  brushDef() { return this.S.tool === 'eraser' ? ERASERS[this.S.eraserSoft ? 'soft' : 'hard'] : this.S.tool === 'brush' ? BRUSHES[this.S.brush] || BRUSHES.pen : { kind: 'round', size: 1, press: 0 }; }
  // слід з фактурою паперу (олівець, крейда)
  strokeCanvas(op) {
    if (!op.grain) return this.tmp;
    const g = this.grainCv.getContext('2d'), w = this.grainCv.width, h = this.grainCv.height;
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, w, h); g.drawImage(this.tmp, 0, 0);
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = g.createPattern(grain(op.grain), 'repeat'); g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    return this.grainCv;
  }
  drawLasso(g, pts) {
    if (!pts || pts.length < 2) return;
    const z = this.view.z;
    g.save(); g.lineWidth = 1.5 / z; g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (const q of pts) g.lineTo(q.x, q.y); g.closePath();
    g.strokeStyle = '#fff'; g.stroke(); g.strokeStyle = '#2337a8'; g.setLineDash([5 / z, 4 / z]); g.stroke(); g.restore();
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
    g.translate(f.x + f.w / 2, f.y + f.h / 2); g.rotate(f.angle || 0);
    g.save(); g.globalAlpha = this.layer ? this.layer.opacity : 1; g.scale(f.flip ? -1 : 1, f.flipV ? -1 : 1);
    g.drawImage(f.canvas, -f.w / 2, -f.h / 2, f.w, f.h); g.restore();
    this.drawMarquee(g, { x: -f.w / 2, y: -f.h / 2, w: f.w, h: f.h });
    const hs = 10 / z, ry = -f.h / 2 - 26 / z;
    g.lineWidth = 1.5 / z; g.strokeStyle = '#2337a8'; g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(0, -f.h / 2); g.lineTo(0, ry); g.stroke();
    g.beginPath(); g.arc(0, ry, hs * 0.6, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillRect(f.w / 2 - hs / 2, f.h / 2 - hs / 2, hs, hs); g.strokeRect(f.w / 2 - hs / 2, f.h / 2 - hs / 2, hs, hs);
    g.restore();
  }
  // точка аркуша → координати всередині виділення (з центром у 0,0 і без повороту)
  floatLocal(p) {
    const f = this.float, a = -(f.angle || 0), dx = p.x - (f.x + f.w / 2), dy = p.y - (f.y + f.h / 2);
    return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
  }
  floatHit(p) {
    const f = this.float, l = this.floatLocal(p), hs = 14 / this.view.z;
    if (Math.hypot(l.x, l.y + f.h / 2 + 26 / this.view.z) < hs) return 'rotate';
    if (Math.abs(l.x - f.w / 2) < hs && Math.abs(l.y - f.h / 2) < hs) return 'scale';
    if (Math.abs(l.x) <= f.w / 2 && Math.abs(l.y) <= f.h / 2) return 'drag';
    return null;
  }
  floatCorners() {
    const f = this.float, a = f.angle || 0, c = Math.cos(a), s = Math.sin(a), cx = f.x + f.w / 2, cy = f.y + f.h / 2;
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => ({ x: cx + (u * f.w / 2) * c - (v * f.h / 2) * s, y: cy + (u * f.w / 2) * s + (v * f.h / 2) * c }));
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
    if (e.pointerType === 'pen') this.penSeen = true;
    try { this.cv.setPointerCapture(e.pointerId); } catch { /* синтетичний дотик */ }
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // жест кількома пальцями: два — масштаб і рух, швидкий дотик двома — скасувати, трьома — повторити
    if (this.ptrs.size >= 2) {
      if (this.ptrs.size === 2) {
        this.cancel();
        const [a, b] = [...this.ptrs.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      }
      this.gesture = { n: this.ptrs.size, t: performance.now(), moved: this.gesture ? this.gesture.moved : false, start: new Map([...this.ptrs].map(([k, v]) => [k, { ...v }])) };
      return;
    }
    this.gesture = null;
    const p = this.toDoc(e), tool = this.S.tool;
    // долоня на екрані, коли малюють стилусом, — лише рухає аркуш
    const palm = e.pointerType === 'touch' && this.penSeen;
    if (e.button === 1 || this.space || tool === 'hand' || e.button === 2 || palm) { this.op = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: this.view.x, vy: this.view.y }; this.cursor(); return; }
    if (this.float) {
      const hit = this.floatHit(p), f = this.float;
      if (hit === 'rotate') { this.op = { kind: 'rotate', a0: f.angle || 0, s0: Math.atan2(p.y - (f.y + f.h / 2), p.x - (f.x + f.w / 2)) }; return; }
      if (hit === 'scale') { const tl = this.floatCorners()[0]; this.op = { kind: 'scale', tl, ratio: f.w / f.h }; return; }
      if (hit === 'drag') { this.op = { kind: 'drag', lx: p.x, ly: p.y }; return; }
      this.commitFloat();
    }
    // Alt + клік — узяти колір, не перемикаючи інструмент
    if (e.altKey && ['brush', 'fill', 'line', 'rect', 'ellipse', 'lasso'].includes(tool)) { this.pick(p); return; }
    if (tool === 'picker') { this.pick(p); return; }
    if (tool === 'select') {
      if (this.S.selMode === 'lasso') this.op = { kind: 'lassoSel', pts: [p] };
      else this.op = { kind: 'marquee', x0: p.x, y0: p.y, rect: null };
      return;
    }
    const why = this.locked();
    if (why) { this.app.toast(why, 'bad'); return; }
    if (tool === 'fill') { this.fill(p); return; }
    this.begin(p, e);
  }
  move(e) {
    if (this.ptrs.has(e.pointerId)) this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.gesture && this.gesture.start.has(e.pointerId)) { const s0 = this.gesture.start.get(e.pointerId); if (Math.hypot(e.clientX - s0.x, e.clientY - s0.y) > 12) this.gesture.moved = true; }
    if (this.pinch && this.ptrs.size === 2) {
      const [a, b] = [...this.ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, r = this.cv.getBoundingClientRect();
      this.view.x += cx - this.pinch.cx; this.view.y += cy - this.pinch.cy;
      this.zoomAt(d / this.pinch.d, cx - r.left, cy - r.top);
      this.pinch = { d, cx, cy };
      return;
    }
    if (this.ptrs.size > 2) return;
    const r = this.cv.getBoundingClientRect();
    this.hover = { sx: e.clientX - r.left, sy: e.clientY - r.top };
    const op = this.op;
    if (!op) { this.render(); this.cursor(this.toDoc(e)); return; }
    if (op.kind === 'pan') { this.view.x = op.vx + e.clientX - op.sx; this.view.y = op.vy + e.clientY - op.sy; this.render(); return; }
    const p = this.toDoc(e);
    if (op.kind === 'marquee') { op.rect = { x: Math.min(op.x0, p.x), y: Math.min(op.y0, p.y), w: Math.abs(p.x - op.x0), h: Math.abs(p.y - op.y0) }; this.render(); return; }
    if (op.kind === 'lassoSel' || op.kind === 'lasso') { this.addLassoPoint(op, p); return; }
    if (op.kind === 'drag') { this.float.x += p.x - op.lx; this.float.y += p.y - op.ly; op.lx = p.x; op.ly = p.y; this.render(); return; }
    if (op.kind === 'rotate') {
      const f = this.float; let a = op.a0 + Math.atan2(p.y - (f.y + f.h / 2), p.x - (f.x + f.w / 2)) - op.s0;
      if (e.shiftKey) a = Math.round(a / (Math.PI / 12)) * Math.PI / 12;
      f.angle = a; this.render(); this.app.changed('float'); return;
    }
    if (op.kind === 'scale') {
      const f = this.float, an = f.angle || 0, c = Math.cos(an), s = Math.sin(an), dx = p.x - op.tl.x, dy = p.y - op.tl.y;
      let w = Math.max(4, dx * c + dy * s), h = Math.max(4, -dx * s + dy * c);
      if (!e.shiftKey) h = w / op.ratio;
      const cx = op.tl.x + (w / 2) * c - (h / 2) * s, cy = op.tl.y + (w / 2) * s + (h / 2) * c;
      f.w = w; f.h = h; f.x = cx - w / 2; f.y = cy - h / 2;
      this.render(); this.app.changed('float'); return;
    }
    if (op.kind === 'shape') { op.s.x2 = p.x; op.s.y2 = p.y; if (e.shiftKey) this.constrain(op.s); this.preview(); return; }
    if (op.kind === 'paint') {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for (const ce of (evs.length ? evs : [e])) this.paintTo(this.toDoc(ce), ce);
      this.watchHold(e);
      this.render();
    }
  }
  up(e) {
    this.ptrs.delete(e.pointerId);
    if (this.gesture) {
      if (this.ptrs.size === 0) {
        const gs = this.gesture; this.gesture = null; this.pinch = null;
        if (!gs.moved && performance.now() - gs.t < 350) { if (gs.n === 2) this.app.undo && this.app.undo(); else if (gs.n === 3) this.app.redo && this.app.redo(); }
      }
      return;
    }
    if (this.pinch) { if (this.ptrs.size < 2) this.pinch = null; return; }
    const op = this.op; this.op = null;
    if (!op) return;
    clearTimeout(this.holdT);
    if (op.kind === 'paint') this.endPaint(op, this.toDoc(e));
    else if (op.kind === 'shape') this.endShape(op);
    else if (op.kind === 'lasso') this.endLasso(op);
    else if (op.kind === 'marquee') { if (op.rect && op.rect.w > 3 && op.rect.h > 3) this.lift(op.rect); else this.render(); }
    else if (op.kind === 'lassoSel') { if (op.pts.length > 3) this.lift(null, op.pts); else this.render(); }
    else if (op.kind === 'drag' || op.kind === 'scale' || op.kind === 'rotate') { this.render(); this.app.changed('float'); }
    this.cursor(this.toDoc(e));
  }
  cancel() {
    const op = this.op; this.op = null;
    clearTimeout(this.holdT);
    this.tmp && this.tmp.getContext('2d').clearRect(0, 0, this.tmp.width, this.tmp.height);
    this.render();
    return op;
  }
  cursor(p) {
    const t = this.S.tool; let c = 'crosshair';
    if (this.space || t === 'hand' || (this.op && this.op.kind === 'pan')) c = this.op && this.op.kind === 'pan' ? 'grabbing' : 'grab';
    else if (t === 'brush' || t === 'eraser') c = 'none';
    else if (t === 'picker') c = 'copy';
    else if (this.float && p) { const h = this.floatHit(p); c = h === 'drag' ? 'move' : h === 'scale' ? 'nwse-resize' : h === 'rotate' ? 'grab' : 'crosshair'; }
    this.cv.style.cursor = c;
  }

  /* ── малювання ── */
  mode() { return this.S.alphaLock ? 'atop' : 'over'; }
  async begin(p, e) {
    const tool = this.S.tool, L = this.layer, f = this.frame;
    const cell = this.P.ensureCell(L, f);
    if (cell.blob && !cell.canvas) { await cell.load(); }
    const canvas = cell.draw(), g = canvas.getContext('2d', { willReadFrequently: true });
    const before = g.getImageData(0, 0, canvas.width, canvas.height);
    const tg = this.tmp.getContext('2d'); tg.clearRect(0, 0, this.tmp.width, this.tmp.height);
    if (tool === 'line' || tool === 'rect' || tool === 'ellipse') {
      this.op = { kind: 'shape', cell, before, s: { type: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y }, tmp: true, alpha: this.S.opacity, mode: this.mode() };
      return;
    }
    if (tool === 'lasso') {
      this.op = { kind: 'lasso', cell, before, pts: [p], tmp: true, alpha: this.S.opacity, mode: this.mode() };
      return;
    }
    const erase = tool === 'eraser', B = this.brushDef();
    const stroke = new Stroke(tg, B, { size: this.S.size, color: erase ? '#000' : this.S.color, mirrorW: this.S.symmetry ? this.P.w : 0 });
    const pt = { x: p.x, y: p.y, p: this.pressure(e, null, p), t: performance.now() };
    const R = this.S.stabilizer > 0 ? (4 + 20 * this.S.stabilizer) / this.view.z : 0;
    this.op = {
      kind: 'paint', cell, before, B, stroke, tmp: true, erase,
      mode: erase ? 'erase' : this.mode(), alpha: erase ? 1 : (B.alpha ?? 1) * this.S.opacity, grain: !erase && B.grain,
      last: pt, lazy: { x: p.x, y: p.y }, cur: p, R, pts: [pt], hold: { x: e.clientX, y: e.clientY },
    };
    // Shift + клік — пряма лінія від кінця попереднього штриха
    const le = this.lastEnd;
    if (e.shiftKey && le && le.cell === cell) { stroke.add({ ...le }); this.op.pts.unshift({ ...le }); }
    stroke.add(pt);
    this.render();
  }
  pressure(e, last, p) {
    if (e.pointerType === 'pen' && e.pressure > 0) return Math.pow(e.pressure, 0.8);
    if (!last) return 0.6;
    // миша й палець: швидше — тонше, плавно
    const dt = Math.max(1, (e.timeStamp || performance.now()) - (last.ts || 0)), v = Math.hypot(p.x - last.x, p.y - last.y) / dt * this.view.z;
    const target = Math.max(0.3, Math.min(0.85, 0.9 - v * 0.25));
    return (last.p ?? 0.6) * 0.75 + target * 0.25;
  }
  paintTo(p, e) {
    const op = this.op; if (!op || op.kind !== 'paint' || op.quick) { if (op && op.quick) this.quickMove(p); return; }
    op.cur = p;
    // стабілізатор «на нитці»: кінчик пензля рухається, лише коли нитка натягнута — лінія рівна без запізнення
    if (op.R > 0) {
      const d = Math.hypot(p.x - op.lazy.x, p.y - op.lazy.y);
      if (d <= op.R) return;
      const k = (d - op.R) / d; op.lazy.x += (p.x - op.lazy.x) * k; op.lazy.y += (p.y - op.lazy.y) * k;
    } else { op.lazy.x = p.x; op.lazy.y = p.y; }
    const q = { x: op.lazy.x, y: op.lazy.y, ts: e.timeStamp || performance.now() };
    if (Math.hypot(q.x - op.last.x, q.y - op.last.y) < 0.75 / this.view.z) return;
    q.p = this.pressure(e, op.last, q);
    op.stroke.add(q); op.pts.push(q);
    op.last = q;
  }
  // утримання пензля в кінці лінії → пряма або рівний еліпс
  watchHold(e) {
    const op = this.op; if (!op || op.kind !== 'paint' || op.quick || op.erase) return;
    if (Math.hypot(e.clientX - op.hold.x, e.clientY - op.hold.y) > 6) { op.hold = { x: e.clientX, y: e.clientY }; clearTimeout(this.holdT); this.holdT = setTimeout(() => this.quickShape(), 600); }
  }
  quickShape() {
    const op = this.op; if (!op || op.kind !== 'paint' || op.quick) return;
    const pts = op.pts; if (pts.length < 4 || op.stroke.dist < 24 / this.view.z) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, sp = 0;
    for (const q of pts) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); sp += q.p ?? 0.6; }
    const a = pts[0], b = pts[pts.length - 1], diag = Math.hypot(x1 - x0, y1 - y0), avg = sp / pts.length;
    const closed = Math.hypot(b.x - a.x, b.y - a.y) < Math.max(14 / this.view.z, diag * 0.22) && op.stroke.dist > diag * 1.6;
    op.quick = closed ? { type: 'ellipse', cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: (x1 - x0) / 2, ry: (y1 - y0) / 2, p: avg } : { type: 'line', a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, p: avg };
    this.quickDraw();
    this.app.changed('quick');
  }
  quickMove(p) { const q = this.op.quick; if (q.type === 'line') { q.b = { x: p.x, y: p.y }; this.quickDraw(); } }
  quickDraw() {
    const op = this.op, q = op.quick, tg = this.tmp.getContext('2d');
    tg.clearRect(0, 0, this.tmp.width, this.tmp.height);
    const B = { ...op.B, taper: q.type === 'ellipse' ? 0 : op.B.taper };
    const st = new Stroke(tg, B, { size: this.S.size, color: this.S.color, mirrorW: this.S.symmetry ? this.P.w : 0 });
    if (q.type === 'line') { const n = 8; for (let i = 0; i <= n; i++) st.add({ x: q.a.x + (q.b.x - q.a.x) * i / n, y: q.a.y + (q.b.y - q.a.y) * i / n, p: q.p }); }
    else { const n = 96; for (let i = 0; i <= n + 2; i++) { const t = i / n * Math.PI * 2; st.add({ x: q.cx + Math.cos(t) * q.rx, y: q.cy + Math.sin(t) * q.ry, p: q.p }); } }
    st.end();
    op.stroke = st;
    this.render();
  }
  endPaint(op, p) {
    if (!op.quick) {
      // кінчик доходить туди, де відпустили, — лінія не коротшає від стабілізатора
      if (op.R > 0 && p && Math.hypot(p.x - op.last.x, p.y - op.last.y) > 0.5) op.stroke.add({ x: p.x, y: p.y, p: op.last.p });
      op.stroke.end();
    }
    const last = op.quick ? (op.quick.type === 'line' ? { ...op.quick.b, p: op.quick.p } : null) : op.last;
    this.lastEnd = last ? { x: last.x, y: last.y, p: last.p ?? 0.6, cell: op.cell } : null;
    this.commit(op, op.stroke.box);
  }
  // перенести слід із тимчасового шару на клітинку
  commit(op, box) {
    const g = op.cell.canvas.getContext('2d', { willReadFrequently: true });
    g.save();
    g.globalCompositeOperation = op.mode === 'erase' ? 'destination-out' : op.mode === 'atop' ? 'source-atop' : 'source-over';
    g.globalAlpha = op.alpha ?? 1;
    g.drawImage(this.strokeCanvas(op), 0, 0);
    g.restore();
    this.tmp.getContext('2d').clearRect(0, 0, this.tmp.width, this.tmp.height);
    this.finishPixels(op.cell, op.before, box);
  }
  addLassoPoint(op, p) {
    const l = op.pts[op.pts.length - 1];
    if (Math.hypot(p.x - l.x, p.y - l.y) < 2 / this.view.z) return;
    op.pts.push(p);
    if (op.kind === 'lasso') this.lassoPreview(op);
    this.render();
  }
  lassoPreview(op) {
    const g = this.tmp.getContext('2d'), pts = op.pts, W = this.P.w;
    g.clearRect(0, 0, this.tmp.width, this.tmp.height);
    g.fillStyle = this.S.color;
    const poly = mirror => { g.beginPath(); pts.forEach((q, i) => g[i ? 'lineTo' : 'moveTo'](mirror ? W - q.x : q.x, q.y)); g.closePath(); g.fill(); };
    poly(false); if (this.S.symmetry) poly(true);
  }
  endLasso(op) {
    if (op.pts.length < 3) { this.cancel(); return; }
    this.lassoPreview(op);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of op.pts) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    if (this.S.symmetry) { x0 = Math.min(x0, this.P.w - x1); x1 = Math.max(x1, this.P.w - x0); }
    this.commit(op, { x0: x0 - 2, y0: y0 - 2, x1: x1 + 2, y1: y1 + 2 });
  }
  constrain(s) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    if (s.type === 'line') { const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * Math.PI / 12, l = Math.hypot(dx, dy); s.x2 = s.x1 + Math.cos(a) * l; s.y2 = s.y1 + Math.sin(a) * l; }
    else { const m = Math.max(Math.abs(dx), Math.abs(dy)); s.x2 = s.x1 + m * Math.sign(dx || 1); s.y2 = s.y1 + m * Math.sign(dy || 1); }
  }
  shapeOpts() { return { color: this.S.color, size: this.S.size, fill: this.S.shapeFill }; }
  preview() {
    const op = this.op, g = this.tmp.getContext('2d');
    g.clearRect(0, 0, this.tmp.width, this.tmp.height);
    drawShape(g, op.s, this.shapeOpts());
    if (this.S.symmetry) drawShape(g, { ...op.s, x1: this.P.w - op.s.x1, x2: this.P.w - op.s.x2 }, this.shapeOpts());
    this.render();
  }
  endShape(op) {
    const s = op.s;
    if (Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < 2) { this.cancel(); return; }
    this.preview();
    const pad = this.S.size + 4, box = { x0: Math.min(s.x1, s.x2) - pad, y0: Math.min(s.y1, s.y2) - pad, x1: Math.max(s.x1, s.x2) + pad, y1: Math.max(s.y1, s.y2) + pad };
    if (this.S.symmetry) { box.x0 = Math.min(box.x0, this.P.w - Math.max(s.x1, s.x2) - pad); box.x1 = Math.max(box.x1, this.P.w - Math.min(s.x1, s.x2) + pad); }
    this.commit(op, box);
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
    cell.empty = isBlank(cell.canvas);
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
    const r = floodMask(src, w, h, p.x, p.y, this.S.fillTol, this.S.fillGap || 0);
    if (!r) return;
    const box = paintMask(g, r.mask, w, h, this.S.color, !!this.S.alphaLock);
    if (!box) { this.app.toast('Тут нічого зафарбувати: «Лише по малюнку» фарбує тільки намальоване', ''); return; }
    this.finishPixels(cell, before, { x0: box.x, y0: box.y, x1: box.x + box.w, y1: box.y + box.h });
  }
  pick(p) {
    const { w, h } = this.P; if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) return;
    this.composeFrame(this.S.fi, this.comp, { withBg: true });
    const d = this.comp.getContext('2d', { willReadFrequently: true }).getImageData(p.x | 0, p.y | 0, 1, 1).data;
    this.app.pickColor('#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join(''));
  }

  /* ── виділення: рамкою чи ласо; рухати, масштабувати, повертати, віддзеркалювати ── */
  async lift(rect, poly) {
    const L = this.layer, f = this.frame, cell = L.cells.get(f.id);
    if (!cell || cell.empty) { this.app.toast('На цьому шарі тут нічого немає', ''); this.render(); return; }
    if (L.locked) { this.app.toast(this.locked(), 'bad'); this.render(); return; }
    if (cell.blob && !cell.canvas) await cell.load();
    if (poly) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of poly) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); } rect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
    const x = Math.max(0, Math.floor(rect.x)), y = Math.max(0, Math.floor(rect.y)), w = Math.min(this.P.w - x, Math.ceil(rect.w + rect.x - x)), h = Math.min(this.P.h - y, Math.ceil(rect.h + rect.y - y));
    if (w < 2 || h < 2) { this.render(); return; }
    const canvas = cell.draw(), g = canvas.getContext('2d', { willReadFrequently: true });
    const piece = mk(w, h), pg = piece.getContext('2d');
    pg.drawImage(canvas, x, y, w, h, 0, 0, w, h);
    const path = (c, dx, dy) => { c.beginPath(); poly.forEach((q, i) => c[i ? 'lineTo' : 'moveTo'](q.x - dx, q.y - dy)); c.closePath(); };
    if (poly) { pg.globalCompositeOperation = 'destination-in'; path(pg, x, y); pg.fill(); pg.globalCompositeOperation = 'source-over'; }
    if (isBlank(piece)) { this.app.toast('На цьому шарі тут нічого немає', ''); this.render(); return; }
    const before = g.getImageData(0, 0, this.P.w, this.P.h);
    if (poly) { g.save(); g.globalCompositeOperation = 'destination-out'; path(g, 0, 0); g.fill(); g.restore(); } else g.clearRect(x, y, w, h);
    this.float = { canvas: piece, x, y, w, h, flip: false, flipV: false, angle: 0, cell, before, box: { x0: x, y0: y, x1: x + w, y1: y + h } };
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
      this.float = { canvas: piece, x, y, w: src.width, h: src.height, flip: false, flipV: false, angle: 0, cell, before, box: { x0: x, y0: y, x1: x, y1: y } };
      this.S.tool = 'select'; this.app.changed('tool');
      this.render(); this.app.changed('float');
    };
    if (cell.blob && !cell.canvas) cell.load().then(go); else go();
  }
  drawFloatTo(g, f) {
    g.save();
    g.translate(f.x + f.w / 2, f.y + f.h / 2); g.rotate(f.angle || 0); g.scale(f.flip ? -1 : 1, f.flipV ? -1 : 1);
    g.drawImage(f.canvas, -f.w / 2, -f.h / 2, f.w, f.h);
    g.restore();
  }
  commitFloat() {
    const f = this.float; if (!f) return;
    const corners = this.floatCorners();
    this.float = null;
    const g = f.cell.canvas.getContext('2d', { willReadFrequently: true });
    if (f.w > 0 && f.h > 0) this.drawFloatTo(g, f);
    const box = { ...f.box };
    for (const c of corners) { box.x0 = Math.min(box.x0, c.x); box.y0 = Math.min(box.y0, c.y); box.x1 = Math.max(box.x1, c.x); box.y1 = Math.max(box.y1, c.y); }
    this.finishPixels(f.cell, f.before, { x0: box.x0 - 2, y0: box.y0 - 2, x1: box.x1 + 2, y1: box.y1 + 2 });
    this.app.changed('float');
  }
  deleteFloat() { const f = this.float; if (!f) return; f.canvas = mk(1, 1); f.w = f.h = 0; this.commitFloat(); }
  // виділене як окрема картинка (з поворотом і віддзеркаленням) — для копіювання
  floatCanvas() {
    const f = this.float; if (!f) return null;
    const cs = this.floatCorners(), x0 = Math.min(...cs.map(c => c.x)), y0 = Math.min(...cs.map(c => c.y)), x1 = Math.max(...cs.map(c => c.x)), y1 = Math.max(...cs.map(c => c.y));
    const c = mk(Math.max(1, Math.round(x1 - x0)), Math.max(1, Math.round(y1 - y0))), g = c.getContext('2d');
    g.translate(-x0, -y0); this.drawFloatTo(g, f);
    return c;
  }
  nudge(dx, dy) { if (!this.float) return false; this.float.x += dx; this.float.y += dy; this.render(); return true; }
}
