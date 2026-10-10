// Емулятор Windows · вікно «Властивості» файлу чи папки: Загальні, Спільний доступ, Безпека, Подробиці, Попередні версії.
import { parentPath, typeName, fmtDate, fmtTime, fmtSize, fmtNum, extOf, isText, validName, BAD_NAME_HINT, isProtected, USER, HOME, isInside } from './fs.js';
import { nodeIcon, ui } from './icons.js';
import { alertBox, esc, modal, tabs } from './ui.js';

const OPENS = { txt: 'Блокнот', md: 'Блокнот', log: 'Блокнот', ini: 'Блокнот', bat: 'Блокнот', csv: 'Блокнот', html: 'Браузер', htm: 'Браузер', jpg: 'Фотографії', jpeg: 'Фотографії', png: 'Фотографії', gif: 'Фотографії', mp3: 'Медіапрогравач', mp4: 'Медіапрогравач', docx: 'Word', xlsx: 'Excel', pptx: 'PowerPoint', zip: 'Провідник', pdf: 'Браузер' };
const PERMS = ['Повний доступ', 'Змінення', 'Читання й виконання', 'Перегляд вмісту папки', 'Читання', 'Записування', 'Особливі дозволи'];
const dt = t => `${fmtDate(t)}, ${fmtTime(t)}`;
// хто й що може робити з файлом (як у справжній Windows, спрощено)
function aclOf(fs, path, n) {
  const sys = n.attrs.s || isInside(path, 'C:\\Windows') || isInside(path, 'C:\\Program Files');
  const mine = isInside(path, HOME) || path[0] === 'D';
  const full = [1, 1, 1, 1, 1, 1, 0], read = [0, 0, 1, 1, 1, 0, 0], modify = [0, 1, 1, 1, 1, 1, 0];
  return [
    ['СИСТЕМА', 'system', full],
    ['Адміністратори (EDVAULT-PC\\Адміністратори)', 'admins', sys ? modify : full],
    [`${USER} (EDVAULT-PC\\${USER})`, 'user', sys ? read : mine ? full : modify],
    ['Користувачі (EDVAULT-PC\\Користувачі)', 'users', read],
  ].map(([t, k, p]) => ({ t, k, p: p.map((v, i) => (n.type === 'file' && i === 3) ? null : v) }));
}

export function installProps(sys) {
  const fs = sys.fs;
  sys.props = (path, binItem) => {
    const n = binItem ? binItem.node : fs.node(path); if (!n) return;
    const isDrive = !binItem && /^[a-z]:\\?$/i.test(path);
    if (isDrive) return sys.driveProps(path[0].toUpperCase());
    const real = binItem ? null : fs.real(path);
    const loc = binItem ? binItem.from : parentPath(real) || '';
    const dir = n.type === 'dir', locked = !!binItem || isProtected(real) || n.attrs.s;
    let files = 0, dirs = 0; const count = x => { for (const c of x.children || []) { if (c.type === 'dir') { dirs++; count(c); } else files++; } }; count(n);
    const size = fs.sizeOf(n), disk = x => x.type === 'dir' ? x.children.reduce((a, c) => a + disk(c), 0) : Math.ceil(fs.sizeOf(x) / 4096) * 4096, onDisk = disk(n);
    const ext = extOf(n.name), opens = dir ? null : OPENS[ext] || (ext === 'exe' ? null : 'Не вибрано');
    const acl = aclOf(fs, real || loc, n);
    const row = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;
    const general = `<div class="pr-head">${nodeIcon(n, binItem ? null : real, 40)}<input class="inp pr-name" data-name value="${esc(n.name)}" ${locked ? 'disabled' : ''} spellcheck="false"></div>
      <table class="pr-t">${row('Тип:', esc(typeName(n)) + (ext && !dir ? ` (.${ext})` : ''))}${opens ? row('Відкривати за допомогою:', esc(opens)) : ''}
      <tr class="sep"><td colspan="2"></td></tr>${row(binItem ? 'Звідки видалено:' : 'Розташування:', `<span class="pr-path">${esc(loc)}</span>`)}${row('Розмір:', `${fmtSize(size)} (${fmtNum(size)} байт)`)}${row('На диску:', `${fmtSize(onDisk)} (${fmtNum(onDisk)} байт)`)}${dir ? row('Містить:', `Файлів: ${files}, папок: ${dirs}`) : ''}
      <tr class="sep"><td colspan="2"></td></tr>${row('Створено:', dt(n.created))}${dir ? '' : row('Змінено:', dt(n.modified))}${dir ? '' : row('Відкрито:', dt(Math.max(n.modified, n.opened || 0)))}${binItem ? row('Видалено:', dt(binItem.at)) : ''}
      <tr class="sep"><td colspan="2"></td></tr><tr><th>Атрибути:</th><td class="pr-attr"><label class="chk"><input type="checkbox" data-a="r" ${n.attrs.r ? 'checked' : ''} ${n.attrs.s || binItem ? 'disabled' : ''}> Лише читання${dir ? ' (лише для файлів у папці)' : ''}</label><label class="chk"><input type="checkbox" data-a="h" ${n.attrs.h ? 'checked' : ''} ${binItem ? 'disabled' : ''}> Прихований</label>${n.attrs.s ? '<span class="pr-sys">Системний файл — Windows не дає його змінювати.</span>' : ''}</td></tr></table>
      <p class="hint muted">«Лише читання» — файл можна відкрити, але не можна зберегти зміни. «Прихований» — Провідник не показує його, доки не ввімкнути «Вигляд → Приховані елементи». Те саме робить команда <code>attrib</code>.</p>`;
    const share = `<fieldset><legend>Спільний доступ до мережевих файлів і папок</legend><div class="pr-share">${nodeIcon(n, null, 32)}<div><b>${esc(n.name)}</b><small>Не надано спільного доступу</small></div></div><p class="muted">Мережевий шлях: <i>Не надано спільного доступу</i></p><button class="btn" data-share>Надати спільний доступ…</button></fieldset>
      <fieldset><legend>Захист паролем</legend><p class="muted">Доступ до папки мають лише люди, які знають ім’я та пароль облікового запису на цьому комп’ютері.</p></fieldset>`;
    const security = `<p>Ім’я об’єкта: <span class="pr-path">${esc(real || loc + '\\' + n.name)}</span></p><p class="pr-lab">Імена груп або користувачів:</p>
      <div class="pr-users">${acl.map((a, i) => `<button class="pr-u${i === 2 ? ' on' : ''}" data-acl="${i}">${ui(a.k === 'user' ? 'person' : 'users', 16)}<span>${esc(a.t)}</span></button>`).join('')}</div>
      <div class="cpl-row"><span class="muted">Щоб змінити дозволи, натисніть «Змінити».</span><span class="grow"></span><button class="btn" data-edit-acl>${ui('shield', 14)} Змінити…</button></div>
      <table class="pr-perm"><thead><tr><th data-who>Дозволи для групи «${esc(acl[2].t.split(' (')[0])}»</th><th>Дозволити</th><th>Заборонити</th></tr></thead><tbody data-perm>${permRows(acl[2])}</tbody></table>
      <p class="hint muted">Дозволи визначають, хто може читати, змінювати чи видаляти файл. Системні файли Windows звичайний користувач може лише читати.</p>`;
    const lines = !dir && isText(n) ? n.content.split(/\r?\n/) : null;
    const details = `<table class="pr-det"><thead><tr><th>Властивість</th><th>Значення</th></tr></thead><tbody>
      <tr class="grp"><td colspan="2">Опис</td></tr>${[['Ім’я', n.name], ['Тип елемента', typeName(n)], ['Шлях до папки', loc]].map(r => `<tr><td>${r[0]}</td><td>${esc(r[1])}</td></tr>`).join('')}
      ${lines ? `<tr class="grp"><td colspan="2">Вміст</td></tr><tr><td>Рядків</td><td>${lines.length}</td></tr><tr><td>Слів</td><td>${n.content.split(/\s+/).filter(Boolean).length}</td></tr><tr><td>Символів</td><td>${n.content.replace(/\r/g, '').length}</td></tr>` : ''}
      ${/^(jpg|jpeg|png|gif)$/.test(ext) ? `<tr class="grp"><td colspan="2">Зображення</td></tr><tr><td>Розміри</td><td>1920 x 1080</td></tr><tr><td>Глибина кольору</td><td>24</td></tr>` : ''}
      ${/^(mp3|mp4)$/.test(ext) ? `<tr class="grp"><td colspan="2">Медіа</td></tr><tr><td>Тривалість</td><td>${ext === 'mp3' ? '00:03:41' : '00:12:08'}</td></tr><tr><td>Швидкість потоку</td><td>${ext === 'mp3' ? '320 кбіт/с' : '1620 кбіт/с'}</td></tr>` : ''}
      <tr class="grp"><td colspan="2">Файл</td></tr><tr><td>Розмір</td><td>${fmtSize(size)}</td></tr><tr><td>Дата створення</td><td>${dt(n.created)}</td></tr><tr><td>Дата змінення</td><td>${dt(n.modified)}</td></tr>
      <tr><td>Атрибути</td><td>${[n.attrs.r && 'R', n.attrs.h && 'H', n.attrs.s && 'S', !dir && 'A'].filter(Boolean).join('') || '—'}</td></tr><tr><td>Власник</td><td>${n.attrs.s ? 'СИСТЕМА' : `EDVAULT-PC\\${USER}`}</td></tr><tr><td>Комп’ютер</td><td>EDVAULT-PC (цей комп’ютер)</td></tr></tbody></table>`;
    const versions = `<p class="muted">Попередні версії створюються з точок відновлення або резервних копій Windows.</p><div class="empty-list big"><span>Немає доступних попередніх версій.</span></div>`;
    const custom = `<fieldset><legend>Для якого типу ця папка?</legend><label class="fld">Оптимізувати для: <select class="inp"><option>Загальні елементи</option><option>Документи</option><option>Зображення</option><option>Музика</option><option>Відео</option></select></label><label class="chk"><input type="checkbox"> Також застосувати цей шаблон до всіх вкладених папок</label></fieldset>
      <fieldset><legend>Значки папок</legend><div class="pr-share">${nodeIcon(n, real, 40)}<p class="muted">Можна змінити значок цієї папки в поданні «Значки».</p></div><button class="btn" disabled>Змінити значок…</button></fieldset>`;
    const list = binItem ? [['general', 'Загальні', general]] : dir
      ? [['general', 'Загальні', general], ['share', 'Спільний доступ', share], ['security', 'Безпека', security], ['versions', 'Попередні версії', versions], ['custom', 'Налаштування', custom]]
      : [['general', 'Загальні', general], ['security', 'Безпека', security], ['details', 'Подробиці', details], ['versions', 'Попередні версії', versions]];
    if (!dir && !binItem) n.opened = Date.now();
    const apply = api => {
      if (binItem) return true;
      let p = real;
      const name = api.$('[data-name]').value.trim();
      if (!locked && name !== n.name) {
        if (!validName(name)) { alertBox(BAD_NAME_HINT, 'Перейменування', 'warn'); return false; }
        try { fs.rename(p, name); p = parentPath(p).replace(/\\$/, '') + '\\' + name; } catch (e) { alertBox(e.code === 'exists' ? `У цій папці вже є елемент «${name}».` : e.message, 'Перейменування', 'warn'); return false; }
      }
      try { for (const a of ['r', 'h']) { const c = api.$(`[data-a="${a}"]`); if (!c.disabled && c.checked !== !!fs.node(p).attrs[a]) fs.setAttr(p, a, c.checked); } } catch (e) { alertBox(e.message, 'Властивості', 'warn'); return false; }
      real && (api.real = p);
      api.button(2).disabled = true;
      return true;
    };
    modal({ title: `Властивості: ${n.name}`, cls: 'fprops', html: tabs(list),
      buttons: [{ t: 'OK', v: 'ok', primary: true }, { t: 'Скасувати', v: null, cancel: true }, { t: 'Застосувати', v: 'apply' }],
      onOpen: api => {
        api.button(2).disabled = true;
        const dirty = () => { api.button(2).disabled = false; };
        api.el.addEventListener('input', dirty); api.el.addEventListener('change', dirty);
        api.el.addEventListener('click', e => {
          const u = e.target.closest('[data-acl]');
          if (u) { const a = acl[+u.dataset.acl]; api.$$('[data-acl]').forEach(x => x.classList.toggle('on', x === u)); api.$('[data-who]').textContent = `Дозволи для групи «${a.t.split(' (')[0]}»`; api.$('[data-perm]').innerHTML = permRows(a); }
          if (e.target.closest('[data-edit-acl]')) alertBox('Змінювати дозволи може лише адміністратор. На навчальному комп’ютері їх можна тільки переглянути — так безпечніше.', 'Безпека', 'info');
          if (e.target.closest('[data-share]')) alertBox(`Щоб інші комп’ютери мережі бачили папку «${n.name}», увімкніть «Спільний доступ до файлів і принтерів» у брандмауері. На навчальному комп’ютері спільний доступ лише показано.`, 'Спільний доступ', 'info');
        });
        setTimeout(() => { const i = api.$('[data-name]'); if (!i.disabled) { i.focus(); const d = dir ? i.value.length : i.value.lastIndexOf('.'); i.setSelectionRange(0, d > 0 ? d : i.value.length); } }, 30);
      },
      onButton: (v, api) => { if (v === 'ok') return apply(api); if (v === 'apply') { apply(api); return false; } } });
  };
}
function permRows(a) { return PERMS.map((t, i) => a.p[i] === null ? '' : `<tr><td>${t}</td><td>${a.p[i] ? ui('check', 15) : ''}</td><td></td></tr>`).join(''); }
