// Аніматор · модель проєкту без DOM: кадри, шари, клітинки (малюнок шару на кадрі), історія змін.
// Пікселі живуть у клітинках; як саме їх зберігати (canvas у браузері, заглушка в тестах), вирішує «склад»
// клітинок, який передають у проєкт. Так модель можна перевіряти в node.

export const FILE_APP = 'edvault-animator';
export const FILE_FORMAT = 1;
export const MAX_LAYERS = 8;
export const MAX_FRAMES = 600;
export const SIZES = { wide: [960, 540, 'Широкий 16:9'], square: [720, 720, 'Квадрат 1:1'], classic: [800, 600, 'Класичний 4:3'], tall: [540, 960, 'Вертикальний 9:16'] };

let seq = 0;
export const uid = p => p + Date.now().toString(36) + (++seq).toString(36) + Math.random().toString(36).slice(2, 5);

export class Project {
  // store: { create() → cell, clone(cell) → cell, isEmpty(cell) }
  constructor(store, o = {}) {
    this.store = store;
    this.title = o.title || 'Мій мультфільм';
    this.author = o.author || '';
    this.group = o.group || '';
    this.w = o.w || 960; this.h = o.h || 540;
    this.fps = o.fps || 8;
    this.bg = o.bg || '#ffffff';
    this.frames = [];
    this.layers = [];
    this.audio = null; // { name, offset }
    this.lesson = o.lesson || null;
    this.created = o.created || Date.now();
    if (!o.empty) {
      this.addLayer('Фон');
      this.addLayer('Персонаж');
      this.addFrame();
    }
  }
  /* ── кадри ── */
  frameIndex(id) { return this.frames.findIndex(f => f.id === id); }
  addFrame(at = this.frames.length, { copyFrom = null } = {}) {
    if (this.frames.length >= MAX_FRAMES) return null;
    const f = { id: uid('f'), hold: 1 };
    this.frames.splice(at, 0, f);
    if (copyFrom) for (const l of this.layers) { const c = l.cells.get(copyFrom.id); if (c && !this.store.isEmpty(c)) l.cells.set(f.id, this.store.clone(c)); }
    return f;
  }
  duplicateFrame(i) { const src = this.frames[i]; if (!src) return null; const f = this.addFrame(i + 1, { copyFrom: src }); if (f) f.hold = src.hold; return f; }
  deleteFrame(i) {
    if (this.frames.length <= 1 || !this.frames[i]) return false;
    const [f] = this.frames.splice(i, 1);
    for (const l of this.layers) l.cells.delete(f.id);
    return true;
  }
  moveFrame(from, to) {
    if (from === to || !this.frames[from] || to < 0 || to >= this.frames.length) return false;
    const [f] = this.frames.splice(from, 1); this.frames.splice(to, 0, f); return true;
  }
  setHold(i, hold) { const f = this.frames[i]; if (!f) return; f.hold = Math.max(1, Math.min(12, Math.round(hold))); }
  /* ── шари (0 — нижній) ── */
  addLayer(name, at = this.layers.length) {
    if (this.layers.length >= MAX_LAYERS) return null;
    const l = { id: uid('l'), name: name || 'Шар ' + (this.layers.length + 1), visible: true, locked: false, opacity: 1, cells: new Map() };
    this.layers.splice(at, 0, l);
    return l;
  }
  deleteLayer(i) { if (this.layers.length <= 1 || !this.layers[i]) return false; this.layers.splice(i, 1); return true; }
  moveLayer(from, to) { if (!this.layers[from] || to < 0 || to >= this.layers.length || from === to) return false; const [l] = this.layers.splice(from, 1); this.layers.splice(to, 0, l); return true; }
  duplicateLayer(i) {
    const src = this.layers[i]; if (!src || this.layers.length >= MAX_LAYERS) return null;
    const l = this.addLayer(src.name + ' (копія)', i + 1);
    l.opacity = src.opacity; l.visible = src.visible;
    for (const [fid, c] of src.cells) if (!this.store.isEmpty(c)) l.cells.set(fid, this.store.clone(c));
    return l;
  }
  /* ── клітинки ── */
  cell(layer, frame) { return layer.cells.get(frame.id) || null; }
  ensureCell(layer, frame) { let c = layer.cells.get(frame.id); if (!c) { c = this.store.create(); layer.cells.set(frame.id, c); } return c; }
  /* ── час ── */
  get totalUnits() { return this.frames.reduce((s, f) => s + f.hold, 0); }
  get duration() { return this.totalUnits / this.fps; }
  frameAt(unit) { let u = 0; for (let i = 0; i < this.frames.length; i++) { u += this.frames[i].hold; if (unit < u) return i; } return this.frames.length - 1; }
  startUnit(i) { let u = 0; for (let k = 0; k < i; k++) u += this.frames[k].hold; return u; }
  /* ── знімок структури для історії: клітинки за посиланням ── */
  structSnapshot() {
    return { frames: this.frames.map(f => ({ ...f })), layers: this.layers.map(l => ({ ...l, cells: new Map(l.cells) })), fps: this.fps, bg: this.bg, w: this.w, h: this.h };
  }
  restoreStruct(s) {
    this.frames = s.frames.map(f => ({ ...f }));
    this.layers = s.layers.map(l => ({ ...l, cells: new Map(l.cells) }));
    this.fps = s.fps; this.bg = s.bg; this.w = s.w; this.h = s.h;
  }
  /* ── опис для файлу (без пікселів) ── */
  meta() {
    return {
      app: FILE_APP, format: FILE_FORMAT, title: this.title, author: this.author, group: this.group,
      w: this.w, h: this.h, fps: this.fps, bg: this.bg, created: this.created, lesson: this.lesson,
      frames: this.frames.map(f => ({ id: f.id, hold: f.hold })),
      layers: this.layers.map(l => ({ id: l.id, name: l.name, visible: l.visible, locked: l.locked, opacity: l.opacity,
        cells: this.frames.filter(f => l.cells.has(f.id) && !this.store.isEmpty(l.cells.get(f.id))).map(f => f.id) })),
      audio: this.audio ? { name: this.audio.name, offset: this.audio.offset || 0, type: this.audio.type || '' } : null,
    };
  }
}

// Перевірка опису з файлу: чи це наш проєкт і чи він цілий
export function okMeta(m) {
  if (!m || typeof m !== 'object' || m.app !== FILE_APP) return false;
  if (!(m.w >= 16 && m.w <= 4096 && m.h >= 16 && m.h <= 4096)) return false;
  if (!Array.isArray(m.frames) || !m.frames.length || m.frames.length > MAX_FRAMES) return false;
  if (!Array.isArray(m.layers) || !m.layers.length || m.layers.length > MAX_LAYERS) return false;
  const ids = new Set(m.frames.map(f => f.id));
  if (ids.size !== m.frames.length) return false;
  return m.layers.every(l => typeof l.name === 'string' && Array.isArray(l.cells) && l.cells.every(id => ids.has(id)));
}

// Проєкт з опису; клітинки заповнює loadCell(layerMeta, frameId) → cell
export function projectFromMeta(store, m, loadCell) {
  const p = new Project(store, { empty: true, title: m.title, author: m.author, group: m.group, w: m.w, h: m.h, fps: m.fps, bg: m.bg, created: m.created, lesson: m.lesson });
  p.fps = Math.max(1, Math.min(30, m.fps || 8));
  p.frames = m.frames.map(f => ({ id: f.id, hold: Math.max(1, Math.min(12, f.hold || 1)) }));
  p.layers = m.layers.map(l => ({ id: l.id || uid('l'), name: l.name, visible: l.visible !== false, locked: !!l.locked, opacity: Math.max(0, Math.min(1, l.opacity ?? 1)), cells: new Map() }));
  m.layers.forEach((lm, i) => { for (const fid of lm.cells) { const c = loadCell(lm, fid, i); if (c) p.layers[i].cells.set(fid, c); } });
  p.audio = m.audio || null;
  return p;
}

/* ═════════ Історія змін ═════════
   Два види кроків: «пікселі» (зміна однієї клітинки, лише змінена ділянка) і «структура» (кадри, шари, налаштування).
   apply(step, dir) виконує той, хто знає, як класти пікселі. */
export class History {
  constructor(limit = 60) { this.undoStack = []; this.redoStack = []; this.limit = limit; }
  push(step) { this.undoStack.push(step); if (this.undoStack.length > this.limit) this.undoStack.shift(); this.redoStack.length = 0; }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  undo(apply) { const s = this.undoStack.pop(); if (!s) return null; apply(s, 'undo'); this.redoStack.push(s); return s; }
  redo(apply) { const s = this.redoStack.pop(); if (!s) return null; apply(s, 'redo'); this.undoStack.push(s); return s; }
  clear() { this.undoStack.length = 0; this.redoStack.length = 0; }
}
