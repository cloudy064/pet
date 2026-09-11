'use strict';
const { EventEmitter } = require('./events');
const { ActionRegistry } = require('./registry');
const { AssetManager } = require('./assets');
const { CanvasRenderer } = require('./renderer');
const { PlanFactory } = require('./plans');
const { Playback } = require('./playback');
const { frameAt } = require('./timeline');
const { DIRECTIONS, clamp, positive, finite, copy, deferred, validatePlaybackOptions } = require('./utils');
const { DEFAULT_ACTIONS, DEFAULT_ASSET_BASE, installPipiAssets } = require('../presets/pipi');

class PipiEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    if (!options.adapter) throw new TypeError('Provide a WebAdapter or WechatAdapter');
    this.adapter = options.adapter;
    this.options = options;
    this.destroyed = false;
    this.visible = true;
    this.paused = false;
    this.status = 'loading';
    this.width = positive(
      options.width === undefined
        ? this.adapter.canvas.clientWidth || this.adapter.canvas.width || 360
        : options.width,
      'Width'
    );
    this.height = positive(
      options.height === undefined
        ? this.adapter.canvas.clientHeight || this.adapter.canvas.height || 320
        : options.height,
      'Height'
    );
    this.baseSize = positive(options.size === undefined ? 112 : options.size, 'Body size');
    this.scale = positive(options.scale === undefined ? 1 : options.scale, 'Scale');
    this.speed = positive(options.speed === undefined ? 1 : options.speed, 'Speed');
    this.dpr = positive(options.dpr === undefined ? 1 : options.dpr, 'Pixel ratio');
    this.position = { x: this.width / 2, y: this.height * 0.8, ...options.position };
    finite(this.position.x, 'x');
    finite(this.position.y, 'y');
    this.time = 0;
    this.idleTime = 0;
    this.lastTime = null;
    this.frameId = null;
    this.autoTick = options.autoTick !== false;
    this.random = options.random || Math.random;
    this.assets =
      options.assets ||
      new AssetManager(this.adapter, { maxBytes: options.maxMemoryBytes || 48 * 1024 * 1024 });
    this.assetBaseURL = options.assetBaseURL || DEFAULT_ASSET_BASE;
    if (options.preset !== false) installPipiAssets(this.assets, this.assetBaseURL);
    if (options.manifest) this.assets.import(options.manifest, { baseURL: this.assetBaseURL });
    this.actions = options.actions || new ActionRegistry(options.preset === false ? [] : DEFAULT_ACTIONS);
    this.actions.assetResolver = (id) => this.assets.get(id);
    for (const action of this.actions.list()) this.actions.validate(action);
    this.plans = new PlanFactory();
    this.renderer = new CanvasRenderer(this.adapter);
    this.renderer.resize(this.width, this.height, this.dpr);
    this.current = null;
    this.queue = [];
    this.plugins = [];
    this.sequenceGeneration = 0;
    this.importGeneration = 0;
    this.free = null;
    this.speech = null;
    this.manualSpeaking = false;
    this.pointer = null;
    this.tap = null;
    this.idleLease = null;
    this.lastState = null;
    this._offRegistry = this.actions.on('change', (detail) => this.emit('librarychange', detail));
    this._unbind = this.adapter.bind
      ? this.adapter.bind(this, { interactive: options.interactive !== false })
      : () => {};
    this.ready = this.initialize();
    this.ready.catch((error) => this.emit('error', { error, phase: 'initialize' }));
  }
  async initialize() {
    const keys = ['base:idle'];
    if (this.assets.has('base:talk')) keys.push('base:talk');
    const lease = await this.assets.acquire(keys);
    if (this.destroyed) {
      lease.release();
      throw new Error('Engine destroyed');
    }
    this.idleLease = lease;
    this.position = this.constrain(this.position);
    this.status = 'ready';
    this.draw();
    this.schedule();
    this.emit('ready', this.snapshot());
    return this;
  }
  ensureAlive() {
    if (this.destroyed) throw new Error('Engine destroyed');
  }
  get size() {
    return this.baseSize * this.scale;
  }
  snapshot() {
    return {
      status: this.status,
      action: this.current ? this.current.action : 'idle',
      position: { ...this.position },
      size: this.size,
      scale: this.scale,
      speed: this.speed,
      paused: this.paused,
      visible: this.visible,
      speaking: !!this.speech || this.manualSpeaking,
      frame: this.lastState ? this.lastState.frame || 0 : 0,
      elapsed: this.current ? this.current.elapsed : 0,
      duration: this.current ? this.current.duration : 0,
      queue: this.queue.map((p) => p.action),
      free: !!this.free,
      cache: { ...this.assets.stats(), tileBytes: this.renderer.tileBytes },
    };
  }
  bounds({ lift = 0, size = this.size } = {}) {
    const ext = [0, 0, 0, 0];
    for (const id of this.assets.list()) {
      const a = this.assets.get(id);
      if (a.patch) continue;
      const z = size / a.subjectHeight,
        c = a.crop;
      const values = [
        (a.anchor.x - c.x) * z,
        (a.anchor.y - c.y) * z,
        (c.x + c.w - a.anchor.x) * z,
        (c.y + c.h - a.anchor.y) * z,
      ];
      values.forEach((v, i) => {
        ext[i] = Math.max(ext[i], v);
      });
    }
    const pad = this.options.padding === undefined ? 8 : Math.max(0, this.options.padding);
    let left = pad + ext[0],
      right = this.width - pad - ext[2],
      top = pad + ext[1] + lift,
      bottom = this.height - pad - ext[3];
    if (left > right) left = right = this.width / 2;
    if (top > bottom) top = bottom = this.height * 0.8;
    return { left, right, top, bottom };
  }
  constrain(point, options) {
    finite(point.x, 'x');
    finite(point.y, 'y');
    const b = this.bounds(options);
    return { x: clamp(point.x, b.left, b.right), y: clamp(point.y, b.top, b.bottom) };
  }
  setPosition(x, y) {
    this.ensureAlive();
    this.stop();
    this.position = this.constrain(typeof x === 'object' ? x : { x, y });
    this.draw();
    this.emit('move', this.snapshot());
    return this;
  }
  setScale(scale) {
    this.ensureAlive();
    positive(scale, 'Scale');
    this.stop();
    this.scale = scale;
    this.position = this.constrain(this.position);
    this.draw();
    this.emit('scale', this.snapshot());
    return this;
  }
  resize(width, height, dpr = this.dpr) {
    this.ensureAlive();
    positive(width, 'Width');
    positive(height, 'Height');
    positive(dpr, 'Pixel ratio');
    this.pointerCancel();
    this.stop();
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.renderer.resize(width, height, dpr);
    this.position = this.constrain(this.position);
    this.draw();
    return this;
  }
  setSpeed(speed) {
    this.ensureAlive();
    this.speed = positive(speed, 'Speed');
    this.emit('speed', this.snapshot());
    return this;
  }
  context() {
    return {
      assets: this.assets,
      actions: this.actions,
      position: { ...this.position },
      scale: this.scale,
      size: this.size,
      baseSize: this.baseSize,
      destination: (options, action, from = this.position, size = this.size) => {
        let to = options.to;
        if (!to) {
          const vector = DIRECTIONS[options.direction || 'e'];
          if (!vector) throw new TypeError('Expected one of eight direction codes');
          const distance =
              options.distance === undefined ? size * 1.5 : positive(options.distance, 'Distance'),
            norm = Math.hypot(...vector);
          to = { x: from.x + (vector[0] * distance) / norm, y: from.y + (vector[1] * distance) / norm };
        }
        const end = this.constrain(to, {
          size,
          lift:
            action.type === 'flight' ? (options.lift === undefined ? (size * 86) / 240 : options.lift) : 0,
        });
        if (Math.hypot(end.x - from.x, end.y - from.y) < 1)
          throw new RangeError('Destination is outside the available movement area');
        return end;
      },
    };
  }
  play(id, options = {}) {
    this.ensureAlive();
    const action = this.actions.get(id);
    if (action.enabled === false) throw new Error('Action disabled: ' + id);
    validatePlaybackOptions(options);
    if (!options.queue) this.stop({ clearQueue: true, reason: 'replaced' });
    const playback = new Playback(this, id, { ...options });
    this.queue.push(playback);
    this.pump();
    return playback;
  }
  async pump() {
    if (this.destroyed || this.current || !this.queue.length) return;
    const playback = (this.current = this.queue.shift());
    playback.status = 'loading';
    this.status = 'loading';
    try {
      await this.ready;
      if (this.current !== playback || this.destroyed) return;
      const action = this.actions.get(playback.action);
      playback.definition = action;
      const plan = this.plans.build(action, playback.options, this.context());
      playback.plan = plan;
      playback.duration = plan.duration;
      const keys = [...plan.assetIds, 'base:idle'];
      if (this.assets.has('base:talk')) keys.push('base:talk');
      const lease = await this.assets.acquire(keys);
      if (this.current !== playback || this.destroyed) {
        lease.release();
        return;
      }
      playback.lease = lease;
      playback.status = 'playing';
      this.status = 'playing';
      this.idleTime = 0;
      if (playback.wantsRelease) this.release(playback);
      playback._ready.resolve({ status: 'ready', action: playback.action });
      this.draw();
      this.emit('start', { playback, action: playback.action });
      this.schedule();
    } catch (error) {
      if (this.current !== playback || this.destroyed) return;
      this.finish(playback, 'failed', { error });
      this.emit('error', { error, action: playback.action, phase: 'play' });
    }
  }
  finish(playback, status, detail = {}) {
    if (playback !== this.current) return;
    if (this.speech && this.speech.playback === playback) this.stopSpeech(status);
    if (playback.lease) playback.lease.release();
    this.current = null;
    this.status = 'ready';
    playback.settle(status, detail);
    this.idleTime = 0;
    if (this.free)
      this.free.next =
        this.time + this.free.minDelay + this.random() * (this.free.maxDelay - this.free.minDelay);
    this.draw();
    this.pump();
    this.emit(status === 'finished' ? 'finish' : 'cancel', { ...playback.result, playback });
  }
  cancel(playback) {
    if (playback === this.current) {
      this.stop({ clearQueue: false, reason: 'cancelled' });
      return;
    }
    const index = this.queue.indexOf(playback);
    if (index >= 0) {
      this.queue.splice(index, 1);
      playback.settle('cancelled', { reason: 'cancelled' });
    }
  }
  stop({ clearQueue = true, reason = 'stopped' } = {}) {
    this.sequenceGeneration++;
    if (clearQueue) {
      for (const item of this.queue) item.settle('cancelled', { reason });
      this.queue = [];
    }
    this.stopSpeech(reason);
    this.manualSpeaking = false;
    this.tap = null;
    if (this.current) this.finish(this.current, 'cancelled', { reason });
    else this.draw();
    return this;
  }
  release(playback = this.current) {
    if (!playback || playback.result) return this;
    playback.wantsRelease = true;
    if (playback.plan) {
      if (typeof playback.plan.release === 'function') playback.plan.release(playback.elapsed);
      if (playback.plan.duration === Infinity) {
        // Generic looping clip: finish its current cycle.
        const cycle = playback.plan.segments && playback.plan.segments[0].cycle;
        playback.releaseAt = cycle
          ? Math.max(cycle, Math.ceil(playback.elapsed / cycle) * cycle)
          : playback.elapsed;
      }
      playback.duration = Number.isFinite(playback.plan.duration)
        ? playback.plan.duration
        : playback.releaseAt;
    }
    return this;
  }
  moveTo(to, { mode = 'walk', ...options } = {}) {
    if (!['walk', 'flight'].includes(mode)) throw new TypeError('Movement mode must be walk or flight');
    return this.play(mode, { ...options, to });
  }
  growTo(scale, options = {}) {
    return this.play('grow', { ...options, scale: positive(scale, 'Target scale') });
  }
  seek(elapsed) {
    this.ensureAlive();
    finite(elapsed, 'Elapsed time');
    if (!this.current || !this.current.plan) return this;
    this.current.elapsed = clamp(elapsed, 0, this.current.duration);
    this.applySample();
    this.draw();
    this.emit('seek', this.snapshot());
    return this;
  }
  stepFrame(offset = 1) {
    this.ensureAlive();
    if (offset !== 1 && offset !== -1) throw new TypeError('Frame step must be 1 or -1');
    if (!this.current || this.current.status !== 'playing') return this;
    this.pause();
    const playback = this.current,
      key = (time) => JSON.stringify(playback.plan.sample(time).layers);
    const before = key(playback.elapsed),
      limit = Number.isFinite(playback.duration) ? playback.duration : playback.elapsed + 10000;
    for (let time = playback.elapsed + offset; time >= 0 && time <= limit; time += offset)
      if (key(time) !== before) return this.seek(time);
    return Number.isFinite(playback.duration) ? this.seek(offset === 1 ? playback.duration : 0) : this;
  }
  pause() {
    this.paused = true;
    this.halt();
    if (this.speech && this.speech.audio) this.speech.audio.pause();
    this.emit('pause', this.snapshot());
    return this;
  }
  resume() {
    this.ensureAlive();
    this.paused = false;
    this.lastTime = null;
    if (this.visible && this.speech && this.speech.audio) this.playAudio(this.speech);
    this.schedule();
    this.emit('resume', this.snapshot());
    return this;
  }
  setVisible(visible) {
    this.visible = !!visible;
    this.pointerCancel();
    this.lastTime = null;
    if (!this.visible) {
      this.halt();
      if (this.speech && this.speech.audio) this.speech.audio.pause();
    } else {
      if (!this.paused && this.speech && this.speech.audio) this.playAudio(this.speech);
      this.schedule();
    }
    return this;
  }
  halt() {
    if (this.frameId !== null) {
      this.adapter.cancelFrame(this.frameId);
      this.frameId = null;
    }
  }
  schedule() {
    if (
      !this.autoTick ||
      this.destroyed ||
      this.paused ||
      !this.visible ||
      !this.idleLease ||
      this.frameId !== null
    )
      return;
    this.frameId = this.adapter.requestFrame(() => {
      this.frameId = null;
      const now = this.adapter.now(),
        dt = this.lastTime === null ? 0 : Math.max(0, now - this.lastTime);
      this.lastTime = now;
      this.update(dt);
      this.schedule();
    });
  }
  update(milliseconds) {
    finite(milliseconds, 'Delta time');
    if (milliseconds < 0) throw new RangeError('Delta time cannot be negative');
    if (this.destroyed || this.paused || !this.visible || !this.idleLease) return;
    const dt = milliseconds * this.speed;
    this.time += dt;
    if (this.tap && this.time >= this.tap.at) {
      this.tap = null;
      if (this.actions.has('pet')) {
        if (this.options.interactionAudio) this.speak(this.options.interactionAudio, { gesture: 'pet' });
        else this.play('pet');
      }
    }
    const current = this.current;
    if (current && current.status === 'playing') {
      current.elapsed += dt * (current.options.speed || 1) * (current.definition.speed || 1);
      this.applySample();
      this.draw();
      if (current.elapsed >= current.duration) {
        if (current.plan.destination) this.position = { ...current.plan.destination };
        if (current.plan.targetScale) this.scale = current.plan.targetScale;
        this.position = this.constrain(this.position);
        this.finish(current, 'finished');
      }
    } else if (!current) {
      this.idleTime += dt;
      if (this.free && this.time >= this.free.next && !this.pointer) this.runFree();
      else if (
        this.options.autoBlink !== false &&
        this.idleTime >= 3300 &&
        this.actions.has('blink') &&
        this.actions.get('blink').enabled !== false &&
        !this.pointer
      ) {
        this.play('blink');
      }
      this.draw();
    }
    if (this.speech) {
      this.speech.elapsed += milliseconds;
      if (this.speech.elapsed >= this.speech.timeout)
        this.endSpeech(this.speech, 'failed', new Error('Speech timeout'));
    }
    this.emit('frame', this.snapshot());
  }
  applySample() {
    if (!this.current || !this.current.plan) return;
    const state = this.current.plan.sample(this.current.elapsed);
    if (Number.isFinite(state.x) && Number.isFinite(state.y)) this.position = { x: state.x, y: state.y };
    if (Number.isFinite(state.scale)) this.scale = state.scale;
  }
  draw() {
    if (!this.idleLease || this.destroyed) return;
    const playback = this.current && this.current.status === 'playing' ? this.current : null;
    const sample = playback
      ? playback.plan.sample(playback.elapsed)
      : { layers: [{ asset: 'base:idle', frame: 0 }], frame: 0 };
    const speaking = !!this.speech || this.manualSpeaking,
      activeWave = playback && playback.definition.type === 'wave';
    const lease = playback ? playback.lease : this.idleLease,
      mouthAsset = lease.assets.get('base:talk');
    const mouthTimes = mouthAsset ? mouthAsset.definition.durations : null;
    const mouth =
      mouthTimes && (speaking || activeWave)
        ? { frame: speaking ? frameAt(mouthTimes, this.time % mouthTimes.reduce((a, b) => a + b, 0)) : 0 }
        : null;
    const state = {
      ...sample,
      x: this.position.x,
      y: this.position.y,
      size: this.size * (sample.pulse || 1),
      mouth,
      openEye: !!activeWave,
    };
    this.lastState = state;
    this.renderer.draw(state, lease.assets);
  }
  setSpeaking(speaking) {
    this.manualSpeaking = !!speaking;
    this.draw();
    return this;
  }
  async speak(source, { gesture = 'talk', timeout = 30000, ...options } = {}) {
    this.ensureAlive();
    if (typeof source !== 'string' || !source) throw new TypeError('Audio source URL is required');
    positive(timeout, 'Speech timeout');
    const playback = this.play(gesture, { ...options, sustain: true });
    const done = deferred(),
      speech = { playback, done, audio: null, elapsed: 0, timeout };
    this.speech = speech;
    const ready = await playback.ready;
    if (this.speech !== speech) return done.promise;
    if (ready.status !== 'ready') {
      this.endSpeech(speech, 'failed', ready.error);
      return done.promise;
    }
    try {
      speech.audio = this.adapter.createAudio(source, {
        ended: () => this.endSpeech(speech, 'finished'),
        error: (error) => this.endSpeech(speech, 'failed', error),
      });
      if (this.visible && !this.paused) this.playAudio(speech);
      this.emit('speechstart', { source, gesture });
      this.draw();
    } catch (error) {
      this.endSpeech(speech, 'failed', error);
    }
    const result = await done.promise;
    if (result.status === 'cancelled') return result;
    const ending = await playback.finished;
    return ending.status === 'finished'
      ? result
      : { status: ending.status, error: ending.error, reason: ending.reason };
  }
  playAudio(speech) {
    try {
      const result = speech.audio.play();
      if (result && result.catch) result.catch((error) => this.endSpeech(speech, 'failed', error));
    } catch (error) {
      this.endSpeech(speech, 'failed', error);
    }
  }
  endSpeech(speech, status, error) {
    if (this.speech !== speech) return;
    this.speech = null;
    if (speech.audio) speech.audio.dispose();
    speech.done.resolve({ status, error });
    this.release(speech.playback);
    this.draw();
    this.emit('speechend', { status, error });
  }
  stopSpeech(reason) {
    const speech = this.speech;
    if (!speech) return;
    this.speech = null;
    if (speech.audio) speech.audio.dispose();
    speech.done.resolve({ status: 'cancelled', reason });
  }
  async celebrate({ audio, scale = this.scale } = {}) {
    positive(scale, 'Target scale');
    this.stop();
    const jump = this.play('jump');
    const owned = this.sequenceGeneration;
    const result = await jump.finished;
    if (result.status !== 'finished' || this.destroyed || this.sequenceGeneration !== owned) return result;
    if (audio) {
      const task = this.speak(audio),
        speechOwned = this.sequenceGeneration;
      const speech = await task;
      if (speech.status === 'cancelled' || this.destroyed || this.sequenceGeneration !== speechOwned)
        return speech;
    }
    if (scale > this.scale) return this.growTo(scale).finished;
    return { status: 'finished', action: 'celebrate' };
  }
  startFree({
    actions = ['blink', 'wink', 'curious', 'wave', 'pet', 'jump', 'walk', 'flight'],
    minDelay = 3000,
    maxDelay = 6000,
  } = {}) {
    positive(minDelay, 'Minimum delay');
    positive(maxDelay, 'Maximum delay');
    if (maxDelay < minDelay) throw new RangeError('Maximum delay is smaller than minimum');
    if (!actions.length || actions.some((id) => !this.actions.has(id)))
      throw new TypeError('Choose registered free actions');
    this.free = { actions: [...actions], minDelay, maxDelay, next: this.time + minDelay };
    this.emit('freemode', true);
    return this;
  }
  stopFree({ cancel = false } = {}) {
    this.free = null;
    if (cancel) this.stop();
    this.emit('freemode', false);
    return this;
  }
  runFree() {
    const candidates = this.free.actions.filter(
      (id) => this.actions.has(id) && this.actions.get(id).enabled !== false
    );
    if (!candidates.length) {
      this.stopFree();
      return;
    }
    const id = candidates[Math.floor(this.random() * candidates.length)],
      action = this.actions.get(id);
    if (['walk', 'flight'].includes(action.type)) {
      const b = this.bounds({ lift: action.type === 'flight' ? (this.size * 86) / 240 : 0 }),
        to = {
          x: b.left + this.random() * (b.right - b.left),
          y: b.top + this.random() * (b.bottom - b.top),
        };
      if (Math.hypot(to.x - this.position.x, to.y - this.position.y) < 8) {
        this.free.next = this.time + this.free.minDelay;
        return;
      }
      this.play(id, { to });
    } else this.play(id);
  }
  pointerDown(point) {
    if (this.destroyed || this.paused || !this.visible || this.pointer) return;
    finite(point.x, 'Pointer x');
    finite(point.y, 'Pointer y');
    if (!this.hitTest(point)) return false;
    const second = !!this.tap;
    this.stop();
    this.doubleTap = second;
    this.pointer = {
      id: point.id,
      start: { x: point.x, y: point.y },
      origin: { ...this.position },
      moved: false,
    };
    return true;
  }
  hitTest(point) {
    const sample = this.lastState;
    if (!sample) return false;
    const playback = this.current && this.current.lease,
      assets = playback ? playback.assets : this.idleLease.assets;
    return sample.layers.some((layer) => {
      const item = assets.get(layer.asset);
      if (!item) return false;
      const definitions = item.definition.patch
        ? [assets.get('base:idle').definition, item.definition]
        : [item.definition];
      return definitions.some((m) => {
        const c = m.crop,
          z = sample.size / m.subjectHeight,
          x = sample.x + (c.x - m.anchor.x) * z,
          y = sample.y - (sample.altitude || 0) + (c.y - m.anchor.y) * z;
        return point.x >= x && point.x <= x + c.w * z && point.y >= y && point.y <= y + c.h * z;
      });
    });
  }
  pointerMove(point) {
    const pointer = this.pointer;
    if (!pointer || pointer.id !== point.id) return;
    const dx = point.x - pointer.start.x,
      dy = point.y - pointer.start.y;
    if (Math.hypot(dx, dy) > 8) pointer.moved = true;
    if (pointer.moved) {
      this.position = this.constrain({ x: pointer.origin.x + dx, y: pointer.origin.y + dy });
      this.draw();
      this.emit('move', this.snapshot());
    }
  }
  pointerUp(point) {
    const pointer = this.pointer;
    if (!pointer || pointer.id !== point.id) return;
    this.pointer = null;
    if (!pointer.moved && !this.doubleTap) this.tap = { at: this.time + 350 };
    this.doubleTap = false;
  }
  pointerCancel() {
    this.pointer = null;
    this.tap = null;
    this.doubleTap = false;
  }
  registerType(type, { validate, create }) {
    this.ensureAlive();
    if (typeof create !== 'function') throw new TypeError('Action builder must be a function');
    this.actions.addType(type, validate);
    this.plans.register(type, create);
    return this;
  }
  use(plugin) {
    this.ensureAlive();
    if (!plugin || typeof plugin.install !== 'function')
      throw new TypeError('Plugin requires install(engine)');
    const remove = plugin.install(this);
    this.plugins.push(typeof remove === 'function' ? remove : () => {});
    return this;
  }
  exportProject() {
    return {
      version: 1,
      actions: this.actions.export().actions,
      assets: this.assets.export().assets,
      settings: { size: this.baseSize, scale: this.scale, speed: this.speed },
    };
  }
  async importProject(document, { baseURL = '' } = {}) {
    this.ensureAlive();
    await this.ready;
    const data = typeof document === 'string' ? JSON.parse(document) : copy(document);
    if (!data || data.version !== 1) throw new TypeError('Expected project version 1');
    const settings = { size: this.baseSize, scale: this.scale, speed: this.speed, ...data.settings };
    for (const key of ['size', 'scale', 'speed']) positive(settings[key], key);
    const staged = new AssetManager(this.adapter, { maxBytes: this.assets.maxBytes });
    let lease;
    try {
      staged.import({ version: 1, assets: data.assets }, { baseURL, replace: true });
      staged.get('base:idle');
      const actions = new ActionRegistry();
      actions.validators = new Map(this.actions.validators);
      actions.assetResolver = (id) => staged.get(id);
      actions.import({ version: 1, actions: data.actions }, { replace: true });
      const generation = ++this.importGeneration;
      lease = await staged.acquire(['base:idle', ...(staged.has('base:talk') ? ['base:talk'] : [])]);
      if (this.destroyed || generation !== this.importGeneration)
        throw new Error('Project import superseded or engine destroyed');
      this.stopFree();
      this.stop({ reason: 'project-import' });
      this.idleLease.release();
      this.assets.dispose();
      this._offRegistry();
      this.assets = staged;
      this.actions = actions;
      this.idleLease = lease;
      this._offRegistry = this.actions.on('change', (detail) => this.emit('librarychange', detail));
      this.baseSize = settings.size;
      this.scale = settings.scale;
      this.speed = settings.speed;
      this.position = this.constrain(this.position);
      this.renderer.clear();
      this.draw();
      this.emit('librarychange', { type: 'project-import' });
      return this;
    } catch (error) {
      if (lease) lease.release();
      staged.dispose();
      throw error;
    }
  }
  async preload(ids) {
    await this.ready;
    const keys = [];
    const collect = (id) => {
      const action = this.actions.get(id);
      if (action.type === 'sequence') {
        action.steps.forEach((step) => collect(step.action));
        return;
      }
      if (['walk', 'flight'].includes(action.type)) {
        keys.push(...this.assets.list().filter((key) => key.startsWith(action.type + ':')));
        return;
      }
      keys.push(...this.plans.build(action, {}, this.context()).assetIds);
    };
    for (const id of ids) collect(id);
    const lease = await this.assets.acquire(keys);
    lease.release();
    return this.assets.stats();
  }
  async refreshAssets(baseURL = this.assetBaseURL) {
    await this.ready;
    this.ensureAlive();
    const manifest = await this.adapter.fetchManifest(baseURL),
      project = this.exportProject();
    const temporary = new AssetManager(this.adapter);
    try {
      temporary.import(manifest, { baseURL });
      const updates = temporary.export().assets;
      for (const [id, asset] of Object.entries(updates)) {
        if (
          this.options.preset !== false &&
          ['base:idle', 'base:wave', 'base:talk', 'point:right'].includes(id)
        )
          continue;
        project.assets[id] = asset;
      }
      if (this.options.preset !== false && updates['flight:hover'])
        for (const key of ['flight:up', 'flight:down'])
          project.assets[key] = {
            ...copy(updates['flight:hover']),
            durations: project.assets[key].durations,
          };
      await this.importProject(project);
      this.assetBaseURL = baseURL;
      return this;
    } finally {
      temporary.dispose();
    }
  }
  async clearCache() {
    this.assets.trim({ all: true });
    this.renderer.clear();
    this.draw();
    if (this.adapter.clearCache) await this.adapter.clearCache();
    return this.assets.stats();
  }
  destroy() {
    if (this.destroyed) return;
    this.stopFree();
    this.stop({ reason: 'destroyed' });
    this.destroyed = true;
    this.status = 'destroyed';
    this.pointerCancel();
    this.halt();
    const cleanup = [
      this._unbind,
      this._offRegistry,
      ...this.plugins.reverse(),
      () => {
        if (this.idleLease) this.idleLease.release();
      },
      () => this.assets.dispose(),
      () => this.renderer.clear(),
    ];
    for (const remove of cleanup)
      try {
        remove();
      } catch (error) {
        this.emit('error', { error, phase: 'destroy' });
      }
    this.emit('destroy', {});
    this.removeAllListeners();
  }
}
module.exports = { PipiEngine };
