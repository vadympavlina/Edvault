// Аніматор · кодування GIF у фоновому потоці, щоб сторінка не «зависала».
import { encodeGif } from './gif.js';
self.onmessage = e => {
  const { w, h, frames } = e.data;
  try {
    const bytes = encodeGif(w, h, frames.map(f => ({ data: new Uint8ClampedArray(f.buf), delay: f.delay })), { onProgress: p => self.postMessage({ progress: p }) });
    self.postMessage({ done: bytes }, [bytes.buffer]);
  } catch (err) { self.postMessage({ error: String(err && err.message || err) }); }
};
