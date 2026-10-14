// Аніматор · дрібниці інтерфейсу: значки, повідомлення, вікна, підказки.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const I = {
  logo: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 9h2M2 15h2M20 9h2M20 15h2M7 5v14M17 5v14"/><path d="m10 10 4 2-4 2z" fill="currentColor"/>',
  brush: '<path d="M9.06 11.9 17 4a2.12 2.12 0 0 1 3 3l-7.9 7.94"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>',
  eraser: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
  fill: '<path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>',
  line: '<path d="M5 19 19 5"/>',
  rect: '<rect x="3" y="5" width="18" height="14" rx="1.5"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="9.5" ry="7"/>',
  select: '<path d="M5 3a2 2 0 0 0-2 2M19 3a2 2 0 0 1 2 2M21 19a2 2 0 0 1-2 2M5 21a2 2 0 0 1-2-2M9 3h1M9 21h1M14 3h1M14 21h1M3 9v1M21 9v1M3 14v1M21 14v1"/>',
  picker: '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  play: '<path d="M7 4v16l13-8z" fill="currentColor"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>',
  prev: '<path d="m15 18-6-6 6-6"/>', next: '<path d="m9 18 6-6-6-6"/>',
  first: '<path d="m17 18-6-6 6-6M7 6v12"/>', last: '<path d="m7 18 6-6-6-6M17 6v12"/>',
  loop: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.9 4.2A10 10 0 0 1 12 4c6.4 0 10 8 10 8a18 18 0 0 1-2.2 3.2M6.6 6.6A18 18 0 0 0 2 12s3.6 8 10 8a9.7 9.7 0 0 0 5.4-1.6"/><path d="m2 2 20 20"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  up: '<path d="m18 15-6-6-6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  onion: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  open: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  lesson: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>', check: '<path d="M20 6 9 17l-5-5"/>',
  flip: '<path d="M12 3v18M16 7l4 5-4 5zM8 7l-4 5 4 5z"/>',
  sym: '<path d="M12 2v20"/><path d="M8 7c-3 0-5 2-5 5s2 5 5 5M16 7c3 0 5 2 5 5s-2 5-5 5"/>',
  fit: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  dup: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>',
  film: '<rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/>',
  gif: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M9 10H7.5A1.5 1.5 0 0 0 6 11.5v1A1.5 1.5 0 0 0 7.5 14H9v-2M12 10v4M15 14v-4h3M15 12h2"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};
export const icon = (n, s = 18) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;
export function fillIcons(root = document) { $$('[data-icon]', root).forEach(el => { if (el.dataset.done) return; el.dataset.done = 1; el.innerHTML = icon(el.dataset.icon, +el.dataset.size || 18); }); }

let toastT = 0;
export function toast(msg, kind = '', opts = {}) {
  const t = $('#toast');
  t.className = 'toast on ' + kind;
  t.innerHTML = `<span>${esc(msg)}</span>${opts.action ? `<button class="t-act">${esc(opts.action)}</button>` : ''}`;
  if (opts.action) t.querySelector('.t-act').onclick = () => { t.classList.remove('on'); opts.onAction(); };
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), opts.ms || 3000);
}

// Вікно: html, кнопки закриття data-close; повертає { el, close }
export function modal({ title, html, cls = '', onOpen, onClose, wide = false }) {
  const wrap = document.createElement('div');
  wrap.className = 'md-wrap';
  wrap.innerHTML = `<div class="md ${cls} ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><button class="ib" data-close aria-label="Закрити">${icon('close')}</button></header><div class="md-body">${html}</div></div>`;
  document.body.appendChild(wrap);
  const api = {
    el: wrap.querySelector('.md'),
    close() { wrap.remove(); document.removeEventListener('keydown', key, true); onClose && onClose(); },
  };
  const key = e => { if (e.key === 'Escape') { e.stopPropagation(); api.close(); } };
  document.addEventListener('keydown', key, true);
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) api.close(); });
  wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) api.close(); });
  onOpen && onOpen(api);
  setTimeout(() => { const f = wrap.querySelector('[autofocus], input, .primary'); f && f.focus(); }, 30);
  return api;
}
export function confirmBox(title, sub, ok = 'Так', danger = false) {
  return new Promise(res => {
    let done = false;
    modal({ title, cls: 'confirm', html: `${sub ? `<p class="muted">${esc(sub)}</p>` : ''}<div class="row end"><button class="btn" data-v="0">Скасувати</button><button class="btn ${danger ? 'danger' : 'primary'}" data-v="1">${esc(ok)}</button></div>`,
      onClose: () => { if (!done) res(false); },
      onOpen: api => api.el.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { done = true; res(b.dataset.v === '1'); api.close(); } }) });
  });
}

// Підказки при наведенні (data-tip, data-kbd)
export function tips() {
  const tip = $('#tip'); let t = null, timer = 0;
  document.addEventListener('mouseover', e => {
    if (matchMedia('(pointer: coarse)').matches) return;
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (el === t) return;
    clearTimeout(timer); tip.classList.remove('on'); t = el;
    if (!el) return;
    timer = setTimeout(() => {
      tip.innerHTML = esc(el.dataset.tip) + (el.dataset.kbd ? `<span class="k">${esc(el.dataset.kbd)}</span>` : '');
      tip.classList.add('on');
      const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
      let x = r.left + r.width / 2 - w / 2, y = r.bottom + 8;
      if (el.closest('.rail') && innerWidth > 820) { x = r.right + 10; y = r.top + r.height / 2 - h / 2; }
      if (y + h > innerHeight - 6) y = r.top - h - 8;
      tip.style.left = Math.max(6, Math.min(innerWidth - w - 6, x)) + 'px'; tip.style.top = y + 'px';
    }, 380);
  });
  document.addEventListener('mousedown', () => { clearTimeout(timer); tip.classList.remove('on'); t = null; }, true);
}
