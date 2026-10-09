// Файли й папки: віртуальна файлова система, рівні, кроки.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFS, createSession, byPath, mkdir, rename, move, copy, remove, restore, emptyBin, search, validName, kindOf, typeName, fmtSize, uniqueName } from '../trainers/filestrainer/js/fs.js';
import { LEVELS, CHAPTERS } from '../trainers/filestrainer/js/levels.js';

test('кожен рівень проходиться еталонним розв’язком, і на старті він не пройдений', () => {
  const ids = new Set();
  for (const l of LEVELS) {
    assert.ok(CHAPTERS.some(c => c.id === l.chapter), l.id);
    assert.ok(!ids.has(l.id)); ids.add(l.id);
    const S = createSession(l);
    assert.equal(S.done(), false, l.id + ': уже пройдений на старті');
    l.solution(S);
    assert.deepEqual(S.goals().filter(g => !g.done).map(g => g.text), [], l.id);
    assert.ok(S.steps >= 1, l.id);
  }
  assert.equal(LEVELS.length, 24);
});

const fsWith = () => createFS({ 'Документи': { 'Школа': { 'вірш.docx': 5 }, 'лист.txt': 1 }, 'Робочий стіл': { 'кіт.jpg': 100 } });
const id = (fs, p) => byPath(fs, p).id;

test('імена: заборонені символи, порожні, дублікати', () => {
  assert.match(validName('a/b'), /символи/);
  assert.match(validName('  '), /порожнім/);
  assert.match(validName('...'), /крапок/);
  assert.equal(validName('Мій звіт.docx'), null);
  const fs = fsWith();
  assert.match(rename(fs, id(fs, 'Документи/лист.txt'), 'ШКОЛА').error, /вже є/);
  assert.match(rename(fs, id(fs, 'Документи'), 'Docs').error, /не можна/);
  assert.ok(rename(fs, id(fs, 'Документи/лист.txt'), 'лист бабусі.txt').node);
  assert.equal(mkdir(fs, id(fs, 'Документи')).node.name, 'Нова папка');
  assert.equal(mkdir(fs, id(fs, 'Документи')).node.name, 'Нова папка (2)');
  assert.equal(uniqueName(byPath(fs, 'Робочий стіл'), 'кіт.jpg', true), 'кіт - копія.jpg');
});

test('переміщення: не в себе, не системні, конфлікт імен', () => {
  const fs = fsWith();
  assert.match(move(fs, [id(fs, 'Документи/Школа')], id(fs, 'Документи/Школа')).error, /саму в себе/);
  assert.match(move(fs, [id(fs, 'Документи')], id(fs, 'Музика')).error, /Системні/);
  assert.ok(move(fs, [id(fs, 'Документи/Школа')], id(fs, 'Документи')).same);
  assert.equal(move(fs, [id(fs, 'Робочий стіл/кіт.jpg'), id(fs, 'Документи/лист.txt')], id(fs, 'Документи/Школа')).moved, 2);
  assert.ok(byPath(fs, 'Документи/Школа/кіт.jpg'));
  copy(fs, [id(fs, 'Документи/Школа/кіт.jpg')], id(fs, 'Зображення'));
  assert.match(move(fs, [id(fs, 'Зображення/кіт.jpg')], id(fs, 'Документи/Школа')).error, /вже є/);
});

test('копіювання й кошик', () => {
  const fs = fsWith();
  const c = copy(fs, [id(fs, 'Документи/Школа')], id(fs, 'Документи')).nodes[0];
  assert.equal(c.name, 'Школа - копія');
  assert.ok(byPath(fs, 'Документи/Школа - копія/вірш.docx'));
  remove(fs, [id(fs, 'Документи/лист.txt')]);
  assert.equal(byPath(fs, 'Документи/лист.txt'), null);
  assert.equal(fs.bin.length, 1);
  restore(fs, [fs.bin[0].node.id]);
  assert.ok(byPath(fs, 'Документи/лист.txt'));
  remove(fs, [id(fs, 'Документи/лист.txt')]);
  assert.equal(emptyBin(fs).removed, 1);
  assert.equal(fs.bin.length, 0);
});

test('пошук: частина імені, *.ext і .ext', () => {
  const fs = createFS({ 'Документи': { 'a.mp3': 1, 'Б': { 'b.MP3': 1, 'mp3-список.txt': 1 } }, 'Музика': { 'c.mp3': 1 } });
  const names = r => r.map(n => n.name).sort();
  assert.deepEqual(names(search(fs, 'root', '*.mp3')), ['a.mp3', 'b.MP3', 'c.mp3']);
  assert.deepEqual(names(search(fs, 'root', '.mp3')), ['a.mp3', 'b.MP3', 'c.mp3']);
  assert.deepEqual(names(search(fs, id(fs, 'Документи'), 'mp3')), ['a.mp3', 'b.MP3', 'mp3-список.txt']);
  assert.deepEqual(search(fs, 'root', '   '), []);
});

test('кроки сесії: помилки й «без змін» не рахуються', () => {
  const S = createSession(LEVELS.find(l => l.id === 'move-1'));
  S.move('Робочий стіл/реферат.docx', 'Робочий стіл');
  assert.equal(S.steps, 0);
  S.rename('Робочий стіл/реферат.docx', 'a:b');
  assert.equal(S.steps, 0);
  S.move('Робочий стіл/реферат.docx', 'Документи');
  assert.equal(S.steps, 1);
  assert.ok(S.done());
});

test('типи й розміри', () => {
  assert.equal(kindOf({ type: 'file', name: 'Фото.JPG' }), 'image');
  assert.equal(typeName({ type: 'file', name: 'звіт.docx' }), 'Документ (DOCX)');
  assert.equal(typeName({ type: 'folder', name: 'x' }), 'Папка');
  assert.equal(fmtSize(512), '512 КБ'); assert.equal(fmtSize(2048), '2,0 МБ');
});
