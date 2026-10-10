// Емулятор Windows · вебінтерфейс домашнього роутера «Домовик AX1800» (http://192.168.1.1, admin / admin).
// Лише інтерфейс: налаштування зберігаються, але на мережу емулятора не впливають.
import { ui } from './icons.js';
import { esc } from './ui.js';

export const ROUTER_HOSTS = ['router.local', 'domovyk.local'];
const MODEL = 'Домовик AX1800', BASE_FW = '1.2.4 Build 20250611', NEW_FW = '1.3.0 Build 20260904';
const ROUTER_MAC = '3C-52-82-1A-7F-08';
const CLIENTS = [
  { name: 'EDVAULT-PC', mac: '3C-52-82-1A-7F-09', ip: '192.168.1.27', link: 'Кабель (LAN 1)', kind: 'pc' },
  { name: 'Телефон Олі', mac: 'A4-C3-F0-12-9B-44', ip: '192.168.1.101', link: 'Wi‑Fi 5 ГГц', kind: 'phone' },
  { name: 'Ноутбук тата', mac: '70-1A-B8-3E-05-C2', ip: '192.168.1.102', link: 'Wi‑Fi 2,4 ГГц', kind: 'laptop' },
  { name: 'Смарт-телевізор', mac: 'B8-BC-5B-77-21-0D', ip: '192.168.1.103', link: 'Кабель (LAN 2)', kind: 'tv' },
  { name: 'Принтер', mac: '00-80-77-4D-AA-10', ip: '192.168.1.104', link: 'Wi‑Fi 2,4 ГГц', kind: 'printer' },
];
const TZ = ['UTC−05:00 Нью-Йорк', 'UTC+00:00 Лондон', 'UTC+01:00 Варшава, Берлін', 'UTC+02:00 Київ', 'UTC+03:00 Стамбул', 'UTC+09:00 Токіо'];
const now = () => Date.now();

export function defaults() {
  return {
    setup: false, admin: { user: 'admin', pass: 'admin' }, tz: 'UTC+02:00 Київ', ntp: true, boot: now(),
    wan: { type: 'dhcp', ip: '', mask: '255.255.255.0', gw: '', dns1: '', dns2: '', dnsManual: false, pppUser: '', pppPass: '', server: '', mtu: 1500, clone: false },
    lan: { ip: '192.168.1.1', mask: '255.255.255.0' },
    dhcp: { on: true, start: '192.168.1.100', end: '192.168.1.199', lease: 120, dns1: '', dns2: '', reserve: [{ name: 'EDVAULT-PC', mac: '3C-52-82-1A-7F-09', ip: '192.168.1.27' }] },
    wifi: {
      b24: { on: true, ssid: 'Domovyk_7F08', pass: '48151623', sec: 'wpa2', ch: 'auto', width: 'auto', power: 'high', hidden: false },
      b5: { on: true, ssid: 'Domovyk_7F08_5G', pass: '48151623', sec: 'wpa2', ch: 'auto', width: 'auto', power: 'high', hidden: false },
      smart: false, guest: { on: false, ssid: 'Domovyk_Guest', pass: '', sec: 'wpa2', isolate: true, time: 'always' }, wps: true, wpsPin: '12345670',
    },
    fwd: { rules: [], dmz: { on: false, ip: '' }, upnp: true },
    sec: { spi: true, dos: 'medium', wanPing: false, remote: false, macFilter: { on: false, mode: 'deny', list: [] } },
    parental: { profiles: [] },
    qos: { on: false, down: 100, up: 50, prio: [] },
    sys: { fw: BASE_FW, leds: true, log: [[now(), 'Система', 'Роутер увімкнено.']] },
  };
}
export const rstate = fs => fs.s.router ||= defaults();
const log = (R, who, msg) => { R.sys.log.unshift([now(), who, msg]); R.sys.log.length = Math.min(R.sys.log.length, 80); };

/* ── перевірки ── */
const ipOk = s => { const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s).trim()); return !!m && m.slice(1).every(x => +x <= 255 && String(+x) === x); };
const ipN = s => s.split('.').reduce((a, x) => a * 256 + +x, 0);
const maskOk = s => { if (!ipOk(s)) return false; const n = ipN(s); if (n === 0) return false; const inv = (~n) >>> 0; return ((inv + 1) & inv) === 0; };
const sameNet = (a, b, m) => (ipN(a) & ipN(m)) >>> 0 === (ipN(b) & ipN(m)) >>> 0;
const macOk = s => /^([0-9A-F]{2}[-:]){5}[0-9A-F]{2}$/i.test(String(s).trim());
const portOk = s => /^\d{1,5}$/.test(String(s).trim()) && +s >= 1 && +s <= 65535;
const portRange = s => { const m = /^(\d{1,5})(?:-(\d{1,5}))?$/.exec(String(s).trim()); return !!m && portOk(m[1]) && (!m[2] || (portOk(m[2]) && +m[2] >= +m[1])); };
function strength(p) {
  if (!p) return [0, ''];
  let s = 0; if (p.length >= 8) s++; if (p.length >= 12) s++; if (/[a-zа-я]/.test(p) && /[A-ZА-Я]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^\p{L}\d]/u.test(p)) s++;
  if (/^(\d)\1+$|^1234|^qwerty|^password|^admin/i.test(p)) s = Math.min(s, 1);
  return [Math.min(4, s), ['Дуже слабкий', 'Слабкий', 'Середній', 'Надійний', 'Дуже надійний'][Math.min(4, s)]];
}

/* ── будівельні блоки форм ── */
const F = {
  row: (label, ctl, hint = '', name = '') => `<div class="rt-row"${name ? ` data-row="${name}"` : ''}><label class="rt-l">${label}</label><div class="rt-ctl">${ctl}${hint ? `<small class="rt-hint">${hint}</small>` : ''}<small class="rt-err" hidden></small></div></div>`,
  inp: (name, v, a = '') => `<input class="rt-in" name="${name}" value="${esc(v ?? '')}" spellcheck="false" autocomplete="off" ${a}>`,
  pass: (name, v, a = '') => `<span class="rt-pass"><input class="rt-in" type="password" name="${name}" value="${esc(v ?? '')}" spellcheck="false" autocomplete="new-password" ${a}><button type="button" class="rt-eye" data-eye title="Показати пароль">${ui('eye', 16)}</button></span>`,
  sel: (name, v, opts, a = '') => `<select class="rt-in" name="${name}" ${a}>${opts.map(o => { const [k, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(k)}" ${String(k) === String(v) ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select>`,
  sw: (name, on, label = '') => `<label class="rt-sw"><input type="checkbox" name="${name}" ${on ? 'checked' : ''}><i></i>${label ? `<span>${label}</span>` : ''}</label>`,
  card: (title, body, extra = '') => `<section class="rt-card"><header><h3>${title}</h3>${extra}</header>${body}</section>`,
  save: (t = 'Зберегти') => `<div class="rt-actions"><button class="rt-btn primary" type="submit">${t}</button></div>`,
};
const val = (form, name) => { const el = form.elements[name]; if (!el) return undefined; return el.type === 'checkbox' ? el.checked : el.value.trim(); };
function showErrs(form, errs) {
  form.querySelectorAll('.rt-err').forEach(e => { e.hidden = true; }); form.querySelectorAll('.rt-in.bad').forEach(e => e.classList.remove('bad'));
  let first = null;
  for (const [n, m] of Object.entries(errs)) { const el = form.elements[n]; const row = el?.closest('.rt-row') || form.querySelector(`[data-row="${n}"]`); const er = row?.querySelector('.rt-err'); if (er) { er.hidden = false; er.textContent = m; } if (el?.classList) el.classList.add('bad'); first ||= el; }
  first?.focus?.();
  return !Object.keys(errs).length;
}

/* ── меню ── */
const MENU = [
  ['status', 'gauge', 'Стан'], ['internet', 'globe', 'Інтернет'], ['lan', 'network', 'Локальна мережа'], ['wifi', 'wifi', 'Бездротова мережа'], ['clients', 'users', 'Пристрої'],
  ['forward', 'arrows', 'Переадресація портів'], ['security', 'shield', 'Безпека'], ['parental', 'baby', 'Батьківський контроль'], ['qos', 'sliders', 'Пріоритет (QoS)'], ['system', 'tool', 'Система'],
];
const HELP = {
  status: ['Що тут?', 'Огляд усієї домашньої мережі: чи є інтернет, які мережі Wi‑Fi увімкнено і скільки пристроїв підключено.'],
  internet: ['Інтернет (WAN)', '<b>WAN</b> — «зовнішній» вхід роутера, куди під’єднано кабель провайдера. Тип підключення вказано в договорі з провайдером:<br>• <b>Динамічна IP</b> — нічого вводити не треба;<br>• <b>Статична IP</b> — провайдер дав адресу, маску, шлюз і DNS;<br>• <b>PPPoE / L2TP / PPTP</b> — потрібні логін і пароль із договору.'],
  lan: ['Локальна мережа (LAN)', '<b>IP-адреса роутера</b> — за нею відкриваються ці налаштування. <b>DHCP-сервер</b> сам видає адреси пристроям із пулу. <b>Резервування</b> — щоб пристрій завжди отримував одну й ту саму адресу (зручно для принтера чи сервера гри).'],
  wifi: ['Бездротова мережа', '<b>SSID</b> — назва мережі, яку бачать телефони. <b>2,4 ГГц</b> — далі «б’є», але повільніше; <b>5 ГГц</b> — швидше, але ближче. Шифрування — <b>WPA2</b> або <b>WPA3</b>, пароль — щонайменше 8 символів (краще 12+). «Немає» і WEP — небезпечно!'],
  clients: ['Пристрої', 'Усі пристрої, підключені до роутера: кабелем або через Wi‑Fi. У кожного є IP-адреса (видає роутер) і MAC-адреса (записана на заводі).'],
  forward: ['Переадресація портів', 'Зовні вся мережа має одну адресу роутера. Переадресація каже: «запити на зовнішній порт N пересилай на такий-то комп’ютер у мережі». Так роблять сервер гри. <b>DMZ</b> відкриває <i>всі</i> порти одного пристрою — небезпечно. <b>UPnP</b> дозволяє програмам самим відкривати порти.'],
  security: ['Безпека', '<b>SPI-брандмауер</b> пропускає з інтернету лише відповіді на ваші запити. <b>Фільтр MAC</b> пускає чи не пускає конкретні пристрої. <b>Віддалене керування</b> дозволяє відкрити ці налаштування з інтернету — краще вимкнути.'],
  parental: ['Батьківський контроль', 'Профіль — це група пристроїв однієї людини. Можна обмежити час в інтернеті за день, задати «час сну» без інтернету й заблокувати сайти.'],
  qos: ['Пріоритет (QoS)', 'Коли інтернет зайнятий, роутер спершу обслуговує пристрої з пріоритетом — наприклад, ноутбук для онлайн-уроку, а не телевізор.'],
  system: ['Система', '<b>Прошивка</b> — програма всередині роутера: оновлюйте її. <b>Резервна копія</b> зберігає всі налаштування у файл. <b>Заводські налаштування</b> стирають усе й повертають admin / admin.'],
};

/* ═════════ сторінка роутера в браузері ═════════ */
export function routerPage(u, ctx) {
  const R = rstate(ctx.fs), path = (u.pathname.replace(/\/+$/, '') || '/').slice(1);
  const S = ctx.sys.routerSession;
  if (ctx.sys.routerBusy && ctx.sys.routerBusy > now()) return { title: MODEL, secure: 'http', html: `<div class="rt rt-boot">${ui('router', 48)}<h1>Роутер перезавантажується…</h1><p>Зачекайте кілька секунд і оновіть сторінку.</p><button class="rt-btn primary" data-b="reload">Оновити</button></div>` };
  const fresh = S && now() - S.at < 15 * 60e3;
  if (!fresh) return loginPage(R, ctx, S && !fresh);
  S.at = now();
  if (!R.setup || path === 'wizard') return wizardPage(R, ctx);
  const page = MENU.some(m => m[0] === path.split('/')[0]) ? path.split('/')[0] : 'status';
  const sub = path.split('/')[1] || '';
  return { title: `${MENU.find(m => m[0] === page)[2]} — ${MODEL}`, secure: 'http', html: `<div class="rt">${header(R)}<div class="rt-body"><nav class="rt-menu">${MENU.map(([k, ic, t]) => `<a href="/${k}" class="${k === page ? 'on' : ''}">${ui(ic, 17)}<span>${t}</span></a>`).join('')}</nav>
    <main class="rt-main" data-page="${page}"></main><aside class="rt-help"${ctx.sys.routerHelpOff ? ' hidden' : ''}><h4>${ui('info', 15)} ${HELP[page][0]}</h4><p>${HELP[page][1]}</p><button class="rt-link" data-help-off>Сховати довідку</button></aside></div></div>`,
    bind: (el, c) => mount(el, c, R, page, sub) };
}
const header = R => `<header class="rt-top"><div class="rt-brand">${ui('router', 26)}<b>Домовик</b><span>${MODEL}</span></div><span class="grow"></span><span class="rt-fw">Прошивка ${R.sys.fw.split(' ')[0]}</span><a class="rt-tb" href="/wizard">${ui('zap', 15)}Швидке налаштування</a><button class="rt-tb" data-reboot>${ui('power', 15)}Перезавантажити</button><button class="rt-tb" data-logout>${ui('logout', 15)}Вийти</button></header>`;

/* ── вхід ── */
function loginPage(R, ctx, expired) {
  return { title: `Вхід — ${MODEL}`, secure: 'http', html: `<div class="rt rt-login"><div class="rt-lc">${ui('router', 52)}<h1>Домовик</h1><p class="rt-model">${MODEL}</p>
    ${expired ? `<p class="rt-note">${ui('clock', 15)} Сеанс завершився: ви довго нічого не робили. Увійдіть знову.</p>` : ''}
    <form class="rt-lf" data-js><label>Ім’я користувача<input class="rt-in" name="user" autocomplete="off" spellcheck="false" autofocus></label><label>Пароль${F.pass('pass', '')}</label><p class="rt-lerr" hidden></p><button class="rt-btn primary big">Увійти</button></form>
    <button class="rt-link" data-forgot>Забули пароль?</button>
    <div class="rt-forgot" hidden><p>Пароль від налаштувань можна скинути лише кнопкою <b>RESET</b> на корпусі роутера. <b>Утримуйте її 5 секунд</b> — усі налаштування повернуться до заводських (admin / admin).</p>
      <div class="rt-back"><div class="rt-ports">${['WAN', 'LAN1', 'LAN2', 'LAN3', 'LAN4'].map(p => `<span class="${p === 'WAN' ? 'wan' : ''}"><i></i>${p}</span>`).join('')}<button class="rt-reset" data-reset title="Утримуйте 5 секунд"><i></i>RESET</button><span class="pwr"><i></i>POWER</span></div><div class="rt-hold"><i></i></div></div>
      <div class="rt-sticker"><b>Наклейка знизу роутера</b><span>Адреса: http://192.168.1.1</span><span>Ім’я: admin · Пароль: admin</span><span>Wi‑Fi: ${esc(R.wifi.b24.ssid)} · пароль ${R.setup ? '(змінено)' : esc(R.wifi.b24.pass)}</span><span>MAC: ${ROUTER_MAC}</span></div></div></div></div>`,
    bind: (el, c) => {
      bindEyes(el);
      const f = el.querySelector('form'), err = el.querySelector('.rt-lerr');
      f.addEventListener('submit', e => {
        e.preventDefault();
        const lock = c.sys.routerLock;
        if (lock && lock.until > now()) { err.hidden = false; err.textContent = `Забагато невдалих спроб. Зачекайте ${Math.ceil((lock.until - now()) / 1000)} с.`; return; }
        if (val(f, 'user') === R.admin.user && f.pass.value === R.admin.pass) { c.sys.routerSession = { at: now() }; c.sys.routerLock = null; log(R, 'Вхід', `Вхід у налаштування з ${'192.168.1.27'}.`); c.fs.emit('router'); return c.reload(); }
        const L = c.sys.routerLock ||= { n: 0 }; L.n++;
        if (L.n >= 5) { L.until = now() + 30e3; L.n = 0; }
        err.hidden = false; err.textContent = L.until > now() ? 'Забагато невдалих спроб. Зачекайте 30 с.' : `Неправильне ім’я користувача або пароль. Залишилось спроб: ${5 - L.n}.`;
        f.pass.value = ''; f.pass.focus();
      });
      el.querySelector('[data-forgot]').addEventListener('click', () => { const p = el.querySelector('.rt-forgot'); p.hidden = !p.hidden; });
      const rb = el.querySelector('[data-reset]'), bar = el.querySelector('.rt-hold i');
      let t0 = 0, raf = 0;
      const stop = () => { cancelAnimationFrame(raf); t0 = 0; bar.style.width = '0'; rb.classList.remove('down'); };
      const step = () => { const p = Math.min(1, (now() - t0) / 5000); bar.style.width = p * 100 + '%'; if (p >= 1) { stop(); factory(c); return; } raf = requestAnimationFrame(step); };
      rb.addEventListener('pointerdown', e => { e.preventDefault(); rb.setPointerCapture?.(e.pointerId); t0 = now(); rb.classList.add('down'); raf = requestAnimationFrame(step); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => rb.addEventListener(ev, () => { if (t0 && now() - t0 < 5000) { stop(); c.toast('Потрібно утримувати кнопку 5 секунд'); } }));
      return () => cancelAnimationFrame(raf);
    } };
}
function factory(c) {
  c.fs.s.router = defaults(); c.sys.routerSession = null; c.sys.routerLock = null;
  rebootNow(c, 'Заводські налаштування відновлено. Роутер перезавантажується…');
}
function rebootNow(c, msg = 'Роутер перезавантажується…', secs = 6) {
  c.sys.routerBusy = now() + secs * 1000; c.sys.routerSession = null;
  const R = rstate(c.fs); R.boot = now() + secs * 1000; log(R, 'Система', 'Перезавантаження.'); c.fs.emit('router');
  const el = c.tab.view;
  el.innerHTML = `<div class="rt rt-boot">${ui('router', 48)}<h1>${esc(msg)}</h1><div class="rt-bar"><i></i></div><p data-left>Залишилось ${secs} с. Не вимикайте роутер.</p></div>`;
  let left = secs; const bar = el.querySelector('.rt-bar i');
  const tm = setInterval(() => { left--; if (!el.isConnected) return clearInterval(tm); bar.style.width = ((secs - left) / secs * 100) + '%'; const p = el.querySelector('[data-left]'); if (p) p.textContent = `Залишилось ${left} с. Не вимикайте роутер.`; if (left <= 0) { clearInterval(tm); c.nav('/'); } }, 1000);
  requestAnimationFrame(() => { bar.style.width = (1 / secs * 100) + '%'; });
}

/* ── майстер швидкого налаштування ── */
const W_STEPS = ['Пароль адміністратора', 'Час', 'Тип підключення', 'Параметри підключення', 'Бездротова мережа', 'Перевірка'];
function wizardPage(R, ctx) {
  const d = ctx.tab.rtWizard ||= { i: R.setup ? 1 : 0, admin: '', tz: R.tz, type: R.wan.type, wan: { ...R.wan }, w: { s24: R.wifi.b24.ssid, s5: R.wifi.b5.ssid, p: R.setup ? R.wifi.b24.pass : '', same: true } };
  return { title: `Швидке налаштування — ${MODEL}`, secure: 'http', html: `<div class="rt">${R.setup ? header(R) : `<header class="rt-top"><div class="rt-brand">${ui('router', 26)}<b>Домовик</b><span>${MODEL}</span></div><span class="grow"></span><button class="rt-tb" data-logout>${ui('logout', 15)}Вийти</button></header>`}<div class="rt-wiz"></div></div>`,
    bind: (el, c) => { const box = el.querySelector('.rt-wiz'); const draw = () => { box.innerHTML = wizStep(R, d); bindEyes(box); bindStrength(box); }; draw(); bindTop(el, c, R);
      box.addEventListener('click', e => {
        if (e.target.closest('[data-detect]')) { const b = e.target.closest('[data-detect]'); b.disabled = true; b.innerHTML = `<i class="rt-spin"></i>Визначення…`; setTimeout(() => { d.type = 'dhcp'; draw(); box.querySelector('.rt-detected').hidden = false; }, 1200); }
        if (e.target.closest('[data-wback]')) { read(); d.i = Math.max(R.setup ? 1 : 0, d.i - 1); draw(); }
        if (e.target.closest('[data-skip]')) { R.setup = true; ctx.tab.rtWizard = null; log(R, 'Майстер', 'Швидке налаштування пропущено.'); c.fs.emit('router'); c.nav('/status'); }
      });
      box.addEventListener('change', e => { if (e.target.name === 'type') { d.type = e.target.value; draw(); } if (e.target.name === 'same') { read(); d.w.same = e.target.checked; draw(); } });
      const read = () => { const f = box.querySelector('form'); if (!f) return; const v = n => val(f, n);
        if (d.i === 0) { d.admin = f.p1.value; d.admin2 = f.p2.value; }
        if (d.i === 1) d.tz = v('tz');
        if (d.i === 2) d.type = f.querySelector('[name=type]:checked')?.value || d.type;
        if (d.i === 3) for (const k of ['ip', 'mask', 'gw', 'dns1', 'dns2', 'pppUser', 'server']) if (f.elements[k]) d.wan[k] = v(k); if (d.i === 3 && f.elements.pppPass) d.wan.pppPass = f.pppPass.value; if (d.i === 3 && f.elements.clone) d.wan.clone = v('clone');
        if (d.i === 4) { d.w.s24 = v('s24'); d.w.s5 = f.elements.s5 ? v('s5') : d.w.s24 + '_5G'; d.w.p = f.p.value; } };
      box.addEventListener('submit', e => {
        e.preventDefault(); const f = e.target; read(); const er = {};
        if (d.i === 0) { if (d.admin === 'admin' || d.admin === R.admin.pass) er.p1 = 'Придумайте новий пароль — не «admin».'; else if (d.admin.length < 6) er.p1 = 'Пароль має бути щонайменше 6 символів.'; else if (d.admin !== d.admin2) er.p2 = 'Паролі не збігаються.'; }
        if (d.i === 3) wanErrors(d.type, d.wan, er);
        if (d.i === 4) { if (!d.w.s24 || d.w.s24.length > 32) er.s24 = 'Назва мережі — від 1 до 32 символів.'; if (!d.w.same && (!d.w.s5 || d.w.s5.length > 32)) er.s5 = 'Назва мережі — від 1 до 32 символів.'; if (d.w.p.length < 8 || d.w.p.length > 63) er.p = 'Пароль Wi‑Fi — від 8 до 63 символів.'; }
        if (!showErrs(f, er)) return;
        if (d.i < 5) { d.i++; if (d.i === 3 && d.type === 'dhcp' && false) d.i++; draw(); return; }
        // застосувати
        if (!R.setup || d.admin) R.admin.pass = d.admin || R.admin.pass;
        R.tz = d.tz; R.wan = { ...R.wan, ...d.wan, type: d.type };
        Object.assign(R.wifi.b24, { ssid: d.w.s24, pass: d.w.p, on: true }); Object.assign(R.wifi.b5, { ssid: d.w.same ? d.w.s24 : d.w.s5, pass: d.w.p, on: true }); R.wifi.smart = d.w.same;
        R.setup = true; ctx.tab.rtWizard = null; log(R, 'Майстер', 'Швидке налаштування завершено.'); c.fs.emit('router');
        box.innerHTML = `<div class="rt-apply">${ui('router', 44)}<h2>Застосування налаштувань…</h2><div class="rt-bar"><i></i></div></div>`;
        const bar = box.querySelector('.rt-bar i'); let p = 0; const tm = setInterval(() => { p += 20; bar.style.width = p + '%'; if (p >= 100) { clearInterval(tm); if (!box.isConnected) return; box.innerHTML = `<div class="rt-apply">${ui('check', 44)}<h2>Готово!</h2><p>Роутер налаштовано. Пристрої тепер підключаються до Wi‑Fi «<b>${esc(R.wifi.b24.ssid)}</b>» з новим паролем.</p><p>Для входу в налаштування використовуйте ім’я <b>admin</b> і новий пароль.</p><a class="rt-btn primary" href="/status">Перейти до стану мережі</a></div>`; } }, 350);
      });
    } };
}
function wizStep(R, d) {
  const st = `<ol class="rt-steps">${W_STEPS.map((t, j) => `<li class="${j === d.i ? 'on' : j < d.i ? 'done' : ''}"><i>${j < d.i ? ui('check', 12) : j + 1}</i><span>${t}</span></li>`).join('')}</ol>`;
  const nav = (last) => `<div class="rt-actions">${d.i > (R.setup ? 1 : 0) ? '<button type="button" class="rt-btn" data-wback>Назад</button>' : ''}${d.i >= 1 ? '<button type="button" class="rt-link" data-skip>Пропустити майстер</button>' : ''}<span class="grow"></span><button class="rt-btn primary">${last ? 'Зберегти' : 'Далі'}</button></div>`;
  let body;
  if (d.i === 0) body = `<h2>Новий пароль адміністратора</h2><p class="rt-p">Стандартний пароль <b>admin</b> знає кожен, хто купив такий самий роутер. Придумайте свій — ним ви входитимете в ці налаштування.</p>
    ${F.row('Новий пароль', F.pass('p1', d.admin) + '<span class="rt-meter" data-meter="p1"><i></i><b></b></span>', 'Щонайменше 6 символів. Краще — літери, цифри й знаки.')}${F.row('Повторіть пароль', F.pass('p2', d.admin2 || ''))}`;
  else if (d.i === 1) body = `<h2>Часовий пояс</h2><p class="rt-p">Роутеру потрібен правильний час: для журналу подій, розкладу Wi‑Fi і батьківського контролю.</p>${F.row('Часовий пояс', F.sel('tz', d.tz, TZ))}`;
  else if (d.i === 2) body = `<h2>Тип підключення до інтернету</h2><p class="rt-p">Його вказано в договорі з провайдером. Не знаєте? Натисніть «Визначити автоматично».</p>
    <button type="button" class="rt-btn" data-detect>${ui('search', 15)}Визначити автоматично</button><p class="rt-detected" hidden>${ui('check', 15)} Виявлено: <b>Динамічна IP-адреса</b>.</p>
    <div class="rt-types">${[['dhcp', 'Динамічна IP-адреса', 'Провайдер видає адресу сам. Найпоширеніший тип.'], ['static', 'Статична IP-адреса', 'Провайдер дав постійну адресу, маску, шлюз і DNS.'], ['pppoe', 'PPPoE', 'Потрібні логін і пароль із договору.'], ['l2tp', 'L2TP', 'Логін, пароль і адреса сервера VPN провайдера.'], ['pptp', 'PPTP', 'Схоже на L2TP, застаріле.']].map(([k, t, s]) => `<label class="rt-type"><input type="radio" name="type" value="${k}" ${d.type === k ? 'checked' : ''}><span><b>${t}</b><small>${s}</small></span></label>`).join('')}</div>`;
  else if (d.i === 3) body = `<h2>Параметри підключення</h2>${wanFields(d.type, d.wan)}`;
  else if (d.i === 4) body = `<h2>Бездротова мережа</h2><p class="rt-p">Назва мережі (SSID) — те, що видно в списку Wi‑Fi на телефоні. Пароль — щонайменше 8 символів.</p>
    ${F.row('', F.sw('same', d.w.same, 'Однакова назва для 2,4 ГГц і 5 ГГц (Smart Connect)'))}${F.row(d.w.same ? 'Назва мережі' : 'Назва мережі 2,4 ГГц', F.inp('s24', d.w.s24, 'maxlength="32"'))}${d.w.same ? '' : F.row('Назва мережі 5 ГГц', F.inp('s5', d.w.s5, 'maxlength="32"'))}
    ${F.row('Пароль Wi‑Fi', F.pass('p', d.w.p, 'maxlength="63"') + '<span class="rt-meter" data-meter="p"><i></i><b></b></span>', 'Шифрування: WPA2-Personal.')}`;
  else body = `<h2>Перевірте налаштування</h2><table class="rt-sum"><tr><th>Пароль адміністратора</th><td>${d.admin ? '••••••• (новий)' : 'без змін'}</td></tr><tr><th>Часовий пояс</th><td>${esc(d.tz)}</td></tr><tr><th>Інтернет</th><td>${wanName(d.type)}</td></tr><tr><th>Wi‑Fi</th><td>${esc(d.w.s24)}${d.w.same ? '' : ' / ' + esc(d.w.s5)}</td></tr><tr><th>Пароль Wi‑Fi</th><td>${esc(d.w.p)}</td></tr></table>
    <p class="rt-note">${ui('info', 15)} Після збереження телефони й ноутбуки треба буде підключити до Wi‑Fi з новим паролем.</p>`;
  return `<div class="rt-wc">${st}<form class="rt-form" data-js>${body}${nav(d.i === 5)}</form></div>`;
}
const wanName = t => ({ dhcp: 'Динамічна IP-адреса', static: 'Статична IP-адреса', pppoe: 'PPPoE', l2tp: 'L2TP', pptp: 'PPTP' }[t]);
function wanFields(type, w) {
  if (type === 'dhcp') return `<p class="rt-p">Для динамічної IP-адреси нічого вводити не треба — провайдер видасть адресу сам.</p>${F.row('Клонувати MAC-адресу', F.sw('clone', w.clone, 'Використати MAC-адресу цього комп’ютера'), 'Потрібно, якщо провайдер «прив’язав» інтернет до MAC-адреси старого пристрою.')}`;
  if (type === 'static') return `${F.row('IP-адреса', F.inp('ip', w.ip, 'placeholder="наприклад 93.170.45.12"'))}${F.row('Маска підмережі', F.inp('mask', w.mask || '255.255.255.0'))}${F.row('Основний шлюз', F.inp('gw', w.gw, 'placeholder="наприклад 93.170.45.1"'))}${F.row('Основний DNS', F.inp('dns1', w.dns1, 'placeholder="наприклад 8.8.8.8"'))}${F.row('Додатковий DNS', F.inp('dns2', w.dns2), 'Необов’язково.')}`;
  return `${F.row('Ім’я користувача', F.inp('pppUser', w.pppUser, 'placeholder="з договору провайдера"'))}${F.row('Пароль', F.pass('pppPass', w.pppPass))}${type !== 'pppoe' ? F.row('Адреса сервера VPN', F.inp('server', w.server, 'placeholder="наприклад vpn.provider.ua"')) : ''}<p class="rt-note">${ui('info', 15)} Навчальний провайдер приймає будь-які логін і пароль.</p>`;
}
function wanErrors(type, w, er) {
  if (type === 'static') {
    if (!ipOk(w.ip)) er.ip = 'Неправильна IP-адреса. Приклад: 93.170.45.12'; else if (/^(10\.|192\.168\.|127\.)/.test(w.ip)) er.ip = 'Це адреса для локальних мереж, а тут потрібна адреса від провайдера.';
    if (!maskOk(w.mask)) er.mask = 'Неправильна маска. Приклад: 255.255.255.0';
    if (!ipOk(w.gw)) er.gw = 'Неправильна адреса шлюзу.'; else if (!er.ip && !er.mask && !sameNet(w.ip, w.gw, w.mask)) er.gw = 'Шлюз має бути в тій самій підмережі, що й IP-адреса.'; else if (w.gw === w.ip) er.gw = 'Шлюз не може збігатися з IP-адресою.';
    if (!ipOk(w.dns1)) er.dns1 = 'Неправильна адреса DNS. Приклад: 8.8.8.8';
    if (w.dns2 && !ipOk(w.dns2)) er.dns2 = 'Неправильна адреса DNS.';
  }
  if (['pppoe', 'l2tp', 'pptp'].includes(type)) { if (!w.pppUser) er.pppUser = 'Вкажіть ім’я користувача з договору.'; if (!w.pppPass) er.pppPass = 'Вкажіть пароль.'; if (type !== 'pppoe' && !w.server) er.server = 'Вкажіть адресу сервера.'; }
}

/* ═════════ розділи ═════════ */
function mount(el, c, R, page, sub) {
  const main = el.querySelector('.rt-main');
  const draw = () => { main.innerHTML = PAGES[page](R, sub, c); bindEyes(main); bindStrength(main); };
  draw();
  bindTop(el, c, R);
  el.querySelector('[data-help-off]')?.addEventListener('click', () => { c.sys.routerHelpOff = true; el.querySelector('.rt-help').hidden = true; });
  const flash = (m, bad) => { let b = main.querySelector('.rt-flash'); if (!b) { b = document.createElement('div'); main.prepend(b); } b.className = 'rt-flash' + (bad ? ' bad' : ''); b.innerHTML = `${ui(bad ? 'warn' : 'check', 16)}<span>${m}</span>`; clearTimeout(b.t); b.t = setTimeout(() => b.remove(), 3500); main.scrollTop = 0; };
  const saved = (who, msg) => { log(R, who, msg); c.fs.emit('router'); draw(); flash('Налаштування збережено.'); };
  main.addEventListener('change', e => { const f = e.target.form; if (f?.dataset.live != null) { const k = f.dataset.live; LIVE[k]?.(R, f, e, main); } });
  main.addEventListener('submit', e => { e.preventDefault(); const f = e.target; const fn = SAVE[f.dataset.save]; if (!fn) return; const er = {}; const res = fn(R, f, er, c); if (!showErrs(f, er)) return; if (res !== false) saved(...(res || [MENU.find(m => m[0] === page)[2], 'Налаштування змінено.'])); });
  main.addEventListener('click', async e => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    const r = await ACTS[a.dataset.act]?.(R, a, c, { draw, flash, saved, main });
    if (r === 'draw') draw();
  });
  const tm = setInterval(() => { if (!main.isConnected) return clearInterval(tm); main.querySelectorAll('[data-uptime]').forEach(x => { x.textContent = uptime(R); }); }, 1000);
  return () => clearInterval(tm);
}
function bindTop(el, c, R) {
  el.querySelector('[data-logout]')?.addEventListener('click', () => { c.sys.routerSession = null; log(R, 'Вхід', 'Вихід із налаштувань.'); c.fs.emit('router'); c.nav('/'); });
  el.querySelector('[data-reboot]')?.addEventListener('click', () => { if (confirmBox(el, 'Перезавантажити роутер? Інтернет зникне приблизно на хвилину.', () => rebootNow(c))) {} });
}
function confirmBox(el, text, ok, okText = 'Так') {
  const ov = document.createElement('div'); ov.className = 'rt-ov';
  ov.innerHTML = `<div class="rt-dlg"><p>${text}</p><div class="rt-actions"><span class="grow"></span><button class="rt-btn" data-no>Скасувати</button><button class="rt-btn primary" data-yes>${okText}</button></div></div>`;
  (el.querySelector('.rt') || el).appendChild(ov);
  ov.addEventListener('click', e => { if (e.target.closest('[data-yes]')) { ov.remove(); ok(); } if (e.target.closest('[data-no]') || e.target === ov) ov.remove(); });
  ov.querySelector('[data-yes]').focus();
  return true;
}
const uptime = R => { const s = Math.max(0, Math.floor((now() - R.boot) / 1000)) + 3 * 86400 + 4 * 3600; return `${Math.floor(s / 86400)} д ${Math.floor(s / 3600) % 24} год ${Math.floor(s / 60) % 60} хв ${s % 60} с`; };
const wanIp = R => R.wan.type === 'static' ? R.wan.ip || '—' : '100.64.23.15';
const devIcon = k => ui({ pc: 'desktop', phone: 'phone', laptop: 'laptop', tv: 'tv', printer: 'printer' }[k] || 'globe', 20);
const clientsOn = R => CLIENTS.filter(x => !(R.sec.macFilter.on && ((R.sec.macFilter.mode === 'deny') === R.sec.macFilter.list.includes(x.mac))) || x.kind === 'pc');
const ssidList = R => [R.wifi.b24.on && R.wifi.b24.ssid, R.wifi.b5.on && !R.wifi.smart && R.wifi.b5.ssid, R.wifi.guest.on && R.wifi.guest.ssid].filter(Boolean);

const PAGES = {
  status(R) {
    const cl = clientsOn(R), wifiOk = R.wifi.b24.on || R.wifi.b5.on;
    return `<h1 class="rt-h1">Стан мережі</h1><div class="rt-map"><div class="rt-node ok">${ui('globe', 34)}<b>Інтернет</b><small>Підключено</small></div><i class="rt-link-l ok"></i><div class="rt-node main">${ui('router', 38)}<b>${MODEL}</b><small>${R.lan.ip}</small></div><i class="rt-link-l ok"></i><div class="rt-node ok">${ui('users', 34)}<b>Пристрої</b><small>${cl.length} підключено</small></div></div>
      <div class="rt-grid">${F.card(`${ui('globe', 17)} Інтернет`, `<dl><dt>Стан</dt><dd class="ok">Підключено</dd><dt>Тип</dt><dd>${wanName(R.wan.type)}</dd><dt>IP-адреса WAN</dt><dd>${wanIp(R)}</dd><dt>Шлюз</dt><dd>${R.wan.type === 'static' ? esc(R.wan.gw) : '100.64.0.1'}</dd><dt>DNS</dt><dd>${R.wan.type === 'static' || R.wan.dnsManual ? esc([R.wan.dns1, R.wan.dns2].filter(Boolean).join(', ')) : '100.64.0.1'}</dd></dl>`, '<a class="rt-link" href="/internet">Змінити</a>')}
      ${F.card(`${ui('wifi', 17)} Wi‑Fi`, `<dl><dt>2,4 ГГц</dt><dd class="${R.wifi.b24.on ? 'ok' : 'off'}">${R.wifi.b24.on ? esc(R.wifi.b24.ssid) : 'Вимкнено'}</dd><dt>5 ГГц</dt><dd class="${R.wifi.b5.on ? 'ok' : 'off'}">${R.wifi.b5.on ? esc(R.wifi.b5.ssid) : 'Вимкнено'}</dd><dt>Гостьова</dt><dd class="${R.wifi.guest.on ? 'ok' : 'off'}">${R.wifi.guest.on ? esc(R.wifi.guest.ssid) : 'Вимкнено'}</dd><dt>Шифрування</dt><dd class="${['none', 'wep'].includes(R.wifi.b24.sec) ? 'bad' : ''}">${SEC[R.wifi.b24.sec]}</dd></dl>`, '<a class="rt-link" href="/wifi">Змінити</a>')}
      ${F.card(`${ui('network', 17)} Локальна мережа`, `<dl><dt>IP-адреса роутера</dt><dd>${R.lan.ip}</dd><dt>Маска</dt><dd>${R.lan.mask}</dd><dt>DHCP-сервер</dt><dd class="${R.dhcp.on ? 'ok' : 'off'}">${R.dhcp.on ? `Увімкнено (${R.dhcp.start} – ${R.dhcp.end})` : 'Вимкнено'}</dd><dt>MAC-адреса</dt><dd>${ROUTER_MAC}</dd></dl>`, '<a class="rt-link" href="/lan">Змінити</a>')}
      ${F.card(`${ui('tool', 17)} Система`, `<dl><dt>Модель</dt><dd>${MODEL}</dd><dt>Прошивка</dt><dd>${esc(R.sys.fw)}</dd><dt>Час роботи</dt><dd data-uptime>${uptime(R)}</dd><dt>Процесор</dt><dd><span class="rt-mini"><i style="width:14%"></i></span> 14%</dd><dt>Пам’ять</dt><dd><span class="rt-mini"><i style="width:47%"></i></span> 47%</dd></dl>`, '<a class="rt-link" href="/system">Змінити</a>')}</div>
      ${R.admin.pass === 'admin' ? `<p class="rt-warn">${ui('warn', 16)} Пароль адміністратора стандартний (admin). Змініть його в розділі <a href="/system/password">Система → Пароль</a>.</p>` : ''}${!wifiOk ? `<p class="rt-warn">${ui('warn', 16)} Обидві мережі Wi‑Fi вимкнено — телефони не зможуть підключитися.</p>` : ''}`;
  },
  internet(R) {
    const w = R.wan;
    return `<h1 class="rt-h1">Інтернет (WAN)</h1><form class="rt-form" data-save="wan" data-live="wan">${F.card('Підключення', `${F.row('Тип підключення', F.sel('type', w.type, [['dhcp', 'Динамічна IP-адреса'], ['static', 'Статична IP-адреса'], ['pppoe', 'PPPoE'], ['l2tp', 'L2TP'], ['pptp', 'PPTP']]))}<div data-wan>${wanFields(w.type, w)}</div>`)}
      ${F.card('Додатково', `${w.type !== 'static' ? F.row('DNS вручну', F.sw('dnsManual', w.dnsManual, 'Використовувати свої DNS-сервери'), 'Наприклад, 1.1.1.1 або 8.8.8.8 замість DNS провайдера.') + `<div data-dns ${w.dnsManual ? '' : 'hidden'}>${F.row('Основний DNS', F.inp('dns1', w.dns1))}${F.row('Додатковий DNS', F.inp('dns2', w.dns2))}</div>` : ''}${F.row('MTU', F.inp('mtu', w.mtu, 'type="number" min="576" max="1500"'), 'Найбільший розмір пакета. Змінюйте лише на прохання провайдера (зазвичай 1500, для PPPoE — 1480).')}`)}${F.save()}</form>`;
  },
  lan(R, sub) {
    const d = R.dhcp;
    return `<h1 class="rt-h1">Локальна мережа (LAN)</h1><div class="rt-tabs">${[['', 'LAN і DHCP'], ['reserve', 'Резервування адрес']].map(([k, t]) => `<a href="/lan${k ? '/' + k : ''}" class="${sub === k ? 'on' : ''}">${t}</a>`).join('')}</div>
    ${sub === 'reserve' ? `${F.card('Резервування IP-адрес', `<p class="rt-p">Пристрій із цією MAC-адресою завжди отримуватиме ту саму IP-адресу.</p><table class="rt-t"><thead><tr><th>Пристрій</th><th>MAC-адреса</th><th>IP-адреса</th><th></th></tr></thead><tbody>${d.reserve.map((r, i) => `<tr><td>${esc(r.name)}</td><td>${r.mac}</td><td>${r.ip}</td><td><button class="rt-ib" data-act="resDel" data-i="${i}" title="Видалити">${ui('trash', 15)}</button></td></tr>`).join('') || '<tr><td colspan="4" class="rt-none">Немає записів.</td></tr>'}</tbody></table>`)}
      <form class="rt-form" data-save="reserve">${F.card('Додати резервування', `${F.row('Пристрій', F.sel('dev', '', [['', 'Вибрати з підключених…'], ...CLIENTS.map(x => [x.mac, `${x.name} (${x.ip})`])]))}${F.row('Назва', F.inp('name', ''))}${F.row('MAC-адреса', F.inp('mac', '', 'placeholder="AA-BB-CC-DD-EE-FF"'))}${F.row('IP-адреса', F.inp('ip', '', `placeholder="${R.lan.ip.replace(/\d+$/, '50')}"`))}`)}${F.save('Додати')}</form>`
    : `<form class="rt-form" data-save="lan">${F.card('Роутер у локальній мережі', `${F.row('IP-адреса роутера', F.inp('ip', R.lan.ip), 'За цією адресою відкриваються налаштування. Змінивши її, відкривайте роутер за новою адресою.')}${F.row('Маска підмережі', F.sel('mask', R.lan.mask, ['255.255.255.0', '255.255.0.0', '255.255.255.128']))}`)}
      ${F.card('DHCP-сервер', `${F.row('DHCP-сервер', F.sw('on', d.on, 'Автоматично видавати IP-адреси'), 'Якщо вимкнути, кожен пристрій доведеться налаштовувати вручну.')}${F.row('Початкова адреса пулу', F.inp('start', d.start))}${F.row('Кінцева адреса пулу', F.inp('end', d.end))}${F.row('Час оренди адреси', F.inp('lease', d.lease, 'type="number" min="1" max="2880"'), 'У хвилинах. Після цього пристрій просить адресу знову.')}${F.row('DNS для пристроїв', F.inp('dns1', d.dns1, 'placeholder="Як у роутера"'), 'Необов’язково.')}`)}${F.save()}</form>`}`;
  },
  wifi(R, sub) {
    const tabs = [['', '2,4 ГГц'], ['5', '5 ГГц'], ['guest', 'Гостьова мережа'], ['wps', 'WPS']];
    const t = `<div class="rt-tabs">${tabs.map(([k, n]) => `<a href="/wifi${k ? '/' + k : ''}" class="${sub === k ? 'on' : ''}">${n}</a>`).join('')}</div>`;
    if (sub === 'guest') { const g = R.wifi.guest; return `<h1 class="rt-h1">Бездротова мережа</h1>${t}<form class="rt-form" data-save="guest">${F.card('Гостьова мережа', `<p class="rt-p">Окрема мережа для гостей: вони отримають інтернет, але не бачитимуть ваші комп’ютери, принтер і файли.</p>${F.row('Гостьова мережа', F.sw('on', g.on, 'Увімкнути'))}${F.row('Назва мережі (SSID)', F.inp('ssid', g.ssid, 'maxlength="32"'))}${F.row('Шифрування', F.sel('sec', g.sec, Object.entries(SEC)))}${F.row('Пароль', F.pass('pass', g.pass, 'maxlength="63"') + '<span class="rt-meter" data-meter="pass"><i></i><b></b></span>')}${F.row('Ізоляція', F.sw('isolate', g.isolate, 'Гості не бачать одне одного й локальну мережу'))}${F.row('Час роботи', F.sel('time', g.time, [['always', 'Завжди'], ['2h', '2 години'], ['1d', '1 день']]))}`)}${F.save()}</form>`; }
    if (sub === 'wps') return `<h1 class="rt-h1">Бездротова мережа</h1>${t}<form class="rt-form" data-save="wps">${F.card('WPS', `<p class="rt-p">WPS дозволяє підключити пристрій без пароля — натиснувши кнопку на роутері. Зручно, але менш безпечно: PIN-код WPS можна підібрати.</p>${F.row('WPS', F.sw('wps', R.wifi.wps, 'Увімкнути WPS'))}${F.row('PIN-код роутера', `<code class="rt-code">${R.wifi.wpsPin}</code> <button type="button" class="rt-link" data-act="wpsPin">Створити новий</button>`)}`)}${F.save()}</form>
      ${F.card('Підключити пристрій', `<p class="rt-p">Натисніть кнопку нижче, а потім протягом 2 хвилин — кнопку WPS на пристрої.</p><button class="rt-btn" data-act="wpsGo" ${R.wifi.wps ? '' : 'disabled'}>${ui('zap', 15)}Почати підключення WPS</button><p class="rt-wps" data-wps></p>`)}`;
    const k = sub === '5' ? 'b5' : 'b24', w = R.wifi[k], is5 = k === 'b5';
    const chs = ['auto', ...(is5 ? [36, 40, 44, 48, 52, 56, 60, 64, 100, 149, 153, 157, 161] : Array.from({ length: 13 }, (_, i) => i + 1))];
    return `<h1 class="rt-h1">Бездротова мережа</h1>${t}${R.wifi.smart && is5 ? `<p class="rt-note">${ui('info', 15)} Увімкнено Smart Connect: мережа 5 ГГц має ту саму назву й пароль, що й 2,4 ГГц.</p>` : ''}<form class="rt-form" data-save="wifi" data-k="${k}" data-live="sec">${F.card(`Мережа ${is5 ? '5' : '2,4'} ГГц`, `${F.row('Бездротова мережа', F.sw('on', w.on, 'Увімкнути'))}${!is5 ? F.row('Smart Connect', F.sw('smart', R.wifi.smart, 'Однакова назва й пароль для 2,4 і 5 ГГц'), 'Телефон сам вибиратиме кращий діапазон.') : ''}
      ${F.row('Назва мережі (SSID)', F.inp('ssid', w.ssid, `maxlength="32" ${R.wifi.smart && is5 ? 'disabled' : ''}`))}${F.row('Приховати мережу', F.sw('hidden', w.hidden, 'Не показувати назву в списку Wi‑Fi'), 'Підключатися доведеться, вводячи назву вручну. Від хакерів не захищає.')}
      ${F.row('Шифрування', F.sel('sec', w.sec, Object.entries(SEC), R.wifi.smart && is5 ? 'disabled' : ''))}<div data-secwarn>${secWarn(w.sec)}</div>${F.row('Пароль', F.pass('pass', w.pass, `maxlength="63" ${R.wifi.smart && is5 ? 'disabled' : ''}`) + '<span class="rt-meter" data-meter="pass"><i></i><b></b></span>', 'Від 8 до 63 символів.', 'pass')}`)}
      ${F.card('Додатково', `${F.row('Канал', F.sel('ch', w.ch, chs.map(x => [x, x === 'auto' ? 'Авто' : x])), 'Якщо поруч багато мереж, роутер у режимі «Авто» сам вибере найвільніший канал.')}${F.row('Ширина каналу', F.sel('width', w.width, is5 ? [['auto', 'Авто'], ['20', '20 МГц'], ['40', '40 МГц'], ['80', '80 МГц'], ['160', '160 МГц']] : [['auto', 'Авто'], ['20', '20 МГц'], ['40', '40 МГц']]))}${F.row('Потужність передавача', F.sel('power', w.power, [['low', 'Низька'], ['mid', 'Середня'], ['high', 'Висока']]), 'Менша потужність — мережу видно лише в межах квартири.')}`)}${F.save()}</form>`;
  },
  clients(R) {
    const cl = clientsOn(R);
    return `<h1 class="rt-h1">Підключені пристрої</h1>${F.card(`Пристрої (${cl.length})`, `<table class="rt-t"><thead><tr><th>Пристрій</th><th>IP-адреса</th><th>MAC-адреса</th><th>Підключення</th><th></th></tr></thead><tbody>${cl.map(x => `<tr><td class="rt-dev">${devIcon(x.kind)}<b>${esc(x.name)}</b>${x.kind === 'pc' ? '<span class="rt-tag">Цей ПК</span>' : ''}</td><td>${x.ip}</td><td>${x.mac}</td><td>${x.link}</td><td>${x.kind === 'pc' ? '' : `<button class="rt-link" data-act="block" data-mac="${x.mac}">Заблокувати</button>`}</td></tr>`).join('')}</tbody></table>`)}
      ${R.sec.macFilter.on && R.sec.macFilter.list.length ? `<p class="rt-note">${ui('info', 15)} Деякі пристрої не показано, бо їх блокує <a href="/security">фільтр MAC-адрес</a>.</p>` : ''}`;
  },
  forward(R, sub) {
    const F2 = R.fwd;
    const t = `<div class="rt-tabs">${[['', 'Віртуальні сервери'], ['dmz', 'DMZ'], ['upnp', 'UPnP']].map(([k, n]) => `<a href="/forward${k ? '/' + k : ''}" class="${sub === k ? 'on' : ''}">${n}</a>`).join('')}</div>`;
    if (sub === 'dmz') return `<h1 class="rt-h1">Переадресація портів</h1>${t}<form class="rt-form" data-save="dmz">${F.card('DMZ', `<p class="rt-warn">${ui('warn', 16)} DMZ відкриває <b>всі</b> порти вибраного пристрою для всього інтернету. Використовуйте лише якщо точно знаєте, навіщо.</p>${F.row('DMZ', F.sw('on', F2.dmz.on, 'Увімкнути'))}${F.row('IP-адреса пристрою', F.inp('ip', F2.dmz.ip, 'placeholder="192.168.1.27"'))}`)}${F.save()}</form>`;
    if (sub === 'upnp') return `<h1 class="rt-h1">Переадресація портів</h1>${t}<form class="rt-form" data-save="upnp">${F.card('UPnP', `<p class="rt-p">Програми (ігри, відеочати) можуть самі просити роутер відкрити потрібні порти.</p>${F.row('UPnP', F.sw('upnp', F2.upnp, 'Увімкнути'))}
      ${F2.upnp ? `<table class="rt-t"><thead><tr><th>Програма</th><th>Зовнішній порт</th><th>Пристрій</th><th>Протокол</th></tr></thead><tbody><tr><td>Microsoft Teams</td><td>50000</td><td>192.168.1.27</td><td>UDP</td></tr><tr><td>Minecraft</td><td>25565</td><td>192.168.1.102</td><td>TCP</td></tr></tbody></table>` : ''}`)}${F.save()}</form>`;
    return `<h1 class="rt-h1">Переадресація портів</h1>${t}${F.card('Віртуальні сервери', `<table class="rt-t"><thead><tr><th>Назва</th><th>Зовнішній порт</th><th>IP-адреса пристрою</th><th>Внутрішній порт</th><th>Протокол</th><th>Стан</th><th></th></tr></thead><tbody>
      ${F2.rules.map((r, i) => `<tr><td>${esc(r.name)}</td><td>${r.ext}</td><td>${r.ip}</td><td>${r.int}</td><td>${r.proto}</td><td><label class="rt-sw sm"><input type="checkbox" data-act="fwdToggle" data-i="${i}" ${r.on ? 'checked' : ''}><i></i></label></td><td><button class="rt-ib" data-act="fwdDel" data-i="${i}" title="Видалити">${ui('trash', 15)}</button></td></tr>`).join('') || '<tr><td colspan="7" class="rt-none">Правил ще немає. Додайте перше нижче — наприклад, для сервера Minecraft (порт 25565).</td></tr>'}</tbody></table>`)}
      <form class="rt-form" data-save="fwdAdd" data-live="fwd">${F.card('Додати правило', `${F.row('Готовий шаблон', F.sel('tpl', '', [['', 'Без шаблону'], ['mc', 'Minecraft (25565)'], ['web', 'Вебсервер (80)'], ['rdp', 'Віддалений робочий стіл (3389)'], ['ftp', 'FTP (21)']]))}${F.row('Назва', F.inp('name', '', 'placeholder="наприклад Сервер гри"'))}${F.row('Зовнішній порт', F.inp('ext', '', 'placeholder="25565 або 8000-8010"'), 'Порт, до якого підключаються з інтернету.')}
        ${F.row('Пристрій', F.sel('dev', '', [['', 'Вибрати…'], ...CLIENTS.map(x => [x.ip, `${x.name} (${x.ip})`])]))}${F.row('IP-адреса пристрою', F.inp('ip', '', 'placeholder="192.168.1.27"'))}${F.row('Внутрішній порт', F.inp('int', '', 'placeholder="такий самий"'), 'Порт програми на пристрої. Порожнє — такий самий, як зовнішній.')}${F.row('Протокол', F.sel('proto', 'TCP', ['TCP', 'UDP', 'TCP/UDP']))}`)}${F.save('Додати')}</form>`;
  },
  security(R) {
    const s = R.sec, m = s.macFilter;
    return `<h1 class="rt-h1">Безпека</h1><form class="rt-form" data-save="sec">${F.card('Брандмауер роутера', `${F.row('SPI-брандмауер', F.sw('spi', s.spi, 'Увімкнути'), 'Пропускає з інтернету лише відповіді на запити ваших пристроїв.')}${F.row('Захист від DoS-атак', F.sel('dos', s.dos, [['off', 'Вимкнено'], ['low', 'Низький'], ['medium', 'Середній'], ['high', 'Високий']]), 'Блокує, коли хтось засипає роутер величезною кількістю запитів.')}${F.row('Ping з інтернету', F.sw('wanPing', s.wanPing, 'Відповідати на ping із зовнішньої мережі'), 'Якщо вимкнено, роутер «невидимий» для сканерів в інтернеті.')}${F.row('Віддалене керування', F.sw('remote', s.remote, 'Дозволити відкривати налаштування з інтернету'), 'Краще вимкнути: інакше сторінку входу бачить увесь інтернет.')}`)}${F.save()}</form>
      <form class="rt-form" data-save="mac">${F.card('Фільтр MAC-адрес', `${F.row('Фільтр', F.sw('on', m.on, 'Увімкнути'))}${F.row('Режим', F.sel('mode', m.mode, [['deny', 'Заборонити вибраним пристроям'], ['allow', 'Дозволити лише вибраним пристроям']]))}
        <div class="rt-row"><label class="rt-l">Пристрої</label><div class="rt-ctl rt-checks">${CLIENTS.filter(x => x.kind !== 'pc').map(x => `<label class="rt-chk"><input type="checkbox" name="m_${x.mac}" ${m.list.includes(x.mac) ? 'checked' : ''}> ${esc(x.name)} <small>${x.mac}</small></label>`).join('')}<small class="rt-hint">Цей комп’ютер у списку не показано, щоб ви випадково не заблокували самі себе.</small><small class="rt-err" hidden></small></div></div>`)}${F.save()}</form>`;
  },
  parental(R) {
    const P = R.parental.profiles;
    return `<h1 class="rt-h1">Батьківський контроль</h1>${F.card('Профілі', P.length ? `<div class="rt-profs">${P.map((p, i) => `<div class="rt-prof${p.paused ? ' paused' : ''}"><div class="rt-av">${esc(p.name[0] || '?')}</div><div><b>${esc(p.name)}</b><small>${p.devices.length ? p.devices.map(m => esc(CLIENTS.find(x => x.mac === m)?.name || m)).join(', ') : 'Немає пристроїв'}</small><small>${p.limit ? `Ліміт: ${p.limit} хв на день` : 'Без ліміту часу'}${p.bed ? ` · Сон: ${p.bedFrom}–${p.bedTo}` : ''}${p.block.length ? ` · Заблоковано сайтів: ${p.block.length}` : ''}</small></div>
      <button class="rt-btn" data-act="pause" data-i="${i}">${ui(p.paused ? 'play' : 'stop', 14)}${p.paused ? 'Відновити інтернет' : 'Призупинити інтернет'}</button><button class="rt-ib" data-act="profDel" data-i="${i}" title="Видалити профіль">${ui('trash', 15)}</button></div>`).join('')}</div>` : '<p class="rt-none">Профілів ще немає.</p>')}
      <form class="rt-form" data-save="profAdd">${F.card('Новий профіль', `${F.row('Ім’я', F.inp('name', '', 'placeholder="наприклад Оля" maxlength="20"'))}
      <div class="rt-row" data-row="dev"><label class="rt-l">Пристрої</label><div class="rt-ctl rt-checks">${CLIENTS.filter(x => x.kind !== 'pc').map(x => `<label class="rt-chk"><input type="checkbox" name="d_${x.mac}"> ${esc(x.name)}</label>`).join('')}<small class="rt-err" hidden></small></div></div>
      ${F.row('Ліміт часу на день', F.sel('limit', '0', [['0', 'Без ліміту'], ['60', '1 година'], ['120', '2 години'], ['180', '3 години']]))}${F.row('Час сну', F.sw('bed', true, 'Вимикати інтернет на ніч'))}${F.row('З', F.inp('bedFrom', '22:00', 'placeholder="22:00" maxlength="5"'))}${F.row('До', F.inp('bedTo', '07:00', 'placeholder="07:00" maxlength="5"'))}
      ${F.row('Заблоковані сайти', `<textarea class="rt-in" name="block" rows="3" placeholder="по одному на рядок, наприклад pryz-vygraj.edvault"></textarea>`, 'Можна писати адресу або слово з адреси.')}`)}${F.save('Створити профіль')}</form>`;
  },
  qos(R) {
    const q = R.qos;
    return `<h1 class="rt-h1">Пріоритет (QoS)</h1><form class="rt-form" data-save="qos">${F.card('Налаштування', `${F.row('QoS', F.sw('on', q.on, 'Увімкнути пріоритет'))}${F.row('Швидкість завантаження', F.inp('down', q.down, 'type="number" min="1" max="1000"') + ' Мбіт/с', 'Яку швидкість обіцяє провайдер.')}${F.row('Швидкість віддачі', F.inp('up', q.up, 'type="number" min="1" max="1000"') + ' Мбіт/с')}
      <div class="rt-row"><label class="rt-l">Пристрої з пріоритетом</label><div class="rt-ctl rt-checks">${CLIENTS.map(x => `<label class="rt-chk"><input type="checkbox" name="p_${x.mac}" ${q.prio.includes(x.mac) ? 'checked' : ''}> ${esc(x.name)}</label>`).join('')}<small class="rt-err" hidden></small></div></div>`)}${F.save()}</form>`;
  },
  system(R, sub, c) {
    const tabs = [['', 'Прошивка'], ['backup', 'Резервна копія'], ['password', 'Пароль'], ['time', 'Час'], ['log', 'Журнал'], ['diag', 'Діагностика'], ['reset', 'Скидання']];
    const t = `<div class="rt-tabs">${tabs.map(([k, n]) => `<a href="/system${k ? '/' + k : ''}" class="${sub === k ? 'on' : ''}">${n}</a>`).join('')}</div>`;
    let body;
    if (sub === 'backup') {
      const files = (c.fs.node('C:\\Users\\Учень\\Downloads')?.children || []).filter(n => /\.(bin|cfg)$/i.test(n.name));
      body = `${F.card('Створити резервну копію', `<p class="rt-p">Усі налаштування роутера збережуться у файл у папці «Завантаження». Якщо щось піде не так — їх можна відновити.</p><button class="rt-btn primary" data-act="backup">${ui('download', 15)}Зберегти резервну копію</button>`)}
        ${F.card('Відновити з файлу', files.length ? `<p class="rt-p">Виберіть файл із папки «Завантаження»:</p><div class="rt-files">${files.map(f => `<label class="rt-chk"><input type="radio" name="bf" value="${esc(f.name)}"> ${esc(f.name)}</label>`).join('')}</div><button class="rt-btn" data-act="restore">${ui('restore', 15)}Відновити</button>` : '<p class="rt-none">У папці «Завантаження» немає файлів резервної копії (.bin). Спершу створіть копію.</p>')}`;
    } else if (sub === 'password') body = `<form class="rt-form" data-save="pass">${F.card('Пароль адміністратора', `${F.row('Ім’я користувача', F.inp('user', R.admin.user, 'disabled'))}${F.row('Поточний пароль', F.pass('old', ''))}${F.row('Новий пароль', F.pass('p1', '') + '<span class="rt-meter" data-meter="p1"><i></i><b></b></span>', 'Щонайменше 6 символів.')}${F.row('Повторіть новий пароль', F.pass('p2', ''))}`)}${F.save()}</form>`;
    else if (sub === 'time') body = `<form class="rt-form" data-save="time">${F.card('Системний час', `${F.row('Поточний час', `<b>${new Date().toLocaleString('uk-UA')}</b>`)}${F.row('Часовий пояс', F.sel('tz', R.tz, TZ))}${F.row('Синхронізація', F.sw('ntp', R.ntp, 'Брати точний час з інтернету (NTP)'))}`)}${F.save()}</form>`;
    else if (sub === 'log') body = F.card('Журнал подій', `<div class="rt-log">${R.sys.log.map(([t, w, m]) => `<div><small>${new Date(t).toLocaleString('uk-UA')}</small><b>${esc(w)}</b><span>${esc(m)}</span></div>`).join('') || '<p class="rt-none">Журнал порожній.</p>'}</div>`, `<button class="rt-link" data-act="logClear">Очистити</button>`);
    else if (sub === 'diag') body = F.card('Діагностика', `<p class="rt-p">Роутер сам перевірить, чи доступна адреса в інтернеті або в мережі.</p><form class="rt-form rt-diag" data-js><select class="rt-in" name="tool" aria-label="Інструмент"><option value="ping">ping</option><option value="tracert">tracert</option></select><input class="rt-in" name="host" aria-label="Адреса" value="poshuk.edvault" spellcheck="false"><button class="rt-btn primary" data-act="diag" type="button">Почати</button></form><pre class="rt-pre" data-out>Тут з’явиться результат перевірки. Виберіть ping або tracert і натисніть «Почати».</pre>`);
    else if (sub === 'reset') body = `${F.card('Перезавантаження', `<p class="rt-p">Роутер вимкнеться й увімкнеться знову. Налаштування збережуться. Інтернет зникне приблизно на хвилину.</p><button class="rt-btn" data-act="reboot">${ui('power', 15)}Перезавантажити</button>`)}
      ${F.card('Заводські налаштування', `<p class="rt-warn">${ui('warn', 16)} Усі налаштування буде видалено: назва й пароль Wi‑Fi, пароль адміністратора (знову admin / admin), правила, профілі. Доведеться пройти швидке налаштування заново.</p><button class="rt-btn danger" data-act="factory">${ui('restore', 15)}Відновити заводські налаштування</button>`)}
      ${F.card('Індикатори', `<form class="rt-form" data-save="leds">${F.row('Світлодіоди', F.sw('leds', R.sys.leds, 'Увімкнути вогники на корпусі'), 'Можна вимкнути на ніч, щоб не світили.')}${F.save()}</form>`)}`;
    else body = F.card('Оновлення прошивки', `<dl><dt>Модель</dt><dd>${MODEL}</dd><dt>Поточна версія</dt><dd>${esc(R.sys.fw)}</dd></dl><div data-fw>${R.sys.fw === NEW_FW ? `<p class="rt-ok">${ui('check', 16)} Встановлено найновішу прошивку.</p>` : `<button class="rt-btn primary" data-act="fwCheck">${ui('refresh', 15)}Перевірити оновлення</button>`}</div>`);
    return `<h1 class="rt-h1">Система</h1>${t}${body}`;
  },
};
const SEC = { none: 'Немає (відкрита мережа)', wep: 'WEP (застаріле)', wpa2: 'WPA2-Personal', wpa23: 'WPA2/WPA3-Personal', wpa3: 'WPA3-Personal' };
const secWarn = s => s === 'none' ? `<p class="rt-warn">${ui('warn', 16)} Без шифрування будь-хто поруч підключиться до вашої мережі й зможе бачити, що ви передаєте.</p>` : s === 'wep' ? `<p class="rt-warn">${ui('warn', 16)} WEP зламують за кілька хвилин. Виберіть WPA2 або WPA3.</p>` : '';
// миттєві зміни у формах (без збереження)
const LIVE = {
  wan(R, f, e, main) { if (e.target.name === 'type') f.querySelector('[data-wan]').innerHTML = wanFields(e.target.value, R.wan); if (e.target.name === 'dnsManual') f.querySelector('[data-dns]').hidden = !e.target.checked; bindEyes(f); },
  sec(R, f, e) { if (e.target.name === 'sec') { f.querySelector('[data-secwarn]').innerHTML = secWarn(e.target.value); const p = f.elements.pass; if (p) { p.disabled = e.target.value === 'none'; } } },
  fwd(R, f, e) {
    if (e.target.name === 'dev' && e.target.value) f.elements.ip.value = e.target.value;
    if (e.target.name === 'tpl') { const T = { mc: ['Сервер Minecraft', 25565, 'TCP'], web: ['Вебсервер', 80, 'TCP'], rdp: ['Віддалений робочий стіл', 3389, 'TCP'], ftp: ['FTP', 21, 'TCP'] }[e.target.value]; if (T) { f.elements.name.value = T[0]; f.elements.ext.value = T[1]; f.elements.int.value = T[1]; f.elements.proto.value = T[2]; } }
  },
};
const SAVE = {
  wan(R, f, er) { const w = { ...R.wan, type: val(f, 'type') }; for (const k of ['ip', 'mask', 'gw', 'dns1', 'dns2', 'pppUser', 'server']) if (f.elements[k]) w[k] = val(f, k); if (f.elements.pppPass) w.pppPass = f.pppPass.value; if (f.elements.clone) w.clone = val(f, 'clone'); if (f.elements.dnsManual) w.dnsManual = val(f, 'dnsManual');
    wanErrors(w.type, w, er); if (w.dnsManual && w.type !== 'static') { if (!ipOk(w.dns1)) er.dns1 = 'Неправильна адреса DNS. Приклад: 1.1.1.1'; if (w.dns2 && !ipOk(w.dns2)) er.dns2 = 'Неправильна адреса DNS.'; }
    const mtu = +val(f, 'mtu'); if (!(mtu >= 576 && mtu <= 1500)) er.mtu = 'MTU — число від 576 до 1500.'; w.mtu = mtu;
    if (Object.keys(er).length) return false; R.wan = w; return ['Інтернет', `Тип підключення: ${wanName(w.type)}.`]; },
  lan(R, f, er, c) {
    const ip = val(f, 'ip'), mask = val(f, 'mask'), on = val(f, 'on'), start = val(f, 'start'), end = val(f, 'end'), lease = +val(f, 'lease'), dns1 = val(f, 'dns1');
    if (!ipOk(ip) || /^(0|127|255)\./.test(ip) || /\.(0|255)$/.test(ip)) er.ip = 'Неправильна IP-адреса. Приклад: 192.168.1.1'; else if (!/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) er.ip = 'Для домашньої мережі використовують приватні адреси: 192.168.x.x, 10.x.x.x або 172.16–31.x.x.';
    if (!ipOk(start)) er.start = 'Неправильна адреса.'; if (!ipOk(end)) er.end = 'Неправильна адреса.';
    if (!er.ip && !er.start && !er.end) { if (!sameNet(ip, start, mask)) er.start = `Пул має бути в мережі роутера (${ip.replace(/\d+$/, 'x')}).`; else if (!sameNet(ip, end, mask)) er.end = `Пул має бути в мережі роутера (${ip.replace(/\d+$/, 'x')}).`; else if (ipN(end) < ipN(start)) er.end = 'Кінцева адреса має бути більшою за початкову.'; else if (ipN(ip) >= ipN(start) && ipN(ip) <= ipN(end)) er.start = 'Адреса роутера не може бути всередині пулу.'; }
    if (!(lease >= 1 && lease <= 2880)) er.lease = 'Від 1 до 2880 хвилин.'; if (dns1 && !ipOk(dns1)) er.dns1 = 'Неправильна адреса DNS.';
    if (Object.keys(er).length) return false;
    const moved = ip !== R.lan.ip; R.lan = { ip, mask }; Object.assign(R.dhcp, { on, start, end, lease, dns1 });
    if (moved) setTimeout(() => c.toast(`Адресу роутера змінено. Відкривайте його за адресою http://${ip}`), 50);
    return ['Локальна мережа', `IP роутера ${ip}, DHCP ${on ? 'увімкнено' : 'вимкнено'}.`];
  },
  reserve(R, f, er) { const mac = val(f, 'mac').toUpperCase().replace(/:/g, '-'), ip = val(f, 'ip'), name = val(f, 'name') || CLIENTS.find(x => x.mac === mac)?.name || 'Пристрій';
    if (!macOk(mac)) er.mac = 'MAC-адреса має вигляд AA-BB-CC-DD-EE-FF.'; else if (R.dhcp.reserve.some(r => r.mac === mac)) er.mac = 'Для цього пристрою вже є резервування.';
    if (!ipOk(ip)) er.ip = 'Неправильна IP-адреса.'; else if (!sameNet(ip, R.lan.ip, R.lan.mask)) er.ip = `Адреса має бути в мережі роутера (${R.lan.ip.replace(/\d+$/, 'x')}).`; else if (ip === R.lan.ip) er.ip = 'Це адреса самого роутера.'; else if (R.dhcp.reserve.some(r => r.ip === ip)) er.ip = 'Цю адресу вже зарезервовано.';
    if (Object.keys(er).length) return false; R.dhcp.reserve.push({ name, mac, ip }); return ['DHCP', `Зарезервовано ${ip} для ${name}.`]; },
  wifi(R, f, er) {
    const k = f.dataset.k, w = R.wifi[k], locked = R.wifi.smart && k === 'b5';
    const n = { on: val(f, 'on'), hidden: val(f, 'hidden'), ch: val(f, 'ch'), width: val(f, 'width'), power: val(f, 'power') };
    if (!locked) { n.ssid = val(f, 'ssid'); n.sec = val(f, 'sec'); n.pass = f.elements.pass.value; if (!n.ssid || n.ssid.length > 32) er.ssid = 'Назва мережі — від 1 до 32 символів.'; if (n.sec !== 'none' && (n.pass.length < 8 || n.pass.length > 63)) er.pass = 'Пароль — від 8 до 63 символів.'; if (n.sec === 'wep' && !/^([0-9a-f]{10}|[0-9a-f]{26}|.{5}|.{13})$/i.test(n.pass)) er.pass = 'Для WEP пароль має бути рівно 5 або 13 символів.'; }
    if (Object.keys(er).length) return false;
    Object.assign(w, n);
    if (k === 'b24') { R.wifi.smart = val(f, 'smart'); if (R.wifi.smart) Object.assign(R.wifi.b5, { ssid: w.ssid, pass: w.pass, sec: w.sec }); }
    return ['Wi‑Fi', `Мережа ${k === 'b5' ? '5' : '2,4'} ГГц: ${w.on ? `«${w.ssid}», ${SEC[w.sec]}` : 'вимкнено'}.`];
  },
  guest(R, f, er) { const g = { on: val(f, 'on'), ssid: val(f, 'ssid'), sec: val(f, 'sec'), pass: f.elements.pass.value, isolate: val(f, 'isolate'), time: val(f, 'time') };
    if (!g.ssid || g.ssid.length > 32) er.ssid = 'Назва мережі — від 1 до 32 символів.'; else if ([R.wifi.b24.ssid, R.wifi.b5.ssid].includes(g.ssid)) er.ssid = 'Гостьова мережа має називатися інакше, ніж основна.';
    if (g.sec !== 'none' && (g.pass.length < 8 || g.pass.length > 63)) er.pass = 'Пароль — від 8 до 63 символів.';
    if (Object.keys(er).length) return false; R.wifi.guest = g; return ['Wi‑Fi', `Гостьова мережа ${g.on ? 'увімкнена' : 'вимкнена'}.`]; },
  wps(R, f) { R.wifi.wps = val(f, 'wps'); return ['Wi‑Fi', `WPS ${R.wifi.wps ? 'увімкнено' : 'вимкнено'}.`]; },
  dmz(R, f, er) { const on = val(f, 'on'), ip = val(f, 'ip'); if (on && (!ipOk(ip) || !sameNet(ip, R.lan.ip, R.lan.mask) || ip === R.lan.ip)) er.ip = `Вкажіть адресу пристрою з вашої мережі (${R.lan.ip.replace(/\d+$/, 'x')}).`; if (Object.keys(er).length) return false; R.fwd.dmz = { on, ip }; return ['Переадресація', `DMZ ${on ? 'для ' + ip : 'вимкнено'}.`]; },
  upnp(R, f) { R.fwd.upnp = val(f, 'upnp'); return ['Переадресація', `UPnP ${R.fwd.upnp ? 'увімкнено' : 'вимкнено'}.`]; },
  fwdAdd(R, f, er) {
    const r = { name: val(f, 'name'), ext: val(f, 'ext'), ip: val(f, 'ip'), int: val(f, 'int') || val(f, 'ext'), proto: val(f, 'proto'), on: true };
    if (!r.name) er.name = 'Вкажіть назву.';
    if (!portRange(r.ext)) er.ext = 'Порт — число від 1 до 65535 або діапазон 8000-8010.'; else if (R.fwd.rules.some(x => x.ext === r.ext && (x.proto === r.proto || x.proto === 'TCP/UDP' || r.proto === 'TCP/UDP'))) er.ext = 'Цей зовнішній порт уже використовує інше правило.';
    if (!ipOk(r.ip)) er.ip = 'Неправильна IP-адреса.'; else if (!sameNet(r.ip, R.lan.ip, R.lan.mask) || r.ip === R.lan.ip) er.ip = `Вкажіть адресу пристрою з вашої мережі (${R.lan.ip.replace(/\d+$/, 'x')}).`;
    if (!portRange(r.int)) er.int = 'Порт — число від 1 до 65535.';
    if (Object.keys(er).length) return false; R.fwd.rules.push(r); return ['Переадресація', `Порт ${r.ext} → ${r.ip}:${r.int} (${r.proto}).`];
  },
  sec(R, f) { Object.assign(R.sec, { spi: val(f, 'spi'), dos: val(f, 'dos'), wanPing: val(f, 'wanPing'), remote: val(f, 'remote') }); return ['Безпека', `SPI ${R.sec.spi ? 'увімкнено' : 'вимкнено'}, віддалене керування ${R.sec.remote ? 'увімкнено' : 'вимкнено'}.`]; },
  mac(R, f, er) { const list = CLIENTS.filter(x => val(f, 'm_' + x.mac)).map(x => x.mac), on = val(f, 'on'), mode = val(f, 'mode');
    if (on && !list.length) { er.mode = 'Виберіть хоча б один пристрій.'; f.querySelector('.rt-checks .rt-err').hidden = false; f.querySelector('.rt-checks .rt-err').textContent = 'Виберіть хоча б один пристрій.'; return false; }
    R.sec.macFilter = { on, mode, list }; return ['Безпека', `Фільтр MAC ${on ? (mode === 'deny' ? 'забороняє' : 'дозволяє лише') + ' ' + list.length + ' пристр.' : 'вимкнено'}.`]; },
  profAdd(R, f, er) {
    const p = { name: val(f, 'name'), devices: CLIENTS.filter(x => val(f, 'd_' + x.mac)).map(x => x.mac), limit: +val(f, 'limit'), bed: val(f, 'bed'), bedFrom: val(f, 'bedFrom'), bedTo: val(f, 'bedTo'), block: val(f, 'block').split(/\n+/).map(s => s.trim()).filter(Boolean), paused: false };
    if (!p.name) er.name = 'Вкажіть ім’я.'; else if (R.parental.profiles.some(x => x.name === p.name)) er.name = 'Профіль із таким ім’ям уже є.';
    if (!p.devices.length) er.dev = 'Виберіть хоча б один пристрій.';
    const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/; if (p.bed) { if (!hhmm.test(p.bedFrom)) er.bedFrom = 'Час у форматі ГГ:ХХ, наприклад 22:00.'; if (!hhmm.test(p.bedTo)) er.bedTo = 'Час у форматі ГГ:ХХ, наприклад 07:00.'; }
    if (Object.keys(er).length) return false; R.parental.profiles.push(p); return ['Батьківський контроль', `Створено профіль «${p.name}».`];
  },
  qos(R, f, er) { const q = { on: val(f, 'on'), down: +val(f, 'down'), up: +val(f, 'up'), prio: CLIENTS.filter(x => val(f, 'p_' + x.mac)).map(x => x.mac) }; if (!(q.down >= 1 && q.down <= 1000)) er.down = 'Від 1 до 1000.'; if (!(q.up >= 1 && q.up <= 1000)) er.up = 'Від 1 до 1000.'; if (Object.keys(er).length) return false; R.qos = q; return ['QoS', `Пріоритет ${q.on ? 'увімкнено' : 'вимкнено'}.`]; },
  pass(R, f, er) { const old = f.old.value, p1 = f.p1.value, p2 = f.p2.value;
    if (old !== R.admin.pass) er.old = 'Неправильний поточний пароль.'; if (p1.length < 6) er.p1 = 'Щонайменше 6 символів.'; else if (p1 === old) er.p1 = 'Новий пароль має відрізнятися від старого.'; if (!er.p1 && p1 !== p2) er.p2 = 'Паролі не збігаються.';
    if (Object.keys(er).length) return false; R.admin.pass = p1; return ['Система', 'Пароль адміністратора змінено.']; },
  time(R, f) { R.tz = val(f, 'tz'); R.ntp = val(f, 'ntp'); return ['Система', `Часовий пояс: ${R.tz}.`]; },
  leds(R, f) { R.sys.leds = val(f, 'leds'); return ['Система', `Індикатори ${R.sys.leds ? 'увімкнено' : 'вимкнено'}.`]; },
};
const ACTS = {
  resDel(R, a) { R.dhcp.reserve.splice(+a.dataset.i, 1); return 'draw'; },
  fwdDel(R, a) { const r = R.fwd.rules.splice(+a.dataset.i, 1)[0]; log(R, 'Переадресація', `Видалено правило «${r.name}».`); return 'draw'; },
  fwdToggle(R, a) { const r = R.fwd.rules[+a.dataset.i]; r.on = a.checked; },
  profDel(R, a) { R.parental.profiles.splice(+a.dataset.i, 1); return 'draw'; },
  pause(R, a) { const p = R.parental.profiles[+a.dataset.i]; p.paused = !p.paused; log(R, 'Батьківський контроль', `${p.paused ? 'Призупинено' : 'Відновлено'} інтернет для «${p.name}».`); return 'draw'; },
  block(R, a, c) { const m = R.sec.macFilter; if (m.on && m.mode === 'allow') { m.list = m.list.filter(x => x !== a.dataset.mac); } else { m.on = true; m.mode = 'deny'; if (!m.list.includes(a.dataset.mac)) m.list.push(a.dataset.mac); } log(R, 'Безпека', `Пристрій ${a.dataset.mac} заблоковано.`); c.fs.emit('router'); return 'draw'; },
  wpsPin(R) { R.wifi.wpsPin = String(10000000 + Math.floor(Math.random() * 89999999)); return 'draw'; },
  wpsGo(R, a, c, { main }) { const out = main.querySelector('[data-wps]'); let s = 120; a.disabled = true; const tm = setInterval(() => { if (!out.isConnected) return clearInterval(tm); s -= 1; out.innerHTML = `${ui('wifi', 15)} Очікування пристрою… ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; if (s <= 115) { clearInterval(tm); out.innerHTML = `${ui('check', 15)} Пристрій «Планшет» підключено через WPS.`; a.disabled = false; log(R, 'Wi‑Fi', 'Підключено пристрій через WPS.'); } }, 1000); },
  logClear(R) { R.sys.log = []; return 'draw'; },
  diag(R, a, c, { main }) {
    const f = a.form, host = val(f, 'host') || 'poshuk.edvault', out = main.querySelector('[data-out]'), tool = val(f, 'tool');
    const lines = tool === 'ping' ? [`PING ${host}: 56 байт даних`, ...[0, 1, 2, 3].map(i => `64 байти від ${host}: icmp_seq=${i + 1} ttl=57 час=${(11 + Math.random() * 6).toFixed(1)} мс`), '', '--- статистика ---', '4 пакети надіслано, 4 отримано, 0% втрат']
      : [`traceroute до ${host}, не більше 30 переходів`, ' 1  100.64.0.1 (шлюз провайдера)  2.1 мс', ' 2  10.20.0.1 (мережа провайдера)  4.7 мс', ' 3  ua-ix.net (точка обміну трафіком)  8.9 мс', ` 4  ${host}  12.3 мс`];
    out.textContent = ''; let i = 0; const tm = setInterval(() => { if (!out.isConnected || i >= lines.length) return clearInterval(tm); out.textContent += lines[i++] + '\n'; }, 220);
  },
  backup(R, a, c, { flash }) { const R2 = JSON.parse(JSON.stringify(R)); c.download({ name: `config-domovyk-${new Date().toISOString().slice(0, 10)}.bin`, size: 0, content: 'DOMOVYK-CFG\r\n' + btoa(unescape(encodeURIComponent(JSON.stringify(R2)))) }); log(R, 'Система', 'Створено резервну копію налаштувань.'); flash('Файл резервної копії збережено в «Завантаження».'); },
  restore(R, a, c, { flash, main }) {
    const pick = main.querySelector('[name=bf]:checked'); if (!pick) return flash('Виберіть файл.', true);
    let data; try { const t = c.fs.readFile('C:\\Users\\Учень\\Downloads\\' + pick.value); if (!t.startsWith('DOMOVYK-CFG')) throw 0; data = JSON.parse(decodeURIComponent(escape(atob(t.split(/\r?\n/)[1])))); } catch (e) { return flash('Цей файл пошкоджено або це не резервна копія роутера «Домовик».', true); }
    confirmBox(main, 'Відновити налаштування з файлу? Поточні налаштування буде замінено, роутер перезавантажиться.', () => { c.fs.s.router = { ...defaults(), ...data, boot: now() }; log(c.fs.s.router, 'Система', `Налаштування відновлено з файлу ${pick.value}.`); rebootNow(c); }, 'Відновити');
  },
  reboot(R, a, c, { main }) { confirmBox(main, 'Перезавантажити роутер? Інтернет зникне приблизно на хвилину.', () => rebootNow(c), 'Перезавантажити'); },
  factory(R, a, c, { main }) { confirmBox(main, '<b>Відновити заводські налаштування?</b><br>Усе буде видалено, пароль знову стане admin.', () => factory(c), 'Відновити'); },
  fwCheck(R, a, c, { main }) {
    const box = main.querySelector('[data-fw]'); box.innerHTML = `<p><i class="rt-spin"></i> Пошук оновлень…</p>`;
    setTimeout(() => { if (!box.isConnected) return; box.innerHTML = `<div class="rt-upd"><b>Доступна нова версія ${NEW_FW}</b><ul><li>Виправлено вразливість у WPS.</li><li>Покращено стабільність Wi‑Fi 5 ГГц.</li><li>Додано захист від підбору пароля.</li></ul><p class="rt-warn">${ui('warn', 16)} Не вимикайте роутер під час оновлення!</p><button class="rt-btn primary" data-act="fwGo">${ui('download', 15)}Оновити</button></div>`; }, 1400);
  },
  fwGo(R, a, c, { main }) {
    const box = main.querySelector('[data-fw]'); box.innerHTML = `<p data-st>Завантаження прошивки… 0%</p><div class="rt-bar"><i></i></div>`;
    let p = 0; const bar = box.querySelector('.rt-bar i'), st = box.querySelector('[data-st]');
    const tm = setInterval(() => { if (!box.isConnected) return clearInterval(tm); p += 5; bar.style.width = p + '%'; st.textContent = (p < 50 ? 'Завантаження прошивки… ' : 'Запис прошивки… ') + p + '%'; if (p >= 100) { clearInterval(tm); R.sys.fw = NEW_FW; log(R, 'Система', `Прошивку оновлено до ${NEW_FW}.`); rebootNow(c, 'Прошивку оновлено. Роутер перезавантажується…'); } }, 160);
  },
};

/* ── дрібні допоміжні ── */
function bindEyes(root) { root.querySelectorAll('[data-eye]').forEach(b => { if (b.bound) return; b.bound = true; b.addEventListener('click', () => { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; b.innerHTML = ui(i.type === 'password' ? 'eye' : 'eyeOff', 16); b.title = i.type === 'password' ? 'Показати пароль' : 'Сховати пароль'; }); }); }
function bindStrength(root) {
  root.querySelectorAll('[data-meter]').forEach(m => { const inp = root.querySelector(`[name="${m.dataset.meter}"]`); if (!inp || inp.meter) return; inp.meter = true; const upd = () => { const [s, t] = strength(inp.value); m.dataset.s = s; m.querySelector('i').style.width = (inp.value ? (s + 1) * 20 : 0) + '%'; m.querySelector('b').textContent = t; }; inp.addEventListener('input', upd); upd(); });
}
