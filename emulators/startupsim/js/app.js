// Симулятор стартапу · оболонка: меню, верхня панель, маршрути, старт, підсумки тижня, збереження.
import { IDEAS, BACKGROUNDS, ACHIEVEMENTS } from './data.js';
import { Sim, newGame, okState, money, num, pct, plural, dateText, WEEKS, HOURS } from './sim.js';
import { SYMBOLS, PALETTE } from './mods.js';
import { ARCH, KINDS, SIZES } from './custom.js';
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
  $('#side').innerHTML = `<div class="sd-brand">${logo(s.company, 34)}<div><b>${esc(s.company.name)}</b><small>${esc(S.I.t)}</small></div></div>
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
  const blankFeat = (core = false) => ({ name: '', desc: '', size: 'm', core, segs: [0] });
  const w = { step: 0, idea: 'homework', name: '', bg: 'dev', company: '', color: IDEAS.homework.color, sym: 'spark', fff: false,
    c: { name: '', kind: 'app', pitch: '', problem: '', unitCost: 400, segments: [{ name: '', arch: 'teens' }, { name: '', arch: 'parents' }], features: [blankFeat(true), blankFeat(), blankFeat()], competitors: [{ name: '', segs: [0] }] } };
  const el = h('<div class="wizard" role="dialog" aria-modal="true" aria-label="Новий стартап"></div>');
  document.body.appendChild(el); document.body.classList.add('wz-on');
  const steps = () => ['hello', 'idea', ...(w.idea === 'custom' ? ['cIdea', 'cSegs', 'cFeats', 'cComp'] : []), 'founder', 'company', 'money'];
  const TITLES = { hello: 'Вітаємо', idea: 'Ідея', cIdea: 'Опис', cSegs: 'Клієнти', cFeats: 'Функції', cComp: 'Конкуренти', founder: 'Засновник', company: 'Компанія', money: 'Гроші' };
  const c = w.c, segNames = () => c.segments.map((x, i) => x.name.trim() || `Сегмент ${i + 1}`);
  const archSel = (i, v) => `<select class="inp" data-c="segments.${i}.arch" aria-label="Тип клієнтів">${Object.entries(ARCH).map(([k, a]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${esc(a.t)}</option>`).join('')}</select>`;
  const segChecks = (path, sel) => `<div class="wz-segs">${segNames().map((n, i) => `<label><input type="checkbox" data-c="${path}" value="${i}" ${sel.includes(i) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</div>`;
  const VIEW = {
    hello: () => `<div class="wz-hero">${icon('rocket', 46)}<h1>Симулятор стартапу</h1><p>Ви засновуєте компанію з нуля. Говорите з клієнтами, будуєте продукт, створюєте бренд, шукаєте канали, рахуєте гроші, наймаєте команду й залучаєте інвестиції. Кожне рішення має наслідки.</p><ul class="wz-list"><li>${icon('users', 18)} Інтерв'ю з клієнтами й опитування</li><li>${icon('plan', 18)} Бізнес-план (Lean Canvas) і фінплан</li><li>${icon('palette', 18)} Бренд, маркетинг, акції</li><li>${icon('handshake', 18)} Гранти, інвестори, кредит, краудфандинг</li><li>${icon('laptop', 18)} Команда, спринти, фриланс</li><li>${icon('card', 18)} Платіжні системи, інвестування й криптовалюта</li></ul><p class="muted sm">Один хід — тиждень. Гра триває 2 роки, якщо раніше не закінчаться гроші. Усі люди й компанії вигадані.</p></div>`,
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
    founder: () => `<h2>Хто ви?</h2><label class="wz-f"><span>Ваше ім'я</span><input class="inp" data-w="name" value="${esc(w.name)}" placeholder="Наприклад, Олена" maxlength="30" autofocus></label><p class="sm muted">Ваш досвід визначає, що вам вдається найкраще.</p><div class="wz-bgs">${Object.entries(BACKGROUNDS).map(([k, b]) => `<button class="wz-bg ${w.bg === k ? 'on' : ''}" data-w="bg" data-v="${k}">${icon(b.icon, 24)}<b>${b.t}</b><small>${b.desc}</small></button>`).join('')}</div>`,
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
        S = newGame({ idea: w.idea === 'custom' ? 'homework' : w.idea, founder: w.name.trim(), bg: w.bg, company: w.company.trim(), color: w.color, sym: w.sym, fff: w.fff, custom });
        el.remove(); document.body.classList.remove('wz-on'); ui.view = 'dash'; render(); window.Startup.S = S;
        return;
      }
      w.step++;
    } else return;
    draw();
  });
  el.addEventListener('input', e => {
    const t = e.target, k = t.dataset.w, p = t.dataset.c;
    if (k === 'name' || k === 'company') { w[k] = t.value; if (k === 'company') { const x = el.querySelector('.wz-co b'); if (x) x.textContent = w.company || 'Назва'; } }
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
