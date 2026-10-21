// Емулятор Windows на телефоні: повідомлення, яке не закривається; на планшеті й комп’ютері — працює.
import assert from 'node:assert/strict';
import { startServer, launch, step } from './_harness.mjs';
const srv = await startServer(), b = await launch();
const errs = [];
const open = async (vp, extra = {}) => { const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, ...extra }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); const reqs = []; p.on('request', r => reqs.push(r.url())); await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort()); await p.goto(srv.url + '/emulators/windows'); await p.waitForTimeout(800); return { p, reqs }; };
await step('телефон вертикально: повідомлення, емулятор не завантажується', async () => {
  const { p, reqs } = await open({ width: 390, height: 844 }, { isMobile: true, hasTouch: true });
  assert.ok(await p.isVisible('#smallScreen'));
  assert.ok(!reqs.some(u => u.includes('windowsemu/js/main.js')), 'main.js не завантажувався');
  assert.equal(await p.evaluate(() => !!window.WinEmu), false);
  await p.keyboard.press('Escape'); await p.mouse.click(10, 10); await p.touchscreen.tap(20, 20);
  assert.ok(await p.isVisible('#smallScreen'), 'не закривається');
  
});
await step('телефон горизонтально: те саме', async () => {
  const { p } = await open({ width: 844, height: 390 }, { isMobile: true, hasTouch: true });
  assert.ok(await p.isVisible('#smallScreen')); 
});
await step('планшет 768×1024 і 1024×768 (дотик): емулятор працює', async () => {
  for (const vp of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
    const { p } = await open(vp, { hasTouch: true, isMobile: true });
    assert.ok(!(await p.isVisible('#smallScreen')), JSON.stringify(vp));
    await p.waitForFunction(() => !!window.WinEmu, null, { timeout: 10000 });
  }
});
await step('комп’ютер: звузили вікно — повідомлення, розширили — емулятор працює далі', async () => {
  const { p } = await open({ width: 1280, height: 800 });
  await p.waitForFunction(() => !!window.WinEmu);
  await p.setViewportSize({ width: 500, height: 800 }); await p.waitForTimeout(200);
  assert.ok(await p.isVisible('#smallScreen'));
  assert.equal(await p.evaluate(() => document.querySelector('#desk')?.closest('[inert]') ? 1 : 0), 1, 'емулятор недоступний під повідомленням');
  await p.setViewportSize({ width: 1280, height: 800 }); await p.waitForTimeout(200);
  assert.ok(!(await p.isVisible('#smallScreen'))); assert.equal(await p.evaluate(() => document.querySelector('#desk').closest('[inert]') ? 1 : 0), 0);
  // низьке, але широке вікно ноутбука — працює (миша, не дотик)
  await p.setViewportSize({ width: 1280, height: 560 }); await p.waitForTimeout(200);
  assert.ok(!(await p.isVisible('#smallScreen')), 'ноутбук з низьким вікном не блокується');
});
await step('без помилок', async () => assert.deepEqual(errs, []));
await b.close(); srv.close();
