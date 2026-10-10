// Емулятор Windows · екран блокування та вхід у стилі Windows 11. Обліковий запис учня: ім’я admin, пароль admin (змінити не можна).
import { USER, LOGIN, LOGIN_PASS, fmtTime } from './fs.js';
import { ui } from './icons.js';
import { WM, h, menu, closeMenu } from './ui.js';
import { primary, WIFI } from './net.js';

// стандартний аватар Windows 11 (сірий силует)
const AVATAR = s => `<svg class="lk-avsvg" width="${s}" height="${s}" viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="48" r="48" fill="#dadada" fill-opacity=".92"/><circle cx="48" cy="38" r="15" fill="#7d7d7d"/><path d="M20 77c3.5-13 15-21 28-21s24.5 8 28 21a46 46 0 0 1-56 0z" fill="#7d7d7d"/></svg>`;
// кільце з точок, як у Windows під час входу
const DOTS = '<span class="lk-dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';
const ICO = {
  net: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
  nonet: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M5 12.86a10 10 0 0 1 14 0M2 8.82a15 15 0 0 1 20 0" opacity=".35"/><path d="m4 4 16 16"/></svg>',
  wifi: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M5 12.86a10 10 0 0 1 14 0M2 8.82a15 15 0 0 1 20 0"/></svg>',
  access: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="7.2" r="1.2"/><path d="M7.5 9.8 12 11l4.5-1.2M12 11v3.2M12 14.2l-2.2 4.3M12 14.2l2.2 4.3"/></svg>',
  power: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 2.5v9"/><path d="M17.7 6.3a8 8 0 1 1-11.4 0"/></svg>',
  eye: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/></svg>',
  go: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M14 6l6 6-6 6"/></svg>',
};

export function installLock(sys) {
  const el = h(`<div id="lock" class="lk" hidden>
    <div class="lk-face"><div class="lk-clock"><b class="lk-time"></b><span class="lk-date"></span></div></div>
    <div class="lk-sign">
      <form class="lk-in" autocomplete="off" hidden>
        ${AVATAR(192)}<b class="lk-name">Інший користувач</b>
        <div class="lk-fields">
          <label class="lk-box"><input class="lk-user" placeholder="Ім’я користувача" spellcheck="false" autocomplete="off" aria-label="Ім’я користувача"></label>
          <label class="lk-box pw"><input class="lk-pass" type="password" placeholder="Пароль" autocomplete="off" aria-label="Пароль"><button class="lk-eye" type="button" tabindex="-1" title="Показати пароль" hidden>${ICO.eye}</button><button class="lk-go" type="submit" title="Увійти">${ICO.go}</button></label>
          <p class="lk-caps" hidden>Увімкнено Caps Lock</p>
          <p class="lk-to">Увійти до: EDVAULT-PC</p>
          <button class="lk-forgot" type="button">Я не пам’ятаю свій пароль</button>
          <p class="lk-help" hidden>Пароль від навчального комп’ютера знає вчитель. Для навчання: ім’я користувача <b>admin</b>, пароль <b>admin</b>.</p>
        </div>
        <div class="lk-msg" hidden><p class="lk-err"></p><button class="lk-ok" type="button">OK</button></div>
      </form>
      <div class="lk-wait" hidden>${AVATAR(192)}<b class="lk-name">${USER}</b>${DOTS}<span class="lk-wtext"></span></div>
      <div class="lk-users"><button class="lk-u on" type="button">${AVATAR(32)}<span>Інший користувач</span></button></div>
    </div>
    <div class="lk-corner"><button class="lk-ic lk-net" type="button"></button><button class="lk-ic lk-acc" type="button" title="Спеціальні можливості">${ICO.access}</button><button class="lk-ic lk-power" type="button" title="Живлення">${ICO.power}</button></div>
    <div class="lk-black" hidden><button class="lk-on" type="button" hidden>${ICO.power}<span>Увімкнути комп’ютер</span></button></div>
  </div>`);
  document.body.appendChild(el);
  const q = s => el.querySelector(s), face = q('.lk-face'), form = q('.lk-in'), wait = q('.lk-wait'), user = q('.lk-user'), pass = q('.lk-pass');
  const fields = q('.lk-fields'), msg = q('.lk-msg'), black = q('.lk-black');
  let inerted = [], tick = 0, tries = 0, state = 'off';
  const clock = () => { const d = new Date(); q('.lk-time').textContent = fmtTime(d); q('.lk-date').textContent = d.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' }); };
  // значок мережі внизу праворуч показує справжній стан підключення
  const netIcon = () => { const a = primary(sys.fs), b = q('.lk-net'); b.innerHTML = !a ? ICO.nonet : a.id === 'wifi' ? ICO.wifi : ICO.net; b.title = a ? `${a.ssid || a.net.name}\nДоступ до Інтернету` : 'Немає підключення до Інтернету'; };
  // поки екран заблоковано, до робочого столу не можна дістатися ні мишкою, ні клавіатурою
  const freeze = on => {
    if (on) { inerted = [...document.body.children].filter(x => x !== el && x.id !== 'boot' && x.id !== 'toast' && x.tagName !== 'SCRIPT' && !x.inert); inerted.forEach(x => { x.inert = true; }); }
    else { inerted.forEach(x => { x.inert = false; }); inerted = []; }
  };
  const focusUser = () => { const f = user.value ? pass : user; f.focus(); setTimeout(() => { if (state === 'form' && !form.contains(document.activeElement)) f.focus(); }, 30); };
  const view = v => {
    state = v;
    el.classList.toggle('up', v !== 'face');
    form.hidden = v !== 'form' && v !== 'msg'; wait.hidden = v !== 'wait';
    fields.hidden = v !== 'form'; msg.hidden = v !== 'msg';
    q('.lk-users').hidden = v === 'wait';
    if (v === 'face') { face.hidden = false; user.value = ''; pass.value = ''; syncEye(); }
    if (v === 'form') focusUser();
    if (v === 'msg') q('.lk-ok').focus();
  };
  // екран із годинником «їде» вгору, як у Windows 11
  face.addEventListener('transitionend', () => { if (state !== 'face') face.hidden = true; });
  const show = () => {
    closeMenu(); sys.closeStart?.(); document.getElementById('netFly') && import('./netui.js').then(m => m.closeNetFlyout());
    clock(); netIcon(); clearInterval(tick); tick = setInterval(clock, 10000);
    el.hidden = false; black.hidden = true; freeze(true); tries = 0; view('face');
  };
  const hide = () => { el.hidden = true; clearInterval(tick); freeze(false); state = 'off'; };
  const enter = () => { if (state === 'face') { view('form'); q('.lk-help').hidden = true; } };
  const syncEye = () => { q('.lk-eye').hidden = !pass.value; if (!pass.value) pass.type = 'password'; };

  el.addEventListener('pointerdown', e => {
    if (state === 'face' && !e.target.closest('.lk-corner')) { e.preventDefault(); enter(); }
    if (state === 'sleep') { e.preventDefault(); wake(); }
  });
  // поки екран заблоковано, клавіші бачить лише екран входу (вікна UAC чи діалоги під ним не перехоплять Enter)
  addEventListener('keydown', e => {
    if (el.hidden) return;
    e.stopImmediatePropagation();
    if (state === 'sleep') { e.preventDefault(); wake(); return; }
    if (e.key === 'Escape' && document.querySelector('.cm-root.lk-menu')) { e.preventDefault(); closeMenu(); return; }
    if (state === 'face') { e.preventDefault(); enter(); return; }
    if (!el.contains(e.target)) { e.preventDefault(); if (state === 'form') focusUser(); else if (state === 'msg') q('.lk-ok').focus(); return; }
    if (e.key === 'Escape' && (state === 'form' || state === 'msg')) { e.preventDefault(); view('face'); return; }
    if (state === 'msg' && e.key === 'Enter') { e.preventDefault(); backToForm(); return; }
    if (e.target === pass || e.target === user) q('.lk-caps').hidden = !e.getModifierState?.('CapsLock');
  }, true);
  pass.addEventListener('input', syncEye);
  // «око»: пароль видно, поки кнопку тримають натиснутою
  const eye = q('.lk-eye');
  eye.addEventListener('pointerdown', e => { e.preventDefault(); pass.type = 'text'; });
  for (const t of ['pointerup', 'pointerleave', 'pointercancel']) eye.addEventListener(t, () => { pass.type = 'password'; });
  const backToForm = () => { view('form'); pass.value = ''; syncEye(); if (tries >= 2) q('.lk-help').hidden = false; pass.focus(); };
  q('.lk-ok').addEventListener('click', backToForm);
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (state !== 'form') return;
    const u = user.value.trim().toLowerCase(), p = pass.value;
    if (!u) { user.focus(); return; }
    if (!p) { pass.focus(); return; }
    if (u !== LOGIN || p !== LOGIN_PASS) {
      tries++;
      q('.lk-err').textContent = 'Неправильне ім’я користувача або пароль. Повторіть спробу.';
      view('msg');
      return;
    }
    q('.lk-wtext').textContent = 'Ласкаво просимо'; view('wait');
    setTimeout(() => { if (state === 'wait') { hide(); sys.onSignIn?.(); } }, 1100);
  });
  q('.lk-forgot').addEventListener('click', () => { q('.lk-help').hidden = false; });
  q('.lk-u').addEventListener('click', () => { if (state === 'msg') backToForm(); else focusUser(); });

  // живлення: сон, завершення роботи, перезавантаження
  const wake = () => { black.hidden = true; view('face'); };
  const sleep = () => { state = 'sleep'; black.hidden = false; q('.lk-on').hidden = true; };
  const shutdown = () => {
    sys.closeAll(); state = 'wait'; el.classList.add('up'); form.hidden = true; q('.lk-users').hidden = true; wait.hidden = false;
    q('.lk-wtext').textContent = 'Завершення роботи';
    setTimeout(() => { state = 'offscreen'; black.hidden = false; q('.lk-on').hidden = false; }, 1600);
  };
  const restart = () => {
    sys.closeAll(); state = 'wait'; el.classList.add('up'); form.hidden = true; q('.lk-users').hidden = true; wait.hidden = false;
    q('.lk-wtext').textContent = 'Перезавантаження';
    setTimeout(() => { hide(); sys.reboot(); }, 1400);
  };
  q('.lk-on').addEventListener('click', () => { hide(); sys.reboot(); });
  const pop = (b, items) => {
    menu(0, 0, items, { anchor: b });
    const m = document.querySelector('.cm-root'); if (m) { m.inert = false; m.classList.add('lk-menu'); const r = m.getBoundingClientRect(), a = b.getBoundingClientRect(); m.style.top = (a.top - r.height - 8) + 'px'; m.style.left = Math.min(innerWidth - r.width - 8, a.left + a.width / 2 - r.width / 2) + 'px'; m.style.zIndex = 10001; }
  };
  q('.lk-power').addEventListener('click', e => pop(e.currentTarget, [{ t: 'Режим сну', icon: 'clock', on: sleep }, { t: 'Завершити роботу', icon: 'power', on: shutdown }, { t: 'Перезавантажити', icon: 'refresh', on: restart }]));
  q('.lk-acc').addEventListener('click', e => pop(e.currentTarget, [{ t: el.classList.contains('big') ? 'Звичайний текст' : 'Збільшений текст', icon: 'zoomIn', on: () => el.classList.toggle('big') }, { t: el.classList.contains('hc') ? 'Вимкнути контрастність' : 'Висока контрастність', icon: 'eye', on: () => el.classList.toggle('hc') }]));
  q('.lk-net').addEventListener('click', e => { const a = primary(sys.fs); pop(e.currentTarget, [{ t: a ? `Підключено: ${a.ssid || a.net.name}` : 'Немає підключення', icon: a?.id === 'wifi' ? 'wifi' : 'network', on: () => {} }, ...WIFI.filter(w => w.ssid !== a?.ssid).slice(0, 2).map(w => ({ t: `${w.ssid} — увійдіть, щоб підключитися`, icon: 'wifi', disabled: true }))]); });

  sys.lock = show;
  sys.isLocked = () => !el.hidden;
  sys.signOut = async () => {
    closeMenu(); sys.closeStart?.();
    for (const w of [...WM.wins]) await w.close();
    if (WM.wins.length) return; // користувач скасував закриття (наприклад, незбережений файл)
    show(); state = 'wait'; el.classList.add('up'); face.hidden = true; form.hidden = true; q('.lk-users').hidden = true; wait.hidden = false;
    q('.lk-wtext').textContent = 'Вихід';
    setTimeout(() => view('face'), 900);
  };
  // Win + L
  document.addEventListener('keydown', e => { if (e.metaKey && e.code === 'KeyL' && el.hidden) { e.preventDefault(); show(); } });
  return el;
}
