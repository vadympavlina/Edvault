// Емулятор Windows: консоль відкриває браузер, Диспетчер завдань і Параметри; tasklist/taskkill бачать системні процеси.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { FS } from '../emulators/windowsemu/js/fs.js';
import { Cmd } from '../emulators/windowsemu/js/cmd.js';
import { SYS_PROCS, procState } from '../emulators/windowsemu/js/procs.js';

function setup() {
  const opened = [], st = procState();
  const host = {
    live: false, open: (a, p) => opened.push([a, p ?? null]),
    procs: () => SYS_PROCS.filter(p => !st.killed.has(p.pid)).map(p => ({ name: p.name, pid: p.pid, mem: p.mem })),
    critical: by => SYS_PROCS.some(p => p.critical && (by.pid ? p.pid === by.pid : p.name.toLowerCase() === by.im)),
    kill: by => { const l = SYS_PROCS.filter(p => !p.critical && (by.pid ? p.pid === by.pid : p.name.toLowerCase() === by.im)); l.forEach(p => st.killed.add(p.pid)); return l.map(p => ({ name: p.name, pid: p.pid })); },
  };
  return { cmd: new Cmd(new FS(), host), opened, st };
}
const run = (c, l) => c.run(l).out.join('\n');

test('браузер, Диспетчер завдань і Параметри відкриваються з консолі', () => {
  const { cmd, opened } = setup();
  run(cmd, 'start https://poshuk.edvault'); run(cmd, 'browser 192.168.1.1'); run(cmd, 'msedge'); run(cmd, 'taskmgr'); run(cmd, 'start ms-settings:'); run(cmd, 'ms-settings:');
  assert.deepEqual(opened, [['browser', 'https://poshuk.edvault'], ['browser', '192.168.1.1'], ['browser', null], ['taskmgr', null], ['settings', null], ['settings', null]]);
  assert.match(run(cmd, 'help taskmgr'), /Диспетчер завдань/);
});

test('tasklist показує системні процеси, taskkill не чіпає критичні', () => {
  const { cmd, st } = setup();
  assert.match(run(cmd, 'tasklist'), /csrss\.exe[\s\S]*svchost\.exe[\s\S]*OneDrive\.exe/);
  assert.match(run(cmd, 'taskkill /im csrss.exe'), /потрібен системі/);
  assert.match(run(cmd, 'taskkill /im onedrive.exe'), /УСПІХ/);
  assert.ok(st.killed.has(5032));
  assert.doesNotMatch(run(cmd, 'tasklist'), /OneDrive/);
  assert.match(run(cmd, 'taskkill /im nema.exe'), /не знайдено/);
});
