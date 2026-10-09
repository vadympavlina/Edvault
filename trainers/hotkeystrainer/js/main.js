// Гарячі клавіші · Edvault — пам’ятка, завдання «натисни комбінацію» й «вибери відповідь»,
// живі макети документа, браузера й провідника, віртуальна клавіатура, прогрес і результати.
import { CHAPTERS, LEVELS } from './levels.js';
import { parseCombo, matches, pressedKeys, isModifier, comboKeys, scorePress, starsFor } from './logic.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c;

/* ═════════ Іконки ═════════ */
const P = {
  command: '<path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M10 13h4M7 16h10"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  left: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  paste: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  cut: '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  redo: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>',
  all: '<path d="M5 3a2 2 0 0 0-2 2M19 3a2 2 0 0 1 2 2M21 19a2 2 0 0 1-2 2M5 21a2 2 0 0 1-2-2M9 3h1M9 21h1M14 3h1M14 21h1M3 9v1M21 9v1M3 14v1M21 14v1"/>',
  bold: '<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>',
  italic: '<path d="M19 4h-9M14 20H5M15 4 9 20"/>',
  underline: '<path d="M6 4v6a6 6 0 0 0 12 0V4M4 20h16"/>',
  save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7M7 3v4a1 1 0 0 0 1 1h7"/>',
  print: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  find: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  home: '<path d="M4 6h16M4 12h10M4 18h6"/><path d="M4 3v18"/>',
  end: '<path d="M4 6h16M10 12h10M14 18h6"/><path d="M20 3v18"/>',
  doc: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  word: '<path d="m15 18-6-6 6-6"/>',
  select: '<path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3M8 12h8"/>',
  delete: '<path d="M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/><path d="m12 9 6 6M18 9l-6 6"/>',
  zoomIn: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>',
  zoomOut: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M8 11h6"/>',
  zoom0: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><circle cx="11" cy="11" r="2"/>',
  reload: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  address: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  tab: '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20M8 6v4"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  incognito: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/>',
  win: '<rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/>',
  switch: '<rect x="2" y="7" width="13" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>',
  desktop: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',
  shot: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/>',
  task: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  files: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  rename: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  ctrl: '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M8 12h8"/>',
  star: '<path fill="currentColor" stroke="none" d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  starLine: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
};
const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || P.info}</svg>`;
const starsHtml = n => `<span class="stars">${[0, 1, 2].map(i => icon('star', i < n ? 'on' : '')).join('')}</span>`;
const caps = combo => `<span class="caps">${comboKeys(combo).map(k => `<kbd>${esc(k)}</kbd>`).join('<i>+</i>')}</span>`;
document.querySelectorAll('[data-icon]').forEach(e => { e.outerHTML = icon(e.dataset.icon); });
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2400); }

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
const KEY = 'edvault-hotkeys';
let progress = (() => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } })();
if (!progress || typeof progress !== 'object') progress = {};
progress = { name: progress.name || '', best: progress.best || {} };
const saveProgress = () => { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* немає місця */ } };
const best = id => progress.best[id];
const unlocked = i => i === 0 || (best(LEVELS[i - 1].id)?.stars || 0) >= 1;
const passed = () => LEVELS.filter(l => best(l.id)?.stars).length;
const totalStars = () => LEVELS.reduce((s, l) => s + (best(l.id)?.stars || 0), 0);
// скільки різних комбінацій трапилося в пройдених рівнях
const learned = () => new Set(LEVELS.filter(l => best(l.id)?.stars).flatMap(l => l.tasks.flatMap(t => t.kind === 'press' ? [t.combo] : t.options.filter(o => o.k).map(o => o.k)))).size;

// Назви дій — щоб пояснити, що саме учень натиснув
const NAMES = {
  'Ctrl+C': 'копіювати', 'Ctrl+V': 'вставити', 'Ctrl+X': 'вирізати', 'Ctrl+Z': 'скасувати', 'Ctrl+Y': 'повторити', 'Ctrl+A': 'виділити все',
  'Ctrl+B': 'жирний', 'Ctrl+I': 'курсив', 'Ctrl+U': 'підкреслити', 'Ctrl+S': 'зберегти', 'Ctrl+P': 'друк', 'Ctrl+F': 'знайти',
  'Home': 'на початок рядка', 'End': 'у кінець рядка', 'Ctrl+Home': 'на початок документа', 'Ctrl+End': 'у кінець документа', 'Ctrl+←': 'слово ліворуч',
  'Shift+→': 'виділити праворуч', 'Shift+End': 'виділити до кінця рядка', 'Ctrl+Backspace': 'стерти слово', 'Ctrl+=': 'збільшити масштаб',
  'Ctrl+-': 'зменшити масштаб', 'Ctrl+0': 'звичайний масштаб', 'F5': 'оновити сторінку', 'Ctrl+L': 'адресний рядок', 'Ctrl+D': 'закладка',
  'Ctrl+H': 'історія', 'Ctrl+J': 'завантаження', 'F2': 'перейменувати', 'Delete': 'видалити', 'Ctrl+N': 'нове вікно', 'Ctrl+O': 'відкрити файл',
};
const nameOf = ev => { for (const c of Object.keys(NAMES)) if (matches(ev, c)) return NAMES[c]; return null; };

/* ═════════ Віртуальна клавіатура ═════════ */
// [код, підпис, підпис українською, ширина]
const ROWS = [
  [['Escape', 'Esc'], ['F1', 'F1'], ['F2', 'F2'], ['F3', 'F3'], ['F4', 'F4'], ['F5', 'F5'], ['F6', 'F6'], ['F7', 'F7'], ['F8', 'F8'], ['F9', 'F9'], ['F10', 'F10'], ['F11', 'F11'], ['F12', 'F12'], ['PrintScreen', 'PrtSc']],
  [['Backquote', '`', '’'], ...'1234567890'.split('').map(d => ['Digit' + d, d]), ['Minus', '−'], ['Equal', '=  +'], ['Backspace', 'Backspace', '', 2]],
  [['Tab', 'Tab', '', 1.5], ...'QWERTYUIOP'.split('').map((l, i) => ['Key' + l, l, 'ЙЦУКЕНГШЩЗ'[i]]), ['BracketLeft', '[', 'Х'], ['BracketRight', ']', 'Ї'], ['Backslash', '\\', 'Ґ', 1.5]],
  [['CapsLock', 'Caps', '', 1.8], ...'ASDFGHJKL'.split('').map((l, i) => ['Key' + l, l, 'ФІВАПРОЛД'[i]]), ['Semicolon', ';', 'Ж'], ['Quote', "'", 'Є'], ['Enter', 'Enter', '', 2.2]],
  [['ShiftLeft', 'Shift', '', 2.4], ...'ZXCVBNM'.split('').map((l, i) => ['Key' + l, l, 'ЯЧСМИТЬ'[i]]), ['Comma', ',', 'Б'], ['Period', '.', 'Ю'], ['Slash', '/', '.'], ['ShiftRight', 'Shift', '', 2.6]],
  [['ControlLeft', 'Ctrl', '', 1.6], ['MetaLeft', 'Win', '', 1.3], ['AltLeft', 'Alt', '', 1.3], ['Space', '', '', 6.2], ['AltRight', 'Alt', '', 1.3], ['ControlRight', 'Ctrl', '', 1.6]],
];
const NAV = [[['Insert', 'Ins'], ['Home', 'Home'], ['PageUp', 'PgUp']], [['Delete', 'Del'], ['End', 'End'], ['PageDown', 'PgDn']], [null, ['ArrowUp', '↑'], null], [['ArrowLeft', '←'], ['ArrowDown', '↓'], ['ArrowRight', '→']]];
const keyHtml = k => k ? `<span class="key${k[0].startsWith('Key') || k[0].startsWith('Digit') ? '' : ' fn'}" data-code="${k[0]}" style="flex:${k[3] || 1}"><b>${esc(k[1])}</b>${k[2] ? `<small>${esc(k[2])}</small>` : ''}</span>` : '<span class="key gap"></span>';
$('keyboard').innerHTML = `<div class="kb-main">${ROWS.map((r, i) => `<div class="kb-row${i === 0 ? ' top' : ''}">${r.map(keyHtml).join('')}</div>`).join('')}</div>
  <div class="kb-nav"><div class="kb-row top"></div>${NAV.map((r, i) => `<div class="kb-row${i === 2 ? ' spacer' : ''}">${r.map(keyHtml).join('')}</div>`).join('')}</div>`;
const MOD_CODES = { Ctrl: ['ControlLeft', 'ControlRight'], Shift: ['ShiftLeft', 'ShiftRight'], Alt: ['AltLeft', 'AltRight'], Win: ['MetaLeft'] };
function lightKeys(combo, cls) {
  document.querySelectorAll('#keyboard .' + cls).forEach(k => k.classList.remove(cls));
  if (!combo) return;
  const c = parseCombo(combo);
  const codes = [c.code, ...['Ctrl', 'Shift', 'Alt', 'Win'].filter(m => c[m.toLowerCase()]).map(m => MOD_CODES[m][0])];
  codes.forEach(code => document.querySelector(`#keyboard [data-code="${code}"]`)?.classList.add(cls));
}
const held = new Set();
const keyEl = code => document.querySelector(`#keyboard [data-code="${code === 'MetaRight' || code === 'OSLeft' ? 'MetaLeft' : code}"]`);
document.addEventListener('keydown', e => { held.add(e.code); keyEl(e.code)?.classList.add('down'); }, true);
document.addEventListener('keyup', e => { held.delete(e.code); keyEl(e.code)?.classList.remove('down'); }, true);
window.addEventListener('blur', () => { held.clear(); document.querySelectorAll('#keyboard .down').forEach(k => k.classList.remove('down')); });

/* ═════════ Макети ═════════ */
const LINES = ['Наш кіт любить спати на сонці.', 'А ввечері він грає з м’ячиком.'];
const FILES = ['Новий документ.docx', 'чернетка.txt', 'фото.jpg', 'малюнок.png'];
const ZOOMS = [50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200];
let doc, web, fs;
function resetScenes() {
  doc = { lines: LINES.map(l => l.split(' ').map(t => ({ t }))), sel: null, caret: { l: 0, i: 2 }, clip: null, hist: [], fut: [], saved: true, find: false, print: false, flash: null };
  web = { zoom: 100, star: false, panel: null, find: false, addr: false, loading: false };
  fs = { files: FILES.map(n => ({ n })), sel: [0], hist: [], renaming: false };
}
const snapDoc = () => JSON.stringify({ lines: doc.lines, sel: doc.sel, caret: doc.caret });
const restoreDoc = s => Object.assign(doc, JSON.parse(s));
const wordIndex = name => { for (const [l, ws] of doc.lines.entries()) { const i = ws.findIndex(w => w.t.replace(/[.,]$/, '') === name); if (i >= 0) return { l, i }; } return null; };
const selWords = () => !doc.sel ? [] : doc.sel.all ? doc.lines.flatMap((ws, l) => ws.map((w, i) => ({ l, i, w }))) : doc.lines[doc.sel.l].slice(doc.sel.a, doc.sel.b).map((w, k) => ({ l: doc.sel.l, i: doc.sel.a + k, w }));
function selectWord(name) { const p = wordIndex(name); if (p) { doc.sel = { l: p.l, a: p.i, b: p.i + 1 }; doc.caret = { l: p.l, i: p.i + 1 }; } }
function prepDoc(task) {
  doc.find = false; doc.print = false; doc.flash = null;
  if (task.caret === 'end') { doc.sel = null; doc.caret = { l: 0, i: doc.lines[0].length }; return; }
  if (task.sel === null) { if (doc.sel && !doc.sel.all) doc.caret = { l: doc.sel.l, i: doc.sel.b }; doc.sel = null; return; }
  if (task.sel) { selectWord(task.sel); return; }
  const needSel = ['copy', 'cut', 'bold', 'italic', 'underline', 'selRight', 'selEnd'].includes(task.act);
  if (needSel && !doc.sel) selectWord('кіт');
}
function modify(fn) { doc.hist.push(snapDoc()); doc.fut = []; fn(); doc.saved = false; }
const DOC_ACT = {
  copy() { if (doc.sel) { doc.clip = selWords().map(x => ({ ...x.w })); doc.flash = 'copy'; } },
  cut() { if (!doc.sel || doc.sel.all) return; modify(() => { doc.clip = selWords().map(x => ({ ...x.w })); doc.lines[doc.sel.l].splice(doc.sel.a, doc.sel.b - doc.sel.a); doc.caret = { l: doc.sel.l, i: doc.sel.a }; doc.sel = null; }); },
  paste() {
    if (!doc.clip) return;
    modify(() => {
      const ins = doc.clip.map(w => ({ ...w }));
      if (doc.sel?.all) { doc.lines = [ins, []]; doc.caret = { l: 0, i: ins.length }; }
      else { const at = doc.sel ? { l: doc.sel.l, i: doc.sel.b } : doc.caret; doc.lines[at.l].splice(at.i, 0, ...ins); doc.caret = { l: at.l, i: at.i + ins.length }; doc.flash = { l: at.l, a: at.i, b: at.i + ins.length }; }
      doc.sel = null;
    });
  },
  undo() { if (doc.hist.length) { doc.fut.push(snapDoc()); restoreDoc(doc.hist.pop()); doc.saved = false; } },
  redo() { if (doc.fut.length) { doc.hist.push(snapDoc()); restoreDoc(doc.fut.pop()); doc.saved = false; } },
  selectAll() { doc.sel = { all: true }; },
  bold() { const ws = selWords(); if (ws.length) modify(() => { const on = !ws.every(x => doc.lines[x.l][x.i].b); ws.forEach(x => { doc.lines[x.l][x.i].b = on; }); }); },
  italic() { const ws = selWords(); if (ws.length) modify(() => { const on = !ws.every(x => doc.lines[x.l][x.i].i); ws.forEach(x => { doc.lines[x.l][x.i].i = on; }); }); },
  underline() { const ws = selWords(); if (ws.length) modify(() => { const on = !ws.every(x => doc.lines[x.l][x.i].u); ws.forEach(x => { doc.lines[x.l][x.i].u = on; }); }); },
  save() { doc.saved = true; toast('Документ збережено'); },
  print() { doc.print = true; },
  find() { doc.find = true; },
  home() { doc.sel = null; doc.caret = { l: doc.caret.l, i: 0 }; },
  end() { doc.sel = null; doc.caret = { l: doc.caret.l, i: doc.lines[doc.caret.l].length }; },
  docStart() { doc.sel = null; doc.caret = { l: 0, i: 0 }; },
  docEnd() { doc.sel = null; doc.caret = { l: doc.lines.length - 1, i: doc.lines.at(-1).length }; },
  wordLeft() { doc.sel = null; if (doc.caret.i > 0) doc.caret.i--; else if (doc.caret.l > 0) doc.caret = { l: doc.caret.l - 1, i: doc.lines[doc.caret.l - 1].length }; },
  selRight() { const l = doc.sel?.l ?? doc.caret.l; const a = doc.sel?.a ?? doc.caret.i, b = Math.min(doc.lines[l].length, (doc.sel?.b ?? doc.caret.i) + 1); doc.sel = { l, a, b }; doc.caret = { l, i: b }; },
  selEnd() { const l = doc.sel?.l ?? doc.caret.l, a = doc.sel?.a ?? doc.caret.i; doc.sel = { l, a, b: doc.lines[l].length }; doc.caret = { l, i: doc.lines[l].length }; },
  delWord() { if (doc.caret.i > 0) modify(() => { doc.lines[doc.caret.l].splice(doc.caret.i - 1, 1); doc.caret.i--; }); },
};
const WEB_ACT = {
  zoomIn() { web.zoom = ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(web.zoom) + 1)]; },
  zoomOut() { web.zoom = ZOOMS[Math.max(0, ZOOMS.indexOf(web.zoom) - 1)]; },
  zoom0() { web.zoom = 100; },
  reload() { web.loading = true; setTimeout(() => { web.loading = false; if (level?.scene === 'browser') drawScene(); }, 700); },
  address() { web.addr = true; },
  bookmark() { web.star = true; toast('Сторінку додано в закладки'); },
  history() { web.panel = 'history'; },
  downloads() { web.panel = 'downloads'; },
  find() { web.find = true; },
};
const FS_ACT = {
  rename() { const i = fs.sel[0]; fs.hist.push(JSON.stringify(fs.files)); fs.renaming = true; fs.files[i].n = 'Реферат з історії.docx'; },
  delete() { fs.hist.push(JSON.stringify(fs.files)); fs.files = fs.files.filter((_, i) => !fs.sel.includes(i)); fs.sel = []; toast('Файл переміщено в кошик'); },
  undo() { if (fs.hist.length) { fs.files = JSON.parse(fs.hist.pop()); fs.sel = []; } },
  selectAll() { fs.sel = fs.files.map((_, i) => i); },
};
function sceneHtml() {
  if (level.scene === 'doc') {
    const isSel = (l, i) => doc.sel && (doc.sel.all || (doc.sel.l === l && i >= doc.sel.a && i < doc.sel.b));
    const isFlash = (l, i) => doc.flash && doc.flash.l === l && i >= doc.flash.a && i < doc.flash.b;
    const st = selWords()[0]?.w || {};
    const lines = doc.lines.map((ws, l) => `<p>${ws.map((w, i) => `${doc.caret.l === l && doc.caret.i === i && !doc.sel ? '<i class="caret"></i>' : ''}<span class="w${isSel(l, i) ? ' sel' : ''}${isSel(l, i) && doc.flash === 'copy' ? ' copied' : ''}${isFlash(l, i) ? ' new' : ''}${w.b ? ' b' : ''}${w.i ? ' it' : ''}${w.u ? ' u' : ''}">${esc(w.t)}</span>`).join(' ')}${doc.caret.l === l && doc.caret.i === ws.length && !doc.sel ? '<i class="caret"></i>' : ''}</p>`).join('');
    return `<div class="mock win-doc">
      <div class="mk-title">${icon('doc')}<b>Мій твір.docx${doc.saved ? '' : ' *'}</b><span class="grow"></span><span class="mk-dots"><i></i><i></i><i></i></span></div>
      <div class="mk-tools"><span class="tb${st.b ? ' on' : ''}">${icon('bold')}</span><span class="tb${st.i ? ' on' : ''}">${icon('italic')}</span><span class="tb${st.u ? ' on' : ''}">${icon('underline')}</span><span class="tb-sep"></span><span class="tb">${icon('save')}</span><span class="tb">${icon('print')}</span><span class="grow"></span>${doc.clip ? `<span class="clip${doc.flash === 'copy' ? ' pop' : ''}">${icon('paste')}Буфер: «${esc(doc.clip.map(w => w.t).join(' ').slice(0, 40))}»</span>` : '<span class="clip empty">Буфер порожній</span>'}</div>
      ${doc.find ? `<div class="mk-find">${icon('find')}<span>Знайти в документі…</span></div>` : ''}
      <div class="mk-page">${lines}</div>
      ${doc.print ? `<div class="mk-dialog">${icon('print')}<b>Друк</b><span>Принтер: Шкільний · 1 сторінка</span></div>` : ''}
    </div>`;
  }
  if (level.scene === 'browser') {
    const panel = web.panel === 'history' ? ['Історія', ['Сонячна система — Edvault', 'Космос для дітей', 'Розклад уроків']] : web.panel === 'downloads' ? ['Завантаження', ['планети.pdf', 'місяць.jpg', 'презентація.pptx']] : null;
    return `<div class="mock win-web">
      <div class="wb-tabs"><span class="wb-tab">${icon('star')}Сонячна система<i>${icon('x')}</i></span><span class="wb-new">+</span></div>
      <div class="wb-bar"><span class="wb-btn">${icon('left')}</span><span class="wb-btn${web.loading ? ' spin' : ''}">${icon('reload')}</span><span class="wb-addr${web.addr ? ' focus' : ''}">${icon('lock')}<span>${web.addr ? '<mark>edvault.online/space</mark>' : 'edvault.online/space'}</span><span class="grow"></span><span class="wb-star${web.star ? ' on' : ''}">${icon(web.star ? 'star' : 'starLine')}</span></span>${web.zoom !== 100 ? `<span class="wb-zoom">${icon('zoomIn')}${web.zoom}%</span>` : ''}</div>
      ${web.find ? `<div class="mk-find">${icon('find')}<span>Знайти на сторінці…</span></div>` : ''}
      <div class="wb-body"><div class="wb-page${web.loading ? ' loading' : ''}" style="font-size:${web.zoom / 100 * 15}px"><h3>Сонячна система</h3><p>Навколо Сонця обертаються вісім планет. Найбільша з них — Юпітер, а найближча до Сонця — Меркурій.</p><div class="planets">${['#f59e0b', '#ef4444', '#3b82f6', '#a855f7'].map((c, i) => `<i style="background:${c};width:${(1.6 + i * .5)}em;height:${(1.6 + i * .5)}em"></i>`).join('')}</div></div>
      ${panel ? `<div class="wb-panel"><b>${icon(web.panel === 'history' ? 'history' : 'download')}${panel[0]}</b>${panel[1].map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}</div>
    </div>`;
  }
  if (level.scene === 'files') {
    return `<div class="mock win-files"><div class="mk-title">${icon('files')}<b>Документи</b><span class="grow"></span><span class="mk-dots"><i></i><i></i><i></i></span></div>
      <div class="fs-grid">${fs.files.map((f, i) => `<span class="fs-it${fs.sel.includes(i) ? ' sel' : ''}">${icon('file')}<b class="${fs.renaming && i === fs.sel[0] ? 'ren' : ''}">${esc(f.n)}</b></span>`).join('') || '<span class="fs-empty">Папка порожня</span>'}</div></div>`;
  }
  // робочий стіл Windows — ілюстрація для запитань
  return `<div class="mock win-desk"><div class="dk-win a"><div class="mk-title">${icon('doc')}<b>Документ</b></div></div><div class="dk-win b"><div class="mk-title">${icon('tab')}<b>Браузер</b></div></div><div class="dk-bar"><span class="dk-start">${icon('win')}</span><span>${icon('files')}</span><span>${icon('tab')}</span><span>${icon('doc')}</span><span class="grow"></span><span class="dk-time">10:42</span></div></div>`;
}
const drawScene = () => { const s = $('scene'); if (s) s.innerHTML = sceneHtml(); };
function applyAct(act) {
  const map = level.scene === 'browser' ? WEB_ACT : level.scene === 'files' ? FS_ACT : DOC_ACT;
  map[act]?.();
  drawScene();
  if (act === 'print') setTimeout(() => { doc.print = false; drawScene(); }, 1400);
}
function prepScene(t) {
  if (level.scene === 'doc') prepDoc(t);
  if (level.scene === 'browser') { web.find = false; web.addr = false; if (!['history', 'downloads'].includes(t.act)) web.panel = null; }
  if (level.scene === 'files') { fs.renaming = false; if (t.sel) fs.sel = [fs.files.findIndex(f => f.n === t.sel)].filter(i => i >= 0); else if (t.act === 'rename' && !fs.sel.length) fs.sel = [0]; }
}

/* ═════════ Гра ═════════ */
let level = null, cur = -1, ti = -1, scores = [], task = null, answered = false, st = {}, clock = null, spent = 0;
const pct = s => Math.round(s * 100);
function openLevel(i) {
  if (!LEVELS[i] || !unlocked(i)) { showHome(); return; }
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  cur = i; level = LEVELS[i]; scores = []; spent = 0; stopClock();
  resetScenes();
  $('home').hidden = true; $('play').hidden = false; $('result').hidden = true;
  $('lvlChapter').textContent = CHAPTERS.find(c => c.id === level.chapter).name;
  $('lvlName').textContent = `${i + 1}. ${level.name}`;
  $('lvlHint').innerHTML = tipsHtml(); $('lvlHint').hidden = true; $('tipsBtn').classList.remove('on');
  $('navNum').textContent = `${i + 1} / ${LEVELS.length}`;
  $('prevBtn').disabled = i === 0;
  $('nextBtn').disabled = !(i + 1 < LEVELS.length && unlocked(i + 1));
  $('timer').hidden = !level.par;
  showIntro();
  if (location.hash !== '#' + level.id) window.history.replaceState(null, '', '#' + level.id);
}
const tipsHtml = () => `<ul class="tips">${level.tips.map(([ic, t]) => `<li><span class="tip-ico">${icon(ic)}</span><span>${t}</span></li>`).join('')}</ul>`;
function showIntro() {
  ti = -1; task = null; answered = false;
  $('feedback').hidden = true; $('tipsBtn').hidden = true;
  lightKeys(null, 'target'); lightKeys(null, 'hint');
  $('stage').className = 'stage intro';
  $('stage').innerHTML = `<div class="intro-head"><span class="intro-ico">${icon('book')}</span><div><small>Пам’ятка перед рівнем</small><h2>${esc(level.name)}</h2></div></div>${tipsHtml()}
    <div class="verdicts"><span class="note">${icon('info')}${level.tasks.length} ${plural(level.tasks.length, 'завдання', 'завдання', 'завдань')}${level.par ? ` · на час: ${level.par} с` : ''}</span><span class="grow"></span><button class="btn btn-primary btn-lg2" id="goBtn">${icon('play')}Почати</button></div>`;
  $('goBtn').onclick = () => { ti = 0; showTask(); };
  renderDots(); renderTimer();
  setTimeout(() => $('goBtn')?.focus({ preventScroll: true }), 30);
}
$('tipsBtn').onclick = () => { const h = !$('lvlHint').hidden; $('lvlHint').hidden = h; $('tipsBtn').classList.toggle('on', !h); };
function renderDots() {
  $('dots').innerHTML = level.tasks.map((_, k) => { const s = scores[k]; return `<i class="${k === ti && !answered ? 'cur' : s == null ? '' : s >= 0.9 ? 'ok' : s > 0 ? 'part' : 'bad'}"></i>`; }).join('');
  $('stepN').textContent = ti < 0 ? 'Пам’ятка' : `Завдання ${ti + 1} з ${level.tasks.length}`;
}
const fmt = s => s.toFixed(1).replace('.', ',') + ' с';
function renderTimer() { if (level?.par) $('timer').innerHTML = `${icon('clock')}${fmt(spent + (clock ? (performance.now() - clock.t0) / 1000 : 0))}`; }
function startClock() { if (!level.par) return; clock = { t0: performance.now(), id: setInterval(renderTimer, 100) }; }
function stopClock() { if (!clock) return; spent += (performance.now() - clock.t0) / 1000; clearInterval(clock.id); clock = null; renderTimer(); }

function showTask() {
  task = level.tasks[ti]; answered = false; st = { wrong: 0, hint: false, gaveUp: false };
  $('feedback').hidden = true; $('tipsBtn').hidden = false;
  lightKeys(null, 'target'); lightKeys(null, 'hint');
  $('stage').className = 'stage k-' + task.kind;
  if (task.kind === 'press') {
    prepScene(task);
    $('stage').innerHTML = `<div class="q-row"><h2 class="q">${esc(task.q)}</h2></div><div id="scene">${sceneHtml()}</div>
      <div class="press"><span class="press-l">Натисніть комбінацію клавіш</span><span class="live" id="live"><span class="live-empty">…</span></span><span class="grow"></span>
      <button class="btn" id="hintBtn">${icon('bulb')}Підказка</button><button class="btn" id="giveBtn">Не знаю</button></div>
      <p class="press-msg" id="pressMsg"></p>`;
    $('hintBtn').onclick = () => showHint(false);
    $('giveBtn').onclick = () => showHint(true);
  } else {
    $('stage').innerHTML = `<h2 class="q">${esc(task.q)}</h2>${level.scene && level.scene !== 'doc' ? `<div id="scene" class="scene-small">${sceneHtml()}</div>` : ''}<div class="options">${task.options.map((o, k) => `<button class="opt" data-k="${k}"><span class="opt-k">${'АБВГ'[k]}</span><span class="opt-t">${o.k ? caps(o.k) : esc(o.t)}</span></button>`).join('')}</div>`;
    $('stage').querySelector('.options').addEventListener('click', e => {
      const b = e.target.closest('.opt'); if (!b || answered) return;
      const o = task.options[+b.dataset.k], right = task.options.find(x => x.ok);
      $('stage').querySelectorAll('.opt').forEach(x => { x.disabled = true; if (task.options[+x.dataset.k].ok) x.classList.add('right'); });
      if (!o.ok) b.classList.add('wrong');
      if (right.k) lightKeys(right.k, 'target');
      finish(o.ok ? 1 : 0, o.ok ? esc(o.why) : `${esc(o.why)} Правильно: ${right.k ? caps(right.k) : `<b>«${esc(right.t)}»</b>`}. ${esc(right.why)}`);
    });
  }
  renderDots();
  startClock();
}
function showHint(give) {
  if (answered) return;
  st.hint = true; if (give) st.gaveUp = true;
  lightKeys(task.combo, 'hint');
  $('pressMsg').innerHTML = `${icon('bulb')}Потрібно: ${caps(task.combo)} — затисніть ${comboKeys(task.combo).slice(0, -1).join(' і ') || ''}${comboKeys(task.combo).length > 1 ? ' і натисніть ' : 'натисніть '}<b>${esc(comboKeys(task.combo).at(-1))}</b>`;
  $('pressMsg').className = 'press-msg hint';
}
// натискання під час завдання «натисни»
document.addEventListener('keydown', e => {
  if ($('play').hidden || !$('result').hidden || !$('report').hidden) return;
  if (task?.kind !== 'press' || answered || ti < 0) return;
  const special = e.ctrlKey || e.metaKey || e.altKey || /^(F\d+|Home|End|Delete|Backspace|Arrow\w+|Tab|PageUp|PageDown)$/.test(e.code);
  if (special) e.preventDefault();
  const keys = pressedKeys(e);
  $('live').innerHTML = keys.map(k => `<kbd>${esc(k)}</kbd>`).join('<i>+</i>');
  if (isModifier(e.code) || e.repeat) return;
  if (matches(e, task.combo)) { success(); return; }
  if (e.code === 'Enter' || e.code === 'Escape') return;
  st.wrong++;
  const nm = nameOf(e);
  $('pressMsg').innerHTML = `${icon('x')}Ви натиснули ${keys.map(k => `<kbd>${esc(k)}</kbd>`).join('<i>+</i>')}${nm ? ` — це «${esc(nm)}»` : ''}. Спробуйте ще.`;
  $('pressMsg').className = 'press-msg bad';
  $('stage').classList.remove('shake'); void $('stage').offsetWidth; $('stage').classList.add('shake');
  if (st.wrong >= 3 && !st.hint) showHint(true);
}, false);
document.addEventListener('keyup', e => { if (task?.kind === 'press' && !answered && $('live') && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) setTimeout(() => { if ($('live') && !answered) $('live').innerHTML = '<span class="live-empty">…</span>'; }, 250); });
function success() {
  applyAct(task.act);
  lightKeys(null, 'hint'); lightKeys(task.combo, 'target');
  const score = scorePress(st);
  $('pressMsg').innerHTML = `${icon('check')}${caps(task.combo)} — ${esc(NAMES[task.combo] || task.q)}`;
  $('pressMsg').className = 'press-msg ok';
  finish(score, score === 1 ? `${caps(task.combo)} — ${esc(NAMES[task.combo] || '')}.` : st.gaveUp || st.wrong >= 3 ? `Запам’ятайте: ${caps(task.combo)} — ${esc(NAMES[task.combo] || '')}.` : `Вийшло! Наступного разу — без підказки. ${caps(task.combo)} — ${esc(NAMES[task.combo] || '')}.`);
}
function finish(score, why) {
  answered = true; scores[ti] = score; stopClock();
  $('stage').classList.add('done');
  const kind = score >= 0.9 ? 'ok' : score > 0 ? 'part' : 'bad';
  // у швидкісних рівнях правильні відповіді йдуть далі самі — без зайвих натискань
  if (level.par && kind === 'ok') { renderDots(); setTimeout(next, 450); return; }
  $('feedback').className = 'feedback ' + kind;
  $('fbIco').innerHTML = icon(kind === 'ok' ? 'check' : kind === 'part' ? 'bulb' : 'x');
  $('fbTitle').textContent = kind === 'ok' ? 'Правильно!' : kind === 'part' ? 'Майже!' : task.kind === 'press' ? 'Нічого, запам’ятаємо' : 'Неправильно';
  $('fbWhy').innerHTML = why || '';
  $('fbList').innerHTML = '';
  $('fbNext').innerHTML = (ti + 1 < level.tasks.length ? 'Далі' : 'Завершити') + icon('arrow');
  $('feedback').hidden = false;
  renderDots();
  setTimeout(() => $('fbNext').focus({ preventScroll: true }), 30);
}
function next() { if (!level || ti < 0) return; if (ti + 1 < level.tasks.length) { ti++; showTask(); } else complete(); }
$('fbNext').onclick = next;

function complete() {
  stopClock();
  const avg = scores.reduce((a, b) => a + b, 0) / level.tasks.length;
  let stars = starsFor(avg);
  const slow = level.par && spent > level.par;
  if (slow) stars = Math.min(stars, 2);
  const p = pct(avg), prev = best(level.id);
  if (!prev || stars > prev.stars || (stars === prev.stars && (p > prev.pct || (level.par && spent < (prev.time || Infinity))))) { progress.best[level.id] = { stars, pct: p, time: level.par ? Math.round(spent * 10) / 10 : undefined, at: Date.now() }; saveProgress(); }
  $('resStars').innerHTML = [0, 1, 2].map(i => icon('star', i < stars ? 'on' : '')).join('');
  $('resTitle').textContent = stars === 3 ? 'Руки пам’ятають!' : stars === 2 ? 'Добре!' : 'Рівень пройдено';
  $('resMsg').textContent = `Точність ${p}%${level.par ? ` · час ${fmt(spent)} (для трьох зірок — до ${level.par} с)` : ''}. ${stars === 3 ? 'Чудово!' : slow ? 'Спробуйте швидше!' : 'Для трьох зірок — без підказок і помилок.'}`;
  const nx = cur + 1 < LEVELS.length;
  $('resNext').disabled = !nx || !unlocked(cur + 1);
  $('resNext').innerHTML = nx ? 'Далі' + icon('arrow') : 'Усі рівні пройдено';
  $('result').hidden = false;
  setTimeout(() => $('resNext').focus(), 50);
}
$('resRetry').onclick = () => openLevel(cur);
$('resNext').onclick = () => openLevel(cur + 1);
$('resLevels').onclick = () => showHome();

/* ═════════ Головна ═════════ */
const CH_ICON = { basics: 'copy', text: 'bold', browser: 'tab', windows: 'win', master: 'clock' };
function showHome() {
  stopClock(); cur = -1; level = null; task = null;
  $('play').hidden = true; $('result').hidden = true; $('home').hidden = false;
  window.history.replaceState(null, '', location.pathname);
  renderHome();
}
function nextToPlay() {
  let i = LEVELS.findIndex((l, k) => unlocked(k) && !best(l.id)?.stars);
  if (i < 0) i = LEVELS.findIndex(l => (best(l.id)?.stars || 0) < 3);
  return i;
}
function thumb(l) {
  const combos = [...new Set(l.tasks.flatMap(t => t.kind === 'press' ? [t.combo] : t.options.filter(o => o.ok && o.k).map(o => o.k)))].slice(0, 3);
  return `<span class="th-ic">${icon(CH_ICON[l.chapter])}</span><span class="th-caps">${combos.map(caps).join('')}</span>`;
}
function renderHome() {
  $('chapters').innerHTML = CHAPTERS.map((ch, ci) => {
    const items = LEVELS.map((l, i) => ({ l, i })).filter(x => x.l.chapter === ch.id);
    const got = items.reduce((s, { l }) => s + (best(l.id)?.stars || 0), 0);
    return `<section class="chapter"><div class="chapter-head"><span class="ch-num">${ci + 1}</span><div class="ch-text"><h2>${ch.name}</h2><span>${ch.desc}</span></div><span class="ch-stars">${icon('star')}${got} / ${items.length * 3}</span></div><div class="levels">${items.map(({ l, i }) => {
      const b = best(l.id), open = unlocked(i);
      return `<button class="lvl${b?.stars === 3 ? ' perfect' : ''}${open && !b ? ' fresh' : ''}" data-level="${i}" ${open ? '' : 'disabled title="Спершу пройдіть попередній рівень"'}>
        <div class="lvl-thumb ch-${l.chapter}">${open ? thumb(l) : `<span class="lvl-lock">${icon('lock')}</span>`}</div>
        <span class="lvl-num">${i + 1}</span>
        <div class="lvl-name">${esc(l.name)}</div>
        <div class="lvl-meta">${starsHtml(b?.stars || 0)}<span class="lvl-acc">${b ? (b.time ? fmt(b.time) : b.pct + '%') : `${l.tasks.length} ${plural(l.tasks.length, 'завдання', 'завдання', 'завдань')}`}</span></div>
      </button>`;
    }).join('')}</div></section>`;
  }).join('');
  const s = totalStars(), max = LEVELS.length * 3, pr = Math.round(passed() / LEVELS.length * 100);
  $('total').innerHTML = icon('star') + s + ' / ' + max;
  $('heroStars').textContent = s; $('heroMax').textContent = max;
  $('heroAcc').textContent = learned();
  $('ringPct').textContent = pr + '%';
  $('ringFg').style.strokeDashoffset = String(326.7 * (1 - pr / 100));
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

/* ═════════ Клавіатура: службові клавіші ═════════ */
document.addEventListener('keydown', e => {
  if (!$('report').hidden) { if (e.key === 'Escape') $('report').hidden = true; return; }
  if (!$('result').hidden) {
    if (e.key === 'Escape') $('resLevels').click();
    else if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); (!$('resNext').disabled ? $('resNext') : $('resRetry')).click(); }
    return;
  }
  if ($('play').hidden || e.target.closest?.('input')) return;
  if (ti < 0 && e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); $('goBtn')?.click(); return; }
  if (answered && e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); next(); return; }
  if (!answered && task?.kind === 'choice' && !e.ctrlKey && !e.altKey) { const k = ['1', '2', '3', '4'].indexOf(e.key); if (k >= 0) $('stage').querySelector(`.opt[data-k="${k}"]`)?.click(); }
});

/* ═════════ Результати для вчителя ═════════ */
$('reportBtn').onclick = () => {
  $('studentName').value = progress.name;
  $('reportSum').innerHTML = `Пройдено рівнів: <b>${passed()} з ${LEVELS.length}</b><br>Зірок: <b>${totalStars()} з ${LEVELS.length * 3}</b><br>Комбінацій вивчено: <b>${learned()}</b>`;
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
  a.download = 'hotkeys-' + name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() + '.png';
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
  x.fillStyle = '#1a1d23'; x.font = font(800, 30); x.fillText('Гарячі клавіші — результати', PAD, 62);
  x.font = font(600, 20); x.fillStyle = '#4b5563'; x.fillText(name, PAD, 98);
  x.font = font(500, 15); x.fillStyle = '#9ca3af'; x.fillText(new Date().toLocaleString('uk-UA', { dateStyle: 'long', timeStyle: 'short' }), PAD, 124);
  [['Пройдено', `${passed()} / ${LEVELS.length}`], ['Зірки', `${totalStars()} / ${LEVELS.length * 3}`], ['Комбінацій', String(learned())]].forEach(([k, v], i) => {
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
      for (let s = 0; s < 3; s++) { starPath(x, ox + 330 + s * 20, oy - 6, 8); x.fillStyle = s < b.stars ? '#f5b942' : '#e2e5ea'; x.fill(); }
      x.fillStyle = '#1a1d23'; x.font = font(700, 14, true); x.fillText(b.time ? fmt(b.time) : `${b.pct}%`, ox + 400, oy);
    } else { x.fillStyle = '#b0b6c2'; x.font = font(500, 14); x.fillText('не пройдено', ox + 330, oy); }
  });
  x.fillStyle = '#9ca3af'; x.font = font(500, 13); x.fillText('Edvault · Гарячі клавіші', PAD, c.height - 22);
  return new Promise(r => c.toBlob(r, 'image/png'));
}

/* ═════════ Старт ═════════ */
resetScenes();
const fromHash = LEVELS.findIndex(l => '#' + l.id === location.hash);
if (fromHash >= 0 && unlocked(fromHash)) openLevel(fromHash); else showHome();
window.HotkeysTrainer = { LEVELS, get progress() { return progress; }, get task() { return task; }, get scores() { return scores; }, get answered() { return answered; }, get doc() { return doc; }, get web() { return web; }, get fs() { return fs; }, openLevel };
