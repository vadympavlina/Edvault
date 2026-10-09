// Гарячі клавіші · розбір комбінацій і перевірка натискань. Без DOM — перевіряється тестами.
//
// Комбінація записується як «Ctrl+Shift+Z», «F5», «Win+D», «Ctrl+=».
// Порівнюємо за фізичною клавішею (event.code), тож Ctrl+C працює і з українською розкладкою.
// На Mac клавіша Cmd рахується як Ctrl.

const NAMED = {
  Esc: 'Escape', Enter: 'Enter', Tab: 'Tab', Space: 'Space', Backspace: 'Backspace', Delete: 'Delete', Del: 'Delete',
  Home: 'Home', End: 'End', PgUp: 'PageUp', PgDn: 'PageDown', PrtSc: 'PrintScreen', Insert: 'Insert',
  '←': 'ArrowLeft', '→': 'ArrowRight', '↑': 'ArrowUp', '↓': 'ArrowDown',
  '=': 'Equal', '-': 'Minus', '.': 'Period', ',': 'Comma', '/': 'Slash', ';': 'Semicolon', '[': 'BracketLeft', ']': 'BracketRight',
};
// альтернативні фізичні клавіші: «+» і «−» на цифровому блоці теж змінюють масштаб
const ALIASES = { Equal: ['NumpadAdd'], Minus: ['NumpadSubtract'], Digit0: ['Numpad0'], Enter: ['NumpadEnter'] };
const MODS = ['Ctrl', 'Shift', 'Alt', 'Win'];

export function codeOf(key) {
  if (NAMED[key]) return NAMED[key];
  if (/^F([1-9]|1[0-2])$/.test(key)) return key;
  if (/^[A-Z]$/.test(key)) return 'Key' + key;
  if (/^[0-9]$/.test(key)) return 'Digit' + key;
  throw new Error('невідома клавіша: ' + key);
}

export function parseCombo(str) {
  const parts = str.split('+').map(s => s.trim());
  // «Ctrl+=» і «Ctrl++» — останній «+» є клавішею
  if (str.endsWith('++')) { parts.pop(); parts[parts.length - 1] = '='; }
  const key = parts.pop();
  const mods = { ctrl: false, shift: false, alt: false, win: false };
  for (const m of parts) { if (!MODS.includes(m)) throw new Error('невідомий модифікатор: ' + m); mods[m.toLowerCase()] = true; }
  return { ...mods, key, code: codeOf(key) };
}

// Подія клавіатури (або схожий об’єкт) → чи це саме ця комбінація
export function matches(ev, combo) {
  const c = typeof combo === 'string' ? parseCombo(combo) : combo;
  const codes = [c.code, ...(ALIASES[c.code] || [])];
  if (!codes.includes(ev.code)) return false;
  const ctrl = !!(ev.ctrlKey || ev.metaKey);
  return ctrl === c.ctrl && !!ev.shiftKey === c.shift && !!ev.altKey === c.alt;
}

// Що натиснув учень — у зрозумілому вигляді: «Ctrl + Shift + Z»
const CODE_LABEL = { Escape: 'Esc', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Equal: '=', Minus: '−', Period: '.', Comma: ',', Slash: '/', Semicolon: ';', BracketLeft: '[', BracketRight: ']',
  PageUp: 'PgUp', PageDown: 'PgDn', PrintScreen: 'PrtSc', NumpadAdd: '+', NumpadSubtract: '−', Space: 'Пробіл', Backquote: '`', Quote: "'", Backslash: '\\', CapsLock: 'Caps Lock' };
export function keyLabel(code) {
  if (CODE_LABEL[code]) return CODE_LABEL[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^(Digit|Numpad)\d$/.test(code)) return code.slice(-1);
  return code;
}
export const isModifier = code => /^(Control|Shift|Alt|Meta|OS)(Left|Right)?$/.test(code);
export function pressedKeys(ev) {
  const out = [];
  if (ev.ctrlKey || ev.metaKey) out.push('Ctrl');
  if (ev.shiftKey) out.push('Shift');
  if (ev.altKey) out.push('Alt');
  if (!isModifier(ev.code)) out.push(keyLabel(ev.code));
  return out;
}
export const comboKeys = str => { const c = parseCombo(str); return [...MODS.filter(m => c[m.toLowerCase()]), c.key === '-' ? '−' : c.key]; };
export const comboLabel = str => comboKeys(str).join(' + ');

// Бал за завдання: з першої спроби — 1; з підказкою або після 1–2 помилок — 0,5; показали відповідь — 0
export function scorePress({ wrong = 0, hint = false, gaveUp = false }) {
  if (gaveUp || wrong >= 3) return 0;
  return wrong || hint ? 0.5 : 1;
}
export const starsFor = avg => avg >= 0.9 ? 3 : avg >= 0.7 ? 2 : 1;
