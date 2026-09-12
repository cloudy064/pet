'use strict';
const { copy } = require('../core/utils');

class StorageConflictError extends Error {
  constructor(message = 'Companion storage changed; retry the same event or operation ID') {
    super(message);
    this.name = 'StorageConflictError';
    this.code = 'COMPANION_STORAGE_CONFLICT';
  }
}

function checkRevision(current, next, options) {
  if (!options) return; // Explicit administrative writes/seeding, outside a companion transaction.
  const expected = options.expectedRevision;
  if (!Number.isSafeInteger(expected) || expected < 0 || next.revision !== expected + 1)
    throw new TypeError('Save must advance the expected revision by one');
  if ((current === null ? 0 : current.revision) !== expected) throw new StorageConflictError();
}

function createMemoryStore(initial = null) {
  let value = initial == null ? null : copy(initial);
  return {
    load: async () => (value == null ? null : copy(value)),
    save: async (next, options) => {
      checkRevision(value, next, options);
      value = copy(next);
    },
  };
}

function createWebStore(storage, key = 'pipi-companion-v1', options = {}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function')
    throw new TypeError('Pass a Storage implementation');
  const locks = options.locks || (typeof navigator !== 'undefined' && navigator.locks);
  const load = async () => {
    const value = storage.getItem(key);
    return value === null ? null : JSON.parse(value);
  };
  return {
    load,
    async save(value, expected) {
      if (!locks || typeof locks.request !== 'function')
        throw new Error(
          'Shared Web storage requires Web Locks in a secure context; provide an atomic storage adapter'
        );
      return locks.request('pipi-companion-store:' + key, async () => {
        checkRevision(await load(), value, expected);
        storage.setItem(key, JSON.stringify(value));
      });
    },
  };
}

// All adapters for a wx API object/key share one read-check-write queue in the app JS realm.
const wechatWrites = new WeakMap();
function createWechatStore(wx, key = 'pipi-companion-v1') {
  if (!wx || typeof wx.getStorage !== 'function' || typeof wx.setStorage !== 'function')
    throw new TypeError('Pass the wx storage API');
  if (!wechatWrites.has(wx)) wechatWrites.set(wx, new Map());
  const queues = wechatWrites.get(wx);
  const load = () =>
    new Promise((resolve, reject) =>
      wx.getStorage({
        key,
        success: ({ data }) => resolve(data),
        fail: (error) =>
          /not found|not exist|data not found/i.test(error.errMsg || '') ? resolve(null) : reject(error),
      })
    );
  return {
    load,
    save(data, options) {
      const task = (queues.get(key) || Promise.resolve()).then(async () => {
        checkRevision(await load(), data, options);
        await new Promise((resolve, reject) =>
          wx.setStorage({ key, data, success: () => resolve(), fail: reject })
        );
      });
      const tail = task.catch(() => {});
      queues.set(key, tail);
      tail.then(() => {
        if (queues.get(key) === tail) queues.delete(key);
      });
      return task;
    },
  };
}

module.exports = { createMemoryStore, createWebStore, createWechatStore, StorageConflictError };
