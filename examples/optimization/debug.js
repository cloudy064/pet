'use strict';
(() => {
  const version = 'webp-body-click-1';
  const session = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const started = performance.now(),
    entries = [],
    pending = [];
  const safeURL = (url) => (/^(data:|blob:)/.test(url || '') ? '[embedded]' : url);
  const details = document.createElement('details');
  details.innerHTML =
    '<summary>诊断日志（' +
    version +
    '）</summary><button type="button">下载日志</button><pre style="max-height:260px;overflow:auto;white-space:pre-wrap;font-size:12px"></pre>';
  document.querySelector('main').append(details);
  const view = details.querySelector('pre');
  function log(event, data = {}) {
    const row = { session, version, ms: Math.round(performance.now() - started), event, ...data };
    entries.push(row);
    pending.push(row);
    if (entries.length > 1000) entries.shift();
    if (pending.length > 100) pending.shift();
    console.info('[Pipi trace]', row);
    if (details.open)
      view.textContent = entries
        .slice(-20)
        .map((r) => JSON.stringify(r))
        .join('\n');
  }
  details.ontoggle = () => {
    view.textContent = entries
      .slice(-20)
      .map((r) => JSON.stringify(r))
      .join('\n');
  };
  details.querySelector('button').onclick = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pipi-' + session + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const create = Pipi.createWebPet;
  const renders = new WeakMap();
  Pipi.createWebPet = function (canvas, options) {
    const pet = create(canvas, options),
      side = canvas.id;
    renders.set(pet, 0);
    const draw = pet.renderer.draw.bind(pet.renderer);
    pet.renderer.draw = (...args) => {
      const changed = draw(...args);
      if (changed) renders.set(pet, renders.get(pet) + 1);
      return changed;
    };
    const load = pet.adapter.loadImage.bind(pet.adapter);
    pet.adapter.loadImage = async (page, ...args) => {
      const url = safeURL(page.url);
      log('image-start', { side, url, bytes: page.bytes });
      try {
        const image = await load(page, ...args);
        log('image-ready', { side, url, complete: image.complete, width: image.naturalWidth });
        return image;
      } catch (error) {
        log('image-error', { side, url, error: error.message });
        throw error;
      }
    };
    for (const event of ['start', 'cancel', 'error', 'pause', 'resume', 'visibility'])
      pet.on(event, (data) =>
        log('engine-' + event, {
          side,
          action: data.action || data.playback?.action,
          error: data.error?.message,
        })
      );
    pet.on('bodyclick', (data) => log('body-click', { side, ...data }));
    pet.assets.on('loaded', (data) => log('asset-ready', { side, id: data.id }));
    pet.assets.on('retry', (data) =>
      log('image-retry', { side, url: safeURL(data.url), attempt: data.attempt })
    );
    pet.assets.on('download', (data) => log('image-progress', { side, ...data, url: safeURL(data.url) }));
    return pet;
  };
  addEventListener('error', (e) => log('window-error', { error: e.message, stack: e.error?.stack }));
  addEventListener('unhandledrejection', (e) =>
    log('unhandled-rejection', { error: String(e.reason), stack: e.reason?.stack })
  );
  for (const id of ['action', 'play', 'pause', 'size'])
    document
      .getElementById(id)
      .addEventListener(id === 'play' || id === 'pause' ? 'click' : 'change', () =>
        log('control', { control: id, action: document.getElementById('action').value })
      );
  const timer = setInterval(() => {
    const app = window.pipiOptimization;
    log('state', {
      hidden: document.hidden,
      ui: app?.inspect(),
      notice: document.getElementById('notice').textContent,
      pets: app?.pets.map((p) => ({
        status: p.status,
        action: p.current?.action,
        elapsed: p.current?.elapsed,
        duration: p.current?.duration,
        frame: p.snapshot().frame,
        renderedFrames: renders.get(p),
        paused: p.paused,
        cache: p.assets.stats(),
        pending: [...p.assets.cache.values()]
          .filter((a) => a.pending)
          .map((a) => ({
            id: a.id,
            loaded: a.images.length,
            total: a.definition.pages.length,
            refs: a.references,
          })),
      })),
    });
    flush();
  }, 3000);
  function flush() {
    if (!pending.length) return;
    const batch = pending.splice(0, 30);
    fetch('/__debug/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
      keepalive: true,
    }).catch(() => {});
  }
  addEventListener(
    'pagehide',
    () => {
      clearInterval(timer);
      log('pagehide');
      flush();
    },
    { once: true }
  );
  window.pipiTrace = { session, version, entries, log };
  log('page-open', { path: location.pathname + location.search });
})();
