// Симулятор стартапу · розділи: Огляд, Пошта, Довідник, Звіт.
import { BACKGROUNDS, ACHIEVEMENTS, GLOSSARY } from './data.js';
import { money, num, pct, plural, dateText, sum, HOURS, WEEKS } from './sim.js';
import { CANVAS, METRICS, ADVANTAGES } from './mods.js';
import { assumptionsVsReality, marketVsGuess, KINDS, SCOPES } from './custom.js';
import { icon } from './icons.js';
import { esc, nl2br, term, lineChart, delta, logo } from './ui.js';
import { STAGES, stageInfo } from './stages.js';

const HOUR_ROWS = [
  ['product', 'Продукт', 'code', 'Робите продукт своїми руками'],
  ['customers', 'Клієнти', 'users', 'Розмови з клієнтами: 3 години кожна'],
  ['content', 'Соцмережі', 'heart', 'Дописи, відео й статті'],
  ['sales', 'Продажі', 'phone', 'Дзвінки й зустрічі з організаціями'],
  ['invest', 'Інвестори', 'handshake', 'Зустрічі з інвесторами: 6 годин кожна'],
  ['freelance', 'Підробіток', 'laptop', 'Замовлення на біржі фрилансу'],
  ['rest', 'Відпочинок', 'sun', 'Повертає сили'],
];
const STEP = 5, DOTS = 8; // одна крапка — 5 годин, у рядку до 40 годин
export const hoursUsed = S => S.totalHours() + (S.s.mkt.events || 0);

// «Як справи»: головні цифри простими словами
function status(S) {
  const s = S.s, h = s.history, prev = h.at(-2), last = h.at(-1), rw = S.runwayWeeks(), e = Math.round(s.founder.energy);
  const row = (label, val, sub = '', cls = '', tip = '') => `<div class="st-row ${cls}"><span>${tip ? term(tip, label) : esc(label)}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  return `<section class="pin status"><h3>Як справи</h3>
    ${row('Гроші', money(s.cash), last && prev ? delta(last.cash - prev.cash, money) : '', s.cash < 30000 ? 'bad' : '')}
    ${row('Вистачить на', rw === Infinity ? 'заробляємо більше, ніж витрачаємо' : rw > 104 ? '2+ роки' : `${Math.max(0, Math.floor(rw))} ${plural(Math.max(0, Math.floor(rw)), 'тиждень', 'тижні', 'тижнів')}`, '', rw < 8 ? 'bad' : rw < 16 ? 'warn' : 'ok', 'Runway')}
    ${row(s.product.launched ? 'Користуються продуктом' : 'Чекають на запуск', num(s.product.launched ? S.activeUsers() : Math.round(last?.wait || 0)))}
    ${row('Платять', num(S.paidUsers()))}
    ${row('Заробляємо за місяць', money(S.mrr()), '', '', 'MRR')}
    ${s.product.launched ? row('Радять друзям', S.nps() >= 30 ? 'так' : S.nps() >= 0 ? 'так собі' : 'ні', `оцінка ${S.nps()}`, S.nps() >= 30 ? 'ok' : S.nps() < 0 ? 'bad' : '', 'NPS') : ''}
    ${row('Ваші сили', e + '%', '', e < 30 ? 'bad' : e < 60 ? 'warn' : 'ok')}
  </section>`;
}

function weekPlan(S) {
  const s = S.s, used = hoursUsed(S), over = used > HOURS;
  const cols = HOUR_ROWS.map(([k, t, ic, d]) => {
    const v = s.hours[k] || 0;
    const busy = s.busy?.week === s.week ? s.busy[k] : 0;
    const extra = k === 'customers' ? `ще розмов: ${S.talksLeft()}` : busy ? `${busy} год зайнято` : '';
    return `<div class="hcol" data-k="${k}" title="${esc(d)}"><button class="tube" data-act="hrsAt" data-k="${k}" tabindex="-1" aria-label="${t}: ${v} годин. Натисніть на висоту, щоб змінити"><i style="height:${Math.min(100, v / (DOTS * STEP) * 100)}%"></i></button>
      <b class="ht">${icon(ic, 15)}${t}</b><output>${v} год</output><small>${extra}</small>
      <span class="hr-pm"><button class="ib" data-act="hrs" data-k="${k}" data-d="-1" aria-label="${t}: менше" ${v <= 0 ? 'disabled' : ''}>${icon('minus', 16)}</button><button class="ib" data-act="hrs" data-k="${k}" data-d="1" aria-label="${t}: більше" ${v >= DOTS * STEP ? 'disabled' : ''}>${icon('plus', 16)}</button></span></div>`;
  }).join('');
  return `<section class="card sheet" id="weekplan"><header class="card-h"><h3>Ваш тиждень <span class="hand-s">${used} з ${HOURS} годин</span></h3><span class="row gap"><button class="btn sm" data-act="autoHours">${icon('bolt', 14)} Підібрати за мене</button><span class="chip ${over ? (used > 62 ? 'bad' : 'warn') : 'ok'}" data-out="h-total">${used} / ${HOURS} год</span></span></header>
    <p class="muted sm">На що ви витратите час цього тижня. Кнопки змінюють по ${STEP} годин, а натискання на стовпчик ставить висоту одразу. Звичайний тиждень — ${HOURS} годин: більше можна, але сили падатимуть.</p>
    <div class="hcols">${cols}</div>
    ${s.team.length ? `<label class="switch"><input type="checkbox" data-in="crunch" ${s.crunch ? 'checked' : ''}><span></span>Команда працює понаднормово: на чверть швидше, але настрій падає</label>` : ''}
  </section>`;
}

function lastWeek(S) {
  const L = S.s.last; if (!L) return '';
  const m = L.money, r = L.rec;
  const out = m.salaries + m.mkt + m.servers + m.tools + m.formFee + m.cogs + m.tax + (m.loyal || 0) + (m.loan || 0) + m.extra;
  return `<section class="card"><header class="card-h"><h3>${icon('chart')} Минулий тиждень</h3><span class="muted sm">тиждень ${L.week + 1}</span></header>
    <div class="mini-stats">
      <div><span>Виручка</span><b class="pos">${money(m.revenue)}</b></div>
      <div><span>Витрати</span><b class="neg">${money(out)}</b></div>
      <div><span>Відвідувачі</span><b>${num(r.visitors)}</b></div>
      <div><span>${S.s.product.launched ? 'Нові користувачі' : 'Записалися в чергу'}</span><b>${num(r.signups)}</b></div>
      <div><span>Нові платні</span><b>${num(r.newPaid)}</b></div>
      <div><span>Пішли</span><b>${num(r.churned)}</b></div>
    </div>
    ${L.built?.length ? `<p class="note ok">${icon('check', 16)} Готово: ${L.built.map(f => esc(S.feature(f)?.t)).join(', ')}</p>` : ''}
    ${(L.notes || []).map(n => `<p class="note warn">${icon('info', 16)} ${esc(n)}</p>`).join('')}
    ${(L.events || []).map(e => `<p class="note">${icon('mail', 16)} <b>${esc(e.t)}</b> — ${esc(e.d)}</p>`).join('')}
  </section>`;
}

/* ═════════ Наставниця: що робити далі ═════════ */
export function mentorCard(S) {
  const [t, ...more] = S.tips();
  return `<section class="pin mentor ${t?.urgent ? 'urgent' : ''}"><div class="mt-h"><span class="face">ІР</span><div><b>Наставниця Ірина</b><small>${t?.urgent ? 'важливо зараз' : 'порада на цей тиждень'}</small></div></div>
    <p class="hand">${t ? esc(t.text) : 'Усе йде добре. Плануйте тиждень і натискайте «Завершити тиждень».'}</p>
    ${t ? `<div class="row gap sm wrap">${t.go ? `<button class="btn sm" data-act="go" data-to="${t.go}">Перейти</button>` : ''}${t.term ? term(t.term, 'Що це?') : ''}${t.urgent ? '' : `<button class="btn sm ghost" data-act="dismissTip" data-id="${t.id}">Зрозуміло</button>`}</div>` : ''}
    ${more.length ? `<p class="mt-l">Ще поради</p><ul class="mt-more">${more.slice(0, 2).map(x => `<li>${x.go ? `<button class="link" data-act="go" data-to="${x.go}">${esc(x.text)}</button>` : esc(x.text)}</li>`).join('')}</ul>` : ''}</section>`;
}

/* ═════════ Етап: що зробити зараз ═════════ */
function stageCard(S, ui, info) {
  const i = ui.stage != null && ui.stage <= info.reached ? ui.stage : info.cur, st = info.list[i];
  const nextOpen = STAGES[i + 1], first = st.tasks.find(y => !y.ok);
  const head = info.allDone && i === info.cur
    ? `<h1>Компанія стала на ноги</h1><p class="lead">Ви пройшли весь шлях від ідеї до інвестицій чи прибутку. Тепер розвивайте компанію далі: усі розділи відкриті.</p>`
    : `<p class="stage-n">Етап ${i + 1} з ${STAGES.length}${i < info.cur ? ' · пройдено' : ''}</p><h1>${esc(st.long)}</h1><p class="lead">${esc(st.why)}</p>`;
  const btn = x => x.go === 'file' ? `<button class="btn sm ${x === first ? 'primary' : ''}" data-act="saveFile">${esc(x.btn)}</button>` : `<button class="btn sm ${x === first ? 'primary' : ''}" data-act="go" data-to="${x.go}" ${x.hl ? `data-hl="${esc(x.hl)}"` : ''}>${esc(x.btn)}</button>`;
  return `<section class="stage-card">${head}
    <ol class="notes">${st.tasks.map(x => `<li class="note ${x.ok ? 'ok' : x === first ? 'now' : ''}"><span class="st">${x.ok ? `${icon('check', 15)} Виконано` : x === first ? 'Зараз' : 'Далі'}</span><b>${esc(x.t)}</b><small>${esc(x.d)}</small>${x.ok ? '<span class="stamp">готово</span>' : btn(x)}</li>`).join('')}</ol>
    ${i === info.cur && !info.allDone && nextOpen ? `<p class="sm muted next-open">${icon('lock', 14)} Виконайте всі завдання — відкриється етап ${i + 2} «${esc(nextOpen.t)}».</p>` : ''}
    ${i !== info.cur ? `<button class="btn sm" data-act="stage" data-i="${info.cur}">До поточного етапу</button>` : ''}</section>`;
}

/* ═════════ Головна ═════════ */
function dash(S, ui, info = stageInfo(S)) {
  const s = S.s, h = s.history, labels = h.map(x => String(x.week + 1));
  const achs = Object.keys(s.ach);
  return `${s.over ? `<p class="note bad">${icon('alert', 16)} Гру завершено. <button class="link" data-act="go" data-to="report">Подивитися підсумки</button></p>` : ''}
  <div class="home">
    <div class="col">${stageCard(S, ui, info)}${weekPlan(S)}${lastWeek(S)}
      ${h.length > 1 ? `<details class="card fold"><summary>${icon('chart')} Графіки за всі тижні</summary>
        <div class="grid g2">
          <div><h4>Гроші</h4>${lineChart([{ v: h.map(x => x.cash), color: 'var(--acc)', label: 'Гроші', area: true }], { labels, fmt: x => money(x).replace(' ₴', '') })}</div>
          <div><h4>Клієнти</h4>${lineChart([{ v: h.map(x => x.users), color: '#0ea5e9', label: 'Користуються' }, { v: h.map(x => x.paid), color: '#16a34a', label: 'Платять' }, { v: h.map(x => x.wait), color: '#94a3b8', label: 'Чекають запуску', dash: true }], { labels, fmt: num })}</div>
          <div><h4>Виручка й витрати за тиждень</h4>${lineChart([{ v: h.map(x => x.rev), color: '#16a34a', label: 'Виручка', area: true }, { v: h.map(x => x.cost), color: '#ef4444', label: 'Витрати' }], { labels, fmt: x => money(x).replace(' ₴', '') })}</div>
        </div></details>` : ''}
      <details class="card fold"><summary>${icon('award')} Досягнення <span class="muted sm">${achs.length} з ${Object.keys(ACHIEVEMENTS).length}</span></summary>
        <div class="achs">${Object.entries(ACHIEVEMENTS).map(([k, a]) => `<div class="ach ${s.ach[k] ? 'on' : ''}" title="${esc(a.d)}">${icon(s.ach[k] ? 'star' : 'lock', 18)}<span><b>${esc(a.t)}</b><small>${s.ach[k] ? `тиждень ${s.ach[k]}` : esc(a.d)}</small></span></div>`).join('')}</div></details>
    </div>
    <aside class="col side-col">${mentorCard(S)}${status(S)}</aside>
  </div>`;
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
      <li><b>Опишіть бізнес-план.</b> Він покаже, які з ваших думок підтверджені даними, а які — лише припущення.</li>
      <li><b>Зробіть першу версію й запустіться.</b> Не чекайте ідеалу. Без функції оплати й реєстрації компанії гроші не надходитимуть.</li>
      <li><b>Створіть бренд і знайдіть канали.</b> Тестуйте лендінг, рахуйте, скільки коштує клієнт.</li>
      <li><b>Стежте за грошима.</b> Угорі видно, на скільки тижнів їх ще вистачить. Інвестори, гранти, кредит, краудфандинг чи фриланс допоможуть дотягнути.</li>
      <li><b>Наймайте вчасно.</b> Команда пришвидшує, але зарплати з'їдають гроші.</li>
    </ol><p class="muted sm">Гра триває ${WEEKS} тижнів (2 роки). Усі люди й компанії вигадані.</p></section>
    <section class="card"><header class="card-h"><h3>${icon('save')} Збереження й файли</h3></header><ul class="facts">
      <li><b>Шлях стартапу.</b> Згори — п’ять етапів. На кожному є 3 завдання; коли їх виконано, відкривається наступний етап і нові розділи. Розділ наступного етапу можна відкрити й раніше — натисніть на нього.</li>
      <li>Гра автоматично зберігається в цьому браузері. Але на спільному комп'ютері чи в іншому браузері її не буде — тому <b>зберігайте у файл</b>.</li>
      <li><b>Зберегти у файл</b> — кнопка «Зберегти» вгорі сторінки або в меню (Ctrl+S). У файлі є все: кожен тиждень, усі рішення, журнал дій, бізнес-план, бренд, пошта, команда, фінанси.</li>
      <li><b>Відкрити файл</b> — кнопка в меню (або Ctrl+O). Можна також просто перетягнути файл на сторінку. Гра продовжиться з того самого місця.</li>
    </ul><div class="row gap wrap"><button class="btn primary" data-act="saveFile">${icon('save', 16)} Зберегти у файл</button><button class="btn" data-act="openFile">${icon('open', 16)} Відкрити файл</button></div></section>
    <section class="card"><header class="card-h"><h3>${icon('user')} Для викладача</h3></header><ol class="steps">
      <li><b>Учні здають файл.</b> Наприкінці заняття чи гри учень натискає «Зберегти у файл» і надсилає файл .json.</li>
      <li><b>Відкрийте файл учня.</b> «Відкрити файл» або перетягніть файл на сторінку → «Відкрити звіт». Ваша власна гра в цьому браузері буде замінена, тож за потреби спершу збережіть її.</li>
      <li><b>Підсумковий звіт</b> показує результати, бізнес-план із перевіркою даними, ключові рішення, журнал дій по тижнях і таблицю всіх тижнів. Його можна надрукувати або зберегти в PDF.</li>
      <li><b>Чесність.</b> Якщо файл змінювали вручну після збереження, симулятор попередить про це і в звіті, і під час відкриття.</li>
    </ol></section>
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
  const block = k => { const v = C[k]; const txt = Array.isArray(v) ? v.map(x => k === 'solution' ? S.feature(x)?.t : k === 'channels' ? ({ ads: 'Реклама', bloggers: 'Блогери', social: 'Соцмережі', seo: 'SEO', events: 'Заходи', sales: 'Продажі', referral: 'Реферальна програма' }[x]) : METRICS[x]).filter(Boolean).join(', ') : k === 'segment' ? (v && S.I.segments[v] ? S.seg(v).t : '') : k === 'advantage' ? ADVANTAGES[v]?.t : v; return `<div class="cv-b ${k}"><b>${CANVAS[k].t}</b><p>${esc(txt || '—')}</p>${chk[k] ? `<span class="chip ${chk[k].s}">${chk[k].s === 'ok' ? 'підтверджено' : chk[k].s === 'warn' ? 'припущення' : 'суперечить даним'}</span>` : ''}</div>`; };
  const end = s.over ? { bankrupt: 'Компанія закрилася: закінчилися гроші.', sold: `Компанію продано за ${money(s.over.value || 0)}.`, time: 'Минуло два роки.' }[s.over.kind] : `Гра триває: тиждень ${s.week + 1} з ${WEEKS}.`;
  return `<div class="report">
    <header class="rp-h">${logo(s.company, 56)}<div><h1>${esc(s.company.name)}</h1><p>${esc(I.pitch)}</p><div class="rp-who"><span>Учень: <b>${esc(s.founder.name)}</b></span>${s.founder.group ? `<span>Клас або група: <b>${esc(s.founder.group)}</b></span>` : ''}<span>Досвід: ${BACKGROUNDS[s.founder.bg].t.toLowerCase()}</span><span>Ідея: ${esc(I.t)}${I.custom ? ' (власна)' : ''}</span><span>${dateText(0)} — ${dateText(s.week)}</span></div></div>
      <div class="row gap wrap no-print"><button class="btn" data-act="saveFile">${icon('save')} Зберегти у файл</button><button class="btn" data-act="print">${icon('printer')} Друкувати / PDF</button></div></header>
    ${s.flags.editedFile ? `<p class="note bad">${icon('alert', 16)} <span>Цей файл змінювали вручну після збереження: результати можуть не відповідати справжній грі.</span></p>` : ''}
    <p class="rp-end">${esc(end)}</p>
    <div class="kpis">
      <div class="kpi"><span class="kpi-l">Виручка за весь час</span><b>${money(totalRev)}</b></div>
      <div class="kpi"><span class="kpi-l">${term('MRR', 'Виручка за місяць')}</span><b>${money(S.mrr())}</b></div>
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
    ${I.custom ? (() => { const mg = marketVsGuess(I), per = I.kind === 'hardware' ? 'за штуку' : 'на місяць';
      const miss = (g, r) => g ? (r / g >= .8 && r / g <= 1.25 ? 'ok' : 'warn') : '';
      return `<section class="card"><header class="card-h"><h3>Паспорт ідеї</h3><span class="chip">${esc(KINDS[I.sub]?.t || '')} · ${esc(SCOPES[I.scope]?.t.toLowerCase() || '')}</span></header>
      <dl class="passport"><dt>Проблема</dt><dd>${esc(I.problem)}</dd><dt>Ідея</dt><dd>${esc(I.pitch)}</dd>
        <dt>Клієнти</dt><dd>${Object.values(I.segments).map(g => esc(g.t)).join(', ')}</dd>
        <dt>Конкуренти</dt><dd>${I.competitors.length ? I.competitors.map(c => `${esc(c.t)}${c.price ? ` (${money(c.price)} ${per})` : ''}${c.weak ? ` — ${esc(c.weak)}` : ''}`).join('; ') : 'не названо'}</dd></dl>
      ${mg.length ? `<p class="sm muted">Ваші оцінки ринку на старті й те, як було насправді.</p><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Група</th><th>Клієнтів: ваша оцінка</th><th>Насправді</th><th>Ціна: ваша оцінка</th><th>Насправді готові платити</th></tr></thead><tbody>${mg.map(x => `<tr><td>${esc(x.seg)}</td><td>${x.size[0] ? num(x.size[0]) : '—'}</td><td class="${miss(x.size[0], x.size[1])}">${num(x.size[1])}</td><td>${x.price[0] ? money(x.price[0]) : '—'}</td><td class="${miss(x.price[0], x.price[1])}">${money(x.price[1])}</td></tr>`).join('')}</tbody></table></div>` : ''}</section>`; })() : ''}
    ${I.custom ? (() => { const av = assumptionsVsReality(I), segs = Object.values(I.segments).map(g => g.short); let hit = 0, all = 0; av.forEach(f => f.rows.forEach(x => { all++; if (x.guess === x.real) hit++; }));
      return `<section class="card"><header class="card-h"><h3>Ваші припущення ↔ реальність</h3><span class="chip ${hit / Math.max(1, all) >= .7 ? 'ok' : 'warn'}">вгадано ${hit} з ${all}</span></header><p class="sm muted">Кому, на вашу думку, потрібна кожна функція, і як було насправді. Справжню картину можна було дізнатися з інтерв'ю й опитувань.</p>
      <div style="overflow-x:auto"><table class="tbl guess"><thead><tr><th>Функція</th>${segs.map(t => `<th>${esc(t)}</th>`).join('')}</tr></thead><tbody>${av.map(f => `<tr><td>${esc(f.t)}</td>${f.rows.map(x => `<td class="${x.guess !== x.real ? 'miss' : ''}"><span class="${x.guess ? 'y' : 'n'}">ви: ${x.guess ? 'так' : 'ні'}</span> · <span class="${x.real ? 'y' : 'n'}">ринок: ${x.real ? 'так' : 'ні'}</span></td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="sm muted">Наскільки болить проблема насправді: ${Object.values(I.segments).map(g => `${esc(g.short)} — ${Math.round(g.pain * 10)}/10`).join(', ')}.</p></section>`; })() : ''}
    <section class="card"><header class="card-h"><h3>Ключові рішення</h3></header><ul class="facts">
      <li>Цільовий сегмент: <b>${esc(S.seg().t)}</b>. Модель: ${esc(S.model(S.modelOf(s.target)).t)}, ціна ${money(s.price[s.target])}${S.I.kind === 'hardware' ? ` за ${S.I.uw ? 'штуку' : 'пристрій'}` : ' на місяць'}.</li>
      <li>Інтерв'ю: ${sum(Object.values(s.know).map(k => k.n))}, з них без підказувальних запитань — ${sum(Object.values(s.know).map(k => k.good))}.</li>
      <li>Функцій у продукті: ${s.product.built.length}. Якість ${Math.round(s.product.quality)}%, багів ${Math.round(s.product.bugs)}.</li>
      <li>Опитувань: ${s.surveys.length}${s.surveys.length ? `, останнє: PMF ${pct(s.surveys.at(-1).pmf)}, NPS ${s.surveys.at(-1).nps}` : ''}.</li>
      <li>Залучено інвестицій: ${(n => n ? `${n} ${plural(n, 'раунд', 'раунди', 'раундів')}` : 'ні')(Object.values(s.inv).filter(v => ['invested', 'accel'].includes(v.status)).length)}${s.loan ? `, кредит ${money(s.loan.amt)}` : ''}${s.crowd?.status === 'won' ? `, краудфандинг ${money(s.crowd.raised)}` : ''}.</li>
      <li>Бренд: впізнаваність ${pct(s.brand.aware)}, відповідність сегменту ${pct(S.brandFit())}.</li>
    </ul></section>
    <section class="card"><header class="card-h"><h3>Досягнення</h3></header><div class="achs">${Object.entries(ACHIEVEMENTS).filter(([k]) => s.ach[k]).map(([k, a]) => `<div class="ach on">${icon('star', 18)}<span><b>${esc(a.t)}</b><small>${esc(a.d)}</small></span></div>`).join('') || '<p class="muted">Поки немає.</p>'}</div></section>
    <section class="card"><header class="card-h"><h3>Журнал рішень</h3><span class="muted sm">${(s.journal || []).length} ${plural((s.journal || []).length, 'запис', 'записи', 'записів')}</span></header>
      ${(s.journal || []).length ? `<ol class="journal">${s.journal.map(j => `<li><b>Тиждень ${j.w + 1}</b><span>${esc(j.t)}</span></li>`).join('')}</ol>` : '<p class="muted">Записів поки немає.</p>'}</section>
    <section class="card"><header class="card-h"><h3>Усі тижні</h3><span class="muted sm">гроші, користувачі, виручка й витрати</span></header>
      ${h.length ? `<div style="overflow-x:auto"><table class="tbl sm weeks"><thead><tr><th>Тиждень</th><th>Гроші</th><th>Активні</th><th>Платні</th><th>Виручка</th><th>Витрати</th><th>Енергія</th></tr></thead><tbody>${h.map(x => `<tr><td>${x.week + 1}</td><td>${money(x.cash)}</td><td>${num(x.users)}</td><td>${num(x.paid)}</td><td>${money(x.rev)}</td><td>${money(x.cost)}</td><td>${x.energy != null ? x.energy + '%' : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Ще не минуло жодного тижня.</p>'}</section>
  </div>`;
}

export const coreViews = {
  dash: { t: 'Головна', icon: 'home', render: dash },
  inbox: { t: 'Пошта', icon: 'mail', render: inbox },
  help: { t: 'Довідник і словник', icon: 'book', render: help },
  report: { t: 'Підсумковий звіт', icon: 'award', render: S => { S.s.flags.reportMade = true; return report(S); } },
};
export const coreActs = {
  go: (C, el) => { C.go(el.dataset.to); if (el.dataset.hl) C.flash(el.dataset.hl); },
  dismissTip: (C, el) => { C.S.s.dismissed[el.dataset.id] = true; C.render(); },
  openMail: (C, el) => { C.ui.mail = el.dataset.id; const m = C.S.s.inbox.find(x => x.id === el.dataset.id); if (m && !m.choices) m.read = true; C.render(); },
  choose: (C, el) => { const m = C.S.s.inbox.find(x => x.id === el.dataset.id); const r = C.S.choose(el.dataset.id, +el.dataset.i); if (m) m.read = true; if (r) C.toast(r, 'good'); C.render(); if (C.S.s.over) C.ending(); },
  print: () => print(),
  // план тижня: крапки по 5 годин і кнопки + / −
  hrs: (C, el) => { const S = C.S, k = el.dataset.k, v = S.s.hours[k] || 0; S.setHours(k, Math.max(0, Math.min(DOTS * STEP, (Math.round(v / STEP) + +el.dataset.d) * STEP))); C.render(); },
  hrsSet: (C, el) => { C.S.setHours(el.dataset.k, +el.dataset.v); C.render(); },
  // натискання на стовпчик: висота точки натискання, округлена до 5 годин
  hrsAt: (C, el, e) => { const r = el.getBoundingClientRect(), f = e && e.clientY ? 1 - (e.clientY - r.top) / r.height : null; if (f == null) return; C.S.setHours(el.dataset.k, Math.max(0, Math.min(DOTS, Math.round(f * DOTS))) * STEP); C.render(); },
};
export const coreIns = {
  crunch: (C, el) => { C.S.s.crunch = el.checked; C.save(); },
  q: (C, el) => { C.ui.q = el.value; C.render(); const i = document.querySelector('[data-in="q"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } },
};
