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
  await p.click('[data-act="cr.back"]'); await p.click('[data-act="cr.back"]'); await p.click('[data-act="cr.back"]'); await p.click('.act:has-text("Не зберігати")');
});

await step('коментарі під дописами інших блогерів відкриваються', async () => {
  await p.click('[data-act="lk.tab"][data-v="feed"]');
  await p.click('[data-act="lk.feedComments"] >> nth=0');
  assert.ok(await p.locator('.sheet .cm').count() >= 3);
  await p.click('[data-sh-close]');
});

await step('чернетки, ідея → допис, хештег і історія блогера', async () => {
  await p.click('[data-act="lk.tab"][data-v="feed"]');
  await p.click('[data-act="lk.create"]'); await p.click('.pick-grid [data-act="cr.pick"] >> nth=1'); await p.click('[data-act="cr.next"]'); await p.click('[data-act="cr.next"]');
  await p.fill('[data-in="cr.caption"]', 'Чернетка про піцу');
  for (let i = 0; i < 3; i++) await p.click('[data-act="cr.back"]');
  await p.click('.act:has-text("Зберегти чернетку")');
  assert.equal((await S()).drafts.length, 1);
  await p.click('[data-act="lk.tab"][data-v="profile"]'); await p.click('[data-act="lk.ptab"][data-t="drafts"]');
  await p.click('[data-act="lk.openDraft"]'); await p.click('[data-act="cr.next"]');
  assert.equal(await p.inputValue('[data-in="cr.caption"]'), 'Чернетка про піцу');
  await p.click('[data-act="cr.publish"]');
  assert.equal((await S()).drafts.length, 0, 'опублікована чернетка зникає');
  await p.evaluate(() => Blogger.sim.addIdea('Покажи, чим годуєш улюбленця', 'comment'));
  await home(); await p.click('[data-app="ideas"]'); await p.click('[data-act="ph.ideaPost"] >> nth=0');
  await p.click('.pick-grid [data-act="cr.pick"] >> nth=0'); await p.click('[data-act="cr.next"]'); await p.click('[data-act="cr.next"]');
  assert.match(await p.locator('.hint >> nth=0').innerText(), /Покажи, чим годуєш/);
  await p.fill('[data-in="cr.caption"]', 'Обід Мурчика #котики'); await p.click('[data-act="cr.publish"]');
  assert.ok((await S()).ideas.find(i => /годуєш/.test(i.text)).done);
  await p.click('.pc .tag >> nth=0');
  assert.match(await p.locator('.sheet').innerText(), /#котики[\s\S]*дописів з цим хештегом/);
  await p.click('[data-sh-close]');
  await p.click('[data-act="lk.back"]'); await p.click('[data-act="lk.tab"][data-v="feed"]');
  await p.click('[data-act="lk.cstory"] >> nth=0');
  assert.ok(await p.locator('.story-view .sv-cap').isVisible());
  await p.click('[data-act="lk.back"]');
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

// Власні файли генеруються прямо в браузері: фото — на полотні, відео — записом полотна (WebM)
const media = await p.evaluate(async () => {
  const pic = (w, h, dark) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#ff7043'); g.addColorStop(1, '#42a5f5'); x.fillStyle = g; x.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { x.fillStyle = `hsl(${i * 37 % 360},80%,${30 + i % 40}%)`; x.fillRect((i * 97) % w, (i * 53) % h, 20, 20); } if (dark) { x.fillStyle = 'rgba(0,0,0,.86)'; x.fillRect(0, 0, w, h); } return c.toDataURL('image/jpeg', 0.9).split(',')[1]; };
  const c = document.createElement('canvas'); c.width = 360; c.height = 640; const x = c.getContext('2d');
  const rec = new MediaRecorder(c.captureStream(30), { mimeType: 'video/webm' }), parts = [];
  rec.ondataavailable = e => parts.push(e.data);
  const t0 = performance.now(); let raf;
  const draw = () => { const t = (performance.now() - t0) / 1000; x.fillStyle = '#2e5d8a'; x.fillRect(0, 0, 360, 640); if (t > 1.2) { x.fillStyle = '#ffca28'; x.fillRect(40 + (t - 1.2) * 160 % 260, 200 + Math.sin(t * 6) * 120, 70, 70); } raf = requestAnimationFrame(draw); };
  draw(); rec.start(200); await new Promise(r => setTimeout(r, 3200)); rec.stop(); await new Promise(r => { rec.onstop = r; }); cancelAnimationFrame(raf);
  const b = new Blob(parts, { type: 'video/webm' }), buf = new Uint8Array(await b.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  return { a: pic(1200, 1500), b: pic(1600, 900), d: pic(1200, 1500, true), v: btoa(bin) };
});
const file = (name, type, b64) => ({ name, mimeType: type, buffer: Buffer.from(b64, 'base64') });

await step('власні фото: додавання в Галерею, вибір теми, перевірка кадру', async () => {
  await home(); await p.click('[data-app="gallery"]');
  await p.setInputFiles('input[data-file="gallery"]', [file('gory.jpg', 'image/jpeg', media.a), file('more.jpg', 'image/jpeg', media.b), file('vechir.jpg', 'image/jpeg', media.d)]);
  await p.click('.topics [data-t="pets"]');
  await p.waitForFunction(() => document.querySelectorAll('.pg .art.own img').length === 3);
  const own = (await S()).gallery.filter(g => g.own);
  assert.equal(own.length, 3); assert.ok(own.every(g => g.topic === 'pets' && g.mid && g.an));
  await p.click('.pg >> nth=0'); // останній доданий — темний
  assert.match(await p.locator('.qc').innerText(), /Темне/);
  await p.selectOption('[data-phsel="topic"]', 'travel');
  assert.equal((await S()).gallery[0].topic, 'travel');
  await p.click('[data-act="ph.galBack"]');
});

await step('карусель із власних фото: кілька кадрів, фільтр на окремому кадрі, гортання', async () => {
  await home(); await p.click('[data-app="likeer"]'); await p.evaluate(() => Blogger.phone.apps.likeer.tab('feed'));
  await p.click('[data-act="lk.create"]'); await p.click('[data-act="cr.multi"]');
  for (const i of [2, 1, 0]) await p.click(`.pick-grid .pg >> nth=${i}`);
  assert.match(await p.locator('[data-act="cr.next"]').innerText(), /\(3\)/);
  await p.click('[data-act="cr.next"]');
  await p.click('[data-act="cr.slide"] >> nth=2'); await p.click('[data-act="cr.filter"][data-f="bright"]');
  await p.click('[data-act="cr.next"]');
  await p.fill('[data-in="cr.caption"]', 'Три кадри з прогулянки. Який найкращий? #котики');
  await p.click('[data-act="cr.publish"]');
  await p.waitForSelector('.car .car-s >> nth=2');
  const post = (await S()).posts[0];
  assert.equal(post.photos.length, 3); assert.equal(post.photos[2].filter, 'bright'); assert.equal(post.carousel, 3);
  assert.ok(post.photos.every(x => x.g?.own), 'копія власного фото в дописі');
  await p.click('.car-a.r'); await p.waitForFunction(() => document.querySelector('.car-n')?.textContent === '2/3');
  await adv(240);
  assert.ok((await S()).posts[0].stats.views > 0);
});

await step('власне відео: додавання під час створення, обрізка, публікація', async () => {
  await p.evaluate(() => Blogger.phone.apps.likeer.tab('feed'));
  await p.click('[data-act="lk.create"]'); await p.click('[data-act="cr.kind"][data-k="video"]');
  await p.setInputFiles('input[data-file="create"]', file('kit.webm', 'video/webm', media.v));
  await p.click('.topics [data-t="pets"]');
  await p.waitForSelector('.pick-prev .art.own'); await p.click('[data-act="cr.next"]');
  await p.waitForSelector('.ed-prev video[data-own]');
  const g = (await S()).gallery.find(x => x.type === 'video' && x.own);
  assert.ok(g.dur >= 2 && g.dur <= 5, `тривалість ${g.dur}`); assert.ok(g.h > g.w, 'вертикальне');
  await p.click('[data-act="cr.next"]'); await p.click('[data-act="cr.publish"]');
  const v = (await S()).posts[0];
  assert.equal(v.kind, 'video'); assert.ok(v.video.own && v.video.g.mid === g.mid);
  await p.click('.pm-media[data-act="lk.play"]');
  await p.waitForFunction(() => { const x = document.querySelector('.pm-media video'); return x && !x.paused; });
});

await step('«Хвиля»: канал, оформлення, відео з обкладинкою, аналітика й коментарі', async () => {
  await home(); await p.click('[data-app="tube"]'); await p.click('[data-act="tb.start"]');
  await p.fill('[data-in="tb.cname"]', 'Мурчик і я'); await p.fill('[data-in="tb.chandle"]', 'Murchyk TV');
  assert.ok(await p.locator('[data-act="tb.createCh"]').isDisabled(), 'неправильна адреса каналу');
  await p.fill('[data-in="tb.chandle"]', 'murchyk.tv'); await p.click('[data-act="tb.createCh"]');
  await p.click('[data-act="tb.go"][data-v="custom"] >> nth=0');
  await p.click('.bp[data-mid^="m"] >> nth=0'); await p.click('.avp[data-mid^="m"] >> nth=0');
  await p.fill('[data-in="tb.udesc"]', 'Щосуботи — нові трюки мого кота Мурчика й поради для власників.');
  assert.match(await p.locator('.sc-top').innerText(), /75%/);
  await p.click('[data-act="tb.saveCustom"]');
  let t = (await S()).tube; assert.ok(t.banner.img && t.avatar.img && t.desc.length > 40);
  await p.click('[data-act="tb.upload"] >> nth=0');
  await p.click('.pick-grid .pg >> nth=0'); await p.click('[data-act="tb.upNext"]');
  await p.fill('[data-in="tb.title"]', 'Кіт ловить жовтий квадрат');
  await p.fill('[data-in="tb.desc"]', 'Коротке відео: як кіт полює на іграшку. #котики');
  await p.click('[data-act="tb.publish"]');
  assert.equal(await p.locator('.ah-t').innerText(), 'Деталі відео', 'без вибору аудиторії відео не публікується');
  await p.click('[data-act="tb.kids"][data-v="false"]'); await p.click('[data-act="tb.publish"]');
  t = (await S()).tube; const v = t.videos[0];
  assert.ok(v.shorts, 'вертикальне коротке відео'); assert.ok(v.t > 0 && v.src.own);
  await adv(2 * 1440);
  await p.click('[data-act="tb.go"][data-v="stats"]');
  assert.equal(await p.locator('.chart').count(), 2);
  assert.match(await p.locator('.tiles').innerText(), /Сер\. перегляд/);
  await p.evaluate(() => Blogger.phone.apps.tube.tab('studio'));
  assert.match(await p.locator('.st-row').innerText(), /Кіт ловить/);
  await p.evaluate(() => Blogger.phone.apps.tube.tab('home'));
  await p.click('[data-act="tb.watch"] >> nth=0');
  await p.click('[data-act="tb.follow"]');
  assert.equal((await S()).tube.follows.length, 1);
});

await step('шпалери з власного фото на головному екрані', async () => {
  await home(); await p.click('[data-app="settings"]');
  await p.click('.wall[data-k^="m"] >> nth=0');
  await home();
  assert.match(await p.locator('.home').getAttribute('style'), /url\(blob:/);
});

await step('усе зберігається після перезавантаження сторінки', async () => {
  const before = await S();
  await p.evaluate(() => Blogger.phone.saveNow());
  await p.reload(); await p.waitForFunction(() => window.Blogger);
  const after = await S();
  assert.equal(after.me.nick, 'kotyk.art'); assert.equal(after.posts.length, before.posts.length); assert.equal(after.followers, before.followers);
  assert.ok(after.settings.twoFA);
  assert.equal(after.tube.name, 'Мурчик і я'); assert.equal(after.tube.videos.length, before.tube.videos.length);
  // власні файли лишаються в браузері й показуються після перезавантаження
  await p.evaluate(() => Blogger.phone.open('gallery', { f: 'own' }));
  await p.waitForFunction(() => { const i = document.querySelectorAll('.pg .art.own img'); return i.length === 4 && [...i].every(x => x.complete && x.naturalWidth > 0); });
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
