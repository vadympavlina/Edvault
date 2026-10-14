// Аніматор: модель проєкту, історія, уроки й кодер GIF — без браузера.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Project, History, okMeta, projectFromMeta, MAX_LAYERS } from '../tools/animator-app/js/model.js';
import { encodeGif, inspectGif, decodeFirstFrameIndices, buildPalette } from '../tools/animator-app/js/gif.js';
import { LESSONS } from '../tools/animator-app/js/lessons.js';

// склад клітинок-заглушок: клітинка — об'єкт із «малюнком»-рядком
let n = 0;
const store = { create: () => ({ id: ++n, ink: '' }), clone: c => ({ id: ++n, ink: c.ink }), isEmpty: c => !c.ink };

test('новий проєкт: два шари, один кадр, тривалість від частоти', () => {
  const p = new Project(store, { fps: 8 });
  assert.deepEqual(p.layers.map(l => l.name), ['Фон', 'Персонаж']);
  assert.equal(p.frames.length, 1);
  p.addFrame(); p.addFrame(); p.setHold(1, 3);
  assert.equal(p.totalUnits, 5);
  assert.equal(p.duration, 5 / 8);
  assert.deepEqual([0, 1, 2, 3, 4].map(u => p.frameAt(u)), [0, 1, 1, 1, 2]);
  assert.equal(p.startUnit(2), 4);
});

test('кадри: дублювання копіює малюнки, видалення прибирає клітинки, порядок змінюється', () => {
  const p = new Project(store);
  const L = p.layers[1], f0 = p.frames[0];
  p.ensureCell(L, f0).ink = 'м’яч';
  const f1 = p.duplicateFrame(0);
  assert.equal(p.cell(L, f1).ink, 'м’яч');
  assert.notEqual(p.cell(L, f1), p.cell(L, f0), 'копія, а не та сама клітинка');
  assert.equal(p.cell(p.layers[0], f1), null, 'порожні клітинки не копіюються');
  p.addFrame(2);
  assert.ok(p.moveFrame(2, 0));
  assert.equal(p.frames[1], f0);
  assert.ok(p.deleteFrame(1));
  assert.equal(L.cells.has(f0.id), false);
  assert.equal(p.deleteFrame(0) && p.deleteFrame(0), false, 'останній кадр не видаляється');
});

test('шари: не більше ліміту, останній не видаляється, дублювання', () => {
  const p = new Project(store);
  while (p.addLayer()) { /* до ліміту */ }
  assert.equal(p.layers.length, MAX_LAYERS);
  while (p.deleteLayer(0)) { /* до одного */ }
  assert.equal(p.layers.length, 1);
  p.ensureCell(p.layers[0], p.frames[0]).ink = 'хмара';
  const d = p.duplicateLayer(0);
  assert.equal(d.cells.get(p.frames[0].id).ink, 'хмара');
  assert.ok(p.moveLayer(1, 0));
  assert.equal(p.layers[0], d);
});

test('історія структури: скасування й повтор додавання кадру', () => {
  const p = new Project(store), h = new History();
  const apply = (s, dir) => p.restoreStruct(dir === 'undo' ? s.before : s.after);
  const before = p.structSnapshot(); p.addFrame(); p.addFrame(); const after = p.structSnapshot();
  h.push({ kind: 'struct', before, after });
  assert.equal(p.frames.length, 3);
  h.undo(apply); assert.equal(p.frames.length, 1);
  h.redo(apply); assert.equal(p.frames.length, 3);
  assert.equal(h.canRedo, false);
  const h2 = new History(3); for (let i = 0; i < 5; i++) h2.push({ i });
  assert.deepEqual(h2.undoStack.map(s => s.i), [2, 3, 4], 'старі кроки відкидаються');
});

test('файл: опис перевіряється й відновлюється в проєкт', () => {
  const p = new Project(store, { title: 'Ракета', author: 'Олена Коваль', fps: 12 });
  p.ensureCell(p.layers[1], p.frames[0]).ink = 'ракета';
  p.addFrame(); p.setHold(1, 2);
  const m = JSON.parse(JSON.stringify(p.meta()));
  assert.ok(okMeta(m));
  assert.deepEqual(m.layers[1].cells, [p.frames[0].id]);
  assert.deepEqual(m.layers[0].cells, [], 'порожні клітинки не пишуться');
  const q = projectFromMeta(store, m, (lm, fid) => ({ id: ++n, ink: lm.name + ':' + fid }));
  assert.equal(q.title, 'Ракета'); assert.equal(q.fps, 12); assert.equal(q.frames[1].hold, 2);
  assert.equal(q.layers[1].cells.get(p.frames[0].id).ink, 'Персонаж:' + p.frames[0].id);
  assert.equal(okMeta({ ...m, app: 'edvault-startup' }), false);
  assert.equal(okMeta({ ...m, frames: [] }), false);
  assert.equal(okMeta({ ...m, layers: [{ name: 'x', cells: ['чужий'] }] }), false);
});

test('уроки: напрямні для кожного кадру', () => {
  for (const [id, L] of Object.entries(LESSONS)) {
    const g = L.guides(960, 540);
    assert.equal(g.length, L.frames, id);
    assert.ok(g.every(fr => Array.isArray(fr) && fr.length), id);
    assert.ok(L.steps.length >= 3 && L.title && L.goal, id);
  }
  const ball = LESSONS.ball.guides(960, 540).map(fr => fr.find(s => s.type === 'ellipse'));
  assert.ok(ball[0].rx > ball[0].ry, 'на землі м’ячик сплющений');
  assert.ok(ball.every((b, i) => i === 0 || b.x > ball[i - 1].x), 'рух зліва направо');
});

// RGBA-кадр, залитий кольором, з квадратом іншого кольору
function frame(w, h, bg, sq, at) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = x >= at && x < at + 4 && y >= 2 && y < 6 ? sq : bg, i = (y * w + x) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  return d;
}

test('GIF: заголовок, кадри, затримки, нескінченний повтор; LZW розкодовується назад', () => {
  const w = 20, h = 10, white = [255, 255, 255], red = [239, 68, 68];
  const frames = [0, 4, 8, 12].map(at => ({ data: frame(w, h, white, red, at), delay: 125 }));
  const gif = encodeGif(w, h, frames);
  const info = inspectGif(gif);
  assert.deepEqual([info.width, info.height, info.frames, info.loop], [20, 10, 4, 0]);
  assert.deepEqual(info.delays, [130, 130, 130, 130]);
  // перший кадр — повний: червоний квадрат на білому
  const pal = buildPalette(frames.map(f => f.data));
  const d = decodeFirstFrameIndices(gif);
  assert.equal(d.idx.length, w * h);
  const at = (x, y) => pal[d.idx[y * w + x]];
  assert.deepEqual(at(0, 0), white); assert.deepEqual(at(1, 3), red);
});

test('GIF: багато кольорів стискаються до палітри, великий кадр кодується', () => {
  const w = 120, h = 80, d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { d[i * 4] = (i * 7) & 255; d[i * 4 + 1] = (i * 13) & 255; d[i * 4 + 2] = (i * 29) & 255; d[i * 4 + 3] = 255; }
  const pal = buildPalette([d], 255);
  assert.ok(pal.length <= 255 && pal.length > 100);
  const gif = encodeGif(w, h, [{ data: d, delay: 100 }, { data: d, delay: 100 }]);
  const info = inspectGif(gif);
  assert.equal(info.frames, 2);
  assert.equal(decodeFirstFrameIndices(gif).idx.length, w * h, 'LZW з переповненням словника');
  assert.ok(gif.length < w * h * 1.6);
});
