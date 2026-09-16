/* =============================================================
   TV Display — оболонка для онлайн-розкладу академії
   Чистий JS. Без збірки, без залежностей, без backend.

   Що робить:
     1. Монтує iframe із розкладом і автоматично повторює спроби
        (backoff), якщо завантаження не вдалося — без втручання людини.
     2. Тримає Screen Wake Lock із коректним lifecycle і backoff.
     3. Якщо ввімкнено «Утримувати екран активним» — паралельно з Wake
        Lock тримає повноекранне (на весь viewport, схований під
        iframe) відео тримає паралельно з Wake Lock — це справжній,
        а не синтетичний H.264-файл (вбудований data URI, кілька КБ),
        щоб апаратний відеодекодер ТВ реально його обробляв так само,
        як сайти з фільмами. На частині TV-платформ (LG webOS) саме
        повноекранне відео —
        задокументований виняток зі скрінсейвера, окремий від Wake Lock.
        Пауза перемальовування, коли вкладка не видима — економія CPU.
     4. О CONFIG.endTime (локальний час) відпускає Wake Lock і
        медіа-резерв, і більше не запитує їх до наступного дня.
     5. Раз на добу (CONFIG.dailyReloadTime, рано вранці) сторінка сама
        себе перезавантажує — проти витоку пам'яті на TV-браузерах, що
        працюють тижнями без вимкнення. Перед цим записує прапорець і
        одразу відновлює TV Mode після перезавантаження. Той самий
        прапорець рятує і після НЕзапланованого перезавантаження
        (збій живлення/браузера) — не лише запланованого.
     6. Керує Fullscreen (тільки після жесту користувача — обійти цю
        вимогу браузера неможливо навіть після автовідновлення).
     7. Зберігає останні логи в localStorage — видно, що відбувалося
        ДО того, як сторінка сама перезавантажилась чи впала.
     8. Дає приховану службову панель і завжди видиму на екрані
        діагностику (без інспектора).

   Чого не робить свідомо:
     - не читає і не змінює DOM сайту розкладу;
     - не імітує дії користувача (кліки, дотики, рух миші);
     - не обходить X-Frame-Options, CSP чи вимогу user gesture;
     - не обходить сон самого телевізора на рівні прошивки —
       Auto Power Off / Screen Saver ТВ лишаються поза межами JS;
     - не бачить, не зберігає і не передає логін та пароль.
   ============================================================= */

'use strict';

/* Справжній (не синтетичний) H.264-файл: 6с, 64×36, чорний з ледь помітним шумом
   + беззвучна (але справжня, не Web Audio-хак) AAC-доріжка — щоб апаратний
   відеодекодер ТВ реально його обробляв, а не canvas.captureStream(). Локально,
   без зовнішніх запитів (свідомо не YouTube — щоб не залежати від мережі/ads). */
const MEDIA_KEEPALIVE_DATA_URI = "data:video/mp4;base64,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BpvvvrrrrrYjfpre6Kab+1r8ARggBwAAABNBiJ3kxQABBpvvvrrrrrrm/lPgARggBwAAABZBiKHkxQABBpvvvrrrrritjZ/unm7YAAAAE0GIpeTFAAEGm+++uuuuuqU3evABGCAHAAAAF0GIqeTFAAEGm+++uuuuqMpHSdfrX668ARggBwAAABZBiK3kxQABBpvvvrrrrrVaGI9TNPLAAAAAF2WIgR5MUAAQab7766665tDZT1zUVS+AARggBwAAAB1BiIXkxQABBpvvvrrrrm8oWk/1+tV2X1xVtqtfwAEYIAcAAAAUQYiJ5MUAAQab776666660I1WU3gAAAAWQYiN5MUAAQab7766665tupnumrKm3gEYIAcAAAAXQYiR5MUAAQab7766664rr9ap1VEZV4ABGCAHAAAAFUGIleTFAAEGm+++uuuutRfX962yeAAAABVBiJnkxQABBpvvvrrrrq5u03/NI9sBGCAHAAAAGUGIneTFAAEGm+++uuuuuK7f53iutlZenWABGCAHAAAAE0GIoeTFAAEGm+++uuuurrqR14AAAAAWQYil5MUAAQab7766666ubymkY6plwAEYIAcAAAAZQYip5MUAAQab7766664Sm6/Wv6mf1dSIcAAAABRBiK3kxQABBpvvvrrrrrTUiGp68AEYIAcAAAAWZYiCeTFAAEGm+++uuuuuOv+/3vXN2wEYIAcAAAAaQYiF5MUAAQab7766666svVNiPZGsqetlZfAAAAAYQYiJ5MUAAQab7766665tinmq023dM92AARggBwAAABFBiI3kxQABBpvvvrrrrrrrrwEYIAcAAAAVQYiR5MUAAQab7766665v0zaFVPXgAAAAG0GIleTFAAEGm+++uuuutxXr73ipGPXsvM6G2AEYIAcAAAAYQYiZ5MUAAQab77666665qzJm9op21vf4ARggBwAAABlBiJ3kxQABBpvvvrrrrit1/ok0xE43Tf1+AAAAF0GIoeTFAAEGm+++uuuupmydcdfX61/AARggBwAAABNBiKXkxQABBpvvvrrrrrqR1KmvARggBwAAABVBiKnkxQABBpvvvrrrrriv3+yT14AAAAAYQYit5MUAAQab7766665q1TuK67Gvme7AARggBwAAABdliIEeTFAAEGm+++uuuuaVD/N0lc26bAEYIAcAAAAbQYiF5MUAAQab7766665tDJ4zr+hy8dfv97/AAAAAEUGIieTFAAEGm+++uuuuuuuvARggBwAAABxBiI3kxQABBpvvvrrrriu738U0dleh9zNtk1eAARggBwAAABVBiJHkxQABBpvvvrrrrrqRtc07fYAAAAAZQYiV5MUAAQab77666646v7/e83qb9SkUQAEYIAcAAAAWQYiZ5MUAAQab7766666piXXFbGq1/AAAABdBiJ3kxQABBpvvvrrrrripSMr+qGnrwAEYIAcAAAAXQYih5MUAAQab77666664rr2XmeyZ7sABGCAHAAAAFEGIpeTFAAEGm+++uuuuarzSWrrwAAAAFUGIqeTFAAEGm+++uuuub9Tzepn+wAEYIAcAAAAXQYit5MUAAQab776666665tCqM0L7+iwBGCAHAAAAFWWIgnkxQABBpvvvrrrrm7pu9c38wAAAABNBiIXkxQABBpvvvrrrrrqnXVrAARggBwAAABpBiInkxQABBpvvvrrrriutd7zd1cVoasrL8AEYIAcAAAAVQYiN5MUAAQab7766666pNyk5qbqvAAAAFkGIkeTFAAEGm+++uuuubTab1TzadmABGCAHAAAAFEGIleTFAAEGm+++uuuuubL+anrwARggBwAAABZBiJnkxQABBpvvvrrrrriuz+iq5uzAAAAAFUGIneTFAAEGm+++uuuurrm9TRSfYAEYIAcAAAAXQYih5MUAAQab7766665tOqeuK3r93eABGCAHAAAAGkGIpeTFAAEGm+++uuuuKtdf7iX+npDqiNOAAAAAFUGIqeTFAAEGm+++uuuuuuuK/Vqh/AEYIAcAAAAWQYit5MUAAQab7766666kddSxVu7+iwEYIAcAAAAgZYiBHkxQABBpvvvrrrrittd/ivLovqjKQtXX61+v1rAAAAAVQYiF5MUAAQab7766665vVPXNY7SsARggBwAAABxBiInkxQABBpvvvrrrriv1a/FaHW9/GE+oqL6fARggBwAAABZBiI3kxQABBpvvvrrrrrjr/3+91trwAAAAE0GIkeTFAAEGm+++uuuuuuarqfABGCAHAAAAF0GIleTFAAEGm+++uuuuuutDFb70VF+AAAAAGUGImeTFAAEGm+++uuuubsiuq1+rjq/v974BGCAHAAAAGEGIneTFAAEGm+++uuuubzx2/9/vcz2U+AEYIAcAAAAVQYih5MUAAQab7766666ysiakpevAAAAAFkGIpeTFAAEGm+++uuuubeqeK+v61acBGCAHAAAAGEGIqeTFAAEGm+++uuuuqU0r+jmb1+tfXgAAABNBiK3kxQABBpvvvrrrrrrrU/7A";


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
  frameRetryBackoff: [3000, 8000, 20000, 45000],  // автоматичні спроби перед тим, як турбувати людину
  wakeLockBackoff: [1000, 3000, 5000, 10000, 30000],
  tickMs: 5000,                        // єдиний фоновий таймер (легкий)
  debugTickMs: 1000,                   // працює лише поки відкрита панель
  cornerTaps: 5,
  cornerTapWindowMs: 4000,
  logLimit: 200,

  dailyReloadEnabled: true,            // самостійне перезавантаження сторінки раз на добу
  dailyReloadTime: '06:00',            // задовго до відкриття — щоб застати ТВ ще сплячим

  storageKeys: {
    autoStart: 'tvDisplay.autoStart',
    wakeEnabled: 'tvDisplay.wakeLockEnabled',
    endTime: 'tvDisplay.endTime',
    logs: 'tvDisplay.logs',
    wasInTvMode: 'tvDisplay.wasInTvMode',
    lastDailyReloadDate: 'tvDisplay.lastDailyReloadDate',
    reloadCount: 'tvDisplay.reloadCount'
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

  media: {
    active: false,
    audioCtx: null,
    audioOscillator: null,
    peekTimer: null
  },

  dayOver: false,
  settings: {
    autoStart: CONFIG.autoStartTVMode,
    wakeEnabled: CONFIG.enableWakeLock,
    endTime: CONFIG.endTime
  },

  frameTimeoutTimer: null,
  frameRetryTimer: null,
  frameRetryIndex: 0,
  mainTimer: null,
  debugTimer: null,
  cornerTaps: [],
  noticeActions: { primary: null, secondary: null },
  startedAt: Date.now(),
  reloadCount: 0,
  logs: [],
  logsDirty: false
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

  mediaVideo: $('mediaKeepAlive'),

  statusDot: $('statusDot'),
  statusText: $('statusText'),
  metaEnd: $('metaEnd'),

  capWakeDot: $('capWakeDot'), capWake: $('capWake'),
  capFsDot: $('capFsDot'), capFs: $('capFs'),
  capMediaDot: $('capMediaDot'), capMedia: $('capMedia'),
  capNet: $('capNet'), capClock: $('capClock'), capUa: $('capUa'),

  hud: $('statusHud'),
  hudFrameDot: $('hudFrameDot'), hudFrameText: $('hudFrameText'),
  hudWakeDot: $('hudWakeDot'), hudWakeText: $('hudWakeText'),
  hudMediaDot: $('hudMediaDot'), hudMediaText: $('hudMediaText'),
  hudEndDot: $('hudEndDot'), hudEndText: $('hudEndText'),
  hudOpenDebug: $('hudOpenDebug'),

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
  dbgMedia: $('dbgMedia'),
  dbgMediaPlaying: $('dbgMediaPlaying'),
  dbgMediaAudio: $('dbgMediaAudio'),
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
  dbgReloads: $('dbgReloads'),
  dbgViewport: $('dbgViewport'),
  dbgScreen: $('dbgScreen'),
  dbgUa: $('dbgUa'),
  dbgDiag: $('dbgDiag'),
  dbgWakeNow: $('dbgWakeNow'),
  dbgPeekVideo: $('dbgPeekVideo'),
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
  state.logsDirty = true;
  if (el.debugLog && !el.debug.hidden) renderLog();
}

/** Раз на tick, а не на кожен виклик log() — щоб не бити по localStorage вручну. */
function flushLogsIfDirty() {
  if (!state.logsDirty) return;
  state.logsDirty = false;
  storage.set(CONFIG.storageKeys.logs, JSON.stringify(state.logs.slice(-150)));
}

/** Логи попереднього запуску — читаються один раз при старті, щоб було видно,
    що сталося ДО того, як телевізор перезавантажив сторінку сам (аварія,
    втрата живлення, нічне самооновлення). */
function loadPreviousLogs() {
  try {
    const raw = storage.get(CONFIG.storageKeys.logs);
    if (!raw) return;
    const previous = JSON.parse(raw);
    if (Array.isArray(previous) && previous.length) {
      state.logs = previous.concat(['--- нове завантаження сторінки ---']);
    }
  } catch (e) { /* пошкоджений запис — просто починаємо з чистого логу */ }
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
    stopMediaKeepAlive('робочий день завершено');
    if (!state.tvModeActive) setStatus('Робочий день завершено', 'warn');
  } else {
    log('Новий робочий день. Утримання екрана знову дозволене.');
    if (state.frameVisible) requestWakeLock();
    syncMediaFallback();
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

/** Чи дозволено зараз узагалі тримати екран. Час перевіряється щоразу заново,
    щоб межа 17:55 спрацьовувала точно, а не з затримкою до наступного tick. */
function wakeLockAllowed() {
  if (!wakeLockSupported()) { state.wakeLockStatus = 'NOT SUPPORTED'; return false; }
  if (!state.settings.wakeEnabled) { state.wakeLockStatus = 'DISABLED'; return false; }
  if (isDayOver(new Date())) { state.wakeLockStatus = 'DAY ENDED'; return false; }
  return true;
}

async function requestWakeLock() {
  if (!wakeLockAllowed()) { syncMediaFallback(); updateDebug(); return false; }
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

    // Поки чекали на промис, могла настати межа 17:55 або вимкнутись налаштування.
    if (isDayOver(new Date()) || !state.settings.wakeEnabled) {
      try { await lock.release(); } catch (e) { /* ігноруємо */ }
      state.wakeLockStatus = isDayOver(new Date()) ? 'DAY ENDED' : 'DISABLED';
      updateDebug();
      return false;
    }

    state.wakeLock = lock;
    state.wakeLockStatus = 'ACTIVE';
    state.wakeRetryIndex = 0;
    state.lastWakeRequest = timeString();
    log('Wake Lock отримано.');
    syncMediaFallback();   // тепер працює паралельно, не залежить від стану Wake Lock

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
      syncMediaFallback();
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
    syncMediaFallback();
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

  syncMediaFallback();
  updateDebug();
}

/* ==================================================================
   6b. МЕДІА-РЕЗЕРВ (3-й рівень фолбеку для утримання екрана)
   Джерело — Canvas.captureStream(), тобто локальний потік без
   жодних зовнішніх файлів. Це не заміна Wake Lock і не підсилення
   вже активного Wake Lock — це окремий сигнал браузеру «вкладка
   відтворює медіа», який вмикається ТІЛЬКИ коли справжній Wake Lock
   реально не тримається (API відсутній або запит провалився), і
   вимикається разом із ним — тим самим годинником 17:55 та тим
   самим перемикачем «Утримувати екран активним».

   Свідомо НЕ робить:
     - не замінює Wake Lock, якщо lock активний — тоді резерв вимкнено;
     - не обходить сон самого телевізора на рівні прошивки (Auto Power
       Off / Screen Saver у налаштуваннях ТВ — поза межами JS);
     - не імітує кліки, дотики чи будь-яку активність користувача.
   ================================================================== */
/** Чи потрібен зараз медіа-резерв.
    На частині TV-платформ (підтверджено для LG webOS) скрінсейвер і
    Wake Lock — це РІЗНІ механізми: навіть активний Wake Lock не завжди
    запобігає почорнінню екрана скрінсейвером. Тому резерв тепер працює
    ПАРАЛЕЛЬНО з Wake Lock, поки видно розклад, а не лише коли Wake Lock
    зламався. */
function shouldUseMediaFallback() {
  if (!state.settings.wakeEnabled) return false;
  if (state.dayOver) return false;
  if (!state.frameVisible) return false;
  return true;
}

async function startMediaKeepAlive() {
  if (state.media.active || !el.mediaVideo) return;
  try {
    // Справжній decoded-відеофайл (не canvas.captureStream) — саме так грають
    // сайти з фільмами, апаратний відеодекодер ТВ реально задіяний.
    if (el.mediaVideo.src !== MEDIA_KEEPALIVE_DATA_URI) {
      el.mediaVideo.src = MEDIA_KEEPALIVE_DATA_URI;
      el.mediaVideo.loop = true;
    }
    el.mediaVideo.muted = true;
    await el.mediaVideo.play();
    state.media.active = true;
    log('Медіа-резерв (справжній відеофайл, апаратний декодер) увімкнено — паралельно з Wake Lock.');
  } catch (error) {
    log('Не вдалося увімкнути медіа-резерв: ' + describe(error));
  }

  startMediaSessionSignal();
  startSilentAudioSignal();
  updateDebug();
}

/** Додатковий (недоведений, але безкоштовний) сигнал "тут відтворюється медіа" —
    деякі платформи звіряються з MediaSession, а не лише з фактом <video playing>.
    Гарантій немає: LG офіційно каже, що орієнтир — саме fullscreen video. */
function startMediaSessionSignal() {
  if (!('mediaSession' in navigator) || typeof MediaMetadata !== 'function') return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: 'TV Display — розклад академії' });
    navigator.mediaSession.playbackState = 'playing';
  } catch (e) { /* ігноруємо — це необов'язковий, додатковий сигнал */ }
}

function stopMediaSessionSignal() {
  if (!('mediaSession' in navigator)) return;
  try { navigator.mediaSession.playbackState = 'none'; } catch (e) { /* ігноруємо */ }
}

/** Другий додатковий сигнал: беззвучний (gain = 0, а не muted!) аудіопотік
    через Web Audio API. Деякі платформи рахують активним аудіо, а не лише
    відео — muted-аудіо для таких перевірок часто не рахується "активним",
    тому тут саме gain 0, а не muted=true. Реального звуку немає. */
function startSilentAudioSignal() {
  if (state.media.audioCtx) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  try {
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;                 // справжня тиша, а не muted-прапорець
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    state.media.audioCtx = ctx;
    state.media.audioOscillator = oscillator;
  } catch (e) {
    log('Беззвучний аудіосигнал недоступний: ' + describe(e));
  }
}

function stopSilentAudioSignal() {
  if (!state.media.audioCtx) return;
  try { state.media.audioOscillator.stop(); } catch (e) { /* ігноруємо */ }
  try { state.media.audioCtx.close(); } catch (e) { /* ігноруємо */ }
  state.media.audioCtx = null;
  state.media.audioOscillator = null;
}

function stopMediaKeepAlive(reason) {
  if (!state.media.active) return;
  try { el.mediaVideo.pause(); } catch (e) { /* ігноруємо */ }
  state.media.active = false;
  stopMediaSessionSignal();
  stopSilentAudioSignal();
  log('Медіа-резерв вимкнено (' + (reason || 'умови більше не виконуються') + ').');
  updateDebug();
}

/** Єдина точка виклику: сама вирішує, вмикати чи вимикати резерв. */
function syncMediaFallback() {
  if (shouldUseMediaFallback()) startMediaKeepAlive();
  else stopMediaKeepAlive();
}

/** Жоден єдиний API не працює всюди — комбінуємо все, що є, і чесно кажемо,
    якщо жоден з них не підтримується цим браузером (тоді факт лишається невідомим,
    а не "немає"). Звук у файлі — справжня цифрова тиша, тож почути його неможливо
    навіть без muted; перевірити можна лише так, програмно. */
function describeAudioTrackPresence(video) {
  if (video.audioTracks) {  // Safari/WebKit: стандартний AudioTrackList
    return video.audioTracks.length > 0
      ? 'ТАК (audioTracks: ' + video.audioTracks.length + ')'
      : 'НІ (audioTracks: 0)';
  }
  if (typeof video.webkitAudioDecodedByteCount === 'number') {  // Chrome/webOS-браузер
    return video.webkitAudioDecodedByteCount > 0
      ? 'ТАК (декодовано ' + video.webkitAudioDecodedByteCount + ' байт аудіо)'
      : (video.readyState < 2 ? 'перевірка…' : 'НІ (0 байт аудіо декодовано)');
  }
  if (typeof video.mozHasAudio === 'boolean') {  // Firefox
    return video.mozHasAudio ? 'ТАК (mozHasAudio)' : 'НІ (mozHasAudio: false)';
  }
  return 'невідомо (браузер не дає жодного API для перевірки)';
}

/** Статична перевірка підтримки — не залежить від поточного стану, лише від можливостей браузера. */
function mediaKeepAliveSupported() {
  try {
    const v = document.createElement('video');
    return typeof v.canPlayType === 'function' &&
      v.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '';
  } catch (e) {
    return false;
  }
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
  el.frameLayer.classList.add('is-mounted');
  el.frameLayer.setAttribute('aria-hidden', 'false');
  on(el.frame, 'load', onFrameLoad, 'iframe load');
  loadFrame();
}

/** Спільна точка (перше завантаження і автоматичні повтори). */
function loadFrame() {
  state.frameStatus = 'LOADING';
  el.frame.src = CONFIG.scheduleUrl;
  log('iframe: запит завантаження (спроба ' + (state.frameRetryIndex + 1) + ').');

  window.clearTimeout(state.frameTimeoutTimer);
  state.frameTimeoutTimer = window.setTimeout(safe(function () {
    if (state.frameStatus !== 'LOADING') return;
    state.frameStatus = 'TIMEOUT';
    log('УВАГА: iframe не повідомив про завантаження за ' +
        (CONFIG.frameLoadTimeoutMs / 1000) + ' с.');
    retryOrGiveUp();
  }, 'frame timeout'), CONFIG.frameLoadTimeoutMs);
}

/** Кілька тихих автоматичних спроб перед тим, як турбувати людину повідомленням.
    Той самий принцип backoff, що і для Wake Lock. */
function retryOrGiveUp() {
  const steps = CONFIG.frameRetryBackoff;
  if (state.frameRetryIndex < steps.length) {
    const delay = steps[state.frameRetryIndex];
    state.frameRetryIndex += 1;
    log('Автоматична повторна спроба завантаження розкладу через ' + (delay / 1000) + ' с.');
    updateDebug();
    updateHud();
    window.clearTimeout(state.frameRetryTimer);
    state.frameRetryTimer = window.setTimeout(safe(loadFrame, 'frame retry'), delay);
  } else {
    log('Автоматичні спроби вичерпано — показую повідомлення.');
    showFrameProblem(
      'Розклад не завантажується',
      'Перевірте мережу. Якщо сайт відкривається в окремій вкладці, але не тут — його заборонено вбудовувати.'
    );
    updateDebug();
  }
}

function onFrameLoad() {
  window.clearTimeout(state.frameTimeoutTimer);
  window.clearTimeout(state.frameRetryTimer);
  state.frameRetryIndex = 0;

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
        state.frameRetryIndex = 0;
        hideNotice();
        loadFrame();
        log('Повторне завантаження розкладу (вручну).');
      }
    }
  });
}

/* ==================================================================
   9b. ЩОДЕННЕ САМООНОВЛЕННЯ + ВІДНОВЛЕННЯ ПІСЛЯ ПЕРЕЗАВАНТАЖЕННЯ
   Довготривалий (тижні без перезавантаження) TV-браузер накопичує
   витік пам'яті. Раз на добу, рано вранці (задовго до відкриття),
   сторінка сама себе перезавантажує — і одразу відновлює TV Mode,
   бо перед reload() записує прапорець у localStorage.
   Той самий прапорець рятує і від НЕзапланованих перезавантажень —
   стрибок живлення, збій самого браузера тощо.
   ================================================================== */
function rememberTvModeFlag(active) {
  storage.set(CONFIG.storageKeys.wasInTvMode, active ? 'true' : 'false');
}

function bumpReloadCounter() {
  const raw = storage.get(CONFIG.storageKeys.reloadCount);
  const count = (raw ? parseInt(raw, 10) : 0) || 0;
  state.reloadCount = count;
  return count;
}

/** Викликається з tick(): раз на добу, у вузькому вікні о dailyReloadTime. */
function maybeDailyReload(now) {
  if (!CONFIG.dailyReloadEnabled) return;
  const target = parseEndTime(CONFIG.dailyReloadTime);
  if (!target) return;

  const todayKey = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
  if (storage.get(CONFIG.storageKeys.lastDailyReloadDate) === todayKey) return;

  const withinWindow = now.getHours() === target.hours &&
    now.getMinutes() >= target.minutes && now.getMinutes() < target.minutes + 2;
  if (!withinWindow) return;

  storage.set(CONFIG.storageKeys.lastDailyReloadDate, todayKey);
  storage.set(CONFIG.storageKeys.reloadCount, String((state.reloadCount || 0) + 1));
  rememberTvModeFlag(state.tvModeActive);
  log('Заплановане нічне самооновлення сторінки (' + CONFIG.dailyReloadTime + ').');
  flushLogsIfDirty();
  window.setTimeout(function () { window.location.reload(); }, 300);
}

/* ==================================================================
   9. РЕЖИМИ
   ================================================================== */
function setMode(mode) {
  state.mode = mode;
  updateDebug();
}

async function enterTvMode(withGesture) {
  mountFrame();
  state.frameVisible = true;
  state.tvModeActive = true;
  rememberTvModeFlag(true);
  el.body.classList.add('frame-visible', 'tv-mode');
  setMode('TV MODE');
  hideNotice();
  syncHudVisibility();
  log('TV Mode увімкнено.');

  if (withGesture) await enterFullscreen();
  await requestWakeLock();
  syncMediaFallback();

  if (!withGesture && !isFullscreen()) {
    showNotice({
      title: 'Потрібне одне натискання',
      text: 'Браузер вмикає повний екран лише після дії користувача.',
      primary: { label: 'Увімкнути повний екран', action: function () { hideNotice(); enterFullscreen(); } }
    });
  }
  updateHud();
  updateDebug();
}

async function exitTvMode() {
  if (!state.tvModeActive && state.mode === 'IDLE') return;
  state.tvModeActive = false;
  state.frameVisible = false;
  rememberTvModeFlag(false);
  el.body.classList.remove('frame-visible', 'tv-mode');
  setMode('IDLE');
  hideNotice();
  syncHudVisibility();
  await releaseWakeLock('вихід із TV Mode');   // сам викличе syncMediaFallback(), яка тепер поверне false (frameVisible=false)
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
   10b. ВИДИМА ДІАГНОСТИКА НА ГОЛОВНОМУ ЕКРАНІ
   На відміну від службової панелі (Ctrl+Shift+D), цей блок завжди
   на видноті на стартовому екрані — саме те, що можна прочитати
   оком на самому телевізорі, без інспектора.
   ================================================================== */
function setCap(dotEl, textEl, ok, okText, badText) {
  if (!dotEl || !textEl) return;
  dotEl.className = 'dot ' + (ok ? 'dot--ok' : 'dot--err');
  textEl.textContent = ok ? okText : badText;
}

/** Речі, які не змінюються після завантаження сторінки — рахуємо один раз. */
function renderStaticCapabilities() {
  setCap(el.capWakeDot, el.capWake, wakeLockSupported(), 'підтримується', 'НЕ підтримується');
  const fsSupported = Boolean(document.documentElement.requestFullscreen ||
    document.documentElement.webkitRequestFullscreen);
  setCap(el.capFsDot, el.capFs, fsSupported, 'підтримується', 'НЕ підтримується');
  setCap(el.capMediaDot, el.capMedia, mediaKeepAliveSupported(), 'доступний', 'недоступний');
  if (el.capUa) el.capUa.textContent = navigator.userAgent;
}

/** Речі, які змінюються з часом — оновлюємо на кожному tick(). */
function renderLiveCapabilities() {
  if (el.capNet) el.capNet.textContent = navigator.onLine ? 'online' : 'offline';
  if (el.capClock) {
    const now = new Date();
    el.capClock.textContent = timeString(now) + ' · ' + now.toLocaleDateString('uk-UA');
  }
}

/* ==================================================================
   10c. СТАТУС-HUD (постійно на екрані, поки показано розклад)
   Легка версія debug-панелі: не потребує Ctrl+Shift+D і зрозуміла
   з одного погляду на пульт-керований телевізор.
   ================================================================== */
function syncHudVisibility() {
  if (!el.hud) return;
  el.hud.hidden = !state.frameVisible;
}

function updateHud() {
  if (!el.hud || el.hud.hidden) return;
  const now = new Date();

  const frameKind = state.frameStatus === 'LOADED' ? 'ok' :
    (state.frameStatus === 'LOADING' ? 'warn' :
    (state.frameStatus === 'NOT MOUNTED' ? 'ready' : 'err'));
  const frameLabels = {
    'NOT MOUNTED': 'не завантажено', 'LOADING': 'завантаження…', 'LOADED': 'завантажено',
    'BLOCKED': 'заблоковано', 'TIMEOUT': 'не відповідає'
  };
  el.hudFrameDot.className = 'hud__dot dot--' + frameKind;
  el.hudFrameText.textContent = frameLabels[state.frameStatus] || state.frameStatus;

  const wakeKind = state.wakeLock ? 'ok' :
    (state.wakeLockStatus === 'RETRYING' ? 'warn' :
    (state.wakeLockStatus === 'DAY ENDED' || state.wakeLockStatus === 'DISABLED' ? 'ready' : 'err'));
  const wakeLabels = {
    'RETRYING': 'повтор спроби', 'FAILED': 'не вдалося', 'NOT SUPPORTED': 'не підтримується',
    'DISABLED': 'вимкнено', 'DAY ENDED': 'день завершено', 'RELEASED': 'відпущено', 'IDLE': 'очікування'
  };
  el.hudWakeDot.className = 'hud__dot dot--' + wakeKind;
  el.hudWakeText.textContent = state.wakeLock ? 'активний' : (wakeLabels[state.wakeLockStatus] || state.wakeLockStatus);

  el.hudMediaDot.className = 'hud__dot dot--' + (state.media.active ? 'ok' : 'ready');
  el.hudMediaText.textContent = state.media.active ? 'активний' : 'вимкнено';

  el.hudEndDot.className = 'hud__dot dot--' + (state.dayOver ? 'err' : 'ready');
  el.hudEndText.textContent = state.dayOver ? 'день завершено' : formatDuration(msUntilEnd(now));
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
  el.dbgMedia.textContent = state.media.active ? 'ACTIVE' : 'INACTIVE';
  if (el.mediaVideo && state.media.active) {
    const reallyPlaying = !el.mediaVideo.paused && !el.mediaVideo.ended && el.mediaVideo.readyState >= 2;
    el.dbgMediaPlaying.textContent = reallyPlaying
      ? ('ТАК, decoder грає — ' + el.mediaVideo.currentTime.toFixed(1) + ' с (тікає)')
      : ('НІ — readyState ' + el.mediaVideo.readyState + ', paused=' + el.mediaVideo.paused);
    el.dbgMediaAudio.textContent = describeAudioTrackPresence(el.mediaVideo);
  } else {
    el.dbgMediaPlaying.textContent = '—';
    el.dbgMediaAudio.textContent = '—';
  }
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
  el.dbgReloads.textContent = String(state.reloadCount) + ' (наступне самооновлення о ' + CONFIG.dailyReloadTime + ')';
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
/** Налаштування тепер без UI: Wake Lock завжди увімкнений, час завершення
    завжди фіксований (CONFIG.endTime = 17:55). Автозапуск лишається
    параметром лише в CONFIG — його можна змінити тут, якщо треба. */
function loadSettings() {
  state.settings.autoStart = CONFIG.autoStartTVMode;
  state.settings.wakeEnabled = true;
  state.settings.endTime = CONFIG.endTime;

  el.metaEnd.textContent = state.settings.endTime;
}

/* ==================================================================
   14. ПОДІЇ
   ================================================================== */
on(el.startBtn, 'click', function () {
  setStatus('TV Mode активний', 'ok');
  return enterTvMode(true);
}, 'start');

on(el.noticePrimary, 'click', function () {
  const action = state.noticeActions.primary;
  if (action) action(); else hideNotice();
}, 'notice primary');

on(el.noticeSecondary, 'click', function () {
  const action = state.noticeActions.secondary;
  if (action) action(); else hideNotice();
}, 'notice secondary');

on(el.debugClose, 'click', function () { toggleDebug(false); }, 'debug close');
on(el.hudOpenDebug, 'click', function () { toggleDebug(true); }, 'hud open debug');
on(el.dbgDiag, 'click', runDiagnostics, 'diag');
on(el.dbgWakeNow, 'click', function () {
  state.wakeRetryIndex = 0;
  return requestWakeLock();
}, 'debug wake');
on(el.dbgPeekVideo, 'click', function () {
  if (!el.mediaVideo) return;
  if (!state.media.active) {
    log('Показ відео-резерву: зараз вимкнений (умови не виконуються), нічого показувати.');
    return;
  }
  window.clearTimeout(state.media.peekTimer);
  el.mediaVideo.classList.add('media-keepalive--peek');
  log('Відео-резерв піднято поверх розкладу на 5 секунд для перевірки.');
  state.media.peekTimer = window.setTimeout(safe(function () {
    el.mediaVideo.classList.remove('media-keepalive--peek');
    log('Відео-резерв повернуто під розклад.');
  }, 'media peek end'), 5000);
}, 'debug peek video');
on(el.dbgReload, 'click', function () {
  // Ручне перезавантаження лише за явним натисканням.
  // Автоматично цього не робимо: сайт оновлює себе сам.
  if (!state.frameMounted) { mountFrame(); return; }
  state.frameRetryIndex = 0;
  loadFrame();
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
    if (!state.wakeLock && wakeLockAllowed()) {
      state.wakeRetryIndex = 0;
      requestWakeLock();
    }
  }
  updateDebug();
}

// Видимість документа — головна точка відновлення Wake Lock
on(document, 'visibilitychange', function () {
  log('Видимість: ' + document.visibilityState);
  if (document.visibilityState !== 'visible') {
    updateDebug();
    return;
  }

  evaluateDay();                        // могли повернутися вже після endTime
  if (state.frameVisible && !state.wakeLock && wakeLockAllowed()) {
    state.wakeRetryIndex = 0;
    requestWakeLock();
  }
  updateDebug();
}, 'visibilitychange');

on(window, 'online', function () {
  log('Мережа: online');
  renderLiveCapabilities();
  if (state.frameStatus === 'TIMEOUT') {
    log('Мережа повернулась — негайна повторна спроба завантаження розкладу.');
    window.clearTimeout(state.frameRetryTimer);
    loadFrame();
  }
  updateDebug();
}, 'online');
on(window, 'offline', function () { log('Мережа: offline'); renderLiveCapabilities(); updateDebug(); }, 'offline');
on(window, 'resize', updateDebug, 'resize');

// Деякі ТВ-браузери надійніше сигналізують поверненням фокуса, ніж visibilitychange.
// Реальна подія браузера — не синтетична активність.
on(window, 'focus', function () {
  evaluateDay();
  if (state.frameVisible && !state.wakeLock && wakeLockAllowed()) {
    state.wakeRetryIndex = 0;
    requestWakeLock();
  }
}, 'window focus');

on(window, 'pagehide', function () {
  // Акуратно звільняємо ресурси перед закриттям вкладки.
  window.clearInterval(state.mainTimer);
  window.clearInterval(state.debugTimer);
  window.clearTimeout(state.wakeRetryTimer);
  window.clearTimeout(state.frameTimeoutTimer);
  window.clearTimeout(state.frameRetryTimer);
  window.clearTimeout(state.media.peekTimer);
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
  syncMediaFallback();   // страховка: підхоплює стан, якщо якийсь виклик десь пропущено
  updateHud();
  renderLiveCapabilities();
  flushLogsIfDirty();
  maybeDailyReload(new Date());
}

/* ==================================================================
   16. СТАРТ
   ================================================================== */
(function init() {
  try {
    loadPreviousLogs();
    bumpReloadCounter();
    loadSettings();
    renderStaticCapabilities();
    renderLiveCapabilities();
    syncHudVisibility();

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

    const wasInTvMode = storage.get(CONFIG.storageKeys.wasInTvMode) === 'true';
    const shouldResume = state.settings.autoStart || wasInTvMode;
    log('TV Display запущено (перезавантажень: ' + state.reloadCount + '). Завершення роботи о ' +
        state.settings.endTime + '. ' +
        (wasInTvMode ? 'Відновлюю TV Mode після перезавантаження.' : 'Автозапуск: ' +
        (state.settings.autoStart ? 'увімкнено' : 'вимкнено') + '.'));

    if (shouldResume) {
      /* Після перезавантаження жесту користувача немає. Вмикаємо те, що
         дозволено без жесту (iframe + спроба Wake Lock + відео-резерв),
         і просимо одне натискання для Fullscreen. Обходів обмежень немає. */
      enterTvMode(false);
    }
  } catch (error) {
    // Навіть якщо ініціалізація частково впала, сторінка лишається робочою.
    log('Помилка ініціалізації: ' + describe(error));
  }
})();
