// UI/UX-дизайнер: контраст WCAG, макети, цілісність рівнів, розв’язність завдань «Виправ сам».
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { contrast, hexToRgb, contrastLevel, starsFor, fixScore } from '../trainers/uiuxtrainer/js/logic.js';
import { mock, partsOf } from '../trainers/uiuxtrainer/js/mocks.js';
import { LEVELS, CHAPTERS } from '../trainers/uiuxtrainer/js/levels.js';

test('контраст за WCAG', () => {
  assert.deepEqual(hexToRgb('#fff'), [255, 255, 255]);
  assert.equal(Math.round(contrast('#000000', '#ffffff')), 21);
  assert.equal(contrast('#777', '#777'), 1);
  assert.ok(Math.abs(contrast('#6b7280', '#ffffff') - 4.83) < 0.05);
  assert.ok(contrast('#9ca3af', '#ffffff') < 3);
  assert.equal(contrastLevel(5), 'добре');
  assert.equal(contrastLevel(2), 'погано');
  assert.throws(() => hexToRgb('синій'));
  assert.equal(starsFor(1), 3); assert.equal(starsFor(0.8), 2); assert.equal(fixScore(true), 0.5);
});

test('макет: частини позначені для клацання, текст екранується', () => {
  const html = mock({ blocks: [{ t: 'h', text: '<b>Привіт</b>', p: 'title' }, { t: 'btn', text: 'Далі', p: 'btn' }] });
  assert.match(html, /data-p="title"/);
  assert.match(html, /&lt;b&gt;/);
  assert.deepEqual(partsOf({ blocks: [{ t: 'row', items: [{ t: 'price', p: 'price' }, { t: 'btn', p: 'btn' }] }] }), ['price', 'btn']);
});

// усі комбінації перемикачів (повзунок — кожен крок)
function* states(controls, base) {
  if (!controls.length) { yield { ...base }; return; }
  const [c, ...rest] = controls;
  const vals = c.type === 'toggle' ? [false, true] : c.type === 'range' ? Array.from({ length: (c.max - c.min) / c.step + 1 }, (_, i) => c.min + i * c.step) : c.type === 'swatch' ? c.options : c.options.map(x => x[0]);
  for (const v of vals) yield* states(rest, { ...base, [c.k]: v });
}

test('рівні: 5 розділів по 4, пам’ятка, макети будуються, позначки існують, «Виправ сам» розв’язне', () => {
  assert.equal(LEVELS.length, 20);
  assert.equal(new Set(LEVELS.map(l => l.id)).size, 20);
  for (const ch of CHAPTERS) assert.equal(LEVELS.filter(l => l.chapter === ch.id).length, 4, ch.id);
  for (const l of LEVELS) {
    assert.equal(l.tips.length, 3, l.id);
    assert.ok(l.tasks.length >= 2, l.id);
    for (const [k, t] of l.tasks.entries()) {
      const at = `${l.id} #${k + 1}`;
      assert.ok(t.q, at);
      if (t.kind === 'pair') {
        assert.ok(['a', 'b'].includes(t.ok), at);
        mock(t.a); mock(t.b);
        assert.ok(t.why && t.marks.length, at + ': потрібні пояснення й позначки');
        const worse = partsOf(t.ok === 'a' ? t.b : t.a);
        for (const m of t.marks) assert.ok(worse.includes(m.p), `${at}: немає частини «${m.p}» у гіршому макеті`);
        assert.notEqual(mock(t.a), mock(t.b), at + ': макети однакові');
      } else if (t.kind === 'spot') {
        const parts = partsOf(t.mock);
        for (const b of [t.bad].flat()) assert.ok(parts.includes(b), `${at}: немає частини «${b}»`);
        assert.ok(parts.length >= 3, at + ': мало варіантів для клацання');
        mock(t.mock);
      } else if (t.kind === 'choice') {
        assert.equal(t.options.filter(x => x.ok).length, 1, at);
        if (t.mock) mock(t.mock);
      } else if (t.kind === 'fix') {
        assert.ok(t.checks.some(c => !c.ok(t.state)), at + ': уже розв’язано на старті');
        let solvable = false;
        for (const s of states(t.controls, t.state)) { mock(t.build(s)); if (t.checks.every(c => c.ok(s))) solvable = true; }
        assert.ok(solvable, at + ': немає розв’язку');
        assert.ok(t.hint, at);
      } else assert.fail(at + ': невідомий вид ' + t.kind);
    }
  }
});
