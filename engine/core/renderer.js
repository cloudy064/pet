'use strict';
class CanvasRenderer {
  constructor(adapter) {
    this.adapter = adapter;
    this.context = adapter.canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.signature = '';
    this.tiles = new Map();
    this.tileBytes = 0;
    this.maxTileBytes = 8 * 1024 * 1024;
  }
  isolate(asset, tileIndex) {
    const key = asset.key + '/' + tileIndex;
    if (this.tiles.has(key)) {
      const item = this.tiles.get(key);
      this.tiles.delete(key);
      this.tiles.set(key, item);
      return item;
    }
    const t = asset.definition.tiles[tileIndex],
      canvas = this.adapter.createCanvas && this.adapter.createCanvas(t[3] + 2, t[4] + 2);
    if (!canvas) return { image: asset.images[t[0]], x: t[1], y: t[2] };
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(asset.images[t[0]], t[1], t[2], t[3], t[4], 1, 1, t[3], t[4]);
    const bytes = canvas.width * canvas.height * 4,
      item = { image: canvas, x: 1, y: 1, bytes };
    this.tiles.set(key, item);
    this.tileBytes += bytes;
    for (const [oldKey, old] of this.tiles) {
      if (this.tileBytes <= this.maxTileBytes || oldKey === key) break;
      this.tiles.delete(oldKey);
      this.tileBytes -= old.bytes;
      old.image.width = old.image.height = 1;
    }
    return item;
  }
  resize(width, height, dpr = 1) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.adapter.resize(width, height, dpr);
    this.signature = '';
  }
  draw(state, assets) {
    const signature = JSON.stringify([
      state.x,
      state.y,
      state.size,
      state.altitude,
      state.layers,
      state.mouth,
      state.openEye,
      [...assets.values()].map((a) => a.key),
    ]);
    if (signature === this.signature) return false;
    this.signature = signature;
    const ctx = this.context,
      dpr = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.adapter.canvas.width, this.adapter.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    const idle = assets.get('base:idle');
    const paint = (asset, frame, region, replace = false) => {
      if (!asset) return;
      const m = asset.definition,
        c = m.crop,
        t = m.tiles[m.frameMap[frame]],
        z = state.size / m.subjectHeight;
      if (!t) return;
      const r = region || c,
        x = state.x + (r.x - m.anchor.x) * z,
        y = state.y - (state.altitude || 0) + (r.y - m.anchor.y) * z;
      if (replace) ctx.clearRect(x, y, r.w * z, r.h * z);
      const source = this.isolate(asset, m.frameMap[frame]);
      ctx.drawImage(
        source.image,
        source.x + ((r.x - c.x) * t[3]) / c.w,
        source.y + ((r.y - c.y) * t[4]) / c.h,
        (r.w * t[3]) / c.w,
        (r.h * t[4]) / c.h,
        x,
        y,
        r.w * z,
        r.h * z
      );
    };
    let painted = false;
    for (const layer of state.layers) {
      let asset = assets.get(layer.asset),
        frame = layer.frame;
      if (!asset) continue;
      if (asset.definition.restFrames.includes(frame) && idle && !layer.region) {
        asset = idle;
        frame = 0;
      }
      if (asset.definition.patch) {
        if (!painted) paint(idle, 0);
        paint(asset, frame, layer.region, true);
      } else paint(asset, frame, layer.region, layer.replace);
      painted = true;
    }
    if (state.openEye && idle) {
      const z = 240 / ((548 * 256) / 362);
      paint(idle, 0, {
        x: 120 + (183 - 288) * z,
        y: 240 + (141 - (620 * 256) / 362) * z,
        w: 97 * z,
        h: 121 * z,
      });
    }
    if (state.mouth && assets.has('base:talk'))
      paint(assets.get('base:talk'), state.mouth.frame, { x: 148, y: 177, w: 95, h: 109 });
    return true;
  }
  clear() {
    this.signature = '';
    for (const item of this.tiles.values()) item.image.width = item.image.height = 1;
    this.tiles.clear();
    this.tileBytes = 0;
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.clearRect(0, 0, this.adapter.canvas.width, this.adapter.canvas.height);
  }
}
module.exports = { CanvasRenderer };
