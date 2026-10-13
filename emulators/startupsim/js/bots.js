// Симулятор стартапу · боти для перевірки балансу (тести) і «швидкого старту».
import { QUESTIONS } from './sim.js';

const best = (S, k) => Object.entries(S.I.features).filter(([id, f]) => !S.has(id) && !S.s.product.queue.includes(id) && ((f.v?.[k] || 0) > .1 || f.pay || (f.fx && (f.fx.activation || f.fx.retention)) || (S.seg(k).requires || []).includes(id))).sort((a, b) => ((b[1].v?.[k] || 0) + (b[1].pay ? .5 : 0) + ((S.seg(k).requires || []).includes(b[0]) ? .6 : 0)) - ((a[1].v?.[k] || 0) + (a[1].pay ? .5 : 0) + ((S.seg(k).requires || []).includes(a[0]) ? .6 : 0)))[0]?.[0];

// Розважливий засновник: говорить із клієнтами, будує потрібне, рахує гроші
export function smartWeek(S) {
  const s = S.s, segs = S.segIds;
  // інтерв'ю перші тижні
  if (s.week < 4) {
    s.hours = { product: 18, customers: 15, content: 6, sales: 0, invest: 0, freelance: 0, rest: 11 };
    while (S.talksLeft() > 0) { const k = segs[s.talks % segs.length]; S.startInterview(k); for (const q of ['last', 'spend', 'worst']) S.ask(q); S.finishInterview(); }
    if (s.week === 3) {
      const scored = segs.map(k => { const i = S.insight(k); return [k, (i.pain || 0) * Math.log10(Math.max(10, i.wtp || 10)) * (S.seg(k).b2b ? .8 : 1)]; }).sort((a, b) => b[1] - a[1]);
      S.setTarget(scored[0][0]);
      const w = S.insight(s.target).wtp; if (w) S.setPrice(s.target, Math.round(w * .75 / (S.seg().units || 1)));
    }
  } else {
    s.hours = { product: 26, customers: 3, content: 10, sales: S.seg().b2b ? 10 : 0, invest: 0, freelance: 0, rest: 8 };
  }
  // реєстрація
  for (const e of s.inbox) if (e.choices && e.chosen == null) {
    const pick = { form: 0, cofounder: 1, customDeal: 1, competitor: 1, press: 0, viral: 0, leak: 0, acquire: 1, intern: 0, blogger: 2, supplier: 0, pilot: 0 }[e.ev] ?? 0;
    S.choose(e.id, pick);
  }
  if (s.company.form === 'none' && s.week >= 3) S.register('fop');
  // продукт
  while (s.product.queue.length < 2) { const f = best(S, s.target); if (!f) break; S.queue(f); }
  if (S.canLaunch() && s.product.built.length >= 2) S.launch();
  if (s.product.bugs > 10) s.product.fix = .3; else s.product.fix = .12;
  if (S.I.kind === 'hardware' && s.product.launched && s.stock.units < 150 && !s.stock.orders.length) { const n = Math.min(400, Math.floor(s.cash * .5 / s.unitCost)); if (n >= S.I.batchMin) S.orderBatch(n); }
  if (s.landing.cur < 0) S.setLanding(S.I.landing.map((l, i) => [i, l.m]).sort((a, b) => b[1] - a[1])[0][0]);
  if (s.product.launched && S.surveys?.length === 0 && S.canSurvey()) S.survey();
  // гроші: реклама лише якщо окуповується
  const ltv = S.ltv(), cac = S.cac();
  s.mkt.ads = s.product.launched && s.cash > 200000 && (!cac || ltv > cac * 1.5) ? 8000 : 0;
  // найм
  const c = s.candidates.find(x => x.role === 'dev' || (S.seg().b2b && x.role === 'sales'));
  if (c && s.team.length < 4 && s.cash > 250000 && (s.cash - c.ask * 12) / Math.max(1, S.lastCost() + c.ask / 4.33 - S.lastRev()) > 40) S.hire(c.id, c.ask * 1.05);
  // грант
  if (!s.inv.grant && s.company.form !== 'none' && S.needsOf({ need: { interviews: 8 }, kind: 'grant' }).length === 0 && (s.product.launched || s.week > 8)) { s.hours.invest = 6; S.pitch('grant'); }
  return S.endWeek();
}

// Безрозсудний засновник: без розмов із клієнтами, одразу реклама й найм
export function recklessWeek(S) {
  const s = S.s;
  s.hours = { product: 40, customers: 0, content: 0, sales: 0, invest: 0, freelance: 0, rest: 2 };
  for (const e of s.inbox) if (e.choices && e.chosen == null) S.choose(e.id, 0);
  for (const id of Object.keys(S.I.features)) S.queue(id);
  s.product.mode = 'fast'; s.product.fix = 0;
  if (s.week === 0) { for (const c of [...s.candidates].slice(0, 3)) S.hire(c.id, c.ask * 1.1); }
  if (s.week === 6) S.launch();
  s.mkt.ads = 40000; s.mkt.bloggers = 1;
  return S.endWeek();
}

export function autoplay(S, weeks, bot = smartWeek) { for (let i = 0; i < weeks && !S.s.over; i++) bot(S); return S; }
