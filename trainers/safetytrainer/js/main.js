// Безпека в інтернеті · Edvault — рівні, завдання шести типів, розбір відповідей, прогрес і результати.
import { CHAPTERS, LEVELS } from './levels.js';
import { parseUrl, strength, segments, scorePick, starsFor, COMMON } from './logic.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ═════════ Іконки ═════════ */
const P = {
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  shieldOk: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  shieldX: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m14.5 9.5-5 5M9.5 9.5l5 5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  left: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  up: '<path d="m18 15-6-6-6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
  ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2"/>',
  pen: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  msg: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  key: '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  phone: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  brush: '<path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  cat: '<path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z"/><path d="M8 14v.5M16 14v.5M11.25 16.25h1.5L12 17l-.75-.75Z"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  wifi: '<path d="M12 20h.01M2 8.82a15 15 0 0 1 20 0M5 12.86a10 10 0 0 1 14 0M8.5 16.43a5 5 0 0 1 7 0"/>',
  school: '<path d="M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z"/><path d="M22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  id: '<rect width="20" height="14" x="2" y="5" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M14 10h4M14 14h4M6 16h4"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  game: '<path d="M6 11h4M8 9v4M15 12h.01M18 10h.01"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59l-.92 8.24A2.5 2.5 0 0 0 6.25 19.5c.85 0 1.64-.43 2.1-1.15L10 16h4l1.65 2.35c.46.72 1.25 1.15 2.1 1.15a2.5 2.5 0 0 0 2.47-2.67l-.92-8.24A4 4 0 0 0 17.32 5z"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
  clip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>',
  star: '<path fill="currentColor" stroke="none" d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
};
const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || P.info}</svg>`;
const starsHtml = n => `<span class="stars">${[0, 1, 2].map(i => icon('star', i < n ? 'on' : '')).join('')}</span>`;
document.querySelectorAll('[data-icon]').forEach(e => { e.outerHTML = icon(e.dataset.icon); });
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2400); }
const plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c;
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

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
const KEY = 'edvault-safety';
let progress = (() => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } })();
if (!progress || typeof progress !== 'object') progress = {};
progress = { name: progress.name || '', best: progress.best || {} };
const saveProgress = () => { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* немає місця */ } };
const best = id => progress.best[id];
const unlocked = i => i === 0 || (best(LEVELS[i - 1].id)?.stars || 0) >= 1;
const passed = () => LEVELS.filter(l => best(l.id)?.stars).length;
const totalStars = () => LEVELS.reduce((s, l) => s + (best(l.id)?.stars || 0), 0);
const avgAcc = () => { const b = LEVELS.map(l => best(l.id)).filter(Boolean); return b.length ? Math.round(b.reduce((s, x) => s + x.pct, 0) / b.length) : null; };

/* ═════════ Гра ═════════ */
let level = null, cur = -1, ti = -1, scores = [], task = null, answered = false, st = {};
const pct = s => Math.round(s * 100);

function openLevel(i) {
  if (!LEVELS[i] || !unlocked(i)) { showHome(); return; }
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  cur = i; level = LEVELS[i]; scores = [];
  $('home').hidden = true; $('play').hidden = false; $('result').hidden = true;
  $('lvlChapter').textContent = CHAPTERS.find(c => c.id === level.chapter).name;
  $('lvlName').textContent = `${i + 1}. ${level.name}`;
  $('lvlHint').innerHTML = tipsHtml();
  $('lvlHint').hidden = true; $('tipsBtn').classList.remove('on');
  $('navNum').textContent = `${i + 1} / ${LEVELS.length}`;
  $('prevBtn').disabled = i === 0;
  $('nextBtn').disabled = !(i + 1 < LEVELS.length && unlocked(i + 1));
  showIntro();
  if (location.hash !== '#' + level.id) window.history.replaceState(null, '', '#' + level.id);
}
const tipsHtml = () => `<ul class="tips">${level.tips.map(([ic, t]) => `<li><span class="tip-ico">${icon(ic)}</span><span>${t}</span></li>`).join('')}</ul>`;
// пам’ятка перед завданнями
function showIntro() {
  ti = -1; task = null; answered = false;
  $('feedback').hidden = true; $('tipsBtn').hidden = true;
  $('stage').className = 'stage intro';
  $('stage').innerHTML = `<div class="intro-head"><span class="intro-ico">${icon('book')}</span><div><small>Пам’ятка перед рівнем</small><h2>${esc(level.name)}</h2></div></div>${tipsHtml()}
    <div class="verdicts"><span class="note">${icon('info')}${level.tasks.length} ${plural(level.tasks.length, 'завдання', 'завдання', 'завдань')} · пам’ятку можна відкрити будь-коли</span><span class="grow"></span><button class="btn btn-primary btn-lg2" id="goBtn">${icon('play')}Почати</button></div>`;
  $('goBtn').onclick = () => { ti = 0; showTask(); };
  renderDots();
  setTimeout(() => $('goBtn')?.focus({ preventScroll: true }), 30);
}
$('tipsBtn').onclick = () => { const h = !$('lvlHint').hidden; $('lvlHint').hidden = h; $('tipsBtn').classList.toggle('on', !h); };
function renderDots() {
  $('dots').innerHTML = level.tasks.map((_, k) => {
    const s = scores[k];
    const cls = k === ti && !answered ? 'cur' : s == null ? '' : s >= 0.9 ? 'ok' : s > 0 ? 'part' : 'bad';
    return `<i class="${cls}"></i>`;
  }).join('');
  $('stepN').textContent = ti < 0 ? 'Пам’ятка' : `Завдання ${ti + 1} з ${level.tasks.length}`;
}
function showTask() {
  task = level.tasks[ti]; answered = false; st = {};
  $('feedback').hidden = true; $('tipsBtn').hidden = false;
  $('stage').className = 'stage k-' + task.kind;
  RENDER[task.kind]();
  renderDots();
  $('play').scrollTop = 0;
}
// розбір: score 0…1, why — пояснення (HTML із рівнів), list — [{s: ok|miss|bad, html}]
function finish(score, why, list = []) {
  answered = true; scores[ti] = score;
  $('stage').classList.add('done');
  const kind = score >= 0.9 ? 'ok' : score > 0 ? 'part' : 'bad';
  $('feedback').className = 'feedback ' + kind;
  $('fbIco').innerHTML = icon(kind === 'ok' ? 'shieldOk' : kind === 'part' ? 'alert' : 'shieldX');
  $('fbTitle').textContent = kind === 'ok' ? 'Правильно!' : kind === 'part' ? `Майже: ${pct(score)}%` : 'Неправильно';
  $('fbWhy').innerHTML = why || '';
  $('fbList').innerHTML = list.map(x => `<li class="${x.s}">${icon(x.s === 'ok' ? 'check' : x.s === 'miss' ? 'alert' : x.s === 'info' ? 'search' : 'x')}<span>${x.html}</span></li>`).join('');
  $('fbNext').innerHTML = (ti + 1 < level.tasks.length ? 'Далі' : 'Завершити') + icon('arrow');
  $('feedback').hidden = false;
  renderDots();
  setTimeout(() => { $('feedback').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); $('fbNext').focus({ preventScroll: true }); }, 30);
}
$('fbNext').onclick = () => { if (ti + 1 < level.tasks.length) { ti++; showTask(); } else complete(); };

/* ── адресний рядок: після відповіді підсвічуємо ім’я сайту ── */
function addressBar(url, reveal = false) {
  const u = parseUrl(url);
  return `<div class="addr${u.secure ? '' : ' insecure'}"><span class="addr-lock" title="${u.secure ? 'Захищене з’єднання (https)' : 'Незахищене з’єднання (http)'}">${icon(u.secure ? 'lock' : 'unlock')}</span><span class="addr-url">${u.chunks.map(c => `<span class="ch ${c.part}${reveal && c.part === 'domain' ? ' real' : ''}">${esc(c.t)}</span>`).join('')}</span></div>`;
}
const domainLine = url => { const u = parseUrl(url); return `Ім’я сайту: <b>${esc(u.domain)}</b>${u.secure ? '' : ' · з’єднання без <b>https</b>'}`; };

/* ── повідомлення: підозрілі місця показуємо після відповіді ── */
function segHtml(str) {
  // шматки з’єднуються одним пробілом — без подвійних
  return segments(str).filter(s => !s.space).map(s => s.flag ? `<span class="seg" data-flag="${esc(s.flag)}">${esc(s.t.trim())}</span>` : esc(s.t.trim())).join(' ');
}
function mockHtml(m) {
  const S = k => m[k] ? segHtml(m[k]) : '';
  if (m.type === 'email') return `<div class="mock email">
      <div class="em-top">${icon('mail')}<span>Вхідні</span></div>
      <div class="em-subj">${S('subject')}</div>
      <div class="em-from"><span class="avatar">${esc(m.fromName[0])}</span><div><b>${esc(m.fromName)}</b><small>&lt;${S('from')}&gt;</small></div><span class="em-to">кому: мені</span></div>
      <div class="em-body">${S('body')}</div>
      ${m.attach ? `<div class="em-attach">${icon('clip')}${S('attach')}</div>` : ''}
      ${m.button ? `<div class="em-btn"><span class="btnlike">${S('button')}</span></div>` : ''}
      ${m.link ? `<div class="em-link">${icon('link')}${S('link')}</div>` : ''}
    </div>`;
  if (m.type === 'sms') return `<div class="mock phone"><div class="ph-head">${icon('msg')}<b>${segHtml(m.from)}</b><small>SMS</small></div><div class="bubble in">${S('body')}</div></div>`;
  if (m.type === 'chat') return `<div class="mock chat"><div class="ch-head"><span class="avatar">${esc(m.name[0])}</span><b>${esc(m.name)}</b><small>у мережі</small></div>${m.lines.map(l => `<div class="bubble in">${segHtml(l)}</div>`).join('')}</div>`;
  if (m.type === 'popup') return `<div class="mock browser"><div class="br-bar"><span class="br-dots"><i></i><i></i><i></i></span><div class="addr small">${icon('lock')}<span>${segHtml(m.url)}</span></div></div><div class="br-page"><div class="pop"><div class="pop-ico">${icon('gift')}</div><h4>${S('title')}</h4><p>${S('body')}</p><span class="pop-btn">${esc(m.button)}</span></div></div></div>`;
  if (m.type === 'post') return `<div class="mock post"><div class="post-head"><span class="avatar">${esc(m.name[0])}</span><div><b>${esc(m.name)}</b>${m.place ? `<small>${icon('pin')}${S('place')}</small>` : '<small>щойно</small>'}</div></div><div class="post-body">${S('body')}</div>${m.photo ? `<div class="post-photo">${icon('image')}<span>${S('photo')}</span></div>` : ''}<div class="post-foot">${icon('star')}Подобається · Коментувати · Поширити</div></div>`;
  return '';
}
const verdictBtns = (labels, values = [1, 0]) => `<div class="verdicts big"><button class="vbtn safe" data-v="${values[0]}">${icon('shieldOk')}${esc(labels[0])}</button><button class="vbtn scam" data-v="${values[1]}">${icon('shieldX')}${esc(labels[1])}</button></div>`;
// rightV — значення правильної кнопки: її підсвічуємо, навіть якщо учень помилився
function onVerdict(rightV, cb) {
  $('stage').querySelector('.verdicts').addEventListener('click', e => {
    const b = e.target.closest('.vbtn'); if (!b || answered) return;
    $('stage').querySelectorAll('.vbtn').forEach(x => { x.disabled = true; if (x.dataset.v === String(rightV)) x.classList.add('right'); });
    if (b.dataset.v !== String(rightV)) b.classList.add('wrong');
    cb(b.dataset.v === String(rightV), b);
  });
}

const RULES = {
  len12: ['Щонайменше 12 символів', p => p.length >= 12],
  len20: ['Щонайменше 20 символів', p => p.length >= 20],
  upper: ['Велика літера', p => /\p{Lu}/u.test(p)],
  lower: ['Мала літера', p => /\p{Ll}/u.test(p)],
  digit: ['Цифра', p => /\d/.test(p)],
  symbol: ['Спецсимвол: ! # ? % & …', p => /[^\p{L}\p{N}\s]/u.test(p)],
  notCommon: ['Не простий (не 123456, не qwerty)', p => !!p && !COMMON.includes(p.toLowerCase())],
  words4: ['Чотири слова через дефіс', p => p.split(/[\s\-_]+/).filter(w => /^\p{L}{2,}$/u.test(w)).length >= 4],
  noPersonal: ['Без імені, прізвища, кота, міста й року Олі', (p, t) => !!p && !(t.personal || []).some(w => p.toLowerCase().includes(w))],
  score3: ['Надійність — «надійний» або краще', (p, t) => strength(p, t.personal).score >= 3],
};
function meterHtml(pw, personal) {
  const s = strength(pw, personal);
  return `<div class="meter s${pw ? s.score : 'x'}"><div class="meter-bar">${[0, 1, 2, 3, 4].map(k => `<i class="${pw && k <= s.score ? 'on' : ''}"></i>`).join('')}</div><span class="meter-l">${pw ? s.label : 'введіть пароль'}</span><span class="meter-t">${pw ? `підбір: ${s.time}` : ''}</span></div>`;
}

const RENDER = {
  yesno() {
    $('stage').innerHTML = `<h2 class="q">${esc(task.q)}</h2>${task.url ? addressBar(task.url) : ''}${verdictBtns(task.labels || ['Так', 'Ні'])}`;
    onVerdict(task.yes ? 1 : 0, ok => {
      if (task.url) $('stage').querySelector('.addr').outerHTML = addressBar(task.url, true);
      finish(ok ? 1 : 0, task.why, task.url ? [{ s: 'info', html: domainLine(task.url) }] : []);
    });
  },
  which() {
    $('stage').innerHTML = `<h2 class="q">${esc(task.q)}</h2><div class="links">${task.options.map((u, k) => `<button class="lopt" data-k="${k}"><span class="opt-k">${'АБВ'[k]}</span>${addressBar(u)}</button>`).join('')}</div>`;
    $('stage').querySelector('.links').addEventListener('click', e => {
      const b = e.target.closest('.lopt'); if (!b || answered) return;
      const k = +b.dataset.k, ok = k === task.answer;
      $('stage').querySelectorAll('.lopt').forEach(x => {
        x.disabled = true;
        x.querySelector('.addr').outerHTML = addressBar(task.options[+x.dataset.k], true);
        if (+x.dataset.k === task.answer) x.classList.add('right');
      });
      if (!ok) b.classList.add('wrong');
      finish(ok ? 1 : 0, task.why);
    });
  },
  msg() {
    $('stage').innerHTML = `<h2 class="q">${esc(task.q || 'Цьому повідомленню можна довіряти?')}</h2>${mockHtml(task.m)}${verdictBtns(task.labels || ['Можна довіряти', 'Це обман'], [0, 1])}`;
    onVerdict(task.scam ? 1 : 0, ok => {
      const flags = [...$('stage').querySelectorAll('.seg')];
      flags.forEach(x => x.classList.add('flag'));
      const head = task.scam ? (task.labels ? 'Краще не публікувати. ' : 'Це обман. ') : (task.labels ? 'Таке можна публікувати. ' : 'Цьому можна довіряти. ');
      finish(ok ? 1 : 0, head + task.why, flags.map(x => ({ s: 'miss', html: `<b>«${esc(x.textContent)}»</b> — ${esc(x.dataset.flag)}` })));
    });
  },
  pair() {
    st.side = Math.random() < 0.5;
    const [l, r] = st.side ? [task.a, task.b] : [task.b, task.a];
    $('stage').innerHTML = `<h2 class="q">${esc(task.q)}</h2><div class="pair">${[l, r].map((p, k) => `<button class="pw-card" data-p="${esc(p)}"><span class="opt-k">${'АБ'[k]}</span><code>${esc(p)}</code><span class="pw-meter"></span></button>`).join('')}</div>`;
    $('stage').querySelector('.pair').addEventListener('click', e => {
      const b = e.target.closest('.pw-card'); if (!b || answered) return;
      const best = strength(task.a).bits > strength(task.b).bits ? task.a : task.b, ok = b.dataset.p === best;
      $('stage').querySelectorAll('.pw-card').forEach(x => { x.disabled = true; x.querySelector('.pw-meter').innerHTML = meterHtml(x.dataset.p); if (x.dataset.p === best) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      finish(ok ? 1 : 0, task.why);
    });
  },
  make() {
    const prof = task.personal && level.profile ? profileHtml(level.profile) : '';
    $('stage').innerHTML = `<h2 class="q">${esc(task.q)}</h2>${prof}<p class="warn">${icon('alert')}Не вводьте свій справжній пароль — придумайте новий. Тут нічого не зберігається.</p>
      <input class="pw" id="pw" type="text" autocomplete="off" spellcheck="false" autocapitalize="off" placeholder="Придумайте пароль">
      <div id="meter">${meterHtml('', task.personal)}</div>
      <ul class="rules" id="rules"></ul>
      <div class="verdicts"><span class="grow"></span><button class="btn btn-primary btn-lg2" id="checkBtn" disabled>${icon('check')}Готово</button></div>`;
    const upd = () => {
      const p = $('pw').value;
      const res = task.rules.map(r => [RULES[r][0], RULES[r][1](p, task)]);
      $('rules').innerHTML = res.map(([t, ok]) => `<li class="${ok ? 'ok' : ''}">${icon(ok ? 'check' : 'x')}${esc(t)}</li>`).join('');
      $('meter').innerHTML = meterHtml(p, task.personal);
      $('checkBtn').disabled = !res.every(x => x[1]);
    };
    $('pw').addEventListener('input', upd);
    $('pw').addEventListener('keydown', e => { if (e.key === 'Enter' && !$('checkBtn').disabled) { e.preventDefault(); e.stopPropagation(); $('checkBtn').click(); } });
    upd(); setTimeout(() => $('pw').focus(), 30);
    $('checkBtn').onclick = () => {
      if (answered) return;
      const s = strength($('pw').value, task.personal);
      $('pw').disabled = true; $('checkBtn').disabled = true;
      finish(1, task.why, [{ s: 'ok', html: `Надійність: <b>${s.label}</b> · підібрати можна за: <b>${s.time}</b>` }]);
      $('pw').value = '•'.repeat($('pw').value.length); // не тримаємо пароль на сторінці
    };
  },
  pick() {
    st.order = shuffle(task.items.map((_, k) => k));
    const need = task.items.filter(i => i.bad).length;
    const head = task.app ? `<div class="app-head"><span class="app-ico">${icon(task.app === 'Карти' ? 'pin' : task.app === 'Ліхтарик' ? 'sun' : 'game')}</span><div><b>${esc(task.app)}</b><small>запитує доступ до:</small></div></div>`
      : level.profile ? profileHtml(level.profile) : '';
    $('stage').innerHTML = `<h2 class="q">${esc(task.q)}</h2>${head}<div class="cards">${st.order.map(k => { const it = task.items[k]; return `<button class="pcard${it.icon ? '' : ' mono'}" data-k="${k}">${icon(it.icon || 'key')}<span>${esc(it.t)}</span><i class="tick">${icon('check')}</i></button>`; }).join('')}</div>
      <div class="verdicts"><span class="marked-n" id="markedN"></span><span class="grow"></span><button class="btn btn-primary btn-lg2" id="checkBtn">${icon('check')}Перевірити</button></div>`;
    const cards = [...$('stage').querySelectorAll('.pcard')];
    const count = () => { $('markedN').textContent = `Позначено ${cards.filter(x => x.classList.contains('on')).length} з ${need}`; };
    count();
    $('stage').querySelector('.cards').addEventListener('click', e => { const c = e.target.closest('.pcard'); if (!c || answered) return; c.classList.toggle('on'); count(); });
    $('checkBtn').onclick = () => {
      if (answered) return;
      const picked = cards.filter(x => x.classList.contains('on')).map(x => +x.dataset.k);
      const correct = task.items.map((it, k) => it.bad ? k : -1).filter(k => k >= 0);
      cards.forEach(c => { const k = +c.dataset.k, bad = task.items[k].bad, on = c.classList.contains('on'); c.classList.add(bad ? (on ? 'found' : 'missed') : on ? 'extra' : 'fine'); c.disabled = true; });
      $('checkBtn').disabled = true;
      const missed = correct.filter(k => !picked.includes(k)), extra = picked.filter(k => !correct.includes(k));
      finish(scorePick(correct, picked), task.why, [
        ...missed.map(k => ({ s: 'miss', html: `Треба було позначити: <b>${esc(task.items[k].t)}</b>` })),
        ...extra.map(k => ({ s: 'bad', html: `Це можна: <b>${esc(task.items[k].t)}</b>` })),
      ]);
    };
  },
  choice() {
    const sc = task.scene;
    const scene = !sc ? '' : sc.type === 'chat' ? `<div class="mock chat small"><div class="ch-head"><span class="avatar">${esc(sc.name[0])}</span><b>${esc(sc.name)}</b></div>${sc.lines.map(l => `<div class="bubble in">${esc(l)}</div>`).join('')}</div>`
      : `<div class="mock phone small"><div class="ph-head">${icon('msg')}<b>${esc(sc.from)}</b><small>SMS</small></div><div class="bubble in">${esc(sc.body)}</div></div>`;
    $('stage').innerHTML = `<h2 class="q">${esc(task.q)}</h2>${scene}<div class="options">${task.options.map((o, k) => `<button class="opt" data-k="${k}"><span class="opt-k">${'АБВГ'[k]}</span><span class="opt-t">${esc(o.t)}</span></button>`).join('')}</div>`;
    $('stage').querySelector('.options').addEventListener('click', e => {
      const b = e.target.closest('.opt'); if (!b || answered) return;
      const o = task.options[+b.dataset.k], right = task.options.find(x => x.ok);
      $('stage').querySelectorAll('.opt').forEach(x => { x.disabled = true; if (task.options[+x.dataset.k].ok) x.classList.add('right'); });
      if (!o.ok) b.classList.add('wrong');
      finish(o.ok ? 1 : 0, o.ok ? esc(o.why) : `${esc(o.why)} Правильна відповідь: <b>«${esc(right.t)}»</b>. ${esc(right.why)}`);
    });
  },
};
function profileHtml(p) {
  return `<div class="profile"><span class="avatar big">${esc(p.name[0])}</span><div><b>${esc(p.name)}</b><small>Відкритий профіль у «Друзях»</small><div class="facts">${p.facts.map(f => `<span>${esc(f)}</span>`).join('')}</div></div></div>`;
}

/* ═════════ Завершення рівня ═════════ */
function complete() {
  const avg = scores.reduce((a, b) => a + b, 0) / level.tasks.length, stars = starsFor(avg), p = pct(avg);
  const prev = best(level.id);
  if (!prev || stars > prev.stars || (stars === prev.stars && p > prev.pct)) { progress.best[level.id] = { stars, pct: p, at: Date.now() }; saveProgress(); }
  $('resStars').innerHTML = [0, 1, 2].map(i => icon('star', i < stars ? 'on' : '')).join('');
  $('resTitle').textContent = stars === 3 ? 'Вас не обдуриш!' : stars === 2 ? 'Добре!' : 'Рівень пройдено';
  const right = scores.filter(s => s >= 0.9).length;
  $('resMsg').textContent = `Точність ${p}% · правильно ${right} з ${level.tasks.length}. ${stars === 3 ? 'Чудова пильність!' : 'Для трьох зірок потрібно 90%. Перечитайте пояснення й спробуйте ще раз.'}`;
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
const CH_ICON = { links: 'link', phish: 'mail', pass: 'key', privacy: 'user', scams: 'game' };
const KIND_ICON = { yesno: 'shield', which: 'link', msg: 'mail', pick: 'grid', pair: 'key', make: 'pen', choice: 'info' };
function showHome() {
  cur = -1; level = null;
  $('play').hidden = true; $('result').hidden = true; $('home').hidden = false;
  window.history.replaceState(null, '', location.pathname);
  renderHome();
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
      const kinds = [...new Set(l.tasks.map(t => t.kind))];
      return `<button class="lvl${b?.stars === 3 ? ' perfect' : ''}${open && !b ? ' fresh' : ''}" data-level="${i}" ${open ? '' : 'disabled title="Спершу пройдіть попередній рівень"'}>
        <div class="lvl-thumb ch-${l.chapter}">${open ? `<span class="th-big">${icon(CH_ICON[l.chapter])}</span><span class="th-kinds">${kinds.map(k => icon(KIND_ICON[k])).join('')}</span>` : `<span class="lvl-lock">${icon('lock')}</span>`}</div>
        <span class="lvl-num">${i + 1}</span>
        <div class="lvl-name">${esc(l.name)}</div>
        <div class="lvl-meta">${starsHtml(b?.stars || 0)}<span class="lvl-acc">${b ? b.pct + '%' : `${l.tasks.length} ${plural(l.tasks.length, 'завдання', 'завдання', 'завдань')}`}</span></div>
      </button>`;
    }).join('')}</div></section>`;
  }).join('');
  const s = totalStars(), max = LEVELS.length * 3, p = Math.round(passed() / LEVELS.length * 100), a = avgAcc();
  $('total').innerHTML = icon('star') + s + ' / ' + max;
  $('heroStars').textContent = s; $('heroMax').textContent = max;
  $('heroAcc').textContent = a == null ? '—' : a + '%';
  $('ringPct').textContent = p + '%';
  $('ringFg').style.strokeDashoffset = String(326.7 * (1 - p / 100));
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
  if (answered && e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); $('fbNext').click(); return; }
  if (!answered && task?.kind === 'choice') { const k = ['1', '2', '3', '4'].indexOf(e.key); if (k >= 0) $('stage').querySelector(`.opt[data-k="${k}"]`)?.click(); }
});

/* ═════════ Результати для вчителя ═════════ */
$('reportBtn').onclick = () => {
  $('studentName').value = progress.name;
  const a = avgAcc();
  $('reportSum').innerHTML = `Пройдено рівнів: <b>${passed()} з ${LEVELS.length}</b><br>Зірок: <b>${totalStars()} з ${LEVELS.length * 3}</b><br>Середня точність: <b>${a == null ? '—' : a + '%'}</b>`;
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
  a.download = 'safety-' + name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() + '.png';
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
  x.fillStyle = '#0ea5e9'; x.fillRect(0, 0, W, 8);
  x.fillStyle = '#1a1d23'; x.font = font(800, 30); x.fillText('Безпека в інтернеті — результати', PAD, 62);
  x.font = font(600, 20); x.fillStyle = '#4b5563'; x.fillText(name, PAD, 98);
  x.font = font(500, 15); x.fillStyle = '#9ca3af'; x.fillText(new Date().toLocaleString('uk-UA', { dateStyle: 'long', timeStyle: 'short' }), PAD, 124);
  const a = avgAcc();
  [['Пройдено', `${passed()} / ${LEVELS.length}`], ['Зірки', `${totalStars()} / ${LEVELS.length * 3}`], ['Точність', a == null ? '—' : a + '%']].forEach(([k, v], i) => {
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
      x.fillStyle = b.pct >= 90 ? '#10b981' : '#1a1d23'; x.font = font(700, 14, true); x.fillText(`${b.pct}%`, ox + 400, oy);
    } else { x.fillStyle = '#b0b6c2'; x.font = font(500, 14); x.fillText('не пройдено', ox + 330, oy); }
  });
  x.fillStyle = '#9ca3af'; x.font = font(500, 13); x.fillText('Edvault · Безпека в інтернеті', PAD, c.height - 22);
  return new Promise(r => c.toBlob(r, 'image/png'));
}

/* ═════════ Старт ═════════ */
const fromHash = LEVELS.findIndex(l => '#' + l.id === location.hash);
if (fromHash >= 0 && unlocked(fromHash)) openLevel(fromHash); else showHome();
window.SafetyTrainer = { LEVELS, get progress() { return progress; }, get task() { return task; }, get scores() { return scores; }, get answered() { return answered; }, openLevel };
