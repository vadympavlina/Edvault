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
const drag = async (p, pts) => { await p.mouse.move(...pts[0]); await p.mouse.down(); for (const q of pts.slice(1)) await p.mouse.move(...q, { steps: 6 }); await p.mouse.up(); };
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
    const cx = 402, cy = 400; // полотно в цьому вікні: x 96–708, y 238–583
    await drag(p, arc(cx, cy, 80)); await drag(p, arc(cx - 28, cy - 18, 7, 14)); await drag(p, arc(cx + 28, cy - 18, 7, 14));
    await drag(p, Array.from({ length: 16 }, (_, i) => { const a = (20 + 140 * i / 15) * Math.PI / 180; return [cx + 40 * Math.cos(a), cy + 4 + 34 * Math.sin(a)]; }));
    await drag(p, [[cx - 14, cy - 80], [cx - 30, cy - 120], [cx - 6, cy - 98]]); await drag(p, [[cx + 14, cy - 80], [cx + 30, cy - 120], [cx + 6, cy - 98]]);
    await p.locator('button.sw[title="Червоний"]').click().catch(() => {}); await drag(p, arc(cx - 55, cy + 12, 12, 16)); await drag(p, arc(cx + 55, cy + 12, 12, 16)); await sleep(300); },
  async 'tools-screen-recorder'(p) { await p.getByRole('button', { name: 'Зрозуміло' }).click().catch(() => {}); },
  async 'tools-pixel-editor'(p) { await p.click('#empty-new-btn').catch(() => {}); await sleep(700); await p.getByRole('button', { name: 'Створити', exact: true }).click().catch(() => {}); await sleep(1200);
    // миле кошеня 16×16: сітка спрайта на цьому розмірі вікна починається в (94,148), клітинка 40 px
    const ART = ['................', '..KK........KK..', '.KOOK......KOOK.', '.KOOOKKKKKKOOOK.', '.KOOOOOOOOOOOOK.', '.KOOOOOOOOOOOOK.', '.KOOKKOOOOKKOOK.', '.KOOKWOOOOKWOOK.', '.KOOOOOOOOOOOOK.', '.KOPPOOKKOOPPOK.', '.KOOOOOOOOOOOOK.', '.KOOOOKOOKOOOOK.', '..KOOOOKKOOOOK..', '...KKOOOOOOKK...', '.....KKKKKKK....', '................'];
    const COL = { K: '#000000', O: '#F97316', W: '#FFFFFF', P: '#F472B6' }, X0 = 94, Y0 = 148, G = 40;
    for (const [ch, hex] of Object.entries(COL)) { await p.locator(`button.swatch[title="${hex}"]`).first().click().catch(() => {}); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (ART[y][x] === ch) await p.mouse.click(X0 + G * x + G / 2, Y0 + G * y + G / 2); }
    await sleep(300); },
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
