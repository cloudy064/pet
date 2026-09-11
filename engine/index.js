'use strict';
const { PipiEngine } = require('./core/engine');
const { WebAdapter } = require('./adapters/web');
const { WechatAdapter } = require('./adapters/wechat');
const { ActionRegistry } = require('./core/registry');
const { AssetManager, validateAsset } = require('./core/assets');
const { CanvasRenderer } = require('./core/renderer');
const { AnimationPlan, Timeline, SustainPlan, CombinedPlan } = require('./core/timeline');
const { PlanFactory, GrowPlan, MotionPlan } = require('./core/plans');
const { Playback } = require('./core/playback');
const { DIRECTIONS } = require('./core/utils');
const {
  DEFAULT_ACTIONS,
  DEFAULT_ASSET_BASE,
  DEFAULT_AUDIO_BASE,
  installPipiAssets,
} = require('./presets/pipi');
const { createWechatComponent } = require('./wechat-component');
function createWebPet(canvas, options = {}) {
  return new PipiEngine({ ...options, adapter: new WebAdapter(canvas, options.web) });
}
function createWechatPet(canvas, wxApi, options = {}) {
  return new PipiEngine({ ...options, adapter: new WechatAdapter(canvas, wxApi) });
}
module.exports = {
  PipiEngine,
  WebAdapter,
  WechatAdapter,
  ActionRegistry,
  AssetManager,
  CanvasRenderer,
  AnimationPlan,
  Timeline,
  SustainPlan,
  CombinedPlan,
  PlanFactory,
  GrowPlan,
  MotionPlan,
  Playback,
  DIRECTIONS,
  DEFAULT_ACTIONS,
  DEFAULT_ASSET_BASE,
  DEFAULT_AUDIO_BASE,
  installPipiAssets,
  validateAsset,
  createWebPet,
  createWechatPet,
  createWechatComponent,
};
