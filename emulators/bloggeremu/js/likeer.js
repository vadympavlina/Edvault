// Симулятор блогера · соцмережа «Лайкер»: реєстрація, стрічка, тренди, профіль, допис, коментарі, Директ, аналітика, налаштування.
import { icon } from './icons.js';
import { photo, video, avatar } from './art.js';
import { esc, rich, sheet, actions, confirm, toast, sw } from './ui.js';
import { NICHES, nicheOf, TAGS, CREATORS, AV_COLORS, AV_SYMBOLS, SCENES, FILTERS, COMMENTS } from './data.js';
import { ago, num, plural, clock, dayName, dayOf, hourOf, DAY, repliesFor, toneOf, lc } from './sim.js';
import { openCreate } from './create.js';

const NOTIF_IC = { clock: 'clock', like: 'heart', comment: 'comment', follow: 'user', dm: 'send', star: 'fire', trophy: 'trophy', shield: 'shield', alert: 'alert', info: 'info', moon: 'moon', battery: 'battery', security: 'lock' };
export const passScore = (p, nick = '') => { if (!p) return 0; let s = 0; if (p.length >= 8) s++; if (p.length >= 12) s++; if (/\d/.test(p) && /\p{L}/u.test(p)) s++; if (/[^\p{L}\d]/u.test(p)) s++; if (/^(12345|qwerty|йцукен|password|пароль|11111)/i.test(p) || (nick && lc(p).includes(lc(nick)))) s = 0; return Math.min(4, s); };
const PASS_T = ['Дуже слабкий', 'Слабкий', 'Середній', 'Надійний', 'Дуже надійний'];
export const passMeter = (p, nick) => { const s = passScore(p, nick); return `<div class="pm s${s}"><i></i><i></i><i></i><i></i></div><small class="pm-t">${p ? PASS_T[s] : 'Щонайменше 8 символів: літери, цифри й знаки'}</small>`; };
export const nickErr = n => !n ? 'Придумайте ім’я користувача' : !/^[a-z0-9._]{3,20}$/.test(n) ? 'Лише латинські малі літери, цифри, крапка й підкреслення; 3–20 символів' : /^[._]|[._]$/.test(n) ? 'Не може починатися чи закінчуватися крапкою або підкресленням' : CREATORS.some(c => c.nick === n) ? 'Це ім’я вже зайняте' : '';

// Медіа допису (фото, відео або текстова картка)
export function media(sim, p, o = {}) {
  if (p.kind === 'text') return `<div class="txtcard" style="background:${p.bg || '#5c6bc0'}"><p>${esc(p.text)}</p></div>`;
  if (p.kind === 'video') return `<div class="vbox">${video(p.video.clip, { paused: !o.play })}${p.video.title ? `<span class="v-title">${esc(p.video.title)}</span>` : ''}${p.claimed ? `<span class="v-mute">${icon('music', 14)}Звук вимкнено</span>` : ''}<span class="v-dur">0:${String(Math.round(p.len || 20)).padStart(2, '0')}</span>${o.play ? '' : `<span class="v-play">${icon('play', 30, true)}</span>`}</div>`;
  const g = sim.s.gallery.find(x => x.id === p.photo.gid) || { scene: p.photo.scene || 'cat' };
  return photo(g, { filter: filterCss(p.photo.filter), text: p.photo.text, textY: p.photo.textY, sticker: p.photo.sticker });
}
export const filterCss = id => FILTERS.find(f => f.id === id)?.css || '';

export class Likeer {
  constructor(phone) {
    this.ph = phone; this.sim = phone.sim; this.stack = [{ v: this.sim.s.me ? 'feed' : 'welcome' }];
    this.reg = { step: 0, nick: '', name: '', niche: '', color: AV_COLORS[0], sym: 'letter', pass: '', priv: false, twoFA: false };
  }
  get s() { return this.sim.s; }
  get top() { if (!this.stack.length) this.stack.push({ v: this.sim.s.me ? 'feed' : 'welcome' }); return this.stack[this.stack.length - 1]; }
  go(v, a = {}) { this.stack.push({ v, ...a }); this.ph.render(true); }
  tab(v) { this.stack = [{ v }]; if (v === 'activity') this.s.unread.notifs = 0; this.ph.render(true); }
  back() { if (this.stack.length > 1) this.stack.pop(); else this.ph.home(); this.ph.render(true); }
  // чи перемальовувати екран щосекунди (живі лічильники)
  get live() { return ['feed', 'profile', 'post', 'stats', 'insights', 'activity', 'dms', 'thread', 'comments', 'hacked'].includes(this.top.v); }

  render() {
    const s = this.s;
    if (s.hack && !['recover'].includes(this.top.v)) this.stack = [{ v: 'hacked' }];
    if (!s.me && !['welcome', 'signup'].includes(this.top.v)) this.stack = [{ v: 'welcome' }];
    if (s.me && ['welcome', 'signup'].includes(this.top.v)) this.stack = [{ v: 'feed' }];
    const v = this.top.v, fn = this['v_' + v] || this.v_feed;
    const bars = ['feed', 'search', 'activity', 'profile'].includes(v);
    return `<div class="lk-app${bars ? ' with-tabs' : ''}">${fn.call(this, this.top)}${bars ? this.tabs(v) : ''}</div>`;
  }
  tabs(v) {
    const t = (k, ic, label, badge = '') => `<button class="tb${v === k ? ' on' : ''}" data-act="lk.tab" data-v="${k}" aria-label="${label}"${v === k ? ' aria-current="page"' : ''}>${icon(ic, 25, v === k && ic !== 'search')}${badge}</button>`;
    const n = this.s.unread.notifs;
    return `<nav class="tabbar">${t('feed', 'home', 'Стрічка')}${t('search', 'search', 'Пошук і тренди')}<button class="tb" data-act="lk.create" aria-label="Створити">${icon('plusSq', 26)}</button>${t('activity', 'heart', 'Активність', n ? `<i class="dot">${n > 99 ? '99+' : n}</i>` : '')}<button class="tb${v === 'profile' ? ' on' : ''}" data-act="lk.tab" data-v="profile" aria-label="Профіль">${avatar(this.meAv(), 27)}</button></nav>`;
  }
  meAv() { const m = this.s.me; return m ? { name: m.nick, color: m.avatar.color, sym: m.avatar.sym } : null; }
  head(title, right = '', backTo = true) { return `<header class="ah">${backTo ? `<button class="ib" data-act="lk.back" aria-label="Назад">${icon('back', 24)}</button>` : ''}<b class="ah-t">${title}</b><span class="grow"></span>${right}</header>`; }

  /* ═════════ Реєстрація ═════════ */
  v_welcome() {
    return `<div class="welcome"><div class="wl-logo">${logo(64)}</div><h1>Лайкер</h1><p>Діліться фото й відео, знаходьте своїх людей і розвивайте свій канал.</p>
      <button class="btn primary big" data-act="lk.signup">Створити профіль</button><p class="wl-note">Це навчальна соцмережа: усі підписники, коментарі й повідомлення вигадані. Справжні люди вас не побачать.</p></div>`;
  }
  v_signup() {
    const r = this.reg, st = r.step, steps = 4;
    const bar = `<div class="su-steps">${Array.from({ length: steps }, (_, i) => `<i class="${i <= st ? 'on' : ''}"></i>`).join('')}</div>`;
    let body = '';
    if (st === 0) body = `<h2>Ім’я користувача</h2><p class="muted">Так вас знаходитимуть інші. Не використовуйте справжнє прізвище, дату народження чи назву школи.</p>
      <label class="fl"><span>Ім’я користувача</span><span class="in-at"><i>@</i><input class="in" data-keep="nick" data-in="reg.nick" value="${esc(r.nick)}" maxlength="20" autocomplete="off" spellcheck="false" placeholder="наприклад, kotyk.art"></span></label>
      <p class="err" data-err>${r.nick ? esc(nickErr(r.nick)) : ''}</p>
      <label class="fl"><span>Ім’я для профілю (необов’язково)</span><input class="in" data-keep="name" data-in="reg.name" value="${esc(r.name)}" maxlength="30" placeholder="Як до вас звертатися"></label>`;
    else if (st === 1) body = `<h2>Про що ваш канал?</h2><p class="muted">Підписники приходять за певною темою. Її можна змінити пізніше.</p>
      <div class="niches">${Object.entries(NICHES).map(([k, n]) => `<button class="niche${r.niche === k ? ' on' : ''}" data-act="lk.regNiche" data-k="${k}">${icon(n.icon, 26)}<span>${n.t}</span></button>`).join('')}</div>`;
    else if (st === 2) body = `<h2>Фото профілю</h2><p class="muted">Краще намалювати значок, ніж ставити своє справжнє фото.</p>
      <div class="av-prev">${avatar({ name: r.nick || 'Я', color: r.color, sym: r.sym }, 96)}</div>
      <p class="lbl">Колір</p><div class="sw-row">${AV_COLORS.map(c => `<button class="cdot${r.color === c ? ' on' : ''}" style="background:${c}" data-act="lk.regColor" data-c="${c}" aria-label="Колір ${c}"></button>`).join('')}</div>
      <p class="lbl">Значок</p><div class="sw-row">${AV_SYMBOLS.map(k => `<button class="sym${r.sym === k ? ' on' : ''}" data-act="lk.regSym" data-k="${k}" aria-label="${k === 'letter' ? 'Літера' : 'Значок'}">${k === 'letter' ? `<b>${esc((r.nick || 'Я')[0].toUpperCase())}</b>` : icon(k, 22)}</button>`).join('')}</div>`;
    else body = `<h2>Пароль і безпека</h2><p class="muted">Надійний пароль довгий і не схожий на ім’я користувача. Нікому його не повідомляйте.</p>
      <label class="fl"><span>Пароль</span><input class="in" type="password" data-keep="pass" data-in="reg.pass" value="${esc(r.pass)}" maxlength="40" autocomplete="new-password"></label><div data-pm>${passMeter(r.pass, r.nick)}</div>
      <div class="opt"><div><b>Двофакторний вхід</b><small>Під час входу з нового пристрою Лайкер попросить ще й код із пошти. Навіть якщо хтось дізнається пароль, увійти не зможе.</small></div>${sw('reg.twoFA', r.twoFA, 'Двофакторний вхід')}</div>
      <div class="opt"><div><b>Закритий профіль</b><small>Дописи бачать лише ті, кого ви підтвердили. Безпечніше, але нові люди рідше знаходять вас.</small></div>${sw('reg.priv', r.priv, 'Закритий профіль')}</div>`;
    const ok = st === 0 ? !nickErr(r.nick) : st === 1 ? !!r.niche : st === 3 ? passScore(r.pass, r.nick) >= 2 : true;
    return `${this.head('Новий профіль', '', true)}<div class="scroll pad" data-scroll="su">${bar}${body}</div>
      <footer class="foot"><button class="btn primary big" data-act="lk.regNext" ${ok ? '' : 'disabled'}>${st === 3 ? 'Створити профіль' : 'Далі'}</button>${st === 3 && passScore(r.pass, r.nick) < 2 && r.pass ? '<p class="err">Пароль надто простий</p>' : ''}</footer>`;
  }

  /* ═════════ Профіль зламано ═════════ */
  v_hacked() {
    return `<div class="welcome"><div class="wl-logo bad">${icon('lock', 46)}</div><h1>Ви вийшли з профілю</h1><p>Пароль від @${esc(this.s.me.nick)} змінено на іншому пристрої (Android, Харків). Якщо це були не ви — профіль зламали.</p>
      <button class="btn primary big" data-act="lk.recover">Відновити доступ</button><p class="wl-note">Відновлення працює через пошту, яку ви вказали під час реєстрації. Тому важливо мати доступ до своєї пошти.</p></div>`;
  }
  v_recover(a) {
    return `${this.head('Відновлення доступу')}<div class="scroll pad"><p>Ми надіслали 6-значний код на <b>${esc(this.s.me.email)}</b>. Відкрийте застосунок «Пошта» на головному екрані.</p>
      <label class="fl"><span>Код із листа</span><input class="in" data-keep="code" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="one-time-code"></label>
      <label class="fl"><span>Новий пароль</span><input class="in" type="password" data-keep="npass" data-in="rec.pass" maxlength="40" autocomplete="new-password"></label><div data-pm>${passMeter(a.pass || '', this.s.me.nick)}</div>
      <p class="err" data-err>${esc(a.err || '')}</p><button class="btn primary big" data-act="lk.recoverGo">Відновити</button>
      <button class="btn link" data-act="lk.recoverCode">Надіслати код ще раз</button></div>`;
  }

  /* ═════════ Стрічка ═════════ */
  v_feed() {
    const s = this.s, mine = s.posts.filter(p => p.t && s.t - p.t < DAY).slice(0, 2);
    const dmN = s.dms.reduce((a, d) => a + (d.blocked ? 0 : d.unread), 0);
    const stories = `<div class="stories"><button class="story me" data-act="lk.newStory">${avatar(this.meAv(), 58)}<i class="plus">${icon('plus', 14)}</i><span>Ваша історія</span></button>${CREATORS.map(c => `<button class="story" data-act="lk.cstory" data-id="${c.id}" aria-label="Історія ${esc(c.nick)}"><span class="ring">${avatar({ name: c.name, color: c.color, sym: nicheOf(c.niche).icon }, 54)}</span><span>${esc(c.nick)}</span></button>`).join('')}</div>`;
    const card = f => {
      if (f.fake) return `<article class="post"><header class="ph">${avatar({ name: 'Н', color: '#c62828' }, 34)}<div><b>novyny_shkola_24_7</b><small>${ago(s.t, f.t)}</small></div></header><div class="txtcard alarm"><p>${esc(f.caption)}</p></div>
        <div class="pa"><span>${icon('heart', 24)}</span><b>${num(f.likes)}</b><span>${icon('comment', 24)}</span><b>${num(f.comments)}</b><span class="grow"></span><button class="btn sm" data-act="lk.checkFake">${icon('search', 15)}Перевірити</button><button class="btn sm" data-act="lk.shareFake">${icon('repost', 15)}Поширити</button></div></article>`;
      const c = CREATORS.find(x => x.id === f.cid);
      const who = c ? `<b>${esc(c.nick)}</b>${s.following.includes(c.id) ? '' : `<button class="lnk" data-act="lk.follow" data-id="${c.id}">Стежити</button>`}` : `<b>${esc(f.brand)}</b>`;
      return `<article class="post"><header class="ph">${c ? avatar({ name: c.name, color: c.color, sym: nicheOf(c.niche).icon }, 34) : avatar({ name: 'О', color: '#00695c' }, 34)}<div><span class="ph-n">${who}</span><small>${f.ad ? 'Реклама' : ago(s.t, f.t)}</small></div></header>
        <div class="pm-media" data-act="lk.likeFeed" data-id="${f.id}" data-dbl="1">${photo({ scene: f.scene, v: f.v / 1000 })}</div>
        <div class="pa"><button class="ib${f.liked ? ' liked' : ''}" data-act="lk.likeFeed" data-id="${f.id}" aria-label="Вподобати" aria-pressed="${!!f.liked}">${icon('heart', 25, f.liked)}</button><button class="ib" aria-label="Коментарі" data-act="lk.feedComments" data-id="${f.id}">${icon('comment', 24)}</button><button class="ib" aria-label="Поділитися" data-act="lk.toast" data-t="Посилання скопійовано">${icon('send', 23)}</button></div>
        <p class="pl"><b>${num(f.likes)}</b> ${plural(f.likes, 'вподобання', 'вподобання', 'вподобань')}</p><p class="pc"><b>${c ? esc(c.nick) : 'olivets.official'}</b> ${rich(f.caption)}</p>${f.ad ? '' : `<p class="pmore">Переглянути всі коментарі (${f.comments})</p>`}</article>`;
    };
    const own = mine.map(p => `<article class="post own" data-act="lk.post" data-id="${p.id}"><header class="ph">${avatar(this.meAv(), 34)}<div><b>${esc(s.me.nick)}</b><small>${ago(s.t, p.t)} · ваш допис</small></div></header><div class="pm-media">${media(this.sim, p)}</div><div class="pa"><span>${icon('heart', 22)}</span><b>${num(p.stats.likes)}</b><span>${icon('comment', 22)}</span><b>${num(p.stats.comments)}</b><span class="grow"></span><span class="muted sm">${num(p.stats.views)} переглядів</span></div></article>`).join('');
    return `<header class="ah main">${logo(28)}<b class="brand">Лайкер</b><span class="grow"></span><button class="ib" data-act="lk.go" data-v="dms" aria-label="Повідомлення">${icon('send', 24)}${dmN ? `<i class="dot">${dmN}</i>` : ''}</button></header>
      <div class="scroll" data-scroll="feed">${stories}${own}${s.feed.map(card).join('')}<p class="end">${icon('check', 18)}Ви переглянули всі нові дописи</p></div>`;
  }

  /* ═════════ Пошук і тренди ═════════ */
  v_search() {
    const s = this.s, tr = this.sim.trend, me = s.me, nich = nicheOf(me.niche);
    const tags = Object.entries(TAGS).filter(([, d]) => !d.spam && (d.topic === me.niche || d.topic == null)).sort((a, b) => b[1].size - a[1].size).slice(0, 6);
    const ideas = this.ideaSuggestions();
    return `<header class="ah main"><b class="ah-t">Тренди й ідеї</b></header><div class="scroll pad" data-scroll="search">
      <section class="trend"><small>${icon('fire', 15)} Тренд дня · ${dayName(s.t)}</small><b>#${esc(tr.tag)}</b><p>${esc(tr.t)}. Найкраще підходить для тем: ${tr.topics.map(t => nicheOf(t).t.toLowerCase()).join(', ')}.</p></section>
      <h3>Популярні хештеги: ${esc(nich.t.toLowerCase())}</h3><div class="tags">${tags.map(([k, d]) => `<span class="tg"><b>#${esc(k)}</b><small>${num(d.size * 4200)} дописів</small></span>`).join('')}</div>
      <p class="hint">${icon('info', 16)}<span>Великі хештеги (#котики) — багато глядачів, але й багато конкурентів. Маленькі (#мійкіт) — менше людей, зате саме ваших.</span></p>
      <h3>Ідеї для вас</h3><div class="ideas">${ideas.map(i => `<div class="idea"><span>${icon(i.icon, 18)}</span><p>${esc(i.t)}<small>${esc(i.why)}</small></p><button class="ib" data-act="lk.saveIdea" data-t="${esc(i.t)}" aria-label="Зберегти ідею">${icon('bookmark', 20)}</button></div>`).join('')}</div>
      <h3>Блогери, яких варто знати</h3>${CREATORS.map(c => `<div class="who">${avatar({ name: c.name, color: c.color, sym: nicheOf(c.niche).icon }, 44)}<div><b>${esc(c.nick)}</b><small>${esc(c.name)} · ${num(c.followers)} підписників</small></div><button class="btn sm${s.following.includes(c.id) ? '' : ' primary'}" data-act="lk.follow" data-id="${c.id}">${s.following.includes(c.id) ? 'Стежите' : 'Стежити'}</button></div>`).join('')}</div>`;
  }
  ideaSuggestions() {
    const s = this.s, me = s.me, tr = this.sim.trend, out = [];
    const reqs = s.posts.flatMap(p => p.comments.filter(c => c.kind === 'request' && !c.hidden)).slice(0, 2);
    for (const c of reqs) out.push({ t: c.text, why: 'Про це просять підписники в коментарях', icon: 'comment' });
    if (tr.topics.includes(me.niche)) out.push({ t: `Допис із хештегом #${tr.tag}`, why: 'Тренд дня збігається з темою вашого каналу', icon: 'fire' });
    const best = s.posts.filter(p => p.t).sort((a, b) => b.stats.views - a.stats.views)[0];
    if (best) out.push({ t: best.kind === 'video' ? 'Ще одне коротке відео в тому ж стилі' : 'Продовження вашого найпопулярнішого допису', why: `«${(best.caption || best.text || '').replace(/#\S+/g, '').trim().slice(0, 40) || 'Без опису'}» зібрав найбільше переглядів`, icon: 'chart' });
    const ins = this.sim.insights(7);
    out.push({ t: `Опублікувати ввечері, близько ${ins.best}:00`, why: 'У цей час ваші підписники найактивніші', icon: 'clock' });
    const base = { pets: 'Покажіть один день із життя улюбленця', food: 'Рецепт сніданку за 5 хвилин', games: 'Три поради для новачків у вашій улюбленій грі', art: 'Відео «малюю за 30 секунд»', sport: 'Розминка перед тренуванням', science: 'Дослід, який можна повторити вдома з дорослими', music: 'Коротка мелодія на замовлення підписника', travel: 'Найкрасивіше місце поруч із домом (без точної адреси)' };
    out.push({ t: base[me.niche] || 'Розкажіть про своє хобі', why: 'Класична ідея для вашої теми', icon: 'idea' });
    out.push({ t: 'Опитування в історії: що показати наступного разу?', why: 'Підписники люблять, коли їх питають', icon: 'poll' });
    return out.slice(0, 5);
  }

  /* ═════════ Активність ═════════ */
  v_activity() {
    const s = this.s, list = s.notifs.slice(0, 80);
    const today = list.filter(n => s.t - n.t < DAY), older = list.filter(n => s.t - n.t >= DAY);
    const row = n => `<button class="nt" data-act="lk.notif" data-id="${n.id}"><span class="nt-ic ${n.icon}">${icon(NOTIF_IC[n.icon] || 'bell', 18, n.icon === 'like')}</span><p>${rich(n.text, false)}<small>${ago(s.t, n.t)}</small></p></button>`;
    return `<header class="ah main"><b class="ah-t">Активність</b></header><div class="scroll" data-scroll="act">${list.length ? `${today.length ? `<h4 class="sec-h">Сьогодні</h4>${today.map(row).join('')}` : ''}${older.length ? `<h4 class="sec-h">Раніше</h4>${older.map(row).join('')}` : ''}` : `<div class="empty">${icon('heart', 40)}<b>Тут з’являться вподобання й коментарі</b><p>Опублікуйте перший допис — і люди почнуть реагувати.</p></div>`}</div>`;
  }

  /* ═════════ Профіль ═════════ */
  v_profile() {
    const s = this.s, me = s.me, posts = s.posts.filter(p => p.t), sched = s.posts.filter(p => !p.t);
    const tab = this.top.tab || 'posts';
    const grid = list => list.length ? `<div class="grid">${list.map(p => `<button class="gi" data-act="lk.post" data-id="${p.id}" aria-label="Допис">${media(this.sim, p)}${p.kind === 'video' ? `<i class="gi-ic">${icon('play', 16, true)}</i>` : ''}${p.t ? '' : `<i class="gi-time">${icon('clock', 14)}${clock(p.sched)}</i>`}</button>`).join('')}</div>` : `<div class="empty">${icon('camera', 40)}<b>${tab === 'posts' ? 'Ще немає дописів' : 'Немає запланованих дописів'}</b><p>${tab === 'posts' ? 'Натисніть «+» унизу, щоб створити перший.' : 'Під час створення допису виберіть «Запланувати».'}</p></div>`;
    const stories = s.stories.filter(x => s.t - x.t < DAY);
    return `<header class="ah main">${s.settings.priv ? icon('lock', 16) : ''}<b class="ah-t">${esc(me.nick)}</b><span class="grow"></span><button class="ib" data-act="lk.go" data-v="insights" aria-label="Аналітика">${icon('chart', 24)}</button><button class="ib" data-act="lk.go" data-v="settings" aria-label="Налаштування">${icon('gear', 24)}</button></header>
      <div class="scroll" data-scroll="prof"><section class="prof"><div class="pr-top"><button class="pr-av${stories.length ? ' ring' : ''}" data-act="lk.viewStory" aria-label="Ваші історії">${avatar(this.meAv(), 82)}</button>
        <div class="pr-n"><b>${num(posts.length)}</b><small>${plural(posts.length, 'допис', 'дописи', 'дописів')}</small></div><div class="pr-n"><b>${num(s.followers)}</b><small>${plural(s.followers, 'підписник', 'підписники', 'підписників')}</small></div><div class="pr-n"><b>${s.following.length}</b><small>стежите</small></div></div>
        <p class="pr-name">${esc(me.name || me.nick)}<span class="chip">${icon(nicheOf(me.niche).icon, 13)}${esc(nicheOf(me.niche).t)}</span></p>${me.bio ? `<p class="pr-bio">${rich(me.bio)}</p>` : '<p class="pr-bio muted">Додайте опис профілю — так людям легше зрозуміти, про що ваш канал.</p>'}
        <div class="pr-btns"><button class="btn" data-act="lk.go" data-v="editProfile">Редагувати профіль</button><button class="btn" data-act="lk.go" data-v="insights">Панель автора</button></div>
        <div class="meters">${meter('Довіра', s.trust, 'shield', 'Наскільки підписники вам вірять. Росте від чесності й ввічливості, падає від обману, грубості й сумнівної реклами.')}${meter('Енергія', s.energy, 'battery', 'Ваші сили. Кожен допис забирає енергію, відпочинок — повертає. Коли енергії мало, дописи виходять гіршими.')}</div></section>
        <div class="ptabs" role="tablist"><button role="tab" aria-selected="${tab === 'posts'}" class="${tab === 'posts' ? 'on' : ''}" data-act="lk.ptab" data-t="posts" aria-label="Дописи">${icon('grid', 22)}</button><button role="tab" aria-selected="${tab === 'sched'}" class="${tab === 'sched' ? 'on' : ''}" data-act="lk.ptab" data-t="sched" aria-label="Заплановані">${icon('clock', 22)}${sched.length ? `<i class="cnt">${sched.length}</i>` : ''}</button><button role="tab" aria-selected="${tab === 'drafts'}" class="${tab === 'drafts' ? 'on' : ''}" data-act="lk.ptab" data-t="drafts" aria-label="Чернетки">${icon('edit', 22)}${s.drafts.length ? `<i class="cnt">${s.drafts.length}</i>` : ''}</button></div>
        ${tab === 'drafts' ? this.drafts() : grid(tab === 'posts' ? posts : sched)}</div>`;
  }
  drafts() {
    const s = this.s;
    if (!s.drafts.length) return `<div class="empty">${icon('edit', 40)}<b>Чернеток немає</b><p>Якщо вийти з незавершеного допису, його можна зберегти тут і продовжити пізніше.</p></div>`;
    const kind = { photo: 'Фото', video: 'Відео', text: 'Допис' };
    return `<div class="drafts">${s.drafts.map(d => { const g = d.gid && s.gallery.find(x => x.id === d.gid); return `<div class="draft"><button class="dr-main" data-act="lk.openDraft" data-id="${d.id}"><span class="dr-m">${d.kind === 'text' ? `<span class="txtcard" style="background:${d.bg}"><p>${esc((d.txt || '').slice(0, 30))}</p></span>` : d.kind === 'video' && d.clip ? video(d.clip, { paused: true }) : g ? photo(g, { filter: filterCss(d.filter) }) : icon('image', 26)}</span><span class="dr-t"><b>${kind[d.kind] || 'Допис'}${d.caption ? ': ' + esc(d.caption.slice(0, 40)) : ''}</b><small>Збережено ${ago(s.t, d.t) === 'щойно' ? 'щойно' : ago(s.t, d.t) + ' тому'} · натисніть, щоб продовжити</small></span></button><button class="ib sm" data-act="lk.delDraft" data-id="${d.id}" aria-label="Видалити чернетку">${icon('trash', 18)}</button></div>`; }).join('')}</div>`;
  }
  v_editProfile(a) {
    const me = this.s.me, d = a.d ||= { name: me.name, bio: me.bio, niche: me.niche, color: me.avatar.color, sym: me.avatar.sym };
    return `${this.head('Редагувати профіль', `<button class="lnk strong" data-act="lk.saveProfile">Готово</button>`)}<div class="scroll pad">
      <div class="av-prev">${avatar({ name: me.nick, color: d.color, sym: d.sym }, 86)}</div>
      <div class="sw-row center">${AV_COLORS.map(c => `<button class="cdot${d.color === c ? ' on' : ''}" style="background:${c}" data-act="lk.epColor" data-c="${c}" aria-label="Колір"></button>`).join('')}</div>
      <div class="sw-row center">${AV_SYMBOLS.map(k => `<button class="sym${d.sym === k ? ' on' : ''}" data-act="lk.epSym" data-k="${k}" aria-label="Значок">${k === 'letter' ? `<b>${esc(me.nick[0].toUpperCase())}</b>` : icon(k, 22)}</button>`).join('')}</div>
      <label class="fl"><span>Ім’я</span><input class="in" data-keep="ep.name" data-in="ep.name" value="${esc(d.name)}" maxlength="30"></label>
      <label class="fl"><span>Опис профілю</span><textarea class="in" data-keep="ep.bio" data-in="ep.bio" maxlength="150" rows="3" placeholder="Про що ваш канал? Наприклад: «Малюю щодня й ділюся порадами»">${esc(d.bio)}</textarea></label>
      <p class="hint">${icon('info', 16)}<span>Не пишіть в описі школу, клас, адресу чи номер телефону.</span></p>
      <p class="lbl">Тема каналу</p><div class="niches sm">${Object.entries(NICHES).map(([k, n]) => `<button class="niche${d.niche === k ? ' on' : ''}" data-act="lk.epNiche" data-k="${k}">${icon(n.icon, 20)}<span>${n.t}</span></button>`).join('')}</div></div>`;
  }

  /* ═════════ Допис ═════════ */
  v_post(a) {
    const s = this.s, p = s.posts.find(x => x.id === a.id); if (!p) return this.v_gone();
    const st = p.stats, liked = a.play;
    const sched = !p.t;
    return `${this.head(sched ? 'Запланований допис' : 'Допис', `<button class="ib" data-act="lk.postMenu" data-id="${p.id}" aria-label="Ще">${icon('more', 24)}</button>`)}
      <div class="scroll" data-scroll="post"><article class="post"><header class="ph">${avatar(this.meAv(), 34)}<div><b>${esc(s.me.nick)}</b><small>${p.place ? `${icon('location', 12)}${esc(p.place)}` : sched ? `Вийде ${dayOf(p.sched) === dayOf(s.t) ? 'сьогодні' : 'завтра'} о ${clock(p.sched)}` : ago(s.t, p.t)}</small></div></header>
      ${p.ad ? `<p class="adline${p.adMarked ? '' : ' warn'}">${icon('money', 14)}${p.adMarked ? `Реклама · ${esc(adName(p.ad))}` : 'Рекламу не позначено'}</p>` : ''}
      <div class="pm-media" ${p.kind === 'video' ? 'data-act="lk.play"' : ''}>${media(this.sim, p, { play: a.play })}</div>
      ${sched ? '' : `<div class="pa"><span class="ib static">${icon('heart', 25)}</span><b>${num(st.likes)}</b><button class="ib" data-act="lk.go" data-v="comments" data-id="${p.id}" aria-label="Коментарі">${icon('comment', 24)}</button><b>${num(st.comments)}</b><span class="ib static">${icon('send', 23)}</span><b>${num(st.shares)}</b><span class="grow"></span><span class="ib static">${icon('bookmark', 23)}</span><b>${num(st.saves)}</b></div>`}
      ${p.caption ? `<p class="pc"><b>${esc(s.me.nick)}</b> ${rich(p.caption)}</p>` : ''}
      ${sched ? '' : `<button class="stats-btn" data-act="lk.go" data-v="stats" data-id="${p.id}">${icon('chart', 18)}<span><b>${num(st.views)}</b> ${plural(st.views, 'перегляд', 'перегляди', 'переглядів')} · Статистика допису</span>${icon('chevron', 18)}</button>
      ${p.commentsOff ? '<p class="muted pad">Коментарі вимкнено.</p>' : p.comments.length ? `<button class="pmore" data-act="lk.go" data-v="comments" data-id="${p.id}">Переглянути всі коментарі (${st.comments})</button>${p.comments.filter(c => !c.hidden).slice(-2).map(c => `<p class="pc sm"><b>${esc(s.people[c.pid]?.nick || '')}</b> ${esc(c.text)}</p>`).join('')}` : '<p class="muted pad">Коментарів поки немає.</p>'}`}
      </article></div>`;
  }
  v_gone() { return `${this.head('Допис')}<div class="empty">${icon('trash', 40)}<b>Допис видалено</b></div>`; }
  v_stats(a) {
    const s = this.s, p = s.posts.find(x => x.id === a.id); if (!p) return this.v_gone();
    const st = p.stats, total = Math.max(1, Object.values(st.src).reduce((x, y) => x + y, 0));
    const good = p.why.filter(w => w[0] === '+'), bad = p.why.filter(w => w[0] === '-');
    const tile = (k, v, ic) => `<div class="tile">${icon(ic, 18)}<b>${num(v)}</b><small>${k}</small></div>`;
    return `${this.head('Статистика допису')}<div class="scroll pad" data-scroll="stats">
      <div class="tiles">${tile('Перегляди', st.views, 'eye')}${tile('Охоплення', st.reach, 'users')}${tile('Вподобання', st.likes, 'heart')}${tile('Коментарі', st.comments, 'comment')}${tile('Поширення', st.shares, 'send')}${tile('Збереження', st.saves, 'bookmark')}</div>
      <div class="kpi">${icon('user', 18)}<span><b>+${num(st.follows)}</b> нових підписників${st.unfollows ? ` · <span class="neg">−${num(st.unfollows)} відписалися</span>` : ''}</span></div>
      ${p.kind === 'video' ? `<h3>Утримання глядачів</h3><div class="ret"><div class="ret-bar"><i style="width:${Math.round(st.watch * 100)}%"></i></div><p><b>${Math.round(st.watch * 100)}%</b> відео в середньому дивляться до кінця.${p.intro ? ' Багато людей гортають далі на перших секундах.' : ''}</p></div>` : ''}
      <h3>Звідки прийшли глядачі</h3>${Object.entries(st.src).map(([k, v]) => `<div class="hbar"><span>${k}</span><i><b style="width:${Math.round(v / total * 100)}%"></b></i><small>${Math.round(v / total * 100)}%</small></div>`).join('')}
      <h3>Що вплинуло на результат</h3>${good.length ? `<ul class="why good">${good.map(w => `<li>${icon('check', 16)}<span>${esc(w[1])}</span></li>`).join('')}</ul>` : ''}${bad.length ? `<ul class="why bad">${bad.map(w => `<li>${icon('alert', 16)}<span>${esc(w[1])}</span></li>`).join('')}</ul>` : ''}
      <p class="hint">${icon('info', 16)}<span>Перегляди набираються поступово: найбільше — у перші години після публікації.</span></p></div>`;
  }

  /* ═════════ Коментарі ═════════ */
  v_comments(a) {
    const s = this.s, p = s.posts.find(x => x.id === a.id); if (!p) return this.v_gone();
    const list = [...p.comments].sort((x, y) => (y.pinned - x.pinned) || (x.t - y.t));
    const hidden = list.filter(c => c.hidden).length;
    const showHidden = a.showHidden;
    const row = c => {
      const u = s.people[c.pid] || { nick: '?' };
      return `<div class="cm${c.hidden ? ' hid' : ''}${a.reply === c.id ? ' sel' : ''}">${avatar(u, 34)}<div class="cm-b"><p><b>${esc(u.nick)}</b>${u.verified ? `<span class="ver">${icon('check', 10)}</span>` : ''} ${esc(c.text)}</p>
        <small>${ago(s.t, c.t)}${c.likes ? ` · ${c.likes} ${plural(c.likes, 'вподобання', 'вподобання', 'вподобань')}` : ''}${c.pinned ? ` · ${icon('pin', 12)}Закріплено` : ''}${c.hidden ? ` · ${c.hidden === 'filter' ? 'Приховано фільтром' : 'Приховано'}` : ''}</small>
        ${c.reply ? `<div class="cm-r">${avatar(this.meAv(), 24)}<p><b>${esc(s.me.nick)}</b> ${esc(c.reply.text)}</p></div>` : `<button class="lnk sm" data-act="lk.replyTo" data-c="${c.id}">Відповісти</button>`}</div>
        <div class="cm-side"><button class="ib sm${c.liked ? ' liked' : ''}" data-act="lk.cLike" data-c="${c.id}" aria-label="Вподобати коментар">${icon('heart', 16, c.liked)}</button><button class="ib sm" data-act="lk.cMenu" data-c="${c.id}" aria-label="Дії з коментарем">${icon('more', 18)}</button></div></div>`;
    };
    const rc = a.reply && p.comments.find(c => c.id === a.reply);
    const sugg = rc ? repliesFor(rc).map(([t, tone, extra], i) => `<button class="chip-btn ${tone}" data-act="lk.quickReply" data-i="${i}">${esc(t)}</button>`).join('') : '';
    return `${this.head('Коментарі')}<div class="scroll" data-scroll="cm-${p.id}">${p.caption ? `<div class="cm cap">${avatar(this.meAv(), 34)}<div class="cm-b"><p><b>${esc(s.me.nick)}</b> ${rich(p.caption)}</p><small>${ago(s.t, p.t)}</small></div></div>` : ''}
      ${list.filter(c => showHidden || !c.hidden).map(row).join('') || '<div class="empty sm"><b>Коментарів поки немає</b><p>Вони з’являтимуться, коли люди побачать допис.</p></div>'}
      ${hidden ? `<button class="pmore" data-act="lk.toggleHidden">${showHidden ? 'Сховати приховані' : `Показати приховані (${hidden})`}</button>` : ''}</div>
      <footer class="composer">${rc ? `<div class="rc-head"><span>Відповідь для <b>@${esc(s.people[rc.pid]?.nick || '')}</b></span><button class="ib sm" data-act="lk.replyTo" data-c="" aria-label="Скасувати відповідь">${icon('close', 16)}</button></div><div class="chips">${sugg}</div>` : ''}
        <div class="cmp-row">${avatar(this.meAv(), 30)}<input class="in" data-keep="cm" placeholder="${rc ? 'Напишіть відповідь…' : 'Виберіть коментар, щоб відповісти'}" ${rc ? '' : 'disabled'} maxlength="300" aria-label="Відповідь"><button class="lnk strong" data-act="lk.sendReply" ${rc ? '' : 'disabled'}>Надіслати</button></div></footer>`;
  }

  /* ═════════ Директ ═════════ */
  v_dms() {
    const s = this.s, list = s.dms;
    return `${this.head('Повідомлення')}<div class="scroll" data-scroll="dms">${list.length ? list.map(d => { const u = s.people[d.pid] || { nick: '?' }, last = d.msgs.at(-1); return `<button class="dm${d.unread ? ' un' : ''}" data-act="lk.go" data-v="thread" data-id="${d.id}">${avatar(u, 50)}<div><b>${esc(u.name || u.nick)}${u.verified ? `<span class="ver">${icon('check', 10)}</span>` : ''}</b><small>${d.blocked ? 'Заблоковано' : `${last.me ? 'Ви: ' : ''}${esc(last.text.slice(0, 48))}`} · ${ago(s.t, d.t || last.t)}</small></div>${d.unread ? '<i class="udot"></i>' : ''}</button>`; }).join('') : `<div class="empty">${icon('send', 40)}<b>Повідомлень поки немає</b><p>Тут писатимуть підписники, інші блогери й бренди.</p></div>`}</div>`;
  }
  v_thread(a) {
    const s = this.s, d = s.dms.find(x => x.id === a.id); if (!d) return this.v_dms();
    if (d.unread) { d.unread = 0; }
    const u = s.people[d.pid] || { nick: '?' };
    const msgs = d.msgs.map(m => `<div class="msg${m.me ? ' me' : ''}"><p>${rich(m.text)}</p></div>`).join('');
    const opts = !d.blocked && d.opts ? `<div class="chips">${d.opts.map(([k, t]) => `<button class="chip-btn" data-act="lk.dmOpt" data-k="${k}">${esc(t)}</button>`).join('')}</div>` : '';
    return `<header class="ah"><button class="ib" data-act="lk.back" aria-label="Назад">${icon('back', 24)}</button>${avatar(u, 32)}<div class="ah-who"><b>${esc(u.name || u.nick)}${u.verified ? `<span class="ver">${icon('check', 10)}</span>` : ''}</b><small>@${esc(u.nick)}</small></div><span class="grow"></span><button class="ib" data-act="lk.dmMenu" data-id="${d.id}" aria-label="Дії">${icon('more', 22)}</button></header>
      <div class="scroll chat" data-scroll="th-${d.id}" data-bottom="1"><div class="who-card">${avatar(u, 64)}<b>${esc(u.name || u.nick)}</b><small>@${esc(u.nick)}${u.kind === 'brand' ? ' · Бізнес-профіль' : u.verified ? ' · Підтверджений профіль' : u.kind === 'scam' || u.kind === 'stranger' ? ' · Новий профіль, 0 дописів' : ''}</small></div>${msgs}${d.blocked ? '<p class="muted center">Ви заблокували цей профіль.</p>' : ''}</div>
      ${d.blocked ? '' : `<footer class="composer">${opts}<div class="cmp-row"><input class="in" data-keep="dm-${d.id}" placeholder="Повідомлення…" maxlength="400" aria-label="Повідомлення"><button class="lnk strong" data-act="lk.dmSend" data-id="${d.id}">Надіслати</button></div></footer>`}`;
  }

  /* ═════════ Панель автора (аналітика) ═════════ */
  v_insights(a) {
    const s = this.s, ins = this.sim.insights(7), days = [...s.days.slice(-6), { day: dayOf(s.t), followers: s.followers }];
    const max = Math.max(1, ...days.map(d => d.followers)), min = Math.min(...days.map(d => d.followers));
    const W = 300, H = 110, pts = days.map((d, i) => [days.length > 1 ? i / (days.length - 1) * W : W / 2, H - 10 - (d.followers - min) / Math.max(1, max - min) * (H - 24)]);
    const line = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Підписники за тиждень"><path d="M0 ${H - 10}H${W}" stroke="#e3e6ea"/><path d="${pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('')}" fill="none" stroke="#e1306c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#fff" stroke="#e1306c" stroke-width="2"/>`).join('')}</svg>
      <div class="ch-x">${days.map(d => `<span>${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'][d.day % 7]}</span>`).join('')}</div>`;
    const hb = ins.hours.map((v, i) => `<i class="${i === ins.best ? 'best' : ''}" style="height:${Math.max(4, v)}%" title="${i}:00 — ${v}%"></i>`).join('');
    const intr = Object.entries(ins.interests).sort((a, b) => b[1] - a[1]).slice(0, 4), it = Math.max(1, intr.reduce((x, y) => x + y[1], 0));
    const top = [...ins.posts].sort((x, y) => y.stats.views - x.stats.views).slice(0, 3);
    const tile = (k, v, sub = '') => `<div class="tile"><b>${v}</b><small>${k}</small>${sub}</div>`;
    return `${this.head('Панель автора')}<div class="scroll pad" data-scroll="ins"><p class="muted">Останні 7 днів</p>
      <div class="tiles three">${tile('Перегляди', num(ins.views))}${tile('Взаємодії', num(ins.likes + ins.comments + ins.shares))}${tile('Залученість', (ins.er * 100).toFixed(1).replace('.', ',') + '%')}</div>
      <p class="hint">${icon('info', 16)}<span><b>Залученість</b> — яка частка глядачів поставила вподобання або написала коментар. Важливіша за кількість підписників.</span></p>
      <h3>Підписники: ${num(s.followers)}</h3>${line}
      ${s.bots ? `<p class="warnbox">${icon('alert', 16)}<span>${num(s.bots)} ваших підписників — боти. Вони не дивляться дописи й знижують залученість.</span></p>` : ''}
      <h3>Коли ваші підписники онлайн</h3><div class="hours">${hb}</div><div class="ch-x"><span>0:00</span><span>6:00</span><span>12:00</span><span>18:00</span><span>23:00</span></div>
      <p class="muted sm">Найактивніше — близько <b>${ins.best}:00</b>. Вночі й під час уроків вас бачитимуть менше людей.</p>
      <h3>Що цікаво вашій аудиторії</h3>${intr.length ? intr.map(([k, v]) => `<div class="hbar"><span>${nicheOf(k).t}</span><i><b style="width:${Math.round(v / it * 100)}%"></b></i><small>${Math.round(v / it * 100)}%</small></div>`).join('') : '<p class="muted">Поки замало підписників.</p>'}
      <h3>Найкращі дописи</h3>${top.length ? top.map(p => `<button class="toprow" data-act="lk.go" data-v="stats" data-id="${p.id}"><span class="tr-m">${media(this.sim, p)}</span><span><b>${num(p.stats.views)}</b> переглядів<small>${num(p.stats.likes)} вподобань · ${p.stats.comments} коментарів</small></span>${icon('chevron', 18)}</button>`).join('') : '<p class="muted">Ще немає дописів за цей тиждень.</p>'}
      <h3>Гаманець</h3><div class="kpi">${icon('money', 18)}<span>Зароблено на рекламі: <b>${s.money} грн</b></span></div>
      <div class="meters">${meter('Довіра', s.trust, 'shield', 'Чесність, ввічливість і позначена реклама підвищують довіру. Обман, грубість і накрутка — знижують.')}${meter('Енергія', s.energy, 'battery', 'Відновлюється з часом, особливо вночі.')}</div></div>`;
  }

  /* ═════════ Налаштування ═════════ */
  v_settings() {
    const st = this.s.settings;
    const row = (k, t, sub, on) => `<div class="opt"><div><b>${t}</b><small>${sub}</small></div>${sw(k, on, t)}</div>`;
    const sel = (k, t, val, opts) => `<label class="opt"><div><b>${t}</b></div><select class="in sel" data-sel="${k}" aria-label="${t}">${opts.map(([v, l]) => `<option value="${v}"${v === val ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
    return `${this.head('Налаштування')}<div class="scroll pad" data-scroll="set">
      <h3>${icon('lock', 18)}Конфіденційність</h3>${row('set.priv', 'Закритий профіль', 'Дописи бачать лише підтверджені підписники', st.priv)}
      ${sel('comments', 'Хто може коментувати', st.comments, [['all', 'Усі'], ['followers', 'Лише підписники'], ['off', 'Ніхто']])}
      ${sel('dms', 'Хто може писати в Директ', st.dms, [['all', 'Усі'], ['followers', 'Лише підписники']])}
      ${row('set.filter', 'Фільтр образливих коментарів', 'Автоматично ховає грубі й образливі коментарі', st.filter)}
      ${row('set.limitNew', 'Обмежити нові профілі', 'Коментарі від щойно створених профілів (часто боти) приховуються', st.limitNew)}
      <h3>${icon('shield', 18)}Безпека</h3>${row('set.twoFA', 'Двофакторний вхід', 'Під час входу з нового пристрою потрібен ще й код', st.twoFA)}
      <button class="opt link" data-act="lk.go" data-v="password"><div><b>Пароль</b><small>Змінити пароль профілю</small></div>${icon('chevron', 18)}</button>
      <button class="opt link" data-act="lk.go" data-v="sessions"><div><b>Де ви ввійшли</b><small>${st.sessions.length} ${plural(st.sessions.length, 'пристрій', 'пристрої', 'пристроїв')}${st.sessions.some(x => x.bad) ? ' · є незнайомий!' : ''}</small></div>${icon('chevron', 18)}</button>
      <h3>${icon('clock', 18)}Час у Лайкері</h3>${this.screenTime()}
      <label class="opt"><div><b>Нагадувати про перерву</b><small>Сповіщення, коли за день набереться стільки часу</small></div><select class="in sel" data-sel="breakAt" aria-label="Нагадувати про перерву">${[[0, 'Ніколи'], [30, 'Через 30 хв'], [60, 'Через 1 год'], [90, 'Через 1,5 год'], [120, 'Через 2 год']].map(([v, l]) => `<option value="${v}"${this.s.breakAt === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <h3>${icon('camera', 18)}Камера</h3>${row('set.geotag', 'Зберігати місце у фото', 'Телефон записує у фото, де його зроблено. Хто отримає фото, зможе дізнатися місце', st.geotag)}
      <h3>${icon('user', 18)}Профіль</h3><button class="opt link" data-act="lk.go" data-v="editProfile"><div><b>Редагувати профіль</b><small>Ім’я, опис, фото, тема каналу</small></div>${icon('chevron', 18)}</button>
      <button class="opt link danger" data-act="lk.reset"><div><b>Видалити профіль і почати заново</b><small>Усі дописи, підписники й повідомлення зникнуть</small></div>${icon('trash', 18)}</button></div>`;
  }
  screenTime() {
    const s = this.s, today = dayOf(s.t), days = Array.from({ length: 7 }, (_, i) => today - 6 + i), vals = days.map(d => s.screen[d] || 0), max = Math.max(60, ...vals);
    const fmt = m => m >= 60 ? `${Math.floor(m / 60)} год ${Math.round(m % 60)} хв` : `${Math.round(m)} хв`;
    const avg = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.filter(Boolean).length || 1);
    return `<div class="st-time"><p><b>${fmt(vals[6])}</b> сьогодні<small>У середньому ${fmt(avg)} на день</small></p><div class="st-bars">${days.map((d, i) => `<span><i style="height:${Math.round(vals[i] / max * 100)}%"${i === 6 ? ' class="today"' : ''}></i><small>${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'][((d % 7) + 7) % 7]}</small></span>`).join('')}</div></div>`;
  }
  v_password(a) {
    return `${this.head('Пароль')}<div class="scroll pad"><label class="fl"><span>Поточний пароль</span><input class="in" type="password" data-keep="op" autocomplete="current-password"></label>
      <label class="fl"><span>Новий пароль</span><input class="in" type="password" data-keep="np" data-in="pw.np" autocomplete="new-password"></label><div data-pm>${passMeter(a.np || '', this.s.me.nick)}</div>
      <p class="err" data-err>${esc(a.err || '')}</p><button class="btn primary big" data-act="lk.changePass">Змінити пароль</button></div>`;
  }
  v_sessions() {
    const st = this.s.settings;
    return `${this.head('Де ви ввійшли')}<div class="scroll pad">${st.sessions.map(x => `<div class="opt"><span class="ses-ic${x.bad ? ' bad' : ''}">${icon('phone', 22)}</span><div><b>${esc(x.dev)}${x.now ? ' · цей пристрій' : ''}</b><small>${esc(x.city)}${x.bad ? ' · ви цей пристрій не знаєте' : ''}</small></div>${x.now ? '' : `<button class="btn sm danger" data-act="lk.endSession" data-id="${x.id}">Вийти</button>`}</div>`).join('')}
      <p class="hint">${icon('info', 16)}<span>Якщо бачите незнайомий пристрій — завершіть сеанс, змініть пароль і ввімкніть двофакторний вхід.</span></p></div>`;
  }
  v_story(a) {
    const s = this.s, list = s.stories.filter(x => s.t - x.t < DAY), i = Math.min(a.i || 0, list.length - 1), st = list[i];
    if (!st) return `${this.head('Історії')}<div class="empty">${icon('camera', 40)}<b>Немає активних історій</b><p>Історії зникають через 24 години.</p></div>`;
    const g = st.gid && s.gallery.find(x => x.id === st.gid);
    return `<div class="story-view"><div class="sv-bars">${list.map((_, j) => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</div><header class="sv-h">${avatar(this.meAv(), 32)}<b>${esc(s.me.nick)}</b><small>${ago(s.t, st.t)}</small><span class="grow"></span><button class="ib light" data-act="lk.back" aria-label="Закрити">${icon('close', 24)}</button></header>
      <div class="sv-media">${st.fake ? `<div class="txtcard alarm"><p>ТЕРМІНОВО! Завтра скасовують уроки в усіх школах країни. Поширте!!!</p></div>` : g ? photo(g) : `<div class="txtcard" style="background:#7e57c2"><p>${esc(st.text)}</p></div>`}
      ${st.poll ? (() => { const tot = st.votes[0] + st.votes[1]; return `<div class="poll"><b>${esc(st.poll.q)}</b>${st.poll.a.map((t, j) => { const pc = tot ? Math.round(st.votes[j] / tot * 100) : 0; return `<div class="poll-a"><i style="width:${tot >= 3 ? pc : 0}%"></i><span>${esc(t)}</span><b>${tot >= 3 ? pc + '%' : ''}</b></div>`; }).join('')}<small class="poll-n">${tot >= 3 ? `${tot} ${plural(tot, 'голос', 'голоси', 'голосів')}` : 'Голоси ще збираються…'}</small></div>`; })() : ''}
      ${list.length > 1 ? `<button class="sv-prev" data-act="lk.storyNav" data-d="-1" aria-label="Попередня"></button><button class="sv-next" data-act="lk.storyNav" data-d="1" aria-label="Наступна"></button>` : ''}</div>
      <footer class="sv-f">${icon('eye', 18)}<span>${num(st.views)} ${plural(st.views, 'перегляд', 'перегляди', 'переглядів')}</span></footer></div>`;
  }
  v_cstory(a) {
    const s = this.s, c = CREATORS.find(x => x.id === a.id), f = s.feed.find(x => x.cid === c.id);
    const scene = f?.scene || Object.keys(SCENES).find(k => SCENES[k].topic === c.niche && !SCENES[k].risk);
    return `<div class="story-view"><div class="sv-bars"><i class="on"></i></div><header class="sv-h">${avatar({ name: c.name, color: c.color, sym: nicheOf(c.niche).icon }, 32)}<b>${esc(c.nick)}</b><small>${1 + (c.followers % 9)} год</small><span class="grow"></span><button class="ib light" data-act="lk.back" aria-label="Закрити">${icon('close', 24)}</button></header>
      <div class="sv-media">${photo({ scene, v: (f?.v || 7) / 1000 })}<p class="sv-cap">${esc(f ? f.caption.replace(/#\S+/g, '').trim() : 'Гарного дня!')}</p></div>
      <footer class="sv-f"><button class="btn sm light" data-act="lk.creator" data-id="${c.id}">Переглянути профіль</button></footer></div>`;
  }
  v_creator(a) {
    const s = this.s, c = CREATORS.find(x => x.id === a.id), f = s.feed.filter(x => x.cid === c.id);
    return `${this.head(esc(c.nick))}<div class="scroll"><section class="prof"><div class="pr-top">${avatar({ name: c.name, color: c.color, sym: nicheOf(c.niche).icon }, 82)}<div class="pr-n"><b>${40 + c.followers % 90}</b><small>дописів</small></div><div class="pr-n"><b>${num(c.followers)}</b><small>підписників</small></div></div>
      <p class="pr-name">${esc(c.name)}<span class="ver">${icon('check', 10)}</span><span class="chip">${icon(nicheOf(c.niche).icon, 13)}${nicheOf(c.niche).t}</span></p><div class="pr-btns"><button class="btn${s.following.includes(c.id) ? '' : ' primary'}" data-act="lk.follow" data-id="${c.id}">${s.following.includes(c.id) ? 'Стежите' : 'Стежити'}</button></div></section>
      <div class="grid">${(f.length ? f : [{ scene: Object.keys(SCENES).find(k => SCENES[k].topic === c.niche), v: 1 }]).map(x => `<span class="gi">${photo({ scene: x.scene, v: (x.v || 0) / 1000 })}</span>`).join('')}</div></div>`;
  }

  /* ═════════ дії ═════════ */
  act(name, el, e) {
    const s = this.s, sim = this.sim, top = this.top;
    const A = {
      tab: () => this.tab(el.dataset.v),
      back: () => this.back(),
      go: () => this.go(el.dataset.v, el.dataset.id ? { id: el.dataset.id } : {}),
      toast: () => toast(el.dataset.t),
      signup: () => { this.reg.step = 0; this.go('signup'); },
      regNiche: () => { this.reg.niche = el.dataset.k; this.ph.render(); },
      regColor: () => { this.reg.color = el.dataset.c; this.ph.render(); },
      regSym: () => { this.reg.sym = el.dataset.k; this.ph.render(); },
      regNext: () => {
        const r = this.reg;
        if (r.step < 3) { r.step++; this.ph.render(true); return; }
        sim.register({ nick: r.nick, name: r.name.trim(), niche: r.niche, avatar: { color: r.color, sym: r.sym }, pass: r.pass, priv: r.priv, twoFA: r.twoFA });
        this.stack = [{ v: 'feed' }]; this.ph.render(true); toast('Профіль створено! Час для першого допису');
      },
      create: () => openCreate(this.ph),
      newStory: () => openCreate(this.ph, { kind: 'story' }),
      viewStory: () => this.go('story', { i: 0 }),
      storyNav: () => { top.i = Math.max(0, (top.i || 0) + +el.dataset.d); this.ph.render(); },
      creator: () => { if (top.v === 'cstory') this.stack.pop(); this.go('creator', { id: el.dataset.id }); },
      cstory: () => this.go('cstory', { id: el.dataset.id }),
      openDraft: () => { const d = s.drafts.find(x => x.id === el.dataset.id); if (d) openCreate(this.ph, { draft: d }); },
      delDraft: async () => { if (await confirm('Видалити чернетку?', 'Видалити', true)) { sim.deleteDraft(el.dataset.id); this.ph.render(); } },
      tag: () => this.tagInfo(el.dataset.t),
      follow: () => { sim.follow(el.dataset.id); },
      likeFeed: () => { if (el.dataset.dbl && e.detail < 2) return; sim.likeFeed(el.dataset.id); },
      feedComments: () => this.feedComments(el.dataset.id),
      checkFake: () => sheet({ title: 'Перевірка допису', html: `<div class="check"><p>${icon('user', 18)}<span><b>Автор:</b> @novyny_shkola_24_7 — профіль створено вчора, без позначки перевірки, 2 дописи.</span></p><p>${icon('globe', 18)}<span><b>Джерело:</b> посилання на офіційний сайт немає.</span></p><p>${icon('search', 18)}<span><b>Інші новини:</b> на сайтах міністерства освіти й школи про скасування уроків нічого не сказано.</span></p><p>${icon('alert', 18)}<span><b>Ознаки фейку:</b> великі літери, «ТЕРМІНОВО», «поширте всім» — так пишуть, щоб ви не встигли подумати.</span></p></div><p class="hint">${icon('info', 16)}<span>Висновок: найімовірніше, це фейк. Краще не поширювати.</span></p>` }),
      shareFake: async () => { if (await confirm('Поширити цю новину у свою історію?', 'Поширити', false, 'Її побачать ваші підписники.')) { sim.story({ fake: true }); toast('Новину поширено в історію'); } },
      saveIdea: () => { sim.addIdea(el.dataset.t); toast('Ідею збережено в «Ідеї»'); },
      notif: () => { const n = s.notifs.find(x => x.id === el.dataset.id); if (!n) return; if (n.post && s.posts.some(p => p.id === n.post)) this.go(n.icon === 'comment' ? 'comments' : 'post', { id: n.post }); else if (n.icon === 'dm' && n.pid) { const d = s.dms.find(x => x.pid === n.pid); if (d) this.go('thread', { id: d.id }); } },
      ptab: () => { top.tab = el.dataset.t; this.ph.render(); },
      epColor: () => { top.d.color = el.dataset.c; this.ph.render(); },
      epSym: () => { top.d.sym = el.dataset.k; this.ph.render(); },
      epNiche: () => { top.d.niche = el.dataset.k; this.ph.render(); },
      saveProfile: () => { const d = top.d; if (/\d{3}|школ|клас|вул/i.test(d.bio)) { toast('Схоже, в описі є особисті дані. Краще їх прибрати'); } sim.updateProfile({ name: d.name.trim(), bio: d.bio.trim(), niche: d.niche, avatar: { color: d.color, sym: d.sym } }); this.back(); toast('Профіль оновлено'); },
      post: () => this.go('post', { id: el.dataset.id }),
      play: () => { top.play = !top.play; this.ph.render(); },
      postMenu: () => this.postMenu(el.dataset.id),
      cLike: () => sim.likeComment(top.id, el.dataset.c),
      cMenu: () => this.commentMenu(top.id, el.dataset.c),
      toggleHidden: () => { top.showHidden = !top.showHidden; this.ph.render(); },
      replyTo: () => { top.reply = el.dataset.c || null; this.ph.render(); setTimeout(() => this.ph.root.querySelector('[data-keep="cm"]')?.focus(), 0); },
      quickReply: () => { const c = s.posts.find(p => p.id === top.id)?.comments.find(x => x.id === top.reply); if (!c) return; const [t, tone, extra] = repliesFor(c)[+el.dataset.i]; sim.reply(top.id, top.reply, t, tone, extra); this.afterReply(tone, extra); },
      sendReply: () => { const inp = this.ph.root.querySelector('[data-keep="cm"]'), t = inp?.value.trim(); if (!t || !top.reply) return; inp.value = ''; const tone = toneOf(t); sim.reply(top.id, top.reply, t, tone); this.afterReply(tone); },
      dmOpt: () => { const d = s.dms.find(x => x.id === top.id), o = d?.opts?.find(x => x[0] === el.dataset.k); if (o) sim.dmReply(d.id, o[1], o[0]); },
      dmSend: () => { const inp = this.ph.root.querySelector(`[data-keep="dm-${el.dataset.id}"]`), t = inp?.value.trim(); if (!t) return; inp.value = ''; sim.dmReply(el.dataset.id, t); },
      dmMenu: () => { const d = s.dms.find(x => x.id === el.dataset.id); actions([{ t: 'Заблокувати', icon: 'block', danger: true, on: () => { sim.block(d.pid); toast('Заблоковано'); } }, { t: 'Поскаржитися', icon: 'flag', danger: true, on: () => { sim.report(d.pid); toast('Скаргу надіслано'); } }, { t: 'Видалити чат', icon: 'trash', on: () => { s.dms.splice(s.dms.indexOf(d), 1); this.back(); } }]); },
      recover: () => { sim.sendCode(); this.go('recover', {}); toast('Код надіслано на пошту'); },
      recoverCode: () => { sim.sendCode(); toast('Новий код надіслано'); },
      recoverGo: () => { const r = this.ph.root, code = r.querySelector('[data-keep="code"]').value.trim(), np = r.querySelector('[data-keep="npass"]').value; const err = sim.recover(code, np); if (err) { top.err = err; this.ph.render(); } else { this.stack = [{ v: 'profile' }]; this.ph.render(true); toast('Доступ відновлено'); } },
      changePass: () => { const r = this.ph.root, op = r.querySelector('[data-keep="op"]').value, np = r.querySelector('[data-keep="np"]').value; top.err = op !== s.me.pass ? 'Неправильний поточний пароль' : passScore(np, s.me.nick) < 2 ? 'Новий пароль надто простий' : np === op ? 'Новий пароль має відрізнятися від старого' : ''; if (top.err) { this.ph.render(); return; } s.me.pass = np; this.back(); toast('Пароль змінено'); },
      endSession: () => { sim.endSession(el.dataset.id); toast('Сеанс завершено'); this.ph.render(); },
      reset: async () => { if (await confirm('Видалити профіль і почати заново?', 'Видалити', true, 'Цю дію не можна скасувати.')) this.ph.resetAll(); },
    };
    A[name]?.();
  }
  afterReply(tone, extra) { this.top.reply = null; this.ph.render(); toast(tone === 'rude' ? 'Грубі відповіді відштовхують підписників' : extra === 'idea' ? 'Відповідь надіслано, ідею збережено' : 'Відповідь надіслано'); }
  // введення в полях (без перемальовування всього екрана)
  input(key, el) {
    const r = this.reg, v = el.value;
    if (key === 'reg.nick') { r.nick = lc(v).replace(/\s/g, ''); if (el.value !== r.nick) el.value = r.nick; this.refreshFoot(!nickErr(r.nick), nickErr(r.nick)); }
    else if (key === 'reg.name') r.name = v;
    else if (key === 'reg.pass') { r.pass = v; this.ph.root.querySelector('[data-pm]').innerHTML = passMeter(v, r.nick); this.refreshFoot(passScore(v, r.nick) >= 2, ''); }
    else if (key === 'ep.name') this.top.d.name = v;
    else if (key === 'ep.bio') this.top.d.bio = v;
    else if (key === 'rec.pass' || key === 'pw.np') { this.top[key === 'rec.pass' ? 'pass' : 'np'] = v; this.ph.root.querySelector('[data-pm]').innerHTML = passMeter(v, this.s.me.nick); }
  }
  refreshFoot(ok, err) { const b = this.ph.root.querySelector('[data-act="lk.regNext"]'); if (b) b.disabled = !ok; const e = this.ph.root.querySelector('[data-err]'); if (e) e.textContent = err || ''; }
  toggle(key) {
    const st = this.s.settings;
    if (key === 'reg.twoFA' || key === 'reg.priv') { this.reg[key.slice(4)] = !this.reg[key.slice(4)]; this.ph.render(); return; }
    const k = key.slice(4); this.sim.setSetting(k, !st[k]);
    if (k === 'twoFA' && st[k]) toast('Двофакторний вхід увімкнено');
    if (k === 'priv') toast(st.priv ? 'Профіль закрито: нові люди бачать лише ім’я й фото' : 'Профіль відкрито');
    this.ph.render(); this.ph.save();
  }
  select(key, v) { if (key === 'breakAt') { this.s.breakAt = +v; this.s.flags.breakDay = null; } else this.sim.setSetting(key, v); this.ph.save(); toast('Збережено'); }

  tagInfo(raw) {
    const t = lc(raw), s = this.s;
    if (t.startsWith('@')) { const c = CREATORS.find(x => x.nick === t.slice(1)); if (c) this.go('creator', { id: c.id }); else if (t.slice(1) === s.me?.nick) this.tab('profile'); return; }
    const k = t.slice(1), d = TAGS[k], tr = this.sim.trend, mine = s.posts.filter(p => p.t && p.tags?.includes(k)).length;
    const size = d ? d.size * 4200 : tr.tag === k ? 12000 : 40 + k.length * 7;
    sheet({ title: '#' + k, html: `<div class="check"><p>${icon('grid', 18)}<span><b>${num(size)}</b> ${plural(size, 'допис', 'дописи', 'дописів')} з цим хештегом</span></p>
      <p>${icon('star', 18)}<span>Тема: ${d?.topic ? nicheOf(d.topic).t : tr.tag === k ? tr.topics.map(x => nicheOf(x).t).join(', ') : 'різне'}</span></p>
      ${tr.tag === k ? `<p>${icon('fire', 18)}<span><b>Тренд дня</b> — дописи на тему тренду отримують більше показів</span></p>` : ''}
      ${d?.spam ? `<p>${icon('alert', 18)}<span>Хештег-спам: його ставлять усі підряд, тож він не приводить зацікавлених людей</span></p>` : ''}
      <p>${icon('user', 18)}<span>Ваших дописів із ним: ${mine}</span></p></div>
      <p class="hint">${icon('info', 16)}<span>${size > 20000 ? 'Великий хештег: багато глядачів, але ваш допис швидко загубиться серед інших.' : 'Невеликий хештег: глядачів менше, зате це саме ті, кому цікава ця тема.'}</span></p>` });
  }
  feedComments(fid) {
    const s = this.s, f = s.feed.find(x => x.id === fid); if (!f) return;
    const c = CREATORS.find(x => x.id === f.cid), seed = [...fid].reduce((a, ch) => a + ch.charCodeAt(0), 0);
    const pool = [...(COMMENTS.topic[c?.niche] || []), ...COMMENTS.praise], names = ['sonia_art', 'max.play', 'olesia.go', 'dima_fox', 'nastia.sun', 'taras_kyiv', 'vika.moon'];
    const list = Array.from({ length: 5 }, (_, i) => [names[(seed + i) % names.length], pool[(seed + i * 3) % pool.length], AV_COLORS[(seed + i) % AV_COLORS.length]]);
    sheet({ title: 'Коментарі', html: `${list.map(([n, t, col]) => `<div class="cm">${avatar({ name: n, color: col }, 32)}<div class="cm-b"><p><b>${n}</b> ${esc(t)}</p><small>${1 + (seed + n.length) % 9} год</small></div></div>`).join('')}<p class="hint">${icon('info', 16)}<span>Тут ви лише читаєте. Писати коментарі можна під своїми дописами — відповідаючи підписникам.</span></p>` });
  }
  postMenu(id) {
    const s = this.s, sim = this.sim, p = s.posts.find(x => x.id === id); if (!p) return;
    actions([
      { t: 'Редагувати опис', icon: 'edit', on: () => this.editCaption(p) },
      p.ad && !p.adMarked && { t: 'Позначити як рекламу', icon: 'money', on: () => { sim.editPost(p.id, { adMarked: true }); toast('Тепер підписники бачать, що це реклама'); } },
      !p.t && { t: 'Опублікувати зараз', icon: 'send', on: () => { sim.publishNow(p); toast('Опубліковано'); } },
      p.t && { t: p.commentsOff ? 'Увімкнути коментарі' : 'Вимкнути коментарі', icon: 'comment', on: () => sim.editPost(p.id, { commentsOff: !p.commentsOff }) },
      p.kind === 'photo' && { t: 'Інформація про фото', icon: 'info', on: () => this.photoInfo(p) },
      { t: 'Видалити допис', icon: 'trash', danger: true, on: async () => { if (await confirm('Видалити допис?', 'Видалити', true, 'Вподобання й коментарі зникнуть. Але пам’ятайте: хтось міг уже зберегти знімок екрана.')) { sim.deletePost(p.id); this.back(); toast('Допис видалено'); } } },
    ]);
  }
  photoInfo(p) {
    const g = this.s.gallery.find(x => x.id === p.photo.gid);
    sheet({ title: 'Інформація про фото', html: `<div class="check"><p>${icon('image', 18)}<span>${esc(SCENES[g?.scene]?.t || 'Фото')}</span></p><p>${icon('location', 18)}<span>${g?.geo ? 'Місце зйомки збережено у файлі: <b>Київ, вул. Шкільна, 12</b>. Його може побачити будь-хто, хто збереже фото.' : 'Місце зйомки не збережено.'}</span></p></div>` });
  }
  editCaption(p) {
    const api = sheet({ title: 'Редагувати опис', html: `<textarea class="in" rows="5" maxlength="2200" aria-label="Опис" data-ed>${esc(p.caption)}</textarea><button class="btn primary big" data-save>Зберегти</button>`,
      onOpen: a => a.$('[data-save]').addEventListener('click', () => { const v = a.$('[data-ed]').value.trim(); this.sim.editPost(p.id, { caption: v, tags: [...new Set((v.match(/#[\p{L}\p{N}_]+/gu) || []).map(x => lc(x.slice(1))))] }); a.close(); toast('Опис оновлено'); }) });
    setTimeout(() => api.$('[data-ed]').focus(), 50);
  }
  commentMenu(pid, cid) {
    const s = this.s, sim = this.sim, p = s.posts.find(x => x.id === pid), c = p?.comments.find(x => x.id === cid); if (!c) return;
    const u = s.people[c.pid];
    actions([
      { t: c.pinned ? 'Відкріпити' : 'Закріпити вгорі', icon: 'pin', on: () => sim.pinComment(pid, cid) },
      { t: c.hidden ? 'Показати' : 'Приховати', icon: c.hidden ? 'eye' : 'eyeOff', on: () => sim.hideComment(pid, cid) },
      { t: 'Видалити коментар', icon: 'trash', on: () => sim.deleteComment(pid, cid) },
      u && { t: `Заблокувати @${u.nick}`, icon: 'block', danger: true, on: () => { sim.block(c.pid); toast('Заблоковано. Ця людина більше не зможе коментувати'); } },
      u && { t: 'Поскаржитися', icon: 'flag', danger: true, on: () => { sim.report(c.pid); toast('Скаргу надіслано'); } },
    ], u ? `@${u.nick}` : '');
  }
}

const adName = id => ({ olivets: 'Канцелярія «Олівець»', murchyk: 'Корм «Мурчик»', kolos: 'Пекарня «Колосок»', start: 'Спортшкола «Старт»', klik: 'Ігровий клуб «Клік»', fortuna: 'Ставки «Фортуна»', chai: 'Чай «Стрункість»' })[id] || id;
const meter = (t, v, ic, tip) => { v = Math.round(v); const c = v >= 60 ? 'ok' : v >= 30 ? 'mid' : 'low'; return `<div class="meter ${c}" title="${esc(tip)}">${icon(ic, 16)}<span>${t}</span><i><b style="width:${v}%"></b></i><small>${v}</small></div>`; };
export const logo = (s = 28) => `<svg class="logo" width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="lg${s}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ff7a45"/><stop offset=".5" stop-color="#e1306c"/><stop offset="1" stop-color="#8a3ffc"/></linearGradient></defs><rect x="2" y="2" width="44" height="44" rx="13" fill="url(#lg${s})"/><path d="M24 35s-10-6.2-13-12.6A7 7 0 0 1 24 15.5a7 7 0 0 1 13 6.9C34 28.8 24 35 24 35z" fill="#fff"/></svg>`;
