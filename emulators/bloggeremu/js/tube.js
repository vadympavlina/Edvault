// Симулятор блогера · відеоплатформа «Хвиля»: канал і його оформлення, завантаження відео з обкладинкою,
// головна з відео інших авторів, Творча студія з аналітикою (покази, CTR, утримання глядачів).
import { icon } from './icons.js';
import { photo, video, avatar } from './art.js';
import { esc, rich, sheet, actions, confirm, toast } from './ui.js';
import { NICHES, nicheOf, CLIPS, CREATORS, AV_COLORS, AV_SYMBOLS, COMMENTS } from './data.js';
import { ago, num, plural, clock, dayOf, DAY, repliesFor, toneOf } from './sim.js';
import { mediaUrl } from './media.js';
import { fmtDur, vertical, checks } from './quality.js';
import { fileBtn, topicOptions } from './gal.js';
import { brandScore, createChannel, updateChannel, tubeUpload, tubeDelete, tubeEdit, tubeReply, tubeHeart, tubeHide, tubeSummary, tubeFeed, tubePublishNow, isShort, SHORTS_MAX, PARTNER } from './tubesim.js';
import { nickErr } from './likeer.js';
import { snap } from './create.js';

export const tubeLogo = (s = 28) => `<svg class="logo" width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true"><rect x="2" y="6" width="44" height="36" rx="11" fill="#e62117"/><path d="M19 15.5v17l14-8.5z" fill="#fff"/><path d="M6 37c5-3 9-3 14 0s9 3 14 0 8-3 10-2" stroke="#ffb3ad" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
const BANNERS = ['#3949ab', '#00897b', '#d81b60', '#5e35b1', '#ef6c00', '#37474f'];
const VIS = [['public', 'Відкритий', 'Бачать усі'], ['unlisted', 'За посиланням', 'Лише ті, кому ви надіслали посилання'], ['private', 'Приватний', 'Лише ви']];
const NOTIF_IC = { comment: 'comment', star: 'fire', trophy: 'trophy', clock: 'clock' };
const blankUpload = topic => ({ step: 'pick', gid: null, clip: null, own: false, dur: 0, title: '', desc: '', thumb: { kind: 'frame', i: -1, text: '' }, topic, kids: null, vis: 'public', sched: '' });

export class Tube {
  constructor(phone) { this.ph = phone; this.sim = phone.sim; this.stack = [{ v: this.sim.s.tube ? 'home' : 'welcome' }]; }
  get s() { return this.sim.s; }
  get ch() { return this.sim.s.tube; }
  get top() { if (!this.stack.length) this.stack.push({ v: this.ch ? 'home' : 'welcome' }); return this.stack[this.stack.length - 1]; }
  go(v, a = {}) { this.stack.push({ v, ...a }); this.ph.render(true); }
  tab(v) { this.stack = [{ v }]; if (v === 'notifs' && this.ch) this.ch.unread = 0; this.ph.render(true); }
  back() { if (this.stack.length > 1) this.stack.pop(); else this.ph.home(); this.ph.render(true); }
  get live() { return ['home', 'channel', 'studio', 'video', 'stats', 'notifs', 'comments'].includes(this.top.v); }
  chAv(size) { const c = this.ch; return avatar({ name: c.name, color: c.avatar.color, sym: c.avatar.sym, img: c.avatar.img }, size); }

  render() {
    if (!this.ch && !['welcome', 'create'].includes(this.top.v)) this.stack = [{ v: 'welcome' }];
    if (this.ch && ['welcome', 'create'].includes(this.top.v)) this.stack = [{ v: 'home' }];
    const v = this.top.v, fn = this['v_' + v] || this.v_home, bars = ['home', 'studio', 'channel', 'notifs'].includes(v);
    return `<div class="tb-app${bars ? ' with-tabs' : ''}">${fn.call(this, this.top)}${bars ? this.tabs(v) : ''}</div>`;
  }
  tabs(v) {
    const t = (k, ic, label) => `<button class="tb${v === k ? ' on' : ''}" data-act="tb.tab" data-v="${k}"${v === k ? ' aria-current="page"' : ''}>${ic}<small>${label}</small></button>`;
    return `<nav class="tabbar tb-tabs">${t('home', icon('home', 23, v === 'home'), 'Головна')}${t('studio', icon('bars', 23), 'Студія')}<button class="tb up" data-act="tb.upload" aria-label="Завантажити відео">${icon('plus', 26)}</button>${t('notifs', `${icon('bell', 23, v === 'notifs')}${this.ch.unread ? `<i class="dot">${this.ch.unread > 99 ? '99+' : this.ch.unread}</i>` : ''}`, 'Сповіщення')}${t('channel', this.chAv(27), 'Канал')}</nav>`;
  }
  head(title, right = '') { return `<header class="ah"><button class="ib" data-act="tb.back" aria-label="Назад">${icon('back', 24)}</button><b class="ah-t">${title}</b><span class="grow"></span>${right}</header>`; }

  /* ═════════ Початок ═════════ */
  v_welcome() {
    return `<div class="welcome tb-wel"><div class="wl-logo">${tubeLogo(72)}</div><h1>Хвиля</h1><p>Відеоплатформа для довгих відео й коротких роликів. Створіть канал, оформіть його й завантажте своє відео — і подивіться, як на нього відреагують глядачі.</p>
      <button class="btn red big" data-act="tb.start">Створити канал</button><p class="wl-note">Навчальна платформа: глядачі й коментарі вигадані. Ваші файли зберігаються лише в цьому браузері.</p></div>`;
  }
  v_create(a) {
    const me = this.s.me, d = a.d ||= { name: me?.name || '', handle: me?.nick || '', topic: me?.niche || 'pets' };
    const err = d.handle ? nickErr(d.handle) : '';
    return `${this.head('Новий канал')}<div class="scroll pad">
      <label class="fl"><span>Назва каналу</span><input class="in" data-keep="tb.cname" data-in="tb.cname" value="${esc(d.name)}" maxlength="40" placeholder="Наприклад: «Кіт Мурчик і я»"></label>
      <label class="fl"><span>Адреса каналу</span><div class="handle">@<input class="in" data-keep="tb.chandle" data-in="tb.chandle" value="${esc(d.handle)}" maxlength="20" placeholder="murchyk.tv" autocapitalize="off" spellcheck="false"></div></label>
      <p class="fl-err" data-err>${esc(err)}</p>
      <p class="hint">${icon('info', 16)}<span>Не використовуйте в назві справжнє прізвище, школу чи місто — так безпечніше.</span></p>
      <p class="lbl">Про що канал</p><div class="niches sm">${Object.entries(NICHES).map(([k, n]) => `<button class="niche${d.topic === k ? ' on' : ''}" data-act="tb.cTopic" data-k="${k}">${icon(n.icon, 20)}<span>${n.t}</span></button>`).join('')}</div></div>
      <footer class="foot"><button class="btn red big" data-act="tb.createCh" ${d.name.trim() && d.handle && !err ? '' : 'disabled'}>Створити канал</button></footer>`;
  }

  /* ═════════ Головна ═════════ */
  v_home(a) {
    const s = this.s, ch = this.ch, f = a.f || 'all', feed = tubeFeed(this.sim, f);
    const mine = ch.videos.filter(v => v.t && v.vis === 'public' && s.t - v.t < 2 * DAY && (f === 'all' || v.topic === f)).slice(0, 2);
    const shorts = feed.filter(x => x.short).slice(0, 6), long = feed.filter(x => !x.short);
    const card = x => { const c = CREATORS.find(y => y.id === x.cid); return `<button class="tv-card" data-act="tb.watch" data-id="${x.id}"><span class="tv-th">${photo({ scene: CLIPS[x.clip].scene, v: (x.views % 97) / 1000 })}<i class="tv-dur">${fmtDur(x.dur)}</i></span><span class="tv-meta">${avatar({ name: c.name, color: c.color, sym: nicheOf(c.niche).icon }, 34)}<span><b>${esc(x.title)}</b><small>${esc(c.name)} · ${num(x.views)} ${plural(x.views, 'перегляд', 'перегляди', 'переглядів')} · ${x.ago} ${plural(x.ago, 'день', 'дні', 'днів')} тому</small></span></span></button>`; };
    return `<header class="ah main">${tubeLogo(30)}<b class="brand tb-brand">Хвиля</b><span class="grow"></span><button class="ib" data-act="tb.tab" data-v="notifs" aria-label="Сповіщення">${icon('bell', 23)}${ch.unread ? `<i class="dot">${ch.unread > 99 ? '99+' : ch.unread}</i>` : ''}</button></header>
      <div class="chips-row" role="tablist" aria-label="Теми">${[['all', 'Усе'], ...Object.entries(NICHES).map(([k, n]) => [k, n.t])].map(([k, t]) => `<button role="tab" class="chip-t${f === k ? ' on' : ''}" aria-selected="${f === k}" data-act="tb.feedF" data-f="${k}">${t}</button>`).join('')}</div>
      <div class="scroll" data-scroll="tbhome">
      ${mine.map(v => `<button class="tv-card mine" data-act="tb.video" data-id="${v.id}"><span class="tv-th${v.shorts ? ' sh' : ''}">${this.thumbHtml(v)}</span><span class="tv-meta">${this.chAv(34)}<span><b>${esc(v.title)}</b><small>Ваше відео · ${num(v.stats.views)} ${plural(v.stats.views, 'перегляд', 'перегляди', 'переглядів')} · ${ago(s.t, v.t)}</small></span></span></button>`).join('')}
      ${long.slice(0, 2).map(card).join('')}
      ${shorts.length ? `<h3 class="tv-shelf">${icon('spark', 18)}Короткі відео</h3><div class="shorts">${shorts.map(x => `<button class="sh-card" data-act="tb.watch" data-id="${x.id}"><span class="sh-th">${photo({ scene: CLIPS[x.clip].scene, v: (x.views % 89) / 1000 })}</span><b>${esc(x.title)}</b><small>${num(x.views)} переглядів</small></button>`).join('')}</div>` : ''}
      ${long.slice(2, 10).map(card).join('')}<p class="end">${icon('check', 18)}Це всі відео на сьогодні</p></div>`;
  }
  // Відео іншого автора
  v_watch(a) {
    const s = this.s, x = tubeFeed(this.sim).find(y => y.id === a.id); if (!x) return this.v_gone();
    const c = CREATORS.find(y => y.id === x.cid), fol = this.ch.follows.includes(c.id), liked = this.ch.liked.includes(x.id);
    const seed = x.views % 7, cms = [COMMENTS.praise[seed % COMMENTS.praise.length], (COMMENTS.topic[x.topic] || COMMENTS.praise)[seed % 3], COMMENTS.praise[(seed + 3) % COMMENTS.praise.length]];
    const names = ['Оля', 'Марко', 'Ліза'];
    return `${this.head('')}<div class="scroll" data-scroll="watch"><div class="player">${video(x.clip)}</div><div class="pad">
      <h2 class="tv-title">${esc(x.title)}</h2><p class="muted sm">${num(x.views)} ${plural(x.views, 'перегляд', 'перегляди', 'переглядів')} · ${x.ago} ${plural(x.ago, 'день', 'дні', 'днів')} тому</p>
      <div class="tv-ch">${avatar({ name: c.name, color: c.color, sym: nicheOf(c.niche).icon }, 40)}<span><b>${esc(c.name)}</b><small>${num(c.followers)} підписників</small></span><span class="grow"></span><button class="btn sm${fol ? '' : ' dark'}" data-act="tb.follow" data-id="${c.id}">${fol ? 'Ви підписані' : 'Підписатися'}</button></div>
      <div class="tv-acts"><button class="pill${liked ? ' on' : ''}" data-act="tb.likeF" data-id="${x.id}" aria-pressed="${liked}">${icon('thumbUp', 18, liked)}${num(Math.round(x.views * 0.05) + (liked ? 1 : 0))}</button><button class="pill" data-act="tb.toast" data-t="Посилання скопійовано">${icon('share', 18)}Поділитися</button></div>
      <h3 class="sec">Коментарі</h3>${cms.map((t, i) => `<div class="cm">${avatar({ name: names[i], color: AV_COLORS[(seed + i * 3) % AV_COLORS.length] }, 32)}<div class="cm-b"><p><b>${names[i]}</b> ${esc(t)}</p><small>${1 + (seed + i) % 9} год</small></div></div>`).join('')}</div></div>`;
  }
  v_gone() { return `${this.head('')}<div class="empty">${icon('trash', 40)}<b>Відео недоступне</b></div>`; }

  /* ═════════ Мій канал ═════════ */
  bannerHtml(b = this.ch.banner) { const src = b.img && mediaUrl(b.img); return `<div class="ch-banner" style="background:${b.color}">${src ? `<img src="${src}" alt="">` : `<span>${tubeLogo(26)}</span>`}</div>`; }
  v_channel(a) {
    const ch = this.ch, s = this.s, tab = a.tab || 'videos', vids = ch.videos.filter(v => v.t || v.sched);
    const list = tab === 'shorts' ? vids.filter(v => isShort(v)) : vids.filter(v => !isShort(v));
    const row = v => `<button class="tv-row" data-act="tb.video" data-id="${v.id}"><span class="tv-th${v.shorts ? ' sh' : ''}">${this.thumbHtml(v)}</span><span><b>${esc(v.title)}</b><small>${v.t ? `${num(v.stats.views)} ${plural(v.stats.views, 'перегляд', 'перегляди', 'переглядів')} · ${ago(s.t, v.t)}` : `Вийде о ${clock(v.sched)}`}${v.vis !== 'public' ? ` · ${VIS.find(x => x[0] === v.vis)[1]}` : ''}</small></span></button>`;
    return `<header class="ah main"><b class="ah-t">${esc(ch.name)}</b><span class="grow"></span><button class="ib" data-act="tb.go" data-v="custom" aria-label="Оформлення каналу">${icon('palette', 23)}</button></header>
      <div class="scroll" data-scroll="tbch">${this.bannerHtml()}<section class="ch-head">${this.chAv(72)}<div><h2>${esc(ch.name)}</h2><p class="muted sm">@${esc(ch.handle)} · ${num(ch.subs)} ${plural(ch.subs, 'підписник', 'підписники', 'підписників')} · ${vids.length} ${plural(vids.length, 'відео', 'відео', 'відео')}</p></div></section>
      ${ch.desc ? `<p class="ch-desc">${rich(ch.desc.length > 120 ? ch.desc.slice(0, 118) + '…' : ch.desc)}</p>` : `<p class="ch-desc muted">Додайте опис каналу — розкажіть, про що він.</p>`}
      <div class="pr-btns pad-x"><button class="btn" data-act="tb.go" data-v="custom">${icon('palette', 16)}Оформлення</button><button class="btn" data-act="tb.tab" data-v="studio">${icon('bars', 16)}Студія</button></div>
      <div class="ptabs" role="tablist">${[['videos', 'Відео'], ['shorts', 'Короткі'], ['about', 'Про канал']].map(([k, t]) => `<button role="tab" class="${tab === k ? 'on' : ''}" aria-selected="${tab === k}" data-act="tb.chTab" data-t="${k}">${t}</button>`).join('')}</div>
      ${tab === 'about' ? `<div class="pad"><p>${ch.desc ? rich(ch.desc) : '<span class="muted">Опису ще немає.</span>'}</p><div class="check" style="margin-top:12px"><p>${icon(nicheOf(ch.topic).icon, 18)}<span>Тема: ${esc(nicheOf(ch.topic).t)}</span></p><p>${icon('clock', 18)}<span>Канал створено: день ${dayOf(ch.created) + 1}</span></p><p>${icon('eye', 18)}<span>${num(tubeSummary(this.sim).total)} переглядів усього</span></p></div></div>`
        : list.length ? `<div class="tv-list">${list.map(row).join('')}</div>` : `<div class="empty">${icon(tab === 'shorts' ? 'spark' : 'video', 40)}<b>${tab === 'shorts' ? 'Коротких відео ще немає' : 'Відео ще немає'}</b><p>${tab === 'shorts' ? `Вертикальне відео до ${SHORTS_MAX} секунд стане коротким.` : 'Натисніть «+» унизу, щоб завантажити перше.'}</p><button class="btn red" data-act="tb.upload">${icon('upload', 16)}Завантажити відео</button></div>`}</div>`;
  }

  /* ═════════ Оформлення каналу ═════════ */
  v_custom(a) {
    const ch = this.ch, d = a.d ||= { name: ch.name, desc: ch.desc, color: ch.avatar.color, sym: ch.avatar.sym, img: ch.avatar.img, bColor: ch.banner.color, bImg: ch.banner.img };
    const own = this.s.gallery.filter(g => g.own && g.type === 'photo').slice(0, 12);
    const preview = { ...ch, name: d.name || ch.name, desc: d.desc, avatar: { color: d.color, sym: d.sym, img: d.img }, banner: { color: d.bColor, img: d.bImg } };
    const sc = brandScore(preview), bg = d.bImg && this.s.gallery.find(g => g.mid === d.bImg);
    const tip = bg ? (bg.w < 1500 || bg.w / bg.h < 1.4 ? `Для шапки краще широке фото від 2048×1152. Це — ${bg.w}×${bg.h}, його сильно обріже або воно буде розмитим.` : `Добре: ${bg.w}×${bg.h}. Важливе розміщуйте по центру — на телефоні краї обрізаються.`) : 'Шапка — широке зображення вгорі каналу. Найкраще — горизонтальне фото від 2048×1152.';
    return `${this.head('Оформлення каналу', `<button class="lnk strong" data-act="tb.saveCustom">Готово</button>`)}<div class="scroll" data-scroll="custom">
      <div class="cu-prev">${this.bannerHtml(preview.banner)}<div class="cu-av">${avatar({ name: preview.name, color: d.color, sym: d.sym, img: d.img }, 64)}<span><b>${esc(preview.name)}</b><small>@${esc(ch.handle)}</small></span></div></div>
      <div class="pad"><section class="score"><div class="sc-top"><b>Оформлення: ${Math.round(sc.k * 100)}%</b><i><b style="width:${Math.round(sc.k * 100)}%"></b></i></div><ul>${sc.items.map(([, ok, t, why]) => `<li class="${ok ? 'ok' : ''}">${icon(ok ? 'check' : 'info', 16)}<span><b>${t}</b><small>${why}</small></span></li>`).join('')}</ul></section>
      <h3 class="sec">Шапка каналу</h3><div class="ban-pick"><button class="bp${!d.bImg ? ' on' : ''}" data-act="tb.bImg" data-mid="" aria-label="Без фото, лише колір" style="background:${d.bColor}"></button>${own.map(g => `<button class="bp${d.bImg === g.mid ? ' on' : ''}" data-act="tb.bImg" data-mid="${g.mid}" aria-label="Ваше фото">${photo(g, { thumb: true })}</button>`).join('')}${fileBtn('banner', 'Додати', 'bp add', 'image/*')}</div>
      ${d.bImg ? '' : `<div class="sw-row">${BANNERS.map(c => `<button class="cdot${d.bColor === c ? ' on' : ''}" style="background:${c}" data-act="tb.bColor" data-c="${c}" aria-label="Колір шапки"></button>`).join('')}</div>`}
      <p class="hint">${icon('info', 16)}<span>${esc(tip)}</span></p>
      <h3 class="sec">Фото каналу</h3><div class="av-pick"><button class="avp${d.img ? '' : ' on'}" data-act="tb.aImg" data-mid="" aria-label="Значок">${avatar({ name: preview.name, color: d.color, sym: d.sym }, 52)}</button>${own.map(g => `<button class="avp${d.img === g.mid ? ' on' : ''}" data-act="tb.aImg" data-mid="${g.mid}" aria-label="Ваше фото">${avatar({ img: g.mid }, 52)}</button>`).join('')}${fileBtn('tavatar', 'Додати', 'avp add', 'image/*')}</div>
      ${d.img ? '' : `<div class="sw-row">${AV_COLORS.map(c => `<button class="cdot${d.color === c ? ' on' : ''}" style="background:${c}" data-act="tb.aColor" data-c="${c}" aria-label="Колір"></button>`).join('')}</div><div class="sw-row">${AV_SYMBOLS.map(k => `<button class="sym${d.sym === k ? ' on' : ''}" data-act="tb.aSym" data-k="${k}" aria-label="Значок">${k === 'letter' ? `<b>${esc((preview.name[0] || '?').toUpperCase())}</b>` : icon(k, 22)}</button>`).join('')}</div>`}
      <label class="fl"><span>Назва каналу</span><input class="in" data-keep="tb.uname" data-in="tb.uname" value="${esc(d.name)}" maxlength="40"></label>
      <label class="fl"><span>Опис каналу</span><textarea class="in" data-keep="tb.udesc" data-in="tb.udesc" rows="4" maxlength="1000" placeholder="Про що канал і як часто виходять відео? Наприклад: «Щосуботи — нові трюки мого кота»">${esc(d.desc)}</textarea></label>
      <p class="muted sm right" data-ucnt>${d.desc.length} / 1000</p>
      <p class="hint">${icon('shield', 16)}<span>Не пишіть в описі школу, адресу, телефон і не показуйте їх на шапці.</span></p></div></div>`;
  }

  /* ═════════ Завантаження відео ═════════ */
  v_upload(a) {
    const s = this.s, u = a.u;
    if (u.gid && !s.gallery.some(g => g.id === u.gid)) { u.gid = null; u.step = 'pick'; }
    if (u.step === 'pick') {
      const vids = s.gallery.filter(g => g.type === 'video');
      const prev = u.gid ? this.srcPlayer(u, true) : `<div class="empty sm">${icon('video', 36)}<b>Виберіть відео</b><p>Додайте своє з телефону або візьміть записане камерою</p></div>`;
      return `<header class="ah"><button class="ib" data-act="tb.back" aria-label="Закрити">${icon('close', 24)}</button><b class="ah-t">Завантажити відео</b><span class="grow"></span><button class="lnk strong" data-act="tb.upNext" ${u.gid ? '' : 'disabled'}>Далі</button></header>
        <div class="scroll" data-scroll="tbpick"><div class="up-prev">${prev}</div>
        <div class="pick-bar"><b>Ваші відео</b><span class="grow"></span>${fileBtn('tube', 'З телефону', 'btn sm red', 'video/*')}</div>
        <p class="pick-tip">${icon('info', 15)}<span>Горизонтальне відео — для звичайного відео. Вертикальне до ${SHORTS_MAX} с стане коротким роликом.</span></p>
        <div class="pick-grid">${vids.map(g => `<button class="pg${u.gid === g.id ? ' on' : ''}" data-act="tb.pick" data-id="${g.id}" aria-label="${esc(g.own ? 'Ваше відео' : CLIPS[g.clip]?.t || 'Відео')}">${g.own ? video(g, { paused: true }) : video(g.clip, { paused: true })}<i class="pg-dur">${fmtDur(g.own ? g.dur : CLIPS[g.clip].dur)}</i></button>`).join('')}</div></div>`;
    }
    const g = s.gallery.find(x => x.id === u.gid), shorts = g.own ? vertical(g) && g.dur <= SHORTS_MAX : true;
    const frames = g.own ? [-1, 0, 1, 2].filter(i => i < 0 || mediaUrl(g.mid, 'f' + i) !== mediaUrl(g.mid, 'thumb')) : [0, 1, 2];
    const photos = s.gallery.filter(x => x.own && x.type === 'photo').slice(0, 8);
    const slots = []; for (let x = Math.ceil((s.t + 30) / 60) * 60; slots.length < 24; x += 60) slots.push(x);
    const tl = u.title.length, dl = u.desc.length;
    return `${this.head('Деталі відео')}<div class="scroll pad" data-scroll="tbdet">
      <div class="up-sum"><span class="tv-th">${this.thumbHtml({ src: g.own ? { own: true, gid: g.id, g } : { clip: g.clip }, thumb: u.thumb, dur: g.own ? g.dur : CLIPS[g.clip].dur, shorts })}</span><span><b>${shorts ? 'Коротке відео' : 'Відео'}</b><small>${fmtDur(g.own ? g.dur : CLIPS[g.clip].dur)} · ${g.own ? (vertical(g) ? 'вертикальне' : 'горизонтальне') : 'вбудоване'}</small></span></div>
      <label class="fl"><span>Заголовок (обов’язково)</span><input class="in" data-keep="tb.title" data-in="tb.title" value="${esc(u.title)}" maxlength="100" placeholder="Про що відео? Наприклад: «Вчу кота давати лапу»"></label><p class="muted sm right" data-tcnt>${tl} / 100</p>
      <label class="fl"><span>Опис</span><textarea class="in" data-keep="tb.desc" data-in="tb.desc" rows="4" maxlength="5000" placeholder="Розкажіть, що буде у відео. Слова з опису допомагають знайти відео через пошук">${esc(u.desc)}</textarea></label><p class="muted sm right" data-dcnt>${dl} / 5000</p>
      ${shorts ? '' : `<h3 class="sec">Обкладинка</h3><p class="muted sm">Її бачать у стрічці ще до натискання. Від неї найбільше залежить, чи клацнуть на відео.</p>
      <div class="th-pick">${frames.map(i => `<button class="thp${u.thumb.kind === 'frame' && u.thumb.i === i ? ' on' : ''}" data-act="tb.thFrame" data-i="${i}" aria-label="Кадр із відео">${g.own ? `<img src="${mediaUrl(g.mid, i < 0 ? 'thumb' : 'f' + i)}" alt="">` : photo({ scene: CLIPS[g.clip].scene, v: (i + 1) * 0.3 })}</button>`).join('')}${photos.map(x => `<button class="thp${u.thumb.kind === 'photo' && u.thumb.gid === x.id ? ' on' : ''}" data-act="tb.thPhoto" data-id="${x.id}" aria-label="Ваше фото">${photo(x, { thumb: true })}</button>`).join('')}${fileBtn('thumb', 'Своя', 'thp add', 'image/*')}</div>
      <label class="fl"><span>Напис на обкладинці</span><input class="in" data-keep="tb.thText" data-in="tb.thText" value="${esc(u.thumb.text)}" maxlength="30" placeholder="2–4 слова, наприклад: «Кіт дає лапу!»"></label>`}
      <div class="opt"><span class="opt-ic">${icon(nicheOf(u.topic).icon, 20)}</span><div><b>Тема</b></div><select class="in sel" data-tbsel="topic" aria-label="Тема">${topicOptions(u.topic)}</select></div>
      <h3 class="sec">Аудиторія (обов’язково)</h3><p class="muted sm">Чи зняте відео спеціально для дітей? Так вимагають правила відеоплатформ.</p>
      <div class="radio">${[[true, 'Так, це для дітей', 'Коментарі буде вимкнено'], [false, 'Ні, не спеціально для дітей', 'Звичайне відео']].map(([v, t, sub]) => `<button class="rd${u.kids === v ? ' on' : ''}" data-act="tb.kids" data-v="${v}" role="radio" aria-checked="${u.kids === v}"><i></i><span><b>${t}</b><small>${sub}</small></span></button>`).join('')}</div>
      <h3 class="sec">Доступ</h3><div class="radio">${VIS.map(([k, t, sub]) => `<button class="rd${u.vis === k ? ' on' : ''}" data-act="tb.vis" data-v="${k}" role="radio" aria-checked="${u.vis === k}"><i></i><span><b>${t}</b><small>${sub}</small></span></button>`).join('')}</div>
      <div class="opt"><span class="opt-ic">${icon('clock', 20)}</span><div><b>Коли опублікувати</b></div><select class="in sel" data-tbsel="sched" aria-label="Коли опублікувати"><option value="">Зараз (${clock(s.t)})</option>${slots.map(x => `<option value="${x}"${String(u.sched) === String(x) ? ' selected' : ''}>${dayOf(x) === dayOf(s.t) ? 'Сьогодні' : 'Завтра'}, ${clock(x)}</option>`).join('')}</select></div>
      ${g.own ? `<details class="pre"><summary>${icon('eye', 18)}Перевірка відео</summary><ul class="qc">${checks(g).map(([k, v, c]) => `<li class="${c}">${icon(c === 'ok' ? 'check' : 'alert', 16)}<span><b>${k}</b>${esc(v)}</span></li>`).join('')}</ul></details>` : ''}
      <details class="pre"><summary>${icon('shield', 18)}Перевірте себе перед публікацією</summary><ul><li>Чи немає у відео адреси, номера будинку, школи, документів?</li><li>Чи погодилися люди у відео, щоб їх показували?</li><li>Чи ваша музика й кадри (або дозволені для використання)?</li><li>Чи правдиві заголовок і обкладинка?</li></ul></details></div>
      <footer class="foot"><button class="btn red big" data-act="tb.publish">${u.sched ? 'Запланувати' : 'Опублікувати'}</button></footer>`;
  }
  // Плеєр джерела (власне відео або вбудований кліп)
  srcPlayer(u, paused) {
    const g = this.s.gallery.find(x => x.id === u.gid); if (!g) return '';
    return g.own ? `<span class="art own"><video src="${mediaUrl(g.mid)}" poster="${mediaUrl(g.mid, 'thumb')}" controls playsinline preload="metadata"></video></span>` : video(g.clip, { paused });
  }
  // Обкладинка відео 16:9 (або 9:16 для коротких)
  thumbHtml(v) {
    const th = v.thumb || {}, dur = `<i class="tv-dur">${v.shorts ? icon('spark', 12) : fmtDur(v.dur)}</i>`;
    let img;
    if (!v.shorts && th.kind === 'photo') { const g = this.s.gallery.find(x => x.id === th.gid) || th.g; img = g ? photo(g, { thumb: true }) : ''; }
    else if (v.src.own) { const g = this.s.gallery.find(x => x.id === v.src.gid) || v.src.g; const k = v.shorts || th.i == null || th.i < 0 ? 'thumb' : 'f' + th.i; img = g?.mid && mediaUrl(g.mid, k) ? `<span class="art own"><img src="${mediaUrl(g.mid, k)}" alt=""></span>` : `<span class="art own"><span class="miss">${icon('video', 24)}</span></span>`; }
    else img = photo({ scene: CLIPS[v.src.clip]?.scene || 'cat', v: ((th.i ?? 0) + 1) * 0.3 });
    return `${img}${!v.shorts && th.text ? `<span class="th-text">${esc(th.text)}</span>` : ''}${dur}`;
  }

  /* ═════════ Моє відео ═════════ */
  v_video(a) {
    const s = this.s, v = this.ch.videos.find(x => x.id === a.id); if (!v) return this.v_gone();
    const st = v.stats, g = v.src.own ? s.gallery.find(x => x.id === v.src.gid) || v.src.g : null;
    const player = v.src.own ? (g?.mid && mediaUrl(g.mid) ? `<span class="art own"><video src="${mediaUrl(g.mid)}" poster="${mediaUrl(g.mid, 'thumb')}" controls playsinline preload="metadata"></video></span>` : `<span class="art own"><span class="miss">${icon('video', 28)}<small>Файл недоступний</small></span></span>`) : video(v.src.clip);
    return `${this.head('', `<button class="ib" data-act="tb.vMenu" data-id="${v.id}" aria-label="Ще">${icon('more', 24)}</button>`)}<div class="scroll" data-scroll="tbv-${v.id}"><div class="player${v.shorts ? ' sh' : ''}">${player}</div><div class="pad">
      <h2 class="tv-title">${esc(v.title)}</h2><p class="muted sm">${v.t ? `${num(st.views)} ${plural(st.views, 'перегляд', 'перегляди', 'переглядів')} · ${ago(s.t, v.t)}` : `Вийде ${dayOf(v.sched) === dayOf(s.t) ? 'сьогодні' : 'завтра'} о ${clock(v.sched)}`}${v.vis !== 'public' ? ` · ${VIS.find(x => x[0] === v.vis)[1]}` : ''}${v.kids ? ' · Для дітей' : ''}</p>
      <div class="tv-acts"><span class="pill static">${icon('thumbUp', 18)}${num(st.likes)}</span><span class="pill static">${icon('thumbDown', 18)}${num(st.dislikes)}</span><span class="pill static">${icon('share', 18)}${num(st.shares)}</span></div>
      ${v.t ? `<button class="stats-btn" data-act="tb.go" data-v="stats" data-id="${v.id}">${icon('chart', 18)}<span><b>Аналітика відео</b> · покази, утримання, звідки глядачі</span>${icon('chevron', 18)}</button>` : ''}
      ${v.desc ? `<div class="tv-desc">${rich(v.desc)}</div>` : ''}
      ${v.kids ? `<p class="muted pad-y">Коментарі вимкнено, бо відео позначено «Для дітей».</p>` : `<button class="pmore" data-act="tb.go" data-v="comments" data-id="${v.id}">Коментарі (${st.comments})${icon('chevron', 16)}</button>${v.comments.slice(-2).map(c => `<p class="pc sm"><b>${esc(s.people[c.pid]?.nick || '')}</b> ${esc(c.text)}</p>`).join('')}`}</div></div>`;
  }
  v_comments(a) {
    const s = this.s, v = this.ch.videos.find(x => x.id === a.id); if (!v) return this.v_gone();
    const rc = a.reply && v.comments.find(c => c.id === a.reply);
    const row = c => { const u = s.people[c.pid] || { nick: '?' }; return `<div class="cm${a.reply === c.id ? ' sel' : ''}">${avatar(u, 34)}<div class="cm-b"><p><b>@${esc(u.nick)}</b> ${esc(c.text)}</p><small>${ago(s.t, c.t)}${c.likes ? ` · ${icon('thumbUp', 12)} ${c.likes}` : ''}${c.heart ? ` · <span class="heart-by">${icon('heart', 12, true)}від автора</span>` : ''}</small>
      ${c.reply ? `<div class="cm-r">${this.chAv(24)}<p><b>${esc(this.ch.name)}</b> ${esc(c.reply.text)}</p></div>` : `<button class="lnk sm" data-act="tb.replyTo" data-c="${c.id}">Відповісти</button>`}</div>
      <div class="cm-side"><button class="ib sm${c.heart ? ' liked' : ''}" data-act="tb.heart" data-c="${c.id}" aria-label="Серце від автора" aria-pressed="${c.heart}">${icon('heart', 16, c.heart)}</button><button class="ib sm" data-act="tb.cDel" data-c="${c.id}" aria-label="Видалити коментар">${icon('trash', 16)}</button></div></div>`; };
    const sugg = rc ? repliesFor(rc).map(([t, tone], i) => `<button class="chip-btn ${tone}" data-act="tb.quick" data-i="${i}">${esc(t)}</button>`).join('') : '';
    return `${this.head('Коментарі')}<div class="scroll" data-scroll="tbc-${v.id}">${v.comments.map(row).join('') || '<div class="empty sm"><b>Коментарів поки немає</b><p>Вони з’являться, коли люди подивляться відео.</p></div>'}</div>
      <footer class="composer">${rc ? `<div class="rc-head"><span>Відповідь для <b>@${esc(s.people[rc.pid]?.nick || '')}</b></span><button class="ib sm" data-act="tb.replyTo" data-c="" aria-label="Скасувати відповідь">${icon('close', 16)}</button></div><div class="chips">${sugg}</div>` : ''}
        <div class="cmp-row">${this.chAv(30)}<input class="in" data-keep="tbcm" placeholder="${rc ? 'Напишіть відповідь…' : 'Виберіть коментар, щоб відповісти'}" ${rc ? '' : 'disabled'} maxlength="300" aria-label="Відповідь"><button class="lnk strong" data-act="tb.send" ${rc ? '' : 'disabled'}>Надіслати</button></div></footer>`;
  }

  /* ═════════ Аналітика відео ═════════ */
  v_stats(a) {
    const v = this.ch.videos.find(x => x.id === a.id); if (!v || !v.t) return this.v_gone();
    const st = v.stats, P = v.plan, ctr = st.imp ? st.views / st.imp : 0, avd = P.ret * v.dur;
    const tile = (k, val, ic, sub = '') => `<div class="tile">${icon(ic, 18)}<b>${val}</b><small>${k}${sub ? `<br>${sub}` : ''}</small></div>`;
    const good = v.why.filter(w => w[0] === '+'), bad = v.why.filter(w => w[0] === '-');
    const src = Object.entries(P.src), tot = Math.max(1, src.reduce((x, [, y]) => x + y, 0));
    const tips = [];
    if (!v.shorts && ctr < 0.04 && st.imp > 50) tips.push('Мало хто натискає: спробуйте яскравішу обкладинку з коротким написом і зрозумілий заголовок.');
    if (P.ret < 0.35) tips.push('Глядачі швидко йдуть: почніть із найцікавішого, приберіть довгий вступ.');
    if (v.flags?.vertLong) tips.push('Довге вертикальне відео в плеєрі має чорні смуги. Знімайте довгі відео горизонтально.');
    if (!v.desc) tips.push('Додайте опис зі словами, які люди вводять у пошук.');
    return `${this.head('Аналітика відео')}<div class="scroll pad" data-scroll="tbst">
      <div class="tiles">${tile('Покази', num(st.imp), 'eye')}${tile('Клікабельність', v.shorts ? '—' : (ctr * 100).toFixed(1).replace('.', ',') + '%', 'arrow', v.shorts ? 'не рахується' : 'CTR')}${tile('Перегляди', num(st.views), 'play')}${tile('Сер. перегляд', fmtDur(avd), 'clock', Math.round(P.ret * 100) + '%')}${tile('Час перегляду', (st.watch / 60).toFixed(1).replace('.', ',') + ' год', 'tv')}${tile('Підписники', '+' + num(st.subs), 'user')}</div>
      <h3>Перегляди за днями</h3>${bars(v.daily || [])}
      <h3>Утримання глядачів</h3>${retention(v.ret, v.dur)}<p class="muted sm">${v.ret[1] < 75 ? 'На початку багато людей іде — перші секунди мають зачепити.' : 'Початок тримає увагу.'} У середньому дивляться ${Math.round(P.ret * 100)}% відео.</p>
      <h3>Звідки глядачі</h3>${src.map(([k, x]) => `<div class="hbar"><span>${k}</span><i><b style="width:${Math.round(x / tot * 100)}%"></b></i><small>${Math.round(x / tot * 100)}%</small></div>`).join('')}
      <h3>Що вплинуло на результат</h3>${good.length ? `<ul class="why good">${good.map(w => `<li>${icon('check', 16)}<span>${esc(w[1])}</span></li>`).join('')}</ul>` : ''}${bad.length ? `<ul class="why bad">${bad.map(w => `<li>${icon('alert', 16)}<span>${esc(w[1])}</span></li>`).join('')}</ul>` : ''}
      ${tips.length ? `<h3>Що спробувати наступного разу</h3><ul class="why tips">${tips.map(t => `<li>${icon('idea', 16)}<span>${t}</span></li>`).join('')}</ul>` : ''}
      <p class="hint">${icon('info', 16)}<span>CTR — яка частка людей, що побачили обкладинку, натиснула на відео. Утримання — скільки відео в середньому дивляться.</span></p></div>`;
  }

  /* ═════════ Творча студія ═════════ */
  v_studio() {
    const ch = this.ch, s = this.s, sm = tubeSummary(this.sim), br = brandScore(ch), vids = ch.videos;
    const prog = (k, cur, max, t) => `<div class="prog"><span>${t}</span><i><b style="width:${Math.min(100, cur / max * 100)}%"></b></i><small>${num(Math.floor(cur))} / ${num(max)}</small></div>`;
    return `<header class="ah main"><b class="ah-t">Творча студія</b><span class="grow"></span><button class="btn sm red" data-act="tb.upload">${icon('upload', 15)}Відео</button></header><div class="scroll pad" data-scroll="studio">
      <div class="tiles three"><div class="tile">${icon('eye', 18)}<b>${num(sm.views)}</b><small>переглядів за 7 днів</small></div><div class="tile">${icon('tv', 18)}<b>${sm.hours.toFixed(1).replace('.', ',')}</b><small>годин перегляду</small></div><div class="tile">${icon('users', 18)}<b>${num(ch.subs)}</b><small>підписників</small></div></div>
      <section class="card-s"><b>${icon('trophy', 16)}Партнерська програма</b><p class="muted sm">Великі платформи дозволяють заробляти на рекламі після 1000 підписників і 4000 годин перегляду за рік. Це довгий шлях — і це нормально.</p>${prog('subs', ch.subs, PARTNER.subs, 'Підписники')}${prog('hours', sm.hours, PARTNER.hours, 'Години перегляду')}</section>
      <h3>Ваші відео</h3>${vids.length ? `<div class="st-list">${vids.map(v => { const ctr = v.stats.imp ? v.stats.views / v.stats.imp : 0; return `<button class="st-row" data-act="tb.${v.t ? 'go' : 'video'}" data-v="stats" data-id="${v.id}"><span class="tv-th${v.shorts ? ' sh' : ''}">${this.thumbHtml(v)}</span><span class="st-t"><b>${esc(v.title)}</b><small>${v.t ? `${num(v.stats.views)} перегл. · ${v.shorts ? 'коротке' : 'CTR ' + (ctr * 100).toFixed(1).replace('.', ',') + '%'} · утримання ${Math.round(v.plan.ret * 100)}%` : `Заплановано на ${clock(v.sched)}`}</small></span>${icon('chevron', 16)}</button>`; }).join('')}</div>` : `<div class="empty sm"><b>Відео ще немає</b><p>Завантажте перше — тут з’явиться його статистика.</p></div>`}
      ${br.k < 1 ? `<h3>Що покращити на каналі</h3><ul class="why tips">${br.items.filter(x => !x[1]).map(([, , t, why]) => `<li>${icon('idea', 16)}<span><b>${t}.</b> ${why}</span></li>`).join('')}</ul><button class="btn" data-act="tb.go" data-v="custom">${icon('palette', 16)}Відкрити оформлення</button>` : ''}</div>`;
  }
  v_notifs() {
    const s = this.s, list = this.ch.notifs;
    return `<header class="ah main"><b class="ah-t">Сповіщення</b></header><div class="scroll" data-scroll="tbn">${list.length ? list.map(n => `<button class="nt" data-act="tb.notif" data-id="${n.id}"><span class="nt-ic ${n.icon}">${icon(NOTIF_IC[n.icon] || 'bell', 18)}</span><p>${esc(n.text)}<small>${ago(s.t, n.t)}</small></p></button>`).join('') : `<div class="empty">${icon('bell', 40)}<b>Сповіщень поки немає</b><p>Тут з’являться коментарі, нові підписники й досягнення ваших відео.</p></div>`}</div>`;
  }

  /* ═════════ події ═════════ */
  act(name, el) {
    const s = this.s, sim = this.sim, top = this.top, ph = this.ph;
    const A = {
      tab: () => this.tab(el.dataset.v),
      back: () => this.back(),
      go: () => this.go(el.dataset.v, { id: el.dataset.id }),
      toast: () => toast(el.dataset.t),
      start: () => this.go('create'),
      cTopic: () => { top.d.topic = el.dataset.k; ph.render(); },
      createCh: () => { const d = top.d; if (!d.name.trim() || nickErr(d.handle)) return; createChannel(sim, { name: d.name.trim(), handle: d.handle, topic: d.topic, color: s.me?.avatar.color }); this.stack = [{ v: 'channel' }]; ph.render(true); toast('Канал створено! Оформіть його й завантажте перше відео'); },
      feedF: () => { top.f = el.dataset.f; ph.render(); },
      watch: () => this.go('watch', { id: el.dataset.id }),
      follow: () => { const f = this.ch.follows, i = f.indexOf(el.dataset.id); if (i >= 0) f.splice(i, 1); else f.push(el.dataset.id); ph.render(); },
      likeF: () => { const l = this.ch.liked, i = l.indexOf(el.dataset.id); if (i >= 0) l.splice(i, 1); else l.push(el.dataset.id); ph.render(); },
      video: () => this.go('video', { id: el.dataset.id }),
      chTab: () => { top.tab = el.dataset.t; ph.render(); },
      // оформлення
      bImg: () => { top.d.bImg = el.dataset.mid; ph.render(); },
      bColor: () => { top.d.bColor = el.dataset.c; ph.render(); },
      aImg: () => { top.d.img = el.dataset.mid; ph.render(); },
      aColor: () => { top.d.color = el.dataset.c; ph.render(); },
      aSym: () => { top.d.sym = el.dataset.k; ph.render(); },
      saveCustom: () => { const d = top.d; if (/\d{3}|школ|клас|вул/i.test(d.desc)) toast('Схоже, в описі є особисті дані. Краще їх прибрати'); updateChannel(sim, { name: d.name.trim() || this.ch.name, desc: d.desc.trim(), avatar: { color: d.color, sym: d.sym, img: d.img }, banner: { color: d.bColor, img: d.bImg } }); this.back(); toast('Оформлення збережено'); },
      // завантаження
      upload: () => { this.stack = this.stack.filter(x => x.v !== 'upload'); this.go('upload', { u: blankUpload(this.ch.topic) }); },
      pick: () => { const u = top.u, g = s.gallery.find(x => x.id === el.dataset.id); if (!g) return; u.gid = g.id; u.own = !!g.own; u.dur = g.own ? g.dur : CLIPS[g.clip].dur; u.clip = g.own ? null : g.clip; u.thumb = { kind: 'frame', i: g.own ? -1 : 0, text: u.thumb.text }; if (g.own && g.topic && g.topic !== 'me') u.topic = g.topic; else if (!g.own) u.topic = CLIPS[g.clip].topic; ph.render(); },
      upNext: () => { if (top.u.gid) { top.u.step = 'details'; ph.render(true); } },
      thFrame: () => { top.u.thumb = { ...top.u.thumb, kind: 'frame', i: +el.dataset.i }; ph.render(); },
      thPhoto: () => { top.u.thumb = { ...top.u.thumb, kind: 'photo', gid: el.dataset.id }; ph.render(); },
      kids: () => { top.u.kids = el.dataset.v === 'true'; ph.render(); },
      vis: () => { top.u.vis = el.dataset.v; ph.render(); },
      publish: () => {
        const u = top.u, g = s.gallery.find(x => x.id === u.gid); if (!g) return;
        if (u.title.trim().length < 3) { toast('Додайте заголовок'); ph.root.querySelector('[data-in="tb.title"]')?.focus(); return; }
        if (u.kids === null) { toast('Виберіть, чи це відео для дітей'); ph.root.querySelector('.radio .rd')?.scrollIntoView({ block: 'center' }); return; }
        const thumb = { ...u.thumb, ...(u.thumb.kind === 'photo' ? { g: snap(s.gallery.find(x => x.id === u.thumb.gid)) } : {}) };
        const v = tubeUpload(sim, { src: g.own ? { own: true, gid: g.id, g: snap(g) } : { clip: g.clip }, dur: u.dur, title: u.title, desc: u.desc, thumb, topic: u.topic, kids: u.kids, vis: u.vis, sched: u.sched ? +u.sched : 0 });
        this.stack = [{ v: 'channel' }, { v: 'video', id: v.id }]; ph.render(true); ph.save();
        toast(v.t ? (v.vis === 'private' ? 'Відео збережено як приватне' : 'Відео опубліковано! Стежте за аналітикою') : `Відео вийде о ${clock(v.sched)}`);
      },
      vMenu: () => {
        const v = this.ch.videos.find(x => x.id === el.dataset.id); if (!v) return;
        actions([
          { t: 'Редагувати заголовок', icon: 'edit', on: () => this.editField(v, 'title') },
          { t: 'Редагувати опис', icon: 'text', on: () => this.editField(v, 'desc') },
          !v.t && { t: 'Опублікувати зараз', icon: 'send', on: () => { tubePublishNow(sim, v); toast('Опубліковано'); } },
          ...VIS.filter(x => x[0] !== v.vis).map(([k, t]) => ({ t: `Доступ: ${t}`, icon: k === 'private' ? 'lock' : 'globe', on: () => { tubeEdit(sim, v.id, { vis: k }); toast(k === 'private' ? 'Тепер відео бачите лише ви' : 'Доступ змінено'); } })),
          { t: 'Видалити відео', icon: 'trash', danger: true, on: async () => { if (await confirm('Видалити відео?', 'Видалити', true, 'Перегляди й коментарі зникнуть.')) { tubeDelete(sim, v.id); this.back(); } } },
        ]);
      },
      notif: () => { const n = this.ch.notifs.find(x => x.id === el.dataset.id); if (n?.vid && this.ch.videos.some(v => v.id === n.vid)) this.go(n.icon === 'comment' ? 'comments' : 'video', { id: n.vid }); },
      // коментарі
      replyTo: () => { top.reply = el.dataset.c || null; ph.render(); if (top.reply) setTimeout(() => ph.root.querySelector('[data-keep="tbcm"]')?.focus(), 0); },
      quick: () => { const v = this.ch.videos.find(x => x.id === top.id), c = v?.comments.find(x => x.id === top.reply); if (!c) return; const [t, tone] = repliesFor(c)[+el.dataset.i]; tubeReply(sim, v.id, c.id, t, tone); this.replied(tone); },
      send: () => { const inp = ph.root.querySelector('[data-keep="tbcm"]'), t = inp?.value.trim(); if (!t || !top.reply) return; inp.value = ''; const tone = toneOf(t); tubeReply(sim, top.id, top.reply, t, tone); this.replied(tone); },
      heart: () => { tubeHeart(sim, top.id, el.dataset.c); },
      cDel: () => { tubeHide(sim, top.id, el.dataset.c); toast('Коментар видалено'); },
    };
    A[name]?.();
  }
  replied(tone) { this.top.reply = null; this.ph.render(); toast(tone === 'rude' ? 'Грубість знижує довіру глядачів' : tone === 'kind' ? 'Ввічлива відповідь — глядачам приємно' : 'Відповідь надіслано'); }
  editField(v, k) {
    const api = sheet({ title: k === 'title' ? 'Заголовок' : 'Опис', html: `${k === 'title' ? `<input class="in" maxlength="100" data-ed value="${esc(v.title)}" aria-label="Заголовок">` : `<textarea class="in" rows="6" maxlength="5000" data-ed aria-label="Опис">${esc(v.desc)}</textarea>`}<button class="btn red big" data-save style="margin-top:12px">Зберегти</button>`,
      onOpen: a => a.$('[data-save]').addEventListener('click', () => { const val = a.$('[data-ed]').value.trim(); if (k === 'title' && val.length < 3) return toast('Заголовок закороткий'); tubeEdit(this.sim, v.id, { [k]: val }); a.close(); toast('Збережено. На нові покази це вплине поступово'); }) });
    setTimeout(() => api.$('[data-ed]').focus(), 50);
  }
  input(k, el) {
    const t = this.top, v = el.value, root = this.ph.root;
    if (k === 'tb.cname') { t.d.name = v; this.syncCreate(); }
    else if (k === 'tb.chandle') { t.d.handle = v.toLowerCase(); this.syncCreate(); }
    else if (k === 'tb.udesc') { t.d.desc = v; this.ph.render(); }
    else if (k === 'tb.uname') { t.d.name = v; this.ph.render(); }
    else if (k === 'tb.title') { t.u.title = v; const c = root.querySelector('[data-tcnt]'); if (c) c.textContent = `${v.length} / 100`; }
    else if (k === 'tb.desc') { t.u.desc = v; const c = root.querySelector('[data-dcnt]'); if (c) c.textContent = `${v.length} / 5000`; }
    else if (k === 'tb.thText') { t.u.thumb.text = v; const x = root.querySelector('.up-sum .th-text'); if (x && v) x.textContent = v; else this.ph.render(); }
  }
  syncCreate() { const d = this.top.d, err = d.handle ? nickErr(d.handle) : '', root = this.ph.root; root.querySelector('[data-err]').textContent = err; root.querySelector('[data-act="tb.createCh"]').disabled = !(d.name.trim() && d.handle && !err); }
  select(k, v) { const u = this.top.u; if (!u) return; if (k === 'topic') u.topic = v; else if (k === 'sched') u.sched = v; this.ph.render(); }
  // нові файли з телефону
  imported(ctx, items) {
    const t = this.top, g = items[0]; if (!g) return;
    if (ctx === 'tube' && t.v === 'upload') { const vid = items.find(x => x.type === 'video'); if (vid) { this.act('pick', { dataset: { id: vid.id } }); } }
    else if (ctx === 'thumb' && t.v === 'upload') { t.u.thumb = { ...t.u.thumb, kind: 'photo', gid: g.id }; this.ph.render(); }
    else if (ctx === 'banner' && t.v === 'custom') { t.d.bImg = g.mid; this.ph.render(); }
    else if (ctx === 'tavatar' && t.v === 'custom') { t.d.img = g.mid; this.ph.render(); }
  }
}

// Стовпчики переглядів за днями
function bars(daily) {
  const d = daily.length ? daily.slice(0, 14) : [0], max = Math.max(1, ...d), w = 300, h = 110, bw = w / Math.max(7, d.length);
  return `<svg class="chart" viewBox="0 0 ${w} ${h + 18}" role="img" aria-label="Перегляди за днями">${d.map((x, i) => { const bh = Math.max(2, x / max * h); return `<rect x="${i * bw + 3}" y="${h - bh}" width="${bw - 6}" height="${bh}" rx="3" fill="#e62117" opacity="${0.55 + 0.45 * (x / max)}"/><text x="${i * bw + bw / 2}" y="${h + 14}" text-anchor="middle" font-size="10" fill="#5f6368">Д${i + 1}</text>`; }).join('')}</svg><p class="muted sm">Найбільше переглядів: ${num(max)} за день</p>`;
}
// Крива утримання
function retention(pts, dur) {
  const w = 300, h = 120, xy = pts.map((p, i) => [i / (pts.length - 1) * w, h - p / 100 * h]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="-36 -6 ${w + 44} ${h + 26}" role="img" aria-label="Крива утримання глядачів">${[0, 50, 100].map(p => `<path d="M0 ${h - p / 100 * h}H${w}" stroke="#e6e6e9"/><text x="-6" y="${h - p / 100 * h + 4}" text-anchor="end" font-size="10" fill="#5f6368">${p}%</text>`).join('')}
    <path d="${line} L${w} ${h} L0 ${h}Z" fill="#e62117" opacity=".12"/><path d="${line}" stroke="#e62117" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
    <text x="0" y="${h + 16}" font-size="10" fill="#5f6368">0:00</text><text x="${w}" y="${h + 16}" text-anchor="end" font-size="10" fill="#5f6368">${fmtDur(dur)}</text></svg>`;
}
