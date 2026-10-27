// Симулятор стартапу · розділи: Команда, Фриланс.
import { ROLES, TRAITS } from './data.js';
import { money, num, pct, plural, sum, W2M } from './sim.js';
import { TASKS } from './mods.js';
import { icon } from './icons.js';
import { esc, modal, meter, confirmBox } from './ui.js';

const stars = (n, max = 5) => `<span class="stars" aria-label="${n} з ${max}">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;

/* ═════════ Команда ═════════ */
function team(S) {
  const s = S.s, pay = sum(s.team.map(m => m.salary));
  const member = m => `<article class="member">
    <div class="mb-h"><span class="av" style="--h:${(m.name.charCodeAt(0) * 37) % 360}">${esc(m.name.split(' ').map(x => x[0]).join(''))}</span><div><b>${esc(m.name)}</b><small>${esc(ROLES[m.role].t)}${m.cofounder ? ' · співзасновник' : m.intern ? ' · стажист' : ''}</small></div>${stars(m.skill)}</div>
    <div class="mb-r"><span>Зарплата</span><b>${money(m.salary)}/міс</b></div>
    <div class="mb-r m"><span>Мораль</span>${meter(m.morale / 100, { color: m.morale < 35 ? 'var(--bad)' : m.morale < 55 ? 'var(--warn)' : 'var(--ok)', label: 'Мораль' })}<b>${Math.round(m.morale)}</b></div>
    <p class="sm muted">${esc(TRAITS[m.trait]?.t || '')}</p>
    ${m.cofounder || m.intern ? '' : `<div class="row gap"><button class="btn sm" data-act="raise" data-id="${m.id}">Підвищити на 10%</button><button class="btn sm ghost danger" data-act="fire" data-id="${m.id}">Звільнити</button></div>`}</article>`;
  const cand = c => `<article class="member cand">
    <div class="mb-h"><span class="av" style="--h:${(c.name.charCodeAt(0) * 37) % 360}">${esc(c.name.split(' ').map(x => x[0]).join(''))}</span><div><b>${esc(c.name)}</b><small>${esc(ROLES[c.role].t)}</small></div></div>
    <div class="mb-skill"><span>Навички</span>${c.seen ? stars(c.skill) : `<span class="chip sm">від ${c.lo} до ${c.hi} з 5</span>`}</div>
    <div class="mb-r"><span>Хоче</span><b>${money(c.ask)}/міс</b></div>
    <div class="mb-r"><span>Ринкова зарплата</span><b>${money(S.marketSalary(c.role, c.seen ? c.skill : Math.round((c.lo + c.hi) / 2)))}</b></div>
    <p class="sm muted">${c.seen ? esc(TRAITS[c.trait].t) : 'Характер і реальні навички стануть зрозумілі на співбесіді.'}</p>
    <div class="row gap">${c.seen ? '' : `<button class="btn sm" data-act="meet" data-id="${c.id}">${icon('mic', 14)} Співбесіда</button>`}<button class="btn sm primary" data-act="offer" data-id="${c.id}">Запропонувати</button></div></article>`;
  return `<div class="kpis"><div class="kpi"><span class="kpi-l">Команда</span><b>${s.team.length + 1} ${plural(s.team.length + 1, 'людина', 'людини', 'людей')}</b><small>з вами</small></div><div class="kpi"><span class="kpi-l">Зарплати на місяць</span><b>${money(pay)}</b></div><div class="kpi"><span class="kpi-l">Середня мораль</span><b>${s.team.length ? Math.round(sum(s.team.map(m => m.morale)) / s.team.length) : '—'}</b></div><div class="kpi"><span class="kpi-l">Понаднормова робота</span><b>${s.crunch ? 'так' : 'ні'}</b><small>${s.crunch ? '+25% швидкості, мораль падає' : 'нормальний темп'}</small></div></div>
  <section class="card"><header class="card-h"><h3>${icon('users')} Команда</h3>${s.team.length ? `<label class="switch"><input type="checkbox" data-in="crunch" ${s.crunch ? 'checked' : ''}><span></span>Понаднормово</label>` : ''}</header>
    <div class="members">${s.team.map(member).join('') || '<p class="empty">Поки ви працюєте самі. Наймайте, коли зрозумієте, що саме гальмує ріст, і коли гроші на зарплату є хоча б на пів року.</p>'}</div></section>
  <section class="card"><header class="card-h"><h3>${icon('search')} Кандидати</h3><span class="muted sm">оновлюються раз на 4 тижні · співбесід цього тижня: ${3 - (s.flags.meets || 0)}</span></header>
    <div class="members">${s.candidates.map(cand).join('') || '<p class="empty">Нових кандидатів поки немає</p>'}</div>
    <p class="sm muted">Порада: замість частини зарплати можна запропонувати частку компанії (опціон). Амбітні люди це цінують, але ваша частка зменшиться.</p></section>`;
}
function offerModal(C, id) {
  const S = C.S, c = S.s.candidates.find(x => x.id === id); if (!c) return;
  let sal = c.ask, eq = 0;
  const draw = api => {
    const p = S.acceptChance(c, sal, eq / 100);
    api.set(`<p><b>${esc(c.name)}</b>, ${esc(ROLES[c.role].t.toLowerCase())}. Хоче ${money(c.ask)} на місяць.</p>
      <div class="sl"><label>Зарплата</label><input type="range" min="${Math.round(c.ask * .5 / 1000) * 1000}" max="${Math.round(c.ask * 1.5 / 1000) * 1000}" step="1000" value="${sal}" data-o="sal"><output>${money(sal)}/міс</output></div>
      <div class="sl"><label>Частка компанії</label><input type="range" min="0" max="5" step=".5" value="${eq}" data-o="eq"><output>${String(eq).replace('.', ',')}%</output></div>
      <p class="sm muted">${eq ? `Це ≈ ${money(S.valuation() * eq / 100)} за поточною оцінкою. Ваша частка зменшиться з ${pct(S.stake(), 1)} до ${pct(S.stake() * (1 - eq / 100), 1)}.` : 'Без частки в компанії.'}</p>
      <div class="accept"><span>Імовірність, що погодиться</span>${meter(p, { color: p > .7 ? 'var(--ok)' : p > .4 ? 'var(--warn)' : 'var(--bad)' })}<b>${pct(p)}</b></div>
      <p class="sm muted">Зарплатний фонд після найму: ${money(sum(S.s.team.map(m => m.salary)) + sal)}/міс.</p>
      <div class="row end gap"><button class="btn" data-md-close>Скасувати</button><button class="btn primary" data-o="go">Надіслати пропозицію</button></div>`);
  };
  modal({ title: 'Пропозиція роботи', html: '', onOpen: api => {
    draw(api);
    api.el.addEventListener('input', e => { const k = e.target.dataset.o; if (k === 'sal') sal = +e.target.value; if (k === 'eq') eq = +e.target.value; draw(api); api.el.querySelector(`[data-o="${k}"]`)?.focus(); });
    api.el.addEventListener('click', e => { if (e.target.closest('[data-o="go"]')) { const r = S.hire(id, sal, eq / 100); api.close(); C.toast(r.ok ? `${r.m.name} у команді!` : r.refused ? `${r.name} ${r.fem ? 'відмовилася' : 'відмовився'}: умови не влаштували` : 'Кандидат уже недоступний', r.ok ? 'good' : 'bad'); C.render(); C.topbar(); } });
  } });
}

/* ═════════ Фриланс ═════════ */
function freelance(S, ui) {
  const s = S.s, tab = ui.flTab || 'order', task = ui.flTask;
  const head = `<div class="tabs" role="tablist"><button role="tab" aria-selected="${tab === 'order'}" class="${tab === 'order' ? 'on' : ''}" data-act="flTab" data-k="order">${icon('users', 16)} Замовити роботу</button><button role="tab" aria-selected="${tab === 'earn'}" class="${tab === 'earn' ? 'on' : ''}" data-act="flTab" data-k="earn">${icon('coins', 16)} Заробити самому</button></div>`;
  if (tab === 'order') {
    const list = task ? S.freelancers(task) : [];
    const stat = { work: 'у роботі', done: 'готово', weak: 'слабкий результат', refund: 'гроші повернуто', lost: 'гроші втрачено' };
    return `${head}<p class="lead">Фрилансери — це спосіб отримати разову роботу без найму людини на зарплату. Рейтинг і відгуки допомагають вибрати, а безпечна угода захищає гроші.</p>
    <div class="tasks">${Object.entries(TASKS).map(([k, T]) => `<button class="task ${task === k ? 'on' : ''}" data-act="flTask" data-k="${k}"><b>${esc(T.t)}</b><small>${esc(T.desc)}</small><span>від ${money(T.base * .3)}</span></button>`).join('')}</div>
    ${task ? `<section class="card"><header class="card-h"><h3>Пропозиції: ${esc(TASKS[task].t.toLowerCase())}</h3></header>
      <label class="switch"><input type="checkbox" data-in="escrow" ${ui.escrow !== false ? 'checked' : ''}><span></span>Безпечна угода (+8%): біржа тримає гроші, доки ви не приймете роботу</label>
      <div class="fl-list">${list.map(f => `<div class="fl"><span class="av" style="--h:${(f.name.charCodeAt(0) * 37) % 360}">${esc(f.name.split(' ').map(x => x[0]).join(''))}</span><div><b>${esc(f.name)}</b><small>${f.rating ? `${icon('star', 12)} ${String(f.rating).replace('.', ',')} · ${f.reviews} ${plural(f.reviews, 'відгук', 'відгуки', 'відгуків')}` : 'новачок, без відгуків'}</small></div><div><b>${money(f.price)}</b><small>${f.weeks} ${plural(f.weeks, 'тиждень', 'тижні', 'тижнів')}</small></div><button class="btn sm primary" data-act="flOrder" data-id="${f.id}">Замовити</button></div>`).join('')}</div>
      <p class="sm muted">Підозріло дешево й без відгуків? Буває, що такі «виконавці» беруть передоплату й зникають.</p></section>` : ''}
    ${s.orders.length ? `<section class="card"><header class="card-h"><h3>Мої замовлення</h3></header><table class="tbl"><thead><tr><th>Робота</th><th>Виконавець</th><th>Ціна</th><th>Статус</th><th>Якість</th></tr></thead><tbody>${s.orders.slice().reverse().map(o => `<tr><td>${esc(TASKS[o.task].t)}</td><td>${esc(o.who)}${o.escrow ? ' <span class="chip sm">безпечна угода</span>' : ''}</td><td>${money(o.price + o.fee)}</td><td>${stat[o.status]}${o.status === 'work' ? `, до тижня ${o.due + 1}` : ''}${o.status === 'weak' && o.escrow && !o.revised ? ` <button class="btn sm" data-act="revise" data-id="${o.id}">Доопрацювати</button>` : ''}</td><td>${o.status === 'done' || o.status === 'weak' ? pct(o.q) : '—'}</td></tr>`).join('')}</tbody></table></section>` : ''}`;
  }
  return `${head}<p class="lead">Коли гроші закінчуються, засновники часто беруть фриланс-замовлення. Це рятує касу, але забирає час від стартапу. Години на фриланс — у плані тижня (зараз ${s.hours.freelance} год).</p>
    <div class="kpis"><div class="kpi"><span class="kpi-l">Рейтинг</span><b>${s.gigsDone ? s.rating.toFixed(1).replace('.', ',') : '—'}</b><small>${s.gigsDone} ${plural(s.gigsDone, 'замовлення', 'замовлення', 'замовлень')}</small></div><div class="kpi"><span class="kpi-l">Зароблено</span><b>${money(s.gigIncome)}</b></div><div class="kpi ${s.hours.freelance ? '' : 'warn'}"><span class="kpi-l">Годин на фриланс</span><b>${s.hours.freelance}</b><small><button class="link" data-act="go" data-to="dash">змінити на головній</button></small></div></div>
    ${s.myGigs.length ? `<section class="card"><header class="card-h"><h3>У роботі</h3></header>${s.myGigs.map(g => `<div class="gig"><div><b>${esc(g.t)}</b><small>${esc(g.client)} · ${{ prepay: 'передоплата 50%', escrow: 'через безпечну угоду', none: 'без передоплати' }[g.terms]} · дедлайн: тиждень ${g.deadline + 1}</small></div>${meter(g.done / g.hours)}<b>${g.done} / ${g.hours} год</b></div>`).join('')}</section>` : ''}
    <section class="card"><header class="card-h"><h3>Замовлення на біржі</h3><span class="muted sm">можна вести 2 одночасно</span></header>
      <div class="sl"><label>Умови оплати</label><select class="inp" data-in="gigTerms"><option value="prepay" ${ui.gigTerms === 'prepay' || !ui.gigTerms ? 'selected' : ''}>Передоплата 50%</option><option value="escrow" ${ui.gigTerms === 'escrow' ? 'selected' : ''}>Безпечна угода (біржа бере 10%)</option><option value="none" ${ui.gigTerms === 'none' ? 'selected' : ''}>Без передоплати — оплата після роботи</option></select></div>
      ${s.gigs.map(g => `<div class="gig"><div><b>${esc(g.t)}</b><small>${esc(g.client)} · ≈ ${g.hours} год роботи</small></div><b>${money(g.pay)}</b><button class="btn sm primary" data-act="takeGig" data-id="${g.id}" ${s.myGigs.length >= 2 ? 'disabled' : ''}>Взяти</button></div>`).join('') || '<p class="empty">Нові замовлення з\'являться за тиждень</p>'}</section>`;
}

export const peopleViews = {
  team: { t: 'Команда', icon: 'user', render: team },
  freelance: { t: 'Підробіток', icon: 'laptop', render: freelance },
};
export const peopleActs = {
  meet: (C, el) => { const c = C.S.meet(el.dataset.id); if (!c) C.toast('Цього тижня більше немає часу на співбесіди', 'bad'); C.render(); },
  offer: (C, el) => offerModal(C, el.dataset.id),
  raise: (C, el) => { const m = C.S.s.team.find(x => x.id === el.dataset.id); C.S.raise(m.id, m.salary * 1.1); C.toast(`${m.name}: зарплату підвищено`, 'good'); C.render(); },
  fire: async (C, el) => { const m = C.S.s.team.find(x => x.id === el.dataset.id); if (!await confirmBox(`Звільнити ${m.name}?`, 'Звільнити', { danger: true, sub: `Вихідна допомога — місячна зарплата (${money(m.salary)}). Мораль решти команди впаде.` })) return; C.S.fire(m.id); C.render(); C.topbar(); },
  flTab: (C, el) => { C.ui.flTab = el.dataset.k; C.render(); },
  flTask: (C, el) => { C.ui.flTask = el.dataset.k; C.render(); },
  flOrder: (C, el) => { const ok = C.S.order(C.ui.flTask, el.dataset.id, C.ui.escrow !== false); C.toast(ok ? 'Замовлення оформлено' : 'Не вистачає грошей', ok ? 'good' : 'bad'); C.render(); C.topbar(); },
  revise: (C, el) => { if (C.S.revise(el.dataset.id)) C.toast('Відправлено на доопрацювання', 'good'); C.render(); },
  takeGig: (C, el) => { const ok = C.S.takeGig(el.dataset.id, C.ui.gigTerms || 'prepay'); C.toast(ok ? 'Замовлення взято. Не забудьте години на фриланс у плані тижня!' : 'Можна вести лише 2 замовлення', ok ? 'good' : 'bad'); C.render(); C.topbar(); },
};
export const peopleIns = {
  escrow: (C, el) => { C.ui.escrow = el.checked; },
  gigTerms: (C, el) => { C.ui.gigTerms = el.value; },
};
