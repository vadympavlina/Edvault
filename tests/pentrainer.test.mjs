// Тренажер пера: розбір контурів, оцінка схожості, рівні.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePath, toPath, score, alignTo, sample } from '../trainers/pentrainer/js/geom.js';
import { LEVELS, CHAPTERS } from '../trainers/pentrainer/js/levels.js';

const shift = (path, a) => ({ anchors: path.anchors.map((p, k) => { const dx = Math.sin(k * 7) * a, dy = Math.cos(k * 5) * a; const m = h => h && { x: h.x + dx, y: h.y + dy }; return { x: p.x + dx, y: p.y + dy, hin: m(p.hin), hout: m(p.hout) }; }), closed: path.closed });

test('розбір і запис шляху туди й назад', () => {
  for (const l of LEVELS) {
    const p = parsePath(l.d);
    assert.equal(toPath(p.anchors, p.closed), l.d, l.id);
  }
  const c = parsePath('M0 0 C10 0 20 10 20 20 Z');
  assert.equal(c.anchors.length, 2); assert.equal(c.closed, true);
  assert.deepEqual(c.anchors[0].hout, { x: 10, y: 0 });
  assert.equal(c.anchors[1].hout, null);
});

test('рівні: кожен має розділ, унікальний id і коректну фігуру', () => {
  const ids = new Set();
  for (const l of LEVELS) {
    assert.ok(CHAPTERS.some(c => c.id === l.chapter), l.id);
    assert.ok(!ids.has(l.id), 'дубль ' + l.id); ids.add(l.id);
    const p = parsePath(l.d);
    assert.ok(p.anchors.length >= 2, l.id);
    for (const pt of sample(p.anchors, p.closed)) assert.ok(pt.x > 20 && pt.x < 580 && pt.y > 20 && pt.y < 580, 'фігура виходить за поле: ' + l.id);
  }
  assert.ok(LEVELS.length >= 20);
});

test('оцінка: точна копія — 100 і три зірки; неточність знижує оцінку', () => {
  for (const l of LEVELS.filter(x => x.mode === 'trace')) {
    const t = parsePath(l.d);
    const exact = score(t, t), small = score(t, shift(t, 3)), big = score(t, shift(t, 15));
    assert.equal(exact.accuracy, 100, l.id); assert.equal(exact.stars, 3, l.id);
    assert.ok(small.accuracy >= 85, l.id + ': ±3 → ' + small.accuracy);
    assert.ok(big.accuracy < small.accuracy, l.id);
  }
});

test('незамкнений контур і зайві точки обмежують оцінку', () => {
  const t = parsePath(LEVELS.find(l => l.id === 'square').d);
  const open = score(t, { anchors: t.anchors, closed: false });
  assert.ok(open.accuracy <= 60); assert.match(open.reason, /замкн/);
  // 8 точок замість 4: форма та сама, але три зірки не дають
  const A = t.anchors, mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, hin: null, hout: null });
  const many = { anchors: A.flatMap((a, i) => [a, mid(a, A[(i + 1) % 4])]), closed: true };
  const r = score(t, many);
  assert.ok(r.accuracy >= 95); assert.equal(r.stars, 2); assert.equal(r.used, 8);
});

test('«за зразком»: розмір і місце не важливі', () => {
  const t = parsePath(LEVELS.find(l => l.id === 'heart').d);
  const small = t.anchors.map(p => { const m = h => h && { x: h.x * 0.5 + 20, y: h.y * 0.5 + 200 }; return { ...m(p), hin: m(p.hin), hout: m(p.hout) }; });
  assert.ok(score(t, { anchors: small, closed: true }).accuracy < 30);
  assert.ok(score(t, { anchors: alignTo(small, t.anchors, true, true), closed: true }).accuracy >= 98);
});

test('менше двох точок — не оцінюється', () => {
  const t = parsePath(LEVELS[0].d);
  assert.equal(score(t, { anchors: [{ x: 1, y: 1, hin: null, hout: null }], closed: false }).accuracy, 0);
});
