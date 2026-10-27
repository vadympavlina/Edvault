// Симулятор стартапу · розділи: Ціна, Фінанси, Платежі, Інвестори, Інвестиції.
import { INVESTORS, SLIDES } from './data.js';
import { money, num, pct, plural, sum, W2M } from './sim.js';
import { PAYMENTS, ASSETS } from './mods.js';
import { icon } from './icons.js';
import { esc, term, meter, lineChart, donut, bars, confirmBox } from './ui.js';

/* ═════════ Ціна ═════════ */
function pricing(S) {
  const s = S.s, t = s.target, g = S.seg(), hw = S.I.kind === 'hardware';
  s.flags.breakEvenSeen = true;
  const cac = S.cac(), ltv = S.ltv(), ratio = cac > 0 && Number.isFinite(cac) ? ltv / cac : null;
  const be = S.breakEven(), paid = S.paidUsers(t);
  // модель для звичайних людей можна обрати, якщо серед сегментів є хоч один B2C
  const c = hw || S.segIds.every(k => S.seg(k).b2b) ? null : S.I.models.filter(m => m !== 'b2b' && m !== 'device');
  const priceRow = k => {
    const G = S.seg(k), K = S.insight(k), max = Math.round(G.wtp / (G.units || 1) * 2.5 / 10) * 10, pf = S.priceF(k), m = S.modelOf(k);
    return `<div class="price-row ${k === t ? 'target' : ''}"><div><b>${esc(G.short)}</b><small>${S.model(m).t}${G.units ? ` · ${G.units} ${S.uw(2)} у замовленні` : ''}</small></div>
      <input type="range" min="0" max="${max}" step="${max > 5000 ? 100 : 10}" value="${s.price[k]}" data-in="price" data-k="${k}" ${m === 'free' ? 'disabled' : ''} aria-label="Ціна для ${esc(G.short)}">
      <output data-out="p-${k}">${m === 'free' ? 'безкоштовно' : money(s.price[k]) + (hw ? '/шт' : '/міс')}</output>
      <div class="pf"><span>Готові платити</span>${meter(pf, { color: pf > .55 ? 'var(--ok)' : pf > .3 ? 'var(--warn)' : 'var(--bad)' })}<small data-out="pf-${k}">${pct(pf)}</small></div>
      <small class="muted">${K.wtp ? `За інтерв'ю зараз витрачають ≈ ${money(K.wtp)}${G.units ? ' на замовлення' : ''}` : 'Дізнайтеся в інтерв\'ю, скільки клієнти витрачають зараз'}${K.badWtp ? ` · «заплатили б» ${money(K.badWtp)} — ненадійно` : ''}</small></div>`;
  };
  return `<p class="lead">Ціна — найсильніший важіль бізнесу. Занизька — не покриєте витрати, зависока — ніхто не купить. Орієнтуйтеся на те, скільки клієнти вже витрачають на проблему.</p>
  ${c ? `<section class="card"><header class="card-h"><h3>${icon('coins')} Модель для звичайних людей (B2C)</h3>${term('B2C')}</header><div class="seg-ctl">${c.map(m => `<button class="${s.model === m ? 'on' : ''}" data-act="model" data-k="${m}" aria-pressed="${s.model === m}"><b>${S.model(m).t}</b><small>${S.model(m).desc}</small></button>`).join('')}</div></section>` : ''}
  <section class="card"><header class="card-h"><h3>${icon('tag')} Ціни за сегментами</h3></header>${S.segIds.map(priceRow).join('')}
    ${hw ? `<p class="note">${icon('info', 16)} ${term('Собівартість')} одного ${S.uw(3)}: <b>${money(s.unitCost)}</b>. Ціна нижча — кожен продаж у мінус.</p>` : ''}</section>
  <div class="grid g2">
    <section class="card"><header class="card-h"><h3>${icon('chart')} ${term('Юніт-економіка', 'Чи вигідний один клієнт')}</h3></header>
      <div class="ins">
        <div><span>${term('CAC', 'Скільки коштує залучити')}</span><b>${cac && Number.isFinite(cac) ? money(cac) : '—'}</b><small>маркетинг ÷ нові платні (4 тиж.)</small></div>
        <div><span>${term('LTV', 'Скільки приносить за весь час')}</span><b>${money(ltv)}</b><small>${hw ? 'маржа з одного продажу' : 'за весь час клієнта'}</small></div>
        <div><span>У скільки разів окупається</span><b class="${ratio == null ? '' : ratio >= 3 ? 'pos' : ratio < 1 ? 'neg' : ''}">${ratio == null ? '—' : ratio.toFixed(1).replace('.', ',')}</b><small>${ratio == null ? 'немає платного маркетингу' : ratio >= 3 ? 'здорова модель' : ratio >= 1 ? 'на межі' : 'кожен клієнт у мінус'}</small></div>
        <div><span>${term('Churn', 'Скільки платних іде')}</span><b>${pct(S.churnRate(t, true), 1)}</b><small>на тиждень · ${pct(1 - Math.pow(1 - S.churnRate(t, true), W2M))} на місяць</small></div>
      </div></section>
    <section class="card"><header class="card-h"><h3>${icon('target')} Точка беззбитковості</h3></header>
      <p>Постійні витрати на місяць: <b>${money(be.fixed)}</b> (зарплати, сервери, бухгалтерія, реклама).</p>
      <p>Заробіток з одного клієнта після комісій і собівартості: <b class="${be.margin > 0 ? 'pos' : 'neg'}">${money(be.margin)}</b>${hw ? '' : ' на місяць'}.</p>
      ${be.margin > 0 ? `<p class="big">Потрібно <b>${num(be.need)}</b> ${plural(be.need, ...be.unit)}</p>${hw ? '' : `${meter(paid / be.need, { color: paid >= be.need ? 'var(--ok)' : 'var(--acc)' })}<small class="muted">Зараз: ${num(paid)} (${pct(Math.min(1, paid / be.need))})</small>`}` : '<p class="note bad">Ціна не покриває навіть змінних витрат — беззбитковість недосяжна. Підніміть ціну або зменшіть собівартість.</p>'}
    </section>
  </div>`;
}

// партія: дрібні товари замовляють десятками, пристрої — сотнями
const small = S => S.I.batchMin < 100;
const batchMax = S => small(S) ? 1000 : 3000, batchStep = S => small(S) ? 10 : 50;
const batchDef = S => small(S) ? Math.min(1000, S.I.batchMin * 5) : 500;

/* ═════════ Фінанси ═════════ */
function finance(S, ui) {
  const s = S.s, h = s.history, labels = h.map(x => String(x.week + 1)), last4 = h.slice(-4), hw = S.I.kind === 'hardware';
  const cap = s.cap.map((c, i) => ({ ...c, pct: c.shares / S.totalShares(), color: ['var(--acc)', '#0ea5e9', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#ec4899'][i % 8] }));
  const val = S.valuation();
  const pf = S.planFact();
  const L = s.loan, lim = S.loanLimit(), Cr = s.crowd;
  return `<div class="kpis">
    <div class="kpi"><span class="kpi-l">Гроші</span><b>${money(s.cash)}</b></div>
    <div class="kpi"><span class="kpi-l">${term('Burn rate', 'Витрачаємо за тиждень')}</span><b class="${S.burnWeekly() > 0 ? 'neg' : 'pos'}">${money(Math.max(0, S.burnWeekly()))}</b><small>${S.burnWeekly() <= 0 ? 'виручка більша за витрати' : 'витрати мінус виручка, середнє за 4 тиж.'}</small></div>
    <div class="kpi"><span class="kpi-l">${term('Runway', 'Вистачить грошей на')}</span><b>${S.runwayWeeks() === Infinity ? '∞' : S.runwayWeeks() > 104 ? '2+ роки' : Math.max(0, Math.floor(S.runwayWeeks())) + ' тиж.'}</b></div>
    <div class="kpi"><span class="kpi-l">${term('Оцінка компанії')}</span><b>${money(val)}</b><small>ваша частка ≈ ${money(val * S.stake())}</small></div>
  </div>
  <section class="card"><header class="card-h"><h3>${icon('building')} Форма компанії</h3>${term('ФОП і ТОВ')}</header>
    <div class="grid g2"><div class="opt ${s.company.form === 'fop' ? 'on' : ''}"><b>ФОП</b><p class="sm">Податок 5% від виручки, 1 300 ₴ на місяць. Безкоштовна реєстрація. Інвестор не може отримати частку.</p>${s.company.form === 'none' ? '<button class="btn" data-act="register" data-k="fop">Зареєструвати ФОП</button>' : s.company.form === 'fop' ? '<span class="chip ok">Ваша форма</span>' : ''}</div>
    <div class="opt ${s.company.form === 'tov' ? 'on' : ''}"><b>ТОВ</b><p class="sm">Реєстрація 12 000 ₴, бухгалтер 6 000 ₴ на місяць, податок 18% з прибутку. Потрібне для інвестицій.</p>${s.company.form !== 'tov' ? `<button class="btn" data-act="register" data-k="tov">${s.company.form === 'fop' ? 'Перейти на ТОВ' : 'Зареєструвати ТОВ'} (12 000 ₴)</button>` : '<span class="chip ok">Ваша форма</span>'}</div></div>
    ${s.company.form === 'none' ? `<p class="note warn">${icon('alert', 16)} Компанію не зареєстровано: оплата від клієнтів не надходить.</p>` : ''}</section>
  <div class="grid g2">
    <section class="card"><header class="card-h"><h3>${icon('wallet')} Звіт про прибутки й збитки</h3><span class="muted sm">останні 4 тижні</span></header>
      ${last4.length ? (() => { const t = sum(last4.map(x => x.rev)), c = sum(last4.map(x => x.cost)); return `<table class="tbl"><tbody><tr><td>Виручка</td><td class="pos">${money(t)}</td></tr><tr><td>Витрати</td><td class="neg">${money(c)}</td></tr>${s.last?.money ? Object.entries({ salaries: 'зарплати', mkt: 'маркетинг', servers: 'сервери', cogs: 'собівартість', tax: 'податки', formFee: 'обслуговування компанії', tools: 'сервіси й інструменти', loyal: 'лояльність', loan: 'кредит', extra: 'разові витрати' }).filter(([k]) => s.last.money[k] > 0).map(([k, t2]) => `<tr class="sub"><td>— ${t2} (минулий тиждень)</td><td>${money(s.last.money[k])}</td></tr>`).join('') : ''}<tr class="tot"><td>Результат</td><td class="${t - c >= 0 ? 'pos' : 'neg'}">${money(t - c)}</td></tr></tbody></table>`; })() : '<p class="empty">Дані з\'являться після першого тижня</p>'}</section>
    <section class="card"><header class="card-h"><h3>${icon('chart')} Виручка й витрати</h3></header>${lineChart([{ v: h.map(x => x.rev), color: '#16a34a', label: 'Виручка', area: true }, { v: h.map(x => x.cost), color: '#ef4444', label: 'Витрати' }], { labels, fmt: x => money(x).replace(' ₴', '') })}</section>
  </div>
  <section class="card"><header class="card-h"><h3>${icon('calendar')} Фінансовий план</h3><span class="muted sm">план на 3 місяці і порівняння з фактом</span></header>
    ${s.plan && !ui.newPlan ? `<table class="tbl"><thead><tr><th>Місяць</th><th>Виручка: план</th><th>факт</th><th>Витрати: план</th><th>факт</th></tr></thead><tbody>${pf.map((m, i) => `<tr><td>${i + 1}${m.full ? '' : ' <small class="muted">(триває)</small>'}</td><td>${money(m.rev)}</td><td class="${m.weeks ? (m.frev >= m.rev * .9 ? 'pos' : 'neg') : ''}">${m.weeks ? money(m.frev) + (m.rev ? ` <small>${pct(m.frev / m.rev)}</small>` : '') : '—'}</td><td>${money(m.cost)}</td><td class="${m.weeks ? (m.fcost <= m.cost * 1.1 ? 'pos' : 'neg') : ''}">${m.weeks ? money(m.fcost) : '—'}</td></tr>`).join('')}</tbody></table><button class="btn sm" data-act="newPlan">Скласти новий план</button>`
      : `<p class="sm">Спрогнозуйте виручку й витрати на кожен із наступних 3 місяців. Підказка: зараз за місяць виручка ≈ <b>${money(S.lastRev() * W2M)}</b>, витрати ≈ <b>${money(S.lastCost() * W2M)}</b>.</p>
      <div class="plan-in">${[0, 1, 2].map(i => `<div><b>Місяць ${i + 1}</b><label>Виручка<input class="inp" type="number" min="0" step="1000" data-plan="rev${i}" value="${Math.round(S.lastRev() * W2M * (1 + i * .1) / 1000) * 1000}"></label><label>Витрати<input class="inp" type="number" min="0" step="1000" data-plan="cost${i}" value="${Math.round(S.lastCost() * W2M / 1000) * 1000}"></label></div>`).join('')}</div>
      <button class="btn primary" data-act="savePlan">Зберегти план</button>`}
  </section>
  <div class="grid g2">
    <section class="card"><header class="card-h"><h3>${icon('bank')} Банківський кредит</h3></header>
      ${L && !L.closed ? `<p>Кредит ${money(L.amt)} під ${pct(L.rate)} річних. Щотижневий платіж: <b>${money(L.pay)}</b>. Лишилось ${L.left} ${plural(L.left, 'платіж', 'платежі', 'платежів')}, борг ${money(L.owed)}.</p>${meter(1 - L.left / L.n)}<p class="sm muted">Загалом поверните ≈ ${money(L.pay * L.n)} — це на ${money(L.pay * L.n - L.amt)} більше, ніж узяли.</p>`
        : lim > 0 ? `<p class="sm">Банк дає кредит під 26% річних на рік, якщо у вас є стабільна виручка. Ліміт: <b>${money(lim)}</b>.</p><div class="sl"><input type="range" min="10000" max="${lim}" step="10000" value="${Math.max(10000, Math.round(lim / 2 / 10000) * 10000)}" data-in="loanAmt" aria-label="Сума кредиту"><output data-out="loan">${money(Math.max(10000, Math.round(lim / 2 / 10000) * 10000))}</output></div><button class="btn" data-act="loan">Взяти кредит</button>`
        : `<p class="muted sm">Банк дає кредит лише зареєстрованій компанії з виручкою щонайменше 8 тижнів поспіль.${L?.closed ? ' Попередній кредит погашено.' : ''}</p>`}</section>
    <section class="card"><header class="card-h"><h3>${icon('users')} Краудфандинг</h3></header>
      ${Cr && Cr.status === 'live' ? `<p>Кампанія триває до тижня ${Cr.end}. Зібрано <b>${money(Cr.raised)}</b> з ${money(Cr.goal)} від ${Cr.backers} ${plural(Cr.backers, 'людини', 'людей', 'людей')}.</p>${meter(Cr.raised / Cr.goal, { color: 'var(--ok)' })}<p class="sm muted">Правило «все або нічого»: якщо не зберете мету, гроші повернуться людям.</p>`
        : Cr && Cr.status === 'won' ? `<p class="note ok">${icon('check', 16)} Кампанію виграно: ${money(Cr.raised)} від ${Cr.backers} людей.</p>`
        : `<p class="sm">Люди передплачують продукт наперед. Платформа бере 8%. Більше зберуть ті, в кого є промо-відео, впізнаваний бренд і цікавий продукт.</p>
          <div class="form2"><label><span>Мета</span><input class="inp" type="number" min="20000" step="10000" data-cr="goal" value="${hw ? 200000 : 100000}"></label><label><span>Ціна винагороди</span><input class="inp" type="number" min="50" step="10" data-cr="reward" value="${Math.round((hw ? s.price[s.target] : s.price[s.target] * 3) / 10) * 10}"></label></div>
          <button class="btn" data-act="crowd">Запустити кампанію на 4 тижні</button>${Cr?.status === 'failed' ? '<p class="sm muted">Попередня кампанія не зібрала мету.</p>' : ''}`}</section>
  </div>
  ${hw ? `<section class="card"><header class="card-h"><h3>${icon('box')} Склад і виробництво</h3></header>
    <div class="ins"><div><span>На складі</span><b>${num(s.stock.units)} шт.</b></div><div><span>Їде з фабрики</span><b>${num(sum(s.stock.orders.map(o => o.n)))} шт.</b><small>${s.stock.orders.map(o => `тиждень ${o.due + 1}`).join(', ') || '—'}</small></div><div><span>Собівартість</span><b>${money(s.unitCost)}</b></div><div><span>Мін. партія</span><b>${S.I.batchMin} шт.</b><small>виготовлення ${S.I.leadTime} тиж.</small></div></div>
    ${s.flags.crowdUnits ? `<p class="note warn">${icon('alert', 16)} Підтримувачі краудфандингу чекають ${s.flags.crowdUnits} ${plural(s.flags.crowdUnits, S.uw(0), S.uw(1), S.uw(2))}.</p>` : ''}
    <div class="sl"><label>Партія</label><input type="range" min="${S.I.batchMin}" max="${batchMax(S)}" step="${batchStep(S)}" value="${ui.batch || batchDef(S)}" data-in="batch" aria-label="Розмір партії"><output data-out="batch">${ui.batch || batchDef(S)} шт. · ${money((ui.batch || batchDef(S)) * s.unitCost)}</output></div>
    <button class="btn primary" data-act="order">Замовити виробництво</button><p class="sm muted">Гроші за партію платите одразу, а ${S.uw(1)} з'являться за ${S.I.leadTime} ${plural(S.I.leadTime, 'тиждень', 'тижні', 'тижнів')}. Так стартапи на «залізі» потрапляють у касовий розрив.</p></section>` : ''}
  <section class="card"><header class="card-h"><h3>${icon('users')} ${term('Таблиця власників')}</h3>${term('Розмивання частки')}</header>
    <div class="cap">${donut(cap.map(c => ({ v: c.shares, color: c.color })))}<table class="tbl"><thead><tr><th>Власник</th><th>Частка</th><th>Вартість</th></tr></thead><tbody>${cap.map(c => `<tr><td><i class="dot" style="background:${c.color}"></i>${esc(c.t)}</td><td>${pct(c.pct, 1)}</td><td>${money(val * c.pct)}</td></tr>`).join('')}</tbody></table></div></section>`;
}

/* ═════════ Платежі ═════════ */
function payments(S, ui) {
  const s = S.s, b2b = S.segIds.some(k => S.seg(k).b2b), hw = S.I.kind === 'hardware';
  const monthly = Math.max(S.mrr(), S.lastRev() * W2M, 10000);
  const calc = id => { const P = PAYMENTS[id]; const lostFee = monthly * P.fee, lostFail = monthly * (1 - P.ok); return `<div class="pay-calc"><span>На вашій виручці ≈ ${money(monthly)}/міс:</span><span>комісія ${money(lostFee)}</span><span>невдалі оплати ≈ ${money(lostFail)}</span>${P.setup ? `<span>підключення ${money(P.setup)} разово</span>` : ''}</div>`; };
  return `<p class="lead">Платіжна система вирішує, скільки грошей клієнта дійде до вас. Різниця в 1–2% комісії на великій виручці — це зарплата працівника. А кожна невдала оплата — втрачений клієнт.</p>
  ${!s.pay.main ? `<p class="note">${icon('info', 16)} Поки ви нічого не обрали, оплати йдуть через платіжний агрегатор.</p>` : ''}
  ${!S.hasFlag('pay') ? `<p class="note warn">${icon('alert', 16)} Спершу додайте в продукт функцію оплати (розділ «Продукт»).</p>` : ''}
  <div class="grid g2">${Object.entries(PAYMENTS).filter(([, P]) => !(P.apps && hw)).map(([id, P]) => { const main = s.pay.main === id, bb = s.pay.b2b === id; const seen = (s.pay.seen || []).includes(id); return `<article class="card pay ${main || bb ? 'on' : ''}"><header class="card-h"><h3>${icon(P.crypto ? 'bitcoin' : P.b2b ? 'building' : P.apps ? 'phone' : 'card')} ${esc(P.t)}</h3>${main ? '<span class="chip ok">основна</span>' : ''}${bb ? '<span class="chip ok">для організацій</span>' : ''}</header>
    <p class="sm">${esc(P.desc)}</p><div class="ins"><div><span>Комісія</span><b>${pct(P.fee, 1)}</b></div><div><span>Успішні оплати</span><b>${pct(P.ok)}</b></div><div><span>Підключення</span><b>${P.setup ? money(P.setup) : 'безкоштовно'}</b></div></div>
    ${seen ? calc(id) : `<button class="btn sm ghost" data-act="payCalc" data-k="${id}">Розрахувати для мене</button>`}
    <div class="row gap">${P.b2b ? (b2b ? `<button class="btn sm ${bb ? '' : 'primary'}" data-act="payB2B" data-k="${id}" ${bb ? 'disabled' : ''}>Для організацій</button>` : '<small class="muted">Лише для організацій-клієнтів</small>') : `<button class="btn sm ${main ? '' : 'primary'}" data-act="payMain" data-k="${id}" ${main ? 'disabled' : ''}>${main ? 'Підключено' : 'Підключити'}</button>`}</div></article>`; }).join('')}</div>
  <section class="card"><header class="card-h"><h3>${icon('info')} Що варто знати</h3></header><ul class="facts">
    <li><b>Комісія</b> — відсоток, який платіжна система забирає з кожної оплати.</li><li><b>Відмови</b> — банк клієнта блокує оплату, картка не підтримується, людина не пройшла підтвердження. Кожна відмова — це, найімовірніше, втрачений клієнт.</li>
    <li><b>Магазини застосунків</b> беруть 15–30%, зате оплата в один дотик і додаткові користувачі з магазину.</li><li><b>Криптовалюта</b>: комісія мала, але мало хто нею платить, а курс змінюється щодня. Для звичайного продукту це радше експеримент.</li></ul></section>`;
}

/* ═════════ Інвестори ═════════ */
function investors(S) {
  const s = S.s, d = s.deck, score = S.deckScore(), notes = S.deckNotes(), val = S.valuation();
  const invHours = s.hours.invest;
  const inv = INVESTORS.map(I => {
    const st = s.inv[I.id], need = S.needsOf(I), amount = I.amount[0] === I.amount[1] ? money(I.amount[0]) : `${money(I.amount[0])} — ${money(I.amount[1])}`;
    const take = I.take === 0 ? 'без частки' : Array.isArray(I.take) ? `${pct(I.take[0])}–${pct(I.take[1])}` : pct(I.take);
    let action = '';
    if (I.kind === 'grant' && st?.status === 'rejected') action = '<span class="chip bad">Відмова · подати можна лише раз</span>';
    else if (!st || st.status === 'declined' || (st.status === 'rejected' && s.week - st.week >= 8)) action = `<button class="btn primary sm" data-act="pitch" data-k="${I.id}">${I.kind === 'grant' ? 'Подати заявку' : 'Запросити на зустріч'}</button>`;
    else if (st.status === 'meeting') action = '<span class="chip">Зустріч цього тижня</span>';
    else if (st.status === 'grantWait') action = `<span class="chip">Розгляд заявки, рішення через ${Math.max(1, st.week + 3 - s.week)} тиж.</span>`;
    else if (st.status === 'rejected') action = `<span class="chip bad">Відмова · знову можна з тижня ${st.week + 9}</span>`;
    else if (st.status === 'invested' || st.status === 'accel') action = `<span class="chip ok">${I.kind === 'grant' ? 'Грант отримано' : 'Інвестував'}</span>`;
    else if (st.status === 'offer') action = `<div class="offer"><b>Пропозиція: ${money(st.offer.amount)} за ${pct(st.offer.take, 1)}</b><small>Оцінка після інвестиції: ${money(st.offer.amount / st.offer.take)}. Ваша частка стане ${pct(S.stake() * (1 - st.offer.take), 1)}. Діє до тижня ${st.offer.until + 1}.</small><div class="row gap wrap"><button class="btn primary sm" data-act="accept" data-k="${I.id}">Прийняти</button>${st.countered ? '' : `<button class="btn sm" data-act="counter" data-k="${I.id}">Торгуватися</button>`}<button class="btn sm ghost" data-act="decline" data-k="${I.id}">Відмовитися</button></div></div>`;
    return `<article class="card inv ${st?.status === 'offer' ? 'hot' : ''}"><header class="card-h"><h3>${icon(I.icon)} ${esc(I.t)}</h3><span class="chip sm">${{ grant: 'грант', accel: 'акселератор', angel: 'бізнес-ангел', vc: 'венчурний фонд' }[I.kind]}</span></header>
      <small class="muted">${esc(I.who)}</small><p class="sm">${esc(I.about)}</p><div class="ins"><div><span>Сума</span><b>${amount}</b></div><div><span>Хоче</span><b>${take}</b></div></div>
      <ul class="needs">${need.length ? need.map(n => `<li class="no">${icon('x', 14)} ${esc(n)}</li>`).join('') : `<li class="yes">${icon('check', 14)} Ви відповідаєте вимогам</li>`}</ul>${action}</article>`;
  }).join('');
  return `<p class="lead">Інвестиції — це гроші в обмін на частку компанії. Що раніше залучаєте, то більшу частку віддаєте. ${term('Оцінка компанії')} ${term('Розмивання частки')}</p>
  <div class="kpis"><div class="kpi"><span class="kpi-l">Оцінка компанії зараз</span><b>${money(val)}</b></div><div class="kpi"><span class="kpi-l">Ваша частка</span><b>${pct(S.stake(), 1)}</b></div><div class="kpi ${invHours < 6 ? 'warn' : ''}"><span class="kpi-l">Години на інвесторів</span><b>${invHours} год</b><small>на одну зустріч — 6 год</small></div><div class="kpi"><span class="kpi-l">Форма компанії</span><b>${{ none: 'не зареєстровано', fop: 'ФОП', tov: 'ТОВ' }[s.company.form]}</b></div></div>
  <section class="card"><header class="card-h"><h3>${icon('plan')} ${term('Пітч-дек')}</h3><span class="chip ${score >= .75 ? 'ok' : score >= .5 ? 'warn' : 'bad'}">Якість: ${pct(score)}</span></header>
    <div class="deck"><div><p class="sm muted">Ваша презентація (порядок важливий)</p><ol class="deck-list">${d.slides.map((k, i) => `<li class="${SLIDES[k].bad ? 'bad' : ''}"><span>${esc(SLIDES[k].t)}</span><span class="row"><button class="ib" data-act="slideUp" data-i="${i}" aria-label="Вище">${icon('up', 14)}</button><button class="ib" data-act="slideDown" data-i="${i}" aria-label="Нижче">${icon('down', 14)}</button><button class="ib" data-act="slideRm" data-i="${i}" aria-label="Прибрати">${icon('x', 14)}</button></span></li>`).join('')}</ol></div>
      <div><p class="sm muted">Можна додати</p><div class="deck-add">${Object.entries(SLIDES).filter(([k]) => !d.slides.includes(k)).map(([k, v]) => `<button class="btn sm" data-act="slideAdd" data-k="${k}">${icon('plus', 14)} ${esc(v.t)}</button>`).join('')}</div>
      ${notes.length ? `<ul class="deck-notes">${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : `<p class="note ok">${icon('check', 16)} Сильна структура презентації.</p>`}
      <label class="switch"><input type="checkbox" data-in="honest" ${d.honest ? '' : 'checked'}><span></span>Трохи прикрасити цифри в презентації</label>
      ${d.honest ? '' : `<p class="note warn sm">${icon('alert', 14)} Інвестори перевіряють цифри перед угодою. Якщо виявлять неправду — відмовлять і розкажуть іншим.</p>`}</div></div></section>
  <div class="grid g2">${inv}</div>`;
}

/* ═════════ Інвестиції (вільні гроші компанії) ═════════ */
function invest(S, ui) {
  const s = S.s, port = s.port, total = S.portValue(), risky = S.riskyShare();
  const assets = Object.entries(ASSETS).filter(([k, a]) => !a.hidden || s.flags.memeOffered);
  return `<p class="lead">Якщо грошей більше, ніж потрібно на найближчі місяці, їх можна вкласти. Головне правило: гроші, які знадобляться на зарплати й рахунки, не мають лежати в ризикових активах.</p>
  <div class="kpis"><div class="kpi"><span class="kpi-l">Вільні гроші</span><b>${money(s.cash)}</b></div><div class="kpi"><span class="kpi-l">У вкладеннях</span><b>${money(total)}</b><small>${total ? delta2(total - sum(Object.values(port).map(p => p.in))) : ''}</small></div><div class="kpi ${risky > .1 ? 'warn' : ''}"><span class="kpi-l">Частка ризикових активів</span><b>${pct(risky)}</b><small>розумно — до 10%</small></div><div class="kpi"><span class="kpi-l">Вистачить грошей на (без вкладень)</span><b>${S.runwayWeeks() === Infinity ? '∞' : S.runwayWeeks() > 104 ? '2+ роки' : Math.max(0, Math.floor(S.runwayWeeks())) + ' тиж.'}</b></div></div>
  <div class="grid g2">${assets.map(([k, A]) => { const p = port[k]; const gain = p ? p.v - p.in : 0; return `<article class="card asset ${A.hidden ? 'scam' : ''}"><header class="card-h"><h3>${icon(k === 'crypto' || k === 'meme' ? 'bitcoin' : k === 'deposit' ? 'bank' : k === 'ovdp' ? 'shield' : 'trend')} ${esc(A.t)}</h3><span class="chip ${A.risk === 'Шахрайство' ? 'bad' : A.risk.includes('високий') ? 'warn' : 'ok'}">Ризик: ${A.risk.toLowerCase()}</span></header>
    <p class="sm">${esc(A.desc)}</p>${A.hidden ? '' : `<div class="ins"><div><span>Очікувана дохідність</span><b>${pct(A.y)} на рік</b></div><div><span>Коливання</span><b>${A.vol ? '±' + pct(A.vol) : 'немає'}</b></div><div><span>Комісія</span><b>${pct(A.fee, 1)}</b></div></div>`}
    ${p ? `<p>Вкладено ${money(p.in)} → зараз <b class="${gain >= 0 ? 'pos' : 'neg'}">${money(p.v)}</b> (${gain >= 0 ? '+' : ''}${pct(gain / Math.max(1, p.in), 1)})</p>` : ''}
    <div class="row gap wrap"><input class="inp sm" type="number" min="1000" step="1000" value="${Math.min(50000, Math.max(1000, Math.round(s.cash / 10 / 1000) * 1000))}" data-amt="${k}" aria-label="Сума"><button class="btn sm primary" data-act="buy" data-k="${k}">Купити</button>${p ? `<button class="btn sm" data-act="sell" data-k="${k}">Продати все</button>` : ''}</div></article>`; }).join('')}</div>
  ${s.history.length > 1 && total ? `<section class="card"><header class="card-h"><h3>Вартість вкладень</h3></header>${lineChart([{ v: s.history.map(x => x.port || 0), color: '#8b5cf6', label: 'Вкладення', area: true }], { labels: s.history.map(x => String(x.week + 1)), fmt: x => money(x).replace(' ₴', '') })}</section>` : ''}`;
}
const delta2 = v => `<span class="${v >= 0 ? 'pos' : 'neg'}">${v >= 0 ? '+' : '−'}${money(Math.abs(v))}</span>`;

export const moneyViews = {
  pricing: { t: 'Ціна', icon: 'coins', render: pricing },
  finance: { t: 'Фінанси', icon: 'wallet', render: finance },
  payments: { t: 'Платежі', icon: 'card', render: payments },
  investors: { t: 'Інвестори', icon: 'handshake', render: investors },
  invest: { t: 'Вкладення', icon: 'trend', render: invest },
};
export const moneyActs = {
  model: (C, el) => { C.S.setModel(el.dataset.k); C.render(); },
  register: async (C, el) => { const k = el.dataset.k; if (!await confirmBox(k === 'tov' ? 'Зареєструвати ТОВ за 12 000 ₴?' : 'Зареєструвати ФОП?', 'Зареєструвати')) return; if (C.S.register(k)) C.toast(k === 'tov' ? 'ТОВ зареєстровано' : 'ФОП зареєстровано', 'good'); else C.toast('Не вистачає грошей', 'bad'); C.render(); C.topbar(); },
  newPlan: C => { C.ui.newPlan = true; C.render(); },
  savePlan: C => { const v = k => +(document.querySelector(`[data-plan="${k}"]`)?.value || 0); C.S.setPlan([0, 1, 2].map(i => ({ rev: v('rev' + i), cost: v('cost' + i) }))); C.ui.newPlan = false; C.toast('Фінплан збережено. Порівнюйте з фактом щомісяця.', 'good'); C.render(); },
  loan: async C => { const v = +(document.querySelector('[data-in="loanAmt"]')?.value || 0); if (!await confirmBox(`Взяти кредит ${money(v)} під 26% річних?`, 'Взяти', { sub: 'Платити доведеться щотижня, навіть якщо виручка впаде.' })) return; if (C.S.takeLoan(v)) C.toast('Кредит отримано', 'good'); else C.toast('Банк відмовив: сума більша за ліміт', 'bad'); C.render(); C.topbar(); },
  crowd: C => { const g = +(document.querySelector('[data-cr="goal"]')?.value || 0), r = +(document.querySelector('[data-cr="reward"]')?.value || 0); if (g < 20000 || r < 50) { C.toast('Перевірте мету й ціну винагороди', 'bad'); return; } if (C.S.startCrowd(g, r)) C.toast('Кампанію запущено', 'good'); C.render(); },
  order: C => { const n = C.ui.batch || batchDef(C.S); if (C.S.orderBatch(n)) C.toast(`Замовлено ${n} ${plural(n, C.S.uw(0), C.S.uw(1), C.S.uw(2))}`, 'good'); else C.toast('Не вистачає грошей на партію', 'bad'); C.render(); C.topbar(); },
  payMain: (C, el) => { if (C.S.setPay(el.dataset.k, 'main')) C.toast(`Підключено: ${PAYMENTS[el.dataset.k].t}`, 'good'); else C.toast('Не вдалося підключити', 'bad'); C.render(); C.topbar(); },
  payB2B: (C, el) => { if (C.S.setPay(el.dataset.k, 'b2b')) C.toast('Організації платитимуть за рахунком', 'good'); C.render(); },
  payCalc: (C, el) => { C.S.seePay(el.dataset.k); C.render(); },
  pitch: (C, el) => { const r = C.S.pitch(el.dataset.k); if (r.ok) C.toast('Зустріч заплановано — результат після завершення тижня', 'good'); else C.toast(r.msg || 'Зараз неможливо', 'bad'); C.render(); },
  accept: async (C, el) => { const st = C.S.s.inv[el.dataset.k]; if (!await confirmBox(`Прийняти ${money(st.offer.amount)} за ${pct(st.offer.take, 1)} компанії?`, 'Прийняти')) return; C.S.acceptOffer(el.dataset.k); C.toast('Гроші надійшли на рахунок!', 'good'); C.render(); C.topbar(); },
  decline: (C, el) => { C.S.declineOffer(el.dataset.k); C.render(); },
  counter: (C, el) => { const r = C.S.counter(el.dataset.k); C.toast(r === 'yes' ? 'Інвестор погодився на меншу частку!' : r === 'same' ? 'Інвестор лишив пропозицію без змін' : 'Інвестор образився й пішов', r === 'yes' ? 'good' : r === 'walk' ? 'bad' : ''); C.render(); },
  slideUp: (C, el) => { const a = C.S.s.deck.slides, i = +el.dataset.i; if (i > 0) [a[i - 1], a[i]] = [a[i], a[i - 1]]; C.render(); },
  slideDown: (C, el) => { const a = C.S.s.deck.slides, i = +el.dataset.i; if (i < a.length - 1) [a[i + 1], a[i]] = [a[i], a[i + 1]]; C.render(); },
  slideRm: (C, el) => { C.S.s.deck.slides.splice(+el.dataset.i, 1); C.render(); },
  slideAdd: (C, el) => { C.S.s.deck.slides.push(el.dataset.k); C.render(); },
  buy: async (C, el) => { const k = el.dataset.k, v = +(document.querySelector(`[data-amt="${k}"]`)?.value || 0); if (k === 'meme' && !await confirmBox('Купити «СуперКоїн»?', 'Купити', { danger: true, sub: 'Анонімні акаунти, обіцянки «×100» і поспіх — класичні ознаки шахрайства.' })) return; if (C.S.buy(k, v)) C.toast(`Куплено на ${money(v)}`, 'good'); else C.toast('Недостатньо грошей', 'bad'); C.render(); C.topbar(); },
  sell: (C, el) => { const got = C.S.sell(el.dataset.k); C.toast(`Продано: отримано ${money(got)}`, 'good'); C.render(); C.topbar(); },
};
export const moneyIns = {
  price: (C, el) => { const k = el.dataset.k; C.S.setPrice(k, +el.value); C.out(`p-${k}`, money(+el.value) + (C.S.I.kind === 'hardware' ? '/шт' : '/міс')); C.out(`pf-${k}`, pct(C.S.priceF(k))); C.save(); },
  loanAmt: (C, el) => C.out('loan', money(+el.value)),
  batch: (C, el) => { C.ui.batch = +el.value; C.out('batch', `${el.value} шт. · ${money(+el.value * C.S.s.unitCost)}`); },
  honest: (C, el) => { C.S.s.deck.honest = !el.checked; C.render(); },
};
