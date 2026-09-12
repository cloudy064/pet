'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { make } = require('./helper.cjs');
const {
  PetCompanion,
  createMemoryStore,
  createWebStore,
  createWechatStore,
  StorageConflictError,
  installCompanionAnimations,
  BATH_CELLS,
} = require('../../engine/companion');
async function fixture(options = {}) {
  const { pet } = await make();
  const c = new PetCompanion(pet, { mode: 'learning', ...options });
  await c.ready;
  return { pet, c };
}
function locks() {
  const queues = new Map();
  return {
    request(key, callback) {
      const task = (queues.get(key) || Promise.resolve()).then(callback);
      queues.set(
        key,
        task.catch(() => {})
      );
      return task;
    },
  };
}
const event = { id: 'first', type: 'taskCompleted', revision: 1 };

test('replay protection survives history eviction and reload, and rejects missing sequences', async () => {
  const storage = createMemoryStore();
  const f = await fixture({ storage, rules: { historyLimit: 2 } });
  await f.c.handleEvent(event);
  await f.c.handleEvent({ ...event, id: 'second', revision: 2 });
  await f.c.handleEvent({ ...event, id: 'third', revision: 3 });
  assert(!f.c.state.recentEvents.includes('first'));
  f.pet.destroy();
  const g = await fixture({ storage });
  assert.equal((await g.c.handleEvent(event)).status, 'duplicate');
  for (const revision of [undefined, 0, -1, 1.5, Infinity])
    await assert.rejects(g.c.handleEvent({ ...event, id: 'invalid', revision }), /revision/);
  assert.equal(g.c.state.growthPoints, 3);
  g.pet.destroy();
});

test('an unfinished bath does not take over petting, background resume or washing input', async () => {
  const f = await fixture({ mode: 'home' });
  installCompanionAnimations(f.pet, require('../../assets/companion/manifest.json'));
  await f.c.beginBath('saved-bath');
  const cell = BATH_CELLS[0];
  const point = { x: ((cell % 8) + 0.5) / 8, y: (Math.floor(cell / 8) + 0.5) / 12 };
  await f.c.wash(point);
  assert.equal(f.c.cancelBath(), f.c);
  await f.c.beginPetting('scratch');
  assert.equal(f.c.careKind, 'scratch');
  assert.notEqual(f.pet.current?.action, 'bath');
  assert.equal((await f.c.wash(point)).status, 'ignored');
  assert.equal((await f.c.rinse()).status, 'not-ready');
  f.pet.setVisible(false);
  f.pet.setVisible(true);
  assert.equal(f.c.mode, 'home');
  assert.notEqual(f.pet.current?.action, 'bath');
  await f.c.beginPetting();
  assert.equal(f.c.endPetting(), f.c);
  await f.c.beginPetting();
  await f.c.beginBath('new-id');
  assert.equal(f.c.careKind, 'bath');
  assert.equal(f.c.state.bath.id, 'saved-bath');
  assert.deepEqual(f.c.state.bath.cells, [cell]);
  assert.equal(f.pet.current.action, 'bath');
  f.pet.destroy();
});

test('two coordinators cannot overwrite the same reward and can retry its original identity', async () => {
  const storage = createMemoryStore();
  const a = await fixture({ storage }),
    b = await fixture({ storage });
  const results = await Promise.allSettled([a.c.handleEvent(event), b.c.handleEvent(event)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled' && r.value.status === 'accepted').length, 1);
  for (const result of results)
    if (result.status === 'rejected') assert(result.reason instanceof StorageConflictError);
  assert.equal((await a.c.handleEvent(event)).status, 'duplicate');
  assert.equal((await b.c.handleEvent(event)).status, 'duplicate');
  assert.equal((await storage.load()).growthPoints, 1);
  a.pet.destroy();
  b.pet.destroy();
});

test('a conflict after wallet commit preserves recovery without a second debit', async () => {
  const storage = createMemoryStore();
  let started,
    release,
    debits = 0;
  const entered = new Promise((r) => {
    started = r;
  });
  let receipt;
  const wallet = {
    async spend({ operationId }) {
      if (receipt) return receipt;
      debits++;
      receipt = { operationId, status: 'committed', revision: 1 };
      started();
      await new Promise((r) => {
        release = r;
      });
      return receipt;
    },
  };
  const a = await fixture({ storage, wallet, mode: 'home' });
  const b = await fixture({ storage });
  const feeding = a.c.feed({ operationId: 'food' });
  await entered;
  await b.c.handleEvent(event);
  release();
  await assert.rejects(feeding, StorageConflictError);
  assert.equal((await storage.load()).pendingCare.id, 'food');
  assert.equal((await a.c.recoverCare()).status, 'accepted');
  assert.equal(debits, 1);
  assert.equal(a.c.state.growthPoints, 1);
  assert(a.c.state.satiation > 99);
  a.pet.destroy();
  b.pet.destroy();
});

for (const platform of ['web', 'wechat'])
  test(platform + ' stores atomically reject competing stale writers', async () => {
    let saved = null;
    let a, b;
    if (platform === 'web') {
      const storage = {
        getItem: () => saved,
        setItem: (_, value) => {
          saved = value;
        },
      };
      const options = { locks: locks() };
      a = createWebStore(storage, 'pet', options);
      b = createWebStore(storage, 'pet', options);
    } else {
      const wx = {
        getStorage({ success, fail }) {
          setImmediate(() =>
            saved === null ? fail({ errMsg: 'data not found' }) : success({ data: saved })
          );
        },
        setStorage({ data, success }) {
          setImmediate(() => {
            saved = data;
            success();
          });
        },
      };
      a = createWechatStore(wx, 'pet');
      b = createWechatStore(wx, 'pet');
    }
    const results = await Promise.allSettled([
      a.save({ revision: 1, growthPoints: 1 }, { expectedRevision: 0 }),
      b.save({ revision: 1, growthPoints: 2 }, { expectedRevision: 0 }),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert(results.find((r) => r.status === 'rejected').reason instanceof StorageConflictError);
    assert.equal((await a.load()).growthPoints, 1);
    await b.save({ revision: 2, growthPoints: 3 }, { expectedRevision: 1 });
    assert.equal((await a.load()).growthPoints, 3);
  });

test('Web storage fails closed without an atomic locking provider', async () => {
  let writes = 0;
  const storage = createWebStore({ getItem: () => null, setItem: () => writes++ }, 'pet', { locks: {} });
  await assert.rejects(storage.save({ revision: 1 }, { expectedRevision: 0 }), /Web Locks/);
  assert.equal(writes, 0);
});

test('demo outbox preserves revisions, seeds and wallet identities across reloads', async () => {
  const sandbox = {};
  vm.runInNewContext(
    fs.readFileSync('examples/companion/ledger.js', 'utf8') + '\nthis.api = PipiDemoLedger;',
    sandbox
  );
  let value = null;
  const storage = {
    getItem: () => value,
    setItem: (_, next) => {
      value = next;
    },
  };
  const a = sandbox.api.create(storage);
  a.migrate(10);
  a.enqueue('task', 'taskCompleted', 1, 3);
  const b = sandbox.api.create(storage);
  b.migrate(10);
  b.enqueue('task', 'taskCompleted', 1, 3);
  assert.equal(b.snapshot().balance, 15);
  assert.equal(b.pending()[0].revision, 11);
  b.delivered('task');
  b.enqueue('game', 'gameCompleted', 0, 0);
  assert.equal(b.pending()[0].revision, 12);
  const input = { operationId: 'meal', amount: 3, reason: 'feed' };
  const receipt = await b.wallet.spend(input);
  assert.equal((await b.wallet.spend(input)).revision, receipt.revision);
  await assert.rejects(b.wallet.spend({ ...input, amount: 6 }), /another purchase/);
  assert.equal(b.snapshot().balance, 12);
  b.close();
  assert.throws(() => b.delivered('game'), /closed/);
  await assert.rejects(b.wallet.spend({ ...input, operationId: 'after-close' }), /closed/);
});

test('simultaneous initialization retries only the state save and preserves the winning revision', async () => {
  const storage = createMemoryStore();
  const [a, b] = await Promise.all([make(), make()]);
  const x = new PetCompanion(a.pet, { storage, mode: 'learning' });
  const y = new PetCompanion(b.pet, { storage, mode: 'learning' });
  await Promise.all([x.ready, y.ready]);
  assert.equal((await storage.load()).revision, 2);
  await x.handleEvent(event);
  assert.equal((await y.handleEvent(event)).status, 'duplicate');
  a.pet.destroy();
  b.pet.destroy();
});

test('a saved bath resumes from hidden initialization, but a completed bath does not reopen care', async () => {
  const storage = createMemoryStore();
  const a = await fixture({ storage, mode: 'home' });
  await a.c.beginBath('resume-bath');
  a.pet.destroy();
  const { pet } = await make();
  installCompanionAnimations(pet, require('../../assets/companion/manifest.json'));
  pet.setVisible(false);
  const c = new PetCompanion(pet, { storage, mode: 'care' });
  await c.ready;
  assert.equal(c.mode, 'hidden');
  pet.setVisible(true);
  assert.equal(c.careKind, 'bath');
  await pet.current.ready;
  for (const i of BATH_CELLS) await c.wash({ x: ((i % 8) + 0.5) / 8, y: (Math.floor(i / 8) + 0.5) / 12 });
  await c.rinse();
  assert(c.bathClosing);
  pet.setVisible(false);
  pet.setVisible(true);
  assert.equal(c.mode, 'home');
  assert.equal(c.careKind, null);
  pet.destroy();
});
