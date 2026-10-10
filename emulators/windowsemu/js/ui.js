// Емулятор Windows · вікна, діалоги й контекстні меню.
import { ui } from './icons.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

/* ═════════ Вікна ═════════ */
export const WM = {
  wins: [], z: 20, seq: 0, pid: 1236, subs: new Set(),
  area: () => document.getElementById('desk'),
  emit() { for (const f of this.subs) f(); },
  on(fn) { this.subs.add(fn); },
  active() { return this.wins.filter(w => !w.min).sort((a, b) => b.z - a.z)[0] || null; },
  open(o) {
    const area = this.area(), A = area.getBoundingClientRect();
    const n = this.wins.length;
    const w = Math.min(o.w || 860, A.width - 40), hh = Math.min(o.h || 540, A.height - 40);
    const x = o.x ?? Math.max(10, Math.round((A.width - w) / 2) - 120 + (n % 6) * 34), y = o.y ?? Math.max(10, Math.round((A.height - hh) / 2) - 70 + (n % 6) * 30);
    const win = { id: 'w' + (++this.seq), pid: (this.pid += 4 + (n % 3) * 4), app: o.app, exe: o.exe || o.app + '.exe', title: o.title, icon: o.icon, min: false, max: false, z: 0, minW: o.minW || 360, minH: o.minH || 240, onClose: o.onClose, onKey: o.onKey };
    win.el = h(`<section class="win" data-win="${win.id}" data-app="${o.app}" style="left:${x}px;top:${y}px;width:${w}px;height:${hh}px">
      <header class="win-title"><span class="win-ico">${o.icon}</span><span class="win-name"></span><span class="grow"></span>
        <button class="wb" data-act="min" title="Згорнути">${ui('min', 14)}</button><button class="wb" data-act="max" title="Розгорнути">${ui('max', 13)}</button><button class="wb close" data-act="close" title="Закрити">${ui('close', 15)}</button></header>
      <div class="win-body"></div>${['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(d => `<i class="rz rz-${d}" data-rz="${d}"></i>`).join('')}</section>`);
    win.body = win.el.querySelector('.win-body');
    win.setTitle = t => { win.title = t; win.el.querySelector('.win-name').textContent = t; this.emit(); };
    win.focus = () => this.focus(win);
    win.close = force => this.close(win, force);
    win.setTitle(o.title);
    area.appendChild(win.el);
    this.wins.push(win);
    this.bind(win);
    this.focus(win);
    return win;
  },
  focus(win) {
    if (win.min) { win.min = false; win.el.classList.remove('min'); }
    win.z = ++this.z; win.el.style.zIndex = win.z;
    for (const w of this.wins) w.el.classList.toggle('active', w === win);
    win.onFocus?.();
    this.emit();
  },
  async close(win, force) {
    if (!force && win.onClose && (await win.onClose()) === false) return;
    win.el.classList.add('closing');
    setTimeout(() => win.el.remove(), 120);
    this.wins = this.wins.filter(w => w !== win);
    const next = this.active(); if (next) this.focus(next); else this.emit();
  },
  minimize(win) {
    win.min = true; win.el.classList.add('min'); win.el.classList.remove('active');
    const next = this.active(); if (next) this.focus(next); else this.emit();
  },
  toggleMax(win) {
    win.max = !win.max; win.el.classList.toggle('max', win.max);
    win.el.querySelector('[data-act="max"]').innerHTML = ui(win.max ? 'unmax' : 'max', 13);
    win.el.querySelector('[data-act="max"]').title = win.max ? 'Відновити' : 'Розгорнути';
    win.onResize?.();
  },
  bind(win) {
    const el = win.el;
    el.addEventListener('pointerdown', () => { if (this.active() !== win) this.focus(win); }, true);
    el.querySelector('.win-title').addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'min') this.minimize(win); else if (b.dataset.act === 'max') this.toggleMax(win); else this.close(win);
    });
    el.querySelector('.win-title').addEventListener('dblclick', e => { if (!e.target.closest('.wb')) this.toggleMax(win); });
    // перетягування за заголовок і зміна розміру за краї
    el.addEventListener('pointerdown', e => {
      const title = e.target.closest('.win-title'), rz = e.target.dataset.rz;
      if ((!title || e.target.closest('.wb')) && !rz) return;
      if (e.button !== 0) return;
      const A = this.area().getBoundingClientRect();
      let r = el.getBoundingClientRect();
      if (win.max && title) { // тягнемо розгорнуте вікно — воно відновлюється під курсором
        const ratio = (e.clientX - r.left) / r.width;
        this.toggleMax(win); r = el.getBoundingClientRect();
        el.style.left = (e.clientX - A.left - r.width * ratio) + 'px'; el.style.top = (e.clientY - A.top - 16) + 'px';
        r = el.getBoundingClientRect();
      } else if (win.max) return;
      const s = { x: e.clientX, y: e.clientY, l: r.left - A.left, t: r.top - A.top, w: r.width, h: r.height };
      el.setPointerCapture(e.pointerId); el.classList.add('moving');
      const move = ev => {
        const dx = ev.clientX - s.x, dy = ev.clientY - s.y;
        if (!rz) { el.style.left = Math.min(A.width - 80, Math.max(-s.w + 120, s.l + dx)) + 'px'; el.style.top = Math.min(A.height - 34, Math.max(0, s.t + dy)) + 'px'; return; }
        let { l, t, w, h: hh } = s;
        if (rz.includes('e')) w = Math.max(win.minW, s.w + dx);
        if (rz.includes('s')) hh = Math.max(win.minH, s.h + dy);
        if (rz.includes('w')) { w = Math.max(win.minW, s.w - dx); l = s.l + s.w - w; }
        if (rz.includes('n')) { hh = Math.max(win.minH, s.h - dy); t = Math.max(0, s.t + s.h - hh); }
        Object.assign(el.style, { left: l + 'px', top: t + 'px', width: w + 'px', height: hh + 'px' });
      };
      const up = ev => {
        el.releasePointerCapture(e.pointerId); el.classList.remove('moving');
        el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up);
        if (!rz && ev.clientY - A.top < 4) this.toggleMax(win); // до верхнього краю — розгорнути
        win.onResize?.();
      };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
      e.preventDefault();
    });
  },
};

/* ═════════ Діалоги ═════════ */
// dialog({ title, text, html, icon, buttons: [{ t, v, primary }] }) → Promise зі значенням кнопки
export function dialog(o) {
  return new Promise(res => {
    const icon = o.icon ? `<span class="dlg-ico ${o.icon}">${ui(o.icon === 'error' ? 'close' : o.icon === 'question' ? 'question' : o.icon === 'info' ? 'info' : 'warn', 26)}</span>` : '';
    const btns = (o.buttons || [{ t: 'OK', v: true, primary: true }]);
    const el = h(`<div class="dlg-back"><div class="dlg${o.wide ? ' wide' : ''}" role="dialog"><header class="dlg-title"><span>${esc(o.title || 'Windows')}</span><button class="wb close" data-v="__close" title="Закрити">${ui('close', 15)}</button></header>
      <div class="dlg-body">${icon}<div class="dlg-text">${o.html || `<p>${esc(o.text || '')}</p>`}</div></div>
      <footer class="dlg-foot">${btns.map((b, i) => `<button class="btn${b.primary ? ' primary' : ''}" data-i="${i}">${esc(b.t)}</button>`).join('')}</footer></div></div>`);
    document.body.appendChild(el);
    const done = v => { el.remove(); document.removeEventListener('keydown', key, true); res(v); };
    const cancel = () => done(btns.find(b => b.cancel)?.v ?? (btns.length === 1 ? btns[0].v : null));
    el.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) done(o.collect ? o.collect(el, btns[+b.dataset.i].v) : btns[+b.dataset.i].v); else if (e.target.closest('[data-v="__close"]')) cancel(); });
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); cancel(); } else if (e.key === 'Enter' && !e.target.closest('textarea')) { e.preventDefault(); e.stopPropagation(); const p = btns.findIndex(b => b.primary); if (p >= 0) el.querySelector(`[data-i="${p}"]`).click(); } };
    document.addEventListener('keydown', key, true);
    o.onOpen?.(el);
    setTimeout(() => (el.querySelector('[autofocus]') || el.querySelector('.btn.primary'))?.focus(), 20);
  });
}
export const alertBox = (text, title = 'Windows', icon = 'warn') => dialog({ title, text, icon, buttons: [{ t: 'OK', v: true, primary: true }] });

/* ═════════ Контекстне меню ═════════ */
let openMenu = null;
export function closeMenu() { openMenu?.remove(); openMenu = null; }
// items: [{ t, icon, kbd, disabled, on, sub: [...] , check }] або '-'
export function menu(x, y, items, { anchor } = {}) {
  closeMenu();
  const build = list => `<div class="cm">${list.filter(Boolean).map((it, i) => it === '-' ? '<i class="cm-sep"></i>' :
    `<div class="cm-it${it.disabled ? ' off' : ''}${it.sub ? ' has-sub' : ''}" role="menuitem" data-i="${i}"><span class="cm-ic">${it.check != null ? (it.check ? ui('check', 15) : '') : it.icon ? (it.icon.startsWith('<') ? it.icon : ui(it.icon, 16)) : ''}</span><span class="cm-t">${esc(it.t)}</span>${it.kbd ? `<span class="cm-k">${esc(it.kbd)}</span>` : ''}${it.sub ? ui('chevron', 14) : ''}${it.sub ? build(it.sub) : ''}</div>`).join('')}</div>`;
  const el = h(`<div class="cm-root">${build(items)}</div>`);
  document.body.appendChild(el); openMenu = el;
  const m = el.firstElementChild, r = m.getBoundingClientRect();
  if (anchor) { const a = anchor.getBoundingClientRect(); x = a.left; y = a.bottom + 4; }
  el.style.left = Math.min(x, innerWidth - r.width - 6) + 'px';
  el.style.top = (y + r.height > innerHeight - 50 ? Math.max(6, y - r.height) : y) + 'px';
  const find = btn => { const path = []; let b = btn; while (b && b.classList?.contains('cm-it')) { path.unshift(+b.dataset.i); b = b.parentElement.closest('.cm-it'); } let list = items.filter(Boolean), it; for (const i of path) { it = list[i]; list = it.sub || []; } return it; };
  el.addEventListener('click', e => {
    const b = e.target.closest('.cm-it'); if (!b || b.classList.contains('off')) return;
    const it = find(b); if (!it || it.sub) return;
    closeMenu(); it.on?.();
  });
  el.addEventListener('contextmenu', e => e.preventDefault());
  // підменю — праворуч або ліворуч, якщо не влазить
  el.addEventListener('pointerover', e => { const b = e.target.closest('.has-sub'); if (!b) return; const sub = b.querySelector(':scope > .cm'); const R = b.getBoundingClientRect(); sub.classList.toggle('left', R.right + 220 > innerWidth); sub.classList.toggle('upward', R.top + sub.offsetHeight > innerHeight - 50); });
  return el;
}
document.addEventListener('pointerdown', e => { if (openMenu && !e.target.closest('.cm-root')) closeMenu(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && openMenu) { closeMenu(); e.stopPropagation(); } }, true);
window.addEventListener('blur', closeMenu);

/* ═════════ Модальне вікно з вкладками (властивості, майстри) ═════════ */
// modal({ title, html, cls, buttons: [{ t, v, primary, cancel }], onButton(v, api) → false щоб не закривати, onOpen(api) })
export function modal(o) {
  const el = h(`<div class="dlg-back"><div class="dlg mdl ${o.cls || ''}" role="dialog"><header class="dlg-title"><span>${esc(o.title)}</span><button class="wb close" data-close title="Закрити">${ui('close', 15)}</button></header>
    <div class="mdl-body">${o.html}</div>${o.buttons ? `<footer class="dlg-foot">${o.buttons.map((b, i) => `<button class="btn${b.primary ? ' primary' : ''}" data-b="${i}">${esc(b.t)}</button>`).join('')}</footer>` : ''}</div></div>`);
  document.body.appendChild(el);
  const api = {
    el, $: s => el.querySelector(s), $$: s => [...el.querySelectorAll(s)],
    close: v => { el.remove(); document.removeEventListener('keydown', key, true); o.onClose?.(v); },
    button: i => el.querySelector(`[data-b="${i}"]`),
  };
  const press = async i => { const b = o.buttons[i]; if (api.button(i)?.disabled) return; const r = await o.onButton?.(b.v, api); if (r !== false) api.close(b.v); };
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-b]'); if (b) return press(+b.dataset.b);
    if (e.target.closest('[data-close]')) { const c = o.buttons?.findIndex(x => x.cancel); return c >= 0 ? press(c) : api.close(null); }
    const tab = e.target.closest('[data-tab]');
    if (tab) { api.$$('[data-tab]').forEach(t => t.classList.toggle('on', t === tab)); api.$$('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== tab.dataset.tab; }); }
  });
  const key = e => {
    if (!el.isConnected || document.querySelector('.dlg-back:last-of-type') !== el) return;
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); const c = o.buttons?.findIndex(x => x.cancel); c >= 0 ? press(c) : api.close(null); }
    else if (e.key === 'Enter' && !e.target.closest('textarea, select, button') && o.buttons) { const p = o.buttons.findIndex(x => x.primary); if (p >= 0) { e.preventDefault(); e.stopPropagation(); press(p); } }
  };
  document.addEventListener('keydown', key, true);
  o.onOpen?.(api);
  return api;
}
// вкладки: tabs([['general', 'Загальні', html], …])
export const tabs = list => `<div class="tabs">${list.map(([k, t], i) => `<button class="tab${i ? '' : ' on'}" data-tab="${k}">${esc(t)}</button>`).join('')}</div><div class="tab-panes">${list.map(([k, , html], i) => `<div class="pane" data-pane="${k}" ${i ? 'hidden' : ''}>${html}</div>`).join('')}</div>`;
