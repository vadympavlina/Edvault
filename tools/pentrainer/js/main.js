// Тренажер пера · Edvault — рівні, гра, оцінка, прогрес і результати для вчителя.
import { CHAPTERS, LEVELS } from './levels.js';
import { parsePath, toPath, score, alignTo } from './geom.js';
import { PenEditor } from './editor.js';
import { planSteps, currentStep } from './steps.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NS = 'http://www.w3.org/2000/svg';

/* ═════════ Іконки ═════════ */
const P = {
  pen: '<path d="M12 19 19 12l3 3-7 7z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18z"/><path d="m2 2 7.59 7.59"/><circle cx="11" cy="11" r="2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  split: '<path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.17-2.83L3 3"/><path d="m15 9 6-6"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  redo: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  left: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
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
const KEY = 'edvault-pentrainer';
let progress = (() => { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && typeof v === 'object' ? { name: v.name || '', best: v.best || {} } : null; } catch (e) { return null; } })() || { name: '', best: {} };
const saveProgress = () => { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* немає місця */ } };
const best = id => progress.best[id];
const unlocked = i => i === 0 || (best(LEVELS[i - 1].id)?.stars || 0) >= 1;
const totalStars = () => LEVELS.reduce((s, l) => s + (best(l.id)?.stars || 0), 0);
const passed = () => LEVELS.filter(l => (best(l.id)?.stars || 0) >= 1).length;

/* ═════════ Рівні (головна) ═════════ */
function thumb(level, b) {
  const closed = parsePath(level.d).closed;
  return `<svg viewBox="40 40 520 520"><path class="t${closed ? '' : ' open'}" d="${level.d}"/>${b && b.d ? `<path class="u" d="${esc(b.d)}"/>` : ''}</svg>`;
}
// наступний рівень для кнопки «Продовжити»: перший відкритий без зірок, інакше — перший без трьох зірок
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
        <div class="lvl-thumb">${open ? thumb(l, b) : `<span class="lvl-lock">${icon('lock')}</span>`}</div>
        <span class="lvl-num">${i + 1}</span>${l.mode === 'copy' ? '<span class="mode-tag">зразок</span>' : ''}
        <div class="lvl-name">${esc(l.name)}</div>
        <div class="lvl-meta">${starsHtml(b?.stars || 0)}<span class="lvl-acc">${b ? b.acc + '%' : ''}</span></div>
      </button>`;
    }).join('')}</div></section>`;
  }).join('');
  const st = totalStars(), max = LEVELS.length * 3, pct = Math.round(passed() / LEVELS.length * 100);
  const accs = LEVELS.map(l => best(l.id)).filter(Boolean);
  $('total').innerHTML = icon('star') + st + ' / ' + max;
  $('heroStars').textContent = st; $('heroMax').textContent = max;
  $('heroAcc').textContent = accs.length ? Math.round(accs.reduce((s, b) => s + b.acc, 0) / accs.length) + '%' : '—';
  $('ringPct').textContent = pct + '%';
  $('ringFg').style.strokeDashoffset = String(326.7 * (1 - pct / 100));
  const n = nextToPlay();
  $('continueBtn').hidden = n < 0;
  if (n >= 0) { $('continueBtn').innerHTML = icon('play') + (passed() ? 'Продовжити' : 'Почати') + `: рівень ${n + 1} · ${esc(LEVELS[n].name)}`; $('continueBtn').dataset.level = n; }
}
$('continueBtn').onclick = () => openLevel(+$('continueBtn').dataset.level);
$('chapters').addEventListener('click', e => { const b = e.target.closest('[data-level]'); if (b && !b.disabled) openLevel(+b.dataset.level); });
$('homeBtn').onclick = () => showHome();

/* ═════════ Гра ═════════ */
let cur = -1, target = null, hintOn = false;
const editor = new PenEditor($('board'), { onChange: updateStats });
const svgEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };

function drawGrid(svg, before) {
  const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'grid');
  for (let v = 50; v < 600; v += 50) { svgEl('line', { x1: v, y1: 0, x2: v, y2: 600, class: v === 300 ? 'mid' : '' }, g); svgEl('line', { x1: 0, y1: v, x2: 600, y2: v, class: v === 300 ? 'mid' : '' }, g); }
  svg.insertBefore(g, before || null);
  return g;
}
function drawTarget(svg, level, before) {
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', level.d); p.setAttribute('class', 'target' + (target.closed ? '' : ' open'));
  svg.insertBefore(p, before || null);
}
// Підказка: ручки фігури (бліді), номери точок, а для поточного кроку — кільце й стрілка «куди тягнути»
let steps = [], guideHost = null;
// стрілка показує напрям; коротку ручку подовжуємо, щоб її було видно
function arrow(g, from, to, cls) {
  const dx = to.x - from.x, dy = to.y - from.y, L0 = Math.hypot(dx, dy);
  if (L0 < 1) return null;
  const L = Math.max(L0, 70), ux = dx / L0, uy = dy / L0;
  to = { x: from.x + ux * L, y: from.y + uy * L };
  const hx = to.x - ux * 14, hy = to.y - uy * 14;
  svgEl('line', { x1: from.x + ux * 12, y1: from.y + uy * 12, x2: hx, y2: hy, class: 'arr ' + cls }, g);
  svgEl('path', { d: `M${to.x} ${to.y} L${hx - uy * 8} ${hy + ux * 8} L${hx + uy * 8} ${hy - ux * 8} Z`, class: 'arr-head ' + cls }, g);
  return to;
}
function drawGuide() {
  if (!guideHost) return;
  guideHost.svg.querySelector(':scope > .guide')?.remove();
  if (!hintOn) return;
  const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'guide');
  const N = target.anchors.length;
  target.anchors.forEach((a, i) => {
    for (const [h, w] of [[a.hin, 'in'], [a.hout, 'out']]) {
      if (!h || (!target.closed && ((i === 0 && w === 'in') || (i === N - 1 && w === 'out')))) continue;
      svgEl('line', { x1: a.x, y1: a.y, x2: h.x, y2: h.y, class: 'h-line' }, g); svgEl('circle', { cx: h.x, cy: h.y, r: 5, class: 'h-dot' }, g);
    }
  });
  const cs = currentStep(steps, editor.state, target);
  const s = cs.step;
  // номер — трохи назовні від фігури, щоб не закривав саму точку
  const cx = target.anchors.reduce((v, a) => v + a.x, 0) / N, cy = target.anchors.reduce((v, a) => v + a.y, 0) / N;
  target.anchors.forEach((a, i) => {
    const isNext = s && s.i === i;
    const done = !s ? !cs.off : i < (s.close ? N : s.i);
    const grp = svgEl('g', { class: 'num' + (isNext ? ' next' : done ? ' done' : '') }, g);
    if (isNext) svgEl('circle', { cx: a.x, cy: a.y, r: 20, class: 'pulse' }, grp);
    svgEl('circle', { cx: a.x, cy: a.y, r: 6, class: 'spot' }, grp);
    let ox = a.x - cx, oy = a.y - cy; const ol = Math.hypot(ox, oy) || 1;
    if (ol < 1) { ox = 0; oy = -1; }
    const bx = a.x + ox / ol * 26, by = a.y + oy / ol * 26;
    svgEl('circle', { cx: bx, cy: by, r: 11, class: 'badge' }, grp);
    const t = svgEl('text', { x: bx, y: by + 4.5 }, grp); t.textContent = i + 1;
  });
  if (s) {
    const a = target.anchors[s.i];
    if (cs.phase === 'then') { if (s.then === 'drag') arrow(g, a, s.thenTo, 'go'); }
    else if (s.act === 'drag') {
      arrow(g, a, s.to, 'go');
      if (s.alt) { const e = arrow(g, a, s.alt, 'alt'); if (e) { const lbl = svgEl('g', { class: 'alt-tag' }, g); svgEl('rect', { x: e.x + 8, y: e.y - 10, width: 34, height: 20, rx: 5 }, lbl); svgEl('text', { x: e.x + 25, y: e.y + 4 }, lbl).textContent = 'Alt'; } }
    }
  }
  guideHost.svg.insertBefore(g, guideHost.before);
}
function updateStep() {
  const card = $('stepCard');
  card.hidden = false;
  if (!hintOn) { $('stepLabel').textContent = 'Підказку вимкнено'; $('stepText').textContent = 'Увімкніть «Підказку» (H), щоб бачити номери точок і куди тягнути.'; $('stepBar').style.width = '0'; card.className = 'step-card off'; return; }
  const cs = currentStep(steps, editor.state, target);
  card.className = 'step-card' + (cs.done ? ' done' : cs.off ? ' warn' : '');
  $('stepLabel').textContent = cs.done ? 'Готово' : cs.off ? 'Увага' : `Крок ${cs.index + 1} / ${cs.total}`;
  $('stepText').textContent = cs.step ? (cs.text || cs.step.text) : cs.text;
  $('stepBar').style.width = (cs.done ? 100 : cs.step ? (cs.index / cs.total) * 100 : 0) + '%';
}
function renderBoards() {
  const lvl = LEVELS[cur], board = $('board'), sample = $('sample');
  board.querySelectorAll(':scope > :not(.pen-layer)').forEach(n => n.remove());
  sample.innerHTML = '';
  const copy = lvl.mode === 'copy';
  $('sampleWrap').hidden = !copy; $('boardLabel').hidden = !copy;
  drawGrid(board, editor.layer);
  if (copy) { drawGrid(sample); drawTarget(sample, lvl); guideHost = { svg: sample, before: null }; }
  else { drawTarget(board, lvl, editor.layer); guideHost = { svg: board, before: editor.layer }; }
  drawGuide(); updateStep();
  $('hintBtn').classList.toggle('on', hintOn);
  fitBoards();
}
// поле завжди квадратне й максимально велике; зразок — менший, поруч
function fitBoards() {
  if (cur < 0) return;
  const st = document.querySelector('.boards'), copy = LEVELS[cur].mode === 'copy';
  const padX = 0, padY = 0;
  const label = copy ? 22 : 0, gap = 22;
  const w = st.clientWidth - padX, h = st.clientHeight - padY - label;
  const size = Math.floor(Math.max(200, copy ? Math.min(h, (w - gap) / 1.42) : Math.min(w, h)));
  $('board').style.width = $('board').style.height = size + 'px';
  const sm = Math.round(size * 0.42);
  $('sample').style.width = $('sample').style.height = sm + 'px';
  editor.render();
}
function openLevel(i) {
  if (!LEVELS[i] || !unlocked(i)) { showHome(); return; }
  cur = i;
  const lvl = LEVELS[i];
  target = parsePath(lvl.d);
  steps = planSteps(target);
  hintOn = lvl.guide;
  $('home').hidden = true; $('play').hidden = false; $('result').hidden = true;
  $('lvlChapter').textContent = CHAPTERS.find(c => c.id === lvl.chapter).name + (lvl.mode === 'copy' ? ' · малюйте на чистому полі' : '');
  $('navNum').textContent = `${i + 1} / ${LEVELS.length}`;
  $('prevBtn').disabled = i === 0;
  $('nextBtn').disabled = !(i + 1 < LEVELS.length && unlocked(i + 1));
  $('lvlName').textContent = lvl.name;
  $('lvlHint').textContent = lvl.hint;
  $('statIdeal').textContent = target.anchors.length;
  const b = best(lvl.id);
  $('statBest').innerHTML = b ? b.acc + '%' : '—';
  editor.reset();
  renderBoards();
  if (i === 0 && !best(lvl.id)) $('keys').open = true;
  if (location.hash !== '#' + lvl.id) history.replaceState(null, '', '#' + lvl.id);
  requestAnimationFrame(() => editor.render()); // розмір маркерів залежить від масштабу поля
  $('board').focus({ preventScroll: true });
}
function showHome() {
  cur = -1;
  $('play').hidden = true; $('result').hidden = true; $('home').hidden = false;
  history.replaceState(null, '', location.pathname);
  renderHome();
}
function updateStats() {
  const n = editor.anchors.length;
  $('statPts').textContent = n;
  $('statPts').classList.toggle('over', target && n > target.anchors.length);
  $('undoBtn').disabled = !editor.undoStack.length;
  $('redoBtn').disabled = !editor.redoStack.length;
  if (cur >= 0) { drawGuide(); updateStep(); }
}
$('backBtn').onclick = () => showHome();
$('prevBtn').onclick = () => openLevel(cur - 1);
$('nextBtn').onclick = () => openLevel(cur + 1);
$('hintBtn').onclick = () => { hintOn = !hintOn; renderBoards(); };
$('altBtn').onclick = () => { editor.altLock = !editor.altLock; $('altBtn').classList.toggle('on', editor.altLock); };
$('undoBtn').onclick = () => editor.undo();
$('redoBtn').onclick = () => editor.redo();
$('clearBtn').onclick = () => editor.clear();
$('checkBtn').onclick = () => check();
window.addEventListener('resize', () => fitBoards());

/* ═════════ Перевірка ═════════ */
function check() {
  if (cur < 0) return;
  const lvl = LEVELS[cur];
  if (editor.anchors.length < 2) { toast('Поставте хоча б дві точки'); return; }
  editor.finish();
  let user = editor.path;
  if (lvl.mode === 'copy') user = { anchors: alignTo(user.anchors, target.anchors, user.closed, target.closed), closed: user.closed };
  const r = score(target, user);
  const d = toPath(user.anchors, user.closed);
  const prev = best(lvl.id);
  const better = !prev || r.accuracy > prev.acc || (r.accuracy === prev.acc && r.used < prev.used) || r.stars > prev.stars;
  if (better) { progress.best[lvl.id] = { acc: r.accuracy, stars: Math.max(r.stars, prev?.stars || 0), used: r.used, ideal: r.ideal, d, at: Date.now() }; saveProgress(); }
  showResult(r, user, d, !!prev && better && r.accuracy > prev.acc);
}
function showResult(r, user, d, improved) {
  const lvl = LEVELS[cur], svg = $('resPreview');
  svg.innerHTML = '';
  drawTarget(svg, lvl);
  svgEl('path', { d, class: 'user' }, svg);
  r.errors.forEach(p => svgEl('circle', { cx: p.x, cy: p.y, r: 7, class: 'err' }, svg));
  $('resStars').innerHTML = [0, 1, 2].map(i => icon('star', i < r.stars ? 'on' : '')).join('');
  $('resAcc').textContent = r.accuracy;
  const msg = r.reason || (r.stars === 3 ? 'Чудово! Майже ідеально.' : r.stars === 2 ? 'Добре! Підправте точки й ручки — і буде три зірки.' : r.stars === 1 ? 'Рівень пройдено. Спробуйте точніше — червоним позначено, де контур розходиться з фігурою.' : 'Поки не вийшло. Увімкніть підказку й спробуйте ще раз.');
  $('resMsg').textContent = msg + (improved ? ' Новий особистий рекорд!' : '');
  const extra = r.used - r.ideal;
  $('resPts').textContent = `Точок: ${r.used} · ідеально ${r.ideal}${extra > 0 ? ` (на ${extra} більше)` : extra < 0 ? ' (менше за ідеал — круто!)' : ' — саме стільки, скільки треба'}`;
  const next = cur + 1 < LEVELS.length;
  $('resNext').disabled = !next || !unlocked(cur + 1);
  $('resNext').innerHTML = next ? 'Далі' + icon('arrow') : 'Усі рівні пройдено';
  $('result').hidden = false;
  renderHome();
  setTimeout(() => (r.stars ? $('resNext') : $('resRetry')).focus(), 50);
}
$('resRetry').onclick = () => { $('result').hidden = true; editor.reset(); $('board').focus({ preventScroll: true }); };
$('resNext').onclick = () => openLevel(cur + 1);
$('resLevels').onclick = () => showHome();

/* ═════════ Клавіатура ═════════ */
document.addEventListener('keydown', e => {
  if (!$('report').hidden) { if (e.key === 'Escape') $('report').hidden = true; return; }
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (!$('result').hidden) {
    if (e.key === 'Escape') $('resRetry').click();
    else if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); (!$('resNext').disabled ? $('resNext') : $('resRetry')).click(); }
    return;
  }
  if (cur < 0) return;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? editor.redo() : editor.undo(); }
  else if (mod && k === 'y') { e.preventDefault(); editor.redo(); }
  else if (e.key === 'Enter') { e.preventDefault(); check(); }
  else if (e.key === 'Escape') editor.finish();
  else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); editor.deleteLast(); }
  else if (!mod && k === 'h') $('hintBtn').click();
  else if (!mod && k === 'r') editor.clear();
});

/* ═════════ Результати для вчителя ═════════ */
$('reportBtn').onclick = () => {
  $('studentName').value = progress.name;
  const st = totalStars(), accs = LEVELS.map(l => best(l.id)).filter(Boolean);
  const avg = accs.length ? Math.round(accs.reduce((s, b) => s + b.acc, 0) / accs.length) : 0;
  $('reportSum').innerHTML = `Пройдено рівнів: <b>${passed()} з ${LEVELS.length}</b><br>Зірок: <b>${st} з ${LEVELS.length * 3}</b><br>Середня точність: <b>${accs.length ? avg + '%' : '—'}</b>`;
  $('report').hidden = false;
  setTimeout(() => $('studentName').focus(), 30);
};
$('report').addEventListener('click', e => { if (e.target.id === 'report' || e.target.closest('[data-close]')) $('report').hidden = true; });
$('studentName').addEventListener('input', e => { progress.name = e.target.value; saveProgress(); });
$('resetProgress').onclick = () => {
  if (!confirm('Скинути весь прогрес? Зірки й результати всіх рівнів буде видалено.')) return;
  progress.best = {}; saveProgress(); $('report').hidden = true; renderHome(); toast('Прогрес скинуто');
};
$('downloadReport').onclick = async () => {
  const name = $('studentName').value.trim();
  if (!name) { $('studentName').focus(); toast('Вкажіть ім’я — так учитель знатиме, чиї це результати'); return; }
  const blob = await reportImage(name);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pen-trainer-' + name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() + '.png';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
};

// Картинка з результатами: шапка з підсумком і всі рівні з мініатюрою спроби
function starPath(x, cx, cy, r) {
  x.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  x.closePath();
}
export async function reportImage(name) {
  const W = 1200, COLS = 2, ROW = 104, PAD = 40, HEAD = 190;
  const rows = Math.ceil(LEVELS.length / COLS);
  const c = document.createElement('canvas');
  c.width = W; c.height = HEAD + rows * ROW + 70;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#4F6BF4'; x.fillRect(0, 0, W, 8);
  const font = (w, s) => `${w} ${s}px Inter, system-ui, sans-serif`;
  x.fillStyle = '#1a1d23'; x.font = font(800, 30); x.fillText('Тренажер пера — результати', PAD, 62);
  x.font = font(600, 20); x.fillStyle = '#4b5563';
  x.fillText(name, PAD, 98);
  x.font = font(500, 15); x.fillStyle = '#9ca3af';
  x.fillText(new Date().toLocaleString('uk-UA', { dateStyle: 'long', timeStyle: 'short' }), PAD, 124);
  const accs = LEVELS.map(l => best(l.id)).filter(Boolean);
  const avg = accs.length ? Math.round(accs.reduce((s, b) => s + b.acc, 0) / accs.length) : 0;
  const sums = [['Пройдено', `${passed()} / ${LEVELS.length}`], ['Зірки', `${totalStars()} / ${LEVELS.length * 3}`], ['Середня точність', accs.length ? avg + '%' : '—']];
  sums.forEach(([k, v], i) => {
    const bx = W - PAD - (3 - i) * 190;
    x.fillStyle = '#f3f5f9'; x.beginPath(); x.roundRect(bx, 40, 176, 92, 14); x.fill();
    x.fillStyle = '#9ca3af'; x.font = font(600, 13); x.fillText(k, bx + 16, 66);
    x.fillStyle = '#1a1d23'; x.font = font(800, 30); x.fillText(v, bx + 16, 110);
  });
  x.strokeStyle = '#e2e5ea'; x.lineWidth = 1; x.beginPath(); x.moveTo(PAD, HEAD - 22); x.lineTo(W - PAD, HEAD - 22); x.stroke();
  const colW = (W - PAD * 2) / COLS;
  LEVELS.forEach((l, i) => {
    const col = Math.floor(i / rows), row = i % rows;
    const ox = PAD + col * colW, oy = HEAD + row * ROW, b = best(l.id);
    // мініатюра
    x.save(); x.fillStyle = '#f7f8fa'; x.beginPath(); x.roundRect(ox, oy, 88, 88, 10); x.fill(); x.clip();
    x.translate(ox, oy); x.scale(88 / 520, 88 / 520); x.translate(-40, -40);
    x.lineJoin = 'round'; x.lineCap = 'round';
    const tp = new Path2D(l.d); x.strokeStyle = '#c4cad6'; x.lineWidth = 14; x.stroke(tp);
    if (b && b.d) { x.strokeStyle = '#4F6BF4'; x.lineWidth = 12; x.stroke(new Path2D(b.d)); }
    x.restore();
    x.fillStyle = '#9ca3af'; x.font = font(700, 13); x.fillText(String(i + 1).padStart(2, '0'), ox + 104, oy + 26);
    x.fillStyle = '#1a1d23'; x.font = font(700, 17); x.fillText(l.name + (l.mode === 'copy' ? ' (за зразком)' : ''), ox + 132, oy + 26);
    if (b) {
      for (let s = 0; s < 3; s++) { starPath(x, ox + 114 + s * 24, oy + 56, 10); x.fillStyle = s < b.stars ? '#f5b942' : '#e2e5ea'; x.fill(); }
      x.fillStyle = '#1a1d23'; x.font = font(800, 18); x.fillText(b.acc + '%', ox + 194, oy + 62);
      x.fillStyle = '#6b7280'; x.font = font(500, 14); x.fillText(`точок ${b.used} / ${b.ideal}`, ox + 268, oy + 62);
    } else { x.fillStyle = '#b0b6c2'; x.font = font(500, 15); x.fillText('не пройдено', ox + 104, oy + 62); }
  });
  x.fillStyle = '#9ca3af'; x.font = font(500, 13); x.fillText('Edvault · Тренажер пера', PAD, c.height - 26);
  return new Promise(r => c.toBlob(r, 'image/png'));
}

/* ═════════ Старт ═════════ */
const fromHash = LEVELS.findIndex(l => '#' + l.id === location.hash);
if (fromHash >= 0 && unlocked(fromHash)) openLevel(fromHash); else showHome();
window.PenTrainer = { editor, LEVELS, get progress() { return progress; }, get current() { return cur; }, openLevel, check, reportImage };
