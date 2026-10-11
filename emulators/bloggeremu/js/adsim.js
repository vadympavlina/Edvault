// Симулятор блогера · таргетована реклама (просування допису): розмір аудиторії, аукціон (CPM),
// прогноз результатів, модерація, витрати й статистика. Без DOM — працює і в тестах.
// Ціни орієнтовні для Instagram-подібних мереж в Україні: CPM ≈ 40–120 грн, мінімум ≈ 40 грн на день.

export const MIN_DAILY = 40, VAT = 0.2, START_BALANCE = 1000;
// Користувачі соцмережі в Україні (умовно) і частки вікових груп
export const POPULATION = 15_600_000;
export const AGES = [[13, 17, 0.07], [18, 24, 0.21], [25, 34, 0.29], [35, 44, 0.22], [45, 54, 0.12], [55, 64, 0.06], [65, 65, 0.03]];
export const CITIES = { ua: ['Уся Україна', 1], kyiv: ['Київ', 0.13], lviv: ['Львів', 0.045], kharkiv: ['Харків', 0.05], odesa: ['Одеса', 0.045], dnipro: ['Дніпро', 0.04], vinnytsia: ['Вінниця', 0.02], poltava: ['Полтава', 0.015] };
export const RADIUS = { 0: ['Лише місто', 1], 25: ['+25 км', 1.35], 50: ['+50 км', 1.8] };
// Інтереси: частка людей і наскільки за них змагаються рекламодавці (дорожчає показ)
export const INTERESTS = {
  pets: ['Домашні тварини', 0.22, 1.0], food: ['Кулінарія', 0.3, 1.1], games: ['Відеоігри', 0.24, 1.15], art: ['Мистецтво й малювання', 0.15, 0.9],
  sport: ['Спорт', 0.27, 1.05], science: ['Наука й освіта', 0.18, 0.9], music: ['Музика', 0.35, 0.95], travel: ['Подорожі', 0.28, 1.2],
  fashion: ['Мода', 0.26, 1.3], tech: ['Технології', 0.2, 1.25], books: ['Книжки', 0.14, 0.85], cinema: ['Кіно й серіали', 0.33, 1.0],
};
export const GOALS = {
  profile: { t: 'Більше відвідувань профілю', r: 'відвідування профілю', one: 'відвідування', icon: 'user', d: 'Платформа показує рекламу тим, хто найчастіше переходить у профілі. Підходить, щоб знайти підписників.' },
  reach: { t: 'Більше охоплення', r: 'охоплених людей', one: '1000 людей', icon: 'eye', d: 'Показ якомога більшій кількості різних людей. Найдешевші покази, але менше переходів.' },
  msg: { t: 'Більше повідомлень', r: 'повідомлення', one: 'повідомлення', icon: 'send', d: 'Показ тим, хто охоче пише в Директ. Підходить для замовлень і запитань.' },
};
export const PLACES = { feed: ['Стрічка', 1, 0.45], stories: ['Історії', 0.8, 0.2], reels: ['Короткі відео', 0.7, 0.35] };
export const GENDERS = { all: 'Усі', f: 'Жінки', m: 'Чоловіки' };

// Підлітки (13–17): як у справжніх платформах — лише вік і місце, без статі й інтересів
export const teen = a => a.age[0] < 18;
export function audience(a) {
  if (a.auto) return { size: 420_000, label: 'Люди, схожі на ваших підписників' };
  const city = CITIES[a.city] || CITIES.ua, rad = a.city === 'ua' ? 1 : (RADIUS[a.radius] || RADIUS[0])[1];
  let age = 0; for (const [lo, hi, sh] of AGES) { const ov = Math.max(0, Math.min(hi, a.age[1]) - Math.max(lo, a.age[0]) + 1); age += sh * ov / (hi - lo + 1); }
  const gender = teen(a) || a.gender === 'all' ? 1 : a.gender === 'f' ? 0.52 : 0.48;
  const ints = teen(a) ? [] : a.interests.filter(k => INTERESTS[k]);
  const intShare = ints.length ? 1 - ints.reduce((x, k) => x * (1 - INTERESTS[k][1]), 1) : 1; // будь-який з інтересів
  return { size: Math.round(POPULATION * Math.min(1, city[1] * rad) * age * gender * intShare) };
}
export const sizeLabel = n => (n < 30_000 ? ['narrow2', 'Дуже вузька: реклама буде дорогою й швидко набридне'] : n < 200_000 ? ['narrow', 'Вузька: точно, але дорожче'] : n < 3_000_000 ? ['ok', 'Оптимальна'] : ['wide', 'Широка: дешево, але менш точно']);

// Вартість 1000 показів і чому саме така
export function cpm(a, q = 0.6) {
  const why = [];
  let c = 55;
  const { size } = audience(a);
  if (size < 30_000) { c *= 1.8; why.push(['-', 'Дуже вузька аудиторія — рекламодавці змагаються за тих самих людей']); }
  else if (size < 200_000) { c *= 1.3; why.push(['-', 'Вузька аудиторія — показ дорожчий']); }
  else if (size > 3_000_000) { c *= 0.9; why.push(['+', 'Широка аудиторія — покази дешевші']); }
  if (!a.auto && !teen(a) && a.interests.length) { const k = Math.max(...a.interests.map(x => INTERESTS[x]?.[2] || 1)); c *= k; if (k > 1.1) why.push(['-', 'Популярні інтереси: за них змагається багато рекламодавців']); }
  if (teen(a)) { c *= 0.85; why.push(['i', 'Для підлітків доступні лише вік і місце']); }
  const pl = a.place === 'auto' ? 0.85 : Object.keys(PLACES).filter(k => a.places?.includes(k)).reduce((x, k, _, arr) => x + PLACES[k][1] / arr.length, 0) || 1;
  c *= pl; if (a.place === 'auto') why.push(['+', 'Автоматичне розміщення: платформа шукає дешевші місця']);
  // якісний допис дешевший: людям він цікавіший, тож платформа частіше виграє за нього аукціон
  const rel = 1.3 - 0.5 * q; c *= rel;
  why.push(q >= 0.65 ? ['+', 'Якісний допис: платформа вважає рекламу корисною й бере менше'] : q < 0.45 ? ['-', 'Слабкий допис: низька оцінка якості реклами — показ дорожчий'] : ['i', 'Звичайна якість допису']);
  if (a.goal === 'reach') c *= 0.85;
  return { cpm: Math.round(c), why, size };
}
// Частка тих, хто зробив цільову дію (клік у профіль чи повідомлення) серед показів
export function actionRate(goal, q) { return goal === 'msg' ? 0.0012 + 0.003 * q : goal === 'reach' ? 0.003 + 0.005 * q : 0.006 + 0.016 * q; }

// Прогноз «від — до», як показують справжні рекламні кабінети
export function forecast(a, q) {
  const { cpm: c, size } = cpm(a, q), imps = a.daily / c * 1000, total = imps * a.days;
  const reach = size * (1 - Math.exp(-total / Math.max(1, size * 1.1))); // аудиторія вичерпується — частота росте
  const res = a.goal === 'reach' ? reach : total * actionRate(a.goal, q);
  const rng = (x, k = 0.3) => [Math.max(0, Math.round(x * (1 - k))), Math.round(x * (1 + k))];
  return { cpm: c, size, impsDay: rng(imps), reachDay: rng(Math.min(size, imps / 1.2)), reach: rng(reach), results: rng(res), freq: total / Math.max(1, reach), costPer: res ? a.daily * a.days / res : 0, total: a.daily * a.days, vat: a.daily * a.days * VAT };
}

// Модерація: чого не можна рекламувати
export function review(p) {
  const r = [];
  if (p?.risk?.some(x => ['address', 'school', 'doc', 'chat', 'place'].includes(x))) r.push('Особисті дані: на фото чи в підписі видно адресу, школу, документ або чужу переписку');
  if (p?.risk?.includes('copy')) r.push('Чужий твір: кадр із мультфільму належить студії');
  if (p?.risk?.includes('friend')) r.push('На фото є інша людина без її згоди на рекламу');
  if (p?.music?.hit) r.push('Чужа музика без ліцензії');
  if (p?.cb) r.push('Оманливі обіцянки в підписі (клікбейт)');
  if (p?.adBad) r.push('Заборонена тема (азартні ігри тощо)');
  return r;
}

/* ═════════ кампанії ═════════ */
export function ensureAds(s) { s.ads ||= { balance: START_BALANCE, list: [] }; return s.ads; }
export function topUp(sim, sum = 1000) { ensureAds(sim.s).balance += sum; sim.emit('ads'); }

// q — якість допису 0..1; reasons — чому модерація не пропустить (див. review)
export function launchAd(sim, a, q, reasons = []) {
  const s = sim.s, ads = ensureAds(s), f = forecast(a, q), cost = Math.round((f.total + f.vat) * 100) / 100;
  if (ads.balance < cost) return { error: 'Недостатньо коштів на навчальному балансі' };
  ads.balance = Math.round((ads.balance - cost) * 100) / 100;
  const ad = { id: sim.id('ad'), ...JSON.parse(JSON.stringify(a)), q, cpm: f.cpm, size: f.size, created: s.t, status: 'review', reviewAt: s.t + 30 + sim.r.int(60), reasons, paid: cost,
    stats: { spent: 0, imps: 0, reach: 0, clicks: 0, follows: 0, msgs: 0, likes: 0, days: [], age: {}, gender: {}, place: {}, city: {} } };
  ads.list.unshift(ad); sim.emit('ads');
  return { ad };
}
export function stopAd(sim, id, status = 'done') {
  const ads = ensureAds(sim.s), ad = ads.list.find(x => x.id === id); if (!ad || !['active', 'paused', 'review'].includes(ad.status)) return;
  if (status === 'paused') { ad.status = 'paused'; sim.emit('ads'); return; }
  ad.status = 'done'; ad.end = sim.s.t;
  const refund = Math.max(0, Math.round((ad.paid - ad.stats.spent * (1 + VAT)) * 100) / 100);
  ads.balance = Math.round((ads.balance + refund) * 100) / 100; ad.refund = refund; sim.emit('ads');
}
export function resumeAd(sim, id) { const ad = ensureAds(sim.s).list.find(x => x.id === id); if (ad?.status === 'paused') { ad.status = 'active'; sim.emit('ads'); } }

// Крок часу (d хвилин); act — активність аудиторії зараз 0..1
export function adStep(sim, d, act) {
  const s = sim.s; if (!s.ads?.list.length) return false;
  let ch = false;
  for (const ad of s.ads.list) {
    if (ad.status === 'review' && s.t >= ad.reviewAt) {
      if (ad.reasons.length) { ad.status = 'rejected'; ad.end = s.t; s.ads.balance = Math.round((s.ads.balance + ad.paid) * 100) / 100; ad.refund = ad.paid; sim.notify('alert', 'Рекламу не схвалено: ' + ad.reasons[0], ad.pid || null); }
      else { ad.status = 'active'; ad.start = s.t; sim.notify('info', 'Рекламу схвалено й запущено', ad.pid || null); }
      ch = true; continue;
    }
    if (ad.status !== 'active') continue;
    if (s.t - ad.start >= ad.days * 1440 || ad.stats.spent >= ad.daily * ad.days - 0.01) { stopAd(sim, ad.id); sim.notify('info', `Реклама завершилася: витрачено ${Math.round(ad.stats.spent)} грн`, ad.pid || null); ch = true; continue; }
    // за добу витрачається приблизно денний бюджет; більше — коли люди онлайн
    const spend = Math.min(ad.daily * ad.days - ad.stats.spent, ad.daily * d / 1440 * (0.3 + 1.4 * act) * sim.r.range(0.85, 1.15));
    const st = ad.stats, imps = spend / ad.cpm * 1000;
    st.spent += spend; st.imps += imps;
    st.reach = ad.size * (1 - Math.exp(-st.imps / (ad.size * 1.1)));
    // утома від реклами: що частіше одна людина бачить допис, то рідше реагує
    const tired = Math.max(0.5, 1 - Math.max(0, st.imps / Math.max(1, st.reach) - 2) * 0.12);
    const acts = imps * actionRate(ad.goal, ad.q) * tired;
    if (ad.goal === 'msg') st.msgs += acts; else st.clicks += acts;
    const fol = (ad.goal === 'msg' ? acts * 0.3 : acts) * (0.06 + 0.12 * ad.q) * (s.me?.bio ? 1 : 0.7);
    st.follows += fol; st.likes += imps * 0.006 * ad.q;
    const day = Math.floor((s.t - ad.start) / 1440); while (st.days.length <= day) st.days.push({ imps: 0, spent: 0, res: 0 });
    st.days[day].imps += imps; st.days[day].spent += spend; st.days[day].res += ad.goal === 'reach' ? 0 : acts;
    split(st, ad, imps);
    // ефект на справжній акаунт: нові підписники й перегляди допису
    const whole = Math.floor(st.follows) - (ad.gained || 0);
    if (whole > 0) { ad.gained = (ad.gained || 0) + whole; s.followers += whole; sim.newFollowers(whole, null); }
    const p = ad.pid && s.posts.find(x => x.id === ad.pid);
    if (p) { p.stats.views += Math.round(imps); p.stats.likes += Math.round(imps * 0.006 * ad.q); p.stats.src['Реклама'] = Math.round((p.stats.src['Реклама'] || 0) + imps); }
    ch = true;
  }
  return ch;
}
// розподіл показів за віком, статтю, місцями й розміщенням
function split(st, ad, imps) {
  const add = (o, k, v) => { o[k] = (o[k] || 0) + v; };
  const ages = AGES.map(([lo, hi, sh]) => { const age = ad.auto ? [18, 34] : ad.age; const ov = Math.max(0, Math.min(hi, age[1]) - Math.max(lo, age[0]) + 1); return [lo === 65 ? '65+' : `${lo}–${hi}`, sh * ov / (hi - lo + 1)]; }).filter(x => x[1] > 0);
  const tot = ages.reduce((x, y) => x + y[1], 0);
  for (const [k, w] of ages) add(st.age, k, imps * w / tot);
  const g = ad.auto || teen(ad) || ad.gender === 'all' ? [['Жінки', 0.53], ['Чоловіки', 0.47]] : [[ad.gender === 'f' ? 'Жінки' : 'Чоловіки', 1]];
  for (const [k, w] of g) add(st.gender, k, imps * w);
  const pl = ad.place === 'auto' ? Object.keys(PLACES) : ad.places;
  const pw = pl.reduce((x, k) => x + PLACES[k][2], 0);
  for (const k of pl) add(st.place, PLACES[k][0], imps * PLACES[k][2] / pw);
  const city = ad.auto || ad.city === 'ua' ? [['Київ', 0.3], ['Харків', 0.12], ['Львів', 0.11], ['Одеса', 0.1], ['Дніпро', 0.09], ['Інші', 0.28]] : [[CITIES[ad.city][0], 1]];
  for (const [k, w] of city) add(st.city, k, imps * w);
}

export const money = x => `${(Math.round(x * 100) / 100).toLocaleString('uk-UA', { minimumFractionDigits: x % 1 ? 2 : 0, maximumFractionDigits: 2 })} грн`;
