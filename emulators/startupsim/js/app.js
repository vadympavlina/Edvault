// Симулятор стартапу · оболонка: меню, верхня панель, маршрути, старт, підсумки тижня, збереження.
import { IDEAS, BACKGROUNDS, ACHIEVEMENTS } from './data.js';
import { Sim, newGame, okState, money, num, pct, plural, dateText, WEEKS, HOURS } from './sim.js';
import { SYMBOLS, PALETTE } from './mods.js';
import { icon } from './icons.js';
import { esc, $, $$, h, modal, toast, termPop, confirmBox, logo, nl2br } from './ui.js';
import { coreViews, coreActs, coreIns, hoursUsed } from './v-core.js';
import { marketViews, marketActs, marketIns } from './v-market.js';
import { moneyViews, moneyActs, moneyIns } from './v-money.js';
import { peopleViews, peopleActs, peopleIns } from './v-people.js';

const KEY = 'edvault-startup';
const VIEWS = { ...coreViews, ...marketViews, ...moneyViews, ...peopleViews };
const ACTS = { ...coreActs, ...marketActs, ...moneyActs, ...peopleActs };
const INS = { ...coreIns, ...marketIns, ...moneyIns, ...peopleIns };
const NAV = [
  ['Компанія', ['dash', 'inbox', 'plan', 'report']],
  ['Продукт і ринок', ['customers', 'product', 'brand', 'marketing', 'promo']],
  ['Гроші', ['pricing', 'finance', 'payments', 'investors', 'invest']],
  ['Люди', ['team', 'freelance']],
  ['', ['help']],
];

/* ═════════ стан ═════════ */
let S = null;
const ui = { view: 'dash' };
try { const saved = JSON.parse(localStorage.getItem(KEY)); if (saved && okState(saved.s)) { S = new Sim(saved.s); ui.view = saved.view || 'dash'; } } catch { /* почнемо заново */ }
const save = () => { if (!S) return; try { localStorage.setItem(KEY, JSON.stringify({ s: S.s, view: ui.view })); } catch { /* сховище переповнене */ } };

/* ═════════ контекст для розділів ═════════ */
const C = {
  get S() { return S; }, ui,
  go(v) { if (!VIEWS[v]) return; ui.view = v; closeSide(); render(); $('#main').scrollTo?.(0, 0); scrollTo(0, 0); },
  render: () => render(), save, toast,
  out(k, text) { const el = document.querySelector(`[data-out="${k}"]`); if (el) el.textContent = text; },
  topbar: () => topbar(), theme: () => theme(), ending: () => ending(),
};

/* ═════════ малювання ═════════ */
function theme() { if (!S) return; document.documentElement.style.setProperty('--acc', S.s.company.color); document.documentElement.style.setProperty('--acc-soft', S.s.company.color + '1a'); }
function side() {
  const s = S.s, unread = s.inbox.filter(m => !m.read || (m.choices && m.chosen == null)).length;
  const badge = k => k === 'inbox' && unread ? `<span class="badge">${unread}</span>` : k === 'investors' && Object.values(s.inv).some(x => x.status === 'offer') ? '<span class="badge">!</span>' : k === 'product' && S.canLaunch() ? '<span class="badge dot"></span>' : '';
  $('#side').innerHTML = `<div class="sd-brand">${logo(s.company, 34)}<div><b>${esc(s.company.name)}</b><small>${esc(IDEAS[s.idea].t)}</small></div></div>
    <nav aria-label="Розділи">${NAV.map(([g, items]) => `${g ? `<p class="sd-g">${g}</p>` : '<hr>'}${items.map(k => `<button class="sd-it ${ui.view === k ? 'on' : ''}" data-act="go" data-to="${k}" ${ui.view === k ? 'aria-current="page"' : ''}>${icon(VIEWS[k].icon, 18)}<span>${VIEWS[k].t}</span>${badge(k)}</button>`).join('')}`).join('')}</nav>
    <div class="sd-foot"><div class="founder"><span class="av" style="--h:210">${esc(s.founder.name.split(' ').map(x => x[0]).join('').slice(0, 2))}</span><div><b>${esc(s.founder.name)}</b><small>${BACKGROUNDS[s.founder.bg].t} · ${pct(S.stake(), 0)} компанії</small></div></div>
      <button class="btn sm ghost" data-act="newGame">${icon('refresh', 14)} Нова гра</button></div>`;
}
function topbar() {
  if (!S) return;
  const s = S.s, used = hoursUsed(S), rw = S.runwayWeeks();
  $('#top').innerHTML = `<button class="ib only-m" data-act="menu" aria-label="Меню">${icon('menu', 22)}</button>
    <div class="tp-week"><b>Тиждень ${s.week + 1}<small> з ${WEEKS}</small></b><small>${dateText(s.week)}</small></div>
    <div class="tp-stats">
      <span class="tp-s ${s.cash < 30000 ? 'bad' : ''}" title="Гроші">${icon('wallet', 16)}<b>${money(s.cash)}</b></span>
      <span class="tp-s ${rw < 8 ? 'bad' : rw < 16 ? 'warn' : ''} hide-s" title="На скільки тижнів вистачить грошей">${icon('clock', 16)}<b>${rw === Infinity ? '∞' : rw > 104 ? '2+ р.' : Math.max(0, Math.floor(rw)) + ' тиж.'}</b></span>
      <span class="tp-s hide-s" title="Активні користувачі">${icon('users', 16)}<b>${num(S.activeUsers())}</b></span>
      <span class="tp-s hide-m" title="Щомісячна виручка">${icon('coins', 16)}<b>${money(S.mrr())}</b></span>
      <span class="tp-s ${used > HOURS ? (used > 62 ? 'bad' : 'warn') : ''} hide-s" title="Години засновника цього тижня">${icon('bolt', 16)}<b>${used}/${HOURS} год</b></span>
    </div>
    <button class="btn primary end-week" data-act="endWeek" ${s.over ? 'disabled' : ''}>${icon('next', 16)}<span>Завершити тиждень</span></button>`;
}
function render() {
  if (!S) return;
  theme(); side(); topbar();
  const V = VIEWS[ui.view] || VIEWS.dash;
  const main = $('#main');
  main.innerHTML = `<header class="pg-h"><h1>${icon(V.icon, 24)} ${V.t}</h1>${S.s.over ? `<span class="chip bad">Гру завершено</span>` : ''}</header>${V.render(S, ui)}`;
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
    <div class="mini-stats"><div><span>Виручка</span><b class="pos">${money(m.revenue)}</b></div><div><span>Витрати</span><b class="neg">${money(out)}</b></div>${m.invest ? `<div><span>Надходження</span><b class="pos">${money(m.invest)}</b></div>` : ''}<div><span>Відвідувачі</span><b>${num(r.visitors)}</b></div><div><span>${s.product.launched ? 'Реєстрації' : 'У лист очікування'}</span><b>${num(r.signups)}</b></div><div><span>Нові платні</span><b>${num(r.newPaid)}</b></div><div><span>Пішли</span><b>${num(r.churned)}</b></div></div>
    ${rep.built?.length ? `<p class="note ok">${icon('check', 16)} Розробка завершила: ${rep.built.map(f => esc(S.feature(f).t)).join(', ')}</p>` : ''}
    ${rep.notes.map(n => `<p class="note warn">${icon('info', 16)} ${esc(n)}</p>`).join('')}
    ${rep.events.map(e => `<p class="note">${icon('mail', 16)} <b>${esc(e.t)}</b> — ${esc(e.d)}</p>`).join('')}
    ${rep.broke ? `<p class="note bad">${icon('alert', 16)} Гроші закінчилися! Є 2 тижні, щоб урятувати компанію — подивіться пошту.</p>` : ''}
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
  modal({ title: T[0], cls: `ending ${o.kind}`, html: `<p>${esc(T[1])}</p><div class="row end gap"><button class="btn" data-act-end="new">Нова гра</button><button class="btn primary" data-act-end="report">Підсумковий звіт</button></div>`,
    onOpen: api => api.el.addEventListener('click', e => { const b = e.target.closest('[data-act-end]'); if (!b) return; api.close(); if (b.dataset.actEnd === 'report') C.go('report'); else startWizard(); }) });
}

/* ═════════ майстер старту ═════════ */
function startWizard() {
  const w = { step: 0, idea: 'homework', name: '', bg: 'dev', company: '', color: IDEAS.homework.color, sym: 'spark', fff: false };
  const el = h('<div class="wizard" role="dialog" aria-modal="true" aria-label="Новий стартап"></div>');
  document.body.appendChild(el); document.body.classList.add('wz-on');
  const steps = ['Вітаємо', 'Ідея', 'Засновник', 'Компанія', 'Гроші'];
  const draw = () => {
    const I = IDEAS[w.idea];
    const body = [
      () => `<div class="wz-hero">${icon('rocket', 46)}<h1>Симулятор стартапу</h1><p>Ви засновуєте компанію з нуля. Говорите з клієнтами, будуєте продукт, створюєте бренд, шукаєте канали, рахуєте гроші, наймаєте команду й залучаєте інвестиції. Кожне рішення має наслідки.</p><ul class="wz-list"><li>${icon('users', 18)} Інтерв'ю з клієнтами й опитування</li><li>${icon('plan', 18)} Бізнес-план (Lean Canvas) і фінплан</li><li>${icon('palette', 18)} Бренд, маркетинг, акції</li><li>${icon('handshake', 18)} Гранти, інвестори, кредит, краудфандинг</li><li>${icon('laptop', 18)} Команда, спринти, фриланс</li><li>${icon('card', 18)} Платіжні системи, інвестування й криптовалюта</li></ul><p class="muted sm">Один хід — тиждень. Гра триває 2 роки, якщо раніше не закінчаться гроші. Усі люди й компанії вигадані.</p></div>`,
      () => `<h2>Оберіть ідею</h2><div class="wz-ideas">${Object.entries(IDEAS).map(([k, x]) => `<button class="wz-idea ${w.idea === k ? 'on' : ''}" data-w="idea" data-v="${k}" style="--ic:${x.color}"><span class="wz-ic">${icon(x.icon, 26)}</span><b>${esc(x.t)}</b><p>${esc(x.pitch)}</p><small>${{ app: 'Застосунок', hardware: 'Пристрій («залізо»)', saas: 'Сервіс для бізнесу' }[x.kind]} · сегменти: ${Object.values(x.segments).map(g => g.short.toLowerCase()).join(', ')}</small></button>`).join('')}</div>`,
      () => `<h2>Хто ви?</h2><label class="wz-f"><span>Ваше ім'я</span><input class="inp" data-w="name" value="${esc(w.name)}" placeholder="Наприклад, Олена" maxlength="30" autofocus></label><p class="sm muted">Ваш досвід визначає, що вам вдається найкраще.</p><div class="wz-bgs">${Object.entries(BACKGROUNDS).map(([k, b]) => `<button class="wz-bg ${w.bg === k ? 'on' : ''}" data-w="bg" data-v="${k}">${icon(b.icon, 24)}<b>${b.t}</b><small>${b.desc}</small></button>`).join('')}</div>`,
      () => `<h2>Ваша компанія</h2><div class="wz-co">${logo({ color: w.color, sym: w.sym }, 72)}<b style="color:${w.color}">${esc(w.company || 'Назва')}</b></div><label class="wz-f"><span>Назва</span><input class="inp" data-w="company" value="${esc(w.company)}" placeholder="Наприклад, ${{ homework: 'Зрозумій', plant: 'Полий-ка', english: 'Speakly', booking: 'Записатись' }[w.idea]}" maxlength="24" autofocus></label>
        <p class="sm muted">Колір і символ (потім можна змінити в розділі «Бренд»)</p><div class="swatches">${PALETTE.map(c => `<button class="sw ${w.color === c ? 'on' : ''}" style="background:${c}" data-w="color" data-v="${c}" aria-label="Колір"></button>`).join('')}</div><div class="syms">${SYMBOLS.map(sy => `<button class="sym ${w.sym === sy ? 'on' : ''}" data-w="sym" data-v="${sy}" aria-label="Символ">${icon(sy, 20)}</button>`).join('')}</div>`,
      () => `<h2>Стартові гроші</h2><div class="wz-money"><div class="opt on"><b>Власні заощадження</b><p class="big">${money(150000)}</p><small>Це все, що у вас є.</small></div>
        <button class="opt ${w.fff ? 'on' : ''}" data-w="fff">${icon(w.fff ? 'check' : 'plus', 18)}<b>Гроші від родини й друзів</b><p class="big">+${money(300000)}</p><small>В обмін на 10% компанії. Більше часу на пошук, але ви вже не єдиний власник.</small></button></div>
        <p class="sm muted">Разом: <b>${money(150000 + (w.fff ? 300000 : 0))}</b>. Ваша частка: <b>${w.fff ? '90%' : '100%'}</b>.</p>`,
    ][w.step]();
    el.innerHTML = `<div class="wz-card"><div class="wz-steps">${steps.map((t, i) => `<span class="${i === w.step ? 'on' : i < w.step ? 'done' : ''}">${i < w.step ? icon('check', 14) : i + 1}<small>${t}</small></span>`).join('')}</div>
      <div class="wz-body">${body}</div>
      <div class="wz-nav">${w.step ? `<button class="btn" data-w="back">${icon('left', 16)} Назад</button>` : '<span></span>'}<button class="btn primary lg" data-w="next">${w.step === steps.length - 1 ? `${icon('rocket', 18)} Заснувати компанію` : `Далі ${icon('right', 16)}`}</button></div></div>`;
    el.querySelector('[autofocus]')?.focus();
  };
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-w]'); if (!b) return;
    const k = b.dataset.w;
    if (k === 'idea') { w.idea = b.dataset.v; w.color = IDEAS[w.idea].color; }
    else if (k === 'bg') w.bg = b.dataset.v;
    else if (k === 'color') w.color = b.dataset.v;
    else if (k === 'sym') w.sym = b.dataset.v;
    else if (k === 'fff') w.fff = !w.fff;
    else if (k === 'back') w.step--;
    else if (k === 'next') {
      if (w.step === 2 && !w.name.trim()) { toast('Введіть своє ім\'я', 'bad'); el.querySelector('[data-w="name"]')?.focus(); return; }
      if (w.step === 3 && !w.company.trim()) { toast('Придумайте назву компанії', 'bad'); el.querySelector('[data-w="company"]')?.focus(); return; }
      if (w.step === steps.length - 1) {
        S = newGame({ idea: w.idea, founder: w.name.trim(), bg: w.bg, company: w.company.trim(), color: w.color, sym: w.sym, fff: w.fff });
        el.remove(); document.body.classList.remove('wz-on'); ui.view = 'dash'; render(); window.Startup.S = S;
        return;
      }
      w.step++;
    } else return;
    draw();
  });
  el.addEventListener('input', e => { const k = e.target.dataset.w; if (k === 'name' || k === 'company') { w[k] = e.target.value; if (k === 'company') { const t = el.querySelector('.wz-co b'); if (t) t.textContent = w.company || 'Назва'; } } });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) el.querySelector('[data-w="next"]')?.click(); });
  draw();
}

/* ═════════ події ═════════ */
const sideEl = () => $('#side');
function closeSide() { document.body.classList.remove('side-open'); }
document.addEventListener('click', e => {
  const t = e.target.closest('.term'); if (t) { e.preventDefault(); termPop(t); return; }
  const a = e.target.closest('[data-act]'); if (!a || a.disabled || !S) return;
  const k = a.dataset.act;
  if (k === 'endWeek') return endWeek();
  if (k === 'menu') { document.body.classList.toggle('side-open'); return; }
  if (k === 'newGame') return confirmBox('Почати нову гру?', 'Почати заново', { danger: true, sub: 'Поточна компанія буде втрачена.' }).then(ok => { if (ok) startWizard(); });
  const fn = ACTS[k]; if (fn) { fn(C, a, e); save(); }
});
document.addEventListener('input', e => { const el = e.target.closest('[data-in]'); if (!el || !S) return; const fn = INS[el.dataset.in]; if (fn && (el.type === 'range' || el.tagName === 'TEXTAREA' || el.type === 'text' || el.type === 'search' || !el.type || el.type === 'number')) fn(C, el, e); });
document.addEventListener('change', e => { const el = e.target.closest('[data-in]'); if (!el || !S) return; const fn = INS[el.dataset.in]; if (!fn) return; if (el.type === 'range') { save(); render(); return; } if (el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'SELECT') fn(C, el, e); else if (el.tagName === 'TEXTAREA' || el.type === 'text') { save(); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSide(); });
$('#scrim')?.addEventListener('click', closeSide);

window.Startup = { S, C, get sim() { return S; } };
if (S) render(); else startWizard();
$('#boot')?.remove();
