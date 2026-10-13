// Симулятор стартапу · модулі: бренд, акції, платіжні системи, фриланс,
// інвестування й криптовалюта, кредит і краудфандинг, бізнес-план, фінплан, спринти.
// Методи підмішуються в клас Sim (applyMods), щотижневий крок — modsWeek().
import { IDEAS, CHANNELS, FIRST, LAST, FEM } from './data.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sum = a => a.reduce((x, y) => x + y, 0);
const W2M = 52 / 12;
const fmt = n => Math.round(n).toLocaleString('uk-UA').replace(/ /g, ' ') + ' ₴';

/* ═════════ бренд ═════════ */
export const FONTS = {
  modern:  { t: 'Сучасний', css: "'Inter', system-ui, sans-serif", w: 800 },
  classic: { t: 'Класичний', css: "Georgia, 'Times New Roman', serif", w: 700 },
  playful: { t: 'Грайливий', css: "'Caveat', 'Comic Sans MS', cursive", w: 700 },
  tech:    { t: 'Технічний', css: "'JetBrains Mono', ui-monospace, monospace", w: 600 },
};
export const TONES = {
  friendly: { t: 'Дружній', ex: 'Привіт! Давай разом розберемося — це простіше, ніж здається.' },
  expert:   { t: 'Експертний', ex: 'Перевірений підхід, який економить вам 5 годин щотижня.' },
  fun:      { t: 'Веселий', ex: 'Нудно? Не з нами! Погнали!' },
  formal:   { t: 'Діловий', ex: 'Рішення для ефективної організації вашої роботи.' },
};
export const SYMBOLS = ['spark', 'leaf', 'book', 'rocket', 'bolt', 'heart', 'star', 'cube', 'wave', 'sun', 'compass', 'flame'];
export const PALETTE = ['#6366f1', '#0ea5e9', '#16a34a', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#111827', '#f97316'];
// Смаки сегментів: який тон і стиль їм ближчий
const TASTE = {
  students: { tone: ['fun', 'friendly'], font: ['playful', 'modern'] }, parents: { tone: ['friendly', 'expert'], font: ['classic', 'modern'] }, schools: { tone: ['formal', 'expert'], font: ['classic', 'modern'] },
  lovers: { tone: ['friendly', 'fun'], font: ['playful', 'classic'] }, farms: { tone: ['expert', 'formal'], font: ['modern', 'tech'] }, offices: { tone: ['formal', 'friendly'], font: ['modern', 'classic'] },
  kids: { tone: ['fun', 'friendly'], font: ['playful', 'modern'] }, teens: { tone: ['fun', 'friendly'], font: ['modern', 'playful'] }, adults: { tone: ['expert', 'friendly'], font: ['modern', 'classic'] },
  masters: { tone: ['friendly', 'fun'], font: ['modern', 'playful'] }, salons: { tone: ['friendly', 'formal'], font: ['modern', 'classic'] }, clinics: { tone: ['formal', 'expert'], font: ['classic', 'modern'] },
};
export const taste = k => TASTE[k] || { tone: ['friendly'], font: ['modern'] };
// Позиціонування: «Для кого — яка проблема — чим ми кращі»
export function positions(idea) {
  const I = typeof idea === 'string' ? IDEAS[idea] : idea, out = [];
  for (const [k, g] of Object.entries(I.segments)) {
    const comp = I.competitors.find(c => c.seg[k])?.t.toLowerCase() || 'звичних способів';
    out.push({ id: k, t: `Для сегмента «${g.short.toLowerCase()}», яким важливо ${I.problem}: ${I.pitch.replace(/\.$/, '').toLowerCase()} — на відміну від: ${comp}.` });
  }
  out.push({ id: 'vague', t: 'Для всіх, хто хоче, щоб життя стало кращим: найкращий продукт з найкращими функціями.' });
  return out;
}

/* ═════════ акції та стимулювання збуту ═════════ */
export const PROMOS = {
  discount: { t: 'Знижка 30% на перший місяць', weeks: 4, conv: 1.35, priceNew: .7, cost: 0, desc: 'Більше людей наважуються спробувати, але перший місяць ви заробляєте менше.' },
  sale:     { t: 'Сезонний розпродаж −40%', weeks: 2, conv: 1.65, priceNew: .6, visits: 1.15, desc: 'Сильний сплеск продажів. Найкраще працює в сезон: 1 вересня, Чорна п\'ятниця, Новий рік.' },
  giveaway: { t: 'Розіграш у соцмережах', weeks: 1, cost: 8000, aware: .05, social: 2500, desc: 'Призи за репост: зростає впізнаваність і аудиторія соцмереж. Призи коштують 8 000 ₴.' },
  code:     { t: 'Промокод для блогерів', weeks: 4, blog: 1.35, priceNew: .85, desc: 'Підписники блогера отримують знижку 15% — реклама в блогерів працює краще, і ви бачите, скільки клієнтів привів саме промокод.' },
  bundle:   { t: '«Подарунок до покупки»', weeks: 3, conv: 1.3, cogs: .15, hw: true, desc: 'Безкоштовний аксесуар до пристрою: більше покупок, але кожен продаж дорожчий для вас на 15%.' },
};
export const LOYALTY = { t: 'Програма лояльності', churn: .8, cost: .04, desc: 'Бонуси постійним клієнтам: платні клієнти йдуть рідше, але програма коштує 4% виручки.' };

/* ═════════ платіжні системи ═════════ */
export const PAYMENTS = {
  agg:     { t: 'Платіжний агрегатор', fee: .029, ok: .96, setup: 0, desc: 'Готова сторінка оплати з Apple Pay і Google Pay, автоматичні списання підписок. Просто підключити.' },
  bank:    { t: 'Еквайринг банку', fee: .019, ok: .88, setup: 4000, desc: 'Картки напряму через банк: комісія нижча, але підключення платне й частіше трапляються відмови.' },
  store:   { t: 'Магазин застосунків', fee: .15, ok: .98, setup: 0, apps: true, visits: 1.12, desc: 'Оплата через App Store і Google Play: найзручніше для користувача, магазин ще й показує вас людям, але забирає 15%.' },
  invoice: { t: 'Рахунок для організацій', fee: 0, ok: 1, setup: 0, b2b: true, desc: 'Безготівковий рахунок-фактура без комісії. Лише для організацій; гроші приходять із затримкою.' },
  crypto:  { t: 'Криптоплатежі', fee: .01, ok: .3, setup: 0, crypto: true, desc: 'Комісія мала, але криптою платить мало хто, а її курс за тиждень може змінитися на 10%.' },
};

/* ═════════ фриланс ═════════ */
export const TASKS = {
  logo:    { t: 'Логотип і фірмовий стиль', base: 7000, weeks: 1, desc: 'Логотип, кольори, шрифт.' },
  landing: { t: 'Дизайн лендінгу', base: 16000, weeks: 2, desc: 'Сторінка, на яку приходять відвідувачі: краще дизайн — більше реєстрацій.' },
  copy:    { t: 'Тексти для сайту', base: 5000, weeks: 1, desc: 'Зрозумілі продаючі тексти.' },
  video:   { t: 'Промо-відео', base: 22000, weeks: 2, desc: 'Ролик для реклами й краудфандингу.' },
  smm:     { t: 'Ведення соцмереж на місяць', base: 12000, weeks: 4, desc: 'Фрилансер щотижня робить контент замість вас.' },
  illus:   { t: 'Ілюстрації для продукту', base: 9000, weeks: 2, desc: 'Продукт виглядає приємніше й зрозуміліше.' },
};
const GIGS = {
  dev:    [['Сайт-візитка для пекарні', 14000, 18], ['Виправити помилки в інтернет-магазині', 7000, 8], ['Бот для запису до перукарні', 11000, 14], ['Лендінг для фітнес-тренера', 9000, 12]],
  design: [['Логотип для кав\'ярні', 6000, 8], ['Банери для акції магазину', 4000, 6], ['Дизайн меню ресторану', 7000, 10], ['Обкладинки для подкасту', 3500, 5]],
  mkt:    [['Налаштувати рекламу квіткового магазину', 8000, 10], ['Контент-план для салону', 5000, 7], ['Тексти для сайту автосервісу', 4500, 6], ['Аудит Instagram-сторінки', 3000, 4]],
  sales:  [['Знайти 20 клієнтів для студії йоги', 10000, 14], ['Провести переговори з постачальником', 6000, 8], ['Скрипт продажів для колл-центру', 5000, 7], ['Обдзвонити базу клієнтів', 4000, 8]],
};

/* ═════════ інвестування ═════════ */
export const ASSETS = {
  deposit: { t: 'Депозит у банку', y: .125, vol: 0, fee: 0, risk: 'Дуже низький', desc: 'Фіксований відсоток. Якщо забрати раніше ніж за 3 місяці — відсотки згорають.' },
  ovdp:    { t: 'Державні облігації (ОВДП)', y: .155, vol: .015, fee: .002, risk: 'Низький', desc: 'Позика державі під відсоток. Надійно, продати можна будь-коли з невеликою комісією.' },
  index:   { t: 'Індексний фонд акцій', y: .09, vol: .17, fee: .003, risk: 'Середній', desc: 'Частинка сотень великих компаній світу. У довгу виростає, але за рік може впасти на 20%.' },
  crypto:  { t: 'Біткоїн', y: .25, vol: .75, fee: .005, risk: 'Дуже високий', desc: 'Криптовалюта: за місяць може і подвоїтися, і впасти вдвічі.' },
  meme:    { t: 'Токен «СуперКоїн»', y: 0, vol: 0, fee: .02, risk: 'Шахрайство', hidden: true, desc: 'Новий токен, який «точно виросте в 100 разів». Його рекламують анонімні акаунти.' },
};

/* ═════════ бізнес-план (Lean Canvas) ═════════ */
export const CANVAS = {
  problem:   { t: 'Проблема', hint: 'Яку проблему ви розв\'язуєте і для кого вона болюча.' },
  segment:   { t: 'Сегменти клієнтів', hint: 'Хто ваш перший клієнт.' },
  uvp:       { t: 'Унікальна цінність', hint: 'Одне речення: чому обирають вас.' },
  solution:  { t: 'Рішення', hint: 'Головні функції продукту.' },
  channels:  { t: 'Канали', hint: 'Де ви знайдете клієнтів.' },
  revenue:   { t: 'Потоки доходів', hint: 'Як і скільки ви заробляєте.' },
  costs:     { t: 'Структура витрат', hint: 'На що йдуть гроші.' },
  metrics:   { t: 'Ключові метрики', hint: 'За якими цифрами видно, що все йде добре.' },
  advantage: { t: 'Конкурентна перевага', hint: 'Те, що важко скопіювати.' },
};
export const METRICS = { mrr: 'Щомісячна виручка (MRR)', churn: 'Відтік клієнтів', cac: 'Вартість залучення клієнта (CAC)', active: 'Активні користувачі за тиждень', likes: 'Лайки в соцмережах', downloads: 'Кількість завантажень' };
export const VANITY = new Set(['likes', 'downloads']);
export const ADVANTAGES = {
  know: { t: 'Глибоке знання клієнтів: десятки інтерв\'ю й даних', good: S => sum(Object.values(S.s.know).map(k => k.good)) >= 10 },
  team: { t: 'Команда з досвідом саме в цій сфері', good: S => S.s.team.length >= 2 },
  users: { t: 'Спільнота користувачів, які радять нас друзям', good: S => S.nps() >= 30 && S.activeUsers() >= 200 },
  hard: { t: 'Ми працюємо більше за всіх', bad: 'Це не перевага: конкуренти теж можуть працювати багато.' },
  idea: { t: 'Унікальна ідея, якої ні в кого немає', bad: 'Ідею легко скопіювати, і схожі майже завжди вже існують.' },
};

/* ═════════ методи ═════════ */
const M = {
  initMods() {
    const s = this.s;
    s.brand ||= { font: null, tone: null, position: null, logo: null, persona: null, aware: 0 };
    s.promos ||= []; s.promoLog ||= []; s.loyalty ??= false;
    s.pay ||= { main: null, b2b: null, seen: [] };
    s.orders ||= []; s.offersFl ||= {}; s.gigs ||= []; s.gigsDone ??= 0; s.gigIncome ??= 0; s.rating ??= 0; s.myGigs ||= [];
    s.port ||= {}; s.loan ??= null; s.crowd ??= null; s.plan ??= null; s.canvas ||= {};
    s.sprint ??= null; s.sprints ||= []; s.retroBuff ??= null; s.journal ||= [];
    s.hours.freelance ??= 0;
    s.fl ||= { landing: 0, copy: 0, video: 0, illus: 0, smmUntil: -1 };
  },

  /* ── бренд ── */
  brandFit(k = this.s.target) {
    const b = this.s.brand, t = this.seg(k).taste || taste(k);
    const tone = !b.tone ? .3 : t.tone[0] === b.tone ? 1 : t.tone.includes(b.tone) ? .75 : .15;
    const font = !b.font ? .3 : t.font[0] === b.font ? 1 : t.font.includes(b.font) ? .75 : .2;
    const pos = !b.position ? .3 : b.position === k ? 1 : b.position === 'vague' ? 0 : .35;
    const logo = b.logo ? b.logo.q : .2;
    return (tone + font + pos * 1.4 + logo) / 4.4;
  },
  trustM(k) { return .82 + .33 * this.brandFit(k); },
  setBrand(key, v) { if (this.s.brand[key] === v) return; this.s.brand[key] = v; const t = { font: () => `шрифт «${FONTS[v]?.t}»`, tone: () => `тон «${TONES[v]?.t}»`, position: () => v === 'vague' ? 'розмите позиціонування «для всіх»' : `позиціонування для «${this.seg(v)?.short}»` }[key]; if (t) this.log(`Бренд: ${t()}.`); },
  drawLogo() {
    // логотип своїми силами: забирає 6 годин із розробки цього тижня
    if (this.hoursNow().product < 6) return null;
    const q = clamp(.25 + .2 * this.fSkill().design + this.r.range(-.05, .1), .2, .95);
    this.addBusy(this.s.week, 'product', 6); this.s.brand.logo = { q, by: 'self' }; this.log(`Логотип зроблено самостійно: якість ${Math.round(q * 100)}%.`);
    return q;
  },

  /* ── акції ── */
  promoOn(id) { return this.s.promos.some(p => p.id === id && p.until > this.s.week); },
  startPromo(id) {
    const P = PROMOS[id]; if (!P || this.promoOn(id)) return false;
    if (P.hw && this.I.kind !== 'hardware') return false;
    if (P.cost) { if (this.s.cash < P.cost) return false; this.s.cash -= P.cost; this.s.ledgerExtra = (this.s.ledgerExtra || 0) + P.cost; }
    this.s.promos.push({ id, until: this.s.week + P.weeks, start: this.s.week });
    this.s.promoLog.push({ id, week: this.s.week, season: this.season() }); this.log(`Запущено акцію: ${P.t}.`);
    if (P.aware) this.s.brand.aware = clamp(this.s.brand.aware + P.aware, 0, 1);
    if (P.social) this.s.organic.social += P.social;
    return true;
  },
  promoConv() { return this.s.promos.filter(p => p.until > this.s.week).reduce((a, p) => a * (PROMOS[p.id].conv || 1), 1); },
  promoPrice() { return this.s.promos.filter(p => p.until > this.s.week).reduce((a, p) => Math.min(a, PROMOS[p.id].priceNew || 1), 1); },
  promoVisits() { return this.s.promos.filter(p => p.until > this.s.week).reduce((a, p) => a * (PROMOS[p.id].visits || 1), 1); },
  promoBlog() { return this.promoOn('code') ? PROMOS.code.blog : 1; },

  /* ── платежі ── */
  setPay(id, which = 'main') {
    const P = PAYMENTS[id]; if (!P) return false;
    if (P.b2b && which !== 'b2b') return false;
    if (P.apps && this.I.kind === 'hardware') return false;
    if (P.setup && !(this.s.pay.paid || []).includes(id)) { if (this.s.cash < P.setup) return false; this.s.cash -= P.setup; this.s.ledgerExtra = (this.s.ledgerExtra || 0) + P.setup; (this.s.pay.paid ||= []).push(id); }
    if (this.s.pay[which] !== id) this.log(`Платіжна система${which === 'b2b' ? ' для організацій' : ''}: ${P.t}.`);
    this.s.pay[which] = id; this.seePay(id);
    return true;
  },
  seePay(id) { const s = this.s.pay.seen; if (!s.includes(id)) s.push(id); },
  payOf(k) { const b2b = this.seg(k).b2b; return PAYMENTS[(b2b && this.s.pay.b2b) || this.s.pay.main || 'agg']; },
  payOk(k) { return this.payOf(k).ok; },
  payFee(k) { return this.payOf(k).fee; },

  /* ── фриланс: замовити ── */
  freelancers(task) {
    const s = this.s; if (s.offersFl[task]?.week === s.week) return s.offersFl[task].list;
    const T = TASKS[task], r = this.r, list = [];
    for (let i = 0; i < 4; i++) {
      const rating = Math.round(clamp(r.norm(4.4, .45), 3.1, 5) * 10) / 10, reviews = Math.max(0, Math.round(Math.exp(r.norm(3, 1.3))) - (i === 3 ? 20 : 0));
      const first = r.pick(FIRST);
      const price = Math.round(T.base * (.45 + (rating - 3) * .45) * r.range(.8, 1.25) / 100) * 100;
      const q = clamp(r.norm(rating / 5 - .1 + Math.min(reviews, 100) / 1000, .12), .1, 1);
      list.push({ id: this.id('f'), name: `${first} ${r.pick(LAST)}`, fem: FEM.has(first), rating: reviews ? rating : null, reviews, price, weeks: T.weeks + (r.chance(.25) ? 1 : 0), q, scam: !reviews && r.chance(.5) });
    }
    // підозріло дешевий новачок без відгуків
    list[3].price = Math.round(T.base * .3 / 100) * 100; list[3].rating = null; list[3].reviews = 0; list[3].scam = r.chance(.6);
    s.offersFl[task] = { week: s.week, list };
    return list;
  },
  order(task, fid, escrow = true) {
    const s = this.s, f = s.offersFl[task]?.list.find(x => x.id === fid); if (!f) return false;
    const fee = escrow ? Math.round(f.price * .08) : 0, total = f.price + fee;
    if (s.cash < total) return false;
    s.cash -= total; s.ledgerExtra = (s.ledgerExtra || 0) + total;
    this.log(`Замовлення фрилансеру: ${TASKS[task].t} — ${f.name}, ${fmt(total)}${escrow ? ', безпечна угода' : ', оплата напряму'}.`);
    s.orders.push({ id: this.id('o'), task, who: f.name, rating: f.rating, price: f.price, fee, escrow, due: s.week + f.weeks, q: f.q, scam: f.scam, status: 'work' });
    s.offersFl[task].list = s.offersFl[task].list.filter(x => x !== f);
    return true;
  },
  applyOrder(o) {
    const q = o.q, s = this.s;
    if (o.task === 'logo') { if (!s.brand.logo || s.brand.logo.q < q) s.brand.logo = { q, by: o.who }; }
    else if (o.task === 'smm') s.fl.smmUntil = s.week + 4, s.fl.smmQ = q;
    else s.fl[o.task] = Math.max(s.fl[o.task] || 0, q);
    if (o.task === 'illus') s.product.quality = clamp(s.product.quality + q * 8, 0, 98);
  },
  revise(oid) { const o = this.s.orders.find(x => x.id === oid); if (!o || o.status !== 'weak' || !o.escrow || o.revised) return false; o.revised = true; this.log(`Запит на доопрацювання: ${TASKS[o.task].t}.`); o.status = 'work'; o.due = this.s.week + 1; o.q = clamp(o.q + .25, 0, .95); return true; },
  // множник реєстрацій від роботи фрилансерів
  flSignup() { const f = this.s.fl; return 1 + f.landing * .18 + f.copy * .1 + f.illus * .03; },
  flContent() { return this.s.fl.smmUntil > this.s.week ? 6 * (this.s.fl.smmQ || .5) : 0; },

  /* ── фриланс: виконати самому ── */
  refreshGigs() {
    const bg = this.s.founder.bg, r = this.r, pool = GIGS[bg];
    const out = [];
    for (const [t, pay, hours] of [...pool].sort(() => r.next() - .5).slice(0, 3)) {
      const first = r.pick(FIRST);
      out.push({ id: this.id('g'), t, pay: Math.round(pay * r.range(.85, 1.2) / 100) * 100, hours, client: `${first} ${r.pick(LAST)}`, ghost: r.chance(.2) });
    }
    this.s.gigs = out; this.s.flags.gigWeek = this.s.week;
  },
  takeGig(gid, terms = 'prepay') {
    const g = this.s.gigs.find(x => x.id === gid); if (!g || this.s.myGigs.length >= 2) return false;
    this.s.gigs = this.s.gigs.filter(x => x !== g);
    const deal = { ...g, terms, done: 0, start: this.s.week, deadline: this.s.week + Math.ceil(g.hours / 10) + 1 };
    if (terms === 'prepay') { const a = Math.round(g.pay / 2); this.s.cash += a; this.s.ledgerIn = (this.s.ledgerIn || 0) + a; deal.got = a; }
    this.s.myGigs.push(deal); this.log(`Взято фриланс-замовлення: «${g.t}», ${fmt(g.pay)} (${{ prepay: 'передоплата 50%', escrow: 'безпечна угода', none: 'без передоплати' }[terms]}).`);
    return true;
  },

  /* ── інвестування ── */
  portValue() { return sum(Object.values(this.s.port).map(x => x.v || 0)); },
  riskyShare() { const risky = sum(['index', 'crypto', 'meme'].map(k => this.s.port[k]?.v || 0)); const tot = this.s.cash + this.portValue(); return tot > 0 ? risky / tot : 0; },
  buy(a, amt) {
    const A = ASSETS[a]; amt = Math.round(amt); if (!A || amt <= 0 || amt > this.s.cash) return false;
    if (a === 'meme') this.s.flags.memeBought = true;
    const p = this.s.port[a] ||= { v: 0, in: 0, since: this.s.week };
    p.v += amt * (1 - A.fee); p.in += amt; if (a === 'deposit') p.since = this.s.week;
    this.s.cash -= amt; this.s.flags.invested = true; this.log(`Вкладено ${fmt(amt)}: ${A.t}.`);
    return true;
  },
  sell(a, amt) {
    const A = ASSETS[a], p = this.s.port[a]; if (!A || !p || p.v <= 0) return 0;
    amt = Math.min(p.v, Math.round(amt ?? p.v));
    let got = amt * (1 - A.fee);
    if (a === 'deposit' && this.s.week - p.since < 13) { const share = amt / p.v; got = Math.min(got, p.in * share); }
    p.in = p.in * (1 - amt / p.v); p.v -= amt; if (p.v < 1) delete this.s.port[a];
    this.s.cash += got; this.log(`Продано вкладення (${A.t}): отримано ${fmt(got)}.`);
    return Math.round(got);
  },

  /* ── кредит і краудфандинг ── */
  loanLimit() {
    if (this.s.company.form === 'none' || (this.s.loan && !this.s.loan.closed)) return 0;
    const h = this.s.history.slice(-8); if (h.length < 8 || !h.some(x => x.rev > 0)) return 0;
    return Math.round(sum(h.map(x => x.rev)) / 8 * W2M * 4 / 10000) * 10000;
  },
  takeLoan(amt, months = 12) {
    const lim = this.loanLimit(); amt = Math.round(amt); if (amt <= 0 || amt > lim) return false;
    const rate = .26, i = rate / 52, n = Math.round(months * W2M), pay = amt * i / (1 - Math.pow(1 + i, -n));
    this.s.loan = { amt, rate, n, left: n, pay: Math.round(pay), owed: amt, start: this.s.week };
    this.s.cash += amt; this.s.ledgerIn = (this.s.ledgerIn || 0) + amt; this.log(`Взято кредит ${fmt(amt)} під ${Math.round(rate * 100)}% річних на ${months} міс.`);
    return true;
  },
  canCrowd() { return !this.s.crowd || this.s.crowd.status === 'failed'; },
  startCrowd(goal, reward) {
    if (!this.canCrowd()) return false;
    this.s.crowd = { goal: Math.round(goal), reward: Math.round(reward), start: this.s.week, end: this.s.week + 4, raised: 0, backers: 0, status: 'live' };
    this.log(`Запущено краудфандинг: мета ${fmt(goal)}, винагорода ${fmt(reward)}.`);
    return true;
  },

  /* ── бізнес-план ── */
  setCanvas(k, v) { this.s.canvas[k] = v; },
  canvasFilled() { const c = this.s.canvas; return Object.keys(CANVAS).filter(k => { const v = c[k]; return Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim().length >= 3); }).length; },
  // Перевірка блоків даними: ok — підтверджено, warn — припущення, bad — суперечить даним
  canvasCheck() {
    const c = this.s.canvas, out = {}, seg = this.I.segments[c.segment] ? c.segment : this.s.target, K = this.insight(seg);
    out.problem = !c.problem ? null : (K.pain != null && K.pain >= .5 ? { s: 'ok', m: `Інтерв'ю підтверджують: біль ${Math.round(K.pain * 10)}/10.` } : K.pain != null ? { s: 'bad', m: 'Інтерв\'ю показують, що для цього сегмента проблема не дуже болюча.' } : { s: 'warn', m: 'Поки що припущення: проведіть інтерв\'ю.' });
    out.segment = !this.I.segments[c.segment] ? null : c.segment === this.s.target ? { s: 'ok', m: 'Збігається з цільовим сегментом.' } : { s: 'warn', m: 'Ваш маркетинг зараз націлений на інший сегмент.' };
    out.uvp = !c.uvp ? null : c.uvp.length > 140 ? { s: 'warn', m: 'Задовго: цінність має вміщатися в одне коротке речення.' } : { s: 'ok', m: 'Коротко й зрозуміло.' };
    const sol = c.solution || [];
    out.solution = !sol.length ? null : sol.every(f => (this.feature(f)?.v?.[seg] || 0) > 0 || this.feature(f)?.pay) ? { s: 'ok', m: 'Ці функції цінні для сегмента.' } : { s: 'warn', m: 'Деякі функції не дуже потрібні цьому сегменту.' };
    const ch = c.channels || [];
    out.channels = !ch.length ? null : (K.ch.length && ch.some(x => K.ch.slice(0, 2).some(([y]) => y === x)) ? { s: 'ok', m: 'Клієнти в інтерв\'ю називали ці канали.' } : K.ch.length ? { s: 'bad', m: `Клієнти частіше згадують: ${K.ch.slice(0, 2).map(([y]) => CHANNELS[y]?.t.toLowerCase()).join(', ')}.` } : { s: 'warn', m: 'Запитайте в інтерв\'ю, де клієнти шукають рішення.' });
    out.revenue = !c.revenue ? null : { s: 'ok', m: 'Модель описано.' };
    out.costs = !c.costs ? null : { s: 'ok', m: 'Витрати описано.' };
    const m = c.metrics || [];
    out.metrics = !m.length ? null : m.some(x => VANITY.has(x)) ? { s: 'bad', m: 'Лайки й завантаження — «метрики марнославства»: вони тішать, але не показують, чи заробляє бізнес.' } : { s: 'ok', m: 'Метрики показують реальний стан бізнесу.' };
    const adv = ADVANTAGES[c.advantage];
    out.advantage = !adv ? null : adv.bad ? { s: 'bad', m: adv.bad } : adv.good(this) ? { s: 'ok', m: 'Підтверджено вашими даними.' } : { s: 'warn', m: 'Поки що це лише намір.' };
    return out;
  },

  /* ── фінплан ── */
  setPlan(months) { this.log(`Складено фінплан на 3 місяці: виручка ${months.map(m => fmt(m.rev)).join(' / ')}.`); this.s.plan = { week: this.s.week, months: months.map(m => ({ rev: Math.max(0, Math.round(m.rev)), cost: Math.max(0, Math.round(m.cost)) })) }; },
  planFact() {
    const p = this.s.plan; if (!p) return [];
    return p.months.map((m, i) => {
      const from = p.week + Math.round(i * W2M), to = p.week + Math.round((i + 1) * W2M);
      const h = this.s.history.filter(x => x.week >= from && x.week < to);
      const full = this.s.week >= to;
      return { ...m, from, to, full, weeks: h.length, rev: m.rev, cost: m.cost, frev: sum(h.map(x => x.rev)), fcost: sum(h.map(x => x.cost)) };
    });
  },
  planScore() { const f = this.planFact()[0]; if (!f || !f.full || !f.rev) return 0; return clamp(f.frev / f.rev, 0, 2) > 1 ? 1 : f.frev / f.rev; },
  breakEven(k = this.s.target) {
    const fixed = this.fixedCosts() * W2M + this.s.mkt.ads * W2M;
    const m = this.modelOf(k), g = this.seg(k);
    const cogs = sum(this.s.product.built.map(f => this.feature(f)?.cogs || 0));
    if (m === 'device') { const margin = this.s.price[k] - this.s.unitCost; return { fixed, margin, need: margin > 0 ? Math.ceil(fixed / margin) : Infinity, unit: ['пристрій на місяць', 'пристрої на місяць', 'пристроїв на місяць'] }; }
    const margin = this.s.price[k] * (1 - this.payFee(k)) - cogs - (g.b2b ? 0 : .65 * W2M);
    return { fixed, margin, need: margin > 0 ? Math.ceil(fixed / margin) : Infinity, unit: g.b2b ? ['організація-клієнт', 'організації-клієнти', 'організацій-клієнтів'] : ['платний клієнт', 'платні клієнти', 'платних клієнтів'] };
  },

  /* ── спринти ── */
  startSprint(ids, len = 2) {
    if (this.s.sprint) return false;
    const p = this.s.product, plan = ids.filter(id => this.feature(id) && !this.has(id));
    if (!plan.length) return false;
    p.queue = [...plan, ...p.queue.filter(x => !plan.includes(x))];
    const planned = sum(plan.map(id => this.feature(id).cost - (p.progress[id] || 0)));
    this.log(`Розпочато спринт ${this.s.sprints.length + 1}: ${plan.map(id => this.feature(id).t).join(', ')} (${Math.round(planned)} оч.).`);
    this.s.sprint = { n: this.s.sprints.length + 1, start: this.s.week, len, plan, planned: Math.round(planned), burn: [Math.round(planned)], crunch: this.s.crunch };
    return true;
  },
  velocity() { const v = this.s.sprints.slice(-3); return v.length ? Math.round(sum(v.map(x => x.done)) / v.length) : null; },
  retro(choice) {
    const last = this.s.sprints.at(-1); if (!last || last.retro) return false;
    last.retro = choice; this.log(`Ретроспектива спринту ${last.n}: ${{ focus: 'більше фокусу', tests: 'писати тести', pair: 'робота в парах', rest: 'відпочити' }[choice]}.`); this.s.retroBuff = { k: choice, until: this.s.week + 2 };
    if (choice === 'pair') for (const m of this.s.team) m.morale = clamp(m.morale + 6, 0, 100);
    if (choice === 'rest') this.s.founder.energy = clamp(this.s.founder.energy + 12, 0, 100);
    return true;
  },
  retroSpeed() { const b = this.s.retroBuff; return b && b.until > this.s.week && b.k === 'focus' ? 1.1 : 1; },
  retroBugs() { const b = this.s.retroBuff; return b && b.until > this.s.week && b.k === 'tests' ? .65 : 1; },
  channelsUsed() { const s = this.s, v = s.history.at(-1); let n = 0; if (s.mkt.ads > 0) n++; if (s.mkt.bloggers > 0) n++; if (s.mkt.events > 0) n++; if (s.mkt.referral > 0) n++; if (s.organic.social > 50) n++; if (s.organic.seo > 50) n++; if (s.hours.sales > 0 && this.seg().b2b) n++; return n; },

  /* ── щотижневий крок модулів ── */
  modsWeek(rep, ctx) {
    const s = this.s, r = this.r, I = this.I;
    // впізнаваність бренду: росте від охоплення, повільно забувається
    const reach = ctx.visitors || 0, size = Math.max(this.seg().size, 40000); // на дуже малих ринках впізнаваність не злітає миттєво
    s.brand.aware = clamp(s.brand.aware * .985 + reach / (size * .06) * (.5 + this.brandFit() * .7) * .4, 0, .95);

    // акції: витрати на лояльність
    s.promos = s.promos.filter(p => p.until > s.week - 1);
    // замовлення фрилансерам
    for (const o of s.orders.filter(x => x.status === 'work' && x.due <= s.week)) {
      if (o.scam) {
        o.status = o.escrow ? 'refund' : 'lost';
        if (o.escrow) { s.cash += o.price; s.ledgerIn = (s.ledgerIn || 0) + o.price; }
        this.mail({ from: 'Фриланс-біржа', kind: 'freelance', title: o.escrow ? 'Виконавець зник — гроші повернуто' : 'Виконавець зник разом із передоплатою', body: o.escrow ? `${o.who} не здав роботу. Завдяки безпечній угоді біржа повернула вам ${fmt(o.price)}.` : `${o.who} перестав відповідати. Ви платили напряму, тож ${fmt(o.price)} втрачено. Безпечна угода коштувала б лише 8%.` });
        continue;
      }
      o.q = clamp(o.q + r.norm(0, .06), .05, 1);
      if (o.q < .45 && o.escrow && !o.revised) { o.status = 'weak'; this.mail({ from: 'Фриланс-біржа', kind: 'freelance', title: `Результат слабкий: ${TASKS[o.task].t.toLowerCase()}`, body: `${o.who} здав роботу, але якість ${Math.round(o.q * 100)}%. У безпечній угоді можна попросити доопрацювання — розділ «Фриланс».` }); continue; }
      o.status = 'done'; this.applyOrder(o);
      this.mail({ from: o.who, kind: 'freelance', title: `Готово: ${TASKS[o.task].t.toLowerCase()}`, body: `Роботу здано. Якість: ${Math.round(o.q * 100)}%.${o.q < .5 ? ' Чесно кажучи, могло бути й краще.' : ''}` });
    }
    // власні фриланс-замовлення засновника
    let h = s.hours.freelance;
    for (const g of [...s.myGigs]) {
      const use = Math.min(h, g.hours - g.done); g.done += use; h -= use;
      if (g.done >= g.hours) {
        s.myGigs = s.myGigs.filter(x => x !== g);
        const late = s.week > g.deadline;
        let got = g.terms === 'prepay' ? g.pay - g.got : g.terms === 'escrow' ? Math.round(g.pay * .9) : g.ghost ? 0 : g.pay;
        s.cash += got; s.ledgerIn = (s.ledgerIn || 0) + got; s.gigIncome += got + (g.got || 0); s.gigsDone++;
        const stars = clamp((late ? 3.6 : 4.8) + r.range(-.3, .2), 1, 5);
        s.rating = s.gigsDone === 1 ? stars : (s.rating * (s.gigsDone - 1) + stars) / s.gigsDone;
        this.mail({ from: g.client, kind: 'freelance', title: got ? `Оплата за «${g.t}»` : `Клієнт не заплатив за «${g.t}»`, body: got ? `Дякую за роботу${late ? ', хоч і з запізненням' : ''}! Отримано ${fmt(got)}. Оцінка: ${stars.toFixed(1).replace('.', ',')}.` : 'Клієнт отримав роботу й зник. Без передоплати чи безпечної угоди ризик завжди на вас.' });
      } else if (s.week > g.deadline + 2) {
        s.myGigs = s.myGigs.filter(x => x !== g); s.gigsDone++; s.rating = s.gigsDone === 1 ? 2 : (s.rating * (s.gigsDone - 1) + 2) / s.gigsDone;
        if (g.got) { s.cash -= g.got; s.ledgerExtra = (s.ledgerExtra || 0) + g.got; }
        this.mail({ from: g.client, kind: 'freelance', title: 'Замовлення скасовано', body: `Ви зірвали всі терміни. Я знайшов іншого виконавця й поставив вам низьку оцінку.${g.got ? ` Передоплату ${fmt(g.got)} довелося повернути.` : ''}` });
      }
    }
    if (s.week - (s.flags.gigWeek ?? -9) >= 2) this.refreshGigs();

    // інвестиції
    for (const [k, p] of Object.entries(s.port)) {
      const A = ASSETS[k];
      if (k === 'meme') { const age = s.week - p.since; p.v *= age < 3 ? r.range(1.2, 1.6) : age === 3 ? .07 : r.range(.85, 1.02); continue; }
      const g = A.y / 52, sd = A.vol / Math.sqrt(52);
      p.v *= Math.exp(r.norm(g - sd * sd / 2, sd));
    }
    if (!s.flags.memeOffered && s.week > 10 && this.portValue() > 0 && r.chance(.25)) {
      s.flags.memeOffered = true;
      this.mail({ from: 'Невідомий акаунт @crypto_king_ua', kind: 'invest', title: 'СуперКоїн виросте в 100 разів!!!', body: 'Ти ще не купив СуперКоїн? Уже +400% за тиждень! Встигни, поки дешево — завтра буде пізно! Кнопка покупки є в розділі «Інвестиції».' });
    }
    // кредит
    if (s.loan && s.loan.left > 0) {
      const L = s.loan, interest = L.owed * L.rate / 52; L.owed = L.owed + interest - L.pay; L.left--; s.cash -= L.pay; rep.loanPay = L.pay; rep.loanInterest = interest;
      if (L.left <= 0 || L.owed <= 1) { s.loan = { ...L, left: 0, owed: 0, closed: true }; this.mail({ from: 'Банк', kind: 'finance', title: 'Кредит погашено', body: 'Вітаємо: кредит повністю повернуто.' }); }
    }
    // краудфандинг
    const C = s.crowd;
    if (C && C.status === 'live') {
      const g = this.seg(), a = this.appeal();
      const pledgers = r.binom(Math.round((reach + 400) * .012 * (.3 + a) * (1 + s.brand.aware * 2) * (1 + (s.fl.video || 0) * .8) * clamp(g.wtp / Math.max(C.reward, 1), .3, 1.6) * this.trustM()), 1);
      C.backers += pledgers; C.raised += pledgers * C.reward;
      if (s.week >= C.end - 1) {
        if (C.raised >= C.goal) {
          C.status = 'won'; const net = Math.round(C.raised * .92); s.cash += net; s.ledgerIn = (s.ledgerIn || 0) + net;
          if (I.kind === 'hardware') s.flags.crowdUnits = (s.flags.crowdUnits || 0) + C.backers;
          else { const u = s.users[s.target]; u.paid += Math.round(C.backers * .6); u.paidEver += Math.round(C.backers * .6); }
          this.mail({ from: 'Краудфандингова платформа', kind: 'finance', title: 'Кампанію успішно завершено!', body: `Ви зібрали ${fmt(C.raised)} від ${C.backers} підтримувачів. Після комісії платформи 8% на рахунок надійшло ${fmt(net)}.${I.kind === 'hardware' ? ` Не забудьте: ${C.backers} людей чекають на свої пристрої — їх треба виготовити й відправити.` : ''}` });
        } else {
          C.status = 'failed';
          this.mail({ from: 'Краудфандингова платформа', kind: 'finance', title: 'Кампанія не зібрала мету', body: `Зібрано ${fmt(C.raised)} з ${fmt(C.goal)}. За правилом «все або нічого» гроші повернуто підтримувачам. Можна спробувати знову: з кращим відео, меншою метою або більшою впізнаваністю.` });
        }
      }
    }
    // зобов'язання перед підтримувачами краудфандингу (пристрої)
    if (s.flags.crowdUnits > 0 && s.stock.units > 0) { const n = Math.min(s.flags.crowdUnits, s.stock.units); s.stock.units -= n; s.flags.crowdUnits -= n; s.users[s.target].paid += n; }
    if (s.flags.crowdUnits > 0 && C?.status === 'won' && s.week - C.end > 8 && !s.flags.crowdAngry) { s.flags.crowdAngry = true; s.brand.aware *= .7; this.mail({ from: 'Підтримувачі кампанії', kind: 'finance', title: 'Де наші пристрої?!', body: 'Минуло два місяці, а пристроїв досі немає. Люди пишуть гнівні відгуки — впізнаваність бренду падає. Замовте виробництво.' }); }

    // спринт
    if (s.sprint) {
      const sp = s.sprint, left = sum(sp.plan.map(id => this.has(id) ? 0 : this.feature(id).cost - (s.product.progress[id] || 0)));
      sp.burn.push(Math.max(0, Math.round(left)));
      if (s.crunch) sp.crunch = true;
      if (s.week >= sp.start + sp.len - 1) {
        const done = Math.round(sp.planned - left);
        s.sprints.push({ n: sp.n, start: sp.start, planned: sp.planned, done, items: sp.plan.length, built: sp.plan.filter(id => this.has(id)).length, burn: sp.burn, crunch: sp.crunch, retro: null });
        s.sprint = null;
        this.mail({ from: 'Команда розробки', kind: 'team', title: `Спринт ${sp.n} завершено: ${Math.round(done / Math.max(1, sp.planned) * 100)}% плану`, body: `Заплановано ${sp.planned} очок, виконано ${done}. Проведіть ретроспективу в розділі «Продукт»: що покращити в наступному спринті?` });
      }
    }
    // стажування закінчується
    for (const m of [...s.team]) if (m.intern && s.week >= m.intern) { s.team = s.team.filter(x => x !== m); this.mail({ from: m.name, kind: 'team', title: 'Стажування завершено', body: 'Дякую за досвід! Мені було дуже цікаво.' }); }
  },
};

export function applyMods(Cls) { Object.assign(Cls.prototype, M); }
