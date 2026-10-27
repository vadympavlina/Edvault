// Симулятор стартапу · шлях стартапу: етапи, завдання кожного етапу й розділи, які відкриваються. Без DOM.
import { sum } from './sim.js';

// open — розділи, що стають доступними з цього етапу. Завдання рахуються зі стану гри, тож старі збереження теж працюють.
export const STAGES = [
  { id: 'learn', t: 'Клієнти', long: 'Дізнайтеся, що болить клієнтам',
    why: 'Перш ніж щось робити, перевірте, чи справді в людей є ця проблема. Поговоріть із ними й запишіть, що дізналися.',
    open: ['dash', 'inbox', 'customers', 'plan', 'freelance', 'help', 'report'],
    tasks: S => {
      const s = S.s, talks = sum(Object.values(s.know).map(k => k.n));
      return [
        { t: 'Поговоріть із трьома клієнтами', d: `${Math.min(talks, 3)} з 3 розмов · кожна займає 3 години з вашого тижня`, ok: talks >= 3, go: 'customers', btn: 'Почати розмову', hl: '[data-act="interview"]' },
        { t: 'Запишіть, яку проблему ви розв’язуєте', d: 'Бізнес-план → блок «Проблема». Одне-два речення своїми словами.', ok: (s.canvas.problem || '').trim().length >= 10, go: 'plan', btn: 'Написати', hl: '[data-in="canvas"][data-k="problem"]' },
        { t: 'Оберіть, для кого робите продукт', d: 'Бізнес-план → блок «Сегменти клієнтів».', ok: !!s.canvas.segment, go: 'plan', btn: 'Обрати', hl: '[data-in="canvas"][data-k="segment"]' },
      ];
    } },
  { id: 'build', t: 'Перша версія', long: 'Зробіть першу версію продукту',
    why: 'Не потрібен ідеальний продукт. Зробіть найпростішу версію, яку вже можна дати людям, і запустіть її.',
    open: ['product', 'brand'],
    tasks: S => {
      const s = S.s, p = s.product;
      return [
        { t: 'Додайте функції в розробку', d: 'Продукт → «У роботу». Почніть із тих, яких найбільше бракує клієнтам.', ok: p.built.length > 0 || p.queue.length > 0 || p.launched, go: 'product', btn: 'До продукту', hl: '.kanban [data-act="queue"]' },
        { t: 'Заповніть бізнес-план', d: `${Math.min(S.canvasFilled(), 5)} з 5 блоків`, ok: S.canvasFilled() >= 5, go: 'plan', btn: 'Заповнити', hl: '.canvas' },
        { t: 'Запустіть першу версію', d: S.canLaunch() || p.launched ? 'Одна функція вже готова — можна запускати.' : 'Стане можливим, коли буде готова хоч одна функція.', ok: p.launched, go: 'product', btn: 'Запустити', hl: '.launch' },
      ];
    } },
  { id: 'sell', t: 'Перші продажі', long: 'Отримайте перші гроші від клієнтів',
    why: 'Щоб клієнти могли платити, потрібні три речі: зареєстрована компанія, оплата в продукті й зрозуміла ціна. А ще люди мають про вас дізнатися.',
    open: ['pricing', 'finance', 'payments', 'marketing', 'promo'],
    tasks: S => {
      const s = S.s;
      return [
        { t: 'Зареєструйте ФОП або ТОВ', d: 'Фінанси → «Форма компанії». Без цього гроші не надходять.', ok: s.company.form !== 'none', go: 'finance', btn: 'Зареєструвати', hl: '[data-act="register"]' },
        { t: 'Розкажіть про себе', d: 'Реклама, блогери, соцмережі або заходи — оберіть хоч один спосіб.', ok: s.mkt.ads > 0 || s.mkt.bloggers > 0 || s.mkt.events > 0 || s.hours.content > 0 || s.hours.sales > 0, go: 'marketing', btn: 'Обрати', hl: '.ch-row' },
        { t: 'Отримайте першу оплату', d: 'Потрібні функція оплати в продукті й розумна ціна.', ok: !!s.ach.firstPay, go: 'pricing', btn: 'До ціни', hl: '.price-row' },
      ];
    } },
  { id: 'grow', t: 'Зростання', long: 'Зростайте й зберіть команду',
    why: 'Самому все не встигнути. Дізнайтеся, що думають користувачі, наберіть перших платних клієнтів і найміть першу людину в команду.',
    open: ['team', 'investors'],
    tasks: S => {
      const s = S.s, paid = S.paidUsers();
      return [
        { t: 'Запитайте користувачів, що покращити', d: 'Клієнти → «Провести опитування».', ok: s.surveys.length > 0, go: 'customers', btn: 'Опитати', hl: '[data-act="survey"]' },
        { t: 'Наберіть 25 платних клієнтів', d: `${Math.min(paid, 25)} з 25`, ok: paid >= 25 || !!s.ach.pay100, go: 'marketing', btn: 'До реклами' },
        { t: 'Найміть першу людину в команду', d: 'Команда → оберіть кандидата.', ok: s.team.length > 0 || !!s.ach.hire, go: 'team', btn: 'До команди', hl: '.member.cand' },
      ];
    } },
  { id: 'scale', t: 'Інвестиції', long: 'Залучіть інвестиції або вийдіть на прибуток',
    why: 'Далі є два шляхи: залучити гроші інвесторів, щоб рости швидше, або заробляти більше, ніж витрачаєте.',
    open: ['invest'],
    tasks: S => {
      const s = S.s;
      return [
        { t: 'Залучіть інвестиції або вийдіть на прибуток', d: 'Інвестори дають гроші за частку компанії. Прибуток — коли виручка більша за витрати 4 тижні поспіль.', ok: !!(s.ach.raised || s.ach.profit), go: 'investors', btn: 'До інвесторів', hl: '.card.inv' },
        { t: 'Наберіть 100 платних клієнтів', d: `${Math.min(S.paidUsers(), 100)} з 100`, ok: !!s.ach.pay100 || S.paidUsers() >= 100, go: 'marketing', btn: 'До реклами' },
        { t: 'Збережіть гру у файл', d: 'Файл можна здати викладачеві.', ok: s.flags.fileWeek != null, go: 'file', btn: 'Зберегти' },
      ];
    } },
];

// простий режим: ці розділи не потрібні, щоб пройти гру, і в простому режимі сховані
export const ADVANCED_VIEWS = ['payments', 'invest', 'promo'];
export const isSimple = S => S.s.flags.simple === true;

// години «за мене»: розумний розподіл під поточний етап (разом 50 годин)
export function suggestHours(S, stage) {
  const b2b = S.seg().b2b;
  const P = [
    { product: 10, customers: 21, content: 4, sales: 0, invest: 0, freelance: 0, rest: 15 },
    { product: 28, customers: 6, content: 6, sales: 0, invest: 0, freelance: 0, rest: 10 },
    { product: 14, customers: 6, content: b2b ? 6 : 12, sales: b2b ? 12 : 6, invest: 0, freelance: 0, rest: 12 },
    { product: 12, customers: 6, content: 10, sales: b2b ? 10 : 4, invest: 6, freelance: 0, rest: b2b ? 6 : 12 },
    { product: 8, customers: 4, content: 8, sales: b2b ? 8 : 4, invest: 12, freelance: 0, rest: b2b ? 10 : 14 },
  ][Math.min(stage, 4)];
  const h = { ...P };
  // грошей майже немає — частину часу на підробіток
  if (S.runwayWeeks() < 8) { h.freelance = 10; h.product = Math.max(0, h.product - 6); h.rest = Math.max(4, h.rest - 4); }
  return h;
}

// на якому етапі відкривається розділ
export const viewStage = v => { const i = STAGES.findIndex(st => st.open.includes(v)); return i < 0 ? 0 : i; };

export function stageInfo(S) {
  const list = STAGES.map(st => { const tasks = st.tasks(S); return { ...st, tasks, done: tasks.every(x => x.ok), n: tasks.filter(x => x.ok).length }; });
  let cur = list.findIndex(x => !x.done);
  const allDone = cur < 0;
  if (allDone) cur = list.length - 1;
  // досягнутий етап не відкочується назад, навіть якщо якесь завдання знову стало невиконаним
  const reached = Math.max(cur, S.s.flags.stage || 0);
  return { list, cur, reached, allDone };
}

// розділ відкритий, якщо етап досягнуто або його відкрили вручну
export const isOpen = (S, v, info = stageInfo(S)) => viewStage(v) <= info.reached || !!S.s.flags.unlocked?.[v];
export function unlock(S, v) { S.s.flags.unlocked = { ...(S.s.flags.unlocked || {}), [v]: true }; }
// запам'ятовуємо досягнутий етап (викликається після кожної зміни стану)
export function syncStage(S) { const i = stageInfo(S); if (i.reached > (S.s.flags.stage || 0)) S.s.flags.stage = i.reached; return i; }
