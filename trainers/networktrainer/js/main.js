// Мережі · Edvault — пам’ятка, жива схема мережі (кабелі мишкою, налаштування пристроїв, ping),
// перевірка цілей з анімацією пакетів, запитання, прогрес і результати для вчителя.
import { CHAPTERS, LEVELS } from './levels.js';
import { MASKS, parseIp, isHost, devOf, portOf, canLink, effective, ping, checkGoals, netStars, starsFor, cloneNet, usedBy, applyOp } from './logic.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c;

/* ═════════ Іконки ═════════ */
const P = {
  network: '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M12 12V8"/>',
  pc: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',
  laptop: '<path d="M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z"/><path d="M20.054 15.987H3.946"/>',
  server: '<rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 6h.01M6 18h.01"/>',
  printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  switch: '<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 12h.01M10 12h.01M14 12h.01M18 12h.01"/>',
  router: '<rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6.01 18H6M10.01 18H10M15 10v4M17.84 7.17a4 4 0 0 0-5.66 0M20.66 4.34a8 8 0 0 0-11.31 0"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>',
  plug: '<path d="M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  signpost: '<path d="M12 13v8M12 3v3"/><path d="M4 6a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h13a2 2 0 0 0 1.152-.365l3.424-2.317a1 1 0 0 0 0-1.635l-3.424-2.318A2 2 0 0 0 17 6z"/>',
  wand: '<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72M14 7l3 3M5 6v4M19 14v4M10 2v2M7 8H3M21 16h-4M11 3H9"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  terminal: '<path d="m4 17 6-6-6-6M12 19h8"/>',
  school: '<path d="M14 22v-4a2 2 0 1 0-4 0v4"/><path d="m18 10 3.447 1.724a1 1 0 0 1 .553.894V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7.382a1 1 0 0 1 .553-.894L6 10"/><path d="M18 5v17M4 6l7.106-3.553a2 2 0 0 1 1.788 0L20 6M6 5v17"/><circle cx="12" cy="9" r="2"/>',
  cursor: '<path d="M12.586 12.586 19 19M3.688 3.037a.497.497 0 0 0-.651.651l6.5 15.999a.501.501 0 0 0 .947-.062l1.569-6.083a2 2 0 0 1 1.448-1.479l6.124-1.579a.5.5 0 0 0 .063-.947z"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  left: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4"/>',
  star: '<path fill="currentColor" stroke="none" d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
};
const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || P.info}</svg>`;
const starsHtml = n => `<span class="stars">${[0, 1, 2].map(i => icon('star', i < n ? 'on' : '')).join('')}</span>`;
document.querySelectorAll('[data-icon]').forEach(e => { e.outerHTML = icon(e.dataset.icon); });
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); }

/* ═════════ Тема ═════════ */
const syncTheme = () => { $('themeBtn').innerHTML = icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon'); };
$('themeBtn').onclick = () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('edvault-theme', next); } catch (e) { /* приватний режим */ }
  syncTheme();
};
syncTheme();

/* ═════════ Прогрес ═════════ */
const KEY = 'edvault-network';
let progress = (() => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } })();
if (!progress || typeof progress !== 'object') progress = {};
progress = { name: progress.name || '', best: progress.best || {} };
const saveProgress = () => { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* немає місця */ } };
const best = id => progress.best[id];
const unlocked = i => i === 0 || (best(LEVELS[i - 1].id)?.stars || 0) >= 1;
const passed = () => LEVELS.filter(l => best(l.id)?.stars).length;
const totalStars = () => LEVELS.reduce((s, l) => s + (best(l.id)?.stars || 0), 0);
const netsDone = () => LEVELS.filter(l => l.kind === 'net' && best(l.id)?.stars).length;

/* ═════════ Схема мережі ═════════ */
const W = 720, H = 440;
const TYPE_NAME = { pc: 'Комп’ютер', laptop: 'Ноутбук', server: 'Сервер', printer: 'Принтер', switch: 'Комутатор', router: 'Роутер', cloud: 'Інтернет' };
let net = null, sel = null, drag = null, edits = new Set(), results = null, pingLog = [];
const can = what => edits.has(what);
const dev = id => net.devices.find(d => d.id === id);
// координати кінця кабелю: центр пристрою або «таблички» порту роутера
const lanPorts = r => Object.keys(r.ports).filter(p => p !== 'wan');
function epPos(ep) {
  const d = dev(devOf(ep)), p = portOf(ep);
  if (!p) return { x: d.x, y: d.y };
  if (p === 'wan') return { x: d.x, y: d.y - 46 };
  return { x: d.x, y: d.y + 44 + lanPorts(d).indexOf(p) * 24 };
}
function hostLabel(d, eff) {
  const e = eff[d.id];
  if (d.auto) return e.ip ? { t: e.ip, cls: 'auto' } : { t: 'чекає адресу…', cls: 'none' };
  return d.ip ? { t: d.ip, cls: parseIp(d.ip) == null ? 'bad' : '' } : { t: 'немає адреси', cls: 'none' };
}
const svgIcon = (n, x, y, s) => `<svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[n]}</svg>`;
function boardSvg() {
  const eff = effective(net);
  const zones = (level.zones || []).map(z => `<g class="zone"><rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="18"/><text x="${z.x + 14}" y="${z.y + 20}">${esc(z.label)}</text></g>`).join('');
  const links = net.links.map(([a, b], i) => { const A = epPos(a), B = epPos(b); return `<g class="link${can('cables') ? ' cut' : ''}" data-link="${i}"><line class="link-hit" x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}"/><line class="link-line" x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}"/></g>`; }).join('');
  const devs = net.devices.map(d => {
    const s = sel === d.id ? ' sel' : '';
    if (d.type === 'router') {
      const ports = lanPorts(d).map((p, k) => { const c = d.ports[p], y = d.y + 44 + k * 24, on = usedBy(net, d.id + ':' + p); return `<g class="port${on ? ' on' : ''}" data-ep="${d.id}:${p}"><rect x="${d.x - 68}" y="${y - 10}" width="136" height="20" rx="10"/><text x="${d.x - 56}" y="${y + 4}" class="pn">${p.toUpperCase()}</text><text x="${d.x + 58}" y="${y + 4}" class="pip${c.ip ? '' : ' none'}" text-anchor="end">${esc(c.ip || 'немає адреси')}</text></g>`; }).join('');
      const wan = `<g class="port wan${usedBy(net, d.id + ':wan') ? ' on' : ''}" data-ep="${d.id}:wan"><rect x="${d.x - 30}" y="${d.y - 56}" width="60" height="20" rx="10"/><text x="${d.x}" y="${d.y - 42}" text-anchor="middle" class="pn">WAN</text></g>`;
      return `<g class="dev t-router${s}" data-ep="${d.id}"><rect class="tile" x="${d.x - 34}" y="${d.y - 28}" width="68" height="56" rx="14"/><g class="ic">${svgIcon('router', d.x - 15, d.y - 15, 30)}</g><text class="dn" x="${d.x - 44}" y="${d.y + 5}" text-anchor="end">${esc(d.name)}</text></g>${wan}${ports}`;
    }
    const lab = isHost(d) ? hostLabel(d, eff) : null;
    const ic = d.type === 'cloud' ? 'cloud' : d.type;
    return `<g class="dev t-${d.type}${s}" data-ep="${d.id}"><rect class="tile" x="${d.x - 34}" y="${d.y - 28}" width="68" height="56" rx="14"/><g class="ic">${svgIcon(ic, d.x - 15, d.y - 15, 30)}</g>${d.auto ? `<g class="badge"><circle cx="${d.x + 30}" cy="${d.y - 24}" r="10"/>${svgIcon('wand', d.x + 24, d.y - 30, 12)}</g>` : ''}<text class="dn" x="${d.x}" y="${d.y + 46}" text-anchor="middle">${esc(d.name)}</text>${lab ? `<text class="dip ${lab.cls}" x="${d.x}" y="${d.y + 62}" text-anchor="middle">${esc(lab.t)}</text>` : ''}</g>`;
  }).join('');
  return `<svg id="board" viewBox="0 0 ${W} ${H}" class="${can('cables') ? 'wiring' : ''}">${zones}<g id="links">${links}</g><line id="dragLine" class="drag-line" x1="0" y1="0" x2="0" y2="0" visibility="hidden"/>${devs}<g id="packets"></g></svg>`;
}
const drawBoard = () => { const b = $('boardBox'); if (b) b.innerHTML = boardSvg(); };
function svgPoint(e) {
  const svg = $('board'), r = svg.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
function setHelp(text, bad) { const h = $('boardHelp'); if (!h) return; h.innerHTML = (bad ? icon('alert') : icon('cursor')) + `<span>${text}</span>`; h.classList.toggle('bad', !!bad); }
const HELP = () => can('cables') ? 'Затисніть мишку на пристрої й протягніть кабель до іншого. Клацніть по кабелю, щоб від’єднати. Клацніть по пристрою — його налаштування.' : 'Клацніть по пристрою, щоб відкрити його налаштування.';
// роутер: якщо кабель кинули на сам роутер — беремо вільний порт (до інтернету — WAN)
function resolveEp(ep, other) {
  const d = dev(devOf(ep));
  if (d.type !== 'router' || portOf(ep)) return ep;
  const otherDev = dev(devOf(other));
  if (otherDev.type === 'cloud') return d.id + ':wan';
  const free = lanPorts(d).find(p => !usedBy(net, d.id + ':' + p));
  return d.id + ':' + (free || lanPorts(d)[0]);
}
function connect(a, b) {
  a = resolveEp(a, b); b = resolveEp(b, a);
  const err = canLink(net, a, b);
  if (err) { setHelp(err, true); return false; }
  net.links.push([a, b]); changed();
  setHelp(HELP());
  return true;
}
function changed() { results = null; drawBoard(); renderGoals(); }

function bindBoard() {
  const box = $('boardBox');
  box.onpointerdown = e => {
    const g = e.target.closest('[data-ep]');
    const lk = e.target.closest('[data-link]');
    if (!g && lk && can('cables')) { net.links.splice(+lk.dataset.link, 1); changed(); setHelp('Кабель від’єднано.'); return; }
    if (!g) { select(null); return; }
    e.preventDefault();
    const p = svgPoint(e);
    drag = { ep: g.dataset.ep, x0: p.x, y0: p.y, moved: false };
    box.setPointerCapture?.(e.pointerId);
  };
  box.onpointermove = e => {
    if (!drag) return;
    const p = svgPoint(e);
    if (!drag.moved && Math.hypot(p.x - drag.x0, p.y - drag.y0) < 6) return;
    if (!can('cables')) return;
    drag.moved = true;
    const A = epPos(drag.ep), L = $('dragLine');
    L.setAttribute('x1', A.x); L.setAttribute('y1', A.y); L.setAttribute('x2', p.x); L.setAttribute('y2', p.y); L.setAttribute('visibility', 'visible');
    $('board').classList.add('dragging');
    box.querySelectorAll('.drop').forEach(x => x.classList.remove('drop'));
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-ep]');
    if (over && devOf(over.dataset.ep) !== devOf(drag.ep)) over.classList.add('drop');
  };
  const end = e => {
    if (!drag) return;
    const d = drag; drag = null;
    $('dragLine')?.setAttribute('visibility', 'hidden');
    $('board')?.classList.remove('dragging');
    if (!d.moved) { select(devOf(d.ep)); return; }
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-ep]');
    box.querySelectorAll('.drop').forEach(x => x.classList.remove('drop'));
    if (over && devOf(over.dataset.ep) !== devOf(d.ep)) connect(d.ep, over.dataset.ep);
    else setHelp('Відпустіть кабель точно на іншому пристрої.', true);
  };
  box.onpointerup = end;
  box.onpointercancel = () => { drag = null; drawBoard(); };
}

/* ═════════ Налаштування пристрою ═════════ */
function select(id) { sel = id; pingLog = []; drawBoard(); renderInspector(); }
const note = (ic, html, cls = '') => `<p class="insp-note ${cls}">${icon(ic)}<span>${html}</span></p>`;
const field = (key, label, value, editable, ph = '') => `<label class="fld"><span>${label}</span><input class="inp mono" data-f="${key}" value="${esc(value)}" placeholder="${esc(ph)}" ${editable ? '' : 'disabled'} spellcheck="false" autocomplete="off"></label>`;
const maskSel = (key, value, editable) => `<label class="fld"><span>Маска</span><select class="inp mono" data-f="${key}" ${editable ? '' : 'disabled'}>${MASKS.map(m => `<option${m === value ? ' selected' : ''}>${m}</option>`).join('')}</select></label>`;
function renderInspector() {
  const box = $('insp'); if (!box) return;
  const d = sel && dev(sel);
  if (!d) {
    const types = Object.keys(TYPE_NAME).filter(t => net.devices.some(x => x.type === t));
    const WHAT = { pc: 'комп’ютер учня', laptop: 'ноутбук', server: 'зберігає сайти й дані', printer: 'друкує для всіх', switch: 'з’єднує пристрої в одну мережу', router: 'з’єднує різні мережі й інтернет', cloud: 'сайти й DNS-сервери' };
    box.innerHTML = `<div class="insp-empty">${icon('cursor')}<p>Клацніть по пристрою на схемі, щоб побачити й змінити його налаштування.</p></div>
      <ul class="legend">${types.map(t => `<li class="t-${t}">${icon(t === 'cloud' ? 'cloud' : t)}<span><b>${TYPE_NAME[t]}</b> — ${WHAT[t]}</span></li>`).join('')}</ul>`;
    return;
  }
  const head = `<div class="insp-head"><span class="insp-ic t-${d.type}">${icon(d.type === 'cloud' ? 'cloud' : d.type)}</span><div><b>${esc(d.name)}</b>${d.name === TYPE_NAME[d.type] ? '' : `<small>${TYPE_NAME[d.type]}</small>`}</div></div>`;
  let body = '';
  if (isHost(d)) {
    const eff = effective(net)[d.id];
    const modeOk = can('mode');
    body += `<div class="seg${modeOk ? '' : ' off'}"><button data-mode="manual" class="${d.auto ? '' : 'on'}" ${modeOk ? '' : 'disabled'}>Вручну</button><button data-mode="auto" class="${d.auto ? 'on' : ''}" ${modeOk ? '' : 'disabled'}>${icon('wand')}Автоматично</button></div>`;
    if (d.auto) {
      body += eff.ip ? note('check', 'Адресу отримано від DHCP роутера.', 'ok') : note('alert', 'Чекає адресу, але DHCP у цій мережі вимкнено.', 'bad');
      body += `<dl class="kv"><dt>IP-адреса</dt><dd>${esc(eff.ip || '—')}</dd><dt>Маска</dt><dd>${esc(eff.mask || '—')}</dd><dt>Шлюз</dt><dd>${esc(eff.gw || '—')}</dd><dt>DNS</dt><dd>${esc(eff.dns || '—')}</dd></dl>`;
    } else {
      body += field('ip', 'IP-адреса', d.ip, can('ip'), '192.168.1.…') + maskSel('mask', d.mask, can('ip')) + field('gw', 'Шлюз', d.gw, can('gw'), 'адреса роутера') + field('dns', 'DNS-сервер', d.dns, can('dns'), 'напр. 8.8.8.8');
    }
    if (d.dnsRecords) body += `<div class="insp-box">${icon('book')}<div><b>Працює як DNS-сервер</b>${Object.entries(d.dnsRecords).map(([n, ip]) => `<span class="mono">${esc(n)} → ${esc(ip)}</span>`).join('')}</div></div>`;
    body += `<div class="ping"><span class="ping-l">${icon('terminal')}Перевірити зв’язок</span><div class="ping-row"><span class="ping-cmd mono">ping</span><input class="inp mono" id="pingInp" placeholder="адреса або сайт" spellcheck="false" autocomplete="off"><button class="btn" id="pingBtn">${icon('mail')}</button></div><div class="ping-log" id="pingLog">${pingLog.map(l => `<p class="${l.ok ? 'ok' : 'bad'}">${icon(l.ok ? 'check' : 'x')}<span><b class="mono">ping ${esc(l.to)}</b>${esc(l.reason)}</span></p>`).join('')}</div></div>`;
  } else if (d.type === 'router') {
    body += note('info', 'Кожен порт LAN — окрема мережа. Його адреса — це <b>шлюз</b> для пристроїв цієї мережі.');
    for (const p of lanPorts(d)) {
      const c = d.ports[p];
      body += `<div class="port-card" data-port="${p}"><div class="pc-head"><b>${p.toUpperCase()}</b><span class="pc-state">${usedBy(net, d.id + ':' + p) ? 'кабель підключено' : 'без кабелю'}</span></div>
        ${field(p + '.ip', 'Адреса порту', c.ip, can('router'), '192.168.…1')}<span class="pc-mask">маска <b class="mono">${esc(c.mask)}</b></span>
        <label class="tgl${can('dhcp') ? '' : ' off'}"><input type="checkbox" data-f="${p}.dhcp" ${c.dhcp ? 'checked' : ''} ${can('dhcp') ? '' : 'disabled'}><i></i><span>${icon('wand')}DHCP — роздавати адреси</span></label></div>`;
    }
    body += `<div class="port-card"><div class="pc-head"><b>WAN</b><span class="pc-state">${usedBy(net, d.id + ':wan') ? 'підключено до інтернету' : 'не підключено'}</span></div>${note('globe', 'Порт для інтернету. З’єднайте його з хмаркою «Інтернет».')}</div>`;
    if (Object.values(d.ports).some(c => c.dhcp)) body += note('book', `DHCP також повідомляє DNS-сервер: <b class="mono">${esc(d.dns)}</b>`);
  } else if (d.type === 'switch') {
    body += note('info', 'Комутатор з’єднує все, що до нього підключено, в одну мережу. Налаштовувати його не треба.') + note('plug', `Зайнято гнізд: <b>${usedBy(net, d.id)} з 8</b>`);
  } else {
    body += note('globe', 'Тут сайти й DNS-сервери <b class="mono">8.8.8.8</b> та <b class="mono">1.1.1.1</b>. Підключіть до інтернету порт WAN роутера.');
  }
  box.innerHTML = head + body;
}
function bindInspector() {
  const box = $('insp');
  box.addEventListener('input', e => {
    const f = e.target.dataset.f; if (!f) return;
    const d = dev(sel); if (!d) return;
    if (d.type === 'router') { const [p, k] = f.split('.'); d.ports[p][k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value.trim(); }
    else d[f] = e.target.value.trim();
    if (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') e.target.classList.toggle('bad', !!e.target.value.trim() && parseIp(e.target.value) == null);
    changed();
  });
  box.addEventListener('click', e => {
    const m = e.target.closest('[data-mode]');
    if (m && !m.disabled) { dev(sel).auto = m.dataset.mode === 'auto'; changed(); renderInspector(); return; }
    if (e.target.closest('#pingBtn')) runPing();
  });
  box.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'pingInp') { e.preventDefault(); runPing(); } });
}
function runPing() {
  const to = $('pingInp').value.trim(); if (!to) { $('pingInp').focus(); return; }
  const r = ping(net, sel, to);
  pingLog = [{ to, ok: r.ok, reason: r.reason }, ...pingLog].slice(0, 3);
  renderInspector();
  $('pingInp').value = to;
  animate([r]);
}

/* ═════════ Пакети ═════════ */
let animId = 0;
function animate(list, done) {
  const id = ++animId, g = $('packets'); if (!g) { done?.(); return; }
  const tracks = list.map(r => { const pts = (r.path || []).map(epPos); return { r, pts, len: pts.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0) }; }).filter(t => t.pts.length > 1);
  g.innerHTML = tracks.map(t => `<g class="pk ${t.r.ok ? 'ok' : 'bad'}"><circle r="9"/>${svgIcon('mail', -6, -6, 12)}</g>`).join('');
  const els = [...g.children];
  const T = 1100, t0 = performance.now();
  const at = (t, k) => { let d = k * t.len; for (let i = 1; i < t.pts.length; i++) { const a = t.pts[i - 1], b = t.pts[i], s = Math.hypot(b.x - a.x, b.y - a.y); if (d <= s || i === t.pts.length - 1) { const f = s ? Math.min(1, d / s) : 1; return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }; } d -= s; } return t.pts.at(-1); };
  const step = now => {
    if (id !== animId) return;
    const k = Math.min(1, (now - t0) / T);
    tracks.forEach((t, i) => {
      // успішний пакет іде туди й повертається; невдалий — зупиняється там, де застряг
      const f = t.r.ok ? (k < .5 ? k * 2 : 2 - k * 2) : Math.min(1, k * 1.3);
      const p = at(t, f); els[i].setAttribute('transform', `translate(${p.x} ${p.y})`);
    });
    if (k < 1) requestAnimationFrame(step);
    else { els.forEach((e, i) => { if (!tracks[i].r.ok) e.classList.add('stuck'); else e.remove(); }); done?.(); }
  };
  if (!tracks.length) { done?.(); return; }
  requestAnimationFrame(step);
}

/* ═════════ Цілі ═════════ */
// кінець маршруту: пристрій зі схеми або сайт / адреса в інтернеті
function goalEnd(to) {
  const d = dev(to);
  return d ? `<span class="g-end t-${d.type}">${icon(d.type === 'cloud' ? 'cloud' : d.type)}<b>${esc(d.name)}</b></span>` : `<span class="g-end t-cloud">${icon('globe')}<b class="mono">${esc(to)}</b></span>`;
}
function renderGoals() {
  const ul = $('goalList'); if (!ul) return;
  ul.innerHTML = level.goals.map((g, i) => {
    const r = results?.[i];
    return `<li class="${r ? (r.ok ? 'ok' : 'bad') : ''}"><div class="g-top"><span class="g-route">${goalEnd(g.from)}<span class="g-to"><span class="g-arrow">${icon('arrow')}</span>${goalEnd(g.to)}</span></span><span class="g-ic" title="${r ? (r.ok ? 'Працює' : 'Не працює') : 'Ще не перевірено'}">${r ? icon(r.ok ? 'check' : 'x') : icon('mail')}</span></div>${r ? `<p class="g-why">${esc(r.reason)}</p>` : ''}</li>`;
  }).join('');
  renderDots();
}
function check() {
  if (answered) return;
  results = checkGoals(net, level.goals);
  const ok = results.every(r => r.ok);
  $('checkBtn').disabled = true;
  animate(results, () => {
    $('checkBtn').disabled = false;
    renderGoals();
    if (ok) { finishNet(); return; }
    st.fails++;
    setHelp(`Працює ${results.filter(r => r.ok).length} з ${results.length}. Під кожною ціллю написано, що заважає.`, true);
    $('stage').classList.remove('shake'); void $('stage').offsetWidth; $('stage').classList.add('shake');
  });
}

/* ═════════ Гра ═════════ */
let level = null, cur = -1, ti = -1, scores = [], task = null, answered = false, st = {};
function openLevel(i) {
  if (!LEVELS[i] || !unlocked(i)) { showHome(); return; }
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  cur = i; level = LEVELS[i]; scores = [];
  $('home').hidden = true; $('play').hidden = false; $('result').hidden = true;
  $('lvlChapter').textContent = CHAPTERS.find(c => c.id === level.chapter).name;
  $('lvlName').textContent = `${i + 1}. ${level.name}`;
  $('lvlHint').innerHTML = tipsHtml(); $('lvlHint').hidden = true; $('tipsBtn').classList.remove('on');
  $('navNum').textContent = `${i + 1} / ${LEVELS.length}`;
  $('prevBtn').disabled = i === 0;
  $('nextBtn').disabled = !(i + 1 < LEVELS.length && unlocked(i + 1));
  showIntro();
  if (location.hash !== '#' + level.id) window.history.replaceState(null, '', '#' + level.id);
}
const tipsHtml = () => `<ul class="tips">${level.tips.map(([ic, t]) => `<li><span class="tip-ico">${icon(ic)}</span><span>${t}</span></li>`).join('')}</ul>`;
function showIntro() {
  ti = -1; task = null; answered = false; results = null; animId++;
  $('play').classList.remove('wide');
  $('feedback').hidden = true; $('tipsBtn').hidden = true;
  $('stage').className = 'stage intro';
  const n = level.kind === 'net' ? level.goals.length : level.tasks.length;
  $('stage').innerHTML = `<div class="intro-head"><span class="intro-ico">${icon('book')}</span><div><small>Пам’ятка перед рівнем</small><h2>${esc(level.name)}</h2></div></div>${tipsHtml()}
    <div class="verdicts"><span class="note">${icon('info')}${level.kind === 'net' ? `Схема мережі · ${n} ${plural(n, 'ціль', 'цілі', 'цілей')}` : `${n} ${plural(n, 'запитання', 'запитання', 'запитань')}`}</span><span class="grow"></span><button class="btn btn-primary btn-lg2" id="goBtn">${icon('play')}Почати</button></div>`;
  $('goBtn').onclick = () => { ti = 0; level.kind === 'net' ? showNet() : showTask(); };
  renderDots();
  setTimeout(() => $('goBtn')?.focus({ preventScroll: true }), 30);
}
$('tipsBtn').onclick = () => { const h = !$('lvlHint').hidden; $('lvlHint').hidden = h; $('tipsBtn').classList.toggle('on', !h); };
function renderDots() {
  if (level.kind === 'net') {
    $('dots').innerHTML = level.goals.map((_, k) => { const r = results?.[k]; return `<i class="${ti < 0 ? '' : r ? (r.ok ? 'ok' : 'bad') : 'cur'}"></i>`; }).join('');
    $('stepN').textContent = ti < 0 ? 'Пам’ятка' : results ? `Працює ${results.filter(r => r.ok).length} з ${results.length}` : `${level.goals.length} ${plural(level.goals.length, 'ціль', 'цілі', 'цілей')}`;
    return;
  }
  $('dots').innerHTML = level.tasks.map((_, k) => { const s = scores[k]; return `<i class="${k === ti && !answered ? 'cur' : s == null ? '' : s >= 0.9 ? 'ok' : 'bad'}"></i>`; }).join('');
  $('stepN').textContent = ti < 0 ? 'Пам’ятка' : `Запитання ${ti + 1} з ${level.tasks.length}`;
}

function showNet() {
  net = cloneNet(level); edits = new Set(level.edit.split(' ')); sel = null; results = null; pingLog = []; answered = false;
  st = { fails: 0, hint: false };
  $('play').classList.add('wide');
  $('feedback').hidden = true; $('tipsBtn').hidden = false;
  $('stage').className = 'stage k-net';
  $('stage').innerHTML = `<h2 class="q">${esc(level.task)}</h2>
    <div class="net-wrap"><div class="board-col"><div class="board" id="boardBox"></div><p class="board-help" id="boardHelp"></p></div><aside class="insp" id="insp"></aside></div>
    <div class="goals"><div class="goals-head"><b>Що має працювати</b><span class="grow"></span><button class="btn" id="hintBtn">${icon('bulb')}Підказка</button><button class="btn" id="resetBtn" title="Почати рівень спочатку">${icon('refresh')}Спочатку</button><button class="btn btn-primary" id="checkBtn">${icon('mail')}Перевірити</button></div>
    <ul class="goal-list" id="goalList"></ul><p class="hint-box" id="hintBox" hidden></p></div>`;
  drawBoard(); bindBoard(); renderInspector(); bindInspector(); renderGoals(); setHelp(HELP());
  $('checkBtn').onclick = check;
  $('hintBtn').onclick = () => { st.hint = true; $('hintBox').innerHTML = icon('bulb') + `<span>${esc(level.hint)}</span>`; $('hintBox').hidden = false; };
  $('resetBtn').onclick = () => { const f = st.fails, h = st.hint; showNet(); st.fails = f; st.hint = h; };
}
function finishNet() {
  answered = true;
  const stars = netStars(st.fails, st.hint);
  scores = [stars];
  $('stage').classList.add('done');
  $('feedback').className = 'feedback ok';
  $('fbIco').innerHTML = icon('check');
  $('fbTitle').textContent = 'Мережа працює!';
  $('fbWhy').innerHTML = `Усі пакети дійшли й повернулися з відповіддю. ${st.fails ? `Невдалих перевірок: ${st.fails}.` : 'З першої перевірки!'}`;
  $('fbList').innerHTML = '';
  $('fbNext').innerHTML = 'Завершити' + icon('arrow');
  $('feedback').hidden = false;
  setTimeout(() => $('fbNext').focus({ preventScroll: true }), 30);
}

function showTask() {
  task = level.tasks[ti]; answered = false;
  $('feedback').hidden = true; $('tipsBtn').hidden = false;
  $('stage').className = 'stage k-choice';
  $('stage').innerHTML = `<h2 class="q">${esc(task.q)}</h2><div class="options">${task.options.map((o, k) => `<button class="opt" data-k="${k}"><span class="opt-k">${'АБВГ'[k]}</span><span class="opt-t">${esc(o.t)}</span></button>`).join('')}</div>`;
  $('stage').querySelector('.options').addEventListener('click', e => {
    const b = e.target.closest('.opt'); if (!b || answered) return;
    const o = task.options[+b.dataset.k], right = task.options.find(x => x.ok);
    $('stage').querySelectorAll('.opt').forEach(x => { x.disabled = true; if (task.options[+x.dataset.k].ok) x.classList.add('right'); });
    if (!o.ok) b.classList.add('wrong');
    finishTask(o.ok ? 1 : 0, o.ok ? esc(o.why) : `${esc(o.why)} Правильно: <b>«${esc(right.t)}»</b>. ${esc(right.why)}`);
  });
  renderDots();
}
function finishTask(score, why) {
  answered = true; scores[ti] = score;
  $('stage').classList.add('done');
  const kind = score ? 'ok' : 'bad';
  $('feedback').className = 'feedback ' + kind;
  $('fbIco').innerHTML = icon(score ? 'check' : 'x');
  $('fbTitle').textContent = score ? 'Правильно!' : 'Неправильно';
  $('fbWhy').innerHTML = why;
  $('fbList').innerHTML = '';
  $('fbNext').innerHTML = (ti + 1 < level.tasks.length ? 'Далі' : 'Завершити') + icon('arrow');
  $('feedback').hidden = false;
  renderDots();
  setTimeout(() => $('fbNext').focus({ preventScroll: true }), 30);
}
function next() {
  if (!level || ti < 0 || !answered) return;
  if (level.kind === 'quiz' && ti + 1 < level.tasks.length) { ti++; showTask(); } else complete();
}
$('fbNext').onclick = next;

function complete() {
  let stars, rec, msg;
  if (level.kind === 'net') {
    stars = scores[0];
    rec = { stars, tries: st.fails + 1, at: Date.now() };
    msg = `Перевірок: ${st.fails + 1}${st.hint ? ' · з підказкою' : ''}. ${stars === 3 ? 'Справжній адміністратор!' : 'Для трьох зірок — не більше однієї невдалої перевірки й без підказки.'}`;
  } else {
    const avg = scores.reduce((a, b) => a + b, 0) / level.tasks.length;
    stars = starsFor(avg);
    rec = { stars, pct: Math.round(avg * 100), at: Date.now() };
    msg = `Правильних відповідей: ${scores.filter(Boolean).length} з ${level.tasks.length}. ${stars === 3 ? 'Чудово!' : 'Перечитайте пам’ятку й спробуйте ще раз.'}`;
  }
  const prev = best(level.id);
  const better = !prev || stars > prev.stars || (stars === prev.stars && (rec.tries ? rec.tries < (prev.tries || Infinity) : rec.pct > (prev.pct || 0)));
  if (better) { progress.best[level.id] = rec; saveProgress(); }
  $('resStars').innerHTML = [0, 1, 2].map(i => icon('star', i < stars ? 'on' : '')).join('');
  $('resTitle').textContent = stars === 3 ? 'Чудово!' : stars === 2 ? 'Добре!' : 'Рівень пройдено';
  $('resMsg').textContent = msg;
  const nx = cur + 1 < LEVELS.length;
  $('resNext').disabled = !nx || !unlocked(cur + 1);
  $('resNext').innerHTML = nx ? 'Далі' + icon('arrow') : 'Усі рівні пройдено';
  $('result').hidden = false;
  setTimeout(() => $('resNext').focus(), 50);
}
$('resRetry').onclick = () => openLevel(cur);
$('resNext').onclick = () => openLevel(cur + 1);
$('resLevels').onclick = () => showHome();

/* ═════════ Головна ═════════ */
const CH_ICON = { cables: 'plug', ip: 'tag', router: 'router', dns: 'book', school: 'school' };
function showHome() {
  cur = -1; level = null; task = null; animId++;
  $('play').hidden = true; $('result').hidden = true; $('home').hidden = false;
  window.history.replaceState(null, '', location.pathname);
  renderHome();
}
function nextToPlay() {
  let i = LEVELS.findIndex((l, k) => unlocked(k) && !best(l.id)?.stars);
  if (i < 0) i = LEVELS.findIndex(l => (best(l.id)?.stars || 0) < 3);
  return i;
}
function thumb(l) {
  const types = l.kind === 'quiz' ? ['help'] : [...new Set(l.devices.map(d => d.type === 'cloud' ? 'globe' : d.type))].slice(0, 4);
  return `<span class="th-big">${icon(CH_ICON[l.chapter])}</span><span class="th-kinds">${types.map(t => icon(t)).join('')}</span>`;
}
const metaOf = (l, b) => !b ? (l.kind === 'net' ? `${l.goals.length} ${plural(l.goals.length, 'ціль', 'цілі', 'цілей')}` : `${l.tasks.length} ${plural(l.tasks.length, 'запитання', 'запитання', 'запитань')}`)
  : b.tries ? `${b.tries} ${plural(b.tries, 'спроба', 'спроби', 'спроб')}` : b.pct + '%';
function renderHome() {
  $('chapters').innerHTML = CHAPTERS.map((ch, ci) => {
    const items = LEVELS.map((l, i) => ({ l, i })).filter(x => x.l.chapter === ch.id);
    const got = items.reduce((s, { l }) => s + (best(l.id)?.stars || 0), 0);
    return `<section class="chapter"><div class="chapter-head"><span class="ch-num">${ci + 1}</span><div class="ch-text"><h2>${ch.name}</h2><span>${ch.desc}</span></div><span class="ch-stars">${icon('star')}${got} / ${items.length * 3}</span></div><div class="levels">${items.map(({ l, i }) => {
      const b = best(l.id), open = unlocked(i);
      return `<button class="lvl${b?.stars === 3 ? ' perfect' : ''}${open && !b ? ' fresh' : ''}" data-level="${i}" ${open ? '' : 'disabled title="Спершу пройдіть попередній рівень"'}>
        <div class="lvl-thumb ch-${l.chapter}">${open ? thumb(l) : `<span class="lvl-lock">${icon('lock')}</span>`}</div>
        <span class="lvl-num">${i + 1}</span>
        <div class="lvl-name">${esc(l.name)}</div>
        <div class="lvl-meta">${starsHtml(b?.stars || 0)}<span class="lvl-acc">${metaOf(l, b)}</span></div>
      </button>`;
    }).join('')}</div></section>`;
  }).join('');
  const s = totalStars(), max = LEVELS.length * 3, pr = Math.round(passed() / LEVELS.length * 100);
  $('total').innerHTML = icon('star') + s + ' / ' + max;
  $('heroStars').textContent = s; $('heroMax').textContent = max;
  $('heroAcc').textContent = netsDone();
  $('ringPct').textContent = pr + '%';
  $('ringFg').style.strokeDashoffset = String(326.7 * (1 - pr / 100));
  const n = nextToPlay();
  $('continueBtn').hidden = n < 0;
  if (n >= 0) { $('continueBtn').innerHTML = icon('play') + (passed() ? 'Продовжити' : 'Почати') + `: рівень ${n + 1} · ${esc(LEVELS[n].name)}`; $('continueBtn').dataset.level = n; }
}
$('chapters').addEventListener('click', e => { const b = e.target.closest('[data-level]'); if (b && !b.disabled) openLevel(+b.dataset.level); });
$('continueBtn').onclick = () => openLevel(+$('continueBtn').dataset.level);
$('homeBtn').onclick = () => showHome();
$('backBtn').onclick = () => showHome();
$('prevBtn').onclick = () => openLevel(cur - 1);
$('nextBtn').onclick = () => openLevel(cur + 1);

/* ═════════ Клавіатура ═════════ */
document.addEventListener('keydown', e => {
  if (!$('report').hidden) { if (e.key === 'Escape') $('report').hidden = true; return; }
  if (!$('result').hidden) {
    if (e.key === 'Escape') $('resLevels').click();
    else if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); (!$('resNext').disabled ? $('resNext') : $('resRetry')).click(); }
    return;
  }
  if ($('play').hidden || e.target.closest?.('input, select')) return;
  if (ti < 0 && e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); $('goBtn')?.click(); return; }
  if (answered && e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); next(); return; }
  if (!answered && task && !e.ctrlKey && !e.altKey) { const k = ['1', '2', '3', '4'].indexOf(e.key); if (k >= 0) $('stage').querySelector(`.opt[data-k="${k}"]`)?.click(); }
});

/* ═════════ Результати для вчителя ═════════ */
$('reportBtn').onclick = () => {
  $('studentName').value = progress.name;
  $('reportSum').innerHTML = `Пройдено рівнів: <b>${passed()} з ${LEVELS.length}</b><br>Зірок: <b>${totalStars()} з ${LEVELS.length * 3}</b><br>Мереж налаштовано: <b>${netsDone()}</b>`;
  $('report').hidden = false;
  setTimeout(() => $('studentName').focus(), 30);
};
$('report').addEventListener('click', e => { if (e.target.id === 'report' || e.target.closest('[data-close]')) $('report').hidden = true; });
$('studentName').addEventListener('input', e => { progress.name = e.target.value; saveProgress(); });
$('resetProgress').onclick = () => {
  if (!confirm('Скинути весь прогрес? Усі зірки буде видалено.')) return;
  progress.best = {}; saveProgress(); $('report').hidden = true; renderHome(); toast('Прогрес скинуто');
};
$('downloadReport').onclick = async () => {
  const name = $('studentName').value.trim();
  if (!name) { $('studentName').focus(); toast('Вкажіть ім’я — так учитель знатиме, чиї це результати'); return; }
  const blob = await reportImage(name);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'network-' + name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() + '.png';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
};
function starPath(x, cx, cy, r) {
  x.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  x.closePath();
}
export async function reportImage(name) {
  const CW = 1200, PAD = 40, HEAD = 190, ROW = 44;
  const half = Math.ceil(LEVELS.length / 2);
  const c = document.createElement('canvas'); c.width = CW; c.height = HEAD + half * ROW + 60;
  const x = c.getContext('2d');
  const font = (w, s, mono) => `${w} ${s}px ${mono ? 'JetBrains Mono, monospace' : 'Inter, system-ui, sans-serif'}`;
  x.fillStyle = '#fff'; x.fillRect(0, 0, CW, c.height);
  x.fillStyle = '#4F6BF4'; x.fillRect(0, 0, CW, 8);
  x.fillStyle = '#1a1d23'; x.font = font(800, 30); x.fillText('Мережі — результати', PAD, 62);
  x.font = font(600, 20); x.fillStyle = '#4b5563'; x.fillText(name, PAD, 98);
  x.font = font(500, 15); x.fillStyle = '#9ca3af'; x.fillText(new Date().toLocaleString('uk-UA', { dateStyle: 'long', timeStyle: 'short' }), PAD, 124);
  [['Пройдено', `${passed()} / ${LEVELS.length}`], ['Зірки', `${totalStars()} / ${LEVELS.length * 3}`], ['Мереж', String(netsDone())]].forEach(([k, v], i) => {
    const bx = CW - PAD - (3 - i) * 190;
    x.fillStyle = '#f3f5f9'; x.beginPath(); x.roundRect(bx, 40, 176, 92, 14); x.fill();
    x.fillStyle = '#9ca3af'; x.font = font(600, 13); x.fillText(k, bx + 16, 66);
    x.fillStyle = '#1a1d23'; x.font = font(800, 30); x.fillText(v, bx + 16, 110);
  });
  const colW = (CW - PAD * 2) / 2;
  LEVELS.forEach((l, i) => {
    const ox = PAD + Math.floor(i / half) * colW, oy = HEAD + (i % half) * ROW, b = best(l.id);
    if (i % 2 === 0) { x.fillStyle = '#f7f8fa'; x.fillRect(ox - 8, oy - 28, colW - 20, ROW); }
    x.fillStyle = '#9ca3af'; x.font = font(700, 13, true); x.fillText(String(i + 1).padStart(2, '0'), ox, oy);
    x.fillStyle = '#1a1d23'; x.font = font(600, 16); x.fillText(l.name, ox + 34, oy);
    if (b) {
      for (let s = 0; s < 3; s++) { starPath(x, ox + 330 + s * 20, oy - 6, 8); x.fillStyle = s < b.stars ? '#f5b942' : '#e2e5ea'; x.fill(); }
      x.fillStyle = '#1a1d23'; x.font = font(700, 14, true); x.fillText(metaOf(l, b), ox + 400, oy);
    } else { x.fillStyle = '#b0b6c2'; x.font = font(500, 14); x.fillText('не пройдено', ox + 330, oy); }
  });
  x.fillStyle = '#9ca3af'; x.font = font(500, 13); x.fillText('Edvault · Мережі', PAD, c.height - 22);
  return new Promise(r => c.toBlob(r, 'image/png'));
}

/* ═════════ Старт ═════════ */
const fromHash = LEVELS.findIndex(l => '#' + l.id === location.hash);
if (fromHash >= 0 && unlocked(fromHash)) openLevel(fromHash); else showHome();
window.NetworkTrainer = {
  LEVELS, openLevel, select, connect, check,
  apply(op) { applyOp(net, op); changed(); renderInspector(); },
  get progress() { return progress; }, get net() { return net; }, get level() { return level; }, get answered() { return answered; }, get results() { return results; }, get st() { return st; }, get scores() { return scores; },
};
