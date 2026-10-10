// Емулятор Windows · мережа: значок у треї з Wi‑Fi, «Мережеві підключення» (ncpa.cpl), стан адаптера, властивості IPv4, діагностика.
import { ui, appIcon } from './icons.js';
import { WM, esc, h, modal, menu, $ } from './ui.js';
import { uac } from './uac.js';
import { batched } from './fs.js';
import { netOf, adapters, primary, reach, syncNET, WIFI, NETWORKS, checkIPv4, diagnose, wifiConnect, wifiDisconnect, wifiForget, ipOk } from './net.js';

// Сила сигналу Wi‑Fi: 0–4 заповнені дуги
export const wifiBars = (lvl, s = 18) => `<svg class="ui-ico wbars" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" aria-hidden="true">${['M12 20h.01', 'M8.5 16.43a5 5 0 0 1 7 0', 'M5 12.86a10 10 0 0 1 14 0', 'M2 8.82a15 15 0 0 1 20 0'].map((d, i) => `<path d="${d}" stroke="currentColor" opacity="${i < lvl ? 1 : .28}"/>`).join('')}</svg>`;
const NO_NET = '<svg class="ui-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-3 3-3 15 0 18M12 3c3 3 3 15 0 18" opacity=".5"/><path d="m5 5 14 14"/></svg>';

// Короткий опис підключення для трею, Параметрів і «Мережевих підключень»
export function netSummary(fs) {
  const a = primary(fs);
  if (!a) return { ok: false, icon: NO_NET, title: 'Не підключено', sub: 'Немає підключення до Інтернету' };
  const inet = reach(fs, '8.8.8.8').ok;
  const icon = a.id === 'eth' ? ui('desktop', 16) : wifiBars(WIFI.find(w => w.ssid === a.ssid)?.signal || 0, 16);
  return { ok: inet, a, icon, title: a.ssid || a.net.name, sub: inet ? 'Підключено, є доступ до Інтернету' : 'Немає доступу до Інтернету' };
}
const changed = sys => { syncNET(sys.fs); sys.fs.emit('net'); };

/* ═════════ Значок мережі в треї ═════════ */
let fly = null;
export function closeNetFlyout() { fly?.close(); }
export function toggleNetFlyout(sys, anchor) {
  if (fly) return fly.close();
  const fs = sys.fs, S = netOf(fs);
  let open = null, err = '';
  const el = h('<div id="netFly" class="nfly" role="dialog" aria-label="Мережа"></div>');
  document.body.appendChild(el);
  const render = () => {
    const [eth, wifi] = adapters(fs), sum = netSummary(fs);
    el.innerHTML = `<div class="nf-tiles">
        <button class="nf-tile${S.wifi.on ? ' on' : ''}" data-wifi>${ui('wifi', 18)}<span>Wi‑Fi</span><small>${S.wifi.on ? esc(S.wifi.ssid || 'Увімкнено') : 'Вимкнено'}</small></button>
        <div class="nf-tile st">${eth.status === 'connected' || eth.status === 'noip' ? ui('desktop', 18) : ui('ban', 18)}<span>Ethernet</span><small>${{ connected: 'Підключено', noip: 'Без IP-адреси', disconnected: 'Кабель від’єднано', disabled: 'Вимкнено' }[eth.status]}</small></div>
      </div>
      <p class="nf-now ${sum.ok ? 'is-ok' : 'is-bad'}">${sum.icon}<span><b>${esc(sum.title)}</b><small>${esc(sum.sub)}</small></span></p>
      ${S.wifi.on ? `<h4>Мережі Wi‑Fi поруч</h4><div class="nf-list">${WIFI.map(w => {
        const cur = S.wifi.ssid === w.ssid, sel = open === w.ssid, lock = w.sec !== 'Відкрита', need = lock && !(w.ssid in S.wifi.saved);
        return `<div class="nf-w${cur ? ' cur' : ''}${sel ? ' sel' : ''}" data-w="${esc(w.ssid)}"><button class="nf-wh" data-pick="${esc(w.ssid)}">${wifiBars(w.signal, 20)}<span><b>${esc(w.ssid)}</b><small>${cur ? (wifi.status === 'connected' ? 'Підключено' : 'Підключено, без IP-адреси') + (lock ? ', захищено' : '') : lock ? 'Захищено' : 'Відкрита мережа — дані не шифруються'}</small></span>${lock ? ui('lock', 14) : ''}</button>
          ${sel ? cur ? `<div class="nf-act"><button class="btn" data-off>Відключитися</button>${w.ssid in S.wifi.saved ? `<button class="btn" data-forget>Забути</button>` : ''}</div>`
            : `<div class="nf-act col">${!lock ? '<p class="nf-warn">Інші люди в цій мережі можуть бачити, що ви надсилаєте. Не вводьте тут паролі від важливих сайтів.</p>' : ''}${need ? `<input class="inp" type="password" data-pass placeholder="Ключ безпеки мережі" autocomplete="off">` : ''}${err ? `<p class="nf-err">${esc(err)}</p>` : ''}<label class="chk"><input type="checkbox" data-auto checked> Підключатися автоматично</label><div class="nf-row">${need ? '<button class="btn primary" data-go>Далі</button>' : '<button class="btn primary" data-go>Підключитися</button>'}<button class="btn" data-cancel>Скасувати</button></div></div>` : ''}</div>`;
      }).join('')}</div>` : '<p class="nf-off">Wi‑Fi вимкнено. Увімкніть його, щоб побачити мережі поруч.</p>'}
      <footer><button class="nf-link" data-set>${ui('gear', 15)}Параметри мережі й Інтернету</button><button class="nf-link" data-ncpa>${ui('network', 15)}Мережеві підключення</button></footer>`;
    el.querySelector('[data-pass]')?.focus();
  };
  const place = () => { const r = anchor.getBoundingClientRect(); el.style.right = Math.max(8, innerWidth - r.right - 60) + 'px'; };
  const connect = () => {
    const w = WIFI.find(x => x.ssid === open), p = el.querySelector('[data-pass]'), auto = el.querySelector('[data-auto]')?.checked;
    if (p && !p.value) { err = 'Введіть ключ безпеки мережі (пароль Wi‑Fi).'; return render(); }
    const r = wifiConnect(fs, w.ssid, p ? p.value : undefined, auto);
    if (!r.ok) { err = r.badPass ? 'Неправильний ключ безпеки мережі. Повторіть спробу.' : w.net ? r.err : 'Не вдалося підключитися: це чужа мережа, пароля від якої ви не знаєте.'; return render(); }
    err = ''; open = null; changed(sys); sys.toast(`Підключено до мережі ${w.ssid}`);
  };
  el.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-wifi]')) { S.wifi.on = !S.wifi.on; if (!S.wifi.on) wifiDisconnect(fs); else if (!S.wifi.ssid) { const known = WIFI.find(w => w.ssid in S.wifi.saved && w.net); if (known) wifiConnect(fs, known.ssid); } open = null; changed(sys); return; }
    const pick = t.closest('[data-pick]'); if (pick) { open = open === pick.dataset.pick ? null : pick.dataset.pick; err = ''; return render(); }
    if (t.closest('[data-go]')) return connect();
    if (t.closest('[data-cancel]')) { open = null; err = ''; return render(); }
    if (t.closest('[data-off]')) { wifiDisconnect(fs); open = null; changed(sys); return; }
    if (t.closest('[data-forget]')) { wifiForget(fs, open); open = null; changed(sys); return; }
    if (t.closest('[data-set]')) { api.close(); sys.open('settings', 'network'); return; }
    if (t.closest('[data-ncpa]')) { api.close(); sys.open('ncpa'); }
  });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-pass]')) { e.preventDefault(); connect(); } });
  const later = batched(() => fly === api && render());
  const off = fs.on(w => { if (w === 'net' || w === 'reset') later(); });
  const away = e => { if (!e.target.closest('#netFly, #netTray, .uac-back')) api.close(); };
  const esc_ = e => { if (e.key === 'Escape' && !document.querySelector('.dlg-back, .uac-back')) api.close(); };
  const api = fly = { close() { off(); document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', esc_); el.remove(); anchor.classList.remove('on'); fly = null; } };
  document.addEventListener('pointerdown', away, true); document.addEventListener('keydown', esc_);
  anchor.classList.add('on');
  render(); place();
}

/* ═════════ Зміни, що потребують прав адміністратора ═════════ */
const asAdmin = (what, file = 'C:\\Windows\\System32\\netsh.exe') => uac({ app: what, icon: appIcon('ncpa', 32), file });
export async function setAdapterOn(sys, id, on) {
  if (!await asAdmin(on ? 'Увімкнути мережевий адаптер' : 'Вимкнути мережевий адаптер')) return false;
  const S = netOf(sys.fs); S[id].on = on; if (!on && id === 'wifi') S.wifi.ssid = null;
  if (on && id === 'wifi' && !S.wifi.ssid) { const k = WIFI.find(w => w.ssid in S.wifi.saved && w.net); if (k) wifiConnect(sys.fs, k.ssid); }
  S.dnsCache = {}; changed(sys); return true;
}

/* ═════════ Стан і відомості адаптера ═════════ */
export function adapterStatus(sys, id) {
  const fs = sys.fs, a = adapters(fs).find(x => x.id === id), S = netOf(fs);
  if (a.status === 'disabled' || a.status === 'disconnected') return modal({ title: `Стан: ${a.name}`, cls: 'small', html: `<p class="ns-msg">${ui('info', 18)}<span>${a.status === 'disabled' ? 'Цей адаптер вимкнено. Увімкніть його в «Мережевих підключеннях» (права кнопка → «Увімкнути»).' : id === 'eth' ? 'Мережевий кабель від’єднано, тому підключення немає.' : 'Wi‑Fi не підключено до жодної мережі. Виберіть мережу через значок мережі на панелі завдань.'}</span></p>`, buttons: [{ t: 'Закрити', v: null, primary: true, cancel: true }] });
  const inet = reach(fs, '8.8.8.8').ok && primary(fs)?.id === id;
  const up = Math.round((Date.now() - sys.procs.boot) / 1000), dur = `${String(Math.floor(up / 3600)).padStart(2, '0')}:${String(Math.floor(up / 60) % 60).padStart(2, '0')}:${String(up % 60).padStart(2, '0')}`;
  const sent = S.bytes.sent + up * 811, recv = S.bytes.recv + up * 9377;
  modal({ title: `Стан: ${a.name}`, cls: 'small nstat', html: `<fieldset><legend>Підключення</legend><dl class="ns-dl">
      <dt>Підключення IPv4:</dt><dd>${a.status === 'noip' ? 'Немає доступу до мережі' : inet ? 'Інтернет' : primary(fs)?.id === id ? 'Немає доступу до Інтернету' : 'Локальна мережа'}</dd>
      <dt>Стан носія:</dt><dd>Увімкнено</dd>${a.ssid ? `<dt>SSID:</dt><dd>${esc(a.ssid)}</dd>` : ''}
      <dt>Тривалість:</dt><dd>${dur}</dd><dt>Швидкість:</dt><dd>${id === 'eth' ? '1,0 Гбіт/с' : '573,5 Мбіт/с'}</dd></dl>
      <button class="btn" data-more>Відомості…</button></fieldset>
    <fieldset><legend>Активність</legend><div class="ns-act"><span>Надіслано</span>${ui(id === 'eth' ? 'desktop' : 'wifi', 30)}<span>Отримано</span><b>${sent.toLocaleString('uk-UA')}</b><i>Байтів:</i><b>${recv.toLocaleString('uk-UA')}</b></div></fieldset>
    <div class="ns-btns"><button class="btn" data-props>${ui('props', 15)}Властивості</button><button class="btn" data-dis>${ui('ban', 15)}Вимкнути</button><button class="btn" data-diag>${ui('tool', 15)}Діагностика</button></div>`,
    buttons: [{ t: 'Закрити', v: null, primary: true, cancel: true }],
    onOpen: api => api.el.addEventListener('click', e => {
      if (e.target.closest('[data-more]')) adapterDetails(sys, id);
      if (e.target.closest('[data-props]')) adapterProps(sys, id);
      if (e.target.closest('[data-dis]')) setAdapterOn(sys, id, false).then(ok => ok && api.close());
      if (e.target.closest('[data-diag]')) { api.close(); runDiagnose(sys); }
    }) });
}
function adapterDetails(sys, id) {
  const a = adapters(sys.fs).find(x => x.id === id);
  const rows = [['Суфікс DNS для підключення', a.dhcp ? a.suffix || '' : ''], ['Опис', a.desc], ['Фізична адреса', a.mac], ['DHCP увімкнено', a.dhcp ? 'Так' : 'Ні'], ['IPv4-адреса', a.ip || '—'], ['Маска підмережі IPv4', a.mask || '—'],
    ...(a.dhcp && a.ip ? [['Оренду отримано', new Date(sys.procs.boot).toLocaleString('uk-UA')], ['Оренда закінчується', new Date(sys.procs.boot + 864e5).toLocaleString('uk-UA')]] : []),
    ['Основний шлюз IPv4', a.gw || '—'], ['DHCP-сервер IPv4', a.dhcp && a.ip ? a.net.router : '—'], ['DNS-сервери IPv4', a.dns?.join(', ') || '—']];
  modal({ title: 'Відомості про мережеве підключення', cls: 'small', html: `<table class="ns-tbl"><thead><tr><th>Властивість</th><th>Значення</th></tr></thead><tbody>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`, buttons: [{ t: 'Закрити', v: null, primary: true, cancel: true }] });
}

/* ═════════ Властивості адаптера та IPv4 ═════════ */
const COMPONENTS = [['Клієнт для мереж Microsoft', 1], ['Спільний доступ до файлів і принтерів', 1], ['Планувальник пакетів QoS', 1], ['IP версії 4 (TCP/IPv4)', 1, 'ipv4'], ['Протокол мультиплексора мережевого адаптера', 0], ['IP версії 6 (TCP/IPv6)', 1], ['Відповідач виявлення топології', 1]];
export function adapterProps(sys, id) {
  const a = adapters(sys.fs).find(x => x.id === id);
  modal({ title: `${a.name}: властивості`, cls: 'small aprops', html: `<p class="ap-dev">${ui(id === 'eth' ? 'desktop' : 'wifi', 22)}<span><small>Підключення через:</small><b>${esc(a.desc)}</b></span></p>
    <p>Позначені компоненти використовуються цим підключенням:</p>
    <div class="ap-list">${COMPONENTS.map(([t, on, k]) => `<button class="ap-it${k ? ' sel' : ''}" ${k ? `data-k="${k}"` : ''}><input type="checkbox" ${on ? 'checked' : ''} disabled tabindex="-1">${ui('network', 14)}<span>${esc(t)}</span></button>`).join('')}</div>
    <div class="ap-btns"><button class="btn" data-ipv4>Властивості</button></div>
    <fieldset><legend>Опис</legend><p class="ap-desc">Протокол TCP/IP — основний протокол мереж. Тут налаштовують IP-адресу, маску, основний шлюз і DNS-сервери. Виберіть «IP версії 4» і натисніть «Властивості».</p></fieldset>`,
    buttons: [{ t: 'OK', v: null, primary: true }, { t: 'Скасувати', v: null, cancel: true }],
    onOpen: api => api.el.addEventListener('click', e => { if (e.target.closest('[data-ipv4]')) ipv4Dialog(sys, id); }) });
  const list = document.querySelector('.aprops .ap-list');
  list?.addEventListener('dblclick', e => { if (e.target.closest('[data-k="ipv4"]')) ipv4Dialog(sys, id); });
}

export function ipv4Dialog(sys, id) {
  const S = netOf(sys.fs), c = S[id], a = adapters(sys.fs).find(x => x.id === id);
  const v = { ip: c.dhcp ? '' : c.ip, mask: c.dhcp ? '' : c.mask, gw: c.dhcp ? '' : c.gw, dns1: c.dnsAuto ? '' : c.dns1, dns2: c.dnsAuto ? '' : c.dns2 };
  const field = (k, label) => `<label for="v4-${k}">${label}</label><span class="v4-f"><input class="inp mono" id="v4-${k}" data-f="${k}" value="${esc(v[k])}" maxlength="15" spellcheck="false" autocomplete="off" placeholder="___.___.___.___"><small class="v4-err" data-e="${k}" hidden></small></span>`;
  modal({ title: 'Властивості: IP версії 4 (TCP/IPv4)', cls: 'small v4', html: `${id === 'wifi' && a.ssid ? `<p class="v4-net">Мережа: <b>${esc(a.ssid)}</b></p>` : ''}
    <p>Параметри IP можна отримувати автоматично, якщо мережа це підтримує (DHCP). Інакше дізнайтеся їх в адміністратора мережі.</p>
    <fieldset><label class="rad"><input type="radio" name="v4ip" value="auto" ${c.dhcp ? 'checked' : ''}> Отримати IP-адресу автоматично</label>
      <label class="rad"><input type="radio" name="v4ip" value="man" ${c.dhcp ? '' : 'checked'}> Використовувати таку IP-адресу:</label>
      <div class="pg v4-g" data-g="ip">${field('ip', 'IP-адреса:')}${field('mask', 'Маска підмережі:')}${field('gw', 'Основний шлюз:')}</div></fieldset>
    <fieldset><label class="rad"><input type="radio" name="v4dns" value="auto" ${c.dnsAuto ? 'checked' : ''}> Отримати адресу DNS-сервера автоматично</label>
      <label class="rad"><input type="radio" name="v4dns" value="man" ${c.dnsAuto ? '' : 'checked'}> Використовувати такі адреси DNS-серверів:</label>
      <div class="pg v4-g" data-g="dns">${field('dns1', 'Основний DNS-сервер:')}${field('dns2', 'Додатковий DNS-сервер:')}</div></fieldset>
    <p class="v4-tip">${ui('info', 15)}<span>Підказка: у шкільній мережі роутер має адресу <b>${NETWORKS.school.router}</b>, DNS-сервер — <b>${NETWORKS.school.dns}</b>, маска — <b>255.255.255.0</b>. Вільні адреси для комп’ютерів: 192.168.1.50–192.168.1.99.</span></p>`,
    buttons: [{ t: 'OK', v: 'ok', primary: true }, { t: 'Скасувати', v: null, cancel: true }],
    onOpen: api => {
      const sync = () => {
        const manIp = api.$('[name=v4ip][value=man]').checked;
        // як у Windows: якщо IP вводять вручну, DNS теж лише вручну
        if (manIp) api.$('[name=v4dns][value=man]').checked = true;
        api.$('[name=v4dns][value=auto]').disabled = manIp;
        const manDns = api.$('[name=v4dns][value=man]').checked;
        api.$$('[data-g="ip"] input').forEach(i => { i.disabled = !manIp; });
        api.$$('[data-g="dns"] input').forEach(i => { i.disabled = !manDns; });
      };
      api.el.addEventListener('change', e => { if (e.target.name) sync(); });
      // лише цифри й крапки; маска підставляється сама, як у Windows
      api.el.addEventListener('input', e => { const i = e.target.closest('[data-f]'); if (i) { const p = i.selectionStart, nv = i.value.replace(/[^\d.]/g, ''); if (nv !== i.value) { i.value = nv; i.setSelectionRange(p - 1, p - 1); } api.$(`[data-e="${i.dataset.f}"]`).hidden = true; i.classList.remove('bad'); } });
      api.el.addEventListener('focusout', e => { if (e.target.dataset.f === 'ip' && ipOk(e.target.value) && !api.$('[data-f=mask]').value) api.$('[data-f=mask]').value = '255.255.255.0'; });
      sync();
    },
    onButton: async (b, api) => {
      if (b !== 'ok') return;
      const manIp = api.$('[name=v4ip][value=man]').checked, manDns = api.$('[name=v4dns][value=man]').checked;
      const f = k => api.$(`[data-f="${k}"]`).value.trim();
      const er = manIp ? checkIPv4({ ip: f('ip'), mask: f('mask'), gw: f('gw'), dns1: f('dns1'), dns2: f('dns2') }) : checkIPv4({ ip: '10.0.0.2', mask: '255.0.0.0', dns1: f('dns1'), dns2: f('dns2') });
      if (manDns && !f('dns1') && !f('dns2') && !manIp) er.dns1 = 'Вкажіть хоча б один DNS-сервер або виберіть «Автоматично».';
      if (Object.keys(er).length) {
        for (const [k, t] of Object.entries(er)) { const e = api.$(`[data-e="${k}"]`); if (e) { e.textContent = t; e.hidden = false; api.$(`[data-f="${k}"]`).classList.add('bad'); } }
        api.$('.bad')?.focus(); return false;
      }
      if (!await asAdmin('Змінити параметри мережевого адаптера')) return false;
      Object.assign(c, manIp ? { dhcp: false, ip: f('ip'), mask: f('mask'), gw: f('gw') } : { dhcp: true }, manDns ? { dnsAuto: false, dns1: f('dns1'), dns2: f('dns2') } : { dnsAuto: true }, { released: false });
      S.dnsCache = {}; S.arp = {}; changed(sys);
      const p = primary(sys.fs);
      sys.toast(p && p.id === id && p.manual && !reach(sys.fs, '8.8.8.8').ok ? 'Налаштування збережено. Але Інтернету немає — запустіть «Діагностику».' : 'Налаштування IPv4 збережено');
    } });
}

/* ═════════ Діагностика мереж ═════════ */
function fixFor(sys) {
  const fs = sys.fs, S = netOf(fs), [eth, wifi] = adapters(fs), a = primary(fs);
  if (!diagnose(fs).some(([k]) => k === 'bad')) return null;
  const auto = x => ({ t: 'Отримувати IP-адресу та DNS автоматично', admin: true, run: () => { Object.assign(S[x.id], { dhcp: true, dnsAuto: true, released: false }); } });
  if (!a) {
    if (!S.eth.on && wifi.status !== 'connected') return { t: 'Увімкнути адаптер Ethernet', admin: true, run: () => { S.eth.on = true; } };
    for (const x of [eth, wifi]) if (x.status === 'noip') return x.dhcp ? { t: 'Отримати нову IP-адресу (ipconfig /renew)', run: () => { S[x.id].released = false; } } : auto(x);
    if (!S.wifi.on) return { t: 'Увімкнути Wi‑Fi', run: () => { S.wifi.on = true; const k = WIFI.find(w => w.ssid in S.wifi.saved && w.net); if (k) wifiConnect(fs, k.ssid); } };
    return null;
  }
  if (a.manual) return auto(a);
  if (!S[a.id].dnsAuto) return { t: 'Отримувати адресу DNS-сервера автоматично', admin: true, run: () => { S[a.id].dnsAuto = true; } };
  return null;
}
export function runDiagnose(sys) {
  const api = modal({ title: 'Діагностика мереж Windows', cls: 'small diag', html: '<div class="dg-wait"><i class="spin"></i><span>Пошук проблем…</span></div>', buttons: [{ t: 'Закрити', v: null, cancel: true }] });
  const show = () => {
    if (!api.el.isConnected) return;
    const res = diagnose(sys.fs), fix = fixFor(sys), good = res.every(([k]) => k === 'ok');
    api.$('.mdl-body').innerHTML = `<h3 class="dg-h">${good ? 'Проблем не виявлено' : 'Знайдено проблеми'}</h3><ul class="dg-l">${res.map(([k, t]) => `<li class="${k}">${ui(k === 'ok' ? 'check' : 'warn', 16)}<span>${esc(t)}</span></li>`).join('')}</ul>
      ${fix ? `<div class="dg-fix"><span>Рекомендоване виправлення: <b>${esc(fix.t)}</b>${fix.admin ? ' (потрібні права адміністратора)' : ''}</span><button class="btn primary" data-fix>${fix.admin ? ui('shield', 14) : ''}Застосувати виправлення</button></div>` : good ? '' : '<p class="dg-note">Автоматично це не виправити. Перевірте властивості IPv4 і порівняйте з підказкою у вікні властивостей.</p>'}`;
    api.$('[data-fix]')?.addEventListener('click', async () => {
      if (fix.admin && !await asAdmin('Діагностика мереж Windows', 'C:\\Windows\\System32\\msdt.exe')) return;
      fix.run(); netOf(sys.fs).dnsCache = {}; changed(sys);
      api.$('.mdl-body').innerHTML = '<div class="dg-wait"><i class="spin"></i><span>Застосування виправлення…</span></div>'; setTimeout(show, 700);
    });
  };
  setTimeout(show, 900);
}

/* ═════════ «Мережеві підключення» (ncpa.cpl) ═════════ */
export class NetConnections {
  constructor(sys) {
    this.sys = sys; this.sel = null;
    this.win = WM.open({ app: 'ncpa', exe: 'explorer.exe', title: 'Мережеві підключення', icon: appIcon('ncpa', 16), w: 820, h: 440, minW: 520, minH: 300 });
    this.win.body.innerHTML = `<div class="ncpa"><div class="nc-bar"><span class="nc-path">${ui('network', 16)} Панель керування <i>›</i> Мережа й Інтернет <i>›</i> <b>Мережеві підключення</b></span></div>
      <div class="nc-tools"></div><div class="nc-items" tabindex="0"></div><p class="nc-foot"></p></div>`;
    const body = this.win.body;
    body.addEventListener('click', e => {
      const it = e.target.closest('[data-ad]'); const tb = e.target.closest('[data-t]');
      if (tb) return this.act(tb.dataset.t);
      this.sel = it ? it.dataset.ad : null; this.paint();
    });
    body.addEventListener('dblclick', e => { const it = e.target.closest('[data-ad]'); if (it) { this.sel = it.dataset.ad; this.act(this.cur().status === 'disabled' ? 'on' : 'status'); } });
    body.addEventListener('contextmenu', e => {
      const it = e.target.closest('[data-ad]'); if (!it) return;
      e.preventDefault(); this.sel = it.dataset.ad; this.paint();
      const a = this.cur(), S = netOf(sys.fs);
      menu(e.clientX, e.clientY, [a.status === 'disabled' ? { t: 'Увімкнути', icon: 'power', on: () => this.act('on') } : { t: 'Вимкнути', icon: 'ban', on: () => this.act('off') },
        a.id === 'wifi' && a.status !== 'disabled' && { t: a.ssid ? 'Відключитися від мережі' : 'Підключитися…', icon: 'wifi', on: () => a.ssid ? (wifiDisconnect(sys.fs), changed(sys)) : toggleNetFlyout(sys, $('#netTray')) },
        a.id === 'eth' && { t: S.eth.cable ? 'Від’єднати мережевий кабель' : 'Під’єднати мережевий кабель', icon: 'link', on: () => { S.eth.cable = !S.eth.cable; S.dnsCache = {}; changed(sys); sys.toast(S.eth.cable ? 'Кабель під’єднано' : 'Кабель від’єднано'); } },
        '-', { t: 'Стан', icon: 'info', on: () => this.act('status'), disabled: a.status === 'disabled' }, { t: 'Діагностика', icon: 'tool', on: () => this.act('diag') }, '-', { t: 'Властивості', icon: 'props', on: () => this.act('props') }]);
    });
    this.win.el.addEventListener('keydown', e => { if (e.key === 'Enter' && this.sel) this.act(this.cur().status === 'disabled' ? 'on' : 'status'); if (e.key === 'F5') { e.preventDefault(); this.render(); } });
    const later = batched(() => this.win.el.isConnected && this.render());
    this.win.cleanup(sys.fs.on(w => { if (w === 'net' || w === 'reset') later(); }));
    this.render();
  }
  cur() { return adapters(this.sys.fs).find(a => a.id === this.sel); }
  act(k) {
    const a = this.cur(); if (!a && k !== 'diag') return;
    if (k === 'on' || k === 'off') return setAdapterOn(this.sys, a.id, k === 'on');
    if (k === 'status') return a.status === 'disabled' ? null : adapterStatus(this.sys, a.id);
    if (k === 'props') return adapterProps(this.sys, a.id);
    if (k === 'diag') return runDiagnose(this.sys);
  }
  // лише виділення: не перемальовуємо плитки, щоб подвійне клацання спрацювало
  paint() {
    this.win.body.querySelectorAll('[data-ad]').forEach(x => x.classList.toggle('on', x.dataset.ad === this.sel));
    this.tools();
  }
  tools() {
    const a = this.cur(), n = adapters(this.sys.fs).length;
    this.win.body.querySelector('.nc-tools').innerHTML = `<button class="nc-t" data-t="${a?.status === 'disabled' ? 'on' : 'off'}" ${a ? '' : 'disabled'}>${ui(a?.status === 'disabled' ? 'power' : 'ban', 15)}${a?.status === 'disabled' ? 'Увімкнути цей мережевий пристрій' : 'Вимкнути цей мережевий пристрій'}</button><button class="nc-t" data-t="diag">${ui('tool', 15)}Діагностувати це підключення</button><button class="nc-t" data-t="status" ${a && a.status !== 'disabled' ? '' : 'disabled'}>${ui('info', 15)}Переглянути стан</button><button class="nc-t" data-t="props" ${a ? '' : 'disabled'}>${ui('props', 15)}Змінити параметри</button>`;
    this.win.body.querySelector('.nc-foot').textContent = `Елементів: ${n}${a ? ' · Вибрано 1 елемент' : ''}`;
  }
  render() {
    const list = adapters(this.sys.fs);
    const st = x => x.status === 'disabled' ? 'Вимкнено' : x.status === 'disconnected' ? (x.id === 'eth' ? 'Мережевий кабель від’єднано' : 'Не підключено') : x.status === 'noip' ? `${x.ssid || x.net.name} · Без IP-адреси` : x.ssid || x.net.name;
    this.win.body.querySelector('.nc-items').innerHTML = list.map(x => `<button class="nc-it${x.id === this.sel ? ' on' : ''} ${x.status}" data-ad="${x.id}"><span class="nc-ic">${x.id === 'eth' ? NC_ETH : NC_WIFI}${x.status === 'disabled' ? '<i class="nc-x off"></i>' : x.status === 'disconnected' ? '<i class="nc-x">×</i>' : ''}</span><span class="nc-tx"><b>${esc(x.name)}</b><small>${esc(st(x))}</small><small>${esc(x.desc)}</small></span></button>`).join('');
    this.tools();
  }
}
const NC_ETH = '<svg width="44" height="44" viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="8" width="36" height="24" rx="2.5" fill="#2b88d8"/><rect x="9" y="11" width="30" height="18" fill="#cfe8fb"/><path d="M18 40h12M24 32v8" stroke="#3d4a5a" stroke-width="2.6" stroke-linecap="round"/></svg>';
const NC_WIFI = '<svg width="44" height="44" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="38" r="3" fill="#2b88d8"/><path d="M15 30a13 13 0 0 1 18 0M9 23.5a21 21 0 0 1 30 0M3.5 17a29 29 0 0 1 41 0" fill="none" stroke="#2b88d8" stroke-width="3.4" stroke-linecap="round"/></svg>';

/* ═════════ Сторінка «Мережа й Інтернет» у Параметрах ═════════ */
export function networkPage(sys) {
  const fs = sys.fs, S = netOf(fs), [eth, wifi] = adapters(fs), sum = netSummary(fs), a = sum.a;
  return `<p class="sa-crumb">Мережа й Інтернет</p>
    <section class="sa-pc net ${sum.ok ? 'is-ok' : 'is-bad'}"><span class="sn-ic">${a ? (a.id === 'eth' ? NC_ETH : NC_WIFI) : NC_ETH}</span><div><b>${esc(sum.title)}</b><small>${esc(sum.sub)}</small>${a ? `<small>${esc(a.name)} · IP-адреса ${esc(a.ip)}${a.manual ? ' (вручну)' : ''}</small>` : ''}</div>${a ? `<button class="btn" data-np="props" data-id="${a.id}">Властивості</button>` : ''}</section>
    <h3>Підключення</h3>
    <section class="sa-card">${ui('wifi', 22)}<div><b>Wi‑Fi</b><small>${S.wifi.on ? (wifi.ssid ? `Підключено до ${esc(wifi.ssid)}` : 'Не підключено. Виберіть мережу через значок мережі на панелі завдань.') : 'Вимкнено'}</small></div><span class="sw-row">${S.wifi.on ? 'Увімк.' : 'Вимк.'}<button class="toggle${S.wifi.on ? ' on' : ''}" data-np="wifi" aria-label="Wi‑Fi" aria-pressed="${S.wifi.on}"><i></i></button></span></section>
    <section class="sa-card">${ui('desktop', 22)}<div><b>Ethernet</b><small>${{ connected: `Підключено до ${esc(eth.net?.name || '')}`, noip: 'Немає IP-адреси', disconnected: 'Мережевий кабель від’єднано', disabled: 'Адаптер вимкнено' }[eth.status]}</small></div><button class="btn" data-np="props" data-id="eth">Властивості IPv4</button></section>
    <h3>Додаткові параметри</h3>
    <section class="sa-card">${ui('network', 22)}<div><b>Мережеві підключення</b><small>Увімкнути чи вимкнути адаптери, переглянути їхній стан (ncpa.cpl)</small></div><button class="btn" data-np="ncpa">Відкрити</button></section>
    <section class="sa-card">${ui('tool', 22)}<div><b>Діагностика мережі</b><small>Знайти, чому немає Інтернету, і спробувати виправити</small></div><button class="btn" data-np="diag">Діагностика</button></section>
    <section class="sa-card">${ui('refresh', 22)}<div><b>Скидання мережі</b><small>Повернути всі мережеві налаштування до початкових (адреси автоматично, Wi‑Fi забуде паролі)</small></div><button class="btn" data-np="reset">Скинути</button></section>`;
}
export async function networkClick(sys, el) {
  const S = netOf(sys.fs), k = el.dataset.np;
  if (k === 'wifi') { S.wifi.on = !S.wifi.on; if (!S.wifi.on) wifiDisconnect(sys.fs); else { const w = WIFI.find(x => x.ssid in S.wifi.saved && x.net); if (w) wifiConnect(sys.fs, w.ssid); } changed(sys); }
  if (k === 'props') ipv4Dialog(sys, el.dataset.id);
  if (k === 'ncpa') sys.open('ncpa');
  if (k === 'diag') runDiagnose(sys);
  if (k === 'reset') {
    if (!await asAdmin('Скидання мережі')) return;
    const { netDefaults } = await import('./net.js');
    sys.fs.s.net = netDefaults(); changed(sys); sys.toast('Мережеві налаштування скинуто');
  }
}
