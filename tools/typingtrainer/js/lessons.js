// Сліпий друк · рівні, генератор вправ і оцінка. Без DOM.
import { WORDS, SENTENCES, PROVERBS, TEXTS, VOWELS } from './words.js';

export const CHAPTERS = [
  { id: 'home', name: 'Основний ряд', desc: 'Пальці лежать на основному ряду — звідси вони тягнуться до всіх інших клавіш.', cpm: 60 },
  { id: 'top', name: 'Верхній ряд', desc: 'Пальці тягнуться вгору й одразу повертаються на основний ряд.', cpm: 80 },
  { id: 'bottom', name: 'Нижній ряд', desc: 'Тепер униз. Після цього розділу — уся абетка.', cpm: 90 },
  { id: 'shift', name: 'Великі літери, знаки й цифри', desc: 'Shift натискайте мізинцем протилежної руки.', cpm: 100 },
  { id: 'text', name: 'Справжній текст', desc: 'Речення, прислів’я й цілі абзаци — як у житті.', cpm: 120 },
];

const K = (chapter, keys, name) => ({ chapter, kind: 'keys', keys, name: name || 'Клавіші ' + [...keys].map(c => c.toUpperCase()).join(' '), id: chapter + '-' + keys });
const W = (chapter, name) => ({ chapter, kind: 'words', keys: '', name, id: chapter + '-words' });
export const LEVELS = {
  uk: [
    K('home', 'ао', 'А і О — вказівні пальці'), K('home', 'вл'), K('home', 'ід'), K('home', 'фж'), K('home', 'пр'), K('home', 'є'), W('home', 'Слова з основного ряду'),
    K('top', 'ке'), K('top', 'нг'), K('top', 'уш'), K('top', 'цщ'), K('top', 'йз'), K('top', 'хї'), W('top', 'Слова з двох рядів'),
    K('bottom', 'ми'), K('bottom', 'ть'), K('bottom', 'сб'), K('bottom', 'чю'), K('bottom', 'я', 'Клавіша Я'), W('bottom', 'Уся абетка'),
    { chapter: 'shift', kind: 'caps', id: 'shift-caps', name: 'Великі літери' },
    { chapter: 'shift', kind: 'punct', id: 'shift-punct', name: 'Кома й крапка' },
    { chapter: 'shift', kind: 'apos', id: 'shift-apos', name: 'Апостроф' },
    { chapter: 'shift', kind: 'digits', id: 'shift-digits', name: 'Цифри' },
    { chapter: 'text', kind: 'sentences', id: 'text-sent', name: 'Короткі речення' },
    { chapter: 'text', kind: 'proverbs', id: 'text-prov', name: 'Прислів’я' },
    { chapter: 'text', kind: 'text', id: 'text-long', name: 'Цілий абзац' },
  ],
  en: [
    K('home', 'fj', 'F і J — вказівні пальці'), K('home', 'dk'), K('home', 'sl'), K('home', 'a', 'Клавіша A'), K('home', 'gh'), W('home', 'Слова з основного ряду'),
    K('top', 'ei'), K('top', 'ru'), K('top', 'ty'), K('top', 'wo'), K('top', 'qp'), W('top', 'Слова з двох рядів'),
    K('bottom', 'vm'), K('bottom', 'cx'), K('bottom', 'bn'), K('bottom', 'z', 'Клавіша Z'), W('bottom', 'Уся абетка'),
    { chapter: 'shift', kind: 'caps', id: 'shift-caps', name: 'Великі літери' },
    { chapter: 'shift', kind: 'punct', id: 'shift-punct', name: 'Кома й крапка' },
    { chapter: 'shift', kind: 'apos', id: 'shift-apos', name: 'Апостроф' },
    { chapter: 'shift', kind: 'digits', id: 'shift-digits', name: 'Цифри' },
    { chapter: 'text', kind: 'sentences', id: 'text-sent', name: 'Короткі речення' },
    { chapter: 'text', kind: 'proverbs', id: 'text-prov', name: 'Прислів’я' },
    { chapter: 'text', kind: 'text', id: 'text-long', name: 'Цілий абзац' },
  ],
};

// літери, вивчені до рівня включно
export function lettersUpTo(layout, index) {
  return [...new Set(LEVELS[layout].slice(0, index + 1).filter(l => l.kind === 'keys').flatMap(l => [...l.keys]))].join('');
}
const wordList = layout => [...new Set(WORDS[layout].split(/\s+/).filter(Boolean))];
const dash = s => s.replace(/[—–]/g, '-');
const pick = (arr, r) => arr[Math.floor(r() * arr.length)];
const shuffle = (arr, r) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// «слово» з дозволених літер, з обов'язковою новою літерою; голосні й приголосні чергуються, якщо можна
function pseudo(allowed, focus, r, len) {
  const vow = [...allowed].filter(c => VOWELS.uk.includes(c) || VOWELS.en.includes(c)), con = [...allowed].filter(c => !vow.includes(c));
  let w = '';
  let v = r() < 0.5;
  for (let i = 0; i < len; i++) {
    const from = (v ? vow : con).length ? (v ? vow : con) : [...allowed];
    w += pick(from, r); v = !v;
  }
  if (focus && ![...w].some(c => focus.includes(c))) { const i = Math.floor(r() * w.length); w = w.slice(0, i) + pick([...focus], r) + w.slice(i + 1); }
  return w;
}
// справжні слова, що складаються лише з вивчених літер
export function wordsFrom(layout, allowed, focus = '') {
  const ok = w => [...w].every(c => allowed.includes(c));
  const list = wordList(layout).filter(w => !w.includes('\'') && ok(w));
  return focus ? list.filter(w => [...w].some(c => focus.includes(c))) : list;
}

// Текст вправи. r — генератор випадкових чисел, size — орієнтовна довжина в символах
export function makeText(layout, index, r, size = 160) {
  const L = LEVELS[layout][index];
  const allLetters = lettersUpTo(layout, LEVELS[layout].length - 1);
  const words = [];
  const fill = gen => { let n = 0; while (words.join(' ').length < size && n++ < 200) words.push(gen()); };
  if (L.kind === 'keys' || L.kind === 'words') {
    const allowed = lettersUpTo(layout, index).replace(/[;.,/]/g, '');
    const focus = L.kind === 'keys' ? L.keys.replace(/[;.,/]/g, '') : '';
    const real = wordsFrom(layout, allowed, focus), any = wordsFrom(layout, allowed);
    fill(() => {
      const useReal = real.length >= 6 ? r() < 0.75 : any.length >= 12 && r() < 0.35;
      if (useReal) return pick(real.length >= 6 ? real : any, r);
      return pseudo(allowed, focus || allowed, r, 2 + Math.floor(r() * (allowed.length < 6 ? 3 : 4)));
    });
    return words.join(' ');
  }
  const all = wordsFrom(layout, allLetters);
  if (L.kind === 'caps') { fill(() => { const w = pick(all, r); return r() < 0.6 ? w[0].toUpperCase() + w.slice(1) : w; }); return words.join(' '); }
  if (L.kind === 'punct') {
    const out = [];
    while (out.join(' ').length < size) {
      const n = 2 + Math.floor(r() * 4), part = Array.from({ length: n }, () => pick(all, r));
      part[0] = part[0][0].toUpperCase() + part[0].slice(1);
      if (n > 3) part[1] += ',';
      out.push(part.join(' ') + '.');
    }
    return out.join(' ');
  }
  if (L.kind === 'apos') {
    const ap = wordList(layout).filter(w => w.includes('\''));
    const base = ap.length ? ap : (layout === 'en' ? ['don\'t', 'it\'s', 'I\'m', 'can\'t', 'won\'t', 'let\'s', 'you\'re', 'we\'re', 'that\'s', 'isn\'t'] : []);
    const pool = layout === 'en' ? ['don\'t', 'it\'s', 'I\'m', 'can\'t', 'won\'t', 'let\'s', 'you\'re', 'we\'re', 'that\'s', 'isn\'t'] : base;
    fill(() => (r() < 0.5 ? pick(pool, r) : pick(all, r)));
    return words.join(' ');
  }
  if (L.kind === 'digits') {
    fill(() => (r() < 0.5 ? String(Math.floor(r() * (r() < 0.5 ? 100 : 2100))) : pick(all, r)));
    return words.join(' ');
  }
  if (L.kind === 'sentences') { const s = shuffle(SENTENCES[layout], r); let t = ''; for (const x of s) { if (t.length > size) break; t += (t ? ' ' : '') + x; } return dash(t); }
  if (L.kind === 'proverbs') { const s = shuffle(PROVERBS[layout], r); let t = ''; for (const x of s) { if (t.length > size) break; t += (t ? ' ' : '') + x; } return dash(t); }
  return dash(pick(TEXTS[layout], r));
}

// Підсумок вправи: швидкість (знаків за хвилину) і точність (частка натискань без помилки)
export function summary({ chars, strokes, errors, ms }) {
  const minutes = Math.max(ms, 1000) / 60000;
  const cpm = Math.round(chars / minutes);
  const acc = strokes ? Math.round((strokes - errors) / strokes * 1000) / 10 : 100;
  return { cpm, wpm: Math.round(cpm / 5), acc };
}
// зірки: точність — головне, швидкість — для другої й третьої
export function starsFor(chapterId, cpm, acc) {
  const target = CHAPTERS.find(c => c.id === chapterId).cpm;
  if (acc < 90) return 0;
  if (acc >= 97 && cpm >= target) return 3;
  if (acc >= 94 && cpm >= target * 0.7) return 2;
  return 1;
}

// вправа зі слабких клавіш: слова, де вони трапляються, і склади з ними
export function weakText(layout, weak, r, size = 160) {
  const all = wordList(layout).filter(w => !w.includes('\''));
  const has = all.filter(w => [...w].some(c => weak.includes(c)));
  const words = [];
  while (words.join(' ').length < size) words.push(r() < 0.7 && has.length ? pick(has, r) : pseudo(weak + (layout === 'uk' ? 'аоіе' : 'aeio'), weak, r, 3 + Math.floor(r() * 2)));
  return words.join(' ');
}
