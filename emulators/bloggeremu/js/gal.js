// Симулятор блогера · спільні шматки для Галереї та вибору файлів у застосунках.
import { icon } from './icons.js';
import { photo, video } from './art.js';
import { SCENES, CLIPS, NICHES } from './data.js';
import { fmtDur } from './quality.js';

// Кнопка вибору файлів із пристрою (input усередині label відкриває системне вікно вибору)
export const fileBtn = (ctx, t = 'Додати', cls = 'btn sm primary', accept = 'image/*,video/*') => `<label class="${cls} file-btn">${icon('upload', 16)}${t}<input type="file" accept="${accept}" multiple data-file="${ctx}"></label>`;
export const galTitle = g => g.own ? (g.type === 'video' ? 'Ваше відео' : 'Ваше фото') : g.type === 'video' ? CLIPS[g.clip]?.t || 'Відео' : SCENES[g.scene]?.t || 'Фото';
// Мініатюра для сітки
export function thumb(g, o = {}) {
  const dur = g.type === 'video' ? `<i class="pg-dur">${fmtDur(g.own ? g.dur : CLIPS[g.clip]?.dur || 0)}</i>` : '';
  return `${g.type === 'video' ? (g.own ? video(g, { paused: true }) : video(g.clip, { paused: true })) : photo(g, { thumb: true, ...o })}${dur}${g.geo ? `<i class="pg-geo">${icon('location', 12)}</i>` : ''}`;
}
export const topicOptions = cur => [...Object.entries(NICHES).map(([k, n]) => [k, n.t]), ['me', 'Про мене / інше']].map(([k, t]) => `<option value="${k}"${cur === k ? ' selected' : ''}>${t}</option>`).join('');

