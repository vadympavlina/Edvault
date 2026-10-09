// Каталоги /tools/ і /trainers/: кожна сторінка в списку, нічого не загубилося, кількість рівнів правдива.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { TOOLS, TOOL_CATEGORIES, TRAINERS, TRAINER_CATEGORIES, trainerProgress } from '../assets/catalog-data.js';

const ROOT = new URL('..', import.meta.url).pathname;
const pages = dir => readdirSync(ROOT + dir).filter(f => f.endsWith('.html') && f !== 'index.html').sort();

test('кожна сторінка з tools/ і trainers/ є в каталозі, і навпаки', () => {
  assert.deepEqual(TOOLS.map(t => t.file).sort(), pages('tools'));
  assert.deepEqual(TRAINERS.map(t => t.file).sort(), pages('trainers'));
});

test('без конфліктів адрес без .html: поруч зі сторінкою немає папки з такою самою назвою', () => {
  for (const [dir, list] of [['tools', TOOLS], ['trainers', TRAINERS]])
    for (const t of list) assert.ok(!existsSync(`${ROOT}${dir}/${t.file.replace(/\.html$/, '')}`), `${dir}/${t.file}`);
});

test('поля, категорії й іконки на місці', () => {
  for (const [list, cats] of [[TOOLS, TOOL_CATEGORIES], [TRAINERS, TRAINER_CATEGORIES]]) {
    const ids = new Set();
    for (const t of list) {
      assert.ok(!ids.has(t.id), t.id); ids.add(t.id);
      assert.ok(t.name && t.desc && t.icon && /^#[0-9a-f]{6}$/i.test(t.accent), t.id);
      assert.ok(cats.some(c => c.id === t.cat), t.id + ': невідома категорія');
      assert.ok(existsSync(`${ROOT}icons/${t.file.replace(/\.html$/, '')}.svg`), t.id + ': немає іконки');
    }
    for (const c of cats) assert.ok(list.some(t => t.cat === c.id), c.id + ': порожня категорія');
  }
});

test('кількість рівнів тренажерів збігається з їхніми файлами рівнів', async () => {
  const count = {
    'pen-trainer': (await import('../trainers/pentrainer/js/levels.js')).LEVELS.length,
    'color-trainer': (await import('../trainers/colortrainer/js/levels.js')).LEVELS.length,
    'typing-trainer': Object.values((await import('../trainers/typingtrainer/js/lessons.js')).LEVELS).reduce((s, l) => s + l.length, 0),
    'robot': (await import('../trainers/robot-app/js/levels.js')).LEVELS.length,
    'mouse-trainer': (await import('../trainers/mousetrainer/js/levels.js')).LEVELS.length,
    'files-trainer': (await import('../trainers/filestrainer/js/levels.js')).LEVELS.length,
    'safety-trainer': (await import('../trainers/safetytrainer/js/levels.js')).LEVELS.length,
    'hotkeys-trainer': (await import('../trainers/hotkeystrainer/js/levels.js')).LEVELS.length,
  };
  for (const t of TRAINERS) assert.equal(t.levels, count[t.id], t.id);
});

test('прогрес тренажера читається з його сховища', () => {
  const mem = { 'edvault-robot': JSON.stringify({ best: { a: { stars: 3 }, b: { stars: 1 }, c: { stars: 0 } } }), 'edvault-typing': JSON.stringify({ best: { uk: { a: { stars: 2 } }, en: { b: { stars: 3 } } } }), 'edvault-files': 'зламано' };
  const storage = { getItem: k => mem[k] ?? null };
  const T = id => TRAINERS.find(t => t.id === id);
  assert.deepEqual(trainerProgress(T('robot'), storage), { stars: 4, max: 72, passed: 2, levels: 24 });
  assert.equal(trainerProgress(T('typing-trainer'), storage).stars, 5);
  assert.equal(trainerProgress(T('files-trainer'), storage).passed, 0);
  assert.equal(trainerProgress(T('pen-trainer'), storage).stars, 0);
});
