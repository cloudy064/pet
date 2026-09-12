const test = require('node:test'),
  assert = require('node:assert/strict');
const { AssetManager } = require('../../engine'),
  { make, FakeAdapter, tick } = require('./helper.cjs');
const small = (file = 'a.png') => ({
  pages: [{ file, width: 2, height: 2 }],
  tiles: [[0, 0, 0, 2, 2]],
  frameMap: [0],
  durations: [100],
  crop: { x: 0, y: 0, w: 2, h: 2 },
  anchor: { x: 1, y: 2 },
  subjectHeight: 2,
});
test('identical pages share decoded pixels across actions and simultaneous requests', async () => {
  const a = new FakeAdapter(),
    m = new AssetManager(a);
  m.define('first', small());
  m.define('second', small());
  const [one, two] = await Promise.all([m.acquire(['first']), m.acquire(['second'])]);
  assert.equal(a.loads.length, 1);
  assert.equal(m.stats().bytes, 16);
  assert.equal(m.stats().pages, 1);
  assert.equal(one.assets.get('first').images[0], two.assets.get('second').images[0]);
  one.release();
  m.trim({ all: true });
  assert.equal(a.released.length, 0);
  two.release();
  m.trim({ all: true });
  assert.equal(a.released.length, 1);
  assert.equal(m.stats().bytes, 0);
});
test('memory eviction preserves pinned actions and releases the unused atlas', async () => {
  const a = new FakeAdapter(),
    m = new AssetManager(a, { maxBytes: 16 });
  m.define('a', small('a.png'));
  m.define('b', small('b.png'));
  const pinned = await m.acquire(['a']),
    unused = await m.acquire(['b']);
  assert.equal(m.stats().bytes, 32);
  unused.release();
  assert.equal(m.stats().bytes, 16);
  assert.equal(pinned.assets.get('a').images.length, 1);
  pinned.release();
  m.dispose();
  assert.equal(a.released.length, 2);
});
test('updating metadata does not mutate a running lease; rejected manifests are atomic', async () => {
  const a = new FakeAdapter(),
    m = new AssetManager(a);
  m.define('a', small());
  const old = await m.acquire(['a']);
  m.define('a', small('b.png'));
  const current = await m.acquire(['a']);
  assert.notEqual(old.assets.get('a').images[0], current.assets.get('a').images[0]);
  const before = JSON.stringify(m.export());
  assert.throws(
    () => m.import({ version: 1, assets: { bad: { ...small(), tiles: [[0, 0, 0, 99, 99]] } } }),
    /outside/
  );
  assert.equal(JSON.stringify(m.export()), before);
  old.release();
  current.release();
  m.dispose();
});
test('refresh validates actions and keeps packaged welcome patches', async () => {
  const { pet, adapter } = await make(),
    manifest = require('../../assets/engine/manifest.json');
  adapter.fetchManifest = async () => manifest;
  await pet.refreshAssets('https://example.test/assets');
  assert(pet.assets.get('base:wave').patch);
  assert(pet.assets.get('base:wave').pages[0].file.startsWith('data:'));
  const before = pet.exportProject();
  adapter.fetchManifest = async () => ({
    ...manifest,
    assets: {
      ...manifest.assets,
      'base:blink': { ...manifest.assets['base:blink'], frameMap: [], durations: [] },
    },
  });
  await assert.rejects(pet.refreshAssets(), /tiles and frameMap/);
  assert.deepEqual(pet.exportProject(), before);
  pet.destroy();
});

test('cancelling one consumer preserves shared in-flight pages for another', async () => {
  const adapter = new FakeAdapter(),
    manager = new AssetManager(adapter);
  adapter.defer = true;
  manager.define('first', small());
  manager.define('second', small());
  const controller = new AbortController();
  const first = manager.acquire(['first'], { signal: controller.signal });
  const second = manager.acquire(['second']);
  controller.abort();
  await assert.rejects(first, { name: 'AbortError' });
  adapter.flush();
  const lease = await second;
  assert.equal(adapter.loads.length, 1);
  assert.equal(lease.assets.get('second').images.length, 1);
  assert.equal(adapter.released.length, 0);
  lease.release();
  manager.dispose();
  assert.equal(adapter.released.length, 1);
});

test('replacing a loading action aborts its download and never requests its remaining pages', async () => {
  const { pet, adapter } = await make();
  const requests = [];
  const normalLoad = adapter.loadImage.bind(adapter);
  adapter.loadImage = (page, base, { signal } = {}) => {
    if (!page.url.includes('slow')) return normalLoad(page);
    requests.push({ page, signal });
    return new Promise((resolve, reject) =>
      signal.addEventListener(
        'abort',
        () => {
          reject(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
        },
        { once: true }
      )
    );
  };
  const definition = small('slow-first.png');
  definition.pages.push({ file: 'slow-second.png', width: 2, height: 2 });
  pet.assets.define('slow', definition);
  pet.actions.register({ id: 'slow', type: 'clip', asset: 'slow' });
  const old = pet.play('slow');
  await tick();
  const next = pet.play('wave');
  await next.ready;
  await tick();
  assert.equal((await old.finished).status, 'cancelled');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(pet.assets.stats().pending, 0);
  pet.destroy();
});

test('late cancelled image cannot evict a fresh request for the same atlas', async () => {
  const adapter = new FakeAdapter(),
    manager = new AssetManager(adapter);
  manager.define('first', small());
  adapter.defer = true;
  const controller = new AbortController();
  const old = manager.acquire(['first'], { signal: controller.signal });
  controller.abort();
  await assert.rejects(old, { name: 'AbortError' });
  const next = manager.acquire(['first']);
  adapter.flush();
  const lease = await next;
  assert.equal(manager.stats().pages, 1);
  assert.equal(manager.stats().decoded, 1);
  assert.equal(adapter.released.length, 1);
  lease.release();
  manager.dispose();
  assert.equal(adapter.released.length, 2);
});

test('page progress counts shared physical images once and distinguishes partial download', async () => {
  const adapter = new FakeAdapter(),
    manager = new AssetManager(adapter);
  manager.define('one', small());
  manager.define('alias', small());
  manager.define('two', small('second.png'));
  assert.deepEqual(manager.progress(['one', 'alias', 'two']), { loaded: 0, total: 2 });
  const lease = await manager.acquire(['one']);
  assert.deepEqual(manager.progress(['one', 'alias', 'two']), { loaded: 1, total: 2 });
  lease.release();
  manager.dispose();
});

test('predownload deduplicates pages without decoding and disposal cancels pending work', async () => {
  const adapter = new FakeAdapter(),
    m = new AssetManager(adapter);
  m.define('a', small());
  m.define('b', small());
  let count = 0;
  adapter.prefetchImage = async () => {
    count++;
    return { size: 4 };
  };
  const result = await m.predownload(['a', 'b']);
  assert.equal(count, 1);
  assert.equal(result.total, 1);
  assert.equal(m.stats().decoded, 0);
  adapter.prefetchImage = (_, { signal }) =>
    new Promise((resolve, reject) => {
      signal.addEventListener('abort', () =>
        reject(Object.assign(Error('cancelled'), { name: 'AbortError' }))
      );
    });
  const pending = m.predownload(['a']);
  m.dispose();
  await assert.rejects(pending, { name: 'AbortError' });
});
