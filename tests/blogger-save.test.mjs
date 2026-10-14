// Збереження симулятора блогера у файл: ZIP-архів із грою й власними фото та відео.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Sim, newState } from '../emulators/bloggeremu/js/sim.js';
import { packBlogger, unpackBlogger, fileName, summaryOf } from '../emulators/bloggeremu/js/save.js';
import { makeZip, readZip } from '../shared/zip.js';

const game = () => {
  const S = new Sim(newState(7));
  S.s.me = { nick: 'kotyk.art', name: 'Мурчик', bio: '', niche: 'pets', avatar: { color: '#c62828', sym: 'paw', img: 'mPHOTO' }, created: S.s.t, pass: 'x', email: 'k@poshta.ua' };
  S.s.followers = 321; S.s.student = { name: 'Олена Коваль', group: '7-А' };
  S.s.gallery.unshift({ id: 'g1', type: 'photo', own: true, mid: 'mPHOTO', t: S.s.t }, { id: 'g2', type: 'video', own: true, mid: 'mVIDEO', t: S.s.t });
  S.advance(600);
  return S;
};
const bytes = (n, k) => { const b = new Uint8Array(n); for (let i = 0; i < n; i++) b[i] = (i * k) & 255; return b; };
const media = () => [
  { mid: 'mPHOTO', rec: { kind: 'photo', blob: new Blob([bytes(5000, 3)], { type: 'image/jpeg' }), thumb: new Blob([bytes(900, 5)], { type: 'image/jpeg' }), size: 5900, name: 'кіт.jpg' } },
  { mid: 'mVIDEO', rec: { kind: 'video', blob: new Blob([bytes(70000, 7)], { type: 'video/webm' }), thumb: new Blob([bytes(800, 9)], { type: 'image/jpeg' }), frames: [new Blob([bytes(600, 11)], { type: 'image/jpeg' }), new Blob([bytes(700, 13)], { type: 'image/jpeg' })], size: 72100, name: 'кіт.webm' } },
];

test('блогер: у файлі увесь стан і всі власні файли, байт у байт', async () => {
  const S = game(), zip = await packBlogger(S.s, { speed: 10 }, media());
  const r = await unpackBlogger(zip);
  assert.ok(r.ok); assert.equal(r.edited, false); assert.equal(r.missing, 0);
  assert.deepEqual(r.state, JSON.parse(JSON.stringify(S.s)));
  assert.equal(r.ui.speed, 10);
  const src = media();
  for (const [i, m] of r.media.entries()) {
    assert.equal(m.mid, src[i].mid); assert.equal(m.rec.kind, src[i].rec.kind); assert.equal(m.rec.name, src[i].rec.name);
    assert.deepEqual(new Uint8Array(await m.rec.blob.arrayBuffer()), new Uint8Array(await src[i].rec.blob.arrayBuffer()));
    assert.equal(m.rec.blob.type, src[i].rec.blob.type);
    assert.equal(m.rec.frames.length, (src[i].rec.frames || []).length);
  }
  // продовження гри після відкриття — те саме, що й без збереження
  const A = new Sim(r.state), B = new Sim(JSON.parse(JSON.stringify(S.s)));
  A.advance(3000); B.advance(3000);
  assert.deepEqual(A.s, B.s);
});

test('блогер: архів відкривається звичайним архіватором, а перепакований — симулятором', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'blg-')), f = join(dir, 'save.zip');
  writeFileSync(f, Buffer.from(await (await packBlogger(game().s, {}, media())).arrayBuffer()));
  const list = execFileSync('unzip', ['-Z1', f]).toString().trim().split('\n');
  assert.ok(list.includes('game.json') && list.includes('README.txt') && list.includes('media/mPHOTO/original.jpg') && list.includes('media/mVIDEO/original.webm') && list.includes('media/mVIDEO/frame-2.jpg'));
  execFileSync('unzip', ['-tq', f]);
  // учень/викладач розпакував і запакував знову (зі стисненням)
  execFileSync('sh', ['-c', `cd ${dir} && mkdir x && cd x && unzip -q ../save.zip && zip -qr ../again.zip .`]);
  const r = await unpackBlogger(new Blob([readFileSync(join(dir, 'again.zip'))]));
  assert.ok(r.ok, r.error); assert.equal(r.media.length, 2); assert.equal(r.state.me.nick, 'kotyk.art');
  assert.match(readFileSync(join(dir, 'x', 'README.txt'), 'utf8'), /Олена Коваль[\s\S]*@kotyk\.art/);
});

test('блогер: ручні зміни, чужі й пошкоджені файли', async () => {
  const S = game(), zip = await readZip(await packBlogger(S.s, {}, []));
  const g = JSON.parse(await zip.get('game.json').text());
  g.state.followers = 1e6;
  assert.equal((await unpackBlogger(new Blob([JSON.stringify(g)]))).edited, true);
  assert.match((await unpackBlogger(new Blob([JSON.stringify({ app: 'edvault-startup', state: {} })]))).error, /стартапу/);
  assert.equal((await unpackBlogger(new Blob(['не json']))).ok, false);
  assert.match((await unpackBlogger(await makeZip([{ name: 'інше.txt', data: 'x' }]))).error, /немає збереженої гри/);
  assert.equal((await unpackBlogger(new Blob([JSON.stringify({ ...g, format: 99 })]))).ok, false);
  // посилання на файл, якого немає в архіві
  const z2 = await makeZip([{ name: 'game.json', data: JSON.stringify({ ...g, state: S.s, integrity: undefined, media: { mX: { kind: 'photo', blob: { path: 'media/mX/original.jpg' } } } }) }]);
  const r2 = await unpackBlogger(z2); assert.ok(r2.ok); assert.equal(r2.missing, 1);
});

test('блогер: назва файлу й підсумок для викладача', () => {
  const S = game();
  assert.match(fileName(S.s), /^blogger_kotyk-art_Olena-Koval_den-\d+\.zip$/);
  const sm = summaryOf(S.s, 2);
  assert.equal(sm['Учень'], 'Олена Коваль'); assert.equal(sm['Instagram'], '@kotyk.art'); assert.match(sm['Власні фото й відео'], /1 фото, 1 відео \(у файлі: 2\)/);
});
