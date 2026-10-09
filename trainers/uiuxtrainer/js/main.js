// UI/UX-дизайнер · Edvault — пам’ятка, «який варіант зручніший», «знайди проблему», запитання
// й «виправ сам» з живим макетом і перевірками; прогрес і результати для вчителя.
import { CHAPTERS, LEVELS } from './levels.js';
import { mock } from './mocks.js';
import { contrast, contrastLevel, fmtRatio, starsFor, fixScore } from './logic.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c;

/* ═════════ Іконки ═════════ */
const P = {
  layout: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M9 21V9"/>',
  contrast: '<circle cx="12" cy="12" r="10"/><path d="M12 18a6 6 0 0 0 0-12v12z"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  heading: '<path d="M6 12h12M6 20V4M18 20V4"/>',
  bold: '<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>',
  lines: '<path d="M3 6h18M3 12h18M3 18h12"/>',
  align: '<path d="M21 6H3M15 12H3M17 18H3"/>',
  center: '<path d="M21 6H3M17 12H7M19 18H5"/>',
  pilcrow: '<path d="M13 4v16M17 4v16M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/>',
  sliders: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
  frame: '<rect width="18" height="18" x="3" y="3" rx="2"/><rect width="10" height="10" x="7" y="7" rx="1"/>',
  space: '<path d="M3 5v14M21 5v14M7 12h10M10 9l-3 3 3 3M14 9l3 3-3 3"/>',
  magnet: '<path d="m6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.39-6.36a2.14 2.14 0 0 0-3-3L6 15M5 8l4 4M12 15l4 4"/>',
  form: '<rect width="18" height="5" x="3" y="5" rx="1"/><rect width="18" height="5" x="3" y="14" rx="1"/>',
  shuffle: '<path d="m18 14 4 4-4 4M18 2l4 4-4 4M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22M2 6h1.972a4 4 0 0 1 3.6 2.2M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="m2 12 9.17 4.17a2 2 0 0 0 1.66 0L22 12M2 17l9.17 4.17a2 2 0 0 0 1.66 0L22 17"/>',
  pointer: '<path d="M12.586 12.586 19 19M3.688 3.037a.497.497 0 0 0-.651.651l6.5 15.999a.501.501 0 0 0 .947-.062l1.569-6.083a2 2 0 0 1 1.448-1.479l6.124-1.579a.5.5 0 0 0 .063-.947z"/>',
  trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  dialog: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  asterisk: '<path d="M12 6v12M17.196 9 6.804 15M6.804 9l10.392 6"/>',
  finger: '<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  list: '<path d="M3 12h.01M3 18h.01M3 6h.01M8 12h13M8 18h13M8 6h13"/>',
  award: '<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>',
  columns: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  left: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4"/>',
  star: '<path fill="currentColor" stroke="none" d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
};
const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || P.info}</svg>`;
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
const KEY = 'edvault-uiux';
let progress = (() => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } })();
if (!progress || typeof progress !== 'object') progress = {};
progress = { name: progress.name || '', best: progress.best || {} };
const saveProgress = () => { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* немає місця */ } };
const best = id => progress.best[id];
const unlocked = i => i === 0 || (best(LEVELS[i - 1].id)?.stars || 0) >= 1;
const passed = () => LEVELS.filter(l => best(l.id)?.stars).length;
const totalStars = () => LEVELS.reduce((s, l) => s + (best(l.id)?.stars || 0), 0);
const perfect = () => LEVELS.filter(l => best(l.id)?.stars === 3).length;

/* ═════════ Гра ═════════ */
let level = null, cur = -1, ti = -1, scores = [], task = null, answered = false, fx = null;
function openLevel(i) {
  if (!LEVELS[i] || !unlocked(i)) { showHome(); return; }
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  cur = i; level = LEVELS[i]; scores = [];
  $('home').hidden = true; $('play').hidden = false; $('result').hidden = true;
  $('lvlChapter').textContent = CHAPTERS.find(c => c.id === level.chapter).name;
  $('lvlName').textContent = `${i + 1}. ${level.name}`;
  $('lvlHint').innerHTML = tipsHtml(); $('lvlHint').hidden = true; $('tipsBtn').classList.remove('on');
  $('navNum').textContent = `${i + 1} / ${LEVELS.length}`;
  $('prevBtn').disabled = i === 0;
  $('nextBtn').disabled = !(i + 1 < LEVELS.length && unlocked(i + 1));
  showIntro();
  if (location.hash !== '#' + level.id) window.history.replaceState(null, '', '#' + level.id);
}
const tipsHtml = () => `<ul class="tips">${level.tips.map(([ic, t]) => `<li><span class="tip-ico">${icon(ic)}</span><span>${t}</span></li>`).join('')}</ul>`;
const KIND = { pair: ['columns', 'вибрати кращий варіант'], spot: ['target', 'знайти проблему'], choice: ['help', 'запитання'], fix: ['sliders', 'виправити самому'] };
function showIntro() {
  ti = -1; task = null; answered = false;
  $('feedback').hidden = true; $('tipsBtn').hidden = true;
  $('stage').className = 'stage intro';
  const n = level.tasks.length;
  const kinds = [...new Set(level.tasks.map(t => t.kind))].map(k => `<span class="kind">${icon(KIND[k][0])}${KIND[k][1]}</span>`).join('');
  $('stage').innerHTML = `<div class="intro-head"><span class="intro-ico">${icon('book')}</span><div><small>Пам’ятка перед рівнем</small><h2>${esc(level.name)}</h2></div></div>${tipsHtml()}
    <div class="verdicts"><span class="note">${icon('info')}${n} ${plural(n, 'завдання', 'завдання', 'завдань')}</span><span class="kinds">${kinds}</span><span class="grow"></span><button class="btn btn-primary btn-lg2" id="goBtn">${icon('play')}Почати</button></div>`;
  $('goBtn').onclick = () => { ti = 0; showTask(); };
  renderDots();
  setTimeout(() => $('goBtn')?.focus({ preventScroll: true }), 30);
}
$('tipsBtn').onclick = () => { const h = !$('lvlHint').hidden; $('lvlHint').hidden = h; $('tipsBtn').classList.toggle('on', !h); };
function renderDots() {
  $('dots').innerHTML = level.tasks.map((_, k) => { const s = scores[k]; return `<i class="${k === ti && !answered ? 'cur' : s == null ? '' : s >= 0.9 ? 'ok' : s > 0 ? 'part' : 'bad'}"></i>`; }).join('');
  $('stepN').textContent = ti < 0 ? 'Пам’ятка' : `Завдання ${ti + 1} з ${level.tasks.length}`;
}

function showTask() {
  task = level.tasks[ti]; answered = false; fx = null;
  $('feedback').hidden = true; $('tipsBtn').hidden = false;
  $('stage').className = 'stage k-' + task.kind;
  const head = `<div class="q-row"><span class="q-kind">${icon(KIND[task.kind][0])}${KIND[task.kind][1]}</span><h2 class="q">${esc(task.q)}</h2></div>`;
  if (task.kind === 'pair') {
    $('stage').innerHTML = head + `<div class="vpair">${['a', 'b'].map((k, i) => `<div class="vcard" role="button" tabindex="0" data-k="${k}"><div class="pc-top"><span class="pc-k">${'АБ'[i]}</span><span class="pc-l">Варіант ${'АБ'[i]}</span><span class="pc-res"></span></div><div class="mock-box">${mock(task[k])}</div></div>`).join('')}</div>`;
    $('stage').querySelector('.vpair').addEventListener('click', e => { const c = e.target.closest('.vcard'); if (c) answerPair(c.dataset.k); });
  } else if (task.kind === 'spot') {
    $('stage').innerHTML = head + `<div class="spot-wrap"><div class="mock-box spot">${mock(task.mock)}</div><p class="spot-help">${icon('pointer')}Наводьте мишку — частини екрана підсвічуються. Клацніть на ту, що заважає.</p></div>`;
    $('stage').querySelector('.spot').addEventListener('click', e => { const m = e.target.closest('.mp'); if (m) answerSpot(m); });
  } else if (task.kind === 'choice') {
    $('stage').innerHTML = head + (task.mock ? `<div class="mock-box small">${mock(task.mock)}</div>` : '') + `<div class="options">${task.options.map((x, k) => `<button class="opt" data-k="${k}"><span class="opt-k">${'АБВГ'[k]}</span><span class="opt-t">${esc(x.t)}</span></button>`).join('')}</div>`;
    $('stage').querySelector('.options').addEventListener('click', e => { const b = e.target.closest('.opt'); if (b) answerChoice(+b.dataset.k); });
  } else showFix(head);
  renderDots();
}

function flagParts(root, marks) {
  marks.forEach(m => root.querySelectorAll(`[data-p="${CSS.escape(m.p)}"]`).forEach(e => e.classList.add('flag')));
}
function answerPair(k) {
  if (answered) return;
  const ok = k === task.ok, worse = task.ok === 'a' ? 'b' : 'a';
  $('stage').querySelectorAll('.vcard').forEach(c => {
    c.classList.add('done');
    const good = c.dataset.k === task.ok;
    c.classList.add(good ? 'right' : 'worse');
    if (c.dataset.k === k && !ok) c.classList.add('wrong');
    c.querySelector('.pc-res').innerHTML = good ? `${icon('check')}Зручніше` : `${icon('x')}Гірше`;
  });
  flagParts($('stage').querySelector(`.vcard[data-k="${worse}"]`), task.marks);
  finish(ok ? 1 : 0, (ok ? '' : `Зручніший — варіант ${task.ok === 'a' ? 'А' : 'Б'}. `) + esc(task.why), task.marks.map(m => `<li class="bad"><span class="num"></span><span>${esc(m.t)}</span></li>`).join(''));
}
function answerSpot(el) {
  if (answered) return;
  const bad = [task.bad].flat(), ok = bad.includes(el.dataset.p);
  const box = $('stage').querySelector('.spot');
  box.classList.add('done');
  if (!ok) el.classList.add('miss');
  bad.forEach(p => box.querySelectorAll(`[data-p="${CSS.escape(p)}"]`).forEach(e => e.classList.add('found')));
  finish(ok ? 1 : 0, (ok ? '' : 'Проблема в іншому місці — її обведено зеленим. ') + esc(task.why));
}
function answerChoice(k) {
  if (answered) return;
  const x = task.options[k], right = task.options.find(y => y.ok);
  $('stage').querySelectorAll('.opt').forEach(b => { b.disabled = true; if (task.options[+b.dataset.k].ok) b.classList.add('right'); });
  if (!x.ok) $('stage').querySelector(`.opt[data-k="${k}"]`).classList.add('wrong');
  finish(x.ok ? 1 : 0, x.ok ? esc(x.why) : `${esc(x.why)} Правильно: <b>«${esc(right.t)}»</b>. ${esc(right.why)}`);
}

/* ── «Виправ сам» ── */
function showFix(head) {
  fx = { s: { ...task.state }, hint: false };
  $('stage').innerHTML = head + `<div class="fix"><div class="fix-mock"><div class="mock-box" id="fixMock"></div></div>
    <div class="fix-panel"><div class="ctrls" id="ctrls">${task.controls.map(ctrlHtml).join('')}</div><div id="meter"></div>
      <div class="checks"><b>Перевірки</b><ul id="checks"></ul></div>
      <p class="hint-box" id="fixHint" hidden></p>
      <div class="fix-actions"><button class="btn" id="fixHintBtn">${icon('bulb')}Підказка</button><span class="grow"></span><button class="btn btn-primary" id="fixDone">${icon('check')}Готово</button></div></div></div>`;
  $('ctrls').addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    const c = task.controls.find(x => x.k === b.dataset.c);
    fx.s[c.k] = c.type === 'toggle' ? !fx.s[c.k] : decode(b.dataset.v);
    updateFix();
  });
  $('ctrls').addEventListener('input', e => { if (e.target.type === 'range') { fx.s[e.target.dataset.c] = +e.target.value; updateFix(); } });
  $('fixHintBtn').onclick = () => { fx.hint = true; $('fixHint').innerHTML = icon('bulb') + `<span>${esc(task.hint)}</span>`; $('fixHint').hidden = false; };
  $('fixDone').onclick = () => { if (!answered && task.checks.every(c => c.ok(fx.s))) finish(fixScore(fx.hint), fx.hint ? 'Виправлено з підказкою. Наступного разу — самостійно!' : 'Усе виправлено — інтерфейс став зручним.'); };
  updateFix();
}
const enc = v => JSON.stringify(v), decode = v => JSON.parse(v);
function ctrlHtml(c) {
  const v = task.state[c.k];
  let body;
  if (c.type === 'seg') body = `<div class="opts${c.options.some(([, lab]) => lab.length > 14) ? ' col' : ''}">${c.options.map(([val, lab]) => `<button data-c="${c.k}" data-v='${esc(enc(val))}'>${esc(lab)}${c.unit && /^\d+$/.test(lab) ? `<small>${c.unit}</small>` : ''}</button>`).join('')}</div>`;
  else if (c.type === 'swatch') body = `<div class="swatches">${c.options.map(col => `<button class="sw" data-c="${c.k}" data-v='${esc(enc(col))}' title="${col}" style="--sw:${col}"></button>`).join('')}</div>`;
  else if (c.type === 'range') body = `<div class="range"><input type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${v}" data-c="${c.k}"><b class="rv" data-rv="${c.k}"></b></div>`;
  else body = `<button class="tgl" data-c="${c.k}" data-v="1"><i></i><span class="tgl-l"></span></button>`;
  return `<div class="ctrl"><span class="ctrl-l">${esc(c.label)}</span>${body}</div>`;
}
function updateFix() {
  const s = fx.s;
  $('fixMock').innerHTML = mock(task.build(s));
  for (const c of task.controls) {
    if (c.type === 'seg' || c.type === 'swatch') $('ctrls').querySelectorAll(`[data-c="${c.k}"]`).forEach(b => b.classList.toggle('on', b.dataset.v === enc(s[c.k])));
    if (c.type === 'range') $('ctrls').querySelector(`[data-rv="${c.k}"]`).textContent = s[c.k] + (c.unit || '');
    if (c.type === 'toggle') { const b = $('ctrls').querySelector(`[data-c="${c.k}"]`); b.classList.toggle('on', !!s[c.k]); b.querySelector('.tgl-l').textContent = s[c.k] ? 'Увімкнено' : 'Вимкнено'; }
  }
  if (task.meter) {
    const [fg, bg] = task.meter(s), r = contrast(fg, bg), lvl = r >= 4.5 ? 'ok' : r >= 3 ? 'part' : 'bad';
    $('meter').innerHTML = `<div class="cmeter ${lvl}"><span class="m-sample" style="color:${fg};background:${bg}">Аа</span><div class="m-text"><span>Контраст</span><b>${fmtRatio(r)}</b><small>${contrastLevel(r)}</small></div><div class="m-bar"><i style="width:${Math.min(100, r / 7 * 100)}%"></i><em style="left:${4.5 / 7 * 100}%"></em></div></div>`;
  }
  const res = task.checks.map(c => c.ok(s));
  $('checks').innerHTML = task.checks.map((c, i) => `<li class="${res[i] ? 'ok' : ''}">${icon(res[i] ? 'check' : 'circle')}<span>${esc(c.t)}</span></li>`).join('');
  $('fixDone').disabled = answered || !res.every(Boolean);
}

function finish(score, why, list = '') {
  answered = true; scores[ti] = score;
  $('stage').classList.add('done');
  if ($('fixDone')) $('fixDone').disabled = true;
  const kind = score >= 0.9 ? 'ok' : score > 0 ? 'part' : 'bad';
  $('feedback').className = 'feedback ' + kind;
  $('fbIco').innerHTML = icon(kind === 'ok' ? 'check' : kind === 'part' ? 'bulb' : 'x');
  $('fbTitle').textContent = kind === 'ok' ? 'Правильно!' : kind === 'part' ? 'Вийшло з підказкою' : 'Неправильно';
  $('fbWhy').innerHTML = why;
  $('fbList').innerHTML = list;
  $('fbNext').innerHTML = (ti + 1 < level.tasks.length ? 'Далі' : 'Завершити') + icon('arrow');
  $('feedback').hidden = false;
  renderDots();
  setTimeout(() => { $('fbNext').focus({ preventScroll: true }); $('feedback').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 30);
}
function next() { if (!level || ti < 0 || !answered) return; if (ti + 1 < level.tasks.length) { ti++; showTask(); window.scrollTo?.(0, 0); $('play').scrollTop = 0; } else complete(); }
$('fbNext').onclick = next;

function complete() {
  const avg = scores.reduce((a, b) => a + b, 0) / level.tasks.length;
  const stars = starsFor(avg), p = Math.round(avg * 100), prev = best(level.id);
  if (!prev || stars > prev.stars || (stars === prev.stars && p > prev.pct)) { progress.best[level.id] = { stars, pct: p, at: Date.now() }; saveProgress(); }
  $('resStars').innerHTML = [0, 1, 2].map(i => icon('star', i < stars ? 'on' : '')).join('');
  $('resTitle').textContent = stars === 3 ? 'Око дизайнера!' : stars === 2 ? 'Добре!' : 'Рівень пройдено';
  $('resMsg').textContent = `Точність ${p}%. ${stars === 3 ? 'Чудово!' : 'Для трьох зірок — без помилок і підказок.'}`;
  const nx = cur + 1 < LEVELS.length;
  $('resNext').disabled = !nx || !unlocked(cur + 1);
  $('resNext').innerHTML = nx ? 'Далі' + icon('arrow') : 'Усі рівні пройдено';
  $('result').hidden = false;
  setTimeout(() => $('resNext').focus(), 50);
}
$('resRetry').onclick = () => openLevel(cur);
$('resNext').onclick = () => openLevel(cur + 1);
$('resLevels').onclick = () => showHome();

/* ═════════ Головна ═════════ */
const CH_ICON = { read: 'type', space: 'space', hier: 'layers', forms: 'form', master: 'award' };
function showHome() {
  cur = -1; level = null; task = null;
  $('play').hidden = true; $('result').hidden = true; $('home').hidden = false;
  window.history.replaceState(null, '', location.pathname);
  renderHome();
}
function nextToPlay() {
  let i = LEVELS.findIndex((l, k) => unlocked(k) && !best(l.id)?.stars);
  if (i < 0) i = LEVELS.findIndex(l => (best(l.id)?.stars || 0) < 3);
  return i;
}
const thumb = l => `<span class="th-big">${icon(CH_ICON[l.chapter])}</span><span class="th-kinds">${[...new Set(l.tasks.map(t => t.kind))].map(k => icon(KIND[k][0])).join('')}</span>`;
function renderHome() {
  $('chapters').innerHTML = CHAPTERS.map((ch, ci) => {
    const items = LEVELS.map((l, i) => ({ l, i })).filter(x => x.l.chapter === ch.id);
    const got = items.reduce((s, { l }) => s + (best(l.id)?.stars || 0), 0);
    return `<section class="chapter"><div class="chapter-head"><span class="ch-num">${ci + 1}</span><div class="ch-text"><h2>${ch.name}</h2><span>${ch.desc}</span></div><span class="ch-stars">${icon('star')}${got} / ${items.length * 3}</span></div><div class="levels">${items.map(({ l, i }) => {
      const b = best(l.id), open = unlocked(i);
      return `<button class="lvl${b?.stars === 3 ? ' perfect' : ''}${open && !b ? ' fresh' : ''}" data-level="${i}" ${open ? '' : 'disabled title="Спершу пройдіть попередній рівень"'}>
        <div class="lvl-thumb ch-${l.chapter}">${open ? thumb(l) : `<span class="lvl-lock">${icon('lock')}</span>`}</div>
        <span class="lvl-num">${i + 1}</span>
        <div class="lvl-name">${esc(l.name)}</div>
        <div class="lvl-meta">${starsHtml(b?.stars || 0)}<span class="lvl-acc">${b ? b.pct + '%' : `${l.tasks.length} ${plural(l.tasks.length, 'завдання', 'завдання', 'завдань')}`}</span></div>
      </button>`;
    }).join('')}</div></section>`;
  }).join('');
  const s = totalStars(), max = LEVELS.length * 3, pr = Math.round(passed() / LEVELS.length * 100);
  $('total').innerHTML = icon('star') + s + ' / ' + max;
  $('heroStars').textContent = s; $('heroMax').textContent = max;
  $('heroAcc').textContent = perfect();
  $('ringPct').textContent = pr + '%';
  $('ringFg').style.strokeDashoffset = String(326.7 * (1 - pr / 100));
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
  if ($('play').hidden || e.target.closest?.('input')) return;
  if (ti < 0 && e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); $('goBtn')?.click(); return; }
  if (answered && e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); next(); return; }
  if (answered || !task || e.ctrlKey || e.altKey || e.metaKey) return;
  const k = ['1', '2', '3', '4'].indexOf(e.key);
  if (task.kind === 'pair') {
    if (e.key === 'Enter' && e.target.closest?.('.vcard')) { e.preventDefault(); answerPair(e.target.closest('.vcard').dataset.k); }
    else if (k === 0 || k === 1) answerPair('ab'[k]);
  } else if (task.kind === 'choice' && k >= 0) $('stage').querySelector(`.opt[data-k="${k}"]`)?.click();
});

/* ═════════ Результати для вчителя ═════════ */
$('reportBtn').onclick = () => {
  $('studentName').value = progress.name;
  $('reportSum').innerHTML = `Пройдено рівнів: <b>${passed()} з ${LEVELS.length}</b><br>Зірок: <b>${totalStars()} з ${LEVELS.length * 3}</b><br>Рівнів на три зірки: <b>${perfect()}</b>`;
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
  a.download = 'uiux-' + name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() + '.png';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
};
function starPath(x, cx, cy, r) {
  x.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  x.closePath();
}
export async function reportImage(name) {
  const CW = 1200, PAD = 40, HEAD = 190, ROW = 44;
  const half = Math.ceil(LEVELS.length / 2);
  const c = document.createElement('canvas'); c.width = CW; c.height = HEAD + half * ROW + 60;
  const x = c.getContext('2d');
  const font = (w, s, mono) => `${w} ${s}px ${mono ? 'JetBrains Mono, monospace' : 'Inter, system-ui, sans-serif'}`;
  x.fillStyle = '#fff'; x.fillRect(0, 0, CW, c.height);
  x.fillStyle = '#4F6BF4'; x.fillRect(0, 0, CW, 8);
  x.fillStyle = '#1a1d23'; x.font = font(800, 30); x.fillText('UI/UX-дизайнер — результати', PAD, 62);
  x.font = font(600, 20); x.fillStyle = '#4b5563'; x.fillText(name, PAD, 98);
  x.font = font(500, 15); x.fillStyle = '#9ca3af'; x.fillText(new Date().toLocaleString('uk-UA', { dateStyle: 'long', timeStyle: 'short' }), PAD, 124);
  [['Пройдено', `${passed()} / ${LEVELS.length}`], ['Зірки', `${totalStars()} / ${LEVELS.length * 3}`], ['На 3 зірки', String(perfect())]].forEach(([k, v], i) => {
    const bx = CW - PAD - (3 - i) * 190;
    x.fillStyle = '#f3f5f9'; x.beginPath(); x.roundRect(bx, 40, 176, 92, 14); x.fill();
    x.fillStyle = '#9ca3af'; x.font = font(600, 13); x.fillText(k, bx + 16, 66);
    x.fillStyle = '#1a1d23'; x.font = font(800, 30); x.fillText(v, bx + 16, 110);
  });
  const colW = (CW - PAD * 2) / 2;
  LEVELS.forEach((l, i) => {
    const ox = PAD + Math.floor(i / half) * colW, oy = HEAD + (i % half) * ROW, b = best(l.id);
    if (i % 2 === 0) { x.fillStyle = '#f7f8fa'; x.fillRect(ox - 8, oy - 28, colW - 20, ROW); }
    x.fillStyle = '#9ca3af'; x.font = font(700, 13, true); x.fillText(String(i + 1).padStart(2, '0'), ox, oy);
    x.fillStyle = '#1a1d23'; x.font = font(600, 16); x.fillText(l.name, ox + 34, oy);
    if (b) {
      for (let s = 0; s < 3; s++) { starPath(x, ox + 330 + s * 20, oy - 6, 8); x.fillStyle = s < b.stars ? '#f5b942' : '#e2e5ea'; x.fill(); }
      x.fillStyle = '#1a1d23'; x.font = font(700, 14, true); x.fillText(b.pct + '%', ox + 400, oy);
    } else { x.fillStyle = '#b0b6c2'; x.font = font(500, 14); x.fillText('не пройдено', ox + 330, oy); }
  });
  x.fillStyle = '#9ca3af'; x.font = font(500, 13); x.fillText('Edvault · UI/UX-дизайнер', PAD, c.height - 22);
  return new Promise(r => c.toBlob(r, 'image/png'));
}

/* ═════════ Старт ═════════ */
const fromHash = LEVELS.findIndex(l => '#' + l.id === location.hash);
if (fromHash >= 0 && unlocked(fromHash)) openLevel(fromHash); else showHome();
window.UiuxTrainer = {
  LEVELS, openLevel,
  setFix(st) { Object.assign(fx.s, st); updateFix(); },
  get progress() { return progress; }, get task() { return task; }, get answered() { return answered; }, get scores() { return scores; }, get fix() { return fx; },
};
