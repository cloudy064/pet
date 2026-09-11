'use strict';
const { EventEmitter } = require('./events');
const { identifier, copy, freeze, positive, validatePlaybackOptions } = require('./utils');

class ActionRegistry extends EventEmitter {
  constructor(actions = []) {
    super();
    this.actions = new Map();
    this.validators = new Map();
    this.version = 0;
    this.addType('clip', (action) => {
      identifier(action.asset, 'Asset');
      if (
        action.frames !== undefined &&
        (!Array.isArray(action.frames) ||
          !action.frames.length ||
          action.frames.some((n) => !Number.isInteger(n) || n < 0))
      )
        throw new TypeError('frames must be non-negative frame indices');
      if (
        action.durations !== undefined &&
        (!Array.isArray(action.durations) ||
          !action.durations.length ||
          action.durations.some((t) => !Number.isFinite(t) || t <= 0))
      )
        throw new TypeError('durations must contain positive milliseconds');
      if (action.frames && action.durations && action.frames.length !== action.durations.length)
        throw new TypeError('frames and durations must have equal lengths');
      if (
        action.loop !== undefined &&
        typeof action.loop !== 'boolean' &&
        (!Number.isInteger(action.loop) || action.loop < 1)
      )
        throw new TypeError('loop must be a boolean or a positive cycle count');
    });
    for (const type of ['wave', 'point', 'walk', 'flight', 'grow'])
      this.addType(type, (action) => {
        if (['wave', 'point'].includes(type)) identifier(action.asset, 'Asset');
        if (action.asset !== undefined) identifier(action.asset, 'Asset');
        if (type === 'point' && action.side !== undefined && !['left', 'right'].includes(action.side))
          throw new TypeError('Point side must be left or right');
        for (const field of ['stride', 'duration'])
          if (action[field] !== undefined) positive(action[field], field);
      });
    this.addType('sequence', (action) => {
      if (!Array.isArray(action.steps) || !action.steps.length)
        throw new TypeError('Sequence requires steps');
      for (const step of action.steps) {
        identifier(step.action, 'Step action');
        if (step.options !== undefined) validatePlaybackOptions(step.options);
        if (
          step.repeat !== undefined &&
          (!Number.isInteger(step.repeat) || step.repeat < 1 || step.repeat > 100)
        )
          throw new TypeError('Step repeat must be 1–100');
      }
    });
    if (actions.length) this.import({ version: 1, actions });
  }
  addType(type, validate) {
    identifier(type, 'Action type');
    if (typeof validate !== 'function') throw new TypeError('Action validator required');
    this.validators.set(type, validate);
    return this;
  }
  validate(definition) {
    const action = copy(definition);
    identifier(action.id, 'Action id');
    identifier(action.type, 'Action type');
    if (!this.validators.has(action.type)) throw new TypeError('Unknown action type: ' + action.type);
    if (action.label !== undefined && typeof action.label !== 'string')
      throw new TypeError('Action label must be text');
    if (action.speed !== undefined) positive(action.speed, 'Action speed');
    if (action.enabled !== undefined && typeof action.enabled !== 'boolean')
      throw new TypeError('enabled must be boolean');
    this.validators.get(action.type)(action);
    if (action.asset && this.assetResolver) {
      const asset = this.assetResolver(action.asset);
      if (action.type === 'wave' && asset.frameMap.length < 61)
        throw new RangeError('Wave requires 61 frames');
      if (action.type === 'point' && asset.frameMap.length < 19)
        throw new RangeError('Point requires 19 frames');
      if (action.frames && action.frames.some((n) => n >= asset.frameMap.length))
        throw new RangeError('Frame outside asset: ' + action.asset);
      if (action.durations && !action.frames && action.durations.length !== asset.frameMap.length)
        throw new RangeError('Duration count differs from asset frames');
      if (
        action.loopFrames &&
        (!Array.isArray(action.loopFrames) ||
          !action.loopFrames.length ||
          action.loopFrames.some((n) => !Number.isInteger(n) || n < 0 || n >= asset.frameMap.length))
      )
        throw new RangeError('Invalid loop frames');
      if (
        action.loopDurations &&
        (!Array.isArray(action.loopDurations) ||
          !action.loopFrames ||
          action.loopDurations.length !== action.loopFrames.length ||
          action.loopDurations.some((n) => !Number.isFinite(n) || n <= 0))
      )
        throw new RangeError('Invalid loop durations');
    }
    if (action.holdMs !== undefined && (!Number.isFinite(action.holdMs) || action.holdMs < 0))
      throw new RangeError('Hold duration must be non-negative');
    return freeze(action);
  }
  checkReferences(actions) {
    const visit = (id, stack) => {
      if (stack.has(id)) throw new TypeError('Cyclic action sequence: ' + id);
      const action = actions.get(id);
      if (!action) throw new TypeError('Unknown sequence action: ' + id);
      if (action.type === 'sequence') {
        const next = new Set([...stack, id]);
        for (const step of action.steps) visit(step.action, next);
      }
    };
    for (const id of actions.keys()) visit(id, new Set());
  }
  register(definition, { replace = false } = {}) {
    const action = this.validate(definition);
    if (!replace && this.actions.has(action.id)) throw new Error('Action already exists: ' + action.id);
    const next = new Map(this.actions);
    next.set(action.id, action);
    this.checkReferences(next);
    this.actions = next;
    this.version++;
    this.emit('change', { type: replace ? 'update' : 'add', id: action.id, version: this.version });
    return this;
  }
  update(id, patch) {
    const current = this.get(id);
    if (patch.id && patch.id !== id) throw new TypeError('Use a new action to change its id');
    return this.register({ ...current, ...copy(patch), id }, { replace: true });
  }
  remove(id) {
    if (!this.actions.has(id)) return false;
    const next = new Map(this.actions);
    next.delete(id);
    this.checkReferences(next);
    this.actions = next;
    this.version++;
    this.emit('change', { type: 'remove', id, version: this.version });
    return true;
  }
  get(id) {
    const action = this.actions.get(id);
    if (!action) throw new Error('Unknown action: ' + id);
    return action;
  }
  has(id) {
    return this.actions.has(id);
  }
  list({ enabledOnly = false } = {}) {
    return [...this.actions.values()].filter((a) => !enabledOnly || a.enabled !== false);
  }
  export() {
    return { version: 1, actions: this.list().map(copy) };
  }
  import(document, { replace = false } = {}) {
    const data = typeof document === 'string' ? JSON.parse(document) : document;
    if (!data || data.version !== 1 || !Array.isArray(data.actions))
      throw new TypeError('Expected action library version 1');
    const next = replace ? new Map() : new Map(this.actions),
      seen = new Set();
    for (const definition of data.actions) {
      const action = this.validate(definition);
      if (seen.has(action.id)) throw new TypeError('Duplicate action id: ' + action.id);
      seen.add(action.id);
      next.set(action.id, action);
    }
    this.checkReferences(next);
    this.actions = next;
    this.version++;
    this.emit('change', { type: 'import', version: this.version });
    return this;
  }
}
module.exports = { ActionRegistry };
