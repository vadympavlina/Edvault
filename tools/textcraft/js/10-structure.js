// TextCraft · Edvault — Структура документа: нормалізація, створення, розбиття й перетворення блоків.
// Файли підключаються звичайними <script> по черзі й мають спільну глобальну область видимості.
'use strict';

/* ═══════════════════════════ НОРМАЛІЗАЦІЯ СТРУКТУРИ ═══════════════════════════ */
const ALLOWED_TOP = new Set(['P','H1','H2','H3','UL','OL','BLOCKQUOTE','PRE','TABLE','FIGURE','HR']);
const CALLOUT_TYPES = {
  tip:     { label: 'Порада',              icon: 'bulb' },
  success: { label: 'Добре знати',         icon: 'success' },
  warn:    { label: 'Увага',               icon: 'warn' },
  error:   { label: 'Помилка / не робити', icon: 'error' },
  note:    { label: 'Нотатка',             icon: 'note' },
};
const LANGS = [
  ['', 'Код'], ['text', 'Текст'], ['html', 'HTML'], ['css', 'CSS'], ['javascript', 'JavaScript'], ['typescript', 'TypeScript'],
  ['python', 'Python'], ['json', 'JSON'], ['sql', 'SQL'], ['bash', 'Terminal / Bash'], ['csharp', 'C#'], ['java', 'Java'],
  ['cpp', 'C++'], ['php', 'PHP'], ['markdown', 'Markdown'], ['xml', 'XML'], ['yaml', 'YAML'],
];
const LANG_ALIASES = { js: 'javascript', ts: 'typescript', py: 'python', sh: 'bash', shell: 'bash', zsh: 'bash', 'c#': 'csharp', cs: 'csharp', 'c++': 'cpp', md: 'markdown', yml: 'yaml', htm: 'html', txt: 'text', plain: 'text', plaintext: 'text' };
function normLang(l) { l = String(l || '').trim().toLowerCase(); l = LANG_ALIASES[l] || l; return LANGS.some(x => x[0] === l) ? l : (l ? l.replace(/[^a-z0-9+#-]/g, '').slice(0, 20) : ''); }
function langLabel(l) { const f = LANGS.find(x => x[0] === (l || '')); return f ? f[1] : (l ? l.toUpperCase() : 'Код'); }

function normalize() {
  const saved = saveSelNodes();
  const map = new Map();
  let changed = false;

  const retag = (el, tag) => {
    const n = document.createElement(tag);
    if (el.style && el.style.textAlign) n.style.textAlign = el.style.textAlign;
    while (el.firstChild) n.appendChild(el.firstChild);
    el.replaceWith(n);
    map.set(el, n);
    changed = true;
    return n;
  };
  const unwrap = el => {
    const parent = el.parentNode;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    map.set(el, parent);
    el.remove();
    changed = true;
  };
  const hasBlockChild = el => Array.from(el.children).some(c => !INLINE_TAGS.has(c.tagName));

  // Загортає «голий» текст/inline-елементи контейнера в <p>, чистить сміттєві блоки.
  const fixContainer = (container, mode) => {
    for (let pass = 0; pass < 4; pass++) {
      let again = false, buf = null;
      for (const n of Array.from(container.childNodes)) {
        if (n.nodeType === 8) { n.remove(); continue; }
        if (n.nodeType === 3 || (n.nodeType === 1 && INLINE_TAGS.has(n.tagName))) {
          if (n.nodeType === 3 && !buf && !n.data.replace(ZW, '').trim()) { n.remove(); continue; }
          if (!buf) { buf = document.createElement('p'); container.insertBefore(buf, n); changed = true; }
          buf.appendChild(n);
          continue;
        }
        buf = null;
        if (n.nodeType !== 1) { n.remove(); continue; }
        const t = n.tagName;
        if (t === 'IMG') {
          const fig = makeFigureFromImg(n);
          n.replaceWith(fig); changed = true; continue;
        }
        if (t === 'DIV' && isTcBlock(n)) {
          if (mode !== 'root') { unwrap(n); again = true; }
          continue;
        }
        if (t === 'DIV' || t === 'SECTION' || t === 'ARTICLE' || t === 'CENTER') {
          if (hasBlockChild(n)) { unwrap(n); again = true; } else retag(n, 'p');
          continue;
        }
        if (/^H[4-6]$/.test(t)) { retag(n, 'h3'); continue; }
        if (t === 'LI') { const ul = document.createElement('ul'); n.before(ul); ul.appendChild(n); changed = true; continue; }
        if (t === 'FIGCAPTION') { retag(n, 'p'); continue; }
        if (t === 'PRE' && mode !== 'root') {
          const ps = textToParagraphs((n.textContent || '').replace(/\n$/, ''));
          ps.forEach(p => n.before(p)); n.remove(); changed = true; continue;
        }
        if (t === 'BLOCKQUOTE' && mode === 'quote') { unwrap(n); again = true; continue; }
        if (!ALLOWED_TOP.has(t)) {
          if (hasBlockChild(n)) { unwrap(n); again = true; } else retag(n, 'p');
        }
      }
      if (!again) break;
    }
  };

  fixContainer(editor, 'root');
  $$('.tc-block', editor).forEach(b => {
    if (b.parentNode !== editor) {
      // блок усередині іншого блоку/списку — розгортаємо, вкладеність не підтримується
      if (b.parentNode && b.parentNode.closest && (b.parentNode.closest('.tc-block') || b.parentNode.closest('li,td,th,blockquote'))) { unwrap(b); return; }
    }
    if (b.classList.contains('tc-toggle')) {
      if (b.classList.contains('tc-callout') || b.classList.contains('tc-prompt')) { b.className = 'tc-block tc-toggle'; changed = true; }
      if (b.hasAttribute('data-type')) { b.removeAttribute('data-type'); changed = true; }
    } else if (b.classList.contains('tc-callout')) {
      if (!CALLOUT_TYPES[b.dataset.type]) { b.dataset.type = 'tip'; changed = true; }
      if (b.classList.contains('tc-prompt')) b.classList.remove('tc-prompt');
    } else if (!b.classList.contains('tc-prompt')) {
      b.classList.add('tc-callout'); b.dataset.type = 'tip'; changed = true;
    }
    fixContainer(b, 'tc');
    if (!b.firstChild) { b.appendChild(emptyP()); changed = true; }
    if (b.classList.contains('tc-toggle') && b.children.length < 2) { b.appendChild(emptyP()); changed = true; }
  });
  $$('blockquote', editor).forEach(q => {
    fixContainer(q, 'quote');
    if (!q.firstChild) { q.remove(); changed = true; }
  });

  // Блоки коду: <pre class="tc-code"><code>текст\n</code></pre>
  $$('pre', editor).forEach(pre => {
    if (!pre.classList.contains('tc-code')) { pre.classList.add('tc-code'); changed = true; }
    let code = pre.firstElementChild;
    const ok = pre.childNodes.length === 1 && code && code.tagName === 'CODE' && Array.from(code.childNodes).every(n => n.nodeType === 3);
    if (!ok) {
      const text = preText(pre);
      pre.textContent = '';
      code = document.createElement('code');
      code.textContent = text;
      pre.appendChild(code);
      changed = true;
    }
    if (!code.textContent.endsWith('\n')) code.appendChild(document.createTextNode('\n'));
    const lang = pre.dataset.lang ? normLang(pre.dataset.lang) : '';
    if ((pre.dataset.lang || '') !== lang) { if (lang) pre.dataset.lang = lang; else pre.removeAttribute('data-lang'); }
    const lbl = langLabel(lang);
    if (pre.dataset.label !== lbl) pre.dataset.label = lbl;
    const empty = !code.textContent.replace(/\n/g, '');
    if (empty !== pre.hasAttribute('data-empty')) { if (empty) pre.setAttribute('data-empty', ''); else pre.removeAttribute('data-empty'); }
  });

  // Зображення: завжди <figure class="tc-figure"><img><figcaption></figure>
  $$('img', editor).forEach(img => {
    if (img.closest('figure')) return;
    const fig = makeFigureFromImg(img.cloneNode(false));
    const host = img.closest('p,h1,h2,h3,li,td,th,blockquote') || img.parentNode;
    const top = (host && host !== editor && host.parentNode) ? (isTcBlock(host.parentNode) || host.parentNode === editor ? host : topLevelOf(host)) : null;
    img.remove();
    if (top) top.after(fig); else editor.appendChild(fig);
    changed = true;
  });
  $$('figure', editor).forEach(fig => {
    const img = fig.querySelector('img');
    if (!img) { fig.remove(); changed = true; return; }
    if (!fig.classList.contains('tc-figure')) fig.classList.add('tc-figure');
    if (img.parentNode !== fig) { fig.insertBefore(img, fig.firstChild); changed = true; }
    let cap = fig.querySelector('figcaption');
    if (!cap) { cap = document.createElement('figcaption'); fig.appendChild(cap); changed = true; }
    for (const n of Array.from(fig.childNodes)) {
      if (n === img || n === cap) continue;
      if (n.nodeType === 3 || (n.nodeType === 1 && INLINE_TAGS.has(n.tagName))) cap.appendChild(n);
      else n.remove();
      changed = true;
    }
    if (img.getAttribute('draggable') !== 'false') img.setAttribute('draggable', 'false');
    if (fig.parentNode !== editor && !isTcBlock(fig.parentNode)) {
      const top = topLevelOf(fig);
      if (top && top !== fig) { top.after(fig); changed = true; }
    }
  });

  // Чеклісти
  $$('ul.tc-checklist > li:not([data-checked])', editor).forEach(li => { li.dataset.checked = 'false'; });
  $$('li[data-checked]', editor).forEach(li => { if (!li.parentNode.classList || !li.parentNode.classList.contains('tc-checklist')) li.removeAttribute('data-checked'); });
  $$('ol.tc-checklist', editor).forEach(ol => ol.classList.remove('tc-checklist'));
  $$('ul:empty,ol:empty', editor).forEach(l => { l.remove(); changed = true; });

  // Inline-сміття: <font>, порожні <span>, зайві стилі від браузера
  $$('font', editor).forEach(f => { if (f.getAttribute('size') !== '7') unwrap(f); });
  $$('span', editor).forEach(s => {
    const st = s.style;
    const keep = {};
    ['color', 'background-color', 'font-size'].forEach(p => { const v = st.getPropertyValue(p); if (v) keep[p] = v; });
    const cur = s.getAttribute('style') || '';
    const next = Object.keys(keep).map(k => k + ': ' + keep[k]).join('; ');
    if (!next) { if (!s.attributes.length || (s.attributes.length === 1 && s.hasAttribute('style'))) { unwrap(s); return; } }
    if (next && cur.replace(/;\s*$/, '') !== next) s.setAttribute('style', next);
  });
  $$('[contenteditable]', editor).forEach(el => el.removeAttribute('contenteditable'));
  $$('p[style],h1[style],h2[style],h3[style],li[style],blockquote[style]', editor).forEach(el => {
    const ta = el.style.textAlign;
    if (!ta || ta === 'start' || ta === 'left') el.removeAttribute('style');
    else if (el.getAttribute('style') !== 'text-align: ' + ta + ';') el.setAttribute('style', 'text-align: ' + ta + ';');
  });
  $$('a[href]', editor).forEach(a => { if (!safeHref(a.getAttribute('href'))) a.removeAttribute('href'); });
  $$('p:empty,h1:empty,h2:empty,h3:empty,li:empty,td:empty,th:empty', editor).forEach(el => el.appendChild(document.createElement('br')));
  // Блок, у якому лишились тільки порожні текстові вузли, — невидима для браузера позиція курсора.
  $$('p,h1,h2,h3,li,td,th', editor).forEach(el => {
    if (!el.firstChild || el.firstElementChild) return;
    if (Array.from(el.childNodes).every(n => n.nodeType === 3 && !n.data.length)) {
      Array.from(el.childNodes).forEach(n => { map.set(n, el); n.remove(); });
      el.appendChild(document.createElement('br'));
      changed = true;
    }
  });

  // Блоки всередині абзаців/заголовків (напр. <p><ul>…</ul></p> від execCommand) — виносимо назовні.
  $$('p,h1,h2,h3', editor).forEach(tb => {
    if (!Array.from(tb.childNodes).some(n => n.nodeType === 1 && !INLINE_TAGS.has(n.tagName))) return;
    let anchor = tb, buf = null, seen = false;
    Array.from(tb.childNodes).forEach(n => {
      const blk = n.nodeType === 1 && !INLINE_TAGS.has(n.tagName);
      if (!seen && !blk) return;
      if (blk) {
        seen = true; buf = null;
        let node = n;
        if (n.tagName === 'LI') { node = document.createElement('ul'); n.before(node); node.appendChild(n); }
        anchor.after(node); anchor = node;
      } else {
        if (!buf) { buf = document.createElement('p'); anchor.after(buf); anchor = buf; }
        buf.appendChild(n);
      }
    });
    if (isEmptyBlock(tb)) { map.set(tb, tb.nextElementSibling || tb.parentNode); tb.remove(); }
    else if (!tb.firstChild) tb.appendChild(document.createElement('br'));
    changed = true;
  });

  // Документ ніколи не порожній і завжди закінчується абзацом, щоб після блоку можна було писати.
  if (!editor.firstChild) { editor.innerHTML = DEFAULT_HTML; changed = true; }
  const last = editor.lastElementChild;
  if (last && isAtomic(last)) { editor.appendChild(emptyP()); changed = true; }

  if (changed && saved) restoreSelNodes(saved, map);
  return changed;
}
function preText(pre) {
  const out = [];
  const walk = (n, first) => {
    if (n.nodeType === 3) { out.push(n.data); return; }
    if (n.nodeType !== 1) return;
    if (n.tagName === 'BR') { out.push('\n'); return; }
    const blk = /^(DIV|P|LI)$/.test(n.tagName);
    if (blk && out.length && !/\n$/.test(out[out.length - 1])) out.push('\n');
    n.childNodes.forEach(c => walk(c));
    if (blk) out.push('\n');
  };
  pre.childNodes.forEach(c => walk(c));
  return out.join('').replace(/\n+$/, '') + '\n';
}

/* ═══════════════════════════ ТЕКСТ ІЗ БЛОКІВ ═══════════════════════════ */
function nodeText(n, out) {
  if (n.nodeType === 3) { out.push(n.data.replace(ZW, '')); return; }
  if (n.nodeType !== 1) return;
  const t = n.tagName;
  if (t === 'BR') {
    // «хвостовий» <br> у кінці непорожнього блоку — це плейсхолдер браузера, не перенос
    if (!n.nextSibling && n.previousSibling && n.parentNode && !INLINE_TAGS.has(n.parentNode.tagName)) return;
    out.push('\n'); return;
  }
  if (t === 'IMG' || t === 'BUTTON') return;
  if (t === 'PRE') { out.push((n.textContent || '').replace(/\n$/, '') + '\n'); return; }
  const isBlk = /^(P|H1|H2|H3|H4|H5|H6|LI|DIV|BLOCKQUOTE|TR|FIGURE|FIGCAPTION|UL|OL|TABLE)$/.test(t);
  if (t === 'LI') {
    const list = n.parentNode;
    let depth = 0; for (let p = list.parentNode; p && p !== editor; p = p.parentNode) if (p.tagName === 'LI') depth++;
    let prefix = '- ';
    if (list.tagName === 'OL') prefix = (Array.prototype.indexOf.call(list.children, n) + 1) + '. ';
    else if (list.classList.contains('tc-checklist')) prefix = n.dataset.checked === 'true' ? '[x] ' : '[ ] ';
    out.push('  '.repeat(depth) + prefix);
  }
  if ((t === 'TD' || t === 'TH') && n.previousElementSibling) out.push('\t');
  n.childNodes.forEach(c => nodeText(c, out));
  if (isBlk && out.length && !/\n$/.test(out[out.length - 1])) out.push('\n');
  // між абзацами/заголовками — порожній рядок (як у Markdown); між пунктами списку — ні
  if (/^(P|H1|H2|H3|H4|H5|H6|BLOCKQUOTE|TABLE|UL|OL|FIGURE)$/.test(t) && n.nextElementSibling && !(n.parentNode && n.parentNode.tagName === 'LI')) out.push('\n');
}
function plainText(el) {
  if (!el) return '';
  if (el.nodeType === 3) return el.data;
  if (isCode(el)) return (el.textContent || '').replace(/\n$/, '');
  const out = [];
  el.childNodes.forEach(c => nodeText(c, out));
  return out.join('').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
}
function textToParagraphs(text) {
  // Порожній рядок = новий абзац; одиночний перенос = <br> всередині абзацу.
  const chunks = String(text).replace(/\r\n?/g, '\n').split(/\n{2,}/);
  const out = [];
  chunks.forEach(chunk => {
    const p = document.createElement('p');
    chunk.split('\n').forEach((line, i) => {
      if (i) p.appendChild(document.createElement('br'));
      if (line) p.appendChild(document.createTextNode(line));
    });
    if (!p.firstChild || (p.lastChild && p.lastChild.nodeName === 'BR')) p.appendChild(document.createElement('br'));
    out.push(p);
  });
  return out.length ? out : [emptyP()];
}

/* ═══════════════════════════ СТВОРЕННЯ БЛОКІВ ═══════════════════════════ */
function toggleTitle(text) { const t = document.createElement('p'); t.textContent = text || 'Відповідь'; return t; }
function makeTcBlock(kind, sub) {
  const b = document.createElement('div');
  if (kind === 'toggle') { b.className = 'tc-block tc-toggle'; b.appendChild(toggleTitle()); b.appendChild(emptyP()); return b; }
  if (kind === 'prompt') b.className = 'tc-block tc-prompt';
  else { b.className = 'tc-block tc-callout'; b.dataset.type = CALLOUT_TYPES[sub] ? sub : 'tip'; }
  b.appendChild(emptyP());
  return b;
}
function makeCodeBlock(text, lang) {
  const pre = document.createElement('pre');
  pre.className = 'tc-code';
  const l = normLang(lang);
  if (l) pre.dataset.lang = l;
  pre.dataset.label = langLabel(l);
  const code = document.createElement('code');
  code.textContent = String(text || '').replace(/\r\n?/g, '\n').replace(/\n$/, '') + '\n';
  pre.appendChild(code);
  if (!text) pre.setAttribute('data-empty', '');
  return pre;
}
function makeFigure(opts) {
  const fig = document.createElement('figure');
  fig.className = 'tc-figure';
  const img = document.createElement('img');
  img.src = opts.src;
  if (opts.asset) img.dataset.asset = opts.asset;
  img.alt = opts.alt || '';
  img.setAttribute('draggable', 'false');
  fig.appendChild(img);
  const cap = document.createElement('figcaption');
  if (opts.caption) cap.textContent = opts.caption;
  fig.appendChild(cap);
  if (opts.width) fig.style.setProperty('--w', opts.width + '%');
  if (opts.align && opts.align !== 'center') fig.dataset.align = opts.align;
  return fig;
}
function makeFigureFromImg(img) {
  const fig = document.createElement('figure');
  fig.className = 'tc-figure';
  img.setAttribute('draggable', 'false');
  fig.appendChild(img);
  fig.appendChild(document.createElement('figcaption'));
  return fig;
}
function makeTable(rows, cols, header) {
  const t = document.createElement('table');
  if (header !== false) t.className = 'tc-has-header';
  const tb = document.createElement('tbody');
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < cols; c++) { const td = document.createElement('td'); td.appendChild(document.createElement('br')); tr.appendChild(td); }
    tb.appendChild(tr);
  }
  t.appendChild(tb);
  return t;
}
function lastCell(table) { const rows = table.rows; const row = rows[rows.length - 1]; return row ? row.cells[row.cells.length - 1] : null; }
function firstTextBlock(el) { return el.querySelector('p,h1,h2,h3,li') || el; }
function lastTextBlock(el) { const all = el.querySelectorAll('p,h1,h2,h3,li'); return all[all.length - 1] || el; }

function placeCaretInBlock(b, where) {
  if (!b) return;
  if (isCode(b)) {
    const code = b.querySelector('code');
    if (!code) { caretAt(b, 0); return; }
    if (where === 'start') caretInCodeAt(code, 0);
    else caretInCodeAt(code, Math.max(0, code.textContent.length - 1));
    return;
  }
  if (b.tagName === 'TABLE') { if (where === 'start') caretStart(b.querySelector('td,th')); else caretEnd(lastCell(b)); return; }
  if (b.tagName === 'FIGURE' || b.tagName === 'HR') { caretAfterBlock(b); return; }
  if (isTcBlock(b) || /^(BLOCKQUOTE|UL|OL)$/.test(b.tagName)) {
    const t = where === 'start' ? firstTextBlock(b) : lastTextBlock(b);
    if (where === 'start') caretStart(t); else caretEnd(t);
    return;
  }
  if (where === 'start') caretStart(b); else caretEnd(b);
}
function caretAfterBlock(b) {
  let next = b.nextElementSibling;
  if (!next || !MERGEABLE.has(next.tagName)) {
    const p = emptyP();
    b.after(p);
    next = p;
  }
  caretStart(next);
}

/* ═══════════════════════════ РОЗБИТТЯ / ВСТАВКА / ЗЛИТТЯ ═══════════════════════════ */
// Розбиває блок у точці (c,o): блок лишається лівою частиною, повертається нова права частина.
function splitAt(block, c, o) {
  const r = document.createRange();
  r.setStart(c, o);
  r.setEnd(block, block.childNodes.length);
  const frag = r.extractContents();
  const right = block.cloneNode(false);
  right.removeAttribute('id');
  right.appendChild(frag);
  block.after(right);
  tidySplitPart(block, 'left');
  tidySplitPart(right, 'right');
  return right;
}
function tidySplitPart(el, side) {
  if (el.tagName === 'UL' || el.tagName === 'OL') {
    const li = side === 'left' ? el.lastElementChild : el.firstElementChild;
    if (li && li.tagName === 'LI' && isEmptyBlock(li) && el.children.length > 1) li.remove();
  }
  $$('p,h1,h2,h3,li', el).concat([el]).forEach(x => {
    if (MERGEABLE.has(x.tagName) || x.tagName === 'LI') if (!x.firstChild) x.appendChild(document.createElement('br'));
  });
}
function allowedIn(container, node) {
  if (container === editor) return true;
  const t = node.tagName;
  if (isTcBlock(node) || t === 'PRE') return false;
  if (isTcBlock(container)) return true;
  if (container.tagName === 'BLOCKQUOTE') return /^(P|H1|H2|H3|UL|OL)$/.test(t);
  return true;
}
// Вставляє блоки в позицію курсора. Абзац розбивається в точці курсора.
// Якщо блок не можна вкласти в поточний контейнер (напр. код у callout) — вставляє після контейнера.
function insertBlocks(nodes) {
  let r = getRange();
  if (!r) { caretEnd(editor.lastElementChild || editor); r = getRange(); }
  if (!r.collapsed) { deleteRangeSmart(r); r = getRange(); }
  const c = r.startContainer, o = r.startOffset;
  let u = unitAtPoint(c, o) || { container: editor, child: null };
  if (u.container !== editor && !nodes.every(n => allowedIn(u.container, n))) {
    u = { container: editor, child: topLevelOf(u.container) };
  }
  let left = u.child, right = null;
  if (!left) {
    nodes.forEach(n => u.container.appendChild(n));
    return { left: null, right: null };
  }
  if (isSplittable(left) && left.contains(elOf(c))) {
    right = splitAt(left, c, o);
  }
  let ref = left;
  nodes.forEach(n => { ref.after(n); ref = n; });
  const lastNode = nodes[nodes.length - 1];
  if (isSplittable(left) && isEmptyBlock(left)) left.remove();
  if (right && isEmptyBlock(right)) {
    const keep = lastNode && /^(FIGURE|TABLE|HR)$/.test(lastNode.tagName) && right.tagName === 'P';
    if (!keep) right.remove();
  }
  return { left: left.isConnected ? left : null, right: right && right.isConnected ? right : null };
}
// Видаляє виділення, яке може перетинати кілька абзаців, і зливає крайні абзаци (як у Word/Docs).
function deleteRangeSmart(r) {
  const sb = textBlockOf(r.startContainer), eb = textBlockOf(r.endContainer);
  const sc = r.startContainer, so = r.startOffset;
  r.deleteContents();
  if (sb && eb && sb !== eb && sb.isConnected && eb.isConnected && MERGEABLE.has(sb.tagName) && MERGEABLE.has(eb.tagName)) {
    mergeBlocks(sb, eb);
  } else if (editor.contains(sc)) {
    caretAt(sc, Math.min(so, nodeLen(sc)));
  }
  // порожні контейнери, що лишились після видалення
  $$('.tc-block,blockquote', editor).forEach(b => { if (!b.firstElementChild && !b.textContent.trim()) b.appendChild(emptyP()); });
}
// Приєднує вміст cur у кінець prev (як Backspace на початку абзацу).
function mergeBlocks(prev, cur) {
  let target = prev;
  if (prev.tagName === 'UL' || prev.tagName === 'OL') {
    let li = prev.lastElementChild;
    while (li && li.lastElementChild && /^(UL|OL)$/.test(li.lastElementChild.tagName) && li.lastElementChild.lastElementChild) li = li.lastElementChild.lastElementChild;
    target = li;
  } else if (isTcBlock(prev) || prev.tagName === 'BLOCKQUOTE') {
    target = prev.lastElementChild;
  }
  if (!target || !(MERGEABLE.has(target.tagName) || target.tagName === 'LI')) return false;
  const tail = target.lastChild;
  if (tail && tail.nodeName === 'BR') tail.remove();
  const anchor = target.lastChild;
  if (!isEmptyBlock(cur)) {
    while (cur.firstChild) target.appendChild(cur.firstChild);
  }
  cur.remove();
  if (!target.firstChild) target.appendChild(document.createElement('br'));
  if (!anchor) caretStart(target);
  else caretAfterNode(anchor);
  return true;
}

/* ═══════════════════════════ ВИДІЛЕННЯ → БЛОК (головний фікс) ═══════════════════════════
   Раніше вибраний текст «переїжджав» у кінець документа: після видалення виділення
   курсор опинявся прямо в #editor, і скрипт не знаходив, куди вставити блок.
   Тепер: розбиваємо крайні абзаци точно по межах виділення, вибрані вузли
   переносимо в новий блок і ставимо його рівно на їхнє місце. Все — один крок undo. */
function wrapSelectionAsBlock(kind, sub) {
  const r = getRange();
  if (!r) return;
  if (r.collapsed) { insertNewBlock(kind, sub); return; }
  mutate(() => {
    const sc = r.startContainer, so = r.startOffset, ec = r.endContainer, eo = r.endOffset;
    let startTop = topLevelAtPoint(sc, so, 'start');
    let endTop = topLevelAtPoint(ec, eo, 'end');
    if (!startTop || !endTop) return;
    if (startTop === endTop && (isTcBlock(startTop) || isCode(startTop))) { convertBlock(startTop, kind, sub); return; }
    if (startTop.compareDocumentPosition(endTop) & Node.DOCUMENT_POSITION_PRECEDING) { const t = startTop; startTop = endTop; endTop = t; }

    let first, last = endTop;
    if (!isAtomic(endTop) && endTop.nodeType === 1 && endTop.contains(elOf(ec))) {
      const right = splitAt(endTop, ec, eo);
      if (isEmptyBlock(right)) right.remove();
    }
    if (!isAtomic(startTop) && startTop.nodeType === 1 && startTop.contains(elOf(sc))) {
      const right2 = splitAt(startTop, sc, so);
      if (last === startTop) last = right2;
      first = right2;
      if (isEmptyBlock(startTop)) startTop.remove();
    } else first = startTop;

    let nodes = [];
    for (let n = first; n; n = n.nextSibling) { nodes.push(n); if (n === last) break; }
    // крайні порожні абзаци (наприклад, при потрійному кліку виділення «зачіпає» наступний рядок)
    while (nodes.length > 1 && isSplittable(nodes[0]) && isEmptyBlock(nodes[0])) nodes.shift().remove();
    while (nodes.length > 1 && isSplittable(nodes[nodes.length - 1]) && isEmptyBlock(nodes[nodes.length - 1])) nodes.pop().remove();
    if (!nodes.length) return;

    const marker = document.createComment('tc');
    nodes[0].before(marker);
    const block = buildBlockFrom(kind, sub, nodes);
    marker.replaceWith(block);
    placeCaretInBlock(block, 'end');
  });
}
function buildBlockFrom(kind, sub, nodes) {
  if (kind === 'code') {
    const text = nodes.map(n => (n.nodeType === 1 ? plainText(n) : n.textContent)).join('\n');
    nodes.forEach(n => n.remove());
    return makeCodeBlock(text, '');
  }
  const block = makeTcBlock(kind, sub);
  block.textContent = '';
  const add = n => {
    if (n.nodeType === 3) { if (n.data.trim()) { const p = document.createElement('p'); p.appendChild(n); block.appendChild(p); } else n.remove(); return; }
    if (n.nodeType !== 1) { n.remove(); return; }
    if (isTcBlock(n)) { Array.from(n.childNodes).forEach(add); n.remove(); return; }
    if (isCode(n)) { textToParagraphs(plainText(n)).forEach(p => block.appendChild(p)); n.remove(); return; }
    if (n.tagName === 'BLOCKQUOTE') { Array.from(n.childNodes).forEach(add); n.remove(); return; }
    if (kind === 'prompt' && /^H[1-6]$/.test(n.tagName)) { const p = document.createElement('p'); while (n.firstChild) p.appendChild(n.firstChild); n.remove(); block.appendChild(p); return; }
    block.appendChild(n);
  };
  nodes.forEach(add);
  if (!block.firstChild) block.appendChild(emptyP());
  if (kind === 'toggle') block.insertBefore(toggleTitle(), block.firstChild);
  return block;
}
// Змінює тип існуючого блоку. Повторне застосування того ж типу — прибирає оформлення.
function convertBlock(block, kind, sub) {
  if (isCode(block)) {
    if (kind === 'code') { unwrapBlock(block); return; }
    const nb = makeTcBlock(kind, sub);
    nb.textContent = '';
    textToParagraphs(plainText(block)).forEach(p => nb.appendChild(p));
    block.replaceWith(nb);
    placeCaretInBlock(nb, 'end');
    return;
  }
  const isPrompt = block.classList.contains('tc-prompt');
  if (kind === 'toggle') {
    if (block.classList.contains('tc-toggle')) { unwrapBlock(block); return; }
    block.className = 'tc-block tc-toggle';
    block.removeAttribute('data-type');
    block.insertBefore(toggleTitle(), block.firstChild);
    return;
  }
  if (kind === 'code') {
    const pre = makeCodeBlock(plainText(block), '');
    block.replaceWith(pre);
    placeCaretInBlock(pre, 'end');
    return;
  }
  if (kind === 'prompt') {
    if (isPrompt) { unwrapBlock(block); return; }
    block.className = 'tc-block tc-prompt';
    block.removeAttribute('data-type');
    block.removeAttribute('data-collapsed');
    return;
  }
  // callout
  block.removeAttribute('data-collapsed');
  const type = CALLOUT_TYPES[sub] ? sub : 'tip';
  if (!isPrompt && block.dataset.type === type) { unwrapBlock(block); return; }
  block.className = 'tc-block tc-callout';
  block.dataset.type = type;
}
function unwrapBlock(block) {
  if (isCode(block)) {
    const ps = textToParagraphs(plainText(block));
    const lastP = ps[ps.length - 1];
    ps.forEach(p => block.before(p));
    block.remove();
    caretEnd(lastP);
    return;
  }
  const saved = saveSelNodes();
  const first = block.firstChild;
  while (block.firstChild) block.before(block.firstChild);
  block.remove();
  if (saved && editor.contains(saved.sc)) restoreSelNodes(saved);
  else if (first) caretEnd(first);
}
function insertNewBlock(kind, sub) {
  mutate(() => doInsertNewBlock(kind, sub));
}
function doInsertNewBlock(kind, sub) {
  const r = getRange();
  if (r) {
    const cur = closestIn(r.startContainer, '.tc-block,pre');
    if (cur && ((kind === 'code' && isCode(cur)) || (kind !== 'code' && isTcBlock(cur) && !r.collapsed))) { convertBlock(cur, kind, sub); return; }
  }
  const block = kind === 'code' ? makeCodeBlock('', '') : makeTcBlock(kind, sub);
  insertBlocks([block]);
  if (kind === 'toggle') caretStart(block.children[1]); else placeCaretInBlock(block, 'start');
}
