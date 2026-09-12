'use strict';
(async () => {
  const canvas = document.querySelector('#pet');
  const status = document.querySelector('#status');
  const controls = [...document.querySelectorAll('button, select')];
  const buttons = [...document.querySelectorAll('[data-action]')];
  const pause = document.querySelector('#pause');
  const requested = new URLSearchParams(location.search).get('assets');
  const variant = ['png', 'tinyimg', 'frames', 'webp'].includes(requested) ? requested : 'webp';
  const packs = {
    webp: '/dist/optimized-webp-frames',
    png: '/dist/optimized-assets',
    frames: '/dist/optimized-tinyimg-frames',
    tinyimg: '/dist/optimized-tinyimg',
  };
  const paged = ['frames', 'webp'].includes(variant);
  let pet, observer;
  status.textContent = paged
    ? '正在准备皮皮，其他动作图片会按需加载……'
    : '正在下载完整动作图集，首次加载请稍候……';
  try {
    pet = Pipi.createWebPet(canvas, {
      assetPack: packs[variant],
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      size: 132,
      dpr: Math.min(devicePixelRatio || 1, 2),
      interactive: false,
    });
    observer = new ResizeObserver(() => {
      pet.resize(canvas.clientWidth, canvas.clientHeight, Math.min(devicePixelRatio || 1, 2));
      pet.setPosition(canvas.clientWidth / 2, canvas.clientHeight * 0.8);
    });
    observer.observe(canvas);
    document.addEventListener('visibilitychange', () => {
      if (!pet.destroyed) pet.setVisible(!document.hidden);
    });
    addEventListener(
      'pagehide',
      () => {
        observer.disconnect();
        pet.destroy();
      },
      { once: true }
    );
    addEventListener('pageshow', (event) => {
      if (event.persisted) location.reload();
    });
    await pet.ready;
    // Useful for inspecting the SDK instance and checking frame playback in this demo.
    window.pipiDemo = { pet };
    controls.forEach((control) => {
      control.disabled = false;
    });
    status.textContent = paged ? '皮皮准备好了，动作图片会按需加载。' : '全部动作已准备好，选一个动作吧。';
    let generation = 0;
    const clear = () => buttons.forEach((button) => button.classList.remove('active'));
    for (const button of buttons)
      button.onclick = async () => {
        const token = ++generation;
        pet.resume();
        pause.textContent = '暂停';
        clear();
        button.classList.add('active');
        status.textContent = '正在准备「' + button.textContent + '」……';
        try {
          const task = pet.play(button.dataset.action);
          const ready = await task.ready;
          if (token !== generation) return;
          if (ready.status === 'failed') throw ready.error || Error('动作图片无法加载');
          status.textContent = '皮皮正在' + button.textContent + '。';
          const result = await task.finished;
          if (token !== generation) return;
          clear();
          status.textContent =
            result.status === 'failed' ? '动作加载失败，请再试一次。' : '还想看皮皮做什么？';
        } catch (error) {
          if (token !== generation) return;
          clear();
          status.textContent = '动作暂时不可用：' + error.message;
        }
      };
    document.querySelector('#speed').onchange = (event) => pet.setSpeed(Number(event.target.value));
    pause.onclick = () => {
      if (pet.paused) pet.resume();
      else pet.pause();
      pause.textContent = pet.paused ? '继续' : '暂停';
      status.textContent = pet.paused ? '已暂停。' : '继续陪皮皮玩吧。';
    };
    document.querySelector('#stop').onclick = () => {
      generation++;
      pet.stop();
      pet.resume();
      clear();
      pause.textContent = '暂停';
      status.textContent = '皮皮回到站姿了。';
    };
  } catch (error) {
    if (observer) observer.disconnect();
    if (pet) pet.destroy();
    status.textContent =
      '加载失败，请确认已运行 npm run build 和对应素材构建命令（WebP：npm run compress:webp）。' +
      error.message;
  }
})();
