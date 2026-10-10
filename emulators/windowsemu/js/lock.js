// Емулятор Windows · екран блокування та вхід. Обліковий запис учня: ім’я admin, пароль admin (змінити не можна).
import { USER, LOGIN, LOGIN_PASS, fmtTime } from './fs.js';
import { ui } from './icons.js';
import { WM, h, menu, closeMenu, $ } from './ui.js';

export function installLock(sys) {
  const el = h(`<div id="lock" class="lk" hidden>
    <div class="lk-face"><b class="lk-time"></b><span class="lk-date"></span><p class="lk-hint">Клацніть або натисніть будь-яку клавішу, щоб увійти</p></div>
    <form class="lk-in" hidden autocomplete="off">
      <span class="lk-av">${USER[0]}</span><b class="lk-name">${USER}</b>
      <input class="lk-user" placeholder="Ім’я користувача" spellcheck="false" autocomplete="off" aria-label="Ім’я користувача">
      <span class="lk-pw"><input class="lk-pass" type="password" placeholder="Пароль" autocomplete="off" aria-label="Пароль"><button class="lk-go" type="submit" title="Увійти">${ui('forward', 18)}</button></span>
      <p class="lk-caps" hidden>${ui('warn', 14)}Увімкнено Caps Lock</p>
      <p class="lk-err" hidden></p>
      <button class="lk-forgot" type="button">Не пам’ятаю пароль</button>
      <p class="lk-help" hidden>Пароль від навчального комп’ютера знає вчитель. Для навчання: ім’я <b>admin</b>, пароль <b>admin</b>.</p>
    </form>
    <div class="lk-wait" hidden><i class="spin"></i><span></span></div>
    <div class="lk-corner"><span class="lk-ic" title="Мережа">${ui('wifi', 20)}</span><button class="lk-ic lk-power" type="button" title="Живлення">${ui('power', 20)}</button></div>
  </div>`);
  document.body.appendChild(el);
  const q = s => el.querySelector(s), face = q('.lk-face'), form = q('.lk-in'), wait = q('.lk-wait'), user = q('.lk-user'), pass = q('.lk-pass'), err = q('.lk-err');
  let inerted = [], tick = 0, tries = 0;
  const clock = () => { const d = new Date(); q('.lk-time').textContent = fmtTime(d); q('.lk-date').textContent = d.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' }); };
  // поки екран заблоковано, до робочого столу не можна дістатися ні мишкою, ні клавіатурою
  const freeze = on => {
    if (on) { inerted = [...document.body.children].filter(x => x !== el && x.id !== 'boot' && x.id !== 'toast' && x.tagName !== 'SCRIPT' && !x.inert); inerted.forEach(x => { x.inert = true; }); }
    else { inerted.forEach(x => { x.inert = false; }); inerted = []; }
  };
  const view = v => {
    face.hidden = v !== 'face'; form.hidden = v !== 'form'; wait.hidden = v !== 'wait';
    el.classList.toggle('blur', v !== 'face');
    if (v === 'form') { err.hidden = true; q('.lk-help').hidden = true; user.value = ''; pass.value = ''; user.focus(); setTimeout(() => { if (!form.contains(document.activeElement)) user.focus(); }, 30); }
  };
  const show = () => {
    closeMenu(); sys.closeStart?.(); document.getElementById('netFly') && import('./netui.js').then(m => m.closeNetFlyout());
    clock(); clearInterval(tick); tick = setInterval(clock, 10000);
    el.hidden = false; freeze(true); view('face'); tries = 0;
  };
  const enter = () => { if (face.hidden) return; view('form'); };
  el.addEventListener('pointerdown', e => { if (!face.hidden && !e.target.closest('.lk-corner')) { e.preventDefault(); enter(); } });
  // поки екран заблоковано, клавіші бачить лише екран входу (вікна UAC чи діалоги під ним не перехоплять Enter)
  addEventListener('keydown', e => {
    if (el.hidden) return;
    e.stopImmediatePropagation();
    if (!el.contains(e.target)) { e.preventDefault(); if (!face.hidden) enter(); else if (!form.hidden) user.focus(); return; }
    if (!face.hidden) { e.preventDefault(); enter(); return; }
    if (e.key === 'Escape' && !form.hidden) { view('face'); return; }
    if (e.target === pass || e.target === user) q('.lk-caps').hidden = !e.getModifierState?.('CapsLock');
  }, true);
  form.addEventListener('submit', e => {
    e.preventDefault();
    const u = user.value.trim().toLowerCase(), p = pass.value;
    if (!u || !p) { err.textContent = !u ? 'Введіть ім’я користувача.' : 'Введіть пароль.'; err.hidden = false; (!u ? user : pass).focus(); return; }
    if (u !== LOGIN || p !== LOGIN_PASS) {
      tries++;
      err.textContent = u !== LOGIN ? 'Такого користувача немає на цьому комп’ютері. Перевірте ім’я.' : 'Неправильний пароль. Повторіть спробу.';
      err.hidden = false; pass.value = ''; (u !== LOGIN ? user : pass).focus();
      if (tries >= 3) q('.lk-help').hidden = false;
      form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
      return;
    }
    q('.lk-wait span').textContent = 'Ласкаво просимо'; view('wait');
    setTimeout(() => { el.hidden = true; clearInterval(tick); freeze(false); sys.onSignIn?.(); }, 650);
  });
  q('.lk-forgot').addEventListener('click', () => { q('.lk-help').hidden = false; });
  q('.lk-power').addEventListener('click', e => {
    const b = e.currentTarget;
    menu(0, 0, [{ t: 'Перезавантажити', icon: 'refresh', on: () => { el.hidden = true; freeze(false); clearInterval(tick); sys.reboot(); } }], { anchor: b });
    const m = document.querySelector('.cm-root'); if (m) { m.inert = false; const r = m.getBoundingClientRect(), a = b.getBoundingClientRect(); m.style.top = (a.top - r.height - 6) + 'px'; m.style.left = (a.right - r.width) + 'px'; m.style.zIndex = 10001; }
  });

  sys.lock = show;
  sys.isLocked = () => !el.hidden;
  sys.signOut = async () => {
    closeMenu(); sys.closeStart?.();
    for (const w of [...WM.wins]) await w.close();
    if (WM.wins.length) return; // користувач скасував закриття (наприклад, незбережений файл)
    show(); q('.lk-wait span').textContent = 'Вихід'; view('wait');
    setTimeout(() => view('face'), 700);
  };
  // Win + L
  document.addEventListener('keydown', e => { if (e.metaKey && e.code === 'KeyL' && el.hidden) { e.preventDefault(); show(); } });
  return el;
}
