// Автоматичні субтитри: збираємо голос із таймлайну (16 кГц моно), ділимо на шматки по тиші й віддаємо Whisper у Worker.
import { S, emit, mainEnd, duration } from './state.js';
import { renderBlock, resetAudioSinks } from './audio.js';
import { setCaptions } from './ops.js';
import { $, fmt, toast, openModal, closeModal } from './ui.js';

const SR = 16000;
export const ASR_MODELS = {
  base: { id: 'onnx-community/whisper-base', size: '≈ 80 МБ' },
  small: { id: 'onnx-community/whisper-small', size: '≈ 250 МБ' },
};

// голос з таймлайну без музики, моно 16 кГц
export async function speechAudio(onProgress) {
  const end = duration();
  const out = new Float32Array(Math.ceil(end * SR));
  resetAudioSinks();
  for (let t = 0; t < end - 1e-6; t += 4) {
    const b = Math.min(end, t + 4);
    const buf = await renderBlock(t, b, { speechOnly: true });
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    const o0 = Math.round(t * SR);
    for (let i = 0, j = 0; j < L.length - 2 && o0 + i < out.length; i++, j += 3) out[o0 + i] = (L[j] + R[j] + L[j + 1] + R[j + 1] + L[j + 2] + R[j + 2]) / 6;
    onProgress?.(b / end);
  }
  return out;
}

// ділимо на шматки ≤ 28 с у найтихіших місцях
export function splitParts(a, maxLen = 28) {
  const parts = [];
  const win = SR / 20; // 50 мс
  const energy = i => { let s = 0; for (let k = i; k < Math.min(a.length, i + win); k++) s += a[k] * a[k]; return s; };
  let start = 0;
  while (start < a.length) {
    let end = Math.min(a.length, start + maxLen * SR);
    if (end < a.length) {
      // шукаємо найтихіше вікно в останніх 8 с шматка
      let best = end, be = Infinity;
      for (let i = end - 8 * SR; i < end - win; i += win) { const e = energy(i); if (e < be) { be = e; best = i + win / 2; } }
      end = Math.round(best);
    }
    const seg = a.subarray(start, end);
    let loud = 0; for (let i = 0; i < seg.length; i += 160) loud = Math.max(loud, Math.abs(seg[i]));
    if (loud > 0.01) parts.push({ offset: start / SR, audio: seg.slice() });
    start = end;
  }
  return parts;
}

// фрази Whisper → субтитри по 1–2 короткі рядки
export function toCaptions(chunks, offset, partLen) {
  const out = [];
  for (const c of chunks) {
    const text = (c.text || '').replace(/\s+/g, ' ').trim();
    if (!text || /^\[.*\]$|^\(.*\)$/.test(text)) continue;
    let [a, b] = c.timestamp || [0, null];
    a = (a ?? 0); b = b == null ? partLen : b;
    if (b <= a) b = a + Math.max(1, text.length * 0.06);
    const words = text.split(' ');
    const n = Math.max(1, Math.ceil(text.length / 74));
    const per = Math.ceil(words.length / n);
    for (let i = 0; i < n; i++) {
      const w = words.slice(i * per, (i + 1) * per);
      if (!w.length) continue;
      const s0 = a + (b - a) * (i * per) / words.length, s1 = a + (b - a) * Math.min(words.length, (i + 1) * per) / words.length;
      out.push({ start: offset + s0, dur: Math.max(0.6, s1 - s0), text: w.join(' ') });
    }
  }
  return out;
}

let worker = null, running = null;
const opt = { lang: 'uk', model: 'base' };

export function initAsr() {
  const segPick = (id, key) => $(id).addEventListener('click', e => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    $(id).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    opt[key] = b.dataset.v;
  });
  segPick('asrLang', 'lang'); segPick('asrModel', 'model');
  $('asrStart').addEventListener('click', start);
  $('asrCancel').addEventListener('click', cancel);
}

export function openAsr() {
  if (!S.project.clips.length) { toast('Спочатку додайте відео'); return; }
  if (running) { openModal('asrModal'); return; }
  $('asrSetup').hidden = false; $('asrRun').hidden = true;
  $('asrInfo').innerHTML = S.project.captions.length ? `<span class="warn">Наявні субтитри (${S.project.captions.length}) буде замінено.</span>` : `Тривалість відео <b>${fmt(mainEnd())}</b>. Розпізнавання займе приблизно стільки ж часу (швидше з відеокартою).`;
  openModal('asrModal');
}

function setProg(p, text) {
  $('asrBar').style.width = (Math.max(0, Math.min(1, p)) * 100).toFixed(1) + '%';
  $('asrPct').textContent = Math.floor(p * 100) + '%';
  if (text) $('asrStage').textContent = text;
}

async function start() {
  const model = ASR_MODELS[opt.model];
  $('asrSetup').hidden = true; $('asrRun').hidden = false;
  setProg(0, 'Збираємо звук з відео…');
  running = { cancelled: false };
  const run = running;
  try {
    const audio = await speechAudio(p => setProg(p * 0.1));
    if (run.cancelled) return;
    const parts = splitParts(audio);
    if (!parts.length) throw new Error('У відео не знайдено мовлення');
    const total = parts.reduce((s, p) => s + p.audio.length, 0);
    setProg(0.1, `Завантажуємо модель розпізнавання (${model.size}, лише перший раз)…`);
    if (!worker) worker = new Worker(new URL('./asr-worker.js', import.meta.url), { type: 'module' });
    const caps = [];
    let doneLen = 0;
    const files = new Map();
    await new Promise((resolve, reject) => {
      run.reject = reject;
      worker.onmessage = e => {
        const d = e.data;
        if (run.cancelled) return;
        if (d.type === 'dl') {
          files.set(d.file, [d.loaded, d.total]);
          let l = 0, t = 0; files.forEach(([a, b]) => { l += a; t += b; });
          setProg(0.1 + 0.2 * (l / t), `Завантажуємо модель: ${(l / 1048576).toFixed(0)} з ${(t / 1048576).toFixed(0)} МБ (лише перший раз)…`);
        } else if (d.type === 'ready') {
          setProg(0.3, d.device === 'webgpu' ? 'Розпізнаємо мову (з відеокартою)…' : 'Розпізнаємо мову…');
        } else if (d.type === 'part') {
          caps.push(...toCaptions(d.chunks.length ? d.chunks : [{ text: d.text, timestamp: [0, d.len] }], d.offset, d.len));
          doneLen += parts[d.i].audio.length;
          setProg(0.3 + 0.7 * doneLen / total, `Розпізнано ${fmt(d.offset + d.len)} з ${fmt(mainEnd())}…`);
        } else if (d.type === 'done') resolve();
        else if (d.type === 'error') reject(new Error(d.message));
      };
      worker.onerror = e => reject(new Error(e.message || 'Помилка розпізнавання'));
      worker.postMessage({ type: 'run', model: model.id, language: opt.lang === 'auto' ? null : opt.lang, parts }, parts.map(p => p.audio.buffer));
    });
    if (run.cancelled) return;
    // не даємо субтитрам перекриватися
    caps.sort((a, b) => a.start - b.start);
    for (let i = 0; i < caps.length - 1; i++) if (caps[i].start + caps[i].dur > caps[i + 1].start) caps[i].dur = Math.max(0.3, caps[i + 1].start - caps[i].start);
    setCaptions(caps, true);
    closeModal('asrModal');
    toast(caps.length ? `Готово: ${caps.length} субтитрів. Перевірте текст — його можна виправити у вкладці «Субтитри»` : 'Мовлення не розпізнано', caps.length ? 'ok' : 'err', 6000);
    emit('asr-done');
  } catch (e) {
    console.error(e);
    if (!run.cancelled) {
      $('asrSetup').hidden = false; $('asrRun').hidden = true;
      $('asrInfo').innerHTML = `<span class="warn">${/fetch|network|Failed to load|import/i.test(e.message) ? 'Не вдалося завантажити модель розпізнавання. Перевірте інтернет і спробуйте ще раз.' : 'Не вдалося розпізнати: ' + e.message}</span>`;
    }
  } finally { if (running === run) running = null; }
}

function cancel() {
  if (!running) { closeModal('asrModal'); return; }
  running.cancelled = true;
  if (worker) { worker.terminate(); worker = null; }
  running = null;
  $('asrSetup').hidden = false; $('asrRun').hidden = true;
  closeModal('asrModal');
  toast('Розпізнавання скасовано');
}
export const asrBusy = () => !!running;
