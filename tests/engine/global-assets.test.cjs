'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { AssetManager, CanvasRenderer, validateAsset } = require('../../engine');
const { FakeAdapter } = require('./helper.cjs');
const asset = () => ({
  pages: [{ file: 'shared.png', width: 8, height: 8 }],
  tiles: [[0, 1, 1, 4, 4]],
  frameMap: [0],
  durations: [50],
  crop: { x: 0, y: 0, w: 16, h: 16 },
  anchor: { x: 8, y: 16 },
  subjectHeight: 16,
  tileRects: [{ x: 4, y: 6, w: 8, h: 8 }],
  patch: true,
});
test('tight placement rejects invalid or out-of-bounds rectangles atomically', () => {
  assert.doesNotThrow(() => validateAsset('tight', asset()));
  for (const rects of [
    [],
    [null],
    [{ x: NaN, y: 0, w: 1, h: 1 }],
    [{ x: 0, y: 0, w: -1, h: 1 }],
    [{ x: 12, y: 0, w: 8, h: 8 }],
  ])
    assert.throws(() => validateAsset('tight', { ...asset(), tileRects: rects }));
  const manager = new AssetManager(new FakeAdapter());
  manager.define('ok', asset());
  const before = manager.export();
  assert.throws(() => manager.import({ version: 1, assets: { bad: { ...asset(), tileRects: [] } } }));
  assert.deepEqual(manager.export(), before);
});
test('shared physical tiles reuse isolated pixels across actions with different placement', async () => {
  const adapter = new FakeAdapter();
  adapter.createCanvas = (width, height) => ({ width, height, getContext: () => adapter.context });
  const manager = new AssetManager(adapter);
  manager.define('first', asset());
  manager.define('second', { ...asset(), tileRects: [{ x: 2, y: 4, w: 8, h: 8 }] });
  const lease = await manager.acquire(['first', 'second']);
  const renderer = new CanvasRenderer(adapter);
  assert.equal(
    renderer.isolate(lease.assets.get('first'), 0),
    renderer.isolate(lease.assets.get('second'), 0)
  );
  assert.equal(renderer.tiles.size, 1);
  lease.release();
  renderer.clear();
  manager.dispose();
});
test('trimmed patches erase the full requested region while drawing only the remaining pixels', async () => {
  const adapter = new FakeAdapter(),
    clears = [];
  adapter.context.clearRect = (...args) => clears.push(args);
  const manager = new AssetManager(adapter);
  manager.define('patch', asset());
  const lease = await manager.acquire(['patch']);
  const renderer = new CanvasRenderer(adapter);
  renderer.resize(100, 100);
  renderer.draw({ x: 50, y: 60, size: 16, layers: [{ asset: 'patch', frame: 0 }] }, lease.assets);
  assert.deepEqual(clears.at(-1), [42, 44, 16, 16]);
  assert.deepEqual(adapter.draws.at(-1).slice(1), [1, 1, 4, 4, 46, 50, 8, 8]);
  renderer.draw(
    { x: 50, y: 60, size: 16, layers: [{ asset: 'patch', frame: 0, region: { x: 6, y: 8, w: 4, h: 4 } }] },
    lease.assets
  );
  assert.deepEqual(adapter.draws.at(-1).slice(1), [2, 2, 2, 2, 48, 52, 4, 4]);
  lease.release();
  manager.dispose();
});

test('sampling metadata restores the original raster canvas before subpixel scaling', async () => {
  const adapter = new FakeAdapter();
  adapter.createCanvas = (width, height) => ({ width, height, getContext: () => adapter.context });
  const manager = new AssetManager(adapter);
  manager.define('patch', {
    ...asset(),
    tileSampling: [{ width: 8, height: 8, rect: { x: 0, y: 0, w: 16, h: 16 } }],
  });
  const lease = await manager.acquire(['patch']);
  const renderer = new CanvasRenderer(adapter);
  renderer.resize(100, 100);
  renderer.draw({ x: 50, y: 60, size: 16, layers: [{ asset: 'patch', frame: 0 }] }, lease.assets);
  assert.deepEqual(adapter.draws.at(-2).slice(1), [1, 1, 4, 4, 3, 4, 4, 4]);
  assert.deepEqual(adapter.draws.at(-1).slice(1), [1, 1, 8, 8, 42, 44, 16, 16]);
  assert.throws(() =>
    validateAsset('bad', {
      ...asset(),
      tileSampling: [{ width: 1, height: 1, rect: { x: 0, y: 0, w: 1, h: 1 } }],
    })
  );
  lease.release();
  renderer.clear();
  manager.dispose();
});
