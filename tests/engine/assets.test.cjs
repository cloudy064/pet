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
