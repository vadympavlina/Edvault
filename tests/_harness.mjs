// Спільне для браузерних тестів: статичний сервер репозиторію, запуск Chromium, кроки з підсумком.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';

export const ROOT = resolve(new URL('..', import.meta.url).pathname);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

export async function startServer() {
  const srv = createServer(async (q, r) => {
    try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); r.setHeader('content-type', MIME[extname(f)] || 'application/octet-stream'); r.end(await readFile(f)); } catch { r.statusCode = 404; r.end(); }
  }).listen(0);
  await new Promise(r => srv.once('listening', r));
  return { url: `http://localhost:${srv.address().port}`, close: () => srv.close() };
}

export async function launch() {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  return chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] });
}

// Сторінка з перехопленням помилок і без зовнішніх шрифтів (тести не залежать від мережі)
export async function newPage(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  return p;
}

let n = 0;
export async function step(name, fn) {
  try { await fn(); console.log('ok  ', ++n, name); }
  catch (e) { console.log('FAIL', ++n, name, '\n   ', (e && e.message || String(e)).split('\n').slice(0, 4).join('\n    ')); process.exitCode = 1; }
}
