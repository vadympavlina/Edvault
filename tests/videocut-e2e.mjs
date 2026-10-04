// Браузерна перевірка відеоредактора (потрібен Playwright і Chromium).
//   node tests/videocut-e2e.mjs            — сервер піднімається сам
// Змінні: PLAYWRIGHT_MODULE (шлях до playwright), CHROME (шлях до chromium), FFMPEG (за замовчуванням ffmpeg)
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname, resolve } from 'node:path';
import assert from 'node:assert/strict';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const tmp = await mkdtemp(join(tmpdir(), 'vc-'));
const video = join(tmp, 'v.webm'), audio = join(tmp, 'a.webm');
const ff = (...a) => execFileSync(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', ...a]);
ff('-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=30:duration=12', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=12', '-c:v', 'libvpx', '-b:v', '800k', '-c:a', 'libopus', '-shortest', video);
ff('-f', 'lavfi', '-i', 'sine=frequency=300:duration=6', '-c:a', 'libopus', audio);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const srv = createServer(async (q, r) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); r.setHeader('content-type', MIME[extname(f)] || 'application/octet-stream'); r.end(await readFile(f)); } catch { r.statusCode = 404; r.end(); }
}).listen(0);
const port = srv.address().port;

const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1300, height: 760 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.goto(`http://localhost:${port}/tools/videocut.html`);
const VC = fn => page.evaluate(fn);
let n = 0;
const step = async (name, fn) => { try { await fn(); console.log('ok  ', ++n, name); } catch (e) { console.log('FAIL', ++n, name, '\n   ', e.message); process.exitCode = 1; } };

await page.setInputFiles('#fileInput', video);
await page.waitForFunction(() => window.VideoCut?.S.project.clips.length > 0, null, { timeout: 20000 });
await page.waitForTimeout(1500);

await step('вирізання шматка не дублює перехід усередині кліпу', async () => {
  await VC(() => { const V = window.VideoCut; V.S.project.clips[0].tr = { type: 'fade', d: 0.6 }; V.commit(); V.S.markIn = 3; V.S.markOut = 5; });
  await page.keyboard.press('KeyX');
  const trs = await VC(() => window.VideoCut.S.project.clips.map(c => !!c.tr));
  assert.equal(trs.length, 2);
  assert.deepEqual(trs, [true, false]);
});

await step('прокрутка панелі властивостей не скидається після змін', async () => {
  await page.locator('.it.clip').first().click();
  await page.evaluate(() => { document.getElementById('inspector').scrollTop = 1e5; });
  const before = await page.evaluate(() => document.getElementById('inspector').scrollTop);
  assert.ok(before > 0, 'панель має прокручуватися');
  for (let i = 0; i < 4; i++) { await page.locator('#inspector [data-toggle]').first().dispatchEvent('click'); await page.waitForTimeout(250); }
  assert.equal(await page.evaluate(() => document.getElementById('inspector').scrollTop), before);
});

await step('вікно автосубтитрів пропонує джерела звуку', async () => {
  await page.setInputFiles('#fileInput', audio);
  await page.waitForTimeout(800);
  await page.evaluate(() => document.activeElement.blur());
  await page.evaluate(() => window.dispatchEvent(new Event('x')));
  await page.evaluate(() => document.querySelector('[data-m="4"]').click());
  await page.locator('.mb-it', { hasText: 'Субтитри з мовлення' }).click();
  const opts = await page.$$eval('#asrSources input', a => a.map(i => [i.value, !i.disabled]));
  assert.deepEqual(Object.fromEntries(opts).speech, true);
  assert.deepEqual(Object.fromEntries(opts).music, true);
  assert.deepEqual(Object.fromEntries(opts).voice, false);
  await page.keyboard.press('Escape');
});

await step('Скасувати після видалення файлу повертає кліпи разом із файлом', async () => {
  await page.evaluate(() => document.activeElement.blur());
  await page.locator('[data-tab="media"]').click();
  const id = await page.evaluate(() => [...window.VideoCut.media.values()].find(m => m.kind === 'video').id);
  await page.evaluate(() => { document.querySelector('.mcard [data-act="rm"]').click(); });
  await page.locator('#confirmYes').click();
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(i => window.VideoCut.media.has(i), id), false);
  await page.keyboard.press('Control+KeyZ');
  await page.waitForFunction(i => window.VideoCut.media.has(i), id, { timeout: 8000 });
  assert.ok(await page.evaluate(() => window.VideoCut.S.project.clips.length > 0));
});

await step('проєкт зберігається у файл і відкривається назад', async () => {
  const dl = page.waitForEvent('download');
  await page.evaluate(() => document.querySelector('[data-m="0"]').click());
  await page.locator('.mb-it', { hasText: 'Зберегти проєкт у файл' }).click();
  const d = await dl;
  const path = join(tmp, 'p.evproj');
  await d.saveAs(path);
  const before = await VC(() => ({ clips: window.VideoCut.S.project.clips.length, media: window.VideoCut.media.size }));
  await page.evaluate(() => document.querySelector('[data-m="0"]').click());
  await page.locator('.mb-it', { hasText: 'Новий проєкт' }).click();
  await page.locator('#confirmYes').click();
  assert.equal(await VC(() => window.VideoCut.S.project.clips.length), 0);
  await page.setInputFiles('#projInput', path);
  await page.waitForFunction(b => window.VideoCut.S.project.clips.length === b.clips && window.VideoCut.media.size === b.media, before, { timeout: 15000 });
});

await step('жодної помилки в консолі сторінки', async () => assert.deepEqual(errors, []));

await browser.close(); srv.close();
