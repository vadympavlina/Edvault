// Браузерна перевірка симулятора блогера: телефон, Instagram, створення дописів, реакції, безпека, збереження.
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
  assert.match(await p.locator('.home').innerText(), /Instagram[\s\S]*Камера[\s\S]*Галерея/);
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
  assert.match(await p.locator('.url').innerText(), /instagram-help-center\.com/);
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

await step('YouTube: канал, оформлення, відео з обкладинкою, аналітика й коментарі', async () => {
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

await step('реклама: налаштування таргету, ціна, модерація, результати й повернення залишку', async () => {
  await home(); await p.click('[data-app="likeer"]');
  await p.evaluate(() => { const lk = Blogger.phone.apps.likeer, pp = Blogger.sim.s.posts.find(x => x.carousel); lk.tab('profile'); lk.go('post', { id: pp.id }); });
  await p.click('[data-act="ad.promote"]');
  assert.match(await p.locator('.ad-step-t').innerText(), /Крок 2 з 6/);
  await p.click('[data-act="ad.goal"][data-k="profile"]'); await p.click('[data-act="ad.next"]');
  await p.click('[data-act="ad.auto"][data-v="false"]');
  await p.selectOption('[data-adsel="city"]', 'lviv'); await p.click('[data-act="ad.int"][data-k="pets"]');
  const before = await p.locator('.aud-top b').innerText();
  await p.locator('[data-adrng="age0"]').fill('13');
  assert.match(await p.locator('.warnbox').innerText(), /підлітків/);
  assert.ok(await p.locator('[data-act="ad.int"][data-k="pets"]').isDisabled(), 'для підлітків інтереси вимкнено');
  await p.locator('[data-adrng="age0"]').fill('18');
  assert.equal(await p.locator('.aud-top b').innerText(), before);
  await p.click('[data-act="ad.next"]'); await p.click('[data-act="ad.next"]');
  await p.locator('[data-adrng="daily"]').fill('200'); await p.locator('[data-adrng="days"]').fill('3');
  assert.match(await p.locator('.est-sum').innerText(), /720/, '200 × 3 + ПДВ 20%');
  await p.click('[data-act="ad.next"]');
  assert.match(await p.locator('.ad-prev').innerText(), /Реклама/);
  await p.click('[data-act="ad.launch"]');
  assert.match(await p.locator('.ad-st').innerText(), /перевірці/);
  await adv(2 * 1440);
  let ad = (await S()).ads.list[0];
  assert.equal(ad.status, 'active'); assert.ok(ad.stats.spent > 0 && ad.stats.imps > 0);
  assert.match(await p.locator('.tiles').innerText(), /CPM/);
  await p.click('[data-act="ad.stop"]'); await p.click('.cf [data-v="1"]');
  ad = (await S()).ads.list[0]; assert.equal(ad.status, 'done'); assert.ok(ad.refund > 0);
  // фото з адресою будинку модерація не пропускає, гроші повертаються
  await p.click('[data-act="lk.back"]'); await p.click('[data-act="ad.new"]');
  await p.click('[data-act="ad.src"][data-k="photo"]');
  const hid = await p.evaluate(() => Blogger.sim.s.gallery.find(g => g.scene === 'house').id);
  await p.click(`[data-act="ad.pickPhoto"][data-id="${hid}"]`); await p.fill('[data-in="ad.caption"]', 'Підписуйтесь!');
  for (let i = 0; i < 5; i++) await p.click('[data-act="ad.next"]');
  // якщо на навчальному балансі замало грошей, кнопка пропонує поповнити й одразу запустити
  await p.click('[data-act="ad.launch"]');
  if (await p.locator('.cf [data-v="1"]').count()) await p.click('.cf [data-v="1"]');
  await p.waitForSelector('.ad-st'); const bal = (await S()).ads.balance; await adv(120);
  const rej = (await S()).ads.list[0];
  assert.equal(rej.status, 'rejected'); assert.match(rej.reasons[0], /Особисті дані/); const ads = (await S()).ads; assert.ok(rej.refund > 0 && Math.abs(rej.refund - rej.paid) < 0.01, 'гроші повертаються повністю'); assert.equal(Math.round(ads.balance * 100), Math.round((bal + rej.refund) * 100), JSON.stringify({ bal, list: ads.list.map(a => [a.status, a.paid, a.refund, Math.round(a.stats.spent * 100) / 100]) }));
});

await step('лайки й коментарі скрізь: свій допис, допис блогера, відео на YouTube', async () => {
  await home(); await p.click('[data-app="likeer"]');
  await p.evaluate(() => { const lk = Blogger.phone.apps.likeer; lk.tab('profile'); lk.go('post', { id: Blogger.sim.s.posts.find(x => x.t).id }); });
  const l0 = (await S()).posts.find(x => x.t).stats.likes;
  await p.click('[data-act="lk.likePost"]');
  assert.equal((await S()).posts.find(x => x.t).stats.likes, l0 + 1);
  await p.click('[data-act="lk.go"][data-v="comments"] >> nth=0');
  assert.ok(!(await p.locator('[data-keep="cm"]').isDisabled()), 'коментувати можна без вибору чужого коментаря');
  await p.fill('[data-keep="cm"]', 'Дякую всім, що дивитесь!'); await p.click('[data-act="lk.sendReply"]');
  assert.ok((await S()).posts.find(x => x.t).comments.some(c => c.mine && /Дякую всім/.test(c.text)));
  await p.waitForSelector('.cm.mine .author');
  await p.evaluate(() => Blogger.phone.apps.likeer.tab('feed'));
  await p.click('[data-act="lk.feedComments"] >> nth=0');
  await p.fill('.fc-in input', 'Дуже гарно!'); await p.click('.fc-in [data-send]');
  await p.waitForSelector('.fc-list .cm.mine');
  await p.keyboard.press('Escape');
  await home(); await p.click('[data-app="tube"]');
  await p.evaluate(() => { const t = Blogger.phone.apps.tube; t.tab('channel'); t.go('video', { id: Blogger.sim.s.tube.videos[0].id }); });
  const v0 = (await S()).tube.videos[0].stats.likes;
  await p.click('[data-act="tb.likeOwn"]');
  assert.equal((await S()).tube.videos[0].stats.likes, v0 + 1);
});

await step('історії: кілька підряд, автоперехід, натискання й свайп між блогерами', async () => {
  await home(); await p.click('[data-app="likeer"]'); await p.evaluate(() => Blogger.phone.apps.likeer.tab('feed'));
  await p.click('[data-act="lk.cstory"] >> nth=0');
  const first = await p.locator('.sv-h b').innerText();
  assert.ok(await p.locator('.sv-bars i').count() >= 2, 'у блогера кілька історій');
  await p.click('.sv-next'); assert.equal(await p.locator('.sv-bars i.on').count(), 1);
  await p.waitForFunction(f => document.querySelector('.sv-h b')?.textContent !== f || document.querySelectorAll('.sv-bars i.on').length >= 2, first, { timeout: 7000 }); // автоперехід за 5 с
  const box = await p.locator('.sv-media').boundingBox();
  const before = await p.locator('.sv-h b').innerText();
  await p.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2); await p.mouse.down(); await p.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 6 }); await p.mouse.up();
  await p.waitForFunction(b => document.querySelector('.sv-h b')?.textContent !== b, before);
  await p.click('[data-act="lk.back"]');
  assert.equal(await p.locator('.story .ring.seen').first().count(), 1, 'переглянуті історії — сіре кільце');
});

await step('реєстрація: можна вибрати фото для аватарки; жоден екран не прокручується вбік', async () => {
  const wide = () => p.evaluate(() => [...document.querySelectorAll('#screen .scroll, #screen header, #screen .foot')].flatMap(sc => { const R = sc.getBoundingClientRect().right; return [...sc.querySelectorAll('*')].filter(e => !(e instanceof SVGElement) && e.offsetParent && e.getBoundingClientRect().right > R + 1 && !e.closest('.stories,.car')).map(e => e.className); }));
  for (const go of [() => Blogger.phone.apps.likeer.tab('feed'), () => Blogger.phone.apps.likeer.tab('activity'), () => Blogger.phone.apps.likeer.tab('search'), () => { Blogger.phone.apps.likeer.tab('feed'); Blogger.phone.apps.likeer.act('create', {}); }, () => Blogger.phone.open('camera'), () => { Blogger.phone.open('tube'); Blogger.phone.apps.tube.tab('home'); }]) {
    await p.evaluate(go); assert.deepEqual(await wide(), []);
  }
  // окрема сторінка — нова реєстрація
  const ctx2 = await browser.newContext({ viewport: { width: 1366, height: 860 } }), q = await newPage(ctx2, errors); await q.goto(server.url + '/emulators/blogger'); await q.waitForFunction(() => window.Blogger);
  await q.click('[data-app="likeer"]'); await q.click('[data-act="lk.signup"]');
  await q.fill('[data-in="reg.nick"]', 'murko.fan'); await q.click('[data-act="lk.regNext"]'); await q.click('[data-k="pets"]'); await q.click('[data-act="lk.regNext"]');
  await q.click('[data-act="lk.regImg"][data-scene="dog"]'); await q.click('[data-act="lk.regNext"]');
  await q.fill('[data-in="reg.pass"]', 'Murchyk-2026!'); await q.click('[data-act="lk.regNext"]');
  assert.equal(await q.evaluate(() => Blogger.sim.s.me.avatar.scene), 'dog');
  await ctx2.close();
});

await step('шпалери з власного фото на головному екрані', async () => {
  await home(); await p.click('[data-app="settings"]');
  await p.click('.wall[data-k^="m"] >> nth=0');
  await home();
  assert.match(await p.locator('.home').getAttribute('style'), /url\(blob:/);
});

await step('Директ: людина друкує, відповідає по-живому, незнайомці — у «Запитах»', async () => {
  await home(); await p.click('[data-app="likeer"]'); await atHour(17);
  const did = await p.evaluate(() => { const sim = Blogger.sim, u = sim.person('fan', ['pets']); sim.s.fans.push(u.id); const d = sim.talk(u.id, 'fan'); const lk = Blogger.phone.apps.likeer; lk.tab('feed'); lk.go('dms'); lk.go('thread', { id: d.id }); return d.id; });
  await p.waitForSelector('.typing', { timeout: 4000 });
  await p.waitForSelector('.chips .chip-btn', { timeout: 8000 });
  assert.match(await p.locator('.msgs, .thread, main').first().innerText(), /\S/);
  await p.fill(`[data-keep="dm-${did}"]`, 'Дякую! Його звати Мурчик'); await p.click('[data-act="lk.dmSend"]');
  await p.waitForFunction(id => { const d = Blogger.sim.s.dms.find(x => x.id === id); return d.msgs.filter(m => !m.me && !m.sys).length >= 2 && !d.pending?.length; }, did, { timeout: 12000 });
  const d = (await S()).dms.find(x => x.id === did);
  assert.ok(d.msgs.find(m => m.me).seen, 'переглянуто'); assert.match(d.msgs.map(m => m.text).join(' '), /Мурчик/);
  // незнайомець потрапляє в запити: відповісти можна лише після «Прийняти»
  // раніше ввімкнули «Лише підписники» — незнайомця не пропускає взагалі
  assert.equal(await p.evaluate(() => { const sim = Blogger.sim, d = sim.talk(sim.person('stranger').id, 'stranger'); return !!d.script; }), false);
  const sid = await p.evaluate(() => { const sim = Blogger.sim; sim.s.settings.dms = 'all'; const u = sim.person('stranger'), d = sim.talk(u.id, 'stranger'); while (d.pending?.length) sim.deliver(d); return d.id; });
  await p.evaluate(() => Blogger.phone.apps.likeer.back());
  await p.click('[data-act="lk.dmTab"][data-t="req"]');
  assert.match(await p.locator('.dm-tabs').innerText(), /Запити \(1\)/);
  await p.evaluate(id => Blogger.phone.apps.likeer.go('thread', { id }), sid);
  assert.match(await p.locator('.req-bar').innerText(), /Прийміть запит/);
  await p.click('[data-act="lk.dmBlock"]'); if (await p.locator('.cf [data-v="1"]').count()) await p.click('.cf [data-v="1"]');
  assert.ok((await S()).dms.find(x => x.id === sid).blocked);
  await p.evaluate(() => { Blogger.sim.s.settings.dms = 'followers'; });
});

await step('реклама на YouTube: просування відео з оплатою за перегляд', async () => {
  await home(); await p.click('[data-app="tube"]');
  await p.evaluate(() => { const t = Blogger.phone.apps.tube; t.tab('channel'); t.go('video', { id: Blogger.sim.s.tube.videos.find(v => v.t && v.vis === 'public' && !v.kids).id }); });
  await p.click('.promo-btn.red');
  for (let i = 0; i < 8 && !(await p.locator('[data-act="ad.launch"]').count()); i++) await p.click('[data-act="ad.next"]');
  assert.match(await p.locator('.phone').innerText(), /перегляд/i);
  await p.click('[data-act="ad.launch"]'); if (await p.locator('.cf [data-v="1"]').count()) await p.click('.cf [data-v="1"]');
  await adv(2 * 1440);
  const ad = (await S()).ads.list.find(a => a.platform === 'tube');
  assert.ok(ad && ['active', 'done'].includes(ad.status) && ad.stats.views > 0, JSON.stringify(ad?.status));
  assert.match(await p.locator('.tiles').innerText(), /перегляд/i);
});

await step('Telegram: акаунт уже є, створення каналу, допис, запрошення, статистика', async () => {
  await home(); await p.click('[data-app="tg"]');
  assert.match(await p.locator('.tg-app').innerText(), /Мама[\s\S]*7-А клас/);
  await p.click('[data-act="tg.open"][data-id="mom"]'); await p.fill('[data-keep="tgm-mom"]', 'Привіт!'); await p.click('[data-act="tg.send"]');
  await p.evaluate(() => Blogger.phone.apps.tg.back());
  await p.click('.tg-promo'); assert.ok(await p.locator('[data-act="tg.nNext"]').isDisabled());
  await p.fill('[data-keep="tg.nTitle"]', 'Мурчик і пригоди'); await p.click('[data-act="tg.nNext"]');
  assert.equal(await p.locator('[data-keep="tg.nLink"]').inputValue(), 'murchyk_i_pryhody', 'посилання з назви');
  await p.fill('[data-keep="tg.nLink"]', 'memes'); assert.match(await p.locator('[data-err]').innerText(), /зайняте/); assert.ok(await p.locator('[data-act="tg.nNext"]').isDisabled());
  await p.fill('[data-keep="tg.nLink"]', 'murchyk_pryhody'); await p.click('[data-act="tg.nNext"]');
  await p.click('[data-act="tg.nCreate"]');
  assert.match(await p.locator('.tg-first').innerText(), /Канал створено/);
  await p.fill('[data-keep="tg.post"]', 'Я вчуся в 7-А класі'); assert.match(await p.locator('[data-tgtip]').innerText(), /Особисті дані/);
  await p.fill('[data-keep="tg.post"]', 'Привіт! Тут я розповідатиму про свого кота Мурчика: як він грається і що любить. Нові дописи щовечора.');
  await p.click('[data-act="tg.publish"]');
  await p.click('[data-act="tg.attach"]'); await p.click('[data-poll]'); await p.fill('[data-pq]', 'Про що написати?'); await p.fill('[data-po="0"]', 'Іграшки'); await p.fill('[data-po="1"]', 'Сон'); await p.click('[data-ok]');
  await p.click('[data-act="tg.publish"]');
  assert.equal(await p.locator('.tg-post').count(), 2);
  await p.click('.tg-hav'); await p.click('[data-act="tg.invite"]'); await p.click('[data-i="class"]'); await p.click('[data-i="mom"]'); await p.click('[data-send]');
  await adv(1440);
  const ch = (await S()).tg.ch; assert.ok(ch.subs >= 3 && ch.posts[0].stats.views > 0, JSON.stringify({ subs: ch.subs, v: ch.posts[0].stats.views }));
  await p.click('[data-act="tg.go"][data-v="stats"]'); assert.match(await p.locator('.tiles').innerText(), /ERR/);
  assert.match(await p.locator('.tg-src').innerText(), /Посилання-запрошення/);
  await p.evaluate(() => { Blogger.phone.apps.tg.stack = [{ v: 'settings' }]; Blogger.phone.render(true); });
  await p.click('[data-act="tg.go"][data-v="privacy"]'); await p.click('[data-sw="tg.pass2"]'); assert.ok((await S()).tg.set.pass2);
});

await step('реклама від бренду в каналі й посилання на канал у профілі Instagram', async () => {
  // посилання на канал у профілі Instagram
  await home(); await p.click('[data-app="likeer"]');
  await p.evaluate(() => { const lk = Blogger.phone.apps.likeer; lk.tab('profile'); lk.go('editProfile'); });
  await p.click('[data-act="lk.epTg"]'); assert.equal(await p.locator('[data-keep="ep.link"]').inputValue(), 't.me/murchyk_pryhody');
  await p.click('[data-act="lk.saveProfile"]'); assert.match(await p.locator('.pr-link').innerText(), /t\.me\/murchyk_pryhody/);
  await p.click('.pr-link'); assert.ok(await p.locator('.tg-app').count(), 'посилання відкриває канал');
  // бренд пропонує рекламу
  await p.evaluate(async () => { const m = await import('/emulators/bloggeremu/js/tgsim.js'), sim = Blogger.sim; m.brandOffer(sim, sim.s.tg.ch, false); const c = sim.s.tg.chats.find(x => x.id === sim.s.tg.flags.brandChat); while (c.pending?.length) m.tgDeliver(sim, c); Blogger.phone.apps.tg.stack = [{ v: 'chats' }, { v: 'chat', id: c.id }]; Blogger.phone.render(true); });
  await p.click('[data-act="tg.opt"][data-k="yes"]'); await p.waitForSelector('[data-act="tg.opt"][data-k="parents"]', { timeout: 15000 });
  await p.click('[data-act="tg.opt"][data-k="parents"]'); await p.waitForFunction(() => Blogger.sim.s.tg.ch.adTask, null, { timeout: 20000 });
  await p.evaluate(() => { Blogger.phone.apps.tg.stack = [{ v: 'chats' }, { v: 'chat', id: 'mych' }]; Blogger.phone.render(true); });
  await p.click('[data-act="tg.adWrite"]');
  await p.fill('[data-adt]', 'Гарантовано на 100%!'); assert.match(await p.locator('[data-chk]').innerText(), /Немає позначки[\s\S]*Перебільшення/);
  await p.fill('[data-adt]', 'Мурчик спробував новий корм — їсть із задоволенням. Якщо шукаєте корм для кота, зверніть увагу.'); await p.click('[data-mark]');
  assert.match(await p.locator('[data-chk]').innerText(), /Позначено як рекламу/);
  await p.click('[data-pub]'); assert.match(await p.locator('.tg-adl').last().innerText(), /Реклама/);
  const m0 = (await S()).money; await adv(1440 + 30);
  assert.ok((await S()).money > m0, 'оплата прийшла');
  await p.click('[data-act="tg.go"][data-v="stats"]'); assert.match(await p.locator('.tg-earn').innerText(), /Зароблено на рекламі[\s\S]*грн/);
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

await step('збереження у файл: ZIP із грою й власними фото та відео, відкриття в іншому браузері', async () => {
  const fs = await import('node:fs');
  const { readZip } = await import('../emulators/bloggeremu/js/zip.js');
  await home(); await p.click('[data-app="settings"]');
  await p.click('[data-act="ph.saveFile"]');
  await p.waitForSelector('.sheet.student');
  await p.fill('[data-st="name"]', 'Олена Коваль'); await p.fill('[data-st="group"]', '7-А');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-st-ok]')]);
  assert.match(dl.suggestedFilename(), /^blogger_kotyk-art_Olena-Koval_den-\d+\.zip$/);
  const path = await dl.path(), zip = await readZip(new Blob([fs.readFileSync(path)]));
  const game = JSON.parse(await zip.get('game.json').text()), cur = await S();
  assert.equal(game.app, 'edvault-blogger');
  assert.deepEqual(game.state, cur, 'у файлі повний стан гри');
  assert.equal(game.summary['Учень'], 'Олена Коваль'); assert.equal(game.summary['Клас або група'], '7-А');
  const mids = cur.gallery.filter(g => g.own).map(g => g.mid);
  assert.equal(Object.keys(game.media).length, mids.length, 'усі власні файли в архіві');
  for (const mid of mids) { const m = game.media[mid]; assert.ok(zip.get(m.blob.path) && (await (await zip.get(m.blob.path).blob()).size) > 1000, `файл ${m.blob.path}`); }
  assert.ok([...zip.keys()].some(k => /original\.webm$/.test(k)), 'відео теж збережено'); assert.ok(zip.get('README.txt'));
  assert.match(await p.locator('.pn-file').innerText(), /Олена Коваль[\s\S]*Збережено у файл: день/);
  // інший браузер: порожній телефон → відкрити файл
  const q = await newPage(await browser.newContext({ viewport: { width: 1366, height: 860 } }), errors);
  await q.goto(server.url + '/emulators/blogger'); await q.waitForFunction(() => window.Blogger); await q.click('[data-speed="0"]');
  const [fc] = await Promise.all([q.waitForEvent('filechooser'), q.click('[data-pf="open"]')]);
  await fc.setFiles(path);
  await q.waitForSelector('.sheet.file-open');
  assert.match(await q.locator('.sheet.file-open').innerText(), /Олена Коваль[\s\S]*@kotyk\.art[\s\S]*Файл цілий/);
  await q.click('.sheet.file-open [data-f="open"]');
  await q.waitForFunction(() => Blogger.sim.s.me?.nick === 'kotyk.art');
  const back = await q.evaluate(() => JSON.parse(JSON.stringify(Blogger.sim.s)));
  assert.deepEqual(back, cur, 'гра відновилась повністю');
  await q.evaluate(() => Blogger.phone.open('gallery', { f: 'own' }));
  await q.waitForFunction(n => { const i = document.querySelectorAll('.pg .art.own img'); return i.length === n && [...i].every(x => x.complete && x.naturalWidth > 0); }, mids.length);
  assert.equal(await q.evaluate(() => JSON.parse(localStorage.getItem('edvault-blogger')).s.me.nick), 'kotyk.art', 'і збереглась у браузері');
  // файл, змінений вручну, — попередження
  const forged = { ...game, state: { ...game.state, followers: 999999 } }, fpath = path + '-forged.json';
  fs.writeFileSync(fpath, JSON.stringify(forged));
  const [fc2] = await Promise.all([q.waitForEvent('filechooser'), q.click('[data-pf="open"]')]);
  await fc2.setFiles(fpath);
  await q.waitForSelector('.sheet.file-open');
  assert.match(await q.locator('.sheet.file-open').innerText(), /змінювали вручну/);
  await q.click('.sheet.file-open [data-sh-close]');
  // збереження іншого симулятора — зрозуміла помилка
  const other = path + '-startup.json'; fs.writeFileSync(other, JSON.stringify({ app: 'edvault-startup', format: 1, state: {} }));
  const [fc3] = await Promise.all([q.waitForEvent('filechooser'), q.click('[data-pf="open"]')]);
  await fc3.setFiles(other);
  await q.waitForFunction(() => /симулятора стартапу/.test(document.querySelector('.toast')?.textContent || ''));
  assert.equal(await q.evaluate(() => Blogger.sim.s.followers), cur.followers);
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
