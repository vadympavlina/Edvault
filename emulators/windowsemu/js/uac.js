// Емулятор Windows · «Контроль облікових записів користувачів» (UAC). Навчальні дані адміністратора: admin / admin.
import { esc, h } from './ui.js';

export const ADMIN = { user: 'admin', pass: 'admin' };
// uac({ app, icon, file }) → Promise<true|false>
export function uac({ app, icon, file = 'C:\\Windows\\System32\\mmc.exe' }) {
  return new Promise(res => {
    const el = h(`<div class="uac-back"><div class="uac" role="dialog" aria-label="Контроль облікових записів користувачів">
      <header>Контроль облікових записів користувачів</header>
      <div class="uac-body"><h3>Дозволити цій програмі вносити зміни на вашому пристрої?</h3>
        <div class="uac-app">${icon || ''}<div><b>${esc(app)}</b><span>Видавець перевірений: Microsoft Windows</span></div></div>
        <button class="uac-more" type="button">Показати додаткові відомості</button>
        <div class="uac-info" hidden>Розташування програми: ${esc(file)}<br>Видавець сертифіката: Microsoft Windows</div>
        <p>Щоб продовжити, введіть ім’я користувача та пароль адміністратора.</p>
        <div class="uac-cred"><span class="uac-av">${'<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>'}</span>
          <div class="uac-in"><input class="uac-user" placeholder="Ім’я користувача" autocomplete="off" spellcheck="false"><input class="uac-pass" type="password" placeholder="Пароль" autocomplete="off"><span class="uac-err" hidden></span></div></div></div>
      <footer><button class="btn primary uac-yes">Так</button><button class="btn uac-no">Ні</button></footer></div></div>`);
    document.body.appendChild(el);
    const $ = s => el.querySelector(s), user = $('.uac-user'), pass = $('.uac-pass');
    const done = v => { el.classList.add('out'); document.removeEventListener('keydown', key, true); setTimeout(() => el.remove(), 150); res(v); };
    const yes = () => {
      if (user.value.trim().toLowerCase() === ADMIN.user && pass.value === ADMIN.pass) return done(true);
      const err = $('.uac-err'); err.hidden = false;
      err.textContent = !user.value.trim() || !pass.value ? 'Введіть ім’я користувача та пароль.' : 'Неправильне ім’я користувача або пароль.';
      pass.value = ''; (user.value.trim() ? pass : user).focus();
      $('.uac').classList.remove('shake'); void $('.uac').offsetWidth; $('.uac').classList.add('shake');
    };
    $('.uac-yes').onclick = yes; $('.uac-no').onclick = () => done(false);
    $('.uac-more').onclick = () => { const i = $('.uac-info'); i.hidden = !i.hidden; $('.uac-more').textContent = i.hidden ? 'Показати додаткові відомості' : 'Сховати додаткові відомості'; };
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (document.activeElement === user && !pass.value) pass.focus(); else yes(); } };
    document.addEventListener('keydown', key, true);
    user.focus(); setTimeout(() => { if (!el.contains(document.activeElement)) user.focus(); }, 30);
  });
}
