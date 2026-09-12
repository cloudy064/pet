'use strict';
class WebAdapter {
  constructor(
    canvas,
    { fetch: fetcher, window: host, imageTimeoutMs = 120000, imageStallTimeoutMs = 15000 } = {}
  ) {
    if (!canvas || typeof canvas.getContext !== 'function')
      throw new TypeError('A Canvas element is required');
    this.canvas = canvas;
    this.host = host || canvas.ownerDocument.defaultView;
    this.fetch = fetcher || this.host.fetch.bind(this.host);
    this.manifests = new Map();
    this.downloads = new Map();
    this.downloadJobs = new Map();
    this.downloadBudget = 64 * 1024 * 1024;
    this.downloadBytes = 0;
    this.downloadGeneration = 0;
    if (!Number.isFinite(imageTimeoutMs) || imageTimeoutMs <= 0)
      throw new TypeError('imageTimeoutMs must be positive');
    this.imageTimeoutMs = imageTimeoutMs;
    if (!Number.isFinite(imageStallTimeoutMs) || imageStallTimeoutMs <= 0)
      throw new TypeError('imageStallTimeoutMs must be positive');
    this.imageStallTimeoutMs = imageStallTimeoutMs;
    this.imageSlowTimeoutMs = 5000;
    this.width = canvas.clientWidth || canvas.width;
    this.height = canvas.clientHeight || canvas.height;
  }
  now() {
    return this.host.performance.now();
  }
  createCanvas(width, height) {
    const canvas = this.canvas.ownerDocument.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  requestFrame(callback) {
    return this.host.requestAnimationFrame(callback);
  }
  cancelFrame(id) {
    this.host.cancelAnimationFrame(id);
  }
  resize(width, height, dpr) {
    this.width = width;
    this.height = height;
    const w = Math.max(1, Math.round(width * dpr)),
      h = Math.max(1, Math.round(height * dpr));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
  }
  async fetchManifest(baseURL) {
    const url = baseURL.replace(/\/$/, '') + '/manifest.json',
      old = this.manifests.get(url);
    const response = await this.fetch(url, { headers: old && old.etag ? { 'If-None-Match': old.etag } : {} });
    if (response.status === 304 && old) return old.data;
    if (!response.ok) throw new Error('Manifest request failed: ' + response.status);
    const data = await response.json();
    this.manifests.set(url, { data, etag: response.headers.get('etag') });
    return data;
  }
  downloadKey(page) {
    return page.url + '|' + (page.md5 || '') + '|' + (page.bytes || 0);
  }
  forgetDownload(key) {
    const blob = this.downloads.get(key);
    if (blob) this.downloadBytes -= blob.size;
    this.downloads.delete(key);
  }
  downloadStats() {
    return { pages: this.downloads.size, bytes: this.downloadBytes, budget: this.downloadBudget };
  }
  async prefetchImage(page, { signal, onRetry, onProgress } = {}) {
    const cancelled = () => Object.assign(new Error('Image download cancelled'), { name: 'AbortError' });
    if (signal?.aborted) throw cancelled();
    const key = this.downloadKey(page),
      cached = this.downloads.get(key);
    if (cached) {
      this.downloads.delete(key);
      this.downloads.set(key, cached);
      onProgress?.({ loaded: cached.size, total: cached.size, phase: 'cached', attempt: 0 });
      return cached;
    }
    let job = this.downloadJobs.get(key);
    if (!job) {
      job = { controller: new this.host.AbortController(), listeners: new Set() };
      this.downloadJobs.set(key, job);
      const generation = this.downloadGeneration;
      job.promise = Promise.resolve()
        .then(async () => {
          for (let attempt = 0; ; attempt++) {
            try {
              const blob = await this.downloadImage(page, job.controller.signal, attempt, (detail) =>
                job.listeners.forEach((l) => l.onProgress?.(detail))
              );
              if (job.controller.signal.aborted) throw cancelled();
              if (generation === this.downloadGeneration && blob.size <= this.downloadBudget) {
                this.forgetDownload(key);
                while (this.downloadBytes + blob.size > this.downloadBudget)
                  this.forgetDownload(this.downloads.keys().next().value);
                this.downloads.set(key, blob);
                this.downloadBytes += blob.size;
              }
              return blob;
            } catch (error) {
              if (job.controller.signal.aborted || error.name === 'AbortError' || attempt >= 1) throw error;
              job.listeners.forEach((l) => l.onRetry?.({ error, attempt: attempt + 2 }));
            }
          }
        })
        .finally(() => {
          if (this.downloadJobs.get(key) === job) this.downloadJobs.delete(key);
        });
    }
    const listener = { onRetry, onProgress };
    job.listeners.add(listener);
    return new Promise((resolve, reject) => {
      const cancel = () => {
        clean();
        reject(cancelled());
      };
      const clean = () => {
        signal?.removeEventListener('abort', cancel);
        job.listeners.delete(listener);
        if (!job.listeners.size && this.downloadJobs.get(key) === job) {
          this.downloadJobs.delete(key);
          job.controller.abort();
        }
      };
      signal?.addEventListener('abort', cancel, { once: true });
      job.promise.then(
        (blob) => {
          clean();
          resolve(blob);
        },
        (error) => {
          clean();
          reject(error);
        }
      );
      if (signal?.aborted) cancel();
    });
  }
  async loadImage(page, baseURL, options = {}) {
    const { signal, onRetry, onProgress } = options;
    for (let attempt = 0; ; attempt++) {
      let objectURL;
      try {
        if (!/^(data:|blob:)/.test(page.url) && this.host.AbortController && this.host.URL?.createObjectURL) {
          const blob = await this.prefetchImage(page, options);
          onProgress?.({ loaded: blob.size, total: blob.size, phase: 'decoding', attempt: 1 });
          objectURL = this.host.URL.createObjectURL(blob);
          const image = await this.loadImageAttempt({ ...page, url: objectURL, md5: undefined }, signal);
          onProgress?.({ loaded: blob.size, total: blob.size, phase: 'ready', attempt: 1 });
          return image;
        }
        return await this.loadImageAttempt(page, signal);
      } catch (error) {
        // Network retries belong to prefetchImage; retry here only after a decode failure.
        if (
          !objectURL &&
          this.host.AbortController &&
          this.host.URL?.createObjectURL &&
          !/^(data:|blob:)/.test(page.url)
        )
          throw error;
        if (signal?.aborted || error.name === 'AbortError') throw error;
        this.forgetDownload(this.downloadKey(page));
        if (attempt >= 1) throw error;
        onRetry?.({ error, attempt: attempt + 2 });
      } finally {
        if (objectURL) this.host.URL.revokeObjectURL(objectURL);
      }
    }
  }
  async downloadImage(page, signal, attempt, onProgress) {
    const controller = new this.host.AbortController();
    let idleTimer,
      timeoutError,
      reader,
      loaded = 0,
      lastReport = 0,
      slowTimer,
      checkpoint = 0;
    let total = page.bytes || 0;
    const abort = () => controller.abort();
    const failAfter = (message) => {
      timeoutError = Object.assign(new Error(message), { name: 'TimeoutError' });
      controller.abort();
    };
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(
        () => failAfter('图片下载连续 ' + this.imageStallTimeoutMs / 1000 + ' 秒没有收到数据'),
        this.imageStallTimeoutMs
      );
    };
    const resetSlow = () => {
      if (attempt || total <= 16384) return;
      clearTimeout(slowTimer);
      checkpoint = loaded;
      slowTimer = setTimeout(
        () => failAfter('图片传输过慢：5 秒内新增数据不足 16 KiB'),
        this.imageSlowTimeoutMs
      );
    };
    const report = (phase) => {
      if (phase !== 'downloading' || Date.now() - lastReport >= 250) {
        lastReport = Date.now();
        onProgress?.({ loaded, total, phase, attempt: attempt + 1 });
      }
    };
    const deadline = setTimeout(() => failAfter('图片下载超过总时间上限'), this.imageTimeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    try {
      let url = page.url + (page.md5 ? (page.url.includes('?') ? '&' : '?') + 'v=' + page.md5 : '');
      if (attempt)
        url +=
          (url.includes('?') ? '&' : '?') +
          '_pipiRetry=' +
          Date.now().toString(36) +
          Math.random().toString(36).slice(2);
      report('request');
      resetIdle();
      resetSlow();
      const response = await this.fetch(url, {
        signal: controller.signal,
        cache: attempt ? 'reload' : 'default',
      });
      if (!response.ok) throw new Error('Image request failed: ' + response.status);
      total = page.bytes || Number(response.headers.get('content-length')) || 0;
      resetIdle();
      resetSlow();
      let blob;
      if (response.body?.getReader) {
        reader = response.body.getReader();
        const chunks = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value.byteLength) {
            chunks.push(value);
            loaded += value.byteLength;
            resetIdle();
            if (loaded - checkpoint >= 16384) resetSlow();
            report('downloading');
          }
        }
        blob = new this.host.Blob(chunks, {
          type: response.headers.get('content-type') || 'application/octet-stream',
        });
      } else blob = await response.blob();
      loaded = blob.size;
      if (page.bytes && loaded !== page.bytes) throw new Error('Image download is incomplete');
      clearTimeout(idleTimer);
      clearTimeout(slowTimer);
      report('downloaded');
      return blob;
    } catch (error) {
      report('failed');
      if (signal?.aborted) throw Object.assign(new Error('Image loading cancelled'), { name: 'AbortError' });
      throw timeoutError || error;
    } finally {
      clearTimeout(idleTimer);
      clearTimeout(slowTimer);
      clearTimeout(deadline);
      signal?.removeEventListener('abort', abort);
      controller.abort();
      reader?.releaseLock();
    }
  }
  loadImageAttempt(page, signal) {
    return new Promise((resolve, reject) => {
      const image = new this.host.Image();
      let timer,
        settled = false;
      const clean = () => {
        clearTimeout(timer);
        image.onload = image.onerror = null;
        signal?.removeEventListener('abort', cancel);
      };
      const cancel = () => {
        if (settled) return;
        settled = true;
        clean();
        image.removeAttribute('src');
        reject(Object.assign(new Error('Image loading cancelled'), { name: 'AbortError' }));
      };
      if (signal?.aborted) return cancel();
      signal?.addEventListener('abort', cancel, { once: true });
      image.crossOrigin = 'anonymous';
      image.decoding = 'async';
      image.onload = () => {
        if (settled) return;
        settled = true;
        clean();
        resolve(image);
      };
      image.onerror = () => {
        if (settled) return;
        settled = true;
        clean();
        image.removeAttribute('src');
        reject(new Error('Image load failed: ' + page.url.slice(0, 120)));
      };
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        clean();
        image.removeAttribute('src');
        reject(Object.assign(new Error('图片下载超时：' + page.url.slice(0, 120)), { name: 'TimeoutError' }));
      }, this.imageTimeoutMs);
      image.src =
        page.md5 && !/^(data:|blob:)/.test(page.url)
          ? page.url + (page.url.includes('?') ? '&' : '?') + 'v=' + page.md5
          : page.url;
      // Cached images and delayed load notifications must not leave an already
      // decoded atlas waiting until the timeout. Both paths settle only once.
      const decoded = () => {
        if (!settled && image.complete && image.naturalWidth > 0) image.onload();
      };
      decoded();
      if (!settled && typeof image.decode === 'function') image.decode().then(decoded, () => {});
    });
  }
  releaseImage(image) {
    if (image && typeof image.close === 'function') image.close();
    else if (image && image.removeAttribute) image.removeAttribute('src');
  }
  createAudio(source, callbacks) {
    const audio = new this.host.Audio();
    audio.preload = 'auto';
    audio.src = source;
    audio.onended = callbacks.ended;
    audio.onerror = () => callbacks.error(new Error('Audio playback failed'));
    return {
      play: () => audio.play(),
      pause: () => audio.pause(),
      stop: () => {
        audio.pause();
        audio.currentTime = 0;
      },
      dispose: () => {
        audio.onended = audio.onerror = null;
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      },
    };
  }
  bind(engine, { interactive = true } = {}) {
    const off = [],
      listen = (target, event, listener, options) => {
        target.addEventListener(event, listener, options);
        off.push(() => target.removeEventListener(event, listener, options));
      };
    const point = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        id: event.pointerId,
        x: ((event.clientX - rect.left) * this.width) / rect.width,
        y: ((event.clientY - rect.top) * this.height) / rect.height,
      };
    };
    if (interactive) {
      const previous = this.canvas.style.touchAction;
      this.canvas.style.touchAction = 'none';
      off.push(() => {
        this.canvas.style.touchAction = previous;
      });
      listen(this.canvas, 'pointerdown', (event) => {
        if (event.button !== 0 || !event.isPrimary) return;
        if (engine.pointerDown(point(event))) this.canvas.setPointerCapture(event.pointerId);
      });
      listen(this.canvas, 'pointermove', (event) => engine.pointerMove(point(event)));
      listen(this.canvas, 'pointerup', (event) => engine.pointerUp(point(event)));
      listen(this.canvas, 'pointercancel', () => engine.pointerCancel());
      listen(this.canvas, 'lostpointercapture', () => {
        if (engine.pointer) engine.pointerCancel();
      });
    }
    const doc = this.canvas.ownerDocument;
    listen(doc, 'visibilitychange', () => engine.setVisible(!doc.hidden));
    engine.setVisible(!doc.hidden);
    return () => off.forEach((fn) => fn());
  }
  async clearCache() {
    this.manifests.clear();
    this.downloadGeneration++;
    this.downloads.clear();
    this.downloadBytes = 0;
  }
}
module.exports = { WebAdapter };
