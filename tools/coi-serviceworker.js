/* Колись цей service worker додавав COOP/COEP-заголовки для FFmpeg.wasm у старому відеоредакторі.
 * Новий редактор працює через WebCodecs і цього не потребує, тож воркер лише видаляє себе
 * в браузерах, де його вже зареєстровано, і перезавантажує відкриті сторінки без нього. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    self.registration.unregister()
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => clients.forEach((c) => c.navigate(c.url)))
  );
});
