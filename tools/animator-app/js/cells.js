// Аніматор · склад клітинок у браузері.
// Клітинка — малюнок одного шару на одному кадрі. Розгорнута (canvas) — для малювання й показу;
// згорнута (PNG Blob) — щоб довгий мультфільм не з'їв пам'ять. Розгорнутими лишаються не більше LIMIT клітинок.

const LIMIT = 48;
let W = 960, H = 540, tick = 0;
const live = new Set(); // розгорнуті клітинки

export function setSize(w, h) { W = w; H = h; }
const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };

export class Cell {
  constructor() { this.canvas = null; this.blob = null; this.empty = true; this.rev = 0; this.used = 0; this.loading = null; this.cache = null; }
  // canvas для малювання (створює порожній, якщо клітинки ще не було)
  draw() { if (!this.canvas) { if (this.blob) throw new Error('спершу load()'); this.canvas = mk(); } this.touch(); this.empty = false; this.blob = null; this.rev++; return this.canvas; }
  touch() { this.used = ++tick; live.add(this); }
  get ready() { return !!this.canvas || (!this.blob); }
  // canvas для показу або null, якщо клітинка порожня; null і для згорнутої (тоді треба load())
  view() { if (this.canvas) { this.touch(); return this.canvas; } return null; }
  async load() {
    if (this.canvas || !this.blob) return this.canvas;
    if (!this.loading) this.loading = (async () => {
      const bmp = await createImageBitmap(this.blob);
      if (!this.canvas) { const c = mk(); c.getContext('2d').drawImage(bmp, 0, 0); this.canvas = c; this.cache = { blob: this.blob, rev: this.rev }; this.blob = null; }
      bmp.close && bmp.close();
      this.touch(); this.loading = null;
      return this.canvas;
    })();
    return this.loading;
  }
  // PNG клітинки (для файлу й автозбереження)
  async png() {
    if (this.blob && !this.canvas) return this.blob;
    if (this.cache && this.cache.rev === this.rev) return this.cache.blob;
    if (!this.canvas) return null;
    return new Promise(r => this.canvas.toBlob(r, 'image/png'));
  }
  static fromBlob(blob) { const c = new Cell(); c.blob = blob; c.empty = false; return c; }
  static fromCanvas(src) { const c = new Cell(); c.canvas = mk(); c.canvas.getContext('2d').drawImage(src, 0, 0); c.empty = false; c.touch(); return c; }
}

// Склад для моделі проєкту
export const store = {
  create: () => new Cell(),
  clone(c) {
    if (c.canvas) return Cell.fromCanvas(c.canvas);
    if (c.blob) return Cell.fromBlob(c.blob);
    return new Cell();
  },
  isEmpty: c => !c || c.empty,
};

// Згортаємо давно не використані клітинки (крім тих, що потрібні зараз)
export async function trim(keep = new Set()) {
  if (live.size <= LIMIT) return;
  const list = [...live].filter(c => c.canvas && !keep.has(c)).sort((a, b) => a.used - b.used);
  for (const c of list.slice(0, live.size - LIMIT)) {
    // клітинку не міняли після завантаження — PNG уже є, стискати вдруге не треба
    if (c.cache && c.cache.rev === c.rev) { c.blob = c.cache.blob; c.canvas = null; live.delete(c); continue; }
    const rev = c.rev, blob = await new Promise(r => c.canvas.toBlob(r, 'image/png'));
    if (!blob || c.rev !== rev || keep.has(c) || !c.canvas) continue; // поки стискали, клітинку змінили — лишаємо
    c.blob = blob; c.cache = { blob, rev }; c.canvas = null; live.delete(c);
  }
}
export function forgetAll() { live.clear(); }
export const liveCount = () => live.size;

// Чи клітинка насправді порожня (після гумки): перевіряємо прозорість у сітці точок
export function isBlank(canvas) {
  const g = canvas.getContext('2d', { willReadFrequently: true }), d = g.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < d.length; i += 16) if (d[i]) return false;
  return true;
}
