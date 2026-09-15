/* =============================================================
   TV Display — оболонка для онлайн-розкладу академії
   Чистий JS, без збірки, без залежностей, без backend.

   Що робить цей файл:
     1. Монтує iframe із розкладом один раз і більше його не чіпає.
     2. Тримає Screen Wake Lock із коректним lifecycle і backoff.
     3. Керує Fullscreen (тільки після жесту користувача).
     4. Дає приховану службову панель із реальним статусом.

   Чого цей файл НЕ робить (свідомо):
     - не читає і не змінює DOM сайту розкладу;
     - не імітує активність користувача (клік/миша/клавіші/відео);
     - не обходить X-Frame-Options, CSP чи вимогу user gesture;
     - не бачить, не зберігає і не передає логін та пароль.
   ============================================================= */

'use strict';

/* ------------------------------------------------------------------
   КОНФІГУРАЦІЯ
   ------------------------------------------------------------------ */
const CONFIG = {
  SCHEDULE_URL:
    'https://lb.itstep.org/schedule?rooms=180,173,167,178,170,175,81,78,72,69,5,70,73,75,6,7,10,66,8,9,68,3,4,1,67',

  // Скільки чекати події load від iframe, перш ніж вважати це проблемою
  FRAME_LOAD_TIMEOUT_MS: 20000,

  // Backoff для повторних спроб Wake Lock (мс). Останнє значення повторюється.
  WAKE_LOCK_BACKOFF: [1000, 3000, 5000, 10000, 30000],

  // Скільки кліків у верхньому лівому кутку відкривають службову панель
  CORNER_TAPS: 5,
  CORNER_TAP_WINDOW_MS: 4000,

  // Ключі localStorage. Жодних credentials тут немає і бути не може.
  LS_AUTOSTART: 'tvDisplay.autoStart',
  LS_TV_PREF: 'tvModePreference',

  LOG_LIMIT: 200
};

/* ------------------------------------------------------------------
   СТАН
   ------------------------------------------------------------------ */
const state = {
  tvModeActive: false,
  frameMounted: false,
  frameStatus: 'NOT MOUNTED',   // NOT MOUNTED | LOADING | LOADED | BLOCKED | TIMEOUT
  wakeLock: null,
  wakeLockStatus: 'UNKNOWN',    // ACTIVE | RELEASED | FAILED | NOT SUPPORTED | RETRYING
  wakeLockRetryIndex: 0,
  wakeLockRetryTimer: null,
  wakeLockRequestInFlight: false,
  lastWakeRequest: null,
  lastWakeRelease: null,
  frameTimeoutTimer: null,
  cornerTaps: [],
  startedAt: Date.now(),
  logs: []
};

/* ------------------------------------------------------------------
   DOM
   ------------------------------------------------------------------ */
const el = {
  body: document.body,
  frameLayer: document.getElementById('frameLayer'),
  frame: document.getElementById('scheduleFrame'),
  launcher: document.getElementById('launcher'),
  startBtn: document.getElementById('startBtn'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  metaUrl: document.getElementById('metaUrl'),
  metaWakeSupport: document.getElementById('metaWakeSupport'),
  autoStartToggle: document.getElementById('autoStartToggle'),
  cornerTap: document.getElementById('cornerTap'),

  resume: document.getElementById('resumeOverlay'),
  resumeTitle: document.getElementById('resumeTitle'),
  resumeText: document.getElementById('resumeText'),
  resumeBtn: document.getElementById('resumeBtn'),

  debug: document.getElementById('debugPanel'),
  debugClose: document.getElementById('debugClose'),
  debugLog: document.getElementById('debugLog'),
  dbgTv: document.getElementById('dbgTv'),
  dbgFs: document.getElementById('dbgFs'),
  dbgWl: document.getElementById('dbgWl'),
  dbgVis: document.getElementById('dbgVis'),
  dbgFrame: document.getElementById('dbgFrame'),
  dbgWlReq: document.getElementById('dbgWlReq'),
  dbgWlRel: document.getElementById('dbgWlRel'),
  dbgUptime: document.getElementById('dbgUptime'),
  dbgViewport: document.getElementById('dbgViewport'),
  dbgScreen: document.getElementById('dbgScreen'),
  dbgOnline: document.getElementById('dbgOnline'),
  dbgUa: document.getElementById('dbgUa'),
  dbgDiag: document.getElementById('dbgDiag'),
  dbgWakeNow: document.getElementById('dbgWakeNow'),
  dbgReload: document.getElementById('dbgReload'),
  dbgExit: document.getElementById('dbgExit')
};

/* ------------------------------------------------------------------
   ДОПОМІЖНЕ
   ------------------------------------------------------------------ */
function now() {
  return new Date().toLocaleTimeString('uk-UA', { hour12: false });
}

function log(message) {
  state.logs.push('[' + now() + '] ' + message);
  if (state.logs.length > CONFIG.LOG_LIMIT) state.logs.shift();
  if (el.debugLog) {
    el.debugLog.textContent = state.logs.join('\n');
    el.debugLog.scrollTop = el.debugLog.scrollHeight;
  }
}

function setStatus(text, kind) {
  el.statusText.textContent = text;
  el.statusDot.className = 'dot dot--' + (kind || 'ready');
}

function safeStorage(action, key, value) {
  try {
    if (action === 'get') return window.localStorage.getItem(key);
    if (action === 'set') { window.localStorage.setItem(key, value); return true; }
    if (action === 'remove') { window.localStorage.removeItem(key); return true; }
  } catch (e) {
    return null; // приватний режим / вимкнене сховище — не аварія
  }
  return null;
}

function isFullscreen() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

/* ------------------------------------------------------------------
   IFRAME
   Монтується рівно один раз. Після цього ми його не перезавантажуємо —
   сайт розкладу сам оновлює дані приблизно кожні 2 хвилини, і ламати
   цей механізм не можна.
   ------------------------------------------------------------------ */
function mountFrame() {
  if (state.frameMounted) return;

  state.frameMounted = true;
  state.frameStatus = 'LOADING';
  el.frameLayer.classList.add('is-mounted');
  el.frameLayer.setAttribute('aria-hidden', 'false');
  el.frame.src = CONFIG.SCHEDULE_URL;
  log('iframe змонтовано: ' + CONFIG.SCHEDULE_URL);

  state.frameTimeoutTimer = window.setTimeout(function () {
    if (state.frameStatus === 'LOADING') {
      state.frameStatus = 'TIMEOUT';
      log('УВАГА: iframe не повідомив про завантаження за ' +
          (CONFIG.FRAME_LOAD_TIMEOUT_MS / 1000) + ' с.');
      showResume(
        'Розклад не завантажується',
        'Перевірте мережу. Якщо сайт відкривається в окремій вкладці, але не тут — його заборонено вбудовувати, і потрібен запасний варіант із інструкції.'
      );
    }
  }, CONFIG.FRAME_LOAD_TIMEOUT_MS);

  el.frame.addEventListener('load', onFrameLoad);
}

function onFrameLoad() {
  window.clearTimeout(state.frameTimeoutTimer);

  /* Перевірка вбудовуваності — виключно читання, без жодної роботи з DOM
     чужого сайту:
       - cross-origin документ завантажився  → contentDocument === null;
       - фрейм заблоковано (X-Frame-Options / CSP frame-ancestors)
         → браузер лишає same-origin about:blank, доступний на читання. */
  let blocked = false;
  try {
    const doc = el.frame.contentDocument;
    if (doc && doc.location && doc.location.href === 'about:blank') blocked = true;
  } catch (e) {
    blocked = false; // SecurityError означає, що чужий документ таки є
  }

  if (blocked) {
    state.frameStatus = 'BLOCKED';
    log('ПОМИЛКА: lb.itstep.org забороняє вбудовування (X-Frame-Options / CSP).');
    showResume(
      'Сайт забороняє вбудовування',
      'lb.itstep.org не дозволяє показувати себе всередині іншої сторінки. Використайте запасний варіант із інструкції — відкрити розклад напряму й тримати екран активним налаштуваннями телевізора.'
    );
  } else {
    state.frameStatus = 'LOADED';
    log('iframe завантажено.');
  }
  updateDebug();
}

/* ------------------------------------------------------------------
   SCREEN WAKE LOCK
   Життєвий цикл:
     TV Mode ON → request
       → release (браузером або системою) → backoff-повтор
       → повернення видимості → request
     TV Mode OFF → release
   Ніяких викликів «щосекунди».
   ------------------------------------------------------------------ */
function wakeLockSupported() {
  return 'wakeLock' in navigator && navigator.wakeLock &&
         typeof navigator.wakeLock.request === 'function';
}

async function requestWakeLock() {
  if (!wakeLockSupported()) {
    state.wakeLockStatus = 'NOT SUPPORTED';
    updateDebug();
    return false;
  }
  if (state.wakeLock || state.wakeLockRequestInFlight) return true;
  if (document.visibilityState !== 'visible') {
    // Специфікація дозволяє Wake Lock лише для видимого документа.
    state.wakeLockStatus = 'RETRYING';
    updateDebug();
    return false;
  }

  state.wakeLockRequestInFlight = true;
  try {
    const lock = await navigator.wakeLock.request('screen');
    state.wakeLock = lock;
    state.wakeLockStatus = 'ACTIVE';
    state.wakeLockRetryIndex = 0;
    state.lastWakeRequest = now();
    log('Wake Lock отримано.');

    lock.addEventListener('release', function () {
      state.wakeLock = null;
      state.lastWakeRelease = now();
      log('Wake Lock відпущено системою.');
      if (state.tvModeActive) {
        state.wakeLockStatus = 'RETRYING';
        scheduleWakeLockRetry();
      } else {
        state.wakeLockStatus = 'RELEASED';
      }
      updateDebug();
    });

    updateDebug();
    return true;
  } catch (error) {
    state.wakeLock = null;
    state.wakeLockStatus = 'FAILED';
    state.lastWakeRequest = now();
    log('Wake Lock не вдалося отримати: ' + (error && error.name ? error.name : error));
    if (state.tvModeActive) scheduleWakeLockRetry();
    updateDebug();
    return false;
  } finally {
    state.wakeLockRequestInFlight = false;
  }
}

function scheduleWakeLockRetry() {
  if (!state.tvModeActive) return;
  window.clearTimeout(state.wakeLockRetryTimer);

  const steps = CONFIG.WAKE_LOCK_BACKOFF;
  const delay = steps[Math.min(state.wakeLockRetryIndex, steps.length - 1)];
  state.wakeLockRetryIndex += 1;

  log('Повторна спроба Wake Lock через ' + (delay / 1000) + ' с.');
  state.wakeLockRetryTimer = window.setTimeout(function () {
    requestWakeLock();
  }, delay);
}

async function releaseWakeLock() {
  window.clearTimeout(state.wakeLockRetryTimer);
  state.wakeLockRetryIndex = 0;
  if (state.wakeLock) {
    try {
      await state.wakeLock.release();
      log('Wake Lock відпущено (вихід із TV Mode).');
    } catch (e) {
      log('Помилка під час release: ' + e);
    }
    state.wakeLock = null;
    state.lastWakeRelease = now();
  }
  state.wakeLockStatus = wakeLockSupported() ? 'RELEASED' : 'NOT SUPPORTED';
  updateDebug();
}

/* ------------------------------------------------------------------
   FULLSCREEN
   Викликається тільки з обробника реального кліку/натискання клавіші.
   ------------------------------------------------------------------ */
async function enterFullscreen() {
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  if (!request) {
    log('Fullscreen API недоступний у цьому браузері.');
    return false;
  }
  try {
    await request.call(root, { navigationUI: 'hide' });
    log('Fullscreen увімкнено.');
    return true;
  } catch (error) {
    log('Fullscreen відхилено: ' + (error && error.name ? error.name : error));
    return false;
  }
}

async function exitFullscreen() {
  if (!isFullscreen()) return;
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (!exit) return;
  try { await exit.call(document); } catch (e) { /* ігноруємо */ }
}

/* ------------------------------------------------------------------
   TV MODE
   ------------------------------------------------------------------ */
async function enterTvMode(options) {
  const opts = options || {};
  state.tvModeActive = true;
  el.body.classList.add('tv-mode');
  hideResume();
  mountFrame();
  safeStorage('set', CONFIG.LS_TV_PREF, 'true');
  log('TV Mode увімкнено.');

  if (opts.withGesture) {
    await enterFullscreen();
  }
  await requestWakeLock();

  if (!opts.withGesture && !isFullscreen()) {
    showResume(
      'Потрібне одне натискання',
      'Браузер вмикає повний екран лише після дії користувача. Натисніть кнопку — і телевізор перейде в повноекранний режим.'
    );
  }
  updateDebug();
}

async function exitTvMode() {
  state.tvModeActive = false;
  el.body.classList.remove('tv-mode');
  hideResume();
  await releaseWakeLock();
  await exitFullscreen();
  safeStorage('set', CONFIG.LS_TV_PREF, 'false');
  setStatus('TV Mode вимкнено', 'warn');
  log('TV Mode вимкнено. iframe залишається завантаженим.');
  updateDebug();
}

function showResume(title, text) {
  el.resumeTitle.textContent = title;
  el.resumeText.textContent = text;
  el.resume.hidden = false;
}

function hideResume() {
  el.resume.hidden = true;
}

/* ------------------------------------------------------------------
   СЛУЖБОВА ПАНЕЛЬ
   ------------------------------------------------------------------ */
function toggleDebug(force) {
  const show = typeof force === 'boolean' ? force : el.debug.hidden;
  el.debug.hidden = !show;
  if (show) updateDebug();
}

function formatUptime(ms) {
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return h + ':' + m + ':' + s;
}

function updateDebug() {
  if (el.debug.hidden) return;
  el.dbgTv.textContent = state.tvModeActive ? 'ACTIVE' : 'INACTIVE';
  el.dbgFs.textContent = isFullscreen() ? 'ACTIVE' : 'INACTIVE';
  el.dbgWl.textContent = state.wakeLock ? 'ACTIVE' : state.wakeLockStatus;
  el.dbgVis.textContent = document.visibilityState.toUpperCase();
  el.dbgFrame.textContent = state.frameStatus;
  el.dbgWlReq.textContent = state.lastWakeRequest || '—';
  el.dbgWlRel.textContent = state.lastWakeRelease || '—';
  el.dbgUptime.textContent = formatUptime(Date.now() - state.startedAt);
  el.dbgViewport.textContent = window.innerWidth + '×' + window.innerHeight +
    ' @' + (window.devicePixelRatio || 1) + 'x';
  el.dbgScreen.textContent = screen.width + '×' + screen.height;
  el.dbgOnline.textContent = navigator.onLine ? 'ONLINE' : 'OFFLINE';
  el.dbgUa.textContent = navigator.userAgent;
}

/* ------------------------------------------------------------------
   ДІАГНОСТИКА
   ------------------------------------------------------------------ */
function runDiagnostics() {
  const root = document.documentElement;
  let orientation = 'невідомо';
  try {
    if (screen.orientation && screen.orientation.type) orientation = screen.orientation.type;
  } catch (e) { /* ігноруємо */ }

  const storageOk = safeStorage('set', 'tvDisplay.__probe', '1') === true;
  if (storageOk) safeStorage('remove', 'tvDisplay.__probe');

  const report = {
    'Wake Lock API': wakeLockSupported() ? 'підтримується' : 'НЕ підтримується',
    'Wake Lock зараз': state.wakeLock ? 'ACTIVE' : state.wakeLockStatus,
    'Fullscreen API': (root.requestFullscreen || root.webkitRequestFullscreen)
      ? 'підтримується' : 'НЕ підтримується',
    'Fullscreen дозволено': (document.fullscreenEnabled !== false) ? 'так' : 'ні',
    'Fullscreen зараз': isFullscreen() ? 'ACTIVE' : 'INACTIVE',
    'Iframe': state.frameStatus,
    'Iframe URL': CONFIG.SCHEDULE_URL,
    'Viewport': window.innerWidth + '×' + window.innerHeight +
                ' @' + (window.devicePixelRatio || 1) + 'x',
    'Screen': screen.width + '×' + screen.height + ', ' +
              (screen.colorDepth || '?') + ' bit',
    'Orientation': orientation,
    'Document visibility': document.visibilityState,
    'localStorage': storageOk ? 'доступний' : 'НЕДОСТУПНИЙ',
    'Мережа': navigator.onLine ? 'online' : 'offline',
    'Мов': navigator.language,
    'Browser': navigator.userAgent
  };

  log('--- Діагностика ---');
  Object.keys(report).forEach(function (key) {
    log(key + ': ' + report[key]);
  });
  log('--- Кінець діагностики ---');
  toggleDebug(true);
  return report;
}

// доступно з консолі браузера
window.runDiagnostics = runDiagnostics;

/* ------------------------------------------------------------------
   ПОДІЇ
   ------------------------------------------------------------------ */
el.startBtn.addEventListener('click', function () {
  setStatus('TV Mode активний', 'ok');
  enterTvMode({ withGesture: true });
});

el.resumeBtn.addEventListener('click', function () {
  hideResume();
  if (!state.tvModeActive) {
    enterTvMode({ withGesture: true });
  } else {
    enterFullscreen();
    requestWakeLock();
  }
});

el.autoStartToggle.addEventListener('change', function () {
  safeStorage('set', CONFIG.LS_AUTOSTART, this.checked ? 'true' : 'false');
  log('Автозапуск: ' + (this.checked ? 'увімкнено' : 'вимкнено'));
});

el.debugClose.addEventListener('click', function () { toggleDebug(false); });
el.dbgDiag.addEventListener('click', runDiagnostics);
el.dbgWakeNow.addEventListener('click', function () {
  state.wakeLockRetryIndex = 0;
  requestWakeLock();
});
el.dbgReload.addEventListener('click', function () {
  // Ручне перезавантаження — лише за явним натисканням.
  // Автоматично цього не робимо: сайт оновлює себе сам.
  if (state.frameMounted) {
    state.frameStatus = 'LOADING';
    el.frame.src = CONFIG.SCHEDULE_URL;
    log('Розклад перезавантажено вручну.');
  }
});
el.dbgExit.addEventListener('click', function () {
  toggleDebug(false);
  exitTvMode();
});

// 5 кліків у верхньому лівому кутку
el.cornerTap.addEventListener('click', function () {
  const t = Date.now();
  state.cornerTaps.push(t);
  state.cornerTaps = state.cornerTaps.filter(function (x) {
    return t - x < CONFIG.CORNER_TAP_WINDOW_MS;
  });
  if (state.cornerTaps.length >= CONFIG.CORNER_TAPS) {
    state.cornerTaps = [];
    toggleDebug(true);
  }
});

// Гарячі клавіші
document.addEventListener('keydown', function (event) {
  const key = (event.key || '').toLowerCase();

  if (event.ctrlKey && event.shiftKey && key === 'd') {
    event.preventDefault();
    toggleDebug();
    return;
  }
  if (event.ctrlKey && event.shiftKey && key === 'q') {
    event.preventDefault();
    exitTvMode();
    return;
  }
  if (event.ctrlKey && event.shiftKey && key === 'f') {
    // ручне повернення у fullscreen (це теж жест користувача)
    event.preventDefault();
    enterFullscreen();
    return;
  }
  if (key === 'escape' && state.tvModeActive) {
    // Escape у fullscreen браузер обробляє сам; тут — запасний вихід.
    exitTvMode();
  }
});

// Fullscreen змінився
document.addEventListener('fullscreenchange', onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);

function onFullscreenChange() {
  log('Fullscreen: ' + (isFullscreen() ? 'увімкнено' : 'вимкнено'));
  if (state.tvModeActive && !isFullscreen()) {
    showResume(
      'Повний екран вимкнено',
      'Натисніть кнопку або Ctrl + Shift + F, щоб повернути повноекранний режим. Wake Lock при цьому залишається активним.'
    );
  } else {
    hideResume();
  }
  updateDebug();
}

// Видимість документа
document.addEventListener('visibilitychange', function () {
  log('Видимість: ' + document.visibilityState);
  if (document.visibilityState === 'visible' && state.tvModeActive && !state.wakeLock) {
    state.wakeLockRetryIndex = 0;
    requestWakeLock();
  }
  updateDebug();
});

window.addEventListener('online',  function () { log('Мережа: online');  updateDebug(); });
window.addEventListener('offline', function () { log('Мережа: offline'); updateDebug(); });
window.addEventListener('resize',  updateDebug);

window.addEventListener('pagehide', function () {
  // Коректно віддаємо Wake Lock перед закриттям.
  if (state.wakeLock) { try { state.wakeLock.release(); } catch (e) {} }
});

// Один спокійний таймер на весь застосунок — лише для панелі статусу.
window.setInterval(updateDebug, 1000);

/* ------------------------------------------------------------------
   СТАРТ
   ------------------------------------------------------------------ */
(function init() {
  el.metaUrl.textContent = 'lb.itstep.org/schedule';
  el.metaWakeSupport.textContent = wakeLockSupported()
    ? 'підтримується браузером'
    : 'не підтримується цим браузером';
  if (!wakeLockSupported()) {
    state.wakeLockStatus = 'NOT SUPPORTED';
    setStatus('Wake Lock недоступний — див. інструкцію', 'warn');
  } else {
    setStatus('Готово до запуску', 'ready');
  }

  const autoStart = safeStorage('get', CONFIG.LS_AUTOSTART) === 'true';
  el.autoStartToggle.checked = autoStart;

  log('TV Display запущено. Автозапуск: ' + (autoStart ? 'увімкнено' : 'вимкнено'));

  if (autoStart) {
    /* Після перезавантаження сторінки жесту користувача немає.
       Тому вмикаємо те, що дозволено без жесту (iframe + спроба Wake Lock),
       і просимо одне натискання для Fullscreen. Обходів обмежень немає. */
    enterTvMode({ withGesture: false });
  }
})();
