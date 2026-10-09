// Колір на око · розрахунки кольору: HSB/RGB/HEX/Lab, різниця кольорів ΔE2000, оцінка й підказки.
// Без DOM — працює і в сторінці, і в Node (тести).

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// h 0..360, s 0..100, b 0..100 → { r, g, b } 0..255
export function hsbToRgb({ h, s, b }) {
  s /= 100; b /= 100;
  const k = n => (n + h / 60) % 6;
  const f = n => b * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
  return { r: Math.round(f(5) * 255), g: Math.round(f(3) * 255), b: Math.round(f(1) * 255) };
}
export function rgbToHsb({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s: max ? d / max * 100 : 0, b: max * 100 };
}
export const toHex = ({ r, g, b }) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase();
export function fromHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: n >> 16, g: (n >> 8) & 255, b: n & 255 };
}
export const css = rgb => `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

// sRGB → CIE Lab (D65)
export function rgbToLab({ r, g, b }) {
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return { L: 116 * f(Y) - 16, a: 500 * (f(X) - f(Y)), b: 200 * (f(Y) - f(Z)) };
}

// Різниця кольорів CIEDE2000: ~1 — майже не видно, 2–3 — помітно зблизька, 5+ — явно інший колір
export const deltaE = (rgb1, rgb2) => deltaELab(rgbToLab(rgb1), rgbToLab(rgb2));
export function deltaELab(A, B) {
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const C1 = Math.hypot(A.a, A.b), C2 = Math.hypot(B.a, B.b), Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1 = A.a * (1 + G), a2 = B.a * (1 + G);
  const c1 = Math.hypot(a1, A.b), c2 = Math.hypot(a2, B.b);
  const h = (x, y) => { if (!x && !y) return 0; const v = Math.atan2(y, x) * deg; return v < 0 ? v + 360 : v; };
  const h1 = h(a1, A.b), h2 = h(a2, B.b);
  const dL = B.L - A.L, dC = c2 - c1;
  let dh = 0;
  if (c1 * c2) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(c1 * c2) * Math.sin(dh / 2 * rad);
  const Lm = (A.L + B.L) / 2, cm = (c1 + c2) / 2;
  let hm = h1 + h2;
  if (c1 * c2) { if (Math.abs(h1 - h2) > 180) hm += h1 + h2 < 360 ? 360 : -360; hm /= 2; }
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hm - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(cm ** 7 / (cm ** 7 + 25 ** 7));
  const Sl = 1 + 0.015 * (Lm - 50) ** 2 / Math.sqrt(20 + (Lm - 50) ** 2);
  const Sc = 1 + 0.045 * cm, Sh = 1 + 0.015 * cm * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}

// точність у відсотках за ΔE: 2 → 90%, 5 → 75%, 10 → 50%
export const accuracyFromDE = de => Math.round(clamp(100 - de * 5, 0, 100));
export const STAR_LEVELS = [65, 80, 90];
export const starsFor = acc => STAR_LEVELS.filter(v => acc >= v).length;

// назви відтінків — для підказок
const HUES = [[0, 'червоного'], [30, 'помаранчевого'], [55, 'жовтого'], [90, 'салатового'], [125, 'зеленого'], [175, 'бірюзового'], [205, 'блакитного'], [235, 'синього'], [275, 'фіолетового'], [315, 'рожевого'], [345, 'червоного']];
export function hueName(h) {
  h = ((h % 360) + 360) % 360;
  let best = HUES[0];
  for (const x of HUES) if (Math.abs(x[0] - h) < Math.abs(best[0] - h)) best = x;
  return best[1];
}
// Підказка, що змінити: світлість і насиченість — за Lab, відтінок — за HSB.
// only — які підказки доречні: 'hue' (рухається лише відтінок), 'sb' (лише квадрат) або все
export function advice(target, user, only) {
  const de = deltaE(target, user);
  if (de < 2) return ['Майже ідеально — різниці майже не видно.'];
  const T = rgbToLab(target), U = rgbToLab(user);
  const tips = [];
  const dL = T.L - U.L;
  if (only !== 'hue' && Math.abs(dL) > 3) tips.push((Math.abs(dL) > 12 ? 'Значно ' : 'Трохи ') + (dL > 0 ? 'світліше' : 'темніше') + '.');
  const tc = Math.hypot(T.a, T.b), uc = Math.hypot(U.a, U.b), dC = tc - uc;
  if (only !== 'hue' && Math.abs(dC) > 5) tips.push(dC > 0 ? 'Насиченіше — колір має бути яскравішим.' : 'Менш насичено — ближче до сірого.');
  const th = rgbToHsb(target), uh = rgbToHsb(user);
  if (only !== 'sb' && tc > 8 && uc > 4 && th.s > 12) {
    let d = th.h - uh.h; if (d > 180) d -= 360; if (d < -180) d += 360;
    if (Math.abs(d) > 5) tips.push(`Зсуньте відтінок у бік ${hueName(uh.h + Math.sign(d) * 35)}.`);
  }
  return tips.length ? tips : ['Дуже близько — спробуйте дрібні зміни.'];
}

// ── генератор випадкових кольорів (з насінням — щоб тести були стабільні) ──
export function rng(seed = Date.now()) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const lerp = (a, b, t) => a + (b - a) * t;
export function randomHsb(r, { s = [40, 90], b = [50, 95], h = [0, 360] } = {}) {
  return { h: Math.round(lerp(h[0], h[1], r())) % 360, s: Math.round(lerp(s[0], s[1], r())), b: Math.round(lerp(b[0], b[1], r())) };
}

// гармонії: які відтінки рахуються правильними
export const HARMONY = {
  complement: { name: 'доповняльний', offsets: [180] },
  triad: { name: 'тріадний', offsets: [120, -120] },
  analog: { name: 'аналогічний', offsets: [30, -30] },
  split: { name: 'роздільно-доповняльний', offsets: [150, -150] },
};
export function harmonyTargets(base, kind) {
  return HARMONY[kind].offsets.map(o => ({ ...base, h: (base.h + o + 360) % 360 }));
}

// оцінка розстановки плиток: наскільки далеко кожна від свого місця
export function orderAccuracy(order) {
  const n = order.length;
  if (n < 2) return 100;
  const err = order.reduce((s, v, i) => s + Math.abs(v - i), 0);
  const max = Math.floor(n * n / 2);
  return Math.round(clamp(100 - err / max * 220, 0, 100));
}
