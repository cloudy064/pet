const test = require('node:test');
const assert = require('node:assert/strict');
const { WebAdapter } = require('../../engine/adapters/web');

function make(behavior) {
  const images = [];
  class Image {
    constructor() {
      images.push(this);
    }
    set src(value) {
      this.url = value;
      behavior?.(this, images.length);
    }
    removeAttribute() {
      this.removed = true;
    }
  }
  const adapter = new WebAdapter(
    { getContext() {} },
    {
      window: { Image, fetch() {} },
      imageTimeoutMs: 15,
    }
  );
  return { adapter, images };
}
const page = { url: 'http://example.test/sprite.png' };

test('hung images time out, retry once and release both network requests', async () => {
  const { adapter, images } = make();
  const retries = [];
  await assert.rejects(adapter.loadImage(page, '', { onRetry: (r) => retries.push(r.attempt) }), {
    name: 'TimeoutError',
  });
  assert.deepEqual(retries, [2]);
  assert.equal(images.length, 2);
  assert(images.every((image) => image.removed && !image.onload && !image.onerror));
});

test('a timed out image can recover on the automatic retry', async () => {
  const { adapter, images } = make((image, attempt) => {
    if (attempt === 2) queueMicrotask(() => image.onload());
  });
  assert.equal(await adapter.loadImage(page), images[1]);
  assert(images[0].removed);
  assert(!images[1].removed);
});

test('cancellation during retry prevents further work and clears handlers', async () => {
  const controller = new AbortController();
  const { adapter, images } = make((image, attempt) => {
    if (attempt === 1) queueMicrotask(() => image.onerror());
    else queueMicrotask(() => controller.abort());
  });
  await assert.rejects(adapter.loadImage(page, '', { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(images.length, 2);
  assert(images.every((image) => image.removed && !image.onload && !image.onerror));
});

test('completed images do not time out or retry later', async () => {
  const { adapter, images } = make((image) => queueMicrotask(() => image.onload()));
  const image = await adapter.loadImage(page);
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(images.length, 1);
  assert(!image.removed);
});

test('cached image completes even if the load event is not delivered', async () => {
  const { adapter, images } = make((image) => {
    image.complete = true;
    image.naturalWidth = 2;
  });
  assert.equal(await adapter.loadImage(page), images[0]);
  assert.equal(images.length, 1);
});

test('decode completion starts a downloaded image without a load event', async () => {
  const { adapter, images } = make((image) => {
    image.decode = async () => {
      image.complete = true;
      image.naturalWidth = 2;
    };
  });
  assert.equal(await adapter.loadImage(page), images[0]);
  assert.equal(images.length, 1);
});
