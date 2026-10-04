// TextCraft · Edvault — Обробка набору: Enter, Backspace, Markdown-скорочення, нормалізація під час друку.
// Файли підключаються звичайними <script> по черзі й мають спільну глобальну область видимості.
'use strict';

/* ═══════════════════════════ ОБРОБКА ВВЕДЕННЯ ═══════════════════════════ */
function insertTextAtCaret(text) {
  const r = getRange();
  if (!r) return;
  if (!r.collapsed) r.deleteContents();
  const c = r.startContainer, o = r.startOffset;
  if (c.nodeType === 3) { c.insertData(o, text); caretAt(c, o + text.length); return; }
  const tn = document.createTextNode(text);
  const ref = c.childNodes[o] || null;
  if (ref && ref.nodeName === 'BR' && c.childNodes.length === 1) c.replaceChild(tn, ref);
  else c.insertBefore(tn, ref);
  caretAt(tn, tn.length);
}
let execGuard = false;
function onEnter(e, r) {
  const pre = closestIn(r.startContainer, 'pre');
  if (pre) { e.preventDefault(); codeNewline(pre, r, true); return; }
  const cap = closestIn(r.startContainer, 'figcaption');
  if (cap) { e.preventDefault(); mutate(() => caretAfterBlock(cap.closest('figure'))); return; }
  if (closestIn(r.startContainer, 'td,th')) { e.preventDefault(); mutate(() => exec('insertLineBreak')); return; }
  if (!r.collapsed && crossesBlocks(r)) {
    e.preventDefault();
    mutate(() => { deleteRangeSmart(getRange()); execGuard = true; exec('insertParagraph'); execGuard = false; });
    return;
  }
  const tb = textBlockOf(r.startContainer);
  if (!tb || !r.collapsed) return;
  if (tb.tagName === 'LI' && isEmptyBlock(tb) && !tb.querySelector('ul,ol')) {
    e.preventDefault();
    mutate(() => { const li = tb; const nested = li.parentNode.parentNode && li.parentNode.parentNode.tagName === 'LI'; if (nested) { outdentLi(li); caretStart(li); } else { const p = liToParagraph(li); if (p) caretStart(p); } });
    return;
  }
  if (tb.tagName === 'P') {
    const txt = tb.textContent.replace(ZW, '').trim();
    if (/^```[\w#+.-]*$/.test(txt) && tb.parentNode === editor) {
      e.preventDefault();
      mutate(() => { const pre2 = makeCodeBlock('', txt.slice(3)); tb.replaceWith(pre2); placeCaretInBlock(pre2, 'start'); });
      return;
    }
    if ((txt === '---' || txt === '***' || txt === '___') && tb.parentNode === editor) {
      e.preventDefault();
      mutate(() => { const hr = document.createElement('hr'); tb.replaceWith(hr); caretAfterBlock(hr); });
      return;
    }
  }
  const parent = tb.parentNode;
  // Промпт: Enter = новий рядок (як у чаті), Enter на порожньому рядку в кінці = вихід із блоку.
  if (parent && parent.classList && parent.classList.contains('tc-prompt') && tb.tagName === 'P') {
    e.preventDefault();
    if (tb === parent.lastElementChild && atEnd(tb, r) && (isEmptyBlock(tb) || lastLeafBeforeIsBr(tb, r))) {
      mutate(() => {
        if (isEmptyBlock(tb)) { if (parent.children.length === 1) { const p0 = emptyP(); parent.replaceWith(p0); caretStart(p0); return; } tb.remove(); }
        else { while (tb.lastChild && (tb.lastChild.nodeName === 'BR' || (tb.lastChild.nodeType === 3 && !tb.lastChild.data.replace(ZW, '')))) tb.lastChild.remove(); }
        const p = emptyP(); parent.after(p); caretStart(p);
      });
      return;
    }
    mutate(() => insertBrAtCaret());
    return;
  }
  if (isEmptyBlock(tb) && parent && (isTcBlock(parent) || parent.tagName === 'BLOCKQUOTE') && tb === parent.lastElementChild) {
    e.preventDefault();
    mutate(() => {
      const p = emptyP();
      if (parent.children.length === 1) parent.replaceWith(p);
      else { tb.remove(); parent.after(p); }
      caretStart(p);
    });
    return;
  }
  if (/^H[1-3]$/.test(tb.tagName) && atEnd(tb, r)) {
    // Enter у кінці заголовка — завжди звичайний абзац (браузери інколи продовжують заголовок)
    e.preventDefault();
    mutate(() => { const p = emptyP(); tb.after(p); caretStart(p); });
    return;
  }
}
function insertBrAtCaret() {
  const r = getRange();
  if (!r) return;
  if (!r.collapsed) r.deleteContents();
  const br = document.createElement('br');
  r.insertNode(br);
  let after = br.nextSibling;
  while (after && after.nodeType === 3 && !after.data) after = after.nextSibling;
  if (!after) br.after(document.createElement('br'));
  const x = document.createRange();
  x.setStartAfter(br);
  x.collapse(true);
  setSel(x);
}
function lastLeafBeforeIsBr(tb, r) {
  const x = document.createRange();
  x.selectNodeContents(tb);
  x.setEnd(r.startContainer, r.startOffset);
  let n = x.cloneContents();
  while (n && n.lastChild) {
    let c = n.lastChild;
    while (c && c.nodeType === 3 && !c.data.replace(ZW, '')) c = c.previousSibling;
    if (!c) return false;
    if (c.nodeName === 'BR') return true;
    if (c.nodeType === 3) return /\n$/.test(c.data);
    n = c;
  }
  return false;
}
function codeNewline(pre, r, isEnter) {
  const code = pre.querySelector('code');
  if (!code) return;
  const before = textBefore(code, r);
  const all = code.textContent;
  const after = all.slice(before.length + (r.collapsed ? 0 : r.toString().length));
  // Enter на порожньому останньому рядку — вихід з блоку коду
  if (isEnter && r.collapsed && after === '\n' && (before === '' ? false : before.endsWith('\n'))) {
    mutate(() => {
      code.textContent = before.replace(/\n$/, '') + '\n';
      caretAfterBlock(pre);
    });
    return;
  }
  const line = before.slice(before.lastIndexOf('\n') + 1);
  const indent = (line.match(/^[ \t]*/) || [''])[0];
  insertTextAtCaret('\n' + indent);
  normalize();
  History.schedule();
  onTyped();
}
function onDelete(e, r, backward) {
  if (!r.collapsed) {
    if (crossesBlocks(r)) { e.preventDefault(); mutate(() => deleteRangeSmart(getRange())); }
    return;
  }
  const pre = closestIn(r.startContainer, 'pre');
  if (pre) {
    const code = pre.querySelector('code');
    const before = textBefore(code, r);
    const all = code.textContent;
    if (backward && before.length === 0) {
      e.preventDefault();
      if (!all.replace(/\n/g, '')) mutate(() => { const p = emptyP(); pre.replaceWith(p); caretStart(p); });
      else mutate(() => unwrapBlock(pre));
      return;
    }
    if (!backward && before.length >= all.length - 1) { e.preventDefault(); return; }
    return;
  }
  const cap = closestIn(r.startContainer, 'figcaption');
  if (cap) { if (backward ? atStart(cap, r) : atEnd(cap, r)) e.preventDefault(); return; }
  const cell = closestIn(r.startContainer, 'td,th');
  if (cell) { if (backward ? atStart(cell, r) : atEnd(cell, r)) e.preventDefault(); return; }
  const tb = textBlockOf(r.startContainer);
  if (!tb) return;
  if (tb.tagName === 'LI') {
    if (backward && atStart(tb, r)) {
      e.preventDefault();
      mutate(() => {
        const saved = saveSelNodes();
        const m = new Map();
        const p = liToParagraph(tb, m);
        if (p) { restoreSelNodes(saved, m); if (!editorRange()) caretStart(p); }
      });
    }
    return;
  }
  if (backward && atStart(tb, r)) {
    const parent = tb.parentNode;
    if ((isTcBlock(parent) || parent.tagName === 'BLOCKQUOTE') && tb === parent.firstElementChild) {
      e.preventDefault();
      mutate(() => {
        if (isEmptyBlock(parent)) { const p = emptyP(); parent.replaceWith(p); caretStart(p); }
        else unwrapBlock(parent);
      });
      return;
    }
    if (/^H[1-3]$/.test(tb.tagName) && !(tb.tagName === 'H1' && tb === editor.firstElementChild && !isEmptyBlock(tb))) {
      e.preventDefault();
      mutate(() => {
        const saved = saveSelNodes();
        const p = document.createElement('p');
        while (tb.firstChild) p.appendChild(tb.firstChild);
        tb.replaceWith(p);
        const m = new Map([[tb, p]]);
        restoreSelNodes(saved, m);
        if (!editorRange()) caretStart(p);
      });
      return;
    }
    const prev = tb.previousElementSibling;
    if (!prev) return;
    e.preventDefault();
    if (prev.tagName === 'HR') { mutate(() => { prev.remove(); caretStart(tb); }); return; }
    if (prev.tagName === 'FIGURE') { if (isEmptyBlock(tb)) mutate(() => tb.remove()); UI.selectFigure(prev); return; }
    if (prev.tagName === 'TABLE') { if (isEmptyBlock(tb)) mutate(() => { tb.remove(); caretEnd(lastCell(prev)); }); else caretEnd(lastCell(prev)); return; }
    if (isCode(prev)) { if (isEmptyBlock(tb)) mutate(() => { tb.remove(); placeCaretInBlock(prev, 'end'); }); else placeCaretInBlock(prev, 'end'); return; }
    mutate(() => {
      if (!mergeBlocks(prev, tb)) {
        if (isEmptyBlock(tb)) { tb.remove(); placeCaretInBlock(prev, 'end'); } else placeCaretInBlock(prev, 'end');
      }
    });
    return;
  }
  if (!backward && atEnd(tb, r)) {
    const next = tb.nextElementSibling;
    if (!next) return;
    e.preventDefault();
    if (next.tagName === 'HR') { mutate(() => next.remove()); return; }
    if (next.tagName === 'FIGURE') { if (isEmptyBlock(tb)) mutate(() => tb.remove()); UI.selectFigure(next); return; }
    if (MERGEABLE.has(next.tagName)) { mutate(() => mergeBlocks(tb, next)); return; }
    if (isEmptyBlock(tb)) mutate(() => { tb.remove(); placeCaretInBlock(next, 'start'); });
    else if (next.tagName === 'UL' || next.tagName === 'OL') { const li = next.firstElementChild; if (li) mutate(() => { if (!isEmptyBlock(li)) { const tail = tb.lastChild; while (li.firstChild && li.firstChild.nodeName !== 'UL' && li.firstChild.nodeName !== 'OL') tb.appendChild(li.firstChild); if (!li.firstChild || isEmptyBlock(li)) li.remove(); if (tail) caretAfterNode(tail); } else li.remove(); }); }
    return;
  }
}
const MD_SHORTCUTS = { '#': 'h1', '##': 'h2', '###': 'h3', '-': 'ul', '*': 'ul', '+': 'ul', '1.': 'ol', '1)': 'ol', '>': 'quote', '[]': 'check', '[ ]': 'check' };
function tryMarkdownShortcut(r) {
  const tb = textBlockOf(r.startContainer);
  if (!tb || tb.tagName !== 'P' || closestIn(tb, 'td,th,figure,li')) return false;
  const before = textBefore(tb, r).replace(ZW, '');
  const act = MD_SHORTCUTS[before];
  if (!act) return false;
  if (act === 'quote' && tb.parentNode.tagName === 'BLOCKQUOTE') return false;
  mutate(() => {
    const del = document.createRange();
    del.selectNodeContents(tb);
    del.setEnd(r.startContainer, r.startOffset);
    del.deleteContents();
    if (isEmptyBlock(tb)) { tb.textContent = ''; tb.appendChild(document.createElement('br')); }
    caretStart(tb);
    applyItem(act);
  });
  return true;
}
function onInsertText(e, r) {
  const data = e.data == null ? '' : e.data;
  if (!r.collapsed && crossesBlocks(r)) {
    e.preventDefault();
    mutate(() => { deleteRangeSmart(getRange()); insertTextAtCaret(data); });
    return;
  }
  if (closestIn(r.startContainer, 'pre')) return;
  if (data === ' ' && r.collapsed && tryMarkdownShortcut(r)) { e.preventDefault(); return; }
}
// Швидка перевірка для звичайного набору: верхній рівень + поточний блок. Повна нормалізація — лише коли треба.
function needsFullNormalize() {
  for (let n = editor.firstChild; n; n = n.nextSibling) {
    if (n.nodeType !== 1) return true;
    if (!ALLOWED_TOP.has(n.tagName) && !isTcBlock(n)) return true;
  }
  const last = editor.lastElementChild;
  if (!last || isAtomic(last)) return true;
  const r = editorRange();
  if (!r) return true;
  const tb = textBlockOf(r.startContainer);
  if (!tb) return true;
  if (!tb.firstChild) return true;
  if (tb.querySelector('font,div,p,ul,ol,img,table,pre,figure')) return true;
  if (tb.firstElementChild === null && Array.from(tb.childNodes).every(x => x.nodeType === 3 && !x.data.length)) return true;
  const pre = closestIn(r.startContainer, 'pre');
  if (pre && pre.hasAttribute('data-empty') !== !pre.textContent.replace(/\n/g, '')) return true;
  return false;
}
function onTyped() {
  state.version++;
  markDirty();
  UI.refreshSoon();
}

editor.addEventListener('beforeinput', e => {
  const t = e.inputType || '';
  if (t === 'historyUndo') { e.preventDefault(); History.undo(); return; }
  if (t === 'historyRedo') { e.preventDefault(); History.redo(); return; }
  if (execGuard || e.isComposing || t === 'insertCompositionText') return;
  if (UI.selectedFigure) {
    // курсор «на картинці» — вводити текст у figure не даємо
    if (t.startsWith('delete')) { e.preventDefault(); UI.deleteSelectedFigure(); return; }
    if (t === 'insertParagraph') { e.preventDefault(); const f = UI.selectedFigure; UI.deselectFigure(); mutate(() => caretAfterBlock(f)); return; }
    const f = UI.selectedFigure; UI.deselectFigure(); caretAfterBlock(f);
  }
  const r = getRange();
  if (!r) return;
  if (!History.timer) History.touchSel();
  if (t === 'insertParagraph') { onEnter(e, r); return; }
  if (t === 'insertLineBreak') {
    const pre = closestIn(r.startContainer, 'pre');
    if (pre) { e.preventDefault(); codeNewline(pre, r, false); return; }
    if (closestIn(r.startContainer, 'figcaption')) { e.preventDefault(); return; }
    if (closestIn(r.startContainer, '.tc-prompt')) { e.preventDefault(); mutate(() => insertBrAtCaret()); return; }
    if (!r.collapsed && crossesBlocks(r)) { e.preventDefault(); mutate(() => { deleteRangeSmart(getRange()); execGuard = true; exec('insertLineBreak'); execGuard = false; }); }
    return;
  }
  if (t.startsWith('delete')) { onDelete(e, r, /Backward/.test(t)); return; }
  if (t === 'insertText' || t === 'insertReplacementText') { onInsertText(e, r); return; }
});
editor.addEventListener('input', e => {
  const t = e.inputType || '';
  if (e.isComposing) { History.schedule(); onTyped(); return; }
  if (t === 'insertParagraph') {
    const r = editorRange();
    const li = r && closestIn(r.startContainer, 'ul.tc-checklist > li');
    if (li) li.dataset.checked = 'false';
    if (r) { const h = closestIn(r.startContainer, 'h1,h2,h3'); if (h && h.previousElementSibling && h.previousElementSibling.id && h.previousElementSibling.id === h.id) h.removeAttribute('id'); }
  }
  if (!(/^(insertText|deleteContentBackward|deleteContentForward)$/.test(t) && !needsFullNormalize())) normalize();
  if (/^(insertText|insertCompositionText|insertReplacementText|deleteContent|deleteWord|deleteSoft|deleteHard|insertLineBreak|insertParagraph)/.test(t)) History.schedule();
  else History.commit();
  onTyped();
  Slash.check(t, e.data);
});
editor.addEventListener('compositionend', () => { normalize(); History.schedule(); onTyped(); });
