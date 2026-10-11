// Симулятор блогера · створення допису: вибір фото/відео, редактор, опис і хештеги, публікація або історія.
import { icon } from './icons.js';
import { photo, video } from './art.js';
import { esc, toast, sw, confirm, actions } from './ui.js';
import { SCENES, CLIPS, MUSIC, FILTERS, STICKERS, TAGS, BRANDS, CREATORS, nicheOf } from './data.js';
import { clock, hourOf, dayOf, DAY, lc, num } from './sim.js';
import { LK_MAX, fmtDur, vertical } from './quality.js';
import { fileBtn, thumb, topicOptions } from './gal.js';

const MAX_SLIDES = 10;
// копія власного файлу в дописі: допис не зламається, якщо файл приберуть із Галереї
export const snap = g => (g?.own ? { own: true, type: g.type, mid: g.mid, w: g.w, h: g.h, dur: g.dur, an: g.an, topic: g.topic } : null);
// дані відео для монтажу: вбудований кліп або власне
const vinfo = (s, d) => { if (d.own) { const g = s.gallery.find(x => x.id === d.gid); return g ? { dur: g.dur, intro: g.an?.intro || 0, g } : null; } const c = CLIPS[d.clip]; return c ? { dur: c.dur, intro: c.intro } : null; };
const blank = () => ({ filter: 'none', text: '', textY: 'bottom', sticker: '' });

const KINDS = [['photo', 'image', 'Фото'], ['video', 'video', 'Відео'], ['text', 'text', 'Допис'], ['story', 'spark', 'Історія']];
const PLACES = ['', 'Київ', 'Парк Шевченка', 'Біля дому', 'Школа №1', 'Бабусина дача'];
const BGS = ['#5c6bc0', '#e1306c', '#26a69a', '#ff7043', '#7e57c2', '#37474f'];

export function openCreate(ph, o = {}) {
  ph.open('likeer');
  const lk = ph.apps.likeer;
  if (!ph.sim.s.me) return;
  const d = { kind: o.kind || 'photo', step: o.gid ? 'edit' : 'pick', gid: o.gid || null, gids: o.gid ? [o.gid] : [], ed: {}, multi: false, own: false, filter: 'none', text: '', textY: 'bottom', sticker: '', crop: '45', tool: 'filter', clip: o.clip || null, start: 0, end: null, title: '', music: 'none', caption: '', place: '', commentsOff: false, ad: '', adMarked: true, collab: false, when: 'now', sched: '', bg: BGS[0], txt: '', poll: false, pq: '', pa: ['', ''], story: 'photo' };
  if (o.gid) { const g = ph.sim.s.gallery.find(x => x.id === o.gid); if (g?.type === 'video') { d.kind = 'video'; d.gids = []; setVideo(d, g); } }
  // продовжити чернетку
  if (o.draft) { Object.assign(d, JSON.parse(JSON.stringify(o.draft)), { draftId: o.draft.id }); delete d.id; delete d.t; d.gids ||= d.gid && d.kind === 'photo' ? [d.gid] : []; d.ed ||= {}; }
  // допис за ідеєю із застосунку «Ідеї»
  if (o.idea) { d.idea = o.idea.text; d.ideaId = o.idea.id; }
  lk.stack = lk.stack.filter(x => x.v !== 'create');
  lk.stack.push({ v: 'create', d }); ph.render(true);
}

function setVideo(d, g) {
  d.gid = g.id; d.start = 0; d.own = !!g.own;
  if (g.own) { d.clip = null; d.end = Math.min(g.dur, LK_MAX); if (!d.music || d.music === 'none') d.music = 'orig'; } else { d.clip = g.clip; d.end = null; if (d.music === 'orig') d.music = 'none'; }
}
// правки поточного кадру каруселі зберігаються в d.ed[gid]
function commit(d) { if (d.kind === 'photo' && d.gid) d.ed[d.gid] = { filter: d.filter, text: d.text, textY: d.textY, sticker: d.sticker }; }
function load(d, gid) { commit(d); d.gid = gid; Object.assign(d, blank(), d.ed[gid] || {}); }

// Після «Додати з телефону» в майстрі — одразу вибрати нові файли
export function createImported(lk, items) {
  const d = lk.top.d; if (!d) return;
  const vids = items.filter(g => g.type === 'video'), pics = items.filter(g => g.type === 'photo');
  if (d.kind === 'video' && vids.length) setVideo(d, vids[0]);
  else if (d.kind === 'story') { if (pics.length) { d.story = 'photo'; d.gid = pics[0].id; } }
  else if (pics.length) {
    if (d.kind !== 'photo') { d.kind = 'photo'; d.gids = []; d.gid = null; }
    commit(d);
    const add = pics.map(g => g.id).filter(id => !d.gids.includes(id));
    d.gids = (pics.length > 1 || d.multi ? [...d.gids, ...add] : [add[0] || pics[0].id]).slice(0, MAX_SLIDES);
    if (d.gids.length > 1) d.multi = true;
    load(d, d.gids[d.gids.length - 1]);
  } else if (vids.length) { d.kind = 'video'; setVideo(d, vids[0]); }
  lk.ph.render(true);
}

// Розмітка майстра
export function renderCreate(lk, top) {
  const d = top.d, s = lk.s, sim = lk.sim;
  // вибране фото чи відео могли видалити з Галереї — повертаємося до вибору
  d.gids = (d.gids || []).filter(id => s.gallery.some(g => g.id === id));
  if (d.gid && !s.gallery.some(g => g.id === d.gid)) { d.gid = d.kind === 'photo' ? d.gids[0] || null : null; d.clip = null; if (d.kind !== 'text' && !d.gid) d.step = 'pick'; }
  if ((d.kind === 'photo' || d.kind === 'video') && d.step !== 'pick' && !d.gid) d.step = 'pick';
  if (d.kind === 'story') d.step = 'pick'; // історія має один екран
  const back = `<button class="ib" data-act="cr.back" aria-label="Назад">${icon(d.step === 'pick' ? 'close' : 'back', 24)}</button>`;
  if (d.step === 'pick') {
    const items = s.gallery.filter(g => d.kind === 'video' ? g.type === 'video' : g.type === 'photo');
    const kinds = `<div class="kinds" role="tablist">${KINDS.map(([k, ic, t]) => `<button role="tab" class="${d.kind === k ? 'on' : ''}" aria-selected="${d.kind === k}" data-act="cr.kind" data-k="${k}">${icon(ic, 16)}${t}</button>`).join('')}</div>`;
    if (d.kind === 'text') return `<header class="ah">${back}<b class="ah-t">Новий допис</b><span class="grow"></span><button class="lnk strong" data-act="cr.next" ${d.txt.trim().length ? '' : 'disabled'}>Далі</button></header>${kinds}
      <div class="scroll pad"><div class="txtcard edit" style="background:${d.bg}"><textarea data-keep="cr.txt" data-in="cr.txt" maxlength="500" placeholder="Про що хочете розповісти?" aria-label="Текст допису">${esc(d.txt)}</textarea></div>
      <div class="sw-row center">${BGS.map(c => `<button class="cdot${d.bg === c ? ' on' : ''}" style="background:${c}" data-act="cr.bg" data-c="${c}" aria-label="Колір тла"></button>`).join('')}</div><p class="muted center sm" data-cnt>${d.txt.length} / 500</p></div>`;
    if (d.kind === 'story') return `<header class="ah">${back}<b class="ah-t">Нова історія</b></header>${kinds}<div class="scroll pad">
      <div class="seg">${[['photo', 'Фото'], ['text', 'Текст'], ['poll', 'Опитування']].map(([k, t]) => `<button class="${d.story === k ? 'on' : ''}" data-act="cr.storyType" data-k="${k}">${t}</button>`).join('')}</div>
      ${d.story === 'photo' ? `<div class="pick-bar"><span class="grow"></span>${fileBtn('create', 'З телефону', 'btn sm', 'image/*')}</div><div class="pick-grid">${items.map(g => `<button class="pg${d.gid === g.id ? ' on' : ''}" data-act="cr.pick" data-id="${g.id}" aria-label="${esc(g.own ? 'Ваше фото' : SCENES[g.scene]?.t || 'Фото')}">${thumb(g)}</button>`).join('')}</div>`
      : d.story === 'text' ? `<div class="txtcard edit" style="background:#7e57c2"><textarea data-keep="cr.txt" data-in="cr.txt" maxlength="200" placeholder="Що нового?" aria-label="Текст історії">${esc(d.txt)}</textarea></div>`
      : `<label class="fl"><span>Питання</span><input class="in" data-keep="cr.pq" data-in="cr.pq" value="${esc(d.pq)}" maxlength="60" placeholder="Що показати наступного разу?"></label><label class="fl"><span>Варіант 1</span><input class="in" data-keep="cr.pa0" data-in="cr.pa0" value="${esc(d.pa[0])}" maxlength="24" placeholder="Відео"></label><label class="fl"><span>Варіант 2</span><input class="in" data-keep="cr.pa1" data-in="cr.pa1" value="${esc(d.pa[1])}" maxlength="24" placeholder="Фото"></label>`}
      <p class="hint">${icon('info', 16)}<span>Історії зникають через 24 години, але хтось може встигнути зробити знімок екрана.</span></p></div>
      <footer class="foot"><button class="btn primary big" data-act="cr.story">Поділитися історією</button></footer>`;
    const multi = d.kind === 'photo' && d.multi, n = d.kind === 'photo' ? d.gids.length : d.gid ? 1 : 0;
    return `<header class="ah">${back}<b class="ah-t">${d.kind === 'video' ? 'Нове відео' : multi ? 'Карусель' : 'Нове фото'}</b><span class="grow"></span><button class="lnk strong" data-act="cr.next" ${n ? '' : 'disabled'}>Далі${multi && n ? ` (${n})` : ''}</button></header>${kinds}
      <div class="scroll" data-scroll="pick"><div class="pick-prev">${d.gid ? prev(s, d) : `<div class="empty sm">${icon(d.kind === 'video' ? 'film' : 'image', 36)}<b>Виберіть ${d.kind === 'video' ? 'відео' : 'фото'} з галереї</b><p>додайте своє з телефону або зніміть камерою</p></div>`}</div>
      <div class="pick-bar"><b>Галерея</b><span class="grow"></span>${d.kind === 'photo' ? `<button class="btn sm${multi ? ' on' : ''}" data-act="cr.multi" aria-pressed="${multi}" title="Вибрати кілька фото для каруселі">${icon('layers', 16)}Кілька</button>` : ''}${fileBtn('create', 'З телефону', 'btn sm', d.kind === 'video' ? 'video/*' : 'image/*')}<button class="btn sm" data-act="cr.camera" aria-label="Камера">${icon('camera', 16)}</button></div>
      ${multi ? `<p class="pick-tip">${icon('layers', 15)}<span>Натискайте фото по черзі — так складеться карусель (до ${MAX_SLIDES}). Перше фото побачать у стрічці.</span></p>` : ''}
      <div class="pick-grid">${items.map(g => { const i = d.kind === 'photo' ? d.gids.indexOf(g.id) : -1, on = d.kind === 'photo' ? i >= 0 : d.gid === g.id; return `<button class="pg${on ? ' on' : ''}" data-act="cr.pick" data-id="${g.id}" aria-pressed="${on}" aria-label="${esc(g.own ? (g.type === 'video' ? 'Ваше відео' : 'Ваше фото') : g.type === 'video' ? CLIPS[g.clip].t : SCENES[g.scene]?.t || 'Фото')}">${thumb(g)}${multi ? `<i class="pg-n${i >= 0 ? ' on' : ''}">${i >= 0 ? i + 1 : ''}</i>` : ''}</button>`; }).join('')}</div></div>`;
  }
  if (d.step === 'edit' && d.kind === 'photo') {
    const tools = [['filter', 'Фільтри'], ['text', 'Текст'], ['sticker', 'Наліпка'], ['crop', 'Кадр']];
    const g = s.gallery.find(x => x.id === d.gid);
    let panel = '';
    if (d.tool === 'filter') panel = `<div class="filters">${FILTERS.map(f => `<button class="flt${d.filter === f.id ? ' on' : ''}" data-act="cr.filter" data-f="${f.id}"><span class="flt-m">${photo(g, { filter: f.css, thumb: true })}</span><small>${f.t}</small></button>`).join('')}</div>`;
    else if (d.tool === 'text') panel = `<div class="pad"><input class="in" data-keep="cr.ptext" data-in="cr.ptext" value="${esc(d.text)}" maxlength="22" placeholder="Напис на фото (до 22 символів)" aria-label="Напис на фото"><div class="seg sm">${[['top', 'Угорі'], ['bottom', 'Унизу']].map(([k, t]) => `<button class="${d.textY === k ? 'on' : ''}" data-act="cr.textY" data-k="${k}">${t}</button>`).join('')}</div></div>`;
    else if (d.tool === 'sticker') panel = `<div class="sw-row center pad"><button class="stk${!d.sticker ? ' on' : ''}" data-act="cr.sticker" data-k="" aria-label="Без наліпки">${icon('close', 22)}</button>${STICKERS.map(k => `<button class="stk${d.sticker === k ? ' on' : ''}" data-act="cr.sticker" data-k="${k}" aria-label="Наліпка">${icon(k, 24, true)}</button>`).join('')}</div>`;
    else panel = `<div class="seg pad">${[['45', 'Портрет 4:5'], ['11', 'Квадрат 1:1']].map(([k, t]) => `<button class="${d.crop === k ? 'on' : ''}" data-act="cr.crop" data-k="${k}">${t}</button>`).join('')}</div>`;
    return `<header class="ah">${back}<b class="ah-t">Редагування</b><span class="grow"></span><button class="lnk strong" data-act="cr.next">Далі</button></header>
      <div class="ed-prev crop${d.crop}">${prev(s, d)}${d.gids.length > 1 ? `<span class="car-n">${d.gids.indexOf(d.gid) + 1}/${d.gids.length}</span>` : ''}</div>
      ${d.gids.length > 1 ? `<div class="slides" role="tablist" aria-label="Фото каруселі">${d.gids.map((id, i) => { const x = s.gallery.find(y => y.id === id); return `<button role="tab" class="sl${id === d.gid ? ' on' : ''}" aria-selected="${id === d.gid}" data-act="cr.slide" data-id="${id}" aria-label="Фото ${i + 1}">${x ? photo(x, { thumb: true, filter: FILTERS.find(f => f.id === (id === d.gid ? d.filter : d.ed[id]?.filter))?.css }) : ''}<i>${i + 1}</i></button>`; }).join('')}</div>` : ''}<div class="tools" role="tablist">${tools.map(([k, t]) => `<button role="tab" class="${d.tool === k ? 'on' : ''}" aria-selected="${d.tool === k}" data-act="cr.tool" data-k="${k}">${t}</button>`).join('')}</div><div class="tool-panel">${panel}</div>`;
  }
  if (d.step === 'edit' && d.kind === 'video') {
    const c = vinfo(s, d), end = d.end ?? c.dur, len = Math.round((end - d.start) * 10) / 10, over = len > LK_MAX, step = d.own ? 0.5 : 1;
    const frames = Array.from({ length: 8 }, (_, i) => { const t = i / 8 * c.dur; const still = t < c.intro; return `<i class="${t < d.start || t >= end ? 'cut' : ''}${still ? ' still' : ''}"></i>`; }).join('');
    const sec = x => d.own ? fmtDur(x) : `${x} с`;
    return `<header class="ah">${back}<b class="ah-t">Монтаж відео</b><span class="grow"></span><button class="lnk strong" data-act="cr.next" ${len >= 3 && !over ? '' : 'disabled'}>Далі</button></header>
      <div class="scroll" data-scroll="ved"><div class="ed-prev vid${d.own && c.g && !vertical(c.g) ? ' wide' : ''}" data-act="cr.playToggle">${d.own ? video(c.g, { live: true, paused: !top.play, start: d.start, end }) : video(d.clip, { paused: !top.play })}${d.title ? `<span class="v-title">${esc(d.title)}</span>` : ''}${top.play ? '' : `<span class="v-play">${icon('play', 30, true)}</span>`}</div>
      <div class="pad"><div class="tl-head"><b>Обрізка</b><span>Довжина: <b>${sec(len)}</b></span></div>
      <div class="film">${frames}</div>
      <label class="rng"><span>Початок: ${sec(d.start)}</span><input type="range" min="0" max="${Math.max(0, c.dur - 3)}" step="${step}" value="${d.start}" data-rng="start" aria-label="Початок відео"></label>
      <label class="rng"><span>Кінець: ${sec(end)}</span><input type="range" min="3" max="${c.dur}" step="${step}" value="${end}" data-rng="end" aria-label="Кінець відео"></label>
      ${over ? `<p class="warnbox plain">${icon('alert', 16)}Лайкер приймає відео до ${LK_MAX} с. Пересуньте початок або кінець.</p>` : ''}
      ${d.own && c.intro >= 1 ? `<p class="hint">${icon('info', 16)}<span>Перші ≈${Math.round(c.intro)} с у цьому відео майже нічого не рухається (позначено на стрічці штрихуванням).</span></p>` : ''}
      <p class="muted sm">Підказка: перегляньте відео й подумайте, з якої секунди починається найцікавіше. Перші 3 секунди вирішують, чи гортатиме глядач далі.</p>
      <label class="fl"><span>Заголовок на відео</span><input class="in" data-keep="cr.vtitle" data-in="cr.vtitle" value="${esc(d.title)}" maxlength="24" placeholder="Наприклад: «Кіт проти лазера»"></label>
      <p class="lbl">Музика</p><div class="music">${MUSIC.filter(m => d.own || !m.own).map(m => `<button class="mus${d.music === m.id ? ' on' : ''}" data-act="cr.music" data-m="${m.id}">${icon(m.id === 'none' ? 'close' : m.id === 'orig' ? 'sound' : 'music', 18)}<span><b>${esc(m.t)}</b>${m.by ? `<small>${esc(m.by)}${m.free ? ' · вільна для використання' : ''}</small>` : ''}</span>${d.music === m.id ? icon('check', 18) : ''}</button>`).join('')}</div></div></div>`;
  }
  // опис і налаштування
  const g0 = d.kind === 'photo' ? s.gallery.find(x => x.id === (d.gids[0] || d.gid)) : d.kind === 'video' ? s.gallery.find(x => x.id === d.gid) : null;
  const topic = g0?.own ? g0.topic : d.kind === 'photo' ? SCENES[g0?.scene]?.topic : d.kind === 'video' ? CLIPS[d.clip]?.topic : 'me';
  const tags = suggestTags(lk, topic, d.caption);
  const capLen = d.caption.length, tagN = (d.caption.match(/#[\p{L}\p{N}_]+/gu) || []).length;
  const pa = s.pendingAd, brand = pa && BRANDS.find(b => b.id === pa.id);
  const collab = s.collab && CREATORS.find(c => c.id === s.collab);
  const slots = schedSlots(s.t);
  return `<header class="ah">${back}<b class="ah-t">${d.kind === 'text' ? 'Новий допис' : 'Опис'}</b></header>
    <div class="scroll pad" data-scroll="det">${d.idea ? `<p class="hint">${icon('idea', 16)}<span>Ідея: <b>${esc(d.idea)}</b></span></p>` : ''}<div class="det-top"><span class="det-m">${d.kind === 'text' ? `<div class="txtcard" style="background:${d.bg}"><p>${esc(d.txt.slice(0, 60))}</p></div>` : d.kind === 'photo' && d.gids.length > 1 ? `${prev(s, { ...d, gid: d.gids[0], ...(d.gids[0] === d.gid ? {} : { ...blank(), ...d.ed[d.gids[0]] }) })}<i class="gi-ic">${icon('layers', 14)}</i>` : prev(s, d)}</span>
      <textarea class="in" data-keep="cr.caption" data-in="cr.caption" rows="5" maxlength="2200" placeholder="${d.kind === 'text' ? 'Додайте хештеги (необов’язково)' : 'Напишіть опис… Розкажіть, що на фото, або поставте питання підписникам'}" aria-label="Опис">${esc(d.caption)}</textarea></div>
    <p class="muted sm right" data-cnt>${capLen} символів · ${tagN} ${tagN === 1 ? 'хештег' : tagN >= 2 && tagN <= 4 ? 'хештеги' : 'хештегів'}</p>
    <p class="lbl">Хештеги</p><div class="chips wrap" data-tags>${tags}</div>
    ${g0?.own ? `<div class="opt"><span class="opt-ic">${icon(nicheOf(g0.topic).icon, 20)}</span><div><b>Тема</b><small>Кому платформа покаже допис</small></div><select class="in sel" data-crsel="topic" aria-label="Тема допису">${topicOptions(g0.topic)}</select></div>` : ''}
    <div class="opt"><span class="opt-ic">${icon('location', 20)}</span><div><b>Місце</b></div><select class="in sel" data-crsel="place" aria-label="Місце">${PLACES.map(p => `<option value="${esc(p)}"${d.place === p ? ' selected' : ''}>${p || 'Не вказувати'}</option>`).join('')}</select></div>
    ${brand ? `<div class="opt"><span class="opt-ic">${icon('money', 20)}</span><div><b>Реклама: ${esc(brand.name)}</b><small>Це допис за оплату ${brand.pay} грн</small></div>${sw('cr.ad', !!d.ad, 'Рекламний допис')}</div>${d.ad ? `<div class="opt sub"><div><b>Позначка «Реклама»</b><small>Підписники побачать напис «Реклама» над дописом</small></div>${sw('cr.adMarked', d.adMarked, 'Позначка Реклама')}</div>` : ''}` : ''}
    ${collab ? `<div class="opt"><span class="opt-ic">${icon('users', 20)}</span><div><b>Співпраця з @${esc(collab.nick)}</b><small>Допис з’явиться і в її (його) підписників</small></div>${sw('cr.collab', d.collab, 'Співпраця')}</div>` : ''}
    <div class="opt"><span class="opt-ic">${icon('comment', 20)}</span><div><b>Вимкнути коментарі</b></div>${sw('cr.commentsOff', d.commentsOff, 'Вимкнути коментарі')}</div>
    <div class="opt"><span class="opt-ic">${icon('clock', 20)}</span><div><b>Коли опублікувати</b></div><select class="in sel" data-crsel="sched" aria-label="Коли опублікувати"><option value="">Зараз (${clock(s.t)})</option>${slots.map(([t, l]) => `<option value="${t}"${String(d.sched) === String(t) ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    <details class="pre"><summary>${icon('shield', 18)}Перевірте себе перед публікацією</summary><ul><li>Чи немає на фото адреси, номера будинку, назви школи, документів?</li><li>Чи погодилися люди на фото, щоб їх показували?</li><li>Чи це ваш власний твір (фото, музика, малюнок)?</li><li>Чи правдивий опис і заголовок?</li></ul></details></div>
    <footer class="foot"><button class="btn primary big" data-act="cr.publish">${d.sched ? 'Запланувати' : 'Опублікувати'}</button></footer>`;
}
function prev(s, d) {
  if (d.kind === 'video') { if (d.own) { const g = s.gallery.find(x => x.id === d.gid); return g ? video(g, { paused: true }) : ''; } return video(d.clip, { paused: true }); }
  const g = s.gallery.find(x => x.id === d.gid); if (!g) return '';
  return photo(g, { filter: FILTERS.find(f => f.id === d.filter)?.css, text: d.text, textY: d.textY, sticker: d.sticker });
}
function schedSlots(t) {
  const out = [], start = Math.ceil((t + 30) / 60) * 60;
  for (let x = start; x < t + DAY + 60 && out.length < 24; x += 60) out.push([x, `${dayOf(x) === dayOf(t) ? 'Сьогодні' : 'Завтра'}, ${clock(x)}`]);
  return out;
}
function suggestTags(lk, topic, caption) {
  const used = new Set((caption.match(/#[\p{L}\p{N}_]+/gu) || []).map(x => lc(x.slice(1)))), tr = lk.sim.trend;
  const list = Object.entries(TAGS).filter(([, d]) => d.topic === topic || (d.topic == null && !d.spam)).sort((a, b) => b[1].size - a[1].size).map(([k]) => k);
  const extra = ['рекомендації', 'лайк', 'взаємнапідписка'];
  const all = [tr.tag, ...list.slice(0, 6), ...extra].filter((k, i, a) => a.indexOf(k) === i);
  return all.map(k => `<button class="chip-btn${used.has(k) ? ' on' : ''}" data-act="cr.tag" data-t="${k}">#${esc(k)}${k === tr.tag ? `<small>${icon('fire', 12)}тренд</small>` : TAGS[k] ? `<small>${num(TAGS[k].size * 4200)}</small>` : ''}</button>`).join('');
}

// Дії майстра
export function createAct(lk, name, el) {
  const top = lk.top, d = top.d, s = lk.s, sim = lk.sim, ph = lk.ph;
  if (!d) return; // натискання встигло прийти вже після виходу з майстра
  const A = {
    back: async () => {
      if (d.step === 'details') d.step = d.kind === 'text' ? 'pick' : 'edit';
      else if (d.step === 'edit') d.step = 'pick';
      else {
        if (d.gid || d.txt.trim() || d.caption.trim()) {
          // як у справжніх застосунках: зберегти чернетку або видалити
          commit(d);
          actions([{ t: 'Зберегти чернетку', icon: 'edit', on: () => { const x = sim.saveDraft({ ...d, id: d.draftId, step: (d.kind === 'photo' || d.kind === 'video') && d.gid ? 'edit' : 'pick' }); d.draftId = x.id; lk.stack.pop(); ph.render(true); toast('Чернетку збережено: Профіль → Чернетки'); } },
            { t: d.draftId ? 'Видалити чернетку' : 'Не зберігати', icon: 'trash', danger: true, on: () => { if (d.draftId) sim.deleteDraft(d.draftId); lk.stack.pop(); ph.render(true); } }], 'Вийти з допису?');
          return;
        }
        lk.stack.pop();
      }
      top.play = false; ph.render(true);
    },
    kind: () => { d.kind = el.dataset.k; d.gid = null; d.gids = []; d.ed = {}; d.clip = null; d.own = false; Object.assign(d, blank()); ph.render(true); },
    pick: () => {
      const g = s.gallery.find(x => x.id === el.dataset.id); if (!g) return;
      if (g.type === 'video') { setVideo(d, g); ph.render(); return; }
      if (d.kind !== 'photo') { d.gid = g.id; ph.render(); return; } // історія
      const i = d.gids.indexOf(g.id);
      if (!d.multi) { d.gids = [g.id]; d.ed = {}; d.gid = g.id; Object.assign(d, blank()); }
      else if (i >= 0) { if (d.gid === g.id) commit(d); d.gids.splice(i, 1); delete d.ed[g.id]; if (d.gid === g.id) { d.gid = null; if (d.gids.length) load(d, d.gids[d.gids.length - 1]); } }
      else if (d.gids.length >= MAX_SLIDES) { toast(`У каруселі може бути до ${MAX_SLIDES} фото`); return; }
      else { d.gids.push(g.id); load(d, g.id); }
      ph.render();
    },
    multi: () => { d.multi = !d.multi; if (!d.multi && d.gids.length > 1) { d.gids = [d.gid]; } ph.render(); },
    slide: () => { load(d, el.dataset.id); ph.render(); },
    camera: () => { ph.open('camera', { returnTo: d.kind === 'video' ? 'video' : 'photo' }); },
    next: () => {
      if (d.step === 'pick') { d.step = d.kind === 'text' ? 'details' : 'edit'; if (d.kind === 'photo' && d.gids.length && !d.gids.includes(d.gid)) load(d, d.gids[0]); }
      else { commit(d); d.step = 'details'; }
      top.play = false; ph.render(true);
    },
    bg: () => { d.bg = el.dataset.c; ph.render(); },
    tool: () => { d.tool = el.dataset.k; ph.render(); },
    filter: () => { d.filter = el.dataset.f; ph.render(); },
    textY: () => { d.textY = el.dataset.k; ph.render(); },
    sticker: () => { d.sticker = el.dataset.k; ph.render(); },
    crop: () => { d.crop = el.dataset.k; ph.render(); },
    music: () => { d.music = el.dataset.m; ph.render(); if (MUSIC.find(m => m.id === d.music)?.hit) toast('Це чужа пісня з вашого плеєра'); },
    playToggle: () => { top.play = !top.play; ph.render(); },
    storyType: () => { d.story = el.dataset.k; ph.render(); },
    tag: () => { const t = '#' + el.dataset.t, re = new RegExp(`(^|\\s)${t}(?=\\s|$)`, 'u'); d.caption = re.test(d.caption) ? d.caption.replace(re, '$1').replace(/\s{2,}/g, ' ').trim() : (d.caption.trim() + ' ' + t).trim(); ph.render(); },
    publish: () => {
      if (!['photo', 'video', 'text'].includes(d.kind) || (d.kind !== 'text' && !d.gid)) return;
      const draft = { kind: d.kind, caption: d.caption, place: d.place, commentsOff: d.commentsOff, sched: d.sched ? +d.sched : 0, collab: d.collab };
      if (d.kind === 'photo') {
        commit(d);
        const slides = (d.gids.length ? d.gids : [d.gid]).map(gid => { const e = { ...blank(), ...d.ed[gid] }, g = s.gallery.find(x => x.id === gid); return { gid, filter: e.filter, text: e.text.trim(), textY: e.textY, sticker: e.sticker, crop: d.crop, ...(g?.own ? { g: snap(g) } : {}) }; });
        draft.photo = slides[0]; if (slides.length > 1) draft.photos = slides;
      } else if (d.kind === 'video') {
        if (d.own) { const g = s.gallery.find(x => x.id === d.gid); draft.video = { own: true, gid: d.gid, g: snap(g), start: d.start, end: d.end ?? g.dur, title: d.title.trim(), music: d.music }; }
        else draft.video = { clip: d.clip, start: d.start, end: d.end ?? CLIPS[d.clip].dur, title: d.title.trim(), music: d.music };
      }
      else { draft.text = d.txt.trim(); }
      if (d.ad && s.pendingAd) { draft.ad = s.pendingAd.id; draft.adMarked = d.adMarked; }
      const p = sim.publish(draft);
      if (d.kind === 'text') p.bg = d.bg;
      if (s.settings.comments === 'off') p.commentsOff = true;
      if (d.draftId) sim.deleteDraft(d.draftId);
      if (d.ideaId) { const i = s.ideas.find(x => x.id === d.ideaId); if (i) i.done = true; }
      lk.stack = [{ v: 'profile', tab: p.t ? 'posts' : 'sched' }];
      if (p.t) lk.stack.push({ v: 'post', id: p.id });
      ph.render(true); ph.save();
      toast(p.t ? 'Опубліковано! Стежте за реакціями' : `Допис вийде о ${clock(p.sched)}`);
    },
    story: () => {
      if (d.story === 'photo' && !d.gid) return toast('Виберіть фото');
      if (d.story === 'text' && !d.txt.trim()) return toast('Напишіть текст');
      if (d.story === 'poll' && (!d.pq.trim() || !d.pa[0].trim() || !d.pa[1].trim())) return toast('Заповніть питання й обидва варіанти');
      sim.story(d.story === 'photo' ? { gid: d.gid } : d.story === 'text' ? { text: d.txt.trim() } : { text: d.pq.trim(), poll: { q: d.pq.trim(), a: d.pa.map(x => x.trim()) } });
      lk.stack.pop(); ph.render(true); toast('Історію опубліковано на 24 години');
    },
  };
  A[name]?.();
}
export function createInput(lk, key, el) {
  const d = lk.top.d, v = el.value; if (!d) return;
  if (key === 'cr.txt') { d.txt = v; const c = lk.ph.root.querySelector('[data-cnt]'); if (c) c.textContent = `${v.length} / 500`; const b = lk.ph.root.querySelector('[data-act="cr.next"]'); if (b) b.disabled = !v.trim(); }
  else if (key === 'cr.caption') { d.caption = v; const n = (v.match(/#[\p{L}\p{N}_]+/gu) || []).length; const c = lk.ph.root.querySelector('[data-cnt]'); if (c) c.textContent = `${v.length} символів · ${n} ${n === 1 ? 'хештег' : n >= 2 && n <= 4 ? 'хештеги' : 'хештегів'}`; }
  else if (key === 'cr.ptext') { d.text = v; const pv = lk.ph.root.querySelector('.ed-prev'); if (pv) pv.innerHTML = prev(lk.s, d); }
  else if (key === 'cr.vtitle') { d.title = v; const t = lk.ph.root.querySelector('.ed-prev .v-title'); if (t) t.textContent = v; else if (v) lk.ph.render(); }
  else if (key === 'cr.pq') d.pq = v;
  else if (key === 'cr.pa0') d.pa[0] = v;
  else if (key === 'cr.pa1') d.pa[1] = v;
}
export function createRange(lk, key, el) {
  const d = lk.top.d, c = d && vinfo(lk.s, d), v = +el.value; if (!c) return;
  if (key === 'start') { d.start = Math.min(v, (d.end ?? c.dur) - 3); }
  else { d.end = Math.max(v, d.start + 3); }
  lk.ph.render();
}
export function createToggle(lk, key) { const d = lk.top.d, k = key.slice(3); if (!d) return; d[k] = !d[k]; lk.ph.render(); }
export function createSelect(lk, key, v) {
  const d = lk.top.d; if (!d) return;
  if (key === 'topic') { for (const id of d.kind === 'photo' ? (d.gids.length ? d.gids : [d.gid]) : [d.gid]) { const g = lk.s.gallery.find(x => x.id === id); if (g?.own) lk.sim.setTopic(id, v); } }
  else d[key] = v;
  lk.ph.render();
}
