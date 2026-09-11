'use strict';
class WebAdapter {
  constructor(canvas, { fetch: fetcher, window: host } = {}) {
    if (!canvas || typeof canvas.getContext !== 'function')
      throw new TypeError('A Canvas element is required');
    this.canvas = canvas;
    this.host = host || canvas.ownerDocument.defaultView;
    this.fetch = fetcher || this.host.fetch.bind(this.host);
    this.manifests = new Map();
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
  loadImage(page) {
    return new Promise((resolve, reject) => {
      const image = new this.host.Image();
      image.crossOrigin = 'anonymous';
      image.decoding = 'async';
      image.onload = () => {
        image.onload = image.onerror = null;
        resolve(image);
      };
      image.onerror = () => {
        image.onload = image.onerror = null;
        reject(new Error('Image load failed: ' + page.url.slice(0, 120)));
      };
      image.src =
        page.md5 && !/^(data:|blob:)/.test(page.url)
          ? page.url + (page.url.includes('?') ? '&' : '?') + 'v=' + page.md5
          : page.url;
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
  }
}
module.exports = { WebAdapter };
