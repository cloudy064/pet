'use strict';
const { PetCompanion } = require('./companion');
const { growthHeight, DEFAULT_RULES, BATH_CELLS } = require('./rules');
const { createMemoryStore, createWebStore, createWechatStore, StorageConflictError } = require('./storage');
const { COMPANION_DIALOGUE, COMPANION_ACTION_LABELS } = require('./catalog');
const { installCompanionAnimations } = require('./animations');
const { createBrowserVoice } = require('./browser-voice');

module.exports = {
  PetCompanion,
  growthHeight,
  DEFAULT_RULES,
  BATH_CELLS,
  createMemoryStore,
  createWebStore,
  createWechatStore,
  StorageConflictError,
  COMPANION_DIALOGUE,
  COMPANION_ACTION_LABELS,
  installCompanionAnimations,
  createBrowserVoice,
};
