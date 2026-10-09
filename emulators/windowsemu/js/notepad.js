// Емулятор Windows · Блокнот і вікно «Відкрити / Зберегти як».
import { HOME, KNOWN, parentPath, nameOfPath, isText, validName, BAD_NAME_HINT, fmtDate, fmtTime, extOf } from './fs.js';
import { appIcon, nodeIcon, folderIcon, driveIcon, ui } from './icons.js';
import { WM, dialog, alertBox, menu, esc, h } from './ui.js';

const lc = s => s.toLocaleLowerCase('uk');

export class Notepad {
  constructor(sys, path, { create } = {}) {
    this.sys = sys; this.fs = sys.fs; this.path = null; this.saved = ''; this.wrap = sys.settings.wrap ?? true; this.zoom = 100;
    this.win = WM.open({ app: 'notepad', title: 'Блокнот', icon: appIcon('notepad', 16), w: 700, h: 480, minW: 360, minH: 240, onClose: () => this.confirmClose() });
    this.win.body.innerHTML = `<div class="np"><div class="np-menu"><button data-m="file">Файл</button><button data-m="edit">Редагування</button><button data-m="view">Перегляд</button></div>
      <textarea class="np-text" spellcheck="false"></textarea><footer class="np-status"><span class="np-pos"></span><span class="np-len"></span><span>${'100%'}</span><span>Windows (CRLF)</span><span>UTF-8</span></footer></div>`;
    this.$ = s => this.win.body.querySelector(s);
    this.ta = this.$('.np-text');
    this.bind();
    if (path && create) { this.path = path; this.saved = null; this.title(); }
    else if (path) this.load(path);
    else this.title();
    this.applyView();
    this.unsub = this.fs.on(() => this.external());
    const close = this.win.close; this.win.close = f => { this.unsub(); return close(f); };
    this.win.onFocus = () => setTimeout(() => this.ta.focus({ preventScroll: true }), 0);
    this.win.onFocus();
  }
  get dirty() { return this.saved === null ? true : this.ta.value !== this.saved; }
  name() { return this.path ? nameOfPath(this.path) : 'Без назви'; }
  title() { this.win.setTitle(`${this.dirty && (this.path || this.ta.value) ? '*' : ''}${this.name()} – Блокнот`); this.status(); }
  status() {
    const v = this.ta.value, pos = this.ta.selectionStart, before = v.slice(0, pos);
    this.$('.np-pos').textContent = `Рядок ${before.split('\n').length}, Стовпець ${pos - before.lastIndexOf('\n')}`;
    this.$('.np-len').textContent = `${v.length} ${v.length % 10 === 1 && v.length % 100 !== 11 ? 'символ' : v.length % 10 >= 2 && v.length % 10 <= 4 && (v.length % 100 < 12 || v.length % 100 > 14) ? 'символи' : 'символів'}`;
  }
  load(path) {
    try { const t = this.fs.readFile(path).replace(/\r\n/g, '\n'); this.ta.value = t; this.saved = t; this.path = this.fs.real(path); }
    catch (e) { alertBox(e.code === 'access' ? 'Відмовлено в доступі.' : `Не вдається знайти файл «${path}».`, 'Блокнот', 'error'); }
    this.title();
  }
  // файл змінили ззовні (наприклад, echo >> у консолі): якщо тут нічого не правили — оновити
  external() {
    if (!this.path || !this.win.el.isConnected) return;
    const n = this.fs.node(this.path);
    if (!n) { this.saved = null; this.title(); return; }
    if (!this.dirty && n.type === 'file') { const t = this.fs.readFile(this.path).replace(/\r\n/g, '\n'); if (t !== this.ta.value) { this.ta.value = t; this.saved = t; this.title(); } }
  }
  async save(as) {
    let p = this.path;
    if (as || !p) { p = await fileDialog(this.sys, 'save', this.path ? parentPath(this.path) : HOME + '\\Documents', this.path ? nameOfPath(this.path) : '*.txt'); if (!p) return false; }
    try {
      if (this.fs.node(p) && lc(p) !== lc(this.path || '')) {
        if (!(await dialog({ title: 'Підтвердження збереження', icon: 'warn', text: `${nameOfPath(p)} уже існує. Замінити його?`, buttons: [{ t: 'Так', v: true, primary: true }, { t: 'Ні', v: false, cancel: true }] }))) return false;
      }
      this.fs.writeFile(p, this.ta.value.replace(/\n/g, '\r\n'));
      this.path = this.fs.real(p); this.saved = this.ta.value; this.title();
      return true;
    } catch (e) { alertBox(e.code === 'access' ? 'Відмовлено в доступі. Цей файл лише для читання або лежить у системній папці.' : e.message, 'Блокнот', 'error'); return false; }
  }
  async confirmClose() {
    if (!this.dirty || (!this.path && !this.ta.value)) return true;
    const v = await dialog({ title: 'Блокнот', text: `Зберегти зміни у файлі «${this.name()}»?`, buttons: [{ t: 'Зберегти', v: 'save', primary: true }, { t: 'Не зберігати', v: 'no' }, { t: 'Скасувати', v: null, cancel: true }] });
    if (v === 'save') return await this.save();
    return v === 'no';
  }
  async open() {
    if (!(await this.confirmClose())) return;
    const p = await fileDialog(this.sys, 'open', this.path ? parentPath(this.path) : HOME + '\\Documents');
    if (p) this.load(p);
  }
  async newDoc() { if (!(await this.confirmClose())) return; this.path = null; this.ta.value = ''; this.saved = ''; this.title(); }
  applyView() { this.ta.classList.toggle('nowrap', !this.wrap); this.ta.style.fontSize = (15 * this.zoom / 100) + 'px'; this.$('.np-status span:nth-child(3)').textContent = this.zoom + '%'; }
  bind() {
    this.ta.addEventListener('input', () => this.title());
    for (const ev of ['keyup', 'click', 'select']) this.ta.addEventListener(ev, () => this.status());
    this.ta.addEventListener('keydown', e => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.code === 'KeyS') { e.preventDefault(); this.save(e.shiftKey); }
      else if (ctrl && e.code === 'KeyO') { e.preventDefault(); this.open(); }
      else if (ctrl && e.code === 'KeyN') { e.preventDefault(); this.newDoc(); }
      else if (ctrl && (e.code === 'Equal' || e.code === 'NumpadAdd')) { e.preventDefault(); this.zoom = Math.min(300, this.zoom + 10); this.applyView(); }
      else if (ctrl && (e.code === 'Minus' || e.code === 'NumpadSubtract')) { e.preventDefault(); this.zoom = Math.max(50, this.zoom - 10); this.applyView(); }
      else if (e.key === 'F5') { e.preventDefault(); this.insertDate(); }
      else if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '\t'); }
    });
    this.$('.np-menu').addEventListener('click', e => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      const m = {
        file: [{ t: 'Створити', icon: 'filePlus', kbd: 'Ctrl+N', on: () => this.newDoc() }, { t: 'Відкрити…', icon: 'open', kbd: 'Ctrl+O', on: () => this.open() }, { t: 'Зберегти', icon: 'save', kbd: 'Ctrl+S', on: () => this.save() }, { t: 'Зберегти як…', icon: 'save', kbd: 'Ctrl+Shift+S', on: () => this.save(true) }, '-', { t: 'Закрити', icon: 'close', on: () => this.win.close() }],
        edit: [{ t: 'Вирізати', icon: 'cut', kbd: 'Ctrl+X', on: () => { this.ta.focus(); document.execCommand('cut'); } }, { t: 'Копіювати', icon: 'copy', kbd: 'Ctrl+C', on: () => { this.ta.focus(); document.execCommand('copy'); } }, { t: 'Вставити', icon: 'paste', kbd: 'Ctrl+V', on: () => { this.ta.focus(); navigator.clipboard?.readText?.().then(t => document.execCommand('insertText', false, t)).catch(() => {}); } }, '-', { t: 'Виділити все', kbd: 'Ctrl+A', on: () => { this.ta.focus(); this.ta.select(); } }, { t: 'Дата й час', icon: 'clock', kbd: 'F5', on: () => this.insertDate() }],
        view: [{ t: 'Перенесення слів', check: this.wrap, on: () => { this.wrap = !this.wrap; this.sys.settings.wrap = this.wrap; this.sys.saveSettings(); this.applyView(); } }, '-', { t: 'Збільшити', icon: 'zoomIn', kbd: 'Ctrl+=', on: () => { this.zoom = Math.min(300, this.zoom + 10); this.applyView(); } }, { t: 'Зменшити', icon: 'zoomOut', kbd: 'Ctrl+−', on: () => { this.zoom = Math.max(50, this.zoom - 10); this.applyView(); } }, { t: 'Звичайний масштаб', on: () => { this.zoom = 100; this.applyView(); } }],
      }[b.dataset.m];
      menu(0, 0, m, { anchor: b });
    });
  }
  insertDate() { const d = new Date(); this.ta.focus(); document.execCommand('insertText', false, `${fmtTime(d)} ${fmtDate(d)}`); this.title(); }
}

/* ═════ «Відкрити» / «Зберегти як» ═════ */
export function fileDialog(sys, mode, start, name = '') {
  const fs = sys.fs;
  let cwd = fs.isDir(start) ? fs.real(start) : HOME + '\\Documents';
  return new Promise(res => {
    const el = h(`<div class="dlg-back"><div class="dlg fdlg" role="dialog"><header class="dlg-title"><span>${mode === 'open' ? 'Відкрити' : 'Зберегти як'}</span><button class="wb close" data-x>${ui('close', 15)}</button></header>
      <div class="fd-nav"><button class="nb" data-up title="На рівень вище">${ui('up')}</button><div class="fd-path"></div></div>
      <div class="fd-main"><nav class="fd-side">${['Desktop', 'Documents', 'Downloads', 'Pictures'].map(k => `<button data-go="${HOME}\\${k}">${folderIcon(18, k)}<span>${KNOWN[k]}</span></button>`).join('')}${fs.drives().map(d => `<button data-go="${d}:\\">${driveIcon(d, 18)}<span>Диск ${d}:</span></button>`).join('')}</nav><div class="fd-list" tabindex="0"></div></div>
      <div class="fd-foot"><label>Ім’я файлу: <input class="fd-name" spellcheck="false" value="${esc(name === '*.txt' ? '' : name)}" placeholder="${mode === 'save' ? 'Нотатки.txt' : ''}"></label><span class="fd-type">Текстові документи (*.txt)</span>
      <button class="btn primary" data-ok>${mode === 'open' ? 'Відкрити' : 'Зберегти'}</button><button class="btn" data-x>Скасувати</button></div></div></div>`);
    document.body.appendChild(el);
    const $ = s => el.querySelector(s), inp = $('.fd-name');
    const render = () => {
      $('.fd-path').textContent = cwd;
      const kids = fs.list(cwd, { hidden: sys.settings.hidden }).filter(c => c.type === 'dir' || mode === 'save' || ['txt', 'md', 'csv', 'ini', 'log', 'bat', ''].includes(extOf(c.name)) || sys.settings.allFiles)
        .sort((a, b) => (a.type !== b.type ? (a.type === 'dir' ? -1 : 1) : 0) || a.name.localeCompare(b.name, 'uk'));
      $('.fd-list').innerHTML = kids.length ? kids.map(c => `<div class="fd-it${c.type === 'file' && !isText(c) ? ' dim' : ''}" data-n="${esc(c.name)}" data-t="${c.type}">${nodeIcon(c, cwd + '\\' + c.name, 20)}<span>${esc(c.name)}</span><small>${fmtDate(c.modified)} ${fmtTime(c.modified)}</small></div>`).join('') : '<p class="empty">Ця папка пуста.</p>';
    };
    const done = v => { el.remove(); document.removeEventListener('keydown', key, true); res(v); };
    const ok = () => {
      let n = inp.value.trim(); if (!n) { inp.focus(); return; }
      if (/^[a-z]:\\/i.test(n)) { const p = n; if (fs.isDir(p)) { cwd = fs.real(p); inp.value = ''; render(); return; } n = p; } else n = cwd.replace(/\\$/, '') + '\\' + n;
      if (fs.isDir(n)) { cwd = fs.real(n); inp.value = ''; render(); return; }
      if (mode === 'save') {
        if (!extOf(nameOfPath(n))) n += '.txt';
        if (!validName(nameOfPath(n))) { alertBox(BAD_NAME_HINT, 'Зберегти як', 'warn'); return; }
        return done(n);
      }
      if (!fs.isFile(n)) { alertBox(`${nameOfPath(n)}\nФайл не знайдено. Перевірте ім’я файлу й повторіть спробу.`, 'Відкрити', 'warn'); return; }
      done(n);
    };
    el.addEventListener('click', e => {
      if (e.target.closest('[data-x]')) return done(null);
      if (e.target.closest('[data-ok]')) return ok();
      if (e.target.closest('[data-up]')) { const p = parentPath(cwd); if (p) { cwd = p; render(); } return; }
      const g = e.target.closest('[data-go]'); if (g) { cwd = g.dataset.go; render(); return; }
      const it = e.target.closest('.fd-it'); if (it) { el.querySelectorAll('.fd-it.sel').forEach(x => x.classList.remove('sel')); it.classList.add('sel'); if (it.dataset.t === 'file') inp.value = it.dataset.n; }
    });
    el.addEventListener('dblclick', e => { const it = e.target.closest('.fd-it'); if (!it) return; if (it.dataset.t === 'dir') { cwd = cwd.replace(/\\$/, '') + '\\' + it.dataset.n; render(); } else { inp.value = it.dataset.n; ok(); } });
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); ok(); } };
    document.addEventListener('keydown', key, true);
    render();
    setTimeout(() => inp.focus(), 20);
  });
}
