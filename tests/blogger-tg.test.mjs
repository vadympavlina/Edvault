// Симулятор блогера: месенджер «Лелека» і власний канал — без браузера
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim, newState, hourOf, DAY } from '../emulators/bloggeremu/js/sim.js';
import { linkErr, tgSend, tgCreateChannel, tgPost, tgInvite, tgOpt, tgStats, tgEndSession, postCheck, realSubs, tgDeliver } from '../emulators/bloggeremu/js/tgsim.js';

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
    const x = { id: 'phish', kind: 'user', title: 'Lelekа Support', msgs: [], unread: 0, script: 'phish', opts: [['send', 'Надіслати код']] }; s.s.tg.chats.push(x);
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
