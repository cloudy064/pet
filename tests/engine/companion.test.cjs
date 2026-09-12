'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { make, tick } = require('./helper.cjs');
const {
  PetCompanion,
  growthHeight,
  createMemoryStore,
  BATH_CELLS,
  installCompanionAnimations,
} = require('../../engine/companion');

async function fixture(options = {}) {
  const { pet, adapter } = await make();
  let now = 100000000;
  const companion = new PetCompanion(pet, { clock: () => now, ...options });
  await companion.ready;
  return {
    pet,
    adapter,
    companion,
    advance: (ms) => {
      now += ms;
    },
    destroy: () => pet.destroy(),
  };
}

test('companion logarithmic growth is monotone, bounded, configurable and rejects invalid values', () => {
  assert.equal(growthHeight(0), 58);
  assert.equal(growthHeight(320), 104);
  assert.equal(growthHeight(1000000), 104);
  assert(growthHeight(1) - growthHeight(0) > growthHeight(100) - growthHeight(99));
  assert.equal(growthHeight(20, { minHeight: 10, maxHeight: 20, growthCap: 20 }), 20);
  for (const value of [-1, Infinity, NaN]) assert.throws(() => growthHeight(value));
  assert.throws(() => growthHeight(1, { maxHeight: 10 }));
});

test('learning rewards persist before feedback, deduplicate revisions and survive cancelled animation/restart', async () => {
  const storage = createMemoryStore(),
    f = await fixture({ storage });
  const event = { id: 'task-1', type: 'knowledgeMastered', revision: 1, displayName: '凑十' };
  assert.equal((await f.companion.handleEvent(event)).status, 'accepted');
  assert.equal((await f.companion.handleEvent(event)).status, 'duplicate');
  assert.equal((await f.companion.handleEvent({ ...event, id: 'another-id' })).status, 'duplicate');
  f.companion.setMode('learning');
  assert.equal(f.pet.free, null);
  assert.equal(f.pet.current, null);
  assert.equal(f.companion.state.growthPoints, 3);
  f.destroy();
  const next = await fixture({ storage });
  assert.equal(next.companion.state.growthPoints, 3);
  assert.equal(next.pet.size, growthHeight(3));
  next.destroy();
});

test('a failed save cannot award growth or emit successful feedback', async () => {
  const store = createMemoryStore();
  const f = await fixture({ storage: store });
  store.save = async () => {
    throw Error('disk full');
  };
  let feedback = 0;
  f.companion.on('dialogue', () => feedback++);
  await assert.rejects(f.companion.handleEvent({ id: 'task', type: 'taskCompleted', revision: 1 }), /disk full/);
  assert.equal(f.companion.state.growthPoints, 0);
  assert.equal(feedback, 0);
  f.destroy();
});

test('background and learning suppress idle requests, bounded decay never subtracts growth', async () => {
  const f = await fixture();
  await f.companion.handleEvent({ id: 'learn', type: 'taskCompleted', revision: 1 });
  f.companion.setMode('learning');
  f.advance(30 * 24 * 3600000);
  f.companion.tick(60000);
  await f.companion.refreshNeeds();
  assert.equal(f.companion.request, null);
  assert.equal(f.companion.state.growthPoints, 1);
  assert.equal(f.companion.state.satiation, 43);
  assert.equal(f.companion.state.cleanliness, 64);
  const time = f.companion.foregroundMs;
  f.pet.setVisible(false);
  f.companion.tick(100000);
  assert.equal(f.companion.mode, 'hidden');
  assert.equal(f.companion.foregroundMs, time);
  f.pet.setVisible(true);
  assert.equal(f.companion.mode, 'learning');
  f.destroy();
});

test('requests are singular and dismissal respects cooldown, eye break waits for a learning boundary', async () => {
  const f = await fixture({ rules: { eyeBreakMs: 1000, requestDelayMs: 1000 } });
  f.companion.setMode('learning');
  f.companion.tick(1001);
  await f.companion.refreshNeeds();
  assert.equal(f.companion.request, null);
  assert(f.companion.requestEyeBreak());
  await f.companion.respondToRequest();
  assert.equal(f.companion.mode, 'rest');
  f.companion.setMode('home');
  assert.equal(f.companion.foregroundMs, 0);
  f.companion.tick(1001);
  await f.companion.refreshNeeds();
  assert(f.companion.request);
  f.companion.dismissRequest();
  await f.companion.refreshNeeds();
  assert.equal(f.companion.request, null);
  f.destroy();
});

test('wallet timeout leaves a durable operation and recovery applies a receipt once', async () => {
  const storage = createMemoryStore();
  let calls = 0,
    debit = 0;
  const receipt = { operationId: 'meal-1', revision: 1, status: 'committed' };
  const wallet = {
    async spend() {
      calls++;
      if (calls === 1) {
        debit += 3;
        throw Error('response lost');
      }
      return receipt;
    },
  };
  const f = await fixture({ storage, wallet });
  await assert.rejects(f.companion.feed({ operationId: 'meal-1' }), /response lost/);
  assert.equal(f.companion.state.pendingCare.id, 'meal-1');
  assert.equal(f.companion.state.satiation, 75);
  f.destroy();
  const next = await fixture({ storage, wallet });
  assert.equal((await next.companion.recoverCare()).status, 'accepted');
  assert.equal(next.companion.state.satiation, 100);
  assert.equal(next.companion.state.pendingCare, null);
  assert.equal((await next.companion.feed({ operationId: 'meal-1' })).status, 'duplicate');
  assert.equal(debit, 3);
  next.destroy();
});

test('declined wallet does not grant food and an invalid receipt remains recoverable', async () => {
  let invalid = false;
  const wallet = {
    async spend({ operationId }) {
      return invalid ? {} : { operationId, revision: 0, status: 'declined' };
    },
  };
  const f = await fixture({ wallet });
  assert.equal((await f.companion.feed({ operationId: 'empty' })).status, 'insufficient-funds');
  assert.equal(f.companion.state.satiation, 75);
  assert.equal(f.companion.state.pendingCare, null);
  invalid = true;
  await assert.rejects(f.companion.feed({ operationId: 'invalid' }), /Invalid wallet receipt/);
  assert.equal(f.companion.state.pendingCare.id, 'invalid');
  f.destroy();
});

test('soap coverage requires different body cells; bath survives interruption and grants cleanliness once', async () => {
  const f = await fixture();
  await f.companion.beginBath('bath-1');
  assert.equal(f.pet.options.interactionLocked, true);
  const cell = BATH_CELLS[0],
    point = { x: ((cell % 8) + 0.5) / 8, y: (Math.floor(cell / 8) + 0.5) / 12 };
  for (let i = 0; i < 10; i++) await f.companion.wash(point);
  assert.equal(f.companion.state.bath.cells.length, 1);
  assert.equal((await f.companion.rinse()).status, 'not-ready');
  f.companion.cancelBath();
  await f.companion.beginBath('bath-resume');
  assert.equal(f.companion.state.bath.id, 'bath-1');
  for (const i of BATH_CELLS)
    await f.companion.wash({ x: ((i % 8) + 0.5) / 8, y: (Math.floor(i / 8) + 0.5) / 12 });
  assert.equal(f.companion.state.bath.phase, 'rinse');
  assert.equal((await f.companion.rinse()).status, 'accepted');
  assert.equal(f.companion.state.cleanliness, 100);
  assert.equal(f.companion.state.bath, null);
  assert.equal((await f.companion.beginBath('bath-1')).status, 'duplicate');
  assert.equal(f.pet.options.interactionLocked, false);
  f.destroy();
});

test('companion gestures are opt-in, double tap emits a single response, drag cancels a pending tap', async () => {
  const f = await fixture({ random: () => 0 });
  const types = [];
  f.pet.on('interaction', ({ type }) => {
    if (['tap', 'doubletap'].includes(type)) types.push(type);
  });
  const p = { id: 1, x: f.pet.position.x, y: f.pet.position.y - 20 };
  f.pet.pointerDown(p);
  f.pet.pointerUp(p);
  f.pet.pointerDown(p);
  f.pet.pointerUp(p);
  f.pet.update(400);
  await tick();
  assert.deepEqual(types, ['doubletap']);
  assert.equal(f.pet.current.action, 'jump');
  f.companion.destroy();
  assert.equal(f.pet.options.interactionMode, undefined);
  f.destroy();
});

test('custom staged packs validate every phase and release through their exit segment', async () => {
  const f = await fixture();
  const asset = f.pet.assets.export().assets['base:blink'];
  const manifest = {
    version: 1,
    assets: { 'test:sleep': asset },
    actions: [
      {
        id: 'sleep',
        label: 'Sleep',
        type: 'staged',
        asset: 'test:sleep',
        allowSpeech: false,
        stages: { open: [0, 1, 2], loop: [3, 4], close: [2, 1, 0] },
        holdMs: 100,
      },
    ],
  };
  installCompanionAnimations(f.pet, manifest);
  const playback = f.pet.play('sleep', { sustain: true });
  await playback.ready;
  assert.equal(playback.duration, Infinity);
  playback.release();
  assert(Number.isFinite(playback.duration));
  f.pet.update(playback.duration + 1);
  assert.equal((await playback).status, 'finished');
  const invalid = JSON.parse(JSON.stringify(manifest));
  invalid.actions[0].stages.close = [9999];
  assert.throws(() => installCompanionAnimations(f.pet, invalid), /Stage outside/);
  assert.deepEqual(f.pet.actions.get('sleep').stages.close, [2, 1, 0]);
  assert.throws(
    () => f.pet.actions.update('sleep', { stages: { open: [0], loop: [1], close: [9999] } }),
    /Stage outside/
  );
  f.destroy();
});

test('weighted idle excludes zero-weight actions and avoids consecutive repeats', async () => {
  const f = await fixture({ random: () => 0 });
  f.pet.random = () => 0;
  f.pet.startFree({
    actions: ['blink', 'wink', 'jump'],
    weights: { blink: 1, wink: 1, jump: 0 },
    avoidRepeat: true,
  });
  f.pet.runFree();
  assert.equal(f.pet.current.action, 'blink');
  await f.pet.current.ready;
  f.pet.update(f.pet.current.duration + 1);
  f.pet.runFree();
  assert.equal(f.pet.current.action, 'wink');
  assert.throws(() => f.pet.startFree({ actions: ['blink'], weights: { blink: 0 } }), /weights/);
  f.destroy();
});

test('spoken feedback plays its reward once, then a speaking gesture; hide cancels the local voice', async () => {
  let finishVoice,
    cancelled = 0,
    pauses = 0;
  const voice = {
    play() {
      return {
        finished: new Promise((resolve) => {
          finishVoice = resolve;
        }),
        pause() {
          pauses++;
        },
        resume() {},
        cancel() {
          cancelled++;
          finishVoice({ status: 'cancelled' });
        },
      };
    },
  };
  const f = await fixture({ voice, muted: false });
  const starts = [];
  f.pet.on('start', ({ action }) => starts.push(action));
  await f.companion.handleEvent({ id: 'spoken', type: 'taskCompleted', revision: 1 });
  await tick();
  assert.equal(f.pet.current.action, 'jump');
  assert(Number.isFinite(f.pet.current.duration));
  f.pet.update(f.pet.current.duration + 1);
  await tick();
  assert.equal(f.pet.current.action, 'talk');
  assert(f.companion.activeVoice);
  f.pet.pause();
  assert.equal(pauses, 1);
  f.pet.resume();
  f.companion.setMode('hidden');
  await tick();
  assert.equal(cancelled, 1);
  assert.equal(f.companion.activeVoice, null);
  assert.deepEqual(starts, ['jump', 'talk']);
  f.destroy();
});

test('voice provider failure releases playback rather than leaving an infinite talking loop', async () => {
  const f = await fixture({
    muted: false,
    voice: {
      play() {
        throw Error('voice unavailable');
      },
    },
  });
  const errors = [];
  f.companion.on('error', ({ error }) => errors.push(error.message));
  await f.companion.welcome('speech-fail');
  await tick();
  assert.equal(f.pet.current, null);
  assert.equal(f.companion.feedbackBusy, false);
  assert.deepEqual(errors, ['voice unavailable']);
  f.destroy();
});

test('explicit stroking requires back-and-forth travel, never drags or changes permanent growth', async () => {
  const f = await fixture();
  const before = { ...f.pet.position };
  await f.companion.beginPetting();
  assert.equal(f.pet.options.interactionLocked, true);
  assert.equal(f.pet.size, 58 * 2.25);
  for (let i = 0; i < 8; i++) assert.notEqual(f.companion.stroke({ x: 0.5, y: 0.5 }).status, 'responded');
  const responses = [0.2, 0.7, 0.2, 0.7].map((x) => f.companion.stroke({ x, y: 0.5 }).status);
  assert.equal(responses.filter((status) => status === 'responded').length, 1);
  await tick();
  assert.equal(f.pet.current.action, 'pet');
  assert.deepEqual(f.pet.position, before);
  assert.equal(f.companion.state.growthPoints, 0);
  f.companion.endPetting();
  assert.equal(f.pet.size, 58);
  assert.equal(f.pet.options.interactionLocked, false);
  f.destroy();
});

test('a staged bath holds while washing, resumes after hiding and closes naturally after saved completion', async () => {
  const f = await fixture();
  installCompanionAnimations(f.pet, {
    version: 1,
    assets: { 'test:bath': f.pet.assets.export().assets['base:blink'] },
    actions: [
      {
        id: 'bath',
        type: 'staged',
        asset: 'test:bath',
        allowSpeech: false,
        stages: { open: [0, 1], loop: [2, 3], close: [4, 1, 0] },
      },
    ],
  });
  await f.companion.beginBath('staged-bath');
  await f.pet.current.ready;
  assert.equal(f.pet.current.duration, Infinity);
  f.pet.setVisible(false);
  f.pet.setVisible(true);
  assert.equal(f.companion.careKind, 'bath');
  await f.pet.current.ready;
  for (const i of BATH_CELLS)
    await f.companion.wash({ x: ((i % 8) + 0.5) / 8, y: (Math.floor(i / 8) + 0.5) / 12 });
  await f.companion.rinse();
  assert.equal(f.companion.state.cleanliness, 100);
  assert.equal(f.companion.state.bath, null);
  assert.equal(f.companion.bathClosing, true);
  assert.equal(f.companion.mode, 'care');
  assert(Number.isFinite(f.pet.current.duration));
  f.pet.update(f.pet.current.duration + 1);
  await tick();
  assert.equal(f.companion.mode, 'home');
  assert.equal(f.companion.bathClosing, false);
  f.destroy();
});

test('a late bath save keeps its progress but cannot reopen care over a learning page', async () => {
  const storage = createMemoryStore(),
    f = await fixture({ storage });
  const save = storage.save;
  let release, entered;
  const saving = new Promise((resolve) => {
    entered = resolve;
  });
  storage.save = async (state, options) => {
    entered();
    await new Promise((resolve) => {
      release = resolve;
    });
    await save(state, options);
  };
  const operation = f.companion.beginBath('slow-bath');
  await saving;
  f.companion.setMode('learning');
  release();
  assert.equal((await operation).reason, 'saved-for-later');
  assert.equal(f.companion.mode, 'learning');
  assert.equal(f.pet.options.interactionLocked, false);
  assert.equal(f.companion.state.bath.id, 'slow-bath');
  f.destroy();
});

test('a companion created while its page is hidden does not reactivate rendering', async () => {
  const { pet } = await make();
  pet.setVisible(false);
  const companion = new PetCompanion(pet, { mode: 'learning' });
  await companion.ready;
  assert.equal(companion.mode, 'hidden');
  assert.equal(pet.visible, false);
  pet.setVisible(true);
  assert.equal(companion.mode, 'learning');
  assert.equal(pet.free, null);
  pet.destroy();
});

test('failed initialization releases subscriptions and restores the original interaction policy', async () => {
  const { pet } = await make();
  const before = [...pet.listeners.values()].reduce((n, group) => n + group.size, 0);
  const companion = new PetCompanion(pet, {
    storage: {
      async load() {
        throw Error('storage read failed');
      },
      async save() {
        throw Error('must not overwrite');
      },
    },
  });
  await assert.rejects(companion.ready, /storage read failed/);
  assert.equal(companion.destroyed, true);
  assert.equal(pet.options.interactionMode, undefined);
  assert.equal(
    [...pet.listeners.values()].reduce((n, group) => n + group.size, 0),
    before
  );
  pet.destroy();
});

test('real companion pack keeps props synchronized and can omit their decoded assets', async () => {
  const manifest = require('../../assets/companion/manifest.json');
  const f = await fixture();
  installCompanionAnimations(f.pet, manifest);
  for (const id of ['eatSeed', 'beakWipe']) {
    const action = f.pet.actions.get(id);
    const shown = f.pet.play(id);
    await shown.ready;
    assert(shown.plan.assetIds.includes(action.overlays[0]));
    for (const elapsed of [0, 350, 650, 1000]) {
      const sample = shown.plan.sample(elapsed);
      assert.equal(sample.layers.length, 2);
      assert.equal(sample.layers[0].frame, sample.layers[1].frame);
    }
    const hidden = f.pet.play(id, { effects: false });
    await hidden.ready;
    assert.equal(hidden.plan.sample(500).layers.length, 1);
    assert(!hidden.plan.assetIds.includes(action.overlays[0]));
    assert(!hidden.lease.assets.has(action.overlays[0]));
  }
  f.destroy();
});

test('invalid prop frames fail before replacing the installed action library', async () => {
  const manifest = require('../../assets/companion/manifest.json');
  const f = await fixture();
  installCompanionAnimations(f.pet, manifest);
  const before = f.pet.actions.export();
  const bad = JSON.parse(JSON.stringify(manifest));
  const overlay = bad.assets['companion:eatSeed:prop'];
  overlay.frameMap.pop();
  overlay.durations.pop();
  assert.throws(() => installCompanionAnimations(f.pet, bad), /Overlay frames/);
  assert.deepEqual(f.pet.actions.export(), before);
  f.destroy();
});

test('feeding cues follow actual playback and do not change the saved care result', async () => {
  const manifest = require('../../assets/companion/manifest.json');
  const f = await fixture();
  installCompanionAnimations(f.pet, manifest);
  const cues = [];
  f.companion.on('carephase', (event) => cues.push(event.phase));
  const saved = f.companion.exportState();
  const task = f.pet.play('eatSeed');
  await task.ready;
  for (let time = 0; time < 2000; time += 20) f.pet.update(20);
  assert.deepEqual(cues, ['offer', 'seed-at-beak', 'chew', 'satisfied']);
  assert.deepEqual(f.companion.exportState(), saved);
  f.destroy();
});
