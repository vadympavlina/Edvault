// Гарячі клавіші: розбір комбінацій, розпізнавання натискань, бали, цілісність рівнів.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCombo, matches, comboKeys, comboLabel, pressedKeys, scorePress, starsFor } from '../trainers/hotkeystrainer/js/logic.js';
import { LEVELS, CHAPTERS } from '../trainers/hotkeystrainer/js/levels.js';

const ev = (code, mods = {}) => ({ code, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...mods });

test('розбір комбінацій', () => {
  assert.deepEqual(parseCombo('Ctrl+Shift+Z'), { ctrl: true, shift: true, alt: false, win: false, key: 'Z', code: 'KeyZ' });
  assert.equal(parseCombo('F5').code, 'F5');
  assert.equal(parseCombo('Ctrl+=').code, 'Equal');
  assert.equal(parseCombo('Ctrl+-').code, 'Minus');
  assert.equal(parseCombo('Ctrl+←').code, 'ArrowLeft');
  assert.equal(parseCombo('Win+Shift+S').win, true);
  assert.throws(() => parseCombo('Ctrl+Щ'));
  assert.equal(comboLabel('Ctrl+-'), 'Ctrl + −');
  assert.deepEqual(comboKeys('Alt+F4'), ['Alt', 'F4']);
});

test('натискання розпізнаються за фізичною клавішею — і з українською розкладкою', () => {
  assert.ok(matches(ev('KeyC', { ctrlKey: true, key: 'с' }), 'Ctrl+C'));
  assert.ok(matches(ev('KeyC', { metaKey: true }), 'Ctrl+C'), 'Cmd на Mac');
  assert.ok(!matches(ev('KeyC', { ctrlKey: true, shiftKey: true }), 'Ctrl+C'), 'зайвий Shift');
  assert.ok(!matches(ev('KeyC'), 'Ctrl+C'), 'без Ctrl');
  assert.ok(matches(ev('NumpadAdd', { ctrlKey: true }), 'Ctrl+='), '«+» на цифровому блоці');
  assert.ok(matches(ev('Home'), 'Home'));
  assert.ok(!matches(ev('Home', { ctrlKey: true }), 'Home'));
  assert.deepEqual(pressedKeys(ev('KeyZ', { ctrlKey: true, shiftKey: true })), ['Ctrl', 'Shift', 'Z']);
  assert.deepEqual(pressedKeys(ev('ControlLeft', { ctrlKey: true })), ['Ctrl']);
});

test('бали й зірки', () => {
  assert.equal(scorePress({}), 1);
  assert.equal(scorePress({ wrong: 1 }), 0.5);
  assert.equal(scorePress({ hint: true }), 0.5);
  assert.equal(scorePress({ wrong: 3 }), 0);
  assert.equal(scorePress({ gaveUp: true, hint: true }), 0);
  assert.equal(starsFor(1), 3); assert.equal(starsFor(0.75), 2); assert.equal(starsFor(0.3), 1);
});

const ACTS = {
  doc: ['copy', 'paste', 'cut', 'undo', 'redo', 'selectAll', 'bold', 'italic', 'underline', 'save', 'print', 'find', 'home', 'end', 'docStart', 'docEnd', 'wordLeft', 'selRight', 'selEnd', 'delWord'],
  browser: ['zoomIn', 'zoomOut', 'zoom0', 'reload', 'address', 'bookmark', 'history', 'downloads', 'find'],
  files: ['rename', 'delete', 'undo', 'selectAll'],
};
// комбінації, які браузер не віддає сторінці, — лише у «вибери відповідь»
const RESERVED = ['Ctrl+T', 'Ctrl+W', 'Ctrl+N', 'Ctrl+Shift+T', 'Ctrl+Shift+N', 'Ctrl+Tab', 'Alt+Tab', 'Alt+F4', 'PrtSc'];

test('рівні цілісні: пам’ятка, дія на макеті, одна правильна відповідь', () => {
  const ids = new Set();
  for (const l of LEVELS) {
    assert.ok(CHAPTERS.some(c => c.id === l.chapter), l.id);
    assert.ok(!ids.has(l.id)); ids.add(l.id);
    assert.equal(l.tips.length, 3, l.id);
    assert.ok(l.tasks.length >= 3 && l.tasks.length <= 7, l.id);
    for (const [k, t] of l.tasks.entries()) {
      const at = `${l.id} #${k + 1}`;
      assert.ok(t.q, at);
      if (t.kind === 'press') {
        const c = parseCombo(t.combo);
        assert.ok(!c.win && !RESERVED.includes(t.combo), at + ': цю комбінацію браузер не віддасть');
        assert.ok(ACTS[l.scene]?.includes(t.act), at + ': невідома дія ' + t.act);
      } else {
        assert.equal(t.kind, 'choice', at);
        assert.equal(t.options.filter(o => o.ok).length, 1, at);
        for (const o of t.options) { assert.ok(o.why, at); if (o.k) parseCombo(o.k); }
      }
    }
  }
  assert.equal(LEVELS.length, 20);
});
