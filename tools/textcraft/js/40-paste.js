// TextCraft · Edvault — Зображення, очищення вставленого HTML, вставка, Markdown (імпорт/експорт).
// Файли підключаються звичайними <script> по черзі й мають спільну глобальну область видимості.
'use strict';

/* ═══════════════════════════ ЗОБРАЖЕННЯ (сховище assets) ═══════════════════════════ */
function dataUrlToBlob(d) {
  const i = d.indexOf(',');
  const head = d.slice(0, i), body = d.slice(i + 1);
  const mime = (head.match(/^data:([^;,]+)/) || [])[1] || 'application/octet-stream';
  if (/;base64/i.test(head)) {
    const bin = atob(body);
    const u8 = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
    return new Blob([u8], { type: mime });
  }
  return new Blob([decodeURIComponent(body)], { type: mime });
}
const Assets = {
  map: new Map(), byUrl: new Map(), byData: new Map(),
  add(data, id) {
    if (!id && this.byData.has(data)) return this.map.get(this.byData.get(data));
    if (id && this.map.has(id)) return this.map.get(id);
    id = id || uid('a');
    let url;
    try { url = URL.createObjectURL(dataUrlToBlob(data)); } catch (e) { url = data; }
    const a = { id, data, url };
    this.map.set(id, a); this.byUrl.set(url, id); this.byData.set(data, id);
    return a;
  },
  get(id) { return this.map.get(id) || null; },
  idByUrl(url) { return this.byUrl.get(url) || null; },
  clear() {
    this.map.forEach(a => { if (a.url.startsWith('blob:')) URL.revokeObjectURL(a.url); });
    this.map.clear(); this.byUrl.clear(); this.byData.clear();
  },
  collect(root) {
    const out = {};
    $$('img[data-asset]', root).forEach(img => { const a = this.map.get(img.dataset.asset); if (a) out[a.id] = a.data; });
    return out;
  },
};
function readImageFile(file, maxDim) {
  maxDim = maxDim || 2000;
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = e => {
      const original = e.target.result;
      if (file.type === 'image/svg+xml' || file.type === 'image/gif') { resolve(original); return; }
      const img = new Image();
      img.onload = () => {
        if (img.width <= maxDim && img.height <= maxDim && file.size < 1.6e6) { resolve(original); return; }
        try {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const cx = cv.getContext('2d');
          const png = file.type === 'image/png' || file.type === 'image/webp';
          if (!png) { cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); }
          cx.drawImage(img, 0, 0, w, h);
          let out = cv.toDataURL(png ? 'image/png' : 'image/jpeg', 0.88);
          if (png && out.length > 1.5e6) { cx.globalCompositeOperation = 'destination-over'; cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); const j = cv.toDataURL('image/jpeg', 0.88); if (j.length < out.length * 0.7) out = j; }
          resolve(out.length < original.length ? out : original);
        } catch (err) { resolve(original); }
      };
      img.onerror = () => resolve(null);
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
}
async function insertImages(files, atRange) {
  const imgs = Array.from(files).filter(f => f && f.type && f.type.startsWith('image/'));
  if (!imgs.length) return;
  let lastFig = null;
  for (const f of imgs) {
    const data = await readImageFile(f);
    if (!data) { toast('Не вдалося прочитати зображення «' + f.name + '»', 'err'); continue; }
    const a = Assets.add(data);
    const fig = makeFigure({ src: a.url, asset: a.id });
    mutate(() => {
      if (atRange && editor.contains(atRange.startContainer)) { focusEditor(); setSel(atRange); atRange = null; }
      insertBlocks([fig]);
      caretAfterBlock(fig);
    });
    lastFig = fig;
  }
  if (lastFig && lastFig.isConnected) {
    const img = lastFig.querySelector('img');
    const sel = () => UI.selectFigure(lastFig);
    if (img.complete) sel(); else img.onload = sel;
  }
}
function pickImage() { $('#imgInput').click(); }

/* ═══════════════════════════ ОЧИЩЕННЯ ВСТАВЛЕНОГО HTML ═══════════════════════════ */
function safeHref(h) {
  h = String(h || '').trim();
  if (!h) return null;
  if (/^(https?:|mailto:|tel:)/i.test(h)) return h;
  if (h.startsWith('#')) return h;
  if (h.startsWith('//')) return 'https:' + h;
  if (/^www\./i.test(h)) return 'https://' + h;
  return null;
}
const DROP_TAGS = new Set(['SCRIPT','STYLE','META','LINK','TITLE','NOSCRIPT','IFRAME','OBJECT','EMBED','SVG','BUTTON','INPUT','SELECT','TEXTAREA','FORM','CANVAS','VIDEO','AUDIO','TEMPLATE','HEAD','MATH','OPTION','DATALIST','COLGROUP','COL']);
function sanitizeHTML(html, opts) {
  opts = opts || {};
  const own = opts.own != null ? opts.own : /tc-own|class="[^"]*\btc-(block|code|figure|checklist|content)/.test(html);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const root = doc.body;
  if (opts.legacy || root.querySelector('.callout,.card-block,.img-wrap,.callout-body')) upgradeLegacyDom(root);
  const ctx = { own, legacy: !!opts.legacy };
  const tmp = document.createElement('div');
  cleanChildren(root, tmp, ctx);
  return blockify(tmp, 'root');
}
function cleanChildren(src, dst, ctx) {
  for (const c of Array.from(src.childNodes)) { const x = cleanNode(c, ctx); if (x) dst.appendChild(x); }
}
function cleanNode(n, ctx) {
  if (n.nodeType === 3) {
    const t = n.data.replace(/[\r\n\t ]+/g, ' ');
    return t ? document.createTextNode(t) : null;
  }
  if (n.nodeType !== 1) return null;
  const tag = n.tagName.toUpperCase().replace(/^.*:/, '');
  if (DROP_TAGS.has(tag) || n.tagName.includes(':') && tag === 'P' && !n.textContent.trim()) return null;
  if (n.getAttribute('aria-hidden') === 'true' && !n.textContent.trim()) return null;
  const style = n.getAttribute('style') || '';
  if (/display\s*:\s*none/i.test(style)) return null;
  const kids = () => { const f = document.createDocumentFragment(); cleanChildren(n, f, ctx); return f; };
  const wrap = (t, attrs) => { const el = document.createElement(t); if (attrs) Object.keys(attrs).forEach(k => el.setAttribute(k, attrs[k])); el.appendChild(kids()); return el; };
  const align = el => { const m = style.match(/text-align\s*:\s*(center|right|justify)/i) || [null, n.getAttribute('align')]; if (m[1] && /^(center|right|justify)$/i.test(m[1])) el.style.textAlign = m[1].toLowerCase(); return el; };
  switch (tag) {
    case 'B': case 'STRONG':
      if (/font-weight\s*:\s*(normal|[1-5]00)\b/i.test(style)) return inlineStyled(kids(), style, ctx);
      return wrap('strong');
    case 'I': case 'EM': case 'CITE': case 'DFN': case 'VAR': return wrap('em');
    case 'U': case 'INS': return wrap('u');
    case 'S': case 'STRIKE': case 'DEL': return wrap('s');
    case 'CODE': case 'KBD': case 'SAMP': case 'TT': return wrap('code');
    case 'SUB': case 'SUP': return wrap(tag.toLowerCase());
    case 'MARK': { const s = wrap('span'); s.style.backgroundColor = 'rgba(250,204,21,.38)'; return s; }
    case 'A': {
      const href = safeHref(n.getAttribute('href'));
      if (!href) return kids();
      const a = wrap('a', { href });
      if (/^https?:/i.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      return a;
    }
    case 'SPAN': case 'FONT': case 'ABBR': case 'SMALL': case 'BIG': case 'Q': case 'TIME': case 'LABEL':
      return inlineStyled(kids(), style, ctx, n);
    case 'BR': return document.createElement('br');
    case 'H1': return align(wrap('h1'));
    case 'H2': return align(wrap('h2'));
    case 'H3': case 'H4': case 'H5': case 'H6': return align(wrap('h3'));
    case 'UL': case 'OL': {
      const l = wrap(tag.toLowerCase());
      if (tag === 'UL' && ctx.own && n.classList.contains('tc-checklist')) l.className = 'tc-checklist';
      if (tag === 'OL' && /^\d+$/.test(n.getAttribute('start') || '') && n.getAttribute('start') !== '1') l.setAttribute('start', n.getAttribute('start'));
      return l;
    }
    case 'LI': {
      const li = wrap('li');
      if (ctx.own && n.dataset && n.dataset.checked) li.dataset.checked = n.dataset.checked === 'true' ? 'true' : 'false';
      return li;
    }
    case 'BLOCKQUOTE': return wrap('blockquote');
    case 'PRE': {
      const text = preTextOf(n);
      const lang = ctx.own ? (n.dataset.lang || '') : ((n.querySelector('code') && (n.querySelector('code').className.match(/language-([\w#+-]+)/) || [])[1]) || '');
      return makeCodeBlock(text, lang);
    }
    case 'TABLE': return cleanTable(n, ctx);
    case 'IMG': return cleanImg(n, ctx);
    case 'FIGURE': {
      const img = n.querySelector('img');
      if (!img) return kids();
      const fig = cleanImg(img, ctx);
      if (!fig) return null;
      const cap = n.querySelector('figcaption');
      if (cap) fig.querySelector('figcaption').appendChild(flattenInline(cap, ctx));
      if (ctx.own) {
        const w = parseInt((n.getAttribute('style') || '').replace(/.*--w\s*:\s*/, ''), 10);
        if (w >= 5 && w <= 100) fig.style.setProperty('--w', w + '%');
        if (n.dataset.align === 'left' || n.dataset.align === 'right') fig.dataset.align = n.dataset.align;
        if (n.dataset.wrap === 'left' || n.dataset.wrap === 'right') fig.dataset.wrap = n.dataset.wrap;
      }
      return fig;
    }
    case 'HR': return document.createElement('hr');
    case 'DETAILS': {
      const b = document.createElement('div');
      b.className = 'tc-block tc-toggle';
      const sum = n.querySelector(':scope > summary');
      const t = document.createElement('p');
      if (sum) { t.appendChild(flattenInline(sum, ctx)); sum.remove(); }
      if (!t.textContent.trim()) t.textContent = 'Відповідь';
      b.appendChild(t);
      b.appendChild(kids());
      if (b.children.length < 2) b.appendChild(emptyP());
      return b;
    }
    case 'DIV':
      if (ctx.own && n.classList.contains('tc-block')) {
        const b = document.createElement('div');
        if (n.classList.contains('tc-toggle')) b.className = 'tc-block tc-toggle';
        else if (n.classList.contains('tc-prompt')) b.className = 'tc-block tc-prompt';
        else { b.className = 'tc-block tc-callout'; b.dataset.type = CALLOUT_TYPES[n.dataset.type] ? n.dataset.type : 'tip'; }
        b.appendChild(kids());
        return b;
      }
      return align(wrap('div'));
    case 'P': return align(wrap('p'));
    default:
      // SECTION, ARTICLE, HEADER, MAIN, TD поза таблицею тощо — блоковий контейнер
      if (/^(SECTION|ARTICLE|HEADER|FOOTER|MAIN|ASIDE|NAV|CENTER|ADDRESS|DL|DD|DT|DETAILS|SUMMARY|TR|TD|TH|TBODY|THEAD|TFOOT|CAPTION|FIGCAPTION|HGROUP)$/.test(tag)) return wrap('div');
      return kids();
  }
}
function preTextOf(pre) {
  const out = [];
  const walk = n => {
    if (n.nodeType === 3) { out.push(n.data); return; }
    if (n.nodeType !== 1) return;
    if (n.tagName === 'BR') { out.push('\n'); return; }
    if (n.tagName === 'BUTTON') return;
    const blk = /^(DIV|P|LI|TR)$/.test(n.tagName);
    if (blk && out.length && !/\n$/.test(out[out.length - 1])) out.push('\n');
    n.childNodes.forEach(walk);
    if (blk) out.push('\n');
  };
  pre.childNodes.forEach(walk);
  return out.join('').replace(/\r\n?/g, '\n').replace(/\n+$/, '');
}
function inlineStyled(frag, style, ctx) {
  let node = frag;
  const w = el => { el.appendChild(node); node = el; };
  if (ctx.own) {
    const color = (style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i) || [])[1];
    const bg = (style.match(/background(?:-color)?\s*:\s*([^;]+)/i) || [])[1];
    const fs = (style.match(/font-size\s*:\s*(\d+(?:\.\d+)?)px/i) || [])[1];
    if (color || bg || fs) {
      const s = document.createElement('span');
      if (color) s.style.color = color.trim();
      if (bg && !/transparent|initial|inherit/.test(bg)) s.style.backgroundColor = bg.trim();
      if (fs) s.style.fontSize = Math.round(parseFloat(fs)) + 'px';
      if (s.getAttribute('style')) w(s);
    }
  }
  if (/text-decoration[^;]*line-through/i.test(style)) w(document.createElement('s'));
  if (/text-decoration[^;]*underline/i.test(style)) w(document.createElement('u'));
  if (/font-style\s*:\s*italic/i.test(style)) w(document.createElement('em'));
  if (/font-weight\s*:\s*(bold|bolder|[6-9]00)\b/i.test(style)) w(document.createElement('strong'));
  if (/font-family\s*:[^;]*(courier|consolas|mono)/i.test(style) && !/font-weight/i.test(style)) w(document.createElement('code'));
  return node;
}
function cleanImg(img, ctx) {
  const src = img.getAttribute('src') || '';
  let opts = null;
  if (ctx.own && img.dataset && img.dataset.asset && Assets.get(img.dataset.asset)) opts = { src: Assets.get(img.dataset.asset).url, asset: img.dataset.asset };
  else if (/^data:image\//i.test(src)) { const a = Assets.add(src); opts = { src: a.url, asset: a.id }; }
  else if (src.startsWith('blob:')) { const id = Assets.idByUrl(src); if (id) opts = { src, asset: id }; }
  else if (/^https?:\/\//i.test(src)) opts = { src };
  if (!opts) return null;
  opts.alt = img.getAttribute('alt') || '';
  return makeFigure(opts);
}
function cleanTable(t, ctx) {
  const rows = Array.from(t.rows || []);
  if (!rows.length) return null;
  const table = document.createElement('table');
  const hasHead = !!t.tHead || (rows[0] && Array.from(rows[0].cells).every(c => c.tagName === 'TH')) || ctx.legacy;
  if (ctx.own && !ctx.legacy ? t.classList.contains('tc-has-header') : hasHead) table.className = 'tc-has-header';
  if (ctx.own && t.classList.contains('tc-striped')) table.classList.add('tc-striped');
  if (ctx.own) {
    const ws = Array.from(t.querySelectorAll(':scope > colgroup > col')).map(c => parseFloat(c.style.width) || 0);
    if (ws.length && ws.every(w => w > 0)) setColWidths(table, ws);
  }
  const tb = document.createElement('tbody');
  rows.forEach(row => {
    const tr = document.createElement('tr');
    const rh = parseInt(row.style && row.style.height, 10);
    if (ctx.own && rh >= 20 && rh <= 2000) tr.style.height = rh + 'px';
    Array.from(row.cells).forEach(cell => {
      const td = document.createElement('td');
      if (ctx.own && CELL_BG.some(([v]) => v && v === cell.dataset.bg)) td.dataset.bg = cell.dataset.bg;
      if (ctx.own && cell.dataset.valign === 'middle') td.dataset.valign = 'middle';
      const cs = parseInt(cell.getAttribute('colspan'), 10), rs = parseInt(cell.getAttribute('rowspan'), 10);
      if (cs > 1) td.setAttribute('colspan', cs);
      if (rs > 1) td.setAttribute('rowspan', rs);
      td.appendChild(flattenInline(cell, ctx));
      if (!td.firstChild || !td.textContent.trim() && !td.querySelector('br')) { td.textContent = ''; td.appendChild(document.createElement('br')); }
      tr.appendChild(td);
    });
    if (tr.cells.length) tb.appendChild(tr);
  });
  table.appendChild(tb);
  return table;
}
// Вміст елемента як inline-фрагмент: блоки → переноси рядків.
function flattenInline(src, ctx) {
  const tmp = document.createElement('div');
  cleanChildren(src, tmp, ctx);
  const out = document.createDocumentFragment();
  const walk = (container, target) => {
    const kids = Array.from(container.childNodes);
    kids.forEach((n, i) => {
      if (isInlineNode(n)) { target.appendChild(n); return; }
      if (n.nodeType !== 1) return;
      if (n.tagName === 'PRE') { target.appendChild(document.createTextNode(n.textContent.replace(/\n$/, ''))); }
      else if (n.tagName === 'FIGURE' || n.tagName === 'HR' || n.tagName === 'TABLE') { /* пропускаємо */ }
      else walk(n, target);
      if (i < kids.length - 1 && target.lastChild && target.lastChild.nodeName !== 'BR') target.appendChild(document.createElement('br'));
    });
  };
  walk(tmp, out);
  while (out.lastChild && out.lastChild.nodeName === 'BR') out.lastChild.remove();
  return out;
}
function isBlankInline(p) { return !p.textContent.replace(ZW, '').trim() && !p.querySelector('img'); }
// Перетворює дерево на список валідних блоків верхнього рівня.
function blockify(src, mode) {
  const out = [];
  let buf = null;
  const flush = () => {
    if (buf) {
      while (buf.lastChild && buf.lastChild.nodeName === 'BR' && buf.childNodes.length > 1) buf.lastChild.remove();
      if (!isBlankInline(buf)) out.push(buf);
      buf = null;
    }
  };
  for (const n of Array.from(src.childNodes)) {
    if (isInlineNode(n)) {
      if (!buf) { if (n.nodeType === 3 && !n.data.trim()) continue; if (n.nodeName === 'BR') continue; buf = document.createElement('p'); }
      buf.appendChild(n);
      continue;
    }
    flush();
    if (n.nodeType !== 1) continue;
    const t = n.tagName;
    if (t === 'P' || (t === 'DIV' && !isTcBlock(n))) {
      const ta = n.style.textAlign;
      blockify(n, mode).forEach(b => { if (ta && MERGEABLE.has(b.tagName) && !b.style.textAlign) b.style.textAlign = ta; out.push(b); });
      continue;
    }
    if (isTcBlock(n)) {
      if (mode !== 'root') { out.push(...blockify(n, mode)); continue; }
      const kids = blockify(n, 'tc');
      n.textContent = '';
      kids.forEach(k => n.appendChild(k));
      if (!n.firstChild) n.appendChild(emptyP());
      out.push(n);
      continue;
    }
    if (t === 'BLOCKQUOTE') {
      const kids = blockify(n, mode === 'root' ? 'quote' : mode);
      if (mode === 'quote') { out.push(...kids); continue; }
      n.textContent = '';
      kids.forEach(k => n.appendChild(k));
      if (n.firstChild) out.push(n);
      continue;
    }
    if (t === 'UL' || t === 'OL') { fixList(n); if (n.children.length) out.push(n); continue; }
    if (t === 'LI') {
      const prev = out[out.length - 1];
      if (prev && prev.tagName === 'UL' && prev.dataset.orphan) { prev.appendChild(n); fixList(prev); }
      else { const ul = document.createElement('ul'); ul.dataset.orphan = '1'; ul.appendChild(n); fixList(ul); out.push(ul); }
      continue;
    }
    if (t === 'PRE') { if (mode === 'root') out.push(n); else out.push(...textToParagraphs(n.textContent.replace(/\n$/, ''))); continue; }
    if (t === 'TABLE' || t === 'FIGURE' || t === 'HR') { out.push(n); continue; }
    if (/^H[1-3]$/.test(t)) {
      const hasBlock = Array.from(n.childNodes).some(c => !isInlineNode(c));
      if (hasBlock) { const f = document.createElement(t.toLowerCase()); f.appendChild(flattenInline(n, { own: true })); if (!isBlankInline(f)) out.push(f); }
      else if (!isBlankInline(n)) out.push(n);
      continue;
    }
    out.push(...blockify(n, mode));
  }
  flush();
  out.forEach(b => { if (b.dataset) delete b.dataset.orphan; });
  return out;
}
function fixList(list) {
  for (const n of Array.from(list.childNodes)) {
    if (n.nodeType === 1 && n.tagName === 'LI') { fixLi(n); continue; }
    if (n.nodeType === 1 && (n.tagName === 'UL' || n.tagName === 'OL')) {
      const prev = n.previousElementSibling;
      if (prev && prev.tagName === 'LI') { prev.appendChild(n); fixList(n); } else { const li = document.createElement('li'); n.before(li); li.appendChild(n); fixList(n); }
      continue;
    }
    if (n.nodeType === 3 && !n.data.trim()) { n.remove(); continue; }
    const prev = n.previousElementSibling;
    if (prev && prev.tagName === 'LI') prev.appendChild(n); else { const li = document.createElement('li'); n.before(li); li.appendChild(n); fixLi(li); }
  }
  $$(':scope > li', list).forEach(li => { if (!li.firstChild) li.appendChild(document.createElement('br')); });
}
function fixLi(li) {
  const kids = Array.from(li.childNodes);
  kids.forEach((n, i) => {
    if (n.nodeType !== 1 || isInlineNode(n)) return;
    if (n.tagName === 'UL' || n.tagName === 'OL') { fixList(n); return; }
    const frag = document.createDocumentFragment();
    if (n.tagName === 'PRE') frag.appendChild(document.createTextNode(n.textContent.replace(/\n$/, '')));
    else if (n.tagName !== 'FIGURE' && n.tagName !== 'TABLE' && n.tagName !== 'HR') while (n.firstChild) frag.appendChild(n.firstChild);
    const needBr = n.nextSibling && !(n.nextSibling.nodeType === 1 && /^(UL|OL)$/.test(n.nextSibling.tagName));
    if (needBr) frag.appendChild(document.createElement('br'));
    n.replaceWith(frag);
  });
  // «розгортаємо» внутрішні блоки, що могли з'явитись, повторно
  if (Array.from(li.childNodes).some(n => n.nodeType === 1 && !isInlineNode(n) && !/^(UL|OL)$/.test(n.tagName))) fixLi(li);
}
function legacyText(el) {
  const out = [];
  const walk = (n) => {
    if (n.nodeType === 3) { out.push(n.data); return; }
    if (n.nodeType !== 1) return;
    if (n.tagName === 'BR') { out.push('\n'); return; }
    const blk = /^(DIV|P|LI)$/.test(n.tagName);
    if (blk && out.length && !/\n$/.test(out[out.length - 1])) out.push('\n');
    n.childNodes.forEach(walk);
  };
  el.childNodes.forEach(walk);
  return out.join('').replace(/​/g, '');
}
// Стара розмітка TextCraft (до цієї версії) → нова.
function upgradeLegacyDom(root) {
  const d = root.ownerDocument;
  $$('.block-remove-btn,.card-copy-btn,.tc-copy', root).forEach(b => b.remove());
  $$('.callout', root).forEach(c => {
    if (c.classList.contains('tc-block')) return;
    const cls = Array.from(c.classList).find(x => x.startsWith('callout-') && x !== 'callout-body' && x !== 'callout-icon') || 'callout-tip';
    const type = cls.slice(8);
    const body = c.querySelector('.callout-body') || c;
    const b = d.createElement('div');
    b.className = 'tc-block tc-callout';
    b.dataset.type = CALLOUT_TYPES[type] ? type : 'tip';
    $$('.callout-icon', c).forEach(i => i.remove());
    while (body.firstChild) b.appendChild(body.firstChild);
    c.replaceWith(b);
  });
  $$('.card-block', root).forEach(card => {
    const pb = card.querySelector('.prompt-body'), cb = card.querySelector('.code-body');
    if (cb) {
      const pre = d.createElement('pre');
      pre.className = 'tc-code';
      const code = d.createElement('code');
      code.textContent = legacyText(cb).replace(/\n$/, '');
      pre.appendChild(code);
      card.replaceWith(pre);
    } else if (pb) {
      const b = d.createElement('div');
      b.className = 'tc-block tc-prompt';
      const text = legacyText(pb).replace(/\n+$/, '');
      text.split(/\n{2,}/).forEach(chunk => {
        const p = d.createElement('p');
        chunk.split('\n').forEach((line, i) => { if (i) p.appendChild(d.createElement('br')); if (line) p.appendChild(d.createTextNode(line)); });
        b.appendChild(p);
      });
      card.replaceWith(b);
    } else card.remove();
  });
  $$('.img-wrap', root).forEach(w => {
    const img = w.querySelector('img');
    if (!img) { w.remove(); return; }
    const fig = d.createElement('figure');
    fig.className = 'tc-figure';
    const i2 = d.createElement('img');
    i2.setAttribute('src', img.getAttribute('src') || '');
    fig.appendChild(i2);
    const cap = d.createElement('figcaption');
    const oc = w.querySelector('.img-cap');
    if (oc) cap.textContent = oc.textContent;
    fig.appendChild(cap);
    const wv = parseInt(w.style.width, 10);
    if (wv && wv < 100) fig.setAttribute('style', '--w:' + wv + '%');
    const p = w.closest('p');
    const al = p && p.style.textAlign;
    if (al === 'left' || al === 'right') fig.dataset.align = al;
    w.replaceWith(fig);
  });
}

/* ═══════════════════════════ ВСТАВКА (PASTE) / КОПІЮВАННЯ ═══════════════════════════ */
function insertInlineFrom(p) {
  let r = getRange();
  if (!r) return;
  const tb = textBlockOf(r.startContainer);
  if (tb && isEmptyBlock(tb) && tb.childNodes.length === 1 && tb.firstChild.nodeName === 'BR') {
    tb.firstChild.remove();
    r = document.createRange(); r.setStart(tb, 0); r.collapse(true);
  }
  const nodes = Array.from(p.childNodes);
  if (!nodes.length) return;
  const frag = document.createDocumentFragment();
  nodes.forEach(n => frag.appendChild(n));
  const lastNode = nodes[nodes.length - 1];
  r.insertNode(frag);
  caretAfterNode(lastNode);
}
function pasteNodes(nodes) {
  if (!nodes.length) return;
  let r = getRange();
  if (!r) return;
  if (!r.collapsed) { deleteRangeSmart(r); r = getRange(); }
  if (nodes.length === 1 && nodes[0].tagName === 'P' && !closestIn(r.startContainer, 'pre')) { insertInlineFrom(nodes[0]); return; }
  // у callout/цитаті не вкладаємо інші callout-и: беремо їхній вміст
  const u = unitAtPoint(r.startContainer, r.startOffset);
  if (u && u.container !== editor) {
    const flat = [];
    nodes.forEach(n => { if (isTcBlock(n)) flat.push(...Array.from(n.children)); else flat.push(n); });
    nodes = flat;
  }
  const first = nodes[0], last = nodes[nodes.length - 1];
  const { left, right } = insertBlocks(nodes);
  if (left && left.isConnected && MERGEABLE.has(left.tagName) && first.tagName === 'P' && first !== last && !isEmptyBlock(left)) mergeBlocks(left, first);
  if (right && right.isConnected && last.isConnected && last.tagName === 'P' && MERGEABLE.has(right.tagName)) {
    const anchor = last.lastChild && last.lastChild.nodeName === 'BR' ? last.lastChild.previousSibling : last.lastChild;
    mergeBlocks(last, right);
    if (anchor) caretAfterNode(anchor); else caretStart(last);
  } else if (last.isConnected) placeCaretInBlock(last, 'end');
}
function pastePlainText(text) {
  text = String(text || '').replace(/\r\n?/g, '\n');
  if (!text) return;
  const r = getRange();
  if (!r) return;
  if (closestIn(r.startContainer, 'pre')) { insertTextAtCaret(text); return; }
  if (closestIn(r.startContainer, 'td,th,figcaption') || !text.includes('\n')) { insertTextAtCaret(text.replace(/\n+/g, ' ')); return; }
  pasteNodes(textToParagraphs(text.replace(/\n+$/, '')));
}
function looksLikeMarkdown(t) {
  const lines = t.split('\n');
  let score = 0;
  if (/^```/m.test(t)) score += 2;
  if (/^#{1,3} \S/m.test(t)) score += 2;
  if (/\*\*[^*\n]+\*\*/.test(t)) score++;
  if (lines.filter(l => /^\s*([-*+]|\d+\.) \S/.test(l)).length >= 2) score++;
  if (/^\|.+\|\s*$/m.test(t) && /^\|?\s*:?-{3,}/m.test(t)) score += 2;
  if (/\[[^\]]+\]\(https?:\/\/[^)]+\)/.test(t)) score++;
  return score >= 2;
}
editor.addEventListener('paste', e => {
  const cd = e.clipboardData;
  if (!cd) return;
  e.preventDefault();
  UI.deselectFigure();
  const r = getRange();
  if (!r) return;
  const inCode = !!closestIn(r.startContainer, 'pre');
  const files = [];
  if (cd.items) for (const it of cd.items) if (it.kind === 'file' && it.type.startsWith('image/')) { const f = it.getAsFile(); if (f) files.push(f); }
  if (!files.length && cd.files) for (const f of cd.files) if (f.type.startsWith('image/')) files.push(f);
  const text = cd.getData('text/plain');
  const html = cd.getData('text/html');
  if (files.length && !inCode && (!html || !/<(p|div|table|li|h\d)\b/i.test(html))) { insertImages(files); return; }
  if (inCode || closestIn(r.startContainer, 'figcaption')) { mutate(() => pastePlainText(text || (html ? new DOMParser().parseFromString(html, 'text/html').body.textContent : ''))); return; }
  if (html && html.replace(/<[^>]*>/g, '').trim() || html && /<img/i.test(html)) {
    const nodes = sanitizeHTML(html);
    if (nodes.length) { mutate(() => pasteNodes(nodes)); return; }
  }
  if (!text) return;
  mutate(() => pastePlainText(text));
  if (text.includes('\n') && looksLikeMarkdown(text)) {
    toast('Схоже на Markdown', '', {
      action: 'Відформатувати', duration: 7000,
      onAction: () => { History.undo(); mutate(() => pasteNodes(sanitizeHTML(mdToHtml(text), { own: false }))); },
    });
  }
});
function serializeRange(r) {
  const frag = r.cloneContents();
  const div = document.createElement('div');
  div.appendChild(frag);
  const pre = closestIn(r.commonAncestorContainer, 'pre');
  if (pre) return { html: '', text: div.textContent.replace(/\n$/, '') };
  $$('img[data-asset]', div).forEach(img => { const a = Assets.get(img.dataset.asset); if (a) img.src = a.data; });
  $$('[data-empty]', div).forEach(el => el.removeAttribute('data-empty'));
  const text = plainText(div);
  return { html: '<!--tc-own-->' + div.innerHTML, text };
}
editor.addEventListener('copy', e => {
  const r = editorRange();
  if (!r || r.collapsed || !e.clipboardData) return;
  e.preventDefault();
  const { html, text } = serializeRange(r);
  if (html) e.clipboardData.setData('text/html', html);
  e.clipboardData.setData('text/plain', text);
});
editor.addEventListener('cut', e => {
  const r = editorRange();
  if (!r || r.collapsed || !e.clipboardData) return;
  e.preventDefault();
  const { html, text } = serializeRange(r);
  if (html) e.clipboardData.setData('text/html', html);
  e.clipboardData.setData('text/plain', text);
  mutate(() => deleteRangeSmart(getRange()));
});

/* ═══════════════════════════ MARKDOWN ═══════════════════════════ */
function mdInline(s) {
  s = esc(s);
  const codes = [];
  s = s.replace(/`([^`\n]+)`/g, (m, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (m, alt, src) => '<img alt="' + alt + '" src="' + src + '">');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (m, t, u) => '<a href="' + u + '">' + t + '</a>');
  s = s.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '<strong>$2</strong>');
  s = s.replace(/(^|[^*\w])\*(?=\S)([^*\n]*?\S)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_\w])_(?=\S)([^_\n]*?\S)_(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<s>$1</s>');
  s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => '<code>' + codes[+i] + '</code>');
  return s;
}
function mdToHtml(md) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const isBlockStart = l => /^(#{1,6}\s|```|>|\s*([-*+]|\d+[.)])\s|\s*[-*_]{3,}\s*$|\|)/.test(l);
  while (i < lines.length) {
    let l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^```\s*([\w#+.-]*)/))) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push('<pre data-lang="' + esc(m[1]) + '"><code>' + esc(buf.join('\n')) + '</code></pre>');
      continue;
    }
    if ((m = l.match(/^(#{1,6})\s+(.*)$/))) { const lv = Math.min(3, m[1].length); out.push('<h' + lv + '>' + mdInline(m[2].replace(/\s#+\s*$/, '')) + '</h' + lv + '>'); i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    if (/^>/.test(l)) {
      const buf = [];
      while (i < lines.length && /^>/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push('<blockquote>' + mdToHtml(buf.join('\n')) + '</blockquote>');
      continue;
    }
    if (/^\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) { if (!/^\|?\s*:?-{3,}/.test(lines[i])) rows.push(lines[i]); i++; }
      const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => mdInline(c.trim()));
      out.push('<table><thead><tr>' + cells(rows[0]).map(c => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>' +
        rows.slice(1).map(r => '<tr>' + cells(r).map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table>');
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
      const parseList = (baseIndent) => {
        const first = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+/);
        const ordered = /\d/.test(first[2]);
        let task = false;
        const items = [];
        while (i < lines.length) {
          const mm = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
          if (!mm) { if (lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1].text += ' ' + lines[i].trim(); i++; continue; } break; }
          const ind = mm[1].length;
          if (ind < baseIndent) break;
          if (ind > baseIndent) { if (items.length) items[items.length - 1].sub = (items[items.length - 1].sub || '') + parseList(ind); continue; }
          let text = mm[3], chk = null;
          const tm = text.match(/^\[([ xX])\]\s+(.*)$/);
          if (tm) { task = true; chk = tm[1] !== ' '; text = tm[2]; }
          items.push({ text, chk });
          i++;
        }
        const tag = ordered ? 'ol' : 'ul';
        return '<' + tag + (task && !ordered ? ' class="tc-checklist"' : '') + '>' + items.map(it => '<li' + (task && !ordered ? ' data-checked="' + (it.chk ? 'true' : 'false') + '"' : '') + '>' + mdInline(it.text) + (it.sub || '') + '</li>').join('') + '</' + tag + '>';
      };
      out.push(parseList((l.match(/^\s*/) || [''])[0].length));
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !(buf.length && isBlockStart(lines[i]))) buf.push(lines[i++]);
    out.push('<p>' + buf.map(mdInline).join('<br>') + '</p>');
  }
  return out.join('');
}
function inlineMd(node, opts) {
  let s = '';
  node.childNodes.forEach(c => {
    if (c.nodeType === 3) { s += c.data.replace(ZW, '').replace(/([\\`*])/g, '\\$1'); return; }
    if (c.nodeType !== 1) return;
    const t = c.tagName;
    if (t === 'BR') { if (c.nextSibling) s += '  \n'; return; }
    if (t === 'CODE') { s += '`' + c.textContent + '`'; return; }
    const inner = inlineMd(c, opts);
    if (!inner.trim()) { s += inner; return; }
    if (t === 'STRONG' || t === 'B') s += '**' + inner + '**';
    else if (t === 'EM' || t === 'I') s += '*' + inner + '*';
    else if (t === 'S' || t === 'STRIKE' || t === 'DEL') s += '~~' + inner + '~~';
    else if (t === 'A' && c.getAttribute('href')) s += '[' + inner + '](' + c.getAttribute('href') + ')';
    else s += inner;
  });
  return s;
}
function blockMd(el, opts) {
  const t = el.tagName;
  if (/^H[1-3]$/.test(t)) { const s = inlineMd(el, opts).trim(); return s ? '#'.repeat(+t[1]) + ' ' + s : null; }
  if (t === 'P') { const s = inlineMd(el, opts).trim(); return s || null; }
  if (t === 'HR') return '---';
  if (t === 'PRE') return '```' + (el.dataset.lang || '') + '\n' + (el.textContent || '').replace(/\n$/, '') + '\n```';
  if (t === 'UL' || t === 'OL') return listMd(el, '', opts);
  if (t === 'BLOCKQUOTE') return Array.from(el.children).map(c => blockMd(c, opts)).filter(Boolean).join('\n\n').split('\n').map(l => '> ' + l).join('\n');
  if (isTcBlock(el) && el.classList.contains('tc-toggle')) {
    const [title, ...rest] = Array.from(el.children);
    const body = rest.map(c => blockMd(c, opts)).filter(Boolean).join('\n\n');
    return '<details>\n<summary>' + esc((title ? title.textContent : '').trim() || 'Відповідь') + '</summary>\n\n' + body + '\n\n</details>';
  }
  if (isTcBlock(el)) {
    const body = Array.from(el.children).map(c => blockMd(c, opts)).filter(Boolean).join('\n\n');
    if (el.classList.contains('tc-prompt')) return '```\n' + plainText(el) + '\n```';
    const label = (CALLOUT_TYPES[el.dataset.type] || CALLOUT_TYPES.tip).label;
    return ('**' + label + ':** ' + body).split('\n').map(l => '> ' + l).join('\n');
  }
  if (t === 'TABLE') {
    const rows = Array.from(el.rows).map(r => '| ' + Array.from(r.cells).map(c => inlineMd(c, opts).replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim() || ' ').join(' | ') + ' |');
    if (!rows.length) return null;
    const cols = el.rows[0].cells.length;
    rows.splice(1, 0, '|' + ' --- |'.repeat(cols));
    return rows.join('\n');
  }
  if (t === 'FIGURE') {
    const img = el.querySelector('img');
    const cap = (el.querySelector('figcaption') || {}).textContent || '';
    if (!img) return null;
    if (opts.embedImages) { const a = img.dataset.asset && Assets.get(img.dataset.asset); return '![' + cap.trim() + '](' + (a ? a.data : img.src) + ')'; }
    return img.dataset.asset ? '*[Зображення' + (cap.trim() ? ': ' + cap.trim() : '') + ']*' : '![' + cap.trim() + '](' + img.src + ')';
  }
  return inlineMd(el, opts).trim() || null;
}
function listMd(list, indent, opts) {
  const ordered = list.tagName === 'OL';
  const chk = list.classList.contains('tc-checklist');
  const out = [];
  Array.from(list.children).forEach((li, idx) => {
    const tmp = li.cloneNode(true);
    const subs = $$(':scope > ul, :scope > ol', tmp);
    subs.forEach(s => s.remove());
    let prefix = ordered ? (idx + 1) + '. ' : '- ';
    if (chk) prefix += li.dataset.checked === 'true' ? '[x] ' : '[ ] ';
    out.push(indent + prefix + inlineMd(tmp, opts).trim());
    $$(':scope > ul, :scope > ol', li).forEach(s => out.push(listMd(s, indent + (ordered ? '   ' : '  '), opts)));
  });
  return out.join('\n');
}
function toMarkdown(root, opts) {
  opts = opts || {};
  return Array.from(root.children).map(el => blockMd(el, opts)).filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
