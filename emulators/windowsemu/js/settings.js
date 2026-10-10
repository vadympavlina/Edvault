// Емулятор Windows · «Параметри» → Система → Відновлення → «Скинути цей ПК».
import { appIcon, ui, winLogo } from './icons.js';
import { WM, esc, modal } from './ui.js';
import { USER } from './fs.js';

export class SettingsApp {
  constructor(sys) {
    this.sys = sys;
    this.win = WM.open({ app: 'settings', exe: 'SystemSettings.exe', title: 'Параметри', icon: appIcon('settings', 16), w: 860, h: 560, minW: 560, minH: 380 });
    this.win.body.innerHTML = `<div class="st-app">
      <aside class="sa-side"><div class="sa-user"><span class="av big">У</span><span><b>${USER}</b><small>Локальний обліковий запис</small></span></div>
        <button class="sa-n on">${ui('apps', 18)}<span>Система</span></button></aside>
      <main class="sa-main"><p class="sa-crumb">Система <span>›</span> <b>Відновлення</b></p>
        <section class="sa-pc">${winLogo(40)}<div><b>EDVAULT-PC</b><small>Windows 11 Навчальна · версія 24H2</small></div></section>
        <p class="sa-lead">Якщо з комп’ютером щось не так або хочеться почати з нуля, його можна скинути — він стане таким, яким був на самому початку.</p>
        <h3>Параметри відновлення</h3>
        <section class="sa-card">${ui('restore', 22)}<div><b>Скинути цей ПК</b><small>Видалити все, що ви зробили, і повернути комп’ютер до заводських налаштувань</small></div><button class="btn" data-reset>Скинути ПК</button></section>
        <section class="sa-card">${ui('power', 22)}<div><b>Перезавантажити зараз</b><small>Закрити всі програми й увімкнути комп’ютер знову. Файли залишаться.</small></div><button class="btn" data-reboot>Перезавантажити</button></section>
      </main></div>`;
    this.win.body.addEventListener('click', e => {
      if (e.target.closest('[data-reset]')) this.reset();
      if (e.target.closest('[data-reboot]')) sys.reboot();
    });
  }
  reset() {
    const items = ['Усі ваші файли й папки (Документи, Робочий стіл, Завантаження, диск D:)', 'Кошик', 'Налаштування брандмауера та всі правила', 'Налаштування роутера (знову логін admin і пароль admin)', 'Історію, закладки й завантаження браузера', 'Налаштування Провідника й автозавантаження'];
    modal({ title: 'Скинути цей ПК', cls: 'reset-dlg', html: `<h3>Скинути цей ПК?</h3><p>Буде видалено:</p><ul class="reset-l">${items.map(t => `<li>${ui('close', 14)}<span>${esc(t)}</span></li>`).join('')}</ul>
      <p class="note">${ui('info', 15)}<span>Це навчальний комп’ютер: після скидання він стане точно таким, яким був на першому уроці.</span></p>
      <label class="chk"><input type="checkbox" data-sure> Я розумію, що все буде видалено</label>`,
      buttons: [{ t: 'Скинути', v: 'go', primary: true }, { t: 'Скасувати', v: null, cancel: true }],
      onOpen: api => { const b = api.button(0); b.disabled = true; api.$('[data-sure]').addEventListener('change', e => { b.disabled = !e.target.checked; }); },
      onButton: v => { if (v === 'go') this.sys.factoryReset(); } });
  }
}
