// Браузерна перевірка конвертера зображень (потрібні Playwright і Chromium).
//   node tests/imgconv-e2e.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startServer, launch, newPage, step } from './_harness.mjs';

const server = await startServer();
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1300, height: 860 }, acceptDownloads: true });
const page = await newPage(ctx, errors);
await page.goto(server.url + '/tools/image-convert.html');
await page.waitForFunction(() => window.ImgConv);

// тестові файли малюємо в самому браузері: «фото» з шумом, PNG з прозорістю
const files = await page.evaluate(async () => {
  const make = async (w, h, type, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const b = await new Promise(r => c.toBlob(r, type, 0.95));
    return [...new Uint8Array(await b.arrayBuffer())];
  };
  const photo = await make(2400, 1600, 'image/jpeg', (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#1e3a8a'); g.addColorStop(1, '#f59e0b'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { x.fillStyle = `hsl(${i * 37 % 360} 70% 50% / .5)`; x.fillRect((i * 97) % w, (i * 61) % h, 18, 18); }
  });
  const logo = await make(600, 400, 'image/png', (x) => {
    x.fillStyle = '#4F6BF4'; x.beginPath(); x.arc(300, 200, 150, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.font = 'bold 90px sans-serif'; x.fillText('Ed', 230, 230);
  });
  return { photo, logo };
});
const svg = '<?xml version="1.0"?><!-- з редактора --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><metadata>x</metadata>\n  <circle cx="12.0000001" cy="12" r="10" fill="#10b981"/></svg>';

const items = () => page.evaluate(() => window.ImgConv.items.map(it => ({ name: it.name, status: it.status, err: it.err, size: it.size, out: it.out && { fmt: it.out.fmt, w: it.out.w, h: it.out.h, size: it.out.size, type: it.out.blob.type, note: it.out.note } })));
const settle = () => page.waitForFunction(() => window.ImgConv.items.length && window.ImgConv.items.every(it => it.status === 'done' || it.status === 'err'), null, { timeout: 30000 });
const byName = async n => (await items()).find(i => i.name.startsWith(n));
const clickFmt = async k => { await page.click(`[data-fmt="${k}"]`); await page.waitForTimeout(450); await settle(); };

await step('порожній стан: зона для файлів, налаштування', async () => {
  assert.equal(await page.isVisible('#drop'), true);
  assert.equal(await page.locator('#fmt button').count(), 6);
  assert.equal(await page.locator('#presets .preset').count(), 5);
});

await step('три файли через вибір: JPG, PNG з прозорістю, SVG', async () => {
  await page.setInputFiles('#fileInput', [
    { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(files.photo) },
    { name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(files.logo) },
    { name: 'icon.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) },
  ]);
  await settle();
  const all = await items();
  assert.equal(all.length, 3);
  assert.ok(all.every(i => i.status === 'done'), JSON.stringify(all.map(i => i.err)));
});

await step('«Як є»: формат той самий, PNG стиснуто з прозорістю, SVG очищено', async () => {
  const p = await byName('photo'), l = await byName('logo'), s = await byName('icon');
  assert.equal(p.out.fmt, 'jpeg'); assert.ok(p.out.size < p.size, 'JPG став меншим');
  assert.equal(l.out.fmt, 'png'); assert.ok(l.out.size < l.size, 'PNG став меншим: ' + l.size + ' → ' + l.out.size);
  const alpha = await page.evaluate(async () => {
    const it = window.ImgConv.items.find(i => i.name === 'logo.png');
    const b = await createImageBitmap(it.out.blob); const c = new OffscreenCanvas(b.width, b.height); const x = c.getContext('2d'); x.drawImage(b, 0, 0);
    return [x.getImageData(5, 5, 1, 1).data[3], x.getImageData(300, 120, 1, 1).data[3]];
  });
  assert.deepEqual(alpha, [0, 255]);
  assert.equal(s.out.fmt, 'svg');
  const text = await page.evaluate(() => window.ImgConv.items.find(i => i.name === 'icon.svg').out.blob.text());
  assert.doesNotMatch(text, /metadata|<!--|<\?xml/);
  assert.match(text, /cx="12\.000"/);
});

await step('швидке налаштування «Для сайту»: WebP, ширина до 1920', async () => {
  await page.click('[data-preset="web"]'); await page.waitForTimeout(450); await settle();
  const p = await byName('photo'), s = await byName('icon');
  assert.equal(p.out.type, 'image/webp'); assert.equal(p.out.w, 1920); assert.equal(p.out.h, 1280);
  assert.equal(s.out.type, 'image/webp'); assert.equal(s.out.w, 1920, 'SVG малюється чітко в потрібному розмірі');
  assert.equal(await page.locator('[data-preset="web"].on').count(), 1);
});

await step('обрізати 512×512 у JPG', async () => {
  await page.click('[data-fmt="jpeg"]');
  await page.click('[data-rs="exact"]'); await page.click('[data-wh="512x512"]'); await page.waitForTimeout(450); await settle();
  const p = await byName('photo'), l = await byName('logo');
  assert.deepEqual([p.out.w, p.out.h, p.out.type], [512, 512, 'image/jpeg']);
  assert.deepEqual([l.out.w, l.out.h], [400, 400], 'маленьке не збільшується');
});

await step('не більше 30 КБ: якість підбирається сама', async () => {
  await page.click('[data-rs="none"]');
  await page.check('#targetOn'); await page.fill('#targetKb', '30'); await page.waitForTimeout(450); await settle();
  const p = await byName('photo');
  assert.ok(p.out.size <= 30 * 1024 || p.out.note, 'розмір ' + p.out.size);
  assert.equal(p.out.w, 2400);
  await page.uncheck('#targetOn');
});

await step('поворот праворуч міняє ширину й висоту', async () => {
  await page.click('[data-rot="90"]'); await page.waitForTimeout(450); await settle();
  const p = await byName('photo');
  assert.deepEqual([p.out.w, p.out.h], [1600, 2400]);
  await page.click('[data-rot="-90"]'); await page.waitForTimeout(450); await settle();
});

await step('ICO: іконка сайту з кількома розмірами', async () => {
  await clickFmt('ico');
  const l = await byName('logo');
  assert.equal(l.out.fmt, 'ico');
  const head = await page.evaluate(async () => [...new Uint8Array(await window.ImgConv.items.find(i => i.name === 'logo.png').out.blob.slice(0, 6).arrayBuffer())]);
  assert.deepEqual(head.slice(0, 4), [0, 0, 1, 0]);
  assert.equal(head[4], 4, '16, 32, 48, 256');
});

await step('PNG без стиснення палітри: без втрат', async () => {
  await clickFmt('png');
  await page.uncheck('#png8'); await page.waitForTimeout(450); await settle();
  assert.equal((await byName('photo')).out.type, 'image/png');
  await page.check('#png8'); await page.waitForTimeout(450); await settle();
});

await step('порівняння до/після відкривається і закривається Esc', async () => {
  await page.click('.row [data-act="cmp"].btn');
  assert.equal(await page.isVisible('#cmp'), true);
  const box = await page.locator('#cmpBox').boundingBox();
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height / 2);
  assert.match(await page.evaluate(() => document.getElementById('cmpB').style.clipPath), /inset\(0px 0px 0px 2\d/);
  await page.keyboard.press('Escape');
  assert.equal(await page.isVisible('#cmp'), false);
});

await step('ZIP з усіма файлами і своїми назвами', async () => {
  await page.click('[data-preset="web"]'); await page.waitForTimeout(450); await settle();
  await page.locator('summary').click();
  await page.fill('#namePat', '{name}-{w}');
  const dl = page.waitForEvent('download');
  await page.click('#zipBtn');
  const d = await dl;
  assert.equal(d.suggestedFilename(), 'images.zip');
  const z = await readFile(await d.path());
  assert.equal(z.readUInt32LE(0), 0x04034b50);
  const end = z.length - 22;
  assert.equal(z.readUInt16LE(end + 10), 3);
  assert.match(z.toString('utf8'), /photo-1920\.webp/);
});

await step('прибрати файл і вставити з буфера (Ctrl+V)', async () => {
  await page.click('.row[data-id] [data-act="rm"]');
  assert.equal((await items()).length, 2);
  await page.evaluate(async bytes => {
    const dt = new DataTransfer(); dt.items.add(new File([new Uint8Array(bytes)], 'image.png', { type: 'image/png' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  }, files.logo);
  await settle();
  assert.equal((await items()).length, 3);
  assert.match((await items())[2].name, /^Вставлене зображення/);
});

await step('налаштування зберігаються після перезавантаження', async () => {
  await page.reload(); await page.waitForFunction(() => window.ImgConv);
  assert.equal(await page.locator('[data-fmt="webp"].on').count(), 1);
  assert.equal(await page.inputValue('#namePat'), '{name}-{w}');
});

await step('жодної помилки в консолі сторінки', async () => assert.deepEqual(errors, []));

await browser.close();
server.close();
