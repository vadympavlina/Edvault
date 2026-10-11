// Симулятор блогера · телефон: головний екран, застосунки, віртуальний час, збереження.
import { Sim, rng, newState, okState, clock, dayName, hourOf, dayOf, ago, num, plural, DAY } from './sim.js';
import { icon } from './icons.js';
import { photo, video, avatar, resetIds } from './art.js';
import { esc, h, setHost, banner, toast, hideToast, confirm, sheet, sw, morph } from './ui.js';
import { SCENES, CLIPS, NICHES, nicheOf } from './data.js';
import { loadMedia, importFile, removeMedia, clearMedia, mediaUsage, mediaUrl } from './media.js';
import { checks, fmtDur } from './quality.js';
import { fileBtn, galTitle, thumb, topicOptions } from './gal.js';
import { Likeer, logo, carIdx } from './likeer.js';
import { Tube, tubeLogo } from './tube.js';
import { renderCreate, createAct, createInput, createRange, createToggle, createSelect, openCreate, createImported } from './create.js';

const KEY = 'edvault-blogger';
const SPEEDS = [[0, 'Пауза'], [1, '1 хв/с'], [10, '10 хв/с'], [60, '1 год/с']];

/* ═════════ стан ═════════ */
let saved = null;
try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { saved = null; }
const broken = saved && !okState(saved.s);
const sim = new Sim(saved && !broken ? saved.s : newState());
const ui = { speed: saved?.speed ?? 10 };

// Тема нових файлів: від неї залежить, кому платформа покаже допис
function askTopic(items) {
  const def = sim.s.me?.niche || 'me', what = items.every(x => x.type === 'video') ? (items.length > 1 ? 'ці відео' : 'це відео') : items.length > 1 ? 'ці файли' : 'це фото';
  return new Promise(res => {
    let done = false;
    const pick = t => { if (done) return; done = true; res(t); };
    sheet({ title: `Про що ${what}?`, cls: 'topics', onClose: () => pick(def),
      html: `<p class="muted sm">Тема допомагає платформі показати допис тим, кому це цікаво. Її можна змінити пізніше в Галереї.</p><div class="niches sm">${[...Object.entries(NICHES), ['me', { t: 'Про мене / інше', icon: 'user' }]].map(([k, n]) => `<button class="niche${k === def ? ' on' : ''}" data-t="${k}">${icon(n.icon, 20)}<span>${n.t}</span></button>`).join('')}</div>`,
      onOpen: api => api.el.addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { pick(b.dataset.t); api.close(); } }) });
  });
}

// Шпалери: готові градієнти або власне фото (з затемненням, щоб білий текст читався)
const WALLS = { dawn: 'linear-gradient(160deg, #4b2bd1 0%, #b02a7a 55%, #ff8a4c 100%)', sea: 'linear-gradient(160deg, #0d3b66 0%, #146c94 55%, #19a7a0 100%)', forest: 'linear-gradient(160deg, #1b4332 0%, #2d6a4f 55%, #52796f 100%)', night: 'linear-gradient(160deg, #0b0f2e 0%, #283593 60%, #5e35b1 100%)', berry: 'linear-gradient(160deg, #4a148c 0%, #ad1457 60%, #d84315 100%)', graphite: 'linear-gradient(160deg, #1f2933 0%, #3e4c59 60%, #616e7c 100%)' };
const wallCss = w => WALLS[w] || (mediaUrl(w) ? `linear-gradient(rgba(0,0,0,.32), rgba(0,0,0,.42)), url(${mediaUrl(w)}) center / cover` : WALLS.dawn);

class Phone {
  constructor() {
    this.sim = sim; this.root = document.getElementById('app'); this.screen = document.getElementById('screen');
    setHost(this.screen);
    this.app = 'home'; this.args = {};
    this.apps = { likeer: new Likeer(this), tube: new Tube(this) };
    this.queued = false;
    // нові файли з телефону потрапляють туди, звідки їх додавали
    this.onImported = (ctx, items) => {
      if (ctx === 'create' && this.app === 'likeer' && this.apps.likeer.top.v === 'create') createImported(this.apps.likeer, items);
      else this.apps.tube?.imported?.(ctx, items);
      if (ctx === 'avatar' || ctx === 'wall') this.imported(ctx, items[0]);
    };
    // Лайкер має власні в’ю «створення»
    const lk = this.apps.likeer;
    lk.v_create = top => renderCreate(lk, top);
    this.bind();
  }
  open(app, args = {}) { this.app = app; this.args = args; if (app === 'likeer' && this.apps.likeer.top.v === 'activity') sim.s.unread.notifs = 0; this.render(true); }
  home() { this.app = 'home'; this.args = {}; this.render(true); }
  // перемальовування зі збереженням прокрутки й фокусу
  render(reset = false) {
    const root = this.root, scrolls = {};
    if (!reset) root.querySelectorAll('[data-scroll]').forEach(e => { scrolls[e.dataset.scroll] = e.scrollTop; });
    resetIds();
    const html = this.html(), view = this.app + ':' + (this.apps[this.app] ? this.apps[this.app].stack.map(x => x.v + (x.id || '')).join('/') : JSON.stringify(this.args));
    // інший екран — малюємо з нуля; той самий — оновлюємо лише змінені частини
    if (reset || view !== this.view) {
      const af = document.activeElement, keep = af && root.contains(af) && af.dataset.keep ? { k: af.dataset.keep, s: af.selectionStart, e: af.selectionEnd } : null;
      const vals = {}; root.querySelectorAll('[data-keep]').forEach(e => { vals[e.dataset.keep] = e.value; });
      root.innerHTML = html;
      root.querySelectorAll('[data-keep]').forEach(e => { if (e.dataset.keep in vals && !e.dataset.in) e.value = vals[e.dataset.keep]; });
      root.querySelectorAll('[data-scroll]').forEach(e => { if (e.dataset.scroll in scrolls) e.scrollTop = scrolls[e.dataset.scroll]; else if (e.dataset.bottom) e.scrollTop = e.scrollHeight; });
      root.querySelectorAll('.car[data-car]').forEach(c => { const i = carIdx.get(c.dataset.car); if (i) c.scrollLeft = i * c.clientWidth; });
      if (keep) { const e = root.querySelector(`[data-keep="${CSS.escape(keep.k)}"]`); if (e) { e.focus(); try { e.setSelectionRange(keep.s, keep.e); } catch { /* не текст */ } } }
    } else if (html !== this.lastHtml) {
      const bottoms = [...root.querySelectorAll('[data-bottom]')].filter(e => e.scrollHeight - e.scrollTop - e.clientHeight < 40);
      morph(root, html);
      bottoms.forEach(e => { e.scrollTop = e.scrollHeight; });
    }
    this.view = view; this.lastHtml = html;
    this.syncVideos();
    this.bar();
  }
  // власні відео: грати чи стояти (атрибут data-play), звук, межі обрізки
  syncVideos() {
    for (const v of this.root.querySelectorAll('video[data-own]')) {
      v.muted = v.dataset.sound !== '1';
      const want = v.dataset.play === '1', s0 = +v.dataset.s || 0;
      if (v.readyState >= 1 && v.currentTime < s0 - 0.3) v.currentTime = s0;
      if (want && v.paused) v.play().catch(() => { /* браузер може заборонити автозапуск */ });
      else if (!want && !v.paused) v.pause();
    }
  }
  later() { if (this.queued) return; this.queued = true; requestAnimationFrame(() => { this.queued = false; this.render(); }); }
  html() {
    if (this.apps[this.app]) return this.apps[this.app].render();
    const fn = this['a_' + this.app] || this.a_home;
    return fn.call(this, this.args);
  }
  get live() { return this.app === 'home' || this.app === 'mail' || (this.apps[this.app]?.live ?? false); }

  /* ── рядок стану ── */
  bar() {
    const s = sim.s;
    this.screen.querySelector('.sb-time').textContent = clock(s.t);
    this.screen.querySelector('.sb-bat').innerHTML = `${Math.round(s.energy)}% ${icon('battery', 18)}`;
    this.screen.classList.toggle('dark-bar', this.app === 'camera' || (this.app === 'likeer' && this.apps.likeer.top.v === 'story'));
    // пульт
    document.querySelector('.pn-time b').textContent = clock(s.t);
    document.querySelector('.pn-time small').textContent = `${dayName(s.t)}, день ${dayOf(s.t) + 1}`;
    const live = Math.max(0, s.followers - s.bots);
    document.querySelector('.pn-stats').innerHTML = s.me || s.tube ? `<div><b>${num(s.followers)}</b><small>у Лайкері${s.bots ? `, з них ${num(s.bots)} ботів` : ''}</small></div><div><b>${s.tube ? num(s.tube.subs) : '—'}</b><small>на каналі «Хвиля»</small></div><div><b>${Math.round(s.trust)}</b><small>довіра</small></div>` : '<p>Створіть профіль у «Лайкері» або канал у «Хвилі».</p>';
  }

  /* ═════════ Головний екран ═════════ */
  a_home() {
    const s = sim.s, mail = s.mail.filter(m => !m.read).length, dms = s.dms.reduce((a, d) => a + (d.blocked ? 0 : d.unread), 0), lkN = s.unread.notifs + dms;
    const today = s.posts.filter(p => p.t && dayOf(p.t) === dayOf(s.t)), ch = s.tube;
    const app = (k, t, ic, badge = 0) => `<button class="app-ic" data-act="ph.open" data-app="${k}" aria-label="${t}${badge ? `, нових: ${badge}` : ''}"><span class="ai ${k}">${ic}</span>${badge ? `<i class="dot">${badge > 99 ? '99+' : badge}</i>` : ''}<small>${t}</small></button>`;
    const tsum = ch ? ch.videos.reduce((a, v) => a + v.stats.views, 0) : 0;
    return `<div class="home" style="background:${wallCss(s.phone.wall)}"><div class="hm-clock"><b>${clock(s.t)}</b><span>${dayName(s.t)}</span></div>
      <div class="widgets"><button class="widget" data-act="ph.open" data-app="likeer"><div class="wg-h">${logo(18)}<b>Лайкер</b></div>${s.me ? `<div class="wg-n"><b>${num(s.followers)}</b><small>${plural(s.followers, 'підписник', 'підписники', 'підписників')}</small></div><p class="wg-t">${icon('eye', 13)}${num(today.reduce((a, p) => a + p.stats.views, 0))} сьогодні</p>` : '<p class="wg-t">Фото й дописи. Створіть профіль</p>'}</button>
        <button class="widget" data-act="ph.open" data-app="tube"><div class="wg-h">${tubeLogo(18)}<b>Хвиля</b></div>${ch ? `<div class="wg-n"><b>${num(ch.subs)}</b><small>${plural(ch.subs, 'підписник', 'підписники', 'підписників')}</small></div><p class="wg-t">${icon('play', 13)}${num(tsum)} переглядів</p>` : '<p class="wg-t">Відео й короткі ролики. Створіть канал</p>'}</button></div>
      <div class="apps">${app('likeer', 'Лайкер', logo(54), lkN)}${app('tube', 'Хвиля', tubeLogo(54), ch?.unread || 0)}${app('camera', 'Камера', icon('camera', 28))}${app('gallery', 'Галерея', icon('image', 28))}${app('ideas', 'Ідеї', icon('idea', 28), 0)}${app('mail', 'Пошта', icon('mail', 28), mail)}${app('settings', 'Налаштування', icon('gear', 28))}${app('help', 'Довідка', icon('info', 28))}</div></div>`;
  }

  /* ═════════ Налаштування телефону ═════════ */
  a_settings() {
    const s = sim.s, own = s.gallery.filter(g => g.own), photos = own.filter(g => g.type === 'photo').slice(0, 9), u = mediaUsage();
    const mb = x => (x / 1048576).toFixed(x > 1048576 * 10 ? 0 : 1).replace('.', ',');
    return `<div class="notes"><header class="ah"><button class="ib" data-act="ph.home" aria-label="Додому">${icon('back', 24)}</button><b class="ah-t">Налаштування</b></header><div class="scroll pad">
      <h3 class="sec">Шпалери головного екрана</h3><div class="walls">${Object.keys(WALLS).map(k => `<button class="wall${s.phone.wall === k ? ' on' : ''}" style="background:${WALLS[k]}" data-act="ph.wall" data-k="${k}" aria-label="Шпалери"></button>`).join('')}${photos.map(g => `<button class="wall${s.phone.wall === g.mid ? ' on' : ''}" data-act="ph.wall" data-k="${g.mid}" aria-label="Ваше фото">${photo(g, { thumb: true })}</button>`).join('')}${fileBtn('wall', 'Фото', 'wall add', 'image/*')}</div>
      <h3 class="sec">Мої файли</h3><div class="check"><p>${icon('image', 18)}<span>${own.filter(g => g.type === 'photo').length} фото й ${own.filter(g => g.type === 'video').length} відео · ${mb(u.bytes)} МБ</span></p><p>${icon('lock', 18)}<span>Файли зберігаються лише в цьому браузері на цьому пристрої. Їх ніхто не бачить і вони нікуди не надсилаються.</span></p></div>
      ${u.n ? `<button class="btn danger big" data-act="ph.clearOwn" style="margin-top:14px">${icon('trash', 18)}Видалити всі мої файли</button>` : ''}</div></div>`;
  }

  /* ═════════ Камера ═════════ */
  a_camera(a) {
    const s = sim.s, mode = a.mode || (a.returnTo === 'video' ? 'video' : 'photo'), scenes = Object.entries(SCENES), clips = Object.entries(CLIPS);
    const cur = mode === 'photo' ? (a.scene ||= 'cat') : (a.clip ||= 'laser');
    const night = hourOf(s.t) >= 21 || hourOf(s.t) < 6;
    const last = s.gallery[0];
    return `<div class="cam"><header class="cam-top"><button class="ib light" data-act="ph.camBack" aria-label="Закрити">${icon('close', 24)}</button><span class="grow"></span><button class="cam-geo${s.settings.geotag ? ' on' : ''}" data-act="ph.geo" aria-pressed="${s.settings.geotag}">${icon('location', 16)}${s.settings.geotag ? 'Місце: увімк.' : 'Місце: вимк.'}</button></header>
      <div class="cam-view">${mode === 'photo' ? photo({ scene: cur, v: 0.01, dark: night }) : video(cur)}${night && mode === 'photo' ? '<span class="cam-note">Темно: фото може вийти темним</span>' : ''}<i class="cam-grid" aria-hidden="true"></i></div>
      <div class="cam-what"><small>Що знімаємо</small><div class="cam-list">${(mode === 'photo' ? scenes : clips).map(([k, v]) => `<button class="${cur === k ? 'on' : ''}" data-act="ph.camPick" data-k="${k}">${esc(v.t)}</button>`).join('')}</div></div>
      <div class="cam-bot"><button class="cam-last" data-act="ph.open" data-app="gallery" aria-label="Галерея">${last ? (last.type === 'video' ? video(last.clip, { paused: true }) : photo(last)) : ''}</button>
        <button class="shutter${mode === 'video' ? ' rec' : ''}" data-act="ph.shoot" aria-label="${mode === 'photo' ? 'Зробити фото' : 'Записати відео'}"><i></i></button>
        <div class="cam-mode" role="tablist"><button class="${mode === 'photo' ? 'on' : ''}" data-act="ph.camMode" data-m="photo">Фото</button><button class="${mode === 'video' ? 'on' : ''}" data-act="ph.camMode" data-m="video">Відео</button></div></div></div>`;
  }

  /* ═════════ Галерея ═════════ */
  a_gallery(a) {
    const s = sim.s;
    if (a.id) {
      const g = s.gallery.find(x => x.id === a.id); if (!g) { a.id = null; return this.a_gallery(a); }
      const title = g.own ? (g.type === 'video' ? 'Ваше відео' : 'Ваше фото') : (g.type === 'video' ? CLIPS[g.clip] : SCENES[g.scene])?.t || '';
      const st = { ok: 'check', warn: 'alert', bad: 'alert' };
      return `<div class="gal"><header class="ah"><button class="ib" data-act="ph.galBack" aria-label="Назад">${icon('back', 24)}</button><b class="ah-t">${esc(title)}</b></header>
        <div class="scroll"><div class="gal-big${g.own ? ' fit' : ''}">${g.type === 'video' ? (g.own ? video(g, { live: true }) : video(g.clip)) : photo(g)}</div>
        <div class="pad">${g.own ? `<h3 class="sec">Перевірка кадру</h3><ul class="qc">${checks(g).map(([k, v, c]) => `<li class="${c}">${icon(st[c], 16)}<span><b>${k}</b>${esc(v)}</span></li>`).join('')}</ul>
          <label class="opt"><span class="opt-ic">${icon(nicheOf(g.topic).icon, 20)}</span><div><b>Тема</b><small>Від теми залежить, кому покажуть допис</small></div><select class="in sel" data-phsel="topic" data-id="${g.id}" aria-label="Тема">${topicOptions(g.topic)}</select></label>` : ''}
          <div class="check"><p>${icon('clock', 18)}<span>${dayOf(g.t) === dayOf(s.t) ? 'Сьогодні' : dayOf(g.t) === dayOf(s.t) - 1 ? 'Учора' : 'Раніше'}, ${clock(g.t)}${g.cam ? ' · знято камерою' : g.own ? ' · додано з пристрою' : ''}</span></p>
          ${g.own ? `<p>${icon('lock', 18)}<span>Файл зберігається лише в цьому браузері й нікуди не надсилається</span></p>` : `<p>${icon('location', 18)}<span>${g.geo ? '<b>Київ, вул. Шкільна, 12</b> — місце збережено у файлі' : 'Місце не збережено'}</span>${g.geo ? `<button class="btn sm" data-act="ph.strip" data-id="${g.id}">Видалити місце</button>` : ''}</p>`}
          ${g.type === 'photo' && g.dark ? `<p>${icon('moon', 18)}<span>Темний кадр — допоможе фільтр «Яскраво»</span></p>` : ''}</div>
          <div class="row2"><button class="btn primary" data-act="ph.galPost" data-id="${g.id}">${icon('plusSq', 18)}Опублікувати</button><button class="btn danger" data-act="ph.galDel" data-id="${g.id}">${icon('trash', 18)}Видалити</button></div></div></div></div>`;
    }
    const f = a.f || 'all', list = s.gallery.filter(g => f === 'all' || (f === 'own' ? g.own : g.type === f));
    return `<div class="gal"><header class="ah"><button class="ib" data-act="ph.home" aria-label="Додому">${icon('back', 24)}</button><b class="ah-t">Галерея</b><span class="grow"></span>${fileBtn('gallery', 'Додати')}</header>
      <div class="seg pad">${[['all', 'Усе'], ['photo', 'Фото'], ['video', 'Відео'], ['own', 'Мої файли']].map(([k, t]) => `<button class="${f === k ? 'on' : ''}" data-act="ph.galF" data-f="${k}">${t}</button>`).join('')}</div>
      <div class="scroll" data-scroll="gal">${f === 'own' && !list.length ? `<div class="empty">${icon('upload', 40)}<b>Додайте свої фото й відео</b><p>Натисніть «Додати» вгорі. Файли зберігаються лише в цьому браузері: їх ніхто не побачить, а симулятор покаже, як на них відреагували б підписники.</p></div>` : `<div class="pick-grid">${list.map(g => `<button class="pg" data-act="ph.galOpen" data-id="${g.id}" aria-label="${esc(galTitle(g))}">${thumb(g)}</button>`).join('')}</div>`}</div></div>`;
  }

  /* ═════════ Ідеї ═════════ */
  a_ideas() {
    const s = sim.s, src = { comment: 'з коментаря', me: '', trend: 'тренд' };
    return `<div class="notes"><header class="ah"><button class="ib" data-act="ph.home" aria-label="Додому">${icon('back', 24)}</button><b class="ah-t">Ідеї</b></header>
      <div class="cmp-row pad"><input class="in" data-keep="idea" placeholder="Нова ідея для допису…" maxlength="120" aria-label="Нова ідея"><button class="btn primary" data-act="ph.ideaAdd" aria-label="Додати ідею">${icon('plus', 18)}</button></div>
      <div class="scroll" data-scroll="ideas">${s.ideas.length ? s.ideas.map(i => `<div class="note${i.done ? ' done' : ''}"><button class="chk${i.done ? ' on' : ''}" data-act="ph.ideaDone" data-id="${i.id}" aria-label="${i.done ? 'Позначити як незроблену' : 'Позначити як зроблену'}">${i.done ? icon('check', 14) : ''}</button><p>${esc(i.text)}${src[i.src] ? `<small>${src[i.src]}</small>` : ''}</p>${i.done ? '' : `<button class="btn sm" data-act="ph.ideaPost" data-id="${i.id}">${icon('plusSq', 15)}Допис</button>`}<button class="ib sm" data-act="ph.ideaDel" data-id="${i.id}" aria-label="Видалити">${icon('trash', 18)}</button></div>`).join('')
        : `<div class="empty">${icon('idea', 40)}<b>Записуйте ідеї для дописів</b><p>Сюди також потрапляють прохання підписників, на які ви відповіли «Класна ідея», і ідеї, збережені в розділі «Тренди й ідеї».</p></div>`}</div></div>`;
  }

  /* ═════════ Пошта ═════════ */
  a_mail(a) {
    const s = sim.s;
    if (a.id) {
      const m = s.mail.find(x => x.id === a.id); if (!m) { a.id = null; return this.a_mail(a); }
      m.read = true;
      return `<div class="mail"><header class="ah"><button class="ib" data-act="ph.mailBack" aria-label="Назад">${icon('back', 24)}</button><b class="ah-t">Лист</b></header><div class="scroll pad"><h2 class="ml-s">${esc(m.subject)}</h2>
        <div class="ml-from">${m.from === 'platform' ? logo(36) : avatar({ name: m.from, color: '#455a64' }, 36)}<div><b>${m.from === 'platform' ? 'Лайкер' : esc(m.from)}</b><small>${m.from === 'platform' ? 'noreply@lajker.ua' : 'info@bank-hryvnia.ua'} · ${ago(s.t, m.t)}</small></div></div><div class="ml-body">${esc(m.body).replace(/\n/g, '<br>')}</div></div></div>`;
    }
    return `<div class="mail"><header class="ah"><button class="ib" data-act="ph.home" aria-label="Додому">${icon('back', 24)}</button><b class="ah-t">Пошта</b><span class="grow"></span><small class="muted">${s.me ? esc(s.me.email) : ''}</small></header>
      <div class="scroll" data-scroll="mail">${s.mail.length ? s.mail.map(m => `<button class="ml${m.read ? '' : ' un'}" data-act="ph.mailOpen" data-id="${m.id}">${m.from === 'platform' ? logo(40) : avatar({ name: m.from, color: '#455a64' }, 40)}<div><b>${m.from === 'platform' ? 'Лайкер' : esc(m.from)}</b><span>${esc(m.subject)}</span><small>${esc(m.body.split('\n')[0].slice(0, 60))}</small></div><time>${ago(s.t, m.t)}</time></button>`).join('') : `<div class="empty">${icon('mail', 40)}<b>Листів немає</b></div>`}</div></div>`;
  }

  /* ═════════ Довідка ═════════ */
  a_help() {
    const q = (t, b) => `<details class="faq"><summary>${t}</summary><p>${b}</p></details>`;
    return `<div class="notes"><header class="ah"><button class="ib" data-act="ph.home" aria-label="Додому">${icon('back', 24)}</button><b class="ah-t">Довідка</b></header><div class="scroll pad">
      <p>Це навчальний телефон із соцмережею <b>Лайкер</b> і відеоплатформою <b>Хвиля</b>. Усі люди, коментарі й повідомлення вигадані — сміливо пробуйте.</p>
      ${q('Як додати свої фото й відео?', 'Галерея → «Додати» (або «З телефону» під час створення допису). Файли зберігаються лише в цьому браузері й нікуди не надсилаються. Симулятор вимірює світло, чіткість, кольори, а у відео — чи щось відбувається з перших секунд, і на основі цього «глядачі» реагують на ваш допис.')}
      ${q('Як зробити карусель?', 'Під час створення фото натисніть «Кілька» й вибирайте фото по черзі (до 10). Перше фото побачать у стрічці, тож ставте найкраще першим. Карусель довше розглядають і частіше зберігають.')}
      ${q('Що таке CTR і утримання у «Хвилі»?', 'CTR (клікабельність) — яка частка людей, що побачили обкладинку, натиснула на відео. Його піднімають яскрава обкладинка з коротким написом і зрозумілий заголовок. Утримання — скільки відео в середньому дивляться. Його псує довгий нудний початок.')}
      ${q('Як працює час?', 'Час на телефоні йде швидше, ніж насправді. Швидкість змінюється на панелі праворуч. Вподобання й коментарі набираються поступово — особливо в перші години після публікації.')}
      ${q('Від чого залежать перегляди?', 'Від якості фото чи відео, опису, хештегів, часу публікації, теми каналу й довіри до вас. Після публікації відкрийте «Статистика допису» → «Що вплинуло на результат».')}
      ${q('Що показує батарея вгорі?', 'Заряд батареї — це ваша енергія блогера. Кожен допис забирає сили, а відпочинок (особливо вночі) їх повертає. Коли енергії мало, дописи виходять гіршими.')}
      ${q('Що таке довіра?', 'Наскільки підписники вам вірять. Росте від чесності й ввічливих відповідей, падає від грубості, обману, неправдивої або непозначеної реклами й купівлі підписників.')}
      ${q('Що робити з образливими коментарями?', 'Не відповідати грубістю. Можна приховати коментар, заблокувати автора або поскаржитися. У налаштуваннях є фільтр образливих коментарів.')}
      ${q('Якщо пише незнайомець?', 'Не називайте школу, адресу, вік і не надсилайте фото. Заблокуйте й розкажіть дорослим. Можна дозволити повідомлення лише від підписників.')}
      ${q('Як не потрапити на шахраїв?', 'Справжня підтримка ніколи не просить пароль у Директі. Перевіряйте адресу сайту й профіль, який пише. Справжні розіграші не просять оплатити «доставку».')}
      <button class="btn danger big" data-act="ph.reset">Почати все заново</button></div></div>`;
  }

  /* ═════════ «Браузер» для посилань із повідомлень ═════════ */
  a_web(a) {
    if (a.page === 'phish') return `<div class="web"><div class="web-bar"><button class="ib" data-act="ph.webClose" aria-label="Закрити">${icon('close', 22)}</button><span class="url">${icon('lock', 13)}likeer-help.com/verify</span></div>
      <div class="scroll pad web-body"><div class="center">${logo(64)}<h2>Lajker</h2><p class="muted">Підтвердження облікового запису</p></div>
      <p class="warnbox plain">Ваш профіль буде видалено через <b>23:59:41</b>. Підтвердіть пароль, щоб скасувати видалення.</p>
      <label class="fl"><span>Ім’я користувача</span><input class="in" value="${esc(sim.s.me?.nick || '')}" disabled></label><label class="fl"><span>Пароль</span><input class="in" type="password" data-keep="ph-pass" autocomplete="off"></label>
      <button class="btn primary big" data-act="ph.phishGo">Підтвердити</button><p class="muted sm center">© 2024 Lajker Inc.</p></div></div>`;
    return `<div class="web"><div class="web-bar"><button class="ib" data-act="ph.webClose" aria-label="Закрити">${icon('close', 22)}</button><span class="url">${icon('lock', 13)}murko-pryz.online/oplata</span></div>
      <div class="scroll pad web-body"><h2>Вітаємо з перемогою!</h2><div class="prize">${icon('phone', 54)}<b>Смартфон «Галактика»</b><small>Залишилось 2 призи</small></div><p>Оплатіть лише доставку — <b>99 грн</b>.</p>
      <label class="fl"><span>Номер картки</span><input class="in" data-keep="card" inputmode="numeric" maxlength="19" placeholder="0000 0000 0000 0000"></label><div class="row2"><label class="fl"><span>Термін</span><input class="in" placeholder="ММ/РР" maxlength="5"></label><label class="fl"><span>CVV</span><input class="in" type="password" maxlength="3" placeholder="•••"></label></div>
      <button class="btn primary big" data-act="ph.payGo">Оплатити 99 грн</button></div></div>`;
  }

  /* ═════════ події ═════════ */
  bind() {
    const root = this.screen;
    root.addEventListener('click', e => {
      const el = e.target.closest('[data-act]'); if (!el || el.disabled || !root.contains(el)) return;
      const [ns, name] = el.dataset.act.split('.');
      if (ns === 'lk') this.apps.likeer.act(name, el, e);
      else if (ns === 'cr') createAct(this.apps.likeer, name, el);
      else if (ns === 'ph') this.act(name, el);
      else if (ns === 'tb') this.apps.tube.act(name, el);
      this.save();
    });
    root.addEventListener('click', e => { const t = e.target.closest('[data-sw]'); if (!t) return; const k = t.dataset.sw; if (k.startsWith('cr.')) createToggle(this.apps.likeer, k); else this.apps.likeer.toggle(k); });
    root.addEventListener('input', e => {
      const el = e.target, k = el.dataset.in;
      if (k) { if (k.startsWith('cr.')) createInput(this.apps.likeer, k, el); else if (k.startsWith('tb.')) this.apps.tube.input(k, el); else this.apps.likeer.input(k, el); }
    });
    root.addEventListener('change', e => {
      const el = e.target;
      if (el.dataset.rng) createRange(this.apps.likeer, el.dataset.rng, el);
      if (el.dataset.sel) this.apps.likeer.select(el.dataset.sel, el.value);
      if (el.dataset.crsel) createSelect(this.apps.likeer, el.dataset.crsel, el.value);
      if (el.dataset.tbsel) this.apps.tube.select(el.dataset.tbsel, el.value);
      if (el.dataset.phsel === 'topic') { sim.setTopic(el.dataset.id, el.value); this.render(); this.save(); }
      if (el.dataset.file) { const files = [...el.files]; el.value = ''; this.importFiles(files, el.dataset.file); }
    });
    // карусель: лічильник і крапки стежать за прокруткою
    root.addEventListener('scroll', e => {
      const c = e.target; if (!c.classList?.contains('car')) return;
      const i = Math.round(c.scrollLeft / Math.max(1, c.clientWidth)), id = c.dataset.car;
      if ((carIdx.get(id) || 0) === i) return;
      carIdx.set(id, i); this.render();
    }, true);
    // обрізане відео грає лише вибраний шматок
    const trim = e => { const v = e.target; if (v.tagName !== 'VIDEO' || !v.dataset.own) return; const s0 = +v.dataset.s || 0, e0 = +v.dataset.e || Infinity; if (v.currentTime >= e0 - 0.05 || v.currentTime < s0 - 0.3) v.currentTime = s0; };
    root.addEventListener('timeupdate', trim, true); root.addEventListener('loadedmetadata', trim, true);
    root.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute('role') === 'button' && e.target.dataset.act) { e.preventDefault(); e.target.click(); return; }
      if (e.key !== 'Enter' || e.shiftKey || e.target.tagName === 'TEXTAREA') return;
      const k = e.target.dataset.keep || '';
      const btn = k === 'tbcm' ? '[data-act="tb.send"]' : k === 'cm' ? '[data-act="lk.sendReply"]' : k.startsWith('dm-') ? '[data-act="lk.dmSend"]' : k === 'idea' ? '[data-act="ph.ideaAdd"]' : k === 'ph-pass' ? '[data-act="ph.phishGo"]' : null;
      if (btn) { e.preventDefault(); this.root.querySelector(btn)?.click(); }
    });
    this.screen.querySelector('.homebar').addEventListener('click', () => { this.screen.querySelectorAll('.sh-back, .cf-back').forEach(x => (x._api ? x._api.close() : x.remove())); this.home(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { const sh = this.screen.querySelector('.sh-back:last-of-type'); if (sh) sh.click(); } });
  }
  act(name, el) {
    const s = sim.s, a = this.args;
    const A = {
      open: () => this.open(el.dataset.app),
      home: () => this.home(),
      camBack: () => a.returnTo ? this.open('likeer') : this.home(),
      camPick: () => { if ((a.mode || (a.returnTo === 'video' ? 'video' : 'photo')) === 'photo') a.scene = el.dataset.k; else a.clip = el.dataset.k; this.render(); },
      camMode: () => { a.mode = el.dataset.m; this.render(); },
      geo: () => { s.settings.geotag = !s.settings.geotag; this.render(); toast(s.settings.geotag ? 'Місце зйомки записуватиметься у фото' : 'Місце зйомки більше не записується'); },
      shoot: () => {
        const mode = a.mode || (a.returnTo === 'video' ? 'video' : 'photo');
        const g = mode === 'photo' ? sim.takePhoto(a.scene || 'cat') : sim.recordVideo(a.clip || 'laser');
        this.screen.classList.add('flash'); setTimeout(() => this.screen.classList.remove('flash'), 160);
        if (a.returnTo) { const lk = this.apps.likeer, d = lk.top.d; this.open('likeer'); if (d) { if (d.kind !== 'story') d.kind = mode; createImported(lk, [g]); if (d.kind !== 'story') d.step = 'edit'; this.render(true); } toast(mode === 'photo' ? 'Фото зроблено' : 'Відео записано'); return; }
        this.render(); toast(mode === 'photo' ? (g.dark ? 'Фото збережено. Вийшло темнувато' : 'Фото збережено в Галерею') : 'Відео збережено в Галерею');
      },
      galF: () => { a.f = el.dataset.f; this.render(true); },
      galOpen: () => { a.id = el.dataset.id; this.render(true); },
      galBack: () => { a.id = null; this.render(); },
      strip: () => { sim.stripGeo(el.dataset.id); toast('Місце видалено з файлу'); this.render(); },
      galPost: () => { if (!s.me) { this.open('likeer'); toast('Спершу створіть профіль'); return; } openCreate(this, { gid: el.dataset.id }); },
      galDel: async () => {
        const g = s.gallery.find(x => x.id === el.dataset.id); if (!g) return;
        if (!(await confirm('Видалити з галереї?', 'Видалити', true, g.own && sim.mediaInUse(g.mid) && s.posts.some(p => JSON.stringify([p.photo, p.photos, p.video]).includes(g.mid)) ? 'Опубліковані дописи з цим файлом залишаться.' : ''))) return;
        sim.deletePhoto(g.id); a.id = null; this.render(); this.gc(g);
      },
      ideaAdd: () => { const inp = this.root.querySelector('[data-keep="idea"]'), t = inp.value.trim(); if (!t) return; inp.value = ''; sim.addIdea(t); this.render(); },
      ideaDone: () => { const i = s.ideas.find(x => x.id === el.dataset.id); if (i) { i.done = !i.done; this.render(); } },
      ideaPost: () => { if (!s.me) { this.open('likeer'); toast('Спершу створіть профіль'); return; } const i = s.ideas.find(x => x.id === el.dataset.id); if (i) openCreate(this, { idea: i }); },
      ideaDel: () => { s.ideas = s.ideas.filter(x => x.id !== el.dataset.id); this.render(); },
      mailOpen: () => { a.id = el.dataset.id; this.render(true); },
      mailBack: () => { a.id = null; this.render(); },
      webClose: () => { s.flags.phishPage = false; s.flags.payPage = null; this.open('likeer'); },
      phishGo: () => { const p = this.root.querySelector('[data-keep="ph-pass"]').value; if (!p) return toast('Введіть пароль'); sim.phishLogin(p); this.open('likeer'); toast('Дякуємо! Ваш профіль підтверджено'); },
      payGo: () => { const c = this.root.querySelector('[data-keep="card"]').value.replace(/\D/g, ''); if (c.length < 12) return toast('Введіть номер картки'); sim.payScam(c); this.open('likeer'); toast('Оплату прийнято. Очікуйте доставку'); },
      wall: () => { s.phone.wall = el.dataset.k; this.render(); },
      clearOwn: async () => {
        if (!(await confirm('Видалити всі свої файли?', 'Видалити', true, 'Фото й відео зникнуть із Галереї. У вже опублікованих дописах і відео замість них буде заглушка.'))) return;
        s.gallery = s.gallery.filter(g => !g.own); if (!WALLS[s.phone.wall]) s.phone.wall = 'dawn';
        if (s.me) s.me.avatar.img = ''; if (s.tube) { s.tube.avatar.img = ''; s.tube.banner.img = ''; }
        await clearMedia(); this.render(true); this.save(); toast('Усі ваші файли видалено');
      },
      reset: async () => { if (await confirm('Почати все заново?', 'Почати заново', true, 'Профіль, дописи й галерея повернуться до початкового стану.')) this.resetAll(); },
    };
    A[name]?.();
  }
  imported(ctx, g) {
    if (!g) return;
    const lk = this.apps.likeer;
    if (ctx === 'avatar' && this.app === 'likeer' && lk.top.v === 'editProfile') { lk.top.d.img = g.mid; this.render(); }
    if (ctx === 'wall') { sim.s.phone.wall = g.mid; this.render(); toast('Шпалери змінено'); }
  }
  // файл більше ніде не потрібен — звільняємо місце в браузері
  gc(g) { if (g?.own && g.mid && !sim.mediaInUse(g.mid)) removeMedia(g.mid); }

  // Додавання власних фото й відео. ctx — звідки: gallery, create, tube, avatar, banner, wall
  async importFiles(files, ctx) {
    if (!files.length) return;
    const single = ['avatar', 'banner', 'wall', 'thumb', 'tavatar'].includes(ctx), onlyPhoto = single;
    if (files.length > 20) { toast('Можна додати до 20 файлів за раз'); files = files.slice(0, 20); }
    if (single) files = files.slice(0, 1);
    toast(files.length === 1 ? 'Обробляю файл…' : `Обробляю ${files.length} ${plural(files.length, 'файл', 'файли', 'файлів')}…`);
    const added = [], errs = [];
    for (const f of files) {
      try { if (onlyPhoto && !/^image\//.test(f.type) && !/\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name)) throw new Error('Тут потрібне фото'); added.push(await importFile(f)); }
      catch (e) { errs.push(e.message); }
    }
    hideToast();
    const report = () => { if (errs.length) sheet({ title: added.length ? 'Деякі файли не додано' : 'Файл не додано', html: `${added.length ? `<p class="muted sm">Додано: ${added.length}. Не вдалося:</p>` : ''}<ul class="errs">${errs.map(t => `<li>${icon('alert', 16)}<span>${esc(t)}</span></li>`).join('')}</ul>` }); };
    if (!added.length) { report(); return; }
    const topic = single ? 'me' : await askTopic(added);
    const items = added.map(it => sim.addOwn(it, topic));
    this.save();
    this.onImported?.(ctx, items);
    if (ctx === 'gallery') { this.args.f = 'own'; this.render(true); }
    if (errs.length) report(); else if (ctx === 'gallery') toast(items.length === 1 ? 'Додано в Галерею' : `Додано ${items.length} ${plural(items.length, 'файл', 'файли', 'файлів')}`);
  }
  resetAll() { clearMedia(); try { localStorage.removeItem(KEY); } catch { /* ігноруємо */ } sim.s = newState(); sim.r = rng(sim.s); sim.refreshFeed(); sim.seedGallery(); this.apps.likeer = new Likeer(this); this.apps.likeer.v_create = top => renderCreate(this.apps.likeer, top); this.apps.tube = new Tube(this); this.home(); this.save(); }
  save() { clearTimeout(this.saveT); this.saveT = setTimeout(() => this.saveNow(), 600); }
  saveNow() { clearTimeout(this.saveT); try { localStorage.setItem(KEY, JSON.stringify({ s: sim.s, speed: ui.speed })); } catch { /* сховище недоступне */ } }
}

await loadMedia();
const phone = new Phone();
window.Blogger = { sim, phone, ui };

/* ═════════ реакція на події симуляції ═════════ */
let lastBanner = 0;
sim.on(w => {
  if (w === 'tick') { phone.bar(); if (phone.live) phone.later(); return; }
  if (w === 'open-phish') { phone.open('web', { page: 'phish' }); return; }
  if (w === 'open-pay') { phone.open('web', { page: 'pay' }); return; }
  if (w === 'notif') {
    const n = sim.s.notifs[0], now = performance.now();
    const loud = ['dm', 'star', 'trophy', 'alert', 'shield', 'comment', 'moon', 'battery'].includes(n.icon);
    if (loud && now - lastBanner > 3500 && !(phone.app === 'likeer' && phone.apps.likeer.top.v === 'activity')) {
      lastBanner = now;
      banner(`${logo(22)}<span><b>Лайкер</b>${esc(n.text.slice(0, 90))}</span>`, () => { phone.open('likeer'); phone.apps.likeer.act('notif', { dataset: { id: n.id } }); });
    }
  }
  if (w === 'tnotif') {
    const n = sim.s.tube.notifs[0], now = performance.now();
    if (n && ['comment', 'star', 'trophy'].includes(n.icon) && now - lastBanner > 3500 && phone.app !== 'tube') {
      lastBanner = now;
      banner(`${tubeLogo(22)}<span><b>Хвиля</b>${esc(n.text.slice(0, 90))}</span>`, () => { phone.open('tube'); phone.apps.tube.act('notif', { dataset: { id: n.id } }); });
    }
  }
  if (w === 'mail') { const m = sim.s.mail[0]; banner(`<span class="bn-ic">${icon('mail', 18)}</span><span><b>Пошта</b>${esc(m.subject)}</span>`, () => phone.open('mail', { id: m.id })); }
  phone.later(); phone.save();
});

/* ═════════ віртуальний час і пульт ═════════ */
const panel = document.querySelector('.panel');
panel.querySelector('.pn-speed').innerHTML = SPEEDS.map(([v, t]) => `<button data-speed="${v}" aria-pressed="${ui.speed === v}">${v ? icon(v >= 60 ? 'fire' : 'play', 14, true) : icon('pause', 14, true)}${t}</button>`).join('');
panel.addEventListener('click', e => {
  const b = e.target.closest('[data-speed]'); if (b) { ui.speed = +b.dataset.speed; panel.querySelectorAll('[data-speed]').forEach(x => x.setAttribute('aria-pressed', x === b)); phone.save(); return; }
  const j = e.target.closest('[data-jump]'); if (j) { jump(j.dataset.jump); return; }
  if (e.target.closest('[data-reset]')) phone.act('reset', e.target);
});
function jump(k) {
  const t = sim.s.t, h = hourOf(t);
  const target = k === 'hour' ? 60 : k === 'evening' ? ((h < 18 ? 18 : 42) - h) * 60 - (t % 60) : k === 'morning' ? ((h < 7 ? 7 : 31) - h) * 60 - (t % 60) : DAY;
  sim.advance(Math.max(5, Math.round(target)));
  phone.save();
}
setInterval(() => { if (!ui.speed || document.hidden) return; if (phone.app === 'likeer' && sim.s.me) sim.useTime(ui.speed); sim.advance(ui.speed); }, 1000);
addEventListener('pagehide', () => phone.saveNow());
document.addEventListener('visibilitychange', () => { if (document.hidden) phone.saveNow(); });

phone.render(true);
if (broken) toast('Збереження було пошкоджене, тому все почалося заново');
document.getElementById('boot')?.remove();
