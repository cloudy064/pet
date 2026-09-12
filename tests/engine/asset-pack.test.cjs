'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { PipiEngine, AssetManager, installPipiAssets } = require('../../engine');
const { FakeAdapter, finish } = require('./helper.cjs');

function pack() {
  const assets = new AssetManager(new FakeAdapter());
  installPipiAssets(assets, '');
  const companion = require('../../assets/companion/manifest.json');
  assets.import(companion);
  return { ...assets.export(), actions: companion.actions };
}

test('assetPack fetches once before images and installs bundled actions behind ready', async () => {
  const adapter = new FakeAdapter();
  const manifest = pack();
  let fetches = 0;
  adapter.fetchManifest = async (base) => {
    fetches++;
    assert.equal(base, '/packed');
    assert.equal(adapter.loads.length, 0);
    return manifest;
  };
  const pet = new PipiEngine({ adapter, assetPack: '/packed/', autoTick: false });
  await pet.ready;
  assert.equal(fetches, 1);
  for (const action of manifest.actions) assert(pet.actions.get(action.id));
  assert(adapter.loads.every((page) => page.url.startsWith('/packed/') || page.url.startsWith('data:')));
  assert.equal((await finish(pet, pet.play('wave'))).status, 'finished');
  const clip = manifest.actions.find((action) => action.type === 'clip');
  assert(clip);
  assert.equal((await finish(pet, pet.play(clip.id))).status, 'finished');
  pet.destroy();
  assert.equal(pet.assets.stats().pages, 0);
});

test('assetPack rejects missing, invalid and incomplete packs without loading legacy images', async () => {
  for (const fetchManifest of [
    async () => {
      throw Error('offline');
    },
    async () => ({ version: 2, assets: {} }),
    async () => ({ version: 1, assets: {} }),
  ]) {
    const adapter = new FakeAdapter();
    adapter.fetchManifest = fetchManifest;
    const pet = new PipiEngine({ adapter, assetPack: '/bad', autoTick: false });
    await assert.rejects(pet.ready);
    assert.equal(adapter.loads.length, 0);
    pet.destroy();
  }
});

test('destroy during pack download cannot resurrect the engine or start images', async () => {
  const adapter = new FakeAdapter();
  let resolve;
  adapter.fetchManifest = () =>
    new Promise((done) => {
      resolve = done;
    });
  const pet = new PipiEngine({ adapter, assetPack: '/packed' });
  pet.destroy();
  resolve(pack());
  await assert.rejects(pet.ready, /disposed|destroyed/);
  assert.equal(adapter.loads.length, 0);
  assert.equal(pet.status, 'destroyed');
  assert.equal(adapter.frames.size, 0);
});

test('assetPack rejects ambiguous configuration before resource loading', () => {
  for (const options of [
    { assetPack: '' },
    { assetPack: true },
    { assetPack: '   ' },
    { assetPack: '/packed', manifest: pack() },
    { assetPack: '/packed', assetBaseURL: '/old' },
    { assetPack: '/packed', assets: new AssetManager(new FakeAdapter()) },
  ])
    assert.throws(() => new PipiEngine({ adapter: new FakeAdapter(), ...options }), /assetPack/);
});

test('a pack hosted at the site root keeps absolute image paths', async () => {
  const adapter = new FakeAdapter();
  const manifest = pack();
  manifest.assets['base:idle'].pages[0].file = 'idle.png';
  adapter.fetchManifest = async (base) => {
    assert.equal(base, '/');
    return manifest;
  };
  const pet = new PipiEngine({ adapter, assetPack: '/', autoTick: false });
  await pet.ready;
  assert(adapter.loads.some((page) => page.url === '/idle.png'));
  pet.destroy();
});

test('a single atlas is fully loaded at ready and stays resident across actions over the cache budget', async () => {
  const adapter = new FakeAdapter();
  const definition = {
    pages: [{ file: 'all.png', width: 32, height: 16 }],
    tiles: [
      [0, 0, 0, 16, 16],
      [0, 16, 0, 16, 16],
    ],
    frameMap: [0, 1],
    durations: [100, 100],
    crop: { x: 0, y: 0, w: 16, h: 16 },
    anchor: { x: 8, y: 16 },
    subjectHeight: 16,
  };
  adapter.fetchManifest = async () => ({
    version: 1,
    layout: 'single',
    assets: { 'base:idle': definition, pose: definition },
    actions: [{ id: 'demo', type: 'clip', asset: 'pose' }],
  });
  const pet = new PipiEngine({
    adapter,
    assetPack: '/single',
    preset: false,
    maxMemoryBytes: 1,
    autoTick: false,
  });
  await pet.ready;
  assert.equal(adapter.loads.length, 1);
  adapter.fail = () => true;
  for (let i = 0; i < 3; i++) {
    assert.equal((await finish(pet, pet.play('demo'))).status, 'finished');
    pet.assets.trim({ all: true });
  }
  assert.equal(adapter.loads.length, 1);
  assert.equal(pet.assets.stats().pages, 1);
  pet.destroy();
  assert.equal(adapter.released.length, 1);
});

test('refreshing an assetPack updates startup sprites and preserves its flight frame mappings', async () => {
  const adapter = new FakeAdapter();
  const manifest = pack();
  adapter.fetchManifest = async () => manifest;
  const pet = new PipiEngine({ adapter, assetPack: '/packed', autoTick: false });
  await pet.ready;
  const next = JSON.parse(JSON.stringify(manifest));
  next.assets['base:idle'].pages[0].file = 'new-idle.png';
  next.assets['flight:up'].frameMap.reverse();
  adapter.fetchManifest = async () => next;
  await pet.refreshAssets('/next');
  assert.equal(pet.assets.get('base:idle').pages[0].file, '/next/new-idle.png');
  assert.deepEqual(pet.assets.get('flight:up').frameMap, next.assets['flight:up'].frameMap);
  assert.equal((await finish(pet, pet.play('wave'))).status, 'finished');
  pet.destroy();
});
