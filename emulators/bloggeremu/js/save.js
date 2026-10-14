// Симулятор блогера · збереження всього у файл і відкриття з файлу.
// Файл — звичайний ZIP-архів: game.json (увесь стан телефона: профілі, дописи, коментарі, розмови,
// канали, реклама, налаштування…) і папка media з власними фото й відео учня. Викладач може
// просто розпакувати архів і подивитися файли, а симулятор відновить гру точно з того самого моменту.
import { okState, dayOf, clock, dayName, num } from './sim.js';
import { makeZip, readZip } from '../../../shared/zip.js';
import { checksum, slug } from '../../../shared/savefile.js';

export const FILE_APP = 'edvault-blogger';
export const FILE_FORMAT = 1;

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/ogg': 'ogv' };
const extOf = (blob, name = '') => EXT[blob?.type] || (/\.([a-z0-9]{2,5})$/i.exec(name)?.[1] || 'bin').toLowerCase();
const TYPE = Object.fromEntries(Object.entries(EXT).map(([t, e]) => [e, t]));

export function summaryOf(s, mediaN = 0) {
  const own = (s.gallery || []).filter(g => g.own);
  return {
    'Учень': s.student?.name || '—',
    'Клас або група': s.student?.group || '—',
    'Віртуальний час': `день ${dayOf(s.t) + 1}, ${dayName(s.t).toLowerCase()}, ${clock(s.t)}`,
    'Instagram': s.me ? `@${s.me.nick}` : 'профіль ще не створено',
    'Підписники в Instagram': num(s.followers || 0),
    'Дописи в Instagram': String((s.posts || []).length),
    'YouTube-канал': s.tube ? `${s.tube.name} (@${s.tube.handle})` : 'ще не створено',
    'Підписники на YouTube': s.tube ? num(s.tube.subs || 0) : '—',
    'Відео на YouTube': s.tube ? String(s.tube.videos.length) : '—',
    'Довіра аудиторії': `${Math.round(s.trust ?? 0)}%`,
    'Порушення правил (страйки)': String(s.strikes || 0),
    'Власні фото й відео': `${own.filter(g => g.type === 'photo').length} фото, ${own.filter(g => g.type === 'video').length} відео (у файлі: ${mediaN})`,
  };
}

// Назва: blogger_nik_Imia-Prizvyshche_den-5.zip
export function fileName(s) {
  return ['blogger', slug(s.me?.nick || s.tube?.handle || ''), slug(s.student?.name || ''), `den-${dayOf(s.t) + 1}`].filter(Boolean).join('_') + '.zip';
}

const README = s => `Збережена гра «Симулятор блогера» (Edvault)
==========================================

Щоб продовжити гру, відкрийте симулятор блогера на сайті edvault.online
і натисніть «Відкрити файл» (праворуч від телефона або в «Налаштуваннях» телефона).
Архів НЕ треба розпаковувати.

Що всередині:
  game.json — увесь стан гри: профілі, дописи, коментарі, розмови, канали, реклама, налаштування.
  media/     — власні фото й відео учня (їх можна переглянути, розпакувавши архів).

${Object.entries(summaryOf(s)).map(([k, v]) => `${k}: ${v}`).join('\n')}
`;

// sim.s + стан інтерфейсу + власні файли → Blob (ZIP)
export async function packBlogger(s, ui, media, onProgress) {
  const state = JSON.parse(JSON.stringify(s));
  const entries = [], index = {};
  for (const { mid, rec } of media) {
    if (!rec?.blob) continue;
    const dir = `media/${mid}/`, m = { kind: rec.kind, name: rec.name || '', size: rec.size || 0 };
    const add = (blob, base) => { const n = `${dir}${base}.${extOf(blob, base === 'original' ? rec.name : '')}`; entries.push({ name: n, data: blob }); return { path: n, type: blob.type || '' }; };
    m.blob = add(rec.blob, 'original');
    if (rec.thumb) m.thumb = add(rec.thumb, 'thumb');
    m.frames = (rec.frames || []).map((f, i) => add(f, `frame-${i + 1}`));
    index[mid] = m;
  }
  const game = {
    app: FILE_APP, format: FILE_FORMAT, savedAt: new Date().toISOString(),
    about: 'Збережена гра «Симулятор блогера» (edvault.online/emulators/blogger). Відкрийте архів у симуляторі кнопкою «Відкрити файл».',
    summary: summaryOf(state, Object.keys(index).length),
    integrity: checksum(JSON.stringify(state)),
    ui: JSON.parse(JSON.stringify(ui || {})),
    media: index,
    state,
  };
  return makeZip([{ name: 'game.json', data: JSON.stringify(game, null, 1) }, { name: 'README.txt', data: README(state) }, ...entries], onProgress);
}

// File/Blob → { ok, state, ui, edited, savedAt, media: [{ mid, rec }], missing } або { ok: false, error }
export async function unpackBlogger(file) {
  let game, zip = null;
  try { zip = await readZip(file); } catch { zip = null; }
  try {
    if (zip) { const g = zip.get('game.json'); if (!g) return { ok: false, error: 'В архіві немає збереженої гри (game.json). Можливо, це інший архів.' }; game = JSON.parse(await g.text()); }
    else game = JSON.parse((await file.text()).replace(/^﻿/, ''));
  } catch (e) {
    return { ok: false, error: e?.message === 'method' ? 'Архів стиснуто способом, який цей браузер не підтримує. Збережіть гру ще раз у симуляторі.' : 'Це не файл збереження: його не вдалося прочитати.' };
  }
  if (!game || typeof game !== 'object') return { ok: false, error: 'Це не файл збереження симулятора блогера.' };
  if (game.app && game.app !== FILE_APP) return { ok: false, error: game.app === 'edvault-startup' ? 'Це збереження симулятора стартапу. Відкрийте його в симуляторі стартапу.' : 'Цей файл належить іншому інструменту, а не симулятору блогера.' };
  if (game.format > FILE_FORMAT) return { ok: false, error: 'Файл збережено новішою версією симулятора. Оновіть сторінку й спробуйте ще раз.' };
  const state = game.state ?? game.s;
  if (!okState(state)) return { ok: false, error: 'Файл пошкоджений або це не збереження симулятора блогера.' };
  const edited = !!game.integrity && checksum(JSON.stringify(state)) !== game.integrity;
  // власні файли
  const media = []; let missing = 0;
  for (const [mid, m] of Object.entries(game.media || {})) {
    const get = async ref => { const e = ref && zip?.get(ref.path); if (!e) return null; return e.blob(ref.type || TYPE[ref.path.split('.').pop()] || ''); };
    try {
      const blob = await get(m.blob); if (!blob) { missing++; continue; }
      const thumb = await get(m.thumb), frames = (await Promise.all((m.frames || []).map(get))).filter(Boolean);
      media.push({ mid, rec: { kind: m.kind, blob, thumb: thumb || undefined, frames, size: m.size || blob.size, name: m.name || '' } });
    } catch { missing++; }
  }
  return { ok: true, state, ui: game.ui && typeof game.ui === 'object' ? game.ui : { speed: game.speed }, edited, savedAt: game.savedAt || null, media, missing, summary: game.summary || null };
}
