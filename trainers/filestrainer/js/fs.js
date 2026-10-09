// Файли й папки · віртуальна файлова система й ігрова сесія. Без DOM — перевіряється тестами.
//
// Вузол: { id, name, type: 'folder' | 'file', size (КБ), art?, children? }.
// Видалене лежить у кошику: fs.bin = [{ node, from (id папки) }].
// Сесія рахує кроки: створення, перейменування, переміщення, копіювання, видалення, відновлення,
// очищення кошика й відкриття файлу — кожна дія = 1 крок, хоч з одним файлом, хоч з десятьма.

export const ROOT_FOLDERS = ['Робочий стіл', 'Документи', 'Завантаження', 'Зображення', 'Музика', 'Відео'];
export const BAD_CHARS = '\\/:*?"<>|';

/* ── типи файлів ── */
const KINDS = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'], audio: ['mp3', 'wav', 'ogg', 'm4a'], video: ['mp4', 'avi', 'mov', 'mkv'],
  doc: ['doc', 'docx', 'odt', 'rtf'], pdf: ['pdf'], sheet: ['xls', 'xlsx', 'ods', 'csv'], slides: ['ppt', 'pptx', 'odp'],
  text: ['txt', 'md'], archive: ['zip', 'rar', '7z'], app: ['exe', 'msi'], tmp: ['tmp'],
};
const KIND_NAME = { image: 'Малюнок', audio: 'Музика', video: 'Відео', doc: 'Документ', pdf: 'PDF-документ', sheet: 'Таблиця', slides: 'Презентація', text: 'Текстовий файл', archive: 'Архів', app: 'Програма', tmp: 'Тимчасовий файл', file: 'Файл' };
export const ext = name => { const i = name.lastIndexOf('.'); return i > 0 ? name.slice(i + 1).toLowerCase() : ''; };
export const base = name => { const i = name.lastIndexOf('.'); return i > 0 ? name.slice(0, i) : name; };
export const kindOf = node => node.type === 'folder' ? 'folder' : Object.keys(KINDS).find(k => KINDS[k].includes(ext(node.name))) || 'file';
export const typeName = node => node.type === 'folder' ? 'Папка' : KIND_NAME[kindOf(node)] + (ext(node.name) ? ` (${ext(node.name).toUpperCase()})` : '');
export const fmtSize = kb => kb == null ? '' : kb < 1024 ? `${kb} КБ` : `${(kb / 1024).toFixed(1).replace('.', ',')} МБ`;

/* ── побудова з опису ── */
// Опис: { 'Документи': { 'Казки': { 'Колобок.txt': 4 } } } — число або { size, art } — файл, об'єкт — папка.
let seq = 0;
const isFileSpec = v => typeof v === 'number' || (v && typeof v === 'object' && 'size' in v);
function build(name, spec) {
  if (isFileSpec(spec)) return { id: 'n' + (++seq), name, type: 'file', size: typeof spec === 'number' ? spec : spec.size, art: spec.art };
  return { id: 'n' + (++seq), name, type: 'folder', children: Object.entries(spec || {}).map(([k, v]) => build(k, v)) };
}
export function createFS(spec = {}, bin = []) {
  const root = { id: 'root', name: 'Цей комп’ютер', type: 'folder', children: [] };
  for (const f of ROOT_FOLDERS) root.children.push(build(f, spec[f] || {}));
  const fs = { root, bin: [] };
  // кошик: [{ path: 'Документи/контрольна.docx', spec: 30 }]
  for (const b of bin) {
    const parts = b.path.split('/'), name = parts.pop();
    fs.bin.push({ node: build(name, b.spec ?? 10), from: byPath(fs, parts.join('/'))?.id || 'root' });
  }
  return fs;
}

/* ── пошук вузлів ── */
export function walk(node, fn, path = []) {
  for (const c of node.children || []) { fn(c, [...path, c]); if (c.type === 'folder') walk(c, fn, [...path, c]); }
}
export function findById(fs, id) {
  if (id === 'root') return { node: fs.root, parent: null, path: [] };
  let r = null;
  walk(fs.root, (n, path) => { if (!r && n.id === id) r = { node: n, parent: path.length > 1 ? path[path.length - 2] : fs.root, path }; });
  return r;
}
export const node = (fs, id) => findById(fs, id)?.node || null;
export const pathOf = (fs, id) => findById(fs, id)?.path.map(n => n.name).join('/') ?? null;
export function byPath(fs, path) {
  if (!path) return fs.root;
  let cur = fs.root;
  for (const part of path.split('/')) { cur = cur.children?.find(c => c.name === part); if (!cur) return null; }
  return cur;
}
const childNamed = (folder, name, except) => folder.children.find(c => c !== except && c.name.toLowerCase() === name.toLowerCase());
const isInside = (fs, id, ancestorId) => (findById(fs, id)?.path || []).some(n => n.id === ancestorId);
export const all = fs => { const r = []; walk(fs.root, (n, path) => r.push({ node: n, path: path.map(x => x.name).join('/') })); return r; };

/* ── імена ── */
export function validName(name) {
  const n = name.trim();
  if (!n) return 'Ім’я не може бути порожнім';
  const bad = [...BAD_CHARS].filter(c => n.includes(c));
  if (bad.length) return `Ім’я не може містити символи ${BAD_CHARS.split('').join(' ')}`;
  if (/^\.+$/.test(n)) return 'Ім’я не може складатися лише з крапок';
  if (n.length > 80) return 'Задовге ім’я';
  return null;
}
export function uniqueName(folder, name, isCopy = false) {
  if (!childNamed(folder, name)) return name;
  const b = base(name), e = ext(name) && name.includes('.') ? '.' + name.slice(name.lastIndexOf('.') + 1) : '';
  for (let i = isCopy ? 1 : 2; ; i++) {
    const n = isCopy ? `${b} - копія${i > 1 ? ` (${i})` : ''}${e}` : `${b} (${i})${e}`;
    if (!childNamed(folder, n)) return n;
  }
}

/* ── операції (повертають { error } або результат) ── */
export function mkdir(fs, parentId, name = 'Нова папка') {
  const parent = node(fs, parentId);
  if (!parent || parent.type !== 'folder') return { error: 'Тут не можна створити папку' };
  const err = validName(name); if (err) return { error: err };
  const n = { id: 'n' + (++seq), name: uniqueName(parent, name.trim()), type: 'folder', children: [] };
  parent.children.push(n);
  return { node: n };
}
export function rename(fs, id, name) {
  const f = findById(fs, id);
  if (!f || id === 'root' || f.path.length === 1) return { error: 'Цю папку не можна перейменувати' };
  const err = validName(name); if (err) return { error: err };
  name = name.trim();
  if (name === f.node.name) return { same: true };
  if (childNamed(f.parent, name, f.node)) return { error: `У цій папці вже є «${name}»` };
  f.node.name = name;
  return { node: f.node };
}
export function move(fs, ids, destId) {
  const dest = node(fs, destId);
  if (!dest || dest.type !== 'folder' || destId === 'root') return { error: 'Сюди не можна перемістити' };
  const items = ids.map(id => findById(fs, id)).filter(Boolean);
  if (items.some(f => f.path.length === 1)) return { error: 'Системні папки не можна переміщувати' };
  if (items.some(f => f.node.id === destId || isInside(fs, destId, f.node.id))) return { error: 'Папку не можна перемістити саму в себе' };
  const todo = items.filter(f => f.parent.id !== destId);
  if (!todo.length) return { same: true };
  const clash = todo.find(f => childNamed(dest, f.node.name));
  if (clash) return { error: `У папці «${dest.name}» вже є «${clash.node.name}»` };
  for (const f of todo) { f.parent.children.splice(f.parent.children.indexOf(f.node), 1); dest.children.push(f.node); }
  return { moved: todo.length };
}
const deepCopy = n => n.type === 'folder' ? { ...n, id: 'n' + (++seq), children: n.children.map(deepCopy) } : { ...n, id: 'n' + (++seq) };
export function copy(fs, ids, destId) {
  const dest = node(fs, destId);
  if (!dest || dest.type !== 'folder' || destId === 'root') return { error: 'Сюди не можна скопіювати' };
  const items = ids.map(id => findById(fs, id)).filter(Boolean);
  if (items.some(f => f.node.id === destId || isInside(fs, destId, f.node.id))) return { error: 'Папку не можна скопіювати саму в себе' };
  const made = items.map(f => { const c = deepCopy(f.node); c.name = uniqueName(dest, f.node.name, f.parent.id === destId || !!childNamed(dest, f.node.name)); dest.children.push(c); return c; });
  return { nodes: made };
}
export function remove(fs, ids) {
  const items = ids.map(id => findById(fs, id)).filter(Boolean);
  if (items.some(f => f.path.length === 1)) return { error: 'Системні папки не можна видаляти' };
  for (const f of items) { f.parent.children.splice(f.parent.children.indexOf(f.node), 1); fs.bin.push({ node: f.node, from: f.parent.id }); }
  return { removed: items.length };
}
export function restore(fs, ids) {
  const items = fs.bin.filter(b => ids.includes(b.node.id));
  for (const b of items) {
    const parent = node(fs, b.from) || byPath(fs, 'Робочий стіл');
    b.node.name = uniqueName(parent, b.node.name);
    parent.children.push(b.node);
    fs.bin.splice(fs.bin.indexOf(b), 1);
  }
  return { restored: items.length };
}
export function emptyBin(fs) { const n = fs.bin.length; fs.bin = []; return { removed: n }; }

// Пошук у папці й усіх вкладених: «*.mp3», «кіт*» — шаблон; інакше — частина імені.
export function search(fs, fromId, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const start = node(fs, fromId) || fs.root;
  let test;
  if (q.includes('*') || q.includes('?')) {
    const re = new RegExp('^' + q.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
    test = n => re.test(n.name);
  } else if (/^\.[\p{L}\p{N}]+$/u.test(q)) test = n => n.type === 'file' && ext(n.name) === q.slice(1);
  else test = n => n.name.toLowerCase().includes(q);
  const r = [];
  walk(start, n => { if (test(n)) r.push(n); });
  return r;
}

/* ── сесія рівня: кроки, відкриті файли, перевірка цілей ── */
export function createSession(level) {
  seq = 0;
  const S = {
    level, fs: createFS(level.spec, level.bin), steps: 0, opened: new Set(),
    get: path => byPath(S.fs, path),
    id(path) { const n = byPath(S.fs, path); if (!n) throw new Error('немає ' + path); return n.id; },
    binId(name) { const b = S.fs.bin.find(x => x.node.name === name); if (!b) throw new Error('немає в кошику ' + name); return b.node.id; },
    act(r) { if (!r.error && !r.same) S.steps++; return r; },
    // шляхові обгортки — для еталонних розв'язків і тестів
    mkdir: (path, name) => S.act(mkdir(S.fs, S.id(path), name)),
    rename: (path, name) => S.act(rename(S.fs, S.id(path), name)),
    move: (paths, dest) => S.act(move(S.fs, [].concat(paths).map(S.id), S.id(dest))),
    copy: (paths, dest) => S.act(copy(S.fs, [].concat(paths).map(S.id), S.id(dest))),
    remove: paths => S.act(remove(S.fs, [].concat(paths).map(S.id))),
    restore: names => S.act(restore(S.fs, [].concat(names).map(S.binId))),
    emptyBin: () => S.act(emptyBin(S.fs)),
    open(path) { const n = byPath(S.fs, path); if (n?.type === 'file') { S.opened.add(n.id); S.steps++; } return n; },
    goals: () => level.goals.map(g => ({ text: g.text, done: !!g.test(S) })),
    done: () => level.goals.every(g => g.test(S)),
  };
  return S;
}

/* ── допоміжні перевірки для цілей рівнів ── */
export const T = {
  file: (S, path) => byPath(S.fs, path)?.type === 'file',
  folder: (S, path) => byPath(S.fs, path)?.type === 'folder',
  gone: (S, path) => !byPath(S.fs, path),
  opened: (S, path) => { const n = byPath(S.fs, path); return !!n && S.opened.has(n.id); },
  names: (S, path) => (byPath(S.fs, path)?.children || []).map(c => c.name),
  // усі файли з такими розширеннями лежать саме в папці path (не глибше)
  allIn: (S, exts, path) => all(S.fs).filter(x => x.node.type === 'file' && exts.includes(ext(x.node.name))).every(x => x.path === path + '/' + x.node.name),
  count: (S, exts) => all(S.fs).filter(x => x.node.type === 'file' && exts.includes(ext(x.node.name))).length,
  // скільки файлів із таким іменем існує (поза кошиком)
  exists: (S, name) => all(S.fs).filter(x => x.node.name === name).length,
  inBin: (S, name) => S.fs.bin.some(b => b.node.name === name),
  empty: (S, path) => (byPath(S.fs, path)?.children || []).length === 0,
};
