// Іконки сторінок: з icons/<назва>.svg робить icons/<назва>.ico (16, 32, 48) та icons/<назва>-180.png (iPhone, iPad).
// Іконка сайту (icons/edvault.svg) додатково копіюється в корінь: favicon.svg, favicon.ico, apple-touch-icon.png.
//
// Щоб змінити іконку: поправте SVG в icons/ і запустіть
//   node scripts/make-favicons.mjs
// Потрібен Playwright з Chromium (як для браузерних тестів; шляхи — змінні PLAYWRIGHT_MODULE і CHROME).
import { readdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { makeIco } from '../tools/imgconv/js/core.js';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const DIR = join(ROOT, 'icons');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage();

// SVG → PNG потрібного розміру. bg — суцільне тло (iOS не любить прозорих кутів і сам їх заокруглює)
const render = (svg, size, bg) => page.evaluate(async ({ svg, size, bg }) => {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const img = new Image(); img.src = url; await img.decode();
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, size, size); x.drawImage(img, -size * 0.04, -size * 0.04, size * 1.08, size * 1.08); }
  else x.drawImage(img, 0, 0, size, size);
  URL.revokeObjectURL(url);
  return [...new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/png'))).arrayBuffer())];
}, { svg, size, bg });

const names = (await readdir(DIR)).filter(f => f.endsWith('.svg')).map(f => f.slice(0, -4));
for (const name of names) {
  const svg = await readFile(join(DIR, name + '.svg'), 'utf8');
  const bg = (svg.match(/<rect[^>]*fill="(#[0-9a-f]{3,8})"/i) || [])[1] || '#4F6BF4';
  const ico = makeIco(await Promise.all([16, 32, 48].map(async size => ({ size, data: new Uint8Array(await render(svg, size)) }))));
  await writeFile(join(DIR, name + '.ico'), ico);
  await writeFile(join(DIR, name + '-180.png'), new Uint8Array(await render(svg, 180, bg)));
  console.log('ok', name);
}
await copyFile(join(DIR, 'edvault.svg'), join(ROOT, 'favicon.svg'));
await copyFile(join(DIR, 'edvault.ico'), join(ROOT, 'favicon.ico'));
await copyFile(join(DIR, 'edvault-180.png'), join(ROOT, 'apple-touch-icon.png'));
await browser.close();
