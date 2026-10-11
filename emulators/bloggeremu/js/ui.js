// Симулятор блогера · дрібні помічники інтерфейсу: розмітка, нижні панелі, меню дій, підтвердження.
import { icon } from './icons.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
// Текст із хештегами й згадками: #тег і @нік підсвічуються
// active=false — лише підсвітити (усередині кнопок, де окреме натискання заважало б)
export const rich = (s, active = true) => esc(s).replace(/(^|\s)([#@][\p{L}\p{N}_.]*[\p{L}\p{N}_])/gu, active ? '$1<span class="tag" role="button" tabindex="0" data-act="lk.tag" data-t="$2">$2</span>' : '$1<span class="tag">$2</span>').replace(/\n/g, '<br>');

let host = null;
export const setHost = el => { host = el; };

// Нижня панель («шторка»): { title, html, onOpen(api), cls }
export function sheet(o) {
  const el = h(`<div class="sh-back"><section class="sheet ${o.cls || ''}" role="dialog" aria-modal="true" aria-label="${esc(o.title || '')}">
    <i class="sh-grab" aria-hidden="true"></i>${o.title ? `<header class="sh-head"><b>${esc(o.title)}</b><button class="ib" data-sh-close title="Закрити">${icon('close', 20)}</button></header>` : ''}
    <div class="sh-body">${o.html}</div></section></div>`);
  host.appendChild(el);
  const api = {
    el, $: s => el.querySelector(s), $$: s => [...el.querySelectorAll(s)],
    close() { if (!el.isConnected) return; el.classList.add('out'); setTimeout(() => el.remove(), 160); o.onClose?.(); },
    set(html) { el.querySelector('.sh-body').innerHTML = html; },
  };
  el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-sh-close]')) api.close(); });
  o.onOpen?.(api);
  return api;
}
// Меню дій: [{ t, icon, on, danger }]
export function actions(list, title = '') {
  const items = list.filter(Boolean);
  return sheet({ title, cls: 'acts', html: `<div class="act-list">${items.map((a, i) => `<button class="act${a.danger ? ' danger' : ''}" data-a="${i}">${a.icon ? icon(a.icon, 20) : ''}<span>${esc(a.t)}</span></button>`).join('')}</div>`,
    onOpen: api => api.el.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) { api.close(); items[+b.dataset.a].on(); } }) });
}
// Підтвердження: повертає Promise<boolean>
export function confirm(text, ok = 'Так', danger = false, sub = '') {
  return new Promise(res => {
    const el = h(`<div class="cf-back"><div class="cf" role="alertdialog" aria-modal="true"><p class="cf-t">${esc(text)}</p>${sub ? `<p class="cf-s">${esc(sub)}</p>` : ''}<div class="cf-b"><button data-v="1" class="${danger ? 'danger' : 'primary'}">${esc(ok)}</button><button data-v="0">Скасувати</button></div></div></div>`);
    host.appendChild(el);
    el.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b || e.target === el) { el.remove(); res(b?.dataset.v === '1'); } });
    el.querySelector('[data-v="1"]').focus();
  });
}
// Банер сповіщення зверху екрана телефону
let bannerT = 0;
export function banner(html, on) {
  host.querySelector('.banner')?.remove();
  const el = h(`<button class="banner">${html}</button>`);
  host.appendChild(el);
  el.addEventListener('click', () => { el.remove(); on?.(); });
  const away = e => { if (!el.contains(e.target)) { el.remove(); host.removeEventListener('pointerdown', away, true); } };
  host.addEventListener('pointerdown', away, true);
  clearTimeout(bannerT); bannerT = setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); host.removeEventListener('pointerdown', away, true); }, 3200);
}
// Коротке повідомлення внизу
let toastT = 0;
export function toast(text) {
  let el = host.querySelector('.toast'); if (!el) { el = h('<div class="toast" role="status"></div>'); host.appendChild(el); }
  el.textContent = text; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2400);
}
// Перемикач
export const sw = (key, on, label = '') => `<button class="sw${on ? ' on' : ''}" role="switch" aria-checked="${on}" data-sw="${key}"${label ? ` aria-label="${esc(label)}"` : ''}><i></i></button>`;

// Оновлення DOM «на місці»: змінюються лише відмінні вузли. Так не перезапускаються анімації відео,
// не закриваються розгорнуті списки, не губиться фокус і прокрутка.
export function morph(root, html) {
  const t = document.createElement('template'); t.innerHTML = html;
  patchChildren(root, t.content);
}
function same(a, b) { return a.nodeType === b.nodeType && a.nodeName === b.nodeName && (a.nodeType !== 1 || (a.dataset?.keep ?? null) === (b.dataset?.keep ?? null)); }
function patchChildren(par, src) {
  const a = [...par.childNodes], b = [...src.childNodes];
  for (let i = 0; i < b.length; i++) {
    const old = a[i], nw = b[i];
    if (!old) { par.appendChild(nw); continue; }
    if (!same(old, nw)) { par.replaceChild(nw, old); continue; }
    if (old.nodeType === 3 || old.nodeType === 8) { if (old.nodeValue !== nw.nodeValue) old.nodeValue = nw.nodeValue; continue; }
    patchNode(old, nw);
  }
  for (let i = b.length; i < a.length; i++) a[i].remove();
}
function patchNode(old, nw) {
  // вміст SVG-ілюстрацій і стилів порівнюємо цілком (вони великі, але змінюються рідко)
  if (old.nodeName === 'svg' || old.nodeName === 'STYLE') { if (old.outerHTML !== nw.outerHTML) old.replaceWith(nw); return; }
  for (const { name, value } of [...nw.attributes]) if (old.getAttribute(name) !== value) old.setAttribute(name, value);
  for (const { name } of [...old.attributes]) if (!nw.hasAttribute(name) && name !== 'open') old.removeAttribute(name);
  const tag = old.nodeName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') { // поля з моделлю (data-in) беремо з розмітки; вільні поля (коментар, повідомлення) не чіпаємо, щоб не стерти набране
    if (old !== document.activeElement && (!old.dataset.keep || old.dataset.in) && old.value !== (nw.value ?? '')) old.value = nw.value; if (tag === 'TEXTAREA') return; }
  if (tag === 'SELECT') { patchChildren(old, nw); if (old !== document.activeElement) { const i = [...nw.options].findIndex(o => o.defaultSelected); if (i >= 0) old.selectedIndex = i; } return; }
  patchChildren(old, nw);
}
