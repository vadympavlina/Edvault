// Емулятор Windows · «Безпека Windows» (брандмауер і захист мережі) і Панель керування → Брандмауер Захисника Windows.
import { fwOf, PROFILES, PROFILE_NET, PROFILE_NAME, NET, defaults as fwDefaults, allowedApps, setAppProfile, newId, evaluate, PROGRAMS } from './fw.js';
import { appIcon, ui } from './icons.js';
import { WM, dialog, alertBox, esc, h, modal } from './ui.js';
import { uac } from './uac.js';
import { avRender, avClick, avStatus, avScanUpdate } from './defender.js';

const NET_ICON = { domain: 'building', private: 'house', public: 'coffee' };
const elevate = (app, icon) => uac({ app, icon, file: app.includes('розширеною') ? 'C:\\Windows\\System32\\mmc.exe' : 'C:\\Windows\\System32\\SecHealthUI.exe' });

/* ═════════════ Безпека Windows ═════════════ */
const NAV = [
  ['home', 'house', 'Головна'], ['virus', 'virus', 'Захист від вірусів і загроз'], ['account', 'person', 'Захист облікових записів'],
  ['firewall', 'wifi2', 'Брандмауер і захист мережі'], ['apps', 'browser', 'Керування програмами й браузером'], ['device', 'chip', 'Безпека пристрою'],
  ['health', 'heart', 'Продуктивність і справність пристрою'], ['family', 'family', 'Сімейні параметри'],
];
export class SecurityApp {
  constructor(sys, page = 'home') {
    this.sys = sys; this.fs = sys.fs; this.page = page; this.hist = [];
    this.win = WM.open({ app: 'security', exe: 'SecHealthUI.exe', title: 'Безпека Windows', icon: appIcon('security', 16), w: 980, h: 660, minW: 640, minH: 400 });
    this.win.body.innerHTML = `<div class="sec"><nav class="sec-nav"><button class="sn back" data-back title="Назад">${ui('back', 16)}</button><button class="sn" data-menu title="Згорнути або розгорнути меню" aria-label="Меню">${ui('menu', 16)}</button>${NAV.map(([k, i, t]) => `<button class="sn" data-go="${k}">${ui(i, 18)}<span>${t}</span></button>`).join('')}<span class="grow"></span><button class="sn" data-go="settings">${ui('gear', 18)}<span>Параметри</span></button></nav><main class="sec-main"></main></div>`;
    this.$ = s => this.win.body.querySelector(s); this.$$ = s => [...this.win.body.querySelectorAll(s)];
    this.win.body.addEventListener('click', e => this.click(e));
    this.win.body.addEventListener('change', e => { if (e.target.name === 'avopt') this.avOpt = e.target.value; });
    this.unsub = this.fs.on(w => { if (['fw', 'reset', 'av'].includes(w)) this.render(); else if (w === 'avscan' && this.page.startsWith('virus') && !avScanUpdate(this)) this.render(); });
    this.win.cleanup(() => this.unsub());
    this.render();
  }
  go(p) { if (p !== this.page) this.hist.push(this.page); this.page = p; this.render(); this.$('.sec-main').scrollTop = 0; }
  get fw() { return fwOf(this.fs); }
  render() {
    if (!this.win.el.isConnected) return;
    const fw = this.fw, p = this.page;
    this.$('[data-back]').disabled = !this.hist.length;
    this.win.body.querySelectorAll('[data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === p || (b.dataset.go === 'firewall' && PROFILES.includes(p)) || (b.dataset.go === 'firewall' && ['fwnotify', 'trouble'].includes(p)) || (b.dataset.go === 'virus' && p.startsWith('virus'))));
    const off = PROFILES.filter(x => !fw.profiles[x].on);
    const okTile = (k, ic, t, s) => `<button class="tile-s" data-go="${k}"><span class="ts-ic">${ui(ic, 30)}<i class="ok">${ui('check', 11)}</i></span><b>${t}</b><small>${s}</small></button>`;
    let html;
    if (p === 'home') {
      html = `<h1>Безпека з першого погляду</h1><p class="lead">Перегляньте, що відбувається з безпекою й станом вашого пристрою, і вживіть потрібні заходи.</p>
        <div class="tiles-s">${(() => { const a = avStatus(this.fs); return a.bad ? `<button class="tile-s bad" data-go="virus"><span class="ts-ic">${ui('virus', 30)}<i class="x">${ui('close', 11)}</i></span><b>Захист від вірусів і загроз</b><small>${a.pending ? `Знайдено загроз: ${a.pending}. Почніть рекомендовані дії.` : 'Захист у реальному часі вимкнено. Пристрій може бути вразливим.'}</small><span class="btn primary">${a.pending ? 'Переглянути' : 'Увімкнути'}</span></button>` : okTile('virus', 'virus', 'Захист від вірусів і загроз', 'Дії не потрібні.'); })()}${okTile('account', 'person', 'Захист облікових записів', 'Дії не потрібні.')}
        <button class="tile-s${off.length ? ' bad' : ''}" data-go="firewall"><span class="ts-ic">${ui('wifi2', 30)}<i class="${off.length ? 'x' : 'ok'}">${ui(off.length ? 'close' : 'check', 11)}</i></span><b>Брандмауер і захист мережі</b><small>${off.length ? `Брандмауер вимкнено: ${off.map(x => PROFILE_NAME[x].toLowerCase()).join(', ')}. Ваш пристрій може бути вразливим.` : 'Дії не потрібні.'}</small>${off.length ? '<span class="btn primary" data-fixall>Увімкнути</span>' : ''}</button>
        ${okTile('apps', 'browser', 'Керування програмами й браузером', 'Дії не потрібні.')}${okTile('device', 'chip', 'Безпека пристрою', 'Переглянути стан і керувати функціями безпеки обладнання')}${okTile('health', 'heart', 'Продуктивність і справність пристрою', 'Немає дій.')}${okTile('family', 'family', 'Сімейні параметри', 'Керуйте способом використання пристроїв вашою родиною.')}</div>`;
    } else if (p === 'firewall') {
      html = `<div class="sec-h">${ui('wifi2', 34)}<div><h1>Брандмауер і захист мережі</h1><p class="lead">Хто й що має доступ до ваших мереж.</p></div></div>
        <div class="nets">${PROFILES.map(k => { const on = fw.profiles[k].on; return `<button class="net-row" data-go="${k}">${ui(NET_ICON[k], 24)}<span><b>${PROFILE_NET[k]}${k === NET.profile ? ' (активна)' : ''}</b><small class="${on ? '' : 'bad'}">${on ? 'Брандмауер увімкнено.' : 'Брандмауер вимкнено. Ваш пристрій може бути вразливим.'}</small></span>${on ? '' : `<span class="btn primary" data-turnon="${k}">Увімкнути</span>`}${ui('chevron', 16)}</button>`; }).join('')}</div>
        <div class="sec-links">${[['allow', 'Дозволити програмі доступ через брандмауер'], ['trouble', 'Засіб усунення неполадок мережі й Інтернету'], ['fwnotify', 'Параметри сповіщень брандмауера'], ['advanced', 'Додаткові параметри'], ['restore', 'Відновити стандартні параметри брандмауерів']].map(([k, t]) => `<button class="link" data-link="${k}">${esc(t)}</button>`).join('')}</div>
        <aside class="sec-aside"><h4>Маєте запитання?</h4><p>Брандмауер — це «охоронець на вході»: він вирішує, які підключення пропустити в комп’ютер і з нього, за <b>правилами</b>. Вхідні підключення без правила блокуються, вихідні — дозволяються.</p></aside>`;
    } else if (PROFILES.includes(p)) {
      const c = fw.profiles[p];
      html = `<button class="sec-backlink" data-go="firewall">${ui('back', 14)}Брандмауер і захист мережі</button><div class="sec-h">${ui(NET_ICON[p], 34)}<div><h1>${PROFILE_NET[p]}</h1><p class="lead">${{ domain: 'Мережі на робочому місці, приєднані до домену.', private: 'Мережі вдома чи в школі, де ви знаєте й довіряєте людям і пристроям у мережі, а пристрій налаштовано як видимий для інших.', public: 'Мережі в громадських місцях, як-от в аеропортах чи кав’ярнях, де пристрій налаштовано як невидимий.' }[p]}</p></div></div>
        <h3>${{ domain: 'Активні мережі домену', private: 'Активні приватні мережі', public: 'Активні загальнодоступні мережі' }[p]}</h3><p class="net-act">${p === NET.profile ? `${ui('wifi2', 18)}${NET.name}` : 'Не підключено'}</p>
        <h3>Брандмауер Microsoft Defender</h3><p class="muted">Допомагає захистити пристрій під час підключення до цієї мережі.</p>
        <label class="sw-row"><span class="toggle${c.on ? ' on' : ''}" data-toggle="${p}" role="switch" aria-checked="${c.on}"><i></i></span><b>${c.on ? 'Увімкнуто' : 'Вимкнуто'}</b></label>
        ${c.on ? '' : `<p class="warn-s">${ui('warn', 16)}Брандмауер у цій мережі вимкнено. Будь-хто в мережі може підключатися до вашого комп’ютера.</p>`}
        <h3>Вхідні підключення</h3><label class="chk"><input type="checkbox" data-blockall="${p}" ${c.inbound === 'blockall' ? 'checked' : ''} ${c.on ? '' : 'disabled'}> Блокує всі вхідні підключення, зокрема зі списку дозволених програм.</label>`;
    } else if (p === 'fwnotify') {
      html = `<button class="sec-backlink" data-go="firewall">${ui('back', 14)}Брандмауер і захист мережі</button><h1>Сповіщення брандмауера</h1><p class="lead">Отримувати сповіщення, коли брандмауер Microsoft Defender блокує нову програму.</p>
        ${PROFILES.map(k => `<label class="sw-row"><span class="toggle${fw.profiles[k].notify ? ' on' : ''}" data-notify="${k}" role="switch"><i></i></span><b>${PROFILE_NET[k]}</b></label>`).join('')}`;
    } else if (p === 'trouble') {
      html = `<button class="sec-backlink" data-go="firewall">${ui('back', 14)}Брандмауер і захист мережі</button><h1>Усунення неполадок мережі й Інтернету</h1><p class="lead">Засіб перевіряє підключення та брандмауер і підказує, що виправити.</p>
        <button class="btn primary" data-trouble>Запустити перевірку</button><div class="trouble"></div>`;
    } else if (p.startsWith('virus')) {
      html = avRender(this, p);
    } else if (p === 'settings') {
      html = `<h1>Параметри</h1><h3>Про програму</h3><p class="muted">Безпека Windows · навчальна версія Edvault. Працюють розділи «Захист від вірусів і загроз» і «Брандмауер і захист мережі»; інші показують стан для ознайомлення.</p><h3>Сповіщення</h3><button class="link" data-go="fwnotify">Параметри сповіщень брандмауера</button>`;
    } else {
      const [, ic, t] = NAV.find(n => n[0] === p);
      html = `<div class="sec-h">${ui(ic, 34)}<div><h1>${t}</h1><p class="lead">У навчальному комп’ютері цей розділ лише для перегляду.</p></div></div><div class="all-ok">${ui('check', 22)}<span><b>Дії не потрібні.</b><small>Остання перевірка: сьогодні, ${new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</small></span></div>`;
    }
    this.$('.sec-main').innerHTML = html;
  }
  async click(e) {
    const fw = this.fw, sys = this.sys;
    if (e.target.closest('[data-back]')) { if (this.hist.length) { this.page = this.hist.pop(); this.render(); } return; }
    if (e.target.closest('[data-menu]')) { this.$('.sec').classList.toggle('slim'); return; }
    if (this.page.startsWith('virus') && !e.target.closest('[data-go]') && await avClick(this, e, () => elevate('Безпека Windows', appIcon('security', 32)))) return;
    const t = e.target.closest('[data-turnon], [data-fixall]');
    if (t) {
      e.stopPropagation();
      if (!(await elevate('Безпека Windows', appIcon('security', 32)))) return;
      (t.dataset.turnon ? [t.dataset.turnon] : PROFILES).forEach(k => { fw.profiles[k].on = true; });
      this.fs.emit('fw'); sys.toast('Брандмауер увімкнено'); return;
    }
    const g = e.target.closest('[data-go]'); if (g) return this.go(g.dataset.go);
    const tg = e.target.closest('[data-toggle]');
    if (tg) { if (!(await elevate('Безпека Windows', appIcon('security', 32)))) return; const k = tg.dataset.toggle; fw.profiles[k].on = !fw.profiles[k].on; this.fs.emit('fw'); sys.toast(fw.profiles[k].on ? `Брандмауер увімкнено: ${PROFILE_NET[k]}` : `Брандмауер вимкнено: ${PROFILE_NET[k]}`); return; }
    const ba = e.target.closest('[data-blockall]');
    if (ba) { e.preventDefault(); if (!(await elevate('Безпека Windows', appIcon('security', 32)))) return; const c = fw.profiles[ba.dataset.blockall]; c.inbound = c.inbound === 'blockall' ? 'block' : 'blockall'; this.fs.emit('fw'); return; }
    const nt = e.target.closest('[data-notify]');
    if (nt) { if (!(await elevate('Безпека Windows', appIcon('security', 32)))) return; const c = fw.profiles[nt.dataset.notify]; c.notify = !c.notify; this.fs.emit('fw'); return; }
    if (e.target.closest('[data-trouble]')) return this.trouble();
    const l = e.target.closest('[data-link]');
    if (l) {
      const k = l.dataset.link;
      if (k === 'allow') return sys.open('firewallcpl', 'allow');
      if (k === 'trouble') return this.go('trouble');
      if (k === 'fwnotify') return this.go('fwnotify');
      if (k === 'advanced') return sys.open('wfmsc');
      if (k === 'restore') return sys.open('firewallcpl', 'restore');
    }
  }
  // перевірка підключення — справжня, за правилами брандмауера
  trouble() {
    const fw = this.fw, box = this.$('.trouble');
    const steps = [];
    const p = fw.profiles[NET.profile];
    steps.push([true, `Мережевий адаптер ${NET.adapter} підключено до мережі ${NET.name}.`]);
    steps.push([true, `IP-адреса ${NET.ip}, основний шлюз ${NET.gateway}.`]);
    const dns = evaluate(fw, { dir: 'out', protocol: 'UDP', localPort: 53000, remotePort: 53, remoteIp: NET.dns, program: PROGRAMS.svchost });
    steps.push([dns.allow, dns.allow ? `DNS-сервер ${NET.dns} доступний — імена сайтів знаходяться.` : `Брандмауер блокує запити до DNS-сервера ${NET.dns}. Без DNS не відкриваються сайти за назвою. Увімкніть правило «Основні мережеві засоби — DNS (UDP — вихідний)».`]);
    const ping = evaluate(fw, { dir: 'out', protocol: 'ICMPv4', icmpType: 8, remoteIp: '8.8.8.8', program: PROGRAMS.ping });
    steps.push([ping.allow, ping.allow ? 'Вихідний ping дозволено.' : `Вихідний ping заблоковано${ping.rule ? ` правилом «${ping.rule.name.trim()}»` : ' (вихідні підключення без правила блокуються)'}.`]);
    const web = evaluate(fw, { dir: 'out', protocol: 'TCP', localPort: 50000, remotePort: 443, remoteIp: '185.199.108.153', program: PROGRAMS.curl });
    steps.push([web.allow, web.allow ? 'Підключення до сайтів (TCP 443) дозволено.' : `Підключення до сайтів (TCP 443) заблоковано${web.rule ? ` правилом «${web.rule.name.trim()}»` : ''}.`]);
    steps.push([p.on, p.on ? `Брандмауер активного профілю (${PROFILE_NAME[NET.profile].toLowerCase()}) увімкнено.` : 'Брандмауер активного профілю вимкнено — комп’ютер не захищений від вхідних підключень.']);
    box.innerHTML = '<p class="muted">Перевірка…</p>';
    let i = 0;
    const tick = () => { if (!box.isConnected) return; box.innerHTML = steps.slice(0, ++i).map(([ok, t]) => `<p class="tr ${ok ? 'ok' : 'bad'}">${ui(ok ? 'check' : 'warn', 16)}<span>${esc(t)}</span></p>`).join('') + (i < steps.length ? '<p class="muted">Перевірка…</p>' : `<p class="tr-sum">${steps.every(s => s[0]) ? 'Проблем не виявлено.' : 'Знайдено проблеми — їх видно вище.'}</p>`); if (i < steps.length) setTimeout(tick, 280); };
    tick();
  }
}

/* ═════════════ Панель керування → Брандмауер Захисника Windows ═════════════ */
export class FirewallCpl {
  constructor(sys, page = 'main') {
    this.sys = sys; this.fs = sys.fs; this.page = page; this.open = { [NET.profile]: true }; this.unlocked = false; this.draft = null;
    this.win = WM.open({ app: 'firewallcpl', exe: 'explorer.exe', title: 'Брандмауер Захисника Windows', icon: appIcon('firewall', 16), w: 960, h: 680, minW: 640, minH: 400 });
    this.win.body.innerHTML = `<div class="cpl"><div class="cpl-bar"><button class="nb" data-up title="Назад">${ui('back')}</button><div class="cpl-path">${appIcon('firewall', 16)}<span>Панель керування</span>${ui('chevron', 12)}<span>Система й безпека</span>${ui('chevron', 12)}<b>Брандмауер Захисника Windows</b></div><label class="ex-search">${ui('search', 15)}<input placeholder="Пошук у Панелі керування" disabled></label></div>
      <div class="cpl-main"><nav class="cpl-side"></nav><div class="cpl-body"></div></div></div>`;
    this.$ = s => this.win.body.querySelector(s);
    this.win.body.addEventListener('click', e => this.click(e));
    this.win.body.addEventListener('change', e => this.change(e));
    this.unsub = this.fs.on(w => { if (['fw', 'reset'].includes(w) && !this.draft) this.render(); });
    this.win.cleanup(() => this.unsub());
    this.render();
  }
  get fw() { return fwOf(this.fs); }
  go(p) { this.page = p; this.unlocked = false; this.draft = null; this.render(); }
  render() {
    if (!this.win.el.isConnected) return;
    const fw = this.fw, p = this.page, sh = `<i class="uac-sh" title="Потрібні права адміністратора">${ui('shield', 13)}</i>`;
    this.$('.cpl-side').innerHTML = `<button class="link" data-go="main">Головна сторінка панелі керування</button>
      <button class="link" data-go="allow">Дозволити взаємодію з програмою або компонентом через брандмауер Захисника Windows</button>
      <button class="link" data-go="settings">${sh}Змінити параметри сповіщень</button><button class="link" data-go="settings">${sh}Увімкнути або вимкнути брандмауер Захисника Windows</button>
      <button class="link" data-go="restore">${sh}Відновити стандартні параметри</button><button class="link" data-act="advanced">${sh}Додаткові параметри</button><button class="link" data-act="trouble">Виправити неполадки мережі</button>
      <div class="cpl-see"><b>Див. також</b><button class="link" data-act="security">Безпека й обслуговування</button><button class="link" data-act="network">Центр мереж і спільного доступу</button></div>`;
    this.$('[data-up]').disabled = p === 'main';
    const b = this.$('.cpl-body');
    if (p === 'main') {
      b.innerHTML = `<h2>Захист ПК за допомогою брандмауера Захисника Windows</h2><p class="muted">Брандмауер Захисника Windows допомагає запобігти отриманню хакерами або зловмисними програмами доступу до комп’ютера через Інтернет або мережу.</p>
        ${['private', 'public', 'domain'].map(k => { const c = fw.profiles[k], on = c.on, act = k === NET.profile, op = !!this.open[k];
          return `<section class="cpl-net${on ? '' : ' off'}"><button class="cn-head" data-fold="${k}">${ui('shield', 18)}<b>${{ private: 'Приватні мережі', public: 'Гостьові або загальнодоступні мережі', domain: 'Мережі домену' }[k]}</b><span>${act ? 'Підключено' : 'Не підключено'}</span>${ui(op ? 'up' : 'down', 15)}</button>
          ${op ? `<div class="cn-body"><p>${{ private: 'Мережі вдома або в школі, де ви знаєте людей і пристрої в мережі й довіряєте їм.', public: 'Мережі в громадських місцях, як-от в аеропортах або кав’ярнях.', domain: 'Мережі на робочому місці, приєднані до домену.' }[k]}</p>
            <table><tr><th>Стан брандмауера Захисника Windows:</th><td>${on ? 'Увімк.' : '<b class="bad">Вимк.</b>'}</td></tr><tr><th>Вхідні підключення:</th><td>${c.inbound === 'blockall' ? 'Блокувати всі підключення до програм, зокрема до тих, що є в списку дозволених програм' : c.inbound === 'allow' ? 'Дозволяти всі підключення' : 'Блокувати всі підключення до програм, яких немає в списку дозволених програм'}</td></tr>
            <tr><th>Активні ${k === 'private' ? 'приватні мережі' : k === 'public' ? 'загальнодоступні мережі' : 'мережі домену'}:</th><td>${act ? `${ui('wifi2', 15)} ${NET.name}` : 'Немає'}</td></tr><tr><th>Стан сповіщень:</th><td>${c.notify ? 'Сповіщати мене, коли брандмауер Захисника Windows блокує нову програму' : 'Не сповіщати мене'}</td></tr></table></div>` : ''}</section>`; }).join('')}`;
    } else if (p === 'allow') {
      const apps = this.draft ? this.draft.apps : allowedApps(fw);
      b.innerHTML = `<h2>Дозволити програмам обмінюватися даними через брандмауер Захисника Windows</h2><p class="muted">Щоб додати, змінити або видалити дозволені програми та порти, натисніть кнопку «Змінити параметри».</p>
        <p class="muted">Які ризики виникають, якщо дозволити програмі обмін даними?</p><div class="cpl-row"><span class="grow"></span><button class="btn" data-unlock ${this.unlocked ? 'disabled' : ''}>${ui('shield', 14)} Змінити параметри</button></div>
        <div class="allow-box"><b class="ab-t">Дозволені програми й компоненти:</b><div class="allow-tbl"><table><thead><tr><th>Ім’я</th><th>Приватна</th><th>Загальнодоступна</th></tr></thead><tbody>
        ${apps.map((a, i) => `<tr class="${this.selApp === i ? 'sel' : ''}" data-ai="${i}"><td><label><input type="checkbox" data-on="${i}" ${a.private || a.public ? 'checked' : ''} ${this.unlocked ? '' : 'disabled'}> ${esc(a.name)}</label></td><td><input type="checkbox" data-p="${i}:private" ${a.private ? 'checked' : ''} ${this.unlocked ? '' : 'disabled'}></td><td><input type="checkbox" data-p="${i}:public" ${a.public ? 'checked' : ''} ${this.unlocked ? '' : 'disabled'}></td></tr>`).join('')}</tbody></table></div>
        <div class="cpl-row"><span class="grow"></span><button class="btn" data-details ${this.selApp != null ? '' : 'disabled'}>Відомості…</button><button class="btn" data-remove ${this.unlocked && this.selApp != null && apps[this.selApp]?.custom ? '' : 'disabled'}>Видалити</button></div></div>
        <div class="cpl-row"><span class="grow"></span><button class="btn" data-addapp ${this.unlocked ? '' : 'disabled'}>Дозволити іншу програму…</button></div>
        <div class="cpl-foot"><button class="btn primary" data-ok>OK</button><button class="btn" data-cancel>Скасувати</button></div>`;
    } else if (p === 'settings') {
      const d = this.draft || (this.draft = { profiles: JSON.parse(JSON.stringify(fw.profiles)) });
      b.innerHTML = `<h2>Налаштувати параметри для кожного типу мережі</h2><p class="muted">Можна змінити параметри брандмауера для кожного типу мережі, яку використовуєте.</p>
        ${['domain', 'private', 'public'].map(k => { const c = d.profiles[k]; return `<fieldset class="cpl-set"><legend>Параметри ${{ domain: 'мережі домену', private: 'приватної мережі', public: 'загальнодоступної мережі' }[k]}</legend>
          <label class="rad"><input type="radio" name="st-${k}" data-st="${k}:on" ${c.on ? 'checked' : ''}><i class="sh ok">${ui('shield', 14)}</i> Увімкнути брандмауер Захисника Windows</label>
          <label class="chk sub"><input type="checkbox" data-ba="${k}" ${c.inbound === 'blockall' ? 'checked' : ''} ${c.on ? '' : 'disabled'}> Блокувати всі вхідні підключення, зокрема зі списку дозволених програм</label>
          <label class="chk sub"><input type="checkbox" data-nt="${k}" ${c.notify ? 'checked' : ''} ${c.on ? '' : 'disabled'}> Сповіщати мене, коли брандмауер Захисника Windows блокує нову програму</label>
          <label class="rad"><input type="radio" name="st-${k}" data-st="${k}:off" ${c.on ? '' : 'checked'}><i class="sh bad">${ui('shield', 14)}</i> Вимкнути брандмауер Захисника Windows (не рекомендовано)</label></fieldset>`; }).join('')}
        <div class="cpl-foot"><button class="btn primary" data-ok>${ui('shield', 13)} OK</button><button class="btn" data-cancel>Скасувати</button></div>`;
    } else if (p === 'restore') {
      b.innerHTML = `<h2>Відновлення стандартних параметрів</h2><p class="muted">Буде видалено всі параметри брандмауера Захисника Windows, установлені для всіх розташувань мережі, а також правила, які ви додали. Це може призвести до припинення роботи деяких програм.</p>
        <div class="cpl-row"><button class="btn" data-restore>${ui('shield', 14)} Відновити стандартні параметри</button></div>`;
    }
  }
  async click(e) {
    const fw = this.fw, sys = this.sys;
    if (e.target.closest('[data-up]')) return this.go('main');
    const g = e.target.closest('[data-go]'); if (g) return this.go(g.dataset.go);
    const f = e.target.closest('[data-fold]'); if (f) { this.open[f.dataset.fold] = !this.open[f.dataset.fold]; return this.render(); }
    const a = e.target.closest('[data-act]');
    if (a) { const k = a.dataset.act; if (k === 'advanced') return sys.open('wfmsc'); if (k === 'trouble') return sys.open('security', 'trouble'); if (k === 'security') return sys.open('security'); if (k === 'network') return alertBox(`Мережа: ${NET.name} (${PROFILE_NET[NET.profile].toLowerCase()}).\nIP-адреса ${NET.ip}, шлюз ${NET.gateway}, DNS ${NET.dns}.\nДетальніше — команди ipconfig і netsh interface ip show config.`, 'Центр мереж і спільного доступу', 'info'); }
    if (e.target.closest('[data-cancel]')) return this.go('main');
    const row = e.target.closest('[data-ai]'); if (row && !e.target.closest('input')) { this.selApp = +row.dataset.ai; return this.render(); }
    if (e.target.closest('[data-unlock]')) { if (await elevate('Брандмауер Захисника Windows', appIcon('firewall', 32))) { this.unlocked = true; this.draft = { apps: JSON.parse(JSON.stringify(allowedApps(fw))) }; this.render(); } return; }
    if (e.target.closest('[data-details]')) { const ap = (this.draft?.apps || allowedApps(fw))[this.selApp]; if (ap) alertBox(`${ap.name}\n\nПравил: ${ap.rules.length}.\n${ap.rules.map(r => '• ' + r.name.trim()).join('\n')}\n\n${ap.rules[0]?.desc || ''}`, 'Відомості про програму', 'info'); return; }
    if (e.target.closest('[data-remove]')) { if (!this.draft || !this.unlocked) return; const ap = this.draft.apps[this.selApp]; if (!ap) return; if (await dialog({ title: 'Видалити програму', icon: 'question', text: `Видалити «${ap.name}» зі списку дозволених програм?`, buttons: [{ t: 'Так', v: true, primary: true }, { t: 'Ні', v: false, cancel: true }] }) && this.draft?.apps.includes(ap)) { ap.removed = true; this.draft.apps.splice(this.draft.apps.indexOf(ap), 1); (this.draft.removed ||= []).push(ap.key); this.selApp = null; this.render(); } return; }
    if (e.target.closest('[data-addapp]')) return this.draft && this.unlocked ? this.addApp() : undefined;
    if (e.target.closest('[data-ok]')) {
      if (this.page === 'allow') {
        if (this.draft) {
          for (const k of this.draft.removed || []) fw.rules = fw.rules.filter(r => (r.group || r.name.trim()) !== k || r.dir !== 'in');
          for (const ap of this.draft.apps) { if (ap.added) { fw.rules.push(ap.added); continue; } setAppProfile(fw, ap.key, 'private', !!ap.private); setAppProfile(fw, ap.key, 'public', !!ap.public); }
          this.fs.emit('fw');
        }
        return this.go('main');
      }
      if (this.page === 'settings') {
        if (!(await elevate('Брандмауер Захисника Windows', appIcon('firewall', 32)))) return;
        for (const k of PROFILES) Object.assign(fw.profiles[k], this.draft.profiles[k]);
        this.draft = null; this.fs.emit('fw'); return this.go('main');
      }
    }
    if (e.target.closest('[data-restore]')) {
      if (!(await elevate('Брандмауер Захисника Windows', appIcon('firewall', 32)))) return;
      if (!(await dialog({ title: 'Відновлення стандартних параметрів', icon: 'warn', text: 'Справді відновити стандартні параметри? Усі ваші правила буде видалено.', buttons: [{ t: 'Так', v: true, primary: true }, { t: 'Ні', v: false, cancel: true }] }))) return;
      this.fs.s.fw = fwDefaults(); this.fs.emit('fw'); sys.toast('Стандартні параметри брандмауера відновлено'); return this.go('main');
    }
  }
  change(e) {
    const t = e.target, d = this.draft; if (!d) return;
    if (t.dataset.on != null) { const ap = d.apps[+t.dataset.on]; if (t.checked) { if (!ap.private && !ap.public) ap.private = true; } else ap.private = ap.public = false; this.render(); }
    if (t.dataset.p) { const [i, k] = t.dataset.p.split(':'); d.apps[+i][k] = t.checked; this.render(); }
    if (t.dataset.st) { const [k, v] = t.dataset.st.split(':'); d.profiles[k].on = v === 'on'; this.render(); }
    if (t.dataset.ba) { const c = d.profiles[t.dataset.ba]; c.inbound = t.checked ? 'blockall' : 'block'; }
    if (t.dataset.nt) d.profiles[t.dataset.nt].notify = t.checked;
  }
  addApp() {
    const fw = this.fw;
    const known = [['Підключення до віддаленого робочого стола', PROGRAMS.mstsc], ['Microsoft Edge', PROGRAMS.edge], ['Minecraft Launcher', PROGRAMS.minecraft], ['Командний рядок', 'C:\\Windows\\System32\\cmd.exe'], ['Блокнот', 'C:\\Windows\\System32\\notepad.exe']];
    modal({ title: 'Додати програму', cls: 'addapp', html: `<p>Виберіть програму, яку потрібно додати, або натисніть кнопку «Огляд», щоб знайти програму, якої немає в списку.</p>
      <div class="pick-list">${known.map(([n, pth], i) => `<label class="pick"><input type="radio" name="kp" value="${i}" ${i ? '' : 'checked'}>${ui('desktop', 18)}<span><b>${esc(n)}</b><small>${esc(pth)}</small></span></label>`).join('')}</div>
      <label class="fld">Шлях: <input class="inp" data-path value="${esc(known[0][1])}" spellcheck="false"></label>
      <label class="fld">Типи мереж: <select class="inp" data-nets><option value="private" selected>Приватна</option><option value="public">Загальнодоступна</option><option value="both">Приватна й загальнодоступна</option></select></label>`,
      buttons: [{ t: 'Додати', v: 'add', primary: true }, { t: 'Скасувати', v: null, cancel: true }],
      onOpen: api => api.el.addEventListener('change', e => { if (e.target.name === 'kp') api.$('[data-path]').value = known[+e.target.value][1]; }),
      onButton: (v, api) => {
        if (v !== 'add') return;
        const path = api.$('[data-path]').value.trim();
        if (!/^[a-z]:\\.+\.exe$/i.test(path)) { alertBox('Укажіть шлях до програми (.exe), наприклад C:\\Program Files\\Гра\\game.exe', 'Додати програму', 'warn'); return false; }
        const name = known.find(k => k[1].toLowerCase() === path.toLowerCase())?.[0] || path.split('\\').pop().replace(/\.exe$/i, '');
        const nets = api.$('[data-nets]').value, profiles = nets === 'both' ? ['private', 'public'] : [nets];
        const r = { id: newId(fw), name, desc: 'Додано через «Дозволити іншу програму».', group: '', dir: 'in', enabled: true, action: 'allow', profiles, program: path, service: 'any', protocol: 'any', localPorts: 'any', remotePorts: 'any', icmp: 'any', localAddr: 'any', remoteAddr: 'any', edge: 'block', iface: 'all', predefined: false };
        if (!this.draft || !this.win.el.isConnected) return;
        this.draft.apps.push({ key: name, name, rules: [r], custom: true, private: profiles.includes('private'), public: profiles.includes('public'), added: r });
        this.render();
      },
    });
  }
}
