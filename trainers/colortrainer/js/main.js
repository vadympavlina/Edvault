// Колір на око · Edvault — рівні, керування кольором, раунди, оцінка, прогрес і результати для вчителя.
import { CHAPTERS, LEVELS } from './levels.js';
import { hsbToRgb, rgbToHsb, toHex, css, rng, clamp } from './color.js';
import { makeRound, scoreRound, lampsRgb, sectorHsb, SECTORS } from './round.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ═════════ Іконки ═════════ */
const P = {
  pipette: '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  left: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/>',
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
const KEY = 'edvault-coloreye';
let progress = (() => { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && typeof v === 'object' ? { name: v.name || '', best: v.best || {} } : null; } catch (e) { return null; } })() || { name: '', best: {} };
const saveProgress = () => { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* немає місця */ } };
const best = id => progress.best[id];
const unlocked = i => i === 0 || (best(LEVELS[i - 1].id)?.stars || 0) >= 1;
const totalStars = () => LEVELS.reduce((s, l) => s + (best(l.id)?.stars || 0), 0);
const passed = () => LEVELS.filter(l => (best(l.id)?.stars || 0) >= 1).length;
const hsbCss = h => css(hsbToRgb(h));

/* ═════════ Головна ═════════ */
const MODE_TAG = { hue: 'H', sb: 'SB', hsb: 'HSB', lights: 'RGB', pick: '=', wheel: '180°', order: '1→9' };
const seedOf = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
function thumb(level) {
  const b = best(level.id);
  if (level.mode === 'order') {
    const ramp = b?.ramp || makeRound(level, rng(seedOf(level.id))).ramp.map(h => toHex(hsbToRgb(h)));
    return `<div class="lvl-thumb ramp" style="--n:${ramp.length}">${ramp.map(c => `<i style="background:${c}"></i>`).join('')}<span class="lvl-tag">${MODE_TAG.order}</span></div>`;
  }
  let pair = b?.pairs?.[0];
  if (!pair) { const r = makeRound(level, rng(seedOf(level.id))); pair = [toHex(hsbToRgb(r.base || r.target)), toHex(hsbToRgb(r.start))]; }
  return `<div class="lvl-thumb"><i style="background:${pair[0]}"></i><i style="background:${pair[1]}"></i><span class="lvl-tag">${MODE_TAG[level.mode]}</span></div>`;
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
        ${open ? thumb(l) : `<div class="lvl-thumb single"><span class="lvl-lock">${icon('lock')}</span></div>`}
        <span class="lvl-num">${i + 1}</span>
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
$('chapters').addEventListener('click', e => { const b = e.target.closest('[data-level]'); if (b && !b.disabled) openLevel(+b.dataset.level); });
$('continueBtn').onclick = () => openLevel(+$('continueBtn').dataset.level);
$('homeBtn').onclick = () => showHome();

/* ═════════ Елементи керування ═════════ */
// повзунок 0..1 з мишею, дотиком і стрілками
function bar(cls, onInput, step = 1 / 360) {
  const el = document.createElement('div');
  el.className = 'bar ' + cls; el.tabIndex = 0; el.setAttribute('role', 'slider');
  const knob = document.createElement('div'); knob.className = 'knob'; el.appendChild(knob);
  let v = 0;
  const set = (x, emit) => { v = clamp(x, 0, 1); knob.style.left = v * 100 + '%'; el.setAttribute('aria-valuenow', Math.round(v * 100)); if (emit) onInput(v); };
  const at = e => { const r = el.getBoundingClientRect(); set((e.clientX - r.left) / r.width, true); };
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); el.focus(); at(e); el.onpointermove = at; });
  el.addEventListener('pointerup', () => { el.onpointermove = null; });
  el.addEventListener('keydown', e => { const k = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key]; if (k) { e.preventDefault(); set(v + k * step * (e.shiftKey ? 10 : 1), true); } });
  return { el, knob, set, get v() { return v; } };
}
// квадрат насиченості (по горизонталі) й яскравості (по вертикалі)
function sbSquare(onInput) {
  const el = document.createElement('div'); el.className = 'sbq'; el.tabIndex = 0;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160; el.appendChild(cv);
  const knob = document.createElement('div'); knob.className = 'knob'; el.appendChild(knob);
  let s = 0, b = 0, hue = 0;
  const draw = () => {
    const x = cv.getContext('2d');
    x.fillStyle = hsbCss({ h: hue, s: 100, b: 100 }); x.fillRect(0, 0, 256, 160);
    let g = x.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 160);
    g = x.createLinearGradient(0, 0, 0, 160); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, 256, 160);
  };
  const place = () => { knob.style.left = s + '%'; knob.style.top = (100 - b) + '%'; knob.style.background = hsbCss({ h: hue, s, b }); };
  const at = e => { const r = el.getBoundingClientRect(); s = clamp((e.clientX - r.left) / r.width * 100, 0, 100); b = clamp(100 - (e.clientY - r.top) / r.height * 100, 0, 100); place(); onInput(s, b); };
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); el.focus(); at(e); el.onpointermove = at; });
  el.addEventListener('pointerup', () => { el.onpointermove = null; });
  el.addEventListener('keydown', e => {
    const d = e.shiftKey ? 5 : 1, m = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] }[e.key];
    if (m) { e.preventDefault(); s = clamp(s + m[0], 0, 100); b = clamp(b + m[1], 0, 100); place(); onInput(s, b); }
  });
  return { el, setHue(h) { hue = h; draw(); place(); }, set(ns, nb) { s = ns; b = nb; place(); } };
}

/* ═════════ Гра ═════════ */
let cur = -1, level = null, R = null, rIndex = 0, results = [], user = null, checked = false, order = null, memTimer = 0, seed = Date.now();
let ui = {};

function openLevel(i) {
  if (!LEVELS[i] || !unlocked(i)) { showHome(); return; }
  cur = i; level = LEVELS[i];
  // фокус могла лишити кнопка зі схованого вікна — тоді Enter натискав би її знову
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  $('home').hidden = true; $('play').hidden = false; $('result').hidden = true;
  $('lvlChapter').textContent = CHAPTERS.find(c => c.id === level.chapter).name;
  $('lvlName').textContent = level.name;
  $('lvlHint').textContent = level.intro || CHAPTERS.find(c => c.id === level.chapter).desc;
  $('navNum').textContent = `${i + 1} / ${LEVELS.length}`;
  $('prevBtn').disabled = i === 0;
  $('nextBtn').disabled = !(i + 1 < LEVELS.length && unlocked(i + 1));
  if (location.hash !== '#' + level.id) history.replaceState(null, '', '#' + level.id);
  results = []; rIndex = 0;
  seed = (Date.now() ^ (i * 7919)) >>> 0;
  startRound();
}
function startRound() {
  clearInterval(memTimer);
  const r = rng(seed + rIndex * 104729);
  R = makeRound(level, r);
  checked = false;
  $('feedback').hidden = true;
  $('checkLabel').textContent = 'Перевірити';
  renderRounds();
  const isOrder = level.mode === 'order', isPick = level.mode === 'pick' || level.mode === 'wheel';
  $('swatches').hidden = isOrder || isPick; $('controls').hidden = isOrder; $('order').hidden = !isOrder;
  $('stage').classList.remove('reveal');
  if (isOrder) { order = R.order.slice(); renderOrder(); return; }
  if (isPick) { user = null; level.mode === 'wheel' ? renderWheel() : renderPick(); return; }
  if (level.mode === 'lights') { user = R.startLamps.slice(); renderSwatches(); renderLamps(); return; }
  user = { ...R.start };
  buildControls();
  renderSwatches();
  // по пам'яті: зразок видно кілька секунд
  if (level.memory) {
    let left = level.memory;
    const cover = $('swCover');
    cover.className = 'sw-cover on timer'; cover.innerHTML = `<span class="count">${left}</span>`;
    memTimer = setInterval(() => {
      left--;
      if (left > 0) { cover.innerHTML = `<span class="count">${left}</span>`; return; }
      clearInterval(memTimer);
      cover.className = 'sw-cover on'; cover.innerHTML = '<b>?</b><small>Зразок сховався — відтворіть колір по пам’яті</small>';
    }, 1000);
  }
}
function renderRounds() {
  const n = level.rounds;
  $('rounds').innerHTML = n > 1 ? `<span>Раунд ${Math.min(rIndex + 1, n)} з ${n}</span>` + Array.from({ length: n }, (_, k) => {
    const res = results[k];
    if (res) return `<span class="dot done" style="background:${res.color || 'var(--accent)'}">${res.accuracy}</span>`;
    return `<span class="dot${k === rIndex ? ' cur' : ''}">${k + 1}</span>`;
  }).join('') : '';
}
function renderSwatches() {
  const cover = $('swCover');
  $('swTargetFill').style.background = hsbCss(R.target);
  if (!level.memory) cover.className = 'sw-cover';
  $('swUserFill').style.background = level.mode === 'lights' ? css(lampsRgb(user, R.steps)) : hsbCss(user);
}
function setUser(h) {
  user = { h: ((h.h % 360) + 360) % 360, s: clamp(h.s, 0, 100), b: clamp(h.b, 0, 100) };
  $('swUserFill').style.background = hsbCss(user);
}
function buildControls() {
  const box = $('controls');
  box.innerHTML = ''; ui = {};
  const m = level.mode;
  if (m === 'sb' || m === 'hsb') {
    ui.sb = sbSquare((s, b) => { if (checked) return; setUser({ ...user, s, b }); });
    box.appendChild(ui.sb.el);
    ui.sb.setHue(user.h); ui.sb.set(user.s, user.b);
  }
  if (m === 'hue' || m === 'hsb') {
    ui.hue = bar('hue-bar', v => { if (checked) return; setUser({ ...user, h: v * 360 }); if (ui.sb) ui.sb.setHue(user.h); });
    ui.hue.set(user.h / 360);
    box.appendChild(ui.hue.el);
    if (m === 'hue') { const cap = document.createElement('div'); cap.className = 'ctl-cap'; cap.innerHTML = '<span>червоний</span><span>зелений</span><span>синій</span><span>червоний</span>'; box.appendChild(cap); }
  }
}

/* ── змішування світла: три лампи ── */
const LAMP = [['Червоне', '#ff2d2d'], ['Зелене', '#22c55e'], ['Синє', '#3b82f6']];
function renderLamps() {
  const words = R.steps === 3 ? ['вимкнене', 'на половину', 'увімкнене'] : ['вимкнене', 'увімкнене'];
  $('controls').innerHTML = `<div class="lamps">${LAMP.map(([name, c], i) => {
    const v = user[i] / (R.steps - 1), mark = checked ? (user[i] === R.want[i] ? ' ok' : ' bad') : '';
    return `<button class="lamp${v ? ' on' : ''}${mark}" data-lamp="${i}" style="--c:${c};--v:${v}" aria-label="${name} світло: ${words[user[i]]}" ${checked ? 'tabindex="-1"' : ''}><span class="bulb"></span><b>${name}</b><small>${words[user[i]]}</small><kbd>${i + 1}</kbd></button>`;
  }).join('')}</div>`;
}
function toggleLamp(i) {
  if (checked || level?.mode !== 'lights' || !(i in user)) return;
  user[i] = (user[i] + 1) % R.steps;
  $('swUserFill').style.background = css(lampsRgb(user, R.steps));
  renderLamps();
}

/* ── колірне коло з 12 секторів ── */
function renderWheel() {
  const C = 160, RO = 150, RI = 72, pt = (deg, rr) => { const a = (deg - 90) * Math.PI / 180; return `${(C + Math.cos(a) * rr).toFixed(1)} ${(C + Math.sin(a) * rr).toFixed(1)}`; };
  let s = '';
  for (let i = 0; i < SECTORS; i++) {
    const a0 = i * 30 - 14, a1 = i * 30 + 14;
    const mark = checked ? (R.answers.includes(i) ? ' ok' : i === user ? ' bad' : '') : i === user ? ' sel' : '';
    s += `<path class="sec${i === R.base ? ' base' : ''}${mark}" data-sec="${i}" tabindex="${checked || i === R.base ? -1 : 0}" role="button" aria-label="Сектор ${i + 1}${i === R.base ? ', база' : ''}" fill="${hsbCss(sectorHsb(i))}" d="M${pt(a0, RO)} A${RO} ${RO} 0 0 1 ${pt(a1, RO)} L${pt(a1, RI)} A${RI} ${RI} 0 0 0 ${pt(a0, RI)}Z"/>`;
  }
  const [bx, by] = pt(R.base * 30, (RO + RI) / 2).split(' ');
  s += `<circle class="base-dot" cx="${bx}" cy="${by}" r="9"/><circle cx="${C}" cy="${C}" r="${RI - 10}" fill="${hsbCss(sectorHsb(R.base))}"/><text x="${C}" y="${C + 6}" text-anchor="middle" class="wheel-base">база</text>`;
  $('controls').innerHTML = `<div class="wheel12"><svg viewBox="0 0 320 320">${s}</svg><div class="pick-task">Точка й центр кола — це база. Натисніть сектор, який поєднується з нею.</div></div>`;
}
$('controls').addEventListener('click', e => {
  const l = e.target.closest('[data-lamp]'); if (l) { toggleLamp(+l.dataset.lamp); return; }
  const sec = e.target.closest('[data-sec]');
  if (sec && !checked && level?.mode === 'wheel' && +sec.dataset.sec !== R.base) { user = +sec.dataset.sec; renderWheel(); }
});
$('controls').addEventListener('keydown', e => {
  const sec = e.target.closest('[data-sec]');
  if (sec && e.key === ' ') { e.preventDefault(); sec.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
});

/* ── знайдіть колір: вибір одного з варіантів ── */
function renderPick() {
  const odd = R.ask === 'odd';
  const ask = odd
    ? `<div class="pick-task">Одна плитка відрізняється від інших — натисніть її.</div>`
    : `<div class="pick-ask" style="background:${R.options[R.answer]}"><span class="sw-label">Зразок</span></div><div class="pick-task">Який із варіантів такий самий, як зразок?</div>`;
  const opts = R.options.map((hex, i) => {
    const mark = checked ? (i === R.answer ? ' ok' : i === user ? ' bad' : '') : user === i ? ' sel' : '';
    return `<button class="pick-opt${mark}" data-pick="${i}" aria-label="Варіант ${i + 1}" aria-pressed="${user === i}" ${checked ? 'tabindex="-1"' : ''} style="background:${hex}">${odd ? '' : `<kbd>${i + 1}</kbd>`}</button>`;
  }).join('');
  $('controls').innerHTML = `<div class="pick${odd ? ' odd' : ''}">${ask}<div class="pick-opts" style="--cols:${odd ? (R.options.length > 9 ? 4 : 3) : R.options.length}">${opts}</div></div>`;
}
function choose(i) {
  if (checked || level?.mode !== 'pick' || !R.options[i]) return;
  user = i; renderPick();
}
$('controls').addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (b) choose(+b.dataset.pick); });

/* ── по порядку: перетягування плиток ── */
function renderOrder(marks) {
  const box = $('order');
  box.innerHTML = order.map((k, pos) => {
    const pin = pos === 0 || pos === order.length - 1;
    const m = marks ? (k === pos ? ' ok' : ' bad') : '';
    return `<div class="tile${pin ? ' pin' : ''}${m}" data-pos="${pos}" style="background:${hsbCss(R.ramp[k])}" ${pin ? 'title="Закріплена"' : ''}></div>`;
  }).join('');
}
$('order').addEventListener('pointerdown', e => {
  const t = e.target.closest('.tile');
  if (!t || t.classList.contains('pin') || checked) return;
  e.preventDefault();
  let from = +t.dataset.pos;
  const box = $('order');
  box.setPointerCapture(e.pointerId);
  t.classList.add('drag');
  box.onpointermove = ev => {
    const tiles = [...box.children];
    let to = from;
    tiles.forEach((el, i) => { const r = el.getBoundingClientRect(); if (ev.clientX > r.left && ev.clientX < r.right) to = i; });
    to = clamp(to, 1, order.length - 2);
    if (to !== from) { const [x] = order.splice(from, 1); order.splice(to, 0, x); from = to; renderOrder(); box.children[from].classList.add('drag'); }
  };
  box.onpointerup = () => { box.onpointermove = null; box.onpointerup = null; renderOrder(); };
});

/* ═════════ Перевірка ═════════ */
const accColor = a => a >= 90 ? '#10b981' : a >= 80 ? '#84cc16' : a >= 65 ? '#f59e0b' : '#ef4444';
function check() {
  if (cur < 0) return;
  if (checked) { next(); return; }
  clearInterval(memTimer);
  if ((level.mode === 'pick' || level.mode === 'wheel') && user == null) { toast(level.mode === 'wheel' ? 'Спершу натисніть сектор на колі' : 'Спершу виберіть один із варіантів'); return; }
  checked = true;
  const res = level.mode === 'order' ? scoreRound(level, R, order) : scoreRound(level, R, user);
  res.color = accColor(res.accuracy);
  if (level.mode === 'order') { res.ramp = R.ramp.map(h => toHex(hsbToRgb(h))); res.order = order.slice(); renderOrder(true); }
  else if (level.mode === 'pick' || level.mode === 'wheel') { res.pair = [toHex(res.target), toHex(res.user)]; $('stage').classList.add('reveal'); level.mode === 'wheel' ? renderWheel() : renderPick(); }
  else {
    res.pair = [toHex(res.target), toHex(res.user)];
    // показуємо зразок (для «по пам'яті» — відкриваємо)
    $('stage').classList.add('reveal');
    $('swCover').className = 'sw-cover';
    $('swTargetFill').style.background = css(res.target);
    if (level.mode === 'lights') renderLamps();
  }
  results[rIndex] = res;
  $('feedback').hidden = false;
  $('fbAcc').textContent = res.accuracy + '%'; $('fbAcc').style.color = res.color;
  $('fbDe').textContent = res.de != null ? `ΔE ${res.de.toFixed(1)}` : '';
  const simple = ['pick', 'wheel', 'lights'].includes(level.mode);
  if (level.mode === 'pick' || level.mode === 'wheel') $('fbAcc').textContent = res.correct ? 'Правильно' : res.accuracy ? 'Майже' : 'Не той';
  $('fbPair').innerHTML = res.pair && !simple ? `<div style="background:${res.pair[0]}">зразок ${res.pair[0]}</div><div style="background:${res.pair[1]}">ваш ${res.pair[1]}</div>` : '';
  $('fbPair').hidden = !res.pair || simple;
  $('fbTips').innerHTML = res.tips.map(t => `<li>${esc(t)}</li>`).join('');
  $('checkLabel').textContent = rIndex + 1 < level.rounds ? 'Наступний раунд' : 'Результат рівня';
  renderRounds();
}
function next() {
  if (rIndex + 1 < level.rounds) { rIndex++; startRound(); return; }
  finishLevel();
}
function finishLevel() {
  const acc = Math.round(results.reduce((s, r) => s + r.accuracy, 0) / results.length);
  const stars = [65, 80, 90].filter(v => acc >= v).length;
  const prev = best(level.id);
  const entry = { acc, stars: Math.max(stars, prev?.stars || 0), at: Date.now() };
  if (level.mode === 'order') { entry.ramp = results[0].ramp; entry.order = results[0].order; }
  else entry.pairs = results.map(r => r.pair);
  if (!prev || acc > prev.acc || stars > prev.stars) { progress.best[level.id] = entry; saveProgress(); }
  $('resStars').innerHTML = [0, 1, 2].map(i => icon('star', i < stars ? 'on' : '')).join('');
  $('resAcc').textContent = acc;
  $('resMsg').textContent = (stars === 3 ? 'Чудове око! ' : stars === 2 ? 'Добре! Ще трохи точності — і буде три зірки. ' : stars === 1 ? 'Рівень пройдено. ' : 'Поки не вийшло — спробуйте ще раз. ') + (prev && acc > prev.acc ? 'Новий особистий рекорд!' : '');
  $('resPairs').className = 'res-pairs' + (level.mode === 'order' ? ' ramps' : '');
  $('resPairs').innerHTML = level.mode === 'order'
    ? `<div style="--n:${results[0].order.length}">${results[0].order.map(k => `<i style="background:${results[0].ramp[k]}"></i>`).join('')}</div>`
    : results.map(r => `<div><i style="background:${r.pair[0]}"></i><i style="background:${r.pair[1]}"></i><span>${r.accuracy}%</span></div>`).join('');
  const nx = cur + 1 < LEVELS.length;
  $('resNext').disabled = !nx || !unlocked(cur + 1);
  $('resNext').innerHTML = nx ? 'Далі' + icon('arrow') : 'Усі рівні пройдено';
  $('result').hidden = false;
  renderHome();
  setTimeout(() => (stars ? $('resNext') : $('resRetry')).focus(), 50);
}
$('checkBtn').onclick = () => check();
$('resRetry').onclick = () => openLevel(cur);
$('resNext').onclick = () => openLevel(cur + 1);
$('resLevels').onclick = () => showHome();
$('backBtn').onclick = () => showHome();
$('prevBtn').onclick = () => openLevel(cur - 1);
$('nextBtn').onclick = () => openLevel(cur + 1);
function showHome() {
  clearInterval(memTimer);
  cur = -1;
  $('play').hidden = true; $('result').hidden = true; $('home').hidden = false;
  history.replaceState(null, '', location.pathname);
  renderHome();
}

/* ═════════ Клавіатура ═════════ */
document.addEventListener('keydown', e => {
  if (!$('report').hidden) { if (e.key === 'Escape') $('report').hidden = true; return; }
  if (e.target.closest && e.target.closest('input')) { if (e.key === 'Enter') { e.preventDefault(); check(); } return; }
  if (!$('result').hidden) {
    if (e.key === 'Escape') $('resRetry').click();
    else if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); (!$('resNext').disabled ? $('resNext') : $('resRetry')).click(); }
    return;
  }
  if (cur >= 0 && level.mode === 'lights' && /^[1-3]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) { toggleLamp(+e.key - 1); return; }
  if (cur >= 0 && level.mode === 'pick' && /^[1-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) { choose(+e.key - 1); return; }
  if (cur >= 0 && e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); check(); }
});

/* ═════════ Результати для вчителя ═════════ */
$('reportBtn').onclick = () => {
  $('studentName').value = progress.name;
  const accs = LEVELS.map(l => best(l.id)).filter(Boolean);
  const avg = accs.length ? Math.round(accs.reduce((s, b) => s + b.acc, 0) / accs.length) : 0;
  $('reportSum').innerHTML = `Пройдено рівнів: <b>${passed()} з ${LEVELS.length}</b><br>Зірок: <b>${totalStars()} з ${LEVELS.length * 3}</b><br>Середня точність: <b>${accs.length ? avg + '%' : '—'}</b>`;
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
  a.download = 'color-trainer-' + name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() + '.png';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
};
function starPath(x, cx, cy, r) {
  x.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  x.closePath();
}
export async function reportImage(name) {
  const W = 1200, COLS = 2, ROW = 84, PAD = 40, HEAD = 190;
  const rows = Math.ceil(LEVELS.length / COLS);
  const c = document.createElement('canvas');
  c.width = W; c.height = HEAD + rows * ROW + 70;
  const x = c.getContext('2d');
  const font = (w, s) => `${w} ${s}px Inter, system-ui, sans-serif`;
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
  const g = x.createLinearGradient(0, 0, W, 0); ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'].forEach((col, i) => g.addColorStop(i / 4, col)); x.fillStyle = g; x.fillRect(0, 0, W, 8);
  x.fillStyle = '#1a1d23'; x.font = font(800, 30); x.fillText('Колір на око — результати', PAD, 62);
  x.font = font(600, 20); x.fillStyle = '#4b5563'; x.fillText(name, PAD, 98);
  x.font = font(500, 15); x.fillStyle = '#9ca3af'; x.fillText(new Date().toLocaleString('uk-UA', { dateStyle: 'long', timeStyle: 'short' }), PAD, 124);
  const accs = LEVELS.map(l => best(l.id)).filter(Boolean);
  const avg = accs.length ? Math.round(accs.reduce((s, b) => s + b.acc, 0) / accs.length) : 0;
  [['Пройдено', `${passed()} / ${LEVELS.length}`], ['Зірки', `${totalStars()} / ${LEVELS.length * 3}`], ['Середня точність', accs.length ? avg + '%' : '—']].forEach(([k, v], i) => {
    const bx = W - PAD - (3 - i) * 190;
    x.fillStyle = '#f3f5f9'; x.beginPath(); x.roundRect(bx, 40, 176, 92, 14); x.fill();
    x.fillStyle = '#9ca3af'; x.font = font(600, 13); x.fillText(k, bx + 16, 66);
    x.fillStyle = '#1a1d23'; x.font = font(800, 30); x.fillText(v, bx + 16, 110);
  });
  x.strokeStyle = '#e2e5ea'; x.beginPath(); x.moveTo(PAD, HEAD - 22); x.lineTo(W - PAD, HEAD - 22); x.stroke();
  const colW = (W - PAD * 2) / COLS;
  LEVELS.forEach((l, i) => {
    const col = Math.floor(i / rows), row = i % rows, ox = PAD + col * colW, oy = HEAD + row * ROW, b = best(l.id);
    // мініатюра: пари «зразок / ваш» або розставлені плитки
    x.save(); x.beginPath(); x.roundRect(ox, oy, 120, 64, 10); x.clip();
    x.fillStyle = '#f3f5f9'; x.fillRect(ox, oy, 120, 64);
    if (b?.pairs) b.pairs.forEach((p, k) => { const w = 120 / b.pairs.length; x.fillStyle = p[0]; x.fillRect(ox + k * w, oy, w, 32); x.fillStyle = p[1]; x.fillRect(ox + k * w, oy + 32, w, 32); });
    else if (b?.ramp) { const w = 120 / b.order.length; b.order.forEach((k, j) => { x.fillStyle = b.ramp[k]; x.fillRect(ox + j * w, oy, w + 1, 64); }); }
    x.restore();
    x.fillStyle = '#9ca3af'; x.font = font(700, 13); x.fillText(String(i + 1).padStart(2, '0'), ox + 136, oy + 22);
    x.fillStyle = '#1a1d23'; x.font = font(700, 16); x.fillText(l.name, ox + 164, oy + 22);
    if (b) {
      for (let s = 0; s < 3; s++) { starPath(x, ox + 146 + s * 22, oy + 48, 9); x.fillStyle = s < b.stars ? '#f5b942' : '#e2e5ea'; x.fill(); }
      x.fillStyle = '#1a1d23'; x.font = font(800, 17); x.fillText(b.acc + '%', ox + 222, oy + 54);
    } else { x.fillStyle = '#b0b6c2'; x.font = font(500, 14); x.fillText('не пройдено', ox + 136, oy + 54); }
  });
  x.fillStyle = '#9ca3af'; x.font = font(500, 13); x.fillText('Edvault · Колір на око', PAD, c.height - 26);
  return new Promise(r => c.toBlob(r, 'image/png'));
}

/* ═════════ Старт ═════════ */
const fromHash = LEVELS.findIndex(l => '#' + l.id === location.hash);
if (fromHash >= 0 && unlocked(fromHash)) openLevel(fromHash); else showHome();
window.ColorTrainer = { LEVELS, get progress() { return progress; }, get round() { return R; }, get user() { return user; }, setUser: h => { setUser(h); if (ui.sb) { ui.sb.setHue(user.h); ui.sb.set(user.s, user.b); } if (ui.hue) ui.hue.set(user.h / 360); }, get order() { return order; }, openLevel, check, reportImage };
