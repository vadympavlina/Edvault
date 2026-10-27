// Симулятор стартапу · оболонка: меню, верхня панель, маршрути, старт, підсумки тижня, збереження.
import { IDEAS, BACKGROUNDS, ACHIEVEMENTS } from './data.js';
import { Sim, newGame, okState, money, num, pct, plural, dateText, WEEKS, HOURS } from './sim.js';
import { SYMBOLS, PALETTE } from './mods.js';
import { ARCH, KINDS, SIZES, SCOPES, ideaCheck } from './custom.js';
import { packGame, unpackGame, fileName } from './file.js';
import { icon } from './icons.js';
import { esc, $, $$, h, modal, toast, termPop, confirmBox, logo, nl2br } from './ui.js';
import { coreViews, coreActs, coreIns, hoursUsed } from './v-core.js';
import { marketViews, marketActs, marketIns } from './v-market.js';
import { moneyViews, moneyActs, moneyIns } from './v-money.js';
import { peopleViews, peopleActs, peopleIns } from './v-people.js';
import { STAGES, stageInfo, viewStage, isOpen, unlock, syncStage } from './stages.js';

const KEY = 'edvault-startup', IDEA_KEY = 'edvault-startup-idea';
const VIEWS = { ...coreViews, ...marketViews, ...moneyViews, ...peopleViews };
const ACTS = { ...coreActs, ...marketActs, ...moneyActs, ...peopleActs };
const INS = { ...coreIns, ...marketIns, ...moneyIns, ...peopleIns };
// чотири вкладки й пошта; розділи всередині вкладки — другим рядком
const TABS = [
  ['home', 'Головна', 'home', ['dash']],
  ['market', 'Продукт і клієнти', 'box', ['customers', 'plan', 'product', 'brand', 'marketing', 'promo']],
  ['money', 'Гроші', 'wallet', ['pricing', 'finance', 'payments', 'investors', 'invest']],
  ['people', 'Люди', 'users', ['team', 'freelance']],
  ['mail', 'Пошта', 'mail', ['inbox']],
];
const tabOf = v => TABS.find(t => t[3].includes(v));

/* ═════════ стан ═════════ */
let S = null;
const ui = { view: 'dash' };
try { const saved = JSON.parse(localStorage.getItem(KEY)); if (saved && okState(saved.s)) { S = new Sim(saved.s); ui.view = saved.view || 'dash'; } } catch { /* почнемо заново */ }
const save = () => { if (!S) return; try { localStorage.setItem(KEY, JSON.stringify({ s: S.s, view: ui.view })); } catch { /* сховище переповнене */ } };

/* ═════════ контекст для розділів ═════════ */
const C = {
  get S() { return S; }, ui,
  // перехід із коду (підказка, лист, кнопка завдання) відкриває розділ навіть до його етапу
  go(v) { if (!VIEWS[v]) return; if (S && !isOpen(S, v)) unlock(S, v); ui.view = v; const t = tabOf(v); if (t) (ui.tabLast ||= {})[t[0]] = v; if (v !== 'dash') ui.stage = null; closeMore(); render(); $('#main').scrollTo?.(0, 0); scrollTo(0, 0); },
  render: () => render(), save, toast,
  out(k, text) { const el = document.querySelector(`[data-out="${k}"]`); if (el) el.textContent = text; },
  topbar: () => topbar(), theme: () => theme(), ending: () => ending(),
  saveFile: () => saveFile(), openFile: () => openFile(),
};

/* ═════════ збереження у файл і відкриття з файлу ═════════ */
function saveFile() {
  if (!S) return;
  S.s.flags.fileWeek = S.s.week; S.s.flags.fileSaves = (S.s.flags.fileSaves || 0) + 1; S.s.flags.fileSavedAt = new Date().toISOString();
  const name = fileName(S), blob = new Blob([JSON.stringify(packGame(S, ui), null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  save(); toast(`Файл збережено: ${name}`, 'good');
  if (!document.querySelector('.wizard')) render();
}
let fileInput = null;
function openFile() {
  if (!fileInput) {
    fileInput = h('<input type="file" accept=".json,application/json" hidden>');
    document.body.appendChild(fileInput);
    fileInput.addEventListener('change', () => { const f = fileInput.files[0]; fileInput.value = ''; if (f) readFile(f); });
  }
  fileInput.click();
}
function readFile(f) {
  if (f.size > 20e6) { toast('Файл завеликий для збереження симулятора', 'bad'); return; }
  const r = new FileReader();
  r.onload = () => loadText(String(r.result));
  r.onerror = () => toast('Не вдалося прочитати файл', 'bad');
  r.readAsText(f, 'utf-8');
}
function loadText(text) {
  const res = unpackGame(text);
  if (!res.ok) { toast(res.error, 'bad'); return; }
  const T = new Sim(res.state), sm = res.summary || {};
  const rows = [['Учень', T.s.founder.name], ['Клас або група', T.s.founder.group || '—'], ['Компанія', T.s.company.name], ['Ідея', T.I.t], ['Тиждень', `${T.s.week + 1} з ${WEEKS}`], ['Стан', T.s.over ? { bankrupt: 'компанія закрилася', sold: 'компанію продано', time: 'гру завершено' }[T.s.over.kind] : 'гра триває'], ['Гроші', money(T.s.cash)], ['Збережено', res.savedAt ? new Date(res.savedAt).toLocaleString('uk-UA') : sm['Збережено'] || '—']];
  const replacing = S && !document.querySelector('.wizard');
  modal({ title: 'Відкрити гру з файлу', cls: 'file-open', html: `<table class="tbl file-sum"><tbody>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join('')}</tbody></table>
    ${res.edited || T.s.flags.editedFile ? `<p class="note bad">${icon('alert', 16)} <span>Файл змінювали вручну після збереження. Результати можуть не відповідати справжній грі.</span></p>` : `<p class="note ok">${icon('check', 16)} <span>Файл цілий: його не змінювали після збереження.</span></p>`}
    ${replacing ? `<p class="sm muted">Поточна гра «${esc(S.s.company.name)}» (тиждень ${S.s.week + 1}) буде замінена. Якщо вона ще потрібна — <button class="link" data-f="saveCur">спершу збережіть її у файл</button>.</p>` : ''}
    <div class="row end gap wrap"><button class="btn" data-f="report">Відкрити звіт</button><button class="btn primary" data-f="play">${T.s.over ? 'Відкрити гру' : 'Продовжити гру'}</button></div>`,
    onOpen: api => api.el.addEventListener('click', e => {
      const b = e.target.closest('[data-f]'); if (!b) return;
      if (b.dataset.f === 'saveCur') { saveFile(); return; }
      if (res.edited) T.s.flags.editedFile = true;
      S = T; window.Startup.S = S;
      for (const k of Object.keys(ui)) delete ui[k];
      Object.assign(ui, res.ui, { view: b.dataset.f === 'report' ? 'report' : VIEWS[res.ui.view] ? res.ui.view : 'dash' });
      document.querySelector('.wizard')?.remove(); document.body.classList.remove('wz-on');
      api.close(); render(); save();
      toast(`Гру «${S.s.company.name}» відкрито`, 'good');
    }) });
}

/* ═════════ малювання ═════════ */
// частину сторінки переписуємо лише тоді, коли її розмітка справді змінилася
const setHtml = (el, html) => { if (el && el._h !== html) { el.innerHTML = html; el._h = html; } };
// після перемальовки повертаємо фокус на «ту саму» кнопку, щоб клавіатура не губилася
const focusKey = el => el && el !== document.body && el.dataset && (el.dataset.act || el.dataset.in) ? [el.tagName, ...['act', 'in', 'k', 'd', 'to', 'id', 'i', 'v'].map(a => el.dataset[a] ?? '')].join('|') : null;
// колір компанії учень обирає сам, тож рахуємо читабельні відтінки: для кнопок з білим текстом
// і для тексту на світлому тлі — той самий тон, але темніший, доки контраст не сягне 4,5:1
const hexRgb = h => { const n = parseInt(h.replace('#', '').padEnd(6, '0').slice(0, 6), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const lumOf = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
const ratio = (a, b) => { const x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const INK = [29, 36, 51];
function readable(hex, against, need) {
  let c = hexRgb(hex);
  for (let i = 0; i < 20 && ratio(c, against) < need; i++) c = c.map((v, k) => Math.round(v * .92 + INK[k] * .08));
  return `rgb(${c.join(', ')})`;
}
const themeCache = {};
function theme() {
  if (!S) return;
  const col = S.s.company.color, st = document.documentElement.style;
  const t = themeCache[col] ||= { acc: readable(col, [255, 255, 255], 4.6), tx: readable(col, [236, 240, 239], 4.6) };
  st.setProperty('--acc', t.acc); st.setProperty('--acc-tx', t.tx); st.setProperty('--acc-soft', col + '1f');
}
const runwayText = rw => rw === Infinity ? 'прибуток' : rw > 104 ? '2+ роки' : `${Math.max(0, Math.floor(rw))} ${plural(Math.max(0, Math.floor(rw)), 'тиждень', 'тижні', 'тижнів')}`;
function topbar() {
  if (!S) return;
  const s = S.s, rw = S.runwayWeeks(), e = Math.round(s.founder.energy);
  setHtml($('#top'), `<button class="tp-brand" data-act="go" data-to="dash" title="${esc(s.company.name)}: ${esc(S.I.t)}. На головну">${logo(s.company, 36)}<span><b>${esc(s.company.name)}</b><small>Тиждень ${s.week + 1} з ${WEEKS} · ${dateText(s.week)}</small></span></button>
    <div class="tp-stats">
      <span class="tp-s ${s.cash < 30000 ? 'bad' : ''}" title="Гроші компанії">${icon('wallet', 16)}<span><small>Гроші</small><b>${money(s.cash)}</b></span></span>
      <span class="tp-s ${rw < 8 ? 'bad' : rw < 16 ? 'warn' : ''} hide-t" title="На скільки тижнів вистачить грошей">${icon('clock', 16)}<span><small>Вистачить на</small><b>${runwayText(rw)}</b></span></span>
      <span class="tp-s hide-m" title="Скільки людей користуються продуктом">${icon('users', 16)}<span><small>Клієнти</small><b>${num(S.activeUsers())}</b></span></span>
      <span class="tp-s ${e < 30 ? 'bad' : e < 60 ? 'warn' : ''} hide-m" title="Ваші сили. Падають, якщо працювати забагато">${icon('bolt', 16)}<span><small>Сили</small><b>${e}%</b></span></span>
    </div>
    <button class="btn top-save" data-act="saveFile" title="Зберегти всю гру у файл (Ctrl+S)" aria-label="Зберегти гру у файл">${icon('save', 16)}<span>Зберегти</span></button>
    <div class="more-w"><button class="btn ib-b" data-act="more" aria-label="Ще" aria-expanded="${!!ui.more}" title="Ще">${icon('more', 18)}</button>${ui.more ? morePop() : ''}</div>
    <button class="btn primary end-week" data-act="endWeek" aria-label="Завершити тиждень" ${s.over ? 'disabled' : ''}>${icon('next', 16)}<span>Завершити тиждень</span></button>`);
}
function morePop() {
  const s = S.s;
  return `<div class="more-pop" role="menu"><div class="founder"><span class="av">${esc(s.founder.name.split(' ').map(x => x[0]).join('').slice(0, 2))}</span><div><b>${esc(s.founder.name)}</b><small>${BACKGROUNDS[s.founder.bg].t} · ${pct(S.stake(), 0)} компанії</small></div></div>
    <button role="menuitem" data-act="openFile">${icon('open', 16)} Відкрити гру з файлу</button>
    <button role="menuitem" data-act="go" data-to="report">${icon('award', 16)} Підсумковий звіт</button>
    <button role="menuitem" data-act="go" data-to="help">${icon('book', 16)} Довідник і словник</button>
    <button role="menuitem" data-act="newGame">${icon('refresh', 16)} Нова гра</button>
    <small class="${s.flags.fileWeek != null ? '' : 'warn'}">${s.flags.fileWeek != null ? `У файл збережено на тижні ${s.flags.fileWeek + 1}` : 'Гру ще не зберігали у файл'}</small></div>`;
}
const closeMore = () => { if (ui.more) { ui.more = false; topbar(); } };
// доріжка етапів — мапа: пройдена частина суцільна зелена, попереду пунктир, над поточним — «ви тут»
const ROAD_X = [6, 28, 50, 72, 94], ROAD_Y = [80, 54, 76, 90, 52];
function roadPath(n) {
  const P = ROAD_X.map((x, i) => [x * 10, ROAD_Y[i]]).slice(0, n + 1);
  let d = `M${P[0][0]} ${P[0][1]}`;
  for (let i = 1; i < P.length; i++) { const [x0, y0] = P[i - 1], [x1, y1] = P[i], m = (x1 - x0) / 2; d += ` C${x0 + m} ${y0} ${x1 - m} ${y1} ${x1} ${y1}`; }
  return d;
}
function road(info) {
  const done = info.allDone ? ROAD_X.length - 1 : info.cur;
  setHtml($('#road'), `<div class="map"><svg class="path" viewBox="0 0 1000 132" preserveAspectRatio="none" aria-hidden="true"><path class="todo" d="${roadPath(ROAD_X.length - 1)}"/>${done ? `<path class="done" d="${roadPath(done)}"/>` : ''}</svg>
    <ol>${info.list.map((st, i) => {
      const cls = i < info.cur || (info.allDone && i === info.cur) ? 'done' : i === info.cur ? 'cur' : i <= info.reached ? 'open' : 'lock';
      return `<li class="${cls}" style="left:${ROAD_X[i]}%;top:${ROAD_Y[i] / 1.32}%"><button data-act="stage" data-i="${i}" ${i > info.reached ? 'disabled' : ''} aria-current="${i === info.cur ? 'step' : 'false'}" aria-label="Етап ${i + 1}: ${esc(st.t)}${cls === 'done' ? ', пройдено' : cls === 'lock' ? ', ще закрито' : ''}" title="${esc(st.long)}">${i === info.cur && !info.allDone ? '<span class="here">ви тут</span>' : ''}<span class="c">${cls === 'done' ? icon('check', 18) : i + 1}</span><span class="l">${esc(st.t)}</span></button></li>`;
    }).join('')}</ol></div>`);
}
function tabs(info) {
  const s = S.s, unread = s.inbox.filter(m => !m.read || (m.choices && m.chosen == null)).length;
  const cur = tabOf(ui.view);
  const badge = k => k === 'mail' && unread ? `<span class="badge">${unread}</span>` : k === 'money' && Object.values(s.inv).some(x => x.status === 'offer') && isOpen(S, 'investors', info) ? '<span class="badge">!</span>' : '';
  const sub = cur && cur[3].length > 1 ? `<div class="subtabs" role="tablist">${cur[3].map(v => {
    const open = isOpen(S, v, info), st = viewStage(v);
    return `<button class="st-it ${ui.view === v ? 'on' : ''} ${open ? '' : 'locked'}" data-act="${open ? 'go' : 'locked'}" data-to="${v}" ${ui.view === v ? 'aria-current="page"' : ''} ${open ? '' : `title="Знадобиться на етапі ${st + 1} «${esc(STAGES[st].t)}»"`}>${icon(open ? VIEWS[v].icon : 'lock', 15)}<span>${VIEWS[v].t}</span>${v === 'product' && S.canLaunch() ? '<span class="badge dot"></span>' : ''}</button>`;
  }).join('')}</div>` : '';
  setHtml($('#tabs'), `<div class="navtabs-in">${TABS.map(([k, t, ic, views]) => `<button class="tab ${cur?.[0] === k ? 'on' : ''}" data-act="tab" data-k="${k}" aria-label="${t}${k === 'mail' && unread ? `, непрочитаних: ${unread}` : ''}" ${cur?.[0] === k ? 'aria-current="page"' : ''}>${icon(ic, 18)}<span>${t}</span>${badge(k)}</button>`).join('')}</div>${sub}`);
}
function render() {
  if (!S) return;
  $('.app').inert = !!document.querySelector('.wizard');
  const info = syncStage(S), fk = focusKey(document.activeElement);
  theme(); topbar(); road(info); tabs(info);
  const V = VIEWS[ui.view] || VIEWS.dash;
  setHtml($('#main'), `${ui.view === 'dash' ? '' : `<header class="pg-h"><h1>${icon(V.icon, 24)} ${V.t}</h1>${S.s.over ? `<span class="chip bad">Гру завершено</span>` : ''}</header>`}${V.render(S, ui, info)}`);
  if (fk && (!document.activeElement || document.activeElement === document.body)) [...document.querySelectorAll('[data-act], [data-in]')].find(el => focusKey(el) === fk && !el.disabled)?.focus({ preventScroll: true });
  save();
}

/* ═════════ кінець тижня ═════════ */
async function endWeek() {
  const s = S.s;
  if (s.over) return ending();
  const pending = s.inbox.filter(m => m.choices && m.chosen == null && m.until === s.week);
  if (pending.length && !await confirmBox('Є листи, які чекають на ваше рішення', 'Завершити тиждень', { sub: `Якщо не відповісте цього тижня, рішення ухвалять без вас: ${pending.map(m => `«${m.title}»`).join(', ')}.` })) { C.go('inbox'); return; }
  if (hoursUsed(S) > 62 && !await confirmBox(`Ви запланували ${hoursUsed(S)} годин роботи`, 'Так, працюю', { sub: 'Енергія різко впаде, а з нею — продуктивність. Можливо, варто додати відпочинку?' })) return;
  const rep = S.endWeek(); save();
  weekModal(rep);
  render();
}
function weekModal(rep) {
  const s = S.s, m = rep.money, r = rep.rec, d = rep.cashAfter - rep.cashBefore;
  const out = m.salaries + m.mkt + m.servers + m.tools + m.formFee + m.cogs + m.tax + (m.loyal || 0) + (m.loan || 0) + m.extra;
  const html = `<div class="wk-cash"><div><small>Було</small><b>${money(rep.cashBefore)}</b></div>${icon('right', 22)}<div><small>Стало</small><b>${money(rep.cashAfter)}</b></div><span class="dl ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '+' : '−'}${money(Math.abs(d))}</span></div>
    <div class="mini-stats"><div><span>Виручка</span><b class="pos">${money(m.revenue)}</b></div><div><span>Витрати</span><b class="neg">${money(out)}</b></div>${m.invest ? `<div><span>Надходження</span><b class="pos">${money(m.invest)}</b></div>` : ''}<div><span>Відвідувачі</span><b>${num(r.visitors)}</b></div><div><span>${s.product.launched ? 'Нові користувачі' : 'Записалися в чергу'}</span><b>${num(r.signups)}</b></div><div><span>Нові платні</span><b>${num(r.newPaid)}</b></div><div><span>Пішли</span><b>${num(r.churned)}</b></div></div>
    ${rep.built?.length ? `<p class="note ok">${icon('check', 16)} Розробка завершила: ${rep.built.map(f => esc(S.feature(f).t)).join(', ')}</p>` : ''}
    ${rep.notes.map(n => `<p class="note warn">${icon('info', 16)} ${esc(n)}</p>`).join('')}
    ${rep.events.map(e => `<p class="note">${icon('mail', 16)} <b>${esc(e.t)}</b> — ${esc(e.d)}</p>`).join('')}
    ${rep.broke ? `<p class="note bad">${icon('alert', 16)} Гроші закінчилися! Є 2 тижні, щоб урятувати компанію — подивіться пошту.</p>` : ''}
    ${!rep.over && s.week - (s.flags.fileWeek ?? -1) >= 8 ? `<p class="note">${icon('save', 16)} <span>Ви давно не зберігали гру у файл. <button class="link" data-act="saveFile">Зберегти зараз</button></span></p>` : ''}
    ${rep.ach.length ? `<div class="wk-ach">${rep.ach.map(k => `<div class="ach on">${icon('star', 18)}<span><b>${esc(ACHIEVEMENTS[k].t)}</b><small>${esc(ACHIEVEMENTS[k].d)}</small></span></div>`).join('')}</div>` : ''}
    <div class="row end gap"><button class="btn primary" data-md-close autofocus>${rep.over ? 'Підсумки' : `Тиждень ${s.week + 1}`} ${icon('right', 16)}</button></div>`;
  modal({ title: `Тиждень ${rep.week + 1} завершено`, cls: 'week', html, onClose: () => { if (rep.over || S.s.over) ending(); } });
}
function ending() {
  const s = S.s, o = s.over; if (!o) return;
  const val = S.valuation(), stake = S.stake();
  const T = { bankrupt: ['Компанія закрилася', `Через ${o.week} ${plural(o.week, 'тиждень', 'тижні', 'тижнів')} гроші закінчилися. Це трапляється з більшістю стартапів — і кожен такий досвід вчить. Подивіться у звіті, що пішло не так.`],
    sold: ['Компанію продано!', `Ви продали компанію за ${money(o.value)}. Ваша частка ${pct(stake, 1)} — це ${money(o.value * stake)}. Успішний вихід!`],
    time: ['Два роки позаду', `Компанія жива. Оцінка — ${money(val)}, ваша частка ${pct(stake, 1)} ≈ ${money(val * stake)}.`] }[o.kind];
  modal({ title: T[0], cls: `ending ${o.kind}`, html: `<p>${esc(T[1])}</p><p class="sm muted">Збережіть результат у файл — його можна здати викладачеві або відкрити пізніше.</p><div class="row end gap wrap"><button class="btn" data-act-end="new">Нова гра</button><button class="btn" data-act-end="file">${icon('save', 16)} Зберегти у файл</button><button class="btn primary" data-act-end="report">Підсумковий звіт</button></div>`,
    onOpen: api => api.el.addEventListener('click', e => { const b = e.target.closest('[data-act-end]'); if (!b) return; if (b.dataset.actEnd === 'file') { saveFile(); return; } api.close(); if (b.dataset.actEnd === 'report') C.go('report'); else startWizard(); }) });
}

/* ═════════ майстер старту ═════════ */
function startWizard() {
  const blankFeat = (core = false) => ({ name: '', desc: '', size: 'm', core, segs: [0] });
  const w = { step: 0, idea: 'homework', name: '', group: '', bg: 'dev', company: '', color: IDEAS.homework.color, sym: 'spark', fff: false,
    c: { name: '', kind: 'app', scope: 'country', pitch: '', problem: '', unitCost: 400, batchMin: 20, leadTime: 1, segments: [{ name: '', arch: 'teens', size: '', price: '' }, { name: '', arch: 'parents', size: '', price: '' }], features: [blankFeat(true), blankFeat(), blankFeat()], competitors: [{ name: '', price: '', weak: '', segs: [0] }] } };
  // остання власна ідея зберігається в браузері: її можна доопрацювати й зіграти ще раз
  const blankC = JSON.parse(JSON.stringify(w.c));
  try { const saved = JSON.parse(localStorage.getItem(IDEA_KEY)); if (saved?.segments?.length && saved.features?.length) { w.c = { ...blankC, ...saved }; w.restored = true; } } catch { /* немає збереженої ідеї */ }
  const el = h('<div class="wizard" role="dialog" aria-modal="true" aria-label="Новий стартап"></div>');
  document.body.appendChild(el); document.body.classList.add('wz-on'); $('.app').inert = true;
  const steps = () => ['hello', 'idea', ...(w.idea === 'custom' ? ['cIdea', 'cSegs', 'cFeats', 'cComp', 'cCheck'] : []), 'founder', 'company', 'money'];
  const TITLES = { hello: 'Вітаємо', idea: 'Ідея', cIdea: 'Опис', cSegs: 'Клієнти', cFeats: 'Функції', cComp: 'Конкуренти', cCheck: 'Перевірка', founder: 'Засновник', company: 'Компанія', money: 'Гроші' };
  let c = w.c;
  const units = () => KINDS[c.kind]?.base === 'hardware', perUnit = () => units() ? 'за штуку' : 'на місяць';
  const segNames = () => c.segments.map((x, i) => x.name.trim() || `Сегмент ${i + 1}`);
  const archSel = (i, v) => `<select class="inp" data-c="segments.${i}.arch" aria-label="Тип клієнтів">${Object.entries(ARCH).map(([k, a]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${esc(a.t)}</option>`).join('')}</select>`;
  const segChecks = (path, sel) => `<div class="wz-segs">${segNames().map((n, i) => `<label><input type="checkbox" data-c="${path}" value="${i}" ${sel.includes(i) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</div>`;
  const VIEW = {
    hello: () => `<div class="wz-hero">${icon('rocket', 46)}<h1>Симулятор стартапу</h1><p>Ви засновуєте компанію з нуля. Говорите з клієнтами, будуєте продукт, створюєте бренд, шукаєте канали, рахуєте гроші, наймаєте команду й залучаєте інвестиції. Кожне рішення має наслідки.</p><ul class="wz-list"><li>${icon('users', 18)} Інтерв'ю з клієнтами й опитування</li><li>${icon('plan', 18)} Бізнес-план (Lean Canvas) і фінплан</li><li>${icon('palette', 18)} Бренд, маркетинг, акції</li><li>${icon('handshake', 18)} Гранти, інвестори, кредит, краудфандинг</li><li>${icon('laptop', 18)} Команда й підробіток</li><li>${icon('card', 18)} Платіжні системи, інвестування й криптовалюта</li></ul><p class="muted sm">Один хід — тиждень. Гра триває 2 роки, якщо раніше не закінчаться гроші. Усі люди й компанії вигадані.</p>
      <div class="wz-open"><button class="btn" data-act="openFile">${icon('open', 16)} Відкрити збережену гру з файлу</button><small class="muted">Або перетягніть файл .json на цю сторінку</small></div></div>`,
    idea: () => `<h2>Оберіть ідею</h2><div class="wz-ideas">${Object.entries(IDEAS).filter(([k]) => k !== 'custom').map(([k, x]) => `<button class="wz-idea ${w.idea === k ? 'on' : ''}" data-w="idea" data-v="${k}" style="--ic:${x.color}"><span class="wz-ic">${icon(x.icon, 26)}</span><b>${esc(x.t)}</b><p>${esc(x.pitch)}</p><small>${{ app: 'Застосунок', hardware: 'Пристрій («залізо»)', saas: 'Сервіс для бізнесу' }[x.kind]} · сегменти: ${Object.values(x.segments).map(g => g.short.toLowerCase()).join(', ')}</small></button>`).join('')}
      <button class="wz-idea own ${w.idea === 'custom' ? 'on' : ''}" data-w="idea" data-v="custom" style="--ic:#111827"><span class="wz-ic">${icon('bulb', 26)}</span><b>Своя ідея</b><p>Опишіть власний стартап: проблему, клієнтів, функції й конкурентів. А ринок покаже, чи праві ви.</p><small>Ваші припущення перевірятимуться інтерв'ю</small></button></div>`,
    cIdea: () => `<h2>Ваша ідея</h2>${w.restored ? `<p class="note">${icon('info', 16)} <span>Ми відновили вашу попередню ідею — можна доопрацювати її. <button class="link" data-w="clearIdea">Почати з чистого аркуша</button></span></p>` : ''}<div class="wz-form">
      <label class="wz-f"><span>Назва ідеї</span><input class="inp" data-c="name" value="${esc(c.name)}" maxlength="40" placeholder="Наприклад: Обмін книжками між школярами" autofocus></label>
      <div class="wz-f"><span>Що це буде</span><div class="wz-kinds">${Object.entries(KINDS).map(([k, x]) => `<button class="opt ${c.kind === k ? 'on' : ''}" data-w="kind" data-v="${k}"><b>${esc(x.t)}</b><small>${esc(x.d)}</small></button>`).join('')}</div></div>
      <label class="wz-f"><span>Яку проблему розв'язуєте (кілька слів)</span><input class="inp" data-c="problem" value="${esc(c.problem)}" maxlength="60" placeholder="Наприклад: пошук підручників і книжок"></label>
      <label class="wz-f"><span>Ідея одним-двома реченнями</span><textarea class="inp" rows="2" data-c="pitch" maxlength="220" placeholder="Застосунок, де школярі обмінюються підручниками й книжками з тими, хто живе поруч.">${esc(c.pitch)}</textarea></label>
      <div class="wz-f"><span>Де працюватимете</span><div class="wz-kinds">${Object.entries(SCOPES).map(([k, x]) => `<button class="opt ${c.scope === k ? 'on' : ''}" data-w="scope" data-v="${k}"><b>${esc(x.t)}</b></button>`).join('')}</div><small class="muted">Від цього залежить, скільки клієнтів узагалі може бути.</small></div>
      ${units() ? `<div class="wz-three"><label class="wz-f"><span>Собівартість однієї штуки, ₴</span><input class="inp" type="number" min="10" step="10" data-c="unitCost" value="${c.unitCost}"></label>
        <label class="wz-f"><span>Найменша партія, шт.</span><input class="inp" type="number" min="5" max="1000" step="5" data-c="batchMin" value="${c.batchMin}"></label>
        <label class="wz-f"><span>Скільки тижнів чекати партію</span><input class="inp" type="number" min="1" max="8" step="1" data-c="leadTime" value="${c.leadTime}"></label></div>` : ''}</div>`,
    cSegs: () => `<h2>Хто ваші клієнти?</h2><p class="muted sm">Опишіть 2–3 групи. Тип групи впливає на канали й на те, скільки такі клієнти зазвичай платять. Оцінки кількості й ціни необов'язкові — але наприкінці гри ви побачите, наскільки влучили.</p>
      <div class="wz-rows">${c.segments.map((x, i) => `<div class="wz-feat"><div class="wz-row"><input class="inp" data-c="segments.${i}.name" value="${esc(x.name)}" maxlength="40" placeholder="${['Наприклад: школярі 7–11 класів', 'Наприклад: батьки школярів', 'Наприклад: шкільні бібліотеки'][i]}" aria-label="Назва групи ${i + 1}">${archSel(i, x.arch)}${c.segments.length > 2 ? `<button class="ib" data-w="rmSeg" data-v="${i}" aria-label="Прибрати">${icon('x', 16)}</button>` : ''}</div>
        <div class="wz-two"><label class="wz-f sm"><span>Скільки таких клієнтів (ваша оцінка)</span><input class="inp" type="number" min="0" step="100" data-c="segments.${i}.size" value="${esc(x.size)}" placeholder="Наприклад: 5000"></label><label class="wz-f sm"><span>Скільки готові платити, ₴ ${perUnit()}</span><input class="inp" type="number" min="0" step="10" data-c="segments.${i}.price" value="${esc(x.price)}" placeholder="Наприклад: 150"></label></div></div>`).join('')}</div>
      ${c.segments.length < 3 ? `<button class="btn sm" data-w="addSeg">${icon('plus', 14)} Додати групу</button>` : ''}`,
    cFeats: () => `<h2>Що вмітиме продукт?</h2><p class="muted sm">3–10 функцій. Позначте основну й кому, на вашу думку, кожна потрібна. Оплату, аналітику й сервери додамо самі.</p>
      <div class="wz-feats">${c.features.map((f, i) => `<div class="wz-feat"><div class="wz-row"><input class="inp" data-c="features.${i}.name" value="${esc(f.name)}" maxlength="40" placeholder="Назва функції" aria-label="Функція ${i + 1}"><select class="inp" data-c="features.${i}.size" aria-label="Складність">${Object.entries(SIZES).map(([k, z]) => `<option value="${k}" ${f.size === k ? 'selected' : ''}>${z.t} (${z.cost} оч.)</option>`).join('')}</select>${c.features.length > 3 ? `<button class="ib" data-w="rmFeat" data-v="${i}" aria-label="Прибрати">${icon('x', 16)}</button>` : ''}</div>
        <input class="inp sm-w" data-c="features.${i}.desc" value="${esc(f.desc)}" maxlength="90" placeholder="Коротко: що вона робить (необов'язково)" aria-label="Опис функції ${i + 1}">
        <div class="wz-row2"><label class="core"><input type="radio" name="core" data-c="core" value="${i}" ${f.core ? 'checked' : ''}> Основна</label><span class="muted sm">Кому потрібна:</span>${segChecks(`features.${i}.segs`, f.segs)}</div></div>`).join('')}</div>
      ${c.features.length < 10 ? `<button class="btn sm" data-w="addFeat">${icon('plus', 14)} Додати функцію</button>` : ''}`,
    cComp: () => `<h2>Хто ваші конкуренти?</h2><p class="muted sm">Конкуренти є завжди, навіть якщо це «зошит», «таблиця в Excel» чи «просто нічого не робити». Їхні слабкі місця клієнти згадуватимуть в інтерв'ю.</p>
      <div class="wz-feats">${c.competitors.map((x, i) => `<div class="wz-feat"><div class="wz-row"><input class="inp" data-c="competitors.${i}.name" value="${esc(x.name)}" maxlength="40" placeholder="Наприклад: групи обміну у Viber" aria-label="Конкурент ${i + 1}"><input class="inp num-w" type="number" min="0" step="10" data-c="competitors.${i}.price" value="${esc(x.price)}" placeholder="Ціна, ₴" aria-label="Ціна конкурента, ₴ ${perUnit()}"><button class="ib" data-w="rmComp" data-v="${i}" aria-label="Прибрати">${icon('x', 16)}</button></div>
        <input class="inp sm-w" data-c="competitors.${i}.weak" value="${esc(x.weak)}" maxlength="80" placeholder="Що в них погано? Наприклад: довго чекати відповіді" aria-label="Слабке місце конкурента ${i + 1}">
        <div class="wz-row2"><span class="muted sm">З ким конкурує:</span>${segChecks(`competitors.${i}.segs`, x.segs)}</div></div>`).join('')}</div>
      ${c.competitors.length < 4 ? `<button class="btn sm" data-w="addComp">${icon('plus', 14)} Додати конкурента</button>` : ''}`,
    cCheck: () => { const list = ideaCheck(c), warn = list.filter(x => x.lvl === 'warn').length;
      return `<h2>Перевірка ідеї</h2><p class="muted sm">${warn ? `Наставниця помітила ${warn} ${plural(warn, 'річ', 'речі', 'речей')}, які варто обдумати. Це поради, а не заборони: можна повернутися й виправити або йти далі.` : 'Ідея описана добре. Тепер усе вирішить ринок.'}</p>
      <ul class="wz-check">${list.map(x => `<li class="${x.lvl}">${icon(x.lvl === 'ok' ? 'check' : 'alert', 18)}<span>${esc(x.t)}</span></li>`).join('')}</ul>`; },
    founder: () => `<h2>Хто ви?</h2><div class="wz-two"><label class="wz-f"><span>Ваше ім'я та прізвище</span><input class="inp" data-w="name" value="${esc(w.name)}" placeholder="Наприклад, Олена Коваль" maxlength="40" autofocus></label><label class="wz-f"><span>Клас або група <small class="muted">(необов'язково)</small></span><input class="inp" data-w="group" value="${esc(w.group)}" placeholder="Наприклад, 9-Б" maxlength="20"></label></div><p class="sm muted">Ваш досвід визначає, що вам вдається найкраще.</p><div class="wz-bgs">${Object.entries(BACKGROUNDS).map(([k, b]) => `<button class="wz-bg ${w.bg === k ? 'on' : ''}" data-w="bg" data-v="${k}">${icon(b.icon, 24)}<b>${b.t}</b><small>${b.desc}</small></button>`).join('')}</div>`,
    company: () => `<h2>Ваша компанія</h2><div class="wz-co">${logo({ color: w.color, sym: w.sym }, 72)}<b style="color:${w.color}">${esc(w.company || 'Назва')}</b></div><label class="wz-f"><span>Назва</span><input class="inp" data-w="company" value="${esc(w.company)}" placeholder="Наприклад, ${{ homework: 'Зрозумій', plant: 'Полий-ка', english: 'Speakly', booking: 'Записатись', custom: 'Моя компанія' }[w.idea]}" maxlength="24" autofocus></label>
      <p class="sm muted">Колір і символ (потім можна змінити в розділі «Бренд»)</p><div class="swatches">${PALETTE.map(col => `<button class="sw ${w.color === col ? 'on' : ''}" style="background:${col}" data-w="color" data-v="${col}" aria-label="Колір"></button>`).join('')}</div><div class="syms">${SYMBOLS.map(sy => `<button class="sym ${w.sym === sy ? 'on' : ''}" data-w="sym" data-v="${sy}" aria-label="Символ">${icon(sy, 20)}</button>`).join('')}</div>`,
    money: () => `<h2>Стартові гроші</h2><div class="wz-money"><div class="opt on"><b>Власні заощадження</b><p class="big">${money(150000)}</p><small>Це все, що у вас є.</small></div>
      <button class="opt ${w.fff ? 'on' : ''}" data-w="fff">${icon(w.fff ? 'check' : 'plus', 18)}<b>Гроші від родини й друзів</b><p class="big">+${money(300000)}</p><small>В обмін на 10% компанії. Більше часу на пошук, але ви вже не єдиний власник.</small></button></div>
      <p class="sm muted">Разом: <b>${money(150000 + (w.fff ? 300000 : 0))}</b>. Ваша частка: <b>${w.fff ? '90%' : '100%'}</b>.</p>`,
  };
  const check = {
    cIdea: () => !c.name.trim() ? ['Придумайте назву ідеї', 'name'] : c.problem.trim().length < 3 ? ['Опишіть проблему кількома словами', 'problem'] : c.pitch.trim().length < 10 ? ['Опишіть ідею хоча б одним реченням', 'pitch'] : null,
    cSegs: () => c.segments.filter(x => x.name.trim()).length < 2 ? ['Назвіть щонайменше дві групи клієнтів', 'segments.0.name'] : null,
    cFeats: () => c.features.filter(f => f.name.trim()).length < 3 ? ['Потрібно щонайменше три функції', 'features.0.name'] : !c.features.some(f => f.core && f.name.trim()) ? ['Позначте основну функцію', null] : null,
    founder: () => !w.name.trim() ? ['Введіть своє ім\'я', null] : null,
    company: () => !w.company.trim() ? ['Придумайте назву компанії', null] : null,
  };
  const draw = () => {
    const st = steps(), key = st[w.step];
    el.innerHTML = `<div class="wz-card"><div class="wz-steps">${st.map((k, i) => `<span class="${i === w.step ? 'on' : i < w.step ? 'done' : ''}">${i < w.step ? icon('check', 14) : i + 1}<small>${TITLES[k]}</small></span>`).join('')}</div>
      <div class="wz-body">${VIEW[key]()}</div>
      <div class="wz-nav">${w.step ? `<button class="btn" data-w="back">${icon('left', 16)} Назад</button>` : S ? `<button class="btn ghost" data-w="cancel">Скасувати</button>` : '<span></span>'}<button class="btn primary lg" data-w="next">${w.step === st.length - 1 ? `${icon('rocket', 18)} Заснувати компанію` : `Далі ${icon('right', 16)}`}</button></div></div>`;
    el.querySelector('[autofocus]')?.focus();
  };
  const setPath = (path, v) => { const ks = path.split('.'); let o = c; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks.at(-1)] = v; };
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-w]'); if (!b) return;
    const k = b.dataset.w, st = steps();
    if (k === 'idea') { w.idea = b.dataset.v; if (IDEAS[w.idea] && w.idea !== 'custom') w.color = IDEAS[w.idea].color; }
    else if (k === 'kind') { c.kind = b.dataset.v; if (c.kind === 'hardware' && c.batchMin < 100) Object.assign(c, { batchMin: 100, leadTime: 3 }); if (c.kind === 'goods' && c.batchMin >= 100) Object.assign(c, { batchMin: 20, leadTime: 1, unitCost: Math.min(c.unitCost, 150) }); }
    else if (k === 'scope') c.scope = b.dataset.v;
    else if (k === 'clearIdea') { w.c = c = JSON.parse(JSON.stringify(blankC)); w.restored = false; try { localStorage.removeItem(IDEA_KEY); } catch { /* приватний режим */ } }
    else if (k === 'addSeg') c.segments.push({ name: '', arch: 'adults', size: '', price: '' });
    else if (k === 'rmSeg') { const i = +b.dataset.v; c.segments.splice(i, 1); for (const f of [...c.features, ...c.competitors]) f.segs = f.segs.filter(x => x !== i).map(x => x > i ? x - 1 : x); }
    else if (k === 'addFeat') c.features.push(blankFeat());
    else if (k === 'rmFeat') { const was = c.features[+b.dataset.v].core; c.features.splice(+b.dataset.v, 1); if (was) c.features[0].core = true; }
    else if (k === 'addComp') c.competitors.push({ name: '', price: '', weak: '', segs: [] });
    else if (k === 'rmComp') c.competitors.splice(+b.dataset.v, 1);
    else if (k === 'bg') w.bg = b.dataset.v;
    else if (k === 'color') w.color = b.dataset.v;
    else if (k === 'sym') w.sym = b.dataset.v;
    else if (k === 'fff') w.fff = !w.fff;
    else if (k === 'back') w.step--;
    else if (k === 'cancel') { el.remove(); document.body.classList.remove('wz-on'); $('.app').inert = false; return; }
    else if (k === 'next') {
      const err = check[st[w.step]]?.();
      if (err) { toast(err[0], 'bad'); (el.querySelector(err[1] ? `[data-c="${err[1]}"]` : '[data-w="name"], [data-w="company"]'))?.focus(); return; }
      if (w.step === st.length - 1) {
        // порожні групи клієнтів відкидаємо, а посилання функцій і конкурентів на групи перенумеровуємо
        const keep = c.segments.map((x, i) => x.name.trim() ? i : -1).filter(i => i >= 0), remap = a => a.map(i => keep.indexOf(i)).filter(i => i >= 0);
        const custom = w.idea === 'custom' ? { ...c, segments: keep.map(i => c.segments[i]), features: c.features.filter(f => f.name.trim()).map(f => ({ ...f, segs: remap(f.segs) })), competitors: c.competitors.filter(x => x.name.trim()).map(x => ({ ...x, segs: remap(x.segs) })) } : null;
        if (custom) try { localStorage.setItem(IDEA_KEY, JSON.stringify(c)); } catch { /* сховище недоступне */ }
        S = newGame({ idea: w.idea === 'custom' ? 'homework' : w.idea, founder: w.name.trim(), group: w.group.trim(), bg: w.bg, company: w.company.trim(), color: w.color, sym: w.sym, fff: w.fff, custom });
        el.remove(); document.body.classList.remove('wz-on'); ui.view = 'dash'; render(); window.Startup.S = S;
        return;
      }
      w.step++;
    } else return;
    draw();
  });
  el.addEventListener('input', e => {
    const t = e.target, k = t.dataset.w, p = t.dataset.c;
    if (k === 'name' || k === 'company' || k === 'group') { w[k] = t.value; if (k === 'company') { const x = el.querySelector('.wz-co b'); if (x) x.textContent = w.company || 'Назва'; } }
    else if (p && t.type !== 'checkbox' && t.type !== 'radio' && t.tagName !== 'SELECT') setPath(p, t.type === 'number' ? +t.value : t.value);
  });
  el.addEventListener('change', e => {
    const t = e.target, p = t.dataset.c; if (!p) return;
    if (p === 'core') { c.features.forEach((f, i) => f.core = i === +t.value); return; }
    if (t.type === 'checkbox') { const ks = p.split('.'), arr = c[ks[0]][+ks[1]].segs, v = +t.value; c[ks[0]][+ks[1]].segs = t.checked ? [...new Set([...arr, v])] : arr.filter(x => x !== v); return; }
    if (t.tagName === 'SELECT') { setPath(p, t.value); if (p.includes('.name') || p.endsWith('arch')) return; }
    if (p.startsWith('segments') && p.endsWith('.name')) return;
  });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input:not([type=checkbox]):not([type=radio])')) el.querySelector('[data-w="next"]')?.click(); });
  draw();
}

/* ═════════ події ═════════ */
// розділ ще не потрібен на цьому етапі: пояснюємо й даємо відкрити, якщо учень хоче
function askUnlock(v) {
  const st = viewStage(v);
  return confirmBox(`«${VIEWS[v].t}» знадобиться на етапі ${st + 1} «${STAGES[st].t}»`, 'Відкрити зараз', { sub: 'Спершу варто виконати завдання поточного етапу. Але якщо хочете — розділ можна відкрити вже зараз.' }).then(ok => { if (ok) C.go(v); });
}
document.addEventListener('click', e => {
  const t = e.target.closest('.term'); if (t) { e.preventDefault(); termPop(t); return; }
  if (ui.more && !e.target.closest('.more-w')) closeMore();
  const a = e.target.closest('[data-act]'); if (!a || a.disabled) return;
  if (a.dataset.act === 'openFile') return openFile();
  if (!S) return;
  const k = a.dataset.act;
  if (k === 'endWeek') return endWeek();
  if (k === 'more') { ui.more = !ui.more; topbar(); return; }
  if (k === 'tab') {
    const tb = TABS.find(x => x[0] === a.dataset.k), info = stageInfo(S), last = ui.tabLast?.[tb[0]];
    const v = last && isOpen(S, last, info) ? last : tb[3].find(x => isOpen(S, x, info));
    if (v) C.go(v); else askUnlock(tb[3][0]);
    return;
  }
  if (k === 'stage') { ui.stage = +a.dataset.i; C.go('dash'); return; }
  if (k === 'locked') return askUnlock(a.dataset.to);
  if (k === 'saveFile') return saveFile();
  if (k === 'newGame') return confirmBox('Почати нову гру?', 'Почати заново', { danger: true, sub: 'Поточна компанія буде втрачена.' }).then(ok => { if (ok) startWizard(); });
  const fn = ACTS[k]; if (fn) { fn(C, a, e); save(); }
});
document.addEventListener('input', e => { const el = e.target.closest('[data-in]'); if (!el || !S) return; const fn = INS[el.dataset.in]; if (fn && (el.type === 'range' || el.tagName === 'TEXTAREA' || el.type === 'text' || el.type === 'search' || !el.type || el.type === 'number')) fn(C, el, e); });
document.addEventListener('change', e => { const el = e.target.closest('[data-in]'); if (!el || !S) return; const fn = INS[el.dataset.in]; if (!fn) return; if (el.type === 'range') { save(); render(); return; } if (el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'SELECT') fn(C, el, e); else if (el.tagName === 'TEXTAREA' || el.type === 'text') { save(); } });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeMore();
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (S && !document.querySelector('.wizard')) saveFile(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); openFile(); }
});
// файл збереження можна просто перетягнути на сторінку
document.addEventListener('dragover', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); document.body.classList.add('drop-on'); } });
document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('drop-on'); });
document.addEventListener('drop', e => { const f = e.dataTransfer?.files?.[0]; document.body.classList.remove('drop-on'); if (!f) return; e.preventDefault(); readFile(f); });

window.Startup = { S, C, get sim() { return S; } };
if (S) render(); else startWizard();
$('#boot')?.remove();
