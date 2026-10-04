// TextCraft · Edvault — шапка документа: кольоровий банер на початку (видно і в редакторі, і в експорті).
// Файли підключаються звичайними <script> по черзі й мають спільну глобальну область видимості.
'use strict';

/* ═══════════════════════════ ШАПКА ДОКУМЕНТА ═══════════════════════════ */
const HEADER_COLORS = ['#4F6BF4', '#0891b2', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#1a1d23'];
// вигляд: «Яскравий» — заливка кольором, «Світлий» — легкий відтінок і кольорова смуга зліва
const HEADER_STYLES = [['solid', 'Яскравий'], ['soft', 'Світлий']];
const HEADER_PATTERNS = [['none', 'Без'], ['dots', 'Крапки'], ['diagonal', 'Лінії'], ['grid', 'Сітка']];
function shade(hex, pct) {
  const n = String(hex || '#4F6BF4').replace('#', '');
  const full = n.length === 3 ? n.split('').map(c => c + c).join('') : n;
  const num = parseInt(full, 16) || 0;
  let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  const t = pct < 0 ? 0 : 255, p = Math.abs(pct);
  r = Math.round((t - r) * p) + r; g = Math.round((t - g) * p) + g; b = Math.round((t - b) * p) + b;
  return '#' + [r, g, b].map(v => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
}
function headerMarkup(h, title, extra) {
  const soft = h.style === 'soft';
  const color = /^#[0-9a-f]{3,8}$/i.test(h.color || '') ? h.color : '#4F6BF4';
  const bg = soft ? '' : 'background:linear-gradient(135deg,' + color + ',' + shade(color, -0.3) + ');';
  const cls = 'doc-header ' + (soft ? 'style-soft' : 'style-solid') + ' pattern-' + esc(h.pattern || 'none') +
    (h.size && h.size !== 'normal' ? ' size-' + esc(h.size) : '') + (h.align === 'center' ? ' align-center' : '');
  return '<div class="' + cls + '" style="--hc:' + color + ';' + bg + '">' +
    (h.logo ? '<img class="doc-header-logo" src="' + esc(h.logo) + '" alt="">' : '') +
    '<div class="doc-header-bg">' + (h.tag ? '<div class="doc-header-tag">' + esc(h.tag) + '</div>' : '') +
    (title ? '<h1 class="doc-header-title">' + esc(title) + '</h1>' : '') +
    (h.subtitle ? '<p class="doc-header-subtitle">' + esc(h.subtitle) + '</p>' : '') + '</div>' +
    (extra || '') + '</div>';
}
function headerTitle(h) { return (h.title || $('#docTitle').value.trim() || docLabel()).trim(); }
function renderHeader() {
  const slot = $('#docHeaderSlot');
  const h = state.header || defaultHeader();
  if (!h.enabled) { slot.innerHTML = ''; return; }
  slot.innerHTML = headerMarkup(h, headerTitle(h), '<span class="doc-header-edit">' + icon('edit') + 'Змінити шапку</span>');
}
$('#docHeaderSlot').addEventListener('click', () => openHeaderModal());

// перший заголовок документа, якщо він збігається з назвою в шапці (щоб не було двох однакових заголовків)
function duplicateH1(title) {
  const first = editor.firstElementChild;
  if (!first || first.tagName !== 'H1') return null;
  const norm = t => String(t || '').replace(ZW, '').replace(/\s+/g, ' ').trim().toLowerCase();
  return norm(first.textContent) && norm(first.textContent) === norm(title) ? first : null;
}

let hdrDraft = null;
function openHeaderModal() {
  const had = !!(state.header && state.header.enabled);
  hdrDraft = Object.assign(defaultHeader(), state.header || {}, { enabled: true });
  if (!HEADER_PATTERNS.some(p => p[0] === hdrDraft.pattern)) hdrDraft.pattern = 'none'; // «кола» й «хвилі» з минулої версії
  $('#hdrTag').value = hdrDraft.tag;
  $('#hdrTitle').value = hdrDraft.title;
  $('#hdrTitle').placeholder = docLabel();
  $('#hdrSubtitle').value = hdrDraft.subtitle;
  $('#hdrRemove').hidden = !had;
  $('#hdrApply').textContent = had ? 'Зберегти' : 'Додати шапку';
  $('#hdrDup').checked = true;
  renderHdrModal();
  Modal.open('headerModal');
}
function renderHdrPreview() {
  const d = hdrDraft;
  $('#hdrPreview').innerHTML = headerMarkup(d, headerTitle(d));
  const dup = duplicateH1(headerTitle(d));
  $('#hdrDupWrap').hidden = !dup;
}
function hdrSeg(id, items, cur, key) {
  $(id).innerHTML = items.map(([v, n]) => '<button type="button" data-' + key + '="' + v + '" class="' + (v === cur ? 'on' : '') + '">' + n + '</button>').join('');
}
function renderHdrModal() {
  const d = hdrDraft;
  const col = (d.color || '').toLowerCase();
  renderHdrPreview();
  const custom = !HEADER_COLORS.some(c => c.toLowerCase() === col);
  $('#hdrColors').innerHTML = HEADER_COLORS.map(c => '<button type="button" class="color-dot' + (c.toLowerCase() === col ? ' on' : '') + '" data-color="' + c + '" style="background:' + c + '" aria-label="Колір ' + c + '"></button>').join('') +
    '<label class="color-custom-wrap' + (custom ? ' on' : '') + '" data-tip="Свій колір"' + (custom ? ' style="background:' + esc(d.color) + '"' : '') + '><input type="color" id="hdrCustom" value="' + esc(d.color) + '"></label>';
  hdrSeg('#hdrStyle', HEADER_STYLES, d.style || 'solid', 'style');
  hdrSeg('#hdrPatterns', HEADER_PATTERNS, d.pattern || 'none', 'pattern');
  hdrSeg('#hdrSize', [['compact', 'Низька'], ['normal', 'Звичайна'], ['tall', 'Висока']], d.size || 'normal', 'size');
  hdrSeg('#hdrAlign', [['left', 'Ліворуч'], ['center', 'По центру']], d.align || 'left', 'align');
  $('#hdrLogoZone').innerHTML = d.logo
    ? '<span class="lz-thumb"><img src="' + esc(d.logo) + '" alt=""></span><span class="lz-txt"><b>Логотип додано</b>Клікніть, щоб замінити</span><button type="button" class="btn btn-danger" id="hdrLogoRemove">Прибрати</button>'
    : '<span class="lz-ico">' + icon('upload') + '</span><span class="lz-txt"><b>Додати логотип</b>PNG, SVG або JPG — клікніть чи перетягніть</span>';
  fillIcons($('#headerModal'));
}
$('#headerModal').addEventListener('input', e => {
  if (!hdrDraft) return;
  const id = e.target.id;
  if (id === 'hdrTag') hdrDraft.tag = e.target.value;
  else if (id === 'hdrTitle') hdrDraft.title = e.target.value;
  else if (id === 'hdrSubtitle') hdrDraft.subtitle = e.target.value;
  else if (id === 'hdrCustom') { hdrDraft.color = e.target.value; renderHdrModal(); return; }
  else return;
  renderHdrPreview();
});
$('#headerModal').addEventListener('click', e => {
  if (!hdrDraft) return;
  const t = e.target;
  const pick = (attr, key) => { const b = t.closest('[data-' + attr + ']'); if (!b) return false; hdrDraft[key] = b.dataset[attr]; renderHdrModal(); return true; };
  if (pick('color', 'color') || pick('style', 'style') || pick('pattern', 'pattern') || pick('size', 'size') || pick('align', 'align')) return;
  if (t.closest('#hdrLogoRemove')) { e.stopPropagation(); hdrDraft.logo = ''; renderHdrModal(); return; }
  if (t.closest('#hdrLogoZone')) $('#logoInput').click();
});
async function setHdrLogo(file) {
  if (!file || !file.type.startsWith('image/')) { toast('Оберіть файл зображення', 'err'); return; }
  const data = await readImageFile(file, 480);
  if (data) { hdrDraft.logo = data; renderHdrModal(); }
  else toast('Не вдалося прочитати зображення', 'err');
}
(function () {
  const z = $('#hdrLogoZone');
  z.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#logoInput').click(); } });
  z.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); z.classList.add('drag'); });
  z.addEventListener('dragleave', () => z.classList.remove('drag'));
  z.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); z.classList.remove('drag'); setHdrLogo(e.dataTransfer.files[0]); });
})();
$('#logoInput').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) setHdrLogo(f); });
function applyHeader(h) {
  state.header = Object.assign({}, h);
  renderHeader();
  state.version++;
  markDirty();
}
$('#hdrApply').addEventListener('click', () => {
  const was = state.header && state.header.enabled;
  const dup = !$('#hdrDupWrap').hidden && $('#hdrDup').checked ? duplicateH1(headerTitle(hdrDraft)) : null;
  // назва з прибраного заголовка лишається в шапці, навіть якщо поле «Заголовок» було порожнє
  if (dup && !hdrDraft.title) hdrDraft.title = dup.textContent.replace(ZW, '').trim();
  applyHeader(hdrDraft);
  if (dup) mutate(() => { const next = dup.nextElementSibling; dup.remove(); if (!editor.firstElementChild) editor.appendChild(emptyP()); if (next) caretStart(next); });
  Modal.close('headerModal');
  if (!was) scrollArea.scrollTo({ top: 0, behavior: 'smooth' });
});
$('#hdrRemove').addEventListener('click', () => {
  const prev = Object.assign({}, state.header);
  applyHeader(Object.assign({}, prev, { enabled: false }));
  Modal.close('headerModal');
  toast('Шапку прибрано', '', { action: 'Повернути', onAction: () => applyHeader(prev) });
});
$('#headerModal').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('#hdrTag,#hdrTitle,#hdrSubtitle')) { e.preventDefault(); $('#hdrApply').click(); }
});
