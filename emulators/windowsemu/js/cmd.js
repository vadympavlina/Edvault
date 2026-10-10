// Емулятор Windows · командний рядок (cmd) без DOM. Працює з файловою системою FS,
// а відкриття вікон, список і закриття задач — через host (його дає інтерфейс).
import { fwOf, evaluate, record, NET, PROGRAMS, PROFILES, PROFILE_NAME, defaults as fwDefaults, validPorts, validAddr, actionText, profilesText, protoText, portsText, addrText, newId } from './fw.js';
import { adapters, primary, reach, resolveName, netOf, syncNET, arpNote, sameNet, prefixOf, WIFI, MAC, NETWORKS, wifiConnect, wifiDisconnect } from './net.js';
import { FS, ERR, FsError, HOME, USER, LOGIN, DRIVE_LABEL, resolve, parsePath, parentPath, nameOfPath, joinPath, wildcard, hasWild, isInside, fmtDate, fmtTime, fmtNum, isText, validName } from './fs.js';

export const HOST = 'EDVAULT-PC';
const lc = s => s.toLocaleLowerCase('uk');

/* ── довідка ── */
export const HELP = {
  attrib: ['Показує або змінює атрибути файлів.', 'ATTRIB [+R | -R] [+H | -H] [шлях]', ['attrib', 'attrib +h секрет.txt', 'attrib -r Нотатки.txt'], '+R / -R — лише читання, +H / -H — прихований.'],
  cd: ['Показує або змінює поточну папку.', 'CD [/D] [диск:][шлях]\nCD ..', ['cd Documents', 'cd ..', 'cd \\', 'cd /d D:\\Інформатика'], 'Без параметрів показує поточну папку. «..» — на рівень вище, «\\» — у корінь диска.'],
  chdir: 'cd',
  cls: ['Очищає екран.', 'CLS', ['cls']],
  color: ['Змінює кольори тексту й тла консолі.', 'COLOR [тло][текст]', ['color 0a', 'color 1f', 'color'], 'Цифри: 0 чорний, 1 синій, 2 зелений, 3 бірюзовий, 4 червоний, 5 фіолетовий, 6 жовтий, 7 білий, 8 сірий, 9–f — яскраві. Без параметрів — звичайні кольори.'],
  copy: ['Копіює файли.', 'COPY [/Y] джерело призначення', ['copy Нотатки.txt D:\\', 'copy *.txt Школа', 'copy Нотатки.txt Нотатки2.txt'], '/Y — перезаписувати без питання. Папки копіює XCOPY.'],
  date: ['Показує дату.', 'DATE /T', ['date /t']],
  del: ['Видаляє файли назавжди (не в Кошик!).', 'DEL [/Q] [/S] файли', ['del Нотатки.txt', 'del *.tmp', 'del /q *.*'], '/Q — без підтвердження, /S — також у вкладених папках. Шаблони: * — будь-які символи, ? — один символ.'],
  erase: 'del',
  dir: ['Показує вміст папки.', 'DIR [шлях] [/B] [/S] [/A[:D|-D|H]] [/O:N|-N|S|D]', ['dir', 'dir /b', 'dir *.txt', 'dir /s /b *.docx', 'dir /a:d'], '/B — лише назви, /S — разом із вкладеними папками, /A — приховані теж (/A:D — лише папки, /A:-D — лише файли), /O:N — за назвою, /O:S — за розміром, /O:D — за датою.'],
  doskey: ['Показує історію команд.', 'DOSKEY /HISTORY', ['doskey /history']],
  echo: ['Виводить текст. Разом із > записує його у файл.', 'ECHO [текст]', ['echo Привіт!', 'echo Перший рядок > план.txt', 'echo Ще рядок >> план.txt', 'echo %USERNAME%'], '> — записати у файл (замінити), >> — дописати в кінець.'],
  exit: ['Закриває командний рядок.', 'EXIT', ['exit']],
  explorer: ['Відкриває Провідник.', 'EXPLORER [шлях]', ['explorer', 'explorer .', 'explorer D:\\']],
  fc: ['Порівнює два файли й показує відмінності.', 'FC файл1 файл2', ['fc Урок 1.txt Урок 2.txt']],
  find: ['Шукає рядки з текстом у файлі або у виводі іншої команди.', 'FIND [/I] [/C] [/V] "текст" [файл]', ['find "математика" Розклад.txt', 'dir /b | find ".txt"', 'find /c "a" Нотатки.txt'], '/I — без урахування регістру, /C — лише кількість, /V — рядки БЕЗ тексту.'],
  help: ['Список команд або довідка про команду.', 'HELP [команда]\nкоманда /?', ['help', 'help dir', 'copy /?']],
  hostname: ['Показує ім’я комп’ютера.', 'HOSTNAME', ['hostname']],
  tracert: ['Показує шлях пакетів до сайту: через які роутери вони проходять.', 'TRACERT [-d] [-h кількість] адреса', ['tracert poshuk.edvault', 'tracert 8.8.8.8'], 'Кожен рядок — один «перехід» (роутер). Перший завжди ваш основний шлюз.'],
  netstat: ['Показує мережеві підключення й відкриті порти.', 'NETSTAT [-a] [-n] [-b]', ['netstat', 'netstat -an', 'netstat -b'], '-a — також порти, що очікують підключення (LISTENING); -n — адреси числами; -b — яка програма створила підключення.'],
  arp: ['Показує таблицю ARP: які MAC-адреси мають сусіди в мережі.', 'ARP -A', ['arp -a'], 'Запис з’являється, коли комп’ютер звертається до сусіда, наприклад після ping 192.168.1.1.'],
  getmac: ['Показує MAC-адреси мережевих адаптерів.', 'GETMAC [/V]', ['getmac', 'getmac /v']],
  route: ['Показує таблицю маршрутизації.', 'ROUTE PRINT', ['route print']],
  net: ['Відомості про облікові записи (net user).', 'NET USER [ім’я]', ['net user', 'net user admin']],
  ncpa: ['Відкриває «Мережеві підключення».', 'NCPA.CPL', ['ncpa.cpl']],
  ipconfig: ['Показує мережеві налаштування.', 'IPCONFIG [/ALL | /RELEASE | /RENEW | /FLUSHDNS | /DISPLAYDNS]', ['ipconfig', 'ipconfig /all', 'ipconfig /release', 'ipconfig /renew', 'ipconfig /flushdns'], '/RELEASE — віддати IP-адресу, отриману від DHCP; /RENEW — отримати нову; /FLUSHDNS — очистити кеш DNS.'],
  md: ['Створює папку (одразу з усіма вкладеними).', 'MD шлях [шлях …]', ['md Проєкти', 'md "Нова папка"', 'md Школа\\2026\\Вересень', 'md A B C'], 'Назву з пробілами беріть у лапки.'],
  mkdir: 'md',
  more: ['Показує текст (по сторінках у справжньому Windows).', 'MORE файл\nкоманда | MORE', ['more Розклад.txt', 'tree | more']],
  move: ['Переміщає файли й папки або перейменовує їх.', 'MOVE [/Y] джерело призначення', ['move Нотатки.txt Школа', 'move *.jpg ..\\Pictures', 'move Школа Навчання'], 'Якщо призначення — існуюча папка, елемент переїде в неї. Інакше — отримає нову назву.'],
  notepad: ['Відкриває Блокнот.', 'NOTEPAD [файл]', ['notepad', 'notepad Нотатки.txt', 'notepad новий.txt']],
  nslookup: ['Знаходить IP-адресу сайту за його ім’ям (через DNS).', 'NSLOOKUP ім’я_сайту', ['nslookup edvault.online', 'nslookup google.com']],
  netsh: ['Налаштовує мережу й брандмауер (netsh advfirewall …).', 'NETSH ADVFIREWALL SHOW | SET | RESET | FIREWALL …', ['netsh advfirewall show currentprofile', 'netsh advfirewall set allprofiles state off', 'netsh advfirewall firewall show rule name=all dir=out', 'netsh advfirewall firewall add rule name="Без Google" dir=out action=block remoteip=142.250.74.110', 'netsh advfirewall firewall delete rule name="Без Google"'], 'Змінювати параметри можна лише в командному рядку «від імені адміністратора» (права кнопка на «Командний рядок» у «Пуску» чи на панелі завдань).'],
  curl: ['Відкриває сайт і показує, що він повернув (HTTP-запит).', 'CURL [-I] адреса', ['curl edvault.online', 'curl -I google.com', 'curl http://example.com:8080'], '-I — лише заголовки відповіді. Брандмауер може заблокувати вихідне підключення curl.exe.'],
  control: ['Відкриває Панель керування (тут — брандмауер).', 'CONTROL firewall.cpl', ['control firewall.cpl', 'firewall.cpl', 'wf.msc']],
  path: ['Показує шляхи пошуку програм.', 'PATH', ['path']],
  ping: ['Перевіряє зв’язок з іншим комп’ютером або сайтом.', 'PING [-t] [-n кількість] [-l розмір] адреса', ['ping edvault.online', 'ping 192.168.1.1', 'ping -n 10 google.com', 'ping -t 8.8.8.8'], '-t — надсилати без зупинки (зупинити — Ctrl+C), -n — скільки разів, -l — розмір пакета. Можна писати будь-який сайт (google.com, rozetka.com.ua) або IP-адресу. У цій мережі: 192.168.1.1 — роутер, 192.168.1.10 — шкільний сервер, 192.168.1.27 — цей комп’ютер.'],
  popd: ['Повертається в папку, збережену PUSHD.', 'POPD', ['popd']],
  pushd: ['Запам’ятовує поточну папку й переходить в іншу.', 'PUSHD шлях', ['pushd D:\\Фото']],
  rd: ['Видаляє папку.', 'RD [/S] [/Q] шлях', ['rd Порожня', 'rd /s Стара', 'rd /s /q Стара'], 'Без /S видаляє лише порожню папку. /S — разом із вмістом, /Q — без підтвердження. Видаляє назавжди, не в Кошик.'],
  rmdir: 'rd',
  ren: ['Перейменовує файл або папку.', 'REN стара_назва нова_назва', ['ren Нотатки.txt Плани.txt', 'ren Школа "Шкільні справи"', 'ren *.txt *.md'], 'Переміщати в іншу папку REN не вміє — для цього є MOVE.'],
  rename: 'ren',
  set: ['Показує або задає змінні середовища.', 'SET [змінна=[значення]]', ['set', 'set name=Олена', 'echo %name%', 'set u'], 'Значення змінної — %назва%.'],
  sort: ['Сортує рядки за абеткою.', 'SORT [/R] [файл]\nкоманда | SORT', ['sort Розклад.txt', 'dir /b | sort /r'], '/R — у зворотному порядку.'],
  start: ['Відкриває файл, папку або програму у вікні.', 'START [шлях | програма]', ['start .', 'start Нотатки.txt', 'start notepad', 'start explorer']],
  systeminfo: ['Коротко про комп’ютер.', 'SYSTEMINFO', ['systeminfo']],
  taskkill: ['Закриває програму.', 'TASKKILL /IM назва | /PID номер', ['taskkill /im notepad.exe', 'taskkill /pid 1240']],
  tasklist: ['Показує запущені процеси.', 'TASKLIST', ['tasklist', 'tasklist | find "svchost"']],
  taskmgr: ['Відкриває Диспетчер завдань.', 'TASKMGR', ['taskmgr']],
  msedge: 'browser', chrome: 'browser',
  browser: ['Відкриває браузер (можна одразу з адресою).', 'BROWSER [адреса]', ['browser', 'browser 192.168.1.1', 'start https://poshuk.edvault']],
  time: ['Показує час.', 'TIME /T', ['time /t']],
  title: ['Змінює заголовок вікна консолі.', 'TITLE текст', ['title Моя консоль']],
  tree: ['Малює дерево папок.', 'TREE [шлях] [/F]', ['tree', 'tree /f', 'tree D:\\ /f'], '/F — показувати й файли.'],
  type: ['Показує вміст текстового файлу.', 'TYPE файл', ['type Нотатки.txt', 'type nul > порожній.txt'], '«type nul > файл» створює порожній файл.'],
  ver: ['Показує версію Windows.', 'VER', ['ver']],
  vol: ['Показує мітку й серійний номер диска.', 'VOL [диск:]', ['vol', 'vol D:']],
  where: ['Шукає файли за шаблоном у папці та вкладених.', 'WHERE /R папка шаблон', ['where /r . *.txt', 'where /r D:\\ *.jpg']],
  whoami: ['Показує ім’я користувача.', 'WHOAMI', ['whoami']],
  xcopy: ['Копіює файли й папки разом із вмістом.', 'XCOPY джерело призначення [/E] [/I] [/Y]', ['xcopy Школа D:\\Школа /e /i', 'xcopy *.txt D:\\Тексти\\ /i'], '/E — разом із вкладеними папками (навіть порожніми), /I — вважати призначення папкою, /Y — перезаписувати без питання.'],
};
export const COMMANDS = Object.keys(HELP).filter(k => typeof HELP[k] !== 'string');
const info = k => typeof HELP[k] === 'string' ? HELP[HELP[k]] : HELP[k];

/* ── розбір рядка ── */
// Розбити за роздільником поза лапками
function splitOutside(line, seps) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { q = !q; cur += ch; continue; }
    if (!q) { const s = seps.find(x => line.startsWith(x, i)); if (s) { out.push(cur, s); cur = ''; i += s.length - 1; continue; } }
    cur += ch;
  }
  out.push(cur);
  return out;
}
export function tokenize(s) {
  const out = []; let cur = '', q = false, has = false;
  for (const ch of s) {
    if (ch === '"') { q = !q; has = true; continue; }
    if (!q && /\s/.test(ch)) { if (cur || has) out.push(cur); cur = ''; has = false; continue; }
    cur += ch;
  }
  if (cur || has) out.push(cur);
  return out;
}
// Параметри (/S, /Q, /A:D…) окремо від аргументів
function opts(tokens, valued = []) {
  const flags = {}, args = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const m = /^\/([a-z?]+)(?::?(.*))?$/i.exec(t);
    if (m && t.length <= 12) {
      const k = m[1].toLowerCase();
      if (valued.includes(k) && !m[2]) flags[k] = tokens[++i] ?? '';
      else flags[k] = m[2] ?? true;
    } else args.push(t);
  }
  return { flags, args };
}

const COLORS = '0123456789abcdef';
const pad = (s, n) => String(s).padStart(n);

export class Cmd {
  constructor(fs, host = {}) {
    this.fs = fs; this.host = host;
    this.admin = !!host.admin;
    this.cwd = this.admin ? 'C:\\Windows\\System32' : HOME; this.dcwd = { C: this.cwd, D: 'D:\\' };
    this.history = []; this.stack = []; this.pending = null;
    this.title = 'Командний рядок'; this.color = '07';
    this.env = { USERNAME: USER, USERPROFILE: HOME, COMPUTERNAME: HOST, OS: 'Windows_NT', SYSTEMROOT: 'C:\\Windows', WINDIR: 'C:\\Windows', HOMEDRIVE: 'C:', HOMEPATH: '\\Users\\' + USER, PATH: 'C:\\Windows\\System32;C:\\Windows', PATHEXT: '.COM;.EXE;.BAT;.CMD', PROMPT: '$P$G', TEMP: HOME + '\\AppData\\Local\\Temp' };
  }
  get prompt() { return this.cwd + '>'; }
  banner() { return ['Microsoft Windows [Version 10.0.22631.4317]', '(c) Корпорація Майкрософт. Усі права захищено.', '']; }

  // Виконати рядок. Повертає { out: [рядки], clear, exit, ask }
  run(line) {
    this.out = []; this.flags = {};
    if (this.pending) {
      const p = this.pending; this.pending = null;
      p(String(line).trim());
      return this.result();
    }
    const raw = String(line);
    if (raw.trim()) { this.history.push(raw); if (this.history.length > 200) this.history.shift(); }
    try { this.chain(raw); } catch (e) { this.print(e instanceof FsError ? e.message : 'Помилка: ' + e.message); }
    return this.result();
  }
  result() { const r = { out: this.out, ...this.flags }; if (this.pending) r.ask = true; return r; }
  print(...lines) { for (const l of lines) this.out.push(...String(l).split(/\r?\n/)); }
  ask(question, then) { this.print(question); this.flags.inline = true; this.pending = then; }

  // &, &&, || — ланцюжки команд
  chain(line) {
    const parts = splitOutside(line, ['&&', '||', '&']);
    let ok = true;
    for (let i = 0; i < parts.length; i += 2) {
      const sep = parts[i - 1];
      if ((sep === '&&' && !ok) || (sep === '||' && ok)) continue;
      ok = this.pipeline(parts[i]);
      if (this.pending || this.flags.exit) break;
    }
  }
  // | — передати вивід наступній команді; > і >> — у файл
  pipeline(seg) {
    const stages = splitOutside(seg, ['|']).filter((_, i) => i % 2 === 0);
    let input = null, ok = true;
    for (const [i, st] of stages.entries()) {
      const red = splitOutside(st, ['>>', '>']);
      let cmd = red[0], file = null, append = false;
      if (red.length >= 3) { append = red[1] === '>>'; file = tokenize(red[2].trim())[0]; if (/^\d$/.test(cmd.trim().slice(-1)) && /\s\d$/.test(cmd)) cmd = cmd.slice(0, -1); }
      const capture = file != null || i < stages.length - 1;
      const saved = this.out; if (capture) this.out = [];
      ok = this.one(cmd.trim(), input);
      if (capture) {
        const produced = this.out; this.out = saved;
        if (file != null) {
          if (lc(file) === 'nul') { input = null; continue; }
          try { this.fs.writeFile(this.path(file), produced.length ? produced.join('\r\n') + '\r\n' : '', { append }); }
          catch (e) { this.print(e.message); ok = false; }
          input = null;
        } else input = produced;
      } else input = null;
    }
    return ok;
  }
  path(p) { return resolve(this.cwd, p); }
  expand(s) { return s.replace(/%([^%\s]+)%/g, (m, k) => { const v = this.vars()[k.toUpperCase()]; return v ?? m; }); }
  vars() { const d = new Date(); return { ...this.env, CD: this.cwd, DATE: fmtDate(d), TIME: fmtTime(d) + ':' + String(d.getSeconds()).padStart(2, '0') + ',00', RANDOM: String(Math.floor(Math.random() * 32768)), ERRORLEVEL: '0' }; }

  // Одна команда; повертає true, якщо успішно
  one(text, input) {
    text = this.expand(text);
    if (!text || text.startsWith('::') || /^rem(\s|$)/i.test(text)) return true;
    if (text.startsWith('@')) text = text.slice(1);
    // «cd..», «cd\», «echo.» без пробілу
    let m = /^(cd|chdir)(\.\.|\\.*)$/i.exec(text); if (m) text = m[1] + ' ' + m[2];
    m = /^echo[.:](.*)$/i.exec(text); if (m) { this.print(m[1]); return true; }
    if (/^[a-z]:$/i.test(text)) return this.drive(text[0].toUpperCase());
    const name = /^\S+/.exec(text)[0], rest = text.slice(name.length).replace(/^\s/, '');
    const key = { 'ncpa.cpl': 'ncpa', 'ms-settings:network': 'netsettings', 'wf.msc': 'wfmsc', 'firewall.cpl': 'firewallcpl', 'windowsdefender:': 'defender', 'ms-settings:': 'settings', msedge: 'browser', chrome: 'browser', iexplore: 'browser' }[lc(name)] || lc(name).replace(/\.(exe|com)$/, '');
    const tokens = tokenize(rest);
    if (tokens.includes('/?')) return this.c_help([key]);
    const k = typeof HELP[key] === 'string' ? HELP[key] : key;
    const fn = this['c_' + k];
    if (!fn) {
      const p = this.path(name);
      if (this.fs.isFile(p) || this.fs.isDir(p)) return this.c_start([name]);
      this.print(`'${name}' не є внутрішньою або зовнішньою`, 'командою, виконуваною програмою або пакетним файлом.');
      return false;
    }
    return fn.call(this, tokens, rest, input) !== false;
  }

  /* ── навігація ── */
  drive(d) {
    if (!this.fs.s.drives[d]) { this.print('Системі не вдається знайти вказаний диск.'); return false; }
    this.dcwd[this.cwd[0]] = this.cwd;
    this.cwd = this.fs.isDir(this.dcwd[d] || d + ':\\') ? this.dcwd[d] || d + ':\\' : d + ':\\';
    return true;
  }
  c_cd(t) {
    const { flags, args } = opts(t);
    const target = args.join(' ');
    if (!target) { this.print(this.cwd); return true; }
    if (/^[a-z]:$/i.test(target)) { this.print(this.dcwd[target[0].toUpperCase()] || target.toUpperCase() + '\\'); return true; }
    const p = this.path(target);
    if (!this.fs.isDir(p)) { this.print(this.fs.isFile(p) ? 'Ім’я папки задано неправильно.' : ERR.path().message); return false; }
    const real = this.fs.real(p);
    if (real[0] !== this.cwd[0] && !flags.d) { this.dcwd[real[0]] = real; return true; }
    this.dcwd[this.cwd[0]] = this.cwd;
    this.cwd = real; return true;
  }
  c_pushd(t) { const before = this.cwd; const ok = this.c_cd(['/d', ...t]); if (ok && t.length) this.stack.push(before); return ok; }
  c_popd() { const p = this.stack.pop(); if (p && this.fs.isDir(p)) this.cwd = p; return true; }

  /* ── вміст ── */
  c_dir(t) {
    const { flags, args } = opts(t);
    // /AD, /A-D, /ON, /O-S — без двокрапки
    for (const k of Object.keys(flags)) if (/^[ao].+/.test(k) && flags[k] === true) { flags[k[0]] = k.slice(1); delete flags[k]; }
    const target = args.join(' ') || '.';
    let p = this.path(target), pattern = '*';
    if (hasWild(nameOfPath(p))) { pattern = nameOfPath(p); p = parentPath(p); }
    else if (this.fs.isFile(p)) { pattern = nameOfPath(p); p = parentPath(p); }
    if (!this.fs.isDir(p)) { this.print(this.fs.isFile(p) ? ERR.file().message : ERR.path().message); return false; }
    p = this.fs.real(p);
    const a = flags.a === true ? 'all' : typeof flags.a === 'string' ? lc(flags.a) : null;
    const re = wildcard(pattern);
    const pick = n => re.test(n.name) && (a === 'all' || a === 'h' || !n.attrs.h) && (a === 'h' ? n.attrs.h : true) && (a === 'd' ? n.type === 'dir' : a === '-d' ? n.type === 'file' : true);
    const ord = typeof flags.o === 'string' ? lc(flags.o) : flags.o ? 'gn' : 'n';
    const sorter = (x, y) => {
      if (ord.includes('g') && x.type !== y.type) return x.type === 'dir' ? -1 : 1;
      const k = ord.replace(/[g-]/g, '')[0] || 'n', dir = ord.includes('-') ? -1 : 1;
      const v = k === 's' ? this.fs.sizeOf(x) - this.fs.sizeOf(y) : k === 'd' ? x.modified - y.modified : x.name.localeCompare(y.name, 'uk');
      return v * dir;
    };
    if (flags.b) {
      let any = false;
      const walk = (dir) => {
        const kids = this.fs.dirNode(dir).children.filter(pick).sort(sorter);
        for (const c of kids) { this.print(flags.s ? dir.replace(/\\$/, '') + '\\' + c.name : c.name); any = true; }
        if (flags.s) for (const c of this.fs.dirNode(dir).children.filter(c => c.type === 'dir' && (a || !c.attrs.h))) walk(dir.replace(/\\$/, '') + '\\' + c.name);
      };
      walk(p);
      if (!any) { this.print(ERR.file().message); return false; }
      return true;
    }
    const drv = p[0];
    this.print(` Том у пристрої ${drv} має мітку ${DRIVE_LABEL[drv]}`, ` Серійний номер тому: ${drv === 'C' ? '6A3F-1C2B' : '2E71-9D04'}`, '');
    let files = 0, dirs = 0, bytes = 0, found = false;
    const walk = (dir) => {
      const node = this.fs.dirNode(dir);
      const kids = node.children.filter(pick).sort(sorter);
      const isRoot = parsePath(dir).parts.length === 0;
      if (kids.length || !flags.s) {
        this.print(` Вміст папки ${dir}`, '');
        if (!isRoot && pattern === '*') { this.print(`${fmtDate(node.modified)}  ${fmtTime(node.modified)}    <DIR>          .`, `${fmtDate(node.modified)}  ${fmtTime(node.modified)}    <DIR>          ..`); dirs += 2; }
        let f = 0, b = 0;
        for (const c of kids) {
          const size = this.fs.sizeOf(c);
          this.print(`${fmtDate(c.modified)}  ${fmtTime(c.modified)}    ${c.type === 'dir' ? '<DIR>         ' : pad(fmtNum(size).replace(/\u00a0/g, ' '), 14)} ${c.name}`);
          if (c.type === 'dir') dirs++; else { f++; b += size; }
          found = true;
        }
        files += f; bytes += b;
        if (flags.s) this.print(pad(`${f} файлів`, 16) + pad(fmtNum(b).replace(/\u00a0/g, ' '), 19) + ' байтів', '');
      }
      if (flags.s) for (const c of node.children.filter(c => c.type === 'dir' && (a || !c.attrs.h))) walk(dir.replace(/\\$/, '') + '\\' + c.name);
    };
    walk(p);
    if (!found && pattern !== '*') { this.print(ERR.file().message); return false; }
    if (flags.s) this.print('     Усього файлів у списку:');
    this.print(pad(`${files} файлів`, 16) + pad(fmtNum(bytes).replace(/\u00a0/g, ' '), 19) + ' байтів', pad(`${dirs} папок`, 16) + pad(fmtNum(this.fs.free(drv)).replace(/\u00a0/g, ' '), 19) + ' байтів вільно');
    return true;
  }
  c_tree(t) {
    const { flags, args } = opts(t);
    const p = this.fs.real(this.path(args.join(' ') || '.'));
    if (!this.fs.isDir(p)) { this.print('Неприпустимий шлях - ' + p.slice(2).toUpperCase(), 'Вкладені папки відсутні'); return false; }
    this.print(`Структура папок тому ${DRIVE_LABEL[p[0]]}`, `Серійний номер тому: ${p[0] === 'C' ? '6A3F-1C2B' : '2E71-9D04'}`, p.length > 3 ? p.toUpperCase() : p);
    let any = false;
    const walk = (dir, pre) => {
      const kids = this.fs.dirNode(dir).children.filter(c => !c.attrs.h);
      const ds = kids.filter(c => c.type === 'dir'), fs = flags.f ? kids.filter(c => c.type === 'file') : [];
      for (const f of fs) { this.print(pre + (ds.length ? '│   ' : '    ') + f.name); any = true; }
      if (fs.length) this.print(pre + (ds.length ? '│' : ''));
      ds.forEach((d, i) => { const last = i === ds.length - 1; this.print(pre + (last ? '└───' : '├───') + d.name); any = true; walk(dir.replace(/\\$/, '') + '\\' + d.name, pre + (last ? '    ' : '│   ')); });
    };
    walk(p, '');
    if (!any) this.print('Вкладені папки відсутні', '');
    return true;
  }
  c_type(t) {
    if (!t.length) { this.print('Синтаксична помилка в команді.'); return false; }
    if (lc(t[0]) === 'nul') return true;
    let ok = true;
    for (const a of t) {
      const p = this.path(a);
      const list = hasWild(a) ? this.fs.glob(p).filter(x => x.node.type === 'file') : [{ path: p }];
      if (!list.length) { this.print(ERR.file().message); ok = false; continue; }
      for (const { path } of list) {
        if (list.length > 1 || hasWild(a)) this.print('', nameOfPath(path), '', '');
        try { this.print(this.fs.readFile(path)); } catch (e) { this.print(e.code === 'access' ? 'Відмовлено в доступі.' : ERR.file().message); ok = false; }
      }
    }
    return ok;
  }
  c_more(t, rest, input) { if (input) { this.print(...input); return true; } return this.c_type(t); }
  lines(t, input, flagsUsed) {
    if (input) return input;
    const f = t.find(x => !x.startsWith('/'));
    if (!f) return [];
    return this.fs.readFile(this.path(f)).split(/\r?\n/).filter((l, i, a) => i < a.length - 1 || l);
  }
  c_sort(t, rest, input) {
    const { flags, args } = opts(t);
    let ls;
    try { ls = input || (args.length ? this.fs.readFile(this.path(args.join(' '))).split(/\r?\n/).filter(Boolean) : []); } catch (e) { this.print(ERR.file().message); return false; }
    ls = [...ls].sort((a, b) => a.localeCompare(b, 'uk', { sensitivity: 'base' }));
    if (flags.r) ls.reverse();
    this.print(...ls); return true;
  }
  c_find(t, rest, input) {
    const { flags, args } = opts(t);
    if (!args.length) { this.print('FIND: неправильна кількість параметрів'); return false; }
    const needle = args[0], files = args.slice(1);
    const test = l => { const hit = flags.i ? lc(l).includes(lc(needle)) : l.includes(needle); return flags.v ? !hit : hit; };
    const run = (lines, label) => {
      const hits = lines.filter(test);
      if (label != null) this.print('', '---------- ' + label.toUpperCase() + (flags.c ? ': ' + hits.length : ''));
      else if (flags.c) this.print(String(hits.length));
      if (!flags.c) this.print(...hits);
      return hits.length;
    };
    if (!files.length) { if (!input) return true; return run(input, null) > 0; }
    let total = 0;
    for (const f of files) {
      const p = this.path(f);
      const list = hasWild(f) ? this.fs.glob(p).filter(x => x.node.type === 'file') : [{ path: p }];
      for (const { path } of list) {
        try { total += run(this.fs.readFile(path).split(/\r?\n/), nameOfPath(path)); }
        catch (e) { this.print(`Файл не знайдено - ${nameOfPath(path).toUpperCase()}`); }
      }
    }
    return total > 0;
  }
  c_fc(t) {
    const { args } = opts(t);
    if (args.length !== 2) { this.print('FC: неправильна кількість файлів'); return false; }
    let A, B;
    try { A = this.fs.readFile(this.path(args[0])).split(/\r?\n/); B = this.fs.readFile(this.path(args[1])).split(/\r?\n/); }
    catch (e) { this.print('FC: не вдається відкрити файл — немає такого файлу або папки'); return false; }
    const n1 = nameOfPath(this.fs.real(this.path(args[0]))).toUpperCase(), n2 = nameOfPath(this.fs.real(this.path(args[1]))).toUpperCase();
    this.print(`Порівняння файлів ${n1} і ${n2}`);
    const diff = [];
    for (let i = 0; i < Math.max(A.length, B.length); i++) if ((A[i] ?? '') !== (B[i] ?? '')) diff.push(i);
    if (!diff.length) { this.print('FC: розбіжностей не знайдено', ''); return true; }
    for (const i of diff.slice(0, 20)) this.print(`***** ${n1}`, A[i] ?? '', `***** ${n2}`, B[i] ?? '', '*****', '');
    return true;
  }
  c_where(t) {
    const { flags, args } = opts(t, ['r']);
    const pat = args[0];
    if (!pat) { this.print('ПОМИЛКА: неправильний синтаксис. Наберіть «WHERE /?».'); return false; }
    const root = this.fs.real(this.path(flags.r && flags.r !== true ? flags.r : '.'));
    if (!this.fs.isDir(root)) { this.print('ПОМИЛКА: неправильний шлях.'); return false; }
    const re = wildcard(pat); let n = 0;
    const walk = d => { for (const c of this.fs.dirNode(d).children) { const p = d.replace(/\\$/, '') + '\\' + c.name; if (c.type === 'file' && re.test(c.name)) { this.print(p); n++; } if (c.type === 'dir') walk(p); } };
    walk(root);
    if (!n) { this.print('ІНФОРМАЦІЯ: не вдалося знайти файли за вказаним шаблоном.'); return false; }
    return true;
  }

  /* ── створення й видалення ── */
  c_md(t) {
    if (!t.length) { this.print('Синтаксична помилка в команді.'); return false; }
    let ok = true;
    for (const a of t) {
      const p = this.path(a);
      if (this.fs.node(p)) { this.print(`Підпапка або файл ${a} вже існує.`); ok = false; continue; }
      try { this.fs.mkdir(p); } catch (e) { this.print(e.message); ok = false; }
    }
    return ok;
  }
  c_rd(t) {
    const { flags, args } = opts(t);
    if (!args.length) { this.print('Синтаксична помилка в команді.'); return false; }
    const go = list => {
      for (const a of list) {
        const p = this.path(a);
        if (isInside(this.cwd, this.fs.real(p))) { this.print('Процес не може отримати доступ до файлу, оскільки цей файл використовується іншим процесом.'); continue; }
        if (!this.fs.node(p)) { this.print(ERR.file().message); continue; }
        if (!this.fs.isDir(p)) { this.print('Ім’я папки задано неправильно.'); continue; }
        try { this.fs.remove(p, { recursive: !!flags.s }); } catch (e) { this.print(e.message); }
      }
    };
    if (flags.s && !flags.q) {
      const first = args[0], others = args.slice(1);
      const step = list => { if (!list.length) return; const [a, ...more] = list; this.ask(`${a}, Ви впевнені (Y/N)? `, ans => { if (/^y/i.test(ans)) go([a]); step(more); }); };
      step([first, ...others]);
      return true;
    }
    go(args); return true;
  }
  c_del(t) {
    const { flags, args } = opts(t);
    if (!args.length) { this.print('Синтаксична помилка в команді.'); return false; }
    const targets = [];
    for (const a of args) {
      let p = this.path(a);
      if (this.fs.isDir(p)) p = p.replace(/\\$/, '') + '\\*';
      const walk = (dirP, pat) => {
        if (!this.fs.isDir(dirP)) return;
        const re = wildcard(pat);
        for (const c of this.fs.dirNode(dirP).children) { const cp = dirP.replace(/\\$/, '') + '\\' + c.name; if (c.type === 'file' && re.test(c.name) && !c.attrs.h) targets.push(cp); if (flags.s && c.type === 'dir') walk(cp, pat); }
      };
      const before = targets.length;
      walk(this.fs.real(parentPath(p)), nameOfPath(p));
      if (targets.length === before) this.print(this.fs.isDir(parentPath(p)) ? `Не вдалося знайти ${this.fs.real(p)}` : ERR.path().message);
    }
    const doIt = () => { for (const p of targets) { try { this.fs.remove(p); if (flags.s) this.print('Видалений файл - ' + p); } catch (e) { this.print(e.code === 'access' ? `Відмовлено в доступі: ${p}` : e.message); } } };
    const all = args.some(a => /(^|\\)\*(\.\*)?$/.test(a) || this.fs.isDir(this.path(a)));
    if (all && !flags.q && targets.length) { this.ask(`${this.fs.real(this.path(args[0])).replace(/\\\*?(\.\*)?$/, '')}\\*, Ви впевнені (Y/N)? `, ans => { if (/^y/i.test(ans)) doIt(); }); return true; }
    doIt(); return !!targets.length;
  }
  c_ren(t) {
    if (t.length !== 2) { this.print('Синтаксична помилка в команді.'); return false; }
    const [a, b] = t;
    if (/[\\/]/.test(b) || /^[a-z]:/i.test(b)) { this.print('Синтаксична помилка в команді.'); return false; }
    const p = this.path(a);
    if (hasWild(a)) {
      const list = this.fs.glob(p); if (!list.length) { this.print(ERR.file().message); return false; }
      for (const { node, path } of list) {
        const nn = wildRename(node.name, b);
        try { this.fs.rename(path, nn); } catch (e) { this.print(e.code === 'exists' ? 'Знайдено файл із такою самою назвою, або не вдалося знайти файл.' : e.message); }
      }
      return true;
    }
    if (!this.fs.node(p)) { this.print(ERR.file().message); return false; }
    try { this.fs.rename(p, b); return true; }
    catch (e) { this.print(e.code === 'exists' ? 'Знайдено файл із такою самою назвою, або не вдалося знайти файл.' : e.message); return false; }
  }
  // запитати про перезапис (Yes/No/All)
  overwrite(list, op, done) {
    let all = false, n = 0;
    const step = i => {
      if (i >= list.length) { done(n); return; }
      const [src, dst] = list[i];
      const clash = this.fs.node(this.fs.isDir(dst) ? dst.replace(/\\$/, '') + '\\' + nameOfPath(src) : dst);
      const run = () => { try { op(src, dst, true); n++; } catch (e) { this.print(e.message); } step(i + 1); };
      if (!clash || all || this.flags.yes) { if (clash) run(); else { try { op(src, dst, false); n++; } catch (e) { this.print(e.message); } step(i + 1); } return; }
      this.ask(`Перезаписати ${this.fs.real(this.fs.isDir(dst) ? dst.replace(/\\$/, '') + '\\' + nameOfPath(src) : dst)}? (Yes/No/All): `, ans => {
        if (/^a/i.test(ans)) { all = true; run(); } else if (/^y/i.test(ans)) run(); else step(i + 1);
      });
    };
    step(0);
  }
  sources(a) {
    const p = this.path(a);
    if (hasWild(a)) return this.fs.glob(p).map(x => x.path);
    return this.fs.node(p) ? [this.fs.real(p)] : [];
  }
  c_copy(t) {
    const { flags, args } = opts(t);
    if (!args.length) { this.print('Синтаксична помилка в команді.'); return false; }
    const src = this.sources(args[0]).filter(p => this.fs.isFile(p)), destArg = args[1] || '.';
    if (!src.length) { this.print(this.fs.isDir(this.path(args[0])) ? 'Щоб скопіювати папку, скористайтеся командою XCOPY.' : ERR.file().message, '        Скопійовано файлів: 0.'); return false; }
    const dest = this.path(destArg);
    if (src.length > 1 && !this.fs.isDir(dest)) { this.print(ERR.path().message, '        Скопійовано файлів: 0.'); return false; }
    if (flags.y) this.flags.yes = true;
    if (src.length > 1 || hasWild(args[0])) src.forEach(s => this.print(nameOfPath(s)));
    this.overwrite(src.map(s => [s, dest]), (s, d, ow) => this.fs.copy(s, d, { overwrite: ow }), n => this.print(`        Скопійовано файлів: ${n}.`));
    delete this.flags.yes;
    return true;
  }
  c_xcopy(t) {
    const { flags, args } = opts(t);
    if (!args.length) { this.print('Неправильна кількість параметрів'); return false; }
    const srcP = this.path(args[0]);
    let dest = this.path(args[1] || '.');
    if (this.fs.isDir(srcP)) {
      // вміст папки → у папку призначення
      if (!this.fs.node(dest)) { if (!flags.i && !(args[1] || '').endsWith('\\')) { this.print(`Чи ${args[1]} визначає ім’я файлу`, 'або папки в цільовому розташуванні', '(F = файл, D = папка)? D'); } try { this.fs.mkdir(dest); } catch (e) { this.print(e.message); return false; } }
      let n = 0;
      const walk = (from, to) => {
        for (const c of this.fs.dirNode(from).children) {
          if (c.attrs.h) continue;
          const fp = from.replace(/\\$/, '') + '\\' + c.name, tp = to.replace(/\\$/, '') + '\\' + c.name;
          if (c.type === 'file') {
            try { this.fs.copy(fp, to, { overwrite: !!flags.y }); this.print(fp); n++; }
            catch (e) { if (e.code === 'exists') { this.fs.copy(fp, to, { overwrite: true }); this.print(fp); n++; } else this.print(e.message); }
          } else if (flags.e || flags.s) {
            if (!this.fs.node(tp)) this.fs.mkdir(tp);
            if (c.children.length || flags.e) walk(fp, tp);
          }
        }
      };
      try { walk(this.fs.real(srcP), this.fs.real(dest)); } catch (e) { this.print(e.message); return false; }
      this.print(`Скопійовано файлів: ${n}`);
      return true;
    }
    const src = this.sources(args[0]).filter(p => this.fs.isFile(p));
    if (!src.length) { this.print(`Файл не знайдено - ${nameOfPath(srcP)}`, 'Скопійовано файлів: 0'); return false; }
    if (!this.fs.node(dest) && (flags.i || (args[1] || '').endsWith('\\') || src.length > 1)) this.fs.mkdir(dest);
    let n = 0;
    for (const s of src) { try { this.fs.copy(s, dest, { overwrite: true }); this.print(s); n++; } catch (e) { this.print(e.message); } }
    this.print(`Скопійовано файлів: ${n}`);
    return true;
  }
  c_move(t) {
    const { flags, args } = opts(t);
    if (args.length < 2) { this.print('Синтаксична помилка в команді.'); return false; }
    const src = this.sources(args[0]);
    if (!src.length) { this.print(ERR.file().message); return false; }
    const dest = this.path(args[1]);
    if (src.length > 1 && !this.fs.isDir(dest)) { this.print('Не вдається перемістити кілька файлів в один файл.'); return false; }
    for (const s of src) if (isInside(this.cwd, s) && this.fs.isDir(s)) { this.print('Процес не може отримати доступ до файлу, оскільки цей файл використовується іншим процесом.'); return false; }
    if (flags.y) this.flags.yes = true;
    const files = src.filter(s => this.fs.isFile(s)).length, dirs = src.length - files;
    this.overwrite(src.map(s => [s, dest]), (s, d, ow) => this.fs.move(s, d, { overwrite: ow }), n => this.print(`        Переміщено ${dirs && !files ? 'папок' : 'файлів'}: ${n}.`));
    delete this.flags.yes;
    return true;
  }
  c_attrib(t) {
    const { args } = opts(t);
    const set = args.filter(a => /^[+-][rhRH]$/.test(a)), names = args.filter(a => !/^[+-][a-zA-Z]$/.test(a));
    const target = names.join(' ') || '*';
    const list = hasWild(target) ? this.fs.glob(this.path(target)) : this.fs.node(this.path(target)) ? [{ node: this.fs.node(this.path(target)), path: this.fs.real(this.path(target)) }] : [];
    if (!list.length) { this.print(`Файл не знайдено - ${this.fs.real(this.path(target))}`); return false; }
    for (const { node, path } of list) {
      if (set.length) { for (const s of set) { try { this.fs.setAttr(path, s[1].toLowerCase(), s[0] === '+'); } catch (e) { this.print(`Відмовлено в доступі - ${path}`); } } continue; }
      if (hasWild(target) && node.type === 'dir') continue;
      const a = node.attrs;
      this.print(`${node.type === 'file' ? 'A' : ' '}    ${a.s ? 'S' : ' '}${a.h ? 'H' : ' '}${a.r ? 'R' : ' '}               ${path}`);
    }
    return true;
  }
  c_echo(t, rest) {
    if (!rest.trim()) { this.print('Режим виведення команд на екран (ECHO) увімкнено.'); return true; }
    if (/^(on|off)$/i.test(rest.trim())) return true;
    this.print(rest.replace(/\s+$/, '')); return true;
  }

  /* ── програми й система ── */
  c_start(t) {
    const { args } = opts(t);
    const a = args.filter(x => x !== '""').join(' ');
    if (!a) { this.host.open?.('cmd', this.cwd); return true; }
    const app = lc(a).replace(/\.exe$/, '');
    if (['notepad', 'explorer', 'cmd'].includes(app)) { this.host.open?.(app, this.cwd); return true; }
    if (['taskmgr', 'browser', 'msedge', 'chrome'].includes(app)) { this.host.open?.(app === 'taskmgr' ? 'taskmgr' : 'browser'); return true; }
    if (app === 'ms-settings:') { this.host.open?.('settings'); return true; }
    if (/^https?:\/\//i.test(a) || /^www\./i.test(a)) { this.host.open?.('browser', a); return true; }
    const p = this.path(a);
    const n = this.fs.node(p);
    if (!n) { this.print(`Windows не вдається знайти «${a}». Переконайтеся, що ім’я введено правильно, а тоді повторіть спробу.`); return false; }
    this.host.open?.(n.type === 'dir' ? 'explorer' : 'file', this.fs.real(p));
    return true;
  }
  c_notepad(t) {
    const a = opts(t).args.join(' ');
    if (!a) { this.host.open?.('notepad', null); return true; }
    let p = this.path(a);
    if (!/\.[^\\.]+$/.test(nameOfPath(p))) p += '.txt';
    if (this.fs.isDir(p)) { this.print('Неможливо відкрити папку в Блокноті.'); return false; }
    if (!this.fs.node(p)) {
      if (!this.fs.isDir(parentPath(p))) { this.print(ERR.path().message); return false; }
      if (!validName(nameOfPath(p))) { this.print(ERR.name().message); return false; }
      this.host.open?.('notepad-new', this.fs.real(parentPath(p)) + '\\' + nameOfPath(p));
      return true;
    }
    this.host.open?.('notepad', this.fs.real(p)); return true;
  }
  c_explorer(t) { const a = opts(t).args.join(' '); const p = a ? this.path(a) : null; if (p && !this.fs.isDir(p)) { this.host.open?.('explorer', parentPath(this.fs.real(p))); return true; } this.host.open?.('explorer', p ? this.fs.real(p) : null); return true; }
  c_cmd() { this.host.open?.('cmd', this.cwd); return true; }
  c_taskmgr() { this.host.open?.('taskmgr'); return true; }
  c_browser(t, rest) { this.host.open?.('browser', rest.trim() || null); return true; }
  c_settings() { this.host.open?.('settings'); return true; }
  c_tasklist() {
    const tasks = this.host.tasks?.() || [];
    const rows = this.host.procs ? this.host.procs() : [{ name: 'System', pid: 4, mem: 144 }, { name: 'explorer.exe', pid: 1024, mem: 98304 }, ...tasks.map(x => ({ ...x, mem: x.mem || 20480 }))];
    this.print('', 'Ім’я образу                    PID   Пам’ять', '========================= ======== ============');
    for (const r of rows) this.print(`${r.name.padEnd(25)} ${String(r.pid).padStart(8)} ${(fmtNum(r.mem).replace(/\u00a0/g, ' ') + ' КБ').padStart(12)}`);
    return true;
  }
  c_taskkill(t) {
    const { flags } = opts(t, ['im', 'pid']);
    const by = flags.im ? { im: lc(String(flags.im)) } : flags.pid ? { pid: +flags.pid } : null;
    if (!by) { this.print('ПОМИЛКА: неправильний синтаксис. Наберіть «TASKKILL /?».'); return false; }
    if (by.im === 'explorer.exe' || by.pid === 1024 || by.pid === 4 || this.host.critical?.(by)) { this.print('ПОМИЛКА: не вдалося завершити процес — він потрібен системі.'); return false; }
    const killed = this.host.kill?.(by) || [];
    if (!killed.length) { this.print(`ПОМИЛКА: процес «${flags.im || flags.pid}» не знайдено.`); return false; }
    for (const k of killed) this.print(`УСПІХ: надіслано сигнал завершення процесу «${k.name}» з PID ${k.pid}.`);
    return true;
  }
  c_exit() { this.flags.exit = true; return true; }
  c_cls() { this.flags.clear = true; this.out = []; return true; }
  c_title(t, rest) { this.title = rest || 'Командний рядок'; this.flags.title = this.title; return true; }
  c_color(t) {
    const c = lc(t[0] || '07');
    if (!/^[0-9a-f]{2}$/.test(c) || c[0] === c[1]) { if (t[0]) { this.print('Колір тла й тексту не може бути однаковим.', 'Наберіть «COLOR /?», щоб побачити допустимі кольори.'); } else { this.color = '07'; this.flags.color = '07'; } return !t[0]; }
    this.color = c; this.flags.color = c; return true;
  }
  c_date(t) { if (!t.length || lc(t[0]) === '/t') { const d = new Date(); this.print(t.length ? fmtDate(d) : `Поточна дата: ${fmtDate(d)}`); return true; } this.print('Змінювати дату на навчальному комп’ютері не можна.'); return false; }
  c_time(t) { const d = new Date(); this.print(t.length ? fmtTime(d) : `Поточний час: ${fmtTime(d)}:${String(d.getSeconds()).padStart(2, '0')},00`); return true; }
  c_ver() { this.print('', 'Microsoft Windows [Version 10.0.22631.4317]'); return true; }
  c_vol(t) { const d = (t[0] || this.cwd)[0].toUpperCase(); if (!this.fs.s.drives[d]) { this.print('Системі не вдається знайти вказаний диск.'); return false; } this.print(` Том у пристрої ${d} має мітку ${DRIVE_LABEL[d]}`, ` Серійний номер тому: ${d === 'C' ? '6A3F-1C2B' : '2E71-9D04'}`); return true; }
  c_whoami(t) {
    if (/groups/i.test(t[0] || '')) { this.print('', 'ВІДОМОСТІ ПРО ГРУПИ', '-----------------', '', 'Ім’я групи                     Тип', '============================== ==========', 'Усі                            Відома група', 'BUILTIN\\Користувачі            Псевдонім', this.admin ? 'BUILTIN\\Адміністратори         Псевдонім' : '', 'NT AUTHORITY\\ІНТЕРАКТИВНІ      Відома група'); return true; }
    this.print(lc(HOST) + '\\' + LOGIN); return true;
  }
  c_net(t) {
    const L = t.map(x => lc(x));
    if (L[0] === 'user' || L[0] === 'users') {
      if (!L[1]) { this.print('', `Облікові записи користувачів для \\\\${HOST}`, '', '-'.repeat(79), 'admin                    Адміністратор            Гість', 'Команду виконано успішно.', ''); return true; }
      if (L[2] != null) { this.print('Системна помилка 5.', '', 'Відмовлено в доступі. Пароль облікового запису на навчальному комп’ютері змінює лише вчитель.'); return false; }
      if (L[1] === 'admin') { this.print('Ім’я користувача               admin', `Повне ім’я                     ${USER}`, 'Коментар                       Обліковий запис учня', 'Обліковий запис активний       Так', 'Пароль можна змінювати         Ні', 'Пароль обов’язковий            Так', `Профіль користувача            ${HOME}`, 'Членство в локальних групах    *Користувачі', 'Команду виконано успішно.'); return true; }
      if (L[1] === 'адміністратор' || L[1] === 'administrator') { this.print('Ім’я користувача               Адміністратор', 'Коментар                       Вбудований обліковий запис адміністратора', 'Членство в локальних групах    *Адміністратори', 'Команду виконано успішно.'); return true; }
      this.print('Не вдається знайти ім’я користувача.', '', 'Додаткову довідку можна отримати, ввівши NET HELPMSG 2221.'); return false;
    }
    this.print('Синтаксис цієї команди:', '', 'NET USER [ім’я]'); return !L.length;
  }
  c_ncpa() { this.host.open?.('ncpa'); return true; }
  c_netsettings() { this.host.open?.('settings', 'network'); return true; }
  c_hostname() { this.print(HOST); return true; }
  c_path() { this.print('PATH=' + this.env.PATH); return true; }
  c_systeminfo() {
    const free = this.fs.free('C');
    this.print('', `Ім’я вузла:                   ${HOST}`, 'Назва ОС:                     Microsoft Windows 11 Освіта', 'Версія ОС:                    10.0.22631 Збірка 22631', `Зареєстрований власник:       ${USER}`, 'Виробник системи:             Edvault', 'Тип системи:                  x64-based PC', 'Процесори:                    1 процесор(и)', 'Повний обсяг фізичної пам’яті: 8 192 МБ', `Вільно на диску C:            ${Math.round(free / 1073741824)} ГБ`, `Мережеві адаптери:            ${adapters(this.fs).map(a => a.name + (a.ip ? ', IP-адреса ' + a.ip : ' (' + ({ disabled: 'вимкнено', disconnected: 'не підключено', noip: 'без IP-адреси' }[a.status] || '') + ')')).join('; ')}`);
    return true;
  }
  c_ipconfig(t) {
    const k = lc(t[0] || ''), S = netOf(this.fs);
    const changed = () => { syncNET(this.fs); this.fs.emit('net'); };
    if (k === '/flushdns') { S.dnsCache = {}; this.fs.emit('net'); this.print('', 'Налаштування IP для Windows', '', 'Кеш DNS-визначника успішно очищено.'); return true; }
    if (k === '/displaydns') {
      this.print('', 'Налаштування IP для Windows', '');
      const list = Object.entries(S.dnsCache);
      if (!list.length) { this.print('    Кеш DNS порожній. Він заповнюється, коли ви відкриваєте сайти чи виконуєте ping за ім’ям.'); return true; }
      for (const [h, v] of list) this.print(`    ${h}`, '    ----------------------------------------', `    Ім’я запису . . . . . : ${h}`, '    Тип запису . . . . . : 1', `    Час життя . . . . . . : ${Math.max(1, 300 - Math.round((Date.now() - v.at) / 1000))}`, `    Запис (вузол) A . . . : ${v.ip}`, '');
      return true;
    }
    if (k === '/release' || k === '/renew') {
      const list = ['eth', 'wifi'].filter(id => S[id].on && S[id].dhcp && (id === 'eth' ? S.eth.cable : S.wifi.ssid));
      if (!list.length) { this.print('', 'Налаштування IP для Windows', '', 'Не вдалося виконати операцію: немає адаптерів з автоматичною адресою (DHCP), підключених до мережі.'); return false; }
      for (const id of list) S[id].released = k === '/release';
      if (k === '/release') S.dnsCache = {};
      changed();
      this.print('', 'Налаштування IP для Windows', '');
      if (k === '/release') this.print('IP-адресу звільнено. Тепер комп’ютер не має адреси й не може користуватися мережею.', 'Щоб отримати нову адресу від DHCP-сервера (роутера), виконайте ipconfig /renew.', '');
    } else if (k && k !== '/all') { this.print('', `Помилка: неправильний параметр ${t[0]}.`, 'Допустимо: /all, /release, /renew, /flushdns, /displaydns.'); return false; }
    const all = k === '/all';
    if (k !== '/release' && k !== '/renew') this.print('', 'Налаштування IP для Windows', '');
    if (all) this.print(`   Ім’я вузла . . . . . . . . . . . : ${HOST}`, '   Тип вузла . . . . . . . . . . . . : Гібридний', '');
    for (const a of adapters(this.fs)) {
      this.print(`Адаптер ${a.id === 'eth' ? 'Ethernet' : 'бездротової локальної мережі'} ${a.name}:`, '');
      if (a.status === 'disabled' || a.status === 'disconnected') {
        this.print('   Стан носія. . . . . . . . . . . . : Носій відключено', '   DNS-суфікс для підключення . . . :');
        if (all) this.print(`   Опис. . . . . . . . . . . . . . . : ${a.desc}`, `   Фізична адреса. . . . . . . . . . : ${a.mac}`);
        this.print(''); continue;
      }
      this.print(`   DNS-суфікс для підключення . . . : ${a.dhcp ? a.suffix || '' : ''}`);
      if (all) this.print(`   Опис. . . . . . . . . . . . . . . : ${a.desc}`, `   Фізична адреса. . . . . . . . . . : ${a.mac}`, `   DHCP увімкнено. . . . . . . . . . : ${a.dhcp ? 'Так' : 'Ні'}`);
      if (a.status === 'noip') { this.print('   IPv4-адреса . . . . . . . . . . . : 0.0.0.0', '   Основний шлюз . . . . . . . . . . :', ''); continue; }
      this.print(`   IPv4-адреса . . . . . . . . . . . : ${a.ip}`, `   Маска підмережі . . . . . . . . . : ${a.mask}`, `   Основний шлюз . . . . . . . . . . : ${a.gw || ''}`);
      if (all) { if (a.dhcp) this.print(`   DHCP-сервер . . . . . . . . . . . : ${a.net.router}`); this.print(`   DNS-сервери . . . . . . . . . . . : ${a.dns[0] || ''}`, ...a.dns.slice(1).map(d => `                                       ${d}`)); }
      this.print('');
    }
    return true;
  }
  // текст відповіді, коли пакет не доходить
  netFail(r, ip) { return r.err === 'unreach' ? `Відповідь від ${r.via.ip}: Заданий вузол недоступний.` : r.err === 'timeout' ? 'Час очікування запиту минув.' : 'PING: помилка передавання. Загальна помилка.'; }
  // ім’я → IP (DNS + брандмауер). → { ip } або { err }
  lookup(host) {
    const h = lc(host);
    if (h === 'localhost') return { ip: '127.0.0.1' };
    if (h === lc(HOST)) return { ip: primary(this.fs)?.ip || '127.0.0.1' };
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return { ip: h };
    if (!this.dnsOk()) return { err: 'fw' };
    const r = resolveName(this.fs, h, x => (SITES[x] || resolveSite(x))?.[0]);
    return r.ok ? { ip: r.ip } : { err: r.err, server: r.server };
  }
  // ping: відповіді з’являються по одній (stream), -n кількість, -l розмір, -t без зупинки (Ctrl+C)
  c_ping(t) {
    const args = [], o = { n: 4, l: 32, t: false };
    for (let i = 0; i < t.length; i++) {
      const k = t[i].toLowerCase();
      if (k === '-t' || k === '/t') o.t = true;
      else if (k === '-n' || k === '/n') o.n = parseInt(t[++i], 10);
      else if (k === '-l' || k === '/l') o.l = parseInt(t[++i], 10);
      else if (k === '-4' || k === '/4') continue;
      else if (/^[-/]/.test(k)) { this.print(`Неправильний параметр ${t[i]}.`); return false; }
      else args.push(t[i]);
    }
    const host = args[0];
    if (!host) { this.print('', 'Синтаксис: ping [-t] [-n кількість] [-l розмір] адреса', '', '  -t           Надсилати пакети, доки не натиснете Ctrl+C.', '  -n кількість  Скільки разів надіслати (звичайно 4).', '  -l розмір    Розмір пакета в байтах (звичайно 32).'); return false; }
    if (!(o.n >= 1 && o.n <= 100)) { this.print('Неправильне значення параметра -n, допустимо від 1 до 100.'); return false; }
    if (!(o.l >= 0 && o.l <= 65500)) { this.print('Неправильне значення параметра -l, допустимо від 0 до 65500.'); return false; }
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && host.split('.').some(x => +x > 255)) { this.print(`Перевірка зв’язку не змогла знайти вузол ${host}. Перевірте ім’я та повторіть спробу.`); return false; }
    const L = this.lookup(host);
    if (L.err) { this.print(`Перевірка зв’язку не змогла знайти вузол ${host}. Перевірте ім’я та повторіть спробу.`); return false; }
    const ip = L.ip, R = reach(this.fs, ip), local = !!R.local;
    const known = (SITES[lc(host)] || [])[1];
    const base = local ? 0 : R.lan ? 1 : known ?? (ip === '8.8.8.8' ? 12 : ip === '1.1.1.1' ? 11 : 18 + (ip.split('.').reduce((a, b) => a + +b, 0) % 40));
    if (R.lan) arpNote(this.fs, ip); else if (R.ok && !local) arpNote(this.fs, R.via.gw);
    // брандмауер: вихідний луна-запит ICMPv4 від PING.EXE
    const blocked = !local && !this.fwCheck({ dir: 'out', protocol: 'ICMPv4', icmpType: 8, remoteIp: ip, program: PROGRAMS.ping }).allow;
    let sent = 0, got = 0; const times = [];
    const reply = () => {
      sent++;
      if (blocked) return 'PING: помилка передавання. Загальна помилка.';
      if (!R.ok) return this.netFail(R, ip);
      const ms = base + ((sent * 7) % 5) + Math.floor(o.l / 1500);
      got++; times.push(ms);
      return `Відповідь від ${ip}: число байтів=${o.l} час${local ? '<1мс' : '=' + ms + 'мс'} TTL=${local ? 128 : base <= 1 ? 64 : 57}`;
    };
    const stats = () => {
      const lost = sent - got;
      const out = ['', `Статистика Ping для ${ip}:`, `    Пакетів: надіслано = ${sent}, отримано = ${got}, втрачено = ${lost}`, `    (${sent ? Math.round(lost / sent * 100) : 0}% втрат)`];
      if (got) out.push('Приблизний час прийому-передачі в мс:', `    Мінімальний = ${local ? 0 : Math.min(...times)}мс, Максимальний = ${local ? 0 : Math.max(...times)}мс, Середній = ${local ? 0 : Math.round(times.reduce((a, b) => a + b, 0) / times.length)}мс`);
      return out;
    };
    this.print('', `Обмін пакетами з ${host}${ip !== host ? ` [${ip}]` : ''} з ${o.l} байтами даних:`);
    if (this.host.live === false) { for (let i = 0; i < (o.t ? 4 : o.n); i++) this.print(reply()); this.print(...stats()); return got > 0; }
    // у вікні консолі рядки з’являються раз на секунду; Ctrl+C зупиняє -t
    this.flags.stream = { every: !R.ok && R.err === 'timeout' ? 1600 : 700, next: () => (o.t || sent < o.n) ? reply() : null, end: stats, stop: () => [...stats(), 'Control-C', '^C'] };
    return true;
  }
  c_nslookup(t) {
    const host = t.find(x => !x.startsWith('-')), srvArg = t.filter(x => !x.startsWith('-'))[1];
    if (!host) { this.print('Синтаксис: nslookup ім’я_сайту [DNS-сервер]'); return false; }
    const a = primary(this.fs);
    const server = srvArg || a?.dns[0];
    if (!a || !server) { this.print(`*** Не вдається знайти ім’я сервера для адреси: немає ${a ? 'DNS-сервера' : 'підключення до мережі'}.`, '*** Стандартні сервери недоступні'); return false; }
    const names = { '192.168.1.10': 'school-dns.school.local', '8.8.8.8': 'dns.google', '8.8.4.4': 'dns.google', '1.1.1.1': 'one.one.one.one', '192.168.1.1': 'router.school.local', '10.0.0.1': 'router.lan' };
    const sname = names[server] || 'UnKnown';
    const S = netOf(this.fs), saved = S.wifi.dns;
    // nslookup із вказаним сервером питає саме його
    const r = srvArg ? (() => { const a2 = { ...a, dns: [srvArg] }; const isDns = ip => ip === a.net.dns || ip === a.net.router || ['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1', '9.9.9.9'].includes(ip); if (!reach(this.fs, srvArg).ok || !isDns(srvArg)) return { ok: false, err: 'timeout' }; const ip = (SITES[lc(host)] || resolveSite(host))?.[0]; return ip ? { ok: true, ip } : { ok: false, err: 'nx' }; })() : (this.dnsOk() ? resolveName(this.fs, host, x => (SITES[x] || resolveSite(x))?.[0]) : { ok: false, err: 'timeout' });
    if (!r.ok && r.err === 'timeout') { this.print(`DNS request timed out.`, '    timeout was 2 seconds.', `Сервер:  ${sname}`, `Address:  ${server}`, '', `*** Час очікування запиту до ${sname} минув`); return false; }
    this.print(`Сервер:  ${sname}`, `Address:  ${server}`, '');
    if (!r.ok) { this.print(`*** ${sname} не вдається знайти ${host}: Non-existent domain`); return false; }
    this.print('Не заслуговує довіри відповідь:', `Ім’я:    ${lc(host)}`, `Address:  ${r.ip}`);
    return true;
  }
  c_tracert(t) {
    const host = t.find((x, i) => !x.startsWith('-') && !/^-h$/i.test(t[i - 1] || '')), numeric = t.some(x => /^-d$/i.test(x));
    if (!host) { this.print('', 'Синтаксис: tracert [-d] адреса'); return false; }
    const L = this.lookup(host);
    if (L.err) { this.print(`Не вдається визначити ім’я цільової системи ${host}.`); return false; }
    const ip = L.ip, R = reach(this.fs, ip);
    const NAMES = { '192.168.1.1': 'router.school.local', '10.0.0.1': 'router.lan', '100.64.0.1': 'gw.provider.ua', '10.20.0.1': 'core1.provider.ua', '193.25.180.1': 'ua-ix.net' };
    const hopName = h => numeric || !NAMES[h] ? h : `${NAMES[h]} [${h}]`;
    const lines = [];
    if (R.local) lines.push(`  1    <1 мс    <1 мс    <1 мс  ${hopName(ip)}`);
    else if (R.ok) R.hops.forEach((h, i) => { const b = i === 0 ? 1 : 3 + i * 4; lines.push(`${String(i + 1).padStart(3)}  ${String(b).padStart(4)} мс ${String(b + 1).padStart(4)} мс ${String(b).padStart(4)} мс  ${h === ip && ip !== host ? `${host} [${ip}]` : hopName(h)}`); });
    else if (R.err === 'unreach') lines.push(`  1  ${R.via.ip}  повідомляє: Заданий вузол недоступний.`);
    else if (R.err === 'general') lines.push('Помилка передавання: загальна помилка.');
    else { if (R.hops) lines.push(`  1     1 мс     1 мс     1 мс  ${hopName(R.hops[0])}`); for (let i = lines.length; i < 4; i++) lines.push(`${String(i + 1).padStart(3)}     *        *        *     Час очікування запиту минув.`); }
    this.print('', `Трасування маршруту до ${ip !== host ? `${host} [${ip}]` : ip}`, 'з максимальною кількістю переходів 30:', '');
    if (R.ok && !R.local && R.hops?.[0]) arpNote(this.fs, R.hops[0]);
    if (this.host.live === false) { this.print(...lines, '', 'Трасування завершено.'); return R.ok; }
    let i = 0;
    this.flags.stream = { every: 600, next: () => i < lines.length ? lines[i++] : null, end: () => ['', 'Трасування завершено.'], stop: () => ['', 'Control-C', '^C'] };
    return true;
  }
  c_netstat(t) {
    const f = lc(t.join('')), all = f.includes('a'), num = f.includes('n'), prog = f.includes('b');
    const a = primary(this.fs), me = a?.ip;
    const rows = [];
    const host = (ip, port) => (num ? ip : ({ '127.0.0.1': 'localhost', [me]: HOST }[ip] || ip)) + ':' + (num ? port : ({ 443: 'https', 80: 'http', 53: 'domain', 445: 'microsoft-ds', 135: 'epmap', 139: 'netbios-ssn', 3389: 'ms-wbt-server' }[port] || port));
    if (all) for (const [p, port, pr] of [['TCP', 135, 'svchost.exe'], ['TCP', 445, 'System'], ['TCP', 5040, 'svchost.exe'], ['TCP', 7680, 'svchost.exe'], ['UDP', 5353, 'svchost.exe'], ['UDP', 5355, 'svchost.exe']]) rows.push([p, host('0.0.0.0', port), p === 'TCP' ? '0.0.0.0:0' : '*:*', p === 'TCP' ? 'LISTENING' : '', pr]);
    if (me) {
      const ev = fwOf(this.fs).events.filter(e => e.dir === 'out' && e.allow && e.protocol === 'TCP').slice(0, 6);
      ev.forEach((e, i) => rows.push(['TCP', host(me, 50000 + i * 7), host(e.remoteIp, e.remotePort), i < 2 ? 'ESTABLISHED' : 'TIME_WAIT', (e.program || '').split('\\').pop() || 'browser.exe']));
      rows.push(['TCP', host(me, 49712), host('52.112.120.10', 443), 'ESTABLISHED', 'ms-teams.exe'], ['TCP', host(me, 49733), host('13.107.42.14', 443), 'ESTABLISHED', 'OneDrive.exe']);
    }
    this.print('', 'Активні підключення', '', '  Протокол  Локальна адреса          Зовнішня адреса          Стан');
    for (const r of rows) { this.print(`  ${r[0].padEnd(9)} ${r[1].padEnd(24)} ${r[2].padEnd(24)} ${r[3]}`); if (prog) this.print(` [${r[4]}]`); }
    if (!me) this.print('', '  Немає активного мережевого підключення.');
    return true;
  }
  c_arp(t) {
    if (!/^-a$|^\/a$|^-g$/i.test(t[0] || '')) { this.print('', 'Показує таблицю ARP — відповідність IP-адрес і MAC-адрес сусідів.', '', '  ARP -a'); return !t.length; }
    const a = primary(this.fs);
    if (!a) { this.print('Записів ARP не знайдено.'); return true; }
    const S = netOf(this.fs), list = Object.entries(S.arp).filter(([ip]) => sameNet(a.ip, ip, a.mask));
    const bc = a.ip.split('.').slice(0, 3).join('.') + '.255';
    this.print('', `Інтерфейс: ${a.ip} --- 0x${a.id === 'eth' ? 7 : 12}`, '  Адреса в Інтернеті   Фізична адреса        Тип');
    for (const [ip, mac] of list) this.print(`  ${ip.padEnd(20)} ${mac.padEnd(21)} динамічний`);
    for (const [ip, mac] of [[bc, 'ff-ff-ff-ff-ff-ff'], ['224.0.0.22', '01-00-5e-00-00-16'], ['224.0.0.251', '01-00-5e-00-00-fb'], ['239.255.255.250', '01-00-5e-7f-ff-fa'], ['255.255.255.255', 'ff-ff-ff-ff-ff-ff']]) this.print(`  ${ip.padEnd(20)} ${mac.padEnd(21)} статичний`);
    return true;
  }
  c_getmac(t) {
    const v = /\/v/i.test(t[0] || '');
    if (v) { this.print('', 'Ім’я підключення  Мережевий адаптер                   Фізична адреса      Ім’я транспорту', '================= =================================== =================== =========================================================='); for (const a of adapters(this.fs)) this.print(`${a.name.padEnd(17)} ${a.desc.slice(0, 35).padEnd(35)} ${a.mac.padEnd(19)} ${a.status === 'connected' || a.status === 'noip' ? '\\Device\\Tcpip_{' + (a.id === 'eth' ? '4D36E972' : '7A1B2C3D') + '}' : 'Носій відключено'}`); return true; }
    this.print('', 'Фізична адреса      Ім’я транспорту', '=================== ==========================================================');
    for (const a of adapters(this.fs)) this.print(`${a.mac.padEnd(19)} ${a.status === 'connected' || a.status === 'noip' ? '\\Device\\Tcpip_{' + (a.id === 'eth' ? '4D36E972' : '7A1B2C3D') + '}' : 'Носій відключено'}`);
    return true;
  }
  c_route(t) {
    if (lc(t[0] || '') !== 'print') { this.print('', 'Використання: ROUTE PRINT'); return false; }
    const a = primary(this.fs);
    this.print('===========================================================================', 'Таблиця маршрутів IPv4', '===========================================================================', 'Активні маршрути:', 'Мережа призначення    Маска мережі      Шлюз              Інтерфейс       Метрика');
    if (a) {
      const net = a.ip.split('.').slice(0, 3).join('.') + '.0';
      if (a.gw) this.print(`          0.0.0.0          0.0.0.0  ${a.gw.padStart(15)}  ${a.ip.padStart(14)}     25`);
      this.print(`${net.padStart(17)}  ${a.mask.padStart(15)}         На зв’язку  ${a.ip.padStart(14)}    281`);
    }
    this.print('        127.0.0.0        255.0.0.0         На зв’язку       127.0.0.1    331', '===========================================================================');
    if (a && !a.gw) this.print('', 'Немає маршруту за замовчуванням (0.0.0.0): основний шлюз не вказано, тож в інтернет пакети не підуть.');
    return true;
  }
  // брандмауер
  fwCheck(pkt) { const res = evaluate(fwOf(this.fs), pkt); record(this.fs, pkt, res); return res; }
  dnsOk() { return this.fwCheck({ dir: 'out', protocol: 'UDP', localPort: 52000 + Math.floor(Math.random() * 999), remotePort: 53, remoteIp: NET.dns, program: PROGRAMS.svchost }).allow; }
  needAdmin() { if (this.admin) return true; this.print('Запитана операція вимагає підвищення прав (Запустити від імені адміністратора).', ''); return false; }
  c_wfmsc() { this.host.open?.('wfmsc'); return true; }
  c_firewallcpl() { this.host.open?.('firewallcpl'); return true; }
  c_defender() { this.host.open?.('security'); return true; }
  c_control(t) {
    const a = lc(t.join(' '));
    if (!a) { this.print('Панель керування в навчальному комп’ютері — це брандмауер: control firewall.cpl'); return true; }
    if (a.includes('firewall')) { this.host.open?.('firewallcpl'); return true; }
    this.print(`Не вдається знайти «${t.join(' ')}».`); return false;
  }
  // curl: HTTP-запит до сайту (вихідне TCP-підключення від curl.exe)
  c_curl(t) {
    const head = t.some(x => /^-(I|-head)$/.test(x)), url = t.find(x => !x.startsWith('-'));
    if (!url) { this.print('curl: спробуйте «curl --help» або «curl edvault.online»'); return false; }
    const m = /^(?:(https?):\/\/)?([^/:\s]+)(?::(\d+))?(\/.*)?$/i.exec(url);
    if (!m) { this.print(`curl: (3) URL using bad/illegal format or missing URL`); return false; }
    const proto = (m[1] || 'https').toLowerCase(), host = lc(m[2]), port = +(m[3] || (proto === 'http' ? 80 : 443));
    const local = ['localhost', '127.0.0.1', lc(HOST)].includes(host);
    const L = local ? { ip: '127.0.0.1' } : this.lookup(host);
    if (L.err) { this.print(`curl: (6) Could not resolve host: ${host}`); return false; }
    const ip = L.ip;
    if (local) { this.print(`curl: (7) Failed to connect to ${host} port ${port} after 0 ms: Could not connect to server`); return false; }
    const res = this.fwCheck({ dir: 'out', protocol: 'TCP', localPort: 49152 + Math.floor(Math.random() * 9000), remotePort: port, remoteIp: ip, program: PROGRAMS.curl });
    if (!res.allow) { this.print(`curl: (28) Failed to connect to ${host} port ${port} after 21046 ms: Timed out`); return false; }
    const R = reach(this.fs, ip);
    if (!R.ok) { this.print(R.err === 'timeout' ? `curl: (28) Failed to connect to ${host} port ${port} after 21046 ms: Timed out` : `curl: (7) Failed to connect to ${host} port ${port} after 0 ms: Could not connect to server`); return false; }
    if (![80, 443, 8080].includes(port)) { this.print(`curl: (7) Failed to connect to ${host} port ${port} after 31 ms: Could not connect to server`); return false; }
    if (head) { this.print(`HTTP/1.1 200 OK`, `Server: ${host === 'edvault.online' ? 'GitHub.com' : 'nginx'}`, 'Content-Type: text/html; charset=utf-8', `Date: ${new Date().toUTCString()}`, 'Cache-Control: max-age=600', ''); return true; }
    this.print('<!DOCTYPE html>', '<html lang="uk">', `<head><meta charset="utf-8"><title>${host}</title></head>`, `<body><h1>Вітаємо на ${host}!</h1></body>`, '</html>');
    return true;
  }
  // netsh advfirewall — брандмауер із командного рядка
  c_netsh(t) {
    const L = t.map(x => lc(x)), fw = fwOf(this.fs);
    const kv = list => { const o = {}; for (const x of list) { const i = x.indexOf('='); if (i > 0) o[lc(x.slice(0, i))] = x.slice(i + 1); } return o; };
    const ok = () => { this.print('ОК.', ''); return true; };
    if (!L.length || L[0] === '/?' || L[0] === 'help') { this.print('', 'Використання: netsh advfirewall …', '', '  netsh advfirewall show allprofiles            — стан брандмауера в усіх профілях', '  netsh advfirewall set allprofiles state off   — вимкнути (on — увімкнути)', '  netsh advfirewall firewall show rule name=all  — усі правила', '  netsh advfirewall firewall add rule name="Мій сайт" dir=out action=block remoteip=8.8.8.8', '  netsh advfirewall firewall delete rule name="Мій сайт"', '  netsh advfirewall reset                        — стандартні параметри', '', 'Змінювати параметри можна лише в командному рядку від імені адміністратора.'); return true; }
    if (L[0] === 'interface' || L[0] === 'int') {
      for (const ad of adapters(this.fs)) {
        this.print('', `Конфігурація для інтерфейсу "${ad.name}"`);
        if (ad.status === 'disabled' || ad.status === 'disconnected') { this.print('    Стан:                                   Відключено'); continue; }
        this.print(`    DHCP увімкнено:                         ${ad.dhcp ? 'Так' : 'Ні'}`, `    IP-адреса:                              ${ad.ip || '—'}`, ad.mask ? `    Префікс підмережі:                      ${ad.ip.split('.').slice(0, 3).join('.')}.0/${prefixOf(ad.mask)} (маска ${ad.mask})` : '', `    Основний шлюз:                          ${ad.gw || '—'}`, `    DNS-сервери${ad.dhcp && !ad.manual ? ', налаштовані через DHCP' : ' (статичні)'}:  ${ad.dns.join(', ') || 'немає'}`);
      }
      this.print(''); return true;
    }
    if (L[0] === 'wlan') {
      const S = netOf(this.fs);
      if (L[1] === 'show' && /^network/.test(L[2] || '')) { if (!S.wifi.on) { this.print('Бездротову мережу вимкнено.'); return false; } this.print('', `Ім’я інтерфейсу : Бездротова мережа`, `Видно мереж: ${WIFI.length}`, ''); WIFI.forEach((w, i) => this.print(`SSID ${i + 1} : ${w.ssid}`, `    Тип мережі              : Інфраструктура`, `    Автентифікація          : ${w.sec}`, `    Сигнал                  : ${w.signal * 24 + 3}%`, '')); return true; }
      if (L[1] === 'show' && /^interface/.test(L[2] || '')) { const ad = adapters(this.fs)[1]; this.print('', 'На комп’ютері є 1 інтерфейс:', '', `    Ім’я                   : Бездротова мережа`, `    Опис                   : ${ad.desc}`, `    Фізична адреса         : ${ad.mac.toLowerCase().replace(/-/g, ':')}`, `    Стан                   : ${ad.ssid ? 'підключено' : ad.on ? 'відключено' : 'вимкнено'}`, ...(ad.ssid ? [`    SSID                   : ${ad.ssid}`, `    Сигнал                 : ${WIFI.find(w => w.ssid === ad.ssid).signal * 24 + 3}%`] : []), ''); return true; }
      if (L[1] === 'show' && /^profile/.test(L[2] || '')) { const p = Object.keys(S.wifi.saved); this.print('', 'Профілі користувача', '-------------------', ...(p.length ? p.map(x => `    Профіль усіх користувачів : ${x}`) : ['    <немає>']), ''); return true; }
      if (L[1] === 'connect') { const name = kv(t.slice(2)).name || kv(t.slice(2)).ssid; if (!name) { this.print('Укажіть ім’я мережі: netsh wlan connect name=SCHOOL-WIFI'); return false; } const ssid = WIFI.find(w => lc(w.ssid) === lc(name))?.ssid; if (!ssid || !S.wifi.saved[ssid] && WIFI.find(w => w.ssid === ssid).pass) { this.print(`На інтерфейсі «Бездротова мережа» немає профілю «${name}». Спершу підключіться через значок мережі й збережіть пароль.`); return false; } const r = wifiConnect(this.fs, ssid); if (!r.ok) { this.print(r.err); return false; } syncNET(this.fs); this.fs.emit('net'); this.print('Запит на підключення успішно виконано.'); return true; }
      if (L[1] === 'disconnect') { wifiDisconnect(this.fs); syncNET(this.fs); this.fs.emit('net'); this.print('Запит на відключення від інтерфейсу «Бездротова мережа» успішно виконано.'); return true; }
      this.print('', 'netsh wlan show networks | show interfaces | show profiles | connect name=… | disconnect'); return false;
    }
    if (L[0] !== 'advfirewall') { this.print(`Не вдалося знайти таку команду: ${t.join(' ')}`, 'Наберіть «netsh /?», щоб побачити підказку.'); return false; }
    const which = w => ({ allprofiles: PROFILES, currentprofile: [NET.profile], domainprofile: ['domain'], privateprofile: ['private'], publicprofile: ['public'] }[w]);
    if (L[1] === 'show') {
      const ps = which(L[2]); if (!ps) { this.print('Неправильний профіль. Допустимо: allprofiles, currentprofile, domainprofile, privateprofile, publicprofile.'); return false; }
      for (const p of ps) {
        const c = fw.profiles[p];
        this.print('', `Параметри профілю «${PROFILE_NAME[p]}»${p === NET.profile ? ' (поточний)' : ''}:`, '-'.repeat(70), `Стан                                  ${c.on ? 'УВІМКНЕНО' : 'ВИМКНЕНО'}`);
        if (L[3] === 'state') continue;
        this.print(`Політика брандмауера                  ${c.inbound === 'allow' ? 'AllowInbound' : c.inbound === 'blockall' ? 'BlockInboundAlways' : 'BlockInbound'},${c.outbound === 'allow' ? 'AllowOutbound' : 'BlockOutbound'}`, `Сповіщення про вхідні підключення     ${c.notify ? 'Увімкнути' : 'Вимкнути'}`, `Одноадресна відповідь на розсилку     ${c.unicast ? 'Увімкнути' : 'Вимкнути'}`, '', 'Ведення журналу:', `Записувати дозволені підключення      ${c.log.success ? 'Увімкнути' : 'Вимкнути'}`, `Записувати пропущені підключення      ${c.log.dropped ? 'Увімкнути' : 'Вимкнути'}`, `Ім’я файлу                            ${c.log.path}`, `Макс. розмір файлу                    ${c.log.size}`);
      }
      return ok();
    }
    if (L[1] === 'set') {
      const ps = which(L[2]); if (!ps) { this.print('Неправильний профіль. Допустимо: allprofiles, currentprofile, domainprofile, privateprofile, publicprofile.'); return false; }
      if (!this.needAdmin()) return false;
      if (L[3] === 'state' && ['on', 'off'].includes(L[4])) ps.forEach(p => { fw.profiles[p].on = L[4] === 'on'; });
      else if (L[3] === 'firewallpolicy' && L[4]) {
        const [i, o] = L[4].split(',');
        const iv = { blockinbound: 'block', blockinboundalways: 'blockall', allowinbound: 'allow' }[i], ov = { allowoutbound: 'allow', blockoutbound: 'block' }[o];
        if (!iv || !ov) { this.print('Неправильне значення. Приклад: firewallpolicy blockinbound,allowoutbound'); return false; }
        ps.forEach(p => { fw.profiles[p].inbound = iv; fw.profiles[p].outbound = ov; });
      } else if (L[3] === 'logging' && ['droppedconnections', 'allowedconnections'].includes(L[4]) && ['enable', 'disable'].includes(L[5])) ps.forEach(p => { fw.profiles[p].log[L[4] === 'droppedconnections' ? 'dropped' : 'success'] = L[5] === 'enable'; });
      else if (L[3] === 'logging' && L[4] === 'maxfilesize' && +L[5] >= 1 && +L[5] <= 32767) ps.forEach(p => { fw.profiles[p].log.size = +L[5]; });
      else { this.print('Неправильний параметр. Приклади:', '  netsh advfirewall set allprofiles state on', '  netsh advfirewall set publicprofile firewallpolicy blockinbound,allowoutbound', '  netsh advfirewall set currentprofile logging droppedconnections enable'); return false; }
      this.fs.emit('fw'); return ok();
    }
    if (L[1] === 'reset') { if (!this.needAdmin()) return false; this.fs.s.fw = fwDefaults(); this.fs.emit('fw'); return ok(); }
    if (L[1] !== 'firewall') { this.print(`Не вдалося знайти таку команду: ${t.join(' ')}`); return false; }
    const o = kv(t.slice(3));
    const pick = () => fw.rules.filter(r => (lc(o.name) === 'all' || lc(r.name.trim()) === lc((o.name || '').trim())) && (!o.dir || r.dir === lc(o.dir)));
    if (L[2] === 'show' && L[3]?.startsWith('rule')) {
      if (!o.name) { this.print('Не вказано name=. Приклад: netsh advfirewall firewall show rule name=all'); return false; }
      const list = pick().filter(r => !o.profile || lc(o.profile) === 'any' || r.profiles === 'any' || r.profiles.includes(lc(o.profile)));
      if (!list.length) { this.print('Не знайдено правил, що відповідають указаним умовам.'); return false; }
      for (const r of list) this.print('', `Ім’я правила:                         ${r.name.trim()}`, '-'.repeat(70), `Увімкнено:                            ${r.enabled ? 'Так' : 'Ні'}`, `Напрямок:                             ${r.dir === 'in' ? 'Вхідні' : 'Вихідні'}`, `Профілі:                              ${profilesText(r)}`, `Групування:                           ${r.group}`, `Локальна IP-адреса:                   ${addrText(r.localAddr)}`, `Віддалена IP-адреса:                  ${addrText(r.remoteAddr)}`, `Протокол:                             ${protoText(r.protocol)}`, ...(r.protocol === 'TCP' || r.protocol === 'UDP' ? [`Локальний порт:                       ${portsText(r.localPorts)}`, `Віддалений порт:                      ${portsText(r.remotePorts)}`] : []), `Обхід через межу:                     ${r.edge === 'allow' ? 'Так' : 'Ні'}`, ...(o.verbose != null || L.includes('verbose') ? [`Програма:                             ${r.program === 'any' ? 'Будь-яка' : r.program}`, `Опис:                                 ${r.desc}`] : []), `Дія:                                  ${actionText(r.action)}`);
      return ok();
    }
    if (!['add', 'delete', 'set'].includes(L[2]) || !L[3]?.startsWith('rule')) { this.print(`Не вдалося знайти таку команду: ${t.join(' ')}`, 'Підказка: netsh advfirewall /?'); return false; }
    if (!this.needAdmin()) return false;
    if (L[2] === 'delete') {
      if (!o.name) { this.print('Не введено один або кілька обов’язкових параметрів (name=).'); return false; }
      const list = pick(); if (!list.length) { this.print('Не знайдено правил, що відповідають указаним умовам.'); return false; }
      fw.rules = fw.rules.filter(r => !list.includes(r)); this.fs.emit('fw');
      this.print('', `Видалено правил: ${list.length}.`); return ok();
    }
    // спільна перевірка параметрів правила
    const build = (r, src) => {
      if (src.dir) { if (!['in', 'out'].includes(lc(src.dir))) return 'dir= має бути in або out.'; r.dir = lc(src.dir); }
      if (src.action) { const a = { allow: 'allow', block: 'block', bypass: 'secure' }[lc(src.action)]; if (!a) return 'action= має бути allow, block або bypass.'; r.action = a; }
      if (src.protocol) { const pr = { any: 'any', tcp: 'TCP', udp: 'UDP', icmpv4: 'ICMPv4', icmpv6: 'ICMPv6', '6': 'TCP', '17': 'UDP', '1': 'ICMPv4' }[lc(src.protocol)]; if (!pr) return 'protocol= має бути any, tcp, udp, icmpv4 або icmpv6.'; r.protocol = pr; }
      for (const [k, f] of [['localport', 'localPorts'], ['remoteport', 'remotePorts']]) if (src[k] != null) {
        if (lc(src[k]) === 'any') { r[f] = 'any'; continue; }
        if (r.protocol !== 'TCP' && r.protocol !== 'UDP') return 'Порти можна вказувати лише для протоколів TCP і UDP (protocol=tcp або protocol=udp).';
        if (!validPorts(src[k])) return `Неправильний номер порту: ${src[k]}. Порт — число від 1 до 65535.`;
        r[f] = src[k].replace(/\s/g, '');
      }
      for (const [k, f] of [['remoteip', 'remoteAddr'], ['localip', 'localAddr']]) if (src[k] != null) {
        if (lc(src[k]) === 'any') { r[f] = 'any'; continue; }
        const list = src[k].split(',').map(x => x.trim()); const bad = list.find(x => !validAddr(x)); if (bad) return `Неправильна IP-адреса: ${bad}`; r[f] = list;
      }
      if (src.program) r.program = lc(src.program) === 'any' ? 'any' : src.program;
      if (src.enable) { if (!['yes', 'no'].includes(lc(src.enable))) return 'enable= має бути yes або no.'; r.enabled = lc(src.enable) === 'yes'; }
      if (src.profile) { const ps = lc(src.profile).split(',').map(x => x.trim()); if (ps.includes('any')) r.profiles = 'any'; else { if (ps.some(x => !PROFILES.includes(x))) return 'profile= має бути any, domain, private або public.'; r.profiles = PROFILES.filter(x => ps.includes(x)); } }
      if (src.description != null) r.desc = src.description;
      if (src.edge) r.edge = lc(src.edge) === 'yes' ? 'allow' : 'block';
      return null;
    };
    if (L[2] === 'add') {
      if (!o.name || !o.dir || !o.action) { this.print('Не введено один або кілька обов’язкових параметрів: name=, dir= і action=.', 'Приклад: netsh advfirewall firewall add rule name="Блок Google" dir=out action=block remoteip=142.250.74.110'); return false; }
      const r = { id: newId(fw), name: o.name, desc: '', group: '', dir: 'in', enabled: true, action: 'allow', profiles: 'any', program: 'any', service: 'any', protocol: 'any', localPorts: 'any', remotePorts: 'any', icmp: 'any', localAddr: 'any', remoteAddr: 'any', edge: 'block', iface: 'all', predefined: false };
      if (o.protocol) { const e = build(r, { protocol: o.protocol }); if (e) { this.print(e); return false; } }
      const e = build(r, o); if (e) { this.print(e); return false; }
      fw.rules.push(r); this.fs.emit('fw');
      return ok();
    }
    // set rule name=… new …
    const ni = L.indexOf('new'); if (ni < 0 || !o.name) { this.print('Синтаксис: netsh advfirewall firewall set rule name="…" new enable=yes'); return false; }
    const sel = kv(t.slice(3, ni)), upd = kv(t.slice(ni + 1));
    const list = fw.rules.filter(r => lc(r.name.trim()) === lc((sel.name || '').trim()) && (!sel.dir || r.dir === lc(sel.dir)));
    if (!list.length) { this.print('Не знайдено правил, що відповідають указаним умовам.'); return false; }
    for (const r of list) { const e = build(r, upd); if (e) { this.print(e); return false; } }
    this.fs.emit('fw');
    this.print('', `Оновлено правил: ${list.length}.`); return ok();
  }
  c_set(t, rest) {
    const s = rest.trim();
    const v = this.vars();
    if (!s || !s.includes('=')) {
      const keys = Object.keys(v).filter(k => !['CD', 'DATE', 'TIME', 'RANDOM', 'ERRORLEVEL'].includes(k)).sort().filter(k => k.startsWith(s.toUpperCase()));
      if (!keys.length) { this.print(`Змінну середовища ${s} не визначено`); return false; }
      for (const k of keys) this.print(`${k}=${v[k]}`);
      return true;
    }
    const i = s.indexOf('='), k = s.slice(0, i).trim().toUpperCase(), val = s.slice(i + 1);
    if (!k) { this.print('Синтаксична помилка в команді.'); return false; }
    if (val === '') delete this.env[k]; else this.env[k] = val;
    return true;
  }
  c_doskey(t) { if (/history/i.test(t[0] || '')) this.print(...this.history.slice(0, -1)); return true; }
  c_help(t) {
    const k = lc(t[0] || '');
    if (!k) {
      this.print('Щоб дізнатися більше про команду, наберіть HELP назва_команди або назва_команди /?', '');
      for (const c of COMMANDS) this.print(c.toUpperCase().padEnd(12) + info(c)[0]);
      this.print('', 'Також: C: або D: — перейти на інший диск. Стрілки ↑ ↓ — попередні команди, Tab — доповнити назву.');
      return true;
    }
    const h = info(k);
    if (!h) { this.print('Ця команда не підтримується. Список команд — HELP.'); return false; }
    this.print(h[0], '', h[1], '');
    if (h[3]) this.print(h[3], '');
    this.print('Приклади:', ...h[2].map(x => '  ' + x));
    return true;
  }

  // Доповнення через Tab: повертає новий рядок
  complete(line) {
    const m = /^(.*?)("?)([^"\s]*)$/.exec(line);
    if (!m) return line;
    const [, head, q, word] = m;
    if (!head.trim() && !q) {
      const c = COMMANDS.filter(x => x.startsWith(lc(word)));
      return c.length === 1 ? c[0] + ' ' : line;
    }
    const full = this.path(word || '.');
    const dirP = word.endsWith('\\') || !word ? full : parentPath(full) || full;
    const prefix = word.endsWith('\\') || !word ? '' : nameOfPath(full);
    if (!this.fs.isDir(dirP)) return line;
    const cands = this.fs.dirNode(dirP).children.filter(c => !c.attrs.h && lc(c.name).startsWith(lc(prefix)));
    if (!cands.length) return line;
    if (!this.tab || this.tab.base !== line) this.tab = { base: line, i: 0 };
    const pick = cands.sort((a, b) => a.name.localeCompare(b.name, 'uk'))[this.tab.i++ % cands.length];
    const before = word.includes('\\') ? word.slice(0, word.lastIndexOf('\\') + 1) : '';
    const name = before + pick.name;
    const res = head + (/\s/.test(name) ? `"${name}"` : name);
    this.tab.base = res;
    return res;
  }
}

// ren *.txt *.md: замінює частини назви за шаблоном
export function wildRename(name, pattern) {
  const [nb, ne = ''] = splitExt(name), [pb, pe = null] = splitExt(pattern);
  const apply = (src, pat) => pat === '*' ? src : pat.replace(/\?/g, (_, i) => src[i] ?? '').replace(/\*/g, src);
  return apply(nb, pb) + (pe == null ? (pattern.includes('.') ? '' : (ne ? '.' + ne : '')) : '.' + apply(ne, pe));
}
function splitExt(n) { const i = n.lastIndexOf('.'); return i > 0 ? [n.slice(0, i), n.slice(i + 1)] : [n]; }

// Відомі сайти: [IP-адреса, звичайна затримка в мс]
export const SITES = { 'edvault.online': ['185.199.108.153', 18], 'www.edvault.online': ['185.199.108.153', 18], 'google.com': ['142.250.74.110', 14], 'www.google.com': ['142.250.74.110', 14], 'youtube.com': ['142.250.74.46', 15], 'wikipedia.org': ['185.15.59.224', 31], 'ukr.net': ['212.42.76.252', 9], 'school.local': ['192.168.1.10', 1], localhost: ['127.0.0.1', 0], 'poshuk.edvault': ['185.199.110.20', 16], 'novyny.edvault': ['185.199.110.21', 17], 'shkola.edvault': ['185.199.110.22', 15], 'fayly.edvault': ['185.199.110.23', 18], 'pogoda.edvault': ['185.199.110.24', 16], 'dovidka.edvault': ['185.199.110.25', 17], 'pryz-vygraj.edvault': ['45.11.20.99', 63] };
// Будь-який правильно записаний сайт «існує»: стала IP-адреса й затримка з назви (щоразу однакові)
const TLD = ['com', 'net', 'org', 'ua', 'edu', 'gov', 'io', 'info', 'online', 'укр', 'de', 'uk', 'pl', 'eu', 'app', 'dev', 'me', 'tv', 'fm', 'ai', 'site', 'store', 'school', 'local'];
export function resolveSite(host) {
  const h = lc(String(host)).replace(/\.$/, '');
  if (!/^(?:[\p{L}\d](?:[\p{L}\d-]{0,61}[\p{L}\d])?\.)+[\p{L}]{2,}$/u.test(h) || !TLD.includes(h.split('.').at(-1))) return null;
  let x = 2166136261; for (const c of h) x = Math.imul(x ^ c.codePointAt(0), 16777619) >>> 0;
  const ip = [[31, 77, 91, 104, 142, 151, 172, 176, 185, 193, 195, 212][x % 12], 16 + (x >>> 4) % 200, (x >>> 12) % 256, 1 + (x >>> 20) % 254].join('.');
  return [ip, h.endsWith('.ua') || h.endsWith('.укр') ? 6 + x % 14 : 18 + x % 45];
}
