// Сліпий друк: розкладки, вправи, підсумки й зірки.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUTS, keyFor, shiftFor, normChar } from '../trainers/typingtrainer/js/layouts.js';
import { LEVELS, CHAPTERS, makeText, lettersUpTo, summary, starsFor, weakText } from '../trainers/typingtrainer/js/lessons.js';
import { SENTENCES, PROVERBS, TEXTS } from '../trainers/typingtrainer/js/words.js';

const rng = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

test('розкладки: клавіші й пальці', () => {
  assert.deepEqual(keyFor('uk', 'а'), { code: 'KeyF', shift: false, finger: 3 });
  assert.deepEqual(keyFor('uk', 'О'), { code: 'KeyJ', shift: true, finger: 4 });
  assert.equal(keyFor('uk', ',').code, 'Slash');
  assert.equal(keyFor('uk', ',').shift, true);
  assert.equal(keyFor('en', ';').code, 'Semicolon');
  assert.equal(keyFor('en', ' ').code, 'Space');
  assert.equal(shiftFor(3), 'ShiftRight'); assert.equal(shiftFor(4), 'ShiftLeft');
  assert.equal(normChar('’'), '\''); assert.equal(normChar('ʼ'), '\'');
});

test('кожен символ у готових текстах можна надрукувати', () => {
  for (const k of Object.keys(LAYOUTS)) {
    for (const t of [...SENTENCES[k], ...PROVERBS[k], ...TEXTS[k]]) {
      const missing = [...t.replace(/[—–]/g, '-')].filter(c => !keyFor(k, normChar(c)));
      assert.deepEqual(missing, [], k + ': ' + t);
    }
  }
});

test('вправи на клавіші: лише вивчені літери й обов’язково нові', () => {
  for (const k of Object.keys(LAYOUTS)) {
    LEVELS[k].forEach((l, i) => {
      for (let n = 0; n < 15; n++) {
        const t = makeText(k, i, rng(n * 131 + i));
        assert.ok(t.length >= 60, `${k} ${l.id}: закороткий текст`);
        assert.ok([...t].every(c => keyFor(k, normChar(c))), `${k} ${l.id}: символ поза розкладкою`);
        if (l.kind === 'keys' || l.kind === 'words') {
          const allowed = lettersUpTo(k, i) + ' ';
          const bad = [...t].filter(c => !allowed.includes(c));
          assert.deepEqual(bad, [], `${k} ${l.id}: невивчені літери`);
        }
        if (l.kind === 'keys') {
          const focus = l.keys.replace(/[;.,/]/g, '');
          if (focus) assert.ok([...focus].some(c => t.includes(c)), `${k} ${l.id}: немає нових літер`);
        }
        if (l.kind === 'caps') assert.match(t, /\p{Lu}/u);
        if (l.kind === 'digits') assert.match(t, /\d/);
        if (l.kind === 'apos') assert.match(t, /'/);
      }
    });
    // уся абетка вивчена до кінця розділу «Нижній ряд»
    const idx = LEVELS[k].findIndex(l => l.id === 'bottom-words');
    const abc = k === 'uk' ? 'абвгдеєжзиіїйклмнопрстуфхцчшщьюя' : 'abcdefghijklmnopqrstuvwxyz';
    assert.deepEqual([...abc].filter(c => !lettersUpTo(k, idx).includes(c)), [], k + ': не всі літери вивчено');
  }
});

test('швидкість, точність і зірки', () => {
  assert.deepEqual(summary({ chars: 120, strokes: 125, errors: 5, ms: 60000 }), { cpm: 120, wpm: 24, acc: 96 });
  assert.equal(summary({ chars: 10, strokes: 0, errors: 0, ms: 10 }).acc, 100);
  const ch = CHAPTERS[0];
  assert.equal(starsFor(ch.id, 200, 85), 0, 'точність понад усе');
  assert.equal(starsFor(ch.id, 10, 92), 1);
  assert.equal(starsFor(ch.id, ch.cpm * 0.8, 95), 2);
  assert.equal(starsFor(ch.id, ch.cpm, 97), 3);
});

test('вправа зі слабких клавіш містить ці клавіші', () => {
  const t = weakText('uk', 'жє', rng(5));
  assert.ok(t.length >= 100 && /[жє]/.test(t));
});
