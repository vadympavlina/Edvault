// Файли й папки · Edvault — провідник, рівні, прогрес і результати.
import { CHAPTERS, LEVELS } from './levels.js';
import { createSession, findById, node, pathOf, mkdir, rename, move, copy, remove, restore, emptyBin, search, validName, kindOf, typeName, fmtSize, ext, base } from './fs.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ═════════ Іконки ═════════ */
const P = {
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  folderPlus: '<path d="M12 10v6M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  left: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  chev: '<path d="m9 18 6-6-6-6"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  paste: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  pen: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  trashX: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11l4 4M14 11l-4 4"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',
  fileText: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  film: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18M3 7.5h4M3 12h18M3 16.5h4M17 3v18M17 7.5h4M17 16.5h4"/>',
  hdd: '<path d="M22 12H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11zM6 16h.01M10 16h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  star: '<path fill="currentColor" stroke="none" d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
};
const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
const starsHtml = n => `<span class="stars">${[0, 1, 2].map(i => icon('star', i < n ? 'on' : '')).join('')}</span>`;
document.querySelectorAll('[data-icon]').forEach(e => { e.outerHTML = icon(e.dataset.icon); });
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); }

const SPECIAL = { 'Робочий стіл': 'monitor', 'Документи': 'fileText', 'Завантаження': 'download', 'Зображення': 'image', 'Музика': 'music', 'Відео': 'film' };
const KIND_COLOR = { image: '#0ea5e9', audio: '#ec4899', video: '#8b5cf6', doc: '#2563eb', pdf: '#ef4444', sheet: '#16a34a', slides: '#f97316', text: '#64748b', archive: '#a16207', app: '#475569', tmp: '#9ca3af', file: '#9ca3af' };
const GLYPH = {
  image: '<path d="M14 24l6-7 5 5 3-3 6 5z" fill="C"/><circle cx="27" cy="13" r="2.4" fill="C"/>',
  audio: '<path d="M21 23V12l9-2v11" stroke="C" stroke-width="2.2" fill="none"/><circle cx="19" cy="23" r="2.6" fill="C"/><circle cx="28" cy="21" r="2.6" fill="C"/>',
  video: '<path d="M20 11.5v12l10-6z" fill="C"/>',
  doc: '<path d="M15 12h17M15 16h17M15 20h12" stroke="C" stroke-width="2.2"/>',
  pdf: '<path d="M15 12h17M15 16h17M15 20h12" stroke="C" stroke-width="2.2"/>',
  text: '<path d="M15 12h17M15 16h17M15 20h10" stroke="C" stroke-width="2"/>',
  sheet: '<rect x="15" y="10" width="17" height="13" fill="none" stroke="C" stroke-width="2"/><path d="M15 14.5h17M15 18.7h17M21 10v13" stroke="C" stroke-width="1.6"/>',
  slides: '<rect x="15" y="10" width="17" height="12" rx="1.5" fill="none" stroke="C" stroke-width="2"/><path d="M19 18l3-3 3 2 3-4" stroke="C" stroke-width="1.6" fill="none"/>',
  archive: '<path d="M23 6v4M23 12v2M23 16v2" stroke="C" stroke-width="3"/><rect x="21" y="19" width="4" height="5" rx="1" fill="C"/>',
  app: '<rect x="15" y="10" width="17" height="13" rx="2" fill="none" stroke="C" stroke-width="2"/><path d="M15 14h17" stroke="C" stroke-width="2"/>',
  tmp: '<path d="M15 12h17M15 16h17M15 20h12" stroke="C" stroke-width="2" stroke-dasharray="2 2"/>',
  file: '',
};
// Малюнки-сюжети для фото
const ART = {
  sea: '<rect width="320" height="200" fill="#bae6fd"/><circle cx="250" cy="55" r="26" fill="#fde047"/><path d="M0 120h320v80H0z" fill="#0284c7"/><path d="M0 128q20-8 40 0t40 0 40 0 40 0 40 0 40 0 40 0 40 0" stroke="#e0f2fe" stroke-width="4" fill="none"/><path d="M0 160q20-8 40 0t40 0 40 0 40 0 40 0 40 0 40 0 40 0" stroke="#7dd3fc" stroke-width="4" fill="none"/><path d="M60 118l18-30v30z" fill="#fff"/>',
  mountains: '<rect width="320" height="200" fill="#e0f2fe"/><path d="M0 200l90-130 60 80 50-60 120 110z" fill="#64748b"/><path d="M90 70l20 30-12-4-8 10-9-12-10 6z" fill="#fff"/><path d="M200 90l18 22-10-3-8 8-8-9-10 4z" fill="#fff"/><path d="M0 200l60-50 70 50z" fill="#475569"/>',
  forest: '<rect width="320" height="200" fill="#dcfce7"/><rect y="160" width="320" height="40" fill="#86efac"/>' + [30, 80, 140, 200, 260].map((x, i) => `<rect x="${x + 16}" y="140" width="8" height="30" fill="#78350f"/><path d="M${x} ${150 - i % 2 * 10}l20-${70 - i % 2 * 10} 20 ${70 - i % 2 * 10}z" fill="${i % 2 ? '#15803d' : '#16a34a'}"/>`).join(''),
  sunset: '<rect width="320" height="200" fill="#fdba74"/><rect width="320" height="90" fill="#fb7185"/><circle cx="160" cy="130" r="40" fill="#fde047"/><rect y="130" width="320" height="70" fill="#7c2d12"/><path d="M60 150h200M100 168h120" stroke="#fdba74" stroke-width="4"/>',
  cat: '<rect width="320" height="200" fill="#fef3c7"/><ellipse cx="160" cy="140" rx="70" ry="50" fill="#f97316"/><circle cx="160" cy="88" r="42" fill="#f97316"/><path d="M126 62l-6-34 28 22zM194 62l6-34-28 22z" fill="#f97316"/><circle cx="145" cy="85" r="6" fill="#1f2937"/><circle cx="175" cy="85" r="6" fill="#1f2937"/><path d="M160 98l-6 6h12z" fill="#be185d"/><path d="M130 100h-30M130 106h-28M190 100h30M190 106h28" stroke="#1f2937" stroke-width="2"/><path d="M226 150q40-10 30-50" stroke="#f97316" stroke-width="14" fill="none" stroke-linecap="round"/>',
  flower: '<rect width="320" height="200" fill="#fce7f3"/><path d="M160 200V110" stroke="#16a34a" stroke-width="8"/><path d="M160 160q-30-20-40 0q20 15 40 0" fill="#22c55e"/>' + [0, 72, 144, 216, 288].map(a => `<ellipse cx="160" cy="70" rx="18" ry="34" fill="#ec4899" transform="rotate(${a} 160 100)"/>`).join('') + '<circle cx="160" cy="100" r="18" fill="#fde047"/>',
  class: '<rect width="320" height="200" fill="#dbeafe"/><rect x="40" y="24" width="240" height="70" rx="4" fill="#166534"/><path d="M60 50h80M60 66h120" stroke="#fff" stroke-width="3"/>' + [60, 110, 160, 210, 260].map((x, i) => `<circle cx="${x}" cy="130" r="16" fill="${['#fbbf24', '#f97316', '#a16207', '#fde68a', '#78350f'][i]}"/><rect x="${x - 20}" y="148" width="40" height="52" rx="14" fill="${['#2563eb', '#db2777', '#16a34a', '#7c3aed', '#ea580c'][i]}"/>`).join(''),
  map: '<rect width="320" height="200" fill="#fef3c7"/><path d="M40 60q40-30 90-10t80 20 70-10v110q-40 20-80 0t-80-10-80 10z" fill="#bbf7d0" stroke="#15803d" stroke-width="3"/><path d="M90 90l40 30 50-20 40 30" stroke="#dc2626" stroke-width="3" stroke-dasharray="8 6" fill="none"/><path d="M214 124l12 12M226 124l-12 12" stroke="#dc2626" stroke-width="4"/>',
  diploma: '<rect width="320" height="200" fill="#e2e8f0"/><rect x="50" y="20" width="220" height="160" rx="6" fill="#fffbeb" stroke="#d97706" stroke-width="6"/><path d="M100 60h120M90 90h140M110 112h100" stroke="#92400e" stroke-width="5"/><circle cx="160" cy="146" r="16" fill="#dc2626"/><path d="M150 160l-6 18 16-8 16 8-6-18" fill="#dc2626"/>',
};
const artSvg = (art, cls = '') => `<svg class="${cls}" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${ART[art] || ''}</svg>`;
function fileIcon(n) {
  if (n.type === 'folder') {
    const sp = SPECIAL[n.name] && findById(S.fs, n.id)?.path.length === 1 ? SPECIAL[n.name] : null;
    return `<svg class="fi" viewBox="0 0 48 48" aria-hidden="true"><path d="M4 12a3 3 0 0 1 3-3h11l4 4h19a3 3 0 0 1 3 3v4H4z" fill="#e9a62a"/><rect x="4" y="15" width="40" height="27" rx="3" fill="#f8c654"/>${sp ? `<g transform="translate(17 21) scale(.58)" fill="none" stroke="#a16207" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${P[sp]}</g>` : ''}</svg>`;
  }
  const k = kindOf(n), c = KIND_COLOR[k], e = ext(n.name).toUpperCase().slice(0, 4);
  if (k === 'image' && n.art) return `<span class="fi fi-img">${artSvg(n.art)}<i style="background:${c}">${e}</i></span>`;
  return `<svg class="fi" viewBox="0 0 48 48" aria-hidden="true"><path d="M11 3h19l10 10v30a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="var(--page)" stroke="var(--page-line)" stroke-width="1.5"/><path d="M30 3v8a2 2 0 0 0 2 2h8" fill="var(--page-fold)" stroke="var(--page-line)" stroke-width="1.5"/>${(GLYPH[k] || '').replaceAll('C', c)}${e ? `<rect x="6" y="29" width="${Math.max(18, e.length * 6 + 6)}" height="11" rx="2.5" fill="${c}"/><text x="${6 + Math.max(18, e.length * 6 + 6) / 2}" y="37.4" font-size="7.6" font-weight="800" fill="#fff" text-anchor="middle" font-family="Inter, sans-serif">${e}</text>` : ''}</svg>`;
}

/* ═════════ Тема ═════════ */
const syncTheme = () => { $('themeBtn').innerHTML = icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon'); };
$('themeBtn').onclick = () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('edvault-theme', next); } catch (e) { /* приватний режим */ }
  syncTheme();
};
syncTheme();

/* ═════════ Прогрес ═════════ */
const KEY = 'edvault-files';
let progress = (() => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } })();
if (!progress || typeof progress !== 'object') progress = {};
progress = { name: progress.name || '', best: progress.best || {} };
const saveProgress = () => { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* немає місця */ } };
const best = id => progress.best[id];
const unlocked = i => i === 0 || (best(LEVELS[i - 1].id)?.stars || 0) >= 1;
const passed = () => LEVELS.filter(l => best(l.id)?.stars).length;
const totalStars = () => LEVELS.reduce((s, l) => s + (best(l.id)?.stars || 0), 0);
// «найкраще» — кроки еталонного розв'язку
const OPT = Object.fromEntries(LEVELS.map(l => { const s = createSession(l); l.solution(s); return [l.id, s.steps]; }));
const starsFor = (steps, opt) => steps <= opt ? 3 : steps <= opt + 2 ? 2 : 1;
const bestCount = () => LEVELS.filter(l => best(l.id) && best(l.id).steps <= OPT[l.id]).length;

/* ═════════ Стан провідника ═════════ */
let level = null, cur = -1, S = null, finished = false;
let cwd = 'root', hist = [], fwd = [], sel = new Set(), anchor = null, view = 'icons', sort = { key: 'name', dir: 1 };
let query = '', clip = null, editing = null, expanded = new Set(), undoStack = [];
const BIN = 'bin';
const isReal = id => id !== BIN && id !== 'root';
const inSearch = () => !!query.trim();

function snapshot() { undoStack.push(JSON.stringify(S.fs)); if (undoStack.length > 60) undoStack.shift(); }
function undo() {
  if (!undoStack.length) { toast('Немає що скасовувати'); return; }
  const fs = JSON.parse(undoStack.pop());
  S.fs.root = fs.root; S.fs.bin = fs.bin;
  if (cwd !== BIN && !findById(S.fs, cwd)) cwd = 'root';
  sel.clear(); editing = null; clip = null;
  render(); toast('Скасовано');
}

function items() {
  let list;
  if (inSearch()) list = search(S.fs, cwd === BIN ? 'root' : cwd, query).map(n => ({ n, where: findById(S.fs, n.id).path.slice(0, -1).map(x => x.name).join(' › ') || 'Цей комп’ютер' }));
  else if (cwd === BIN) list = S.fs.bin.map(b => ({ n: b.node, where: pathOf(S.fs, b.from) || 'Цей комп’ютер' }));
  else list = (node(S.fs, cwd)?.children || []).map(n => ({ n }));
  if (cwd === 'root' && !inSearch()) return list;
  const k = sort.key, d = sort.dir;
  const val = x => k === 'size' ? (x.n.type === 'folder' ? -1 : x.n.size) : k === 'type' ? typeName(x.n) : x.n.name.toLowerCase();
  return list.sort((a, b) => (a.n.type === b.n.type ? 0 : a.n.type === 'folder' ? -1 : 1) || (val(a) > val(b) ? d : val(a) < val(b) ? -d : 0) || a.n.name.localeCompare(b.n.name, 'uk'));
}

/* ═════════ Малювання ═════════ */
function render() {
  renderTree(); renderAddr(); renderMain(); renderCmds(); renderTask();
}
function treeNode(n, depth) {
  const kids = (n.children || []).filter(c => c.type === 'folder');
  const open = expanded.has(n.id);
  const ic = depth === 0 && SPECIAL[n.name] ? icon(SPECIAL[n.name]) : icon('folder');
  return `<div class="tn${cwd === n.id && !inSearch() ? ' on' : ''}" data-go="${n.id}" data-drop="${n.id}" style="--d:${depth}">
      <button class="tn-tog${kids.length ? '' : ' none'}" data-tog="${n.id}">${kids.length ? icon('chev', open ? 'open' : '') : ''}</button>${ic}<span>${esc(n.name)}</span></div>
    ${open ? kids.map(k => treeNode(k, depth + 1)).join('') : ''}`;
}
function renderTree() {
  $('tree').innerHTML = `<div class="tn top${cwd === 'root' && !inSearch() ? ' on' : ''}" data-go="root">${icon('hdd')}<span>Цей комп’ютер</span></div>`
    + S.fs.root.children.map(n => treeNode(n, 0)).join('')
    + `<div class="tn top bin${cwd === BIN ? ' on' : ''}" data-go="${BIN}">${icon('trash')}<span>Кошик</span>${S.fs.bin.length ? `<i class="cnt">${S.fs.bin.length}</i>` : ''}</div>`;
}
function renderAddr() {
  let parts;
  if (cwd === BIN) parts = [{ id: BIN, name: 'Кошик' }];
  else parts = [{ id: 'root', name: 'Цей комп’ютер' }, ...(findById(S.fs, cwd)?.path || []).map(n => ({ id: n.id, name: n.name }))];
  $('addr').innerHTML = (cwd === BIN ? icon('trash') : icon('hdd')) + parts.map((p, i) => `${i ? icon('chev', 'sep') : ''}<button class="crumb" data-go="${p.id}" ${isReal(p.id) ? `data-drop="${p.id}"` : ''}>${esc(p.name)}</button>`).join('')
    + (inSearch() ? `${icon('chev', 'sep')}<span class="crumb q">Результати пошуку «${esc(query)}»</span>` : '');
  $('search').placeholder = `Пошук у «${cwd === BIN ? 'Цей комп’ютер' : cwd === 'root' ? 'Цей комп’ютер' : node(S.fs, cwd).name}»`;
  $('navBack').disabled = !hist.length; $('navFwd').disabled = !fwd.length; $('navUp').disabled = cwd === 'root';
}
function nameHtml(n) {
  if (editing?.id === n.id) return `<input class="ren" id="ren" value="${esc(n.name)}" spellcheck="false">`;
  return `<span class="nm">${esc(n.name)}</span>`;
}
function renderMain() {
  const list = items();
  const showWhere = inSearch() || cwd === BIN;
  const m = $('main');
  m.className = 'ex-main v-' + (cwd === 'root' && !inSearch() ? 'drives' : view);
  const cls = n => `it${sel.has(n.id) ? ' sel' : ''}${clip?.mode === 'cut' && clip.ids.includes(n.id) ? ' cut' : ''}`;
  const drop = n => n.type === 'folder' && cwd !== BIN ? ` data-drop="${n.id}"` : '';
  let html;
  if (!list.length) html = `<div class="empty">${icon(inSearch() ? 'search' : cwd === BIN ? 'trash' : 'folder')}<span>${inSearch() ? 'Нічого не знайдено' : cwd === BIN ? 'Кошик порожній' : 'Ця папка порожня'}</span></div>`;
  else if (view === 'details' && !(cwd === 'root' && !inSearch())) {
    const th = (k, t) => `<button class="th${sort.key === k ? ' on' : ''}" data-sort="${k}">${t}${sort.key === k ? icon('up', sort.dir < 0 ? 'desc' : '') : ''}</button>`;
    html = `<div class="thead${showWhere ? ' where' : ''}">${th('name', 'Назва')}${th('type', 'Тип')}${th('size', 'Розмір')}${showWhere ? `<span class="th">${cwd === BIN ? 'Звідки' : 'Де лежить'}</span>` : ''}</div>`
      + list.map(({ n, where }) => `<div class="${cls(n)} row${showWhere ? ' where' : ''}" data-id="${n.id}"${drop(n)} draggable="${cwd !== BIN}">${fileIcon(n)}${nameHtml(n)}<span class="c">${typeName(n)}</span><span class="c num">${n.type === 'file' ? fmtSize(n.size) : ''}</span>${showWhere ? `<span class="c">${esc(where)}</span>` : ''}</div>`).join('');
  } else {
    html = list.map(({ n, where }) => `<div class="${cls(n)} tile" data-id="${n.id}"${drop(n)} draggable="${cwd !== BIN && !(cwd === 'root' && !inSearch())}" title="${esc(n.name)}${where ? '\n' + esc(where) : ''}">${fileIcon(n)}${nameHtml(n)}${where && showWhere ? `<span class="where">${esc(where)}</span>` : ''}</div>`).join('');
  }
  m.innerHTML = `<div class="list">${html}</div>`;
  const ren = $('ren');
  if (ren) {
    ren.focus();
    const n = node(S.fs, editing.id) || S.fs.bin.find(b => b.node.id === editing.id)?.node;
    ren.setSelectionRange(0, n?.type === 'file' && n.name.includes('.') ? base(n.name).length : ren.value.length);
  }
  const total = list.length, s = sel.size;
  $('status').textContent = `${total} ${plural(total, 'елемент', 'елементи', 'елементів')}${s ? ` · вибрано ${s}` : ''}${clip ? ` · у буфері ${clip.ids.length} (${clip.mode === 'cut' ? 'вирізано' : 'скопійовано'})` : ''}`;
}
const plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c;
function renderCmds() {
  const real = isReal(cwd) && !inSearch(), any = sel.size > 0, inBin = cwd === BIN;
  const en = { newFolder: real, cut: any && !inBin, copy: any && !inBin, paste: real && !!clip, rename: sel.size === 1 && !inBin, del: any && !inBin && !(cwd === 'root' && !inSearch()), restore: inBin && any, emptyBin: inBin && S.fs.bin.length > 0 };
  // у кошику — лише «Відновити» й «Очистити кошик»
  document.querySelectorAll('[data-cmd]').forEach(b => { b.disabled = !en[b.dataset.cmd]; b.hidden = (b.dataset.cmd === 'restore' || b.dataset.cmd === 'emptyBin') !== inBin; });
  document.querySelectorAll('#cmds .cmd-sep').forEach(x => { x.hidden = inBin; });
  document.querySelectorAll('#viewSeg button').forEach(b => b.classList.toggle('on', b.dataset.view === view));
}
function renderTask() {
  $('goals').innerHTML = S.goals().map(g => `<li class="${g.done ? 'done' : ''}">${icon(g.done ? 'check' : 'circle')}<span>${esc(g.text)}</span></li>`).join('');
  $('steps').textContent = S.steps;
  $('par').textContent = OPT[level.id];
  $('steps').classList.toggle('over', S.steps > OPT[level.id]);
  $('undoBtn').disabled = !undoStack.length;
}

/* ═════════ Дії ═════════ */
function go(id, push = true) {
  if (id !== BIN && id !== 'root' && !node(S.fs, id)) return;
  if (push && id !== cwd) { hist.push(cwd); fwd = []; }
  cwd = id; sel.clear(); anchor = null; editing = null;
  query = ''; $('search').value = ''; $('searchClear').hidden = true;
  if (isReal(id)) findById(S.fs, id).path.slice(0, -1).forEach(n => expanded.add(n.id));
  render();
}
function after(r, okMsg) {
  if (r.error) { toast(r.error); undoStack.pop(); render(); return false; }
  if (r.same) { undoStack.pop(); render(); return false; }
  if (okMsg) toast(okMsg);
  render(); check();
  return true;
}
function openItem(id) {
  const n = node(S.fs, id);
  if (!n) { if (cwd === BIN) toast('Файли в кошику не відкриваються — спершу відновіть'); return; }
  if (n.type === 'folder') { go(id); return; }
  S.open(pathOf(S.fs, id));
  showViewer(n);
  renderTask(); check();
}
function newFolder() {
  if (!isReal(cwd) || inSearch()) { toast(cwd === 'root' ? 'Тут можна лише відкривати папки. Відкрийте, наприклад, «Документи»' : 'Тут не можна створити папку'); return; }
  snapshot();
  const r = S.act(mkdir(S.fs, cwd));
  if (r.error) { toast(r.error); undoStack.pop(); return; }
  sel = new Set([r.node.id]); editing = { id: r.node.id, fresh: true };
  render(); check();
}
function startRename() {
  if (sel.size !== 1 || cwd === BIN) return;
  const id = [...sel][0], f = findById(S.fs, id);
  if (!f || f.path.length === 1) { toast('Системні папки не можна перейменувати'); return; }
  editing = { id }; renderMain();
}
async function commitRename(value) {
  if (!editing) return;
  const ed = editing, n = node(S.fs, ed.id);
  if (!n) { editing = null; renderMain(); return; }
  value = value.trim();
  if (value === n.name) { editing = null; render(); return; }
  const err = validName(value);
  if (err) { toast(err); $('ren')?.focus(); return; }
  if (n.type === 'file' && ext(value) !== ext(n.name)) {
    editing = null; // щоб blur не спрацьовував удруге
    const ok = await ask('Змінити розширення?', `Розширення «.${ext(n.name) || '—'}» підказує комп’ютеру, яка програма відкриває файл. Якщо його змінити, файл може перестати відкриватися.`, 'Змінити');
    if (!ok) { editing = ed; renderMain(); return; }
  }
  if (!ed.fresh) snapshot();
  const r = rename(S.fs, ed.id, value);
  if (r.error) { if (!ed.fresh) undoStack.pop(); toast(r.error); editing = ed; renderMain(); return; }
  if (!ed.fresh) S.steps++; // нова папка з одразу набраним ім’ям — це один крок
  editing = null; render(); check();
}
function del() {
  if (!sel.size || cwd === BIN) return;
  if (cwd === 'root' && !inSearch()) { toast('Системні папки не можна видаляти'); return; }
  snapshot();
  const n = sel.size;
  if (after(S.act(remove(S.fs, [...sel])), n > 1 ? `${n} ${plural(n, 'об’єкт', 'об’єкти', 'об’єктів')} переміщено в кошик` : 'Переміщено в кошик')) sel.clear();
  render();
}
function doRestore() {
  if (cwd !== BIN || !sel.size) return;
  snapshot();
  if (after(S.act(restore(S.fs, [...sel])), 'Відновлено на попереднє місце')) sel.clear();
  render();
}
async function doEmptyBin() {
  if (!S.fs.bin.length) return;
  if (!await ask('Очистити кошик?', `Усі ${S.fs.bin.length} об’єкти буде видалено назавжди. Відновити їх уже не вийде.`, 'Видалити назавжди')) return;
  snapshot(); sel.clear();
  after(S.act(emptyBin(S.fs)), 'Кошик очищено');
}
function setClip(mode) {
  if (!sel.size || cwd === BIN) return;
  clip = { mode, ids: [...sel] };
  toast(mode === 'cut' ? 'Вирізано. Відкрийте потрібну папку й натисніть «Вставити» (Ctrl+V)' : 'Скопійовано. Відкрийте потрібну папку й натисніть «Вставити» (Ctrl+V)');
  render();
}
function paste() {
  if (!clip) return;
  if (!isReal(cwd) || inSearch()) { toast('Вставити можна лише у відкриту папку'); return; }
  const ids = clip.ids.filter(id => node(S.fs, id));
  if (!ids.length) { clip = null; render(); return; }
  snapshot();
  const r = S.act(clip.mode === 'cut' ? move(S.fs, ids, cwd) : copy(S.fs, ids, cwd));
  if (r.same) { undoStack.pop(); toast('Файл уже в цій папці'); return; }
  if (!r.error) { sel = new Set(clip.mode === 'cut' ? ids : r.nodes.map(n => n.id)); if (clip.mode === 'cut') clip = null; }
  after(r);
}
function dropOn(ids, destId, asCopy) {
  if (!ids.length || destId === BIN || destId === 'root') return;
  if (!asCopy && ids.includes(destId)) return;
  snapshot();
  const dest = node(S.fs, destId);
  const r = S.act(asCopy ? copy(S.fs, ids, destId) : move(S.fs, ids, destId));
  if (!r.error && !r.same) sel.clear();
  after(r, r.error || r.same ? '' : `${asCopy ? 'Скопійовано' : 'Переміщено'} в «${dest.name}»`);
}
function check() {
  if (finished || !S.done()) return;
  finished = true;
  setTimeout(complete, 650);
}

/* ═════════ Перегляд файлу ═════════ */
function showViewer(n) {
  const k = kindOf(n);
  $('viewerIco').innerHTML = fileIcon(n);
  $('viewerName').textContent = n.name;
  let body;
  if (k === 'image') body = n.art ? artSvg(n.art, 'v-art') : `<div class="v-empty">${fileIcon(n)}</div>`;
  else if (k === 'audio') body = `<div class="v-media"><span class="v-play">${icon('play')}</span><div class="v-wave">${Array.from({ length: 36 }, (_, i) => `<i style="height:${18 + Math.abs(Math.sin(i * 1.7 + n.size)) * 60}%"></i>`).join('')}</div><span class="v-time">0:00 / ${Math.max(1, Math.round(n.size / 1000))}:${String(n.size % 60).padStart(2, '0')}</span></div>`;
  else if (k === 'video') body = `<div class="v-video">${icon('play')}<span>${esc(base(n.name))}</span></div>`;
  else if (['doc', 'pdf', 'text', 'tmp', 'sheet', 'slides'].includes(k)) body = `<div class="v-page"><b>${esc(base(n.name))}</b>${Array.from({ length: 7 }, (_, i) => `<i style="width:${60 + (i * 37 + n.size) % 40}%"></i>`).join('')}</div>`;
  else body = `<div class="v-empty">${fileIcon(n)}<span>Цей файл відкривається спеціальною програмою (${esc(typeName(n))}).</span></div>`;
  $('viewerBody').innerHTML = body + `<p class="v-meta">${esc(typeName(n))} · ${fmtSize(n.size)}</p>`;
  $('viewer').hidden = false;
}
$('viewer').addEventListener('click', e => { if (e.target.id === 'viewer' || e.target.closest('[data-close]')) closeViewer(); });
function closeViewer() { $('viewer').hidden = true; $('main').focus(); }

/* ═════════ Підтвердження ═════════ */
let askResolve = null;
function ask(title, text, yes) {
  $('confirmTitle').textContent = title; $('confirmText').textContent = text; $('confirmYes').textContent = yes;
  $('confirm').hidden = false;
  setTimeout(() => $('confirmNo').focus(), 30);
  return new Promise(r => { askResolve = r; });
}
const answer = v => { $('confirm').hidden = true; askResolve?.(v); askResolve = null; };
$('confirmYes').onclick = () => answer(true);
$('confirmNo').onclick = () => answer(false);
$('confirm').addEventListener('click', e => { if (e.target.id === 'confirm') answer(false); });

/* ═════════ Миша: виділення, рамка, подвійне клацання ═════════ */
const visibleIds = () => [...$('main').querySelectorAll('.it')].map(e => e.dataset.id);
$('main').addEventListener('mousedown', e => {
  hideCtx();
  if (e.button === 2 && e.target.closest('.it')) { const id = e.target.closest('.it').dataset.id; if (!sel.has(id)) { sel = new Set([id]); anchor = id; renderMain(); renderCmds(); } return; }
  if (e.button !== 0 || e.target.closest('.ren, .th')) return;
  const it = e.target.closest('.it');
  if (editing && !e.target.closest('.ren')) { $('ren')?.blur(); }
  if (it) {
    const id = it.dataset.id;
    if (e.ctrlKey || e.metaKey) { sel.has(id) ? sel.delete(id) : sel.add(id); anchor = id; }
    else if (e.shiftKey && anchor) { const v = visibleIds(), a = v.indexOf(anchor), b = v.indexOf(id); sel = new Set(v.slice(Math.min(a, b), Math.max(a, b) + 1)); }
    else if (!sel.has(id)) { sel = new Set([id]); anchor = id; }
    else it._pending = true; // клацання по вже виділеному — лишити групу для перетягування
    renderSel();
    return;
  }
  // рамка
  if (!e.ctrlKey) sel.clear();
  renderSel();
  const box = $('main').getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY, base0 = new Set(sel);
  const band = document.createElement('div'); band.className = 'band'; $('main').appendChild(band);
  const mv = ev => {
    const x1 = Math.max(box.left, Math.min(box.right, ev.clientX)), y1 = Math.max(box.top, Math.min(box.bottom, ev.clientY));
    const r = { l: Math.min(x0, x1), t: Math.min(y0, y1), r: Math.max(x0, x1), b: Math.max(y0, y1) };
    Object.assign(band.style, { left: r.l - box.left + $('main').scrollLeft + 'px', top: r.t - box.top + $('main').scrollTop + 'px', width: r.r - r.l + 'px', height: r.b - r.t + 'px' });
    sel = new Set(base0);
    $('main').querySelectorAll('.it').forEach(el => { const q = el.getBoundingClientRect(); if (q.left < r.r && q.right > r.l && q.top < r.b && q.bottom > r.t) sel.add(el.dataset.id); });
    renderSel();
  };
  const upf = () => { band.remove(); document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', upf); renderCmds(); renderStatusOnly(); };
  document.addEventListener('mousemove', mv); document.addEventListener('mouseup', upf);
});
$('main').addEventListener('click', e => {
  const it = e.target.closest('.it');
  if (it?._pending && !e.ctrlKey && !e.shiftKey) { sel = new Set([it.dataset.id]); anchor = it.dataset.id; renderSel(); }
  if (it) it._pending = false;
  const th = e.target.closest('[data-sort]');
  if (th) { sort = { key: th.dataset.sort, dir: sort.key === th.dataset.sort ? -sort.dir : (th.dataset.sort === 'size' ? -1 : 1) }; renderMain(); }
});
$('main').addEventListener('dblclick', e => { const it = e.target.closest('.it'); if (it && !e.target.closest('.ren')) openItem(it.dataset.id); });
function renderSel() {
  $('main').querySelectorAll('.it').forEach(el => el.classList.toggle('sel', sel.has(el.dataset.id)));
  renderCmds(); renderStatusOnly();
}
function renderStatusOnly() { const t = $('main').querySelectorAll('.it').length; $('status').textContent = `${t} ${plural(t, 'елемент', 'елементи', 'елементів')}${sel.size ? ` · вибрано ${sel.size}` : ''}${clip ? ` · у буфері ${clip.ids.length} (${clip.mode === 'cut' ? 'вирізано' : 'скопійовано'})` : ''}`; }

// перейменування в полі
$('main').addEventListener('keydown', e => {
  if (e.target.id !== 'ren') return;
  e.stopPropagation();
  if (e.key === 'Enter') { e.preventDefault(); commitRename(e.target.value); }
  else if (e.key === 'Escape') { e.preventDefault(); editing = null; render(); }
});
$('main').addEventListener('focusout', e => { if (e.target.id === 'ren' && editing && $('confirm').hidden) commitRename(e.target.value); });

/* ── дерево, адреса, кнопки ── */
$('tree').addEventListener('click', e => {
  const t = e.target.closest('[data-tog]');
  if (t) { const id = t.dataset.tog; expanded.has(id) ? expanded.delete(id) : expanded.add(id); renderTree(); return; }
  const g = e.target.closest('[data-go]'); if (g) { go(g.dataset.go); $('main').focus(); }
});
$('addr').addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) go(g.dataset.go); });
$('navBack').onclick = () => { if (!hist.length) return; fwd.push(cwd); go(hist.pop(), false); };
$('navFwd').onclick = () => { if (!fwd.length) return; hist.push(cwd); go(fwd.pop(), false); };
const goUp = () => { if (cwd === 'root') return; if (cwd === BIN) { go('root'); return; } const f = findById(S.fs, cwd); go(f.path.length > 1 ? f.path[f.path.length - 2].id : 'root'); };
$('navUp').onclick = goUp;
const CMDS = { newFolder, cut: () => setClip('cut'), copy: () => setClip('copy'), paste, rename: startRename, del, restore: doRestore, emptyBin: doEmptyBin };
$('cmds').addEventListener('click', e => { const b = e.target.closest('[data-cmd]'); if (b && !b.disabled) CMDS[b.dataset.cmd](); const v = e.target.closest('[data-view]'); if (v) { view = v.dataset.view; render(); } });
$('search').addEventListener('input', e => {
  query = e.target.value; sel.clear(); editing = null;
  $('searchClear').hidden = !query;
  if (cwd === BIN && query) cwd = 'root';
  render();
});
$('search').addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); clearSearch(); } else if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); $('main').focus(); } });
const clearSearch = () => { query = ''; $('search').value = ''; $('searchClear').hidden = true; sel.clear(); render(); $('main').focus(); };
$('searchClear').onclick = clearSearch;
$('undoBtn').onclick = () => undo();
$('resetBtn').onclick = () => openLevel(cur);

/* ── перетягування ── */
let dragIds = null;
document.addEventListener('dragstart', e => {
  const it = e.target.closest?.('.it');
  if (!it || !level) return;
  if (cwd === BIN) { e.preventDefault(); return; }
  if (!sel.has(it.dataset.id)) { sel = new Set([it.dataset.id]); renderSel(); }
  dragIds = [...sel];
  e.dataTransfer.effectAllowed = 'copyMove';
  e.dataTransfer.setData('text/plain', 'files');
  const n = dragIds.length;
  const g = document.createElement('div'); g.className = 'drag-ghost'; g.textContent = n > 1 ? `${n} ${plural(n, 'об’єкт', 'об’єкти', 'об’єктів')}` : node(S.fs, dragIds[0])?.name || '';
  document.body.appendChild(g); e.dataTransfer.setDragImage(g, 12, 12); setTimeout(() => g.remove(), 0);
});
document.addEventListener('dragend', () => { dragIds = null; document.querySelectorAll('.drop-on').forEach(x => x.classList.remove('drop-on')); });
document.addEventListener('dragover', e => {
  const t = e.target.closest?.('[data-drop]');
  document.querySelectorAll('.drop-on').forEach(x => { if (x !== t) x.classList.remove('drop-on'); });
  if (!dragIds) return;
  // порожнє місце відкритої папки теж приймає
  const target = t || (e.target.closest?.('#main') && isReal(cwd) && !inSearch() ? $('main') : null);
  if (!target || (t && dragIds.includes(t.dataset.drop))) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
  target.classList.add('drop-on');
});
document.addEventListener('drop', e => {
  if (!dragIds) return;
  e.preventDefault();
  const t = e.target.closest?.('[data-drop]');
  const dest = t ? t.dataset.drop : (e.target.closest?.('#main') && isReal(cwd) ? cwd : null);
  const ids = dragIds; dragIds = null;
  document.querySelectorAll('.drop-on').forEach(x => x.classList.remove('drop-on'));
  if (dest) dropOn(ids, dest, e.ctrlKey);
});

/* ── контекстне меню ── */
function hideCtx() { $('ctx').hidden = true; }
$('main').addEventListener('contextmenu', e => {
  e.preventDefault();
  const it = e.target.closest('.it');
  const inBin = cwd === BIN, rootView = cwd === 'root' && !inSearch();
  const row = (cmd, ic, label, on = true, key = '') => `<button class="ctx-item" data-c="${cmd}" ${on ? '' : 'disabled'}>${icon(ic)}<span>${label}</span><kbd>${key}</kbd></button>`;
  let html;
  if (it && inBin) html = row('restore', 'undo', 'Відновити') + '<div class="ctx-sep"></div>' + row('emptyBin', 'trashX', 'Очистити кошик');
  else if (it) {
    const n = node(S.fs, it.dataset.id);
    html = row('open', n?.type === 'folder' ? 'folder' : 'play', 'Відкрити', true, 'Enter') + '<div class="ctx-sep"></div>'
      + row('cut', 'scissors', 'Вирізати', !rootView, 'Ctrl+X') + row('copy', 'copy', 'Копіювати', !rootView, 'Ctrl+C')
      + (n?.type === 'folder' && clip ? row('pasteInto', 'paste', 'Вставити в цю папку') : '')
      + '<div class="ctx-sep"></div>' + row('rename', 'pen', 'Перейменувати', !rootView && sel.size === 1, 'F2') + row('del', 'trash', 'Видалити', !rootView, 'Del');
  } else if (inBin) html = row('emptyBin', 'trashX', 'Очистити кошик', S.fs.bin.length > 0);
  else html = row('newFolder', 'folderPlus', 'Нова папка', isReal(cwd) && !inSearch(), 'Ctrl+Shift+N') + row('paste', 'paste', 'Вставити', !!clip && isReal(cwd) && !inSearch(), 'Ctrl+V')
    + '<div class="ctx-sep"></div>' + row('view', view === 'icons' ? 'list' : 'grid', view === 'icons' ? 'Вигляд: таблиця' : 'Вигляд: значки');
  const c = $('ctx'); c.innerHTML = html; c.hidden = false;
  c.dataset.target = it?.dataset.id || '';
  c.style.left = Math.min(e.clientX, innerWidth - c.offsetWidth - 8) + 'px';
  c.style.top = Math.min(e.clientY, innerHeight - c.offsetHeight - 8) + 'px';
});
$('ctx').addEventListener('click', e => {
  const b = e.target.closest('[data-c]'); if (!b || b.disabled) return;
  const c = b.dataset.c, target = $('ctx').dataset.target;
  hideCtx();
  if (c === 'open') openItem(target);
  else if (c === 'view') { view = view === 'icons' ? 'details' : 'icons'; render(); }
  else if (c === 'pasteInto') { const ids = clip.ids; const mode = clip.mode; if (mode === 'cut') clip = null; dropOn(ids, target, mode === 'copy'); }
  else CMDS[c]?.();
});
document.addEventListener('mousedown', e => { if (!e.target.closest('#ctx')) hideCtx(); });
$('tree').addEventListener('contextmenu', e => e.preventDefault());

/* ═════════ Результат ═════════ */
function complete() {
  const steps = S.steps, opt = OPT[level.id], stars = starsFor(steps, opt);
  const prev = best(level.id);
  if (!prev || stars > prev.stars || (stars === prev.stars && steps < prev.steps)) { progress.best[level.id] = { stars, steps, at: Date.now() }; saveProgress(); }
  $('resStars').innerHTML = [0, 1, 2].map(i => icon('star', i < stars ? 'on' : '')).join('');
  $('resTitle').textContent = stars === 3 ? 'Бездоганно!' : stars === 2 ? 'Добре!' : 'Завдання виконано!';
  $('resMsg').textContent = stars === 3 ? `Усе зроблено за ${steps} ${plural(steps, 'крок', 'кроки', 'кроків')} — як у справжнього майстра.`
    : `Кроків: ${steps}, а можна за ${opt}. ${level.chapter === 'nav' ? 'Не відкривайте зайвих файлів.' : 'Спробуйте виділяти кілька файлів одразу.'}`;
  const nx = cur + 1 < LEVELS.length;
  $('resNext').disabled = !nx || !unlocked(cur + 1);
  $('resNext').innerHTML = nx ? 'Далі' + icon('arrow') : 'Усі рівні пройдено';
  $('viewer').hidden = true;
  $('result').hidden = false;
  setTimeout(() => $('resNext').focus(), 50);
}
$('resRetry').onclick = () => openLevel(cur);
$('resNext').onclick = () => openLevel(cur + 1);
$('resLevels').onclick = () => showHome();

/* ═════════ Рівні ═════════ */
function openLevel(i) {
  if (!LEVELS[i] || !unlocked(i)) { showHome(); return; }
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  cur = i; level = LEVELS[i];
  S = createSession(level); finished = false;
  cwd = 'root'; hist = []; fwd = []; sel = new Set(); anchor = null; query = ''; clip = null; editing = null; expanded = new Set(); undoStack = [];
  $('search').value = ''; $('searchClear').hidden = true;
  $('home').hidden = true; $('play').hidden = false; $('result').hidden = true; $('viewer').hidden = true;
  $('lvlChapter').textContent = CHAPTERS.find(c => c.id === level.chapter).name;
  $('lvlName').textContent = `${i + 1}. ${level.name}`;
  $('hint').textContent = level.hint;
  $('navNum').textContent = `${i + 1} / ${LEVELS.length}`;
  $('prevBtn').disabled = i === 0;
  $('nextBtn').disabled = !(i + 1 < LEVELS.length && unlocked(i + 1));
  render();
  $('main').focus();
  if (location.hash !== '#' + level.id) window.history.replaceState(null, '', '#' + level.id);
}
function showHome() {
  cur = -1; level = null;
  $('play').hidden = true; $('result').hidden = true; $('home').hidden = false;
  window.history.replaceState(null, '', location.pathname);
  renderHome();
}
// мініатюра: перші файли з головної папки рівня
function thumb(l) {
  const [folder, content] = Object.entries(l.spec).find(([, v]) => Object.keys(v).length) || ['Кошик', {}];
  const entries = Object.entries(content).slice(0, 4);
  const fake = (name, v) => typeof v === 'number' || (v && 'size' in v) ? { id: 'x', name, type: 'file', size: v.size ?? v, art: v.art } : { id: 'x', name, type: 'folder', children: [] };
  const prevS = S; S = S || { fs: { root: { children: [] } } };
  const tiles = entries.map(([n, v]) => `<span>${fileIcon(fake(n, v))}</span>`).join('');
  S = prevS;
  return `<div class="th-box"><div class="th-bar">${icon(l.bin && !entries.length ? 'trash' : SPECIAL[folder] || 'folder')}<b>${esc(folder)}</b></div><div class="th-grid">${tiles}</div></div>`;
}
function nextToPlay() {
  let i = LEVELS.findIndex((l, k) => unlocked(k) && !best(l.id)?.stars);
  if (i < 0) i = LEVELS.findIndex(l => (best(l.id)?.stars || 0) < 3);
  return i;
}
function renderHome() {
  $('chapters').innerHTML = CHAPTERS.map((ch, ci) => {
    const items = LEVELS.map((l, i) => ({ l, i })).filter(x => x.l.chapter === ch.id);
    const got = items.reduce((s, { l }) => s + (best(l.id)?.stars || 0), 0);
    return `<section class="chapter"><div class="chapter-head"><span class="ch-num">${ci + 1}</span><div class="ch-text"><h2>${ch.name}</h2><span>${ch.desc}</span></div><span class="ch-stars">${icon('star')}${got} / ${items.length * 3}</span></div><div class="levels">${items.map(({ l, i }) => {
      const b = best(l.id), open = unlocked(i);
      return `<button class="lvl${b?.stars === 3 ? ' perfect' : ''}${open && !b ? ' fresh' : ''}" data-level="${i}" ${open ? '' : 'disabled title="Спершу пройдіть попередній рівень"'}>
        <div class="lvl-thumb">${open ? thumb(l) : `<span class="lvl-lock">${icon('lock')}</span>`}</div>
        <span class="lvl-num">${i + 1}</span>
        <div class="lvl-name">${esc(l.name)}</div>
        <div class="lvl-meta">${starsHtml(b?.stars || 0)}<span class="lvl-acc">${b ? `${b.steps} ${plural(b.steps, 'крок', 'кроки', 'кроків')}` : ''}</span></div>
      </button>`;
    }).join('')}</div></section>`;
  }).join('');
  const st = totalStars(), max = LEVELS.length * 3, pct = Math.round(passed() / LEVELS.length * 100);
  $('total').innerHTML = icon('star') + st + ' / ' + max;
  $('heroStars').textContent = st; $('heroMax').textContent = max;
  $('heroBest').textContent = bestCount();
  $('ringPct').textContent = pct + '%';
  $('ringFg').style.strokeDashoffset = String(326.7 * (1 - pct / 100));
  const n = nextToPlay();
  $('continueBtn').hidden = n < 0;
  if (n >= 0) { $('continueBtn').innerHTML = icon('play') + (passed() ? 'Продовжити' : 'Почати') + `: рівень ${n + 1} · ${esc(LEVELS[n].name)}`; $('continueBtn').dataset.level = n; }
}
$('chapters').addEventListener('click', e => { const b = e.target.closest('[data-level]'); if (b && !b.disabled) openLevel(+b.dataset.level); });
$('continueBtn').onclick = () => openLevel(+$('continueBtn').dataset.level);
$('homeBtn').onclick = () => showHome();
$('backBtn').onclick = () => showHome();
$('prevBtn').onclick = () => openLevel(cur - 1);
$('nextBtn').onclick = () => openLevel(cur + 1);

/* ═════════ Клавіатура ═════════ */
document.addEventListener('keydown', e => {
  if (!$('confirm').hidden) { if (e.key === 'Escape') answer(false); else if (e.key === 'Enter') { e.preventDefault(); answer(document.activeElement !== $('confirmNo')); } return; }
  if (!$('report').hidden) { if (e.key === 'Escape') $('report').hidden = true; return; }
  if (!$('viewer').hidden) { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); closeViewer(); } return; }
  if (!$('result').hidden) {
    if (e.key === 'Escape') $('resLevels').click();
    else if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); (!$('resNext').disabled ? $('resNext') : $('resRetry')).click(); }
    return;
  }
  if ($('play').hidden || finished) return;
  if (e.target.closest?.('input, textarea')) return;
  const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (e.key === 'Escape') { hideCtx(); if (sel.size) { sel.clear(); renderSel(); } return; }
  if (mod && e.shiftKey && (k === 'n' || e.code === 'KeyN')) { e.preventDefault(); newFolder(); return; }
  if (mod && (k === 'a' || e.code === 'KeyA')) { e.preventDefault(); sel = new Set(visibleIds()); renderSel(); return; }
  if (mod && (k === 'x' || e.code === 'KeyX')) { e.preventDefault(); setClip('cut'); return; }
  if (mod && (k === 'c' || e.code === 'KeyC')) { e.preventDefault(); setClip('copy'); return; }
  if (mod && (k === 'v' || e.code === 'KeyV')) { e.preventDefault(); paste(); return; }
  if (mod && (k === 'z' || e.code === 'KeyZ')) { e.preventDefault(); undo(); return; }
  if (mod && (k === 'f' || e.code === 'KeyF')) { e.preventDefault(); $('search').focus(); return; }
  if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); $('navBack').click(); return; }
  if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); $('navFwd').click(); return; }
  if (e.key === 'F2') { e.preventDefault(); startRename(); return; }
  if (e.key === 'Delete') { e.preventDefault(); del(); return; }
  if (e.key === 'Backspace') { e.preventDefault(); goUp(); return; }
  if (e.key === 'Enter' && sel.size === 1) { e.preventDefault(); openItem([...sel][0]); }
});

/* ═════════ Результати для вчителя ═════════ */
$('reportBtn').onclick = () => {
  $('studentName').value = progress.name;
  $('reportSum').innerHTML = `Пройдено рівнів: <b>${passed()} з ${LEVELS.length}</b><br>Зірок: <b>${totalStars()} з ${LEVELS.length * 3}</b><br>За найменше кроків: <b>${bestCount()}</b>`;
  $('report').hidden = false;
  setTimeout(() => $('studentName').focus(), 30);
};
$('report').addEventListener('click', e => { if (e.target.id === 'report' || e.target.closest('[data-close]')) $('report').hidden = true; });
$('studentName').addEventListener('input', e => { progress.name = e.target.value; saveProgress(); });
$('resetProgress').onclick = () => {
  if (!confirm('Скинути весь прогрес? Усі зірки буде видалено.')) return;
  progress.best = {}; saveProgress(); $('report').hidden = true; renderHome(); toast('Прогрес скинуто');
};
$('downloadReport').onclick = async () => {
  const name = $('studentName').value.trim();
  if (!name) { $('studentName').focus(); toast('Вкажіть ім’я — так учитель знатиме, чиї це результати'); return; }
  const blob = await reportImage(name);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'files-' + name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() + '.png';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
};
function starPath(x, cx, cy, r) {
  x.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  x.closePath();
}
export async function reportImage(name) {
  const W = 1200, PAD = 40, HEAD = 190, ROW = 44;
  const half = Math.ceil(LEVELS.length / 2);
  const c = document.createElement('canvas'); c.width = W; c.height = HEAD + half * ROW + 60;
  const x = c.getContext('2d');
  const font = (w, s, mono) => `${w} ${s}px ${mono ? 'JetBrains Mono, monospace' : 'Inter, system-ui, sans-serif'}`;
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, c.height);
  x.fillStyle = '#4F6BF4'; x.fillRect(0, 0, W, 8);
  x.fillStyle = '#1a1d23'; x.font = font(800, 30); x.fillText('Файли й папки — результати', PAD, 62);
  x.font = font(600, 20); x.fillStyle = '#4b5563'; x.fillText(name, PAD, 98);
  x.font = font(500, 15); x.fillStyle = '#9ca3af'; x.fillText(new Date().toLocaleString('uk-UA', { dateStyle: 'long', timeStyle: 'short' }), PAD, 124);
  [['Пройдено', `${passed()} / ${LEVELS.length}`], ['Зірки', `${totalStars()} / ${LEVELS.length * 3}`], ['Найменше кроків', String(bestCount())]].forEach(([k, v], i) => {
    const bx = W - PAD - (3 - i) * 190;
    x.fillStyle = '#f3f5f9'; x.beginPath(); x.roundRect(bx, 40, 176, 92, 14); x.fill();
    x.fillStyle = '#9ca3af'; x.font = font(600, 13); x.fillText(k, bx + 16, 66);
    x.fillStyle = '#1a1d23'; x.font = font(800, 30); x.fillText(v, bx + 16, 110);
  });
  const colW = (W - PAD * 2) / 2;
  LEVELS.forEach((l, i) => {
    const ox = PAD + Math.floor(i / half) * colW, oy = HEAD + (i % half) * ROW, b = best(l.id);
    if (i % 2 === 0) { x.fillStyle = '#f7f8fa'; x.fillRect(ox - 8, oy - 28, colW - 20, ROW); }
    x.fillStyle = '#9ca3af'; x.font = font(700, 13, true); x.fillText(String(i + 1).padStart(2, '0'), ox, oy);
    x.fillStyle = '#1a1d23'; x.font = font(600, 16); x.fillText(l.name, ox + 34, oy);
    if (b) {
      for (let s = 0; s < 3; s++) { starPath(x, ox + 290 + s * 20, oy - 6, 8); x.fillStyle = s < b.stars ? '#f5b942' : '#e2e5ea'; x.fill(); }
      x.fillStyle = b.steps <= OPT[l.id] ? '#10b981' : '#1a1d23'; x.font = font(700, 14, true); x.fillText(`${b.steps} кр. (мін. ${OPT[l.id]})`, ox + 360, oy);
    } else { x.fillStyle = '#b0b6c2'; x.font = font(500, 14); x.fillText('не пройдено', ox + 290, oy); }
  });
  x.fillStyle = '#9ca3af'; x.font = font(500, 13); x.fillText('Edvault · Файли й папки', PAD, c.height - 22);
  return new Promise(r => c.toBlob(r, 'image/png'));
}

/* ═════════ Старт ═════════ */
const fromHash = LEVELS.findIndex(l => '#' + l.id === location.hash);
if (fromHash >= 0 && unlocked(fromHash)) openLevel(fromHash); else showHome();
window.FilesTrainer = { LEVELS, OPT, get progress() { return progress; }, get session() { return S; }, get cwd() { return cwd; }, openLevel, reportImage };
