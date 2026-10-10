// Емулятор Windows · робочий стіл, панель завдань, меню «Пуск», буфер обміну, перетягування, властивості.
import { FS, HOME, KNOWN, DRIVE_LABEL, DRIVE_SIZE, parentPath, nameOfPath, isInside, typeName, fmtDate, fmtTime, fmtSize, fmtNum, validName, BAD_NAME_HINT, isProtected, extOf, isText, FS_EVENTS, batched } from './fs.js';
import { nodeIcon, folderIcon, driveIcon, pcIcon, binIcon, appIcon, winLogo, ui } from './icons.js';
import { WM, dialog, alertBox, menu, closeMenu, esc, h, $ } from './ui.js';
import { Explorer, PC, BIN, wbr } from './explorer.js';
import { Console } from './console.js';
import { Notepad } from './notepad.js';
import { uac } from './uac.js';
import { fwOf, record, evaluate, PROFILES, PROGRAMS } from './fw.js';
import { installProps } from './props.js';
import { procState, SYS_PROCS, appInfo } from './procs.js';
import { installRealtime, avStatus } from './defender.js';
import { primary, reach, syncNET, WIFI } from './net.js';
import { installLock } from './lock.js';

const lc = s => s.toLocaleLowerCase('uk');
const KEY = 'edvault-windows';
const DESK = HOME + '\\Desktop';
const DEFAULTS = { view: 'icons', sort: 'name', desc: false, ext: true, hidden: false, wrap: true };

/* ═════════ Стан і збереження ═════════ */
let saved = null, broken = false;
try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) { broken = !!e && e.name === 'SyntaxError'; }
// збережений стан перевіряємо: пошкоджений (або від старої версії) — починаємо з чистого комп’ютера, а не «зависаємо»
const okNode = n => n && typeof n.name === 'string' && n.attrs && (n.type === 'file' || (n.type === 'dir' && Array.isArray(n.children) && n.children.every(okNode)));
const okState = st => st && st.drives && okNode(st.drives.C) && okNode(st.drives.D) && Array.isArray(st.bin) && Number.isFinite(st.seq);
if (saved?.fs && !okState(saved.fs)) { broken = true; saved = null; }
const fs = new FS(saved?.fs ? saved.fs : null);
const sys = {
  fs, explorers: new Set(), clip: null, recent: saved?.recent || [], procs: procState(),
  settings: { ...DEFAULTS, ...(saved?.settings || {}) },
};
let saveT = 0;
let quotaWarned = false;
const saveNow = () => {
  clearTimeout(saveT); saveT = 0;
  try { localStorage.setItem(KEY, JSON.stringify({ fs: fs.s, settings: sys.settings, recent: sys.recent })); quotaWarned = false; }
  catch (e) { if (e?.name === 'QuotaExceededError' && !quotaWarned) { quotaWarned = true; sys.toast?.('Не вдалося зберегти зміни: на навчальному комп’ютері забагато даних. Видаліть великі файли або очистіть Кошик.'); } }
};
const persist = () => { clearTimeout(saveT); saveT = setTimeout(saveNow, 250); };
// перед закриттям вкладки — зберегти негайно, щоб не втратити останні зміни
addEventListener('pagehide', () => { if (saveT) saveNow(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && saveT) saveNow(); });
fs.on(w => { if (w !== 'avscan') persist(); });
sys.saveSettings = persist;
sys.refreshAll = () => { for (const x of sys.explorers) x.render(); desktop.render(); };
sys.addRecent = p => { sys.recent = [p, ...sys.recent.filter(x => lc(x) !== lc(p))].slice(0, 8); persist(); };

/* ═════════ Повідомлення ═════════ */
sys.toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(sys.toast.t); sys.toast.t = setTimeout(() => t.classList.remove('on'), 2400); };
sys.tip = (el, msg) => {
  document.querySelectorAll('.tip').forEach(x => x.remove());
  const r = el.getBoundingClientRect(), t = h(`<div class="tip">${esc(msg)}</div>`);
  document.body.appendChild(t); t.style.left = Math.min(innerWidth - 300, r.left) + 'px'; t.style.top = (r.bottom + 6) + 'px';
  setTimeout(() => t.remove(), 3000);
};

/* ═════════ Відкриття ═════════ */
sys.open = (app, path) => {
  closeStart();
  if (app === 'explorer') return new Explorer(sys, path === BIN || path === PC ? path : path && fs.isDir(path) ? fs.real(path) : PC);
  if (app === 'cmd') return new Console(sys, path || HOME);
  if (app === 'notepad') { if (path) sys.addRecent(path); return new Notepad(sys, path); }
  if (app === 'bin') return new Explorer(sys, BIN);
  if (app === 'pc') return new Explorer(sys, PC);
  if (app === 'cmd-admin') return uac({ app: 'Обробник команд Windows', icon: appIcon('cmd', 32), file: 'C:\\Windows\\System32\\cmd.exe' }).then(ok => ok && new Console(sys, null, { admin: true }));
  if (LAZY[app]) return openLazy(app, path);
};
// великі програми підвантажуються, коли знадобляться (і заздалегідь — у вільний час після старту)
const LAZY = { taskmgr: () => import('./taskmgr.js'), settings: () => import('./settings.js'), browser: () => import('./browser.js'), security: () => import('./firewall.js'), firewallcpl: () => import('./firewall.js'), wfmsc: () => import('./wfmsc.js'), ncpa: () => import('./netui.js') };
async function openLazy(app, path) {
  const m = await LAZY[app]();
  if (app === 'taskmgr') { const w = WM.wins.find(x => x.app === 'taskmgr'); if (w) return WM.focus(w); return new m.TaskManager(sys, path || 'proc'); }
  if (app === 'settings') { const w = WM.wins.find(x => x.app === 'settings'); if (w) { WM.focus(w); if (path) w.app_?.go(path); return w.app_; } const a = new m.SettingsApp(sys, path); a.win.app_ = a; return a; }
  if (app === 'ncpa') { const w = WM.wins.find(x => x.app === 'ncpa'); if (w) return WM.focus(w); return new m.NetConnections(sys); }
  if (app === 'browser') { const w = WM.active()?.app === 'browser' ? WM.active() : WM.wins.filter(x => x.app === 'browser').sort((a, b) => b.z - a.z)[0]; if (w && path) { WM.focus(w); w.browser.newTab(); w.browser.go(path); return w.browser; } if (w && !path) return WM.focus(w); const b = new m.Browser(sys, path); b.win.browser = b; return b; }
  if (app === 'security') { const w = WM.wins.find(x => x.app === 'security'); if (w) { WM.focus(w); w.app_?.go(path || 'firewall'); return; } const a = new m.SecurityApp(sys, path || 'home'); a.win.app_ = a; return a; }
  if (app === 'firewallcpl') { const w = WM.wins.find(x => x.app === 'firewallcpl'); if (w) { WM.focus(w); w.app_?.go(path || 'main'); return; } const a = new m.FirewallCpl(sys, path || 'main'); a.win.app_ = a; return a; }
  if (app === 'wfmsc') {
    const w = WM.wins.find(x => x.app === 'wfmsc'); if (w) return WM.focus(w);
    return uac({ app: 'Брандмауер Захисника Windows у режимі підвищеної безпеки', icon: appIcon('firewall', 32), file: 'C:\\Windows\\System32\\mmc.exe' }).then(ok => ok && new m.Wfmsc(sys));
  }
}
sys.preload = () => Promise.all(Object.values(LAZY).map(f => f()));
// виклики з командного рядка
sys.launch = async (a, p) => {
  if (a === 'notepad-new') {
    const ok = await dialog({ title: 'Блокнот', icon: 'question', text: `Не вдається знайти файл «${nameOfPath(p)}». Створити новий файл?`, buttons: [{ t: 'Так', v: true, primary: true }, { t: 'Ні', v: false }, { t: 'Скасувати', v: null, cancel: true }] });
    if (ok) { try { fs.writeFile(p, ''); sys.open('notepad', p); } catch (e) { alertBox(e.message, 'Блокнот', 'error'); } }
    else if (ok === false) sys.open('notepad');
    return;
  }
  if (a === 'file') return sys.openFile(p);
  return sys.open(a, p);
};
sys.openFile = async p => {
  const n = fs.node(p); if (!n) return;
  if (n.type === 'dir') return sys.open('explorer', p);
  const e = extOf(n.name);
  if (isText(n) || ['txt', 'md', 'ini', 'log', 'bat', 'csv', 'html'].includes(e)) return sys.open('notepad', p);
  if (e === 'exe') return alertBox('Встановлювати й запускати програми на навчальному комп’ютері не можна. Тут працюють Провідник, Командний рядок і Блокнот.', nameOfPath(p), 'info');
  const v = await dialog({ title: 'Як ви хочете відкрити цей файл?', icon: 'question', html: `<p><b>${esc(n.name)}</b> — ${esc(typeName(n))}.</p><p>На навчальному комп’ютері немає програми для таких файлів. Можна відкрити його в Блокноті — але замість змісту будуть незрозумілі символи, бо це не текст.</p>`, buttons: [{ t: 'Відкрити в Блокноті', v: true }, { t: 'Скасувати', v: false, primary: true, cancel: true }] });
  if (v) sys.open('notepad', p);
};

// «Виконати…» з Диспетчера завдань
sys.run = (t, admin) => {
  const a = t.trim().replace(/^"|"$/g, ''), k = lc(a).replace(/\.exe$/, '');
  const map = { cmd: admin ? 'cmd-admin' : 'cmd', notepad: 'notepad', explorer: 'explorer', taskmgr: 'taskmgr', browser: 'browser', msedge: 'browser', chrome: 'browser', 'wf.msc': 'wfmsc', wfmsc: 'wfmsc', 'ncpa.cpl': 'ncpa', ncpa: 'ncpa', 'firewall.cpl': 'firewallcpl', 'ms-settings:': 'settings', control: 'firewallcpl', calc: null };
  if (k in map && map[k]) { sys.open(map[k]); return true; }
  if (/^(https?:\/\/|www\.)/i.test(a) || /^\d+\.\d+\.\d+\.\d+$/.test(a)) { sys.open('browser', a); return true; }
  if (/^[a-z]:/i.test(a) && fs.node(a)) { sys.openFile(fs.real(a)); return true; }
  return false;
};
sys.showInFolder = p => { if (!fs.node(p)) return alertBox('Файл уже видалено або переміщено.', 'Провідник', 'warn'); const e = sys.open('explorer', parentPath(p)); if (e?.sel) { e.sel = new Set([fs.real(p)]); e.anchor = fs.real(p); e.render(); } };
// процеси для tasklist / taskkill і Диспетчера завдань
sys.procList = () => [...SYS_PROCS.filter(p => !sys.procs.killed.has(p.pid)).map(p => ({ name: p.name, pid: p.pid, mem: p.mem })), ...WM.wins.map(w => ({ name: w.exe, pid: w.pid, mem: appInfo(w.app)[2] }))];
sys.isCritical = by => SYS_PROCS.some(p => p.critical && (by.pid ? p.pid === by.pid : lc(p.name) === by.im));
sys.killProc = by => {
  const wins = WM.wins.filter(w => by.pid ? w.pid === by.pid : lc(w.exe) === by.im);
  wins.forEach(w => setTimeout(() => w.close(true), 30));
  const bg = SYS_PROCS.filter(p => !p.critical && !p.restart && !sys.procs.killed.has(p.pid) && (by.pid ? p.pid === by.pid : lc(p.name) === by.im));
  bg.forEach(p => { sys.procs.killed.add(p.pid); if (p.name === 'SecurityHealthSystray.exe') sys.trayShield(false); });
  return [...wins.map(w => ({ name: w.exe, pid: w.pid })), ...bg.map(p => ({ name: p.name, pid: p.pid }))];
};
sys.trayShield = on => { $('#fwTray').hidden = !on; };
// перезапуск Провідника: робочий стіл і панель завдань зникають на мить
sys.restartExplorer = () => {
  WM.wins.filter(w => w.app === 'explorer').forEach(w => w.close(true));
  document.body.classList.add('no-shell');
  setTimeout(() => { document.body.classList.remove('no-shell'); desktop.render(); renderTaskbar(); sys.toast('Провідник Windows перезапущено'); }, 1300);
};
// «синій екран», якщо завершити критичний процес
sys.crash = code => {
  const el = h(`<div id="bsod"><div><p class="sad">:(</p><p>На вашому ПК виникла проблема, і його потрібно перезапустити. Ми збираємо відомості про помилку, а потім комп’ютер перезапуститься.</p><p class="pc"><b>0</b>% виконано</p><p class="code">Код зупинки: ${code}</p><p class="why">Ви завершили процес, без якого Windows не може працювати. Нічого страшного — після перезавантаження все запрацює знову, файли залишаться.</p></div></div>`);
  document.body.appendChild(el);
  WM.wins.slice().forEach(w => w.close(true));
  let p = 0; const tm = setInterval(() => { p = Math.min(100, p + 7 + Math.round(Math.random() * 10)); el.querySelector('.pc b').textContent = p; if (p >= 100) { clearInterval(tm); setTimeout(() => { el.remove(); sys.procs = procState(); sys.trayShield(true); reboot(); }, 600); } }, 380);
};
sys.factoryReset = () => {
  closeStart();
  for (const w of [...WM.wins]) w.close(true);
  sys.clip = null; sys.recent = []; Object.assign(sys.settings, DEFAULTS);
  sys.routerSession = null; sys.routerLock = null; sys.routerBusy = 0;
  fs.reset(); persist(); sys.refreshAll(); renderTaskbar();
  const el = h('<div id="resetting"><div class="spin"></div><p>Скидання цього ПК</p><p class="pc"><b>0</b>%</p></div>');
  document.body.appendChild(el);
  let p = 0; const tm = setInterval(() => { p = Math.min(100, p + 9); el.querySelector('b').textContent = p; if (p >= 100) { clearInterval(tm); el.remove(); sys.procs = procState(); sys.trayShield(true); reboot(); } }, 160);
};

/* ═════════ Буфер обміну, вставлення, видалення ═════════ */
sys.setClip = (mode, paths) => { sys.clip = { mode, paths: paths.map(p => fs.real(p)) }; sys.toast(mode === 'cut' ? `Вирізано: ${paths.length}` : `Скопійовано: ${paths.length}`); sys.refreshAll(); };
// Перенести або скопіювати список шляхів у папку; питає про заміну
sys.transfer = async (paths, dest, mode) => {
  let done = 0;
  for (const src of paths) {
    const n = fs.node(src); if (!n) continue;
    try {
      const sameDir = lc(parentPath(src) || '') === lc(dest.replace(/\\$/, '') + (/^[a-z]:\\?$/i.test(dest) ? '\\' : '')) || lc(parentPath(src)) === lc(dest);
      if (mode === 'cut' && sameDir) continue;
      if (n.type === 'dir' && isInside(dest, src)) { await alertBox('Кінцева папка є вкладеною папкою вихідної папки.', 'Перерваний процес', 'warn'); continue; }
      const target = fs.node(dest);
      const clash = target.children.find(c => lc(c.name) === lc(n.name));
      if (mode === 'copy' && sameDir) { fs.copy(src, dest.replace(/\\$/, '') + '\\' + fs.copyName(target, n.name), { recursive: true }); done++; continue; }
      if (clash) {
        if (clash.type === 'dir' || n.type === 'dir') { await alertBox(`У кінцевій папці вже є «${n.name}».`, 'Заміна або пропуск', 'warn'); continue; }
        const v = await dialog({ title: 'Заміна або пропуск файлів', icon: 'question', html: `<p>У кінцевій папці вже є файл <b>«${esc(n.name)}»</b>.</p>`, buttons: [{ t: 'Замінити файл', v: 'rep', primary: true }, { t: 'Пропустити', v: 'skip', cancel: true }] });
        if (v !== 'rep') continue;
      }
      if (mode === 'cut') fs.move(src, dest, { overwrite: true }); else fs.copy(src, dest, { overwrite: true, recursive: true });
      done++;
    } catch (e) { await alertBox(e.code === 'access' ? `Відмовлено в доступі: «${n.name}». Це системний елемент або файл лише для читання.` : e.message, mode === 'cut' ? 'Переміщення' : 'Копіювання', 'warn'); }
  }
  return done;
};
sys.paste = async dest => {
  if (!sys.clip || dest === PC || dest === BIN) return;
  const { mode, paths } = sys.clip;
  await sys.transfer(paths, dest, mode);
  if (mode === 'cut') sys.clip = null;
  sys.refreshAll();
};
sys.recycle = async paths => {
  if (!paths.length) return;
  const nodes = paths.map(p => fs.node(p)).filter(Boolean);
  for (const p of paths) if (isProtected(fs.real(p)) || fs.node(p)?.attrs.s) return alertBox('Цей елемент потрібен Windows — видалити його не можна.', 'Відмовлено в доступі', 'warn');
  for (const p of paths) {
    try { fs.recycle(p); } catch (e) { await alertBox(e.code === 'access' ? `Не вдається видалити «${nameOfPath(p)}»: файл лише для читання. Зніміть атрибут у Властивостях або командою attrib -r.` : e.message, 'Видалення', 'warn'); }
  }
  if (nodes.length) sys.toast(nodes.length === 1 ? `«${nodes[0].name}» переміщено в Кошик` : `Переміщено в Кошик: ${nodes.length}`);
};
sys.purge = async paths => {
  if (!paths.length) return;
  const ok = await dialog({ title: 'Видалення', icon: 'warn', text: paths.length === 1 ? `Остаточно видалити «${nameOfPath(paths[0])}»? Відновити з Кошика не вийде.` : `Остаточно видалити ці елементи (${paths.length})?`, buttons: [{ t: 'Так', v: true, primary: true }, { t: 'Ні', v: false, cancel: true }] });
  if (!ok) return;
  for (const p of paths) { try { fs.remove(p, { recursive: true }); } catch (e) { await alertBox(e.message, 'Видалення', 'warn'); } }
};

/* ═════════ Перетягування ═════════ */
const DT = 'application/x-edvault-files';
let dragPaths = null;
// dest: функція — куди кидати на порожнє місце; getPaths — що тягнемо
sys.dnd = (el, dest, getPaths, onStart) => {
  if (getPaths) {
    el.addEventListener('dragstart', e => {
      const it = e.target.closest('[data-key]'); if (!it || it.getAttribute('draggable') !== 'true') return;
      onStart?.(it.dataset.key);
      dragPaths = getPaths();
      if (!dragPaths.length) { e.preventDefault(); return; }
      e.dataTransfer.setData(DT, JSON.stringify(dragPaths)); e.dataTransfer.effectAllowed = 'copyMove';
    });
    el.addEventListener('dragend', () => { dragPaths = null; document.querySelectorAll('.drop-on').forEach(x => x.classList.remove('drop-on')); });
  }
  const targetOf = e => {
    const d = e.target.closest('[data-drop]'); if (d) return { el: d, path: d.dataset.drop };
    const it = e.target.closest('[data-key]');
    if (it) { const k = it.dataset.key; if (k === BIN || k === '::bin') return { el: it, path: BIN }; if (k === '::pc') return null; if (fs.isDir(k)) return { el: it, path: k }; }
    const p = dest?.(); return p && p !== PC ? { el: null, path: p } : null;
  };
  el.addEventListener('dragover', e => {
    if (!dragPaths) return;
    const t = targetOf(e); if (!t) return;
    if (t.path !== BIN && dragPaths.some(p => lc(p) === lc(t.path) || isInside(t.path, p))) return;
    e.preventDefault();
    const copy = t.path !== BIN && (e.ctrlKey || (!e.shiftKey && dragPaths[0][0] !== t.path[0]));
    e.dataTransfer.dropEffect = copy ? 'copy' : 'move';
    document.querySelectorAll('.drop-on').forEach(x => x !== t.el && x.classList.remove('drop-on'));
    t.el?.classList.add('drop-on');
  });
  el.addEventListener('dragleave', e => { const t = e.target.closest('[data-drop], [data-key]'); if (t && !t.contains(e.relatedTarget)) t.classList.remove('drop-on'); });
  el.addEventListener('drop', async e => {
    const t = targetOf(e); if (!t || !dragPaths) return;
    e.preventDefault(); e.stopPropagation();
    const paths = dragPaths; dragPaths = null;
    document.querySelectorAll('.drop-on').forEach(x => x.classList.remove('drop-on'));
    if (t.path === BIN) return sys.recycle(paths);
    // як у Windows: у межах диска — перемістити, на інший диск — скопіювати; Ctrl — копія, Shift — переміщення
    const copy = e.ctrlKey || (!e.shiftKey && paths[0][0] !== t.path[0]);
    const n = await sys.transfer(paths, t.path, copy ? 'copy' : 'cut');
    if (n && copy) sys.toast(`Скопійовано: ${n}`);
  });
};

/* ═════════ Властивості ═════════ */
installProps(sys);
sys.driveProps = d => {
  const total = DRIVE_SIZE[d], free = fs.free(d), used = total - free, deg = used / total * 360;
  dialog({ title: `Властивості: ${DRIVE_LABEL[d]} (${d}:)`, wide: true, html: `<div class="props"><div class="pr-head">${driveIcon(d, 40)}<b>${DRIVE_LABEL[d]} (${d}:)</b></div><table><tr><th>Тип:</th><td>Локальний диск</td></tr><tr><th>Файлова система:</th><td>NTFS</td></tr>
    <tr class="sep"><td colspan="2"></td></tr><tr><th><i class="sw used"></i>Зайнято:</th><td>${fmtSize(used)}</td></tr><tr><th><i class="sw free"></i>Вільно:</th><td>${fmtSize(free)}</td></tr><tr><th>Ємність:</th><td>${fmtSize(total)}</td></tr></table>
    <div class="pie" style="--deg:${deg}deg"></div></div>`, buttons: [{ t: 'OK', v: true, primary: true }] });
};

/* ═════════ Робочий стіл ═════════ */
const desktop = {
  sel: new Set(), renaming: null, anchor: null,
  el: null,
  items() {
    const list = [{ key: '::pc', name: 'Цей ПК', icon: pcIcon(44) }, { key: BIN, name: 'Кошик', icon: binIcon(fs.s.bin.length > 0, 44) }];
    if (fs.isDir(DESK)) for (const c of fs.list(DESK, { hidden: sys.settings.hidden }).sort((a, b) => a.name.localeCompare(b.name, 'uk', { numeric: true }))) list.push({ key: fs.real(DESK) + '\\' + c.name, node: c, name: sys.settings.ext || c.type === 'dir' || !extOf(c.name) ? c.name : c.name.slice(0, c.name.lastIndexOf('.')), icon: nodeIcon(c, null, 44) });
    return list;
  },
  render() {
    const items = this.items(); this.cur = items;
    for (const k of [...this.sel]) if (!items.some(i => i.key === k)) this.sel.delete(k);
    const cut = sys.clip?.mode === 'cut' ? new Set(sys.clip.paths.map(lc)) : new Set();
    this.el.innerHTML = items.map(it => `<div class="dk${this.sel.has(it.key) ? ' sel' : ''}${cut.has(lc(it.key)) ? ' cut' : ''}${it.node?.attrs.h ? ' hid' : ''}" data-key="${esc(it.key)}" draggable="${!!it.node}" title="${esc(it.node ? it.node.name + '\n' + typeName(it.node) : it.name)}">${it.icon}${this.renaming === it.key ? `<textarea class="ren-inp" rows="2" spellcheck="false">${esc(it.node.name)}</textarea>` : `<span>${wbr(it.name)}</span>`}</div>`).join('');
    const inp = this.el.querySelector('.ren-inp');
    if (inp) { inp.focus(); const dot = inp.value.lastIndexOf('.'); inp.setSelectionRange(0, this.renaming && fs.isDir(this.renaming) || dot <= 0 ? inp.value.length : dot); }
  },
  paint() { if (this.renaming) return this.render(); this.el.querySelectorAll('.dk').forEach(d => d.classList.toggle('sel', this.sel.has(d.dataset.key))); },
  open(it) {
    if (!it) return;
    if (it.key === '::pc') return sys.open('pc');
    if (it.key === BIN) return sys.open('bin');
    sys.openFile(it.key);
  },
  paths() { return [...this.sel].filter(k => k.includes('\\')); },
  newItem(kind) {
    try {
      const name = fs.freeName(fs.node(DESK), kind === 'dir' ? 'Нова папка' : 'Новий текстовий документ.txt');
      const p = fs.real(DESK) + '\\' + name;
      if (kind === 'dir') fs.mkdir(p); else fs.writeFile(p, '');
      this.sel = new Set([p]); this.renaming = p; this.render();
    } catch (e) { alertBox(e.message, 'Робочий стіл', 'warn'); }
  },
  commit() {
    const inp = this.el.querySelector('.ren-inp'), key = this.renaming; if (!key || !inp) return;
    const v = inp.value.trim(); this.renaming = null;
    const n = fs.node(key);
    if (!n || !v || v === n.name) return this.render();
    if (!validName(v)) { this.render(); return alertBox(BAD_NAME_HINT, 'Перейменування', 'warn'); }
    try { fs.rename(key, v); this.sel = new Set([fs.real(DESK) + '\\' + v]); this.render(); } catch (e) { this.render(); alertBox(e.code === 'exists' ? `На робочому столі вже є «${v}».` : e.message, 'Перейменування', 'warn'); }
  },
  bind() {
    const el = this.el = $('#icons');
    el.addEventListener('pointerdown', e => {
      if (e.target.closest('.ren-inp')) return;
      const d = e.target.closest('.dk');
      if (this.renaming) this.commit();
      if (!d) { if (!e.ctrlKey) { this.sel.clear(); this.paint(); } el.focus({ preventScroll: true }); return; }
      const k = d.dataset.key;
      if (e.ctrlKey) this.sel.has(k) ? this.sel.delete(k) : this.sel.add(k);
      else if (e.shiftKey && this.anchor) { const ks = this.cur.map(i => i.key), a = ks.indexOf(this.anchor), b = ks.indexOf(k); this.sel = new Set(ks.slice(Math.min(a, b), Math.max(a, b) + 1)); }
      else if (!this.sel.has(k) || e.button === 2) this.sel = new Set([k]);
      if (!e.shiftKey) this.anchor = k;
      this.paint(); el.focus({ preventScroll: true });
    });
    el.addEventListener('dblclick', e => { const d = e.target.closest('.dk'); if (d && !e.target.closest('.ren-inp')) this.open(this.cur.find(i => i.key === d.dataset.key)); });
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      const d = e.target.closest('.dk');
      if (!d) return menu(e.clientX, e.clientY, [
        { t: 'Вигляд', icon: 'view', sub: [{ t: 'Розширення імен файлів', check: sys.settings.ext, on: () => { sys.settings.ext = !sys.settings.ext; persist(); sys.refreshAll(); } }, { t: 'Приховані елементи', check: sys.settings.hidden, on: () => { sys.settings.hidden = !sys.settings.hidden; persist(); sys.refreshAll(); } }] },
        { t: 'Оновити', icon: 'refresh', on: () => this.render() }, '-',
        { t: 'Вставити', icon: 'paste', kbd: 'Ctrl+V', disabled: !sys.clip?.paths.length, on: () => sys.paste(fs.real(DESK)) },
        { t: 'Створити', icon: 'plus', sub: [{ t: 'Папку', icon: folderIcon(16), on: () => this.newItem('dir') }, { t: 'Текстовий документ', icon: nodeIcon({ type: 'file', name: 'a.txt' }, null, 16), on: () => this.newItem('txt') }] }, '-',
        { t: 'Відкрити в терміналі', icon: 'terminal', on: () => sys.open('cmd', fs.real(DESK)) }, { t: 'Відкрити в Провіднику', icon: 'open', on: () => sys.open('explorer', fs.real(DESK)) },
      ]);
      const k = d.dataset.key;
      if (k === '::pc') return menu(e.clientX, e.clientY, [{ t: 'Відкрити', icon: 'open', on: () => sys.open('pc') }, { t: 'Відкрити в терміналі', icon: 'terminal', on: () => sys.open('cmd', HOME) }]);
      if (k === BIN) return menu(e.clientX, e.clientY, [{ t: 'Відкрити', icon: 'open', on: () => sys.open('bin') }, '-', { t: 'Очистити кошик', icon: 'trash', disabled: !fs.s.bin.length, on: async () => { if (await dialog({ title: 'Видалити кілька елементів', icon: 'warn', text: `Остаточно видалити всі елементи з Кошика (${fs.s.bin.length})?`, buttons: [{ t: 'Так', v: true, primary: true }, { t: 'Ні', v: false, cancel: true }] })) fs.purge(); } }]);
      const paths = this.paths(), one = paths.length === 1 ? fs.node(paths[0]) : null;
      menu(e.clientX, e.clientY, [
        one && { t: 'Відкрити', icon: 'open', kbd: 'Enter', on: () => sys.openFile(paths[0]) },
        one?.type === 'dir' && { t: 'Відкрити в терміналі', icon: 'terminal', on: () => sys.open('cmd', paths[0]) },
        one?.type === 'file' && (isText(one) || ['txt', 'md', 'ini', 'log', 'bat', 'csv'].includes(extOf(one.name))) && { t: 'Редагувати в Блокноті', icon: appIcon('notepad', 16), on: () => sys.open('notepad', paths[0]) }, '-',
        { t: 'Вирізати', icon: 'cut', kbd: 'Ctrl+X', on: () => sys.setClip('cut', paths) }, { t: 'Копіювати', icon: 'copy', kbd: 'Ctrl+C', on: () => sys.setClip('copy', paths) }, '-',
        { t: 'Перейменувати', icon: 'rename', kbd: 'F2', disabled: !one, on: () => { this.renaming = paths[0]; this.render(); } },
        { t: 'Видалити', icon: 'trash', kbd: 'Delete', on: () => sys.recycle(paths) }, '-', { t: 'Властивості', icon: 'props', disabled: !one, on: () => sys.props(paths[0]) },
      ]);
    });
    el.addEventListener('keydown', e => {
      if (e.target.classList.contains('ren-inp')) {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); this.commit(); el.focus(); }
        if (e.key === 'Escape') { this.renaming = null; this.render(); el.focus(); }
        return;
      }
      const ps = this.paths(), ctrl = e.ctrlKey || e.metaKey;
      if (e.key === 'Delete') { e.preventDefault(); e.shiftKey ? sys.purge(ps) : sys.recycle(ps); }
      else if (e.key === 'F2' && ps.length === 1) { e.preventDefault(); this.renaming = ps[0]; this.render(); }
      else if (e.key === 'Enter') { const s = [...this.sel]; if (s.length === 1) this.open(this.cur.find(i => i.key === s[0])); }
      else if (ctrl && e.code === 'KeyC' && ps.length) { e.preventDefault(); sys.setClip('copy', ps); }
      else if (ctrl && e.code === 'KeyX' && ps.length) { e.preventDefault(); sys.setClip('cut', ps); }
      else if (ctrl && e.code === 'KeyV') { e.preventDefault(); sys.paste(fs.real(DESK)); }
      else if (ctrl && e.code === 'KeyA') { e.preventDefault(); this.sel = new Set(this.cur.map(i => i.key)); this.paint(); }
      else if (e.key === 'F5') { e.preventDefault(); this.render(); }
    });
    el.addEventListener('input', e => { if (e.target.classList.contains('ren-inp') && /[\\/:*?"<>|]/.test(e.target.value)) { e.target.value = e.target.value.replace(/[\\/:*?"<>|]/g, ''); sys.tip(e.target, BAD_NAME_HINT); } });
    el.addEventListener('focusout', e => { if (e.target.classList.contains('ren-inp')) setTimeout(() => this.commit(), 0); });
    sys.dnd(el, () => fs.real(DESK), () => this.paths(), k => { if (!this.sel.has(k)) { this.sel = new Set([k]); this.render(); } });
    const later = batched(() => { if (!this.renaming) this.render(); });
    fs.on(w => { if (FS_EVENTS.has(w)) later(); });
  },
};

/* ═════════ Панель завдань ═════════ */
const PINNED = [['explorer', 'Провідник'], ['browser', 'Браузер'], ['cmd', 'Командний рядок'], ['notepad', 'Блокнот']];
const APP_NAME = { security: 'Безпека Windows', firewallcpl: 'Брандмауер Захисника Windows', wfmsc: 'Брандмауер Захисника Windows у режимі підвищеної безпеки', taskmgr: 'Диспетчер завдань', settings: 'Параметри', browser: 'Браузер' };
const tbIcon = a => appIcon({ wfmsc: 'firewall', firewallcpl: 'firewall' }[a] || a, 24);
function renderTaskbar() {
  const act = WM.active();
  const extra = [...new Set(WM.wins.map(w => w.app))].filter(a => !PINNED.some(p => p[0] === a)).map(a => [a, APP_NAME[a] || a]);
  $('#tbApps').innerHTML = [...PINNED, ...extra].map(([a, t]) => {
    const ws = WM.wins.filter(w => w.app === a);
    return `<button class="tb-app${ws.length ? ' run' : ''}${act && act.app === a ? ' act' : ''}" data-app="${a}" title="${esc(ws.length === 1 ? ws[0].title : t)}">${tbIcon(a)}${ws.length > 1 ? `<i class="cnt">${ws.length}</i>` : ''}</button>`;
  }).join('');
}
WM.on(renderTaskbar);
$('#tbApps').addEventListener('click', e => {
  const b = e.target.closest('[data-app]'); if (!b) return;
  const a = b.dataset.app, ws = WM.wins.filter(w => w.app === a).sort((x, y) => x.z - y.z);
  if (!ws.length) return sys.open(a);
  const act = WM.active();
  if (ws.length === 1) { if (act === ws[0]) WM.minimize(ws[0]); else WM.focus(ws[0]); return; }
  // кілька вікон — по черзі
  const i = ws.indexOf(act); WM.focus(ws[(i + 1) % ws.length] || ws[0]);
});
$('#tbApps').addEventListener('contextmenu', e => {
  e.preventDefault();
  const b = e.target.closest('[data-app]'); if (!b) return;
  const a = b.dataset.app, ws = WM.wins.filter(w => w.app === a);
  menu(e.clientX, e.clientY, [...ws.map(w => ({ t: w.title, icon: tbIcon(a).replace(/width="24" height="24"/, 'width="16" height="16"'), on: () => WM.focus(w) })), ws.length && '-', { t: 'Нове вікно', icon: 'plus', on: () => sys.open(a) }, a === 'cmd' && { t: 'Запустити від імені адміністратора', icon: 'shield', on: () => sys.open('cmd-admin') }, ws.length && { t: ws.length > 1 ? 'Закрити всі вікна' : 'Закрити вікно', icon: 'close', on: () => ws.forEach(w => w.close()) }]);
  const m = document.querySelector('.cm-root'); if (m) { const r = m.getBoundingClientRect(); m.style.top = (innerHeight - 52 - r.height) + 'px'; }
});
function clock() {
  const d = new Date();
  $('#clock').innerHTML = `<b>${fmtTime(d)}</b><small>${fmtDate(d)}</small>`;
}
clock(); setInterval(clock, 10000);
$('#clock').title = new Date().toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/* ═════════ Брандмауер: значок у треї та «чужі» спроби підключитися ═════════ */
function renderShield() {
  const off = PROFILES.filter(p => !fwOf(fs).profiles[p].on), av = avStatus(fs), bad = off.length > 0 || av.bad;
  const b = $('#fwTray');
  b.classList.toggle('bad', bad);
  b.title = av.pending ? `Безпека Windows: знайдено загроз — ${av.pending}` : !av.rt ? 'Безпека Windows: захист у реальному часі вимкнено' : off.length ? 'Безпека Windows: брандмауер вимкнено — потрібні дії' : 'Безпека Windows: дії не потрібні';
  b.innerHTML = `${ui('shield', 16)}${bad ? '<i class="dot"></i>' : ''}`;
}
$('#fwTray').addEventListener('click', () => { const av = avStatus(fs); sys.open('security', av.bad ? 'virus' : PROFILES.some(p => !fwOf(fs).profiles[p].on) ? 'firewall' : 'home'); });
fs.on(w => { if (w === 'fw' || w === 'reset' || w === 'av') renderShield(); });
installRealtime(sys);

/* ═════════ Мережа: значок у треї ═════════ */
const NOWIFI = '<path d="M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M5 12.86a10 10 0 0 1 14 0M2 8.82a15 15 0 0 1 20 0" opacity=".3"/>';
function renderNet() {
  syncNET(fs);
  const a = primary(fs), inet = a && reach(fs, '8.8.8.8').ok, b = $('#netTray');
  const lvl = a?.id === 'wifi' ? WIFI.find(w => w.ssid === a.ssid)?.signal || 0 : 0;
  const glyph = !a ? `${NOWIFI}<path d="m4 4 16 16"/>` : a.id === 'eth' ? '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>' : ['M12 20h.01', 'M8.5 16.43a5 5 0 0 1 7 0', 'M5 12.86a10 10 0 0 1 14 0', 'M2 8.82a15 15 0 0 1 20 0'].map((d, i) => `<path d="${d}"${i < lvl ? '' : ' opacity=".3"'}/>`).join('');
  b.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyph}</svg>${a && !inet ? '<i class="warn-dot">!</i>' : ''}`;
  b.title = !a ? 'Немає підключення до Інтернету' : `${a.ssid || a.net.name}\n${inet ? 'Доступ до Інтернету' : 'Немає доступу до Інтернету'}`;
}
$('#netTray').addEventListener('click', async e => { const b = e.currentTarget, m = await import('./netui.js'); m.toggleNetFlyout(sys, b); });
const netLater = batched(renderNet);
fs.on(w => { if (w === 'net' || w === 'reset') netLater(); });
renderNet();
sys.closeAll = () => WM.wins.slice().forEach(w => w.close(true));
renderShield();
// Інші комп’ютери шкільної мережі час від часу «стукають» до цього ПК — події видно в «Спостереженні»
const KNOCKS = [
  { protocol: 'ICMPv4', icmpType: 8, remoteIp: '192.168.1.15', program: PROGRAMS.system },
  { protocol: 'TCP', localPort: 445, remotePort: 51234, remoteIp: '192.168.1.22', program: PROGRAMS.system },
  { protocol: 'TCP', localPort: 3389, remotePort: 50112, remoteIp: '192.168.1.40', program: PROGRAMS.svchost },
  { protocol: 'UDP', localPort: 137, remotePort: 137, remoteIp: '192.168.1.15', program: PROGRAMS.system },
  { protocol: 'TCP', localPort: 25565, remotePort: 49870, remoteIp: '192.168.1.31', program: PROGRAMS.minecraft },
];
let knock = 0;
setInterval(() => {
  if (document.hidden || !primary(fs)) return;
  const pkt = { dir: 'in', ...KNOCKS[knock++ % KNOCKS.length] };
  record(fs, pkt, evaluate(fwOf(fs), pkt));
}, 17000);

/* ═════════ Меню «Пуск» ═════════ */
const START_PINS = [
  { t: 'Провідник', icon: () => appIcon('explorer', 32), on: () => sys.open('explorer', PC) },
  { t: 'Командний рядок', icon: () => appIcon('cmd', 32), on: () => sys.open('cmd') },
  { t: 'Блокнот', icon: () => appIcon('notepad', 32), on: () => sys.open('notepad') },
  { t: 'Браузер', icon: () => appIcon('browser', 32), on: () => sys.open('browser') },
  { t: 'Параметри', icon: () => appIcon('settings', 32), on: () => sys.open('settings') },
  { t: 'Диспетчер завдань', icon: () => appIcon('taskmgr', 32), on: () => sys.open('taskmgr') },
  { t: 'Безпека Windows', icon: () => appIcon('security', 32), on: () => sys.open('security') },
  { t: 'Брандмауер', icon: () => appIcon('firewall', 32), on: () => sys.open('firewallcpl') },
  { t: 'Кошик', icon: () => binIcon(fs.s.bin.length > 0, 32), on: () => sys.open('bin') },
  { t: 'Документи', icon: () => folderIcon(32, 'Documents'), on: () => sys.open('explorer', HOME + '\\Documents') },
  { t: 'Завантаження', icon: () => folderIcon(32, 'Downloads'), on: () => sys.open('explorer', HOME + '\\Downloads') },
  { t: 'Зображення', icon: () => folderIcon(32, 'Pictures'), on: () => sys.open('explorer', HOME + '\\Pictures') },
  { t: 'Цей ПК', icon: () => pcIcon(32), on: () => sys.open('pc') },
  { t: 'Довідка', icon: () => appIcon('help', 32), on: () => showHelp() },
];
let startOpen = false;
function openStart() {
  startOpen = true; $('#start').hidden = false; $('#startBtn').classList.add('on');
  $('#stQ').value = ''; renderStart(); $('#stQ').focus(); setTimeout(() => { if (startOpen && !$('#start').contains(document.activeElement)) $('#stQ').focus(); }, 20);
}
function closeStart() { if (!startOpen) return; startOpen = false; $('#start').hidden = true; $('#startBtn').classList.remove('on'); }
sys.closeStart = closeStart;
function searchAll(q) {
  const out = [], lq = lc(q);
  const apps = [['Провідник', 'explorer', ['explorer', 'провідник', 'файли']], ['Командний рядок', 'cmd', ['cmd', 'командний', 'консоль', 'термінал']], ['Блокнот', 'notepad', ['notepad', 'блокнот', 'текст']], ['Кошик', 'bin', ['кошик', 'recycle']], ['Безпека Windows', 'security', ['безпека', 'захисник', 'defender', 'security', 'антивірус']], ['Брандмауер Захисника Windows', 'firewallcpl', ['брандмауер', 'firewall', 'фаєрвол', 'файрвол', 'мережевий екран']], ['Брандмауер у режимі підвищеної безпеки', 'wfmsc', ['wf.msc', 'wf', 'брандмауер', 'firewall', 'правила', 'додаткові']], ['Командний рядок (адміністратор)', 'cmd-admin', ['cmd', 'адміністратор', 'admin']], ['Браузер', 'browser', ['браузер', 'browser', 'інтернет', 'edge', 'chrome', 'сайт', 'роутер']], ['Диспетчер завдань', 'taskmgr', ['диспетчер', 'taskmgr', 'task manager', 'процеси', 'служби']], ['Параметри', 'settings', ['параметри', 'налаштування', 'settings', 'скинути', 'відновлення', 'обліковий', 'пароль']], ['Мережеві підключення', 'ncpa', ['мережа', 'мережеві', 'ncpa', 'адаптер', 'ethernet', 'ip', 'wi-fi', 'wifi', 'інтернет']], ['Мережа й Інтернет', 'settings:network', ['мережа', 'інтернет', 'wi-fi', 'wifi', 'діагностика']]];
  for (const [t, a, keys] of apps) if (keys.some(k => k.startsWith(lq) || lc(t).includes(lq))) out.push({ t, sub: 'Застосунок', icon: appIcon({ bin: 'bin', wfmsc: 'firewall', firewallcpl: 'firewall', 'cmd-admin': 'cmd', 'settings:network': 'ncpa' }[a] || a, 24), on: () => a === 'settings:network' ? sys.open('settings', 'network') : sys.open(a) });
  const walk = (p, depth) => { if (depth > 8 || out.length > 14) return; for (const c of fs.list(p)) { const cp = p.replace(/\\$/, '') + '\\' + c.name; if (lc(c.name).includes(lq)) out.push({ t: c.name, sub: parentPath(cp), icon: nodeIcon(c, cp, 24), on: () => sys.openFile(cp) }); if (c.type === 'dir' && !c.attrs.s) walk(cp, depth + 1); } };
  walk(HOME, 0); walk('D:\\', 0);
  return out.slice(0, 9);
}
function renderStart() {
  const q = $('#stQ').value.trim();
  const body = $('#stBody');
  if (q) {
    const res = searchAll(q);
    sys.startRes = res;
    body.innerHTML = res.length ? `<h4>Найкращий збіг</h4><div class="st-res">${res.map((r, i) => `<button class="st-r${i === 0 ? ' first' : ''}" data-r="${i}">${r.icon}<span><b>${esc(r.t)}</b><small>${esc(r.sub)}</small></span></button>`).join('')}</div>` : `<p class="st-none">Нічого не знайдено за запитом «${esc(q)}».</p>`;
    return;
  }
  const rec = sys.recent.filter(p => fs.node(p)).slice(0, 6);
  body.innerHTML = `<h4>Закріплені</h4><div class="st-pins">${START_PINS.map((p, i) => `<button class="st-pin" data-p="${i}">${p.icon()}<span>${p.t}</span></button>`).join('')}</div>
    <h4>Рекомендовані</h4>${rec.length ? `<div class="st-rec">${rec.map(p => { const n = fs.node(p); return `<button class="st-r" data-open="${esc(p)}">${nodeIcon(n, p, 28)}<span><b>${esc(n.name)}</b><small>${esc(parentPath(p))}</small></span></button>`; }).join('')}</div>` : '<p class="st-none">Тут з’являться файли, які ви нещодавно відкривали в Блокноті.</p>'}`;
}
$('#startBtn').addEventListener('click', () => startOpen ? closeStart() : openStart());
$('#searchBtn').addEventListener('click', () => startOpen ? closeStart() : openStart());
$('#stQ').addEventListener('input', renderStart);
$('#stQ').addEventListener('keydown', e => { if (e.key === 'Enter') { const q = $('#stQ').value.trim(); if (q && sys.startRes?.[0]) { closeStart(); sys.startRes[0].on(); } } });
$('#start').addEventListener('click', e => {
  const p = e.target.closest('[data-p]'); if (p) { closeStart(); START_PINS[+p.dataset.p].on(); return; }
  const r = e.target.closest('[data-r]'); if (r) { closeStart(); sys.startRes[+r.dataset.r].on(); return; }
  const o = e.target.closest('[data-open]'); if (o) { closeStart(); sys.openFile(o.dataset.open); return; }
  if (e.target.closest('.st-user')) {
    const b = e.target.closest('.st-user');
    menu(0, 0, [{ t: 'Змінити параметри облікового запису', icon: 'person', on: () => { closeStart(); sys.open('settings', 'accounts'); } }, '-', { t: 'Заблокувати', icon: 'lock', on: () => { closeStart(); sys.lock(); } }, { t: 'Вийти', icon: 'logout', on: () => { closeStart(); sys.signOut(); } }], { anchor: b });
    const m = document.querySelector('.cm-root'); if (m) { const r = m.getBoundingClientRect(), a = b.getBoundingClientRect(); m.style.top = (a.top - r.height - 6) + 'px'; m.style.left = a.left + 'px'; }
    return;
  }
  if (e.target.closest('#powerBtn')) {
    menu(0, 0, [{ t: 'Перезавантажити', icon: 'refresh', on: () => reboot() }, '-', { t: 'Скинути комп’ютер до початкового стану…', icon: 'restore', on: () => resetAll() }], { anchor: e.target.closest('#powerBtn') });
    const m = document.querySelector('.cm-root'); if (m) { const r = m.getBoundingClientRect(), a = $('#powerBtn').getBoundingClientRect(); m.style.top = (a.top - r.height - 6) + 'px'; m.style.left = (a.right - r.width) + 'px'; }
  }
});
document.addEventListener('pointerdown', e => { if (startOpen && !e.target.closest('#start, #startBtn, #searchBtn, .cm-root')) closeStart(); });
async function reboot() {
  closeStart();
  for (const w of [...WM.wins]) await w.close();
  if (WM.wins.length) return;
  sys.procs = procState(); sys.trayShield(true); sys.routerSession = null;
  $('#boot').hidden = false; $('#boot').classList.add('on');
  sys.lock();
  setTimeout(() => { $('#boot').classList.remove('on'); setTimeout(() => { $('#boot').hidden = true; }, 400); }, 1400);
}
async function resetAll() {
  closeStart();
  const ok = await dialog({ title: 'Скинути комп’ютер', icon: 'warn', html: '<p>Усі ваші файли й налаштування (брандмауер, роутер, браузер) буде видалено, а комп’ютер повернеться до початкового стану.</p><p>Продовжити?</p>', buttons: [{ t: 'Скинути', v: true, primary: true }, { t: 'Скасувати', v: false, cancel: true }] });
  if (ok) sys.factoryReset();
}
sys.reboot = reboot;
function showHelp() {
  dialog({ title: 'Довідка', icon: 'info', wide: true, html: `<p><b>Це навчальний комп’ютер.</b> Тут можна сміливо пробувати — нічого не зламаєш, а все можна повернути через «Пуск» → кнопку живлення → «Скинути комп’ютер».</p>
    <ul class="help-l"><li><b>Провідник</b> — подвійне клацання відкриває, права кнопка — меню, F2 — перейменувати, Delete — у Кошик, Ctrl+C / Ctrl+X / Ctrl+V — копіювати, вирізати, вставити. Файли можна перетягувати мишкою.</li>
    <li><b>Командний рядок</b> — напишіть <code>help</code>, щоб побачити всі команди, або <code>dir /?</code> — довідку про команду. Стрілки ↑ ↓ — попередні команди, Tab — доповнити назву.</li>
    <li>Команди <code>del</code> і <code>rd</code> видаляють <b>назавжди</b>, а Провідник — у <b>Кошик</b>.</li>
    <li>Усе, що ви робите в консолі, одразу видно в Провіднику, і навпаки.</li>
    <li><b>Брандмауер</b> — «Пуск» → «Безпека Windows» або «Брандмауер». Зміни налаштувань просять права адміністратора: ім’я <code>admin</code>, пароль <code>admin</code>. Правила справді діють на <code>ping</code> і <code>curl</code> у консолі.</li></ul>`, buttons: [{ t: 'Зрозуміло', v: true, primary: true }] });
}

/* ═════════ Клавіатура ═════════ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && startOpen) { closeStart(); return; }
  if (e.ctrlKey && e.shiftKey && e.key === 'Escape') { e.preventDefault(); sys.open('taskmgr'); return; }
  if (e.ctrlKey && e.key === 'Escape') { e.preventDefault(); startOpen ? closeStart() : openStart(); }
});
$('#taskbar').addEventListener('contextmenu', e => {
  if (e.target.closest('#tbApps [data-app], #startBtn, .tray, #fwTray, #netTray, #clock')) return;
  e.preventDefault();
  menu(e.clientX, e.clientY, [{ t: 'Диспетчер завдань', icon: appIcon('taskmgr', 16), on: () => sys.open('taskmgr') }, { t: 'Параметри', icon: appIcon('settings', 16), on: () => sys.open('settings') }]);
  const m = document.querySelector('.cm-root'); if (m) { const r = m.getBoundingClientRect(); m.style.top = (innerHeight - 52 - r.height) + 'px'; }
});
document.addEventListener('contextmenu', e => { if (!e.target.closest('input, textarea, .con')) e.preventDefault(); });

/* ═════════ Доступність: кожне поле має назву ═════════ */
// у формах підпис часто стоїть поруч (сітка «підпис — поле»), а не обгортає поле; беремо назву з нього
const FIELDS = 'input:not([type=hidden]), select, textarea';
const nameField = i => {
  if (i.getAttribute('aria-label') || i.getAttribute('aria-labelledby') || i.closest('label') || (i.id && document.querySelector(`label[for="${CSS.escape(i.id)}"]`))) return;
  const txt = e => e?.textContent.replace(/\s+/g, ' ').trim().replace(/:$/, '');
  const row = i.closest('.rt-row'), prev = i.previousElementSibling, box = i.parentElement;
  const t = row ? txt(row.querySelector('.rt-l'))
    : prev?.tagName === 'LABEL' ? txt(prev)
    : box?.previousElementSibling?.tagName === 'LABEL' ? txt(box.previousElementSibling)
    : i.closest('button') ? txt(i.closest('button'))
    : i.closest('td') ? (() => { const td = i.closest('td'), tr = td.parentElement, th = tr.closest('table')?.querySelector(`thead th:nth-child(${td.cellIndex + 1})`); const first = [...tr.cells].find(c => c !== td && txt(c)); return [txt(th), txt(first)].filter(Boolean).join(': '); })()
    : i.placeholder || i.title || txt(i.closest('fieldset')?.querySelector('legend')) || '';
  if (t) i.setAttribute('aria-label', t.slice(0, 80));
};
const nameAll = root => { if (root.matches?.(FIELDS)) nameField(root); root.querySelectorAll?.(FIELDS).forEach(nameField); };
const added = new Set();
const flush = batched(() => { for (const n of added) if (n.isConnected) nameAll(n); added.clear(); });
new MutationObserver(list => { for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1) added.add(n); flush(); }).observe(document.body, { childList: true, subtree: true });

/* ═════════ Старт ═════════ */
installLock(sys);
sys.lock();
desktop.bind();
desktop.render();
renderTaskbar();
setTimeout(() => { $('#boot').classList.remove('on'); setTimeout(() => { $('#boot').hidden = true; }, 400); }, 700);
window.WinEmu = { fs, sys, WM, desktop, open: sys.open, openStart, closeStart, lock: () => sys.lock() };
(window.requestIdleCallback || setTimeout)(() => sys.preload().catch(() => {}));
if (broken) setTimeout(() => sys.toast('Збережений стан комп’ютера був пошкоджений, тому його повернуто до початкового.'), 1200);
// емулятор — одна сторінка: жодна форма чи посилання не повинні переводити зі сторінки (і губити відкриті вікна)
document.addEventListener('submit', e => e.preventDefault());
// Alt+← / Alt+→ і бокові кнопки мишки керують «Назад/Вперед» усередині емулятора (Браузер, Провідник), а не виводять зі сторінки
document.addEventListener('keydown', e => { if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') || e.key === 'BrowserBack' || e.key === 'BrowserForward') e.preventDefault(); });
for (const t of ['mouseup', 'mousedown']) document.addEventListener(t, e => { if (e.button === 3 || e.button === 4) e.preventDefault(); });
// натискання на вимкнену кнопку (зокрема на її іконку) ніколи не виконує дію
for (const t of ['click', 'dblclick', 'auxclick']) document.addEventListener(t, e => { if (e.target.closest?.('button:disabled, .ma.off, .cm-it.off')) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
document.addEventListener('click', e => { if (e.target.closest?.('a[href]')) e.preventDefault(); });
document.addEventListener('auxclick', e => { if (e.target.closest?.('a[href]')) e.preventDefault(); });
// непередбачена помилка не повинна «вішати» комп’ютер: показуємо підказку, решта працює далі
let errT = 0;
const oops = () => { if (Date.now() - errT < 5000) return; errT = Date.now(); sys.toast('Щось пішло не так у цій дії. Комп’ютер працює далі — спробуйте ще раз.'); };
addEventListener('error', oops);
addEventListener('unhandledrejection', oops);
