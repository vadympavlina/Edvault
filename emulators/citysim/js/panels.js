// Симулятор міста · панелі праворуч: огляд, бюджет, графіки, лабораторія даних, радники, жителі, рішення, політики, місія, звіт, довідник.
import { N, Z, B, POLICIES, ADVISORS, SCENARIOS, ZONES, START_YEAR } from './data.js';
import { money, num, pct, plural, monthText, dateText, sum } from './sim.js';
import { streetOf } from './people.js';
import { LAYERS } from './render.js';
import { esc, icon, nl2br, face } from './ui.js';
import { lineChart, bars, scatter, corrWords } from './charts.js';

const NN = N * N;
const meter = (v, color = 'var(--acc)') => `<span class="meter"><i style="width:${Math.max(0, Math.min(100, v * 100))}%;background:${color}"></i></span>`;
const kpi = (label, val, sub = '', cls = '') => `<div class="kpi ${cls}"><span>${label}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
const labels = h => h.map(x => `${String((x.m % 12) + 1).padStart(2, '0')}.${String(START_YEAR + Math.floor(x.m / 12)).slice(2)}`);
const goodBad = (v, good, bad) => v <= good ? 'ok' : v >= bad ? 'bad' : 'warn';

/* ═════════ Проблеми міста (для огляду й радників) ═════════ */
export function issues(C) {
  const M = C.m, s = C.s, out = [];
  if (M.blackoutShare > 0.02) out.push({ k: 'power', lvl: 3, t: `Без світла ${pct(M.blackoutShare)} жителів`, d: 'Потрібно більше електростанцій біля доріг, з’єднаних із районами.', layer: 'power', adv: 'energy' });
  if (M.aqi > 25) out.push({ k: 'aqi', lvl: M.aqi > 35 ? 3 : 2, t: `Брудне повітря: ${Math.round(M.aqi)} зі 100`, d: 'Заводи, вугільні станції й машини поруч із домівками.', layer: 'poll', adv: 'eco' });
  if (M.avgCong > 0.6) out.push({ k: 'jam', lvl: M.avgCong > 0.9 ? 3 : 2, t: `Затори: дороги завантажені на ${pct(M.avgCong)}`, d: `Дорога на роботу — в середньому ${Math.round(M.avgCommute)} хв.`, layer: 'traffic', adv: 'traffic' });
  if (M.unemp > 0.1 && M.P > 300) out.push({ k: 'unemp', lvl: M.unemp > 0.2 ? 3 : 2, t: `Безробіття ${pct(M.unemp)}`, d: 'Бракує робочих місць або до них не доїхати.', adv: 'money' });
  if (M.crimeAvg > 32) out.push({ k: 'crime', lvl: M.crimeAvg > 45 ? 3 : 2, t: `Злочинність ${Math.round(M.crimeAvg)}`, d: 'Мало поліції там, де живе багато людей.', layer: 'crime', adv: 'safety' });
  if (s.flags.garbage) out.push({ k: 'garbage', lvl: 2, t: 'Сміття не вивозять', d: 'Потрібне звалище або сортувальна станція.', adv: 'eco' });
  const last = s.history.at(-1); if (last && last.balance < 0) out.push({ k: 'budget', lvl: s.money < 0 ? 3 : 1, t: `Бюджет у мінусі: ${money(last.balance)} за місяць`, d: 'Витрати більші за доходи.', adv: 'money' });
  let noSchool = 0, w = 0; for (let i = 0; i < NN; i++) if (M.pop[i]) { w += M.pop[i]; if (M.cov.school[i] < 0.3) noSchool += M.pop[i]; }
  if (w > 400 && noSchool / w > 0.3) out.push({ k: 'school', lvl: 2, t: `${pct(noSchool / w)} жителів далеко від школи`, d: 'Сім’ї з дітьми не переїжджатимуть.', layer: 'school', adv: 'edu' });
  const unpoweredB = Object.values(s.bld).filter(b => b._road < 0 && B[b.type].cat !== 'eco' && !B[b.type].onRoad && b.type !== 'townhall').length;
  if (unpoweredB) out.push({ k: 'noroad', lvl: 2, t: `${unpoweredB} ${plural(unpoweredB, 'будівля стоїть', 'будівлі стоять', 'будівель стоять')} без дороги`, d: 'Без дороги будівля не працює: немає світла, працівників і відвідувачів.' });
  return out.sort((a, b) => b.lvl - a.lvl);
}

/* ═════════ Огляд ═════════ */
function overview(C) {
  const s = C.s, M = C.m, h = s.history, last = h.at(-1), prev = h.at(-2), d = s.demand;
  const dl = (v, p, f = num) => p == null ? '' : `<em class="${v - p >= 0 ? 'up' : 'down'}">${v - p >= 0 ? '▲' : '▼'} ${f(Math.abs(v - p))}</em>`;
  const iss = issues(C);
  const dem = (k, t, col) => `<div class="dem"><span>${t}</span><span class="dbar"><i style="${d[k] >= 0 ? `left:50%;width:${d[k] * 50}%` : `left:${50 + d[k] * 50}%;width:${-d[k] * 50}%`};background:${col}"></i></span><b>${d[k] > 0.15 ? 'хочуть' : d[k] < -0.15 ? 'забагато' : 'норма'}</b></div>`;
  return `<div class="kpis">
    ${kpi('Жителі', num(M.P), dl(last?.pop ?? M.P, prev?.pop))}
    ${kpi('У казні', money(s.money), last ? `${last.balance >= 0 ? '+' : '−'}${money(Math.abs(last.balance)).replace('−', '')} за місяць` : '', s.money < 0 ? 'bad' : '')}
    ${kpi('Підтримка мера', pct(s.approval / 100), s.approval >= 60 ? 'вам довіряють' : s.approval >= 45 ? 'так собі' : 'невдоволені', s.approval < 45 ? 'bad' : s.approval < 55 ? 'warn' : 'ok')}
    ${kpi('Щастя', Math.round(M.happyAvg), 'зі 100', M.happyAvg < 45 ? 'bad' : '')}
    ${kpi('Повітря', Math.round(M.aqi), 'забруднення біля домівок', goodBad(M.aqi, 15, 30))}
    ${kpi('Затори', pct(M.avgCong), `${Math.round(M.avgCommute)} хв на роботу`, goodBad(M.avgCong, 0.5, 0.85))}
    ${kpi('Безробіття', pct(M.unemp), `${num(M.jobs)} робочих місць`, goodBad(M.unemp, 0.06, 0.15))}
    ${kpi('Енергія', `${num(M.supply)} / ${num(M.demand)} МВт`, M.supply >= M.demand ? 'вистачає' : 'не вистачає!', M.supply >= M.demand ? 'ok' : 'bad')}
    ${kpi('Вища освіта', pct(s.edu.high), 'серед дорослих', '')}
    ${kpi('CO₂', `${num((last?.co2 ?? C.co2()) / 1000)} тис. т`, 'на місяць', '')}
  </div>
  <section class="card"><h3>${icon('zone')} Попит: що хочуть люди й бізнес</h3>${dem('r', 'Житло', '#22c55e')}${dem('c', 'Магазини й офіси', '#3b82f6')}${dem('i', 'Заводи', '#eab308')}
    <p class="sm muted">Зонуйте те, чого хочуть. Попит росте, коли в місті є робота, покупці, освічені люди й помірні податки.</p></section>
  <section class="card"><h3>${icon('alert')} Що зараз найважливіше</h3>${iss.length ? `<ul class="issues">${iss.map(x => `<li class="l${x.lvl}"><div><b>${esc(x.t)}</b><small>${esc(x.d)}</small></div>${x.layer ? `<button class="btn sm" data-act="layer" data-k="${x.layer}">${icon('layers', 14)} Показати</button>` : ''}</li>`).join('')}</ul>` : '<p class="ok-line">Серйозних проблем немає. Так тримати!</p>'}</section>
  <section class="card"><h3>${icon('chart')} Населення й гроші</h3>${lineChart([{ v: h.map(x => x.pop), color: '#22c55e', label: 'Жителі', area: true }], { labels: labels(h) })}${lineChart([{ v: h.map(x => x.money), color: '#6366f1', label: 'Гроші в казні', area: true }], { labels: labels(h), zero: false })}</section>`;
}

/* ═════════ Бюджет ═════════ */
const FUNDS = [['edu', 'Освіта', 'book'], ['health', 'Медицина', 'heart'], ['police', 'Поліція', 'shield'], ['fire', 'Пожежники', 'alert'], ['transit', 'Транспорт', 'bus'], ['park', 'Парки', 'leaf']];
function budget(C) {
  const s = C.s, h = s.history, last = h.at(-1);
  const tax = (k, t, z) => `<div class="sl"><label>${t}</label><input type="range" min="0" max="20" value="${s.taxes[k]}" data-in="tax" data-k="${k}" aria-label="Податок: ${t}"><output data-out="tax-${k}">${s.taxes[k]}%</output></div>`;
  const fund = ([k, t, ic]) => `<div class="sl"><label>${icon(ic, 15)} ${t}</label><input type="range" min="0" max="150" step="10" value="${s.funding[k]}" data-in="fund" data-k="${k}" aria-label="Фінансування: ${t}"><output data-out="fund-${k}">${s.funding[k]}%</output></div>`;
  const inc = last?.inc || {}, exp = last?.exp || {};
  return `<div class="kpis">${kpi('У казні', money(s.money), '', s.money < 0 ? 'bad' : '')}${kpi('Доходи', money(last?.income || 0), 'минулого місяця', 'ok')}${kpi('Витрати', money(last?.expense || 0), 'минулого місяця')}${kpi('Баланс', money(last?.balance || 0, true), 'за місяць', (last?.balance || 0) < 0 ? 'bad' : 'ok')}</div>
  <section class="card"><h3>${icon('coins')} Податки</h3>${tax('r', 'Житло (з жителів)')}${tax('c', 'Магазини й офіси')}${tax('i', 'Заводи')}
    <p class="sm muted">Вищі податки — більше грошей, але менше охочих жити й працювати в місті, а жителі незадоволені. Звична ставка — 8–10%.</p></section>
  <section class="card"><h3>${icon('scroll')} Фінансування служб</h3>${FUNDS.map(fund).join('')}<p class="sm muted">Менше 100% — економія, але школи, лікарні й поліція працюють гірше. Понад 100% — краща якість, але дорожче.</p></section>
  <section class="card"><h3>${icon('chart')} Звідки гроші й куди</h3><div class="two">
    <div><b class="sm">Доходи</b>${bars([{ label: 'Податок із жителів', v: inc.r || 0, color: '#22c55e' }, { label: 'Магазини й офіси', v: inc.c || 0, color: '#3b82f6' }, { label: 'Заводи', v: inc.i || 0, color: '#eab308' }, { label: 'Інше', v: inc.other || 0, color: '#a855f7' }], { fmt: money })}</div>
    <div><b class="sm">Витрати</b>${bars([{ label: 'Служби', v: exp.services || 0, color: '#ef4444' }, { label: 'Електростанції', v: exp.power || 0, color: '#f59e0b' }, { label: 'Дороги', v: exp.roads || 0, color: '#64748b' }, { label: 'Політики', v: exp.policies || 0, color: '#8b5cf6' }, { label: 'Кредити', v: exp.loans || 0, color: '#0ea5e9' }], { fmt: money })}</div></div>
    ${lineChart([{ v: h.map(x => x.income), color: '#16a34a', label: 'Доходи' }, { v: h.map(x => x.expense), color: '#dc2626', label: 'Витрати' }], { labels: labels(h) })}</section>
  <section class="card"><h3>${icon('bank')} Кредити</h3>
    ${s.loans.length ? `<ul class="loans">${s.loans.map((L, k) => `<li><span>${money(L.amt)} · ${money(L.pay)}/міс · лишилось ${L.left} міс.</span><button class="btn sm" data-act="repay" data-k="${k}">Погасити достроково</button></li>`).join('')}</ul>` : '<p class="sm muted">Кредитів немає.</p>'}
    <div class="row gap wrap"><button class="btn" data-act="loan" data-k="20000">Взяти 20 000</button><button class="btn" data-act="loan" data-k="50000">Взяти 50 000</button></div>
    <p class="sm muted">Кредит на 5 років під 9% річних. Повертати доведеться більше, ніж узяли.</p></section>`;
}

/* ═════════ Графіки ═════════ */
export const SERIES = {
  pop: { t: 'Населення', f: x => x.pop, c: '#22c55e' }, money: { t: 'Гроші в казні', f: x => x.money, c: '#6366f1', zero: false }, balance: { t: 'Баланс за місяць', f: x => x.balance, c: '#0ea5e9', zero: false },
  happy: { t: 'Щастя', f: x => x.happy, c: '#f59e0b' }, approval: { t: 'Підтримка мера', f: x => x.approval, c: '#ec4899' }, aqi: { t: 'Забруднення повітря', f: x => x.aqi, c: '#78716c' },
  co2: { t: 'Викиди CO₂, т', f: x => x.co2, c: '#475569' }, cong: { t: 'Завантаженість доріг, %', f: x => x.cong * 100, c: '#f97316' }, commute: { t: 'Час на роботу, хв', f: x => x.commute, c: '#ea580c' },
  transit: { t: 'Їздять автобусом/велосипедом, %', f: x => x.transit * 100, c: '#eab308' }, unemp: { t: 'Безробіття, %', f: x => x.unemp * 100, c: '#dc2626' }, crime: { t: 'Злочинність', f: x => x.crime, c: '#7f1d1d' },
  eduH: { t: 'Вища освіта, %', f: x => x.eduH * 100, c: '#4f46e5' }, power: { t: 'Енергія: вироблено, МВт', f: x => x.power, c: '#facc15' }, demandP: { t: 'Енергія: потрібно, МВт', f: x => x.demandP, c: '#f97316' }, green: { t: 'Чиста енергія, %', f: x => x.green * 100, c: '#16a34a' },
};
function charts(C, ui) {
  const h = C.s.history, sel = ui.charts ||= ['pop', 'happy'];
  return `<p class="lead">Оберіть до трьох показників — і подивіться, як вони змінюються разом. Так видно наслідки рішень: побудували автобуси — чи впали затори?</p>
  <div class="chips">${Object.entries(SERIES).map(([k, x]) => `<button class="chip ${sel.includes(k) ? 'on' : ''}" data-act="series" data-k="${k}"><i style="background:${x.c}"></i>${esc(x.t)}</button>`).join('')}</div>
  ${sel.map(k => `<section class="card"><h3>${esc(SERIES[k].t)}</h3>${lineChart([{ v: h.map(SERIES[k].f), color: SERIES[k].c, label: SERIES[k].t, area: true }], { labels: labels(h), zero: SERIES[k].zero !== false })}</section>`).join('')}
  ${sel.length >= 2 && h.length > 3 ? (() => { const r = scatter(h.map(x => ({ x: SERIES[sel[0]].f(x), y: SERIES[sel[1]].f(x) })).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).map(p => ({ x: Math.max(0, p.x), y: Math.max(0, p.y) })), { xl: SERIES[sel[0]].t, yl: SERIES[sel[1]].t }); return r.svg ? `<section class="card"><h3>Як пов’язані «${esc(SERIES[sel[0]].t)}» і «${esc(SERIES[sel[1]].t)}» у часі</h3>${r.svg}<p class="corr">Кореляція r = <b>${r.r.toFixed(2).replace('.', ',')}</b>. ${corrWords(r.r)}</p></section>` : ''; })() : ''}`;
}

/* ═════════ Лабораторія даних: зв’язки між показниками в різних районах ═════════ */
export const TILEM = {
  poll: { t: 'Забруднення', f: (M, i) => M.poll[i], max: 100 }, lv: { t: 'Вартість землі', f: (M, i) => M.lv[i], max: 100 }, happy: { t: 'Щастя', f: (M, i) => M.happy[i], max: 100 },
  crime: { t: 'Злочинність', f: (M, i) => M.crime[i], max: 100 }, commute: { t: 'Час на роботу, хв', f: (M, i) => M.commute[i] }, school: { t: 'Близькість школи', f: (M, i) => M.cov.school[i] * 100, max: 100 },
  park: { t: 'Близькість парку', f: (M, i) => M.cov.park[i] * 100, max: 100 }, police: { t: 'Близькість поліції', f: (M, i) => M.cov.police[i] * 100, max: 100 }, transit: { t: 'Доступність транспорту', f: (M, i) => M.transit[i] * 100, max: 75 },
  pop: { t: 'Щільність населення', f: (M, i) => M.pop[i] }, dist: { t: 'Відстань до центру', f: (M, i, C) => Math.hypot(i % N - C.m.center[0], ((i / N) | 0) - C.m.center[1]) },
};
const HYP = [['poll', 'happy', 'Чи сумніші люди там, де брудне повітря?'], ['park', 'lv', 'Чи дорожча земля біля парків?'], ['police', 'crime', 'Чи менше злочинів біля поліції?'], ['dist', 'commute', 'Чи довше їхати на роботу з околиць?'], ['transit', 'happy', 'Чи щасливіші люди біля зупинок?'], ['poll', 'lv', 'Чи дешевша земля біля заводів?']];
function lab(C, ui) {
  const M = C.m, X = ui.labX || 'poll', Y = ui.labY || 'happy', pts = [];
  for (let i = 0; i < NN; i++) if (M.pop[i]) pts.push({ x: Math.max(0, TILEM[X].f(M, i, C)), y: Math.max(0, TILEM[Y].f(M, i, C)), w: M.pop[i] });
  const r = scatter(pts, { xl: TILEM[X].t, yl: TILEM[Y].t, xmax: TILEM[X].max, ymax: TILEM[Y].max });
  const sel = (k, cur) => `<select class="inp" data-in="${k}" aria-label="${k === 'labX' ? 'Показник по горизонталі' : 'Показник по вертикалі'}">${Object.entries(TILEM).map(([id, x]) => `<option value="${id}" ${id === cur ? 'selected' : ''}>${esc(x.t)}</option>`).join('')}</select>`;
  return `<p class="lead">Кожна точка — житловий квартал. Перевірте гіпотезу: чи пов’язані два показники? Лінія тренду й коефіцієнт кореляції <b>r</b> (від −1 до 1) покажуть силу зв’язку.</p>
  <div class="hyp">${HYP.map(([a, b, t]) => `<button class="chip ${a === X && b === Y ? 'on' : ''}" data-act="hyp" data-x="${a}" data-y="${b}">${esc(t)}</button>`).join('')}</div>
  <div class="row gap wrap lab-sel"><label>По горизонталі ${sel('labX', X)}</label><label>По вертикалі ${sel('labY', Y)}</label></div>
  <section class="card">${r.svg ? r.svg + `<p class="corr">r = <b>${r.r.toFixed(2).replace('.', ',')}</b> · кварталів: ${pts.length}. ${corrWords(r.r)}</p>` : r}</section>
  <section class="card tip"><h3>${icon('info')} Важливо пам’ятати</h3><p>Кореляція — ще не причина. Якщо люди біля парків щасливіші, можливо, причина не в парку, а в тому, що там і школа поруч, і заводів немає. Перевірте: збудуйте парк у новому районі й подивіться, чи зміниться щастя саме там.</p></section>`;
}

/* ═════════ Радники ═════════ */
function advisors(C) {
  const s = C.s, M = C.m, iss = issues(C);
  const grade = { money: s.history.at(-1)?.balance >= 0 && s.money > 0 ? 'ok' : s.money < 0 ? 'bad' : 'warn', traffic: goodBad(M.avgCong, 0.5, 0.85), eco: goodBad(M.aqi, 15, 30), energy: M.supply >= M.demand * 1.1 ? 'ok' : M.supply >= M.demand ? 'warn' : 'bad', edu: s.edu.high > 0.25 ? 'ok' : s.edu.high > 0.12 ? 'warn' : 'bad', safety: goodBad(M.crimeAvg, 22, 40) };
  const watch = { money: `Баланс минулого місяця — ${money(s.history.at(-1)?.balance || 0)}. Стежте, щоб доходи покривали витрати.`, traffic: `Дороги завантажені на ${pct(M.avgCong)}, дорога на роботу — ${Math.round(M.avgCommute)} хв. Автобуси й проспекти розвантажать вулиці.`, eco: `Забруднення біля домівок — ${Math.round(M.aqi)} зі 100. Поки терпимо, але дерева й чиста енергія зроблять повітря кращим.`, energy: `Запас енергії малий: ${num(M.supply)} МВт на ${num(M.demand)} МВт потреби. Подбайте про нову станцію заздалегідь.`, edu: `Вищу освіту мають ${pct(s.edu.high)} дорослих. Ліцей, університет і бібліотеки піднімуть цей показник.`, safety: `Злочинність — ${Math.round(M.crimeAvg)}. Поліція та робота для всіх її зменшують.` };
  return `<p class="lead">Радники дивляться на дані й підказують. Але рішення — ваші.</p>${Object.entries(ADVISORS).map(([k, A]) => {
    const say0 = s.inbox.find(m => m.adv === k), say = say0 && grade[k] !== 'ok' && s.month - say0.m <= 2 ? say0 : null, my = iss.filter(x => x.adv === k);
    return `<article class="adv ${grade[k]}"><header>${face(A.who.length * 7 + k.length, { fem: /а$|я$/.test(A.who.split(' ')[0]), age: 40, mood: grade[k] === 'ok' ? 75 : grade[k] === 'warn' ? 50 : 30, size: 44 })}<div><b>${esc(A.who)}</b><small>${icon(A.icon, 13)} ${esc(A.t)}</small></div><span class="dot ${grade[k]}"></span></header>
      <p>${my.length ? esc(my[0].t + '. ' + my[0].d) : say ? esc(say.body.split('\n')[0]) : grade[k] === 'ok' ? 'Усе під контролем. Продовжуйте в тому ж дусі.' : esc(watch[k])}</p>${my[0]?.layer ? `<button class="btn sm" data-act="layer" data-k="${my[0].layer}">${icon('layers', 14)} Показати на карті</button>` : ''}</article>`;
  }).join('')}`;
}

/* ═════════ Жителі ═════════ */
function people(C, ui) {
  const s = C.s, M = C.m, f = ui.peopleF || 'all';
  const list = s.news.filter(n => f === 'all' || (f === 'bad' ? n.bad : f === 'good' ? n.kind === 'voice' && !n.bad : n.kind === f));
  const hist = [0, 0, 0, 0, 0]; for (let i = 0; i < NN; i++) if (M.pop[i]) hist[Math.min(4, Math.floor(M.happy[i] / 20))] += M.pop[i];
  const tot = sum(hist) || 1;
  const fams = s.families.slice().sort((a, b) => a.mood - b.mood);
  const famById = id => s.families.find(x => x.id === id);
  return `<section class="card"><h3>${icon('smile')} Настрій міста</h3><div class="mood">${hist.map((v, k) => `<div><i style="height:${Math.max(3, v / tot * 100)}%;background:${['#dc2626', '#f97316', '#facc15', '#84cc16', '#16a34a'][k]}"></i><small>${['дуже сумні', 'сумні', 'так собі', 'добре', 'щасливі'][k]}</small></div>`).join('')}</div></section>
  <div class="chips">${[['all', 'Усе'], ['bad', 'Скарги'], ['good', 'Радіють'], ['arrive', 'Переїхали'], ['leave', 'Виїхали']].map(([k, t]) => `<button class="chip ${f === k ? 'on' : ''}" data-act="peopleF" data-k="${k}">${t}</button>`).join('')}</div>
  <ul class="feed-list">${list.slice(0, 50).map(n => { const fam = famById(n.fam), m0 = fam?.members.find(m => m.age >= 18) || fam?.members[0]; return `<li class="${n.bad ? 'bad' : ''}">${n.kind === 'voice' || n.kind === 'arrive' || n.kind === 'leave' ? face(hashStr(n.who), { fem: n.f ?? m0?.f, age: m0?.age || 35, mood: n.bad ? 25 : 75, size: 38 }) : `<span class="sys">${icon(n.kind === 'weather' ? 'sun' : 'alert', 18)}</span>`}<div><b>${esc(n.who)}</b><small>${monthText(n.m)}${n.street ? ` · ${esc(n.street)}` : ''}</small><p>${esc(n.text)}</p></div>${n.i >= 0 ? `<button class="ib" data-act="goto" data-i="${n.i}" aria-label="Показати на карті">${icon('target', 16)}</button>` : ''}</li>`; }).join('') || '<li class="empty">Поки тихо. Заселіть місто — і жителі заговорять.</li>'}</ul>
  <section class="card"><h3>${icon('users')} Родини (${s.families.length})</h3><p class="sm muted">Найменш щасливі — зверху. Клацніть, щоб побачити дім на карті.</p>
    <div class="fams">${fams.slice(0, 24).map(fm => `<button class="fam" data-act="goto" data-i="${fm.i}">${face(hashStr(fm.last + fm.id), { fem: fm.members[0].f, age: fm.members[0].age, mood: fm.mood, size: 34 })}<span><b>${esc(fm.last)}</b><small>${fm.members.length} ${plural(fm.members.length, 'особа', 'особи', 'осіб')} · ${esc(streetOf(C, fm.i))}</small></span>${meter(fm.mood / 100, fm.mood < 40 ? 'var(--bad)' : fm.mood < 60 ? 'var(--warn)' : 'var(--ok)')}</button>`).join('')}</div></section>`;
}
export const hashStr = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 100003; return h; };

/* ═════════ Рішення (пошта з подіями) ═════════ */
function inbox(C, ui) {
  const s = C.s, cur = s.inbox.find(x => x.id === ui.mail) || s.inbox[0];
  if (cur && !cur.choices) cur.read = true;
  return `<div class="mail">${s.inbox.slice(0, 40).map(m => `<button class="mail-it ${m === cur ? 'on' : ''} ${m.read || (m.choices && m.chosen != null) ? '' : 'unread'}" data-act="mail" data-id="${m.id}"><b>${esc(m.from || ADVISORS[m.adv]?.who || 'Мерія')}</b><span>${esc(m.title)}</span><small>${monthText(m.m)}${m.choices && m.chosen == null ? ' · чекає рішення' : ''}</small></button>`).join('')}</div>
  ${cur ? `<article class="card letter"><small>${esc(cur.from || (ADVISORS[cur.adv] ? `${ADVISORS[cur.adv].who}, радник: ${ADVISORS[cur.adv].t.toLowerCase()}` : 'Мерія'))} · ${monthText(cur.m)}</small><h3>${esc(cur.title)}</h3><p>${nl2br(cur.body)}</p>
    ${cur.choices ? (cur.chosen == null ? `<div class="choices">${cur.choices.map((c, i) => `<button class="btn ${i === 0 ? 'primary' : ''}" data-act="choose" data-id="${cur.id}" data-i="${i}">${esc(c)}</button>`).join('')}</div>` : `<p class="note ${cur.chosen < 0 ? 'warn' : 'ok'}">${cur.chosen >= 0 ? `Ваше рішення: «${esc(cur.choices[cur.chosen])}». ` : ''}${esc(cur.result || '')}</p>`) : ''}</article>` : '<p class="empty">Листів немає</p>'}`;
}

/* ═════════ Політики ═════════ */
function policies(C) {
  const s = C.s;
  return `<p class="lead">Політики — правила для всього міста. Кожна має ціну й наслідки, часто не одразу.</p><div class="pols">${Object.entries(POLICIES).map(([k, P]) => `<article class="pol ${s.policies[k] ? 'on' : ''}"><div><b>${esc(P.t)}</b><p>${esc(P.desc)}</p><small>${esc(P.fx)}</small></div><div class="pol-r"><span class="${P.cost < 0 ? 'pos' : ''}">${P.cost < 0 ? '+' + money(-P.cost) : money(P.cost)}/міс</span><button class="sw ${s.policies[k] ? 'on' : ''}" role="switch" aria-checked="${!!s.policies[k]}" data-act="policy" data-k="${k}" aria-label="${esc(P.t)}"><i></i></button></div></article>`).join('')}</div>`;
}

/* ═════════ Місія ═════════ */
function mission(C) {
  const s = C.s, sc = SCENARIOS[s.scenario], m = C.metrics();
  const ach = Object.entries(s.ach);
  const ACH = { pop1k: 'Тисяча жителів', pop10k: 'Справжнє місто: 10 000', pop50k: 'Мегаполіс: 50 000', green: 'Посаджено 50 дерев', greenPower: 'Половина енергії — чиста', transit: '30% їздять без авто', smart: '30% із вищою освітою', budget: 'Рік без дефіциту', loved: 'Підтримка 80%', reelected: 'Переобрано мером', mission: 'Місію виконано', grant: 'Зелений грант' };
  const goals = C.goals(m);
  const left = sc.years ? sc.years * 12 - s.month : 0;
  return `<section class="card mission"><h3>${icon('target')} ${esc(sc.t)} <span class="chip sm">${esc(sc.diff)}</span></h3><p>${esc(sc.desc)}</p>
    ${sc.years ? `<p class="sm"><b>Лишилося: ${Math.floor(left / 12)} р. ${left % 12} міс.</b> (до ${dateText(sc.years * 12 - 1)})</p>${meter(s.month / (sc.years * 12), 'var(--acc)')}` : '<p class="sm muted">Вільна гра: жодних обмежень. Нижче — досягнення.</p>'}
    ${goals.length ? `<ul class="goals">${goals.map(g => `<li class="${g.ok ? 'ok' : ''}">${icon(g.ok ? 'check' : 'target', 16)}<span>${esc(g.t)}<small>зараз: ${fmtGoal(g)}</small></span></li>`).join('')}</ul>` : ''}</section>
  <section class="card"><h3>${icon('award')} Досягнення</h3><div class="achs">${Object.entries(ACH).map(([k, t]) => `<div class="ach ${s.ach[k] ? 'on' : ''}">${icon(s.ach[k] ? 'award' : 'flag', 16)}<span>${esc(t)}${s.ach[k] ? `<small>${monthText(s.ach[k] - 1)}</small>` : ''}</span></div>`).join('')}</div><p class="sm muted">${ach.length} з ${Object.keys(ACH).length}</p></section>`;
}
function fmtGoal(g) { return g.rel ? `${pct(g.val)} від початку` : ['congestion', 'transitShare', 'eduHigh', 'hightech'].includes(g.k) ? pct(g.val) : g.k === 'money' || g.k === 'balance' ? money(g.val) : Math.round(g.val * 10) / 10; }

/* ═════════ Звіт для викладача ═════════ */
export function report(C) {
  const s = C.s, sc = SCENARIOS[s.scenario], h = s.history, m = C.metrics(), first = h[0];
  const st = s.over ? { win: 'Місію виконано!', fail: 'Час місії вийшов', lost: 'Мер програв вибори' }[s.over.kind] : 'Гра триває';
  return `<div class="report"><header class="rp-h"><div><h2>${esc(s.name)}</h2><p>${esc(sc.t)} · ${dateText(0)} — ${dateText(s.month, s.day)} · ${esc(st)}</p>
    <p class="rp-who">Мер: <b>${esc(s.mayor.name || '—')}</b>${s.mayor.group ? ` · клас: <b>${esc(s.mayor.group)}</b>` : ''}</p></div>
    <div class="row gap no-print"><button class="btn" data-act="saveFile">${icon('save', 16)} Зберегти у файл</button><button class="btn" data-act="openFile">${icon('open', 16)} Відкрити</button><button class="btn" data-act="print">${icon('printer', 16)} Друк / PDF</button><button class="btn" data-act="newGame">${icon('plus', 16)} Нове місто</button></div></header>
  ${s.flags.editedFile ? `<p class="note bad">${icon('alert', 16)} Файл гри змінювали вручну після збереження: результати можуть не відповідати справжній грі.</p>` : ''}
  <div class="kpis">${kpi('Жителі', num(m.pop), first ? `було ${num(first.pop)}` : '')}${kpi('Казна', money(s.money))}${kpi('Підтримка', pct(s.approval / 100))}${kpi('Щастя', Math.round(m.happy))}${kpi('Повітря', Math.round(m.aqi), 'забруднення')}${kpi('Затори', pct(m.congestion))}${kpi('Безробіття', pct(m.unemp))}${kpi('Вища освіта', pct(m.eduHigh))}${kpi('Чиста енергія', pct(m.green))}${kpi('CO₂ / міс', num(m.co2) + ' т')}</div>
  ${C.goals().length ? `<section class="card"><h3>Цілі місії</h3><ul class="goals">${C.goals().map(g => `<li class="${g.ok ? 'ok' : ''}">${icon(g.ok ? 'check' : 'x', 16)}<span>${esc(g.t)}<small>результат: ${fmtGoal(g)}</small></span></li>`).join('')}</ul></section>` : ''}
  <div class="two">${['pop', 'money', 'happy', 'aqi', 'cong', 'eduH'].map(k => `<section class="card"><h3>${esc(SERIES[k].t)}</h3>${lineChart([{ v: h.map(SERIES[k].f), color: SERIES[k].c, area: true }], { labels: labels(h), h: 130, zero: SERIES[k].zero !== false })}</section>`).join('')}</div>
  <section class="card"><h3>Журнал рішень (${s.journal.length})</h3><ol class="journal">${s.journal.map(j => `<li><b>${monthText(j.m)}</b><span>${esc(j.t)}</span></li>`).join('')}</ol></section>
  <section class="card"><h3>Що казали жителі</h3><ul class="feed-list compact">${s.news.filter(n => n.kind === 'voice').slice(0, 12).map(n => `<li class="${n.bad ? 'bad' : ''}"><div><b>${esc(n.who)}</b><small>${monthText(n.m)}</small><p>${esc(n.text)}</p></div></li>`).join('') || '<li class="empty">—</li>'}</ul></section></div>`;
}

/* ═════════ Довідник ═════════ */
function help() {
  const q = (t, b) => `<details class="faq"><summary>${t}</summary><p>${b}</p></details>`;
  return `<section class="card"><h3>${icon('book')} Як грати</h3><ol class="steps">
    <li><b>Дороги.</b> Без дороги нічого не працює: ні будинки, ні станції. Тягніть мишкою, щоб прокласти.</li>
    <li><b>Зони.</b> Зелені — житло, сині — магазини й офіси, жовті — заводи. Будинки виростають самі, якщо є попит, дорога й світло.</li>
    <li><b>Енергія.</b> Станція має стояти біля дороги, з’єднаної з районами. Вугілля дешеве, але брудне; вітер і сонце — чисті.</li>
    <li><b>Служби.</b> Школи, лікарні, поліція, пожежники, парки — у радіусі дії. Наведіть будівлю, щоб побачити коло.</li>
    <li><b>Дані.</b> Кнопка «Шари» показує на карті забруднення, затори, вартість землі, щастя. «Лабораторія даних» — зв’язки між ними.</li>
    <li><b>Жителі.</b> Клацніть будинок — побачите родини, їхній настрій і думки. Скарги підкажуть, що виправити.</li>
    <li><b>Гроші.</b> Податки дають дохід, служби й станції — витрати. Слідкуйте за балансом у «Бюджеті».</li></ol>
    <p class="sm muted">Керування: перетягуйте карту мишкою (або правою кнопкою під час будівництва), коліщатко — масштаб, пробіл — пауза, Esc — скасувати інструмент, Ctrl+S — зберегти у файл.</p></section>
  <section class="card"><h3>${icon('lab')} Системне мислення</h3>
    ${q('Що таке зворотний зв’язок?', 'Коли наслідок впливає на причину. Наприклад: більше доріг → зручніше їздити авто → більше людей сідають за кермо → знову затори. Це підсилювальна петля. А балансувальна: високі податки → люди виїжджають → менше податків.')}
    ${q('Чому наслідки видно не одразу?', 'Освіта росте роками, будинки будуються місяцями, а забруднення накопичується. Такі затримки — головна причина помилок у керуванні складними системами.')}
    ${q('Що таке компроміс?', 'Майже кожне рішення щось покращує й щось погіршує. Завод дає роботу, але бруднить повітря. Безкоштовний проїзд зменшує затори, але коштує грошей.')}
    ${q('Кореляція чи причина?', 'Якщо два показники змінюються разом, це ще не означає, що один спричиняє інший. Можлива третя причина. Перевіряйте гіпотези експериментом.')}</section>
  <section class="card"><h3>${icon('users')} Для викладача</h3><ol class="steps">
    <li>Учень вказує ім’я та клас на старті. Наприкінці — «Зберегти у файл» (кнопка вгорі) і здає файл .json.</li>
    <li>Відкрийте файл кнопкою «Відкрити» або перетягніть на сторінку → «Відкрити звіт».</li>
    <li>Звіт: цілі місії, графіки, журнал усіх рішень із датами, голоси жителів. Можна надрукувати чи зберегти в PDF.</li>
    <li>Якщо файл змінювали вручну після збереження, симулятор попередить.</li>
    <li>Ідеї для уроку: дати класу одну місію й порівняти рішення; попросити учнів сформулювати гіпотезу в «Лабораторії даних» і перевірити її.</li></ol></section>`;
}

export const PANELS = {
  overview: { t: 'Огляд', icon: 'home', render: overview },
  budget: { t: 'Бюджет', icon: 'coins', render: budget },
  charts: { t: 'Графіки', icon: 'chart', render: charts },
  lab: { t: 'Лабораторія даних', icon: 'lab', render: lab },
  advisors: { t: 'Радники', icon: 'users', render: advisors },
  people: { t: 'Жителі', icon: 'smile', render: people },
  inbox: { t: 'Рішення', icon: 'mail', render: inbox },
  policies: { t: 'Політики', icon: 'scroll', render: policies },
  mission: { t: 'Місія', icon: 'target', render: mission },
  report: { t: 'Звіт', icon: 'award', render: report },
  help: { t: 'Довідник', icon: 'book', render: help },
};
export { LAYERS, meter };
