// Алгоритми з роботом · світ і виконання програми. Без DOM — працює і в сторінці, і в Node (тести).
//
// Карта — рядки:  .  підлога   #  стіна   ~  вода   *  зірка   F  прапорець   S  старт
// Напрям: 0 — вгору, 1 — праворуч, 2 — вниз, 3 — ліворуч.
// Програма — масив вузлів:
//   { t: 'F' } вперед · { t: 'L' } ліворуч · { t: 'R' } праворуч
//   { t: 'rep', n, body } · { t: 'if', c, body, alt } · { t: 'while', c, body }
// Умови c: 'ahead' | 'left' | 'right' — там вільно; 'goal' — ще не на прапорці (для «поки»).

const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

export function parseMap(rows, dir = 1) {
  const cells = rows.map(r => [...r]);
  let start = null, stars = 0;
  cells.forEach((row, y) => row.forEach((c, x) => { if (c === 'S') { start = { x, y }; row[x] = '.'; } if (c === '*') stars++; }));
  return { w: Math.max(...rows.map(r => r.length)), h: rows.length, cells, start, dir, stars };
}
const cellAt = (m, x, y) => (y < 0 || y >= m.h || x < 0 || x >= (m.cells[y] || []).length ? '#' : m.cells[y][x]);
const free = (m, x, y) => { const c = cellAt(m, x, y); return c !== '#' && c !== '~'; };

export function newState(map) {
  return { x: map.start.x, y: map.start.y, dir: map.dir, got: new Set(), done: false, error: null, steps: 0 };
}
const isGoal = (map, s) => cellAt(map, s.x, s.y) === 'F';
function test(map, s, c) {
  if (c === 'goal') return !(isGoal(map, s) && s.got.size === map.stars);
  const d = c === 'ahead' ? s.dir : c === 'left' ? (s.dir + 3) % 4 : (s.dir + 1) % 4;
  return free(map, s.x + DX[d], s.y + DY[d]);
}

const LIMIT = 1000;
// Покрокове виконання: кожен крок — { id, kind, state } (для анімації й підсвічування блоку)
export function* run(map, program) {
  const s = newState(map);
  function* exec(list) {
    for (const node of list) {
      if (s.done) return;
      if (node.t === 'F' || node.t === 'L' || node.t === 'R') {
        if (++s.steps > LIMIT) { s.error = 'limit'; s.done = true; yield { id: node.id, kind: 'error', s: snap(s) }; return; }
        if (node.t === 'L') s.dir = (s.dir + 3) % 4;
        else if (node.t === 'R') s.dir = (s.dir + 1) % 4;
        else {
          const nx = s.x + DX[s.dir], ny = s.y + DY[s.dir], c = cellAt(map, nx, ny);
          if (c === '#') { s.error = 'wall'; s.done = true; yield { id: node.id, kind: 'bump', s: snap(s) }; return; }
          s.x = nx; s.y = ny;
          if (c === '~') { s.error = 'water'; s.done = true; yield { id: node.id, kind: 'water', s: snap(s) }; return; }
          if (c === '*') s.got.add(nx + ',' + ny);
        }
        yield { id: node.id, kind: node.t, s: snap(s) };
        if (isGoal(map, s) && s.got.size === map.stars) { s.done = true; yield { id: node.id, kind: 'win', s: snap(s) }; return; }
      } else if (node.t === 'rep') {
        for (let i = 0; i < node.n && !s.done; i++) yield* exec(node.body);
      } else if (node.t === 'if') {
        if (++s.steps > LIMIT) { s.error = 'limit'; s.done = true; yield { id: node.id, kind: 'error', s: snap(s) }; return; }
        yield { id: node.id, kind: 'check', s: snap(s) };
        yield* exec(test(map, s, node.c) ? node.body : (node.alt || []));
      } else if (node.t === 'while') {
        while (!s.done) {
          if (++s.steps > LIMIT) { s.error = 'limit'; s.done = true; yield { id: node.id, kind: 'error', s: snap(s) }; return; }
          yield { id: node.id, kind: 'check', s: snap(s) };
          if (!test(map, s, node.c)) break;
          const before = s.steps;
          yield* exec(node.body);
          // порожнє тіло циклу — нескінченний цикл без руху
          if (!node.body.length && s.steps === before) { s.error = 'limit'; s.done = true; yield { id: node.id, kind: 'error', s: snap(s) }; return; }
        }
      }
    }
  }
  yield* exec(program);
  if (!s.done) { s.error = isGoal(map, s) ? 'stars' : 'short'; s.done = true; yield { id: null, kind: 'end', s: snap(s) }; }
}
const snap = s => ({ x: s.x, y: s.y, dir: s.dir, got: [...s.got], error: s.error, steps: s.steps });

// Повне виконання без анімації: { ok, error, state }
export function check(map, program) {
  let last = null;
  for (const st of run(map, program)) last = st;
  return { ok: !!last && last.kind === 'win', error: last ? last.s.error : 'short', state: last ? last.s : null };
}
// кількість блоків у програмі (кожна команда й кожен «контейнер» — один блок)
export function countBlocks(list) {
  return list.reduce((n, b) => n + 1 + (b.body ? countBlocks(b.body) : 0) + (b.alt ? countBlocks(b.alt) : 0), 0);
}
export const ERRORS = {
  wall: 'Робот вдарився в стіну.',
  water: 'Робот упав у воду!',
  short: 'Програма скінчилася, а робот ще не дійшов до прапорця.',
  stars: 'Робот на прапорці, але зібрав не всі зірки.',
  limit: 'Програма виконується надто довго — схоже, цикл ніколи не закінчиться.',
};
// зірки за рівень: дійшов — 1, програма не довша за найкращу +2 блоки — 2, найкоротша — 3
export function starsFor(blocks, best) { return blocks <= best ? 3 : blocks <= best + 2 ? 2 : 1; }

// помічники для запису програм у рівнях і тестах
let uid = 0;
const node = (t, extra = {}) => ({ id: 'n' + (++uid), t, ...extra });
export const P = {
  F: () => node('F'), L: () => node('L'), R: () => node('R'),
  rep: (n, ...body) => node('rep', { n, body }),
  iff: (c, body, alt = []) => node('if', { c, body, alt }),
  wh: (c, ...body) => node('while', { c, body }),
};
