// Симулятор блогера: месенджер Telegram і власний канал — без браузера
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim, newState, hourOf, DAY } from '../emulators/bloggeremu/js/sim.js';
import { linkErr, tgSend, tgCreateChannel, tgPost, tgInvite, tgOpt, tgStats, tgEndSession, postCheck, realSubs, tgDeliver, brandOffer, adPrice, adCheck, tgAdPost, tgDeletePost, chLinkIn } from '../emulators/bloggeremu/js/tgsim.js';

const fresh = (seed = 21) => new Sim(newState(seed));
const at = (sim, h) => { while (hourOf(sim.s.t) !== h) sim.advance(5); };
const chat = (sim, id) => sim.s.tg.chats.find(c => c.id === id);
const flush = (sim, c) => { while (c.pending?.length) tgDeliver(sim, c); };
const GOOD = 'Мурчик сьогодні знайшов коробку і просидів у ній три години. Коти люблять коробки, бо там тепло й безпечно.';

test('акаунт уже є: чати, контакти, службовий чат із кодом', () => {
  const s = fresh();
  for (const id of ['saved', 'mom', 'class', 'olia', 'leleka', 'chan_c1']) assert.ok(chat(s, id), id);
  assert.equal(s.s.tg.ch, null, 'каналу ще немає');
  assert.match(chat(s, 'leleka').msgs[0].text, /Нікому не повідомляйте/);
});

test('особисті чати відповідають по-живому й з паузою; уночі мама спить', () => {
  const s = fresh(); at(s, 17);
  tgSend(s, 'mom', 'Привіт!'); assert.equal(chat(s, 'mom').msgs.at(-1).from, 'me');
  s.advance(10); assert.match(chat(s, 'mom').msgs.at(-1).text, /сонечко/);
  at(s, 1); tgSend(s, 'mom', 'Ти тут?'); s.advance(30);
  assert.equal(chat(s, 'mom').msgs.at(-1).from, 'me', 'уночі відповіді немає');
  at(s, 8); assert.notEqual(chat(s, 'mom').msgs.at(-1).from, 'me', 'вранці відповіла');
  tgSend(s, 'olia', 'Я живу на вулиці Шкільній, 12'); assert.ok(chat(s, 'olia').msgs.some(m => m.from === 'sys'), 'підказка про особисті дані');
});

test('посилання публічного каналу перевіряється', () => {
  assert.match(linkErr(''), /Придумайте/); assert.match(linkErr('кіт'), /латинські/); assert.match(linkErr('abc'), /5/);
  assert.match(linkErr('cats'), /5/); assert.match(linkErr('memes'), /зайняте/); assert.match(linkErr('1murchyk'), /цифри/);
  assert.equal(linkErr('murchyk_cat'), ''); assert.equal(linkErr('memes', 'memes'), '', 'своє посилання можна залишити');
});

test('створення каналу: додані без запиту ображаються, мама радіє', () => {
  const s = fresh(); at(s, 16);
  const c = tgCreateChannel(s, { title: 'Мурчик', pub: true, link: 'murchyk_cat', topic: 'pets', add: ['mom', 'marko'] });
  assert.equal(c.subs, 2); assert.ok(chat(s, 'mych'));
  s.advance(180);
  assert.match(chat(s, 'marko').msgs.map(m => m.text).join(' '), /без запитання/);
  assert.match(chat(s, 'mom').msgs.map(m => m.text).join(' '), /Пишаюся/);
  assert.equal(c.subs, 1, 'Марко вийшов із каналу');
});

test('допис: охоплення, реакції, ріст; запрошення друзів', () => {
  const s = fresh(3); at(s, 18);
  const c = tgCreateChannel(s, { title: 'Мурчик', pub: true, link: 'murchyk_cat', topic: 'pets' });
  tgInvite(s, ['class', 'mom', 'olia']); s.advance(400);
  assert.ok(c.subs >= 5, `підписалися за посиланням: ${c.subs}`); assert.ok(c.members.includes('mom'));
  assert.ok(chat(s, 'class').msgs.some(m => m.card), 'посилання в групі');
  at(s, 19); const p = tgPost(s, { text: GOOD }); s.advance(DAY);
  assert.ok(p.stats.views > 0 && p.stats.views <= realSubs(c) + 10, `перегляди ${p.stats.views} з ${c.subs}`);
  const st = tgStats(s); assert.ok(st.err > 20 && st.err <= 100, `ERR ${st.err}`);
});

test('нічний допис зі звуком і забагато дописів відштовхують читачів', () => {
  const mk = () => { const s = fresh(4); const c = tgCreateChannel(s, { title: 'К', pub: true, link: 'kanal_k', topic: 'pets' }); c.subs = 200; return [s, c]; };
  const [a, ca] = mk(); at(a, 2); const loud = tgPost(a, { text: GOOD });
  const [b, cb] = mk(); at(b, 2); const quiet = tgPost(b, { text: GOOD, silent: true });
  assert.ok(loud.plan.left > quiet.plan.left && loud.plan.night && !quiet.plan.night);
  const [x] = mk(); at(x, 12); const first = tgPost(x, { text: GOOD }); let last; for (let i = 0; i < 6; i++) last = tgPost(x, { text: GOOD + i });
  assert.ok(last.plan.fatigue && last.plan.views < first.plan.views && last.plan.left > first.plan.left, `${last.plan.views} < ${first.plan.views}`);
  assert.ok(ca.subs >= 0 && cb.subs >= 0);
});

test('перевірка допису: особисті дані, клікбейт, фото й опитування', () => {
  assert.equal(postCheck({ text: 'Я вчуся в 7-А класі школи № 5' })[0][0], 'bad');
  assert.ok(postCheck({ text: 'ШОК!!! ТИ НЕ ПОВІРИШ' }).some(x => x[1] === 'Як клікбейт'));
  assert.ok(postCheck({ text: 'ок' }).some(x => x[1] === 'Замало змісту'));
  const ok = postCheck({ text: GOOD, gid: 'g1', poll: { q: 'Що?', opts: ['а', 'б'] } });
  assert.ok(ok.every(x => x[0] === 'ok') && ok.length === 3);
});

test('накрутка: цифра росте, ERR падає, потім ботів видаляють і знижують охоплення', () => {
  const s = fresh(5); at(s, 12);
  const c = tgCreateChannel(s, { title: 'К', pub: true, link: 'kanal_k', topic: 'pets' }); c.subs = 30;
  for (let i = 0; i < 2; i++) { tgPost(s, { text: GOOD + i }); s.advance(300); }
  const x = { id: 'boost', kind: 'user', title: 'Накрутка PRO', msgs: [], unread: 0, script: 'boost', opts: [['yes', 'Хочу 1000 підписників']] }; s.s.tg.chats.push(x);
  tgOpt(s, 'boost', 'yes'); flush(s, x);
  assert.equal(c.bots, 1000); const before = tgStats(s); assert.ok(before.err < 5, `ERR ${before.err}`);
  s.advance(DAY + 120);
  assert.equal(c.bots, 0); assert.ok(c.penalty > s.s.t && s.s.tg.flags.botsCaught);
  assert.match(chat(s, 'leleka').msgs.at(-1).text, /ботів/);
});

test('«підтримка» просить код: без хмарного пароля — злам, із ним — вхід заблоковано', () => {
  const run = pass2 => {
    const s = fresh(6); const c = tgCreateChannel(s, { title: 'К', pub: true, link: 'kanal_k', topic: 'pets' }); s.s.tg.set.pass2 = pass2;
    const x = { id: 'phish', kind: 'user', title: 'Telegrаm Support', msgs: [], unread: 0, script: 'phish', opts: [['send', 'Надіслати код']] }; s.s.tg.chats.push(x);
    tgOpt(s, 'phish', 'send'); return [s, c];
  };
  const [a, ca] = run(false);
  assert.ok(a.s.tg.flags.hacked && ca.posts.some(p => p.spam) && a.s.tg.set.sessions.some(x => x.evil));
  tgEndSession(a, 'evil'); assert.ok(!a.s.tg.flags.hacked && !a.s.tg.set.sessions.some(x => x.evil));
  const [b, cb] = run(true);
  assert.ok(!b.s.tg.flags.hacked && !cb.posts.length && b.s.tg.flags.phishOk);
  // код, надісланий текстом, теж рахується
  const s = fresh(7); s.s.tg.chats.push({ id: 'phish', kind: 'user', title: 'X', msgs: [], unread: 0, script: 'phish' }); tgSend(s, 'phish', 'ось код 51 847'); assert.ok(s.s.tg.flags.hacked);
});

test('події приходять самі й не всі одразу', () => {
  const s = fresh(8); at(s, 16);
  const c = tgCreateChannel(s, { title: 'Мурчик', pub: true, link: 'murchyk_cat', topic: 'pets' }); tgInvite(s, ['class', 'mom', 'olia']);
  for (let d = 0; d < 6; d++) { at(s, 19); tgPost(s, { text: GOOD + d }); s.advance(60); }
  const f = s.s.tg.flags, evs = ['ev_admin', 'ev_boost', 'ev_casino', 'ev_phish', 'ev_promo'].filter(k => f[k]).map(k => f[k]).sort((a, b) => a - b);
  assert.ok(evs.length >= 3, `подій: ${evs.length}`);
  for (let i = 1; i < evs.length; i++) assert.ok(evs[i] - evs[i - 1] >= 14 * 60, 'між подіями щонайменше 14 годин');
  assert.ok(c.subs > 5);
});

// канал із живими читачами й кількома дописами
const live = (seed = 9, subs = 40) => { const s = fresh(seed); s.register({ nick: 'kotyk.art', niche: 'pets', bio: 'Про котів', pass: 'Murchyk-2026!' }); at(s, 18); const c = tgCreateChannel(s, { title: 'Мурчик', pub: true, link: 'murchyk_cat', topic: 'pets' }); c.subs = subs; for (let i = 0; i < 3; i++) { tgPost(s, { text: GOOD + i }); s.advance(600); } return [s, c]; };
const brandChat = s => s.s.tg.chats.find(x => x.id === s.s.tg.flags.brandChat);

test('реклама від бренду: ціна від переглядів, торг, згода батьків, оплата через добу', () => {
  const [s, c] = live();
  const price = adPrice(c); assert.ok(price >= 60 && price < 1000, `ціна ${price}`);
  const [, big] = live(9, 40); big.bots = 2000; big.subs += 2000; assert.ok(adPrice(big) < price * 1.5, 'боти майже не піднімають ціну');
  brandOffer(s, c, false); const x = brandChat(s); flush(s, x);
  assert.match(x.msgs.map(m => m.text).join(' '), /Корм «Мурчик»/);
  tgOpt(s, x.id, 'money'); flush(s, x); tgOpt(s, x.id, 'yes'); flush(s, x);
  assert.match(x.msgs.at(-1).text, /18/);
  tgOpt(s, x.id, 'parents'); flush(s, x);
  assert.ok(c.adTask && c.adTask.pay > price, `торг: ${c.adTask?.pay} > ${price}`);
  const money = s.s.money, pay = c.adTask.pay;
  const p = tgAdPost(s, { text: 'Мурчик спробував новий корм від «Мурчика» — їсть із задоволенням, а шерсть блищить. Якщо шукаєте корм, зверніть увагу.', mark: true });
  assert.ok(p.adMark && !c.adTask);
  s.advance(DAY + 10);
  assert.equal(s.s.money, money + pay); assert.equal(c.earned, pay);
  assert.match(x.msgs.at(-1).text, /Оплату/);
  assert.equal(tgStats(s).earned, pay);
});

test('реклама без позначки, з перебільшеннями чи видалена раніше строку — погані наслідки', () => {
  assert.equal(adCheck('Гарантовано на 100%!', false, {})[0][0], 'bad');
  assert.ok(adCheck('Гарантовано на 100%!', true, {}).some(x => x[1] === 'Перебільшення'));
  const [s, c] = live(10); brandOffer(s, c, false); const x = brandChat(s); flush(s, x); tgOpt(s, x.id, 'yes'); flush(s, x); tgOpt(s, x.id, 'parents'); flush(s, x);
  const tr = s.s.trust, p = tgAdPost(s, { text: 'Купуйте корм, він класний і корисний для котів, рекомендую всім читачам.', mark: false });
  s.advance(200);
  assert.ok(s.s.trust < tr && chat(s, 'leleka').msgs.at(-1).text.includes('без позначки'));
  tgDeletePost(s, p.id); const money = s.s.money; s.advance(DAY);
  assert.equal(s.s.money, money, 'за видалений допис не платять'); assert.match(x.msgs.at(-1).text, /видалили/);
});

test('«чарівний чай»: відмова підвищує довіру, згода — скарги й приховування', () => {
  const [a, ca] = live(11); brandOffer(a, ca, true); let x = brandChat(a); flush(a, x);
  const t0 = a.s.trust; tgOpt(a, x.id, 'no'); flush(a, x); assert.ok(a.s.trust > t0 && !ca.adTask);
  const [b, cb] = live(12); brandOffer(b, cb, true); x = brandChat(b); flush(b, x); tgOpt(b, x.id, 'yes'); flush(b, x);
  assert.ok(cb.adTask?.bad); const p = tgAdPost(b, { text: cb.adTask.text, mark: true });
  assert.ok(p.plan.left > 0); b.advance(300); assert.ok(p.hidden && cb.penalty > b.s.t);
});

test('строк минув — домовленість скасовано', () => {
  const [s, c] = live(13); brandOffer(s, c, false); const x = brandChat(s); flush(s, x); tgOpt(s, x.id, 'yes'); flush(s, x); tgOpt(s, x.id, 'parents'); flush(s, x);
  assert.ok(c.adTask); s.advance(2 * DAY + 70); assert.equal(c.adTask, null); assert.match(x.msgs.at(-1).text, /Строк минув/);
});

test('зв’язок платформ: посилання в профілі Instagram приводить читачів, згадка @ніку — підписників в Instagram', () => {
  const run = linked => { const [s, c] = live(14, 20); if (linked) s.s.me.link = 't.me/murchyk_cat'; for (let i = 0; i < 4; i++) { at(s, 19); s.publish({ kind: 'photo', photo: { gid: s.s.gallery[0].id }, caption: 'Мурчик спить #котики' }); s.advance(600); } return [s, c]; };
  const [, a] = run(true), [, b] = run(false);
  assert.ok((a.src.likeer || 0) > 0 && !(b.src.likeer), `з Instagram: ${a.src.likeer}`);
  assert.ok(chLinkIn({ pub: true, link: 'murchyk_cat', invite: '+x' }, 'мій канал t.me/murchyk_cat') && !chLinkIn({ pub: true, link: 'murchyk_cat', invite: '+x' }, 't.me/murchyk_cats'));
  const [s] = live(15, 60); const f0 = s.s.followers; at(s, 19); const p = tgPost(s, { text: GOOD + ' Більше фото — у моємв Instagram @kotyk.art' }); s.advance(DAY);
  assert.ok(p.plan.lk > 0 && s.s.followers > f0, `${s.s.followers} > ${f0}`);
  // приватний канал у відкритому профілі
  const t = fresh(16); t.register({ nick: 'kotyk.art', niche: 'pets', bio: 'x', pass: 'Murchyk-2026!' }); const pc = tgCreateChannel(t, { title: 'Свої', pub: false, topic: 'pets' });
  t.s.me.link = 't.me/' + pc.invite; t.advance(60); assert.ok(t.s.tg.flags.privLeak && chat(t, 'mych').msgs.some(m => /будь-хто/.test(m.text)));
});
