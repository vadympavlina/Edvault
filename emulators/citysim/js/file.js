// Симулятор міста · збереження всього міста у файл (.json) і відкриття з файлу.
import { okState, money, num, pct, monthText, dateText } from './sim.js';
import { SCENARIOS } from './data.js';
import { checksum, slug } from '../../shared/savefile.js';

export const FILE_APP = 'edvault-city';
export const FILE_FORMAT = 1;

export function summaryOf(C) {
  const s = C.s, m = C.metrics();
  return {
    'Учень (мер)': s.mayor?.name || '—', 'Клас або група': s.mayor?.group || '—', 'Місто': s.name, 'Режим': SCENARIOS[s.scenario]?.t || s.scenario,
    'Дата в грі': dateText(s.month, s.day), 'Стан': s.over ? { win: 'місію виконано', fail: 'час місії вийшов', lost: 'програв вибори' }[s.over.kind] : 'гра триває',
    'Жителі': num(m.pop), 'Казна': money(s.money), 'Підтримка мера': pct(s.approval / 100), 'Щастя': String(Math.round(m.happy)), 'Забруднення повітря': String(Math.round(m.aqi)),
    'Затори': pct(m.congestion), 'Вища освіта': pct(m.eduHigh), 'Записів у журналі рішень': String(s.journal.length),
  };
}
export function fileName(s) { return ['city', slug(s.name) || 'misto', slug(s.mayor?.name || ''), `${2026 + Math.floor(s.month / 12)}-${String(s.month % 12 + 1).padStart(2, '0')}`].filter(Boolean).join('_') + '.json'; }

export function packCity(C, ui = {}) {
  const state = JSON.parse(JSON.stringify(C.s));
  return { app: FILE_APP, format: FILE_FORMAT, savedAt: new Date().toISOString(),
    about: 'Збережене місто «Симулятор міста» (edvault.online/emulators/city). Відкрийте його в симуляторі кнопкою «Відкрити».',
    summary: summaryOf(C), integrity: checksum(JSON.stringify(state)), ui: JSON.parse(JSON.stringify(ui)), state };
}
export function unpackCity(text) {
  let d; try { d = JSON.parse(String(text).replace(/^﻿/, '')); } catch { return { ok: false, error: 'Це не файл збереження: його не вдалося прочитати.' }; }
  if (!d || typeof d !== 'object') return { ok: false, error: 'Це не файл збереження симулятора міста.' };
  if (d.app && d.app !== FILE_APP) return { ok: false, error: d.app === 'edvault-startup' ? 'Це збереження симулятора стартапу.' : d.app === 'edvault-blogger' ? 'Це збереження симулятора блогера.' : 'Цей файл належить іншому інструменту.' };
  if (d.format > FILE_FORMAT) return { ok: false, error: 'Файл збережено новішою версією симулятора. Оновіть сторінку.' };
  const state = d.state ?? d.s;
  if (!okState(state)) return { ok: false, error: 'Файл пошкоджений або це не збереження симулятора міста.' };
  return { ok: true, state, ui: d.ui || {}, edited: !!d.integrity && checksum(JSON.stringify(state)) !== d.integrity, savedAt: d.savedAt || null };
}
export { monthText };
