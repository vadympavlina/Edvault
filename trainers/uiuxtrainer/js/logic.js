// UI/UX-дизайнер · контраст кольорів (WCAG) і бали. Без DOM — перевіряється тестами.

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) throw new Error('не колір: ' + hex);
  let h = m[1]; if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const luminance = hex => { const [r, g, b] = hexToRgb(hex).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
// Контраст тексту й тла: від 1 (не видно) до 21 (чорне на білому)
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
// Оцінка контрасту для звичайного тексту
export const contrastLevel = r => r >= 7 ? 'відмінно' : r >= 4.5 ? 'добре' : r >= 3 ? 'лише для великого тексту' : 'погано';
export const fmtRatio = r => (Math.round(r * 10) / 10).toString().replace('.', ',') + ' : 1';

export const starsFor = avg => avg >= 0.9 ? 3 : avg >= 0.7 ? 2 : 1;
// «Виправ сам»: з підказкою — половина балу
export const fixScore = hint => hint ? 0.5 : 1;
