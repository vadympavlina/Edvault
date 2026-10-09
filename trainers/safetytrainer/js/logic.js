// Безпека в інтернеті · розбір адрес, надійність паролів, підрахунок балів. Без DOM — перевіряється тестами.

/* ── адреси ── */
// Доменні зони з двох частин: «sonyah.com.ua» — це сайт sonyah, а не com.
const SECOND_LEVEL = ['com.ua', 'org.ua', 'net.ua', 'in.ua', 'gov.ua', 'edu.ua', 'kiev.ua', 'lviv.ua', 'co.uk', 'org.uk', 'com.pl'];
export function registrable(host) {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.');
  const tail2 = labels.slice(-2).join('.');
  return labels.slice(SECOND_LEVEL.includes(tail2) ? -3 : -2).join('.');
}

// Розбиває адресу на шматки для показу: протокол, «user@», піддомени, справжній домен, порт, шлях.
export function parseUrl(url) {
  const m = url.match(/^([a-z]+:\/\/)?([^/?#]*)(.*)$/i);
  const scheme = m[1] || '', authority = m[2], rest = m[3];
  const at = authority.lastIndexOf('@');
  const userinfo = at >= 0 ? authority.slice(0, at + 1) : '';
  const hostPort = authority.slice(at + 1);
  const [host, port] = hostPort.split(':');
  const domain = registrable(host);
  const sub = host.slice(0, host.length - domain.length);
  const chunks = [];
  if (scheme) chunks.push({ t: scheme, part: 'scheme' });
  if (userinfo) chunks.push({ t: userinfo, part: 'userinfo' });
  if (sub) for (const l of sub.match(/[^.]+\./g)) chunks.push({ t: l, part: 'sub' });
  chunks.push({ t: domain, part: 'domain' });
  if (port) chunks.push({ t: ':' + port, part: 'port' });
  if (rest) chunks.push({ t: rest, part: 'path' });
  return { scheme, secure: scheme.toLowerCase() === 'https://', userinfo, host, domain, sub, path: rest, chunks };
}

/* ── паролі ── */
export const COMMON = ['123456', '123456789', '12345678', '1234567', '12345', '1234', '111111', '000000', '123123', '654321', '666666', '121212', '112233',
  'qwerty', 'qwerty123', 'qwertyuiop', 'asdfgh', 'zxcvbn', '1q2w3e', '1q2w3e4r', 'password', 'password1', 'passw0rd', 'iloveyou', 'admin', 'welcome',
  'football', 'monkey', 'dragon', 'sunshine', 'princess', 'letmein', 'master', 'hello', 'freedom', 'whatever', 'qazwsx', 'trustno1',
  'йцукен', 'йцукенгшщз', 'пароль', 'привіт', 'привет', 'кохаю', 'україна', 'ukraine', 'slavaukraini', 'kyiv', 'minecraft', 'roblox', 'fortnite'];
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'йцукенгшщзхї', 'фівапролджє', 'ячсмитьбю', '1234567890', 'abcdefghijklmnopqrstuvwxyz', 'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя'];

// Скільки «справді випадкових» символів у паролі: послідовності, повтори, роки, слова з профілю важать мало.
function effectiveLength(pw, personal) {
  const low = pw.toLowerCase();
  const weight = Array(pw.length).fill(1);
  const mark = (i, n, w) => { for (let k = i; k < i + n; k++) weight[k] = Math.min(weight[k], w); };
  for (const word of personal) {
    const w = word.toLowerCase(); if (w.length < 3) continue;
    let i = low.indexOf(w); while (i >= 0) { mark(i, w.length, 0.15); i = low.indexOf(w, i + 1); }
  }
  for (const c of COMMON) { if (c.length < 4) continue; let i = low.indexOf(c); while (i >= 0) { mark(i, c.length, 0.15); i = low.indexOf(c, i + 1); } }
  for (let i = 0; i + 3 <= low.length; i++) {
    const s = low.slice(i, i + 3);
    if (ROWS.some(r => r.includes(s) || [...r].reverse().join('').includes(s))) mark(i, 3, 0.3);
    if (s[0] === s[1] && s[1] === s[2]) mark(i, 3, 0.2);
  }
  const yr = /(19|20)\d\d/g; let m;
  while ((m = yr.exec(low))) mark(m.index, 4, 0.3);
  return weight.reduce((a, b) => a + b, 0);
}
export function strength(pw, personal = []) {
  if (!pw) return { bits: 0, score: 0, label: 'немає пароля', time: '—' };
  const low = pw.toLowerCase();
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[а-яґєії]/.test(pw)) pool += 33;
  if (/[А-ЯҐЄІЇ]/.test(pw)) pool += 33;
  if (/\d/.test(pw)) pool += 10;
  if (/[^\p{L}\p{N}]/u.test(pw)) pool += 33;
  let bits = effectiveLength(pw, personal) * Math.log2(Math.max(pool, 10));
  // фраза-пароль: кілька звичайних слів через роздільник — довга й легко запам’ятовується
  const words = pw.split(/[\s\-_.,+]+/).filter(w => /^\p{L}{3,}$/u.test(w) && !personal.some(p => p.length >= 3 && w.toLowerCase().includes(p.toLowerCase())));
  if (words.length >= 3) bits = Math.max(bits, words.length * 12.5);
  if (COMMON.includes(low) || COMMON.includes(low.replace(/[!.]+$/, ''))) bits = Math.min(bits, 8);
  bits = Math.round(bits * 10) / 10;
  const score = bits < 28 ? 0 : bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  return { bits, score, label: ['дуже слабкий', 'слабкий', 'середній', 'надійний', 'дуже надійний'][score], time: crackTime(bits) };
}
// Час підбору: 10 мільярдів спроб за секунду (потужний комп’ютер зловмисника).
const plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c;
export function crackTime(bits) {
  const s = Math.pow(2, bits) / 2 / 1e10;
  if (s < 1) return 'миттєво';
  const U = [[60, ['секунда', 'секунди', 'секунд']], [60, ['хвилина', 'хвилини', 'хвилин']], [24, ['година', 'години', 'годин']], [30, ['день', 'дні', 'днів']], [12, ['місяць', 'місяці', 'місяців']], [1000, ['рік', 'роки', 'років']]];
  let v = s;
  for (const [k, names] of U) { if (v < k) { const n = Math.max(1, Math.round(v)); return `${n} ${plural(n, ...names)}`; } v /= k; }
  return v < 1000 ? 'тисячі років' : v < 1e6 ? 'мільйони років' : v < 1.4e7 ? 'мільярди років' : 'довше, ніж існує Всесвіт';
}

/* ── бали за завдання (0…1) ── */
// Вибір кількох: влучання мінус зайві.
export function scorePick(correct, picked) {
  const hit = picked.filter(x => correct.includes(x)).length, wrong = picked.length - hit;
  return correct.length ? Math.max(0, Math.min(1, (hit - wrong) / correct.length)) : (wrong ? 0 : 1);
}
export const starsFor = avg => avg >= 0.9 ? 3 : avg >= 0.7 ? 2 : 1;

/* ── розмітка повідомлень ── */
// «{текст|пояснення}» — підозріла частина; решта ділиться на речення, які теж можна позначити (але це помилка).
export function segments(str) {
  const out = [];
  const re = /\{([^|{}]+)\|([^{}]+)\}/g;
  let last = 0, m;
  const plain = s => { for (const p of s.split(/(?<=[.!?:;])\s+/)) if (p.trim()) out.push({ t: p, flag: null }); else if (p) out.push({ t: p, space: true }); };
  while ((m = re.exec(str))) { plain(str.slice(last, m.index)); out.push({ t: m[1], flag: m[2] }); last = m.index + m[0].length; }
  plain(str.slice(last));
  return out;
}
