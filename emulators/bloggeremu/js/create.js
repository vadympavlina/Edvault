// Симулятор блогера · створення допису: вибір фото/відео, редактор, опис і хештеги, публікація або історія.
import { icon } from './icons.js';
import { photo, video } from './art.js';
import { esc, toast, sw, confirm, actions } from './ui.js';
import { SCENES, CLIPS, MUSIC, FILTERS, STICKERS, TAGS, BRANDS, CREATORS, nicheOf } from './data.js';
import { clock, hourOf, dayOf, DAY, lc, num } from './sim.js';

const KINDS = [['photo', 'image', 'Фото'], ['video', 'video', 'Відео'], ['text', 'text', 'Допис'], ['story', 'spark', 'Історія']];
const PLACES = ['', 'Київ', 'Парк Шевченка', 'Біля дому', 'Школа №1', 'Бабусина дача'];
const BGS = ['#5c6bc0', '#e1306c', '#26a69a', '#ff7043', '#7e57c2', '#37474f'];

export function openCreate(ph, o = {}) {
  ph.open('likeer');
  const lk = ph.apps.likeer;
  if (!ph.sim.s.me) return;
  const d = { kind: o.kind || 'photo', step: o.gid ? 'edit' : 'pick', gid: o.gid || null, filter: 'none', text: '', textY: 'bottom', sticker: '', crop: '45', tool: 'filter', clip: o.clip || null, start: 0, end: null, title: '', music: 'none', caption: '', place: '', commentsOff: false, ad: '', adMarked: true, collab: false, when: 'now', sched: '', bg: BGS[0], txt: '', poll: false, pq: '', pa: ['', ''], story: 'photo' };
  if (o.gid) { const g = ph.sim.s.gallery.find(x => x.id === o.gid); if (g?.type === 'video') { d.kind = 'video'; d.clip = g.clip; d.gid = g.id; } }
  // продовжити чернетку
  if (o.draft) { Object.assign(d, JSON.parse(JSON.stringify(o.draft)), { draftId: o.draft.id }); delete d.id; delete d.t; }
  // допис за ідеєю із застосунку «Ідеї»
  if (o.idea) { d.idea = o.idea.text; d.ideaId = o.idea.id; }
  lk.stack = lk.stack.filter(x => x.v !== 'create');
  lk.stack.push({ v: 'create', d }); ph.render(true);
}

// Розмітка майстра
export function renderCreate(lk, top) {
  const d = top.d, s = lk.s, sim = lk.sim;
  // вибране фото чи відео могли видалити з Галереї — повертаємося до вибору
  if (d.gid && !s.gallery.some(g => g.id === d.gid)) { d.gid = null; d.clip = null; if (d.kind !== 'text') d.step = 'pick'; }
  if ((d.kind === 'photo' || d.kind === 'video') && d.step !== 'pick' && !d.gid) d.step = 'pick';
  const back = `<button class="ib" data-act="cr.back" aria-label="Назад">${icon(d.step === 'pick' ? 'close' : 'back', 24)}</button>`;
  if (d.step === 'pick') {
    const items = s.gallery.filter(g => d.kind === 'video' ? g.type === 'video' : g.type === 'photo');
    const kinds = `<div class="kinds" role="tablist">${KINDS.map(([k, ic, t]) => `<button role="tab" class="${d.kind === k ? 'on' : ''}" aria-selected="${d.kind === k}" data-act="cr.kind" data-k="${k}">${icon(ic, 16)}${t}</button>`).join('')}</div>`;
    if (d.kind === 'text') return `<header class="ah">${back}<b class="ah-t">Новий допис</b><span class="grow"></span><button class="lnk strong" data-act="cr.next" ${d.txt.trim().length ? '' : 'disabled'}>Далі</button></header>${kinds}
      <div class="scroll pad"><div class="txtcard edit" style="background:${d.bg}"><textarea data-keep="cr.txt" data-in="cr.txt" maxlength="500" placeholder="Про що хочете розповісти?" aria-label="Текст допису">${esc(d.txt)}</textarea></div>
      <div class="sw-row center">${BGS.map(c => `<button class="cdot${d.bg === c ? ' on' : ''}" style="background:${c}" data-act="cr.bg" data-c="${c}" aria-label="Колір тла"></button>`).join('')}</div><p class="muted center sm" data-cnt>${d.txt.length} / 500</p></div>`;
    if (d.kind === 'story') return `<header class="ah">${back}<b class="ah-t">Нова історія</b></header>${kinds}<div class="scroll pad">
      <div class="seg">${[['photo', 'Фото'], ['text', 'Текст'], ['poll', 'Опитування']].map(([k, t]) => `<button class="${d.story === k ? 'on' : ''}" data-act="cr.storyType" data-k="${k}">${t}</button>`).join('')}</div>
      ${d.story === 'photo' ? `<div class="pick-grid">${items.map(g => `<button class="pg${d.gid === g.id ? ' on' : ''}" data-act="cr.pick" data-id="${g.id}" aria-label="${esc(SCENES[g.scene]?.t || 'Фото')}">${photo(g)}${g.geo ? `<i class="pg-geo">${icon('location', 12)}</i>` : ''}</button>`).join('')}</div>`
      : d.story === 'text' ? `<div class="txtcard edit" style="background:#7e57c2"><textarea data-keep="cr.txt" data-in="cr.txt" maxlength="200" placeholder="Що нового?" aria-label="Текст історії">${esc(d.txt)}</textarea></div>`
      : `<label class="fl"><span>Питання</span><input class="in" data-keep="cr.pq" data-in="cr.pq" value="${esc(d.pq)}" maxlength="60" placeholder="Що показати наступного разу?"></label><label class="fl"><span>Варіант 1</span><input class="in" data-keep="cr.pa0" data-in="cr.pa0" value="${esc(d.pa[0])}" maxlength="24" placeholder="Відео"></label><label class="fl"><span>Варіант 2</span><input class="in" data-keep="cr.pa1" data-in="cr.pa1" value="${esc(d.pa[1])}" maxlength="24" placeholder="Фото"></label>`}
      <p class="hint">${icon('info', 16)}<span>Історії зникають через 24 години, але хтось може встигнути зробити знімок екрана.</span></p></div>
      <footer class="foot"><button class="btn primary big" data-act="cr.story">Поділитися історією</button></footer>`;
    return `<header class="ah">${back}<b class="ah-t">${d.kind === 'video' ? 'Нове відео' : 'Нове фото'}</b><span class="grow"></span><button class="lnk strong" data-act="cr.next" ${d.gid ? '' : 'disabled'}>Далі</button></header>${kinds}
      <div class="scroll" data-scroll="pick"><div class="pick-prev">${d.gid ? prev(s, d) : `<div class="empty sm">${icon(d.kind === 'video' ? 'film' : 'image', 36)}<b>Виберіть ${d.kind === 'video' ? 'відео' : 'фото'} з галереї</b><p>або зніміть нове камерою</p></div>`}</div>
      <div class="pick-bar"><b>Галерея</b><span class="grow"></span><button class="btn sm" data-act="cr.camera">${icon('camera', 16)}Камера</button></div>
      <div class="pick-grid">${items.map(g => `<button class="pg${d.gid === g.id ? ' on' : ''}" data-act="cr.pick" data-id="${g.id}" aria-label="${esc(g.type === 'video' ? CLIPS[g.clip].t : SCENES[g.scene]?.t || 'Фото')}">${g.type === 'video' ? video(g.clip, { paused: true }) + `<i class="pg-dur">0:${CLIPS[g.clip].dur}</i>` : photo(g)}${g.geo ? `<i class="pg-geo">${icon('location', 12)}</i>` : ''}</button>`).join('')}</div></div>`;
  }
  if (d.step === 'edit' && d.kind === 'photo') {
    const tools = [['filter', 'Фільтри'], ['text', 'Текст'], ['sticker', 'Наліпка'], ['crop', 'Кадр']];
    const g = s.gallery.find(x => x.id === d.gid);
    let panel = '';
    if (d.tool === 'filter') panel = `<div class="filters">${FILTERS.map(f => `<button class="flt${d.filter === f.id ? ' on' : ''}" data-act="cr.filter" data-f="${f.id}"><span class="flt-m">${photo(g, { filter: f.css })}</span><small>${f.t}</small></button>`).join('')}</div>`;
    else if (d.tool === 'text') panel = `<div class="pad"><input class="in" data-keep="cr.ptext" data-in="cr.ptext" value="${esc(d.text)}" maxlength="22" placeholder="Напис на фото (до 22 символів)" aria-label="Напис на фото"><div class="seg sm">${[['top', 'Угорі'], ['bottom', 'Унизу']].map(([k, t]) => `<button class="${d.textY === k ? 'on' : ''}" data-act="cr.textY" data-k="${k}">${t}</button>`).join('')}</div></div>`;
    else if (d.tool === 'sticker') panel = `<div class="sw-row center pad"><button class="stk${!d.sticker ? ' on' : ''}" data-act="cr.sticker" data-k="" aria-label="Без наліпки">${icon('close', 22)}</button>${STICKERS.map(k => `<button class="stk${d.sticker === k ? ' on' : ''}" data-act="cr.sticker" data-k="${k}" aria-label="Наліпка">${icon(k, 24, true)}</button>`).join('')}</div>`;
    else panel = `<div class="seg pad">${[['45', 'Портрет 4:5'], ['11', 'Квадрат 1:1']].map(([k, t]) => `<button class="${d.crop === k ? 'on' : ''}" data-act="cr.crop" data-k="${k}">${t}</button>`).join('')}</div>`;
    return `<header class="ah">${back}<b class="ah-t">Редагування</b><span class="grow"></span><button class="lnk strong" data-act="cr.next">Далі</button></header>
      <div class="ed-prev crop${d.crop}">${prev(s, d)}</div><div class="tools" role="tablist">${tools.map(([k, t]) => `<button role="tab" class="${d.tool === k ? 'on' : ''}" aria-selected="${d.tool === k}" data-act="cr.tool" data-k="${k}">${t}</button>`).join('')}</div><div class="tool-panel">${panel}</div>`;
  }
  if (d.step === 'edit' && d.kind === 'video') {
    const c = CLIPS[d.clip], end = d.end ?? c.dur, len = end - d.start;
    const frames = Array.from({ length: 8 }, (_, i) => { const t = i / 8 * c.dur; const still = t < c.intro; return `<i class="${t < d.start || t >= end ? 'cut' : ''}${still ? ' still' : ''}"></i>`; }).join('');
    return `<header class="ah">${back}<b class="ah-t">Монтаж відео</b><span class="grow"></span><button class="lnk strong" data-act="cr.next" ${len >= 3 ? '' : 'disabled'}>Далі</button></header>
      <div class="scroll" data-scroll="ved"><div class="ed-prev vid" data-act="cr.playToggle">${video(d.clip, { paused: !top.play })}${d.title ? `<span class="v-title">${esc(d.title)}</span>` : ''}${top.play ? '' : `<span class="v-play">${icon('play', 30, true)}</span>`}</div>
      <div class="pad"><div class="tl-head"><b>Обрізка</b><span>Довжина: <b>${len} с</b></span></div>
      <div class="film">${frames}</div>
      <label class="rng"><span>Початок: ${d.start} с</span><input type="range" min="0" max="${c.dur - 3}" value="${d.start}" data-rng="start" aria-label="Початок відео"></label>
      <label class="rng"><span>Кінець: ${end} с</span><input type="range" min="3" max="${c.dur}" value="${end}" data-rng="end" aria-label="Кінець відео"></label>
      <p class="muted sm">Підказка: перегляньте відео й подумайте, з якої секунди починається найцікавіше. Перші 3 секунди вирішують, чи гортатиме глядач далі.</p>
      <label class="fl"><span>Заголовок на відео</span><input class="in" data-keep="cr.vtitle" data-in="cr.vtitle" value="${esc(d.title)}" maxlength="24" placeholder="Наприклад: «Кіт проти лазера»"></label>
      <p class="lbl">Музика</p><div class="music">${MUSIC.map(m => `<button class="mus${d.music === m.id ? ' on' : ''}" data-act="cr.music" data-m="${m.id}">${icon(m.id === 'none' ? 'close' : 'music', 18)}<span><b>${esc(m.t)}</b>${m.by ? `<small>${esc(m.by)}${m.free ? ' · вільна для використання' : ''}</small>` : ''}</span>${d.music === m.id ? icon('check', 18) : ''}</button>`).join('')}</div></div></div>`;
  }
  // опис і налаштування
  const topic = d.kind === 'photo' ? SCENES[s.gallery.find(x => x.id === d.gid)?.scene]?.topic : d.kind === 'video' ? CLIPS[d.clip]?.topic : 'me';
  const tags = suggestTags(lk, topic, d.caption);
  const capLen = d.caption.length, tagN = (d.caption.match(/#[\p{L}\p{N}_]+/gu) || []).length;
  const pa = s.pendingAd, brand = pa && BRANDS.find(b => b.id === pa.id);
  const collab = s.collab && CREATORS.find(c => c.id === s.collab);
  const slots = schedSlots(s.t);
  return `<header class="ah">${back}<b class="ah-t">${d.kind === 'text' ? 'Новий допис' : 'Опис'}</b></header>
    <div class="scroll pad" data-scroll="det">${d.idea ? `<p class="hint">${icon('idea', 16)}<span>Ідея: <b>${esc(d.idea)}</b></span></p>` : ''}<div class="det-top"><span class="det-m">${d.kind === 'text' ? `<div class="txtcard" style="background:${d.bg}"><p>${esc(d.txt.slice(0, 60))}</p></div>` : prev(s, d)}</span>
      <textarea class="in" data-keep="cr.caption" data-in="cr.caption" rows="5" maxlength="2200" placeholder="${d.kind === 'text' ? 'Додайте хештеги (необов’язково)' : 'Напишіть опис… Розкажіть, що на фото, або поставте питання підписникам'}" aria-label="Опис">${esc(d.caption)}</textarea></div>
    <p class="muted sm right" data-cnt>${capLen} символів · ${tagN} ${tagN === 1 ? 'хештег' : tagN >= 2 && tagN <= 4 ? 'хештеги' : 'хештегів'}</p>
    <p class="lbl">Хештеги</p><div class="chips wrap" data-tags>${tags}</div>
    <div class="opt"><span class="opt-ic">${icon('location', 20)}</span><div><b>Місце</b></div><select class="in sel" data-crsel="place" aria-label="Місце">${PLACES.map(p => `<option value="${esc(p)}"${d.place === p ? ' selected' : ''}>${p || 'Не вказувати'}</option>`).join('')}</select></div>
    ${brand ? `<div class="opt"><span class="opt-ic">${icon('money', 20)}</span><div><b>Реклама: ${esc(brand.name)}</b><small>Це допис за оплату ${brand.pay} грн</small></div>${sw('cr.ad', !!d.ad, 'Рекламний допис')}</div>${d.ad ? `<div class="opt sub"><div><b>Позначка «Реклама»</b><small>Підписники побачать напис «Реклама» над дописом</small></div>${sw('cr.adMarked', d.adMarked, 'Позначка Реклама')}</div>` : ''}` : ''}
    ${collab ? `<div class="opt"><span class="opt-ic">${icon('users', 20)}</span><div><b>Співпраця з @${esc(collab.nick)}</b><small>Допис з’явиться і в її (його) підписників</small></div>${sw('cr.collab', d.collab, 'Співпраця')}</div>` : ''}
    <div class="opt"><span class="opt-ic">${icon('comment', 20)}</span><div><b>Вимкнути коментарі</b></div>${sw('cr.commentsOff', d.commentsOff, 'Вимкнути коментарі')}</div>
    <div class="opt"><span class="opt-ic">${icon('clock', 20)}</span><div><b>Коли опублікувати</b></div><select class="in sel" data-crsel="sched" aria-label="Коли опублікувати"><option value="">Зараз (${clock(s.t)})</option>${slots.map(([t, l]) => `<option value="${t}"${String(d.sched) === String(t) ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    <details class="pre"><summary>${icon('shield', 18)}Перевірте себе перед публікацією</summary><ul><li>Чи немає на фото адреси, номера будинку, назви школи, документів?</li><li>Чи погодилися люди на фото, щоб їх показували?</li><li>Чи це ваш власний твір (фото, музика, малюнок)?</li><li>Чи правдивий опис і заголовок?</li></ul></details></div>
    <footer class="foot"><button class="btn primary big" data-act="cr.publish">${d.sched ? 'Запланувати' : 'Опублікувати'}</button></footer>`;
}
function prev(s, d) {
  if (d.kind === 'video') return video(d.clip, { paused: true });
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
  const A = {
    back: async () => {
      if (d.step === 'details') d.step = d.kind === 'text' ? 'pick' : 'edit';
      else if (d.step === 'edit') d.step = 'pick';
      else {
        if (d.gid || d.txt.trim() || d.caption.trim()) {
          // як у справжніх застосунках: зберегти чернетку або видалити
          actions([{ t: 'Зберегти чернетку', icon: 'edit', on: () => { const x = sim.saveDraft({ ...d, id: d.draftId, step: d.kind !== 'text' && d.gid ? 'edit' : 'pick' }); d.draftId = x.id; lk.stack.pop(); ph.render(true); toast('Чернетку збережено: Профіль → Чернетки'); } },
            { t: d.draftId ? 'Видалити чернетку' : 'Не зберігати', icon: 'trash', danger: true, on: () => { if (d.draftId) sim.deleteDraft(d.draftId); lk.stack.pop(); ph.render(true); } }], 'Вийти з допису?');
          return;
        }
        lk.stack.pop();
      }
      top.play = false; ph.render(true);
    },
    kind: () => { d.kind = el.dataset.k; d.gid = null; d.clip = null; ph.render(true); },
    pick: () => { const g = s.gallery.find(x => x.id === el.dataset.id); d.gid = g.id; if (g.type === 'video') { d.clip = g.clip; d.start = 0; d.end = null; } ph.render(); },
    camera: () => { ph.open('camera', { returnTo: d.kind === 'video' ? 'video' : 'photo' }); },
    next: () => { if (d.step === 'pick') d.step = d.kind === 'text' ? 'details' : 'edit'; else d.step = 'details'; top.play = false; ph.render(true); },
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
      if (d.kind !== 'text' && !d.gid) return;
      const draft = { kind: d.kind, caption: d.caption, place: d.place, commentsOff: d.commentsOff, sched: d.sched ? +d.sched : 0, collab: d.collab };
      if (d.kind === 'photo') draft.photo = { gid: d.gid, filter: d.filter, text: d.text.trim(), textY: d.textY, sticker: d.sticker, crop: d.crop };
      else if (d.kind === 'video') draft.video = { clip: d.clip, start: d.start, end: d.end ?? CLIPS[d.clip].dur, title: d.title.trim(), music: d.music };
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
  const d = lk.top.d, v = el.value;
  if (key === 'cr.txt') { d.txt = v; const c = lk.ph.root.querySelector('[data-cnt]'); if (c) c.textContent = `${v.length} / 500`; const b = lk.ph.root.querySelector('[data-act="cr.next"]'); if (b) b.disabled = !v.trim(); }
  else if (key === 'cr.caption') { d.caption = v; const n = (v.match(/#[\p{L}\p{N}_]+/gu) || []).length; const c = lk.ph.root.querySelector('[data-cnt]'); if (c) c.textContent = `${v.length} символів · ${n} ${n === 1 ? 'хештег' : n >= 2 && n <= 4 ? 'хештеги' : 'хештегів'}`; }
  else if (key === 'cr.ptext') { d.text = v; const pv = lk.ph.root.querySelector('.ed-prev'); if (pv) pv.innerHTML = prev(lk.s, d); }
  else if (key === 'cr.vtitle') { d.title = v; const t = lk.ph.root.querySelector('.ed-prev .v-title'); if (t) t.textContent = v; else if (v) lk.ph.render(); }
  else if (key === 'cr.pq') d.pq = v;
  else if (key === 'cr.pa0') d.pa[0] = v;
  else if (key === 'cr.pa1') d.pa[1] = v;
}
export function createRange(lk, key, el) {
  const d = lk.top.d, c = CLIPS[d.clip], v = +el.value;
  if (key === 'start') { d.start = Math.min(v, (d.end ?? c.dur) - 3); }
  else { d.end = Math.max(v, d.start + 3); }
  lk.ph.render();
}
export function createToggle(lk, key) { const d = lk.top.d, k = key.slice(3); d[k] = !d[k]; lk.ph.render(); }
export function createSelect(lk, key, v) { lk.top.d[key] = v; lk.ph.render(); }
