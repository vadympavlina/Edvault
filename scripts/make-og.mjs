// Прев'ю посилань (Open Graph): коли посилання на сторінку Edvault надсилають у Telegram, Viber, Facebook,
// Instagram чи Google Classroom, з'являється картка з картинкою, назвою й описом.
//
// Скрипт для кожної сторінки:
//   1) малює картинку 1200×630 у assets/og/<назва>.png (значок, назва, опис, адреса сайту);
//   2) вставляє в <head> теги og:* і twitter:* між позначками <!-- og --> … <!-- /og -->
//      (повторний запуск лише оновлює цей блок).
// Назви й описи інструментів і тренажерів беруться з assets/catalog-data.js.
//
//   node scripts/make-og.mjs
// Потрібен Playwright з Chromium (як для браузерних тестів; шляхи — змінні PLAYWRIGHT_MODULE і CHROME).
// Без доступу до Google Fonts можна вказати теку з файлами Inter (inter-cyrillic-wght-normal.woff2,
// inter-latin-wght-normal.woff2): OG_FONTS=/шлях/до/теки
// Лише одна сторінка: OG_ONLY=startup node scripts/make-og.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { TOOLS, TRAINERS } from '../assets/catalog-data.js';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const SITE = 'https://www.edvault.online';
const OUT = join(ROOT, 'assets', 'og');

// Сторінки: path — файл, url — адреса, icon — файл з icons/, kind — підпис над назвою
const PAGES = [
  { path: 'index.html', url: '/', slug: 'edvault', icon: 'edvault', accent: '#4F6BF4', kind: 'Навчальна платформа',
    title: 'Edvault', desc: 'Інструменти для вчителя, тренажери й емулятори для учнів — безкоштовно, просто в браузері.' },
  { path: 'tools/index.html', url: '/tools/', slug: 'tools', icon: 'tools', accent: '#0ea5e9', kind: 'Каталог',
    title: 'Інструменти для вчителя', desc: 'Вайтборд, голосування, запис екрану, відеоредактор, редактор коду й інші інструменти — без реєстрації, просто в браузері.' },
  // стара адреса каталогу (переадресація на /tools/): та сама картка, щоб посилання теж мали прев'ю
  { path: 'tools.html', url: '/tools/', slug: 'tools', icon: 'tools', accent: '#0ea5e9', kind: 'Каталог',
    title: 'Інструменти для вчителя', desc: 'Вайтборд, голосування, запис екрану, відеоредактор, редактор коду й інші інструменти — без реєстрації, просто в браузері.' },
  { path: 'trainers/index.html', url: '/trainers/', slug: 'trainers', icon: 'trainers', accent: '#16a34a', kind: 'Каталог',
    title: 'Тренажери для учнів', desc: 'Мишка, файли й папки, безпека в інтернеті, сліпий друк, алгоритми, мережі — з рівнями й зірками.' },
  { path: 'emulators/windows.html', url: '/emulators/windows', slug: 'windows', icon: 'windows-emulator', accent: '#0067c0', kind: 'Навчальний емулятор',
    title: 'Емулятор Windows', desc: 'Провідник, командний рядок, Диспетчер завдань, брандмауер, мережа й роутер — пробуйте сміливо, нічого не зламаєте.' },
  { path: 'emulators/blogger.html', url: '/emulators/blogger', slug: 'blogger', icon: 'edvault', accent: '#d62976', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="bg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#feda75"/><stop offset=".45" stop-color="#d62976"/><stop offset="1" stop-color="#4f5bd5"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#bg)"/><rect x="10" y="5.5" width="12" height="21" rx="2.6" fill="none" stroke="#fff" stroke-width="1.8"/><path d="M14.5 8h3" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><path d="M16 21.2s-3.3-2-4-3.9a2 2 0 0 1 4-1.3 2 2 0 0 1 4 1.3c-.7 1.9-4 3.9-4 3.9z" fill="#fff"/></svg>', kind: 'Навчальний симулятор',
    title: 'Симулятор блогера', desc: 'Навчальний телефон з Instagram, YouTube і Telegram: дописи, коментарі, реклама й безпека в мережі.' },
  { path: 'emulators/startup.html', url: '/emulators/startup', slug: 'startup', icon: 'edvault', accent: '#6366f1', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="sg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#0ea5e9"/><stop offset="1" stop-color="#6366f1"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#sg)"/><g fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 4)"><path d="M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8a2 2 0 0 0-3 0z"/><path d="m12 15-3-3a22 22 0 0 1 2-4A13 13 0 0 1 22 2c0 2.7-.8 7.5-6 11a22 22 0 0 1-4 2z"/><path d="M9 12H4s.6-3 2-4c1.6-1 5 0 5 0M12 15v5s3-.6 4-2c1-1.6 0-5 0-5"/></g></svg>', kind: 'Навчальний симулятор',
    title: 'Симулятор стартапу', desc: 'Від ідеї до компанії: інтерв\'ю з клієнтами, бізнес-план, MVP, бренд, маркетинг, фінанси, команда, фриланс, платежі й інвестори — тиждень за тижнем.' },
  { path: 'materials.html', url: '/materials', slug: 'materials', icon: 'edvault', accent: '#4F6BF4', kind: 'Матеріали',
    title: 'Навчальні матеріали', desc: 'Предмети, уроки й файли Edvault.' },
  { path: 'equipment.html', url: '/equipment', slug: 'equipment', icon: 'equipment', accent: '#475569', kind: 'Техніка',
    title: 'Облік шкільної техніки', desc: 'Ноутбуки, проєктори й інша техніка класу: що де стоїть і в якому стані.' },
  ...TOOLS.map(t => ({ path: 'tools/' + t.file, url: '/tools/' + t.file.replace(/\.html$/, ''), slug: 'tool-' + t.id, icon: t.file.replace(/\.html$/, ''), accent: t.accent, kind: 'Інструмент для вчителя', title: t.name, desc: t.desc })),
  ...TRAINERS.map(t => ({ path: 'trainers/' + t.file, url: '/trainers/' + t.file.replace(/\.html$/, ''), slug: 'trainer-' + t.id, icon: t.file.replace(/\.html$/, ''), accent: t.accent, kind: 'Тренажер', title: t.name, desc: t.desc })),
];

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/[\s,.;:—-]+\S*$/, '') + '…' : s);

const card = (p, svg, logo) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;800&display=block" rel="stylesheet">
<style>
*{margin:0;box-sizing:border-box} body{width:1200px;height:630px;font-family:Inter,system-ui,sans-serif;background:#f4f6fb;overflow:hidden}
.c{position:absolute;inset:0;display:flex;flex-direction:column;padding:64px 72px 56px;background:
 radial-gradient(700px 420px at 100% 0%, ${p.accent}33, transparent 70%), radial-gradient(600px 400px at 0% 100%, ${p.accent}1f, transparent 70%), #f7f8fc}
.bar{position:absolute;left:0;top:0;bottom:0;width:14px;background:${p.accent}}
.top{display:flex;align-items:center;gap:30px}
.ic{width:132px;height:132px;flex:none;border-radius:30px;overflow:hidden;box-shadow:0 14px 34px ${p.accent}55}
.ic svg{width:100%;height:100%;display:block}
.kind{font-size:30px;font-weight:600;color:${p.accent};filter:brightness(.8);letter-spacing:.2px}
h1{font-size:${p.title.length > 22 ? 64 : 76}px;line-height:1.05;font-weight:800;color:#111827;letter-spacing:-1.5px;margin-top:6px}
p{margin-top:38px;font-size:36px;line-height:1.38;color:#374151;max-width:1020px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.ft{margin-top:auto;display:flex;align-items:center;gap:16px;font-size:28px;font-weight:600;color:#1f2937}
.ft svg{width:44px;height:44px;border-radius:11px} .ft span{color:#6b7280;font-weight:500}
</style></head><body><div class="c"><i class="bar"></i>
<div class="top"><div class="ic">${svg}</div><div><div class="kind">${esc(p.kind)}</div><h1>${esc(p.title)}</h1></div></div>
<p>${esc(cut(p.desc, 170))}</p>
<div class="ft">${logo}<b>Edvault</b><span>· edvault.online</span></div></div></body></html>`;

const block = p => {
  const img = `${SITE}/assets/og/${p.slug}.png`, url = SITE + p.url, title = p.title === 'Edvault' ? 'Edvault' : `${p.title} · Edvault`, desc = cut(p.desc, 200);
  return `<!-- og -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="Edvault">
<meta property="og:locale" content="uk_UA">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(p.title === 'Edvault' ? 'Edvault' : p.title + ' — Edvault')}">
<meta name="twitter:card" content="summary_large_image">
<!-- /og -->`;
};

// вставка в <head>: замінюємо старий блок або додаємо перед </head>; за відсутності — ще й meta description
function inject(html, p) {
  html = html.replace(/\n?[ \t]*<!-- og -->[\s\S]*?<!-- \/og -->/, '');
  let add = block(p);
  if (!/<meta\s+name="description"/i.test(html)) add = `<meta name="description" content="${esc(cut(p.desc, 200))}">\n` + add;
  return html.replace(/([ \t]*)<\/head>/i, (m, ind) => `${add.split('\n').map(l => ind + l).join('\n')}\n${m}`);
}

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
if (process.env.OG_FONTS) {
  const dir = process.env.OG_FONTS;
  await page.route(/fonts\.googleapis\.com/, r => r.fulfill({ contentType: 'text/css', body: ['cyrillic', 'latin'].map(s => `@font-face{font-family:Inter;font-weight:100 900;src:url(https://fonts.gstatic.com/og/${s}.woff2)}`).join('') }));
  await page.route(/fonts\.gstatic\.com\/og\//, r => r.fulfill({ contentType: 'font/woff2', body: readFileSync(join(dir, `inter-${/og\/(\w+)/.exec(r.request().url())[1]}-wght-normal.woff2`)) }));
}
await mkdir(OUT, { recursive: true });
const logo = await readFile(join(ROOT, 'icons', 'edvault.svg'), 'utf8');
for (const p of PAGES) {
  if (process.env.OG_ONLY && p.slug !== process.env.OG_ONLY) continue; // OG_ONLY=slug — лише одна сторінка
  const file = join(ROOT, p.path);
  if (!existsSync(file)) { console.warn('немає сторінки', p.path); continue; }
  const iconFile = join(ROOT, 'icons', p.icon + '.svg');
  const svg = p.svg || (existsSync(iconFile) ? await readFile(iconFile, 'utf8') : logo);
  await page.setContent(card(p, svg, logo), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(OUT, p.slug + '.png') });
  await writeFile(file, inject(await readFile(file, 'utf8'), p));
  console.log('ok', p.path);
}
await browser.close();
