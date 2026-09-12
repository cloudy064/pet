'use strict';
(async () => {
  const $ = (id) => document.getElementById(id);
  const profile = new URLSearchParams(location.search).get('profile') || 'webp';
  if (profile === 'frames' || profile === 'webp') {
    const label = profile === 'webp' ? 'WebP 小图集' : 'tinyimg 逐帧压缩';
    document.querySelector('h1').textContent = label + '，与原图同步对比';
    document.querySelectorAll('.view h2')[1].textContent = label;
    document.querySelector('small').textContent =
      profile === 'webp'
        ? '从原图打包小图集后直接编码 WebP，避免二次有损压缩。原图保留，帧序列与计时不变。'
        : '逐帧压缩后重新打包为小图集。原图保留，帧序列与计时不变；首屏只加载必要图片。';
  }
  const base =
    '../../dist/' +
    (profile === 'webp'
      ? 'optimized-webp-frames'
      : profile === 'frames'
        ? 'optimized-tinyimg-frames'
        : profile === 'exact'
          ? 'optimized-exact'
          : profile === 'compact'
            ? 'optimized-compact'
            : 'optimized-assets');
  const read = async (path) => {
    const response = await fetch(path);
    if (!response.ok) throw Error('请先生成优化素材：npm run optimize:assets');
    return response.json();
  };
  const [companion, report] = await Promise.all([
    read('../../assets/companion/manifest.json'),
    read(base + '/optimization-report.json'),
  ]);
  const mib = (bytes) => (bytes / 1048576).toFixed(2) + ' MiB';
  $('stats').textContent =
    `图片：${mib(report.before.pngBytes)} → ${mib(report.after.imageBytes ?? report.after.pngBytes)}（减少 ${((report.savedImageFraction ?? report.savedPngFraction) * 100).toFixed(1)}%） · 实际姿态：${report.before.physicalTiles} → ${report.after.physicalTiles} · 逻辑帧：${report.after.logicalFrames} · ${report.profile}`;
  const options = {
    width: 550,
    height: 550,
    size: 112,
    position: { x: 275, y: 400 },
    autoTick: false,
    autoBlink: false,
    interactive: false,
  };
  const original = Pipi.createWebPet($('before'), { ...options, assetBaseURL: '../../assets/engine' });
  const changed = Pipi.createWebPet($('after'), { ...options, assetPack: base });
  await Promise.all([original.ready, changed.ready]);
  PipiCompanion.installCompanionAnimations(original, companion, { baseURL: '../../assets/companion' });
  const pets = [original, changed];
  const actions = original.actions.list().filter((a) => !['idle', 'grow'].includes(a.id));
  for (const action of actions) {
    const option = document.createElement('option');
    option.value = action.id;
    option.textContent = action.label || action.id;
    $('action').append(option);
  }
  const labels = ['原图', '优化版'];
  const statuses = ['before-status', 'after-status'].map($);
  const retried = [false, false];
  const downloads = [new Map(), new Map()];
  pets.forEach((pet, i) => pet.assets.on('download', (data) => downloads[i].set(data.url, data)));
  pets.forEach((pet, i) => pet.assets.on('retry', () => (retried[i] = true)));
  // Bound the whole action as well as each image: an action may contain many pages.
  function waitForAction(task) {
    let timer;
    const deadline = new Promise((resolve) => {
      timer = setTimeout(() => {
        resolve({ status: 'failed', error: new Error('等待超过 3 分钟，已停止本次加载。请检查网络后重试') });
        task.cancel();
      }, 180000);
    });
    return Promise.race([task.ready, deadline]).finally(() => clearTimeout(timer));
  }
  let tasks,
    paused = false,
    synchronized = false,
    elapsed = 0,
    loadingSince = 0,
    last = null,
    generation = 0;
  async function play() {
    const token = ++generation;
    last = null;
    elapsed = 0;
    synchronized = false;
    paused = false;
    loadingSince = performance.now();
    retried.fill(false);
    downloads.forEach((map) => map.clear());
    $('notice').textContent = '优先加载优化版，开始预览后再下载原图；两边就绪后自动同步。';
    $('scrub').disabled = true;
    $('scrub').value = 0;
    $('time').textContent = '正在加载';
    $('pause').textContent = '暂停';
    statuses.forEach((node) => (node.textContent = '正在加载图片……'));
    for (const pet of pets) {
      pet.stop();
      pet.setScale(Number($('size').value) / 112);
      pet.setPosition(275, 400);
    }
    const action = $('action').value;
    const next = [null, changed.play(action, { direction: 'e', distance: 100 })];
    tasks = next;
    statuses[0].textContent = '等待优化版就绪后加载原图';
    const optimizedReady = waitForAction(next[1]);
    const originalReady = optimizedReady.then(() => {
      if (token !== generation) return { status: 'cancelled' };
      next[0] = original.play(action, { direction: 'e', distance: 100 });
      return waitForAction(next[0]);
    });
    const results = await Promise.all(
      [originalReady, optimizedReady].map((ready, i) =>
        ready.then((result) => {
          if (token !== generation) return result;
          if (result.status === 'ready') wake();
          statuses[i].textContent =
            result.status === 'ready' ? '已就绪，循环预览中' : '加载失败，请点击重新播放重试';
          if (result.status === 'failed') {
            $('time').textContent = '未同步，请重试';
            $('notice').textContent =
              labels[i] +
              '加载失败：' +
              (result.error?.message || '图片不可用') +
              '。可点击重新播放重试，另一版仍可预览。';
          }
          return result;
        })
      )
    );
    if (token !== generation || results.some((r) => r.status !== 'ready')) return;
    if (next[0].duration !== next[1].duration || !Number.isFinite(next[0].duration))
      throw Error('优化前后的动作时长不一致');
    elapsed = 0;
    pets.forEach((pet) => pet.seek(0));
    synchronized = true;
    $('scrub').max = next[0].duration;
    $('scrub').disabled = false;
    last = null;
    statuses.forEach((node) => (node.textContent = '已就绪，同步循环播放'));
    $('notice').textContent = '两版已同步循环播放。可以暂停或拖动时间轴检查完整动作。';
  }
  const run = () => play().catch((e) => ($('notice').textContent = e.message));
  $('play').onclick = run;
  $('action').onchange = run;
  $('size').onchange = run;
  $('pause').onclick = () => {
    paused = !paused;
    last = null;
    $('pause').textContent = paused ? '继续' : '暂停';
  };
  $('background').onclick = () => document.body.classList.toggle('dark');
  $('scrub').oninput = () => {
    if (!synchronized) return;
    elapsed = Number($('scrub').value);
    paused = true;
    last = null;
    $('pause').textContent = '继续';
    for (const pet of pets) pet.seek(elapsed);
  };
  let raf;
  function frame(now) {
    const delta = last === null ? 0 : now - last;
    last = now;
    if (tasks) {
      if (!paused && !document.hidden) {
        if (synchronized) {
          elapsed = (elapsed + delta * Number($('speed').value)) % tasks[0].duration;
          pets.forEach((pet) => pet.seek(elapsed));
        } else {
          tasks.forEach((task, i) => {
            if (task?.status === 'playing')
              pets[i].seek((task.elapsed + delta * Number($('speed').value)) % task.duration);
          });
        }
      }
      tasks.forEach((task, i) => {
        if (task?.status === 'loading') {
          const progress = pets[i].assets.progress([
            ...(task.plan?.assetIds || []),
            'base:idle',
            'base:talk',
          ]);
          const active = [...downloads[i].values()].filter((d) =>
            ['request', 'downloading', 'decoding'].includes(d.phase)
          );
          const bytes = active.reduce((sum, d) => sum + d.loaded, 0);
          const total = active.reduce((sum, d) => sum + d.total, 0);
          statuses[i].textContent =
            `${retried[i] ? '正在自动重试（仅重试一次）' : '正在下载图片'}，已就绪 ${progress.loaded}/${progress.total} 张；当前请求 ${Math.round(bytes / 1024)}/${Math.round(total / 1024)} KiB，已等待 ${Math.floor((now - loadingSince) / 1000)} 秒。`;
        }
      });
      if (synchronized) {
        $('scrub').value = elapsed;
        $('time').textContent = `${Math.round(elapsed)} / ${Math.round(tasks[0].duration)} ms`;
      }
    }
    raf = requestAnimationFrame(frame);
  }
  function wake() {
    cancelAnimationFrame(raf);
    last = null;
    raf = requestAnimationFrame(frame);
  }
  window.pipiOptimization = {
    original,
    changed,
    report,
    play,
    pets,
    inspect: () => ({
      paused,
      synchronized,
      generation,
      elapsed,
      lastFrameAgo: last === null ? null : Math.round(performance.now() - last),
      taskStates: tasks?.map((t) => t?.status || 'waiting-for-optimized'),
    }),
  };
  document.addEventListener('visibilitychange', () => {
    wake();
  });
  addEventListener(
    'pagehide',
    () => {
      generation++;
      cancelAnimationFrame(raf);
      pets.forEach((p) => p.destroy());
    },
    { once: true }
  );
  raf = requestAnimationFrame(frame);
  run();
})().catch((error) => (document.getElementById('notice').textContent = error.message));
