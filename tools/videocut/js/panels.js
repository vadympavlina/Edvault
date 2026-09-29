// Ліва панель (медіа, текст, елементи, субтитри) і права панель властивостей.
import { S, media, on, emit, commit, select, findSel, layout, clipDur, musicDur, mainEnd, duration, rippleShift } from './state.js';
import { textBoxes } from './render.js';
import { addToTimeline, addOverlay, TEXT_PRESETS, splitAt, duplicateSel, deleteSel, moveZ, addCaption, setCaptions, trimMusicToVideo } from './ops.js';
import { removeMedia } from './media.js';
import { seek } from './player.js';
import { parseSubtitles, toSrt } from './srt.js';
import { $, esc, icon, fmt, fmtShort, parseTime, toast, confirmDialog, downloadBlob, safeName, fmtBytes } from './ui.js';

const COLORS = ['#ffffff', '#1a1d23', '#ef4444', '#f59e0b', '#ffd43b', '#10b981', '#0ea5e9', '#4F6BF4', '#8b5cf6', '#ec4899'];

// ══════════ Ліва панель ══════════
let tab = 'media';
export function initLibrary() {
  $('libTabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    tab = b.dataset.tab; renderLibrary();
  });
  $('libBody').addEventListener('click', onLibClick);
  $('libBody').addEventListener('dblclick', e => {
    const card = e.target.closest('.mcard'); if (!card) return;
    const m = media.get(card.dataset.id); if (m) addToTimeline(m);
  });
  $('libBody').addEventListener('input', onLibInput);
  $('libBody').addEventListener('change', onLibChange);
  on('media', () => { if (tab === 'media' || tab === 'elements') renderLibrary(); });
  on('thumbs', () => { if (tab === 'media') renderLibrary(); });
  on('project', d => { if (tab === 'captions' && !(d && d.from === 'lib')) renderLibrary(); });
  on('select', () => { if (tab === 'captions') markActiveCaption(); });
  on('time', () => { if (tab === 'captions') markActiveCaption(); });
  renderLibrary();
}
export function showTab(t) { tab = t; renderLibrary(); }

function thumbURL(m) {
  const c = m.thumbs[Math.min(m.thumbs.length - 1, Math.floor(m.thumbs.length / 3))];
  return c ? c.c.toDataURL('image/jpeg', 0.7) : '';
}
const thumbCache = new Map();

function renderLibrary() {
  $('libTabs').querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const body = $('libBody');
  if (tab === 'media') {
    const items = [...media.values()];
    const used = new Set([...S.project.clips.map(c => c.mediaId), ...S.project.music.map(m => m.mediaId), ...S.project.overlays.map(o => o.mediaId)]);
    body.innerHTML = `
      <button class="drop" id="btnImport2">${icon('upload')}<b>Додати файли</b><span>Відео, фото або аудіо — або перетягніть їх у вікно</span></button>
      ${items.length ? `<div class="mgrid">${items.map(m => {
        let url = thumbCache.get(m.id + ':' + m.thumbs.length);
        if (url === undefined && m.thumbs.length) { url = thumbURL(m); thumbCache.set(m.id + ':' + m.thumbs.length, url); }
        return `<div class="mcard${used.has(m.id) ? ' used' : ''}" data-id="${m.id}" title="${esc(m.name)}">
          <div class="mthumb">${url ? `<img src="${url}" alt="">` : icon(m.kind === 'audio' ? 'music' : m.kind === 'image' ? 'image' : 'video')}
            ${m.kind !== 'image' ? `<span class="mdur">${fmt(m.duration)}</span>` : ''}
            ${m.analyzing ? '<span class="mbusy"></span>' : ''}
          </div>
          <div class="mname">${esc(m.name)}</div>
          <div class="mact">
            <button class="btn btn-sm btn-primary" data-act="add" data-tip="${m.kind === 'audio' ? 'Додати на музичну доріжку' : 'Додати в кінець таймлайну'}">${icon('plus')}</button>
            <button class="btn btn-sm btn-icon" data-act="rm" data-tip="Прибрати з проєкту">${icon('trash')}</button>
          </div>
        </div>`;
      }).join('')}</div>` : '<p class="lib-hint">Тут з’являться файли проєкту. Усе обробляється у вашому браузері — нічого не завантажується на сервер.</p>'}`;
  } else if (tab === 'text') {
    body.innerHTML = `<p class="lib-hint">Натисніть, щоб додати на поточну позицію курсора.</p><div class="presets">${Object.entries(TEXT_PRESETS).map(([k, v]) => `
      <button class="preset pr-${k}" data-preset="${k}"><span class="pr-demo">${esc(v.o.text.split('\n')[0])}</span><span class="pr-name">${esc(v.label)}</span></button>`).join('')}</div>`;
  } else if (tab === 'elements') {
    const imgs = [...media.values()].filter(m => m.kind === 'image');
    const el = (type, ic, name, sub) => `<button class="elem" data-el="${type}">${icon(ic)}<span><b>${name}</b><small>${sub}</small></span></button>`;
    body.innerHTML = `<div class="elems">
      ${el('arrow', 'arrow', 'Стрілка', 'Вказати на кнопку чи деталь')}
      ${el('rect', 'rect', 'Рамка', 'Обвести важливе')}
      ${el('spot', 'spot', 'Прожектор', 'Затемнити все, крім області')}
      ${el('blur', 'blur', 'Розмиття', 'Сховати пароль, пошту, обличчя')}
    </div>
    <div class="lib-sub">Зображення поверх відео</div>
    ${imgs.length ? `<div class="mgrid">${imgs.map(m => `<button class="mcard img-pick" data-img="${m.id}" title="${esc(m.name)}"><div class="mthumb">${m.thumbs[0] ? `<img src="${m.thumbs[0].c.toDataURL()}" alt="">` : icon('image')}</div><div class="mname">${esc(m.name)}</div></button>`).join('')}</div>` : ''}
    <button class="btn btn-outline btn-block" id="btnAddLogo">${icon('image')} Логотип або картинка…</button>`;
  } else if (tab === 'captions') {
    const cs = S.project.captionStyle;
    const caps = S.project.captions.slice().sort((a, b) => a.start - b.start);
    body.innerHTML = `
      <div class="row2">
        <button class="btn btn-primary btn-grow" id="btnAddCap">${icon('plus')} Субтитр тут</button>
        <button class="btn btn-outline btn-icon" id="btnImpCap" data-tip="Імпорт .srt / .vtt">${icon('upload')}</button>
        <button class="btn btn-outline btn-icon" id="btnExpCap" data-tip="Зберегти .srt" ${caps.length ? '' : 'disabled'}>${icon('download')}</button>
      </div>
      <details class="cap-style"><summary>Вигляд субтитрів</summary>
        <div class="field"><label>Розмір <span class="aux">${cs.size}</span></label><input type="range" min="24" max="96" value="${cs.size}" data-cs="size"></div>
        <div class="field"><label>Фон</label><div class="seg">${[['box', 'Плашка'], ['outline', 'Контур']].map(([v, n]) => `<button data-cs-bg="${v}" class="${cs.bg === v ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <div class="field"><label>Розташування</label><div class="seg">${[['bottom', 'Знизу'], ['top', 'Вгорі']].map(([v, n]) => `<button data-cs-pos="${v}" class="${cs.pos === v ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <div class="field"><label>Колір</label>${swatches(cs.color, 'cs-color')}</div>
      </details>
      ${caps.length ? `<div class="caps">${caps.map(c => `<div class="cap" data-id="${c.id}">
        <button class="cap-t" data-seek="${c.start}">${fmt(c.start, true)}</button>
        <textarea rows="2" data-cap="${c.id}" spellcheck="true">${esc(c.text)}</textarea>
        <button class="btn btn-sm btn-icon" data-cap-del="${c.id}" data-tip="Видалити">${icon('x')}</button>
      </div>`).join('')}</div>` : '<p class="lib-hint">Поставте курсор на потрібне місце, натисніть «Субтитр тут» і введіть текст. Enter у полі — наступний субтитр.<br><br>Є готовий файл субтитрів? Імпортуйте .srt або .vtt.</p>'}`;
    markActiveCaption();
  }
}

function markActiveCaption() {
  const t = S.t;
  document.querySelectorAll('#libBody .cap').forEach(el => {
    const c = S.project.captions.find(x => x.id === el.dataset.id);
    el.classList.toggle('now', !!c && t >= c.start && t < c.start + c.dur);
    el.classList.toggle('sel', !!S.sel && S.sel.id === el.dataset.id);
  });
}

async function onLibClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.id === 'btnImport2') return $('fileInput').click();
  if (b.dataset.act === 'add') { const m = media.get(b.closest('.mcard').dataset.id); if (m) addToTimeline(m); return; }
  if (b.dataset.act === 'rm') {
    const m = media.get(b.closest('.mcard').dataset.id); if (!m) return;
    const p = S.project;
    const uses = p.clips.filter(c => c.mediaId === m.id).length + p.music.filter(x => x.mediaId === m.id).length + p.overlays.filter(o => o.mediaId === m.id).length;
    if (uses && !(await confirmDialog('Прибрати файл?', `«${m.name}» використовується на таймлайні (${uses}). Ці фрагменти теж буде прибрано.`, 'Прибрати'))) return;
    p.clips = p.clips.filter(c => c.mediaId !== m.id);
    p.music = p.music.filter(x => x.mediaId !== m.id);
    p.overlays = p.overlays.filter(o => o.mediaId !== m.id);
    if (S.sel && !findSel()) select(null);
    commit();
    removeMedia(m.id);
    return;
  }
  if (b.dataset.preset) { addOverlay('text', { preset: b.dataset.preset }); emit('focus-inspector'); return; }
  if (b.dataset.el) { addOverlay(b.dataset.el); return; }
  if (b.dataset.img) { addOverlay('image', { mediaId: b.dataset.img }); return; }
  if (b.id === 'btnAddLogo') { $('fileInput').dataset.target = 'logo'; $('fileInput').click(); return; }
  if (b.id === 'btnAddCap') {
    const c = addCaption('');
    renderLibrary();
    const ta = document.querySelector(`#libBody textarea[data-cap="${c.id}"]`);
    if (ta) { ta.focus(); ta.select(); }
    return;
  }
  if (b.id === 'btnImpCap') return $('capInput').click();
  if (b.id === 'btnExpCap') {
    downloadBlob(new Blob([toSrt(S.project.captions)], { type: 'application/x-subrip' }), safeName(S.project.name) + '.srt');
    return;
  }
  if (b.dataset.seek) { seek(+b.dataset.seek); const c = S.project.captions.find(x => Math.abs(x.start - +b.dataset.seek) < 1e-6); if (c) select('caption', c.id); return; }
  if (b.dataset.capDel) {
    S.project.captions = S.project.captions.filter(c => c.id !== b.dataset.capDel);
    if (S.sel && S.sel.id === b.dataset.capDel) select(null);
    commit(); return;
  }
  if (b.dataset.csBg) { S.project.captionStyle.bg = b.dataset.csBg; commit(); return; }
  if (b.dataset.csPos) { S.project.captionStyle.pos = b.dataset.csPos; commit(); return; }
  if (b.dataset.sw === 'cs-color') { S.project.captionStyle.color = b.dataset.c; commit(); }
}

let capTimer = 0;
function onLibInput(e) {
  const ta = e.target.closest('textarea[data-cap]');
  if (ta) {
    const c = S.project.captions.find(x => x.id === ta.dataset.cap);
    if (c) { c.text = ta.value; emit('project', { live: true, from: 'lib' }); clearTimeout(capTimer); capTimer = setTimeout(() => { commit(); }, 600); }
    return;
  }
  const r = e.target.closest('[data-cs]');
  if (r) { S.project.captionStyle[r.dataset.cs] = +r.value; r.previousElementSibling.querySelector('.aux').textContent = r.value; emit('project', { live: true, from: 'lib' }); }
}
function onLibChange(e) {
  if (e.target.matches('[data-cs]')) commit();
}
// Enter у полі субтитру — новий субтитр після поточного
document.addEventListener('keydown', e => {
  const ta = e.target.closest && e.target.closest('#libBody textarea[data-cap]');
  if (!ta || e.key !== 'Enter' || e.shiftKey) return;
  e.preventDefault();
  const c = S.project.captions.find(x => x.id === ta.dataset.cap);
  commit();
  if (c) seek(c.start + c.dur);
  const n = addCaption('');
  renderLibrary();
  const next = document.querySelector(`#libBody textarea[data-cap="${n.id}"]`);
  if (next) { next.focus(); next.select(); }
});

export async function importCaptionFile(file) {
  const list = parseSubtitles(await file.text());
  if (!list.length) { toast('У файлі не знайдено субтитрів', 'err'); return; }
  let replace = false;
  if (S.project.captions.length) replace = await confirmDialog('Замінити субтитри?', `У файлі ${list.length} субтитрів. Замінити поточні (${S.project.captions.length})? «Скасувати» — додати до наявних.`, 'Замінити', false);
  setCaptions(list, replace);
  showTab('captions');
  toast(`Імпортовано субтитрів: ${list.length}`, 'ok');
}

// ══════════ Права панель (властивості) ══════════
const box = () => $('inspector');
export function initInspector() {
  on('select', renderInspector);
  on('project', d => {
    if (d && d.from === 'insp') return;
    if (d && d.live && box().contains(document.activeElement)) return;
    renderInspector();
  });
  on('media', () => { if (!S.sel) renderInspector(); });
  on('focus-inspector', () => {
    const f = box().querySelector('textarea, input[type=text]');
    if (f) { f.focus(); f.select?.(); }
  });
  box().addEventListener('input', onInput);
  box().addEventListener('change', onChange);
  box().addEventListener('click', onClick);
  renderInspector();
}

function swatches(cur, key) {
  return `<div class="swatches">${COLORS.map(c => `<button class="sw${String(cur).toLowerCase() === c.toLowerCase() ? ' on' : ''}" style="background:${c}" data-sw="${key}" data-c="${c}" aria-label="${c}"></button>`).join('')}
    <label class="sw sw-custom" data-tip="Свій колір"><input type="color" value="${/^#[0-9a-f]{6}$/i.test(cur) ? cur : '#ffffff'}" data-color="${key}"></label></div>`;
}
const range = (f, label, min, max, step, val, unit = '', show = null) =>
  `<div class="field"><label>${label}<span class="aux" data-show="${f}">${show ?? val}${unit}</span></label><input type="range" data-f="${f}" min="${min}" max="${max}" step="${step}" value="${val}" data-unit="${unit}"></div>`;
const seg = (f, label, opts, cur) =>
  `<div class="field"><label>${label}</label><div class="seg">${opts.map(([v, n]) => `<button data-set="${f}" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${n}</button>`).join('')}</div></div>`;
const timeField = (f, label, val) => `<div class="field half"><label>${label}</label><input class="input" data-time="${f}" value="${fmt(val, true)}" inputmode="decimal"></div>`;
const actions = (...btns) => `<div class="insp-actions">${btns.join('')}</div>`;
const act = (a, ic, label, extra = '') => `<button class="btn btn-outline btn-sm" data-a="${a}" ${extra}>${icon(ic)}${label}</button>`;

function renderInspector() {
  const el = box();
  const o = findSel(), s = S.sel;
  if (!o) { el.innerHTML = projectPanel(); return; }
  if (s.kind === 'clip') el.innerHTML = clipPanel(o);
  else if (s.kind === 'overlay') el.innerHTML = overlayPanel(o);
  else if (s.kind === 'caption') el.innerHTML = captionPanel(o);
  else if (s.kind === 'music') el.innerHTML = musicPanel(o);
}

function head(ic, title, sub) {
  return `<div class="insp-head"><span class="insp-ico">${icon(ic)}</span><div><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>
    <button class="btn btn-icon btn-sm" data-a="deselect" data-tip="Зняти виділення (Esc)">${icon('x')}</button></div>`;
}

function projectPanel() {
  const p = S.project;
  const d = duration();
  return `<div class="insp-head"><span class="insp-ico">${icon('gear')}</span><div><b>Проєкт</b><small>${S.project.clips.length} кліп(ів) · ${fmt(d)}</small></div></div>
    <div class="field"><label>Назва</label><input class="input" data-pf="name" value="${esc(p.name)}" maxlength="80"></div>
    ${seg('p:aspect', 'Формат кадру', [['16:9', '16:9'], ['9:16', '9:16'], ['1:1', '1:1'], ['4:3', '4:3']], p.aspect)}
    <p class="hint">16:9 — YouTube, презентації · 9:16 — Reels, Shorts, TikTok · 1:1 — дописи</p>
    ${seg('p:fps', 'Кадрів за секунду', [[24, '24'], [25, '25'], [30, '30'], [60, '60']], p.fps)}
    <div class="field"><label>Колір фону</label>${swatches(p.bg, 'p:bg')}</div>
    <div class="tips">
      <b>Швидкий старт</b>
      <ol>
        <li>Перетягніть відео у вікно або натисніть «Додати файли».</li>
        <li>Поставте курсор і натисніть <kbd>S</kbd>, щоб розрізати; виділіть зайве й натисніть <kbd>Delete</kbd>.</li>
        <li>Або позначте шматок клавішами <kbd>I</kbd> і <kbd>O</kbd> та виріжте його <kbd>X</kbd>.</li>
        <li>Додайте текст, стрілки чи розмиття ліворуч, а потім — «Експорт».</li>
      </ol>
    </div>`;
}

function clipPanel(c) {
  const m = media.get(c.mediaId);
  const l = layout().find(x => x.clip.id === c.id);
  const isImg = m && m.kind === 'image';
  const sp = c.speed || 1;
  const sub = m ? (isImg ? 'Зображення' : `Фрагмент ${fmt(c.in)}–${fmt(c.out)} з ${fmt(m.duration)}`) : 'Файл відсутній';
  return head(isImg ? 'image' : 'video', m ? m.name : 'Кліп', sub) +
    `<div class="insp-row"><div class="field half"><label>На таймлайні</label><div class="static">${l ? fmt(l.start, true) + ' – ' + fmt(l.end, true) : '—'}</div></div><div class="field half"><label>Тривалість</label>${isImg ? `<input class="input" data-time="_dur" value="${fmt(clipDur(c), true)}">` : `<div class="static">${fmtShort(clipDur(c))}</div>`}</div></div>
    ${isImg ? '' : `${seg('speed', 'Швидкість', [[0.5, '0,5×'], [0.75, '0,75×'], [1, '1×'], [1.25, '1,25×'], [1.5, '1,5×'], [2, '2×']], sp)}
    <div class="field"><label>Гучність<span class="aux" data-show="volume">${Math.round((c.volume ?? 1) * 100)}%</span></label>
      <div class="inline"><button class="btn btn-icon btn-sm${c.muted ? ' danger' : ''}" data-a="mute" data-tip="${c.muted ? 'Увімкнути звук' : 'Вимкнути звук'}">${icon(c.muted ? 'mute' : 'volume')}</button>
      <input type="range" data-f="volume" data-pct="1" min="0" max="2" step="0.05" value="${c.volume ?? 1}" ${c.muted ? 'disabled' : ''}></div></div>`}
    ${range('fadeIn', 'Плавна поява', 0, 3, 0.1, c.fadeIn || 0, ' с')}
    ${range('fadeOut', 'Плавне зникнення', 0, 3, 0.1, c.fadeOut || 0, ' с')}
    <div class="sep"></div>
    ${seg('fit', 'Кадр', [['contain', 'Вписати'], ['cover', 'Заповнити']], c.fit || 'contain')}
    ${range('zoom', 'Наближення', 1, 4, 0.05, c.zoom || 1, '×', (c.zoom || 1).toFixed(2).replace('.', ','))}
    ${(c.zoom || 1) > 1.001 ? '<p class="hint">Перетягніть хрестик на перегляді, щоб вибрати, куди наближати.</p>' : '<p class="hint">Наближення допомагає показати дрібну деталь на записі екрана.</p>'}
    ${actions(act('split', 'split', 'Розрізати', 'data-key="S"'), act('dup', 'copy', 'Дублювати'), act('del', 'trash', 'Видалити'))}`;
}

const OV_NAMES = { text: 'Текст', rect: 'Рамка', arrow: 'Стрілка', blur: 'Розмиття', spot: 'Прожектор', image: 'Зображення' };
const OV_ICONS = { text: 'text', rect: 'rect', arrow: 'arrow', blur: 'blur', spot: 'spot', image: 'image' };
function overlayPanel(o) {
  let body = '';
  if (o.type === 'text') {
    body = `<div class="field"><label>Текст</label><textarea class="input" rows="3" data-f="text" spellcheck="true">${esc(o.text)}</textarea></div>
      ${range('size', 'Розмір', 20, 220, 1, o.size)}
      ${seg('weight', 'Насиченість', [[400, 'Звичайний'], [600, 'Напівжирний'], [800, 'Жирний']], o.weight || 700)}
      <div class="field"><label>Колір тексту</label>${swatches(o.color, 'color')}</div>
      ${seg('bg', 'Оформлення', [['none', 'Без'], ['shadow', 'Тінь'], ['outline', 'Контур'], ['box', 'Плашка']], o.bg || 'none')}
      ${o.bg === 'box' || o.bg === 'outline' ? `<div class="field"><label>Колір ${o.bg === 'box' ? 'плашки' : 'контуру'}</label>${swatches(o.bgColor || '#000000', 'bgColor')}</div>` : ''}
      ${o.bg === 'box' ? range('bgAlpha', 'Непрозорість плашки', 0.2, 1, 0.05, o.bgAlpha ?? 0.7, '%', Math.round((o.bgAlpha ?? 0.7) * 100)) : ''}
      <div class="field"><label>Вирівнювання</label><div class="seg">${[['left', 'alignL'], ['center', 'alignC'], ['right', 'alignR']].map(([v, ic]) => `<button data-set="align" data-v="${v}" class="${(o.align || 'left') === v ? 'on' : ''}">${icon(ic)}</button>`).join('')}</div></div>
      <div class="field"><label>Розташування</label><div class="seg">${[['top', 'Вгорі'], ['middle', 'Центр'], ['bottom', 'Внизу']].map(([v, n]) => `<button data-a="place" data-v="${v}">${n}</button>`).join('')}</div></div>`;
  } else if (o.type === 'rect') {
    body = `<div class="field"><label>Колір</label>${swatches(o.color, 'color')}</div>
      ${range('stroke', 'Товщина', 2, 30, 1, o.stroke || 8)}${range('radius', 'Заокруглення', 0, 80, 1, o.radius ?? 16)}
      ${seg('fill', 'Заливка', [['false', 'Без'], ['true', 'Напівпрозора']], String(!!o.fill))}`;
  } else if (o.type === 'arrow') {
    body = `<div class="field"><label>Колір</label>${swatches(o.color, 'color')}</div>${range('stroke', 'Товщина', 3, 30, 1, o.stroke || 10)}
      <p class="hint">Тягніть кінці стрілки на перегляді.</p>`;
  } else if (o.type === 'blur') {
    body = `${range('strength', 'Сила', 6, 60, 1, o.strength || 20)}${seg('pixel', 'Вигляд', [['false', 'Розмиття'], ['true', 'Пікселі']], String(!!o.pixel))}
      <p class="hint">Перемістіть і змініть розмір області на перегляді, щоб закрити пароль, пошту чи обличчя.</p>`;
  } else if (o.type === 'spot') {
    body = `${range('dim', 'Затемнення', 0.2, 0.9, 0.02, o.dim ?? 0.6, '%', Math.round((o.dim ?? 0.6) * 100))}${seg('shape', 'Форма', [['rect', 'Прямокутник'], ['ellipse', 'Овал']], o.shape || 'rect')}`;
  } else if (o.type === 'image') {
    body = range('radius', 'Заокруглення', 0, 120, 1, o.radius || 0);
  }
  const sub = `${fmt(o.start, true)} – ${fmt(o.start + o.dur, true)}`;
  return head(OV_ICONS[o.type], OV_NAMES[o.type], sub) + body +
    `<div class="sep"></div>
    <div class="insp-row">${timeField('start', 'Початок', o.start)}${timeField('dur', 'Тривалість', o.dur)}</div>
    <label class="check"><input type="checkbox" data-f="fade" ${o.fade ? 'checked' : ''}> Плавна поява й зникнення</label>
    ${actions(act('toCursor', 'stepFwd', 'До курсора'), act('front', 'front', 'Наперед'), act('dup', 'copy', 'Дублювати'), act('del', 'trash', 'Видалити'))}`;
}

function captionPanel(c) {
  return head('cc', 'Субтитр', `${fmt(c.start, true)} – ${fmt(c.start + c.dur, true)}`) +
    `<div class="field"><label>Текст</label><textarea class="input" rows="3" data-f="text" spellcheck="true">${esc(c.text)}</textarea></div>
    <div class="insp-row">${timeField('start', 'Початок', c.start)}${timeField('dur', 'Тривалість', c.dur)}</div>
    <p class="hint">Вигляд усіх субтитрів — у вкладці «Субтитри» ліворуч.</p>
    ${actions(act('split', 'split', 'Розрізати'), act('dup', 'copy', 'Дублювати'), act('del', 'trash', 'Видалити'))}`;
}

function musicPanel(x) {
  const m = media.get(x.mediaId);
  return head('music', m ? m.name : 'Аудіо', `${fmt(x.start, true)} – ${fmt(x.start + musicDur(x), true)}`) +
    `<div class="field"><label>Гучність<span class="aux" data-show="volume">${Math.round((x.volume ?? 1) * 100)}%</span></label><input type="range" data-f="volume" data-pct="1" min="0" max="2" step="0.05" value="${x.volume ?? 1}"></div>
    ${range('fadeIn', 'Плавна поява', 0, 5, 0.1, x.fadeIn || 0, ' с')}
    ${range('fadeOut', 'Плавне зникнення', 0, 8, 0.1, x.fadeOut || 0, ' с')}
    <div class="insp-row">${timeField('start', 'Початок', x.start)}<div class="field half"><label>Тривалість</label><div class="static">${fmtShort(musicDur(x))}</div></div></div>
    ${actions(act('fitMusic', 'fit', 'Під довжину відео', mainEnd() > x.start ? '' : 'disabled'), act('split', 'split', 'Розрізати'), act('del', 'trash', 'Видалити'))}`;
}

// ── обробка введення ──
let commitTimer = 0;
const softCommit = () => { clearTimeout(commitTimer); commitTimer = setTimeout(() => commit(), 500); };

function onInput(e) {
  const t = e.target;
  if (t.dataset.pf) { S.project[t.dataset.pf] = t.value; emit('project', { live: true, from: 'insp' }); emit('title'); softCommit(); return; }
  const o = findSel(); if (!o) return;
  if (t.dataset.f) {
    const f = t.dataset.f;
    let v = t.type === 'checkbox' ? t.checked : t.type === 'range' ? +t.value : t.value;
    o[f] = v;
    const show = box().querySelector(`[data-show="${f}"]`);
    if (show) show.textContent = t.dataset.pct ? Math.round(v * 100) + '%' : t.dataset.unit === '%' ? Math.round(v * 100) + '%' : t.dataset.unit === '×' ? v.toFixed(2).replace('.', ',') + '×' : String(v).replace('.', ',') + (t.dataset.unit || '');
    emit('project', { live: true, from: 'insp' });
    softCommit();
    return;
  }
  if (t.dataset.color) { setColor(o, t.dataset.color, t.value); }
}
function onChange(e) {
  const t = e.target;
  if (t.dataset.time) {
    const o = findSel(); if (!o) return;
    const v = parseTime(t.value);
    if (!isFinite(v) || v < 0) { t.value = ''; renderInspector(); return; }
    const f = t.dataset.time;
    if (f === '_dur') { o.in = 0; o.out = Math.max(0.3, v); }
    else if (f === 'dur') o.dur = Math.max(0.2, v);
    else o[f] = v;
    commit();
    return;
  }
  if (t.dataset.f && t.type === 'range') { clearTimeout(commitTimer); commit(); if (t.dataset.f === 'zoom' || t.dataset.f === 'size') renderInspector(); }
  if (t.dataset.f === 'fade') commit();
  if (t.dataset.color) { clearTimeout(commitTimer); commit(); }
}
function setColor(o, key, val) {
  if (key.startsWith('p:')) S.project[key.slice(2)] = val;
  else if (key === 'cs-color') S.project.captionStyle.color = val;
  else o[key] = val;
  emit('project', { live: true, from: 'insp' });
  softCommit();
}

function onClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  const o = findSel();
  if (b.dataset.sw) {
    const key = b.dataset.sw;
    if (key.startsWith('p:')) S.project[key.slice(2)] = b.dataset.c; else if (o) o[key] = b.dataset.c;
    commit(); return;
  }
  if (b.dataset.set) {
    const f = b.dataset.set;
    let v = b.dataset.v;
    if (f.startsWith('p:')) {
      const k = f.slice(2);
      S.project[k] = k === 'fps' ? +v : v;
      commit(); emit('aspect'); return;
    }
    if (!o) return;
    if (v === 'true' || v === 'false') v = v === 'true';
    else if (!isNaN(+v) && f !== 'align' && f !== 'bg' && f !== 'fit' && f !== 'shape') v = +v;
    if (f === 'speed') {
      // зміна швидкості змінює довжину кліпу — зсуваємо все далі
      const l = layout().find(x => x.clip.id === o.id);
      const before = clipDur(o);
      o.speed = v;
      const delta = clipDur(o) - before;
      rippleShift(l.end + Math.min(0, delta), delta);
      commit();
      return;
    }
    o[f] = v;
    commit(); return;
  }
  switch (b.dataset.a) {
    case 'deselect': select(null); break;
    case 'split': splitAt(); break;
    case 'dup': duplicateSel(); break;
    case 'del': deleteSel(); break;
    case 'front': moveZ(1); break;
    case 'mute': if (o) { o.muted = !o.muted; commit(); } break;
    case 'toCursor': if (o) { o.start = S.t; commit(); } break;
    case 'fitMusic': if (o) trimMusicToVideo(o); break;
    case 'place': if (o) {
      const h = textBoxes.get(o) || 0.12;
      o.y = b.dataset.v === 'top' ? 0.07 : b.dataset.v === 'middle' ? (1 - h) / 2 : 0.93 - h;
      commit();
    } break;
  }
}

export { renderInspector, renderLibrary, fmtBytes };
