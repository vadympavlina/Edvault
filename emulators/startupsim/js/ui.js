// Симулятор стартапу · помічники інтерфейсу: розмітка, вікна, сповіщення, графіки, терміни.
import { icon } from './icons.js';
import { GLOSSARY } from './data.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
export const nl2br = s => esc(s).replace(/\n/g, '<br>');

// Термін із поясненням: підкреслений, по кліку — підказка
export const term = (k, label = k) => GLOSSARY[k] ? `<button class="term" data-term="${esc(k)}" type="button">${esc(label)}</button>` : esc(label);

/* ── вікно ── */
export function modal({ title, html, cls = '', onOpen, onClose, wide = false }) {
  const el = h(`<div class="md-back"><section class="md ${wide ? 'wide' : ''} ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title || '')}">
    ${title ? `<header class="md-h"><h2>${esc(title)}</h2><button class="ib" data-md-close aria-label="Закрити">${icon('x', 20)}</button></header>` : ''}
    <div class="md-b">${html}</div></section></div>`);
  document.body.appendChild(el);
  const api = {
    el, $: s => el.querySelector(s),
    close() { if (!el.isConnected) return; el.classList.add('out'); setTimeout(() => el.remove(), 160); onClose?.(); document.removeEventListener('keydown', key); },
    set(html2) { el.querySelector('.md-b').innerHTML = html2; },
  };
  const key = e => { if (e.key === 'Escape') api.close(); };
  document.addEventListener('keydown', key);
  el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-md-close]')) api.close(); });
  onOpen?.(api);
  setTimeout(() => el.querySelector('[autofocus], .md button.primary, .md-b button, .md-b input')?.focus(), 30);
  return api;
}
export function confirmBox(text, ok = 'Так', { danger = false, sub = '' } = {}) {
  return new Promise(res => {
    let done = false;
    const m = modal({ title: text, cls: 'confirm', html: `${sub ? `<p class="muted">${esc(sub)}</p>` : ''}<div class="row end gap"><button class="btn" data-v="0">Скасувати</button><button class="btn ${danger ? 'danger' : 'primary'}" data-v="1">${esc(ok)}</button></div>`,
      onClose: () => { if (!done) res(false); },
      onOpen: api => api.el.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { done = true; res(b.dataset.v === '1'); api.close(); } }) });
    return m;
  });
}

/* ── сповіщення ── */
let toastT = 0;
export function toast(text, kind = '') {
  let el = $('#toast');
  if (!el) { el = h('<div id="toast" class="toast" role="status" aria-live="polite"></div>'); document.body.appendChild(el); }
  el.className = `toast on ${kind}`; el.innerHTML = `${kind === 'bad' ? icon('alert', 18) : kind === 'good' ? icon('check', 18) : icon('info', 18)}<span>${esc(text)}</span>`;
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 3400);
}

/* ── підказка до терміна ── */
export function termPop(btn) {
  $('.term-pop')?.remove();
  const k = btn.dataset.term, el = h(`<div class="term-pop" role="tooltip"><b>${esc(k)}</b><p>${esc(GLOSSARY[k])}</p></div>`);
  document.body.appendChild(el);
  const r = btn.getBoundingClientRect(), w = Math.min(320, innerWidth - 24);
  el.style.width = w + 'px';
  el.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2)) + 'px';
  const top = r.bottom + 8, hh = el.offsetHeight;
  el.style.top = (top + hh > innerHeight - 8 ? r.top - hh - 8 : top) + scrollY + 'px';
  const off = e => { if (!el.contains(e.target) && e.target !== btn) { el.remove(); document.removeEventListener('pointerdown', off, true); } };
  setTimeout(() => document.addEventListener('pointerdown', off, true), 0);
}

/* ── графіки (SVG) ── */
const niceMax = v => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
// Лінійний графік: series = [{ v: [...], color, label, area }]
export function lineChart(series, { h: H = 160, fmt = x => Math.round(x), labels = [], zero = true, id = '' } = {}) {
  const W = 600, pl = 46, pr = 10, pt = 12, pb = 22, n = Math.max(2, ...series.map(s => s.v.length));
  const all = series.flatMap(s => s.v).filter(Number.isFinite);
  if (!all.length) return `<div class="chart-empty">Дані з'являться після першого тижня</div>`;
  let lo = zero ? Math.min(0, ...all) : Math.min(...all), hi = Math.max(...all, lo + 1);
  hi = niceMax(hi); if (lo < 0) lo = -niceMax(-lo);
  const x = i => pl + (W - pl - pr) * (n === 1 ? 0 : i / (n - 1)), y = v => pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo));
  const grid = [0, .25, .5, .75, 1].map(f => { const v = lo + (hi - lo) * f; return `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" class="g${v === 0 ? ' z' : ''}"/><text x="${pl - 6}" y="${y(v) + 4}" class="ax" text-anchor="end">${esc(fmt(v))}</text>`; }).join('');
  const xl = labels.length ? labels.map((t, i) => (i % Math.ceil(labels.length / 8) === 0 || i === labels.length - 1) ? `<text x="${x(i)}" y="${H - 5}" class="ax" text-anchor="middle">${esc(t)}</text>` : '').join('') : '';
  const lines = series.map(s => {
    const pts = s.v.map((v, i) => [x(i), y(Number.isFinite(v) ? v : 0)]);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
    const area = s.area ? `<path d="${d}L${pts.at(-1)[0]},${y(Math.max(lo, 0))}L${pts[0][0]},${y(Math.max(lo, 0))}Z" fill="${s.color}" opacity=".12"/>` : '';
    return `${area}<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? 'stroke-dasharray="5 5"' : ''}/>${pts.length ? `<circle cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="3.5" fill="${s.color}"/>` : ''}`;
  }).join('');
  const legend = series.length > 1 ? `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join('')}</div>` : '';
  return `<div class="chart" ${id ? `id="${id}"` : ''}><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(series.map(s => s.label).join(', '))}">${grid}${lines}${xl}</svg>${legend}</div>`;
}
// Стовпчики: [{ label, v, color }]
export function bars(items, { fmt = x => x, max } = {}) {
  const m = max || Math.max(1, ...items.map(i => Math.abs(i.v)));
  return `<div class="bars">${items.map(i => `<div class="bar-row"><span class="bl">${esc(i.label)}</span><div class="bt"><i style="width:${Math.max(i.v ? 1.5 : 0, Math.abs(i.v) / m * 100)}%;background:${i.color || 'var(--acc)'}"></i></div><b>${esc(fmt(i.v))}</b></div>`).join('')}</div>`;
}
// Кільце (частки)
export function donut(items, { size = 150, hole = .62 } = {}) {
  const t = items.reduce((a, i) => a + i.v, 0) || 1, R = size / 2, r = R * hole;
  let a0 = -Math.PI / 2;
  const seg = items.map(i => {
    const a1 = a0 + i.v / t * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a, rr) => `${(R + Math.cos(a) * rr).toFixed(2)},${(R + Math.sin(a) * rr).toFixed(2)}`;
    const d = i.v / t > .9999 ? `M${p(0, R)}A${R},${R} 0 1 1 ${p(Math.PI, R)}A${R},${R} 0 1 1 ${p(0, R)}M${p(0, r)}A${r},${r} 0 1 0 ${p(Math.PI, r)}A${r},${r} 0 1 0 ${p(0, r)}Z` : `M${p(a0, R)}A${R},${R} 0 ${big} 1 ${p(a1, R)}L${p(a1, r)}A${r},${r} 0 ${big} 0 ${p(a0, r)}Z`;
    a0 = a1; return `<path d="${d}" fill="${i.color}" fill-rule="evenodd"/>`;
  }).join('');
  return `<svg class="donut" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Частки">${seg}</svg>`;
}
// Шкала 0..1
export const meter = (v, { color = 'var(--acc)', label = '' } = {}) => `<div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(v * 100)}" aria-label="${esc(label)}"><i style="width:${Math.max(0, Math.min(1, v)) * 100}%;background:${color}"></i></div>`;
export const delta = (v, fmt, good = 1) => { if (!v) return ''; const up = v > 0; return `<span class="dl ${up === (good > 0) ? 'up' : 'down'}">${icon(up ? 'arrowUp' : 'arrowDown', 12)}${esc(fmt(Math.abs(v)))}</span>`; };

// Логотип компанії
export function logo(company, size = 36, symIcon) {
  return `<span class="logo" style="--lc:${company.color};width:${size}px;height:${size}px">${icon(symIcon || company.sym || 'spark', Math.round(size * .56))}</span>`;
}
