// Браузерна перевірка симулятора блогера: телефон, «Лайкер», створення дописів, реакції, безпека, збереження.
//   node tests/blogger-e2e.mjs
import assert from 'node:assert/strict';
import { startServer, launch, newPage, step } from './_harness.mjs';

const server = await startServer();
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
const p = await newPage(ctx, errors);
await p.goto(server.url + '/emulators/blogger');
await p.waitForFunction(() => window.Blogger);
await p.click('[data-speed="0"]');

const S = () => p.evaluate(() => JSON.parse(JSON.stringify(Blogger.sim.s)));
const adv = min => p.evaluate(m => { Blogger.sim.advance(m); }, min);
const home = () => p.click('.homebar');
const atHour = h => p.evaluate(h => { while (Math.floor(Blogger.sim.s.t / 60) % 24 !== h) Blogger.sim.advance(5); }, h);

await step('головний екран і реєстрація з перевіркою імені й пароля', async () => {
  assert.match(await p.locator('.home').innerText(), /Лайкер[\s\S]*Камера[\s\S]*Галерея/);
  await p.click('[data-app="likeer"]');
  await p.click('[data-act="lk.signup"]');
  await p.fill('[data-in="reg.nick"]', 'ab');
  assert.match(await p.locator('[data-err]').innerText(), /3–20/);
  assert.equal(await p.locator('[data-act="lk.regNext"]').isDisabled(), true);
  await p.fill('[data-in="reg.nick"]', 'kotyk.art');
  await p.click('[data-act="lk.regNext"]');
  await p.click('[data-act="lk.regNiche"][data-k="pets"]'); await p.click('[data-act="lk.regNext"]');
  await p.click('[data-act="lk.regSym"][data-k="paw"]'); await p.click('[data-act="lk.regNext"]');
  await p.fill('[data-in="reg.pass"]', 'qwerty123');
  assert.match(await p.locator('.pm-t').innerText(), /Дуже слабкий/);
  assert.equal(await p.locator('[data-act="lk.regNext"]').isDisabled(), true);
  await p.fill('[data-in="reg.pass"]', 'Murchyk-2026!');
  await p.click('[data-act="lk.regNext"]');
  const s = await S();
  assert.equal(s.me.nick, 'kotyk.art'); assert.equal(s.me.niche, 'pets');
  assert.ok(await p.locator('.stories').isVisible());
});

await step('фото-допис: фільтр, напис, хештеги, публікація; реакції набираються з часом', async () => {
  await atHour(18);
  await p.click('[data-act="lk.create"]');
  await p.click('.pick-grid [data-act="cr.pick"] >> nth=0');
  await p.click('[data-act="cr.next"]');
  await p.click('[data-act="cr.filter"][data-f="bright"]');
  await p.click('[data-act="cr.tool"][data-k="text"]'); await p.fill('[data-in="cr.ptext"]', 'Сонний Мурчик');
  await p.click('[data-act="cr.next"]');
  await p.fill('[data-in="cr.caption"]', 'Мурчик знову спить на підвіконні. А ваші улюбленці люблять поспати?');
  await p.click('[data-act="cr.tag"][data-t="котики"]');
  assert.match(await p.inputValue('[data-in="cr.caption"]'), /#котики$/);
  await p.click('[data-act="cr.publish"]');
  assert.match(await p.locator('.ah-t').innerText(), /Допис/);
  await adv(300);
  const st = (await S()).posts[0].stats;
  assert.ok(st.views > 0 && st.likes > 0, JSON.stringify(st));
  await p.click('[data-act="lk.go"][data-v="stats"]');
  assert.match(await p.locator('.scroll').innerText(), /Перегляди[\s\S]*Що вплинуло на результат[\s\S]*Вдалий час/);
  await p.click('[data-act="lk.back"]');
});

await step('коментарі: відповідь, приховування, блокування', async () => {
  await p.click('[data-act="lk.go"][data-v="comments"] >> nth=0');
  const before = await p.locator('.cm:not(.cap)').count();
  assert.ok(before > 0);
  await p.click('[data-act="lk.replyTo"] >> nth=0');
  await p.fill('[data-keep="cm"]', 'Дякую, дуже приємно!');
  await p.press('[data-keep="cm"]', 'Enter');
  await p.locator('.cm-r:has-text("Дякую, дуже приємно")').waitFor();
  await p.click('[data-act="lk.cMenu"] >> nth=0');
  await p.click('.act:has-text("Приховати")');
  await p.locator('[data-act="lk.toggleHidden"]').waitFor();
  await p.click('[data-act="lk.cMenu"] >> nth=0');
  await p.click('.act:has-text("Заблокувати")');
  assert.ok(Object.values((await S()).people).some(u => u.blocked));
  await p.click('[data-act="lk.back"]');
});

await step('відео: обрізка початку, вільна музика, утримання глядачів', async () => {
  await p.click('[data-act="lk.back"]');
  await p.click('[data-act="lk.create"]');
  await p.click('[data-act="cr.kind"][data-k="video"]');
  await p.click('.pick-grid [data-act="cr.pick"] >> nth=0');
  await p.click('[data-act="cr.next"]');
  const clip = await p.evaluate(() => Blogger.phone.apps.likeer.top.d.clip);
  await p.locator('[data-rng="start"]').fill('9');
  await p.click('[data-act="cr.music"][data-m="guitar"]');
  await p.fill('[data-in="cr.vtitle"]', 'Подивіться!');
  await p.click('[data-act="cr.next"]');
  await p.fill('[data-in="cr.caption"]', 'Коротке відео #котики');
  await p.click('[data-act="cr.publish"]');
  await adv(240);
  const v = (await S()).posts.find(x => x.kind === 'video');
  assert.equal(v.video.clip, clip); assert.equal(v.video.start, 9);
  assert.ok(v.why.some(w => /Цікавий початок/.test(w[1])));
  await p.click('[data-act="lk.go"][data-v="stats"]');
  assert.match(await p.locator('.scroll').innerText(), /Утримання глядачів/);
  await p.click('[data-act="lk.back"]'); await p.click('[data-act="lk.back"]');
});

await step('відео в дописі грає без перезапуску, поки ростуть лічильники; розгорнутий список не згортається', async () => {
  await p.click('[data-act="lk.tab"][data-v="profile"]');
  await p.click('.gi:has(.vbox) >> nth=0');
  await p.click('.pm-media');
  await p.evaluate(() => { window.__svg = document.querySelector('.pm-media svg.vid'); });
  await adv(60); await p.waitForTimeout(150);
  assert.ok(await p.evaluate(() => document.querySelector('.pm-media svg.vid') === window.__svg && !window.__svg.classList.contains('paused')), 'той самий вузол, анімація не скинута');
  await p.click('[data-act="lk.back"]');
  await p.click('[data-act="lk.create"]'); await p.click('.pick-grid [data-act="cr.pick"] >> nth=0'); await p.click('[data-act="cr.next"]'); await p.click('[data-act="cr.next"]');
  await p.fill('[data-in="cr.caption"]', 'Перевірка');
  await p.click('.pre summary');
  await p.click('[data-act="cr.tag"][data-t="котики"]');
  assert.equal(await p.inputValue('[data-in="cr.caption"]'), 'Перевірка #котики');
  await adv(30); await p.waitForTimeout(100);
  assert.equal(await p.getAttribute('.pre', 'open'), '');
  await p.click('[data-act="cr.back"]'); await p.click('[data-act="cr.back"]'); await p.click('[data-act="cr.back"]'); await p.click('.cf [data-v="1"]');
});

await step('коментарі під дописами інших блогерів відкриваються', async () => {
  await p.click('[data-act="lk.tab"][data-v="feed"]');
  await p.click('[data-act="lk.feedComments"] >> nth=0');
  assert.ok(await p.locator('.sheet .cm').count() >= 3);
  await p.click('[data-sh-close]');
});

await step('камера записує місце, галерея дозволяє його видалити', async () => {
  await home(); await p.click('[data-app="camera"]');
  assert.match(await p.locator('.cam-geo').innerText(), /увімк/);
  await p.click('[data-act="ph.shoot"]');
  await home(); await p.click('[data-app="gallery"]');
  await p.click('[data-act="ph.galOpen"] >> nth=0');
  assert.match(await p.locator('.check').innerText(), /Шкільна/);
  await p.click('[data-act="ph.strip"]');
  assert.match(await p.locator('.check').innerText(), /Місце не збережено/);
});

await step('фейкова новина: перевірка джерела; поширення знижує довіру', async () => {
  await home(); await p.click('[data-app="likeer"]'); await p.click('[data-act="lk.tab"][data-v="feed"]');
  await p.click('[data-act="lk.checkFake"]');
  assert.match(await p.locator('.sheet').innerText(), /фейк/);
  await p.click('[data-sh-close]');
  const t0 = (await S()).trust;
  await p.click('[data-act="lk.shareFake"]'); await p.click('.cf [data-v="1"]');
  assert.ok((await S()).trust < t0);
});

await step('фішинг у Директі → злам → відновлення через код із Пошти', async () => {
  await p.evaluate(() => Blogger.sim.phish());
  await p.click('[data-act="lk.go"][data-v="dms"]');
  await p.click('.dm >> nth=0');
  await p.click('[data-act="lk.dmOpt"][data-k="open"]');
  assert.match(await p.locator('.url').innerText(), /likeer-help\.com/);
  await p.fill('[data-keep="ph-pass"]', 'Murchyk-2026!'); await p.click('[data-act="ph.phishGo"]');
  await adv(30);
  await p.waitForSelector('.welcome:has-text("Ви вийшли з профілю")');
  await p.click('[data-act="lk.recover"]');
  const code = (await S()).flags.code;
  await home(); await p.click('[data-app="mail"]');
  assert.match(await p.locator('.ml >> nth=0').innerText(), new RegExp(code));
  await home(); await p.click('[data-app="likeer"]');
  await p.fill('[data-keep="code"]', code); await p.fill('[data-keep="npass"]', 'Novyi-Parol-77');
  await p.click('[data-act="lk.recoverGo"]');
  const s = await S();
  assert.equal(s.hack, null); assert.equal(s.me.pass, 'Novyi-Parol-77');
});

await step('налаштування: двофакторний вхід і фільтр образливих коментарів', async () => {
  await p.click('[data-act="lk.go"][data-v="settings"]');
  await p.click('[data-sw="set.twoFA"]'); await p.click('[data-sw="set.filter"]');
  await p.selectOption('[data-sel="dms"]', 'followers');
  const st = (await S()).settings;
  assert.ok(st.twoFA && st.filter); assert.equal(st.dms, 'followers');
  await p.click('[data-act="lk.go"][data-v="sessions"]');
  await p.click('[data-act="lk.endSession"]');
  assert.equal((await S()).settings.sessions.length, 1);
});

await step('усе зберігається після перезавантаження сторінки', async () => {
  const before = await S();
  await p.evaluate(() => Blogger.phone.saveNow());
  await p.reload(); await p.waitForFunction(() => window.Blogger);
  const after = await S();
  assert.equal(after.me.nick, 'kotyk.art'); assert.equal(after.posts.length, before.posts.length); assert.equal(after.followers, before.followers);
  assert.ok(after.settings.twoFA);
});

await step('час іде сам, пульт перемотує до вечора', async () => {
  await p.click('[data-speed="10"]');
  const t0 = (await S()).t; await p.waitForTimeout(2100);
  assert.ok((await S()).t >= t0 + 20);
  await p.click('[data-speed="0"]');
  await p.click('[data-jump="evening"]');
  assert.equal(Math.floor((await S()).t / 60) % 24, 18);
});

await step('жодної помилки в консолі сторінки', async () => { assert.deepEqual(errors, []); });

await browser.close();
server.close();
