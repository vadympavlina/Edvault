/* =============================================================
   TV Display — оболонка для онлайн-розкладу академії
   Чистий JS. Без збірки, без залежностей, без backend.

   Що робить:
     1. Монтує iframe із розкладом один раз і більше його не чіпає.
     2. Тримає Screen Wake Lock із коректним lifecycle і backoff.
     3. О CONFIG.endTime (локальний час) відпускає Wake Lock і
        більше не запитує його до наступного дня.
     4. Керує Fullscreen (тільки після жесту користувача).
     5. Дає приховану службову панель із реальним статусом.

   Чого не робить свідомо:
     - не читає і не змінює DOM сайту розкладу;
     - не імітує активність користувача;
     - не обходить X-Frame-Options, CSP чи вимогу user gesture;
     - не бачить, не зберігає і не передає логін та пароль.
   ============================================================= */

'use strict';

/* ==================================================================
   1. КОНФІГУРАЦІЯ
   ================================================================== */
const CONFIG = {
  scheduleUrl:
    'https://lb.itstep.org/schedule?rooms=180,173,167,178,170,175,81,78,72,69,5,70,73,75,6,7,10,66,8,9,68,3,4,1,67',

  endTime: '17:55',          // локальний час телевізора, формат HH:MM
  autoStartTVMode: false,    // значення за замовчуванням; користувач змінює в налаштуваннях
  enableWakeLock: true,

  frameLoadTimeoutMs: 20000,           // скільки чекати load від iframe
  wakeLockBackoff: [1000, 3000, 5000, 10000, 30000],
  tickMs: 5000,                        // єдиний фоновий таймер (легкий)
  debugTickMs: 1000,                   // працює лише поки відкрита панель
  cornerTaps: 5,
  cornerTapWindowMs: 4000,
  logLimit: 200,

  storageKeys: {
    autoStart: 'tvDisplay.autoStart',
    wakeEnabled: 'tvDisplay.wakeLockEnabled',
    endTime: 'tvDisplay.endTime'
  }
};

/* ==================================================================
   2. СТАН
   ================================================================== */
const state = {
  mode: 'IDLE',                 // IDLE | PREVIEW | TV MODE
  tvModeActive: false,
  frameVisible: false,
  frameMounted: false,
  frameStatus: 'NOT MOUNTED',   // NOT MOUNTED | LOADING | LOADED | BLOCKED | TIMEOUT

  wakeLock: null,
  wakeLockStatus: 'IDLE',       // IDLE | ACTIVE | RELEASED | RETRYING | FAILED | NOT SUPPORTED | DISABLED | DAY ENDED
  wakeRetryIndex: 0,
  wakeRetryTimer: null,
  wakeRequestInFlight: false,
  lastWakeRequest: null,
  lastWakeRelease: null,

  dayOver: false,
  settings: {
    autoStart: CONFIG.autoStartTVMode,
    wakeEnabled: CONFIG.enableWakeLock,
    endTime: CONFIG.endTime
  },

  frameTimeoutTimer: null,
  mainTimer: null,
  debugTimer: null,
  cornerTaps: [],
  noticeActions: { primary: null, secondary: null },
  startedAt: Date.now(),
  logs: []
};

/* ==================================================================
   3. DOM
   ================================================================== */
function $(id) { return document.getElementById(id); }

const el = {
  body: document.body,
  frameLayer: $('frameLayer'),
  frame: $('scheduleFrame'),
  launcher: $('launcher'),
  cornerTap: $('cornerTap'),

  startBtn: $('startBtn'),
  openBtn: $('openBtn'),
  fsBtn: $('fsBtn'),
  wakeBtn: $('wakeBtn'),
  settingsBtn: $('settingsBtn'),

  statusDot: $('statusDot'),
  statusText: $('statusText'),
  metaEnd: $('metaEnd'),

  settings: $('settings'),
  autoStartToggle: $('autoStartToggle'),
  wakeEnabledToggle: $('wakeEnabledToggle'),
  endTimeInput: $('endTimeInput'),

  notice: $('noticeOverlay'),
  noticeTitle: $('noticeTitle'),
  noticeText: $('noticeText'),
  noticePrimary: $('noticePrimary'),
  noticeSecondary: $('noticeSecondary'),

  debug: $('debugPanel'),
  debugClose: $('debugClose'),
  debugLog: $('debugLog'),
  dbgBanner: $('dbgBanner'),
  dbgMode: $('dbgMode'),
  dbgTv: $('dbgTv'),
  dbgFs: $('dbgFs'),
  dbgWl: $('dbgWl'),
  dbgVis: $('dbgVis'),
  dbgOnline: $('dbgOnline'),
  dbgFrame: $('dbgFrame'),
  dbgTime: $('dbgTime'),
  dbgDate: $('dbgDate'),
  dbgEnd: $('dbgEnd'),
  dbgLeft: $('dbgLeft'),
  dbgWlReq: $('dbgWlReq'),
  dbgWlRel: $('dbgWlRel'),
  dbgUptime: $('dbgUptime'),
  dbgViewport: $('dbgViewport'),
  dbgScreen: $('dbgScreen'),
  dbgUa: $('dbgUa'),
  dbgDiag: $('dbgDiag'),
  dbgWakeNow: $('dbgWakeNow'),
  dbgReload: $('dbgReload'),
  dbgExit: $('dbgExit')
};

/* ==================================================================
   4. ДОПОМІЖНЕ + DEFENSIVE PROGRAMMING
   Будь-яка помилка в обробнику потрапляє в лог, але не ламає wrapper.
   ================================================================== */
function timeString(date) {
  const d = date || new Date();
  return String(d.getHours()).padStart(2, '0') + ':' +
         String(d.getMinutes()).padStart(2, '0') + ':' +
         String(d.getSeconds()).padStart(2, '0');
}

function log(message) {
  state.logs.push('[' + timeString() + '] ' + message);
  if (state.logs.length > CONFIG.logLimit) state.logs.shift();
  if (el.debugLog && !el.debug.hidden) renderLog();
}

function renderLog() {
  el.debugLog.textContent = state.logs.join('\n');
  el.debugLog.scrollTop = el.debugLog.scrollHeight;
}

/** Обгортка для обробників подій: помилка не має ламати сторінку. */
function safe(fn, label) {
  return function () {
    try {
      const result = fn.apply(this, arguments);
      if (result && typeof result.catch === 'function') {
        result.catch(function (e) { log('Помилка (' + label + '): ' + describe(e)); });
      }
      return result;
    } catch (error) {
      log('Помилка (' + label + '): ' + describe(error));
    }
  };
}

function describe(error) {
  if (!error) return 'unknown';
  if (error.name) return error.name + (error.message ? ': ' + error.message : '');
  return String(error);
}

function on(target, type, handler, label) {
  target.addEventListener(type, safe(handler, label || type));
}

const storage = {
  get: function (key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  },
  set: function (key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
  },
  remove: function (key) {
    try { window.localStorage.removeItem(key); return true; } catch (e) { return false; }
  }
};

function setStatus(text, kind) {
  el.statusText.textContent = text;
  el.statusDot.className = 'dot dot--' + (kind || 'ready');
}

function isFullscreen() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

/* ==================================================================
   5. ЧАС І МЕЖА РОБОЧОГО ДНЯ
   Все рахується від локального часу пристрою і від ПОТОЧНОЇ дати,
   тому перехід через північ обробляється сам собою.
   ================================================================== */
function parseEndTime(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { hours: h, minutes: m };
}

/** Момент завершення роботи для того дня, якому належить `now`. */
function endMomentFor(now) {
  const parsed = parseEndTime(state.settings.endTime) || parseEndTime(CONFIG.endTime);
  const end = new Date(now.getTime());
  end.setHours(parsed.hours, parsed.minutes, 0, 0);
  return end;
}

function isDayOver(now) {
  return now.getTime() >= endMomentFor(now).getTime();
}

function msUntilEnd(now) {
  return endMomentFor(now).getTime() - now.getTime();
}

function formatDuration(ms) {
  if (ms <= 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  return String(Math.floor(total / 3600)).padStart(2, '0') + ':' +
         String(Math.floor((total % 3600) / 60)).padStart(2, '0') + ':' +
         String(total % 60).padStart(2, '0');
}

/** Єдина точка, де змінюється стан «робочий день завершено». */
function evaluateDay(silent) {
  const over = isDayOver(new Date());
  if (over === state.dayOver) return;
  state.dayOver = over;

  if (over) {
    log('Досягнуто ' + state.settings.endTime + ' — робочий день завершено.');
    log('Wake Lock вимкнено. Очікування автоматичного сну телевізора.');
    state.wakeRetryIndex = 0;
    window.clearTimeout(state.wakeRetryTimer);
    state.wakeRetryTimer = null;
    releaseWakeLock('DAY ENDED');
    if (!state.tvModeActive) setStatus('Робочий день завершено', 'warn');
  } else {
    log('Новий робочий день. Утримання екрана знову дозволене.');
    if (state.frameVisible) requestWakeLock();
    if (!state.tvModeActive) setStatus('Готово до запуску', 'ready');
  }
  if (!silent) updateBanner();
}

function updateBanner() {
  if (!el.dbgBanner) return;
  if (state.dayOver) {
    el.dbgBanner.textContent =
      'Робочий день завершено (' + state.settings.endTime + ')\n' +
      'Wake Lock вимкнено\n' +
      'Очікування автоматичного сну телевізора';
    el.dbgBanner.hidden = false;
  } else {
    el.dbgBanner.hidden = true;
  }
}

/* ==================================================================
   6. МЕНЕДЖЕР WAKE LOCK
   Один lock максимум. Після endTime не запитується взагалі.
   ================================================================== */
function wakeLockSupported() {
  return 'wakeLock' in navigator && navigator.wakeLock &&
         typeof navigator.wakeLock.request === 'function';
}

/** Чи дозволено зараз узагалі тримати екран. */
function wakeLockAllowed() {
  if (!wakeLockSupported()) { state.wakeLockStatus = 'NOT SUPPORTED'; return false; }
  if (!state.settings.wakeEnabled) { state.wakeLockStatus = 'DISABLED'; return false; }
  if (state.dayOver) { state.wakeLockStatus = 'DAY ENDED'; return false; }
  return true;
}

async function requestWakeLock() {
  if (!wakeLockAllowed()) { updateDebug(); return false; }
  if (state.wakeLock || state.wakeRequestInFlight) return true;

  if (document.visibilityState !== 'visible') {
    // Специфікація дозволяє Wake Lock лише для видимого документа.
    state.wakeLockStatus = 'RETRYING';
    updateDebug();
    return false;
  }

  state.wakeRequestInFlight = true;
  try {
    const lock = await navigator.wakeLock.request('screen');

    // Поки чекали на промис, день міг завершитися або режим — вимкнутися.
    if (state.dayOver || !state.settings.wakeEnabled) {
      try { await lock.release(); } catch (e) { /* ігноруємо */ }
      state.wakeLockStatus = state.dayOver ? 'DAY ENDED' : 'DISABLED';
      updateDebug();
      return false;
    }

    state.wakeLock = lock;
    state.wakeLockStatus = 'ACTIVE';
    state.wakeRetryIndex = 0;
    state.lastWakeRequest = timeString();
    log('Wake Lock отримано.');

    lock.addEventListener('release', safe(function () {
      if (state.wakeLock !== lock) return;      // вже замінений або відпущений нами
      state.wakeLock = null;
      state.lastWakeRelease = timeString();
      log('Wake Lock відпущено системою.');
      if (state.frameVisible && wakeLockAllowed()) {
        state.wakeLockStatus = 'RETRYING';
        scheduleWakeRetry();
      } else {
        if (!state.dayOver && state.settings.wakeEnabled) state.wakeLockStatus = 'RELEASED';
      }
      updateDebug();
    }, 'wakeLock release'));

    updateDebug();
    return true;
  } catch (error) {
    state.wakeLock = null;
    state.wakeLockStatus = 'FAILED';
    state.lastWakeRequest = timeString();
    log('Wake Lock не вдалося отримати: ' + describe(error));
    if (state.frameVisible) scheduleWakeRetry();
    updateDebug();
    return false;
  } finally {
    state.wakeRequestInFlight = false;
  }
}

function scheduleWakeRetry() {
  window.clearTimeout(state.wakeRetryTimer);
  state.wakeRetryTimer = null;
  if (!state.frameVisible || !wakeLockAllowed()) return;

  const steps = CONFIG.wakeLockBackoff;
  const delay = steps[Math.min(state.wakeRetryIndex, steps.length - 1)];
  state.wakeRetryIndex += 1;

  log('Повторна спроба Wake Lock через ' + (delay / 1000) + ' с.');
  state.wakeRetryTimer = window.setTimeout(safe(function () {
    state.wakeRetryTimer = null;       // інакше tick вважав би, що спроба ще триває
    requestWakeLock();
  }, 'wake retry'), delay);
}

async function releaseWakeLock(reason) {
  window.clearTimeout(state.wakeRetryTimer);
  state.wakeRetryTimer = null;
  state.wakeRetryIndex = 0;

  const lock = state.wakeLock;
  state.wakeLock = null;                 // спершу обнуляємо, щоб release-обробник не рестартував цикл
  if (lock) {
    try {
      await lock.release();
      state.lastWakeRelease = timeString();
      log('Wake Lock відпущено (' + (reason || 'вручну') + ').');
    } catch (error) {
      log('Помилка під час release: ' + describe(error));
    }
  }

  if (!wakeLockSupported()) state.wakeLockStatus = 'NOT SUPPORTED';
  else if (state.dayOver) state.wakeLockStatus = 'DAY ENDED';
  else if (!state.settings.wakeEnabled) state.wakeLockStatus = 'DISABLED';
  else state.wakeLockStatus = 'RELEASED';

  updateDebug();
}

/* ==================================================================
   7. FULLSCREEN
   Викликається тільки з обробника реального жесту користувача.
   ================================================================== */
async function enterFullscreen() {
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  if (!request) { log('Fullscreen API недоступний у цьому браузері.'); return false; }
  if (isFullscreen()) return true;
  try {
    await request.call(root, { navigationUI: 'hide' });
    return true;
  } catch (error) {
    log('Fullscreen відхилено: ' + describe(error));
    return false;
  }
}

async function exitFullscreen() {
  if (!isFullscreen()) return;
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (!exit) return;
  try { await exit.call(document); } catch (e) { /* ігноруємо */ }
}

/* ==================================================================
   8. IFRAME
   Монтується рівно один раз; далі не перезавантажується — сайт
   оновлює себе сам приблизно кожні 2 хвилини.
   ================================================================== */
function mountFrame() {
  if (state.frameMounted) return;

  state.frameMounted = true;
  state.frameStatus = 'LOADING';
  el.frameLayer.classList.add('is-mounted');
  el.frameLayer.setAttribute('aria-hidden', 'false');
  on(el.frame, 'load', onFrameLoad, 'iframe load');
  el.frame.src = CONFIG.scheduleUrl;
  log('iframe змонтовано.');

  state.frameTimeoutTimer = window.setTimeout(safe(function () {
    if (state.frameStatus !== 'LOADING') return;
    state.frameStatus = 'TIMEOUT';
    log('УВАГА: iframe не повідомив про завантаження за ' +
        (CONFIG.frameLoadTimeoutMs / 1000) + ' с.');
    showFrameProblem(
      'Розклад не завантажується',
      'Перевірте мережу. Якщо сайт відкривається в окремій вкладці, але не тут — його заборонено вбудовувати.'
    );
    updateDebug();
  }, 'frame timeout'), CONFIG.frameLoadTimeoutMs);
}

function onFrameLoad() {
  window.clearTimeout(state.frameTimeoutTimer);

  /* Перевірка вбудовуваності — лише читання, без роботи з чужим DOM:
       - cross-origin документ завантажився → contentDocument === null;
       - фрейм заблоковано (X-Frame-Options / CSP frame-ancestors)
         → лишається same-origin about:blank, доступний на читання. */
  let blocked = false;
  try {
    const doc = el.frame.contentDocument;
    if (doc && doc.location && doc.location.href === 'about:blank') blocked = true;
  } catch (e) {
    blocked = false;            // SecurityError означає, що чужий документ таки є
  }

  if (blocked) {
    state.frameStatus = 'BLOCKED';
    log('ПОМИЛКА: lb.itstep.org забороняє вбудовування (X-Frame-Options / CSP).');
    showFrameProblem(
      'Сайт забороняє вбудовування',
      'lb.itstep.org не дозволяє показувати себе всередині іншої сторінки. Можна відкрити розклад напряму в цій вкладці — але тоді екран доведеться тримати активним налаштуваннями телевізора.'
    );
  } else {
    state.frameStatus = 'LOADED';
    hideNotice();
    log('Розклад завантажено.');
  }
  updateDebug();
}

/** Акуратний мінімальний fallback: без технічного хаосу на екрані. */
function showFrameProblem(title, text) {
  showNotice({
    title: title,
    text: text,
    primary: {
      label: 'Відкрити розклад напряму',
      action: function () {
        log('Перехід на розклад напряму. Wake Lock цієї сторінки більше не діятиме.');
        window.location.href = CONFIG.scheduleUrl;
      }
    },
    secondary: {
      label: 'Спробувати ще раз',
      action: function () {
        state.frameStatus = 'LOADING';
        hideNotice();
        el.frame.src = CONFIG.scheduleUrl;
        log('Повторне завантаження розкладу (вручну).');
      }
    }
  });
}

/* ==================================================================
   9. РЕЖИМИ
   ================================================================== */
function setMode(mode) {
  state.mode = mode;
  updateDebug();
}

/** Показати розклад без fullscreen — зручно, щоб спокійно залогінитися. */
async function openSchedule() {
  mountFrame();
  state.frameVisible = true;
  el.body.classList.add('frame-visible');
  setMode('PREVIEW');
  log('Режим перегляду увімкнено.');
  await requestWakeLock();
}

async function enterTvMode(withGesture) {
  mountFrame();
  state.frameVisible = true;
  state.tvModeActive = true;
  el.body.classList.add('frame-visible', 'tv-mode');
  setMode('TV MODE');
  hideNotice();
  log('TV Mode увімкнено.');

  if (withGesture) await enterFullscreen();
  await requestWakeLock();

  if (!withGesture && !isFullscreen()) {
    showNotice({
      title: 'Потрібне одне натискання',
      text: 'Браузер вмикає повний екран лише після дії користувача.',
      primary: { label: 'Увімкнути повний екран', action: function () { hideNotice(); enterFullscreen(); } }
    });
  }
  updateDebug();
}

async function exitTvMode() {
  if (!state.tvModeActive && state.mode === 'IDLE') return;
  state.tvModeActive = false;
  state.frameVisible = false;
  el.body.classList.remove('frame-visible', 'tv-mode');
  setMode('IDLE');
  hideNotice();
  await releaseWakeLock('вихід із TV Mode');
  await exitFullscreen();
  setStatus(state.dayOver ? 'Робочий день завершено' : 'TV Mode вимкнено', 'warn');
  log('TV Mode вимкнено. Розклад лишається завантаженим.');
  updateDebug();
}

/* ==================================================================
   10. ПОВІДОМЛЕННЯ
   ================================================================== */
function showNotice(options) {
  el.noticeTitle.textContent = options.title;
  el.noticeText.textContent = options.text;

  state.noticeActions.primary = options.primary ? options.primary.action : null;
  el.noticePrimary.textContent = options.primary ? options.primary.label : 'Гаразд';

  if (options.secondary) {
    state.noticeActions.secondary = options.secondary.action;
    el.noticeSecondary.textContent = options.secondary.label;
    el.noticeSecondary.hidden = false;
  } else {
    state.noticeActions.secondary = null;
    el.noticeSecondary.hidden = true;
  }
  el.notice.hidden = false;
}

function hideNotice() {
  el.notice.hidden = true;
  state.noticeActions.primary = null;
  state.noticeActions.secondary = null;
}

/* ==================================================================
   11. СЛУЖБОВА ПАНЕЛЬ
   Оновлюється лише поки відкрита — жодних важких операцій у фоні.
   ================================================================== */
function toggleDebug(force) {
  const show = typeof force === 'boolean' ? force : el.debug.hidden;
  el.debug.hidden = !show;

  window.clearInterval(state.debugTimer);
  state.debugTimer = null;

  if (show) {
    renderLog();
    updateBanner();
    updateDebug();
    state.debugTimer = window.setInterval(safe(updateDebug, 'debug tick'), CONFIG.debugTickMs);
  }
}

function updateDebug() {
  if (!el.debug || el.debug.hidden) return;
  const now = new Date();

  el.dbgMode.textContent = state.dayOver ? state.mode + ' · DAY ENDED' : state.mode;
  el.dbgTv.textContent = state.tvModeActive ? 'ACTIVE' : 'INACTIVE';
  el.dbgFs.textContent = isFullscreen() ? 'ACTIVE' : 'INACTIVE';
  el.dbgWl.textContent = state.wakeLock ? 'ACTIVE' : state.wakeLockStatus;
  el.dbgVis.textContent = document.visibilityState.toUpperCase();
  el.dbgOnline.textContent = navigator.onLine ? 'ONLINE' : 'OFFLINE';
  el.dbgFrame.textContent = state.frameStatus;
  el.dbgTime.textContent = timeString(now);
  el.dbgDate.textContent = now.toLocaleDateString('uk-UA');
  el.dbgEnd.textContent = state.settings.endTime;
  el.dbgLeft.textContent = state.dayOver ? 'завершено' : formatDuration(msUntilEnd(now));
  el.dbgWlReq.textContent = state.lastWakeRequest || '—';
  el.dbgWlRel.textContent = state.lastWakeRelease || '—';
  el.dbgUptime.textContent = formatDuration(Date.now() - state.startedAt);
  el.dbgViewport.textContent = window.innerWidth + '×' + window.innerHeight +
    ' @' + (window.devicePixelRatio || 1) + 'x';
  el.dbgScreen.textContent = screen.width + '×' + screen.height;
  el.dbgUa.textContent = navigator.userAgent;
}

/* ==================================================================
   12. ДІАГНОСТИКА
   ================================================================== */
function runDiagnostics() {
  const root = document.documentElement;
  const now = new Date();

  let orientation = 'невідомо';
  try {
    if (screen.orientation && screen.orientation.type) orientation = screen.orientation.type;
  } catch (e) { /* ігноруємо */ }

  const storageOk = storage.set('tvDisplay.__probe', '1');
  if (storageOk) storage.remove('tvDisplay.__probe');

  const report = {
    'Режим': state.mode,
    'Wake Lock API': wakeLockSupported() ? 'підтримується' : 'НЕ підтримується',
    'Wake Lock зараз': state.wakeLock ? 'ACTIVE' : state.wakeLockStatus,
    'Утримання екрана': state.settings.wakeEnabled ? 'увімкнено' : 'вимкнено в налаштуваннях',
    'Fullscreen API': (root.requestFullscreen || root.webkitRequestFullscreen) ? 'підтримується' : 'НЕ підтримується',
    'Fullscreen дозволено': (document.fullscreenEnabled !== false) ? 'так' : 'ні',
    'Fullscreen зараз': isFullscreen() ? 'ACTIVE' : 'INACTIVE',
    'Iframe': state.frameStatus,
    'Iframe URL': CONFIG.scheduleUrl,
    'Поточний час': timeString(now) + ' ' + now.toLocaleDateString('uk-UA'),
    'Завершення роботи': state.settings.endTime,
    'Лишилось': state.dayOver ? 'робочий день завершено' : formatDuration(msUntilEnd(now)),
    'Часовий пояс': Intl.DateTimeFormat().resolvedOptions().timeZone || 'невідомо',
    'Viewport': window.innerWidth + '×' + window.innerHeight + ' @' + (window.devicePixelRatio || 1) + 'x',
    'Screen': screen.width + '×' + screen.height + ', ' + (screen.colorDepth || '?') + ' bit',
    'Orientation': orientation,
    'Document visibility': document.visibilityState,
    'localStorage': storageOk ? 'доступний' : 'НЕДОСТУПНИЙ',
    'Мережа': navigator.onLine ? 'online' : 'offline',
    'Аптайм': formatDuration(Date.now() - state.startedAt),
    'Browser': navigator.userAgent
  };

  log('--- Діагностика ---');
  Object.keys(report).forEach(function (key) { log(key + ': ' + report[key]); });
  log('--- Кінець діагностики ---');
  toggleDebug(true);
  return report;
}

window.runDiagnostics = runDiagnostics;

/* ==================================================================
   13. НАЛАШТУВАННЯ (лише параметри wrapper, жодних credentials)
   ================================================================== */
function loadSettings() {
  const autoStart = storage.get(CONFIG.storageKeys.autoStart);
  const wakeEnabled = storage.get(CONFIG.storageKeys.wakeEnabled);
  const endTime = storage.get(CONFIG.storageKeys.endTime);

  state.settings.autoStart = autoStart === null ? CONFIG.autoStartTVMode : autoStart === 'true';
  state.settings.wakeEnabled = wakeEnabled === null ? CONFIG.enableWakeLock : wakeEnabled === 'true';
  state.settings.endTime = parseEndTime(endTime) ? endTime : CONFIG.endTime;

  el.autoStartToggle.checked = state.settings.autoStart;
  el.wakeEnabledToggle.checked = state.settings.wakeEnabled;
  el.endTimeInput.value = state.settings.endTime;
  el.metaEnd.textContent = state.settings.endTime;
}

/* ==================================================================
   14. ПОДІЇ
   ================================================================== */
on(el.startBtn, 'click', function () {
  setStatus('TV Mode активний', 'ok');
  return enterTvMode(true);
}, 'start');

on(el.openBtn, 'click', function () { return openSchedule(); }, 'open');

on(el.fsBtn, 'click', function () { return enterFullscreen(); }, 'fullscreen btn');

on(el.wakeBtn, 'click', function () {
  state.wakeRetryIndex = 0;
  if (state.dayOver) {
    log('Запит Wake Lock проігноровано: робочий день завершено.');
    setStatus('Робочий день завершено', 'warn');
    return;
  }
  return requestWakeLock().then(function (ok) {
    setStatus(ok ? 'Екран утримується активним' : 'Wake Lock недоступний', ok ? 'ok' : 'warn');
  });
}, 'wake btn');

on(el.settingsBtn, 'click', function () {
  const show = el.settings.hidden;
  el.settings.hidden = !show;
  el.settingsBtn.setAttribute('aria-pressed', show ? 'true' : 'false');
}, 'settings');

on(el.autoStartToggle, 'change', function () {
  state.settings.autoStart = el.autoStartToggle.checked;
  storage.set(CONFIG.storageKeys.autoStart, String(state.settings.autoStart));
  log('Автозапуск: ' + (state.settings.autoStart ? 'увімкнено' : 'вимкнено'));
}, 'autostart');

on(el.wakeEnabledToggle, 'change', function () {
  state.settings.wakeEnabled = el.wakeEnabledToggle.checked;
  storage.set(CONFIG.storageKeys.wakeEnabled, String(state.settings.wakeEnabled));
  log('Утримання екрана: ' + (state.settings.wakeEnabled ? 'увімкнено' : 'вимкнено'));
  if (state.settings.wakeEnabled) {
    state.wakeRetryIndex = 0;
    if (state.frameVisible) requestWakeLock();
  } else {
    releaseWakeLock('вимкнено в налаштуваннях');
  }
}, 'wake toggle');

on(el.endTimeInput, 'change', function () {
  const value = el.endTimeInput.value;
  if (!parseEndTime(value)) {
    el.endTimeInput.value = state.settings.endTime;
    return;
  }
  state.settings.endTime = value;
  storage.set(CONFIG.storageKeys.endTime, value);
  el.metaEnd.textContent = value;
  log('Час завершення роботи змінено на ' + value + '.');
  evaluateDay();                       // може одразу закрити або відкрити день
  updateDebug();
}, 'endtime');

on(el.noticePrimary, 'click', function () {
  const action = state.noticeActions.primary;
  if (action) action(); else hideNotice();
}, 'notice primary');

on(el.noticeSecondary, 'click', function () {
  const action = state.noticeActions.secondary;
  if (action) action(); else hideNotice();
}, 'notice secondary');

on(el.debugClose, 'click', function () { toggleDebug(false); }, 'debug close');
on(el.dbgDiag, 'click', runDiagnostics, 'diag');
on(el.dbgWakeNow, 'click', function () {
  state.wakeRetryIndex = 0;
  return requestWakeLock();
}, 'debug wake');
on(el.dbgReload, 'click', function () {
  // Ручне перезавантаження лише за явним натисканням.
  // Автоматично цього не робимо: сайт оновлює себе сам.
  if (!state.frameMounted) { mountFrame(); return; }
  state.frameStatus = 'LOADING';
  el.frame.src = CONFIG.scheduleUrl;
  log('Розклад перезавантажено вручну.');
}, 'debug reload');
on(el.dbgExit, 'click', function () {
  toggleDebug(false);
  return exitTvMode();
}, 'debug exit');

// 5 кліків у верхньому лівому кутку
on(el.cornerTap, 'click', function () {
  const t = Date.now();
  state.cornerTaps.push(t);
  state.cornerTaps = state.cornerTaps.filter(function (x) { return t - x < CONFIG.cornerTapWindowMs; });
  if (state.cornerTaps.length >= CONFIG.cornerTaps) {
    state.cornerTaps = [];
    toggleDebug(true);
  }
}, 'corner tap');

// Гарячі клавіші. Escape свідомо не виходить із TV Mode:
// у fullscreen його перехоплює браузер, і випадковий вихід нам не потрібен.
on(document, 'keydown', function (event) {
  if (!event.ctrlKey || !event.shiftKey) return;
  const key = (event.key || '').toLowerCase();
  if (key === 'd') { event.preventDefault(); toggleDebug(); }
  else if (key === 'q') { event.preventDefault(); exitTvMode(); }
  else if (key === 'f') { event.preventDefault(); enterFullscreen(); }
}, 'keydown');

// Fullscreen
on(document, 'fullscreenchange', onFullscreenChange, 'fullscreenchange');
on(document, 'webkitfullscreenchange', onFullscreenChange, 'webkitfullscreenchange');
on(document, 'fullscreenerror', function () {
  log('fullscreenerror: браузер відхилив повноекранний режим.');
}, 'fullscreenerror');

function onFullscreenChange() {
  const active = isFullscreen();
  log('Fullscreen: ' + (active ? 'увімкнено' : 'вимкнено'));
  if (state.tvModeActive && !active) {
    showNotice({
      title: 'Повний екран вимкнено',
      text: 'Wake Lock лишається активним. Поверніть повний екран кнопкою або Ctrl + Shift + F.',
      primary: { label: 'Повернути повний екран', action: function () { hideNotice(); enterFullscreen(); } }
    });
  } else if (active && state.tvModeActive) {
    hideNotice();
  }
  updateDebug();
}

// Видимість документа — головна точка відновлення Wake Lock
on(document, 'visibilitychange', function () {
  log('Видимість: ' + document.visibilityState);
  if (document.visibilityState !== 'visible') { updateDebug(); return; }

  evaluateDay();                        // могли повернутися вже після endTime
  if (state.frameVisible && !state.wakeLock && wakeLockAllowed()) {
    state.wakeRetryIndex = 0;
    requestWakeLock();
  }
  updateDebug();
}, 'visibilitychange');

on(window, 'online', function () { log('Мережа: online'); updateDebug(); }, 'online');
on(window, 'offline', function () { log('Мережа: offline'); updateDebug(); }, 'offline');
on(window, 'resize', updateDebug, 'resize');

on(window, 'pagehide', function () {
  // Акуратно звільняємо ресурси перед закриттям вкладки.
  window.clearInterval(state.mainTimer);
  window.clearInterval(state.debugTimer);
  window.clearTimeout(state.wakeRetryTimer);
  window.clearTimeout(state.frameTimeoutTimer);
  if (state.wakeLock) { try { state.wakeLock.release(); } catch (e) { /* ігноруємо */ } }
}, 'pagehide');

// Глобальна страховка: жодна помилка не має лишити wrapper у зламаному стані.
window.addEventListener('error', function (event) {
  try { log('JS error: ' + (event.message || 'unknown')); } catch (e) { /* ігноруємо */ }
});
window.addEventListener('unhandledrejection', function (event) {
  try { log('Unhandled promise: ' + describe(event.reason)); } catch (e) { /* ігноруємо */ }
});

/* ==================================================================
   15. ЄДИНИЙ ФОНОВИЙ ТАЙМЕР
   Раз на CONFIG.tickMs: порівняння двох чисел і, за потреби,
   відновлення Wake Lock. Нічого важкого.
   ================================================================== */
function tick() {
  evaluateDay();
  if (state.frameVisible && !state.wakeLock && !state.wakeRequestInFlight &&
      wakeLockAllowed() && document.visibilityState === 'visible' &&
      !state.wakeRetryTimer) {
    requestWakeLock();
  }
}

/* ==================================================================
   16. СТАРТ
   ================================================================== */
(function init() {
  try {
    loadSettings();

    if (!wakeLockSupported()) {
      state.wakeLockStatus = 'NOT SUPPORTED';
      setStatus('Wake Lock не підтримується браузером', 'warn');
    } else if (!state.settings.wakeEnabled) {
      state.wakeLockStatus = 'DISABLED';
      setStatus('Утримання екрана вимкнено', 'warn');
    }

    // Стан робочого дня на момент відкриття сторінки (без «події» переходу).
    state.dayOver = isDayOver(new Date());
    if (state.dayOver) {
      state.wakeLockStatus = 'DAY ENDED';
      setStatus('Робочий день завершено (' + state.settings.endTime + ')', 'warn');
      log('Сторінку відкрито після ' + state.settings.endTime + ' — Wake Lock не запитується.');
    } else if (wakeLockSupported() && state.settings.wakeEnabled) {
      setStatus('Готово до запуску', 'ready');
    }

    state.mainTimer = window.setInterval(safe(tick, 'tick'), CONFIG.tickMs);
    log('TV Display запущено. Завершення роботи о ' + state.settings.endTime +
        '. Автозапуск: ' + (state.settings.autoStart ? 'увімкнено' : 'вимкнено') + '.');

    if (state.settings.autoStart) {
      /* Після перезавантаження жесту користувача немає. Вмикаємо те, що
         дозволено без жесту (iframe + спроба Wake Lock), і просимо одне
         натискання для Fullscreen. Обходів обмежень немає. */
      enterTvMode(false);
    }
  } catch (error) {
    // Навіть якщо ініціалізація частково впала, сторінка лишається робочою.
    log('Помилка ініціалізації: ' + describe(error));
  }
})();
