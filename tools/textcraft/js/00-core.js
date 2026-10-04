// TextCraft · Edvault — Основа: константи, іконки, утиліти, виділення, історія змін (undo/redo).
// Файли підключаються звичайними <script> по черзі й мають спільну глобальну область видимості.
'use strict';

'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   TextCraft · Edvault
   Архітектура:
   • Весь вміст — звичайний HTML у contenteditable (#editor), без вкладених
     contenteditable="false" «островів». Кнопки блоків (копіювати, змінити
     тип, видалити) — окремі плаваючі панелі поза редактором.
   • Власна історія змін (History): кожна дія — і набір тексту, і вставка
     блоку/таблиці/зображення, і видалення — відкочується Ctrl+Z.
     Рідний undo браузера повністю вимкнено (він не бачить DOM-змін зі скрипта).
   • normalize() після кожної зміни тримає структуру валідною.
   • Документи зберігаються в IndexedDB (кілька документів, зображення окремо).
   ═══════════════════════════════════════════════════════════════════════ */

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const editor = $('#editor');
const scrollArea = $('#scrollArea');
const IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
const MOD = IS_MAC ? '⌘' : 'Ctrl';
const DEFAULT_HTML = '<h1><br></h1><p><br></p>';

/* ═══════════════════════════ ІКОНКИ ═══════════════════════════ */
const I = {
  back:'<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  docs:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/><path d="M8 13h8M8 17h5"/>',
  logo:'<path d="M4 6h16M4 10h11M4 14h14M4 18h9"/>',
  toc:'<path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="3"/>',
  banner:'<rect x="3" y="4" width="18" height="8" rx="2"/><path d="M3 16h18M3 20h11"/>',
  view:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  help:'<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo:'<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  chevron:'<path d="m6 9 6 6 6-6"/>',
  minus:'<path d="M5 12h14"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  bold:'<path d="M7 5h6.5a3.5 3.5 0 0 1 0 7H7zM7 12h7.5a3.5 3.5 0 0 1 0 7H7z" stroke-width="2.4"/>',
  italic:'<path d="M19 4h-9M14 20H5M15 4 9 20"/>',
  underline:'<path d="M6 4v6a6 6 0 0 0 12 0V4"/><path d="M4 20h16"/>',
  strike:'<path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><path d="M4 12h16"/>',
  code:'<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  color:'<path d="M5.5 16.5 12 3l6.5 13.5"/><path d="M8 11.5h8"/>',
  eraser:'<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
  ul:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor"/>',
  ol:'<path d="M10 6h11M10 12h11M10 18h11"/><path d="M4 5h1v4"/><path d="M4 9h2"/><path d="M6 19H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
  checklist:'<rect x="3" y="4" width="6" height="6" rx="1.5"/><path d="m3.5 17 2 2 3.5-4"/><path d="M13 7h8M13 17h8"/>',
  alignLeft:'<path d="M21 6H3M15 12H3M17 18H3"/>',
  wrapLeft:'<rect x="3" y="4" width="9" height="9" rx="1.5"/><path d="M15 5h6M15 9h6M15 13h6M3 17h18M3 21h13"/>',
  wrapRight:'<rect x="12" y="4" width="9" height="9" rx="1.5"/><path d="M3 5h6M3 9h6M3 13h6M3 17h18M3 21h13"/>',
  tRows:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M3 14.5h18"/>',
  tCols:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
  tCell:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 12h18M12 4v16"/><path d="M12 12h9v8h-7a2 2 0 0 1-2-2z" fill="currentColor" opacity=".3" stroke="none"/>',
  tLook:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18" stroke-width="3"/><path d="M9 9v11"/>',
  merge:'<path d="M4 6v12M20 6v12"/><path d="M7 12h3M14 12h3"/><path d="m8 9 3 3-3 3M16 9l-3 3 3 3"/>',
  unmerge:'<path d="M12 5v14"/><path d="M4 12h5M15 12h5"/><path d="m7 9-3 3 3 3M17 9l3 3-3 3"/>',
  toggleBlock:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m9 10 3 3 3-3"/>',
  alignCenter:'<path d="M21 6H3M17 12H7M19 18H5"/>',
  alignRight:'<path d="M21 6H3M21 12H9M21 18H7"/>',
  alignJustify:'<path d="M3 6h18M3 12h18M3 18h18"/>',
  link:'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  unlink:'<path d="m18.84 12.25 1.72-1.71h-.02a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="m5.17 11.75-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71"/><path d="M8 2v3M2 8h3M16 22v-3M22 16h-3"/>',
  external:'<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  quote:'<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.76-2.02-2-2H4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .01-1 1.03V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.76-2.02-2-2h-4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>',
  bulb:'<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  success:'<circle cx="12" cy="12" r="10"/><path d="m8.5 12.2 2.4 2.4 4.8-4.9"/>',
  warn:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  error:'<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  note:'<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  prompt:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M7.5 8.5h9M7.5 12.5h5"/>',
  codeblock:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m10 10-2 2 2 2M14 10l2 2-2 2"/>',
  table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M10 4v16"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  hr:'<path d="M3 12h18"/><path d="M8 6h8M8 18h8" opacity=".35"/>',
  close:'<path d="M18 6 6 18M6 6l12 12"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  arrowUp:'<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  trash:'<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  copy:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  more:'<circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/><circle cx="5" cy="12" r="1.2" fill="currentColor"/>',
  text:'<path d="M4 7V5h16v2"/><path d="M9 19h6M12 5v14"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon:'<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  monitor:'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  print:'<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  markdown:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 15V9l3 3 3-3v6M16 9v6M14 13l2 2 2-2"/>',
  html:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/><path d="m10 12-2 2 2 2M14 12l2 2-2 2"/>',
  expand:'<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  headerRow:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18" stroke-width="3.2"/>',
  rowAbove:'<rect x="3" y="12" width="18" height="8" rx="2"/><path d="M12 3v6M9 6h6"/>',
  rowBelow:'<rect x="3" y="4" width="18" height="8" rx="2"/><path d="M12 15v6M9 18h6"/>',
  colLeft:'<rect x="12" y="3" width="8" height="18" rx="2"/><path d="M3 12h6M6 9v6"/>',
  colRight:'<rect x="4" y="3" width="8" height="18" rx="2"/><path d="M15 12h6M18 9v6"/>',
  delRow:'<rect x="3" y="8" width="18" height="8" rx="2"/><path d="m10 10 4 4M14 10l-4 4"/>',
  delCol:'<rect x="8" y="3" width="8" height="18" rx="2"/><path d="m10 10 4 4M14 10l-4 4"/>',
  duplicate:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>',
  file:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/>',
};
function icon(name, cls) {
  return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[name] || '') + '</svg>';
}
function fillIcons(root) {
  $$('[data-icon]', root).forEach(el => {
    if (el.dataset.iconDone) return;
    el.dataset.iconDone = '1';
    el.innerHTML = icon(el.dataset.icon, el.dataset.cls);
    el.style.display = 'contents';
  });
}

/* ═══════════════════════════ УТИЛІТИ ═══════════════════════════ */
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function uid(p) { return (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
const nodeLen = n => (n.nodeType === 3 ? n.length : n.childNodes.length);
const elOf = n => (n && n.nodeType === 3 ? n.parentNode : n);
const ZW = /[​﻿]/g;

const INLINE_TAGS = new Set(['A','B','STRONG','I','EM','U','S','STRIKE','DEL','INS','CODE','SPAN','FONT','SUB','SUP','BR','MARK','KBD','SMALL','BIG','ABBR','Q','CITE','TIME','LABEL','WBR']);
const MERGEABLE = new Set(['P','H1','H2','H3']);
const isInlineNode = n => n.nodeType === 3 || (n.nodeType === 1 && INLINE_TAGS.has(n.tagName));
const isTcBlock = el => !!(el && el.nodeType === 1 && el.classList.contains('tc-block'));
const isCode = el => !!(el && el.nodeType === 1 && el.tagName === 'PRE');
const isAtomic = el => !!(el && el.nodeType === 1 && (el.tagName === 'TABLE' || el.tagName === 'FIGURE' || el.tagName === 'HR' || el.tagName === 'PRE' || isTcBlock(el)));
const isSplittable = el => !!(el && el.nodeType === 1 && /^(P|H1|H2|H3|UL|OL|BLOCKQUOTE)$/.test(el.tagName));
const isContainerEl = el => el === editor || isTcBlock(el) || (el && el.tagName === 'BLOCKQUOTE');

function isEmptyBlock(el) {
  if (!el) return true;
  if (el.nodeType === 3) return !el.data.replace(ZW, '').trim();
  if (el.nodeType !== 1) return true;
  if (isAtomic(el) || el.tagName === 'IMG') return false;
  if (el.querySelector('img,hr,table,figure,pre,.tc-block')) return false;
  return !el.textContent.replace(ZW, '').trim();
}
function closestIn(node, sel) {
  const el = elOf(node);
  if (!el || el.nodeType !== 1) return null;
  const c = el.closest(sel);
  return c && c !== editor && editor.contains(c) ? c : null;
}
function topLevelOf(n) {
  while (n && n.parentNode && n.parentNode !== editor) n = n.parentNode;
  return n && n.parentNode === editor ? n : null;
}
function pointNode(c, o, side) {
  if (c.nodeType === 1 && c.childNodes.length) {
    if (side === 'end') return c.childNodes[Math.max(0, o - 1)] || c.lastChild;
    return c.childNodes[Math.min(o, c.childNodes.length - 1)];
  }
  return c;
}
function topLevelAtPoint(c, o, side) {
  if (c === editor) return pointNode(c, o, side);
  return topLevelOf(c);
}
// Контейнер (editor / tc-block / blockquote) і його прямий нащадок, у якому точка.
function unitAt(node) {
  let el = elOf(node);
  if (!el) return null;
  if (el === editor) return { container: editor, child: null };
  let child = el, p = el.parentNode;
  while (p && !isContainerEl(p)) { child = p; p = p.parentNode; }
  if (!p) return null;
  return { container: p, child };
}
function unitAtPoint(c, o) {
  const n = pointNode(c, o, 'start');
  if (n === editor) return { container: editor, child: null };
  return unitAt(n);
}
function textBlockOf(node) {
  const el = elOf(node);
  if (!el || el.nodeType !== 1) return null;
  const b = el.closest('p,h1,h2,h3,h4,h5,h6,li,td,th,figcaption');
  return b && editor.contains(b) && b !== editor ? b : null;
}
function emptyP() { const p = document.createElement('p'); p.appendChild(document.createElement('br')); return p; }

/* ═══════════════════════════ ВИДІЛЕННЯ ═══════════════════════════ */
let lastRange = null;
function editorRange() {
  const s = window.getSelection();
  if (s && s.rangeCount) {
    const r = s.getRangeAt(0);
    if (editor.contains(r.startContainer) && editor.contains(r.endContainer)) return r;
  }
  return null;
}
function setSel(r) {
  const s = window.getSelection();
  s.removeAllRanges();
  s.addRange(r);
  lastRange = r.cloneRange();
}
function focusEditor() {
  if (document.activeElement !== editor) {
    const y = scrollArea.scrollTop;
    editor.focus({ preventScroll: true });
    scrollArea.scrollTop = y;
  }
}
// Поточний діапазон у редакторі; якщо фокус пішов на кнопку/меню — відновлює останній.
function getRange() {
  const r = editorRange();
  if (r) return r;
  if (lastRange && editor.contains(lastRange.startContainer) && editor.contains(lastRange.endContainer)) {
    focusEditor();
    setSel(lastRange.cloneRange());
    return editorRange();
  }
  return null;
}
function caretAt(node, offset) {
  const r = document.createRange();
  r.setStart(node, clamp(offset, 0, nodeLen(node)));
  r.collapse(true);
  focusEditor();
  setSel(r);
}
function caretStart(el) {
  if (!el) return;
  let n = el;
  while (n.firstChild && n.firstChild.nodeType === 1 && !/^(BR|IMG|HR)$/.test(n.firstChild.tagName)) n = n.firstChild;
  if (n.firstChild && n.firstChild.nodeType === 3) caretAt(n.firstChild, 0);
  else caretAt(n, 0);
}
function caretEnd(el) {
  if (!el) return;
  if (isCode(el)) { placeCaretInBlock(el, 'end'); return; }
  let n = el;
  while (n.lastChild && n.lastChild.nodeType === 1 && !/^(BR|IMG|HR)$/.test(n.lastChild.tagName)) n = n.lastChild;
  const last = n.lastChild;
  if (!last) caretAt(n, 0);
  else if (last.nodeType === 3) caretAt(last, last.length);
  else if (last.tagName === 'BR') caretAt(n, Array.prototype.indexOf.call(n.childNodes, last));
  else caretAt(n, n.childNodes.length);
}
function caretAfterNode(node) {
  const r = document.createRange();
  if (node.nodeType === 3) r.setStart(node, node.length); else r.setStartAfter(node);
  r.collapse(true);
  focusEditor();
  setSel(r);
}
function caretInCodeAt(code, offset) {
  const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
  let n, left = offset, last = null;
  while ((n = walker.nextNode())) {
    last = n;
    if (left <= n.length) { caretAt(n, left); return; }
    left -= n.length;
  }
  if (last) caretAt(last, last.length); else caretAt(code, 0);
}
function saveSelNodes() {
  const r = editorRange();
  if (!r) return null;
  return { sc: r.startContainer, so: r.startOffset, ec: r.endContainer, eo: r.endOffset };
}
function restoreSelNodes(s, map) {
  if (!s) return;
  const sc = (map && map.get(s.sc)) || s.sc;
  const ec = (map && map.get(s.ec)) || s.ec;
  if (!editor.contains(sc) || !editor.contains(ec)) return;
  try {
    const r = document.createRange();
    r.setStart(sc, Math.min(s.so, nodeLen(sc)));
    r.setEnd(ec, Math.min(s.eo, nodeLen(ec)));
    if (document.activeElement === editor || editor.contains(document.activeElement)) setSel(r);
    else lastRange = r;
  } catch (e) { /* позиція більше не існує — лишаємо як є */ }
}
function nodePath(node) {
  const path = [];
  while (node && node !== editor) {
    const p = node.parentNode;
    if (!p) return null;
    path.unshift(Array.prototype.indexOf.call(p.childNodes, node));
    node = p;
  }
  return node === editor ? path : null;
}
function nodeFromPath(path) {
  let n = editor;
  for (const i of path) { n = n.childNodes[i]; if (!n) return null; }
  return n;
}
function serializeSel() {
  let r = editorRange();
  if (!r && lastRange && editor.contains(lastRange.startContainer)) r = lastRange;
  if (!r) return null;
  const sp = nodePath(r.startContainer), ep = nodePath(r.endContainer);
  if (!sp || !ep) return null;
  return { sp, so: r.startOffset, ep, eo: r.endOffset };
}
function restoreSel(s) {
  const fallback = () => { const f = editor.querySelector('p,h1,h2,h3,li'); if (f) caretEnd(f); };
  if (!s) { fallback(); return; }
  const sn = nodeFromPath(s.sp), en = nodeFromPath(s.ep);
  if (!sn || !en) { fallback(); return; }
  try {
    const r = document.createRange();
    r.setStart(sn, Math.min(s.so, nodeLen(sn)));
    r.setEnd(en, Math.min(s.eo, nodeLen(en)));
    focusEditor();
    setSel(r);
  } catch (e) { fallback(); }
}
function atStart(el, r) {
  const x = document.createRange();
  x.selectNodeContents(el);
  try { x.setEnd(r.startContainer, r.startOffset); } catch (e) { return false; }
  const f = x.cloneContents();
  return !f.textContent.replace(ZW, '').length && !f.querySelector('img,br');
}
function atEnd(el, r) {
  const x = document.createRange();
  x.selectNodeContents(el);
  try { x.setStart(r.endContainer, r.endOffset); } catch (e) { return false; }
  const f = x.cloneContents();
  return !f.textContent.replace(ZW, '').length && !f.querySelector('img');
}
function textBefore(el, r) {
  const x = document.createRange();
  x.selectNodeContents(el);
  x.setEnd(r.startContainer, r.startOffset);
  return x.toString();
}
function crossesBlocks(r) {
  if (r.collapsed) return false;
  const a = textBlockOf(r.startContainer), b = textBlockOf(r.endContainer);
  if (a !== b) return true;
  return closestIn(r.startContainer, 'pre') !== closestIn(r.endContainer, 'pre');
}
function ensureCaretVisible() {
  const r = editorRange();
  if (!r) return;
  let rect = r.getClientRects()[0] || elOf(r.startContainer).getBoundingClientRect();
  if (!rect) return;
  const area = scrollArea.getBoundingClientRect();
  if (rect.bottom > area.bottom - 40) scrollArea.scrollTop += rect.bottom - area.bottom + 80;
  else if (rect.top < area.top + 20) scrollArea.scrollTop -= area.top - rect.top + 60;
}

/* ═══════════════════════════ ІСТОРІЯ ЗМІН (UNDO/REDO) ═══════════════════════════ */
const History = {
  stack: [], index: -1, timer: null, burstStart: 0, max: 250,
  snap() { return { html: editor.innerHTML, sel: serializeSel() }; },
  reset() {
    clearTimeout(this.timer); this.timer = null; this.burstStart = 0;
    this.stack = [this.snap()]; this.index = 0;
    updateUndoButtons();
  },
  // Запам'ятати позицію курсора ДО зміни — щоб Ctrl+Z повертав курсор туди, де була правка.
  touchSel() {
    const cur = this.stack[this.index];
    if (cur && cur.html === editor.innerHTML) { const s = serializeSel(); if (s) cur.sel = s; }
  },
  commit() {
    clearTimeout(this.timer); this.timer = null; this.burstStart = 0;
    const s = this.snap();
    const cur = this.stack[this.index];
    if (cur && cur.html === s.html) { if (s.sel) cur.sel = s.sel; return false; }
    this.stack.length = this.index + 1;
    this.stack.push(s);
    if (this.stack.length > this.max) this.stack.shift();
    this.index = this.stack.length - 1;
    updateUndoButtons();
    onContentChanged();
    return true;
  },
  schedule() {
    if (!this.burstStart) this.burstStart = Date.now();
    clearTimeout(this.timer);
    if (Date.now() - this.burstStart > 2500) { this.commit(); return; }
    this.timer = setTimeout(() => this.commit(), 450);
  },
  undo() {
    if (Tabs.readOnly) return;
    this.commit();
    if (this.index <= 0) { toast('Немає що скасовувати'); return; }
    this.index--;
    this.apply(this.stack[this.index]);
  },
  redo() {
    if (Tabs.readOnly) return;
    this.commit();
    if (this.index >= this.stack.length - 1) return;
    this.index++;
    this.apply(this.stack[this.index]);
  },
  apply(s) {
    UI.hideTransient();
    editor.innerHTML = s.html;
    restoreSel(s.sel);
    ensureCaretVisible();
    updateUndoButtons();
    onContentChanged();
  },
  canUndo() { return this.index > 0 || !!this.timer; },
  canRedo() { return this.index < this.stack.length - 1; },
};
function updateUndoButtons() {
  const u = $('#btnUndo'), r = $('#btnRedo');
  if (u) u.disabled = !History.canUndo();
  if (r) r.disabled = !History.canRedo();
}

// Обгортка для будь-якої структурної дії: знімок ДО, дія, нормалізація, знімок ПІСЛЯ.
// Якщо дія впала з помилкою — документ повертається до стану до неї.
function mutate(fn) {
  if (Tabs.readOnly) { toast('Документ редагується в іншій вкладці — натисніть «Редагувати тут»'); return undefined; }
  History.commit();
  let res;
  try {
    res = fn();
  } catch (err) {
    console.error(err);
    const cur = History.stack[History.index];
    if (cur) { editor.innerHTML = cur.html; restoreSel(cur.sel); }
    toast('Не вдалося виконати дію — зміни скасовано', 'err');
    return undefined;
  }
  normalize();
  History.commit();
  UI.refreshSoon();
  return res;
}
