// Конвертер зображень · Edvault — сторінка: файли, налаштування, черга, результати.
import { FORMATS, targetFormat, computeSize, orient, outName, uniqueNames, fmtBytes, fmtDelta, makeZip, svgSize, minifySvg, normSettings, DEFAULTS, pngColors, changesPixels } from './core.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ═════════ Іконки ═════════ */
const P = {
  convert: '<path d="M4 9h13l-4-4"/><path d="M20 15H7l4 4"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  split: '<path d="m8 7-5 5 5 5"/><path d="m16 7 5 5-5 5"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  zoom: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6M8 11h6"/>',
  rotl: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  rotr: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  fliph: '<path d="M12 3v18"/><path d="m16 7 4 5-4 5z"/><path d="m8 7-4 5 4 5z"/>',
  flipv: '<path d="M3 12h18"/><path d="m7 8 5-4 5 4z"/><path d="m7 16 5 4 5-4z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  gem: '<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
};
const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
const fillIcons = (root = document) => root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); el.removeAttribute('data-icon'); });

/* ═════════ Повідомлення ═════════ */
function toast(msg, kind = '') {
  const t = $('toast'); t.textContent = msg; t.className = 'toast on ' + kind;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.className = 'toast'; }, kind === 'err' ? 4500 : 2200);
}

/* ═════════ Тема ═════════ */
function syncTheme() { const dark = document.documentElement.dataset.theme === 'dark'; $('themeBtn').innerHTML = icon(dark ? 'sun' : 'moon'); }
$('themeBtn').onclick = () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('edvault-theme', next); } catch (e) { /* приватний режим */ }
  syncTheme();
};

/* ═════════ Налаштування ═════════ */
const KEY = 'edvault-imgconv';
let S = normSettings((() => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } })());
const saveSettings = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* немає місця */ } };

const PRESETS = [
  { id: 'mail', name: 'Для пошти', icon: 'mail', s: { format: 'jpeg', quality: 78, target: { on: false }, resize: { mode: 'fit', w: 1600, h: 1600 } } },
  { id: 'web', name: 'Для сайту', icon: 'globe', s: { format: 'webp', quality: 80, target: { on: false }, resize: { mode: 'fit', w: 1920, h: 0 } } },
  { id: 'avatar', name: 'Аватарка', icon: 'user', s: { format: 'jpeg', quality: 85, target: { on: false }, resize: { mode: 'exact', w: 512, h: 512 } } },
  { id: 'favicon', name: 'Іконка сайту', icon: 'star', s: { format: 'ico', resize: { mode: 'none' } } },
  { id: 'lossless', name: 'Без втрат', icon: 'gem', s: { format: 'png', png8: false, target: { on: false }, resize: { mode: 'none' } } },
];
function presetOn(p) {
  const s = p.s;
  if (s.format !== S.format) return false;
  if (s.quality != null && S.format !== 'png' && S.format !== 'ico' && s.quality !== S.quality) return false;
  if (s.png8 != null && s.png8 !== S.png8) return false;
  if (s.target && s.target.on === false && S.target.on && S.format !== 'ico') return false;
  if (s.resize.mode !== S.resize.mode) return false;
  if (s.resize.mode === 'fit' || s.resize.mode === 'exact') return (+s.resize.w || 0) === (+S.resize.w || 0) && (+s.resize.h || 0) === (+S.resize.h || 0);
  return true;
}
function applyPreset(p) {
  const s = p.s;
  S = normSettings(Object.assign({}, S, s, { target: Object.assign({}, S.target, s.target || {}), resize: Object.assign({}, S.resize, s.resize || {}) }));
  changed();
}

/* ═════════ Можливості браузера ═════════ */
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let seq = 0;
const pending = new Map();
worker.onmessage = e => { const p = pending.get(e.data.id); if (!p) return; pending.delete(e.data.id); e.data.ok ? p.resolve(e.data.result) : p.reject(new Error(e.data.error)); };
worker.onerror = e => { console.error(e); for (const p of pending.values()) p.reject(new Error('Помилка фонової обробки')); pending.clear(); };
const call = (type, data = {}, transfer = []) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); worker.postMessage({ id, type, ...data }, transfer); });
let CAPS = { jpeg: true, png: true, webp: true, avif: false };
const capsReady = call('caps').then(c => { CAPS = c; renderSettings(); }).catch(() => { /* лишаємо базові */ });

/* ═════════ Панель налаштувань ═════════ */
const FMT_KEYS = ['same', 'jpeg', 'png', 'webp', 'avif', 'ico'];
const FMT_SUB = { same: 'стиснути', jpeg: 'фото', png: 'прозорість', webp: 'найкращий', avif: 'найменший', ico: 'favicon' };
const FMT_HINT = {
  same: 'Кожен файл лишається у своєму форматі, лише стискається. SVG очищується від зайвого.',
  jpeg: 'Найсумісніший для фото. Прозорі місця заливаються кольором тла.',
  png: 'Без втрат і з прозорістю. Добре для скриншотів, схем, логотипів.',
  webp: 'Менший за JPG при тій самій якості, підтримує прозорість. Відкривається всюди, крім дуже старих програм.',
  avif: 'Найменші файли, але кодується повільніше, а відкривають його не всі програми.',
  ico: 'Іконка сайту з кількома розмірами всередині (16, 32, 48, 256). Зображення вписується в квадрат.',
};
const RS_MODES = [['none', 'Без змін'], ['percent', 'У %'], ['fit', 'Вписати'], ['exact', 'Обрізати']];
const FIT_SIZES = [[3840, 0, '4K'], [1920, 0, '1920'], [1280, 0, '1280'], [800, 0, '800'], [0, 1080, 'висота 1080']];
const EXACT_SIZES = [[1080, 1080, '1080×1080'], [512, 512, '512×512'], [1280, 720, '1280×720'], [1920, 1080, '1920×1080'], [1200, 630, '1200×630']];
const BG_COLORS = ['#ffffff', '#000000', '#f0f2f5'];

function renderSettings() {
  $('presets').innerHTML = PRESETS.map(p => `<button class="preset${presetOn(p) ? ' on' : ''}" data-preset="${p.id}">${icon(p.icon)}${p.name}</button>`).join('');
  $('fmt').innerHTML = FMT_KEYS.map(k => {
    const off = k === 'avif' && !CAPS.avif;
    return `<button data-fmt="${k}" class="${S.format === k ? 'on' : ''}" ${off ? 'disabled title="Цей браузер не вміє зберігати AVIF — спробуйте Chrome або Edge новішої версії"' : ''}>${FORMATS[k].label}<small>${FMT_SUB[k]}</small></button>`;
  }).join('');
  $('fmtHint').textContent = FMT_HINT[S.format] || '';
  // якість
  const lossy = S.format === 'same' || FORMATS[S.format].lossy;
  const pngLike = S.format === 'png' || S.format === 'same';
  $('qualSec').hidden = S.format === 'ico';
  $('quality').value = S.quality;
  $('quality').disabled = S.target.on && !(S.format === 'png' && S.png8);
  $('qVal').textContent = S.target.on ? 'авто' : S.format === 'png' ? (S.png8 ? pngColors(S.quality) + ' кольорів' : 'без втрат') : S.quality + '%';
  $('png8Wrap').hidden = !pngLike;
  $('png8').checked = S.png8;
  $('quality').hidden = $('quality').nextElementSibling.hidden = S.format === 'png' && !S.png8;
  $('targetOn').checked = S.target.on; $('targetKb').value = S.target.kb;
  $('targetOn').closest('.check').hidden = !(lossy || (S.format === 'png' && S.png8));
  // розмір
  $('rsMode').innerHTML = RS_MODES.map(([k, n]) => `<button data-rs="${k}" class="${S.resize.mode === k ? 'on' : ''}">${n}</button>`).join('');
  const r = S.resize;
  let body = '';
  if (r.mode === 'percent') body = `<div class="pct-row"><input type="range" id="rsPct" min="5" max="200" step="5" value="${r.percent}"><span class="val">${r.percent}%</span></div>
    <div class="sizes">${[25, 50, 75].map(v => `<button data-pct="${v}" class="${+r.percent === v ? 'on' : ''}">${v}%</button>`).join('')}</div>`;
  else if (r.mode === 'fit' || r.mode === 'exact') {
    const list = r.mode === 'fit' ? FIT_SIZES : EXACT_SIZES;
    body = `<div class="dims"><div><label for="rsW">Ширина</label><input class="inp" id="rsW" type="number" min="1" placeholder="${r.mode === 'fit' ? 'будь-яка' : ''}" value="${+r.w || ''}"></div><span class="x">×</span><div><label for="rsH">Висота</label><input class="inp" id="rsH" type="number" min="1" placeholder="${r.mode === 'fit' ? 'будь-яка' : ''}" value="${+r.h || ''}"></div></div>
      <div class="sizes">${list.map(([w, h, n]) => `<button data-wh="${w}x${h}" class="${(+r.w || 0) === w && (+r.h || 0) === h ? 'on' : ''}">${n}</button>`).join('')}</div>
      <p class="hint">${r.mode === 'fit' ? 'Пропорції зберігаються: зображення вміщується в рамку. Порожнє поле — без обмеження.' : 'Рівно такий розмір, зайве обрізається по центру.'}</p>`;
  }
  $('rsBody').innerHTML = body;
  $('noUpWrap').hidden = r.mode === 'none';
  $('noUp').checked = r.noUpscale;
  // поворот
  $('rotVal').textContent = S.rotate + '°' + (S.flipH ? ' · дзеркало ↔' : '') + (S.flipV ? ' · дзеркало ↕' : '');
  $('flipH').classList.toggle('on', S.flipH); $('flipV').classList.toggle('on', S.flipV);
  // інше
  if (document.activeElement !== $('namePat')) $('namePat').value = S.name;
  $('tokens').innerHTML = [['{name}', 'назва'], ['{n}', 'номер'], ['{w}', 'ширина'], ['{h}', 'висота']].map(([t, n]) => `<button data-token="${t}" title="${n}">${t}</button>`).join('');
  const customBg = !BG_COLORS.includes(S.bg.toLowerCase());
  $('bgRow').innerHTML = BG_COLORS.map(c => `<button data-bg="${c}" class="${S.bg.toLowerCase() === c ? 'on' : ''}" style="background:${c}" title="${c}"></button>`).join('') +
    `<label class="${customBg ? 'on' : ''}" title="Свій колір"${customBg ? ` style="background:${S.bg}"` : ''}><input type="color" id="bgCustom" value="${S.bg}"></label>`;
  $('keepSmaller').checked = S.keepSmaller;
}

function changed(reprocess = true) {
  saveSettings();
  renderSettings();
  if (reprocess) schedule();
}
$('side').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  const d = t.dataset;
  if (d.preset) applyPreset(PRESETS.find(p => p.id === d.preset));
  else if (d.fmt) { S.format = d.fmt; changed(); }
  else if (d.rs) { S.resize.mode = d.rs; changed(); }
  else if (d.pct) { S.resize.percent = +d.pct; changed(); }
  else if (d.wh) { const [w, h] = d.wh.split('x').map(Number); S.resize.w = w; S.resize.h = h; changed(); }
  else if (d.rot) { S.rotate = (S.rotate + +d.rot + 360) % 360; changed(); }
  else if (t.id === 'flipH') { S.flipH = !S.flipH; changed(); }
  else if (t.id === 'flipV') { S.flipV = !S.flipV; changed(); }
  else if (d.bg) { S.bg = d.bg; changed(); }
  else if (d.token) { const i = $('namePat'); const p = i.selectionStart ?? i.value.length; i.value = i.value.slice(0, p) + d.token + i.value.slice(i.selectionEnd ?? p); i.focus(); i.setSelectionRange(p + d.token.length, p + d.token.length); S.name = i.value; changed(false); renderList(); }
  else if (t.id === 'resetBtn') { S = normSettings(DEFAULTS); changed(); toast('Налаштування скинуто'); }
});
$('side').addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'quality') { S.quality = +t.value; changed(); }
  else if (t.id === 'rsPct') { S.resize.percent = +t.value; t.nextElementSibling.textContent = t.value + '%'; saveSettings(); schedule(); }
  else if (t.id === 'rsW' || t.id === 'rsH') { S.resize[t.id === 'rsW' ? 'w' : 'h'] = Math.max(0, Math.round(+t.value || 0)); saveSettings(); schedule(); t.closest('.rs-body').querySelectorAll('.sizes .on').forEach(b => b.classList.remove('on')); }
  else if (t.id === 'targetKb') { S.target.kb = Math.max(1, Math.round(+t.value || 1)); saveSettings(); if (S.target.on) schedule(); }
  else if (t.id === 'namePat') { S.name = t.value; saveSettings(); renderList(); }
  else if (t.id === 'bgCustom') { S.bg = t.value; saveSettings(); schedule(); }
});
$('side').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'png8') { S.png8 = t.checked; changed(); }
  else if (t.id === 'targetOn') { S.target.on = t.checked; changed(); }
  else if (t.id === 'noUp') { S.resize.noUpscale = t.checked; changed(); }
  else if (t.id === 'keepSmaller') { S.keepSmaller = t.checked; changed(); }
  else if (t.id === 'bgCustom' || t.id === 'rsW' || t.id === 'rsH' || t.id === 'rsPct') renderSettings();
});

/* ═════════ Файли ═════════ */
let items = [], uid = 0;
const isSvg = f => f.type === 'image/svg+xml' || /\.svg$/i.test(f.name);
const mimeOf = f => isSvg(f) ? 'image/svg+xml' : f.type || ({ heic: 'image/heic', heif: 'image/heif', ico: 'image/x-icon', avif: 'image/avif', webp: 'image/webp', bmp: 'image/bmp' }[(f.name.split('.').pop() || '').toLowerCase()] || '');
const FMT_NAME = { 'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WebP', 'image/avif': 'AVIF', 'image/gif': 'GIF', 'image/svg+xml': 'SVG', 'image/bmp': 'BMP', 'image/x-icon': 'ICO', 'image/vnd.microsoft.icon': 'ICO', 'image/heic': 'HEIC', 'image/heif': 'HEIF', 'image/tiff': 'TIFF' };

function addFiles(list) {
  const files = [...list].filter(f => /^image\//.test(f.type) || /\.(svg|heic|heif|ico|avif|webp)$/i.test(f.name));
  if (!files.length) { if (list.length) toast('Це не зображення', 'err'); return; }
  for (const f of files) {
    const name = f.name && f.name !== 'image.png' ? f.name : 'Вставлене зображення ' + (uid + 1) + '.png';
    items.push({ id: ++uid, file: f, name, mime: mimeOf(f), size: f.size, thumb: URL.createObjectURL(f), status: 'wait' });
  }
  renderList();
  schedule(0, false);
}
function removeItem(id) {
  const i = items.findIndex(x => x.id === id); if (i < 0) return;
  const it = items[i]; URL.revokeObjectURL(it.thumb); if (it.out) URL.revokeObjectURL(it.out.url);
  items.splice(i, 1);
  renderList();
}
$('fileInput').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
$('addBtn').onclick = () => $('fileInput').click();
$('clearBtn').onclick = () => { items.forEach(it => { URL.revokeObjectURL(it.thumb); if (it.out) URL.revokeObjectURL(it.out.url); }); items = []; runGen++; renderList(); };
$('drop').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('fileInput').click(); } });
document.addEventListener('paste', e => {
  if (e.target.closest && e.target.closest('input')) return;
  const files = [...(e.clipboardData?.files || [])];
  if (files.length) { e.preventDefault(); addFiles(files); }
});
let dragDepth = 0;
const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
document.addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; $('dragover').classList.add('on'); });
document.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('dragover').classList.remove('on'); } });
document.addEventListener('drop', e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth = 0; $('dragover').classList.remove('on'); addFiles(e.dataTransfer.files); });

/* ═════════ Обробка ═════════ */
let runGen = 0, timer = 0;
// all — перерахувати все (змінилися налаштування); інакше лише нові файли
function schedule(delay = 350, all = true) {
  const gen = ++runGen;
  if (all) items.forEach(it => { it.status = 'wait'; });
  renderList();
  clearTimeout(timer);
  timer = setTimeout(() => run(gen), delay);
}
async function run(gen) {
  await capsReady;
  for (const it of items.slice()) {
    if (gen !== runGen) return;
    if (it.status !== 'wait' && it.status !== 'work') continue; // «work» — перервана попередня черга
    it.status = 'work'; renderItem(it);
    try {
      const out = await processItem(it);
      if (gen !== runGen || !items.includes(it)) { if (out && out.url) URL.revokeObjectURL(out.url); return; }
      if (it.out) URL.revokeObjectURL(it.out.url);
      it.out = out; it.status = 'done'; it.err = '';
    } catch (err) {
      if (gen !== runGen) return;
      console.error(err);
      it.status = 'err'; it.err = err.message || 'Не вдалося обробити';
    }
    renderItem(it); renderSum();
  }
}

// зображення, яке браузер не відкрив у фоні (напр. HEIC у Safari) — пробуємо через <img>
async function decodeViaImg(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image(); img.src = url;
    await img.decode();
    return await createImageBitmap(img);
  } finally { URL.revokeObjectURL(url); }
}
// SVG малюємо одразу в потрібному розмірі — тоді він чіткий
async function rasterSvg(text, s, fmt) {
  const { w, h } = svgSize(text);
  const [ow, oh] = orient(w, h, s.rotate);
  const sz = computeSize(ow, oh, s.resize);
  const cw = sz.crop ? sz.crop.sw : ow, ch = sz.crop ? sz.crop.sh : oh;
  let scale = Math.max(1, sz.w / cw, sz.h / ch, fmt === 'ico' ? 256 / Math.max(w, h) : 1);
  scale = Math.min(scale, 8192 / Math.max(w, h));
  const W = Math.max(1, Math.round(w * scale)), H = Math.max(1, Math.round(h * scale));
  const blob = new Blob([minifySvg(text, { w: W, h: H })], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    c.getContext('2d').drawImage(img, 0, 0, W, H);
    return { bmp: await createImageBitmap(c), scale: W / w };
  } finally { URL.revokeObjectURL(url); }
}

async function processItem(it) {
  const s = JSON.parse(JSON.stringify(S));
  if (it.mime === 'image/svg+xml') s.resize.noUpscale = false; // вектор збільшується без втрат
  let fmt = targetFormat(it.mime, s.format), note = '';
  if (fmt === 'avif' && !CAPS.avif) { fmt = 'webp'; note = 'AVIF недоступний — збережено як WebP'; }
  // SVG → SVG: лише очищення
  if (fmt === 'svg' && (s.rotate || s.flipH || s.flipV || s.resize.mode === 'exact')) fmt = 'png';
  if (fmt === 'svg') {
    const text = await it.file.text();
    const o = svgSize(text);
    const size = s.resize.mode !== 'none' ? computeSize(o.w, o.h, s.resize) : null;
    let blob = new Blob([minifySvg(text, size)], { type: 'image/svg+xml' });
    if (s.keepSmaller && !size && blob.size >= it.size) { blob = it.file; note = 'Оригінал уже стиснутий — залишено як є'; }
    return finish(it, { blob, w: size ? size.w : o.w, h: size ? size.h : o.h, srcW: o.w, srcH: o.h, fmt: 'svg', note });
  }
  let src, scale = 1, transfer = [];
  if (it.mime === 'image/svg+xml') {
    const r = await rasterSvg(await it.file.text(), s, fmt); src = r.bmp; scale = r.scale; transfer = [src];
  } else src = it.file;
  let r;
  try { r = await call('convert', { src, scale, fmt, s }, transfer); }
  catch (err) {
    if (!(src instanceof Blob)) throw err;
    let bmp;
    try { bmp = await decodeViaImg(it.file); } catch { throw new Error('Браузер не вміє відкривати цей формат' + (/hei[cf]/.test(it.mime) ? ' (HEIC відкривається в Safari)' : '')); }
    r = await call('convert', { src: bmp, scale: 1, fmt, s }, [bmp]);
  }
  let blob = r.blob;
  const sameFmt = FORMATS[fmt].mime === it.mime || (fmt === 'jpeg' && it.mime === 'image/jpg');
  if (s.keepSmaller && sameFmt && !changesPixels(s) && blob.size >= it.size) { blob = it.file; note = 'Оригінал уже менший — залишено як є'; }
  else if (r.miss) note = 'Менше не вийшло — це найменший розмір при цих налаштуваннях';
  return finish(it, { blob, w: r.w, h: r.h, srcW: r.srcW, srcH: r.srcH, fmt, note });
}
function finish(it, o) {
  it.srcW = o.srcW; it.srcH = o.srcH;
  return { ...o, size: o.blob.size, url: URL.createObjectURL(o.blob), ext: o.fmt === 'jpeg' ? 'jpg' : o.fmt };
}

/* ═════════ Список ═════════ */
const outFileName = (it, i) => it.out ? outName(S.name, { name: it.name, n: i + 1, w: it.out.w, h: it.out.h, ext: it.out.ext }) : '';
function rowHtml(it, i) {
  const fmtIn = FMT_NAME[it.mime] || (it.mime.split('/')[1] || '?').toUpperCase();
  const dimsIn = it.srcW ? `${it.srcW}×${it.srcH}` : '';
  let right = '';
  if (it.status === 'work' || it.status === 'wait') right = `<span class="spin"></span><span class="note">${it.status === 'work' ? 'Обробка…' : 'У черзі'}</span>`;
  else if (it.status === 'err') right = `<span class="note err">${esc(it.err)}</span>`;
  else if (it.out) {
    // вектор → растр: відсоток нічого не каже, тож не показуємо
    const d = it.mime === 'image/svg+xml' && it.out.fmt !== 'svg' ? { text: '' } : fmtDelta(it.size, it.out.size);
    right = `${icon('arrow', 'arrow')}<span class="out">${it.out.fmt === 'jpeg' ? 'JPG' : it.out.fmt === 'svg' ? 'SVG' : FORMATS[it.out.fmt].label} · ${it.out.w}×${it.out.h} · ${fmtBytes(it.out.size)}</span>${d.text ? `<span class="chip ${d.cls}">${d.text}</span>` : ''}` +
      (it.out.note ? `<span class="note${/не вийшло|недоступний/.test(it.out.note) ? ' warn' : ''}">${esc(it.out.note)}</span>` : '');
  }
  const done = it.status === 'done' && it.out;
  const copyOk = done && it.out.fmt !== 'ico' && it.out.fmt !== 'svg' && navigator.clipboard && window.ClipboardItem;
  return `<div class="row" data-id="${it.id}">
    <div class="thumb" data-act="cmp" title="Порівняти до і після"><img src="${it.thumb}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{innerHTML:'${icon('image').replace(/"/g, '&quot;')}'}))"></div>
    <div class="info">
      <div class="fname" title="${esc(it.name)}${done ? ' → ' + esc(outFileName(it, i)) : ''}">${esc(it.name)}</div>
      <div class="meta"><span>${fmtIn}${dimsIn ? ' · ' + dimsIn : ''} · ${fmtBytes(it.size)}</span>${right}</div>
    </div>
    <div class="acts">
      ${done ? `<button class="btn btn-icon" data-act="cmp" title="Порівняти до і після">${icon('split')}</button>` : ''}
      ${copyOk ? `<button class="btn btn-icon" data-act="copy" title="Скопіювати картинку">${icon('copy')}</button>` : ''}
      ${done ? `<button class="btn" data-act="dl" title="${esc(outFileName(it, i))}">${icon('download')}Завантажити</button>` : ''}
      <button class="btn btn-icon" data-act="rm" title="Прибрати зі списку">${icon('x')}</button>
    </div>
  </div>`;
}
function renderList() {
  const has = items.length > 0;
  $('drop').hidden = has; $('files').hidden = !has;
  $('list').innerHTML = items.map(rowHtml).join('');
  renderSum();
}
function renderItem(it) {
  const el = $('list').querySelector(`.row[data-id="${it.id}"]`);
  if (!el) return renderList();
  const t = document.createElement('div'); t.innerHTML = rowHtml(it, items.indexOf(it));
  el.replaceWith(t.firstElementChild);
}
function renderSum() {
  const done = items.filter(it => it.status === 'done' && it.out);
  const busy = items.some(it => it.status === 'work' || it.status === 'wait');
  const before = done.reduce((s, it) => s + it.size, 0), after = done.reduce((s, it) => s + it.out.size, 0);
  const d = fmtDelta(before, after);
  $('sum').innerHTML = `<b>${items.length}</b> ${plural(items.length, 'файл', 'файли', 'файлів')}` +
    (done.length ? ` · ${fmtBytes(before)} ${icon('arrow', 'arrow').replace('<svg', '<svg style="width:14px;height:14px;color:var(--muted)"')} <b>${fmtBytes(after)}</b>${d.text ? `<span class="chip ${d.cls}">${d.text}</span>` : ''}` : '') +
    (busy ? ' <span class="spin"></span>' : '');
  $('zipBtn').disabled = busy || !done.length;
  $('zipLabel').textContent = done.length > 1 ? 'Завантажити все (ZIP)' : 'Завантажити';
}
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };

$('list').addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const it = items.find(x => x.id === +b.closest('.row').dataset.id); if (!it) return;
  const a = b.dataset.act;
  if (a === 'rm') removeItem(it.id);
  else if (a === 'dl' && it.out) download(it.out.url, outFileName(it, items.indexOf(it)));
  else if (a === 'cmp' && it.out) openCompare(it);
  else if (a === 'copy' && it.out) copyImage(it);
});
function download(url, name) {
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
async function copyImage(it) {
  try {
    let blob = it.out.blob;
    if (blob.type !== 'image/png') {
      const bmp = await createImageBitmap(blob); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
      c.getContext('2d').drawImage(bmp, 0, 0); blob = await new Promise(r => c.toBlob(r, 'image/png'));
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast('Скопійовано — можна вставити в документ чи чат');
  } catch (e) { toast('Не вдалося скопіювати', 'err'); }
}
$('zipBtn').onclick = async () => {
  const done = items.filter(it => it.status === 'done' && it.out);
  if (!done.length) return;
  if (done.length === 1) { download(done[0].out.url, outFileName(done[0], items.indexOf(done[0]))); return; }
  const names = uniqueNames(done.map(it => outFileName(it, items.indexOf(it))));
  const files = await Promise.all(done.map(async (it, i) => ({ name: names[i], data: new Uint8Array(await it.out.blob.arrayBuffer()) })));
  const url = URL.createObjectURL(new Blob([makeZip(files)], { type: 'application/zip' }));
  download(url, 'images.zip');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

/* ═════════ Порівняння до / після ═════════ */
let cmpIt = null, cmpPos = 0.5, cmpFit = true;
function openCompare(it) {
  cmpIt = it; cmpPos = 0.5; cmpFit = true;
  $('cmpTitle').textContent = it.name;
  $('cmpA').src = it.thumb; $('cmpB').src = it.out.url;
  $('cmpTagA').textContent = 'До · ' + fmtBytes(it.size);
  $('cmpTagB').textContent = 'Після · ' + fmtBytes(it.out.size);
  $('cmp').hidden = false;
  layoutCompare();
}
function layoutCompare() {
  if (!cmpIt) return;
  const w = cmpIt.out.w, h = cmpIt.out.h, st = $('cmpStage');
  const k = cmpFit ? Math.min(1, (st.clientWidth - 40) / w, (st.clientHeight - 40) / h) : 1;
  $('cmpBox').style.width = Math.round(w * k) + 'px'; $('cmpBox').style.height = Math.round(h * k) + 'px';
  $('cmpZoomLbl').textContent = cmpFit ? '100%' : 'Вмістити';
  st.style.justifyContent = cmpFit ? 'center' : 'flex-start'; st.style.alignItems = cmpFit ? 'center' : 'flex-start';
  setCmp(cmpPos);
}
function setCmp(p) {
  cmpPos = Math.min(1, Math.max(0, p));
  $('cmpB').style.clipPath = `inset(0 0 0 ${cmpPos * 100}%)`;
  $('cmpLine').style.left = cmpPos * 100 + '%';
}
const closeCompare = () => { $('cmp').hidden = true; cmpIt = null; };
$('cmpClose').onclick = closeCompare;
$('cmpZoom').onclick = () => { cmpFit = !cmpFit; layoutCompare(); };
$('cmpBox').addEventListener('pointerdown', e => {
  const box = $('cmpBox'); box.setPointerCapture(e.pointerId);
  const move = ev => { const r = box.getBoundingClientRect(); setCmp((ev.clientX - r.left) / r.width); };
  move(e);
  box.onpointermove = move;
  box.onpointerup = () => { box.onpointermove = null; };
});
window.addEventListener('resize', () => { if (cmpIt) layoutCompare(); });
document.addEventListener('keydown', e => {
  if ($('cmp').hidden) return;
  if (e.key === 'Escape') closeCompare();
  else if (e.key === 'ArrowLeft') setCmp(cmpPos - 0.05);
  else if (e.key === 'ArrowRight') setCmp(cmpPos + 0.05);
});

/* ═════════ Старт ═════════ */
fillIcons();
syncTheme();
renderSettings();
renderList();
window.ImgConv = { get items() { return items; }, get settings() { return S; }, addFiles };
