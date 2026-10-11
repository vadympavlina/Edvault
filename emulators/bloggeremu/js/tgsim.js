// Симулятор блогера · месенджер Telegram: готовий акаунт із чатами, власний канал (публічний або приватний),
// охоплення дописів, реакції й пересилання, статистика та навчальні ситуації (взаємопіар, накрутка, «підтримка»-шахраї).
import { CREATORS, nicheOf, AV_COLORS, BRANDS } from './data.js';
import { intents, voice } from './talk.js';
import { ACTIVITY, DAY, hourOf, dayOf, clock, lc } from './sim.js';

export const TG_HOST = 't.me/';
export const REACTS = [['heart', '#e53935'], ['fire', '#f4511e'], ['thumbUp', '#1e88e5'], ['smile', '#f9a825']];
const TAKEN = ['news', 'kyiv_news', 'memes', 'cats', 'kotyky', 'music', 'games', 'telegram', 'support', 'admin', 'official', 'ukraine'];
const ONLINE = { mom: [7, 22], dad: [7, 23], olia: [8, 23], marko: [9, 24], babusia: [8, 21] };

// Перевірка посилання публічного каналу: латиниця, цифри, «_», 5–32 символи
export function linkErr(v, mine = '') {
  if (!v) return 'Придумайте посилання';
  if (!/^[a-z0-9_]+$/i.test(v)) return 'Лише латинські літери, цифри й «_»';
  if (v.length < 5) return 'Щонайменше 5 символів';
  if (v.length > 32) return 'Не довше 32 символів';
  if (/^\d|^_|_$/.test(v)) return 'Не можна починати з цифри чи «_» або закінчувати «_»';
  if (v.toLowerCase() !== mine && TAKEN.includes(v.toLowerCase())) return 'Це посилання вже зайняте';
  return '';
}

/* ═════════ початковий стан: акаунт уже є ═════════ */
export function newTg(sim) {
  const s = sim.s, t = s.t, m = (from, text, ago, o = {}) => ({ id: sim.id('tm'), from, text, t: t - ago, ...o });
  const murko = CREATORS[0];
  const chats = [
    { id: 'saved', kind: 'saved', title: 'Збережене', msgs: [m('me', 'Ідеї: показати, як Мурчик ловить сонячного зайчика', 3000)], unread: 0, pin: true },
    { id: 'mom', kind: 'user', title: 'Мама', color: '#ad1457', fem: true, msgs: [m('mom', 'Не забудь пообідати, суп у холодильнику', 260), m('me', 'Добре :)', 250, { seen: true }), m('mom', 'Буду о сьомій', 120)], unread: 1, pin: true },
    { id: 'class', kind: 'group', title: '7-А клас', color: '#00838f', sym: 'users', members: 28, msgs: [m('Настя', 'Хто знає, що задали з математики?', 300), m('Тарас', '№ 214 і 215', 290), m('Віка', 'Дякую!', 288), m('Денис', 'Завтра контрольна з історії, не забудьте', 95)], unread: 3 },
    { id: 'olia', kind: 'user', title: 'Оля', color: '#6a1b9a', fem: true, msgs: [m('olia', 'Бачила твій допис в Instagram, класний кіт!', 1500), m('me', 'Дякую! Це Мурчик', 1490, { seen: true })], unread: 0 },
    { id: 'chan_c1', kind: 'feed', title: murko.name, color: murko.color, sym: 'paw', subs: 3240, msgs: [
      m('chan', 'Доброго ранку! Сьогодні розповім, чому коти так люблять коробки. Коротко: у коробці тепло й безпечно, а ще звідти зручно стежити за всіма', 1100, { views: 2310, react: { heart: 182, fire: 40, smile: 25 } }),
      m('chan', 'Опитування: що показати в наступному відео?', 400, { views: 1870, poll: { q: 'Що показати в наступному відео?', opts: [['Як ми купаємо кота', 412], ['Нові іграшки', 268], ['Кіт і пилосос', 590]] } }),
    ], unread: 2, muted: true },
    { id: 'leleka', kind: 'service', title: 'Telegram', verified: true, msgs: [m('svc', 'Код для входу в Telegram: 51 847. Нікому не повідомляйте цей код, навіть якщо хтось пише від імені Telegram.', 4000)], unread: 0 },
    { id: 'dad', kind: 'user', title: 'Тато', color: '#283593', fem: false, msgs: [m('dad', 'Ввечері заберу тебе з гуртка', 2900)], unread: 0 },
    { id: 'babusia', kind: 'user', title: 'Бабуся', color: '#5d4037', fem: true, msgs: [m('babusia', 'Онучко, як ти? Приїжджай у неділю, спечу пиріжки', 5200)], unread: 0 },
    { id: 'marko', kind: 'user', title: 'Марко', color: '#2e7d32', fem: false, msgs: [m('marko', 'Го ввечері в гру?', 2000)], unread: 0 },
  ];
  return { chats, ch: null, set: { phone: 'all', pass2: false, sessions: [{ id: 'here', dev: 'Цей телефон', city: 'Київ', now: true }] }, flags: {} };
}

/* ═════════ допоміжне ═════════ */
const later = (sim, min, m, ...a) => (sim.s.tg.later ||= []).push({ at: sim.s.t + min, m, a });
const chatOf = (s, id) => s.tg.chats.find(c => c.id === id);
const ch = s => s.tg.ch;
export const realSubs = c => Math.max(0, c.subs - (c.bots || 0));
function bump(s, c) { const i = s.tg.chats.indexOf(c); if (i > 0) { s.tg.chats.splice(i, 1); s.tg.chats.unshift(c); } }
export function tgUnread(s) { return s.tg ? s.tg.chats.reduce((a, c) => a + (c.muted || c.blocked ? 0 : c.unread || 0), 0) : 0; }
// повідомлення від когось у чат
export function tgPush(sim, cid, from, text, o = {}) {
  const s = sim.s, c = chatOf(s, cid); if (!c || c.blocked) return null;
  const msg = { id: sim.id('tm'), from, text: c.fem !== undefined && from !== 'me' ? voice(text, c.fem) : text, t: s.t, ...o };
  c.msgs.push(msg); if (c.msgs.length > 120) c.msgs.splice(0, c.msgs.length - 120);
  for (const x of c.msgs) if (x.from === 'me') x.seen = true;
  if (sim.tgWatch !== cid) { c.unread = (c.unread || 0) + 1; if (!c.muted) sim.emit('tgmsg:' + cid); }
  bump(s, c); return msg;
}
// новий чат (події)
function openChat(sim, id, o) { const s = sim.s; let c = chatOf(s, id); if (!c) { c = { id, kind: 'user', msgs: [], unread: 0, ...o }; s.tg.chats.unshift(c); } return c; }
// репліки з паузою: людина «друкує»
function say(sim, cid, lines, opts = null, delay = 1) {
  const s = sim.s, c = chatOf(s, cid); if (!c) return;
  let at = Math.max(s.t, c.pending?.at(-1)?.at || 0) + delay;
  c.pending ||= [];
  (Array.isArray(lines) ? lines : [lines]).forEach((x, i, a) => { const [from, text] = Array.isArray(x) ? x : [c.kind === 'group' ? 'Настя' : cid, x]; at += 0.5 + Math.min(3, text.length / 60); c.pending.push({ at, from, text, opts: i === a.length - 1 ? opts : undefined }); });
}
export function tgDeliver(sim, c) {
  const x = c.pending?.shift(); if (!x) return;
  tgPush(sim, c.id, x.from, x.text);
  if (x.opts !== undefined) c.opts = x.opts;
  if (x.fx) TG_FX[x.fx]?.(sim);
}
export function tgOnline(s, c, t = s.t) { const r = ONLINE[c.id]; if (!r) return true; const h = hourOf(t); return h >= r[0] && h < r[1]; }

/* ═════════ особисті чати: живі відповіді ═════════ */
const BANK = {
  mom: { greet: 'Привіт, сонечко! Як день?', question: 'Зараз на роботі, ввечері поговоримо :)', kind: 'Дякую, рідненьке', thanks: 'Завжди будь ласка', bye: 'Цілую!', '*': ['Добре. Не забудь пообідати!', 'Зрозуміла. Ти молодчинка', 'Добре, ввечері розкажеш'] },
  dad: { greet: 'Привіт! Все гаразд?', question: 'Хороше питання. Обговоримо ввечері', kind: 'Ото ж бо!', thanks: 'Нема за що', bye: 'Па', '*': ['Ок', 'Зрозумів', 'Добре, домовились'] },
  olia: { greet: 'Приві-і-іт!', question: 'Хм, не знаю :) а ти як думаєш?', laugh: 'Ахаха, точно', kind: 'Ой, дякую', thanks: 'Звертайся :)', bye: 'Бувай!', '*': ['Ага, згодна', 'Ого, круто', 'Розкажеш завтра в школі?'] },
  marko: { greet: 'Здоров!', question: 'Без поняття, чесно', laugh: 'Ахах', thanks: 'Та нема за що', bye: 'Давай', '*': ['Ага', 'Ну ок', 'Норм'] },
  babusia: { greet: 'Здрастуй, моє серденько!', question: 'Ой, я в цьому не розбираюся, спитай у мами', kind: 'Ти ж моя золота дитина', thanks: 'На здоров’я', bye: 'Бережи себе!', '*': ['Добре, добре', 'Чекаю тебе в неділю', 'Одягайся тепло'] },
};
export function tgSend(sim, cid, text) {
  const s = sim.s, c = chatOf(s, cid); text = String(text).trim().slice(0, 1000); if (!c || !text || c.blocked) return null;
  const msg = { id: sim.id('tm'), from: 'me', text, t: s.t, seen: c.kind === 'saved' };
  c.msgs.push(msg); c.opts = null; bump(s, c);
  const ints = intents(text);
  // код для входу нікому не надсилають
  if (/51847|73914/.test(text.replace(/\D/g, '')) && c.kind !== 'saved') { codeLeak(sim, cid); return msg; }
  if (c.script) { scriptReply(sim, c, text, null); return msg; }
  const bank = BANK[cid];
  if (bank) {
    const k = ['greet', 'question', 'laugh', 'thanks', 'kind', 'bye'].find(x => ints.has(x) && bank[x]);
    const line = k ? bank[k] : sim.r.pick(bank['*']);
    if (ints.has('personal') && cid !== 'mom' && cid !== 'dad' && cid !== 'babusia') sysTip(sim, cid, 'Навіть друзям краще не писати адресу чи номер телефону в чатах: переписку можуть переслати або побачити інші.');
    let at = s.t + 1; if (!tgOnline(s, c)) { at = s.t; while (!tgOnline(s, c, at)) at += 30; }
    c.pending ||= []; c.pending.push({ at: at + 0.6 + sim.r.int(3), from: cid, text: line });
  } else if (c.kind === 'group' && sim.r.chance(0.6)) {
    say(sim, cid, [[sim.r.pick(['Настя', 'Тарас', 'Віка', 'Денис', 'Злата']), ints.has('question') ? 'Не знаю, спитай у Дениса' : sim.r.pick(['+', 'Ага', 'Ок', 'Згода'])]], null, 2);
  }
  sim.emit('tg'); return msg;
}
function sysTip(sim, cid, text) { const c = chatOf(sim.s, cid); if (c && c.msgs.at(-1)?.text !== text) c.msgs.push({ id: sim.id('tm'), from: 'sys', text, t: sim.s.t }); }
export function tgRead(sim, cid) { const c = chatOf(sim.s, cid); if (c) c.unread = 0; }

/* ═════════ створення каналу ═════════ */
export function tgCreateChannel(sim, o) {
  const s = sim.s, t = s.t;
  const c = {
    id: 'mych', title: o.title.trim().slice(0, 60), desc: (o.desc || '').trim().slice(0, 255), avatar: { color: o.color || '#1f7ac4', sym: o.sym || 'letter', img: o.img || '' }, topic: o.topic || 'pets',
    pub: !!o.pub, link: o.pub ? o.link : '', invite: '+' + Math.abs((s.rs * 7919 + t) % 0xffffff).toString(36).padStart(5, 'k') + 'Qx', created: t,
    subs: 0, bots: 0, members: [], posts: [], daily: [], src: { invite: 0, search: 0, fwd: 0, promo: 0, add: 0, bots: 0 }, set: { sign: false, reacts: true, comments: true }, penalty: 0, fired: {},
  };
  s.tg.ch = c;
  const chat = { id: 'mych', kind: 'mine', title: c.title, msgs: [{ id: sim.id('tm'), from: 'sys', text: 'Канал створено', t }], unread: 0, pin: true };
  s.tg.chats.unshift(chat);
  // контакти, додані без запиту
  for (const id of o.add || []) addMember(sim, id, 'add');
  if ((o.add || []).some(id => ['olia', 'marko'].includes(id))) {
    const who = (o.add || []).find(id => ['marko', 'olia'].includes(id));
    say(sim, who, ['Мене щойно додали в канал без запитання…', 'Наступного разу краще спитай або надішли посилання — тоді кожен сам вирішить, чи підписуватися'], null, 20);
    s.tg.flags.leaveAfter = who;
  }
  if ((o.add || []).includes('mom')) say(sim, 'mom', ['Ой, мене додали в твій канал! Пишаюся тобою', 'Тільки не пиши там нашу адресу і школу, домовились?'], null, 30);
  sim.emit('tg'); return c;
}
// новий читач гортає кілька останніх дописів
function seen(sim, c) { for (const p of c.posts.filter(x => x.t && !x.hidden && sim.s.t - x.t < 3 * DAY).slice(-3)) if (sim.r.chance(0.7)) { p.stats.views++; dayRec(sim).views++; } }
function addMember(sim, id, src) {
  const c = ch(sim.s); if (!c || c.members.includes(id)) return false;
  c.members.push(id); c.subs++; c.src[src] = (c.src[src] || 0) + 1; dayRec(sim).joined++; seen(sim, c); return true;
}
function dayRec(sim) {
  const c = ch(sim.s), d = dayOf(sim.s.t);
  let r = c.daily.at(-1); if (!r || r.day !== d) { r = { day: d, subs: c.subs, joined: 0, left: 0, views: 0 }; c.daily.push(r); if (c.daily.length > 30) c.daily.shift(); }
  return r;
}
export function tgEditChannel(sim, patch) { const c = ch(sim.s); Object.assign(c, patch); const chat = chatOf(sim.s, 'mych'); if (chat && patch.title) chat.title = patch.title; sim.emit('tg'); }
export function tgDeleteChannel(sim) { const s = sim.s; s.tg.ch = null; s.tg.chats = s.tg.chats.filter(c => c.id !== 'mych'); sim.emit('tg'); }

/* ═════════ дописи в каналі ═════════ */
const LINK_RE = /(https?:\/\/|www\.|[a-z0-9-]+\.(com|ua|net|org|me|online|ru)\b)/gi;
// що в дописі добре, а що заважає
export function postCheck(p) {
  const text = p.text || '', len = text.replace(/\s/g, '').length, out = [];
  const ints = intents(text);
  if (ints.has('personal')) out.push(['bad', 'Особисті дані', 'Схоже, тут є школа, клас, адреса, вік або телефон. Канал може читати будь-хто — краще прибрати.']);
  if (len < 12 && !p.gid && !p.poll) out.push(['warn', 'Замало змісту', 'Короткий допис без фото читачі часто пропускають. Додайте думку, фото чи опитування.']);
  if (len > 1500) out.push(['warn', 'Задовго', 'Довгий текст рідко дочитують. Розбийте на абзаци або на два дописи.']);
  if (/[A-ZА-ЯІЇЄҐ]{8,}/.test(text) || /!{3,}/.test(text) || /шок|терміново|ти не повіриш/i.test(text)) out.push(['warn', 'Як клікбейт', 'Великі літери, «ШОК» і багато знаків оклику дратують читачів.']);
  if ((text.match(LINK_RE) || []).length > 2) out.push(['warn', 'Багато посилань', 'Схоже на спам. Залиште одне посилання.']);
  if (p.gid) out.push(['ok', 'З фото', 'Дописи з фото переглядають і пересилають частіше.']);
  if (p.poll) out.push(['ok', 'Опитування', 'Опитування залучають читачів: голосують навіть ті, хто зазвичай мовчить.']);
  if (len >= 40 && len <= 900) out.push(['ok', 'Добра довжина', 'Достатньо, щоб розповісти щось цікаве, і легко дочитати.']);
  return out;
}
function quality(p) {
  let q = 0.5;
  for (const [k] of postCheck(p)) q += k === 'ok' ? 0.1 : k === 'warn' ? -0.13 : -0.08;
  return Math.max(0.05, Math.min(1, q));
}
export function tgPost(sim, o) {
  const s = sim.s, c = ch(s); if (!c) return null;
  const p = { id: sim.id('tp'), text: String(o.text || '').trim().slice(0, 4000), gid: o.gid || null, poll: o.poll ? { q: o.poll.q, opts: o.poll.opts.map(t => [t, 0]), my: null } : null, silent: !!o.silent, sched: o.sched || 0, t: 0, by: o.by || 'me', ad: o.ad || null, spam: !!o.spam,
    stats: { views: 0, fwd: 0, joined: 0, left: 0 }, react: {}, comments: [], fired: {} };
  c.posts.push(p);
  if (!p.sched) tgPublish(sim, p);
  sim.emit('tg'); return p;
}
export function tgPublish(sim, p) {
  const s = sim.s, c = ch(s), t = s.t, h = hourOf(t); p.t = t; p.sched = 0;
  const q = p.ad === 'casino' || p.spam ? 0.1 : quality(p), act = Math.max(0.25, Math.min(1, ACTIVITY[h] / 20));
  const recent = c.posts.filter(x => x.t && x !== p && t - x.t < DAY).length, fatigue = Math.max(0, (recent - 3) * 0.12);
  const night = (h >= 22 || h < 7) && !p.silent, real = realSubs(c);
  const reach = Math.max(0.12, Math.min(0.9, (0.33 + 0.4 * q) * (0.72 + 0.28 * act) * (1 - Math.min(0.6, fatigue)) * (1 - (c.penalty > t ? 0.45 : 0))));
  const views = Math.round(real * reach + (c.pub ? real * 0.06 + 2 * q : 0) + (c.members.length ? 1 : 0));
  const fwd = Math.round(views * (0.006 + 0.05 * q * q));
  p.plan = {
    views, fwd, react: c.set.reacts ? Math.round(views * (0.05 + 0.14 * q)) : 0, votes: p.poll ? Math.round(views * 0.55) : 0,
    joined: Math.round(fwd * (1.2 + 3 * q) * (c.pub ? 1 : 0.55)), left: Math.round(real * (Math.min(0.08, fatigue * 0.05) + (night ? 0.025 : 0) + (q < 0.25 ? 0.02 : 0) + (p.ad === 'casino' ? 0.14 : 0) + (p.spam ? 0.1 : 0))),
    comments: c.set.comments && views ? Math.round(views * 0.035 * q + q * 0.8) : 0, tau: 140 + sim.r.int(80), q, night, fatigue: recent >= 4,
  };
  const nick = s.me?.nick; if (nick && (p.text.includes('@' + nick) || /лайкер/i.test(p.text))) p.plan.lk = Math.round(views * (0.04 + 0.06 * q));
  const chat = chatOf(s, 'mych'); if (chat) bump(s, chat);
  return p;
}
// рекламний допис за замовленням бренду
const HYPE = /гарантован|100\s?%|найкращ\S* у світі|миттєво|схудн|чудодійн|без зусиль/i;
export function adCheck(text, mark, task) {
  const out = [], len = String(text).replace(/\s/g, '').length;
  out.push(mark ? ['ok', 'Позначено як рекламу', 'Читачі бачать, що це реклама, і довіряють вам.'] : ['bad', 'Немає позначки «Реклама»', 'Без позначки реклама вводить читачів в оману. Платформа й бренд вимагають позначати рекламу.']);
  if (HYPE.test(text)) out.push(['bad', 'Перебільшення', 'Обіцянки на кшталт «гарантовано», «100%», «миттєво» звучать як обман.']);
  if (len < 40) out.push(['warn', 'Замало змісту', 'Розкажіть своїми словами, чим товар може бути корисним. Так реклама не дратує.']);
  else if (!HYPE.test(text)) out.push(['ok', 'Своїми словами', 'Чесний відгук звучить переконливіше за гучні гасла.']);
  if (task?.bad) out.push(['bad', 'Сумнівний товар', 'Цей товар обіцяє неможливе. Така реклама шкодить читачам.']);
  return out;
}
export function tgAdPost(sim, o) {
  const s = sim.s, c = ch(s), task = c?.adTask; if (!task) return null;
  const p = tgPost(sim, { text: o.text, gid: o.gid, ad: task.bad ? 'bad' : 'brand' });
  p.task = { ...task }; p.adMark = !!o.mark; p.brand = task.brand;
  const ads = c.posts.filter(x => x.t && (x.ad === 'brand' || x.ad === 'bad')).slice(-8).length, all = c.posts.filter(x => x.t).slice(-8).length;
  if (p.plan) {
    const real = realSubs(c), hype = HYPE.test(o.text);
    p.plan.left += Math.round(real * ((o.mark ? 0.003 : 0.012) + (hype ? 0.02 : 0) + (task.bad ? 0.1 : 0) + (ads / Math.max(1, all) > 0.3 ? 0.05 : 0)));
    p.plan.views = Math.round(p.plan.views * 0.85); p.plan.react = Math.round(p.plan.react * (task.bad ? 0.2 : 0.6)); p.plan.joined = Math.round(p.plan.joined * 0.4);
    p.plan.tooMany = ads / Math.max(1, all) > 0.3;
  }
  c.lastTask = c.adTask; c.adTask = null;
  later(sim, DAY, 'brandPay', p.id);
  if (!o.mark) later(sim, 150, 'adUnmarked', p.id);
  if (task.bad) later(sim, 240, 'badAfter');
  sim.emit('tg'); return p;
}
export function tgEditPost(sim, id, text) { const p = ch(sim.s)?.posts.find(x => x.id === id); if (p) { p.text = String(text).trim().slice(0, 4000); p.edited = true; sim.emit('tg'); } }
export function tgMarkAd(sim, id) { const p = ch(sim.s)?.posts.find(x => x.id === id); if (p && p.task) { p.adMark = true; sim.emit('tg'); } }
export function tgDeletePost(sim, id) { const c = ch(sim.s); if (c) { c.posts = c.posts.filter(x => x.id !== id); if (c.pinned === id) c.pinned = null; sim.emit('tg'); } }
export function tgPin(sim, id) { const c = ch(sim.s); if (c) { c.pinned = c.pinned === id ? null : id; sim.emit('tg'); } }
export function tgVote(sim, pid, i) { const p = ch(sim.s)?.posts.find(x => x.id === pid) || null; if (p?.poll && p.poll.my === null) { p.poll.my = i; p.poll.opts[i][1]++; sim.emit('tg'); } }

/* ═════════ запрошення за посиланням ═════════ */
const JOIN_LINE = { mom: 'Підписалася! Буду читати кожен допис', dad: 'Підписався. Цікаво!', olia: 'О, канал! Уже підписалася :)', marko: 'Ок, підписався', babusia: 'Онучко, а як тут підписатися? А, вже вийшло!' };
export function tgInvite(sim, ids) {
  const s = sim.s, c = ch(s); if (!c) return;
  const link = c.pub ? TG_HOST + c.link : TG_HOST + c.invite;
  for (const id of ids) {
    const chat = chatOf(s, id); if (!chat) continue;
    chat.msgs.push({ id: sim.id('tm'), from: 'me', text: `Привіт! У мене тепер є канал «${c.title}». Підписуйся, якщо цікаво: ${link}`, t: s.t, card: true }); bump(s, chat);
    if (chat.kind === 'group') { s.tg.flags.classInvite = s.t; say(sim, id, [['Віка', 'О, круто! Підписалася'], ['Тарас', 'Ок, гляну'], ['Злата', 'А про що канал?']], null, 8); for (let i = 0; i < 4 + sim.r.int(6); i++) later(sim, 10 + sim.r.int(300), 'join', 'invite'); }
    else if (JOIN_LINE[id] && !c.members.includes(id)) { say(sim, id, [JOIN_LINE[id]], null, 10 + sim.r.int(40)); later(sim, 15 + sim.r.int(40), 'member', id); }
  }
  sim.emit('tg');
}

/* ═════════ сценарії подій: вибір відповіді ═════════ */
const SCRIPTS = {
  casino: { start: ['Привіт! Маю для тебе підробіток :)', 'Розмісти в себе на каналі наш допис — заплачу 200 грн. Нічого складного'], opts: [['ask', 'А що за допис?'], ['yes', 'Добре, давай'], ['no', 'Ні, дякую']],
    on: { ask: { say: ['Реклама нашого каналу про заробіток. Ставки на спорт, ігрові автомати, легкі гроші', 'Твоїм підписникам сподобається'], opts: [['yes', 'Гаразд, розміщу'], ['no', 'Ні, мої читачі — діти, це шкідливо']] },
      yes: { say: ['Супер! Ось текст, опублікуй просто зараз'], fx: 'casinoPost', end: true }, no: { say: ['Ну як знаєш. Інші погоджуються'], fx: 'casinoNo', end: true } } },
  boost: { start: ['ПІДПИСНИКИ ДЛЯ КАНАЛУ', '1000 підписників — 99 грн, 5000 — 399 грн. Миттєво! Канал виглядатиме популярним, і на нього підписуватимуться ще більше'], opts: [['yes', 'Хочу 1000 підписників'], ['ask', 'А вони справжні?'], ['no', 'Ні, не треба']],
    on: { ask: { say: ['Це акаунти, які просто є в списку :) Головне — гарна цифра'], opts: [['yes', 'Все одно хочу'], ['no', 'Тоді не треба']] }, yes: { say: ['Готово! Насолоджуйся популярністю'], fx: 'bots', end: true }, no: { say: ['Ок. Якщо передумаєш — пиши'], fx: 'botsNo', end: true } } },
  admin: { start: ['Слухай, зроби мене адміном у своєму каналі?', 'Я буду постити меми й фотки з класу, буде весело'], opts: [['full', 'Добре, даю всі права'], ['part', 'Краще скинь ідею мені, а опублікую я'], ['no', 'Ні, поки веду канал без помічників']],
    on: { full: { say: ['Йес! Дякую'], fx: 'adminFull', end: true }, part: { say: ['Ок, домовились. Скину ідею, як придумаю'], fx: 'adminPart', end: true }, no: { say: ['Ну ок, як хочеш'], end: true } } },
  phish: { start: ['Служба безпеки Telegram. На ваш канал надійшли скарги.', 'Щоб уникнути блокування, протягом 24 годин підтвердіть, що ви власник: надішліть сюди код, який зараз прийде в SMS.'], opts: [['send', 'Надіслати код'], ['ask', 'Справжня підтримка так пише?'], ['report', 'Поскаржитися й заблокувати']],
    on: { ask: { say: ['Так, це офіційне звернення. Надішліть код, інакше канал буде видалено'], sys: 'Справжня підтримка Telegram ніколи не просить код зі SMS і не погрожує видаленням. У справжнього службового чату є синя позначка.', opts: [['send', 'Надіслати код'], ['report', 'Поскаржитися й заблокувати']] }, send: { fx: 'codeLeak', end: true }, report: { fx: 'phishReport', end: true } } },
  brand: { start: ['Добрий день! Ми — {brand}. Бачимо, у вас живий канал про {topic}.', 'Пропонуємо рекламний допис про {item}. Оплата — {pay} грн. Цікаво?'], opts: [['terms', 'Які умови?'], ['yes', 'Так, цікаво'], ['money', 'А можна більше?'], ['no', 'Ні, дякую']],
    on: { terms: { say: ['Один допис у вашому каналі, текст пишете самі, своїми словами. Допис має бути позначений як реклама й провисіти щонайменше добу. Оплата — після публікації.'], opts: [['yes', 'Добре, беру'], ['money', 'А можна більше?'], ['no', 'Ні, дякую']] },
      money: { say: ['Можемо {pay2} грн — це наша найкраща ціна для каналу такого розміру'], fx: 'brandHaggle', opts: [['yes', 'Домовились'], ['no', 'Ні, дякую']] },
      yes: { say: ['Чудово! Ще одне: вам уже є 18? Якщо ні, домовленість має погодити хтось із батьків.'], opts: [['parents', 'Мені менше 18 — покажу батькам'], ['adult', 'Мені вже є 18']] },
      parents: { say: ['Дякуємо, що чесно! Батьки отримають умови на пошту. А ось завдання для допису:', 'Розкажіть своїми словами, чим {item} може стати в пригоді вашим читачам. Обов’язково позначте допис як рекламу. Строк — 2 дні.'], fx: 'brandDeal', end: true },
      adult: { say: ['Для неповнолітніх домовленість однаково погоджують батьки — так вимагає закон. Покажіть, будь ласка, умови мамі чи татові.', 'А ось завдання: розкажіть своїми словами, чим {item} може стати в пригоді читачам. Позначте допис як рекламу. Строк — 2 дні.'], sys: 'Неправда про вік у домовленості — серйозна річ: через неї угоду можуть розірвати. Дітям такі домовленості завжди погоджують батьки.', fx: 'brandDeal', end: true },
      no: { say: ['Зрозуміло, гарного дня! Якщо передумаєте — пишіть'], end: true } } },
  badbrand: { start: ['Привіт! Ми продаємо {item}. Заплатимо {pay} грн за допис у вашому каналі.', 'Текст дамо готовий: «Пий наш чай — і схуднеш за ніч без спорту! Гарантовано на 100%!»'], opts: [['ask', 'А це правда працює?'], ['yes', 'Ого, давайте!'], ['no', 'Ні, це обман читачів']],
    on: { ask: { say: ['Ну… головне, щоб купували :) Гроші ж хороші'], sys: 'Чаю, що «спалює жир за ніч», не існує. Реклама неправдивих товарів шкодить читачам і вашій репутації, хоч би скільки за неї платили.', opts: [['yes', 'Все одно давайте'], ['no', 'Ні, не буду обманювати читачів']] },
      yes: { say: ['Супер! Опублікуйте текст, який ми надіслали'], fx: 'badDeal', end: true }, no: { say: ['Шкода. Інші погоджуються'], fx: 'badNo', end: true } } },
  promo: { start: ['Привіт! Я веду канал «{name}» — {subs} читачів, теж про {topic}.', 'Пропоную взаємопіар: ми розповідаємо про ваш канал, ви — про наш. Згода?'], opts: [['yes', 'Так, давай'], ['no', 'Ні, дякую']],
    on: { yes: { say: ['Супер! Сьогодні опублікуємо. Ось наш допис для вас'], fx: 'promoYes', end: true }, no: { say: ['Добре, удачі з каналом!'], end: true } } },
};
function runNode(sim, c, node) {
  const sc = SCRIPTS[c.script], n = node === 'start' ? { say: sc.start, opts: sc.opts } : sc.on[node]; if (!n) return;
  const ctx = c.ctx || {}, f = x => x.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? '').replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, a) => a);
  if (n.sys) c.pending ||= [];
  if (n.say) say(sim, c.id, n.say.map(f), n.opts ? n.opts.map(([k, t]) => [k, f(t)]) : null);
  if (n.sys) c.pending.push({ at: (c.pending.at(-1)?.at || sim.s.t) + 0.5, from: 'sys', text: n.sys });
  if (n.fx) { if (n.say) c.pending.at(-1).fx = n.fx; else TG_FX[n.fx](sim); }
  if (n.end) c.done = true;
}
function scriptReply(sim, c, text, key) {
  const sc = SCRIPTS[c.script]; if (!sc || c.done) return;
  const ints = intents(text); let k = key;
  if (!k) k = c.opts?.find(([, t]) => t === text)?.[0] || (ints.has('money') && sc.on.money ? 'money' : ints.has('adult') && sc.on.parents ? 'parents' : ints.has('yes') ? 'yes' : ints.has('no') ? 'no' : ints.has('question') && sc.on.ask ? 'ask' : ints.has('block') || ints.has('adult') ? (sc.on.report ? 'report' : 'no') : null);
  if (!k || !sc.on[k]) { say(sim, c.id, [c.script === 'phish' ? 'Надішліть код зі SMS' : 'Так чи ні?'], c.opts, 2); return; }
  c.opts = null; runNode(sim, c, k);
}
export function tgOpt(sim, cid, key) {
  const c = chatOf(sim.s, cid); const o = c?.opts?.find(x => x[0] === key); if (!o) return;
  c.msgs.push({ id: sim.id('tm'), from: 'me', text: o[1], t: sim.s.t }); c.opts = null;
  scriptReply(sim, c, o[1], key); sim.emit('tg');
}
export function tgBlock(sim, cid) { const c = chatOf(sim.s, cid); if (c) { c.blocked = true; c.opts = null; c.pending = []; if (c.script === 'phish' && !sim.s.tg.flags.phishOk) TG_FX.phishReport(sim); sim.emit('tg'); } }

function codeLeak(sim, cid) {
  const s = sim.s, c = ch(s);
  if (s.tg.set.pass2) { sysTip(sim, cid, 'Шахраї спробували увійти з вашим кодом, але їх зупинив хмарний пароль. Ніколи не надсилайте код — і добре, що пароль увімкнено!'); tgPush(sim, 'leleka', 'svc', 'Хтось ввів правильний код, але не знав хмарного пароля. Вхід заблоковано. Нікому не повідомляйте коди.'); s.tg.flags.phishOk = true; sim.emit('tg'); return; }
  s.tg.flags.hacked = s.t; s.trust = Math.max(0, s.trust - 6);
  s.tg.set.sessions.push({ id: 'evil', dev: 'Windows · браузер', city: 'Невідоме місто', now: false, evil: true });
  tgPush(sim, 'leleka', 'svc', 'Новий вхід у ваш акаунт: Windows, браузер, невідоме місто. Якщо це не ви — відкрийте Налаштування → Активні сеанси й завершіть чужий сеанс.');
  if (c) { tgPost(sim, { text: 'РОЗІГРАШ! Перші 100 отримають телефон. Переходь за посиланням і вводь дані картки: priz-telegram.online', by: 'evil', spam: true }); tgPost(sim, { text: 'Встигни забрати приз! priz-telegram.online', by: 'evil', spam: true }); }
  sysTip(sim, cid, 'Ви надіслали код для входу шахраям. Вони увійшли у ваш акаунт і вже публікують спам у каналі. Терміново завершіть чужий сеанс у Налаштуваннях і ввімкніть хмарний пароль.');
  sim.emit('tg');
}
export function tgEndSession(sim, id) {
  const s = sim.s; s.tg.set.sessions = s.tg.set.sessions.filter(x => x.id !== id || x.now);
  if (id === 'evil' || id === 'all') { s.tg.set.sessions = s.tg.set.sessions.filter(x => !x.evil); if (s.tg.flags.hacked) { s.tg.flags.hacked = 0; s.tg.flags.recovered = true; tgPush(sim, 'leleka', 'svc', 'Чужий сеанс завершено. Видаліть спам-дописи з каналу й увімкніть хмарний пароль у Налаштуваннях → Конфіденційність.'); } }
  sim.emit('tg');
}

// наслідки виборів
const TG_FX = {
  casinoPost(sim) { const c = ch(sim.s); if (!c) return; tgPost(sim, { text: 'Хочеш легкі гроші? Ставки на спорт і ігрові автомати — виграш щодня! Переходь: bet-lucky.online', ad: 'casino' }); sim.s.trust = Math.max(0, sim.s.trust - 6); later(sim, 180, 'casinoWarn'); },
  casinoNo(sim) { sim.s.trust = Math.min(100, sim.s.trust + 1); sim.s.tg.flags.casinoNo = true; },
  bots(sim) { const c = ch(sim.s); if (!c) return; c.bots += 1000; c.subs += 1000; c.src.bots += 1000; sim.s.tg.flags.botsAt = sim.s.t; dayRec(sim).joined += 1000; },
  botsNo(sim) { sim.s.tg.flags.botsNo = true; },
  adminFull(sim) { sim.s.tg.flags.adminFull = true; if (ch(sim.s)) ch(sim.s).admins = ['marko']; later(sim, 120 + sim.r.int(120), 'markoPost'); },
  adminPart(sim) { sim.s.tg.flags.adminPart = true; later(sim, 300, 'markoIdea'); },
  codeLeak(sim) { codeLeak(sim, 'phish'); },
  phishReport(sim) { const c = chatOf(sim.s, 'phish'); if (c) { c.blocked = true; c.opts = null; } sim.s.tg.flags.phishOk = true; sim.s.trust = Math.min(100, sim.s.trust + 2); sysTip(sim, 'phish', 'Правильно! Справжня підтримка не просить коди. Профіль заблоковано, скаргу надіслано.'); },
  brandHaggle(sim) { const x = chatOf(sim.s, sim.s.tg.flags.brandChat); if (x?.ctx) { x.ctx.pay = x.ctx.pay2; } },
  brandDeal(sim) {
    const s = sim.s, c = ch(s), x = chatOf(s, s.tg.flags.brandChat); if (!c || !x) return;
    c.adTask = { bid: x.ctx.bid, brand: x.ctx.brand, item: x.ctx.item, pay: x.ctx.pay, due: s.t + 2 * DAY, chat: x.id };
    tgPush(sim, 'mych', 'sys', `Нове рекламне замовлення: ${x.ctx.brand}, ${x.ctx.pay} грн. Напишіть допис протягом 2 днів і позначте його як рекламу.`);
  },
  badDeal(sim) {
    const s = sim.s, c = ch(s), x = chatOf(s, s.tg.flags.brandChat); if (!c || !x) return;
    c.adTask = { bid: x.ctx.bid, brand: x.ctx.brand, item: x.ctx.item, pay: x.ctx.pay, due: s.t + 2 * DAY, chat: x.id, bad: true, text: 'Пий чай «Стрункість» — і схуднеш за ніч без спорту! Гарантовано на 100%!' };
    tgPush(sim, 'mych', 'sys', `Рекламне замовлення: ${x.ctx.brand}, ${x.ctx.pay} грн.`);
  },
  badNo(sim) { sim.s.trust = Math.min(100, sim.s.trust + 2); sim.s.tg.flags.badNo = true; },
  promoYes(sim) {
    const c = ch(sim.s), x = sim.s.tg.flags.promoFrom; if (!c || !x) return;
    tgPost(sim, { text: `Друзі, рекомендую канал «${x.name}» — там теж про ${x.topic}. Підписуйтеся: ${TG_HOST}${x.link}`, ad: 'promo' });
    const n = Math.round(x.subs * (0.06 + sim.r.next() * 0.05));
    for (let i = 0; i < n; i++) later(sim, 10 + sim.r.int(600), 'join', 'promo');
  },
};

// відкладені дії месенджера
export const TG_LATER = {
  join(sim, src) { const c = ch(sim.s); if (!c) return; c.subs++; c.src[src] = (c.src[src] || 0) + 1; dayRec(sim).joined++; seen(sim, c); },
  member(sim, id) { if (addMember(sim, id, 'invite')) sim.emit('tg'); },
  casinoWarn(sim) { tgPush(sim, 'leleka', 'svc', 'Ваш канал опублікував рекламу азартних ігор. Така реклама заборонена, особливо для дітей. Допис приховано, охоплення каналу знижено на 3 дні.'); const c = ch(sim.s); if (c) { c.penalty = sim.s.t + 3 * DAY; c.posts.filter(p => p.ad === 'casino').forEach(p => { p.hidden = true; }); } },
  markoPost(sim) {
    if (!ch(sim.s) || !sim.s.tg.flags.adminFull) return;
    tgPost(sim, { text: 'ХАХА дивіться, як Петро заснув на уроці історії', gid: sim.s.gallery.find(g => g.type === 'photo')?.id || null, by: 'marko' });
    say(sim, 'class', [['Петро', 'Хто виклав моє фото в канал?! Видаліть негайно'], ['Віка', 'Це некрасиво…']], null, 25);
    later(sim, 40, 'markoAfter');
  },
  markoAfter(sim) { sim.s.trust = Math.max(0, sim.s.trust - 4); tgPush(sim, 'mych', 'sys', 'Адміністратор Марко опублікував фото однокласника без дозволу. Ви відповідаєте за все, що виходить у каналі. Права адміністратора дають лише тим, кому довіряєте, і лише потрібні. Заберіть права в Інформації про канал → Адміністратори.'); },
  brandPay(sim, pid) {
    const s = sim.s, c = ch(s); if (!c) return; const p = c.posts.find(x => x.id === pid), task = p?.task;
    if (!p) { const t = c.lastTask; if (t) tgPush(sim, t.chat, t.chat, 'Допис видалили раніше, ніж за добу. На жаль, за умовами оплату провести не можемо.'); return; }
    s.money += task.pay; c.earned = (c.earned || 0) + task.pay; c.adsDone = (c.adsDone || 0) + 1;
    tgPush(sim, task.chat, task.chat, `Оплату ${task.pay} грн переказано батькам на картку. Дякуємо за співпрацю!`);
    tgPush(sim, 'mych', 'sys', `Отримано ${task.pay} грн за рекламу від «${task.brand.replace(/^.*«|»$/g, '')}»`);
    if (p.adMark && !task.bad) s.tg.flags.brandGood = s.t;
  },
  adUnmarked(sim, pid) {
    const s = sim.s, p = ch(s)?.posts.find(x => x.id === pid); if (!p || p.adMark) return;
    s.trust = Math.max(0, s.trust - 3);
    tgPush(sim, 'leleka', 'svc', 'У вашому каналі є рекламний допис без позначки «Реклама». Читачі мають право знати, що вам заплатили. Позначте рекламу — інакше охоплення каналу можуть знизити.');
    if (p.task) tgPush(sim, p.task.chat, p.task.chat, 'Ми ж домовлялися про позначку «Реклама»… Додайте її, будь ласка.');
  },
  badAfter(sim) { const s = sim.s; s.trust = Math.max(0, s.trust - 5); tgPush(sim, 'leleka', 'svc', 'На рекламу «чаю для схуднення» в вашому каналі поскаржилися читачі: товар обіцяє неможливе. Допис приховано. Не рекламуйте те, у що самі не вірите.'); const c = ch(s); if (c) { c.posts.filter(p => p.task?.bad).forEach(p => { p.hidden = true; }); c.penalty = s.t + 2 * DAY; } },
  markoIdea(sim) { say(sim, 'marko', ['Придумав: зроби опитування, яку тему розібрати наступною. Без фоток людей, обіцяю :)'], null, 1); },
};
// сповіщення про допис у групі / новий запис
function maybeComment(sim, p) {
  const c = ch(sim.s), r = sim.r, n = sim.person('fan', [c.topic]), topic = nicheOf(c.topic).t.toLowerCase();
  const night = p.plan.night && !p.fired.night;
  if (night) p.fired.night = true;
  const text = night ? 'Сповіщення о такій пізній годині мене розбудило… Можна вночі без звуку?' : p.ad === 'bad' ? 'Чай, що спалює жир за ніч? Це ж обман' : p.ad === 'brand' && !p.adMark ? 'Це реклама? Чому не позначено?' : p.plan?.tooMany ? 'Щось забагато реклами останнім часом…' : p.ad === 'brand' ? r.pick(['Чесно, що позначив(-ла) рекламу', 'О, корисна штука', 'Нормальна реклама, не дратує']) : p.ad === 'casino' ? 'Реклама ставок у дитячому каналі? Відписуюсь' : p.spam ? 'Це що, спам? Канал зламали?' : p.by === 'marko' ? 'Так не можна, це ж чуже фото без дозволу' : p.poll ? r.pick(['Проголосував(-ла)!', 'Цікаве опитування', 'Важкий вибір :)']) : r.pick(['Цікаво!', 'Дякую, корисно', `Більше про ${topic}, будь ласка`, 'Чекаю наступний допис', 'А звідки ти це знаєш?', 'Класно написано']);
  p.comments.push({ id: sim.id('tc'), name: n.name, color: n.color, text: voice(text, /а$|я$/.test(n.name)), t: sim.s.t });
}

/* ═════════ крок часу ═════════ */
export function tgStep(sim, d) {
  const s = sim.s, tg = s.tg; if (!tg) return false;
  let changed = false;
  for (const c of tg.chats) if (c.pending?.length && c.pending[0].at <= s.t && !(c.id === sim.tgWatch && tgOnline(s, c))) { while (c.pending.length && c.pending[0].at <= s.t) tgDeliver(sim, c); changed = true; }
  const q = tg.later; if (q?.length && q.some(x => x.at <= s.t)) { tg.later = q.filter(x => x.at > s.t); for (const x of q.filter(x => x.at <= s.t)) TG_LATER[x.m]?.(sim, ...x.a); changed = true; }
  const c = tg.ch; if (!c) { if (Math.floor(s.t / 60) !== Math.floor((s.t - d) / 60)) changed = classChat(sim) || changed; return changed; }
  for (const p of c.posts) {
    if (p.sched && !p.t && p.sched <= s.t) { tgPublish(sim, p); tgPush(sim, 'mych', 'sys', `Відкладений допис опубліковано о ${clock(s.t)}`); changed = true; }
    if (p.t && s.t - p.t < 3 * DAY && p.plan) changed = grow(sim, c, p) || changed;
  }
  if (Math.floor(s.t / 60) !== Math.floor((s.t - d) / 60)) changed = hourly(sim, c) || changed;
  return changed;
}
function grow(sim, c, p) {
  const P = p.plan, st = p.stats, f = 1 - Math.exp(-(sim.s.t - p.t) / P.tau), rec = dayRec(sim);
  const want = k => Math.round(P[k] * f);
  const dv = want('views') - st.views; if (dv <= 0 && want('joined') <= st.joined && want('left') <= st.left) return false;
  if (dv > 0) { st.views += dv; rec.views += dv; }
  st.fwd = Math.max(st.fwd, want('fwd'));
  const rt = want('react'), have = Object.values(p.react).reduce((a, x) => a + x, 0);
  for (let i = have; i < rt; i++) { const k = sim.r.next() < 0.45 ? 'heart' : sim.r.next() < 0.5 ? 'fire' : sim.r.next() < 0.6 ? 'thumbUp' : 'smile'; p.react[k] = (p.react[k] || 0) + 1; }
  if (p.poll) { const v = want('votes'), cur = p.poll.opts.reduce((a, o) => a + o[1], 0) - (p.poll.my !== null ? 1 : 0); for (let i = cur; i < v; i++) { const w = p.poll.opts.map((_, j) => 1 + ((j * 7 + p.id.length) % 3)); let k = sim.r.next() * w.reduce((a, x) => a + x, 0), j = 0; while ((k -= w[j]) > 0 && j < w.length - 1) j++; p.poll.opts[j][1]++; } }
  if (P.lk) { const k = want('lk') - (st.lk || 0); if (k > 0) { st.lk = (st.lk || 0) + k; sim.s.followers += k; if (!sim.s.tg.flags.toLk) { sim.s.tg.flags.toLk = true; sim.notify('users', `Читачі каналу «${c.title}» підписуються на вас в Instagram`); } } }
  const j = want('joined') - st.joined; if (j > 0) { st.joined += j; c.subs += j; c.src[c.pub && sim.r.chance(0.3) ? 'search' : 'fwd'] += j; rec.joined += j; }
  const l = want('left') - st.left; if (l > 0) { const n = Math.min(l, realSubs(c)); st.left += n; c.subs -= n; rec.left += n; }
  if (want('comments') > p.comments.length + (p.fired.cm || 0) || (P.night && !p.fired.night && st.views > 2) || ((p.ad === 'casino' || p.ad === 'bad' || (p.ad === 'brand' && (!p.adMark || p.plan.tooMany)) || p.spam || p.by === 'marko') && !p.comments.length && st.views > 3)) maybeComment(sim, p);
  for (const m of [10, 50, 100, 500, 1000]) if (realSubs(c) >= m && !c.fired['s' + m]) { c.fired['s' + m] = true; tgPush(sim, 'mych', 'sys', `Ура! У каналі ${m} справжніх підписників`); }
  return true;
}
// раз на годину: події, групи, природний приплив
function hourly(sim, c) {
  const s = sim.s, f = s.tg.flags, r = sim.r, posts = c.posts.filter(p => p.t), age = s.t - c.created, h = hourOf(s.t);
  let changed = classChat(sim);
  if (f.leaveAfter && age > 120) { const id = f.leaveAfter; f.leaveAfter = null; if (c.members.includes(id)) { c.members = c.members.filter(x => x !== id); c.subs--; dayRec(sim).left++; tgPush(sim, 'mych', 'sys', `${chatOf(s, id)?.title || 'Хтось'} вийшов(-ла) з каналу`); } }
  // природний приплив: публічні канали знаходять у пошуку
  const fresh = posts.filter(p => s.t - p.t < 3 * DAY && !p.hidden && !p.spam).length;
  if (c.pub && fresh && r.chance(Math.min(0.4, 0.03 + 0.025 * fresh + realSubs(c) / 600) * (c.penalty > s.t ? 0.3 : 1))) { TG_LATER.join(sim, 'search'); changed = true; }
  if (posts.length && s.t - posts.at(-1).t > 4 * DAY && realSubs(c) > 10 && r.chance(0.08)) { c.subs--; dayRec(sim).left++; }
  // накрутку виявили
  if (f.botsAt && s.t - f.botsAt > DAY && c.bots) {
    const n = c.bots; c.subs -= n; c.bots = 0; c.penalty = s.t + 4 * DAY; f.botsAt = 0; f.botsCaught = true; s.trust = Math.max(0, s.trust - 8);
    tgPush(sim, 'leleka', 'svc', `Ми видалили з вашого каналу ${n} неактивних акаунтів (ботів). Накрутка порушує правила: охоплення каналу знижено на 4 дні. Справжні читачі не з’являються від купленої цифри.`); changed = true;
  }
  changed = cross(sim, c) || changed;
  if (c.adTask && s.t > c.adTask.due) { const t = c.adTask; c.adTask = null; s.trust = Math.max(0, s.trust - 1); tgPush(sim, t.chat, t.chat, 'Строк минув, а допису немає. На жаль, домовленість скасовано.'); changed = true; }
  if (h < 9 || h > 21) return changed;
  if (f.lastEv && s.t - f.lastEv < 14 * 60) return changed;
  const ev = (name, cond, fn) => { if (!f[name] && cond) { f[name] = f.lastEv = s.t; fn(); changed = true; return true; } return false; };
  const days = age / DAY;
  ev('ev_admin', posts.length >= 2 && days > 0.3 && r.chance(0.3), () => { const x = chatOf(s, 'marko'); x.script = 'admin'; x.done = false; runNode(sim, x, 'start'); }) ||
  ev('ev_boost', posts.length >= 2 && days > 0.6 && r.chance(0.3), () => { const x = openChat(sim, 'boost', { title: 'Накрутка PRO', color: '#37474f', sym: 'fire' }); x.script = 'boost'; runNode(sim, x, 'start'); }) ||
  ev('ev_casino', posts.length >= 3 && days > 1 && r.chance(0.3), () => { const x = openChat(sim, 'casino', { title: 'Олег | Швидкі гроші', color: '#b23c17', sym: 'money' }); x.script = 'casino'; runNode(sim, x, 'start'); }) ||
  ev('ev_phish', posts.length >= 3 && days > 1.5 && r.chance(0.3), () => {
    const x = openChat(sim, 'phish', { title: 'Telegrаm Support', color: '#1565c0', sym: 'shield' }); x.script = 'phish'; runNode(sim, x, 'start');
    tgPush(sim, 'leleka', 'svc', 'Код для входу в Telegram: 73 914. Нікому не повідомляйте цей код, навіть якщо хтось пише від імені Telegram.');
  }) ||
  ev('ev_brand', posts.length >= 3 && realSubs(c) >= 10 && days > 1.2 && r.chance(0.35), () => brandOffer(sim, c, false)) ||
  ev('ev_brand2', f.brandGood && s.t - f.brandGood > 2 * DAY && r.chance(0.3), () => brandOffer(sim, c, false, 1.3)) ||
  ev('ev_badbrand', f.ev_brand && days > 3 && posts.length >= 5 && r.chance(0.25), () => brandOffer(sim, c, true)) ||
  ev('ev_promo', posts.length >= 4 && realSubs(c) >= 12 && days > 2 && r.chance(0.3), () => {
    const cr = CREATORS.find(x => x.niche === c.topic) || CREATORS[0], subs = 260 + r.int(240);
    f.promoFrom = { name: cr.name.replace(/ й компанія/, '') + ': щоденник', subs, topic: nicheOf(c.topic).t.toLowerCase(), link: cr.nick.replace(/\./g, '_') + '_tg' };
    const x = openChat(sim, 'promo', { title: f.promoFrom.name, color: cr.color, sym: nicheOf(c.topic).icon }); x.script = 'promo'; x.ctx = { name: f.promoFrom.name, subs, topic: f.promoFrom.topic }; runNode(sim, x, 'start');
  });
  return changed;
}
// пропозиція реклами: ціна залежить від справжніх переглядів, а не від цифри підписників
export function adPrice(c) {
  const last = c.posts.filter(p => p.t && !p.hidden).slice(-6), avg = last.length ? last.reduce((a, p) => a + p.stats.views, 0) / last.length : 0;
  return Math.max(60, Math.min(5000, Math.round((avg * 4 + realSubs(c) * 0.5) / 10) * 10));
}
export function brandOffer(sim, c, bad, mult = 1) {
  const s = sim.s, b = bad ? BRANDS.find(x => x.id === 'chai') : BRANDS.find(x => !x.bad && x.niche?.includes(c.topic)) || BRANDS[0];
  const pay = bad ? 1500 : Math.round(adPrice(c) * mult / 10) * 10, id = 'br_' + b.id + (mult > 1 ? '2' : '');
  const x = openChat(sim, id, { title: b.name, color: bad ? '#6d4c41' : '#1565c0', sym: bad ? 'spark' : 'star' });
  x.script = bad ? 'badbrand' : 'brand'; x.done = false; x.ctx = { brand: b.name, item: b.item, pay, pay2: Math.round(pay * 1.15 / 10) * 10, topic: nicheOf(c.topic).t.toLowerCase(), bid: b.id };
  s.tg.flags.brandChat = id; runNode(sim, x, 'start');
}
// посилання на канал в інших соцмережах приводять читачів
export function chLinkIn(c, text) {
  if (!c || !text) return false;
  const t = String(text).toLowerCase(), at = (link) => { const k = t.indexOf((TG_HOST + link).toLowerCase()); return k >= 0 && !/[a-z0-9_]/.test(t[k + TG_HOST.length + link.length] || ''); };
  return (c.pub && !!c.link && at(c.link)) || at(c.invite);
}
function cross(sim, c) {
  const s = sim.s, f = s.tg.flags; let changed = false;
  const lkViews = s.posts.reduce((a, p) => a + (p.t ? p.stats.views : 0), 0), tbViews = (s.tube?.videos || []).reduce((a, v) => a + (v.t ? v.stats.views : 0), 0);
  const step = (key, total, linked, rate, src, label) => {
    const prev = f[key] ?? total; f[key] = total; if (!linked) return;
    let want = (total - prev) * rate * (c.penalty > s.t ? 0.5 : 1); const n = Math.floor(want) + (sim.r.next() < want % 1 ? 1 : 0);
    for (let i = 0; i < n; i++) TG_LATER.join(sim, src);
    if (n > 0) { changed = true; if (!f['first_' + src]) { f['first_' + src] = true; tgPush(sim, 'mych', 'sys', `Перші читачі прийшли ${label} — за посиланням на канал`); } }
  };
  step('lkSeen', lkViews, s.me && chLinkIn(c, `${s.me.link || ''} ${s.me.bio || ''}`), 0.012 * (s.me?.niche === c.topic ? 1 : 0.6), 'likeer', 'з Instagram');
  step('tbSeen', tbViews, s.tube && chLinkIn(c, s.tube.desc), 0.01, 'tube', 'з YouTube');
  // посилання на приватний канал у відкритому профілі
  if (!c.pub && !f.privLeak && s.me && String(`${s.me.link} ${s.me.bio}`).includes(TG_HOST + c.invite) && !s.settings.priv) { f.privLeak = true; tgPush(sim, 'mych', 'sys', 'Посилання-запрошення приватного каналу тепер у відкритому профілі Instagram — підписатися може будь-хто. Якщо канал для своїх, приберіть посилання або зробіть канал публічним.'); changed = true; }
  return changed;
}
// клас живе своїм життям
function classChat(sim) {
  const s = sim.s, r = sim.r, h = hourOf(s.t); if (h < 15 || h > 21 || !r.chance(0.07)) return false;
  const lines = [['Настя', 'Хтось зробив англійську?'], ['Денис', 'Завтра перший урок у спортзалі'], ['Злата', 'Скиньте розклад на завтра, будь ласка'], ['Тарас', 'Хто йде на гурток з робототехніки?'], ['Віка', 'Не забудьте форму на фізкультуру']];
  const [who, text] = r.pick(lines); tgPush(sim, 'class', who, text); return true;
}

/* ═════════ статистика ═════════ */
export function tgStats(sim) {
  const c = ch(sim.s); if (!c) return null;
  const posts = c.posts.filter(p => p.t && !p.hidden), last = posts.slice(-10), real = realSubs(c);
  const avg = last.length ? Math.round(last.reduce((a, p) => a + p.stats.views, 0) / last.length) : 0;
  const reacts = last.reduce((a, p) => a + Object.values(p.react).reduce((x, y) => x + y, 0) + p.stats.fwd, 0);
  const err = c.subs ? avg / c.subs * 100 : 0, er = last.length && avg ? reacts / last.length / avg * 100 : 0;
  const byHour = Array(24).fill(0); for (let h = 0; h < 24; h++) byHour[h] = ACTIVITY[h];
  const best = byHour.indexOf(Math.max(...byHour));
  const days = c.daily.slice(-14);
  const adsN = posts.filter(p => p.ad === 'brand' || p.ad === 'bad').length;
  return { earned: c.earned || 0, adsN, price: adPrice(c), subs: c.subs, real, bots: c.bots, avg, err, er, fwd: last.reduce((a, p) => a + p.stats.fwd, 0), posts: posts.length, best, days, src: c.src,
    top: [...posts].sort((a, b) => b.stats.views - a.stats.views).slice(0, 3) };
}
export const lcTitle = t => lc(t);
export const pickColor = r => r.pick(AV_COLORS);
