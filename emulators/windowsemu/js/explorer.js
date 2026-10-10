// Емулятор Windows · Провідник: навігація, кнопки, контекстне меню, перетягування, перейменування, Кошик.
import { KNOWN, HOME, DRIVE_LABEL, DRIVE_SIZE, parentPath, nameOfPath, isInside, typeName, fmtDate, fmtTime, fmtSize, fmtNum, validName, BAD_NAME_HINT, isProtected, extOf, isText } from './fs.js';
import { nodeIcon, driveIcon, pcIcon, binIcon, folderIcon, appIcon, ui } from './icons.js';
import { WM, dialog, alertBox, menu, esc, h } from './ui.js';

const lc = s => s.toLocaleLowerCase('uk');
// довгі назви переносяться після крапки, підкреслення чи дефіса, а не посеред слова
export const wbr = s => esc(s).replace(/([._\-])/g, '$1<wbr>');
export const PC = '::pc', BIN = '::bin';
// Як показувати шлях людині: «Документи», «Цей ПК», «Локальний диск (C:)»
export function prettyName(sys, p) {
  if (p === PC) return 'Цей ПК';
  if (p === BIN) return 'Кошик';
  const parts = p.split('\\').filter(Boolean);
  if (parts.length === 1) return `${DRIVE_LABEL[p[0]]} (${p[0]}:)`;
  if (lc(parentPath(p) || '') === lc(HOME)) { const k = Object.keys(KNOWN).find(x => lc(x) === lc(parts.at(-1))); if (k) return KNOWN[k]; }
  return parts.at(-1);
}
function crumbs(sys, p) {
  if (p === PC || p === BIN) return [{ p, t: prettyName(sys, p) }];
  const parts = p.split('\\').filter(Boolean), out = [{ p: PC, t: 'Цей ПК' }];
  // у профілі користувача — коротко, як у Windows 11: «Документи › Школа»
  let start = 0;
  if (isInside(p, HOME) && lc(p) !== lc(HOME) && Object.keys(KNOWN).some(k => lc(k) === lc(parts[3] || ''))) { start = 3; out.length = 0; }
  for (let i = start; i < parts.length; i++) { const sub = parts.slice(0, i + 1).join('\\') + (i === 0 ? '\\' : ''); out.push({ p: sub, t: prettyName(sys, sub) }); }
  return out;
}
const QUICK = ['Desktop', 'Downloads', 'Documents', 'Pictures', 'Music', 'Videos'];

export class Explorer {
  constructor(sys, path) {
    this.sys = sys; this.fs = sys.fs;
    this.path = path || PC; this.back = []; this.fwd = [];
    this.sel = new Set(); this.anchor = null; this.renaming = null; this.query = '';
    this.win = WM.open({ app: 'explorer', title: '', icon: appIcon('explorer', 16), w: 920, h: 560, minW: 520, minH: 320, onKey: e => this.key(e) });
    this.win.app = 'explorer';
    this.win.body.innerHTML = `<div class="ex">
      <div class="ex-cmd"></div>
      <div class="ex-nav"><button class="nb" data-nav="back" title="Назад (Alt+←)">${ui('back')}</button><button class="nb" data-nav="fwd" title="Вперед (Alt+→)">${ui('forward')}</button><button class="nb" data-nav="up" title="На рівень вище (Alt+↑)">${ui('up')}</button><button class="nb" data-nav="refresh" title="Оновити (F5)">${ui('refresh')}</button>
        <div class="ex-addr"><div class="crumbs"></div><input class="addr-inp" spellcheck="false" hidden></div>
        <label class="ex-search">${ui('search', 15)}<input placeholder="Пошук" spellcheck="false"></label></div>
      <div class="ex-main"><nav class="ex-side"></nav><div class="ex-view" tabindex="0"></div></div>
      <footer class="ex-status"></footer></div>`;
    this.$ = s => this.win.body.querySelector(s);
    this.bind();
    this.unsub = this.fs.on(w => { if (w !== 'fw' && w !== 'fwlog') this.render(); });
    const close = this.win.onClose; this.win.onClose = () => { this.unsub(); return close?.(); };
    sys.explorers.add(this); this.win.onFocus = () => this.$('.ex-view').focus({ preventScroll: true });
    const c = this.win.close; this.win.close = f => { sys.explorers.delete(this); return c(f); };
    this.go(this.path, true);
  }
  // шлях існує? (папку могли видалити з консолі)
  valid(p) { return p === PC || p === BIN || this.fs.isDir(p); }
  go(p, initial) {
    if (p !== PC && p !== BIN) { if (!this.fs.isDir(p)) { alertBox(`Windows не вдається знайти «${p}». Перевірте написання й повторіть спробу.`, 'Провідник', 'error'); return; } p = this.fs.real(p); }
    if (!initial && p !== this.path) { this.back.push(this.path); this.fwd = []; }
    this.path = p; this.sel.clear(); this.anchor = null; this.renaming = null; this.query = ''; this.$('.ex-search input').value = '';
    this.render();
  }
  items() {
    const fs = this.fs, set = this.sys.settings;
    if (this.path === PC) return [];
    if (this.path === BIN) return fs.s.bin.map(b => ({ key: b.id, node: b.node, bin: b, path: null }));
    if (!this.valid(this.path)) { this.path = PC; return []; }
    let list;
    if (this.query) {
      const q = lc(this.query), out = [];
      const walk = d => { for (const c of fs.dirNode(d).children) { if (c.attrs.h && !set.hidden) continue; const p = d.replace(/\\$/, '') + '\\' + c.name; if (lc(c.name).includes(q)) out.push({ key: p, node: c, path: p }); if (c.type === 'dir') walk(p); } };
      walk(this.path); list = out;
    } else list = fs.list(this.path, { hidden: set.hidden }).map(c => ({ key: this.path.replace(/\\$/, '') + '\\' + c.name, node: c, path: this.path.replace(/\\$/, '') + '\\' + c.name }));
    const k = set.sort, dir = set.desc ? -1 : 1;
    return list.sort((a, b) => (a.node.type !== b.node.type ? (a.node.type === 'dir' ? -1 : 1) : 0) || dir * (
      k === 'date' ? a.node.modified - b.node.modified : k === 'size' ? fs.sizeOf(a.node) - fs.sizeOf(b.node) : k === 'type' ? typeName(a.node).localeCompare(typeName(b.node), 'uk') || a.node.name.localeCompare(b.node.name, 'uk') : a.node.name.localeCompare(b.node.name, 'uk', { numeric: true })));
  }
  label(n) { return this.sys.settings.ext || n.type === 'dir' || !extOf(n.name) ? n.name : n.name.slice(0, n.name.lastIndexOf('.')); }

  /* ═════ малювання ═════ */
  render() {
    if (!this.win.el.isConnected) return;
    if (!this.valid(this.path)) { let p = this.path; while (p && !this.fs.isDir(p)) p = parentPath(p); this.path = p ? this.fs.real(p) : PC; }
    const fs = this.fs, set = this.sys.settings, items = this.items();
    this.cur = items;
    for (const k of [...this.sel]) if (!items.some(i => i.key === k)) this.sel.delete(k);
    const title = this.query ? `Результати пошуку в «${prettyName(this.sys, this.path)}»` : prettyName(this.sys, this.path);
    this.win.setTitle(title);
    this.win.el.querySelector('.win-ico').innerHTML = this.path === BIN ? binIcon(fs.s.bin.length > 0, 16) : this.path === PC ? pcIcon(16) : nodeIcon({ type: 'dir' }, this.path, 16);
    this.$('[data-nav="back"]').disabled = !this.back.length;
    this.$('[data-nav="fwd"]').disabled = !this.fwd.length;
    this.$('[data-nav="up"]').disabled = this.path === PC || this.path === BIN;
    // адреса
    this.$('.crumbs').innerHTML = `<span class="cr-ico">${this.path === BIN ? binIcon(fs.s.bin.length > 0, 16) : this.path === PC ? pcIcon(16) : folderIcon(16)}</span>` + crumbs(this.sys, this.path).map(c => `<button class="cr" data-go="${esc(c.p)}">${esc(c.t)}</button>`).join(`<span class="cr-sep">${ui('chevron', 12)}</span>`);
    this.$('.ex-search input').placeholder = `Пошук: ${prettyName(this.sys, this.path)}`;
    this.renderCmd();
    this.renderSide();
    // вміст
    const v = this.$('.ex-view'), cut = this.sys.clip?.mode === 'cut' ? new Set(this.sys.clip.paths.map(lc)) : new Set();
    v.className = 'ex-view ' + (this.path === PC ? 'pc' : set.view);
    if (this.path === PC) {
      v.innerHTML = `<h4 class="grp">Папки</h4><div class="tiles">${QUICK.map(k => `<div class="tile" data-open="${HOME}\\${k}" tabindex="-1">${folderIcon(40, k)}<span><b>${KNOWN[k]}</b><small>${(() => { const c = fs.list(HOME + '\\' + k).length; return c ? `${c} ${c % 10 === 1 && c % 100 !== 11 ? 'елемент' : c % 10 >= 2 && c % 10 <= 4 && (c % 100 < 12 || c % 100 > 14) ? 'елементи' : 'елементів'}` : 'Порожня'; })()}</small></span></div>`).join('')}</div>
        <h4 class="grp">Пристрої й диски</h4><div class="tiles">${fs.drives().map(d => { const used = DRIVE_SIZE[d] - fs.free(d), pc = used / DRIVE_SIZE[d] * 100; return `<div class="tile drive" data-open="${d}:\\" data-drive="${d}">${driveIcon(d, 44)}<span><b>${DRIVE_LABEL[d]} (${d}:)</b><i class="bar"><i style="width:${pc.toFixed(1)}%"></i></i><small>Вільно ${fmtSize(fs.free(d))} з ${fmtSize(DRIVE_SIZE[d])}</small></span></div>`; }).join('')}</div>`;
    } else if (!items.length) {
      v.innerHTML = `<p class="empty">${this.query ? 'Немає елементів, що відповідають вашому пошуку.' : this.path === BIN ? 'Кошик порожній.' : 'Ця папка пуста.'}</p>`;
    } else if (set.view === 'details') {
      const bin = this.path === BIN;
      v.innerHTML = `<table class="det"><thead><tr><th data-sort="name">Ім’я</th>${bin ? '<th>Початкове розташування</th><th>Дата видалення</th>' : `<th data-sort="date">Дата змінення</th><th data-sort="type">Тип</th>`}<th data-sort="size" class="num">Розмір</th></tr></thead><tbody>${items.map(it => {
        const n = it.node;
        return `<tr class="it${this.sel.has(it.key) ? ' sel' : ''}${it.path && cut.has(lc(it.path)) ? ' cut' : ''}${n.attrs.h ? ' hid' : ''}" data-key="${esc(it.key)}" draggable="${!bin}"><td class="nm">${nodeIcon(n, it.path, 18)}${this.renaming === it.key ? this.renameBox(n) : `<span>${esc(this.label(n))}</span>`}</td>${bin ? `<td>${esc(it.bin.from)}</td><td>${fmtDate(it.bin.at)} ${fmtTime(it.bin.at)}</td>` : `<td>${fmtDate(n.modified)} ${fmtTime(n.modified)}</td><td>${esc(typeName(n))}</td>`}<td class="num">${n.type === 'dir' ? '' : fmtSize(fs.sizeOf(n)).replace(' байт', ' Б')}</td></tr>`;
      }).join('')}</tbody></table>`;
    } else {
      v.innerHTML = `<div class="grid">${items.map(it => { const n = it.node; return `<div class="it${this.sel.has(it.key) ? ' sel' : ''}${it.path && cut.has(lc(it.path)) ? ' cut' : ''}${n.attrs.h ? ' hid' : ''}" data-key="${esc(it.key)}" draggable="${this.path !== BIN}" title="${esc(n.name)}${this.query ? '\n' + esc(parentPath(it.path)) : ''}">${nodeIcon(n, it.path, 48)}${this.renaming === it.key ? this.renameBox(n) : `<span class="lb">${wbr(this.label(n))}</span>`}</div>`; }).join('')}</div>`;
    }
    this.status();
    const inp = this.$('.ren-inp');
    if (inp && document.activeElement !== inp) { inp.focus(); const dot = inp.value.lastIndexOf('.'); inp.setSelectionRange(0, this.fs.isDir(this.renaming) || dot <= 0 ? inp.value.length : dot); }
  }
  status() {
    const items = this.cur || [], n = items.length, s = this.sel.size, fs = this.fs;
    const selSize = [...this.sel].map(k => items.find(i => i.key === k)?.node).filter(x => x && x.type === 'file').reduce((a, x) => a + fs.sizeOf(x), 0);
    this.$('.ex-status').innerHTML = this.path === PC ? `${6 + fs.drives().length} елементів` : `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'елемент' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'елементи' : 'елементів'}${s ? ` <span class="sep">|</span> Вибрано: ${s}${selSize ? ` (${fmtSize(selSize)})` : ''}` : ''}`;
  }
  // змінилося лише виділення — оновлюємо класи, а не весь вміст (інакше не спрацює подвійне клацання)
  paint() {
    if (this.renaming) return this.render();
    this.win.body.querySelectorAll('.ex-view .it').forEach(el => el.classList.toggle('sel', this.sel.has(el.dataset.key)));
    this.renderCmd(); this.status();
  }
  renameBox(n) { return `<textarea class="ren-inp" rows="1" spellcheck="false">${esc(n.name)}</textarea>`; }
  renderCmd() {
    const bin = this.path === BIN, pc = this.path === PC, s = this.sel.size, can = !bin && !pc;
    const b = (act, icon, t, on = true, label = false) => `<button class="cb${label ? ' lbl' : ''}" data-cmd="${act}" title="${t}" ${on ? '' : 'disabled'}>${ui(icon, 17)}${label ? `<span>${t}</span>` : ''}</button>`;
    this.$('.ex-cmd').innerHTML = bin
      ? `${b('restoreSel', 'restore', 'Відновити вибрані', s > 0, true)}${b('restoreAll', 'restore', 'Відновити всі', this.fs.s.bin.length > 0, true)}<i class="cb-sep"></i>${b('empty', 'trash', 'Очистити кошик', this.fs.s.bin.length > 0, true)}${b('purgeSel', 'close', 'Видалити назавжди', s > 0, true)}<span class="grow"></span>${b('view', 'view', 'Вигляд', true, true)}`
      : `<button class="cb lbl new" data-cmd="new" ${can ? '' : 'disabled'}>${ui('plus', 17)}<span>Створити</span>${ui('down', 13)}</button><i class="cb-sep"></i>${b('cut', 'cut', 'Вирізати (Ctrl+X)', can && s > 0)}${b('copy', 'copy', 'Копіювати (Ctrl+C)', can && s > 0)}${b('paste', 'paste', 'Вставити (Ctrl+V)', can && !!this.sys.clip?.paths.length)}${b('rename', 'rename', 'Перейменувати (F2)', can && s === 1)}${b('delete', 'trash', 'Видалити (Delete)', can && s > 0)}<i class="cb-sep"></i>${b('sort', 'sort', 'Сортувати', !pc, true)}${b('view', 'view', 'Вигляд', !pc, true)}<span class="grow"></span>${b('terminal', 'terminal', 'Відкрити в терміналі', can, true)}${b('props', 'props', 'Властивості', !pc)}`;
  }
  renderSide() {
    const cur = lc(this.path), fs = this.fs;
    const row = (p, icon, t, ind = 0) => `<button class="sd${lc(p) === cur ? ' on' : ''}" data-go="${esc(p)}" data-drop="${esc(p)}" style="padding-left:${10 + ind * 14}px">${icon}<span>${esc(t)}</span></button>`;
    this.$('.ex-side').innerHTML = row(HOME, folderIcon(18), 'Головна') + '<i class="sd-sep"></i>' + QUICK.map(k => row(HOME + '\\' + k, folderIcon(18, k), KNOWN[k])).join('') + '<i class="sd-sep"></i>' +
      row(PC, pcIcon(18), 'Цей ПК') + fs.drives().map(d => row(d + ':\\', driveIcon(d, 18), `${DRIVE_LABEL[d]} (${d}:)`, 1)).join('') + '<i class="sd-sep"></i>' + row(BIN, binIcon(fs.s.bin.length > 0, 18), 'Кошик');
  }

  /* ═════ події ═════ */
  bind() {
    const body = this.win.body, view = this.$('.ex-view');
    body.addEventListener('click', e => {
      const nav = e.target.closest('[data-nav]'); if (nav && !nav.disabled) return this.nav(nav.dataset.nav);
      const go = e.target.closest('[data-go]'); if (go) return this.go(go.dataset.go);
      const c = e.target.closest('[data-cmd]'); if (c && !c.disabled) return this.cmd(c.dataset.cmd, c);
      const th = e.target.closest('th[data-sort]'); if (th) { const s = this.sys.settings; if (s.sort === th.dataset.sort) s.desc = !s.desc; else { s.sort = th.dataset.sort; s.desc = false; } this.sys.saveSettings(); this.sys.refreshAll(); }
    });
    // адресний рядок: клік — редагувати повний шлях
    const addr = this.$('.ex-addr'), inp = this.$('.addr-inp');
    addr.addEventListener('click', e => { if (e.target.closest('.cr')) return; inp.hidden = false; this.$('.crumbs').hidden = true; inp.value = this.path === PC ? 'Цей ПК' : this.path === BIN ? 'Кошик' : this.path; inp.focus(); inp.select(); });
    const leave = () => { inp.hidden = true; this.$('.crumbs').hidden = false; };
    inp.addEventListener('blur', leave);
    inp.addEventListener('keydown', e => {
      if (e.key === 'Escape') { leave(); view.focus(); }
      if (e.key !== 'Enter') return;
      const v = inp.value.trim().replace(/^"|"$/g, ''); leave();
      const low = lc(v);
      if (low === 'цей пк' || low === 'this pc') return this.go(PC);
      if (low === 'кошик') return this.go(BIN);
      if (['cmd', 'cmd.exe'].includes(low)) return this.sys.open('cmd', this.path.startsWith('::') ? HOME : this.path);
      if (['notepad', 'notepad.exe', 'блокнот'].includes(low)) return this.sys.open('notepad');
      const p = /^[a-z]:/i.test(v) ? v : (this.path.startsWith('::') ? HOME : this.path) + '\\' + v;
      if (this.fs.isFile(p)) return this.sys.openFile(this.fs.real(p));
      this.go(/^[a-z]:$/i.test(p) ? p + '\\' : p);
    });
    const search = this.$('.ex-search input');
    search.addEventListener('input', () => { if (this.path === PC || this.path === BIN) return; this.query = search.value.trim(); this.sel.clear(); this.render(); });
    search.addEventListener('keydown', e => { if (e.key === 'Escape') { search.value = ''; this.query = ''; this.render(); view.focus(); } });
    // вибір і відкриття
    view.addEventListener('pointerdown', e => {
      if (e.target.closest('.ren-inp')) return;
      const it = e.target.closest('.it'), tile = e.target.closest('.tile');
      if (tile) return;
      if (!it) { if (e.button === 0 && !e.ctrlKey && !e.shiftKey) { if (this.renaming) this.commitRename(); this.sel.clear(); this.paint(); } return; }
      if (this.renaming) { this.commitRename(); }
      const k = it.dataset.key;
      if (e.button === 2 && this.sel.has(k)) return;
      if (e.ctrlKey) { this.sel.has(k) ? this.sel.delete(k) : this.sel.add(k); this.anchor = k; }
      else if (e.shiftKey && this.anchor) { const ks = this.cur.map(i => i.key), a = ks.indexOf(this.anchor), b = ks.indexOf(k); this.sel = new Set(ks.slice(Math.min(a, b), Math.max(a, b) + 1)); }
      else if (!this.sel.has(k) || e.button === 2) { this.sel = new Set([k]); this.anchor = k; }
      else this.pendingSingle = k;
      this.paint();
    });
    view.addEventListener('click', e => {
      const it = e.target.closest('.it');
      if (it && this.pendingSingle === it.dataset.key && !e.ctrlKey && !e.shiftKey) { this.sel = new Set([it.dataset.key]); this.anchor = it.dataset.key; this.paint(); }
      this.pendingSingle = null;
    });
    view.addEventListener('dblclick', e => {
      const tile = e.target.closest('.tile'); if (tile) return this.go(tile.dataset.open);
      const it = e.target.closest('.it'); if (!it || e.target.closest('.ren-inp')) return;
      this.openItem(this.cur.find(i => i.key === it.dataset.key));
    });
    view.addEventListener('contextmenu', e => {
      e.preventDefault();
      const tile = e.target.closest('.tile');
      if (tile) return menu(e.clientX, e.clientY, [{ t: 'Відкрити', icon: 'open', on: () => this.go(tile.dataset.open) }, { t: 'Відкрити в новому вікні', icon: 'open', on: () => this.sys.open('explorer', tile.dataset.open) }, { t: 'Відкрити в терміналі', icon: 'terminal', on: () => this.sys.open('cmd', tile.dataset.open) }, '-', { t: 'Властивості', icon: 'props', on: () => tile.dataset.drive ? this.sys.driveProps(tile.dataset.drive) : this.sys.props(tile.dataset.open) }]);
      const it = e.target.closest('.it');
      if (it) return menu(e.clientX, e.clientY, this.itemMenu());
      this.sel.clear(); this.paint();
      menu(e.clientX, e.clientY, this.bgMenu());
    });
    view.addEventListener('keydown', e => this.key(e));
    // перейменування на місці
    view.addEventListener('keydown', e => {
      if (!e.target.classList.contains('ren-inp')) return;
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); this.commitRename(); view.focus(); }
      if (e.key === 'Escape') { this.renaming = null; this.render(); view.focus(); }
    }, true);
    view.addEventListener('input', e => {
      if (!e.target.classList.contains('ren-inp')) return;
      const bad = /[\\/:*?"<>|]/.exec(e.target.value);
      if (bad) { e.target.value = e.target.value.replace(/[\\/:*?"<>|]/g, ''); this.sys.tip(e.target, BAD_NAME_HINT); }
    });
    view.addEventListener('focusout', e => { if (e.target.classList.contains('ren-inp') && !e.relatedTarget?.closest?.('.ren-inp')) setTimeout(() => this.commitRename(), 0); });
    // перетягування
    this.sys.dnd(view, () => this.path, () => [...this.sel].map(k => this.cur.find(i => i.key === k)?.path).filter(Boolean), k => { if (!this.sel.has(k)) { this.sel = new Set([k]); this.render(); } });
    this.sys.dnd(this.$('.ex-side'), null, null);
  }
  nav(a) {
    if (a === 'back' && this.back.length) { this.fwd.push(this.path); this.path = this.back.pop(); this.sel.clear(); this.query = ''; this.render(); }
    if (a === 'fwd' && this.fwd.length) { this.back.push(this.path); this.path = this.fwd.pop(); this.sel.clear(); this.query = ''; this.render(); }
    if (a === 'up' && this.path !== PC && this.path !== BIN) this.go(parentPath(this.path) || PC);
    if (a === 'refresh') this.render();
  }
  selected() { return [...this.sel].map(k => this.cur.find(i => i.key === k)).filter(Boolean); }
  selPaths() { return this.selected().map(i => i.path).filter(Boolean); }
  openItem(it) {
    if (!it) return;
    if (it.bin) return this.sys.props(null, it.bin);
    if (it.node.type === 'dir') return this.go(it.path);
    this.sys.openFile(it.path);
  }
  key(e) {
    if (e.target.closest?.('input, textarea')) return;
    const k = e.key, ctrl = e.ctrlKey || e.metaKey;
    const act = {
      F2: () => this.cmd('rename'), F5: () => this.render(), Delete: () => this.cmd(e.shiftKey ? 'purge' : 'delete'),
      Enter: () => { const s = this.selected(); if (s.length === 1) this.openItem(s[0]); },
      Backspace: () => this.nav('back'),
    }[k];
    if (act && !ctrl) { e.preventDefault(); act(); return; }
    if (e.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp'].includes(k)) { e.preventDefault(); this.nav({ ArrowLeft: 'back', ArrowRight: 'fwd', ArrowUp: 'up' }[k]); return; }
    if (ctrl && !e.shiftKey) {
      // за фізичною клавішею — працює й з українською розкладкою
      const m = { KeyA: () => { this.sel = new Set(this.cur.map(i => i.key)); }, KeyC: () => this.cmd('copy'), KeyX: () => this.cmd('cut'), KeyV: () => this.cmd('paste'), KeyF: () => this.$('.ex-search input').focus() }[e.code];
      if (m) { e.preventDefault(); m(); this.paint(); return; }
    }
    if (ctrl && e.shiftKey && e.code === 'KeyN') { e.preventDefault(); this.newItem('dir'); return; }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(k) && this.cur?.length) {
      e.preventDefault();
      const ks = this.cur.map(i => i.key), cols = this.sys.settings.view === 'details' ? 1 : Math.max(1, Math.floor(this.$('.grid')?.clientWidth / 112) || 1);
      let i = ks.indexOf(this.anchor);
      i = k === 'Home' ? 0 : k === 'End' ? ks.length - 1 : i < 0 ? 0 : Math.min(ks.length - 1, Math.max(0, i + ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[k])));
      this.sel = new Set([ks[i]]); this.anchor = ks[i]; this.paint();
      this.$(`.it[data-key="${CSS.escape(ks[i])}"]`)?.scrollIntoView({ block: 'nearest' });
    }
  }

  /* ═════ дії ═════ */
  async cmd(c, btn) {
    const fs = this.fs, sys = this.sys;
    const at = btn ? btn.getBoundingClientRect() : null;
    try {
      if (c === 'new') return menu(0, 0, [{ t: 'Папку', icon: folderIcon(16), on: () => this.newItem('dir') }, { t: 'Текстовий документ', icon: nodeIcon({ type: 'file', name: 'a.txt' }, null, 16), on: () => this.newItem('txt') }], { anchor: btn });
      if (c === 'cut' || c === 'copy') { const ps = this.selPaths(); if (!ps.length) return; for (const p of ps) if (c === 'cut' && (isProtected(p) || fs.node(p)?.attrs.s)) return alertBox('Цей елемент системний — його не можна перемістити.', 'Провідник', 'warn'); sys.setClip(c, ps); return; }
      if (c === 'paste') return sys.paste(this.path, this);
      if (c === 'rename') { const s = this.selected(); if (s.length !== 1 || !s[0].path) return; if (isProtected(s[0].path) || s[0].node.attrs.s) return alertBox('Цю папку не можна перейменувати: вона потрібна Windows.', 'Провідник', 'warn'); this.renaming = s[0].key; this.render(); return; }
      if (c === 'delete') return sys.recycle(this.selPaths());
      if (c === 'purge') return sys.purge(this.selPaths());
      if (c === 'props') { const s = this.selected(); return s.length ? (s[0].bin ? sys.props(null, s[0].bin) : sys.props(s[0].path)) : sys.props(this.path); }
      if (c === 'terminal') return sys.open('cmd', this.path);
      if (c === 'sort') return menu(0, 0, [['name', 'Ім’я'], ['date', 'Дата змінення'], ['type', 'Тип'], ['size', 'Розмір']].map(([k, t]) => ({ t, check: sys.settings.sort === k, on: () => { sys.settings.sort = k; sys.saveSettings(); sys.refreshAll(); } })).concat(['-', { t: 'За зростанням', check: !sys.settings.desc, on: () => { sys.settings.desc = false; sys.saveSettings(); sys.refreshAll(); } }, { t: 'За спаданням', check: !!sys.settings.desc, on: () => { sys.settings.desc = true; sys.saveSettings(); sys.refreshAll(); } }]), { anchor: btn });
      if (c === 'view') return menu(0, 0, this.viewItems(), { anchor: btn });
      if (c === 'restoreSel' || c === 'restoreAll') { const ids = c === 'restoreAll' ? fs.s.bin.map(b => b.id) : [...this.sel]; for (const id of ids) fs.restore(id); this.sel.clear(); return; }
      if (c === 'empty') { if (await dialog({ title: 'Видалити кілька елементів', icon: 'warn', text: `Остаточно видалити всі елементи з Кошика (${fs.s.bin.length})?`, buttons: [{ t: 'Так', v: true, primary: true }, { t: 'Ні', v: false, cancel: true }] })) fs.purge(); return; }
      if (c === 'purgeSel') { const ids = [...this.sel]; if (await dialog({ title: 'Видалення', icon: 'warn', text: ids.length === 1 ? 'Остаточно видалити цей елемент?' : `Остаточно видалити ці елементи (${ids.length})?`, buttons: [{ t: 'Так', v: true, primary: true }, { t: 'Ні', v: false, cancel: true }] })) ids.forEach(id => fs.purge(id)); this.sel.clear(); }
    } catch (e) { alertBox(e.message, 'Провідник', 'error'); }
  }
  viewItems() {
    const s = this.sys.settings, set = (k, v) => () => { s[k] = v; this.sys.saveSettings(); this.sys.refreshAll(); };
    return [{ t: 'Значки', icon: 'view', check: s.view === 'icons', on: set('view', 'icons') }, { t: 'Таблиця', icon: 'list', check: s.view === 'details', on: set('view', 'details') }, '-',
      { t: 'Розширення імен файлів', check: s.ext, on: set('ext', !s.ext) }, { t: 'Приховані елементи', check: s.hidden, on: set('hidden', !s.hidden) }];
  }
  itemMenu() {
    const s = this.selected(), one = s.length === 1 ? s[0] : null;
    if (this.path === BIN) return [{ t: 'Відновити', icon: 'restore', on: () => this.cmd('restoreSel') }, { t: 'Видалити назавжди', icon: 'trash', on: () => this.cmd('purgeSel') }, '-', { t: 'Властивості', icon: 'props', disabled: !one, on: () => this.cmd('props') }];
    const txt = one && one.node.type === 'file' && (isText(one.node) || ['txt', 'md', 'ini', 'log', 'bat', 'csv'].includes(extOf(one.node.name)));
    return [
      one && { t: 'Відкрити', icon: 'open', kbd: 'Enter', on: () => this.openItem(one) },
      one?.node.type === 'dir' && { t: 'Відкрити в новому вікні', icon: 'open', on: () => this.sys.open('explorer', one.path) },
      one?.node.type === 'dir' && { t: 'Відкрити в терміналі', icon: 'terminal', on: () => this.sys.open('cmd', one.path) },
      txt && { t: 'Редагувати в Блокноті', icon: appIcon('notepad', 16), on: () => this.sys.open('notepad', one.path) },
      '-',
      { t: 'Вирізати', icon: 'cut', kbd: 'Ctrl+X', on: () => this.cmd('cut') }, { t: 'Копіювати', icon: 'copy', kbd: 'Ctrl+C', on: () => this.cmd('copy') },
      { t: 'Копіювати як шлях', icon: 'copy', on: () => { navigator.clipboard?.writeText(this.selPaths().map(p => `"${p}"`).join('\r\n')).catch(() => {}); this.sys.toast('Шлях скопійовано'); } },
      '-', { t: 'Перейменувати', icon: 'rename', kbd: 'F2', disabled: !one, on: () => this.cmd('rename') }, { t: 'Видалити', icon: 'trash', kbd: 'Delete', on: () => this.cmd('delete') },
      '-', { t: 'Властивості', icon: 'props', on: () => this.cmd('props') },
    ];
  }
  bgMenu() {
    if (this.path === BIN) return [{ t: 'Вигляд', icon: 'view', sub: this.viewItems() }, { t: 'Оновити', icon: 'refresh', on: () => this.render() }, '-', { t: 'Очистити кошик', icon: 'trash', disabled: !this.fs.s.bin.length, on: () => this.cmd('empty') }];
    if (this.path === PC) return [{ t: 'Оновити', icon: 'refresh', on: () => this.render() }];
    return [
      { t: 'Вигляд', icon: 'view', sub: this.viewItems() }, { t: 'Сортувати за', icon: 'sort', sub: [['name', 'Ім’я'], ['date', 'Дата змінення'], ['type', 'Тип'], ['size', 'Розмір']].map(([k, t]) => ({ t, check: this.sys.settings.sort === k, on: () => { this.sys.settings.sort = k; this.sys.saveSettings(); this.sys.refreshAll(); } })) },
      { t: 'Оновити', icon: 'refresh', kbd: 'F5', on: () => this.render() }, '-',
      { t: 'Вставити', icon: 'paste', kbd: 'Ctrl+V', disabled: !this.sys.clip?.paths.length, on: () => this.cmd('paste') },
      { t: 'Створити', icon: 'plus', sub: [{ t: 'Папку', icon: folderIcon(16), on: () => this.newItem('dir') }, { t: 'Текстовий документ', icon: nodeIcon({ type: 'file', name: 'a.txt' }, null, 16), on: () => this.newItem('txt') }] },
      '-', { t: 'Відкрити в терміналі', icon: 'terminal', on: () => this.sys.open('cmd', this.path) }, { t: 'Властивості', icon: 'props', on: () => this.sys.props(this.path) },
    ];
  }
  newItem(kind) {
    if (this.path === PC || this.path === BIN || this.query) return;
    try {
      const parent = this.fs.node(this.path);
      const name = this.fs.freeName(parent, kind === 'dir' ? 'Нова папка' : 'Новий текстовий документ.txt');
      const p = this.path.replace(/\\$/, '') + '\\' + name;
      if (kind === 'dir') this.fs.mkdir(p); else this.fs.writeFile(p, '');
      this.sel = new Set([p]); this.anchor = p; this.renaming = p; this.render();
    } catch (e) { alertBox(e.code === 'access' ? 'Тут не можна створювати файли: це системна папка. Спробуйте «Документи» або «Робочий стіл».' : e.message, 'Провідник', 'warn'); }
  }
  commitRename() {
    const inp = this.$('.ren-inp'); const key = this.renaming;
    if (!key || !inp) return;
    const v = inp.value.trim(); this.renaming = null;
    const n = this.fs.node(key);
    if (!n || !v || v === n.name) { this.render(); return; }
    if (!validName(v)) { this.render(); alertBox(BAD_NAME_HINT, 'Перейменування', 'warn'); return; }
    // зміна розширення — як у Windows, попереджаємо
    const go = () => { try { this.fs.rename(key, v); const np = parentPath(key).replace(/\\$/, '') + '\\' + v; this.sel = new Set([np]); this.anchor = np; this.render(); } catch (e) { this.render(); alertBox(e.code === 'exists' ? `У цій папці вже є елемент «${v}».` : e.message, 'Перейменування', 'warn'); } };
    if (n.type === 'file' && extOf(n.name) !== extOf(v) && this.sys.settings.ext) {
      dialog({ title: 'Перейменування', icon: 'warn', text: 'Якщо змінити розширення імені файлу, файл може стати непридатним для використання. Змінити?', buttons: [{ t: 'Так', v: true, primary: true }, { t: 'Ні', v: false, cancel: true }] }).then(ok => ok ? go() : this.render());
      return;
    }
    go();
  }
}
