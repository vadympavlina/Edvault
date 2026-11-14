// Прев'ю посилань (Open Graph) у вигляді «два екрани»: ліворуч кольорова панель з іконкою, назвою й описом,
// праворуч знімок самого інструмента. Розмір тексту підбирається сам, тож нічого не вилазить і не обрізається.
//
//   node scripts/og-shots.mjs  — знімає екрани сторінок у теку OG_SHOTS (за замовчуванням /tmp/og-shots)
//   node scripts/og-cards.mjs  — з цих знімків малює картинки 1200×630 у assets/og/ кожного репозиторію
//
// Репозиторії лежать поруч: OG_ROOT=/шлях/до/теки (за замовчуванням — тека над цим репозиторієм).
// Потрібні Playwright і Chromium (змінні PLAYWRIGHT_MODULE і CHROME). Лише одна картинка: OG_ONLY=tools-vote
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = process.env.OG_ROOT || resolve(new URL('../..', import.meta.url).pathname);
const SHOTS = process.env.OG_SHOTS || '/tmp/og-shots';
const R = (...a) => join(ROOT, ...a);

// id — назва знімка; out — куди писати картинку; accent — основний колір; shot: false — малюємо велику іконку замість знімка
const PAGES = [
  { id: 'ed-index', out: ['Edvault', 'assets/og/edvault.png'], kind: 'Навчальна платформа', title: 'Edvault', desc: 'Інструменти для вчителя, тренажери й емулятори для учнів — безкоштовно, просто в браузері.', accent: '#4f6bf4', icon: ['Edvault', 'icons/edvault.svg'], shot: false },
  { id: 'ed-materials', out: ['Edvault', 'assets/og/materials.png'], kind: 'Матеріали', title: 'Навчальні матеріали', desc: 'Предмети, уроки й файли Edvault.', accent: '#4f6bf4', icon: ['Edvault', 'icons/edvault.svg'], shot: false },
  { id: 'ed-equipment', out: ['Edvault', 'assets/og/equipment.png'], kind: 'Техніка', title: 'Облік шкільної техніки', desc: 'Ноутбуки, проєктори й інша техніка класу: що де стоїть і в якому стані.', accent: '#475569', icon: ['Edvault', 'icons/equipment.svg'], shot: false },
  { id: 'ed-lesson', out: ['Edvault', 'assets/og/lesson.png'], kind: 'Урок', title: 'Урок', desc: 'Урок від вашого вчителя: матеріали й завдання в одному місці. Відкривається просто в браузері.', accent: '#4f6bf4', icon: ['Edvault', 'icons/edvault.svg'], shot: false },
  { id: 'em-index', out: ['edvault-emulators', 'assets/og/emulators.png'], kind: 'Каталог', title: 'Навчальні емулятори', desc: 'Три навчальні емулятори в браузері: Windows, телефон блогера і стартап. Без встановлення й без реєстрації.', accent: '#0a4db0', icon: ['edvault-emulators', 'icons/emulators.svg'] },
  { id: 'em-blogger', out: ['edvault-emulators', 'assets/og/blogger.png'], kind: 'Навчальний симулятор', title: 'Симулятор блогера', desc: 'Навчальний телефон з Instagram, YouTube і Telegram: дописи, коментарі, реклама й безпека в мережі.', accent: '#d62976', icon: ['edvault-emulators', 'icons/blogger.svg'] },
  { id: 'windows', out: ['windows-edvault', 'assets/og/windows.png'], kind: 'Навчальний емулятор', title: 'Емулятор Windows', desc: 'Провідник, командний рядок, Диспетчер завдань, брандмауер, мережа й роутер — пробуйте сміливо, нічого не зламаєте.', accent: '#0067c0', icon: ['windows-edvault', 'icons/windows-emulator.svg'] },
  { id: 'startup', out: ['startup-edvault', 'assets/og/startup.png'], kind: 'Навчальний симулятор', title: 'Симулятор стартапу', desc: 'Від ніші до платежів: дев’ять етапів, понад п’ятдесят вправ, власна ідея, логотип, фінплан, торг з інвестором і трейдинг.', accent: '#6366f1', icon: ['startup-edvault', 'icons/startup.svg'] },
  { id: 'startup-check', out: ['startup-edvault', 'assets/og/startup-check.png'], kind: 'Для викладача', title: 'Перевірка роботи · Симулятор стартапу', desc: 'Сторінка для викладача: відкрийте файл збереження учня й перегляньте всю роботу без права змін.', accent: '#6366f1', icon: ['startup-edvault', 'icons/startup.svg'] },
  { id: 'videocut', out: ['videocut-edvault', 'assets/og/videocut.png'], kind: 'Інструмент для вчителя', title: 'Відеоредактор', desc: 'Монтаж у браузері: різання, текст, субтитри, музика, зелений екран і накладання футажів. Експорт у MP4.', accent: '#d63384', icon: ['videocut-edvault', 'icons/videocut.svg'] },
  { id: 'tools-index', out: ['edvault-tools', 'assets/og/tools.png'], kind: 'Каталог', title: 'Інструменти для вчителя', desc: 'Дванадцять інструментів для вчителя й учнів у браузері: вайтборд, голосування, запис екрана, відеоредактор, аніматор, редактори тексту, коду й пікселів. Без встановлення й без реєстрації.', accent: '#0ea5e9', icon: ['edvault-tools', 'icons/tools.svg'] },
];
const TOOLS = [
  ['animator', 'Аніматор', 'Мальовані мультфільми кадр за кадром: пензлі, шари, калька, музика й свій голос, уроки з напрямними. Готовий мультфільм — у відео чи GIF.', '#2337a8'],
  ['class-manager', 'Менеджер класу', 'Учні, розклад, відвідуваність і оцінки в одному місці.', '#10b981'],
  ['color-tool', 'Кольори', 'Палітри, гармонії й перевірка контрасту тексту. Фіксуйте вдалі кольори й копіюйте коди одним клацанням.', '#e11d48'],
  ['image-convert', 'Конвертер зображень', 'Перетворення й стиснення: JPG, PNG, WebP, AVIF, SVG, ICO. Зміна розміру, обрізка, поворот і архів одним кліком.', '#06b6d4'],
  ['pixel-editor', 'Спрайт-редактор', 'Піксельна графіка й анімація: кадри, калька, дзеркальне малювання, створення спрайта з картинки.', '#65a30d'],
  ['screen-recorder', 'Запис екрана', 'Запис екрана з мікрофоном, звуком і веб-камерою в кутку. MP4 або WebM, без встановлення програм.', '#ef4444'],
  ['snap-editor', 'Редактор фото', 'Скриншоти й фото для навчальних матеріалів: кадрування, стрілки, текст, розмиття, нумерація кроків.', '#f59e0b'],
  ['text-craft', 'Текстовий редактор', 'Документи, конспекти й промпти з блоками, заголовками та списками. Готові шапки, автозбереження й експорт.', '#8b5cf6'],
  ['vote', 'Голосування', 'Голосування за кращу роботу: картки команд, підрахунок у реальному часі й феєрверки на фіналі.', '#4f6bf4'],
  ['web-editor', 'Редактор коду', 'HTML, CSS і JavaScript з живим переглядом, консоллю й режимами телефона та планшета. Проєкти зберігаються й діляться посиланням.', '#0f766e'],
  ['whiteboard', 'Вайтборд', 'Дошка для пояснень: олівець, фігури, стікери, нумерація, лазерна вказка. Відкриває PDF і має режим презентації.', '#0ea5e9'],
];
for (const [slug, title, desc, accent] of TOOLS) PAGES.push({ id: 'tools-' + slug, out: ['edvault-tools', `assets/og/tool-${slug}.png`], kind: 'Інструмент для вчителя', title, desc, accent, icon: ['edvault-tools', `icons/${slug}.svg`] });

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Колір панелі темнішаємо, поки білий текст на ній не стане добре читатись (контраст від 4,5 до 1)
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const darken = h => { let c = h; for (let k = 0; k < 20 && 1.05 / (lum(c) + .05) < 4.5; k++) c = '#' + [1, 3, 5].map(i => Math.round(parseInt(c.slice(i, i + 2), 16) * .93).toString(16).padStart(2, '0')).join(''); return c; };

const card = (p, ts, ds, svg, shotUrl) => {
  const bg = darken(p.accent);
  const right = shotUrl
    ? `<div class="r"><img src="${shotUrl}"></div>`
    : `<div class="r ill" style="background:linear-gradient(145deg,${p.accent}22,${p.accent}55)"><i class="b1" style="background:${p.accent}"></i><i class="b2"></i><div class="big">${svg}</div></div>`;
  return `<!doctype html><meta charset="utf-8"><style>*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;overflow:hidden;font-family:Inter,'Golos Text',system-ui,sans-serif}
.c{position:absolute;inset:0;display:flex}.l{width:520px;background:${bg};color:#fff;padding:60px 56px 52px;display:flex;flex-direction:column}
.ic{width:96px;height:96px;border-radius:24px;background:#fff;overflow:hidden;flex:none;box-shadow:0 12px 30px rgba(0,0,0,.25)}.ic svg{width:100%;height:100%;display:block}
.k{margin-top:24px;font-size:22px;font-weight:700;opacity:.9;flex:none}.tx{flex:1;min-height:0;overflow:hidden}
h1{margin-top:8px;font-size:${ts}px;line-height:1.05;font-weight:800;letter-spacing:-1.5px;overflow-wrap:normal;word-break:normal;hyphens:manual}p{margin-top:18px;font-size:${ds}px;line-height:1.38;opacity:.95}
.ft{flex:none;margin-top:14px;font-size:24px;font-weight:700}.ft span{opacity:.8;font-weight:500}
.r{width:680px;height:630px;background:#e5e7eb;overflow:hidden;position:relative}.r img{display:block;width:680px;height:630px;object-fit:cover;object-position:left top}
.ill .b1{position:absolute;right:-110px;top:-110px;width:420px;height:420px;border-radius:50%;opacity:.25}.ill .b2{position:absolute;left:60px;bottom:-130px;width:300px;height:300px;border-radius:50%;background:#fbbf24;opacity:.5}
.big{position:absolute;left:50%;top:50%;width:340px;height:340px;margin:-170px 0 0 -170px;border-radius:80px;overflow:hidden;transform:rotate(5deg);background:#fff;box-shadow:0 30px 80px ${p.accent}88}.big svg{width:100%;height:100%;display:block}</style>
<div class="c"><div class="l"><div class="ic">${svg}</div><div class="k">${esc(p.kind)}</div><div class="tx" id="tx"><h1>${esc(p.title)}</h1><p>${esc(p.desc)}</p></div><div class="ft">Edvault <span>· edvault.online</span></div></div>${right}</div>`;
};

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
const fits = () => page.evaluate(() => { const t = document.getElementById('tx'); return t.scrollHeight <= t.clientHeight + 1 && [...t.querySelectorAll('h1')].every(h => h.scrollWidth <= h.clientWidth + 1); });
const tmp = join(SHOTS, '_card.html');
let bad = 0;
for (const p of PAGES) {
  if (process.env.OG_ONLY && p.id !== process.env.OG_ONLY) continue;
  const shotFile = join(SHOTS, p.id + '.png'), svgFile = R(...p.icon);
  if (!existsSync(svgFile)) { console.warn('немає іконки', svgFile); continue; }
  const useShot = p.shot !== false;
  if (useShot && !existsSync(shotFile)) { console.warn('немає знімка', shotFile); continue; }
  const svg = readFileSync(svgFile, 'utf8');
  let ts = 60, ds = 27;
  for (;;) {
    writeFileSync(tmp, card(p, ts, ds, svg, useShot ? 'file://' + shotFile : null));
    await page.goto('file://' + tmp); await page.evaluate(() => document.fonts.ready);
    if (await fits() || (ts <= 36 && ds <= 20)) break;
    ts = Math.max(36, ts - 2); ds = Math.max(20, ds - 1);
  }
  const ok = await fits(); if (!ok) bad++;
  const dest = R(...p.out); mkdirSync(join(dest, '..'), { recursive: true });
  await page.screenshot({ path: dest });
  console.log(ok ? 'ok ' : 'НЕ ВЛАЗИТЬ', p.id, `(заголовок ${ts}, опис ${ds})`);
}
await browser.close();
if (bad) { console.error(`Не влізло: ${bad}`); process.exit(1); }
