'use strict';
const manifest = require('./pipi-manifest.json');
const starter = require('./starter.json');
const { copy } = require('../core/utils');
const DEFAULT_ASSET_BASE = 'https://pipi.aiede.cn/math/assets/pet/ttt-20260911';
const DEFAULT_AUDIO_BASE = 'https://pipi.aiede.cn/math/audio/v1';
const DEFAULT_ACTIONS = [
  { id: 'idle', label: '默认站姿', type: 'clip', asset: 'base:idle', loop: true },
  { id: 'blink', label: '眨眼', type: 'clip', asset: 'base:blink' },
  { id: 'wave', label: '打招呼', type: 'wave', asset: 'base:wave', holdMs: 2200 },
  { id: 'wink', label: '单眼眨眼', type: 'clip', asset: 'base:wink' },
  { id: 'talk', label: '说话', type: 'clip', asset: 'base:talk' },
  { id: 'pet', label: '抚摸反馈', type: 'clip', asset: 'base:pet' },
  { id: 'jump', label: '开心跳跃', type: 'clip', asset: 'base:jump' },
  { id: 'curious', label: '好奇歪头', type: 'clip', asset: 'base:curious' },
  { id: 'pointLeft', label: '画面左翅指字', type: 'point', asset: 'base:wave', side: 'left', holdMs: 1800 },
  {
    id: 'pointRight',
    label: '画面右翅指字',
    type: 'point',
    asset: 'point:right',
    side: 'right',
    holdMs: 1800,
  },
  { id: 'walk', label: '走路', type: 'walk' },
  { id: 'flight', label: '飞行', type: 'flight' },
  { id: 'grow', label: '长大', type: 'grow' },
];
function installPipiAssets(assets, baseURL = DEFAULT_ASSET_BASE) {
  assets.import(manifest, { baseURL });
  for (const [id, definition] of Object.entries(starter)) assets.define(id, definition);
  const hover = assets.get('flight:hover');
  assets.define(
    'flight:up',
    { ...copy(hover), durations: hover.durations.map((_, i) => (i >= 8 && i < 24 ? 18 : 27)) },
    { baseURL }
  );
  assets.define(
    'flight:down',
    { ...copy(hover), durations: hover.durations.map((_, i) => (i === 0 || i === 16 ? 220 : 32)) },
    { baseURL }
  );
}
module.exports = { DEFAULT_ASSET_BASE, DEFAULT_AUDIO_BASE, DEFAULT_ACTIONS, installPipiAssets };
