// Колір на око · раунд: що загадати, з чого почати, як оцінити. Без DOM.
import { hsbToRgb, rgbToHsb, toHex, fromHex, deltaE, accuracyFromDE, advice, randomHsb, orderAccuracy } from './color.js';

const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

// r — генератор випадкових чисел (див. rng у color.js)
export function makeRound(level, r) {
  const g = level.gen || {};
  if (level.mode === 'order') return makeOrder(level, r);
  if (level.mode === 'pick') return makePick(level, r);
  if (level.mode === 'lights') return makeLights(level, r);
  if (level.mode === 'wheel') return makeWheel(level, r);
  const target = randomHsb(r, g);
  let start;
  if (level.mode === 'hue') {
    let h; do { h = Math.round(r() * 360); } while (hueDist(h, target.h) < 60);
    start = { h, s: target.s, b: target.b };
  } else if (level.mode === 'sb') {
    do { start = { h: target.h, s: Math.round(r() * 100), b: Math.round(20 + r() * 80) }; } while (deltaE(hsbToRgb(start), hsbToRgb(target)) < 15);
  } else {
    do { start = randomHsb(r, { s: [0, 100], b: [15, 100] }); } while (deltaE(hsbToRgb(start), hsbToRgb(target)) < 20);
  }
  return { target, targets: [target], start };
}

// «Змішування світла»: три лампи — червона, зелена, синя. Кожна вимкнена, (на половину) або увімкнена.
const LAMPS = ['Червоне', 'Зелене', 'Синє'];
const LIGHT_SETS = {
  one: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  two: [[1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1]],
  all: [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1], [0, 0, 0]],
  // одна лампа на половину, решта вимкнені або увімкнені: помаранчевий, фіолетовий, рожевий…
  half: [[2, 1, 0], [2, 0, 1], [1, 2, 0], [0, 2, 1], [1, 0, 2], [0, 1, 2], [2, 2, 1], [2, 1, 2], [1, 2, 2]],
};
export const lampsRgb = (l, steps) => { const v = x => Math.round(255 * x / (steps - 1)); return { r: v(l[0]), g: v(l[1]), b: v(l[2]) }; };
function makeLights(level, r) {
  const set = LIGHT_SETS[level.set], steps = level.set === 'half' ? 3 : 2;
  const want = set[Math.floor(r() * set.length)];
  const off = want.every(x => !x), start = off ? [steps - 1, steps - 1, steps - 1] : [0, 0, 0];
  const target = rgbToHsb(lampsRgb(want, steps));
  return { want, steps, startLamps: start, target, targets: [target], start: rgbToHsb(lampsRgb(start, steps)) };
}
function scoreLights(round, lamps) {
  const words = round.steps === 3 ? ['вимкнене', 'на половину', 'увімкнене'] : ['вимкнене', 'увімкнене'];
  const wrong = [0, 1, 2].filter(i => lamps[i] !== round.want[i]);
  const tips = wrong.length ? wrong.map(i => `${LAMPS[i]} світло має бути ${words[round.want[i]]}.`) : ['Точно! Саме так змішується цей колір.'];
  return { accuracy: Math.round((3 - wrong.length) / 3 * 100), correct: !wrong.length, target: lampsRgb(round.want, round.steps), user: lampsRgb(lamps, round.steps), tips };
}

// «Колірне коло»: 12 секторів, натиснути той, що в потрібному місці відносно бази.
export const SECTORS = 12;
export const sectorHsb = i => ({ h: ((i % SECTORS) + SECTORS) % SECTORS * 30, s: 85, b: 95 });
const RULES = {
  complement: { steps: [6], tip: 'Доповняльний колір — навпроти бази, на іншому боці кола.' },
  analog: { steps: [1, -1], tip: 'Аналогічний колір — сусід бази, поруч з нею.' },
  triad: { steps: [4, -4], tip: 'Тріада — три кольори на однаковій відстані, як вершини трикутника.' },
  split: { steps: [5, -5], tip: 'Роздільно-доповняльний — поруч із протилежним, на один сектор убік.' },
};
const secDist = (a, b) => { const d = Math.abs(a - b) % SECTORS; return Math.min(d, SECTORS - d); };
function makeWheel(level, r) {
  const base = Math.floor(r() * SECTORS);
  const answers = RULES[level.kind].steps.map(k => (base + k + SECTORS) % SECTORS);
  const target = sectorHsb(answers[0]);
  return { base, answers, target, targets: [target], start: sectorHsb(base) };
}
function scoreWheel(level, round, sec) {
  const d = Math.min(...round.answers.map(a => secDist(a, sec)));
  const near = round.answers.reduce((x, a) => secDist(a, sec) < secDist(x, sec) ? a : x);
  const accuracy = d === 0 ? 100 : d === 1 && sec !== round.base ? 50 : 0;
  const tips = d === 0 ? ['Так, саме тут.'] : [(d === 1 && sec !== round.base ? 'Правильне місце поруч. ' : '') + RULES[level.kind].tip];
  return { accuracy, correct: d === 0, target: hsbToRgb(sectorHsb(near)), user: hsbToRgb(sectorHsb(sec)), tips };
}

function makeOrder(level, r) {
  const n = level.tiles || 8;
  const h0 = Math.round(r() * 360);
  const ramp = Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    if (level.ramp === 'hue') return { h: (h0 + t * 280) % 360, s: 75, b: 92 };
    if (level.ramp === 'bright') return { h: h0, s: 65, b: 95 - t * 70 };
    if (level.ramp === 'sat') return { h: h0, s: t * 100, b: 85 };
    return { h: (h0 + t * 36) % 360, s: 55, b: 82 }; // subtle
  });
  // перемішуємо середину; крайні лишаються на місці
  const mid = ramp.map((_, i) => i).slice(1, -1);
  do { for (let i = mid.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [mid[i], mid[j]] = [mid[j], mid[i]]; } }
  while (mid.every((v, i) => v === i + 1));
  return { ramp, order: [0, ...mid, n - 1] };
}

// «Знайдіть колір»: вибір на око, без кодів.
//   same — зразок і кілька варіантів, один такий самий; odd — сітка однакових плиток, одна інша.
// diff — наскільки відрізняються «неправильні» кольори (ΔE): більше — легше.
const hsbHex = h => toHex(hsbToRgb(h));
function near(r, base, [lo, hi]) {
  const B = hsbToRgb(base);
  for (let k = 0; k < 600; k++) {
    const c = { h: (base.h + (r() * 2 - 1) * 70 + 360) % 360, s: Math.min(100, Math.max(0, base.s + (r() * 2 - 1) * 45)), b: Math.min(100, Math.max(15, base.b + (r() * 2 - 1) * 40)) };
    const d = deltaE(B, hsbToRgb(c));
    if (d >= lo && d <= hi) return c;
  }
  return { ...base, b: base.b > 55 ? base.b - 35 : base.b + 35 };
}
function makePick(level, r) {
  const diff = level.diff || [20, 40];
  const base = randomHsb(r, level.gen || { s: [35, 90], b: [45, 95] });
  if (level.ask === 'odd') {
    const n = level.tiles || 9, answer = Math.floor(r() * n), odd = near(r, base, diff);
    const options = Array.from({ length: n }, (_, i) => hsbHex(i === answer ? odd : base));
    const target = rgbToHsb(fromHex(options[answer]));
    return { ask: 'odd', options, answer, target, targets: [target], start: rgbToHsb(fromHex(hsbHex(base))) };
  }
  const n = level.options || 4, others = [];
  for (let k = 0; others.length < n - 1 && k < 400; k++) {
    const c = near(r, base, diff), C = hsbToRgb(c);
    if (others.every(o => deltaE(hsbToRgb(o), C) >= diff[0] * 0.6)) others.push(c);
  }
  const answer = Math.floor(r() * n);
  others.splice(answer, 0, base);
  const options = others.map(hsbHex), target = rgbToHsb(fromHex(options[answer]));
  return { ask: 'same', options, answer, target, targets: [target], start: rgbToHsb(fromHex(options[(answer + 1) % n])) };
}
function scorePick(round, choice) {
  const right = fromHex(round.options[round.answer]), ok = choice === round.answer;
  const mine = fromHex(round.options[choice] ?? round.options[round.answer]);
  let tips;
  if (round.ask === 'odd') tips = [ok ? 'Так, саме ця плитка відрізняється.' : 'Інша плитка обведена зеленим — порівняйте її з сусідніми.'];
  else tips = [ok ? 'Так, це той самий колір.' : 'Такий самий колір обведено зеленим — порівняйте його зі зразком.'];
  return { accuracy: ok ? 100 : 0, correct: ok, target: right, user: mine, tips };
}

// user — колір учня (HSB); для «по порядку» — масив індексів, для «знайдіть колір» — номер варіанта,
// для ламп — масив [r, g, b] положень, для кола — номер сектора
export function scoreRound(level, round, user) {
  if (level.mode === 'order') {
    const acc = orderAccuracy(user);
    const wrong = user.filter((v, i) => v !== i).length;
    return { accuracy: acc, tips: [wrong ? `Не на своїх місцях: ${wrong} ${wrong === 1 ? 'плитка' : wrong < 5 ? 'плитки' : 'плиток'}.` : 'Усі плитки на своїх місцях!'] };
  }
  if (level.mode === 'pick') return scorePick(round, user);
  if (level.mode === 'lights') return scoreLights(round, user);
  if (level.mode === 'wheel') return scoreWheel(level, round, user);
  const u = hsbToRgb(user);
  let best = null;
  for (const t of round.targets) {
    const rgb = hsbToRgb(t), de = deltaE(rgb, u);
    if (!best || de < best.de) best = { de, rgb, hsb: t };
  }
  return { accuracy: accuracyFromDE(best.de), de: best.de, target: best.rgb, targetHsb: best.hsb, user: u, tips: advice(best.rgb, u, level.mode === 'hue' ? 'hue' : level.mode === 'sb' ? 'sb' : null) };
}
