// Симулятор стартапу · оболонка: меню, верхня панель, маршрути, старт, підсумки тижня, збереження.
import { IDEAS, BACKGROUNDS, ACHIEVEMENTS } from './data.js';
import { Sim, newGame, okState, money, num, pct, plural, dateText, WEEKS, HOURS } from './sim.js';
import { SYMBOLS, PALETTE } from './mods.js';
import { ARCH, KINDS, SIZES } from './custom.js';
import { packGame, unpackGame, fileName } from './file.js';
import { icon } from './icons.js';
import { esc, $, $$, h, modal, toast, termPop, confirmBox, logo, nl2br } from './ui.js';
import { coreViews, coreActs, coreIns, hoursUsed } from './v-core.js';
import { marketViews, marketActs, marketIns } from './v-market.js';
import { moneyViews, moneyActs, moneyIns } from './v-money.js';
import { peopleViews, peopleActs, peopleIns } from './v-people.js';
import { STAGES, stageInfo, viewStage, isOpen, unlock, syncStage } from './stages.js';

const KEY = 'edvault-startup';
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
function theme() { if (!S) return; document.documentElement.style.setProperty('--acc', S.s.company.color); document.documentElement.style.setProperty('--acc-soft', S.s.company.color + '1a'); }
const runwayText = rw => rw === Infinity ? 'прибуток' : rw > 104 ? '2+ роки' : `${Math.max(0, Math.floor(rw))} ${plural(Math.max(0, Math.floor(rw)), 'тиждень', 'тижні', 'тижнів')}`;
function topbar() {
  if (!S) return;
  const s = S.s, rw = S.runwayWeeks(), e = Math.round(s.founder.energy);
  $('#top').innerHTML = `<button class="tp-brand" data-act="go" data-to="dash" title="${esc(s.company.name)}: ${esc(S.I.t)}. На головну">${logo(s.company, 36)}<span><b>${esc(s.company.name)}</b><small>Тиждень ${s.week + 1} з ${WEEKS} · ${dateText(s.week)}</small></span></button>
    <div class="tp-stats">
      <span class="tp-s ${s.cash < 30000 ? 'bad' : ''}" title="Гроші компанії">${icon('wallet', 16)}<span><small>Гроші</small><b>${money(s.cash)}</b></span></span>
      <span class="tp-s ${rw < 8 ? 'bad' : rw < 16 ? 'warn' : ''} hide-t" title="На скільки тижнів вистачить грошей">${icon('clock', 16)}<span><small>Вистачить на</small><b>${runwayText(rw)}</b></span></span>
      <span class="tp-s hide-m" title="Скільки людей користуються продуктом">${icon('users', 16)}<span><small>Клієнти</small><b>${num(S.activeUsers())}</b></span></span>
      <span class="tp-s ${e < 30 ? 'bad' : e < 60 ? 'warn' : ''} hide-m" title="Ваші сили. Падають, якщо працювати забагато">${icon('bolt', 16)}<span><small>Сили</small><b>${e}%</b></span></span>
    </div>
    <button class="btn top-save" data-act="saveFile" title="Зберегти всю гру у файл (Ctrl+S)" aria-label="Зберегти гру у файл">${icon('save', 16)}<span>Зберегти</span></button>
    <div class="more-w"><button class="btn ib-b" data-act="more" aria-label="Ще" aria-expanded="${!!ui.more}" title="Ще">${icon('more', 18)}</button>${ui.more ? morePop() : ''}</div>
    <button class="btn primary end-week" data-act="endWeek" ${s.over ? 'disabled' : ''}>${icon('next', 16)}<span>Завершити тиждень</span></button>`;
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
// доріжка етапів: пройдені — зелені, поточний — підсвічений, наступні — сірі
function road(info) {
  $('#road').innerHTML = `<ol>${info.list.map((st, i) => {
    const cls = st.done && i < info.cur ? 'done' : i === info.cur ? 'cur' : i <= info.reached ? 'open' : 'lock';
    return `<li class="${cls}"><button data-act="stage" data-i="${i}" ${i > info.reached ? 'disabled' : ''} aria-current="${i === info.cur ? 'step' : 'false'}" title="${esc(st.long)}"><span class="c">${cls === 'done' || (info.allDone && i === info.cur) ? icon('check', 16) : i + 1}</span><span class="l">${esc(st.t)}</span></button></li>`;
  }).join('')}</ol>`;
}
function tabs(info) {
  const s = S.s, unread = s.inbox.filter(m => !m.read || (m.choices && m.chosen == null)).length;
  const cur = tabOf(ui.view);
  const badge = k => k === 'mail' && unread ? `<span class="badge">${unread}</span>` : k === 'money' && Object.values(s.inv).some(x => x.status === 'offer') && isOpen(S, 'investors', info) ? '<span class="badge">!</span>' : '';
  const sub = cur && cur[3].length > 1 ? `<div class="subtabs" role="tablist">${cur[3].map(v => {
    const open = isOpen(S, v, info), st = viewStage(v);
    return `<button class="st-it ${ui.view === v ? 'on' : ''} ${open ? '' : 'locked'}" data-act="${open ? 'go' : 'locked'}" data-to="${v}" ${ui.view === v ? 'aria-current="page"' : ''} ${open ? '' : `title="Знадобиться на етапі ${st + 1} «${esc(STAGES[st].t)}»"`}>${icon(open ? VIEWS[v].icon : 'lock', 15)}<span>${VIEWS[v].t}</span>${v === 'product' && S.canLaunch() ? '<span class="badge dot"></span>' : ''}</button>`;
  }).join('')}</div>` : '';
  $('#tabs').innerHTML = `<div class="navtabs-in">${TABS.map(([k, t, ic, views]) => `<button class="tab ${cur?.[0] === k ? 'on' : ''}" data-act="tab" data-k="${k}" ${cur?.[0] === k ? 'aria-current="page"' : ''}>${icon(ic, 18)}<span>${t}</span>${badge(k)}</button>`).join('')}</div>${sub}`;
}
function render() {
  if (!S) return;
  const info = syncStage(S);
  theme(); topbar(); road(info); tabs(info);
  const V = VIEWS[ui.view] || VIEWS.dash;
  const main = $('#main');
  main.innerHTML = `${ui.view === 'dash' ? '' : `<header class="pg-h"><h1>${icon(V.icon, 24)} ${V.t}</h1>${S.s.over ? `<span class="chip bad">Гру завершено</span>` : ''}</header>`}${V.render(S, ui, info)}`;
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
    c: { name: '', kind: 'app', pitch: '', problem: '', unitCost: 400, segments: [{ name: '', arch: 'teens' }, { name: '', arch: 'parents' }], features: [blankFeat(true), blankFeat(), blankFeat()], competitors: [{ name: '', segs: [0] }] } };
  const el = h('<div class="wizard" role="dialog" aria-modal="true" aria-label="Новий стартап"></div>');
  document.body.appendChild(el); document.body.classList.add('wz-on');
  const steps = () => ['hello', 'idea', ...(w.idea === 'custom' ? ['cIdea', 'cSegs', 'cFeats', 'cComp'] : []), 'founder', 'company', 'money'];
  const TITLES = { hello: 'Вітаємо', idea: 'Ідея', cIdea: 'Опис', cSegs: 'Клієнти', cFeats: 'Функції', cComp: 'Конкуренти', founder: 'Засновник', company: 'Компанія', money: 'Гроші' };
  const c = w.c, segNames = () => c.segments.map((x, i) => x.name.trim() || `Сегмент ${i + 1}`);
  const archSel = (i, v) => `<select class="inp" data-c="segments.${i}.arch" aria-label="Тип клієнтів">${Object.entries(ARCH).map(([k, a]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${esc(a.t)}</option>`).join('')}</select>`;
  const segChecks = (path, sel) => `<div class="wz-segs">${segNames().map((n, i) => `<label><input type="checkbox" data-c="${path}" value="${i}" ${sel.includes(i) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</div>`;
  const VIEW = {
    hello: () => `<div class="wz-hero">${icon('rocket', 46)}<h1>Симулятор стартапу</h1><p>Ви засновуєте компанію з нуля. Говорите з клієнтами, будуєте продукт, створюєте бренд, шукаєте канали, рахуєте гроші, наймаєте команду й залучаєте інвестиції. Кожне рішення має наслідки.</p><ul class="wz-list"><li>${icon('users', 18)} Інтерв'ю з клієнтами й опитування</li><li>${icon('plan', 18)} Бізнес-план (Lean Canvas) і фінплан</li><li>${icon('palette', 18)} Бренд, маркетинг, акції</li><li>${icon('handshake', 18)} Гранти, інвестори, кредит, краудфандинг</li><li>${icon('laptop', 18)} Команда й підробіток</li><li>${icon('card', 18)} Платіжні системи, інвестування й криптовалюта</li></ul><p class="muted sm">Один хід — тиждень. Гра триває 2 роки, якщо раніше не закінчаться гроші. Усі люди й компанії вигадані.</p>
      <div class="wz-open"><button class="btn" data-act="openFile">${icon('open', 16)} Відкрити збережену гру з файлу</button><small class="muted">Або перетягніть файл .json на цю сторінку</small></div></div>`,
    idea: () => `<h2>Оберіть ідею</h2><div class="wz-ideas">${Object.entries(IDEAS).filter(([k]) => k !== 'custom').map(([k, x]) => `<button class="wz-idea ${w.idea === k ? 'on' : ''}" data-w="idea" data-v="${k}" style="--ic:${x.color}"><span class="wz-ic">${icon(x.icon, 26)}</span><b>${esc(x.t)}</b><p>${esc(x.pitch)}</p><small>${{ app: 'Застосунок', hardware: 'Пристрій («залізо»)', saas: 'Сервіс для бізнесу' }[x.kind]} · сегменти: ${Object.values(x.segments).map(g => g.short.toLowerCase()).join(', ')}</small></button>`).join('')}
      <button class="wz-idea own ${w.idea === 'custom' ? 'on' : ''}" data-w="idea" data-v="custom" style="--ic:#111827"><span class="wz-ic">${icon('bulb', 26)}</span><b>Своя ідея</b><p>Опишіть власний стартап: проблему, клієнтів, функції й конкурентів. А ринок покаже, чи праві ви.</p><small>Ваші припущення перевірятимуться інтерв'ю</small></button></div>`,
    cIdea: () => `<h2>Ваша ідея</h2><div class="wz-form">
      <label class="wz-f"><span>Назва ідеї</span><input class="inp" data-c="name" value="${esc(c.name)}" maxlength="40" placeholder="Наприклад: Обмін книжками між школярами" autofocus></label>
      <div class="wz-f"><span>Що це буде</span><div class="wz-kinds">${Object.entries(KINDS).map(([k, x]) => `<button class="opt ${c.kind === k ? 'on' : ''}" data-w="kind" data-v="${k}"><b>${esc(x.t)}</b><small>${{ app: 'Підписка, freemium або реклама', saas: 'Організації платять щомісяця', hardware: 'Продаж пристроїв, виробництво й склад' }[k]}</small></button>`).join('')}</div></div>
      <label class="wz-f"><span>Яку проблему розв'язуєте (кілька слів)</span><input class="inp" data-c="problem" value="${esc(c.problem)}" maxlength="60" placeholder="Наприклад: пошук підручників і книжок"></label>
      <label class="wz-f"><span>Ідея одним-двома реченнями</span><textarea class="inp" rows="2" data-c="pitch" maxlength="220" placeholder="Застосунок, де школярі обмінюються підручниками й книжками з тими, хто живе поруч.">${esc(c.pitch)}</textarea></label>
      ${c.kind === 'hardware' ? `<label class="wz-f"><span>Скільки коштуватиме виготовити один пристрій, ₴</span><input class="inp" type="number" min="50" step="10" data-c="unitCost" value="${c.unitCost}"></label>` : ''}</div>`,
    cSegs: () => `<h2>Хто ваші клієнти?</h2><p class="muted sm">Опишіть 2–3 групи. Тип групи впливає на розмір ринку, канали й те, скільки вони зазвичай готові платити. Чи справді їм болить — дізнаєтеся в інтерв'ю.</p>
      <div class="wz-rows">${c.segments.map((x, i) => `<div class="wz-row"><input class="inp" data-c="segments.${i}.name" value="${esc(x.name)}" maxlength="40" placeholder="${['Наприклад: школярі 7–11 класів', 'Наприклад: батьки школярів', 'Наприклад: шкільні бібліотеки'][i]}">${archSel(i, x.arch)}${c.segments.length > 2 ? `<button class="ib" data-w="rmSeg" data-v="${i}" aria-label="Прибрати">${icon('x', 16)}</button>` : ''}</div>`).join('')}</div>
      ${c.segments.length < 3 ? `<button class="btn sm" data-w="addSeg">${icon('plus', 14)} Додати групу</button>` : ''}`,
    cFeats: () => `<h2>Що вмітиме продукт?</h2><p class="muted sm">3–8 функцій. Позначте основну й кому, на вашу думку, кожна потрібна. Оплату, аналітику й сервери додамо самі.</p>
      <div class="wz-feats">${c.features.map((f, i) => `<div class="wz-feat"><div class="wz-row"><input class="inp" data-c="features.${i}.name" value="${esc(f.name)}" maxlength="40" placeholder="Назва функції"><select class="inp" data-c="features.${i}.size" aria-label="Складність">${Object.entries(SIZES).map(([k, z]) => `<option value="${k}" ${f.size === k ? 'selected' : ''}>${z.t} (${z.cost} оч.)</option>`).join('')}</select>${c.features.length > 3 ? `<button class="ib" data-w="rmFeat" data-v="${i}" aria-label="Прибрати">${icon('x', 16)}</button>` : ''}</div>
        <input class="inp sm-w" data-c="features.${i}.desc" value="${esc(f.desc)}" maxlength="90" placeholder="Коротко: що вона робить (необов'язково)">
        <div class="wz-row2"><label class="core"><input type="radio" name="core" data-c="core" value="${i}" ${f.core ? 'checked' : ''}> Основна</label><span class="muted sm">Кому потрібна:</span>${segChecks(`features.${i}.segs`, f.segs)}</div></div>`).join('')}</div>
      ${c.features.length < 8 ? `<button class="btn sm" data-w="addFeat">${icon('plus', 14)} Додати функцію</button>` : ''}`,
    cComp: () => `<h2>Хто ваші конкуренти?</h2><p class="muted sm">Конкуренти є завжди, навіть якщо це «зошит», «таблиця в Excel» чи «просто нічого не робити». Можна залишити порожнім, але тоді ринок здивує.</p>
      <div class="wz-feats">${c.competitors.map((x, i) => `<div class="wz-feat"><div class="wz-row"><input class="inp" data-c="competitors.${i}.name" value="${esc(x.name)}" maxlength="40" placeholder="Наприклад: групи обміну у Viber"><button class="ib" data-w="rmComp" data-v="${i}" aria-label="Прибрати">${icon('x', 16)}</button></div><div class="wz-row2"><span class="muted sm">З ким конкурує:</span>${segChecks(`competitors.${i}.segs`, x.segs)}</div></div>`).join('')}</div>
      ${c.competitors.length < 3 ? `<button class="btn sm" data-w="addComp">${icon('plus', 14)} Додати конкурента</button>` : ''}`,
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
    else if (k === 'kind') c.kind = b.dataset.v;
    else if (k === 'addSeg') c.segments.push({ name: '', arch: 'adults' });
    else if (k === 'rmSeg') { const i = +b.dataset.v; c.segments.splice(i, 1); for (const f of [...c.features, ...c.competitors]) f.segs = f.segs.filter(x => x !== i).map(x => x > i ? x - 1 : x); }
    else if (k === 'addFeat') c.features.push(blankFeat());
    else if (k === 'rmFeat') { const was = c.features[+b.dataset.v].core; c.features.splice(+b.dataset.v, 1); if (was) c.features[0].core = true; }
    else if (k === 'addComp') c.competitors.push({ name: '', segs: [] });
    else if (k === 'rmComp') c.competitors.splice(+b.dataset.v, 1);
    else if (k === 'bg') w.bg = b.dataset.v;
    else if (k === 'color') w.color = b.dataset.v;
    else if (k === 'sym') w.sym = b.dataset.v;
    else if (k === 'fff') w.fff = !w.fff;
    else if (k === 'back') w.step--;
    else if (k === 'cancel') { el.remove(); document.body.classList.remove('wz-on'); return; }
    else if (k === 'next') {
      const err = check[st[w.step]]?.();
      if (err) { toast(err[0], 'bad'); (el.querySelector(err[1] ? `[data-c="${err[1]}"]` : '[data-w="name"], [data-w="company"]'))?.focus(); return; }
      if (w.step === st.length - 1) {
        // порожні групи клієнтів відкидаємо, а посилання функцій і конкурентів на групи перенумеровуємо
        const keep = c.segments.map((x, i) => x.name.trim() ? i : -1).filter(i => i >= 0), remap = a => a.map(i => keep.indexOf(i)).filter(i => i >= 0);
        const custom = w.idea === 'custom' ? { ...c, segments: keep.map(i => c.segments[i]), features: c.features.filter(f => f.name.trim()).map(f => ({ ...f, segs: remap(f.segs) })), competitors: c.competitors.filter(x => x.name.trim()).map(x => ({ ...x, segs: remap(x.segs) })) } : null;
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
