const test = require('node:test');
const assert = require('node:assert/strict');
const { WebAdapter } = require('../../engine/adapters/web');
function adapter(fetch) {
  class Image {
    set src(value) {
      this.value = value;
      this.complete = true;
      this.naturalWidth = 2;
      queueMicrotask(() => this.onload?.());
    }
    removeAttribute() {}
  }
  return new WebAdapter(
    { getContext() {} },
    { window: { Image, AbortController, URL, Blob, fetch }, imageStallTimeoutMs: 20, imageTimeoutMs: 500 }
  );
}
function stalled(signal) {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        signal.addEventListener(
          'abort',
          () => controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          { once: true }
        );
      },
    })
  );
}
const page = { url: 'http://example.test/jump.webp', bytes: 4, md5: 'a'.repeat(32) };
test('stalled partial body is aborted and retried with a fresh request, automatically', async () => {
  const requests = [],
    progress = [],
    retries = [];
  const a = adapter(async (url, options) => {
    requests.push({ url, ...options });
    return requests.length === 1 ? stalled(options.signal) : new Response(new Uint8Array([1, 2, 3, 4]));
  });
  const image = await a.loadImage(page, '', {
    onProgress: (e) => progress.push(e),
    onRetry: (e) => retries.push(e),
  });
  assert.equal(image.naturalWidth, 2);
  assert.equal(requests.length, 2);
  assert.equal(retries.length, 1);
  assert(requests[0].signal.aborted);
  assert(requests[1].url.includes('_pipiRetry='));
  assert.equal(requests[1].cache, 'reload');
  assert(progress.some((p) => p.phase === 'failed' && p.loaded === 2));
  assert(progress.some((p) => p.phase === 'ready' && p.loaded === 4));
});
test('continuing byte progress resets the stall timeout', async () => {
  let requests = 0;
  const a = adapter(async () => {
    requests++;
    return new Response(
      new ReadableStream({
        start(c) {
          let count = 0;
          const timer = setInterval(() => {
            c.enqueue(new Uint8Array([1]));
            if (++count === 8) {
              clearInterval(timer);
              c.close();
            }
          }, 8);
        },
      })
    );
  });
  await a.loadImage({ ...page, bytes: 8 });
  assert.equal(requests, 1);
});
test('cancelling a streamed download aborts immediately without retrying', async () => {
  const controller = new AbortController();
  let requests = 0,
    requestSignal;
  const a = adapter(async (url, { signal }) => {
    requests++;
    requestSignal = signal;
    return stalled(signal);
  });
  const loading = a.loadImage(page, '', { signal: controller.signal });
  setTimeout(() => controller.abort(), 5);
  await assert.rejects(loading, { name: 'AbortError' });
  assert(requestSignal.aborted);
  assert.equal(requests, 1);
});

test('small trickles cannot keep a stalled transfer alive indefinitely', async () => {
  const requests = [],
    retries = [];
  const a = adapter(async (url, { signal }) => {
    requests.push(url);
    if (requests.length > 1) return new Response(new Uint8Array(32000));
    return new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(new Uint8Array(24000));
          const timer = setInterval(() => c.enqueue(new Uint8Array(1)), 4);
          signal.addEventListener(
            'abort',
            () => {
              clearInterval(timer);
              c.error(Object.assign(new Error('aborted'), { name: 'AbortError' }));
            },
            { once: true }
          );
        },
      })
    );
  });
  a.imageStallTimeoutMs = 200;
  a.imageSlowTimeoutMs = 25;
  await a.loadImage({ ...page, bytes: 32000 }, '', { onRetry: (e) => retries.push(e) });
  assert.equal(requests.length, 2);
  assert.match(retries[0].error.message, /传输过慢/);
});

test('predownload caches compressed bytes without decoding; offline load uses a blob URL', async () => {
  let requests = 0,
    decoded = 0;
  const a = adapter(async () => {
    if (++requests > 1) throw Error('offline');
    return new Response(new Uint8Array(4));
  });
  const native = a.loadImageAttempt.bind(a);
  a.loadImageAttempt = (p, signal) => {
    decoded++;
    assert.match(p.url, /^blob:/);
    return native(p, signal);
  };
  await a.prefetchImage(page);
  assert.equal(decoded, 0);
  assert.equal(a.downloadStats().bytes, 4);
  a.releaseImage(await a.loadImage(page));
  await a.loadImage(page);
  assert.equal(decoded, 2);
  assert.equal(requests, 1);
  await a.clearCache();
  assert.equal(a.downloadStats().bytes, 0);
});

test('cancelling predownload leaves a shared playback download alive', async () => {
  let finish,
    requests = 0;
  const a = adapter(async () => {
    requests++;
    return new Response(
      new ReadableStream({
        start(c) {
          finish = () => {
            c.enqueue(new Uint8Array(4));
            c.close();
          };
        },
      })
    );
  });
  const controller = new AbortController();
  const background = a.prefetchImage(page, { signal: controller.signal });
  const playback = a.loadImage(page);
  controller.abort();
  await assert.rejects(background, { name: 'AbortError' });
  finish();
  await playback;
  assert.equal(requests, 1);
  assert.equal(a.downloadStats().pages, 1);
});

test('incomplete files are never cached, versions are isolated, and compressed cache is bounded', async () => {
  let valid = false,
    requests = 0;
  const a = adapter(async () => {
    requests++;
    return new Response(new Uint8Array(valid ? 4 : 2));
  });
  await assert.rejects(a.prefetchImage(page), /incomplete/);
  assert.equal(a.downloadStats().pages, 0);
  valid = true;
  a.downloadBudget = 4;
  await a.prefetchImage(page);
  await a.prefetchImage({ ...page, md5: 'b'.repeat(32) });
  assert.equal(a.downloadStats().bytes, 4);
  assert.equal(a.downloadStats().pages, 1);
  assert.equal(requests, 4);
});
