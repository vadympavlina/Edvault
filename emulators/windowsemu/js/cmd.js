// Емулятор Windows · командний рядок (cmd) без DOM. Працює з файловою системою FS,
// а відкриття вікон, список і закриття задач — через host (його дає інтерфейс).
import { FS, ERR, FsError, HOME, USER, DRIVE_LABEL, resolve, parsePath, parentPath, nameOfPath, joinPath, wildcard, hasWild, isInside, fmtDate, fmtTime, fmtNum, isText, validName } from './fs.js';

export const HOST = 'SCHOOL-PC';
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
  ipconfig: ['Показує мережеві налаштування.', 'IPCONFIG [/ALL]', ['ipconfig']],
  md: ['Створює папку (одразу з усіма вкладеними).', 'MD шлях [шлях …]', ['md Проєкти', 'md "Нова папка"', 'md Школа\\2026\\Вересень', 'md A B C'], 'Назву з пробілами беріть у лапки.'],
  mkdir: 'md',
  more: ['Показує текст (по сторінках у справжньому Windows).', 'MORE файл\nкоманда | MORE', ['more Розклад.txt', 'tree | more']],
  move: ['Переміщає файли й папки або перейменовує їх.', 'MOVE [/Y] джерело призначення', ['move Нотатки.txt Школа', 'move *.jpg ..\\Pictures', 'move Школа Навчання'], 'Якщо призначення — існуюча папка, елемент переїде в неї. Інакше — отримає нову назву.'],
  notepad: ['Відкриває Блокнот.', 'NOTEPAD [файл]', ['notepad', 'notepad Нотатки.txt', 'notepad новий.txt']],
  path: ['Показує шляхи пошуку програм.', 'PATH', ['path']],
  ping: ['Перевіряє зв’язок з іншим комп’ютером або сайтом.', 'PING [-t] [-n кількість] [-l розмір] адреса', ['ping edvault.online', 'ping 192.168.1.1', 'ping -n 10 google.com', 'ping -t 8.8.8.8'], '-t — надсилати без зупинки (зупинити — Ctrl+C), -n — скільки разів, -l — розмір пакета. Адреси в цій мережі: 192.168.1.1 — роутер, 192.168.1.10 — шкільний сервер.'],
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
  tasklist: ['Показує відкриті програми.', 'TASKLIST', ['tasklist']],
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
    this.cwd = HOME; this.dcwd = { C: HOME, D: 'D:\\' };
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
    const key = lc(name).replace(/\.(exe|com)$/, '');
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
    if (/^https?:\/\//i.test(a)) { this.print('У навчальному комп’ютері немає браузера.'); return false; }
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
  c_tasklist() {
    const tasks = this.host.tasks?.() || [];
    const rows = [{ name: 'System', pid: 4, mem: 144 }, { name: 'explorer.exe', pid: 1024, mem: 98304 }, ...tasks.map(x => ({ ...x, mem: x.mem || 20480 }))];
    this.print('', 'Ім’я образу                    PID   Пам’ять', '========================= ======== ============');
    for (const r of rows) this.print(`${r.name.padEnd(25)} ${String(r.pid).padStart(8)} ${(fmtNum(r.mem).replace(/\u00a0/g, ' ') + ' КБ').padStart(12)}`);
    return true;
  }
  c_taskkill(t) {
    const { flags } = opts(t, ['im', 'pid']);
    const by = flags.im ? { im: lc(String(flags.im)) } : flags.pid ? { pid: +flags.pid } : null;
    if (!by) { this.print('ПОМИЛКА: неправильний синтаксис. Наберіть «TASKKILL /?».'); return false; }
    if (by.im === 'explorer.exe' || by.pid === 1024 || by.pid === 4) { this.print('ПОМИЛКА: не вдалося завершити процес — він потрібен системі.'); return false; }
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
  c_whoami() { this.print(lc(HOST) + '\\' + lc(USER)); return true; }
  c_hostname() { this.print(HOST); return true; }
  c_path() { this.print('PATH=' + this.env.PATH); return true; }
  c_systeminfo() {
    const free = this.fs.free('C');
    this.print('', `Ім’я вузла:                   ${HOST}`, 'Назва ОС:                     Microsoft Windows 11 Освіта', 'Версія ОС:                    10.0.22631 Збірка 22631', `Зареєстрований власник:       ${USER}`, 'Виробник системи:             Edvault', 'Тип системи:                  x64-based PC', 'Процесори:                    1 процесор(и)', 'Повний обсяг фізичної пам’яті: 8 192 МБ', `Вільно на диску C:            ${Math.round(free / 1073741824)} ГБ`, 'Мережеві адаптери:            1 — Ethernet, IP-адреса 192.168.1.27');
    return true;
  }
  c_ipconfig(t) {
    const all = /all/i.test(t[0] || '');
    this.print('', 'Налаштування IP для Windows', '');
    if (all) this.print(`   Ім’я вузла . . . . . . . . . . . : ${HOST}`, '');
    this.print('Адаптер Ethernet Ethernet:', '', '   DNS-суфікс для підключення . . . : school.local');
    if (all) this.print('   Фізична адреса . . . . . . . . . : 00-1A-2B-3C-4D-5E', '   DHCP увімкнено . . . . . . . . . : Так');
    this.print('   IPv4-адреса . . . . . . . . . . . : 192.168.1.27', '   Маска підмережі . . . . . . . . . : 255.255.255.0', '   Основний шлюз . . . . . . . . . . : 192.168.1.1');
    if (all) this.print('   DNS-сервери . . . . . . . . . . . : 192.168.1.10', '                                       8.8.8.8');
    return true;
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
    const KNOWN = { 'edvault.online': ['185.199.108.153', 18], 'www.edvault.online': ['185.199.108.153', 18], 'google.com': ['142.250.74.110', 14], 'www.google.com': ['142.250.74.110', 14], 'youtube.com': ['142.250.74.46', 15], 'wikipedia.org': ['185.15.59.224', 31], 'ukr.net': ['212.42.76.252', 9], 'school.local': ['192.168.1.10', 1], localhost: ['127.0.0.1', 0], [lc(HOST)]: ['192.168.1.27', 0] };
    const IPS = { '127.0.0.1': 0, '192.168.1.27': 0, '192.168.1.1': 1, '192.168.1.10': 1, '8.8.8.8': 12, '1.1.1.1': 11, '185.199.108.153': 18, '142.250.74.110': 14 };
    let ip, base;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      if (host.split('.').some(x => +x > 255)) { this.print(`Перевірка зв’язку не змогла знайти вузол ${host}. Перевірте ім’я та повторіть спробу.`); return false; }
      ip = host; base = IPS[host] ?? (/^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(host) ? null : 40 + (host.split('.').reduce((a, b) => a + +b, 0) % 60));
    } else {
      const k = KNOWN[lc(host)];
      if (!k) { this.print(`Перевірка зв’язку не змогла знайти вузол ${host}. Перевірте ім’я та повторіть спробу.`); return false; }
      [ip, base] = k;
    }
    const local = ip === '127.0.0.1' || ip === '192.168.1.27';
    let sent = 0, got = 0; const times = [];
    const reply = () => {
      sent++;
      if (base == null) return 'Час очікування запиту минув.';
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
    this.flags.stream = { every: base == null ? 1600 : 700, next: () => (o.t || sent < o.n) ? reply() : null, end: stats, stop: () => [...stats(), 'Control-C', '^C'] };
    return true;
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
