// Малювання кадру сцени — однаково для перегляду й експорту.
// provider(layoutItem, sourceTime) → {src: CanvasImageSource | VideoSample, w, h} | null
import { S, media, layout, clipAt, srcTime } from './state.js';

export const FONT_STACK = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// висоти текстових блоків (для рамки виділення), обчислюються під час малювання
export const textBoxes = new WeakMap();

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return `rgba(0,0,0,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}

// розбиття тексту на рядки під задану ширину
function wrapLines(ctx, text, maxW) {
  const out = [];
  String(text || '').split('\n').forEach(par => {
    const words = par.split(/(\s+)/);
    let line = '';
    for (const w of words) {
      const test = line + w;
      if (ctx.measureText(test).width > maxW && line.trim()) { out.push(line.trimEnd()); line = w.trimStart(); }
      else line = test;
      // дуже довге слово — ріжемо посимвольно
      while (ctx.measureText(line).width > maxW && line.length > 1) {
        let i = line.length - 1;
        while (i > 1 && ctx.measureText(line.slice(0, i)).width > maxW) i--;
        out.push(line.slice(0, i)); line = line.slice(i);
      }
    }
    out.push(line.trimEnd());
  });
  return out;
}

// коефіцієнт появи/зникання
export function fadeAlpha(t, start, dur, fin, fout) {
  let a = 1;
  if (fin > 0) a = Math.min(a, (t - start) / fin);
  if (fout > 0) a = Math.min(a, (start + dur - t) / fout);
  return Math.max(0, Math.min(1, a));
}

export function drawText(ctx, o, W, H, k) {
  const size = (o.size || 64) * k;
  ctx.font = `${o.weight || 700} ${size}px ${FONT_STACK}`;
  ctx.textBaseline = 'alphabetic';
  const boxW = Math.max(20, o.w * W);
  const pad = o.bg === 'box' ? size * 0.35 : 0;
  const lines = wrapLines(ctx, o.text, boxW - pad * 2);
  const lh = size * 1.22;
  const boxH = lines.length * lh + pad * 2;
  const x = o.x * W, y = o.y * H;
  textBoxes.set(o, boxH / H);
  if (o.bg === 'box') {
    ctx.fillStyle = hexA(o.bgColor || '#000000', o.bgAlpha ?? 0.7);
    roundRectPath(ctx, x, y, boxW, boxH, size * 0.28);
    ctx.fill();
  }
  const align = o.align || 'left';
  ctx.textAlign = align;
  const tx = align === 'center' ? x + boxW / 2 : align === 'right' ? x + boxW - pad : x + pad;
  if (o.bg === 'shadow') { ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = size * 0.22; ctx.shadowOffsetY = size * 0.05; }
  if (o.bg === 'outline') { ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.14; ctx.strokeStyle = o.bgColor || '#000000'; }
  ctx.fillStyle = o.color || '#ffffff';
  lines.forEach((l, i) => {
    const ly = y + pad + lh * i + size * 0.95;
    if (o.bg === 'outline') ctx.strokeText(l, tx, ly);
    ctx.fillText(l, tx, ly);
  });
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.textAlign = 'left';
}

function drawArrow(ctx, o, W, H, k) {
  const x1 = o.x * W, y1 = o.y * H, x2 = (o.x + o.w) * W, y2 = (o.y + o.h) * H;
  const lw = (o.stroke || 10) * k;
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const head = Math.min(lw * 4.2, Math.hypot(x2 - x1, y2 - y1) * 0.6);
  ctx.strokeStyle = ctx.fillStyle = o.color || '#ef4444';
  ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = lw * 0.8;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - Math.cos(ang) * head * 0.7, y2 - Math.sin(ang) * head * 0.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(ang - 0.45) * head, y2 - Math.sin(ang - 0.45) * head);
  ctx.lineTo(x2 - Math.cos(ang + 0.45) * head, y2 - Math.sin(ang + 0.45) * head);
  ctx.closePath(); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
}

let blurCanvas = null;
function drawBlur(ctx, o, W, H) {
  let x = Math.round(o.x * W), y = Math.round(o.y * H), w = Math.round(o.w * W), h = Math.round(o.h * H);
  if (w < 0) { x += w; w = -w; } if (h < 0) { y += h; h = -h; }
  x = Math.max(0, x); y = Math.max(0, y); w = Math.min(W - x, w); h = Math.min(H - y, h);
  if (w < 2 || h < 2) return;
  const strength = Math.max(4, o.strength || 18) * Math.min(W, H) / 1080;
  const sw = Math.max(1, Math.round(w / strength)), sh = Math.max(1, Math.round(h / strength));
  if (!blurCanvas) blurCanvas = document.createElement('canvas');
  blurCanvas.width = sw; blurCanvas.height = sh;
  const b = blurCanvas.getContext('2d');
  b.imageSmoothingEnabled = true; b.imageSmoothingQuality = 'high';
  b.drawImage(ctx.canvas, x, y, w, h, 0, 0, sw, sh);
  ctx.save();
  roundRectPath(ctx, x, y, w, h, Math.min(w, h) * 0.08);
  ctx.clip();
  ctx.imageSmoothingEnabled = o.pixel ? false : true;
  ctx.drawImage(blurCanvas, 0, 0, sw, sh, x, y, w, h);
  ctx.restore();
  ctx.imageSmoothingEnabled = true;
}

export function drawOverlay(ctx, o, W, H, k) {
  switch (o.type) {
    case 'text': drawText(ctx, o, W, H, k); break;
    case 'rect': {
      let x = o.x * W, y = o.y * H, w = o.w * W, h = o.h * H;
      const lw = (o.stroke || 8) * k;
      if (o.fill) { ctx.fillStyle = hexA(o.color, 0.22); roundRectPath(ctx, x, y, w, h, (o.radius ?? 16) * k); ctx.fill(); }
      ctx.strokeStyle = o.color || '#ef4444'; ctx.lineWidth = lw;
      ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = lw;
      roundRectPath(ctx, x, y, w, h, (o.radius ?? 16) * k); ctx.stroke();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
      break;
    }
    case 'arrow': drawArrow(ctx, o, W, H, k); break;
    case 'blur': drawBlur(ctx, o, W, H); break;
    case 'spot': {
      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${o.dim ?? 0.6})`;
      ctx.beginPath(); ctx.rect(0, 0, W, H);
      const x = o.x * W, y = o.y * H, w = o.w * W, h = o.h * H;
      if (o.shape === 'ellipse') { ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2); }
      else { const r = Math.min(Math.abs(w), Math.abs(h)) * 0.12; ctx.moveTo(x + r, y); ctx.arcTo(x, y, x, y + h, r); ctx.arcTo(x, y + h, x + w, y + h, r); ctx.arcTo(x + w, y + h, x + w, y, r); ctx.arcTo(x + w, y, x, y, r); ctx.closePath(); }
      ctx.fill('evenodd');
      ctx.restore();
      break;
    }
    case 'image': {
      const m = media.get(o.mediaId);
      if (!m || !m.el) break;
      const x = o.x * W, y = o.y * H, w = o.w * W, h = o.h * H;
      ctx.save();
      if (o.radius) { roundRectPath(ctx, x, y, w, h, o.radius * k); ctx.clip(); }
      try { ctx.drawImage(m.el, x, y, w, h); } catch (e) { /* ще не завантажено */ }
      ctx.restore();
      break;
    }
  }
}

function drawCaption(ctx, c, W, H, k, style) {
  const size = (style.size || 46) * k;
  ctx.font = `600 ${size}px ${FONT_STACK}`;
  const maxW = W * 0.84;
  const lines = wrapLines(ctx, c.text, maxW - size * 0.8);
  const lh = size * 1.25;
  const widths = lines.map(l => ctx.measureText(l).width);
  const pad = size * 0.32;
  const total = lines.length * lh;
  const top = style.pos === 'top' ? H * 0.06 : H - H * 0.07 - total - pad * 2;
  ctx.textAlign = 'center';
  lines.forEach((l, i) => {
    const y = top + pad + i * lh;
    if (style.bg === 'box') {
      ctx.fillStyle = 'rgba(0,0,0,.66)';
      roundRectPath(ctx, W / 2 - widths[i] / 2 - pad, y - pad * 0.3, widths[i] + pad * 2, lh + pad * 0.3, size * 0.2);
      ctx.fill();
    } else { ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.16; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(l, W / 2, y + size * 0.95); }
    ctx.fillStyle = style.color || '#ffffff';
    ctx.fillText(l, W / 2, y + size * 0.95);
  });
  ctx.textAlign = 'left';
}

// Малює кадр основної доріжки з урахуванням вписування, зуму й затемнення
export function drawClipFrame(ctx, l, f, W, H, t) {
  const c = l.clip;
  const r = (c.fit === 'cover' ? Math.max : Math.min)(W / f.w, H / f.h);
  const dw0 = f.w * r, dh0 = f.h * r;
  const z = Math.max(1, c.zoom || 1);
  const fx = c.zx ?? 0.5, fy = c.zy ?? 0.5;
  const dw = dw0 * z, dh = dh0 * z;
  // точка фокусу лишається на тому самому місці екрана
  const px = W / 2 + (fx - 0.5) * dw0, py = H / 2 + (fy - 0.5) * dh0;
  let x = px - fx * dw, y = py - fy * dh;
  if (z > 1) { // не показуємо поля за межами кадру, якщо можна
    if (dw >= W) x = Math.min(0, Math.max(W - dw, x));
    if (dh >= H) y = Math.min(0, Math.max(H - dh, y));
  }
  if (f.src && typeof f.src.draw === 'function' && !(f.src instanceof HTMLCanvasElement)) f.src.draw(ctx, x, y, dw, dh);
  else ctx.drawImage(f.src, x, y, dw, dh);
  const a = 1 - fadeAlpha(t, l.start, l.end - l.start, c.fadeIn || 0, c.fadeOut || 0);
  if (a > 0.001) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, W, H); }
}

// opts.editing — перегляд на паузі: елементи показуємо повністю, без плавної появи, щоб їх було видно й зручно редагувати
export function renderScene(ctx, W, H, t, provider, L = layout(), opts = {}) {
  const p = S.project;
  const k = Math.min(W, H) / 1080;
  ctx.fillStyle = p.bg || '#000000';
  ctx.fillRect(0, 0, W, H);
  const l = clipAt(t, L);
  if (l) {
    const f = provider(l, srcTime(l, t));
    if (f && f.w && f.h) drawClipFrame(ctx, l, f, W, H, t);
  }
  for (const o of p.overlays) {
    if (t < o.start || t >= o.start + o.dur) continue;
    const fd = o.fade && !opts.editing ? Math.min(0.4, o.dur / 3) : 0;
    const a = fadeAlpha(t, o.start, o.dur, fd, fd);
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    drawOverlay(ctx, o, W, H, k);
    ctx.globalAlpha = 1;
  }
  const cap = p.captions.find(c => t >= c.start && t < c.start + c.dur);
  if (cap && cap.text.trim()) drawCaption(ctx, cap, W, H, k, p.captionStyle || {});
}
