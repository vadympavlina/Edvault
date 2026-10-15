// Симулятор міста · оболонка: карта, камера, інструменти будівництва, ігровий цикл, панелі, жителі, старт і фінал, збереження.
import { N, T, Z, B, ROADS, ZONES, CATS, SCENARIOS, TREE_COST, BULLDOZE_COST, ZONE_COST } from './data.js';
import { City, newCity, okState, money, num, pct, plural, dateText, monthText } from './sim.js';
import { Renderer, LAYERS, scale } from './render.js';
import { buildingSprite } from './sprites.js';
import { PANELS, issues, hashStr, meter } from './panels.js';
import { streetOf, concerns, thought } from './people.js';
import { packCity, unpackCity, fileName } from './file.js';
import { download, pickFile } from '../../../shared/savefile.js';
import { mayorMonth } from './bots.js';
import { esc, $, $$, h, icon, modal, confirmBox, toast, face } from './ui.js';

const KEY = 'edvault-city';
const NN = N * N;
const SPEEDS = [0, 220, 95, 30]; // мс на один день гри
let C = null, R = null;
const ui = { tool: 'select', speed: 1, panel: null, cat: null };

/* ═════════ збереження в браузері ═════════ */
function saveLocal() { if (!C || C.s.flags.demo) return; try { localStorage.setItem(KEY, JSON.stringify({ s: C.s, ui: { speed: ui.speed, panel: ui.panel, layer: R?.layer || null, cam: R?.cam } })); } catch { /* сховище переповнене */ } }
function loadLocal() { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && okState(d.s)) return d; } catch { /* немає */ } return null; }

/* ═════════ інструменти ═════════ */
const TOOLS = {
  select: { t: 'Оглянути', icon: 'pointer', kind: 'select', desc: 'Клацніть будинок — побачите, хто там живе.' },
  bulldoze: { t: 'Знести', icon: 'trash', kind: 'rect', desc: `Знести дороги, будинки, зони, дерева. ${BULLDOZE_COST} ₴ за клітинку.` },
  road: { t: ROADS.road.t, icon: 'road', kind: 'line', road: 'road', desc: ROADS.road.desc, cost: ROADS.road.cost },
  avenue: { t: ROADS.avenue.t, icon: 'road', kind: 'line', road: 'avenue', desc: ROADS.avenue.desc, cost: ROADS.avenue.cost },
  zr: { t: ZONES[1].t, icon: 'home', kind: 'rect', zone: Z.R, desc: ZONES[1].desc, cost: ZONE_COST, color: ZONES[1].color },
  zc: { t: ZONES[2].t, icon: 'shop', kind: 'rect', zone: Z.C, desc: ZONES[2].desc, cost: ZONE_COST, color: ZONES[2].color },
  zi: { t: ZONES[3].t, icon: 'factory', kind: 'rect', zone: Z.I, desc: ZONES[3].desc, cost: ZONE_COST, color: ZONES[3].color },
  dezone: { t: 'Зняти зону', icon: 'x', kind: 'rect', zone: 0, desc: 'Прибрати зону з ділянок.' },
  trees: { t: 'Посадити дерева', icon: 'tree', kind: 'rect', desc: `Дерева очищують повітря й прикрашають район. ${TREE_COST} ₴ за клітинку.`, cost: TREE_COST },
};
for (const [k, D] of Object.entries(B)) if (D.cat !== 'none') TOOLS['b_' + k] = { t: D.t, kind: 'build', type: k, desc: D.desc, cost: D.cost };
const CAT_TOOLS = {
  road: ['road', 'avenue', 'bulldoze'], zone: ['zr', 'zc', 'zi', 'dezone'],
  power: ['b_coal', 'b_gas', 'b_wind', 'b_solar', 'b_nuclear'], edu: ['b_school', 'b_lyceum', 'b_uni', 'b_library'],
  safe: ['b_clinic', 'b_hospital', 'b_police', 'b_fire'], transit: ['b_depot', 'b_stop', 'b_bikes', 'b_metro'],
  eco: ['b_park', 'b_bigpark', 'b_plaza', 'trees', 'b_recycle', 'b_landfill', 'b_stadium'],
};

/* ═════════ розмітка ═════════ */
const app = $('#app');
app.innerHTML = `<canvas id="map" aria-label="Карта міста"></canvas>
  <header class="top" id="top"></header>
  <nav class="rail" id="rail" aria-label="Панелі">${Object.entries(PANELS).map(([k, p]) => `<button class="rl" data-act="panel" data-k="${k}" title="${esc(p.t)}" aria-label="${esc(p.t)}">${icon(p.icon, 20)}<span class="bdg" data-badge="${k}"></span></button>`).join('')}</nav>
  <aside class="panel" id="panel" aria-label="Панель"></aside>
  <div class="layers" id="layers"></div>
  <div class="legend-box" id="legend"></div>
  <nav class="tools" id="tools" aria-label="Будівництво"></nav>
  <div class="fly" id="fly"></div>
  <div class="voice" id="voice"></div>
  <div class="tip" id="tip"></div>
  <div class="insp" id="insp"></div>`;
const cv = $('#map');

/* ═════════ верхня панель ═════════ */
const topCache = {};
function topPart(k, html) {
  if (topCache[k] === html) return;
  topCache[k] = html;
  const top = $('#top');
  let el = top.querySelector(`:scope > [data-part="${k}"]`);
  if (!el) { el = document.createElement('div'); el.dataset.part = k; el.style.display = 'contents'; top.append(el); }
  el.innerHTML = html;
}
function top() {
  if (!C) return;
  const s = C.s, M = C.m, last = s.history.at(-1), d = s.demand;
  const db = (v, c) => `<i class="dmd" style="--v:${Math.round(Math.max(0, v) * 100)}%;--c:${c}"></i>`;
  // панель перебудовується частинами й лише тоді, коли частина змінилась: кнопка під курсором
  // не повинна зникати посеред кліку (інакше клік губиться)
  topPart('info', `<div class="tp-city"><b>${esc(s.name)}</b><small>${dateText(s.month, s.day)}</small></div>
    <div class="tp-stats">
      <span class="tp ${s.money < 0 ? 'bad' : ''}" title="Гроші в казні">${icon('coins', 16)}<b>${money(s.money)}</b>${last ? `<em class="${last.balance >= 0 ? 'up' : 'down'}">${last.balance >= 0 ? '+' : '−'}${num(Math.abs(last.balance))}/міс</em>` : ''}</span>
      <span class="tp" title="Жителі">${icon('users', 16)}<b>${num(M.P)}</b></span>
      <span class="tp hide-s ${s.approval < 45 ? 'bad' : ''}" title="Підтримка мера">${icon(s.approval >= 50 ? 'smile' : 'frown', 16)}<b>${Math.round(s.approval)}%</b></span>
      <span class="tp hide-m demand" title="Попит: житло, магазини, заводи">${db(d.r, '#22c55e')}${db(d.c, '#3b82f6')}${db(d.i, '#eab308')}</span>
    </div>`);
  topPart('speed', `<div class="speed" role="group" aria-label="Швидкість часу">${[[0, 'pause', 'Пауза'], [1, 'play', 'Звичайна швидкість'], [2, 'fast', 'Швидко'], [3, 'fast', 'Дуже швидко']].map(([v, ic, t]) => `<button class="${ui.speed === v ? 'on' : ''}" data-act="speed" data-k="${v}" title="${t}" aria-label="${t}">${icon(ic, 15)}${v === 3 ? '<sup>3</sup>' : ''}</button>`).join('')}</div>`);
  topPart('btns', `<button class="btn sm hide-s" data-act="dayNight" title="Освітлення">${icon(R?.alwaysDay ? 'sun' : 'moon', 15)}</button>
    <button class="btn sm save" data-act="saveFile" title="Зберегти місто у файл (Ctrl+S)">${icon('save', 15)}<span class="hide-m">Зберегти</span></button>
    <button class="btn sm hide-s" data-act="openFile" title="Відкрити місто з файлу (Ctrl+O)">${icon('open', 15)}</button>`);
  // значки на панелях
  const unread = s.inbox.filter(m => (m.choices && m.chosen == null) || !m.read).length;
  const set = (k, v) => { const b = $(`[data-badge="${k}"]`); if (b) { b.textContent = v || ''; b.classList.toggle('on', !!v); } };
  set('inbox', unread); set('overview', issues(C).filter(x => x.lvl >= 3).length ? '!' : '');
}

/* ═════════ панель інструментів ═════════ */
function tools() {
  $('#tools').innerHTML = `<button class="tl ${ui.tool === 'select' ? 'on' : ''}" data-act="tool" data-k="select" title="Оглянути">${icon('pointer', 20)}<small>Оглянути</small></button>
    ${CATS.map(c => `<button class="tl ${ui.cat === c.id || (CAT_TOOLS[c.id] || []).includes(ui.tool) ? 'on' : ''}" data-act="cat" data-k="${c.id}" title="${esc(c.t)}">${icon(c.icon, 20)}<small>${esc(c.t.split(' ')[0])}</small></button>`).join('')}
    <button class="tl ${ui.tool === 'bulldoze' ? 'on' : ''}" data-act="tool" data-k="bulldoze" title="Знести">${icon('trash', 20)}<small>Знести</small></button>
    <button class="tl ${R?.layer ? 'on' : ''}" data-act="layersBtn" title="Шари даних">${icon('layers', 20)}<small>Шари</small></button>`;
  const fly = $('#fly');
  if (ui.cat) {
    fly.innerHTML = `<div class="fly-in">${CAT_TOOLS[ui.cat].map(k => { const T0 = TOOLS[k], D = B[T0.type], locked = D && !C.unlocked(T0.type), lockMsg = locked ? `від ${num(D.unlock)} жителів` : D?.needUni && !Object.values(C.s.bld).some(b => b.type === 'uni') ? 'потрібен університет' : '';
      return `<button class="fi ${ui.tool === k ? 'on' : ''} ${lockMsg ? 'locked' : ''}" data-act="tool" data-k="${k}" ${lockMsg ? 'aria-disabled="true"' : ''}><span class="fi-ic" style="${T0.color ? `--zc:${T0.color}` : ''}">${D ? bIcon(T0.type) : icon(T0.icon, 22)}</span><b>${esc(T0.t)}</b><small>${lockMsg || (T0.cost ? money(T0.cost) + (T0.kind === 'build' ? '' : ' / клітинка') : '')}</small>${D?.upkeep ? `<small class="muted">${money(D.upkeep)}/міс</small>` : ''}</button>`; }).join('')}</div>
      <p class="fly-d">${esc(TOOLS[ui.tool]?.desc || 'Оберіть, що будувати.')}</p>`;
    fly.classList.add('on');
  } else fly.classList.remove('on');
}
// маленька картинка будівлі для меню — з того самого спрайта
const bIconCache = new Map();
function bIcon(type) {
  if (!bIconCache.has(type)) {
    const spr = buildingSprite(type), c = document.createElement('canvas'); c.width = 88; c.height = 72;
    const g = c.getContext('2d'), k = Math.min(86 / spr.W, 70 / spr.H); g.drawImage(spr.day, (88 - spr.W * k) / 2, (72 - spr.H * k) / 2, spr.W * k, spr.H * k);
    if (type === 'wind') { // лопаті вітряка малюються анімацією, тож для іконки — статична турбіна
      const x = 44, top = 14; g.strokeStyle = '#d1d5db'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 58); g.lineTo(x, top); g.stroke();
      g.fillStyle = '#f8fafc'; g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 0.8;
      for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * Math.PI * 2 / 3; g.beginPath(); g.moveTo(x, top); g.lineTo(x + Math.cos(a - 0.12) * 6, top + Math.sin(a - 0.12) * 6); g.lineTo(x + Math.cos(a) * 24, top + Math.sin(a) * 24); g.lineTo(x + Math.cos(a + 0.14) * 5, top + Math.sin(a + 0.14) * 5); g.closePath(); g.fill(); g.stroke(); }
      g.fillStyle = '#94a3b8'; g.beginPath(); g.arc(x, top, 3, 0, Math.PI * 2); g.fill();
    }
    bIconCache.set(type, `<img src="${c.toDataURL()}" alt="">`);
  }
  return bIconCache.get(type);
}

/* ═════════ шари даних ═════════ */
function layers() {
  const L = $('#layers');
  L.innerHTML = ui.showLayers ? `<div class="ly-in"><header><b>Шари даних</b><button class="ib" data-act="layersBtn" aria-label="Закрити">${icon('x', 16)}</button></header>${[['', 'Без шару'], ...Object.entries(LAYERS).map(([k, x]) => [k, x.t])].map(([k, t]) => `<button class="ly ${(R.layer || '') === k ? 'on' : ''}" data-act="layer" data-k="${k}">${esc(t)}</button>`).join('')}</div>` : '';
  const Lg = R.layer && LAYERS[R.layer];
  $('#legend').innerHTML = Lg ? `<b>${esc(Lg.t)}</b><span class="grad" style="background:linear-gradient(90deg,${Lg.colors.join(',')})"></span><span class="lh"><small>${esc(Lg.lo)}</small><small>${esc(Lg.hi)}</small></span><button class="ib" data-act="layer" data-k="" aria-label="Прибрати шар">${icon('x', 14)}</button>` : '';
  $('#legend').classList.toggle('on', !!Lg);
}

/* ═════════ панель праворуч ═════════ */
function panel() {
  const P = $('#panel');
  $$('.rl').forEach(b => b.classList.toggle('on', b.dataset.k === ui.panel));
  if (!ui.panel || !C) { P.classList.remove('on'); P.innerHTML = ''; return; }
  const p = PANELS[ui.panel], sc = P.querySelector('.pn-b')?.scrollTop || 0;
  P.innerHTML = `<header class="pn-h"><h2>${icon(p.icon, 20)} ${esc(p.t)}</h2><button class="ib" data-act="panel" data-k="${ui.panel}" aria-label="Закрити">${icon('x', 20)}</button></header><div class="pn-b">${p.render(C, ui)}</div>`;
  P.classList.add('on');
  if (ui.keepScroll) P.querySelector('.pn-b').scrollTop = sc;
  ui.keepScroll = false;
}
const refreshPanel = () => { ui.keepScroll = true; panel(); };

/* ═════════ огляд клітинки: родини, будівля ═════════ */
const LVL_R = ['Ділянка', 'Приватний будинок', 'Таунхаус', 'Багатоповерхівка', 'Висотка'], LVL_C = ['Ділянка', 'Крамничка', 'Магазини й кафе', 'Офісний центр', 'Бізнес-хмарочос'], LVL_I = ['Ділянка', 'Склад', 'Цех', 'Завод', 'Технопарк'];
const SHOP = ['«Смачна пекарня»', 'Кав’ярня «Зерно»', 'Аптека «Здоров’я»', 'Супермаркет «Кошик»', 'Книгарня «Сторінка»', 'Квіти «Мак»', 'Піцерія «Скибка»', 'Салон «Стиль»', 'IT-хаб «Код»', 'Агенція «Ідея»'];
const FIRM = ['«МеталПром»', '«ЕкоПак»', '«Агромаш»', '«Будсталь»', '«Тканина»', '«ХімСинтез»', '«ЛісДеталь»'], HT = ['«РобоЛаб»', '«КвантСофт»', '«БіоТех»', '«СоларТек»', '«ДронІнжиніринг»'];
function inspect(i) {
  const s = C.s, M = C.m, el = $('#insp');
  if (i < 0) { el.classList.remove('on'); ui.insp = -1; return; }
  ui.insp = i;
  const x = i % N, y = (i / N) | 0, b = s.bid[i] ? s.bld[s.bid[i]] : null, z = s.zone[i];
  const stat = (t, v, max, bad, fmt) => { const k = Math.max(0, Math.min(1, v / max)); return `<div class="st"><span>${t}</span>${meter(k, bad ? (k > 0.6 ? 'var(--bad)' : k > 0.3 ? 'var(--warn)' : 'var(--ok)') : (k < 0.3 ? 'var(--bad)' : k < 0.6 ? 'var(--warn)' : 'var(--ok)'))}<b>${fmt ? fmt(v) : Math.round(v)}</b></div>`; };
  let body = '';
  if (b) {
    const D = B[b.type];
    body = `<header><div><b>${esc(D.t)}</b><small>${esc(streetOf(C, i))}</small></div></header><p class="sm">${esc(D.desc)}</p>
      <div class="sts">${D.power > 0 ? stat('Дає енергії', b._out || 0, D.power, false, v => `${Math.round(v)} МВт`) + stat('Завантаження', (b._util ?? 0) * 100, 100, false, v => Math.round(v) + '%') : ''}
      ${D.cap ? stat('Заповненість', (b._load || 0) * 100, 150, true, v => Math.round(v) + '%') : ''}
      ${D.upkeep ? `<div class="st"><span>Утримання</span><b>${money(D.upkeep)}/міс</b></div>` : ''}</div>
      ${b._road < 0 && !D.onRoad && D.cat !== 'eco' ? `<p class="note bad">${icon('alert', 15)} Немає дороги поруч — будівля не працює.</p>` : D.power < 0 && b._on === false ? `<p class="note bad">${icon('bolt', 15)} Немає світла.</p>` : ''}
      ${D.cap > 0 && (b._load || 0) > 1 ? `<p class="note warn">${icon('alert', 15)} Переповнено: людей більше, ніж місць. Збудуйте ще одну поруч.</p>` : ''}
      ${b.type !== 'townhall' ? `<button class="btn sm danger" data-act="demolish" data-i="${i}">${icon('trash', 14)} Знести</button>` : ''}`;
  } else if (z && (s.lvl[i] || s.aban[i])) {
    const lvl = s.lvl[i], names = z === Z.R ? LVL_R : z === Z.C ? LVL_C : LVL_I;
    const fams = s.families.filter(f => f.i === i), v = hashStr(String(i));
    const name = z === Z.C ? SHOP[v % SHOP.length] : z === Z.I ? (s.ht[i] ? HT[v % HT.length] : FIRM[v % FIRM.length]) : '';
    const { bad, good } = concerns(C, i, fams[0]);
    body = `<header><div><b>${esc(s.aban[i] ? 'Покинута будівля' : (name ? name + ' · ' : '') + names[lvl])}</b><small>${esc(streetOf(C, i))}, ${(v % 97) + 1}</small></div><span class="zt" style="background:${ZONES[z].color}">${ZONES[z].short}</span></header>
      ${z === Z.R ? `<p class="sm">${num(M.pop[i])} жителів${fams.length ? '' : ''}</p>` : `<p class="sm">${num(z === Z.C ? [0, 8, 28, 80, 190][lvl] : [0, 16, 45, 110, 220][lvl])} робочих місць${s.ht[i] ? ' · чисті високі технології' : ''}</p>`}
      ${s.aban[i] ? `<p class="note bad">${icon('alert', 15)} Люди покинули будівлю: ${M.powered[i] ? 'тут погано жити або працювати' : 'немає світла'}.</p>` : ''}
      ${fams.map(f => famCard(f)).join('')}
      <div class="sts">${z === Z.R ? stat('Щастя', M.happy[i], 100) : ''}${stat('Повітря (бруд)', M.poll[i], 100, true)}${stat('Вартість землі', M.lv[i], 100)}${z === Z.R ? stat('Дорога на роботу', M.commute[i], 80, true, v => Math.round(v) + ' хв') : ''}${stat('Злочинність', M.crime[i], 100, true)}${stat('Школа поруч', M.cov.school[i] * 100, 100)}${stat('Парк поруч', M.cov.park[i] * 100, 100)}${stat('Транспорт', M.transit[i] * 100, 75)}</div>
      ${z === Z.R && (bad.length || good.length) ? `<p class="sm"><b>Що впливає:</b> ${[...bad.slice(0, 3).map(([k]) => `<span class="tag bad">${WHY[k] || k}</span>`), ...good.slice(0, 3).map(k => `<span class="tag ok">${WHY[k] || k}</span>`)].join(' ')}</p>` : ''}`;
  } else if (z) body = `<header><div><b>${ZONES[z].t} зона</b><small>${esc(streetOf(C, i))}</small></div></header><p class="sm">${M.roadDist[i] > 3 ? 'Потрібна дорога ближче ніж за 3 клітинки.' : !M.powered[i] ? 'Потрібна електрика: станція біля доріг цього району.' : s.demand[ZONES[z].id] < 0 ? 'Попиту на такі будівлі зараз немає.' : 'Скоро тут почнеться будівництво.'}</p>`;
  else if (s.road[i]) body = `<header><div><b>${s.road[i] === 2 ? 'Проспект' : 'Дорога'}</b><small>${esc(streetOf(C, i))}</small></div></header><div class="sts">${stat('Завантаженість', M.cong[i] * 100, 150, true, v => Math.round(v) + '%')}<div class="st"><span>Машин за ранок</span><b>${num(M.load[i])}</b></div></div>`;
  else body = `<header><div><b>${s.ter[i] === T.WATER ? 'Вода' : s.ter[i] === T.TREE ? 'Ліс' : 'Вільна ділянка'}</b><small>${x}, ${y}</small></div></header><div class="sts">${stat('Повітря (бруд)', M.poll[i], 100, true)}${stat('Вартість землі', M.lv[i], 100)}</div>`;
  el.innerHTML = `<button class="ib close" data-act="inspClose" aria-label="Закрити">${icon('x', 18)}</button>${body}`;
  el.classList.add('on');
}
const WHY = { blackout: 'немає світла', smog: 'брудне повітря', jam: 'затори', noJob: 'немає роботи', noSchool: 'школа далеко', noHealth: 'лікар далеко', crime: 'злочинність', taxes: 'податки', garbage: 'сміття', noPark: 'немає зелені', park: 'парк поруч', bus: 'зручний транспорт', cleanAir: 'чисте повітря', school: 'хороша школа', uni: 'університет', health: 'лікар поруч', safe: 'безпечно', lowTax: 'помірні податки', rent: 'престижний район', happy: 'усе подобається', goodJob: 'робота поруч' };
function famCard(f) {
  const t = thought(C, f.i, f, () => ((hashStr(f.id) + C.s.month * 7) % 100) / 100);
  return `<article class="fam-card"><header><b>Родина ${esc(f.last)}</b><span class="mood ${f.mood < 40 ? 'bad' : f.mood < 60 ? 'warn' : 'ok'}">${icon(f.mood >= 55 ? 'smile' : 'frown', 14)} ${f.mood}</span></header>
    <div class="members">${f.members.map(m => `<div class="mem">${face(hashStr(f.id + m.n), { fem: m.f, age: m.age, mood: f.mood, size: 42 })}<span><b>${esc(m.n)}</b><small>${m.age} ${plural(m.age, 'рік', 'роки', 'років')}${m.age < 7 ? ' · садочок' : m.age < 18 ? ' · школа' : m.age >= 65 ? ' · пенсія' : m.job ? ' · ' + esc(m.job) : ' · шукає роботу'}</small></span></div>`).join('')}</div>
    <p class="thought ${t.bad ? 'bad' : ''}">${icon('info', 14)} «${esc(t.text)}»</p>
    <small class="muted">${f.pet ? `Улюбленець: ${esc(f.pet)}. ` : ''}Захоплення: ${esc(f.hobby)}. У місті з ${monthText(f.since)}.</small></article>`;
}

/* ═════════ голос жителя (спливає внизу) ═════════ */
let voiceT = 0;
function voice(n) {
  if (!n || !['voice', 'leave', 'arrive', 'alert'].includes(n.kind)) return;
  const el = $('#voice');
  el.innerHTML = `${n.kind === 'alert' ? `<span class="sys">${icon('alert', 20)}</span>` : face(hashStr(n.who), { fem: n.f, age: 35, mood: n.bad ? 25 : 75, size: 40 })}<div><b>${esc(n.who)}</b><p>${esc(n.text)}</p></div>`;
  el.dataset.i = n.i ?? -1; el.className = `voice on ${n.bad ? 'bad' : ''}`;
  clearTimeout(voiceT); voiceT = setTimeout(() => el.classList.remove('on'), 6500);
}

/* ═════════ курсор, перетягування, будівництво ═════════ */
const ptrs = new Map();
let drag = null, pinch = null, lastTip = '';
const tileAt = e => { const r = cv.getBoundingClientRect(); return R.s2tile(e.clientX - r.left, e.clientY - r.top); };
const inMap = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
function linePath(x0, y0, x1, y1) { const out = []; const sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0); let x = x0, y = y0; out.push(y * N + x); while (x !== x1) { x += sx; out.push(y * N + x); } while (y !== y1) { y += sy; out.push(y * N + x); } return out.filter(i => i >= 0 && i < NN); }
function rectTiles(x0, y0, x1, y1) { const out = []; for (let y = Math.max(0, Math.min(y0, y1)); y <= Math.min(N - 1, Math.max(y0, y1)); y++) for (let x = Math.max(0, Math.min(x0, x1)); x <= Math.min(N - 1, Math.max(x0, x1)); x++) out.push(y * N + x); return out; }
function previewFor(x, y, d) {
  const T0 = TOOLS[ui.tool]; if (!T0 || T0.kind === 'select') return null;
  if (T0.kind === 'build') { const S = B[T0.type].size, bx = x - Math.floor((S - 1) / 2), by = y - Math.floor((S - 1) / 2), r = C.canBuild(T0.type, bx, by); return { type: T0.type, x: bx, y: by, ok: r.ok, msg: r.ok ? `${T0.t} · ${money(r.cost)}` : r.msg, r: B[T0.type].r < 99 ? B[T0.type].r : 0 }; }
  const tiles = !d ? [y * N + x] : T0.kind === 'line' ? linePath(d.x, d.y, x, y) : rectTiles(d.x, d.y, x, y);
  let cost = 0, n = tiles.length, ok = true, msg = '';
  if (T0.road) ({ cost, n } = C.roadCost(tiles, T0.road));
  else if (T0.zone != null) ({ cost, n } = T0.zone ? C.zoneCost(tiles, T0.zone) : { cost: 0, n: tiles.length });
  else if (ui.tool === 'trees') { n = tiles.filter(i => C.s.ter[i] === T.GRASS && !C.s.road[i] && !C.s.bid[i] && !C.s.zone[i]).length; cost = n * TREE_COST; }
  else if (ui.tool === 'bulldoze') cost = n * BULLDOZE_COST;
  ok = cost <= C.s.money; msg = `${T0.t} · ${n} ${plural(n, 'клітинка', 'клітинки', 'клітинок')}${cost ? ' · ' + money(cost) : ''}${ok ? '' : ' — не вистачає грошей'}`;
  return { tiles, ok, msg, color: T0.zone ? T0.color + '66' : ui.tool === 'bulldoze' ? 'rgba(239,68,68,.35)' : null };
}
function tip(e, text, bad) { const el = $('#tip'); if (!text) { el.classList.remove('on'); return; } if (text !== lastTip) { el.textContent = text; lastTip = text; } el.className = `tip on ${bad ? 'bad' : ''}`; el.style.left = e.clientX + 14 + 'px'; el.style.top = e.clientY + 16 + 'px'; }
function apply(p) {
  const T0 = TOOLS[ui.tool]; let r;
  if (T0.kind === 'build') r = C.build(T0.type, p.x, p.y);
  else if (T0.road) r = C.placeRoad(p.tiles, T0.road);
  else if (T0.zone != null) r = C.placeZone(p.tiles, T0.zone);
  else if (ui.tool === 'trees') r = C.plantTrees(p.tiles);
  else if (ui.tool === 'bulldoze') r = C.bulldoze(p.tiles);
  if (!r) return;
  if (!r.ok) toast(r.msg, 'bad');
  else { C.recompute(); R.preview = null; top(); if (ui.cat) tools(); if (ui.panel) refreshPanel(); saveSoon(); if (T0.kind === 'build') sfx(); }
}
function sfx() { /* місце для звуку будівництва */ }
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  if (!C) return;
  cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; drag = null; return; }
  const [x, y] = tileAt(e), T0 = TOOLS[ui.tool];
  const panMode = e.button === 1 || e.button === 2 || T0.kind === 'select' || T0.kind === 'build' && e.pointerType === 'touch';
  drag = { x, y, sx: e.clientX, sy: e.clientY, pan: panMode, moved: false, button: e.button };
});
cv.addEventListener('pointermove', e => {
  if (!C) return;
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, r = cv.getBoundingClientRect(); R.zoomAt(d / pinch.d, cx - r.left, cy - r.top); R.pan(cx - pinch.cx, cy - pinch.cy); pinch = { d, cx, cy }; return; }
  const [x, y] = tileAt(e);
  R.hover = inMap(x, y) ? y * N + x : -1;
  if (drag?.pan) { const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; if (drag.moved) { R.pan(e.movementX || dx, e.movementY || dy); if (!e.movementX && !e.movementY) { drag.sx = e.clientX; drag.sy = e.clientY; } } tip(e); return; }
  if (!inMap(x, y)) { R.preview = null; tip(e); return; }
  const p = previewFor(x, y, drag && !drag.pan ? drag : null);
  R.preview = p; if (p) tip(e, p.msg, !p.ok); else tip(e);
});
cv.addEventListener('pointerup', e => {
  ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
  if (!C || !drag) return;
  const d = drag; drag = null;
  const [x, y] = tileAt(e);
  if (d.pan) { if (!d.moved && TOOLS[ui.tool].kind === 'select' && d.button === 0) inspect(inMap(x, y) ? y * N + x : -1); else if (!d.moved && TOOLS[ui.tool].kind === 'build' && inMap(x, y)) { const p = previewFor(x, y, null); if (p) apply(p); } return; }
  if (!inMap(x, y) && TOOLS[ui.tool].kind !== 'line') return;
  const p = previewFor(Math.max(0, Math.min(N - 1, x)), Math.max(0, Math.min(N - 1, y)), TOOLS[ui.tool].kind === 'build' ? null : d);
  if (p) apply(p);
});
cv.addEventListener('pointerleave', () => { R && (R.hover = -1); tip({}); });
cv.addEventListener('wheel', e => { if (!R) return; e.preventDefault(); const r = cv.getBoundingClientRect(); R.zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top); }, { passive: false });

/* ═════════ дії ═════════ */
function setTool(k) { ui.tool = k; if (k === 'select' || k === 'bulldoze') ui.cat = null; R.preview = null; if (k !== 'select') inspect(-1); tools(); }
const ACTS = {
  panel: k => { ui.panel = ui.panel === k ? null : k; panel(); if (ui.panel === 'inbox') top(); },
  cat: k => { ui.cat = ui.cat === k ? null : k; if (ui.cat && !CAT_TOOLS[k].includes(ui.tool)) ui.tool = CAT_TOOLS[k][0]; if (!ui.cat) ui.tool = 'select'; R.preview = null; tools(); },
  tool: (k, el) => { if (el.getAttribute('aria-disabled') === 'true') { toast(el.querySelector('small')?.textContent ? `Поки недоступно: ${el.querySelector('small').textContent}` : 'Поки недоступно', 'bad'); return; } setTool(k); },
  speed: k => { ui.speed = +k; top(); },
  layer: k => { R.layer = k || null; layers(); tools(); },
  layersBtn: () => { ui.showLayers = !ui.showLayers; layers(); },
  dayNight: () => { R.alwaysDay = !R.alwaysDay; top(); },
  inspClose: () => inspect(-1),
  demolish: (_, el) => { const r = C.bulldoze([+el.dataset.i]); if (r.ok) { C.recompute(); inspect(-1); toast('Знесено'); } else toast(r.msg, 'bad'); },
  goto: (_, el) => { const i = +el.dataset.i; if (i < 0) return; R.center(i % N, (i / N) | 0); R.cam.z = Math.max(R.cam.z, 1.3); inspect(i); if (innerWidth < 900) { ui.panel = null; panel(); } },
  series: k => { const a = ui.charts ||= ['pop', 'happy']; const j = a.indexOf(k); if (j >= 0) a.splice(j, 1); else { a.push(k); if (a.length > 3) a.shift(); } refreshPanel(); },
  hyp: (_, el) => { ui.labX = el.dataset.x; ui.labY = el.dataset.y; refreshPanel(); },
  peopleF: k => { ui.peopleF = k; refreshPanel(); },
  mail: (_, el) => { ui.mail = el.dataset.id; const m = C.s.inbox.find(x => x.id === el.dataset.id); if (m && !m.choices) m.read = true; refreshPanel(); top(); },
  choose: (_, el) => { const r = C.choose(el.dataset.id, +el.dataset.i); if (r) toast(r, 'good'); refreshPanel(); top(); saveSoon(); },
  policy: k => { const on = C.togglePolicy(k); toast(on ? 'Політику запроваджено' : 'Політику скасовано', on ? 'good' : ''); refreshPanel(); saveSoon(); },
  loan: k => { const r = C.takeLoan(+k); toast(r.ok ? `Кредит отримано: ${money(+k)}` : r.msg, r.ok ? 'good' : 'bad'); refreshPanel(); top(); },
  repay: k => { toast(C.repayLoan(+k) ? 'Кредит погашено' : 'Не вистачає грошей', 'good'); refreshPanel(); top(); },
  print: () => print(),
  saveFile: () => saveFile(), openFile: () => openFile(),
  newGame: () => confirmBox('Почати нове місто?', 'Почати', { danger: true, sub: 'Поточне місто буде замінено. Якщо воно потрібне — спершу збережіть його у файл.' }).then(ok => ok && start()),
};
document.addEventListener('click', e => {
  const v = e.target.closest('#voice'); if (v && C) { const i = +v.dataset.i; if (i >= 0) ACTS.goto(null, { dataset: { i } }); return; }
  const a = e.target.closest('[data-act]'); if (!a || !C) { if (a?.dataset.act === 'openFile') openFile(); return; }
  ACTS[a.dataset.act]?.(a.dataset.k, a, e);
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-in]'); if (!el || !C) return;
  const k = el.dataset.in;
  if (k === 'tax') { C.setTax(el.dataset.k, +el.value); $(`[data-out="tax-${el.dataset.k}"]`).textContent = el.value + '%'; }
  if (k === 'fund') { C.setFunding(el.dataset.k, +el.value); $(`[data-out="fund-${el.dataset.k}"]`).textContent = el.value + '%'; }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-in]'); if (!el || !C) return;
  if (el.dataset.in === 'labX' || el.dataset.in === 'labY') { ui[el.dataset.in] = el.value; refreshPanel(); }
  if (el.dataset.in === 'tax' || el.dataset.in === 'fund') { C.log(`${el.dataset.in === 'tax' ? 'Податок' : 'Фінансування'} «${{ r: 'житло', c: 'магазини й офіси', i: 'заводи', edu: 'освіта', health: 'медицина', police: 'поліція', fire: 'пожежники', transit: 'транспорт', park: 'парки' }[el.dataset.k]}»: ${el.value}%.`); saveSoon(); }
});
document.addEventListener('keydown', e => {
  if (!C || e.target.closest('input, textarea, select')) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); saveFile(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'o') { e.preventDefault(); openFile(); return; }
  if (k === 'escape') { if (ui.tool !== 'select') setTool('select'); else inspect(-1); ui.cat = null; tools(); }
  if (k === ' ') { e.preventDefault(); ui.speed = ui.speed ? 0 : (ui.lastSpeed || 1); if (ui.speed) ui.lastSpeed = ui.speed; top(); }
  const step = 60; if (k === 'arrowleft' || k === 'a') R.pan(step, 0); if (k === 'arrowright' || k === 'd') R.pan(-step, 0); if (k === 'arrowup' || k === 'w') R.pan(0, step); if (k === 'arrowdown' || k === 's') R.pan(0, -step);
  if (k === '+' || k === '=') R.zoomAt(1.15); if (k === '-') R.zoomAt(1 / 1.15);
});
addEventListener('resize', () => R?.resize());
document.addEventListener('dragover', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); document.body.classList.add('drop-on'); } });
document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('drop-on'); });
document.addEventListener('drop', e => { document.body.classList.remove('drop-on'); const f = e.dataTransfer?.files?.[0]; if (!f) return; e.preventDefault(); readFile(f); });
addEventListener('pagehide', saveLocal);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveLocal(); });
let saveT = 0; const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(saveLocal, 800); };

/* ═════════ файл ═════════ */
function saveFile() {
  if (!C || C.s.flags.demo) return;
  C.s.flags.fileMonth = C.s.month; C.s.flags.fileSaves = (C.s.flags.fileSaves || 0) + 1;
  const name = fileName(C.s); download(new Blob([JSON.stringify(packCity(C, { panel: ui.panel, layer: R.layer, cam: R.cam }))], { type: 'application/json' }), name);
  saveLocal(); toast(`Місто збережено у файл ${name}`, 'good');
}
async function openFile() { const f = await pickFile('.json,application/json'); if (f) readFile(f); }
function readFile(f) { const r = new FileReader(); r.onload = () => loadText(String(r.result)); r.onerror = () => toast('Не вдалося прочитати файл', 'bad'); r.readAsText(f, 'utf-8'); }
function loadText(text) {
  const res = unpackCity(text); if (!res.ok) { toast(res.error, 'bad'); return; }
  const T0 = new City(res.state); T0.recompute(); const st = T0.s, m = T0.metrics();
  const row = (k, v) => `<tr><td>${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`;
  modal({ title: 'Відкрити місто з файлу', cls: 'file-open', html: `<table class="tbl">${row('Мер (учень)', st.mayor?.name || '—')}${row('Клас або група', st.mayor?.group || '—')}${row('Місто', st.name)}${row('Режим', SCENARIOS[st.scenario]?.t || '—')}${row('Дата в грі', dateText(st.month, st.day))}${row('Жителі', num(m.pop))}${row('Казна', money(st.money))}${row('Збережено', res.savedAt ? new Date(res.savedAt).toLocaleString('uk-UA') : '—')}</table>
    ${res.edited || st.flags.editedFile ? `<p class="note bad">${icon('alert', 16)} Файл змінювали вручну після збереження. Результати можуть не відповідати справжній грі.</p>` : `<p class="note ok">${icon('check', 16)} Файл цілий: його не змінювали після збереження.</p>`}
    ${C && !C.s.flags.demo ? `<p class="sm muted">Поточне місто «${esc(C.s.name)}» буде замінено. Якщо воно потрібне — <button class="link" data-f="save">спершу збережіть його</button>.</p>` : ''}
    <div class="row end gap"><button class="btn" data-f="report">Відкрити звіт</button><button class="btn primary" data-f="play">Відкрити місто</button></div>`,
    onOpen: api => api.el.addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; if (b.dataset.f === 'save') { saveFile(); return; } if (res.edited) T0.s.flags.editedFile = true; api.close(); begin(T0, { ...res.ui, panel: b.dataset.f === 'report' ? 'report' : res.ui.panel }); toast(`Місто «${T0.s.name}» відкрито`, 'good'); }) });
}

/* ═════════ гра: запуск, цикл ═════════ */
function begin(city, u = {}) {
  C = city; C.recompute();
  document.querySelector('.start')?.remove(); document.body.classList.remove('start-on');
  if (!R) R = new Renderer(cv, C); else R.setCity(C);
  R.center(); if (u.cam) Object.assign(R.cam, u.cam); R.layer = u.layer || null;
  ui.panel = u.panel || null; ui.speed = u.speed ?? 1; ui.tool = 'select'; ui.cat = null;
  top(); tools(); layers(); panel(); inspect(-1); saveLocal();
}
let last = performance.now(), acc = 0, uiT = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (C && R) {
    const demo = C.s.flags.demo;
    if (ui.speed && !(C.s.over && !C.s.flags.keepPlaying)) { acc += dt * 1000; const iv = SPEEDS[ui.speed]; let n = 0; while (acc >= iv && n++ < 8) { if (demo && C.s.day === 0) mayorMonth(C); C.tick(); acc -= iv; } if (n >= 8) acc = 0; }
    R.tod = (R.tod + dt * (ui.speed ? 0.18 * ui.speed + 0.12 : 0)) % 24;
    if (demo) { R.cam.x += dt * 9; }
    R.updateCars(dt, ui.speed || demo ? 1 : 0); R.frame(dt);
    for (const ev of C.events.splice(0)) onEvent(ev);
    uiT += dt; if (uiT > 0.35 && !demo) { uiT = 0; top(); }
  }
  requestAnimationFrame(loop);
}
function onEvent(ev) {
  if (C.s.flags.demo) return;
  if (ev.k === 'month') { if (ui.panel && !['inbox', 'lab'].includes(ui.panel)) refreshPanel(); if (ui.insp >= 0) inspect(ui.insp); saveLocal(); if (ui.cat) tools(); }
  if (ev.k === 'news') voice(ev.n);
  if (ev.k === 'mail' && ev.e.choices) toast(`Новий лист: «${ev.e.title}» — потрібне рішення`, '');
  if (ev.k === 'ach') toast(`Досягнення: ${ev.t}!`, 'good');
  if (ev.k === 'over') ending();
}

/* ═════════ фінал ═════════ */
function ending() {
  const s = C.s, o = s.over; if (!o) return;
  ui.speed = 0; top();
  const T0 = { win: ['Місію виконано!', 'Ви досягли всіх цілей. Місто вдячне своєму меру!'], fail: ['Час місії вийшов', `Виконано цілей: ${o.done} з ${o.all}. Подивіться у звіті, що вдалося, а що — ні.`], lost: ['Ви програли вибори', `Лише ${o.a}% виборців підтримали вас. Подивіться, на що скаржилися жителі.`] }[o.kind];
  modal({ title: T0[0], cls: 'ending ' + o.kind, html: `<p>${esc(T0[1])}</p><p class="sm muted">Збережіть місто у файл, щоб здати викладачеві.</p><div class="row end gap wrap"><button class="btn" data-e="file">${icon('save', 16)} Зберегти у файл</button><button class="btn" data-e="more">Грати далі</button><button class="btn primary" data-e="report">Звіт</button></div>`,
    onOpen: api => api.el.addEventListener('click', e => { const b = e.target.closest('[data-e]'); if (!b) return; if (b.dataset.e === 'file') { saveFile(); return; } api.close(); if (b.dataset.e === 'more') { s.flags.keepPlaying = true; ui.speed = 1; top(); } else { ui.panel = 'report'; panel(); } }) });
}

/* ═════════ стартовий екран ═════════ */
function start() {
  const st = { sc: 'free', name: '', mayor: '', group: '' };
  // місто-заставка за меню: бот будує його просто на очах
  const demo = newCity({ seed: 77, name: 'Демо' }); demo.s.flags.demo = true; demo.s.money = 1e7;
  for (let m = 0; m < 30; m++) { mayorMonth(demo); for (let d = 0; d < 30; d++) demo.tick(); }
  begin(demo); ui.speed = 2; R.cam.z = 1.05; R.tod = 17.5;
  const el = h(`<div class="start" role="dialog" aria-modal="true" aria-label="Нове місто"></div>`); document.body.appendChild(el); document.body.classList.add('start-on');
  const draw = () => {
    el.innerHTML = `<div class="st-card"><div class="st-hero"><span class="st-logo">${icon('home', 30)}</span><div><h1>Симулятор міста</h1><p>Керуйте містом: бюджет, транспорт, екологія, енергія, освіта. Дивіться на дані й слухайте жителів — кожне рішення має наслідки.</p></div></div>
      <h2>Оберіть режим</h2><div class="scs">${Object.entries(SCENARIOS).map(([k, S]) => `<button class="sc ${st.sc === k ? 'on' : ''}" data-s="${k}"><span class="chip sm">${esc(S.diff)}</span><b>${esc(S.t)}</b><p>${esc(S.desc)}</p>${S.years ? `<small>${S.years} ${plural(S.years, 'рік', 'роки', 'років')} · ${S.goals.length} ${plural(S.goals.length, 'ціль', 'цілі', 'цілей')}</small>` : '<small>Без обмежень</small>'}</button>`).join('')}</div>
      <div class="st-form"><label><span>Назва міста</span><input class="inp" data-v="name" maxlength="28" value="${esc(st.name)}" placeholder="Наприклад, Сонячне"></label><label><span>Ваше ім’я та прізвище (мер)</span><input class="inp" data-v="mayor" maxlength="40" value="${esc(st.mayor)}" placeholder="Наприклад, Олена Коваль"></label><label><span>Клас або група <small>(необов’язково)</small></span><input class="inp" data-v="group" maxlength="20" value="${esc(st.group)}" placeholder="7-А"></label></div>
      <div class="row between gap wrap"><button class="btn" data-s-open>${icon('open', 16)} Відкрити місто з файлу</button><button class="btn primary lg" data-s-go>${icon('flag', 18)} Заснувати місто</button></div></div>`;
  };
  draw();
  el.addEventListener('input', e => { const k = e.target.dataset.v; if (k) st[k] = e.target.value; });
  el.addEventListener('click', e => {
    const s = e.target.closest('[data-s]'); if (s) { st.sc = s.dataset.s; draw(); return; }
    if (e.target.closest('[data-s-open]')) { openFile(); return; }
    if (e.target.closest('[data-s-go]')) {
      if (!st.mayor.trim()) { toast('Введіть своє ім’я — так викладач знатиме, чиє це місто', 'bad'); el.querySelector('[data-v="mayor"]').focus(); return; }
      el.querySelector('[data-s-go]').disabled = true; el.querySelector('[data-s-go]').textContent = 'Будуємо місто…';
      setTimeout(() => { const city = newCity({ scenario: st.sc, name: st.name.trim() || 'Нове місто', mayor: st.mayor.trim(), group: st.group.trim() }); begin(city, { panel: st.sc === 'free' ? 'help' : 'mission' }); }, 30);
    }
  });
}

/* ═════════ запуск ═════════ */
window.CitySim = { get city() { return C; }, get renderer() { return R; }, ui, begin, start };
const saved = loadLocal();
if (saved) { const c = new City(saved.s); begin(c, saved.ui || {}); } else start();
requestAnimationFrame(loop);
document.getElementById('boot')?.remove();
