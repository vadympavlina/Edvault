// Емулятор Windows · навчальні сайти для браузера (*.edvault). Кожна сторінка — { title, html, bind?(el, ctx) }.
import { SYS_PROCS } from './procs.js';
import { ui } from './icons.js';
import { esc } from './ui.js';

export const EDU_SITES = {
  'poshuk.edvault': { ip: '185.199.110.20', title: 'Пошук', color: '#1a73c8', letter: 'П' },
  'novyny.edvault': { ip: '185.199.110.21', title: 'Новини', color: '#c42b1c', letter: 'Н' },
  'shkola.edvault': { ip: '185.199.110.22', title: 'Школа №1', color: '#107c10', letter: 'Ш' },
  'fayly.edvault': { ip: '185.199.110.23', title: 'Файли для уроків', color: '#8a5a00', letter: 'Ф' },
  'pogoda.edvault': { ip: '185.199.110.24', title: 'Погода', color: '#0099bc', letter: 'П' },
  'dovidka.edvault': { ip: '185.199.110.25', title: 'Довідник термінів', color: '#5c2d91', letter: 'Д' },
  'pryz-vygraj.edvault': { ip: '45.11.20.99', title: 'Виграй приз!', color: '#e3008c', letter: '!', danger: true },
};
const OWN = { 'edvault.online': { title: 'Edvault', color: '#0f6cbd', letter: 'E' }, 'www.edvault.online': { title: 'Edvault', color: '#0f6cbd', letter: 'E' } };
export function FAVICON(host, s = 16) {
  const x = EDU_SITES[host] || OWN[host]; if (!x) return '';
  return `<svg width="${s}" height="${s}" viewBox="0 0 16 16" aria-hidden="true"><rect width="16" height="16" rx="4" fill="${x.color}"/><text x="8" y="12" text-anchor="middle" font-size="10" font-weight="700" fill="#fff" font-family="Segoe UI, Inter, sans-serif">${x.letter}</text></svg>`;
}

/* ── довідник: терміни й процеси ── */
const TERMS = [
  ['ip-adresa', 'IP-адреса', 'Номер комп’ютера в мережі, як номер будинку на вулиці. Наприклад, 192.168.1.27. Дізнатися свою IP-адресу можна командою ipconfig.'],
  ['router', 'Роутер (маршрутизатор)', 'Пристрій, який з’єднує домашні комп’ютери між собою й з інтернетом. Він роздає IP-адреси (DHCP), створює Wi‑Fi і захищає мережу. Його налаштування відкриваються в браузері за адресою основного шлюзу — зазвичай 192.168.1.1 або 192.168.0.1.'],
  ['shlyuz', 'Основний шлюз', 'Адреса роутера, через який комп’ютер виходить в інтернет. Видно в ipconfig. У навчальній мережі — 192.168.1.1.'],
  ['dns', 'DNS', '«Телефонна книга» інтернету: перетворює назву сайту (poshuk.edvault) на IP-адресу. Перевірити можна командою nslookup.'],
  ['dhcp', 'DHCP', 'Служба роутера, яка автоматично видає кожному пристрою IP-адресу, щоб не вводити її вручну.'],
  ['wifi', 'Wi‑Fi', 'Бездротова мережа. Має назву (SSID) і пароль. Пароль має бути довгим — щонайменше 8 символів, краще 12+.'],
  ['brandmauer', 'Брандмауер', 'Охоронець, який вирішує за правилами, які підключення пропустити в комп’ютер і з нього.'],
  ['port', 'Порт', 'Номер «дверей» програми на комп’ютері: сайти — 80 і 443, віддалений робочий стіл — 3389, Minecraft — 25565.'],
  ['mac', 'MAC-адреса', 'Постійний номер мережевої плати, записаний на заводі. Вигляд: 3C-52-82-1A-7F-09. Роутер може за ним пускати чи не пускати пристрій.'],
  ['nat', 'NAT і переадресація портів', 'Усі домашні пристрої виходять в інтернет з однією зовнішньою адресою роутера. Щоб хтось з інтернету підключився до вашого ПК (наприклад, до сервера гри), на роутері налаштовують переадресацію порту.'],
  ['https', 'HTTPS', 'Захищене підключення: дані шифруються. Замок в адресному рядку означає HTTPS. Сторінка роутера зазвичай працює через HTTP — це нормально лише всередині домашньої мережі.'],
  ['fishing', 'Фішинг', 'Шахрайський сайт, що вдає з себе справжній, щоб украсти пароль або дані картки. Ознаки: «Ви виграли!», поспіх, дивна адреса.'],
  ['proshyvka', 'Прошивка', 'Програма всередині роутера. Оновлення прошивки виправляють помилки й закривають дірки в безпеці.'],
];
const procSlug = n => n.toLowerCase().replace(/\.exe$/, '');
const INDEX = [
  ...TERMS.map(([k, t, d]) => ({ url: `https://dovidka.edvault/${k}`, title: `${t} — Довідник термінів`, text: d })),
  ...SYS_PROCS.filter((p, i, a) => a.findIndex(x => x.name === p.name) === i).map(p => ({ url: `https://dovidka.edvault/proc/${procSlug(p.name)}`, title: `${p.name} — що це за процес?`, text: `${p.title}. ${p.desc}` })),
  { url: 'https://novyny.edvault/1', title: 'Як налаштувати домашній роутер і захистити Wi‑Fi — Новини', text: 'Відкрийте браузер, введіть 192.168.1.1, увійдіть (admin / admin), змініть пароль адміністратора, назву й пароль Wi‑Fi. Роутер налаштування.' },
  { url: 'https://novyny.edvault/2', title: 'Учні 7-Б зібрали шкільний сервер — Новини', text: 'Шкільний сервер для проєктів інформатики. Порти, переадресація, мережа.' },
  { url: 'https://novyny.edvault/3', title: 'Фішинг: як не потрапити на гачок — Новини', text: 'Шахрайські сайти, «ви виграли приз», паролі, картка, безпека в інтернеті.' },
  { url: 'https://novyny.edvault/4', title: 'Тиждень буде сонячним — Новини', text: 'Погода прогноз сонце.' },
  { url: 'https://shkola.edvault/', title: 'Школа №1 — головна', text: 'Оголошення, розклад уроків, контакти школи.' },
  { url: 'https://shkola.edvault/rozklad', title: 'Розклад уроків — Школа №1', text: 'Розклад математика інформатика українська англійська.' },
  { url: 'https://fayly.edvault/', title: 'Файли для уроків — завантажити', text: 'Підручник, шпалери, музика, конспект, гра, архів завантаження файлів.' },
  { url: 'https://pogoda.edvault/', title: 'Погода в Україні на 5 днів', text: 'Київ Львів Одеса Харків Дніпро прогноз погода температура.' },
  { url: 'https://pryz-vygraj.edvault/', title: 'ВИ ВИГРАЛИ ТЕЛЕФОН!!! Заберіть приз', text: 'Приз виграш телефон безкоштовно акція.' },
  { url: 'https://edvault.online/', title: 'Edvault — навчальні інструменти й тренажери', text: 'Edvault тренажери інструменти навчання інформатика.' },
];
function searchIndex(q) {
  const words = q.toLocaleLowerCase('uk').split(/[\s,.?!]+/).filter(w => w.length > 1);
  if (!words.length) return [];
  return INDEX.map(r => { const hay = (r.title + ' ' + r.text + ' ' + r.url).toLocaleLowerCase('uk'); const score = words.reduce((a, w) => a + (hay.includes(w) ? (r.title.toLocaleLowerCase('uk').includes(w) ? 3 : 1) : 0), 0); return [score, r]; })
    .filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).map(x => x[1]);
}

/* ── спільний «каркас» сайту ── */
const shell = (host, nav, body, cls = '') => {
  const s = EDU_SITES[host] || OWN[host];
  return `<div class="site ${cls}" style="--sc:${s.color}"><header class="site-h"><a href="/" class="site-logo">${FAVICON(host, 28)}<b>${esc(s.title)}</b></a><nav>${nav.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}</nav></header><main class="site-m">${body}</main><footer class="site-f">© 2026 ${esc(s.title)} · навчальний сайт Edvault</footer></div>`;
};
const NEWS = [
  { t: 'Як налаштувати домашній роутер і захистити Wi‑Fi', d: '10 жовтня', img: 'router', body: ['Роутер — серце домашньої мережі. Його налаштування відкриваються просто в браузері: введіть адресу основного шлюзу (найчастіше <b>192.168.1.1</b>) і увійдіть.', 'Перше, що варто зробити, — <b>змінити пароль адміністратора</b>. Стандартний admin / admin знає кожен.', 'Далі — назва мережі Wi‑Fi (SSID) і пароль. Обирайте шифрування <b>WPA2</b> або <b>WPA3</b> і пароль із 12+ символів.', 'Корисно також оновити прошивку й вимкнути WPS — ця кнопка зручна, але менш безпечна.', 'Спробуйте самі: відкрийте <a href="http://192.168.1.1/">192.168.1.1</a>.'] },
  { t: 'Учні 7-Б зібрали шкільний сервер', d: '8 жовтня', img: 'chip', body: ['На уроках інформатики учні запустили сервер для шкільних проєктів.', 'Щоб друзі могли підключатися з дому, на роутері налаштували <b>переадресацію порту</b>: запити на зовнішній порт 8080 роутер пересилає на комп’ютер-сервер у шкільній мережі.', '«Найважче було зрозуміти, що таке NAT», — каже Олена. Пояснення є в <a href="https://dovidka.edvault/nat">довіднику</a>.'] },
  { t: 'Фішинг: як не потрапити на гачок', d: '5 жовтня', img: 'shield', body: ['Шахраї створюють сайти, які обіцяють приз, щоб вам захотілося швидко ввести дані.', 'Ознаки фішингу: «Ви виграли!», таймер, дивна адреса сайту, прохання ввести пароль чи номер картки.', 'Браузер часто попереджає червоною сторінкою «Небезпечний сайт». Не ігноруйте її!'] },
  { t: 'Тиждень буде сонячним', d: '4 жовтня', img: 'zap', body: ['Синоптики обіцяють теплий і сонячний тиждень по всій країні.', 'Детальний прогноз — на <a href="https://pogoda.edvault/">pogoda.edvault</a>.'] },
];
const FILES = [
  { name: 'Підручник_інформатика_7клас.pdf', size: 2516582, desc: 'Підручник для 7 класу, 214 сторінок' },
  { name: 'Шпалери_космос.jpg', size: 1835008, desc: 'Картинка для робочого стола 1920×1080' },
  { name: 'Пісня_для_уроку_музики.mp3', size: 4404019, desc: 'Аудіо, 3 хв 41 с' },
  { name: 'Конспект_мережі.txt', size: 0, desc: 'Короткий конспект про мережі', content: 'Конспект: мережі\r\n\r\nIP-адреса — номер пристрою в мережі.\r\nОсновний шлюз — адреса роутера (192.168.1.1).\r\nDNS — перетворює назви сайтів на IP-адреси.\r\nDHCP — автоматично видає IP-адреси.\r\n\r\nКоманди: ipconfig, ping, nslookup, tracert.' },
  { name: 'Проєкт_презентація.zip', size: 3250585, desc: 'Архів із шаблоном презентації' },
  { name: 'super_game_FREE_setup.exe', size: 18874368, desc: 'Безкоштовна гра!!! (від невідомого автора)', danger: true },
];
const CITIES = { kyiv: 'Київ', lviv: 'Львів', odesa: 'Одеса', kharkiv: 'Харків', dnipro: 'Дніпро' };
const DAYS = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function sitePage(u, ctx) {
  const host = u.hostname.toLocaleLowerCase('uk'), path = decodeURIComponent(u.pathname).replace(/\/+$/, '') || '/', q = u.searchParams;
  if (host === 'poshuk.edvault') {
    if (path === '/search') {
      const query = q.get('q') || '', res = searchIndex(query);
      return { title: `${query} — Пошук`, html: `<div class="site srch" style="--sc:#1a73c8"><header class="srch-h"><a href="/" class="site-logo">${FAVICON(host, 28)}<b>Пошук</b></a><form action="/search" class="srch-f">${ui('search', 17)}<input name="q" value="${esc(query)}" autocomplete="off" spellcheck="false"></form></header>
        <main class="srch-m"><p class="srch-n">Знайдено результатів: ${res.length} (0,${String(12 + res.length * 3).padStart(2, '0')} с)</p>${res.length ? res.map(r => { const ru = new URL(r.url); return `<div class="srch-r"><small>${FAVICON(ru.hostname, 16)}${esc(ru.hostname + (ru.pathname !== '/' ? ru.pathname.replace(/\//g, ' › ') : ''))}</small><a href="${r.url}">${esc(r.title)}</a><p>${esc(r.text)}</p></div>`; }).join('') : `<div class="srch-none"><p>За запитом <b>${esc(query)}</b> нічого не знайдено.</p><p>Спробуйте інші слова, наприклад: <a href="/search?q=роутер">роутер</a>, <a href="/search?q=DNS">DNS</a>, <a href="/search?q=погода">погода</a>, <a href="/search?q=svchost">svchost</a>.</p></div>`}</main></div>` };
    }
    return { title: 'Пошук', html: `<div class="site srch home" style="--sc:#1a73c8"><div class="srch-big">${FAVICON(host, 64)}<h1>Пошук</h1><form action="/search" class="srch-f big">${ui('search', 19)}<input name="q" placeholder="Що шукаємо?" autocomplete="off" spellcheck="false" autofocus></form>
      <p class="srch-sug">Популярне: ${['як налаштувати роутер', 'що таке DNS', 'погода', 'svchost.exe', 'фішинг'].map(x => `<a href="/search?q=${encodeURIComponent(x)}">${x}</a>`).join(' · ')}</p></div></div>`, bind: el => setTimeout(() => el.querySelector('input')?.focus(), 30) };
  }
  if (host === 'novyny.edvault') {
    const nav = [['/', 'Головна'], ['/1', 'Технології'], ['/3', 'Безпека'], ['/4', 'Погода']];
    const art = /^\/(\d)$/.exec(path);
    if (art && NEWS[+art[1] - 1]) { const n = NEWS[+art[1] - 1]; return { title: `${n.t} — Новини`, html: shell(host, nav, `<article class="art"><p class="art-d">${n.d} · Технології</p><h1>${n.t}</h1><div class="art-img">${ui(n.img, 64)}</div>${n.body.map(p => `<p>${p}</p>`).join('')}<p><a href="/">← Усі новини</a></p></article>`) }; }
    return { title: 'Новини', html: shell(host, nav, `<h1 class="site-t">Головні новини</h1><div class="news">${NEWS.map((n, i) => `<a class="news-c" href="/${i + 1}"><span class="news-img">${ui(n.img, 40)}</span><small>${n.d}</small><b>${n.t}</b><span>${n.body[0].replace(/<[^>]+>/g, '').slice(0, 110)}…</span></a>`).join('')}</div>`) };
  }
  if (host === 'shkola.edvault') {
    const nav = [['/', 'Головна'], ['/rozklad', 'Розклад'], ['/kontakty', 'Контакти']];
    if (path === '/rozklad') {
      const R = [['Понеділок', 'Математика', 'Українська мова', 'Історія', 'Фізкультура'], ['Вівторок', 'Англійська', 'Біологія', 'Інформатика', 'Математика'], ['Середа', 'Фізика', 'Географія', 'Українська література', 'Музика'], ['Четвер', 'Математика', 'Інформатика', 'Англійська', 'Мистецтво'], ['П’ятниця', 'Хімія', 'Історія', 'Фізкультура', 'Класна година']];
      return { title: 'Розклад — Школа №1', html: shell(host, nav, `<h1 class="site-t">Розклад уроків 7-Б</h1><table class="site-tbl"><thead><tr><th>День</th><th>1 урок</th><th>2 урок</th><th>3 урок</th><th>4 урок</th></tr></thead><tbody>${R.map(r => `<tr><th>${r[0]}</th>${r.slice(1).map(x => `<td class="${x === 'Інформатика' ? 'hl' : ''}">${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`) };
    }
    if (path === '/kontakty') {
      return { title: 'Контакти — Школа №1', html: shell(host, nav, `<h1 class="site-t">Напишіть нам</h1><div class="site-2"><div><p><b>Адреса:</b> вул. Шкільна, 1</p><p><b>Телефон:</b> (044) 000-00-01</p><p><b>Пошта:</b> school1@shkola.edvault</p></div>
        <form class="site-form" data-js><label>Ваше ім’я<input class="inp" name="n" autocomplete="off"></label><label>Пошта<input class="inp" name="e" autocomplete="off" placeholder="name@example.com"></label><label>Повідомлення<textarea class="inp" name="m" rows="4"></textarea></label><p class="form-err" hidden></p><button class="btn primary">Надіслати</button></form></div>`),
        bind: el => { const f = el.querySelector('form'); f.addEventListener('submit', e => { e.preventDefault(); const err = f.querySelector('.form-err'), v = k => f[k].value.trim();
          const bad = !v('n') ? 'Вкажіть ім’я.' : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('e')) ? 'Пошта має виглядати так: name@example.com' : v('m').length < 5 ? 'Повідомлення занадто коротке.' : '';
          if (bad) { err.hidden = false; err.textContent = bad; return; }
          f.outerHTML = `<div class="form-ok">${ui('check', 28)}<b>Дякуємо, ${esc(v('n'))}!</b><p>Повідомлення надіслано. Відповідь прийде на ${esc(v('e'))}.</p></div>`; }); } };
    }
    return { title: 'Школа №1', html: shell(host, nav, `<section class="hero"><h1>Ласкаво просимо до Школи №1!</h1><p>Тут — оголошення, розклад і контакти.</p></section><h2 class="site-t">Оголошення</h2><div class="ann">
      <div><b>14 жовтня</b><p>Олімпіада з інформатики: реєстрація до 12 жовтня в кабінеті 204.</p></div><div><b>17 жовтня</b><p>Екскурсія до IT-компанії для 7–8 класів.</p></div><div><b>20 жовтня</b><p>Батьківські збори о 18:00.</p></div></div>`) };
  }
  if (host === 'fayly.edvault') {
    return { title: 'Файли для уроків', html: shell(host, [['/', 'Усі файли']], `<h1 class="site-t">Файли для уроків</h1><p class="site-p">Натисніть «Завантажити» — файл з’явиться в папці <b>Завантаження</b>. Відкрийте Провідник і перевірте!</p>
      <div class="files">${FILES.map((f, i) => `<div class="file-r${f.danger ? ' danger' : ''}">${ui(f.danger ? 'warn' : 'file', 30)}<div><b>${esc(f.name)}</b><small>${esc(f.desc)} · ${f.content ? Math.max(1, Math.round(new TextEncoder().encode(f.content).length / 1024)) + ' КБ' : (f.size / 1048576).toFixed(1).replace('.', ',') + ' МБ'}</small></div><button class="btn${f.danger ? '' : ' primary'}" data-dl="${i}">${ui('download', 15)} Завантажити</button></div>`).join('')}</div>`),
      bind: (el, c) => el.addEventListener('click', e => { const b = e.target.closest('[data-dl]'); if (!b) return; const f = FILES[+b.dataset.dl]; c.download({ name: f.name, size: f.content ? new TextEncoder().encode(f.content).length : f.size, content: f.content, danger: f.danger }); }) };
  }
  if (host === 'pogoda.edvault') {
    const c = CITIES[q.get('city')] ? q.get('city') : 'kyiv';
    let x = 0; for (const ch of c) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
    const today = new Date(), days = Array.from({ length: 5 }, (_, i) => { const v = (x >>> (i * 3)) % 7; return { d: i ? DAYS[(today.getDay() + i) % 7] : 'Сьогодні', t: 9 + v + (i % 2), n: 2 + (v % 4), sky: ['sun', 'sun', 'cloud', 'rain', 'sun', 'cloud', 'sun'][v] }; });
    const sky = { sun: ['zap', 'Сонячно'], cloud: ['globe', 'Хмарно'], rain: ['eye', 'Дощ'] };
    return { title: `Погода: ${CITIES[c]}`, html: shell(host, [['/', 'Прогноз']], `<form class="wx-f"><label>Місто: <select class="inp" name="city">${Object.entries(CITIES).map(([k, t]) => `<option value="${k}" ${k === c ? 'selected' : ''}>${t}</option>`).join('')}</select></label><button class="btn primary">Показати</button></form>
      <h1 class="site-t">${CITIES[c]}: прогноз на 5 днів</h1><div class="wx">${days.map(d => `<div class="wx-d"><b>${d.d}</b><span class="wx-i ${d.sky}">${ui(sky[d.sky][0], 34)}</span><big>+${d.t}°</big><small>вночі +${d.n}°</small><span>${sky[d.sky][1]}</span></div>`).join('')}</div>`),
      bind: el => el.querySelector('select').addEventListener('change', e => e.target.form.requestSubmit()) };
  }
  if (host === 'dovidka.edvault') {
    const nav = [['/', 'Усі терміни']];
    const pm = /^\/proc\/(.+)$/.exec(path);
    if (pm) { const ps = SYS_PROCS.filter(p => procSlug(p.name) === pm[1]); if (ps.length) return { title: `${ps[0].name} — Довідник`, html: shell(host, nav, `<article class="art"><h1>${esc(ps[0].name)}</h1>${ps.map(p => `<h3>${esc(p.title)}</h3><p>${esc(p.desc)}</p>`).join('')}<p class="${ps[0].critical ? 'warn-box' : 'ok-box'}">${ps[0].critical ? 'Це критичний процес Windows. Якщо його завершити в Диспетчері завдань, комп’ютер перестане працювати й перезавантажиться.' : 'Цей процес можна безпечно завершити — після перезавантаження він запуститься знову.'}</p><p>Чи це не вірус? Справжній ${esc(ps[0].name)} лежить у C:\\Windows\\System32. Якщо файл із такою назвою лежить деінде — це підозріло.</p></article>`) }; }
    const t = TERMS.find(x => '/' + x[0] === path);
    if (t) return { title: `${t[1]} — Довідник`, html: shell(host, nav, `<article class="art"><h1>${t[1]}</h1><p>${t[2]}</p><p><a href="/">← Усі терміни</a></p></article>`) };
    return { title: 'Довідник термінів', html: shell(host, nav, `<h1 class="site-t">Довідник комп’ютерних термінів</h1><div class="terms">${TERMS.map(([k, n, d]) => `<a href="/${k}"><b>${n}</b><span>${d.slice(0, 80)}…</span></a>`).join('')}</div>`) };
  }
  if (host === 'pryz-vygraj.edvault') {
    if (!ctx.tab.allowDanger) return { danger: true, secure: 'danger', title: 'Небезпечний сайт', html: `<div class="danger-pg"><div>${ui('warn', 64)}<h1>Небезпечний сайт</h1><p>Сайт <b>${esc(host)}</b> може обманом змусити вас ввести пароль, номер телефону чи дані банківської картки.</p><p>Браузер знає, що на цьому сайті раніше крали дані.</p><div class="danger-b"><button class="btn primary" data-safe>Повернутися в безпечне місце</button><button class="link" data-go>Деталі: все одно перейти (не рекомендовано)</button></div></div></div>`,
      bind: (el, c) => el.addEventListener('click', e => { if (e.target.closest('[data-safe]')) c.nav('browser://newtab/'); if (e.target.closest('[data-go]')) { c.tab.allowDanger = true; c.reload(); } }) };
    return { secure: 'danger', title: 'ВИ ВИГРАЛИ!!!', html: `<div class="phish"><h1>ВІТАЄМО!!! ВИ ВИГРАЛИ НОВИЙ ТЕЛЕФОН!</h1><p class="ph-t">Залишилось <b data-timer>04:59</b> — встигніть забрати!</p><form class="ph-f" data-js><label>Номер телефону<input class="inp" autocomplete="off"></label><label>Номер картки (для доставки)<input class="inp" autocomplete="off"></label><button class="btn primary">ЗАБРАТИ ПРИЗ</button></form></div>`,
      bind: el => { let s = 299; const tm = setInterval(() => { const b = el.querySelector('[data-timer]'); if (!b) return clearInterval(tm); s = Math.max(0, s - 1); b.textContent = `0${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }, 1000);
        el.querySelector('form').addEventListener('submit', e => { e.preventDefault(); el.innerHTML = `<div class="trap">${ui('shield', 56)}<h1>Це була пастка!</h1><p>Справжній шахрай щойно отримав би ваш номер телефону й картки. Добре, що це навчальний сайт і нічого нікуди не надіслано.</p><ul><li>Ніхто не дарує телефони просто так.</li><li>Таймер «встигніть забрати» — щоб ви не встигли подумати.</li><li>Браузер попереджав червоною сторінкою, а адреса сайту була дивною.</li></ul><p><a href="https://novyny.edvault/3">Як розпізнати фішинг →</a></p></div>`; });
        return () => clearInterval(tm); } };
  }
  if (OWN[host]) return { title: 'Edvault', html: shell(host, [['/', 'Головна']], `<section class="hero"><h1>Edvault</h1><p>Навчальні інструменти й тренажери з інформатики.</p></section><p class="site-p">Ви зараз у навчальному емуляторі Windows. Тут можна сміливо пробувати: налаштовувати брандмауер, роутер, працювати з файлами й консоллю.</p>`) };
  return null;
}
