// Симулятор блогера · оцінка власних фото й відео за виміряними показниками кадру (без DOM — працює і в тестах).
// an: lum — яскравість 0..1, con — контраст, sharp — різкість, col — насиченість, intro — секунди без руху на початку, motion — рух.
export const LK_MAX = 90; // Лайкер приймає відео до 90 с

const DARK = 0.22, WASHED = 0.78, BLUR = 15, SHARP = 120, VIVID = 55;
export const vertical = g => g.h > g.w * 1.15;
export const fmtDur = s => { s = Math.round(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// Перевірки для Галереї: [назва, значення, стан ok|warn|bad]
export function checks(g) {
  const a = g.an || {}, out = [];
  if (g.type === 'video') {
    out.push(['Тривалість', fmtDur(g.dur), g.dur > LK_MAX ? 'warn' : 'ok']);
    out.push(['Формат', vertical(g) ? 'Вертикальне — для стрічки й коротких відео' : 'Горизонтальне — для відеоплатформи', 'ok']);
    out.push(['Початок', a.motion < 0.004 ? 'Майже нічого не рухається' : a.intro >= 1 ? `Перші ≈${Math.round(a.intro)} с нічого не відбувається — варто обрізати` : 'Дія з перших секунд', a.motion < 0.004 || a.intro >= 1 ? 'warn' : 'ok']);
  }
  out.push(['Світло', a.lum < DARK ? 'Темне — допоможе фільтр «Яскраво»' : a.lum > WASHED && a.con < 0.12 ? 'Пересвічене, бляклe' : 'Добре видно', a.lum < DARK ? 'bad' : a.lum > WASHED && a.con < 0.12 ? 'warn' : 'ok']);
  out.push(['Чіткість', a.sharp < BLUR && a.con > 0.05 ? 'Розмите' : a.sharp >= SHARP ? 'Чітке' : 'Нормальна', a.sharp < BLUR && a.con > 0.05 ? 'bad' : 'ok']);
  out.push(['Кольори', a.col >= VIVID ? 'Соковиті' : a.con < 0.08 && a.lum >= DARK ? 'Сірі, мало контрасту' : a.col < 8 ? 'Майже чорно-білі' : 'Звичайні', a.con < 0.08 && a.lum >= DARK ? 'warn' : 'ok']);
  const small = Math.min(g.w, g.h) < (g.type === 'video' ? 360 : 480);
  out.push(['Розмір', `${g.w}×${g.h}${small ? ' — замалий' : ''}`, small ? 'bad' : 'ok']);
  return out;
}

// Якість кадру для моделі охоплення.
// o: { filter (запис FILTERS), start, end, app: 'lk' | 'tube' }
export function judge(g, o = {}) {
  const a = g.an || {}, why = [], flags = {};
  const good = (d, t) => { q += d; why.push(['+', t]); }, bad = (d, t) => { q -= d; why.push(['-', t]); };
  let q = 0.62;
  const f = o.filter || {};
  if (a.lum < DARK) { flags.dark = true; if (f.fix) good(0.03, 'Фільтр «Яскраво» виправив темний кадр'); else bad(g.type === 'video' ? 0.12 : 0.16, g.type === 'video' ? 'Темне відео — погано видно' : 'Темне фото — погано видно'); }
  else if (a.lum > WASHED && a.con < 0.12) { flags.washed = true; bad(0.1, 'Пересвічений, бляклий кадр'); }
  else if (a.con < 0.08) { flags.dull = true; if (f.id === 'vivid') good(0.02, 'Фільтр «Соковито» додав контрасту'); else bad(0.06, 'Мало контрасту — кадр здається сірим'); }
  if (a.sharp < BLUR && a.con > 0.05) { flags.blur = true; bad(g.type === 'video' ? 0.1 : 0.14, g.type === 'video' ? 'Розмите відео' : 'Розмите фото'); }
  else if (a.sharp >= SHARP && g.type !== 'video') good(0.03, 'Чітке фото');
  if (a.col >= VIVID && f.id !== 'mono') good(0.04, 'Соковиті кольори привертають увагу');
  if (Math.min(g.w, g.h) < (g.type === 'video' ? 360 : 480)) { flags.lowres = true; bad(0.08, 'Мала роздільність — виглядає нечітко'); }
  if (g.type === 'video') {
    const start = o.start || 0, end = o.end ?? g.dur, len = Math.max(1, end - start), vert = vertical(g);
    flags.len = len; flags.vert = vert;
    if (a.motion < 0.004) { flags.still = true; bad(0.08, 'Майже нічого не рухається — схоже на фото'); }
    else if (a.intro >= 1 && start < a.intro - 0.5) { flags.intro = true; bad(0.12, `Довгий початок: перші ≈${Math.round(a.intro - start)} с нічого не відбувається`); }
    else good(0.08, 'Цікавий початок — глядачі не гортають далі');
    if (o.app === 'tube') {
      if (!vert) good(0.03, 'Горизонтальне відео — на весь екран плеєра');
      else if (len > 60) bad(0.06, 'Вертикальне довге відео: у плеєрі чорні смуги з боків');
    } else {
      if (vert) good(0.05, 'Вертикальне відео на весь екран телефону'); else bad(0.04, 'Горизонтальне відео в стрічці виглядає дрібним');
      if (len <= 20) good(0.05, 'Коротке відео дивляться до кінця'); else if (len > 45) { flags.long = true; bad(0.06, 'Задовге відео для стрічки'); }
    }
  }
  return { q: Math.max(0.1, Math.min(0.95, q)), why, flags };
}
