/* coi-serviceworker.js
 * Adds Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers
 * to every response so the page becomes cross-origin isolated.
 * This allows SharedArrayBuffer (required by FFmpeg.wasm multi-threaded).
 *
 * Place this file in the SAME directory as videocut.html on your domain.
 * Based on https://github.com/gzuidhof/coi-serviceworker (MIT License)
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', function(e) {
  const req = e.request;
  // Don't interfere with non-GET or cache-only requests
  if (req.method !== 'GET') return;
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;

  e.respondWith(
    fetch(req).then(function(res) {
      // Don't touch opaque (no-cors) responses
      if (res.status === 0) return res;

      const newHeaders = new Headers(res.headers);
      newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
      newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
      newHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin');

      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: newHeaders,
      });
    }).catch(function() {
      return fetch(req);
    })
  );
});
