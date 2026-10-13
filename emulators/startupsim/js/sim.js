// Симулятор стартапу · рушій. Без DOM: працює і в браузері, і в тестах (node).
// Один хід — тиждень. Гравець планує тиждень (години засновника, бюджети, розробку), натискає
// «Завершити тиждень» — і рушій рахує воронку, гроші, команду, інвесторів, події.
import { IDEAS, CHANNELS, MODELS, BACKGROUNDS, ROLES, FIRST, LAST, FEM, TRAITS, INVESTORS, SLIDES, ACHIEVEMENTS } from './data.js';
import { applyMods, PROMOS, LOYALTY } from './mods.js';
import { makeCustomIdea } from './custom.js';

export const WEEKS = 104;
export const HOURS = 50;            // нормальний робочий тиждень засновника
export const MAX_HOURS = 75;
export const START_DATE = Date.UTC(2025, 8, 1); // понеділок, 1 вересня
export const W2M = 52 / 12;          // тижнів у місяці
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const sum = a => a.reduce((x, y) => x + y, 0);

/* ═════════ форматування ═════════ */
export const money = (n, sign = false) => {
  const s = sign && n > 0 ? '+' : n < 0 ? '−' : '', a = Math.abs(n);
  const v = a >= 1e6 ? (a / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.?0+$/, '').replace('.', ',') + ' млн' : a >= 1e4 ? Math.round(a / 1000) + ' тис.' : Math.round(a).toLocaleString('uk-UA').replace(/ /g, ' ');
  return `${s}${v} ₴`;
};
export const num = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '').replace('.', ',') + ' млн' : n >= 1e4 ? Math.round(n / 1e3) + ' тис.' : Math.round(n).toLocaleString('uk-UA').replace(/ /g, ' ');
export const pct = (x, d = 0) => (x * 100).toFixed(d).replace('.', ',') + '%';
export const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k >= 2 && k <= 4 ? b : c; };
const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
export const weekDate = w => new Date(START_DATE + w * 7 * 864e5);
export const dateText = w => { const d = weekDate(w); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

/* ═════════ випадковість із зерном (стан зберігається разом із грою) ═════════ */
export function rng(state) {
  const next = () => { let t = state.rs = (state.rs + 0x6D2B79F5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    next, int: n => Math.floor(next() * n), chance: p => next() < p, pick: a => a[Math.floor(next() * a.length)],
    range: (a, b) => a + next() * (b - a), vary: (x, d = .15) => x * (1 - d + next() * 2 * d),
    // нормальний розподіл (Бокс — Мюллер)
    norm: (m = 0, sd = 1) => m + sd * Math.sqrt(-2 * Math.log(next() || 1e-9)) * Math.cos(2 * Math.PI * next()),
    // біноміальний розподіл (наближення для великих n)
    binom(n, p) { n = Math.max(0, Math.round(n)); p = clamp(p, 0, 1); if (n < 40) { let k = 0; for (let i = 0; i < n; i++) if (next() < p) k++; return k; } return Math.max(0, Math.round(this.norm(n * p, Math.sqrt(n * p * (1 - p))))); },
    weighted(obj) { const e = Object.entries(obj).filter(([, w]) => w > 0); const t = sum(e.map(x => x[1])); let r = next() * t; for (const [k, w] of e) { r -= w; if (r <= 0) return k; } return e[0]?.[0]; },
  };
}

/* ═════════ новий стан ═════════ */
export function newGame({ idea = 'homework', founder = 'Засновник', bg = 'dev', company = 'Мій стартап', color, sym = 'spark', fff = false, seed, custom } = {}) {
  seed = (seed ?? Date.now() % 1e6) | 0;
  // власна ідея учня: опис → ідея з прихованою правдою ринку
  const customIdea = custom ? makeCustomIdea(custom, seed * 7 + 13) : null;
  if (customIdea) idea = 'custom';
  const I = customIdea || IDEAS[idea], segIds = Object.keys(I.segments);
  const s = {
    v: 1, rs: seed, seq: 1, week: 0, custom: customIdea,
    idea, target: segIds.find(k => !I.segments[k].b2b) || segIds[0],
    founder: { name: founder, bg, energy: 100, burnout: 0 },
    company: { name: company, color: color || I.color, sym, form: 'none' },
    cash: 150000,
    cap: [{ id: 'founder', t: founder, kind: 'founder', shares: 1000000 }],
    hours: { product: 18, customers: 15, content: 6, sales: 0, invest: 0, freelance: 0, rest: 11 },
    mkt: { ads: 0, bloggers: 0, referral: 0, split: .6, events: 0 },
    model: I.kind === 'hardware' ? 'device' : I.models.find(m => m !== 'b2b') || 'freemium',
    price: {},
    product: { built: [], queue: [], mode: 'balanced', fix: .15, bugs: 0, debt: 0, quality: 55, launched: false, launchWeek: null, progress: {} },
    users: {},
    organic: { social: 0, seo: 0 },
    landing: { cur: -1, test: null, tried: [] },
    stock: { units: 0, orders: [] }, unitCost: I.unitCost || 0,
    team: [], candidates: [], crunch: false,
    know: {}, interview: null, talks: 0, surveys: [],
    inv: {}, deck: { slides: ['problem', 'solution', 'market', 'traction', 'team', 'ask'], honest: true }, offers: [],
    inbox: [], history: [], ach: {}, flags: {}, comp: {}, over: null, last: null, dismissed: {},
  };
  for (const k of segIds) {
    const g = I.segments[k];
    s.users[k] = { wait: 0, free: 0, trial: 0, paid: 0, pipe: [], ever: 0, paidEver: 0 };
    s.know[k] = { n: 0, good: 0, bad: 0, pains: [], wtps: [], badWtps: [], likes: 0, ch: {}, feats: {}, sols: [] };
    s.price[k] = I.kind === 'hardware' ? Math.round(g.wtp / (g.units || 1) * .9 / 10) * 10 : Math.round(g.wtp * .8 / 10) * 10;
  }
  if (fff) {
    const add = Math.round(1000000 * .1 / .9);
    s.cap.push({ id: 'fff', t: 'Родина й друзі', kind: 'fff', shares: add }); s.cash += 300000;
  }
  const sim = new Sim(s);
  sim.refreshCandidates();
  if (customIdea) sim.mail({ from: 'Наставниця Ірина', kind: 'mentor', title: 'Ваша ідея — це поки гіпотеза', body: `Ви описали ідею «${I.t}», своїх клієнтів і функції. Але все це — лише ваші припущення.\n\nРинок може думати інакше: комусь проблема болить менше, ніж здається, а потрібною може виявитися зовсім не та функція, яку ви вважаєте головною. Перевіряйте все в інтерв'ю й опитуваннях. А в підсумковому звіті ви побачите, які з ваших припущень справдилися.` });
  sim.mail({ from: 'Наставниця Ірина', kind: 'mentor', title: 'Ласкаво просимо!', body: `Привіт! Я буду поруч і підказуватиму.\n\nУ вас ${money(s.cash)} і ідея: «${I.pitch}» Не поспішайте писати код. Спершу поговоріть із майбутніми клієнтами — розділ «Клієнти». Дізнайтеся, кому це справді болить і скільки вони вже витрачають на цю проблему.\n\nКожен тиждень плануйте свій час і натискайте «Завершити тиждень». Гроші закінчаться — компанія закриється. Удачі!` });
  return sim;
}

export const okState = s => !!s && s.v === 1 && Number.isFinite(s.week) && Number.isFinite(s.cash) && (s.idea === 'custom' ? !!s.custom?.segments : !!IDEAS[s.idea]) && Array.isArray(s.cap) && typeof s.users === 'object';

/* ═════════ рушій ═════════ */
const CUSTOM = { t: 'Розробка на замовлення', cost: 14, custom: true, desc: 'Окрема версія для клієнта.' };

export class Sim {
  constructor(state) {
    this.s = state;
    this.r = rng(this.s);
    this.initMods();
  }
  get I() { return this.s.idea === 'custom' ? this.s.custom : IDEAS[this.s.idea]; }
  seg(k = this.s.target) { return this.I.segments[k]; }
  get segIds() { return Object.keys(this.I.segments); }
  id(p = 'x') { return p + (this.s.seq++); }
  feature(id) { return id === '_custom' ? CUSTOM : this.I.features[id]; }
  has(id) { return this.s.product.built.includes(id); }
  hasFlag(flag) { return this.s.product.built.some(f => this.feature(f)?.[flag]); }
  modelOf(k) { const g = this.seg(k); return this.I.kind === 'hardware' ? 'device' : g.b2b ? 'b2b' : this.s.model; }
  month(w = this.s.week) { return weekDate(w).getUTCMonth() + 1; }
  season(w = this.s.week) { return this.I.season[this.month(w)] || 1; }

  /* ── продукт і ринок ── */
  fit(k = this.s.target) { return clamp(sum(this.s.product.built.map(f => this.feature(f)?.v?.[k] || 0)), -.2, 1.15); }
  fx(name) { return sum(this.s.product.built.map(f => this.feature(f)?.fx?.[name] || 0)); }
  reqOk(k = this.s.target) { return (this.seg(k).requires || []).every(f => this.has(f)); }
  missingReq(k = this.s.target) { return (this.seg(k).requires || []).filter(f => !this.has(f)); }
  qF() { return .55 + .45 * this.s.product.quality / 100; }
  compOf(k) { return sum(this.I.competitors.map(c => c.seg[k] || 0)) + (this.s.comp[k] || 0); }
  appeal(k = this.s.target) {
    const g = this.seg(k);
    return clamp(g.pain * (.2 + .8 * this.fit(k)) * this.qF() * (1 - clamp(this.compOf(k), 0, 1) * .4) * (this.reqOk(k) ? 1 : .7) - this.s.product.bugs * .0015, 0, 1);
  }
  // Ціна відносно того, скільки готові платити: 1 — дешево, 0 — ніхто не купить
  priceF(k = this.s.target) {
    const g = this.seg(k), m = this.modelOf(k);
    if (m === 'free') return 1;
    const p = this.s.price[k] * (m === 'device' ? (g.units || 1) : 1);
    return 1 / (1 + Math.exp((p / g.wtp - 1) * 4.2));
  }
  pmf(k = this.s.target) { return clamp(this.appeal(k) * .88 + (this.fit(k) > .8 ? .04 : 0), 0, .72); }
  nps(k = this.s.target) { return Math.round(clamp((this.appeal(k) - .28) * 165 + (this.s.product.quality - 60) * .35 - this.s.product.bugs * .2 + this.supportBoost() * 40, -100, 100)); }
  activation() { return clamp(.32 + this.fx('activation') + (this.qF() - .8) * .5, .1, .85); }

  /* ── команда й години ── */
  fSkill() { return BACKGROUNDS[this.s.founder.bg].skill; }
  energyF() { const e = this.s.founder.energy; return e < 15 ? .55 : e < 35 ? .8 : 1; }
  totalHours() { return sum(Object.entries(this.s.hours).filter(([k]) => k !== 'rest').map(([, v]) => v)); }
  moraleF(m) { return m.morale < 30 ? .6 : m.morale < 50 ? .85 : m.morale > 80 ? 1.08 : 1; }
  trait(m) { return TRAITS[m.trait]?.fx || {}; }
  out(role) {
    return sum(this.s.team.filter(m => m.role === role && !m.leaving).map(m => m.skill * this.moraleF(m) * (this.s.crunch ? 1.25 : 1) * (this.trait(m).speed || 1)));
  }
  caps() {
    const h = this.s.hours, sk = this.fSkill(), e = this.energyF();
    const debt = 1 - clamp(this.s.product.debt / 160, 0, .6);
    const dev = (h.product / 10 * sk.dev * (this.s.founder.bg === 'design' ? .6 : 1) * e + this.out('dev') * 2.3) * debt * this.retroSpeed();
    const design = h.product / 10 * (this.s.founder.bg === 'design' ? 2.2 : .4) * e + this.out('design') * 2;
    const content = h.content * sk.mkt / 2 * e + this.out('mkt') * 14 + this.flContent();
    const sales = h.sales * sk.sales / 2 * e + this.out('sales') * 16;
    const support = this.out('support');
    return { dev, design, content, sales, support };
  }
  supportBoost() { const u = this.activeUsers(); if (!u) return .1; return clamp(this.caps().support * 1500 / Math.max(u, 300), 0, .3); }
  salary(m) { return m.salary; }
  marketSalary(role, skill) { const r = ROLES[role]; return r.base + r.step * (skill - 1); }
  burnWeekly() { return this.lastCost() - this.lastRev(); }
  lastRev() { return this.s.history.at(-1)?.rev || 0; }
  lastCost() { return this.s.history.at(-1)?.cost || this.fixedCosts(); }
  fixedCosts() { return sum(this.s.team.map(m => m.salary)) / W2M + 900 + (this.s.company.form === 'fop' ? 1300 / W2M : this.s.company.form === 'tov' ? 6000 / W2M : 0); }
  runwayWeeks() {
    const h = this.s.history.slice(-4);
    const burn = h.length ? sum(h.map(x => x.cost - x.rev)) / h.length : this.fixedCosts();
    return burn <= 0 ? Infinity : this.s.cash / burn;
  }

  /* ── користувачі й гроші ── */
  activeUsers(k) { const ks = k ? [k] : this.segIds; return sum(ks.map(x => { const u = this.s.users[x]; return u.free + u.trial + u.paid; })); }
  paidUsers(k) { const ks = k ? [k] : this.segIds; return sum(ks.map(x => this.s.users[x].paid)); }
  mrr() {
    return sum(this.segIds.map(k => { const m = this.modelOf(k); return m === 'device' || m === 'free' ? 0 : this.s.users[k].paid * this.s.price[k]; }));
  }
  growth(weeks = 4) { const h = this.s.history; if (h.length < weeks + 1) return 0; const a = h.at(-1 - weeks).mrr, b = h.at(-1).mrr; return a > 0 ? b / a - 1 : b > 0 ? 1 : 0; }
  cac() {
    const h = this.s.history.slice(-4), spend = sum(h.map(x => x.mkt)), n = sum(h.map(x => x.newPaid));
    return n ? spend / n : spend ? Infinity : 0;
  }
  ltv(k = this.s.target) {
    const m = this.modelOf(k), g = this.seg(k);
    if (m === 'device') return this.s.price[k] * (g.units || 1) - this.s.unitCost * (g.units || 1);
    if (m === 'free') return 0;
    const wChurn = this.churnRate(k, true), mChurn = 1 - Math.pow(1 - wChurn, W2M);
    const cogs = sum(this.s.product.built.map(f => this.feature(f)?.cogs || 0));
    return Math.max(0, (this.s.price[k] - cogs)) / Math.max(mChurn, .01);
  }
  churnRate(k, paid = false) {
    const g = this.seg(k), a = this.appeal(k);
    let c = g.churn * (1.75 - a * 1.4) * (1 + this.s.product.bugs * .012) * (1 - clamp(this.fx('retention'), 0, .45)) * (1 - this.supportBoost());
    if (paid) c *= .55;
    return clamp(c, .003, .6);
  }
  valuation() {
    const s = this.s, arr = this.mrr() * 12, g = this.growth(4);
    const mult = clamp(4 + g * 45, 3, 16);
    const base = 1200000 + (s.product.launched ? 1300000 : 0) + s.team.length * 300000 + Math.min(20, sum(Object.values(s.know).map(k => k.good))) * 25000;
    const hw = this.I.kind === 'hardware' ? sum(s.history.slice(-12).map(x => x.rev)) * 4.33 * 2.5 : 0;
    return Math.round(Math.max(base, arr * mult + this.activeUsers() * 35 + hw) / 10000) * 10000;
  }
  totalShares() { return sum(this.s.cap.map(c => c.shares)); }
  stake(id = 'founder') { return (this.s.cap.find(c => c.id === id)?.shares || 0) / this.totalShares(); }
  issue(id, t, kind, frac) { const add = Math.round(this.totalShares() * frac / (1 - frac)); const e = this.s.cap.find(c => c.id === id); if (e) e.shares += add; else this.s.cap.push({ id, t, kind, shares: add }); return add; }

  /* ═════════ дії гравця ═════════ */
  setHours(k, v) { this.s.hours[k] = clamp(Math.round(v), 0, 60); }
  setTarget(k) {
    if (!this.I.segments[k] || k === this.s.target) return;
    const prev = this.s.target; this.s.target = k; this.s.flags.targetChanged = this.s.week;
    if (this.s.product.launched && this.s.know[prev].n >= 3) this.s.flags.pivotFrom = prev;
  }
  setModel(m) { if (this.I.models.includes(m) && m !== 'b2b') this.s.model = m; }
  setPrice(k, v) { this.s.price[k] = Math.max(0, Math.round(v)); }
  setBudget(ch, v) { this.s.mkt[ch] = Math.max(0, Math.round(v)); }
  queue(id) { const p = this.s.product; if (!this.feature(id) || this.has(id) || p.queue.includes(id)) return; p.queue.push(id); p.progress[id] ||= 0; }
  unqueue(id) { const p = this.s.product; p.queue = p.queue.filter(x => x !== id); }
  moveQueue(id, d) { const q = this.s.product.queue, i = q.indexOf(id), j = i + d; if (i < 0 || j < 0 || j >= q.length) return; [q[i], q[j]] = [q[j], q[i]]; }
  canLaunch() { return !this.s.product.launched && this.s.product.built.length > 0; }
  launch() {
    if (!this.canLaunch()) return false;
    const p = this.s.product; p.launched = true; p.launchWeek = this.s.week; this.award('launch');
    // лист очікування: частина людей приходить одразу після запуску
    for (const k of this.segIds) { const u = this.s.users[k]; if (u.wait) { this.s.pendingWait = (this.s.pendingWait || 0) + u.wait; } }
    this.mail({ from: 'Наставниця Ірина', kind: 'mentor', title: 'Ви запустилися!', body: 'Перша версія в руках людей. Тепер головне — дивитися, чи вони повертаються (утримання), і що кажуть. Проведіть опитування, коли наберете хоча б 30 активних користувачів.' });
    return true;
  }
  register(form) {
    const c = this.s.company;
    if (form === c.form || !['fop', 'tov'].includes(form)) return false;
    const cost = form === 'tov' ? 12000 : 0;
    if (this.s.cash < cost) return false;
    this.s.cash -= cost; c.form = form; this.s.flags.registered = this.s.week;
    this.s.ledgerExtra = (this.s.ledgerExtra || 0) + cost;
    return true;
  }
  orderBatch(n) {
    const I = this.I; if (I.kind !== 'hardware') return false;
    n = Math.max(I.batchMin, Math.round(n)); const cost = n * this.s.unitCost;
    if (this.s.cash < cost) return false;
    this.s.cash -= cost; this.s.ledgerExtra = (this.s.ledgerExtra || 0) + cost;
    this.s.stock.orders.push({ due: this.s.week + I.leadTime, n });
    return true;
  }

  /* ── інтерв'ю з клієнтами (правило Mom Test) ── */
  talksLeft() { return Math.max(0, Math.floor(this.s.hours.customers / 3) - this.s.talks); }
  startInterview(k) {
    if (this.s.interview || this.talksLeft() <= 0 || !this.I.segments[k]) return null;
    const g = this.seg(k), r = this.r;
    const first = r.pick(FIRST), name = `${first} ${r.pick(LAST)}`;
    const p = {
      name, fem: FEM.has(first), who: r.pick(g.who), seg: k,
      pain: clamp(r.norm(g.pain, .18), .05, 1),
      wtp: Math.round(g.wtp * Math.exp(r.norm(0, .35)) / 10) * 10,
      ch: r.weighted(Object.fromEntries(Object.entries(g.fit).filter(([c]) => g.channelSay[c]))),
      feat: r.weighted(Object.fromEntries(Object.entries(this.I.features).map(([id, f]) => [id, Math.max(0, f.v?.[k] || 0)]))),
      sol: r.pick(g.solutions),
    };
    this.s.interview = { p, asked: [], log: [] };
    this.s.talks++;
    return this.s.interview;
  }
  ask(qid) {
    const iv = this.s.interview; if (!iv || iv.asked.length >= 3 || iv.asked.includes(qid)) return null;
    const q = QUESTIONS.find(x => x.id === qid); if (!q) return null;
    const p = iv.p, g = this.seg(p.seg), K = this.s.know[p.seg], r = this.r, I = this.I;
    let a;
    const ua = p.fem ? 'а' : '';
    switch (qid) {
      case 'how': a = `Зараз ${p.sol}. ${p.pain > .62 ? 'Але це забирає купу сил і нервів.' : p.pain < .35 ? 'І мене це, загалом, влаштовує.' : 'Працює так собі, але живемо.'}`; K.sols.push(p.sol); break;
      case 'last': a = r.pick(p.pain > .5 ? g.high : g.low); K.pains.push(clamp(p.pain + r.norm(0, .08), 0, 1)); break;
      case 'spend': {
        if (p.pain < .3) { a = 'Та майже нічого не витрачаю на це, чесно.'; K.wtps.push(Math.round(p.wtp * .3)); break; }
        const x = Math.round(p.wtp * r.range(.75, 1.05) / 10) * 10;
        a = g.b2b ? `Зараз це обходиться приблизно в ${money(x)} на ${I.kind === 'hardware' ? 'сезон' : 'місяць'}, якщо порахувати час людей.` : I.kind === 'hardware' ? `На рослини й заміну загиблих іде десь ${money(x)} на рік.` : `${g.spendWord ? `Із ${g.spendWord} ` : ''}десь ${money(x)} на місяць іде на це${g.spendWord ? '' : ', якщо чесно'}.`;
        K.wtps.push(x); break;
      }
      case 'worst': { const f = this.feature(p.feat); a = f ? `Найбільше бракує, щоб було щось таке: ${f.desc.charAt(0).toLowerCase() + f.desc.slice(1)}` : 'Та навіть не знаю.'; if (f) K.feats[p.feat] = (K.feats[p.feat] || 0) + 1; break; }
      case 'where': a = `Зазвичай ${g.channelSay[p.ch] || 'питаю знайомих'}.`; K.ch[p.ch] = (K.ch[p.ch] || 0) + 1; break;
      case 'like': a = r.chance(.88) ? `Так, звучить класно! Я б точно спробував${ua}.` : 'Хм, ну може бути цікаво.'; K.likes++; break;
      case 'pay': { const x = Math.round(p.wtp * r.range(1.6, 3) / 10) * 10; a = `Ну… мабуть, ${money(x)}${g.b2b || I.kind === 'hardware' ? '' : ' на місяць'}, чому б ні.`; K.badWtps.push(x); break; }
      case 'would': a = r.chance(.85) ? 'Ну… мабуть, так. Чому б ні.' : 'Якщо буде зручно — то так.'; K.likes++; break;
    }
    iv.asked.push(qid); iv.log.push({ q: this.qText(q), a });
    return a;
  }
  qText(q) { return q.t.replace('{problem}', this.I.problem).replace('{pitch}', `«${this.I.pitch}»`); }
  finishInterview() {
    const iv = this.s.interview; if (!iv) return null;
    const K = this.s.know[iv.p.seg];
    const bad = iv.asked.filter(q => QUESTIONS.find(x => x.id === q)?.bad).length;
    K.n++; if (bad) K.bad++; else K.good++;
    this.s.interview = null;
    this.award('firstTalk');
    const all = Object.values(this.s.know); if (sum(all.map(x => x.good)) >= 10 && sum(all.map(x => x.bad)) === 0) this.award('listener');
    return { bad, asked: iv.asked.length };
  }
  insight(k) {
    const K = this.s.know[k], med = a => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
    const pain = K.pains.length ? sum(K.pains) / K.pains.length : null;
    const conf = n => n >= 6 ? 'висока' : n >= 3 ? 'середня' : n ? 'низька' : 'немає даних';
    return { n: K.n, good: K.good, bad: K.bad, pain, painConf: conf(K.pains.length), wtp: med(K.wtps), wtpConf: conf(K.wtps.length), badWtp: med(K.badWtps), likes: K.likes,
      ch: Object.entries(K.ch).sort((a, b) => b[1] - a[1]), feats: Object.entries(K.feats).sort((a, b) => b[1] - a[1]) };
  }
  canSurvey(k = this.s.target) { const u = this.s.users[k]; return this.s.product.launched && u.free + u.trial + u.paid >= 30 && this.s.hours.customers >= 2 && !this.s.surveys.some(x => x.week === this.s.week && x.seg === k); }
  survey(k = this.s.target) {
    if (!this.canSurvey(k)) return null;
    const u = this.s.users[k], n = Math.min(240, Math.round((u.free + u.trial + u.paid) * .35)), r = this.r;
    const p = this.pmf(k), seen = clamp(p + r.norm(0, Math.sqrt(p * (1 - p) / Math.max(n, 1))), 0, 1);
    const top = Object.entries(this.I.features).filter(([id, f]) => !this.has(id) && (f.v?.[k] || 0) > 0).sort((a, b) => (b[1].v[k]) - (a[1].v[k]))[0];
    const asks = [];
    if (top) asks.push(`Додайте: ${top[1].t.toLowerCase()}`);
    if (this.s.product.bugs > 12) asks.push('Менше помилок, застосунок часто глючить');
    if (this.modelOf(k) !== 'free' && this.priceF(k) < .4) asks.push('Занадто дорого');
    if (this.s.product.quality < 55) asks.push('Незручний і заплутаний інтерфейс');
    const res = { week: this.s.week, seg: k, n, pmf: seen, nps: Math.round(this.nps(k) + r.norm(0, 6)), asks };
    this.s.surveys.push(res);
    if (seen >= .4 && n >= 30) this.award('pmf');
    return res;
  }

  /* ── лендінг і A/B-тест ── */
  landingM() { const i = this.s.landing.cur; return i < 0 ? 1 : this.I.landing[i].m; }
  setLanding(i) { if (this.I.landing[i]) this.s.landing.cur = i; }
  startAB(a, b) { if (a === b || !this.I.landing[a] || !this.I.landing[b] || this.s.landing.test) return false; this.s.landing.test = { a, b, start: this.s.week }; return true; }

  /* ── команда ── */
  refreshCandidates() {
    const r = this.r, roles = Object.keys(ROLES), out = [];
    const want = this.I.segments[this.s.target].b2b ? ['dev', 'sales'] : ['dev', 'mkt'];
    for (let i = 0; i < 4; i++) {
      const role = i < 2 ? want[i] : r.pick(roles), skill = clamp(Math.round(r.norm(2.7, 1)), 1, 5);
      const first = r.pick(FIRST);
      const ask = Math.round(this.marketSalary(role, skill) * r.range(.9, 1.2) / 1000) * 1000;
      out.push({ id: this.id('c'), name: `${first} ${r.pick(LAST)}`, fem: FEM.has(first), role, skill, ask, trait: r.int(TRAITS.length), seen: false, lo: clamp(skill - 1 - r.int(2), 1, 5), hi: clamp(skill + 1 + r.int(2), 1, 5) });
    }
    this.s.candidates = out; this.s.flags.candWeek = this.s.week;
  }
  meet(id) { const c = this.s.candidates.find(x => x.id === id); if (!c || c.seen || (this.s.flags.meets || 0) >= 3) return null; c.seen = true; c.lo = c.hi = c.skill; this.s.flags.meets = (this.s.flags.meets || 0) + 1; return c; }
  // Імовірність, що кандидат прийме пропозицію
  acceptChance(c, salary, equity) {
    const love = this.trait(c).equityLove || 1, eqValue = equity * this.valuation() / 24 * love; // частка «в місяць» за 2 роки
    return clamp(.5 + ((salary + eqValue) / c.ask - 1) * 2.2, 0, .97);
  }
  hire(id, salary, equity = 0) {
    const c = this.s.candidates.find(x => x.id === id); if (!c) return { ok: false };
    const p = this.acceptChance(c, salary, equity);
    this.s.candidates = this.s.candidates.filter(x => x !== c);
    if (!this.r.chance(p)) return { ok: false, refused: true, name: c.name };
    const m = { id: this.id('m'), name: c.name, fem: c.fem, role: c.role, skill: c.skill, salary: Math.round(salary), morale: 72 + (this.trait(c).morale || 0), trait: c.trait, joined: this.s.week, eq: equity };
    this.s.team.push(m);
    if (equity > 0) this.issue(m.id, m.name, 'team', equity);
    this.award('hire');
    return { ok: true, m };
  }
  fire(id) {
    const m = this.s.team.find(x => x.id === id); if (!m) return false;
    this.s.team = this.s.team.filter(x => x !== m);
    this.s.cash -= m.salary; this.s.ledgerExtra = (this.s.ledgerExtra || 0) + m.salary; // вихідна допомога — місячна зарплата
    for (const o of this.s.team) o.morale = clamp(o.morale - 10, 0, 100);
    return true;
  }
  raise(id, salary) { const m = this.s.team.find(x => x.id === id); if (!m) return; if (salary > m.salary) m.morale = clamp(m.morale + (salary / m.salary - 1) * 60, 0, 100); m.salary = Math.round(salary); }

  /* ── інвестори ── */
  needsOf(inv) {
    const n = inv.need || {}, s = this.s, out = [];
    const t = this.s.target;
    if (n.interviews && sum(Object.values(s.know).map(k => k.good)) < n.interviews) out.push(`щонайменше ${n.interviews} якісних інтерв'ю з клієнтами`);
    if (n.launched && !s.product.launched) out.push('запущений продукт');
    if (n.users && this.activeUsers() < n.users) out.push(`${n.users}+ активних користувачів`);
    if (n.mrr && this.mrr() < n.mrr) out.push(`виручка від ${money(n.mrr)} на місяць`);
    if (n.growth && this.growth(4) < n.growth) out.push(`ріст виручки від ${pct(n.growth)} за місяць`);
    if (n.pmf && this.pmf(t) < n.pmf) out.push('ознаки product-market fit');
    if (n.nps && this.nps(t) < n.nps) out.push(`NPS від ${n.nps}`);
    if (n.company === 'tov' && s.company.form !== 'tov') out.push('зареєстроване ТОВ');
    if (inv.kind !== 'grant' && inv.kind !== 'vc' && s.company.form !== 'tov') out.push('зареєстроване ТОВ (інакше частку не оформити)');
    if (inv.kind === 'grant' && s.company.form === 'none') out.push('зареєстрований ФОП або ТОВ');
    return [...new Set(out)];
  }
  deckScore() {
    const d = this.s.deck.slides, goods = d.filter(x => SLIDES[x]?.good), bads = d.filter(x => SLIDES[x]?.bad);
    const coverage = goods.length / 8;
    let inOrder = 0; for (let i = 1; i < goods.length; i++) if (SLIDES[goods[i]].ord > SLIDES[goods[i - 1]].ord) inOrder++;
    const order = goods.length > 1 ? inOrder / (goods.length - 1) : 0;
    const len = d.length > 12 ? .8 : 1;
    return clamp((coverage * .6 + order * .4 - bads.length * .12) * len, 0, 1);
  }
  deckNotes() {
    const d = this.s.deck.slides, notes = [];
    for (const k of ['problem', 'solution', 'traction', 'model', 'team', 'ask']) if (!d.includes(k)) notes.push(`Немає слайда «${SLIDES[k].t}»`);
    for (const k of d) if (SLIDES[k]?.bad) notes.push(`«${SLIDES[k].t}»: ${SLIDES[k].bad}`);
    const goods = d.filter(x => SLIDES[x]?.good);
    for (let i = 1; i < goods.length; i++) if (SLIDES[goods[i]].ord < SLIDES[goods[i - 1]].ord) { notes.push(`«${SLIDES[goods[i]].t}» краще поставити раніше, ніж «${SLIDES[goods[i - 1]].t}»`); break; }
    return notes;
  }
  pitch(id) {
    const inv = INVESTORS.find(x => x.id === id), st = this.s.inv[id];
    if (!inv || (st && ['meeting', 'offer', 'invested', 'grantWait', 'accel'].includes(st.status))) return { ok: false };
    if (st?.status === 'rejected' && this.s.week - st.week < 8) return { ok: false, msg: 'Цей інвестор нещодавно відмовив. Поверніться пізніше, коли цифри покращаться.' };
    if (inv.kind === 'grant' && st) return { ok: false, msg: 'Подати на грант можна лише раз.' };
    const used = sum(Object.values(this.s.inv).filter(x => x.status === 'meeting' && x.week === this.s.week).map(() => 6));
    if (this.s.hours.invest - used < 6) return { ok: false, msg: 'Заплануйте щонайменше 6 годин на роботу з інвесторами цього тижня.' };
    this.s.inv[id] = { status: inv.kind === 'grant' ? 'grantWait' : 'meeting', week: this.s.week, honest: this.s.deck.honest, deck: this.deckScore() };
    return { ok: true };
  }
  resolvePitch(id) {
    const inv = INVESTORS.find(x => x.id === id), st = this.s.inv[id], r = this.r;
    const unmet = this.needsOf(inv);
    if (inv.kind === 'grant') {
      const ok = !unmet.length && st.honest && (this.s.product.launched || sum(this.segIds.map(k => this.s.users[k].wait)) >= 50);
      if (ok) { st.status = 'invested'; this.s.cash += inv.amount[0]; this.s.ledgerIn = (this.s.ledgerIn || 0) + inv.amount[0]; this.award('raised'); if (st.honest) this.award('honest');
        this.mail({ from: inv.t, kind: 'investor', title: 'Грант схвалено!', body: `Вітаємо! Комісія схвалила ваш проєкт. ${money(inv.amount[0])} уже на рахунку. Частку в компанії ми не беремо — просто зробіть щось корисне.` }); }
      else { st.status = 'rejected'; st.week = this.s.week;
        const why = !st.honest ? 'цифри в заявці не збіглися з реальністю, яку ми перевірили' : unmet.length ? 'не виконано умови: ' + unmet.join(', ') : 'немає доказів попиту: ні запуску, ні хоча б 50 людей у листі очікування';
        this.mail({ from: inv.t, kind: 'investor', title: 'Грант не схвалено', body: `На жаль, цього разу відмова. Причина: ${why}.` }); }
      return;
    }
    if (unmet.length) {
      st.status = 'rejected'; st.week = this.s.week; st.reason = unmet.join(', ');
      this.mail({ from: inv.t, kind: 'investor', title: 'Поки що ні', body: `Дякую за зустріч! Ідея цікава, але для інвестиції нам потрібно: ${st.reason}. Повертайтеся, коли це буде.` });
      return;
    }
    if (!st.honest && r.chance(.6)) {
      st.status = 'rejected'; st.week = this.s.week; this.s.flags.reputation = (this.s.flags.reputation || 0) + 1;
      this.mail({ from: inv.t, kind: 'investor', title: 'Ми перевірили ваші цифри', body: 'Під час перевірки (due diligence) з\'ясувалося, що цифри в презентації прикрашені. Ми не інвестуємо в тих, хто вводить в оману. І, повірте, інвестори між собою спілкуються.' });
      return;
    }
    const like = inv.likes?.includes(this.s.idea) ? .12 : 0, rep = (this.s.flags.reputation || 0) * .12;
    const score = .35 + st.deck * .4 + like + r.range(0, .25) - rep + (this.s.flags.accelDone ? .1 : 0);
    if (score < .55 && inv.kind !== 'accel') {
      st.status = 'rejected'; st.week = this.s.week;
      const why = st.deck < .5 ? 'Презентація була хаотичною: важко зрозуміти, яку проблему ви розв\'язуєте і що просите.' : 'Не відчули впевненості, що ринок достатньо великий. Можливо, наступного разу.';
      this.mail({ from: inv.t, kind: 'investor', title: 'Не цього разу', body: `Дякую за пітч. ${why}${this.fSkill().sales >= 3 ? '' : ' Порада: потренуйте пітч і перевірте порядок слайдів.'}` });
      return;
    }
    let amount, take;
    if (inv.kind === 'accel') { amount = inv.amount[0]; take = inv.take; }
    else {
      amount = Math.round(r.range(...inv.amount) / 50000) * 50000;
      const pre = this.valuation() * (.75 + st.deck * .35 + (st.honest ? 0 : .1)) * (this.fSkill().sales >= 3 ? 1.1 : 1);
      take = clamp(amount / (pre + amount), inv.take[0] * .8, inv.take[1] * 1.3);
    }
    st.status = 'offer'; st.offer = { amount, take, until: this.s.week + 2 };
    this.mail({ from: inv.t, kind: 'investor', title: 'Пропозиція інвестиції', body: `Ми готові інвестувати ${money(amount)} за ${pct(take, 1)} компанії. Це означає оцінку вашої компанії в ${money(Math.round(amount / take))} після інвестиції. Пропозиція діє 2 тижні — подивіться в розділі «Інвестори».`, inv: id });
  }
  acceptOffer(id) {
    const inv = INVESTORS.find(x => x.id === id), st = this.s.inv[id]; if (!st || st.status !== 'offer') return false;
    this.issue(id, inv.t, inv.kind, st.offer.take);
    this.s.cash += st.offer.amount; this.s.ledgerIn = (this.s.ledgerIn || 0) + st.offer.amount;
    st.status = inv.kind === 'accel' ? 'accel' : 'invested'; st.week = this.s.week;
    if (inv.kind === 'accel') this.s.flags.accelUntil = this.s.week + 12;
    this.award('raised'); if (st.honest) this.award('honest');
    return true;
  }
  declineOffer(id) { const st = this.s.inv[id]; if (st?.status === 'offer') { st.status = 'declined'; st.week = this.s.week; } }
  counter(id) {
    const st = this.s.inv[id]; if (!st || st.status !== 'offer' || st.countered) return null;
    st.countered = true; const r = this.r.next();
    if (r < .5) { st.offer.take *= .82; st.offer.until = this.s.week + 2; return 'yes'; }
    if (r < .8) return 'same';
    st.status = 'declined'; st.week = this.s.week; return 'walk';
  }

  /* ── пошта й події ── */
  mail(m) { const e = { id: this.id('e'), week: this.s.week, read: false, ...m }; this.s.inbox.unshift(e); if (this.s.inbox.length > 80) this.s.inbox.length = 80; return e; }
  choose(eid, ci) {
    const e = this.s.inbox.find(x => x.id === eid); if (!e || !e.choices || e.chosen != null) return null;
    const ev = EVENTS[e.ev]; const ch = ev?.choices(this, e)[ci]; if (!ch) return null;
    e.chosen = ci; e.read = true;
    const res = ch.do(this, e) || ''; e.result = res;
    return res;
  }
  award(k) { if (!this.s.ach[k] && ACHIEVEMENTS[k]) { this.s.ach[k] = this.s.week + 1; (this.s.newAch ||= []).push(k); } }

  /* ═════════ ТИЖДЕНЬ ═════════ */
  endWeek() {
    const s = this.s, r = this.r, I = this.I;
    if (s.over) return null;
    if (s.interview) this.finishInterview();
    const rep = { week: s.week, notes: [], events: [], cashBefore: s.cash };
    const caps = this.caps();
    const sea = this.season();

    /* продукт: виправлення багів, технічний борг, черга функцій */
    const p = s.product, mode = { fast: { sp: 1.3, bug: .5, debt: .45 }, balanced: { sp: 1, bug: .25, debt: .15 }, clean: { sp: .8, bug: .1, debt: .03 } }[p.mode];
    const bugMul = s.team.filter(m => m.role === 'dev').reduce((a, m) => a * (this.trait(m).bugs || 1), 1) ** (1 / Math.max(1, s.team.filter(m => m.role === 'dev').length));
    let pts = caps.dev;
    const fixPts = pts * (p.bugs > 0 || p.debt > 0 ? p.fix : 0); pts -= fixPts;
    const fixedBugs = Math.min(p.bugs, fixPts * 1.6); p.bugs -= fixedBugs; p.debt = Math.max(0, p.debt - Math.max(0, fixPts - fixedBugs / 1.6) * .8);
    pts *= mode.sp; rep.devPts = caps.dev; rep.built = [];
    while (pts > 0 && p.queue.length) {
      const id = p.queue[0], f = this.feature(id), need = f.cost - (p.progress[id] || 0), use = Math.min(need, pts);
      p.progress[id] = (p.progress[id] || 0) + use; pts -= use;
      if (p.progress[id] >= f.cost - 1e-6) {
        p.queue.shift(); if (!f.custom) { p.built.push(id); rep.built.push(id); } else rep.notes.push('Розробку на замовлення здано клієнту.');
        p.bugs += f.cost * mode.bug * bugMul * this.retroBugs() * Math.max(.4, 1.2 - caps.design * .03); p.debt += f.cost * mode.debt;
        if (f.unitSave) s.unitCost = Math.max(150, s.unitCost - f.unitSave);
      }
      if (p.queue.length && p.queue[0] !== id) continue; else if (use < need) break;
    }
    // якість: дизайн піднімає, баги тягнуть донизу
    const qTarget = clamp(48 + Math.min(42, caps.design * 7) - p.bugs * .7 - p.debt * .1, 10, 98);
    p.quality = Math.round((p.quality + (qTarget - p.quality) * .3) * 10) / 10;

    /* відвідувачі */
    const tg = s.target, tgs = this.seg(tg), b2bT = !!tgs.b2b, accel = s.flags.accelUntil > s.week ? 1.15 : 1;
    const visits = {}, mkSpend = { ads: 0, bloggers: 0, events: 0, referral: 0 };
    for (const k of this.segIds) visits[k] = { ads: 0, bloggers: 0, social: 0, seo: 0, events: 0, wom: 0, press: 0 };
    const mktSkill = 1 + this.out('mkt') * .06;
    // реклама: що більший бюджет, то дорожчий відвідувач
    if (s.mkt.ads > 0) { const cpv = CHANNELS.ads.cpv / Math.max(tgs.fit.ads, .05) * (1 + s.mkt.ads / 45000) / mktSkill * (b2bT ? 6 : 1) / (1 + s.brand.aware * .5) / (1 + (s.fl.video || 0) * .15); visits[tg].ads = s.mkt.ads / cpv; mkSpend.ads = s.mkt.ads; }
    if (s.mkt.bloggers > 0) { visits[tg].bloggers = sum(Array.from({ length: s.mkt.bloggers }, () => CHANNELS.bloggers.reach * tgs.fit.bloggers * r.range(.4, 1.6))) * (b2bT ? .1 : 1) * this.promoBlog(); mkSpend.bloggers = s.mkt.bloggers * CHANNELS.bloggers.post; }
    const soc = caps.content * s.mkt.split, seo = caps.content * (1 - s.mkt.split);
    s.organic.social = s.organic.social * .965 + soc * 55 * tgs.fit.social;
    s.organic.seo = s.organic.seo * .996 + seo * 16 * tgs.fit.seo;
    visits[tg].social = s.organic.social * .05; visits[tg].seo = s.organic.seo * .3;
    if (s.mkt.events > 0) { visits[tg].events = s.mkt.events * 28 * tgs.fit.events * (b2bT ? .3 : 1); mkSpend.events = 1800; }
    if (s.flags.pressWeek === s.week) visits[tg].press = r.range(1500, 4000) * (b2bT ? .1 : 1);
    if (s.flags.viralWeek === s.week) visits[tg].press += r.range(4000, 12000) * (b2bT ? .05 : 1);
    // сарафанне радіо: задоволені користувачі приводять друзів
    const refMul = s.mkt.referral > 0 ? 1 + clamp(s.mkt.referral / Math.max(50, this.s.price[tg] || 100), 0, 1.2) : 1;
    for (const k of this.segIds) {
      const act = this.activeUsers(k); if (!act) continue;
      const npsF = clamp((this.nps(k) + 20) / 80, 0, 1.4);
      visits[k].wom = act * .07 * npsF * (1 + this.fx('viral')) * refMul * this.seg(k).fit.referral * (this.seg(k).b2b ? .3 : 1) * (1 + s.brand.aware);
    }

    /* воронка по сегментах */
    const segRep = {}; let newPaidAll = 0, churnAll = 0, revenue = 0, cogs = 0, unitsSold = 0, lost = 0, refPaid = 0;
    const canPay = this.hasFlag('pay') && s.company.form !== 'none';
    if (this.hasFlag('pay') && s.company.form === 'none' && s.product.launched) rep.notes.push('Оплата не працює: компанію не зареєстровано (ФОП або ТОВ). Гроші від клієнтів не надходять.');
    const act0 = this.activation();
    for (const k of this.segIds) {
      const g = this.seg(k), u = s.users[k], m = this.modelOf(k), a = this.appeal(k), pF = this.priceF(k);
      const store = this.payOf(k).visits && s.product.launched ? this.payOf(k).visits : 1;
      const V = sum(Object.values(visits[k])) * sea * accel * (k === tg ? this.promoVisits() : 1) * store;
      const boost = this.trustM(k) * this.flSignup(), pc = this.promoConv() * this.payOk(k);
      // A/B-тест лендінгу ділить цільовий трафік навпіл
      let lm = this.landingM();
      if (k === tg && s.landing.test) {
        const T = s.landing.test, va = Math.round(V / 2), vb = Math.round(V - va);
        const rate = i => g.sr * I.landing[i].m * (.35 + a) * (m === 'trial' ? .6 : 1) * boost;
        T.va = va; T.vb = vb; T.sa = r.binom(va, rate(T.a)); T.sb = r.binom(vb, rate(T.b)); T.done = s.week;
        lm = (I.landing[T.a].m + I.landing[T.b].m) / 2;
      }
      const rate = clamp(g.sr * lm * (.35 + a) * (m === 'trial' ? .6 : 1) * boost, 0, .9);
      const signups = r.binom(Math.round(V), rate);
      const sr = { visitors: Math.round(V), signups, active: 0, newPaid: 0, churned: 0, lostStock: 0 };
      // B2B: заявки йдуть у воронку продажів і закриваються через кілька тижнів
      if (g.b2b) {
        const leads = signups + (k === tg ? caps.sales * .32 * g.fit.sales : 0);
        sr.signups = Math.round(leads);
        if (s.product.launched) u.pipe.push({ due: s.week + (g.cycle || 4), n: leads, a });
        else u.wait += leads;
        const due = u.pipe.filter(x => x.due <= s.week); u.pipe = u.pipe.filter(x => x.due > s.week);
        const dueN = sum(due.map(x => x.n));
        if (dueN > 0) {
          const ok = this.reqOk(k) && canPay;
          const conv = ok ? clamp(.12 + a * .7, 0, .75) * pF * (1 + caps.sales * .01) * pc : 0;
          const units = g.units || 1;
          if (m === 'device') {
            let buyers = r.binom(dueN, conv);
            const can = Math.floor(s.stock.units / units); if (buyers > can) { sr.lostStock = buyers - can; lost += sr.lostStock; buyers = can; }
            s.stock.units -= buyers * units; unitsSold += buyers * units; revenue += buyers * units * s.price[k] * this.promoPrice() * (1 - this.payFee(k));
            u.paid += buyers; u.paidEver += buyers; sr.newPaid = buyers;
          } else { const n = r.binom(dueN, conv); u.paid += n; u.paidEver += n; sr.newPaid = n; }
          if (!ok && dueN >= 1) rep.notes.push(`${g.short}: ${Math.round(dueN)} ${plural(Math.round(dueN), 'організація готова', 'організації готові', 'організацій готові')} була б купити, але ${!canPay ? 'не налаштовано оплату' : 'бракує функцій: ' + this.missingReq(k).map(f => this.feature(f).t).join(', ')}.`);
        }
      } else if (!s.product.launched) {
        u.wait += signups;
      } else {
        const fromWait = k === tg && s.pendingWait ? Math.round(s.pendingWait * .5) : 0;
        const newcomers = signups + fromWait;
        const actv = Math.round(newcomers * act0); sr.active = actv; u.ever += actv;
        if (m === 'device') {
          let buyers = r.binom(newcomers, clamp(pF * .55 * (.4 + a) * pc, 0, .95) * (canPay ? 1 : 0));
          const can = Math.floor(s.stock.units); if (buyers > can) { sr.lostStock = buyers - can; lost += sr.lostStock; buyers = can; }
          s.stock.units -= buyers; unitsSold += buyers; revenue += buyers * s.price[k] * this.promoPrice() * (1 - this.payFee(k));
          u.paid += buyers; u.paidEver += buyers; sr.newPaid = buyers;
        } else if (m === 'trial') {
          u.trial += actv;
          const resolve = Math.round(u.trial * .5), conv = canPay ? r.binom(resolve, clamp((.12 + a * .6) * pF * pc, 0, .9)) : 0;
          u.trial -= resolve; u.paid += conv; u.paidEver += conv; sr.newPaid = conv; sr.churned += resolve - conv;
        } else {
          u.free += actv;
          if (m === 'freemium' && canPay) { const conv = r.binom(u.free, clamp(.018 * pF * (.4 + a) * 2 * pc, 0, .5)); u.free -= conv; u.paid += conv; u.paidEver += conv; sr.newPaid = conv; }
        }
      }
      // відтік
      const cf = this.churnRate(k), cp = this.churnRate(k, true) * (s.loyalty ? LOYALTY.churn : 1);
      const lf = r.binom(u.free, cf), lp = m === 'device' ? 0 : r.binom(u.paid, cp);
      u.free -= lf; u.paid -= lp; sr.churned += lf + lp;
      if (m === 'device') { const quit = r.binom(u.paid, cp * .5); u.paid -= quit; sr.churned += quit; }
      if (sr.newPaid) refPaid += k === tg ? sr.newPaid * clamp(visits[k].wom / Math.max(1, V) , 0, 1) : 0;
      newPaidAll += sr.newPaid; churnAll += sr.churned;
      segRep[k] = sr;
      // виручка
      if (m === 'b2b' || m === 'freemium' || m === 'trial') {
        const sub = canPay ? (u.paid - sr.newPaid * (1 - this.promoPrice())) * s.price[k] / W2M * (1 - this.payFee(k)) : 0;
        if (this.payOf(k).crypto) revenue += sub * r.range(.88, 1.1);
        else if (g.b2b && (s.pay.b2b === 'invoice')) (s.recv ||= []).push({ due: s.week + 2, amt: sub });
        else revenue += sub;
      }
      if (m === 'free' || m === 'freemium') revenue += (u.free + u.paid) * (m === 'free' ? .45 : .08);
      const fc = sum(s.product.built.map(f => this.feature(f)?.cogs || 0));
      if (m !== 'device') cogs += u.paid * fc / W2M;
      else if (this.promoOn('bundle')) cogs += sr.newPaid * (g.units || 1) * s.unitCost * PROMOS.bundle.cogs;
    }
    if (s.product.launched) s.pendingWait = 0;
    if (lost) rep.notes.push(`Склад порожній: ${lost} ${plural(lost, 'клієнт пішов', 'клієнти пішли', 'клієнтів пішли')} без покупки. Замовте нову партію заздалегідь.`);

    /* рахунки організацій оплачуються із затримкою */
    if (s.recv?.length) { const due = s.recv.filter(x => x.due <= s.week); s.recv = s.recv.filter(x => x.due > s.week); revenue += sum(due.map(x => x.amt)); }
    /* склад (для пристроїв) */
    if (I.kind === 'hardware') { const arrived = s.stock.orders.filter(o => o.due <= s.week); s.stock.orders = s.stock.orders.filter(o => o.due > s.week); for (const o of arrived) { s.stock.units += o.n; rep.notes.push(`Прибула партія: ${o.n} пристроїв.`); } }

    /* витрати */
    const active = this.activeUsers();
    const servers = 500 + active * (this.hasFlag('infra') ? .3 : .65) + (I.kind === 'hardware' ? active * .2 : 0);
    const salaries = sum(s.team.map(m => m.salary)) / W2M;
    const refCost = Math.round(refPaid * s.mkt.referral); mkSpend.referral = refCost;
    const mkt = mkSpend.ads + mkSpend.bloggers + mkSpend.events + refCost;
    const formFee = s.company.form === 'fop' ? 1300 / W2M : s.company.form === 'tov' ? 6000 / W2M : 0;
    const tools = 400 + s.team.length * 150;
    let tax = 0;
    if (s.company.form === 'fop') tax = revenue * .05;
    const pre = revenue - (servers + salaries + mkt + formFee + tools + cogs);
    if (s.company.form === 'tov' && pre > 0) tax = pre * .18;
    const loyal = s.loyalty ? revenue * LOYALTY.cost : 0;
    const cost0 = servers + salaries + mkt + formFee + tools + cogs + tax + loyal;
    const cashMods = s.cash;
    this.modsWeek(rep, { visitors: sum(Object.values(visits[tg])) });
    const loanPay = rep.loanPay || 0;
    s.cash = cashMods + (s.cash - cashMods);
    const cost = cost0 + loanPay + (s.ledgerExtra || 0);
    s.cash += revenue - cost0; // разові витрати (ledgerExtra) і платіж за кредитом уже списані
    rep.money = { revenue, servers, salaries, mkt, formFee, tools, cogs, tax, loyal, loan: loanPay, extra: s.ledgerExtra || 0, invest: s.ledgerIn || 0 };
    s.ledgerExtra = 0; s.ledgerIn = 0;

    /* аварія серверів */
    if (s.product.launched && active > 200) {
      const risk = clamp(active / (this.hasFlag('infra') ? 90000 : 9000) * .25, 0, .35) + (p.debt > 60 ? .05 : 0);
      if (r.chance(risk)) {
        for (const k of this.segIds) { const u = s.users[k], l = Math.round(u.free * .06); u.free -= l; churnAll += l; }
        p.quality = Math.max(10, p.quality - 6);
        rep.events.push({ t: 'Сервери впали', d: 'Через навантаження застосунок не працював пів дня. Частина користувачів пішла. Допоможе функція масштабування серверів.' });
      }
    }

    /* команда */
    const growing = this.growth(4) > .05;
    for (const m of [...s.team]) {
      m.morale += (70 - m.morale) * .08 + (s.crunch ? -6 : 0) + (m.salary < this.marketSalary(m.role, m.skill) * .85 ? -2 : 0) + (growing ? 1 : 0) + (s.cash < salaries * 2 ? -4 : 0);
      m.morale = clamp(Math.round(m.morale), 0, 100);
      if (m.morale < 32 && r.chance(.18)) {
        s.team = s.team.filter(x => x !== m);
        this.mail({ from: m.name, kind: 'team', title: 'Я йду', body: `Вибачте, але я звільняюся. ${s.crunch ? 'Постійні переробки мене виснажили.' : 'Не бачу тут для себе перспектив.'} Дякую за досвід.` });
        rep.events.push({ t: `${m.name} звільнився`, d: 'Низька мораль: переробки, низька зарплата або відчуття, що компанія тоне.' });
      }
    }
    const team = sum(s.team.map(m => this.trait(m).team || 0)); if (team) for (const m of s.team) m.morale = clamp(m.morale + team * .3, 0, 100);

    /* засновник: енергія */
    const f = s.founder, worked = this.totalHours();
    f.energy = clamp(f.energy + (s.hours.rest - 8) * 1.6 - Math.max(0, worked - HOURS) * .9 - (s.crunch ? 2 : 0), 0, 100);
    if (f.energy < 8 && !s.flags.burnoutWeek) { s.flags.burnoutWeek = s.week; this.trigger('burnout', rep); }
    if (f.energy > 40) s.flags.burnoutWeek = 0;

    /* A/B-тест */
    if (s.landing.test?.done === s.week) { s.landing.last = { ...s.landing.test }; s.landing.tried.push(s.landing.test.a, s.landing.test.b); s.landing.test = null; this.award('ab'); rep.notes.push('A/B-тест лендінгу завершено — результати в розділі «Маркетинг».'); }

    /* інвестори */
    for (const [id, st] of Object.entries(s.inv)) {
      if (st.status === 'meeting' && st.week === s.week) this.resolvePitch(id);
      if (st.status === 'grantWait' && s.week - st.week >= 3) this.resolvePitch(id);
      if (st.status === 'offer' && s.week >= st.offer.until) { st.status = 'declined'; st.week = s.week; this.mail({ from: INVESTORS.find(x => x.id === id).t, kind: 'investor', title: 'Пропозиція більше не діє', body: 'Ви не відповіли вчасно, тож ми інвестували в інший проєкт.' }); }
    }
    if (s.flags.accelUntil === s.week + 1) { s.flags.accelDone = true; this.mail({ from: 'Акселератор «Стартовий майданчик»', kind: 'investor', title: 'Демо-день', body: 'Програма завершилась. Інвестори бачили ваш виступ — тепер вони охочіше йдуть на зустрічі.' }); }

    /* історія */
    const mrr = this.mrr();
    const rec = { week: s.week, cash: Math.round(s.cash), rev: Math.round(revenue), cost: Math.round(cost), mkt: Math.round(mkt), users: this.activeUsers(), paid: this.paidUsers(), mrr: Math.round(mrr),
      visitors: Math.round(sum(Object.values(segRep).map(x => x.visitors))), signups: sum(Object.values(segRep).map(x => x.signups)), newPaid: newPaidAll, churned: churnAll,
      nps: this.nps(), appeal: this.appeal(), quality: p.quality, port: Math.round(this.portValue()), bugs: Math.round(p.bugs), wait: sum(this.segIds.map(k => s.users[k].wait)), seg: segRep, units: unitsSold };
    s.history.push(rec);
    if (s.history.length > 160) s.history.shift();
    rep.rec = rec; rep.seg = segRep; rep.visits = visits[tg];

    /* досягнення */
    if (this.paidUsers() > 0) this.award('firstPay');
    if (this.paidUsers() >= 100) this.award('pay100');
    if (mrr >= 100000) this.award('mrr100');
    if (rec.wait >= 100 && !p.launched) this.award('waitlist');
    if (s.history.length >= 4 && s.history.slice(-4).every(x => x.rev > x.cost)) this.award('profit');
    const cac = this.cac(), ltv = this.ltv(); if (cac > 0 && Number.isFinite(cac) && ltv / cac >= 3 && this.paidUsers() >= 20) this.award('unit');
    if (this.runwayWeeks() < 2) s.flags.nearDeath = true; else if (s.flags.nearDeath && this.runwayWeeks() > 12) { this.award('survivor'); s.flags.nearDeath = false; }
    if (s.flags.pivotFrom && this.appeal(s.target) > this.appeal(s.flags.pivotFrom) + .05 && s.history.length > 4) { this.award('pivot'); s.flags.pivotFrom = null; }

    /* події */
    this.rollEvents(rep);

    /* наступний тиждень */
    s.week++; s.talks = 0; s.flags.meets = 0;
    if (s.week - (s.flags.candWeek ?? 0) >= 4) this.refreshCandidates();
    for (const e of s.inbox) if (e.choices && e.chosen == null && e.until != null && e.until < s.week) { e.chosen = -1; e.result = 'Ви не відповіли вчасно.'; const ev = EVENTS[e.ev]; ev?.expire?.(this, e); }

    /* кінець гри */
    // гроші закінчились: тиждень, щоб урятувати компанію (кредит, інвестиції, скорочення)
    if (s.cash < 0 && s.flags.broke != null && s.week - s.flags.broke >= 2) { s.over = { kind: 'bankrupt', week: s.week }; rep.over = s.over; }
    else if (s.cash < 0 && s.flags.broke == null) {
      s.flags.broke = s.week; rep.broke = true;
      this.mail({ from: 'Бухгалтерія', kind: 'finance', title: 'Гроші закінчилися!', body: `На рахунку ${money(s.cash)}. Зарплати й рахунки нічим платити. У вас 2 тижні, щоб вийти в плюс: скоротіть витрати (реклама, команда), візьміть замовлення на фрилансі, залучіть гроші або продайте інвестиції. Інакше компанія закриється.` });
    } else if (s.cash >= 0) s.flags.broke = null;
    if (!s.over && s.week >= WEEKS) { s.over = { kind: 'time', week: s.week }; rep.over = s.over; }
    rep.ach = s.newAch || []; s.newAch = [];
    rep.cashAfter = s.cash;
    s.last = { visits: Object.fromEntries(Object.entries(rep.visits || {}).map(([k, v]) => [k, Math.round(v)])), week: rep.week, notes: rep.notes, events: rep.events, ach: rep.ach, built: rep.built, rec: rep.rec, money: rep.money, cashBefore: rep.cashBefore, cashAfter: rep.cashAfter, over: rep.over || null };
    return rep;
  }

  rollEvents(rep) {
    const s = this.s, r = this.r;
    s.flags.evSeen ||= {};
    const pool = Object.entries(EVENTS).filter(([id, e]) => e.auto !== true && !s.flags.evSeen[id] || (e.repeat && s.week - (s.flags.evSeen[id] || -99) >= e.repeat)).filter(([, e]) => e.when?.(this));
    let fired = 0;
    for (const [id, e] of pool.sort(() => r.next() - .5)) {
      if (fired >= 1) break;
      if (r.chance(e.p ?? .3)) { this.trigger(id, rep); fired++; }
    }
  }
  trigger(id, rep) {
    const e = EVENTS[id]; if (!e) return;
    this.s.flags.evSeen[id] = this.s.week;
    const m = e.make(this);
    const msg = this.mail({ ev: id, kind: e.kind || 'event', from: m.from, title: m.title, body: m.body, choices: e.choices ? e.choices(this).map(c => c.t) : null, until: e.choices ? this.s.week + 1 : null, data: m.data });
    rep?.events.push({ t: m.title, d: 'Новий лист у пошті', mail: msg.id });
  }

  /* ── поради наставниці ── */
  tips() {
    const s = this.s, out = [], K = s.know[s.target], t = s.target, g = this.seg(t);
    const totalTalks = sum(Object.values(s.know).map(k => k.n));
    if (totalTalks === 0) out.push({ id: 'talk', text: 'Почніть з розмов: проведіть кілька інтерв\'ю з різними сегментами в розділі «Клієнти». Так ви дізнаєтеся, кому справді болить.', go: 'customers' });
    else if (totalTalks < 5 && !s.product.launched) out.push({ id: 'talk2', text: `Ви провели ${totalTalks} ${plural(totalTalks, 'інтерв\'ю', 'інтерв\'ю', 'інтерв\'ю')}. Для впевнених висновків варто хоча б 5–6 на сегмент.`, go: 'customers' });
    if (Object.values(s.know).some(k => k.likes >= 3 && k.good < 2)) out.push({ id: 'mom', text: 'Ви часто питаєте «Вам подобається ідея?». Люди з ввічливості кажуть «так» — це не доказ. Питайте про минуле: як вони розв\'язують проблему зараз і скільки на це витрачають.', go: 'help', term: 'Mom Test' });
    if (s.hours.customers < 3 && totalTalks < 3) out.push({ id: 'hours', text: 'Цього тижня у вас немає годин на клієнтів. Виділіть хоча б 6 годин у плані тижня — це 2 інтерв\'ю.', go: 'dash' });
    if (!s.product.launched && s.product.built.length === 0 && !s.product.queue.length && totalTalks >= 3) out.push({ id: 'build', text: 'Час будувати MVP: додайте в розробку 2–3 функції, які найбільше цінують клієнти (дивіться «Що бракує» в інсайтах).', go: 'product' });
    if (this.canLaunch() && s.product.built.filter(f => this.feature(f).core).length >= 1 && s.week > 2) out.push({ id: 'launch', text: 'У вас уже є робоча версія. Не чекайте ідеалу — запускайтеся! Справжні користувачі навчать більше, ніж ще місяць розробки.', go: 'product', term: 'MVP' });
    if (s.product.launched && !this.hasFlag('pay') && s.week - s.product.launchWeek > 3 && this.modelOf(t) !== 'free') out.push({ id: 'pay', text: 'Користувачі є, а оплатити вони не можуть — у продукті немає функції оплати. Додайте її в розробку.', go: 'product' });
    if (s.company.form === 'none' && (s.product.launched || s.week >= 6)) out.push({ id: 'form', text: 'Компанію ще не зареєстровано. Без ФОП або ТОВ ви не можете приймати оплату й залучати інвестиції. Це в розділі «Фінанси».', go: 'finance', term: 'ФОП і ТОВ' });
    const rw = this.runwayWeeks(); if (rw < 10 && s.week > 2) out.push({ id: 'runway', text: `Грошей вистачить приблизно на ${Math.max(0, Math.floor(rw))} ${plural(Math.floor(rw), 'тиждень', 'тижні', 'тижнів')}. Скоротіть витрати, підніміть виручку або шукайте інвестиції.`, go: 'finance', term: 'Runway', urgent: true });
    if (s.product.bugs > 15) out.push({ id: 'bugs', text: `${Math.round(s.product.bugs)} багів відганяють користувачів. Збільште частку часу на виправлення в розділі «Продукт» або перейдіть у режим «Якісно».`, go: 'product' });
    if (s.product.debt > 50) out.push({ id: 'debt', text: 'Технічний борг сповільнює розробку. Режим «Швидко» корисний на старті, але потім борг треба віддавати.', go: 'product', term: 'Технічний борг' });
    const cac = this.cac(), ltv = this.ltv(); if (s.mkt.ads > 0 && cac > 0 && Number.isFinite(cac) && ltv < cac && s.history.length > 4) out.push({ id: 'unit', text: `Один платний клієнт обходиться в ${money(cac)} реклами, а приносить за весь час лише ${money(ltv)}. Реклама зараз робить вас біднішими.`, go: 'pricing', term: 'Юніт-економіка' });
    if (s.product.launched && s.surveys.length === 0 && this.canSurvey()) out.push({ id: 'survey', text: 'Проведіть опитування користувачів — дізнаєтеся, чи є product-market fit і чого їм бракує.', go: 'customers', term: 'PMF' });
    if (s.product.launched && this.fit(t) < .45 && s.week - s.product.launchWeek > 4) out.push({ id: 'fit', text: `Продукт мало дає сегменту «${g.short}». Подивіться, чого бракує, в інсайтах інтерв'ю або подумайте про інший сегмент.`, go: 'customers', term: 'Півот' });
    if (g.b2b && !this.reqOk(t)) out.push({ id: 'req', text: `${g.short} не купують без: ${this.missingReq(t).map(f => this.feature(f).t).join(', ')}.`, go: 'product' });
    if (g.b2b && s.hours.sales < 5 && !s.team.some(m => m.role === 'sales')) out.push({ id: 'sales', text: 'Організації рідко купують самі. Для B2B потрібні прямі продажі: години засновника на «Продажі» або менеджер у команді.', go: 'dash', term: 'B2B' });
    if (this.I.kind === 'hardware' && s.product.launched && s.stock.units < 20 && !s.stock.orders.length) out.push({ id: 'stock', text: 'Склад майже порожній, а нова партія їде кілька тижнів. Замовте виробництво заздалегідь.', go: 'finance', term: 'Собівартість' });
    if (s.founder.energy < 30) out.push({ id: 'rest', text: 'Ви на межі вигорання. Додайте годин відпочинку — виснажений засновник працює гірше.', go: 'dash', urgent: true });
    if (s.crunch && s.team.some(m => m.morale < 45)) out.push({ id: 'crunch', text: 'Переробки виснажують команду. Ще кілька тижнів — і хтось звільниться.', go: 'team' });
    if (s.landing.cur < 0 && s.week >= 3) out.push({ id: 'landing', text: 'Оберіть заголовок лендінгу й перевірте його A/B-тестом — це безкоштовно підвищує кількість реєстрацій.', go: 'marketing', term: 'A/B-тест' });
    return out.filter(x => !s.dismissed[x.id] || x.urgent);
  }
}

/* ═════════ запитання для інтерв'ю ═════════ */
export const QUESTIONS = [
  { id: 'how', t: 'Як ви зараз розв\'язуєте {problem}?', hint: 'Дізнаєтеся, з чим конкуруєте' },
  { id: 'last', t: 'Розкажіть про останній раз, коли з цим були труднощі.', hint: 'Конкретна історія показує, наскільки болить' },
  { id: 'spend', t: 'Скільки часу чи грошей це вам зараз коштує?', hint: 'Реальні витрати — найкращий орієнтир для ціни' },
  { id: 'worst', t: 'Що в цьому найбільше дратує?', hint: 'Підкаже, яку функцію будувати першою' },
  { id: 'where', t: 'Де ви шукаєте поради чи нові сервіси для цього?', hint: 'Підкаже канал, де шукати клієнтів' },
  { id: 'like', t: 'Вам подобається наша ідея? {pitch}', bad: 'Підказувальне: про власну ідею люди з ввічливості кажуть «так».' },
  { id: 'pay', t: 'Скільки б ви заплатили за такий продукт?', bad: 'Про майбутнє: люди не знають, скільки заплатили б, і зазвичай завищують.' },
  { id: 'would', t: 'Ви б точно користувалися таким продуктом, правда?', bad: 'Підказувальне: ви самі підказуєте бажану відповідь.' },
];

/* ═════════ події ═════════ */
// when — коли може статися; p — імовірність на тиждень; choices — варіанти з наслідками
export const EVENTS = {
  form: { kind: 'mentor', p: .9, when: S => S.s.week >= 3 && S.s.company.form === 'none',
    make: () => ({ from: 'Наставниця Ірина', title: 'Час оформити компанію', body: 'Щоб приймати оплату від клієнтів, треба зареєструватися. Є два шляхи:\n\nФОП — просто й дешево: податок 5% від виручки й 1300 ₴ на місяць. Але інвестор не може купити частку у ФОП.\n\nТОВ — справжня компанія з частками: потрібна для інвестицій. Реєстрація 12 000 ₴, бухгалтер 6000 ₴ на місяць, податок 18% з прибутку.\n\nМожна вирішити й пізніше в розділі «Фінанси».' }),
    choices: () => [{ t: 'Зареєструвати ФОП', do: S => S.register('fop') ? 'Ви — ФОП. Тепер можна приймати оплату.' : '' }, { t: 'Зареєструвати ТОВ (12 000 ₴)', do: S => S.register('tov') ? 'Ви зареєстрували ТОВ. Тепер можна і приймати оплату, і залучати інвесторів.' : 'Не вистачає грошей на реєстрацію.' }, { t: 'Пізніше', do: () => 'Гаразд. Нагадаю: без реєстрації оплата не працюватиме.' }] },
  cofounder: { kind: 'team', p: .25, when: S => S.s.week >= 3 && S.s.week <= 14 && S.s.team.length === 0,
    make: S => { const role = S.s.founder.bg === 'dev' ? 'mkt' : 'dev'; return { from: 'Дмитро Савчук', title: 'Хочу бути співзасновником', data: { role }, body: `Привіт! Я ${role === 'dev' ? 'розробник із 6 роками досвіду' : 'маркетолог, запускав два застосунки'}. Бачив, над чим ти працюєш, — дуже хочу долучитися. Зарплата мені поки не потрібна, але хочу 25% компанії як співзасновник.` }; },
    choices: () => [{ t: 'Так, беру співзасновником (25%)', do: (S, e) => { const m = { id: S.id('m'), name: 'Дмитро Савчук', role: e.data.role, skill: 4, salary: 0, morale: 90, trait: 4, joined: S.s.week, cofounder: true }; S.s.team.push(m); S.issue(m.id, m.name, 'cofounder', .25); S.award('hire'); return 'Тепер ви вдвох! Ваша частка зменшилася, але продукт рухатиметься значно швидше.'; } }, { t: 'Дякую, ні', do: () => 'Ви залишили 100% компанії собі. Але й усю роботу — теж.' }] },
  customDeal: { p: .2, when: S => S.s.product.launched && S.s.week > 6,
    make: S => ({ from: 'Компанія «Рітейл-Плюс»', title: 'Замовлення на окрему розробку', body: `Добрий день! Нам дуже подобається ваш продукт, але потрібна спеціальна версія під наш бізнес. Заплатимо ${money(60000)}. Це приблизно 3 тижні роботи розробника.` }),
    choices: () => [{ t: 'Беремося (+60 000 ₴)', do: S => { S.s.cash += 60000; S.s.ledgerIn = (S.s.ledgerIn || 0) + 60000; S.s.product.debt += 14; S.s.product.queue.unshift('_custom'); S.s.product.progress._custom = 0; return 'Гроші отримано, але розробка основного продукту на кілька тижнів зупиниться, а код ускладниться.'; } }, { t: 'Відмовитися — фокус на продукті', do: () => 'Ви зберегли фокус. Іноді «ні» — найкраще рішення для стартапу.' }] },
  competitor: { p: .18, when: S => S.s.week > 8 && S.s.product.launched,
    make: S => ({ from: 'Новини ринку', title: 'Конкурент запустив схожий продукт', body: `Велика компанія показала продукт, дуже схожий на ваш, для сегмента «${S.seg().short}». У них більший рекламний бюджет. Що робимо?` }),
    choices: () => [{ t: 'Знизити ціну на 20%', do: S => { S.s.comp[S.s.target] = (S.s.comp[S.s.target] || 0) + .12; for (const k of S.segIds) S.s.price[k] = Math.round(S.s.price[k] * .8); return 'Ціни знижено. Клієнтам дешевше, але й ви заробляєте менше з кожного.'; } }, { t: 'Зосередитися на тому, що цінують наші клієнти', do: S => { S.s.comp[S.s.target] = (S.s.comp[S.s.target] || 0) + .08; return 'Правильно: великі гравці рідко розуміють нішу так глибоко, як ви. Тиск конкурента трохи відчутний.'; } }, { t: 'Ігнорувати', do: S => { S.s.comp[S.s.target] = (S.s.comp[S.s.target] || 0) + .15; return 'Конкурент забирає частину клієнтів.'; } }] },
  press: { p: .2, when: S => S.s.product.launched && S.activeUsers() > 150,
    make: () => ({ from: 'Журналістка Олена Ткаченко', title: 'Інтерв\'ю для онлайн-видання', body: 'Добрий день! Пишу статтю про молоді українські стартапи й хочу розповісти про вас. Знадобиться приблизно 5 годин вашого часу наступного тижня.' }),
    choices: () => [{ t: 'Погоджуюся', do: S => { S.s.flags.pressWeek = S.s.week + 1; S.s.hours.rest = Math.max(0, S.s.hours.rest - 5); return 'Стаття вийде наступного тижня — чекайте наплив відвідувачів. 5 годин відпочинку пішло на інтерв\'ю.'; } }, { t: 'Немає часу', do: () => 'Гаразд, можливо наступного разу.' }] },
  viral: { p: .12, repeat: 20, when: S => S.s.product.launched && S.nps() > 35 && S.activeUsers() > 100,
    make: () => ({ from: 'Аналітика', title: 'Про вас заговорили!', body: 'Користувач виклав відео про ваш продукт, і воно стало вірусним. Наступного тижня чекайте багато нових людей. Чи витримають сервери?' }),
    choices: () => [{ t: 'Супер!', do: S => { S.s.flags.viralWeek = S.s.week + 1; return 'Тримаємося!'; } }] },
  leak: { p: .15, when: S => S.s.product.launched && S.activeUsers() > 250 && !S.hasFlag('security') && S.s.week > 10,
    make: () => ({ from: 'Розробка', title: 'Витік даних користувачів', body: 'Ми знайшли вразливість: дані частини користувачів (імена й пошти) могли потрапити до сторонніх. Що робимо?' }),
    choices: () => [{ t: 'Чесно повідомити всіх і виправити', do: S => { for (const k of S.segIds) { const u = S.s.users[k]; u.free = Math.round(u.free * .94); u.paid = Math.round(u.paid * .97); } S.s.product.queue.unshift(S.has('security') ? S.s.product.queue[0] : Object.keys(S.I.features).find(f => S.feature(f).security) || S.s.product.queue[0]); S.s.product.queue = S.s.product.queue.filter(Boolean); return 'Частина користувачів пішла, але більшість оцінила чесність. Захист даних додано на початок розробки.'; } }, { t: 'Тихо виправити й нікому не казати', do: S => { if (S.r.chance(.6)) { for (const k of S.segIds) { const u = S.s.users[k]; u.free = Math.round(u.free * .75); u.paid = Math.round(u.paid * .8); } S.s.cash -= 80000; S.s.ledgerExtra = (S.s.ledgerExtra || 0) + 80000; return 'Через місяць журналісти дізналися про витік. Скандал: чверть користувачів пішла, а ще штраф 80 000 ₴. Приховувати — гірше, ніж визнати.'; } return 'Цього разу пронесло. Але ризик був величезний.'; } }] },
  acquire: { p: .3, when: S => S.mrr() > 120000 || S.activeUsers() > 6000,
    make: S => { const v = Math.round(S.valuation() * 1.4 / 100000) * 100000; return { from: 'Корпорація «Велика ІТ»', title: 'Пропозиція купити вашу компанію', data: { v }, body: `Ми хочемо придбати вашу компанію за ${money(v)}. Ваша частка — ${pct(S.stake(), 1)}, тобто ви особисто отримаєте ${money(v * S.stake())}. Гра закінчиться, але це успішний фінал.` }; },
    choices: () => [{ t: 'Продати компанію', do: (S, e) => { S.s.over = { kind: 'sold', week: S.s.week, value: e.data.v }; return 'Угоду підписано!'; } }, { t: 'Ні, будуємо далі', do: () => 'Ви вірите, що компанія коштуватиме більше. Ризиковано, але сміливо.' }] },
  intern: { kind: 'team', p: .15, when: S => S.s.week > 4 && S.s.team.length < 6,
    make: () => ({ from: 'Ярина Марченко', title: 'Можна до вас на стажування?', body: 'Я студентка, хочу набратися досвіду в стартапі. Готова допомагати з підтримкою клієнтів безкоштовно 3 місяці.' }),
    choices: () => [{ t: 'Беремо стажистку', do: S => { S.s.team.push({ id: S.id('m'), name: 'Ярина Марченко', fem: true, role: 'support', skill: 1, salary: 0, morale: 85, trait: 2, joined: S.s.week, intern: S.s.week + 13 }); return 'Ярина в команді. Не забудьте: через 3 місяці стажування закінчиться.'; } }, { t: 'Не зараз', do: () => 'Гаразд.' }] },
  blogger: { p: .15, when: S => S.s.product.launched && S.s.week > 6 && !S.seg().b2b,
    make: () => ({ from: 'Блогер Макс Олійник', title: 'Реклама за частку?', body: 'Привіт! У мене 400 тисяч підписників. Можу зробити велику інтеграцію про ваш продукт. Ціна — 90 000 ₴ або 2% вашої компанії.' }),
    choices: () => [{ t: 'Заплатити 90 000 ₴', do: S => { S.s.cash -= 90000; S.s.ledgerExtra = (S.s.ledgerExtra || 0) + 90000; S.s.flags.pressWeek = S.s.week + 1; return 'Інтеграція вийде наступного тижня.'; } }, { t: 'Віддати 2% компанії', do: S => { S.issue('blogger', 'Макс Олійник', 'other', .02); S.s.flags.pressWeek = S.s.week + 1; return 'Ви віддали частку. Сьогодні 2% — дрібниця, але якщо компанія виросте, це будуть великі гроші.'; } }, { t: 'Відмовитися', do: () => 'Гаразд.' }] },
  price: { p: .25, repeat: 16, when: S => S.s.product.launched && S.modelOf(S.s.target) !== 'free' && S.priceF() < .35 && S.activeUsers() > 40,
    make: () => ({ from: 'Відгуки користувачів', title: '«Занадто дорого»', body: 'Кілька користувачів написали, що продукт подобається, але ціна відлякує. Можливо, варто переглянути ціну в розділі «Ціна й гроші».' }) },
  bugs: { p: .3, repeat: 10, when: S => S.s.product.bugs > 18,
    make: () => ({ from: 'Відгуки користувачів', title: 'Одна зірка в магазині застосунків', body: '«Постійно вилітає, втратив усі дані. Не рекомендую!» Таких відгуків стає більше. Баги відлякують нових користувачів.' }) },
  burnout: { auto: true, kind: 'mentor',
    make: () => ({ from: 'Наставниця Ірина', title: 'Ви вигоріли', body: 'Ви довго працювали без відпочинку. Цього тижня ви майже нічого не можете робити, а рішення даються важко. Додайте відпочинку в план — інакше це повториться.' }) },
  supplier: { p: .15, when: S => S.I.kind === 'hardware' && S.s.week > 6,
    make: () => ({ from: 'Постачальник плат', title: 'Ціни на компоненти зросли', body: 'Через дефіцит чіпів ціна плати зросла на 25%. Можемо запропонувати дешевшого постачальника, але якість гірша.' }),
    choices: () => [{ t: 'Прийняти нову ціну', do: S => { S.s.unitCost = Math.round(S.s.unitCost * 1.25); return `Собівартість пристрою тепер ${money(S.s.unitCost)}.`; } }, { t: 'Дешевший постачальник', do: S => { S.s.product.quality = Math.max(10, S.s.product.quality - 12); S.s.product.bugs += 8; return 'Собівартість та сама, але пристрої частіше ламаються.'; } }] },
  regulation: { p: .2, when: S => S.s.idea === 'homework' && S.s.week > 12 && !S.hasFlag('security'),
    make: () => ({ from: 'Новини освіти', title: 'Нові правила захисту даних дітей', body: 'Міністерство вимагає, щоб усі освітні застосунки захищали дані дітей. Школи тепер працюють лише з тими, хто має захист. Функція «Захист даних дітей» стала ще важливішою.' }) },
  pilot: { p: .25, when: S => S.seg().b2b && S.s.product.launched && S.paidUsers(S.s.target) === 0 && S.s.week > 8,
    make: S => ({ from: 'Потенційний клієнт', title: 'Безкоштовний пілот?', body: `${S.seg().short}: одна організація хоче спершу спробувати безкоштовно 4 тижні, а потім вирішить. Пілот забере 6 годин продажів на тиждень.` }),
    choices: () => [{ t: 'Так, запускаємо пілот', do: S => { const u = S.s.users[S.s.target]; u.pipe.push({ due: S.s.week + 4, n: 2.4, a: .8 }); return 'Пілот іде. Якщо продукт справді корисний, через місяць вони, найімовірніше, заплатять.'; } }, { t: 'Лише платно', do: () => 'Організація вирішила не ризикувати.' }] },
  slump: { p: .2, when: S => S.season() < .6 && S.s.product.launched,
    make: S => ({ from: 'Аналітика', title: 'Сезонний спад', body: `Цього місяця відвідувачів помітно менше — для ідеї «${S.I.t}» це сезонне. Не панікуйте й не робіть висновків за один місяць: порівнюйте з тим самим сезоном.` }) },
};

applyMods(Sim);
