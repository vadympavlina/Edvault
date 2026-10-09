// UI/UX-дизайнер · макети інтерфейсів з опису (без DOM — лише рядок HTML).
// Макет: { bg, fg, pad, gap, w, blocks: [...] }. Кожен блок може мати p — назву частини
// (на неї можна клацнути в завданні «знайди проблему», її підсвічують у розборі).
// Кольори макетів власні — це «картинка» застосунку, вона не залежить від теми сторінки.

const P = {
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  dots: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  wifi: '<path d="M12 20h.01M2 8.82a15 15 0 0 1 20 0M5 12.859a10 10 0 0 1 14 0M8.5 16.429a5 5 0 0 1 7 0"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  ball: '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24"/><circle cx="12" cy="12" r="4"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
};
export const MOCK_ICONS = P;
const ico = (n, s = 16, c = 'currentColor', sw = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="flex:none;display:block">${P[n] || P.info}</svg>`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const css = o => Object.entries(o).filter(([, v]) => v != null && v !== false && v !== '').map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${typeof v === 'number' && !/^(fontWeight|lineHeight|opacity|flex|zIndex)$/.test(k) ? v + 'px' : v}`).join(';');
const part = (b, inner, style = {}, tag = 'div') => `<${tag}${b.p ? ` class="mp" data-p="${esc(b.p)}"` : ''} style="${css({ ...style, marginTop: b.mt, marginLeft: b.indent })}">${inner}</${tag}>`;

const BTN = {
  primary: (b, ac) => ({ background: b.bg || ac, color: b.fg || '#fff', border: `1.5px solid ${b.bg || ac}` }),
  outline: (b, ac) => ({ background: b.bg || 'transparent', color: b.fg || ac, border: `1.5px solid ${b.bc || ac}` }),
  soft: (b, ac) => ({ background: b.bg || '#eef2ff', color: b.fg || ac, border: '1.5px solid transparent' }),
  ghost: (b, ac) => ({ background: 'transparent', color: b.fg || ac, border: '1.5px solid transparent' }),
  danger: b => ({ background: b.bg || '#dc2626', color: b.fg || '#fff', border: `1.5px solid ${b.bg || '#dc2626'}` }),
  gray: b => ({ background: b.bg || '#e5e7eb', color: b.fg || '#374151', border: '1.5px solid transparent' }),
};
function button(b, M) {
  const st = (BTN[b.kind || 'primary'] || BTN.primary)(b, M.accent);
  const h = b.h ?? 42, size = b.size ?? 14;
  const pad = b.iconOnly ? 0 : b.px ?? Math.max(8, Math.round(h * .4));
  return part(b, `${b.icon ? ico(b.icon, Math.round(size * 1.15)) : ''}${b.iconOnly ? '' : `<span>${esc(b.text)}</span>`}`, {
    ...st, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: h, minWidth: b.iconOnly ? h : null, width: b.iconOnly ? h : b.w,
    padding: `0 ${pad}px`, borderRadius: b.radius ?? 10, fontSize: size, fontWeight: b.weight ?? 650, flex: b.full ? '1 1 auto' : 'none', textDecoration: b.underline ? 'underline' : null,
    alignSelf: b.full ? 'stretch' : b.self || 'flex-start', whiteSpace: 'nowrap', lineHeight: 1.2,
  });
}

const R = {
  h: (b, M) => part(b, esc(b.text), { fontSize: b.size ?? 20, fontWeight: b.weight ?? 750, color: b.color || M.fg, lineHeight: 1.25, textAlign: b.align, textTransform: b.caps ? 'uppercase' : null, letterSpacing: b.caps ? '.04em' : null }),
  p: (b, M) => part(b, esc(b.text).replace(/\n\n/g, `<span style="display:block;height:${b.pgap ?? 10}px"></span>`), {
    fontSize: b.size ?? 14, lineHeight: b.lh ?? 1.55, color: b.color || M.muted, textAlign: b.align, fontWeight: b.weight, textTransform: b.caps ? 'uppercase' : null,
    marginLeft: b.flush ? -M.pad : null, maxWidth: b.maxw, fontStyle: b.italic ? 'italic' : null }),
  meta: (b, M) => part(b, `${b.icon ? ico(b.icon, Math.round((b.size ?? 12.5) * 1.15)) : ''}<span>${esc(b.text)}</span>`, { display: 'flex', alignItems: 'center', gap: 6, fontSize: b.size ?? 12.5, color: b.color || M.soft, fontWeight: b.weight ?? 500, lineHeight: 1.35, justifyContent: b.align === 'center' ? 'center' : null }),
  img: (b, M) => {
    const shade = b.shade ? `<div style="position:absolute;inset:0;background:linear-gradient(transparent 20%, rgba(0,0,0,${b.shade}))"></div>` : '';
    const title = b.title ? `<div style="position:absolute;left:14px;right:14px;bottom:12px;color:${b.titleColor || '#fff'};font-size:${b.titleSize ?? 18}px;font-weight:750;line-height:1.25">${esc(b.title)}</div>` : '';
    return part(b, `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.85)">${b.title ? '' : ico(b.icon || 'image', 38, 'currentColor', 1.6)}</div>${b.title ? `<div style="position:absolute;right:16px;top:14px;color:rgba(255,255,255,.75)">${ico(b.icon || 'image', 30, 'currentColor', 1.6)}</div>` : ''}${shade}${title}`,
      { position: 'relative', height: b.h ?? 120, borderRadius: b.radius ?? 12, background: `linear-gradient(135deg, ${b.from || '#a5b4fc'}, ${b.to || '#f0abfc'})`, overflow: 'hidden', margin: b.bleed ? `-${M.pad}px -${M.pad}px 0` : null });
  },
  btn: (b, M) => button(b, M),
  btns: (b, M) => part(b, b.items.map(x => button(x, M)).join(''), { display: 'flex', flexDirection: b.dir === 'col' ? 'column' : 'row', gap: b.gap ?? 8, justifyContent: b.justify || 'flex-start', flexWrap: 'wrap' }),
  field: (b, M) => {
    const err = b.err && b.errPos !== 'none';
    const bc = b.bc || (b.err ? '#dc2626' : '#d1d5db');
    const label = b.label && b.labelPos !== 'none' ? `<div style="font-size:${b.lsize ?? 13}px;font-weight:600;color:${b.lcolor || M.fg};text-align:${b.labelPos === 'center' ? 'center' : 'left'}">${esc(b.label)}${b.req ? '<span style="color:#dc2626"> *</span>' : ''}</div>` : '';
    const val = b.value ? `<span style="color:${M.fg}">${esc(b.type === 'password' && !b.show ? '•'.repeat(b.value.length) : b.value)}</span>` : `<span style="color:${b.phColor || '#9ca3af'}">${esc(b.ph || '')}</span>`;
    const input = `<div style="display:flex;align-items:center;gap:8px;height:${b.h ?? 40}px;padding:0 12px;border:1.5px solid ${bc};border-radius:9px;background:#fff;font-size:14px;overflow:hidden;white-space:nowrap">${val}<span style="flex:1"></span>${b.type === 'password' ? ico('eye', 16, '#9ca3af') : ''}${b.errIcon ? ico('alert', 16, '#dc2626') : ''}</div>`;
    const msg = err ? `<div style="display:flex;gap:6px;align-items:flex-start;font-size:12.5px;line-height:1.4;color:${b.errColor || '#dc2626'}">${b.errIcon ? ico('alert', 14, 'currentColor') : ''}<span>${esc(b.err)}</span></div>` : '';
    return part(b, label + input + msg, { display: 'flex', flexDirection: 'column', gap: b.labelGap ?? 6 });
  },
  space: b => `<div style="height:${b.h ?? 8}px;margin-top:${-(b.cancel ?? 0)}px"></div>`,
  row: (b, M) => part(b, b.items.map(x => R[x.t](x, M)).join(''), { display: 'flex', alignItems: b.align || 'center', justifyContent: b.justify || 'space-between', gap: b.gap ?? 10, flexWrap: b.wrap ? 'wrap' : null }),
  col: (b, M) => part(b, b.items.map(x => R[x.t](x, M)).join(''), { display: 'flex', flexDirection: 'column', gap: b.gap ?? 4, flex: b.grow ? 1 : null, minWidth: 0, alignItems: b.align }),
  price: (b, M) => part(b, esc(b.text), { fontSize: b.size ?? 20, fontWeight: b.weight ?? 800, color: b.color || M.fg, lineHeight: 1.2, whiteSpace: 'nowrap' }),
  list: (b, M) => part(b, b.items.map((x, i) => `<div${x.p ? ` class="mp" data-p="${esc(x.p)}"` : ''} style="${css({ display: 'flex', alignItems: 'center', gap: b.igap ?? 12, padding: `${b.ipad ?? 10}px 0`, borderTop: b.divider && i ? '1px solid #eef0f3' : null, marginLeft: x.indent })}">
      ${x.icon ? `<span style="${css({ width: b.isize ?? 34, height: b.isize ?? 34, borderRadius: 9, background: x.ibg || '#eef2ff', color: x.ic || M.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' })}">${ico(x.icon, Math.round((b.isize ?? 34) * .5))}</span>` : ''}
      ${x.dot ? `<span style="width:10px;height:10px;border-radius:50%;background:${x.dot};flex:none"></span>` : ''}
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><span style="font-size:${x.size ?? 14}px;font-weight:${x.bold ? 750 : b.weight ?? 550};color:${x.color || M.fg};line-height:1.35">${esc(x.t)}</span>${x.s ? `<span style="font-size:12px;color:${M.soft};line-height:1.35">${esc(x.s)}</span>` : ''}</span>
      ${x.right ? `<span style="font-size:${x.rsize ?? 14}px;font-weight:${x.rweight ?? 700};color:${x.rcolor || M.fg};white-space:nowrap">${esc(x.right)}</span>` : ''}
      ${x.toggle != null ? `<span style="width:38px;height:22px;border-radius:11px;background:${x.toggle ? M.accent : '#d1d5db'};position:relative;flex:none"><span style="position:absolute;top:3px;${x.toggle ? 'right' : 'left'}:3px;width:16px;height:16px;border-radius:50%;background:#fff"></span></span>` : ''}
      ${x.chev ? ico('chevron', 16, '#9ca3af') : ''}
      ${x.acts ? `<span style="display:flex;gap:${x.agap ?? 6}px">${x.acts.map(a => `<span${a.p ? ` class="mp" data-p="${esc(a.p)}"` : ''} style="width:${a.s ?? 32}px;height:${a.s ?? 32}px;border-radius:8px;background:${a.bg || '#f3f4f6'};color:${a.c || '#4b5563'};display:flex;align-items:center;justify-content:center">${ico(a.icon, Math.max(8, Math.round((a.s ?? 32) * .5)))}</span>`).join('')}</span>` : ''}
    </div>`).join(''), { display: 'flex', flexDirection: 'column', gap: b.gap ?? 0 }),
  alert: (b, M) => {
    const c = { error: ['#dc2626', '#fef2f2', 'alert'], ok: ['#059669', '#ecfdf5', 'check'], info: [M.accent, '#eff6ff', 'info'] }[b.kind || 'info'];
    return part(b, `${b.icon !== false ? ico(c[2], 18, c[0]) : ''}<div style="display:flex;flex-direction:column;gap:2px;min-width:0">${b.title ? `<b style="font-size:13.5px;color:${b.tcolor || c[0]}">${esc(b.title)}</b>` : ''}${b.text ? `<span style="font-size:13px;line-height:1.45;color:${b.color || M.fg}">${esc(b.text)}</span>` : ''}</div>`,
      { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: b.bg || c[1], border: b.plain ? null : `1px solid ${c[0]}33` });
  },
  nav: (b, M) => part(b, b.items.map((x, i) => { const on = i === b.active && b.mark !== false; const c = on ? M.accent : b.color || '#6b7280';
    return `<span style="${css({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: c, padding: `${b.ipad ?? 6}px 0`, fontSize: 11, fontWeight: on ? 700 : 550, background: on && b.pill ? '#eef2ff' : null, borderRadius: 10 })}">${ico(x.icon, b.isize ?? 20)}${b.labels === false ? '' : `<span style="white-space:nowrap">${esc(x.label)}</span>`}</span>`; }).join(''),
    { display: 'flex', gap: b.gap ?? 4, borderTop: '1px solid #eef0f3', padding: '6px 4px 0', margin: `0 -${M.pad / 2}px` }),
  stat: (b, M) => part(b, `<span style="font-size:${b.lsize ?? 13}px;color:${b.lcolor || M.soft};font-weight:${b.lweight ?? 550}">${esc(b.label)}</span><span style="font-size:${b.vsize ?? 30}px;font-weight:${b.vweight ?? 800};color:${b.vcolor || M.fg};line-height:1.1">${esc(b.value)}</span>${b.sub ? `<span style="font-size:12px;color:${b.subColor || '#059669'};font-weight:600">${esc(b.sub)}</span>` : ''}`,
    { display: 'flex', flexDirection: b.reverse ? 'column-reverse' : 'column', gap: 4, padding: 12, borderRadius: 12, background: b.bg || '#f8fafc', flex: 1, minWidth: 0 }),
  tags: (b, M) => part(b, b.items.map((x, i) => `<span style="padding:4px 10px;border-radius:20px;font-size:12px;font-weight:650;background:${(b.colors || [])[i] || '#eef2ff'};color:${(b.fgs || [])[i] || M.accent}">${esc(x)}</span>`).join(''), { display: 'flex', gap: 6, flexWrap: 'wrap' }),
  check: (b, M) => part(b, `<span style="${css({ width: b.s ?? 20, height: b.s ?? 20, borderRadius: 5, border: `1.5px solid ${b.on ? M.accent : '#9ca3af'}`, background: b.on ? M.accent : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' })}">${b.on ? ico('check', Math.round((b.s ?? 20) * .7), '#fff', 3) : ''}</span>${b.label ? `<span style="font-size:${b.size ?? 13.5}px;color:${M.fg};line-height:1.4">${esc(b.label)}</span>` : ''}`,
    { display: 'flex', alignItems: 'center', gap: b.lgap ?? 10, padding: b.rowPad ? `${b.rowPad}px 10px` : null, borderRadius: 10, background: b.rowPad ? '#f8fafc' : null }),
  link: (b, M) => part(b, esc(b.text), { fontSize: b.size ?? 13.5, color: b.color || M.accent, textDecoration: b.underline === false ? 'none' : 'underline', fontWeight: b.weight ?? 550, textAlign: b.align }),
  user: (b, M) => part(b, `<span style="width:36px;height:36px;border-radius:50%;background:${b.ac || '#c7d2fe'};color:#3730a3;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex:none">${esc(b.name[0])}</span><span style="display:flex;flex-direction:column;gap:1px;min-width:0"><b style="font-size:13.5px;color:${M.fg}">${esc(b.name)}</b><span style="font-size:12px;color:${M.soft}">${esc(b.sub)}</span></span>`, { display: 'flex', alignItems: 'center', gap: 10 }),
  bar: (b, M) => part(b, `${b.back ? ico('back', 18, M.fg) : ''}<b style="flex:1;font-size:${b.size ?? 16}px;color:${M.fg};text-align:${b.center ? 'center' : 'left'}">${esc(b.text)}</b>${(b.icons || []).map(n => ico(n, 19, M.muted)).join('')}`,
    { display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 10, borderBottom: '1px solid #eef0f3', margin: `0 -${M.pad / 2}px`, padding: `0 ${M.pad / 2}px 10px` }),
  div: () => '<div style="height:1px;background:#eef0f3"></div>',
};

// Макет → HTML
export function mock(spec) {
  const M = { bg: spec.bg || '#ffffff', fg: spec.fg || '#111827', muted: spec.muted || '#4b5563', soft: spec.soft || '#6b7280', accent: spec.accent || '#2563eb', pad: spec.pad ?? 18 };
  const body = spec.blocks.map(b => { if (!R[b.t]) throw new Error('невідомий блок ' + b.t); return R[b.t](b, M); }).join('');
  return `<div class="mock-ui" style="${css({ background: M.bg, color: M.fg, padding: M.pad, gap: spec.gap ?? 12, textAlign: spec.align, width: spec.w })}">${body}</div>`;
}
// Усі назви частин у макеті (для перевірок)
export function partsOf(spec) {
  const out = [];
  const walk = b => { if (b.p) out.push(b.p); (b.items || []).forEach(x => { if (x && typeof x === 'object') { if (x.p) out.push(x.p); (x.acts || []).forEach(a => a.p && out.push(a.p)); if (x.t) walk(x); } }); };
  spec.blocks.forEach(walk);
  return [...new Set(out)];
}
