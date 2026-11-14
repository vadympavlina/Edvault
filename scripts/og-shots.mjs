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
  async 'tools-whiteboard'(p) { await drag(p, [[300, 300], [300, 700]]); await drag(p, [[300, 700], [820, 700]]); await drag(p, [[300, 650], [380, 560], [450, 600], [540, 440], [640, 500], [760, 330]]); await drag(p, arc(560, 250, 70)); await drag(p, [[200, 150], [470, 140]]); await drag(p, [[205, 165], [440, 160]]); },
  async 'tools-animator'(p) { await p.keyboard.press('Escape'); },
  async 'tools-screen-recorder'(p) { await p.getByRole('button', { name: 'Зрозуміло' }).click().catch(() => {}); },
  async 'tools-pixel-editor'(p) { await p.click('#empty-new-btn').catch(() => {}); await sleep(700); await p.getByRole('button', { name: 'Створити', exact: true }).click().catch(() => {}); await sleep(1200);
    const cs = p.locator('canvas'); let best = null, area = 0; for (let i = 0; i < await cs.count(); i++) { const bb = await cs.nth(i).boundingBox(); if (bb && bb.width * bb.height > area) { area = bb.width * bb.height; best = bb; } }
    if (best) { const g = best.width / 16; for (const [x, y] of [[3, 3], [4, 3], [5, 3], [3, 4], [5, 4], [3, 5], [4, 5], [5, 5], [8, 8], [9, 8], [10, 8], [8, 9], [10, 9], [9, 10]]) await p.mouse.click(best.x + g * x + g / 2, best.y + g * y + g / 2); } },
  async 'tools-web-editor'(p) { await p.click('#empty-new-btn').catch(() => {}); await sleep(900); },
  async 'tools-snap-editor'(p) { await p.setInputFiles('input[type=file]', SAMPLE); await sleep(900); await p.locator('.tool', { hasText: 'Стрілка' }).click().catch(() => {}); const bb = await p.locator('#canvas').boundingBox();
    if (bb) { await drag(p, [[bb.x + bb.width * .62, bb.y + bb.height * .2], [bb.x + bb.width * .35, bb.y + bb.height * .45]]); await p.locator('.tool', { hasText: 'Рамка' }).click().catch(() => {}); await drag(p, [[bb.x + bb.width * .08, bb.y + bb.height * .55], [bb.x + bb.width * .45, bb.y + bb.height * .72]]); } },
  async 'tools-text-craft'(p) { await p.locator('[contenteditable=true]').first().click(); await p.keyboard.type('Природознавство: кругообіг води'); await p.keyboard.press('Enter'); await p.keyboard.type('Вода випаровується з морів і річок, піднімається вгору й утворює хмари. Потім вона падає дощем і снігом, і все починається знову.'); await p.keyboard.press('Enter'); await p.keyboard.type('Запитання для класу: куди зникає калюжа після дощу?'); },
  async 'tools-image-convert'(p) { await p.setInputFiles('input[type=file]', SAMPLE).catch(() => {}); await sleep(900); },
  async 'tools-vote'(p) { await p.locator('.type-card').nth(1).click().catch(() => {}); },
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
