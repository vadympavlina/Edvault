// Браузерна перевірка симулятора стартапу: майстер, інтерв'ю, продукт, бренд, гроші, команда, фриланс, збереження.
//   node tests/startup-e2e.mjs
import assert from 'node:assert/strict';
import { startServer, launch, newPage, step } from './_harness.mjs';

const server = await startServer();
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const p = await newPage(ctx, errors);
await p.goto(server.url + '/emulators/startup');
await p.evaluate(() => localStorage.clear());
await p.reload();
const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.Startup.sim.s)));
const go = v => p.evaluate(v => window.Startup.C.go(v), v);
const closeModal = () => p.click('.md [data-md-close]');
p.setDefaultTimeout(10000);

await step('майстер: без імені й назви далі не пускає, потім створює компанію', async () => {
  await p.waitForSelector('.wizard');
  await p.click('[data-w="next"]');
  await p.click('[data-w="idea"][data-v="booking"]');
  await p.click('[data-w="next"]');
  await p.click('[data-w="next"]');
  assert.match(await p.locator('#toast').innerText(), /ім'я/);
  await p.fill('[data-w="name"]', 'Марта');
  await p.click('[data-w="bg"][data-v="sales"]');
  await p.click('[data-w="next"]');
  await p.click('[data-w="next"]');
  assert.match(await p.locator('#toast').innerText(), /назву/);
  await p.fill('[data-w="company"]', 'Записатись');
  await p.click('[data-w="next"]');
  await p.click('[data-w="fff"]');
  await p.click('[data-w="next"]');
  await p.waitForSelector('#main .stage-card');
  const s = await S();
  assert.equal(s.idea, 'booking'); assert.equal(s.founder.bg, 'sales'); assert.equal(s.company.name, 'Записатись'); assert.equal(s.cash, 450000);
  assert.match(await p.locator('.top').innerText(), /Записатись/);
  // етап 1: три завдання, наступні етапи закриті
  assert.equal(await p.locator('.road li.cur').count(), 1);
  assert.match(await p.locator('.road li.cur').innerText(), /Клієнти/);
  assert.equal(await p.locator('.stage-card .notes .note').count(), 3);
  assert.equal(await p.locator('.road .here').count(), 1);
  assert.equal(await p.locator('.navtabs .tab').count(), 5);
});

await step('етапи: розділ наступного етапу закритий, але його можна відкрити вручну', async () => {
  await p.click('.tab[data-k="market"]');
  assert.match(await p.locator('.pg-h').innerText(), /Клієнти/);
  assert.equal(await p.locator('.st-it.locked[data-to="product"]').count(), 1);
  await p.click('.st-it[data-to="brand"]');
  await p.waitForSelector('.md.confirm');
  assert.match(await p.locator('.md.confirm').innerText(), /етапі 2/);
  await p.click('.md.confirm .btn.primary');
  assert.match(await p.locator('.pg-h').innerText(), /Бренд/);
  assert.equal(await p.locator('.st-it.locked[data-to="brand"]').count(), 0);
  assert.equal((await S()).flags.unlocked.brand, true);
  // гроші ще всі закриті: вкладка питає, чи відкрити
  await p.click('.tab[data-k="money"]');
  await p.waitForSelector('.md.confirm');
  await p.keyboard.press('Escape');
  await p.waitForSelector('.md.confirm', { state: 'detached' });
  assert.match(await p.locator('.pg-h').innerText(), /Бренд/);
  await p.click('.tab[data-k="home"]');
  await p.waitForSelector('#main .stage-card');
});

await step('план тижня: стовпчики й кнопки годин оновлюють суму, фокус лишається на кнопці', async () => {
  await p.click('[data-act="hrs"][data-k="customers"][data-d="1"]');
  assert.match(await p.locator('[data-out="h-total"]').innerText(), /^44 \/ 50/);
  assert.equal((await S()).hours.customers, 20);
  assert.equal(await p.evaluate(() => document.activeElement.dataset.k + document.activeElement.dataset.d), 'customers1', 'фокус не губиться після перемальовки');
  // натискання на стовпчик ставить висоту: верх — 40 год, середина — 20 год
  const tube = p.locator('.hcol[data-k="content"] .tube'), bb = await tube.boundingBox();
  await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  assert.equal((await S()).hours.content, 20);
  await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height - 2);
  assert.equal((await S()).hours.content, 0);
  await p.click('[data-act="hrs"][data-k="content"][data-d="1"]');
  assert.equal((await S()).hours.content, 5);
});

await step('інтерв\'ю: три запитання, відповіді в чаті, інсайти на картці', async () => {
  await go('customers');
  await p.click('[data-act="interview"][data-k="masters"]');
  for (let i = 0; i < 3; i++) await p.click('.q-btn >> nth=0');
  assert.equal(await p.locator('.chat .a').count(), 3);
  await closeModal();
  const s = await S();
  assert.equal(s.know.masters.n, 1);
  assert.match(await p.locator('.seg-card.target').innerText(), /Інтерв'ю\s*1/);
});

await step('бізнес-план: заповнення блоків і перевірка метрик', async () => {
  await go('plan');
  await p.fill('[data-in="canvas"][data-k="problem"]', 'Майстри втрачають гроші через неявки клієнтів');
  await p.selectOption('[data-in="canvas"][data-k="segment"]', 'masters');
  await p.check('[data-in="canvasList"][data-k="metrics"][value="likes"]');
  assert.match(await p.locator('.cv-b.metrics').innerText(), /марнославства/);
  assert.equal((await S()).canvas.segment, 'masters');
});

await step('продукт: функції в роботу, тиждень, запуск першої версії', async () => {
  await go('product');
  await p.click('[data-act="queue"][data-id="calendar"]');
  await p.click('[data-act="queue"][data-id="pay"]');
  assert.equal(await p.locator('.kanban > section:nth-child(2) .kb-card').count(), 2);
  await p.evaluate(() => { const S = window.Startup.sim; S.s.hours.product = 40; S.s.product.progress.calendar = 12.9; });
  await p.click('[data-act="endWeek"]');
  // понад 62 години — гра перепитує, чи справді працювати на знос
  await p.waitForSelector('.md.confirm');
  assert.match(await p.locator('.md.confirm').innerText(), /годин роботи/);
  await p.click('.md.confirm .btn.primary');
  await p.waitForSelector('.md.week');
  assert.match(await p.locator('.md.week').innerText(), /Тиждень 1 завершено/);
  await closeModal();
  await go('product');
  await p.click('[data-act="launch"]');
  assert.equal((await S()).product.launched, true);
});

await step('бренд: колір, шрифт, тон і позиціонування', async () => {
  await go('brand');
  await p.click('[data-act="brandColor"][data-c="#ec4899"]');
  await p.click('[data-act="brandSet"][data-key="tone"][data-v="friendly"]');
  await p.click('[data-act="brandSet"][data-key="font"][data-v="modern"]');
  await p.check('[data-in="brandPos"][value="masters"]');
  const s = await S();
  assert.equal(s.company.color, '#ec4899'); assert.equal(s.brand.tone, 'friendly'); assert.equal(s.brand.position, 'masters');
  assert.equal(await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--acc').trim()), '#ec4899');
});

await step('маркетинг: бюджет реклами й A/B-тест', async () => {
  await go('marketing');
  await p.locator('[data-in="budget"][data-k="ads"]').fill('10000');
  assert.equal((await S()).mkt.ads, 10000);
  await p.click('[data-act="startAB"]');
  assert.ok((await S()).landing.test);
});

await step('фінанси: реєстрація ТОВ і фінплан', async () => {
  await go('finance');
  await p.click('[data-act="register"][data-k="tov"]');
  await p.click('.md.confirm .btn.primary');
  assert.equal((await S()).company.form, 'tov');
  await p.click('[data-act="savePlan"]');
  assert.ok((await S()).plan);
  assert.match(await p.locator('#main').innerText(), /Скласти новий план/);
});

await step('ціна: повзунок і беззбитковість', async () => {
  await go('pricing');
  await p.locator('[data-in="price"][data-k="masters"]').fill('250');
  assert.equal((await S()).price.masters, 250);
  assert.match(await p.locator('#main').innerText(), /Точка беззбитковості/);
});

await step('інвестори: пітч-дек збирається, без вимог зустріч дає відмову', async () => {
  await go('investors');
  await p.click('[data-act="slideAdd"][data-k="logo"]');
  assert.match(await p.locator('.deck-notes').innerText(), /логотип/);
  await p.click('[data-act="pitch"][data-k="angel2"]');
  assert.match(await p.locator('#toast').innerText(), /6 годин/);
});

await step('команда: співбесіда відкриває навички, пропозиція з імовірністю згоди', async () => {
  await go('team');
  await p.click('[data-act="meet"] >> nth=0');
  assert.equal(await p.locator('.cand .stars').count() >= 1, true);
  await p.click('[data-act="offer"] >> nth=0');
  assert.match(await p.locator('.md').innerText(), /Імовірність, що погодиться/);
  await p.locator('.md [data-o="sal"]').fill(String(await p.locator('.md [data-o="sal"]').getAttribute('max')));
  await p.click('.md [data-o="go"]');
  assert.match(await p.locator('#toast').innerText(), /у команді|відмовився/);
});

await step('фриланс: замовлення через безпечну угоду й узяте замовлення', async () => {
  await go('freelance');
  await p.click('[data-act="flTask"][data-k="logo"]');
  await p.click('[data-act="flOrder"] >> nth=0');
  const s = await S();
  assert.equal(s.orders.length, 1); assert.equal(s.orders[0].escrow, true);
  await p.click('[data-act="flTab"][data-k="earn"]');
  await p.click('[data-act="takeGig"] >> nth=0');
  assert.equal((await S()).myGigs.length, 1);
});

await step('інвестиції й платежі', async () => {
  await go('invest');
  await p.fill('[data-amt="deposit"]', '20000');
  await p.click('[data-act="buy"][data-k="deposit"]');
  assert.equal(Math.round((await S()).port.deposit.in), 20000);
  await go('payments');
  await p.click('[data-act="payCalc"][data-k="bank"]');
  await p.click('[data-act="payMain"][data-k="agg"]');
  const s = await S(); assert.equal(s.pay.main, 'agg'); assert.ok(s.pay.seen.includes('bank'));
});

await step('пошта, довідник і терміни', async () => {
  await go('help');
  await p.fill('[data-in="q"]', 'runway');
  assert.match(await p.locator('.gloss').innerText(), /Runway/);
  await go('marketing');
  await p.click('.term >> nth=0');
  assert.ok(await p.locator('.term-pop').isVisible());
  await go('inbox');
  assert.ok(await p.locator('.mail-it').count() >= 1);
});

await step('кілька тижнів поспіль, звіт і збереження після перезавантаження', async () => {
  await p.evaluate(() => { window.Startup.sim.s.hours.product = 20; });
  for (let i = 0; i < 3; i++) { await p.click('[data-act="endWeek"]'); await p.waitForSelector('.md.week, .md.confirm'); const c = p.locator('.md.confirm .btn.primary'); if (await c.count()) { await c.click(); await p.waitForSelector('.md.week'); } await closeModal(); }
  const week = (await S()).week;
  await go('report');
  assert.match(await p.locator('.report').innerText(), /Записатись[\s\S]*Lean Canvas/);
  await p.reload();
  await p.waitForSelector('#main .stage-card, #main .pg-h');
  assert.equal((await S()).week, week);
  assert.equal((await S()).flags.reportMade, true);
});

await step('файл: зберегти всю гру у файл і відкрити її в іншому браузері', async () => {
  const fs = await import('node:fs');
  await go('dash');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.top-save')]);
  assert.match(dl.suggestedFilename(), /^startup_[A-Za-z0-9-]+_[A-Za-z0-9-]+_tyzhden-\d+\.json$/);
  const path = await dl.path(), text = fs.readFileSync(path, 'utf8'), data = JSON.parse(text);
  const cur = await S();
  assert.equal(data.app, 'edvault-startup'); assert.equal(data.format, 1);
  assert.deepEqual(data.state, cur, 'у файлі повний стан гри');
  assert.ok(data.state.journal.length > 3 && data.state.history.length >= 3 && data.state.inbox.length > 0, 'журнал, історія й пошта');
  assert.equal(data.summary['Учень'], cur.founder.name);
  await p.click('[data-act="more"]');
  assert.match(await p.locator('.more-pop').innerText(), /У файл збережено на тижні/);
  await p.click('[data-act="more"]');
  // інший браузер: порожньо → відкрити файл із майстра
  const q = await newPage(await browser.newContext({ viewport: { width: 1366, height: 900 } }), errors);
  await q.goto(server.url + '/emulators/startup'); await q.evaluate(() => localStorage.clear()); await q.reload(); await q.waitForSelector('.wizard');
  const [fc] = await Promise.all([q.waitForEvent('filechooser'), q.click('.wizard [data-act="openFile"]')]);
  await fc.setFiles(path);
  await q.waitForSelector('.md.file-open');
  assert.match(await q.locator('.md.file-open').innerText(), /Файл цілий/);
  await q.click('.md.file-open [data-f="play"]');
  await q.waitForSelector('#main .stage-card, #main .pg-h');
  assert.equal(await q.locator('.wizard').count(), 0);
  const back = await q.evaluate(() => JSON.parse(JSON.stringify(window.Startup.sim.s)));
  assert.deepEqual(back, cur, 'гра відновилась повністю');
  // гра продовжується
  await q.evaluate(() => { window.Startup.sim.s.hours.product = 20; });
  await q.click('[data-act="endWeek"]'); await q.waitForSelector('.md.week, .md.confirm'); const c = q.locator('.md.confirm .btn.primary'); if (await c.count()) { await c.click(); await q.waitForSelector('.md.week'); }
  await q.click('.md [data-md-close]');
  assert.equal(await q.evaluate(() => window.Startup.sim.s.week), cur.week + 1);
  // файл, змінений вручну, — попередження в звіті
  const forged = JSON.parse(text); forged.state.cash = 99999999;
  const fpath = path + '-forged.json'; fs.writeFileSync(fpath, JSON.stringify(forged));
  const [fc2] = await Promise.all([q.waitForEvent('filechooser'), q.click('[data-act="more"]').then(() => q.click('.more-pop [data-act="openFile"]'))]);
  await fc2.setFiles(fpath);
  await q.waitForSelector('.md.file-open');
  assert.match(await q.locator('.md.file-open').innerText(), /змінювали вручну[\s\S]*буде замінена/);
  await q.click('.md.file-open [data-f="report"]');
  await q.waitForSelector('.report');
  assert.match(await q.locator('.report').innerText(), /змінювали вручну[\s\S]*Журнал рішень[\s\S]*Усі тижні/);
  // не той файл — зрозуміла помилка, гра не ламається
  const bad = path + '-bad.json'; fs.writeFileSync(bad, '{"hello": 1}');
  const [fc3] = await Promise.all([q.waitForEvent('filechooser'), q.click('[data-act="more"]').then(() => q.click('.more-pop [data-act="openFile"]'))]);
  await fc3.setFiles(bad);
  await q.waitForSelector('#toast.on');
  assert.match(await q.locator('#toast').innerText(), /не збереження|пошкоджений/);
  assert.equal(await q.evaluate(() => window.Startup.sim.s.cash), 99999999);
});

await step('телефон: вкладки, етапи й розділи без горизонтальної прокрутки', async () => {
  const m = await newPage(await browser.newContext({ viewport: { width: 390, height: 844 } }), errors);
  await m.goto(server.url + '/emulators/startup');
  await m.evaluate(() => localStorage.clear()); await m.reload();
  await m.click('[data-w="next"]'); await m.click('[data-w="next"]'); await m.fill('[data-w="name"]', 'Ія'); await m.click('[data-w="next"]'); await m.fill('[data-w="company"]', 'Тест'); await m.click('[data-w="next"]'); await m.click('[data-w="next"]');
  await m.waitForSelector('#main .stage-card');
  assert.equal(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'головна без горизонтальної прокрутки');
  await m.click('.tab[data-k="market"]');
  assert.match(await m.locator('.pg-h').innerText(), /Клієнти/);
  await m.click('.st-it[data-to="plan"]');
  assert.match(await m.locator('.pg-h').innerText(), /Бізнес-план/);
  assert.equal(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'без горизонтальної прокрутки');
});

await step('власна ідея: конструктор у майстрі, перевірка полів, гра з власними сегментами', async () => {
  const q = await newPage(await browser.newContext({ viewport: { width: 1366, height: 900 } }), errors);
  q.setDefaultTimeout(10000);
  await q.goto(server.url + '/emulators/startup'); await q.evaluate(() => localStorage.clear()); await q.reload();
  await q.click('[data-w="next"]'); await q.click('[data-w="idea"][data-v="custom"]'); await q.click('[data-w="next"]');
  await q.click('[data-w="next"]');
  assert.match(await q.locator('#toast').innerText(), /назву ідеї/);
  await q.fill('[data-c="name"]', 'Обмін книжками');
  await q.click('[data-w="kind"][data-v="app"]');
  await q.fill('[data-c="problem"]', 'пошук підручників');
  await q.fill('[data-c="pitch"]', 'Застосунок для обміну підручниками між школярами, які живуть поруч.');
  await q.click('[data-w="next"]');
  await q.fill('[data-c="segments.0.name"]', 'Школярі');
  await q.fill('[data-c="segments.1.name"]', 'Шкільні бібліотеки');
  await q.selectOption('[data-c="segments.1.arch"]', 'schools');
  await q.click('[data-w="next"]');
  await q.fill('[data-c="features.0.name"]', 'Каталог книжок');
  await q.fill('[data-c="features.1.name"]', 'Чат обміну');
  await q.click('[data-w="next"]');
  assert.match(await q.locator('#toast').innerText(), /три функції/);
  await q.fill('[data-c="features.2.name"]', 'Облік фонду');
  await q.check('[data-c="features.2.segs"][value="1"]');
  await q.uncheck('[data-c="features.2.segs"][value="0"]');
  await q.click('[data-w="next"]');
  await q.fill('[data-c="competitors.0.name"]', 'Групи у Viber');
  await q.fill('[data-c="competitors.0.price"]', '0');
  await q.fill('[data-c="competitors.0.weak"]', 'Довго шукати потрібну книжку');
  await q.click('[data-w="next"]');
  // перевірка ідеї: поради наставниці перед стартом
  assert.ok(await q.locator('.wz-check li').count() >= 6);
  assert.match(await q.locator('.wz-check').innerText(), /оцінити, скільки є клієнтів/);
  await q.click('[data-w="next"]');
  await q.fill('[data-w="name"]', 'Остап'); await q.click('[data-w="next"]');
  await q.fill('[data-w="company"]', 'КнигоОбмін'); await q.click('[data-w="next"]');
  await q.click('[data-w="next"]');
  await q.waitForSelector('#main .stage-card');
  const s = await q.evaluate(() => JSON.parse(JSON.stringify(window.Startup.sim.s)));
  assert.equal(s.idea, 'custom'); assert.equal(s.custom.t, 'Обмін книжками');
  assert.deepEqual(Object.values(s.custom.segments).map(g => g.t), ['Школярі', 'Шкільні бібліотеки']);
  assert.deepEqual(s.custom.features.f3.assumed, { s1: false, s2: true });
  assert.match(await q.locator('.tp-brand').getAttribute('title'), /Обмін книжками/);
  await q.evaluate(() => window.Startup.C.go('customers'));
  assert.match(await q.locator('#main').innerText(), /Школярі[\s\S]*Шкільні бібліотеки/);
  await q.evaluate(() => window.Startup.C.go('report'));
  assert.match(await q.locator('.report').innerText(), /Ваші припущення ↔ реальність[\s\S]*Каталог книжок/);
  await q.reload(); await q.waitForSelector('#main .stage-card, #main .pg-h');
  assert.equal(await q.evaluate(() => window.Startup.sim.I.t), 'Обмін книжками');
  // ідея запам'ятовується: нова гра пропонує її доопрацювати
  assert.equal(await q.evaluate(() => JSON.parse(localStorage.getItem('edvault-startup-idea')).name), 'Обмін книжками');
  await q.click('[data-act="more"]'); await q.click('.more-pop [data-act="newGame"]'); await q.click('.md.confirm .btn.danger, .md.confirm .btn.primary');
  await q.click('[data-w="next"]'); await q.click('[data-w="idea"][data-v="custom"]'); await q.click('[data-w="next"]');
  assert.match(await q.locator('.wizard').innerText(), /відновили вашу попередню ідею/);
  assert.equal(await q.inputValue('[data-c="name"]'), 'Обмін книжками');
});

await step('жодної помилки в консолі', async () => { assert.deepEqual(errors, []); });

await browser.close(); server.close();
