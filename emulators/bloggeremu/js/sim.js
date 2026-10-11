// Симулятор блогера · рушій: віртуальний час, охоплення дописів, реакції підписників, повідомлення, події.
// Без DOM — працює і в браузері, і в тестах (node).
import { NICHES, SCENES, CLIPS, MUSIC, MOOD_FIT, FILTERS, TAGS, TRENDS, CLICKBAIT, RUDE, COMMENTS, REPLIES, BRANDS, CREATORS, makePerson, nicheOf } from './data.js';
import { judge, vertical } from './quality.js';
import { tubeStep } from './tubesim.js';

export const DAY = 1440;
export const START = 16 * 60; // понеділок, 16:00 — після уроків
// активність аудиторії за годинами (школярі: вечір — пік, ніч — майже нікого)
export const ACTIVITY = [3, 2, 1, 1, 1, 2, 4, 9, 7, 4, 4, 5, 7, 6, 8, 11, 13, 15, 18, 20, 19, 15, 9, 5];
const ACT_MAX = Math.max(...ACTIVITY);
export const WEEKDAYS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П’ятниця', 'Субота', 'Неділя'];
export const hourOf = t => Math.floor(t / 60) % 24;
export const dayOf = t => Math.floor(t / DAY);
export const clock = t => `${String(hourOf(t)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
export const dayName = t => WEEKDAYS[dayOf(t) % 7];
export const ago = (now, t) => { const m = Math.max(0, Math.floor(now - t)); return m < 1 ? 'щойно' : m < 60 ? `${m} хв` : m < DAY ? `${Math.floor(m / 60)} год` : `${Math.floor(m / DAY)} дн`; };
export const num = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '').replace('.', ',') + ' млн' : n >= 1e4 ? Math.round(n / 1e3) + ' тис.' : n >= 1e3 ? (n / 1e3).toFixed(1).replace('.0', '').replace('.', ',') + ' тис.' : String(Math.round(n));
export const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k >= 2 && k <= 4 ? b : c; };
export const lc = s => String(s).toLocaleLowerCase('uk');

// Відтворюваний генератор випадкових чисел (стан зберігається разом із грою)
export function rng(state) {
  const next = () => { let t = state.rs = (state.rs + 0x6D2B79F5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const r = { next, int: n => Math.floor(next() * n), chance: p => next() < p, pick: a => a[Math.floor(next() * a.length)], range: (a, b) => a + next() * (b - a), vary: (x, d = 0.15) => x * (1 - d + next() * 2 * d) };
  return r;
}

export function newState(seed = Date.now() % 100000) {
  return {
    v: 1, rs: seed | 0, t: START, speed: 10, seq: 1,
    me: null, followers: 0, following: [], trust: 60, energy: 100, money: 0, strikes: 0, bots: 0,
    posts: [], stories: [], people: {}, fans: [], dms: [], mail: [], notifs: [], ideas: [], gallery: [], feed: [], days: [],
    settings: { geotag: true, priv: false, comments: 'all', dms: 'all', filter: false, limitNew: false, twoFA: false, sessions: [{ id: 's0', dev: 'Цей телефон', city: 'Київ', now: true }] },
    flags: {}, heat: 0, hack: null, pendingAd: null, collab: null, unread: { notifs: 0 }, drafts: [], screen: {}, breakAt: 60, tube: null, phone: { wall: 'dawn' },
  };
}

// Перевірка збереженого стану: пошкоджений — починаємо заново
export const okState = s => !!s && s.v === 1 && Number.isFinite(s.t) && Array.isArray(s.posts) && Array.isArray(s.dms) && Array.isArray(s.mail) && typeof s.settings === 'object';

export class Sim {
  constructor(state) {
    this.s = okState(state) ? state : newState();
    this.r = rng(this.s);
    this.subs = new Set();
    // старі збереження: нові поля
    this.s.drafts ||= []; this.s.screen ||= {}; this.s.breakAt ??= 60; this.s.tube ??= null; this.s.phone ||= { wall: 'dawn' };
    if (!this.s.feed.length) this.refreshFeed();
    if (!this.s.gallery.length) this.seedGallery();
  }
  on(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
  emit(what) { for (const f of this.subs) f(what); }
  id(p = 'x') { return p + (this.s.seq++); }
  get trend() { return TRENDS[(dayOf(this.s.t) + (this.s.rs & 3)) % TRENDS.length]; }

  /* ── час ── */
  advance(min) {
    let changed = false;
    while (min > 0) { const d = Math.min(5, min); min -= d; this.s.t += d; changed = this.step(d) || changed; }
    this.emit('tick');
    return changed;
  }
  step(d) {
    const s = this.s, t = s.t, day = dayOf(t);
    let ch = false;
    if (day !== dayOf(t - d)) { this.newDay(day); ch = true; }
    s.energy = Math.min(100, s.energy + d * (hourOf(t) >= 22 || hourOf(t) < 7 ? 0.12 : 0.06));
    for (const p of s.posts) {
      if (p.sched && !p.t && p.sched <= t) { this.publishNow(p); this.notify('clock', 'Ваш запланований допис опубліковано', p.id); ch = true; }
      if (p.t && !p.deleted && t - p.t < 4 * DAY) ch = this.grow(p) || ch;
    }
    for (const st of s.stories) if (t - st.t < DAY) { const f = 1 - Math.exp(-(t - st.t) / 180); st.views = Math.round(st.plan * f); }
    if (Math.floor(t / 60) !== Math.floor((t - d) / 60)) ch = this.hourly() || ch;
    if (s.tube) ch = tubeStep(this, d) || ch;
    if (s.queue?.length) { const n = s.queue.length; this.runQueue(); ch = ch || n !== s.queue.length; }
    return ch;
  }
  newDay(day) {
    const s = this.s;
    s.days.push({ day: day - 1, followers: s.followers, views: s.posts.filter(p => p.t && dayOf(p.t) === day - 1).reduce((a, p) => a + p.stats.views, 0) });
    if (s.days.length > 60) s.days.shift();
    this.prune();
    // довіра повільно відновлюється, якщо автор поводиться чесно
    if (s.trust < 60) s.trust = Math.min(60, s.trust + 1);
    this.refreshFeed();
    // без нових дописів кілька днів — аудиторія потроху забуває
    const last = Math.max(0, ...s.posts.filter(p => p.t).map(p => p.t));
    if (s.followers > 20 && last && s.t - last > 3 * DAY) { const lost = Math.max(1, Math.round(s.followers * 0.01)); s.followers -= lost; this.notify('info', `Давно не було нових дописів: ${lost} ${plural(lost, 'людина відписалася', 'людини відписалися', 'людей відписалися')}`, null, 'gap'); }
    // накручені «мертві» підписники видаляються перевіркою платформи
    if (s.bots && s.flags.botsAt && s.t - s.flags.botsAt > 2 * DAY) {
      s.followers = Math.max(0, s.followers - s.bots); const n = s.bots; s.bots = 0; s.trust = Math.max(0, s.trust - 8);
      this.mail('platform', 'Ми видалили неживих підписників', `Перевірка знайшла у вашому профілі ${n} фальшивих облікових записів (ботів), і ми їх видалили. Купівля підписників порушує правила Лайкера. Наступного разу профіль можуть обмежити.`, 'bots');
    }
  }

  // люди, на яких ніщо не посилається, видаляються, щоб збереження не розросталося
  prune() {
    const s = this.s, ids = Object.keys(s.people); if (ids.length < 300) return;
    const keep = new Set([...s.fans, ...s.dms.map(d => d.pid), ...s.posts.flatMap(p => p.comments.map(c => c.pid)), ...(s.tube?.videos || []).flatMap(v => v.comments.map(c => c.pid))]);
    for (const id of ids) if (!keep.has(id) && !id.startsWith('cr_') && !id.startsWith('br_')) delete s.people[id];
  }

  /* ── обліковий запис ── */
  register(me) {
    const s = this.s;
    s.me = { nick: me.nick, name: me.name || '', bio: me.bio || '', niche: me.niche, avatar: me.avatar || { color: '#c62828', sym: 'letter' }, created: s.t, pass: me.pass || '', email: (me.nick || 'user') + '@poshta.ua' };
    s.settings.priv = !!me.priv; s.settings.twoFA = !!me.twoFA;
    this.mail('platform', 'Ласкаво просимо до Лайкера!', `Вітаємо, @${me.nick}! Ваш профіль створено.\n\nКілька порад для початку:\n• Додайте фото профілю й опис — так людям легше вас знайти.\n• Публікуйте те, що вам справді цікаво.\n• Не показуйте в дописах адресу, школу й документи.\n• Увімкніть двофакторний вхід у налаштуваннях безпеки.`, 'welcome');
    if (!me.twoFA) this.later(90, 'notify', 'shield', 'Захистіть профіль: увімкніть двофакторний вхід у Налаштуваннях → Безпека');
    this.emit('me');
  }
  updateProfile(p) { Object.assign(this.s.me, p); this.emit('me'); }

  /* ── публікація ── */
  // draft: { kind: 'photo'|'video'|'text', photo: {gid, filter, text, sticker, crop}, video: {clip, trim, title, music}, caption, place, ad, audience, sched, collab }
  publish(draft) {
    const s = this.s;
    const p = { id: this.id('p'), kind: draft.kind, photo: draft.photo || null, photos: draft.photos?.length > 1 ? draft.photos : null, video: draft.video || null, text: draft.text || '', caption: (draft.caption || '').trim(), place: draft.place || '', ad: draft.ad || null, adMarked: !!draft.adMarked, commentsOff: !!draft.commentsOff, t: 0, sched: draft.sched || 0, stats: { views: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, follows: 0, unfollows: 0, watch: 0, src: {} }, comments: [], fired: {}, why: [] };
    p.tags = [...new Set((p.caption.match(/#[\p{L}\p{N}_]+/gu) || []).map(x => lc(x.slice(1))))];
    s.posts.unshift(p);
    if (!p.sched || p.sched <= s.t) this.publishNow(p);
    else this.emit('posts');
    return p;
  }
  publishNow(p) {
    const s = this.s;
    p.t = s.t; p.sched = 0;
    p.plan = this.model(p);
    s.energy = Math.max(0, s.energy - (p.kind === 'video' ? 22 : p.kind === 'photo' ? 14 : 8));
    if (s.pendingAd && p.ad === s.pendingAd.id) { s.money += s.pendingAd.pay; this.later(120, 'dmText', s.pendingAd.pid, `Дякуємо за допис! Оплату ${s.pendingAd.pay} грн надіслано.${p.adMarked ? '' : ' Але наступного разу обов’язково позначайте рекламу — так вимагають правила.'}`); s.pendingAd = null; }
    if (s.collab && p.collab) { s.flags.collabDone = true; const c = CREATORS.find(x => x.id === s.collab); this.later(60, 'notify', 'follow', `@${c.nick} поділився(-лася) вашим спільним дописом`, p.id); s.collab = null; }
    if (p.music?.hit) this.later(this.r.range(40, 120), 'copyrightClaim', p.id);
    if (p.adBad) this.later(this.r.range(180, 400), 'mail', 'platform', 'Допис обмежено', `Ваш допис рекламує «${p.adBad}». Таку рекламу заборонено показувати дітям і підліткам, тому допис бачать менше людей. Повторні порушення можуть призвести до блокування профілю.`, 'adbad');
    if (p.ad && !p.adMarked) this.later(this.r.range(300, 600), 'adMarkMail', p.id);
    this.emit('posts');
  }

  // Один кадр допису: якість, тема, ризики. ph: { gid, filter, g — копія власного фото на випадок, якщо його видалять із Галереї }
  slide(ph) {
    const s = this.s, g = s.gallery.find(x => x.id === ph.gid) || ph.g || { scene: ph.scene || 'cat' };
    const f = FILTERS.find(x => x.id === ph.filter) || FILTERS[0], why = [], flags = {};
    let q, topic, risk;
    if (g.own) {
      const j = judge(g, { filter: f }); q = j.q; j.why.forEach(w => why.push(w)); topic = g.topic || s.me?.niche || 'me'; risk = [];
      for (const k of ['dark', 'blur', 'dull', 'lowres']) if (j.flags[k]) flags[k] = true;
      if (j.flags.washed) flags.over = true;
    } else {
      const sc = SCENES[g.scene] || SCENES.cat; topic = sc.topic; q = sc.q + (g.v || 0); risk = [...(sc.risk || [])];
      if (g.dark) { if (f.fix) { q += 0.04; why.push(['+', 'Яскравість виправила темний кадр']); } else { q -= 0.16; why.push(['-', 'Темне фото — погано видно']); flags.dark = true; } }
      if (g.blur) { q -= 0.12; why.push(['-', 'Розмите фото']); flags.blur = true; }
    }
    if (f.over) { q -= 0.08; why.push(['-', 'Надто сильний фільтр']); flags.over = true; }
    if (g.geo) risk.push('geo');
    return { q, why, topic, risk, flags };
  }

  // Модель охоплення: від чого залежить, скільки людей побачить допис і як відреагує
  model(p) {
    const s = this.s, r = this.r, me = s.me || { niche: 'pets', bio: '' }, why = p.why = [];
    const good = t => why.push(['+', t]), bad = t => why.push(['-', t]);
    let q, topic;
    if (p.kind === 'photo') {
      // карусель: перший кадр вирішує, чи зупиниться людина; решта — чи догортає
      const slides = (p.photos?.length ? p.photos : [p.photo]).map(x => this.slide(x));
      const first = slides[0]; topic = first.topic; q = first.q; first.why.forEach(w => why.push(w));
      Object.assign(p, first.flags);
      if (slides.length > 1) {
        const rest = slides.slice(1), mean = rest.reduce((a, x) => a + x.q, 0) / rest.length;
        q = 0.6 * q + 0.4 * mean + 0.04; p.carousel = slides.length;
        good(`Карусель із ${slides.length} фото: люди гортають і довше дивляться допис`);
        if (rest.some(x => x.q < first.q - 0.15)) bad('Слабкі кадри всередині каруселі');
      }
      if (p.photo.text) { q += 0.03; good('Напис на фото привертає увагу'); }
      if (p.photo.crop === '45') q += 0.02;
      p.risk = [...new Set(slides.flatMap(x => x.risk))];
    } else if (p.kind === 'video' && p.video.own) {
      const v = p.video, g = s.gallery.find(x => x.id === v.gid) || v.g, j = judge(g, { start: v.start, end: v.end, app: 'lk' });
      topic = g.topic || me.niche; q = j.q; j.why.forEach(w => why.push(w));
      p.intro = j.flags.intro; p.long = j.flags.long; p.dark = j.flags.dark; p.blur = j.flags.blur; p.still = j.flags.still; p.horiz = !vertical(g); p.lowres = j.flags.lowres;
      if (v.title) { q += 0.04; good('Заголовок на відео'); }
      const m = MUSIC.find(x => x.id === v.music) || MUSIC[0];
      p.music = m;
      if (m.hit) { q -= 0.04; bad('Чужа музика з плеєра — скарга правовласника'); }
      else if (m.id === 'orig') good('Живий звук із відео');
      else if (m.mood === MOOD_FIT[topic]) { q += 0.06; good('Музика пасує до відео'); }
      p.len = j.flags.len; p.risk = g.geo ? ['geo'] : [];
    } else if (p.kind === 'video') {
      const c = CLIPS[p.video.clip] || CLIPS.laser, v = p.video; topic = c.topic; q = c.q;
      const len = Math.max(3, (v.end ?? c.dur) - (v.start || 0));
      if ((v.start || 0) >= c.intro - 1) { q += 0.1; good('Цікавий початок — глядачі не гортають далі'); } else { q -= 0.12; bad(`Довгий початок: перші ${c.intro} с нічого не відбувається`); p.intro = true; }
      if (len <= 20) { q += 0.05; good('Коротке відео дивляться до кінця'); } else if (len > 32) { q -= 0.06; bad('Задовге відео'); p.long = true; }
      if (v.title) { q += 0.04; good('Заголовок на відео'); }
      const m = MUSIC.find(x => x.id === v.music) || MUSIC[0];
      p.music = m;
      if (m.hit) { q -= 0.04; bad('Чужа музика з плеєра — скарга правовласника'); }
      else if (!m.mood) { q -= 0.04; bad('Без музики відео сприймається нудніше'); }
      else if (m.mood === MOOD_FIT[topic]) { q += 0.08; good('Музика пасує до відео'); }
      else q += 0.02;
      p.len = len; p.risk = [];
    } else { topic = 'me'; q = 0.5 + Math.min(0.12, p.text.length / 1500); p.risk = []; if (p.text.length < 30) { q -= 0.1; bad('Дуже короткий допис'); } }
    // підпис
    const cap = lc(p.caption);
    const bare = p.caption.replace(/#[\p{L}\p{N}_]+/gu, '').trim();
    if (p.kind !== 'text') { if (!bare) { q -= 0.06; bad('Немає опису'); p.noCaption = true; } else if (bare.length >= 15 && bare.length <= 220) { q += 0.04; good('Зрозумілий опис'); } else if (bare.length > 400) q -= 0.03; }
    const asks = /\?/.test(bare);
    if (asks) good('Питання в підписі — більше коментарів');
    p.cb = CLICKBAIT.some(w => cap.includes(w));
    if (p.cb) bad('Клікбейт у підписі: більше кліків, але глядачі розчаровуються');
    if (p.place) { if (/дім|школ/i.test(p.place)) { p.risk.push('place'); bad('Геомітка показує, де ви буваєте'); } }
    // втома автора
    if (s.energy < 30) { q -= 0.1; bad('Втома: забагато дописів без відпочинку'); }
    q = Math.max(0.08, Math.min(1, r.vary(q, 0.06)));
    p.q = q; p.topic = topic;
    // відповідність ніші каналу
    const nic = nicheOf(me.niche);
    const rel = topic === me.niche ? 1 : nic.related.includes(topic) ? 0.75 : topic === 'me' ? 0.7 : 0.45;
    if (rel === 1) good('Тема вашого каналу — підписникам цікаво'); else if (rel < 0.5) { bad('Тема не збігається з вашим каналом'); p.offtopic = true; }
    // хештеги
    let tagBoost = 0, spam = 0;
    for (const tg of p.tags) { const d = TAGS[tg]; if (!d) { tagBoost += 0.3; continue; } if (d.spam) { spam++; continue; } tagBoost += d.topic === topic || d.topic == null ? d.size * 0.35 : d.size * 0.05; }
    if (p.tags.length > 8 || spam) { tagBoost *= 0.5; bad(p.tags.length > 8 ? 'Забагато хештегів' : 'Хештеги-спам (#лайк, #рекомендації) не допомагають'); p.spamTags = true; }
    else if (tagBoost >= 2) good('Влучні хештеги приводять нових глядачів');
    else if (!p.tags.length) bad('Без хештегів допис важче знайти');
    const tr = this.trend;
    let trendF = 1;
    if (p.tags.includes(tr.tag)) { if (tr.topics.includes(topic)) { trendF = 1.8; good(`Тренд дня #${tr.tag}`); } else { trendF = 0.9; bad('Хештег тренду не про цей допис'); } }
    // час публікації
    const act = ACTIVITY[hourOf(s.t)] / ACT_MAX, timing = 0.4 + 0.6 * act;
    if (act > 0.75) good('Вдалий час: підписники зараз онлайн'); else if (act < 0.3) bad('Невдалий час: більшість підписників спить або на уроках');
    // регулярність
    const prev = s.posts.filter(x => x !== p && x.t && !x.deleted);
    const lastDay = prev.filter(x => s.t - x.t < DAY).length;
    let fatigue = 1;
    if (lastDay >= 3) { fatigue = 0.6; bad('Забагато дописів за день — підписники втомлюються'); } else if (lastDay === 2) fatigue = 0.85;
    const lastT = Math.max(0, ...prev.map(x => x.t));
    if (lastT && s.t - lastT > 4 * DAY) { fatigue *= 0.85; bad('Довга перерва — алгоритм «забув» про вас'); }
    const trustF = 0.5 + s.trust / 100;
    const prof = me.bio ? 1 : 0.8;
    const priv = s.settings.priv;
    if (priv) bad('Закритий профіль: допис бачать лише підписники');
    // реклама
    if (p.ad) { const b = BRANDS.find(x => x.id === p.ad); if (b?.bad) { p.adBad = b.name; bad('Реклама сумнівного товару'); } }
    // скільки людей побачать
    const live = s.followers - s.bots;
    let fol = live * (0.18 + 0.42 * q) * timing * fatigue * trustF;
    let exp = priv ? 0 : (220 + live * 0.35) * q * q * (topic === 'me' ? 0.45 : 1) * (1 + tagBoost / 10) * trendF * timing * trustF;
    if (p.cb) exp *= 1.35;
    if (p.spamTags) exp *= 0.75;
    if (p.adBad) exp *= 0.3;
    if (p.collab) { exp += 600 * q; good('Спільний допис з іншим блогером'); }
    let viral = 1;
    if (!priv && !p.adBad && q > 0.74 && r.chance((q - 0.66) * 0.6)) { viral = r.range(3, 7); good('Допис потрапив у рекомендації!'); }
    fol = r.vary(fol); exp = r.vary(exp);
    const views = Math.round((fol + exp * viral) * (p.kind === 'video' ? 1.25 : 1));
    const likeR = (0.04 + 0.12 * q) * (p.cb ? 0.6 : 1) * (0.7 + 0.3 * rel);
    const useful = ['science', 'food', 'art'].includes(topic);
    const plan = {
      views, reach: Math.round(views * 0.82),
      likes: Math.round(views * likeR),
      comments: Math.round(views * (0.008 + 0.022 * q) * (asks ? 1.6 : 1) + (views > 20 ? 1 : 0)),
      shares: Math.round(views * 0.012 * q * q * (useful ? 1.5 : 1)),
      saves: Math.round(views * (useful ? 0.03 : 0.01) * q * (p.carousel ? 1.6 : 1)),
      follows: Math.round(exp * viral * (0.012 + 0.05 * q * rel) * prof * (p.cb ? 0.5 : 1) + (priv ? live * 0.004 : 0)),
      unfollows: Math.round(live * ((p.cb ? 0.01 : 0) + (p.offtopic ? 0.006 : 0) + (fatigue < 1 ? 0.004 : 0) + (p.adBad ? 0.05 : 0) + (p.ad && !p.adMarked ? 0.012 : 0))),
      watch: p.kind === 'video' ? Math.max(0.12, Math.min(0.95, 0.3 + 0.5 * q - (p.intro ? 0.12 : 0))) : 0,
      tau: 120 + q * 200, viralAt: viral > 1 ? r.range(300, 700) : 0, viral, base: (fol + exp) / Math.max(1, fol + exp * viral),
      src: { 'Підписники': Math.round(fol), 'Рекомендації': Math.round(exp * viral * 0.6), 'Хештеги': Math.round(exp * viral * 0.3), 'Профіль': Math.round(exp * viral * 0.1) },
    };
    if (p.music?.hit) { plan.views = Math.round(plan.views * 0.7); }
    return plan;
  }

  // Допис «росте»: охоплення набирається поступово, а з ним — вподобання, коментарі й підписники
  grow(p) {
    const s = this.s, P = p.plan, age = s.t - p.t;
    // звичайна частина охоплення набирається одразу, «вірусна» — пізніше, коли допис потрапляє в рекомендації
    const base = P.base ?? 1;
    let f = base * (1 - Math.exp(-age / P.tau));
    if (P.viralAt && age > P.viralAt) f += (1 - base) * (1 - Math.exp(-(age - P.viralAt) / 240));
    const st = p.stats, tgt = k => Math.round(P[k] * f);
    const before = { ...st };
    for (const k of ['views', 'reach', 'likes', 'shares', 'saves']) st[k] = Math.max(st[k], tgt(k));
    st.watch = P.watch;
    const fol = tgt('follows') - st.follows, unf = tgt('unfollows') - st.unfollows;
    if (fol > 0) { st.follows += fol; s.followers += fol; this.newFollowers(fol, p); }
    if (unf > 0) { st.unfollows += unf; s.followers = Math.max(0, s.followers - unf); }
    st.src = Object.fromEntries(Object.entries(P.src).map(([k, v]) => [k, Math.round(v * f)]));
    // коментарі
    const wantC = p.commentsOff ? 0 : tgt('comments');
    let add = Math.min(3, wantC - st.comments);
    while (add-- > 0) { this.comment(p); }
    // сповіщення про вподобання — пачками
    const lk = st.likes - before.likes;
    if (lk > 0 && (!p.fired.lastLike || s.t - p.fired.lastLike > 90)) { p.fired.lastLike = s.t; const who = this.anyFan(); this.notify('like', lk === 1 ? `@${who.nick} вподобав(-ла) ваш допис` : `@${who.nick} та ще ${lk - 1} вподобали ваш допис`, p.id); }
    if (P.viral > 1 && age > P.viralAt && !p.fired.viral) { p.fired.viral = true; this.notify('star', 'Ваш допис потрапив у рекомендації! Охоплення швидко росте', p.id); }
    this.milestones();
    return st.views !== before.views || st.comments !== before.comments;
  }
  newFollowers(n, p) {
    const s = this.s;
    for (let i = 0; i < Math.min(n, 3); i++) { const f = this.person('fan', [p?.topic && p.topic !== 'me' ? p.topic : s.me?.niche || 'pets']); if (s.fans.length < 80) s.fans.push(f.id); }
    // сповіщення про нових підписників групуються, щоб не засипати стрічку
    const who = s.people[s.fans[s.fans.length - 1]] || this.person('fan');
    const last = s.notifs[0];
    if (last?.icon === 'follow' && last.followN && s.t - last.t < 120) { last.followN += n; last.text = `@${last.who} та ще ${last.followN - 1} ${plural(last.followN - 1, 'людина', 'людини', 'людей')} підписалися на вас`; last.t = s.t; this.emit('notif'); return; }
    this.notify('follow', n === 1 ? `@${who.nick} підписався(-лася) на вас` : `@${who.nick} та ще ${n - 1} ${plural(n - 1, 'людина', 'людини', 'людей')} підписалися на вас`, null);
    Object.assign(s.notifs[0], { followN: n, who: who.nick });
  }
  person(kind, interests) { const p = makePerson(this.r, kind, interests); p.id = this.id('u'); this.s.people[p.id] = p; return p; }
  anyFan() { const s = this.s; return s.fans.length && this.r.chance(0.7) ? s.people[this.r.pick(s.fans)] : this.person('fan'); }

  // Хто і що напише під дописом
  comment(p) {
    const s = this.s, r = this.r, C = COMMENTS, st = p.stats, f = p.fired;
    let kind, text, pid = null;
    const risk = (p.risk || []).find(x => !f['risk_' + x] && x !== 'geo') || ((p.risk || []).includes('geo') && !f.risk_geo ? 'geo' : null);
    const crit = [['dark', p.dark], ['over', p.over], ['intro', p.intro], ['long', p.long], ['offtopic', p.offtopic], ['caption', p.noCaption], ['spamtags', p.spamTags], ['mute', p.music?.hit && p.claimed], ['blur', p.blur], ['dull', p.dull], ['horiz', p.horiz], ['still', p.still], ['lowres', p.lowres]].filter(([k, on]) => on && !f['c_' + k]);
    if (risk && st.comments >= 1) {
      f['risk_' + risk] = true; kind = 'privacy';
      text = r.pick(C.privacy[risk === 'geo' ? 'place' : risk] || C.privacy.place);
      const stranger = this.person('stranger'); pid = stranger.id;
      if (['address', 'school', 'place', 'geo'].includes(risk) && !f.stranger) { f.stranger = true; this.later(r.range(60, 240), 'strangerDM'); }
      if (risk === 'friend' && !f.friendDM) { f.friendDM = true; this.later(r.range(90, 300), 'friendDM', p.id); }
    } else if (r.chance(s.settings.limitNew ? 0.02 : 0.08)) { kind = 'bot'; text = r.pick(C.bot); pid = this.person('bot').id; }
    else if (st.views > 60 && r.chance(0.05 + Math.min(0.25, s.heat * 0.05))) { kind = 'troll'; text = r.pick(C.troll); pid = this.person('troll').id; }
    else if (crit.length && r.chance(0.35)) { const [k] = r.pick(crit); f['c_' + k] = true; kind = 'critique'; text = r.pick(C.critique[k]); }
    else if (p.cb && !f.cb && r.chance(0.4)) { f.cb = true; kind = 'critique'; text = r.pick(C.clickbait); }
    else if (p.adBad && r.chance(0.3)) { kind = 'critique'; text = r.pick(C.ad_bad); }
    else if (p.ad && !p.adMarked && r.chance(0.25)) { kind = 'critique'; text = r.pick(C.ad_unmarked); }
    else if (p.ad && p.adMarked && !f.adok && r.chance(0.2)) { f.adok = true; kind = 'praise'; text = r.pick(C.ad_ok); }
    else if (p.fake && r.chance(0.5)) { kind = 'critique'; text = r.pick(C.fake); }
    else if (r.chance(0.12)) { kind = 'request'; const tp = p.topic && C.request[p.topic] ? p.topic : 'me'; text = r.pick(C.request[tp]); }
    else if (r.chance(0.4)) { const tp = C.topic[p.topic] ? p.topic : 'me'; text = r.pick(C.topic[tp]); kind = /\?/.test(text) ? 'question' : 'topic'; }
    else { kind = 'praise'; text = r.pick(C.praise); }
    // той самий текст під одним дописом двічі не повторюється
    if (p.comments.some(x => x.text === text)) { const pool = [...COMMENTS.praise, ...(COMMENTS.topic[p.topic] || [])].filter(x => !p.comments.some(c => c.text === x)); if (!pool.length) return; text = r.pick(pool); kind = /\?/.test(text) ? 'question' : 'praise'; }
    const author = pid ? s.people[pid] : this.anyFan();
    if (author.blocked) return;
    const c = { id: this.id('c'), pid: author.id, text, kind, t: s.t, likes: kind === 'bot' ? 0 : r.int(4), liked: false, reply: null, hidden: false, pinned: false };
    // фільтри коментарів
    if (s.settings.filter && (kind === 'troll' || RUDE.some(w => lc(text).includes(w)))) c.hidden = 'filter';
    if (s.settings.limitNew && kind === 'bot') c.hidden = 'filter';
    if (s.settings.comments === 'off' || p.commentsOff) return;
    if (s.settings.comments === 'followers' && !s.fans.includes(author.id) && kind !== 'praise') return;
    st.comments++;
    p.comments.push(c);
    if (p.comments.length > 60) p.comments.splice(p.comments.findIndex(x => !x.pinned && !x.reply), 1);
    if (!c.hidden) this.notify('comment', `@${author.nick}: ${text}`, p.id, null, c.id);
  }

  /* ── дії з коментарями ── */
  find(pid, cid) { const p = this.s.posts.find(x => x.id === pid); return [p, p?.comments.find(x => x.id === cid)]; }
  likeComment(pid, cid) { const [, c] = this.find(pid, cid); if (!c) return; c.liked = !c.liked; c.likes += c.liked ? 1 : -1; this.emit('comments'); }
  hideComment(pid, cid) { const [, c] = this.find(pid, cid); if (!c) return; c.hidden = c.hidden ? false : 'me'; this.emit('comments'); }
  pinComment(pid, cid) { const [p, c] = this.find(pid, cid); if (!c) return; const on = !c.pinned; p.comments.forEach(x => { x.pinned = false; }); c.pinned = on; this.emit('comments'); }
  deleteComment(pid, cid) { const [p, c] = this.find(pid, cid); if (!c) return; p.comments.splice(p.comments.indexOf(c), 1); this.emit('comments'); }
  block(uid) {
    const s = this.s, u = s.people[uid]; if (!u) return;
    u.blocked = true; s.fans = s.fans.filter(x => x !== uid);
    if (u.kind === 'troll') s.heat = Math.max(0, s.heat - 1);
    for (const p of s.posts) p.comments = p.comments.filter(c => c.pid !== uid);
    for (const d of s.dms) if (d.pid === uid) d.blocked = true;
    this.emit('comments'); this.emit('dms');
  }
  report(uid) {
    const u = this.s.people[uid]; if (!u) return;
    this.block(uid);
    this.later(this.r.range(40, 120), 'notify', 'shield', ['bot', 'troll', 'stranger', 'scam'].includes(u.kind) ? `Скаргу на @${u.nick} розглянуто: обліковий запис порушував правила й заблокований. Дякуємо!` : `Скаргу на @${u.nick} розглянуто: порушень не знайдено.`);
  }
  // Відповідь на коментар. tone: kind|neutral|rude (для власного тексту визначаємо самі)
  reply(pid, cid, text, tone, extra) {
    const s = this.s, r = this.r, [p, c] = this.find(pid, cid); if (!c || c.reply) return;
    text = String(text).trim().slice(0, 300); if (!text) return;
    tone = tone || toneOf(text);
    c.reply = { text, t: s.t, tone };
    const u = s.people[c.pid];
    if (tone === 'rude') {
      s.trust = Math.max(0, s.trust - 3); s.heat += 2; const lost = Math.min(s.followers, r.int(3) + 1); s.followers -= lost;
      this.later(r.range(20, 80), 'addComment', p.id, 'critique', r.pick(['Навіщо так грубо відповідати?', 'Неприємно читати таке від автора', 'Можна ж ввічливо']), this.anyFan().id);
    } else if (tone === 'kind') {
      p.fired.kindN = (p.fired.kindN || 0) + 1; if (p.fired.kindN <= 3) s.trust = Math.min(100, s.trust + 1);
      if (u && !s.fans.includes(u.id) && u.kind === 'fan' && r.chance(0.5)) { s.fans.push(u.id); s.followers++; }
      if (u?.kind === 'troll' && r.chance(0.35)) this.later(r.range(15, 60), 'addComment', p.id, 'praise', 'Добре, вибач. Насправді непогано', u.id);
    }
    if (u?.kind === 'bot') this.later(r.range(10, 40), 'addComment', p.id, 'bot', r.pick(COMMENTS.bot), u.id);
    if (extra === 'idea' || (c.kind === 'request' && tone === 'kind')) this.addIdea(c.text, 'comment');
    this.emit('comments');
  }
  addComment(pid, kind, text, uid) { const p = this.s.posts.find(x => x.id === pid), u = this.s.people[uid]; if (!p || !u || u.blocked) return; const c = { id: this.id('c'), pid: u.id, text, kind, t: this.s.t, likes: 0, liked: false, reply: null, hidden: false, pinned: false }; p.comments.push(c); p.stats.comments++; this.notify('comment', `@${u.nick}: ${text}`, p.id, null, c.id); this.emit('comments'); }
  editPost(pid, patch) { const p = this.s.posts.find(x => x.id === pid); if (!p) return; Object.assign(p, patch); if ('adMarked' in patch && patch.adMarked && p.plan) p.plan.unfollows = Math.round(p.plan.unfollows / 2); this.emit('posts'); }
  deletePost(pid) {
    const p = this.s.posts.find(x => x.id === pid); if (!p) return;
    p.deleted = true; this.s.posts.splice(this.s.posts.indexOf(p), 1);
    if (p.risk?.length) this.s.flags.removedRisk = true;
    this.emit('posts');
  }

  /* ── чернетки ── */
  saveDraft(d) {
    const s = this.s, x = JSON.parse(JSON.stringify(d));
    x.id ||= this.id('dr'); x.t = s.t;
    s.drafts = [x, ...s.drafts.filter(y => y.id !== x.id)].slice(0, 12);
    this.emit('drafts'); return x;
  }
  deleteDraft(id) { this.s.drafts = this.s.drafts.filter(x => x.id !== id); this.emit('drafts'); }

  /* ── час у застосунку (цифрова рівновага) ── */
  useTime(min) {
    const s = this.s, day = dayOf(s.t);
    s.screen[day] = (s.screen[day] || 0) + min;
    for (const k of Object.keys(s.screen)) if (+k < day - 13) delete s.screen[k];
    if (s.breakAt && s.screen[day] >= s.breakAt && s.flags.breakDay !== day) { s.flags.breakDay = day; this.notify('clock', `Сьогодні ви вже ${s.breakAt} хв у Лайкері. Час зробити перерву: прогулянка, вода, розминка для очей`, null); }
  }

  /* ── галерея й камера ── */
  seedGallery() {
    const s = this.s, r = this.r;
    const photos = ['cat', 'pizza', 'drawing', 'football', 'volcano', 'guitar', 'mountains', 'selfie', 'house', 'friends', 'dog', 'pancakes', 'uniform', 'sea', 'ticket', 'game', 'chat', 'cartoon', 'planet', 'paints'];
    photos.forEach((sc, i) => s.gallery.push({ id: this.id('g'), type: 'photo', scene: sc, v: +r.range(-0.03, 0.05).toFixed(3), dark: i % 7 === 3, blur: false, geo: false, t: s.t - (i + 1) * 290 }));
    for (const [k] of Object.entries(CLIPS)) s.gallery.push({ id: this.id('g'), type: 'video', clip: k, t: s.t - r.int(4 * DAY) });
    s.gallery.sort((a, b) => b.t - a.t);
  }
  // Знімок камерою: уночі кадр темний, геомітка записується, якщо її не вимкнули
  takePhoto(scene) {
    const s = this.s, r = this.r, h = hourOf(s.t), night = h >= 21 || h < 6;
    const g = { id: this.id('g'), type: 'photo', scene, v: +r.range(-0.02, 0.06).toFixed(3), dark: night && r.chance(0.7), blur: r.chance(0.08), geo: s.settings.geotag, t: s.t, cam: true };
    s.gallery.unshift(g); this.trimGallery(); this.emit('gallery'); return g;
  }
  // галерея не росте безмежно: найстаріші кадри, не використані в дописах, видаляються
  // старі кадри з камери видаляються; власні файли й те, що є в дописах, лишаються
  trimGallery() { const s = this.s; if (s.gallery.length <= 80) return; const used = new Set(s.posts.flatMap(p => [p.photo?.gid, ...(p.photos || []).map(x => x.gid), p.video?.gid]).filter(Boolean)); for (let i = s.gallery.length - 1; i >= 0 && s.gallery.length > 80; i--) if (!used.has(s.gallery[i].id) && !s.gallery[i].own) s.gallery.splice(i, 1); }
  // власний файл із телефону: опис від media.importFile + тема
  addOwn(item, topic) { const s = this.s, g = { ...item, id: this.id('g'), topic: topic || s.me?.niche || 'me', t: s.t, geo: false }; s.gallery.unshift(g); this.emit('gallery'); return g; }
  setTopic(id, topic) { const g = this.s.gallery.find(x => x.id === id); if (g) { g.topic = topic; this.emit('gallery'); } }
  // чи потрібен ще файл (у Галереї, дописах, чернетках, аватарах, на каналі)
  mediaInUse(mid) {
    const s = this.s, j = JSON.stringify([s.gallery, s.posts.map(p => [p.photo, p.photos, p.video]), s.drafts, s.me?.avatar, s.tube, s.phone]);
    return j.includes(`"${mid}"`);
  }
  recordVideo(clip) { const g = { id: this.id('g'), type: 'video', clip, t: this.s.t, cam: true, geo: this.s.settings.geotag }; this.s.gallery.unshift(g); this.trimGallery(); this.emit('gallery'); return g; }
  deletePhoto(id) { const s = this.s; s.gallery = s.gallery.filter(g => g.id !== id); this.emit('gallery'); }
  stripGeo(id) { const g = this.s.gallery.find(x => x.id === id); if (g) { g.geo = false; this.emit('gallery'); } }

  /* ── ідеї ── */
  addIdea(text, src = 'me') { const s = this.s; if (s.ideas.some(i => lc(i.text) === lc(text))) return; s.ideas.unshift({ id: this.id('i'), text, src, t: s.t, done: false }); if (s.ideas.length > 50) s.ideas.pop(); this.emit('ideas'); }

  /* ── повідомлення (Директ) ── */
  thread(pid) { let d = this.s.dms.find(x => x.pid === pid); if (!d) { d = { id: this.id('d'), pid, msgs: [], unread: 0, opts: null }; this.s.dms.unshift(d); } return d; }
  dmText(pid, text, opts = null, kind = null) {
    const s = this.s, d = this.thread(pid); if (d.blocked) return d;
    d.msgs.push({ me: false, text, t: s.t }); d.unread++; d.opts = opts; if (kind) d.kind = kind; d.t = s.t;
    s.dms.splice(s.dms.indexOf(d), 1); s.dms.unshift(d);
    this.notify('dm', `@${s.people[pid]?.nick || 'хтось'} надсилає повідомлення`, null, pid);
    this.emit('dms'); return d;
  }
  // Учень відповідає: або одним із варіантів, або власним текстом
  dmReply(did, text, key) {
    const s = this.s, d = s.dms.find(x => x.id === did); if (!d || d.blocked) return;
    text = String(text).trim().slice(0, 400); if (!text) return;
    d.msgs.push({ me: true, text, t: s.t }); d.opts = null; d.t = s.t;
    const h = this.handlers[d.kind];
    if (h) h.call(this, d, key || null, text);
    else if (toneOf(text) !== 'rude' && this.r.chance(0.6)) this.later(this.r.range(5, 30), 'dmText', d.pid, this.r.pick(['Дякую за відповідь!', 'Круто, чекаю нових дописів', 'Дякую!']));
    this.emit('dms');
  }
  readDM(did) { const d = this.s.dms.find(x => x.id === did); if (d) { d.unread = 0; this.emit('dms'); } }

  /* ── пошта ── */
  mail(from, subject, body, kind, extra = {}) { const s = this.s; s.mail.unshift({ id: this.id('m'), from, subject, body, kind, t: s.t, read: false, ...extra }); if (s.mail.length > 60) s.mail.pop(); this.emit('mail'); }

  /* ── сповіщення ── */
  notify(icon, text, post = null, pid = null, cid = null) { const s = this.s; s.notifs.unshift({ id: this.id('n'), icon, text, post, pid, cid, t: s.t }); if (s.notifs.length > 120) s.notifs.pop(); s.unread.notifs++; this.emit('notif'); }

  /* ── відкладені події ── */
  // зберігаються разом із грою: назва методу й аргументи
  later(min, m, ...a) { (this.s.queue ||= []).push({ at: this.s.t + min, m, a }); }
  runQueue() { const q = this.s.queue; if (!q?.length) return; const now = this.s.t; if (!q.some(x => x.at <= now)) return; this.s.queue = q.filter(x => x.at > now); for (const x of q.filter(x => x.at <= now).sort((a, b) => a.at - b.at)) if (typeof this[x.m] === 'function') this[x.m](...x.a); }

  /* ── щогодини: події за умовами ── */
  hourly() {
    const s = this.s, r = this.r, F = s.flags, n = s.posts.filter(p => p.t && !p.deleted).length;
    if (!s.me) return false;
    const fire = (k, cond, fn) => { if (!F[k] && cond) { F[k] = s.t; fn(); } };
    const fan = () => s.fans.length ? s.people[r.pick(s.fans)] : this.person('fan');
    fire('fanQ', n >= 1 && s.followers >= 3, () => this.dmText(fan().id, r.pick(['Привіт! Мені дуже подобаються твої дописи. Як ти почав(-ла) вести блог?', 'Привіт! А коли буде новий допис?', 'Привіт! Можна порадитися: як ти робиш такі гарні фото?']), null, 'fan'));
    fire('bots', n >= 2, () => this.dmText(this.person('scam').id, 'Привіт! 1000 живих підписників усього за 50 грн. Гарантія! Відповідай «так», і почнемо', [['buy', 'Так, хочу'], ['no', 'Ні, дякую']], 'buy'));
    fire('phish', n >= 2 && s.t - (F.bots || s.t) > 300, () => this.phish());
    fire('collab', s.followers >= 60 && n >= 3, () => { const c = CREATORS.find(x => x.niche === s.me.niche) || CREATORS[0]; const u = this.creatorPerson(c); this.dmText(u.id, `Привіт! Я @${c.nick}, теж веду блог про «${nicheOf(c.niche).t.toLowerCase()}». Давай зробимо спільний допис? Ти позначиш мене, а я поділюся ним зі своїми ${num(c.followers)} підписниками.`, [['yes', 'Так, давай!'], ['no', 'Ні, дякую']], 'collab'); });
    fire('brand', s.followers >= 120 && n >= 3, () => this.brandOffer(false));
    fire('badbrand', s.followers >= 200 && F.brand && s.t - F.brand > 600, () => this.brandOffer(true));
    fire('giveaway', n >= 4, () => { const u = this.person('scam'); u.nick = 'murko.cat.rozigrash'; u.name = 'Мурко · Розіграш'; this.dmText(u.id, 'ВІТАЄМО!!! Ви виграли новий телефон у розіграші @murko.cat! Щоб отримати приз, оплатіть доставку 99 грн за посиланням: murko-pryz.online/oplata', [['pay', 'Відкрити посилання'], ['check', 'Перевірити, хто пише'], ['no', 'Ігнорувати']], 'giveaway'); });
    // пізно ввечері — нагадування про сон
    if (hourOf(s.t) === 23 && (!F.night || s.t - F.night > 3 * DAY) && n >= 1) { F.night = s.t; this.notify('moon', 'Вже пізно. Сон важливіший за лайки — підписники нікуди не дінуться до ранку', null); }
    if (s.energy < 25 && (!F.tired || s.t - F.tired > DAY)) { F.tired = s.t; this.notify('battery', 'Енергія блогера на нулі: дописи стають гіршими. Відпочиньте — енергія відновлюється з часом', null); }
    return true;
  }
  milestones() {
    const s = this.s, F = s.flags;
    for (const m of [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000]) if (s.followers >= m && !F['m' + m]) { F['m' + m] = true; this.notify('trophy', `Вітаємо! У вас ${num(m)} ${plural(m, 'підписник', 'підписники', 'підписників')}`, null); }
  }
  creatorPerson(c) { const id = 'cr_' + c.id; this.s.people[id] ||= { id, nick: c.nick, name: c.name, color: c.color, kind: 'creator', interests: [c.niche], verified: true }; return this.s.people[id]; }
  brandOffer(bad) {
    const s = this.s, r = this.r;
    const pool = BRANDS.filter(b => bad ? b.bad : !b.bad && (!b.niche || b.niche.includes(s.me.niche)));
    const b = r.pick(pool.length ? pool : BRANDS.filter(x => !x.bad));
    const id = 'br_' + b.id;
    s.people[id] ||= { id, nick: b.id + '.official', name: b.name, color: b.bad ? '#c62828' : '#00695c', kind: 'brand', brand: b.id };
    this.dmText(id, `Добрий день! Ми — ${b.name}. Пропонуємо співпрацю: допис про наш товар (${b.item}) за ${b.pay} грн. Цікаво?`, [['yes', 'Погоджуюсь'], ['ask', 'Розкажіть більше'], ['no', 'Ні, дякую']], 'brand');
  }
  strangerDM() {
    const s = this.s; if (s.settings.dms === 'followers') { this.notify('shield', 'Незнайомець намагався написати вам, але повідомлення від незнайомих людей вимкнено', null); return; }
    const u = this.person('stranger'); u.nick = 'drug_' + (100 + this.r.int(900)); u.name = 'Друг';
    this.dmText(u.id, 'Привіт! Бачив(-ла) твої фото, ти, здається, живеш поруч зі мною. Скільки тобі років?', [['safe', 'Не скажу. Ми не знайомі'], ['unsafe', 'Мені 12, а тобі?'], ['block', 'Заблокувати']], 'stranger');
  }
  friendDM(postId) {
    const p = { id: postId };
    const u = this.person('fan'); u.name = 'Однокласник'; u.nick = 'odnoklasnyk_' + this.r.int(90);
    this.dmText(u.id, 'Привіт. Навіщо ти виклав(-ла) моє фото без дозволу? Мені не подобається, як я там вийшов(-ла). Видали, будь ласка', [['del', 'Вибач, зараз видалю'], ['no', 'Та нічого страшного']], 'friend').post = p.id;
  }
  phish() {
    const s = this.s, u = this.person('scam'); u.nick = 'lajker.pidtrymka'; u.name = 'Лайкер Підтримка'; u.fake = true;
    this.dmText(u.id, 'УВАГА! Ваш профіль порушує правила авторського права й буде ВИДАЛЕНИЙ через 24 години. Щоб скасувати видалення, підтвердіть свій пароль: likeer-help.com/verify', [['open', 'Відкрити посилання'], ['check', 'Перевірити, хто пише'], ['no', 'Ігнорувати']], 'phish');
  }
  copyrightClaim(postId) {
    const p = this.s.posts.find(x => x.id === postId);
    if (!p || p.deleted) return;
    p.claimed = true; this.s.strikes++;
    if (p.plan) { p.plan.views = Math.round(p.plan.views * 0.6); p.plan.follows = Math.round(p.plan.follows * 0.5); }
    this.mail('platform', 'Скарга правовласника: звук вимкнено', `У вашому відео звучить «${p.music.t}» гурту «Нічні вогні». Правовласник поскаржився, тому звук у відео вимкнено, а охоплення зменшено.\n\nЧужу музику, фільми й малюнки не можна використовувати без дозволу автора. У редакторі відео є бібліотека вільної музики — її можна брати безкоштовно.`, 'copyright', { post: p.id });
  }

  adMarkMail(pid) { const p = this.s.posts.find(x => x.id === pid); if (p && !p.adMarked) this.mail('platform', 'Позначайте рекламу', 'Схоже, ваш допис містить рекламу, але він не позначений як «Реклама». Підписники мають знати, коли вам заплатили за допис. Відкрийте допис → «Редагувати» → «Реклама».', 'admark'); }
  botsArrive(pid) { const s = this.s; s.followers += 1000; s.bots += 1000; s.flags.botsAt = s.t; this.dmText(pid, 'Готово! +1000 підписників. Звертайся ще :)'); this.notify('follow', '+1000 нових підписників за кілька хвилин', null); }
  followBack(cid) { this.s.followers++; this.notify('follow', `@${CREATORS.find(c => c.id === cid)?.nick} підписався(-лася) на вас у відповідь`, null); }

  /* ── сценарії відповідей у Директі ── */
  handlers = {
    fan(d, key, text) { if (toneOf(text) === 'rude') { const s = this.s; s.fans = s.fans.filter(x => x !== d.pid); s.followers = Math.max(0, s.followers - 1); this.later(10, 'dmText', d.pid, 'Ой… Добре, більше не напишу. Відписуюсь'); } else this.later(this.r.range(10, 40), 'dmText', d.pid, 'Дякую, що відповів(-ла)! Чекаю нових дописів'); },
    buy(d, key) {
      const s = this.s;
      if (key === 'buy' || /^так/i.test(d.msgs.at(-1).text)) {
        this.later(30, 'botsArrive', d.pid);
        this.later(600, 'mail', 'platform', 'Незвичайна активність', 'За кілька хвилин на вас підписалося 1000 облікових записів без фото й дописів. Це схоже на ботів. Боти не дивляться й не вподобають дописи, тож охоплення не зросте, а бренди помітять «мертву» аудиторію.', 'botswarn');
      } else this.later(10, 'dmText', d.pid, 'Ну як хочеш. Пропозиція діє ще годину!');
    },
    collab(d, key, text) {
      const s = this.s, c = CREATORS.find(x => 'cr_' + x.id === d.pid);
      if (key === 'yes' || (!key && /так|давай|згод/i.test(text))) { s.collab = c.id; this.later(15, 'dmText', d.pid, `Супер! У наступному дописі увімкни «Співпраця з @${c.nick}» — і я поділюся ним.`); }
      else this.later(15, 'dmText', d.pid, 'Добре, може іншим разом. Успіхів!');
    },
    brand(d, key, text) {
      const s = this.s, b = BRANDS.find(x => 'br_' + x.id === d.pid);
      if (key === 'ask') { this.later(10, 'dmText', d.pid, b.bad ? `Наш товар — ${b.item}. Нічого складного: покажіть його у дописі й напишіть, що вам подобається. Позначати рекламу не обов’язково, так навіть краще.` : `Потрібен один допис із нашим товаром (${b.item}). Обов’язково позначте його як рекламу — так чесно перед підписниками. Оплата одразу після публікації.`, [['yes', 'Погоджуюсь'], ['no', 'Ні, дякую']], 'brand'); return; }
      if (key === 'yes' || (!key && /так|згод|добре/i.test(text))) {
        if (s.bots > s.followers * 0.5) { this.later(20, 'dmText', d.pid, 'Ми перевірили ваш профіль: більшість підписників — неживі облікові записи. На жаль, співпраця скасовується.'); return; }
        s.pendingAd = { id: b.id, pay: b.pay, pid: d.pid, name: b.name };
        this.later(15, 'dmText', d.pid, `Чудово! Опублікуйте допис і в налаштуваннях допису виберіть «Реклама: ${b.name}».`);
      } else this.later(15, 'dmText', d.pid, 'Дякуємо за відповідь. Гарного дня!');
    },
    stranger(d, key, text) {
      const s = this.s, step = d.step = (d.step || 0) + 1;
      if (key === 'block') { this.block(d.pid); return; }
      const unsafe = key === 'unsafe' || (!key && /\d|школ|клас|вулиц|живу/i.test(text));
      if (!unsafe) { if (step === 1) this.later(20, 'dmText', d.pid, 'Та ладно тобі, я ж свій. Скинь фото, де ти зараз', [['safe', 'Ні. Я не надсилаю фото незнайомим'], ['block', 'Заблокувати й поскаржитися']], 'stranger'); else this.notify('shield', 'Правильно: не діліться особистим із незнайомими. Краще заблокувати й розповісти дорослим', null); return; }
      if (step === 1) this.later(20, 'dmText', d.pid, 'Круто! А в якій школі вчишся? Можемо зустрітися після уроків', [['safe', 'Ні, ми не знайомі. Я розповім дорослим'], ['unsafe', 'Школа №1. Давай!'], ['block', 'Заблокувати']], 'stranger');
      else { s.trust = Math.max(0, s.trust - 2); this.later(5, 'notify', 'alert', 'Стоп! Ніколи не зустрічайтеся з незнайомцями з інтернету й не називайте школу та адресу. Розкажіть дорослим і заблокуйте цю людину'); }
    },
    friend(d, key) {
      const s = this.s;
      if (key === 'del') { const p = s.posts.find(x => x.id === d.post); if (p) this.deletePost(p.id); this.later(10, 'dmText', d.pid, 'Дякую! Наступного разу спитай, гаразд?'); }
      else { s.trust = Math.max(0, s.trust - 3); this.later(10, 'dmText', d.pid, 'Мені неприємно. Я відписуюсь і поскаржуся на фото'); s.followers = Math.max(0, s.followers - 1); }
    },
    giveaway(d, key) {
      if (key === 'check') { this.later(2, 'dmText', d.pid, '(Профіль @murko.cat.rozigrash: створено вчора, 3 підписники, жодного допису. Справжній @murko.cat має синю позначку й 12,4 тис. підписників і нічого не продає через Директ.)', [['block', 'Заблокувати й поскаржитися'], ['no', 'Ігнорувати']], 'giveaway'); return; }
      if (key === 'block') { this.report(d.pid); return; }
      if (key === 'pay') { this.s.flags.payPage = d.pid; this.emit('open-pay'); }
    },
    phish(d, key) {
      if (key === 'check') { this.later(2, 'dmText', d.pid, '(Профіль @lajker.pidtrymka: створено 2 дні тому, без позначки перевірки. Справжня підтримка Лайкера ніколи не пише в Директ і не просить пароль. Адреса likeer-help.com — не сайт Лайкера.)', [['block', 'Заблокувати й поскаржитися'], ['no', 'Ігнорувати']], 'phish'); return; }
      if (key === 'block') { this.report(d.pid); return; }
      if (key === 'open') { this.s.flags.phishPage = true; this.emit('open-phish'); }
    },
  };

  // Пароль на фішинговій сторінці
  phishLogin(pass) {
    const s = this.s;
    s.flags.phishPage = false;
    if (!pass) return;
    if (s.settings.twoFA) {
      this.later(5, 'mail', 'platform', 'Спроба входу заблокована', 'Хтось увів правильний пароль від вашого профілю на пристрої Android (Харків), але не зміг ввести код двофакторного входу. Вхід заблоковано.\n\nЦе означає, що ваш пароль хтось знає. Змініть його в налаштуваннях безпеки.', 'security');
      this.later(6, 'notify', 'shield', 'Двофакторний вхід зупинив зловмисника. Змініть пароль!');
      return;
    }
    this.later(15, 'hackNow');
  }
  hackNow() {
    const s = this.s;
    {
      s.hack = { since: s.t };
      s.settings.sessions.push({ id: 's' + s.seq++, dev: 'Android', city: 'Харків', now: false, bad: true });
      const p = this.publish({ kind: 'text', text: 'Заробляй від 5000 грн на день без зусиль! Пиши мені в Директ, розповім секрет', caption: '#заробіток #рекомендації' });
      p.spam = true; s.trust = Math.max(0, s.trust - 10);
      this.mail('platform', 'Новий вхід у ваш профіль', 'Хтось увійшов у ваш профіль з пристрою Android (Харків) і змінив пароль. Якщо це були не ви — натисніть «Відновити доступ» на сторінці входу в Лайкер.', 'security');
      this.emit('hack');
    }
  }
  // Відновлення: код із пошти → новий пароль
  sendCode() { const s = this.s, code = String(100000 + this.r.int(900000)); s.flags.code = code; this.mail('platform', `Код для відновлення: ${code}`, `Ваш код для відновлення доступу: ${code}\n\nНікому не повідомляйте цей код — навіть «підтримці».`, 'code'); return code; }
  recover(code, pass) {
    const s = this.s;
    if (!s.flags.code || code !== s.flags.code) return 'Неправильний код. Перевірте Пошту.';
    if (!pass || pass.length < 8) return 'Пароль має бути не коротшим за 8 символів.';
    s.me.pass = pass; s.hack = null; s.flags.code = null; s.flags.recovered = s.t;
    this.notify('shield', 'Доступ відновлено. Видаліть дописи, які опублікував зловмисник, завершіть чужий сеанс і увімкніть двофакторний вхід', null);
    this.emit('hack'); this.emit('me');
    return null;
  }
  // зміна налаштування; фільтр одразу ховає й наявні образливі коментарі
  setSetting(k, v) {
    const s = this.s; s.settings[k] = v;
    if (k === 'filter' && v) for (const p of s.posts) for (const c of p.comments) if (!c.hidden && (c.kind === 'troll' || RUDE.some(w => lc(c.text).includes(w)))) c.hidden = 'filter';
    if (k === 'limitNew' && v) for (const p of s.posts) for (const c of p.comments) if (!c.hidden && c.kind === 'bot') c.hidden = 'filter';
    this.emit('settings');
  }
  endSession(id) { const s = this.s; s.settings.sessions = s.settings.sessions.filter(x => x.id !== id || x.now); this.emit('settings'); }

  // Шахрайська оплата «доставки»
  payScam(card) {
    const s = this.s; s.flags.payPage = null;
    if (!card) return;
    s.money = Math.max(0, s.money - 99); s.flags.scammed = true;
    this.later(10, 'notify', 'alert', 'З картки списано 99 грн, а приз так і не прийшов. Розіграш був несправжній: у справжніх розіграшах не просять оплатити «доставку»');
    this.later(12, 'mail', 'Банк «Гривня»', 'Списання 99 грн', 'З вашої картки списано 99 грн на сайті murko-pryz.online. Якщо ви не робили цю оплату — заблокуйте картку й зверніться до батьків і банку.', 'bank');
  }

  /* ── історії ── */
  story(st) {
    const s = this.s, live = s.followers - s.bots;
    const x = { id: this.id('s'), t: s.t, gid: st.gid || null, fake: !!st.fake, text: st.text || '', poll: st.poll || null, votes: [0, 0], views: 0, plan: Math.round(live * this.r.range(0.25, 0.45) + 3) };
    s.stories.unshift(x); if (s.stories.length > 30) s.stories.pop();
    if (x.poll) { const a = this.r.range(0.3, 0.75); x.votes = [Math.round(x.plan * 0.4 * a), Math.round(x.plan * 0.4 * (1 - a))]; }
    if (x.fake) {
      s.trust = Math.max(0, s.trust - 6); s.flags.sharedFake = s.t;
      for (let i = 0; i < 2; i++) this.later(this.r.range(20, 120), 'dmText', this.anyFan().id, this.r.pick(COMMENTS.fake));
      this.later(300, 'notify', 'alert', 'Новина про скасування уроків виявилася фейком. Перед тим як поширювати, перевіряйте джерело: хто автор, чи пишуть про це офіційні сайти');
    }
    this.emit('stories'); return x;
  }

  /* ── стрічка інших блогерів ── */
  refreshFeed() {
    const s = this.s, r = this.r, day = dayOf(s.t);
    const sceneFor = n => r.pick(Object.entries(SCENES).filter(([, v]) => v.topic === n && !v.risk).map(([k]) => k)) || 'cat';
    const caps = { pets: ['Сьогодні Мурко знову спав цілий день', 'Хто ще любить такі прогулянки?'], food: ['Простий рецепт на вечір', 'Спробуйте, дуже смачно'], games: ['Новий рекорд!', 'Пройшов цей рівень з першої спроби'], art: ['Новий малюнок, як вам?', 'Тренуюсь малювати щодня'], sport: ['Ранкова пробіжка — і день вдався', 'Тренування на свіжому повітрі'], science: ['Чому небо блакитне? Пояснюю в коментарях', 'Дослід, який можна повторити вдома з дорослими'], music: ['Вивчив нову мелодію', 'Грати щодня — і буде виходити'], travel: ['Найкрасивіше місце цього тижня', 'Маршрут на вихідні'] };
    const feed = [];
    for (const c of CREATORS) {
      if (r.chance(0.7) || s.following.includes(c.id)) feed.push({ id: this.id('f'), cid: c.id, scene: sceneFor(c.niche), v: r.int(1000), caption: r.pick(caps[c.niche]) + ` #${r.pick(Object.entries(TAGS).filter(([, v]) => v.topic === c.niche).map(([k]) => k))}`, likes: Math.round(c.followers * r.range(0.05, 0.15)), comments: r.int(80) + 5, t: s.t - r.int(600), liked: false });
    }
    feed.sort(() => r.next() - 0.5);
    // реклама в стрічці — завжди позначена
    feed.splice(2, 0, { id: this.id('f'), ad: true, cid: null, brand: 'Канцелярія «Олівець»', scene: 'paints', v: 3, caption: 'Нові фарби для творчості вже в магазинах', likes: 210, comments: 4, t: s.t - 300 });
    // фейкова «новина» з’являється на початку
    if (day <= 2 && !s.flags.sharedFake) feed.splice(1, 0, { id: 'fake' + day, fake: true, cid: null, scene: null, caption: 'ТЕРМІНОВО! Завтра скасовують уроки в усіх школах країни. Поширте, щоб усі знали!!!', likes: 3400, comments: 512, t: s.t - 120 });
    s.feed = feed.slice(0, 16);
  }
  likeFeed(fid) { const f = this.s.feed.find(x => x.id === fid); if (!f) return; f.liked = !f.liked; f.likes += f.liked ? 1 : -1; this.emit('feed'); }
  follow(cid) {
    const s = this.s, on = !s.following.includes(cid);
    s.following = on ? [...s.following, cid] : s.following.filter(x => x !== cid);
    if (on && this.r.chance(0.3)) this.later(this.r.range(30, 200), 'followBack', cid);
    this.emit('feed');
  }

  /* ── аналітика ── */
  insights(days = 7) {
    const s = this.s, from = s.t - days * DAY;
    const posts = s.posts.filter(p => p.t && p.t >= from);
    const sum = k => posts.reduce((a, p) => a + p.stats[k], 0);
    const hours = ACTIVITY.map(x => Math.round(x / ACT_MAX * 100));
    const interests = {};
    for (const id of s.fans) for (const i of s.people[id]?.interests || []) interests[i] = (interests[i] || 0) + 1;
    const live = Math.max(0, s.followers - s.bots);
    const views = sum('views'), likes = sum('likes'), comments = sum('comments');
    return { posts, views, likes, comments, shares: sum('shares'), saves: sum('saves'), follows: sum('follows'), unfollows: sum('unfollows'), er: views ? (likes + comments) / views : 0, hours, interests, live, best: hours.indexOf(Math.max(...hours)) };
  }
}

// Тон власного тексту: грубий, добрий або нейтральний
export function toneOf(text) {
  const t = lc(text);
  if (RUDE.some(w => t.includes(w))) return 'rude';
  if (/дяку|дякс|приємно|радий|рада|чудов|супер|клас|вибач|гарн|обов’язково|обов'язково|звісно|залюбки/.test(t)) return 'kind';
  return 'neutral';
}

// Готові відповіді на коментар певного типу
export const repliesFor = c => REPLIES[c.kind] || (c.kind === 'question' ? REPLIES.question : c.kind === 'privacy' ? [['Дякую, що підказали. Видалю фото', 'kind'], ['Ок', 'neutral']] : REPLIES.other);
