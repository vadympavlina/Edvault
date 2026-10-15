// Усі браузерні тести по черзі з коротким підсумком.
//   npm run test:e2e              — усі
//   npm run test:e2e -- animator  — лише ті, у назві яких є «animator»
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const DIR = new URL('.', import.meta.url).pathname;
const filter = process.argv[2] || '';
const list = readdirSync(DIR).filter(f => f.endsWith('-e2e.mjs') && f.includes(filter)).sort();
const rows = [];
for (const f of list) {
  const t = Date.now();
  const r = spawnSync(process.execPath, [DIR + f], { encoding: 'utf8', env: process.env, timeout: 15 * 60e3 });
  const out = (r.stdout || '') + (r.stderr || '');
  const ok = (out.match(/^ok\s/gm) || []).length, fail = (out.match(/^FAIL\s/gm) || []).length;
  const good = r.status === 0 && fail === 0;
  rows.push({ f, ok, fail, good, s: ((Date.now() - t) / 1000).toFixed(0) });
  console.log(`${good ? 'ok  ' : 'FAIL'} ${f.padEnd(26)} ${String(ok).padStart(3)} кроків${fail ? `, ${fail} з помилкою` : ''}  ${rows.at(-1).s} с`);
  if (!good) console.log(out.split('\n').filter(l => /^FAIL|^\s{4}/.test(l)).slice(0, 12).join('\n'));
}
const bad = rows.filter(r => !r.good);
console.log(`\nУсього ${rows.length} файлів: ${rows.length - bad.length} пройшли${bad.length ? `, ${bad.length} з помилками: ${bad.map(r => r.f).join(', ')}` : ''}.`);
process.exitCode = bad.length ? 1 : 0;
