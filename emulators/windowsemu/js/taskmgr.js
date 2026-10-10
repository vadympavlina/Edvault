// Емулятор Windows · Диспетчер завдань: процеси, продуктивність, автозавантаження, користувачі, подробиці, служби.
import { SYS_PROCS, STARTUP, SERVICES } from './procs.js';
import { appIcon, ui } from './icons.js';
import { WM, dialog, alertBox, menu, esc, modal } from './ui.js';
import { fmtNum, USER } from './fs.js';

const PAGES = [['proc', 'apps', 'Процеси'], ['perf', 'chart', 'Продуктивність'], ['startup', 'rocket', 'Автозавантаження'], ['users', 'users', 'Користувачі'], ['details', 'list', 'Подробиці'], ['services', 'puzzle', 'Служби']];
const APP_INFO = {
  explorer: ['Провідник', 'explorer.exe', 26000, 0.3], cmd: ['Обробник команд Windows', 'cmd.exe', 4300, 0.1], notepad: ['Блокнот', 'notepad.exe', 14800, 0.1],
  security: ['Безпека Windows', 'SecHealthUI.exe', 41200, 0.2], firewallcpl: ['Панель керування', 'explorer.exe', 22000, 0.1], wfmsc: ['Консоль керування Microsoft', 'mmc.exe', 38900, 0.3],
  taskmgr: ['Диспетчер завдань', 'Taskmgr.exe', 31200, 1.1], browser: ['Браузер', 'browser.exe', 186000, 1.6], settings: ['Параметри', 'SystemSettings.exe', 52300, 0.2],
};
export const appInfo = a => APP_INFO[a] || [a, a + '.exe', 12000, 0.1];
const MEM_TOTAL = 8 * 1024 * 1024; // КБ
const CORES = 4;
const pct = v => `${v.toFixed(1).replace('.', ',')}%`;
const mb = kb => kb >= 1024 * 1024 ? `${(kb / 1024 / 1024).toFixed(1).replace('.', ',')} ГБ` : `${(kb / 1024).toFixed(1).replace('.', ',')} МБ`;
const heat = (v, max) => { const a = Math.min(1, v / max); return a < 0.02 ? '' : `style="background:rgba(255,196,0,${(0.12 + a * 0.5).toFixed(2)})"`; };
const fmtUp = ms => { const s = Math.floor(ms / 1000), z = n => String(n).padStart(2, '0'); return `${Math.floor(s / 86400)}:${z(Math.floor(s / 3600) % 24)}:${z(Math.floor(s / 60) % 60)}:${z(s % 60)}`; };

export class TaskManager {
  constructor(sys, page = 'proc') {
    this.sys = sys; this.page = page; this.q = ''; this.sel = null; this.sort = { col: null, asc: false }; this.open = { apps: true, bg: true, win: true };
    this.live = {}; this.hist = { cpu: [], mem: [], diskC: [], diskD: [], net: [] }; this.perf = 'cpu'; this.netBump = 0;
    this.win = WM.open({ app: 'taskmgr', exe: 'Taskmgr.exe', title: 'Диспетчер завдань', icon: appIcon('taskmgr', 16), w: 980, h: 640, minW: 700, minH: 420 });
    this.win.body.innerHTML = `<div class="tm"><header class="tm-top"><label class="tm-search">${ui('search', 15)}<input placeholder="Введіть ім’я, видавця або PID для пошуку" spellcheck="false"></label></header>
      <div class="tm-main"><nav class="tm-nav">${PAGES.map(([k, i, t]) => `<button class="tm-n" data-page="${k}" title="${t}">${ui(i, 18)}<span>${t}</span></button>`).join('')}</nav>
      <section class="tm-body"><header class="tm-h"></header><div class="tm-c" tabindex="-1"></div></section></div></div>`;
    this.$ = s => this.win.body.querySelector(s);
    this.bind();
    for (let i = 0; i < 60; i++) this.tick(true);
    this.render();
    this.timer = setInterval(() => { if (!this.win.el.isConnected) return clearInterval(this.timer); this.tick(); if (!this.win.min) this.refresh(); }, 1000);
    this.unsub = sys.fs.on(w => { if (w === 'fwlog') this.netBump += 6; if (w === 'reset') this.render(); });
    const onWm = () => { if (this.win.el.isConnected && (this.page === 'proc' || this.page === 'details')) this.refresh(); };
    WM.on(onWm);
    const close = this.win.close; this.win.close = f => { clearInterval(this.timer); this.unsub(); WM.subs.delete(onWm); return close(f); };
  }
  get P() { return this.sys.procs; }

  /* ── дані ── */
  // усі процеси: вікна програм + системні (без завершених)
  procs() {
    const apps = [];
    const byApp = new Map();
    for (const w of WM.wins) { if (!byApp.has(w.app)) byApp.set(w.app, []); byApp.get(w.app).push(w); }
    for (const [a, ws] of byApp) {
      const [title, exe, mem, cpu] = appInfo(a);
      apps.push({ key: 'app:' + a, app: a, title: ws.length > 1 ? `${title} (${ws.length})` : title, name: ws[0].exe || exe, pid: ws[0].pid, pids: ws.map(w => w.pid), mem: mem * ws.length, cpu, kind: 'apps', wins: ws, user: USER, desc: title });
    }
    const sys = SYS_PROCS.filter(p => !this.P.killed.has(p.pid)).map(p => ({ ...p, key: 'pid:' + p.pid, kind: p.kind === 'win' ? 'win' : 'bg' }));
    return [...apps, ...sys];
  }
  val(p) {
    const L = this.live[p.key] ||= { cpu: p.cpu || 0, mem: p.mem, disk: 0, net: 0 };
    return L;
  }
  tick(silent) {
    const list = this.procs();
    let cpuSum = 0, memSum = 2_400_000, disk = 0, net = 0;
    for (const p of list) {
      const L = this.val(p), base = p.cpu || 0;
      L.cpu = Math.max(0, base + (Math.random() - 0.6) * (base + 0.3) * 1.2);
      if (Math.random() < 0.04) L.cpu += Math.random() * 4;
      L.mem = Math.round(p.mem * (0.97 + Math.random() * 0.06));
      L.disk = Math.random() < 0.08 ? +(Math.random() * 1.6).toFixed(1) : 0;
      L.net = (p.app === 'browser' || p.name === 'OneDrive.exe' || p.name === 'ms-teams.exe') && Math.random() < 0.3 ? +(Math.random() * 0.4).toFixed(1) : 0;
      cpuSum += L.cpu; memSum += L.mem; disk += L.disk; net += L.net;
    }
    if (this.netBump) { net += this.netBump * 0.12; this.netBump = Math.max(0, this.netBump - 2); }
    const push = (k, v) => { this.hist[k].push(v); if (this.hist[k].length > 60) this.hist[k].shift(); };
    this.tot = { cpu: Math.min(100, cpuSum + 2 + Math.random() * 2), mem: memSum, disk: Math.min(100, disk * 3), diskD: Math.random() < 0.05 ? Math.random() * 6 : 0, net, count: list.length };
    push('cpu', this.tot.cpu); push('mem', memSum / MEM_TOTAL * 100); push('diskC', this.tot.disk); push('diskD', this.tot.diskD); push('net', Math.min(100, net * 8));
  }

  /* ── відмальовування ── */
  render() {
    if (!this.win.el.isConnected) return;
    this.win.body.querySelectorAll('[data-page]').forEach(b => b.classList.toggle('on', b.dataset.page === this.page));
    this.$('.tm-search').hidden = !['proc', 'details', 'services', 'startup'].includes(this.page);
    this.refresh(true);
  }
  // часте оновлення: лише вміст, без втрати прокрутки й виділення
  refresh(full) {
    const c = this.$('.tm-c'), top = c.scrollTop;
    const html = this['p_' + this.page]();
    this.$('.tm-h').innerHTML = this.head();
    if (this.page === 'perf' && !full && c.querySelector('.pf')) { this.perfUpdate(); return; }
    c.innerHTML = html; c.scrollTop = top;
  }
  head() {
    const t = PAGES.find(p => p[0] === this.page)[2], sel = this.selected();
    const btn = (act, ic, label, on = true) => `<button class="tm-b" data-act="${act}" ${on ? '' : 'disabled'}>${ui(ic, 15)}<span>${label}</span></button>`;
    const acts = {
      proc: btn('run', 'plus', 'Запустити нове завдання') + btn('end', 'ban', 'Зняти завдання', !!sel),
      perf: btn('run', 'plus', 'Запустити нове завдання'),
      startup: btn('run', 'plus', 'Запустити нове завдання') + btn('toggleStart', 'power', this.sel && this.sys.fs.s.startup?.[this.sel] === false ? 'Увімкнути' : 'Вимкнути', !!STARTUP.find(s => s.key === this.sel)),
      users: '',
      details: btn('run', 'plus', 'Запустити нове завдання') + btn('end', 'ban', 'Зняти завдання', !!sel),
      services: btn('svcStart', 'play', 'Запустити', !!this.selSvc() && !this.P.services[this.sel]) + btn('svcStop', 'stop', 'Зупинити', !!this.selSvc() && this.P.services[this.sel]) + btn('svcRestart', 'refresh', 'Перезапустити', !!this.selSvc() && this.P.services[this.sel]),
    }[this.page];
    return `<h2>${t}</h2><span class="grow"></span>${acts}`;
  }
  selected() { if (!this.sel) return null; return this.procs().find(p => p.key === this.sel) || null; }
  selSvc() { return SERVICES.find(s => s.name === this.sel); }
  match(...xs) { const q = this.q.toLocaleLowerCase('uk'); return !q || xs.some(x => String(x).toLocaleLowerCase('uk').includes(q)); }
  p_proc() {
    const list = this.procs().filter(p => this.match(p.title, p.name, p.pid)), T = this.tot;
    const s = this.sort, sortV = p => { const L = this.val(p); return s.col === 'name' ? p.title : L[s.col]; };
    if (s.col) list.sort((a, b) => { const x = sortV(a), y = sortV(b); return (typeof x === 'string' ? x.localeCompare(y, 'uk') : x - y) * (s.asc ? 1 : -1); });
    const th = (k, t, sub) => `<th data-sort="${k}" class="${k === 'name' ? 'nm' : 'num'}${s.col === k ? ' sorted' : ''}">${sub ? `<b>${sub}</b>` : ''}<span>${t}</span></th>`;
    const row = p => { const L = this.val(p);
      return `<tr data-key="${esc(p.key)}" class="${this.sel === p.key ? 'sel' : ''}"><td class="nm"><span class="tm-ic">${p.app ? appIcon({ firewallcpl: 'firewall', wfmsc: 'firewall' }[p.app] || p.app, 16) || ui('apps', 15) : ui(p.kind === 'win' ? 'gear' : 'chip', 15)}</span>${esc(p.title)}</td><td class="st">${p.app === 'browser' ? '' : ''}</td>
      <td class="num" ${heat(L.cpu, 20)}>${pct(L.cpu)}</td><td class="num" ${heat(L.mem, 400000)}>${mb(L.mem)}</td><td class="num" ${heat(L.disk, 2)}>${L.disk.toFixed(1).replace('.', ',')} МБ/с</td><td class="num" ${heat(L.net, 0.5)}>${L.net.toFixed(1).replace('.', ',')} Мбіт/с</td></tr>`; };
    const grp = (k, t) => { const g = list.filter(p => p.kind === k); if (!g.length) return ''; return `<tr class="grp" data-fold="${k}"><td colspan="6">${ui(this.open[k] ? 'down' : 'chevron', 12)}${t} (${g.length})</td></tr>${this.open[k] ? g.map(row).join('') : ''}`; };
    return `<table class="tm-t"><thead><tr>${th('name', 'Ім’я')}<th class="st">Стан</th>${th('cpu', 'ЦП', pct(T.cpu).replace(',0', ''))}${th('mem', 'Пам’ять', Math.round(T.mem / MEM_TOTAL * 100) + '%')}${th('disk', 'Диск', Math.round(T.disk) + '%')}${th('net', 'Мережа', Math.round(Math.min(100, T.net * 8)) + '%')}</tr></thead>
      <tbody>${s.col ? list.map(row).join('') : grp('apps', 'Програми') + grp('bg', 'Фонові процеси') + grp('win', 'Процеси Windows')}</tbody></table>${list.length ? '' : '<p class="tm-empty">Нічого не знайдено.</p>'}`;
  }
  perfItems() {
    const T = this.tot;
    return [['cpu', 'ЦП', `${Math.round(T.cpu)}% ${(2.1 + T.cpu / 100 * 1.6).toFixed(2).replace('.', ',')} ГГц`, 'cpu'], ['mem', 'Пам’ять', `${(T.mem / 1024 / 1024).toFixed(1).replace('.', ',')}/8,0 ГБ (${Math.round(T.mem / MEM_TOTAL * 100)}%)`, 'mem'],
      ['diskC', 'Диск 0 (C:)', `SSD · ${Math.round(T.disk)}%`, 'diskC'], ['diskD', 'Диск 1 (D:)', `HDD · ${Math.round(T.diskD)}%`, 'diskD'], ['net', 'Ethernet', `Н: ${(T.net * 0.3).toFixed(1).replace('.', ',')} П: ${(T.net * 0.7).toFixed(1).replace('.', ',')} Мбіт/с`, 'net']];
  }
  spark(k, w, h, big) {
    const d = this.hist[k], pts = d.map((v, i) => `${(i / 59 * w).toFixed(1)},${(h - v / 100 * h).toFixed(1)}`).join(' ');
    const grid = big ? Array.from({ length: 9 }, (_, i) => `<path d="M${(i + 1) * w / 10} 0V${h}" class="g"/>`).join('') + Array.from({ length: 9 }, (_, i) => `<path d="M0 ${(i + 1) * h / 10}H${w}" class="g"/>`).join('') : '';
    return `<svg class="sp ${k}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" width="100%" height="100%">${grid}<polygon points="0,${h} ${pts} ${w},${h}" class="f"/><polyline points="${pts}" class="l"/></svg>`;
  }
  p_perf() {
    return `<div class="pf"><div class="pf-list">${this.perfItems().map(([k, t, sub]) => `<button class="pf-it${k === this.perf ? ' on' : ''}" data-perf="${k}"><span class="pf-sp">${this.spark(k, 60, 34)}</span><span><b>${t}</b><small data-sub="${k}">${sub}</small></span></button>`).join('')}</div>
      <div class="pf-main">${this.perfMain()}</div></div>`;
  }
  perfMain() {
    const k = this.perf, T = this.tot, up = fmtUp(Date.now() - this.P.boot + 3 * 3600e3 + 1260e3);
    const info = {
      cpu: ['ЦП', 'Навчальний процесор Edvault E4 @ 2,10 ГГц', '% використання', [['Використання', `${Math.round(T.cpu)}%`], ['Швидкість', `${(2.1 + T.cpu / 100 * 1.6).toFixed(2).replace('.', ',')} ГГц`], ['Процеси', T.count], ['Потоки', 1100 + T.count * 23], ['Дескриптори', fmtNum(41230 + T.count * 310)], ['Час роботи', up]], [['Базова швидкість', '2,10 ГГц'], ['Ядра', CORES], ['Логічні процесори', CORES * 2], ['Віртуалізація', 'Увімкнуто'], ['Кеш L2', '5,0 МБ'], ['Кеш L3', '8,0 МБ']]],
      mem: ['Пам’ять', '8,0 ГБ DDR4', 'Використання пам’яті', [['Використовується', `${(T.mem / 1024 / 1024).toFixed(1).replace('.', ',')} ГБ`], ['Доступно', `${((MEM_TOTAL - T.mem) / 1024 / 1024).toFixed(1).replace('.', ',')} ГБ`], ['Виділено', `${(T.mem / 1024 / 1024 * 1.4).toFixed(1).replace('.', ',')}/12,8 ГБ`], ['Кешовано', '2,1 ГБ']], [['Швидкість', '3200 МГц'], ['Гнізд використано', '2 з 2'], ['Форм-фактор', 'SODIMM'], ['Зарезервовано обладнанням', '118 МБ']]],
      diskC: ['Диск 0 (C:)', 'Навчальний SSD 256 ГБ', 'Активний час', [['Активний час', `${Math.round(T.disk)}%`], ['Середній час відповіді', '0,4 мс'], ['Швидкість читання', `${(T.disk * 0.8).toFixed(1).replace('.', ',')} МБ/с`], ['Швидкість запису', `${(T.disk * 0.3).toFixed(1).replace('.', ',')} МБ/с`]], [['Ємність', '238 ГБ'], ['Відформатовано', '238 ГБ'], ['Системний диск', 'Так'], ['Тип', 'SSD (NVMe)']]],
      diskD: ['Диск 1 (D:)', 'Навчальний HDD 128 ГБ', 'Активний час', [['Активний час', `${Math.round(T.diskD)}%`], ['Середній час відповіді', '6,2 мс'], ['Швидкість читання', '0 КБ/с'], ['Швидкість запису', '0 КБ/с']], [['Ємність', '119 ГБ'], ['Системний диск', 'Ні'], ['Тип', 'HDD']]],
      net: ['Ethernet', 'Мережевий адаптер Realtek PCIe GbE', 'Пропускна здатність', [['Надсилання', `${(T.net * 0.3).toFixed(1).replace('.', ',')} Мбіт/с`], ['Отримання', `${(T.net * 0.7).toFixed(1).replace('.', ',')} Мбіт/с`]], [['Ім’я адаптера', 'Ethernet'], ['Тип підключення', 'Ethernet'], ['IPv4-адреса', '192.168.1.27'], ['Основний шлюз', '192.168.1.1'], ['DNS-сервер', '192.168.1.10']]],
    }[k];
    return `<header class="pf-h"><h3>${info[0]}</h3><span>${info[1]}</span></header><div class="pf-cap"><span>${info[2]}</span><span>${k === 'net' ? '100 Мбіт/с' : '100%'}</span></div>
      <div class="pf-big">${this.spark(k, 600, 220, true)}</div><div class="pf-cap"><span>60 секунд</span><span>0</span></div>
      <div class="pf-stats"><div class="pf-live">${info[3].map(([a, b]) => `<div><small>${a}</small><b>${b}</b></div>`).join('')}</div><table>${info[4].map(([a, b]) => `<tr><th>${a}:</th><td>${b}</td></tr>`).join('')}</table></div>`;
  }
  perfUpdate() {
    for (const [k, , sub] of this.perfItems()) { const it = this.$(`[data-perf="${k}"]`); if (!it) continue; it.querySelector('.pf-sp').innerHTML = this.spark(k, 60, 34); it.querySelector(`[data-sub="${k}"]`).textContent = sub; }
    this.$('.pf-main').innerHTML = this.perfMain();
  }
  p_startup() {
    const st = this.sys.fs.s.startup || {};
    const list = STARTUP.filter(s => this.match(s.name, s.pub));
    return `<p class="tm-note">Ці програми запускаються самі, коли вмикається комп’ютер. Чим їх більше, тим довше вмикається ПК. Вимкнена програма не видаляється — її просто не запускатимуть автоматично.</p>
      <table class="tm-t"><thead><tr><th class="nm">Ім’я</th><th>Видавець</th><th>Стан</th><th>Вплив на запуск</th></tr></thead><tbody>${list.map(s => { const on = st[s.key] ?? s.on;
      return `<tr data-start="${s.key}" class="${this.sel === s.key ? 'sel' : ''}"><td class="nm"><span class="tm-ic">${ui('rocket', 15)}</span>${esc(s.name)}</td><td>${esc(s.pub)}</td><td class="${on ? '' : 'off'}">${on ? 'Увімкнуто' : 'Вимкнуто'}</td><td>${on ? s.impact : 'Не вимірювався'}</td></tr>`; }).join('')}</tbody></table>`;
  }
  p_users() {
    const list = this.procs().filter(p => p.user === USER), cpu = list.reduce((a, p) => a + this.val(p).cpu, 0), mem = list.reduce((a, p) => a + this.val(p).mem, 0);
    return `<table class="tm-t"><thead><tr><th class="nm">Користувач</th><th>Стан</th><th class="num">ЦП</th><th class="num">Пам’ять</th></tr></thead><tbody>
      <tr class="grp" data-fold="user"><td class="nm">${ui(this.open.user ? 'down' : 'chevron', 12)}<span class="tm-av">У</span>${USER} (${list.length})</td><td></td><td class="num">${pct(cpu)}</td><td class="num">${mb(mem)}</td></tr>
      ${this.open.user ? list.map(p => `<tr><td class="nm sub">${esc(p.title)}</td><td></td><td class="num">${pct(this.val(p).cpu)}</td><td class="num">${mb(this.val(p).mem)}</td></tr>`).join('') : ''}</tbody></table>`;
  }
  p_details() {
    const rows = this.procs().flatMap(p => p.app ? p.wins.map(w => ({ ...p, key: p.key, pid: w.pid, name: w.exe || p.name, mem: p.mem / p.wins.length })) : [p]).filter(p => this.match(p.name, p.pid, p.desc || p.title));
    const s = this.sort; const v = (p, c) => c === 'pid' ? p.pid : c === 'name' ? p.name : c === 'cpu' ? this.val(p).cpu : c === 'mem' ? this.val(p).mem : p.user;
    rows.sort((a, b) => { const c = s.col && ['pid', 'name', 'cpu', 'mem', 'user'].includes(s.col) ? s.col : 'name'; const x = v(a, c), y = v(b, c); return (typeof x === 'string' ? x.localeCompare(y, 'uk') : x - y) * (s.col ? (s.asc ? 1 : -1) : 1); });
    const th = (k, t, cls = '') => `<th data-sort="${k}" class="${cls}${s.col === k ? ' sorted' : ''}">${t}</th>`;
    return `<table class="tm-t det"><thead><tr>${th('name', 'Ім’я', 'nm')}${th('pid', 'PID', 'num')}<th>Стан</th>${th('user', 'Ім’я користувача')}${th('cpu', 'ЦП', 'num')}${th('mem', 'Пам’ять', 'num')}<th>Опис</th></tr></thead><tbody>
      ${rows.map(p => `<tr data-key="${esc(p.key)}" class="${this.sel === p.key ? 'sel' : ''}"><td class="nm">${esc(p.name)}</td><td class="num">${p.pid}</td><td>Виконується</td><td>${esc(p.user || USER)}</td><td class="num">${String(Math.round(this.val(p).cpu)).padStart(2, '0')}</td><td class="num">${fmtNum(Math.round(this.val(p).mem / (p.wins?.length || 1)))} КБ</td><td>${esc(p.desc || p.title)}</td></tr>`).join('')}</tbody></table>`;
  }
  p_services() {
    const list = SERVICES.filter(s => this.match(s.name, s.title, s.pid));
    return `<table class="tm-t"><thead><tr><th class="nm">Ім’я</th><th class="num">PID</th><th>Опис</th><th>Стан</th><th>Група</th></tr></thead><tbody>${list.map(s => { const run = this.P.services[s.name];
      return `<tr data-svc="${s.name}" class="${this.sel === s.name ? 'sel' : ''}"><td class="nm"><span class="tm-ic">${ui('puzzle', 15)}</span>${s.name}</td><td class="num">${run ? s.pid || 3100 + s.name.length * 7 : ''}</td><td>${esc(s.title)}</td><td class="${run ? 'run' : 'off'}">${run ? 'Виконується' : 'Зупинено'}</td><td>${s.group}</td></tr>`; }).join('')}</tbody></table>`;
  }

  /* ── події ── */
  bind() {
    const b = this.win.body;
    b.addEventListener('click', e => {
      const pg = e.target.closest('[data-page]'); if (pg) { this.page = pg.dataset.page; this.sel = null; this.sort = { col: null, asc: false }; return this.render(); }
      const a = e.target.closest('[data-act]'); if (a && !a.disabled) return this.act(a.dataset.act);
      const f = e.target.closest('[data-fold]'); if (f) { this.open[f.dataset.fold] = !this.open[f.dataset.fold]; return this.refresh(); }
      const th = e.target.closest('th[data-sort]'); if (th) { const c = th.dataset.sort; this.sort = this.sort.col === c ? (this.sort.asc === (c === 'name') ? { col: c, asc: c !== 'name' } : { col: null, asc: false }) : { col: c, asc: c === 'name' }; return this.refresh(); }
      const pf = e.target.closest('[data-perf]'); if (pf) { this.perf = pf.dataset.perf; return this.refresh(true); }
      const r = e.target.closest('tr[data-key], tr[data-svc], tr[data-start]'); if (r) { this.sel = r.dataset.key || r.dataset.svc || r.dataset.start; this.$('.tm-c').querySelectorAll('tr.sel').forEach(x => x.classList.remove('sel')); r.classList.add('sel'); this.$('.tm-h').innerHTML = this.head(); return; }
    });
    b.addEventListener('dblclick', e => { const r = e.target.closest('tr[data-key]'); if (r?.dataset.key.startsWith('app:')) { const p = this.selected(); if (p?.wins) { WM.focus(p.wins[0]); } } });
    b.addEventListener('contextmenu', e => {
      const r = e.target.closest('tr[data-key], tr[data-svc], tr[data-start]'); if (!r) return; e.preventDefault();
      r.click();
      if (r.dataset.svc) { const run = this.P.services[r.dataset.svc]; return menu(e.clientX, e.clientY, [{ t: 'Запустити', icon: 'play', disabled: run, on: () => this.act('svcStart') }, { t: 'Зупинити', icon: 'stop', disabled: !run, on: () => this.act('svcStop') }, { t: 'Перезапустити', icon: 'refresh', disabled: !run, on: () => this.act('svcRestart') }]); }
      if (r.dataset.start) return menu(e.clientX, e.clientY, [{ t: (this.sys.fs.s.startup?.[r.dataset.start] ?? STARTUP.find(s => s.key === r.dataset.start).on) ? 'Вимкнути' : 'Увімкнути', icon: 'power', on: () => this.act('toggleStart') }]);
      const p = this.selected(); if (!p) return;
      menu(e.clientX, e.clientY, [p.wins && { t: 'Перейти', icon: 'open', on: () => WM.focus(p.wins[0]) }, { t: p.restart ? 'Перезапустити' : 'Зняти завдання', icon: 'ban', on: () => this.act('end') }, '-',
        { t: 'Пошук в Інтернеті', icon: 'search', on: () => this.sys.open('browser', `${p.name} що це`) }, { t: 'Властивості', icon: 'props', on: () => alertBox(`${p.name}\n\nPID: ${p.pid}\nКористувач: ${p.user || USER}\nОпис: ${p.desc || p.title}`, 'Властивості процесу', 'info') }]);
    });
    const inp = this.$('.tm-search input');
    inp.addEventListener('input', () => { this.q = inp.value.trim(); this.refresh(); });
    this.$('.tm-c').addEventListener('keydown', e => { if (e.key === 'Delete' && this.sel && ['proc', 'details'].includes(this.page)) { e.preventDefault(); this.act('end'); } });
  }
  async act(a) {
    const sys = this.sys;
    if (a === 'run') return this.runDialog();
    if (a === 'end') {
      const p = this.selected(); if (!p) return;
      if (p.wins) { p.wins.forEach(w => w.close(true)); this.sel = null; return setTimeout(() => this.refresh(), 60); }
      if (p.restart) { sys.restartExplorer(); return; }
      if (p.critical) {
        const ok = await dialog({ title: 'Диспетчер завдань', icon: 'warn', html: `<p><b>Завершити системний процес «${esc(p.title)}»?</b></p><p>Якщо завершити цей процес, Windows стане непридатною до використання або завершить роботу, і всі незбережені дані буде втрачено.</p>`, buttons: [{ t: 'Завершити роботу', v: true }, { t: 'Скасувати', v: false, primary: true, cancel: true }] });
        if (ok) sys.crash('CRITICAL_PROCESS_DIED');
        return;
      }
      this.P.killed.add(p.pid); this.sel = null;
      if (p.name === 'SecurityHealthSystray.exe') sys.trayShield?.(false);
      sys.toast(`Завдання «${p.title}» знято`);
      return this.refresh();
    }
    if (a === 'toggleStart') { const s = STARTUP.find(x => x.key === this.sel); if (!s) return; const st = sys.fs.s.startup ||= {}; st[s.key] = !(st[s.key] ?? s.on); sys.fs.emit('startup'); return this.render(); }
    const svc = this.selSvc(); if (!svc) return;
    if (a === 'svcStop' && svc.critical && !(await dialog({ title: 'Служби', icon: 'warn', text: `Служба «${svc.title}» потрібна Windows. Без неї частина функцій перестане працювати. Зупинити?`, buttons: [{ t: 'Зупинити', v: true }, { t: 'Скасувати', v: false, primary: true, cancel: true }] }))) return;
    if (a === 'svcStart') this.P.services[svc.name] = true;
    if (a === 'svcStop') this.P.services[svc.name] = false;
    if (a === 'svcRestart') { this.P.services[svc.name] = false; this.render(); await new Promise(r => setTimeout(r, 500)); this.P.services[svc.name] = true; }
    this.render();
  }
  runDialog() {
    modal({ title: 'Створити нове завдання', cls: 'small', html: `<div class="run-h">${ui('terminal', 26)}<p>Введіть ім’я програми, папки, документа або адресу сайту, і Windows відкриє їх.</p></div>
      <label class="fld">Відкрити: <input class="inp" data-run list="tmRunList" spellcheck="false" autofocus></label><datalist id="tmRunList">${['cmd', 'notepad', 'explorer', 'taskmgr', 'browser', 'wf.msc', 'firewall.cpl', 'ms-settings:'].map(x => `<option value="${x}">`).join('')}</datalist>
      <label class="chk"><input type="checkbox" data-adm> Створити це завдання з правами адміністратора</label>`,
      buttons: [{ t: 'OK', v: 'ok', primary: true }, { t: 'Скасувати', v: null, cancel: true }],
      onOpen: api => setTimeout(() => api.$('[data-run]').focus(), 30),
      onButton: (v, api) => {
        if (v !== 'ok') return;
        const t = api.$('[data-run]').value.trim(); if (!t) return false;
        if (!this.sys.run(t, api.$('[data-adm]').checked)) { alertBox(`Windows не вдається знайти «${t}». Переконайтеся, що ім’я введено правильно, а тоді повторіть спробу.`, t, 'error'); return false; }
      } });
  }
}
