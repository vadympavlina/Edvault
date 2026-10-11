// Симулятор блогера: живе спілкування (Директ і коментарі) та реклама на YouTube — без браузера
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim, newState, hourOf, DAY } from '../emulators/bloggeremu/js/sim.js';
import { intents, fill, voice, names, petName, captionComment } from '../emulators/bloggeremu/js/talk.js';
import { createChannel, tubeUpload } from '../emulators/bloggeremu/js/tubesim.js';
import { cpm, forecast, launchAd, reviewVideo } from '../emulators/bloggeremu/js/adsim.js';

const fresh = (seed = 11) => { const s = new Sim(newState(seed)); s.register({ nick: 'kotyk.art', niche: 'pets', bio: 'Про котів', pass: 'Murchyk-2026!' }); return s; };
const at = (sim, h) => { while (hourOf(sim.s.t) !== h) sim.advance(5); };
const flush = (sim, d) => { while (d.pending?.length) sim.deliver(d); };
const last = d => d.msgs.filter(m => !m.me && !m.sys).at(-1)?.text || '';

test('розуміння тексту: наміри українською, межі слів, особисті дані', () => {
  const t = x => [...intents(x)];
  assert.ok(t('так').includes('yes') && t('Так, давай').includes('yes'));
  assert.ok(t('ні, не хочу').includes('no'));
  assert.ok(t('Клас! Дякую').includes('thanks') && t('Клас!').includes('kind'));
  assert.ok(t('я в 7-А класі').includes('personal') && !t('я в 7-А класі').includes('kind'), '«класі» — не похвала');
  for (const x of ['мені 12', 'я в 6-Б', 'живу на вулиці Шкільній', 'мій номер 0671234567']) assert.ok(t(x).includes('personal'), x);
  assert.ok(t('ти дурний').includes('rude') && t('Мій пароль 123').includes('password'));
  assert.ok(t('давай зустрінемось').includes('meet') && t('розповім мамі').includes('adult'));
  assert.equal(fill('Я хоті{в|ла}', { fem: true }), 'Я хотіла');
  assert.equal(voice('Перемотав(-ла), ледве дочекався(-лася). Сам(-а) такий(-а)!', true), 'Перемотала, ледве дочекалася. Сама така!');
  assert.equal(voice('Гірше не бачив(-ла)', false), 'Гірше не бачив');
  assert.deepEqual(names('Його звати Мурчик, мені 12'), ['Мурчик']);
  assert.equal(petName(['Бім знову гуляв #песики']), 'Бім');
});

test('Директ: розмова з підписником у кілька кроків, реакція, «переглянуто», стає постійним глядачем', () => {
  const s = fresh(3); at(s, 17);
  s.publish({ kind: 'photo', photo: { gid: s.s.gallery[0].id }, caption: 'Мурчик спить на підвіконні' }); s.advance(60);
  const u = s.person('fan', ['pets']); s.s.fans.push(u.id);
  const d = s.talk(u.id, 'fan'); flush(s, d);
  assert.match(d.msgs[0].text, /Мурчик спить на підвіконні/, 'згадує ваш допис');
  assert.ok(d.opts?.length >= 2);
  s.dmReply(d.id, 'Дякую! Його звати Мурчик'); flush(s, d);
  assert.match(d.msgs.map(m => m.text).join(' '), /Мурчик — гарне ім’я/);
  assert.ok(d.msgs.find(m => m.me).seen, 'повідомлення переглянуто');
  s.dmReply(d.id, 'Записую ідеї в нотатки', 't1'); flush(s, d);
  s.dmReply(d.id, 'Звісно, пиши!', 'yes'); flush(s, d);
  assert.ok(d.done && u.loyal && u.rel >= 3);
  // після завершення відповідає коротко, по-живому
  s.dmReply(d.id, 'Бувай!'); flush(s, d); assert.match(last(d), /Бувай|гарного/i);
});

test('Директ: грубість ображає, особисті дані — підказка безпеки', () => {
  const s = fresh(4); at(s, 17); s.publish({ kind: 'photo', photo: { gid: s.s.gallery[0].id }, caption: 'x' });
  const u = s.person('fan', ['pets']); s.s.fans.push(u.id); s.s.followers = 10;
  const d = s.talk(u.id, 'fan'); flush(s, d);
  s.dmReply(d.id, 'мені 12, я в 6-Б класі'); assert.ok(d.msgs.some(m => m.sys && /школу, клас/.test(m.text)));
  flush(s, d);
  const f0 = s.s.followers; s.dmReply(d.id, 'Тобі яке діло?', 'rude'); flush(s, d);
  assert.ok(d.done && u.rel < 0); assert.match(last(d), /не буду заважати/);
  assert.ok(s.s.followers <= f0);
});

test('Директ: незнайомець у «Запитах», витік даних і розмова з дорослими', () => {
  const s = fresh(5); at(s, 18);
  const st = s.person('stranger'), d = s.talk(st.id, 'stranger'); flush(s, d);
  assert.ok(d.req, 'повідомлення від незнайомця — у запитах');
  const tr = s.s.trust;
  s.dmReply(d.id, 'мені 11'); flush(s, d);
  assert.ok(d.msgs.some(m => m.sys && /Стоп!/.test(m.text)) && s.s.trust < tr);
  assert.match(last(d), /школі/);
  s.dmReply(d.id, 'Розповім батькам', 'adult');
  assert.ok(s.s.people[st.id].blocked, 'профіль заблоковано разом із дорослими');
  // якщо писати можуть лише підписники — незнайомець не пройде
  const t = fresh(6); t.s.settings.dms = 'followers'; const x = t.person('stranger'); t.talk(x.id, 'stranger');
  assert.equal(t.s.dms.filter(q => q.script === 'stranger').length, 0);
});

test('Директ: однокласник просить пароль, бренд торгується, тролю не відповідають образою', () => {
  const s = fresh(7); at(s, 12);
  const c = s.person('fan'), d = s.talk(c.id, 'classmate'); flush(s, d);
  const tr = s.s.trust; s.dmReply(d.id, 'Ок, мій пароль kotyk2015'); flush(s, d);
  assert.ok(s.s.trust < tr && d.msgs.some(m => m.sys && /пароль/.test(m.text)));
  s.s.followers = 200; s.brandOffer(false); const b = s.s.dms.find(x => x.script === 'brand'); flush(s, b);
  const base = +last(b).match(/(\d+) грн/)[1];
  s.dmReply(b.id, 'А можна більше?', 'money'); flush(s, b);
  s.dmReply(b.id, 'Домовились', 'yes'); flush(s, b);
  assert.match(last(b), /18/, 'питають про вік і згоду батьків');
  s.dmReply(b.id, 'Мені менше 18 — батьки підпишуть', 'parents'); flush(s, b);
  assert.ok(s.s.pendingAd && s.s.pendingAd.pay > base, `${s.s.pendingAd?.pay} > ${base}`);
  const t = s.person('troll'), td = s.talk(t.id, 'troll'); flush(s, td);
  const tr2 = s.s.trust; s.dmReply(td.id, 'Сам такий!', 'fight'); flush(s, td);
  assert.ok(s.s.trust < tr2 && td.msgs.some(m => m.sys));
  s.dmReply(td.id, 'Зробити знімок і розповісти дорослим', 'shot');
  assert.ok(s.s.people[t.id].blocked);
});

test('Директ: без відповіді нагадують про себе; режисер сам починає розмови', () => {
  const s = fresh(8); at(s, 10); s.publish({ kind: 'photo', photo: { gid: s.s.gallery[0].id }, caption: 'Мурчик' });
  const u = s.person('fan'); s.s.fans.push(u.id);
  const d = s.talk(u.id, 'request'); flush(s, d);
  s.advance(9 * 60); flush(s, d);
  assert.match(last(d), /тут|зайнят|не відволікаю/i, 'нагадали');
  const t = fresh(9); at(t, 9); t.publish({ kind: 'photo', photo: { gid: t.s.gallery[0].id }, caption: 'x' }); t.s.followers = 30; for (let i = 0; i < 4; i++) t.s.fans.push(t.person('fan').id);
  t.advance(2 * DAY);
  assert.ok(t.s.dms.filter(x => x.script).length >= 2, 'за дві доби написали кілька людей');
});

test('Коментарі: гілка розмови, відповідь на питання з підпису, постійні глядачі й захист від троля', () => {
  const s = fresh(9); at(s, 18);
  for (let i = 0; i < 6; i++) { const f = s.person('fan', ['pets']); s.s.fans.push(f.id); if (i < 2) f.loyal = true; }
  s.s.followers = 80;
  const p = s.publish({ kind: 'photo', photo: { gid: s.s.gallery[0].id }, caption: 'Мурчик знову спить. Що показати наступного разу?' });
  s.advance(400); for (let i = 0; i < 12; i++) s.comment(p);
  assert.ok(p.comments.some(c => c.loyal), 'постійний глядач прийшов');
  assert.ok(p.comments.some(c => /наступного|покажи|Покажи|Хочу/.test(c.text)), 'відповідають на питання з підпису');
  const c = p.comments.find(x => !x.loyal);
  s.reply(p.id, c.id, 'Дякую! Покажу, як він грає', 'kind');
  for (let i = 0; i < 20 && !c.thread?.length; i++) { s.advance(10); s.runQueue(); }
  s.cmFollow(p.id, c.id);
  assert.ok(c.thread?.length >= 1, 'глядач відповів на відповідь');
  s.reply(p.id, c.id, 'Нема за що :)', 'kind'); assert.ok(c.thread.some(x => x.me), 'можна відповісти ще раз у гілці');
  const t = s.person('troll'); s.addComment(p.id, 'troll', 'Нудота', t.id); s.defend(p.id, p.comments.at(-1).id);
  assert.ok(p.comments.some(x => x.to && /@/.test(x.text)), 'фан заступився');
  const r = { next: () => 0.1 };
  assert.equal(captionComment('Що показати наступного разу?', 'pets', r).kind, 'request');
  assert.match(captionComment('Яке фото найкраще?', 'pets', r, { slides: 3 }).text, /перше|Друге|Останнє|-е/i);
});

test('Коментарі: проігноровані питання глядачі помічають', () => {
  const s = fresh(10); at(s, 18);
  const p = s.publish({ kind: 'photo', photo: { gid: s.s.gallery[0].id }, caption: 'x' });
  for (let i = 0; i < 2; i++) s.addComment(p.id, 'question', 'А як ти це робиш?' + i, s.person('fan').id);
  p.comments.forEach(c => { c.t -= 700; });
  const tr = s.s.trust; s.ignoredCheck();
  assert.ok(p.fired.ignored && s.s.trust < tr && /відпов|читає/.test(p.comments.at(-1).text));
});

test('Реклама на YouTube: оплата за перегляд, повільний початок дорожчає, відео для дітей не просувається', () => {
  const s = fresh(12); createChannel(s, { name: 'К', handle: 'kkk', topic: 'pets' });
  const v = tubeUpload(s, { src: { clip: 'laser' }, dur: 24, title: 'Кіт ловить лазерну указку', desc: '', thumb: { kind: 'frame' }, topic: 'pets', kids: false });
  const a = { platform: 'tube', auto: true, goal: 'views', place: 'auto', places: ['instream'], daily: 100, days: 5, age: [18, 34], interests: [], city: 'ua', gender: 'all' };
  const fast = cpm(a, 0.7), slow = cpm({ ...a, intro: true }, 0.7);
  assert.ok(fast.cpv > 0.2 && fast.cpv < 2, `CPV ${fast.cpv}`);
  assert.ok(slow.vr < fast.vr, 'повільний початок — менше переглядів');
  assert.ok(forecast({ ...a, goal: 'subs' }, 0.7).results[1] < forecast(a, 0.7).results[0]);
  const v0 = v.stats.views, s0 = s.s.tube.subs;
  const r = launchAd(s, { ...a, vid: v.id }, 0.7, reviewVideo(v));
  s.advance(2 * DAY);
  assert.equal(r.ad.status, 'active'); assert.ok(r.ad.stats.views > 0 && v.stats.views > v0 && s.s.tube.subs >= s0);
  assert.ok(s.s.tube.notifs.some(n => n.ad === r.ad.id), 'сповіщення на YouTube');
  assert.ok(reviewVideo({ kids: true, vis: 'public' }).length && reviewVideo({ cb: true, vis: 'public' }).length);
});
