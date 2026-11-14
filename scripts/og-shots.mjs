// Знімки екранів сторінок для прев'ю посилань (див. og-cards.mjs). Кожну сторінку знімаємо у вікні 1020×945:
// така пропорція збігається з правою панеллю картинки, тож інтерфейс не обрізається.
// Деякі інструменти спершу «оживляємо»: малюємо на дошці, друкуємо текст, відкриваємо зображення.
//   node scripts/og-shots.mjs        OG_ONLY=whiteboard — лише один знімок
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';

const ROOT = process.env.OG_ROOT || resolve(new URL('../..', import.meta.url).pathname);
const OUT = process.env.OG_SHOTS || '/tmp/og-shots';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webp': 'image/webp', '.wasm': 'application/wasm' };
const serve = root => new Promise(res => { const s = createServer(async (q, r) => { const p = decodeURIComponent(q.url.split('?')[0]); const tries = p.endsWith('/') ? [p + 'index.html'] : extname(p) ? [p] : [p + '.html', p + '/index.html']; for (const t of tries) { try { const b = await readFile(join(root, t)); r.setHeader('content-type', MIME[extname(t)] || 'application/octet-stream'); r.end(b); return; } catch { /* далі */ } } r.statusCode = 404; r.end('404'); }).listen(0, () => res({ s, url: 'http://localhost:' + s.address().port })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const drag = async (p, pts, steps = 6) => { pts = pts.filter(q => Number.isFinite(q[0]) && Number.isFinite(q[1])); if (pts.length < 2) return; await p.mouse.move(...pts[0]); await p.mouse.down(); for (const q of pts.slice(1)) await p.mouse.move(...q, { steps }); await p.mouse.up(); };
const arc = (cx, cy, r, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const a = (360 * i / n) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });

await mkdir(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] });
const SAMPLE = join(OUT, '_sample.png');
{ const p = await browser.newPage({ viewport: { width: 900, height: 560 } });
  await p.setContent('<body style="margin:0;width:900px;height:560px;background:linear-gradient(135deg,#fde68a,#fca5a5 55%,#a5b4fc);font-family:system-ui;overflow:hidden"><div style="position:absolute;left:60px;top:60px;background:#fff;border-radius:18px;padding:26px 34px;box-shadow:0 12px 30px #0003"><div style="font:800 40px system-ui">Розклад на тиждень</div><div style="font:26px system-ui;color:#475569;margin-top:10px">Пн · математика<br>Вт · природознавство<br>Ср · інформатика</div></div><div style="position:absolute;right:70px;bottom:60px;width:230px;height:230px;border-radius:50%;background:#6366f1"></div></body>');
  await p.screenshot({ path: SAMPLE }); await p.close(); }

const PRE = {
  async 'tools-whiteboard'(p) { // милий малюнок: сонечко, будиночок, сердечко й трава
    const sw = p.locator('[data-color], .swatch, .sw, [class*=color] button'), pick = async i => { await sw.nth(i).click().catch(() => {}); };
    await pick(2); await drag(p, arc(760, 330, 52)); for (let a = 0; a < 360; a += 40) { const r = a * Math.PI / 180; await drag(p, [[760 + 66 * Math.cos(r), 330 + 66 * Math.sin(r)], [760 + 92 * Math.cos(r), 330 + 92 * Math.sin(r)]]); }
    await drag(p, arc(742, 318, 5, 10)); await drag(p, arc(778, 318, 5, 10)); await drag(p, Array.from({ length: 12 }, (_, i) => { const a = (25 + 130 * i / 11) * Math.PI / 180; return [760 + 26 * Math.cos(a), 336 + 20 * Math.sin(a)]; }));
    await pick(4); await drag(p, [[330, 560], [330, 700], [520, 700], [520, 560], [330, 560]]); await drag(p, [[400, 700], [400, 630], [450, 630], [450, 700]]); await drag(p, [[345, 590], [360, 585]]);
    await pick(1); await drag(p, [[310, 560], [425, 460], [540, 560], [310, 560]]);
    await pick(6); await drag(p, Array.from({ length: 41 }, (_, i) => { const t = Math.PI * 2 * i / 40; return [720 + 12 * 16 * Math.sin(t) ** 3 * .5, 640 - 12 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * .5]; }));
    await pick(3); await drag(p, [[180, 705], [260, 698], [330, 706], [520, 706], [620, 698], [830, 706]]);  },
  async 'tools-animator'(p) { await p.keyboard.press('Escape'); await sleep(300);
    // полотно в цьому вікні: x 96–708, y 238–583. Малюємо кольоровий малюнок: небо, пагорб, сонечко й веселе кошеня
    const color = async t => { await p.getByRole('button', { name: t, exact: true }).first().click({ timeout: 2000 }).catch(() => {}); }, tool = async t => { await p.getByRole('button', { name: new RegExp('^' + t) }).first().click({ timeout: 2000 }).catch(() => {}); };
    const ell = (cx, cy, rx, ry, n = 30) => Array.from({ length: n + 1 }, (_, i) => { const a = Math.PI * 2 * i / n; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
    const drag2 = (pp, pts) => drag(pp, pts, 1), fill = async (x, y) => { await p.mouse.click(x, y); await sleep(120); };
    // небо — на шарі «Фон»
    await p.getByText('Фон', { exact: true }).first().click().catch(() => {}); await tool('Заливка'); await color('Блакитний'); await fill(150, 270);
    await tool('Пензель'); await color('Зелений'); await drag2(p, [[96, 500], [180, 470], [280, 490], [380, 520], [480, 500], [580, 470], [708, 495], [708, 583], [96, 583], [96, 500]]); await tool('Заливка'); await fill(300, 560);
    await tool('Пензель'); await color('Жовтий'); await drag2(p, ell(600, 300, 32)); await tool('Заливка'); await fill(600, 300);
    await tool('Пензель'); await color('Білий'); await drag2(p, [[160, 300], [150, 280], [180, 262], [205, 272], [225, 255], [255, 270], [265, 295], [160, 300]]); await tool('Заливка'); await fill(210, 285);
    // кошеня — на шарі «Персонаж»
    await p.getByText('Персонаж', { exact: true }).first().click().catch(() => {}); await tool('Пензель'); await color('Чорний');
    await drag2(p, ell(402, 430, 100, 80)); await drag2(p, [[322, 385], [310, 300], [378, 352]]); await drag2(p, [[482, 385], [494, 300], [426, 352]]);
    await drag2(p, ell(364, 418, 10, 13, 16)); await drag2(p, ell(440, 418, 10, 13, 16)); await drag2(p, [[394, 440], [410, 440], [402, 450], [394, 440]]);
    await drag2(p, Array.from({ length: 14 }, (_, i) => { const a = (15 + 150 * i / 13) * Math.PI / 180; return [402 + 28 * Math.cos(a) * (i < 7 ? 1 : 1), 450 + 18 * Math.sin(a)]; }));
    for (const dy of [-8, 4, 16]) { await drag2(p, [[330, 448 + dy], [270, 440 + dy * 1.8]]); await drag2(p, [[474, 448 + dy], [534, 440 + dy * 1.8]]); }
    await drag2(p, ell(342, 462, 14, 9, 14)); await drag2(p, ell(462, 462, 14, 9, 14));
    await tool('Заливка'); await color('Помаранчевий'); await fill(402, 380); await fill(402, 480); await color('Рожевий'); await fill(350, 340); await fill(454, 340); await fill(402, 445);
    await color('Червоний'); await fill(342, 462); await fill(462, 462); await color('Чорний'); await fill(364, 418); await fill(440, 418);
    await tool('Пензель'); await color('Рожевий'); await drag2(p, Array.from({ length: 41 }, (_, i) => { const t = Math.PI * 2 * i / 40; return [250 + 8 * 16 * Math.sin(t) ** 3 / 8 * 1, 320 - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 1]; }));
    await sleep(400); },
  async 'tools-screen-recorder'(p) { await p.getByRole('button', { name: 'Зрозуміло' }).click().catch(() => {}); },
  async 'tools-pixel-editor'(p) { await p.click('#empty-new-btn').catch(() => {}); await sleep(700);
    await p.getByText('32×32', { exact: true }).first().click().catch(() => {}); await p.getByRole('button', { name: 'Створити', exact: true }).click().catch(() => {}); await sleep(1300);
    // мальовничий пейзаж 32×32: небо, сонечко, хмаринка, пагорби, дерево, будиночок, квіти (кольори — з палітри редактора)
    const N = 32, g = Array.from({ length: N }, () => Array(N).fill('.')), set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = c; };
    const disc = (cx, cy, r, c) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(x, y, c); };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) set(x, y, y < 8 ? '#BFDBFE' : y < 13 ? '#FECACA' : '#FDE68A');
    disc(6, 7, 5.2, '#FDE68A'); disc(6, 7, 3.6, '#FACC15');
    for (const [x, y] of [[20, 4], [21, 4], [22, 4], [23, 4], [19, 5], [20, 5], [21, 5], [22, 5], [23, 5], [24, 5], [25, 5], [18, 6], [19, 6], [20, 6], [21, 6], [22, 6], [23, 6], [24, 6], [25, 6], [26, 6], [26, 5]]) set(x, y, '#FFFFFF');
    for (let x = 0; x < N; x++) { const h1 = Math.round(17 + 2.5 * Math.sin(x / 4.5)), h2 = Math.round(21 + 2 * Math.sin(x / 3.5 + 1.5)), h3 = Math.round(26 + 1.2 * Math.sin(x / 2.5)); for (let y = h1; y < N; y++) set(x, y, '#BBF7D0'); for (let y = h2; y < N; y++) set(x, y, '#84CC16'); for (let y = h3; y < N; y++) set(x, y, '#22C55E'); }
    for (let y = 17; y <= 23; y++) { set(15, y, '#78350F'); set(16, y, '#78350F'); } disc(15.5, 14, 4.4, '#10B981'); disc(14, 12.5, 1.3, '#22C55E'); disc(18, 15, 1, '#22C55E');
    for (let y = 18; y <= 23; y++) for (let x = 22; x <= 28; x++) set(x, y, '#FECACA'); for (let k = 0; k < 4; k++) for (let x = 21 + k; x <= 29 - k; x++) set(x, 17 - k, '#EF4444');
    for (let y = 20; y <= 23; y++) { set(24, y, '#A16207'); set(25, y, '#A16207'); } set(27, 20, '#3B82F6'); set(27, 21, '#3B82F6');
    for (const [x, y, c] of [[3, 27, '#F472B6'], [6, 29, '#EF4444'], [10, 28, '#FACC15'], [17, 29, '#F472B6'], [20, 27, '#FFFFFF'], [29, 28, '#EF4444'], [26, 30, '#F472B6']]) set(x, y, c);
    // сітка спрайта: центр області (414,468); клітинка = 640 / 32
    const X0 = 94, Y0 = 148, G = 640 / N;
    const colors = [...new Set(g.flat().filter(c => c !== '.'))];
    for (const hex of colors) { await p.locator(`button.swatch[title="${hex}"]`).first().click().catch(() => {});
      for (let y = 0; y < N; y++) { let x = 0; while (x < N) { if (g[y][x] !== hex) { x++; continue; } let x2 = x; while (x2 + 1 < N && g[y][x2 + 1] === hex) x2++;
        await p.mouse.move(X0 + G * x + G / 2, Y0 + G * y + G / 2); await p.mouse.down(); if (x2 > x) await p.mouse.move(X0 + G * x2 + G / 2, Y0 + G * y + G / 2, { steps: 2 }); await p.mouse.up(); x = x2 + 1; } } }
    await p.getByText('Полотно й сітка').click().catch(() => {}); await sleep(300); await p.getByText(/^Сітка$/).first().click({ timeout: 1500 }).catch(() => {}); await p.getByText(/Лінії кожні/).first().click({ timeout: 1500 }).catch(() => {}); await p.getByText('Полотно й сітка').click().catch(() => {}); await sleep(400); },
  async 'tools-web-editor'(p) { await p.click('#empty-new-btn').catch(() => {}); await sleep(900); },
  async 'tools-snap-editor'(p) { await p.setInputFiles('input[type=file]', SAMPLE); await sleep(900); await p.locator('.tool', { hasText: 'Стрілка' }).click().catch(() => {}); const bb = await p.locator('#canvas').boundingBox();
    if (bb) { await drag(p, [[bb.x + bb.width * .62, bb.y + bb.height * .2], [bb.x + bb.width * .35, bb.y + bb.height * .45]]); await p.locator('.tool', { hasText: 'Рамка' }).click().catch(() => {}); await drag(p, [[bb.x + bb.width * .08, bb.y + bb.height * .55], [bb.x + bb.width * .45, bb.y + bb.height * .72]]); } },
  async 'tools-text-craft'(p) { await p.locator('[contenteditable=true]').first().click(); await p.keyboard.type('Природознавство: кругообіг води'); await p.keyboard.press('Enter'); await p.keyboard.type('Вода випаровується з морів і річок, піднімається вгору й утворює хмари. Потім вона падає дощем і снігом, і все починається знову.'); await p.keyboard.press('Enter'); await p.keyboard.type('Запитання для класу: куди зникає калюжа після дощу?'); },
  async 'tools-image-convert'(p) { await p.setInputFiles('input[type=file]', SAMPLE).catch(() => {}); await sleep(900); },
  async 'tools-vote'(p) { await p.locator('.type-card').nth(1).click().catch(() => {}); await sleep(400); for (const [ph, v] of [[/Напиши питання/, 'Яка тварина стане талісманом класу?'], ['Варіант 1', 'Котик'], ['Варіант 2', 'Песик']]) await p.getByPlaceholder(ph).fill(v, { timeout: 2500 }).catch(() => {}); await sleep(300); },
  async startup(p) { await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('.wizard'); await p.click('[data-w="next"]'); await p.click('[data-w="next"]'); await p.fill('[data-w="name"]', 'Марта'); await p.fill('[data-w="company"]', 'Записатись'); await p.click('[data-w="next"]'); await p.waitForSelector('#main .ws'); },
};
const PAGES = [['ed-index', 'Edvault', 'index.html'], ['ed-materials', 'Edvault', 'materials.html'], ['em-index', 'edvault-emulators', 'index.html'], ['em-blogger', 'edvault-emulators', 'blogger.html'], ['windows', 'windows-edvault', 'index.html'], ['startup', 'startup-edvault', 'index.html'], ['startup-check', 'startup-edvault', 'startup-check.html'], ['videocut', 'videocut-edvault', 'index.html'], ['tools-index', 'edvault-tools', 'index.html'],
  ...['animator', 'class-manager', 'color-tool', 'image-convert', 'pixel-editor', 'screen-recorder', 'snap-editor', 'text-craft', 'vote', 'web-editor', 'whiteboard'].map(t => ['tools-' + t, 'edvault-tools', t + '.html'])];
const servers = {};
for (const [id, repo, file] of PAGES) {
  if (process.env.OG_ONLY && id !== process.env.OG_ONLY) continue;
  servers[repo] ||= await serve(join(ROOT, repo));
  const ctx = await browser.newContext({ viewport: { width: 1020, height: 945 }, locale: 'uk-UA' }); const p = await ctx.newPage();
  await p.route(/^https?:\/\/(?!localhost)/, r => r.abort()); // зовнішні мережеві запити не потрібні
  await p.goto(servers[repo].url + '/' + file); await sleep(1500);
  try { await PRE[id]?.(p); } catch (e) { console.warn('!', id, e.message.slice(0, 80)); }
  await sleep(400); await p.screenshot({ path: join(OUT, id + '.png') }); await ctx.close(); console.log('ok', id);
}
await browser.close(); for (const s of Object.values(servers)) s.s.close();
