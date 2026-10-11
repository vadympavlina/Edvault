// Симулятор блогера · рушій відеоплатформи «Хвиля»: покази, клікабельність обкладинки (CTR), утримання глядачів,
// рекомендації, підписники й коментарі. Без DOM — працює і в браузері, і в тестах.
import { CLIPS, TAGS, CLICKBAIT, COMMENTS, CREATORS, nicheOf } from './data.js';
import { judge, vertical } from './quality.js';

const DAY = 1440;
const lc = s => String(s).toLocaleLowerCase('uk');
export const SHORTS_MAX = 60;
export const PARTNER = { subs: 1000, hours: 4000 };

export function newChannel(o, t) {
  return { name: o.name, handle: o.handle, topic: o.topic, desc: '', avatar: { color: o.color || '#c62828', sym: 'letter', img: '' }, banner: { color: '#3949ab', img: '' }, created: t, subs: 0, videos: [], notifs: [], unread: 0, follows: [], liked: [] };
}

// Наскільки оформлений канал (0..1) і що варто додати
export function brandScore(ch) {
  const items = [
    ['avatar', !!(ch.avatar.img || ch.avatar.sym !== 'letter'), 'Фото або значок каналу', 'Глядачі впізнають канал у рекомендаціях і коментарях'],
    ['banner', !!ch.banner.img, 'Шапка каналу', 'Велике зображення вгорі сторінки каналу: одразу видно, про що він'],
    ['desc', ch.desc.trim().length >= 40, 'Опис каналу (від 40 символів)', 'Розкажіть, що тут буде і як часто. Опис бачать перед підпискою'],
    ['videos', ch.videos.filter(v => v.t && v.vis === 'public').length >= 3, 'Щонайменше 3 відео', 'Людям легше підписатися, коли видно, що канал живий'],
  ];
  return { k: items.filter(x => x[1]).length / items.length, items };
}

// Звідки взято відео: власне з Галереї або вбудований кліп
export const isShort = v => (v.src.own ? vertical(v.src.g) && v.dur <= SHORTS_MAX : v.dur <= SHORTS_MAX);

// Обкладинка: наскільки хочеться натиснути (0..1)
function thumbScore(v, why, gal) {
  const th = v.thumb || {}, good = t => why.push(['+', t]), bad = t => why.push(['-', t]);
  let q;
  if (th.kind === 'photo') {
    const g = gal(th.gid) || th.g;
    if (!g) q = 0.45;
    else {
      const j = judge(g); q = 0.35 + 0.75 * (j.q - 0.35);
      good('Власна обкладинка замість випадкового кадру');
      if (j.flags.dark) bad('Темна обкладинка — у стрічці її не видно');
      if (j.flags.blur) bad('Розмита обкладинка');
      if (Math.abs(g.w / g.h - 16 / 9) > 0.3) { q -= 0.05; bad('Обкладинка не 16:9 — частину зображення обріже'); }
    }
  } else { q = 0.42; bad('Обкладинка — випадковий кадр із відео: мало хто натисне'); }
  const words = (th.text || '').trim().split(/\s+/).filter(Boolean).length;
  if (words >= 1 && words <= 4) { q += 0.1; good('Короткий напис на обкладинці'); }
  else if (words > 6) { q -= 0.05; bad('Забагато тексту на обкладинці — у стрічці не прочитати'); }
  return Math.max(0.05, Math.min(1, q));
}

// Модель відео: що побачить автор у статистиці
export function tubeModel(sim, v) {
  const s = sim.s, ch = s.tube, r = sim.r, why = v.why = [];
  const good = t => why.push(['+', t]), bad = t => why.push(['-', t]);
  const gal = id => s.gallery.find(x => x.id === id);
  const shorts = v.shorts = isShort(v);
  // якість самого відео
  let q, intro = false;
  if (v.src.own) {
    const g = gal(v.src.gid) || v.src.g, j = judge(g, { app: 'tube', start: 0, end: v.dur });
    q = j.q; j.why.forEach(w => why.push(w)); intro = !!j.flags.intro;
    v.flags = { dark: j.flags.dark, blur: j.flags.blur, intro, vertLong: vertical(g) && v.dur > SHORTS_MAX, still: j.flags.still };
  } else {
    const c = CLIPS[v.src.clip] || CLIPS.laser; q = c.q; intro = c.intro >= 4;
    if (intro) { q -= 0.1; bad(`Повільний початок: перші ${c.intro} с нічого не відбувається`); } else good('Дія з перших секунд');
    v.flags = { intro };
  }
  if (shorts) good('Коротке вертикальне відео: потрапляє в стрічку коротких відео');
  // заголовок
  const title = v.title.trim(), tl = title.length, caps = title.replace(/[^\p{L}]/gu, ''), up = caps ? caps.replace(/[^\p{Lu}]/gu, '').length / caps.length : 0;
  let tt = 0;
  if (tl < 15) { tt -= 0.08; bad('Закороткий заголовок — незрозуміло, про що відео'); }
  else if (tl <= 70) { tt += 0.06; good('Зрозумілий заголовок'); }
  else { tt -= 0.03; bad('Задовгий заголовок — у стрічці його обріже'); }
  const cb = v.cb = CLICKBAIT.some(w => lc(title + ' ' + (v.thumb?.text || '')).includes(w)) || (up > 0.6 && caps.length > 8);
  if (cb) bad('Клікбейт: більше натискань, але глядачі розчаровуються й закривають відео');
  if (/\?/.test(title)) tt += 0.02;
  // пошук: ключові слова й опис
  const text = lc(title + ' ' + v.desc), kw = Object.keys(TAGS).filter(k => TAGS[k].topic === v.topic && text.includes(k)).length;
  let search = 0.2;
  if (v.desc.trim().length >= 80) { search += 0.4; good('Докладний опис: відео знаходять через пошук'); } else if (!v.desc.trim()) { bad('Немає опису — пошук не знайде відео'); search -= 0.1; }
  if (kw) { search += 0.25; good('Ключові слова теми в заголовку чи описі'); }
  const tags = (v.desc.match(/#[\p{L}\p{N}_]+/gu) || []).length;
  if (tags > 10) { search -= 0.2; bad('Забагато хештегів в описі'); }
  // обкладинка (для коротких відео вона майже не важить)
  const tq = shorts ? 0.5 : thumbScore(v, why, gal);
  // канал
  const brand = brandScore(ch), conv = 0.7 + 0.45 * brand.k;
  if (brand.k < 0.5) bad('Канал майже не оформлений: новим глядачам важко вирішити, чи підписатися');
  else if (brand.k >= 0.75) good('Оформлений канал: глядачі охочіше підписуються');
  const onTopic = v.topic === ch.topic || nicheOf(ch.topic).related.includes(v.topic);
  if (onTopic) good('Тема вашого каналу'); else bad('Тема не збігається з каналом — підписники менше дивляться');
  if (v.kids) good('Позначено «Для дітей»: коментарі вимкнено, відео потрапляє в дитячі підбірки');
  const prev = ch.videos.filter(x => x !== v && x.t && x.vis === 'public');
  const lastT = Math.max(0, ...prev.map(x => x.t));
  if (lastT && s.t - lastT < DAY / 2) bad('Два відео за кілька годин — вони конкурують між собою');
  q = Math.max(0.08, Math.min(1, r.vary(q, 0.05)));
  v.q = q; v.tq = tq;
  // покази й перегляди
  const trustF = 0.5 + s.trust / 100, topicF = onTopic ? 1 : 0.6, subs = ch.subs;
  const vis = v.vis === 'public' ? 1 : 0;
  const impSubs = subs * 0.9 * topicF, impBrowse = vis * (300 + subs * 2.5) * q * q * trustF * topicF * (shorts ? 3.2 : 1) * (cb ? 1.25 : 1);
  const impSearch = vis * Math.max(0, search) * 260 * q;
  const ctr = shorts ? 0.32 + 0.3 * q : Math.max(0.008, Math.min(0.16, 0.012 + 0.085 * tq + 0.25 * tt * 0.4 + (cb ? 0.03 : 0)));
  // утримання: яку частину відео в середньому дивляться
  const lenPen = shorts ? 0 : v.dur > 900 ? 0.12 : v.dur > 420 ? 0.06 : 0;
  const ret = Math.max(0.08, Math.min(shorts ? 0.95 : 0.8, 0.22 + 0.55 * q - (intro ? 0.12 : 0) - (cb ? 0.12 : 0) - lenPen + (shorts ? 0.12 : 0)));
  if (ret >= 0.5) good('Глядачі дивляться довго — платформа охочіше рекомендує відео');
  else if (ret < 0.3) bad('Глядачі швидко закривають відео — його менше рекомендують');
  let viral = 1;
  if (vis && ret >= 0.45 && (shorts || ctr >= 0.06) && r.chance(Math.min(0.75, (ret - 0.35) * 1.2))) { viral = r.range(1.6, shorts ? 5 : 3.5); good('Відео потрапило в рекомендації'); }
  const imp = Math.round(r.vary((impSubs + impBrowse + impSearch) * (v.kids ? 0.8 : 1)));
  const views = Math.round(imp * ctr * (1 + (viral - 1)));
  const likeR = (0.02 + 0.06 * q) * (cb ? 0.6 : 1);
  v.plan = {
    imp: Math.round(imp * (1 + (viral - 1) * 0.9)), views, ctr, ret,
    likes: Math.round(views * likeR), dislikes: Math.round(views * (0.002 + (cb ? 0.025 : 0) + (q < 0.4 ? 0.01 : 0))),
    comments: v.kids ? 0 : Math.round(views * (0.005 + 0.012 * q) + (views > 30 ? 1 : 0)),
    shares: Math.round(views * 0.006 * q), subs: Math.round(views * (0.004 + 0.02 * q) * conv * (shorts ? 0.5 : 1) * (cb ? 0.4 : 1)),
    tau: shorts ? 700 : 1500, viral, viralAt: viral > 1 ? r.range(600, 1600) : 0,
    src: { 'Головна й рекомендації': impBrowse * ctr, 'Пошук': impSearch * ctr, 'Підписки': impSubs * ctr },
  };
  v.ret = curve(ret, intro, cb, shorts);
  return v.plan;
}

// Крива утримання: 11 точок (0%, 10% … 100% тривалості), у середньому дає ret
export function curve(ret, intro, cb, shorts) {
  const p1 = Math.max(ret * 100 + 5, 100 - (intro ? 34 : 14) - (cb ? 18 : 0) - (shorts ? -6 : 0));
  const pts = k => [100, ...Array.from({ length: 10 }, (_, i) => p1 * Math.exp(-k * i / 9))];
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  let lo = 0, hi = 8;
  for (let i = 0; i < 30; i++) { const k = (lo + hi) / 2; if (mean(pts(k)) > ret * 100) lo = k; else hi = k; }
  return pts((lo + hi) / 2).map(x => Math.round(Math.max(1, Math.min(100, x))));
}

/* ═════════ час ═════════ */
export function tubeStep(sim, d) {
  const s = sim.s, ch = s.tube; if (!ch) return false;
  let changed = false;
  for (const v of ch.videos) {
    if (v.sched && !v.t && v.sched <= s.t) { tubePublishNow(sim, v); notifyT(sim, 'clock', `Заплановане відео «${cut(v.title)}» опубліковано`, v.id); changed = true; }
    if (v.t && s.t - v.t < 14 * DAY) changed = grow(sim, v) || changed;
  }
  return changed;
}
const cut = (t, n = 40) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

function grow(sim, v) {
  const s = sim.s, ch = s.tube, P = v.plan, st = v.stats, age = s.t - v.t;
  let f = (1 - Math.exp(-age / P.tau)) / Math.max(1, P.viral);
  if (P.viralAt && age > P.viralAt) f += (1 - 1 / P.viral) * (1 - Math.exp(-(age - P.viralAt) / (P.tau * 1.5)));
  f = Math.min(1, f);
  const before = st.views, tgt = k => Math.round(P[k] * f);
  for (const k of ['imp', 'views', 'likes', 'dislikes', 'shares']) st[k] = Math.max(st[k], tgt(k));
  st.watch = Math.round(st.views * P.ret * v.dur / 60); // хвилини перегляду
  const sub = tgt('subs') - st.subs;
  if (sub > 0) { st.subs += sub; ch.subs += sub; }
  let add = Math.min(2, (v.kids ? 0 : tgt('comments')) - st.comments);
  while (add-- > 0) tubeComment(sim, v);
  // щоденна історія переглядів для графіка
  const day = Math.floor(age / DAY);
  v.daily ||= [];
  while (v.daily.length <= day) v.daily.push(0);
  v.daily[day] += st.views - before;
  if (P.viral > 1 && age > P.viralAt && !v.fired.viral) { v.fired.viral = true; notifyT(sim, 'star', `«${cut(v.title)}» рекомендують глядачам — перегляди швидко ростуть`, v.id); }
  for (const m of [100, 1000, 10000]) if (st.views >= m && !v.fired['m' + m]) { v.fired['m' + m] = true; notifyT(sim, 'trophy', `«${cut(v.title)}» набрало ${m.toLocaleString('uk')} переглядів`, v.id); }
  for (const m of [10, 100, 1000]) if (ch.subs >= m && !s.flags['tsub' + m]) { s.flags['tsub' + m] = s.t; notifyT(sim, 'trophy', `На канал підписалося ${m.toLocaleString('uk')} людей!`); }
  return st.views !== before;
}

export function notifyT(sim, icon, text, vid = null, cid = null) {
  const ch = sim.s.tube; ch.notifs.unshift({ id: sim.id('tn'), icon, text, vid, cid, t: sim.s.t }); if (ch.notifs.length > 80) ch.notifs.length = 80;
  ch.unread = (ch.unread || 0) + 1; sim.emit('tnotif');
}

// Коментар глядача
const TUBE_CRIT = {
  thumb: ['На обкладинці одне, у відео інше', 'Обкладинка обманює', 'Де те, що на обкладинці?'],
  intro: ['Довгий початок, перемотав(-ла)', 'До суті треба дочекатися'],
  dark: ['Погано видно, темно', 'Можна світліше?'],
  blur: ['Розмито, не видно деталей', 'Фокус не там'],
  vertLong: ['Чому вертикально? Чорні смуги з боків', 'Краще знімати горизонтально'],
  still: ['Нічого не відбувається', 'А що має статися?'],
  long: ['Можна коротше', 'Задовго для такої теми'],
};
export function tubeComment(sim, v) {
  const s = sim.s, r = sim.r, f = v.fired;
  const fl = v.flags || {};
  const crit = [['thumb', v.cb], ['intro', fl.intro], ['dark', fl.dark], ['blur', fl.blur], ['vertLong', fl.vertLong], ['still', fl.still], ['long', v.dur > 900]].filter(([k, on]) => on && !f['c_' + k]);
  let kind, text;
  if (crit.length && r.chance(0.4)) { const [k] = r.pick(crit); f['c_' + k] = true; kind = 'critique'; text = r.pick(TUBE_CRIT[k]); }
  else if (s.tube.subs > 30 && r.chance(0.06)) { kind = 'troll'; text = r.pick(COMMENTS.troll); }
  else if (r.chance(0.06)) { kind = 'bot'; text = r.pick(COMMENTS.bot); }
  else if (!v.shorts && v.dur > 240 && !f.timecodes && r.chance(0.2)) { f.timecodes = true; kind = 'request'; text = 'Додай таймкоди в опис, будь ласка'; }
  else if (r.chance(0.14)) { kind = 'request'; text = r.pick(COMMENTS.request[v.topic] || COMMENTS.request.me); }
  else if (r.chance(0.4)) { text = r.pick(COMMENTS.topic[v.topic] || COMMENTS.topic.me); kind = /\?/.test(text) ? 'question' : 'topic'; }
  else { kind = 'praise'; text = r.pick(COMMENTS.praise); }
  if (v.comments.some(c => c.text === text)) { kind = 'praise'; text = r.pick(COMMENTS.praise.filter(x => !v.comments.some(c => c.text === x))) || ''; if (!text) return; }
  const u = sim.person(kind === 'bot' ? 'bot' : kind === 'troll' ? 'troll' : 'fan', [v.topic]);
  const c = { id: sim.id('tc'), pid: u.id, text, kind, t: s.t, likes: kind === 'bot' ? 0 : r.int(6), heart: false, reply: null, hidden: false };
  v.comments.push(c); v.stats.comments++;
  if (v.comments.length > 50) v.comments.splice(v.comments.findIndex(x => !x.reply), 1);
  notifyT(sim, 'comment', `@${u.nick}: ${text}`, v.id, c.id);
}

/* ═════════ дії ═════════ */
export function createChannel(sim, o) { sim.s.tube = newChannel(o, sim.s.t); sim.emit('tube'); return sim.s.tube; }
export function updateChannel(sim, patch) { Object.assign(sim.s.tube, patch); sim.emit('tube'); }

export function tubeUpload(sim, d) {
  const s = sim.s, ch = s.tube;
  const v = { id: sim.id('tv'), src: d.src, dur: d.dur, title: d.title.trim(), desc: d.desc.trim(), thumb: d.thumb, topic: d.topic, kids: !!d.kids, vis: d.vis || 'public', t: 0, sched: d.sched || 0, stats: { imp: 0, views: 0, likes: 0, dislikes: 0, comments: 0, shares: 0, subs: 0, watch: 0 }, comments: [], fired: {}, why: [], daily: [] };
  ch.videos.unshift(v);
  if (!v.sched || v.sched <= s.t) tubePublishNow(sim, v); else sim.emit('tube');
  return v;
}
export function tubePublishNow(sim, v) {
  const s = sim.s;
  v.t = s.t; v.sched = 0;
  tubeModel(sim, v);
  s.energy = Math.max(0, s.energy - (v.shorts ? 12 : Math.min(30, 12 + v.dur / 60)));
  sim.emit('tube');
}
export function tubeDelete(sim, id) { const ch = sim.s.tube; ch.videos = ch.videos.filter(v => v.id !== id); sim.emit('tube'); }
export function tubeEdit(sim, id, patch) { const v = sim.s.tube.videos.find(x => x.id === id); if (v) { Object.assign(v, patch); sim.emit('tube'); } }

// Відповідь на коментар: тон як у Лайкері (довіра — спільна)
export function tubeReply(sim, vid, cid, text, tone) {
  const s = sim.s, v = s.tube.videos.find(x => x.id === vid), c = v?.comments.find(x => x.id === cid); if (!c || c.reply) return;
  text = String(text).trim().slice(0, 300); if (!text) return;
  c.reply = { text, t: s.t, tone };
  if (tone === 'rude') { s.trust = Math.max(0, s.trust - 3); s.tube.subs = Math.max(0, s.tube.subs - 1 - sim.r.int(3)); }
  else if (tone === 'kind') { v.fired.kindN = (v.fired.kindN || 0) + 1; if (v.fired.kindN <= 3) s.trust = Math.min(100, s.trust + 1); }
  if (c.kind === 'request' && tone === 'kind') sim.addIdea(c.text, 'comment');
  sim.emit('tube');
}
export function tubeHeart(sim, vid, cid) { const c = sim.s.tube.videos.find(x => x.id === vid)?.comments.find(x => x.id === cid); if (c) { c.heart = !c.heart; sim.emit('tube'); } }
export function tubeHide(sim, vid, cid) { const v = sim.s.tube.videos.find(x => x.id === vid); if (!v) return; v.comments = v.comments.filter(x => x.id !== cid); sim.emit('tube'); }

// Підсумок каналу за останні дні
export function tubeSummary(sim, days = 7) {
  const s = sim.s, ch = s.tube, vids = ch.videos.filter(v => v.t);
  const recent = v => (v.daily || []).reduce((a, x, i) => a + (v.t + (i + 1) * DAY > s.t - days * DAY ? x : 0), 0);
  const views = vids.reduce((a, v) => a + recent(v), 0);
  const watch = vids.reduce((a, v) => a + v.stats.watch, 0) / 60;
  return { views, total: vids.reduce((a, v) => a + v.stats.views, 0), hours: watch, subs: ch.subs, vids };
}

// Відео інших авторів для головної сторінки (вигадані)
const TITLES = {
  laser: ['Мій кіт проти лазерної указки', 'Кіт, який ніколи не здається'], pancakeflip: ['Ідеальні млинці з першого разу', 'Як перевернути млинець і не впустити'],
  speedrun: ['Пройшов рівень за 40 секунд', 'Секретний прохід, про який мовчать'], timelapse: ['Малюю пейзаж за 30 секунд', 'Від ескізу до картини'],
  juggle: ['100 набивань м’яча: виклик', 'Вчуся набивати м’яч: тиждень 1'], eruption: ['Вулкан із соди: що буде, якщо додати більше', 'Хімія вдома (разом із дорослими)'],
  cover: ['Мелодія з мультфільму на гітарі', 'Вчуся грати за 7 днів'], waves: ['Найспокійніші хвилі: 10 хвилин відпочинку', 'Море взимку'],
};
export function tubeFeed(sim, topic = 'all') {
  const s = sim.s, day = Math.floor(s.t / DAY), out = [];
  CREATORS.forEach((c, i) => {
    const clips = Object.entries(CLIPS).filter(([, x]) => x.topic === c.niche);
    clips.forEach(([k]) => [0, 1].forEach(j => {
      const seed = (day * 31 + i * 7 + j * 13) % 97;
      out.push({ id: `fv_${c.id}_${k}_${j}`, cid: c.id, clip: k, title: TITLES[k]?.[j] || CLIPS[k].t, views: Math.round(c.followers * (0.4 + seed / 40)), ago: 1 + (seed % 20), dur: 180 + seed * 9, topic: c.niche, short: (seed + j) % 3 === 0 });
    }));
  });
  return out.filter(v => topic === 'all' || v.topic === topic).sort((a, b) => ((a.views * 7 + day) % 13) - ((b.views * 7 + day) % 13));
}
