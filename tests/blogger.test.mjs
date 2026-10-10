// Симулятор блогера: рушій (охоплення, реакції, безпека, шахраї) — без браузера
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim, newState, okState, hourOf, toneOf, DAY } from '../emulators/bloggeremu/js/sim.js';
import { nickErr, passScore } from '../emulators/bloggeremu/js/likeer.js';

const fresh = (seed = 11) => { const s = new Sim(newState(seed)); s.register({ nick: 'kotyk.art', niche: 'pets', bio: 'Про котів', pass: 'Murchyk-2026!' }); return s; };
const gid = (sim, scene) => sim.s.gallery.find(g => g.scene === scene).id;
const at = (sim, h) => { while (hourOf(sim.s.t) !== h) sim.advance(5); };
const good = sim => sim.publish({ kind: 'photo', photo: { gid: gid(sim, 'cat'), filter: 'bright', text: 'Мурчик' }, caption: 'Мурчик спить на підвіконні. А ваші улюбленці люблять поспати? #котики #мійкіт' });

test('реєстрація: ім’я користувача й надійність пароля', () => {
  assert.equal(nickErr('kotyk.art'), '');
  assert.match(nickErr('Kotyk Art'), /латинські/);
  assert.match(nickErr('.kot'), /крапкою/);
  assert.match(nickErr('murko.cat'), /зайняте/);
  assert.equal(passScore('12345678'), 0);
  assert.equal(passScore('kotyk.art2026', 'kotyk.art'), 0, 'пароль з іменем користувача — слабкий');
  assert.ok(passScore('Murchyk-2026!') >= 3);
  const s = fresh();
  assert.equal(s.s.mail[0].kind, 'welcome');
  assert.ok(s.s.gallery.length > 20);
});

test('охоплення росте поступово, а якісний допис збирає більше за поганий', () => {
  const a = fresh(3); at(a, 19);
  const p = good(a);
  a.advance(30); const early = p.stats.views;
  a.advance(600); const late = p.stats.views;
  assert.ok(late > early && early > 0, 'перегляди набираються з часом');
  assert.ok(p.stats.likes > 0 && p.stats.comments > 0 && a.s.followers > 0);
  assert.ok(p.why.some(w => w[0] === '+' && /час/.test(w[1])), 'вечірня публікація — вдалий час');
  const b = fresh(3); at(b, 3);
  const q = b.publish({ kind: 'photo', photo: { gid: b.s.gallery.find(g => g.dark && g.type === 'photo').id, filter: 'heavy' }, caption: '#лайк #рекомендації #взаємнапідписка' });
  b.advance(630);
  assert.ok(q.plan.views < p.plan.views, 'темне фото вночі зі спам-хештегами — менше переглядів');
  assert.ok(q.why.some(w => /Невдалий час/.test(w[1])) && q.why.some(w => /спам/.test(w[1])) && q.why.some(w => /Немає опису/.test(w[1])));
});

test('фото з адресою: коментар про приватність і повідомлення від незнайомця', () => {
  const s = fresh(5); at(s, 18);
  for (let i = 0; i < 5; i++) s.s.fans.push(s.person('fan').id);
  s.s.followers = 40;
  s.publish({ kind: 'photo', photo: { gid: gid(s, 'house'), filter: 'none' }, caption: 'Біля мого будинку #мійдень' });
  s.advance(600);
  const p = s.s.posts[0];
  assert.ok(p.comments.some(c => c.kind === 'privacy' && /Шкільн/.test(c.text)), 'хтось упізнав адресу');
  const d = s.s.dms.find(x => x.kind === 'stranger');
  assert.ok(d, 'незнайомець пише в Директ');
  s.dmReply(d.id, 'Мені 12, а тобі?', 'unsafe');
  s.advance(30);
  assert.match(d.msgs.at(-1).text, /школі/);
  // лише підписники можуть писати — незнайомець не пройде
  const t = fresh(5); t.s.settings.dms = 'followers'; t.strangerDM();
  assert.equal(t.s.dms.filter(x => x.kind === 'stranger').length, 0);
});

test('фішинг: без двофакторного входу профіль зламують, відновлення через пошту', () => {
  const s = fresh(7);
  s.phish(); const d = s.s.dms[0];
  s.dmReply(d.id, 'Відкрити посилання', 'open');
  assert.equal(s.s.flags.phishPage, true);
  s.phishLogin('Murchyk-2026!');
  s.advance(30);
  assert.ok(s.s.hack, 'профіль зламано');
  assert.ok(s.s.posts.some(p => p.spam), 'зловмисник опублікував спам');
  assert.ok(s.s.settings.sessions.some(x => x.bad));
  const code = s.sendCode();
  assert.match(s.recover('000000', 'Novyi-Parol-77'), /Неправильний код/);
  assert.match(s.recover(code, '123'), /8 символів/);
  assert.equal(s.recover(code, 'Novyi-Parol-77'), null);
  assert.equal(s.s.hack, null);
  // з двофакторним входом — лише лист про заблоковану спробу
  const t = fresh(7); t.s.settings.twoFA = true;
  t.phishLogin('Murchyk-2026!'); t.advance(30);
  assert.equal(t.s.hack, null);
  assert.ok(t.s.mail.some(m => /заблокована/.test(m.subject)));
});

test('чужа музика у відео — скарга правовласника, вільна — без скарги', () => {
  const s = fresh(9); at(s, 18);
  s.publish({ kind: 'video', video: { clip: 'laser', start: 5, end: 20, title: 'Кіт і лазер', music: 'hit' }, caption: 'Мурчик полює #котики' });
  s.advance(200);
  assert.ok(s.s.posts[0].claimed && s.s.strikes === 1);
  assert.ok(s.s.mail.some(m => m.kind === 'copyright'));
  const t = fresh(9); at(t, 18);
  const v = t.publish({ kind: 'video', video: { clip: 'laser', start: 5, end: 20, music: 'guitar' }, caption: 'Мурчик полює #котики' });
  t.advance(200);
  assert.ok(!v.claimed && v.why.some(w => /Музика пасує/.test(w[1])));
  assert.ok(v.why.some(w => /Цікавий початок/.test(w[1])));
  const u = fresh(9); at(u, 18);
  const w = u.publish({ kind: 'video', video: { clip: 'laser', start: 0, end: 24, music: 'guitar' }, caption: 'Мурчик полює #котики' });
  assert.ok(w.why.some(x => /Довгий початок/.test(x[1])), 'необрізаний початок');
});

test('куплені підписники — це боти: зникають, а довіра падає', () => {
  const s = fresh(13); s.s.followers = 50;
  s.dmText(s.person('scam').id, 'Підписники за 50 грн', [['buy', 'Так']], 'buy');
  s.dmReply(s.s.dms[0].id, 'Так, хочу', 'buy');
  s.advance(40);
  assert.equal(s.s.bots, 1000);
  const trust = s.s.trust;
  s.advance(3 * DAY);
  assert.equal(s.s.bots, 0);
  assert.ok(s.s.followers < 1000 && s.s.trust < trust);
});

test('модерація: груба відповідь знижує довіру, блокування прибирає коментарі', () => {
  assert.equal(toneOf('Відчепись'), 'rude');
  assert.equal(toneOf('Дякую, дуже приємно'), 'kind');
  const s = fresh(17); at(s, 19); s.s.followers = 80;
  const p = good(s); s.advance(400);
  const c = p.comments.find(x => !x.reply);
  const t0 = s.s.trust;
  s.reply(p.id, c.id, 'Сам такий, відчепись');
  assert.ok(s.s.trust < t0);
  const u = c.pid;
  s.block(u);
  assert.ok(!p.comments.some(x => x.pid === u));
  s.s.heat = 10;
  s.advance(300);
  s.setSetting('filter', true);
  s.advance(600);
  assert.ok(p.comments.filter(x => x.kind === 'troll').every(x => x.hidden), 'фільтр ховає образливі коментарі');
});

test('реклама: сумнівний товар обмежує допис, непозначена реклама — лист і відписки', () => {
  const s = fresh(19); at(s, 18); s.s.followers = 300;
  s.s.pendingAd = { id: 'fortuna', pay: 2000, pid: 'x' };
  const p = s.publish({ kind: 'photo', photo: { gid: gid(s, 'football'), filter: 'none' }, caption: 'Ставки на футбол #спорт', ad: 'fortuna', adMarked: false });
  s.advance(500);
  assert.ok(p.adBad && s.s.money === 2000);
  assert.ok(s.s.mail.some(m => m.kind === 'adbad'));
  assert.ok(p.stats.unfollows > 0);
});

test('запланований допис виходить у визначений час', () => {
  const s = fresh(23);
  const when = s.s.t + 120;
  const p = s.publish({ kind: 'text', text: 'Завтра покажу, як Мурчик грається з м’ячем. Чекайте!', caption: '#котики', sched: when });
  assert.equal(p.t, 0);
  s.advance(60); assert.equal(p.t, 0);
  s.advance(70); assert.ok(p.t >= when);
});

test('стан зберігається й відновлюється (JSON), пошкоджений — відкидається', () => {
  const s = fresh(29); at(s, 19); good(s); s.advance(300);
  s.later(30, 'notify', 'info', 'Перевірка черги');
  const json = JSON.parse(JSON.stringify(s.s));
  assert.ok(okState(json));
  const r = new Sim(json);
  r.advance(40);
  assert.ok(r.s.notifs.some(n => n.text === 'Перевірка черги'), 'відкладені події переживають збереження');
  assert.equal(okState({ v: 1, t: 'x' }), false);
  assert.ok(JSON.stringify(r.s).length < 400000);
});

test('довгий прогін: тиждень щоденних дописів без помилок і розростання', () => {
  const s = fresh(31);
  for (let d = 0; d < 7; d++) { at(s, 18); good(s); s.advance(20 * 60); }
  assert.ok(s.s.followers > 20);
  assert.ok(s.s.notifs.length <= 120 && s.s.mail.length <= 60);
  assert.ok(s.s.days.length >= 6);
  assert.ok(Object.keys(s.s.people).length < 900);
});
