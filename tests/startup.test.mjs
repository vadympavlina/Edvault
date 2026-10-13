// Симулятор стартапу · перевірка рушія (без браузера): node --test tests/startup.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, okState, Sim, money, WEEKS } from '../emulators/startupsim/js/sim.js';
import { autoplay, smartWeek, recklessWeek } from '../emulators/startupsim/js/bots.js';
import { IDEAS, INVESTORS } from '../emulators/startupsim/js/data.js';

const fresh = (o = {}) => newGame({ idea: 'homework', founder: 'Тест', company: 'Тест', seed: 7, ...o });
const build = (S, ids) => { for (const id of ids) S.s.product.built.push(id); };

test('нова гра: коректний стан, лист від наставниці, кандидати', () => {
  const S = fresh();
  assert.ok(okState(S.s));
  assert.equal(S.s.cash, 150000);
  assert.equal(S.stake(), 1);
  assert.equal(S.s.inbox[0].from, 'Наставниця Ірина');
  assert.equal(S.s.candidates.length, 4);
  const F = fresh({ fff: true });
  assert.equal(F.s.cash, 450000);
  assert.ok(Math.abs(F.stake() - .9) < .001);
});

test('інтерв\'ю: правильні запитання дають дані, підказувальні — оманливі', () => {
  const S = fresh();
  S.s.hours.customers = 9;
  assert.equal(S.talksLeft(), 3);
  S.startInterview('parents');
  for (const q of ['last', 'spend', 'where']) assert.ok(S.ask(q));
  assert.equal(S.ask('worst'), null, 'більше трьох запитань не можна');
  S.finishInterview();
  const K = S.s.know.parents;
  assert.equal(K.good, 1); assert.equal(K.pains.length, 1); assert.equal(Object.keys(K.ch).length, 1);
  S.startInterview('parents'); S.ask('like'); S.ask('pay'); S.ask('would'); S.finishInterview();
  assert.equal(K.bad, 1); assert.equal(K.likes, 2); assert.equal(K.badWtps.length, 1);
  assert.ok(K.badWtps[0] > S.seg('parents').wtp * .9, 'відповідь «скільки б заплатили» завищена');
  S.startInterview('parents'); S.finishInterview();
  assert.equal(S.talksLeft(), 0);
  assert.equal(S.startInterview('parents'), null, 'годин на інтерв\'ю більше немає');
  assert.ok(S.s.ach.firstTalk);
});

test('до запуску люди потрапляють у лист очікування, після — стають користувачами', () => {
  const S = fresh(); S.s.target = 'parents'; S.s.hours.content = 20;
  for (let i = 0; i < 6; i++) S.endWeek();
  assert.ok(S.s.users.parents.wait > 0);
  assert.equal(S.activeUsers(), 0);
  assert.equal(S.launch(), false, 'без жодної функції запуск неможливий');
  build(S, ['photo', 'steps']);
  assert.ok(S.launch());
  S.endWeek(); S.endWeek();
  assert.ok(S.activeUsers() > 0);
});

test('без функції оплати й реєстрації компанії гроші не надходять', () => {
  const S = fresh(); S.s.target = 'parents'; S.s.hours.content = 25; S.s.mkt.ads = 20000; S.s.cash = 5e6;
  build(S, ['photo', 'steps', 'report']); S.launch();
  for (let i = 0; i < 8; i++) S.endWeek();
  assert.equal(S.paidUsers(), 0, 'без оплати ніхто не платить');
  build(S, ['pay']);
  for (let i = 0; i < 6; i++) S.endWeek();
  assert.equal(S.paidUsers(), 0, 'без реєстрації ФОП/ТОВ оплата не працює');
  assert.ok(S.s.last.notes.some(n => /не зареєстровано/.test(n)));
  S.register('fop');
  for (let i = 0; i < 8; i++) S.endWeek();
  assert.ok(S.paidUsers() > 0);
  assert.ok(S.history?.length !== 0 && S.s.history.at(-1).rev > 0);
});

test('B2B: школи не купують без обов\'язкових функцій', () => {
  const S = fresh({ seed: 3 }); S.setTarget('schools'); S.s.hours.sales = 30; S.s.cash = 5e6; S.register('tov');
  build(S, ['photo', 'steps', 'pay']); S.launch();
  for (let i = 0; i < 14; i++) S.endWeek();
  assert.equal(S.paidUsers('schools'), 0);
  assert.ok(S.missingReq('schools').length === 2);
  build(S, ['security', 'teacher']);
  for (let i = 0; i < 16; i++) S.endWeek();
  assert.ok(S.paidUsers('schools') > 0);
});

test('пристрої: продаж обмежений складом, партія оплачується наперед', () => {
  const S = newGame({ idea: 'plant', seed: 5 }); S.s.cash = 3e6; S.register('fop'); S.s.hours.content = 25; S.s.mkt.ads = 30000;
  build(S, ['sensors', 'app', 'pay']); S.launch();
  for (let i = 0; i < 5; i++) S.endWeek();
  assert.equal(S.paidUsers(), 0, 'склад порожній — продажів немає');
  assert.ok(S.s.history.some(h => Object.values(h.seg).some(x => x.lostStock > 0)) || S.s.last.notes.some(n => /Склад/.test(n)));
  const cash = S.s.cash; assert.ok(S.orderBatch(200)); assert.equal(Math.round(cash - S.s.cash), 200 * S.s.unitCost);
  for (let i = 0; i < 6; i++) S.endWeek();
  assert.ok(S.paidUsers() > 0);
});

test('інвестори: потрібне ТОВ, пітч-дек, пропозиція розмиває частку', () => {
  const S = newGame({ idea: 'booking', seed: 11 });
  const angel = INVESTORS.find(i => i.id === 'angel2');
  assert.ok(S.needsOf(angel).some(n => /ТОВ/.test(n)));
  S.s.deck.slides = ['logo', 'ask', 'problem'];
  const bad = S.deckScore();
  S.s.deck.slides = ['problem', 'solution', 'market', 'traction', 'model', 'compet', 'team', 'ask'];
  assert.ok(S.deckScore() > .95 && bad < .4);
  // готуємо компанію до інвестиції
  S.register('tov'); S.s.cash = 1e6; build(S, ['calendar', 'remind', 'pay']); S.launch();
  S.s.users.masters.paid = 120; S.s.history.push({ week: 0, mrr: 30000, rev: 1, cost: 1, cash: 0 });
  S.s.hours.invest = 6;
  assert.ok(S.pitch('angel2').ok);
  S.s.inv.angel2.deck = 1; S.resolvePitch('angel2');
  const st = S.s.inv.angel2;
  if (st.status === 'offer') {
    const before = S.stake(), cash = S.s.cash;
    assert.ok(S.acceptOffer('angel2'));
    assert.ok(S.stake() < before);
    assert.ok(Math.abs(S.stake() - before * (1 - st.offer.take)) < 1e-6);
    assert.equal(S.s.cash, cash + st.offer.amount);
    assert.ok(S.s.ach.raised);
  } else assert.equal(st.status, 'rejected');
});

test('грант: схвалюють лише після інтерв\'ю й з чесними цифрами', () => {
  const S = fresh(); S.register('fop'); S.s.hours.invest = 6;
  assert.ok(S.pitch('grant').ok);
  S.resolvePitch('grant');
  assert.equal(S.s.inv.grant.status, 'rejected');
  assert.equal(S.pitch('grant').ok, false, 'подати можна лише раз');
  const T = fresh({ seed: 9 }); T.register('fop'); T.s.hours.invest = 6;
  T.s.know.parents.good = 8; build(T, ['photo']); T.launch();
  T.pitch('grant'); const cash = T.s.cash; T.resolvePitch('grant');
  assert.equal(T.s.inv.grant.status, 'invested');
  assert.equal(T.s.cash, cash + 400000);
  assert.equal(T.stake(), 1, 'грант не забирає частку');
});

test('кредит: щотижневі платежі з відсотками, повертаєте більше, ніж узяли', () => {
  const S = fresh(); S.register('fop');
  assert.equal(S.loanLimit(), 0, 'без історії виручки кредит не дають');
  for (let i = 0; i < 8; i++) S.s.history.push({ week: i, rev: 20000, cost: 5000, mrr: 0, cash: 0 });
  const lim = S.loanLimit(); assert.ok(lim > 0);
  assert.ok(S.takeLoan(lim));
  assert.ok(S.s.loan.pay * S.s.loan.n > lim);
  const owed = S.s.loan.owed; S.endWeek();
  assert.ok(S.s.loan.owed < owed);
  assert.equal(S.takeLoan(1000), false, 'другий кредит не дають');
});

test('краудфандинг: «все або нічого»', () => {
  const S = fresh({ seed: 2 }); S.s.target = 'parents';
  assert.ok(S.startCrowd(100000000, 200));
  for (let i = 0; i < 5; i++) S.endWeek();
  assert.equal(S.s.crowd.status, 'failed');
  assert.ok(S.s.inbox.some(m => /не зібрала мету/.test(m.title)));
});

test('фриланс: безпечна угода повертає гроші, оплата напряму — ні', () => {
  const S = fresh({ seed: 4 }); S.s.cash = 1e6;
  const list = S.freelancers('logo'); const f = list[0]; f.scam = true;
  assert.ok(S.order('logo', f.id, true));
  const g = list[1]; g.scam = true;
  assert.ok(S.order('logo', g.id, false));
  for (let i = 0; i < 3; i++) S.endWeek();
  const [a, b] = S.s.orders;
  assert.equal(a.status, 'refund'); assert.equal(b.status, 'lost');
  // власне замовлення: передоплата + оплата після виконання
  S.refreshGigs(); const gig = S.s.gigs[0], cash = S.s.cash;
  assert.ok(S.takeGig(gig.id, 'prepay'));
  assert.ok(S.s.cash > cash);
  S.s.hours.freelance = 40; for (let i = 0; i < 3; i++) S.endWeek();
  assert.equal(S.s.gigsDone, 1); assert.ok(S.s.gigIncome >= gig.pay * .99);
});

test('інвестування: депозит до 3 місяців без відсотків, мем-токен обвалюється', () => {
  const S = fresh(); S.s.cash = 1e6;
  assert.ok(S.buy('deposit', 100000));
  for (let i = 0; i < 4; i++) S.endWeek();
  const got = S.sell('deposit');
  assert.equal(got, 100000, 'раннє зняття — лише вкладене');
  assert.ok(S.buy('meme', 10000)); assert.ok(S.s.flags.memeBought);
  for (let i = 0; i < 5; i++) S.endWeek();
  assert.ok(S.s.port.meme.v < 10000 * .3, 'шахрайський токен обвалився');
});

test('спринт фіксує план і результат', () => {
  const S = fresh(); S.s.hours.product = 30;
  assert.ok(S.startSprint(['photo', 'steps']));
  S.endWeek(); S.endWeek();
  assert.equal(S.s.sprint, null);
  const sp = S.s.sprints[0]; assert.ok(sp.planned > 0 && sp.done > 0 && sp.burn.length >= 2);
  assert.ok(S.retro('tests'));
  assert.equal(S.retroBugs(), .65);
});

test('бренд: відповідність сегменту впливає на довіру', () => {
  const S = fresh(); S.s.target = 'students';
  const t0 = S.trustM();
  S.setBrand('tone', 'fun'); S.setBrand('font', 'playful'); S.setBrand('position', 'students'); S.s.brand.logo = { q: .9, by: 'self' };
  assert.ok(S.trustM() > t0 + .15);
  S.setBrand('tone', 'formal'); S.setBrand('position', 'vague');
  assert.ok(S.brandFit() < .6);
});

test('бізнес-план: метрики марнославства й непідтверджені канали позначаються', () => {
  const S = fresh(); S.setCanvas('metrics', ['likes']); S.setCanvas('advantage', 'hard');
  const c = S.canvasCheck();
  assert.equal(c.metrics.s, 'bad'); assert.equal(c.advantage.s, 'bad');
  S.setCanvas('metrics', ['mrr', 'churn']); assert.equal(S.canvasCheck().metrics.s, 'ok');
  assert.equal(S.canvasFilled(), 2);
});

test('гроші закінчились: 2 тижні на порятунок, потім банкрутство', () => {
  const S = fresh(); S.s.cash = 1000; S.s.mkt.ads = 50000;
  S.endWeek(); assert.equal(S.s.over, null); assert.ok(S.s.inbox.some(m => /Гроші закінчилися/.test(m.title)));
  S.endWeek(); S.endWeek();
  assert.equal(S.s.over?.kind, 'bankrupt');
  assert.equal(S.endWeek(), null, 'після кінця гри тижні не йдуть');
});

test('відтворюваність: однакове зерно — однаковий результат', () => {
  const a = autoplay(newGame({ idea: 'english', seed: 42 }), 30), b = autoplay(newGame({ idea: 'english', seed: 42 }), 30);
  assert.deepEqual(a.s.history.map(h => h.cash), b.s.history.map(h => h.cash));
  const c = new Sim(JSON.parse(JSON.stringify(a.s)));
  assert.ok(okState(c.s)); c.endWeek(); assert.equal(c.s.week, 31);
});

test('баланс: розважливий засновник виживає, безрозсудний прогорає', () => {
  let alive = 0;
  for (const idea of Object.keys(IDEAS)) for (const seed of [1, 2, 3]) {
    const S = autoplay(newGame({ idea, seed }), WEEKS, smartWeek);
    if (S.s.over?.kind !== 'bankrupt') alive++;
    const R = autoplay(newGame({ idea, seed }), 30, recklessWeek);
    assert.equal(R.s.over?.kind, 'bankrupt', `безрозсудний на «${idea}» мав прогоріти`);
  }
  assert.ok(alive >= 10, `розважливий засновник вижив лише в ${alive} з 12 ігор`);
});

test('гроші форматуються по-людськи', () => {
  assert.equal(money(1500), '1 500 ₴'); assert.equal(money(45000), '45 тис. ₴'); assert.equal(money(2500000), '2,5 млн ₴'); assert.equal(money(-3000), '−3 000 ₴');
});
