// Сліпий друк · розкладки клавіатури й пальці.
// Клавіші описано за фізичним місцем (як у KeyboardEvent.code), тож пальці однакові для обох розкладок.

// пальці: 0 — лівий мізинець … 3 — лівий вказівний, 4 — правий вказівний … 7 — правий мізинець, 8 — великі
export const FINGERS = ['лівий мізинець', 'лівий безіменний', 'лівий середній', 'лівий вказівний', 'правий вказівний', 'правий середній', 'правий безіменний', 'правий мізинець', 'великий палець'];

// [code, палець, ширина]
export const ROWS = [
  [['Backquote', 0], ['Digit1', 0], ['Digit2', 1], ['Digit3', 2], ['Digit4', 3], ['Digit5', 3], ['Digit6', 4], ['Digit7', 4], ['Digit8', 5], ['Digit9', 6], ['Digit0', 7], ['Minus', 7], ['Equal', 7], ['Backspace', 7, 2]],
  [['Tab', 0, 1.5], ['KeyQ', 0], ['KeyW', 1], ['KeyE', 2], ['KeyR', 3], ['KeyT', 3], ['KeyY', 4], ['KeyU', 4], ['KeyI', 5], ['KeyO', 6], ['KeyP', 7], ['BracketLeft', 7], ['BracketRight', 7], ['Backslash', 7, 1.5]],
  [['CapsLock', 0, 1.75], ['KeyA', 0], ['KeyS', 1], ['KeyD', 2], ['KeyF', 3], ['KeyG', 3], ['KeyH', 4], ['KeyJ', 4], ['KeyK', 5], ['KeyL', 6], ['Semicolon', 7], ['Quote', 7], ['Enter', 7, 2.25]],
  [['ShiftLeft', 0, 2.3], ['KeyZ', 0], ['KeyX', 1], ['KeyC', 2], ['KeyV', 3], ['KeyB', 3], ['KeyN', 4], ['KeyM', 4], ['Comma', 5], ['Period', 6], ['Slash', 7], ['ShiftRight', 7, 2.7]],
  [['Space', 8, 6.5]],
];
export const HOME_KEYS = ['KeyF', 'KeyJ']; // клавіші з виступами

// символи без Shift і з Shift для кожної клавіші
const EN = {
  Backquote: '`~', Digit1: '1!', Digit2: '2@', Digit3: '3#', Digit4: '4$', Digit5: '5%', Digit6: '6^', Digit7: '7&', Digit8: '8*', Digit9: '9(', Digit0: '0)', Minus: '-_', Equal: '=+',
  KeyQ: 'qQ', KeyW: 'wW', KeyE: 'eE', KeyR: 'rR', KeyT: 'tT', KeyY: 'yY', KeyU: 'uU', KeyI: 'iI', KeyO: 'oO', KeyP: 'pP', BracketLeft: '[{', BracketRight: ']}', Backslash: '\\|',
  KeyA: 'aA', KeyS: 'sS', KeyD: 'dD', KeyF: 'fF', KeyG: 'gG', KeyH: 'hH', KeyJ: 'jJ', KeyK: 'kK', KeyL: 'lL', Semicolon: ';:', Quote: '\'"',
  KeyZ: 'zZ', KeyX: 'xX', KeyC: 'cC', KeyV: 'vV', KeyB: 'bB', KeyN: 'nN', KeyM: 'mM', Comma: ',<', Period: '.>', Slash: '/?', Space: '  ',
};
const UK = {
  Backquote: '\'₴', Digit1: '1!', Digit2: '2"', Digit3: '3№', Digit4: '4;', Digit5: '5%', Digit6: '6:', Digit7: '7?', Digit8: '8*', Digit9: '9(', Digit0: '0)', Minus: '-_', Equal: '=+',
  KeyQ: 'йЙ', KeyW: 'цЦ', KeyE: 'уУ', KeyR: 'кК', KeyT: 'еЕ', KeyY: 'нН', KeyU: 'гГ', KeyI: 'шШ', KeyO: 'щЩ', KeyP: 'зЗ', BracketLeft: 'хХ', BracketRight: 'їЇ', Backslash: 'ґҐ',
  KeyA: 'фФ', KeyS: 'іІ', KeyD: 'вВ', KeyF: 'аА', KeyG: 'пП', KeyH: 'рР', KeyJ: 'оО', KeyK: 'лЛ', KeyL: 'дД', Semicolon: 'жЖ', Quote: 'єЄ',
  KeyZ: 'яЯ', KeyX: 'чЧ', KeyC: 'сС', KeyV: 'мМ', KeyB: 'иИ', KeyN: 'тТ', KeyM: 'ьЬ', Comma: 'бБ', Period: 'юЮ', Slash: '.,', Space: '  ',
};
export const LAYOUTS = {
  uk: { id: 'uk', name: 'Українська', short: 'УКР', map: UK, test: /[а-яіїєґʼ’]/i, switchHint: 'Перемкніть розкладку на українську (Win + Пробіл або Alt + Shift).' },
  en: { id: 'en', name: 'English', short: 'ENG', map: EN, test: /[a-z]/i, switchHint: 'Switch the keyboard layout to English (Win + Space or Alt + Shift).' },
};

const fingerOf = Object.fromEntries(ROWS.flat().map(([code, f]) => [code, f]));
// символ → { code, shift, finger } для поточної розкладки
export function keyFor(layout, ch) {
  if (ch === ' ') return { code: 'Space', shift: false, finger: 8 };
  if (ch === '\n') return { code: 'Enter', shift: false, finger: 7 };
  const map = LAYOUTS[layout].map;
  for (const code in map) {
    const i = map[code].indexOf(ch);
    if (i === 0 || i === 1) return { code, shift: i === 1, finger: fingerOf[code] };
  }
  return null;
}
// Shift натискаємо протилежною рукою
export const shiftFor = finger => (finger <= 3 ? 'ShiftRight' : 'ShiftLeft');
export const labelFor = (layout, code) => {
  const v = LAYOUTS[layout].map[code];
  if (v) return v[0] === ' ' ? '' : v[0].toUpperCase() === v[1] ? v[1] : v[0];
  return { Backspace: 'Backspace', Tab: 'Tab', CapsLock: 'Caps', Enter: 'Enter', ShiftLeft: 'Shift', ShiftRight: 'Shift', Space: '' }[code] || '';
};

// що вважати однаковим: різні апострофи
export const normChar = ch => (ch === '’' || ch === 'ʼ' || ch === '`' ? '\'' : ch);
