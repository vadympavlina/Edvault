// Емулятор Windows · Браузер: вкладки, адресний рядок, історія, закладки, завантаження, сторінки помилок мережі.
// Сайти — у sites.js, вебінтерфейс роутера — у router.js. Перевірка мережі — за справжніми правилами брандмауера.
import { fwOf, evaluate, record, NET, PROGRAMS } from './fw.js';
import { SITES, resolveSite } from './cmd.js';
import { HOME, fmtSize, fmtDate, fmtTime } from './fs.js';
import { appIcon, ui } from './icons.js';
import { WM, dialog, alertBox, menu, esc, modal } from './ui.js';
import { sitePage, EDU_SITES, FAVICON } from './sites.js';
import { routerPage, ROUTER_HOSTS, rstate } from './router.js';

const DL = HOME + '\\Downloads';
const NEWTAB = 'browser://newtab/';
const SEARCH = q => 'https://poshuk.edvault/search?q=' + encodeURIComponent(q);
const lc = s => s.toLocaleLowerCase('uk');
// стан браузера зберігається разом із файлами (і скидається разом із ПК)
export function bstate(fs) { return fs.s.browser ||= { history: [], bookmarks: [{ url: 'https://poshuk.edvault/', title: 'Пошук' }, { url: 'https://shkola.edvault/', title: 'Школа №1' }, { url: 'https://novyny.edvault/', title: 'Новини' }, { url: 'http://192.168.1.1/', title: 'Роутер' }], downloads: [], zoom: 100 }; }
const isIp = h => /^\d{1,3}(\.\d{1,3}){3}$/.test(h);
let tabSeq = 0;

// Що ввели в адресний рядок: адреса чи пошуковий запит
export function normalize(input) {
  const t = String(input || '').trim();
  if (!t) return null;
  if (/^browser:\/\//i.test(t)) return new URL(t.toLowerCase().replace(/\/?$/, '/'));
  if (/^https?:\/\//i.test(t)) { try { return new URL(t); } catch (e) { return new URL(SEARCH(t)); } }
  const host = t.split(/[/?#]/)[0];
  if (!/\s/.test(t) && (isIp(host.split(':')[0]) || /^localhost(:\d+)?$/i.test(host) || /^[\p{L}\d-]+(\.[\p{L}\d-]+)+(:\d+)?$/u.test(host))) {
    try { return new URL((isIp(host.split(':')[0]) || ROUTER_HOSTS.includes(lc(host)) ? 'http://' : 'https://') + t); } catch (e) { /* запит */ }
  }
  return new URL(SEARCH(t));
}
const shown = u => u.protocol === 'browser:' ? u.href.replace(/\/$/, '') : decodeURI(u.href).replace(/^https?:\/\//, m => m === 'https://' ? 'https://' : 'http://').replace(/\/$/, '');

export class Browser {
  constructor(sys, input) {
    this.sys = sys; this.fs = sys.fs; this.tabs = []; this.cur = null;
    this.win = WM.open({ app: 'browser', exe: 'browser.exe', title: 'Браузер', icon: appIcon('browser', 16), w: 1180, h: 700, minW: 620, minH: 380 });
    this.win.body.innerHTML = `<div class="bw" tabindex="-1">
      <div class="bw-tabs"><div class="bw-tl"></div><button class="bw-new" data-b="newtab" title="Нова вкладка (Ctrl+T)">${ui('plus', 16)}</button></div>
      <div class="bw-bar"><button class="nb" data-b="back" title="Назад (Alt+←)">${ui('back')}</button><button class="nb" data-b="fwd" title="Вперед (Alt+→)">${ui('forward')}</button><button class="nb" data-b="reload" title="Оновити (F5)">${ui('refresh')}</button><button class="nb" data-b="home" title="Головна сторінка">${ui('home')}</button>
        <label class="bw-addr"><button class="bw-sec" data-b="site" title="Відомості про сайт"></button><input class="bw-in" spellcheck="false" autocomplete="off" placeholder="Введіть адресу або пошуковий запит"><button class="bw-star" data-b="star" title="Додати в закладки (Ctrl+D)">${ui('star', 16)}</button></label>
        <button class="nb bw-dl" data-b="downloads" title="Завантаження (Ctrl+J)">${ui('download')}<i class="bw-dot" hidden></i></button><button class="nb" data-b="menu" title="Параметри й інше">${ui('more')}</button></div>
      <div class="bw-marks"></div><div class="bw-progress"><i></i></div>
      <div class="bw-view"></div></div>`;
    this.$ = s => this.win.body.querySelector(s);
    this.bind();
    this.unsub = this.fs.on(w => { if (w === 'reset') { this.renderMarks(); } if (w === 'router' && this.active()?.url?.includes('192.168.1.1')) { /* сторінка роутера сама оновлюється */ } });
    const close = this.win.close; this.win.close = f => { this.unsub(); return close(f); };
    this.newTab(input ? (normalize(input)?.href || NEWTAB) : NEWTAB);
    this.renderMarks();
  }
  get S() { return bstate(this.fs); }
  active() { return this.tabs.find(t => t.id === this.cur); }

  /* ── вкладки ── */
  newTab(url = NEWTAB, focus = true) {
    const t = { id: ++tabSeq, url: null, title: 'Нова вкладка', hist: [], hi: -1, view: document.createElement('div') };
    t.view.className = 'bw-page';
    this.tabs.push(t);
    this.$('.bw-view').appendChild(t.view);
    if (focus) this.select(t.id);
    this.load(t, url);
    if (url === NEWTAB && focus) setTimeout(() => this.$('.bw-in').focus(), 30);
    return t;
  }
  select(id) { this.cur = id; for (const t of this.tabs) t.view.hidden = t.id !== id; this.renderChrome(); }
  closeTab(id) {
    const i = this.tabs.findIndex(t => t.id === id); if (i < 0) return;
    const [t] = this.tabs.splice(i, 1); t.view.remove(); t.dispose?.();
    if (!this.tabs.length) return this.win.close();
    if (this.cur === id) this.select(this.tabs[Math.min(i, this.tabs.length - 1)].id); else this.renderChrome();
  }

  /* ── навігація ── */
  go(input, { tab = this.active(), newTab = false } = {}) {
    const u = normalize(input); if (!u) return;
    if (newTab) return this.newTab(u.href, true);
    this.load(tab, u.href);
  }
  async load(tab, href, { push = true } = {}) {
    const u = new URL(href);
    tab.loading = true; tab.dispose?.(); tab.dispose = null;
    if (push) { tab.hist = tab.hist.slice(0, tab.hi + 1); tab.hist.push(u.href); tab.hi = tab.hist.length - 1; }
    tab.url = u.href; tab.title = u.protocol === 'browser:' ? 'Нова вкладка' : u.hostname; tab.secure = null;
    this.renderChrome();
    if (u.protocol !== 'browser:') await new Promise(r => setTimeout(r, 220 + Math.random() * 260));
    if (tab.url !== u.href || !this.win.el.isConnected) return;
    const page = this.resolve(u, tab);
    tab.loading = false; tab.title = page.title || u.hostname; tab.secure = page.secure ?? (u.protocol === 'https:' ? 'https' : u.protocol === 'http:' ? 'http' : 'internal'); tab.error = !!page.error; tab.danger = page.danger;
    tab.view.innerHTML = page.html;
    tab.view.scrollTop = 0;
    tab.view.style.zoom = this.S.zoom === 100 ? '' : this.S.zoom / 100;
    const disp = page.bind?.(tab.view, this.ctx(tab, u)); tab.dispose = typeof disp === 'function' ? disp : null;
    if (!page.error && u.protocol !== 'browser:') { const H = this.S.history; H.unshift({ url: u.href, title: tab.title, at: Date.now() }); H.length = Math.min(H.length, 300); this.sys.saveSettings?.(); this.fs.emit('browser'); }
    this.renderChrome();
  }
  ctx(tab, u) {
    return {
      sys: this.sys, fs: this.fs, url: u, browser: this, tab,
      nav: (href, o = {}) => { const to = new URL(href, u).href; if (o.newTab) this.newTab(to, false); else this.load(tab, to); },
      reload: () => this.load(tab, tab.url, { push: false }),
      setTitle: t => { tab.title = t; this.renderChrome(); },
      download: f => this.download(f, u),
      toast: m => this.sys.toast(m),
    };
  }
  // мережа: DNS → брандмауер → чи є там сервер
  resolve(u, tab) {
    if (u.protocol === 'browser:') return this.internal(u);
    const host = lc(u.hostname), fw = fwOf(this.fs);
    const port = +u.port || (u.protocol === 'https:' ? 443 : 80);
    let ip = isIp(host) ? host : null;
    if (!ip) {
      if (host === 'localhost') ip = '127.0.0.1';
      else {
        const dnsPkt = { dir: 'out', protocol: 'UDP', localPort: 53000 + (Date.now() % 900), remotePort: 53, remoteIp: NET.dns, program: PROGRAMS.svchost };
        const d = evaluate(fw, dnsPkt); record(this.fs, dnsPkt, d);
        if (!d.allow || this.sys.procs?.services?.Dnscache === false) return errorPage('ERR_NAME_NOT_RESOLVED', host, d.allow ? 'dnsSvc' : 'dnsFw');
        ip = ROUTER_HOSTS.includes(host) ? rstate(this.fs).lan.ip : EDU_SITES[host]?.ip || (SITES[host] || resolveSite(host))?.[0];
        if (!ip) return errorPage('ERR_NAME_NOT_RESOLVED', host);
      }
    }
    if (ip === '127.0.0.1' || ip === NET.ip) return errorPage('ERR_CONNECTION_REFUSED', u.host, 'self');
    const pkt = { dir: 'out', protocol: 'TCP', localPort: 50000 + (Date.now() % 9000), remotePort: port, remoteIp: ip, program: PROGRAMS.browser };
    const r = evaluate(fw, pkt); record(this.fs, pkt, r);
    if (!r.allow) return errorPage('ERR_NETWORK_ACCESS_DENIED', u.host, r.rule ? r.rule.name.trim() : r.why);
    // локальна мережа: роутер відповідає за своєю адресою LAN (її можна змінити в налаштуваннях роутера)
    if (ip === rstate(this.fs).lan.ip) return port === 80 || port === 443 ? routerPage(u, this.ctx(tab, u)) : errorPage('ERR_CONNECTION_REFUSED', u.host);
    if (/^192\.168\.1\.\d+$/.test(ip)) return ip === NET.dns ? errorPage('ERR_CONNECTION_REFUSED', u.host, 'server') : errorPage('ERR_CONNECTION_TIMED_OUT', u.host, 'lan');
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) return errorPage('ERR_CONNECTION_TIMED_OUT', u.host, 'other');
    const site = sitePage(u, this.ctx(tab, u));
    if (site) return site;
    return offlinePage(u);
  }

  /* ── внутрішні сторінки ── */
  internal(u) {
    const S = this.S, k = u.hostname;
    if (k === 'newtab') {
      const tiles = S.bookmarks.slice(0, 8);
      return { title: 'Нова вкладка', html: `<div class="nt"><div class="nt-logo">${appIcon('browser', 56)}<b>Браузер</b></div>
        <form class="nt-search" data-search>${ui('search', 18)}<input name="q" placeholder="Пошук або адреса сайту" autocomplete="off" spellcheck="false"></form>
        <div class="nt-tiles">${tiles.map(b => `<a class="nt-t" href="${esc(b.url)}"><span>${favicon(b.url, 28)}</span><small>${esc(b.title)}</small></a>`).join('')}</div>
        <p class="nt-tip">${ui('info', 15)}Це навчальний браузер. Спробуйте відкрити налаштування роутера: <a href="http://192.168.1.1/">192.168.1.1</a></p></div>`,
        bind: el => { const f = el.querySelector('[data-search]'); f.addEventListener('submit', e => { e.preventDefault(); this.go(f.q.value); }); } };
    }
    if (k === 'history') {
      const days = new Map();
      for (const [i, h] of S.history.entries()) { const d = fmtDate(h.at); if (!days.has(d)) days.set(d, []); days.get(d).push([i, h]); }
      return { title: 'Історія', html: `<div class="ip"><h1>${ui('history', 26)} Історія</h1><div class="ip-bar"><span class="grow"></span><button class="btn" data-clear ${S.history.length ? '' : 'disabled'}>Очистити історію</button></div>
        ${S.history.length ? [...days].map(([d, list]) => `<h3>${d === fmtDate(Date.now()) ? 'Сьогодні' : d}</h3><div class="ip-list">${list.map(([i, h]) => `<div class="ip-row"><small>${fmtTime(h.at)}</small>${favicon(h.url, 16)}<a href="${esc(h.url)}">${esc(h.title)}</a><span class="ip-url">${esc(shown(new URL(h.url)))}</span><button class="nb" data-del="${i}" title="Видалити з історії">${ui('close', 14)}</button></div>`).join('')}</div>`).join('') : '<p class="ip-empty">Тут з’являтимуться сторінки, які ви відкривали.</p>'}</div>`,
        bind: (el, ctx) => el.addEventListener('click', e => { const d = e.target.closest('[data-del]'); if (d) { S.history.splice(+d.dataset.del, 1); this.fs.emit('browser'); ctx.reload(); } if (e.target.closest('[data-clear]')) { S.history.length = 0; this.fs.emit('browser'); ctx.reload(); } }) };
    }
    if (k === 'downloads') {
      return { title: 'Завантаження', html: `<div class="ip"><h1>${ui('download', 26)} Завантаження</h1>${S.downloads.length ? `<div class="ip-list">${S.downloads.map((d, i) => `<div class="dl-row">${ui('file', 26)}<div><b>${esc(d.name)}</b><small>${esc(d.from)} · ${fmtSize(d.size)} · ${d.state === 'done' ? (this.fs.node(d.path) ? 'Готово' : 'Файл видалено') : d.state === 'blocked' ? 'Заблоковано: файл може бути небезпечним' : 'Завантаження…'}</small></div>
        ${d.state === 'done' && this.fs.node(d.path) ? `<button class="btn" data-open="${i}">Відкрити</button><button class="btn" data-folder="${i}">Показати в папці</button>` : ''}<button class="nb" data-rm="${i}" title="Прибрати зі списку">${ui('close', 14)}</button></div>`).join('')}</div>` : '<p class="ip-empty">Ви ще нічого не завантажували. Спробуйте сайт <a href="https://fayly.edvault/">fayly.edvault</a>.</p>'}</div>`,
        bind: (el, ctx) => el.addEventListener('click', e => {
          const o = e.target.closest('[data-open]'), f = e.target.closest('[data-folder]'), r = e.target.closest('[data-rm]');
          if (o) this.sys.openFile(S.downloads[+o.dataset.open].path);
          if (f) this.sys.showInFolder(S.downloads[+f.dataset.folder].path);
          if (r) { S.downloads.splice(+r.dataset.rm, 1); this.fs.emit('browser'); ctx.reload(); }
        }) };
    }
    if (k === 'bookmarks') {
      return { title: 'Закладки', html: `<div class="ip"><h1>${ui('star', 26)} Закладки</h1>${S.bookmarks.length ? `<div class="ip-list">${S.bookmarks.map((b, i) => `<div class="ip-row">${favicon(b.url, 16)}<a href="${esc(b.url)}">${esc(b.title)}</a><span class="ip-url">${esc(shown(new URL(b.url)))}</span><button class="nb" data-ren="${i}" title="Перейменувати">${ui('rename', 14)}</button><button class="nb" data-del="${i}" title="Видалити">${ui('trash', 14)}</button></div>`).join('')}</div>` : '<p class="ip-empty">Закладок немає. Натисніть зірочку в адресному рядку, щоб додати сторінку.</p>'}</div>`,
        bind: (el, ctx) => el.addEventListener('click', e => {
          const d = e.target.closest('[data-del]'), r = e.target.closest('[data-ren]');
          if (d) { S.bookmarks.splice(+d.dataset.del, 1); this.fs.emit('browser'); this.renderMarks(); ctx.reload(); }
          if (r) this.editMark(S.bookmarks[+r.dataset.ren], () => ctx.reload());
        }) };
    }
    return errorPage('ERR_INVALID_URL', u.href);
  }

  /* ── завантаження ── */
  async download({ name, size, content, danger }, from) {
    const S = this.S;
    if (danger) {
      const keep = await dialog({ title: 'Завантаження', icon: 'warn', html: `<p><b>${esc(name)}</b> — цей тип файлу може зашкодити комп’ютеру.</p><p>Програми (.exe) з незнайомих сайтів часто бувають вірусами. Зберегти все одно?</p>`, buttons: [{ t: 'Видалити', v: false, primary: true, cancel: true }, { t: 'Зберегти', v: true }] });
      if (!keep) { S.downloads.unshift({ name, size, from: from.hostname, at: Date.now(), state: 'blocked', path: null }); this.fs.emit('browser'); this.sys.toast('Завантаження скасовано'); return; }
    }
    const fs = this.fs, parent = fs.node(DL);
    const fname = fs.freeName(parent, name), path = DL + '\\' + fname;
    const d = { name: fname, size, from: from.hostname, at: Date.now(), state: 'progress', path, pct: 0 };
    S.downloads.unshift(d); this.flyout(true);
    const steps = 8;
    for (let i = 1; i <= steps; i++) { await new Promise(r => setTimeout(r, 140)); d.pct = i / steps; this.flyout(); }
    if (content != null) fs.writeFile(path, content); else { fs.writeFile(path, ''); const n = fs.node(path); n.binary = true; n.size = size; delete n.content; fs.emit('write'); }
    d.state = 'done'; delete d.pct; fs.emit('browser'); this.flyout();
    this.$('.bw-dot').hidden = false;
  }
  flyout(open) {
    let f = this.$('.bw-fly');
    if (!f && !open) return;
    if (!f) { f = document.createElement('div'); f.className = 'bw-fly'; this.win.body.querySelector('.bw').appendChild(f); }
    const list = this.S.downloads.slice(0, 5);
    f.innerHTML = `<header><b>Завантаження</b><button class="nb" data-b="downloads-page" title="Відкрити сторінку завантажень">${ui('open', 15)}</button><button class="nb" data-b="fly-close" title="Закрити">${ui('close', 15)}</button></header>
      ${list.length ? list.map((d, i) => `<div class="fl-row">${ui('file', 22)}<div><b>${esc(d.name)}</b>${d.state === 'progress' ? `<i class="fl-bar"><i style="width:${Math.round(d.pct * 100)}%"></i></i><small>${fmtSize(d.size * d.pct)} з ${fmtSize(d.size)}</small>` : `<small>${d.state === 'blocked' ? 'Заблоковано' : fmtSize(d.size) + ' · Готово'}</small>`}</div>${d.state === 'done' ? `<button class="nb" data-fopen="${i}" title="Відкрити">${ui('open', 15)}</button><button class="nb" data-ffolder="${i}" title="Показати в папці">${ui('folderPlus', 15)}</button>` : ''}</div>`).join('') : '<p class="ip-empty">Немає завантажень.</p>'}`;
  }

  /* ── відмальовування ── */
  renderChrome() {
    if (!this.win.el.isConnected) return;
    const t = this.active();
    this.$('.bw-tl').innerHTML = this.tabs.map(x => `<div class="bw-tab${x.id === this.cur ? ' on' : ''}" data-tab="${x.id}" title="${esc(x.title)}">${x.loading ? '<i class="bw-spin"></i>' : x.url ? favicon(x.url, 16) : ui('globe', 15)}<span>${esc(x.title)}</span><button class="bw-x" data-close="${x.id}" title="Закрити вкладку (Ctrl+W)">${ui('close', 13)}</button></div>`).join('');
    this.win.setTitle(`${t?.title || 'Нова вкладка'} — Браузер`);
    if (!t) return;
    const inp = this.$('.bw-in');
    const u = t.url ? new URL(t.url) : null;
    if (document.activeElement !== inp) inp.value = !u || t.url === NEWTAB ? '' : shown(u);
    this.$('[data-b="back"]').disabled = t.hi <= 0;
    this.$('[data-b="fwd"]').disabled = t.hi >= t.hist.length - 1;
    this.$('[data-b="reload"]').innerHTML = t.loading ? ui('close') : ui('refresh');
    this.$('[data-b="reload"]').title = t.loading ? 'Зупинити' : 'Оновити (F5)';
    const sec = this.$('.bw-sec');
    const s = t.loading ? null : t.secure;
    sec.className = 'bw-sec ' + (s || '');
    sec.innerHTML = s === 'https' ? ui('lock', 14) : s === 'http' ? `${ui('warn', 14)}<span>Не захищено</span>` : s === 'danger' ? `${ui('warn', 14)}<span>Небезпечно</span>` : s === 'internal' ? ui('globe', 14) : ui('info', 14);
    const marked = u && this.S.bookmarks.some(b => b.url === t.url);
    this.$('.bw-star').classList.toggle('on', !!marked);
    this.$('.bw-progress').classList.toggle('on', !!t.loading);
  }
  renderMarks() {
    this.$('.bw-marks').innerHTML = this.S.bookmarks.map((b, i) => `<a class="bm" href="${esc(b.url)}" data-bm="${i}" title="${esc(b.title)}\n${esc(b.url)}">${favicon(b.url, 16)}<span>${esc(b.title)}</span></a>`).join('') || '<span class="bm-empty">Щоб додати закладку, натисніть зірочку в адресному рядку.</span>';
  }
  editMark(b, done) {
    modal({ title: 'Закладку додано', cls: 'small', html: `<label class="fld">Назва: <input class="inp" data-t value="${esc(b.title)}" spellcheck="false"></label><label class="fld">Адреса: <input class="inp" value="${esc(b.url)}" disabled></label>`,
      buttons: [{ t: 'Готово', v: 'ok', primary: true }, { t: 'Видалити', v: 'del' }],
      onOpen: api => setTimeout(() => { api.$('[data-t]').focus(); api.$('[data-t]').select(); }, 30),
      onButton: (v, api) => { const S = this.S; if (v === 'del') S.bookmarks.splice(S.bookmarks.indexOf(b), 1); else if (v === 'ok') b.title = api.$('[data-t]').value.trim() || b.title; this.fs.emit('browser'); this.renderMarks(); this.renderChrome(); done?.(); } });
  }

  /* ── події ── */
  bind() {
    const b = this.win.body, inp = this.$('.bw-in');
    b.addEventListener('pointerdown', e => { const f = this.$('.bw-fly'); if (f && !e.target.closest('.bw-fly, [data-b="downloads"]')) f.remove(); });
    b.addEventListener('click', e => {
      const x = e.target.closest('[data-close]'); if (x) return this.closeTab(+x.dataset.close);
      const tb = e.target.closest('[data-tab]'); if (tb) return this.select(+tb.dataset.tab);
      const fo = e.target.closest('[data-fopen]'); if (fo) return this.sys.openFile(this.S.downloads[+fo.dataset.fopen].path);
      const ff = e.target.closest('[data-ffolder]'); if (ff) return this.sys.showInFolder(this.S.downloads[+ff.dataset.ffolder].path);
      const bt = e.target.closest('[data-b]'); if (bt && !bt.disabled) return this.cmd(bt.dataset.b, bt);
      // посилання на сторінках і в закладках
      const a = e.target.closest('a[href]');
      if (a && a.closest('.bw')) {
        e.preventDefault();
        const t = this.active(), base = t?.url ? new URL(t.url) : new URL(NEWTAB);
        const href = new URL(a.getAttribute('href'), base).href;
        if (e.ctrlKey || a.target === '_blank') this.newTab(href, !!a.target && !e.ctrlKey); else this.load(t, href);
      }
    });
    b.addEventListener('auxclick', e => { if (e.button === 1) { const a = e.target.closest('a[href]'); if (a) { e.preventDefault(); this.newTab(new URL(a.getAttribute('href'), this.active().url).href, false); } const tb = e.target.closest('[data-tab]'); if (tb) this.closeTab(+tb.dataset.tab); } });
    // форми з method=get на сайтах — звичайний перехід за адресою
    b.addEventListener('submit', e => {
      const f = e.target; if (e.defaultPrevented || !f.closest('.bw-page') || f.dataset.js != null) return;
      e.preventDefault();
      const t = this.active(), u = new URL(f.getAttribute('action') || t.url, t.url);
      u.search = new URLSearchParams(new FormData(f)).toString();
      this.load(t, u.href);
    });
    b.addEventListener('contextmenu', e => {
      if (e.target.closest('input, textarea')) return;
      const a = e.target.closest('.bw-page a[href], .bw-marks a[href]'), tb = e.target.closest('[data-tab]');
      if (!a && !tb && !e.target.closest('.bw-page')) return;
      e.preventDefault();
      if (tb) { const id = +tb.dataset.tab; return menu(e.clientX, e.clientY, [{ t: 'Нова вкладка', icon: 'plus', on: () => this.newTab() }, { t: 'Оновити', icon: 'refresh', on: () => { this.select(id); this.cmd('reload'); } }, { t: 'Дублювати', icon: 'copy', on: () => this.newTab(this.tabs.find(x => x.id === id).url) }, '-', { t: 'Закрити вкладку', icon: 'close', on: () => this.closeTab(id) }, { t: 'Закрити інші вкладки', disabled: this.tabs.length < 2, on: () => this.tabs.filter(x => x.id !== id).forEach(x => this.closeTab(x.id)) }]); }
      if (a) { const href = new URL(a.getAttribute('href'), this.active().url).href, bm = a.dataset.bm != null ? +a.dataset.bm : null;
        return menu(e.clientX, e.clientY, [{ t: 'Відкрити посилання в новій вкладці', icon: 'plus', on: () => this.newTab(href, false) }, { t: 'Відкрити в новому вікні', icon: 'open', on: () => this.sys.open('browser', href) }, '-', { t: 'Копіювати адресу посилання', icon: 'link', on: () => { navigator.clipboard?.writeText(href).catch(() => {}); this.sys.toast('Адресу скопійовано'); } },
          bm != null && '-', bm != null && { t: 'Змінити закладку…', icon: 'rename', on: () => this.editMark(this.S.bookmarks[bm]) }, bm != null && { t: 'Видалити закладку', icon: 'trash', on: () => { this.S.bookmarks.splice(bm, 1); this.fs.emit('browser'); this.renderMarks(); this.renderChrome(); } }]); }
      menu(e.clientX, e.clientY, [{ t: 'Назад', icon: 'back', disabled: this.active().hi <= 0, on: () => this.cmd('back') }, { t: 'Вперед', icon: 'forward', disabled: this.active().hi >= this.active().hist.length - 1, on: () => this.cmd('fwd') }, { t: 'Оновити', icon: 'refresh', kbd: 'F5', on: () => this.cmd('reload') }, '-', { t: 'Додати в закладки', icon: 'star', kbd: 'Ctrl+D', on: () => this.cmd('star') }]);
    });
    inp.addEventListener('focus', () => { const t = this.active(); inp.value = t?.url && t.url !== NEWTAB ? decodeURI(t.url) : ''; inp.select(); });
    inp.addEventListener('mouseup', e => { if (inp.selectionStart === inp.selectionEnd && !inp.dataset.sel) { inp.dataset.sel = 1; e.preventDefault(); inp.select(); } });
    inp.addEventListener('blur', () => { delete inp.dataset.sel; });
    inp.addEventListener('blur', () => this.renderChrome());
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); const v = inp.value; inp.blur(); this.go(v, { newTab: e.altKey }); }
      if (e.key === 'Escape') { inp.blur(); this.$('.bw').focus(); }
    });
    b.addEventListener('keydown', e => {
      const k = e.key, ctrl = e.ctrlKey || e.metaKey;
      const typing = e.target.closest('input, textarea, select') && !e.target.classList.contains('bw-in');
      const map = ctrl ? { KeyT: 'newtab', KeyW: 'closetab', KeyL: 'focus', KeyH: 'history', KeyJ: 'downloads', KeyD: 'star', KeyR: 'reload', Equal: 'zoomin', Minus: 'zoomout', Digit0: 'zoom0', Tab: 'nexttab' }[e.code] : k === 'F5' ? 'reload' : e.altKey && k === 'ArrowLeft' ? 'back' : e.altKey && k === 'ArrowRight' ? 'fwd' : (k === 'Backspace' && !typing && !e.target.closest('input, textarea')) ? 'back' : null;
      if (!map || (typing && !ctrl && k !== 'F5')) return;
      e.preventDefault(); e.stopPropagation(); this.cmd(map);
    });
  }
  cmd(c, el) {
    const t = this.active(), S = this.S;
    switch (c) {
      case 'newtab': return this.newTab();
      case 'closetab': return this.closeTab(this.cur);
      case 'nexttab': { const i = this.tabs.indexOf(t); return this.select(this.tabs[(i + 1) % this.tabs.length].id); }
      case 'focus': return this.$('.bw-in').focus();
      case 'back': if (t.hi > 0) { t.hi--; this.load(t, t.hist[t.hi], { push: false }); } return;
      case 'fwd': if (t.hi < t.hist.length - 1) { t.hi++; this.load(t, t.hist[t.hi], { push: false }); } return;
      case 'reload': if (t.loading) { t.loading = false; t.url = t.hist[t.hi - 1] || t.url; this.renderChrome(); return; } return this.load(t, t.url, { push: false });
      case 'home': return this.load(t, NEWTAB);
      case 'history': return this.newTab('browser://history/');
      case 'downloads': this.$('.bw-dot').hidden = true; if (this.$('.bw-fly')) { this.$('.bw-fly').remove(); return; } return this.flyout(true);
      case 'downloads-page': this.$('.bw-fly')?.remove(); return this.newTab('browser://downloads/');
      case 'fly-close': return this.$('.bw-fly')?.remove();
      case 'star': {
        if (!t.url || t.url === NEWTAB || t.error) return;
        let b = S.bookmarks.find(x => x.url === t.url);
        if (!b) { b = { url: t.url, title: t.title }; S.bookmarks.push(b); this.fs.emit('browser'); this.renderMarks(); this.renderChrome(); }
        return this.editMark(b);
      }
      case 'zoomin': case 'zoomout': case 'zoom0': {
        const steps = [50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200], i = steps.indexOf(S.zoom);
        S.zoom = c === 'zoom0' ? 100 : steps[Math.max(0, Math.min(steps.length - 1, i + (c === 'zoomin' ? 1 : -1)))];
        this.tabs.forEach(x => { x.view.style.zoom = S.zoom === 100 ? '' : S.zoom / 100; }); this.fs.emit('browser'); return this.sys.toast(`Масштаб: ${S.zoom}%`);
      }
      case 'site': {
        const u = t.url && new URL(t.url); if (!u || u.protocol === 'browser:') return;
        const s = t.secure;
        return alertBox(s === 'https' ? `Підключення до ${u.hostname} захищене.\n\nДані між вами й сайтом шифруються (HTTPS) — сторонні люди в мережі не побачать, що ви вводите.` : s === 'http' ? `Підключення до ${u.hostname} не захищене.\n\nСайт працює через HTTP: дані передаються відкрито. Не вводьте тут паролі від важливих акаунтів.${u.hostname === '192.168.1.1' ? '\n\nДля роутера в домашній мережі це звично: сторінка відкривається лише всередині вашої мережі.' : ''}` : s === 'danger' ? 'Цей сайт позначено як небезпечний: він може красти паролі або дані карток.' : 'Відомостей про цей сайт немає.', u.hostname, s === 'https' ? 'info' : 'warn');
      }
      case 'menu': return menu(0, 0, [
        { t: 'Нова вкладка', icon: 'plus', kbd: 'Ctrl+T', on: () => this.newTab() }, { t: 'Нове вікно', icon: 'open', on: () => this.sys.open('browser') }, '-',
        { t: 'Історія', icon: 'history', kbd: 'Ctrl+H', on: () => this.cmd('history') }, { t: 'Завантаження', icon: 'download', kbd: 'Ctrl+J', on: () => this.cmd('downloads-page') }, { t: 'Закладки', icon: 'star', on: () => this.newTab('browser://bookmarks/') }, '-',
        { t: `Масштаб: ${S.zoom}%`, icon: 'zoomIn', sub: [{ t: 'Збільшити', kbd: 'Ctrl++', on: () => this.cmd('zoomin') }, { t: 'Зменшити', kbd: 'Ctrl+−', on: () => this.cmd('zoomout') }, { t: 'Скинути', kbd: 'Ctrl+0', on: () => this.cmd('zoom0') }] }, '-',
        { t: 'Очистити дані перегляду…', icon: 'trash', on: () => this.clearData() }, { t: 'Про браузер', icon: 'info', on: () => alertBox('Навчальний браузер Edvault.\n\nВідкриває навчальні сайти (*.edvault) і налаштування роутера за адресою 192.168.1.1. Справжній інтернет тут недоступний — так безпечно.', 'Про браузер', 'info') },
      ], { anchor: el });
    }
  }
  clearData() {
    modal({ title: 'Очистити дані перегляду', cls: 'small', html: `<label class="chk"><input type="checkbox" data-c="history" checked> Історія переглядів</label><label class="chk"><input type="checkbox" data-c="downloads" checked> Історія завантажень <small class="muted">(самі файли залишаться в папці «Завантаження»)</small></label><label class="chk"><input type="checkbox" data-c="cookies"> Файли cookie й інші дані сайтів <small class="muted">(вийдете з роутера й сайтів)</small></label>`,
      buttons: [{ t: 'Очистити дані', v: 'ok', primary: true }, { t: 'Скасувати', v: null, cancel: true }],
      onButton: (v, api) => { if (v !== 'ok') return; const S = this.S, on = k => api.$(`[data-c="${k}"]`).checked; if (on('history')) S.history.length = 0; if (on('downloads')) S.downloads.length = 0; if (on('cookies')) { this.sys.routerSession = null; } this.fs.emit('browser'); this.sys.toast('Дані перегляду очищено'); } });
  }
}

/* ── сторінки помилок ── */
const ERRS = {
  ERR_NAME_NOT_RESOLVED: (h, why) => [`Не вдалося знайти IP-адресу сервера ${h}.`, why === 'dnsFw' ? ['Брандмауер блокує запити до DNS-сервера. Перевірте правило «Основні мережеві засоби — DNS (UDP — вихідний)» у wf.msc.', 'Перевірте командою <code>nslookup ' + esc(h) + '</code>.'] : why === 'dnsSvc' ? ['Службу «DNS-клієнт» (Dnscache) зупинено. Запустіть її в Диспетчері завдань → «Служби».'] : ['Перевірте, чи правильно написано адресу.', 'Перевірте командою <code>nslookup ' + esc(h) + '</code>.', 'Пошукайте сайт у <a href="https://poshuk.edvault/">Пошуку</a>.']],
  ERR_NETWORK_ACCESS_DENIED: (h, why) => [`Доступ до мережі заборонено.`, [why && why !== 'default' && why !== 'blockall' ? `Підключення заблокувало правило брандмауера «${esc(why)}».` : 'Брандмауер не дозволяє браузеру виходити в мережу (вихідні підключення без правила заблоковано).', 'Відкрийте «Брандмауер Захисника Windows у режимі підвищеної безпеки» (wf.msc) → «Правила для вихідних підключень».', 'Спробуйте <code>curl ' + esc(h) + '</code> у Командному рядку — він теж перевіряє брандмауер.']],
  ERR_CONNECTION_TIMED_OUT: (h, why) => [`Сайт ${h} надто довго не відповідає.`, why === 'other' ? ['Такої адреси немає у вашій мережі.', 'Адресу роутера можна дізнатися командою <code>ipconfig</code> — рядок «Основний шлюз». У цій мережі це <a href="http://192.168.1.1/">192.168.1.1</a>.'] : ['Пристрій із цією адресою є в мережі, але на ньому немає вебсайту.', 'Перевірте зв’язок командою <code>ping ' + esc(h) + '</code>.']],
  ERR_CONNECTION_REFUSED: (h, why) => [`Сайт ${h} не дозволив підключитися.`, why === 'self' ? ['Це адреса вашого власного комп’ютера, а на ньому не запущено вебсервер.'] : why === 'server' ? ['Це шкільний DNS-сервер: він відповідає на запити про імена сайтів, але вебсторінок не має.'] : ['На цьому порту немає вебсервера.']],
  ERR_INVALID_URL: h => ['Неправильна адреса.', ['Перевірте, чи правильно написано адресу.']],
};
function errorPage(code, host, why) {
  const [title, tips] = ERRS[code](esc(host), why);
  return { error: true, title: host, html: `<div class="err"><div class="err-ic">${ui(code === 'ERR_NETWORK_ACCESS_DENIED' ? 'shield' : 'globe', 54)}</div><h1>${code === 'ERR_NETWORK_ACCESS_DENIED' ? 'Немає доступу до Інтернету' : 'Не вдається отримати доступ до сайту'}</h1><p>${title}</p><p>Спробуйте:</p><ul>${tips.map(t => `<li>${t}</li>`).join('')}</ul><p class="err-code">${code}</p><button class="btn primary" data-b="reload">Перезавантажити</button></div>` };
}
// справжні сайти існують, але їх немає в навчальному інтернеті
function offlinePage(u) {
  return { title: u.hostname, html: `<div class="err"><div class="err-ic">${appIcon('browser', 56)}</div><h1>Цього сайту немає в навчальному інтернеті</h1><p>Сайт <b>${esc(u.hostname)}</b> існує в справжньому інтернеті, але навчальний браузер відкриває лише навчальні сайти — так безпечно.</p>
    <p>Спробуйте:</p><ul>${Object.entries(EDU_SITES).map(([h, s]) => `<li><a href="https://${h}/">${h}</a> — ${esc(s.title)}</li>`).join('')}<li><a href="http://192.168.1.1/">192.168.1.1</a> — налаштування роутера</li></ul></div>` };
}
export function favicon(url, s = 16) {
  try { const u = new URL(url); if (u.protocol === 'browser:') return ui(u.hostname === 'history' ? 'history' : u.hostname === 'downloads' ? 'download' : u.hostname === 'bookmarks' ? 'star' : 'globe', s - 1); if (u.hostname === '192.168.1.1' || ROUTER_HOSTS.includes(u.hostname)) return appIcon('router', s); return FAVICON(u.hostname, s) || ui('globe', s - 1); } catch (e) { return ui('globe', s - 1); }
}
