// Симулятор стартапу · розділи: Огляд, Пошта, Довідник, Звіт.
import { IDEAS, BACKGROUNDS, ACHIEVEMENTS, GLOSSARY, MODELS } from './data.js';
import { money, num, pct, plural, dateText, sum, HOURS, MAX_HOURS, WEEKS, W2M } from './sim.js';
import { CANVAS, METRICS, ADVANTAGES } from './mods.js';
import { icon } from './icons.js';
import { esc, nl2br, term, lineChart, meter, delta, logo } from './ui.js';

const HOUR_ROWS = [
  ['product', 'Продукт', 'code', 'Розробка й дизайн своїми руками'],
  ['customers', 'Клієнти', 'users', 'Інтерв\'ю (3 год кожне) й опитування'],
  ['content', 'Контент', 'heart', 'Соцмережі й статті'],
  ['sales', 'Продажі', 'phone', 'Дзвінки й зустрічі з організаціями'],
  ['invest', 'Інвестори', 'handshake', 'Пітчі й зустрічі (6 год на зустріч)'],
  ['freelance', 'Фриланс', 'laptop', 'Замовлення, які ви взяли на біржі'],
  ['rest', 'Відпочинок', 'sun', 'Відновлює енергію'],
];
export const hoursUsed = S => S.totalHours() + (S.s.mkt.events || 0);

export function kpis(S) {
  const s = S.s, h = s.history, prev = h.at(-2), last = h.at(-1), rw = S.runwayWeeks();
  const card = (label, val, sub = '', cls = '', tip = '') => `<div class="kpi ${cls}"><span class="kpi-l">${tip ? term(tip, label) : esc(label)}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  return `<div class="kpis">
    ${card('Гроші', money(s.cash), last && prev ? delta(last.cash - prev.cash, money) : '', s.cash < 30000 ? 'bad' : '')}
    ${card('Runway', rw === Infinity ? 'прибуток' : rw > 104 ? '2+ роки' : `${Math.max(0, Math.floor(rw))} ${plural(Math.floor(rw), 'тиждень', 'тижні', 'тижнів')}`, rw === Infinity ? 'виручка покриває витрати' : 'на скільки вистачить грошей', rw < 8 ? 'bad' : rw < 16 ? 'warn' : '', 'Runway')}
    ${card('Активні користувачі', num(S.activeUsers()), last && prev ? delta(last.users - prev.users, num) : s.product.launched ? '' : `${num(last?.wait || 0)} у листі очікування`)}
    ${card('Платні клієнти', num(S.paidUsers()), last && prev ? delta(last.paid - prev.paid, num) : '')}
    ${card('MRR', money(S.mrr()), S.I.kind === 'hardware' ? `продажі за тиждень: ${money(last?.rev || 0)}` : 'виручка на місяць', '', 'MRR')}
    ${card('NPS', s.product.launched ? String(S.nps()) : '—', s.product.launched ? (S.nps() >= 30 ? 'радять друзям' : S.nps() >= 0 ? 'так собі' : 'відраджують') : 'після запуску', '', 'NPS')}
  </div>`;
}

function weekPlan(S) {
  const s = S.s, used = hoursUsed(S), over = used > HOURS;
  const rows = HOUR_ROWS.map(([k, t, ic, d]) => {
    const v = s.hours[k] || 0;
    const extra = k === 'customers' ? ` · інтерв'ю: ${S.talksLeft()}` : k === 'freelance' ? ` · замовлень: ${s.myGigs.length}` : '';
    return `<div class="hr-row"><span class="hr-l">${icon(ic, 16)}<span><b>${t}</b><small>${d}${extra}</small></span></span>
      <input type="range" min="0" max="40" step="1" value="${v}" data-in="hours" data-k="${k}" aria-label="${t}, годин"><output data-out="h-${k}">${v} год</output></div>`;
  }).join('');
  const segs = HOUR_ROWS.filter(r => r[0] !== 'rest').map(([k], i) => `<i style="width:${(s.hours[k] || 0) / MAX_HOURS * 100}%;background:var(--h${i})"></i>`).join('') + `<i style="width:${(s.mkt.events || 0) / MAX_HOURS * 100}%;background:var(--h6)"></i>`;
  const e = s.founder.energy;
  return `<section class="card" id="weekplan"><header class="card-h"><h3>${icon('clock')} Ваш тиждень</h3><span class="chip ${over ? (used > 62 ? 'bad' : 'warn') : 'ok'}" data-out="h-total">${used} / ${HOURS} год</span></header>
    <div class="hbar" data-out="h-bar">${segs}<span class="hbar-norm" style="left:${HOURS / MAX_HOURS * 100}%"></span></div>
    <p class="muted sm">Звичайний тиждень — ${HOURS} годин. Більше можна, але енергія падатиме, а з нею — продуктивність.</p>
    ${rows}
    <div class="energy"><span>${icon('bolt', 16)} Енергія засновника</span>${meter(e / 100, { color: e < 30 ? 'var(--bad)' : e < 60 ? 'var(--warn)' : 'var(--ok)', label: 'Енергія' })}<b>${Math.round(e)}%</b></div>
    ${s.team.length ? `<label class="switch"><input type="checkbox" data-in="crunch" ${s.crunch ? 'checked' : ''}><span></span>Кранч для команди: +25% швидкості, але мораль падає</label>` : ''}
  </section>`;
}

function lastWeek(S) {
  const L = S.s.last; if (!L) return `<section class="card"><header class="card-h"><h3>${icon('flag')} Перший тиждень</h3></header><p>Сплануйте години, поговоріть із клієнтами в розділі «Клієнти» й натисніть «Завершити тиждень» угорі.</p></section>`;
  const m = L.money, r = L.rec;
  const out = m.salaries + m.mkt + m.servers + m.tools + m.formFee + m.cogs + m.tax + (m.loyal || 0) + (m.loan || 0) + m.extra;
  return `<section class="card"><header class="card-h"><h3>${icon('chart')} Минулий тиждень</h3><span class="muted sm">тиждень ${L.week + 1}</span></header>
    <div class="mini-stats">
      <div><span>Виручка</span><b class="pos">${money(m.revenue)}</b></div>
      <div><span>Витрати</span><b class="neg">${money(out)}</b></div>
      <div><span>Відвідувачі</span><b>${num(r.visitors)}</b></div>
      <div><span>Реєстрації</span><b>${num(r.signups)}</b></div>
      <div><span>Нові платні</span><b>${num(r.newPaid)}</b></div>
      <div><span>Пішли</span><b>${num(r.churned)}</b></div>
    </div>
    ${L.built?.length ? `<p class="note ok">${icon('check', 16)} Готово: ${L.built.map(f => esc(S.feature(f)?.t)).join(', ')}</p>` : ''}
    ${(L.notes || []).map(n => `<p class="note warn">${icon('info', 16)} ${esc(n)}</p>`).join('')}
    ${(L.events || []).map(e => `<p class="note">${icon('mail', 16)} <b>${esc(e.t)}</b> — ${esc(e.d)}</p>`).join('')}
  </section>`;
}

export function mentorCard(S) {
  const t = S.tips()[0]; if (!t) return '';
  return `<section class="mentor ${t.urgent ? 'urgent' : ''}"><span class="avatar">${icon('bulb', 20)}</span><div><b>Наставниця Ірина</b><p>${esc(t.text)}${t.term ? ` ${term(t.term, 'Що це?')}` : ''}</p>
    <div class="row gap sm">${t.go ? `<button class="btn sm primary" data-act="go" data-to="${t.go}">Перейти</button>` : ''}${t.urgent ? '' : `<button class="btn sm ghost" data-act="dismissTip" data-id="${t.id}">Зрозуміло</button>`}</div></div></section>`;
}

/* ═════════ Огляд ═════════ */
function dash(S) {
  const s = S.s, h = s.history, labels = h.map(x => String(x.week + 1));
  const achs = Object.keys(s.ach);
  return `${mentorCard(S)}${kpis(S)}
  <div class="grid g2">
    <div class="col">${weekPlan(S)}</div>
    <div class="col">
      ${lastWeek(S)}
      <section class="card"><header class="card-h"><h3>${icon('wallet')} Гроші</h3></header>${lineChart([{ v: h.map(x => x.cash), color: 'var(--acc)', label: 'Гроші', area: true }], { labels, fmt: x => money(x).replace(' ₴', '') })}</section>
    </div>
  </div>
  <div class="grid g2">
    <section class="card"><header class="card-h"><h3>${icon('users')} Користувачі</h3></header>${lineChart([{ v: h.map(x => x.users), color: '#0ea5e9', label: 'Активні' }, { v: h.map(x => x.paid), color: '#16a34a', label: 'Платні' }, { v: h.map(x => x.wait), color: '#94a3b8', label: 'Лист очікування', dash: true }], { labels, fmt: num })}</section>
    <section class="card"><header class="card-h"><h3>${icon('coins')} Виручка й витрати за тиждень</h3></header>${lineChart([{ v: h.map(x => x.rev), color: '#16a34a', label: 'Виручка', area: true }, { v: h.map(x => x.cost), color: '#ef4444', label: 'Витрати' }], { labels, fmt: x => money(x).replace(' ₴', '') })}</section>
  </div>
  <section class="card"><header class="card-h"><h3>${icon('award')} Досягнення</h3><span class="muted sm">${achs.length} з ${Object.keys(ACHIEVEMENTS).length}</span></header>
    <div class="achs">${Object.entries(ACHIEVEMENTS).map(([k, a]) => `<div class="ach ${s.ach[k] ? 'on' : ''}" title="${esc(a.d)}">${icon(s.ach[k] ? 'star' : 'lock', 18)}<span><b>${esc(a.t)}</b><small>${s.ach[k] ? `тиждень ${s.ach[k]}` : esc(a.d)}</small></span></div>`).join('')}</div></section>`;
}

/* ═════════ Пошта ═════════ */
function inbox(S, ui) {
  const s = S.s, list = s.inbox, cur = list.find(x => x.id === ui.mail) || list[0];
  if (cur && !cur.read && !cur.choices) cur.read = true;
  const kindIc = { mentor: 'bulb', investor: 'handshake', team: 'users', freelance: 'laptop', finance: 'wallet', invest: 'trend', event: 'mail' };
  return `<div class="mail">
    <aside class="mail-list" aria-label="Листи">${list.length ? list.map(m => `<button class="mail-it ${m === cur ? 'on' : ''} ${m.read ? '' : 'unread'}" data-act="openMail" data-id="${m.id}">${icon(kindIc[m.kind] || 'mail', 18)}<span><b>${esc(m.from)}</b><span>${esc(m.title)}</span><small>тиждень ${m.week + 1}${m.choices && m.chosen == null ? ' · чекає рішення' : ''}</small></span></button>`).join('') : '<p class="empty">Листів поки немає</p>'}</aside>
    <article class="mail-view">${cur ? `<header><small>${esc(cur.from)} · тиждень ${cur.week + 1}</small><h2>${esc(cur.title)}</h2></header><div class="mail-body">${nl2br(cur.body)}</div>
      ${cur.choices ? (cur.chosen == null ? `<div class="choices">${cur.choices.map((c, i) => `<button class="btn ${i === 0 ? 'primary' : ''}" data-act="choose" data-id="${cur.id}" data-i="${i}">${esc(c)}</button>`).join('')}</div><p class="muted sm">Вирішіть до кінця наступного тижня.</p>` : `<div class="note ${cur.chosen < 0 ? 'warn' : 'ok'}">${icon(cur.chosen < 0 ? 'clock' : 'check', 16)} ${cur.chosen >= 0 ? `Ваше рішення: «${esc(cur.choices[cur.chosen])}». ` : ''}${esc(cur.result || '')}</div>`) : ''}
      ${cur.inv ? `<button class="btn primary" data-act="go" data-to="investors">Відкрити «Інвестори»</button>` : ''}` : ''}</article></div>`;
}

/* ═════════ Довідник ═════════ */
function help(S, ui) {
  const q = (ui.q || '').toLowerCase();
  const items = Object.entries(GLOSSARY).filter(([k, v]) => !q || k.toLowerCase().includes(q) || v.toLowerCase().includes(q));
  return `<div class="grid g2">
    <section class="card"><header class="card-h"><h3>${icon('book')} Як грати</h3></header><ol class="steps">
      <li><b>Говоріть із клієнтами.</b> У розділі «Клієнти» проводьте інтерв'ю. Питайте про минуле й факти, а не про свою ідею.</li>
      <li><b>Оберіть сегмент.</b> Той, кому найбільше болить і хто вже витрачає гроші на проблему.</li>
      <li><b>Опишіть бізнес-план.</b> Lean Canvas покаже, які з ваших думок підтверджені даними, а які — лише припущення.</li>
      <li><b>Зробіть MVP і запустіться.</b> Не чекайте ідеалу. Без функції оплати й реєстрації компанії гроші не надходитимуть.</li>
      <li><b>Створіть бренд і знайдіть канали.</b> Тестуйте лендінг, рахуйте, скільки коштує клієнт.</li>
      <li><b>Стежте за грошима.</b> Runway — скільки тижнів ви ще протримаєтеся. Інвестори, гранти, кредит, краудфандинг чи фриланс допоможуть дотягнути.</li>
      <li><b>Наймайте вчасно.</b> Команда пришвидшує, але зарплати з'їдають гроші.</li>
    </ol><p class="muted sm">Гра триває ${WEEKS} тижнів (2 роки). Усі люди й компанії вигадані.</p></section>
    <section class="card"><header class="card-h"><h3>${icon('search')} Словник</h3></header>
      <input class="inp" type="search" placeholder="Знайти термін…" value="${esc(ui.q || '')}" data-in="q" aria-label="Пошук термінів">
      <dl class="gloss">${items.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('') || '<p class="empty">Нічого не знайдено</p>'}</dl></section>
  </div>`;
}

/* ═════════ Звіт ═════════ */
export function report(S) {
  const s = S.s, I = S.I, h = s.history, last = h.at(-1) || {}, labels = h.map(x => String(x.week + 1));
  const C = s.canvas, chk = S.canvasCheck();
  const totalRev = sum(h.map(x => x.rev)), stake = S.stake(), val = S.valuation();
  const block = k => { const v = C[k]; const txt = Array.isArray(v) ? v.map(x => k === 'solution' ? S.feature(x)?.t : k === 'channels' ? ({ ads: 'Реклама', bloggers: 'Блогери', social: 'Соцмережі', seo: 'SEO', events: 'Заходи', sales: 'Продажі', referral: 'Рефераль' }[x]) : METRICS[x]).filter(Boolean).join(', ') : k === 'segment' ? S.seg(v)?.t : k === 'advantage' ? ADVANTAGES[v]?.t : v; return `<div class="cv-b ${k}"><b>${CANVAS[k].t}</b><p>${esc(txt || '—')}</p>${chk[k] ? `<span class="chip ${chk[k].s}">${chk[k].s === 'ok' ? 'підтверджено' : chk[k].s === 'warn' ? 'припущення' : 'суперечить даним'}</span>` : ''}</div>`; };
  const end = s.over ? { bankrupt: 'Компанія закрилася: закінчилися гроші.', sold: `Компанію продано за ${money(s.over.value || 0)}.`, time: 'Минуло два роки.' }[s.over.kind] : `Гра триває: тиждень ${s.week + 1} з ${WEEKS}.`;
  return `<div class="report">
    <header class="rp-h">${logo(s.company, 56)}<div><h1>${esc(s.company.name)}</h1><p>${esc(I.pitch)}</p><small>Засновник: ${esc(s.founder.name)} (${BACKGROUNDS[s.founder.bg].t.toLowerCase()}) · ${esc(I.t)} · ${dateText(0)} — ${dateText(s.week)}</small></div>
      <button class="btn no-print" data-act="print">${icon('printer')} Друкувати / PDF</button></header>
    <p class="rp-end">${esc(end)}</p>
    <div class="kpis">
      <div class="kpi"><span class="kpi-l">Виручка за весь час</span><b>${money(totalRev)}</b></div>
      <div class="kpi"><span class="kpi-l">MRR</span><b>${money(S.mrr())}</b></div>
      <div class="kpi"><span class="kpi-l">Активні / платні</span><b>${num(S.activeUsers())} / ${num(S.paidUsers())}</b></div>
      <div class="kpi"><span class="kpi-l">Оцінка компанії</span><b>${money(val)}</b></div>
      <div class="kpi"><span class="kpi-l">Ваша частка</span><b>${pct(stake, 1)}</b><small>≈ ${money(val * stake)}</small></div>
      <div class="kpi"><span class="kpi-l">Команда</span><b>${s.team.length + 1} ${plural(s.team.length + 1, 'людина', 'людини', 'людей')}</b></div>
    </div>
    <section class="card"><header class="card-h"><h3>Бізнес-план (Lean Canvas)</h3></header><div class="canvas ro">${Object.keys(CANVAS).map(block).join('')}</div></section>
    <div class="grid g2">
      <section class="card"><header class="card-h"><h3>Гроші</h3></header>${lineChart([{ v: h.map(x => x.cash), color: 'var(--acc)', label: 'Гроші', area: true }], { labels, fmt: x => money(x).replace(' ₴', '') })}</section>
      <section class="card"><header class="card-h"><h3>Користувачі</h3></header>${lineChart([{ v: h.map(x => x.users), color: '#0ea5e9', label: 'Активні' }, { v: h.map(x => x.paid), color: '#16a34a', label: 'Платні' }], { labels, fmt: num })}</section>
    </div>
    <section class="card"><header class="card-h"><h3>Ключові рішення</h3></header><ul class="facts">
      <li>Цільовий сегмент: <b>${esc(S.seg().t)}</b>. Модель: ${esc(MODELS[S.modelOf(s.target)].t)}, ціна ${money(s.price[s.target])}${S.I.kind === 'hardware' ? ' за пристрій' : ' на місяць'}.</li>
      <li>Інтерв'ю: ${sum(Object.values(s.know).map(k => k.n))}, з них без підказувальних запитань — ${sum(Object.values(s.know).map(k => k.good))}.</li>
      <li>Функцій у продукті: ${s.product.built.length}. Якість ${Math.round(s.product.quality)}%, багів ${Math.round(s.product.bugs)}.</li>
      <li>Опитувань: ${s.surveys.length}${s.surveys.length ? `, останнє: PMF ${pct(s.surveys.at(-1).pmf)}, NPS ${s.surveys.at(-1).nps}` : ''}.</li>
      <li>Залучено інвестицій: ${Object.entries(s.inv).filter(([, v]) => ['invested', 'accel'].includes(v.status)).length ? Object.entries(s.inv).filter(([, v]) => ['invested', 'accel'].includes(v.status)).map(([k]) => k).length + ' раунд(и)' : 'ні'}${s.loan ? `, кредит ${money(s.loan.amt)}` : ''}${s.crowd?.status === 'won' ? `, краудфандинг ${money(s.crowd.raised)}` : ''}.</li>
      <li>Бренд: впізнаваність ${pct(s.brand.aware)}, відповідність сегменту ${pct(S.brandFit())}.</li>
    </ul></section>
    <section class="card"><header class="card-h"><h3>Досягнення</h3></header><div class="achs">${Object.entries(ACHIEVEMENTS).filter(([k]) => s.ach[k]).map(([k, a]) => `<div class="ach on">${icon('star', 18)}<span><b>${esc(a.t)}</b><small>${esc(a.d)}</small></span></div>`).join('') || '<p class="muted">Поки немає.</p>'}</div></section>
  </div>`;
}

export const coreViews = {
  dash: { t: 'Огляд', icon: 'home', render: dash },
  inbox: { t: 'Пошта', icon: 'mail', render: inbox },
  help: { t: 'Довідник', icon: 'book', render: help },
  report: { t: 'Підсумковий звіт', icon: 'award', render: S => { S.s.flags.reportMade = true; return report(S); } },
};
export const coreActs = {
  go: (C, el) => C.go(el.dataset.to),
  dismissTip: (C, el) => { C.S.s.dismissed[el.dataset.id] = true; C.render(); },
  openMail: (C, el) => { C.ui.mail = el.dataset.id; const m = C.S.s.inbox.find(x => x.id === el.dataset.id); if (m && !m.choices) m.read = true; C.render(); },
  choose: (C, el) => { const m = C.S.s.inbox.find(x => x.id === el.dataset.id); const r = C.S.choose(el.dataset.id, +el.dataset.i); if (m) m.read = true; if (r) C.toast(r, 'good'); C.render(); if (C.S.s.over) C.ending(); },
  print: () => print(),
};
export const coreIns = {
  hours: (C, el) => {
    const S = C.S; S.setHours(el.dataset.k, +el.value);
    C.out(`h-${el.dataset.k}`, `${el.value} год`);
    const used = hoursUsed(S), tot = document.querySelector('[data-out="h-total"]');
    if (tot) { tot.textContent = `${used} / ${HOURS} год`; tot.className = `chip ${used > HOURS ? (used > 62 ? 'bad' : 'warn') : 'ok'}`; }
    const bar = document.querySelector('[data-out="h-bar"]');
    if (bar) bar.querySelectorAll('i').forEach((i, n) => { const k = HOUR_ROWS.filter(r => r[0] !== 'rest')[n]?.[0]; i.style.width = ((k ? S.s.hours[k] : S.s.mkt.events) || 0) / MAX_HOURS * 100 + '%'; });
    C.topbar();
  },
  crunch: (C, el) => { C.S.s.crunch = el.checked; C.save(); },
  q: (C, el) => { C.ui.q = el.value; C.render(); const i = document.querySelector('[data-in="q"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } },
};
