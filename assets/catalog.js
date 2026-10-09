// Каталог Edvault: малює сторінку /tools/ або /trainers/ із захардкодженого списку (catalog-data.js).
import { TOOLS, TOOL_CATEGORIES, TRAINERS, TRAINER_CATEGORIES, trainerProgress } from './catalog-data.js';

const I = {
  logo: '<svg viewBox="0 0 32 32" fill="none"><path d="M8 10h16M8 16h10M8 22h13" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  tools: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  trainers: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  all: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  star: '<path fill="currentColor" stroke="none" d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  free: '<path d="M20 6 9 17l-5-5"/>',
  levels: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
};
const svg = (p, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').toLowerCase().replace(/[ʼ’'`]/g, '');
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватний режим */ } },
};
const plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c;
// адреси без .html: /tools/vote, /trainers/robot
export const hrefOf = (kind, item) => `/${kind}/${item.file.replace(/\.html$/, '')}`;

const KINDS = {
  tools: {
    items: TOOLS, cats: TOOL_CATEGORIES, recentKey: 'ev_recent_tools', viewKey: 'ev_tools_view',
    title: 'Інструменти', kicker: 'Для вчителя', h1: 'Усе для уроку — просто в браузері',
    lead: 'Без встановлення програм і реєстрації. Відкрийте й працюйте — усе зберігається на вашому комп’ютері.',
    search: 'Знайти інструмент…', word: ['інструмент', 'інструменти', 'інструментів'],
  },
  trainers: {
    items: TRAINERS, cats: TRAINER_CATEGORIES, recentKey: 'ev_recent_trainers', viewKey: 'ev_trainers_view', warm: true,
    title: 'Тренажери', kicker: 'Для учнів', h1: 'Тренажери з рівнями й зірками',
    lead: 'Від мишки й клавіатури до алгоритмів і дизайну. Прогрес зберігається в браузері, а результати можна надіслати вчителю картинкою.',
    search: 'Знайти тренажер…', word: ['тренажер', 'тренажери', 'тренажерів'],
  },
};

export function mountCatalog(kind) {
  const K = KINDS[kind], other = kind === 'tools' ? 'trainers' : 'tools';
  const state = { filter: 'all', q: '', view: store.get(K.viewKey, 'grid') === 'list' ? 'list' : 'grid' };
  const catOf = id => K.cats.find(c => c.id === id);
  const prog = it => kind === 'trainers' ? trainerProgress(it) : null;

  document.getElementById('app').innerHTML = `
  <header class="topbar">
    <a class="brand" href="/" aria-label="Edvault — на головну"><span class="brand-mark">${I.logo}</span><span class="brand-name">Edvault</span></a>
    <nav class="switch" aria-label="Розділи">
      <a href="/tools/" class="${kind === 'tools' ? 'on' : ''}">${svg(I.tools)}Інструменти<span class="n">${TOOLS.length}</span></a>
      <a href="/trainers/" class="${kind === 'trainers' ? 'on' : ''}">${svg(I.trainers)}Тренажери<span class="n">${TRAINERS.length}</span></a>
    </nav>
    <span class="grow"></span>
    <button class="icon-btn" id="theme" title="Змінити тему"></button>
  </header>
  <main class="page">
    <section class="hero${K.warm ? ' warm' : ''}">
      <div>
        <span class="hero-kicker">${K.kicker}</span>
        <h1>${K.h1}</h1>
        <p>${K.lead}</p>
        <label class="hero-search" role="search">${svg(I.search, '')}<input type="search" id="q" placeholder="${K.search}" autocomplete="off" spellcheck="false" aria-label="${K.search}"><span class="kbd" id="qKbd">/</span></label>
      </div>
      <div class="hero-stats" id="stats"></div>
    </section>
    <section class="recent" id="recent" hidden><div class="label">${svg(I.clock, '')}Нещодавно відкриті</div><div class="recent-row" id="recentRow"></div></section>
    <div class="toolbar">
      <div class="tabs" id="tabs" role="tablist" aria-label="Категорії"></div>
      <div class="seg" role="group" aria-label="Вигляд">
        <button id="vGrid" title="Картки">${svg(I.grid, '')}</button>
        <button id="vList" title="Список">${svg(I.list, '')}</button>
      </div>
    </div>
    <div id="list" aria-live="polite"></div>
    <div class="state" id="empty" hidden>
      <div class="big">${svg(I.search, '')}</div>
      <h3>Нічого не знайдено</h3>
      <p id="emptyMsg"></p>
      <button class="btn-primary" id="emptyReset">Показати всі</button>
    </div>
    ${promoHtml(other)}
    <footer class="foot"><span>© Edvault</span><span>Підказка: <span class="kbd">/</span> — пошук, <span class="kbd">Enter</span> — відкрити перший результат</span></footer>
  </main>`;
  const $ = id => document.getElementById(id);

  // тема
  const syncTheme = () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    $('theme').innerHTML = svg(dark ? I.sun : I.moon);
    $('theme').title = dark ? 'Світла тема' : 'Темна тема';
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = dark ? '#171a22' : '#4F6BF4';
  };
  $('theme').onclick = () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('edvault-theme', next); } catch (e) { /* ignore */ }
    syncTheme();
  };
  syncTheme();

  function hl(text) {
    const t = esc(text), q = state.q;
    if (!q) return t;
    const i = norm(text).indexOf(q);
    if (i < 0 || norm(text).length !== String(text).length) return t;
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  }
  function cardHtml(it, i) {
    const p = prog(it), c = catOf(it.cat);
    const chips = kind === 'trainers' ? [`${it.levels} ${plural(it.levels, 'рівень', 'рівні', 'рівнів')}`, it.grades] : it.tags;
    const foot = p
      ? `<div class="prog"><div class="prog-row"><span class="stars">${svg(I.star)}${p.stars} / ${p.max}</span><span class="grow"></span><span>${p.passed} з ${p.levels} ${plural(p.levels, 'рівня', 'рівнів', 'рівнів')}</span></div><div class="bar"><i style="width:${Math.round(p.passed / p.levels * 100)}%"></i></div></div>
         <div class="card-foot"><span>${p.passed ? (p.passed >= p.levels ? 'Покращити результат' : 'Продовжити') : 'Почати'}</span>${svg(I.arrow)}</div>`
      : `<div class="card-foot"><span>Відкрити</span>${svg(I.arrow)}</div>`;
    return `<a class="card" href="${hrefOf(kind, it)}" data-id="${it.id}" style="--a:${it.accent};animation-delay:${Math.min(i, 12) * 30}ms">
      <div class="card-top"><div class="ic">${svg(it.icon)}</div>${state.filter === 'all' && !state.q ? '' : `<span class="pill">${esc(c.name)}</span>`}</div>
      <div class="card-body"><h3 class="card-name">${hl(it.name)}</h3><p class="card-desc">${hl(it.desc)}</p><div class="chips">${chips.map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div></div>
      ${foot}
    </a>`;
  }
  const visible = () => K.items.filter(it => (state.filter === 'all' || it.cat === state.filter)
    && (!state.q || [it.name, it.desc, catOf(it.cat).name, ...(it.tags || []), it.grades || ''].some(s => norm(s).includes(state.q))));

  function render() {
    $('tabs').innerHTML = [{ id: 'all', name: 'Усі', icon: I.all }, ...K.cats].map(c => {
      const n = c.id === 'all' ? K.items.length : K.items.filter(it => it.cat === c.id).length;
      return `<button class="tab${state.filter === c.id ? ' on' : ''}" role="tab" aria-selected="${state.filter === c.id}" data-f="${c.id}">${svg(c.icon, '')}${esc(c.name)}<span class="n">${n}</span></button>`;
    }).join('');
    const list = visible();
    const grid = items => `<div class="grid${state.view === 'list' ? ' list' : ''}">${items.map(cardHtml).join('')}</div>`;
    if (state.filter === 'all' && !state.q) {
      $('list').innerHTML = K.cats.map(c => {
        const items = list.filter(it => it.cat === c.id);
        return items.length ? `<section class="section" id="cat-${c.id}"><div class="section-head"><span class="section-ic">${svg(c.icon, '')}</span><div><h2>${esc(c.name)}</h2><p>${esc(c.desc)}</p></div><span class="n">${items.length} ${plural(items.length, ...K.word)}</span></div>${grid(items)}</section>` : '';
      }).join('');
    } else $('list').innerHTML = list.length ? grid(list) : '';
    $('empty').hidden = list.length > 0;
    $('emptyMsg').textContent = state.q ? `За запитом «${$('q').value.trim()}» нічого немає. Спробуйте інше слово.` : 'У цій категорії поки порожньо.';
    renderRecent(); renderStats();
  }
  function renderRecent() {
    const ids = store.get(K.recentKey, []);
    const items = ids.map(id => K.items.find(it => it.id === id)).filter(Boolean).slice(0, 4);
    $('recent').hidden = !items.length || state.filter !== 'all' || !!state.q;
    $('recentRow').innerHTML = items.map(it => `<a class="recent-card" href="${hrefOf(kind, it)}" data-id="${it.id}" style="--a:${it.accent}"><span class="ic">${svg(it.icon)}</span><span>${esc(it.name)}</span></a>`).join('');
  }
  function renderStats() {
    const stat = (icon, n, label) => `<div class="stat">${svg(icon)}<b>${n}</b><span>${label}</span></div>`;
    if (kind === 'trainers') {
      const ps = TRAINERS.map(t => trainerProgress(t));
      const stars = ps.reduce((s, p) => s + p.stars, 0), levels = TRAINERS.reduce((s, t) => s + t.levels, 0);
      $('stats').innerHTML = stat(I.levels, levels, 'рівнів у тренажерах') + stat(I.star, stars, `${plural(stars, 'зірка', 'зірки', 'зірок')} здобуто`);
    } else $('stats').innerHTML = stat(I.layers, TOOLS.length, plural(TOOLS.length, ...K.word)) + stat(I.free, '0 ₴', 'без реєстрації');
  }

  $('tabs').addEventListener('click', e => {
    const b = e.target.closest('.tab'); if (!b) return;
    state.filter = b.dataset.f;
    history.replaceState(null, '', state.filter === 'all' ? location.pathname : '#' + state.filter);
    render();
  });
  const q = $('q');
  const onQuery = () => { state.q = norm(q.value.trim()); $('qKbd').hidden = !!q.value; render(); };
  q.addEventListener('input', onQuery);
  q.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (q.value) { q.value = ''; onQuery(); } else q.blur(); }
    if (e.key === 'Enter') { const first = $('list').querySelector('.card'); if (first) { e.preventDefault(); first.click(); } }
  });
  $('emptyReset').onclick = () => { q.value = ''; state.q = ''; state.filter = 'all'; $('qKbd').hidden = false; history.replaceState(null, '', location.pathname); render(); };
  const setView = v => { state.view = v; store.set(K.viewKey, v); $('vGrid').classList.toggle('on', v === 'grid'); $('vList').classList.toggle('on', v === 'list'); document.querySelectorAll('#list .grid').forEach(g => g.classList.toggle('list', v === 'list')); };
  $('vGrid').onclick = () => setView('grid');
  $('vList').onclick = () => setView('list');
  setView(state.view);

  // «Нещодавно відкриті»: будь-який перехід, зокрема середньою кнопкою
  const track = e => {
    const a = e.target.closest('a[data-id]'); if (!a) return;
    store.set(K.recentKey, [a.dataset.id, ...store.get(K.recentKey, []).filter(x => x !== a.dataset.id)].slice(0, 8));
  };
  document.addEventListener('click', track);
  document.addEventListener('auxclick', e => { if (e.button === 1) track(e); });
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === '/' || e.code === 'Slash')) { e.preventDefault(); q.focus(); q.select(); }
  });
  // повернення «Назад» із тренажера — свіжий прогрес і нещодавні
  window.addEventListener('pageshow', e => { if (e.persisted) render(); });

  const h = location.hash.slice(1);
  if (K.cats.some(c => c.id === h)) state.filter = h;
  render();
}

function promoHtml(other) {
  const items = other === 'trainers' ? TRAINERS : TOOLS;
  const pics = items.slice(0, 4).map(it => `<span style="background:${it.accent}">${svg(it.icon, '')}</span>`).join('');
  const text = other === 'trainers'
    ? ['Тренажери для учнів', `${TRAINERS.length} тренажерів із рівнями й зірками: мишка, файли, сліпий друк, алгоритми, перо й колір.`, 'До тренажерів']
    : ['Інструменти для вчителя', `${TOOLS.length} інструментів для уроку: вайтборд, запис екрану, відеоредактор, голосування й інші.`, 'До інструментів'];
  return `<a class="promo" href="/${other}/"><span class="promo-ic">${pics}</span><span><b>${text[0]}</b><small>${text[1]}</small></span><span class="go">${text[2]}${svg(I.arrow, '')}</span></a>`;
}
