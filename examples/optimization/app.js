'use strict';
(async () => {
  const $ = (id) => document.getElementById(id);
  const controls = [...document.querySelectorAll('.controls button, .controls select, #scrub')];
  controls.forEach((control) => (control.disabled = true));
  const base = '../../dist/optimized-webp-frames';
  const pet = Pipi.createWebPet($('after'), {
    assetPack: base,
    width: 550,
    height: 550,
    size: 112,
    position: { x: 275, y: 400 },
    autoTick: false,
    autoBlink: false,
    interactive: false,
  });
  let task,
    paused = false,
    ready = false,
    elapsed = 0,
    generation = 0,
    randomMode = false,
    randomBag = [];
  let last = null,
    raf,
    loadingSince = 0,
    retried = false;
  const downloads = new Map();
  pet.assets.on('download', (data) => downloads.set(data.url, data));
  pet.assets.on('retry', () => {
    retried = true;
  });
  let predownloadController,
    predownloadEnabled = true;
  function stopPredownload() {
    predownloadController?.abort();
    predownloadController = null;
  }
  async function startPredownload() {
    if (!predownloadEnabled || document.hidden || pet.destroyed || !ready || predownloadController) return;
    const controller = new AbortController();
    predownloadController = controller;
    $('download-toggle').textContent = '暂停预下载';
    try {
      const actions = [...new Set(['jump', 'wave', 'bath', ...pet.actions.list().map((a) => a.id)])];
      await pet.predownload(actions, {
        signal: controller.signal,
        onProgress: ({ loaded, total, bytes, totalBytes }) => {
          if (controller.signal.aborted) return;
          $('download-progress').textContent =
            `预下载 ${loaded}/${total} 张 · ${(bytes / 1048576).toFixed(2)}/${(totalBytes / 1048576).toFixed(2)} MiB`;
        },
      });
      $('download-progress').textContent += ' · 全部下载完成，切换动作直接读取本地缓存';
      $('download-toggle').textContent = '检查预下载';
    } catch (error) {
      if (error.name !== 'AbortError') {
        $('download-progress').textContent = '预下载中断：' + error.message + '；已完成的图片保留，可重试。';
        $('download-toggle').textContent = '重试预下载';
      }
    } finally {
      if (predownloadController === controller) predownloadController = null;
    }
  }
  $('download-toggle').onclick = () => {
    if (predownloadController) {
      predownloadEnabled = false;
      stopPredownload();
      $('download-toggle').textContent = '继续预下载';
      $('download-progress').textContent += ' · 已暂停';
    } else {
      predownloadEnabled = true;
      startPredownload();
    }
  };
  function setRandomMode(enabled) {
    randomMode = enabled;
    $('random').textContent = enabled ? '停止随机' : '随机动作';
    $('random').setAttribute('aria-pressed', String(enabled));
  }
  function syncDirection() {
    $('direction').disabled = !['walk', 'flight'].includes($('action').value);
  }
  function nextRandom() {
    if (!randomBag.length) {
      randomBag = [...$('action').options].map((option) => option.value);
      for (let i = randomBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [randomBag[i], randomBag[j]] = [randomBag[j], randomBag[i]];
      }
      if (randomBag.at(-1) === $('action').value)
        [randomBag[0], randomBag[randomBag.length - 1]] = [randomBag.at(-1), randomBag[0]];
    }
    $('action').value = randomBag.pop();
    if (['walk', 'flight'].includes($('action').value)) {
      const directions = [...$('direction').options];
      $('direction').value = directions[Math.floor(Math.random() * directions.length)].value;
    }
    run();
  }
  function wake() {
    cancelAnimationFrame(raf);
    last = null;
    raf = requestAnimationFrame(frame);
  }
  function waitForAction(playback) {
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => {
        resolve({ status: 'failed', error: Error('加载超时，请点击重新播放重试') });
        playback.cancel();
      }, 180000);
    });
    return Promise.race([playback.ready, timeout]).finally(() => clearTimeout(timer));
  }
  async function play() {
    const token = ++generation;
    syncDirection();
    stopPredownload();
    $('download-progress').textContent = '优先准备当前动作，播放后继续预下载其他动作。';
    ready = false;
    paused = false;
    elapsed = 0;
    last = null;
    retried = false;
    downloads.clear();
    loadingSince = performance.now();
    $('scrub').disabled = true;
    $('scrub').value = 0;
    $('time').textContent = '正在加载';
    $('pause').textContent = '暂停';
    $('notice').textContent = '正在准备动作，加载完成后自动播放。';
    $('after-status').textContent = '正在加载 WebP 图片……';
    pet.stop();
    pet.setScale(Number($('size').value) / 112);
    pet.setPosition(275, 400);
    const next = pet.play($('action').value, { direction: $('direction').value, distance: 100 });
    task = next;
    const result = await waitForAction(next);
    if (token !== generation) return;
    if (result.status !== 'ready') {
      setRandomMode(false);
      $('after-status').textContent = '加载失败，可点击重新播放重试';
      $('notice').textContent = result.error?.message || '动作已取消';
      $('time').textContent = '未就绪';
      return;
    }
    if (!Number.isFinite(next.duration) || next.duration <= 0) throw Error('动作时长无效');
    ready = true;
    pet.seek(0);
    elapsed = 0;
    $('scrub').max = next.duration;
    $('scrub').disabled = false;
    $('after-status').textContent = '已就绪';
    $('notice').textContent = randomMode
      ? '随机模式：当前动作完整播放后自动切换，走路和飞行会随机选择方向。'
      : '正在循环播放，可以暂停或拖动时间轴查看。';
    wake();
    startPredownload();
  }
  function frame(now) {
    const delta = last === null ? 0 : now - last;
    last = now;
    if (ready && task?.status === 'playing') {
      if (!paused && !document.hidden) {
        const nextElapsed = elapsed + delta * Number($('speed').value);
        if (randomMode && nextElapsed >= task.duration) {
          nextRandom();
        } else {
          elapsed = nextElapsed % task.duration;
          pet.seek(elapsed);
        }
      }
      $('scrub').value = elapsed;
      $('time').textContent = `${Math.round(elapsed)} / ${Math.round(task.duration)} ms`;
    } else if (task?.status === 'loading') {
      const progress = pet.assets.progress([...(task.plan?.assetIds || []), 'base:idle', 'base:talk']);
      const active = [...downloads.values()].filter((d) =>
        ['request', 'downloading', 'decoding'].includes(d.phase)
      );
      const bytes = active.reduce((n, d) => n + d.loaded, 0),
        total = active.reduce((n, d) => n + d.total, 0);
      $('after-status').textContent =
        `${retried ? '正在自动重试' : '正在下载'}，已就绪 ${progress.loaded}/${progress.total} 张；当前请求 ${Math.round(bytes / 1024)}/${Math.round(total / 1024)} KiB，已等待 ${Math.floor((now - loadingSince) / 1000)} 秒。`;
    }
    raf = requestAnimationFrame(frame);
  }
  addEventListener(
    'pagehide',
    () => {
      generation++;
      stopPredownload();
      cancelAnimationFrame(raf);
      pet.destroy();
    },
    { once: true }
  );
  addEventListener('pageshow', (event) => {
    if (event.persisted) location.reload();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopPredownload();
    else startPredownload();
    if (!pet.destroyed) wake();
  });
  await pet.ready;
  for (const action of pet.actions.list().filter((a) => !['idle', 'grow'].includes(a.id))) {
    const option = document.createElement('option');
    option.value = action.id;
    option.textContent = action.label || action.id;
    $('action').append(option);
  }
  controls.forEach((control) => (control.disabled = false));
  const run = () =>
    play().catch((error) => {
      setRandomMode(false);
      $('notice').textContent = error.message;
    });
  $('action').onchange =
    $('direction').onchange =
    $('play').onclick =
      () => {
        setRandomMode(false);
        randomBag = [];
        run();
      };
  $('size').onchange = run;
  $('random').onclick = () => {
    setRandomMode(!randomMode);
    if (randomMode) {
      randomBag = [];
      nextRandom();
    } else $('notice').textContent = '已停止随机切换，当前动作循环播放。';
  };
  $('pause').onclick = () => {
    paused = !paused;
    last = null;
    $('pause').textContent = paused ? '继续' : '暂停';
  };
  $('background').onclick = () => document.body.classList.toggle('dark');
  $('scrub').oninput = () => {
    if (!ready) return;
    elapsed = Number($('scrub').value);
    paused = true;
    last = null;
    $('pause').textContent = '继续';
    pet.seek(elapsed);
  };
  const canvas = $('after');
  const parts = {
    head: { label: '头', action: 'pet' },
    belly: { label: '肚子', action: 'jump' },
    feet: { label: '脚', action: 'dance' },
    wings: { label: '翅膀', action: 'flap' },
  };
  const canvasPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * pet.width) / rect.width,
      y: ((event.clientY - rect.top) * pet.height) / rect.height,
    };
  };
  let clickStart = null;
  canvas.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0 || !ready) return;
    const part = pet.hitTestPart(canvasPoint(event));
    if (!part) return;
    clickStart = { id: event.pointerId, x: event.clientX, y: event.clientY, part, moved: false, generation };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (
      clickStart?.id === event.pointerId &&
      Math.hypot(event.clientX - clickStart.x, event.clientY - clickStart.y) > 8
    )
      clickStart.moved = true;
    canvas.style.cursor = ready && pet.hitTestPart(canvasPoint(event)) ? 'pointer' : 'default';
  });
  canvas.addEventListener('pointerup', (event) => {
    const clicked = clickStart;
    if (!clicked || clicked.id !== event.pointerId) return;
    clickStart = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (
      clicked.generation !== generation ||
      clicked.moved ||
      Math.hypot(event.clientX - clicked.x, event.clientY - clicked.y) > 8 ||
      !ready
    )
      return;
    const part = parts[clicked.part];
    setRandomMode(false);
    randomBag = [];
    $('action').value = part.action;
    $('hit-status').textContent = '点中了' + part.label + ' · ' + $('action').selectedOptions[0].textContent;
    pet.emit('bodyclick', { part: clicked.part, point: canvasPoint(event), action: part.action });
    run();
  });
  canvas.addEventListener('pointercancel', () => {
    clickStart = null;
  });
  canvas.addEventListener('lostpointercapture', () => {
    clickStart = null;
  });
  window.pipiOptimization = {
    pet,
    changed: pet,
    pets: [pet],
    play,
    inspect: () => ({
      paused,
      randomMode,
      direction: $('direction').value,
      ready,
      generation,
      elapsed,
      lastFrameAgo: last === null ? null : Math.round(performance.now() - last),
      taskStates: task ? [task.status] : [],
    }),
  };
  $('stats').textContent = 'WebP 动作库 · 先下载再播放';
  fetch(base + '/optimization-report.json')
    .then((r) => {
      if (!r.ok) throw Error('Report unavailable');
      return r.json();
    })
    .then((report) => {
      $('stats').textContent =
        `WebP 动作库 · ${(report.after.imageBytes / 1048576).toFixed(2)} MiB · ${report.after.logicalFrames} 个序列帧 · 先下载再播放`;
    })
    .catch(() => {});
  wake();
  run();
})().catch((error) => {
  document.getElementById('notice').textContent = error.message;
});
