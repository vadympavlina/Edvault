// Емулятор Windows · «Брандмауер Захисника Windows у режимі підвищеної безпеки» (wf.msc):
// дерево, таблиці правил, майстер створення правил, властивості правила й брандмауера, спостереження.
import { fwOf, defaults as fwDefaults, PROFILES, PROFILE_NAME, PROFILE_NET, NET, PROGRAMS, PROTOCOLS, PROTO_NUM, ICMP_TYPES, LOG_FILE, KEYWORDS, newId, validAddr, validPorts, profilesOf,
  actionText, profilesText, protoText, portsText, addrText, programText, edgeText, inboundText, outboundText, groupsOf } from './fw.js';
import { appIcon, ui } from './icons.js';
import { WM, dialog, alertBox, menu, esc, modal, tabs } from './ui.js';
import { HOME } from './fs.js';

const DOCS = HOME + '\\Documents';
const TITLE = 'Брандмауер Захисника Windows у режимі підвищеної безпеки';
const NODES = [
  { k: 'root', t: 'Брандмауер Захисника Windows', short: TITLE, ic: 'firewall', lvl: 0 },
  { k: 'in', t: 'Правила для вхідних підключень', ic: 'in', lvl: 1 },
  { k: 'out', t: 'Правила для вихідних підключень', ic: 'out', lvl: 1 },
  { k: 'csr', t: 'Правила безпеки підключень', ic: 'csr', lvl: 1 },
  { k: 'mon', t: 'Спостереження', ic: 'mon', lvl: 1, kids: true },
  { k: 'monfw', t: 'Брандмауер', ic: 'firewall', lvl: 2, parent: 'mon' },
  { k: 'moncsr', t: 'Правила безпеки підключень', ic: 'csr', lvl: 2, parent: 'mon' },
  { k: 'monsa', t: 'Зіставлення безпеки', ic: 'key', lvl: 2, parent: 'mon', kids: true },
  { k: 'monmain', t: 'Основний режим', ic: 'key', lvl: 3, parent: 'monsa' },
  { k: 'monquick', t: 'Швидкий режим', ic: 'key', lvl: 3, parent: 'monsa' },
];
const node = k => NODES.find(n => n.k === k);
// маленькі кольорові значки для дерева й таблиць
const sv = (s, b) => `<svg class="mi" width="${s}" height="${s}" viewBox="0 0 16 16" aria-hidden="true">${b}</svg>`;
const WALL = '<rect x="1" y="3" width="14" height="10" rx="1" fill="#d9603b"/><path d="M1 6.3h14M1 9.7h14M5 3v3.3M11 3v3.3M8 6.3v3.4M4 9.7V13M12 9.7V13" stroke="#fbe3d8" stroke-width=".9"/>';
const TI = {
  firewall: sv(16, WALL),
  in: sv(16, `${WALL}<circle cx="11.5" cy="11.5" r="4" fill="#fff"/><path d="M9 11.5h5M11.5 9l-2.5 2.5 2.5 2.5" stroke="#0078d4" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  out: sv(16, `${WALL}<circle cx="11.5" cy="11.5" r="4" fill="#fff"/><path d="M9 11.5h5M11.5 9l2.5 2.5-2.5 2.5" stroke="#0078d4" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  csr: sv(16, '<rect x="1.5" y="4" width="5" height="4" rx=".6" fill="#2b88d8"/><rect x="9.5" y="4" width="5" height="4" rx=".6" fill="#2b88d8"/><path d="M6.5 6h3" stroke="#555" stroke-width="1.2"/><rect x="5.5" y="9" width="5" height="5.5" rx="1" fill="#e8b10d"/><path d="M6.8 9V7.6a1.2 1.2 0 0 1 2.4 0V9" stroke="#8a6a00" fill="none"/>'),
  mon: sv(16, '<rect x="1" y="2" width="14" height="10" rx="1" fill="#2b88d8"/><rect x="2.2" y="3.2" width="11.6" height="7.6" fill="#e6f2fb"/><path d="M3 9l2.5-3 2 2 3-4 2.5 3" stroke="#0a7a1f" stroke-width="1.2" fill="none"/><path d="M6 15h4" stroke="#666" stroke-width="1.5"/>'),
  key: sv(16, '<circle cx="5" cy="8" r="3.2" fill="none" stroke="#c19c00" stroke-width="1.8"/><path d="M8 8h7M12.5 8v3M14.5 8v2" stroke="#c19c00" stroke-width="1.8"/>'),
  allow: sv(14, '<circle cx="8" cy="8" r="7" fill="#13a10e"/><path d="M4.5 8.2l2.3 2.3 4.6-4.8" stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  block: sv(14, '<circle cx="8" cy="8" r="7" fill="#d13438"/><path d="M4.5 4.5l7 7" stroke="#fff" stroke-width="1.8"/><circle cx="8" cy="8" r="4.6" fill="none" stroke="#fff" stroke-width="1.6"/>'),
  secure: sv(14, '<circle cx="8" cy="8" r="7" fill="#13a10e"/><rect x="5" y="7.3" width="6" height="4.4" rx=".8" fill="#fff"/><path d="M6.3 7.3V6a1.7 1.7 0 0 1 3.4 0v1.3" stroke="#fff" fill="none" stroke-width="1.3"/>'),
  off: sv(14, '<circle cx="8" cy="8" r="6.3" fill="#f3f3f3" stroke="#a0a0a0"/>'),
};
const COLS = [
  ['name', 'Ім’я', 430], ['group', 'Група', 250], ['profile', 'Профіль', 200], ['enabled', 'Увімкнено', 82], ['action', 'Дія', 92], ['override', 'Перевизначити', 104],
  ['program', 'Програма', 220], ['local', 'Локальна адреса', 120], ['remote', 'Віддалена адреса', 128], ['protocol', 'Протокол', 82], ['lport', 'Локальний порт', 112], ['rport', 'Віддалений порт', 118],
];
const cell = (r, k) => ({ name: r.name.trim(), group: r.group || '', profile: profilesText(r), enabled: r.enabled ? 'Так' : 'Ні', action: actionText(r.action), override: 'Ні', program: programText(r.program), local: addrText(r.localAddr), remote: addrText(r.remoteAddr), protocol: protoText(r.protocol), lport: portsText(r.localPorts), rport: portsText(r.remotePorts) }[k]);
const SERVICES = [['Dhcp', 'DHCP-клієнт'], ['Dnscache', 'DNS-клієнт'], ['TermService', 'Служби віддаленого робочого стола'], ['Spooler', 'Диспетчер черги друку'], ['LanmanServer', 'Сервер'], ['W32Time', 'Служба часу Windows']];
const IFACES = [['all', 'Усі типи інтерфейсів'], ['lan', 'Локальна мережа'], ['wireless', 'Бездротова мережа'], ['ras', 'Віддалений доступ']];
const clone = o => JSON.parse(JSON.stringify(o));
const isPort = p => p === 'TCP' || p === 'UDP';
const isIcmp = p => p === 'ICMPv4' || p === 'ICMPv6';

export class Wfmsc {
  constructor(sys) {
    this.sys = sys; this.fs = sys.fs;
    this.node = 'root'; this.hist = []; this.fwd = []; this.open = { mon: false, monsa: false };
    this.sel = new Set(); this.anchor = null; this.sort = { in: null, out: null }; this.filter = { in: {}, out: {} }; this.clip = null;
    this.win = WM.open({ app: 'wfmsc', exe: 'mmc.exe', title: TITLE, icon: appIcon('firewall', 16), w: 1320, h: 690, minW: 760, minH: 420 });
    this.win.body.innerHTML = `<div class="mmc" tabindex="-1">
      <div class="mmc-menu">${['Файл', 'Дія', 'Вигляд', 'Довідка'].map(t => `<button data-menu="${t}">${t}</button>`).join('')}</div>
      <div class="mmc-tools"><button class="nb" data-nav="back" title="Назад">${ui('back', 15)}</button><button class="nb" data-nav="fwd" title="Вперед">${ui('forward', 15)}</button><button class="nb" data-nav="up" title="На рівень вище">${ui('up', 15)}</button><i class="sep"></i><button class="nb" data-nav="tree" title="Показати або сховати дерево консолі">${ui('tree', 15)}</button><button class="nb" data-nav="refresh" title="Оновити">${ui('refresh', 15)}</button><button class="nb" data-nav="export" title="Експортувати список">${ui('exportI', 15)}</button><i class="sep"></i><button class="nb" data-nav="props" title="Властивості">${ui('props', 15)}</button><button class="nb" data-nav="help" title="Довідка">${ui('question', 15)}</button><button class="nb" data-nav="actions" title="Показати або сховати область дій">${ui('panel', 15)}</button></div>
      <div class="mmc-main"><nav class="mmc-tree" role="tree"></nav><section class="mmc-center"><header class="mmc-ch"></header><div class="mmc-cb"></div></section><aside class="mmc-act"></aside></div>
      <footer class="mmc-status"></footer></div>`;
    this.$ = s => this.win.body.querySelector(s); this.$$ = s => [...this.win.body.querySelectorAll(s)];
    this.bind();
    this.unsub = this.fs.on(w => { if (['fw', 'reset'].includes(w)) { this.prune(); this.render(); } else if (w === 'fwlog' && this.node === 'mon') this.renderCenter(); });
    const close = this.win.close; this.win.close = f => { this.unsub(); return close(f); };
    this.render();
  }
  get fw() { return fwOf(this.fs); }
  get isRules() { return this.node === 'in' || this.node === 'out'; }
  prune() { const ids = new Set(this.fw.rules.map(r => r.id).concat(this.fw.csr.map(r => r.id))); for (const id of [...this.sel]) if (!ids.has(id)) this.sel.delete(id); }
  go(k, push = true) {
    if (k === this.node) return;
    if (push) { this.hist.push(this.node); this.fwd = []; }
    this.node = k; this.sel.clear();
    for (let n = node(k); n?.parent; n = node(n.parent)) this.open[n.parent] = true;
    this.render();
  }
  rows() {
    const dir = this.node, f = this.filter[dir], s = this.sort[dir];
    let list = this.fw.rules.filter(r => r.dir === dir);
    if (f.profile) list = list.filter(r => profilesOf(r).includes(f.profile));
    if (f.state) list = list.filter(r => r.enabled === (f.state === 'on'));
    if (f.group) list = list.filter(r => (r.group || '') === (f.group === '-' ? '' : f.group));
    const byName = (a, b) => a.name.localeCompare(b.name, 'uk');
    list.sort(byName);
    if (s) list.sort((a, b) => (String(cell(a, s.col)).localeCompare(String(cell(b, s.col)), 'uk', { numeric: true }) || byName(a, b)) * (s.asc ? 1 : -1));
    return list;
  }
  selRules() { return this.fw.rules.filter(r => this.sel.has(r.id)); }

  /* ── відмальовування ── */
  render() {
    if (!this.win.el.isConnected) return;
    this.renderTree(); this.renderCenter(); this.renderActions();
    this.$('[data-nav="back"]').disabled = !this.hist.length;
    this.$('[data-nav="fwd"]').disabled = !this.fwd.length;
    this.$('[data-nav="up"]').disabled = this.node === 'root';
    this.$('[data-nav="export"]').disabled = !this.isRules && this.node !== 'csr';
    this.$('[data-nav="props"]').disabled = !(this.isRules && this.sel.size === 1) && this.node !== 'root';
  }
  renderTree() {
    const vis = NODES.filter(n => { for (let p = n.parent; p; p = node(p).parent) if (!this.open[p]) return false; return true; });
    this.$('.mmc-tree').innerHTML = vis.map(n => `<div class="tn${n.k === this.node ? ' on' : ''}" data-node="${n.k}" style="--l:${n.lvl}" role="treeitem">${n.kids ? `<button class="tw" data-twist="${n.k}">${ui(this.open[n.k] ? 'down' : 'chevron', 11)}</button>` : '<i class="tw"></i>'}${TI[n.ic]}<span title="${esc(n.k === 'root' ? n.short + ' на локальному комп’ютері' : n.t)}">${esc(n.t)}</span></div>`).join('');
  }
  renderCenter() {
    const fw = this.fw, k = this.node, n = node(k);
    this.$('.mmc-ch').innerHTML = `${TI[n.ic]}<b>${esc(n.k === 'root' ? 'Брандмауер Захисника Windows у режимі підвищеної безпеки на локальному комп’ютері' : n.t)}</b>`;
    const cb = this.$('.mmc-cb'), old = cb.querySelector('.tbl-wrap'), keep = this.drawn === k && old ? [old.scrollTop, old.scrollLeft, cb.scrollTop] : null;
    this.drawn = k;
    cb.className = 'mmc-cb' + (this.isRules || k === 'csr' || k === 'monfw' ? ' tbl' : '');
    let status = '';
    if (k === 'root') {
      cb.innerHTML = `<div class="ov"><section class="ov-box"><h3>Огляд</h3>${['domain', 'private', 'public'].map(p => { const c = fw.profiles[p];
        return `<h4>${PROFILE_NAME[p] === 'Домен' ? 'Профіль домену' : PROFILE_NAME[p] === 'Приватний' ? 'Приватний профіль' : 'Загальнодоступний профіль'}${p === NET.profile ? ' <span class="act">активний</span>' : ''}</h4>
        <ul>${c.on ? `<li>${TI.allow}Брандмауер Захисника Windows увімкнено.</li><li>${c.inbound === 'allow' ? TI.allow : TI.block}${c.inbound === 'blockall' ? 'Усі вхідні підключення блокуються, навіть дозволені правилами.' : c.inbound === 'allow' ? 'Вхідні підключення, що не відповідають правилу, дозволено.' : 'Вхідні підключення, що не відповідають правилу, заблоковано.'}</li><li>${c.outbound === 'allow' ? TI.allow : TI.block}Вихідні підключення, що не відповідають правилу, ${c.outbound === 'allow' ? 'дозволено' : 'заблоковано'}.</li>` : `<li>${TI.block}Брандмауер Захисника Windows вимкнено.</li>`}</ul>`; }).join('')}
        <button class="link" data-do="fwprops">Властивості брандмауера Захисника Windows</button></section>
        <section class="ov-box"><h3>Початок роботи</h3><h4>Перегляд і створення правил брандмауера</h4><p>Правила дозволяють або блокують підключення конкретних програм чи портів. <b>Вхідні</b> — коли хтось підключається до цього комп’ютера, <b>вихідні</b> — коли цей комп’ютер підключається до когось.</p>
        <button class="link" data-node="in">Правила для вхідних підключень</button><button class="link" data-node="out">Правила для вихідних підключень</button>
        <h4>Захист підключень між комп’ютерами</h4><p>Правила безпеки підключень вимагають, щоб комп’ютери перевіряли один одного (автентифікація) перед обміном даними.</p><button class="link" data-node="csr">Правила безпеки підключень</button>
        <h4>Перегляд поточних політик і активності</h4><p>Які правила зараз діють і які підключення брандмауер нещодавно пропустив або заблокував.</p><button class="link" data-node="mon">Спостереження</button></section></div>`;
    } else if (this.isRules) {
      const rows = this.rows(), s = this.sort[k], f = this.filter[k];
      const chips = [f.profile && `Фільтр профілю: ${PROFILE_NAME[f.profile]}`, f.state && `Фільтр стану: ${f.state === 'on' ? 'увімкнені' : 'вимкнені'}`, f.group && `Фільтр групи: ${f.group === '-' ? 'без групи' : f.group}`].filter(Boolean);
      cb.innerHTML = `${chips.length ? `<div class="mmc-filter">${ui('filter', 14)}<span>${esc(chips.join(' · '))}</span><button class="link" data-do="clearfilter">Очистити всі фільтри</button></div>` : ''}
        <div class="tbl-wrap"><table class="rules auto"><thead><tr>${COLS.map(([c, t]) => `<th data-sort="${c}">${t}${s?.col === c ? ui(s.asc ? 'up' : 'down', 11) : ''}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr data-rule="${r.id}" class="${this.sel.has(r.id) ? 'sel' : ''}${r.enabled ? '' : ' dis'}">${COLS.map(([c]) => `<td title="${esc(cell(r, c))}">${c === 'name' ? (r.enabled ? TI[r.action] : TI.off) : ''}${esc(cell(r, c))}</td>`).join('')}</tr>`).join('')}</tbody></table>
        ${rows.length ? '' : '<p class="mmc-empty">Немає елементів для показу в цьому поданні.</p>'}</div>`;
      status = `Правил: ${rows.length}${this.sel.size ? ` · виділено: ${this.sel.size}` : ''}`;
    } else if (k === 'csr') {
      cb.innerHTML = `<div class="tbl-wrap"><table class="rules"><thead><tr><th>Ім’я</th><th>Увімкнено</th><th>Кінцева точка 1</th><th>Кінцева точка 2</th><th>Режим автентифікації</th><th>Профіль</th></tr></thead><tbody>
        ${fw.csr.map(r => `<tr data-csr="${r.id}" class="${this.sel.has(r.id) ? 'sel' : ''}${r.enabled ? '' : ' dis'}"><td>${r.enabled ? TI.secure : TI.off}${esc(r.name)}</td><td>${r.enabled ? 'Так' : 'Ні'}</td><td>${esc(addrText(r.ep1))}</td><td>${esc(addrText(r.ep2))}</td><td>${esc(CSR_REQ[r.req])}</td><td>${esc(profilesText(r))}</td></tr>`).join('')}</tbody></table>
        ${fw.csr.length ? '' : '<p class="mmc-empty">Немає елементів для показу в цьому поданні. Створіть правило через «Створити правило…» в області дій.</p>'}</div>`;
      status = `Правил: ${fw.csr.length}`;
    } else if (k === 'mon') {
      const p = fw.profiles[NET.profile], lg = p.log, ev = fw.events.slice(0, 14);
      cb.innerHTML = `<div class="ov"><section class="ov-box"><h3>Стан брандмауера</h3><p>Активний профіль: <b>${PROFILE_NAME[NET.profile]}</b> (мережа ${NET.name}).</p>
        <ul><li>${p.on ? TI.allow : TI.block}Брандмауер Захисника Windows ${p.on ? 'увімкнено' : 'вимкнено'}.</li><li>${p.inbound === 'allow' ? TI.allow : TI.block}Вхідні без правила: ${esc(inboundText(p.inbound).toLowerCase())}.</li><li>${p.outbound === 'allow' ? TI.allow : TI.block}Вихідні без правила: ${esc(outboundText(p.outbound).toLowerCase())}.</li><li>${p.notify ? TI.allow : TI.off}Сповіщення про заблоковані програми ${p.notify ? 'увімкнено' : 'вимкнено'}.</li></ul>
        <h4>Параметри журналу</h4><table class="kv"><tr><th>Ім’я файлу:</th><td><button class="link" data-do="openlog">${esc(lg.path)}</button></td></tr><tr><th>Розмір (КБ):</th><td>${lg.size}</td></tr><tr><th>Записувати пропущені пакети:</th><td>${lg.dropped ? 'Так' : 'Ні'}</td></tr><tr><th>Записувати успішні підключення:</th><td>${lg.success ? 'Так' : 'Ні'}</td></tr></table>
        <button class="link" data-do="logsettings">Змінити параметри журналу…</button></section>
        <section class="ov-box"><h3>Останні підключення</h3>${ev.length ? `<table class="ev"><thead><tr><th>Час</th><th>Напрямок</th><th>Протокол</th><th>Адреса</th><th>Результат</th></tr></thead><tbody>${ev.map(e => `<tr title="${esc(e.rule ? 'Правило: ' + e.rule.trim() : e.why === 'default' ? 'Жодне правило не підійшло — спрацювала дія за замовчуванням' : e.why === 'off' ? 'Брандмауер вимкнено' : 'Блокувати всі вхідні підключення')}"><td>${new Date(e.at).toLocaleTimeString('uk-UA')}</td><td>${e.dir === 'in' ? 'Вхідне' : 'Вихідне'}</td><td>${esc(e.protocol)}${e.remotePort || e.localPort ? ' ' + (e.dir === 'in' ? e.localPort : e.remotePort) : ''}</td><td>${esc(e.remoteIp)}</td><td class="${e.allow ? 'ok' : 'bad'}">${e.allow ? TI.allow : TI.block}${e.allow ? 'Дозволено' : 'Заблоковано'}</td></tr>`).join('')}</tbody></table>
          <p class="muted">Наведіть на рядок, щоб побачити, яке правило спрацювало. Нові підключення з’являються, коли ви користуєтеся <code>ping</code> і <code>curl</code> у консолі, а також коли інші комп’ютери мережі намагаються підключитися.</p>` : '<p class="muted">Ще немає підключень. Виконайте в Командному рядку, наприклад, <code>ping google.com</code>.</p>'}</section></div>`;
    } else if (k === 'monfw') {
      const act = fw.rules.filter(r => r.enabled && profilesOf(r).includes(NET.profile)).sort((a, b) => a.name.localeCompare(b.name, 'uk'));
      cb.innerHTML = `<div class="tbl-wrap"><table class="rules"><thead><tr><th>Ім’я</th><th>Напрямок</th><th>Дія</th><th>Профіль</th><th>Протокол</th><th>Локальний порт</th><th>Віддалений порт</th><th>Програма</th></tr></thead><tbody>
        ${act.map(r => `<tr><td>${TI[r.action]}${esc(r.name.trim())}</td><td>${r.dir === 'in' ? 'Вхідні' : 'Вихідні'}</td><td>${actionText(r.action)}</td><td>${esc(profilesText(r))}</td><td>${esc(protoText(r.protocol))}</td><td>${esc(portsText(r.localPorts))}</td><td>${esc(portsText(r.remotePorts))}</td><td>${esc(programText(r.program))}</td></tr>`).join('')}</tbody></table></div>`;
      status = `Активних правил у профілі «${PROFILE_NAME[NET.profile]}»: ${act.length}`;
    } else if (k === 'moncsr') {
      const act = fw.csr.filter(r => r.enabled);
      cb.innerHTML = act.length ? `<div class="tbl-wrap"><table class="rules"><thead><tr><th>Ім’я</th><th>Кінцева точка 1</th><th>Кінцева точка 2</th><th>Режим автентифікації</th></tr></thead><tbody>${act.map(r => `<tr><td>${TI.secure}${esc(r.name)}</td><td>${esc(addrText(r.ep1))}</td><td>${esc(addrText(r.ep2))}</td><td>${esc(CSR_REQ[r.req])}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mmc-empty">Немає елементів для показу в цьому поданні.</p>';
    } else if (k === 'monsa') {
      cb.innerHTML = '<div class="ov"><section class="ov-box"><h3>Зіставлення безпеки</h3><p>Коли два комп’ютери за правилом безпеки підключення перевіряють один одного, вони домовляються про ключі шифрування. Ця домовленість і є «зіставленням безпеки».</p><p><b>Основний режим</b> — перевірка особи комп’ютерів. <b>Швидкий режим</b> — ключі для захисту самих даних.</p></section></div>';
    } else {
      cb.innerHTML = `<p class="mmc-empty">Немає елементів для показу в цьому поданні.${fw.csr.some(r => r.enabled) ? ' Зіставлення з’являються, лише коли інший комп’ютер справді встановлює захищене підключення.' : ''}</p>`;
    }
    this.$('.mmc-status').textContent = status;
    const nw = cb.querySelector('.tbl-wrap');
    if (keep) { if (nw) { nw.scrollTop = keep[0]; nw.scrollLeft = keep[1]; } cb.scrollTop = keep[2]; }
  }
  renderActions() {
    const k = this.node, n = node(k), one = this.sel.size === 1 ? this.selRules()[0] : null, many = this.sel.size;
    const it = (act, ic, t, dis) => `<button class="ma${dis ? ' off' : ''}" data-do="${act}" ${dis ? 'disabled' : ''}>${ic ? (ic.startsWith('<') ? ic : ui(ic, 15)) : '<i class="mi-s"></i>'}<span>${t}</span></button>`;
    const sec = (t, body) => `<div class="ma-sec"><h5>${esc(t)}${ui('down', 11)}</h5>${body}</div>`;
    let html = '';
    if (k === 'root') html = sec('Брандмауер Захисника Windows у режимі підвищеної безпеки', it('importpol', 'importI', 'Імпортувати політику…') + it('exportpol', 'exportI', 'Експортувати політику…') + it('restore', 'restore', 'Відновити стандартну політику') + it('diag', 'question', 'Діагностика / відновлення') + '<i class="ma-sep"></i>' + it('refresh', 'refresh', 'Оновити') + it('fwprops', 'props', 'Властивості') + it('help', 'question', 'Довідка'));
    else if (this.isRules) {
      const f = this.filter[k];
      html = sec(n.t, it('newrule', TI[k], 'Створити правило…') + '<i class="ma-sep"></i>' + it('fprofile', 'filter', 'Фільтрувати за профілем' + (f.profile ? ` (${PROFILE_NAME[f.profile]})` : '')) + it('fstate', 'filter', 'Фільтрувати за станом' + (f.state ? ` (${f.state === 'on' ? 'увімкнені' : 'вимкнені'})` : '')) + it('fgroup', 'filter', 'Фільтрувати за групою' + (f.group ? ' (є)' : '')) + it('clearfilter', '', 'Очистити всі фільтри', !(f.profile || f.state || f.group)) + '<i class="ma-sep"></i>' + it('paste', 'paste', 'Вставити', !this.clip) + it('refresh', 'refresh', 'Оновити') + it('exportlist', 'exportI', 'Експортувати список…') + it('help', 'question', 'Довідка'));
      if (many) {
        const rs = this.selRules(), allOn = rs.every(r => r.enabled), allOff = rs.every(r => !r.enabled);
        html += sec(one ? one.name.trim() : `Виділено правил: ${many}`, (allOn ? '' : it('enable', TI.allow, 'Увімкнути правило')) + (allOff ? '' : it('disable', TI.off, 'Вимкнути правило')) + '<i class="ma-sep"></i>' + it('cut', 'cut', 'Вирізати') + it('copy', 'copy', 'Копіювати') + it('delete', 'trash', 'Видалити') + '<i class="ma-sep"></i>' + (one ? it('props', 'props', 'Властивості') : '') + it('help', 'question', 'Довідка'));
      }
    } else if (k === 'csr') {
      html = sec(n.t, it('newcsr', TI.csr, 'Створити правило…') + it('refresh', 'refresh', 'Оновити') + it('exportlist', 'exportI', 'Експортувати список…') + it('help', 'question', 'Довідка'));
      const r = this.fw.csr.find(x => this.sel.has(x.id));
      if (r) html += sec(r.name, it(r.enabled ? 'csroff' : 'csron', r.enabled ? TI.off : TI.secure, r.enabled ? 'Вимкнути правило' : 'Увімкнути правило') + it('csrdel', 'trash', 'Видалити') + it('csrprops', 'props', 'Властивості'));
    } else if (k === 'mon') html = sec(n.t, it('openlog', 'open', 'Відкрити файл журналу') + it('logsettings', 'props', 'Параметри журналу…') + it('refresh', 'refresh', 'Оновити') + it('help', 'question', 'Довідка'));
    else html = sec(n.t, it('refresh', 'refresh', 'Оновити') + it('help', 'question', 'Довідка'));
    this.$('.mmc-act').innerHTML = `<h4>Дії</h4>${html}`;
  }

  /* ── події ── */
  bind() {
    const b = this.win.body;
    b.addEventListener('click', e => {
      const tw = e.target.closest('[data-twist]'); if (tw) { this.open[tw.dataset.twist] = !this.open[tw.dataset.twist]; return this.renderTree(); }
      const nd = e.target.closest('[data-node]'); if (nd) return this.go(nd.dataset.node);
      const nv = e.target.closest('[data-nav]'); if (nv) return this.nav(nv.dataset.nav);
      const m = e.target.closest('[data-menu]'); if (m) return this.menuBar(m);
      const d = e.target.closest('[data-do]'); if (d && !d.disabled) { this.$('.mmc').focus({ preventScroll: true }); return this.act(d.dataset.do, d); }
      const th = e.target.closest('[data-sort]');
      if (th) { const s = this.sort[this.node]; this.sort[this.node] = s?.col === th.dataset.sort ? (s.asc ? { col: s.col, asc: false } : null) : { col: th.dataset.sort, asc: true }; return this.renderCenter(); }
      const row = e.target.closest('[data-rule], [data-csr]');
      if (row) return this.pick(row.dataset.rule || row.dataset.csr, e);
      if (e.target.closest('.tbl-wrap') && !e.target.closest('tr')) { this.sel.clear(); this.paintSel(); }
    });
    b.addEventListener('dblclick', e => {
      const row = e.target.closest('[data-rule]'); if (row) return this.props(this.fw.rules.find(r => r.id === row.dataset.rule));
      const c = e.target.closest('[data-csr]'); if (c) return this.csrProps(this.fw.csr.find(r => r.id === c.dataset.csr));
      const nd = e.target.closest('.tn[data-node]'); if (nd && node(nd.dataset.node).kids) { this.open[nd.dataset.node] = !this.open[nd.dataset.node]; this.renderTree(); }
    });
    b.addEventListener('contextmenu', e => {
      const row = e.target.closest('[data-rule]');
      if (row) { e.preventDefault(); if (!this.sel.has(row.dataset.rule)) this.pick(row.dataset.rule, {}); return this.ruleMenu(e.clientX, e.clientY); }
      const nd = e.target.closest('.tn[data-node]');
      if (nd) { e.preventDefault(); this.go(nd.dataset.node); const k = nd.dataset.node;
        const items = k === 'in' || k === 'out' ? [{ t: 'Створити правило…', icon: TI[k], on: () => this.wizard(k) }, '-', { t: 'Фільтрувати за профілем', sub: this.profileFilterItems() }, { t: 'Фільтрувати за станом', sub: this.stateFilterItems() }, { t: 'Очистити всі фільтри', on: () => this.act('clearfilter') }, '-', { t: 'Оновити', icon: 'refresh', on: () => this.act('refresh') }, { t: 'Експортувати список…', icon: 'exportI', on: () => this.act('exportlist') }]
          : k === 'root' ? [{ t: 'Імпортувати політику…', icon: 'importI', on: () => this.act('importpol') }, { t: 'Експортувати політику…', icon: 'exportI', on: () => this.act('exportpol') }, { t: 'Відновити стандартну політику', icon: 'restore', on: () => this.act('restore') }, '-', { t: 'Властивості', icon: 'props', on: () => this.fwProps() }]
          : k === 'csr' ? [{ t: 'Створити правило…', icon: TI.csr, on: () => this.csrWizard() }, { t: 'Оновити', icon: 'refresh', on: () => this.act('refresh') }] : [{ t: 'Оновити', icon: 'refresh', on: () => this.act('refresh') }];
        return menu(e.clientX, e.clientY, items); }
    });
    this.$('.mmc').addEventListener('keydown', e => {
      if (e.target.closest('input, textarea, select')) return;
      if (e.key === 'Delete' && this.isRules && this.sel.size) { e.preventDefault(); this.act('delete'); }
      else if (e.key === 'Enter' && this.isRules && this.sel.size === 1) { e.preventDefault(); this.act('props'); }
      else if (e.key === 'F5') { e.preventDefault(); this.act('refresh'); }
      else if (e.ctrlKey && e.code === 'KeyA' && this.isRules) { e.preventDefault(); this.rows().forEach(r => this.sel.add(r.id)); this.render(); }
      else if (e.ctrlKey && e.code === 'KeyC' && this.sel.size) { e.preventDefault(); this.act('copy'); }
      else if (e.ctrlKey && e.code === 'KeyX' && this.sel.size) { e.preventDefault(); this.act('cut'); }
      else if (e.ctrlKey && e.code === 'KeyV' && this.clip) { e.preventDefault(); this.act('paste'); }
      else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && this.isRules) {
        e.preventDefault(); const rows = this.rows(); if (!rows.length) return;
        const cur = rows.findIndex(r => r.id === this.anchor); const i = Math.max(0, Math.min(rows.length - 1, cur + (e.key === 'ArrowDown' ? 1 : -1)));
        this.sel = new Set([rows[i].id]); this.anchor = rows[i].id; this.render(); this.$(`[data-rule="${rows[i].id}"]`)?.scrollIntoView({ block: 'nearest' });
      }
    });
  }
  pick(id, e) {
    if (e.ctrlKey) { this.sel.has(id) ? this.sel.delete(id) : this.sel.add(id); this.anchor = id; }
    else if (e.shiftKey && this.anchor && this.isRules) { const ids = this.rows().map(r => r.id), a = ids.indexOf(this.anchor), b = ids.indexOf(id); this.sel = new Set(ids.slice(Math.min(a, b), Math.max(a, b) + 1)); }
    else { this.sel = new Set([id]); this.anchor = id; }
    this.paintSel(); this.$('.mmc').focus({ preventScroll: true });
  }
  // лише виділення — без перемальовування таблиці (інакше зривається подвійне клацання)
  paintSel() {
    this.$$('.mmc-cb tr[data-rule], .mmc-cb tr[data-csr]').forEach(tr => tr.classList.toggle('sel', this.sel.has(tr.dataset.rule || tr.dataset.csr)));
    this.renderActions();
    if (this.isRules) this.$('.mmc-status').textContent = `Правил: ${this.rows().length}${this.sel.size ? ` · виділено: ${this.sel.size}` : ''}`;
    this.$('[data-nav="props"]').disabled = !(this.isRules && this.sel.size === 1) && this.node !== 'root';
  }
  nav(k) {
    if (k === 'back' && this.hist.length) { this.fwd.push(this.node); this.go(this.hist.pop(), false); }
    else if (k === 'fwd' && this.fwd.length) { this.hist.push(this.node); this.go(this.fwd.pop(), false); }
    else if (k === 'up') this.go(node(this.node).parent || 'root');
    else if (k === 'tree') this.$('.mmc').classList.toggle('no-tree');
    else if (k === 'actions') this.$('.mmc').classList.toggle('no-act');
    else this.act({ refresh: 'refresh', export: this.node === 'csr' || this.isRules ? 'exportlist' : '', props: this.node === 'root' ? 'fwprops' : 'props', help: 'help' }[k]);
  }
  menuBar(btn) {
    const k = this.node, R = this.isRules;
    const items = {
      'Файл': [{ t: 'Імпортувати політику…', icon: 'importI', on: () => this.act('importpol') }, { t: 'Експортувати політику…', icon: 'exportI', on: () => this.act('exportpol') }, '-', { t: 'Вихід', icon: 'close', on: () => this.win.close() }],
      'Дія': R ? [{ t: 'Створити правило…', icon: TI[k], on: () => this.wizard(k) }, '-', { t: 'Увімкнути правило', disabled: !this.sel.size, on: () => this.act('enable') }, { t: 'Вимкнути правило', disabled: !this.sel.size, on: () => this.act('disable') }, { t: 'Видалити', icon: 'trash', disabled: !this.sel.size, on: () => this.act('delete') }, '-', { t: 'Властивості', icon: 'props', disabled: this.sel.size !== 1, on: () => this.act('props') }, { t: 'Оновити', icon: 'refresh', on: () => this.act('refresh') }]
        : k === 'csr' ? [{ t: 'Створити правило…', icon: TI.csr, on: () => this.csrWizard() }, { t: 'Оновити', icon: 'refresh', on: () => this.act('refresh') }]
        : [{ t: 'Властивості', icon: 'props', on: () => this.fwProps() }, { t: 'Відновити стандартну політику', icon: 'restore', on: () => this.act('restore') }, { t: 'Оновити', icon: 'refresh', on: () => this.act('refresh') }],
      'Вигляд': [{ t: 'Дерево консолі', check: !this.$('.mmc').classList.contains('no-tree'), on: () => this.nav('tree') }, { t: 'Область дій', check: !this.$('.mmc').classList.contains('no-act'), on: () => this.nav('actions') }, '-', { t: 'Фільтрувати за профілем', disabled: !R, sub: R ? this.profileFilterItems() : [] }, { t: 'Фільтрувати за станом', disabled: !R, sub: R ? this.stateFilterItems() : [] }],
      'Довідка': [{ t: 'Як працює брандмауер', icon: 'question', on: () => this.act('help') }],
    }[btn.dataset.menu];
    menu(0, 0, items, { anchor: btn });
  }
  profileFilterItems() { const f = this.filter[this.node]; return PROFILES.map(p => ({ t: `Фільтрувати за профілем «${PROFILE_NAME[p]}»`, check: f.profile === p, on: () => { f.profile = f.profile === p ? null : p; this.sel.clear(); this.render(); } })); }
  stateFilterItems() { const f = this.filter[this.node]; return [['on', 'Фільтрувати за станом «Увімкнено»'], ['off', 'Фільтрувати за станом «Вимкнено»']].map(([v, t]) => ({ t, check: f.state === v, on: () => { f.state = f.state === v ? null : v; this.sel.clear(); this.render(); } })); }
  ruleMenu(x, y) {
    const rs = this.selRules(), one = rs.length === 1;
    menu(x, y, [rs.some(r => !r.enabled) && { t: 'Увімкнути правило', icon: TI.allow, on: () => this.act('enable') }, rs.some(r => r.enabled) && { t: 'Вимкнути правило', icon: TI.off, on: () => this.act('disable') }, '-',
      { t: 'Вирізати', icon: 'cut', kbd: 'Ctrl+X', on: () => this.act('cut') }, { t: 'Копіювати', icon: 'copy', kbd: 'Ctrl+C', on: () => this.act('copy') }, { t: 'Видалити', icon: 'trash', kbd: 'Delete', on: () => this.act('delete') }, '-',
      { t: 'Властивості', icon: 'props', disabled: !one, on: () => this.act('props') }, { t: 'Довідка', icon: 'question', on: () => this.act('help') }]);
  }
  changed() { this.fs.emit('fw'); }
  async act(a, el) {
    const fw = this.fw, sys = this.sys, k = this.node;
    switch (a) {
      case 'newrule': return this.wizard(k);
      case 'newcsr': return this.csrWizard();
      case 'fwprops': return this.fwProps();
      case 'props': { const r = this.selRules()[0]; if (r && this.sel.size === 1) this.props(r); return; }
      case 'enable': case 'disable': this.selRules().forEach(r => { r.enabled = a === 'enable'; }); return this.changed();
      case 'copy': case 'cut': {
        this.clip = this.selRules().map(clone);
        if (a === 'cut') { fw.rules = fw.rules.filter(r => !this.sel.has(r.id)); this.sel.clear(); this.changed(); }
        sys.toast(`${a === 'cut' ? 'Вирізано' : 'Скопійовано'} правил: ${this.clip.length}`); return this.renderActions();
      }
      case 'paste': {
        if (!this.clip) return; this.sel.clear();
        for (const r of this.clip) { const c = { ...clone(r), id: newId(fw), dir: this.isRules ? k : r.dir }; fw.rules.push(c); this.sel.add(c.id); }
        return this.changed();
      }
      case 'delete': {
        const rs = this.selRules(); if (!rs.length) return;
        if (!(await dialog({ title: 'Видалити правило', icon: 'warn', text: rs.length === 1 ? `Справді видалити правило «${rs[0].name.trim()}»?` : `Справді видалити виділені правила (${rs.length})?`, buttons: [{ t: 'Так', v: true, primary: true }, { t: 'Ні', v: false, cancel: true }] }))) return;
        fw.rules = fw.rules.filter(r => !this.sel.has(r.id)); this.sel.clear(); return this.changed();
      }
      case 'fprofile': return menu(0, 0, this.profileFilterItems(), { anchor: el });
      case 'fstate': return menu(0, 0, this.stateFilterItems(), { anchor: el });
      case 'fgroup': { const f = this.filter[k]; return menu(0, 0, [...groupsOf(fw).filter(g => fw.rules.some(r => r.dir === k && r.group === g)).map(g => ({ t: g, check: f.group === g, on: () => { f.group = f.group === g ? null : g; this.sel.clear(); this.render(); } })), '-', { t: 'Без групи (ваші правила)', check: f.group === '-', on: () => { f.group = f.group === '-' ? null : '-'; this.sel.clear(); this.render(); } }], { anchor: el }); }
      case 'clearfilter': this.filter[k] = {}; return this.render();
      case 'refresh': this.render(); return sys.toast('Оновлено');
      case 'help': return this.help();
      case 'diag': return sys.open('security', 'trouble');
      case 'exportlist': return this.exportList();
      case 'exportpol': return this.exportPolicy();
      case 'importpol': return this.importPolicy();
      case 'restore': {
        if (!(await dialog({ title: TITLE, icon: 'warn', html: '<p>Відновлення стандартної політики видалить усі ваші правила й параметри брандмауера та поверне налаштування, з якими Windows встановлено.</p><p>Продовжити?</p>', buttons: [{ t: 'Так', v: true, primary: true }, { t: 'Ні', v: false, cancel: true }] }))) return;
        this.fs.s.fw = fwDefaults(); this.sel.clear(); this.clip = null; this.changed(); return sys.toast('Стандартну політику відновлено');
      }
      case 'openlog': {
        if (!this.fs.node(LOG_FILE)) return alertBox('Файл журналу ще не створено. Увімкніть «Записувати пропущені пакети» або «Записувати успішні підключення» в параметрах журналу, а потім виконайте, наприклад, ping.', 'Журнал брандмауера', 'info');
        return sys.open('notepad', LOG_FILE);
      }
      case 'logsettings': return this.logSettings(NET.profile);
      case 'csron': case 'csroff': { const r = fw.csr.find(x => this.sel.has(x.id)); if (r) { r.enabled = a === 'csron'; this.changed(); } return; }
      case 'csrdel': { const r = fw.csr.find(x => this.sel.has(x.id)); if (r && await dialog({ title: 'Видалити правило', icon: 'warn', text: `Справді видалити правило «${r.name}»?`, buttons: [{ t: 'Так', v: true, primary: true }, { t: 'Ні', v: false, cancel: true }] })) { fw.csr = fw.csr.filter(x => x !== r); this.sel.clear(); this.changed(); } return; }
      case 'csrprops': { const r = fw.csr.find(x => this.sel.has(x.id)); if (r) this.csrProps(r); return; }
    }
  }
  help() {
    dialog({ title: 'Як працює брандмауер', icon: 'info', wide: true, html: `<p>Брандмауер перевіряє <b>кожне підключення</b> за правилами — згори вниз немає значення, важить лише таке:</p>
      <ol class="help-l"><li>Якщо брандмауер профілю <b>вимкнено</b> — пропускається все.</li><li>Якщо для вхідних увімкнено «<b>Блокувати всі підключення</b>» — вхідні блокуються навіть за правилом «Дозволити».</li>
      <li>Якщо підходить правило «<b>Блокувати</b>» — підключення блокується. Блокування завжди сильніше за дозвіл.</li><li>Якщо підходить правило «<b>Дозволити</b>» — пропускається.</li>
      <li>Якщо не підходить жодне — діє <b>стандартна дія</b> профілю: вхідні блокуються, вихідні дозволяються.</li></ol>
      <p>Правило «підходить», коли збігаються <b>усі</b> його умови: напрямок, профіль, програма, протокол, порти й адреси. «Будь-який» означає, що умова не перевіряється.</p>
      <p>Спробуйте: створіть вихідне правило, яке блокує протокол ICMPv4, і виконайте в Командному рядку <code>ping 8.8.8.8</code>.</p>`, buttons: [{ t: 'Зрозуміло', v: true, primary: true }] });
  }
  exportList() {
    const dir = this.node, name = dir === 'csr' ? 'Правила безпеки підключень.txt' : dir === 'in' ? 'Правила для вхідних підключень.txt' : 'Правила для вихідних підключень.txt';
    const lines = dir === 'csr' ? ['Ім’я\tУвімкнено\tКінцева точка 1\tКінцева точка 2\tРежим автентифікації', ...this.fw.csr.map(r => [r.name, r.enabled ? 'Так' : 'Ні', addrText(r.ep1), addrText(r.ep2), CSR_REQ[r.req]].join('\t'))]
      : [COLS.map(c => c[1]).join('\t'), ...this.rows().map(r => COLS.map(([c]) => cell(r, c)).join('\t'))];
    this.saveAs(name, lines.join('\r\n'), 'Експортувати список', 'Текстові файли (розділювач — табуляція)');
  }
  exportPolicy() {
    const pol = { format: 'edvault-wfw', version: 1, profiles: this.fw.profiles, rules: this.fw.rules, csr: this.fw.csr, ipsecIcmp: this.fw.ipsecIcmp };
    this.saveAs('Політика брандмауера.wfw', JSON.stringify(pol, null, 1), 'Експортувати політику', 'Файли політики (*.wfw)', () => this.sys.toast('Політику експортовано'));
  }
  saveAs(def, text, title, type, after) {
    modal({ title, cls: 'saveas', html: `<p>Файл буде збережено в папці <b>Документи</b>.</p><label class="fld">Ім’я файлу: <input class="inp" data-name value="${esc(def)}" spellcheck="false"></label><label class="fld">Тип файлу: <input class="inp" value="${esc(type)}" disabled></label>`,
      buttons: [{ t: 'Зберегти', v: 'ok', primary: true }, { t: 'Скасувати', v: null, cancel: true }],
      onOpen: api => setTimeout(() => { const i = api.$('[data-name]'); i.focus(); i.setSelectionRange(0, i.value.lastIndexOf('.')); }, 20),
      onButton: (v, api) => {
        if (v !== 'ok') return;
        const n = api.$('[data-name]').value.trim();
        if (!n || /[\\/:*?"<>|]/.test(n)) { alertBox('Ім’я файлу не може бути порожнім і містити символи \\ / : * ? " < > |', title, 'warn'); return false; }
        try { this.fs.writeFile(DOCS + '\\' + n, text); } catch (e) { alertBox(e.message, title, 'error'); return false; }
        after ? after() : this.sys.toast(`Збережено: Документи\\${n}`);
      } });
  }
  importPolicy() {
    const files = this.fs.list(DOCS).filter(n => n.type === 'file' && /\.wfw$/i.test(n.name));
    if (!files.length) return alertBox('У папці «Документи» немає файлів політики (.wfw). Спершу експортуйте політику: «Дія» → «Експортувати політику…».', 'Імпортувати політику', 'info');
    modal({ title: 'Імпортувати політику', cls: 'saveas', html: `<p>Виберіть файл політики в папці <b>Документи</b>:</p><div class="pick-list">${files.map((f, i) => `<label class="pick"><input type="radio" name="pf" value="${esc(f.name)}" ${i ? '' : 'checked'}>${TI.firewall}<span><b>${esc(f.name)}</b></span></label>`).join('')}</div>`,
      buttons: [{ t: 'Відкрити', v: 'ok', primary: true }, { t: 'Скасувати', v: null, cancel: true }],
      onButton: async (v, api) => {
        if (v !== 'ok') return;
        const name = api.$('input[name=pf]:checked').value;
        let pol; try { pol = JSON.parse(this.fs.readFile(DOCS + '\\' + name)); } catch (e) { pol = null; }
        if (!pol || pol.format !== 'edvault-wfw' || !Array.isArray(pol.rules) || !pol.profiles) { alertBox(`Не вдалося імпортувати «${name}»: файл пошкоджено або це не файл політики брандмауера.`, 'Імпортувати політику', 'error'); return false; }
        if (!(await dialog({ title: 'Імпортувати політику', icon: 'warn', text: 'Імпорт замінить усі поточні правила й параметри брандмауера. Продовжити?', buttons: [{ t: 'Так', v: true, primary: true }, { t: 'Ні', v: false, cancel: true }] }))) return false;
        const fw = this.fw; fw.profiles = pol.profiles; fw.rules = pol.rules; fw.csr = pol.csr || []; fw.ipsecIcmp = !!pol.ipsecIcmp;
        fw.seq = Math.max(fw.seq, ...fw.rules.concat(fw.csr).map(r => +String(r.id).slice(1) || 0)) + 1;
        this.sel.clear(); this.changed(); this.sys.toast('Політику імпортовано');
      } });
  }

  /* ═════════ Майстер створення правила ═════════ */
  wizard(dir) {
    const fw = this.fw;
    const d = { type: 'program', dir, prog: 'all', path: '', protocol: 'TCP', portsMode: 'specific', ports: '', icmp: 'any', proto2: 'any', lp: 'any', rp: 'any', laddr: 'any', raddr: 'any', action: 'allow', profiles: ['domain', 'private', 'public'], name: '', desc: '', group: null, pre: null };
    const dirGroups = groupsOf(fw).filter(g => fw.rules.some(r => r.dir === dir && r.group === g)); d.group = dirGroups[0];
    const STEPS = {
      program: ['type', 'program', 'action', 'profile', 'name'],
      port: ['type', 'ports', 'action', 'profile', 'name'],
      predefined: ['type', 'pre', 'preaction'],
      custom: ['type', 'program', 'custom', 'scope', 'action', 'profile', 'name'],
    };
    const TT = { type: 'Тип правила', program: 'Програма', ports: 'Протокол і порти', custom: 'Протокол і порти', scope: 'Область', action: 'Дія', preaction: 'Дія', profile: 'Профіль', name: 'Ім’я', pre: 'Попередньо визначені правила' };
    const HINT = {
      type: 'Виберіть тип правила брандмауера, яке потрібно створити.', program: 'Укажіть повний шлях до програми й ім’я її файлу.', ports: 'Укажіть протоколи й порти, до яких застосовується це правило.', custom: 'Укажіть протоколи й порти, до яких застосовується це правило.',
      scope: 'Укажіть локальні й віддалені IP-адреси, до яких застосовується це правило.', action: 'Укажіть дію, яку слід виконати, коли підключення відповідає умовам, зазначеним у правилі.', preaction: 'Укажіть дію, яку слід виконати, коли підключення відповідає умовам, зазначеним у правилі.',
      profile: 'Укажіть профілі, до яких застосовується це правило.', name: 'Укажіть ім’я й опис цього правила.', pre: 'Виберіть правила, які потрібно створити.',
    };
    let i = 0;
    const steps = () => STEPS[d.type], step = () => steps()[i];
    const radio = (name, v, cur, t, sub = '') => `<label class="rad big"><input type="radio" name="${name}" value="${v}" ${cur === v ? 'checked' : ''}><span><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</span></label>`;
    const addrBlock = (k, t) => `<fieldset class="wz-addr"><legend>${t}</legend>${radio(k, 'any', d[k] === 'any' ? 'any' : 'list', 'Будь-яка IP-адреса')}${radio(k, 'list', d[k] === 'any' ? 'any' : 'list', 'Ці IP-адреси:')}<input class="inp" data-f="${k}list" value="${esc(d[k] === 'any' ? '' : d[k].join(', '))}" placeholder="наприклад 192.168.1.15, 10.0.0.0/8 або LocalSubnet" ${d[k] === 'any' ? 'disabled' : ''} spellcheck="false"></fieldset>`;
    const body = () => {
      const s = step();
      if (s === 'type') return `<p>Яке правило потрібно створити?</p>${radio('type', 'program', d.type, 'Для програми', 'Правило, яке керує підключеннями певної програми.')}${radio('type', 'port', d.type, 'Для порту', 'Правило, яке керує підключеннями до порту TCP або UDP.')}${radio('type', 'predefined', d.type, 'Попередньо визначене:', 'Правило, яке керує підключеннями для однієї з функцій Windows.')}<select class="inp sub" data-f="group" ${d.type === 'predefined' ? '' : 'disabled'}>${dirGroups.map(g => `<option ${g === d.group ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>${radio('type', 'custom', d.type, 'Настроюване', 'Настроюване правило: програма, протокол, порти й адреси разом.')}`;
      if (s === 'program') return `<p>Це правило застосовується до всіх програм чи до певної?</p>${radio('prog', 'all', d.prog, 'Усі програми', 'Правило застосовується до всіх підключень на комп’ютері, які відповідають іншим властивостям правила.')}${radio('prog', 'path', d.prog, 'Шлях до цієї програми:')}<div class="wz-row sub"><input class="inp" data-f="path" value="${esc(d.path)}" placeholder="C:\\Program Files\\Приклад\\program.exe" ${d.prog === 'path' ? '' : 'disabled'} spellcheck="false"><button class="btn" data-pick ${d.prog === 'path' ? '' : 'disabled'}>Огляд…</button></div><p class="hint muted">Наприклад: <code>C:\\Windows\\System32\\PING.EXE</code> або <code>%ProgramFiles%\\Minecraft Launcher\\MinecraftLauncher.exe</code></p>`;
      if (s === 'ports') return `<p>Це правило застосовується до протоколу TCP чи UDP?</p>${radio('protocol', 'TCP', d.protocol, 'TCP')}${radio('protocol', 'UDP', d.protocol, 'UDP')}<p>Це правило застосовується до всіх ${dir === 'in' ? 'локальних' : 'віддалених'} портів чи до певних?</p>${radio('portsMode', 'all', d.portsMode, `Усі ${dir === 'in' ? 'локальні' : 'віддалені'} порти`)}${radio('portsMode', 'specific', d.portsMode, `Певні ${dir === 'in' ? 'локальні' : 'віддалені'} порти:`)}<input class="inp sub" data-f="ports" value="${esc(d.ports)}" placeholder="Приклад: 80, 443, 5000-5010" ${d.portsMode === 'specific' ? '' : 'disabled'} spellcheck="false"><p class="hint muted">${dir === 'in' ? 'Локальний порт — «двері» цього комп’ютера, до яких стукають інші: 80 — вебсервер, 3389 — віддалений робочий стіл, 25565 — сервер Minecraft.' : 'Віддалений порт — «двері» сервера, до якого підключається цей комп’ютер: 80 і 443 — сайти, 53 — DNS.'}</p>`;
      if (s === 'custom') return `<div class="wz-grid"><label>Тип протоколу:</label><select class="inp" data-f="proto2">${PROTOCOLS.map(p => `<option value="${p}" ${p === d.proto2 ? 'selected' : ''}>${protoText(p)}</option>`).join('')}</select><label>Номер протоколу:</label><input class="inp" value="${PROTO_NUM[d.proto2]}" disabled>
        <label>Локальний порт:</label><input class="inp" data-f="lp" value="${d.lp === 'any' ? '' : esc(d.lp)}" placeholder="${isPort(d.proto2) ? 'Усі порти (або 80, 443, 5000-5010)' : 'Лише для TCP і UDP'}" ${isPort(d.proto2) ? '' : 'disabled'} spellcheck="false">
        <label>Віддалений порт:</label><input class="inp" data-f="rp" value="${d.rp === 'any' ? '' : esc(d.rp)}" placeholder="${isPort(d.proto2) ? 'Усі порти (або 80, 443, 5000-5010)' : 'Лише для TCP і UDP'}" ${isPort(d.proto2) ? '' : 'disabled'} spellcheck="false">
        <label>Параметри ICMP:</label><span><button class="btn" data-icmp ${isIcmp(d.proto2) ? '' : 'disabled'}>Налаштувати…</button> <small class="muted">${isIcmp(d.proto2) ? (d.icmp === 'any' ? 'усі типи' : d.icmp.map(t => ICMP_TYPES.find(x => x[0] === t)?.[1] || t).join(', ')) : ''}</small></span></div>
        <p class="hint muted">Порожнє поле порту означає «Усі порти». ICMP — це протокол команди <code>ping</code>: «Луна-запит» (тип 8) — питання «ти тут?», «Луна-відповідь» (тип 0) — «так, я тут».</p>`;
      if (s === 'scope') return `${addrBlock('laddr', 'До яких локальних IP-адрес застосовується це правило?')}${addrBlock('raddr', 'До яких віддалених IP-адрес застосовується це правило?')}<p class="hint muted">Можна писати адреси (8.8.8.8), підмережі (192.168.1.0/24), діапазони (10.0.0.1-10.0.0.50) і слова: ${Object.keys(KEYWORDS).join(', ')}.</p>`;
      if (s === 'action' || s === 'preaction') return `<p>Яку дію слід виконати, коли підключення відповідає вказаним умовам?</p>${radio('action', 'allow', d.action, 'Дозволити підключення', 'Це стосується підключень, захищених за допомогою IPsec, і незахищених підключень.')}${radio('action', 'secure', d.action, 'Дозволити безпечне підключення', 'Це стосується лише підключень, автентифікованих за допомогою IPsec.')}${radio('action', 'block', d.action, 'Блокувати підключення')}`;
      if (s === 'profile') return `<p>Коли застосовується це правило?</p>${PROFILES.map(p => `<label class="chk big"><input type="checkbox" data-prof="${p}" ${d.profiles.includes(p) ? 'checked' : ''}><span><b>${{ domain: 'Домен', private: 'Приватний', public: 'Загальнодоступний' }[p]}</b><small>${{ domain: 'Застосовується, коли комп’ютер підключено до домену організації.', private: 'Застосовується, коли комп’ютер підключено до приватної мережі, як-от вдома чи в школі.', public: 'Застосовується, коли комп’ютер підключено до загальнодоступної мережі.' }[p]}</small></span></label>`).join('')}`;
      if (s === 'name') return `<label class="fld col">Ім’я:<input class="inp" data-f="name" value="${esc(d.name)}" spellcheck="false" autofocus></label><label class="fld col">Опис (необов’язково):<textarea class="inp" data-f="desc" rows="4">${esc(d.desc)}</textarea></label>`;
      if (s === 'pre') { const list = fw.rules.filter(r => r.group === d.group && r.dir === dir); d.pre ||= new Set(list.map(r => r.id));
        return `<p>Будуть створені такі правила для «${esc(d.group)}» (${dir === 'in' ? 'вхідні' : 'вихідні'}):</p>${list.length ? `<div class="tbl-wrap pre"><table class="rules"><thead><tr><th></th><th>Ім’я</th><th>Профіль</th><th>Уже увімкнене</th></tr></thead><tbody>${list.map(r => `<tr><td><input type="checkbox" data-pre="${r.id}" ${d.pre.has(r.id) ? 'checked' : ''}></td><td>${esc(r.name.trim())}</td><td>${esc(profilesText(r))}</td><td>${r.enabled ? 'Так' : 'Ні'}</td></tr>`).join('')}</tbody></table></div>` : `<p class="muted">У цій групі немає ${dir === 'in' ? 'вхідних' : 'вихідних'} правил. Поверніться й виберіть іншу групу.</p>`}`; }
    };
    const render = api => {
      const st = steps();
      api.$('.wz-steps').innerHTML = `<h5>Кроки:</h5>${st.map((s, j) => `<span class="${j === i ? 'on' : j < i ? 'done' : ''}">${TT[s]}</span>`).join('')}`;
      api.$('.wz-head').innerHTML = `<b>${TT[step()]}</b><small>${HINT[step()]}</small>`;
      api.$('.wz-body').innerHTML = body();
      api.button(0).disabled = i === 0;
      api.button(1).textContent = i === st.length - 1 ? 'Готово' : 'Далі >';
      setTimeout(() => api.$('.wz-body [autofocus]')?.focus(), 20);
    };
    const read = api => {
      const v = n => api.$(`.wz-body input[name="${n}"]:checked`)?.value, f = n => api.$(`.wz-body [data-f="${n}"]`);
      const s = step();
      if (s === 'type') { d.type = v('type'); d.group = f('group').value; d.pre = null; }
      if (s === 'program') { d.prog = v('prog'); d.path = f('path').value.trim(); }
      if (s === 'ports') { d.protocol = v('protocol'); d.portsMode = v('portsMode'); d.ports = f('ports').value.replace(/\s+/g, ''); }
      if (s === 'custom') { d.proto2 = f('proto2').value; d.lp = f('lp').value.replace(/\s+/g, '') || 'any'; d.rp = f('rp').value.replace(/\s+/g, '') || 'any'; }
      if (s === 'scope') for (const k of ['laddr', 'raddr']) d[k] = v(k) === 'any' ? 'any' : f(k + 'list').value.split(/[,\s]+/).filter(Boolean);
      if (s === 'action' || s === 'preaction') d.action = v('action');
      if (s === 'profile') d.profiles = api.$$('.wz-body [data-prof]').filter(x => x.checked).map(x => x.dataset.prof);
      if (s === 'name') { d.name = f('name').value.trim(); d.desc = f('desc').value.trim(); }
      if (s === 'pre') d.pre = new Set(api.$$('.wz-body [data-pre]').filter(x => x.checked).map(x => x.dataset.pre));
    };
    const check = () => {
      const s = step(), bad = t => { alertBox(t, 'Майстер створення правила', 'warn'); return false; };
      if (s === 'program' && d.prog === 'path') { if (!d.path) return bad('Укажіть шлях до програми.'); if (!/^([a-z]:\\|%\w+%\\).+\.exe$/i.test(d.path)) return bad('Шлях має вести до файлу програми .exe, наприклад C:\\Windows\\System32\\PING.EXE.'); }
      if (s === 'ports' && d.portsMode === 'specific') { if (!d.ports) return bad('Укажіть хоча б один порт або виберіть «Усі порти».'); if (!validPorts(d.ports)) return bad('Неправильне значення порту. Порт — це число від 1 до 65535; кілька портів пишуть через кому, діапазон — через дефіс (5000-5010).'); }
      if (s === 'custom') for (const [k, t] of [['lp', 'локального'], ['rp', 'віддаленого']]) if (isPort(d.proto2) && d[k] !== 'any' && !validPorts(d[k])) return bad(`Неправильне значення ${t} порту. Приклад: 80, 443, 5000-5010.`);
      if (s === 'scope') for (const [k, t] of [['laddr', 'локальних'], ['raddr', 'віддалених']]) { if (d[k] !== 'any' && !d[k].length) return bad(`Укажіть хоча б одну адресу в полі ${t} IP-адрес або виберіть «Будь-яка IP-адреса».`); const w = d[k] !== 'any' && d[k].find(a => !validAddr(a)); if (w) return bad(`«${w}» — неправильна IP-адреса. Приклади: 192.168.1.15, 10.0.0.0/8, 10.0.0.1-10.0.0.50, LocalSubnet.`); }
      if (s === 'profile' && !d.profiles.length) return bad('Виберіть хоча б один профіль.');
      if (s === 'name' && !d.name) return bad('Укажіть ім’я правила.');
      if (s === 'pre' && !d.pre.size) return bad('Виберіть хоча б одне правило.');
      return true;
    };
    const finish = () => {
      if (d.type === 'predefined') { for (const r of fw.rules) if (d.pre.has(r.id)) { r.enabled = true; r.action = d.action; } this.sel = new Set(d.pre); this.changed(); this.sys.toast('Правила створено'); return; }
      const r = { id: newId(fw), name: d.name, desc: d.desc, group: '', dir, enabled: true, action: d.action, profiles: d.profiles.length === 3 ? 'any' : d.profiles, program: 'any', service: 'any', protocol: 'any', localPorts: 'any', remotePorts: 'any', icmp: 'any', localAddr: 'any', remoteAddr: 'any', edge: 'block', iface: 'all', predefined: false };
      if (d.type !== 'port' && d.prog === 'path') r.program = d.path.replace(/^%ProgramFiles%/i, 'C:\\Program Files').replace(/^%SystemRoot%/i, 'C:\\Windows');
      if (d.type === 'port') { r.protocol = d.protocol; if (d.portsMode === 'specific') r[dir === 'in' ? 'localPorts' : 'remotePorts'] = d.ports; }
      if (d.type === 'custom') { r.protocol = d.proto2; if (isPort(d.proto2)) { r.localPorts = d.lp; r.remotePorts = d.rp; } if (isIcmp(d.proto2)) r.icmp = d.icmp; r.localAddr = d.laddr; r.remoteAddr = d.raddr; }
      fw.rules.push(r); this.sel = new Set([r.id]); this.anchor = r.id; this.changed(); this.sys.toast(`Правило «${r.name}» створено`);
    };
    modal({ title: `Майстер створення правила для ${dir === 'in' ? 'вхідного' : 'вихідного'} підключення`, cls: 'wiz', html: `<header class="wz-head"></header><div class="wz-main"><nav class="wz-steps"></nav><div class="wz-body"></div></div>`,
      buttons: [{ t: '< Назад', v: 'back' }, { t: 'Далі >', v: 'next', primary: true }, { t: 'Скасувати', v: null, cancel: true }],
      onOpen: api => {
        render(api);
        api.el.addEventListener('change', e => {
          const n = e.target.name, f = e.target.dataset.f;
          if (n === 'type' || f === 'proto2' || n === 'prog' || n === 'portsMode' || n === 'laddr' || n === 'raddr') { read(api); render(api); }
          if (f === 'group') { d.group = e.target.value; d.pre = null; }
        });
        api.el.addEventListener('click', e => {
          if (e.target.closest('[data-icmp]')) { read(api); this.icmpDialog(d.icmp, v => { d.icmp = v; render(api); }); }
          if (e.target.closest('[data-pick]')) this.pickProgram(p => { api.$('[data-f="path"]').value = p; });
        });
      },
      onButton: (v, api) => {
        if (v === null) return;
        read(api);
        if (v === 'back') { i = Math.max(0, i - 1); render(api); return false; }
        if (!check()) return false;
        if (i < steps().length - 1) { i++; render(api); return false; }
        finish();
      } });
  }
  pickProgram(done) {
    const list = [['PING.EXE', PROGRAMS.ping], ['curl.exe', PROGRAMS.curl], ['msedge.exe', PROGRAMS.edge], ['MinecraftLauncher.exe', PROGRAMS.minecraft], ['ms-teams.exe', PROGRAMS.teams], ['mstsc.exe', PROGRAMS.mstsc], ['svchost.exe', PROGRAMS.svchost]];
    modal({ title: 'Відкрити', cls: 'saveas', html: `<p>Виберіть програму:</p><div class="pick-list">${list.map(([n, p], i) => `<label class="pick"><input type="radio" name="pp" value="${esc(p)}" ${i ? '' : 'checked'}>${ui('terminal', 18)}<span><b>${esc(n)}</b><small>${esc(p)}</small></span></label>`).join('')}</div>`,
      buttons: [{ t: 'Відкрити', v: 'ok', primary: true }, { t: 'Скасувати', v: null, cancel: true }],
      onButton: (v, api) => { if (v === 'ok') done(api.$('input[name=pp]:checked').value); } });
  }
  icmpDialog(cur, done, ro = false) {
    modal({ title: 'Налаштування параметрів ICMP', cls: 'icmp', html: `<p>Застосувати це правило до таких підключень протоколу ICMP:</p>
      <label class="rad"><input type="radio" name="it" value="any" ${cur === 'any' ? 'checked' : ''} ${ro ? 'disabled' : ''}> Усі типи ICMP</label><label class="rad"><input type="radio" name="it" value="some" ${cur === 'any' ? '' : 'checked'} ${ro ? 'disabled' : ''}> Певні типи ICMP</label>
      <div class="icmp-list">${ICMP_TYPES.map(([t, n]) => `<label class="chk"><input type="checkbox" data-it="${t}" ${cur !== 'any' && cur.includes(t) ? 'checked' : ''} ${cur === 'any' || ro ? 'disabled' : ''}> ${esc(n)} <small class="muted">(тип ${t})</small></label>`).join('')}</div>`,
      buttons: [{ t: 'OK', v: 'ok', primary: true }, { t: 'Скасувати', v: null, cancel: true }],
      onOpen: api => api.el.addEventListener('change', e => { if (e.target.name === 'it') api.$$('[data-it]').forEach(c => { c.disabled = e.target.value === 'any'; }); }),
      onButton: (v, api) => {
        if (v !== 'ok' || ro) return;
        if (api.$('input[name=it]:checked').value === 'any') return done('any');
        const ts = api.$$('[data-it]').filter(c => c.checked).map(c => +c.dataset.it);
        if (!ts.length) { alertBox('Виберіть хоча б один тип ICMP або «Усі типи ICMP».', 'Параметри ICMP', 'warn'); return false; }
        done(ts);
      } });
  }

  /* ═════════ Властивості правила ═════════ */
  props(rule) {
    if (!rule) return;
    const fw = this.fw, pre = rule.predefined, ro = pre ? 'disabled' : '';
    let d = clone(rule);
    const addrList = (k, t) => `<fieldset><legend>${t}</legend><label class="rad"><input type="radio" name="${k}m" value="any" ${d[k] === 'any' ? 'checked' : ''}> Будь-яка IP-адреса</label><label class="rad"><input type="radio" name="${k}m" value="list" ${d[k] === 'any' ? '' : 'checked'}> Ці IP-адреси:</label>
      <div class="addr-box"><select class="inp" size="4" data-alist="${k}" ${d[k] === 'any' ? 'disabled' : ''}>${(d[k] === 'any' ? [] : d[k]).map(a => `<option>${esc(a)}</option>`).join('')}</select><div class="addr-btns"><input class="inp" data-anew="${k}" placeholder="IP-адреса" ${d[k] === 'any' ? 'disabled' : ''} spellcheck="false"><button class="btn" data-aadd="${k}" ${d[k] === 'any' ? 'disabled' : ''}>Додати</button><button class="btn" data-adel="${k}" ${d[k] === 'any' ? 'disabled' : ''}>Видалити</button></div></div></fieldset>`;
    const portSel = (k, t) => `<label>${t}</label><input class="inp" data-p="${k}" value="${d[k] === 'any' ? '' : esc(d[k])}" placeholder="${isPort(d.protocol) ? 'Усі порти' : 'Лише для TCP і UDP'}" ${isPort(d.protocol) && !pre ? '' : 'disabled'} spellcheck="false">`;
    const panes = () => tabs([
      ['general', 'Загальні', `${pre ? `<p class="note">${ui('info', 15)}<span>Це попередньо визначене правило, і деякі його властивості не можна змінити.</span></p>` : ''}<fieldset><legend>Загальні</legend><div class="pg"><label>Ім’я:</label><input class="inp" data-g="name" value="${esc(d.name.trim())}" ${ro} spellcheck="false"><label>Опис:</label><textarea class="inp" data-g="desc" rows="3" ${ro}>${esc(d.desc)}</textarea></div><label class="chk"><input type="checkbox" data-g="enabled" ${d.enabled ? 'checked' : ''}> Увімкнено</label></fieldset>
        <fieldset><legend>Дія</legend><label class="rad"><input type="radio" name="act" value="allow" ${d.action === 'allow' ? 'checked' : ''}> Дозволити підключення</label><label class="rad"><input type="radio" name="act" value="secure" ${d.action === 'secure' ? 'checked' : ''}> Дозволити безпечне підключення</label><label class="rad"><input type="radio" name="act" value="block" ${d.action === 'block' ? 'checked' : ''}> Блокувати підключення</label></fieldset>`],
      ['programs', 'Програми й служби', `<fieldset><legend>Програми</legend><label class="rad"><input type="radio" name="prg" value="any" ${d.program === 'any' ? 'checked' : ''} ${ro}> Усі програми, що відповідають указаним умовам</label><label class="rad"><input type="radio" name="prg" value="path" ${d.program === 'any' ? '' : 'checked'} ${ro}> Ця програма:</label><div class="wz-row sub"><input class="inp" data-g="program" value="${d.program === 'any' ? '' : esc(d.program)}" ${pre || d.program === 'any' ? 'disabled' : ''} spellcheck="false"><button class="btn" data-pick ${pre || d.program === 'any' ? 'disabled' : ''}>Огляд…</button></div></fieldset>
        <fieldset><legend>Служби</legend><p class="muted">Укажіть служби, до яких застосовується це правило.</p><select class="inp" data-g="service" ${ro}><option value="any">Застосовувати до всіх програм і служб</option>${SERVICES.map(([k, t]) => `<option value="${k}" ${d.service === k ? 'selected' : ''}>${esc(t)} (${k})</option>`).join('')}</select></fieldset>`],
      ['remote', 'Віддалені комп’ютери', `<fieldset><legend>Авторизовані комп’ютери</legend><label class="chk"><input type="checkbox" disabled> Дозволяти підключення лише з цих комп’ютерів</label><div class="empty-list"></div></fieldset><fieldset><legend>Винятки</legend><label class="chk"><input type="checkbox" disabled> Пропускати підключення з цих комп’ютерів</label><div class="empty-list"></div></fieldset><p class="note">${ui('info', 15)}<span>Ці параметри доступні лише для дії «Дозволити безпечне підключення», коли комп’ютери перевіряють один одного через правила безпеки підключень.</span></p>`],
      ['ports', 'Протоколи й порти', `<fieldset><legend>Протоколи й порти</legend><div class="pg"><label>Тип протоколу:</label><select class="inp" data-g="protocol" ${ro}>${PROTOCOLS.map(p => `<option value="${p}" ${p === d.protocol ? 'selected' : ''}>${protoText(p)}</option>`).join('')}</select><label>Номер протоколу:</label><input class="inp num" value="${PROTO_NUM[d.protocol]}" disabled>${portSel('localPorts', 'Локальний порт:')}${portSel('remotePorts', 'Віддалений порт:')}<label>Параметри ICMP:</label><span><button class="btn" data-icmp ${isIcmp(d.protocol) ? '' : 'disabled'}>Налаштувати…</button> <small class="muted" data-icmpt>${isIcmp(d.protocol) ? (d.icmp === 'any' ? 'усі типи' : d.icmp.map(t => ICMP_TYPES.find(x => x[0] === t)?.[1] || t).join(', ')) : ''}</small></span></div></fieldset><p class="hint muted">Порожнє поле означає «Усі порти». Кілька портів — через кому, діапазон — через дефіс: <code>80, 443, 5000-5010</code>.</p>`],
      ['scope', 'Область', `${addrList('localAddr', 'Локальна IP-адреса')}${addrList('remoteAddr', 'Віддалена IP-адреса')}`],
      ['advanced', 'Додатково', `<fieldset><legend>Профілі</legend><p class="muted">Укажіть профілі, до яких застосовується це правило.</p>${PROFILES.map(p => `<label class="chk"><input type="checkbox" data-prof="${p}" ${profilesOf(d).includes(p) ? 'checked' : ''}> ${PROFILE_NAME[p]}</label>`).join('')}</fieldset>
        <fieldset><legend>Типи інтерфейсів</legend><div class="pg"><label>Інтерфейси:</label><select class="inp" data-g="iface">${IFACES.map(([k, t]) => `<option value="${k}" ${d.iface === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div></fieldset>
        <fieldset><legend>Обхід через межу</legend><p class="muted">Чи можна підключатися до цього комп’ютера з Інтернету через роутер (NAT), наприклад за технологією Teredo.</p><select class="inp" data-g="edge">${['block', 'allow', 'defer-app', 'defer-user'].map(k => `<option value="${k}" ${d.edge === k ? 'selected' : ''}>${edgeText(k)}</option>`).join('')}</select></fieldset>`],
      ['principals', 'Локальні принципали', `<fieldset><legend>Авторизовані користувачі</legend><label class="chk"><input type="checkbox" disabled> Дозволяти підключення лише від таких користувачів</label><div class="empty-list"></div></fieldset><fieldset><legend>Винятки</legend><label class="chk"><input type="checkbox" disabled> Пропускати підключення від таких користувачів</label><div class="empty-list"></div></fieldset><p class="note">${ui('info', 15)}<span>Користувачів можна вказати лише для правила з дією «Дозволити безпечне підключення».</span></p>`],
      ['users', 'Віддалені користувачі', `<fieldset><legend>Авторизовані користувачі</legend><label class="chk"><input type="checkbox" disabled> Дозволяти підключення лише від таких користувачів</label><div class="empty-list"></div></fieldset><fieldset><legend>Винятки</legend><label class="chk"><input type="checkbox" disabled> Пропускати підключення від таких користувачів</label><div class="empty-list"></div></fieldset>`],
    ]);
    // зібрати форму в d; повертає текст помилки або ''
    const collect = api => {
      const g = n => api.$(`[data-g="${n}"]`), v = n => api.$(`input[name="${n}"]:checked`)?.value;
      if (!pre) { d.name = g('name').value; d.desc = g('desc').value; d.program = v('prg') === 'any' ? 'any' : g('program').value.trim(); d.service = g('service').value; d.protocol = g('protocol').value; }
      d.enabled = g('enabled').checked; d.action = v('act'); d.iface = g('iface').value; d.edge = g('edge').value;
      if (!pre && isPort(d.protocol)) for (const k of ['localPorts', 'remotePorts']) d[k] = api.$(`[data-p="${k}"]`).value.replace(/\s+/g, '') || 'any';
      if (!isPort(d.protocol)) { d.localPorts = 'any'; d.remotePorts = 'any'; }
      if (!isIcmp(d.protocol)) d.icmp = 'any';
      for (const k of ['localAddr', 'remoteAddr']) d[k] = v(k + 'm') === 'any' ? 'any' : [...api.$(`[data-alist="${k}"]`).options].map(o => o.value);
      const ps = api.$$('[data-prof]').filter(c => c.checked).map(c => c.dataset.prof); d.profiles = ps.length === 3 ? 'any' : ps;
      if (!d.name.trim()) return ['general', 'Укажіть ім’я правила.'];
      if (d.program !== 'any' && !/^([a-z]:\\|%\w+%\\).+\.exe$/i.test(d.program)) return ['programs', 'Шлях має вести до файлу програми .exe.'];
      for (const k of ['localPorts', 'remotePorts']) if (d[k] !== 'any' && !validPorts(d[k])) return ['ports', `Неправильне значення порту «${d[k]}». Приклад: 80, 443, 5000-5010.`];
      for (const k of ['localAddr', 'remoteAddr']) if (d[k] !== 'any' && !d[k].length) return ['scope', 'Додайте хоча б одну IP-адресу або виберіть «Будь-яка IP-адреса».'];
      if (!ps.length) return ['advanced', 'Виберіть хоча б один профіль.'];
      return null;
    };
    const apply = api => {
      const err = collect(api);
      if (err) { api.$(`[data-tab="${err[0]}"]`).click(); alertBox(err[1], 'Властивості', 'warn'); return false; }
      const live = fw.rules.find(r => r.id === rule.id);
      if (!live) { alertBox('Це правило вже видалено.', 'Властивості', 'warn'); return true; }
      Object.assign(live, clone(d)); api.button(2).disabled = true; this.changed(); return true;
    };
    modal({ title: `Властивості: ${rule.name.trim()}`, cls: 'rprops', html: panes(),
      buttons: [{ t: 'OK', v: 'ok', primary: true }, { t: 'Скасувати', v: null, cancel: true }, { t: 'Застосувати', v: 'apply' }],
      onOpen: api => {
        api.button(2).disabled = true;
        const dirty = () => { api.button(2).disabled = false; };
        api.el.addEventListener('input', dirty);
        api.el.addEventListener('change', e => {
          dirty(); const t = e.target;
          if (t.dataset.g === 'protocol') {
            d.protocol = t.value; api.$('.num').value = PROTO_NUM[d.protocol];
            for (const k of ['localPorts', 'remotePorts']) { const i = api.$(`[data-p="${k}"]`); i.disabled = !isPort(d.protocol); i.placeholder = isPort(d.protocol) ? 'Усі порти' : 'Лише для TCP і UDP'; if (!isPort(d.protocol)) i.value = ''; }
            api.$('[data-icmp]').disabled = !isIcmp(d.protocol); api.$('[data-icmpt]').textContent = isIcmp(d.protocol) ? 'усі типи' : ''; d.icmp = 'any';
          }
          if (t.name === 'prg') { const on = t.value === 'path'; api.$('[data-g="program"]').disabled = !on; api.$('[data-pick]').disabled = !on; }
          if (t.name === 'localAddrm' || t.name === 'remoteAddrm') { const k = t.name.slice(0, -1), on = t.value === 'list'; api.$$(`[data-alist="${k}"], [data-anew="${k}"], [data-aadd="${k}"], [data-adel="${k}"]`).forEach(x => { x.disabled = !on; }); }
        });
        api.el.addEventListener('click', e => {
          if (e.target.closest('[data-icmp]')) return this.icmpDialog(d.icmp, v => { d.icmp = v; dirty(); api.$('[data-icmpt]').textContent = v === 'any' ? 'усі типи' : v.map(t => ICMP_TYPES.find(x => x[0] === t)?.[1] || t).join(', '); }, pre);
          if (e.target.closest('[data-pick]')) return this.pickProgram(p => { api.$('[data-g="program"]').value = p; dirty(); });
          const add = e.target.closest('[data-aadd]');
          if (add) { const k = add.dataset.aadd, inp = api.$(`[data-anew="${k}"]`), a = inp.value.trim(); if (!a) return; if (!validAddr(a)) return alertBox(`«${a}» — неправильна IP-адреса. Приклади: 192.168.1.15, 10.0.0.0/8, 10.0.0.1-10.0.0.50, LocalSubnet.`, 'IP-адреса', 'warn'); const o = document.createElement('option'); o.textContent = a; api.$(`[data-alist="${k}"]`).appendChild(o); inp.value = ''; dirty(); }
          const del = e.target.closest('[data-adel]');
          if (del) { const s = api.$(`[data-alist="${del.dataset.adel}"]`); if (s.selectedIndex >= 0) { s.remove(s.selectedIndex); dirty(); } }
        });
        api.el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.anew) { e.preventDefault(); e.stopPropagation(); api.$(`[data-aadd="${e.target.dataset.anew}"]`).click(); } }, true);
      },
      onButton: (v, api) => { if (v === 'ok') return apply(api); if (v === 'apply') { apply(api); return false; } } });
  }

  /* ═════════ Властивості брандмауера ═════════ */
  fwProps(tab) {
    const fw = this.fw, d = clone(fw.profiles); let icmp = fw.ipsecIcmp;
    const prof = p => { const c = d[p]; return `<p class="muted">Укажіть поведінку, коли комп’ютер підключено до ${p === 'domain' ? 'домену' : p === 'private' ? 'приватної мережі' : 'загальнодоступної мережі'}${p === NET.profile ? ' (зараз активний цей профіль)' : ''}.</p>
      <fieldset><legend>Стан</legend><div class="pg"><label>Стан брандмауера:</label><select class="inp" data-pf="${p}:on"><option value="1" ${c.on ? 'selected' : ''}>Увімкнути (рекомендовано)</option><option value="0" ${c.on ? '' : 'selected'}>Вимкнути</option></select>
        <label>Вхідні підключення:</label><select class="inp" data-pf="${p}:inbound">${['block', 'blockall', 'allow'].map(k => `<option value="${k}" ${c.inbound === k ? 'selected' : ''}>${inboundText(k)}</option>`).join('')}</select>
        <label>Вихідні підключення:</label><select class="inp" data-pf="${p}:outbound">${['allow', 'block'].map(k => `<option value="${k}" ${c.outbound === k ? 'selected' : ''}>${outboundText(k)}</option>`).join('')}</select></div>
        <div class="fp-row"><span>Захищені мережеві підключення:</span><button class="btn" data-sub="ifaces:${p}">Налаштувати…</button></div></fieldset>
      <fieldset><legend>Параметри</legend><div class="fp-row"><span>Сповіщення, одноадресні відповіді та об’єднання правил.</span><button class="btn" data-sub="settings:${p}">Налаштувати…</button></div></fieldset>
      <fieldset><legend>Ведення журналу</legend><div class="fp-row"><span>Запис пропущених пакетів і успішних підключень у файл.</span><button class="btn" data-sub="log:${p}">Налаштувати…</button></div></fieldset>`; };
    const ipsec = () => `<fieldset><legend>Стандартні параметри IPsec</legend><div class="fp-row"><span>Як комп’ютери домовляються про ключі й перевіряють один одного.</span><button class="btn" data-sub="ipsecdef:">Налаштувати…</button></div></fieldset>
      <fieldset><legend>Винятки IPsec</legend><p class="muted">Звільнення ICMP від IPsec спрощує діагностику мережі командою ping.</p><div class="pg"><label>Звільнити ICMP від IPsec:</label><select class="inp" data-icmpx><option value="0" ${icmp ? '' : 'selected'}>Ні (за замовчуванням)</option><option value="1" ${icmp ? 'selected' : ''}>Так</option></select></div></fieldset>
      <fieldset><legend>Авторизація тунелю IPsec</legend><label class="rad"><input type="radio" name="tun" checked> Немає</label><label class="rad"><input type="radio" name="tun" disabled> Додатково</label></fieldset>`;
    const sync = api => {
      for (const s of api.$$('[data-pf]')) { const [p, k] = s.dataset.pf.split(':'); d[p][k] = k === 'on' ? s.value === '1' : s.value; }
      icmp = api.$('[data-icmpx]').value === '1';
      for (const p of PROFILES) api.$(`[data-tab="${p}"]`).classList.toggle('warnd', !d[p].on);
    };
    const commit = () => { for (const p of PROFILES) Object.assign(fw.profiles[p], clone(d[p])); fw.ipsecIcmp = icmp; this.changed(); };
    modal({ title: 'Властивості: Брандмауер Захисника Windows', cls: 'rprops fwp', html: tabs([['domain', 'Профіль домену', prof('domain')], ['private', 'Приватний профіль', prof('private')], ['public', 'Загальнодоступний профіль', prof('public')], ['ipsec', 'Параметри IPsec', ipsec()]]),
      buttons: [{ t: 'OK', v: 'ok', primary: true }, { t: 'Скасувати', v: null, cancel: true }, { t: 'Застосувати', v: 'apply' }],
      onOpen: api => {
        api.button(2).disabled = true;
        if (tab) api.$(`[data-tab="${tab}"]`)?.click();
        api.el.addEventListener('change', () => { sync(api); api.button(2).disabled = false; });
        api.el.addEventListener('click', e => {
          const s = e.target.closest('[data-sub]'); if (!s) return;
          const [what, p] = s.dataset.sub.split(':'), dirty = () => { api.button(2).disabled = false; };
          if (what === 'ifaces') this.subIfaces(d[p], dirty);
          if (what === 'settings') this.subSettings(d[p], p, dirty);
          if (what === 'log') this.subLog(d[p], p, dirty);
          if (what === 'ipsecdef') alertBox('Обмін ключами: стандартний (Diffie-Hellman Group 2).\nЗахист даних: стандартний (ESP, AES-128 та SHA-1).\nМетод автентифікації: Kerberos v5 для комп’ютера.\n\nУ навчальному комп’ютері ці параметри лише для перегляду.', 'Налаштування параметрів IPsec', 'info');
        });
      },
      onButton: (v, api) => { if (v === null) return; sync(api); commit(); if (v === 'apply') { api.button(2).disabled = true; return false; } } });
  }
  subIfaces(c, dirty) {
    modal({ title: 'Захищені мережеві підключення', cls: 'small', html: `<p>Виберіть мережеві підключення, які має захищати брандмауер для цього профілю:</p>${['Ethernet', 'Wi-Fi', 'Bluetooth'].map(n => `<label class="chk"><input type="checkbox" data-if="${n}" ${c.ifaces.includes(n) ? 'checked' : ''}> ${n}</label>`).join('')}<p class="hint muted">Зняте підключення не захищатиметься — ніби брандмауер для нього вимкнено.</p>`,
      buttons: [{ t: 'OK', v: 'ok', primary: true }, { t: 'Скасувати', v: null, cancel: true }],
      onButton: (v, api) => { if (v !== 'ok') return; c.ifaces = api.$$('[data-if]').filter(x => x.checked).map(x => x.dataset.if); dirty(); } });
  }
  subSettings(c, p, dirty) {
    const yn = (k, cur) => `<select class="inp" data-s="${k}"><option value="1" ${cur ? 'selected' : ''}>Так (за замовчуванням)</option><option value="0" ${cur ? '' : 'selected'}>Ні</option></select>`;
    modal({ title: `Налаштування параметрів для профілю: ${PROFILE_NAME[p]}`, cls: 'small', html: `<fieldset><legend>Параметри брандмауера</legend><p class="muted">Чи показувати сповіщення, коли програмі заблоковано вхідні підключення.</p><div class="pg"><label>Показувати сповіщення:</label>${yn('notify', c.notify)}</div></fieldset>
      <fieldset><legend>Одноадресна відповідь</legend><p class="muted">Чи дозволяти відповідь на розсилку (наприклад, коли комп’ютер шукає DHCP-сервер).</p><div class="pg"><label>Дозволити одноадресну відповідь:</label>${yn('unicast', c.unicast)}</div></fieldset>
      <fieldset><legend>Об’єднання правил</legend><p class="muted">Чи застосовувати правила, які створив локальний адміністратор, разом із правилами групової політики.</p><div class="pg"><label>Застосовувати локальні правила:</label>${yn('localRules', c.localRules)}</div></fieldset>`,
      buttons: [{ t: 'OK', v: 'ok', primary: true }, { t: 'Скасувати', v: null, cancel: true }],
      onButton: (v, api) => { if (v !== 'ok') return; for (const k of ['notify', 'unicast', 'localRules']) c[k] = api.$(`[data-s="${k}"]`).value === '1'; dirty(); } });
  }
  subLog(c, p, dirty) {
    const yn = (k, cur) => `<select class="inp" data-l="${k}"><option value="0" ${cur ? '' : 'selected'}>Ні (за замовчуванням)</option><option value="1" ${cur ? 'selected' : ''}>Так</option></select>`;
    modal({ title: `Налаштування журналу для профілю: ${PROFILE_NAME[p]}`, cls: 'small', html: `<fieldset><legend>Ім’я файлу</legend><p class="path-ro">${esc(c.log.path)}</p></fieldset>
      <fieldset><legend>Обмеження розміру (КБ)</legend><div class="pg"><label>Обмеження розміру:</label><input class="inp" type="number" min="1" max="32767" data-l="size" value="${c.log.size}"></div></fieldset>
      <fieldset><legend>Записувати пропущені пакети</legend><div class="pg"><label>Пропущені пакети:</label>${yn('dropped', c.log.dropped)}</div></fieldset>
      <fieldset><legend>Записувати успішні підключення</legend><div class="pg"><label>Успішні підключення:</label>${yn('success', c.log.success)}</div></fieldset>
      <p class="hint muted">Журнал — текстовий файл, куди брандмауер записує кожне підключення: час, дію (ALLOW — пропущено, DROP — заблоковано), протокол і адреси. Його можна відкрити в Блокноті.</p>`,
      buttons: [{ t: 'OK', v: 'ok', primary: true }, { t: 'Скасувати', v: null, cancel: true }],
      onButton: (v, api) => {
        if (v !== 'ok') return;
        const size = +api.$('[data-l="size"]').value;
        if (!Number.isInteger(size) || size < 1 || size > 32767) { alertBox('Розмір журналу — ціле число від 1 до 32767 КБ.', 'Журнал', 'warn'); return false; }
        c.log.size = size; c.log.dropped = api.$('[data-l="dropped"]').value === '1'; c.log.success = api.$('[data-l="success"]').value === '1'; dirty();
      } });
  }
  logSettings(p) {
    const fw = this.fw, c = clone(fw.profiles[p]);
    this.subLog(c, p, () => { fw.profiles[p].log = c.log; this.changed(); });
  }

  /* ═════════ Правила безпеки підключень ═════════ */
  csrWizard() {
    const fw = this.fw, d = { kind: 'isolation', req: 'request', auth: 'default', profiles: ['domain', 'private', 'public'], name: '', desc: '', ep: '' };
    const STEPS = { isolation: ['kind', 'req', 'auth', 'profile', 'name'], exempt: ['kind', 'ep', 'profile', 'name'], s2s: ['kind', 'ep', 'req', 'auth', 'profile', 'name'] };
    const TT = { kind: 'Тип правила', req: 'Вимоги', auth: 'Метод автентифікації', profile: 'Профіль', name: 'Ім’я', ep: 'Кінцеві точки' };
    let i = 0;
    const st = () => STEPS[d.kind];
    const r = (n, v, cur, t, sub = '') => `<label class="rad big"><input type="radio" name="${n}" value="${v}" ${cur === v ? 'checked' : ''}><span><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</span></label>`;
    const body = () => ({
      kind: `<p>Яке правило безпеки підключень потрібно створити?</p>${r('kind', 'isolation', d.kind, 'Ізоляція', 'Обмежити підключення на основі перевірки: з цим комп’ютером спілкуються лише перевірені комп’ютери.')}${r('kind', 'exempt', d.kind, 'Звільнення від автентифікації', 'Указані комп’ютери (наприклад, принтер чи шлюз) не потребують перевірки.')}${r('kind', 's2s', d.kind, 'Сервер-сервер', 'Перевірка підключень між певними комп’ютерами.')}`,
      req: `<p>Коли потрібна автентифікація?</p>${r('req', 'request', d.req, 'Запитувати автентифікацію для вхідних і вихідних підключень', 'Якщо перевірка не вдалася — підключення все одно дозволяється.')}${r('req', 'require-in', d.req, 'Вимагати автентифікацію для вхідних підключень і запитувати для вихідних')}${r('req', 'require', d.req, 'Вимагати автентифікацію для вхідних і вихідних підключень', 'Без успішної перевірки підключення не відбудеться.')}`,
      auth: `<p>Який метод автентифікації використовувати?</p>${r('auth', 'default', d.auth, 'За замовчуванням', 'Як указано на вкладці «Параметри IPsec» у властивостях брандмауера.')}${r('auth', 'kerberos', d.auth, 'Комп’ютер і користувач (Kerberos V5)')}${r('auth', 'cert', d.auth, 'Сертифікат комп’ютера')}`,
      ep: `<label class="fld col">Комп’ютери (IP-адреси через кому):<input class="inp" data-ep value="${esc(d.ep)}" placeholder="наприклад 192.168.1.1, 192.168.1.20-192.168.1.40" spellcheck="false"></label><p class="hint muted">Можна вказати адреси, підмережі, діапазони або слова LocalSubnet, DNS, DHCP, DefaultGateway.</p>`,
      profile: PROFILES.map(p => `<label class="chk big"><input type="checkbox" data-prof="${p}" ${d.profiles.includes(p) ? 'checked' : ''}><span><b>${PROFILE_NAME[p]}</b></span></label>`).join(''),
      name: `<label class="fld col">Ім’я:<input class="inp" data-n value="${esc(d.name)}" spellcheck="false" autofocus></label><label class="fld col">Опис (необов’язково):<textarea class="inp" data-ds rows="3">${esc(d.desc)}</textarea></label>`,
    }[st()[i]]);
    const render = api => { api.$('.wz-steps').innerHTML = `<h5>Кроки:</h5>${st().map((s, j) => `<span class="${j === i ? 'on' : j < i ? 'done' : ''}">${TT[s]}</span>`).join('')}`; api.$('.wz-head').innerHTML = `<b>${TT[st()[i]]}</b><small>Правило безпеки підключень визначає, як і коли комп’ютери перевіряють один одного.</small>`; api.$('.wz-body').innerHTML = body(); api.button(0).disabled = !i; api.button(1).textContent = i === st().length - 1 ? 'Готово' : 'Далі >'; setTimeout(() => api.$('.wz-body [autofocus]')?.focus(), 20); };
    const read = api => { const s = st()[i], v = n => api.$(`.wz-body input[name="${n}"]:checked`)?.value;
      if (s === 'kind') d.kind = v('kind'); if (s === 'req') d.req = v('req'); if (s === 'auth') d.auth = v('auth');
      if (s === 'ep') d.ep = api.$('[data-ep]').value.trim(); if (s === 'profile') d.profiles = api.$$('[data-prof]').filter(x => x.checked).map(x => x.dataset.prof);
      if (s === 'name') { d.name = api.$('[data-n]').value.trim(); d.desc = api.$('[data-ds]').value.trim(); } };
    const check = () => { const s = st()[i], bad = t => { alertBox(t, 'Майстер створення правила безпеки підключень', 'warn'); return false; };
      if (s === 'ep') { const l = d.ep.split(/[,\s]+/).filter(Boolean); if (!l.length) return bad('Укажіть хоча б один комп’ютер.'); const w = l.find(a => !validAddr(a)); if (w) return bad(`«${w}» — неправильна IP-адреса.`); }
      if (s === 'profile' && !d.profiles.length) return bad('Виберіть хоча б один профіль.');
      if (s === 'name' && !d.name) return bad('Укажіть ім’я правила.'); return true; };
    modal({ title: 'Майстер створення правила безпеки підключень', cls: 'wiz', html: '<header class="wz-head"></header><div class="wz-main"><nav class="wz-steps"></nav><div class="wz-body"></div></div>',
      buttons: [{ t: '< Назад', v: 'back' }, { t: 'Далі >', v: 'next', primary: true }, { t: 'Скасувати', v: null, cancel: true }],
      onOpen: api => { render(api); api.el.addEventListener('change', e => { if (e.target.name === 'kind') { read(api); render(api); } }); },
      onButton: (v, api) => {
        if (v === null) return; read(api);
        if (v === 'back') { i = Math.max(0, i - 1); render(api); return false; }
        if (!check()) return false;
        if (i < st().length - 1) { i++; render(api); return false; }
        const eps = d.ep.split(/[,\s]+/).filter(Boolean);
        const rule = { id: newId(fw), name: d.name, desc: d.desc, enabled: true, kind: d.kind, req: d.kind === 'exempt' ? 'exempt' : d.req, auth: d.auth, ep1: d.kind === 'isolation' ? 'any' : [NET.ip], ep2: d.kind === 'isolation' ? 'any' : eps, profiles: d.profiles.length === 3 ? 'any' : d.profiles };
        fw.csr.push(rule); this.sel = new Set([rule.id]); this.changed(); this.sys.toast(`Правило «${rule.name}» створено`);
      } });
  }
  csrProps(r) {
    if (!r) return;
    modal({ title: `Властивості: ${r.name}`, cls: 'rprops small', html: tabs([['g', 'Загальні', `<fieldset><legend>Загальні</legend><div class="pg"><label>Ім’я:</label><input class="inp" data-n value="${esc(r.name)}" spellcheck="false"><label>Опис:</label><textarea class="inp" data-ds rows="3">${esc(r.desc)}</textarea></div><label class="chk"><input type="checkbox" data-en ${r.enabled ? 'checked' : ''}> Увімкнено</label></fieldset>`],
      ['a', 'Автентифікація', `<fieldset><legend>Вимоги</legend><select class="inp" data-req ${r.req === 'exempt' ? 'disabled' : ''}>${Object.entries(CSR_REQ).filter(([k]) => r.req === 'exempt' || k !== 'exempt').map(([k, t]) => `<option value="${k}" ${r.req === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></fieldset>`]]),
      buttons: [{ t: 'OK', v: 'ok', primary: true }, { t: 'Скасувати', v: null, cancel: true }],
      onButton: (v, api) => { if (v !== 'ok') return; const n = api.$('[data-n]').value.trim(); if (!n) { alertBox('Укажіть ім’я правила.', 'Властивості', 'warn'); return false; } r.name = n; r.desc = api.$('[data-ds]').value; r.enabled = api.$('[data-en]').checked; if (r.req !== 'exempt') r.req = api.$('[data-req]').value; this.changed(); } });
  }
}
const CSR_REQ = { request: 'Запитувати вхідні й вихідні', 'require-in': 'Вимагати вхідні, запитувати вихідні', require: 'Вимагати вхідні й вихідні', exempt: 'Не автентифікувати' };
