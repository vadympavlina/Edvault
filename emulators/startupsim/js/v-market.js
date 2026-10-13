// Симулятор стартапу · розділи: Клієнти, Бізнес-план, Продукт, Бренд, Маркетинг, Акції.
import { CHANNELS, MODELS, GLOSSARY } from './data.js';
import { QUESTIONS, money, num, pct, plural, sum, W2M } from './sim.js';
import { FONTS, TONES, SYMBOLS, PALETTE, PROMOS, LOYALTY, CANVAS, METRICS, ADVANTAGES, positions, taste } from './mods.js';
import { icon } from './icons.js';
import { esc, term, modal, meter, bars, lineChart, logo, toast } from './ui.js';

const dots = v => `<span class="dots" title="Цінність для сегмента">${[.1, .2, .32].map(t => `<i class="${v >= t ? 'on' : ''}"></i>`).join('')}</span>`;

/* ═════════ Клієнти ═════════ */
function customers(S) {
  const s = S.s, I = S.I;
  const cards = S.segIds.map(k => {
    const g = S.seg(k), K = S.insight(k), u = s.users[k], tg = k === s.target;
    const painTxt = K.pain == null ? '—' : `${Math.round(K.pain * 10)}/10`;
    return `<article class="seg-card ${tg ? 'target' : ''}">
      <header><div><h3>${esc(g.t)}</h3><small>${g.b2b ? 'Організації · ' : ''}ринок ≈ ${num(g.size)} ${g.b2b ? 'організацій' : 'людей'}</small></div>${tg ? `<span class="chip acc">${icon('target', 14)} Цільовий</span>` : `<button class="btn sm" data-act="target" data-k="${k}">Зробити цільовим</button>`}</header>
      <div class="ins">
        <div><span>Інтерв'ю</span><b>${K.n}</b>${K.bad ? `<small class="warn-t">${K.bad} з підказувальними питаннями</small>` : ''}</div>
        <div><span>Наскільки болить</span><b>${painTxt}</b><small>довіра: ${K.painConf}</small></div>
        <div><span>Витрачають зараз</span><b>${K.wtp ? money(K.wtp) : '—'}</b><small>довіра: ${K.wtpConf}</small></div>
        <div><span>«Заплатили б»</span><b class="strike">${K.badWtp ? money(K.badWtp) : '—'}</b><small>ненадійно</small></div>
      </div>
      ${K.likes ? `<p class="note warn sm">${icon('alert', 14)} ${K.likes} × «так, ідея класна» — це ввічливість, а не доказ. ${term('Mom Test', 'Чому?')}</p>` : ''}
      ${K.feats.length ? `<p class="sm"><b>Чого бракує:</b> ${K.feats.slice(0, 3).map(([f, n]) => `${esc(S.feature(f).t)} (${n})`).join(', ')}</p>` : ''}
      ${K.ch.length ? `<p class="sm"><b>Де шукати:</b> ${K.ch.slice(0, 3).map(([c, n]) => `${esc(CHANNELS[c].t)} (${n})`).join(', ')}</p>` : ''}
      ${g.requires ? `<p class="sm muted">Без цього не куплять: ${g.requires.map(f => `${S.has(f) ? '✓' : '✗'} ${esc(S.feature(f).t)}`).join(', ')}</p>` : ''}
      <footer><button class="btn primary sm" data-act="interview" data-k="${k}" ${S.talksLeft() > 0 && !s.interview ? '' : 'disabled'}>${icon('mic', 16)} Інтерв'ю</button>
        <span class="muted sm">${s.product.launched ? `користувачів: ${num(u.free + u.trial + u.paid)}, платних: ${num(u.paid)}` : `лист очікування: ${num(Math.round(u.wait))}`}</span></footer>
    </article>`;
  }).join('');
  const sv = s.surveys.filter(x => x.seg === s.target).at(-1);
  return `<p class="lead">Інтерв'ю — найдешевший спосіб не зробити продукт, який нікому не потрібен. Кожне забирає 3 години з плану тижня (рядок «Клієнти»). Цього тижня лишилося: <b>${S.talksLeft()}</b>. ${term('Mom Test', 'Як правильно питати?')}</p>
  ${S.talksLeft() === 0 && s.hours.customers < 3 ? `<p class="note warn">${icon('clock', 16)} У плані тижня немає годин на клієнтів. <button class="link" data-act="go" data-to="dash">Додати години</button></p>` : ''}
  <div class="grid g3">${cards}</div>
  <section class="card"><header class="card-h"><h3>${icon('chart')} Опитування користувачів</h3>${term('PMF', 'Що таке PMF?')}</header>
    ${s.product.launched ? `<p>Опитування показує, чи справді продукт потрібен (тест Шона Елліса: «Як би ви почувалися, якби продукт зник?»), і що просять покращити. Потрібно щонайменше 30 активних користувачів у цільовому сегменті й 2 години на клієнтів.</p>
      <button class="btn primary" data-act="survey" ${S.canSurvey() ? '' : 'disabled'}>Провести опитування</button>
      ${sv ? `<div class="survey"><div><span>Дуже засмутилися б</span><b class="${sv.pmf >= .4 ? 'pos' : ''}">${pct(sv.pmf)}</b>${meter(sv.pmf / .7, { color: sv.pmf >= .4 ? 'var(--ok)' : 'var(--warn)' })}<small>${sv.pmf >= .4 ? 'Є product-market fit!' : 'Потрібно 40%+'} · відповідей: ${sv.n}</small></div><div><span>NPS</span><b>${sv.nps}</b></div><div><span>Найчастіше просять</span>${sv.asks.length ? `<ul>${sv.asks.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : '<p class="muted">Нічого особливого</p>'}</div></div>` : ''}`
      : '<p class="muted">Стане доступним після запуску продукту.</p>'}
  </section>`;
}
function interviewModal(C, k) {
  const S = C.S, iv = S.startInterview(k); if (!iv) { toast('Цього тижня більше немає часу на інтерв\'ю', 'bad'); return; }
  const order = [...QUESTIONS].sort((a, b) => (a.id.charCodeAt(0) * 7 + a.id.length * 13) % 11 - (b.id.charCodeAt(0) * 7 + b.id.length * 13) % 11);
  const draw = api => {
    const v = S.s.interview, p = iv.p, done = !v || v.asked.length >= 3;
    api.set(`<div class="iv-who">${icon('user', 22)}<div><b>${esc(p.name)}</b><small>${esc(p.who)} · ${esc(S.seg(p.seg).short)}</small></div><span class="chip">${v ? v.asked.length : 3} / 3 запитання</span></div>
      <div class="chat">${iv.log.map(l => `<p class="q">${esc(l.q)}</p><p class="a">${esc(l.a)}</p>`).join('') || '<p class="muted sm">Оберіть запитання. Часу вистачить лише на три.</p>'}</div>
      ${done ? `<div class="iv-sum">${(() => { const bad = iv.asked.filter(q => QUESTIONS.find(x => x.id === q).bad); return bad.length ? `<p class="note warn">${icon('alert', 16)} <span><b>Обережно з висновками.</b> ${bad.map(q => esc(QUESTIONS.find(x => x.id === q).bad)).join(' ')} Такі відповіді записано окремо як ненадійні.</span></p>` : `<p class="note ok">${icon('check', 16)} Чудове інтерв'ю: лише запитання про факти й досвід. Відповіді записано в інсайти.</p>`; })()}<div class="row end"><button class="btn primary" data-md-close>Готово</button></div></div>`
      : `<div class="qs">${order.filter(q => !v.asked.includes(q.id)).map(q => `<button class="q-btn" data-q="${q.id}">${esc(S.qText(q))}</button>`).join('')}</div>`}`);
  };
  modal({ title: 'Інтерв\'ю з клієнтом', wide: true, cls: 'iv', html: '', onOpen: api => { draw(api); api.el.addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (!b) return; S.ask(b.dataset.q); if (S.s.interview?.asked.length >= 3) S.finishInterview(); draw(api); C.save(); }); }, onClose: () => { if (S.s.interview) S.finishInterview(); C.save(); C.render(); } });
}

/* ═════════ Бізнес-план ═════════ */
function plan(S) {
  const s = S.s, c = s.canvas, chk = S.canvasCheck(), filled = S.canvasFilled();
  const st = k => chk[k] ? `<p class="cv-st ${chk[k].s}">${icon(chk[k].s === 'ok' ? 'check' : chk[k].s === 'warn' ? 'info' : 'alert', 14)} ${esc(chk[k].m)}</p>` : '';
  const ta = (k, ph) => `<textarea class="inp" rows="3" data-in="canvas" data-k="${k}" placeholder="${esc(ph)}">${esc(c[k] || '')}</textarea>`;
  const checks = (k, items) => `<div class="cv-checks">${items.map(([id, t]) => `<label><input type="checkbox" data-in="canvasList" data-k="${k}" value="${id}" ${(c[k] || []).includes(id) ? 'checked' : ''}> ${esc(t)}</label>`).join('')}</div>`;
  const B = (k, body, cls = '') => `<div class="cv-b ${k} ${cls}"><header><b>${CANVAS[k].t}</b><small>${CANVAS[k].hint}</small></header>${body}${st(k)}</div>`;
  return `<p class="lead">Lean Canvas — бізнес-план на одній сторінці. Заповніть усі 9 блоків. Позначки показують, що підтверджено вашими даними, а що поки — лише припущення. Заповнено: <b>${filled} / 9</b>.</p>
  <div class="canvas">
    ${B('problem', ta('problem', 'Наприклад: батьки щовечора по 2 години допомагають з уроками й не можуть пояснити математику'))}
    ${B('solution', checks('solution', Object.entries(S.I.features).filter(([, f]) => !f.infra && !f.analytics).map(([id, f]) => [id, f.t])))}
    ${B('uvp', ta('uvp', 'Одне речення: чому обирають саме вас'))}
    ${B('advantage', `<div class="cv-checks">${Object.entries(ADVANTAGES).map(([id, a]) => `<label><input type="radio" name="adv" data-in="canvas" data-k="advantage" value="${id}" ${c.advantage === id ? 'checked' : ''}> ${esc(a.t)}</label>`).join('')}</div>`)}
    ${B('segment', `<select class="inp" data-in="canvas" data-k="segment"><option value="">Оберіть…</option>${S.segIds.map(k => `<option value="${k}" ${c.segment === k ? 'selected' : ''}>${esc(S.seg(k).t)}</option>`).join('')}</select>`)}
    ${B('metrics', checks('metrics', Object.entries(METRICS)))}
    ${B('channels', checks('channels', Object.entries(CHANNELS).map(([id, ch]) => [id, ch.t])))}
    ${B('costs', ta('costs', 'Зарплати, сервери, реклама, податки…'))}
    ${B('revenue', ta('revenue', `Наприклад: ${MODELS[S.modelOf(s.target)].t.toLowerCase()}, ${money(s.price[s.target])}`))}
  </div>`;
}

/* ═════════ Продукт ═════════ */
function product(S, ui) {
  const s = S.s, p = s.product, t = s.target, caps = S.caps();
  const feats = Object.entries(S.I.features);
  const back = feats.filter(([id]) => !S.has(id) && !p.queue.includes(id));
  const flag = f => [f.core && '<span class="chip sm">основа</span>', f.pay && '<span class="chip sm acc">оплата</span>', f.security && '<span class="chip sm">безпека</span>', f.infra && '<span class="chip sm">сервери</span>', f.analytics && '<span class="chip sm">аналітика</span>', f.cogs && `<span class="chip sm warn">+${f.cogs} ₴/клієнт</span>`, (S.seg().requires || []).includes(Object.keys(S.I.features).find(k => S.I.features[k] === f)) && '<span class="chip sm bad">обов\'язкова</span>'].filter(Boolean).join('');
  const card = (id, f, where) => `<div class="kb-card">
    <div class="kb-t"><b>${esc(f.t)}</b>${f.v ? dots(f.v[t] || 0) : ''}</div><p>${esc(f.desc)}</p><div class="kb-f">${flag(f)}<span class="pts" title="Скільки очок розробки">${f.cost} оч.</span></div>
    ${where === 'q' ? `<div class="prog">${meter((p.progress[id] || 0) / f.cost)}<small>${Math.round(p.progress[id] || 0)} / ${f.cost}</small></div><div class="kb-a"><button class="ib" data-act="qUp" data-id="${id}" aria-label="Вище">${icon('up', 16)}</button><button class="ib" data-act="qDown" data-id="${id}" aria-label="Нижче">${icon('down', 16)}</button><button class="ib" data-act="unqueue" data-id="${id}" aria-label="Прибрати">${icon('x', 16)}</button></div>` : ''}
    ${where === 'b' ? `<button class="btn sm" data-act="queue" data-id="${id}">${icon('plus', 14)} У роботу</button>` : ''}</div>`;
  const qWeeks = (() => { let acc = 0; return p.queue.map(id => { acc += S.feature(id).cost - (p.progress[id] || 0); return caps.dev > 0 ? Math.ceil(acc / (caps.dev * (1 - p.fix) * ({ fast: 1.3, balanced: 1, clean: .8 })[p.mode])) : Infinity; }); })();
  const sp = s.sprint, last = s.sprints.at(-1);
  return `${!p.launched ? `<section class="launch ${S.canLaunch() ? 'ready' : ''}"><div><h3>${icon('rocket')} ${S.canLaunch() ? 'Можна запускатися' : 'Продукт ще не запущено'}</h3><p>${S.canLaunch() ? `Готово функцій: ${p.built.length}. Люди з листа очікування (${num(Math.round(sum(S.segIds.map(k => s.users[k].wait))))}) отримають запрошення.` : 'Додайте функції в роботу. Коли буде готова хоч одна — можна запустити MVP.'} ${term('MVP', 'Що таке MVP?')}</p></div>${S.canLaunch() ? '<button class="btn primary lg" data-act="launch">Запустити MVP</button>' : ''}</section>` : ''}
  <div class="kpis">
    <div class="kpi"><span class="kpi-l">Швидкість розробки</span><b>${caps.dev.toFixed(1).replace('.', ',')} оч./тиж</b><small>${s.team.filter(m => m.role === 'dev').length ? 'ви + розробники' : 'лише ви'}</small></div>
    <div class="kpi ${p.quality < 50 ? 'warn' : ''}"><span class="kpi-l">Якість</span><b>${Math.round(p.quality)}%</b>${meter(p.quality / 100, { color: p.quality < 50 ? 'var(--warn)' : 'var(--ok)' })}</div>
    <div class="kpi ${p.bugs > 15 ? 'bad' : ''}"><span class="kpi-l">Баги</span><b>${Math.round(p.bugs)}</b><small>${p.bugs > 15 ? 'відганяють користувачів' : 'під контролем'}</small></div>
    <div class="kpi ${p.debt > 50 ? 'warn' : ''}"><span class="kpi-l">${term('Технічний борг')}</span><b>${Math.round(p.debt)}</b><small>сповільнює на ${Math.round(Math.min(60, p.debt / 1.6))}%</small></div>
  </div>
  <section class="card"><header class="card-h"><h3>${icon('wrench')} Як працюємо</h3></header>
    <div class="seg-ctl" role="radiogroup" aria-label="Режим розробки">${[['fast', 'Швидко', '+30% швидкості, багато багів і боргу'], ['balanced', 'Збалансовано', 'золота середина'], ['clean', 'Якісно', '−20% швидкості, майже без багів']].map(([k, t, d]) => `<button role="radio" aria-checked="${p.mode === k}" class="${p.mode === k ? 'on' : ''}" data-act="mode" data-k="${k}"><b>${t}</b><small>${d}</small></button>`).join('')}</div>
    <div class="sl"><label>Час на виправлення багів і боргу</label><input type="range" min="0" max="60" step="5" value="${Math.round(p.fix * 100)}" data-in="fix" aria-label="Відсоток часу на виправлення"><output data-out="fix">${Math.round(p.fix * 100)}%</output></div>
  </section>
  <section class="card"><header class="card-h"><h3>${icon('flag')} Спринти</h3><span class="muted sm">${S.velocity() != null ? `середня швидкість команди: ${S.velocity()} оч. за спринт` : 'плануйте роботу на 2 тижні наперед'}</span></header>
    ${sp ? `<div class="sprint"><div><b>Спринт ${sp.n}</b><small>тиждень ${s.week - sp.start + 1} з ${sp.len} · план ${sp.planned} оч.</small><ul>${sp.plan.map(id => `<li class="${S.has(id) ? 'done' : ''}">${S.has(id) ? icon('check', 14) : icon('clock', 14)} ${esc(S.feature(id).t)}</li>`).join('')}</ul></div>
      <div class="burn"><small>Діаграма згоряння: скільки роботи лишилось</small>${lineChart([{ v: sp.burn, color: 'var(--acc)', label: 'Лишилось' }, { v: Array.from({ length: sp.len + 1 }, (_, i) => sp.planned * (1 - i / sp.len)), color: '#94a3b8', label: 'Ідеально', dash: true }], { h: 120, labels: Array.from({ length: Math.max(sp.burn.length, sp.len + 1) }, (_, i) => `т${i}`) })}</div></div>`
      : `<p>Оберіть функції, які команда зобов'язується зробити за 2 тижні. Ваша швидкість зараз ≈ <b>${Math.round(caps.dev * 2 * (1 - p.fix))}</b> оч. за спринт — не беріть більше, ніж реально встигнете.</p>
      <div class="sprint-pick">${feats.filter(([id]) => !S.has(id)).map(([id, f]) => `<label><input type="checkbox" data-in="spPick" value="${id}" ${(ui.pick || []).includes(id) ? 'checked' : ''}> ${esc(f.t)} <small>${f.cost - Math.round(p.progress[id] || 0)} оч.</small></label>`).join('')}</div>
      <div class="row gap"><button class="btn primary" data-act="startSprint">Почати спринт</button><span class="muted sm" data-out="spSum">Обрано: ${sum((ui.pick || []).map(id => S.feature(id).cost - (p.progress[id] || 0)))} оч.</span></div>`}
    ${last && !last.retro ? `<div class="retro"><b>Ретроспектива спринту ${last.n}</b>: виконано ${last.done} з ${last.planned} оч. (${pct(last.done / Math.max(1, last.planned))}). Що змінимо?<div class="row gap wrap">
      <button class="btn sm" data-act="retro" data-k="focus">Менше зустрічей, більше фокусу (+10% швидкості)</button><button class="btn sm" data-act="retro" data-k="tests">Писати тести (−35% нових багів)</button><button class="btn sm" data-act="retro" data-k="pair">Робота в парах (+мораль)</button><button class="btn sm" data-act="retro" data-k="rest">Нормально відпочити (+енергія)</button></div></div>` : ''}
    ${s.sprints.length ? `<table class="tbl sm"><thead><tr><th>Спринт</th><th>План</th><th>Зроблено</th><th>%</th><th>Ретро</th></tr></thead><tbody>${s.sprints.slice(-6).reverse().map(x => `<tr><td>${x.n}</td><td>${x.planned}</td><td>${x.done}</td><td class="${x.done / Math.max(1, x.planned) >= .8 ? 'pos' : 'neg'}">${pct(x.done / Math.max(1, x.planned))}</td><td>${x.retro ? { focus: 'фокус', tests: 'тести', pair: 'пари', rest: 'відпочинок' }[x.retro] : '—'}</td></tr>`).join('')}</tbody></table>` : ''}
  </section>
  <div class="kanban">
    <section><header><b>Беклог</b><span>${back.length}</span></header>${back.map(([id, f]) => card(id, f, 'b')).join('') || '<p class="empty">Порожньо</p>'}</section>
    <section><header><b>У роботі</b><span>${p.queue.length}</span></header>${p.queue.map((id, i) => card(id, S.feature(id), 'q').replace('</div></div>', `</div><small class="eta">≈ ${Number.isFinite(qWeeks[i]) ? qWeeks[i] + ' ' + plural(qWeeks[i], 'тиждень', 'тижні', 'тижнів') : 'нікому робити'}</small></div>`)).join('') || '<p class="empty">Додайте функції з беклогу. Першу в списку роблять першою.</p>'}</section>
    <section><header><b>Готово</b><span>${p.built.length}</span></header>${p.built.map(id => card(id, S.feature(id), 'd')).join('') || '<p class="empty">Ще нічого</p>'}</section>
  </div>`;
}

/* ═════════ Бренд ═════════ */
function brand(S) {
  const s = S.s, b = s.brand, c = s.company, fit = S.brandFit(), tst = S.seg().taste || taste(s.target), F = FONTS[b.font] || FONTS.modern;
  const pos = positions(S.I), myPos = pos.find(x => x.id === b.position);
  return `<div class="grid g2">
    <section class="card brand-prev" style="--bc:${c.color}"><div class="bp-hero">${logo(c, 72)}<div><h2 style="font-family:${F.css};font-weight:${F.w}">${esc(c.name)}</h2><p>${esc(b.tone ? TONES[b.tone].ex : 'Оберіть тон спілкування')}</p></div></div>
      <p class="bp-pos">${esc(myPos ? myPos.t : 'Позиціонування ще не обрано')}</p>
      <div class="ins"><div><span>Відповідність сегменту</span><b>${pct(fit)}</b>${meter(fit, { color: fit > .7 ? 'var(--ok)' : 'var(--warn)' })}</div><div><span>Впізнаваність</span><b>${pct(b.aware, 1)}</b>${meter(b.aware / .5)}</div><div><span>Довіра до лендінгу</span><b>×${S.trustM().toFixed(2).replace('.', ',')}</b><small>множник реєстрацій</small></div><div><span>Логотип</span><b>${b.logo ? pct(b.logo.q) : '—'}</b><small>${b.logo ? (b.logo.by === 'self' ? 'зробили самі' : `від ${esc(b.logo.by)}`) : 'немає'}</small></div></div>
    </section>
    <section class="card"><header class="card-h"><h3>${icon('palette')} Логотип</h3></header>
      <p class="sm muted">Колір і символ</p><div class="swatches">${PALETTE.map(col => `<button class="sw ${c.color === col ? 'on' : ''}" style="background:${col}" data-act="brandColor" data-c="${col}" aria-label="Колір ${col}"></button>`).join('')}</div>
      <div class="syms">${SYMBOLS.map(sy => `<button class="sym ${c.sym === sy ? 'on' : ''}" data-act="brandSym" data-k="${sy}" aria-label="Символ ${sy}">${icon(sy, 20)}</button>`).join('')}</div>
      <div class="row gap wrap"><button class="btn" data-act="drawLogo">${icon('pen', 16)} Намалювати самому (6 год розробки)</button><button class="btn" data-act="go" data-to="freelance">${icon('laptop', 16)} Замовити у фрилансера</button></div>
      <p class="sm muted">Якість логотипа залежить від того, хто його робить: дизайнер-засновник чи досвідчений фрилансер зроблять краще.</p></section>
  </div>
  <section class="card"><header class="card-h"><h3>Стиль шрифту</h3><span class="muted sm">«${esc(S.seg().short)}» — вам ближче: ${tst.font.map(f => FONTS[f].t.toLowerCase()).join(' або ')}</span></header>
    <div class="pick4">${Object.entries(FONTS).map(([k, f]) => `<button class="pick ${b.font === k ? 'on' : ''}" data-act="brandSet" data-key="font" data-v="${k}"><span style="font-family:${f.css};font-weight:${f.w};font-size:24px">${esc(c.name)}</span><small>${f.t}</small></button>`).join('')}</div></section>
  <section class="card"><header class="card-h"><h3>Тон спілкування</h3></header>
    <div class="pick4">${Object.entries(TONES).map(([k, t]) => `<button class="pick ${b.tone === k ? 'on' : ''}" data-act="brandSet" data-key="tone" data-v="${k}"><b>${t.t}</b><small>«${esc(t.ex)}»</small></button>`).join('')}</div>
    <p class="sm muted">Порада: подумайте, як розмовляє ваш клієнт. Школярам — по-дружньому й весело, директорам і лікарям — по-діловому.</p></section>
  <section class="card"><header class="card-h"><h3>Позиціонування</h3><span class="muted sm">для кого ми, яку проблему розв'язуємо і чим кращі</span></header>
    <div class="radios">${pos.map(x => `<label class="${b.position === x.id ? 'on' : ''}"><input type="radio" name="pos" data-in="brandPos" value="${x.id}" ${b.position === x.id ? 'checked' : ''}> ${esc(x.t)}</label>`).join('')}</div></section>
  <section class="card"><header class="card-h"><h3>${icon('user')} Портрет клієнта</h3><span class="muted sm">уявіть одну конкретну людину</span></header>
    <div class="form2">${[['name', 'Ім\'я та вік', 'Оксана, 38 років'], ['job', 'Хто вона/він', 'бухгалтерка, двоє дітей'], ['goal', 'Чого хоче', 'щоб діти вчилися самостійно'], ['fear', 'Що заважає', 'немає часу перевіряти уроки'], ['where', 'Де буває', 'батьківські чати, Facebook']].map(([k, t, ph]) => `<label><span>${t}</span><input class="inp" data-in="persona" data-k="${k}" value="${esc(b.persona?.[k] || '')}" placeholder="${esc(ph)}"></label>`).join('')}</div></section>`;
}

/* ═════════ Маркетинг ═════════ */
function marketing(S) {
  const s = S.s, g = S.seg(), L = s.last, v = L?.visits || {}, m = s.mkt;
  const sig = T => {
    if (!T) return '';
    const p1 = T.sa / Math.max(1, T.va), p2 = T.sb / Math.max(1, T.vb), pp = (T.sa + T.sb) / Math.max(1, T.va + T.vb);
    const se = Math.sqrt(pp * (1 - pp) * (1 / Math.max(1, T.va) + 1 / Math.max(1, T.vb))), z = se ? Math.abs(p1 - p2) / se : 0;
    const win = p1 > p2 ? T.a : T.b;
    return `<div class="ab-res"><table class="tbl"><thead><tr><th>Варіант</th><th>Відвідувачі</th><th>Реєстрації</th><th>Конверсія</th></tr></thead><tbody>
      <tr class="${win === T.a ? 'win' : ''}"><td>А: «${esc(S.I.landing[T.a].t)}»</td><td>${T.va}</td><td>${T.sa}</td><td>${pct(p1, 1)}</td></tr>
      <tr class="${win === T.b ? 'win' : ''}"><td>Б: «${esc(S.I.landing[T.b].t)}»</td><td>${T.vb}</td><td>${T.sb}</td><td>${pct(p2, 1)}</td></tr></tbody></table>
      <p class="note ${z >= 1.96 ? 'ok' : 'warn'}">${icon(z >= 1.96 ? 'check' : 'info', 16)} ${z >= 1.96 ? `Різниця статистично значуща (z = ${z.toFixed(1).replace('.', ',')}): варіант ${win === T.a ? 'А' : 'Б'} справді кращий.` : `Різниця може бути випадковою (z = ${z.toFixed(1).replace('.', ',')}, потрібно від 1,96). Замало відвідувачів — повторіть тест або зачекайте на більше трафіку.`} ${term('Статистична значущість', 'Пояснення')}</p>
      <button class="btn sm" data-act="landing" data-i="${win}">Застосувати переможця</button></div>`;
  };
  const row = (k, ctl) => { const C = CHANNELS[k]; return `<div class="ch-row"><span class="ch-ic">${icon(C.icon, 20)}</span><div class="ch-t"><b>${C.t}</b><small>${C.desc}</small><small class="fit">Для «${esc(g.short)}»: ${g.fit[k] >= 1.2 ? 'дуже добре' : g.fit[k] >= .9 ? 'добре' : g.fit[k] >= .5 ? 'так собі' : 'майже не працює'}</small></div><div class="ch-ctl">${ctl}</div><div class="ch-v"><b>${num(Math.round((v[k] || 0) * S.season()))}</b><small>відвід./тиж</small></div></div>`; };
  return `<p class="lead">Маркетинг ведеться на цільовий сегмент «<b>${esc(g.t)}</b>». Сезонність зараз: ×${S.season().toFixed(2).replace('.', ',')}. ${term('Воронка', 'Що таке воронка?')} ${term('CAC', 'Що таке CAC?')}</p>
  <section class="card"><header class="card-h"><h3>${icon('megaphone')} Канали</h3><span class="muted sm">CAC за місяць: <b>${Number.isFinite(S.cac()) && S.cac() ? money(S.cac()) : '—'}</b></span></header>
    ${row('ads', `<input type="range" min="0" max="100000" step="2000" value="${m.ads}" data-in="budget" data-k="ads" aria-label="Бюджет реклами"><output data-out="b-ads">${money(m.ads)}/тиж</output>`)}
    ${row('bloggers', `<div class="stepper"><button class="ib" data-act="blog" data-d="-1" aria-label="Менше">${icon('minus', 16)}</button><b>${m.bloggers}</b><button class="ib" data-act="blog" data-d="1" aria-label="Більше">${icon('plus', 16)}</button></div><small>${money(CHANNELS.bloggers.post)} за допис</small>`)}
    ${row('social', `<input type="range" min="0" max="100" step="10" value="${Math.round(m.split * 100)}" data-in="split" aria-label="Частка контенту для соцмереж"><output data-out="split">${Math.round(m.split * 100)}% контенту</output>`)}
    ${row('seo', `<small>Решта контенту: ${Math.round((1 - m.split) * 100)}%. Години на контент — у плані тижня (зараз ${s.hours.content} год${s.team.some(x => x.role === 'mkt') ? ' + маркетолог' : ''}).</small>`)}
    ${row('events', `<input type="range" min="0" max="20" step="2" value="${m.events}" data-in="budget" data-k="events" aria-label="Години на заходи"><output data-out="b-events">${m.events} год/тиж</output>`)}
    ${g.b2b ? row('sales', `<small>Години засновника на продажі: ${s.hours.sales}${s.team.some(x => x.role === 'sales') ? ' + менеджер' : ''}.</small>`) : ''}
    ${row('referral', `<input type="range" min="0" max="${Math.max(100, Math.round(s.price[s.target] * 1.5 / 10) * 10)}" step="10" value="${m.referral}" data-in="budget" data-k="referral" aria-label="Бонус за запрошеного"><output data-out="b-referral">${m.referral ? money(m.referral) + ' за клієнта' : 'вимкнено'}</output>`)}
    <div class="ch-row wom"><span class="ch-ic">${icon('users', 20)}</span><div class="ch-t"><b>Сарафанне радіо</b><small>Задоволені користувачі приводять друзів. Залежить від NPS і впізнаваності бренду.</small></div><div class="ch-ctl"></div><div class="ch-v"><b>${num(Math.round((v.wom || 0) * S.season()))}</b><small>відвід./тиж</small></div></div>
  </section>
  ${L?.rec?.seg?.[s.target] ? (() => { const f = L.rec.seg[s.target]; return `<section class="card"><header class="card-h"><h3>${icon('chart')} Воронка минулого тижня</h3></header>${bars([{ label: 'Відвідувачі', v: f.visitors, color: '#94a3b8' }, { label: g.b2b ? 'Заявки' : 'Реєстрації', v: f.signups, color: '#0ea5e9' }, ...(g.b2b ? [] : [{ label: 'Почали користуватися', v: f.active, color: '#6366f1' }]), { label: 'Стали платними', v: f.newPaid, color: '#16a34a' }], { fmt: num })}
    <p class="sm muted">Конверсія відвідувач → ${g.b2b ? 'заявка' : 'реєстрація'}: ${pct(f.signups / Math.max(1, f.visitors), 1)}.</p></section>`; })() : ''}
  <section class="card"><header class="card-h"><h3>${icon('eye')} Лендінг і ${term('A/B-тест')}</h3></header>
    <p class="sm">Заголовок на сайті — перше, що бачить відвідувач. Оберіть варіант або перевірте два одночасно: половина трафіку побачить А, половина — Б.</p>
    <div class="radios">${S.I.landing.map((l, i) => `<label class="${s.landing.cur === i ? 'on' : ''}"><input type="radio" name="land" data-in="landing" value="${i}" ${s.landing.cur === i ? 'checked' : ''}> «${esc(l.t)}» ${s.landing.cur === i ? '<span class="chip sm acc">на сайті</span>' : ''}</label>`).join('')}</div>
    ${s.landing.test ? `<p class="note">${icon('clock', 16)} Тест іде цього тижня: «${esc(S.I.landing[s.landing.test.a].t)}» проти «${esc(S.I.landing[s.landing.test.b].t)}».</p>`
      : `<div class="row gap wrap"><select class="inp" data-in="abA" aria-label="Варіант А">${S.I.landing.map((l, i) => `<option value="${i}">А: ${esc(l.t)}</option>`).join('')}</select><select class="inp" data-in="abB" aria-label="Варіант Б">${S.I.landing.map((l, i) => `<option value="${i}" ${i === 1 ? 'selected' : ''}>Б: ${esc(l.t)}</option>`).join('')}</select><button class="btn primary" data-act="startAB">Запустити тест на тиждень</button></div>`}
    ${sig(s.landing.last)}
  </section>`;
}

/* ═════════ Акції ═════════ */
function promo(S) {
  const s = S.s, I = S.I, m = S.month();
  const MN = ['', 'Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'];
  return `<p class="lead">Акції підштовхують людей купити зараз. Але кожна знижка — це менше грошей із кожного клієнта. Найкраще вони працюють у сезон.</p>
  <section class="card"><header class="card-h"><h3>${icon('calendar')} Сезонність ідеї «${esc(I.t)}»</h3></header>
    <div class="season">${I.season.slice(1).map((v, i) => `<div class="${i + 1 === m ? 'now' : ''}"><i style="height:${v / 2 * 100}%"></i><small>${MN[i + 1]}</small></div>`).join('')}</div>
    <p class="sm muted">Зараз ${MN[m].toLowerCase()}: попит ×${S.season().toFixed(2).replace('.', ',')}.</p></section>
  <div class="grid g3">${Object.entries(PROMOS).filter(([, p]) => !p.hw || I.kind === 'hardware').map(([k, p]) => { const on = s.promos.find(x => x.id === k && x.until > s.week); return `<article class="card promo ${on ? 'on' : ''}"><h3>${icon('tag')} ${esc(p.t)}</h3><p>${esc(p.desc)}</p><small class="muted">${p.weeks} ${plural(p.weeks, 'тиждень', 'тижні', 'тижнів')}${p.cost ? ` · ${money(p.cost)}` : ''}</small>
    ${on ? `<span class="chip ok">Діє ще ${on.until - s.week} ${plural(on.until - s.week, 'тиждень', 'тижні', 'тижнів')}</span>` : `<button class="btn primary sm" data-act="promo" data-k="${k}" ${s.product.launched ? '' : 'disabled'}>Запустити</button>`}</article>`; }).join('')}
    <article class="card promo ${s.loyalty ? 'on' : ''}"><h3>${icon('heart')} ${LOYALTY.t}</h3><p>${LOYALTY.desc}</p><label class="switch"><input type="checkbox" data-in="loyalty" ${s.loyalty ? 'checked' : ''} ${s.product.launched ? '' : 'disabled'}><span></span>${s.loyalty ? 'Увімкнено' : 'Вимкнено'}</label></article>
    <article class="card promo"><h3>${icon('gift')} Реферальна програма</h3><p>Бонус за кожного запрошеного платного клієнта. Налаштовується в «Маркетингу».</p><button class="btn sm" data-act="go" data-to="marketing">Налаштувати</button></article>
  </div>
  ${s.promoLog.length ? `<section class="card"><header class="card-h"><h3>Історія акцій</h3></header><table class="tbl"><thead><tr><th>Тиждень</th><th>Акція</th><th>Сезонність</th><th>Нові платні за тиждень до / під час</th></tr></thead><tbody>${s.promoLog.slice().reverse().map(x => { const before = s.history.find(h => h.week === x.week - 1)?.newPaid ?? '—', during = s.history.find(h => h.week === x.week)?.newPaid ?? '—'; return `<tr><td>${x.week + 1}</td><td>${esc(PROMOS[x.id].t)}</td><td>×${x.season.toFixed(2).replace('.', ',')}</td><td>${before} → ${during}</td></tr>`; }).join('')}</tbody></table></section>` : ''}`;
}

export const marketViews = {
  customers: { t: 'Клієнти', icon: 'users', render: customers },
  plan: { t: 'Бізнес-план', icon: 'plan', render: plan },
  product: { t: 'Продукт', icon: 'box', render: product },
  brand: { t: 'Бренд', icon: 'palette', render: brand },
  marketing: { t: 'Маркетинг', icon: 'megaphone', render: marketing },
  promo: { t: 'Акції', icon: 'tag', render: promo },
};
export const marketActs = {
  target: (C, el) => { C.S.setTarget(el.dataset.k); C.toast(`Цільовий сегмент: ${C.S.seg().t}`, 'good'); C.render(); },
  interview: (C, el) => interviewModal(C, el.dataset.k),
  survey: C => { const r = C.S.survey(); if (r) C.toast(`Опитування: ${pct(r.pmf)} дуже засмутилися б`, r.pmf >= .4 ? 'good' : ''); C.render(); },
  launch: C => { if (C.S.launch()) { C.toast('Продукт запущено!', 'good'); C.render(); } },
  queue: (C, el) => { C.S.queue(el.dataset.id); C.render(); },
  unqueue: (C, el) => { C.S.unqueue(el.dataset.id); C.render(); },
  qUp: (C, el) => { C.S.moveQueue(el.dataset.id, -1); C.render(); },
  qDown: (C, el) => { C.S.moveQueue(el.dataset.id, 1); C.render(); },
  mode: (C, el) => { C.S.s.product.mode = el.dataset.k; C.render(); },
  startSprint: C => { const ok = C.S.startSprint(C.ui.pick || []); if (ok) { C.ui.pick = []; C.toast('Спринт розпочато', 'good'); } else C.toast('Оберіть хоча б одну функцію', 'bad'); C.render(); },
  retro: (C, el) => { C.S.retro(el.dataset.k); C.toast('Ретроспективу проведено', 'good'); C.render(); },
  brandColor: (C, el) => { C.S.s.company.color = el.dataset.c; C.render(); C.theme(); },
  brandSym: (C, el) => { C.S.s.company.sym = el.dataset.k; C.render(); C.topbar(); },
  brandSet: (C, el) => { C.S.setBrand(el.dataset.key, el.dataset.v); C.render(); },
  drawLogo: C => { const q = C.S.drawLogo(); if (q == null) C.toast('Потрібно щонайменше 6 годин на «Продукт» у плані тижня', 'bad'); else C.toast(`Логотип готовий. Якість: ${pct(q)}`, q > .6 ? 'good' : ''); C.render(); },
  blog: (C, el) => { const s = C.S.s; s.mkt.bloggers = Math.max(0, Math.min(5, s.mkt.bloggers + +el.dataset.d)); C.render(); C.topbar(); },
  landing: (C, el) => { C.S.setLanding(+el.dataset.i); C.render(); },
  startAB: C => { const a = +(document.querySelector('[data-in="abA"]')?.value ?? 0), b = +(document.querySelector('[data-in="abB"]')?.value ?? 1); if (!C.S.startAB(a, b)) C.toast('Оберіть два різні варіанти', 'bad'); else C.toast('Тест запущено — результати після завершення тижня', 'good'); C.render(); },
  promo: (C, el) => { if (C.S.startPromo(el.dataset.k)) C.toast('Акцію запущено', 'good'); else C.toast('Не вдалося: можливо, бракує грошей', 'bad'); C.render(); C.topbar(); },
};
export const marketIns = {
  canvas: (C, el) => { C.S.setCanvas(el.dataset.k, el.value); C.save(); if (el.tagName !== 'TEXTAREA') C.render(); },
  canvasList: (C, el) => { const s = C.S.s, k = el.dataset.k, cur = new Set(s.canvas[k] || []); el.checked ? cur.add(el.value) : cur.delete(el.value); C.S.setCanvas(k, [...cur]); C.render(); },
  fix: (C, el) => { C.S.s.product.fix = +el.value / 100; C.out('fix', `${el.value}%`); C.save(); },
  spPick: (C, el) => { const cur = new Set(C.ui.pick || []); el.checked ? cur.add(el.value) : cur.delete(el.value); C.ui.pick = [...cur]; const p = C.S.s.product; C.out('spSum', `Обрано: ${sum(C.ui.pick.map(id => C.S.feature(id).cost - (p.progress[id] || 0)))} оч.`); },
  brandPos: (C, el) => { C.S.setBrand('position', el.value); C.render(); },
  persona: (C, el) => { const b = C.S.s.brand; b.persona ||= {}; b.persona[el.dataset.k] = el.value; C.save(); },
  budget: (C, el) => { C.S.setBudget(el.dataset.k, +el.value); const k = el.dataset.k, v = +el.value; C.out(`b-${k}`, k === 'ads' ? `${money(v)}/тиж` : k === 'events' ? `${v} год/тиж` : v ? `${money(v)} за клієнта` : 'вимкнено'); C.topbar(); C.save(); },
  split: (C, el) => { C.S.s.mkt.split = +el.value / 100; C.out('split', `${el.value}% контенту`); C.save(); },
  landing: (C, el) => { C.S.setLanding(+el.value); C.render(); },
  loyalty: (C, el) => { C.S.s.loyalty = el.checked; C.render(); },
};
