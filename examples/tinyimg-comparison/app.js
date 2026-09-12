'use strict';
(async () => {
  const $ = (id) => document.getElementById(id);
  const pets = [];
  let raf,
    generation = 0,
    tasks,
    paused = false,
    loading = true,
    elapsed = 0,
    last = null;
  const seek = (time) => {
    elapsed = Math.max(0, Math.min(time, tasks[0].duration));
    pets.forEach((pet) => pet.seek(elapsed));
    $('scrub').value = elapsed;
    $('time').textContent = `${Math.round(elapsed)} / ${Math.round(tasks[0].duration)} ms`;
  };
  const setPaused = (value) => {
    paused = value;
    last = null;
    $('pause').textContent = value ? '继续' : '暂停';
  };
  async function play() {
    const token = ++generation;
    loading = true;
    $('status').textContent = '正在准备同步动作……';
    pets.forEach((pet) => {
      pet.stop();
      pet.setScale(Number($('size').value) / 112);
      pet.setPosition(240, 350);
    });
    const next = pets.map((pet) => pet.play($('action').value, { direction: 'e', distance: 80 }));
    const ready = await Promise.all(next.map((task) => task.ready));
    if (token !== generation) return;
    if (ready.some((result) => result.status !== 'ready')) throw Error('有一版动作加载失败，请刷新重试。');
    if (next.some((task) => task.duration !== next[0].duration || !Number.isFinite(task.duration)))
      throw Error('动作时序不一致。');
    tasks = next;
    $('scrub').max = tasks[0].duration;
    seek(0);
    setPaused(false);
    loading = false;
    $('status').textContent = '三版已同步。可以暂停、逐帧查看，或切换擦嘴动作检查道具。';
  }
  const fail = (error) => {
    loading = true;
    $('status').textContent = error.message;
  };
  addEventListener(
    'pagehide',
    () => {
      generation++;
      cancelAnimationFrame(raf);
      pets.forEach((pet) => pet.destroy());
    },
    { once: true }
  );
  addEventListener('pageshow', (event) => {
    if (event.persisted) location.reload();
  });
  document.addEventListener('visibilitychange', () => {
    last = null;
  });
  try {
    const bases = ['/dist/optimized-assets', '/dist/optimized-tinyimg-raw', '/dist/optimized-tinyimg'];
    for (const [index, id] of ['baseline', 'raw', 'guarded'].entries()) {
      const pet = Pipi.createWebPet($(id), {
        assetPack: bases[index],
        width: 480,
        height: 480,
        size: 112,
        position: { x: 240, y: 350 },
        autoTick: false,
        autoBlink: false,
        interactive: false,
      });
      pets.push(pet);
    }
    await Promise.all(pets.map((pet) => pet.ready));
    const sizes = pets.map((pet) => pet.assets.get('base:idle').pages[0].bytes);
    ['baseline', 'raw', 'guarded'].forEach((id, i) => {
      $(id + '-size').textContent =
        `${(sizes[i] / 1048576).toFixed(2)} MiB` +
        (i ? ` · 再减少 ${(100 * (1 - sizes[i] / sizes[0])).toFixed(1)}%` : ' · 对照基准');
    });
    for (const action of pets[0].actions.list().filter((a) => !['idle', 'grow'].includes(a.id))) {
      const option = document.createElement('option');
      option.value = action.id;
      option.textContent = action.label || action.id;
      $('action').append(option);
    }
    $('action').value = 'dance';
    document.querySelectorAll('[disabled]').forEach((el) => {
      el.disabled = false;
    });
    $('action').onchange = $('size').onchange = $('restart').onclick = () => play().catch(fail);
    $('pause').onclick = () => setPaused(!paused);
    $('background').onchange = () => {
      document.body.dataset.background = $('background').value;
    };
    $('scrub').oninput = () => {
      if (!loading) {
        setPaused(true);
        seek(Number($('scrub').value));
      }
    };
    for (const [id, step] of [
      ['previous', -1],
      ['next', 1],
    ])
      $(id).onclick = () => {
        if (loading) return;
        setPaused(true);
        pets[0].stepFrame(step);
        seek(tasks[0].elapsed);
      };
    function frame(now) {
      const delta = last === null ? 0 : now - last;
      last = now;
      if (!loading && !paused && !document.hidden)
        seek((elapsed + delta * Number($('speed').value)) % tasks[0].duration);
      raf = requestAnimationFrame(frame);
    }
    await play();
    window.pipiTinyComparison = { pets, play, seek, setPaused };
    raf = requestAnimationFrame(frame);
  } catch (error) {
    pets.forEach((pet) => pet.destroy());
    fail(error);
  }
})();
