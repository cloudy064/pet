const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createPetAssetCache, INDEX, CHECK_MS } = require('../../engine/adapters/wechat-cache');
const md5 = (data) => crypto.createHash('md5').update(data).digest('hex');
const clone = (data) => JSON.parse(JSON.stringify(data));
const base = 'https://example.test/pet/release';
function fixture() {
  const disk = new Map(),
    storage = {},
    network = new Map(),
    requests = [],
    downloads = [];
  const a = Buffer.from('atlas a'),
    b = Buffer.from('atlas b');
  const page = (file, data) => ({ file, width: 10, height: 10, md5: md5(data), bytes: data.length });
  const asset = (p) => ({
    pages: [p],
    anchor: { x: 5, y: 10 },
    crop: { x: 0, y: 0, w: 10, h: 10 },
    subjectHeight: 10,
    tiles: [[0, 0, 0, 10, 10]],
    frameMap: [0],
    durations: [100],
    restFrames: [],
  });
  let manifest = { version: 1, assets: { a: asset(page('a.png', a)), b: asset(page('b.png', b)) } };
  let time = 1000,
    offline = false,
    quota = false,
    etag = '"v1"',
    holdDownload;
  network.set('a.png', a);
  network.set('b.png', b);
  function result(o, task) {
    queueMicrotask(() => {
      try {
        o.success(task());
      } catch (e) {
        o.fail(e);
      }
    });
  }
  const fileSystem = {
    getFileInfo(o) {
      result(o, () => {
        const data = disk.get(o.filePath);
        if (!data) throw Error('missing');
        return { size: data.length, digest: md5(data) };
      });
    },
    mkdir(o) {
      result(o, () => ({}));
    },
    copyFile(o) {
      result(o, () => {
        if (quota) throw Error('storage full');
        disk.set(o.destPath, Buffer.from(disk.get(o.srcPath)));
        return {};
      });
    },
    unlink(o) {
      result(o, () => {
        disk.delete(o.filePath);
        return {};
      });
    },
    readdir(o) {
      result(o, () => ({
        files: [...disk.keys()]
          .filter((p) => p.startsWith(o.dirPath + '/'))
          .map((p) => p.slice(o.dirPath.length + 1)),
      }));
    },
  };
  const wx = {
    env: { USER_DATA_PATH: 'wxfile://usr' },
    getFileSystemManager: () => fileSystem,
    getStorageSync: (key) => storage[key] && clone(storage[key]),
    setStorageSync: (key, value) => {
      storage[key] = clone(value);
    },
    request(o) {
      requests.push(o);
      result(o, () => {
        if (offline) throw Error('offline');
        return {
          statusCode: o.header['If-None-Match'] === etag ? 304 : 200,
          data: o.header['If-None-Match'] === etag ? '' : clone(manifest),
          header: { ETag: etag },
        };
      });
    },
    downloadFile(o) {
      downloads.push(o.url);
      const finish = () =>
        result(o, () => {
          if (offline) throw Error('offline');
          const name = new URL(o.url).pathname.split('/').pop(),
            data = network.get(name);
          if (!data) return { statusCode: 404 };
          const tempFilePath = '/tmp/' + downloads.length;
          disk.set(tempFilePath, Buffer.from(data));
          return { statusCode: 200, tempFilePath };
        });
      if (holdDownload) holdDownload.push(finish);
      else finish();
    },
  };
  return {
    wx,
    disk,
    storage,
    network,
    requests,
    downloads,
    page,
    cache: (options) => createPetAssetCache(wx, { now: () => time, ...options }),
    decode: async (src) => {
      assert.ok(disk.has(src), 'decode source must still exist');
      return Buffer.from(disk.get(src));
    },
    get manifest() {
      return manifest;
    },
    set manifest(value) {
      manifest = value;
    },
    set etag(value) {
      etag = value;
    },
    set offline(value) {
      offline = value;
    },
    set quota(value) {
      quota = value;
    },
    set holdDownload(value) {
      holdDownload = value;
    },
    advance: () => {
      time += CHECK_MS + 1;
    },
  };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
async function main() {
  const f = fixture(),
    c = f.cache(),
    data = await c.manifest(base),
    a = data.assets.a.pages[0],
    b = data.assets.b.pages[0];
  await c.loadImage(base, a, f.decode);
  await c.loadImage(base, b, f.decode);
  assert.equal(f.downloads.length, 2);
  assert.ok(
    [...f.disk.keys()].every((p) => p.startsWith('wxfile://usr/pipi-engine-v1/')),
    'temporary downloads removed'
  );
  assert.equal(Object.keys(f.storage[INDEX].files).length, 2);
  f.offline = true;
  const reopened = f.cache();
  await reopened.manifest(base);
  await reopened.loadImage(base, a, f.decode);
  assert.equal(f.requests.length, 1, 'fresh manifest reused after app restart');
  assert.equal(f.downloads.length, 2, 'disk PNG reused across renderer and app lifetimes');
  f.advance();
  await reopened.manifest(base);
  await reopened.loadImage(base, b, f.decode);
  await flush();
  assert.equal(f.downloads.length, 2, 'offline stale manifest retains cached animation');
  f.offline = false;
  f.advance();
  await reopened.manifest(base);
  await flush();
  assert.equal(f.requests.at(-1).header['If-None-Match'], '"v1"');
  assert.equal(f.storage[INDEX].manifests[base].etag, '"v1"', '304 retains manifest');
  const changed = Buffer.from('new atlas a');
  f.network.set('a.png', changed);
  const next = clone(f.manifest);
  next.assets.a.pages[0] = f.page('a.png', changed);
  f.manifest = next;
  f.etag = '"v2"';
  f.advance();
  const snapshot = await reopened.manifest(base);
  await flush();
  assert.equal(
    snapshot.assets.a.pages[0].md5,
    a.md5,
    'active snapshot remains coherent while update arrives'
  );
  const updated = await reopened.manifest(base);
  await reopened.loadImage(base, updated.assets.a.pages[0], f.decode);
  await reopened.loadImage(base, b, f.decode);
  assert.equal(f.downloads.length, 3, 'only changed page downloaded');
  assert.ok(
    f.downloads.at(-1).endsWith('?v=' + md5(changed)),
    'changed hash bypasses intermediary cached URL'
  );
  await reopened.loadImage(base + '/next-release', b, f.decode);
  assert.equal(f.downloads.length, 3, 'identical MD5 reused even across releases');
  const record = f.storage[INDEX].files['md5:' + b.md5];
  f.disk.set(record.path, Buffer.from('broken!'));
  await reopened.loadImage(base, b, f.decode);
  assert.equal(f.downloads.length, 4, 'corrupt file repaired');
  const repaired = f.storage[INDEX].files['md5:' + b.md5];
  f.disk.delete(repaired.path);
  await reopened.loadImage(base, b, f.decode);
  assert.equal(f.downloads.length, 5, 'missing file repaired');
  const bad = { ...b, md5: 'f'.repeat(32) };
  await assert.rejects(reopened.loadImage(base, bad, f.decode), /checksum/);
  assert.ok(!f.storage[INDEX].files['md5:' + bad.md5], 'bad download never committed');
  const orphan = 'wxfile://usr/pipi-engine-v1/dead-beef.png';
  f.disk.set(orphan, Buffer.from('orphan'));
  f.disk.set('wxfile://usr/reading.wav', Buffer.from('user recording'));
  await reopened.clear();
  assert.deepEqual(
    [...f.disk.keys()],
    ['wxfile://usr/reading.wav'],
    'clear only removes owned pet media, including interrupted copies'
  );
  assert.deepEqual(f.storage[INDEX].manifests, {});

  const conditional = fixture(),
    cc = conditional.cache();
  let conditionalCalls = 0;
  conditional.wx.request = (o) => {
    conditionalCalls++;
    queueMicrotask(() =>
      o.success({
        statusCode: conditionalCalls === 1 ? 200 : 304,
        data: conditionalCalls === 1 ? conditional.manifest : '',
        header: { 'last-modified': 'Fri, 11 Sep 2026 05:41:24 GMT' },
      })
    );
    if (conditionalCalls === 2) assert.equal(o.header['If-Modified-Since'], 'Fri, 11 Sep 2026 05:41:24 GMT');
  };
  await cc.manifest(base);
  conditional.advance();
  await cc.manifest(base);
  await flush();
  conditional.wx.request = (o) =>
    queueMicrotask(() =>
      o.success({ statusCode: 200, data: { version: 1, assets: {} }, header: { etag: '"bad"' } })
    );
  conditional.advance();
  await cc.manifest(base);
  await flush();
  assert.ok(
    conditional.storage[INDEX].manifests[base].data.assets.a,
    'invalid update cannot replace the working manifest'
  );

  const g = fixture(),
    concurrent = g.cache(),
    pg = g.manifest.assets.a.pages[0],
    held = [];
  g.holdDownload = held;
  const loads = [concurrent.loadImage(base, pg, g.decode), concurrent.loadImage(base, pg, g.decode)];
  await flush();
  assert.equal(g.downloads.length, 1, 'in-flight file download shared by separate canvases');
  held[0]();
  await Promise.all(loads);
  g.holdDownload = null;
  g.quota = true;
  const pb = g.manifest.assets.b.pages[0];
  assert.deepEqual(
    await concurrent.loadImage(base, pb, g.decode),
    g.network.get('b.png'),
    'full disk falls back to temporary playback'
  );
  assert.ok(
    ![...g.disk.keys()].some((p) => p.startsWith('/tmp/')),
    'temporary playback file released after decoding'
  );
  g.quota = false;
  await assert.rejects(
    concurrent.loadImage(base, pb, async () => {
      throw Error('invalid image');
    }),
    /invalid image/
  );
  assert.ok(!g.storage[INDEX].files['md5:' + pb.md5], 'failed decoding evicts invalid PNG');
  await concurrent.loadImage(base, pb, g.decode);

  const noIndex = fixture(),
    ni = noIndex.cache();
  noIndex.wx.setStorageSync = () => {
    throw Error('storage index full');
  };
  await ni.loadImage(base, noIndex.manifest.assets.a.pages[0], noIndex.decode);
  assert.equal(noIndex.disk.size, 0, 'failed index persistence cannot leave untracked PNGs');

  const h = fixture(),
    lru = h.cache({ maxBytes: 8 }),
    ha = h.manifest.assets.a.pages[0],
    hb = h.manifest.assets.b.pages[0];
  await lru.loadImage(base, ha, h.decode);
  await lru.loadImage(base, hb, h.decode);
  assert.equal(Object.keys(h.storage[INDEX].files).length, 1, 'disk LRU respects byte budget');
  assert.ok(h.storage[INDEX].files['md5:' + hb.md5]);
  // Legacy published manifests already use content-hashed names, without MD5 fields.
  const legacy = fixture(),
    lc = legacy.cache(),
    lp = { file: 'a.png', width: 10, height: 10 };
  await lc.loadImage(base, lp, legacy.decode);
  await legacy.cache().loadImage(base, lp, legacy.decode);
  assert.equal(
    legacy.downloads.length,
    1,
    'previous release works before server checksum metadata is published'
  );
  await legacy.cache().loadImage(base, legacy.manifest.assets.a.pages[0], legacy.decode);
  assert.equal(legacy.downloads.length, 1, 'adding server MD5 metadata reuses matching legacy local PNG');

  const inflight = fixture(),
    ic = inflight.cache(),
    wait = [];
  inflight.holdDownload = wait;
  const getting = ic.loadImage(base, inflight.manifest.assets.a.pages[0], inflight.decode);
  await flush();
  const clearing = ic.clear();
  wait[0]();
  await Promise.all([getting, clearing]);
  assert.equal(
    Object.keys(inflight.storage[INDEX].files).length,
    0,
    'cleared cache cannot be repopulated by old requests'
  );

  const manifestPath = path.resolve(__dirname, '../../assets/engine/manifest.json');
  const real = JSON.parse(fs.readFileSync(manifestPath));
  for (const asset of Object.values(real.assets))
    for (const page of asset.pages) {
      const png = fs.readFileSync(path.join(path.dirname(manifestPath), page.file));
      assert.equal(page.md5, md5(png), 'packaged manifest MD5 matches actual PNG');
      assert.equal(page.bytes, png.length);
    }
  console.log(
    'Pet file cache: restart/offline reuse, ETag 304, selective MD5 updates, integrity repair, shared downloads, quota fallback, LRU and clear passed.'
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
