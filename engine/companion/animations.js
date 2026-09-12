'use strict';
const { SustainPlan, Timeline } = require('../core/timeline');
const { positive } = require('../core/utils');

function validateStages(action, resolveAsset) {
  if (!action.asset || !action.stages) throw new TypeError('Staged animation requires an asset and stages');
  for (const name of ['open', 'loop', 'close']) {
    const frames = action.stages[name];
    if (
      !Array.isArray(frames) ||
      !frames.length ||
      frames.length > 4096 ||
      frames.some((n) => !Number.isInteger(n) || n < 0)
    )
      throw new TypeError('Invalid ' + name + ' frames');
    if (resolveAsset && frames.some((n) => n >= resolveAsset(action.asset).frameMap.length))
      throw new RangeError('Stage outside asset: ' + action.id);
  }
  if (action.holdMs !== undefined && (!Number.isFinite(action.holdMs) || action.holdMs < 0))
    throw new RangeError('Hold duration must be non-negative');
}

function installCompanionAnimations(engine, manifest, { baseURL = 'assets/companion' } = {}) {
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.actions))
    throw new TypeError('Companion manifest requires version, assets and actions');
  const validateClip = engine.actions.validators.get('clip');
  engine.registerType('companionClip', {
    validate(action, resolveAsset) {
      validateClip(action, resolveAsset);
      if (!Array.isArray(action.overlays) || !action.overlays.length || action.overlays.length > 8)
        throw new TypeError('Companion clip requires overlay assets');
      for (const id of action.overlays) {
        if (typeof id !== 'string' || !id) throw new TypeError('Invalid overlay asset');
        if (resolveAsset && resolveAsset(id).frameMap.length !== resolveAsset(action.asset).frameMap.length)
          throw new RangeError('Overlay frames must match the body');
      }
      if (
        action.cues !== undefined &&
        (!Array.isArray(action.cues) ||
          action.cues.some(
            (cue) =>
              !cue ||
              typeof cue.name !== 'string' ||
              !cue.name ||
              !Number.isInteger(cue.frame) ||
              cue.frame < 0 ||
              (resolveAsset && cue.frame >= resolveAsset(action.asset).frameMap.length)
          ))
      )
        throw new TypeError('Invalid animation cue');
    },
    create(action, options, context) {
      const loop = options.loop === undefined ? action.loop : options.loop;
      const plan = new Timeline(
        [
          {
            asset: action.asset,
            frames: action.frames,
            durations: action.durations,
            repeat: loop === true || options.sustain ? Infinity : loop || 1,
          },
        ],
        context.assets
      );
      const overlays = options.effects === false ? [] : action.overlays;
      plan.assetIds.push(...overlays);
      const sample = plan.sample.bind(plan);
      plan.sample = (elapsed) => {
        const result = sample(elapsed);
        const cues = (action.cues || []).filter((item) => item.frame <= result.frame);
        const cue = cues[cues.length - 1];
        return {
          ...result,
          phase: cue?.name,
          layers: [...result.layers, ...overlays.map((asset) => ({ asset, frame: result.frame }))],
        };
      };
      return plan;
    },
  });
  engine.registerType('staged', {
    validate: validateStages,
    create(action, options, context) {
      const segment = (name) => ({ asset: action.asset, frames: action.stages[name] });
      return new SustainPlan(
        {
          open: segment('open'),
          loop: segment('loop'),
          close: segment('close'),
          holdMs: options.holdMs === undefined ? action.holdMs || 1000 : options.holdMs,
          sustain: !!options.sustain,
        },
        context.assets
      );
    },
  });
  // Validate using a disposable manager/library so a malformed pack does not partially install.
  const { AssetManager } = require('../core/assets'),
    { ActionRegistry } = require('../core/registry');
  const temporary = new AssetManager(engine.adapter);
  try {
    temporary.import(manifest, { baseURL });
    const library = new ActionRegistry();
    library.validators = new Map(engine.actions.validators);
    library.assetResolver = (id) => (temporary.has(id) ? temporary.get(id) : engine.assets.get(id));
    for (const action of manifest.actions) {
      library.validate(action);
      const asset = temporary.get(action.asset);
      if (action.type === 'staged')
        for (const frames of Object.values(action.stages))
          if (frames.some((n) => n >= asset.frameMap.length))
            throw new RangeError('Stage outside asset: ' + action.id);
      if (action.duration !== undefined) positive(action.duration, 'Action duration');
    }
    library.import(
      {
        version: 1,
        actions: [
          ...engine.actions.list().filter((a) => !manifest.actions.some((b) => b.id === a.id)),
          ...manifest.actions,
        ],
      },
      { replace: true }
    );
    engine.assets.import(manifest, { baseURL });
    engine.actions.import(library.export(), { replace: true });
  } finally {
    temporary.dispose();
  }
  return engine;
}

module.exports = { installCompanionAnimations };
