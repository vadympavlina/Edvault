// Алгоритми з роботом · Edvault — рівні, редактор програми з блоків, анімація робота, прогрес і результати.
import { CHAPTERS, LEVELS } from './levels.js';
import { parseMap, run, countBlocks, starsFor, ERRORS } from './world.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ═════════ Іконки ═════════ */
const P = {
  bot: '<path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  left: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"/>',
  step: '<polygon points="5 4 15 12 5 20 5 4" fill="currentColor"/><path d="M19 5v14"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  rotl: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  rotr: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  branch: '<path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  loop: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  star: '<path fill="currentColor" stroke="none" d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
};
const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
const starsHtml = n => `<span class="stars">${[0, 1, 2].map(i => icon('star', i < n ? 'on' : '')).join('')}</span>`;
document.querySelectorAll('[data-icon]').forEach(e => { e.outerHTML = icon(e.dataset.icon); });
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); }

/* ═════════ Тема ═════════ */
const syncTheme = () => { $('themeBtn').innerHTML = icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon'); };
$('themeBtn').onclick = () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('edvault-theme', next); } catch (e) { /* приватний режим */ }
  syncTheme();
};
syncTheme();

/* ═════════ Прогрес ═════════ */
const KEY = 'edvault-robot';
let progress = (() => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } })();
if (!progress || typeof progress !== 'object') progress = {};
progress = { name: progress.name || '', best: progress.best || {}, drafts: progress.drafts || {} };
const saveProgress = () => { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* немає місця */ } };
const best = id => progress.best[id];
const unlocked = i => i === 0 || (best(LEVELS[i - 1].id)?.stars || 0) >= 1;
const passed = () => LEVELS.filter(l => best(l.id)?.stars).length;
const totalStars = () => LEVELS.reduce((s, l) => s + (best(l.id)?.stars || 0), 0);
const OPT = Object.fromEntries(LEVELS.map(l => [l.id, countBlocks(l.solution())]));

/* ═════════ Блоки ═════════ */
const BLOCKS = {
  F: { name: 'Вперед', icon: 'up', c: 'var(--c-move)' },
  L: { name: 'Ліворуч', icon: 'rotl', c: 'var(--c-turn)' },
  R: { name: 'Праворуч', icon: 'rotr', c: 'var(--c-turn)' },
  rep: { name: 'Повторити', icon: 'repeat', c: 'var(--c-rep)' },
  if: { name: 'Якщо', icon: 'branch', c: 'var(--c-if)' },
  while: { name: 'Поки', icon: 'loop', c: 'var(--c-while)' },
};
const COND_IF = [['ahead', 'попереду вільно'], ['left', 'ліворуч вільно'], ['right', 'праворуч вільно']];
const COND_WHILE = [['goal', 'не на прапорці'], ...COND_IF];
let nid = 0;
const newNode = t => {
  const n = { id: 'b' + (++nid), t };
  if (t === 'rep') { n.n = 3; n.body = []; }
  if (t === 'if') { n.c = 'ahead'; n.body = []; n.alt = []; }
  if (t === 'while') { n.c = 'goal'; n.body = []; }
  return n;
};
// відновлення програми зі сховища (нові id)
const revive = list => (Array.isArray(list) ? list : []).filter(b => BLOCKS[b?.t]).map(b => ({ ...newNode(b.t), ...(b.t === 'rep' ? { n: Math.min(20, Math.max(1, +b.n || 1)) } : {}), ...(b.c ? { c: b.c } : {}), ...(b.body ? { body: revive(b.body) } : {}), ...(b.alt ? { alt: revive(b.alt) } : {}) }));
const strip = list => list.map(({ id, ...b }) => ({ ...b, ...(b.body ? { body: strip(b.body) } : {}), ...(b.alt ? { alt: strip(b.alt) } : {}) }));

/* ═════════ Редактор програми ═════════ */
let prog = [], cursor = { list: 'main', i: 0 }, undoStack = [], level = null, cur = -1;
const lists = () => { const m = { main: prog }; const walk = l => l.forEach(b => { if (b.body) { m[b.id + ':body'] = b.body; walk(b.body); } if (b.alt) { m[b.id + ':alt'] = b.alt; walk(b.alt); } }); walk(prog); return m; };
function find(id, l = prog, parent = 'main') {
  for (let i = 0; i < l.length; i++) {
    const b = l[i];
    if (b.id === id) return { list: l, i, listId: parent, b };
    for (const k of ['body', 'alt']) if (b[k]) { const r = find(id, b[k], b.id + ':' + k); if (r) return r; }
  }
  return null;
}
const contains = (b, id) => b.id === id || ['body', 'alt'].some(k => b[k] && b[k].some(x => contains(x, id)));
function snapshot() { undoStack.push(JSON.stringify(strip(prog))); if (undoStack.length > 100) undoStack.shift(); }
function changed() { if (level) { progress.drafts[level.id] = strip(prog); saveProgress(); } renderProgram(); }

const slot = (listId, i) => `<div class="slot${cursor.list === listId && cursor.i === i ? ' cur' : ''}" data-list="${listId}" data-i="${i}"></div>`;
function blockHtml(b) {
  const d = BLOCKS[b.t], x = `<button class="blk-x" data-del="${b.id}" title="Прибрати блок">${icon('x')}</button>`;
  if (b.t === 'F' || b.t === 'L' || b.t === 'R') return `<div class="blk" data-id="${b.id}" style="--c:${d.c}"><div class="blk-head" draggable="true">${icon(d.icon)}${d.name}<span class="grow"></span>${x}</div></div>`;
  const sel = (opts) => `<select class="cond" data-cond="${b.id}">${opts.map(([v, n]) => `<option value="${v}"${b.c === v ? ' selected' : ''}>${n}</option>`).join('')}</select>`;
  let head = '';
  if (b.t === 'rep') head = `${icon(d.icon)}Повторити <span class="num"><button data-num="${b.id}" data-d="-1" title="Менше">−</button><b>${b.n}</b><button data-num="${b.id}" data-d="1" title="Більше">+</button></span> разів`;
  if (b.t === 'if') head = `${icon(d.icon)}Якщо ${sel(COND_IF)}`;
  if (b.t === 'while') head = `${icon(d.icon)}Поки ${sel(COND_WHILE)}`;
  return `<div class="blk box" data-id="${b.id}" style="--c:${d.c}"><div class="blk-head" draggable="true">${head}<span class="grow"></span>${x}</div>
    <div class="blk-body">${listHtml(b.body, b.id + ':body')}</div>
    ${b.t === 'if' ? `<div class="blk-else">інакше</div><div class="blk-body">${listHtml(b.alt, b.id + ':alt')}</div>` : ''}
    <div class="blk-foot"></div></div>`;
}
const listHtml = (l, id) => slot(id, 0) + l.map((b, i) => blockHtml(b) + slot(id, i + 1)).join('');
function renderProgram() {
  if (!lists()[cursor.list] || cursor.i > lists()[cursor.list].length) cursor = { list: 'main', i: prog.length };
  $('program').innerHTML = listHtml(prog, 'main');
  $('program').classList.toggle('empty', !prog.length);
  const n = countBlocks(prog), opt = level ? OPT[level.id] : 0;
  $('count').textContent = `${n} / найкраще ${opt} бл.`;
  $('count').title = 'Скільки блоків у програмі і скільки в найкоротшій';
  $('count').classList.toggle('best', n > 0 && n <= opt);
}
function renderPalette() {
  $('palette').innerHTML = level.blocks.map(t => `<button class="pal" data-add="${t}" draggable="true" style="--c:${BLOCKS[t].c}">${icon(BLOCKS[t].icon)}${BLOCKS[t].name}</button>`).join('');
}
function insert(node, listId = cursor.list, i = cursor.i) {
  const l = lists()[listId]; if (!l) return;
  l.splice(i, 0, node);
  cursor = node.body ? { list: node.id + ':body', i: 0 } : { list: listId, i: i + 1 };
}
function add(t) {
  if (running || !level.blocks.includes(t)) return;
  snapshot(); insert(newNode(t)); changed(); resetWorld();
}
function del(id) {
  const f = find(id); if (!f) return;
  snapshot(); f.list.splice(f.i, 1); cursor = { list: f.listId, i: f.i }; changed(); resetWorld();
}
$('palette').addEventListener('click', e => { const b = e.target.closest('[data-add]'); if (b) add(b.dataset.add); });
$('program').addEventListener('click', e => {
  if (running) return;
  const t = e.target;
  const d = t.closest('[data-del]'); if (d) { del(d.dataset.del); return; }
  const nb = t.closest('[data-num]');
  if (nb) { const f = find(nb.dataset.num); if (f) { snapshot(); f.b.n = Math.min(20, Math.max(1, f.b.n + +nb.dataset.d)); changed(); resetWorld(); } return; }
  if (t.closest('select')) return;
  const s = t.closest('.slot');
  if (s) { cursor = { list: s.dataset.list, i: +s.dataset.i }; renderProgram(); return; }
  const blk = t.closest('.blk');
  if (blk) { const f = find(blk.dataset.id); if (f) { cursor = { list: f.listId, i: f.i + 1 }; renderProgram(); } return; }
  cursor = { list: 'main', i: prog.length }; renderProgram();
});
$('program').addEventListener('change', e => {
  const s = e.target.closest('[data-cond]'); if (!s) return;
  const f = find(s.dataset.cond); if (f) { snapshot(); f.b.c = s.value; changed(); resetWorld(); }
});
$('clearBtn').onclick = () => { if (running || !prog.length) return; snapshot(); prog = []; cursor = { list: 'main', i: 0 }; changed(); resetWorld(); toast('Програму очищено. Ctrl+Z — повернути'); };

// перетягування: блоки програми й блоки з палітри
let drag = null;
document.addEventListener('dragstart', e => {
  if (running) { e.preventDefault(); return; }
  const pal = e.target.closest?.('[data-add]'), head = e.target.closest?.('.blk-head');
  if (pal) drag = { add: pal.dataset.add };
  else if (head) { drag = { move: head.parentElement.dataset.id }; head.parentElement.classList.add('dragging'); }
  else return;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', 'robot');
});
document.addEventListener('dragend', () => { drag = null; document.querySelectorAll('.dragging').forEach(x => x.classList.remove('dragging')); clearDrop(); });
const clearDrop = () => document.querySelectorAll('.slot.drop').forEach(x => x.classList.remove('drop'));
function nearestSlot(y, x) {
  let bestS = null, bd = Infinity;
  for (const s of $('program').querySelectorAll('.slot')) {
    const r = s.getBoundingClientRect();
    if (x < r.left - 20 || x > r.right + 20) continue;
    const d = Math.abs(y - (r.top + r.height / 2));
    if (d < bd) { bd = d; bestS = s; }
  }
  return bestS;
}
$('program').addEventListener('dragover', e => {
  if (!drag) return;
  e.preventDefault();
  const s = nearestSlot(e.clientY, e.clientX);
  if (s && !s.classList.contains('drop')) { clearDrop(); s.classList.add('drop'); }
});
$('program').addEventListener('dragleave', e => { if (!$('program').contains(e.relatedTarget)) clearDrop(); });
$('program').addEventListener('drop', e => {
  e.preventDefault();
  const s = document.querySelector('.slot.drop'); clearDrop();
  if (!drag || !s) return;
  const listId = s.dataset.list; let i = +s.dataset.i;
  snapshot();
  if (drag.add) { cursor = { list: listId, i }; insert(newNode(drag.add), listId, i); }
  else {
    const f = find(drag.move); if (!f) return;
    // не можна покласти блок усередину самого себе
    if (listId !== 'main' && contains(f.b, listId.split(':')[0])) { undoStack.pop(); toast('Блок не можна покласти всередину самого себе'); return; }
    f.list.splice(f.i, 1);
    if (f.listId === listId && f.i < i) i--;
    lists()[listId].splice(i, 0, f.b);
    cursor = { list: listId, i: i + 1 };
  }
  drag = null; changed(); resetWorld();
});

/* ═════════ Світ ═════════ */
const T = 60;
let maps = [], mapIdx = 0, robotAngle = 0, mapResults = [];
const NS = 'http://www.w3.org/2000/svg';
const starPts = (cx, cy, r) => Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; return `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`; }).join(' ');
function mapSvg(m, t = T, opts = {}) {
  let s = '';
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const c = (m.cells[y] || [])[x] || '#', X = x * t, Y = y * t;
    if (c === '#') s += `<rect class="t-wall" x="${X}" y="${Y}" width="${t}" height="${t}"/><rect class="t-wall-top" x="${X + t * .06}" y="${Y + t * .06}" width="${t * .88}" height="${t * .7}" rx="${t * .12}"/>`;
    else if (c === '~') s += `<rect class="t-water" x="${X}" y="${Y}" width="${t}" height="${t}"/>` + (opts.mini ? '' : `<path class="t-wave" d="M${X + t * .18} ${Y + t * .42} q${t * .16} -${t * .12} ${t * .32} 0 t${t * .32} 0"/><path class="t-wave" d="M${X + t * .18} ${Y + t * .68} q${t * .16} -${t * .12} ${t * .32} 0 t${t * .32} 0"/>`);
    else {
      s += `<rect class="t-floor${(x + y) % 2 ? ' alt' : ''}" x="${X}" y="${Y}" width="${t}" height="${t}"/>`;
      if (c === '*') s += `<polygon class="t-star" data-star="${x},${y}" points="${starPts(X + t / 2, Y + t / 2, t * .3)}"/>`;
      if (c === 'F') s += `<line class="t-pole" x1="${X + t * .32}" y1="${Y + t * .18}" x2="${X + t * .32}" y2="${Y + t * .84}" style="stroke-width:${t / 15}"/><path class="t-flag" d="M${X + t * .34} ${Y + t * .18} L${X + t * .78} ${Y + t * .32} L${X + t * .34} ${Y + t * .48} Z"/>`;
    }
  }
  if (!opts.mini) s += `<rect class="t-start" x="${m.start.x * t + 5}" y="${m.start.y * t + 5}" width="${t - 10}" height="${t - 10}" rx="10"/>`;
  else s += `<circle cx="${(m.start.x + .5) * t}" cy="${(m.start.y + .5) * t}" r="${t * .32}" fill="var(--accent)"/>`;
  return s;
}
// робот намальований «обличчям угору»; повертається разом із напрямом
const ROBOT = `<g class="robot" id="robot"><g class="robot-in" id="robotIn">
  <path class="nose" d="M30 3 L38 13 L22 13 Z"/>
  <rect class="body" x="12" y="14" width="36" height="36" rx="11"/>
  <rect class="face" x="17" y="18" width="26" height="14" rx="7"/>
  <circle class="eye" cx="24" cy="25" r="3.2"/><circle class="eye" cx="36" cy="25" r="3.2"/>
  <rect class="wheel" x="8" y="22" width="5" height="20" rx="2.5"/><rect class="wheel" x="47" y="22" width="5" height="20" rx="2.5"/>
  <path d="M23 41h14" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/></g></g>`;
function drawWorld() {
  const m = maps[mapIdx], svg = $('world');
  svg.setAttribute('viewBox', `0 0 ${m.w * T} ${m.h * T}`);
  svg.innerHTML = mapSvg(m) + `<polyline class="trail" id="trail" points=""/>` + ROBOT;
  robotAngle = m.dir * 90;
  placeRobot(m.start.x, m.start.y, m.dir, true);
  trail = [[m.start.x, m.start.y]]; drawTrail();
  renderTabs();
}
let trail = [];
const drawTrail = () => { const p = $('trail'); if (p) p.setAttribute('points', trail.map(([x, y]) => `${(x + .5) * T},${(y + .5) * T}`).join(' ')); };
function placeRobot(x, y, dir, instant) {
  const r = $('robot'), inn = $('robotIn');
  if (!r) return;
  // повертаємо найкоротшим шляхом
  let diff = ((dir * 90 - robotAngle) % 360 + 540) % 360 - 180;
  robotAngle += diff;
  r.style.setProperty('--dur', instant ? '0s' : delay() * .85 / 1000 + 's');
  r.style.transform = `translate(${x * T}px, ${y * T}px)`;
  inn.style.transform = `rotate(${robotAngle}deg)`;
}
function renderTabs() {
  $('mapTabs').innerHTML = maps.length > 1 ? maps.map((m, i) => `<button data-map="${i}" class="${i === mapIdx ? 'on' : ''}"><i class="${mapResults[i] === true ? 'ok' : mapResults[i] === false ? 'bad' : ''}"></i>Лабіринт ${i + 1}</button>`).join('') : '';
}
$('mapTabs').addEventListener('click', e => { const b = e.target.closest('[data-map]'); if (!b || running) return; mapIdx = +b.dataset.map; resetWorld(true); });
function setStatus(text, kind = '') {
  $('status').className = 'status' + (kind ? ' ' + kind : '');
  $('status').innerHTML = (kind === 'err' ? icon('alert') : kind === 'ok' ? icon('check') : '') + esc(text);
}
function resetWorld(keepResults) {
  stopRun();
  if (!keepResults) mapResults = [];
  drawWorld();
  document.querySelectorAll('.blk.run, .blk.bad').forEach(x => x.classList.remove('run', 'bad'));
  setStatus(level.maps.length > 1 ? 'Програма має пройти всі лабіринти.' : '');
}

/* ═════════ Виконання ═════════ */
let running = false, gen = null, timer = 0, stepping = false;
const delay = () => [700, 450, 280, 160, 70][+$('speed').value - 1];
function stopRun() {
  clearTimeout(timer); running = false; gen = null; stepping = false;
  $('runLabel').textContent = 'Запустити'; $('runBtn').firstElementChild.outerHTML = icon('play');
  $('program').style.pointerEvents = '';
}
function startGen() {
  gen = run(maps[mapIdx], prog);
  document.querySelectorAll('.blk.bad').forEach(x => x.classList.remove('bad'));
}
// один крок анімації; повертає false, коли виконання на цій карті скінчилося
function advance() {
  const r = gen.next();
  document.querySelectorAll('.blk.run').forEach(x => x.classList.remove('run'));
  if (r.done) return false;
  const st = r.value, s = st.s;
  if (st.id) document.querySelector(`.blk[data-id="${st.id}"]`)?.classList.add('run');
  if (st.kind === 'F' || st.kind === 'L' || st.kind === 'R' || st.kind === 'win') {
    placeRobot(s.x, s.y, s.dir);
    if (st.kind === 'F') { trail.push([s.x, s.y]); drawTrail(); }
    for (const k of s.got) document.querySelector(`[data-star="${k}"]`)?.classList.add('got');
  }
  if (st.kind === 'bump') {
    const rb = $('robot'), D = [[0, -1], [1, 0], [0, 1], [-1, 0]][s.dir];
    rb.style.setProperty('--bx', D[0] * 12 + 'px'); rb.style.setProperty('--by', D[1] * 12 + 'px'); rb.style.setProperty('--rot', robotAngle + 'deg');
    rb.classList.remove('bump'); void rb.offsetWidth; rb.classList.add('bump');
  }
  if (st.kind === 'water') { placeRobot(s.x, s.y, s.dir); setTimeout(() => $('robot')?.classList.add('sink'), delay() * .6); }
  if (st.kind === 'win') { onMapDone(true); return false; }
  if (s.error) { onMapDone(false, s.error, st.id); return false; }
  return true;
}
function loop() {
  if (!running) return;
  if (advance()) timer = setTimeout(loop, delay());
}
function onMapDone(ok, error, id) {
  mapResults[mapIdx] = ok;
  if (!ok) {
    running = false; stopRun();
    if (id) document.querySelector(`.blk[data-id="${id}"]`)?.classList.add('bad');
    setStatus(ERRORS[error] + (maps.length > 1 ? ` (лабіринт ${mapIdx + 1})` : ''), 'err');
    renderTabs();
    return;
  }
  const remaining = maps.map((_, i) => i).filter(i => mapResults[i] !== true);
  if (remaining.length) {
    setStatus(`Лабіринт ${mapIdx + 1} пройдено! Далі — лабіринт ${remaining[0] + 1}.`, 'ok');
    renderTabs();
    const go = () => { mapIdx = remaining[0]; drawWorld(); startGen(); if (running) timer = setTimeout(loop, delay()); };
    if (running) timer = setTimeout(go, Math.max(500, delay() * 2)); else go();
    return;
  }
  stopRun(); renderTabs();
  setStatus(maps.length > 1 ? 'Усі лабіринти пройдено!' : 'Прапорець!', 'ok');
  setTimeout(() => complete(), 400);
}
$('runBtn').onclick = () => {
  if (running) { stopRun(); return; }
  if (!prog.length) { toast('Спершу додайте блоки в програму'); return; }
  if (!gen || !stepping) { mapResults = []; mapIdx = 0; drawWorld(); startGen(); }
  stepping = false; running = true;
  $('runLabel').textContent = 'Стоп'; $('runBtn').firstElementChild.outerHTML = icon('stop');
  $('program').style.pointerEvents = 'none';
  setStatus('');
  timer = setTimeout(loop, 150);
};
$('stepBtn').onclick = () => {
  if (running) return;
  if (!prog.length) { toast('Спершу додайте блоки в програму'); return; }
  if (!gen) { mapResults = []; drawWorld(); startGen(); setStatus('Покроково: натискайте «Крок».'); }
  stepping = true;
  advance();
};
$('resetBtn').onclick = () => resetWorld();
$('speed').oninput = () => { if (running) { clearTimeout(timer); timer = setTimeout(loop, delay()); } };

function complete() {
  const blocks = countBlocks(prog), opt = OPT[level.id], stars = starsFor(blocks, opt);
  const prev = best(level.id);
  if (!prev || stars > prev.stars || (stars === prev.stars && blocks < prev.blocks)) { progress.best[level.id] = { stars: Math.max(stars, prev?.stars || 0), blocks, at: Date.now() }; saveProgress(); }
  $('resStars').innerHTML = [0, 1, 2].map(i => icon('star', i < stars ? 'on' : '')).join('');
  $('resMsg').textContent = stars === 3 ? `Найкоротша програма — ${blocks} ${blocks < 5 ? 'блоки' : 'блоків'}. Чудово!` : `Ваша програма — ${blocks} блоків, а можна вкластися в ${opt}. ${stars === 2 ? 'Майже!' : 'Пошукайте, що повторюється, — і загорніть це в цикл.'}`;
  const nx = cur + 1 < LEVELS.length;
  $('resNext').disabled = !nx || !unlocked(cur + 1);
  $('resNext').innerHTML = nx ? 'Далі' + icon('arrow') : 'Усі рівні пройдено';
  $('resRetry').hidden = stars === 3;
  $('result').hidden = false;
  setTimeout(() => $('resNext').focus(), 50);
}
$('resRetry').onclick = () => { $('result').hidden = true; resetWorld(); };
$('resNext').onclick = () => openLevel(cur + 1);
$('resLevels').onclick = () => showHome();

/* ═════════ Рівні ═════════ */
function openLevel(i) {
  if (!LEVELS[i] || !unlocked(i)) { showHome(); return; }
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  cur = i; level = LEVELS[i];
  $('home').hidden = true; $('play').hidden = false; $('result').hidden = true;
  $('lvlChapter').textContent = CHAPTERS.find(c => c.id === level.chapter).name;
  $('lvlName').textContent = `${i + 1}. ${level.name}`;
  $('lvlHint').textContent = level.hint;
  $('navNum').textContent = `${i + 1} / ${LEVELS.length}`;
  $('prevBtn').disabled = i === 0;
  $('nextBtn').disabled = !(i + 1 < LEVELS.length && unlocked(i + 1));
  maps = level.maps.map(m => parseMap(m, level.dir)); mapIdx = 0;
  prog = revive(progress.drafts[level.id]); undoStack = [];
  cursor = { list: 'main', i: prog.length };
  renderPalette(); renderProgram(); resetWorld();
  if (location.hash !== '#' + level.id) window.history.replaceState(null, '', '#' + level.id);
}
function showHome() {
  stopRun(); cur = -1; level = null;
  $('play').hidden = true; $('result').hidden = true; $('home').hidden = false;
  window.history.replaceState(null, '', location.pathname);
  renderHome();
}
function thumb(l) {
  const m = parseMap(l.maps[0], l.dir), t = 10;
  return `<svg viewBox="0 0 ${m.w * t} ${m.h * t}">${mapSvg(m, t, { mini: true })}</svg>`;
}
function nextToPlay() {
  let i = LEVELS.findIndex((l, k) => unlocked(k) && !best(l.id)?.stars);
  if (i < 0) i = LEVELS.findIndex(l => (best(l.id)?.stars || 0) < 3);
  return i;
}
function renderHome() {
  $('chapters').innerHTML = CHAPTERS.map((ch, ci) => {
    const items = LEVELS.map((l, i) => ({ l, i })).filter(x => x.l.chapter === ch.id);
    const got = items.reduce((s, { l }) => s + (best(l.id)?.stars || 0), 0);
    return `<section class="chapter"><div class="chapter-head"><span class="ch-num">${ci + 1}</span><div class="ch-text"><h2>${ch.name}</h2><span>${ch.desc}</span></div><span class="ch-stars">${icon('star')}${got} / ${items.length * 3}</span></div><div class="levels">${items.map(({ l, i }) => {
      const b = best(l.id), open = unlocked(i);
      return `<button class="lvl${b?.stars === 3 ? ' perfect' : ''}${open && !b ? ' fresh' : ''}" data-level="${i}" ${open ? '' : 'disabled title="Спершу пройдіть попередній рівень"'}>
        <div class="lvl-thumb">${open ? thumb(l) : `<span class="lvl-lock">${icon('lock')}</span>`}</div>
        <span class="lvl-num">${i + 1}</span>
        <div class="lvl-name">${esc(l.name)}</div>
        <div class="lvl-meta">${starsHtml(b?.stars || 0)}<span class="lvl-acc">${b ? b.blocks + ' бл.' : ''}</span></div>
      </button>`;
    }).join('')}</div></section>`;
  }).join('');
  const st = totalStars(), max = LEVELS.length * 3, pct = Math.round(passed() / LEVELS.length * 100);
  $('total').innerHTML = icon('star') + st + ' / ' + max;
  $('heroStars').textContent = st; $('heroMax').textContent = max;
  $('heroShort').textContent = LEVELS.filter(l => best(l.id) && best(l.id).blocks <= OPT[l.id]).length;
  $('ringPct').textContent = pct + '%';
  $('ringFg').style.strokeDashoffset = String(326.7 * (1 - pct / 100));
  const n = nextToPlay();
  $('continueBtn').hidden = n < 0;
  if (n >= 0) { $('continueBtn').innerHTML = icon('play') + (passed() ? 'Продовжити' : 'Почати') + `: рівень ${n + 1} · ${esc(LEVELS[n].name)}`; $('continueBtn').dataset.level = n; }
}
$('chapters').addEventListener('click', e => { const b = e.target.closest('[data-level]'); if (b && !b.disabled) openLevel(+b.dataset.level); });
$('continueBtn').onclick = () => openLevel(+$('continueBtn').dataset.level);
$('homeBtn').onclick = () => showHome();
$('backBtn').onclick = () => showHome();
$('prevBtn').onclick = () => openLevel(cur - 1);
$('nextBtn').onclick = () => openLevel(cur + 1);

/* ═════════ Клавіатура ═════════ */
document.addEventListener('keydown', e => {
  if (!$('report').hidden) { if (e.key === 'Escape') $('report').hidden = true; return; }
  if (!$('result').hidden) {
    if (e.key === 'Escape') $('resLevels').click();
    else if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); (!$('resNext').disabled ? $('resNext') : $('resRetry')).click(); }
    return;
  }
  if ($('play').hidden || (e.target.closest && e.target.closest('input, select, textarea'))) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key === 'Enter') { e.preventDefault(); $('runBtn').click(); return; }
  if (running) { if (e.key === 'Escape') stopRun(); return; }
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (undoStack.length) { prog = revive(JSON.parse(undoStack.pop())); cursor = { list: 'main', i: prog.length }; changed(); resetWorld(); }
    return;
  }
  const k = { ArrowUp: 'F', ArrowLeft: 'L', ArrowRight: 'R' }[e.key];
  if (k && !mod) { e.preventDefault(); add(k); return; }
  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault();
    const l = lists()[cursor.list];
    if (l && cursor.i > 0) del(l[cursor.i - 1].id);
  }
});

/* ═════════ Результати для вчителя ═════════ */
$('reportBtn').onclick = () => {
  $('studentName').value = progress.name;
  $('reportSum').innerHTML = `Пройдено рівнів: <b>${passed()} з ${LEVELS.length}</b><br>Зірок: <b>${totalStars()} з ${LEVELS.length * 3}</b><br>Найкоротших програм: <b>${LEVELS.filter(l => best(l.id) && best(l.id).blocks <= OPT[l.id]).length}</b>`;
  $('report').hidden = false;
  setTimeout(() => $('studentName').focus(), 30);
};
$('report').addEventListener('click', e => { if (e.target.id === 'report' || e.target.closest('[data-close]')) $('report').hidden = true; });
$('studentName').addEventListener('input', e => { progress.name = e.target.value; saveProgress(); });
$('resetProgress').onclick = () => {
  if (!confirm('Скинути весь прогрес? Зірки й збережені програми буде видалено.')) return;
  progress.best = {}; progress.drafts = {}; saveProgress(); $('report').hidden = true; renderHome(); toast('Прогрес скинуто');
};
$('downloadReport').onclick = async () => {
  const name = $('studentName').value.trim();
  if (!name) { $('studentName').focus(); toast('Вкажіть ім’я — так учитель знатиме, чиї це результати'); return; }
  const blob = await reportImage(name);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'robot-' + name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() + '.png';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
};
function starPath(x, cx, cy, r) {
  x.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  x.closePath();
}
export async function reportImage(name) {
  const W = 1200, PAD = 40, HEAD = 190, ROW = 44;
  const half = Math.ceil(LEVELS.length / 2);
  const c = document.createElement('canvas'); c.width = W; c.height = HEAD + half * ROW + 60;
  const x = c.getContext('2d');
  const font = (w, s, mono) => `${w} ${s}px ${mono ? 'JetBrains Mono, monospace' : 'Inter, system-ui, sans-serif'}`;
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, c.height);
  x.fillStyle = '#4F6BF4'; x.fillRect(0, 0, W, 8);
  x.fillStyle = '#1a1d23'; x.font = font(800, 30); x.fillText('Алгоритми з роботом — результати', PAD, 62);
  x.font = font(600, 20); x.fillStyle = '#4b5563'; x.fillText(name, PAD, 98);
  x.font = font(500, 15); x.fillStyle = '#9ca3af'; x.fillText(new Date().toLocaleString('uk-UA', { dateStyle: 'long', timeStyle: 'short' }), PAD, 124);
  const short = LEVELS.filter(l => best(l.id) && best(l.id).blocks <= OPT[l.id]).length;
  [['Пройдено', `${passed()} / ${LEVELS.length}`], ['Зірки', `${totalStars()} / ${LEVELS.length * 3}`], ['Найкоротших програм', String(short)]].forEach(([k, v], i) => {
    const bx = W - PAD - (3 - i) * 190;
    x.fillStyle = '#f3f5f9'; x.beginPath(); x.roundRect(bx, 40, 176, 92, 14); x.fill();
    x.fillStyle = '#9ca3af'; x.font = font(600, 13); x.fillText(k, bx + 16, 66);
    x.fillStyle = '#1a1d23'; x.font = font(800, 30); x.fillText(v, bx + 16, 110);
  });
  const colW = (W - PAD * 2) / 2;
  LEVELS.forEach((l, i) => {
    const ox = PAD + Math.floor(i / half) * colW, oy = HEAD + (i % half) * ROW, b = best(l.id);
    if (i % 2 === 0) { x.fillStyle = '#f7f8fa'; x.fillRect(ox - 8, oy - 28, colW - 20, ROW); }
    x.fillStyle = '#9ca3af'; x.font = font(700, 13, true); x.fillText(String(i + 1).padStart(2, '0'), ox, oy);
    x.fillStyle = '#1a1d23'; x.font = font(600, 16); x.fillText(l.name, ox + 34, oy);
    if (b) {
      for (let s = 0; s < 3; s++) { starPath(x, ox + 330 + s * 20, oy - 6, 8); x.fillStyle = s < b.stars ? '#f5b942' : '#e2e5ea'; x.fill(); }
      x.fillStyle = b.blocks <= OPT[l.id] ? '#10b981' : '#1a1d23'; x.font = font(700, 14, true); x.fillText(`${b.blocks} бл. (мін. ${OPT[l.id]})`, ox + 400, oy);
    } else { x.fillStyle = '#b0b6c2'; x.font = font(500, 14); x.fillText('не пройдено', ox + 330, oy); }
  });
  x.fillStyle = '#9ca3af'; x.font = font(500, 13); x.fillText('Edvault · Алгоритми з роботом', PAD, c.height - 22);
  return new Promise(r => c.toBlob(r, 'image/png'));
}

/* ═════════ Старт ═════════ */
const fromHash = LEVELS.findIndex(l => '#' + l.id === location.hash);
if (fromHash >= 0 && unlocked(fromHash)) openLevel(fromHash); else showHome();
window.RobotTrainer = { LEVELS, OPT, get progress() { return progress; }, get program() { return prog; }, setProgram(p) { prog = revive(p); cursor = { list: 'main', i: prog.length }; changed(); resetWorld(); }, openLevel, reportImage };
