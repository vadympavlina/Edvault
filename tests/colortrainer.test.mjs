// Колір на око: перетворення кольорів, ΔE2000, підказки, раунди.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../tools/colortrainer/js/color.js';
import { makeRound, scoreRound } from '../tools/colortrainer/js/round.js';
import { LEVELS, CHAPTERS } from '../tools/colortrainer/js/levels.js';

test('HSB ↔ RGB ↔ HEX', () => {
  assert.equal(c.toHex(c.hsbToRgb({ h: 0, s: 100, b: 100 })), '#FF0000');
  assert.equal(c.toHex(c.hsbToRgb({ h: 120, s: 100, b: 100 })), '#00FF00');
  assert.equal(c.toHex(c.hsbToRgb({ h: 0, s: 0, b: 50 })), '#808080');
  assert.deepEqual(c.fromHex('#3a7bd5'), { r: 58, g: 123, b: 213 });
  assert.equal(c.fromHex('nope'), null);
  for (const hex of ['#3A7BD5', '#FFAA00', '#123456', '#FFFFFF', '#000000']) assert.equal(c.toHex(c.hsbToRgb(c.rgbToHsb(c.fromHex(hex)))), hex);
});

test('ΔE2000 збігається з еталонними прикладами (Sharma, 2005)', () => {
  const P = [[[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425], [[50, 0, 0], [50, -1, 2], 2.3669], [[50, 2.5, 0], [73, 25, -18], 27.1492], [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644], [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373]];
  for (const [a, b, e] of P) assert.ok(Math.abs(c.deltaELab({ L: a[0], a: a[1], b: a[2] }, { L: b[0], a: b[1], b: b[2] }) - e) < 1e-3);
  assert.equal(c.deltaE({ r: 10, g: 20, b: 30 }, { r: 10, g: 20, b: 30 }), 0);
});

test('точність і зірки', () => {
  assert.equal(c.accuracyFromDE(0), 100); assert.equal(c.accuracyFromDE(2), 90); assert.equal(c.accuracyFromDE(30), 0);
  assert.equal(c.starsFor(95), 3); assert.equal(c.starsFor(85), 2); assert.equal(c.starsFor(70), 1); assert.equal(c.starsFor(40), 0);
});

test('підказки: лише те, що учень може змінити', () => {
  const t = c.hsbToRgb({ h: 210, s: 70, b: 80 });
  const all = c.advice(t, c.hsbToRgb({ h: 170, s: 40, b: 95 }));
  assert.ok(all.some(x => /темніше/.test(x)) && all.some(x => /відтінок/.test(x)));
  const hueOnly = c.advice(t, c.hsbToRgb({ h: 120, s: 70, b: 80 }), 'hue');
  assert.ok(hueOnly.every(x => !/темніше|світліше|насичен/.test(x)), hueOnly.join(' '));
  assert.match(c.advice(t, t)[0], /ідеально/);
});

test('гармонії й порядок плиток', () => {
  assert.deepEqual(c.harmonyTargets({ h: 30, s: 50, b: 50 }, 'complement').map(x => x.h), [210]);
  assert.deepEqual(c.harmonyTargets({ h: 300, s: 50, b: 50 }, 'triad').map(x => x.h), [60, 180]);
  assert.equal(c.orderAccuracy([0, 1, 2, 3, 4, 5, 6, 7]), 100);
  assert.ok(c.orderAccuracy([0, 2, 1, 3, 4, 5, 6, 7]) > c.orderAccuracy([0, 6, 5, 4, 3, 2, 1, 7]));
});

test('рівні й раунди: правильна відповідь — 100%, старт завжди відрізняється від зразка', () => {
  const ids = new Set();
  for (const l of LEVELS) {
    assert.ok(CHAPTERS.some(ch => ch.id === l.chapter), l.id);
    assert.ok(!ids.has(l.id)); ids.add(l.id);
    for (let k = 0; k < 20; k++) {
      const r = makeRound(l, c.rng(k * 977 + l.id.length));
      if (l.mode === 'order') {
        assert.equal(scoreRound(l, r, r.ramp.map((_, i) => i)).accuracy, 100);
        assert.ok(scoreRound(l, r, r.order).accuracy < 100, 'плитки перемішані');
        assert.equal(r.order[0], 0); assert.equal(r.order[r.order.length - 1], r.ramp.length - 1);
        continue;
      }
      assert.equal(scoreRound(l, r, r.targets[0]).accuracy, 100, l.id);
      assert.ok(scoreRound(l, r, r.start).accuracy < 90, l.id + ': старт надто близький');
      if (l.mode === 'hue') assert.ok(r.start.s === r.target.s && r.start.b === r.target.b);
      if (l.mode === 'sb') assert.equal(r.start.h, r.target.h);
    }
  }
  assert.ok(LEVELS.length >= 24);
});
