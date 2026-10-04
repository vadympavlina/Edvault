// TextCraft · Edvault — Клавіатура, миша, перетягування.
// Файли підключаються звичайними <script> по черзі й мають спільну глобальну область видимості.
'use strict';

/* ═══════════════════════════ КЛАВІАТУРА ═══════════════════════════ */
function codeIndent(pre, r, back) {
  const code = pre.querySelector('code');
  const text = code.textContent;
  const start = textBefore(code, r).length;
  const end = start + r.toString().length;
  if (r.collapsed && !back) { insertTextAtCaret('  '); normalize(); History.schedule(); onTyped(); return; }
  mutate(() => {
    let ls = text.lastIndexOf('\n', start - 1) + 1;
    const lines = [];
    let p = ls;
    while (p <= Math.max(start, end - 1) && p < text.length) { lines.push(p); const nx = text.indexOf('\n', p); if (nx < 0) break; p = nx + 1; }
    let out = text, delta = 0, firstDelta = 0;
    lines.slice().reverse().forEach((pos, idx) => {
      if (back) { const m = out.slice(pos).match(/^( {1,2}|\t)/); if (m) { out = out.slice(0, pos) + out.slice(pos + m[0].length); delta -= m[0].length; if (idx === lines.length - 1) firstDelta = -Math.min(m[0].length, start - pos); } }
      else { out = out.slice(0, pos) + '  ' + out.slice(pos); delta += 2; if (idx === lines.length - 1) firstDelta = 2; }
    });
    code.textContent = out;
    const tn = code.firstChild;
    const x = document.createRange();
    x.setStart(tn, clamp(start + firstDelta, 0, out.length));
    x.setEnd(tn, clamp(end + delta, 0, out.length));
    setSel(x);
  });
}
editor.addEventListener('keydown', e => {
  if (Slash.onKey(e)) return;
  if (UI.selectedFigure && UI.figureKey(e)) return;
  const mod = e.ctrlKey || e.metaKey;
  const code = e.code;
  if (mod && !e.altKey) {
    switch (code) {
      case 'KeyZ': e.preventDefault(); if (e.shiftKey) History.redo(); else History.undo(); return;
      case 'KeyY': if (!e.shiftKey && !IS_MAC) { e.preventDefault(); History.redo(); return; } break;
      case 'KeyB': e.preventDefault(); run('bold'); return;
      case 'KeyI': e.preventDefault(); run('italic'); return;
      case 'KeyU': e.preventDefault(); run('underline'); return;
      case 'KeyK': e.preventDefault(); run('link'); return;
      case 'KeyE': e.preventDefault(); run('code'); return;
      case 'Backslash': e.preventDefault(); run('clear'); return;
      case 'KeyS': if (e.shiftKey) { e.preventDefault(); run('strike'); return; } break;
      case 'Digit7': if (e.shiftKey) { e.preventDefault(); run('ol'); return; } break;
      case 'Digit8': if (e.shiftKey) { e.preventDefault(); run('ul'); return; } break;
      case 'Digit9': if (e.shiftKey) { e.preventDefault(); run('check'); return; } break;
      case 'KeyA': {
        const r = editorRange();
        const pre = r && closestIn(r.startContainer, 'pre');
        if (pre) { e.preventDefault(); const c = pre.querySelector('code'); const x = document.createRange(); x.setStart(c.firstChild, 0); x.setEnd(c.firstChild, Math.max(0, c.textContent.length - 1)); setSel(x); return; }
        break;
      }
      case 'Enter': {
        const r = editorRange();
        const blk = r && closestIn(r.startContainer, 'pre,.tc-block,blockquote');
        if (blk) { e.preventDefault(); mutate(() => caretAfterBlock(blk)); return; }
        break;
      }
    }
  }
  if (mod && e.altKey && /^Digit[0-3]$/.test(code)) { e.preventDefault(); run(code === 'Digit0' ? 'p' : 'h' + code.slice(5)); return; }
  if (e.altKey && e.shiftKey && (code === 'ArrowUp' || code === 'ArrowDown')) { e.preventDefault(); moveBlock(code === 'ArrowUp' ? -1 : 1); return; }
  if (e.key === 'Tab' && !mod) {
    const r = getRange();
    if (!r) return;
    e.preventDefault();
    const pre = closestIn(r.startContainer, 'pre');
    if (pre) { codeIndent(pre, r, e.shiftKey); return; }
    const cell = closestIn(r.startContainer, 'td,th');
    if (cell) { tableTab(cell, e.shiftKey); return; }
    const li = closestIn(r.startContainer, 'li');
    if (li) {
      mutate(() => {
        const saved = saveSelNodes();
        const lis = textBlocksInRange(r).filter(x => x.tagName === 'LI');
        (lis.length ? lis : [li]).forEach(x => { if (e.shiftKey) outdentLi(x); else indentLi(x); });
        restoreSelNodes(saved);
      });
      return;
    }
    return;
  }
  if (e.key === 'ArrowUp' && !e.shiftKey && !mod) {
    const r = editorRange();
    if (!r || !r.collapsed) return;
    const top = topLevelOf(r.startContainer);
    if (!top || top !== editor.firstElementChild || !isAtomic(top)) return;
    let atTop = false;
    if (isCode(top)) atTop = !textBefore(top.querySelector('code'), r).includes('\n');
    else if (top.tagName === 'TABLE') atTop = closestIn(r.startContainer, 'tr') === top.rows[0];
    else if (isTcBlock(top)) { const fb = firstTextBlock(top); const cr = r.getClientRects()[0]; atTop = fb.contains(elOf(r.startContainer)) && (!cr || cr.top - fb.getBoundingClientRect().top < parseFloat(getComputedStyle(fb).lineHeight) * 0.9); }
    else atTop = true;
    if (atTop) { e.preventDefault(); mutate(() => { const p = emptyP(); top.before(p); caretStart(p); }); }
  }
});
document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.code === 'KeyS') { e.preventDefault(); History.commit(); saveNow().then(() => { if (!state.error) toast('Збережено в браузері', 'ok'); }); return; }
  if (e.key === 'Escape') {
    if ($('#lightbox').classList.contains('open')) { $('#lightbox').classList.remove('open'); return; }
    if (Pop.isOpen()) { Pop.close(); return; }
    if (Modal.isOpen()) { Modal.close(); return; }
    if ($('#drawer').classList.contains('open')) { closeDrawer(); return; }
    if ($('#toc').classList.contains('open')) { $('#toc').classList.remove('open'); return; }
    if (Slash.open) { Slash.close(); return; }
    ['#selBar', '#linkBar'].forEach(s => $(s).classList.remove('show'));
  }
  if (e.key === 'Enter' && $('#linkModal').classList.contains('open') && (e.target.id === 'linkUrl' || e.target.id === 'linkText')) { e.preventDefault(); confirmLink(); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && UI.selectedFigure && document.activeElement !== editor && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); UI.deleteSelectedFigure(); }
});

/* ═══════════════════════════ МИША / DRAG & DROP ═══════════════════════════ */
editor.addEventListener('mousedown', e => {
  const img = e.target.closest && e.target.closest('img');
  if (img && editor.contains(img)) {
    e.preventDefault();
    const fig = img.closest('figure');
    UI.selectFigure(fig);
    if (e.button === 0 && fig) startFigureDrag(e, fig);
    return;
  }
  if (UI.selectedFigure) UI.deselectFigure();
  const tg = e.target.closest && e.target.closest('.tc-toggle');
  if (tg && editor.contains(tg) && e.target === tg) {
    const rect = tg.getBoundingClientRect();
    if (e.clientX < rect.left + 40 && e.clientY < rect.top + 40) { e.preventDefault(); toggleCollapsed(tg); return; }
  }
  const li = e.target.closest && e.target.closest('ul.tc-checklist > li');
  if (li && editor.contains(li) && e.target === li) {
    const rect = li.getBoundingClientRect();
    const cs = getComputedStyle(li);
    const pad = parseFloat(cs.paddingLeft) || 28;
    const lh = parseFloat(cs.lineHeight) || 26;
    if (e.clientX < rect.left + pad && e.clientY < rect.top + lh + 4) {
      e.preventDefault();
      mutate(() => { li.dataset.checked = li.dataset.checked === 'true' ? 'false' : 'true'; });
    }
  }
});
editor.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[href]');
  if (a && editor.contains(a) && (e.ctrlKey || e.metaKey)) { e.preventDefault(); window.open(a.href, '_blank', 'noopener'); }
});
editor.addEventListener('dblclick', e => { const img = e.target.closest && e.target.closest('img'); if (img) openLightbox(img.src); });
// Перетягування фото мишкою в інше місце документа.
// Для фото з обтіканням ліва/права половина сторінки ще й вибирає бік.
function startFigureDrag(e0, fig) {
  const x0 = e0.clientX, y0 = e0.clientY;
  const line = $('#figDrop');
  let active = false, target = null, side = fig.dataset.wrap || '';
  const blocks = () => Array.from(editor.children).filter(c => c !== fig);
  const move = e => {
    if (!active) {
      if (Math.hypot(e.clientX - x0, e.clientY - y0) < 6) return;
      active = true;
      document.body.classList.add('fig-dragging');
      $('#imgBar').classList.remove('show');
    }
    const ed = editor.getBoundingClientRect();
    const cs = getComputedStyle(editor);
    const left = ed.left + parseFloat(cs.paddingLeft), right = ed.right - parseFloat(cs.paddingRight);
    target = null;
    let y = null;
    const list = blocks();
    for (const c of list) { const r = c.getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { target = c; y = r.top - 4; break; } }
    if (!target && list.length) y = list[list.length - 1].getBoundingClientRect().bottom + 4;
    if (fig.dataset.wrap) side = e.clientX < (left + right) / 2 ? 'left' : 'right';
    const w = fig.dataset.wrap ? (right - left) * 0.42 : right - left;
    line.style.top = y + 'px';
    line.style.width = w + 'px';
    line.style.left = (fig.dataset.wrap && side === 'right' ? right - w : left) + 'px';
    line.style.display = 'block';
    // автопрокрутка біля країв
    const area = scrollArea.getBoundingClientRect();
    if (e.clientY < area.top + 40) scrollArea.scrollTop -= 14; else if (e.clientY > area.bottom - 40) scrollArea.scrollTop += 14;
  };
  const up = () => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    line.style.display = 'none';
    document.body.classList.remove('fig-dragging');
    if (!active) return;
    const sameSpot = target === fig.nextElementSibling || (!target && !fig.nextElementSibling);
    if (sameSpot && side === (fig.dataset.wrap || '')) { UI.positionFigure(); return; }
    mutate(() => {
      if (target) target.before(fig); else editor.appendChild(fig);
      if (fig.dataset.wrap) fig.dataset.wrap = side;
    });
    UI.selectedFigure = null;
    UI.selectFigure(fig);
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}
let internalDrag = false;
editor.addEventListener('dragstart', () => { internalDrag = true; });
document.addEventListener('dragend', () => { internalDrag = false; });
const hasFiles = e => !!(e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files'));
function rangeFromPoint(x, y) {
  let r = null;
  if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(x, y);
  else if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); if (p) { r = document.createRange(); r.setStart(p.offsetNode, p.offset); r.collapse(true); } }
  return r && editor.contains(r.startContainer) ? r : null;
}
scrollArea.addEventListener('dragover', e => { if (hasFiles(e)) { e.preventDefault(); $('#dropHint').classList.add('show'); } });
scrollArea.addEventListener('dragleave', e => { if (!e.relatedTarget || !scrollArea.contains(e.relatedTarget)) $('#dropHint').classList.remove('show'); });
scrollArea.addEventListener('drop', e => {
  $('#dropHint').classList.remove('show');
  const dt = e.dataTransfer;
  if (!dt) return;
  const files = Array.from(dt.files || []).filter(f => f.type.startsWith('image/'));
  if (files.length) { e.preventDefault(); insertImages(files, rangeFromPoint(e.clientX, e.clientY)); return; }
  if (hasFiles(e)) { e.preventDefault(); const f = dt.files[0]; if (f && /\.(html?|md|markdown|txt)$/i.test(f.name)) importFile(f); return; }
  if (internalDrag) { internalDrag = false; setTimeout(() => { normalize(); History.commit(); }, 0); return; }
  const html = dt.getData('text/html'), text = dt.getData('text/plain');
  if (html || text) {
    e.preventDefault();
    const r = rangeFromPoint(e.clientX, e.clientY);
    if (!r) return;
    focusEditor(); setSel(r);
    mutate(() => { const nodes = html ? sanitizeHTML(html) : []; if (nodes.length) pasteNodes(nodes); else pastePlainText(text); });
  }
});
window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('drop', e => { if (hasFiles(e)) e.preventDefault(); });
