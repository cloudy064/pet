'use strict';

const { EventEmitter } = require('../core/events');
const { copy, positive } = require('../core/utils');
const { rules, growthHeight, timestamp, validateState, advanceState, remember } = require('./rules');
const { createMemoryStore, StorageConflictError } = require('./storage');
const { CompanionCare } = require('./care');
const { COMPANION_DIALOGUE } = require('./catalog');

const MODES = ['home', 'learning', 'care', 'rest', 'hidden'];
const REWARDS = ['taskCompleted', 'knowledgeMastered', 'gameCompleted'];
const identifier = (id) => {
  if (typeof id !== 'string' || !id.trim() || id.length > 160)
    throw new TypeError('A unique event/operation id is required');
  return id;
};

class PetCompanion extends EventEmitter {
  constructor(engine, options = {}) {
    super();
    if (!engine || typeof engine.play !== 'function') throw new TypeError('Pass a PipiEngine instance');
    this.engine = engine;
    this.options = options;
    this.config = rules(options.rules);
    this.careZoom = positive(options.careZoom === undefined ? 2.25 : options.careZoom, 'Care zoom');
    this.store = options.storage || createMemoryStore();
    if (typeof this.store.load !== 'function' || typeof this.store.save !== 'function')
      throw new TypeError('Storage must implement load and save');
    this.clock = options.clock || Date.now;
    this.random = options.random || Math.random;
    this.mode = options.mode || 'home';
    if (!MODES.includes(this.mode)) throw new TypeError('Unknown companion mode');
    this.care = new CompanionCare(this);
    this.resumeMode = this.mode === 'hidden' ? 'home' : this.mode;
    if (!engine.visible) this.mode = 'hidden';
    this.muted = options.muted !== false;
    this.locale = options.locale || 'zh-CN';
    this.destroyed = false;
    this.state = null;
    this.chain = Promise.resolve();
    this.generation = 0;
    this.feedbackBusy = false;
    this.nextFeedback = null;
    this.request = null;
    this.foregroundMs = 0;
    this.homeMs = 0;
    this.pollMs = 0;
    this.eyeBreakPending = false;
    this.lastFrameTime = null;
    this.lastAction = null;
    this.activeVoice = null;
    this.petting = null;
    this.careKind = null;
    this.bathClosing = false;
    this.oldInteractionMode = engine.options.interactionMode;
    this.oldInteractionLock = engine.options.interactionLocked;
    if (options.interaction !== 'legacy') engine.options.interactionMode = 'events';
    this.off = [
      engine.on('interaction', (event) => this.interact(event)),
      engine.on('start', () => this.observeCareAnimation()),
      engine.on('error', (detail) => this.emit('error', detail)),
      engine.on('visibility', ({ visible }) => {
        if (!visible && this.mode !== 'hidden') this.setMode('hidden');
        else if (visible && this.mode === 'hidden') this.setMode(this.resumeMode);
        this.lastFrameTime = null;
      }),
      engine.on('frame', () => {
        this.observeCareAnimation();
        const now = engine.adapter.now(),
          elapsed = this.lastFrameTime === null ? 0 : Math.max(0, now - this.lastFrameTime);
        this.lastFrameTime = now;
        this.tick(Math.min(1000, elapsed));
      }),
      engine.on('pause', () => {
        this.lastFrameTime = null;
        if (this.activeVoice) this.activeVoice.handle.pause();
      }),
      engine.on('resume', () => {
        this.lastFrameTime = null;
        if (this.activeVoice) this.activeVoice.handle.resume();
      }),
      engine.on('destroy', () => this.destroy()),
    ];
    this.ready = this.initialize();
    this.ready.catch((error) => {
      this.emit('error', { error, phase: 'initialize' });
      this.destroy();
    });
  }

  async initialize() {
    await this.engine.ready;
    // Initialization only persists bounded time decay, so retrying a competing initial save is safe.
    for (let attempt = 0; ; attempt++) {
      const loaded = await this.store.load(),
        now = timestamp(this.clock());
      this.ensureAlive();
      const next = advanceState(validateState(loaded, now, this.config), now, this.config);
      try {
        await this.commit(next);
        break;
      } catch (error) {
        if (error.code !== 'COMPANION_STORAGE_CONFLICT' || attempt >= 3) throw error;
      }
    }
    this.ensureAlive();
    if (this.mode === 'care' && this.state.bath) this.careKind = 'bath';
    if (this.mode === 'hidden' && this.resumeMode === 'care' && this.state.bath) this.resumeCareKind = 'bath';
    this.applyMode();
    this.syncSize();
    this.emit('ready', this.snapshot());
    return this;
  }

  ensureAlive() {
    if (this.destroyed || this.engine.destroyed) throw new Error('Companion destroyed');
  }

  observeCareAnimation() {
    const playback = this.engine.current;
    if (!playback || playback.status !== 'playing' || !['eatSeed', 'bath'].includes(playback.action)) {
      this.careObservation = null;
      return;
    }
    const sample = playback.plan.sample(playback.elapsed);
    const phase =
      playback.action === 'bath'
        ? { open: 'prepare', loop: 'soap', close: 'rinse' }[sample.phase]
        : sample.phase;
    if (!phase || (this.careObservation?.playback === playback && this.careObservation.phase === phase))
      return;
    this.careObservation = { playback, phase };
    this.emit('carephase', {
      action: playback.action,
      phase,
      frame: sample.frame,
      elapsed: playback.elapsed,
    });
  }

  serialize(operation) {
    const task = this.chain.then(async () => {
      await this.ready;
      this.ensureAlive();
      const loaded = await this.store.load();
      this.ensureAlive();
      if (loaded === null || loaded.revision < this.state.revision)
        throw new StorageConflictError('Saved progress was removed or rolled back; reload the companion');
      const latest = validateState(loaded, timestamp(this.clock()), this.config);
      if (latest.revision !== this.state.revision) {
        this.state = latest;
        this.syncSize();
        this.emit('change', this.snapshot());
      }
      return operation();
    });
    this.chain = task.catch(() => {});
    return task;
  }

  async commit(next) {
    const value = { ...copy(next), revision: (this.state ? this.state.revision : next.revision) + 1 };
    if (!Number.isSafeInteger(value.revision))
      throw new RangeError('Storage revision exceeds safe integer range');
    // Persistence precedes both visible rewards and in-memory publication. Storage errors are not swallowed.
    await this.store.save(value, { expectedRevision: this.state ? this.state.revision : next.revision });
    this.state = value;
    if (!this.destroyed) this.emit('change', this.snapshot());
  }

  currentState() {
    return advanceState(this.state, timestamp(this.clock()), this.config);
  }

  snapshot() {
    return {
      mode: this.mode,
      muted: this.muted,
      locale: this.locale,
      state: this.state ? copy(this.state) : null,
      targetHeight: this.state ? growthHeight(this.state.growthPoints, this.config) : this.config.minHeight,
      request: this.request ? { ...this.request } : null,
      bath:
        this.state && this.state.bath
          ? {
              ...copy(this.state.bath),
              coverage: this.bathCoverage(),
            }
          : null,
      foregroundMs: this.foregroundMs,
      eyeBreakPending: this.eyeBreakPending,
      careKind: this.careKind,
      bathClosing: this.bathClosing,
    };
  }

  exportState() {
    if (!this.state) throw new Error('Await companion.ready first');
    return copy(this.state);
  }

  syncSize() {
    if (!this.state || this.engine.destroyed || this.engine.current) return;
    const height =
      growthHeight(this.state.growthPoints, this.config) * (this.mode === 'care' ? this.careZoom : 1);
    const scale = height / this.engine.baseSize;
    if (Math.abs(this.engine.scale - scale) > 0.0001) this.engine.setScale(scale);
  }

  setMode(mode) {
    this.ensureAlive();
    if (!MODES.includes(mode)) throw new TypeError('Unknown companion mode: ' + mode);
    if (this.mode === mode) return this;
    if (mode === 'hidden') {
      this.resumeMode =
        this.mode === 'care' && (this.careKind !== 'bath' || !this.state?.bath) ? 'home' : this.mode;
      this.resumeCareKind = this.careKind;
    } else if (mode === 'care' && this.mode === 'hidden') {
      this.careKind = this.resumeCareKind;
    }
    if (this.mode === 'rest' && mode !== 'hidden') {
      this.foregroundMs = 0;
      this.eyeBreakPending = false;
    }
    this.mode = mode;
    if (mode !== 'care') {
      this.petting = null;
      this.careKind = null;
      this.bathClosing = false;
    }
    this.homeMs = 0;
    this.lastFrameTime = null;
    this.interrupt();
    this.request = null;
    if (this.state) {
      this.applyMode();
      this.syncSize();
    }
    this.emit('mode', this.snapshot());
    return this;
  }

  applyMode() {
    this.engine.stopFree({ cancel: true });
    this.engine.options.interactionLocked = this.mode === 'care';
    this.engine.setVisible(this.mode !== 'hidden');
    this.syncSize();
    if (this.mode === 'home') this.startIdle();
    else if (this.mode === 'rest' && this.engine.actions.has('sleep'))
      this.engine.play('sleep', { sustain: true });
    else if (this.mode === 'care' && this.careKind === 'bath' && this.state.bath) {
      this.careKind = 'bath';
      this.startBathPose();
    }
  }

  startIdle() {
    if (this.mode !== 'home' || this.feedbackBusy || this.destroyed || this.engine.pointer) return;
    const actions = (
      this.options.freeActions || [
        'blink',
        'curious',
        'nod',
        'lookAround',
        'preen',
        'standOneFoot',
        'stretch',
        'walk',
      ]
    ).filter((id) => this.engine.actions.has(id) && this.engine.actions.get(id).enabled !== false);
    if (actions.length)
      this.engine.startFree({
        actions,
        minDelay: 6000,
        maxDelay: 12000,
        avoidRepeat: true,
        weights: { blink: 3, curious: 2, lookAround: 3, preen: 2, walk: 1, ...this.options.freeWeights },
      });
  }

  interrupt() {
    this.generation++;
    this.nextFeedback = null;
    this.feedbackBusy = false;
    if (this.activeVoice) {
      this.activeVoice.handle.cancel();
      this.activeVoice = null;
    }
    if (!this.engine.destroyed) this.engine.stopFree({ cancel: true });
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.muted && this.engine.speech) this.engine.stop();
    if (this.muted && this.activeVoice) this.activeVoice.handle.cancel();
    this.emit('change', this.snapshot());
    return this;
  }

  setLocale(locale) {
    if (!['zh-CN', 'en'].includes(locale)) throw new TypeError('Supported locales are zh-CN and en');
    this.locale = locale;
    return this;
  }

  say(id, fields = {}) {
    const entry = (this.options.dialogue || {})[id] || COMPANION_DIALOGUE[id];
    if (!entry) throw new Error('Unknown dialogue: ' + id);
    const text = (this.locale === 'en' ? entry.en || entry.text : entry.text).replace(
      '{topic}',
      String(fields.topic || (this.locale === 'en' ? 'something new' : '新本领')).slice(0, 80)
    );
    const audio =
      this.options.audioCatalog &&
      this.options.audioCatalog[this.locale] &&
      this.options.audioCatalog[this.locale][id];
    this.emit('dialogue', { id, text, locale: this.locale, audio: audio || null });
    return { text, audio, gesture: entry.gesture };
  }

  enqueueFeedback(id, fields = {}) {
    if (this.destroyed || ['hidden', 'rest', 'care'].includes(this.mode)) return;
    // One in flight and one merged reward, never an unbounded backlog after repeated events.
    this.nextFeedback = { id, fields };
    this.drainFeedback();
  }

  async drainFeedback() {
    if (this.feedbackBusy || !this.nextFeedback || this.destroyed) return;
    const item = this.nextFeedback;
    this.nextFeedback = null;
    this.feedbackBusy = true;
    this.engine.stopFree({ cancel: true });
    const generation = ++this.generation;
    try {
      const message = this.say(item.id, item.fields),
        gesture = this.engine.actions.has(message.gesture) ? message.gesture : 'pet';
      // A reward jump, bath or nod plays once. Only speaking-compatible gestures may sustain during speech.
      const speakingGesture = ['wave', 'talk', 'pointLeft', 'pointRight'].includes(gesture);
      const hasVoice = !this.muted && (message.audio || this.options.voice);
      if ((!hasVoice || !speakingGesture) && this.engine.actions.has(gesture))
        await this.engine.play(gesture).finished;
      if (this.destroyed || generation !== this.generation) return;
      if (hasVoice) {
        const safeGesture = speakingGesture ? gesture : 'talk';
        if (message.audio) await this.engine.speak(message.audio, { gesture: safeGesture });
        else await this.speakText(message.text, safeGesture);
      }
      if (this.destroyed || generation !== this.generation) return;
      const scale = growthHeight(this.state.growthPoints, this.config) / this.engine.baseSize;
      if (Math.abs(scale - this.engine.scale) > 0.0001) await this.engine.growTo(scale).finished;
    } catch (error) {
      this.emit('error', { error, phase: 'feedback' });
    } finally {
      if (!this.destroyed && generation === this.generation) {
        this.feedbackBusy = false;
        this.syncSize();
        if (this.nextFeedback) this.drainFeedback();
        else this.startIdle();
      }
    }
  }

  async speakText(text, gesture = 'talk') {
    const playback = this.engine.play(gesture, { sustain: true });
    const ready = await playback.ready;
    if (ready.status !== 'ready' || this.destroyed || this.engine.current !== playback) return ready;
    let handle;
    try {
      handle = this.options.voice.play({ text, locale: this.locale });
    } catch (error) {
      playback.cancel();
      throw error;
    }
    if (
      !handle ||
      !handle.finished ||
      ['cancel', 'pause', 'resume'].some((key) => typeof handle[key] !== 'function')
    ) {
      playback.cancel();
      throw new TypeError('Voice must return a finished promise and cancel/pause/resume methods');
    }
    const active = { handle, elapsed: 0 };
    this.activeVoice = active;
    this.engine.setSpeaking(true);
    const off = this.engine.on('cancel', ({ action }) => {
      if (this.activeVoice === active && action === playback.action) handle.cancel();
    });
    try {
      const result = await handle.finished;
      if (this.activeVoice === active) {
        this.activeVoice = null;
        this.engine.setSpeaking(false);
        playback.release();
      }
      await playback.finished;
      return result;
    } catch (error) {
      handle.cancel();
      playback.cancel();
      throw error;
    } finally {
      off();
      if (this.activeVoice === active) {
        this.activeVoice = null;
        this.engine.setSpeaking(false);
      }
    }
  }

  handleEvent(event) {
    return this.serialize(async () => {
      if (!event || !REWARDS.includes(event.type)) throw new TypeError('Expected a confirmed learning event');
      identifier(event.id);
      const points =
        event.confirmedGrowthPoints === undefined
          ? event.type === 'knowledgeMastered'
            ? 3
            : 1
          : event.confirmedGrowthPoints;
      if (!Number.isSafeInteger(points) || points < 0 || points > 1000)
        throw new RangeError('Growth increment must be 0–1000');
      if (!Number.isSafeInteger(event.revision) || event.revision < 1)
        throw new TypeError('Event revision must be a positive integer');
      if (this.state.recentEvents.includes(event.id) || event.revision <= this.state.eventRevision)
        return { status: 'duplicate' };
      const next = this.currentState();
      if (!Number.isSafeInteger(next.growthPoints + points))
        throw new RangeError('Growth total exceeds safe integer range');
      next.growthPoints += points;
      next.eventRevision = event.revision;
      next.recentEvents = remember(next.recentEvents, event.id, this.config.historyLimit);
      await this.commit(next);
      this.enqueueFeedback(event.type, { topic: event.displayName });
      if (event.type === 'gameCompleted') this.requestEyeBreak();
      return {
        status: 'accepted',
        growthPoints: this.state.growthPoints,
        targetHeight: growthHeight(this.state.growthPoints, this.config),
      };
    });
  }

  welcome(sessionId) {
    return this.serialize(async () => {
      identifier(sessionId);
      if (this.state.welcomedSession === sessionId) return { status: 'duplicate' };
      const next = this.currentState();
      next.welcomedSession = sessionId;
      await this.commit(next);
      this.enqueueFeedback('welcome');
      return { status: 'accepted' };
    });
  }

  tick(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0)
      throw new TypeError('Tick must be non-negative milliseconds');
    if (!this.state || this.destroyed || this.mode === 'hidden' || !this.engine.visible || this.engine.paused)
      return;
    if (this.mode !== 'rest') this.foregroundMs += milliseconds;
    if (this.activeVoice) {
      this.activeVoice.elapsed += milliseconds;
      if (this.activeVoice.elapsed >= 30000) this.activeVoice.handle.cancel();
    }
    if (this.foregroundMs >= this.config.eyeBreakMs) this.eyeBreakPending = true;
    if (this.mode === 'home') this.homeMs += milliseconds;
    this.pollMs += milliseconds;
    if (this.pollMs >= 30000) {
      this.pollMs = 0;
      this.refreshNeeds().catch((error) => this.emit('error', { error, phase: 'needs' }));
    }
  }

  requestEyeBreak() {
    if (!this.eyeBreakPending || ['hidden', 'rest', 'care'].includes(this.mode) || this.request) return false;
    this.request = { type: 'eyeBreak', createdAt: timestamp(this.clock()) };
    this.emit('request', { ...this.request, ...this.say('eyeBreak') });
    return true;
  }

  refreshNeeds() {
    return this.serialize(async () => {
      const next = this.currentState(),
        now = timestamp(this.clock());
      if (
        this.mode === 'home' &&
        this.homeMs >= this.config.requestDelayMs &&
        !this.request &&
        !this.feedbackBusy &&
        !this.engine.pointer &&
        now - next.lastRequestAt >= this.config.requestCooldownMs
      ) {
        const type = this.eyeBreakPending
          ? 'eyeBreak'
          : next.satiation < this.config.requestBelow
            ? 'hungry'
            : next.cleanliness < this.config.requestBelow
              ? 'dirty'
              : ['scratch', 'pet', 'teach'][next.requestCursor++ % 3];
        next.lastRequestAt = now;
        await this.commit(next);
        this.request = { type, createdAt: now };
        this.emit('request', { ...this.request, ...this.say(type) });
      } else await this.commit(next);
      return this.snapshot();
    });
  }

  dismissRequest() {
    this.request = null;
    this.emit('change', this.snapshot());
    return this;
  }

  async respondToRequest() {
    await this.ready;
    this.ensureAlive();
    const request = this.request;
    this.dismissRequest();
    if (!request) return { status: 'ignored' };
    if (request.type === 'eyeBreak') {
      this.setMode('rest');
      return { status: 'accepted' };
    }
    if (['hungry', 'dirty', 'teach'].includes(request.type)) {
      this.emit('intent', {
        type: request.type === 'hungry' ? 'feed' : request.type === 'dirty' ? 'bath' : 'learn',
      });
      return { status: 'accepted' };
    }
    return this.playAction(request.type === 'scratch' ? 'scratch' : 'pet');
  }

  interact(event) {
    if (this.destroyed || !this.state || this.options.interaction === 'legacy') return;
    if (event.type === 'down' || event.type === 'dragstart') this.interrupt();
    if (event.type === 'dragend') {
      this.syncSize();
      this.startIdle();
    }
    if (!['tap', 'doubletap'].includes(event.type) || ['care', 'hidden'].includes(this.mode)) return;
    if (this.mode === 'rest') this.setMode('home');
    const choices = (event.type === 'doubletap' ? ['kiss', 'jump', 'wink'] : ['pet', 'nod', 'wink']).filter(
      (id) => this.engine.actions.has(id) && id !== this.lastAction
    );
    const id = choices[Math.min(choices.length - 1, Math.max(0, Math.floor(this.random() * choices.length)))];
    if (id) this.playAction(id).catch((error) => this.emit('error', { error, phase: 'interaction' }));
  }

  async playAction(id, options = {}) {
    await this.ready;
    this.ensureAlive();
    if (this.mode === 'hidden') return { status: 'cancelled', reason: 'hidden' };
    this.interrupt();
    this.feedbackBusy = true;
    this.lastAction = id;
    const generation = this.generation;
    try {
      return await this.engine.play(id, options).finished;
    } finally {
      if (!this.destroyed && generation === this.generation) {
        this.feedbackBusy = false;
        this.syncSize();
        this.startIdle();
      }
    }
  }

  async sing(track) {
    await this.ready;
    this.ensureAlive();
    if (!track || typeof track.audioURL !== 'string' || !track.audioURL)
      throw new TypeError('A song audioURL is required');
    if (this.mode !== 'home' || this.muted) return { status: 'cancelled', reason: 'mode-or-muted' };
    this.interrupt();
    this.feedbackBusy = true;
    const generation = this.generation;
    this.emit('dialogue', { id: 'song', text: track.title || '', locale: track.locale || this.locale });
    try {
      return await this.engine.speak(track.audioURL, {
        gesture: track.gesture || 'talk',
        timeout: track.timeout || 180000,
      });
    } finally {
      if (!this.destroyed && generation === this.generation) {
        this.feedbackBusy = false;
        this.startIdle();
      }
    }
  }

  async pace({ distance = this.engine.size * 1.5 } = {}) {
    await this.ready;
    this.ensureAlive();
    positive(distance, 'Pacing distance');
    if (this.mode !== 'home') return { status: 'cancelled', reason: 'mode' };
    this.interrupt();
    this.feedbackBusy = true;
    const generation = this.generation,
      from = { ...this.engine.position };
    try {
      for (const x of [from.x - distance / 2, from.x + distance / 2, from.x]) {
        const to = this.engine.constrain({ x, y: from.y });
        if (Math.abs(to.x - this.engine.position.x) < 1) continue;
        const result = await this.engine.moveTo(to, { mode: 'walk' }).finished;
        if (result.status !== 'finished' || generation !== this.generation || this.destroyed) return result;
      }
      return { status: 'finished', action: 'pace' };
    } finally {
      if (!this.destroyed && generation === this.generation) {
        this.feedbackBusy = false;
        this.startIdle();
      }
    }
  }

  feed(...args) {
    return this.care.feed(...args);
  }
  beginCare(...args) {
    return this.care.beginCare(...args);
  }
  finishCare(...args) {
    return this.care.finishCare(...args);
  }
  recoverCare(...args) {
    return this.care.recoverCare(...args);
  }
  beginBath(...args) {
    return this.care.beginBath(...args);
  }
  bathCoverage(...args) {
    return this.care.bathCoverage(...args);
  }
  startBathPose(...args) {
    return this.care.startBathPose(...args);
  }
  closeBathPose(...args) {
    return this.care.closeBathPose(...args);
  }
  wash(...args) {
    return this.care.wash(...args);
  }
  rinse(...args) {
    return this.care.rinse(...args);
  }
  cancelBath(...args) {
    return this.care.cancelBath(...args);
  }
  beginPetting(...args) {
    return this.care.beginPetting(...args);
  }
  stroke(...args) {
    return this.care.stroke(...args);
  }
  endPetting(...args) {
    return this.care.endPetting(...args);
  }

  destroy() {
    if (this.destroyed) return;
    this.interrupt();
    this.destroyed = true;
    for (const off of this.off) off();
    this.off = [];
    this.engine.options.interactionMode = this.oldInteractionMode;
    this.engine.options.interactionLocked = this.oldInteractionLock;
    this.emit('destroy', {});
    this.removeAllListeners();
  }
}

module.exports = { PetCompanion };
