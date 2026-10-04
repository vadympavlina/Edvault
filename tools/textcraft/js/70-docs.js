// TextCraft · Edvault — Вигляд і тема, зміст, статистика, сховище (IndexedDB), документи, імпорт, шапка.
// Файли підключаються звичайними <script> по черзі й мають спільну глобальну область видимості.
'use strict';

/* ═══════════════════════════ ВИГЛЯД / ТЕМА ═══════════════════════════ */
function themePref() { try { return localStorage.getItem('edvault-theme') || 'auto'; } catch (e) { return 'auto'; } }
function applyTheme(pref) {
  try { localStorage.setItem('edvault-theme', pref); } catch (e) { /* приватний режим */ }
  const dark = pref === 'dark' || (pref === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  UI.refreshSoon();
}
if (window.matchMedia) {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const f = () => { if (themePref() === 'auto') applyTheme('auto'); };
  if (mq.addEventListener) mq.addEventListener('change', f); else if (mq.addListener) mq.addListener(f);
}
function viewPrefs() { try { return JSON.parse(localStorage.getItem('textcraft3_view') || '{}'); } catch (e) { return {}; } }
function setViewPref(k, v) {
  const p = viewPrefs();
  p[k] = v;
  try { localStorage.setItem('textcraft3_view', JSON.stringify(p)); } catch (e) { /* ignore */ }
  if (k === 'width') document.documentElement.setAttribute('data-width', v);
  if (k === 'font') document.documentElement.setAttribute('data-font', v);
  if (k === 'toc') { if (v === false) document.documentElement.setAttribute('data-toc', 'off'); else document.documentElement.removeAttribute('data-toc'); }
  UI.refreshSoon();
}
function toggleToc() {
  if (window.innerWidth <= 900) { $('#toc').classList.toggle('open'); return; }
  const off = document.documentElement.getAttribute('data-toc') === 'off';
  setViewPref('toc', off ? true : false);
}
document.addEventListener('mousedown', e => {
  const t = $('#toc');
  if (t.classList.contains('open') && !t.contains(e.target) && !e.target.closest('[data-act="toc"]')) t.classList.remove('open');
});

/* ═══════════════════════════ ЗМІСТ (TOC) ═══════════════════════════ */
const Toc = {
  timer: null, items: [], collapsed: new WeakSet(),
  schedule() { clearTimeout(this.timer); this.timer = setTimeout(() => this.build(), 300); },
  build() {
    const list = $('#tocList');
    const hs = $$('h1,h2,h3', editor).filter(h => !h.closest('.tc-block,td,th,li,blockquote'));
    this.items = [];
    if (!hs.length) {
      list.innerHTML = '<div class="toc-empty">Тут з’являться заголовки документа. Використовуйте «Заголовок 1–3», щоб створити зміст.</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    let parentItem = null;
    hs.forEach(h => {
      const lvl = +h.tagName[1];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toc-item l' + lvl;
      btn._h = h;
      if (lvl === 1) {
        parentItem = { btn, h, kids: [] };
        btn.innerHTML = '<span class="chev-btn" style="visibility:hidden">' + icon('chevron') + '</span>';
      } else if (parentItem) parentItem.kids.push(btn);
      const lbl = document.createElement('span');
      lbl.className = 'lbl';
      lbl.textContent = h.textContent.replace(ZW, '').trim() || '(без назви)';
      btn.appendChild(lbl);
      btn._parent = lvl > 1 ? parentItem : null;
      this.items.push(btn);
      frag.appendChild(btn);
    });
    list.innerHTML = '';
    list.appendChild(frag);
    this.items.forEach(btn => {
      if (!btn.classList.contains('l1')) return;
      const kids = this.items.filter(x => x._parent && x._parent.btn === btn);
      const chev = btn.querySelector('.chev-btn');
      if (kids.length) chev.style.visibility = '';
      if (this.collapsed.has(btn._h)) { btn.classList.add('collapsed'); kids.forEach(k => k.classList.add('hidden')); }
    });
    this.filter($('#tocFilter').value);
    this.active();
  },
  filter(q) {
    q = q.trim().toLowerCase();
    this.items.forEach(b => {
      const hiddenByCollapse = b._parent && this.collapsed.has(b._parent.h) && !q;
      b.classList.toggle('hidden', (q && !b.textContent.toLowerCase().includes(q)) || !!hiddenByCollapse);
    });
  },
  active() {
    if (!this.items.length) return;
    const top = scrollArea.getBoundingClientRect().top;
    let cur = this.items[0];
    for (const b of this.items) { if (b._h.getBoundingClientRect().top - top <= 110) cur = b; else break; }
    this.items.forEach(b => b.classList.toggle('active', b === cur));
  },
};
$('#tocList').addEventListener('mousedown', e => e.preventDefault());
$('#tocList').addEventListener('click', e => {
  const btn = e.target.closest('.toc-item');
  if (!btn) return;
  if (e.target.closest('.chev-btn') && btn.classList.contains('l1')) {
    if (Toc.collapsed.has(btn._h)) Toc.collapsed.delete(btn._h); else Toc.collapsed.add(btn._h);
    Toc.build();
    return;
  }
  if (btn._h && btn._h.isConnected) {
    btn._h.scrollIntoView({ behavior: 'smooth', block: 'start' });
    caretEnd(btn._h);
  }
  if (window.innerWidth <= 900) $('#toc').classList.remove('open');
});
$('#tocFilter').addEventListener('input', e => Toc.filter(e.target.value));

/* ═══════════════════════════ СТАТИСТИКА ═══════════════════════════ */
function countWords(t) { return (String(t).match(/[\p{L}\p{N}][\p{L}\p{N}’'`-]*/gu) || []).length; }
const Stats = {
  timer: null, words: 0,
  schedule() { clearTimeout(this.timer); this.timer = setTimeout(() => this.update(), 250); },
  update() {
    const t = editor.innerText || '';
    this.words = countWords(t);
    const chars = t.replace(/\s/g, '').length;
    $('#stWords').textContent = 'Слів: ' + this.words.toLocaleString('uk-UA');
    $('#stChars').textContent = 'Символів: ' + chars.toLocaleString('uk-UA');
    $('#stRead').textContent = '~' + Math.max(1, Math.round(this.words / 180)) + ' хв читання';
  },
};

/* ═══════════════════════════ СХОВИЩЕ (IndexedDB) ═══════════════════════════ */
const Store = {
  db: null, mem: { docs: new Map(), meta: new Map() },
  open() {
    return new Promise(res => {
      if (!window.indexedDB) { res(false); return; }
      let req;
      try { req = indexedDB.open('edvault-textcraft', 1); } catch (e) { res(false); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'id' });
      };
      req.onsuccess = () => { this.db = req.result; this.db.onversionchange = () => this.db.close(); res(true); };
      req.onerror = () => res(false);
      req.onblocked = () => res(false);
    });
  },
  metaOf(rec) { return { id: rec.id, title: rec.title || '', label: rec.label || '', updatedAt: rec.updatedAt, createdAt: rec.createdAt, words: rec.words || 0 }; },
  put(rec) {
    const meta = this.metaOf(rec);
    if (!this.db) { this.mem.docs.set(rec.id, rec); this.mem.meta.set(rec.id, meta); return Promise.resolve(); }
    return new Promise((res, rej) => {
      const tx = this.db.transaction(['docs', 'meta'], 'readwrite');
      tx.objectStore('docs').put(rec);
      tx.objectStore('meta').put(meta);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error || new Error('Transaction aborted'));
    });
  },
  get(id) {
    if (!this.db) return Promise.resolve(this.mem.docs.get(id) || null);
    return new Promise((res, rej) => {
      const q = this.db.transaction('docs').objectStore('docs').get(id);
      q.onsuccess = () => res(q.result || null);
      q.onerror = () => rej(q.error);
    });
  },
  list() {
    const sort = arr => arr.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (!this.db) return Promise.resolve(sort(Array.from(this.mem.meta.values())));
    return new Promise((res, rej) => {
      const q = this.db.transaction('meta').objectStore('meta').getAll();
      q.onsuccess = () => res(sort(q.result || []));
      q.onerror = () => rej(q.error);
    });
  },
  del(id) {
    if (!this.db) { this.mem.docs.delete(id); this.mem.meta.delete(id); return Promise.resolve(); }
    return new Promise((res, rej) => {
      const tx = this.db.transaction(['docs', 'meta'], 'readwrite');
      tx.objectStore('docs').delete(id);
      tx.objectStore('meta').delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },
};

/* ═══════════════════════════ ДОКУМЕНТИ / ЗБЕРЕЖЕННЯ ═══════════════════════════ */
const state = { docId: null, createdAt: 0, header: null, version: 0, savedVersion: 0, saving: null, saveTimer: null, error: false };
function defaultHeader() { return { enabled: false, tag: '', title: '', subtitle: '', color: '#4F6BF4', pattern: 'bubbles', logo: '', size: 'normal', align: 'left' }; }
function setSaveState(s) {
  const el = $('#saveState');
  el.classList.toggle('dirty', s === 'dirty' || s === 'saving');
  el.classList.toggle('error', s === 'error');
  $('#saveText').textContent = s === 'error' ? 'Не збережено' : (s === 'saving' || s === 'dirty' ? 'Збереження…' : 'Збережено');
  el.setAttribute('data-tip', s === 'error'
    ? 'Не вдалося зберегти: сховище браузера переповнене або недоступне. Зробіть експорт документа, щоб не втратити зміни.'
    : 'Документ автоматично зберігається в цьому браузері');
}
function markDirty() {
  if (state.error) return;
  setSaveState('dirty');
  scheduleSave();
}
function onContentChanged() {
  state.version++;
  markDirty();
  Stats.schedule();
  Toc.schedule();
  UI.refreshSoon();
}
function scheduleSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => saveNow(), 700);
}
function docLabel() {
  const t = $('#docTitle').value.trim();
  if (t) return t;
  for (const el of editor.children) {
    const s = (el.textContent || '').replace(ZW, '').replace(/\s+/g, ' ').trim();
    if (s) return s.slice(0, 80);
  }
  return 'Без назви';
}
function serializeForStore(root) {
  const clone = root.cloneNode(true);
  $$('img[data-asset]', clone).forEach(i => i.setAttribute('src', ''));
  return clone.innerHTML;
}
function buildRecord() {
  const words = countWords(editor.innerText || '');
  return {
    id: state.docId, v: 3,
    title: $('#docTitle').value.trim(),
    label: docLabel(),
    html: serializeForStore(editor),
    assets: Assets.collect(editor),
    header: state.header,
    createdAt: state.createdAt || Date.now(),
    updatedAt: Date.now(),
    words,
  };
}
function saveNow() {
  clearTimeout(state.saveTimer);
  if (!state.docId) return Promise.resolve();
  if (state.saving) { state.saving.then(() => { if (state.version !== state.savedVersion) scheduleSave(); }); return state.saving; }
  if (state.version === state.savedVersion && !state.error) { setSaveState('saved'); return Promise.resolve(); }
  if (History.timer) History.commit();
  const ver = state.version;
  setSaveState('saving');
  const rec = buildRecord();
  state.saving = Store.put(rec).then(() => {
    state.error = false;
    state.savedVersion = ver;
    setSaveState(state.version === ver ? 'saved' : 'dirty');
    if (state.version !== ver) scheduleSave();
    if ($('#drawer').classList.contains('open')) renderDocList();
  }).catch(err => {
    console.error(err);
    state.error = true;
    setSaveState('error');
    toast('Не вдалося зберегти документ. Зробіть експорт, щоб не втратити зміни.', 'err', { duration: 6000 });
    setTimeout(() => { state.error = false; }, 4000);
  }).finally(() => { state.saving = null; });
  return state.saving;
}
async function flushSave() {
  if (state.saving) await state.saving;
  if (state.version !== state.savedVersion) await saveNow();
}
async function createDoc(opts) {
  opts = opts || {};
  const now = Date.now();
  const rec = {
    id: uid('d'), v: 3, title: opts.title || '', label: opts.label || opts.title || 'Без назви',
    html: opts.html || DEFAULT_HTML, assets: opts.assets || {},
    header: opts.header || defaultHeader(), createdAt: now, updatedAt: now, words: opts.words || 0,
  };
  await Store.put(rec);
  return rec;
}
function loadDoc(rec) {
  UI.hideTransient();
  Assets.clear();
  const assets = rec.assets || {};
  Object.keys(assets).forEach(id => Assets.add(assets[id], id));
  editor.innerHTML = rec.html || DEFAULT_HTML;
  $$('img[data-asset]', editor).forEach(img => {
    const a = Assets.get(img.dataset.asset);
    if (a) img.src = a.url; else { const f = img.closest('figure'); (f || img).remove(); }
  });
  state.docId = rec.id;
  state.createdAt = rec.createdAt || Date.now();
  state.header = Object.assign(defaultHeader(), rec.header || {});
  $('#docTitle').value = rec.title || '';
  normalize();
  History.reset();
  state.version = 0; state.savedVersion = 0; state.error = false;
  setSaveState('saved');
  renderHeader();
  updateDocTitle();
  Stats.update();
  Toc.build();
  scrollArea.scrollTop = 0;
  try { localStorage.setItem('textcraft3_current', rec.id); } catch (e) { /* ignore */ }
  const first = editor.firstElementChild;
  if (first && !coarse.matches) { if (isEmptyBlock(first)) caretStart(first); else { lastRange = null; } }
  History.reset();
  if ($('#drawer').classList.contains('open')) renderDocList();
}
function updateDocTitle() { document.title = (docLabel() !== 'Без назви' ? docLabel() + ' — ' : '') + 'TextCraft · Edvault'; }
async function openDoc(id) {
  if (id === state.docId) { closeDrawer(); return; }
  await flushSave();
  const rec = await Store.get(id);
  if (!rec) { toast('Документ не знайдено', 'err'); renderDocList(); return; }
  loadDoc(rec);
  closeDrawer();
}
async function newDoc() {
  await flushSave();
  const rec = await createDoc({});
  loadDoc(rec);
  closeDrawer();
  caretStart(editor.firstElementChild);
  toast('Створено новий документ', 'ok');
}
// Очистити весь текст поточного документа (назва й шапка лишаються); повернути можна через Ctrl+Z
async function clearDoc() {
  const empty = !(editor.textContent || '').trim() && !editor.querySelector('img,table,hr,pre');
  if (empty) { toast('Документ уже порожній'); return; }
  const ok = await confirmDialog('Очистити документ?', 'Увесь текст, блоки й картинки в цьому документі буде прибрано. Назва й шапка залишаться. Передумали — натисніть Ctrl+Z.', 'Очистити', true);
  if (!ok) return;
  mutate(() => { editor.innerHTML = DEFAULT_HTML; });
  editor.focus();
  caretEnd(editor.firstElementChild);
  toast('Документ очищено. Ctrl+Z — повернути');
}
async function duplicateDoc(id) {
  await flushSave();
  const rec = await Store.get(id);
  if (!rec) return;
  const copy = Object.assign({}, rec, { id: uid('d'), title: (rec.title || rec.label || 'Документ') + ' (копія)', createdAt: Date.now(), updatedAt: Date.now() });
  copy.label = copy.title;
  await Store.put(copy);
  renderDocList();
  toast('Створено копію документа', 'ok');
}
async function deleteDoc(id) {
  const list = await Store.list();
  const m = list.find(x => x.id === id);
  const ok = await confirmDialog('Видалити документ?', '«' + ((m && (m.title || m.label)) || 'Без назви') + '» буде видалено з цього браузера назавжди. Цю дію не можна скасувати.', 'Видалити', true);
  if (!ok) return;
  await Store.del(id);
  if (id === state.docId) {
    state.docId = null;
    const rest = (await Store.list()).filter(x => x.id !== id);
    const rec = rest.length ? await Store.get(rest[0].id) : await createDoc({});
    loadDoc(rec);
  }
  renderDocList();
  toast('Документ видалено');
}
function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts), now = new Date();
  const time = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 864e5);
  if (diff === 0) return 'Сьогодні, ' + time;
  if (diff === 1) return 'Вчора, ' + time;
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}
async function renderDocList() {
  let list = [];
  try { list = await Store.list(); } catch (e) { list = []; }
  const q = $('#docFilter').value.trim().toLowerCase();
  const items = list.filter(d => !q || (d.title || d.label || '').toLowerCase().includes(q));
  $('#docList').innerHTML = items.length ? items.map(d =>
    '<div class="doc-item' + (d.id === state.docId ? ' active' : '') + '" data-id="' + esc(d.id) + '">' +
      '<span class="di-ico">' + icon('file') + '</span>' +
      '<div class="di-txt"><div class="di-title">' + esc(d.title || d.label || 'Без назви') + '</div>' +
      '<div class="di-meta">' + esc(fmtDate(d.updatedAt)) + ' · ' + (d.words || 0).toLocaleString('uk-UA') + ' сл.</div></div>' +
      '<button class="tb" data-doc-menu="' + esc(d.id) + '" data-tip="Дії з документом">' + icon('more') + '</button>' +
    '</div>').join('') : '<div class="toc-empty">' + (q ? 'Нічого не знайдено' : 'Документів ще немає') + '</div>';
}
function openDrawer() { renderDocList(); $('#drawer').classList.add('open'); $('#drawerOverlay').classList.add('open'); UI.hideTransient(); }
function closeDrawer() { $('#drawer').classList.remove('open'); $('#drawerOverlay').classList.remove('open'); }
$('#drawerOverlay').addEventListener('click', closeDrawer);
$('#docFilter').addEventListener('input', renderDocList);
$('#docList').addEventListener('click', e => {
  const m = e.target.closest('[data-doc-menu]');
  if (m) {
    const id = m.dataset.docMenu;
    Pop.open(m, menuItem('open', 'Відкрити', { icon: 'file' }) + menuItem('dup', 'Дублювати', { icon: 'duplicate' }) + '<div class="menu-sep"></div>' + menuItem('del', 'Видалити', { icon: 'trash', danger: true }), v => {
      if (v === 'open') openDoc(id); else if (v === 'dup') duplicateDoc(id); else if (v === 'del') deleteDoc(id);
    }, { alignRight: true });
    return;
  }
  const it = e.target.closest('.doc-item');
  if (it) openDoc(it.dataset.id);
});

/* ═══════════════════════════ ІМПОРТ / МІГРАЦІЯ ═══════════════════════════ */
async function docFromNodes(nodes, title, header) {
  const tmp = document.createElement('div');
  nodes.forEach(n => tmp.appendChild(n));
  if (!tmp.firstChild) tmp.innerHTML = DEFAULT_HTML;
  if (!/^(P|H1|H2|H3|UL|OL|BLOCKQUOTE)$/.test(tmp.lastElementChild.tagName)) tmp.appendChild(emptyP());
  return createDoc({
    title: title || '',
    label: title || (tmp.textContent || '').trim().slice(0, 80) || 'Без назви',
    html: serializeForStore(tmp),
    assets: Assets.collect(tmp),
    header: header || defaultHeader(),
    words: countWords(tmp.textContent || ''),
  });
}
function rgbToHex(c) {
  const m = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return /^#[0-9a-f]{3,6}$/i.test(c) ? c : null;
  return '#' + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join('');
}
function parseHeaderEl(el) {
  const h = defaultHeader();
  h.enabled = true;
  h.tag = ((el.querySelector('.doc-header-tag') || {}).textContent || '').trim();
  h.title = ((el.querySelector('.doc-header-title') || {}).textContent || '').trim();
  h.subtitle = ((el.querySelector('.doc-header-subtitle') || {}).textContent || '').trim();
  const pm = (el.className || '').match(/pattern-(\w+)/);
  if (pm) h.pattern = pm[1];
  const sm = (el.className || '').match(/size-(compact|tall)/);
  if (sm) h.size = sm[1];
  if (el.classList.contains('align-center')) h.align = 'center';
  const bg = el.getAttribute('style') || '';
  const cm = bg.match(/(#[0-9a-fA-F]{3,6}|rgba?\([^)]+\))/);
  if (cm) h.color = rgbToHex(cm[1]) || h.color;
  const logo = el.querySelector('.doc-header-logo');
  if (logo && /^data:image\//.test(logo.getAttribute('src') || '')) h.logo = logo.getAttribute('src');
  return h;
}
async function importFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const name = file.name.replace(/\.[^.]+$/, '');
    await flushSave();
    let rec;
    if (/\.(md|markdown|txt)$/i.test(file.name) || /markdown|plain/.test(file.type)) {
      const nodes = sanitizeHTML(/\.txt$/i.test(file.name) ? '<p>' + esc(text).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>') + '</p>' : mdToHtml(text), { own: false });
      rec = await docFromNodes(nodes, name);
    } else {
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const root = doc.querySelector('.tc-content') || doc.querySelector('.content') || doc.querySelector('#editor') || doc.body;
      const hdrEl = doc.querySelector('.doc-header');
      const legacy = !!root.querySelector('.callout,.card-block,.img-wrap');
      const own = legacy || !!doc.querySelector('.tc-content,meta[name="generator"][content*="TextCraft"]');
      const title = ((doc.querySelector('title') || {}).textContent || name).trim();
      const nodes = sanitizeHTML(root.innerHTML, { own, legacy });
      rec = await docFromNodes(nodes, title, hdrEl ? parseHeaderEl(hdrEl) : null);
    }
    loadDoc(rec);
    closeDrawer();
    toast('Документ «' + (rec.title || rec.label) + '» імпортовано', 'ok');
  } catch (err) {
    console.error(err);
    toast('Не вдалося імпортувати файл', 'err');
  }
}
// Перенесення документа зі старої версії TextCraft (localStorage) — один раз.
async function migrateLegacy() {
  let flag = null;
  try { flag = localStorage.getItem('textcraft3_migrated'); } catch (e) { return null; }
  if (flag) return null;
  try {
    const html = localStorage.getItem('textcraft2_doc');
    const title = localStorage.getItem('textcraft2_title') || '';
    let hdr = null;
    try { hdr = JSON.parse(localStorage.getItem('textcraft2_header') || 'null'); } catch (e) { hdr = null; }
    const hasContent = html && (html.replace(/<[^>]*>/g, '').replace(/&nbsp;|\s|​/g, '') || /<img|<table|<hr/i.test(html));
    let rec = null;
    if (hasContent) {
      const nodes = sanitizeHTML(html, { own: true, legacy: true });
      rec = await docFromNodes(nodes, title, hdr ? Object.assign(defaultHeader(), hdr) : null);
    }
    localStorage.setItem('textcraft3_migrated', '1');
    return rec;
  } catch (err) {
    console.error('Migration failed', err);
    return null;
  }
}

/* ═══════════════════════════ ШАПКА ДОКУМЕНТА ═══════════════════════════ */
const HEADER_COLORS = ['#4F6BF4', '#0891b2', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#1a1d23'];
const HEADER_PRESETS = [
  { name: 'Заняття', color: '#4F6BF4', pattern: 'bubbles', tag: 'Заняття' },
  { name: 'Проєкт', color: '#f59e0b', pattern: 'dots', tag: 'Проєкт' },
  { name: 'Домашнє завдання', color: '#16a34a', pattern: 'diagonal', tag: 'Домашнє завдання' },
  { name: 'Оголошення', color: '#8b5cf6', pattern: 'grid', tag: 'Оголошення' },
  { name: 'Інструкція', color: '#0891b2', pattern: 'waves', tag: 'Інструкція' },
];
function shade(hex, pct) {
  const n = String(hex || '#4F6BF4').replace('#', '');
  const full = n.length === 3 ? n.split('').map(c => c + c).join('') : n;
  const num = parseInt(full, 16) || 0;
  let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  const t = pct < 0 ? 0 : 255, p = Math.abs(pct);
  r = Math.round((t - r) * p) + r; g = Math.round((t - g) * p) + g; b = Math.round((t - b) * p) + b;
  return '#' + [r, g, b].map(v => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
}
function headerMarkup(h, title, extra) {
  const bg = 'linear-gradient(135deg,' + h.color + ',' + shade(h.color, -0.35) + ')';
  const cls = 'doc-header pattern-' + esc(h.pattern) + (h.size && h.size !== 'normal' ? ' size-' + esc(h.size) : '') + (h.align === 'center' ? ' align-center' : '');
  return '<div class="' + cls + '" style="background:' + bg + '">' +
    (h.logo ? '<img class="doc-header-logo" src="' + esc(h.logo) + '" alt="">' : '') +
    '<div class="doc-header-bg">' + (h.tag ? '<div class="doc-header-tag">' + esc(h.tag) + '</div>' : '') +
    '<h1 class="doc-header-title">' + esc(title || 'Без назви') + '</h1>' +
    (h.subtitle ? '<p class="doc-header-subtitle">' + esc(h.subtitle) + '</p>' : '') + '</div>' +
    '<div class="doc-header-wave"><svg viewBox="0 0 500 40" preserveAspectRatio="none"><path d="M0 38 Q125 6 250 22 T500 14 L500 40 L0 40 Z" style="fill:var(--surface)"></path></svg></div>' +
    (extra || '') + '</div>';
}
function headerTitle(h) { return (h.title || $('#docTitle').value.trim() || docLabel()).trim(); }
function renderHeader() {
  const slot = $('#docHeaderSlot');
  const h = state.header || defaultHeader();
  if (!h.enabled) { slot.innerHTML = ''; return; }
  slot.innerHTML = headerMarkup(h, headerTitle(h), '<span class="doc-header-edit">' + icon('edit') + 'Змінити шапку</span>');
}
$('#docHeaderSlot').addEventListener('click', () => openHeaderModal());
const HEADER_PATTERNS = [['none', 'Без'], ['bubbles', 'Кола'], ['waves', 'Хвилі'], ['dots', 'Крапки'], ['diagonal', 'Лінії'], ['grid', 'Сітка']];
let hdrDraft = null;
const hdrBg = c => 'background:linear-gradient(135deg,' + c + ',' + shade(c, -0.35) + ')';
function openHeaderModal() {
  hdrDraft = Object.assign(defaultHeader(), state.header || {});
  hdrDraft.enabled = true; // відкрили налаштування — значить, шапка потрібна
  $('#hdrTag').value = hdrDraft.tag;
  $('#hdrTitle').value = hdrDraft.title;
  $('#hdrTitle').placeholder = 'За замовчуванням — «' + docLabel() + '»';
  $('#hdrSubtitle').value = hdrDraft.subtitle;
  $('#hdrRemove').style.display = state.header && state.header.enabled ? '' : 'none';
  $('#hdrApply').textContent = state.header && state.header.enabled ? 'Зберегти' : 'Додати шапку';
  renderHdrModal();
  Modal.open('headerModal');
}
function renderHdrPreview() {
  const d = hdrDraft;
  $('#hdrPreview').innerHTML = d.enabled ? headerMarkup(d, headerTitle(d)) : '<div class="hdr-preview-off">Шапку вимкнено — документ починається одразу з тексту.</div>';
  $('.hdr-page').classList.toggle('off', !d.enabled);
  $('#hdrForm').classList.toggle('off', !d.enabled);
  $('#hdrEnabled').checked = d.enabled;
  $('#hdrEnabledLbl').textContent = d.enabled ? 'Увімкнено' : 'Вимкнено';
}
function renderHdrModal() {
  const d = hdrDraft;
  const col = d.color.toLowerCase();
  renderHdrPreview();
  $('#hdrPresets').innerHTML = HEADER_PRESETS.map((p, i) =>
    '<button class="preset' + (d.tag === p.tag && col === p.color.toLowerCase() && d.pattern === p.pattern ? ' on' : '') + '" data-preset="' + i + '">' +
    '<span class="pv doc-header pattern-' + p.pattern + '" style="' + hdrBg(p.color) + '"></span><span class="pn">' + esc(p.name) + '</span></button>').join('');
  const custom = !HEADER_COLORS.some(c => c.toLowerCase() === col);
  $('#hdrColors').innerHTML = HEADER_COLORS.map(c => '<button class="color-dot' + (c.toLowerCase() === col ? ' on' : '') + '" data-color="' + c + '" style="background:' + c + '" aria-label="Колір ' + c + '"></button>').join('') +
    '<label class="color-custom-wrap' + (custom ? ' on' : '') + '" data-tip="Свій колір"' + (custom ? ' style="background:' + esc(d.color) + '"' : '') + '><input type="color" id="hdrCustom" value="' + esc(d.color) + '"></label>';
  $('#hdrPatterns').innerHTML = HEADER_PATTERNS.map(p =>
    '<button class="pattern' + (d.pattern === p[0] ? ' on' : '') + '" data-pattern="' + p[0] + '"><span class="pv doc-header pattern-' + p[0] + '" style="' + hdrBg(d.color) + '"></span>' + p[1] + '</button>').join('');
  $$('#hdrSize button').forEach(b => b.classList.toggle('on', b.dataset.size === (d.size || 'normal')));
  $$('#hdrAlign button').forEach(b => b.classList.toggle('on', b.dataset.align === (d.align || 'left')));
  $('#hdrLogoZone').innerHTML = d.logo
    ? '<span class="lz-thumb" style="' + hdrBg(d.color) + '"><img src="' + esc(d.logo) + '" alt=""></span><span class="lz-txt"><b>Логотип додано</b>Клікніть або перетягніть інший файл, щоб замінити</span><button class="btn btn-danger" id="hdrLogoRemove">Прибрати</button>'
    : '<span class="lz-ico">' + icon('upload') + '</span><span class="lz-txt"><b>Додати логотип</b>Клікніть або перетягніть зображення (PNG, SVG, JPG)</span>';
  fillIcons($('#headerModal'));
}
function hdrTouch() {
  if (!hdrDraft.enabled) { hdrDraft.enabled = true; }
}
$('#headerModal').addEventListener('input', e => {
  if (!hdrDraft) return;
  const id = e.target.id;
  if (id === 'hdrTag') hdrDraft.tag = e.target.value;
  else if (id === 'hdrTitle') hdrDraft.title = e.target.value;
  else if (id === 'hdrSubtitle') hdrDraft.subtitle = e.target.value;
  else if (id === 'hdrEnabled') { hdrDraft.enabled = e.target.checked; renderHdrPreview(); return; }
  else if (id === 'hdrCustom') { hdrDraft.color = e.target.value; hdrTouch(); renderHdrModal(); return; }
  else return;
  hdrTouch();
  renderHdrPreview();
});
$('#headerModal').addEventListener('click', e => {
  if (!hdrDraft) return;
  const t = e.target;
  const p = t.closest('[data-preset]');
  if (p) { const pr = HEADER_PRESETS[+p.dataset.preset]; Object.assign(hdrDraft, { color: pr.color, pattern: pr.pattern, tag: pr.tag }); $('#hdrTag').value = pr.tag; hdrTouch(); renderHdrModal(); return; }
  const c = t.closest('[data-color]');
  if (c) { hdrDraft.color = c.dataset.color; hdrTouch(); renderHdrModal(); return; }
  const pt = t.closest('[data-pattern]');
  if (pt) { hdrDraft.pattern = pt.dataset.pattern; hdrTouch(); renderHdrModal(); return; }
  const sz = t.closest('[data-size]');
  if (sz) { hdrDraft.size = sz.dataset.size; hdrTouch(); renderHdrModal(); return; }
  const al = t.closest('[data-align]');
  if (al) { hdrDraft.align = al.dataset.align; hdrTouch(); renderHdrModal(); return; }
  if (t.closest('#hdrLogoRemove')) { e.stopPropagation(); hdrDraft.logo = ''; renderHdrModal(); return; }
  if (t.closest('#hdrLogoZone')) { $('#logoInput').click(); }
});
async function setHdrLogo(file) {
  if (!file || !file.type.startsWith('image/')) { toast('Оберіть файл зображення', 'err'); return; }
  const data = await readImageFile(file, 480);
  if (data) { hdrDraft.logo = data; hdrTouch(); renderHdrModal(); }
  else toast('Не вдалося прочитати зображення', 'err');
}
(function () {
  const z = $('#hdrLogoZone');
  z.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#logoInput').click(); } });
  z.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); z.classList.add('drag'); });
  z.addEventListener('dragleave', () => z.classList.remove('drag'));
  z.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); z.classList.remove('drag'); setHdrLogo(e.dataTransfer.files[0]); });
})();
$('#logoInput').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) setHdrLogo(f); });
function applyHeader(h) {
  state.header = Object.assign({}, h);
  renderHeader();
  state.version++;
  markDirty();
}
$('#hdrApply').addEventListener('click', () => {
  const was = state.header && state.header.enabled;
  applyHeader(hdrDraft);
  Modal.close('headerModal');
  if (!was && hdrDraft.enabled) scrollArea.scrollTo({ top: 0, behavior: 'smooth' });
});
$('#hdrRemove').addEventListener('click', () => {
  const prev = Object.assign({}, state.header);
  applyHeader(Object.assign({}, prev, { enabled: false }));
  Modal.close('headerModal');
  toast('Шапку прибрано', '', { action: 'Повернути', onAction: () => applyHeader(prev) });
});
$('#headerModal').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('#hdrTag,#hdrTitle,#hdrSubtitle')) { e.preventDefault(); $('#hdrApply').click(); }
});
