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
    const t = asset.definition.tiles[tileIndex];
    const sampling = asset.definition.tileSampling?.[tileIndex];
    const placement = asset.definition.tileRects?.[tileIndex];
    const snap = (value) => (Math.abs(value - Math.round(value)) < 1e-7 ? Math.round(value) : value);
    const destination = sampling
      ? [
          snap(((placement.x - sampling.rect.x) / sampling.rect.w) * sampling.width),
          snap(((placement.y - sampling.rect.y) / sampling.rect.h) * sampling.height),
          snap((placement.w / sampling.rect.w) * sampling.width),
          snap((placement.h / sampling.rect.h) * sampling.height),
        ]
      : [0, 0, t[3], t[4]];
    const pageKey = asset.pageHandles?.[t[0]]?.key || asset.key;
    const key =
      pageKey +
      '/' +
      t.join(',') +
      (sampling ? '/' + [sampling.width, sampling.height, ...destination].join(',') : '');
    if (this.tiles.has(key)) {
      const item = this.tiles.get(key);
      this.tiles.delete(key);
      this.tiles.set(key, item);
      return item;
    }
    const canvas =
      this.adapter.createCanvas &&
      this.adapter.createCanvas((sampling?.width || t[3]) + 2, (sampling?.height || t[4]) + 2);
    if (!canvas) return { image: asset.images[t[0]], x: t[1], y: t[2], tight: true };
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      asset.images[t[0]],
      t[1],
      t[2],
      t[3],
      t[4],
      1 + destination[0],
      1 + destination[1],
      destination[2],
      destination[3]
    );
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
      const source = this.isolate(asset, m.frameMap[frame]);
      const sampling = !source.tight && m.tileSampling?.[m.frameMap[frame]];
      const placement = sampling ? sampling.rect : m.tileRects ? m.tileRects[m.frameMap[frame]] : c;
      const pixelWidth = sampling ? sampling.width : t[3],
        pixelHeight = sampling ? sampling.height : t[4];
      const requested = region || (sampling ? sampling.rect : c);
      const left = Math.max(requested.x, placement.x),
        top = Math.max(requested.y, placement.y);
      const right = Math.min(requested.x + requested.w, placement.x + placement.w);
      const bottom = Math.min(requested.y + requested.h, placement.y + placement.h);
      const x = state.x + (left - m.anchor.x) * z;
      const y = state.y - (state.altitude || 0) + (top - m.anchor.y) * z;
      // A sparse patch must also erase pixels that disappeared after transparent trimming.
      if (replace)
        ctx.clearRect(
          state.x + (requested.x - m.anchor.x) * z,
          state.y - (state.altitude || 0) + (requested.y - m.anchor.y) * z,
          requested.w * z,
          requested.h * z
        );
      if (right <= left || bottom <= top) return;
      ctx.drawImage(
        source.image,
        source.x + ((left - placement.x) * pixelWidth) / placement.w,
        source.y + ((top - placement.y) * pixelHeight) / placement.h,
        ((right - left) * pixelWidth) / placement.w,
        ((bottom - top) * pixelHeight) / placement.h,
        x,
        y,
        (right - left) * z,
        (bottom - top) * z
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
