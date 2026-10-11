// Симулятор блогера · «Реклама» в Лайкері: рекламний кабінет, майстер налаштування таргету
// (що просувати → мета → аудиторія → розміщення → бюджет → перевірка й демо-оплата), результати кампанії й довідка.
import { icon } from './icons.js';
import { photo, avatar } from './art.js';
import { esc, toast, confirm, sheet } from './ui.js';
import { num, plural, ago, clock, dayOf } from './sim.js';
import { media } from './likeer.js';
import { snap } from './create.js';
import { MIN_DAILY, CITIES, RADIUS, INTERESTS, GENDERS, teen, audience, sizeLabel, forecast, cpm, review, reviewVideo, ensureAds, topUp, launchAd, stopAd, resumeAd, money, goalsOf, placesOf } from './adsim.js';

const STEPS = ['Що просувати', 'Мета', 'Аудиторія', 'Розміщення', 'Бюджет', 'Перевірка'];
const STATUS = { review: ['На перевірці', 'wait'], active: ['Активна', 'on'], paused: ['Призупинена', 'wait'], done: ['Завершена', 'off'], rejected: ['Не схвалено', 'bad'] };
const CTA = { profile: 'Перейти в профіль', reach: 'Детальніше', msg: 'Надіслати повідомлення', views: 'Дивитися', subs: 'Підписатися' };
const isT = lk => lk.platform === 'tube';
const blank = (tube = false) => ({ step: 0, platform: tube ? 'tube' : 'lk', src: tube ? 'video' : 'post', pid: null, gid: null, vid: null, caption: '', goal: tube ? 'views' : 'profile', auto: true, city: 'ua', radius: 0, age: [18, 34], gender: 'all', interests: [], place: 'auto', places: tube ? ['instream', 'feed', 'shorts'] : ['feed', 'stories', 'reels'], daily: 100, days: 5 });

// що рекламуємо: допис або фото з Галереї (лише для реклами, у профілі не з’явиться)
function creative(lk, a) {
  const s = lk.s;
  if (a.platform === 'tube') { const v = s.tube?.videos.find(x => x.id === a.vid && x.t); return v ? { v, q: v.q ?? 0.5, intro: !!v.flags?.intro, html: `<span class="tv-th${v.shorts ? ' sh' : ''}">${lk.thumbHtml(v)}</span>`, caption: v.title, reasons: reviewVideo(v) } : null; }
  if (a.src === 'post') { const p = s.posts.find(x => x.id === a.pid && x.t); return p ? { p, q: p.q ?? 0.5, html: media(lk.sim, p, { thumb: true }), caption: p.caption || p.text || '', reasons: review(p) } : null; }
  const g = s.gallery.find(x => x.id === a.gid); if (!g || g.type !== 'photo') return null;
  const sl = lk.sim.slide({ gid: g.id, filter: 'none' }), cb = /шок|терміново|100%|не повіриш/i.test(a.caption);
  return { g, q: sl.q, html: photo(g, { thumb: true }), caption: a.caption, reasons: review({ risk: sl.risk.filter(x => x !== 'geo'), cb }) };
}

export const adViews = {
  /* ═════════ Рекламний кабінет ═════════ */
  v_ads() {
    const s = this.s, ads = ensureAds(s), list = ads.list.filter(x => (x.platform === 'tube') === isT(this));
    const row = ad => { const st = STATUS[ad.status], c = creativeThumb(this, ad), res = resOf(ad);
      return `<button class="ad-row" data-act="ad.open" data-id="${ad.id}"><span class="ad-th">${c}</span><span class="ad-t"><b>${esc(goalsOf(ad)[ad.goal].t)}</b><small><i class="ad-st ${st[1]}">${st[0]}</i> · ${money(ad.stats.spent)} з ${money(ad.daily * ad.days)}</small><small>${num(Math.round(res))} ${goalsOf(ad)[ad.goal].r} · ${num(Math.round(ad.stats.imps))} показів</small></span>${icon('chevron', 16)}</button>`; };
    return `${this.head('Реклама', `<button class="ib" data-act="ad.info" aria-label="Як працює таргет">${icon('info', 22)}</button>`)}<div class="scroll pad" data-scroll="ads">
      <section class="ad-bal"><div><small>Навчальний рекламний баланс</small><b>${money(ads.balance)}</b></div><button class="btn sm" data-act="ad.topup">${icon('plus', 15)}Поповнити</button></section>
      <p class="hint">${icon('info', 16)}<span>Гроші тут умовні. У справжніх соцмережах рекламу запускають лише з 18 років, оплата — банківською карткою дорослого.</span></p>
      <button class="btn primary big" data-act="ad.new">${icon('megaphone', 18)}Створити рекламу</button>
      ${list.length ? `<h3>Ваші кампанії</h3><div class="ad-list">${list.map(row).join('')}</div>` : `<div class="empty sm">${icon('megaphone', 36)}<b>Кампаній ще немає</b><p>Виберіть допис або фото, налаштуйте, кому його показати, і подивіться, скільки це коштує.</p></div>`}
      <button class="stats-btn" data-act="ad.info">${icon('idea', 18)}<span><b>Як працює таргетована реклама</b> · аукціон, CPM, частота, правила</span>${icon('chevron', 18)}</button></div>`;
  },

  /* ═════════ Майстер ═════════ */
  v_adNew(top) {
    const a = top.a, st = a.step, cr = creative(this, a);
    if (a.platform === 'tube') a.intro = !!cr?.intro;
    const bar = `<div class="ad-steps" aria-label="Крок ${st + 1} з ${STEPS.length}">${STEPS.map((t, i) => `<i class="${i < st ? 'done' : i === st ? 'on' : ''}"></i>`).join('')}</div><p class="ad-step-t">Крок ${st + 1} з ${STEPS.length} · <b>${STEPS[st]}</b></p>`;
    const can = st === 0 ? !!cr && (a.src !== 'photo' || a.caption.trim().length > 0) : st === 2 ? a.auto || audience(a).size >= 1000 : st === 3 ? a.place === 'auto' || a.places.length > 0 : true;
    const foot = st < 5 ? `<footer class="foot"><button class="btn primary big" data-act="ad.next" ${can ? '' : 'disabled'}>Далі</button></footer>` : '';
    const head = `<header class="ah"><button class="ib" data-act="ad.back" aria-label="${st ? 'Назад' : 'Закрити'}">${icon(st ? 'back' : 'close', 24)}</button><b class="ah-t">Нова реклама</b></header>`;
    return `${head}<div class="scroll pad" data-scroll="adnew-${st}">${bar}${this['ad' + st](a, cr)}</div>${foot}`;
  },
  // 1. Що просувати
  ad0(a) {
    if (a.platform === 'tube') {
      const vids = (this.s.tube?.videos || []).filter(v => v.t);
      return `<p class="muted sm">Виберіть відео. Найкраще просувати те, що вже добре утримує глядачів: реклама не врятує нудний початок.</p>${vids.length ? `<div class="tv-list">${vids.map(v => `<button class="tv-row${a.vid === v.id ? ' on' : ''}" data-act="ad.pickVideo" data-id="${v.id}" aria-pressed="${a.vid === v.id}"><span class="tv-th${v.shorts ? ' sh' : ''}">${this.thumbHtml(v)}</span><span><b>${esc(v.title)}</b><small>${num(v.stats.views)} переглядів · утримання ${Math.round((v.plan?.ret || 0) * 100)}%${v.vis !== 'public' ? ' · не відкрите' : ''}</small></span></button>`).join('')}</div>` : `<div class="empty sm"><b>Опублікованих відео ще немає</b><p>Спершу завантажте відео в Студії.</p></div>`}`;
    }
    const s = this.s, posts = s.posts.filter(p => p.t && p.kind !== 'text'), pics = s.gallery.filter(g => g.type === 'photo').slice(0, 24);
    return `<div class="seg">${[['post', 'Опублікований допис'], ['photo', 'Фото з галереї']].map(([k, t]) => `<button class="${a.src === k ? 'on' : ''}" data-act="ad.src" data-k="${k}">${t}</button>`).join('')}</div>
      <p class="muted sm">${a.src === 'post' ? 'Найпростіше — просувати допис, який уже подобається підписникам: реакції під ним додають довіри.' : 'Рекламу з нового фото бачать лише ті, кому її покажуть. У профілі вона не з’явиться.'}</p>
      ${a.src === 'post' ? (posts.length ? `<div class="pick-grid ad-pick">${posts.map(p => `<button class="pg${a.pid === p.id ? ' on' : ''}" data-act="ad.pickPost" data-id="${p.id}" aria-label="Допис від ${ago(s.t, p.t)}">${media(this.sim, p, { thumb: true })}<i class="pg-dur">${num(p.stats.views)}</i></button>`).join('')}</div>` : `<div class="empty sm"><b>Опублікованих фото чи відео ще немає</b><p>Опублікуйте допис або виберіть фото з галереї.</p></div>`)
      : `<div class="pick-grid ad-pick">${pics.map(g => `<button class="pg${a.gid === g.id ? ' on' : ''}" data-act="ad.pickPhoto" data-id="${g.id}" aria-label="Фото">${photo(g, { thumb: true })}</button>`).join('')}</div>
        <label class="fl"><span>Текст реклами</span><textarea class="in" rows="3" maxlength="300" data-keep="ad.caption" data-in="ad.caption" placeholder="Наприклад: «Щодня нові фото мого кота — підписуйся!»">${esc(a.caption)}</textarea></label>`}`;
  },
  // 2. Мета
  ad1(a) {
    return `<p class="muted sm">Мета підказує платформі, кому показувати рекламу і за що ви фактично платите.</p><div class="radio">${Object.entries(goalsOf(a)).map(([k, g]) => `<button class="rd${a.goal === k ? ' on' : ''}" role="radio" aria-checked="${a.goal === k}" data-act="ad.goal" data-k="${k}"><i></i><span><b>${icon(g.icon, 15)} ${g.t}</b><small>${g.d}</small></span></button>`).join('')}</div>`;
  },
  // 3. Аудиторія
  ad2(a) {
    const au = audience(a), [lvl, lt] = sizeLabel(au.size), t = teen(a), pos = Math.min(100, Math.max(2, Math.log10(Math.max(1, au.size)) / 7 * 100));
    return `<div class="radio">${[[true, 'Автоматично', 'Платформа сама шукає людей, схожих на ваших підписників. Добре для початку.'], [false, 'Налаштувати вручну', 'Ви вибираєте місце, вік, стать та інтереси.']].map(([v, t1, d]) => `<button class="rd${a.auto === v ? ' on' : ''}" role="radio" aria-checked="${a.auto === v}" data-act="ad.auto" data-v="${v}"><i></i><span><b>${t1}</b><small>${d}</small></span></button>`).join('')}</div>
      ${a.auto ? '' : `<h3 class="sec">Місце</h3><div class="row2"><select class="in sel" data-adsel="city" aria-label="Місто">${Object.entries(CITIES).map(([k, [n]]) => `<option value="${k}"${a.city === k ? ' selected' : ''}>${n}</option>`).join('')}</select>${a.city === 'ua' ? '' : `<select class="in sel" data-adsel="radius" aria-label="Радіус">${Object.entries(RADIUS).map(([k, [n]]) => `<option value="${k}"${String(a.radius) === k ? ' selected' : ''}>${n}</option>`).join('')}</select>`}</div>
      <h3 class="sec">Вік: ${a.age[0]}–${a.age[1] >= 65 ? '65+' : a.age[1]}</h3>
      <label class="rng"><span>Від ${a.age[0]}</span><input type="range" min="13" max="65" value="${a.age[0]}" data-adrng="age0" aria-label="Вік від"></label>
      <label class="rng"><span>До ${a.age[1] >= 65 ? '65+' : a.age[1]}</span><input type="range" min="13" max="65" value="${a.age[1]}" data-adrng="age1" aria-label="Вік до"></label>
      ${t ? `<p class="warnbox">${icon('shield', 16)}<span>Аудиторія включає підлітків до 18 років. Як у справжніх соцмережах, їм можна показувати рекламу лише за віком і місцем — без вибору статі й інтересів. Так підлітків захищають від надто точної реклами.</span></p>` : ''}
      <h3 class="sec">Стать</h3><div class="seg${t ? ' dis' : ''}">${Object.entries(GENDERS).map(([k, n]) => `<button class="${a.gender === k && !t ? 'on' : ''}" data-act="ad.gender" data-k="${k}" ${t ? 'disabled' : ''}>${n}</button>`).join('')}</div>
      <h3 class="sec">Інтереси <small class="muted">(будь-який з вибраних)</small></h3><div class="chips wrap">${Object.entries(INTERESTS).map(([k, [n]]) => `<button class="chip-btn${a.interests.includes(k) && !t ? ' on' : ''}" data-act="ad.int" data-k="${k}" aria-pressed="${a.interests.includes(k)}" ${t ? 'disabled' : ''}>${n}</button>`).join('')}</div>`}
      <section class="aud"><div class="aud-top"><small>Потенційна аудиторія</small><b>${num(Math.round(au.size * 0.9))} – ${num(Math.round(au.size * 1.1))}</b></div>
        <div class="aud-gauge ${lvl}"><i style="left:${pos}%"></i></div><div class="aud-l"><span>Вузька</span><span>Широка</span></div><p class="aud-t ${lvl}">${lt}</p>${au.size < 1000 ? '<p class="neg sm">Замало людей: розширте місце, вік або інтереси.</p>' : ''}</section>`;
  },
  // 4. Розміщення
  ad3(a, cr) {
    if (a.platform === 'tube') {
      const PL = placesOf(a), m = (k, inner) => `<span class="pl-m ${k === 'shorts' ? 'reels' : 'feed tv'}"><span class="pl-s">${inner}</span><i>${PL[k][0]}</i></span>`;
      return `<div class="radio">${[['auto', 'Автоматично (рекомендовано)', 'Платформа сама вибирає, де показати: перед іншими відео, у пошуку чи між короткими.'], ['manual', 'Вибрати вручну', 'Ви вирішуєте, де саме показувати.']].map(([k, t, d]) => `<button class="rd${(a.place === 'auto') === (k === 'auto') ? ' on' : ''}" role="radio" aria-checked="${(a.place === 'auto') === (k === 'auto')}" data-act="ad.place" data-k="${k}"><i></i><span><b>${t}</b><small>${d}</small></span></button>`).join('')}</div>
        ${a.place === 'auto' ? '' : `<div class="pl-pick">${Object.entries(PL).map(([k, [n]]) => `<button class="chk-row${a.places.includes(k) ? ' on' : ''}" data-act="ad.pl" data-k="${k}" role="checkbox" aria-checked="${a.places.includes(k)}"><i>${a.places.includes(k) ? icon('check', 14) : ''}</i>${n}</button>`).join('')}</div>`}
        <h3 class="sec">Як це виглядатиме</h3><div class="pl-row tube">${m('instream', `${cr?.html || ''}<span class="skip">${icon('chevron', 11)}${icon('chevron', 11)}</span><span class="adtag">Реклама</span>`)}${m('feed', `${cr?.html || ''}<span class="adtag">Реклама</span>`)}${m('shorts', `${cr?.html || ''}<span class="adtag">Реклама</span>`)}</div>
        <p class="muted sm">Перед іншими відео рекламу можна пропустити через 5 секунд — тож перші секунди вирішують усе. У пошуку людина сама натискає на обкладинку.</p>`;
    }
    const mock = (k, t) => `<span class="pl-m ${k}"><span class="pl-s">${cr?.html || ''}</span><i>${t}</i></span>`;
    return `<div class="radio">${[['auto', 'Автоматично (рекомендовано)', 'Платформа сама розподіляє покази між стрічкою, історіями й короткими відео — там, де дешевше й ефективніше.'], ['manual', 'Вибрати вручну', 'Ви вирішуєте, де саме показувати.']].map(([k, t, d]) => `<button class="rd${(a.place === 'auto') === (k === 'auto') ? ' on' : ''}" role="radio" aria-checked="${(a.place === 'auto') === (k === 'auto')}" data-act="ad.place" data-k="${k}"><i></i><span><b>${t}</b><small>${d}</small></span></button>`).join('')}</div>
      ${a.place === 'auto' ? '' : `<div class="pl-pick">${Object.entries(placesOf(a)).map(([k, [n]]) => `<button class="chk-row${a.places.includes(k) ? ' on' : ''}" data-act="ad.pl" data-k="${k}" role="checkbox" aria-checked="${a.places.includes(k)}"><i>${a.places.includes(k) ? icon('check', 14) : ''}</i>${n}</button>`).join('')}</div>`}
      <h3 class="sec">Як це виглядатиме</h3><div class="pl-row">${mock('feed', 'Стрічка')}${mock('stories', 'Історії')}${mock('reels', 'Короткі відео')}</div>
      <p class="muted sm">Квадратні й вертикальні фото добре виглядають усюди. В історіях і коротких відео краї широкого фото обріжуться.</p>`;
  },
  // 5. Бюджет
  ad4(a, cr) {
    const f = forecast(a, cr?.q ?? 0.5), c = cpm(a, cr?.q ?? 0.5), g = goalsOf(a)[a.goal];
    return `<div class="bud"><div class="bud-v"><small>Денний бюджет</small><b>${money(a.daily)}</b></div><input type="range" min="${MIN_DAILY}" max="1000" step="10" value="${a.daily}" data-adrng="daily" aria-label="Денний бюджет"><div class="aud-l"><span>${MIN_DAILY} грн — мінімум</span><span>1000 грн</span></div></div>
      <div class="bud"><div class="bud-v"><small>Тривалість</small><b>${a.days} ${plural(a.days, 'день', 'дні', 'днів')}</b></div><input type="range" min="1" max="30" value="${a.days}" data-adrng="days" aria-label="Тривалість у днях"><div class="aud-l"><span>1 день</span><span>30 днів</span></div></div>
      <section class="est"><h3>Прогноз</h3>
        <div class="est-r"><span>Охоплення за день</span><b>${num(f.reachDay[0])}–${num(f.reachDay[1])} людей</b></div>
        <div class="est-r"><span>${a.goal === 'reach' ? 'Охоплення за весь час' : `${g.r[0].toUpperCase() + g.r.slice(1)} за весь час`}</span><b>${num(a.goal === 'reach' ? f.reach[0] : f.results[0])}–${num(a.goal === 'reach' ? f.reach[1] : f.results[1])}</b></div>
        ${c.cpv ? `<div class="est-r"><span>Ціна перегляду (CPV)</span><b>≈ ${money(Math.round(c.cpv * 100) / 100)}</b></div><div class="est-r"><span>Додивляться рекламу</span><b>≈ ${Math.round(c.vr * 100)}% глядачів</b></div>` : ''}
        <div class="est-r"><span>Ціна 1000 показів (CPM)</span><b>≈ ${money(f.cpm)}</b></div>
        ${a.goal === 'reach' || (c.cpv && a.goal === 'views') ? '' : `<div class="est-r"><span>Ціна за ${g.one}</span><b>≈ ${money(Math.round(f.costPer * 100) / 100)}</b></div>`}
        <div class="est-r"><span>Середня частота</span><b>≈ ${f.freq.toFixed(1).replace('.', ',')} показу на людину</b></div>
        ${f.freq > 3 ? `<p class="warnbox">${icon('alert', 16)}<span>Одна людина побачить рекламу понад 3 рази — вона набридне. Розширте аудиторію або скоротіть тривалість.</span></p>` : ''}
      </section>
      <h3>Від чого залежить ціна</h3><ul class="why mix">${c.why.map(([k, t]) => `<li class="${k === '+' ? 'good' : k === '-' ? 'bad' : ''}">${icon(k === '+' ? 'check' : k === '-' ? 'alert' : 'info', 16)}<span>${t}</span></li>`).join('')}</ul>
      <div class="est-sum"><span>Бюджет: ${money(a.daily)} × ${a.days}</span><b>${money(f.total)}</b><span>ПДВ 20%</span><b>${money(f.vat)}</b><span>Разом</span><b class="big">${money(f.total + f.vat)}</b></div>
      <p class="muted sm">Прогноз приблизний: справжня ціна щодня змінюється через аукціон — за той самий показ змагаються інші рекламодавці.</p>`;
  },
  // 6. Перевірка
  ad5(a, cr) {
    const s = this.s, ads = ensureAds(s), f = forecast(a, cr?.q ?? 0.5), cost = f.total + f.vat, au = audience(a);
    const aud = a.auto ? 'Автоматично: схожі на підписників' : [CITIES[a.city][0] + (a.city !== 'ua' && +a.radius ? ` ${RADIUS[a.radius][0]}` : ''), `${a.age[0]}–${a.age[1] >= 65 ? '65+' : a.age[1]} років`, teen(a) ? '' : GENDERS[a.gender], teen(a) ? '' : a.interests.map(k => INTERESTS[k][0]).join(', ')].filter(Boolean).join(' · ');
    const row = (t, v, step) => `<div class="sum-r"><span><small>${t}</small>${v}</span><button class="lnk" data-act="ad.goto" data-s="${step}">Змінити</button></div>`;
    const who = isT(this) ? { av: this.chAv(34), nick: this.ch.name } : { av: avatar(this.meAv(), 34), nick: s.me.nick };
    return `<h3 class="sec">Так побачать рекламу</h3><article class="post ad-prev${isT(this) ? ' tv' : ''}"><header class="ph">${who.av}<div><b>${esc(who.nick)}</b><small>Реклама</small></div></header><div class="pm-media">${cr?.html || ''}</div>
        <div class="ad-cta">${CTA[a.goal]}${icon('chevron', 16)}</div>${cr?.caption ? `<p class="pc"><b>${esc(who.nick)}</b> ${esc(cr.caption.slice(0, 140))}</p>` : ''}</article>
      <div class="sum">${row('Мета', goalsOf(a)[a.goal].t, 1)}${row('Аудиторія', `${esc(aud)}<br><small>${num(au.size)} людей</small>`, 2)}${row('Розміщення', a.place === 'auto' ? 'Автоматично' : a.places.map(k => placesOf(a)[k][0]).join(', '), 3)}${row('Бюджет', `${money(a.daily)} на день · ${a.days} ${plural(a.days, 'день', 'дні', 'днів')}`, 4)}</div>
      <section class="card-s"><b>${icon('shield', 16)}Перевірка правил реклами</b><p class="muted sm">Перед запуском кожну рекламу перевіряють — зазвичай від кількох хвилин до доби. Рекламу не пропустять, якщо в ній:</p>
        <ul class="rules"><li>особисті дані (адреса, школа, документи, телефон);</li><li>чужі фото, музика чи кадри без дозволу;</li><li>обман і перебільшення («100% результат», «шок»);</li><li>заборонені теми: азартні ігри, алкоголь, тютюн.</li></ul></section>
      <section class="card-s pay"><b>${icon('card', 16)}Оплата (демонстрація)</b><div class="est-r"><span>До сплати з ПДВ</span><b>${money(cost)}</b></div><div class="est-r"><span>Навчальний баланс</span><b class="${ads.balance < cost ? 'neg' : ''}">${money(ads.balance)}</b></div>
        <p class="muted sm">Справжніх грошей і даних картки тут немає. У реальній соцмережі гроші резервуються одразу, а невитрачений залишок повертається, якщо зупинити рекламу.</p>${ads.balance < cost ? `<button class="btn sm" data-act="ad.topup">${icon('plus', 15)}Поповнити навчальний баланс</button>` : ''}</section>
      ${ads.balance < cost ? `<p class="warnbox">${icon('alert', 16)}<span>На балансі ${money(ads.balance)}, а потрібно ${money(cost)}. Поповніть навчальний баланс або зменште бюджет на кроці «Бюджет».</span></p>` : ''}
      <button class="btn primary big" data-act="ad.launch">${icon('megaphone', 18)}${ads.balance < cost ? `Поповнити й запустити за ${money(cost)}` : `Запустити рекламу за ${money(cost)}`}</button>`;
  },

  /* ═════════ Результати кампанії ═════════ */
  v_adView(top) {
    const s = this.s, ad = ensureAds(s).list.find(x => x.id === top.id); if (!ad) return `${this.head('Реклама')}<div class="empty"><b>Кампанію не знайдено</b></div>`;
    const st = ad.stats, [stT, stC] = STATUS[ad.status], g = goalsOf(ad)[ad.goal], res = resOf(ad), tube = ad.platform === 'tube';
    const freq = st.reach ? st.imps / st.reach : 0, ctr = st.imps ? (st.clicks + st.msgs) / st.imps : 0, cpmReal = st.imps ? st.spent / st.imps * 1000 : 0;
    const tile = (k, v, ic, sub = '') => `<div class="tile">${icon(ic, 18)}<b>${v}</b><small>${k}${sub ? `<br>${sub}` : ''}</small></div>`;
    const steps = [['Створено', ad.created], ['Перевірка', ad.status === 'review' ? null : ad.start || ad.end], [ad.status === 'rejected' ? 'Не схвалено' : 'Показ', ad.start], ['Завершено', ad.status === 'done' ? ad.end : null]];
    const brk = (title, o) => { const e = Object.entries(o).sort((x, y) => y[1] - x[1]), t = e.reduce((x, y) => x + y[1], 0) || 1; return e.length ? `<h3>${title}</h3>${e.map(([k, v]) => `<div class="hbar"><span>${esc(k)}</span><i><b style="width:${Math.round(v / t * 100)}%"></b></i><small>${Math.round(v / t * 100)}%</small></div>`).join('')}` : ''; };
    const tips = [];
    if (freq > 3) tips.push('Частота понад 3: ті самі люди бачать рекламу знову й знову — реакцій стає менше. Розширте аудиторію.');
    if (st.imps > 500 && ctr < 0.006 && ad.goal !== 'reach') tips.push('Мало хто натискає (CTR нижче 0,6%). Спробуйте яскравіше фото або зрозуміліший текст.');
    if (ad.cpm > 90) tips.push('Дорогі покази: аудиторія вузька або інтереси популярні серед рекламодавців.');
    if (st.follows >= 1 && st.spent > 0) tips.push(`Один новий підписник обійшовся приблизно в ${money(Math.round(st.spent / st.follows))}. Чи варто воно того — вирішуєте ви: якісні дописи приводять підписників безкоштовно.`);
    const days = st.days, mx = Math.max(1, ...days.map(d => d.imps));
    return `${this.head('Результати реклами')}<div class="scroll pad" data-scroll="adv-${ad.id}">
      <div class="ad-head"><span class="ad-th">${creativeThumb(this, ad)}</span><span><b>${esc(g.t)}</b><small><i class="ad-st ${stC}">${stT}</i> · ${money(ad.daily)} на день · ${ad.days} ${plural(ad.days, 'день', 'дні', 'днів')}</small></span></div>
      <ol class="tl">${steps.map(([t, at]) => `<li class="${at ? 'done' : ''}"><i></i><span>${t}${at ? `<small>день ${dayOf(at) + 1}, ${clock(at)}</small>` : ''}</span></li>`).join('')}</ol>
      ${ad.status === 'review' ? `<p class="hint">${icon('clock', 16)}<span>Реклама на перевірці. Зазвичай це триває від кількох хвилин до доби — перемотайте час на панелі праворуч.</span></p>` : ''}
      ${ad.status === 'rejected' ? `<div class="warnbox">${icon('alert', 16)}<span><b>Рекламу не схвалено.</b> ${ad.reasons.map(esc).join('; ')}. Гроші (${money(ad.refund || 0)}) повернуто на баланс. Виберіть інший допис або виправте його.</span></div>` : ''}
      ${['active', 'paused', 'done'].includes(ad.status) ? `<div class="tiles">${tile('Витрачено', money(Math.round(st.spent)), 'money', `з ${money(ad.daily * ad.days)}`)}${tile('Покази', num(Math.round(st.imps)), 'eye')}${tile('Охоплення', num(Math.round(st.reach)), 'users', 'різних людей')}${tile(g.r[0].toUpperCase() + g.r.slice(1), num(Math.round(res)), g.icon)}${tile('Ціна за 1000 показів', money(Math.round(cpmReal)), 'chart', 'CPM')}${tile('Частота', freq.toFixed(1).replace('.', ','), 'refresh', 'показів на людину')}${tube ? tile('Переглянули', ((st.views || 0) / Math.max(1, st.imps) * 100).toFixed(1).replace('.', ',') + '%', 'play', 'показів стали переглядом') : tile('CTR', (ctr * 100).toFixed(2).replace('.', ',') + '%', 'arrow', 'натиснули')}${tile(tube && ad.goal !== 'reach' ? 'Ціна перегляду' : 'Ціна результату', tube && ad.goal !== 'reach' ? (st.views >= 1 ? money(Math.round(st.spent / st.views * 100) / 100) : '—') : res >= 1 ? money(Math.round(st.spent / res * 100) / 100) : '—', 'card', tube && ad.goal !== 'reach' ? 'CPV' : '')}${tile('Нові підписники', '+' + num(Math.floor(tube ? st.subsT || 0 : st.follows)), 'user')}</div>
        ${days.length ? `<h3>Покази за днями</h3><div class="dbars">${days.map((d, i) => `<span><i style="height:${Math.max(3, d.imps / mx * 100)}%" title="${num(Math.round(d.imps))} показів, ${money(Math.round(d.spent))}"></i><small>Д${i + 1}</small></span>`).join('')}</div>` : ''}
        ${brk('Вік', st.age)}${brk('Стать', st.gender)}${brk('Місто', st.city)}${brk('Розміщення', st.place)}
        ${tips.length ? `<h3>Що це означає</h3><ul class="why tips">${tips.map(t => `<li>${icon('idea', 16)}<span>${t}</span></li>`).join('')}</ul>` : ''}` : ''}
      ${ad.status === 'done' && ad.refund ? `<p class="muted sm">Невитрачений залишок ${money(ad.refund)} повернуто на баланс.</p>` : ''}
      <div class="row2">${ad.status === 'active' ? `<button class="btn" data-act="ad.pause" data-id="${ad.id}">${icon('pause', 16)}Призупинити</button>` : ad.status === 'paused' ? `<button class="btn" data-act="ad.resume" data-id="${ad.id}">${icon('play', 16)}Відновити</button>` : ''}${['active', 'paused', 'review'].includes(ad.status) ? `<button class="btn danger" data-act="ad.stop" data-id="${ad.id}">${icon('close', 16)}Зупинити</button>` : ''}</div></div>`;
  },

  /* ═════════ Як працює таргет ═════════ */
  v_adInfo() {
    const q = (t, b) => `<details class="faq"><summary>${t}</summary><p>${b}</p></details>`;
    return `${this.head('Як працює таргет')}<div class="scroll pad">
      <p>Таргетована реклама — це платний показ допису людям, яких ви вибрали за місцем, віком та інтересами. Слово «таргет» означає «ціль».</p>
      ${q('Хто може запускати рекламу?', 'У справжніх соцмережах — лише дорослі (від 18 років), бо треба погодитися з умовами й платити банківською карткою. Підлітки можуть робити це тільки разом із батьками. Тут гроші умовні, тому пробувати безпечно.')}
      ${q('Що таке аукціон і CPM?', 'Кожен показ реклами — це маленький аукціон: за увагу людини змагаються багато рекламодавців. CPM — ціна 1000 показів. В Україні вона зазвичай від 40 до 120 грн, а для вузької чи «популярної» аудиторії — дорожче.')}
      ${q('Чому якість допису впливає на ціну?', 'Платформі вигідно показувати те, що людям цікаво. Якщо допис гарний і викликає реакції, він виграє аукціон дешевше. Нудна чи слабка реклама обходиться дорожче.')}
      ${q('Що таке CTR, частота й охоплення?', 'Охоплення — скільки різних людей побачили рекламу. Частота — скільки разів у середньому одна людина її бачила (понад 3 — уже набридає). CTR — яка частка людей натиснула на рекламу.')}
      ${q('Вузька чи широка аудиторія?', 'Дуже вузька (наприклад, одне місто, вузький вік і рідкісний інтерес) — точна, але дорога й швидко вичерпується. Дуже широка — дешева, але показує рекламу й тим, кому вона нецікава. Найкраще — посередині.')}
      ${q('Чому для підлітків не можна вибрати інтереси?', 'Великі соцмережі захищають людей до 18 років: рекламодавці бачать лише їхній вік і місто, без інтересів і статі. Тому й тут, щойно вік аудиторії опускається нижче 18, ці налаштування вимикаються.')}
      ${q('Як платять за рекламу відео?', 'На відеоплатформах зазвичай платять за перегляд (CPV): гроші списуються, лише коли людина дивиться рекламу довше 30 секунд або до кінця. Хто натиснув «Пропустити» через 5 секунд — безкоштовно. Тому найважливіші перші секунди відео.')}
      ${q('Звідки береться ПДВ?', 'В Україні з 2022 року іноземні платформи додають до ціни реклами ПДВ 20%. Тому до бюджету завжди додається податок.')}
      ${q('Чи гарантує реклама підписників?', 'Ні. Ви платите за покази, а підпишуться люди чи ні — залежить від допису й профілю. Реклама приводить глядачів, але втримують їх цікаві дописи.')}
      ${q('Чому рекламу можуть не схвалити?', 'Через особисті дані на фото, чужу музику чи кадри, обман у тексті або заборонені теми. Гроші в такому разі не списуються.')}</div>`;
  },
};

const resOf = ad => ad.platform === 'tube' ? (ad.goal === 'subs' ? ad.stats.subsT || 0 : ad.goal === 'reach' ? ad.stats.reach : ad.stats.views || 0) : ad.goal === 'reach' ? ad.stats.reach : ad.goal === 'msg' ? ad.stats.msgs : ad.stats.clicks;
function creativeThumb(lk, ad) {
  if (ad.vid) { const v = lk.s.tube?.videos.find(x => x.id === ad.vid); return v && lk.thumbHtml ? `<span class="tv-th">${lk.thumbHtml(v)}</span>` : icon('video', 20); }
  if (ad.pid) { const p = lk.s.posts.find(x => x.id === ad.pid); if (p) return media(lk.sim, p, { thumb: true }); }
  const g = lk.s.gallery.find(x => x.id === ad.gid) || ad.g; return g ? photo(g, { thumb: true }) : icon('megaphone', 20);
}

/* ═════════ дії ═════════ */
export function startAd(lk, o = {}) { const a = blank(isT(lk)); if (o.pid) { a.pid = o.pid; a.step = 1; } if (o.vid) { a.vid = o.vid; a.step = 1; } lk.stack = lk.stack.filter(x => x.v !== 'adNew'); lk.go('adNew', { a, fromPost: !!(o.pid || o.vid) }); }
export function adAct(lk, name, el) {
  const top = lk.top, a = top.a, sim = lk.sim, ph = lk.ph;
  const A = {
    open: () => lk.go('adView', { id: el.dataset.id }),
    cabinet: () => lk.go('ads'),
    promote: () => startAd(lk, isT(lk) ? { vid: el.dataset.id } : { pid: el.dataset.id }),
    pickVideo: () => { a.vid = el.dataset.id; ph.render(); },
    info: () => lk.go('adInfo'),
    new: () => startAd(lk),
    topup: () => { topUp(sim, 1000); ph.render(); toast('Додано 1000 умовних гривень'); },
    back: () => { if (a && a.step > 0 && !(a.step === 1 && top.fromPost)) { a.step--; ph.render(true); } else lk.back(); },
    next: () => { if (!a) return; a.step = Math.min(5, a.step + 1); ph.render(true); },
    goto: () => { a.step = +el.dataset.s; ph.render(true); },
    src: () => { a.src = el.dataset.k; ph.render(); },
    pickPost: () => { a.pid = el.dataset.id; ph.render(); },
    pickPhoto: () => { a.gid = el.dataset.id; ph.render(); },
    goal: () => { a.goal = el.dataset.k; ph.render(); },
    auto: () => { a.auto = el.dataset.v === 'true'; ph.render(); },
    gender: () => { a.gender = el.dataset.k; ph.render(); },
    int: () => { const k = el.dataset.k, i = a.interests.indexOf(k); if (i >= 0) a.interests.splice(i, 1); else a.interests.push(k); ph.render(); },
    place: () => { a.place = el.dataset.k === 'auto' ? 'auto' : 'manual'; ph.render(); },
    pl: () => { const k = el.dataset.k, i = a.places.indexOf(k); if (i >= 0) a.places.splice(i, 1); else a.places.push(k); ph.render(); },
    launch: async () => {
      if (!a) return;
      const cr = creative(lk, a); if (!cr) { toast(isT(lk) ? 'Відео для реклами більше недоступне. Виберіть інше' : 'Допис чи фото для реклами більше недоступні. Виберіть інше'); a.step = 0; ph.render(true); return; }
      const f = forecast(a, cr.q), cost = f.total + f.vat, ads = ensureAds(lk.s);
      if (ads.balance < cost) {
        const need = Math.ceil((cost - ads.balance) / 500) * 500;
        if (!(await confirm(`Поповнити навчальний баланс на ${money(need)}?`, 'Поповнити й запустити', false, 'Гроші умовні. У справжній соцмережі оплату підтверджує власник картки — дорослий.'))) return;
        topUp(sim, need);
      }
      const cfg = { ...a, pid: a.src === 'post' ? a.pid : null, gid: a.src === 'photo' ? a.gid : null, vid: a.src === 'video' ? a.vid : null, g: a.src === 'photo' ? snap(cr.g) || { scene: cr.g.scene, v: cr.g.v } : null, intro: !!cr.intro };
      delete cfg.step; delete cfg.src;
      const r = launchAd(sim, cfg, cr.q, cr.reasons);
      if (r.error) return toast(r.error);
      lk.stack = [{ v: isT(lk) ? 'studio' : 'profile' }, { v: 'ads' }, { v: 'adView', id: r.ad.id }]; ph.render(true); ph.save();
      toast('Рекламу надіслано на перевірку');
    },
    pause: () => { stopAd(sim, el.dataset.id, 'paused'); toast('Рекламу призупинено'); },
    resume: () => { resumeAd(sim, el.dataset.id); toast('Рекламу відновлено'); },
    stop: async () => { if (await confirm('Зупинити рекламу?', 'Зупинити', true, 'Невитрачені гроші повернуться на баланс. Відновити кампанію не вийде.')) { stopAd(sim, el.dataset.id); toast('Рекламу зупинено'); } },
  };
  A[name]?.();
}
export function adInput(lk, k, el) { if (k === 'ad.caption') { lk.top.a.caption = el.value; const b = lk.ph.root.querySelector('[data-act="ad.next"]'); if (b) b.disabled = !el.value.trim() || !lk.top.a.gid; } }
export function adRange(lk, k, el) {
  const a = lk.top.a; if (!a) return; const v = +el.value;
  if (k === 'age0') { a.age[0] = Math.min(v, a.age[1]); } else if (k === 'age1') { a.age[1] = Math.max(v, a.age[0]); }
  else if (k === 'daily') a.daily = v; else if (k === 'days') a.days = v;
  lk.ph.render();
}
export function adSelect(lk, k, v) { const a = lk.top.a; if (!a) return; if (k === 'city') { a.city = v; a.radius = 0; } else if (k === 'radius') a.radius = +v; lk.ph.render(); }
