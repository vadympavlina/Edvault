// Симулятор стартапу · власна ідея учня. Те, що вводить учень, — лише його припущення.
// Справжній ринок (наскільки болить, скільки готові платити, які функції насправді цінні)
// генерується прихованим і з'ясовується лише через інтерв'ю й опитування.

// Типи клієнтів: від них залежать розмір ринку, канали, відтік, смаки в бренді й репліки в інтерв'ю
export const ARCH = {
  teens:    { t: 'Школярі й підлітки', size: 900000, wtp: 70, hw: 700, churn: .09, sr: .065,
    fit: { ads: .9, bloggers: 1.35, social: 1.2, seo: .7, events: .5, sales: 0, referral: 1.25 }, taste: { tone: ['fun', 'friendly'], font: ['playful', 'modern'] },
    who: ['учень 8 класу', 'учениця 10 класу', 'учень 11 класу', 'учениця 7 класу'], spendWord: 'кишенькових',
    channelSay: { ads: 'бачу рекламу в Instagram', bloggers: 'дивлюся блогерів у TikTok і на YouTube', social: 'гортаю TikTok', seo: 'гуглю', events: 'щось розповідають у школі', referral: 'що радять друзі' } },
  students: { t: 'Студенти', size: 1200000, wtp: 120, hw: 900, churn: .08, sr: .06,
    fit: { ads: 1, bloggers: 1.2, social: 1.2, seo: .9, events: .8, sales: 0, referral: 1.2 }, taste: { tone: ['friendly', 'fun'], font: ['modern', 'playful'] },
    who: ['студентка 2 курсу', 'студент-програміст', 'студентка медичного', 'магістрант'], spendWord: 'стипендії',
    channelSay: { ads: 'реклама в Instagram', bloggers: 'YouTube-блогери', social: 'Telegram-канали й TikTok', seo: 'шукаю в Google', events: 'студентські заходи', referral: 'одногрупники радять' } },
  parents:  { t: 'Батьки', size: 1500000, wtp: 200, hw: 1500, churn: .05, sr: .055,
    fit: { ads: 1.1, bloggers: .75, social: .85, seo: 1.1, events: .6, sales: 0, referral: 1 }, taste: { tone: ['friendly', 'expert'], font: ['classic', 'modern'] },
    who: ['мама двох дітей', 'тато школяра', 'мама першокласниці', 'батько трьох дітей'], spendWord: '',
    channelSay: { ads: 'реклама у Facebook', bloggers: 'мам-блогерки', social: 'батьківські чати у Viber', seo: 'шукаю відгуки в Google', events: 'батьківські збори', referral: 'що порадять інші батьки' } },
  adults:   { t: 'Дорослі працівники', size: 3000000, wtp: 250, hw: 1800, churn: .06, sr: .05,
    fit: { ads: 1.1, bloggers: .85, social: .95, seo: 1.1, events: .6, sales: .2, referral: .9 }, taste: { tone: ['expert', 'friendly'], font: ['modern', 'classic'] },
    who: ['менеджерка, 31 рік', 'інженер, 28 років', 'бухгалтерка, 40 років', 'продавець-консультант'], spendWord: '',
    channelSay: { ads: 'реклама в Instagram', bloggers: 'YouTube-канали', social: 'Telegram-канали', seo: 'шукаю в Google', events: 'професійні заходи', referral: 'колеги радять' } },
  seniors:  { t: 'Люди старшого віку', size: 1200000, wtp: 120, hw: 1200, churn: .03, sr: .04,
    fit: { ads: .7, bloggers: .35, social: .55, seo: .6, events: 1, sales: 0, referral: 1.35 }, taste: { tone: ['friendly', 'formal'], font: ['classic', 'modern'] },
    who: ['пенсіонерка, 67 років', 'пенсіонер, колишній інженер', 'бабуся трьох онуків'], spendWord: 'пенсії',
    channelSay: { ads: 'інколи бачу рекламу у Facebook', social: 'онуки показують у телефоні', seo: 'рідко щось шукаю сам', events: 'у бібліотеці, в центрі для старших', referral: 'що порадять сусіди й діти', bloggers: 'майже не дивлюся' } },
  smb:      { t: 'Малий бізнес (B2B)', size: 60000, wtp: 1500, hw: 8000, units: 5, churn: .02, sr: .03, b2b: true, cycle: 4,
    fit: { ads: .7, bloggers: .35, social: .7, seo: .9, events: 1.1, sales: 1.4, referral: .9 }, taste: { tone: ['friendly', 'formal'], font: ['modern', 'classic'] },
    who: ['власниця кав\'ярні', 'власник автосервісу', 'керівниця студії йоги', 'власник магазину'], spendWord: '',
    channelSay: { ads: 'реклама у Facebook', sales: 'якщо прийдуть і покажуть', seo: 'шукаю в Google', events: 'бізнес-сніданки', referral: 'питаю інших підприємців', social: 'бізнес-спільноти' } },
  schools:  { t: 'Школи й заклади освіти (B2B)', size: 6000, wtp: 3500, hw: 20000, units: 20, churn: .012, sr: .025, b2b: true, cycle: 6,
    fit: { ads: .25, bloggers: .1, social: .35, seo: .45, events: 1.3, sales: 1.55, referral: .6 }, taste: { tone: ['formal', 'expert'], font: ['classic', 'modern'] },
    who: ['директорка ліцею', 'заступник директора', 'завуч гімназії'], spendWord: '',
    channelSay: { events: 'освітні конференції', sales: 'після зустрічі з представником', seo: 'шукаємо в інтернеті', social: 'освітні сторінки', referral: 'радимося з іншими директорами' } },
  corp:     { t: 'Великі компанії (B2B)', size: 4000, wtp: 7000, hw: 40000, units: 30, churn: .008, sr: .012, b2b: true, cycle: 10,
    fit: { ads: .3, bloggers: .1, social: .3, seo: .7, events: 1.3, sales: 1.6, referral: .6 }, taste: { tone: ['expert', 'formal'], font: ['modern', 'classic'] },
    who: ['HR-директорка IT-компанії', 'керівник відділу закупівель', 'операційна директорка'], spendWord: '',
    channelSay: { events: 'галузеві конференції', sales: 'тендер і кілька зустрічей', seo: 'аналітики шукають рішення', referral: 'питаємо партнерів', social: 'LinkedIn' } },
};
export const KINDS = {
  app: { t: 'Застосунок або сайт', models: ['freemium', 'trial', 'free'] },
  saas: { t: 'Сервіс для бізнесу', models: ['b2b', 'freemium', 'trial'] },
  hardware: { t: 'Пристрій («залізо»)', models: ['device'] },
};
export const SIZES = { s: { t: 'Мала', cost: 5 }, m: { t: 'Середня', cost: 10 }, l: { t: 'Велика', cost: 16 } };

// Випадковість для ідеї: окреме зерно, щоб ринок не залежав від ходу гри
function rnd(seed) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const low = s => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

/* Перетворює опис учня на повноцінну ідею з прихованою правдою ринку.
   input = { name, kind, pitch, problem, unitCost, segments: [{ name, arch }], features: [{ name, desc, size, core, segs: [i] }], competitors: [{ name, segs: [i] }] } */
export function makeCustomIdea(input, seed = 1) {
  const r = rnd(seed), pick = a => a[Math.floor(r() * a.length)];
  const kind = KINDS[input.kind] ? input.kind : 'app', hw = kind === 'hardware';
  const problem = low(String(input.problem || 'цю проблему').trim().replace(/[.!?]+$/, ''));
  const segs = {}, segKeys = [];
  (input.segments || []).filter(x => x.name?.trim()).slice(0, 3).forEach((x, i) => {
    const A = ARCH[x.arch] || ARCH.adults, k = 's' + (i + 1);
    const pain = clamp(.22 + r() * .6, .15, .85);
    const wtpMul = .55 + r() * 1.1;
    const comps = (input.competitors || []).filter(c => c.name?.trim() && (c.segs || []).includes(i)).map(c => c.name.trim());
    segs[k] = {
      t: x.name.trim(), short: x.name.trim().length > 22 ? x.name.trim().slice(0, 20) + '…' : x.name.trim(), arch: x.arch,
      size: Math.round(A.size * (.6 + r() * .8) / 100) * 100, pain, wtp: Math.round((hw ? A.hw : A.wtp) * wtpMul / 10) * 10, churn: A.churn, sr: A.sr,
      ...(A.b2b ? { b2b: true, cycle: A.cycle } : {}), ...(hw && A.units ? { units: A.units } : {}),
      fit: { ...A.fit }, taste: A.taste, who: A.who, spendWord: A.spendWord, channelSay: A.channelSay,
      solutions: [`роблю все вручну, як вийде`, `шукаю щось в інтернеті щоразу заново`, `питаю знайомих`, comps[0] ? `користуюся «${comps[0]}»` : `просто терплю`],
      high: [`Минулого тижня через ${problem} пішла купа часу й нервів. Це реально дратує.`, `Буквально вчора знову з цим зіткнулися. Скільки можна — хочеться нормального рішення.`, `Через ${problem} уже кілька разів були зайві витрати. Шукаю, що з цим робити.`],
      low: [`Чесно, таке буває рідко, і якось справляюся.`, `Не скажу, що це велика проблема для мене.`, `Ну є таке, але є речі важливіші.`],
    };
    segKeys.push(k);
  });
  // Функції: учень вгадує, кому вони цінні; правда трохи інша
  const feats = {};
  (input.features || []).filter(f => f.name?.trim()).slice(0, 8).forEach((f, i) => {
    const v = {}, assumed = {};
    segKeys.forEach((k, si) => {
      const guess = (f.segs || []).includes(si); assumed[k] = guess;
      const real = guess ? (r() < .78 ? .08 + r() * .32 : r() * .04) : (r() < .25 ? .1 + r() * .25 : 0);
      if (real > .005) v[k] = Math.round(real * 100) / 100;
    });
    feats['f' + (i + 1)] = { t: f.name.trim(), desc: (f.desc || '').trim() || `${cap(f.name.trim())}.`, cost: SIZES[f.size]?.cost || 10, core: !!f.core, v, assumed, mine: true };
  });
  // Справжня «потрібна» функція: щоб основна сума цінності могла дотягнути до відповідності продукту ринку
  for (const k of segKeys) {
    const tot = Object.values(feats).reduce((a, f) => a + (f.v[k] || 0), 0);
    if (tot < .75) { const ids = Object.keys(feats).filter(id => (feats[id].v[k] || 0) > 0); const id = ids.length ? pick(ids) : pick(Object.keys(feats)); feats[id].v[k] = Math.round(((feats[id].v[k] || 0) + (.8 - tot)) * 100) / 100; }
  }
  // Стандартні функції, які потрібні будь-якому продукту
  const std = {
    onboard: { t: hw ? 'Підключення за хвилину' : 'Зручний перший запуск', cost: 5, fx: { activation: .14 }, desc: 'Новий користувач одразу розуміє, що робити.' },
    invite: { t: '«Запроси друга»', cost: 4, fx: { viral: .4 }, desc: 'Користувачі легко діляться продуктом.' },
    pay: { t: hw ? 'Інтернет-магазин з оплатою' : 'Оплата в продукті', cost: 5, pay: true, desc: 'Без цього ніхто не зможе вам заплатити.' },
    stats: { t: 'Аналітика продукту', cost: 4, analytics: true, desc: 'Відкриває детальну воронку.' },
    scale: { t: 'Масштабування серверів', cost: 9, infra: true, desc: 'Стабільна робота під навантаженням.' },
  };
  if (segKeys.some(k => segs[k].b2b)) std.security = { t: 'Захист даних і договір', cost: 7, security: true, desc: 'Організації не працюють без цього.' };
  Object.assign(feats, std);
  for (const k of segKeys) if (segs[k].b2b) segs[k].requires = ['security'];
  const competitors = (input.competitors || []).filter(c => c.name?.trim()).slice(0, 3).map(c => ({ t: c.name.trim(), seg: Object.fromEntries((c.segs || []).filter(si => segKeys[si]).map(si => [segKeys[si], Math.round((.15 + r() * .25) * 100) / 100])), price: 0 }));
  const name = String(input.name || 'Моя ідея').trim(), pitch = String(input.pitch || '').trim() || `Продукт, який допомагає з тим, що ${problem}.`;
  const mainFeat = Object.values(feats).find(f => f.core) || Object.values(feats)[0];
  return {
    custom: true, t: name, icon: hw ? 'cube' : kind === 'saas' ? 'building' : 'spark', color: '#6366f1', kind, pitch, problem,
    models: KINDS[kind].models, ...(hw ? { unitCost: Math.max(50, Math.round(+input.unitCost || 400)), batchMin: 100, leadTime: 3 } : {}),
    season: [1, ...Array.from({ length: 12 }, () => Math.round((.85 + r() * .3) * 100) / 100)],
    segments: segs, features: feats, competitors,
    landing: [
      { t: `${cap(low(mainFeat.t))} та інші функції в одному ${hw ? 'пристрої' : 'продукті'}`, m: .82, why: 'перелік функцій замість користі' },
      { t: `${cap(problem)} — тепер без зайвих зусиль`, m: 1.22, why: 'конкретна користь для клієнта' },
      { t: `${name}: життя стане трохи простішим`, m: 1.05, why: 'приємно, але розмито' },
      { t: `${name} — найкращий у світі!`, m: .72, why: 'гучно й порожньо, не викликає довіри' },
    ],
  };
}

// Порівняння припущень учня з реальністю (для звіту)
export function assumptionsVsReality(I) {
  if (!I?.custom) return [];
  return Object.entries(I.features).filter(([, f]) => f.mine).map(([id, f]) => ({ id, t: f.t, rows: Object.keys(I.segments).map(k => ({ seg: I.segments[k].short, guess: !!f.assumed[k], real: (f.v[k] || 0) >= .08 })) }));
}
