// Браузерна перевірка «Файли й папки» (потрібні Playwright і Chromium).
//   node tests/files-e2e.mjs
import assert from 'node:assert/strict';
import { startServer, launch, newPage, step } from './_harness.mjs';

const server = await startServer();
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, acceptDownloads: true });
const p = await newPage(ctx, errors);
await p.goto(server.url + '/tools/files-trainer.html');
await p.waitForFunction(() => window.FilesTrainer);

const open = i => p.evaluate(i => { const T = window.FilesTrainer; T.LEVELS.slice(0, i).forEach(L => { T.progress.best[L.id] ||= { stars: 1, steps: 99 }; }); T.openLevel(i); }, i);
const rx = s => new RegExp('^' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
const item = name => p.locator('#main .it').filter({ has: p.locator('.nm', { hasText: rx(name) }) });
const tree = name => p.locator('#tree .tn').filter({ has: p.locator('span', { hasText: rx(name) }) }).first();
const steps = () => p.evaluate(() => window.FilesTrainer.session.steps);
const waitResult = () => p.waitForSelector('#result:not([hidden])', { timeout: 5000 });
const litStars = () => p.locator('#resStars svg.on').count();

await step('головна: 6 розділів по 4 рівні, відкритий лише перший', async () => {
  assert.equal(await p.locator('.chapter').count(), 6);
  assert.equal(await p.locator('.lvl').count(), 24);
  assert.equal(await p.locator('.lvl:not([disabled])').count(), 1);
});

await step('подорож: подвійне клацання по папках, файл відкривається в переглядачі', async () => {
  await p.click('#continueBtn');
  assert.equal(await p.locator('#main .it').count(), 6, 'шість системних папок');
  await item('Документи').dblclick();
  await item('Казки').dblclick();
  assert.match(await p.textContent('#addr'), /Цей комп’ютер.*Документи.*Казки/);
  await item('Колобок.txt').dblclick();
  assert.equal(await p.isVisible('#viewer'), true);
  await waitResult();
  assert.equal(await litStars(), 3);
});

await step('розширення: зайвий відкритий файл — більше кроків; адреса й «назад»', async () => {
  await open(3);
  await tree('Документи').click();
  await item('Про котів').dblclick();
  await item('кіт.docx').dblclick(); await p.keyboard.press('Escape');
  await p.locator('#addr .crumb', { hasText: 'Документи' }).click();
  assert.equal(await p.locator('#main .it').count(), 1);
  await p.click('#navBack');
  assert.match(await p.textContent('#addr'), /Про котів/);
  await item('кіт.jpg').dblclick(); await p.keyboard.press('Escape');
  assert.equal(await p.isVisible('#viewer'), false, 'переглядач закрито');
  await item('кіт.mp3').dblclick();
  await waitResult();
  assert.equal(await steps(), 3);
  assert.equal(await litStars(), 2);
});

await step('нова папка: Ctrl+Shift+N, заборонений символ, потім гарне ім’я', async () => {
  await open(4);
  await tree('Документи').click();
  await p.keyboard.press('Control+Shift+N');
  await p.waitForSelector('#ren');
  await p.fill('#ren', 'Шко/ла'); await p.press('#ren', 'Enter');
  assert.match(await p.textContent('#toast'), /символи/);
  assert.equal(await p.locator('#ren').count(), 1, 'поле лишилося');
  await p.fill('#ren', 'Школа'); await p.press('#ren', 'Enter');
  await waitResult();
  assert.equal(await steps(), 1);
});

await step('перейменування F2: розширення лишається, зміна розширення питає дозволу', async () => {
  await open(5);
  await tree('Зображення').click();
  await item('IMG_2041.jpg').dblclick();
  assert.equal(await p.locator('#viewer .v-art').count(), 1, 'видно фото');
  await p.keyboard.press('Escape');
  await item('IMG_2041.jpg').click();
  await p.keyboard.press('F2');
  await p.keyboard.type('море'); // виділено лише ім’я без .jpg
  await p.keyboard.press('Enter');
  assert.equal(await item('море.jpg').count(), 1);
  await item('IMG_2042.jpg').click({ button: 'right' });
  await p.click('.ctx-item[data-c="rename"]');
  await p.fill('#ren', 'гори.png'); await p.press('#ren', 'Enter');
  await p.waitForSelector('#confirm:not([hidden])');
  await p.click('#confirmNo');
  assert.equal(await p.locator('#ren').count(), 1);
  await p.fill('#ren', 'гори.jpg'); await p.press('#ren', 'Enter');
  await waitResult();
  assert.equal(await steps(), 3);
  assert.equal(await litStars(), 3);
});

await step('кілька за раз: рамка виділяє чотири фото, перетягування на папку', async () => {
  await open(9);
  await tree('Робочий стіл').click();
  const m = await p.locator('#main').boundingBox(), last = await item('пляж.jpg').boundingBox();
  await p.mouse.move(m.x + 4, m.y + 4); await p.mouse.down();
  await p.mouse.move(last.x + last.width / 2, last.y + last.height / 2, { steps: 6 }); await p.mouse.up();
  assert.equal(await p.locator('#main .it.sel').count(), 4);
  await item('ліс.jpg').dragTo(tree('Зображення'));
  await waitResult();
  assert.equal(await steps(), 1);
});

await step('Ctrl+Z повертає переміщення', async () => {
  await open(8);
  await tree('Робочий стіл').click();
  await item('реферат.docx').dragTo(tree('Музика'));
  assert.equal(await p.locator('#main .it').count(), 0);
  await p.keyboard.press('Control+z');
  assert.equal(await p.locator('#main .it').count(), 1);
});

await step('вирізати й вставити клавішами', async () => {
  await open(10);
  await tree('Завантаження').click();
  await item('розклад уроків.pdf').click();
  await p.keyboard.press('Control+x');
  assert.equal(await item('розклад уроків.pdf').locator('xpath=.').evaluate(e => e.classList.contains('cut')), true);
  await tree('Документи').click();
  await item('Школа').dblclick(); await item('5 клас').dblclick();
  await p.keyboard.press('Control+v');
  await waitResult();
});

await step('копія через контекстне меню', async () => {
  await open(11);
  await tree('Документи').click();
  await item('презентація про космос.pptx').click({ button: 'right' });
  await p.click('.ctx-item[data-c="copy"]');
  await tree('Завантаження').click();
  await item('Для Олі').dblclick();
  await p.locator('#main').click({ button: 'right', position: { x: 300, y: 300 } });
  await p.click('.ctx-item[data-c="paste"]');
  await waitResult();
  assert.equal(await steps(), 1);
});

await step('кошик: відновити, видалити, очистити з підтвердженням', async () => {
  await open(14);
  await p.click('#tree .tn.bin');
  assert.equal(await p.locator('#main .it').count(), 3);
  await item('мама.jpg').click();
  await p.click('[data-cmd="restore"]');
  await tree('Завантаження').click();
  await item('спам.zip').click();
  await p.keyboard.press('Delete');
  await p.click('#tree .tn.bin');
  await p.click('[data-cmd="emptyBin"]');
  await p.waitForSelector('#confirm:not([hidden])');
  await p.click('#confirmYes');
  await waitResult();
  assert.equal(await steps(), 3);
});

await step('пошук «*.mp3» по всьому комп’ютеру, Ctrl+A і перетягування в «Музику»', async () => {
  await open(17);
  await p.fill('#search', '*.mp3');
  assert.equal(await p.locator('#main .it').count(), 5);
  assert.match(await p.textContent('#addr'), /Результати пошуку/);
  await p.locator('#main').click({ position: { x: 500, y: 400 } });
  await p.keyboard.press('Control+a');
  await item('гімн.mp3').dragTo(tree('Музика'));
  await waitResult();
  assert.equal(await steps(), 1);
});

await step('таблиця: сортування за розміром і видалення найбільшого', async () => {
  await open(19);
  await tree('Відео').click();
  await p.click('[data-view="details"]');
  await p.click('[data-sort="size"]');
  const first = p.locator('#main .it').first();
  assert.equal(await first.locator('.nm').textContent(), 'день народження.mp4');
  await first.click();
  await p.click('[data-cmd="del"]');
  await waitResult();
  await p.click('[data-view="icons"]').catch(() => {});
});

await step('прогрес зберігається після перезавантаження', async () => {
  await p.goto(server.url + '/tools/files-trainer.html'); await p.waitForFunction(() => window.FilesTrainer);
  assert.equal(await p.evaluate(() => window.FilesTrainer.progress.best['nav-1'].stars), 3);
  assert.equal(await p.evaluate(() => window.FilesTrainer.progress.best['nav-4'].steps), 3);
});

await step('результати: без імені не завантажуються, з ім’ям — картинка', async () => {
  await p.click('#reportBtn');
  await p.click('#downloadReport');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'studentName');
  await p.fill('#studentName', 'Test Student');
  const dl = p.waitForEvent('download');
  await p.click('#downloadReport');
  assert.equal((await dl).suggestedFilename(), 'files-test-student.png');
  await p.keyboard.press('Escape');
});

await step('жодної помилки в консолі сторінки', async () => assert.deepEqual(errors, []));

await browser.close();
server.close();
