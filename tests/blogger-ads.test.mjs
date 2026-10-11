// Симулятор блогера: таргетована реклама — аудиторія, ціна, модерація, витрати й повернення коштів
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim, newState, DAY } from '../emulators/bloggeremu/js/sim.js';
import { audience, cpm, forecast, review, launchAd, stopAd, teen, VAT, START_BALANCE } from '../emulators/bloggeremu/js/adsim.js';

const base = { auto: false, city: 'ua', radius: 0, age: [18, 34], gender: 'all', interests: [], place: 'auto', places: ['feed'], goal: 'profile', daily: 100, days: 5 };
const fresh = () => { const s = new Sim(newState(7)); s.register({ nick: 'kotyk.art', niche: 'pets', bio: 'Про котів', pass: 'Murchyk-2026!' }); return s; };

test('аудиторія: місто, вік і інтереси звужують, підлітків не можна таргетувати за інтересами', () => {
  const all = audience(base).size, kyiv = audience({ ...base, city: 'kyiv' }).size, pets = audience({ ...base, city: 'kyiv', interests: ['pets'] }).size;
  assert.ok(all > kyiv && kyiv > pets && pets > 10_000);
  assert.ok(audience({ ...base, city: 'kyiv', radius: 50 }).size > kyiv);
  const t = { ...base, age: [13, 17], interests: ['pets'], gender: 'f' };
  assert.ok(teen(t)); assert.equal(audience(t).size, audience({ ...t, interests: [], gender: 'all' }).size, 'інтереси й стать для підлітків ігноруються');
});

test('ціна: вузька аудиторія й слабкий допис дорожчі; прогноз має діапазон і ПДВ', () => {
  const wide = cpm(base, 0.6).cpm, narrow = cpm({ ...base, city: 'poltava', age: [30, 31], interests: ['books'] }, 0.6).cpm;
  assert.ok(narrow > wide * 1.4, `${narrow} > ${wide}`);
  assert.ok(cpm(base, 0.3).cpm > cpm(base, 0.8).cpm);
  assert.ok(wide >= 30 && wide <= 120, 'CPM у реалістичних межах для України');
  const f = forecast(base, 0.6);
  assert.ok(f.results[0] < f.results[1] && f.reach[0] > 0);
  assert.equal(f.vat, f.total * VAT);
  assert.ok(forecast({ ...base, city: 'poltava', age: [30, 31], interests: ['books'], days: 30, daily: 500 }, 0.6).freq > 3, 'вузька аудиторія — висока частота');
});

test('модерація: особисті дані, чужа музика, клікбейт', () => {
  assert.equal(review({ risk: [] }).length, 0);
  assert.match(review({ risk: ['address'] })[0], /Особисті дані/);
  assert.ok(review({ music: { hit: true } }).length && review({ cb: true }).length);
});

test('кампанія: резервування, перевірка, витрати за днями, підписники, повернення залишку', () => {
  const s = fresh(), f0 = s.s.followers;
  const r = launchAd(s, { ...base, pid: null }, 0.7);
  assert.equal(r.ad.status, 'review'); assert.equal(s.s.ads.balance, START_BALANCE - 600);
  s.advance(120); assert.equal(r.ad.status, 'active');
  s.advance(2 * DAY);
  const st = r.ad.stats;
  assert.ok(st.spent > 150 && st.spent < 260, `витрачено ${st.spent}`);
  assert.ok(st.imps > 0 && st.reach <= st.imps && st.clicks > 0 && st.days.length >= 2);
  assert.ok(s.s.followers > f0, 'реклама приводить підписників');
  stopAd(s, r.ad.id);
  assert.equal(r.ad.status, 'done'); assert.ok(r.ad.refund > 0);
  assert.ok(Math.abs(s.s.ads.balance - (START_BALANCE - st.spent * (1 + VAT))) < 0.05, 'залишок повернуто');
  assert.ok(launchAd(s, { ...base, daily: 1000, days: 30 }, 0.7).error, 'не вистачає балансу');
});

test('відхилена реклама повертає гроші', () => {
  const s = fresh();
  const r = launchAd(s, { ...base }, 0.6, ['Особисті дані']);
  s.advance(120);
  assert.equal(r.ad.status, 'rejected'); assert.equal(s.s.ads.balance, START_BALANCE);
});
