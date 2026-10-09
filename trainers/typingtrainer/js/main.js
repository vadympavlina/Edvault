// Сліпий друк · Edvault — рівні, друк із підказками на клавіатурі, статистика, слабкі клавіші, результати для вчителя.
import { ROWS, LAYOUTS, FINGERS, HOME_KEYS, keyFor, shiftFor, labelFor, normChar } from './layouts.js';
import { CHAPTERS, LEVELS, makeText, summary, starsFor, weakText } from './lessons.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ═════════ Іконки ═════════ */
const P = {
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M10 13h4M7 16h10"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/>',
  text: '<path d="M17 6.1H3"/><path d="M21 12.1H3"/><path d="M15.1 18H3"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  star: '<path fill="currentColor" stroke="none" d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
};
const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
const starsHtml = n => `<span class="stars">${[0, 1, 2].map(i => icon('star', i < n ? 'on' : '')).join('')}</span>`;
document.querySelectorAll('[data-icon]').forEach(e => { e.outerHTML = icon(e.dataset.icon); });
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); }
const rng = (seed = Date.now()) => { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

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
const KEY = 'edvault-typing';
let progress = (() => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } })();
if (!progress || typeof progress !== 'object') progress = {};
progress = { name: progress.name || '', layout: LAYOUTS[progress.layout] ? progress.layout : 'uk', kb: progress.kb !== false, best: { uk: {}, en: {}, ...(progress.best || {}) }, keys: { uk: {}, en: {}, ...(progress.keys || {}) } };
const saveProgress = () => { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* немає місця */ } };
const lay = () => progress.layout;
const levels = () => LEVELS[lay()];
const best = id => progress.best[lay()][id];
const unlocked = i => i === 0 || (best(levels()[i - 1].id)?.stars || 0) >= 1;
const passed = () => levels().filter(l => (best(l.id)?.stars || 0) >= 1).length;
const totalStars = () => levels().reduce((s, l) => s + (best(l.id)?.stars || 0), 0);
// слабкі клавіші: найбільша частка помилок (за достатньої кількості натискань)
function weakKeys(layout = lay(), n = 6) {
  return Object.entries(progress.keys[layout]).map(([ch, v]) => ({ ch, rate: v.e / (v.h + v.e), n: v.h + v.e }))
    .filter(x => x.n >= 8 && x.rate >= 0.04 && x.ch.trim()).sort((a, b) => b.rate - a.rate).slice(0, n);
}

/* ═════════ Розкладка ═════════ */
function renderLayoutSeg() {
  $('layoutSeg').innerHTML = Object.values(LAYOUTS).map(l => `<button data-layout="${l.id}" class="${l.id === lay() ? 'on' : ''}" title="${l.name}">${l.name}</button>`).join('');
}
$('layoutSeg').addEventListener('click', e => {
  const b = e.target.closest('[data-layout]'); if (!b || b.dataset.layout === lay()) return;
  progress.layout = b.dataset.layout; saveProgress(); renderLayoutSeg();
  if (!$('play').hidden && run && !run.custom) showHome(); else renderHome();
});

/* ═════════ Клавіатура на екрані ═════════ */
function buildKb(el, mini) {
  el.innerHTML = ROWS.map(row => `<div class="kb-row">${row.map(([code, f, w]) => {
    const mod = !LAYOUTS[lay()].map[code] || code === 'Space';
    return `<div class="k${mod ? ' mod' : ''}${HOME_KEYS.includes(code) ? ' bump' : ''}" data-code="${code}" style="--w:${w || 1};${mini ? '' : `--fc:var(--f${f})`}">${esc(labelFor(lay(), code))}</div>`;
  }).join('')}</div>`).join('');
}
const keyEl = code => $('kb').querySelector(`[data-code="${code}"]`);

/* ═════════ Головна ═════════ */
function capsFor(l) {
  if (l.kind === 'keys') return [...l.keys].map(c => `<span class="cap">${esc(c.toUpperCase())}</span>`).join('');
  return `<span class="cap word">${{ words: 'слова', caps: 'Аа', punct: ', .', apos: '\'', digits: '123', sentences: 'речення', proverbs: 'прислів’я', text: 'абзац' }[l.kind]}</span>`;
}
function nextToPlay() {
  let i = levels().findIndex((l, k) => unlocked(k) && !best(l.id)?.stars);
  if (i < 0) i = levels().findIndex(l => (best(l.id)?.stars || 0) < 3);
  return i;
}
function renderHome() {
  $('chapters').innerHTML = CHAPTERS.map((ch, ci) => {
    const items = levels().map((l, i) => ({ l, i })).filter(x => x.l.chapter === ch.id);
    const got = items.reduce((s, { l }) => s + (best(l.id)?.stars || 0), 0);
    return `<section class="chapter"><div class="chapter-head"><span class="ch-num">${ci + 1}</span><div class="ch-text"><h2>${ch.name}</h2><span>${ch.desc} Мета для трьох зірок: ${ch.cpm} зн/⁠хв і 97% точності.</span></div><span class="ch-stars">${icon('star')}${got} / ${items.length * 3}</span></div><div class="levels">${items.map(({ l, i }) => {
      const b = best(l.id), open = unlocked(i);
      return `<button class="lvl${b?.stars === 3 ? ' perfect' : ''}${open && !b ? ' fresh' : ''}" data-level="${i}" ${open ? '' : 'disabled title="Спершу пройдіть попередній рівень"'}>
        <div class="lvl-thumb">${open ? capsFor(l) : `<span class="lvl-lock">${icon('lock')}</span>`}</div>
        <span class="lvl-num">${i + 1}</span>
        <div class="lvl-name">${esc(l.name)}</div>
        <div class="lvl-meta">${starsHtml(b?.stars || 0)}<span class="lvl-acc">${b ? b.cpm + ' зн/⁠хв' : ''}</span></div>
      </button>`;
    }).join('')}</div></section>`;
  }).join('');
  const bs = levels().map(l => best(l.id)).filter(Boolean);
  $('total').innerHTML = icon('star') + totalStars() + ' / ' + levels().length * 3;
  $('heroCpm').textContent = bs.length ? Math.max(...bs.map(b => b.cpm)) : '—';
  $('heroAcc').textContent = bs.length ? Math.round(bs.reduce((s, b) => s + b.acc, 0) / bs.length) + '%' : '—';
  const pct = Math.round(passed() / levels().length * 100);
  $('ringPct').textContent = pct + '%';
  $('ringFg').style.strokeDashoffset = String(326.7 * (1 - pct / 100));
  const n = nextToPlay();
  $('continueBtn').hidden = n < 0;
  if (n >= 0) { $('continueBtn').innerHTML = icon('play') + (passed() ? 'Продовжити' : 'Почати') + `: рівень ${n + 1} · ${esc(levels()[n].name)}`; $('continueBtn').dataset.level = n; }
  // слабкі клавіші
  const weak = weakKeys();
  $('weak').hidden = !weak.length;
  if (weak.length) {
    $('weakText').innerHTML = 'Найчастіше помиляєтеся тут: ' + weak.map(w => `<b>${esc(w.ch === '\'' ? 'апостроф' : w.ch.toUpperCase())}</b> (${Math.round(w.rate * 100)}%)`).join(', ') + '. Коротка вправа саме з цими клавішами допоможе.';
    buildKb($('weakKb'), true);
    const all = progress.keys[lay()];
    for (const [ch, v] of Object.entries(all)) {
      const k = keyFor(lay(), ch); if (!k) continue;
      const el = $('weakKb').querySelector(`[data-code="${k.code}"]`); if (!el) continue;
      const rate = v.e / Math.max(1, v.h + v.e);
      if (v.h + v.e >= 5) el.style.background = `color-mix(in srgb, #ef4444 ${Math.min(90, Math.round(rate * 400))}%, var(--key))`;
    }
  }
}
$('chapters').addEventListener('click', e => { const b = e.target.closest('[data-level]'); if (b && !b.disabled) openLevel(+b.dataset.level); });
$('continueBtn').onclick = () => openLevel(+$('continueBtn').dataset.level);
$('homeBtn').onclick = () => showHome();
$('backBtn').onclick = () => showHome();

/* ═════════ Друк ═════════ */
let run = null, tick = 0;
function openLevel(i) {
  if (!levels()[i] || !unlocked(i)) { showHome(); return; }
  const l = levels()[i];
  start({ index: i, level: l, text: makeText(lay(), i, rng(Date.now() ^ (i * 7919))), title: l.name, chapter: CHAPTERS.find(c => c.id === l.chapter).name });
}
function start(opts) {
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  clearInterval(tick);
  run = { ...opts, pos: 0, strokes: 0, errors: 0, t0: 0, fixed: new Set(), errAt: -1, keys: {}, mismatch: 0, done: false };
  $('home').hidden = true; $('play').hidden = false; $('result').hidden = true; $('custom').hidden = true;
  $('lvlChapter').textContent = opts.chapter; $('lvlName').textContent = opts.title;
  $('layoutWarn').hidden = true;
  buildKb($('kb'));
  $('kb').classList.toggle('off', !progress.kb); $('kbToggle').classList.toggle('on', progress.kb);
  $('text').innerHTML = [...run.text].map((c, i) => `<span class="c${c === ' ' ? ' sp' : ''}" data-i="${i}">${esc(c)}</span>`).join('');
  run.spans = [...$('text').children];
  if (opts.index != null && location.hash !== '#' + lay() + '-' + opts.level.id) history.replaceState(null, '', '#' + lay() + '-' + opts.level.id);
  paint(); updateLive();
  $('textBox').focus({ preventScroll: true });
}
// підсвічування поточної літери, наступної клавіші й пальця; прокрутка тексту по рядках
function paint() {
  const { spans, pos } = run;
  spans.forEach((s, i) => { s.className = 'c' + (run.text[i] === ' ' ? ' sp' : '') + (i < pos ? (run.fixed.has(i) ? ' fix' : ' ok') : '') + (i === pos ? ' cur' : '') + (i === pos && run.errAt === pos ? ' err' : ''); });
  const cur = spans[pos];
  if (cur) {
    const lh = cur.offsetHeight || 40, line = Math.round(cur.offsetTop / lh);
    $('text').style.transform = `translateY(${-Math.max(0, line - 1) * lh}px)`;
  }
  $('kb').querySelectorAll('.next, .next-shift').forEach(k => k.classList.remove('next', 'next-shift'));
  const ch = run.text[pos];
  const k = ch != null && keyFor(lay(), ch);
  if (k) {
    keyEl(k.code)?.classList.add('next');
    if (k.shift) keyEl(shiftFor(k.finger))?.classList.add('next-shift');
    const what = ch === ' ' ? 'пробіл' : ch === '\'' ? 'апостроф' : ch;
    $('finger').innerHTML = (run.t0 ? '' : 'Покладіть пальці на основний ряд і почніть друкувати. ') + `Далі <b>${esc(what)}</b> —<i style="background:var(--f${k.finger})"></i>${FINGERS[k.finger]}${k.shift ? `, Shift — ${k.finger <= 3 ? 'правий' : 'лівий'} мізинець` : ''}`;
  } else $('finger').textContent = '';
}
function updateLive() {
  if (!run) return;
  const ms = run.t0 ? (run.done ? run.t1 : performance.now()) - run.t0 : 0;
  const s = summary({ chars: run.pos, strokes: run.strokes, errors: run.errors, ms: Math.max(ms, 1) });
  $('liveCpm').textContent = run.t0 && ms > 1500 ? s.cpm : 0;
  $('liveAcc').textContent = run.strokes ? Math.round(s.acc) : 100;
  const sec = Math.floor(ms / 1000);
  $('liveTime').textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  $('liveBar').style.width = (run.pos / run.text.length * 100) + '%';
}
function flash(code, cls) { const el = keyEl(code); if (!el) return; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), cls === 'bad' ? 260 : 110); }
function stat(ch, ok) { const k = normChar(ch).toLowerCase(); const v = run.keys[k] || (run.keys[k] = { h: 0, e: 0 }); ok ? v.h++ : v.e++; }

document.addEventListener('keydown', e => {
  if (!$('report').hidden || !$('custom').hidden) { if (e.key === 'Escape') { $('report').hidden = true; $('custom').hidden = true; } return; }
  if (!$('result').hidden) {
    if (e.key === 'Escape') $('resRetry').click();
    else if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); (!$('resNext').disabled && !$('resNext').hidden ? $('resNext') : $('resRetry')).click(); }
    return;
  }
  if ($('play').hidden || !run || run.done) return;
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (e.key === 'Escape') { e.preventDefault(); restart(); return; }
  if (e.ctrlKey || e.metaKey || (e.altKey && !e.getModifierState?.('AltGraph'))) return;
  if (e.key.length !== 1) return;
  e.preventDefault();
  const want = run.text[run.pos], got = normChar(e.key);
  // інша розкладка: не рахуємо як помилку, а підказуємо перемкнути
  const L = LAYOUTS[lay()], other = LAYOUTS[lay() === 'uk' ? 'en' : 'uk'];
  if (L.test.test(want) && !L.test.test(got) && other.test.test(got)) {
    if (++run.mismatch >= 1) { $('layoutWarnText').textContent = L.switchHint; $('layoutWarn').hidden = false; }
    return;
  }
  $('layoutWarn').hidden = true;
  if (!run.t0) { run.t0 = performance.now(); tick = setInterval(updateLive, 250); }
  run.strokes++;
  if (got === normChar(want)) {
    stat(want, run.errAt !== run.pos);
    flash(e.code, 'hit');
    run.pos++; run.errAt = -1;
    if (run.pos >= run.text.length) finish();
  } else {
    run.errors++;
    if (run.errAt !== run.pos) stat(want, false);
    run.fixed.add(run.pos); run.errAt = run.pos;
    flash(e.code, 'bad');
  }
  paint(); updateLive();
});
function restart() { if (!run) return; run.custom ? start({ ...run, text: run.text }) : run.weak ? startWeak() : openLevel(run.index); }
$('restartBtn').onclick = () => restart();
$('kbToggle').onclick = () => { progress.kb = !progress.kb; saveProgress(); $('kb').classList.toggle('off', !progress.kb); $('kbToggle').classList.toggle('on', progress.kb); };
$('textBox').addEventListener('click', () => $('textBox').focus());

function finish() {
  run.done = true; run.t1 = performance.now();
  clearInterval(tick); updateLive();
  const s = summary({ chars: run.text.length, strokes: run.strokes, errors: run.errors, ms: run.t1 - run.t0 });
  // накопичуємо статистику клавіш
  const ks = progress.keys[lay()];
  for (const [ch, v] of Object.entries(run.keys)) { const t = ks[ch] || (ks[ch] = { h: 0, e: 0 }); t.h += v.h; t.e += v.e; }
  let stars = null, prev = null;
  if (run.index != null) {
    stars = starsFor(run.level.chapter, s.cpm, s.acc);
    prev = best(run.level.id);
    const better = !prev || stars > prev.stars || (stars === prev.stars && s.cpm * s.acc > prev.cpm * prev.acc);
    if (better) progress.best[lay()][run.level.id] = { cpm: s.cpm, acc: Math.round(s.acc), stars: Math.max(stars, prev?.stars || 0), at: Date.now() };
  }
  saveProgress();
  showResult(s, stars, prev);
}
function showResult(s, stars, prev) {
  const ch = run.index != null ? CHAPTERS.find(c => c.id === run.level.chapter) : null;
  $('resStars').hidden = stars == null;
  if (stars != null) $('resStars').innerHTML = [0, 1, 2].map(i => icon('star', i < stars ? 'on' : '')).join('');
  $('resCpm').textContent = s.cpm; $('resAcc').textContent = Math.round(s.acc);
  let msg = '';
  if (stars == null) msg = 'Чудове тренування!';
  else if (stars === 0) msg = 'Точність нижча за 90% — спробуйте повільніше. Швидкість прийде сама.';
  else if (stars === 3) msg = 'Відмінно! Швидко й точно.';
  else if (s.acc < 97) msg = `Для трьох зірок потрібна точність 97% і швидкість ${ch.cpm} зн/⁠хв. Зосередьтеся на точності.`;
  else msg = `Точність чудова! Для трьох зірок додайте швидкості — до ${ch.cpm} зн/⁠хв.`;
  if (prev && s.cpm > prev.cpm && stars >= prev.stars) msg += ' Новий рекорд швидкості!';
  $('resMsg').textContent = msg;
  const errs = Object.entries(run.keys).filter(([, v]) => v.e).sort((a, b) => b[1].e - a[1].e).slice(0, 5);
  $('resKeys').innerHTML = errs.length ? 'Помилки: ' + errs.map(([c, v]) => `<span class="cap">${esc(c === ' ' ? 'пробіл' : c.toUpperCase())}<small>${v.e}</small></span>`).join('') : 'Жодної помилки!';
  const nx = run.index != null && run.index + 1 < levels().length;
  $('resNext').hidden = run.index == null;
  $('resNext').disabled = !nx || !unlocked(run.index + 1);
  $('resNext').innerHTML = nx ? 'Далі' + icon('arrow') : 'Усі рівні пройдено';
  $('result').hidden = false;
  setTimeout(() => (stars ? $('resNext') : $('resRetry')).focus(), 50);
}
$('resRetry').onclick = () => restart();
$('resNext').onclick = () => openLevel(run.index + 1);
$('resLevels').onclick = () => showHome();

function showHome() {
  clearInterval(tick); run = null;
  $('play').hidden = true; $('result').hidden = true; $('home').hidden = false;
  history.replaceState(null, '', location.pathname);
  renderHome();
}

/* ── свій текст і слабкі клавіші ── */
$('customBtn').onclick = () => { $('custom').hidden = false; setTimeout(() => $('customText').focus(), 30); };
$('custom').addEventListener('click', e => { if (e.target.id === 'custom' || e.target.closest('[data-close]')) $('custom').hidden = true; });
$('customStart').onclick = () => {
  const t = $('customText').value.replace(/[—–]/g, '-').replace(/[“”«»]/g, '"').replace(/\s+/g, ' ').trim();
  if (t.length < 5) { toast('Додайте трохи більше тексту'); return; }
  const bad = [...new Set([...t].filter(c => !keyFor(lay(), normChar(c))))];
  if (bad.length) { toast(`Цих знаків немає на розкладці «${LAYOUTS[lay()].name}»: ${bad.slice(0, 6).join(' ')}`); return; }
  start({ custom: true, text: t, title: 'Свій текст', chapter: 'Вільне тренування' });
};
function startWeak() {
  const w = weakKeys().map(x => x.ch).join('');
  start({ weak: true, text: weakText(lay(), w, rng()), title: 'Слабкі клавіші', chapter: 'Вільне тренування' });
}
$('weakBtn').onclick = () => startWeak();

/* ═════════ Результати для вчителя ═════════ */
$('reportBtn').onclick = () => {
  $('studentName').value = progress.name;
  const sums = Object.keys(LAYOUTS).map(k => {
    const bs = LEVELS[k].map(l => progress.best[k][l.id]).filter(Boolean);
    if (!bs.length) return '';
    return `<b>${LAYOUTS[k].name}:</b> пройдено ${bs.filter(b => b.stars).length} з ${LEVELS[k].length}, найкраща швидкість ${Math.max(...bs.map(b => b.cpm))} зн/⁠хв, середня точність ${Math.round(bs.reduce((s, b) => s + b.acc, 0) / bs.length)}%`;
  }).filter(Boolean);
  $('reportSum').innerHTML = sums.length ? sums.join('<br>') : 'Ще немає пройдених рівнів.';
  $('report').hidden = false;
  setTimeout(() => $('studentName').focus(), 30);
};
$('report').addEventListener('click', e => { if (e.target.id === 'report' || e.target.closest('[data-close]')) $('report').hidden = true; });
$('studentName').addEventListener('input', e => { progress.name = e.target.value; saveProgress(); });
$('resetProgress').onclick = () => {
  if (!confirm('Скинути весь прогрес? Результати рівнів і статистику клавіш буде видалено.')) return;
  progress.best = { uk: {}, en: {} }; progress.keys = { uk: {}, en: {} }; saveProgress(); $('report').hidden = true; renderHome(); toast('Прогрес скинуто');
};
$('downloadReport').onclick = async () => {
  const name = $('studentName').value.trim();
  if (!name) { $('studentName').focus(); toast('Вкажіть ім’я — так учитель знатиме, чиї це результати'); return; }
  const blob = await reportImage(name);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'typing-trainer-' + name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() + '.png';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
};
function starPath(x, cx, cy, r) {
  x.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  x.closePath();
}
// картинка: по розкладках — підсумок і таблиця рівнів (швидкість, точність, зірки), слабкі клавіші
export async function reportImage(name) {
  const W = 1200, PAD = 40, ROW = 34;
  const used = Object.keys(LAYOUTS).filter(k => LEVELS[k].some(l => progress.best[k][l.id]));
  const blocks = used.length ? used : [lay()];
  const H = 170 + blocks.reduce((s, k) => s + 134 + Math.ceil(LEVELS[k].length / 2) * ROW, 0) + 50;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const font = (w, s, mono) => `${w} ${s}px ${mono ? 'JetBrains Mono, monospace' : 'Inter, system-ui, sans-serif'}`;
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#4F6BF4'; x.fillRect(0, 0, W, 8);
  x.fillStyle = '#1a1d23'; x.font = font(800, 30); x.fillText('Сліпий друк — результати', PAD, 62);
  x.font = font(600, 20); x.fillStyle = '#4b5563'; x.fillText(name, PAD, 98);
  x.font = font(500, 15); x.fillStyle = '#9ca3af'; x.fillText(new Date().toLocaleString('uk-UA', { dateStyle: 'long', timeStyle: 'short' }), PAD, 124);
  let y = 170;
  for (const k of blocks) {
    const ls = LEVELS[k], bs = ls.map(l => progress.best[k][l.id]).filter(Boolean);
    x.fillStyle = '#1a1d23'; x.font = font(800, 20); x.fillText('Розкладка: ' + LAYOUTS[k].name, PAD, y);
    const stats = [['Пройдено', `${bs.filter(b => b.stars).length} / ${ls.length}`], ['Найкраща швидкість', bs.length ? Math.max(...bs.map(b => b.cpm)) + ' зн/⁠хв' : '—'], ['Середня точність', bs.length ? Math.round(bs.reduce((s, b) => s + b.acc, 0) / bs.length) + '%' : '—']];
    stats.forEach(([t, v], i) => { const bx = PAD + i * 250; x.fillStyle = '#9ca3af'; x.font = font(600, 13); x.fillText(t, bx, y + 30); x.fillStyle = '#1a1d23'; x.font = font(800, 22); x.fillText(v, bx, y + 58); });
    const weak = weakKeys(k, 8);
    x.fillStyle = '#9ca3af'; x.font = font(600, 13); x.fillText('Слабкі клавіші', PAD + 760, y + 30);
    x.fillStyle = weak.length ? '#ef4444' : '#10b981'; x.font = font(700, 18, true);
    x.fillText(weak.length ? weak.map(w => w.ch === '\'' ? '\'' : w.ch.toUpperCase()).join(' ') : 'немає', PAD + 760, y + 58);
    y += 104;
    const half = Math.ceil(ls.length / 2), colW = (W - PAD * 2) / 2;
    ls.forEach((l, i) => {
      const ox = PAD + Math.floor(i / half) * colW, oy = y + (i % half) * ROW, b = progress.best[k][l.id];
      if (i % half % 2 === 0) { x.fillStyle = '#f7f8fa'; x.fillRect(ox - 8, oy - 22, colW - 20, ROW); }
      x.fillStyle = '#9ca3af'; x.font = font(700, 12, true); x.fillText(String(i + 1).padStart(2, '0'), ox, oy);
      x.fillStyle = '#1a1d23'; x.font = font(600, 15); x.fillText(l.name, ox + 30, oy);
      if (b) {
        for (let s = 0; s < 3; s++) { starPath(x, ox + 330 + s * 18, oy - 5, 7); x.fillStyle = s < b.stars ? '#f5b942' : '#e2e5ea'; x.fill(); }
        x.fillStyle = '#1a1d23'; x.font = font(700, 14, true); x.fillText(`${b.cpm} зн/⁠хв · ${b.acc}%`, ox + 390, oy);
      } else { x.fillStyle = '#b0b6c2'; x.font = font(500, 13); x.fillText('не пройдено', ox + 330, oy); }
    });
    y += half * ROW + 40;
  }
  x.fillStyle = '#9ca3af'; x.font = font(500, 13); x.fillText('Edvault · Сліпий друк', PAD, H - 20);
  return new Promise(r => c.toBlob(r, 'image/png'));
}

/* ═════════ Старт ═════════ */
renderLayoutSeg();
const m = /^#(uk|en)-(.+)$/.exec(location.hash);
if (m) { progress.layout = m[1]; renderLayoutSeg(); }
const fromHash = m ? levels().findIndex(l => l.id === m[2]) : -1;
if (fromHash >= 0 && unlocked(fromHash)) openLevel(fromHash); else showHome();
window.TypingTrainer = { LEVELS, get progress() { return progress; }, get run() { return run; }, openLevel, reportImage, weakKeys };
