// PNG files survive Canvas disposal and Mini Program restarts. Decoded images do not.
const INDEX = 'pipi_engine_assets_v1', DIRECTORY = 'pipi-engine-v1';
const CHECK_MS = 10 * 60 * 1000, MAX_BYTES = 48 * 1024 * 1024;
const instances = new WeakMap();
const validManifest = data => data && data.version === 1 && data.assets && Object.keys(data.assets).length > 0 &&
  Object.values(data.assets).every(a => a && a.anchor && a.crop && a.subjectHeight > 0 &&
    Array.isArray(a.tiles) && Array.isArray(a.frameMap) && Array.isArray(a.durations) &&
    Array.isArray(a.restFrames) && a.frameMap.length > 0 && a.frameMap.length === a.durations.length &&
    a.frameMap.every(i => a.tiles[i]) && a.durations.every(t => Number.isFinite(t) && t > 0) &&
    Array.isArray(a.pages) && a.pages.length > 0 && a.pages.every(p =>
    /^[\w-]+\.png$/.test(p.file) && p.width > 0 && p.height > 0 &&
    (!p.md5 || /^[a-f0-9]{32}$/i.test(p.md5))));

function createPetAssetCache(wxApi, options = {}) {
  const now = options.now || Date.now, limit = options.maxBytes || MAX_BYTES;
  const root = wxApi.env && wxApi.env.USER_DATA_PATH && wxApi.env.USER_DATA_PATH + '/' + DIRECTORY;
  const fs = root && wxApi.getFileSystemManager && wxApi.getFileSystemManager();
  let state;
  try { state = wxApi.getStorageSync(INDEX); } catch (_) {}
  if (!state || state.version !== 1) state = { version: 1, files: {}, manifests: {} };
  state.files = state.files || {}; state.manifests = state.manifests || {};
  const downloads = new Map(), checks = new Map(), retryAt = new Map();
  let writes = Promise.resolve(), generation = 0;
  const call = (target, method, args) => new Promise((resolve, reject) => {
    target[method]({ ...args, success: resolve, fail: reject });
  });
  const save = () => { try { wxApi.setStorageSync(INDEX, state); return true; } catch (_) { return false; } };
  const owned = path => root && typeof path === 'string' && path.startsWith(root + '/') &&
    /^[a-f0-9-]+\.png$/.test(path.slice(root.length + 1));
  const unlink = path => fs ? call(fs, 'unlink', { filePath: path }).catch(() => {}) : Promise.resolve();
  function serialized(task) {
    const next = writes.then(task); writes = next.catch(() => {}); return next;
  }
  async function remove(id) {
    const record = state.files[id]; delete state.files[id];
    if (record && owned(record.path)) await unlink(record.path);
  }
  async function evict(bytes, keep) {
    let total = Object.values(state.files).reduce((n, r) => n + r.bytes, 0);
    for (const [id, r] of Object.entries(state.files).sort((a, b) => a[1].used - b[1].used)) {
      if (total + bytes <= limit) break;
      if (id === keep || downloads.has(id)) continue;
      await remove(id); total -= r.bytes;
    }
    save();
  }
  async function manifest(base) {
    const old = state.manifests[base], cached = old && validManifest(old.data) && old.data;
    if (cached && now() < Math.max(old.checked + CHECK_MS, retryAt.get(base) || 0)) return cached;
    if (!checks.has(base)) {
      const token = generation, header = { 'Cache-Control': 'no-cache' };
      if (cached && old.etag) header['If-None-Match'] = old.etag;
      else if (cached && old.modified) header['If-Modified-Since'] = old.modified;
      const job = call(wxApi, 'request', { url: base + '/manifest.json', timeout: 15000, header }).then(r => {
        const data = r.statusCode === 304 && cached ? cached : typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
        if ((r.statusCode !== 200 && r.statusCode !== 304) || !validManifest(data)) throw Error('Invalid pet manifest');
        const headers = Object.fromEntries(Object.entries(r.header || {}).map(([k,v]) => [k.toLowerCase(),v]));
        if (token === generation) {
          state.manifests[base] = { data, checked: now(),
            etag: headers.etag || (r.statusCode === 304 && old.etag) || '',
            modified: headers['last-modified'] || (r.statusCode === 304 && old.modified) || '' };
          save();
        }
        return data;
      }).catch(error => { retryAt.set(base, now() + 60000); if (cached) return cached; throw error; })
        .finally(() => checks.delete(base));
      checks.set(base, job); job.catch(() => {});
    }
    // Snapshot the old complete manifest while a newer one is checked in the
    // background. The next renderer uses the new snapshot, never mixed tiles.
    return cached || checks.get(base);
  }
  async function acquire(base, page, id, token) {
    const md5 = (page.md5 || '').toLowerCase(), legacyId = base + '/' + page.file;
    const old = state.files[id] || (md5 && state.files[legacyId]);
    if (fs && old && owned(old.path)) {
      try {
        const info = await call(fs, 'getFileInfo', { filePath: old.path, digestAlgorithm: 'md5' });
        if (info.digest.toLowerCase() === (md5 || old.md5) && info.size === old.bytes && (!page.bytes || info.size === page.bytes)) {
          old.used = now();
          if (!state.files[id]) { state.files[id] = old; delete state.files[legacyId]; }
          save(); return { path: old.path, hit: true };
        }
      } catch (_) {}
      await serialized(() => remove(id));
    }
    const response = await call(wxApi, 'downloadFile', { url: base + '/' + page.file + (md5 ? '?v=' + md5 : ''), timeout: 20000 });
    if (response.statusCode !== 200 || !response.tempFilePath) throw Error('Pet download unavailable');
    const temp = response.tempFilePath;
    if (!fs) return { path: temp };
    try {
      const info = await call(fs, 'getFileInfo', { filePath: temp, digestAlgorithm: 'md5' });
      if (md5 && info.digest.toLowerCase() !== md5 || page.bytes && info.size !== page.bytes) throw Error('Pet atlas checksum mismatch');
      return await serialized(async () => {
        if (token !== generation || info.size > limit) return { path: temp, temp };
        const path = root + '/' + info.digest.toLowerCase() + '-' + now().toString(16) + '-' + Math.random().toString(16).slice(2) + '.png';
        try {
          await call(fs, 'mkdir', { dirPath: root, recursive: true }).catch(() => {});
          await evict(info.size, id);
          try { await call(fs, 'copyFile', { srcPath: temp, destPath: path }); }
          catch (_) {
            await evict(Math.max(info.size, limit / 2), id);
            await call(fs, 'copyFile', { srcPath: temp, destPath: path });
          }
          state.files[id] = { path, md5: info.digest.toLowerCase(), bytes: info.size, used: now() };
          if (!save()) { await remove(id); return { path: temp, temp }; }
          return { path, temp };
        } catch (_) {
          await unlink(path);
          return { path: temp, temp }; // Full storage must not prevent playback.
        }
      });
    } catch (error) { await unlink(temp); throw error; }
  }
  async function loadImage(base, page, decode) {
    if (!/^[\w-]+\.png$/.test(page.file)) throw Error('Invalid pet atlas filename');
    const id = page.md5 ? 'md5:' + page.md5.toLowerCase() : base + '/' + page.file;
    let job = downloads.get(id);
    if (!job) { job = { users: 0, promise: acquire(base, page, id, generation) }; downloads.set(id, job); }
    job.users++;
    let source;
    try { source = await job.promise; return await decode(source.path); }
    catch (error) {
      if (source && !error.petDisposed) await serialized(() => { return remove(id).then(save); });
      throw error;
    } finally {
      if (--job.users === 0) {
        downloads.delete(id);
        if (source && source.temp) await unlink(source.temp);
        if (fs) await serialized(() => evict(0));
      }
    }
  }
  async function clear() {
    generation++;
    await Promise.allSettled([...checks.values(), ...[...downloads.values()].map(j => j.promise)]);
    await serialized(async () => {
      for (const id of Object.keys(state.files)) await remove(id);
      // Also collect interrupted copies whose index was never committed.
      if (fs) {
        const listing = await call(fs, 'readdir', { dirPath: root }).catch(() => ({ files: [] }));
        for (const name of listing.files) if (owned(root + '/' + name)) await unlink(root + '/' + name);
      }
      state = { version: 1, files: {}, manifests: {} }; retryAt.clear(); save();
    });
  }
  return { manifest, loadImage, clear };
}
function getPetAssetCache(wxApi) {
  if (!instances.has(wxApi)) instances.set(wxApi, createPetAssetCache(wxApi));
  return instances.get(wxApi);
}
module.exports = { createPetAssetCache, getPetAssetCache, INDEX, DIRECTORY, CHECK_MS, MAX_BYTES };
