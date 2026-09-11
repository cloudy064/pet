'use strict';
(() => {
  const $ = (id) => document.getElementById(id),
    canvas = $('canvas'),
    stage = $('stage'),
    key = 'pipi-engine-studio-actions-v1';
  const pet = Pipi.createWebPet(canvas, {
    width: stage.clientWidth,
    height: stage.clientHeight,
    size: 136,
    padding: 30,
    dpr: Math.min(devicePixelRatio, 2),
    assetBaseURL: 'assets/engine',
    autoBlink: true,
  });
  let selected = 'wave',
    target = null,
    lastUI = 0;
  window.pipiStudio = { pet, select };
  function message(text, error = false) {
    $('message').textContent = text;
    $('message').classList.toggle('error', error);
  }
  function attempt(fn) {
    try {
      const value = fn();
      if (value && value.catch) value.catch((error) => message(error.message, true));
      return value;
    } catch (error) {
      message(error.message, true);
    }
  }
  function select(id) {
    selected = id;
    list();
    edit();
  }
  function list() {
    const needle = $('search').value.trim().toLowerCase();
    $('actions').replaceChildren();
    for (const action of pet.actions
      .list()
      .filter((a) => (a.id + ' ' + a.label).toLowerCase().includes(needle))) {
      const button = document.createElement('button');
      button.className = 'action' + (action.id === selected ? ' active' : '');
      button.dataset.action = action.id;
      const label = document.createElement('span');
      label.textContent = action.label || action.id;
      const type = document.createElement('small');
      type.textContent = action.enabled === false ? '已停用' : action.type;
      button.append(label, type);
      button.onclick = () => select(action.id);
      $('actions').append(button);
    }
  }
  function edit() {
    if (!pet.actions.has(selected)) {
      selected = pet.actions.list()[0]?.id;
      if (!selected) {
        $('definition').value = '';
        return;
      }
    }
    const a = pet.actions.get(selected);
    $('type').textContent = a.type;
    $('label').value = a.label || a.id;
    $('action-speed').value = a.speed || 1;
    $('enabled').checked = a.enabled !== false;
    $('hold-field').hidden = !['wave', 'point'].includes(a.type);
    $('hold').value = a.holdMs ?? 1800;
    $('definition').value = JSON.stringify(a, null, 2);
    $('snippet').textContent =
      'const pet = createWebPet(canvas);\nawait pet.ready;\nawait pet.play(' + JSON.stringify(a.id) + ');';
  }
  function changed() {
    list();
    edit();
    try {
      localStorage.setItem(key, JSON.stringify(pet.actions.export()));
    } catch {}
  }
  pet.on('librarychange', changed);
  pet.on('error', (e) => message(e.error.message, true));
  pet.on('start', (e) => message('正在播放：' + (pet.actions.get(e.action).label || e.action)));
  pet.on('finish', () => message('动作已完成'));
  pet.on('speechend', (e) => {
    if (e.status === 'failed') message('语音未能播放，动作会自然收尾。', true);
  });
  pet.on('cancel', (e) => {
    if (e.status !== 'failed') message('动作已停止。');
  });
  const renderState = (state) => {
    $('current').textContent =
      (pet.actions.has(state.action) ? pet.actions.get(state.action).label : state.action) || state.action;
    const duration = Number.isFinite(state.duration) ? state.duration : Math.max(10000, state.elapsed + 1000);
    $('seek').max = Math.max(1, duration);
    $('seek').value = state.elapsed;
    $('time').textContent =
      (state.elapsed / 1000).toFixed(2) +
      ' / ' +
      (Number.isFinite(state.duration) ? (duration / 1000).toFixed(2) : '∞') +
      ' s';
    $('frame').textContent = '第 ' + state.frame + ' 帧';
    $('memory').textContent = '图集内存 ' + (state.cache.bytes / 1048576).toFixed(1) + ' MiB';
    $('pause').textContent = state.paused ? '继续' : '暂停';
    $('size-value').textContent = Math.round(state.size) + ' px';
  };
  pet.on('frame', (state) => {
    const now = performance.now();
    if (now - lastUI < 70) return;
    lastUI = now;
    renderState(state);
  });
  for (const event of ['seek', 'pause', 'resume', 'scale', 'speed']) pet.on(event, renderState);
  $('search').oninput = list;
  $('play').onclick = () =>
    attempt(() => {
      pet.stopFree().resume();
      return pet.play(selected, {
        sustain: $('sustain').checked,
        ...(['walk', 'flight'].includes(pet.actions.get(selected).type)
          ? { to: target || destination('e') }
          : {}),
      });
    });
  $('pause').onclick = () => (pet.paused ? pet.resume() : pet.pause());
  $('release').onclick = () => pet.release();
  $('stop').onclick = () => pet.stopFree({ cancel: true });
  $('seek').oninput = () => pet.pause().seek(Number($('seek').value));
  $('previous-frame').onclick = () => pet.stepFrame(-1);
  $('next-frame').onclick = () => pet.stepFrame(1);
  $('speed').oninput = () => {
    $('speed-value').textContent = Number($('speed').value) + '×';
    pet.setSpeed(Number($('speed').value));
  };
  $('size').oninput = () => {
    pet.setScale(Number($('size').value) / pet.baseSize);
    $('size-value').textContent = Math.round(pet.size) + ' px';
  };
  $('background').onchange = () => {
    stage.className = 'stage ' + $('background').value;
  };
  $('save-fields').onclick = () =>
    attempt(() => {
      const patch = {
        label: $('label').value,
        speed: Number($('action-speed').value),
        enabled: $('enabled').checked,
      };
      if (!$('hold-field').hidden) patch.holdMs = Number($('hold').value);
      pet.actions.update(selected, patch);
      message('动作设置已保存，下次播放生效。');
    });
  $('save-json').onclick = () =>
    attempt(() => {
      const definition = JSON.parse($('definition').value);
      if (definition.id !== selected) throw new Error('修改 ID 请使用“复制动作”或“新增动作”。');
      pet.actions.register(definition, { replace: true });
      message('动作定义已通过校验并保存。');
    });
  const nextId = (base) => {
    let n = 1;
    while (pet.actions.has(base + n)) n++;
    return base + n;
  };
  $('duplicate').onclick = () =>
    attempt(() => {
      const current = pet.actions.get(selected),
        id = nextId(current.id + 'Copy');
      pet.actions.register({ ...current, id, label: (current.label || current.id) + ' 副本' });
      select(id);
      message('已复制，可以独立调整。');
    });
  $('add').onclick = () =>
    attempt(() => {
      const id = nextId('custom');
      pet.actions.register({ id, label: '新动作', type: 'clip', asset: 'base:blink', speed: 1 });
      select(id);
      message('新动作已创建；可在 JSON 中指定图集或组合步骤。');
    });
  $('delete').onclick = () =>
    attempt(() => {
      pet.actions.remove(selected);
      list();
      edit();
      message('动作已删除。');
    });
  $('restore').onclick = () =>
    attempt(() => {
      pet.stopFree({ cancel: true });
      pet.actions.import({ version: 1, actions: Pipi.DEFAULT_ACTIONS }, { replace: true });
      select('wave');
      message('已恢复内置动作库。');
    });
  function destination(dir) {
    const v = Pipi.DIRECTIONS[dir],
      b = pet.bounds({ lift: $('move-mode').value === 'flight' ? (pet.size * 86) / 240 : 0 });
    const to = {
      x: v[0] < 0 ? b.left + 5 : v[0] > 0 ? b.right - 5 : pet.position.x,
      y: v[1] < 0 ? b.top + 5 : v[1] > 0 ? b.bottom - 5 : pet.position.y,
    };
    return to;
  }
  $('directions').onclick = (e) => {
    const dir = e.target.dataset.dir;
    if (dir)
      attempt(() => {
        pet.stopFree().resume();
        return pet.moveTo(destination(dir), { mode: $('move-mode').value });
      });
  };
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect(),
      point = {
        x: ((e.clientX - rect.left) * pet.width) / rect.width,
        y: ((e.clientY - rect.top) * pet.height) / rect.height,
      };
    if (pet.hitTest(point)) return;
    target = pet.constrain(point);
    $('target').hidden = false;
    $('target').style.left = target.x + 'px';
    $('target').style.top = target.y + 'px';
    message('移动目标已设置。');
  });
  $('move-target').onclick = () =>
    attempt(() => {
      if (!target) throw new Error('先点击预览区的空白处，设置目标。');
      pet.stopFree().resume();
      return pet.moveTo(target, { mode: $('move-mode').value });
    });
  $('reset').onclick = () => {
    pet.stopFree({ cancel: true }).setPosition(pet.width / 2, pet.height * 0.8);
    target = null;
    $('target').hidden = true;
  };
  $('free').onclick = () =>
    attempt(() => {
      if (pet.free) {
        pet.stopFree({ cancel: true });
        $('free').textContent = '开始自由活动';
      } else {
        const min = Number($('free-delay').value) * 1000;
        pet.resume().startFree({
          actions: pet.actions
            .list({ enabledOnly: true })
            .filter((a) => !['idle', 'talk', 'grow'].includes(a.id) && a.type !== 'sequence')
            .map((a) => a.id),
          minDelay: min,
          maxDelay: min + 3000,
        });
        $('free').textContent = '结束自由活动';
      }
    });
  pet.on('freemode', (active) => ($('free').textContent = active ? '结束自由活动' : '开始自由活动'));
  $('mouth').onchange = () => pet.setSpeaking($('mouth').checked);
  $('welcome').onclick = () =>
    attempt(() => {
      pet.stopFree().resume();
      return pet.speak(Pipi.DEFAULT_AUDIO_BASE + '/pet-welcome.mp3', { gesture: 'wave' });
    });
  $('reward').onclick = () =>
    attempt(() => {
      pet.stopFree().resume();
      return pet.celebrate({
        audio: Pipi.DEFAULT_AUDIO_BASE + '/pet-celebrate.mp3',
        scale: pet.scale * 1.08,
      });
    });
  $('export').onclick = () => {
    const blob = new Blob([JSON.stringify(pet.exportProject(), null, 2)], { type: 'application/json' }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = 'pipi-project.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message('项目已导出，包含动作、图集配置和尺寸设置。');
  };
  $('import').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await attempt(async () => {
      await pet.importProject(await file.text());
      list();
      edit();
      message('项目已导入。');
    });
    e.target.value = '';
  };
  let resizeTimer;
  const observer = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!pet.destroyed && (pet.width !== stage.clientWidth || pet.height !== stage.clientHeight))
        pet.resize(stage.clientWidth, stage.clientHeight);
    }, 120);
  });
  observer.observe(stage);
  pet.on('destroy', () => {
    observer.disconnect();
    clearTimeout(resizeTimer);
  });
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    observer.disconnect();
    pet.destroy();
  });
  pet.ready
    .then(() => {
      try {
        const saved = localStorage.getItem(key);
        if (saved) pet.actions.import(JSON.parse(saved), { replace: true });
      } catch {
        message('已忽略无法读取的本地动作配置。', true);
      }
      list();
      edit();
      message('皮皮准备好了。选择一个动作开始预览。');
    })
    .catch(() => {});
})();
