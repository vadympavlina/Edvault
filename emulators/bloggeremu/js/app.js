// Симулятор блогера · телефон: головний екран, застосунки, віртуальний час, збереження.
import { Sim, rng, newState, okState, clock, dayName, hourOf, dayOf, ago, num, plural, DAY } from './sim.js';
import { icon } from './icons.js';
import { photo, video, avatar, resetIds } from './art.js';
import { esc, h, setHost, banner, toast, confirm, sheet, sw, morph } from './ui.js';
import { SCENES, CLIPS, nicheOf } from './data.js';
import { Likeer, logo } from './likeer.js';
import { renderCreate, createAct, createInput, createRange, createToggle, createSelect, openCreate } from './create.js';

const KEY = 'edvault-blogger';
const SPEEDS = [[0, 'Пауза'], [1, '1 хв/с'], [10, '10 хв/с'], [60, '1 год/с']];

/* ═════════ стан ═════════ */
let saved = null;
try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { saved = null; }
const broken = saved && !okState(saved.s);
const sim = new Sim(saved && !broken ? saved.s : newState());
const ui = { speed: saved?.speed ?? 10 };

class Phone {
  constructor() {
    this.sim = sim; this.root = document.getElementById('app'); this.screen = document.getElementById('screen');
    setHost(this.screen);
    this.app = 'home'; this.args = {};
    this.apps = { likeer: new Likeer(this) };
    this.queued = false;
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
    const html = this.html(), view = this.app + ':' + (this.app === 'likeer' ? this.apps.likeer.stack.map(x => x.v + (x.id || '')).join('/') : JSON.stringify(this.args));
    // інший екран — малюємо з нуля; той самий — оновлюємо лише змінені частини
    if (reset || view !== this.view) {
      const af = document.activeElement, keep = af && root.contains(af) && af.dataset.keep ? { k: af.dataset.keep, s: af.selectionStart, e: af.selectionEnd } : null;
      const vals = {}; root.querySelectorAll('[data-keep]').forEach(e => { vals[e.dataset.keep] = e.value; });
      root.innerHTML = html;
      root.querySelectorAll('[data-keep]').forEach(e => { if (e.dataset.keep in vals && !e.dataset.in) e.value = vals[e.dataset.keep]; });
      root.querySelectorAll('[data-scroll]').forEach(e => { if (e.dataset.scroll in scrolls) e.scrollTop = scrolls[e.dataset.scroll]; else if (e.dataset.bottom) e.scrollTop = e.scrollHeight; });
      if (keep) { const e = root.querySelector(`[data-keep="${CSS.escape(keep.k)}"]`); if (e) { e.focus(); try { e.setSelectionRange(keep.s, keep.e); } catch { /* не текст */ } } }
    } else if (html !== this.lastHtml) {
      const bottoms = [...root.querySelectorAll('[data-bottom]')].filter(e => e.scrollHeight - e.scrollTop - e.clientHeight < 40);
      morph(root, html);
      bottoms.forEach(e => { e.scrollTop = e.scrollHeight; });
    }
    this.view = view; this.lastHtml = html;
    this.bar();
  }
  later() { if (this.queued) return; this.queued = true; requestAnimationFrame(() => { this.queued = false; this.render(); }); }
  html() {
    if (this.app === 'likeer') return this.apps.likeer.render();
    const fn = this['a_' + this.app] || this.a_home;
    return fn.call(this, this.args);
  }
  get live() { return this.app === 'home' || this.app === 'mail' || (this.app === 'likeer' && this.apps.likeer.live); }

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
    document.querySelector('.pn-stats').innerHTML = s.me ? `<div><b>${num(s.followers)}</b><small>підписників${s.bots ? `, з них ${num(s.bots)} ботів` : ''}</small></div><div><b>${s.posts.filter(p => p.t).length}</b><small>дописів</small></div><div><b>${Math.round(s.trust)}</b><small>довіра</small></div>` : '<p>Створіть профіль у застосунку «Лайкер».</p>';
  }

  /* ═════════ Головний екран ═════════ */
  a_home() {
    const s = sim.s, mail = s.mail.filter(m => !m.read).length, dms = s.dms.reduce((a, d) => a + (d.blocked ? 0 : d.unread), 0), lkN = s.unread.notifs + dms;
    const today = s.posts.filter(p => p.t && dayOf(p.t) === dayOf(s.t));
    const app = (k, t, ic, badge = 0) => `<button class="app-ic" data-act="ph.open" data-app="${k}" aria-label="${t}${badge ? `, нових: ${badge}` : ''}"><span class="ai ${k}">${ic}</span>${badge ? `<i class="dot">${badge > 99 ? '99+' : badge}</i>` : ''}<small>${t}</small></button>`;
    const tr = sim.trend;
    return `<div class="home"><div class="hm-clock"><b>${clock(s.t)}</b><span>${dayName(s.t)}</span></div>
      <button class="widget" data-act="ph.open" data-app="likeer">${s.me ? `<div class="wg-h">${logo(20)}<b>@${esc(s.me.nick)}</b></div><div class="wg-n"><div><b>${num(s.followers)}</b><small>підписників</small></div><div><b>${num(today.reduce((a, p) => a + p.stats.views, 0))}</b><small>переглядів сьогодні</small></div></div><p class="wg-t">${icon('fire', 14)}Тренд дня: <b>#${esc(tr.tag)}</b></p>`
        : `<div class="wg-h">${logo(20)}<b>Лайкер</b></div><p class="wg-t">Створіть профіль і опублікуйте перший допис.</p>`}</button>
      <div class="apps">${app('likeer', 'Лайкер', logo(54), lkN)}${app('camera', 'Камера', icon('camera', 28))}${app('gallery', 'Галерея', icon('image', 28))}${app('ideas', 'Ідеї', icon('idea', 28), 0)}${app('mail', 'Пошта', icon('mail', 28), mail)}${app('help', 'Довідка', icon('info', 28))}</div></div>`;
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
      const sc = g.type === 'video' ? CLIPS[g.clip] : SCENES[g.scene];
      return `<div class="gal"><header class="ah"><button class="ib" data-act="ph.galBack" aria-label="Назад">${icon('back', 24)}</button><b class="ah-t">${esc(sc?.t || '')}</b></header>
        <div class="scroll"><div class="gal-big">${g.type === 'video' ? video(g.clip) : photo(g)}</div>
        <div class="pad"><div class="check"><p>${icon('clock', 18)}<span>${dayOf(g.t) === dayOf(s.t) ? 'Сьогодні' : dayOf(g.t) === dayOf(s.t) - 1 ? 'Учора' : 'Раніше'}, ${clock(g.t)}${g.cam ? ' · знято камерою' : ''}</span></p>
          <p>${icon('location', 18)}<span>${g.geo ? '<b>Київ, вул. Шкільна, 12</b> — місце збережено у файлі' : 'Місце не збережено'}</span>${g.geo ? `<button class="btn sm" data-act="ph.strip" data-id="${g.id}">Видалити місце</button>` : ''}</p>
          ${g.type === 'photo' && g.dark ? `<p>${icon('moon', 18)}<span>Темний кадр — допоможе фільтр «Яскраво»</span></p>` : ''}</div>
          <div class="row2"><button class="btn primary" data-act="ph.galPost" data-id="${g.id}">${icon('plusSq', 18)}Опублікувати</button><button class="btn danger" data-act="ph.galDel" data-id="${g.id}">${icon('trash', 18)}Видалити</button></div></div></div></div>`;
    }
    const f = a.f || 'all', list = s.gallery.filter(g => f === 'all' || g.type === f);
    return `<div class="gal"><header class="ah"><button class="ib" data-act="ph.home" aria-label="Додому">${icon('back', 24)}</button><b class="ah-t">Галерея</b><span class="grow"></span><small class="muted">${list.length}</small></header>
      <div class="seg pad">${[['all', 'Усе'], ['photo', 'Фото'], ['video', 'Відео']].map(([k, t]) => `<button class="${f === k ? 'on' : ''}" data-act="ph.galF" data-f="${k}">${t}</button>`).join('')}</div>
      <div class="scroll" data-scroll="gal"><div class="pick-grid">${list.map(g => `<button class="pg" data-act="ph.galOpen" data-id="${g.id}" aria-label="${esc(g.type === 'video' ? CLIPS[g.clip].t : SCENES[g.scene]?.t || '')}">${g.type === 'video' ? video(g.clip, { paused: true }) + `<i class="pg-dur">0:${CLIPS[g.clip].dur}</i>` : photo(g)}${g.geo ? `<i class="pg-geo">${icon('location', 12)}</i>` : ''}</button>`).join('')}</div></div></div>`;
  }

  /* ═════════ Ідеї ═════════ */
  a_ideas() {
    const s = sim.s, src = { comment: 'з коментаря', me: '', trend: 'тренд' };
    return `<div class="notes"><header class="ah"><button class="ib" data-act="ph.home" aria-label="Додому">${icon('back', 24)}</button><b class="ah-t">Ідеї</b></header>
      <div class="cmp-row pad"><input class="in" data-keep="idea" placeholder="Нова ідея для допису…" maxlength="120" aria-label="Нова ідея"><button class="btn primary" data-act="ph.ideaAdd" aria-label="Додати ідею">${icon('plus', 18)}</button></div>
      <div class="scroll" data-scroll="ideas">${s.ideas.length ? s.ideas.map(i => `<div class="note${i.done ? ' done' : ''}"><button class="chk${i.done ? ' on' : ''}" data-act="ph.ideaDone" data-id="${i.id}" aria-label="${i.done ? 'Позначити як незроблену' : 'Позначити як зроблену'}">${i.done ? icon('check', 14) : ''}</button><p>${esc(i.text)}${src[i.src] ? `<small>${src[i.src]}</small>` : ''}</p><button class="ib sm" data-act="ph.ideaDel" data-id="${i.id}" aria-label="Видалити">${icon('trash', 18)}</button></div>`).join('')
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
      <p>Це навчальний телефон із соцмережею <b>Лайкер</b>. Усі люди, коментарі й повідомлення вигадані — сміливо пробуйте.</p>
      ${q('Як працює час?', 'Час на телефоні йде швидше, ніж насправді. Швидкість змінюється на панелі праворуч. Вподобання й коментарі набираються поступово — особливо в перші години після публікації.')}
      ${q('Від чого залежать перегляди?', 'Від якості фото чи відео, опису, хештегів, часу публікації, теми каналу й довіри до вас. Після публікації відкрийте «Статистика допису» → «Що вплинуло на результат».')}
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
      this.save();
    });
    root.addEventListener('click', e => { const t = e.target.closest('[data-sw]'); if (!t) return; const k = t.dataset.sw; if (k.startsWith('cr.')) createToggle(this.apps.likeer, k); else this.apps.likeer.toggle(k); });
    root.addEventListener('input', e => {
      const el = e.target, k = el.dataset.in;
      if (k) { if (k.startsWith('cr.')) createInput(this.apps.likeer, k, el); else this.apps.likeer.input(k, el); }
    });
    root.addEventListener('change', e => {
      const el = e.target;
      if (el.dataset.rng) createRange(this.apps.likeer, el.dataset.rng, el);
      if (el.dataset.sel) this.apps.likeer.select(el.dataset.sel, el.value);
      if (el.dataset.crsel) createSelect(this.apps.likeer, el.dataset.crsel, el.value);
    });
    root.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.shiftKey || e.target.tagName === 'TEXTAREA') return;
      const k = e.target.dataset.keep || '';
      const btn = k === 'cm' ? '[data-act="lk.sendReply"]' : k.startsWith('dm-') ? '[data-act="lk.dmSend"]' : k === 'idea' ? '[data-act="ph.ideaAdd"]' : k === 'ph-pass' ? '[data-act="ph.phishGo"]' : null;
      if (btn) { e.preventDefault(); this.root.querySelector(btn)?.click(); }
    });
    this.screen.querySelector('.homebar').addEventListener('click', () => { this.screen.querySelectorAll('.sh-back, .cf-back').forEach(x => x.remove()); this.home(); });
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
        if (a.returnTo) { const lk = this.apps.likeer, d = lk.top.d; if (d) { d.gid = g.id; d.kind = mode; if (mode === 'video') { d.clip = g.clip; d.start = 0; d.end = null; } d.step = 'edit'; } this.open('likeer'); toast(mode === 'photo' ? 'Фото зроблено' : 'Відео записано'); return; }
        this.render(); toast(mode === 'photo' ? (g.dark ? 'Фото збережено. Вийшло темнувато' : 'Фото збережено в Галерею') : 'Відео збережено в Галерею');
      },
      galF: () => { a.f = el.dataset.f; this.render(true); },
      galOpen: () => { a.id = el.dataset.id; this.render(true); },
      galBack: () => { a.id = null; this.render(); },
      strip: () => { sim.stripGeo(el.dataset.id); toast('Місце видалено з файлу'); this.render(); },
      galPost: () => { if (!s.me) { this.open('likeer'); toast('Спершу створіть профіль'); return; } openCreate(this, { gid: el.dataset.id }); },
      galDel: async () => { if (await confirm('Видалити з галереї?', 'Видалити', true)) { sim.deletePhoto(el.dataset.id); a.id = null; this.render(); } },
      ideaAdd: () => { const inp = this.root.querySelector('[data-keep="idea"]'), t = inp.value.trim(); if (!t) return; inp.value = ''; sim.addIdea(t); this.render(); },
      ideaDone: () => { const i = s.ideas.find(x => x.id === el.dataset.id); if (i) { i.done = !i.done; this.render(); } },
      ideaDel: () => { s.ideas = s.ideas.filter(x => x.id !== el.dataset.id); this.render(); },
      mailOpen: () => { a.id = el.dataset.id; this.render(true); },
      mailBack: () => { a.id = null; this.render(); },
      webClose: () => { s.flags.phishPage = false; s.flags.payPage = null; this.open('likeer'); },
      phishGo: () => { const p = this.root.querySelector('[data-keep="ph-pass"]').value; if (!p) return toast('Введіть пароль'); sim.phishLogin(p); this.open('likeer'); toast('Дякуємо! Ваш профіль підтверджено'); },
      payGo: () => { const c = this.root.querySelector('[data-keep="card"]').value.replace(/\D/g, ''); if (c.length < 12) return toast('Введіть номер картки'); sim.payScam(c); this.open('likeer'); toast('Оплату прийнято. Очікуйте доставку'); },
      reset: async () => { if (await confirm('Почати все заново?', 'Почати заново', true, 'Профіль, дописи й галерея повернуться до початкового стану.')) this.resetAll(); },
    };
    A[name]?.();
  }
  resetAll() { try { localStorage.removeItem(KEY); } catch { /* ігноруємо */ } sim.s = newState(); sim.r = rng(sim.s); sim.refreshFeed(); sim.seedGallery(); this.apps.likeer = new Likeer(this); this.apps.likeer.v_create = top => renderCreate(this.apps.likeer, top); this.home(); this.save(); }
  save() { clearTimeout(this.saveT); this.saveT = setTimeout(() => this.saveNow(), 600); }
  saveNow() { clearTimeout(this.saveT); try { localStorage.setItem(KEY, JSON.stringify({ s: sim.s, speed: ui.speed })); } catch { /* сховище недоступне */ } }
}

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
setInterval(() => { if (!ui.speed || document.hidden) return; sim.advance(ui.speed); }, 1000);
addEventListener('pagehide', () => phone.saveNow());
document.addEventListener('visibilitychange', () => { if (document.hidden) phone.saveNow(); });

phone.render(true);
if (broken) toast('Збереження було пошкоджене, тому все почалося заново');
document.getElementById('boot')?.remove();
