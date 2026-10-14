// TextCraft · Edvault — шапка документа: кольоровий банер на початку (видно і в редакторі, і в експорті).
// Файли підключаються звичайними <script> по черзі й мають спільну глобальну область видимості.
'use strict';

/* ═══════════════════════════ ШАПКА ДОКУМЕНТА ═══════════════════════════ */
// кольори шкільного пенала: чорнило, бірюза, зелена ручка, охра, червона ручка, фіолетове чорнило, малина, графіт
const HEADER_COLORS = ['#2337a8', '#0e7c86', '#1a7a50', '#a86400', '#c8352d', '#6d4bc3', '#b8306f', '#2b2f3a'];
// вигляд: «Яскравий» — заливка кольором, «Світлий» — легкий відтінок і кольорова смуга зліва
const HEADER_STYLES = [['solid', 'Яскравий'], ['soft', 'Світлий']];
const HEADER_PATTERNS = [['none', 'Без'], ['dots', 'Крапки'], ['diagonal', 'Лінії'], ['grid', 'Сітка']];
// готові шапки: мітка, підзаголовок і вигляд; заголовок і логотип лишаються ті, що є
function schoolYear() { const d = new Date(), y = d.getFullYear() - (d.getMonth() < 7 ? 1 : 0); return 'Навчальний рік ' + y + '/' + (y + 1); }
const HEADER_PRESETS = [
  ['practice', 'Практична робота', { subtitle: 'Виконайте завдання по черзі й збережіть результат', color: '#2337a8', style: 'solid', pattern: 'grid', student: true }],
  ['homework', 'Домашнє завдання', { subtitle: 'Здати до наступного уроку', color: '#a86400', style: 'solid', pattern: 'dots', student: true }],
  ['guide', 'Інструкція', { subtitle: 'Виконуйте кроки по порядку', color: '#0e7c86', style: 'soft', pattern: 'none' }],
  ['program', 'Програма навчання', { subtitle: schoolYear, color: '#1a7a50', style: 'solid', pattern: 'diagonal', size: 'tall' }],
  ['lab', 'Лабораторна робота', { subtitle: 'Мета, обладнання, хід роботи, висновки', color: '#6d4bc3', style: 'solid', pattern: 'grid', student: true }],
  ['test', 'Контрольна робота', { subtitle: 'Варіант 1, час виконання 45 хв', color: '#c8352d', style: 'soft', pattern: 'none', student: true }],
  ['lesson', 'Конспект уроку', { subtitle: '', color: '#2b2f3a', style: 'soft', pattern: 'dots' }],
  ['notice', 'Оголошення', { subtitle: '', color: '#b8306f', style: 'solid', pattern: 'diagonal' }],
];
function applyPreset(id) {
  const p = HEADER_PRESETS.find(x => x[0] === id);
  if (!p) return;
  const v = p[2];
  Object.assign(hdrDraft, { preset: id, tag: p[1], subtitle: typeof v.subtitle === 'function' ? v.subtitle() : v.subtitle,
    color: v.color, style: v.style, pattern: v.pattern, size: v.size || 'normal', align: v.align || 'left', student: !!v.student });
  $('#hdrStudent').checked = hdrDraft.student;
  $('#hdrTag').value = hdrDraft.tag;
  $('#hdrSubtitle').value = hdrDraft.subtitle;
  renderHdrModal();
}
function shade(hex, pct) {
  const n = String(hex || '#2337a8').replace('#', '');
  const full = n.length === 3 ? n.split('').map(c => c + c).join('') : n;
  const num = parseInt(full, 16) || 0;
  let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  const t = pct < 0 ? 0 : 255, p = Math.abs(pct);
  r = Math.round((t - r) * p) + r; g = Math.round((t - g) * p) + g; b = Math.round((t - b) * p) + b;
  return '#' + [r, g, b].map(v => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
}
// Розмітка шапки. editable — у редакторі: мітку, заголовок і підзаголовок можна правити просто на шапці,
// порожні поля показуються підказками при наведенні. В експорті порожніх полів немає.
function headerMarkup(h, title, extra, editable) {
  const soft = h.style === 'soft';
  const color = /^#[0-9a-f]{3,8}$/i.test(h.color || '') ? h.color : '#2337a8';
  const bg = soft ? '' : 'background:linear-gradient(135deg,' + color + ',' + shade(color, -0.3) + ');';
  const cls = 'doc-header ' + (soft ? 'style-soft' : 'style-solid') + ' pattern-' + esc(h.pattern || 'none') +
    (h.size && h.size !== 'normal' ? ' size-' + esc(h.size) : '') + (h.align === 'center' ? ' align-center' : '');
  const field = (tag, k, cls, text, ph) => {
    if (!editable) return text ? '<' + tag + ' class="' + cls + '"' + (k === 'title' ? ' id="doc-title"' : '') + '>' + esc(text) + '</' + tag + '>' : '';
    return '<' + tag + ' class="' + cls + (text ? '' : ' is-empty') + '" data-hf="' + k + '" data-ph="' + ph + '" contenteditable="plaintext-only" spellcheck="true" role="textbox" aria-label="' + ph + '">' + esc(text) + '</' + tag + '>';
  };
  return '<div class="' + cls + '" style="--hc:' + color + ';' + bg + '">' +
    (h.logo ? '<img class="doc-header-logo" src="' + esc(h.logo) + '" alt="">' : '') +
    '<div class="doc-header-bg">' + field('div', 'tag', 'doc-header-tag', h.tag, 'Мітка, напр. «Урок 3»') +
    field('h1', 'title', 'doc-header-title', title, 'Заголовок') +
    field('p', 'subtitle', 'doc-header-subtitle', h.subtitle, 'Підзаголовок, напр. «Здати до п’ятниці»') + '</div>' +
    (extra || '') + '</div>' + (h.student ? studentLine() : '');
}
// рядок для учня під шапкою: на роздруківці учень вписує ім’я, клас і дату
function studentLine() {
  return '<div class="doc-student" aria-label="Поля для учня"><span class="ds-f ds-name">Прізвище та ім’я<i></i></span><span class="ds-f">Клас<i></i></span><span class="ds-f">Дата<i></i></span></div>';
}
function headerTitle(h) { return (h.title || $('#docTitle').value.trim() || docLabel()).trim(); }
function renderHeader() {
  const slot = $('#docHeaderSlot');
  const h = state.header || defaultHeader();
  if (!h.enabled) { slot.innerHTML = ''; Toc.schedule(); return; }
  slot.innerHTML = headerMarkup(h, headerTitle(h), '<button type="button" class="doc-header-edit" data-hdr-act="style">' + icon('edit') + 'Оформлення</button>', true);
  Toc.schedule();
}
/* ── правка шапки просто на сторінці ── */
const hdrSlot = $('#docHeaderSlot');
hdrSlot.addEventListener('click', e => {
  if (e.target.closest('[data-hdr-act="style"]')) { openHeaderModal(); return; }
  if (e.target.closest('[data-hf]')) return;
  // клік по тлу шапки — курсор у заголовок
  const t = hdrSlot.querySelector('[data-hf="title"]');
  if (t && e.target.closest('.doc-header')) placeCaretEnd(t);
});
function placeCaretEnd(el) { el.focus(); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); setSel(r); }
hdrSlot.addEventListener('input', e => {
  const f = e.target.closest('[data-hf]'); if (!f || !state.header) return;
  const v = f.textContent.replace(/\s+/g, ' ');
  state.header[f.dataset.hf] = v.trim();
  f.classList.toggle('is-empty', !v.trim());
  state.version++; markDirty(); updateDocTitle(); Toc.schedule();
});
hdrSlot.addEventListener('keydown', e => {
  const f = e.target.closest('[data-hf]'); if (!f) return;
  e.stopPropagation();
  if (e.key === 'Enter') {
    e.preventDefault();
    const order = ['tag', 'title', 'subtitle'], next = hdrSlot.querySelector('[data-hf="' + order[order.indexOf(f.dataset.hf) + 1] + '"]');
    if (next) placeCaretEnd(next); else { f.blur(); placeCaretInBlock(editor.firstElementChild, 'start'); }
  } else if (e.key === 'Escape') { e.preventDefault(); f.blur(); }
});
hdrSlot.addEventListener('paste', e => {
  if (!e.target.closest('[data-hf]')) return;
  e.preventDefault();
  const t = (e.clipboardData.getData('text/plain') || '').replace(/\s+/g, ' ');
  document.execCommand('insertText', false, t);
});
hdrSlot.addEventListener('focusout', e => {
  const f = e.target.closest && e.target.closest('[data-hf]'); if (!f) return;
  // порожній заголовок знову показує назву документа
  setTimeout(() => { if (!hdrSlot.contains(document.activeElement)) renderHeader(); }, 0);
});

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
  $('#hdrStudent').checked = !!hdrDraft.student;
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
  $('#hdrPresets').innerHTML = HEADER_PRESETS.map(([id, name, v]) => '<button type="button" class="hdr-preset' + (d.preset === id && d.tag === name ? ' on' : '') + '" data-preset="' + id + '"><i style="background:' + v.color + '"></i>' + name + '</button>').join('');
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
  else if (id === 'hdrStudent') hdrDraft.student = e.target.checked;
  else return;
  renderHdrPreview();
});
$('#headerModal').addEventListener('click', e => {
  if (!hdrDraft) return;
  const t = e.target;
  const pick = (attr, key) => { const b = t.closest('[data-' + attr + ']'); if (!b) return false; hdrDraft[key] = b.dataset[attr]; renderHdrModal(); return true; };
  if (pick('color', 'color') || pick('style', 'style') || pick('pattern', 'pattern') || pick('size', 'size') || pick('align', 'align')) return;
  const pr = t.closest('[data-preset]');
  if (pr) { applyPreset(pr.dataset.preset); return; }
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
