// Мишка й точність · Edvault — рівні, ігрове поле для кожної навички, прогрес і результати.
import { CHAPTERS, LEVELS } from './levels.js';
import { rng, placeNext, marqueeRound, judgeSelection, normRect, inRect, dragLayout, accuracy, starsFor, fmtTime } from './logic.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ═════════ Іконки ═════════ */
const P = {
  mouse: '<rect x="5" y="2" width="14" height="20" rx="7"/><path d="M12 6v4"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  left: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  down: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  star: '<path fill="currentColor" stroke="none" d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
};
const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
const starsHtml = n => `<span class="stars">${[0, 1, 2].map(i => icon('star', i < n ? 'on' : '')).join('')}</span>`;
document.querySelectorAll('[data-icon]').forEach(e => { e.outerHTML = icon(e.dataset.icon); });
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2200); }

// Мишка з підсвіченою кнопкою: L — ліва, LL — двічі ліва, R — права, drag — затиснути й вести, box — рамка, wheel — коліщатко.
function mouseSvg(mode, mini = false) {
  const on = part => ({ L: 'l', LL: 'l', drag: 'l', box: 'l', R: 'r', wheel: 'w' }[mode] === part ? ' on' : '');
  const extra = {
    LL: '<text x="30" y="64" text-anchor="middle" class="m-txt">2×</text>',
    drag: '<path class="m-ico" d="M30 46v24M18 58h24M30 46l-4 4M30 46l4 4M30 70l-4-4M30 70l4-4M18 58l4-4M18 58l4 4M42 58l-4-4M42 58l-4 4"/>',
    box: '<rect class="m-ico" x="19" y="48" width="22" height="18" rx="2" stroke-dasharray="4 3"/>',
    wheel: '<path class="m-ico" d="M30 46v22M24 52l6-6 6 6M24 62l6 6 6-6"/>',
  }[mode] || '';
  return `<svg class="mouse-svg${mini ? ' mini' : ''}" viewBox="0 0 60 84" aria-hidden="true">
    <rect class="m-body" x="6" y="4" width="48" height="76" rx="24"/>
    <path class="m-btn${on('l')}" d="M29 34V4.1A24 24 0 0 0 6 28V34Z"/>
    <path class="m-btn${on('r')}" d="M31 34V4.1A24 24 0 0 1 54 28V34Z"/>
    <rect class="m-wheel${on('w')}" x="26" y="12" width="8" height="16" rx="4"/>
    ${mini ? '' : extra}
  </svg>`;
}

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
const KEY = 'edvault-mouse';
let progress = (() => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } })();
if (!progress || typeof progress !== 'object') progress = {};
progress = { name: progress.name || '', best: progress.best || {} };
const saveProgress = () => { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* немає місця */ } };
const best = id => progress.best[id];
const unlocked = i => i === 0 || (best(LEVELS[i - 1].id)?.stars || 0) >= 1;
const passed = () => LEVELS.filter(l => best(l.id)?.stars).length;
const totalStars = () => LEVELS.reduce((s, l) => s + (best(l.id)?.stars || 0), 0);
const clean = () => LEVELS.filter(l => best(l.id) && best(l.id).misses === 0).length;

/* ═════════ Фігури й кольори ═════════ */
const PALETTE = ['#4F6BF4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444'];
const MENU_COLORS = [['#ef4444', 'Червоний'], ['#10b981', 'Зелений'], ['#3b82f6', 'Синій'], ['#f59e0b', 'Жовтий']];
const starPts = (cx, cy, R, r, n = 5) => Array.from({ length: n * 2 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / n, d = i % 2 ? r : R; return `${(cx + Math.cos(a) * d).toFixed(1)},${(cy + Math.sin(a) * d).toFixed(1)}`; }).join(' ');
const SHAPES = [
  { k: 'circle', c: '#4F6BF4', d: '<circle cx="50" cy="50" r="42"/>' },
  { k: 'square', c: '#10b981', d: '<rect x="10" y="10" width="80" height="80" rx="10"/>' },
  { k: 'triangle', c: '#f59e0b', d: '<path d="M50 8 93 88H7Z" stroke-linejoin="round"/>' },
  { k: 'star', c: '#ec4899', d: `<polygon points="${starPts(50, 53, 46, 20)}" stroke-linejoin="round"/>` },
  { k: 'diamond', c: '#8b5cf6', d: '<path d="M50 5 93 50 50 95 7 50Z" stroke-linejoin="round"/>' },
  { k: 'hexagon', c: '#06b6d4', d: `<polygon points="${starPts(50, 50, 45, 45, 3)}" stroke-linejoin="round"/>` },
  { k: 'heart', c: '#ef4444', d: '<path d="M50 88C20 66 6 50 6 32 6 18 17 8 30 8c9 0 16 5 20 12 4-7 11-12 20-12 13 0 24 10 24 24 0 18-14 34-44 56Z" stroke-linejoin="round"/>' },
  { k: 'plus', c: '#84cc16', d: '<path d="M36 8h28v28h28v28H64v28H36V64H8V36h28Z" stroke-linejoin="round"/>' },
];
const shapeSvg = (s, outline) => `<svg viewBox="0 0 100 100" aria-hidden="true" style="--c:${s.c}" class="${outline ? 'outline' : 'solid'}">${s.d}</svg>`;
const GEM = `<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="${starPts(50, 54, 46, 21)}" stroke-linejoin="round"/></svg>`;
const ROCK = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M18 70 10 48 26 24 52 14 78 24 92 50 82 76 54 88 30 84Z" stroke-linejoin="round"/></svg>';

/* ═════════ Гра ═════════ */
let level = null, cur = -1, G = null;
const field = $('field');
const DBL = 600; // мс між двома клацаннями — щедро для молодших школярів
const fieldSize = () => ({ W: field.clientWidth, H: field.clientHeight });
const local = e => { const r = field.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const centerOf = el => { const r = el.getBoundingClientRect(), f = field.getBoundingClientRect(); return { x: r.left - f.left + r.width / 2, y: r.top - f.top + r.height / 2 }; };
const later = (fn, ms) => { const t = setTimeout(fn, ms); G?.timers.push(t); return t; };

function setTask(text, mode) {
  $('taskText').innerHTML = text;
  if ($('taskMouse').dataset.m !== mode) { $('taskMouse').dataset.m = mode; $('taskMouse').innerHTML = mouseSvg(mode, true); }
}
function hud() {
  const total = G?.total ?? level.count, hits = G?.hits || 0;
  $('hudCount').textContent = `${hits} / ${total}`;
  $('hudMiss').textContent = G?.misses || 0;
  $('hudMiss').classList.toggle('bad', (G?.misses || 0) > 1);
  $('hudTime').textContent = fmtTime(G?.t0 ? ((G.end || performance.now()) - G.t0) / 1000 : 0);
  $('taskProg').style.width = (hits / total * 100) + '%';
}
function burst(p, color) {
  const b = document.createElement('div');
  b.className = 'burst'; b.style.left = p.x + 'px'; b.style.top = p.y + 'px'; b.style.setProperty('--c', color);
  b.innerHTML = Array.from({ length: 10 }, (_, i) => `<i style="--a:${i * 36}deg"></i>`).join('');
  (G?.layer || field).appendChild(b);
  setTimeout(() => b.remove(), 650);
}
function ripple(p) {
  const b = document.createElement('div');
  b.className = 'miss-ring'; b.style.left = p.x + 'px'; b.style.top = p.y + 'px';
  (G?.layer || field).appendChild(b);
  setTimeout(() => b.remove(), 600);
}
function hit(p, color) {
  G.hits++;
  if (p) burst(p, color);
  hud();
  if (G.hits >= G.total) { G.done = true; G.end = performance.now(); later(finish, 450); }
}
let lastHint = 0;
function miss(p, msg) {
  G.misses++;
  if (p) ripple(p);
  if (msg && performance.now() - lastHint > 900) { lastHint = performance.now(); toast(msg); }
  hud();
}

function prepare() {
  stopGame();
  field.innerHTML = ''; field.className = 'field k-' + level.kind;
  $('startOv').hidden = false;
  $('startMouse').innerHTML = mouseSvg(modeFor(), false);
  $('startTitle').textContent = level.name;
  $('startHint').textContent = level.hint;
  G = null; hud();
  setTask(taskFor(), modeFor());
}
const modeFor = (need) => ({ click: 'L', dbl: need || 'LL', right: need || 'R', drag: 'drag', marquee: 'box', scroll: 'wheel' }[level.kind]);
function taskFor(need) {
  if (level.kind === 'click') return 'Клацніть кульку лівою кнопкою';
  if (level.kind === 'dbl') return need === 'L' ? 'Клацніть <b>один</b> раз' : 'Клацніть ціль <b>двічі</b> швидко';
  if (level.kind === 'right') return level.menu ? 'Права кнопка по цілі, потім виберіть у меню колір її рамки' : need === 'L' ? 'Клацніть ціль <b>лівою</b> кнопкою' : 'Клацніть ціль <b>правою</b> кнопкою';
  if (level.kind === 'drag') return 'Перетягніть кожну фігуру на її контур';
  if (level.kind === 'marquee') return 'Обведіть рамкою всі зірки, але жодного камінця';
  if (level.kind === 'scroll') return level.houses ? 'Знайдіть потрібний будинок' : 'Прокрутіть коліщатком і знайдіть жовту зірку';
}
function start() {
  if (!level || (G && G.running)) return;
  stopGame();
  field.innerHTML = '';
  $('startOv').hidden = true;
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  G = { running: true, hits: 0, misses: 0, total: level.count, r: rng(Date.now() ^ (cur * 7919)), timers: [], layer: field, t0: performance.now() };
  KINDS[level.kind].setup();
  hud();
  G.tick = setInterval(hud, 100);
}
function stopGame() {
  if (!G) return;
  G.running = false;
  clearInterval(G.tick); G.timers.forEach(clearTimeout); cancelAnimationFrame(G.raf);
}
function abort() { prepare(); }

field.addEventListener('pointerdown', e => { if (G?.running && !G.done) KINDS[level.kind].down?.(e); });
field.addEventListener('pointermove', e => { if (G?.running && !G.done) KINDS[level.kind].move?.(e); });
field.addEventListener('pointerup', e => { if (G?.running && !G.done) KINDS[level.kind].up?.(e); });
$('arena').addEventListener('contextmenu', e => e.preventDefault());

/* ── клацання, подвійне, права кнопка ── */
function spawn() {
  if (G.spawned >= G.total || G.done) return;
  const { W, H } = fieldSize(), size = level.size, r = G.r;
  const p = placeNext(W, H, size, G.prev, r); G.prev = p;
  let need = { click: 'L', dbl: 'LL', right: 'R' }[level.kind];
  if (level.mix) need = r() < 0.5 ? 'L' : need;
  let color = PALETTE[G.spawned % PALETTE.length];
  if (level.mix) color = need === 'L' ? '#4F6BF4' : need === 'R' ? '#f97316' : '#8b5cf6';
  if (level.kind === 'right' && !level.mix) color = '#f97316';
  const el = document.createElement('div');
  el.className = 'tg'; el.dataset.need = need;
  el.style.cssText = `left:${p.x - size / 2}px;top:${p.y - size / 2}px;width:${size}px;height:${size}px;--c:${color}`;
  let inner = '';
  if (need === 'LL') inner = `<b style="font-size:${Math.round(size * 0.3)}px">2×</b>`;
  if (level.kind === 'right' && level.mix) { inner = mouseSvg(need, true); el.classList.add('ico'); }
  if (level.menu) { const [want] = r.pick(MENU_COLORS); el.dataset.want = want; el.classList.add('want'); el.style.setProperty('--w', want); inner = icon('palette'); }
  el.innerHTML = `<span class="tg-in">${inner}</span>`;
  if (level.speed) { const a = r() * Math.PI * 2; el._m = { x: p.x, y: p.y, vx: Math.cos(a) * level.speed, vy: Math.sin(a) * level.speed }; }
  field.appendChild(el);
  G.spawned++;
  setTask(taskFor(need), modeFor(need));
}
function take(t) {
  const p = centerOf(t), c = getComputedStyle(t).getPropertyValue('--c');
  t.remove();
  hit(p, c);
  spawn();
}
function closeMenu() { G.menu?.el.remove(); G.menu = null; }
function openMenu(t, p) {
  closeMenu();
  const el = document.createElement('div');
  el.className = 'ctx';
  el.innerHTML = `<div class="ctx-head">${icon('palette')}Розфарбувати</div>` + G.r.shuffle(MENU_COLORS).map(([c, n]) => `<button class="ctx-item" data-color="${c}"><i style="background:${c}"></i>${n}</button>`).join('') + '<div class="ctx-sep"></div><div class="ctx-item off">Копіювати</div><div class="ctx-item off">Видалити</div>';
  field.appendChild(el);
  const { W, H } = fieldSize();
  el.style.left = Math.min(p.x, W - el.offsetWidth - 6) + 'px';
  el.style.top = Math.min(p.y, H - el.offsetHeight - 6) + 'px';
  G.menu = { el, t };
}
const TARGETS = {
  setup() { G.spawned = 0; G.prev = null; spawn(); if (level.speed) moveLoop(); },
  down(e) {
    const p = local(e);
    if (G.menu) {
      const it = e.target.closest('.ctx-item:not(.off)');
      if (it && e.button === 0) {
        const { t } = G.menu;
        if (it.dataset.color === t.dataset.want) { closeMenu(); t.style.setProperty('--c', t.dataset.want); t.classList.add('painted'); later(() => take(t), 180); }
        else miss(p, 'Не той колір — подивіться на рамку цілі');
        return;
      }
      if (!e.target.closest('.ctx')) closeMenu();
      if (e.button !== 2) return;
    }
    const t = e.target.closest('.tg');
    if (!t || t.classList.contains('painted')) { if (e.button === 0 || e.button === 2) miss(p, G.misses >= 2 ? 'Спершу наведіть мишку на ціль, потім клацайте' : null); return; }
    const need = t.dataset.need;
    if (need === 'L') {
      if (e.button === 0) take(t); else if (e.button === 2) miss(p, 'Цю ціль клацають лівою кнопкою');
    } else if (need === 'R') {
      if (e.button === 2) { if (level.menu) openMenu(t, p); else take(t); } else if (e.button === 0) miss(p, 'Цю ціль клацають правою кнопкою');
    } else if (need === 'LL') {
      if (e.button !== 0) { miss(p, 'Двічі лівою кнопкою'); return; }
      const now = performance.now();
      if (t._last && now - t._last < DBL) { clearTimeout(t._tm); take(t); return; }
      t._last = now; t.classList.add('half');
      t._tm = later(() => { if (!t.isConnected || !G.running) return; t._last = 0; t.classList.remove('half'); miss(centerOf(t), 'Швидше! Два клацання майже одночасно'); }, DBL + 40);
    }
  },
};
function moveLoop() {
  let last = performance.now();
  const step = now => {
    if (!G?.running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const { W, H } = fieldSize(), h = level.size / 2;
    field.querySelectorAll('.tg').forEach(t => {
      const m = t._m; if (!m) return;
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.x < h) { m.x = h; m.vx = Math.abs(m.vx); } if (m.x > W - h) { m.x = W - h; m.vx = -Math.abs(m.vx); }
      if (m.y < h) { m.y = h; m.vy = Math.abs(m.vy); } if (m.y > H - h) { m.y = H - h; m.vy = -Math.abs(m.vy); }
      t.style.left = m.x - h + 'px'; t.style.top = m.y - h + 'px';
    });
    G.raf = requestAnimationFrame(step);
  };
  G.raf = requestAnimationFrame(step);
}

/* ── перетягування ── */
const setPos = (el, p, size) => { el._x = p.x; el._y = p.y; el.style.left = p.x - size / 2 + 'px'; el.style.top = p.y - size / 2 + 'px'; };
const DRAG = {
  setup() {
    const { W, H } = fieldSize(), size = level.size, r = G.r;
    const { items, slots } = dragLayout(level.count, size, W, H, r);
    const shapes = r.shuffle(SHAPES).slice(0, level.count);
    field.insertAdjacentHTML('beforeend', '<div class="drag-split"></div>');
    shapes.forEach((s, i) => {
      const sl = document.createElement('div');
      sl.className = 'slot-sh'; sl.dataset.k = s.k; sl.style.width = sl.style.height = size + 'px'; sl.innerHTML = shapeSvg(s, true);
      setPos(sl, slots[i], size); field.appendChild(sl);
      const it = document.createElement('div');
      it.className = 'item'; it.dataset.k = s.k; it.style.width = it.style.height = size + 'px'; it.innerHTML = shapeSvg(s, false);
      setPos(it, items[i], size); it._home = items[i]; it._c = s.c; field.appendChild(it);
    });
  },
  nearest(p) {
    let b = null, bd = Infinity;
    field.querySelectorAll('.slot-sh:not(.filled)').forEach(s => { const d = Math.hypot(s._x - p.x, s._y - p.y); if (d < bd) { bd = d; b = s; } });
    return { s: b, d: bd };
  },
  down(e) {
    const it = e.target.closest('.item:not(.placed)');
    if (!it || e.button !== 0) return;
    const p = local(e);
    G.drag = { it, dx: p.x - it._x, dy: p.y - it._y, id: e.pointerId };
    field.setPointerCapture(e.pointerId);
    it.classList.add('lift'); it.classList.remove('back');
    field.appendChild(it);
  },
  move(e) {
    if (!G.drag) return;
    const p = local(e), { it } = G.drag;
    setPos(it, { x: p.x - G.drag.dx, y: p.y - G.drag.dy }, level.size);
    const { s, d } = DRAG.nearest({ x: it._x, y: it._y });
    field.querySelectorAll('.slot-sh.hover').forEach(x => x.classList.remove('hover'));
    if (s && d < level.size * 0.8) s.classList.add('hover');
  },
  up() {
    if (!G.drag) return;
    const { it } = G.drag; G.drag = null;
    it.classList.remove('lift');
    field.querySelectorAll('.slot-sh.hover').forEach(x => x.classList.remove('hover'));
    const size = level.size, at = { x: it._x, y: it._y };
    const { s, d } = DRAG.nearest(at);
    const goHome = () => { it.classList.add('back'); setPos(it, it._home, size); };
    if (s && s.dataset.k === it.dataset.k && d <= size * level.tol) {
      setPos(it, { x: s._x, y: s._y }, size); it.classList.add('placed'); s.classList.add('filled');
      hit({ x: s._x, y: s._y }, it._c);
      return;
    }
    if (s && s.dataset.k !== it.dataset.k && d < size * 0.6) { miss(at, 'Ця фігура не сюди — шукайте такий самий контур'); goHome(); return; }
    const same = field.querySelector(`.slot-sh[data-k="${it.dataset.k}"]`);
    if (same && Math.hypot(same._x - at.x, same._y - at.y) < size * 1.1) { miss(at, 'Майже! Відпускайте точно над контуром'); goHome(); return; }
    goHome();
  },
};

/* ── рамка ── */
const MARQUEE = {
  setup() { MARQUEE.round(); },
  round() {
    field.innerHTML = '';
    const { W, H } = fieldSize(), size = level.size;
    const R = marqueeRound(level, W, H, G.r);
    G.mq = R;
    const put = (p, cls, svg) => { const el = document.createElement('div'); el.className = cls; el.style.cssText = `width:${size}px;height:${size}px;left:${p.x - size / 2}px;top:${p.y - size / 2}px`; el.innerHTML = svg; field.appendChild(el); return el; };
    G.mqEls = { goods: R.goods.map(p => put(p, 'gem', GEM)), bads: R.bads.map(p => put(p, 'rock', ROCK)) };
  },
  live(rect) {
    G.mq.goods.forEach((p, i) => G.mqEls.goods[i].classList.toggle('sel', inRect(p, rect)));
    G.mq.bads.forEach((p, i) => G.mqEls.bads[i].classList.toggle('sel', inRect(p, rect)));
  },
  down(e) {
    if (e.button !== 0 || G.lock) return;
    const p = local(e);
    const el = document.createElement('div'); el.className = 'band'; field.appendChild(el);
    G.band = { x0: p.x, y0: p.y, el };
    field.setPointerCapture(e.pointerId);
    field.querySelectorAll('.need, .bad').forEach(x => x.classList.remove('need', 'bad'));
  },
  move(e) {
    if (!G.band) return;
    const p = local(e), r = normRect(G.band.x0, G.band.y0, p.x, p.y);
    Object.assign(G.band.el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    MARQUEE.live(r);
  },
  up(e) {
    if (!G.band) return;
    const p = local(e), rect = normRect(G.band.x0, G.band.y0, p.x, p.y);
    G.band.el.remove(); G.band = null;
    MARQUEE.live({ x: -1, y: -1, w: 0, h: 0 });
    if (rect.w < 8 && rect.h < 8) { toast('Затисніть кнопку й тягніть — з’явиться рамка'); return; }
    const j = judgeSelection(rect, G.mq.goods, G.mq.bads);
    if (j.ok) {
      G.mqEls.goods.forEach(g => g.classList.add('got'));
      G.lock = true;
      hit({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }, '#f5b942');
      if (!G.done) later(() => { G.lock = false; MARQUEE.round(); }, 550);
      return;
    }
    j.missed.forEach(i => G.mqEls.goods[i].classList.add('need'));
    j.extra.forEach(i => G.mqEls.bads[i].classList.add('bad'));
    miss({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }, j.missed.length ? 'Не всі зірки потрапили в рамку' : 'У рамку потрапив камінець');
  },
};

/* ── прокручування ── */
const SCROLL = {
  setup() {
    const { W, H } = fieldSize(), r = G.r;
    field.innerHTML = '<div class="scroller" id="scroller"><div class="sc-content"></div></div><div class="sc-arrow" hidden></div>';
    const sc = field.querySelector('.scroller'), ct = sc.firstElementChild;
    G.sc = sc;
    if (level.houses) {
      const per = 5, rows = Math.ceil(level.houses / per);
      ct.classList.add('street');
      ct.innerHTML = Array.from({ length: level.houses }, (_, i) => `<button class="house" data-n="${i + 1}" style="--c:${PALETTE[(i * 3) % PALETTE.length]}"><svg viewBox="0 0 100 100" aria-hidden="true"><path class="roof" d="M8 46 50 10 92 46Z"/><rect class="wall" x="18" y="44" width="64" height="48" rx="3"/><rect class="door" x="42" y="62" width="16" height="30" rx="2"/></svg><b>${i + 1}</b></button>`).join('');
      ct.style.minHeight = rows * 140 + 'px';
    } else {
      ct.style.height = H * level.screens + 'px';
      G.decoys = [];
      const shapes = ['circle', 'square', 'triangle', 'diamond', 'star'];
      const colors = ['#4F6BF4', '#10b981', '#ec4899', '#8b5cf6', '#f97316'];
      const sz = level.size;
      for (let i = 0; i < (level.decoys || 0); i++) {
        const k = r.pick(shapes), c = k === 'star' ? r.pick(colors) : r.pick([...colors, '#facc15']);
        const p = { x: sz / 2 + 10 + r() * (W - sz - 40), y: sz / 2 + 10 + r() * (H * level.screens - sz - 20) };
        if (G.decoys.some(q => Math.hypot(q.x - p.x, q.y - p.y) < sz * 1.3)) continue;
        G.decoys.push(p);
        const s = SHAPES.find(x => x.k === k);
        ct.insertAdjacentHTML('beforeend', `<div class="decoy" style="left:${p.x - sz / 2}px;top:${p.y - sz / 2}px;width:${sz}px;height:${sz}px">${shapeSvg({ ...s, c }, false)}</div>`);
      }
      // хмаринки-орієнтири, щоб було видно, що сторінка рухається
      for (let y = 60; y < H * level.screens; y += 170) ct.insertAdjacentHTML('beforeend', `<div class="cloud" style="top:${y}px;left:${(y * 37) % Math.max(1, W - 160)}px"></div>`);
    }
    sc.addEventListener('scroll', SCROLL.arrow, { passive: true });
    SCROLL.next();
  },
  next() {
    if (G.done) return;
    const sc = G.sc, ct = sc.firstElementChild, H = sc.clientHeight, W = sc.clientWidth, r = G.r;
    const view = [sc.scrollTop, sc.scrollTop + H];
    if (level.houses) {
      const all = [...ct.querySelectorAll('.house')];
      const far = all.filter(h => h.offsetTop + h.offsetHeight < view[0] || h.offsetTop > view[1] + 20);
      const h = r.pick(far.length ? far : all);
      G.want = +h.dataset.n;
      setTask(`Знайдіть будинок <b class="big-num">№ ${G.want}</b>`, 'wheel');
      return;
    }
    const sz = level.size, total = ct.offsetHeight;
    let p = null;
    for (let k = 0; k < 300; k++) {
      const q = { x: sz / 2 + 14 + r() * (W - sz - 40), y: sz / 2 + 14 + r() * (total - sz - 28) };
      if (q.y > view[0] - sz && q.y < view[1] + sz) continue;
      if (G.decoys.some(d => Math.hypot(d.x - q.x, d.y - q.y) < sz * 1.2)) continue;
      p = q; break;
    }
    p ||= { x: W / 2, y: view[1] + H / 2 > total - sz ? sz : total - sz };
    ct.insertAdjacentHTML('beforeend', `<div class="sc-star" style="left:${p.x - sz / 2}px;top:${p.y - sz / 2}px;width:${sz}px;height:${sz}px">${GEM}</div>`);
    G.star = p;
    SCROLL.arrow();
  },
  arrow() {
    const a = field.querySelector('.sc-arrow');
    if (!a || !level.arrow || !G?.star) return;
    const sc = G.sc, y = G.star.y;
    const dir = y < sc.scrollTop ? 'up' : y > sc.scrollTop + sc.clientHeight ? 'down' : '';
    a.hidden = !dir;
    if (dir && a.dataset.dir !== dir) { a.dataset.dir = dir; a.innerHTML = icon(dir) + (dir === 'up' ? 'Зірка вище' : 'Зірка нижче'); }
  },
  down(e) {
    if (e.target === G.sc || e.button !== 0) return; // смуга прокрутки
    const p = local(e);
    if (level.houses) {
      const h = e.target.closest('.house'); if (!h) return;
      if (+h.dataset.n === G.want) { h.classList.add('found'); later(() => h.classList.remove('found'), 700); hit(p, '#10b981'); SCROLL.next(); }
      else miss(p, `Це будинок № ${h.dataset.n}. Потрібен № ${G.want}`);
      return;
    }
    const s = e.target.closest('.sc-star');
    if (s) { s.remove(); G.star = null; hit(p, '#f5b942'); SCROLL.next(); return; }
    miss(p, e.target.closest('.decoy') ? 'Це не та фігура — шукайте жовту зірку' : null);
  },
};
const KINDS = { click: TARGETS, dbl: TARGETS, right: TARGETS, drag: DRAG, marquee: MARQUEE, scroll: SCROLL };

/* ═════════ Результат ═════════ */
function finish() {
  stopGame();
  const time = (G.end - G.t0) / 1000, acc = accuracy(G.hits, G.misses), stars = starsFor(time, G.misses, level.par);
  const prev = best(level.id);
  if (!prev || stars > prev.stars || (stars === prev.stars && time < prev.time)) { progress.best[level.id] = { stars, time: Math.round(time * 10) / 10, misses: G.misses, acc, at: Date.now() }; saveProgress(); }
  $('resStars').innerHTML = [0, 1, 2].map(i => icon('star', i < stars ? 'on' : '')).join('');
  $('resTitle').textContent = stars === 3 ? 'Чудово!' : stars === 2 ? 'Добре!' : 'Пройдено!';
  $('resTime').textContent = fmtTime(time);
  $('resAcc').textContent = acc + '%';
  $('resMiss').textContent = G.misses;
  $('resMsg').textContent = stars === 3 ? 'Швидко й точно — так тримати!'
    : G.misses > 1 ? `Промахів: ${G.misses}. Для трьох зірок — не більше одного. Не поспішайте: спершу наведіть, потім клацайте.`
    : `Для трьох зірок — швидше за ${fmtTime(level.par)}. Спробуйте ще раз!`;
  const nx = cur + 1 < LEVELS.length;
  $('resNext').disabled = !nx || !unlocked(cur + 1);
  $('resNext').innerHTML = nx ? 'Далі' + icon('arrow') : 'Усі рівні пройдено';
  $('result').hidden = false;
  setTimeout(() => $('resNext').focus(), 50);
}
$('resRetry').onclick = () => { $('result').hidden = true; prepare(); };
$('resNext').onclick = () => openLevel(cur + 1);
$('resLevels').onclick = () => showHome();
$('startBtn').onclick = () => start();

/* ═════════ Рівні ═════════ */
function openLevel(i) {
  if (!LEVELS[i] || !unlocked(i)) { showHome(); return; }
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  cur = i; level = LEVELS[i];
  $('home').hidden = true; $('play').hidden = false; $('result').hidden = true;
  $('lvlChapter').textContent = CHAPTERS.find(c => c.id === level.chapter).name;
  $('lvlName').textContent = `${i + 1}. ${level.name}`;
  $('navNum').textContent = `${i + 1} / ${LEVELS.length}`;
  $('prevBtn').disabled = i === 0;
  $('nextBtn').disabled = !(i + 1 < LEVELS.length && unlocked(i + 1));
  prepare();
  if (location.hash !== '#' + level.id) window.history.replaceState(null, '', '#' + level.id);
}
function showHome() {
  stopGame(); G = null; cur = -1; level = null;
  $('play').hidden = true; $('result').hidden = true; $('home').hidden = false;
  window.history.replaceState(null, '', location.pathname);
  renderHome();
}
const bull = (cx, cy, r, c) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="#fff"/><circle cx="${cx}" cy="${cy}" r="${r * 0.3}" fill="${c}"/>`;
function thumb(l) {
  const s = (l.size || 60) / 110;
  let g = '';
  if (l.kind === 'click') {
    g = bull(40, 44, 26 * s, '#4F6BF4') + bull(84, 82, 18 * s, '#ec4899') + bull(78, 30, 12 * s, '#10b981');
    if (l.speed) g += '<path d="M14 80h18M10 90h22M18 70h12" stroke="var(--muted)" stroke-width="3" stroke-linecap="round"/>';
  } else if (l.kind === 'dbl') {
    const c = l.mix ? '#8b5cf6' : PALETTE[3], R = 36 * s + 6;
    g = `<circle cx="60" cy="60" r="${R}" fill="${c}"/><circle cx="60" cy="60" r="${R * 0.6}" fill="#fff"/><text x="60" y="${60 + R * 0.2}" text-anchor="middle" font-size="${R * 0.56}" font-weight="800" fill="${c}" font-family="Inter, sans-serif">2×</text>`;
    if (l.mix) g += bull(26, 28, 12, '#4F6BF4');
  } else if (l.kind === 'right') {
    if (l.menu) g = bull(38, 44, 22, '#f97316') + '<rect x="56" y="50" width="48" height="52" rx="6" fill="var(--surface)" stroke="var(--border2)"/>' + MENU_COLORS.map(([c], i) => `<rect x="62" y="${57 + i * 11}" width="8" height="8" rx="2" fill="${c}"/><rect x="74" y="${59 + i * 11}" width="24" height="4" rx="2" fill="var(--border2)"/>`).join('');
    else g = bull(60, 60, 34 * s, '#f97316') + (l.mix ? bull(24, 26, 12, '#4F6BF4') + bull(98, 96, 12, '#f97316') : '');
  } else if (l.kind === 'drag') {
    const a = SHAPES[0], k = 30 * s + 14;
    g = `<g transform="translate(${30 - k / 2} ${60 - k / 2}) scale(${k / 100})" fill="${a.c}">${a.d}</g><g transform="translate(${90 - k / 2} ${60 - k / 2}) scale(${k / 100})" fill="none" stroke="${a.c}" stroke-width="${8 / (k / 100) * 0.4}" stroke-dasharray="10 8">${a.d}</g><path d="M46 60h24m-6-6 6 6-6 6" stroke="var(--muted)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else if (l.kind === 'marquee') {
    const st = (x, y, r) => `<polygon points="${starPts(x, y, r, r * 0.45)}" fill="#f5b942"/>`;
    g = '<rect x="22" y="26" width="64" height="56" rx="4" fill="rgba(79,107,244,.1)" stroke="#4F6BF4" stroke-width="2.5" stroke-dasharray="6 4"/>' + st(40, 46, 9 * s + 4) + st(66, 44, 9 * s + 4) + st(54, 66, 9 * s + 4) + (l.bads ? '<circle cx="100" cy="30" r="7" fill="#94a3b8"/><circle cx="98" cy="92" r="7" fill="#94a3b8"/><circle cx="20" cy="98" r="7" fill="#94a3b8"/>' : '');
  } else if (l.kind === 'scroll') {
    g = '<rect x="18" y="14" width="74" height="92" rx="8" fill="var(--surface)" stroke="var(--border2)"/><rect x="98" y="14" width="8" height="92" rx="4" fill="var(--border)"/><rect x="98" y="54" width="8" height="26" rx="4" fill="#4F6BF4"/>';
    g += l.houses ? '<path d="M34 64 50 50 66 64Z" fill="#ec4899"/><rect x="38" y="63" width="24" height="20" fill="#f9a8d4"/><text x="50" y="78" text-anchor="middle" font-size="11" font-weight="800" fill="#1a1d23">42</text>'
      : `<polygon points="${starPts(55, 74, 12 * s + 6, (12 * s + 6) * 0.45)}" fill="#f5b942"/><path d="M55 30v16m-6-6 6 6 6-6" stroke="var(--muted)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return `<svg viewBox="0 0 120 120">${g}</svg>`;
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
        <div class="lvl-meta">${starsHtml(b?.stars || 0)}<span class="lvl-acc">${b ? fmtTime(b.time) : ''}</span></div>
      </button>`;
    }).join('')}</div></section>`;
  }).join('');
  const st = totalStars(), max = LEVELS.length * 3, pct = Math.round(passed() / LEVELS.length * 100);
  $('total').innerHTML = icon('star') + st + ' / ' + max;
  $('heroStars').textContent = st; $('heroMax').textContent = max;
  $('heroClean').textContent = clean();
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
  if (e.key === 'Enter' && !$('startOv').hidden) { e.preventDefault(); start(); }
  else if (e.key === 'Escape' && G?.running) abort();
});
window.addEventListener('resize', () => { if (G?.running) abort(); });

/* ═════════ Результати для вчителя ═════════ */
$('reportBtn').onclick = () => {
  $('studentName').value = progress.name;
  $('reportSum').innerHTML = `Пройдено рівнів: <b>${passed()} з ${LEVELS.length}</b><br>Зірок: <b>${totalStars()} з ${LEVELS.length * 3}</b><br>Рівнів без промахів: <b>${clean()}</b>`;
  $('report').hidden = false;
  setTimeout(() => $('studentName').focus(), 30);
};
$('report').addEventListener('click', e => { if (e.target.id === 'report' || e.target.closest('[data-close]')) $('report').hidden = true; });
$('studentName').addEventListener('input', e => { progress.name = e.target.value; saveProgress(); });
$('resetProgress').onclick = () => {
  if (!confirm('Скинути весь прогрес? Усі зірки буде видалено.')) return;
  progress.best = {}; saveProgress(); $('report').hidden = true; renderHome(); toast('Прогрес скинуто');
};
$('downloadReport').onclick = async () => {
  const name = $('studentName').value.trim();
  if (!name) { $('studentName').focus(); toast('Вкажіть ім’я — так учитель знатиме, чиї це результати'); return; }
  const blob = await reportImage(name);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mouse-' + name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() + '.png';
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
  x.fillStyle = '#1a1d23'; x.font = font(800, 30); x.fillText('Мишка й точність — результати', PAD, 62);
  x.font = font(600, 20); x.fillStyle = '#4b5563'; x.fillText(name, PAD, 98);
  x.font = font(500, 15); x.fillStyle = '#9ca3af'; x.fillText(new Date().toLocaleString('uk-UA', { dateStyle: 'long', timeStyle: 'short' }), PAD, 124);
  [['Пройдено', `${passed()} / ${LEVELS.length}`], ['Зірки', `${totalStars()} / ${LEVELS.length * 3}`], ['Без промахів', String(clean())]].forEach(([k, v], i) => {
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
      for (let s = 0; s < 3; s++) { starPath(x, ox + 260 + s * 20, oy - 6, 8); x.fillStyle = s < b.stars ? '#f5b942' : '#e2e5ea'; x.fill(); }
      x.fillStyle = '#1a1d23'; x.font = font(700, 14, true); x.fillText(`${fmtTime(b.time)} · ${b.acc}%`, ox + 330, oy);
    } else { x.fillStyle = '#b0b6c2'; x.font = font(500, 14); x.fillText('не пройдено', ox + 260, oy); }
  });
  x.fillStyle = '#9ca3af'; x.font = font(500, 13); x.fillText('Edvault · Мишка й точність', PAD, c.height - 22);
  return new Promise(r => c.toBlob(r, 'image/png'));
}

/* ═════════ Старт ═════════ */
const fromHash = LEVELS.findIndex(l => '#' + l.id === location.hash);
if (fromHash >= 0 && unlocked(fromHash)) openLevel(fromHash); else showHome();
window.MouseTrainer = { LEVELS, get progress() { return progress; }, get game() { return G; }, openLevel, start, reportImage };
