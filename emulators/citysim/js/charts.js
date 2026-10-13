// Симулятор міста · графіки (SVG): лінійні, стовпчики, діаграма розсіювання з лінією тренду й кореляцією.
import { esc } from './ui.js';

const nice = v => { const a = Math.abs(v); return a >= 1e6 ? (v / 1e6).toFixed(1).replace('.0', '').replace('.', ',') + ' млн' : a >= 1e4 ? Math.round(v / 1e3) + ' тис.' : a >= 100 ? Math.round(v).toLocaleString('uk-UA').replace(/\s/g, ' ') : String(Math.round(v * 100) / 100).replace('.', ','); };

// series: [{ v: [], color, label, area, dash }]
export function lineChart(series, { h = 160, labels = [], fmt = nice, zero = true, unit = '' } = {}) {
  const W = 560, H = h, pl = 46, pr = 10, pt = 10, pb = 22;
  const all = series.flatMap(s => s.v).filter(Number.isFinite);
  if (all.length < 2) return '<p class="empty">Дані з’являться через місяць-два</p>';
  let mn = Math.min(...all), mx = Math.max(...all); if (zero) mn = Math.min(0, mn); if (mx === mn) mx = mn + 1;
  const n = Math.max(...series.map(s => s.v.length)), X = i => pl + (n <= 1 ? 0 : (i / (n - 1)) * (W - pl - pr)), Y = v => pt + (1 - (v - mn) / (mx - mn)) * (H - pt - pb);
  const grid = [0, 0.25, 0.5, 0.75, 1].map(k => { const v = mn + (mx - mn) * k, y = Y(v); return `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" class="gl"/><text x="${pl - 6}" y="${y + 3.5}" text-anchor="end" class="gt">${esc(fmt(v))}</text>`; }).join('');
  const step = Math.max(1, Math.ceil(n / 6)), xl = labels.map((l, i) => i % step === 0 || i === n - 1 ? `<text x="${X(i)}" y="${H - 6}" text-anchor="middle" class="gt">${esc(l)}</text>` : '').join('');
  const lines = series.map(s => { const pts = s.v.map((v, i) => Number.isFinite(v) ? `${X(i).toFixed(1)},${Y(v).toFixed(1)}` : null).filter(Boolean); if (!pts.length) return ''; const d = 'M' + pts.join('L'); return `${s.area ? `<path d="${d}L${X(s.v.length - 1)},${Y(Math.max(mn, 0))}L${X(0)},${Y(Math.max(mn, 0))}Z" fill="${s.color}" opacity=".12"/>` : ''}<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.2" ${s.dash ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round"/><circle cx="${pts.at(-1).split(',')[0]}" cy="${pts.at(-1).split(',')[1]}" r="3" fill="${s.color}"/>`; }).join('');
  const legend = series.length > 1 || series[0].label ? `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.label || '')}</span>`).join('')}</div>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map(s => s.label).join(', '))}">${grid}${xl}${lines}</svg>${legend}`;
}

// [{ label, v, color }]
export function bars(items, { fmt = nice, max } = {}) {
  const m = max || Math.max(1, ...items.map(x => Math.abs(x.v)));
  return `<div class="bars">${items.map(x => `<div class="bar"><span class="bl">${esc(x.label)}</span><span class="bt"><i style="width:${Math.min(100, Math.abs(x.v) / m * 100)}%;background:${x.color || 'var(--acc)'}"></i></span><b>${esc(fmt(x.v))}</b></div>`).join('')}</div>`;
}

// Коефіцієнт кореляції Пірсона й лінія тренду
export function corr(xs, ys) {
  const n = xs.length; if (n < 3) return { r: 0, a: 0, b: 0 };
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  const r = sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0, b = sxx ? sxy / sxx : 0;
  return { r, b, a: my - b * mx };
}
export function corrWords(r) {
  const a = Math.abs(r), str = a > 0.7 ? 'сильний' : a > 0.4 ? 'помітний' : a > 0.2 ? 'слабкий' : 'майже немає';
  if (a <= 0.2) return 'Зв’язку майже немає: одне мало пов’язане з іншим.';
  return `${str[0].toUpperCase() + str.slice(1)} ${r > 0 ? 'прямий' : 'обернений'} зв’язок: ${r > 0 ? 'коли одне зростає, інше теж зазвичай зростає' : 'коли одне зростає, інше зазвичай зменшується'}.`;
}
export function scatter(pts, { xl = '', yl = '', xmax, ymax, color = '#6366f1' } = {}) {
  const W = 560, H = 300, pl = 44, pr = 12, pt = 12, pb = 34;
  if (pts.length < 3) return '<p class="empty">Замало даних: заселіть більше районів</p>';
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x1 = xmax ?? (Math.max(...xs) * 1.05 || 1), y1 = ymax ?? (Math.max(...ys) * 1.05 || 1);
  const X = v => pl + (v / x1) * (W - pl - pr), Y = v => pt + (1 - v / y1) * (H - pt - pb);
  const { r, a, b } = corr(xs, ys);
  const dots = pts.map(p => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${(2.2 + Math.sqrt(p.w || 1) * 0.35).toFixed(1)}" fill="${color}" opacity=".55"/>`).join('');
  const ty0 = a, ty1 = a + b * x1;
  const grid = [0, 0.5, 1].map(k => `<line x1="${pl}" x2="${W - pr}" y1="${Y(y1 * k)}" y2="${Y(y1 * k)}" class="gl"/><text x="${pl - 6}" y="${Y(y1 * k) + 3.5}" text-anchor="end" class="gt">${esc(nice(y1 * k))}</text><text x="${X(x1 * k)}" y="${H - 18}" text-anchor="middle" class="gt">${esc(nice(x1 * k))}</text>`).join('');
  return { svg: `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Діаграма розсіювання">${grid}${dots}<line x1="${X(0)}" y1="${Y(ty0)}" x2="${X(x1)}" y2="${Y(ty1)}" stroke="#ef4444" stroke-width="2.4" stroke-dasharray="6 4"/><text x="${(pl + W) / 2}" y="${H - 3}" text-anchor="middle" class="ax">${esc(xl)} →</text><text x="12" y="${pt + 8}" class="ax" transform="rotate(-90 12 ${pt + 8})" text-anchor="end">${esc(yl)} →</text></svg>`, r };
}
