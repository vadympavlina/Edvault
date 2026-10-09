// Безпека в інтернеті: адреси, паролі, бали, цілісність рівнів.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { registrable, parseUrl, strength, crackTime, scorePick, starsFor, segments } from '../trainers/safetytrainer/js/logic.js';
import { LEVELS, CHAPTERS } from '../trainers/safetytrainer/js/levels.js';

test('справжнє ім’я сайту: піддомени, приманки на початку, «@», дво-рівневі зони', () => {
  assert.equal(registrable('www.kublandia.com'), 'kublandia.com');
  assert.equal(registrable('shop.sonyah.com.ua'), 'sonyah.com.ua');
  assert.equal(parseUrl('https://sonyah.ua.card-check.net/login').domain, 'card-check.net');
  const u = parseUrl('https://kublandia.com@free-gems.top/skins');
  assert.equal(u.domain, 'free-gems.top'); assert.equal(u.userinfo, 'kublandia.com@');
  assert.equal(parseUrl('http://kublandia.com/login').secure, false);
  assert.equal(parseUrl('https://a.b.c.druzi.net:8080/x?y').chunks.map(c => c.t).join(''), 'https://a.b.c.druzi.net:8080/x?y');
});

test('надійність паролів: популярні й особисті — слабкі, довгі й фрази — надійні', () => {
  for (const p of ['123456', 'qwerty', 'password1', 'йцукен']) assert.equal(strength(p).score, 0, p);
  assert.ok(strength('Murchyk2012', ['murchyk', '2012']).bits < strength('Murchyk2012').bits);
  assert.ok(strength('T7#qL9!wz2Rp').score >= 3);
  assert.equal(strength('синій-ліхтар-пече-хліб').score, 4);
  assert.ok(strength('aaaaaaaaaaaa').score <= 1, 'повтори');
  assert.ok(strength('abcdefgh1234').score <= 1, 'послідовності');
  assert.equal(crackTime(0), 'миттєво');
  assert.match(crackTime(52.6), /^\d+ дн/);
  assert.equal(crackTime(200), 'довше, ніж існує Всесвіт');
});

test('бали за завдання', () => {
  assert.equal(scorePick([0, 1], [0, 1]), 1); assert.equal(scorePick([0, 1], [0, 2]), 0); assert.equal(scorePick([0, 1], [0]), 0.5);
  assert.equal(starsFor(0.95), 3); assert.equal(starsFor(0.75), 2); assert.equal(starsFor(0.2), 1);
});

test('розмітка повідомлень: підозрілі частини й звичайні речення', () => {
  const s = segments('{Терміново!|поспіх} Ваша посилка чекає. Сплатіть {тут|чужий сайт}.');
  assert.deepEqual(s.filter(x => x.flag).map(x => x.t), ['Терміново!', 'тут']);
  assert.ok(s.some(x => !x.flag && x.t.includes('посилка')));
});

test('рівні цілісні й прості: пам’ятка, одна правильна відповідь, пояснення', () => {
  const ids = new Set(), kinds = new Set();
  for (const l of LEVELS) {
    assert.ok(CHAPTERS.some(c => c.id === l.chapter), l.id);
    assert.ok(!ids.has(l.id)); ids.add(l.id);
    assert.ok(l.tasks.length >= 3 && l.tasks.length <= 5, l.id);
    assert.equal(l.tips.length, 3, l.id + ': пам’ятка з трьох правил');
    for (const [k, t] of l.tasks.entries()) {
      const at = `${l.id} #${k + 1}`;
      kinds.add(t.kind);
      if (t.kind !== 'choice') assert.ok(t.why, at + ': немає пояснення');
      if (t.kind === 'yesno') { assert.equal(typeof t.yes, 'boolean', at); if (t.url) assert.ok(parseUrl(t.url).domain.includes('.'), at); }
      if (t.kind === 'which') {
        assert.ok(t.answer >= 0 && t.answer < t.options.length, at);
        assert.equal(new Set(t.options.map(u => parseUrl(u).domain)).size, t.options.length, at + ': різні сайти');
      }
      if (t.kind === 'msg') {
        const flags = Object.values(t.m).flat().filter(v => typeof v === 'string').flatMap(segments).filter(x => x.flag);
        assert.equal(flags.length > 0, t.scam, at + ': підозрілі місця є лише в небезпечних');
      }
      if (t.kind === 'pair') assert.ok(Math.abs(strength(t.a).bits - strength(t.b).bits) > 15, at + ': різниця має бути очевидною');
      if (t.kind === 'choice') { assert.equal(t.options.filter(o => o.ok).length, 1, at); assert.ok(t.options.every(o => o.why), at); }
      if (t.kind === 'pick') assert.ok(t.items.some(i => i.bad) && t.items.some(i => !i.bad), at);
      if (t.kind === 'make') assert.ok(t.rules.length, at);
    }
  }
  assert.deepEqual([...kinds].sort(), ['choice', 'make', 'msg', 'pair', 'pick', 'which', 'yesno']);
  assert.equal(LEVELS.length, 20);
});
