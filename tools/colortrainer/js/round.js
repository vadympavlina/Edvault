// Колір на око · раунд: що загадати, з чого почати, як оцінити. Без DOM.
import { hsbToRgb, deltaE, accuracyFromDE, advice, randomHsb, harmonyTargets, orderAccuracy } from './color.js';

const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

// r — генератор випадкових чисел (див. rng у color.js)
export function makeRound(level, r) {
  const g = level.gen || {};
  if (level.mode === 'order') return makeOrder(level, r);
  if (level.mode === 'harmony') {
    const base = randomHsb(r, g), targets = harmonyTargets(base, level.kind);
    // старт — не на базовому кольорі й далеко від правильних відповідей
    let h; do { h = Math.round(r() * 360); } while (hueDist(h, base.h) < 20 || targets.some(t => hueDist(h, t.h) < 45));
    return { base, targets, start: { h, s: base.s, b: base.b } };
  }
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

// user — колір учня (HSB) або для «по порядку» — масив індексів
export function scoreRound(level, round, user) {
  if (level.mode === 'order') {
    const acc = orderAccuracy(user);
    const wrong = user.filter((v, i) => v !== i).length;
    return { accuracy: acc, tips: [wrong ? `Не на своїх місцях: ${wrong} ${wrong === 1 ? 'плитка' : wrong < 5 ? 'плитки' : 'плиток'}.` : 'Усі плитки на своїх місцях!'] };
  }
  const u = hsbToRgb(user);
  let best = null;
  for (const t of round.targets) {
    const rgb = hsbToRgb(t), de = deltaE(rgb, u);
    if (!best || de < best.de) best = { de, rgb, hsb: t };
  }
  return { accuracy: accuracyFromDE(best.de), de: best.de, target: best.rgb, targetHsb: best.hsb, user: u, tips: advice(best.rgb, u, level.mode === 'hue' || level.mode === 'harmony' ? 'hue' : level.mode === 'sb' ? 'sb' : null) };
}
