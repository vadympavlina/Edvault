// Каталоги /tools/ і /trainers/: записи узгоджені, а картки ведуть на окремі сайти інструментів і тренажерів.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { TOOLS_SITE, TRAINERS_SITE, TOOLS, TOOL_CATEGORIES, TRAINERS, TRAINER_CATEGORIES } from '../assets/catalog-data.js';
import { hrefOf } from '../assets/catalog.js';

const ROOT = new URL('..', import.meta.url).pathname;
const pages = dir => readdirSync(ROOT + dir).filter(f => f.endsWith('.html') && f !== 'index.html').sort();

test('у tools/ і trainers/ лишилися тільки каталоги', () => {
  assert.deepEqual(pages('tools'), []);
  assert.deepEqual(pages('trainers'), []);
});

test('картки ведуть на окремі сайти', () => {
  for (const site of [TOOLS_SITE, TRAINERS_SITE]) assert.match(site, /^https:\/\/.+\/$/);
  for (const t of TOOLS) assert.equal(hrefOf('tools', t), TOOLS_SITE + t.file);
  for (const t of TRAINERS) assert.equal(hrefOf('trainers', t), TRAINERS_SITE + t.file);
});

test('поля й категорії на місці', () => {
  for (const [list, cats] of [[TOOLS, TOOL_CATEGORIES], [TRAINERS, TRAINER_CATEGORIES]]) {
    const ids = new Set();
    for (const t of list) {
      assert.ok(!ids.has(t.id), t.id); ids.add(t.id);
      assert.ok(t.name && t.desc && t.icon && /^#[0-9a-f]{6}$/i.test(t.accent) && /\.html$/.test(t.file), t.id);
      assert.ok(cats.some(c => c.id === t.cat), t.id + ': невідома категорія');
    }
    for (const c of cats) assert.ok(list.some(t => t.cat === c.id), c.id + ': порожня категорія');
  }
  for (const t of TRAINERS) assert.ok(Number.isInteger(t.levels) && t.levels > 0, t.id + ': кількість рівнів');
});
