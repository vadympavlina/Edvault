// Симулятор блогера · месенджер «Лелека»: чати, контакти, налаштування й власний канал —
// створення (назва, фото, тип, посилання), дописи з фото й опитуваннями, реакції, коментарі, статистика.
import { icon } from './icons.js';
import { photo, avatar } from './art.js';
import { esc, sheet, actions, confirm, toast, sw } from './ui.js';
import { NICHES, nicheOf, AV_COLORS, AV_SYMBOLS } from './data.js';
import { num, plural, clock, dayOf, hourOf, DAY, ACTIVITY, WEEKDAYS } from './sim.js';
import { fileBtn } from './gal.js';
import { voice } from './talk.js';
import { TG_HOST, REACTS, linkErr, tgSend, tgRead, tgOpt, tgBlock, tgCreateChannel, tgEditChannel, tgDeleteChannel, tgPost, tgEditPost, tgDeletePost, tgPin, tgVote, tgInvite, tgStats, tgEndSession, postCheck, realSubs, tgOnline, tgAdPost, adCheck, tgMarkAd, chLinkIn } from './tgsim.js';

export const tgLogo = (s = 28) => `<svg class="logo" width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true"><rect x="2" y="2" width="44" height="44" rx="13" fill="#0e7c6b"/><path d="M12 33.5V16a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v11a4 4 0 0 1-4 4H18.5z" fill="#fff"/><path d="M17.5 24.5c3-4.5 7.5-6 13-5.5-2.5 1.2-4.2 3-5 5.5-2.6-.9-5.2-.9-8 0z" fill="#0e7c6b"/><circle cx="29" cy="17.6" r="1.1" fill="#0e7c6b"/></svg>`;
const SIDE = ['Настя', 'Тарас', 'Віка', 'Денис', 'Злата', 'Петро'];
const NAME_C = { Настя: '#ad1457', Тарас: '#283593', Віка: '#6a1b9a', Денис: '#00695c', Злата: '#b23c17', Петро: '#455a64' };
const SRC = [['invite', 'Посилання-запрошення'], ['search', 'Пошук у Лелеці'], ['fwd', 'Пересилання дописів'], ['promo', 'Взаємопіар'], ['add', 'Додані вами'], ['likeer', 'З профілю в Лайкері'], ['tube', 'З опису каналу у Хвилі'], ['bots', 'Куплені боти']];
const wd = t => WEEKDAYS[((dayOf(t) % 7) + 7) % 7];
const dayLabel = (now, t) => { const d = dayOf(now) - dayOf(t); return d <= 0 ? 'Сьогодні' : d === 1 ? 'Учора' : d < 7 ? wd(t) : `${d} ${plural(d, 'день', 'дні', 'днів')} тому`; };
const listTime = (now, t) => { const d = dayOf(now) - dayOf(t); return d <= 0 ? clock(t) : d === 1 ? 'Учора' : d < 7 ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'][((dayOf(t) % 7) + 7) % 7] : `${d} дн.`; };
// посилання з назви: «Мурчик і пригоди» → murchyk_i_pryhody
const TR = { а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia', '’': '', "'": '' };
export const translit = t => [...t.toLocaleLowerCase('uk')].map(c => TR[c] ?? c).join('').replace(/[^a-z0-9]+/g, '_').replace(/^[_\d]+|_+$/g, '').slice(0, 32).replace(/_+$/, '');
const short = (t, n = 46) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

export class Tg {
  constructor(phone) { this.ph = phone; this.sim = phone.sim; this.stack = [{ v: 'chats' }]; }
  get s() { return this.sim.s; }
  get tg() { return this.sim.s.tg; }
  get ch() { return this.sim.s.tg.ch; }
  get top() { if (!this.stack.length) this.stack.push({ v: 'chats' }); return this.stack[this.stack.length - 1]; }
  go(v, a = {}) { this.stack.push({ v, ...a }); this.ph.render(true); }
  tab(v) { this.stack = [{ v }]; this.ph.render(true); }
  back() { if (this.stack.length > 1) this.stack.pop(); else this.ph.home(); this.ph.render(true); }
  get live() { return ['chats', 'chat', 'info', 'stats', 'post', 'subs', 'contacts', 'settings', 'sessions'].includes(this.top.v); }
  chat(id) { return this.tg.chats.find(c => c.id === id); }
  meAv(size) { const m = this.s.me; return avatar(m ? { name: m.name || m.nick, ...m.avatar } : { name: 'Я', color: '#0e7c6b' }, size); }
  chAv(size, c = this.ch) { return avatar({ name: c.title, ...c.avatar }, size); }
  av(c, size) {
    if (c.kind === 'mine') return this.ch ? this.chAv(size) : avatar({ name: c.title, color: '#0e7c6b' }, size);
    if (c.kind === 'saved') return `<span class="av tg-saved" style="width:${size}px;height:${size}px">${icon('bookmark', Math.round(size * 0.46))}</span>`;
    if (c.kind === 'service') return `<span class="av" style="width:${size}px;height:${size}px">${tgLogo(size)}</span>`;
    return avatar({ name: c.title, color: c.color, sym: c.sym }, size);
  }

  render() {
    const t = this.top, fn = this['v_' + t.v] || this.v_chats, tabs = ['chats', 'contacts', 'settings'].includes(t.v);
    if (['channel', 'info', 'stats', 'edit', 'subs', 'admins', 'post'].includes(t.v) && !this.ch) this.stack = [{ v: 'chats' }];
    return `<div class="tg-app${tabs ? ' with-tabs' : ''}">${fn.call(this, this.top)}${tabs ? this.tabs(t.v) : ''}</div>`;
  }
  tabs(v) {
    const n = this.tg.chats.reduce((a, c) => a + (c.muted || c.blocked ? 0 : c.unread || 0), 0);
    const t = (k, ic, label, badge = 0) => `<button class="tg-tb${v === k ? ' on' : ''}" data-act="tg.tab" data-v="${k}"${v === k ? ' aria-current="page"' : ''}>${icon(ic, 24, v === k)}${badge ? `<i class="dot">${badge > 99 ? '99+' : badge}</i>` : ''}<small>${label}</small></button>`;
    return `<nav class="tabbar tg-tabs">${t('contacts', 'user', 'Контакти')}${t('chats', 'comment', 'Чати', n)}${t('settings', 'gear', 'Налаштування')}</nav>`;
  }
  head(title, sub = '', right = '', av = '') { return `<header class="ah tg-h"><button class="ib" data-act="tg.back" aria-label="Назад">${icon('back', 24)}</button>${av}<div class="tg-ht"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div><span class="grow"></span>${right}</header>`; }

  /* ═════════ Чати ═════════ */
  v_chats(a) {
    const q = (a.q || '').trim().toLocaleLowerCase('uk'), s = this.s;
    const list = this.tg.chats.filter(c => !q || c.title.toLocaleLowerCase('uk').includes(q)).sort((x, y) => (y.pin ? 1 : 0) - (x.pin ? 1 : 0));
    const row = c => {
      const last = [...c.msgs].reverse().find(m => m.from !== 'sys') || c.msgs.at(-1), mine = c.kind === 'mine' ? this.ch?.posts.filter(p => p.t).at(-1) : null;
      const typing = c.pending?.length && tgOnline(s, c) && c.kind !== 'mine';
      const who = last?.from === 'me' ? 'Ви: ' : c.kind === 'group' && last && last.from !== 'sys' ? `${esc(last.from)}: ` : '';
      const text = typing ? '<i class="typing-t">друкує…</i>' : mine ? esc(short(mine.text || (mine.poll ? 'Опитування: ' + mine.poll.q : 'Фото'))) : last ? `${who}${esc(short(last.text))}` : '';
      const t = mine?.t || last?.t || s.t;
      return `<button class="tg-row" data-act="tg.open" data-id="${c.id}">${this.av(c, 52)}<div class="tg-rb"><div class="tg-r1"><b>${c.kind === 'mine' || c.kind === 'feed' ? icon('megaphone', 14) : ''}${esc(c.title)}${c.verified ? `<span class="ver">${icon('check', 10)}</span>` : ''}${c.muted ? icon('mute', 14) : ''}</b><time>${listTime(s.t, t)}</time></div>
        <div class="tg-r2"><span>${c.blocked ? 'Заблоковано' : text}</span>${c.unread && !c.blocked ? `<i class="tg-badge${c.muted ? ' mute' : ''}">${c.unread}</i>` : c.pin ? icon('pin', 15) : ''}</div></div></button>`;
    };
    return `<header class="ah main tg-main"><button class="tg-hav" data-act="tg.tab" data-v="settings" aria-label="Налаштування">${this.meAv(30)}</button><b class="ah-t tg-title">Чати</b><span class="grow"></span><button class="ib" data-act="tg.compose" aria-label="Створити">${icon('edit', 22)}</button></header>
      <div class="tg-search">${icon('search', 17)}<input class="in" data-in="tg.q" data-keep="tg.q" value="${esc(a.q || '')}" placeholder="Пошук" aria-label="Пошук чатів"></div>
      <div class="scroll" data-scroll="tgchats">${this.ch ? '' : `<button class="tg-promo" data-act="tg.newCh"><span class="tg-pi">${icon('megaphone', 22)}</span><span><b>Створіть свій канал</b><small>Діліться новинами й думками з читачами — так ведуть блоги в месенджерах</small></span>${icon('chevron', 18)}</button>`}
      ${list.map(row).join('') || `<div class="empty">${icon('search', 36)}<b>Нічого не знайдено</b></div>`}</div>`;
  }
  v_contacts() {
    const s = this.s, list = this.tg.chats.filter(c => c.kind === 'user' && ['mom', 'dad', 'olia', 'marko', 'babusia'].includes(c.id));
    return `<header class="ah main"><b class="ah-t tg-title">Контакти</b></header><div class="scroll">${list.map(c => `<button class="tg-row slim" data-act="tg.open" data-id="${c.id}">${avatar({ name: c.title, color: c.color }, 44)}<div class="tg-rb"><b>${esc(c.title)}</b><small class="${tgOnline(s, c) ? 'on' : ''}">${tgOnline(s, c) ? 'в мережі' : voice('був(-ла) нещодавно', c.fem)}</small></div></button>`).join('')}
      <p class="hint" style="margin:12px 16px">${icon('lock', 16)}<span>У контактах лише ті, кого ви знаєте особисто. Незнайомцям краще не давати свій номер.</span></p></div>`;
  }

  /* ═════════ Розмова ═════════ */
  v_chat(a) {
    const c = this.chat(a.id); if (!c) return this.v_gone();
    if (c.kind === 'mine') return this.v_channel(a);
    tgRead(this.sim, c.id);
    const s = this.s, on = tgOnline(s, c), typing = c.pending?.length && on && !c.blocked;
    const sub = c.kind === 'group' ? `${c.members} учасників` : c.kind === 'service' ? 'службові сповіщення' : c.kind === 'saved' ? 'ваші нотатки' : c.kind === 'feed' ? `${num(c.subs)} підписників` : c.blocked ? 'заблоковано' : typing ? '<i class="typing-t">друкує…</i>' : on ? 'в мережі' : voice('був(-ла) нещодавно', c.fem);
    let lastDay = -1;
    const body = c.msgs.map(m => {
      const d = dayOf(m.t), sep = d !== lastDay ? `<p class="tg-day"><span>${dayLabel(s.t, m.t)}</span></p>` : ''; lastDay = d;
      if (m.from === 'sys') return `${sep}<p class="tg-sys"><span>${icon('shield', 13)}${esc(m.text)}</span></p>`;
      if (c.kind === 'feed') return sep + this.feedPost(c, m);
      const me = m.from === 'me', name = c.kind === 'group' && !me ? `<b class="tg-who" style="color:${NAME_C[m.from] || '#0e7c6b'}">${esc(m.from)}</b>` : '';
      const link = m.card ? `<span class="tg-card">${tgLogo(30)}<span><b>${esc(this.ch?.title || 'Канал')}</b><small>Канал у Лелеці · ${esc(TG_HOST + (this.ch?.pub ? this.ch.link : this.ch?.invite || ''))}</small></span></span>` : '';
      return `${sep}<div class="tg-m${me ? ' me' : ''}">${c.kind === 'group' && !me ? avatar({ name: m.from, color: NAME_C[m.from] || '#455a64' }, 30) : ''}<p>${name}${esc(m.text)}${link}<span class="tg-mt">${clock(m.t)}${me && c.kind !== 'saved' ? `<span class="tg-tick${m.seen ? ' seen' : ''}">${icon('check', 13)}${m.seen ? icon('check', 13) : ''}</span>` : ''}</span></p></div>`;
    }).join('');
    const opts = !c.blocked && c.opts && !c.pending?.length ? `<div class="chips tg-opts">${c.opts.map(([k, t]) => `<button class="chip-btn" data-act="tg.opt" data-k="${k}">${esc(t)}</button>`).join('')}</div>` : '';
    const foot = c.blocked ? `<footer class="tg-foot"><p class="muted center sm">Ви заблокували цей чат</p></footer>`
      : c.kind === 'service' ? `<footer class="tg-foot"><p class="muted center sm">${icon('lock', 14)}Відповідати в службовому чаті не можна</p></footer>`
      : c.kind === 'feed' ? `<footer class="tg-foot"><button class="btn tg-mute" data-act="tg.mute" data-id="${c.id}">${icon(c.muted ? 'sound' : 'mute', 18)}${c.muted ? 'Увімкнути звук' : 'Вимкнути звук'}</button></footer>`
      : `<footer class="tg-cmp">${opts}<div class="tg-cr"><input class="in" data-keep="tgm-${c.id}" placeholder="Повідомлення" maxlength="1000" aria-label="Повідомлення"><button class="tg-send" data-act="tg.send" data-id="${c.id}" aria-label="Надіслати">${icon('send', 20)}</button></div></footer>`;
    const more = c.kind === 'user' && !['mom', 'dad', 'babusia', 'olia', 'marko'].includes(c.id) && !c.blocked ? `<button class="ib" data-act="tg.chatMenu" data-id="${c.id}" aria-label="Дії">${icon('more', 22)}</button>` : '';
    const title = `${esc(c.title)}${c.verified ? `<span class="ver">${icon('check', 10)}</span>` : ''}`;
    const warn = c.id === 'phish' && !c.blocked ? `<div class="tg-warn">${icon('alert', 16)}<span>Цей акаунт не має позначки офіційного й не з ваших контактів. Будьте обережні.</span><button class="btn sm danger" data-act="tg.block" data-id="${c.id}">Заблокувати</button></div>` : '';
    return `${this.head(title, sub, more, `<span class="av-on${on && c.kind === 'user' && !c.blocked ? ' on' : ''}">${this.av(c, 38)}</span>`)}${warn}
      <div class="scroll tg-bg" data-scroll="tgc-${c.id}" data-bottom="1"><div class="tg-msgs">${body}${typing ? '<div class="tg-m"><p class="tg-typing" aria-label="Друкує"><i></i><i></i><i></i></p></div>' : ''}</div></div>${foot}`;
  }
  feedPost(c, m) {
    const poll = m.poll ? `<div class="tg-poll"><b>${esc(m.poll.q)}</b><small>Анонімне опитування</small>${this.pollRows(m.poll.opts, -1)}</div>` : '';
    const react = m.react ? `<div class="tg-reacts">${REACTS.filter(([k]) => m.react[k]).map(([k, col]) => `<span class="tg-rc" style="--rc:${col}">${icon(k, 14, true)}${num(m.react[k])}</span>`).join('')}</div>` : '';
    return `<div class="tg-post"><div class="tg-pb"><b class="tg-who" style="color:${c.color}">${esc(c.title)}</b>${m.text && !m.poll ? `<p>${esc(m.text)}</p>` : ''}${poll}<span class="tg-mt">${icon('eye', 13)}${num(m.views || 0)} · ${clock(m.t)}</span></div>${react}</div>`;
  }
  pollRows(opts, my) {
    const tot = Math.max(1, opts.reduce((a, o) => a + o[1], 0));
    return opts.map(([t, n], i) => { const p = Math.round(n / tot * 100); return `<div class="tg-pr${i === my ? ' my' : ''}"><span class="tg-pp">${p}%</span><span class="tg-pt">${esc(t)}${i === my ? icon('check', 14) : ''}<i style="width:${p}%"></i></span></div>`; }).join('') + `<small class="tg-pv">${num(tot)} ${plural(tot, 'голос', 'голоси', 'голосів')}</small>`;
  }
  v_gone() { return `${this.head('')}<div class="empty">${icon('comment', 40)}<b>Чат недоступний</b></div>`; }

  /* ═════════ Створення каналу ═════════ */
  v_new(a) {
    const d = a.d ||= { step: 1, title: '', desc: '', color: '#0e7c6b', sym: 'letter', img: '', topic: this.s.me?.niche || 'pets', pub: true, link: (this.s.me?.nick || '').replace(/\./g, '_'), add: [] };
    const steps = `<div class="ad-steps" aria-hidden="true">${[1, 2, 3].map(i => `<i class="${i <= d.step ? 'on' : ''}"></i>`).join('')}</div>`;
    if (d.step === 1) {
      const own = this.s.gallery.filter(g => g.own && g.type === 'photo').slice(0, 8);
      return `${this.head('Новий канал', 'Крок 1 з 3 · Назва й фото')}<div class="scroll pad">${steps}
        <div class="tg-newav">${avatar({ name: d.title || 'К', color: d.color, sym: d.sym, img: d.img }, 84)}</div>
        <div class="av-pick center">${own.map(g => `<button class="avp${d.img === g.mid ? ' on' : ''}" data-act="tg.nImg" data-mid="${g.mid}" aria-label="Ваше фото">${avatar({ img: g.mid }, 46)}</button>`).join('')}${fileBtn('tgavatar', 'Фото', 'avp add', 'image/*')}${d.img ? `<button class="avp" data-act="tg.nImg" data-mid="" aria-label="Без фото">${icon('close', 20)}</button>` : ''}</div>
        ${d.img ? '' : `<div class="sw-row center">${AV_COLORS.slice(0, 8).map(c => `<button class="cdot${d.color === c ? ' on' : ''}" style="background:${c}" data-act="tg.nColor" data-c="${c}" aria-label="Колір"></button>`).join('')}<button class="cdot${d.color === '#0e7c6b' ? ' on' : ''}" style="background:#0e7c6b" data-act="tg.nColor" data-c="#0e7c6b" aria-label="Колір"></button></div><div class="sw-row center">${AV_SYMBOLS.slice(0, 7).map(k => `<button class="sym${d.sym === k ? ' on' : ''}" data-act="tg.nSym" data-k="${k}" aria-label="Значок">${k === 'letter' ? `<b>${esc((d.title[0] || 'К').toUpperCase())}</b>` : icon(k, 20)}</button>`).join('')}</div>`}
        <label class="fl"><span>Назва каналу</span><input class="in" data-in="tg.nTitle" data-keep="tg.nTitle" value="${esc(d.title)}" maxlength="60" placeholder="Наприклад: «Мурчик і його пригоди»"></label>
        <label class="fl"><span>Опис (необов’язково)</span><textarea class="in" data-in="tg.nDesc" data-keep="tg.nDesc" rows="3" maxlength="255" placeholder="Про що канал і як часто виходять дописи">${esc(d.desc)}</textarea></label>
        <p class="lbl">Тема каналу</p><div class="niches sm">${Object.entries(NICHES).map(([k, n]) => `<button class="niche${d.topic === k ? ' on' : ''}" data-act="tg.nTopic" data-k="${k}">${icon(n.icon, 20)}<span>${n.t}</span></button>`).join('')}</div></div>
        <footer class="foot"><button class="btn tg-btn big" data-act="tg.nNext" ${d.title.trim() ? '' : 'disabled'}>Далі</button></footer>`;
    }
    if (d.step === 2) {
      const err = d.pub ? linkErr(d.link) : '', c = (k, on, t, sub, ic) => `<button class="tg-type${on ? ' on' : ''}" data-act="tg.nType" data-v="${k}" aria-pressed="${on}"><i class="rb"></i><span>${icon(ic, 20)}<b>${t}</b><small>${sub}</small></span></button>`;
      return `${this.head('Тип каналу', 'Крок 2 з 3 · Хто може знайти')}<div class="scroll pad">${steps}
        ${c('pub', d.pub, 'Публічний', 'Канал можна знайти в пошуку, підписатися може будь-хто', 'globe')}${c('priv', !d.pub, 'Приватний', 'Підписатися можна лише за посиланням-запрошенням', 'lock')}
        ${d.pub ? `<label class="fl"><span>Постійне посилання</span><div class="tg-link"><span>${TG_HOST}</span><input class="in" data-in="tg.nLink" data-keep="tg.nLink" value="${esc(d.link)}" maxlength="32" placeholder="murchyk_kit" autocapitalize="off" spellcheck="false"></div></label><p class="fl-err" data-err>${esc(err)}</p>
          <p class="muted sm" data-ok>${!err ? `${icon('check', 14)} Вільне. Друзі знайдуть канал за адресою ${esc(TG_HOST + d.link)}` : ''}</p>
          <p class="hint">${icon('shield', 16)}<span>Публічний канал бачать усі, навіть незнайомі люди. Не пишіть у ньому прізвище, школу, адресу й телефон.</span></p>`
        : `<div class="tg-inv"><small>Посилання-запрошення з’явиться після створення</small><b>${TG_HOST}+••••••</b></div><p class="hint">${icon('info', 16)}<span>Приватний канал зручний для близьких: родини чи друзів. Але посилання можна переслати далі — тож і тут не пишіть зайвого.</span></p>`}</div>
        <footer class="foot row2"><button class="btn big" data-act="tg.nPrev">Назад</button><button class="btn tg-btn big" data-act="tg.nNext" ${err ? 'disabled' : ''}>Далі</button></footer>`;
    }
    const list = this.tg.chats.filter(c => ['mom', 'dad', 'olia', 'marko', 'babusia'].includes(c.id));
    return `${this.head('Підписники', 'Крок 3 з 3 · Кого додати')}<div class="scroll">${steps.replace('ad-steps', 'ad-steps pad-x')}
      <p class="hint" style="margin:12px 16px">${icon('info', 16)}<span>Можна одразу додати контакти, але чемніше — надіслати посилання й дати людям вирішити самим. Тих, кого додали без запитання, це часто дратує.</span></p>
      ${list.map(c => { const on = d.add.includes(c.id); return `<button class="tg-row slim" data-act="tg.nAdd" data-id="${c.id}" aria-pressed="${on}">${avatar({ name: c.title, color: c.color }, 44)}<div class="tg-rb"><b>${esc(c.title)}</b><small>${tgOnline(this.s, c) ? 'в мережі' : voice('був(-ла) нещодавно', c.fem)}</small></div><i class="tg-chk${on ? ' on' : ''}">${on ? icon('check', 15) : ''}</i></button>`; }).join('')}</div>
      <footer class="foot row2"><button class="btn big" data-act="tg.nPrev">Назад</button><button class="btn tg-btn big" data-act="tg.nCreate">${d.add.length ? `Створити й додати ${d.add.length}` : 'Створити канал'}</button></footer>`;
  }

  /* ═════════ Мій канал ═════════ */
  v_channel(a) {
    const c = this.ch, s = this.s, chat = this.chat('mych'); if (chat) chat.unread = 0;
    const posts = c.posts.filter(p => p.t), sched = c.posts.filter(p => !p.t && p.sched), pin = c.posts.find(p => p.id === c.pinned);
    let lastDay = -1;
    const items = [...posts.map(p => ({ t: p.t, p })), ...(chat?.msgs || []).filter(m => m.from === 'sys').map(m => ({ t: m.t, m }))].sort((x, y) => x.t - y.t || (x.m ? -1 : 1) - (y.m ? -1 : 1));
    const body = items.map(({ t, p, m }) => { const d = dayOf(t), sep = d !== lastDay ? `<p class="tg-day"><span>${dayLabel(s.t, t)}</span></p>` : ''; lastDay = d; return sep + (p ? this.myPost(p) : `<p class="tg-sys"><span>${icon('info', 13)}${esc(m.text)}</span></p>`); }).join('');
    const start = !posts.length ? `<div class="tg-first"><b>Канал створено!</b><ol><li>Напишіть перший допис: розкажіть, про що канал і як часто будуть нові дописи.</li><li>Закріпіть його, щоб новенькі одразу бачили.</li><li>Запросіть друзів за посиланням.</li></ol><button class="btn sm" data-act="tg.invite">${icon('users', 15)}Запросити</button></div>` : '';
    const att = a.att || {}, g = att.gid && s.gallery.find(x => x.id === att.gid);
    const chips = `${g ? `<span class="tg-att">${photo(g, { thumb: true })}<button data-act="tg.attX" data-k="gid" aria-label="Прибрати фото">${icon('close', 14)}</button></span>` : ''}${att.poll ? `<span class="tg-att poll">${icon('poll', 16)}${esc(short(att.poll.q, 26))}<button data-act="tg.attX" data-k="poll" aria-label="Прибрати опитування">${icon('close', 14)}</button></span>` : ''}${att.sched ? `<span class="tg-att">${icon('clock', 16)}Вийде о ${clock(att.sched)}${dayOf(att.sched) !== dayOf(s.t) ? ' завтра' : ''}<button data-act="tg.attX" data-k="sched" aria-label="Скасувати відкладене">${icon('close', 14)}</button></span>` : ''}`;
    const hacked = this.tg.flags.hacked ? `<div class="tg-warn">${icon('alert', 16)}<span>У ваш акаунт увійшли шахраї й публікують спам! Завершіть чужий сеанс.</span><button class="btn sm danger" data-act="tg.go" data-v="sessions">Сеанси</button></div>` : '';
    return `${this.head(esc(c.title), `${num(c.subs)} ${plural(c.subs, 'підписник', 'підписники', 'підписників')}`, `<button class="ib" data-act="tg.go" data-v="stats" aria-label="Статистика">${icon('chart', 22)}</button>`, `<button class="tg-hav" data-act="tg.go" data-v="info" aria-label="Інформація про канал">${this.chAv(38)}</button>`)}${hacked}
      ${c.adTask ? `<div class="tg-task">${icon('megaphone', 18)}<span><b>Замовлення: ${esc(c.adTask.brand)}</b><small>${num(c.adTask.pay)} грн · до ${dayLabel(s.t, c.adTask.due).toLowerCase()}, ${clock(c.adTask.due)}</small></span><button class="btn sm tg-btn" data-act="tg.adWrite">Написати</button></div>` : ''}
      ${pin ? `<button class="tg-pin" data-act="tg.toPost" data-id="${pin.id}">${icon('pin', 16)}<span><b>Закріплений допис</b><small>${esc(short(pin.text || 'Фото', 60))}</small></span></button>` : ''}
      <div class="scroll tg-bg" data-scroll="tgch" data-bottom="1"><div class="tg-msgs">${body}${start}${sched.length ? `<p class="tg-sys"><span>${icon('clock', 13)}Відкладених дописів: ${sched.length} · найближчий о ${clock(Math.min(...sched.map(p => p.sched)))}</span></p>` : ''}</div></div>
      <footer class="tg-cmp">${chips ? `<div class="tg-atts">${chips}</div>` : ''}<p class="tg-tip" data-tgtip>${this.tipHtml(a)}</p>
        <div class="tg-cr"><button class="ib" data-act="tg.attach" aria-label="Додати фото, опитування або відкласти">${icon('plusSq', 22)}</button><textarea class="in" rows="1" data-in="tg.post" data-keep="tg.post" placeholder="Допис для каналу" maxlength="4000" aria-label="Текст допису">${esc(a.text || '')}</textarea>
        <button class="ib${a.silent ? ' on' : ''}" data-act="tg.silent" aria-pressed="${!!a.silent}" aria-label="${a.silent ? 'Без звуку: увімкнено' : 'Без звуку'}" title="Надіслати без звуку">${icon(a.silent ? 'mute' : 'bell', 20)}</button><button class="tg-send" data-act="tg.publish" aria-label="${att.sched ? 'Запланувати' : 'Опублікувати'}">${icon(att.sched ? 'clock' : 'send', 20)}</button></div></footer>`;
  }
  tipHtml(a) {
    const h = hourOf(this.s.t), att = a.att || {}, txt = a.text || '';
    const chk = txt || att.gid || att.poll ? postCheck({ text: txt, gid: att.gid, poll: att.poll }) : [];
    const bad = chk.find(x => x[0] === 'bad') || chk.find(x => x[0] === 'warn');
    if (bad) return `<span class="${bad[0]}">${icon('alert', 14)}${esc(bad[1])}: ${esc(bad[2])}</span>`;
    if ((h >= 22 || h < 7) && !a.silent && !att.sched) return `<span class="warn">${icon('moon', 14)}Зараз ніч: увімкніть «без звуку», щоб не будити читачів</span>`;
    return '';
  }
  myPost(p) {
    const c = this.ch, s = this.s, g = p.gid && s.gallery.find(x => x.id === p.gid);
    if (p.hidden) return `<div class="tg-post hid"><div class="tg-pb"><p>${icon('eyeOff', 15)}Допис приховано за порушення правил Лелеки</p></div></div>`;
    const by = p.by === 'evil' ? 'Невідомий адміністратор' : p.by === 'marko' ? 'Марко' : c.set.sign ? (s.me?.name || 'Автор') : '';
    const poll = p.poll ? `<div class="tg-poll"><b>${esc(p.poll.q)}</b><small>Анонімне опитування</small>${p.poll.my === null ? p.poll.opts.map(([t], i) => `<button class="tg-po" data-act="tg.vote" data-id="${p.id}" data-i="${i}">${esc(t)}</button>`).join('') : this.pollRows(p.poll.opts, p.poll.my)}</div>` : '';
    const rc = c.set.reacts ? REACTS.filter(([k]) => p.react[k]).map(([k, col]) => `<span class="tg-rc" style="--rc:${col}">${icon(k, 14, true)}${num(p.react[k])}</span>`).join('') : '';
    return `<div class="tg-post${p.spam ? ' spam' : ''}${p.ad ? ' ad' : ''}" id="p-${p.id}">${g ? `<div class="tg-ph">${photo(g)}</div>` : ''}<div class="tg-pb">${p.ad && (p.adMark || !p.task) ? `<i class="tg-adl">Реклама${p.brand ? ' · ' + esc(p.brand) : ''}</i>` : ''}${p.task && !p.adMark ? `<i class="tg-adl warn">${icon('alert', 12)}Реклама без позначки — бачите лише ви</i>` : ''}${p.text ? `<p>${esc(p.text)}</p>` : ''}${poll}
      <span class="tg-mt">${p.edited ? 'змінено · ' : ''}${by ? `${esc(by)} · ` : ''}${p.silent ? icon('mute', 12) : ''}${icon('eye', 13)}${num(p.stats.views)} · ${clock(p.t)}</span></div>
      ${rc ? `<div class="tg-reacts">${rc}</div>` : ''}
      <div class="tg-pa">${c.set.comments ? `<button class="tg-cm" data-act="tg.go" data-v="post" data-id="${p.id}">${icon('comment', 16)}${p.comments.length ? `${p.comments.length} ${plural(p.comments.length, 'коментар', 'коментарі', 'коментарів')}` : 'Коментувати'}</button>` : '<span></span>'}<span class="tg-fw" title="Пересилань">${icon('repost', 15)}${num(p.stats.fwd)}</span><button class="ib sm" data-act="tg.postMenu" data-id="${p.id}" aria-label="Дії з дописом">${icon('more', 18)}</button></div></div>`;
  }
  v_post(a) {
    const p = this.ch.posts.find(x => x.id === a.id); if (!p) return this.v_gone();
    return `${this.head('Коментарі', `${p.comments.length} ${plural(p.comments.length, 'коментар', 'коментарі', 'коментарів')}`)}<div class="scroll tg-bg" data-scroll="tgpost" data-bottom="1"><div class="tg-msgs">${this.myPost(p).replace(/<div class="tg-pa">[\s\S]*<\/div><\/div>$/, '</div>')}
      ${p.comments.map(m => m.mine ? `<div class="tg-m me"><p>${esc(m.text)}<span class="tg-mt">${clock(m.t)}</span></p></div>` : `<div class="tg-m">${avatar({ name: m.name, color: m.color }, 30)}<p><b class="tg-who" style="color:${m.color}">${esc(m.name)}</b>${esc(m.text)}<span class="tg-mt">${clock(m.t)}</span></p><button class="ib sm" data-act="tg.cmDel" data-id="${p.id}" data-c="${m.id}" aria-label="Видалити коментар">${icon('trash', 16)}</button></div>`).join('') || '<p class="tg-sys"><span>Коментарів ще немає</span></p>'}</div></div>
      <footer class="tg-cmp"><div class="tg-cr"><input class="in" data-keep="tgcm" placeholder="Відповісти від імені каналу" maxlength="500" aria-label="Коментар"><button class="tg-send" data-act="tg.cmSend" data-id="${p.id}" aria-label="Надіслати">${icon('send', 20)}</button></div></footer>`;
  }

  /* ═════════ Інформація про канал ═════════ */
  v_info() {
    const s = this.s, c = this.ch, link = TG_HOST + (c.pub ? c.link : c.invite), opt = (ic, t, sub, act, extra = '') => `<button class="opt link" data-act="${act}"${extra}><span class="opt-ic">${icon(ic, 20)}</span><div><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</div>${icon('chevron', 18)}</button>`;
    const row = (k, t, sub, on) => `<div class="opt"><div><b>${t}</b><small>${sub}</small></div>${sw('tg.' + k, on, t)}</div>`;
    return `${this.head('Інформація', '', `<button class="lnk strong" data-act="tg.go" data-v="edit">Змінити</button>`)}<div class="scroll"><div class="tg-ihead">${this.chAv(96)}<h2>${esc(c.title)}</h2><p class="muted">${c.pub ? 'публічний' : 'приватний'} канал · ${num(c.subs)} ${plural(c.subs, 'підписник', 'підписники', 'підписників')}</p>
      <div class="tg-ibtns"><button data-act="tg.invite">${icon('users', 22)}<small>Запросити</small></button><button data-act="tg.go" data-v="stats">${icon('chart', 22)}<small>Статистика</small></button><button data-act="tg.copy">${icon('link', 22)}<small>Посилання</small></button></div></div>
      <div class="pad">${c.desc ? `<div class="tg-ibox"><small>опис</small><p>${esc(c.desc)}</p></div>` : ''}<div class="tg-ibox"><small>${c.pub ? 'посилання' : 'посилання-запрошення'}</small><p class="tg-lnk">${esc(link)}</p></div>
      ${opt('link', 'Посилання в Лайкері', s.me ? (chLinkIn(c, s.me.link) ? 'Є в профілі · приводить читачів' : 'Додайте в профіль — підписники Лайкера знайдуть канал') : 'Спершу створіть профіль у Лайкері', 'tg.shareLk')}
      ${opt('users', 'Підписники', `${num(c.subs)}${c.bots ? ` · з них ${num(c.bots)} ботів` : ''}`, 'tg.go', ' data-v="subs"')}${opt('shield', 'Адміністратори', `${1 + (c.admins?.length || 0)}`, 'tg.go', ' data-v="admins"')}
      <h3 class="sec">Налаштування</h3>${row('reacts', 'Реакції', 'Читачі можуть ставити реакції на дописи', c.set.reacts)}${row('comments', 'Коментарі', 'Обговорення під кожним дописом', c.set.comments)}${row('sign', 'Підпис автора', 'Під дописом видно, хто з адміністраторів його написав', c.set.sign)}
      <button class="btn danger big" data-act="tg.delCh" style="margin-top:18px">${icon('trash', 18)}Видалити канал</button></div></div>`;
  }
  v_edit(a) {
    const c = this.ch, d = a.d ||= { title: c.title, desc: c.desc, pub: c.pub, link: c.link || '', color: c.avatar.color, sym: c.avatar.sym, img: c.avatar.img };
    const err = d.pub ? linkErr(d.link, c.link) : '', own = this.s.gallery.filter(g => g.own && g.type === 'photo').slice(0, 8);
    return `${this.head('Змінити канал', '', `<button class="lnk strong" data-act="tg.saveEdit" ${d.title.trim() && !err ? '' : 'disabled'}>Готово</button>`)}<div class="scroll pad">
      <div class="tg-newav">${avatar({ name: d.title, color: d.color, sym: d.sym, img: d.img }, 84)}</div>
      <div class="av-pick center">${own.map(g => `<button class="avp${d.img === g.mid ? ' on' : ''}" data-act="tg.nImg" data-mid="${g.mid}" aria-label="Ваше фото">${avatar({ img: g.mid }, 46)}</button>`).join('')}${fileBtn('tgavatar', 'Фото', 'avp add', 'image/*')}${d.img ? `<button class="avp" data-act="tg.nImg" data-mid="" aria-label="Без фото">${icon('close', 20)}</button>` : ''}</div>
      <label class="fl"><span>Назва</span><input class="in" data-in="tg.eTitle" data-keep="tg.eTitle" value="${esc(d.title)}" maxlength="60"></label>
      <label class="fl"><span>Опис</span><textarea class="in" data-in="tg.eDesc" data-keep="tg.eDesc" rows="3" maxlength="255">${esc(d.desc)}</textarea></label>
      <div class="seg">${[[true, 'Публічний'], [false, 'Приватний']].map(([v, t]) => `<button class="${d.pub === v ? 'on' : ''}" data-act="tg.eType" data-v="${v}">${t}</button>`).join('')}</div>
      ${d.pub ? `<label class="fl"><span>Посилання</span><div class="tg-link"><span>${TG_HOST}</span><input class="in" data-in="tg.eLink" data-keep="tg.eLink" value="${esc(d.link)}" maxlength="32" autocapitalize="off" spellcheck="false"></div></label><p class="fl-err" data-err>${esc(err)}</p>` : `<p class="hint">${icon('lock', 16)}<span>Нові читачі зможуть підписатися лише за посиланням-запрошенням.</span></p>`}</div>`;
  }
  v_subs() {
    const c = this.ch, mem = c.members.map(id => this.chat(id)).filter(Boolean), rest = Math.max(0, realSubs(c) - mem.length);
    return `${this.head('Підписники', `${num(c.subs)}`)}<div class="scroll">
      ${mem.map(x => `<div class="tg-row slim">${avatar({ name: x.title, color: x.color }, 44)}<div class="tg-rb"><b>${esc(x.title)}</b><small>з ваших контактів</small></div></div>`).join('')}
      ${rest ? `<div class="tg-row slim"><span class="av tg-saved" style="width:44px;height:44px">${icon('users', 20)}</span><div class="tg-rb"><b>Ще ${num(rest)} ${plural(rest, 'читач', 'читачі', 'читачів')}</b><small>Справжні люди, які знайшли канал</small></div></div>` : ''}
      ${c.bots ? `${Array.from({ length: 4 }, (_, i) => `<div class="tg-row slim bot"><span class="av" style="width:44px;height:44px;background:#9aa0a6">${icon('user', 20)}</span><div class="tg-rb"><b>Видалений акаунт</b><small>давно не в мережі · не читає дописи</small></div></div>`).join('')}<p class="hint" style="margin:12px 16px">${icon('alert', 16)}<span>${num(c.bots)} куплених «підписників» — порожні акаунти. Вони не читають дописи, тож перегляди не ростуть, а Лелека їх видалить.</span></p>` : ''}
      ${!c.subs ? `<div class="empty">${icon('users', 40)}<b>Підписників ще немає</b><p>Надішліть посилання друзям — так з’являться перші читачі.</p><button class="btn tg-btn" data-act="tg.invite">Запросити</button></div>` : ''}</div>`;
  }
  v_admins() {
    const c = this.ch;
    return `${this.head('Адміністратори')}<div class="scroll"><div class="tg-row slim">${this.meAv(44)}<div class="tg-rb"><b>${esc(this.s.me?.name || 'Ви')}</b><small>власник · усі права</small></div></div>
      ${(c.admins || []).map(id => `<div class="tg-row slim">${avatar({ name: 'Марко', color: '#2e7d32' }, 44)}<div class="tg-rb"><b>Марко</b><small>адміністратор · може публікувати й видаляти</small></div><button class="btn sm danger" data-act="tg.unadmin" data-id="${id}">Забрати права</button></div>`).join('')}
      <p class="hint" style="margin:12px 16px">${icon('shield', 16)}<span>Адміністратор може публікувати від імені каналу. Давайте права лише тим, кому довіряєте, і лише ті, що справді потрібні. За все в каналі відповідає власник.</span></p></div>`;
  }

  /* ═════════ Статистика ═════════ */
  v_stats() {
    const st = tgStats(this.sim), c = this.ch, tile = (ic, v, k, sub = '') => `<div class="tile">${icon(ic, 18)}<b>${v}</b><small>${k}</small>${sub ? `<small class="muted">${sub}</small>` : ''}</div>`;
    const days = st.days.length ? st.days : [{ day: dayOf(this.s.t), subs: c.subs, joined: 0, left: 0 }], max = Math.max(1, ...days.map(d => d.subs + d.joined - d.left)), w = 300, h = 100, bw = w / Math.max(7, days.length);
    const chart = `<svg class="chart" viewBox="0 0 ${w} ${h + 18}" role="img" aria-label="Підписники за днями">${days.map((d, i) => { const v = Math.max(0, d.subs + d.joined - d.left), bh = Math.max(2, v / max * h); return `<rect x="${i * bw + 3}" y="${h - bh}" width="${bw - 6}" height="${bh}" rx="3" fill="#0e7c6b"/><text x="${i * bw + bw / 2}" y="${h + 14}" font-size="10" text-anchor="middle" fill="#5f6368">Д${d.day + 1}</text>`; }).join('')}</svg>`;
    const srcTot = Math.max(1, SRC.reduce((a, [k]) => a + (st.src[k] || 0), 0));
    const hours = `<div class="tg-hours" aria-label="Коли читачі онлайн">${ACTIVITY.map((v, i) => `<i style="height:${Math.round(v / 20 * 100)}%"${i === st.best ? ' class="on"' : ''} title="${i}:00"></i>`).join('')}</div><div class="tg-hl"><small>0:00</small><small>12:00</small><small>23:00</small></div>`;
    return `${this.head('Статистика', esc(c.title))}<div class="scroll pad">
      <div class="tiles">${tile('users', num(st.real), 'Справжніх підписників', st.bots ? `ще ${num(st.bots)} ботів` : '')}${tile('eye', num(st.avg), 'Переглядів на допис')}${tile('chart', st.err.toFixed(0) + '%', 'ERR', 'читають від підписників')}${tile('heart', st.er.toFixed(1).replace('.', ',') + '%', 'Залученість', 'реакції й пересилання')}${tile('repost', num(st.fwd), 'Пересилань', 'за 10 дописів')}${tile('edit', num(st.posts), 'Дописів')}</div>
      ${st.bots ? `<p class="warnbox">${icon('alert', 16)}<span>Підписників багато, а переглядів мало — так виглядає накрутка. ERR різко падає, і рекламодавці це одразу помічають.</span></p>` : ''}
      <details class="faq"><summary>Що таке ERR і залученість?</summary><p>ERR — яка частка підписників у середньому бачить допис. Для живого каналу це 30–60%. Залученість — скільки з тих, хто побачив, поставили реакцію чи переслали допис. Вони ростуть від цікавих дописів, фото й опитувань.</p></details>
      <div class="tg-earn"><div><small>Зароблено на рекламі</small><b>${num(st.earned)} грн</b></div><div><small>Ціна допису зараз</small><b>≈ ${num(st.price)} грн</b></div></div>
      <p class="muted sm">Бренди платять за справжні перегляди, а не за цифру підписників. Рекламних дописів: ${st.adsN} з ${st.posts}${st.adsN && st.adsN / Math.max(1, st.posts) > 0.3 ? ' — забагато, читачі втомлюються' : ' — краще не більше одного з п’яти'}.</p>
      <h3 class="sec">Підписники за днями</h3>${chart}
      <h3 class="sec">Звідки приходять читачі</h3><div class="tg-src">${SRC.filter(([k]) => st.src[k]).map(([k, t]) => { const p = Math.round((st.src[k] || 0) / srcTot * 100); return `<div><span>${t}</span><b>${num(st.src[k])}</b><i><b style="width:${p}%;background:${k === 'bots' ? '#c62828' : '#0e7c6b'}"></b></i></div>`; }).join('') || '<p class="muted sm">Ще немає даних. Запросіть перших читачів.</p>'}</div>
      <h3 class="sec">Коли читачі онлайн</h3>${hours}<p class="hint">${icon('clock', 16)}<span>Найбільше людей у мережі близько ${st.best}:00. Ввечері дописи бачать більше читачів, а вночі краще надсилати без звуку.</span></p>
      ${st.top.length ? `<h3 class="sec">Найпопулярніші дописи</h3>${st.top.map(p => `<button class="opt link" data-act="tg.toPost" data-id="${p.id}"><div><b>${esc(short(p.text || (p.poll ? 'Опитування: ' + p.poll.q : 'Фото'), 50))}</b><small>${icon('eye', 12)} ${num(p.stats.views)} · ${icon('repost', 12)} ${num(p.stats.fwd)} · ${dayLabel(this.s.t, p.t)}</small></div></button>`).join('')}` : ''}</div>`;
  }

  /* ═════════ Налаштування ═════════ */
  v_settings() {
    const s = this.s, me = s.me, set = this.tg.set, opt = (ic, col, t, sub, act, extra = '') => `<button class="opt link tg-set" data-act="${act}"${extra}><span class="tg-si" style="background:${col}">${icon(ic, 18)}</span><div><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</div>${icon('chevron', 18)}</button>`;
    return `<header class="ah main"><b class="ah-t tg-title">Налаштування</b></header><div class="scroll"><div class="tg-ihead">${this.meAv(84)}<h2>${esc(me?.name || 'Ви')}</h2><p class="muted">+380 •• ••• •• 47 · @${esc((me?.nick || 'my_name').replace(/\./g, '_'))}</p></div>
      <div class="pad">${opt('megaphone', '#0e7c6b', this.ch ? esc(this.ch.title) : 'Створити канал', this.ch ? 'Мій канал' : 'Ведіть свій блог у Лелеці', this.ch ? 'tg.open' : 'tg.newCh', this.ch ? ' data-id="mych"' : '')}
      ${opt('lock', '#5e35b1', 'Конфіденційність', `Номер бачать: ${{ all: 'усі', contacts: 'контакти', none: 'ніхто' }[set.phone]} · хмарний пароль ${set.pass2 ? 'увімкнено' : 'вимкнено'}`, 'tg.go', ' data-v="privacy"')}
      ${opt('phone', '#e65100', 'Активні сеанси', `${set.sessions.length} ${plural(set.sessions.length, 'пристрій', 'пристрої', 'пристроїв')}${set.sessions.some(x => x.evil) ? ' · є чужий!' : ''}`, 'tg.go', ' data-v="sessions"')}
      ${opt('bookmark', '#1565c0', 'Збережене', 'Нотатки для себе', 'tg.open', ' data-id="saved"')}</div></div>`;
  }
  v_privacy() {
    const set = this.tg.set;
    return `${this.head('Конфіденційність')}<div class="scroll pad"><p class="lbl">Хто бачить мій номер телефону</p><div class="seg">${[['all', 'Усі'], ['contacts', 'Контакти'], ['none', 'Ніхто']].map(([k, t]) => `<button class="${set.phone === k ? 'on' : ''}" data-act="tg.phone" data-v="${k}">${t}</button>`).join('')}</div>
      <p class="muted sm" style="margin-top:8px">${set.phone === 'all' ? 'Зараз ваш номер може побачити будь-хто, з ким ви в одній групі чи хто напише вам. Краще вибрати «Контакти» або «Ніхто».' : 'Добре: незнайомі люди не побачать ваш номер.'}</p>
      <div class="opt" style="margin-top:12px"><div><b>Хмарний пароль</b><small>Додатковий пароль для входу на новому пристрої. Навіть якщо шахраї вивідають код із SMS, без нього не увійдуть.</small></div>${sw('tg.pass2', set.pass2, 'Хмарний пароль')}</div>
      <p class="hint">${icon('shield', 16)}<span>Код для входу приходить лише в службовий чат «Лелека» з синьою позначкою. Нікому його не надсилайте — ні друзям, ні «підтримці».</span></p></div>`;
  }
  v_sessions() {
    const set = this.tg.set;
    return `${this.head('Активні сеанси')}<div class="scroll pad">${set.sessions.map(x => `<div class="opt${x.evil ? ' danger' : ''}"><span class="opt-ic">${icon(x.now ? 'phone' : 'globe', 20)}</span><div><b>${esc(x.dev)}</b><small>${esc(x.city)}${x.now ? ' · цей пристрій' : ' · у мережі зараз'}</small></div>${x.now ? '' : `<button class="btn sm danger" data-act="tg.endSes" data-id="${x.id}">Завершити</button>`}</div>`).join('')}
      ${set.sessions.length > 1 ? `<button class="btn danger big" data-act="tg.endSes" data-id="all" style="margin-top:14px">Завершити всі інші сеанси</button>` : ''}
      <p class="hint">${icon('info', 16)}<span>Тут видно всі пристрої, де відкрито ваш акаунт. Незнайомий пристрій — привід одразу завершити сеанс і ввімкнути хмарний пароль.</span></p></div>`;
  }

  /* ═════════ дії ═════════ */
  act(name, el) {
    const s = this.s, sim = this.sim, top = this.top, ph = this.ph, c = this.ch;
    const A = {
      tab: () => this.tab(el.dataset.v),
      back: () => this.back(),
      go: () => this.go(el.dataset.v, { id: el.dataset.id }),
      open: () => { const id = el.dataset.id; if (id === 'mych' && c) this.go('chat', { id }); else this.go('chat', { id }); },
      compose: () => actions([{ t: c ? 'Мій канал' : 'Створити канал', icon: 'megaphone', on: () => (c ? this.go('chat', { id: 'mych' }) : this.go('new')) }, { t: 'Збережене', icon: 'bookmark', on: () => this.go('chat', { id: 'saved' }) }]),
      newCh: () => (c ? this.go('chat', { id: 'mych' }) : this.go('new')),
      send: () => { const inp = ph.root.querySelector(`[data-keep="tgm-${el.dataset.id}"]`), t = inp?.value.trim(); if (!t) return; inp.value = ''; tgSend(sim, el.dataset.id, t); ph.render(); },
      opt: () => { tgOpt(sim, top.id, el.dataset.k); ph.render(); },
      mute: () => { const x = this.chat(el.dataset.id); x.muted = !x.muted; ph.render(); toast(x.muted ? 'Сповіщення вимкнено' : 'Сповіщення ввімкнено'); },
      block: async () => { if (await confirm('Заблокувати й поскаржитися?', 'Заблокувати', true, 'Цей акаунт більше не зможе вам писати.')) { tgBlock(sim, el.dataset.id); ph.render(); toast('Заблоковано, скаргу надіслано'); } },
      chatMenu: () => actions([{ t: 'Заблокувати й поскаржитися', icon: 'block', danger: true, on: () => A.block() }, { t: 'Показати переписку дорослим', icon: 'users', on: () => toast('Добре рішення: дорослі допоможуть розібратися') }]),
      // створення каналу
      nNext: () => { const d = top.d; if (d.step === 1 && !d.title.trim()) return; if (d.step === 1 && !d.linkTouched) d.link = translit(d.title) || d.link; if (d.step === 2 && d.pub && linkErr(d.link)) return; d.step++; ph.render(true); },
      nPrev: () => { top.d.step--; ph.render(true); },
      nImg: () => { top.d.img = el.dataset.mid; ph.render(); },
      nColor: () => { top.d.color = el.dataset.c; ph.render(); },
      nSym: () => { top.d.sym = el.dataset.k; ph.render(); },
      nTopic: () => { top.d.topic = el.dataset.k; ph.render(); },
      nType: () => { top.d.pub = el.dataset.v === 'pub'; ph.render(); },
      nAdd: () => { const a = top.d.add, i = a.indexOf(el.dataset.id); if (i >= 0) a.splice(i, 1); else a.push(el.dataset.id); ph.render(); },
      nCreate: () => { const d = top.d; tgCreateChannel(sim, d); this.stack = [{ v: 'chats' }, { v: 'chat', id: 'mych' }]; ph.render(true); toast('Канал створено!'); },
      // дописи
      attach: () => {
        const photos = s.gallery.filter(g => g.type === 'photo').slice(0, 12), t = s.t, at = (h, plus = 0) => { const base = (Math.floor(t / DAY) + plus) * DAY + h * 60; return base > t + 10 ? base : base + DAY; };
        sheet({ title: 'Додати до допису', cls: 'tg-attach', html: `<p class="lbl">Фото</p><div class="tg-pg">${photos.map(g => `<button data-g="${g.id}" aria-label="Фото">${photo(g, { thumb: true })}</button>`).join('')}${fileBtn('tgphoto', 'З телефону', 'tg-pg-add', 'image/*')}</div>
          <div class="act-list"><button class="act" data-poll>${icon('poll', 20)}<span>Опитування</span></button><button class="act" data-sched="${at(19)}">${icon('clock', 20)}<span>Відкласти до ${hourOf(t) < 19 ? 'сьогодні' : 'завтра'}, 19:00</span></button><button class="act" data-sched="${at(8, 1)}">${icon('clock', 20)}<span>Відкласти до завтра, 08:00</span></button></div>`,
          onOpen: api => api.el.addEventListener('click', e => {
            const g = e.target.closest('[data-g]'), p = e.target.closest('[data-poll]'), sc = e.target.closest('[data-sched]');
            if (g) { (top.att ||= {}).gid = g.dataset.g; api.close(); ph.render(); }
            if (sc) { (top.att ||= {}).sched = +sc.dataset.sched; api.close(); ph.render(); }
            if (p) { api.close(); this.pollSheet(); }
          }) });
      },
      attX: () => { if (top.att) delete top.att[el.dataset.k]; ph.render(); },
      silent: () => { top.silent = !top.silent; ph.render(); toast(top.silent ? 'Допис прийде без звуку' : 'Допис прийде зі звуком'); },
      publish: async () => {
        const att = top.att || {}, text = (top.text || '').trim();
        if (!text && !att.gid && !att.poll) { toast('Напишіть текст, додайте фото або опитування'); return; }
        const bad = postCheck({ text, gid: att.gid, poll: att.poll }).find(x => x[0] === 'bad');
        if (bad && !(await confirm('Опублікувати попри це?', 'Опублікувати', true, bad[2]))) return;
        if (bad) s.trust = Math.max(0, s.trust - 2);
        tgPost(sim, { text, gid: att.gid, poll: att.poll, silent: top.silent, sched: att.sched });
        top.text = ''; top.att = {}; const ta = ph.root.querySelector('[data-keep="tg.post"]'); if (ta) ta.value = '';
        ph.render(); toast(att.sched ? `Допис вийде о ${clock(att.sched)}` : 'Опубліковано');
      },
      vote: () => { tgVote(sim, el.dataset.id, +el.dataset.i); ph.render(); },
      postMenu: () => {
        const p = c.posts.find(x => x.id === el.dataset.id); if (!p) return;
        actions([{ t: c.pinned === p.id ? 'Відкріпити' : 'Закріпити', icon: 'pin', on: () => { tgPin(sim, p.id); ph.render(); toast(c.pinned ? 'Допис закріплено' : 'Відкріплено'); } },
          p.text && !p.ad && p.by === 'me' ? { t: 'Редагувати', icon: 'edit', on: () => this.editSheet(p) } : null,
          p.task && !p.adMark ? { t: 'Позначити як рекламу', icon: 'megaphone', on: () => { tgMarkAd(sim, p.id); ph.render(); toast('Допис позначено як рекламу'); } } : null,
          { t: 'Статистика допису', icon: 'chart', on: () => this.postStats(p) },
          { t: 'Видалити', icon: 'trash', danger: true, on: async () => { if (await confirm('Видалити допис?', 'Видалити', true, 'Він зникне в усіх підписників.')) { tgDeletePost(sim, p.id); ph.render(); } } }]);
      },
      toPost: () => { this.stack = this.stack.filter(x => x.v !== 'stats'); if (this.top.v !== 'chat') this.go('chat', { id: 'mych' }); setTimeout(() => ph.root.querySelector(`#p-${CSS.escape(el.dataset.id)}`)?.scrollIntoView({ block: 'center' }), 30); },
      cmDel: () => { const p = c.posts.find(x => x.id === el.dataset.id); if (p) { p.comments = p.comments.filter(m => m.id !== el.dataset.c); p.fired.cm = (p.fired.cm || 0) + 1; ph.render(); toast('Коментар видалено'); } },
      cmSend: () => { const inp = ph.root.querySelector('[data-keep="tgcm"]'), t = inp?.value.trim(); if (!t) return; inp.value = ''; const p = c.posts.find(x => x.id === el.dataset.id); p.comments.push({ id: sim.id('tc'), mine: true, text: t, t: s.t }); ph.render(); },
      invite: () => this.inviteSheet(),
      adWrite: () => this.adSheet(),
      shareLk: () => {
        if (!s.me) { toast('Спершу створіть профіль у Лайкері'); return; }
        const link = TG_HOST + (c.pub ? c.link : c.invite);
        if (chLinkIn(c, s.me.link)) { toast('Посилання вже є в профілі Лайкера'); return; }
        s.me.link = link; ph.render(); toast(c.pub ? 'Посилання додано в профіль Лайкера' : 'Додано. Увага: тепер приватний канал може знайти будь-хто');
      },
      copy: () => { navigator.clipboard?.writeText('https://' + TG_HOST + (c.pub ? c.link : c.invite)).catch(() => {}); toast('Посилання скопійовано'); },
      delCh: async () => { if (await confirm('Видалити канал?', 'Видалити', true, 'Усі дописи й підписники зникнуть назавжди.')) { tgDeleteChannel(sim); this.stack = [{ v: 'chats' }]; ph.render(true); toast('Канал видалено'); } },
      unadmin: () => { c.admins = (c.admins || []).filter(x => x !== el.dataset.id); s.tg.flags.adminFull = false; ph.render(); toast('Права адміністратора забрано'); },
      eType: () => { top.d.pub = el.dataset.v === 'true'; ph.render(); },
      saveEdit: () => { const d = top.d; if (!d.title.trim() || (d.pub && linkErr(d.link, c.link))) return; tgEditChannel(sim, { title: d.title.trim(), desc: d.desc.trim(), pub: d.pub, link: d.pub ? d.link : '', avatar: { color: d.color, sym: d.sym, img: d.img } }); this.back(); toast('Зміни збережено'); },
      phone: () => { s.tg.set.phone = el.dataset.v; ph.render(); },
      endSes: async () => { if (await confirm(el.dataset.id === 'all' ? 'Завершити всі інші сеанси?' : 'Завершити сеанс?', 'Завершити', true)) { tgEndSession(sim, el.dataset.id); ph.render(); toast('Сеанс завершено'); } },
    };
    A[name]?.();
  }
  toggle(k) {
    const key = k.slice(3);
    if (key === 'pass2') { this.tg.set.pass2 = !this.tg.set.pass2; toast(this.tg.set.pass2 ? 'Хмарний пароль увімкнено' : 'Хмарний пароль вимкнено'); }
    else if (this.ch && key in this.ch.set) this.ch.set[key] = !this.ch.set[key];
    this.ph.render();
  }
  input(k, el) {
    const t = this.top, v = el.value, root = this.ph.root;
    if (k === 'tg.q') { t.q = v; this.ph.render(); }
    else if (k === 'tg.nTitle') { t.d.title = v; const b = root.querySelector('[data-act="tg.nNext"]'); if (b) b.disabled = !v.trim(); const av = root.querySelector('.tg-newav'); if (av) av.innerHTML = avatar({ name: v || 'К', color: t.d.color, sym: t.d.sym, img: t.d.img }, 84); }
    else if (k === 'tg.nDesc') t.d.desc = v;
    else if (k === 'tg.nLink' || k === 'tg.eLink') {
      t.d.link = v.trim(); t.d.linkTouched = true; const err = linkErr(t.d.link, k === 'tg.eLink' ? this.ch.link : ''), e = root.querySelector('[data-err]'), ok = root.querySelector('[data-ok]');
      if (e) e.textContent = err; if (ok) ok.innerHTML = err ? '' : `${icon('check', 14)} Вільне. Друзі знайдуть канал за адресою ${esc(TG_HOST + t.d.link)}`;
      const b = root.querySelector(k === 'tg.nLink' ? '[data-act="tg.nNext"]' : '[data-act="tg.saveEdit"]'); if (b) b.disabled = !!err || (k === 'tg.eLink' && !t.d.title.trim());
    }
    else if (k === 'tg.eTitle') { t.d.title = v; const b = root.querySelector('[data-act="tg.saveEdit"]'); if (b) b.disabled = !v.trim(); }
    else if (k === 'tg.eDesc') t.d.desc = v;
    else if (k === 'tg.post') { t.text = v; const tip = root.querySelector('[data-tgtip]'); if (tip) tip.innerHTML = this.tipHtml(t); el.style.height = 'auto'; el.style.height = Math.min(120, el.scrollHeight) + 'px'; }
  }
  imported(ctx, items) {
    const g = items[0]; if (!g) return;
    if (ctx === 'tgavatar' && this.top.d) { this.top.d.img = g.mid; this.ph.render(); }
    if (ctx === 'tgphoto') { this.ph.root.ownerDocument.querySelectorAll('.sh-back').forEach(x => x._api?.close()); (this.top.att ||= {}).gid = g.id; this.ph.render(); }
  }
  pollSheet() {
    sheet({ title: 'Нове опитування', cls: 'tg-pollsh', html: `<label class="fl"><span>Питання</span><input class="in" data-pq maxlength="120" placeholder="Наприклад: про що написати наступного разу?"></label><p class="lbl">Варіанти відповіді</p>${[0, 1, 2, 3].map(i => `<input class="in tg-po-in" data-po="${i}" maxlength="60" placeholder="Варіант ${i + 1}${i > 1 ? ' (необов’язково)' : ''}">`).join('')}<button class="btn tg-btn big" data-ok style="margin-top:12px">Додати опитування</button>`,
      onOpen: api => { api.$('[data-pq]').focus(); api.el.addEventListener('click', e => { if (!e.target.closest('[data-ok]')) return; const q = api.$('[data-pq]').value.trim(), opts = api.$$('[data-po]').map(x => x.value.trim()).filter(Boolean); if (!q || opts.length < 2) { toast('Потрібні питання й щонайменше два варіанти'); return; } (this.top.att ||= {}).poll = { q, opts }; api.close(); this.ph.render(); }); } });
  }
  editSheet(p) {
    sheet({ title: 'Редагувати допис', html: `<textarea class="in" rows="5" data-et maxlength="4000">${esc(p.text)}</textarea><button class="btn tg-btn big" data-ok style="margin-top:10px">Зберегти</button><p class="muted sm" style="margin-top:8px">Біля допису з’явиться позначка «змінено».</p>`,
      onOpen: api => api.el.addEventListener('click', e => { if (!e.target.closest('[data-ok]')) return; const t = api.$('[data-et]').value.trim(); if (!t) return; tgEditPost(this.sim, p.id, t); api.close(); this.ph.render(); }) });
  }
  postStats(p) {
    const r = Object.values(p.react).reduce((a, x) => a + x, 0), row = (ic, t, v) => `<p>${icon(ic, 18)}<span>${t}</span><b>${v}</b></p>`;
    sheet({ title: 'Статистика допису', html: `<div class="check tg-ps">${row('eye', 'Перегляди', num(p.stats.views))}${row('heart', 'Реакції', num(r))}${row('repost', 'Пересилання', num(p.stats.fwd))}${row('users', 'Підписалися після допису', '+' + num(p.stats.joined))}${row('block', 'Відписалися', '−' + num(p.stats.left))}${p.plan ? row('chart', 'Оцінка змісту', Math.round(p.plan.q * 100) + '%') : ''}</div>
      ${p.plan?.night ? `<p class="warnbox">${icon('moon', 16)}<span>Допис вийшов уночі зі звуком — частина читачів прокинулася й відписалася.</span></p>` : ''}${p.plan?.fatigue ? `<p class="warnbox">${icon('alert', 16)}<span>Забагато дописів за добу: читачі втомлюються й відписуються.</span></p>` : ''}
      <ul class="qc">${postCheck(p).map(([k, t, why]) => `<li class="${k}">${icon(k === 'ok' ? 'check' : 'alert', 16)}<span><b>${t}</b>${esc(why)}</span></li>`).join('')}</ul>` });
  }
  adSheet() {
    const c = this.ch, task = c.adTask; if (!task) return;
    const st = { mark: false, text: task.text || '' };
    const checks = () => adCheck(st.text, st.mark, task).map(([k, t, why]) => `<li class="${k}">${icon(k === 'ok' ? 'check' : 'alert', 16)}<span><b>${t}</b>${esc(why)}</span></li>`).join('');
    sheet({ title: 'Рекламний допис', cls: 'tg-adsh', html: `<div class="tg-brief">${icon('megaphone', 18)}<span><b>${esc(task.brand)} · ${num(task.pay)} грн</b><small>${task.bad ? 'Бренд надіслав готовий текст.' : `Завдання: розкажіть своїми словами, чим «${esc(task.item)}» може стати в пригоді вашим читачам.`} Оплата — через добу після публікації.</small></span></div>
      <textarea class="in" rows="5" data-adt maxlength="1500" placeholder="Наприклад: Мурчик спробував новий корм…">${esc(st.text)}</textarea>
      <button class="tg-mark" data-mark aria-pressed="false"><i class="tg-chk"></i><span><b>Позначити як рекламу</b><small>Під дописом буде «Реклама · ${esc(task.brand)}»</small></span></button>
      <ul class="qc" data-chk>${checks()}</ul><button class="btn tg-btn big" data-pub>Опублікувати</button>`,
      onOpen: api => {
        const ta = api.$('[data-adt]'), upd = () => { api.$('[data-chk]').innerHTML = checks(); };
        ta.addEventListener('input', () => { st.text = ta.value; upd(); });
        api.el.addEventListener('click', async e => {
          const m = e.target.closest('[data-mark]');
          if (m) { st.mark = !st.mark; m.setAttribute('aria-pressed', st.mark); const k = m.querySelector('.tg-chk'); k.className = 'tg-chk' + (st.mark ? ' on' : ''); k.innerHTML = st.mark ? icon('check', 15) : ''; upd(); }
          if (e.target.closest('[data-pub]')) {
            if (!st.text.trim()) { toast('Напишіть текст допису'); return; }
            const bad = adCheck(st.text, st.mark, task).find(x => x[0] === 'bad');
            if (bad && !(await confirm('Опублікувати попри це?', 'Опублікувати', true, bad[2]))) return;
            tgAdPost(this.sim, { text: st.text.trim(), mark: st.mark }); api.close(); this.ph.render(); toast('Рекламний допис опубліковано');
          }
        });
      } });
  }
  inviteSheet() {
    const c = this.ch, link = TG_HOST + (c.pub ? c.link : c.invite), list = this.tg.chats.filter(x => ['mom', 'dad', 'olia', 'marko', 'babusia', 'class'].includes(x.id)), pick = new Set();
    sheet({ title: 'Запросити в канал', cls: 'tg-invite', html: `<div class="tg-ibox"><small>посилання</small><p class="tg-lnk">${esc(link)}</p></div><p class="muted sm">Надішліть посилання — кожен сам вирішить, чи підписуватися.</p>
      <div class="tg-ilist">${list.map(x => `<button class="tg-row slim" data-i="${x.id}" aria-pressed="false">${avatar({ name: x.title, color: x.color, sym: x.sym }, 40)}<div class="tg-rb"><b>${esc(x.title)}</b><small>${x.kind === 'group' ? `група · ${x.members} учасників` : 'контакт'}</small></div><i class="tg-chk"></i></button>`).join('')}</div>
      <button class="btn tg-btn big" data-send disabled>Надіслати посилання</button>`,
      onOpen: api => api.el.addEventListener('click', e => {
        const b = e.target.closest('[data-i]');
        if (b) { const id = b.dataset.i; if (pick.has(id)) pick.delete(id); else pick.add(id); const on = pick.has(id); b.setAttribute('aria-pressed', on); b.querySelector('.tg-chk').className = 'tg-chk' + (on ? ' on' : ''); b.querySelector('.tg-chk').innerHTML = on ? icon('check', 15) : ''; const s = api.$('[data-send]'); s.disabled = !pick.size; s.textContent = pick.size ? `Надіслати (${pick.size})` : 'Надіслати посилання'; }
        if (e.target.closest('[data-send]') && pick.size) { tgInvite(this.sim, [...pick]); api.close(); this.ph.render(); toast('Посилання надіслано'); }
      }) });
  }
}
