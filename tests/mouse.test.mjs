// Мишка й точність: розміщення цілей, рамка, перетягування, зірки.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { rng, placeNext, marqueeRound, judgeSelection, normRect, dragLayout, accuracy, starsFor, fmtTime } from '../tools/mousetrainer/js/logic.js';
import { LEVELS, CHAPTERS } from '../tools/mousetrainer/js/levels.js';

test('рівні: усі поля на місці, цілі меншають у межах розділу', () => {
  const ids = new Set();
  for (const l of LEVELS) {
    assert.ok(CHAPTERS.some(c => c.id === l.chapter), l.id);
    assert.ok(!ids.has(l.id)); ids.add(l.id);
    assert.ok(l.count > 0 && l.par > 0 && l.hint && l.name, l.id);
    assert.equal(l.kind, l.chapter === 'marquee' ? 'marquee' : l.chapter, l.id);
  }
  for (const ch of CHAPTERS) {
    const sizes = LEVELS.filter(l => l.chapter === ch.id && l.size && !l.mix && !l.menu && !l.speed).map(l => l.size);
    assert.deepEqual(sizes, [...sizes].sort((a, b) => b - a), ch.id);
  }
  assert.equal(LEVELS.length, 24);
});

test('наступна ціль — у полі й далеко від попередньої', () => {
  const r = rng(1);
  let prev = null;
  for (let i = 0; i < 300; i++) {
    const s = [110, 48][i % 2], p = placeNext(1000, 560, s, prev, r);
    assert.ok(p.x >= s / 2 && p.x <= 1000 - s / 2 && p.y >= s / 2 && p.y <= 560 - s / 2);
    if (prev) assert.ok(Math.hypot(p.x - prev.x, p.y - prev.y) >= 200);
    prev = p;
  }
});

test('рамка: завжди можна обвести всі зірки без камінців', () => {
  for (const l of LEVELS.filter(l => l.kind === 'marquee')) {
    for (let seed = 1; seed <= 60; seed++) {
      for (const [W, H] of [[1300, 600], [900, 460]]) {
        const R = marqueeRound(l, W, H, rng(seed));
        assert.equal(R.goods.length, l.goods); assert.equal(R.bads.length, l.bads);
        assert.ok(judgeSelection(R.rect, R.goods, R.bads).ok, `${l.id} seed ${seed}`);
        for (const p of [...R.goods, ...R.bads]) assert.ok(p.x > l.size / 2 && p.x < W - l.size / 2 && p.y > l.size / 2 && p.y < H - l.size / 2);
        const all = [...R.goods, ...R.bads];
        for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.ok(Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y) >= l.size * 1.2 - 1e-9);
      }
    }
  }
});

test('рамка: пропущена зірка й зайвий камінець', () => {
  const goods = [{ x: 10, y: 10 }, { x: 50, y: 50 }], bads = [{ x: 90, y: 90 }];
  assert.deepEqual(judgeSelection(normRect(60, 60, 0, 0), goods, bads), { ok: true, missed: [], extra: [] });
  assert.deepEqual(judgeSelection(normRect(20, 20, 60, 60), goods, bads).missed, [0]);
  assert.deepEqual(judgeSelection(normRect(0, 0, 100, 100), goods, bads).extra, [0]);
});

test('перетягування: фігури й контури не перекриваються', () => {
  for (const l of LEVELS.filter(l => l.kind === 'drag')) {
    for (let seed = 1; seed <= 30; seed++) {
      const { items, slots } = dragLayout(l.count, l.size, 1300, 600, rng(seed));
      for (const list of [items, slots]) {
        assert.equal(list.length, l.count);
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) assert.ok(Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y) > l.size);
      }
      assert.ok(Math.max(...items.map(p => p.x)) < Math.min(...slots.map(p => p.x)));
    }
  }
});

test('зірки, влучність і час', () => {
  assert.equal(starsFor(10, 0, 12), 3); assert.equal(starsFor(10, 1, 12), 3);
  assert.equal(starsFor(10, 2, 12), 2); assert.equal(starsFor(15, 0, 12), 2);
  assert.equal(starsFor(30, 0, 12), 1); assert.equal(starsFor(10, 6, 12), 1);
  assert.equal(accuracy(9, 1), 90); assert.equal(accuracy(0, 0), 100);
  assert.equal(fmtTime(9.84), '9,8 с'); assert.equal(fmtTime(75), '1:15');
});
