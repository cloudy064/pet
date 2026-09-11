'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict');
const { ActionRegistry, AnimationPlan, Timeline, DIRECTIONS, PipiEngine } = require('../../engine');
const { make, FakeAdapter, tick, finish } = require('./helper.cjs');

test('ready, instance isolation, frame boundaries, speed, pause and persistent scale', async () => {
  const { pet, adapter } = await make(),
    { pet: other } = await make();
  const p = pet.play('blink');
  await p.ready;
  const first = pet.assets.get('base:blink').durations[0];
  pet.update(first - 1);
  assert.equal(pet.snapshot().frame, 0);
  pet.update(1);
  assert.equal(pet.snapshot().frame, 1);
  pet.pause();
  const t = p.elapsed;
  pet.update(1000);
  assert.equal(p.elapsed, t);
  pet.resume().setSpeed(2);
  pet.update(10);
  assert.equal(p.elapsed, t + 20);
  pet.setScale(1.5);
  assert.equal((await p.finished).status, 'cancelled');
  pet.update(100);
  assert.equal(pet.scale, 1.5);
  assert.equal(other.scale, 1);
  assert(adapter.draws.length > 0);
  pet.destroy();
  pet.destroy();
  other.destroy();
  assert.equal(adapter.unbound, true);
  assert.equal(pet.assets.stats().bytes, 0);
});
test('registry CRUD, immutability, references, bounds and atomic import', async () => {
  const { pet } = await make(),
    r = pet.actions;
  r.register({ id: 'quickBlink', type: 'clip', asset: 'base:blink', speed: 2 });
  assert.throws(() => {
    r.get('quickBlink').speed = 4;
  }, TypeError);
  r.update('quickBlink', { label: '快速眨眼' });
  assert.equal(r.get('quickBlink').label, '快速眨眼');
  r.register({ id: 'greeting', type: 'sequence', steps: [{ action: 'quickBlink' }, { action: 'wave' }] });
  assert.throws(() => r.remove('quickBlink'), /Unknown sequence/);
  const original = JSON.stringify(r.export());
  assert.throws(() => r.update('quickBlink', { frames: [99999] }), /Frame outside/);
  assert.throws(
    () =>
      r.import({
        version: 1,
        actions: [
          { id: 'a', type: 'sequence', steps: [{ action: 'b' }] },
          { id: 'b', type: 'sequence', steps: [{ action: 'a' }] },
        ],
      }),
    /Cyclic/
  );
  assert.equal(JSON.stringify(r.export()), original);
  r.remove('greeting');
  r.remove('quickBlink');
  assert(!r.has('quickBlink'));
  pet.destroy();
});
test('queue preserves order and cancellation settles every handle', async () => {
  const { pet } = await make(),
    seen = [];
  pet.on('start', (e) => seen.push(e.action));
  const a = pet.play('blink'),
    b = pet.play('jump', { queue: true }),
    c = pet.play('pet', { queue: true });
  await finish(pet, a);
  await finish(pet, b);
  await c.ready;
  assert.deepEqual(seen, ['blink', 'jump', 'pet']);
  c.cancel();
  assert.equal((await c).status, 'cancelled');
  const d = pet.play('wave'),
    e = pet.play('wink', { queue: true });
  pet.stop();
  assert.equal((await d).status, 'cancelled');
  assert.equal((await e).status, 'cancelled');
  pet.destroy();
});
test('loading replacement and destroy discard late image results', async () => {
  const { pet, adapter } = await make();
  adapter.defer = true;
  const a = pet.play('jump');
  await tick();
  assert(adapter.pending.length > 0);
  const b = pet.play('wave');
  adapter.flush();
  await b.ready;
  assert.equal((await a).status, 'cancelled');
  assert.equal(pet.current, b);
  pet.destroy();
  assert.equal((await b).status, 'cancelled');
  await tick();
  assert.equal(pet.assets.stats().bytes, 0);
  const lateAdapter = new FakeAdapter();
  lateAdapter.defer = true;
  const late = new PipiEngine({ adapter: lateAdapter, autoTick: false });
  late.destroy();
  lateAdapter.flush();
  await assert.rejects(late.ready, /disposed|destroyed/);
  assert(lateAdapter.released.length > 0);
});
test('image failure does not trap the player or queued actions', async () => {
  const { pet, adapter } = await make();
  adapter.fail = (p) => p.url.includes('jump');
  const bad = pet.play('jump'),
    next = pet.play('wave', { queue: true });
  assert.equal((await bad).status, 'failed');
  await next.ready;
  assert.equal(pet.current, next);
  pet.destroy();
});
test('sustained wave runs the designed varying loop and exits at a cycle boundary', async () => {
  const { pet } = await make(),
    p = pet.play('wave', { sustain: true });
  await p.ready;
  assert.equal(p.duration, Infinity);
  const plan = p.plan;
  assert(new Set(plan.loop.segments[0].frames).size > 5);
  assert(new Set(plan.loop.segments[0].durations).size > 5);
  pet.update(plan.open.duration + 100);
  p.release();
  assert(Number.isFinite(p.duration));
  assert.equal(plan.closeAt, plan.open.duration + plan.loop.duration);
  pet.seek(plan.closeAt);
  assert.equal(pet.lastState.phase, 'close');
  await finish(pet, p);
  assert.equal(pet.snapshot().action, 'idle');
  pet.destroy();
});
test('looping clip release completes a full cycle', async () => {
  const { pet } = await make(),
    p = pet.play('talk', { loop: true });
  await p.ready;
  const cycle = p.plan.segments[0].cycle;
  pet.update(cycle + 100);
  p.release();
  assert.equal(p.duration, cycle * 2);
  await finish(pet, p);
  pet.destroy();
});
for (const mode of ['walk', 'flight'])
  for (const [dir, vector] of Object.entries(DIRECTIONS))
    test(mode + ' chooses ' + dir + ' from displacement and returns to the ground', async () => {
      const { pet } = await make(),
        from = { ...pet.position },
        to = { x: from.x + vector[0] * 150, y: from.y + vector[1] * 150 };
      const p = pet.moveTo(to, { mode });
      await p.ready;
      assert.equal(p.plan.direction, dir);
      assert(p.plan.assetIds.some((key) => key.startsWith(mode + ':')));
      const states = Array.from({ length: 101 }, (_, i) => p.plan.sample((p.duration * i) / 100));
      assert.equal(states[0].x, from.x);
      assert.equal(states[0].y, from.y);
      assert(states.some((s) => Math.hypot(s.x - from.x, s.y - from.y) > 10));
      for (const s of states) {
        assert(s.x >= Math.min(from.x, to.x) - 0.001 && s.x <= Math.max(from.x, to.x) + 0.001);
        assert(s.y >= Math.min(from.y, to.y) - 0.001 && s.y <= Math.max(from.y, to.y) + 0.001);
      }
      if (mode === 'flight') {
        assert.equal(states[0].altitude, 0);
        assert(states.some((s) => s.altitude > 0));
        assert.equal(states.at(-1).altitude, 0);
      }
      await finish(pet, p);
      assert.deepEqual(pet.position, to);
      pet.destroy();
    });
test('sequence moves from the preceding destination, respects child speed and retains growth', async () => {
  const { pet } = await make();
  pet.actions.register({
    id: 'route',
    type: 'sequence',
    steps: [
      { action: 'walk', options: { to: { x: 750, y: 650 }, speed: 2 } },
      { action: 'grow', options: { scale: 1.3 } },
      { action: 'walk', options: { to: { x: 750, y: 500 } } },
    ],
  });
  const p = pet.play('route');
  await p.ready;
  const [a, b, c] = p.plan.plans;
  assert.deepEqual(c.from, { x: 750, y: 650 });
  assert.equal(c.sample(0).scale, 1.3);
  assert.equal(p.plan.sample(a.duration + b.duration + 1).scale, 1.3);
  await finish(pet, p);
  assert.equal(pet.scale, 1.3);
  assert.deepEqual(pet.position, { x: 750, y: 500 });
  pet.destroy();
});
test('speech owns its gesture, pauses with lifecycle and finishes closing before resolving', async () => {
  const { pet, adapter } = await make(),
    task = pet.speak('hello.mp3', { gesture: 'pointRight' });
  await tick();
  const p = pet.current;
  await p.ready;
  await tick();
  const audio = adapter.audios[0];
  assert(audio.playing);
  pet.setVisible(false);
  pet.update(1000);
  assert(!audio.playing);
  const at = p.elapsed;
  pet.setVisible(true);
  assert(audio.playing);
  pet.update(100);
  assert(p.elapsed > at);
  assert(pet.lastState.mouth);
  audio.callbacks.ended();
  assert(!pet.speech);
  let resolved = false;
  task.then(() => (resolved = true));
  await tick();
  assert(!resolved);
  await finish(pet, p);
  assert.equal((await task).status, 'finished');
  assert(audio.disposed);
  pet.destroy();
});
test('speech cancellation, media failure and timeout never restart an old gesture', async () => {
  const { pet, adapter } = await make();
  const first = pet.speak('first.mp3');
  await tick();
  const second = pet.play('jump');
  assert.equal((await first).status, 'cancelled');
  await second.ready;
  adapter.audios[0].callbacks.ended();
  assert.equal(pet.current, second);
  const failing = pet.speak('bad.mp3', { timeout: 100 });
  await tick();
  pet.update(101);
  const p = pet.current;
  await finish(pet, p);
  assert.equal((await failing).status, 'failed');
  pet.destroy();
});
test('celebrate plays jump once, speech then permanent growth; cancellation prevents late growth', async () => {
  const { pet, adapter } = await make(),
    seen = [];
  pet.on('start', (e) => seen.push(e.action));
  const task = pet.celebrate({ audio: 'reward.mp3', scale: 1.25 });
  await tick();
  await finish(pet, pet.current);
  await tick();
  assert.equal(pet.current.action, 'talk');
  adapter.audios[0].callbacks.ended();
  await finish(pet, pet.current);
  await tick();
  assert.equal(pet.current.action, 'grow');
  await finish(pet, pet.current);
  await task;
  assert.deepEqual(seen, ['jump', 'talk', 'grow']);
  assert.equal(pet.scale, 1.25);
  const cancelled = pet.celebrate({ audio: 'next.mp3', scale: 2 });
  await tick();
  await finish(pet, pet.current);
  await tick();
  pet.setPosition(400, 600);
  assert.equal((await cancelled).status, 'cancelled');
  await tick();
  assert.equal(pet.scale, 1.25);
  assert.equal(pet.current, null);
  pet.destroy();
});
test('single tap pets once, double tap stays idle, drag is static and recovers from edges', async () => {
  const { pet } = await make(),
    p = () => ({ id: 1, x: pet.position.x, y: pet.position.y - 30 });
  assert.equal(pet.pointerDown({ id: 1, x: 0, y: 0 }), false);
  pet.pointerDown(p());
  pet.pointerUp(p());
  pet.update(351);
  await tick();
  assert.equal(pet.current.action, 'pet');
  pet.stop();
  pet.pointerDown(p());
  pet.pointerUp(p());
  pet.update(100);
  pet.pointerDown(p());
  pet.pointerUp(p());
  pet.update(400);
  assert.equal(pet.current, null);
  pet.pointerDown(p());
  pet.pointerMove({ id: 1, x: 99999, y: 99999 });
  pet.pointerUp(p());
  assert.equal(pet.current, null);
  const old = { ...pet.position };
  pet.pointerDown(p());
  pet.pointerMove({ id: 1, x: old.x - 200, y: old.y - 200 });
  pet.pointerUp(p());
  assert(pet.position.x < old.x);
  assert(pet.position.y < old.y);
  pet.destroy();
});
test('free mode survives live action removal and movement stays bounded', async () => {
  const { pet } = await make({ random: () => 0.2 });
  pet.startFree({ actions: ['walk'], minDelay: 1, maxDelay: 1 });
  pet.update(2);
  await tick();
  assert.equal(pet.current.action, 'walk');
  await finish(pet, pet.current);
  pet.actions.remove('walk');
  pet.update(2);
  assert.equal(pet.free, null);
  pet.destroy();
});
test('project import/export roundtrip, malformed data and failed images preserve working project', async () => {
  const { pet, adapter } = await make();
  pet.actions.update('blink', { speed: 2 });
  pet.setScale(1.2);
  const doc = pet.exportProject();
  pet.actions.remove('blink');
  await pet.importProject(JSON.stringify(doc));
  assert.equal(pet.actions.get('blink').speed, 2);
  assert.equal(pet.scale, 1.2);
  const before = JSON.stringify(pet.exportProject()),
    bad = JSON.parse(before);
  bad.actions[1].frames = [999999];
  await assert.rejects(pet.importProject(bad), /Frame outside/);
  assert.equal(JSON.stringify(pet.exportProject()), before);
  adapter.fail = () => true;
  await assert.rejects(pet.importProject(doc), /Injected/);
  assert.equal(JSON.stringify(pet.exportProject()), before);
  adapter.fail = null;
  await finish(pet, pet.play('blink'));
  pet.destroy();
});
test('custom OO plans and plugin cleanup work through the public engine', async () => {
  const { pet } = await make();
  let removed = false;
  class NodPlan extends AnimationPlan {
    constructor() {
      super();
      this.duration = 500;
      this.assetIds = ['base:idle'];
    }
    sample(ms) {
      return { layers: [{ asset: 'base:idle', frame: 0 }], altitude: Math.sin((ms / 500) * Math.PI) * 5 };
    }
  }
  pet.use({
    install(engine) {
      engine.registerType('nod', { validate() {}, create: () => new NodPlan() });
      engine.actions.register({ id: 'nod', type: 'nod' });
      return () => (removed = true);
    },
  });
  const p = pet.play('nod');
  await p.ready;
  pet.update(250);
  assert.equal(pet.lastState.altitude, 5);
  await finish(pet, p);
  pet.destroy();
  assert(removed);
});
test('listener exceptions are reported without corrupting playback', async () => {
  const { pet } = await make(),
    errors = [];
  pet.on('error', (e) => errors.push(e));
  pet.on('start', () => {
    throw new Error('consumer');
  });
  assert.equal((await finish(pet, pet.play('blink'))).status, 'finished');
  assert.equal(errors[0].phase, 'listener');
  pet.destroy();
});
test('frame stepping follows timing and hit testing uses the stable body during a patch action', async () => {
  const { pet } = await make(),
    p = pet.play('blink');
  await p.ready;
  pet.stepFrame(1);
  assert(pet.paused);
  assert.equal(pet.lastState.frame, 1);
  pet.stepFrame(-1);
  assert.equal(pet.lastState.frame, 0);
  const wave = pet.play('wave');
  await wave.ready;
  pet.seek(1800);
  assert(pet.hitTest({ x: pet.position.x, y: pet.position.y - pet.size * 0.5 }));
  pet.resume();
  assert(pet.pointerDown({ id: 1, x: pet.position.x, y: pet.position.y - pet.size * 0.5 }));
  assert.equal((await wave).status, 'cancelled');
  pet.destroy();
});
test('a plugin cleanup error cannot prevent the other resources from being released', async () => {
  const { pet, adapter } = await make();
  let cleaned = false;
  pet.use({
    install() {
      return () => {
        cleaned = true;
      };
    },
  });
  pet.use({
    install() {
      return () => {
        throw new Error('plugin cleanup');
      };
    },
  });
  pet.destroy();
  assert(cleaned);
  assert(adapter.unbound);
  assert.equal(pet.assets.stats().bytes, 0);
  assert.equal(pet.snapshot().status, 'destroyed');
});

test('invalid frame durations, sequence timing and coordinates do not replace a working library or action', async () => {
  const { pet } = await make();
  const before = JSON.stringify(pet.actions.export());
  for (const patch of [{ frames: [0], durations: [0] }, { speed: 0 }])
    assert.throws(() => pet.actions.update('blink', patch));
  assert.throws(() =>
    pet.actions.register({
      id: 'badSequence',
      type: 'sequence',
      steps: [{ action: 'walk', options: { speed: -1 } }],
    })
  );
  assert.equal(JSON.stringify(pet.actions.export()), before);
  const wave = pet.play('wave');
  await wave.ready;
  assert.throws(() => pet.play('walk', { to: { x: NaN, y: 100 } }));
  assert.equal(pet.current, wave);
  pet.destroy();
});
