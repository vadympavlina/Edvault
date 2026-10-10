// Емулятор Windows · «Захист від вірусів і загроз» (антивірус Microsoft Defender) у «Безпеці Windows».
// Навчальний: нічого не лікує по-справжньому, але знаходить «загрози» у файлах за простими ознаками,
// має швидку / повну / вибіркову / автономну перевірку, захист у реальному часі, карантин, журнал, винятки.
import { HOME, isText, parentPath, nameOfPath, fmtDate, fmtTime, isInside, KNOWN } from './fs.js';
import { ui } from './icons.js';
import { esc, modal, dialog, alertBox } from './ui.js';

const lc = s => String(s).toLocaleLowerCase('uk');
const DL = HOME + '\\Downloads';
export const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
// База «загроз»: як знайти й що вони роблять (простими словами)
export const THREATS = [
  { id: 'eicar', name: 'Virus:DOS/EICAR_Test_File', level: 'Серйозна', cat: 'Вірус', test: n => isText(n) && n.content.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'),
    what: 'Це не справжній вірус, а стандартний тестовий файл EICAR. Його спеціально створили, щоб перевіряти, чи працює антивірус. Будь-який антивірус має його знайти.' },
  { id: 'wacatac', name: 'Trojan:Win32/Wacatac.B!ml', level: 'Серйозна', cat: 'Троян', test: n => /\.(exe|scr)$/i.test(n.name) && /free|crack|keygen|hack|cheat|чит/i.test(n.name),
    what: 'Троянська програма: вдає безкоштовну гру або «чит», а насправді краде паролі й дані з браузера та може встановити інші шкідливі програми.' },
  { id: 'masq', name: 'Trojan:Win32/Masquerade.A', level: 'Висока', cat: 'Троян', test: n => /\.(jpe?g|png|gif|txt|docx?|pdf|mp3|mp4)\.(exe|scr|bat|cmd|com)$/i.test(n.name),
    what: 'Файл маскується під фото чи документ: справжнє розширення — .exe, а «.jpg» лише частина назви. Якщо приховано розширення файлів, видно тільки «картинку». Відкриєте — запуститься програма.' },
  { id: 'autorun', name: 'Worm:Win32/Autorun.gen', level: 'Висока', cat: 'Хробак', test: n => lc(n.name) === 'autorun.inf',
    what: 'Хробак, що поширюється через флешки: файл autorun.inf намагається сам запустити шкідливу програму, щойно флешку вставлять у комп’ютер.' },
  { id: 'fakeinst', name: 'Trojan:Win32/FakeInstaller', level: 'Висока', cat: 'Троян', test: (n, p) => lc(n.name) === 'setup.exe' && isInside(p, DL),
    what: 'Підробний інсталятор із незнайомого сайту: обіцяє встановити програму, а натомість показує рекламу й додає шкідливі програми в автозавантаження.' },
  { id: 'batkill', name: 'Trojan:BAT/Killfiles', level: 'Висока', cat: 'Троян', test: n => /\.(bat|cmd)$/i.test(n.name) && isText(n) && /(del|erase|rd|rmdir)\s+.*\/[sq]|format\s+[a-z]:/i.test(n.content),
    what: 'Пакетний файл, який видаляє файли (команди del /s, rd /s) або форматує диск. Запускати такі файли з незнайомих джерел дуже небезпечно.' },
  { id: 'pua', name: 'PUA:Win32/Bundler', level: 'Низька', cat: 'Потенційно небажана програма', test: (n, p) => lc(n.name) === 'архів.zip' && isInside(p, DL),
    what: 'Не вірус, але «небажана програма»: в архіві разом із потрібним файлом лежать рекламні програми й панелі для браузера, які ставляться без вашої згоди.' },
];
const LEVEL_CLS = { 'Серйозна': 'sev', 'Висока': 'high', 'Середня': 'mid', 'Низька': 'low' };

export function avOf(fs) {
  return fs.s.av ||= { rt: true, cloud: true, samples: true, tamper: true, cfa: false, excl: [], allowed: [], quarantine: [], history: [], pending: [], last: null, sig: '1.419.212.0', sigAt: Date.UTC(2026, 9, 9, 6, 12), seq: 1 };
}
const now = () => Date.now();
const fmt = t => `${fmtDate(t)} ${fmtTime(t)}`;
export const detect = (n, p) => n.type === 'file' ? THREATS.find(t => t.test(n, p)) || null : null;
const excluded = (av, p) => av.excl.some(x => x.type === 'ext' ? lc(p).endsWith('.' + lc(x.v).replace(/^\./, '')) : lc(p) === lc(x.v) || isInside(p, x.v));
const allowedTh = (av, t, p) => av.allowed.some(a => a.threat === t.name && lc(a.path) === lc(p));
// стан для значка в треї й плитки: чи потрібні дії
export function avStatus(fs) { const av = avOf(fs); return { bad: !av.rt || av.pending.length > 0, pending: av.pending.length, rt: av.rt }; }

// усі файли в області перевірки
function filesIn(fs, roots) {
  const out = [];
  const walk = (d, node) => { for (const c of node.children || []) { const p = d.replace(/\\$/, '') + '\\' + c.name; if (c.type === 'dir') walk(p, c); else out.push([p, c]); } };
  for (const r of roots) { const n = fs.node(r); if (n?.type === 'dir') walk(fs.real(r), n); else if (n) out.push([fs.real(r), n]); }
  return out;
}
const scopeRoots = (fs, type, custom) => type === 'quick' ? [HOME + '\\Desktop', DL, HOME + '\\Documents', 'C:\\Windows\\System32'] : type === 'custom' ? [custom] : fs.drives().map(d => d + ':\\');

/* ═════════ Перевірка (одна на весь ПК; триває, навіть якщо закрити вікно) ═════════ */
export let SCAN = null;
const SCAN_TIME = { quick: 7000, full: 16000, custom: 5000, offline: 9000 };
const SCAN_NAME = { quick: 'Швидка перевірка', full: 'Повна перевірка', custom: 'Вибіркова перевірка', offline: 'Перевірка Microsoft Defender Offline' };
const FAKE_FILES = { quick: 31842, full: 412907, custom: 0, offline: 389211 };
export function startScan(sys, type, custom) {
  if (SCAN) return;
  const fs = sys.fs, av = avOf(fs), roots = scopeRoots(fs, type, custom), files = filesIn(fs, roots);
  const total = type === 'custom' ? files.length : FAKE_FILES[type] + files.length;
  SCAN = { type, custom, files, total, done: 0, t0: now(), cur: files[0]?.[0] || 'C:\\', found: [] };
  const dur = SCAN_TIME[type] * (type === 'custom' ? Math.min(1.6, 0.4 + files.length / 30) : 1);
  const tick = () => {
    if (!SCAN) return;
    const k = Math.min(1, (now() - SCAN.t0) / dur);
    SCAN.done = Math.round(total * k);
    const i = Math.min(files.length - 1, Math.floor(files.length * k));
    if (files[i]) SCAN.cur = files[i][0];
    if (k >= 1) return finish();
    fs.emit('avscan'); SCAN.tm = setTimeout(tick, 120);
  };
  const finish = () => {
    const found = [];
    for (const [p, n] of filesIn(fs, roots)) { const t = detect(n, p); if (t && !excluded(av, p) && !allowedTh(av, t, p)) found.push({ id: av.seq++, threat: t.id, name: t.name, level: t.level, path: p, at: now(), action: t.level === 'Низька' ? 'allow' : 'quarantine' }); }
    for (const f of found) if (!av.pending.some(x => x.path === f.path && x.name === f.name)) av.pending.push(f);
    av.last = { type, at: now(), files: total, found: found.length, secs: Math.round((now() - SCAN.t0) / 1000), custom };
    av.history.unshift({ id: av.seq++, kind: 'scan', at: now(), text: `${SCAN_NAME[type]}: перевірено файлів — ${total.toLocaleString('uk-UA')}, знайдено загроз — ${found.length}.`, found: found.length });
    SCAN = null;
    fs.emit('av');
    sys.toast(found.length ? `Безпека Windows: знайдено загроз — ${found.length}. Потрібні дії.` : `Безпека Windows: ${SCAN_NAME[type].toLowerCase()} завершена, загроз не знайдено.`);
  };
  fs.emit('avscan'); tick();
}
export function cancelScan(fs) { if (!SCAN) return; clearTimeout(SCAN.tm); SCAN = null; fs.emit('avscan'); }

/* ═════════ Дії із загрозами ═════════ */
function removeNode(fs, p) { const parent = fs.node(parentPath(p)), n = fs.node(p); if (!parent || !n) return null; parent.children = parent.children.filter(c => c !== n); return n; }
export function quarantine(fs, f, auto) {
  const av = avOf(fs), n = removeNode(fs, f.path); if (!n) return false;
  av.quarantine.unshift({ id: av.seq++, name: f.name, level: f.level, threat: f.threat, path: f.path, node: n, at: now() });
  av.history.unshift({ id: av.seq++, kind: 'quarantine', at: now(), name: f.name, level: f.level, threat: f.threat, path: f.path, auto: !!auto });
  return true;
}
function act(fs, f) {
  const av = avOf(fs);
  if (f.action === 'remove') { if (removeNode(fs, f.path)) av.history.unshift({ id: av.seq++, kind: 'removed', at: now(), name: f.name, level: f.level, threat: f.threat, path: f.path }); }
  else if (f.action === 'allow') { av.allowed.push({ threat: f.name, path: f.path, level: f.level, at: now() }); av.history.unshift({ id: av.seq++, kind: 'allowed', at: now(), name: f.name, level: f.level, threat: f.threat, path: f.path }); }
  else quarantine(fs, f);
  av.pending = av.pending.filter(x => x !== f);
}

/* ═════════ Захист у реальному часі ═════════ */
// перевіряються лише нові файли (завантажені, створені, скопійовані) — як у справжньому антивірусі «під час доступу»
export function installRealtime(sys) {
  const fs = sys.fs; let known = new Map();
  const files = () => filesIn(fs, fs.drives().map(d => d + ':\\'));
  const baseline = () => { known = new Map(files().map(([p, n]) => [n.id, detect(n, p)?.name || ''])); };
  baseline();
  fs.on(w => {
    if (w === 'reset') return baseline();
    if (!['write', 'copy', 'move', 'restore', 'syswrite', 'rename', 'mkdir'].includes(w)) return;
    const av = avOf(fs), hits = [];
    for (const [p, n] of files()) {
      const t = detect(n, p), prev = known.get(n.id);
      known.set(n.id, t?.name || '');
      // новий файл або файл, що щойно «став» загрозою (перейменували в .exe, дописали код)
      if (!t || (prev !== undefined && prev !== '') || excluded(av, p) || allowedTh(av, t, p)) continue;
      hits.push({ threat: t.id, name: t.name, level: t.level, path: p });
    }
    if (!hits.length || !av.rt) return;
    setTimeout(() => {
      let q = 0; for (const h of hits) if (quarantine(fs, h, true)) q++;
      if (!q) return;
      fs.emit('av');
      sys.toast(`Безпека Windows: знайдено загрозу ${hits[0].name}. Файл «${nameOfPath(hits[0].path)}»${q > 1 ? ` і ще ${q - 1}` : ''} поміщено в карантин.`);
    }, 350);
  });
}
export function avScanUpdate(app) { const b = app.$('.av-scan'); if (b && SCAN) { b.innerHTML = scanBox(SCAN); return true; } return false; }

/* ═════════ Сторінки ═════════ */
const sev = l => `<span class="av-lv ${LEVEL_CLS[l]}">${l}</span>`;
const back = (t = 'Захист від вірусів і загроз', to = 'virus') => `<button class="sec-backlink" data-go="${to}">${ui('back', 14)}${t}</button>`;
const sw = (k, on, t, sub) => `<div class="av-sw"><b>${t}</b><p class="muted">${sub}</p><label class="sw-row"><span class="toggle${on ? ' on' : ''}" data-avsw="${k}" role="switch" aria-checked="${on}"><i></i></span><b>${on ? 'Увімкнуто' : 'Вимкнуто'}</b></label></div>`;
export function avRender(app, p) {
  const fs = app.fs, av = avOf(fs), S = SCAN;
  if (p === 'virus') {
    const last = av.last;
    const status = S ? `<div class="av-scan">${scanBox(S)}</div>`
      : av.pending.length ? `<div class="av-threats"><p class="av-bad">${ui('warn', 18)}<b>Знайдено загрози. Почніть рекомендовані дії.</b></p>${threatList(av)}<div class="av-acts"><button class="btn primary" data-avstart>Почати дії</button><button class="link" data-go="virus-history">Журнал захисту</button></div></div>`
      : `<div class="av-ok">${ui('check', 20)}<div><b>Немає поточних загроз.</b><small>${last ? `Остання перевірка: ${fmt(last.at)} (${SCAN_NAME[last.type].toLowerCase()})<br>Знайдено загроз: ${last.found}<br>Тривалість перевірки: ${Math.floor(last.secs / 60)} хв ${last.secs % 60} с<br>Перевірено файлів: ${last.files.toLocaleString('uk-UA')}` : 'Перевірок ще не було. Запустіть швидку перевірку.'}</small></div></div>`;
    return `<div class="sec-h">${ui('virus', 34)}<div><h1>Захист від вірусів і загроз</h1><p class="lead">Захист пристрою від загроз.</p></div></div>
      <h3>${ui('history', 18)} Поточні загрози</h3>${status}
      ${S ? '' : `<div class="av-acts"><button class="btn" data-avscan="quick" ${S ? 'disabled' : ''}>Швидка перевірка</button><span class="grow"></span></div><div class="sec-links"><button class="link" data-go="virus-options">Параметри перевірки</button><button class="link" data-go="virus-allowed">Дозволені загрози</button><button class="link" data-go="virus-history">Журнал захисту</button></div>`}
      <h3>${ui('gear', 18)} Параметри захисту від вірусів і загроз</h3><p class="${av.rt ? 'muted' : 'av-bad'}">${av.rt ? 'Дії не потрібні.' : `${ui('warn', 16)} Захист у реальному часі вимкнено. Пристрій може бути вразливим.`}</p>${av.rt ? '' : '<button class="btn primary" data-avrt>Увімкнути</button>'}<div class="sec-links"><button class="link" data-go="virus-settings">Керування параметрами</button></div>
      <h3>${ui('refresh', 18)} Оновлення захисту від вірусів і загроз</h3><p class="muted">Версія аналізу безпеки: ${av.sig}<br>Останнє оновлення: ${fmt(av.sigAt)}</p><div class="sec-links"><button class="link" data-go="virus-updates">Оновлення захисту</button></div>
      <h3>${ui('folderPlus', 18)} Захист від програм-шантажистів</h3><p class="muted">Контрольований доступ до папок: ${av.cfa ? 'увімкнуто' : 'вимкнуто'}.</p><div class="sec-links"><button class="link" data-go="virus-ransom">Керування захистом від програм-шантажистів</button></div>
      <aside class="sec-aside"><h4>Як це працює?</h4><p>Антивірус порівнює файли з базою відомих загроз (сигнатур) і стежить за підозрілою поведінкою. <b>Швидка перевірка</b> дивиться лише туди, де віруси бувають найчастіше, <b>повна</b> — на всі файли всіх дисків. У навчальному комп’ютері «загрози» лише показові: вони нічого не псують.</p></aside>`;
  }
  if (p === 'virus-options') {
    const opt = app.avOpt ||= 'quick';
    const R = (k, t, s) => `<label class="av-opt"><input type="radio" name="avopt" value="${k}" ${opt === k ? 'checked' : ''}><span><b>${t}</b><small>${s}</small></span></label>`;
    return `${back()}<h1>Параметри перевірки</h1><p class="lead">Запустіть перевірку, яку потрібно виконати.</p>${S ? `<div class="av-scan">${scanBox(S)}</div>` : ''}
      <div class="av-opts">${R('quick', 'Швидка перевірка', 'Перевіряє папки в системі, де зазвичай знаходяться загрози: Робочий стіл, Завантаження, Документи й системні файли.')}${R('full', 'Повна перевірка', 'Перевіряє всі файли й програми на всіх дисках. Може тривати понад годину (тут — кілька секунд).')}
        ${R('custom', 'Вибіркова перевірка', 'Ви вибираєте, які файли й папки потрібно перевірити.')}${R('offline', 'Перевірка Microsoft Defender Offline', 'Деякі віруси важко видалити, поки Windows працює. Комп’ютер перезавантажиться й перевірить диски до запуску Windows.')}</div>
      <button class="btn primary" data-avrun ${S ? 'disabled' : ''}>Перевірити зараз</button>`;
  }
  if (p === 'virus-history') {
    const H = av.history.filter(h => h.kind !== 'scan' || app.avAll);
    return `${back()}<h1>Журнал захисту</h1><p class="lead">Останні дії й рекомендації Безпеки Windows.</p><label class="chk"><input type="checkbox" data-avall ${app.avAll ? 'checked' : ''}> Показувати й записи про перевірки</label>
      <div class="av-hist">${H.length ? H.map(h => histCard(av, h, app.avOpen === h.id)).join('') : '<p class="muted">Записів немає.</p>'}</div>`;
  }
  if (p === 'virus-allowed') {
    return `${back()}<h1>Дозволені загрози</h1><p class="lead">Загрози, які ви дозволили запускати на цьому пристрої. Антивірус їх більше не помічатиме.</p>
      ${av.allowed.length ? `<div class="av-list">${av.allowed.map((a, i) => `<div class="av-row">${sev(a.level)}<div><b>${esc(a.threat)}</b><small>${esc(a.path)}</small></div><button class="btn" data-avunallow="${i}">Не дозволяти</button></div>`).join('')}</div>` : '<p class="muted">Немає дозволених загроз.</p>'}`;
  }
  if (p === 'virus-settings') {
    return `${back()}<h1>Параметри захисту від вірусів і загроз</h1><p class="lead">Переглядайте й оновлюйте параметри захисту Microsoft Defender Antivirus.</p>
      ${sw('rt', av.rt, 'Захист у реальному часі', 'Знаходить шкідливі програми й не дає їм установитися чи запуститися на пристрої. Перевіряє кожен новий файл: завантажений, скопійований або створений.')}${av.rt ? '' : `<p class="warn-s">${ui('warn', 16)}Захист у реальному часі вимкнено. Завантажені файли зі шкідливим кодом не буде помічено, доки ви не запустите перевірку.</p>`}
      ${sw('cloud', av.cloud, 'Хмарний захист', 'Швидше захищає від нових загроз: відомості про підозрілі файли перевіряються в хмарі Microsoft.')}
      ${sw('samples', av.samples, 'Автоматичне надсилання зразків', 'Надсилає зразки підозрілих файлів у Microsoft, щоб допомогти захистити вас та інших.')}
      ${sw('tamper', av.tamper, 'Захист від втручання', 'Не дає шкідливим програмам вимкнути антивірус або змінити його параметри.')}
      <div class="av-sw"><b>Виключення</b><p class="muted">Файли й папки з виключень антивірус не перевіряє. Додавайте лише те, у чому впевнені!</p><div class="sec-links"><button class="link" data-go="virus-excl">Додати або видалити виключення</button></div></div>`;
  }
  if (p === 'virus-excl') {
    return `${back('Параметри захисту від вірусів і загроз', 'virus-settings')}<h1>Виключення</h1><p class="lead">Додайте або видаліть елементи, які не потрібно перевіряти антивірусом.</p>
      <p class="warn-s">${ui('warn', 16)}Виключення — це «дірка» в захисті: шкідлива програма в такій папці не буде знайдена.</p>
      <div class="av-acts"><button class="btn" data-avexadd>${ui('plus', 15)} Додати виключення</button></div>
      ${av.excl.length ? `<div class="av-list">${av.excl.map((x, i) => `<div class="av-row">${ui(x.type === 'dir' ? 'folderPlus' : x.type === 'ext' ? 'text' : 'file', 22)}<div><b>${esc(x.v)}</b><small>${{ dir: 'Папка', file: 'Файл', ext: 'Тип файлу' }[x.type]}</small></div><button class="btn" data-avexdel="${i}">Видалити</button></div>`).join('')}</div>` : '<p class="muted">Виключень немає.</p>'}`;
  }
  if (p === 'virus-updates') {
    return `${back()}<h1>Оновлення захисту</h1><p class="lead">Перегляньте відомості про версію аналізу безпеки й перевірте наявність оновлень.</p>
      <div class="av-ok">${ui('refresh', 20)}<div><b>Аналіз безпеки</b><small>Microsoft Defender Antivirus використовує аналіз безпеки, щоб знаходити загрози. Ми намагаємося автоматично завантажувати найновіший аналіз.<br>Версія аналізу безпеки: ${av.sig}<br>Остання перевірка наявності оновлень: ${fmt(av.sigAt)}</small></div></div>
      <div class="av-acts"><button class="btn" data-avupd>Перевірити наявність оновлень</button></div><p class="muted av-upd"></p>
      <aside class="sec-aside"><h4>Навіщо оновлювати?</h4><p>Щодня з’являються нові віруси. Оновлення додає в антивірус «прикмети» нових загроз. Без оновлень він не впізнає свіжі віруси.</p></aside>`;
  }
  if (p === 'virus-ransom') {
    return `${back()}<h1>Захист від програм-шантажистів</h1><p class="lead">Захистіть файли від загроз, як-от програм-шантажистів, і дізнайтеся, як відновити файли в разі атаки.</p>
      ${sw('cfa', av.cfa, 'Контрольований доступ до папок', 'Захищає файли й папки (Документи, Зображення, Робочий стіл) від несанкціонованих змін ненадійними програмами.')}
      <aside class="sec-aside"><h4>Хто такі шантажисти?</h4><p>Програма-шантажист (ransomware) шифрує ваші фото й документи, а потім вимагає гроші за «ключ». Найкращий захист — <b>резервні копії</b> на флешці чи в хмарі та обережність із незнайомими файлами.</p></aside>`;
  }
  return '';
}
function scanBox(S) {
  const pc = Math.min(100, Math.round(S.done / Math.max(1, S.total) * 100)), secs = Math.round((now() - S.t0) / 1000);
  return `<p><b>${SCAN_NAME[S.type]} триває…</b></p><div class="av-bar"><i style="width:${pc}%"></i></div><p class="muted">Приблизний час, що залишився: ${pc < 100 ? 'менше хвилини' : '—'}<br>Перевірено файлів: ${S.done.toLocaleString('uk-UA')}<br>Тривалість: 00:00:${String(secs).padStart(2, '0')}</p><p class="av-cur" title="${esc(S.cur)}">${esc(S.cur)}</p><button class="btn" data-avcancel>Скасувати</button>`;
}
function threatList(av) {
  return `<div class="av-list">${av.pending.map((f, i) => { const t = THREATS.find(x => x.id === f.threat);
    return `<div class="av-th"><div class="av-thh">${sev(f.level)}<div><b>${esc(f.name)}</b><small>${fmt(f.at)} · Активна</small></div><select class="inp" data-avact="${i}"><option value="quarantine" ${f.action === 'quarantine' ? 'selected' : ''}>Помістити в карантин</option><option value="remove" ${f.action === 'remove' ? 'selected' : ''}>Видалити</option><option value="allow" ${f.action === 'allow' ? 'selected' : ''}>Дозволити на пристрої</option></select></div>
      <p class="av-what">${esc(t?.what || '')}</p><p class="muted">Файл: <span class="av-path">${esc(f.path)}</span><br>Категорія: ${esc(t?.cat || '')}</p></div>`; }).join('')}</div>`;
}
const HIST_T = { quarantine: 'Загрозу поміщено в карантин', removed: 'Загрозу видалено', allowed: 'Загрозу дозволено', restored: 'Елемент відновлено з карантину', scan: 'Перевірку завершено' };
function histCard(av, h, open) {
  const t = THREATS.find(x => x.id === h.threat), q = h.kind === 'quarantine' ? av.quarantine.find(x => x.path === h.path && x.name === h.name) : null;
  return `<div class="av-hc${open ? ' open' : ''}"><button class="av-hh" data-avopen="${h.id}">${h.kind === 'scan' ? ui('search', 18) : ui(h.kind === 'allowed' ? 'warn' : 'shield', 18)}<div><b>${HIST_T[h.kind]}</b><small>${h.name ? esc(h.name) + ' · ' : ''}${fmt(h.at)}</small></div>${h.level ? sev(h.level) : ''}${ui(open ? 'up' : 'down', 15)}</button>
    ${open ? `<div class="av-hb">${h.kind === 'scan' ? `<p>${esc(h.text)}</p>` : `<p><b>Виявлено:</b> ${esc(h.name)}</p><p><b>Стан:</b> ${h.kind === 'quarantine' ? (q ? 'У карантині' : 'Видалено з карантину') : h.kind === 'removed' ? 'Видалено' : h.kind === 'allowed' ? 'Дозволено' : 'Відновлено'}</p>${h.auto ? '<p><b>Як виявлено:</b> захист у реальному часі (одразу після появи файлу)</p>' : ''}<p><b>Уражені елементи:</b> <span class="av-path">${esc(h.path)}</span></p><p class="av-what">${esc(t?.what || '')}</p>
      ${q ? `<div class="av-acts"><button class="btn" data-avrestore="${q.id}">Відновити</button><button class="btn" data-avqdel="${q.id}">Видалити</button></div>` : ''}`}</div>` : ''}</div>`;
}

/* ═════════ Події ═════════ */
export async function avClick(app, e, elevate) {
  const fs = app.fs, av = avOf(fs), sys = app.sys, t = e.target;
  const scan = t.closest('[data-avscan]'); if (scan) { startScan(sys, scan.dataset.avscan); return true; }
  if (t.closest('[data-avcancel]')) { cancelScan(fs); return true; }
  if (t.closest('[data-avrun]')) {
    const o = app.avOpt || 'quick';
    if (o === 'custom') { pickFolder(fs, p => { startScan(sys, 'custom', p); app.go('virus'); }); return true; }
    if (o === 'offline') { if (await dialog({ title: 'Безпека Windows', icon: 'warn', text: 'Комп’ютер буде перезавантажено, і перевірка триватиме кілька хвилин (тут — секунди). Збережіть свою роботу.', buttons: [{ t: 'Перевірити', v: true, primary: true }, { t: 'Скасувати', v: false, cancel: true }] })) offline(sys); return true; }
    startScan(sys, o); app.go('virus'); return true;
  }
  const opt = t.closest('input[name=avopt]'); if (opt) { app.avOpt = opt.value; return true; }
  const sel = t.closest('[data-avact]'); if (sel) return true;
  if (t.closest('[data-avstart]')) {
    app.$$('[data-avact]').forEach(s => { av.pending[+s.dataset.avact].action = s.value; });
    [...av.pending].forEach(f => act(fs, f));
    fs.emit('av'); sys.toast('Дії виконано'); return true;
  }
  if (t.closest('[data-avrt]')) { if (await elevate()) { av.rt = true; fs.emit('av'); } return true; }
  const s = t.closest('[data-avsw]');
  if (s) {
    const k = s.dataset.avsw;
    if (!(await elevate())) return true;
    if (k === 'rt' && av.rt && !(await dialog({ title: 'Безпека Windows', icon: 'warn', text: 'Вимкнути захист у реальному часі? Нові віруси не буде помічено, доки ви не запустите перевірку. Його варто вмикати знову якнайшвидше.', buttons: [{ t: 'Так', v: true }, { t: 'Ні', v: false, primary: true, cancel: true }] }))) return true;
    av[k] = !av[k]; av.history.unshift({ id: av.seq++, kind: 'scan', at: now(), text: `Параметр «${{ rt: 'Захист у реальному часі', cloud: 'Хмарний захист', samples: 'Автоматичне надсилання зразків', tamper: 'Захист від втручання', cfa: 'Контрольований доступ до папок' }[k]}» ${av[k] ? 'увімкнуто' : 'вимкнуто'}.` });
    fs.emit('av'); return true;
  }
  const op = t.closest('[data-avopen]'); if (op) { app.avOpen = app.avOpen === +op.dataset.avopen ? null : +op.dataset.avopen; app.render(); return true; }
  const all = t.closest('[data-avall]'); if (all) { app.avAll = all.checked; app.render(); return true; }
  const rs = t.closest('[data-avrestore]');
  if (rs) {
    if (!(await elevate())) return true;
    const i = av.quarantine.findIndex(x => x.id === +rs.dataset.avrestore), q = av.quarantine[i]; if (!q) return true;
    if (!(await dialog({ title: 'Відновити елемент', icon: 'warn', text: `Відновити «${nameOfPath(q.path)}»? Це загроза рівня «${q.level}». Антивірус дозволить її й більше не помічатиме.`, buttons: [{ t: 'Відновити', v: true }, { t: 'Скасувати', v: false, primary: true, cancel: true }] }))) return true;
    const dir = parentPath(q.path); if (!fs.isDir(dir)) fs.mkdir(dir);
    const parent = fs.node(dir); q.node.name = fs.freeName(parent, q.node.name); parent.children.push(q.node);
    av.quarantine.splice(i, 1); av.allowed.push({ threat: q.name, path: dir + '\\' + q.node.name, level: q.level, at: now() });
    av.history.unshift({ id: av.seq++, kind: 'restored', at: now(), name: q.name, level: q.level, threat: q.threat, path: q.path });
    fs.emit('av'); fs.emit('restore'); return true;
  }
  const qd = t.closest('[data-avqdel]'); if (qd) { av.quarantine = av.quarantine.filter(x => x.id !== +qd.dataset.avqdel); fs.emit('av'); sys.toast('Елемент остаточно видалено'); return true; }
  const ua = t.closest('[data-avunallow]'); if (ua) { av.allowed.splice(+ua.dataset.avunallow, 1); fs.emit('av'); return true; }
  const xd = t.closest('[data-avexdel]'); if (xd) { if (await elevate()) { av.excl.splice(+xd.dataset.avexdel, 1); fs.emit('av'); } return true; }
  if (t.closest('[data-avexadd]')) { if (await elevate()) addExclusion(fs); return true; }
  if (t.closest('[data-avupd]')) {
    const out = app.$('.av-upd'), b = t.closest('[data-avupd]'); b.disabled = true; out.innerHTML = `<i class="rt-spin"></i>Перевірка наявності оновлень…`;
    setTimeout(() => { if (!out.isConnected) return; const [a, b2, c, d] = av.sig.split('.').map(Number); av.sig = [a, b2, c + 1, d].join('.'); av.sigAt = now(); av.history.unshift({ id: av.seq++, kind: 'scan', at: now(), text: `Аналіз безпеки оновлено до версії ${av.sig}.` }); fs.emit('av'); sys.toast(`Аналіз безпеки оновлено: ${av.sig}`); }, 1800);
    return true;
  }
  return false;
}
function pickFolder(fs, done) {
  const opts = [['C:\\', 'Локальний диск (C:)'], ['D:\\', 'Навчання (D:)'], ...Object.entries(KNOWN).map(([k, v]) => [HOME + '\\' + k, v]), ...fs.list('D:\\').filter(n => n.type === 'dir').map(n => ['D:\\' + n.name, 'D:\\' + n.name])];
  modal({ title: 'Вибрати папку', cls: 'saveas', html: `<p>Виберіть папку для перевірки:</p><div class="pick-list">${opts.map(([p, t], i) => `<label class="pick"><input type="radio" name="avp" value="${esc(p)}" ${i ? '' : 'checked'}>${ui('folderPlus', 18)}<span><b>${esc(t)}</b><small>${esc(p)}</small></span></label>`).join('')}</div>`,
    buttons: [{ t: 'Вибрати папку', v: 'ok', primary: true }, { t: 'Скасувати', v: null, cancel: true }],
    onButton: (v, api) => { if (v === 'ok') done(api.$('input[name=avp]:checked').value); } });
}
function addExclusion(fs) {
  const av = avOf(fs);
  modal({ title: 'Додати виключення', cls: 'saveas', html: `<label class="fld">Тип: <select class="inp" data-xt><option value="dir">Папка</option><option value="file">Файл</option><option value="ext">Тип файлу</option></select></label><label class="fld">Шлях або розширення: <input class="inp" data-xv placeholder="наприклад D:\\Ігри або .exe" spellcheck="false"></label>`,
    buttons: [{ t: 'Додати', v: 'ok', primary: true }, { t: 'Скасувати', v: null, cancel: true }],
    onButton: (v, api) => {
      if (v !== 'ok') return;
      const type = api.$('[data-xt]').value, val = api.$('[data-xv]').value.trim();
      if (type === 'ext' ? !/^\.?[a-z0-9]{1,8}$/i.test(val) : !fs.node(val) || (type === 'dir') !== fs.isDir(val)) { alertBox(type === 'ext' ? 'Вкажіть розширення, наприклад .exe' : `Не знайдено ${type === 'dir' ? 'папку' : 'файл'} «${val}».`, 'Виключення', 'warn'); return false; }
      av.excl.push({ type, v: type === 'ext' ? val : fs.real(val) }); fs.emit('av');
    } });
}
// автономна перевірка: «перезавантаження» й перевірка до запуску Windows
function offline(sys) {
  const el = document.createElement('div'); el.id = 'avoffline';
  el.innerHTML = `<div><h1>Microsoft Defender Antivirus</h1><p>Триває перевірка комп’ютера до запуску Windows…</p><div class="av-bar"><i></i></div><p class="pc">0%</p></div>`;
  document.body.appendChild(el);
  sys.closeAll?.();
  startScan(sys, 'offline');
  const tm = setInterval(() => { const pc = SCAN ? Math.round(SCAN.done / SCAN.total * 100) : 100; el.querySelector('.av-bar i').style.width = pc + '%'; el.querySelector('.pc').textContent = pc + '%'; if (!SCAN) { clearInterval(tm); setTimeout(() => { el.remove(); Promise.resolve(sys.reboot?.()).then(() => setTimeout(() => sys.open('security', 'virus'), 1500)); }, 500); } }, 200);
}
