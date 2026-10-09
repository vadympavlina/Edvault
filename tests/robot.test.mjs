// Алгоритми з роботом: виконання програм, помилки, рівні.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMap, check, countBlocks, starsFor, P } from '../trainers/robot-app/js/world.js';
import { LEVELS, CHAPTERS } from '../trainers/robot-app/js/levels.js';
const { F, L, R, rep, iff, wh } = P;

test('кожен рівень проходиться еталонним розв’язком на всіх картах', () => {
  const ids = new Set();
  for (const l of LEVELS) {
    assert.ok(CHAPTERS.some(c => c.id === l.chapter), l.id);
    assert.ok(!ids.has(l.id)); ids.add(l.id);
    const sol = l.solution();
    for (const m of l.maps) {
      const map = parseMap(m, l.dir);
      assert.ok(map.start, l.id + ': немає старту');
      assert.ok(m.join('').includes('F'), l.id + ': немає прапорця');
      const r = check(map, sol);
      assert.ok(r.ok, `${l.id}: ${r.error}`);
    }
    // розв'язок використовує лише доступні блоки
    const used = new Set(); const walk = list => list.forEach(b => { used.add(b.t); b.body && walk(b.body); b.alt && walk(b.alt); });
    walk(sol);
    assert.deepEqual([...used].filter(t => !l.blocks.includes(t)), [], l.id);
  }
  assert.equal(LEVELS.length, 24);
});

test('помилки: стіна, вода, не дійшов, зірки, нескінченний цикл', () => {
  const m = parseMap(['S.#', '~..', '..F'], 1);
  assert.equal(check(m, [F(), F()]).error, 'wall');
  assert.equal(check(m, [R(), F()]).error, 'water');
  assert.equal(check(m, [F()]).error, 'short');
  assert.equal(check(parseMap(['S*F'], 1), [L(), L(), F()]).error, 'wall');
  assert.equal(check(parseMap(['S.F', '.*.'], 1), [F(), F()]).error, 'stars');
  assert.equal(check(m, [wh('goal', L())]).error, 'limit');
  assert.equal(check(m, [wh('goal')]).error, 'limit');
});

test('робот зупиняється на прапорці посеред циклу', () => {
  const r = check(parseMap(['S..F....'], 1), [rep(10, F())]);
  assert.ok(r.ok); assert.equal(r.state.x, 3);
});

test('умови бачать стіни, воду й межі поля', () => {
  // попереду вода — «вільно» хибне, тож повертаємо, а не падаємо
  const m = parseMap(['S~', '.F'], 1);
  assert.ok(check(m, [iff('ahead', [F()], [R()]), F(), L(), F()]).ok);
});

test('лічильник блоків і зірки', () => {
  assert.equal(countBlocks([rep(3, F(), iff('ahead', [F()], [L(), R()]))]), 6);
  assert.equal(starsFor(4, 4), 3); assert.equal(starsFor(6, 4), 2); assert.equal(starsFor(9, 4), 1);
});
