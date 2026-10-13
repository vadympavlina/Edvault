// Симулятор стартапу · збереження всієї гри у файл і відкриття з файлу.
// Файл містить повний стан гри (усі рішення, історію тижнів, пошту, журнал, бізнес-план, бренд, команду…),
// стан інтерфейсу й короткий підсумок, який викладач може прочитати навіть у блокноті.
import { okState, money, num, pct, dateText, WEEKS } from './sim.js';

export const FILE_APP = 'edvault-startup';
export const FILE_FORMAT = 1;

// Контрольна сума (FNV-1a): показує, чи файл змінювали вручну після збереження
export function checksum(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const STATUS = { bankrupt: 'компанія закрилася (закінчилися гроші)', sold: 'компанію продано', time: 'гру завершено: минуло 2 роки' };

export function summaryOf(S) {
  const s = S.s, I = S.I;
  return {
    'Учень': s.founder.name,
    'Клас або група': s.founder.group || '—',
    'Компанія': s.company.name,
    'Ідея': `${I.t}${I.custom ? ' (власна ідея)' : ''}`,
    'Тиждень': `${s.week + 1} з ${WEEKS} (${dateText(s.week)})`,
    'Стан гри': s.over ? STATUS[s.over.kind] : 'гра триває',
    'Гроші': money(s.cash),
    'Активні користувачі': num(S.activeUsers()),
    'Платні клієнти': num(S.paidUsers()),
    'Виручка на місяць (MRR)': money(S.mrr()),
    'Оцінка компанії': money(S.valuation()),
    'Частка учня': pct(S.stake(), 1),
    "Інтерв'ю з клієнтами": String(Object.values(s.know).reduce((a, k) => a + k.n, 0)),
    'Досягнення': String(Object.keys(s.ach).length),
    'Записів у журналі рішень': String((s.journal || []).length),
  };
}

// Транслітерація за офіційними правилами (постанова КМУ № 55): назва файлу латиницею
// відкривається однаково в усіх браузерах і системах
const TR = { а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia', ы: 'y', э: 'e', ё: 'io', ъ: '' };
const FIRST = { є: 'ye', ї: 'yi', й: 'y', ю: 'yu', я: 'ya' };
export function translit(str) {
  return String(str || '').replace(/[зЗ][гГ]/g, m => m[0] === 'З' ? 'Zgh' : 'zgh').replace(/[\u0400-\u04FF]/g, (ch, i, all) => {
    const lo = ch.toLowerCase(), start = i === 0 || !/[\u0400-\u04FF']/.test(all[i - 1]);
    const t = (start && FIRST[lo]) || TR[lo] || '';
    return ch !== lo && t ? t[0].toUpperCase() + t.slice(1) : t;
  }).replace(/['’ʼ`]/g, '');
}
// Безпечна назва файлу: startup_Kompaniia_Imia-Prizvyshche_tyzhden-12.json
export function fileName(S) {
  const clean = x => translit(x).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
  return ['startup', clean(S.s.company.name) || 'kompaniia', clean(S.s.founder.name), `tyzhden-${S.s.week + 1}`].filter(Boolean).join('_') + '.json';
}

export function packGame(S, ui = {}) {
  const state = JSON.parse(JSON.stringify(S.s));
  return {
    app: FILE_APP, format: FILE_FORMAT, savedAt: new Date().toISOString(),
    about: 'Збережена гра «Симулятор стартапу» (edvault.online/emulators/startup). Відкрийте її в симуляторі кнопкою «Відкрити з файлу».',
    summary: summaryOf(S),
    integrity: checksum(JSON.stringify(state)),
    ui: JSON.parse(JSON.stringify(ui)),
    state,
  };
}

// Розбирає текст файлу. Повертає { ok, state, ui, edited, savedAt, summary } або { ok: false, error }
export function unpackGame(text) {
  let data;
  try { data = JSON.parse(String(text).replace(/^﻿/, '')); } catch { return { ok: false, error: 'Це не файл збереження: його не вдалося прочитати.' }; }
  if (!data || typeof data !== 'object') return { ok: false, error: 'Це не файл збереження симулятора стартапу.' };
  // підтримка «голого» стану (наприклад, скопійованого з localStorage)
  const state = data.state ?? data.s ?? (data.v === 1 && data.cap ? data : null);
  if (data.app && data.app !== FILE_APP) return { ok: false, error: 'Цей файл належить іншому інструменту, а не симулятору стартапу.' };
  if (data.format > FILE_FORMAT) return { ok: false, error: 'Файл збережено новішою версією симулятора. Оновіть сторінку й спробуйте ще раз.' };
  if (!okState(state)) return { ok: false, error: 'Файл пошкоджений або це не збереження симулятора стартапу.' };
  const edited = !!data.integrity && checksum(JSON.stringify(state)) !== data.integrity;
  return { ok: true, state, ui: data.ui && typeof data.ui === 'object' ? data.ui : { view: data.view || 'dash' }, edited, savedAt: data.savedAt || null, summary: data.summary || null };
}
