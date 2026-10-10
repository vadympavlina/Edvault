// Емулятор Windows · файлова система без DOM (перевіряється тестами).
// Диски C: і D:, справжні шляхи («C:\Users\Учень\Documents»), регістр у назвах не важливий,
// атрибути «прихований» (h) і «лише читання» (r), захищені системні папки, Кошик.

export const USER = 'Учень';
export const HOME = 'C:\\Users\\' + USER;
// Відомі папки: справжня назва → як їх показує Провідник
export const KNOWN = { Desktop: 'Робочий стіл', Documents: 'Документи', Downloads: 'Завантаження', Pictures: 'Зображення', Music: 'Музика', Videos: 'Відео' };
export const DRIVE_LABEL = { C: 'Локальний диск', D: 'Навчання' };
export const DRIVE_SIZE = { C: 256060514304, D: 128034250752 };

export class FsError extends Error {
  constructor(code, msg) { super(msg); this.code = code; }
}
export const ERR = {
  path: () => new FsError('path', 'Системі не вдається знайти вказаний шлях.'),
  file: () => new FsError('file', 'Системі не вдається знайти вказаний файл.'),
  exists: name => new FsError('exists', `Підпапка або файл ${name} вже існує.`),
  notEmpty: () => new FsError('notEmpty', 'Каталог не порожній.'),
  access: () => new FsError('access', 'Відмовлено в доступі.'),
  name: () => new FsError('name', 'Синтаксична помилка в імені файлу, імені папки або мітці тому.'),
  self: () => new FsError('self', 'Неможливо перемістити або скопіювати папку саму в себе.'),
};

const BAD_CHARS = /[\\/:*?"<>|]/;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
export function validName(name) {
  const n = String(name ?? '');
  return !!n.trim() && !BAD_CHARS.test(n) && !RESERVED.test(n) && !/[. ]$/.test(n) && n.length <= 255;
}
export const BAD_NAME_HINT = 'Ім’я файлу не може містити жоден із цих символів: \\ / : * ? " < > |';
export const extOf = name => { const i = name.lastIndexOf('.'); return i > 0 ? name.slice(i + 1).toLowerCase() : ''; };
export const baseOf = name => { const i = name.lastIndexOf('.'); return i > 0 ? name.slice(0, i) : name; };
const lc = s => s.toLocaleLowerCase('uk');

// Шаблон з * і ? (без урахування регістру)
export function wildcard(pattern) {
  const re = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp('^' + re + '$', 'i');
}
export const hasWild = s => /[*?]/.test(s);

/* ── шляхи ── */
export function parsePath(p) {
  const m = /^([A-Za-z]):(.*)$/.exec(p);
  if (!m) return null;
  return { drive: m[1].toUpperCase(), parts: m[2].split('\\').filter(Boolean) };
}
export const joinPath = (drive, parts) => drive + ':\\' + parts.join('\\');
export function parentPath(p) { const x = parsePath(p); return x.parts.length ? joinPath(x.drive, x.parts.slice(0, -1)) : null; }
export function nameOfPath(p) { const x = parsePath(p); return x.parts.at(-1) || x.drive + ':'; }
// Шлях відносно поточної папки: «..», «.», «\», «D:», «D:\x», лапки вже зняті
export function resolve(cwd, input) {
  let p = String(input ?? '').trim().replace(/\//g, '\\');
  const c = parsePath(cwd);
  let drive = c.drive, parts;
  if (/^[A-Za-z]:/.test(p)) { drive = p[0].toUpperCase(); const rest = p.slice(2); parts = rest.startsWith('\\') || !rest ? [] : (drive === c.drive ? [...c.parts] : []); p = rest; }
  else if (p.startsWith('\\')) parts = [];
  else parts = [...c.parts];
  for (const seg of p.split('\\')) {
    if (!seg || seg === '.') continue;
    if (/^\.{2,}$/.test(seg)) { parts.pop(); continue; }
    parts.push(seg.replace(/[. ]+$/, '') || seg);
  }
  return joinPath(drive, parts);
}
export function isInside(child, parent) {
  const a = lc(child), b = lc(parent.replace(/\\$/, ''));
  return a === b || a.startsWith(b + '\\');
}

/* ── початковий стан ── */
const T0 = Date.UTC(2026, 8, 1, 7, 30);
let seqInit = 0;
function mk(name, type, extra = {}, t = T0) {
  return { id: 'n' + (++seqInit), name, type, created: t, modified: t, attrs: { h: false, r: false, s: false }, ...(type === 'dir' ? { children: [] } : { content: '', size: 0 }), ...extra };
}
function dir(name, kids = [], extra) { const d = mk(name, 'dir', extra); d.children = kids; return d; }
function txt(name, content, extra) { return mk(name, 'file', { content, ...extra }); }
function bin(name, size, extra) { return mk(name, 'file', { size, binary: true, ...extra }); }
const sys = { attrs: { h: false, r: true, s: true } };
export function initialState() {
  seqInit = 0;
  const C = dir('C:', [
    dir('Program Files', [dir('Browser', [bin('browser.exe', 3145728, sys)], sys), dir('Edvault', [txt('readme.txt', 'Навчальний комп’ютер Edvault.\r\nТут можна сміливо пробувати — нічого не зламаєш.', sys)], sys), dir('Windows NT', [dir('Accessories', [bin('wordpad.exe', 4505600, sys)], sys)], sys)], sys),
    dir('Users', [
      dir(USER, [
        dir('Desktop', [
          txt('Привіт.txt', 'Привіт! Це твій навчальний комп’ютер.\r\n\r\nВідкрий «Командний рядок» і напиши help — побачиш усі команди.\r\nУсе, що ти створиш, видалиш чи перемістиш, одразу видно в Провіднику.'),
          dir('Домашнє завдання', [bin('Математика.docx', 18432), txt('Що задали.txt', 'Математика: № 214–218\r\nІсторія: параграф 12\r\nАнглійська: вивчити слова')]),
        ]),
        dir('Documents', [
          bin('Реферат з історії.docx', 52224), txt('Нотатки.txt', 'Купити зошити в клітинку.\r\nВзяти форму на фізкультуру.'),
          dir('Школа', [txt('Розклад.txt', 'Понеділок: математика, українська, історія\r\nВівторок: англійська, біологія, інформатика\r\nСереда: фізика, географія, фізкультура'), bin('Оцінки.xlsx', 9216)]),
        ]),
        dir('Downloads', [bin('фото_з_екскурсії.jpg', 2457600), bin('пісня.mp3', 4194304), bin('презентація.pptx', 1048576), bin('архів.zip', 3145728), bin('setup.exe', 15728640)]),
        dir('Pictures', [bin('Кіт.png', 834560), bin('Море.jpg', 1258291)]),
        dir('Music', [bin('Гімн школи.mp3', 3670016)]),
        dir('Videos', [bin('Випускний.mp4', 157286400)]),
        txt('desktop.ini', '[.ShellClassInfo]', { attrs: { h: true, r: false, s: true } }),
      ], sys),
      dir('Public', [], sys),
    ], sys),
    dir('Windows', [
      dir('System32', [bin('cmd.exe', 289792, sys), bin('notepad.exe', 360448, sys), bin('calc.exe', 27648, sys), txt('drivers.txt', 'Системні драйвери. Не змінювати.', sys)], sys),
      bin('explorer.exe', 5025792, sys), txt('win.ini', '; for 16-bit app support\r\n[fonts]\r\n[extensions]', sys),
    ], sys),
  ]);
  const D = dir('D:', [
    dir('Інформатика', [txt('Урок 1.txt', 'Тема: файли й папки.\r\nФайл — це іменований шматок даних. Папка зберігає файли й інші папки.'), txt('Урок 2.txt', 'Тема: командний рядок.\r\ndir — вміст папки, cd — перейти в папку, md — створити папку.'), dir('Практика', [])]),
    dir('Фото', [bin('Осінь.jpg', 1835008), bin('Клас.jpg', 2097152), bin('Екскурсія.jpg.exe', 1245184)]),
    txt('autorun.inf', '[autorun]\r\nopen=Фото\\Екскурсія.jpg.exe\r\nicon=Фото\\Екскурсія.jpg.exe', { attrs: { h: true, r: false, s: false } }),
  ]);
  for (const d of [C, D]) d.attrs = { h: false, r: false, s: true };
  return { drives: { C, D }, bin: [], seq: seqInit };
}

// Шляхи, які не можна видаляти, перейменовувати чи переміщати
const PROTECTED = [HOME, ...Object.keys(KNOWN).map(k => HOME + '\\' + k), 'C:\\Users', 'C:\\Users\\Public', 'C:\\Windows', 'C:\\Program Files'];
export const isProtected = p => PROTECTED.some(x => lc(x) === lc(p));

/* ── файлова система ── */
// події, після яких змінюється вміст дисків (решта — брандмауер, антивірус, браузер — Провідник не цікавлять)
export const FS_EVENTS = new Set(['mkdir', 'write', 'remove', 'recycle', 'restore', 'purge', 'rename', 'move', 'copy', 'syswrite', 'attr', 'reset']);
// виконати fn один раз після серії змін (усі зміни в одному обробнику → одне перемальовування)
export function batched(fn) { let queued = false; return () => { if (queued) return; queued = true; queueMicrotask(() => { queued = false; fn(); }); }; }
export class FS {
  constructor(state) { this.s = state || initialState(); this.subs = new Set(); }
  on(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
  emit(what) { for (const f of this.subs) f(what); }
  now() { return Date.now(); }
  newId() { return 'n' + (++this.s.seq); }
  drives() { return Object.keys(this.s.drives); }

  // вузол за абсолютним шляхом (або null)
  node(path) {
    const x = parsePath(path); if (!x) return null;
    let n = this.s.drives[x.drive]; if (!n) return null;
    for (const part of x.parts) {
      if (n.type !== 'dir') return null;
      n = n.children.find(c => lc(c.name) === lc(part));
      if (!n) return null;
    }
    return n;
  }
  // шлях із правильним регістром назв
  real(path) {
    const x = parsePath(path); if (!x) return path;
    let n = this.s.drives[x.drive]; const out = [];
    for (const part of x.parts) { const c = n?.children?.find(k => lc(k.name) === lc(part)); out.push(c ? c.name : part); n = c; }
    return joinPath(x.drive, out);
  }
  pathOf(id) {
    const walk = (n, path) => { if (n.id === id) return path; for (const c of n.children || []) { const r = walk(c, path + (path.endsWith('\\') ? '' : '\\') + c.name); if (r) return r; } return null; };
    for (const [d, n] of Object.entries(this.s.drives)) { const r = walk(n, d + ':\\'); if (r) return r; }
    return null;
  }
  isDir(path) { return this.node(path)?.type === 'dir'; }
  isFile(path) { return this.node(path)?.type === 'file'; }
  dirNode(path) { const n = this.node(path); if (!n || n.type !== 'dir') throw ERR.path(); return n; }
  list(path, { hidden = false } = {}) { return this.dirNode(path).children.filter(c => hidden || !c.attrs.h); }
  sizeOf(n) { return n.type === 'dir' ? n.children.reduce((s, c) => s + this.sizeOf(c), 0) : n.binary ? n.size : new TextEncoder().encode(n.content).length; }
  free(drive) { return DRIVE_SIZE[drive] - this.sizeOf(this.s.drives[drive]) - (drive === 'C' ? 61203857408 : 4831838208); }
  // файли, що відповідають шаблону «C:\x\*.txt»
  glob(path) {
    const dirP = parentPath(path), pat = nameOfPath(path);
    if (!dirP || !this.isDir(dirP)) return [];
    const re = wildcard(pat);
    return this.dirNode(dirP).children.filter(c => re.test(c.name)).map(c => ({ node: c, path: this.real(dirP) + (dirP.endsWith('\\') ? '' : '\\') + c.name }));
  }

  /* зміни */
  touch(n) { n.modified = this.now(); }
  checkParent(path) {
    const pp = parentPath(path); if (!pp) throw ERR.access();
    const parent = this.node(pp); if (!parent || parent.type !== 'dir') throw ERR.path();
    return parent;
  }
  checkNew(parent, name) {
    if (!validName(name)) throw ERR.name();
    if (parent.children.some(c => lc(c.name) === lc(name))) throw ERR.exists(name);
  }
  mkdir(path, { parents = true } = {}) {
    const x = parsePath(path); let n = this.s.drives[x.drive]; if (!n) throw ERR.path();
    let made = null;
    for (const [i, part] of x.parts.entries()) {
      let c = n.children.find(k => lc(k.name) === lc(part));
      if (!c) {
        if (!parents && i < x.parts.length - 1) throw ERR.path();
        if (!validName(part)) throw ERR.name();
        if (n.attrs.s && x.drive === 'C' && n.name !== USER && !isInside(this.real(joinPath(x.drive, x.parts.slice(0, i))), HOME)) throw ERR.access();
        c = { id: this.newId(), name: part, type: 'dir', children: [], created: this.now(), modified: this.now(), attrs: { h: false, r: false, s: false } };
        n.children.push(c); this.touch(n); made = c;
      } else if (c.type !== 'dir') throw ERR.exists(part);
      else if (i === x.parts.length - 1) throw ERR.exists(part);
      n = c;
    }
    this.emit('mkdir');
    return made;
  }
  writeFile(path, content = '', { append = false } = {}) {
    const parent = this.checkParent(path), name = nameOfPath(path);
    let f = parent.children.find(c => lc(c.name) === lc(name));
    if (f && f.type === 'dir') throw ERR.access();
    if (f) {
      if (f.attrs.r) throw ERR.access();
      if (f.binary) { f.binary = false; f.content = ''; }
      f.content = append ? f.content + content : content; this.touch(f);
    } else {
      this.checkNew(parent, name);
      if (this.isSystemArea(parentPath(path))) throw ERR.access();
      f = { id: this.newId(), name, type: 'file', content, size: 0, created: this.now(), modified: this.now(), attrs: { h: false, r: false, s: false } };
      parent.children.push(f); this.touch(parent);
    }
    this.emit('write');
    return f;
  }
  readFile(path) {
    const f = this.node(path);
    if (!f) throw ERR.file();
    if (f.type === 'dir') throw ERR.access();
    return f.binary ? binaryText(f) : f.content;
  }
  isSystemArea(path) { return ['C:\\Windows', 'C:\\Program Files'].some(x => isInside(this.real(path), x)) || ['c:\\', 'c:\\users'].includes(lc(this.real(path))); }
  guard(path, n) {
    if (isProtected(this.real(path)) || (n.attrs.s && n.type === 'dir') || n.attrs.r || this.isSystemArea(parentPath(path))) throw ERR.access();
  }
  // видалити назавжди (як del / rd у консолі)
  remove(path, { recursive = false } = {}) {
    const n = this.node(path); if (!n) throw ERR.file();
    const parent = this.node(parentPath(path));
    this.guard(path, n);
    if (n.type === 'dir' && n.children.length && !recursive) throw ERR.notEmpty();
    if (n.type === 'dir' && recursive) this.checkTree(n);
    parent.children = parent.children.filter(c => c !== n); this.touch(parent);
    this.emit('remove');
    return n;
  }
  checkTree(n) { for (const c of n.children || []) { if (c.attrs.r || (c.attrs.s && c.type === 'dir')) throw ERR.access(); this.checkTree(c); } }
  // у Кошик (як Delete у Провіднику)
  recycle(path) {
    const n = this.node(path); if (!n) throw ERR.file();
    const from = parentPath(this.real(path));
    if (n.type === 'dir') this.checkTree(n);
    this.remove(path, { recursive: true });
    this.s.bin.unshift({ id: this.newId(), node: n, from, at: this.now() });
    this.emit('recycle');
  }
  restore(binId) {
    const i = this.s.bin.findIndex(b => b.id === binId); if (i < 0) return null;
    const { node, from } = this.s.bin[i];
    if (!this.isDir(from)) this.mkdir(from);
    const parent = this.node(from);
    node.name = this.freeName(parent, node.name);
    parent.children.push(node); this.touch(parent);
    this.s.bin.splice(i, 1);
    this.emit('restore');
    return from + '\\' + node.name;
  }
  purge(binId) { this.s.bin = binId ? this.s.bin.filter(b => b.id !== binId) : []; this.emit('purge'); }
  // вільна назва: «Нова папка», «Нова папка (2)»…
  freeName(parent, name) {
    const has = n => parent.children.some(c => lc(c.name) === lc(n));
    if (!has(name)) return name;
    const b = baseOf(name), e = name.slice(b.length);
    for (let k = 2; ; k++) { const n = `${b} (${k})${e}`; if (!has(n)) return n; }
  }
  rename(path, newName) {
    const n = this.node(path); if (!n) throw ERR.file();
    if (isProtected(this.real(path)) || n.attrs.s || this.isSystemArea(parentPath(path))) throw ERR.access();
    if (!validName(newName)) throw ERR.name();
    const parent = this.node(parentPath(path));
    if (lc(newName) !== lc(n.name) && parent.children.some(c => lc(c.name) === lc(newName))) throw ERR.exists(newName);
    n.name = newName; this.touch(n);
    this.emit('rename');
    return n;
  }
  // перемістити: у папку (якщо dest — існуюча папка) або під новою назвою
  move(src, dest, { overwrite = false } = {}) {
    const n = this.node(src); if (!n) throw ERR.file();
    this.guard(src, n);
    let target = dest, name = n.name;
    if (this.isDir(dest)) target = dest; else { target = parentPath(dest); name = nameOfPath(dest); if (!this.isDir(target)) throw ERR.path(); }
    if (n.type === 'dir' && isInside(this.real(target), this.real(src))) throw ERR.self();
    if (this.isSystemArea(target)) throw ERR.access();
    const tdir = this.node(target);
    const clash = tdir.children.find(c => lc(c.name) === lc(name));
    if (clash === n) { if (name !== n.name) { n.name = name; this.emit('move'); } return n; }
    if (clash) { if (!overwrite || clash.type === 'dir' || n.type === 'dir' || clash.attrs.r) throw ERR.exists(name); tdir.children = tdir.children.filter(c => c !== clash); }
    if (!validName(name)) throw ERR.name();
    const sp = this.node(parentPath(src));
    sp.children = sp.children.filter(c => c !== n); this.touch(sp);
    n.name = name; tdir.children.push(n); this.touch(tdir);
    this.emit('move');
    return n;
  }
  clone(n) { const c = { ...JSON.parse(JSON.stringify(n)), id: this.newId(), created: this.now(), attrs: { ...n.attrs, s: false, r: false } }; if (c.children) c.children = n.children.map(k => this.clone(k)); return c; }
  copy(src, dest, { overwrite = false, recursive = false } = {}) {
    const n = this.node(src); if (!n) throw ERR.file();
    if (n.type === 'dir' && !recursive) throw ERR.access();
    let target = dest, name = n.name;
    if (this.isDir(dest)) target = dest; else { target = parentPath(dest); name = nameOfPath(dest); if (!this.isDir(target)) throw ERR.path(); }
    if (n.type === 'dir' && isInside(this.real(target), this.real(src))) throw ERR.self();
    if (this.isSystemArea(target)) throw ERR.access();
    const tdir = this.node(target);
    const clash = tdir.children.find(c => lc(c.name) === lc(name));
    if (clash) { if (!overwrite || clash.type === 'dir' || clash.attrs.r) throw ERR.exists(name); tdir.children = tdir.children.filter(c => c !== clash); }
    if (!validName(name)) throw ERR.name();
    const c = this.clone(n); c.name = name; c.modified = n.modified;
    tdir.children.push(c); this.touch(tdir);
    this.emit('copy');
    return c;
  }
  // копія в ту саму папку: «Нотатки — копія.txt»
  copyName(parent, name) {
    const b = baseOf(name), e = name.slice(b.length);
    return this.freeName(parent, `${b} — копія${e}`);
  }
  // запис від імені системи (журнал брандмауера): створює папки й обходить захист
  sysWrite(path, text, append = false) {
    const x = parsePath(path); let n = this.s.drives[x.drive];
    for (const part of x.parts.slice(0, -1)) {
      let c = n.children.find(k => lc(k.name) === lc(part));
      if (!c) { c = { id: this.newId(), name: part, type: 'dir', children: [], created: this.now(), modified: this.now(), attrs: { h: false, r: false, s: true } }; n.children.push(c); }
      n = c;
    }
    const name = x.parts.at(-1);
    let f = n.children.find(k => lc(k.name) === lc(name));
    if (!f) { f = { id: this.newId(), name, type: 'file', content: '', size: 0, created: this.now(), modified: this.now(), attrs: { h: false, r: false, s: false } }; n.children.push(f); }
    f.content = append ? f.content + text : text; f.modified = this.now();
    this.emit('syswrite');
  }
  setAttr(path, attr, on) {
    const n = this.node(path); if (!n) throw ERR.file();
    if (n.attrs.s && attr !== 'h') throw ERR.access();
    n.attrs[attr] = on; this.emit('attr');
  }
  reset() { this.s = initialState(); this.emit('reset'); }
}

// Вміст «двійкового» файлу, якщо його відкрити як текст
export function binaryText(f) {
  const seed = [...f.name].reduce((s, c) => s + c.charCodeAt(0), 0);
  let out = '';
  for (let i = 0; i < 6; i++) out += String.fromCharCode(...Array.from({ length: 24 }, (_, k) => 0x2580 + ((seed * (i + 3) + k * 7) % 31))) + '\r\n';
  return out;
}

/* ── типи файлів ── */
const TYPES = {
  txt: 'Текстовий документ', docx: 'Документ Microsoft Word', xlsx: 'Аркуш Microsoft Excel', pptx: 'Презентація Microsoft PowerPoint',
  jpg: 'Файл JPG', jpeg: 'Файл JPG', png: 'Файл PNG', mp3: 'Файл MP3', mp4: 'Файл MP4', zip: 'Стиснута ZIP-папка', exe: 'Застосунок', ini: 'Параметри конфігурації', pdf: 'Документ PDF', bat: 'Пакетний файл Windows', html: 'HTML-документ', md: 'Файл MD', csv: 'Файл CSV',
};
export const typeName = n => n.type === 'dir' ? 'Папка з файлами' : TYPES[extOf(n.name)] || (extOf(n.name) ? `Файл ${extOf(n.name).toUpperCase()}` : 'Файл');
export const isText = n => n.type === 'file' && !n.binary;

/* ── форматування ── */
const pad = n => String(n).padStart(2, '0');
export const fmtDate = t => { const d = new Date(t); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`; };
export const fmtTime = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const fmtNum = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
export function fmtSize(b) {
  if (b < 1024) return b + ' байт';
  const u = ['КБ', 'МБ', 'ГБ', 'ТБ']; let v = b / 1024, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toString().replace('.', ',') + ' ' + u[i];
}
