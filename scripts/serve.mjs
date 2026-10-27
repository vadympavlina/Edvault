// Локальний сервер сайту — як на GitHub Pages: адреси без .html (/materials → materials.html), невідома адреса → 404.html.
//   npm start            → http://localhost:8080
//   PORT=3000 npm start
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.webp': 'image/webp' };

const srv = createServer(async (q, r) => {
  const p = decodeURIComponent(q.url.split('?')[0]);
  const tries = p.endsWith('/') ? [p + 'index.html'] : extname(p) ? [p] : [p + '.html', p + '/index.html'];
  for (const t of tries) {
    try { const f = join(ROOT, t); const body = await readFile(f); r.setHeader('content-type', MIME[extname(f)] || 'application/octet-stream'); r.end(body); return; } catch { /* далі */ }
  }
  r.statusCode = 404;
  try { r.setHeader('content-type', 'text/html'); r.end(await readFile(join(ROOT, '404.html'))); } catch { r.end(); }
}).listen(+(process.env.PORT || 8080), () => console.log(`Edvault: http://localhost:${srv.address().port}  (Ctrl+C — зупинити)`));
