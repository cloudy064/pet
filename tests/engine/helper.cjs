'use strict';
const { PipiEngine } = require('../../engine');
class FakeAdapter {
  constructor() {
    this.draws = [];
    this.loads = [];
    this.released = [];
    this.audios = [];
    this.pending = [];
    this.defer = false;
    this.fail = null;
    this.frames = new Map();
    this.serial = 0;
    this.context = { setTransform() {}, clearRect() {}, drawImage: (...args) => this.draws.push(args) };
    this.canvas = { width: 1200, height: 1000, getContext: () => this.context };
  }
  now() {
    return 0;
  }
  requestFrame(fn) {
    const id = ++this.serial;
    this.frames.set(id, fn);
    return id;
  }
  cancelFrame(id) {
    this.frames.delete(id);
  }
  resize(w, h, dpr) {
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
  }
  async loadImage(page) {
    this.loads.push(page);
    if (this.defer) await new Promise((resolve) => this.pending.push(resolve));
    if (this.fail && this.fail(page)) throw new Error('Injected image failure');
    return { width: page.width, height: page.height, src: page.url };
  }
  flush() {
    this.defer = false;
    this.pending.splice(0).forEach((fn) => fn());
  }
  releaseImage(image) {
    this.released.push(image);
  }
  createAudio(source, callbacks) {
    const audio = {
      source,
      callbacks,
      playing: false,
      disposed: false,
      play() {
        this.playing = true;
      },
      pause() {
        this.playing = false;
      },
      dispose() {
        this.disposed = true;
        this.playing = false;
      },
    };
    this.audios.push(audio);
    return audio;
  }
  bind() {
    return () => {
      this.unbound = true;
    };
  }
}
async function make(options = {}) {
  const adapter = new FakeAdapter(),
    pet = new PipiEngine({
      adapter,
      width: 1200,
      height: 1000,
      position: { x: 600, y: 650 },
      size: 96,
      autoTick: false,
      autoBlink: false,
      ...options,
    });
  await pet.ready;
  return { pet, adapter };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
async function finish(pet, playback) {
  await playback.ready;
  pet.update(playback.duration + 1);
  return playback.finished;
}
module.exports = { FakeAdapter, make, tick, finish };
