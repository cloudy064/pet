'use strict';
(async () => {
  const $ = (id) => document.getElementById(id),
    stage = $('preview-stage'),
    canvas = $('preview'),
    pet = Pipi.createWebPet(canvas, {
      width: stage.clientWidth,
      height: stage.clientHeight,
      size: 160,
      dpr: Math.min(devicePixelRatio, 2),
      assetBaseURL: '../../assets/engine',
      autoBlink: false,
      interactive: false,
    });
  await pet.ready;
  let selected = null,
    manifest;
  const report = (error) => {
    $('error').textContent = error.message || String(error);
  };
  try {
    const response = await fetch('../../assets/companion/manifest.json');
    if (!response.ok) throw Error('新动作还在制作中，运行图集尚未就绪。');
    manifest = await response.json();
    PipiCompanion.installCompanionAnimations(pet, manifest, { baseURL: '../../assets/companion' });
    $('pack-status').textContent = `${manifest.actions.length} 个新动作 · 透明 PNG 序列帧`;
  } catch (error) {
    $('pack-status').textContent = error.message;
  }
  const actions = manifest?.actions || [];
  async function play(options = {}) {
    if (!selected) return;
    pet.stop();
    pet.resume();
    const task = pet.play(selected, { effects: $('effects').checked, ...options });
    const ready = await task.ready;
    if (ready.status !== 'ready') throw ready.error || Error('动作未能开始');
    $('timeline').max = Number.isFinite(task.duration) ? task.duration : 15000;
    return task;
  }
  function select(id) {
    selected = id;
    document
      .querySelectorAll('[data-action]')
      .forEach((button) => button.setAttribute('aria-pressed', button.dataset.action === id));
    const action = pet.actions.get(id),
      asset = pet.assets.get(action.asset);
    $('action-detail').textContent =
      `${action.label} · ${asset.frameMap.length} 个逻辑帧 · ${asset.tiles.length} 张图格 · ${action.type === 'staged' ? '分段循环，可自然结束' : '完整播放一次'}`;
    $('sustain').disabled = action.type !== 'staged';
    $('effects').disabled = !action.overlays;
    play().catch(report);
  }
  for (const action of actions) {
    const button = document.createElement('button');
    button.textContent = action.label;
    button.dataset.action = action.id;
    button.onclick = () => select(action.id);
    $('action-list').append(button);
  }
  $('play').onclick = () => play().catch(report);
  $('effects').onchange = () => play().catch(report);
  $('pause').onclick = () => {
    if (pet.paused) pet.resume();
    else pet.pause();
    $('pause').textContent = pet.paused ? '继续' : '暂停';
  };
  $('previous').onclick = () => pet.stepFrame(-1);
  $('next').onclick = () => pet.stepFrame(1);
  $('sustain').onclick = () => play({ sustain: true }).catch(report);
  $('release').onclick = () => {
    pet.resume();
    pet.release();
    if (pet.current) $('timeline').max = pet.current.duration;
  };
  $('timeline').oninput = () => {
    pet.pause().seek(Number($('timeline').value));
    update();
  };
  $('preview-size').oninput = () => {
    pet.setScale(Number($('preview-size').value) / 160);
    play().catch(report);
  };
  document.querySelectorAll('[data-background]').forEach(
    (button) =>
      (button.onclick = () => {
        stage.style.background =
          button.dataset.background === 'dark'
            ? '#253d34'
            : button.dataset.background === 'light'
              ? '#fffdf4'
              : '';
      })
  );
  function update() {
    const snapshot = pet.snapshot();
    if (pet.current) $('timeline').value = Math.min(Number($('timeline').max), snapshot.elapsed);
    $('frame-info').textContent = pet.current
      ? `第 ${snapshot.frame + 1} 帧 · ${Math.round(snapshot.elapsed)} ms`
      : '站姿';
  }
  pet.on('frame', update);
  pet.on('seek', update);
  pet.on('error', ({ error }) => report(error));
  const observer = new ResizeObserver(() => {
    const width = stage.clientWidth,
      height = stage.clientHeight,
      dpr = Math.min(devicePixelRatio, 2);
    if (pet.width !== width || pet.height !== height || pet.dpr !== dpr) pet.resize(width, height, dpr);
  });
  observer.observe(stage);
  window.pipiAnimationGallery = {
    pet,
    select,
    play,
    get manifest() {
      return manifest;
    },
  };
  if (actions.length) select(actions[0].id);
  addEventListener('pagehide', (event) => {
    if (event.persisted) pet.setVisible(false);
    else {
      observer.disconnect();
      pet.destroy();
    }
  });
  addEventListener('pageshow', (event) => {
    if (event.persisted) pet.setVisible(true);
  });
})().catch((error) => {
  document.getElementById('error').textContent = error.message;
});
