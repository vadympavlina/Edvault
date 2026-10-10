// Емулятор Windows · «Параметри»: Мережа й Інтернет, Облікові записи, Система → Відновлення.
import { appIcon, ui, winLogo } from './icons.js';
import { WM, esc, modal } from './ui.js';
import { USER, LOGIN, batched } from './fs.js';
import { networkPage, networkClick } from './netui.js';

const NAV = [['network', 'globe', 'Мережа й Інтернет'], ['accounts', 'person', 'Облікові записи'], ['system', 'apps', 'Система']];

export class SettingsApp {
  constructor(sys, page) {
    this.sys = sys; this.page = NAV.some(n => n[0] === page) ? page : 'system';
    this.win = WM.open({ app: 'settings', exe: 'SystemSettings.exe', title: 'Параметри', icon: appIcon('settings', 16), w: 860, h: 580, minW: 560, minH: 380 });
    this.win.body.innerHTML = `<div class="st-app">
      <aside class="sa-side"><div class="sa-user"><span class="av big">${USER[0]}</span><span><b>${USER}</b><small>Локальний обліковий запис</small></span></div>
        ${NAV.map(([k, ic, t]) => `<button class="sa-n" data-nav="${k}">${ui(ic, 18)}<span>${t}</span></button>`).join('')}</aside>
      <main class="sa-main"></main></div>`;
    this.win.body.addEventListener('click', e => {
      const n = e.target.closest('[data-nav]'); if (n) return this.go(n.dataset.nav);
      if (e.target.closest('[data-reset]')) this.reset();
      if (e.target.closest('[data-reboot]')) sys.reboot();
      if (e.target.closest('[data-lock]')) sys.lock();
      if (e.target.closest('[data-signout]')) sys.signOut();
      if (e.target.closest('[data-pw]')) this.passwordInfo();
      const np = e.target.closest('[data-np]'); if (np) networkClick(sys, np);
    });
    const later = batched(() => this.win.el.isConnected && this.page === 'network' && this.render());
    this.win.cleanup(sys.fs.on(w => { if (w === 'net' || w === 'reset') later(); }));
    this.render();
  }
  go(page) { if (NAV.some(n => n[0] === page)) { this.page = page; this.render(); } }
  render() {
    this.win.body.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === this.page));
    const main = this.win.body.querySelector('.sa-main'), top = main.scrollTop;
    main.innerHTML = this.page === 'network' ? networkPage(this.sys) : this.page === 'accounts' ? this.accounts() : this.system();
    main.scrollTop = top;
  }
  accounts() {
    return `<p class="sa-crumb">Облікові записи</p>
      <section class="sa-pc"><span class="av huge">${USER[0]}</span><div><b>${USER}</b><small>Ім’я для входу: ${LOGIN}</small><small>Локальний обліковий запис · Стандартний користувач</small></div></section>
      <p class="sa-lead">Це обліковий запис учня. Ним можна користуватися, але змінити пароль чи тип облікового запису може лише вчитель (адміністратор комп’ютера).</p>
      <h3>Параметри входу</h3>
      <section class="sa-card">${ui('key', 22)}<div><b>Пароль</b><small>Пароль на навчальному комп’ютері змінює лише вчитель</small></div><button class="btn" data-pw>Змінити</button></section>
      <section class="sa-card off">${ui('shield', 22)}<div><b>Тип облікового запису</b><small>Стандартний користувач. Для змін у системі потрібні ім’я й пароль адміністратора.</small></div><span class="sa-tag">Стандартний</span></section>
      <h3>Сеанс</h3>
      <section class="sa-card">${ui('lock', 22)}<div><b>Заблокувати</b><small>Екран блокування; щоб повернутися, знову введіть пароль.</small></div><button class="btn" data-lock>Заблокувати</button></section>
      <section class="sa-card">${ui('logout', 22)}<div><b>Вийти</b><small>Закрити всі програми й вийти з облікового запису</small></div><button class="btn" data-signout>Вийти</button></section>`;
  }
  passwordInfo() {
    modal({ title: 'Змінення пароля', cls: 'small', html: `<p class="ns-msg">${ui('lock', 20)}<span><b>Змінити пароль не можна.</b><br>Це навчальний комп’ютер, і пароль облікового запису змінює лише вчитель (адміністратор). Так ніхто випадково не заблокує комп’ютер для інших учнів.</span></p>
      <p class="sa-hint">У справжньому житті пароль змінюють тут: «Параметри» → «Облікові записи» → «Параметри входу» → «Пароль». Добрий пароль — довгий (від 12 символів), із літер, цифр і знаків, і не такий, як на інших сайтах.</p>`, buttons: [{ t: 'Зрозуміло', v: null, primary: true, cancel: true }] });
  }
  system() {
    return `<p class="sa-crumb">Система <span>›</span> <b>Відновлення</b></p>
      <section class="sa-pc">${winLogo(40)}<div><b>EDVAULT-PC</b><small>Windows 11 Навчальна · версія 24H2</small></div></section>
      <p class="sa-lead">Якщо з комп’ютером щось не так або хочеться почати з нуля, його можна скинути — він стане таким, яким був на самому початку.</p>
      <h3>Параметри відновлення</h3>
      <section class="sa-card">${ui('restore', 22)}<div><b>Скинути цей ПК</b><small>Видалити все, що ви зробили, і повернути комп’ютер до заводських налаштувань</small></div><button class="btn" data-reset>Скинути ПК</button></section>
      <section class="sa-card">${ui('power', 22)}<div><b>Перезавантажити зараз</b><small>Закрити всі програми й увімкнути комп’ютер знову. Файли залишаться.</small></div><button class="btn" data-reboot>Перезавантажити</button></section>`;
  }
  reset() {
    const items = ['Усі ваші файли й папки (Документи, Робочий стіл, Завантаження, диск D:)', 'Кошик', 'Налаштування брандмауера та всі правила', 'Налаштування мережі й збережені паролі Wi‑Fi', 'Налаштування роутера (знову логін admin і пароль admin)', 'Історію, закладки й завантаження браузера', 'Налаштування Провідника й автозавантаження'];
    modal({ title: 'Скинути цей ПК', cls: 'reset-dlg', html: `<h3>Скинути цей ПК?</h3><p>Буде видалено:</p><ul class="reset-l">${items.map(t => `<li>${ui('close', 14)}<span>${esc(t)}</span></li>`).join('')}</ul>
      <p class="note">${ui('info', 15)}<span>Це навчальний комп’ютер: після скидання він стане точно таким, яким був на першому уроці.</span></p>
      <label class="chk"><input type="checkbox" data-sure> Я розумію, що все буде видалено</label>`,
      buttons: [{ t: 'Скинути', v: 'go', primary: true }, { t: 'Скасувати', v: null, cancel: true }],
      onOpen: api => { const b = api.button(0); b.disabled = true; api.$('[data-sure]').addEventListener('change', e => { b.disabled = !e.target.checked; }); },
      onButton: v => { if (v === 'go') this.sys.factoryReset(); } });
  }
}
