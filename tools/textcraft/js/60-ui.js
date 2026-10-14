// TextCraft · Edvault — Інтерфейс: посилання, меню блоків, тости, вікна, поповери, команди, плаваючі панелі.
// Файли підключаються звичайними <script> по черзі й мають спільну глобальну область видимості.
'use strict';

/* ═══════════════════════════ ПОСИЛАННЯ ═══════════════════════════ */
let linkCtx = null;
function openLinkModal() {
  const r = getRange();
  if (!r) { toast('Поставте курсор у текст'); return; }
  if (inRestricted(r)) return;
  const a = closestIn(r.startContainer, 'a');
  linkCtx = { range: r.cloneRange(), a };
  $('#linkText').value = a ? a.textContent : r.toString();
  $('#linkUrl').value = a ? (a.getAttribute('href') || '') : '';
  $('#linkRemove').style.display = a ? '' : 'none';
  $('#linkModalTitle').textContent = a ? 'Змінити посилання' : 'Додати посилання';
  Modal.open('linkModal');
  setTimeout(() => { const u = $('#linkUrl'); u.focus(); u.select(); }, 40);
}
function confirmLink() {
  if (!linkCtx) return;
  let url = $('#linkUrl').value.trim();
  const text = $('#linkText').value;
  if (!url) { $('#linkUrl').focus(); return; }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith('#')) url = (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url) ? 'mailto:' : 'https://') + url;
  const href = safeHref(url);
  if (!href) { toast('Некоректна адреса посилання', 'err'); return; }
  const ctx = linkCtx;
  Modal.close('linkModal');
  mutate(() => {
    focusEditor();
    if (ctx.a && ctx.a.isConnected) {
      ctx.a.setAttribute('href', href);
      if (text && text !== ctx.a.textContent) ctx.a.textContent = text;
      setExternal(ctx.a);
      caretAfterNode(ctx.a);
      return;
    }
    setSel(ctx.range);
    const r = getRange();
    if (!r.collapsed && (!text || text === r.toString()) && !crossesBlocks(r)) {
      exec('createLink', href);
      $$('a', editor).filter(a => a.getAttribute('href') === href).forEach(setExternal);
      const rr = getRange(); if (rr) { rr.collapse(false); setSel(rr); }
      return;
    }
    if (!r.collapsed) r.deleteContents();
    const a = document.createElement('a');
    a.href = href;
    setExternal(a);
    a.textContent = text || url;
    const rr = getRange();
    rr.insertNode(a);
    caretAfterNode(a);
  });
}
function setExternal(a) { if (/^https?:/i.test(a.getAttribute('href') || '')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } else { a.removeAttribute('target'); a.removeAttribute('rel'); } }
function removeLink(a) {
  if (!a) return;
  mutate(() => { const last = a.lastChild; while (a.firstChild) a.before(a.firstChild); a.remove(); if (last) caretAfterNode(last); });
}

/* ═══════════════════════════ ВСТАВКА БЛОКІВ (меню, «/») ═══════════════════════════ */
const BLOCK_ITEMS = [
  { id: 'p', label: 'Звичайний текст', icon: 'text', kw: 'text p текст абзац звичайний' },
  { id: 'h1', label: 'Заголовок 1', txt: 'H1', kw: 'h1 heading заголовок великий' },
  { id: 'h2', label: 'Заголовок 2', txt: 'H2', kw: 'h2 heading заголовок середній' },
  { id: 'h3', label: 'Заголовок 3', txt: 'H3', kw: 'h3 heading заголовок підзаголовок малий' },
  { id: 'ul', label: 'Маркований список', icon: 'ul', kw: 'list ul bullet список маркований' },
  { id: 'ol', label: 'Нумерований список', icon: 'ol', kw: 'ol numbered список нумерований' },
  { id: 'check', label: 'Чекліст', icon: 'checklist', kw: 'todo check checklist чекліст задачі завдання' },
  { id: 'quote', label: 'Цитата', icon: 'quote', kw: 'quote цитата' },
  { id: 'callout:tip', label: 'Порада', icon: 'bulb', cls: 'c-tip', kw: 'callout tip порада підказка' },
  { id: 'callout:success', label: 'Добре знати', icon: 'success', cls: 'c-success', kw: 'callout success результат добре знати' },
  { id: 'callout:warn', label: 'Увага', icon: 'warn', cls: 'c-warn', kw: 'callout warning увага попередження' },
  { id: 'callout:error', label: 'Помилка / не робити', icon: 'error', cls: 'c-error', kw: 'callout error помилка не робити' },
  { id: 'callout:note', label: 'Нотатка', icon: 'note', cls: 'c-note', kw: 'callout note нотатка замітка' },
  { id: 'toggle', label: 'Розгортальний блок', sub: 'Відповідь чи підказка — відкривається кліком', icon: 'toggleBlock', cls: 'c-tip', kw: 'toggle details розгорнути відповідь підказка прихований спойлер' },
  { id: 'prompt', label: 'Промпт', sub: 'Блок з кнопкою «Копіювати»', icon: 'prompt', cls: 'c-prompt', kw: 'prompt промпт ai chatgpt claude' },
  { id: 'codeblock', label: 'Блок коду', icon: 'codeblock', cls: 'c-code', kw: 'code код програма' },
  { id: 'table', label: 'Таблиця', sub: '3 × 3', icon: 'table', kw: 'table таблиця' },
  { id: 'image', label: 'Зображення', icon: 'image', kw: 'image img картинка зображення фото' },
  { id: 'hr', label: 'Розділювач', icon: 'hr', kw: 'hr divider розділювач лінія' },
];
function applyItem(id) {
  if (id === 'p' || /^h[1-3]$/.test(id)) return doSetBlockTag(id);
  if (id === 'quote') return doToggleQuote();
  if (id === 'ul' || id === 'ol' || id === 'check') return doToggleList(id);
  if (id.startsWith('callout:')) return doInsertNewBlock('callout', id.split(':')[1]);
  if (id === 'prompt') return doInsertNewBlock('prompt');
  if (id === 'toggle') return doInsertNewBlock('toggle');
  if (id === 'codeblock') return doInsertNewBlock('code');
  if (id === 'table') return doInsertTable(3, 3);
  if (id === 'hr') return doInsertHr();
}
const Slash = {
  open: false, block: null, items: [], idx: 0,
  check(inputType, data) {
    const r = editorRange();
    if (!r || !r.collapsed) { this.close(); return; }
    const tb = textBlockOf(r.startContainer);
    if (!tb || tb.tagName !== 'P' || closestIn(tb, 'td,th,figure,pre,li')) { this.close(); return; }
    const txt = tb.textContent.replace(ZW, '');
    if (!txt.startsWith('/') || txt.length > 30 || txt.includes('\n')) { this.close(); return; }
    if (!this.open && !(inputType === 'insertText' && data === '/' && txt === '/')) return;
    this.block = tb;
    const q = txt.slice(1).trim().toLowerCase();
    this.items = BLOCK_ITEMS.filter(it => !q || it.label.toLowerCase().includes(q) || it.kw.includes(q));
    if (!this.items.length && q.length > 2) { this.close(); return; }
    if (!this.open) this.idx = 0;
    this.idx = clamp(this.idx, 0, Math.max(0, this.items.length - 1));
    this.open = true;
    this.render();
    this.position(r);
  },
  render() {
    const pop = $('#slashPop');
    pop.innerHTML = '<div class="menu-label">Вставити блок</div>' + (this.items.length ? this.items.map((it, i) =>
      '<button class="menu-item' + (i === this.idx ? ' kb' : '') + '" data-i="' + i + '"><span class="mi-ico ' + (it.cls || '') + '">' + (it.icon ? icon(it.icon) : '<b style="font-size:11px">' + it.txt + '</b>') + '</span><span class="mi-txt">' + it.label + (it.sub ? '<span class="mi-sub">' + it.sub + '</span>' : '') + '</span></button>'
    ).join('') : '<div class="toc-empty">Нічого не знайдено</div>');
    pop.classList.add('open');
    const kb = pop.querySelector('.kb');
    if (kb) kb.scrollIntoView({ block: 'nearest' });
  },
  position(r) {
    const pop = $('#slashPop');
    let rect = r.getClientRects()[0];
    if (!rect || (!rect.width && !rect.height)) rect = this.block.getBoundingClientRect();
    pop.style.maxHeight = '340px';
    const h = Math.min(pop.scrollHeight, 340), w = pop.offsetWidth || 260;
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - 10) top = Math.max(10, rect.top - h - 6);
    pop.style.top = top + 'px';
    pop.style.left = clamp(rect.left, 8, window.innerWidth - w - 8) + 'px';
  },
  onKey(e) {
    if (!this.open) return false;
    const n = this.items.length;
    if (e.key === 'ArrowDown' && n) { e.preventDefault(); this.idx = (this.idx + 1) % n; this.render(); return true; }
    if (e.key === 'ArrowUp' && n) { e.preventDefault(); this.idx = (this.idx - 1 + n) % n; this.render(); return true; }
    if ((e.key === 'Enter' || e.key === 'Tab') && n) { e.preventDefault(); this.choose(this.items[this.idx]); return true; }
    if (e.key === 'Escape') { e.preventDefault(); this.close(); return true; }
    return false;
  },
  choose(item) {
    const tb = this.block;
    this.close();
    if (!tb || !tb.isConnected) return;
    mutate(() => {
      tb.textContent = '';
      tb.appendChild(document.createElement('br'));
      caretStart(tb);
      if (item.id !== 'image') applyItem(item.id);
    });
    if (item.id === 'image') pickImage();
  },
  close() {
    if (!this.open) return;
    this.open = false;
    this.block = null;
    $('#slashPop').classList.remove('open');
  },
};
$('#slashPop').addEventListener('mousedown', e => e.preventDefault());
$('#slashPop').addEventListener('click', e => {
  const b = e.target.closest('[data-i]');
  if (b) Slash.choose(Slash.items[+b.dataset.i]);
});

/* ═══════════════════════════ ТОСТИ / МОДАЛКИ / ПІДКАЗКИ ═══════════════════════════ */
let toastTimer = null;
function toast(msg, type, opts) {
  opts = opts || {};
  const t = $('#toast');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.innerHTML = '<span>' + esc(msg) + '</span>' + (opts.action ? '<button class="t-act">' + esc(opts.action) + '</button>' : '');
  if (opts.action) t.querySelector('.t-act').onclick = () => { t.classList.remove('show'); opts.onAction(); };
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), opts.duration || 2600);
}
let confirmResolve = null;
const Modal = {
  stack: [],
  open(id) { $('#' + id).classList.add('open'); this.stack = this.stack.filter(x => x !== id).concat(id); Tip.hide(); },
  close(id) {
    id = id || this.stack[this.stack.length - 1];
    if (!id) return;
    $('#' + id).classList.remove('open');
    this.stack = this.stack.filter(x => x !== id);
    if (id === 'confirmModal' && confirmResolve) { const r = confirmResolve; confirmResolve = null; r(false); }
  },
  isOpen() { return this.stack.length > 0; },
};
function confirmDialog(title, msg, okLabel, danger) {
  return new Promise(res => {
    confirmResolve = res;
    $('#confirmTitle').textContent = title;
    $('#confirmMsg').textContent = msg;
    const ok = $('#confirmOk');
    ok.textContent = okLabel || 'Так';
    ok.style.background = danger ? 'var(--danger)' : '';
    ok.style.borderColor = danger ? 'var(--danger)' : '';
    Modal.open('confirmModal');
    setTimeout(() => ok.focus(), 30);
  });
}
$('#confirmOk').addEventListener('click', () => { const r = confirmResolve; confirmResolve = null; Modal.close('confirmModal'); if (r) r(true); });
$('#confirmCancel').addEventListener('click', () => Modal.close('confirmModal'));
$$('.overlay').forEach(ov => {
  ov.addEventListener('mousedown', e => { if (e.target === ov) Modal.close(ov.id); });
  $$('[data-close]', ov).forEach(b => b.addEventListener('click', () => Modal.close(ov.id)));
});

const Tip = {
  el: $('#tip'), target: null, timer: null,
  show(t) {
    let text = t.getAttribute('data-tip');
    if (!text) return;
    let kbd = t.getAttribute('data-kbd');
    if (kbd && IS_MAC) kbd = kbd.replace(/Ctrl/g, '⌘').replace(/Alt/g, '⌥').replace(/Shift/g, '⇧');
    this.el.innerHTML = esc(text) + (kbd ? '<span class="k">' + esc(kbd) + '</span>' : '');
    this.el.classList.add('show');
    const r = t.getBoundingClientRect();
    const w = this.el.offsetWidth, h = this.el.offsetHeight;
    let top = r.bottom + 8;
    if (top + h > window.innerHeight - 6) top = r.top - h - 8;
    this.el.style.top = top + 'px';
    this.el.style.left = clamp(r.left + r.width / 2 - w / 2, 6, window.innerWidth - w - 6) + 'px';
  },
  hide() { clearTimeout(this.timer); this.target = null; this.el.classList.remove('show'); },
};
const coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)') : { matches: false };
document.addEventListener('mouseover', e => {
  if (coarse.matches) return;
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (t === Tip.target) return;
  Tip.hide();
  if (!t) return;
  Tip.target = t;
  Tip.timer = setTimeout(() => Tip.show(t), 380);
});
document.addEventListener('mousedown', () => Tip.hide(), true);
window.addEventListener('scroll', () => Tip.hide(), true);

/* ═══════════════════════════ ПОПОВЕРИ ═══════════════════════════ */
const Pop = {
  anchor: null, onPick: null,
  open(anchor, html, onPick, opts) {
    opts = opts || {};
    const pop = $('#pop');
    if (this.anchor === anchor && pop.classList.contains('open')) { this.close(); return; }
    this.anchor = anchor;
    this.onPick = onPick;
    pop.innerHTML = html;
    pop.style.minWidth = (opts.minWidth || 200) + 'px';
    pop.classList.add('open');
    if (opts.onMount) opts.onMount(pop);
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    let left = opts.alignRight ? r.right - w : r.left;
    pop.style.top = top + 'px';
    pop.style.left = clamp(left, 8, window.innerWidth - w - 8) + 'px';
    Tip.hide();
  },
  close() { $('#pop').classList.remove('open'); this.anchor = null; this.onPick = null; },
  isOpen() { return $('#pop').classList.contains('open'); },
};
$('#pop').addEventListener('mousedown', e => { if (!e.target.closest('input,select')) e.preventDefault(); });
$('#pop').addEventListener('click', e => {
  const b = e.target.closest('[data-v]');
  if (!b || !Pop.onPick) return;
  const pick = Pop.onPick;
  const keep = pick(b.dataset.v, b);
  if (!keep) Pop.close();
});
document.addEventListener('mousedown', e => {
  if (!Pop.isOpen()) return;
  if (e.target.closest('#pop') || (Pop.anchor && Pop.anchor.contains(e.target))) return;
  Pop.close();
});
function menuItem(v, label, opts) {
  opts = opts || {};
  return '<button class="menu-item' + (opts.on ? ' on' : '') + (opts.danger ? ' danger' : '') + '" data-v="' + esc(v) + '">' +
    (opts.icon || opts.txt ? '<span class="mi-ico ' + (opts.cls || '') + '">' + (opts.icon ? icon(opts.icon) : '<b style="font-size:11px">' + opts.txt + '</b>') + '</span>' : '') +
    '<span class="mi-txt">' + (opts.labelHtml || esc(label)) + (opts.sub ? '<span class="mi-sub">' + esc(opts.sub) + '</span>' : '') + '</span>' +
    (opts.kbd ? '<span class="mi-kbd">' + esc(IS_MAC ? opts.kbd.replace(/Ctrl/g, '⌘') : opts.kbd) + '</span>' : '') + '</button>';
}

/* ═══════════════════════════ КОМАНДИ ═══════════════════════════ */
function blockCmd(kind, sub) {
  let r = getRange();
  if (!r) { caretEnd(lastTextBlock(editor)); r = getRange(); }
  if (!r) return;
  if (!r.collapsed) wrapSelectionAsBlock(kind, sub);
  else insertNewBlock(kind, sub);
}
function insertAtom(fn) {
  let r = getRange();
  if (!r) { caretEnd(lastTextBlock(editor)); }
  mutate(fn);
}
const CMD = {
  undo: () => History.undo(),
  redo: () => History.redo(),
  bold: () => inlineCmd('bold'),
  italic: () => inlineCmd('italic'),
  underline: () => inlineCmd('underline'),
  strike: () => inlineCmd('strikeThrough'),
  code: toggleInlineCode,
  clear: clearFormatting,
  link: openLinkModal,
  fontUp: () => changeFontSize(1),
  fontDown: () => changeFontSize(-1),
  p: () => blockTextCmd(() => doSetBlockTag('p')),
  h1: () => blockTextCmd(() => doSetBlockTag('h1')),
  h2: () => blockTextCmd(() => doSetBlockTag('h2')),
  h3: () => blockTextCmd(() => doSetBlockTag('h3')),
  quote: () => blockTextCmd(doToggleQuote),
  ul: () => blockTextCmd(() => doToggleList('ul')),
  ol: () => blockTextCmd(() => doToggleList('ol')),
  check: () => blockTextCmd(() => doToggleList('check')),
  prompt: () => blockCmd('prompt'),
  codeblock: () => blockCmd('code'),
  image: pickImage,
  hr: () => insertAtom(doInsertHr),
  table: () => insertAtom(() => doInsertTable(3, 3)),
  alignLeft: () => blockTextCmd(() => exec('justifyLeft')),
  alignCenter: () => blockTextCmd(() => exec('justifyCenter')),
  alignRight: () => blockTextCmd(() => exec('justifyRight')),
  alignJustify: () => blockTextCmd(() => exec('justifyFull')),
};
Object.keys(CALLOUT_TYPES).forEach(t => { CMD['callout:' + t] = () => blockCmd('callout', t); });
CMD.toggle = () => blockCmd('toggle');
function run(name) {
  if (name !== 'undo' && name !== 'redo') UI.deselectFigure();
  const f = CMD[name];
  if (f) f();
  UI.refreshSoon();
}
// Перетворення виділеного (з плаваючої панелі та меню «Блок»)
function convertSelection(v) {
  const r = getRange();
  if (!r) return;
  if (v === 'p') {
    const blk = closestIn(r.startContainer, '.tc-block,pre');
    if (blk) { mutate(() => unwrapBlock(blk)); return; }
    const bq = closestIn(r.startContainer, 'blockquote');
    if (bq) { blockTextCmd(doToggleQuote); return; }
    CMD.p();
    return;
  }
  if (v === 'quote') { CMD.quote(); return; }
  if (v === 'prompt') { blockCmd('prompt'); return; }
  if (v === 'toggle') { blockCmd('toggle'); return; }
  if (v === 'code') { blockCmd('code'); return; }
  if (v.startsWith('callout:')) blockCmd('callout', v.split(':')[1]);
}
function convertMenuHtml() {
  return '<div class="menu-label">Перетворити на</div>' +
    menuItem('p', 'Звичайний текст', { icon: 'text' }) +
    menuItem('quote', 'Цитата', { icon: 'quote' }) +
    Object.keys(CALLOUT_TYPES).map(t => menuItem('callout:' + t, CALLOUT_TYPES[t].label, { icon: CALLOUT_TYPES[t].icon, cls: 'c-' + t })).join('') +
    menuItem('toggle', 'Розгортальний блок', { icon: 'toggleBlock', sub: 'відкривається кліком' }) +
    menuItem('prompt', 'Промпт', { icon: 'prompt', cls: 'c-prompt', sub: 'з кнопкою «Копіювати»' }) +
    menuItem('code', 'Блок коду', { icon: 'codeblock', cls: 'c-code' });
}

/* ═══════════════════════════ ПЛАВАЮЧІ ПАНЕЛІ ═══════════════════════════ */
let mouseDown = false;
document.addEventListener('mousedown', () => { mouseDown = true; });
document.addEventListener('mouseup', () => { mouseDown = false; UI.refreshSoon(); });

function bar(items) {
  return items.map(it => {
    if (it === '|') return '<span class="fsep"></span>';
    if (it.html) return it.html;
    return '<button class="fb' + (it.cls ? ' ' + it.cls : '') + (it.on ? ' on' : '') + '" data-b="' + esc(it.b) + '"' + (it.tip ? ' data-tip="' + esc(it.tip) + '"' : '') + (it.kbd ? ' data-kbd="' + esc(it.kbd) + '"' : '') + '>' +
      (it.icon ? icon(it.icon) : '') + (it.dot ? '<span class="dot" style="background:' + it.dot + '"></span>' : '') + (it.label ? '<span>' + esc(it.label) + '</span>' : '') + '</button>';
  }).join('');
}
function placeBar(el, rect, opts) {
  opts = opts || {};
  el.classList.add('show');
  const bw = el.offsetWidth, bh = el.offsetHeight;
  const area = scrollArea.getBoundingClientRect();
  let top;
  if (opts.top != null) top = opts.top;
  else if (opts.below) { top = rect.bottom + 8; if (top + bh > window.innerHeight - 8) top = rect.top - bh - 8; }
  else { top = rect.top - bh - 8; if (top < area.top + 4) top = rect.bottom + 8; }
  let left = opts.right != null ? opts.right - bw : (opts.left != null ? opts.left : rect.left + rect.width / 2 - bw / 2);
  el.style.top = Math.round(top) + 'px';
  el.style.left = Math.round(clamp(left, 8, window.innerWidth - bw - 8)) + 'px';
}
function visibleInArea(rect) {
  const a = scrollArea.getBoundingClientRect();
  return rect.bottom > a.top + 4 && rect.top < a.bottom - 4;
}

const UI = {
  raf: null, selectedFigure: null, currentTable: null, hoverBlock: null, activeBlock: null, blockBarKey: '',
  refreshSoon() { if (this.raf) return; this.raf = requestAnimationFrame(() => { this.raf = null; this.sync(); }); },
  hideTransient() {
    this.deselectFigure();
    ['#selBar', '#blockBar', '#tableBar', '#linkBar'].forEach(s => $(s).classList.remove('show'));
    this.activeBlock = null; this.hoverBlock = null; this.blockBarKey = '';
    Slash.close();
    Pop.close();
  },
  sync() {
    const r = editorRange();
    this.syncToolbar(r);
    // Панель виділення
    const sb = $('#selBar');
    const showSel = r && !r.collapsed && !mouseDown && !this.selectedFigure && !closestIn(r.commonAncestorContainer, 'pre') && r.toString().trim().length > 0 && !Modal.isOpen();
    if (showSel) {
      this.renderSelBar(r);
      let rect = r.getBoundingClientRect();
      if (!rect.width && !rect.height) rect = (r.getClientRects()[0] || elOf(r.startContainer).getBoundingClientRect());
      if (visibleInArea(rect)) placeBar(sb, rect, { below: coarse.matches }); else sb.classList.remove('show');
    } else sb.classList.remove('show');
    // Посилання під курсором
    const lb = $('#linkBar');
    const a = r && r.collapsed && !showSel ? closestIn(r.startContainer, 'a[href]') : null;
    if (a) {
      const href = a.getAttribute('href');
      lb.innerHTML = '<a class="link-url" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer" data-tip="Відкрити в новій вкладці">' + esc(href.replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</a>' +
        bar(['|', { b: 'open', icon: 'external', tip: 'Відкрити' }, { b: 'copy', icon: 'copy', tip: 'Копіювати адресу' }, { b: 'edit', icon: 'edit', tip: 'Змінити' }, { b: 'unlink', icon: 'unlink', tip: 'Прибрати посилання', cls: 'danger' }]);
      lb._a = a;
      placeBar(lb, a.getBoundingClientRect(), { below: true });
    } else { lb.classList.remove('show'); lb._a = null; }
    // Таблиця
    const tbar = $('#tableBar');
    const cell = r ? closestIn(r.startContainer, 'td,th') : null;
    this.currentTable = cell ? cell.closest('table') : null;
    if (this.currentTable && !showSel) {
      if (!tbar.innerHTML) tbar.innerHTML = bar([
        { b: 'm:rows', icon: 'tRows', label: 'Рядки', tip: 'Додати чи видалити рядок' },
        { b: 'm:cols', icon: 'tCols', label: 'Стовпці', tip: 'Додати, видалити, ширина' },
        { b: 'm:cell', icon: 'tCell', label: 'Клітинка', tip: 'Об’єднати, колір' },
        { b: 'm:look', icon: 'tLook', label: 'Вигляд', tip: 'Заголовок, смуги' }, '|',
        { b: 'rowBelow', icon: 'rowBelow', tip: 'Швидко: рядок нижче' }, { b: 'colRight', icon: 'colRight', tip: 'Швидко: стовпець праворуч' },
      ]);
      const tr = this.currentTable.getBoundingClientRect();
      const area = scrollArea.getBoundingClientRect();
      if (visibleInArea(tr)) {
        const bh = tbar.offsetHeight || 38;
        let top = tr.top - bh - 8;
        if (top < area.top + 4) top = Math.min(area.top + 6, tr.bottom - bh);
        placeBar(tbar, tr, { top, left: tr.left });
      } else tbar.classList.remove('show');
    } else tbar.classList.remove('show');
    // Панель блоку (callout / промпт / код)
    const caretBlock = r ? closestIn(r.startContainer, '.tc-block,pre.tc-code') : null;
    this.activeBlock = (this.hoverBlock && this.hoverBlock.isConnected ? this.hoverBlock : null) || caretBlock;
    this.renderBlockBar(showSel);
    // Зображення
    this.positionFigure();
    // Статус виділення
    const selTxt = r && !r.collapsed ? r.toString().trim() : '';
    $('#stSel').textContent = selTxt ? 'Виділено: ' + countWords(selTxt) + ' сл.' : '';
  },
  syncToolbar(r) {
    const on = (id, v) => { const el = $('#' + id); if (el) el.classList.toggle('on', !!v); };
    if (!r) return;
    const q = c => { try { return document.queryCommandState(c); } catch (e) { return false; } };
    const inPre = !!closestIn(r.startContainer, 'pre');
    on('tb-bold', !inPre && q('bold'));
    on('tb-italic', !inPre && q('italic'));
    on('tb-underline', !inPre && q('underline'));
    on('tb-strike', !inPre && q('strikeThrough'));
    on('tb-code', !inPre && !!closestIn(r.startContainer, 'code'));
    on('tb-link', !!closestIn(r.startContainer, 'a[href]'));
    const chk = closestIn(r.startContainer, 'ul.tc-checklist');
    on('tb-check', !!chk);
    on('tb-ul', !chk && !!closestIn(r.startContainer, 'ul'));
    on('tb-ol', !!closestIn(r.startContainer, 'ol'));
    on('tb-quote', !!closestIn(r.startContainer, 'blockquote'));
    const tb = textBlockOf(r.startContainer);
    let label = 'Звичайний текст';
    if (inPre) label = 'Блок коду';
    else if (tb) {
      const t = tb.tagName;
      if (t === 'H1') label = 'Заголовок 1'; else if (t === 'H2') label = 'Заголовок 2'; else if (t === 'H3') label = 'Заголовок 3';
      else if (t === 'LI') label = chk ? 'Чекліст' : (closestIn(tb, 'ol') ? 'Нумерований список' : 'Маркований список');
      else if (t === 'TD' || t === 'TH') label = 'Таблиця';
      else if (t === 'FIGCAPTION') label = 'Підпис';
      else if (closestIn(tb, 'blockquote')) label = 'Цитата';
    }
    $('#blockStyleLabel').textContent = label;
    $('#sizeVal').textContent = currentFontSize();
    const align = tb ? getComputedStyle(tb).textAlign : 'left';
    const aIco = { center: 'alignCenter', right: 'alignRight', justify: 'alignJustify' }[align] || 'alignLeft';
    const ab = $('#tb-align');
    if (ab.dataset.cur !== aIco) { ab.dataset.cur = aIco; ab.innerHTML = icon(aIco); }
    ab.classList.toggle('on', aIco !== 'alignLeft');
  },
  renderSelBar(r) {
    const q = c => { try { return document.queryCommandState(c); } catch (e) { return false; } };
    const tb = textBlockOf(r.startContainer);
    const tag = tb ? tb.tagName : '';
    const html = bar([
      { b: 'bold', icon: 'bold', tip: 'Жирний', kbd: 'Ctrl+B', on: q('bold') },
      { b: 'italic', icon: 'italic', tip: 'Курсив', kbd: 'Ctrl+I', on: q('italic') },
      { b: 'underline', icon: 'underline', tip: 'Підкреслення', kbd: 'Ctrl+U', on: q('underline') },
      { b: 'strike', icon: 'strike', tip: 'Закреслення', on: q('strikeThrough') },
      { b: 'code', icon: 'code', tip: 'Код у рядку', kbd: 'Ctrl+E', on: !!closestIn(r.startContainer, 'code') },
      { b: 'link', icon: 'link', tip: 'Посилання', kbd: 'Ctrl+K', on: !!closestIn(r.startContainer, 'a') },
      { b: 'color', icon: 'color', tip: 'Колір тексту' },
      '|',
      { b: 'h1', label: 'H1', tip: 'Заголовок 1', on: tag === 'H1' },
      { b: 'h2', label: 'H2', tip: 'Заголовок 2', on: tag === 'H2' },
      { b: 'h3', label: 'H3', tip: 'Заголовок 3', on: tag === 'H3' },
      '|',
      { b: 'convert', label: 'Блок', icon: 'prompt', tip: 'Зробити промпт, callout, код чи цитату з виділеного' },
      { b: 'clear', icon: 'eraser', tip: 'Очистити форматування' },
    ]);
    const sb = $('#selBar');
    if (sb._html !== html) { sb.innerHTML = html; sb._html = html; }
  },
  renderBlockBar(hideForSel) {
    const bb = $('#blockBar');
    const b = this.activeBlock;
    if (!b || !b.isConnected || hideForSel || this.selectedFigure) { bb.classList.remove('show'); this.blockBarKey = ''; return; }
    const rect = b.getBoundingClientRect();
    if (!visibleInArea(rect)) { bb.classList.remove('show'); return; }
    let key, items;
    if (isCode(b)) {
      key = 'code:' + (b.dataset.lang || '');
      items = [
        { b: 'lang', label: langLabel(b.dataset.lang || ''), icon: 'chevron', tip: 'Мова коду' }, '|',
        { b: 'copy', label: 'Копіювати', icon: 'copy', cls: 'primary' },
        { b: 'unwrap', icon: 'text', tip: 'Перетворити на звичайний текст' },
        { b: 'delete', icon: 'trash', tip: 'Видалити блок', cls: 'danger' },
      ];
    } else if (b.classList.contains('tc-toggle')) {
      const col = b.hasAttribute('data-collapsed');
      key = 'toggle:' + col;
      items = [
        { b: 'collapse', icon: 'chevron', label: col ? 'Розгорнути' : 'Згорнути', tip: 'Лише для зручності редагування — у збереженому HTML блок завжди згорнутий' },
        { b: 'convert', icon: 'more', tip: 'Змінити тип блоку' },
        { b: 'unwrap', icon: 'text', tip: 'Прибрати оформлення (текст залишиться)' },
        { b: 'delete', icon: 'trash', tip: 'Видалити блок разом з текстом', cls: 'danger' },
      ];
    } else if (b.classList.contains('tc-prompt')) {
      key = 'prompt';
      items = [
        { b: 'copy', label: 'Копіювати', icon: 'copy', cls: 'primary' },
        { b: 'convert', icon: 'more', tip: 'Змінити тип блоку' },
        { b: 'unwrap', icon: 'text', tip: 'Прибрати оформлення (текст залишиться)' },
        { b: 'delete', icon: 'trash', tip: 'Видалити блок разом з текстом', cls: 'danger' },
      ];
    } else {
      key = 'callout:' + b.dataset.type;
      const cols = { tip: 'var(--tip-ac)', success: 'var(--ok-ac)', warn: 'var(--warn-ac)', error: 'var(--err-ac)', note: 'var(--note-ac)' };
      items = Object.keys(CALLOUT_TYPES).map(t => ({ b: 'type:' + t, dot: cols[t], tip: CALLOUT_TYPES[t].label, on: b.dataset.type === t }));
      items.push('|', { b: 'toPrompt', icon: 'prompt', tip: 'Перетворити на промпт' }, { b: 'unwrap', icon: 'text', tip: 'Прибрати оформлення (текст залишиться)' }, { b: 'delete', icon: 'trash', tip: 'Видалити блок разом з текстом', cls: 'danger' });
    }
    if (this.blockBarKey !== key || !bb.classList.contains('show')) { bb.innerHTML = bar(items); this.blockBarKey = key; }
    bb._block = b;
    bb.classList.add('show');
    const bw = bb.offsetWidth, bh = bb.offsetHeight;
    const area = scrollArea.getBoundingClientRect();
    let top;
    if (isTcBlock(b) && b.classList.contains('tc-callout')) top = rect.top - bh / 2;
    else top = rect.top + 3;
    if (top < area.top + 4 && rect.bottom > area.top + bh + 20) top = area.top + 4;
    placeBar(bb, rect, { top, right: rect.right - 8 });
  },
  selectFigure(fig) {
    if (!fig || !editor.contains(fig)) return;
    if (this.selectedFigure === fig) { this.positionFigure(); return; }
    this.selectedFigure = fig;
    focusEditor();
    window.getSelection().removeAllRanges();
    const w = parseInt(fig.style.getPropertyValue('--w'), 10) || 0;
    const al = fig.dataset.align || 'center';
    const wrap = fig.dataset.wrap || '';
    const sizes = wrap ? [['w25', 'S', 25], ['w35', 'M', 35], ['w50', 'L', 50], ['w65', 'XL', 65]] : [['w25', 'S', 25], ['w50', 'M', 50], ['w75', 'L', 75], ['w100', 'XL', 100]];
    $('#imgBar').innerHTML = bar([
      ...sizes.map(([b, label, n]) => ({ b, label, tip: 'Ширина ' + n + '%', on: w === n })),
      ...(wrap ? [] : [{ b: 'w0', label: 'Авто', tip: 'Оригінальний розмір', on: !w }]), '|',
      { b: 'wrapleft', icon: 'wrapLeft', tip: 'Фото ліворуч, текст праворуч', on: wrap === 'left' },
      { b: 'acenter', icon: 'alignCenter', tip: 'Окремо, по центру', on: !wrap && al === 'center' },
      { b: 'wrapright', icon: 'wrapRight', tip: 'Фото праворуч, текст ліворуч', on: wrap === 'right' }, '|',
      { b: 'caption', icon: 'text', tip: 'Додати підпис' }, { b: 'view', icon: 'expand', tip: 'Переглянути' },
      { b: 'delete', icon: 'trash', tip: 'Видалити зображення', cls: 'danger' },
    ]);
    ['#selBar', '#linkBar', '#blockBar'].forEach(s => $(s).classList.remove('show'));
    this.positionFigure();
  },
  deselectFigure() {
    if (!this.selectedFigure) return;
    this.selectedFigure = null;
    $('#imgBar').classList.remove('show');
    $('#figOutline').classList.remove('show');
    $('#figHandle').classList.remove('show');
  },
  positionFigure() {
    const fig = this.selectedFigure;
    if (!fig) return;
    if (!fig.isConnected) { this.deselectFigure(); return; }
    const img = fig.querySelector('img');
    const r = img.getBoundingClientRect();
    if (!visibleInArea(r)) { $('#imgBar').classList.remove('show'); $('#figOutline').classList.remove('show'); $('#figHandle').classList.remove('show'); return; }
    const o = $('#figOutline');
    o.style.left = (r.left - 3) + 'px'; o.style.top = (r.top - 3) + 'px'; o.style.width = (r.width + 6) + 'px'; o.style.height = (r.height + 6) + 'px';
    o.classList.add('show');
    const h = $('#figHandle');
    h.style.left = (r.right - 9) + 'px'; h.style.top = (r.bottom - 9) + 'px';
    h.classList.add('show');
    placeBar($('#imgBar'), r, {});
  },
  deleteSelectedFigure() {
    const f = this.selectedFigure;
    if (!f) return;
    this.deselectFigure();
    mutate(() => {
      const next = f.nextElementSibling, prev = f.previousElementSibling;
      f.remove();
      if (next && MERGEABLE.has(next.tagName)) caretStart(next);
      else if (prev) placeCaretInBlock(prev, 'end');
      else { const p = emptyP(); editor.prepend(p); caretStart(p); }
    });
  },
  figureKey(e) {
    const f = this.selectedFigure;
    if (!f) return false;
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.deleteSelectedFigure(); return true; }
    if (e.key === 'Escape') { e.preventDefault(); this.deselectFigure(); caretAfterBlock(f); return true; }
    if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); this.deselectFigure(); mutate(() => caretAfterBlock(f)); return true; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault(); this.deselectFigure();
      const prev = f.previousElementSibling;
      if (prev) placeCaretInBlock(prev, 'end'); else mutate(() => { const p = emptyP(); f.before(p); caretStart(p); });
      return true;
    }
    if (mod && (e.code === 'KeyC' || e.code === 'KeyX')) {
      e.preventDefault();
      const img = f.querySelector('img');
      const a = img.dataset.asset && Assets.get(img.dataset.asset);
      copyImageToClipboard(a ? a.data : img.src);
      if (e.code === 'KeyX') this.deleteSelectedFigure();
      return true;
    }
    if (e.key.length === 1 && !mod) { this.deselectFigure(); caretAfterBlock(f); return false; }
    return false;
  },
};
async function copyImageToClipboard(src) {
  try {
    const blob = src.startsWith('data:') ? dataUrlToBlob(src) : await (await fetch(src)).blob();
    let png = blob;
    if (blob.type !== 'image/png') {
      const bmp = await createImageBitmap(blob);
      const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
      c.getContext('2d').drawImage(bmp, 0, 0);
      png = await new Promise(res => c.toBlob(res, 'image/png'));
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    toast('Зображення скопійовано', 'ok');
  } catch (e) { toast('Браузер не дозволив скопіювати зображення', 'err'); }
}
async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch (e) { /* fallback нижче */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  ta.remove();
  if (!ok) focusEditor();
  return ok;
}

// Обробники плаваючих панелей
['#selBar', '#blockBar', '#tableBar', '#imgBar', '#linkBar'].forEach(s => {
  $(s).addEventListener('mousedown', e => { if (!e.target.closest('a')) e.preventDefault(); });
});
$('#selBar').addEventListener('click', e => {
  const b = e.target.closest('[data-b]');
  if (!b) return;
  const v = b.dataset.b;
  if (v === 'color') { openColorPop(b); return; }
  if (v === 'convert') { Pop.open(b, convertMenuHtml(), val => { convertSelection(val); }); return; }
  run(v);
});
$('#blockBar').addEventListener('mouseenter', () => { clearTimeout(hoverTimer); });
$('#blockBar').addEventListener('mouseleave', () => { scheduleHoverClear(); });
$('#blockBar').addEventListener('click', async e => {
  const btn = e.target.closest('[data-b]');
  const bb = $('#blockBar');
  const b = bb._block;
  if (!btn || !b || !b.isConnected) return;
  const v = btn.dataset.b;
  if (v === 'copy') {
    const ok = await copyText(plainText(b));
    const lbl = btn.querySelector('span');
    btn.classList.add('done');
    if (lbl) lbl.textContent = ok ? 'Скопійовано' : 'Не вдалося';
    setTimeout(() => { btn.classList.remove('done'); if (lbl) lbl.textContent = 'Копіювати'; }, 1600);
    return;
  }
  if (v === 'lang') {
    Pop.open(btn, '<div class="menu-label">Мова коду</div>' + LANGS.map(l => menuItem('l:' + l[0], l[1], { on: (b.dataset.lang || '') === l[0] })).join(''), val => {
      mutate(() => { const l = val.slice(2); if (l) b.dataset.lang = l; else b.removeAttribute('data-lang'); b.dataset.label = langLabel(l); });
      UI.blockBarKey = '';
    }, { minWidth: 190 });
    return;
  }
  if (v === 'convert') {
    Pop.open(btn, convertMenuHtml(), val => {
      mutate(() => {
        if (val === 'p') unwrapBlock(b);
        else if (val === 'quote') { const q = document.createElement('blockquote'); b.before(q); Array.from(b.childNodes).forEach(c => q.appendChild(c)); b.remove(); }
        else if (val === 'code') convertBlock(b, 'code');
        else if (val === 'prompt') convertBlock(b, 'prompt');
        else if (val === 'toggle') convertBlock(b, 'toggle');
        else convertBlock(b, 'callout', val.split(':')[1]);
      });
      UI.blockBarKey = '';
    });
    return;
  }
  if (v === 'unwrap') { mutate(() => unwrapBlock(b)); UI.hoverBlock = null; return; }
  if (v === 'collapse') { toggleCollapsed(b); return; }
  if (v === 'toPrompt') { mutate(() => convertBlock(b, 'prompt')); UI.blockBarKey = ''; return; }
  if (v === 'delete') {
    UI.hoverBlock = null;
    mutate(() => {
      const next = b.nextElementSibling, prev = b.previousElementSibling;
      b.remove();
      if (next) placeCaretInBlock(next, 'start'); else if (prev) placeCaretInBlock(prev, 'end');
    });
    toast('Блок видалено', '', { action: 'Повернути', onAction: () => History.undo() });
    return;
  }
  if (v.startsWith('type:')) { mutate(() => { b.dataset.type = v.slice(5); }); UI.blockBarKey = ''; UI.refreshSoon(); }
});
$('#tableBar').addEventListener('click', e => {
  const b = e.target.closest('[data-b]');
  if (!b) return;
  if (b.dataset.b.startsWith('m:')) openTableMenu(b.dataset.b.slice(2), b);
  else tableAction(b.dataset.b);
});
$('#linkBar').addEventListener('click', async e => {
  const b = e.target.closest('[data-b]');
  const a = $('#linkBar')._a;
  if (!b || !a) return;
  const v = b.dataset.b;
  if (v === 'open') window.open(a.href, '_blank', 'noopener');
  else if (v === 'copy') { const ok = await copyText(a.href); toast(ok ? 'Адресу скопійовано' : 'Не вдалося скопіювати', ok ? 'ok' : 'err'); }
  else if (v === 'edit') openLinkModal();
  else if (v === 'unlink') removeLink(a);
});
$('#imgBar').addEventListener('click', e => {
  const b = e.target.closest('[data-b]');
  const fig = UI.selectedFigure;
  if (!b || !fig) return;
  const v = b.dataset.b;
  if (v === 'delete') { UI.deleteSelectedFigure(); return; }
  if (v === 'view') { openLightbox(fig.querySelector('img').src); return; }
  if (v === 'caption') { const cap = fig.querySelector('figcaption'); UI.deselectFigure(); caretEnd(cap); return; }
  const f = fig;
  let hint = false;
  mutate(() => {
    if (v === 'wrapleft' || v === 'wrapright') {
      hint = !f.dataset.wrap;
      f.dataset.wrap = v === 'wrapleft' ? 'left' : 'right';
      f.removeAttribute('data-align');
      const cur = parseInt(f.style.getPropertyValue('--w'), 10) || 0;
      if (!cur || cur > 65) f.style.setProperty('--w', '40%');
      return;
    }
    if (v[0] === 'w') { const n = +v.slice(1); if (n) f.style.setProperty('--w', n + '%'); else f.style.removeProperty('--w'); if (!f.getAttribute('style')) f.removeAttribute('style'); }
    if (v[0] === 'a') { f.removeAttribute('data-wrap'); const al = v.slice(1); if (al === 'center') f.removeAttribute('data-align'); else f.dataset.align = al; }
  });
  if (hint) toast('Текст тепер обтікає фото. Перетягніть фото мишкою до потрібного абзацу');
  UI.selectedFigure = null;
  UI.selectFigure(f);
});
// Зміна розміру зображення потягуванням за кут
(function () {
  const h = $('#figHandle'), badge = $('#figSizeBadge');
  let drag = null;
  h.addEventListener('pointerdown', e => {
    const fig = UI.selectedFigure;
    if (!fig) return;
    e.preventDefault();
    History.commit();
    const img = fig.querySelector('img');
    const cs = getComputedStyle(editor);
    const contentW = editor.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    drag = { fig, startX: e.clientX, startW: img.getBoundingClientRect().width, figW: fig.dataset.wrap ? contentW : fig.getBoundingClientRect().width, align: fig.dataset.wrap || fig.dataset.align || 'center', wrap: !!fig.dataset.wrap };
    h.setPointerCapture(e.pointerId);
  });
  h.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const factor = drag.align === 'center' ? 2 : (drag.align === 'right' ? -1 : 1);
    const px = drag.startW + dx * factor;
    const pct = clamp(Math.round(px / drag.figW * 100 / 5) * 5, drag.wrap ? 15 : 10, drag.wrap ? 70 : 100);
    drag.fig.style.setProperty('--w', pct + '%');
    badge.textContent = pct + '%';
    badge.style.display = 'block';
    badge.style.left = (e.clientX + 14) + 'px';
    badge.style.top = (e.clientY + 14) + 'px';
    UI.positionFigure();
  });
  const end = () => {
    if (!drag) return;
    const f = drag.fig;
    drag = null;
    badge.style.display = 'none';
    normalize();
    History.commit();
    UI.selectedFigure = null;
    UI.selectFigure(f);
  };
  h.addEventListener('pointerup', end);
  h.addEventListener('pointercancel', end);
})();
function openLightbox(src) { const lb = $('#lightbox'); lb.querySelector('img').src = src; lb.classList.add('open'); }
$('#lightbox').addEventListener('click', () => $('#lightbox').classList.remove('open'));

// Наведення на блок — показ його панелі
let hoverTimer = null;
function scheduleHoverClear() {
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => { UI.hoverBlock = null; UI.refreshSoon(); }, 380);
}
editor.addEventListener('mousemove', e => {
  const b = e.target.closest && e.target.closest('.tc-block,pre.tc-code');
  if (b && editor.contains(b)) {
    clearTimeout(hoverTimer);
    if (UI.hoverBlock !== b) { UI.hoverBlock = b; UI.refreshSoon(); }
  } else if (UI.hoverBlock) scheduleHoverClear();
});
editor.addEventListener('mouseleave', () => { if (UI.hoverBlock) scheduleHoverClear(); });

/* ═══════════════════════════ ПОПОВЕРИ ПАНЕЛІ ІНСТРУМЕНТІВ ═══════════════════════════ */
function openColorPop(anchor) {
  const sw = (list, kind) => '<div class="swatch-grid">' + list.map(c =>
    '<button class="swatch' + (c[0] ? '' : ' none') + '" data-v="' + kind + '|' + c[0] + '" data-tip="' + esc(c[1]) + '" style="' + (kind === 'fore' ? 'color:' + (c[0] || 'var(--text)') + ';background:var(--surface)' : 'background:' + (c[0] || 'var(--surface)')) + '">' + (kind === 'fore' ? 'A' : (c[0] ? '' : '⌀')) + '</button>').join('') + '</div>';
  Pop.open(anchor, '<div class="menu-label">Колір тексту</div>' + sw(TEXT_COLORS, 'fore') + '<div class="menu-label">Виділення маркером</div>' + sw(HL_COLORS, 'back'), v => {
    const [kind, color] = v.split('|');
    applyColor(kind, color);
  }, { minWidth: 250 });
}
function openBlockStylePop(anchor) {
  const r = editorRange() || lastRange;
  const tb = r ? textBlockOf(r.startContainer) : null;
  const tag = tb ? tb.tagName : 'P';
  const inQ = r && closestIn(r.startContainer, 'blockquote');
  Pop.open(anchor,
    menuItem('p', 'Звичайний текст', { icon: 'text', on: tag === 'P' && !inQ, kbd: 'Ctrl+Alt+0' }) +
    menuItem('h1', '', { txt: 'H1', labelHtml: '<span style="font-size:17px;font-weight:800">Заголовок 1</span>', on: tag === 'H1', kbd: 'Ctrl+Alt+1' }) +
    menuItem('h2', '', { txt: 'H2', labelHtml: '<span style="font-size:15px;font-weight:700">Заголовок 2</span>', on: tag === 'H2', kbd: 'Ctrl+Alt+2' }) +
    menuItem('h3', '', { txt: 'H3', labelHtml: '<span style="font-size:14px;font-weight:600">Заголовок 3</span>', on: tag === 'H3', kbd: 'Ctrl+Alt+3' }) +
    '<div class="menu-sep"></div>' +
    menuItem('quote', 'Цитата', { icon: 'quote', on: !!inQ }) +
    menuItem('ul', 'Маркований список', { icon: 'ul' }) +
    menuItem('ol', 'Нумерований список', { icon: 'ol' }) +
    menuItem('check', 'Чекліст', { icon: 'checklist' }),
    v => run(v), { minWidth: 250 });
}
function openAlignPop(anchor) {
  Pop.open(anchor,
    menuItem('alignLeft', 'Ліворуч', { icon: 'alignLeft' }) + menuItem('alignCenter', 'По центру', { icon: 'alignCenter' }) +
    menuItem('alignRight', 'Праворуч', { icon: 'alignRight' }) + menuItem('alignJustify', 'По ширині', { icon: 'alignJustify' }),
    v => run(v));
}
function openCalloutPop(anchor) {
  Pop.open(anchor, '<div class="menu-label">Виділений блок</div>' + Object.keys(CALLOUT_TYPES).map(t => menuItem('callout:' + t, CALLOUT_TYPES[t].label, { icon: CALLOUT_TYPES[t].icon, cls: 'c-' + t })).join('') +
    '<div class="menu-sep"></div>' + menuItem('toggle', 'Розгортальний блок', { icon: 'toggleBlock', sub: 'Відповідь чи підказка — відкривається кліком' }), v => run(v), { minWidth: 240 });
}
function openFontSizePop(anchor) {
  const cur = currentFontSize();
  const sizes = [12, 14, 15, 16, 17, 18, 20, 24, 28, 32, 40, 48];
  Pop.open(anchor, '<div class="menu-label">Розмір виділеного тексту</div><div class="size-list">' + sizes.map(s => '<button data-v="' + s + '" class="' + (s === cur ? 'on' : '') + '">' + s + '</button>').join('') + '</div><div class="menu-sep"></div>' + menuItem('reset', 'Стандартний розмір', { icon: 'eraser' }), v => {
    setFontSize(v === 'reset' ? null : +v);
  }, { minWidth: 200 });
}
function openTablePop(anchor) {
  let cells = '';
  for (let r = 1; r <= 8; r++) for (let c = 1; c <= 8; c++) cells += '<button class="grid-cell" data-v="' + r + 'x' + c + '" data-r="' + r + '" data-c="' + c + '"></button>';
  Pop.open(anchor, '<div class="grid-picker"><div class="grid-cells">' + cells + '</div><div class="grid-label" id="gridLabel">Оберіть розмір</div></div>', v => {
    const [r, c] = v.split('x').map(Number);
    insertAtom(() => doInsertTable(r, c));
  }, {
    minWidth: 0,
    onMount: pop => {
      pop.addEventListener('mouseover', e => {
        const cell = e.target.closest('.grid-cell');
        if (!cell) return;
        const R = +cell.dataset.r, C = +cell.dataset.c;
        $$('.grid-cell', pop).forEach(x => x.classList.toggle('on', +x.dataset.r <= R && +x.dataset.c <= C));
        $('#gridLabel').textContent = R + ' × ' + C;
      });
    },
  });
}
function openExportPop(anchor) {
  Pop.open(anchor,
    '<div class="menu-label">Зберегти документ</div>' +
    menuItem('html', 'HTML-сторінка', { icon: 'html', sub: 'Окремий файл зі змістом і кнопками копіювання' }) +
    menuItem('print', 'PDF / друк', { icon: 'print', sub: 'Через діалог друку браузера', kbd: 'Ctrl+P' }) +
    menuItem('md', 'Markdown (.md)', { icon: 'markdown', sub: 'Для GitHub, Notion, Obsidian' }) +
    '<div class="menu-sep"></div>' +
    menuItem('copyMd', 'Копіювати як Markdown', { icon: 'copy', sub: 'Зручно вставляти в ChatGPT / Claude' }) +
    menuItem('copyText', 'Копіювати весь текст', { icon: 'copy' }),
    v => {
      if (v === 'html') exportHtml();
      else if (v === 'print') { UI.hideTransient(); setTimeout(() => window.print(), 50); }
      else if (v === 'md') downloadFile(fileName() + '.md', toMarkdown(editor, { embedImages: true }), 'text/markdown;charset=utf-8');
      else if (v === 'copyMd') copyText(toMarkdown(editor, {})).then(ok => toast(ok ? 'Markdown скопійовано' : 'Не вдалося скопіювати', ok ? 'ok' : 'err'));
      else if (v === 'copyText') copyText(plainText(editor)).then(ok => toast(ok ? 'Текст скопійовано' : 'Не вдалося скопіювати', ok ? 'ok' : 'err'));
    }, { minWidth: 300, alignRight: true });
}
function openViewPop(anchor) {
  const theme = themePref();
  const v = viewPrefs();
  const seg = (name, opts, cur) => '<div class="seg">' + opts.map(o => '<button data-v="' + name + ':' + o[0] + '" class="' + (o[0] === cur ? 'on' : '') + '">' + (o[2] ? icon(o[2]) : '') + esc(o[1]) + '</button>').join('') + '</div>';
  const html = '<div class="menu-label">Тема</div>' + seg('theme', [['light', 'Світла', 'sun'], ['dark', 'Темна', 'moon'], ['auto', 'Авто', 'monitor']], theme) +
    '<div class="menu-label">Ширина сторінки</div>' + seg('width', [['narrow', 'Вузька'], ['normal', 'Звичайна'], ['wide', 'Широка']], v.width || 'normal') +
    '<div class="menu-label">Шрифт тексту</div>' + seg('font', [['serif', 'З засічками'], ['sans', 'Без засічок']], v.font || 'serif');
  Pop.open(anchor, html, val => {
    const [k, x] = val.split(':');
    if (k === 'theme') applyTheme(x);
    else setViewPref(k, x);
    Pop.anchor = null;
    openViewPop(anchor);
    return true;
  }, { minWidth: 300, alignRight: true });
}
