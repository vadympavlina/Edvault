// Симулятор міста · помічники інтерфейсу: значки, вікна, сповіщення, обличчя жителів.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
export const nl2br = s => esc(s).replace(/\n/g, '<br>');

const P = {
  road: '<path d="M8 3 5 21M16 3l3 18M12 4v3M12 10v4M12 17v3"/>',
  zone: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 19.5V4.5M20 19v3H6.5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  bus: '<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M8 18v3M16 18v3"/><circle cx="8" cy="14.5" r="1"/><circle cx="16" cy="14.5" r="1"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-6 5-10 16-10 0 11-4 17-9 17z"/><path d="M4 21c4-4 7-7 10-10"/>',
  hand: '<path d="M9 11V5a2 2 0 1 1 4 0v6M13 10V4a2 2 0 1 1 4 0v7M9 10.5V8a2 2 0 1 0-4 0v6a8 8 0 0 0 14 4l2-5a2 2 0 0 0-3.5-1.8L16 13"/>',
  pointer: '<path d="m4 3 7 18 2.5-7.5L21 11z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>',
  tree: '<path d="M12 22v-6M12 2 6 10h3l-4 6h14l-4-6h3z"/>',
  play: '<path d="M7 4v16l13-8z"/>', pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>', fast: '<path d="M3 5v14l8-7zM12 5v14l8-7z"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/>',
  coins: '<circle cx="8" cy="8" r="5"/><path d="M18.1 10.4A5 5 0 1 1 11.6 17"/><path d="M8 6v4M7 7h2"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 3.1a4 4 0 0 1 0 7.8M22 21a7 7 0 0 0-5-6.7"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  flag: '<path d="M5 22V3M5 4h12l-2 4 2 4H5"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M8.2 13 7 22l5-3 5 3-1.2-9"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7zM2 12l10 5 10-5M2 17l10 5 10-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  lab: '<path d="M9 3h6M10 3v6L4 19a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7 15h10"/>',
  scroll: '<path d="M8 3h11a2 2 0 0 1 2 2v2h-4M8 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h10a2 2 0 0 0 2-2V7"/><path d="M9 9h7M9 13h7M9 17h4"/>',
  save: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  open: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>', check: '<path d="m5 12 5 5 9-10"/>', alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  home: '<path d="m3 11 9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  factory: '<path d="M3 21V10l6 4V10l6 4V5h6v16z"/><path d="M7 17h2M12 17h2M17 17h2"/>',
  shop: '<path d="M3 9 4.5 4h15L21 9M3 9v11h18V9M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M10 20v-5h4v5"/>',
  heart: '<path d="M12 21s-8-5-8-11a5 5 0 0 1 8-4 5 5 0 0 1 8 4c0 6-8 11-8 11z"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9.5h.01M15 9.5h.01"/>',
  frown: '<circle cx="12" cy="12" r="9"/><path d="M16 16s-1.5-2-4-2-4 2-4 2M9 9.5h.01M15 9.5h.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  printer: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/>',
  bank: '<path d="m3 9 9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18"/>',
  co2: '<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 1 0 6 16.5"/><path d="M6 19h12"/>',
};
export const icon = (n, s = 18, cls = '') => `<svg class="ic ${cls}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || P.info}</svg>`;

/* ── вікно ── */
export function modal({ title, html, cls = '', onOpen, onClose, wide = false }) {
  const el = h(`<div class="md-back"><section class="md ${wide ? 'wide' : ''} ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title || '')}">
    ${title ? `<header class="md-h"><h2>${esc(title)}</h2><button class="ib" data-md-close aria-label="Закрити">${icon('x', 20)}</button></header>` : ''}<div class="md-b">${html}</div></section></div>`);
  document.body.appendChild(el);
  const api = { el, $: s => el.querySelector(s), close() { if (!el.isConnected) return; el.remove(); document.removeEventListener('keydown', key); onClose?.(); }, set(x) { el.querySelector('.md-b').innerHTML = x; } };
  const key = e => { if (e.key === 'Escape') api.close(); };
  document.addEventListener('keydown', key);
  el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-md-close]')) api.close(); });
  onOpen?.(api);
  setTimeout(() => el.querySelector('[autofocus], .md button.primary')?.focus(), 30);
  return api;
}
export function confirmBox(text, ok = 'Так', { danger = false, sub = '' } = {}) {
  return new Promise(res => {
    let done = false;
    modal({ title: text, cls: 'confirm', html: `${sub ? `<p class="muted">${esc(sub)}</p>` : ''}<div class="row end gap"><button class="btn" data-v="0">Скасувати</button><button class="btn ${danger ? 'danger' : 'primary'}" data-v="1">${esc(ok)}</button></div>`,
      onClose: () => { if (!done) res(false); }, onOpen: api => api.el.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { done = true; res(b.dataset.v === '1'); api.close(); } }) });
  });
}
let toastT = 0;
export function toast(text, kind = '') {
  let el = $('#toast'); if (!el) { el = h('<div id="toast" class="toast" role="status" aria-live="polite"></div>'); document.body.appendChild(el); }
  el.className = `toast on ${kind}`; el.innerHTML = `${icon(kind === 'bad' ? 'alert' : kind === 'good' ? 'check' : 'info', 18)}<span>${esc(text)}</span>`;
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 3200);
}

/* ── обличчя жителя (як у Sims: зачіска, колір шкіри, настрій) ── */
const SKIN = ['#f6d3b3', '#eec19a', '#d9a27a', '#b97f5a', '#8d5a3b', '#f2c6a8'];
const HAIR = ['#2b1d14', '#5a3a22', '#8a5a2b', '#c58b3c', '#e3c27a', '#1c1c1c', '#a33b1f', '#9ca3af'];
export function face(seed, { fem = false, age = 30, mood = 60, size = 40 } = {}) {
  const r = k => ((Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
  const skin = SKIN[Math.floor(r(1) * SKIN.length)], hair = age >= 65 ? '#d1d5db' : HAIR[Math.floor(r(2) * HAIR.length)], bg = `hsl(${Math.floor(r(3) * 360)} 70% 88%)`;
  const kid = age < 14, smile = mood >= 60 ? 'M14 25 Q20 30 26 25' : mood >= 40 ? 'M15 26 L25 26' : 'M14 28 Q20 23 26 28';
  const hairPath = fem ? (r(4) < 0.5 ? `<path d="M8 21c-1-9 4-14 12-14s13 5 12 14c-1 6 1 10 1 10H30c1-4 1-8 0-11-3 1-7 0-10-3-2 3-6 4-9 3-1 3-1 7 0 11H7s2-4 1-10z" fill="${hair}"/>` : `<path d="M9 19c0-8 5-12 11-12s11 4 11 12c-3-2-7-3-11-6-3 3-8 5-11 6z" fill="${hair}"/><circle cx="31" cy="11" r="4" fill="${hair}"/>`)
    : (r(4) < 0.5 ? `<path d="M9 18c0-7 5-11 11-11s11 4 11 11c-2-3-6-5-11-5s-9 2-11 5z" fill="${hair}"/>` : `<path d="M9 19c-1-8 5-12 11-12 7 0 12 5 11 12-1-2-3-5-6-5-4 0-8 2-16 5z" fill="${hair}"/>`);
  return `<svg class="face" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="${bg}"/>
    <rect x="15" y="29" width="10" height="7" rx="2" fill="${skin}"/><path d="M7 40c1-6 6-9 13-9s12 3 13 9z" fill="hsl(${Math.floor(r(5) * 360)} 55% 55%)"/>
    <ellipse cx="20" cy="${kid ? 21 : 20}" rx="${kid ? 10 : 10.5}" ry="${kid ? 10 : 11.5}" fill="${skin}"/>${hairPath}
    <circle cx="16" cy="20" r="1.4" fill="#222"/><circle cx="24" cy="20" r="1.4" fill="#222"/>
    ${age >= 50 && !fem && r(6) < 0.5 ? `<path d="M14 27c2 3 10 3 12 0" stroke="${hair}" stroke-width="2.4" fill="none"/>` : ''}
    <path d="${smile}" stroke="#7a3b2e" stroke-width="1.6" fill="none" stroke-linecap="round"/>${age >= 60 ? '<path d="M12 18h6M22 18h6" stroke="#333" stroke-width="0.8"/><circle cx="16" cy="19.5" r="3" fill="none" stroke="#333" stroke-width="0.8"/><circle cx="24" cy="19.5" r="3" fill="none" stroke="#333" stroke-width="0.8"/>' : ''}</svg>`;
}
