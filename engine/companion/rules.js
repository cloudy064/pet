'use strict';

const { copy, positive, finite } = require('../core/utils');

const DEFAULT_RULES = Object.freeze({
  minHeight: 58,
  maxHeight: 104,
  growthEase: 5,
  growthCap: 320,
  feedCost: 3,
  feedGain: 30,
  bathCost: 0,
  hungerPerHour: 4,
  dirtPerHour: 2,
  maxOfflineHours: 8,
  requestBelow: 35,
  requestCooldownMs: 15 * 60 * 1000,
  requestDelayMs: 30 * 1000,
  eyeBreakMs: 20 * 60 * 1000,
  historyLimit: 256,
});

function rules(input = {}) {
  const value = { ...DEFAULT_RULES, ...input };
  for (const name of [
    'minHeight',
    'maxHeight',
    'growthEase',
    'growthCap',
    'feedGain',
    'requestCooldownMs',
    'requestDelayMs',
    'eyeBreakMs',
    'historyLimit',
  ])
    positive(value[name], name);
  for (const name of [
    'feedCost',
    'bathCost',
    'hungerPerHour',
    'dirtPerHour',
    'maxOfflineHours',
    'requestBelow',
  ]) {
    finite(value[name], name);
    if (value[name] < 0) throw new RangeError(name + ' must be non-negative');
  }
  if (
    value.maxHeight < value.minHeight ||
    value.requestBelow > 100 ||
    value.feedGain > 100 ||
    !Number.isSafeInteger(value.historyLimit) ||
    value.historyLimit > 4096 ||
    !Number.isSafeInteger(value.feedCost) ||
    !Number.isSafeInteger(value.bathCost)
  )
    throw new RangeError('Invalid companion rules');
  return Object.freeze(value);
}

function growthHeight(points, input = {}) {
  finite(points, 'Growth points');
  if (points < 0) throw new RangeError('Growth points must be non-negative');
  const r = rules(input),
    ratio = Math.min(1, Math.log1p(points / r.growthEase) / Math.log1p(r.growthCap / r.growthEase));
  return r.minHeight + (r.maxHeight - r.minHeight) * ratio;
}

function timestamp(value) {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError('Clock must return non-negative milliseconds');
  return value;
}

function freshState(now) {
  return {
    version: 1,
    revision: 0,
    growthPoints: 0,
    satiation: 75,
    cleanliness: 80,
    updatedAt: timestamp(now),
    lastRequestAt: 0,
    requestCursor: 0,
    eventRevision: 0,
    walletRevision: 0,
    recentEvents: [],
    recentCare: [],
    pendingCare: null,
    bath: null,
    welcomedSession: null,
  };
}

function validateState(input, now, config) {
  if (input == null) return freshState(now);
  const state = copy(input);
  if (!state || state.version !== 1) throw new TypeError('Expected companion state version 1');
  for (const key of ['revision', 'eventRevision', 'walletRevision', 'requestCursor', 'growthPoints'])
    if (!Number.isSafeInteger(state[key]) || state[key] < 0) throw new TypeError('Invalid state ' + key);
  for (const key of ['growthPoints', 'updatedAt', 'lastRequestAt']) timestamp(state[key]);
  for (const key of ['satiation', 'cleanliness'])
    if (!Number.isFinite(state[key]) || state[key] < 0 || state[key] > 100)
      throw new TypeError('Invalid state ' + key);
  for (const key of ['recentEvents', 'recentCare']) {
    if (!Array.isArray(state[key]) || state[key].some((id) => typeof id !== 'string'))
      throw new TypeError('Invalid state ' + key);
    state[key] = state[key].slice(-config.historyLimit);
  }
  if (state.pendingCare) validateCare(state.pendingCare);
  if (state.bath) {
    if (
      typeof state.bath.id !== 'string' ||
      !Array.isArray(state.bath.cells) ||
      state.bath.cells.some((n) => !BATH_CELLS.includes(n)) ||
      !['soap', 'rinse'].includes(state.bath.phase)
    )
      throw new TypeError('Invalid saved bath');
    state.bath.cells = [...new Set(state.bath.cells)];
  }
  if (state.welcomedSession !== null && typeof state.welcomedSession !== 'string')
    throw new TypeError('Invalid welcome session');
  return state;
}

function validateCare(operation) {
  if (
    !operation ||
    typeof operation.id !== 'string' ||
    !operation.id ||
    operation.id.length > 160 ||
    !['feed', 'bath'].includes(operation.kind) ||
    !Number.isSafeInteger(operation.cost) ||
    operation.cost < 0 ||
    !Number.isFinite(operation.gain) ||
    operation.gain < 0 ||
    operation.gain > 100
  )
    throw new TypeError('Invalid care operation');
  return operation;
}

function advanceState(state, now, config) {
  timestamp(now);
  // A backward clock never subtracts time twice or creates food. A long absence has a bounded effect.
  const elapsed = Math.max(0, now - state.updatedAt),
    hours = Math.min(config.maxOfflineHours, elapsed / 3600000);
  return {
    ...copy(state),
    satiation: Math.max(0, state.satiation - hours * config.hungerPerHour),
    cleanliness: Math.max(0, state.cleanliness - hours * config.dirtPerHour),
    updatedAt: Math.max(now, state.updatedAt),
  };
}

function remember(list, id, limit) {
  return [...list.filter((value) => value !== id), id].slice(-limit);
}

// Eight by twelve body cells; corners and face are excluded. Points are body-relative in [0, 1].
const BATH_CELLS = Object.freeze(
  Array.from({ length: 96 }, (_, i) => i).filter((i) => {
    const x = ((i % 8) + 0.5) / 8,
      y = (Math.floor(i / 8) + 0.5) / 12;
    return y >= 0.45 && y <= 0.92 && ((x - 0.5) / 0.48) ** 2 + ((y - 0.68) / 0.35) ** 2 <= 1;
  })
);

function washCell(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('Wash coordinates must be finite');
  if (x < 0 || x >= 1 || y < 0 || y >= 1) return null;
  const cell = Math.floor(y * 12) * 8 + Math.floor(x * 8);
  return BATH_CELLS.includes(cell) ? cell : null;
}

module.exports = {
  DEFAULT_RULES,
  rules,
  growthHeight,
  timestamp,
  freshState,
  validateState,
  validateCare,
  advanceState,
  remember,
  BATH_CELLS,
  washCell,
};
