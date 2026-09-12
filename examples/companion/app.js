'use strict';
(async () => {
  if (!navigator.locks) throw Error('请使用支持安全存档的浏览器，通过 localhost 或 HTTPS 打开小院。');
  await navigator.locks.request('pipi-companion-demo-account', { ifAvailable: true }, async (lock) => {
    if (!lock) {
      document.querySelectorAll('button').forEach((button) => (button.disabled = true));
      throw Error('小院已在另一个标签页打开。关闭那一页后，刷新这里继续。');
    }
    const $ = (id) => document.getElementById(id),
      { PetCompanion, createWebStore, installCompanionAnimations, createBrowserVoice } = PipiCompanion,
      canvas = $('pet-canvas'),
      garden = $('garden'),
      careCanvas = $('care-canvas');
    const report = (text) => {
      $('notice').textContent = text;
    };
    const run = (fn) =>
      Promise.resolve()
        .then(fn)
        .catch((error) => report(error.message));
    const uid = () => globalThis.crypto.randomUUID();
    const account = PipiDemoLedger.create(localStorage);
    const wallet = account.wallet;
    const pageClosed = new Promise((resolve) => {
      addEventListener(
        'pagehide',
        () => {
          account.close();
          resolve();
        },
        { once: true }
      );
    });
    addEventListener('pageshow', (event) => {
      if (event.persisted) location.reload();
    });
    let companion, observer;
    const optimized = new URLSearchParams(location.search).get('assets') === 'optimized';
    const assetBase = optimized ? '../../dist/optimized-assets' : '../../assets/engine';
    const companionBase = optimized ? assetBase : '../../assets/companion';

    const pet = Pipi.createWebPet(canvas, {
      width: garden.clientWidth,
      height: garden.clientHeight,
      size: 58,
      position: { x: garden.clientWidth * 0.5, y: garden.clientHeight * 0.76 },
      dpr: Math.min(devicePixelRatio, 2),
      ...(optimized ? { assetPack: assetBase } : { assetBaseURL: assetBase }),
      autoBlink: true,
    });
    try {
      await pet.ready;
      let songs = [];
      try {
        if (!optimized) {
          const response = await fetch(companionBase + '/manifest.json');
          if (!response.ok) throw Error('新的动作包暂时没有加载成功。');
          installCompanionAnimations(pet, await response.json(), { baseURL: companionBase });
        }
      } catch (error) {
        report(error.message);
      }
      try {
        const response = await fetch(companionBase + '/audio/catalog.json');
        if (!response.ok) throw Error('数数歌暂时没有加载成功。');
        songs = (await response.json()).tracks;
      } catch (error) {
        report(error.message);
      }
      let voice;
      try {
        voice = createBrowserVoice(window);
      } catch {}
      companion = new PetCompanion(pet, {
        storage: createWebStore(localStorage),
        wallet,
        muted: true,
        voice,
      });
      window.pipiCompanionDemo = {
        pet,
        companion,
        get ledger() {
          return account.snapshot();
        },
      };
      const modeLabels = {
        home: '自在玩耍中',
        learning: '安静陪你学习',
        care: '享受照料中',
        rest: '安静休息中',
        hidden: '稍后再见',
      };
      const paint = (snapshot) => {
        if (!snapshot.state) return;
        const s = snapshot.state;
        $('balance').textContent = account.snapshot().balance;
        $('points').textContent = s.growthPoints;
        $('height').textContent =
          s.growthPoints < 10 ? '初见的小伙伴' : s.growthPoints < 80 ? '一起长大的伙伴' : '默契的小伙伴';
        $('growth-progress').value = s.growthPoints;
        $('food').value = s.satiation;
        $('clean').value = s.cleanliness;
        $('food-label').textContent = Math.round(s.satiation) + '%';
        $('clean-label').textContent = Math.round(s.cleanliness) + '%';
        $('growth-caption').textContent = s.growthPoints
          ? '你教会的小本领，都悄悄变成了成长。'
          : '第一个小本领，从今天开始。';
        $('mode-label').textContent = modeLabels[snapshot.mode];
        document
          .querySelectorAll('[data-mode]')
          .forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === snapshot.mode));
        $('lesson').hidden = snapshot.mode !== 'learning';
        $('activity').hidden = ['learning', 'rest'].includes(snapshot.mode);
        $('rest').hidden = snapshot.mode !== 'rest';
        garden.classList.toggle('resting', snapshot.mode === 'rest');
        $('care-tools').hidden = careCanvas.hidden = !(snapshot.mode === 'care' && snapshot.careKind);
        $('rinse').hidden = $('wash-progress').hidden = snapshot.careKind !== 'bath';
        $('request').hidden = !snapshot.request;
        $('sound').textContent = snapshot.muted ? '声音已关' : '声音已开';
        $('sound').setAttribute('aria-pressed', !snapshot.muted);
        if (snapshot.bath && snapshot.careKind === 'bath') {
          $('wash-progress').value = snapshot.bath.coverage;
          $('rinse').disabled = snapshot.bath.phase !== 'rinse';
          $('bath-progress').textContent =
            snapshot.bath.phase === 'rinse' ? '泡泡涂好啦，可以冲水了' : '用香皂轻轻涂抹身体';
        } else
          $('bath-progress').textContent = snapshot.bathClosing
            ? '冲干净啦，甩甩水珠'
            : snapshot.careKind === 'scratch'
              ? '轻轻来回挠一挠，皮皮会回应你'
              : '轻轻来回摸摸皮皮';
        if (snapshot.bathClosing) $('rinse').disabled = true;
        $('leave-bath').textContent = snapshot.careKind === 'bath' ? '稍后再洗' : '摸好啦';
        $('stage-label').textContent =
          snapshot.mode === 'care'
            ? snapshot.careKind === 'bath'
              ? '在皮皮的身体上慢慢滑动，避开眼睛。'
              : '轻轻来回滑动，给皮皮一点陪伴。'
            : snapshot.mode === 'learning'
              ? '皮皮会安静地陪你，不打扰你思考。'
              : snapshot.mode === 'rest'
                ? '休息也很重要，皮皮陪着你。'
                : '轻轻点它一下，也可以拖着它走。';
        drawBubbles();
      };
      companion.on('change', paint);
      companion.on('mode', paint);
      companion.on('dialogue', ({ text }) => {
        $('speech').textContent = text;
      });
      companion.on('request', ({ text }) => {
        $('request-text').textContent = text;
        paint(companion.snapshot());
      });
      companion.on('error', ({ error }) => report(error.message));
      companion.on('intent', ({ type }) => {
        if (type === 'learn') startLearning();
        else if (type === 'feed') $('feed').click();
        else $('bath').click();
      });
      await companion.ready;
      if (companion.state.pendingCare) await run(() => companion.recoverCare());
      account.migrate(companion.state.eventRevision);
      let delivery = Promise.resolve();
      const deliverEvents = () => {
        const task = delivery.then(async () => {
          for (const event of account.pending()) {
            await companion.handleEvent(event);
            account.delivered(event.id);
          }
        });
        delivery = task.catch(() => {});
        return task;
      };
      await deliverEvents();
      $('date').textContent = new Intl.DateTimeFormat('zh-CN', {
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      }).format(new Date());
      let session = sessionStorage.getItem('pipi-session');
      if (!session) {
        session = uid();
        sessionStorage.setItem('pipi-session', session);
      }
      await companion.welcome(session);
      paint(companion.snapshot());

      document.querySelectorAll('[data-mode]').forEach(
        (button) =>
          (button.onclick = () =>
            run(() => {
              if (button.dataset.mode === 'learning') startLearning();
              else if (button.dataset.mode === 'care') {
                companion.setMode('home');
                $('activity').scrollIntoView({ block: 'nearest' });
                report('选一项你想为皮皮做的事吧。');
              } else companion.setMode(button.dataset.mode);
            }))
      );
      $('sound').onclick = () => {
        companion.setMuted(!companion.muted);
        if (!companion.muted)
          report(voice ? '声音打开啦，皮皮可以和你说话了。' : '这里暂时不能播放声音，皮皮会用文字陪你。');
      };
      for (const [button, locale] of [
        ['song-zh', 'zh-CN'],
        ['song-en', 'en'],
      ]) {
        $(button).onclick = () =>
          run(async () => {
            const track = songs.find((song) => song.locale === locale);
            if (!track) return report('数数歌暂时没有加载成功。');
            if (companion.mode !== 'home') return report('回到小院，再和皮皮一起唱歌吧。');
            companion.setMuted(false);
            const result = await companion.sing({
              ...track,
              audioURL: companionBase + '/' + track.audioURL,
            });
            if (result.status === 'failed') report('歌声没能播放，请再试一次。');
          });
      }
      const beginPetting = async (kind) => {
        await companion.beginPetting(kind);
        pet.setPosition(garden.clientWidth * 0.5, garden.clientHeight * 0.78);
      };
      $('pet').onclick = () => run(() => beginPetting('pet'));
      $('scratch').onclick = () => run(() => beginPetting('scratch'));
      $('feed').onclick = () =>
        run(async () => {
          const result = await companion.feed({ operationId: uid() });
          report(
            result.status === 'full'
              ? '皮皮已经吃饱啦，摸摸它也很好。'
              : result.status === 'insufficient-funds'
                ? '葵花籽暂时不够，仍然可以免费摸摸和洗澡。'
                : result.status === 'accepted'
                  ? '皮皮收到香香的葵花籽啦。'
                  : '现在先陪皮皮完成当前的事情吧。'
          );
        });
      $('bath').onclick = () =>
        run(async () => {
          pet.setPosition(garden.clientWidth * 0.5, garden.clientHeight * 0.78);
          const result = await companion.beginBath(companion.state.bath?.id || uid());
          if (result.status === 'accepted') {
            $('speech').textContent = '轻轻涂泡泡，再帮我冲一冲吧！';
            paint(companion.snapshot());
          }
        });
      $('rinse').onclick = () => run(() => companion.rinse());
      $('leave-bath').onclick = () =>
        companion.careKind === 'bath' ? companion.cancelBath() : companion.endPetting();
      $('accept-request').onclick = () => run(() => companion.respondToRequest());
      $('dismiss-request').onclick = () => companion.dismissRequest();
      $('wake').onclick = () => {
        companion.setMode('home');
        $('speech').textContent = '休息好啦，我们慢慢来！';
      };

      let question = null,
        completed = 0;
      function newQuestion() {
        const a = 1 + Math.floor(Math.random() * 5),
          b = 1 + Math.floor(Math.random() * 4);
        question = { id: uid(), a, b, answered: false };
        $('equation').textContent = `${a} + ${b} = ?`;
        $('lesson-feedback').textContent = '';
        $('next-question').hidden = true;
        $('answers').replaceChildren();
        const answers = [a + b - 1, a + b, a + b + 1].sort(() => Math.random() - 0.5);
        for (const value of answers) {
          const button = document.createElement('button');
          button.textContent = value;
          button.onclick = () =>
            run(async () => {
              if (question.answered) return;
              const current = question;
              if (value !== a + b) {
                $('lesson-feedback').textContent = '慢慢来，再和皮皮数一次。';
                return;
              }
              current.answered = true;
              $('answers')
                .querySelectorAll('button')
                .forEach((b) => (b.disabled = true));
              try {
                account.enqueue(current.id, 'taskCompleted', 1, 3);
                await deliverEvents();
                completed++;
                if (question === current) {
                  $('lesson-feedback').textContent = '教会皮皮啦！成长 +1，葵花籽 +3。';
                  $('next-question').hidden = false;
                }
                companion.requestEyeBreak();
              } catch (error) {
                current.answered = false;
                if (question === current)
                  $('answers')
                    .querySelectorAll('button')
                    .forEach((b) => (b.disabled = false));
                throw error;
              }
            });
          $('answers').append(button);
        }
      }
      function startLearning() {
        companion.setMode('learning');
        if (!question || question.answered) newQuestion();
      }
      $('learn').onclick = startLearning;
      $('next-question').onclick = newQuestion;
      $('finish-learning').onclick = () =>
        run(async () => {
          companion.setMode('home');
          if (completed) {
            account.enqueue(uid(), 'gameCompleted', 0, 0);
            await deliverEvents();
            completed = 0;
          }
        });

      function bodyRect() {
        const s = pet.snapshot();
        return { x: s.position.x - s.size * 0.34, y: s.position.y - s.size, w: s.size * 0.68, h: s.size };
      }
      function drawBubbles() {
        if (careCanvas.hidden) return;
        const ctx = careCanvas.getContext('2d'),
          dpr = Math.min(devicePixelRatio, 2),
          rect = bodyRect();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, garden.clientWidth, garden.clientHeight);
        if (companion.careKind !== 'bath') return;
        if (companion.bathClosing && pet.current?.plan) {
          const sample = pet.current.plan.sample(pet.current.elapsed);
          if (sample.phase === 'close') {
            const time = sample.segmentTime / 1000;
            ctx.strokeStyle = '#76c9e2bb';
            ctx.lineWidth = Math.max(1.5, pet.size * 0.014);
            for (let i = 0; i < 16; i++) {
              const phase = (time * 2 + i * 0.13) % 1;
              const x = rect.x + rect.w * (i / 15);
              const y = rect.y + rect.h * phase;
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x - rect.w * 0.018, y + rect.h * 0.07);
              ctx.stroke();
            }
          }
        }
        for (const cell of companion.state.bath?.cells || []) {
          const x = rect.x + (((cell % 8) + 0.5) / 8) * rect.w,
            y = rect.y + ((Math.floor(cell / 8) + 0.5) / 12) * rect.h;
          ctx.fillStyle = '#ffffffb8';
          ctx.strokeStyle = '#b5dae7';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(3, pet.size * 0.065), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        if (washing && soapPoint && companion.state.bath?.phase === 'soap') {
          ctx.fillStyle = '#efadc0';
          ctx.strokeStyle = '#d987a1';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(soapPoint.x - 14, soapPoint.y - 8, 28, 16, 6);
          ctx.fill();
          ctx.stroke();
        }
      }
      let washing = false,
        soapPoint = null,
        lastCell = '';
      const wash = (event) => {
        if (!washing) return;
        const bounds = careCanvas.getBoundingClientRect(),
          rect = bodyRect(),
          x = (((event.clientX - bounds.left) * garden.clientWidth) / bounds.width - rect.x) / rect.w,
          y = (((event.clientY - bounds.top) * garden.clientHeight) / bounds.height - rect.y) / rect.h,
          cell = `${Math.floor(x * 8)}:${Math.floor(y * 12)}`;
        soapPoint = { x: rect.x + x * rect.w, y: rect.y + y * rect.h };
        drawBubbles();
        if (cell === lastCell) return;
        lastCell = cell;
        if (companion.careKind === 'bath') run(() => companion.wash({ x, y }));
        else run(() => companion.stroke({ x, y }));
      };
      careCanvas.addEventListener('pointerdown', (event) => {
        washing = true;
        lastCell = '';
        careCanvas.setPointerCapture(event.pointerId);
        wash(event);
      });
      careCanvas.addEventListener('pointermove', wash);
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
        careCanvas.addEventListener(event, () => {
          washing = false;
          soapPoint = null;
          drawBubbles();
        });
      const resize = () => {
        const width = garden.clientWidth,
          height = garden.clientHeight,
          dpr = Math.min(devicePixelRatio, 2);
        if (pet.width !== width || pet.height !== height || pet.dpr !== dpr) pet.resize(width, height, dpr);
        if (careCanvas.width !== width * dpr) careCanvas.width = width * dpr;
        if (careCanvas.height !== height * dpr) careCanvas.height = height * dpr;
        drawBubbles();
      };
      observer = new ResizeObserver(resize);
      observer.observe(garden);
      pet.on('frame', drawBubbles);
      resize();
      await pageClosed;
    } finally {
      account.close();
      if (observer) observer.disconnect();
      if (companion) companion.destroy();
      pet.destroy();
    }
  });
})().catch((error) => {
  document.getElementById('notice').textContent = error.message;
});
