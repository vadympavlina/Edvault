// Симулятор блогера: власні фото й відео, карусель, відеоплатформа «Хвиля» — без браузера
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim, newState, hourOf, DAY } from '../emulators/bloggeremu/js/sim.js';
import { judge, checks } from '../emulators/bloggeremu/js/quality.js';
import { createChannel, updateChannel, tubeUpload, brandScore, curve, tubeReply, tubeFeed } from '../emulators/bloggeremu/js/tubesim.js';

const fresh = (seed = 11) => { const s = new Sim(newState(seed)); s.register({ nick: 'kotyk.art', niche: 'pets', bio: 'Про котів', pass: 'Murchyk-2026!' }); return s; };
const at = (sim, h) => { while (hourOf(sim.s.t) !== h) sim.advance(5); };
// виміряні показники, як їх повертає media.js
const PHOTO = { type: 'photo', own: true, mid: 'm1', w: 1600, h: 2000, an: { lum: 0.52, con: 0.17, sharp: 240, col: 80, hi: 0, lo: 0 } };
const DARK = { ...PHOTO, mid: 'm2', an: { lum: 0.12, con: 0.05, sharp: 20, col: 20, hi: 0, lo: 0.1 } };
const BLUR = { ...PHOTO, mid: 'm3', an: { lum: 0.6, con: 0.14, sharp: 3, col: 60, hi: 0, lo: 0 } };
const VERT = { type: 'video', own: true, mid: 'v1', w: 720, h: 1280, dur: 18, an: { lum: 0.5, sharp: 300, col: 90, intro: 0, motion: 0.02 } };
const SLOW = { ...VERT, mid: 'v2', an: { ...VERT.an, intro: 6 } };
const WIDE = { type: 'video', own: true, mid: 'v3', w: 1280, h: 720, dur: 300, an: { lum: 0.5, sharp: 300, col: 90, intro: 0, motion: 0.02 } };

test('оцінка власного фото: темне, розмите й гарне розрізняються, фільтр «Яскраво» рятує темний кадр', () => {
  const g = judge(PHOTO), d = judge(DARK), b = judge(BLUR);
  assert.ok(g.q > d.q && g.q > b.q);
  assert.ok(d.flags.dark && b.flags.blur);
  assert.ok(judge(DARK, { filter: { fix: true } }).q > d.q);
  assert.ok(d.why.some(w => /Темне/.test(w[1])));
  const c = checks(DARK); assert.equal(c.find(x => x[0] === 'Світло')[2], 'bad');
  assert.match(checks({ ...PHOTO, w: 320, h: 240 }).find(x => x[0] === 'Розмір')[1], /замалий/);
});

test('оцінка відео: нудний початок, обрізка й формат під платформу', () => {
  const slow = judge(SLOW, { start: 0, end: 18 }), cut = judge(SLOW, { start: 6, end: 18 });
  assert.ok(slow.flags.intro && !cut.flags.intro && cut.q > slow.q, 'обрізаний початок виправляє оцінку');
  assert.ok(judge(VERT).q > judge({ ...VERT, w: 1280, h: 720 }).q, 'у стрічці Лайкера вертикальне краще');
  assert.ok(judge(WIDE, { app: 'tube', end: 300 }).why.some(w => /Горизонтальне/.test(w[1])));
});

test('власне фото в дописі: тема з Галереї, реакції залежать від якості', () => {
  const run = (g, seed) => { const s = fresh(seed); at(s, 19); const x = s.addOwn(g, 'pets'); const p = s.publish({ kind: 'photo', photo: { gid: x.id, filter: 'none' }, caption: 'Мій кіт сьогодні вранці. А ваш теж так спить? #котики #мійкіт' }); s.advance(DAY); return p; };
  const good = run(PHOTO, 5), bad = run(DARK, 5);
  assert.equal(good.topic, 'pets');
  assert.ok(good.stats.views > bad.stats.views, `${good.stats.views} > ${bad.stats.views}`);
  assert.ok(bad.why.some(w => /Темне/.test(w[1])));
});

test('карусель: кілька фото, більше збережень, слабкий кадр усередині помітний', () => {
  const s = fresh(9); at(s, 19);
  const a = s.addOwn(PHOTO, 'pets'), b = s.addOwn({ ...PHOTO, mid: 'm4' }, 'pets'), c = s.addOwn(BLUR, 'pets');
  const p = s.publish({ kind: 'photo', photo: { gid: a.id }, photos: [{ gid: a.id }, { gid: b.id }, { gid: c.id }], caption: 'Три кадри з прогулянки #котики' });
  assert.equal(p.carousel, 3);
  assert.equal(p.photos.length, 3);
  assert.ok(p.why.some(w => /Карусель/.test(w[1])));
  assert.ok(p.why.some(w => /Слабкі кадри/.test(w[1])));
  // одне фото — звичайний допис
  const one = s.publish({ kind: 'photo', photo: { gid: a.id }, photos: [{ gid: a.id }], caption: 'x' });
  assert.equal(one.photos, null);
});

test('власні файли: тема змінюється, файл вважається потрібним, поки є в дописі', () => {
  const s = fresh(4), g = s.addOwn(PHOTO, 'pets');
  s.setTopic(g.id, 'art'); assert.equal(g.topic, 'art');
  s.publish({ kind: 'photo', photo: { gid: g.id, g: { own: true, mid: g.mid, type: 'photo', w: g.w, h: g.h, an: g.an } }, caption: 'Малюнок' });
  s.deletePhoto(g.id);
  assert.ok(s.mediaInUse(g.mid), 'опублікований допис тримає файл');
  assert.ok(!s.mediaInUse('m-nobody'));
  // старі кадри з камери видаляються, власні — ні
  for (let i = 0; i < 90; i++) s.takePhoto('cat');
  const own = s.addOwn({ ...PHOTO, mid: 'm9' }); for (let i = 0; i < 10; i++) s.takePhoto('cat');
  assert.ok(s.s.gallery.length <= 81 && s.s.gallery.some(x => x.id === own.id));
});

test('«Хвиля»: оформлення каналу, обкладинка й заголовок впливають на CTR, крива утримання', () => {
  const mk = (seed, o) => { const s = fresh(seed); createChannel(s, { name: 'Мурчик і я', handle: 'murchyk.tv', topic: 'pets' }); if (o.brand) updateChannel(s, { desc: 'Щосуботи — нові трюки мого кота Мурчика й поради для власників', avatar: { color: '#c62828', sym: 'paw', img: '' }, banner: { color: '#333', img: 'mb' } }); s.addOwn(WIDE, 'pets'); return s; };
  const up = (s, o) => tubeUpload(s, { src: { own: true, gid: s.s.gallery[0].id, g: WIDE }, dur: 300, title: o.title, desc: o.desc || '', thumb: o.thumb, topic: 'pets', kids: false, vis: 'public' });
  const a = mk(21, { brand: true }), b = mk(21, {});
  assert.ok(brandScore(a.s.tube).k > brandScore(b.s.tube).k);
  const va = up(a, { title: 'Вчу кота давати лапу: 5 простих кроків', desc: 'Покажу, як за тиждень навчити котика команд. Котики люблять ласощі, тож запасіться ними. #котики', thumb: { kind: 'photo', g: { ...PHOTO, w: 1920, h: 1080 }, text: 'Кіт дає лапу!' } });
  const vb = up(b, { title: 'Відео', thumb: { kind: 'frame', i: -1, text: '' } });
  assert.ok(va.plan.ctr > vb.plan.ctr, `CTR ${va.plan.ctr} > ${vb.plan.ctr}`);
  assert.ok(vb.why.some(w => /Закороткий заголовок/.test(w[1])) && vb.why.some(w => /випадковий кадр/.test(w[1])));
  assert.equal(va.shorts, false);
  a.advance(3 * DAY); b.advance(3 * DAY);
  assert.ok(va.stats.views > vb.stats.views && va.stats.watch > 0);
  assert.ok(va.daily.length >= 3 && va.daily.reduce((x, y) => x + y, 0) === va.stats.views, 'історія за днями сходиться з переглядами');
  // крива утримання починається зі 100% і в середньому дає ret
  const c = curve(0.5, true, false, false);
  assert.equal(c[0], 100); assert.equal(c.length, 11);
  assert.ok(Math.abs(c.reduce((x, y) => x + y, 0) / 11 - 50) < 3);
  assert.ok(curve(0.5, true, false, false)[1] < curve(0.5, false, false, false)[1], 'нудний початок — різкий спад');
});

test('«Хвиля»: короткі відео, «для дітей» без коментарів, клікбейт і відповіді', () => {
  const s = fresh(31); createChannel(s, { name: 'К', handle: 'kkk', topic: 'pets' }); s.addOwn(VERT, 'pets');
  const sh = tubeUpload(s, { src: { own: true, gid: s.s.gallery[0].id, g: VERT }, dur: 18, title: 'Кіт стрибає на диван', desc: '', thumb: { kind: 'frame' }, topic: 'pets', kids: true });
  assert.equal(sh.shorts, true);
  const cb = tubeUpload(s, { src: { clip: 'laser' }, dur: 24, title: 'ШОК!!! КІТ ЗРОБИВ ЦЕ', desc: '', thumb: { kind: 'frame' }, topic: 'pets', kids: false });
  assert.ok(cb.cb && cb.why.some(w => /Клікбейт/.test(w[1])));
  s.advance(2 * DAY);
  assert.equal(sh.stats.comments, 0, 'відео для дітей — без коментарів');
  assert.ok(cb.comments.length > 0);
  const c = cb.comments[0], trust = s.s.trust;
  tubeReply(s, cb.id, c.id, 'Дякую, що дивишся!', 'kind');
  assert.ok(c.reply && s.s.trust >= trust);
  // заплановане відео виходить вчасно
  const later = tubeUpload(s, { src: { clip: 'waves' }, dur: 18, title: 'Хвилі на морі ввечері', desc: '', thumb: { kind: 'frame' }, topic: 'travel', kids: false, sched: s.s.t + 120 });
  assert.equal(later.t, 0); s.advance(130); assert.ok(later.t > 0);
  assert.ok(tubeFeed(s).length > 8 && tubeFeed(s, 'food').every(v => v.topic === 'food'));
  // старі збереження без «Хвилі» відкриваються
  const old = newState(2); delete old.tube; delete old.phone;
  const o = new Sim(old); assert.equal(o.s.tube, null); assert.equal(o.s.phone.wall, 'dawn');
});
