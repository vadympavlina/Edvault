// Аніматор · Edvault — покадрова анімація в браузері.
// Плівка кадрів, шари, калька, пензлі з натиском, звук, уроки, експорт у GIF, відео, PNG і спрайт-лист.
import { Project, History, SIZES } from './model.js';
import { store, setSize, trim, forgetAll, isBlank, Cell } from './cells.js';
import { Stage } from './stage.js';
import { BRUSHES, sampleStroke } from './paint.js';
import { LESSONS } from './lessons.js';
import { packProject, unpackProject, fileName, FILE_EXT, autosave, restore, clearAutosave, Audio, recordMic } from './io.js';
import { exportGif, exportVideo, exportPng, exportPngZip, exportSprite, videoType } from './export.js';
import { makeZip } from '../../../emulators/bloggeremu/js/zip.js';
import { download, pickFile } from '../../../emulators/shared/savefile.js';
import { $, $$, esc, icon, fillIcons, toast, modal, confirmBox, tips } from './ui.js';

const PALETTE = ['#1d2236', '#ffffff', '#e5484d', '#f97316', '#facc15', '#22c55e', '#0ea5e9', '#2337a8', '#8b5cf6', '#ec4899', '#8b5a2b', '#94a3b8'];
const COLOR_NAMES = { '#1d2236': 'Чорний', '#ffffff': 'Білий', '#e5484d': 'Червоний', '#f97316': 'Помаранчевий', '#facc15': 'Жовтий', '#22c55e': 'Зелений', '#0ea5e9': 'Блакитний', '#2337a8': 'Синій', '#8b5cf6': 'Фіолетовий', '#ec4899': 'Рожевий', '#8b5a2b': 'Коричневий', '#94a3b8': 'Сірий' };
const BGS = [['#ffffff', 'Білий'], ['#f4efe4', 'Папір'], ['#dff1ff', 'Небо'], ['#e3f6dc', 'Трава'], ['#fff1c2', 'Сонце'], ['#1c2869', 'Ніч'], ['#111111', 'Чорний']];
const TOOLS = [
  ['brush', 'Пензель', 'brush', 'B'], ['eraser', 'Гумка', 'eraser', 'E'], ['fill', 'Заливка', 'fill', 'G'], null,
  ['line', 'Лінія', 'line', 'L'], ['rect', 'Прямокутник', 'rect', 'R'], ['ellipse', 'Еліпс', 'ellipse', 'O'], ['lasso', 'Ласо-заливка — обведіть, і область заллється кольором', 'lasso', 'A'], null,
  ['select', 'Виділення — вирізати й перемістити частину малюнка', 'select', 'S'], ['picker', 'Піпетка — взяти колір з малюнка', 'picker', 'I'], ['hand', 'Рука — рухати аркуш', 'hand', 'H'],
];
const TOOL_NAMES = Object.fromEntries(TOOLS.filter(Boolean).map(t => [t[0], t[1].split(' — ')[0]]));
const UI_KEY = 'edvault-animator-ui';

/* ═════════ стан ═════════ */
const S = Object.assign({
  tool: 'brush', brush: 'pen', size: 6, opacity: 1, color: '#1d2236', recent: [], stabilizer: 0.3, symmetry: false,
  shapeFill: 'stroke', fillAll: true, fillTol: 40, fillGap: 0, eraserSoft: false, alphaLock: false, selMode: 'rect',
  onion: true, onionN: 1, onionAlpha: 0.5, loop: true,
}, loadUi(), { fi: 0, li: 1, playing: false, guides: true, refShow: true, refOpacity: 0.4 });
if (!BRUSHES[S.brush]) S.brush = 'pen';
function loadUi() { try { return JSON.parse(localStorage.getItem(UI_KEY)) || {}; } catch { return {}; } }
const UI_KEYS = ['tool', 'brush', 'size', 'sizes', 'opacity', 'color', 'recent', 'stabilizer', 'symmetry', 'shapeFill', 'fillAll', 'fillTol', 'fillGap', 'eraserSoft', 'selMode', 'onion', 'onionN', 'onionAlpha', 'loop'];
function saveUi() { try { localStorage.setItem(UI_KEY, JSON.stringify(Object.fromEntries(UI_KEYS.map(k => [k, S[k]])))); } catch { /* приватний режим */ } }

let P = null;
const hist = new History(80);
const audio = new Audio();
const app = {
  get P() { return P; }, S,
  refImg: null, refBlob: null, guides: null, playFrame: null,
  toast, pushPixels, changed, pickColor,
  undo: () => undo(), redo: () => redo(),
};
const stage = new Stage($('#view'), app);
window.Animator = { get P() { return P; }, S, stage, hist, app, audio };

/* ═════════ проєкт ═════════ */
function begin(project, extras = {}) {
  stop();
  P = project; forgetAll();
  setSize(P.w, P.h);
  hist.clear(); thumbs.clear();
  S.fi = Math.min(extras.ui?.fi ?? 0, P.frames.length - 1);
  S.li = Math.min(extras.ui?.li ?? Math.min(1, P.layers.length - 1), P.layers.length - 1);
  app.guides = P.lesson && LESSONS[P.lesson] ? LESSONS[P.lesson].guides(P.w, P.h) : null;
  setRef(extras.ref || null);
  if (extras.refMeta) { S.refShow = extras.refMeta.show !== false; S.refOpacity = extras.refMeta.opacity ?? 0.4; }
  audio.set(extras.audio || null).then(() => { renderSide(); renderFilm(); });
  stage.resetBuffers();
  stage.resize(); stage.fit();
  P.frames.forEach(f => stale.add(f.id));
  $('#lessonCard').classList.toggle('mini', !!P.lesson && innerWidth < 860);
  goFrame(S.fi, true);
  renderAll();
  saveSoon();
}
async function setRef(blob) {
  app.refBlob = blob; app.refImg = null;
  if (blob) try { app.refImg = await createImageBitmap(blob); } catch { app.refBlob = null; }
  stage.render(); renderSide();
}
function newProject(o) {
  const p = new Project(store, o);
  if (o.lesson) {
    const L = LESSONS[o.lesson];
    p.fps = L.fps; p.lesson = o.lesson; p.title = o.title || L.title;
    while (p.frames.length < L.frames) p.addFrame();
    p.layers[0].name = 'Фон'; p.layers[1].name = 'Малюнок';
  }
  return p;
}

/* ═════════ історія ═════════ */
function pushPixels(step) {
  step.fi = S.fi; step.li = S.li;
  hist.push(step);
  stale.add(step.frameId);
  if (S.tool !== 'eraser' && S.tool !== 'select' && !S.recent.includes(S.color)) { S.recent = [S.color, ...S.recent].slice(0, 6); renderProp(); }
  touched();
}
function struct(fn) {
  stage.commitFloat();
  const before = P.structSnapshot(), fi0 = S.fi, li0 = S.li;
  const r = fn();
  if (r === false) return false;
  hist.push({ kind: 'struct', before, after: P.structSnapshot(), fi0, li0, fi1: S.fi, li1: S.li });
  afterStruct();
  return r;
}
function afterStruct() {
  S.fi = Math.max(0, Math.min(S.fi, P.frames.length - 1));
  S.li = Math.max(0, Math.min(S.li, P.layers.length - 1));
  P.frames.forEach(f => { if (!thumbs.has(f.id)) stale.add(f.id); });
  stage.rebuild(); stage.prepare();
  renderAll(); touched();
}
let busy = Promise.resolve();
function applyStep(step, dir) {
  busy = busy.then(async () => {
    if (step.kind === 'px') {
      const c = step.cell;
      if (c.blob && !c.canvas) await c.load();
      const g = c.draw().getContext('2d', { willReadFrequently: true });
      g.putImageData(dir === 'undo' ? step.before : step.after, step.x, step.y);
      c.empty = isBlank(c.canvas);
      stale.add(step.frameId);
      const fi = P.frameIndex(step.frameId), li = P.layers.findIndex(l => l.id === step.layerId);
      if (fi >= 0 && fi !== S.fi) { S.fi = fi; await goFrame(fi); }
      if (li >= 0 && li !== S.li) { S.li = li; renderSide(); }
      stage.rebuild();
    } else {
      P.restoreStruct(dir === 'undo' ? step.before : step.after);
      S.fi = dir === 'undo' ? step.fi0 : step.fi1; S.li = dir === 'undo' ? step.li0 : step.li1;
      afterStruct();
    }
    touched(); renderTop();
  });
  return busy;
}
function undo() { if (S.playing) stop(); if (stage.float) { stage.commitFloat(); } hist.undo(applyStep); renderTop(); }
function redo() { if (S.playing) stop(); hist.redo(applyStep); renderTop(); }

/* ═════════ зміни й автозбереження ═════════ */
let saveT = 0;
function touched() { $('#saveDot').classList.add('dirty'); saveSoon(); scheduleThumbs(); renderTop(); }
function saveSoon() { clearTimeout(saveT); saveT = setTimeout(saveNow, 1200); }
async function saveNow() {
  if (!P) return;
  try {
    await autosave(P, { audio: audio.blob, ref: app.refBlob, ui: { fi: S.fi, li: S.li } });
    $('#saveDot').classList.remove('dirty');
  } catch (e) { console.warn('Аніматор: автозбереження не вдалося', e); }
}
function changed(kind) {
  if (kind === 'zoom') $('#zoomVal').textContent = Math.round(stage.view.z * 100) + '%';
  if (kind === 'float' || kind === 'tool') { renderProp(); renderRail(); }
}
function pickColor(c) { S.color = c; saveUi(); renderProp(); toast('Колір узято з малюнка', ''); if (S.tool === 'picker') setTool('brush'); }

/* ═════════ мініатюри кадрів ═════════ */
const thumbs = new Map(), stale = new Set();
let thumbT = 0;
function scheduleThumbs() { clearTimeout(thumbT); thumbT = setTimeout(updateThumbs, 160); }
async function updateThumbs() {
  if (!P) return;
  for (const id of [...stale]) {
    const fi = P.frameIndex(id); stale.delete(id);
    if (fi < 0) { thumbs.delete(id); continue; }
    const f = P.frames[fi];
    await Promise.all(P.layers.map(l => { const c = l.cells.get(f.id); return c && c.blob && !c.canvas ? c.load() : null; }));
    let t = thumbs.get(id);
    if (!t) { t = document.createElement('canvas'); thumbs.set(id, t); }
    const tw = 264, th = Math.round(264 * P.h / P.w);
    if (t.width !== tw || t.height !== th) { t.width = tw; t.height = th; }
    stage.composeFrame(fi, t, { withBg: true });
  }
  renderFilm(); renderLayerThumbs();
}

/* ═════════ кадри й шари ═════════ */
async function goFrame(i, force) {
  if (!P) return;
  i = Math.max(0, Math.min(P.frames.length - 1, i));
  if (i === S.fi && !force) return;
  stage.commitFloat();
  S.fi = i;
  stage.rebuild();
  renderTransport(); markFilm(); renderLayerThumbs(); renderLesson();
  await stage.prepare(); stage.rebuild();
  const keep = new Set(); for (let k = -S.onionN; k <= S.onionN; k++) { const f = P.frames[i + k]; if (f) P.layers.forEach(l => { const c = l.cells.get(f.id); if (c) keep.add(c); }); }
  trim(keep);
}
function selectLayer(i) { stage.commitFloat(); S.li = i; stage.rebuild(); renderSide(); }
const addFrame = (empty = true) => struct(() => { const f = empty ? P.addFrame(S.fi + 1) : P.duplicateFrame(S.fi); if (!f) { toast('Досягнуто ліміту кадрів', 'bad'); return false; } S.fi += 1; stale.add(f.id); });
const delFrame = i => struct(() => { if (!P.deleteFrame(i)) { toast('Останній кадр видалити не можна', 'bad'); return false; } if (S.fi >= i && S.fi > 0) S.fi--; });

/* ═════════ програвання ═════════ */
let playT = 0, playList = null, playSig = '';
const cellIds = new WeakMap(); let cellSeq = 0;
const cid = c => { if (!cellIds.has(c)) cellIds.set(c, ++cellSeq); return cellIds.get(c); };
function signature() { return P.bg + '|' + P.w + 'x' + P.h + '|' + P.frames.map(f => f.id + ':' + P.layers.map(l => { const c = l.cells.get(f.id); return (l.visible ? 1 : 0) + ',' + l.opacity + ',' + (c ? cid(c) + '.' + c.rev : '-'); }).join(';')).join('/'); }
async function play() {
  if (S.playing || !P) return;
  stage.commitFloat();
  const sig = signature();
  if (sig !== playSig || !playList) {
    const busyToast = P.frames.length > 24; if (busyToast) toast('Готуємо перегляд…', '');
    const scale = Math.min(1, Math.sqrt(160e6 / (P.frames.length * P.w * P.h * 4)));
    const out = [];
    for (let i = 0; i < P.frames.length; i++) {
      const f = P.frames[i];
      await Promise.all(P.layers.map(l => { const c = l.cells.get(f.id); return c && c.blob && !c.canvas ? c.load() : null; }));
      const cv = document.createElement('canvas'); cv.width = Math.round(P.w * scale); cv.height = Math.round(P.h * scale);
      stage.composeFrame(i, cv);
      out.push(await createImageBitmap(cv));
      if (i % 10 === 9) await trim();
    }
    if (playList) playList.forEach(b => b.close && b.close());
    playList = out; playSig = sig;
  }
  S.playing = true; renderTransport(); stage.rebuild();
  const start = S.fi >= P.frames.length - 1 ? 0 : S.fi;
  let unit0 = P.startUnit(start), t0 = performance.now();
  if (audio.buf) { await audio.ac.resume(); audio.play(unit0 / P.fps); }
  const total = P.totalUnits;
  const tick = () => {
    if (!S.playing) return;
    let u = unit0 + (performance.now() - t0) / 1000 * P.fps;
    if (u >= total) {
      if (!S.loop) { stop(); goFrame(P.frames.length - 1, true); return; }
      unit0 = 0; t0 = performance.now(); u = 0;
      if (audio.buf) audio.play(0);
    }
    const fi = P.frameAt(Math.floor(u));
    if (fi !== app.playIndex) { app.playIndex = fi; app.playFrame = playList[fi]; stage.render(); markFilm(fi); $('#count').innerHTML = countText(fi); }
    playT = requestAnimationFrame(tick);
  };
  app.playIndex = -1; tick();
}
function stop() {
  if (!S.playing) return;
  S.playing = false; cancelAnimationFrame(playT); audio.stop();
  const at = app.playIndex >= 0 ? app.playIndex : S.fi;
  app.playFrame = null;
  goFrame(at, true); renderTransport();
}
const togglePlay = () => S.playing ? stop() : play();

/* ═════════ малювання верхньої панелі ═════════ */
function renderTop() {
  if (!P) return;
  const t = $('#title'); if (document.activeElement !== t) t.value = P.title;
  $('#bUndo').disabled = !hist.canUndo; $('#bRedo').disabled = !hist.canRedo;
  $('#themeIco').innerHTML = icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon');
}
function renderRail() {
  $('#rail').innerHTML = TOOLS.map(t => t ? `<button class="tool ${S.tool === t[0] ? 'on' : ''}" data-tool="${t[0]}" data-tip="${esc(t[1])}" data-kbd="${t[3]}" aria-label="${esc(t[1])}" aria-pressed="${S.tool === t[0]}">${icon(t[2], 20)}<span class="key">${t[3]}</span></button>` : '<span class="rail-sep"></span>').join('');
}
const seg = (k, items, cur) => `<span class="seg" role="group">${items.map(([v, t, tip]) => `<button data-set="${k}" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}" ${tip ? `data-tip="${esc(tip)}"` : ''}>${t}</button>`).join('')}</span>`;
const range = (k, min, max, step, val, fmt = v => v) => `<span class="rng"><input type="range" data-range="${k}" min="${min}" max="${max}" step="${step}" value="${val}" aria-label="${k}"><b data-out="${k}">${fmt(val)}</b></span>`;
function colors() {
  const custom = !PALETTE.includes(S.color);
  return `<span class="pg"><span class="sws">${PALETTE.map(c => `<button class="sw ${S.color === c ? 'on' : ''}" data-color="${c}" style="background:${c}" aria-label="${COLOR_NAMES[c]}" data-tip="${COLOR_NAMES[c]}"></button>`).join('')}<button class="sw sw-custom ${custom ? 'on' : ''}" ${custom ? `style="background:${S.color}"` : ''} data-act="colorPick" data-tip="Свій колір" aria-label="Свій колір"></button></span>${S.recent.filter(c => !PALETTE.includes(c)).length ? `<span class="sws" aria-label="Нещодавні кольори">${S.recent.filter(c => !PALETTE.includes(c)).slice(0, 4).map(c => `<button class="sw ${S.color === c ? 'on' : ''}" data-color="${c}" style="background:${c}" aria-label="Нещодавній колір ${c}"></button>`).join('')}</span>` : ''}</span>`;
}
function renderProp() {
  const t = S.tool, el = $('#prop'), toolIco = (TOOLS.find(x => x && x[0] === t) || [])[2];
  let h = `<span class="ttl">${icon(toolIco || 'brush', 16)}<span>${esc(TOOL_NAMES[t] || '')}</span></span>`;
  const pct = v => Math.round(v * 100) + '%';
  const lockBtn = `<button class="tg ${S.alphaLock ? 'on' : ''}" data-toggle="alphaLock" data-tip="Фарба лягає лише там, де на шарі вже намальовано, — для тіней, відблисків і візерунків">${icon('drop', 15)}Лише по малюнку</button>`;
  if (t === 'brush') {
    const B = BRUSHES[S.brush];
    h += `<span class="pg"><button class="brush-btn" id="brushBtn" data-act="brushPick" aria-haspopup="menu" data-tip="${esc(B.desc)}"><canvas width="112" height="36" aria-hidden="true"></canvas><b>${esc(B.t)}</b>${icon('down', 14)}</button></span>`;
    h += `<span class="pg"><span class="pl">Розмір</span>${range('size', 1, 80, 1, S.size)}</span>`;
    h += `<span class="pg"><span class="pl">Прозорість</span>${range('opacity', 0.1, 1, 0.05, S.opacity, pct)}</span>`;
    h += colors();
    h += `<span class="pg"><button class="tg ${S.stabilizer > 0 ? 'on' : ''}" data-toggle="stabilizer" data-tip="Пензель іде за курсором «на нитці» — лінії рівні, без тремтіння руки">${icon('wave', 15)}Плавно</button><button class="tg ${S.symmetry ? 'on' : ''}" data-toggle="symmetry" data-tip="Дзеркальне малювання: ліва половина повторює праву">${icon('sym', 15)}Дзеркало</button>${lockBtn}</span>`;
  } else if (t === 'eraser') {
    h += `<span class="pg"><span class="pl">Розмір</span>${range('size', 2, 120, 1, S.size)}</span>`;
    h += `<span class="pg">${seg('eraserSoft', [[false, 'Тверда'], [true, 'М’яка', 'Стирає м’яко, з розмитим краєм']], S.eraserSoft)}</span>`;
    h += `<span class="hint">Стирає лише на вибраному шарі</span>`;
  } else if (t === 'fill') {
    h += colors();
    h += `<span class="pg"><span class="pl">Межі</span>${seg('fillAll', [[true, 'Усі шари', 'Заливає область, обведену на будь-якому видимому шарі'], [false, 'Цей шар']], S.fillAll)}</span>`;
    h += `<span class="pg"><span class="pl">Щілини</span>${seg('fillGap', [[0, 'Ні'], [3, 'Малі', 'Не витікає крізь маленькі щілини в контурі'], [7, 'Великі', 'Не витікає навіть крізь помітні розриви в контурі']], S.fillGap)}</span>`;
    h += `<span class="pg"><span class="pl">Точність</span>${seg('fillTol', [[16, 'Точно'], [40, 'Звичайно'], [90, 'Широко']], S.fillTol)}</span>`;
    h += `<span class="pg">${lockBtn}</span>`;
  } else if (['line', 'rect', 'ellipse'].includes(t)) {
    if (t !== 'line') h += `<span class="pg">${seg('shapeFill', [['stroke', 'Контур'], ['fill', 'Заливка']], S.shapeFill)}</span>`;
    h += `<span class="pg"><span class="pl">Товщина</span>${range('size', 1, 60, 1, S.size)}</span>`;
    h += `<span class="pg"><span class="pl">Прозорість</span>${range('opacity', 0.1, 1, 0.05, S.opacity, pct)}</span>`;
    h += colors();
    h += `<span class="hint">Shift — ${t === 'line' ? 'кут кратний 15°' : t === 'rect' ? 'квадрат' : 'коло'}</span>`;
  } else if (t === 'lasso') {
    h += `<span class="pg"><span class="pl">Прозорість</span>${range('opacity', 0.1, 1, 0.05, S.opacity, pct)}</span>`;
    h += colors();
    h += `<span class="pg">${lockBtn}</span>`;
    h += `<span class="hint">Обведіть область — вона заллється кольором</span>`;
  } else if (t === 'select') {
    if (stage.float) {
      h += `<span class="pg"><button class="tg" data-float="flip" data-tip="Віддзеркалити зліва направо">${icon('flip', 15)}Дзеркально</button><button class="tg" data-float="flipV" data-tip="Перевернути догори дриґом">${icon('flipV', 15)}Догори</button><button class="tg" data-float="rot90" data-tip="Повернути на 90°">${icon('rotate', 15)}90°</button></span>`;
      h += `<span class="pg"><button class="tg" data-float="copy">${icon('copy', 15)}Копіювати</button><button class="tg" data-float="del">${icon('trash', 15)}Видалити</button><button class="tg on" data-float="done">${icon('check', 15)}Готово</button></span>`;
      h += `<span class="hint">Кружечок угорі — повернути (Shift — по 15°), квадратик — розмір</span>`;
    } else {
      h += `<span class="pg">${seg('selMode', [['rect', 'Рамка'], ['lasso', 'Ласо', 'Обвести довільну форму — наприклад, лише руку героя']], S.selMode)}</span>`;
      h += `<span class="hint">Обведіть частину малюнка, щоб перемістити, повернути чи скопіювати її на інший кадр. Ctrl+V — вставити</span>`;
    }
  } else if (t === 'picker') h += colors() + `<span class="hint">Клацніть на малюнку — колір стане поточним. З пензлем: Alt+клік</span>`;
  else if (t === 'hand') h += `<span class="hint">Тягніть аркуш. Коліщатко — масштаб, F — вписати в екран</span>`;
  el.innerHTML = h;
  const bb = $('#brushBtn canvas'); if (bb) { bb.width = 224; bb.height = 72; sampleStroke(bb, BRUSHES[S.brush], S.color, 26); }
}

/* ═════════ бокова панель ═════════ */
function renderSide() {
  if (!P) return;
  const lay = P.layers.map((l, i) => ({ l, i })).reverse();
  const L = P.layers[S.li];
  $('#side').innerHTML = `
  <section class="sec"><h3>${icon('layers', 16)}Шари<span class="grow"></span><span class="muted" style="font-size:12px;font-weight:500">${P.layers.length} з 8</span></h3>
    <div class="layers">${lay.map(({ l, i }) => `<div class="lr ${i === S.li ? 'on' : ''} ${l.visible ? '' : 'hidden-l'}" data-layer="${i}">
      <button class="ib ${l.visible ? '' : 'off'}" data-lvis="${i}" aria-label="${l.visible ? 'Сховати' : 'Показати'} шар" data-tip="${l.visible ? 'Сховати шар' : 'Показати шар'}">${icon(l.visible ? 'eye' : 'eyeOff', 16)}</button>
      <canvas class="lt" data-lthumb="${i}" width="112" height="64"></canvas>
      <span class="ln" data-lname="${i}" title="Двічі клацніть, щоб перейменувати">${esc(l.name)}</span>
      <button class="ib ${l.locked ? 'off' : ''}" data-llock="${i}" aria-label="${l.locked ? 'Розблокувати' : 'Заблокувати'} шар" data-tip="${l.locked ? 'Розблокувати' : 'Заблокувати, щоб випадково не змінити'}">${icon(l.locked ? 'lock' : 'unlock', 15)}</button></div>`).join('')}</div>
    <div class="lbar">
      <button class="ib" data-act="layerAdd" data-tip="Новий шар" aria-label="Новий шар">${icon('plus', 16)}</button>
      <button class="ib" data-act="layerDup" data-tip="Дублювати шар з усіма кадрами" aria-label="Дублювати шар">${icon('dup', 16)}</button>
      <button class="ib" data-act="layerUp" data-tip="Вище" aria-label="Шар вище">${icon('up', 16)}</button>
      <button class="ib" data-act="layerDown" data-tip="Нижче" aria-label="Шар нижче">${icon('down', 16)}</button>
      <button class="ib" data-act="layerRename" data-tip="Перейменувати" aria-label="Перейменувати шар">${icon('rename', 16)}</button>
      <span class="grow"></span>
      <button class="ib" data-act="layerDel" data-tip="Видалити шар" aria-label="Видалити шар">${icon('trash', 16)}</button>
    </div>
    ${L ? `<label class="field"><span>Прозорість шару «${esc(L.name)}»</span>${range('layerOpacity', 0.1, 1, 0.05, L.opacity, v => Math.round(v * 100) + '%')}</label>` : ''}
  </section>
  <section class="sec"><h3>${icon('onion', 16)}Калька<span class="grow"></span><button class="tg ${S.onion ? 'on' : ''}" data-toggle="onion" data-kbd="K">${S.onion ? 'Увімкнено' : 'Вимкнено'}</button></h3>
    <div class="field"><span>Скільки кадрів показувати</span>${seg('onionN', [[1, '1'], [2, '2'], [3, '3']], S.onionN)}</div>
    <label class="field"><span>Яскравість</span>${range('onionAlpha', 0.15, 0.8, 0.05, S.onionAlpha, v => Math.round(v * 100) + '%')}</label>
    <p class="sm">Попередній кадр — червонуватий, наступний — зеленуватий. Так видно, куди рухається малюнок.</p>
  </section>
  <section class="sec"><h3>${icon('image', 16)}Аркуш</h3>
    <div class="field"><span>Колір тла</span><div class="bgs">${BGS.map(([c, n]) => `<button class="${P.bg === c ? 'on' : ''}" data-bg="${c}" style="background:${c}" aria-label="${n}" data-tip="${n}"></button>`).join('')}<label class="sw sw-custom" style="border-radius:5px" data-tip="Свій колір тла"><input type="color" data-bgcustom value="${P.bg}" aria-label="Свій колір тла"></label></div></div>
    <div class="field"><span>Картинка-зразок</span>${app.refImg ? `<div class="row"><button class="tg ${S.refShow ? 'on' : ''}" data-toggle="refShow">${S.refShow ? 'Видно' : 'Сховано'}</button>${range('refOpacity', 0.1, 1, 0.05, S.refOpacity, v => Math.round(v * 100) + '%')}<button class="ib" data-act="refDel" aria-label="Прибрати зразок" data-tip="Прибрати зразок">${icon('trash', 15)}</button></div>` : `<button class="btn outline" data-act="refAdd" style="width:100%">${icon('image', 16)}Додати картинку</button>`}
      <p class="sm">Зразок видно лише під час малювання — у мультфільм він не потрапляє. Зручно обводити фото чи ескіз.</p></div>
  </section>
  <section class="sec"><h3>${icon('music', 16)}Звук</h3>
    ${audio.blob ? `<div class="audio-box">${icon('music', 16)}<b>${esc(P.audio?.name || 'Звук')}</b><span>${fmtTime(audio.duration)}</span><button class="ib" data-act="audioDel" aria-label="Прибрати звук" data-tip="Прибрати звук">${icon('trash', 15)}</button></div>
      ${audio.duration > P.duration + 0.05 ? `<p class="sm">Звук довший за мультфільм (${fmtTime(P.duration)}). У відео потрапить лише частина — або додайте кадрів.</p>` : ''}`
    : `<div class="btns"><button class="btn outline" data-act="audioAdd">${icon('music', 16)}Музика з файлу</button><button class="btn outline" data-act="audioRec">${icon('mic', 16)}Записати голос</button></div>
       <p class="sm">Звук грає під час перегляду й потрапляє у відео.</p>`}
  </section>
  <section class="sec"><h3>${icon('film', 16)}Про мультфільм</h3>
    <p class="sm">Аркуш ${P.w} × ${P.h}. ${P.frames.length} ${plural(P.frames.length, 'кадр', 'кадри', 'кадрів')}, тривалість ${fmtTime(P.duration)}.</p>
  </section>`;
  renderLayerThumbs();
}
function renderLayerThumbs() {
  if (!P) return;
  const f = P.frames[S.fi];
  $$('[data-lthumb]').forEach(cv => {
    const l = P.layers[+cv.dataset.lthumb], c = l && l.cells.get(f.id), v = c && c.view(), g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    if (v) g.drawImage(v, 0, 0, cv.width, cv.height);
  });
}

/* ═════════ керування програванням і плівка ═════════ */
const fmtTime = s => { s = Math.max(0, s); const m = Math.floor(s / 60), r = s - m * 60; return (m ? m + ':' + String(Math.floor(r)).padStart(2, '0') : r.toFixed(1).replace('.', ',')) + (m ? '' : ' с'); };
const plural = (n, a, b, c) => { const m = n % 100, k = n % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k >= 2 && k <= 4 ? b : c; };
const countText = fi => `<span class="hide-sm">Кадр </span>${fi + 1} з ${P.frames.length}<span class="muted"> · ${fmtTime(P.startUnit(fi) / P.fps).replace(' с', '')} / ${fmtTime(P.duration)}</span>`;
function renderTransport() {
  if (!P) return;
  $('#transport').innerHTML = `
    <button class="ib" data-act="first" aria-label="На початок" data-tip="На початок" data-kbd="Home">${icon('first', 18)}</button>
    <button class="ib" data-act="prev" aria-label="Попередній кадр" data-tip="Попередній кадр" data-kbd=",">${icon('prev', 18)}</button>
    <button class="play" data-act="play" aria-label="${S.playing ? 'Зупинити' : 'Грати'}" data-tip="${S.playing ? 'Зупинити' : 'Грати'}" data-kbd="Пробіл">${icon(S.playing ? 'pause' : 'play', 18)}</button>
    <button class="ib" data-act="next" aria-label="Наступний кадр" data-tip="Наступний кадр" data-kbd=".">${icon('next', 18)}</button>
    <button class="ib" data-act="last" aria-label="У кінець" data-tip="У кінець" data-kbd="End">${icon('last', 18)}</button>
    <span class="count" id="count">${countText(S.fi)}</span>
    <span class="grow"></span>
    <label class="row" style="gap:6px;font-size:12.5px" data-tip="Скільки кадрів показується за секунду"><span class="hide-sm">Швидкість</span><select data-fps aria-label="Кадрів на секунду">${[2, 4, 6, 8, 10, 12, 15, 24].map(v => `<option value="${v}" ${P.fps === v ? 'selected' : ''}>${v} кадр/с</option>`).join('')}</select></label>
    <button class="tg ${S.loop ? 'on' : ''}" data-toggle="loop" data-tip="Грати по колу">${icon('loop', 15)}<span class="hide-sm">По колу</span></button>
    <button class="tg ${S.onion ? 'on' : ''}" data-toggle="onion" data-tip="Калька: бачити сусідні кадри" data-kbd="K">${icon('onion', 15)}<span class="hide-sm">Калька</span></button>
    ${app.guides ? `<button class="tg ${S.guides ? 'on' : ''}" data-toggle="guides" data-tip="Напрямні уроку">${icon('lesson', 15)}<span class="hide-sm">Напрямні</span></button>` : ''}`;
}
function renderFilm() {
  if (!P) return;
  const film = $('#film');
  const left = film.scrollLeft;
  film.innerHTML = `<div class="frames">${P.frames.map((f, i) => `<div class="fr ${i === S.fi ? 'on' : ''}" data-frame="${i}" role="button" tabindex="0" aria-label="Кадр ${i + 1}${f.hold > 1 ? ', триває ×' + f.hold : ''}"><span class="no">${i + 1}</span>${f.hold > 1 ? `<span class="hold">×${f.hold}</span>` : ''}</div>`).join('')}
    <button class="fadd" data-act="addFrame" data-tip="Новий порожній кадр після поточного" data-kbd="N">${icon('plus', 20)}Новий</button>
    <button class="fadd" data-act="dupFrame" data-tip="Копія поточного кадру — далі змініть трохи" data-kbd="D">${icon('dup', 20)}Копія</button></div>
    ${audio.buf ? '<canvas class="wave" id="wave"></canvas>' : ''}`;
  $$('.fr', film).forEach(el => { const f = P.frames[+el.dataset.frame], t = thumbs.get(f.id); if (t) el.prepend(t); });
  film.scrollLeft = left;
  drawWave();
  markFilm();
}
function drawWave() {
  const cv = $('#wave'); if (!cv || !audio.buf) return;
  const frames = $('.frames'), w = frames.scrollWidth, unitW = 138, pxPerSec = unitW * P.fps;
  const width = Math.min(w, Math.round(audio.duration * pxPerSec)); cv.width = Math.max(1, width); cv.height = 12; cv.style.width = width + 'px';
  const g = cv.getContext('2d'), pk = audio.peaks(Math.max(1, Math.floor(width / 3)));
  g.fillStyle = '#ffe34d';
  pk.forEach((v, i) => { const hh = Math.max(1, v * 12); g.fillRect(i * 3, 12 - hh, 2, hh); });
}
function markFilm(playing) {
  $$('.fr').forEach(el => { const i = +el.dataset.frame; el.classList.toggle('on', playing == null && i === S.fi); el.classList.toggle('play', playing != null && i === playing); });
  const cur = $(`.fr[data-frame="${playing ?? S.fi}"]`), film = $('#film');
  if (cur) { const r = cur.offsetLeft, w = cur.offsetWidth; if (r < film.scrollLeft + 20 || r + w > film.scrollLeft + film.clientWidth - 20) film.scrollLeft = r - film.clientWidth / 2 + w / 2; }
}
function renderLesson() {
  const card = $('#lessonCard'), L = P && P.lesson && LESSONS[P.lesson];
  if (!L) { card.hidden = true; fitInset(); return; }
  card.hidden = false;
  const step = Math.min(L.steps.length - 1, S.fi === 0 ? 0 : S.fi < 2 ? 1 : S.fi < P.frames.length / 2 ? 2 : 3);
  card.innerHTML = `<h3>${esc(L.title)}</h3><p class="goal">${esc(L.goal)}</p><ol>${L.steps.map((s, i) => `<li class="${i === step ? 'now' : ''}">${esc(s)}</li>`).join('')}</ol>
    <div class="row"><button class="tg" data-act="lessonMin">${card.classList.contains('mini') ? 'Показати кроки' : 'Згорнути'}</button><button class="tg" data-act="lessonEnd" data-tip="Сховати напрямні й картку уроку">Завершити урок</button></div>`;
  fitInset();
}
// картка уроку не повинна затуляти аркуш: на широкому екрані — місце ліворуч, на вузькому — знизу
function fitInset() {
  const card = $('#lessonCard'), wide = stage.W >= 860;
  const inset = card.hidden ? { l: 0, b: 0 } : wide ? { l: card.offsetWidth + 14, b: 0 } : { l: 0, b: card.offsetHeight + 10 };
  const old = stage.inset || { l: 0, b: 0 };
  if (old.l === inset.l && old.b === inset.b) return;
  stage.inset = inset; stage.fit();
}
function renderAll() { renderTop(); renderRail(); renderProp(); renderSide(); renderTransport(); renderFilm(); renderLesson(); }

/* ═════════ меню ═════════ */
const pop = $('#pop'); let popAnchor = null, popPick = null;
function openPop(anchor, html, pick, at) {
  if (popAnchor === anchor && pop.classList.contains('on')) { closePop(); return; }
  if (pop.classList.contains('on')) closePop();
  popAnchor = anchor; popPick = pick;
  pop.innerHTML = html; pop.classList.add('on');
  const r = at || anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  let y = (r.bottom ?? r.y) + 6; if (y + h > innerHeight - 8) y = (r.top ?? r.y) - h - 6;
  pop.style.top = Math.max(8, y) + 'px'; pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left ?? r.x)) + 'px';
  pop.querySelector('button')?.focus();
}
let popClose = null;
function closePop() { pop.classList.remove('on'); popAnchor = null; const f = popClose; popClose = null; if (f) f(); }
pop.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b && popPick) { const f = popPick; closePop(); f(b.dataset.v); } });
document.addEventListener('mousedown', e => { if (pop.classList.contains('on') && !pop.contains(e.target) && !(popAnchor && popAnchor.contains && popAnchor.contains(e.target))) closePop(); });
const mi = (v, ic, t, sub, k, cls = '') => `<button class="mi ${cls}" data-v="${v}" role="menuitem">${icon(ic, 16)}<span>${esc(t)}${sub ? `<small>${esc(sub)}</small>` : ''}</span>${k ? `<span class="k">${k}</span>` : ''}</button>`;
function fileMenu(el) {
  openPop(el, mi('new', 'plus', 'Новий мультфільм…', 'Розмір аркуша, назва, автор') + mi('open', 'open', 'Відкрити файл…', 'Файл ' + FILE_EXT + ' з комп’ютера', 'Ctrl+O') + mi('save', 'save', 'Зберегти у файл', 'Усе: кадри, шари, звук — щоб продовжити пізніше чи здати вчителю', 'Ctrl+S'), v => {
    if (v === 'new') startDialog(); if (v === 'open') openFile(); if (v === 'save') saveFile();
  });
}
function frameMenu(i, at) {
  goFrame(i);
  const f = P.frames[i];
  openPop({ getBoundingClientRect: () => at, contains: () => false }, mi('dup', 'dup', 'Дублювати кадр', '', 'D') + mi('empty', 'plus', 'Новий порожній після', '', 'N') +
    '<div class="msep"></div>' + [1, 2, 3, 4].map(n => mi('hold' + n, 'clock', n === 1 ? 'Звичайна тривалість' : `Довше в ${n} рази`, n === 1 ? '' : `Кадр показується як ${n}`, '', f.hold === n ? 'on' : '')).join('') +
    '<div class="msep"></div>' + mi('left', 'prev', 'Посунути ліворуч') + mi('right', 'next', 'Посунути праворуч') + '<div class="msep"></div>' + mi('del', 'trash', 'Видалити кадр', '', '', 'danger'), v => {
    if (v === 'dup') addFrame(false);
    else if (v === 'empty') addFrame(true);
    else if (v.startsWith('hold')) struct(() => P.setHold(i, +v.slice(4)));
    else if (v === 'left' && i > 0) struct(() => { P.moveFrame(i, i - 1); S.fi = i - 1; });
    else if (v === 'right' && i < P.frames.length - 1) struct(() => { P.moveFrame(i, i + 1); S.fi = i + 1; });
    else if (v === 'del') delFrame(i);
  }, at);
}

function brushMenu(el) {
  openPop(el, `<div class="brush-list">${Object.entries(BRUSHES).map(([k, B]) => `<button class="mi brush-mi ${S.brush === k ? 'on' : ''}" data-v="${k}" role="menuitem"><canvas data-bs="${k}" width="240" height="64" aria-hidden="true"></canvas><span>${esc(B.t)}<small>${esc(B.desc)}</small></span></button>`).join('')}</div>`, v => { S.brush = v; saveUi(); renderProp(); stage.render(); });
  $$('[data-bs]', pop).forEach(cv => sampleStroke(cv, BRUSHES[cv.dataset.bs], S.color === '#ffffff' ? '#1d2236' : S.color, 22));
}
// Свій колір: квадрат насиченості й яскравості, смуга відтінку, HEX
const hex2hsv = hex => { const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx]; };
const hsv2hex = (h, s, v) => { const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return '#' + [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); };
function colorMenu(el) {
  let [h, sat, val] = hex2hsv(S.color);
  openPop(el, `<div class="hsv"><div class="sv-wrap"><canvas class="sv" width="232" height="150" aria-label="Насиченість і яскравість"></canvas><i class="sv-dot"></i></div>
    <input type="range" class="hue" min="0" max="359" step="1" aria-label="Відтінок">
    <div class="row"><span class="hsv-prev"></span><input class="inp hex" maxlength="7" aria-label="Колір HEX" spellcheck="false"><button class="btn primary" data-v="ok">Готово</button></div></div>`, () => {});
  const cv = $('.sv', pop), dot = $('.sv-dot', pop), hue = $('.hue', pop), hex = $('.hex', pop), prev = $('.hsv-prev', pop), g = cv.getContext('2d');
  const paint = () => {
    g.fillStyle = hsv2hex(h, 1, 1); g.fillRect(0, 0, cv.width, cv.height);
    const wg = g.createLinearGradient(0, 0, cv.width, 0); wg.addColorStop(0, '#fff'); wg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = wg; g.fillRect(0, 0, cv.width, cv.height);
    const bg = g.createLinearGradient(0, 0, 0, cv.height); bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(1, '#000'); g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height);
  };
  const sync = (fromHex) => {
    S.color = hsv2hex(h, sat, val);
    dot.style.left = sat * 100 + '%'; dot.style.top = (1 - val) * 100 + '%'; dot.style.background = S.color;
    prev.style.background = S.color; if (!fromHex) hex.value = S.color; hue.value = Math.round(h);
    const sw = $('.sw-custom'); if (sw) sw.style.background = PALETTE.includes(S.color) ? '' : S.color;
  };
  paint(); sync();
  const at = e => { const r = cv.getBoundingClientRect(); sat = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); val = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)); sync(); };
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); at(e); cv.onpointermove = at; });
  cv.addEventListener('pointerup', () => { cv.onpointermove = null; });
  hue.addEventListener('input', () => { h = +hue.value; paint(); sync(); });
  hex.addEventListener('input', () => { const v = hex.value.trim(); if (/^#?[0-9a-f]{6}$/i.test(v)) { [h, sat, val] = hex2hsv('#' + v.replace('#', '').toLowerCase()); paint(); sync(true); } });
  popClose = () => { saveUi(); if (!S.recent.includes(S.color)) S.recent = [S.color, ...S.recent].slice(0, 6); renderProp(); stage.render(); };
}

/* ═════════ файл ═════════ */
async function saveFile() {
  if (!P) return;
  stage.commitFloat();
  toast('Зберігаємо…', '');
  const blob = await packProject(P, { audio: audio.blob, ref: app.refBlob, refShow: S.refShow, refOpacity: S.refOpacity });
  const name = fileName(P) + FILE_EXT;
  download(blob, name);
  toast(`Збережено у файл ${name}`, 'good');
}
async function openFile() { const f = await pickFile(FILE_EXT + ',application/zip'); if (f) loadFile(f); }
async function loadFile(f) {
  toast('Відкриваємо…', '');
  const r = await unpackProject(f);
  if (!r.ok) { toast(r.error, 'bad', { ms: 5000 }); return; }
  const go = () => { begin(r.P, { audio: r.audio, ref: r.ref, refMeta: r.refMeta }); toast(`Відкрито «${r.P.title}»`, 'good'); };
  modal({ title: 'Відкрити мультфільм', html: `<table class="tbl"><tr><td>Назва</td><td><b>${esc(r.P.title)}</b></td></tr><tr><td>Кадрів</td><td><b>${r.P.frames.length}</b></td></tr><tr><td>Тривалість</td><td><b>${fmtTime(r.P.duration)}</b></td></tr>${r.savedAt ? `<tr><td>Збережено</td><td><b>${esc(new Date(r.savedAt).toLocaleString('uk-UA'))}</b></td></tr>` : ''}</table>
    ${r.edited ? '<p class="note bad">Файл змінювали вручну після збереження.</p>' : ''}
    ${hasWork() ? '<p class="muted">Поточний мультфільм у браузері буде замінено. Якщо він потрібен — спершу збережіть його у файл.</p>' : ''}
    <div class="row end"><button class="btn" data-close>Скасувати</button><button class="btn primary" data-go>Відкрити</button></div>`,
    onOpen: api => api.el.addEventListener('click', e => { if (e.target.closest('[data-go]')) { api.close(); go(); } }) });
}
const hasWork = () => P && (P.frames.length > 1 || P.layers.some(l => [...l.cells.values()].some(c => !c.empty)));

/* ═════════ експорт ═════════ */
function exportDialog() {
  if (!P) return;
  stop(); stage.commitFloat();
  const vt = videoType();
  const api = modal({ title: 'Експорт мультфільму', wide: false, html: `<div class="ex-list">
    <button class="ex" data-ex="gif">${icon('gif', 22)}<span><b>GIF-анімація</b><small>Відкривається будь-де: у месенджері, презентації, на сайті. Без звуку.</small></span></button>
    <button class="ex" data-ex="video" ${vt ? '' : 'disabled'}>${icon('film', 22)}<span><b>Відео ${vt ? vt.ext.toUpperCase() : ''}${audio.blob ? ' зі звуком' : ''}</b><small>${vt ? 'Для YouTube, соцмереж і відеоредактора. Записується стільки, скільки триває мультфільм.' : 'Цей браузер не вміє записувати відео.'}</small></span></button>
    <button class="ex" data-ex="png">${icon('image', 22)}<span><b>Кадр ${S.fi + 1} як PNG</b><small>Картинка поточного кадру.</small></span></button>
    <button class="ex" data-ex="zip">${icon('grid', 22)}<span><b>Усі кадри PNG (ZIP)</b><small>Окремі картинки — для монтажу деінде.</small></span></button>
    <button class="ex" data-ex="sprite">${icon('grid', 22)}<span><b>Спрайт-лист для гри</b><small>Усі кадри на одній картинці з прозорим тлом + опис для ігрового рушія.</small></span></button>
  </div>
  <div class="field" style="margin-top:12px"><span>Розмір GIF</span>${seg('gifScale', [[1, `Повний (${P.w}×${P.h})`], [0.5, 'Половина — легший файл']], S.gifScale ?? 1)}</div>
  <div class="bar" hidden><i></i></div><p class="muted" id="exState" style="margin:8px 0 0;font-size:12.5px"></p>` });
  const bar = api.el.querySelector('.bar'), fillBar = api.el.querySelector('.bar i'), state = api.el.querySelector('#exState');
  const prog = p => { bar.hidden = false; fillBar.style.width = Math.round(p * 100) + '%'; };
  api.el.addEventListener('click', async e => {
    const sg = e.target.closest('[data-set="gifScale"]'); if (sg) { S.gifScale = +sg.dataset.v; api.el.querySelectorAll('[data-set="gifScale"]').forEach(b => b.classList.toggle('on', b === sg)); return; }
    const b = e.target.closest('[data-ex]'); if (!b || api.el.dataset.busy) return;
    api.el.dataset.busy = 1; api.el.querySelectorAll('.ex').forEach(x => x.disabled = true);
    const base = fileName(P);
    try {
      if (b.dataset.ex === 'gif') { state.textContent = 'Складаємо GIF…'; const blob = await exportGif(stage, { scale: S.gifScale ?? 1, onProgress: prog }); download(blob, base + '.gif'); state.textContent = `Готово: ${base}.gif, ${(blob.size / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`; }
      if (b.dataset.ex === 'video') { state.textContent = `Записуємо відео (${fmtTime(P.duration)})… Не закривайте вкладку.`; const r = await exportVideo(stage, audio.blob ? audio : null, { onProgress: prog }); download(r.blob, base + '.' + r.ext); state.textContent = `Готово: ${base}.${r.ext}`; }
      if (b.dataset.ex === 'png') { const blob = await exportPng(stage, S.fi); download(blob, `${base}_kadr-${S.fi + 1}.png`); prog(1); state.textContent = 'Готово'; }
      if (b.dataset.ex === 'zip') { state.textContent = 'Збираємо кадри…'; const blob = await exportPngZip(stage, prog); download(blob, base + '_kadry.zip'); state.textContent = 'Готово'; }
      if (b.dataset.ex === 'sprite') { state.textContent = 'Складаємо спрайт-лист…'; const r = await exportSprite(stage, { onProgress: prog }); const zip = await makeZip([{ name: 'sprite.png', data: r.png }, { name: 'sprite.json', data: JSON.stringify(r.json, null, 1) }]); download(new Blob([zip], { type: 'application/zip' }), base + '_sprite.zip'); state.textContent = `Готово: ${r.cols}×${r.rows} кадрів по ${r.fw}×${r.fh} px`; }
      toast('Експорт готовий', 'good');
    } catch (err) { state.textContent = 'Не вдалося: ' + (err.message || err); toast('Експорт не вдався', 'bad'); }
    delete api.el.dataset.busy; api.el.querySelectorAll('.ex').forEach(x => x.disabled = x.dataset.ex === 'video' && !vt);
    stage.rebuild();
  });
}

/* ═════════ новий мультфільм і уроки ═════════ */
function startDialog(first = false) {
  const st = { size: 'wide', fps: 8, title: '' };
  const api = modal({ title: first ? 'Аніматор: новий мультфільм' : 'Новий мультфільм', wide: true, html: `
    ${first ? '<p class="muted" style="margin-top:0">Малюйте кадр за кадром — і малюнок оживе. Почніть з уроку, якщо робите мультфільм уперше.</p>' : ''}
    <div class="field"><span>Розмір аркуша</span><div class="cards">${Object.entries(SIZES).map(([k, [w, h, t]]) => `<button class="card ${st.size === k ? 'on' : ''}" data-size="${k}"><span class="shape"><i style="width:${Math.round(w / 20)}px;height:${Math.round(h / 20)}px"></i></span><b>${t}</b><small>${w} × ${h}</small></button>`).join('')}</div></div>
    <div class="row" style="gap:12px;flex-wrap:wrap">
      <label class="field" style="flex:2;min-width:200px"><span>Назва</span><input class="inp" data-st="title" maxlength="60" placeholder="Мій мультфільм"></label>
    </div>
    <div class="row end" style="flex-wrap:wrap">${first ? `<button class="btn outline" data-open>${icon('open', 16)}Відкрити файл</button>` : ''}<button class="btn outline" data-lessons>${icon('lesson', 16)}Уроки для початківців</button><span class="grow"></span>${first ? '' : '<button class="btn" data-close>Скасувати</button>'}<button class="btn primary" data-go>Почати малювати</button></div>` });
  api.el.addEventListener('input', e => { const k = e.target.dataset.st; if (k) st[k] = e.target.value; });
  api.el.addEventListener('click', async e => {
    const s = e.target.closest('[data-size]'); if (s) { st.size = s.dataset.size; api.el.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('on', b === s)); return; }
    if (e.target.closest('[data-open]')) { api.close(); openFile(); if (!P) startDialog(true); return; }
    if (e.target.closest('[data-lessons]')) { api.close(); lessonsDialog(first); return; }
    if (e.target.closest('[data-go]')) {
      if (!first && hasWork() && !(await confirmBox('Почати новий мультфільм?', 'Поточний буде замінено. Якщо він потрібен — спершу збережіть його у файл.', 'Почати новий', true))) return;
      api.close();
      const [w, h] = SIZES[st.size];
      begin(newProject({ w, h, fps: st.fps, title: st.title.trim() || 'Мій мультфільм' }));
      toast('Малюйте на першому кадрі. Потім «Копія» на плівці — і змінюйте малюнок трохи', '', { ms: 5000 });
    }
  });
}
function lessonsDialog(first = false) {
  const api = modal({ title: 'Уроки анімації', wide: true, html: `<p class="muted" style="margin-top:0">У кожному уроці на кадрах уже стоять напрямні — обводьте їх, і побачите, як працює рух.</p>
    <div class="cards">${Object.entries(LESSONS).map(([k, L]) => `<button class="card" data-lesson="${k}"><b>${esc(L.title)}</b><small>${esc(L.goal)}</small><small>${L.frames} ${plural(L.frames, 'кадр', 'кадри', 'кадрів')}, ${L.level.toLowerCase()}</small></button>`).join('')}</div>
    <div class="row end">${first ? '<button class="btn" data-back>Назад</button>' : '<button class="btn" data-close>Закрити</button>'}</div>` });
  api.el.addEventListener('click', async e => {
    if (e.target.closest('[data-back]')) { api.close(); startDialog(true); return; }
    const b = e.target.closest('[data-lesson]'); if (!b) return;
    if (!first && hasWork() && !(await confirmBox('Почати урок?', 'Поточний мультфільм буде замінено. Якщо він потрібен — спершу збережіть його у файл.', 'Почати урок', true))) return;
    api.close();
    begin(newProject({ lesson: b.dataset.lesson }));
    S.guides = true; S.onion = true; setTool('brush'); renderAll();
  });
}
function helpDialog() {
  const k = s => s.split(' ').map(x => `<span class="kbd">${esc(x)}</span>`).join('');
  modal({ title: 'Як зробити мультфільм', wide: true, html: `<ol class="steps">
    <li>Намалюйте першу картинку. Фон краще малювати на шарі «Фон», героя — на окремому шарі.</li>
    <li>На плівці внизу натисніть «Копія» — з’явиться такий самий кадр. Трохи змініть героя: посуньте руку, крок ногою.</li>
    <li>Калька показує попередній кадр червонуватим — так легко зробити рух плавним.</li>
    <li>Натисніть «Грати» (пробіл). Хочете, щоб кадр показувався довше, — клацніть на ньому правою кнопкою й виберіть тривалість.</li>
    <li>Готово? «Експорт» — GIF чи відео. «Файл → Зберегти у файл» — щоб продовжити пізніше або здати вчителю.</li></ol>
    <div class="kgrid">
      <div class="grp">Інструменти</div>
      <span>Пензель, гумка, заливка</span><span>${k('B E G')}</span>
      <span>Лінія, прямокутник, еліпс, ласо-заливка</span><span>${k('L R O A')}</span>
      <span>Виділення, піпетка, рука</span><span>${k('S I H')}</span>
      <span>Менший або більший пензель</span><span>${k('[ ]')}</span>
      <span>Узяти колір з малюнка, не міняючи інструмент</span><span>${k('Alt+клік')}</span>
      <span>Пряма лінія від кінця попередньої</span><span>${k('Shift+клік')}</span>
      <span>Вирівняти лінію чи коло: затримайте пензель у кінці</span><span>утримати</span>
      <div class="grp">Планшет і телефон</div>
      <span>Скасувати й повторити</span><span>дотик двома / трьома пальцями</span>
      <span>Масштаб і рух аркуша</span><span>два пальці</span>
      <span>Долоня, коли малюєте стилусом</span><span>не малює, лише рухає аркуш</span>
      <div class="grp">Кадри</div>
      <span>Попередній і наступний кадр</span><span>${k(', .')}</span>
      <span>Новий порожній кадр, копія кадру</span><span>${k('N D')}</span>
      <span>Грати або зупинити</span><span>${k('Пробіл')}</span>
      <span>Калька</span><span>${k('K')}</span>
      <div class="grp">Дії</div>
      <span>Скасувати, повторити</span><span>${k('Ctrl+Z Ctrl+Shift+Z')}</span>
      <span>Копіювати, вирізати, вставити виділене</span><span>${k('Ctrl+C Ctrl+X Ctrl+V')}</span>
      <span>Виділити весь шар</span><span>${k('Ctrl+A')}</span>
      <span>Зберегти у файл, відкрити</span><span>${k('Ctrl+S Ctrl+O')}</span>
      <span>Вписати в екран, 100%</span><span>${k('F 0')}</span>
      <span>Рухати аркуш</span><span>середня або права кнопка миші, два пальці</span>
    </div>` });
}

/* ═════════ звук ═════════ */
async function addAudio() {
  const f = await pickFile('audio/*'); if (!f) return;
  if (!(await audio.set(f))) { toast('Цей звуковий файл не вдалося прочитати', 'bad'); return; }
  P.audio = { name: f.name, type: f.type }; renderSide(); renderFilm(); touched();
  toast(`Звук «${f.name}» додано`, 'good');
}
async function recAudio() {
  let ctl;
  try { ctl = await recordMic(60, s => { const el = $('#recT'); if (el) el.textContent = fmtTime(s); }); }
  catch { toast('Немає доступу до мікрофона. Дозвольте його в налаштуваннях браузера', 'bad', { ms: 5000 }); return; }
  const api = modal({ title: 'Запис голосу', html: `<p>Говоріть — запис іде. Найдовше 60 секунд.</p><p style="font-size:28px;font-weight:700;font-variant-numeric:tabular-nums;margin:6px 0" id="recT">0,0 с</p><div class="row end"><button class="btn primary" data-stop>${icon('check', 16)}Зупинити й додати</button></div>`,
    onClose: () => ctl.stop(), onOpen: a => a.el.addEventListener('click', e => { if (e.target.closest('[data-stop]')) a.close(); }) });
  const blob = await ctl.result; api.close();
  if (!blob.size || !(await audio.set(blob))) { toast('Запис порожній', 'bad'); return; }
  P.audio = { name: 'Мій голос', type: blob.type }; renderSide(); renderFilm(); touched();
  toast('Голос додано. Натисніть «Грати», щоб послухати', 'good');
}

/* ═════════ інструменти й налаштування ═════════ */
function setTool(t) {
  if (t !== 'select') stage.commitFloat();
  if (t === S.tool) return;
  // свій розмір у пензля, гумки й фігур
  const grp = x => x === 'eraser' ? 'eraser' : ['line', 'rect', 'ellipse'].includes(x) ? 'shape' : x === 'brush' ? 'brush' : null;
  const g0 = grp(S.tool), g1 = grp(t);
  S.sizes = S.sizes || { brush: 6, eraser: 24, shape: 6 };
  if (g0) S.sizes[g0] = S.size;
  if (g1) S.size = S.sizes[g1];
  S.tool = t;
  saveUi(); renderRail(); renderProp(); stage.cursor(); stage.render();
}
const ACTS = {
  undo, redo, fileMenu: el => fileMenu(el), brushPick: el => brushMenu(el), colorPick: el => colorMenu(el), lessons: () => lessonsDialog(), help: helpDialog, export: exportDialog,
  theme: () => { const d = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = d; try { localStorage.setItem('edvault-theme', d); } catch { /* */ } renderTop(); },
  side: () => $('#side').classList.toggle('open'),
  zoomIn: () => stage.zoomAt(1.25), zoomOut: () => stage.zoomAt(0.8), fit: () => stage.fit(),
  play: togglePlay, first: () => goFrame(0), last: () => goFrame(P.frames.length - 1), prev: () => goFrame(S.fi - 1), next: () => goFrame(S.fi + 1),
  addFrame: () => addFrame(true), dupFrame: () => addFrame(false),
  layerAdd: () => struct(() => { const l = P.addLayer(null, S.li + 1); if (!l) { toast('Найбільше 8 шарів', 'bad'); return false; } S.li += 1; }),
  layerDup: () => struct(() => { const l = P.duplicateLayer(S.li); if (!l) { toast('Найбільше 8 шарів', 'bad'); return false; } S.li += 1; P.frames.forEach(f => stale.add(f.id)); }),
  layerDel: async () => { if (P.layers.length <= 1) { toast('Останній шар видалити не можна', 'bad'); return; } if (await confirmBox(`Видалити шар «${P.layers[S.li].name}»?`, 'Зникне малюнок цього шару на всіх кадрах. Можна скасувати через Ctrl+Z.', 'Видалити', true)) struct(() => { P.deleteLayer(S.li); S.li = Math.max(0, S.li - 1); P.frames.forEach(f => stale.add(f.id)); }); },
  layerUp: () => S.li < P.layers.length - 1 && struct(() => { P.moveLayer(S.li, S.li + 1); S.li += 1; P.frames.forEach(f => stale.add(f.id)); }),
  layerDown: () => S.li > 0 && struct(() => { P.moveLayer(S.li, S.li - 1); S.li -= 1; P.frames.forEach(f => stale.add(f.id)); }),
  layerRename: () => renameLayer(S.li),
  refAdd: async () => { const f = await pickFile('image/*'); if (!f) return; await setRef(f); S.refShow = true; renderSide(); touched(); toast('Зразок додано під малюнок. У мультфільм він не потрапить', 'good'); },
  refDel: () => { setRef(null); touched(); },
  audioAdd: addAudio, audioRec: recAudio,
  audioDel: () => { audio.set(null); P.audio = null; renderSide(); renderFilm(); touched(); },
  lessonMin: () => { $('#lessonCard').classList.toggle('mini'); renderLesson(); },
  lessonEnd: () => { P.lesson = null; app.guides = null; renderLesson(); renderTransport(); stage.render(); touched(); },
};
function renameLayer(i) {
  const l = P.layers[i];
  modal({ title: 'Назва шару', html: `<label class="field"><span>Назва</span><input class="inp" id="ln" value="${esc(l.name)}" maxlength="30" autofocus></label><div class="row end"><button class="btn" data-close>Скасувати</button><button class="btn primary" data-ok>Зберегти</button></div>`,
    onOpen: api => {
      const ok = () => { const v = api.el.querySelector('#ln').value.trim(); if (v) struct(() => { l.name = v; }); api.close(); };
      api.el.addEventListener('click', e => { if (e.target.closest('[data-ok]')) ok(); });
      api.el.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    } });
}

/* ═════════ події ═════════ */
document.addEventListener('click', e => {
  const side = $('#side');
  if (side.classList.contains('open') && !side.contains(e.target) && !e.target.closest('[data-act="side"], .md-wrap, .pop')) side.classList.remove('open');
  const a = e.target.closest('[data-act]'); if (a && !a.disabled) { ACTS[a.dataset.act]?.(a); return; }
  const t = e.target.closest('[data-tool]'); if (t) { setTool(t.dataset.tool); return; }
  const sw = e.target.closest('[data-color]'); if (sw) { S.color = sw.dataset.color; saveUi(); renderProp(); return; }
  const st = e.target.closest('[data-set]');
  if (st && !st.closest('.md')) {
    const k = st.dataset.set, raw = st.dataset.v, v = raw === 'true' ? true : raw === 'false' ? false : isNaN(+raw) ? raw : +raw;
    S[k] = v; saveUi();
    if (k === 'onionN') { stage.rebuild(); stage.prepare(); renderSide(); } else renderProp();
    return;
  }
  const tg = e.target.closest('[data-toggle]');
  if (tg) {
    const k = tg.dataset.toggle; S[k] = k === 'stabilizer' ? (S[k] > 0 ? 0 : 0.4) : !S[k]; saveUi();
    if (k === 'onion' || k === 'guides' || k === 'refShow') { stage.rebuild(); stage.prepare(); }
    renderProp(); renderTransport(); if (k === 'onion' || k === 'refShow') renderSide(); stage.render();
    return;
  }
  const fl = e.target.closest('[data-float]');
  if (fl) {
    const k = fl.dataset.float;
    if (k === 'flip' && stage.float) { stage.float.flip = !stage.float.flip; stage.render(); }
    if (k === 'flipV' && stage.float) { stage.float.flipV = !stage.float.flipV; stage.render(); }
    if (k === 'rot90' && stage.float) { stage.float.angle = ((stage.float.angle || 0) + Math.PI / 2) % (Math.PI * 2); stage.render(); }
    if (k === 'copy') { clip = stage.floatCanvas(); toast('Скопійовано. Перейдіть на інший кадр і натисніть Ctrl+V', 'good'); }
    if (k === 'del') stage.deleteFloat();
    if (k === 'done') stage.commitFloat();
    renderProp();
    return;
  }
  const bg = e.target.closest('[data-bg]'); if (bg) { struct(() => { P.bg = bg.dataset.bg; P.frames.forEach(f => stale.add(f.id)); }); return; }
  const lv = e.target.closest('[data-lvis]'); if (lv) { const i = +lv.dataset.lvis; struct(() => { P.layers[i].visible = !P.layers[i].visible; P.frames.forEach(f => stale.add(f.id)); }); return; }
  const lk = e.target.closest('[data-llock]'); if (lk) { const i = +lk.dataset.llock; P.layers[i].locked = !P.layers[i].locked; renderSide(); touched(); return; }
  const lr = e.target.closest('[data-layer]'); if (lr) { selectLayer(+lr.dataset.layer); return; }
});
document.addEventListener('dblclick', e => { const n = e.target.closest('[data-lname]'); if (n) renameLayer(+n.dataset.lname); });
document.addEventListener('input', e => {
  const r = e.target.dataset.range;
  if (r) {
    const v = +e.target.value, out = e.target.parentElement.querySelector(`[data-out="${r}"]`);
    if (r === 'layerOpacity') { P.layers[S.li].opacity = v; stage.rebuild(); if (out) out.textContent = Math.round(v * 100) + '%'; return; }
    S[r] = v; if (out) out.textContent = ['opacity', 'onionAlpha', 'refOpacity'].includes(r) ? Math.round(v * 100) + '%' : v;
    if (r === 'size') stage.flashSize();
    if (r === 'onionAlpha') { stage.buildOnion(); stage.render(); }
    if (r === 'refOpacity') stage.render();
    return;
  }
  if (e.target.matches('[data-bgcustom]')) { P.bg = e.target.value; stage.render(); return; }
  const m = e.target.dataset.meta; if (m) { P[m] = e.target.value; touched(); }
});
document.addEventListener('change', e => {
  if (e.target.dataset.range === 'layerOpacity') { const v = +e.target.value; const L = P.layers[S.li]; L.opacity = 1; struct(() => { L.opacity = v; P.frames.forEach(f => stale.add(f.id)); }); return; }
  if (e.target.dataset.range) { saveUi(); return; }
  if (e.target.matches('[data-bgcustom]')) { const v = e.target.value; struct(() => { P.bg = v; P.frames.forEach(f => stale.add(f.id)); }); }
  if (e.target.matches('[data-fps]')) { const v = +e.target.value; struct(() => { P.fps = v; }); }
});
$('#title').addEventListener('input', e => { if (P) { P.title = e.target.value; touched(); } });
$('#title').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });

/* плівка: клік, перетягування, меню кадру */
let fdrag = null;
$('#film').addEventListener('pointerdown', e => {
  const fr = e.target.closest('.fr'); if (!fr || e.button === 2) return;
  fdrag = { i: +fr.dataset.frame, x: e.clientX, el: fr, moved: false, timer: setTimeout(() => { if (fdrag && !fdrag.moved) { const r = fr.getBoundingClientRect(); frameMenu(fdrag.i, { left: r.left, top: r.top, bottom: r.bottom, x: r.left, y: r.top }); fdrag = null; } }, 550) };
});
$('#film').addEventListener('pointermove', e => {
  if (!fdrag) return;
  if (!fdrag.moved && Math.abs(e.clientX - fdrag.x) > 8 && e.pointerType === 'mouse') { fdrag.moved = true; clearTimeout(fdrag.timer); fdrag.el.classList.add('drag'); }
  if (!fdrag.moved) return;
  $$('.fr').forEach(x => x.classList.remove('over-l', 'over-r'));
  const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('.fr');
  if (over && over !== fdrag.el) { const r = over.getBoundingClientRect(); over.classList.add(e.clientX < r.left + r.width / 2 ? 'over-l' : 'over-r'); fdrag.to = +over.dataset.frame + (e.clientX < r.left + r.width / 2 ? 0 : 1); }
});
$('#film').addEventListener('pointerup', () => {
  if (!fdrag) return;
  clearTimeout(fdrag.timer);
  const d = fdrag; fdrag = null;
  $$('.fr').forEach(x => x.classList.remove('over-l', 'over-r', 'drag'));
  if (!d.moved) { if (S.playing) stop(); goFrame(d.i); return; }
  if (d.to == null) return;
  let to = d.to > d.i ? d.to - 1 : d.to;
  if (to !== d.i) struct(() => { P.moveFrame(d.i, to); S.fi = to; });
});
$('#film').addEventListener('contextmenu', e => { const fr = e.target.closest('.fr'); if (!fr) return; e.preventDefault(); if (fdrag) { clearTimeout(fdrag.timer); fdrag = null; } frameMenu(+fr.dataset.frame, { left: e.clientX, top: e.clientY, bottom: e.clientY, x: e.clientX, y: e.clientY }); });
$('#film').addEventListener('keydown', e => { const fr = e.target.closest('.fr'); if (fr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); goFrame(+fr.dataset.frame); } });

/* клавіатура */
let clip = null;
const KEYS = { KeyB: 'brush', KeyE: 'eraser', KeyG: 'fill', KeyL: 'line', KeyR: 'rect', KeyO: 'ellipse', KeyA: 'lasso', KeyS: 'select', KeyI: 'picker', KeyH: 'hand' };
document.addEventListener('keydown', e => {
  if (!P || document.querySelector('.md-wrap')) return;
  if (e.target.closest('input, textarea, select')) return;
  const mod = e.ctrlKey || e.metaKey, c = e.code;
  if (e.key === 'Escape') { if (pop.classList.contains('on')) { closePop(); return; } if (stage.float) { stage.commitFloat(); renderProp(); return; } if (stage.op) stage.cancel(); return; }
  if (mod) {
    if (c === 'KeyZ') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (c === 'KeyY') { e.preventDefault(); redo(); return; }
    if (c === 'KeyS') { e.preventDefault(); saveFile(); return; }
    if (c === 'KeyO') { e.preventDefault(); openFile(); return; }
    if (c === 'KeyC' && stage.float) { e.preventDefault(); clip = stage.floatCanvas(); toast('Скопійовано. Перейдіть на інший кадр і натисніть Ctrl+V', 'good'); return; }
    if (c === 'KeyX' && stage.float) { e.preventDefault(); clip = stage.floatCanvas(); stage.deleteFloat(); renderProp(); return; }
    if (c === 'KeyV' && clip) { e.preventDefault(); stage.pasteFloat(clip, null); renderRail(); renderProp(); return; }
    if (c === 'KeyA') { e.preventDefault(); setTool('select'); stage.lift({ x: 0, y: 0, w: P.w, h: P.h }).then(renderProp); return; }
    return;
  }
  if (c === 'Space') { e.preventDefault(); togglePlay(); return; }
  if (stage.float && e.key.startsWith('Arrow')) { e.preventDefault(); const d = e.shiftKey ? 10 : 1; stage.nudge(e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && stage.float) { e.preventDefault(); stage.deleteFloat(); renderProp(); return; }
  if (e.key === ',' || e.key === 'ArrowLeft') { e.preventDefault(); goFrame(S.fi - 1); return; }
  if (e.key === '.' || e.key === 'ArrowRight') { e.preventDefault(); goFrame(S.fi + 1); return; }
  if (e.key === 'Home') { goFrame(0); return; }
  if (e.key === 'End') { goFrame(P.frames.length - 1); return; }
  if (e.key === '[') { S.size = Math.max(1, Math.round(S.size / 1.25)); renderProp(); stage.flashSize(); return; }
  if (e.key === ']') { S.size = Math.min(120, Math.round(S.size * 1.25) + 1); renderProp(); stage.flashSize(); return; }
  if (c === 'KeyN') { addFrame(true); return; }
  if (c === 'KeyD') { addFrame(false); return; }
  if (c === 'KeyK') { S.onion = !S.onion; saveUi(); stage.rebuild(); stage.prepare(); renderTransport(); renderSide(); return; }
  if (c === 'KeyF') { stage.fit(); return; }
  if (c === 'Digit0') { stage.view.z = 1; stage.zoomAt(1); stage.fit(); stage.zoomAt(1 / stage.view.z); return; }
  if (KEYS[c]) setTool(KEYS[c]);
});
addEventListener('resize', () => { stage.resize(); });
$('#view').addEventListener('pointerdown', () => $('#side').classList.remove('open'));
new ResizeObserver(() => { stage.resize(); if (P) { stage.inset = null; renderLesson(); } }).observe($('#stageWrap'));
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
addEventListener('pagehide', saveNow);
// перетягнути файл проєкту чи картинку на сторінку
document.addEventListener('dragover', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault(); });
document.addEventListener('drop', async e => {
  const f = e.dataTransfer?.files?.[0]; if (!f) return; e.preventDefault();
  if (/\.edanim$|zip/i.test(f.name + f.type)) loadFile(f);
  else if (f.type.startsWith('image/')) {
    // картинка — вставити на поточний шар як виділення
    const bmp = await createImageBitmap(f), k = Math.min(1, P.w * 0.8 / bmp.width, P.h * 0.8 / bmp.height);
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k); cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    stage.pasteFloat(cv, null); renderRail(); renderProp(); toast('Картинку вставлено: перемістіть і натисніть «Готово»', 'good');
  } else if (f.type.startsWith('audio/')) { if (await audio.set(f)) { P.audio = { name: f.name, type: f.type }; renderSide(); renderFilm(); touched(); toast(`Звук «${f.name}» додано`, 'good'); } }
});
document.addEventListener('paste', async e => {
  if (!P || e.target.closest('input, textarea')) return;
  const it = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/')); if (!it) return;
  e.preventDefault();
  const bmp = await createImageBitmap(it.getAsFile()), k = Math.min(1, P.w * 0.8 / bmp.width, P.h * 0.8 / bmp.height);
  const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k); cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  stage.pasteFloat(cv, null); renderRail(); renderProp();
});

/* ═════════ старт ═════════ */
(async () => {
  fillIcons(); tips(); renderRail(); renderProp();
  if (document.fonts) document.fonts.ready.then(() => stage.render());
  const r = await restore();
  if (r) { begin(r.P, { audio: r.audio, ref: r.ref, ui: r.ui }); toast('Мультфільм відновлено з цього браузера', 'good', { action: 'Новий', onAction: () => startDialog() }); }
  else { begin(newProject({})); startDialog(true); }
})();
export { begin, newProject, clearAutosave, Cell };
