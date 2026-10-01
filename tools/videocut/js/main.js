// Точка входу відеоредактора Edvault.
import { S, media, on, emit, commit, undo, redo, canUndo, canRedo, select, findSel, duration, layout, clipAt, newProject, resetHistory, mainEnd } from './state.js';
import { addMedia, removeMedia } from './media.js';
import { initPlayer, resizeCanvas, seek, toggle, pause, play, snapshot, requestDraw } from './player.js';
import { initTimeline, render as renderTimeline, zoomBy, zoomFit, setZoom } from './timeline.js';
import { initLibrary, initInspector, importCaptionFile, showTab } from './panels.js';
import { initPreviewLayer, renderHandles } from './preview.js';
import { addToTimeline, addOverlay, splitAt, deleteSel, duplicateSel, cutRange, addCaption, findSilences, cutRanges, addVoice } from './ops.js';
import { exportVideo, exportAudio, exportSize, detectCodecs, canExport } from './export.js';
import { DB, takeHandoff } from './db.js';
import { $, icon, hydrateIcons, initTips, initTheme, toast, fmt, openModal, closeModal, anyModalOpen, confirmDialog, downloadBlob, safeName, fmtBytes } from './ui.js';

hydrateIcons();
initTips();
initTheme($('btnTheme'));
initPlayer($('pv'));
initTimeline();
initLibrary();
initInspector();
initPreviewLayer();

// ── розмір перегляду ──
const stage = $('stage');
function fitStage() {
  const r = stage.getBoundingClientRect();
  resizeCanvas(Math.max(40, r.width - 32), Math.max(40, r.height - 32));
  renderHandles();
}
new ResizeObserver(fitStage).observe(stage);
on('aspect', () => { fitStage(); renderTimeline(); });
on('project', d => { if (d && d.committed) fitStage(); });

// ── перемикач таймлайну за висотою ──
(() => {
  const sp = $('splitter');
  let saved = 0;
  try { saved = +localStorage.getItem('ev_vc_tl_h') || 0; } catch (e) { /* ignore */ }
  if (saved) document.documentElement.style.setProperty('--tl-h', saved + 'px');
  sp.addEventListener('pointerdown', e => {
    sp.setPointerCapture(e.pointerId); sp.classList.add('active');
    const startY = e.clientY, startH = $('tl').getBoundingClientRect().height;
    const mv = ev => {
      const h = Math.max(150, Math.min(window.innerHeight - 260, startH - (ev.clientY - startY)));
      document.documentElement.style.setProperty('--tl-h', h + 'px');
    };
    sp.addEventListener('pointermove', mv);
    sp.addEventListener('pointerup', () => {
      sp.removeEventListener('pointermove', mv); sp.classList.remove('active');
      try { localStorage.setItem('ev_vc_tl_h', Math.round($('tl').getBoundingClientRect().height)); } catch (e) { /* ignore */ }
      renderTimeline();
    }, { once: true });
  });
})();

// ── транспорт ──
function syncTransport() {
  $('trTime').textContent = fmt(S.t, true);
  $('trDur').textContent = fmt(duration(), true);
}
on('time', syncTransport);
on('project', syncTransport);
on('play', () => { $('btnPlay').innerHTML = icon(S.playing ? 'pause' : 'play'); });
const frame = () => 1 / (S.project.fps || 30);
$('btnPlay').addEventListener('click', toggle);
$('btnStart').addEventListener('click', () => seek(0));
$('btnEnd').addEventListener('click', () => seek(duration()));
$('btnFrameBack').addEventListener('click', () => { pause(); seek(S.t - frame()); });
$('btnFrameFwd').addEventListener('click', () => { pause(); seek(S.t + frame()); });
$('btnSnap').addEventListener('click', async () => {
  if (!duration()) return;
  const b = await snapshot();
  downloadBlob(b, `${safeName(S.project.name)}-кадр-${fmt(S.t).replace(/:/g, '-')}.png`);
  toast('Кадр збережено', 'ok');
});
$('btnFull').addEventListener('click', toggleFullscreen);
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else stage.requestFullscreen?.().catch(() => {});
}
document.addEventListener('fullscreenchange', () => setTimeout(fitStage, 50));

// ── верхня панель ──
function syncHistory() { $('btnUndo').disabled = !canUndo(); $('btnRedo').disabled = !canRedo(); }
on('history', syncHistory);
$('btnUndo').addEventListener('click', () => undo());
$('btnRedo').addEventListener('click', () => redo());
function syncTitle() {
  $('projName').textContent = S.project.name || 'Без назви';
  document.title = (S.project.name ? S.project.name + ' — ' : '') + 'Відеоредактор Edvault';
}
on('title', syncTitle);
on('project', syncTitle);
$('btnHelp').addEventListener('click', () => openModal('helpModal'));
document.querySelectorAll('.overlay').forEach(o => o.addEventListener('click', e => {
  if (o.id === 'confirmModal') return;
  if (e.target === o || e.target.closest('[data-close]')) { if (o.id === 'exportModal' && exporting) return; closeModal(o.id); }
}));

// порожній стан перегляду
function syncEmpty() { $('stageEmpty').hidden = S.project.clips.length > 0 || S.project.overlays.length > 0; }
on('project', syncEmpty);

// ── імпорт файлів ──
const fileInput = $('fileInput');
$('btnImport').addEventListener('click', () => { fileInput.dataset.target = ''; fileInput.click(); });
$('btnImport3').addEventListener('click', () => { fileInput.dataset.target = ''; fileInput.click(); });
fileInput.addEventListener('change', () => {
  const files = [...fileInput.files];
  const target = fileInput.dataset.target;
  fileInput.value = ''; fileInput.dataset.target = '';
  importFiles(files, { logo: target === 'logo' });
});
$('capInput').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importCaptionFile(f); });

async function importFiles(files, { logo = false, toTimeline = true } = {}) {
  let added = 0;
  for (const f of files) {
    if (/\.(srt|vtt)$/i.test(f.name)) { await importCaptionFile(f); continue; }
    toast(`Відкриваємо «${f.name}»…`, '', 60000);
    try {
      const m = await addMedia(f, f.name);
      added++;
      if (logo && m.kind === 'image') addOverlay('image', { mediaId: m.id });
      else if (toTimeline && (m.kind !== 'image' || !S.project.clips.length || files.length > 1)) addToTimeline(m, { silent: true });
      if (m.kind === 'video' && !m.canDecodeV && m.vt) toast(`«${m.name}»: браузер не вміє швидко декодувати цей кодек — експорт буде повільнішим`, 'err', 6000);
    } catch (e) {
      console.error(e);
      toast(e.message || 'Не вдалося відкрити файл', 'err', 5000);
    }
  }
  if (added) {
    toast(added === 1 ? 'Файл додано' : `Додано файлів: ${added}`, 'ok');
    if (S.project.clips.length && duration() > 0) zoomFit();
    emit('aspect');
  }
}

// перетягування файлів у вікно
let dragDepth = 0;
const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
window.addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; $('dropHint').classList.add('show'); });
window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('dropHint').classList.remove('show'); });
window.addEventListener('drop', e => {
  if (!hasFiles(e)) return;
  e.preventDefault(); dragDepth = 0; $('dropHint').classList.remove('show');
  importFiles([...e.dataTransfer.files]);
});

// ── таймлайн: кнопки ──
$('btnSplit').addEventListener('click', () => splitAt());
$('btnDelete').addEventListener('click', () => { if (!deleteSel()) toast('Спочатку виділіть елемент на таймлайні'); });
$('btnMarkIn').addEventListener('click', () => mark('in'));
$('btnMarkOut').addEventListener('click', () => mark('out'));
$('btnCutRange').addEventListener('click', () => cutRange(S.markIn, S.markOut));
$('btnSnapToggle').addEventListener('click', e => { S.snap = !S.snap; e.currentTarget.classList.toggle('on', S.snap); toast(S.snap ? 'Прилипання увімкнено' : 'Прилипання вимкнено'); });
$('btnZoomIn').addEventListener('click', () => zoomBy(1.5));
$('btnZoomOut').addEventListener('click', () => zoomBy(1 / 1.5));
$('btnZoomFit').addEventListener('click', zoomFit);
function mark(which) {
  if (which === 'in') S.markIn = S.t; else S.markOut = S.t;
  if (S.markIn != null && S.markOut != null && S.markOut < S.markIn) [S.markIn, S.markOut] = [S.markOut, S.markIn];
  $('btnCutRange').disabled = !(S.markIn != null && S.markOut != null && S.markOut - S.markIn > 0.05);
  emit('marks');
  toast(which === 'in' ? `Початок шматка: ${fmt(S.t, true)}` : `Кінець шматка: ${fmt(S.t, true)}`);
}
function clearMarks() { S.markIn = S.markOut = null; $('btnCutRange').disabled = true; emit('marks'); }
on('project', d => { if (d && d.committed && S.markIn == null) $('btnCutRange').disabled = true; });

// ── клавіатура (за фізичною клавішею — працює й на українській розкладці) ──
document.addEventListener('keydown', e => {
  if (anyModalOpen()) {
    if (e.key === 'Escape') {
      const o = document.querySelector('.overlay.open');
      if (o.id === 'confirmModal') $('confirmNo').click();
      else if (!(o.id === 'exportModal' && exporting)) closeModal(o.id);
    }
    return;
  }
  if (rec) { // під час запису голосу — лише зупинка
    if (e.code === 'Space' || e.key === 'Escape') { e.preventDefault(); stopVoice(); }
    return;
  }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.code === 'KeyZ') { if (typing) return; e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && e.code === 'KeyY') { if (typing) return; e.preventDefault(); redo(); return; }
  if (mod && e.code === 'KeyE') { e.preventDefault(); openExport(); return; }
  if (mod && e.code === 'KeyS') { e.preventDefault(); saveNow(); toast('Проєкт збережено в цьому браузері', 'ok'); return; }
  if (typing) { if (e.key === 'Escape') e.target.blur(); return; }
  if (mod && e.code === 'KeyD') { e.preventDefault(); duplicateSel(); return; }
  if (mod || e.altKey) return;
  const f = frame();
  switch (e.code) {
    case 'Space': case 'KeyK': e.preventDefault(); toggle(); break;
    case 'KeyJ': seek(S.t - 5); break;
    case 'KeyL': seek(S.t + 5); break;
    case 'ArrowLeft': e.preventDefault(); pause(); seek(S.t - (e.shiftKey ? 1 : f)); break;
    case 'ArrowRight': e.preventDefault(); pause(); seek(S.t + (e.shiftKey ? 1 : f)); break;
    case 'Home': e.preventDefault(); seek(0); break;
    case 'End': e.preventDefault(); seek(duration()); break;
    case 'KeyS': e.preventDefault(); splitAt(); break;
    case 'Delete': case 'Backspace': e.preventDefault(); deleteSel(); break;
    case 'KeyI': mark('in'); break;
    case 'KeyO': mark('out'); break;
    case 'KeyX': cutRange(S.markIn, S.markOut); break;
    case 'KeyT': showTab('text'); addOverlay('text', { preset: 'plain' }); emit('focus-inspector'); break;
    case 'KeyC': showTab('captions'); addCaption(''); break;
    case 'KeyF': toggleFullscreen(); break;
    case 'KeyR': openVoice(); break;
    case 'Equal': case 'NumpadAdd': zoomBy(1.5); break;
    case 'Minus': case 'NumpadSubtract': zoomBy(1 / 1.5); break;
    case 'KeyZ': if (e.shiftKey) zoomFit(); break;
    case 'Escape': if (S.sel) select(null); else clearMarks(); break;
    case 'Slash': if (e.shiftKey) openModal('helpModal'); break;
    default: return;
  }
});

// ══════════ Експорт ══════════
let exporting = null, lastExport = null;
const exOpt = { format: 'mp4', short: 1080, quality: 'high', range: 'all' };
function segPick(id, key, conv = v => v) {
  $(id).addEventListener('click', e => {
    const b = e.target.closest('button[data-v]'); if (!b || b.disabled) return;
    $(id).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    exOpt[key] = conv(b.dataset.v);
    updateExportInfo();
  });
}
segPick('exFormat', 'format');
segPick('exRes', 'short', Number);
segPick('exQuality', 'quality');
segPick('exRange', 'range');
$('btnExport').addEventListener('click', openExport);
on('open-export', openExport);

function openExport() {
  if (!duration()) { toast('Спочатку додайте відео на таймлайн'); return; }
  if (!canExport()) { toast('Експорт потребує сучасного браузера: Chrome, Edge, Safari 17+ або Firefox 130+', 'err', 6000); return; }
  pause();
  $('exSetup').hidden = false; $('exRun').hidden = true; $('exDone').hidden = true;
  $('exName').value = S.project.name && S.project.name !== 'Новий проєкт' ? S.project.name : defaultName();
  const hasMarks = S.markIn != null && S.markOut != null && S.markOut - S.markIn > 0.1;
  $('exRangeWrap').hidden = !hasMarks;
  if (!hasMarks) exOpt.range = 'all';
  updateExportInfo();
  openModal('exportModal');
}
function defaultName() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `відео-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const exRange = () => (exOpt.range === 'marks' && S.markIn != null && S.markOut != null ? [S.markIn, S.markOut] : [0, duration()]);

let infoSeq = 0;
async function updateExportInfo() {
  const audioOnly = exOpt.format === 'audio';
  $('exResWrap').hidden = audioOnly;
  $('exExt').textContent = audioOnly ? '.m4a' : '.' + exOpt.format;
  const [a, b] = exRange();
  const len = b - a;
  const { W, H } = exportSize(exOpt.short);
  const seq = ++infoSeq;
  $('exInfo').innerHTML = 'Перевіряємо можливості браузера…';
  const fmtKey = audioOnly ? 'mp4' : exOpt.format;
  const codecs = await detectCodecs(fmtKey, W, H).catch(() => ({}));
  if (seq !== infoSeq) return;
  const names = { avc: 'H.264', hevc: 'H.265', vp9: 'VP9', vp8: 'VP8', av1: 'AV1', aac: 'AAC', opus: 'Opus', vorbis: 'Vorbis' };
  const vbr = { medium: 2.5, high: 5, max: 9 }[exOpt.quality] * (W * H) / (1920 * 1080) + 0.16;
  const size = (audioOnly ? 0.16 : vbr) * 1e6 / 8 * len;
  let html;
  if (audioOnly) html = codecs.a ? `Звук: <b>${names[codecs.a] || codecs.a}</b> · тривалість <b>${fmt(len)}</b> · приблизно <b>${fmtBytes(size)}</b>` : '<span class="warn">Браузер не вміє кодувати звук.</span>';
  else if (!codecs.v) html = `<span class="warn">Браузер не вміє кодувати відео у ${exOpt.format.toUpperCase()} такого розміру. Спробуйте інший формат або меншу якість.</span>`;
  else html = `<b>${W}×${H}</b>, ${S.project.fps} к/с · відео <b>${names[codecs.v] || codecs.v}</b>${codecs.a ? `, звук <b>${names[codecs.a] || codecs.a}</b>` : ''}<br>Тривалість <b>${fmt(len)}</b> · файл приблизно <b>${fmtBytes(size)}</b>` +
    (exOpt.format === 'mp4' && codecs.v !== 'avc' ? '<br><span class="warn">Цей браузер не має кодека H.264 — MP4 може не відкритися на старих пристроях.</span>' : '');
  $('exInfo').innerHTML = html;
  $('exStart').disabled = audioOnly ? !codecs.a : !codecs.v;
}

$('exStart').addEventListener('click', startExport);
$('exCancel').addEventListener('click', () => { if (exporting) exporting.abort(); });
$('exAgain').addEventListener('click', () => { if (lastExport) downloadBlob(lastExport.blob, lastExport.name); });

async function startExport() {
  const audioOnly = exOpt.format === 'audio';
  const ext = audioOnly ? 'm4a' : exOpt.format;
  const name = safeName($('exName').value || defaultName()) + '.' + ext;
  const range = exRange();
  let writable = null;
  // довгі відео пишемо одразу у файл (без утримання всього в пам'яті), якщо браузер це дозволяє
  if (!audioOnly && window.showSaveFilePicker && range[1] - range[0] > 600) {
    try {
      const h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Відео', accept: { [exOpt.format === 'mp4' ? 'video/mp4' : 'video/webm']: ['.' + ext] } }] });
      writable = await h.createWritable();
    } catch (e) { if (e.name === 'AbortError') return; writable = null; }
  }
  $('exSetup').hidden = true; $('exRun').hidden = false;
  $('exBar').style.width = '0%'; $('exPct').textContent = '0%'; $('exEta').textContent = 'Готуємо…';
  const ctrl = new AbortController();
  exporting = ctrl;
  const t0 = performance.now();
  const onProgress = (p, info) => {
    $('exBar').style.width = (p * 100).toFixed(1) + '%';
    $('exPct').textContent = Math.floor(p * 100) + '%';
    if (info && info.eta != null) $('exEta').textContent = `Залишилось ≈ ${fmt(info.eta)}${info.speed ? ` · швидкість ${info.speed.toFixed(1).replace('.', ',')}×` : ''}`;
  };
  try {
    const opts = { format: audioOnly ? 'mp4' : exOpt.format, short: exOpt.short, quality: exOpt.quality, fps: S.project.fps, range, onProgress, signal: ctrl.signal, writable };
    const blob = audioOnly ? await exportAudio(opts) : await exportVideo(opts);
    const secs = (performance.now() - t0) / 1000;
    if (blob) { lastExport = { blob, name }; downloadBlob(blob, name); }
    $('exRun').hidden = true; $('exDone').hidden = false;
    $('exAgain').hidden = !blob;
    $('exDoneInfo').textContent = `${name}${blob ? ' · ' + fmtBytes(blob.size) : ''} · за ${fmt(secs)}`;
    toast('Експорт завершено', 'ok');
    emit('exported');
  } catch (e) {
    console.error(e);
    if (writable) try { await writable.abort(); } catch (er) { /* ignore */ }
    $('exRun').hidden = true; $('exSetup').hidden = false;
    if (e.name === 'AbortError') toast('Експорт скасовано');
    else toast('Помилка експорту: ' + (e.message || e), 'err', 7000);
  } finally { exporting = null; }
}
window.addEventListener('beforeunload', e => { if (exporting) { e.preventDefault(); e.returnValue = ''; } });

// ══════════ Автозбереження ══════════
let saveTimer = 0;
function setSaveState(t) { $('saveState').textContent = t; }
function saveNow() {
  clearTimeout(saveTimer);
  const list = [...media.values()].map(m => ({ id: m.id, name: m.name }));
  return Promise.all([DB.set('project', S.project), DB.set('mediaList', list)])
    .then(() => setSaveState('Збережено'))
    .catch(e => { console.warn(e); setSaveState('Не збережено'); });
}
function scheduleSave() { setSaveState('Зберігаємо…'); clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 700); }
on('project', d => { if (d && d.committed) scheduleSave(); });
on('media', scheduleSave);

async function restore() {
  let p = null, list = [];
  try { p = await DB.get('project'); list = (await DB.get('mediaList')) || []; } catch (e) { console.warn(e); }
  if (!p || !p.clips) return false;
  const missing = [];
  for (const { id, name } of list) {
    try {
      const blob = await DB.getBlob(id);
      if (!blob) { missing.push(name); continue; }
      await addMedia(blob, name, { id, persist: false });
    } catch (e) { missing.push(name); }
  }
  S.project = { ...newProject(), ...p };
  resetHistory();
  emit('project', { committed: true, restored: true });
  emit('aspect');
  if (S.project.clips.length || S.project.overlays.length) {
    toast(missing.length ? `Проєкт відновлено, але бракує файлів: ${missing.join(', ')}` : 'Проєкт відновлено з минулого разу', missing.length ? 'err' : 'ok', 4500);
    setSaveState('Збережено');
  }
  return true;
}

$('btnNew').addEventListener('click', async () => {
  if ((S.project.clips.length || media.size) && !(await confirmDialog('Почати новий проєкт?', 'Поточний проєкт і всі додані файли буде прибрано з редактора. Уже експортовані відео це не зачепить.', 'Новий проєкт'))) return;
  pause();
  [...media.keys()].forEach(removeMedia);
  S.project = newProject();
  S.sel = null; S.t = 0; clearMarks();
  resetHistory();
  emit('project', { committed: true });
  emit('select');
  emit('aspect');
  saveNow();
});

// файл, переданий з іншого інструмента (наприклад, «Запис екрану»)
async function takeHandoffIfAny() {
  const params = new URLSearchParams(location.search);
  if (!params.has('import')) return;
  history.replaceState(null, '', location.pathname);
  const item = await takeHandoff(params.get('import'));
  if (!item || !item.blob) { toast('Не знайшли переданий файл — додайте його вручну', 'err'); return; }
  try {
    const m = await addMedia(item.blob, item.name || 'запис-екрану.webm');
    addToTimeline(m, { silent: true });
    zoomFit();
    toast('Запис екрану відкрито — можна обрізати й доповнити', 'ok', 4000);
  } catch (e) { toast(e.message, 'err'); }
}

// маленькі екрани: панелі як висувні
$('btnShowLib').addEventListener('click', () => { document.body.classList.toggle('show-lib'); document.body.classList.remove('show-insp'); });
$('btnShowInsp').addEventListener('click', () => { document.body.classList.toggle('show-insp'); document.body.classList.remove('show-lib'); });
document.addEventListener('pointerdown', e => {
  if (!document.body.matches('.show-lib,.show-insp')) return;
  if (e.target.closest('.lib,.insp,#btnShowLib,#btnShowInsp,.overlay')) return;
  document.body.classList.remove('show-lib', 'show-insp');
});
if (window.matchMedia('(max-width: 980px)').matches) toast('Редактор найзручніший на комп’ютері з великим екраном', '', 4000);

(async () => {
  await restore();
  await takeHandoffIfAny();
  syncTitle(); syncEmpty(); syncTransport(); syncHistory(); fitStage();
  if (duration() > 0) zoomFit(); else setZoom(60, 0);
  requestDraw();
})();

// для автотестів
window.VideoCut = { S, media, seek, commit, exportVideo, exportAudio, duration, layout };

// ══════════ Прибрати паузи ══════════
const silOpt = { level: 'mid', minLen: 0.8 };
let silFound = [];
function silSeg(id, key, conv) {
  $(id).addEventListener('click', e => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    $(id).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    silOpt[key] = conv(b.dataset.v);
    analyzeSilences();
  });
}
silSeg('silLevel', 'level', v => v);
silSeg('silMin', 'minLen', Number);
function analyzeSilences() {
  const r = findSilences({ level: silOpt.level, minLen: silOpt.minLen, pad: 0.15 });
  silFound = r.list;
  S.silPreview = silFound;
  emit('silences');
  const total = silFound.reduce((a, [x, y]) => a + y - x, 0);
  let html;
  if (r.missing && !silFound.length) html = '<span class="warn">Звук ще аналізується — зачекайте кілька секунд і відкрийте це вікно знову.</span>';
  else if (!silFound.length) html = 'Пауз такої довжини не знайдено. Спробуйте коротшу паузу або сильніший режим.';
  else html = `Знайдено <b>${silFound.length}</b> ${silFound.length === 1 ? 'паузу' : silFound.length < 5 ? 'паузи' : 'пауз'} · разом <b>${fmt(total, true)}</b>. Відео стане <b>${fmt(mainEnd() - total, true)}</b> замість ${fmt(mainEnd(), true)}.`;
  $('silInfo').innerHTML = html;
  $('silApply').disabled = !silFound.length;
  $('silApply').lastChild.textContent = silFound.length ? `Прибрати ${silFound.length}` : 'Прибрати';
}
function openSilences() {
  if (!S.project.clips.length) { toast('Спочатку додайте відео'); return; }
  pause();
  openModal('silModal');
  analyzeSilences();
  if (duration() > 0) zoomFit();
}
function clearSilPreview() { if (S.silPreview) { S.silPreview = null; emit('silences'); } }
$('btnSilences').addEventListener('click', openSilences);
on('open-silences', openSilences);
$('silApply').addEventListener('click', () => {
  if (!silFound.length) return;
  const n = silFound.length;
  const total = cutRanges(silFound);
  silFound = [];
  closeModal('silModal');
  clearSilPreview();
  toast(`Прибрано ${n} ${n === 1 ? 'паузу' : n < 5 ? 'паузи' : 'пауз'} · ${fmt(total, true)}`, 'ok', 4000);
});
new MutationObserver(() => { if (!$('silModal').classList.contains('open')) clearSilPreview(); }).observe($('silModal'), { attributes: true, attributeFilter: ['class'] });

// ══════════ Озвучення (запис голосу) ══════════
let rec = null; // { recorder, stream, chunks, start, mime, t0, timer }
function openVoice() {
  if (rec) { stopVoice(); return; }
  if (!duration()) { toast('Спочатку додайте відео, яке будете озвучувати'); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { toast('Цей браузер не вміє записувати звук. Спробуйте Chrome або Edge.', 'err', 5000); return; }
  pause();
  if (S.t >= duration() - 0.5) seek(0);
  $('voFrom').textContent = fmt(S.t, true);
  $('voInfo').textContent = 'Браузер попросить дозвіл на мікрофон.';
  openModal('voModal');
}
on('open-voice', openVoice);
$('btnVoice').addEventListener('click', openVoice);
$('btnRecStop').addEventListener('click', () => stopVoice());
$('voStart').addEventListener('click', async () => {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    $('voInfo').innerHTML = '<span class="warn">Немає доступу до мікрофона. Дозвольте його в адресному рядку браузера й спробуйте ще раз.</span>';
    return;
  }
  closeModal('voModal');
  const mute = $('voMute').checked;
  // відлік 3-2-1
  const cnt = $('recCount');
  cnt.hidden = false;
  for (const n of [3, 2, 1]) { cnt.textContent = n; cnt.classList.remove('pop'); void cnt.offsetWidth; cnt.classList.add('pop'); await new Promise(r => setTimeout(r, 800)); }
  cnt.hidden = true;
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported(t)) || '';
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 128000 } : {});
  rec = { recorder, stream, chunks: [], start: S.t, mime: recorder.mimeType || mime, t0: performance.now() };
  recorder.ondataavailable = e => { if (e.data && e.data.size) rec.chunks.push(e.data); };
  recorder.start(250);
  S.recMute = mute;
  document.body.classList.add('recording');
  $('recBadge').hidden = false;
  rec.timer = setInterval(() => { $('recTime').textContent = fmt((performance.now() - rec.t0) / 1000); }, 200);
  play();
});
// відео дограло до кінця — завершуємо запис
on('play', () => { if (rec && !S.playing && !rec.stopping) stopVoice(); });

async function stopVoice() {
  if (!rec || rec.stopping) return;
  const r = rec;
  r.stopping = true;
  clearInterval(r.timer);
  const done = new Promise(res => { r.recorder.onstop = res; });
  try { r.recorder.stop(); } catch (e) { /* ignore */ }
  pause();
  await done;
  r.stream.getTracks().forEach(t => t.stop());
  S.recMute = false;
  document.body.classList.remove('recording');
  $('recBadge').hidden = true;
  rec = null;
  const blob = new Blob(r.chunks, { type: r.mime || 'audio/webm' });
  if (blob.size < 1000) { toast('Запис занадто короткий'); return; }
  const ext = /mp4/.test(r.mime) ? 'm4a' : /ogg/.test(r.mime) ? 'ogg' : 'webm';
  try {
    toast('Обробляємо запис…', '', 20000);
    const m = await addMedia(blob, `Голос ${fmt(r.start).replace(':', '-')}.${ext}`);
    addVoice(m, r.start);
    seek(r.start);
    toast('Голос додано на звукову доріжку. Відтворіть, щоб послухати', 'ok', 4500);
  } catch (e) {
    console.error(e);
    toast('Не вдалося зберегти запис: ' + (e.message || e), 'err', 6000);
  }
}
window.addEventListener('beforeunload', e => { if (rec) { e.preventDefault(); e.returnValue = ''; } });
