'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const { createWechatPet, createWechatComponent } = require('../../engine');
const { tick, finish } = require('./helper.cjs');
const md5 = (buffer) => crypto.createHash('md5').update(buffer).digest('hex');
function fixture() {
  const disk = new Map(),
    storage = {},
    downloads = [],
    writes = [],
    draws = [],
    audios = [],
    requests = [];
  const result = (options, fn) =>
    queueMicrotask(() => {
      try {
        options.success(fn());
      } catch (error) {
        options.fail(error);
      }
    });
  const filesystem = {
    getFileInfo(options) {
      result(options, () => {
        const b = disk.get(options.filePath);
        if (!b) throw Error('missing');
        return { digest: md5(b), size: b.length };
      });
    },
    mkdir(options) {
      result(options, () => ({}));
    },
    writeFile(options) {
      result(options, () => {
        const b = Buffer.from(options.data, options.encoding);
        disk.set(options.filePath, b);
        writes.push(options.filePath);
        return {};
      });
    },
    copyFile(options) {
      result(options, () => {
        disk.set(options.destPath, Buffer.from(disk.get(options.srcPath)));
        return {};
      });
    },
    unlink(options) {
      result(options, () => {
        disk.delete(options.filePath);
        return {};
      });
    },
    readdir(options) {
      result(options, () => ({
        files: [...disk.keys()]
          .filter((key) => key.startsWith(options.dirPath + '/'))
          .map((key) => key.slice(options.dirPath.length + 1)),
      }));
    },
  };
  function canvas(width = 700, height = 600) {
    const context = {
      setTransform() {},
      clearRect() {},
      drawImage(...args) {
        draws.push(args);
      },
    };
    return {
      width,
      height,
      getContext: () => context,
      requestAnimationFrame: () => 1,
      cancelAnimationFrame() {},
      createImage() {
        return {
          set src(value) {
            this.path = value;
            queueMicrotask(() => {
              const b = disk.get(value);
              if (!b) {
                if (this.onerror) this.onerror(Error('missing image'));
                return;
              }
              this.width = b.readUInt32BE(16);
              this.height = b.readUInt32BE(20);
              if (this.onload) this.onload();
            });
          },
        };
      },
    };
  }
  const wx = {
    env: { USER_DATA_PATH: 'wxfile://usr' },
    getFileSystemManager: () => filesystem,
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => {
      storage[key] = JSON.parse(JSON.stringify(value));
    },
    getWindowInfo: () => ({ pixelRatio: 2, windowWidth: 390 }),
    createOffscreenCanvas: (options) => canvas(options.width, options.height),
    request(options) {
      requests.push(options);
      result(options, () => ({
        statusCode: 200,
        data: JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../assets/engine/manifest.json'))),
        header: { ETag: '"local"' },
      }));
    },
    downloadFile(options) {
      downloads.push(options.url);
      result(options, () => {
        const name = new URL(options.url).pathname.split('/').at(-1),
          b = fs.readFileSync(path.resolve(__dirname, '../../assets/engine', name)),
          tempFilePath = '/tmp/' + downloads.length;
        disk.set(tempFilePath, b);
        return { statusCode: 200, tempFilePath };
      });
    },
    createInnerAudioContext() {
      const a = {
        play() {
          this.playing = true;
        },
        pause() {
          this.playing = false;
        },
        stop() {
          this.playing = false;
        },
        destroy() {
          this.destroyed = true;
        },
        onEnded(fn) {
          this.ended = fn;
        },
        onError(fn) {
          this.error = fn;
        },
      };
      audios.push(a);
      return a;
    },
  };
  return { wx, canvas, disk, writes, draws, downloads, audios, requests };
}
test('WeChat adapter uses packaged PNGs offline, isolates atlas tiles, and reuses persistent files after restart', async () => {
  const f = fixture(),
    pet = createWechatPet(f.canvas(), f.wx, { width: 700, height: 600, autoTick: false, autoBlink: false });
  await pet.ready;
  assert.equal(f.downloads.length, 0);
  assert.equal(f.writes.length, 2);
  assert(f.draws.some((args) => args[0].width === 242));
  await finish(pet, pet.play('wave'));
  assert.equal(f.writes.length, 3);
  assert.equal(f.downloads.length, 0);
  const pageCount = pet.assets.get('base:jump').pages.length;
  await finish(pet, pet.play('jump'));
  assert.equal(f.downloads.length, pageCount);
  pet.destroy();
  const next = createWechatPet(f.canvas(), f.wx, { autoTick: false, autoBlink: false });
  await next.ready;
  await finish(next, next.play('jump'));
  assert.equal(f.downloads.length, pageCount);
  assert.equal(f.writes.length, 3);
  next.destroy();
});
test('WeChat adapter preserves existing URL query parameters while verifying downloaded bytes', async () => {
  const f = fixture(),
    pet = createWechatPet(f.canvas(), f.wx, { autoTick: false, autoBlink: false });
  await pet.ready;
  const source = pet.assets.export().assets['base:jump'];
  source.pages[0].file += '?token=example';
  pet.assets.define('base:jump', source);
  await finish(pet, pet.play('jump'));
  assert(f.downloads[0].includes('?token=example&v='));
  pet.destroy();
});
test('WeChat component forwards canvas coordinates and page lifecycle; detached callbacks cannot recreate it', async () => {
  const f = fixture(),
    definition = createWechatComponent(f.wx, { autoTick: false, autoBlink: false });
  let callback;
  const events = [],
    instance = {
      properties: { width: 700, height: 600, size: 96, assetBaseURL: '' },
      triggerEvent: (name, detail) => events.push({ name, detail }),
      createSelectorQuery: () => ({
        select() {
          return this;
        },
        fields() {
          return this;
        },
        exec(fn) {
          callback = fn;
        },
      }),
      ...definition.methods,
    };
  definition.lifetimes.attached.call(instance);
  definition.lifetimes.ready.call(instance);
  definition.pageLifetimes.hide.call(instance);
  callback([{ node: f.canvas(), width: 700, height: 600 }]);
  await instance.pet.ready;
  await tick();
  assert(!instance.pet.visible);
  definition.pageLifetimes.show.call(instance);
  assert(instance.pet.visible);
  assert(events.some((e) => e.name === 'ready'));
  const point = { identifier: 1, x: instance.pet.position.x, y: instance.pet.position.y - 30 };
  instance.touchStart({ changedTouches: [point] });
  instance.touchEnd({ changedTouches: [point] });
  instance.pet.update(351);
  await tick();
  assert.equal(instance.pet.current.action, 'pet');
  const speech = instance.pet.speak('speech.mp3');
  await tick();
  assert(f.audios[0].playing);
  definition.pageLifetimes.hide.call(instance);
  assert(!f.audios[0].playing);
  definition.pageLifetimes.show.call(instance);
  assert(f.audios[0].playing);
  definition.lifetimes.detached.call(instance);
  assert.equal((await speech).status, 'cancelled');
  assert(f.audios[0].destroyed);
  assert.equal(instance.pet, null);
  callback([{ node: f.canvas(), width: 700, height: 600 }]);
  assert.equal(instance.pet, null);
});
