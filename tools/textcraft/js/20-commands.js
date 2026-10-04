// TextCraft · Edvault — Команди форматування: жирний, заголовки, списки, цитати, колір, розмір.
// Файли підключаються звичайними <script> по черзі й мають спільну глобальну область видимості.
'use strict';

/* ═══════════════════════════ ТЕКСТОВІ КОМАНДИ ═══════════════════════════ */
function inRestricted(r) { return !!closestIn(r.startContainer, 'pre,figcaption'); }
function exec(cmd, val) { try { return document.execCommand(cmd, false, val == null ? null : val); } catch (e) { return false; } }

function inlineCmd(cmd) {
  const r = getRange();
  if (!r || closestIn(r.startContainer, 'pre')) return;
  mutate(() => exec(cmd));
}
function blockTextCmd(fn) {
  const r = getRange();
  if (!r) return;
  if (inRestricted(r)) { toast('Недоступно всередині блоку коду чи підпису'); return; }
  mutate(fn);
}
// Блоки p/h1/h2/h3 у межах виділення (без комірок таблиць і підписів).
function textBlocksInRange(r) {
  let all = $$('p,h1,h2,h3,li', editor).filter(el => r.intersectsNode(el) && !el.closest('pre,figure,td,th'));
  all = all.filter(el => !all.some(o => o !== el && el.contains(o)));
  if (all.length > 1 && !r.collapsed) {
    const lastB = all[all.length - 1];
    if (atStart(lastB, { startContainer: r.endContainer, startOffset: r.endOffset })) all.pop();
  }
  if (all.length > 1 && !r.collapsed) {
    const firstB = all[0];
    if (atEnd(firstB, { endContainer: r.startContainer, endOffset: r.startOffset })) all.shift();
  }
  if (!all.length) { const tb = textBlockOf(r.startContainer); if (tb && /^(P|H1|H2|H3|LI)$/.test(tb.tagName)) all = [tb]; }
  return all;
}
function doSetBlockTag(tag) {
  let r = getRange();
  if (!r) return;
  let blocks = textBlocksInRange(r);
  const lis = blocks.filter(b => b.tagName === 'LI');
  if (lis.length) {
    const list = lis[0].parentNode;
    exec(list.tagName === 'OL' ? 'insertOrderedList' : 'insertUnorderedList');
    normalize();
    r = getRange();
    if (!r) return;
    blocks = textBlocksInRange(r);
  }
  const T = tag.toUpperCase();
  const all = blocks.filter(b => b.tagName !== 'LI');
  const target = (all.length && all.every(b => b.tagName === T) && T !== 'P') ? 'P' : T;
  const saved = saveSelNodes();
  const map = new Map();
  all.forEach(b => {
    if (b.tagName === target) return;
    const n = document.createElement(target);
    if (b.style.textAlign) n.style.textAlign = b.style.textAlign;
    while (b.firstChild) n.appendChild(b.firstChild);
    b.replaceWith(n);
    map.set(b, n);
  });
  restoreSelNodes(saved, map);
}
const listKindOf = l => (l.tagName === 'OL' ? 'ol' : (l.classList.contains('tc-checklist') ? 'check' : 'ul'));
function makeList(kind) {
  const l = document.createElement(kind === 'ol' ? 'ol' : 'ul');
  if (kind === 'check') l.className = 'tc-checklist';
  return l;
}
function retagList(l, kind, map) {
  let nl = l;
  const wantTag = kind === 'ol' ? 'OL' : 'UL';
  if (l.tagName !== wantTag) {
    nl = document.createElement(wantTag.toLowerCase());
    while (l.firstChild) nl.appendChild(l.firstChild);
    l.replaceWith(nl);
    if (map) map.set(l, nl);
  }
  if (kind === 'check') nl.className = 'tc-checklist'; else nl.removeAttribute('class');
  $$(':scope > li', nl).forEach(li => { if (kind === 'check') { if (!li.dataset.checked) li.dataset.checked = 'false'; } else li.removeAttribute('data-checked'); });
  return nl;
}
// Пункт списку → звичайний абзац (список розрізається навколо нього).
function liToParagraph(li, map) {
  const list = li.parentNode;
  if (list.parentNode && list.parentNode.tagName === 'LI') { outdentLi(li); return null; }
  const p = document.createElement('p');
  const nested = [];
  Array.from(li.childNodes).forEach(n => { if (n.nodeType === 1 && /^(UL|OL)$/.test(n.tagName)) nested.push(n); else p.appendChild(n); });
  if (!p.firstChild || isEmptyBlock(p) && !p.querySelector('br')) { p.textContent = ''; p.appendChild(document.createElement('br')); }
  if (map) map.set(li, p);
  const after = [];
  for (let n = li.nextElementSibling; n; n = n.nextElementSibling) after.push(n);
  li.remove();
  let ref = list;
  ref.after(p); ref = p;
  nested.forEach(x => { ref.after(x); ref = x; });
  if (after.length) {
    const tail = list.cloneNode(false);
    if (tail.tagName === 'OL') tail.setAttribute('start', String(list.children.length + 2 + (parseInt(list.getAttribute('start'), 10) || 1) - 1));
    after.forEach(x => tail.appendChild(x));
    ref.after(tail);
  }
  if (!list.children.length) list.remove();
  return p;
}
function indentLi(li) {
  const prev = li.previousElementSibling;
  if (!prev || prev.tagName !== 'LI') return false;
  const list = li.parentNode;
  let sub = prev.lastElementChild;
  if (!sub || sub.tagName !== list.tagName) { sub = list.cloneNode(false); sub.removeAttribute('start'); prev.appendChild(sub); }
  sub.appendChild(li);
  return true;
}
function outdentLi(li) {
  const list = li.parentNode;
  const parentLi = list.parentNode;
  if (!parentLi || parentLi.tagName !== 'LI') { liToParagraph(li); return; }
  const after = [];
  for (let n = li.nextElementSibling; n; n = n.nextElementSibling) after.push(n);
  if (after.length) { const sub = list.cloneNode(false); after.forEach(x => sub.appendChild(x)); li.appendChild(sub); }
  parentLi.after(li);
  if (!list.children.length) list.remove();
  if (li.parentNode && li.parentNode.classList.contains('tc-checklist') && !li.dataset.checked) li.dataset.checked = 'false';
  if (li.parentNode && !li.parentNode.classList.contains('tc-checklist')) li.removeAttribute('data-checked');
}
function doToggleList(kind) {
  const r = getRange();
  if (!r) return;
  const blocks = textBlocksInRange(r);
  if (!blocks.length) return;
  const saved = saveSelNodes();
  const map = new Map();
  const allLi = blocks.every(b => b.tagName === 'LI');
  if (allLi && blocks.every(li => listKindOf(li.parentNode) === kind)) {
    blocks.slice().forEach(li => { if (li.isConnected) liToParagraph(li, map); });
  } else {
    const lists = new Set();
    let curList = null;
    blocks.forEach(b => {
      if (b.tagName === 'LI') { lists.add(b.parentNode); curList = null; return; }
      const li = document.createElement('li');
      while (b.firstChild) li.appendChild(b.firstChild);
      if (!li.firstChild) li.appendChild(document.createElement('br'));
      if (kind === 'check') li.dataset.checked = 'false';
      map.set(b, li);
      if (curList && curList.nextElementSibling === b) { curList.appendChild(li); b.remove(); return; }
      const list = makeList(kind);
      b.replaceWith(list);
      list.appendChild(li);
      const prev = list.previousElementSibling;
      if (prev && /^(UL|OL)$/.test(prev.tagName) && listKindOf(prev) === kind) { while (list.firstChild) prev.appendChild(list.firstChild); list.remove(); curList = prev; }
      else curList = list;
    });
    lists.forEach(l => { if (l.isConnected) retagList(l, kind, map); });
    if (curList) {
      const next = curList.nextElementSibling;
      if (next && /^(UL|OL)$/.test(next.tagName) && listKindOf(next) === kind) { while (next.firstChild) curList.appendChild(next.firstChild); next.remove(); }
    }
  }
  restoreSelNodes(saved, map);
  if (!editorRange()) { const any = map.values().next().value; if (any && any.isConnected) caretEnd(any); }
}
function doToggleQuote() {
  const r = getRange();
  if (!r) return;
  const bq = closestIn(r.startContainer, 'blockquote');
  if (bq && (r.collapsed || bq.contains(r.endContainer))) {
    const saved = saveSelNodes();
    while (bq.firstChild) bq.before(bq.firstChild);
    bq.remove();
    restoreSelNodes(saved);
    return;
  }
  const su = unitAtPoint(r.startContainer, r.startOffset);
  const eu = unitAtPoint(r.endContainer, r.endOffset);
  if (!su || !su.child) return;
  const container = su.container;
  if (container.tagName === 'BLOCKQUOTE') return;
  const first = su.child;
  const last = (eu && eu.container === container && eu.child) ? eu.child : su.child;
  if (isAtomic(first) || isAtomic(last)) { toast('Цитатою можна зробити лише текст'); return; }
  const saved = saveSelNodes();
  const q = document.createElement('blockquote');
  first.before(q);
  let n = first;
  while (n) { const next = n.nextSibling; q.appendChild(n); if (n === last) break; n = next; }
  restoreSelNodes(saved);
}
function toggleInlineCode() {
  const r = getRange();
  if (!r || closestIn(r.startContainer, 'pre')) return;
  const code = closestIn(r.startContainer, 'code');
  if (code) {
    mutate(() => {
      const first = code.firstChild, last = code.lastChild;
      while (code.firstChild) code.before(code.firstChild);
      code.remove();
      if (first && last) { const x = document.createRange(); x.setStartBefore(first); x.setEndAfter(last); setSel(x); }
    });
    return;
  }
  if (r.collapsed) { toast('Виділіть текст, щоб оформити його як код'); return; }
  if (crossesBlocks(r)) { toast('Код у рядку — лише в межах одного абзацу'); return; }
  mutate(() => {
    const rr = getRange();
    const text = rr.toString();
    rr.deleteContents();
    const c = document.createElement('code');
    c.textContent = text;
    rr.insertNode(c);
    const x = document.createRange(); x.selectNodeContents(c); setSel(x);
  });
}
function clearFormatting() {
  const r = getRange();
  if (!r) return;
  if (r.collapsed) { toast('Виділіть текст, з якого треба прибрати форматування'); return; }
  mutate(() => {
    exec('removeFormat');
    exec('unlink');
    const rr = getRange();
    if (!rr) return;
    $$('code', editor).filter(c => rr.intersectsNode(c) && !c.closest('pre')).forEach(c => { while (c.firstChild) c.before(c.firstChild); c.remove(); });
    $$('span[style]', editor).filter(s => rr.intersectsNode(s)).forEach(s => { while (s.firstChild) s.before(s.firstChild); s.remove(); });
  });
}
function currentFontSize() {
  const r = editorRange() || lastRange;
  const el = r ? elOf(r.startContainer) : null;
  if (!el || !editor.contains(el)) return Math.round(parseFloat(getComputedStyle(editor).fontSize)) || 17;
  return Math.round(parseFloat(getComputedStyle(el.nodeType === 1 ? el : el.parentNode).fontSize)) || 17;
}
function setFontSize(px) {
  const r = getRange();
  if (!r) return;
  if (r.collapsed) { toast('Виділіть текст, щоб змінити його розмір'); return; }
  if (inRestricted(r)) return;
  mutate(() => {
    exec('styleWithCSS', false);
    exec('fontSize', '7');
    const fonts = $$('font[size="7"]', editor);
    const created = [];
    fonts.forEach(f => {
      const s = document.createElement('span');
      if (px) s.style.fontSize = px + 'px';
      while (f.firstChild) s.appendChild(f.firstChild);
      $$('[style*="font-size"]', s).forEach(x => { x.style.fontSize = ''; if (!x.getAttribute('style')) x.removeAttribute('style'); });
      f.replaceWith(s);
      created.push(s);
    });
    if (created.length) {
      const x = document.createRange();
      x.setStartBefore(created[0]);
      x.setEndAfter(created[created.length - 1]);
      setSel(x);
    }
  });
  UI.refreshSoon();
}
function changeFontSize(delta) {
  const steps = [10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64, 72];
  const cur = currentFontSize();
  let next;
  if (delta > 0) next = steps.find(s => s > cur) || 72;
  else next = steps.slice().reverse().find(s => s < cur) || 10;
  setFontSize(next);
}
const TEXT_COLORS = [['', 'Звичайний'], ['#e5484d', 'Червоний'], ['#f76b15', 'Помаранчевий'], ['#d4a106', 'Жовтий'], ['#30a46c', 'Зелений'], ['#3e63dd', 'Синій'], ['#8e4ec6', 'Фіолетовий'], ['#8b8d98', 'Сірий']];
const HL_COLORS = [['', 'Без виділення'], ['rgba(250,204,21,.38)', 'Жовте'], ['rgba(74,222,128,.32)', 'Зелене'], ['rgba(96,165,250,.32)', 'Синє'], ['rgba(244,114,182,.32)', 'Рожеве'], ['rgba(251,146,60,.34)', 'Помаранчеве'], ['rgba(148,163,184,.34)', 'Сіре'], ['rgba(167,139,250,.34)', 'Фіолетове']];
function applyColor(kind, color) {
  const r = getRange();
  if (!r) return;
  if (r.collapsed) { toast('Виділіть текст, щоб змінити колір'); return; }
  if (inRestricted(r)) return;
  const SENT = kind === 'fore' ? 'rgb(1, 2, 3)' : 'rgb(3, 2, 1)';
  mutate(() => {
    exec('styleWithCSS', true);
    exec(kind === 'fore' ? 'foreColor' : 'hiliteColor', color || SENT);
    exec('styleWithCSS', false);
    if (!color) {
      const prop = kind === 'fore' ? 'color' : 'background-color';
      $$('[style]', editor).forEach(el => {
        if ((el.style.getPropertyValue(prop) || '').replace(/\s/g, '') === SENT.replace(/\s/g, '')) {
          el.style.removeProperty(prop);
          if (!el.getAttribute('style')) el.removeAttribute('style');
        }
      });
    }
  });
  if (color && kind === 'fore') $('.color-ico').style.setProperty('--cur-color', color);
}
function moveBlock(dir) {
  const r = getRange();
  if (!r) return;
  const u = unitAtPoint(r.startContainer, r.startOffset);
  if (!u || !u.child) return;
  const el = u.child;
  const sib = dir < 0 ? el.previousElementSibling : el.nextElementSibling;
  if (!sib) return;
  mutate(() => {
    const saved = saveSelNodes();
    if (dir < 0) sib.before(el); else sib.after(el);
    restoreSelNodes(saved);
  });
  ensureCaretVisible();
}
function doInsertTable(rows, cols) {
  const t = makeTable(rows, cols, true);
  insertBlocks([t]);
  caretStart(t.querySelector('td'));
}
function doInsertHr() {
  const hr = document.createElement('hr');
  insertBlocks([hr]);
  caretAfterBlock(hr);
}
